import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';

export interface RealtimeSyncOptions {
  isLoggedIn: boolean;
  token?: string | null;
  user?: { isGuest?: boolean } | null;
  onPlaylistsSynced?: (playlists: any[]) => void;
  onLikedSongsSynced?: (likedSongs: any[]) => void;
}

const PLAYLISTS_STORAGE_KEY = 'spotify_custom_playlists';
const PLAYLISTS_UPDATED_AT_KEY = 'tunely_custom_playlists_updated_at';
const LIKED_SONGS_STORAGE_KEY = 'tunely_liked_songs';
const LIKED_SONGS_UPDATED_AT_KEY = 'tunely_liked_songs_updated_at';

export function useRealtimeSync({
  isLoggedIn,
  token,
  user,
  onPlaylistsSynced,
  onLikedSongsSynced,
}: RealtimeSyncOptions) {
  const isSyncingRef = useRef<boolean>(false);

  const performSync = async () => {
    if (!isLoggedIn || !token || token === 'guest_token' || user?.isGuest || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      // 1. Custom Playlists Sync
      const localPlaylists = await storageService.getItem<any[]>(PLAYLISTS_STORAGE_KEY, []);
      const localPlaylistsTs = await storageService.getItem<string>(PLAYLISTS_UPDATED_AT_KEY, new Date(0).toISOString());

      const playlistsRes = await apiService.syncCustomPlaylists(localPlaylists, localPlaylistsTs, token);
      if (playlistsRes && playlistsRes.success && playlistsRes.data) {
        if (Array.isArray(playlistsRes.data.playlists)) {
          await storageService.setItem(PLAYLISTS_STORAGE_KEY, playlistsRes.data.playlists);
          if (playlistsRes.data.serverUpdatedAt) {
            await storageService.setItem(PLAYLISTS_UPDATED_AT_KEY, playlistsRes.data.serverUpdatedAt);
          }
          if (onPlaylistsSynced) {
            onPlaylistsSynced(playlistsRes.data.playlists);
          }
        }
      }

      // 2. Liked Songs Sync
      const localLiked = await storageService.getItem<any[]>(LIKED_SONGS_STORAGE_KEY, []);
      const localLikedTs = await storageService.getItem<string>(LIKED_SONGS_UPDATED_AT_KEY, new Date(0).toISOString());

      const likedRes = await apiService.syncLikedSongs(localLiked, localLikedTs, token);
      if (likedRes && likedRes.success && likedRes.data) {
        if (Array.isArray(likedRes.data.likedSongs)) {
          await storageService.setItem(LIKED_SONGS_STORAGE_KEY, likedRes.data.likedSongs);
          if (likedRes.data.serverUpdatedAt) {
            await storageService.setItem(LIKED_SONGS_UPDATED_AT_KEY, likedRes.data.serverUpdatedAt);
          }
          if (onLikedSongsSynced) {
            onLikedSongsSynced(likedRes.data.likedSongs);
          }
        }
      }
    } catch (e) {
      console.warn('[RealtimeSync] Background sync skipped or failed (offline / network):', e);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !token || token === 'guest_token' || user?.isGuest) return;

    // Sync on initial login / mount
    performSync();

    // Sync when returning to active state (React Native AppState)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        performSync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isLoggedIn, token, user]);

  return { syncNow: performSync };
}
