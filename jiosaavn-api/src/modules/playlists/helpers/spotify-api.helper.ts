export interface SpotifyTrackItem {
  id?: string
  title: string
  artist: string
  album?: string
  duration_ms?: number
}

export interface SpotifyPlaylistFetchResult {
  name: string
  spotify_playlist_id: string
  snapshot_id: string | null
  tracks: SpotifyTrackItem[]
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

/**
 * Retrieves a Client Credentials access token from Spotify, with in-memory caching
 * per Worker isolate to eliminate redundant token subrequests.
 */
async function getSpotifyAccessToken(clientId: string, clientSecret: string): Promise<string | null> {
  const now = Date.now()
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60000) {
    return cachedAccessToken.token
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: 'grant_type=client_credentials'
    })

    if (tokenRes.ok) {
      const tokenData: any = await tokenRes.json()
      if (tokenData.access_token) {
        const expiresInMs = (tokenData.expires_in || 3600) * 1000
        cachedAccessToken = {
          token: tokenData.access_token,
          expiresAt: now + expiresInMs
        }
        return tokenData.access_token
      }
    }
  } catch (e) {
    console.error('Error requesting Spotify access token:', e)
  }

  return null
}

/**
 * Computes a deterministic SHA-256 content fingerprint of playlist tracks.
 * Uses Spotify track ID if available, otherwise normalized title + artist(s).
 * Track ordering is strictly preserved.
 */
export async function generatePlaylistFingerprint(
  tracks: Array<{ id?: string; title: string; artist: string }>
): Promise<string> {
  const normalize = (str: string) => (str || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
  const trackSignatures = tracks.map(t => {
    if (t.id) return `id:${t.id}`
    return `sig:${normalize(t.title)}|${normalize(t.artist)}`
  })
  const payload = trackSignatures.join(';')

  const encoder = new TextEncoder()
  const data = encoder.encode(payload)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)
  return `fp_${hashHex}`
}

/**
 * Fetches Spotify playlist details (name, snapshot_id / content fingerprint, and track items).
 * Priority:
 * 1. Official Spotify Web API snapshot_id (when SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are configured)
 * 2. Deterministic SHA-256 playlist content fingerprint fallback
 */
export async function fetchSpotifyPlaylistData(
  rawId: string,
  env: any
): Promise<SpotifyPlaylistFetchResult | null> {
  const id = rawId.replaceAll(/[^a-z0-9]/gi, '')
  if (!id) return null

  const clientId = env?.SPOTIFY_CLIENT_ID as string | undefined
  const clientSecret = env?.SPOTIFY_CLIENT_SECRET as string | undefined

  let useEmbedFallback = !clientId || !clientSecret

  if (clientId && clientSecret) {
    try {
      const accessToken = await getSpotifyAccessToken(clientId, clientSecret)

      if (accessToken) {
        const playlistRes = await fetch(
          `https://api.spotify.com/v1/playlists/${id}?fields=name,snapshot_id,tracks.next,tracks.items(track(id,name,duration_ms,album(name),artists(name)))&limit=100`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        )

        if (playlistRes.ok) {
          const playlistData: any = await playlistRes.json()
          const playlistName = playlistData.name || 'Imported Playlist'
          const officialSnapshotId = playlistData.snapshot_id || null
          let items = playlistData.tracks?.items || []
          let nextUrl = playlistData.tracks?.next

          let pageCount = 1
          while (nextUrl && pageCount < 10) {
            try {
              const nextRes = await fetch(nextUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (!nextRes.ok) break
              const nextData: any = await nextRes.json()
              items = items.concat(nextData.items || [])
              nextUrl = nextData.next
              pageCount++
            } catch {
              break
            }
          }

          const tracks: SpotifyTrackItem[] = items
            .filter((item: any) => item?.track?.name)
            .map((item: any) => ({
              id: item.track.id || undefined,
              title: item.track.name,
              artist: (item.track.artists && Array.isArray(item.track.artists))
                ? item.track.artists.filter((a: any) => a && a.name).map((a: any) => a.name).join(', ')
                : 'Unknown Artist',
              album: item.track.album?.name || undefined,
              duration_ms: item.track.duration_ms || undefined
            }))

          const snapshotId = officialSnapshotId || (await generatePlaylistFingerprint(tracks))

          return {
            name: playlistName,
            spotify_playlist_id: id,
            snapshot_id: snapshotId,
            tracks
          }
        }
      }
      useEmbedFallback = true
    } catch (e) {
      console.error('Spotify API fetch error:', e)
      useEmbedFallback = true
    }
  }

  if (useEmbedFallback) {
    try {
      const embedRes = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      })

      if (embedRes.ok) {
        const html = await embedRes.text()
        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
        if (match) {
          const parsed = JSON.parse(match[1])
          const stateData = parsed.props?.pageProps?.state?.data
          if (stateData && stateData.entity) {
            const playlistName = stateData.entity.name || 'Imported Playlist'
            const trackList = stateData.entity.trackList || []
            if (trackList.length === 0) return null

            const tracks: SpotifyTrackItem[] = trackList.map((t: any) => ({
              id: t.id || t.uri || undefined,
              title: t.title || 'Unknown Song',
              artist: t.subtitle || 'Unknown Artist',
              album: t.album?.name || t.album || undefined,
              duration_ms: typeof t.duration === 'number' ? (t.duration < 10000 ? t.duration * 1000 : t.duration) : undefined
            }))

            const officialEmbedSnapshot = stateData.entity.snapshot_id || stateData.entity.revisionId || null
            const snapshotId = officialEmbedSnapshot || (await generatePlaylistFingerprint(tracks))

            return {
              name: playlistName,
              spotify_playlist_id: id,
              snapshot_id: snapshotId,
              tracks
            }
          }
        }
      }
    } catch (embedErr) {
      console.error('Spotify embed fetch error:', embedErr)
      throw embedErr
    }
  }

  return null
}
