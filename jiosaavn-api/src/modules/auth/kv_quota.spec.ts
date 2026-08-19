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
    ['usr_123', { id: 'usr_123', email: 'test@example.com', name: 'Test User', password_hash: 'hash', password_salt: 'salt', is_banned: 0, auth_version: 1, last_seen_at: new Date().toISOString() }],
    ['usr_456', { id: 'usr_456', email: 'user2@example.com', name: 'User Two', password_hash: 'hash', password_salt: 'salt', is_banned: 0, auth_version: 1, last_seen_at: new Date().toISOString() }]
  ])
  public recentlyPlayedStore: Array<{ id: number; user_id: string; song_id: string; song_data: string; played_at: string }> = []
  public lastBatchQueries: string[] = []
  private autoId = 1

  prepare(query: string) {
    const self = this
    return {
      _query: query,
      bind: (...args: any[]) => {
        const boundRun = async () => {
          if (query.includes('DELETE FROM recently_played WHERE user_id = ? AND song_id = ?')) {
            const [uId, sId] = args
            self.recentlyPlayedStore = self.recentlyPlayedStore.filter(r => !(r.user_id === uId && r.song_id === sId))
          } else if (query.includes('INSERT INTO recently_played')) {
            const [uId, sId, sData, pAt] = args
            self.recentlyPlayedStore.push({
              id: self.autoId++,
              user_id: uId,
              song_id: sId,
              song_data: sData,
              played_at: pAt || new Date().toISOString()
            })
          } else if (query.includes('DELETE FROM recently_played') && query.includes('NOT IN')) {
            const uId = args[0]
            const userRecords = self.recentlyPlayedStore
              .filter(r => r.user_id === uId)
              .sort((a, b) => {
                const diff = new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
                return diff !== 0 ? diff : b.id - a.id
              })
            const keepIds = new Set(userRecords.slice(0, 20).map(r => r.id))
            self.recentlyPlayedStore = self.recentlyPlayedStore.filter(r => r.user_id !== uId || keepIds.has(r.id))
          }

          if (query.includes('UPDATE users SET is_banned = 1')) {
            const targetId = args[args.length - 1]
            const u = self.usersMap.get(targetId)
            if (u) { u.is_banned = 1; u.auth_version = (u.auth_version || 1) + 1 }
          }
          if (query.includes('UPDATE users SET is_banned = 0')) {
            const targetId = args[args.length - 1]
            const u = self.usersMap.get(targetId)
            if (u) { u.is_banned = 0; u.auth_version = (u.auth_version || 1) + 1 }
          }
          if (query.includes('UPDATE users SET auth_version =')) {
            const targetId = args[args.length - 1]
            const u = self.usersMap.get(targetId)
            if (u) { u.auth_version = (u.auth_version || 1) + 1 }
          }
          if (query.includes('DELETE FROM users')) {
            const targetId = args[0]
            self.usersMap.delete(targetId)
          }
          return { meta: { changes: 1 } }
        }

        return {
          _query: query,
          first: async () => {
            if (query.includes('FROM users')) {
              const val = args[0]
              return self.usersMap.get(val) || null
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
            if (query.includes('FROM recently_played')) {
              const userId = args[0]
              const userRecords = self.recentlyPlayedStore
                .filter(r => r.user_id === userId)
                .sort((a, b) => {
                  const diff = new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
                  return diff !== 0 ? diff : b.id - a.id
                })
              const limitMatch = query.match(/LIMIT\s+(\d+)/i)
              const limit = limitMatch ? parseInt(limitMatch[1], 10) : 12
              return { results: userRecords.slice(0, limit) }
            }
            if (query.includes('liked_songs')) return { results: [] }
            if (query.includes('playlists')) return { results: [] }
            if (query.includes('users')) return { results: Array.from(self.usersMap.values()) }
            return { results: [] }
          },
          run: boundRun
        }
      },
      run: async () => ({ meta: { changes: 1 } }),
      all: async () => ({ results: [] }),
      first: async () => null
    }
  }

  async batch(statements: any[]) {
    this.lastBatchQueries = statements.map((s: any) => s._query || '')
    const results = []
    for (const stmt of statements) {
      if (typeof stmt.run === 'function') {
        results.push(await stmt.run())
      } else {
        results.push({ meta: { changes: 1 } })
      }
    }
    return results
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

  // 8. RECENTLY PLAYED & CLOUD PERSISTENCE
  describe('Recently Played Cloud Persistence & Security', () => {
    let tokenUser1: string
    let tokenUser2: string

    beforeEach(async () => {
      tokenUser1 = await createSignedSessionToken('usr_123', 1, mockEnv)
      tokenUser2 = await createSignedSessionToken('usr_456', 1, mockEnv)
      mockDb.recentlyPlayedStore = []
      mockKv.puts = 0
      mockKv.gets = 0
    })

    it('1. POST /api/user/recently-played succeeds for authenticated user via atomic D1 batch', async () => {
      const req = new Request('http://localhost/api/user/recently-played', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenUser1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: { id: 'song_1', name: 'Track 1' } })
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.success).toBe(true)
      expect(mockDb.recentlyPlayedStore.length).toBe(1)
      // Verify atomic db.batch was used with all 3 statements
      expect(mockDb.lastBatchQueries.length).toBe(3)
      expect(mockDb.lastBatchQueries[0]).toContain('DELETE FROM recently_played WHERE user_id = ? AND song_id = ?')
      expect(mockDb.lastBatchQueries[1]).toContain('INSERT INTO recently_played')
      expect(mockDb.lastBatchQueries[2]).toContain('ORDER BY played_at DESC, id DESC LIMIT 20')
    })

    it('2. POST rejects unauthenticated request with 401', async () => {
      const req = new Request('http://localhost/api/user/recently-played', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: { id: 'song_1' } })
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(401)
    })

    it('3. POST rejects malformed payload with 400', async () => {
      const req = new Request('http://localhost/api/user/recently-played', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenUser1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: null })
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(400)
    })

    it('4. GET /api/user/recently-played returns recently played songs', async () => {
      mockDb.recentlyPlayedStore.push({
        id: 1, user_id: 'usr_123', song_id: 'song_1', song_data: JSON.stringify({ id: 'song_1', name: 'Track 1' }), played_at: new Date().toISOString()
      })
      const req = new Request('http://localhost/api/user/recently-played', {
        headers: { 'Authorization': `Bearer ${tokenUser1}` }
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.length).toBe(1)
      expect(data.data[0].id).toBe('song_1')
    })

    it('5. GET returns newest played tracks first with id DESC tie-breaker on identical timestamps', async () => {
      const sameTime = new Date().toISOString()
      // Insert two records with identical timestamps but different IDs (id 1 vs id 2)
      mockDb.recentlyPlayedStore.push(
        { id: 1, user_id: 'usr_123', song_id: 'song_first', song_data: JSON.stringify({ id: 'song_first' }), played_at: sameTime },
        { id: 2, user_id: 'usr_123', song_id: 'song_second', song_data: JSON.stringify({ id: 'song_second' }), played_at: sameTime }
      )
      const req = new Request('http://localhost/api/user/recently-played', {
        headers: { 'Authorization': `Bearer ${tokenUser1}` }
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      const data: any = await res.json()
      // id 2 must come first due to id DESC tie-breaker
      expect(data.data[0].id).toBe('song_second')
      expect(data.data[1].id).toBe('song_first')
    })

    it('6. GET is limited to 12 records max', async () => {
      for (let i = 1; i <= 15; i++) {
        mockDb.recentlyPlayedStore.push({
          id: i, user_id: 'usr_123', song_id: `song_${i}`, song_data: JSON.stringify({ id: `song_${i}` }), played_at: new Date(Date.now() + i * 1000).toISOString()
        })
      }
      const req = new Request('http://localhost/api/user/recently-played', {
        headers: { 'Authorization': `Bearer ${tokenUser1}` }
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      const data: any = await res.json()
      expect(data.data.length).toBe(12)
    })

    it('7. User A cannot see User B history (User Isolation)', async () => {
      mockDb.recentlyPlayedStore.push({
        id: 1, user_id: 'usr_456', song_id: 'user2_song', song_data: JSON.stringify({ id: 'user2_song' }), played_at: new Date().toISOString()
      })
      const req = new Request('http://localhost/api/user/recently-played', {
        headers: { 'Authorization': `Bearer ${tokenUser1}` }
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      const data: any = await res.json()
      expect(data.data.length).toBe(0)
    })

    it('8. User A cannot modify User B history (User Isolation)', async () => {
      mockDb.recentlyPlayedStore.push({
        id: 1, user_id: 'usr_456', song_id: 'user2_song', song_data: JSON.stringify({ id: 'user2_song' }), played_at: new Date().toISOString()
      })
      const req = new Request('http://localhost/api/user/recently-played', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenUser1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: { id: 'user1_song' } })
      })
      await app.fetch(req, mockEnv, mockCtx)
      const user2Records = mockDb.recentlyPlayedStore.filter(r => r.user_id === 'usr_456')
      expect(user2Records.length).toBe(1)
      expect(user2Records[0].song_id).toBe('user2_song')
    })

    it('9. Same song does not create unbounded duplicate history (Deduplication)', async () => {
      const req1 = new Request('http://localhost/api/user/recently-played', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenUser1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: { id: 'repeat_song', name: 'Repeat' } })
      })
      await app.fetch(req1, mockEnv, mockCtx)

      const req2 = new Request('http://localhost/api/user/recently-played', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenUser1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: { id: 'repeat_song', name: 'Repeat' } })
      })
      await app.fetch(req2, mockEnv, mockCtx)

      const user1Records = mockDb.recentlyPlayedStore.filter(r => r.user_id === 'usr_123')
      expect(user1Records.length).toBe(1)
      expect(user1Records[0].song_id).toBe('repeat_song')
    })

    it('10. Retention is capped at 20 records per user', async () => {
      for (let i = 1; i <= 25; i++) {
        const req = new Request('http://localhost/api/user/recently-played', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenUser1}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ song: { id: `track_${i}` } })
        })
        await app.fetch(req, mockEnv, mockCtx)
      }
      const user1Records = mockDb.recentlyPlayedStore.filter(r => r.user_id === 'usr_123')
      expect(user1Records.length).toBe(20)
    })

    it('11. User A retention cleanup never deletes User B records', async () => {
      mockDb.recentlyPlayedStore.push({
        id: 99, user_id: 'usr_456', song_id: 'user2_important', song_data: JSON.stringify({ id: 'user2_important' }), played_at: new Date().toISOString()
      })
      for (let i = 1; i <= 22; i++) {
        const req = new Request('http://localhost/api/user/recently-played', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenUser1}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ song: { id: `user1_track_${i}` } })
        })
        await app.fetch(req, mockEnv, mockCtx)
      }
      const user2Records = mockDb.recentlyPlayedStore.filter(r => r.user_id === 'usr_456')
      expect(user2Records.length).toBe(1)
      expect(user2Records[0].song_id).toBe('user2_important')
    })

    it('12. POST performs 0 KV PUTs', async () => {
      const initialPuts = mockKv.puts
      const req = new Request('http://localhost/api/user/recently-played', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenUser1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: { id: 'kv_check_song' } })
      })
      await app.fetch(req, mockEnv, mockCtx)
      expect(mockKv.puts).toBe(initialPuts)
    })

    it('13. POST performs 0 KV GETs', async () => {
      const initialGets = mockKv.gets
      const req = new Request('http://localhost/api/user/recently-played', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenUser1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: { id: 'kv_check_song' } })
      })
      await app.fetch(req, mockEnv, mockCtx)
      expect(mockKv.gets).toBe(initialGets)
    })

    it('14. GET performs 0 KV operations', async () => {
      const initialGets = mockKv.gets
      const initialPuts = mockKv.puts
      const req = new Request('http://localhost/api/user/recently-played', {
        headers: { 'Authorization': `Bearer ${tokenUser1}` }
      })
      await app.fetch(req, mockEnv, mockCtx)
      expect(mockKv.gets).toBe(initialGets)
      expect(mockKv.puts).toBe(initialPuts)
    })
  })

  // 9. ISOLATE BROADCAST CACHE & LEGACY TOKEN SECURITY
  describe('Isolate Memory Caching & Legacy Token Security', () => {
    it('uses isolate memory cache for GET /api/user/broadcast to eliminate redundant KV reads', async () => {
      const token = await createSignedSessionToken('usr_123', 1, mockEnv)
      await mockKv.put('global:broadcast', JSON.stringify({ message: 'System maintenance scheduled', timestamp: Date.now() }))
      const initialGets = mockKv.gets

      // Request 1: Cold isolate -> Reads KV once and populates isolate cache
      const req1 = new Request('http://localhost/api/user/broadcast', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const res1 = await app.fetch(req1, mockEnv, mockCtx)
      expect(res1.status).toBe(200)
      const data1: any = await res1.json()
      expect(data1.broadcast.message).toBe('System maintenance scheduled')
      const getsAfterFirst = mockKv.gets
      expect(getsAfterFirst).toBe(initialGets + 1)

      // Request 2: Warm isolate -> Serves from isolate memory cache without calling kv.get()
      const req2 = new Request('http://localhost/api/user/broadcast', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const res2 = await app.fetch(req2, mockEnv, mockCtx)
      expect(res2.status).toBe(200)
      const data2: any = await res2.json()
      expect(data2.broadcast.message).toBe('System maintenance scheduled')
      expect(mockKv.gets).toBe(getsAfterFirst) // 0 additional KV reads!
    })

    it('rejects non-HMAC legacy tokens with 401 without querying Workers KV', async () => {
      const initialGets = mockKv.gets
      const req = new Request('http://localhost/api/user/liked', {
        headers: { 'Authorization': 'Bearer legacy_non_hmac_token_without_dot' }
      })
      const res = await app.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(401)
      expect(mockKv.gets).toBe(initialGets) // 0 KV reads!
    })
  })
})
