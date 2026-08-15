import { describe, it, expect, beforeEach } from 'vitest'
import { userController } from './user.controller'
import { adminController } from './admin.controller'
import { createSignedTicket, verifySignedTicket } from './crypto'

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
  private usersMap = new Map<string, any>()
  private syncStateMap = new Map<string, any>()

  prepare(query: string) {
    return {
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('SELECT id, email, name')) {
            const email = args[0]
            for (const u of this.usersMap.values()) {
              if (u.email === email || u.id === args[0]) return u
            }
            return { id: 'usr_test123', email: 'test@example.com', name: 'Test User', is_banned: 0 }
          }
          if (query.includes('user_sync_state')) {
            return this.syncStateMap.get(args[0]) || { ts: new Date().toISOString() }
          }
          if (query.includes('liked_songs')) {
            return { latest: new Date().toISOString(), count: 1 }
          }
          if (query.includes('playlists')) {
            return { latest: new Date().toISOString(), count: 1 }
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

describe('Cloudflare Workers KV Quota Zero-Write Guarantee', () => {
  let mockKv: MockKVNamespace
  let mockDb: MockD1Database
  let mockEnv: any

  beforeEach(() => {
    mockKv = new MockKVNamespace()
    mockDb = new MockD1Database()
    mockEnv = {
      TUNELY_SESSIONS: mockKv,
      DB: mockDb,
      USER_SYNC_DO: {
        idFromName: () => 'do_id_123',
        get: () => ({
          fetch: async (url: string, opts?: any) => new Response(JSON.stringify({ success: true }))
        })
      }
    }
  })

  it('HMAC signed tickets generate and verify with 0 KV operations', async () => {
    const ticket = await createSignedTicket('usr_123')
    expect(ticket).toContain('.')
    expect(mockKv.puts).toBe(0)

    const verification = await verifySignedTicket(ticket)
    expect(verification.valid).toBe(true)
    expect(verification.userId).toBe('usr_123')
    expect(mockKv.gets).toBe(0)
    expect(mockKv.deletes).toBe(0)
  })

  it('POST /api/user/activity performs 0 KV PUTs', async () => {
    const initialPuts = mockKv.puts
    const req = new Request('http://localhost/api/user/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid_mock_token' },
      body: JSON.stringify({ isPlaying: true, progress: 42, track: { id: 'song_1' } })
    })

    await userController.fetch(req, mockEnv, { waitUntil: () => {} } as any)
    expect(mockKv.puts - initialPuts).toBe(0)
  })

  it('Liked song CRUD operations perform 0 KV PUTs', async () => {
    const initialPuts = mockKv.puts
    const postReq = new Request('http://localhost/api/user/liked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer mock_token' },
      body: JSON.stringify({ song: { id: 'song_123', name: 'Test Track' } })
    })

    await userController.fetch(postReq, mockEnv, { waitUntil: () => {} } as any)
    expect(mockKv.puts - initialPuts).toBe(0)
  })

  it('Playlist CRUD operations perform 0 KV PUTs', async () => {
    const initialPuts = mockKv.puts
    const postReq = new Request('http://localhost/api/user/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer mock_token' },
      body: JSON.stringify({ name: 'My Playlist', songs: [] })
    })

    await userController.fetch(postReq, mockEnv, { waitUntil: () => {} } as any)
    expect(mockKv.puts - initialPuts).toBe(0)
  })

  it('Admin user ban/unban performs 0 KV PUTs', async () => {
    await mockKv.put('admin_session:12345678901234567890123456789012', 'valid')
    const putsAfterAdminLogin = mockKv.puts

    const banReq = new Request('http://localhost/api/admin/users/usr_123/ban', {
      method: 'POST',
      headers: { 'Authorization': 'AdminBearer 12345678901234567890123456789012' }
    })

    await adminController.fetch(banReq, mockEnv, { waitUntil: () => {} } as any)
    expect(mockKv.puts - putsAfterAdminLogin).toBe(0)
  })
})
