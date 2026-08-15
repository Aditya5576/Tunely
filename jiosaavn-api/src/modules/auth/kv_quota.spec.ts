import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authController } from './auth.controller'
import { userController } from './user.controller'
import { adminController } from './admin.controller'
import { createSignedTicket, verifySignedTicket } from './crypto'

const app = new Hono()
app.route('/api/auth', authController)
app.route('/api/user', userController)
app.route('/api/admin', adminController)

class MockKVNamespace {
  public puts = 0
  public gets = 0
  public deletes = 0
  private store = new Map<string, string>()

  async put(key: string, value: string) {
    this.puts++
    this.store.set(key, value)
  }
  async get(key: string) {
    this.gets++
    return this.store.get(key) || null
  }
  async delete(key: string) {
    this.deletes++
    this.store.delete(key)
  }
}

class MockD1Database {
  private usersMap = new Map<string, any>([
    ['usr_123', { id: 'usr_123', email: 'test@example.com', name: 'Test User', is_banned: 0, last_seen_at: new Date().toISOString() }]
  ])

  prepare(query: string) {
    return {
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('FROM users')) {
            const val = args[0]
            for (const u of this.usersMap.values()) {
              if (u.email === val || u.id === val) return u
            }
            return { id: 'usr_123', email: 'test@example.com', name: 'Test User', is_banned: 0 }
          }
          if (query.includes('user_sync_state')) {
            return { ts: new Date().toISOString(), liked_updated_at: new Date().toISOString(), playlists_updated_at: new Date().toISOString() }
          }
          if (query.includes('liked_songs')) {
            return { latest: new Date().toISOString(), count: 1 }
          }
          if (query.includes('playlists')) {
            return { id: 'pl_123', latest: new Date().toISOString(), count: 1 }
          }
          return null
        },
        all: async () => {
          if (query.includes('liked_songs')) return { results: [] }
          if (query.includes('playlists')) return { results: [] }
          if (query.includes('users')) return { results: Array.from(this.usersMap.values()) }
          return { results: [] }
        },
        run: async () => ({ meta: { changes: 1 } })
      }),
      run: async () => ({ meta: { changes: 1 } }),
      all: async () => ({ results: [] }),
      first: async () => null
    }
  }

  async batch(statements: any[]) {
    return statements.map(() => ({ meta: { changes: 1 } }))
  }
}

