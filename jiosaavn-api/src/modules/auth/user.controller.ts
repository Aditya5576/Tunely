import { Hono } from 'hono'
import { authMiddleware } from './auth.middleware'
import { generatePlaylistId, verifySignedTicket } from './crypto'

export const userController = new Hono<{
  Variables: {
    userId: string
    token: string
  }
}>()

/**
 * Helper to maintain user synchronization metadata in D1 SQL (0 KV PUTs!)
 */
const updateSyncState = async (db: D1Database, userId: string, type: 'liked' | 'playlists', nowStr: string) => {
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS user_sync_state (
        user_id TEXT PRIMARY KEY,
        liked_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        playlists_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run()

    if (type === 'liked') {
      await db.prepare(
        `INSERT INTO user_sync_state (user_id, liked_updated_at, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET liked_updated_at = excluded.liked_updated_at, updated_at = excluded.updated_at`
      ).bind(userId, nowStr, nowStr).run()
    } else {
      await db.prepare(
        `INSERT INTO user_sync_state (user_id, playlists_updated_at, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET playlists_updated_at = excluded.playlists_updated_at, updated_at = excluded.updated_at`
      ).bind(userId, nowStr, nowStr).run()
    }
  } catch (e) {
    console.warn('Failed to update D1 user_sync_state:', e)
  }
}

/**
 * Helper to fetch server sync timestamp from D1 user_sync_state or table fallback
 */
const getSyncTimestamp = async (db: D1Database, userId: string, type: 'liked' | 'playlists'): Promise<string | null> => {
  try {
    const col = type === 'liked' ? 'liked_updated_at' : 'playlists_updated_at'
    const syncRow = await db.prepare(
      `SELECT ${col} as ts FROM user_sync_state WHERE user_id = ?`
    ).bind(userId).first() as any
    if (syncRow?.ts) return syncRow.ts
  } catch {}

  if (type === 'liked') {
    const maxRow = await db.prepare(
      'SELECT MAX(created_at) as latest FROM liked_songs WHERE user_id = ?'
    ).bind(userId).first() as any
    return maxRow?.latest || null
  } else {
    const maxRow = await db.prepare(
      'SELECT MAX(updated_at) as latest FROM playlists WHERE user_id = ?'
    ).bind(userId).first() as any
    return maxRow?.latest || null
  }
}

// ─── LIKED SONGS ─────────────────────────────────────────────────────────────

/**
 * GET /api/user/liked
 * Returns all liked songs for the logged-in user.
 */
userController.get('/liked', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const db = (c.env as any).DB as D1Database

  const rows = await db.prepare(
    'SELECT song_id, song_data, created_at FROM liked_songs WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all()

  return c.json({ success: true, data: rows.results || [] })
})

/**
 * Broadcast real-time user event to connected devices via Durable Object
 */
export const broadcastUserEvent = async (env: any, userId: string, event: { type: string; action: string; data?: any; updatedAt: string }) => {
  if (!env?.USER_SYNC_DO || !userId) return;
  try {
    const doId = env.USER_SYNC_DO.idFromName(userId);
    const stub = env.USER_SYNC_DO.get(doId);
    await stub.fetch('https://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({ ...event, userId, timestamp: new Date().toISOString() })
    });
  } catch (e) {
    console.warn('Durable Object broadcast failed:', e);
  }
};

/**
 * POST /api/user/liked
 * Body: { song }
 * Adds a song to liked songs.
 */
userController.post('/liked', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { song?: any }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { song } = body
  if (!song || !song.id) {
    return c.json({ success: false, message: 'Song object required' }, 400)
  }

  const db = (c.env as any).DB as D1Database
  const nowStr = new Date().toISOString()

  await db.prepare(
    `INSERT INTO liked_songs (user_id, song_id, song_data, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, song_id) DO UPDATE SET song_data = excluded.song_data`
  ).bind(userId, song.id, JSON.stringify(song), nowStr).run()

  // Track overall liked songs update time in D1 SQL (0 KV PUTs!)
  await updateSyncState(db, userId, 'liked', nowStr)

  // Broadcast real-time event to all connected devices AFTER D1 persistence succeeds
  c.executionCtx.waitUntil(
    broadcastUserEvent(c.env, userId, {
      type: 'liked',
      action: 'liked.created',
      data: { song },
      updatedAt: nowStr
    })
  );

  return c.json({ success: true, message: 'Song liked' })
})

