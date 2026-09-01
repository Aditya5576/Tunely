import { Hono } from 'hono'
import { authMiddleware } from './auth.middleware'
import { generatePlaylistId, verifySignedTicket } from './crypto'
import { fetchSpotifyPlaylistData } from '#modules/playlists/helpers/spotify-api.helper'
import { findBestCandidateMatch } from '#modules/playlists/helpers/spotify-matcher.helper'

export const userController = new Hono<{
  Variables: {
    userId: string
    token: string
  }
}>()

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000 // 5 minutes
const lastSeenWriteCache = new Map<string, number>()

/**
 * Helper to maintain user synchronization metadata in D1 SQL (0 KV PUTs!)
 */
export const updateSyncState = async (db: D1Database, userId: string, type: 'liked' | 'playlists', nowStr: string) => {
  try {
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
    'SELECT id, name, songs, spotify_playlist_id, spotify_snapshot_id, last_spotify_sync_at, updated_at, created_at FROM playlists WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all()

  const playlists = (rows.results || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    songs: (() => { try { return JSON.parse(r.songs) } catch { return [] } })(),
    spotify_playlist_id: r.spotify_playlist_id || undefined,
    spotify_snapshot_id: r.spotify_snapshot_id || undefined,
    last_spotify_sync_at: r.last_spotify_sync_at || undefined,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    type: 'custom'
  }))

  return c.json({ success: true, data: playlists })
})

/**
 * POST /api/user/playlists
 * Body: { name, songs: [...full metadata snapshots], spotify_playlist_id?, spotify_snapshot_id? }
 * Creates a new playlist.
 */
userController.post('/playlists', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  let body: { name?: string; songs?: any[]; id?: string; spotify_playlist_id?: string; spotify_snapshot_id?: string; last_spotify_sync_at?: string }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { name, songs = [], id: clientId, spotify_playlist_id, spotify_snapshot_id, last_spotify_sync_at } = body
  if (!name?.trim()) return c.json({ success: false, message: 'Playlist name is required' }, 400)

  const id = clientId || generatePlaylistId()
  const now = new Date().toISOString()
  const db = (c.env as any).DB as D1Database

  await db.prepare(
    'INSERT INTO playlists (id, user_id, name, songs, spotify_playlist_id, spotify_snapshot_id, last_spotify_sync_at, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, name.trim(), JSON.stringify(songs), spotify_playlist_id || null, spotify_snapshot_id || null, last_spotify_sync_at || null, now, now).run()

  // Track overall playlists update time in D1 SQL (0 KV PUTs!)
  await updateSyncState(db, userId, 'playlists', now)

  const playlistData = {
    id,
    name: name.trim(),
    songs,
    spotify_playlist_id: spotify_playlist_id || undefined,
    spotify_snapshot_id: spotify_snapshot_id || undefined,
    last_spotify_sync_at: last_spotify_sync_at || undefined,
    updatedAt: now,
    createdAt: now,
    type: 'custom'
  };

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
 * Body: { name?, songs?, spotify_playlist_id?, spotify_snapshot_id?, last_spotify_sync_at? }
 * Updates a playlist's name and/or songs.
 */
userController.put('/playlists/:id', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const playlistId = c.req.param('id')
  let body: { name?: string; songs?: any[]; spotify_playlist_id?: string; spotify_snapshot_id?: string; last_spotify_sync_at?: string }
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
  if (body.spotify_playlist_id !== undefined) { fields.push('spotify_playlist_id = ?'); values.push(body.spotify_playlist_id) }
  if (body.spotify_snapshot_id !== undefined) { fields.push('spotify_snapshot_id = ?'); values.push(body.spotify_snapshot_id) }
  if (body.last_spotify_sync_at !== undefined) { fields.push('last_spotify_sync_at = ?'); values.push(body.last_spotify_sync_at) }
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
        `INSERT INTO playlists (id, user_id, name, songs, spotify_playlist_id, spotify_snapshot_id, last_spotify_sync_at, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           songs = excluded.songs,
           spotify_playlist_id = COALESCE(excluded.spotify_playlist_id, playlists.spotify_playlist_id),
           spotify_snapshot_id = COALESCE(excluded.spotify_snapshot_id, playlists.spotify_snapshot_id),
           last_spotify_sync_at = COALESCE(excluded.last_spotify_sync_at, playlists.last_spotify_sync_at),
           updated_at = excluded.updated_at`
      )
      const batch = localPlaylists.map((pl: any) =>
        stmt.bind(
          pl.id,
          userId,
          pl.name,
          JSON.stringify(pl.songs || []),
          pl.spotify_playlist_id || pl.spotifyPlaylistId || null,
          pl.spotify_snapshot_id || pl.spotifySnapshotId || null,
          pl.last_spotify_sync_at || pl.lastSpotifySyncAt || null,
          localUpdatedAt || nowTs,
          pl.createdAt || localUpdatedAt || nowTs
        )
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
    'SELECT id, name, songs, spotify_playlist_id, spotify_snapshot_id, last_spotify_sync_at, updated_at, created_at FROM playlists WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all()

  const serverPlaylists = (rows.results || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    songs: (() => { try { return JSON.parse(r.songs) } catch { return [] } })(),
    spotify_playlist_id: r.spotify_playlist_id || undefined,
    spotify_snapshot_id: r.spotify_snapshot_id || undefined,
    last_spotify_sync_at: r.last_spotify_sync_at || undefined,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    type: 'custom'
  }))

  return c.json({ success: true, data: { source: 'server', playlists: serverPlaylists, serverUpdatedAt } })
})

