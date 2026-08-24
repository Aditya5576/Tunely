import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runHourlySpotifySync, filterNewSpotifyTracks } from './spotify-sync-cron.service'

// Mock spotify-api.helper
vi.mock('#modules/playlists/helpers/spotify-api.helper', () => ({
  fetchSpotifyPlaylistData: vi.fn()
}))

// Mock SearchSongsUseCase
vi.mock('#modules/search/use-cases/search-songs/search-songs.use-case', () => {
  return {
    SearchSongsUseCase: vi.fn().mockImplementation(() => ({
      execute: vi.fn().mockImplementation(async ({ query }: { query: string }) => {
        if (query.includes('UnmatchedTrack')) {
          return { total: 0, start: 0, results: [] }
        }
        return {
          total: 1,
          start: 0,
          results: [
            {
              id: `song_${query.replace(/\s+/g, '_')}`,
              name: query.split(' ')[0],
              artists: { primary: [{ name: query.split(' ').slice(1).join(' ') || 'Artist' }] }
            }
          ]
        }
      })
    }))
  }
})

// Mock broadcastUserEvent and updateSyncState
vi.mock('#modules/auth/user.controller', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    broadcastUserEvent: vi.fn().mockResolvedValue(undefined),
    updateSyncState: vi.fn().mockResolvedValue(undefined)
  }
})

import { fetchSpotifyPlaylistData } from '#modules/playlists/helpers/spotify-api.helper'

describe('Spotify Sync Cron — 10 New Track Multi-Run Sequential Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Verifies RUN 1, RUN 2, and RUN 3 state transitions for 10 new tracks with 5-track per-run cap', async () => {
    // 10 new tracks on Spotify
    const tracks10 = Array.from({ length: 10 }, (_, i) => ({ title: `Track${i+1}`, artist: `Artist${i+1}` }))

    let dbSongs = '[]'
    let dbSnapshot = 'snap_old'
    let dbLastSyncAt = ''

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockImplementation(async () => ({
          results: [
            { id: 'p1', user_id: 'u1', spotify_playlist_id: 'spot_10', spotify_snapshot_id: dbSnapshot, songs: dbSongs, last_spotify_sync_at: dbLastSyncAt }
          ]
        })),
        bind: vi.fn().mockImplementation((...args: any[]) => {
          if (typeof args[0] === 'string' && args[0].startsWith('[')) {
            dbSongs = args[0]
            dbSnapshot = args[1]
            dbLastSyncAt = args[2]
          }
          return {
            run: vi.fn().mockResolvedValue({}),
            first: vi.fn().mockImplementation(async () => ({
              songs: dbSongs,
              spotify_snapshot_id: dbSnapshot,
              last_spotify_sync_at: dbLastSyncAt
            }))
          }
        })
      })
    }

    vi.mocked(fetchSpotifyPlaylistData).mockResolvedValue({
      name: '10 Track Playlist',
      spotify_playlist_id: 'spot_10',
      snapshot_id: 'snap_new_10',
      tracks: tracks10
    })

    // --- RUN 1 ---
    const stats1 = await runHourlySpotifySync({ DB: mockDb })
    const songsAfterRun1 = JSON.parse(dbSongs)

    expect(stats1.songsAdded).toBe(5)
    expect(songsAfterRun1).toHaveLength(5)
    // Snapshot MUST NOT advance because cap was reached (5 processed, 5 remaining)
    expect(dbSnapshot).toBe('snap_old')

    // --- RUN 2 ---
    const stats2 = await runHourlySpotifySync({ DB: mockDb })
    const songsAfterRun2 = JSON.parse(dbSongs)

    expect(stats2.songsAdded).toBe(5)
    expect(songsAfterRun2).toHaveLength(10)
    // Snapshot SHOULD NOW ADVANCE to snap_new_10 because all 10 tracks have been processed!
    expect(dbSnapshot).toBe('snap_new_10')

    // --- RUN 3 ---
    const stats3 = await runHourlySpotifySync({ DB: mockDb })

    // Snapshot matches (snap_new_10 === snap_new_10) -> SKIPPED UNCHANGED
    expect(stats3.skippedUnchanged).toBe(1)
    expect(stats3.songsAdded).toBe(0)
    expect(stats3.changedCount).toBe(0)
    expect(JSON.parse(dbSongs)).toHaveLength(10)
  })

  it('Verifies 10 tracks (2 permanently unmatched, 8 matched) eventually advance snapshot and are not retried forever', async () => {
    // 8 valid tracks + 2 unmatched tracks
    const tracks10Mixed = [
      ...Array.from({ length: 8 }, (_, i) => ({ title: `Valid${i+1}`, artist: `Artist${i+1}` })),
      { title: 'UnmatchedTrack1', artist: 'Artist' },
      { title: 'UnmatchedTrack2', artist: 'Artist' }
    ]

    let dbSongs = '[]'
    let dbSnapshot = 'snap_old'

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockImplementation(async () => ({
          results: [
            { id: 'p1', user_id: 'u1', spotify_playlist_id: 'spot_mixed_10', spotify_snapshot_id: dbSnapshot, songs: dbSongs }
          ]
        })),
        bind: vi.fn().mockImplementation((...args: any[]) => {
          if (typeof args[0] === 'string' && args[0].startsWith('[')) {
            dbSongs = args[0]
            dbSnapshot = args[1]
          }
          return {
            run: vi.fn().mockResolvedValue({}),
            first: vi.fn().mockImplementation(async () => ({
              songs: dbSongs,
              spotify_snapshot_id: dbSnapshot
            }))
          }
        })
      })
    }

    vi.mocked(fetchSpotifyPlaylistData).mockResolvedValue({
      name: 'Mixed 10 Track Playlist',
      spotify_playlist_id: 'spot_mixed_10',
      snapshot_id: 'snap_mixed_10',
      tracks: tracks10Mixed
    })

    // RUN 1: Processes first 5 valid tracks
    const stats1 = await runHourlySpotifySync({ DB: mockDb })
    expect(stats1.songsAdded).toBe(5)
    expect(dbSnapshot).toBe('snap_old')

    // RUN 2: Processes remaining 3 valid + 2 unmatched tracks (5 tracks)
    const stats2 = await runHourlySpotifySync({ DB: mockDb })
    expect(stats2.songsAdded).toBe(3)
    expect(stats2.unmatchedSongs).toBe(2)
    // Snapshot SHOULD ADVANCE to snap_mixed_10 because 2 unmatched returned 0 results cleanly (processed)
    expect(dbSnapshot).toBe('snap_mixed_10')

    // RUN 3: Unchanged snapshot check -> 0 additions, 0 retries!
    const stats3 = await runHourlySpotifySync({ DB: mockDb })
    expect(stats3.skippedUnchanged).toBe(1)
    expect(stats3.songsAdded).toBe(0)
    expect(stats3.unmatchedSongs).toBe(0)
    expect(JSON.parse(dbSongs)).toHaveLength(8)
  })
})