/**
 * DELETE /api/user/liked/:songId
 * Removes a song from liked songs.
 */
userController.delete('/liked/:songId', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const songId = c.req.param('songId')
  const db = (c.env as any).DB as D1Database

  await db.prepare('DELETE FROM liked_songs WHERE user_id = ? AND song_id = ?').bind(userId, songId).run()

  const nowStr = new Date().toISOString();
  // Update D1 sync timestamp to track deletion (0 KV PUTs!)
  await updateSyncState(db, userId, 'liked', nowStr)

  // Broadcast real-time event AFTER D1 persistence succeeds
  c.executionCtx.waitUntil(
    broadcastUserEvent(c.env, userId, {
      type: 'liked',
      action: 'liked.deleted',
      data: { songId },
      updatedAt: nowStr
    })
  );

  return c.json({ success: true, message: 'Song unliked' })
})

/**
 * POST /api/user/liked/sync
 * Body: { songs: [...], localUpdatedAt: ISO string }
 * Smart sync using D1 SQL timestamps (0 KV operations!).
 */
userController.post('/liked/sync', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { songs?: any[]; localUpdatedAt?: string }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { songs: localSongs = [], localUpdatedAt } = body
  const db = (c.env as any).DB as D1Database

  const serverUpdatedAt = await getSyncTimestamp(db, userId, 'liked')

  const localTs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0
  const serverTs = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0

  const serverCountRow = await db.prepare(
    'SELECT COUNT(1) as count FROM liked_songs WHERE user_id = ?'
  ).bind(userId).first() as any
  const serverCount = serverCountRow?.count || 0

  if ((localTs > serverTs || serverCount === 0) && localSongs.length > 0) {
    const stmt = db.prepare(
      `INSERT INTO liked_songs (user_id, song_id, song_data, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, song_id) DO UPDATE SET song_data = excluded.song_data`
    )
    const batch = localSongs.map((song: any) =>
      stmt.bind(userId, song.id, JSON.stringify(song), localUpdatedAt || new Date().toISOString())
    )
    await db.batch(batch)

    const newTs = localUpdatedAt || new Date().toISOString()
    await updateSyncState(db, userId, 'liked', newTs)

    return c.json({ success: true, data: { source: 'local', songs: localSongs, serverUpdatedAt: newTs } })
  }

  const rows = await db.prepare(
    'SELECT song_data FROM liked_songs WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all()

  const serverSongs = (rows.results || []).map((r: any) => {
    try { return JSON.parse(r.song_data) } catch { return null }
  }).filter(Boolean)

  return c.json({ success: true, data: { source: 'server', songs: serverSongs, serverUpdatedAt } })
})

// ─── PLAYLISTS ────────────────────────────────────────────────────────────────

/**
 * GET /api/user/playlists
 * Returns all playlists for the logged-in user.
 */
userController.get('/playlists', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const db = (c.env as any).DB as D1Database

  const rows = await db.prepare(
    'SELECT id, name, songs, updated_at, created_at FROM playlists WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all()

  const playlists = (rows.results || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    songs: (() => { try { return JSON.parse(r.songs) } catch { return [] } })(),
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    type: 'custom'
  }))

  return c.json({ success: true, data: playlists })
})

/**
 * POST /api/user/playlists
 * Body: { name, songs: [...full metadata snapshots] }
 * Creates a new playlist.
 */
