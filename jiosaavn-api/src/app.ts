import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { Home } from './pages/home'
import { fetchSpotifyPlaylistData } from '#modules/playlists/helpers/spotify-api.helper'
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

    // Spotify Playlist route using official Spotify Web API or fallback SHA-256 fingerprint parser
    this.app.get('/api/spotify/playlist', async (c) => {
      const id = c.req.query('id')
      if (!id) {
        return c.json({ success: false, message: 'Missing playlist id parameter' }, 400)
      }

      try {
        const data = await fetchSpotifyPlaylistData(id, c.env)
        if (data) {
          return c.json({
            success: true,
            data
          })
        }
        return c.json({ success: false, message: 'Could not retrieve Spotify playlist' }, 404)
      } catch (err: any) {
        return c.json({ success: false, message: err.message || 'Internal Server Error' }, 500)
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
