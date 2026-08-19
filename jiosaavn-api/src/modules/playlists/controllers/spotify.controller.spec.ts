import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { App } from '../../../app'

describe('Spotify Playlist Importer Controller (GET /api/spotify/playlist)', () => {
  let app: ReturnType<App['getApp']>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    app = new App([]).getApp()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns 400 bad request if missing playlist id parameter', async () => {
    const res = await app.request('/api/spotify/playlist')
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toBe('Missing playlist id parameter')
  })

  it('succesfully parses valid Spotify __NEXT_DATA__ embedded HTML fallback', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "state": {
                    "data": {
                      "entity": {
                        "name": "Global Top 50 Test Playlist",
                        "trackList": [
                          { "title": "Espresso", "subtitle": "Sabrina Carpenter" },
                          { "title": "Birds of a Feather", "subtitle": "Billie Eilish" }
                        ]
                      }
                    }
                  }
                }
              }
            }
          </script>
        </head>
      </html>
    `

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes('open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M')) {
        return new Response(mockHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })
      }
      return new Response('Not Found', { status: 404 })
    })

    const res = await app.request('/api/spotify/playlist?id=37i9dQZF1DXcBWIGoYBM5M')
    expect(res.status).toBe(200)
    const body: any = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Global Top 50 Test Playlist')
    expect(body.data.tracks).toHaveLength(2)
    expect(body.data.tracks[0]).toEqual({ title: 'Espresso', artist: 'Sabrina Carpenter' })
    expect(body.data.tracks[1]).toEqual({ title: 'Birds of a Feather', artist: 'Billie Eilish' })
  })

  it('returns 404 when embed HTML is missing __NEXT_DATA__ script payload', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response('<html><body><div>No data script element here</div></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    })

    const res = await app.request('/api/spotify/playlist?id=37i9dQZF1DXcBWIGoYBM5M')
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toBe('Could not retrieve Spotify playlist')
  })

  it('returns 404 when __NEXT_DATA__ contains an empty trackList', async () => {
    const mockEmptyHtml = `
      <script id="__NEXT_DATA__" type="application/json">
        { "props": { "pageProps": { "state": { "data": { "entity": { "name": "Empty Playlist", "trackList": [] } } } } } }
      </script>
    `

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(mockEmptyHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    })

    const res = await app.request('/api/spotify/playlist?id=empty123')
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toBe('Could not retrieve Spotify playlist')
  })

  it('returns 500 when external network fetch throws an exception during embed fallback', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      throw new Error('Connection reset by peer')
    })

    const res = await app.request('/api/spotify/playlist?id=37i9dQZF1DXcBWIGoYBM5M')
    expect(res.status).toBe(500)
    const body: any = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toBe('Connection reset by peer')
  })

  it('succesfully fetches via official Spotify API when API client credentials environment secrets are set', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (urlStr: string) => {
      if (urlStr === 'https://accounts.spotify.com/api/token') {
        return new Response(JSON.stringify({ access_token: 'mock_access_token' }), { status: 200 })
      }
      if (urlStr.includes('api.spotify.com/v1/playlists/')) {
        return new Response(
          JSON.stringify({
            name: 'Official Spotify Top 100',
            tracks: {
              items: [
                {
                  track: {
                    name: 'Official Track 1',
                    artists: [{ name: 'Artist Alpha' }, { name: 'Artist Beta' }]
                  }
                }
              ]
            }
          }),
          { status: 200 }
        )
      }
      return new Response('Not Found', { status: 404 })
    })

    const env = {
      SPOTIFY_CLIENT_ID: 'valid_client_id',
      SPOTIFY_CLIENT_SECRET: 'valid_client_secret'
    }

    const res = await app.request('/api/spotify/playlist?id=37i9dQZF1DXcBWIGoYBM5M', {}, env)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Official Spotify Top 100')
    expect(body.data.tracks).toEqual([
      { title: 'Official Track 1', artist: 'Artist Alpha, Artist Beta' }
    ])
  })
})
