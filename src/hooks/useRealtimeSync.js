import { useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://jiosaavn-api.adityapatil2348.workers.dev';

export function useRealtimeSync({
  isLoggedIn,
  user,
  authFetch,
  syncLikedSongs,
  syncPlaylistsOnLogin,
  setLikedSongs,
  setLikedSongsMetadata,
  setCustomPlaylists
}) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const lastSyncTimestampRef = useRef(0);

  // Maintain always-fresh callback references without triggering effect re-execution
  const callbacksRef = useRef({
    syncLikedSongs,
    syncPlaylistsOnLogin,
    setLikedSongs,
    setLikedSongsMetadata,
    setCustomPlaylists
  });

  useEffect(() => {
    callbacksRef.current = {
      syncLikedSongs,
      syncPlaylistsOnLogin,
      setLikedSongs,
      setLikedSongsMetadata,
      setCustomPlaylists
    };
  });

  useEffect(() => {
    if (!isLoggedIn || !authFetch || user?.isGuest) {
      if (wsRef.current) {
        wsRef.current.close(1000, 'User logged out');
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const connectWebSocket = async () => {
      try {
        // Step 1: Obtain a short-lived 60-second single-use ticket
        const res = await authFetch(`${API_BASE}/api/auth/ws-ticket`, { method: 'POST' });
        const data = await res.json();

        if (!isSubscribed || !data.success || !data.ticket) return;

        const ticket = data.ticket;
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${wsHost}/api/user/ws?ticket=${encodeURIComponent(ticket)}`;

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (!isSubscribed) return;
          reconnectAttemptsRef.current = 0;

          // Throttled authoritative reconciliation upon genuine reconnection (15s cooldown)
          const now = Date.now();
          if (now - lastSyncTimestampRef.current >= 15000) {
            lastSyncTimestampRef.current = now;
            if (callbacksRef.current.syncLikedSongs) callbacksRef.current.syncLikedSongs();
            if (callbacksRef.current.syncPlaylistsOnLogin) callbacksRef.current.syncPlaylistsOnLogin();
          }
        };

        socket.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const msg = JSON.parse(event.data);
            const {
              setLikedSongs: curSetLikedSongs,
              setLikedSongsMetadata: curSetLikedSongsMeta,
              setCustomPlaylists: curSetCustomPlaylists,
              syncLikedSongs: curSyncLiked,
              syncPlaylistsOnLogin: curSyncPlaylists
            } = callbacksRef.current;

            if (msg.type === 'liked') {
              if (msg.action === 'liked.created' && msg.data?.song) {
                const newSong = msg.data.song;
                if (curSetLikedSongs) {
                  curSetLikedSongs((prev) => {
                    if (prev.some((s) => s.id === newSong.id)) return prev;
                    const updated = [newSong, ...prev];
                    try { localStorage.setItem('tunely_liked_songs', JSON.stringify(updated)); } catch (e) { console.warn('Cache error:', e); }
                    return updated;
                  });
                }
                if (curSetLikedSongsMeta) {
                  curSetLikedSongsMeta((prev) => ({ ...prev, [newSong.id]: newSong }));
                }
              } else if (msg.action === 'liked.deleted' && msg.data?.songId) {
                const deletedId = msg.data.songId;
                if (curSetLikedSongs) {
                  curSetLikedSongs((prev) => {
                    const updated = prev.filter((s) => s.id !== deletedId);
                    try { localStorage.setItem('tunely_liked_songs', JSON.stringify(updated)); } catch (e) { console.warn('Cache error:', e); }
                    return updated;
                  });
                }
              } else if (curSyncLiked) {
                curSyncLiked();
              }
            } else if (msg.type === 'playlist') {
              if (msg.action === 'playlist.created' && msg.data?.playlist) {
                const newPl = msg.data.playlist;
                if (curSetCustomPlaylists) {
                  curSetCustomPlaylists((prev) => {
                    if (prev.some((p) => p.id === newPl.id)) return prev;
                    const updated = [...prev, newPl];
                    try { localStorage.setItem('tunely_custom_playlists', JSON.stringify(updated)); } catch (e) { console.warn('Cache error:', e); }
                    return updated;
                  });
                }
              } else if (msg.action === 'playlist.deleted' && msg.data?.playlistId) {
                const deletedId = msg.data.playlistId;
                if (curSetCustomPlaylists) {
                  curSetCustomPlaylists((prev) => {
                    const updated = prev.filter((p) => p.id !== deletedId);
                    try { localStorage.setItem('tunely_custom_playlists', JSON.stringify(updated)); } catch (e) { console.warn('Cache error:', e); }
                    return updated;
                  });
                }
              } else if ((msg.action === 'playlist.renamed' || msg.action === 'playlist.updated') && msg.data?.playlistId) {
                const { playlistId, name, songs } = msg.data;
                if (curSetCustomPlaylists) {
                  curSetCustomPlaylists((prev) => {
                    const updated = prev.map((p) => {
                      if (p.id !== playlistId) return p;
                      return {
                        ...p,
                        name: name !== undefined ? name : p.name,
                        songs: songs !== undefined ? songs : p.songs,
                        updatedAt: msg.updatedAt || new Date().toISOString()
                      };
                    });
                    try { localStorage.setItem('tunely_custom_playlists', JSON.stringify(updated)); } catch (e) { console.warn('Cache error:', e); }
                    return updated;
                  });
                }
              } else if (curSyncPlaylists) {
                curSyncPlaylists();
              }
            }
          } catch (e) {
            console.warn('Realtime message parse error:', e);
          }
        };

        socket.onerror = () => {
          // Socket will trigger onclose
        };

        socket.onclose = () => {
          if (!isSubscribed) return;
          wsRef.current = null;

          // Exponential backoff reconnect: 2s, 4s, 8s, 16s... up to 30s
          const delay = Math.min(30000, Math.pow(2, reconnectAttemptsRef.current) * 2000);
          reconnectAttemptsRef.current += 1;
          reconnectTimerRef.current = setTimeout(connectWebSocket, delay);
        };
      } catch {
        if (!isSubscribed) return;
        const delay = Math.min(30000, Math.pow(2, reconnectAttemptsRef.current) * 2000);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connectWebSocket, delay);
      }
    };

    connectWebSocket();

    return () => {
      isSubscribed = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [isLoggedIn, user?.id, user?.isGuest, authFetch]);
}
