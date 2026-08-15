import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export interface RealtimeSyncOptions {
  isLoggedIn: boolean;
  token?: string | null;
  onSyncPlaylists?: () => Promise<void>;
  onSyncLikedSongs?: () => Promise<void>;
}

export function useRealtimeSync({
  isLoggedIn,
  token,
  onSyncPlaylists,
  onSyncLikedSongs,
}: RealtimeSyncOptions) {
  useEffect(() => {
    if (!isLoggedIn || !token || token === 'guest_token') return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (onSyncPlaylists) onSyncPlaylists();
        if (onSyncLikedSongs) onSyncLikedSongs();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isLoggedIn, token, onSyncPlaylists, onSyncLikedSongs]);
}
