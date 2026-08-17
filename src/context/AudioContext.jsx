/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { parseLyrics } from '../utils/lyrics';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const API_BASE = (import.meta.env.VITE_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev').trim();
const AudioContext = createContext(null);

export const useAudio = () => useContext(AudioContext);

// Pre-populated lyrics fallback database for popular songs to ensure the UI looks premium
const LYRICS_FALLBACK = {
  "rjkrTnma": "Mujhko saza de, ya chahe duaa de...\nKesariya tera ishq hai piya\nRang jaaun jo main haath lagaaun\nDin beete saara teri fikr mein\nRain saari teri khair manaaun...",
  "0W6DtW_N": "First things first\nI'ma say all the words inside my head\nI'm fired up and tired of the way that things have been, oh-ooh\nThe way that things have been, oh-ooh\n\nSecond thing second\nDon't you tell me what you think that I can be\nI'm the one at the sail, I'm the master of my sea, oh-ooh\nThe master of my sea, oh-ooh...",
  "1ZDlyUiL": "First things first\nI'ma say all the words inside my head\nI'm fired up and tired of the way that things have been, oh-ooh\nThe way that things have been, oh-ooh\n\nSecond thing second\nDon't you tell me what you think that I can be\nI'm the one at the sail, I'm the master of my sea, oh-ooh\nThe master of my sea, oh-ooh...",
  "EbFWakDs": "Mujhko saza de, ya chahe duaa de...\nKesariya tera ishq hai piya\nRang jaaun jo main haath lagaaun\nDin beete saara teri fikr mein\nRain saari teri khair manaaun...",
  "_euChQrF": "Mujhko saza de, ya chahe duaa de...\nKesariya tera ishq hai piya\nRang jaaun jo main haath lagaaun\nDin beete saara teri fikr mein\nRain saari teri khair manaaun..."
};

export const AudioProvider = ({ children }) => {
  const { user, token, isLoggedIn, isLoading, authFetch } = useAuth() || {};
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(() => {
    try {
      const saved = localStorage.getItem('tunely_current_track');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [currentTime, setCurrentTime] = useState(() => {
    try {
      const saved = localStorage.getItem('tunely_current_time');
      return saved ? parseFloat(saved) : 0;
    } catch { return 0; }
  });
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [queue, setQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('tunely_queue');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('tunely_current_index');
      return saved !== null ? parseInt(saved, 10) : -1;
    } catch { return -1; }
  });
  const [loopMode, setLoopMode] = useState('none'); // 'none' | 'all' | 'one'
  const [isShuffle, setIsShuffle] = useState(false);
  const [shuffledIndices, setShuffledIndices] = useState([]);
  const [shuffledCurrentIndex, setShuffledCurrentIndex] = useState(-1);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [isLyricsVisible, setIsLyricsVisible] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  // null = not yet detected; string = real device name
  const [audioOutputDevice, setAudioOutputDevice] = useState(null);

  const audioRef = useRef(new Audio());
  const preloadRef = useRef(new Audio()); // For pre-buffering the next track
  const fadeIntervalRef = useRef(null);
  const volumeRef = useRef(volume);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const hasPreloadedRef = useRef(null);
  // System Interruption & Phone Call Recovery Refs
  const userInitiatedPauseRef = useRef(false);
  const wasPlayingBeforeInterruptionRef = useRef(false);
  const isSystemInterruptedRef = useRef(false);
  const userQueuedCountRef = useRef(0);
  // Audio Quality State
  const [audioQuality, setAudioQualityState] = useState(() => {
    return localStorage.getItem('tunely_audio_quality') || '320kbps';
  });

  const [recentlyPlayed, setRecentlyPlayed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tunely_recently_played') || '[]');
    } catch {
      return [];
    }
  });

  // Generate shuffled indices when shuffle is turned on or queue changes
  useEffect(() => {
    if (isShuffle && queue.length > 0) {
      // Create indices array [0, 1, 2, ..., N-1]
      const indices = Array.from({ length: queue.length }, (_, i) => i);
      // Remove current index from the pool so it doesn't get shuffled to the next spot
      const filteredIndices = indices.filter(idx => idx !== currentIndex);
      
      // Shuffle the remaining indices
      for (let i = filteredIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filteredIndices[i], filteredIndices[j]] = [filteredIndices[j], filteredIndices[i]];
      }
      
      // Put current index at the beginning so playback continues seamlessly
      const finalIndices = currentIndex !== -1 ? [currentIndex, ...filteredIndices] : filteredIndices;
      Promise.resolve().then(() => {
        setShuffledIndices(finalIndices);
        setShuffledCurrentIndex(currentIndex !== -1 ? 0 : -1);
      });
    } else {
      Promise.resolve().then(() => {
        setShuffledIndices([]);
        setShuffledCurrentIndex(-1);
      });
    }
  }, [isShuffle, queue.length, currentIndex]);

  // Refs for 10-second active listening threshold for Recently Played Cloud Sync
  const hasLoggedRecentlyPlayedRef = useRef(false);
  const activeListenTimeRef = useRef(0);
  const lastListenTimeRef = useRef(null);

  // Reset listening threshold when current track changes
  useEffect(() => {
    hasLoggedRecentlyPlayedRef.current = false;
    activeListenTimeRef.current = 0;
    lastListenTimeRef.current = null;
  }, [currentTrack?.id]);

  // Helper to log recently played track to local state + cloud
  const logRecentlyPlayedTrack = (track) => {
    if (!track || !track.id) return;

    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      const updated = [track, ...filtered].slice(0, 12);
      try {
        localStorage.setItem('tunely_recently_played', JSON.stringify(updated));
      } catch {
        /* ignore storage quota */
      }
      return updated;
    });

    if (isLoggedIn && authFetch && !user?.isGuest) {
      authFetch(`${API_BASE}/api/user/recently-played`, {
        method: 'POST',
        body: JSON.stringify({ song: track })
      }).catch(err => {
        console.warn('Failed to sync recently played track:', err?.message || err);
      });
    }
  };

  // Fetch and merge Cloud Recently Played history when logged in
  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn || !authFetch || user?.isGuest) return;

    authFetch(`${API_BASE}/api/user/recently-played`)
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then(data => {
        if (data?.success && Array.isArray(data.data)) {
          const cloudSongs = data.data;
          setRecentlyPlayed(prevLocal => {
            const cloudIds = new Set(cloudSongs.map(s => s.id));
            const filteredLocal = prevLocal.filter(s => s?.id && !cloudIds.has(s.id));
            const merged = [...cloudSongs, ...filteredLocal].slice(0, 12);
            try {
              localStorage.setItem('tunely_recently_played', JSON.stringify(merged));
            } catch {
              /* ignore storage quota */
            }
            return merged;
          });
        }
      })
      .catch(err => {
        console.warn('Failed to fetch recently played cloud history:', err?.message || err);
      });
  }, [isLoggedIn, isLoading, authFetch, user?.isGuest]);

  // Persist Player State to localStorage so song is NEVER lost on tab refresh or background pause
  useEffect(() => {
    if (currentTrack) {
      localStorage.setItem('tunely_current_track', JSON.stringify(currentTrack));
    } else {
      localStorage.removeItem('tunely_current_track');
    }
  }, [currentTrack]);

  useEffect(() => {
    if (queue && queue.length > 0) {
      localStorage.setItem('tunely_queue', JSON.stringify(queue));
    }
  }, [queue]);

  const lastTimePersistRef = useRef(0);

  useEffect(() => {
    if (currentIndex !== -1) {
      try { localStorage.setItem('tunely_current_index', currentIndex.toString()); } catch (e) { /* ignore storage quota */ }
    }
  }, [currentIndex]);

  // Throttled persistence for audio currentTime (once every 2000ms instead of every 250ms)
  useEffect(() => {
    const now = Date.now();
    if (currentTime > 0 && (now - lastTimePersistRef.current >= 2000)) {
      lastTimePersistRef.current = now;
      try {
        localStorage.setItem('tunely_current_time', currentTime.toString());
      } catch (e) {
        // Ignore quota/storage errors
      }
    }
  }, [currentTime]);

  // Flush final currentTime to localStorage on page unload or route exit
  useEffect(() => {
    const handleUnload = () => {
      if (currentTime > 0) {
        try { localStorage.setItem('tunely_current_time', currentTime.toString()); } catch (e) { /* ignore storage error */ }
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [currentTime]);

  // Sleep Timer States & Refs
  const [sleepTimer, setSleepTimer] = useState(null); // value in minutes
  const [sleepTimeLeft, setSleepTimeLeft] = useState(null); // value in seconds
  const sleepTimerRef = useRef(null);
  const lastTimeUpdateRef = useRef(0);

  const [likedSongs, setLikedSongs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tunely_liked_songs') || '[]');
    } catch (e) {
      // Storage unreadable — default to empty array
      return [];
    }
  });
  const [likedSongsMetadata, setLikedSongsMetadata] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tunely_liked_songs_metadata') || '[]');
    } catch (e) {
      // Storage unreadable — default to empty array
      return [];
    }
  });

  // Detect basic audio output device (without requesting mic permissions)
  const detectAudioDevice = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      if (outputs.length === 0) return;
      
      const currentSinkId = audioRef.current?.sinkId || 'default';
      const active = outputs.find(d => d.deviceId === currentSinkId) || outputs[0];
      const label = active?.label || '';
      if (label && label !== 'Default') {
        setAudioOutputDevice(label.replace(/\s*\(.*?\)\s*/g, '').trim() || 'Speaker');
      } else {
        const named = outputs.find(d => d.label && d.label !== 'Default' && d.deviceId !== 'default');
        if (named?.label) setAudioOutputDevice(named.label.replace(/\s*\(.*?\)\s*/g, '').trim() || 'Speaker');
        else setAudioOutputDevice('Speaker');
      }
    } catch { 
      setAudioOutputDevice('Speaker');
    }
  };

  useEffect(() => {
    detectAudioDevice();
    navigator.mediaDevices?.addEventListener?.('devicechange', detectAudioDevice);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', detectAudioDevice);
  }, []);

  // Load liked songs from localStorage on mount
  useEffect(() => {
    // Set CORS headers for audio streams on all devices
    if (audioRef.current) {
      audioRef.current.crossOrigin = "anonymous";
    }
    if (preloadRef.current) {
      preloadRef.current.crossOrigin = "anonymous";
    }
  }, []);

  // React to login/logout changes
  useEffect(() => {
    if (isLoading) return; // Wait for session restore before acting
    if (!isLoggedIn) {
      // ── LOGOUT ─── clear in-memory state so UI shows clean guest view
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setLikedSongs([]);
      setLikedSongsMetadata([]);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      setIsPlaying(false);
      setCurrentTrack(null);
      setQueue([]);
      setCurrentIndex(-1);
      return;
    }

    // ── LOGIN ──── smart sync: compare local vs server timestamps and merge
    if (!isLoggedIn || !token || user?.isGuest || !authFetch) return;
    syncLikedSongs();
  }, [isLoggedIn, isLoading, authFetch, user, token]);

  const syncLikedSongs = async () => {
    if (!isLoggedIn || !token || user?.isGuest || !authFetch) return;
    try {
      const localMeta = JSON.parse(localStorage.getItem('tunely_liked_songs_metadata') || '[]');
      const localUpdatedAt = localStorage.getItem('tunely_liked_songs_updated_at') || new Date(0).toISOString();

      const res = await authFetch(`${API_BASE}/api/user/liked/sync`, {
        method: 'POST',
        body: JSON.stringify({ songs: localMeta, localUpdatedAt })
      });
      if (!res.ok) return;
      const { data } = await res.json();
      const songs = data.songs || [];
      const ids = songs.map(s => s.id);
      setLikedSongs(ids);
      setLikedSongsMetadata(songs);
      localStorage.setItem('tunely_liked_songs', JSON.stringify(ids));
      localStorage.setItem('tunely_liked_songs_metadata', JSON.stringify(songs));
      localStorage.setItem('tunely_liked_songs_updated_at', data.serverUpdatedAt || new Date().toISOString());
    } catch (e) {
      console.warn('Liked songs sync failed:', e);
    }
  };

  // Live Sync / Periodic Polling for Liked Songs
  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn || !authFetch || user?.isGuest) return;

    let intervalId;

    const performLikedSongsSync = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const localMeta = JSON.parse(localStorage.getItem('tunely_liked_songs_metadata') || '[]');
        const localUpdatedAt = localStorage.getItem('tunely_liked_songs_updated_at') || new Date(0).toISOString();

        const res = await authFetch(`${API_BASE}/api/user/liked/sync`, {
          method: 'POST',
          body: JSON.stringify({ songs: localMeta, localUpdatedAt })
        });
        if (!res.ok) return;
        const { data } = await res.json();
        if (data) {
          const songs = data.songs || [];
          const ids = songs.map(s => s.id);
          
          // Check if there's an actual difference to avoid unnecessary state updates
          const storedIds = JSON.parse(localStorage.getItem('tunely_liked_songs') || '[]');
          const isSame = storedIds.length === ids.length && storedIds.every((id, idx) => id === ids[idx]);
          
          if (!isSame || data.source === 'server') {
            setLikedSongs(ids);
            setLikedSongsMetadata(songs);
            localStorage.setItem('tunely_liked_songs', JSON.stringify(ids));
            localStorage.setItem('tunely_liked_songs_metadata', JSON.stringify(songs));
            localStorage.setItem('tunely_liked_songs_updated_at', data.serverUpdatedAt || new Date().toISOString());
          } else if (data.source === 'local' && data.serverUpdatedAt) {
            localStorage.setItem('tunely_liked_songs_updated_at', data.serverUpdatedAt);
          }
        }
      } catch (e) {
        console.warn('Liked songs live sync failed:', e);
      }
    };

    // Perform liked songs sync on visibility change (polling loop removed for ultra-lean background health)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performLikedSongsSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, isLoading, authFetch, user?.isGuest]);

  // Real-time cross-device liked songs synchronization & reconciliation
  useRealtimeSync({
    isLoggedIn,
    user,
    authFetch,
    syncLikedSongs,
    setLikedSongs,
    setLikedSongsMetadata
  });

  const toggleLikeTrack = async (track) => {
    if (!track) return;
    
    const isAlreadyLiked = likedSongs.includes(track.id);

    let updatedIds;
    let updatedMeta;

    if (isAlreadyLiked) {
      updatedIds = likedSongs.filter(id => id !== track.id);
      updatedMeta = likedSongsMetadata.filter(t => t.id !== track.id);
    } else {
      updatedIds = [track.id, ...likedSongs.filter(id => id !== track.id)];
      updatedMeta = [track, ...likedSongsMetadata.filter(t => t.id !== track.id)];
    }

    const now = new Date().toISOString();
    setLikedSongs(updatedIds);
    setLikedSongsMetadata(updatedMeta);
    localStorage.setItem('tunely_liked_songs', JSON.stringify(updatedIds));
    localStorage.setItem('tunely_liked_songs_metadata', JSON.stringify(updatedMeta));
    localStorage.setItem('tunely_liked_songs_updated_at', now);

    // Sync to cloud if logged in (and not guest)
    if (isLoggedIn && authFetch && !user?.isGuest) {
      try {
        if (isAlreadyLiked) {
          await authFetch(`${API_BASE}/api/user/liked/${track.id}`, { method: 'DELETE' });
        } else {
          await authFetch(`${API_BASE}/api/user/liked`, {
            method: 'POST',
            body: JSON.stringify({ song: track })
          });
        }
      } catch (e) {
        console.warn('Failed to sync liked track to cloud:', e);
      }
    }
  };

  const initWebAudio = () => {
    // Strictly bypass Web Audio on mobile to avoid background audio mute bugs on iOS/Android
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      return;
    }

    // Prevent double initialization
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();

      // Create a premium 3-band parametric enhancer with preamp headroom
      const preamp = ctx.createGain();
      preamp.gain.value = 0.7; // -3dB preamp attenuation to prevent clipping/distortion

      // 1. Warm Sub-Bass/Punch (80 Hz, peaking, +1.5dB)
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'peaking';
      bassFilter.frequency.value = 80;
      bassFilter.Q.value = 0.8;
      bassFilter.gain.value = 1.5;

      // 2. Crystal Vocal Presence (3000 Hz, peaking, +1.0dB)
      const presenceFilter = ctx.createBiquadFilter();
      presenceFilter.type = 'peaking';
      presenceFilter.frequency.value = 3000;
      presenceFilter.Q.value = 1.0;
      presenceFilter.gain.value = 1.0;

      // 3. High-End Studio Air/Sparkle (15000 Hz, highshelf, +1.5dB)
      const airFilter = ctx.createBiquadFilter();
      airFilter.type = 'highshelf';
      airFilter.frequency.value = 15000;
      airFilter.gain.value = 1.5;

      // 4. Soft Limiter to prevent clipping and glue the sound
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-1.5, ctx.currentTime); // Limit peaks at -1.5dB
      compressor.knee.setValueAtTime(30, ctx.currentTime);
      compressor.ratio.setValueAtTime(12.0, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.08, ctx.currentTime);

      const source = ctx.createMediaElementSource(audioRef.current);

      // Connect: source -> preamp -> bass -> presence -> air -> compressor -> speakers
      source.connect(preamp);
      preamp.connect(bassFilter);
      bassFilter.connect(presenceFilter);
      presenceFilter.connect(airFilter);
      airFilter.connect(compressor);
      compressor.connect(ctx.destination);

      sourceNodeRef.current = source;
      audioContextRef.current = ctx;
      console.log("Tunely Hi-Fi Enhancer: Web Audio dynamic processing active on Desktop (clipping prevention enabled).");
    } catch (e) {
      console.warn("Failed to initialize desktop Web Audio enhancer:", e);
    }
  };

  const getStreamUrlByQuality = (track, quality) => {
    let activeQuality = quality;
    if (!track || !track.downloadUrl || track.downloadUrl.length === 0) return null;
    const target = track.downloadUrl.find(item => item.quality === activeQuality);
    if (target) return target.url;

    // Fallbacks if target quality is not available
    if (activeQuality === '320kbps') {
      const backup160 = track.downloadUrl.find(item => item.quality === '160kbps');
      if (backup160) return backup160.url;
    }
    if (activeQuality === '160kbps' || activeQuality === '320kbps') {
      const backup96 = track.downloadUrl.find(item => item.quality === '96kbps');
      if (backup96) return backup96.url;
    }
    return track.downloadUrl[track.downloadUrl.length - 1]?.url;
  };

  const setAudioQuality = (quality) => {
    setAudioQualityState(quality);
    localStorage.setItem('tunely_audio_quality', quality);
    
    // Switch live track stream quality if playing
    if (currentTrack && audioRef.current) {
      const streamUrl = getStreamUrlByQuality(currentTrack, quality);
      if (streamUrl && audioRef.current.src !== streamUrl) {
        const wasPlaying = isPlaying;
        const savedTime = audioRef.current.currentTime;
        
        initWebAudio();
        audioRef.current.src = streamUrl;
        audioRef.current.load();
        audioRef.current.currentTime = savedTime;
        
        if (wasPlaying) {
          audioRef.current.play().catch(e => console.error("Error switching quality stream playback:", e));
        }
      }
    }
  };



  // 1. Core Functions

  // Function to fetch track lyrics (with fallback)
  const fetchLyrics = async (trackId, artistName = '', trackName = '') => {
    setIsLoadingLyrics(true);
    
    // Check local fallback first for instant loading on popular tracks
    if (LYRICS_FALLBACK[trackId]) {
      setLyrics(LYRICS_FALLBACK[trackId]);
      setIsLoadingLyrics(false);
      return;
    }

    setLyrics(null);

    try {
      // 1. Try JioSaavn song details first
      const response = await fetch(`${API_BASE}/api/songs/${trackId}`);
      if (response.ok) {
        const resObj = await response.json();
        const songData = Array.isArray(resObj?.data) ? resObj.data[0] : resObj?.data;
        const lyricsText = songData?.lyrics || songData?.lyrics_snippet || songData?.hasLyrics === 'true' ? songData?.lyrics : null;
        if (lyricsText) {
          setLyrics(lyricsText);
          setIsLoadingLyrics(false);
          return;
        }
      }

      // 2. Fallback to free public lyrics API (lyrics.ovh)
      if (artistName && trackName) {
        const titleClean = trackName
          .replace(/\(From.*?\)/gi, '')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, '&')
          .trim();
        
        try {
          const fallbackRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(titleClean)}`);
          if (fallbackRes.ok) {
            const fallbackObj = await fallbackRes.json();
            if (fallbackObj.lyrics) {
              setLyrics(fallbackObj.lyrics);
              setIsLoadingLyrics(false);
              return;
            }
          }
        } catch (e) {
          // Ignore lyrics.ovh 404/network errors - fallback to standard message
        }
      }

      // 3. Ultimate graceful fallback
      setLyrics(`🎵 Sing along! No lyrics found for this song.\nEnjoy the music on Tunely! 🎵`);
    } catch {
      setLyrics(`🎵 Sing along! No lyrics found for this song.\nEnjoy the music on Tunely! 🎵`);
    } finally {
      setIsLoadingLyrics(false);
    }
  };

  // Computes the next track index based on shuffle and loop mode
  const getNextIndex = () => {
    if (queue.length === 0) return -1;
    
    if (isShuffle && shuffledIndices.length > 0) {
      const nextShuffledIdx = shuffledCurrentIndex + 1;
      if (nextShuffledIdx < shuffledIndices.length) {
        return shuffledIndices[nextShuffledIdx];
      } else if (loopMode === 'all') {
        return shuffledIndices[0];
      }
      return -1;
    }
    
    const nextIdx = currentIndex + 1;
    if (nextIdx < queue.length) {
      return nextIdx;
    } else if (loopMode === 'all') {
      return 0;
    }
    
    return -1;
  };

  // Computes the previous track index
  const getPrevIndex = () => {
    if (queue.length === 0) return -1;
    
    if (isShuffle && shuffledIndices.length > 0) {
      const prevShuffledIdx = shuffledCurrentIndex - 1;
      if (prevShuffledIdx >= 0) {
        return shuffledIndices[prevShuffledIdx];
      } else if (loopMode === 'all') {
        return shuffledIndices[shuffledIndices.length - 1];
      }
      return -1;
    }
    
    const prevIdx = currentIndex - 1;
    if (prevIdx >= 0) {
      return prevIdx;
    } else if (loopMode === 'all') {
      return queue.length - 1;
    }
    
    return -1;
  };

  // Preloads the next track into cache
  const preloadNextTrack = () => {
    const nextIdx = getNextIndex();
    if (nextIdx !== -1 && queue[nextIdx]) {
      const nextSong = queue[nextIdx];
      const streamUrl = getStreamUrlByQuality(nextSong, audioQuality);
      if (streamUrl && preloadRef.current.src !== streamUrl) {
        preloadRef.current.src = streamUrl;
        preloadRef.current.preload = "auto";
        preloadRef.current.load();
      }
    }
  };

  // Smooth Volume Fade In
  const fadeInVolume = () => {
    clearInterval(fadeIntervalRef.current);
    const targetVol = volumeRef.current;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (document.hidden || isMobile) {
      if (audioRef.current) {
        audioRef.current.volume = targetVol;
      }
      return;
    }
    audioRef.current.volume = 0;
    let currentVol = 0;
    fadeIntervalRef.current = setInterval(() => {
      if (currentVol < targetVol) {
        currentVol = Math.min(targetVol, currentVol + 0.05);
        audioRef.current.volume = currentVol;
      } else {
        clearInterval(fadeIntervalRef.current);
        audioRef.current.volume = targetVol;
      }
    }, 30);
  };

  // Smooth Volume Fade Out
  const fadeOutVolume = (callback) => {
    clearInterval(fadeIntervalRef.current);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (document.hidden || isMobile) {
      if (audioRef.current) {
        audioRef.current.volume = 0;
      }
      callback();
      return;
    }
    let currentVol = audioRef.current.volume;
    if (currentVol === 0) {
      callback();
      return;
    }
    fadeIntervalRef.current = setInterval(() => {
      if (currentVol > 0) {
        currentVol = Math.max(0, currentVol - 0.1);
        audioRef.current.volume = currentVol;
      } else {
        clearInterval(fadeIntervalRef.current);
        callback();
      }
    }, 20);
  };

  // Auto-resumes playback after call interruption or system audio focus return
  const resumePlaybackAfterInterruption = async () => {
    if (!wasPlayingBeforeInterruptionRef.current || !currentTrack) return;

    userInitiatedPauseRef.current = false;
    let attempts = 0;
    const maxAttempts = 6;

    const attemptPlay = async () => {
      attempts++;
      // 1. Resume Web Audio context if suspended by OS during phone call
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch (e) {
          console.warn("Failed to resume Web Audio context after call:", e);
        }
      }

      const audio = audioRef.current;
      if (!audio) return false;

      // 2. Check if stream connection stalled or errored during call
      if (audio.error || !audio.src || audio.readyState === 0) {
        const streamUrl = getStreamUrlByQuality(currentTrack, audioQuality);
        if (streamUrl) {
          const savedTime = audio.currentTime || currentTime;
          audio.src = streamUrl;
          audio.load();
          audio.currentTime = savedTime;
        }
      }

      try {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          wasPlayingBeforeInterruptionRef.current = false;
          isSystemInterruptedRef.current = false;
          fadeInVolume();
          console.log(`Audio playback successfully auto-resumed after call (attempt ${attempts}).`);
          return true;
        }
      } catch (err) {
        console.warn(`Call recovery play attempt ${attempts} rejected (OS audio focus in transition):`, err);
        return false;
      }
      return false;
    };

    // Immediate attempt
    const success = await attemptPlay();
    if (success) return;

    // Retry loop every 400ms while OS releases audio focus after phone call
    const retryInterval = setInterval(async () => {
      if (attempts >= maxAttempts || !wasPlayingBeforeInterruptionRef.current) {
        clearInterval(retryInterval);
        return;
      }
      const res = await attemptPlay();
      if (res) {
        clearInterval(retryInterval);
      }
    }, 400);

    // Fallback: Also register one-time interaction listeners so playback resumes instantly on first screen touch
    const handleFirstTouch = () => {
      window.removeEventListener('pointerdown', handleFirstTouch);
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('click', handleFirstTouch);
      
      if (wasPlayingBeforeInterruptionRef.current) {
        attemptPlay();
      }
    };

    window.addEventListener('pointerdown', handleFirstTouch, { once: true });
    window.addEventListener('touchstart', handleFirstTouch, { once: true });
    window.addEventListener('click', handleFirstTouch, { once: true });
  };

  // Handles playing a track at a specific index in the queue
  const playTrackAtIndex = async (index) => {
    userInitiatedPauseRef.current = false;
    wasPlayingBeforeInterruptionRef.current = false;
    isSystemInterruptedRef.current = false;
    if (index < 0 || index >= queue.length) return;
    
    const track = queue[index];
    setCurrentIndex(index);
    if (isShuffle && shuffledIndices.length > 0) {
      const shuffledPos = shuffledIndices.indexOf(index);
      if (shuffledPos !== -1) {
        setShuffledCurrentIndex(shuffledPos);
      }
    }
    setCurrentTrack(track);
    setIsLoadingTrack(true);

    const streamUrl = getStreamUrlByQuality(track, audioQuality);
    if (!streamUrl) {
      console.error("No valid stream URL found for track", track);
      setIsLoadingTrack(false);
      return;
    }

    try {
      initWebAudio();
      // Fade volume down before changing source
      fadeOutVolume(() => {
        audioRef.current.src = streamUrl;
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              fadeInVolume();
            })
            .catch(error => {
              console.error("Playback failed", error);
              setIsPlaying(false);
              setIsLoadingTrack(false);
            });
        }
      });
    } catch (error) {
      console.error(error);
      setIsLoadingTrack(false);
    }
  };

  const handleSongEnded = () => {
    if (loopMode === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error(e));
    } else {
      const nextIdx = getNextIndex();
      if (nextIdx !== -1) {
        playTrackAtIndex(nextIdx);
      } else {
        setIsPlaying(false);
      }
    }
  };

  // Public Methods
  const playTrack = (track, newQueue = []) => {
    userInitiatedPauseRef.current = false;
    wasPlayingBeforeInterruptionRef.current = false;
    isSystemInterruptedRef.current = false;
    // If double clicking the same track, toggle play
    if (currentTrack && currentTrack.id === track.id) {
      togglePlay();
      return;
    }

    let updatedQueue = [...queue];
    let newIndex;

    if (newQueue.length > 0) {
      userQueuedCountRef.current = 0;
      updatedQueue = newQueue;
      newIndex = updatedQueue.findIndex(t => t.id === track.id);
    } else {
      // Check if track is in the queue
      const existingIndex = updatedQueue.findIndex(t => t.id === track.id);
      if (existingIndex !== -1) {
        newIndex = existingIndex;
      } else {
        // Insert track after current index
        const insertPos = currentIndex === -1 ? 0 : currentIndex + 1;
        updatedQueue.splice(insertPos, 0, track);
        newIndex = insertPos;
      }
    }

    setQueue(updatedQueue);
    setCurrentIndex(newIndex);
    setCurrentTrack(track);
    
    const streamUrl = getStreamUrlByQuality(track, audioQuality);
    if (streamUrl) {
      initWebAudio();
      fadeOutVolume(() => {
        audioRef.current.src = streamUrl;
        audioRef.current.load();
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            fadeInVolume();
          })
          .catch(err => {
            console.error("Autoplay/playback error", err);
            setIsPlaying(false);
          });
      });
    }
  };

  const togglePlay = () => {
    if (!currentTrack) return;
    
    if (isPlaying) {
      userInitiatedPauseRef.current = true;
      wasPlayingBeforeInterruptionRef.current = false;
      isSystemInterruptedRef.current = false;
      fadeOutVolume(() => {
        audioRef.current.pause();
        setIsPlaying(false);
      });
    } else {
      userInitiatedPauseRef.current = false;
      wasPlayingBeforeInterruptionRef.current = false;
      isSystemInterruptedRef.current = false;
      initWebAudio();
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          fadeInVolume();
        })
        .catch(err => console.error(err));
    }
  };

  const nextTrack = () => {
    if (userQueuedCountRef.current > 0) {
      userQueuedCountRef.current -= 1;
    }
    const nextIdx = getNextIndex();
    if (nextIdx !== -1) {
      playTrackAtIndex(nextIdx);
    }
  };

  const prevTrack = () => {
    // Restart song if played more than 3 seconds
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const prevIdx = getPrevIndex();
    if (prevIdx !== -1) {
      playTrackAtIndex(prevIdx);
    }
  };

  const setTrackTime = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      lastListenTimeRef.current = null;
    }
  };

  const setTrackVolume = (vol) => {
    const newVol = Math.max(0, Math.min(1, vol));
    setVolume(newVol);
  };

  const toggleLoop = () => {
    setLoopMode(prev => {
      if (prev === 'none') return 'all';
      if (prev === 'all') return 'one';
      return 'none';
    });
  };

  const toggleShuffle = () => {
    setIsShuffle(prev => !prev);
  };

  const addToQueue = (track) => {
    setQueue(prev => {
      const updated = [...prev];
      const basePos = currentIndex === -1 ? 0 : currentIndex + 1;
      const insertPos = Math.min(updated.length, basePos + userQueuedCountRef.current);
      updated.splice(insertPos, 0, track);
      return updated;
    });
    userQueuedCountRef.current += 1;
  };

  const removeFromQueue = (index) => {
    if (index === currentIndex) {
      // If removing playing track, play next
      nextTrack();
    }
    
    setQueue(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      // Adjust playing index
      if (index < currentIndex) {
        setCurrentIndex(prevIndex => prevIndex - 1);
      }
      return updated;
    });
  };

  const reorderQueue = (index, direction) => {
    setQueue(prev => {
      const updated = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < updated.length) {
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;
      }
      return updated;
    });

    if (index === currentIndex) {
      setCurrentIndex(direction === 'up' ? currentIndex - 1 : currentIndex + 1);
    } else if (direction === 'up' && index - 1 === currentIndex) {
      setCurrentIndex(index);
    } else if (direction === 'down' && index + 1 === currentIndex) {
      setCurrentIndex(index);
    }
  };

  const playQueueTrack = (index) => {
    playTrackAtIndex(index);
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentIndex(-1);
    setCurrentTrack(null);
    setIsPlaying(false);
    audioRef.current.src = "";
  };

  // 2. React Hooks / Effects (Placed at the bottom to solve hoisting checks)

  // Initialize audio parameters
  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      const now = audio.currentTime;
      // Throttle React state updates to 250ms interval to eliminate 60 FPS re-render UI freezing
      if (Math.abs(now - lastTimeUpdateRef.current) >= 0.25 || now === 0) {
        lastTimeUpdateRef.current = now;
        setCurrentTime(now);
      }

      // 10-Second Active Listening Threshold Accumulator for Recently Played Cloud Sync
      if (currentTrack && !hasLoggedRecentlyPlayedRef.current) {
        if (lastListenTimeRef.current !== null) {
          const delta = now - lastListenTimeRef.current;
          // Accumulate delta only during continuous playback (ignore negative jumps or seek jumps > 2s)
          if (delta > 0 && delta < 2.0) {
            activeListenTimeRef.current += delta;
          }
        }
        lastListenTimeRef.current = now;

        if (activeListenTimeRef.current >= 10) {
          hasLoggedRecentlyPlayedRef.current = true;
          logRecentlyPlayedTrack(currentTrack);
        }
      }
      
      // Gapless preloader logic:
      // When the current song reaches 90% completion and we have a next song, preload its media chunks once
      if (audio.duration && (now / audio.duration > 0.90)) {
        if (hasPreloadedRef.current !== currentTrack?.id) {
          preloadNextTrack();
          hasPreloadedRef.current = currentTrack?.id;
        }
      }
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      handleSongEnded();
    };

    const handleLoadStart = () => {
      setIsLoadingTrack(true);
    };

    const handleCanPlay = () => {
      setIsLoadingTrack(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      lastListenTimeRef.current = null;
      userInitiatedPauseRef.current = false;
      wasPlayingBeforeInterruptionRef.current = false;
      isSystemInterruptedRef.current = false;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
      fadeInVolume();
    };

    const handlePause = () => {
      setIsPlaying(false);
      lastListenTimeRef.current = null;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
      clearInterval(fadeIntervalRef.current);

      // If paused by system/call interruption rather than explicit user pause click:
      if (!userInitiatedPauseRef.current) {
        wasPlayingBeforeInterruptionRef.current = true;
        isSystemInterruptedRef.current = true;
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, currentIndex, loopMode, isShuffle]);

  // Auto-resume playback when call ends / app regains focus or visibility
  useEffect(() => {
    const handleVisibilityOrFocusChange = () => {
      if (document.visibilityState === 'visible') {
        if (wasPlayingBeforeInterruptionRef.current && currentTrack) {
          resumePlaybackAfterInterruption();
        }
      } else if (document.visibilityState === 'hidden') {
        if (isPlaying && !userInitiatedPauseRef.current) {
          wasPlayingBeforeInterruptionRef.current = true;
          isSystemInterruptedRef.current = true;
        }
      }
    };

    const handleWindowFocus = () => {
      if (wasPlayingBeforeInterruptionRef.current && currentTrack) {
        resumePlaybackAfterInterruption();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocusChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocusChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handleWindowFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, isPlaying, audioQuality]);

  // Adjust volume smoothly
  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Log user activity (current playing track, device, state) to server for live admin dashboard
  useEffect(() => {
    if (!isLoggedIn || !authFetch || user?.isGuest || isLoading) return;

    let intervalId;
    const sendActivity = async () => {
      try {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        // Use detected audio output device label, fall back to platform type
        const deviceLabel = audioOutputDevice && audioOutputDevice !== 'Speaker'
          ? audioOutputDevice
          : isMobile ? 'Mobile' : 'Desktop Browser';
        await authFetch(`${API_BASE}/api/user/activity`, {
          method: 'POST',
          body: JSON.stringify({
            track: currentTrack ? {
              id: currentTrack.id,
              name: currentTrack.name,
              artists: currentTrack.artists,
              image: currentTrack.image,
              album: currentTrack.album
            } : null,
            isPlaying,
            progress: audioRef.current ? Math.floor(audioRef.current.currentTime) : 0,
            device: deviceLabel
          })
        });
      } catch {
        // ignore activity failures
      }
    };

    // Skip logging activity for guests entirely to save KV writes
    if (user?.isGuest) return;

    // Send immediately on change
    sendActivity();

    // Setup periodic activity pings every 60 seconds while playing music for live admin status
    if (isPlaying) {
      intervalId = setInterval(sendActivity, 60000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentTrack, isPlaying, isLoggedIn, authFetch, user, isLoading, audioOutputDevice]);


  // Sync lyrics when currentTrack changes
  useEffect(() => {
    if (currentTrack) {
      const primaryArtist = currentTrack.artists?.primary?.[0]?.name || '';
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      fetchLyrics(currentTrack.id, primaryArtist, currentTrack.name);
    } else {
      setLyrics(null);
    }
  }, [currentTrack]);

  // Sync Media Session API metadata & playback state
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      const title = currentTrack.name ? currentTrack.name.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&') : "Unknown Track";
      const artist = currentTrack.artists?.primary?.[0]?.name || currentTrack.subtitle || "Unknown Artist";
      const album = currentTrack.album?.name || "Tunely";
      
      const artwork = currentTrack.image ? currentTrack.image.map(img => ({
        src: img.url,
        sizes: img.quality || '500x500',
        type: 'image/jpeg'
      })) : [
        { src: '/logo.png', sizes: '512x512', type: 'image/png' }
      ];

      navigator.mediaSession.metadata = new window.MediaMetadata({
        title,
        artist,
        album,
        artwork
      });
    } catch (e) {
      console.warn("Failed to set Media Session metadata:", e);
    }

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    // Sync position state so lock screen, screensaver, and bluetooth controls render scrub bar & controls
    if ('setPositionState' in navigator.mediaSession && duration > 0 && !isNaN(duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: audioRef.current ? audioRef.current.playbackRate || 1 : 1,
          position: Math.min(currentTime, duration)
        });
      } catch (e) {
        // ignore position state sync warnings
      }
    }
  }, [currentTrack, isPlaying, duration, currentTime]);

  const currentTrackRef = useRef(currentTrack);
  const audioQualityRef = useRef(audioQuality);
  const currentTimeRef = useRef(currentTime);
  const nextTrackRef = useRef(nextTrack);
  const prevTrackRef = useRef(prevTrack);
  const setTrackTimeRef = useRef(setTrackTime);

  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { audioQualityRef.current = audioQuality; }, [audioQuality]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { nextTrackRef.current = nextTrack; }, [nextTrack]);
  useEffect(() => { prevTrackRef.current = prevTrack; }, [prevTrack]);
  useEffect(() => { setTrackTimeRef.current = setTrackTime; }, [setTrackTime]);

  // Handle Media Session Action Handlers (Registered ONCE on mount for rock-solid iOS stability)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handleMediaPlay = async () => {
      userInitiatedPauseRef.current = false;
      wasPlayingBeforeInterruptionRef.current = false;
      isSystemInterruptedRef.current = false;

      const audio = audioRef.current;
      if (!audio) return;

      audio.volume = volumeRef.current;

      // Check if media element is already in an explicitly invalid/stalled state prior to play
      const isStalledOrInvalid = audio.error || !audio.src || audio.readyState === 0 || audio.networkState === 3;

      if (!isStalledOrInvalid) {
        try {
          await audio.play();
          setIsPlaying(true);
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
          return;
        } catch (initialErr) {
          console.warn("Direct MediaSession play attempt failed (possible background stream stall):", initialErr, {
            readyState: audio.readyState,
            networkState: audio.networkState,
            error: audio.error
          });
        }
      }

      // ── RECOVERY PATH: Re-connect stream URL for long-pause / background stream recovery ──
      const streamUrl = getStreamUrlByQuality(currentTrackRef.current, audioQualityRef.current);
      if (streamUrl) {
        const savedTime = currentTimeRef.current || audio.currentTime || 0;
        console.log("Executing background MediaSession stream recovery to position:", savedTime);
        audio.src = streamUrl;
        audio.load();

        // Wait safely for metadata before restoring currentTime to prevent WebKit InvalidStateError
        await new Promise((resolve) => {
          let resolved = false;
          const restoreTime = () => {
            if (resolved) return;
            resolved = true;
            audio.removeEventListener('loadedmetadata', restoreTime);
            audio.removeEventListener('canplay', restoreTime);
            try {
              const dur = audio.duration && !isNaN(audio.duration) ? audio.duration : savedTime;
              audio.currentTime = Math.min(savedTime, dur);
            } catch (e) {
              console.warn("Failed to set currentTime on metadata:", e);
            }
            resolve();
          };

          if (audio.readyState >= 1) {
            restoreTime();
          } else {
            audio.addEventListener('loadedmetadata', restoreTime, { once: true });
            audio.addEventListener('canplay', restoreTime, { once: true });
            setTimeout(restoreTime, 1200);
          }
        });

        audio.volume = volumeRef.current;
        try {
          await audio.play();
          setIsPlaying(true);
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
        } catch (recoveryErr) {
          console.error("MediaSession stream recovery play failed:", recoveryErr);
          setIsPlaying(false);
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "paused";
          }
        }
      } else {
        setIsPlaying(false);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = "paused";
        }
      }
    };

    const handleMediaPause = () => {
      userInitiatedPauseRef.current = true;
      wasPlayingBeforeInterruptionRef.current = false;
      isSystemInterruptedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = "paused";
        }
      }
    };

    const actionHandlers = [
      ['play', handleMediaPlay],
      ['pause', handleMediaPause],
      ['previoustrack', () => prevTrackRef.current && prevTrackRef.current()],
      ['nexttrack', () => nextTrackRef.current && nextTrackRef.current()],
      ['seekto', (details) => {
        if (details.fastSeek && audioRef.current?.fastSeek) {
          audioRef.current.fastSeek(details.seekTime);
        } else if (setTrackTimeRef.current) {
          setTrackTimeRef.current(details.seekTime);
        }
      }]
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        console.warn(`Media Session action "${action}" not supported:`, error);
      }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sleep Timer countdown logic (placed at the bottom to ensure fadeOutVolume is declared)
  useEffect(() => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    if (sleepTimer === null) {
      if (sleepTimeLeft !== null) {
        Promise.resolve().then(() => {
          setSleepTimeLeft(null);
        });
      }
      return;
    }

    const totalSeconds = sleepTimer * 60;
    Promise.resolve().then(() => {
      setSleepTimeLeft(totalSeconds);
    });

    const interval = setInterval(() => {
      setSleepTimeLeft(prev => {
        if (prev === null) {
          clearInterval(interval);
          return null;
        }
        if (prev <= 1) {
          clearInterval(interval);
          setSleepTimer(null);
          fadeOutVolume(() => {
            audioRef.current.pause();
            setIsPlaying(false);
            audioRef.current.volume = volumeRef.current;
          });
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    sleepTimerRef.current = interval;

    return () => {
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepTimer]);

  const parsedLyrics = useMemo(() => {
    return parseLyrics(lyrics, duration);
  }, [lyrics, duration]);

  const currentLyric = useMemo(() => {
    if (parsedLyrics.length === 0) return '';
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time <= currentTime) {
        activeIdx = i;
      } else {
        break;
      }
    }
    // Filter out standard placeholders or instructions
    const activeText = activeIdx !== -1 ? parsedLyrics[activeIdx].text : '';
    if (activeText.includes('[Instrumental]') || activeText.includes('(Lyrics not available')) {
      return '';
    }
    return activeText;
  }, [parsedLyrics, currentTime]);

  const contextValue = useMemo(() => ({
    isPlaying,
    currentTrack,
    currentTime,
    duration,
    volume,
    queue,
    currentIndex,
    loopMode,
    isShuffle,
    isQueueVisible,
    isLyricsVisible,
    lyrics,
    isLoadingLyrics,
    isLoadingTrack,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    setTrackTime,
    setTrackVolume,
    toggleLoop,
    toggleShuffle,
    setIsQueueVisible,
    setIsLyricsVisible,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    playQueueTrack,
    clearQueue,
    audioQuality,
    setAudioQuality,
    sleepTimer,
    setSleepTimer,
    sleepTimeLeft,
    likedSongs,
    likedSongsMetadata,
    toggleLikeTrack,
    recentlyPlayed,
    audioOutputDevice,
    currentLyric
  }), [
    isPlaying, currentTrack, currentTime, duration, volume, queue, currentIndex,
    loopMode, isShuffle, isQueueVisible, isLyricsVisible, lyrics, isLoadingLyrics,
    isLoadingTrack, playTrack, togglePlay, nextTrack, prevTrack, setTrackTime,
    setTrackVolume, toggleLoop, toggleShuffle, setIsQueueVisible, setIsLyricsVisible,
    addToQueue, removeFromQueue, reorderQueue, playQueueTrack, clearQueue,
    audioQuality, setAudioQuality, sleepTimer, setSleepTimer, sleepTimeLeft,
    likedSongs, likedSongsMetadata, toggleLikeTrack, recentlyPlayed, audioOutputDevice, currentLyric
  ]);

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};