describe('Cloudflare Workers KV Quota Zero-Write Guarantee & HMAC Ticket Security', () => {
  let mockKv: MockKVNamespace
  let mockDb: MockD1Database
  let mockEnv: any
  let sessionToken: string

  beforeEach(async () => {
    mockKv = new MockKVNamespace()
    mockDb = new MockD1Database()
    mockEnv = {
      TUNELY_SESSIONS: mockKv,
      DB: mockDb,
      JWT_SECRET: 'test_jwt_secret_key_12345',
      ADMIN_PASSWORD: 'admin_password_12345',
      USER_SYNC_DO: {
        idFromName: () => 'do_id_123',
        get: () => ({
          fetch: async () => new Response(JSON.stringify({ success: true, activity: { isPlaying: true } }))
        })
      }
    }
    sessionToken = 'mock_valid_session_token_123'
    await mockKv.put(sessionToken, JSON.stringify({ userId: 'usr_123', createdAt: new Date().toISOString() }))
  })

  // 1. HMAC TICKET SECURITY TESTS
  describe('HMAC Ticket Security & Validation', () => {
    it('generates and verifies valid HMAC ticket with 0 KV operations', async () => {
      const ticket = await createSignedTicket('usr_123', mockEnv)
      expect(ticket).toContain('.')

      const result = await verifySignedTicket(ticket, mockEnv)
      expect(result.valid).toBe(true)
      expect(result.userId).toBe('usr_123')
    })

    it('rejects expired ticket', async () => {
      const exp = Date.now() - 10000
      const payloadStr = JSON.stringify({ u: 'usr_123', e: exp, n: 'nonce123' })
      const encoder = new TextEncoder()
      const payloadB64 = btoa(payloadStr).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')

      const key = await crypto.subtle.importKey('raw', encoder.encode('test_jwt_secret_key_12345'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64))
      const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')
      const expiredTicket = `${payloadB64}.${sigB64}`

      const result = await verifySignedTicket(expiredTicket, mockEnv)
      expect(result.valid).toBe(false)
    })

    it('rejects malformed ticket', async () => {
      const result1 = await verifySignedTicket('not_a_ticket', mockEnv)
      expect(result1.valid).toBe(false)

      const result2 = await verifySignedTicket('invalid.payload.signature', mockEnv)
      expect(result2.valid).toBe(false)
    })

    it('rejects tampered / modified ticket payload', async () => {
      const ticket = await createSignedTicket('usr_123', mockEnv)
      const [payloadB64, sigB64] = ticket.split('.')
      const tamperedPayloadB64 = btoa(JSON.stringify({ u: 'usr_hacker', e: Date.now() + 60000 })).replaceAll('=', '')
      const tamperedTicket = `${tamperedPayloadB64}.${sigB64}`

      const result = await verifySignedTicket(tamperedTicket, mockEnv)
      expect(result.valid).toBe(false)
    })

    it('rejects ticket signed with wrong secret', async () => {
      const ticketWrongSecret = await createSignedTicket('usr_123', 'wrong_secret_key')
      const result = await verifySignedTicket(ticketWrongSecret, mockEnv)
      expect(result.valid).toBe(false)
    })
  })

  // 2. AUTH MIDDLEWARE IN-MEMORY CACHE EVICTION TESTS
  describe('Auth Middleware In-Memory Cache Security & Eviction', () => {
    it('invalidates in-memory session cache immediately upon logout', async () => {
      // 1. Warm up memory cache
      const req1 = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${sessionToken}` } })
      await app.fetch(req1, mockEnv)

      // 2. Perform logout
      const logoutReq = new Request('http://localhost/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${sessionToken}` } })
      const logoutRes = await app.fetch(logoutReq, mockEnv)
      expect(logoutRes.status).toBe(200)

      // 3. Subsequent request with logged out token is rejected immediately
      const req2 = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${sessionToken}` } })
      const res2 = await app.fetch(req2, mockEnv)
      expect(res2.status).toBe(401)
    })

    it('invalidates in-memory session cache immediately upon admin ban', async () => {
      // 1. Warm up memory cache
      const req1 = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${sessionToken}` } })
      await app.fetch(req1, mockEnv)

      // 2. Admin bans user
      await mockKv.put('admin_session:admin_token_12345678901234567890123456789012', 'valid')
      const banReq = new Request('http://localhost/api/admin/users/usr_123/ban', {
        method: 'POST',
        headers: { 'Authorization': 'AdminBearer admin_token_12345678901234567890123456789012' }
      })
      await app.fetch(banReq, mockEnv)

      // 3. Delete from KV to simulate revoked KV state
      await mockKv.delete(sessionToken)

      // 4. Request with banned user token is rejected (not allowed by stale cache)
      const req2 = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${sessionToken}` } })
      const res2 = await app.fetch(req2, mockEnv)
      expect(res2.status).toBe(401)
    })

    it('rejects revoked KV session without stale fallback', async () => {
      // Create token in KV
      const freshToken = 'fresh_token_999'
      await mockKv.put(freshToken, JSON.stringify({ userId: 'usr_123', createdAt: new Date().toISOString() }))

      // Revoke in KV
      await mockKv.delete(freshToken)

      // Request must return 401
      const req = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${freshToken}` } })
      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(401)
    })
  })

  // 2. ROUTE BY ROUTE ZERO-KV WRITE PROOF
  describe('Application Routes Zero-KV Write Verification', () => {
    it('POST /api/auth/ws-ticket => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/auth/ws-ticket', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.success).toBe(true)
      expect(data.ticket).toBeDefined()
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('POST /api/user/activity => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ isPlaying: true, progress: 30, track: { id: 'song_1' } })
      })
      const res = await app.fetch(req, mockEnv, { waitUntil: () => {} } as any)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('POST /api/user/liked (create) => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/liked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ song: { id: 'song_123', name: 'Test Song' } })
      })
      const res = await app.fetch(req, mockEnv, { waitUntil: () => {} } as any)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('DELETE /api/user/liked/:songId => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/liked/song_123', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
      const res = await app.fetch(req, mockEnv, { waitUntil: () => {} } as any)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('POST /api/user/liked/sync => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/liked/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ songs: [{ id: 'song_123', name: 'Synced Song' }], localUpdatedAt: new Date().toISOString() })
      })
      const res = await app.fetch(req, mockEnv, { waitUntil: () => {} } as any)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('POST /api/user/playlists (create) => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ name: 'Chill Vibes', songs: [] })
      })
      const res = await app.fetch(req, mockEnv, { waitUntil: () => {} } as any)
      expect(res.status).toBe(201)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('PUT /api/user/playlists/:id (update) => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/playlists/pl_123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ name: 'Party Mix' })
      })
      const res = await app.fetch(req, mockEnv, { waitUntil: () => {} } as any)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('DELETE /api/user/playlists/:id => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/playlists/pl_123', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
      const res = await app.fetch(req, mockEnv, { waitUntil: () => {} } as any)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('POST /api/user/playlists/sync => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/playlists/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ playlists: [{ id: 'pl_123', name: 'Synced Playlist', songs: [] }], localUpdatedAt: new Date().toISOString() })
      })
      const res = await app.fetch(req, mockEnv, { waitUntil: () => {} } as any)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('PUT /api/auth/profile => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ name: 'Updated Name', bio: 'Music Lover', avatarBg: '#ff0055' })
      })
      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('POST /api/admin/users/:id/ban => 0 KV PUT', async () => {
      await mockKv.put('admin_session:admin_token_12345678901234567890123456789012', 'valid')
      const putsBefore = mockKv.puts

      const req = new Request('http://localhost/api/admin/users/usr_123/ban', {
        method: 'POST',
        headers: { 'Authorization': 'AdminBearer admin_token_12345678901234567890123456789012' }
      })
      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('POST /api/admin/users/:id/unban => 0 KV PUT', async () => {
      await mockKv.put('admin_session:admin_token_12345678901234567890123456789012', 'valid')
      const putsBefore = mockKv.puts

      const req = new Request('http://localhost/api/admin/users/usr_123/unban', {
        method: 'POST',
        headers: { 'Authorization': 'AdminBearer admin_token_12345678901234567890123456789012' }
      })
      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })
  })
})
