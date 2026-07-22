import { Hono } from 'hono'
import { authMiddleware } from './auth.middleware'
import { generatePlaylistId } from './crypto'

export const userController = new Hono<{
  Variables: {
    userId: string
    token: string
  }
}>()

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

  const songs = (rows.results || []).map((r: any) => {
    try { return JSON.parse(r.song_data) } catch { return null }
  }).filter(Boolean)

  return c.json({ success: true, data: songs })
})

/**
 * POST /api/user/liked
 * Body: { song } — full song metadata snapshot
 * Adds a song to liked songs. Idempotent (upsert).
 */
userController.post('/liked', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { song?: any }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { song } = body
  if (!song?.id) return c.json({ success: false, message: 'Song data with id is required' }, 400)

  const db = (c.env as any).DB as D1Database
  const nowStr = new Date().toISOString()
  await db.prepare(
    `INSERT INTO liked_songs (user_id, song_id, song_data, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, song_id) DO UPDATE SET song_data = excluded.song_data`
  ).bind(userId, song.id, JSON.stringify(song), nowStr).run()

  // Track overall liked songs update time in KV to prevent sync deletions
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    await kv.put(`user:${userId}:liked_updated_at`, nowStr)
  }

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

  // Update KV timestamp to track deletion
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    await kv.put(`user:${userId}:liked_updated_at`, new Date().toISOString())
  }

  return c.json({ success: true, message: 'Song unliked' })
})

/**
 * POST /api/user/liked/sync
 * Body: { songs: [...], localUpdatedAt: ISO string }
 * Smart sync: compares server vs local timestamps, returns merged result.
 * - If local is newer → upload local songs to server, return them
 * - If server is newer → return server songs
 * - If equal → no change needed
 */
userController.post('/liked/sync', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { songs?: any[]; localUpdatedAt?: string }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { songs: localSongs = [], localUpdatedAt } = body
  const db = (c.env as any).DB as D1Database
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace

  // Get overall update timestamp from KV to accurately track deletions
  let serverUpdatedAt = kv ? await kv.get(`user:${userId}:liked_updated_at`) : null
  const isKvMissing = !serverUpdatedAt
  if (isKvMissing) {
    const latestRow = await db.prepare(
      'SELECT MAX(created_at) as latest FROM liked_songs WHERE user_id = ?'
    ).bind(userId).first() as any
    serverUpdatedAt = latestRow?.latest || null
  }

  const localTs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0
  const serverTs = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0

  // Check if server is empty for this user (handles first-sync cold starts)
  const serverCountRow = await db.prepare(
    'SELECT COUNT(1) as count FROM liked_songs WHERE user_id = ?'
  ).bind(userId).first() as any
  const serverCount = serverCountRow?.count || 0

  if ((localTs > serverTs || serverCount === 0) && localSongs.length > 0) {
    // Local is newer — upload all local songs to server
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
    if (kv) {
      await kv.put(`user:${userId}:liked_updated_at`, newTs)
    }

    return c.json({ success: true, data: { source: 'local', songs: localSongs, serverUpdatedAt: newTs } })
  }

  // Server is newer or equal — return server data
  const rows = await db.prepare(
    'SELECT song_data FROM liked_songs WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all()

  const serverSongs = (rows.results || []).map((r: any) => {
    try { return JSON.parse(r.song_data) } catch { return null }
  }).filter(Boolean)

  // Initialize KV if missing
  if (serverUpdatedAt && kv && isKvMissing) {
    await kv.put(`user:${userId}:liked_updated_at`, serverUpdatedAt)
  }

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

  // Track overall playlists update time in KV to prevent sync deletions
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    await kv.put(`user:${userId}:playlists_updated_at`, now)
  }

  return c.json({ success: true, data: { id, name: name.trim(), songs, updatedAt: now, createdAt: now, type: 'custom' } }, 201)
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

  // Update KV timestamp
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    await kv.put(`user:${userId}:playlists_updated_at`, nowStr)
  }

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

  // Update KV timestamp to track deletion
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    await kv.put(`user:${userId}:playlists_updated_at`, new Date().toISOString())
  }

  return c.json({ success: true, message: 'Playlist deleted' })
})

/**
 * POST /api/user/playlists/sync
 * Body: { playlists: [...], localUpdatedAt: ISO string }
 * Smart sync: compares timestamps, uploads local if newer, downloads server if newer.
 */
userController.post('/playlists/sync', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { playlists?: any[]; localUpdatedAt?: string }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { playlists: localPlaylists = [], localUpdatedAt } = body
  const db = (c.env as any).DB as D1Database
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace

  // Get overall update timestamp from KV to accurately track deletions
  let serverUpdatedAt = kv ? await kv.get(`user:${userId}:playlists_updated_at`) : null
  const isKvMissing = !serverUpdatedAt
  if (isKvMissing) {
    const latestRow = await db.prepare(
      'SELECT MAX(updated_at) as latest FROM playlists WHERE user_id = ?'
    ).bind(userId).first() as any
    serverUpdatedAt = latestRow?.latest || null
  }

  const serverTs = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0
  const localTs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0

  // Check if server is empty for this user (handles first-sync cold starts)
  const serverCountRow = await db.prepare(
    'SELECT COUNT(1) as count FROM playlists WHERE user_id = ?'
  ).bind(userId).first() as any
  const serverCount = serverCountRow?.count || 0

  if ((localTs > serverTs || serverCount === 0) && localPlaylists.length > 0) {
    // Local is newer — upsert all local playlists to server
    const stmt = db.prepare(
      `INSERT INTO playlists (id, user_id, name, songs, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, songs = excluded.songs, updated_at = excluded.updated_at`
    )
    const batch = localPlaylists.map((pl: any) =>
      stmt.bind(pl.id, userId, pl.name, JSON.stringify(pl.songs || []), localUpdatedAt || new Date().toISOString(), pl.createdAt || localUpdatedAt || new Date().toISOString())
    )
    await db.batch(batch)

    const newTs = localUpdatedAt || new Date().toISOString()
    if (kv) {
      await kv.put(`user:${userId}:playlists_updated_at`, newTs)
    }

    return c.json({ success: true, data: { source: 'local', playlists: localPlaylists, serverUpdatedAt: newTs } })
  }

  // Server is newer or equal — return server playlists
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

  // Initialize KV if missing
  if (serverUpdatedAt && kv && isKvMissing) {
    await kv.put(`user:${userId}:playlists_updated_at`, serverUpdatedAt)
  }

  return c.json({ success: true, data: { source: 'server', playlists: serverPlaylists, serverUpdatedAt } })
})

/**
 * POST /api/user/activity
 * Body: { track, isPlaying, progress, device }
 * Keeps the session alive and logs the user's active media state.
 */
userController.post('/activity', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { track?: any; isPlaying?: boolean; progress?: number; device?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
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
    // Set TTL to 90 seconds (so if ping fails twice they go offline)
    await kv.put(`user:${userId}:activity`, JSON.stringify(activityData), { expirationTtl: 90 })
    await kv.put(`user:${userId}:last_seen`, now)
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


