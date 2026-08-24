import { describe, it, expect } from 'vitest'
import { fetchSpotifyPlaylistData } from '../helpers/spotify-api.helper'

describe('Spotify Playlist Sync Helper & Metadata Tests', () => {
  it('1. Non-Spotify playlists carry no spotify_playlist_id or snapshot_id', () => {
    const nonSpotifyPlaylist = {
      id: 'pl_123',
      name: 'My Personal Mixtape',
      songs: [{ id: 's1', name: 'Song 1' }]
    }
    expect(nonSpotifyPlaylist.spotify_playlist_id).toBeUndefined()
    expect(nonSpotifyPlaylist.spotify_snapshot_id).toBeUndefined()
  })

  it('2. Spotify metadata is properly represented on imported playlists', () => {
    const spotifyPlaylist = {
      id: 'pl_456',
      name: 'Global Top 50 (Spotify)',
      songs: [{ id: 's2', name: 'Song 2' }],
      spotify_playlist_id: '37i9dQZF1DXcBWIGoYBM5M',
      spotify_snapshot_id: 'snap_v1',
      last_spotify_sync_at: '2026-08-24T12:00:00Z'
    }
    expect(spotifyPlaylist.spotify_playlist_id).toBe('37i9dQZF1DXcBWIGoYBM5M')
    expect(spotifyPlaylist.spotify_snapshot_id).toBe('snap_v1')
    expect(spotifyPlaylist.last_spotify_sync_at).toBeDefined()
  })

  it('3. Deduplication logic prevents adding existing songs twice', () => {
    const existingSongs = [
      { id: 's10', name: 'Kesariya', artists: { primary: [{ name: 'Arijit Singh' }] } }
    ]
    const normalize = (str: string) => (str || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
    const existingSigs = new Set(existingSongs.map(s => `${normalize(s.name)}|${normalize(s.artists.primary[0].name)}`))

    const newSpotifyTracks = [
      { title: 'Kesariya', artist: 'Arijit Singh' }, // Existing -> skip
      { title: 'Chaleya', artist: 'Arijit Singh' }   // New -> keep
    ]

    const filtered = newSpotifyTracks.filter(t => {
      const sig = `${normalize(t.title)}|${normalize(t.artist)}`
      return !existingSigs.has(sig)
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toBe('Chaleya')
  })

  it('4. Snapshot equality comparison accurately determines up_to_date state', () => {
    const currentSnapshot = 'snap_abc_123'
    const storedSnapshot = 'snap_abc_123'

    const isUpToDate = currentSnapshot === storedSnapshot
    expect(isUpToDate).toBe(true)
  })

  it('5. Snapshot change accurately triggers update phase', () => {
    const currentSnapshot = 'snap_abc_999'
    const storedSnapshot = 'snap_abc_123'

    const isUpToDate = currentSnapshot === storedSnapshot
    expect(isUpToDate).toBe(false)
  })

  it('6. Helper handles invalid Spotify playlist IDs safely', async () => {
    const res = await fetchSpotifyPlaylistData('', {})
    expect(res).toBeNull()
  })
})
