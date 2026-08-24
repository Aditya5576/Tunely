import { AlbumController, ArtistController, SearchController, SongController } from '#modules/index'
import { PlaylistController } from '#modules/playlists/controllers'
import { authController } from '#modules/auth/auth.controller'
import { userController } from '#modules/auth/user.controller'
import { adminController } from '#modules/auth/admin.controller'
import { runHourlySpotifySync } from '#modules/playlists/services/spotify-sync-cron.service'
import { App } from './app'

const app = new App([
  new SearchController(),
  new SongController(),
  new AlbumController(),
  new ArtistController(),
  new PlaylistController()
], authController, userController, adminController).getApp()

export { UserSyncDurableObject } from '#modules/auth/user-sync.do'

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: any, ctx: any) {
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(runHourlySpotifySync(env))
    } else {
      await runHourlySpotifySync(env)
    }
  }
}
