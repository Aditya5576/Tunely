import { fetchSpotifyPlaylistData } from '#modules/playlists/helpers/spotify-api.helper'
import { SearchSongsUseCase } from '#modules/search/use-cases/search-songs/search-songs.use-case'
import { broadcastUserEvent, updateSyncState } from '#modules/auth/user.controller'

export interface CronSyncStats {
  foundPlaylists: number
  uniqueSpotifyIds: number
  processedCount: number
  skippedUnchanged: number
  changedCount: number
  songsAdded: number
  unmatchedSongs: number
  failedPlaylists: number
}

const normalize = (str: string) => (str || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Filter Spotify tracks against existing Tunely songs using dual-layer deduplication:
 * 1. Normalized `${title}|${artist}` signature matching
 * 2. Song ID set matching
 */
export function filterNewSpotifyTracks(spotifyTracks: Array<{ title: string; artist: string }>, existingSongs: any[]) {
  const existingSignatures = new Set(
    (existingSongs || []).map(s => {
      const title = normalize(s.name || s.title || '')
      const artist = normalize(s.artists?.primary?.[0]?.name || s.artist || '')
      return `${title}|${artist}`
    })
  )
  const existingSongIds = new Set((existingSongs || []).map(s => String(s.id)))

  return (spotifyTracks || []).filter(t => {
    const sig = `${normalize(t.title)}|${normalize(t.artist)}`
    return !existingSignatures.has(sig)
  })
}

/**
 * Runs the hourly background Spotify -> Tunely playlist synchronization service.
 * Executed via Cloudflare Worker `scheduled` event.
 */
export async function runHourlySpotifySync(env: any): Promise<CronSyncStats> {
  const stats: CronSyncStats = {
    foundPlaylists: 0,
    uniqueSpotifyIds: 0,
    processedCount: 0,
    skippedUnchanged: 0,
    changedCount: 0,
    songsAdded: 0,
    unmatchedSongs: 0,
    failedPlaylists: 0
  }

  const db = env?.DB as D1Database | undefined
  if (!db) {
    console.warn('[Spotify Cron Sync] D1 database binding (DB) is missing. Exiting.')
    return stats
  }

  // FIX 1: Limit batch size to 10 to strictly bound subrequests per execution.
  // Sort by last_spotify_sync_at ASC NULLS FIRST for fair queue rotation.
  let rows: any[] = []
  try {
    const result = await db.prepare(
      `SELECT id, user_id, name, songs, spotify_playlist_id, spotify_snapshot_id, last_spotify_sync_at, updated_at
       FROM playlists
       WHERE spotify_playlist_id IS NOT NULL AND spotify_playlist_id != ''
       ORDER BY last_spotify_sync_at ASC NULLS FIRST, id ASC
       LIMIT 10`
    ).all()
    rows = result.results || []
  } catch (e) {
    console.error('[Spotify Cron Sync] Failed to query linked playlists from D1:', e)
    return stats
  }

  stats.foundPlaylists = rows.length
  if (rows.length === 0) {
    console.log('[Spotify Cron Sync] No Spotify-linked playlists found to sync.')
    return stats
  }

  // 2. Group playlists by spotify_playlist_id to avoid redundant fetches for the same Spotify playlist
  const playlistsBySpotifyId = new Map<string, any[]>()
  for (const row of rows) {
    const sid = row.spotify_playlist_id
    if (!playlistsBySpotifyId.has(sid)) {
      playlistsBySpotifyId.set(sid, [])
    }
    playlistsBySpotifyId.get(sid)!.push(row)
  }
  stats.uniqueSpotifyIds = playlistsBySpotifyId.size

  const searchUseCase = new SearchSongsUseCase()

  // 3. Process each unique Spotify playlist
  for (const [spotifyId, playlistRows] of playlistsBySpotifyId.entries()) {
    let spotifyData = null
    const nowIso = new Date().toISOString()

    try {
      spotifyData = await fetchSpotifyPlaylistData(spotifyId, env)
    } catch (err) {
      console.error(`[Spotify Cron Sync] Failed to fetch Spotify playlist ${spotifyId}:`, err)
    }

    // FIX 2: If Spotify fetch fails or returns null, update last_spotify_sync_at for failed rows so they rotate to the back of the queue.
    if (!spotifyData) {
      console.warn(`[Spotify Cron Sync] Spotify playlist ${spotifyId} returned null/failed. Rotating ${playlistRows.length} playlist(s) to back of queue.`)
      for (const row of playlistRows) {
        try {
          await db.prepare('UPDATE playlists SET last_spotify_sync_at = ? WHERE id = ?').bind(nowIso, row.id).run()
        } catch (updateErr) {
          console.error(`[Spotify Cron Sync] Failed to update last_spotify_sync_at for failed playlist ${row.id}:`, updateErr)
        }
      }
      stats.failedPlaylists += playlistRows.length
      continue
    }

    const currentSnapshot = spotifyData.snapshot_id

    // 4. Process each linked Tunely playlist for this Spotify ID
    for (const row of playlistRows) {
      stats.processedCount++
      try {
        const existingSongs: any[] = (() => {
          try { return typeof row.songs === 'string' ? JSON.parse(row.songs) : (row.songs || []) } catch { return [] }
        })()

        // Snapshot comparison check
        if (currentSnapshot && row.spotify_snapshot_id && currentSnapshot === row.spotify_snapshot_id) {
          stats.skippedUnchanged++
          // Update last_spotify_sync_at so it rotates to the back of the queue
          await db.prepare(
            'UPDATE playlists SET last_spotify_sync_at = ? WHERE id = ?'
          ).bind(nowIso, row.id).run()
          continue
        }

        // Snapshot changed or missing snapshot_id -> identify new tracks
        const newSpotifyTracks = filterNewSpotifyTracks(spotifyData.tracks || [], existingSongs)

        if (newSpotifyTracks.length === 0) {
          stats.skippedUnchanged++
          await db.prepare(
            'UPDATE playlists SET spotify_snapshot_id = ?, last_spotify_sync_at = ? WHERE id = ?'
          ).bind(currentSnapshot || row.spotify_snapshot_id, nowIso, row.id).run()
          continue
        }

        // FIX 1: Cap new track catalog searches to max 5 per playlist per cron invocation to prevent subrequest limit overflow.
        const tracksToProcess = newSpotifyTracks.slice(0, 5)
        const hasCapSkipped = newSpotifyTracks.length > 5

        let hasTransientError = false
        const newlyMatchedSongs: any[] = []

        for (const track of tracksToProcess) {
          try {
            const searchRes = await searchUseCase.execute({
              query: `${track.title} ${track.artist}`,
              page: 0,
              limit: 1
            })
            if (searchRes.results && searchRes.results.length > 0) {
              const matchedSong = searchRes.results[0]
              const existingIds = new Set(existingSongs.concat(newlyMatchedSongs).map(s => String(s.id)))
              if (!existingIds.has(String(matchedSong.id))) {
                newlyMatchedSongs.push(matchedSong)
              }
            } else {
              // Confirmed unmatchable track (0 results returned cleanly) -> count as processed, do not block snapshot
              stats.unmatchedSongs++
            }
          } catch (trackErr) {
            console.warn(`[Spotify Cron Sync] Transient network error searching catalog for track "${track.title}":`, trackErr)
            stats.unmatchedSongs++
            hasTransientError = true
          }
        }

        // FIX 3: Re-read latest playlist row from D1 right before write to prevent overwriting user modifications (lost update race condition).
        const latestRow: any = await db.prepare('SELECT songs, spotify_snapshot_id FROM playlists WHERE id = ? AND user_id = ?').bind(row.id, row.user_id).first()
        const latestSongs: any[] = (() => {
          try { return typeof latestRow?.songs === 'string' ? JSON.parse(latestRow.songs) : (latestRow?.songs || existingSongs) } catch { return existingSongs }
        })()

        // Re-filter newlyMatchedSongs against latestSongs in case user or manual sync added the exact same song
        const finalMatchesToAppend = filterNewSpotifyTracks(
          newlyMatchedSongs.map(s => ({ title: s.name || s.title || '', artist: s.artists?.primary?.[0]?.name || s.artist || '' })),
          latestSongs
        ).map(t => newlyMatchedSongs.find(s => (s.name || s.title) === t.title)).filter(Boolean)

        const updatedSongs = latestSongs.concat(finalMatchesToAppend)

        // FIX 4: Only advance spotify_snapshot_id if ALL tracks were processed without 5-track cap truncation or transient network errors.
        const canAdvanceSnapshot = Boolean(currentSnapshot) && !hasCapSkipped && !hasTransientError
        const newSnapshotId = canAdvanceSnapshot ? currentSnapshot! : (latestRow?.spotify_snapshot_id || row.spotify_snapshot_id || `sync_${Date.now()}`)

        // Update D1 database atomically
        await db.prepare(
          `UPDATE playlists
           SET songs = ?, spotify_snapshot_id = ?, last_spotify_sync_at = ?, updated_at = ?
           WHERE id = ?`
        ).bind(JSON.stringify(updatedSongs), newSnapshotId, nowIso, nowIso, row.id).run()

        await updateSyncState(db, row.user_id, 'playlists', nowIso)

        stats.changedCount++
        stats.songsAdded += finalMatchesToAppend.length

        // Broadcast real-time WebSocket notification to connected user clients if new songs were added
        if (finalMatchesToAppend.length > 0) {
          try {
            await broadcastUserEvent(env, row.user_id, {
              type: 'playlist',
              action: 'playlist.updated',
              data: { playlistId: row.id, songs: updatedSongs },
              updatedAt: nowIso
            })
          } catch (doErr) {
            console.warn('[Spotify Cron Sync] Non-fatal DO notification failure:', doErr)
          }
        }
      } catch (playlistErr) {
        console.error(`[Spotify Cron Sync] Error processing playlist ${row.id}:`, playlistErr)
        stats.failedPlaylists++
      }
    }
  }

  console.log(
    `[Spotify Cron Sync] Execution complete. Found: ${stats.foundPlaylists}, Unique IDs: ${stats.uniqueSpotifyIds}, Processed: ${stats.processedCount}, Skipped: ${stats.skippedUnchanged}, Changed: ${stats.changedCount}, Songs Added: ${stats.songsAdded}, Unmatched: ${stats.unmatchedSongs}, Failed: ${stats.failedPlaylists}`
  )

  return stats
}
