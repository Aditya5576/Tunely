export interface SpotifyTrackItem {
  title: string
  artist: string
}

export interface SpotifyPlaylistFetchResult {
  name: string
  spotify_playlist_id: string
  snapshot_id: string | null
  tracks: SpotifyTrackItem[]
}

/**
 * Fetches Spotify playlist details (name, snapshot_id, and track items)
 * via official Spotify Web API (Client Credentials) or public embed scraper fallback.
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
        const accessToken = tokenData.access_token

        if (accessToken) {
          const playlistRes = await fetch(
            `https://api.spotify.com/v1/playlists/${id}?fields=name,snapshot_id,tracks.next,tracks.items(track(name,artists(name)))&limit=100`,
            {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            }
          )

          if (playlistRes.ok) {
            const playlistData: any = await playlistRes.json()
            const playlistName = playlistData.name || 'Imported Playlist'
            const snapshotId = playlistData.snapshot_id || null
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
                title: item.track.name,
                artist: (item.track.artists && Array.isArray(item.track.artists))
                  ? item.track.artists.filter((a: any) => a && a.name).map((a: any) => a.name).join(', ')
                  : 'Unknown Artist'
              }))

            return {
              name: playlistName,
              spotify_playlist_id: id,
              snapshot_id: snapshotId,
              tracks
            }
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
            const snapshotId = stateData.entity.revisionId || stateData.entity.snapshot_id || `embed_${id}_${stateData.entity.trackList?.length || 0}`
            const trackList = stateData.entity.trackList || []
            const tracks: SpotifyTrackItem[] = trackList.map((t: any) => ({
              title: t.title || 'Unknown Song',
              artist: t.subtitle || 'Unknown Artist'
            }))
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
    }
  }

  return null
}