userController.post('/playlists', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { name?: string; songs?: any[]; id?: string }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { name, songs = [], id: clientId } = body
  if (!name?.trim()) return c.json({ success: false, message: 'Playlist name is required' }, 400)

  const id = clientId || generatePlaylistId()
  const now = new Date().toISOString()
  const db = (c.env as any).DB as D1Database

  await db.prepare(
    'INSERT INTO playlists (id, user_id, name, songs, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, name.trim(), JSON.stringify(songs), now, now).run()

  // Track overall playlists update time in D1 SQL (0 KV PUTs!)
  await updateSyncState(db, userId, 'playlists', now)

  const playlistData = { id, name: name.trim(), songs, updatedAt: now, createdAt: now, type: 'custom' };

  // Broadcast real-time event to all connected devices AFTER D1 persistence succeeds
  c.executionCtx.waitUntil(
    broadcastUserEvent(c.env, userId, {
      type: 'playlist',
      action: 'playlist.created',
      data: { playlist: playlistData },
      updatedAt: now
    })
  );

  return c.json({ success: true, data: playlistData }, 201)
})

/**
 * PUT /api/user/playlists/:id
 * Body: { name?, songs? }
 * Updates a playlist's name and/or songs.
 */
userController.put('/playlists/:id', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const playlistId = c.req.param('id')
  let body: { name?: string; songs?: any[] }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const db = (c.env as any).DB as D1Database
  const existing = await db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').bind(playlistId, userId).first()
  if (!existing) return c.json({ success: false, message: 'Playlist not found' }, 404)

  const nowStr = new Date().toISOString()
  const fields: string[] = []
  const values: any[] = []
  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name.trim()) }
  if (body.songs !== undefined) { fields.push('songs = ?'); values.push(JSON.stringify(body.songs)) }
  fields.push('updated_at = ?')
  values.push(nowStr, playlistId, userId)

  await db.prepare(`UPDATE playlists SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).bind(...values).run()

  // Update D1 sync timestamp (0 KV PUTs!)
  await updateSyncState(db, userId, 'playlists', nowStr)

  let actionType = 'playlist.updated';
  if (body.name !== undefined && body.songs === undefined) actionType = 'playlist.renamed';

  c.executionCtx.waitUntil(
    broadcastUserEvent(c.env, userId, {
      type: 'playlist',
      action: actionType,
      data: { playlistId, name: body.name?.trim(), songs: body.songs },
      updatedAt: nowStr
    })
  );

  return c.json({ success: true, message: 'Playlist updated' })
})

/**
 * DELETE /api/user/playlists/:id
 * Deletes a playlist.
 */
userController.delete('/playlists/:id', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const playlistId = c.req.param('id')
  const db = (c.env as any).DB as D1Database

  await db.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').bind(playlistId, userId).run()

  const nowStr = new Date().toISOString();
  // Update D1 sync timestamp (0 KV PUTs!)
  await updateSyncState(db, userId, 'playlists', nowStr)

  c.executionCtx.waitUntil(
    broadcastUserEvent(c.env, userId, {
      type: 'playlist',
      action: 'playlist.deleted',
      data: { playlistId },
      updatedAt: nowStr
    })
  );

  return c.json({ success: true, message: 'Playlist deleted' })
})

/**
 * POST /api/user/playlists/sync
 * Body: { playlists: [...], localUpdatedAt: ISO string }
 * Smart sync using D1 SQL timestamps (0 KV operations!).
 */
userController.post('/playlists/sync', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { playlists?: any[]; localUpdatedAt?: string }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { playlists: localPlaylists = [], localUpdatedAt } = body
  const db = (c.env as any).DB as D1Database

  const serverUpdatedAt = await getSyncTimestamp(db, userId, 'playlists')

  const serverTs = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0
  const localTs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0

  const serverCountRow = await db.prepare(
    'SELECT COUNT(1) as count FROM playlists WHERE user_id = ?'
  ).bind(userId).first() as any
  const serverCount = serverCountRow?.count || 0

  if (localTs >= serverTs || (serverCount === 0 && localPlaylists.length > 0)) {
    const nowTs = new Date().toISOString()
    const activeIds = localPlaylists.map((pl: any) => pl.id).filter(Boolean)

    if (localPlaylists.length > 0) {
      const stmt = db.prepare(
        `INSERT INTO playlists (id, user_id, name, songs, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, songs = excluded.songs, updated_at = excluded.updated_at`
      )
      const batch = localPlaylists.map((pl: any) =>
        stmt.bind(pl.id, userId, pl.name, JSON.stringify(pl.songs || []), localUpdatedAt || nowTs, pl.createdAt || localUpdatedAt || nowTs)
      )
      await db.batch(batch)
    }

    if (activeIds.length > 0) {
      const placeholders = activeIds.map(() => '?').join(',')
      await db.prepare(
        `DELETE FROM playlists WHERE user_id = ? AND id NOT IN (${placeholders})`
      ).bind(userId, ...activeIds).run()
    } else {
      await db.prepare('DELETE FROM playlists WHERE user_id = ?').bind(userId).run()
    }

    const newTs = localUpdatedAt || nowTs
    await updateSyncState(db, userId, 'playlists', newTs)

    return c.json({ success: true, data: { source: 'local', playlists: localPlaylists, serverUpdatedAt: newTs } })
  }

  const rows = await db.prepare(
    'SELECT id, name, songs, updated_at, created_at FROM playlists WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all()

  const serverPlaylists = (rows.results || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    songs: (() => { try { return JSON.parse(r.songs) } catch { return [] } })(),
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    type: 'custom'
  }))

  return c.json({ success: true, data: { source: 'server', playlists: serverPlaylists, serverUpdatedAt } })
})

/**
 * POST /api/user/activity
 * Body: { track, isPlaying, progress, device }
 * Keeps presence active via Durable Objects in-memory state & throttled D1 updates (0 KV PUTs!).
 */
userController.post('/activity', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { track?: any; isPlaying?: boolean; progress?: number; device?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const userAgent = c.req.header('User-Agent') || 'Unknown Device'
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-real-ip') || 'Unknown IP'
  const now = new Date().toISOString()
  const activityData = {
    track: body.track || null,
    isPlaying: body.isPlaying || false,
    progress: body.progress || 0,
    device: body.device || userAgent,
    ip,
    lastActive: now
  }

  const env = c.env as any
  const db = env?.DB as D1Database

  // 1. Send ephemeral presence to UserSyncDurableObject (0 KV PUTs!)
  if (env?.USER_SYNC_DO && userId) {
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const doId = env.USER_SYNC_DO.idFromName(userId);
          const stub = env.USER_SYNC_DO.get(doId);
          await stub.fetch('https://internal/activity', {
            method: 'POST',
            body: JSON.stringify(activityData)
          });
        } catch (e) {
          console.warn('DO activity report failed:', e);
        }
      })()
    );
  }

  // 2. Throttled D1 last_seen_at update in SQL database (0 KV PUTs!)
  if (db) {
    c.executionCtx.waitUntil(
      (async () => {
        try {
          await db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(now, userId).run()
        } catch {}
      })()
    );
  }

  return c.json({ success: true, message: 'Activity logged' })
})

userController.get('/broadcast', authMiddleware, async (c) => {
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  let broadcast = null
  if (kv) {
    const raw = await kv.get('global:broadcast')
    if (raw) {
      try { broadcast = JSON.parse(raw) } catch {}
    }
  }
  return c.json({ success: true, broadcast })
})

/**
 * GET /api/user/ws
 * WebSocket endpoint. Validates HMAC signed ticket (0 KV calls!). Routes socket to UserSyncDurableObject.
 */
userController.get('/ws', async (c) => {
  const ticket = c.req.query('ticket')
  if (!ticket) {
    return c.json({ success: false, message: 'Ticket parameter required' }, 401)
  }

  const env = c.env as any
  if (!env.USER_SYNC_DO) {
    return c.json({ success: false, message: 'Durable Object service unavailable' }, 503)
  }

  // Verify HMAC signed ticket cryptographically (0 KV GET/DELETE!)
  const ticketResult = await verifySignedTicket(ticket)
  if (!ticketResult.valid || !ticketResult.userId) {
    return c.json({ success: false, message: 'Invalid or expired WebSocket ticket' }, 401)
  }

  // Route to user's isolated Durable Object instance
  const doId = env.USER_SYNC_DO.idFromName(ticketResult.userId)
  const stub = env.USER_SYNC_DO.get(doId)
  return stub.fetch(c.req.raw)
})



