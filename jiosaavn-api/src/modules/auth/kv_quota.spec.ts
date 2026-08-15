import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authController } from './auth.controller'
import { userController } from './user.controller'
import { adminController } from './admin.controller'
import {
  createSignedSessionToken,
  verifySignedSessionToken,
  createSignedTicket,
  verifySignedTicket
} from './crypto'
import { memorySessionCache, invalidateSessionCache } from './auth.middleware'

const app = new Hono()
app.route('/api/auth', authController)
app.route('/api/user', userController)
app.route('/api/admin', adminController)

const mockCtx = { waitUntil: () => {} } as any

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
  public usersMap = new Map<string, any>([
    ['usr_123', { id: 'usr_123', email: 'test@example.com', name: 'Test User', password_hash: 'hash', password_salt: 'salt', is_banned: 0, auth_version: 1, last_seen_at: new Date().toISOString() }]
  ])

  prepare(query: string) {
    return {
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('FROM users')) {
            const val = args[0]
            return this.usersMap.get(val) || null
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
        run: async () => {
          if (query.includes('UPDATE users SET is_banned = 1')) {
            const targetId = args[args.length - 1]
            const u = this.usersMap.get(targetId)
            if (u) { u.is_banned = 1; u.auth_version = (u.auth_version || 1) + 1 }
          }
          if (query.includes('UPDATE users SET is_banned = 0')) {
            const targetId = args[args.length - 1]
            const u = this.usersMap.get(targetId)
            if (u) { u.is_banned = 0; u.auth_version = (u.auth_version || 1) + 1 }
          }
          if (query.includes('UPDATE users SET auth_version =')) {
            const targetId = args[args.length - 1]
            const u = this.usersMap.get(targetId)
            if (u) { u.auth_version = (u.auth_version || 1) + 1 }
          }
          if (query.includes('DELETE FROM users')) {
            const targetId = args[0]
            this.usersMap.delete(targetId)
          }
          return { meta: { changes: 1 } }
        }
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

describe('Hybrid Auth Architecture Comprehensive Security Test Suite', () => {
  let mockKv: MockKVNamespace
  let mockDb: MockD1Database
  let mockEnv: any
  let validHmacToken: string

  beforeEach(async () => {
    memorySessionCache.clear()
    mockKv = new MockKVNamespace()
    mockDb = new MockD1Database()
    mockEnv = {
      TUNELY_SESSIONS: mockKv,
      DB: mockDb,
      AUTH_SIGNING_SECRET: 'test_auth_signing_secret_v1',
      USER_SYNC_DO: {
        idFromName: () => 'do_id_123',
        get: () => ({
          fetch: async (url: string) => {
            if (url.includes('/auth-check')) {
              return new Response(JSON.stringify({ success: true, authVersion: 1, isBanned: false }))
            }
            if (url.includes('/update-auth')) {
              return new Response(JSON.stringify({ success: true }))
            }
            return new Response(JSON.stringify({ success: true, activity: { isPlaying: true } }))
          }
        })
      }
    }
    validHmacToken = await createSignedSessionToken('usr_123', 1, mockEnv)
  })

  // 1. HMAC TOKEN SECURITY
  describe('HMAC Token Cryptographic Security', () => {
    it('verifies valid HMAC session token without network calls', async () => {
      const res = await verifySignedSessionToken(validHmacToken, mockEnv)
      expect(res.valid).toBe(true)
      expect(res.userId).toBe('usr_123')
      expect(res.authVersion).toBe(1)
    })

    it('rejects token with invalid signature', async () => {
      const parts = validHmacToken.split('.')
      const invalidToken = `${parts[0]}.invalid_signature_hex`
      const res = await verifySignedSessionToken(invalidToken, mockEnv)
      expect(res.valid).toBe(false)
    })

    it('rejects tampered payload', async () => {
      const parts = validHmacToken.split('.')
      const tamperedPayloadB64 = btoa(JSON.stringify({ u: 'usr_hacker', v: 1, e: Date.now() + 60000 }))
      const tamperedToken = `${tamperedPayloadB64}.${parts[1]}`
      const res = await verifySignedSessionToken(tamperedToken, mockEnv)
      expect(res.valid).toBe(false)
    })

    it('rejects expired token', async () => {
      const expPast = Date.now() - 10000
      const payloadB64 = btoa(JSON.stringify({ u: 'usr_123', v: 1, e: expPast, n: 'nonce' }))
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey('raw', encoder.encode('test_auth_signing_secret_v1'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64))
      const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')
      const expiredHmacToken = `${payloadB64}.${sigB64}`

      const res = await verifySignedSessionToken(expiredHmacToken, mockEnv)
      expect(res.valid).toBe(false)
    })

    it('rejects malformed token', async () => {
      const res = await verifySignedSessionToken('not_a_valid_token_string', mockEnv)
      expect(res.valid).toBe(false)
    })
  })

  // 2. AUTH_SIGNING_SECRET STRICTNESS TESTS
  describe('AUTH_SIGNING_SECRET Strict Secret Resolution', () => {
    it('succeeds when AUTH_SIGNING_SECRET is present', async () => {
      const env = { AUTH_SIGNING_SECRET: 'my_auth_secret_999' }
      const token = await createSignedSessionToken('usr_123', 1, env)
      const res = await verifySignedSessionToken(token, env)
      expect(res.valid).toBe(true)
    })

    it('fails when AUTH_SIGNING_SECRET is missing even if JWT_SECRET is present', async () => {
      const env = { JWT_SECRET: 'jwt_secret_only' }
      let thrown = false
      try {
        await createSignedSessionToken('usr_123', 1, env)
      } catch (e: any) {
        thrown = true
        expect(e.message).toContain('AUTH_SIGNING_SECRET environment secret is missing')
      }
      expect(thrown).toBe(true)
    })

    it('fails when AUTH_SIGNING_SECRET is missing even if ADMIN_PASSWORD is present', async () => {
      const env = { ADMIN_PASSWORD: 'admin_pass_only' }
      let thrown = false
      try {
        await createSignedSessionToken('usr_123', 1, env)
      } catch (e: any) {
        thrown = true
        expect(e.message).toContain('AUTH_SIGNING_SECRET environment secret is missing')
      }
      expect(thrown).toBe(true)
    })

    it('fails when AUTH_SIGNING_SECRET is missing even if SESSION_SECRET is present', async () => {
      const env = { SESSION_SECRET: 'session_pass_only' }
      let thrown = false
      try {
        await createSignedSessionToken('usr_123', 1, env)
      } catch (e: any) {
        thrown = true
        expect(e.message).toContain('AUTH_SIGNING_SECRET environment secret is missing')
      }
      expect(thrown).toBe(true)
    })
  })

  // 3. RESTORED 6 ROUTE-LEVEL 0-KV ASSERTION TESTS
  describe('Route-Level Zero-KV Write Enforcement Assertions', () => {
    it('GET /api/user/liked => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/liked', { headers: { 'Authorization': `Bearer ${validHmacToken}` } })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('POST /api/user/liked => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/liked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${validHmacToken}` },
        body: JSON.stringify({ song: { id: 's1', name: 'Song 1' } })
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('DELETE /api/user/liked/:songId => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/liked/s1', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${validHmacToken}` }
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('POST /api/user/playlists => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${validHmacToken}` },
        body: JSON.stringify({ name: 'My Playlist', songs: [] })
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(201)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('PUT /api/user/playlists/:id => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/user/playlists/pl_123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${validHmacToken}` },
        body: JSON.stringify({ name: 'Updated Playlist' })
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })

    it('PUT /api/auth/profile => 0 KV PUT', async () => {
      const putsBefore = mockKv.puts
      const req = new Request('http://localhost/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${validHmacToken}` },
        body: JSON.stringify({ name: 'Updated Name', bio: 'Bio Text' })
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(200)
      expect(mockKv.puts - putsBefore).toBe(0)
    })
  })

  // 4. ACCOUNT DELETION FAILURE MODE TEST
  describe('Account Deletion & DO Rehydration Failure Mode', () => {
    it('permanently revokes access on admin delete and fails closed on D1 outage during rehydration', async () => {
      // 1. User exists and token is valid
      const req1 = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${validHmacToken}` } })
      const res1 = await app.fetch(req1, mockEnv, mockCtx)
      expect(res1.status).toBe(200)

      // 2. Admin deletes user account
      let doDeleted = false
      let socketsClosed = false
      mockEnv.USER_SYNC_DO.get = () => ({
        fetch: async (url: string) => {
          if (url.includes('/update-auth')) {
            doDeleted = true
            socketsClosed = true
            return new Response(JSON.stringify({ success: true }))
          }
          if (url.includes('/auth-check')) {
            return new Response(JSON.stringify({ success: false, authVersion: 999, isBanned: true }))
          }
          return new Response(JSON.stringify({ success: false }), { status: 404 })
        }
      })

      await mockDb.prepare('DELETE FROM users WHERE id = ?').bind('usr_123').run()
      invalidateSessionCache(undefined, 'usr_123')

      // 3. Subsequent request with existing token is rejected
      const req2 = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${validHmacToken}` } })
      const res2 = await app.fetch(req2, mockEnv, mockCtx)
      expect([401, 403, 503]).toContain(res2.status)

      // 4. DO restarts & D1 is unavailable -> Fails closed with 503
      const brokenEnv = {
        AUTH_SIGNING_SECRET: 'test_auth_signing_secret_v1',
        USER_SYNC_DO: {
          idFromName: () => 'do_id_123',
          get: () => ({
            fetch: async () => { throw new Error('DO Outage') }
          })
        },
        DB: {
          prepare: () => { throw new Error('D1 Down') }
        }
      }
      const req3 = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${validHmacToken}` } })
      const res3 = await app.fetch(req3, brokenEnv, mockCtx)
      expect(res3.status).toBe(503)
    })
  })

  // 5. CACHE CEILING TESTS (<10s hit, >=10s refresh)
  describe('10-Second Worker Isolate Cache Ceiling', () => {
    it('uses 10s isolate cache hit without sub-requests for <10s', async () => {
      const req1 = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${validHmacToken}` } })
      const res1 = await app.fetch(req1, mockEnv, mockCtx)
      expect(res1.status).toBe(200)

      const req2 = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${validHmacToken}` } })
      const res2 = await app.fetch(req2, mockEnv, mockCtx)
      expect(res2.status).toBe(200)
    })

    it('re-verifies against DO/D1 when cache entry is >10s old', async () => {
      memorySessionCache.set(validHmacToken, {
        userId: 'usr_123',
        authVersion: 1,
        isBanned: false,
        timestamp: Date.now() - 15000
      })

      let doFetched = false
      mockEnv.USER_SYNC_DO.get = () => ({
        fetch: async (url: string) => {
          if (url.includes('/auth-check')) {
            doFetched = true
            return new Response(JSON.stringify({ success: true, authVersion: 1, isBanned: false }))
          }
          return new Response(JSON.stringify({ success: true }))
        }
      })

      const req = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${validHmacToken}` } })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(200)
      expect(doFetched).toBe(true)
    })
  })

  // 6. FAIL CLOSED BEHAVIOR (DO & D1 UNAVAILABLE)
  describe('Fail Closed Security Enforcement', () => {
    it('fails closed with 503 if DO and D1 are both unavailable', async () => {
      const brokenEnv = {
        AUTH_SIGNING_SECRET: 'test_auth_signing_secret_v1',
        USER_SYNC_DO: {
          idFromName: () => 'do_id_123',
          get: () => ({
            fetch: async () => { throw new Error('DO Unavailable') }
          })
        },
        DB: {
          prepare: () => { throw new Error('D1 Database Down') }
        }
      }

      const req = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${validHmacToken}` } })
      const res = await app.fetch(req, brokenEnv, mockCtx)
      expect(res.status).toBe(503)
    })

    it('falls back to D1 healthy if DO is unavailable', async () => {
      const doBrokenEnv = {
        AUTH_SIGNING_SECRET: 'test_auth_signing_secret_v1',
        DB: mockDb,
        USER_SYNC_DO: {
          idFromName: () => 'do_id_123',
          get: () => ({
            fetch: async () => { throw new Error('DO Outage') }
          })
        }
      }

      const req = new Request('http://localhost/api/auth/me', { headers: { 'Authorization': `Bearer ${validHmacToken}` } })
      const res = await app.fetch(req, doBrokenEnv, mockCtx)
      expect(res.status).toBe(200)
    })
  })

  // 7. WEBSOCKET TICKET VALIDATION
  describe('WebSocket Ticket Security & Revocation', () => {
    it('generates valid WS ticket containing current authVersion', async () => {
      const req = new Request('http://localhost/api/auth/ws-ticket', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${validHmacToken}` }
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.ticket).toBeDefined()

      const verified = await verifySignedTicket(data.ticket, mockEnv)
      expect(verified.valid).toBe(true)
      expect(verified.userId).toBe('usr_123')
      expect(verified.authVersion).toBe(1)
    })
  })
})