/**
 * POST /api/user/playlists/:id/sync-spotify
 * Manual Spotify playlist sync for linked playlists.
 */
userController.post('/playlists/:id/sync-spotify', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const playlistId = c.req.param('id')
  const db = (c.env as any).DB as D1Database

  const row: any = await db.prepare(
    'SELECT id, name, songs, spotify_playlist_id, spotify_snapshot_id, last_spotify_sync_at, updated_at, created_at FROM playlists WHERE id = ? AND user_id = ?'
  ).bind(playlistId, userId).first()

  if (!row) {
    return c.json({ success: false, message: 'Playlist not found' }, 404)
  }

  const spotifyPlaylistId = row.spotify_playlist_id
  if (!spotifyPlaylistId) {
    return c.json({ success: false, message: 'This playlist is not linked to a Spotify playlist' }, 400)
  }

  const currentSpotifyData = await fetchSpotifyPlaylistData(spotifyPlaylistId, c.env)
  if (!currentSpotifyData) {
    return c.json({ success: false, message: 'Failed to fetch Spotify playlist. Make sure the Spotify playlist is public.' }, 502)
  }

  const existingSongs: any[] = (() => { try { return JSON.parse(row.songs) } catch { return [] } })()

  // 1. Check if snapshot_id matches
  if (currentSpotifyData.snapshot_id && row.spotify_snapshot_id && currentSpotifyData.snapshot_id === row.spotify_snapshot_id) {
    const playlistData = {
      id: row.id,
      name: row.name,
      songs: existingSongs,
      spotify_playlist_id: spotifyPlaylistId,
      spotify_snapshot_id: row.spotify_snapshot_id,
      last_spotify_sync_at: row.last_spotify_sync_at || new Date().toISOString(),
      updatedAt: row.updated_at,
      createdAt: row.created_at,
      type: 'custom'
    }
    return c.json({
      success: true,
      changed: false,
      added: 0,
      skipped: 0,
      unmatched: 0,
      status: 'up_to_date',
      message: 'Playlist is already up to date',
      playlist: playlistData
    })
  }

  // 2. Build normalized title + artist lookup set from existing Tunely songs
  const normalize = (str: string) => (str || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
  const existingSignatures = new Set(
    existingSongs.map(s => {
      const title = normalize(s.name || s.title || '')
      const artist = normalize(s.artists?.primary?.[0]?.name || s.artist || '')
      return `${title}|${artist}`
    })
  )
  const existingSongIds = new Set(existingSongs.map(s => String(s.id)))

  // 3. Identify new tracks from Spotify that are missing from Tunely playlist
  const newSpotifyTracks = currentSpotifyData.tracks.filter(t => {
    const sig = `${normalize(t.title)}|${normalize(t.artist)}`
    return !existingSignatures.has(sig)
  })

  if (newSpotifyTracks.length === 0) {
    const nowStr = new Date().toISOString()
    const newSnapshotId = currentSpotifyData.snapshot_id || row.spotify_snapshot_id
    await db.prepare(
      'UPDATE playlists SET spotify_snapshot_id = ?, last_spotify_sync_at = ? WHERE id = ? AND user_id = ?'
    ).bind(newSnapshotId, nowStr, playlistId, userId).run()

    const playlistData = {
      id: row.id,
      name: row.name,
      songs: existingSongs,
      spotify_playlist_id: spotifyPlaylistId,
      spotify_snapshot_id: newSnapshotId,
      last_spotify_sync_at: nowStr,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
      type: 'custom'
    }
    return c.json({
      success: true,
      changed: false,
      added: 0,
      skipped: 0,
      unmatched: 0,
      status: 'up_to_date',
      message: 'Playlist is already up to date',
      playlist: playlistData
    })
  }

  // 4. Resolve new Spotify tracks on Tunely via search
  const matchedSongs: any[] = []
  let unmatchedCount = 0

  const apiBase = (c.env as any)?.VITE_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev'

  for (const track of newSpotifyTracks) {
    try {
      const query = `${track.title} ${track.artist}`.trim()
      const searchRes = await fetch(`${apiBase}/api/search/songs?query=${encodeURIComponent(query)}&limit=10`)
      if (searchRes.ok) {
        const obj: any = await searchRes.json()
        const results = obj.data?.results || []
        const matchResult = findBestCandidateMatch(track, results)
        if (matchResult.match) {
          const song = {
            ...matchResult.match,
            spotify_track_id: track.id || undefined
          }
          if (!existingSongIds.has(String(song.id))) {
            matchedSongs.push(song)
            existingSongIds.add(String(song.id))
          } else {
            unmatchedCount++
          }
          continue
        }
      }
    } catch {}
    unmatchedCount++
  }

  const updatedSongs = [...existingSongs, ...matchedSongs]
  const nowStr = new Date().toISOString()
  const newSnapshotId = currentSpotifyData.snapshot_id || row.spotify_snapshot_id || `sync_${Date.now()}`

  await db.prepare(
    'UPDATE playlists SET songs = ?, spotify_snapshot_id = ?, last_spotify_sync_at = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind(JSON.stringify(updatedSongs), newSnapshotId, nowStr, nowStr, playlistId, userId).run()

  await updateSyncState(db, userId, 'playlists', nowStr)

  const updatedPlaylist = {
    id: row.id,
    name: row.name,
    songs: updatedSongs,
    spotify_playlist_id: spotifyPlaylistId,
    spotify_snapshot_id: newSnapshotId,
    last_spotify_sync_at: nowStr,
    updatedAt: nowStr,
    createdAt: row.created_at,
    type: 'custom'
  }

  c.executionCtx.waitUntil(
    broadcastUserEvent(c.env, userId, {
      type: 'playlist',
      action: 'playlist.updated',
      data: { playlistId, name: row.name, songs: updatedSongs },
      updatedAt: nowStr
    })
  )

  return c.json({
    success: true,
    changed: matchedSongs.length > 0,
    added: matchedSongs.length,
    skipped: 0,
    unmatched: unmatchedCount,
    status: matchedSongs.length > 0 ? 'updated' : 'up_to_date',
    playlist: updatedPlaylist
  })
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

  // 2. Throttled D1 last_seen_at update in SQL database (max once per 5 minutes per user!)
  const nowMs = Date.now()
  const lastWrite = lastSeenWriteCache.get(userId) || 0
  if (db && (nowMs - lastWrite > LAST_SEEN_THROTTLE_MS)) {
    lastSeenWriteCache.set(userId, nowMs)
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

// ─── RECENTLY PLAYED ─────────────────────────────────────────────────────────

/**
 * GET /api/user/recently-played
 * Returns up to 12 most recent listening history tracks for the logged-in user.
 */
userController.get('/recently-played', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const db = (c.env as any).DB as D1Database

  if (!db) {
    return c.json({ success: false, message: 'Database service unavailable' }, 503)
  }

  const rows = await db.prepare(
    'SELECT song_id, song_data, played_at FROM recently_played WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT 12'
  ).bind(userId).all()

  const songs = (rows.results || []).map((row: any) => {
    try {
      return typeof row.song_data === 'string' ? JSON.parse(row.song_data) : row.song_data
    } catch {
      return { id: row.song_id }
    }
  })

  return c.json({ success: true, data: songs })
})

/**
 * POST /api/user/recently-played
 * Body: { song: { id: string, ... } }
 * Records a recently played track for the logged-in user atomically. Replaces older entries for the same track and caps history at 20 items.
 */
userController.post('/recently-played', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const db = (c.env as any).DB as D1Database

  if (!db) {
    return c.json({ success: false, message: 'Database service unavailable' }, 503)
  }

  const body = await c.req.json().catch(() => null)
  if (!body || !body.song || typeof body.song !== 'object' || !body.song.id || typeof body.song.id !== 'string') {
    return c.json({ success: false, message: 'Valid song object with id is required' }, 400)
  }

  const songId = body.song.id.trim()
  if (!songId) {
    return c.json({ success: false, message: 'Valid song id is required' }, 400)
  }

  const songDataStr = JSON.stringify(body.song)
  const nowStr = new Date().toISOString()

  // Atomic D1 Batch Transaction: 1. Deduplicate -> 2. Insert new record -> 3. Retention cleanup (Max 20 per user)
  await db.batch([
    db.prepare(
      'DELETE FROM recently_played WHERE user_id = ? AND song_id = ?'
    ).bind(userId, songId),
    db.prepare(
      'INSERT INTO recently_played (user_id, song_id, song_data, played_at) VALUES (?, ?, ?, ?)'
    ).bind(userId, songId, songDataStr, nowStr),
    db.prepare(
      `DELETE FROM recently_played
       WHERE user_id = ?
       AND id NOT IN (
         SELECT id FROM recently_played WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT 20
       )`
    ).bind(userId, userId)
  ])

  return c.json({ success: true, message: 'Recently played logged' })
})

let cachedBroadcastData: { data: any; timestamp: number } | null = null
const BROADCAST_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes strict memory TTL for isolate KV operations

userController.get('/broadcast', authMiddleware, async (c) => {
  const now = Date.now()
  if (cachedBroadcastData && (now - cachedBroadcastData.timestamp < BROADCAST_CACHE_TTL_MS)) {
    return c.json({ success: true, broadcast: cachedBroadcastData.data })
  }

  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  let broadcast = null
  if (kv) {
    try {
      const raw = await kv.get('global:broadcast')
      if (raw) {
        try { broadcast = JSON.parse(raw) } catch {}
      }
    } catch (e) {
      console.warn('Failed to read global broadcast from KV:', e)
    }
  }

  cachedBroadcastData = { data: broadcast, timestamp: now }
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
  const ticketResult = await verifySignedTicket(ticket, env)
  if (!ticketResult.valid || !ticketResult.userId) {
    return c.json({ success: false, message: 'Invalid or expired WebSocket ticket' }, 401)
  }

  // Route to user's isolated Durable Object instance
  const doId = env.USER_SYNC_DO.idFromName(ticketResult.userId)
  const stub = env.USER_SYNC_DO.get(doId)
  return stub.fetch(c.req.raw)
})



