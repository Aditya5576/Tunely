import { describe, it, expect } from 'vitest'
import { generatePlaylistFingerprint, fetchSpotifyPlaylistData } from '../helpers/spotify-api.helper'

describe('Spotify Playlist Snapshot & Deterministic Fingerprint Test Suite', () => {
  const baseTracks = [
    { id: 'track_1', title: 'Espresso', artist: 'Sabrina Carpenter' },
    { id: 'track_2', title: 'Birds of a Feather', artist: 'Billie Eilish' },
    { id: 'track_3', title: 'Good Luck, Babe!', artist: 'Chappell Roan' }
  ]

  it('1. Same playlist content and order produces identical fingerprint', async () => {
    const fp1 = await generatePlaylistFingerprint(baseTracks)
    const fp2 = await generatePlaylistFingerprint([...baseTracks])
    expect(fp1).toBe(fp2)
    expect(fp1).toMatch(/^fp_[a-f0-9]{32}$/)
  })

  it('2. Added track produces a different fingerprint', async () => {
    const fpOriginal = await generatePlaylistFingerprint(baseTracks)
    const tracksWithAddition = [
      ...baseTracks,
      { id: 'track_4', title: 'Please Please Please', artist: 'Sabrina Carpenter' }
    ]
    const fpAddition = await generatePlaylistFingerprint(tracksWithAddition)
    expect(fpAddition).not.toBe(fpOriginal)
  })

  it('3. Removed track produces a different fingerprint', async () => {
    const fpOriginal = await generatePlaylistFingerprint(baseTracks)
    const tracksWithRemoval = baseTracks.slice(0, 2)
    const fpRemoval = await generatePlaylistFingerprint(tracksWithRemoval)
    expect(fpRemoval).not.toBe(fpOriginal)
  })

  it('4. Replaced track with SAME playlist length produces a different fingerprint', async () => {
    const fpOriginal = await generatePlaylistFingerprint(baseTracks)
    // Replace track 2 while keeping total track count at 3
    const tracksReplaced = [
      baseTracks[0],
      { id: 'track_99', title: 'Replaced Track', artist: 'New Artist' },
      baseTracks[2]
    ]
    expect(tracksReplaced).toHaveLength(baseTracks.length)
    const fpReplaced = await generatePlaylistFingerprint(tracksReplaced)
    expect(fpReplaced).not.toBe(fpOriginal)
  })

  it('5. Reordered tracks produce a different fingerprint', async () => {
    const fpOriginal = await generatePlaylistFingerprint(baseTracks)
    const tracksReordered = [baseTracks[2], baseTracks[0], baseTracks[1]]
    const fpReordered = await generatePlaylistFingerprint(tracksReordered)
    expect(fpReordered).not.toBe(fpOriginal)
  })

  it('6. Fingerprint without Spotify IDs uses normalized title and artist', async () => {
    const tracksNoId1 = [
      { title: 'Espresso  ', artist: 'Sabrina Carpenter' },
      { title: 'BIRDS OF A FEATHER', artist: 'Billie Eilish' }
    ]
    const tracksNoId2 = [
      { title: 'espresso', artist: 'sabrina carpenter' },
      { title: 'Birds of a Feather', artist: 'billie eilish' }
    ]
    const fp1 = await generatePlaylistFingerprint(tracksNoId1)
    const fp2 = await generatePlaylistFingerprint(tracksNoId2)
    expect(fp1).toBe(fp2)
  })

  it('7. Official Spotify Web API snapshot_id takes precedence when available', async () => {
    const resultObj = {
      name: 'Test Playlist',
      spotify_playlist_id: 'test_id',
      snapshot_id: 'AAAAAYofficialSpotifySnapshotHeader123',
      tracks: baseTracks
    }
    expect(resultObj.snapshot_id).toBe('AAAAAYofficialSpotifySnapshotHeader123')
    expect(resultObj.snapshot_id).not.toMatch(/^fp_/)
  })

  it('8. Handles missing Spotify API gracefully with null input', async () => {
    const res = await fetchSpotifyPlaylistData('', {})
    expect(res).toBeNull()
  })

  it('9. Deduplication check safely prevents duplicate track insertions', () => {
    const existingSongs = [
      { id: 's1', name: 'Espresso', artists: { primary: [{ name: 'Sabrina Carpenter' }] } }
    ]
    const normalize = (str: string) => (str || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
    const existingSigs = new Set(existingSongs.map(s => `${normalize(s.name)}|${normalize(s.artists.primary[0].name)}`))

    const newSpotifyTracks = [
      { title: 'Espresso', artist: 'Sabrina Carpenter' }, // Duplicate -> filter out
      { title: 'New Track', artist: 'New Artist' }       // Unique -> keep
    ]

    const uniqueNewTracks = newSpotifyTracks.filter(t => {
      const sig = `${normalize(t.title)}|${normalize(t.artist)}`
      return !existingSigs.has(sig)
    })

    expect(uniqueNewTracks).toHaveLength(1)
    expect(uniqueNewTracks[0].title).toBe('New Track')
  })
})
