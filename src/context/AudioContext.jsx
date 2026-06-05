import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

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
  const { isLoggedIn, isLoading, authFetch } = useAuth() || {};
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loopMode, setLoopMode] = useState('none'); // 'none' | 'all' | 'one'
  const [isShuffle, setIsShuffle] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [isLyricsVisible, setIsLyricsVisible] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);

  const audioRef = useRef(new Audio());
  const preloadRef = useRef(new Audio()); // For pre-buffering the next track
  const fadeIntervalRef = useRef(null);

  // Equalizer states and references
  const [eqPreset, setEqPreset] = useState('flat'); // 'flat' | 'bass-boost' | 'vocal-boost' | 'treble-boost' | 'hifi'
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const bassFilterRef = useRef(null);
  const midFilterRef = useRef(null);
  const trebleFilterRef = useRef(null);
  const compressorFilterRef = useRef(null);

  const [likedSongs, setLikedSongs] = useState([]);
  const [likedSongsMetadata, setLikedSongsMetadata] = useState([]);

  // Load liked songs from localStorage on mount
  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem('tunely_liked_songs') || '[]');
    const meta = JSON.parse(localStorage.getItem('tunely_liked_songs_metadata') || '[]');
    setLikedSongs(ids);
    setLikedSongsMetadata(meta);

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
    if (!authFetch) return;

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
        localStorage.setItem('tunely_liked_songs_updated_at', new Date().toISOString());
      } catch (e) {
        console.warn('Liked songs sync failed:', e);
      }
    };

    syncLikedSongs();
  }, [isLoggedIn, isLoading]);

  // Live Sync / Periodic Polling for Liked Songs
  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn || !authFetch) return;

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
            localStorage.setItem('tunely_liked_songs_updated_at', new Date().toISOString());
          }
        }
      } catch (e) {
        console.warn('Liked songs live sync failed:', e);
      }
    };

    // Poll every 10 seconds
    intervalId = setInterval(performLikedSongsSync, 10000);

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
  }, [isLoggedIn, isLoading, authFetch]);

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

    // Sync to cloud if logged in
    if (isLoggedIn && authFetch) {
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
    // Detect mobile device to bypass Web Audio routing.
    // Web Audio API routing gets suspended by iOS Safari / Android Chrome when the screen is turned off or backgrounded,
    // which silences the playback. Bypassing it on mobile allows native background playback to work perfectly.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      return;
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      return;
    }

    try {
      // Allow Web Audio routing without security exceptions on saavn cdn streams
      audioRef.current.crossOrigin = "anonymous";
      
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // Low Shelf Filter (Bass)
      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 200;
      bass.gain.value = 0;
      bassFilterRef.current = bass;

      // Peaking Filter (Mid/Vocal Clarity)
      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 2000;
      mid.Q.value = 1.0;
      mid.gain.value = 0;
      midFilterRef.current = mid;

      // High Shelf Filter (Treble/Presence)
      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 8000;
      treble.gain.value = 0;
      trebleFilterRef.current = treble;

      // Dynamics Compressor (enhances voice quality, dynamic range warmth, and stops clipping)
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      compressor.knee.setValueAtTime(10, ctx.currentTime);
      compressor.ratio.setValueAtTime(3, ctx.currentTime);
      compressor.attack.setValueAtTime(0.01, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);
      compressorFilterRef.current = compressor;

      // Connect HTML5 element to AudioNode pipeline
      const source = ctx.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;

      source.connect(bass);
      bass.connect(mid);
      mid.connect(treble);
      treble.connect(compressor);
      compressor.connect(ctx.destination);

      applyEqPreset(eqPreset, bass, mid, treble, compressor);
    } catch (e) {
      console.warn("Failed to initialize Web Audio Equalizer (CORS / Autoplay restrictions):", e);
    }
  };

  const applyEqPreset = (preset, bassNode = bassFilterRef.current, midNode = midFilterRef.current, trebleNode = trebleFilterRef.current, compressorNode = compressorFilterRef.current) => {
    if (!bassNode || !midNode || !trebleNode) return;
    const transitionTime = audioContextRef.current ? audioContextRef.current.currentTime + 0.05 : 0;

    // Reset compressor to default parameters before adjusting
    if (compressorNode) {
      compressorNode.threshold.setValueAtTime(-12, transitionTime);
      compressorNode.knee.setValueAtTime(10, transitionTime);
      compressorNode.ratio.setValueAtTime(3, transitionTime);
    }

    if (preset === 'bass-boost') {
      bassNode.gain.setValueAtTime(8, transitionTime);
      midNode.gain.setValueAtTime(-1, transitionTime);
      trebleNode.gain.setValueAtTime(-2, transitionTime);
      if (compressorNode) {
        compressorNode.threshold.setValueAtTime(-16, transitionTime);
        compressorNode.ratio.setValueAtTime(5, transitionTime);
      }
    } else if (preset === 'vocal-boost') {
      // Clear Vocal / voice presence boost
      bassNode.gain.setValueAtTime(-3.5, transitionTime);
      midNode.gain.setValueAtTime(6, transitionTime);
      trebleNode.gain.setValueAtTime(3, transitionTime);
      if (compressorNode) {
        compressorNode.threshold.setValueAtTime(-24, transitionTime);
        compressorNode.ratio.setValueAtTime(4, transitionTime);
        compressorNode.knee.setValueAtTime(30, transitionTime);
      }
    } else if (preset === 'treble-boost') {
      bassNode.gain.setValueAtTime(-2, transitionTime);
      midNode.gain.setValueAtTime(0, transitionTime);
      trebleNode.gain.setValueAtTime(7, transitionTime);
      if (compressorNode) {
        compressorNode.threshold.setValueAtTime(-12, transitionTime);
        compressorNode.ratio.setValueAtTime(3, transitionTime);
      }
    } else if (preset === 'hifi') {
      // Studio High-Fidelity Dynamic Boost
      bassNode.gain.setValueAtTime(4, transitionTime);
      midNode.gain.setValueAtTime(2, transitionTime);
      trebleNode.gain.setValueAtTime(4, transitionTime);
      if (compressorNode) {
        compressorNode.threshold.setValueAtTime(-20, transitionTime);
        compressorNode.ratio.setValueAtTime(4, transitionTime);
        compressorNode.knee.setValueAtTime(20, transitionTime);
      }
    } else {
      // Flat profile (Normal)
      bassNode.gain.setValueAtTime(0, transitionTime);
      midNode.gain.setValueAtTime(0, transitionTime);
      trebleNode.gain.setValueAtTime(0, transitionTime);
      if (compressorNode) {
        compressorNode.threshold.setValueAtTime(-6, transitionTime); // minimal compression
        compressorNode.ratio.setValueAtTime(1, transitionTime);
      }
    }
  };

  const changeEqPreset = (preset) => {
    setEqPreset(preset);
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      applyEqPreset(preset);
    }
  };

  // 1. Core Functions

  // Function to fetch track lyrics (with fallback)
  const fetchLyrics = async (trackId) => {
    setIsLoadingLyrics(true);
    
    // Check local fallback first for instant loading on popular tracks
    if (LYRICS_FALLBACK[trackId]) {
      setLyrics(LYRICS_FALLBACK[trackId]);
      setIsLoadingLyrics(false);
      return;
    }

    setLyrics(null);

    try {
      // Only call the valid JioSaavn lyrics endpoint
      const response = await fetch(`${API_BASE}/api/songs/${trackId}/lyrics`);
      if (response.ok) {
        const resObj = await response.json();
        if (resObj.success && resObj.data && resObj.data.lyrics) {
          setLyrics(resObj.data.lyrics);
          setIsLoadingLyrics(false);
          return;
        }
      }
      // Graceful fallback — no error shown in network tab for missing lyrics
      setLyrics(`[Instrumental]\n\n(Lyrics not available for this track)\n\nEnjoy the stream on Tunely! 🎵`);
    } catch {
      setLyrics(`(Unable to load lyrics)\nEnjoy the high quality stream!`);
    } finally {
      setIsLoadingLyrics(false);
    }
  };

  // Computes the next track index based on shuffle and loop mode
  const getNextIndex = () => {
    if (queue.length === 0) return -1;
    
    if (isShuffle) {
      return Math.floor(Math.random() * queue.length);
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
      // Get highest quality URL available
      const streamUrl = nextSong.downloadUrl?.[nextSong.downloadUrl.length - 1]?.url;
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
    audioRef.current.volume = 0;
    let currentVol = 0;
    fadeIntervalRef.current = setInterval(() => {
      if (currentVol < volume) {
        currentVol = Math.min(volume, currentVol + 0.05);
        audioRef.current.volume = currentVol;
      } else {
        clearInterval(fadeIntervalRef.current);
      }
    }, 30);
  };

  // Smooth Volume Fade Out
  const fadeOutVolume = (callback) => {
    clearInterval(fadeIntervalRef.current);
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
    setCurrentTrack(track);
    setIsLoadingTrack(true);

    const streamUrl = track.downloadUrl?.[track.downloadUrl.length - 1]?.url;
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
    
    const streamUrl = track.downloadUrl?.[track.downloadUrl.length - 1]?.url;
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
    if (queue.some(t => t.id === track.id)) return;
    setQueue(prev => [...prev, track]);
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
      // When the current song reaches 90% completion and we have a next song, preload its media chunks
      if (audio.duration && (audio.currentTime / audio.duration > 0.90)) {
        preloadNextTrack();
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

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [queue, currentIndex, loopMode, isShuffle]);

  // Adjust volume smoothly
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Sync lyrics when currentTrack changes
  useEffect(() => {
    if (currentTrack) {
      fetchLyrics(currentTrack.id);
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
        if (!isPlaying) togglePlay();
      }],
      ['pause', () => {
        if (isPlaying) togglePlay();
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
        } catch (error) {
          // ignore
        }
      }
    };
  }, [queue, currentIndex, isShuffle, loopMode, isPlaying, currentTrack]);

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
      playQueueTrack,
      clearQueue,
      eqPreset,
      setEqPreset: changeEqPreset,
      likedSongs,
      likedSongsMetadata,
      toggleLikeTrack
    }}>
      {children}
    </AudioContext.Provider>
  );
};
