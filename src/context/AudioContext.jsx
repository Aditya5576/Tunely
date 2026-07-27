/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { parseLyrics } from '../utils/lyrics';

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
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
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

  // Effect to record recently played tracks automatically when current track changes
  useEffect(() => {
    if (currentTrack) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setRecentlyPlayed(prev => {
        const filtered = prev.filter(t => t.id !== currentTrack.id);
        const updated = [currentTrack, ...filtered].slice(0, 12);
        localStorage.setItem('tunely_recently_played', JSON.stringify(updated));
        return updated;
      });
    }
  }, [currentTrack]);

  // Sleep Timer States & Refs
  const [sleepTimer, setSleepTimer] = useState(null); // value in minutes
  const [sleepTimeLeft, setSleepTimeLeft] = useState(null); // value in seconds
  const sleepTimerRef = useRef(null);

  const [likedSongs, setLikedSongs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tunely_liked_songs') || '[]');
    } catch {
      return [];
    }
  });
  const [likedSongsMetadata, setLikedSongsMetadata] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tunely_liked_songs_metadata') || '[]');
    } catch {
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

    const syncLikedSongs = async () => {
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

    syncLikedSongs();
  }, [isLoggedIn, isLoading, authFetch, user]);

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

    // Poll every 30 seconds
    intervalId = setInterval(performLikedSongsSync, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performLikedSongsSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, isLoading, authFetch, user?.isGuest]);

  const toggleLikeTrack = async (track) => {
    if (!track) return;
    
    const isAlreadyLiked = likedSongs.includes(track.id);

    let updatedIds;
    let updatedMeta;

    if (isAlreadyLiked) {
      updatedIds = likedSongs.filter(id => id !== track.id);
      updatedMeta = likedSongsMetadata.filter(t => t.id !== track.id);
    } else {
      updatedIds = [...likedSongs, track.id];
      updatedMeta = [...likedSongsMetadata, track];
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
      // 1. Try JioSaavn lyrics first
      const response = await fetch(`${API_BASE}/api/songs/${trackId}/lyrics`);
      if (response.ok) {
        const resObj = await response.json();
        if (resObj.success && resObj.data && resObj.data.lyrics) {
          setLyrics(resObj.data.lyrics);
          setIsLoadingLyrics(false);
          return;
        }
      }

      // 2. Fallback to free public lyrics API (lyrics.ovh)
      if (artistName && trackName) {
        // Clean title (remove "From...", "Feat...", etc.)
        const titleClean = trackName
          .replace(/\(From.*?\)/gi, '')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, '&')
          .trim();
        
        const fallbackRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(titleClean)}`);
        if (fallbackRes.ok) {
          const fallbackObj = await fallbackRes.json();
          if (fallbackObj.lyrics) {
            setLyrics(fallbackObj.lyrics);
            setIsLoadingLyrics(false);
            return;
          }
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
        setShuffledCurrentIndex(nextShuffledIdx);
        return shuffledIndices[nextShuffledIdx];
      } else if (loopMode === 'all') {
        // Re-shuffle for next loop
        const indices = Array.from({ length: queue.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        setShuffledIndices(indices);
        setShuffledCurrentIndex(0);
        return indices[0];
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
        setShuffledCurrentIndex(prevShuffledIdx);
        return shuffledIndices[prevShuffledIdx];
      } else if (loopMode === 'all') {
        setShuffledCurrentIndex(shuffledIndices.length - 1);
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
    if (document.hidden) {
      audioRef.current.volume = targetVol;
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
    if (document.hidden) {
      audioRef.current.volume = 0;
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

  // Handles playing a track at a specific index in the queue
  const playTrackAtIndex = async (index) => {
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
    // If double clicking the same track, toggle play
    if (currentTrack && currentTrack.id === track.id) {
      togglePlay();
      return;
    }

    let updatedQueue = [...queue];
    let newIndex;

    if (newQueue.length > 0) {
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
      fadeOutVolume(() => {
        audioRef.current.pause();
        setIsPlaying(false);
      });
    } else {
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
      const insertPos = currentIndex === -1 ? 0 : currentIndex + 1;
      updated.splice(insertPos, 0, track);
      return updated;
    });
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
      setCurrentTime(audio.currentTime);
      
      // Gapless preloader logic:
      // When the current song reaches 90% completion and we have a next song, preload its media chunks once
      if (audio.duration && (audio.currentTime / audio.duration > 0.90)) {
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
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
      fadeInVolume();
    };

    const handlePause = () => {
      setIsPlaying(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
      clearInterval(fadeIntervalRef.current);
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

    // Setup periodic updates every 3 minutes (180,000ms) if playing to save KV writes
    if (isPlaying) {
      intervalId = setInterval(sendActivity, 180000);
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
  }, [currentTrack, isPlaying]);

  // Handle Media Session Action Handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers = [
      ['play', () => {
        initWebAudio();
        audioRef.current.play().catch(e => console.error("MediaSession play failed:", e));
      }],
      ['pause', () => {
        audioRef.current.pause();
      }],
      ['previoustrack', prevTrack],
      ['nexttrack', nextTrack],
      ['seekto', (details) => {
        if (details.fastSeek && audioRef.current.fastSeek) {
          audioRef.current.fastSeek(details.seekTime);
        } else {
          setTrackTime(details.seekTime);
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
  }, [queue, currentIndex, isShuffle, loopMode, isPlaying, currentTrack]);

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

  return (
    <AudioContext.Provider value={{
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
    }}>
      {children}
    </AudioContext.Provider>
  );
};
