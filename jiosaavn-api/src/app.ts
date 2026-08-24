import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { Home } from './pages/home'
import type { Routes } from '#common/types'
import type { HTTPException } from 'hono/http-exception'
import type { Hono } from 'hono'

export class App {
  private app: OpenAPIHono

  constructor(routes: Routes[], authRouter?: Hono<any, any, any>, userRouter?: Hono<any, any, any>, adminRouter?: Hono<any, any, any>) {
    this.app = new OpenAPIHono()

    this.initializeGlobalMiddlewares()
    this.initializeRoutes(routes, authRouter, userRouter, adminRouter)
    this.initializeSwaggerUI()
    this.initializeRouteFallback()
    this.initializeErrorHandler()
  }

  private initializeRoutes(routes: Routes[], authRouter?: Hono, userRouter?: Hono, adminRouter?: Hono) {
    routes.forEach((route) => {
      route.initRoutes()
      this.app.route('/api', route.controller)
    })

    // Mount auth, user and admin routes
    if (authRouter) this.app.route('/api/auth', authRouter)
    if (userRouter) this.app.route('/api/user', userRouter)
    if (adminRouter) this.app.route('/api/admin', adminRouter)

    // Spotify Playlist route using official Spotify Web API or fallback public embed parser
    // Token is cached in module scope per Worker instance to avoid redundant token requests.
    this.app.get('/api/spotify/playlist', async (c) => {
      let id = c.req.query('id')
      if (!id) {
        return c.json({ success: false, message: 'Missing playlist id parameter' }, 400)
      }

      // Clean ID from any trailing dots, spaces, or query parameters
      id = id.replaceAll(/[^a-z0-9]/gi, '')

      const clientId = (c.env as any)?.SPOTIFY_CLIENT_ID as string | undefined
      const clientSecret = (c.env as any)?.SPOTIFY_CLIENT_SECRET as string | undefined

      let useEmbedFallback = !clientId || !clientSecret

      if (clientId && clientSecret) {
        try {
          // Step 1: Get access token via Client Credentials (server-to-server, no user login needed)
          const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
            },
            body: 'grant_type=client_credentials'
          })

          if (!tokenRes.ok) {
            console.error('Spotify token generation failed, attempting embed fallback')
            useEmbedFallback = true
          } else {
            const tokenData: any = await tokenRes.json()
            const accessToken = tokenData.access_token

            if (!accessToken) {
              useEmbedFallback = true
            } else {
              // Step 2: Fetch playlist details (name + snapshot_id + first 100 tracks + pagination info)
              const playlistRes = await fetch(
                `https://api.spotify.com/v1/playlists/${id}?fields=name,snapshot_id,tracks.next,tracks.items(track(name,artists(name)))&limit=100`,
                {
                  headers: { 'Authorization': `Bearer ${accessToken}` }
                }
              )

              if (!playlistRes.ok) {
                useEmbedFallback = true
              } else {
                const playlistData: any = await playlistRes.json()
                const playlistName = playlistData.name || 'Imported Playlist'
                const snapshotId = playlistData.snapshot_id || null
                let items = playlistData.tracks?.items || []
                let nextUrl = playlistData.tracks?.next

                // Paginate to retrieve all tracks (max 10 pages/1000 tracks to avoid timeout/memory limits)
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

                const tracks = items
                  .filter((item: any) => item?.track?.name)
                  .map((item: any) => ({
                    title: item.track.name,
                    artist: (item.track.artists && Array.isArray(item.track.artists))
                      ? item.track.artists.filter((a: any) => a && a.name).map((a: any) => a.name).join(', ')
                      : 'Unknown Artist'
                  }))

                if (tracks.length > 0) {
                  return c.json({
                    success: true,
                    data: {
                      name: playlistName,
                      spotify_playlist_id: id,
                      snapshot_id: snapshotId,
                      tracks
                    }
                  })
                } else {
                  useEmbedFallback = true
                }
              }
            }
          }
        } catch (error) {
          console.error('Official Spotify API failed, falling back to embed:', error)
          useEmbedFallback = true
        }
      }

      if (useEmbedFallback) {
        // Try Option 1: Public Embed Scraper (No credentials required, bypasses Developer API limits/Premium rules)
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
                if (trackList.length > 0) {
                  const tracks = trackList.map((t: any) => ({
                    title: t.title || 'Unknown Song',
                    artist: t.subtitle || 'Unknown Artist'
                  }))
                  return c.json({
                    success: true,
                    data: {
                      name: playlistName,
                      spotify_playlist_id: id,
                      snapshot_id: snapshotId,
                      tracks
                    }
                  })
                }
              }
            }
          }
          return c.json({ success: false, message: 'Could not retrieve Spotify playlist' }, 404)
        } catch (error: any) {
          return c.json({ success: false, message: error.message || 'An unexpected error occurred during fallback' }, 500)
        }
      }
    })

    this.app.route('/', Home)
  }

  private initializeGlobalMiddlewares() {
    this.app.use(logger())
    this.app.use(prettyJSON())
    this.app.use(cors())
  }

  private initializeSwaggerUI() {
    this.app.doc31('/swagger', (c) => {
      const { protocol: urlProtocol, hostname, port } = new URL(c.req.url)
      const protocol = c.req.header('x-forwarded-proto') ? `${c.req.header('x-forwarded-proto')}:` : urlProtocol

      return {
        openapi: '3.1.0',

        info: {
          version: '1.0.0',
          title: 'JioSaavn API',
          description: `# Introduction 
        \nJioSaavn API, accessible at [saavn.dev](https://saavn.dev), is an unofficial API that allows users to download high-quality songs from [JioSaavn](https://jiosaavn.com). 
        It offers a fast, reliable, and easy-to-use API for developers. \n`
        },
        servers: [{ url: `${protocol}//${hostname}${port ? `:${port}` : ''}`, description: 'Current environment' }]
      }
    })

    this.app.get(
      '/docs',
      apiReference({
        pageTitle: 'JioSaavn API Documentation',
        theme: 'deepSpace',
        isEditable: false,
        layout: 'modern',
        darkMode: true,
        metaData: {
          applicationName: 'JioSaavn API',
          author: 'Sumit Kolhe',
          creator: 'Sumit Kolhe',
          publisher: 'Sumit Kolhe',
          robots: 'index, follow',
          description:
            'JioSaavn API is an unofficial wrapper written in TypeScript for jiosaavn.com providing programmatic access to a vast library of songs, albums, artists, playlists, and more.'
        },
        url: '/swagger'
      })
    )
  }

  private initializeRouteFallback() {
    this.app.notFound((ctx) => {
      return ctx.json({ success: false, message: 'route not found, check docs at https://saavn.dev/docs' }, 404)
    })
  }

  private initializeErrorHandler() {
    this.app.onError((err, ctx) => {
      const error = err as HTTPException
      return ctx.json({ success: false, message: error.message }, error.status || 500)
    })
  }

  public getApp() {
    return this.app
  }
}
