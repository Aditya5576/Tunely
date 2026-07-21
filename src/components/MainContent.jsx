import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { Search as SearchIcon, Play, Music, Clock, Heart, Compass, Plus, ChevronLeft, ListMusic, Trash2, Download, RefreshCw } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import SongRow from './SongRow';
import { motion } from 'framer-motion';


const API_BASE = (import.meta.env.VITE_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev').trim();

import { decodeHtml } from '../utils/lyrics';

const deduplicateTracks = (tracks) => {
  if (!Array.isArray(tracks)) return [];
  const seen = new Set();
  return tracks.filter(track => {
    if (!track) return false;
    const nameKey = `${(track.name || '').trim().toLowerCase()}-${(track.artists?.primary?.[0]?.name || '').trim().toLowerCase()}`;
    const idKey = track.id;
    if (seen.has(nameKey) || seen.has(idKey)) {
      return false;
    }
    seen.add(nameKey);
    seen.add(idKey);
    return true;
  });
};

// In-memory cache for search results and trending data
const searchCache = new Map();
const homeCache = { data: null, ts: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const MOCK_PODCAST_SHOWS = [
  {
    id: 'podcast_joe_rogan',
    name: 'The Joe Rogan Experience',
    publisher: 'Joe Rogan',
    type: 'podcast-show',
    image: [
      { url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=150&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=300&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=600&auto=format&fit=crop' }
    ],
    description: 'The official podcast of comedian Joe Rogan. Deep-dive, unfiltered conversations featuring scientists, writers, artists, and experts from all walks of life.',
    episodes: [
      {
        id: 'pod_ep_rogan_1',
        name: '#2155 - Elon Musk (AI, Mars & Tesla Future)',
        artists: { primary: [{ name: 'Joe Rogan' }], all: [{ name: 'Joe Rogan' }, { name: 'Elon Musk' }] },
        duration: 10800,
        image: [
          { url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=150&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=600&auto=format&fit=crop' }
        ],
        downloadUrl: [
          { quality: '96kbps', url: 'https://traffic.libsyn.com/secure/intellectualinvestor/Quality_Check_Sample.mp3' },
          { quality: '160kbps', url: 'https://traffic.libsyn.com/secure/intellectualinvestor/Quality_Check_Sample.mp3' },
          { quality: '320kbps', url: 'https://traffic.libsyn.com/secure/intellectualinvestor/Quality_Check_Sample.mp3' }
        ],
        album: { name: 'The Joe Rogan Experience' },
        releaseDate: 'June 10, 2026',
        description: 'Elon Musk returns to the podcast to discuss artificial intelligence, humanoid Tesla robots, the timeline for colonizing Mars, and updates on SpaceX Starship.'
      },
      {
        id: 'pod_ep_rogan_2',
        name: '#2148 - Duncan Trussell (Cosmic Simulation)',
        artists: { primary: [{ name: 'Joe Rogan' }], all: [{ name: 'Joe Rogan' }, { name: 'Duncan Trussell' }] },
        duration: 7200,
        image: [
          { url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=150&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=600&auto=format&fit=crop' }
        ],
        downloadUrl: [
          { quality: '96kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
          { quality: '160kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
          { quality: '320kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' }
        ],
        album: { name: 'The Joe Rogan Experience' },
        releaseDate: 'May 28, 2026',
        description: 'Duncan Trussell joins Joe to explore meditation, simulation theory, the convergence of technology and spirituality, and the future of creative arts.'
      }
    ]
  },
  {
    id: 'podcast_ted',
    name: 'TED Talks Daily',
    publisher: 'TED',
    type: 'podcast-show',
    image: [
      { url: 'https://images.unsplash.com/photo-1526256262170-660b29feb4cd?q=80&w=150&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1526256262170-660b29feb4cd?q=80&w=300&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1526256262170-660b29feb4cd?q=80&w=600&auto=format&fit=crop' }
    ],
    description: 'Every weekday, TED Talks Daily brings you the latest talks in audio format from the world\'s leading thinkers, researchers, and creators.',
    episodes: [
      {
        id: 'pod_ep_ted_1',
        name: 'Why Sleep is Your Superpower',
        artists: { primary: [{ name: 'TED' }], all: [{ name: 'TED' }, { name: 'Dr. Matt Walker' }] },
        duration: 1140,
        image: [
          { url: 'https://images.unsplash.com/photo-1526256262170-660b29feb4cd?q=80&w=150&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1526256262170-660b29feb4cd?q=80&w=300&auto=format&fit=crop' }
        ],
        downloadUrl: [
          { quality: '96kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
          { quality: '160kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
          { quality: '320kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' }
        ],
        album: { name: 'TED Talks Daily' },
        releaseDate: 'June 9, 2026',
        description: 'Sleep scientist Dr. Matt Walker details the biological necessity of sleep, how it enhances cognitive ability, regulates immune response, and shields against chronic disease.'
      },
      {
        id: 'pod_ep_ted_2',
        name: 'Three Secrets to Building Real Confidence',
        artists: { primary: [{ name: 'TED' }], all: [{ name: 'TED' }, { name: 'Brittany Packnett' }] },
        duration: 840,
        image: [
          { url: 'https://images.unsplash.com/photo-1526256262170-660b29feb4cd?q=80&w=150&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1526256262170-660b29feb4cd?q=80&w=300&auto=format&fit=crop' }
        ],
        downloadUrl: [
          { quality: '96kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
          { quality: '160kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
          { quality: '320kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' }
        ],
        album: { name: 'TED Talks Daily' },
        releaseDate: 'June 2, 2026',
        description: 'Brittany Packnett shares her personal journey and outlines three core pillars to cultivate true confidence, turning your potential into power.'
      }
    ]
  },
  {
    id: 'podcast_lex',
    name: 'Lex Fridman Podcast',
    publisher: 'Lex Fridman',
    type: 'podcast-show',
    image: [
      { url: 'https://images.unsplash.com/photo-1589903308904-1010c2294adc?q=80&w=150&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1589903308904-1010c2294adc?q=80&w=300&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1589903308904-1010c2294adc?q=80&w=600&auto=format&fit=crop' }
    ],
    description: 'Conversations about science, technology, history, philosophy, and the nature of intelligence, consciousness, love, and power.',
    episodes: [
      {
        id: 'pod_ep_lex_1',
        name: '#410 - Sam Altman: OpenAI, GPT-5 and AGI',
        artists: { primary: [{ name: 'Lex Fridman' }], all: [{ name: 'Lex Fridman' }, { name: 'Sam Altman' }] },
        duration: 8100,
        image: [
          { url: 'https://images.unsplash.com/photo-1589903308904-1010c2294adc?q=80&w=150&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1589903308904-1010c2294adc?q=80&w=300&auto=format&fit=crop' }
        ],
        downloadUrl: [
          { quality: '96kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
          { quality: '160kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
          { quality: '320kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' }
        ],
        album: { name: 'Lex Fridman Podcast' },
        releaseDate: 'June 5, 2026',
        description: 'Sam Altman, CEO of OpenAI, discusses the development trajectory of GPT-5, the safety parameters required for AGI, and internal board transitions.'
      }
    ]
  },
  {
    id: 'podcast_huberman',
    name: 'Huberman Lab',
    publisher: 'Dr. Andrew Huberman',
    type: 'podcast-show',
    image: [
      { url: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?q=80&w=150&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?q=80&w=300&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?q=80&w=600&auto=format&fit=crop' }
    ],
    description: 'Dr. Andrew Huberman discusses science and science-based tools for everyday life, focusing on brain health, neurobiology, and cognitive function.',
    episodes: [
      {
        id: 'pod_ep_huber_1',
        name: 'Master Your Sleep & Wake Up Energized',
        artists: { primary: [{ name: 'Andrew Huberman' }], all: [{ name: 'Andrew Huberman' }] },
        duration: 7600,
        image: [
          { url: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?q=80&w=150&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?q=80&w=300&auto=format&fit=crop' }
        ],
        downloadUrl: [
          { quality: '96kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
          { quality: '160kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
          { quality: '320kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' }
        ],
        album: { name: 'Huberman Lab' },
        releaseDate: 'May 20, 2026',
        description: 'Dr. Huberman explains the neurological mechanics of circadian rhythm, light viewing schedules, and natural supplements to optimize deep sleep.'
      }
    ]
  },
  {
    id: 'podcast_sywk',
    name: 'Stuff You Should Know',
    publisher: 'iHeartPodcasts',
    type: 'podcast-show',
    image: [
      { url: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=150&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=300&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=600&auto=format&fit=crop' }
    ],
    description: 'Join Josh and Chuck as they explore the fascinating mechanics behind everyday things, history, and scientific wonders.',
    episodes: [
      {
        id: 'pod_ep_sywk_1',
        name: 'How Gravity Works (And Why We Still Don\'t Know)',
        artists: { primary: [{ name: 'Stuff You Should Know' }], all: [{ name: 'Josh Clark' }, { name: 'Chuck Bryant' }] },
        duration: 2700,
        image: [
          { url: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=150&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=300&auto=format&fit=crop' }
        ],
        downloadUrl: [
          { quality: '96kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
          { quality: '160kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
          { quality: '320kbps', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' }
        ],
        album: { name: 'Stuff You Should Know' },
        releaseDate: 'June 7, 2026',
        description: 'Josh and Chuck dive deep into classical gravity, Einstein\'s space-time warping theory, and the current challenges of quantum gravity.'
      }
    ]
  }
];

const ALL_MOCK_EPISODES = MOCK_PODCAST_SHOWS.flatMap(show => show.episodes);

const PRE_CONFIGURED_PLAYLISTS = [
  { id: '1079336813', name: 'Chill Lo-Fi Mix', type: 'playlist' },
  { id: '83313988', name: 'Top Hindi Hits', type: 'playlist' },
  { id: '1108582', name: 'Global Top 50', type: 'playlist' },
  { id: '69996470', name: 'AiSh, Vol. 4', type: 'album' }
];

export default function MainContent({ 
  currentView, 
  selectedPlaylistId, 
  customPlaylists,
  setCustomPlaylists,
  setIsAccountOpen,
  createNewPlaylist
}) {
  const { playTrack, likedSongsMetadata, toggleLikeTrack, recentlyPlayed } = useAudio();
  const navigate = useNavigate();
  const { user } = useAuth() || {};

  const handleHardRefresh = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
    sessionStorage.clear();
    const keysToKeep = new Set(['spotify_custom_playlists', 'tunely_token', 'tunely_user', 'liked_songs_metadata']);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keysToKeep.has(key)) {
        localStorage.removeItem(key);
      }
    }
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('u', Date.now().toString());
    window.location.href = currentUrl.toString();
  };
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('tunely_search_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchTab, setSearchTab] = useState('songs'); // 'songs' | 'albums'
  const searchInputRef = useRef(null);

  // Home states
  const [homeTrending, setHomeTrending] = useState([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeFeatured, setHomeFeatured] = useState([]);
  const [homeFeaturedLoading, setHomeFeaturedLoading] = useState(true);
  const [homeNewReleases, setHomeNewReleases] = useState([]);
  const [homeNewReleasesLoading, setHomeNewReleasesLoading] = useState(true);
  const [homeChill, setHomeChill] = useState([]);
  const [homeChillLoading, setHomeChillLoading] = useState(true);
  const [homeWorkout, setHomeWorkout] = useState([]);
  const [homeWorkoutLoading, setHomeWorkoutLoading] = useState(true);
  const [homeFilter, setHomeFilter] = useState('all'); // 'all' | 'music' | 'podcasts'

  // Playlist/Album detail states
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Spotify Playlist Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [importStatus, setImportStatus] = useState({
    loading: false,
    text: '',
    progress: 0,
    total: 0,
    error: null
  });

  // Fetch all Home view sections concurrently on mount
  useEffect(() => {
    fetchHomeTrending();
    fetchHomeFeatured();
    fetchHomeNewReleases();
    fetchHomeChill();
    fetchHomeWorkout();
  }, []);


  // Focus search input when view changes to search
  useEffect(() => {
    if (currentView === 'search' && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

  // Fetch playlist/album details when selected ID changes
  useEffect(() => {
    if (selectedPlaylistId) {
      if (currentView === 'custom') {
        if (selectedPlaylistId === 'liked') {
          Promise.resolve().then(() => {
            setDetailData({
              id: 'liked',
              name: 'Liked Songs',
              type: 'custom',
              songs: likedSongsMetadata
            });
          });
        } else {
          // Custom playlist loading
          const playlist = customPlaylists.find(p => p.id === selectedPlaylistId);
          Promise.resolve().then(() => {
            setDetailData(playlist);
          });
        }
      } else {
        fetchDetailData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaylistId, currentView, customPlaylists, likedSongsMetadata]);

  const fetchHomeTrending = async () => {
    // Serve from in-memory cache if fresh
    if (homeCache.data && homeCache.data.length > 0 && Date.now() - homeCache.ts < CACHE_TTL) {
      setHomeTrending(homeCache.data);
      setHomeLoading(false);
      return;
    }
    const queries = ['Top Hindi Songs 2026', 'Global Top 50', 'Viral Hits', 'Bollywood Romance'];
    const randomQuery = encodeURIComponent(queries[Math.floor(Math.random() * queries.length)]);
    setHomeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=${randomQuery}&limit=25`);
      if (res.ok) {
        const obj = await res.json();
        const results = deduplicateTracks(obj.data.results || []).slice(0, 10);
        homeCache.data = results;
        homeCache.ts = Date.now();
        setHomeTrending(results);
      }
    } catch (e) {
      console.error("Error loading home page trending tracks:", e);
    } finally {
      setHomeLoading(false);
    }
  };

  const fetchHomeFeatured = async () => {
    const queries = ['Bollywood Hits 2026', 'Trending Pop', 'Best of 2026', 'Party Hits'];
    const randomQuery = encodeURIComponent(queries[Math.floor(Math.random() * queries.length)]);
    setHomeFeaturedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=${randomQuery}&limit=16`);
      if (res.ok) {
        const obj = await res.json();
        const results = deduplicateTracks(obj.data.results || []).slice(0, 8);
        setHomeFeatured(results);
      }
    } catch (e) {
      console.error("Error loading home featured tracks:", e);
    } finally {
      setHomeFeaturedLoading(false);
    }
  };

  const fetchHomeNewReleases = async () => {
    const queries = ['New Bollywood Songs 2026', 'Latest Punjabi', 'Fresh Indie', 'New Pop 2026'];
    const randomQuery = encodeURIComponent(queries[Math.floor(Math.random() * queries.length)]);
    setHomeNewReleasesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=${randomQuery}&limit=16`);
      if (res.ok) {
        const obj = await res.json();
        const results = deduplicateTracks(obj.data.results || []).slice(0, 8);
        setHomeNewReleases(results);
      }
    } catch (e) {
      console.error("Error loading new releases:", e);
    } finally {
      setHomeNewReleasesLoading(false);
    }
  };

  const fetchHomeChill = async () => {
    const queries = ['Bollywood Hits 2025', 'Arijit Singh Hits 2025', 'Romantic Songs 2025', 'Best of Hindi 2025'];
    const randomQuery = encodeURIComponent(queries[Math.floor(Math.random() * queries.length)]);
    setHomeChillLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=${randomQuery}&limit=16`);
      if (res.ok) {
        const obj = await res.json();
        const results = deduplicateTracks(obj.data.results || []).slice(0, 8);
        setHomeChill(results);
      }
    } catch (e) {
      console.error("Error loading chill tracks:", e);
    } finally {
      setHomeChillLoading(false);
    }
  };

  const fetchHomeWorkout = async () => {
    const queries = ['Party Hits Bollywood 2026', 'Workout Motivation', 'Hip Hop Hits', 'Electronic Dance'];
    const randomQuery = encodeURIComponent(queries[Math.floor(Math.random() * queries.length)]);
    setHomeWorkoutLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=${randomQuery}&limit=16`);
      if (res.ok) {
        const obj = await res.json();
        const results = deduplicateTracks(obj.data.results || []).slice(0, 8);
        setHomeWorkout(results);
      }
    } catch (e) {
      console.error("Error loading workout tracks:", e);
    } finally {
      setHomeWorkoutLoading(false);
    }
  };

  const fetchDetailData = async () => {
    setDetailLoading(true);
    setDetailData(null);
    try {
      if (currentView === 'podcast-show') {
        const show = MOCK_PODCAST_SHOWS.find(s => s.id === selectedPlaylistId);
        setDetailData(show || null);
        setDetailLoading(false);
        return;
      }
      const typePath = currentView === 'album' ? 'albums' : 'playlists';
      const url = `${API_BASE}/api/${typePath}?id=${selectedPlaylistId}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const obj = await res.json();
        setDetailData(obj.data);
      }
    } catch (e) {
      console.error(`Error loading ${currentView} details:`, e);
    } finally {
      setDetailLoading(false);
    }
  };

  // Triggered on key press / query updates (Search-as-you-type)
  useEffect(() => {
    if (currentView !== 'search') return;
    if (!searchQuery.trim()) {
      Promise.resolve().then(() => {
        setSearchResults(null);
        setSearchLoading(false);
      });
      return;
    }

    // Instant result from cache, no loader flash
    const cacheKey = searchQuery.trim().toLowerCase();
    if (searchCache.has(cacheKey)) {
      Promise.resolve().then(() => {
        setSearchResults(searchCache.get(cacheKey));
        setSearchLoading(false);
      });
      return;
    }
    Promise.resolve().then(() => setSearchLoading(true));
    const delayDebounceFn = setTimeout(() => {
      performSearch(searchQuery);
    }, 200); // 200ms debounce for snappy feel

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, currentView]);

  const addToHistory = (q) => {
    if (!q || !q.trim()) return;
    const term = q.trim();
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== term.toLowerCase());
      const next = [term, ...filtered].slice(0, 8);
      localStorage.setItem('tunely_search_history', JSON.stringify(next));
      return next;
    });
  };

  async function performSearch(query) {
    const cacheKey = query.trim().toLowerCase();
    // Return cached result if available
    if (searchCache.has(cacheKey)) {
      setSearchResults(searchCache.get(cacheKey));
      setSearchLoading(false);
      return;
    }
    addToHistory(query);
    try {
      const [songsRes, albumsRes] = await Promise.all([
        fetch(`${API_BASE}/api/search/songs?query=${encodeURIComponent(query)}&limit=15`),
        fetch(`${API_BASE}/api/search/albums?query=${encodeURIComponent(query)}&limit=12`).catch(() => null)
      ]);

      let songs = [];
      let albums = [];

      if (songsRes && songsRes.ok) {
        const obj = await songsRes.json();
        const resultsList = obj.data.results || [];
        const q = query.toLowerCase().trim();
        const getScore = (track) => {
          let score = 0;
          const title = track.name.toLowerCase();
          const primaryArtists = track.artists?.primary?.map(art => art.name.toLowerCase()) || [];
          const allArtists = track.artists?.all?.map(art => art.name.toLowerCase()) || [];
          const playCount = Number(track.playCount) || 0;
          if (title === q) score += 100;
          else if (title.startsWith(q)) score += 60;
          else if (title.includes(q)) score += 30;
          const exactArtist = primaryArtists.some(n => n === q) || allArtists.some(n => n === q);
          const startsArtist = primaryArtists.some(n => n.startsWith(q)) || allArtists.some(n => n.startsWith(q));
          const includesArtist = primaryArtists.some(n => n.includes(q)) || allArtists.some(n => n.includes(q));
          if (exactArtist) score += 80;
          else if (startsArtist) score += 45;
          else if (includesArtist) score += 15;
          if (playCount > 0) score += Math.log10(playCount) * 8;
          return score;
        };
        songs = [...resultsList].sort((a, b) => getScore(b) - getScore(a));
      }

      if (albumsRes && albumsRes.ok) {
        const obj = await albumsRes.json();
        albums = obj.data.results || [];
      }

      const result = { songs, albums };
      // Cache result (max 100 entries to avoid memory bloat)
      if (searchCache.size > 100) searchCache.clear();
      searchCache.set(cacheKey, result);
      setSearchResults(result);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setSearchLoading(false);
    }
  }

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const handleStartImport = async () => {
    if (user?.isGuest) {
      alert("Guest Mode Limitation: Spotify Playlist Import is a premium feature. Please sign in or register to import playlists.");
      setShowImportModal(false);
      setSpotifyUrl('');
      return;
    }

    const playlistIdMatch = spotifyUrl.match(/playlist\/([a-zA-Z0-9]+)/);
    if (!playlistIdMatch) {
      setImportStatus(prev => ({ ...prev, error: 'Invalid Spotify playlist link format. Make sure it contains "playlist/ID".' }));
      return;
    }
    const playlistId = playlistIdMatch[1];
    
    if (playlistId.length < 22) {
      setImportStatus(prev => ({
        ...prev,
        error: `The playlist ID appears to be truncated (only ${playlistId.length} characters instead of 22). Please copy the full link from Spotify.`
      }));
      return;
    }
    
    setImportStatus({
      loading: true,
      text: 'Connecting to Tunely backend...',
      progress: 0,
      total: 0,
      error: null
    });

    try {
      const res = await fetch(`${API_BASE}/api/spotify/playlist?id=${playlistId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to retrieve Spotify playlist (Status ${res.status}). Make sure the playlist is public.`);
      }

      const responseObj = await res.json();
      const playlistName = responseObj.data?.name || 'Imported Playlist';
      const trackList = responseObj.data?.tracks || [];

      if (trackList.length === 0) {
        throw new Error('This playlist has no tracks, or it is private.');
      }

      setImportStatus(prev => ({
        ...prev,
        text: `Found ${trackList.length} tracks. Matching songs on Tunely...`,
        total: trackList.length
      }));

      const matchedSongs = [];
      const batchSize = 6;
      
      for (let i = 0; i < trackList.length; i += batchSize) {
        const batch = trackList.slice(i, i + batchSize);
        
        setImportStatus(prev => ({
          ...prev,
          text: `Matching tracks ${i + 1} to ${Math.min(i + batchSize, trackList.length)} of ${trackList.length}...`,
          progress: i
        }));

        const promises = batch.map(async (item) => {
          const title = item.title;
          const artist = item.artist || '';
          try {
            const searchQuery = `${title} ${artist}`.trim();
            const searchRes = await fetch(`${API_BASE}/api/search/songs?query=${encodeURIComponent(searchQuery)}&limit=3`);
            if (searchRes.ok) {
              const searchObj = await searchRes.json();
              const results = searchObj.data.results || [];
              if (results.length > 0) {
                return results[0];
              }
            }
          } catch (err) {
            console.error(`Error matching track ${title}:`, err);
          }
          return null;
        });

        const results = await Promise.all(promises);
        for (const song of results) {
          if (song) matchedSongs.push(song);
        }
      }

      if (matchedSongs.length === 0) {
        throw new Error('No songs could be matched on Tunely.');
      }

      const existingPlaylistIdx = customPlaylists.findIndex(p => p.name === `${playlistName} (Spotify)`);
      let updated;
      let targetPlaylistId;

      if (existingPlaylistIdx !== -1) {
        const existingPlaylist = customPlaylists[existingPlaylistIdx];
        targetPlaylistId = existingPlaylist.id;

        const existingSongIds = new Set(existingPlaylist.songs.map(s => s.id));
        const newUniqueSongs = matchedSongs.filter(s => !existingSongIds.has(s.id));

        const updatedPlaylist = {
          ...existingPlaylist,
          songs: [...existingPlaylist.songs, ...newUniqueSongs]
        };

        updated = [...customPlaylists];
        updated[existingPlaylistIdx] = updatedPlaylist;

        setCustomPlaylists(updated);
        localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));
      } else {
        const newPlaylistId = `custom_${Date.now()}`;
        targetPlaylistId = newPlaylistId;

        const newPlaylist = {
          id: newPlaylistId,
          name: `${playlistName} (Spotify)`,
          type: 'custom',
          songs: matchedSongs
        };

        updated = [...customPlaylists, newPlaylist];
        setCustomPlaylists(updated);
        localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));
      }

      setImportStatus({
        loading: false,
        text: '',
        progress: 0,
        total: 0,
        error: null
      });

      setShowImportModal(false);
      setSpotifyUrl('');
      
      navigate(`/custom/${targetPlaylistId}`);
    } catch (err) {
      let errorMessage = err.message || 'An unknown error occurred during import.';
      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network Error: Could not connect to Tunely backend. Please check your internet connection or try again later.';
      } else if (errorMessage.includes('Unexpected token')) {
        errorMessage = 'Server Error: The Tunely backend returned an invalid response. The Spotify link might be private or malformed.';
      }
      setImportStatus(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  };

  const handleCategoryClick = (category) => {
    setSearchQuery(category);
    setSearchLoading(true);
    performSearch(category);
  };

  const handlePlayCategory = async (e, query) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const results = data.data.results || [];
        if (results.length > 0) {
          playTrack(results[0], results);
        }
      }
    } catch (err) {
      console.error("Failed to play category:", err);
    }
  };

  const playAllTracks = (tracks) => {
    if (!tracks || tracks.length === 0) return;
    playTrack(tracks[0], tracks);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getGreetingShortcuts = () => {
    const hr = new Date().getHours();
    if (hr < 12) {
      return [
        { name: 'Morning Acoustic', query: 'Morning Acoustic', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.25)', color: '#fbbf24' },
        { name: 'Lo-Fi Chill', query: 'Lofi Chill', bg: 'rgba(108, 92, 231, 0.12)', border: 'rgba(108, 92, 231, 0.25)', color: '#a78bfa' },
        { name: 'Devotional Hits', query: 'Bhajan Classics', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', color: '#10b981' },
        { name: 'Zen Meditation', query: 'Zen Sleep', bg: 'rgba(0, 229, 255, 0.12)', border: 'rgba(0, 229, 255, 0.25)', color: '#00e5ff' }
      ];
    } else if (hr < 17) {
      return [
        { name: 'Bollywood Hits', query: 'Bollywood Hits', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.25)', color: '#f43f5e' },
        { name: 'Arijit Hits', query: 'Arijit Singh Hits', bg: 'rgba(0, 229, 255, 0.12)', border: 'rgba(0, 229, 255, 0.25)', color: '#00e5ff' },
        { name: 'Deep Focus', query: 'Study Ambient', bg: 'rgba(108, 92, 231, 0.12)', border: 'rgba(108, 92, 231, 0.25)', color: '#a78bfa' },
        { name: 'Instrumental', query: 'Instrumental Hits', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.25)', color: '#fb923c' }
      ];
    } else {
      return [
        { name: 'Party Anthems', query: 'Bolly Party', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.25)', color: '#f43f5e' },
        { name: 'Late Night Jazz', query: 'Coffee Jazz', bg: 'rgba(108, 92, 231, 0.12)', border: 'rgba(108, 92, 231, 0.25)', color: '#a78bfa' },
        { name: 'Rock Classics', query: 'Classic Rock', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.25)', color: '#fb923c' },
        { name: 'Romantic Bolly', query: 'Romantic Bollywood', bg: 'rgba(0, 229, 255, 0.12)', border: 'rgba(0, 229, 255, 0.25)', color: '#00e5ff' }
      ];
    }
  };

  const formatDuration = (seconds) => {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs} hr ${remainingMins} min`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="main-content">
      {/* Unified App Header - responsive for both Desktop & Mobile */}
      <header className="app-header">
        {/* Left Side: Navigation Arrows (Desktop) / Avatar or Back (Mobile) */}
        <div className="header-left">
          {/* Desktop Navigation Arrows */}
          <div className="desktop-nav-arrows">
            <button className="nav-arrow-btn" onClick={() => window.history.back()} title="Go Back">
              <ChevronLeft size={18} />
            </button>
            <button className="nav-arrow-btn" onClick={() => window.history.forward()} title="Go Forward" style={{ transform: 'rotate(180deg)' }}>
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* Mobile Back or Avatar */}
          <div className="mobile-left-nav">
            {(currentView === 'playlist' || currentView === 'album' || currentView === 'custom') ? (
              <button className="mobile-back-btn" onClick={() => { navigate('/library'); }} title="Back">
                <ChevronLeft size={24} />
              </button>
            ) : (
              <button className="mobile-avatar-btn" onClick={() => setIsAccountOpen && setIsAccountOpen(true)} title="Profile">
                <div className="mobile-avatar" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                  {(user?.name || user?.email || 'U').trim().charAt(0).toUpperCase()}
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Center: View-dependent content / Title / Filter Pills */}
        <div className="header-center">
          {currentView === 'home' && (
            <div className="filter-pills-container">
              {['All', 'Music', 'Podcasts'].map(label => (
                <button
                  key={label}
                  className={`filter-pill ${homeFilter === label.toLowerCase() ? 'active' : ''}`}
                  onClick={() => setHomeFilter(label.toLowerCase())}
                >{label}</button>
              ))}
            </div>
          )}
          {currentView === 'search' && (
            <div className="header-search-container">
              <form onSubmit={handleSearchSubmit} className="header-search-bar-form">
                <div className="header-search-input-wrapper">
                  <SearchIcon size={16} className="search-input-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="What do you want to listen to?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button type="button" className="clear-search-btn" onClick={() => { setSearchQuery(''); setSearchResults(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-dimmed)', fontSize: '18px', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}>
                      ×
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
          {currentView === 'library' && (
            <span className="view-title-label">Your Library</span>
          )}
          {(currentView === 'playlist' || currentView === 'album' || currentView === 'custom' || currentView === 'podcast-show') && (
            <span className="view-title-label view-title-truncate">
              {detailData ? decodeHtml(detailData.name) : ''}
            </span>
          )}
        </div>

        {/* Right Side: Profile Capsule (Desktop) / Actions (Mobile) */}
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick Update / Hard Refresh Button */}
          <button 
            className="header-update-btn" 
            onClick={handleHardRefresh}
            title="Clear Cache & Hard Refresh App"
          >
            <RefreshCw size={14} className="update-icon" />
            <span className="update-text">Update</span>
          </button>

          {/* Desktop Profile capsule */}
          <div className="desktop-profile-capsule" onClick={() => setIsAccountOpen && setIsAccountOpen(true)}>
            <div className="profile-avatar-circle" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              {(user?.name || user?.email || 'U').trim().charAt(0).toUpperCase()}
            </div>
            <span className="profile-name-text">{user?.name?.split(' ')[0] || 'Guest'}</span>
          </div>

          {/* Mobile Right Action Icons */}
          <div className="mobile-right-actions">
            {currentView === 'library' ? (
              <button className="mobile-icon-btn" onClick={createNewPlaylist} title="New Playlist">
                <Plus size={22} />
              </button>
            ) : currentView === 'home' || currentView === 'search' ? (
              <button className="mobile-icon-btn" onClick={() => { navigate('/search'); }} title="Search">
                <SearchIcon size={20} />
              </button>
            ) : (
              <div style={{ width: 34 }} />
            )}
          </div>
        </div>
      </header>

      {/* Scrollable Container */}
      <div className="content-scroll">
        
        {/* VIEW 1: HOME */}
        {currentView === 'home' && (
          <motion.div
            className="view-home"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Home Greeting Header (visible on both Desktop and Mobile, styled beautifully) */}
            <motion.div
              className="home-greeting"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
            >
              <h1>{getGreeting()}, {user?.name?.split(' ')[0] || 'Guest'} 👋</h1>
              <span className="home-live-badge">Live</span>
            </motion.div>

            {/* Hero banner - visible on desktop, hidden on mobile */}
            <motion.div
              className="hero-banner"
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <div className="hero-tag">🎥 2026 Hits</div>
              <h1>Your Sound. Your World.</h1>
              <p>Stream the biggest 2026 Bollywood hits, trending tracks, and exclusive releases — all in stunning quality, zero ads.</p>
              <div className="hero-actions">
                <button 
                  className="hero-play-btn" 
                  onClick={() => playAllTracks(homeTrending)}
                  disabled={homeTrending.length === 0}
                >
                  <Play size={18} fill="currentColor" />
                  <span>Play Featured</span>
                </button>
              </div>
            </motion.div>

            {/* If homeFilter is All or Music, show Recently Played, Shortcuts, and all Feeds */}
            {(homeFilter === 'all' || homeFilter === 'music') && (
              <>
                {/* Recently Played Section */}
                {recentlyPlayed && recentlyPlayed.length > 0 && (
                  <div className="featured-section recently-played-section" style={{ marginBottom: '24px' }}>
                    <div className="featured-section-header">
                      <h2>🕐 Recently Played</h2>
                    </div>
                    <div className="featured-cards-scroll">
                      {recentlyPlayed.map(track => (
                        <div key={`recent-${track.id}`} className="featured-card glass-panel" onClick={() => playTrack(track, recentlyPlayed)}>
                          <div className="featured-card-cover-container">
                            <img src={track.image?.[2]?.url || track.image?.[1]?.url || track.image?.[0]?.url} alt={track.name} className="featured-card-cover" />
                            <button className="featured-card-play-btn" title="Play">
                              <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                            </button>
                          </div>
                          <span className="featured-card-title">{decodeHtml(track.name)}</span>
                          <span className="featured-card-artist">{decodeHtml(track.artists?.primary?.[0]?.name || 'Artist')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                 {/* Quick shortcuts */}
                <div className="shortcuts-grid">
                  <h2>⚡ Discover by Mood</h2>
                  <div className="shortcuts-container">
                    {getGreetingShortcuts().map((item, idx) => (
                      <div 
                        key={idx} 
                        className="shortcut-card"
                        style={{ 
                          background: item.bg, 
                          borderColor: item.border,
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          color: item.color
                        }}
                        onClick={() => {
                          navigate('/search');
                          handleCategoryClick(item.query);
                        }}
                      >
                        <div className="shortcut-icon-container">
                          <Music size={18} />
                        </div>
                        <span>{item.name}</span>
                        <button 
                          className="shortcut-play-btn" 
                          onClick={(e) => handlePlayCategory(e, item.query)}
                          title={`Play ${item.name}`}
                          style={{ color: item.color }}
                        >
                          <Play size={14} fill="currentColor" style={{ marginLeft: '1px' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Horizontal scrollable Featured row */}
                <div className="featured-section">
                  <div className="featured-section-header">
                    <h2>🔥 Bollywood Hits 2026</h2>
                  </div>
                  {homeFeaturedLoading ? (
                    <div className="main-loading">
                      <div className="bounce-loader">
                        <div></div><div></div><div></div>
                      </div>
                    </div>
                  ) : (
                    <div className="featured-cards-scroll">
                      {homeFeatured.map((track, idx) => (
                        <motion.div
                          key={track.id}
                          className="featured-card glass-panel"
                          onClick={() => playTrack(track, homeFeatured)}
                          initial={{ opacity: 0, y: 24, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                          whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.2 } }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <div className="featured-card-cover-container">
                            <img src={track.image?.[2]?.url || track.image?.[1]?.url} alt={track.name} className="featured-card-cover" />
                            <button className="featured-card-play-btn" title="Play">
                              <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                            </button>
                          </div>
                          <span className="featured-card-title">{decodeHtml(track.name)}</span>
                          <span className="featured-card-artist">{decodeHtml(track.artists?.primary?.[0]?.name || 'Artist')}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Horizontal scrollable New Releases row */}
                <div className="featured-section" style={{ marginTop: '24px' }}>
                  <div className="featured-section-header">
                    <h2>✨ Fresh Drops 2026</h2>
                  </div>
                  {homeNewReleasesLoading ? (
                    <div className="main-loading">
                      <div className="bounce-loader">
                        <div></div><div></div><div></div>
                      </div>
                    </div>
                  ) : (
                    <div className="featured-cards-scroll">
                      {homeNewReleases.map((track, idx) => (
                        <motion.div
                          key={track.id}
                          className="featured-card glass-panel"
                          onClick={() => playTrack(track, homeNewReleases)}
                          initial={{ opacity: 0, y: 24, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                          whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.2 } }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <div className="featured-card-cover-container">
                            <img src={track.image?.[2]?.url || track.image?.[1]?.url} alt={track.name} className="featured-card-cover" />
                            <button className="featured-card-play-btn" title="Play">
                              <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                            </button>
                          </div>
                          <span className="featured-card-title">{decodeHtml(track.name)}</span>
                          <span className="featured-card-artist">{decodeHtml(track.artists?.primary?.[0]?.name || 'Artist')}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Horizontal scrollable Chill Vibes row */}
                <div className="featured-section" style={{ marginTop: '24px' }}>
                  <div className="featured-section-header">
                    <h2>🔥 Bollywood Hits 2025</h2>
                  </div>
                  {homeChillLoading ? (
                    <div className="main-loading">
                      <div className="bounce-loader">
                        <div></div><div></div><div></div>
                      </div>
                    </div>
                  ) : (
                    <div className="featured-cards-scroll">
                      {homeChill.map((track, idx) => (
                        <motion.div
                          key={track.id}
                          className="featured-card glass-panel"
                          onClick={() => playTrack(track, homeChill)}
                          initial={{ opacity: 0, y: 24, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                          whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.2 } }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <div className="featured-card-cover-container">
                            <img src={track.image?.[2]?.url || track.image?.[1]?.url} alt={track.name} className="featured-card-cover" />
                            <button className="featured-card-play-btn" title="Play">
                              <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                            </button>
                          </div>
                          <span className="featured-card-title">{decodeHtml(track.name)}</span>
                          <span className="featured-card-artist">{decodeHtml(track.artists?.primary?.[0]?.name || 'Artist')}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Horizontal scrollable Workout Boosters row */}
                <div className="featured-section" style={{ marginTop: '24px' }}>
                  <div className="featured-section-header">
                    <h2>🎉 Party Anthems</h2>
                  </div>
                  {homeWorkoutLoading ? (
                    <div className="main-loading">
                      <div className="bounce-loader">
                        <div></div><div></div><div></div>
                      </div>
                    </div>
                  ) : (
                    <div className="featured-cards-scroll">
                      {homeWorkout.map((track, idx) => (
                        <motion.div
                          key={track.id}
                          className="featured-card glass-panel"
                          onClick={() => playTrack(track, homeWorkout)}
                          initial={{ opacity: 0, y: 24, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                          whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.2 } }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <div className="featured-card-cover-container">
                            <img src={track.image?.[2]?.url || track.image?.[1]?.url} alt={track.name} className="featured-card-cover" />
                            <button className="featured-card-play-btn" title="Play">
                              <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                            </button>
                          </div>
                          <span className="featured-card-title">{decodeHtml(track.name)}</span>
                          <span className="featured-card-artist">{decodeHtml(track.artists?.primary?.[0]?.name || 'Artist')}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Podcasts Section (Mock database of real Shows) */}
            {homeFilter === 'podcasts' && (
              <div className="podcasts-section">
                <h2>Trending Podcasts & Shows</h2>
                <div className="featured-cards-scroll">
                  {MOCK_PODCAST_SHOWS.map(show => (
                    <div key={show.id} className="featured-card glass-panel" onClick={() => navigate(`/podcast-show/${show.id}`)}>
                      <div className="featured-card-cover-container" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                        <img src={show.image[2].url || show.image[1].url} alt={show.name} className="featured-card-cover" />
                        <button className="featured-card-play-btn" title="View Show" onClick={(e) => { e.stopPropagation(); navigate(`/podcast-show/${show.id}`); }}>
                          <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                        </button>
                      </div>
                      <span className="featured-card-title">{show.name}</span>
                      <span className="featured-card-artist">Podcast Show · {show.publisher}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending / Episode Section */}
            <div className="trending-section" style={{ marginTop: '24px' }}>
              <h2>{homeFilter === 'podcasts' ? 'Latest Podcast Episodes' : '📈 Trending Today 2026'}</h2>
              {homeLoading ? (
                <div className="main-loading">
                  <div className="bounce-loader">
                    <div></div><div></div><div></div>
                  </div>
                </div>
              ) : (
                <div className="song-list-table">
                  {(homeFilter === 'podcasts' ? ALL_MOCK_EPISODES : homeTrending).map((track, idx) => (
                    <SongRow 
                      key={track.id} 
                      track={track} 
                      index={idx}
                      customPlaylists={customPlaylists}
                      setCustomPlaylists={setCustomPlaylists}
                      playlistTracks={homeFilter === 'podcasts' ? ALL_MOCK_EPISODES : homeTrending}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}


        {/* VIEW 2: SEARCH */}
        {currentView === 'search' && (
          <motion.div
            className="view-search"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Search Input bar */}
            <form onSubmit={handleSearchSubmit} className="search-bar-form">
              <div className="search-input-wrapper glass-panel">
                <SearchIcon size={20} className="search-input-icon" />
                <input 
                  type="text" 
                  placeholder="What do you want to listen to?" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="clear-search-btn" onClick={() => { setSearchQuery(''); setSearchResults(null); }}>
                    ×
                  </button>
                )}
              </div>
            </form>

            {/* Search History */}
            {!searchResults && !searchLoading && searchHistory.length > 0 && (
              <div className="search-history-section" style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Recent Searches</h3>
                  <button 
                    onClick={() => { setSearchHistory([]); localStorage.removeItem('tunely_search_history'); }}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  >
                    Clear All
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {searchHistory.map((query, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setSearchQuery(query)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 20, fontSize: 12, color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      <span>{query}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = searchHistory.filter((_, i) => i !== idx);
                          setSearchHistory(next);
                          localStorage.setItem('tunely_search_history', JSON.stringify(next));
                        }}
                        style={{
                          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)',
                          cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', padding: '0 2px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grid categories when no query */}
            {!searchResults && !searchLoading && (
              <div className="categories-grid-section">
                <h2>Browse All</h2>
                <div className="categories-grid">
                  {[
                    { name: 'Pop Hits', color: 'from-pink-500 to-indigo-600' },
                    { name: 'Lo-Fi Chill', color: 'from-purple-600 to-blue-500' },
                    { name: 'Arijit Hits', color: 'from-emerald-500 to-teal-600' },
                    { name: 'Workout Beats', color: 'from-orange-500 to-rose-600' },
                    { name: 'Hip Hop', color: 'from-yellow-500 to-amber-600' },
                    { name: 'Retro Vibes', color: 'from-cyan-500 to-blue-600' }
                  ].map((cat, idx) => (
                    <div 
                      key={idx} 
                      className={`category-card bg-gradient-to-br ${cat.color}`}
                      onClick={() => handleCategoryClick(cat.name)}
                    >
                      <h3>{cat.name}</h3>
                      <div className="category-overlay-icon">
                        <Compass size={24} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search results loading */}
            {searchLoading && (
              <div className="main-loading">
                <div className="bounce-loader">
                  <div></div><div></div><div></div>
                </div>
              </div>
            )}

            {/* Search results output */}
            {searchResults && !searchLoading && (
              <div className="search-results">
                {/* Categorized Search Tabs */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
                  <button
                    onClick={() => setSearchTab('songs')}
                    style={{
                      background: 'transparent', border: 'none',
                      color: searchTab === 'songs' ? '#00e5ff' : 'rgba(255,255,255,0.5)',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      position: 'relative', padding: '4px 8px'
                    }}
                  >
                    Songs
                    {searchTab === 'songs' && (
                      <span style={{ position: 'absolute', bottom: -11, left: 0, right: 0, height: 2, background: '#00e5ff', borderRadius: 2 }} />
                    )}
                  </button>
                  <button
                    onClick={() => setSearchTab('albums')}
                    style={{
                      background: 'transparent', border: 'none',
                      color: searchTab === 'albums' ? '#00e5ff' : 'rgba(255,255,255,0.5)',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      position: 'relative', padding: '4px 8px'
                    }}
                  >
                    Albums ({searchResults.albums?.length || 0})
                    {searchTab === 'albums' && (
                      <span style={{ position: 'absolute', bottom: -11, left: 0, right: 0, height: 2, background: '#00e5ff', borderRadius: 2 }} />
                    )}
                  </button>
                </div>

                {searchTab === 'songs' && (
                  searchResults.songs.length === 0 ? (
                    <div className="empty-results">No matches found for "{searchQuery}"</div>
                  ) : (
                    <>
                      {/* Top Split Layout: Top Result (Left) & Compact list of next 4 songs (Right) */}
                      <div className="search-split-layout">
                        
                        {/* Left: Top Result Card */}
                        <div className="top-result-section">
                          <h2>Top Result</h2>
                          <div 
                            className="top-result-card glass-panel"
                            onClick={() => playTrack(searchResults.songs[0], searchResults.songs)}
                          >
                            <img 
                              src={searchResults.songs[0].image?.[2]?.url || searchResults.songs[0].image?.[1]?.url} 
                              alt={decodeHtml(searchResults.songs[0].name)} 
                              className="top-result-cover"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="top-result-info">
                              <span className="top-result-name">{decodeHtml(searchResults.songs[0].name)}</span>
                              <div className="top-result-artist-row">
                                <span className="top-result-tag">Song</span>
                                <span className="bullet">•</span>
                                <span className="top-result-artist-name">{decodeHtml(searchResults.songs[0].artists?.primary?.map(a => a.name).join(', ') || 'Unknown Artist')}</span>
                              </div>
                            </div>
                            <button 
                              className="top-result-play-btn" 
                              title="Play"
                              onClick={(e) => {
                                e.stopPropagation();
                                playTrack(searchResults.songs[0], searchResults.songs);
                              }}
                            >
                              <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />
                            </button>
                          </div>
                        </div>

                        {/* Right: Next 4 Tracks */}
                        {searchResults.songs.length > 1 && (
                          <div className="songs-list-column">
                            <h2>Songs</h2>
                            <div className="compact-song-list">
                              {searchResults.songs.slice(1, 5).map((track, idx) => (
                                <SongRow 
                                  key={track.id} 
                                  track={track} 
                                  index={idx}
                                  customPlaylists={customPlaylists}
                                  setCustomPlaylists={setCustomPlaylists}
                                  playlistTracks={searchResults.songs}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom: Remaining Tracks list */}
                      {searchResults.songs.length > 5 && (
                        <div className="remaining-matches-section">
                          <h2>More Matches</h2>
                          <div className="song-list-table">
                            {searchResults.songs.slice(5).map((track, idx) => (
                              <SongRow 
                                key={track.id} 
                                track={track} 
                                index={idx + 4}
                                customPlaylists={customPlaylists}
                                  setCustomPlaylists={setCustomPlaylists}
                                playlistTracks={searchResults.songs}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                )}

                {searchTab === 'albums' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16, marginTop: 12 }}>
                    {(!searchResults.albums || searchResults.albums.length === 0) ? (
                      <div className="empty-results" style={{ gridColumn: '1/-1' }}>No albums found for "{searchQuery}"</div>
                    ) : (
                      searchResults.albums.map((album, idx) => (
                        <div
                          key={album.id || idx}
                          onClick={() => {
                            navigate(`/album/${album.id}`);
                          }}
                          style={{
                            background: 'rgba(15, 17, 28, 0.4)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: 16, padding: 12, cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'left'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.backgroundColor = 'rgba(15, 17, 28, 0.4)'; }}
                        >
                          <div style={{ position: 'relative', paddingBottom: '100%', borderRadius: 10, overflow: 'hidden', marginBottom: 10, background: 'rgba(255,255,255,0.03)' }}>
                            <img
                              src={album.image?.[2]?.url || album.image?.[1]?.url || 'https://via.placeholder.com/150'}
                              alt={decodeHtml(album.name)}
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {decodeHtml(album.name)}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                            {album.year} • {album.artists?.primary?.map(a => a.name).join(', ') || album.artist || 'Various'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 3 & 4: PLAYLIST / ALBUM DETAILS */}
        {(currentView === 'playlist' || currentView === 'album') && (
          <div className="view-detail view-animate-in">
            {detailLoading ? (
              <div className="main-loading">
                <div className="bounce-loader">
                  <div></div><div></div><div></div>
                </div>
              </div>
            ) : detailData ? (
              <>
                {/* Detail Header Banner */}
                <div className="detail-header">
                  <div className="detail-cover-container">
                    {detailData.image?.[2]?.url ? (
                      <img src={detailData.image[2].url} alt={detailData.name} className="detail-cover" />
                    ) : (
                      <div className="detail-cover-placeholder">
                        <Music size={48} />
                      </div>
                    )}
                  </div>
                  <div className="detail-header-meta">
                    <span className="detail-type">{currentView}</span>
                    <h1 className="detail-title">{detailData.name}</h1>
                    <p className="detail-description">{decodeHtml(detailData.description || '')}</p>
                    <div className="detail-stats">
                      <span className="stat-highlight">
                        {detailData.songs?.length || detailData.songCount || 0} songs
                      </span>
                      {detailData.year && <span> · {detailData.year}</span>}
                      {detailData.playCount && <span> · {detailData.playCount.toLocaleString()} plays</span>}
                    </div>
                  </div>
                </div>

                {/* Playlist Action Bar */}
                <div className="detail-actions">
                  <button 
                    className="detail-play-btn"
                    onClick={() => playAllTracks(detailData.songs)}
                    disabled={!detailData.songs || detailData.songs.length === 0}
                  >
                    <Play size={20} fill="currentColor" />
                    <span>Play All</span>
                  </button>
                </div>

                {/* Tracklist List */}
                <div className="tracklist-container">
                  <div className="tracklist-header-row">
                    <div className="header-col index-col">#</div>
                    <div className="header-col title-col">Title</div>
                    <div className="header-col album-col">Album</div>
                    <div className="header-col duration-col"><Clock size={16} /></div>
                  </div>
                  <div className="tracklist-body">
                    {detailData.songs && detailData.songs.length > 0 ? (
                      detailData.songs.map((track, idx) => (
                        <SongRow 
                          key={track.id} 
                          track={track} 
                          index={idx}
                          customPlaylists={customPlaylists}
                          setCustomPlaylists={setCustomPlaylists}
                          playlistTracks={detailData.songs}
                        />
                      ))
                    ) : (
                      <div className="empty-tracklist">No songs inside this playlist yet</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-results">Unable to load details. Please verify your connection.</div>
            )}
          </div>
        )}

        {/* VIEW 5: CUSTOM PLAYLIST DETAIL */}
        {currentView === 'custom' && (
          <div className="view-detail view-animate-in">
            {detailData ? (
              <>
                {/* Detail Header Banner */}
                <div className="detail-header">
                  <div className="detail-cover-container custom-playlist-banner-art">
                    <div className="detail-cover-placeholder">
                      <Music size={48} />
                    </div>
                  </div>
                  <div className="detail-header-meta">
                    <span className="detail-type">Custom Playlist</span>
                    <h1 className="detail-title">{detailData.name}</h1>
                    <p className="detail-description">Create your own personal mixtape. Add any song search results to this playlist.</p>
                    <div className="detail-stats">
                      <span className="stat-highlight">{detailData.songs?.length || 0} songs</span>
                    </div>
                  </div>
                </div>

                {/* Playlist Action Bar */}
                <div className="detail-actions">
                  <button 
                    className="detail-play-btn"
                    onClick={() => playAllTracks(detailData.songs)}
                    disabled={!detailData.songs || detailData.songs.length === 0}
                  >
                    <Play size={20} fill="currentColor" />
                    <span>Play Mix</span>
                  </button>
                </div>

                {/* Tracklist List */}
                <div className="tracklist-container">
                  <div className="tracklist-header-row">
                    <div className="header-col index-col">#</div>
                    <div className="header-col title-col">Title</div>
                    <div className="header-col album-col">Album</div>
                    <div className="header-col duration-col"><Clock size={16} /></div>
                  </div>
                  <div className="tracklist-body">
                    {detailData.songs && detailData.songs.length > 0 ? (
                      detailData.songs.map((track, idx) => (
                        <SongRow 
                          key={track.id} 
                          track={track} 
                          index={idx}
                          customPlaylists={customPlaylists}
                          setCustomPlaylists={setCustomPlaylists}
                          playlistTracks={detailData.songs}
                          showRemove={true}
                          onRemove={() => {
                            if (detailData.id === 'liked') {
                              toggleLikeTrack(track);
                            } else {
                              const updated = customPlaylists.map(pl => {
                                  if (pl.id === detailData.id) {
                                    return {
                                      ...pl,
                                      songs: pl.songs.filter(s => s.id !== track.id)
                                    };
                                  }
                                  return pl;
                              });
                              setCustomPlaylists(updated);
                              localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));
                            }
                          }}
                        />
                      ))
                    ) : (
                      <div className="empty-tracklist-placeholder">
                        <Compass size={32} />
                        <h3>Your playlist is empty</h3>
                        <p>Go to the <strong>Search</strong> tab to find songs and click the "+" button to populate your playlist!</p>
                        <button className="go-search-btn" onClick={() => { navigate('/search'); }}>
                          Go to Search
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-results">Playlist not found.</div>
            )}
          </div>
        )}

        {/* VIEW: PODCAST SHOW DETAIL */}
        {currentView === 'podcast-show' && (
          <div className="view-detail view-animate-in">
            {detailData ? (
              <>
                {/* Detail Header Banner */}
                <div className="detail-header podcast-show-banner" style={{ background: 'linear-gradient(to bottom, rgba(139, 92, 246, 0.2), rgba(10, 10, 15, 0))' }}>
                  <div className="detail-cover-container" style={{ width: '190px', height: '190px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
                    <img src={detailData.image?.[2]?.url || detailData.image?.[1]?.url} alt={detailData.name} className="detail-cover-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div className="detail-header-meta">
                    <span className="detail-type" style={{ background: 'var(--primary)', color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', width: 'fit-content', letterSpacing: '0.05em' }}>PODCAST SHOW</span>
                    <h1 className="detail-title" style={{ fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: '800', margin: '8px 0', lineHeight: 1.1 }}>{detailData.name}</h1>
                    <p className="detail-description" style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.4, margin: '4px 0 12px' }}>{detailData.description}</p>
                    <div className="detail-stats" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span className="stat-highlight" style={{ fontWeight: '600', color: 'var(--text-main)' }}>{detailData.publisher}</span>
                      <span>•</span>
                      <span>{detailData.episodes?.length || 0} episodes</span>
                    </div>
                  </div>
                </div>

                {/* Podcast Episodes list */}
                <div className="detail-tracks-container" style={{ padding: '0 24px 24px' }}>
                  <div className="podcast-episodes-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                    {detailData.episodes?.map((episode) => (
                      <div 
                        key={episode.id} 
                        className="podcast-episode-card glass-panel" 
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          padding: '16px', 
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}
                        onClick={() => playTrack(episode, detailData.episodes)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <button 
                            className="episode-play-icon-btn" 
                            style={{ 
                              width: '40px', 
                              height: '40px', 
                              borderRadius: '50%', 
                              background: 'var(--primary)', 
                              color: '#000', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              border: 'none',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{episode.name}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>{episode.description}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', paddingLeft: '56px', fontSize: '12px', color: 'var(--text-dimmed)' }}>
                          <span>{episode.releaseDate}</span>
                          <span>•</span>
                          <span>{formatDuration(episode.duration)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-results">Podcast show not found.</div>
            )}
          </div>
        )}

        {/* VIEW 6: LIBRARY */}
        {currentView === 'library' && (
          <div className="view-library view-animate-in">
            {/* Filter pills */}
            <div className="library-filter-pills">
              <button className="lib-pill active">Playlists</button>
              <button className="lib-pill">Albums</button>
            </div>

            {/* Custom Playlists */}
            <div className="library-header-row">
              <h3 className="lib-section-title">My Playlists</h3>
              <div className="library-actions">
                <button className="lib-action-btn-secondary" onClick={() => setShowImportModal(true)}>
                  <Download size={13} style={{ marginRight: 6 }} />
                  Import Spotify
                </button>
              </div>
            </div>
            
            {/* Static Liked Songs Playlist Card */}
            <div
              className="lib-item liked-songs-lib-card"
              onClick={() => { navigate('/custom/liked'); }}
              style={{ 
                background: 'rgba(0, 229, 255, 0.03)',
                border: '1px solid rgba(0, 229, 255, 0.15)',
                borderRadius: '10px',
                marginBottom: '12px'
              }}
            >
              <div className="lib-item-art" style={{
                background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(0, 229, 255, 0.3))',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                boxShadow: '0 0 10px rgba(0, 229, 255, 0.2)'
              }}>
                <Heart size={20} fill="currentColor" />
              </div>
              <div className="lib-item-meta">
                <span className="lib-item-name" style={{ color: '#fff', fontWeight: '600' }}>Liked Songs</span>
                <span className="lib-item-sub">Auto-populated playlist · {likedSongsMetadata.length} songs</span>
              </div>
            </div>

            {customPlaylists.map(playlist => (
              <div
                key={playlist.id}
                className="lib-item"
                onClick={() => { navigate(`/custom/${playlist.id}`); }}
              >
                <div className="lib-item-art custom-art">
                  <Music size={20} />
                </div>
                <div className="lib-item-meta">
                  <span className="lib-item-name">{playlist.name}</span>
                  <span className="lib-item-sub">Playlist · {playlist.songs?.length || 0} songs</span>
                </div>
                <button
                  className="lib-delete-btn"
                  title="Delete playlist"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete the playlist "${playlist.name}"?`)) {
                      const updated = customPlaylists.filter(p => p.id !== playlist.id);
                      setCustomPlaylists(updated);
                      localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {/* Featured Playlists */}
            <h3 className="lib-section-title">Featured</h3>
            {PRE_CONFIGURED_PLAYLISTS.map(playlist => (
              <div
                key={playlist.id}
                className="lib-item"
                onClick={() => { navigate(`/${playlist.type}/${playlist.id}`); }}
              >
                <div className="lib-item-art featured-art">
                  <ListMusic size={20} />
                </div>
                <div className="lib-item-meta">
                  <span className="lib-item-name">{playlist.name}</span>
                  <span className="lib-item-sub">{playlist.type === 'album' ? 'Album' : 'Playlist'} · Tunely</span>
                </div>
                <ChevronLeft size={18} style={{ transform: 'rotate(180deg)', color: 'var(--text-dimmed)', flexShrink: 0 }} />
              </div>
            ))}

            {/* Create playlist CTA if empty */}
            {customPlaylists.length === 0 && (
              <div className="lib-empty-cta">
                <div className="lib-empty-icon"><Plus size={28} /></div>
                <h3>Create your first playlist</h3>
                <p>Tap the + button above to get started</p>
                <button className="lib-create-btn" onClick={createNewPlaylist}>Create Playlist</button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Spotify Import Modal */}
      {showImportModal && (
        <div className="import-modal-overlay" onClick={() => !importStatus.loading && setShowImportModal(false)}>
          <div className="import-modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Import Spotify Playlist</h2>
            <p className="import-description">
              Paste a public Spotify playlist link below to search and match its songs on Tunely.
            </p>
            
            {importStatus.loading ? (
              <div className="import-loading-container">
                <div className="import-spinner-circle"></div>
                <div className="import-status-text">{importStatus.text}</div>
                {importStatus.total > 0 && (
                  <div className="import-progress-bar-container">
                    <div className="import-progress-bar-bg">
                      <div 
                        className="import-progress-bar" 
                        style={{ width: `${(importStatus.progress / importStatus.total) * 100}%` }}
                      ></div>
                    </div>
                    <span className="import-progress-label">
                      {importStatus.progress} / {importStatus.total} matched
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <input 
                  type="text"
                  placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  className="import-url-input"
                  disabled={importStatus.loading}
                />
                
                {importStatus.error && (
                  <div className="import-error-msg">{importStatus.error}</div>
                )}

                <div className="import-modal-actions">
                  <button 
                    className="import-btn-cancel" 
                    onClick={() => setShowImportModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="import-btn-confirm" 
                    onClick={handleStartImport}
                    disabled={!spotifyUrl.trim()}
                  >
                    Start Import
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Embedded CSS for MainContent styling */}
      <style>{`
        .main-content {
          flex: 1;
          height: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: rgba(7, 7, 10, 0.25);
          position: relative;
        }

        .content-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px 140px; /* Buffer bottom space for the player bar */
        }

        .header-update-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          padding: 6px 12px;
          color: var(--text-main);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-right: 4px;
        }

        .header-update-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: var(--primary);
          box-shadow: 0 0 10px var(--primary-glow);
        }

        .header-update-btn:active {
          transform: scale(0.95);
        }

        .update-icon {
          transition: transform 0.5s ease;
        }

        .header-update-btn:hover .update-icon {
          transform: rotate(360deg);
        }

        /* App Header Styles */
        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          height: 64px;
          background: rgba(5, 6, 11, 0.35);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 100;
          width: 100%;
          transition: all 0.2s ease;
        }

        .header-left, .header-right {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .header-center {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          min-width: 0;
          padding: 0 16px;
        }

        .desktop-nav-arrows {
          display: flex;
          gap: 8px;
        }

        .nav-arrow-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          border: none;
          color: var(--text-dimmed);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-arrow-btn:hover {
          background: rgba(0, 0, 0, 0.8);
          color: var(--text-main);
          transform: scale(1.05);
        }

        .filter-pills-container {
          display: flex;
          gap: 8px;
        }

        .header-search-container {
          width: 100%;
          max-width: 380px;
        }

        .header-search-input-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          width: 100%;
          transition: all 0.25s ease;
        }

        .header-search-input-wrapper:focus-within {
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 12px var(--primary-glow);
        }

        .header-search-input-wrapper input {
          background: transparent;
          border: none;
          color: var(--text-main);
          font-size: 13px;
          width: 100%;
          outline: none;
        }

        .desktop-profile-capsule {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px 4px 4px;
          border-radius: 20px;
          background: rgba(0, 0, 0, 0.5);
          cursor: pointer;
          border: 1px solid var(--border-color);
          transition: all 0.2s ease;
        }

        .desktop-profile-capsule:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--primary);
        }

        .profile-avatar-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #fff;
          font-size: 12px;
        }

        .profile-name-text {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main);
        }

        .mobile-left-nav, .mobile-right-actions, .view-title-label {
          display: none;
        }

        /* Home View Styles */
        .home-greeting {
          margin-bottom: 28px;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .home-greeting h1 {
          font-size: 30px;
          font-weight: 800;
          color: var(--text-main);
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #fff 40%, var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1.2;
        }

        .home-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(0, 229, 255, 0.12);
          border: 1px solid rgba(0, 229, 255, 0.3);
          color: var(--primary);
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          flex-shrink: 0;
        }

        .home-live-badge::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--primary);
          animation: live-pulse 1.5s ease-in-out infinite;
        }

        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .featured-section {
          margin-bottom: 36px;
          text-align: left;
        }

        .featured-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .featured-section h2 {
          font-size: 19px;
          font-weight: 700;
          color: var(--text-main);
          font-family: var(--font-display);
          letter-spacing: -0.02em;
        }

        .featured-cards-scroll {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          padding: 12px 4px 24px; /* Generous bottom padding so hover translate and shadows aren't clipped */
          margin-top: -4px;
          scrollbar-width: none;
        }

        .featured-cards-scroll::-webkit-scrollbar {
          display: none;
        }

        .featured-card {
          flex: 0 0 160px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.3, 0.8, 0.4, 1);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          position: relative;
          overflow: hidden;
        }

        .featured-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--primary-glow) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }

        .featured-card:hover::before {
          opacity: 0.8;
        }

        .featured-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateY(-6px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4), 0 0 15px var(--primary-glow);
        }

        .featured-card-cover-container {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          margin-bottom: 12px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.5);
        }

        .featured-card-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }

        .featured-card:hover .featured-card-cover {
          transform: scale(1.04);
        }

        .featured-card-play-btn {
          position: absolute;
          right: 12px;
          bottom: 12px;
          background: var(--primary);
          color: var(--bg-darker);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          opacity: 0;
          transform: translateY(8px);
          transition: all 0.25s cubic-bezier(0.3, 0.8, 0.4, 1);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .featured-card:hover .featured-card-play-btn {
          opacity: 1;
          transform: translateY(0);
        }

        .featured-card-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          text-align: left;
        }

        .featured-card-artist {
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          text-align: left;
        }

        .lib-delete-btn {
          color: var(--text-dimmed);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          transition: all 0.2s;
          background: transparent;
        }

        .lib-delete-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .hero-banner {
          background: linear-gradient(135deg, rgba(0,229,255,0.12) 0%, rgba(0,176,255,0.06) 40%, rgba(255,255,255,0.02) 80%, transparent 100%);
          border: 1px solid rgba(0,229,255,0.15);
          border-radius: 16px;
          padding: 36px 40px;
          margin-bottom: 32px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          position: relative;
          overflow: hidden;
        }

        .hero-banner::before {
          content: '';
          position: absolute;
          left: -60px;
          top: -60px;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: var(--primary);
          filter: blur(120px);
          opacity: 0.1;
          pointer-events: none;
        }

        .hero-banner::after {
          content: '';
          position: absolute;
          right: -50px;
          top: -50px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: #00b0ff;
          filter: blur(100px);
          opacity: 0.1;
          pointer-events: none;
        }

        .hero-tag {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          background: var(--primary);
          color: var(--bg-darker);
          padding: 4px 8px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .hero-banner h1 {
          font-size: 44px;
          font-weight: 800;
          margin-bottom: 12px;
          line-height: 1.05;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #fff 50%, var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-banner p {
          font-size: 15px;
          color: var(--text-muted);
          max-width: 550px;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .hero-play-btn {
          background: var(--primary);
          color: var(--bg-darker);
          font-weight: 600;
          padding: 12px 24px;
          border-radius: 24px;
          gap: 8px;
          font-size: 14px;
        }

        @media (hover: hover) {
          .hero-play-btn:hover:not(:disabled) {
            background: var(--primary-hover);
            transform: scale(1.03);
            box-shadow: 0 0 16px var(--primary-glow);
          }
        }

        .shortcuts-grid {
          margin-bottom: 32px;
          text-align: left;
        }

        .shortcuts-grid h2 {
          font-size: 19px;
          font-weight: 700;
          font-family: var(--font-display);
          letter-spacing: -0.02em;
          margin-bottom: 16px;
          color: var(--text-main);
        }

        .shortcuts-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 10px;
        }

        .shortcut-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 16px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          background: rgba(255,255,255,0.03);
          text-align: left;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.05);
          border-left: 3px solid currentColor;
        }

        .shortcut-play-btn {
          position: absolute;
          right: 16px;
          background: var(--primary);
          color: #000;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateY(8px);
          transition: all 0.25s cubic-bezier(0.3, 0.8, 0.4, 1);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          cursor: pointer;
        }

        @media (hover: hover) {
          .shortcut-card:hover .shortcut-play-btn {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .shortcut-play-btn {
            display: none !important;
          }
        }

        @media (hover: hover) {
          .shortcut-card:hover {
            background: rgba(255, 255, 255, 0.07) !important;
            transform: translateY(-2px) scale(1.01);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 10px currentColor;
            border-color: currentColor !important;
          }
        }

        .shortcut-icon-container {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          color: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .shortcut-card span {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main) !important;
        }

        @media (min-width: 769px) {
          .view-search .search-bar-form {
            display: none;
          }

          /* Desktop filter pills */
          .filter-pills-container {
            display: flex;
            gap: 8px;
          }

          .filter-pill {
            padding: 7px 18px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            background: rgba(255,255,255,0.07);
            color: var(--text-muted);
            white-space: nowrap;
            border: 1px solid rgba(255,255,255,0.08);
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            cursor: pointer;
          }

          .filter-pill:hover {
            background: rgba(255,255,255,0.1);
            color: var(--text-main);
          }

          .filter-pill.active {
            background: var(--primary);
            color: var(--bg-darker);
            border-color: var(--primary);
            box-shadow: 0 2px 10px var(--primary-glow);
          }
        }

        .trending-section {
          text-align: left;
        }

        .trending-section h2 {
          font-size: 19px;
          font-weight: 700;
          font-family: var(--font-display);
          letter-spacing: -0.02em;
          margin-bottom: 16px;
        }

        /* Search View Styles */
        .search-bar-form {
          margin-bottom: 32px;
        }

        .search-input-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 18px;
          border-radius: 24px;
          width: 100%;
          max-width: 450px;
          background: rgba(15, 15, 22, 0.8);
          border: 1px solid var(--border-color);
        }

        .search-input-wrapper:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 10px rgba(29, 185, 84, 0.15);
        }

        .search-input-icon {
          color: var(--text-muted);
        }

        .search-input-wrapper input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-main);
          font-family: inherit;
          font-size: 14px;
        }

        .clear-search-btn {
          font-size: 20px;
          color: var(--text-muted);
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }

        @media (hover: hover) {
          .clear-search-btn:hover {
            color: var(--text-main);
            background: var(--bg-hover);
          }
        }

        .categories-grid-section {
          text-align: left;
        }

        .categories-grid-section h2 {
          font-size: 20px;
          margin-bottom: 16px;
        }

        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
        }

        .category-card {
          position: relative;
          height: 110px;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .category-card h3 {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          word-wrap: break-word;
          text-align: left;
        }

        .category-overlay-icon {
          position: absolute;
          right: -10px;
          bottom: -10px;
          color: rgba(255,255,255,0.15);
          transform: rotate(25deg);
          transition: transform 0.3s;
        }

        @media (hover: hover) {
          .category-card:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 8px 16px rgba(0,0,0,0.3);
          }

          .category-card:hover .category-overlay-icon {
            transform: rotate(10deg) scale(1.2);
            color: rgba(255,255,255,0.25);
          }
        }

        .bg-gradient-to-br {
          background-size: 200% 200%;
        }
        
        .from-pink-500 { background: linear-gradient(135deg, #3b1128 0%, #111827 100%); border: 1px solid rgba(236,72,153,0.15); }
        .from-purple-600 { background: linear-gradient(135deg, #220f48 0%, #0c0f1d 100%); border: 1px solid rgba(139,92,246,0.15); }
        .from-emerald-500 { background: linear-gradient(135deg, #053326 0%, #031c15 100%); border: 1px solid rgba(16,185,129,0.15); }
        .from-orange-500 { background: linear-gradient(135deg, #4f1d0b 0%, #27060f 100%); border: 1px solid rgba(249,115,22,0.15); }
        .from-yellow-500 { background: linear-gradient(135deg, #451e06 0%, #09090b 100%); border: 1px solid rgba(245,158,11,0.15); }
        .from-cyan-500 { background: linear-gradient(135deg, #0f2e42 0%, #061521 100%); border: 1px solid rgba(6,182,212,0.15); }

        .search-results {
          text-align: left;
        }

        .search-results h2 {
          font-size: 20px;
          margin-bottom: 16px;
        }

        .empty-results {
          color: var(--text-dimmed);
          font-size: 15px;
          padding: 40px 0;
          text-align: center;
        }

        .search-split-layout {
          display: flex;
          gap: 24px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }

        .top-result-section {
          flex: 1;
          min-width: 280px;
        }

        .songs-list-column {
          flex: 1.5;
          min-width: 320px;
        }

        .top-result-card {
          padding: 24px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          cursor: pointer;
          position: relative;
          height: calc(100% - 36px);
          min-height: 220px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @media (hover: hover) {
          .top-result-card:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(29, 185, 84, 0.2);
          }
        }

        .top-result-cover {
          width: 92px;
          height: 92px;
          border-radius: 6px;
          object-fit: cover;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          margin-bottom: 20px;
        }

        .top-result-info {
          display: flex;
          flex-direction: column;
          width: 100%;
          min-width: 0;
        }

        .top-result-name {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .top-result-artist-row {
          font-size: 13px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          min-width: 0;
        }

        .top-result-artist-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        .top-result-tag {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(255,255,255,0.06);
          color: var(--text-main);
          padding: 3px 10px;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .top-result-artist-row .bullet {
          display: none;
        }

        .top-result-play-btn {
          position: absolute;
          right: 24px;
          bottom: 24px;
          background: var(--primary);
          color: var(--bg-darker);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          opacity: 0;
          transform: translateY(8px);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 6px 16px rgba(29, 185, 84, 0.3);
        }

        @media (hover: hover) {
          .top-result-card:hover .top-result-play-btn {
            opacity: 1;
            transform: translateY(0);
          }

          .top-result-play-btn:hover {
            background: var(--primary-hover);
            transform: scale(1.08) !important;
          }
        }

        .compact-song-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .remaining-matches-section {
          margin-top: 24px;
        }

        .remaining-matches-section h2 {
          font-size: 20px;
          margin-bottom: 16px;
        }

        /* Detail View Styles (Albums, Playlists) */
        .view-detail {
          text-align: left;
        }

        .detail-header {
          display: flex;
          align-items: flex-end;
          gap: 28px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .detail-cover-container {
          width: 192px;
          height: 192px;
          border-radius: 8px;
          overflow: hidden;
          background: rgba(255,255,255,0.03);
          box-shadow: 0 12px 32px rgba(0,0,0,0.5);
          border: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .custom-playlist-banner-art {
          background: linear-gradient(135deg, var(--bg-hover) 0%, var(--bg-active) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
        }

        .detail-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .detail-cover-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        .detail-header-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex: 1;
          min-width: 250px;
        }

        .detail-type {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--primary);
          margin-bottom: 8px;
        }

        .detail-title {
          font-size: 38px;
          font-weight: 700;
          line-height: 1.1;
          margin-bottom: 12px;
          color: #fff;
        }

        .detail-description {
          font-size: 14px;
          color: var(--text-muted);
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .detail-stats {
          font-size: 13px;
          color: var(--text-dimmed);
          display: flex;
          gap: 6px;
        }

        .stat-highlight {
          color: var(--text-main);
          font-weight: 500;
        }

        .detail-actions {
          margin-bottom: 24px;
        }

        .detail-play-btn {
          background: var(--primary);
          color: var(--bg-darker);
          font-weight: 600;
          padding: 12px 28px;
          border-radius: 24px;
          gap: 8px;
          font-size: 15px;
          box-shadow: 0 4px 12px var(--primary-glow);
        }

        @media (hover: hover) {
          .detail-play-btn:hover:not(:disabled) {
            background: var(--primary-hover);
            transform: scale(1.03);
          }
        }

        /* Tracklist layout styles */
        .tracklist-container {
          display: flex;
          flex-direction: column;
        }

        .tracklist-header-row {
          display: flex;
          padding: 8px 16px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-dimmed);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        .header-col {
          display: flex;
          align-items: center;
        }

        .index-col { width: 40px; }
        .title-col { flex: 2; }
        .album-col { flex: 1.5; padding: 0 16px; }
        .duration-col { width: 100px; justify-content: flex-end; }

        .tracklist-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .empty-tracklist {
          padding: 40px 0;
          color: var(--text-dimmed);
          text-align: center;
          font-size: 14px;
        }

        /* Custom playlist elements */
        .custom-track-row-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        
        .custom-track-row-wrapper .song-row {
          flex: 1;
        }

        .empty-tracklist-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: var(--text-dimmed);
          gap: 12px;
        }

        .empty-tracklist-placeholder h3 {
          font-size: 18px;
          color: var(--text-main);
          font-weight: 600;
        }

        .empty-tracklist-placeholder p {
          font-size: 14px;
          max-width: 320px;
          line-height: 1.5;
          margin-bottom: 8px;
        }

        .go-search-btn {
          background: rgba(255,255,255,0.05);
          color: var(--text-main);
          border: 1px solid var(--border-color);
          padding: 8px 20px;
          border-radius: 18px;
          font-size: 13px;
          font-weight: 500;
        }

        @media (hover: hover) {
          .go-search-btn:hover {
            background: var(--primary);
            color: var(--bg-darker);
            border-color: var(--primary);
          }
        }

        /* Generic Loading Bouncer */
        .main-loading {
          padding: 80px 0;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .bounce-loader {
          display: flex;
          gap: 6px;
        }

        .bounce-loader div {
          width: 8px;
          height: 8px;
          background-color: var(--primary);
          border-radius: 50%;
          animation: bounce 0.6s infinite alternate;
        }

        .bounce-loader div:nth-child(2) { animation-delay: 0.15s; }
        .bounce-loader div:nth-child(3) { animation-delay: 0.3s; }

        @keyframes bounce {
          to { transform: translateY(-8px); opacity: 0.3; }
        }

        /* Mobile Responsive Overrides */
        .app-header {
          display: flex;
        }

        @media (max-width: 768px) {
          .app-header {
            padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 12px;
            height: auto;
            background: rgba(8, 10, 18, 0.65);
          }

          .desktop-nav-arrows, .desktop-profile-capsule, .header-search-container {
            display: none !important;
          }

          .mobile-left-nav, .mobile-right-actions {
            display: flex !important;
          }

          .header-center {
            padding: 0;
            flex: 1;
          }

          .view-title-label {
            display: block;
            font-size: 16px;
            font-weight: 700;
            color: var(--text-main);
            font-family: var(--font-display);
            text-align: center;
            width: 100%;
          }

          .view-title-truncate {
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          /* Avatar button */
          .mobile-avatar-btn {
            flex-shrink: 0;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            padding: 0;
          }

          .mobile-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: #fff;
            font-size: 14px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-display);
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          }

          /* Back button */
          .mobile-back-btn {
            flex-shrink: 0;
            color: var(--text-main);
            width: 34px;
            height: 34px;
            border-radius: 50%;
          }

          /* Filter pills (Home view) */
          .filter-pills-container {
            display: flex;
            gap: 8px;
            flex: 1;
            justify-content: flex-start;
            overflow-x: auto;
            scrollbar-width: none;
            width: 100%;
          }
          .filter-pills-container::-webkit-scrollbar { display: none; }

          .filter-pill {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            background: rgba(255,255,255,0.08);
            color: var(--text-muted);
            white-space: nowrap;
            border: 1px solid transparent;
            transition: all 0.18s;
          }

          .filter-pill.active {
            background: var(--primary);
            color: var(--bg-darker);
            border-color: var(--primary);
          }

          /* Center title text */
          .mobile-view-title {
            flex: 1;
            text-align: center;
            font-size: 16px;
            font-weight: 700;
            color: var(--text-main);
            font-family: var(--font-display);
          }

          /* Right icon button */
          .mobile-icon-btn {
            flex-shrink: 0;
            color: var(--text-main);
            width: 34px;
            height: 34px;
            border-radius: 50%;
          }

          .header-update-btn {
            padding: 8px;
            border-radius: 50%;
            margin-right: 0px;
          }

          .header-update-btn .update-text {
            display: none;
          }

          button, 
          .shortcut-card, 
          .category-card, 
          .top-result-card {
            touch-action: manipulation;
          }

          /* Ensure action buttons are visible and styled on mobile views */
          .top-result-play-btn {
            opacity: 1;
            transform: translateY(0);
          }



          .content-scroll {
            padding: 16px 16px 160px;
          }

          .home-greeting {
            margin-bottom: 16px;
          }

          .home-greeting h1 {
            font-size: 20px !important;
          }

          .hero-banner {
            display: flex !important;
            padding: 24px 20px !important;
            margin-bottom: 24px !important;
          }
          .hero-banner h1 {
            font-size: 26px !important;
          }
          .hero-banner p {
            font-size: 12px !important;
            margin-bottom: 16px !important;
          }
          .hero-play-btn {
            padding: 8px 16px !important;
            font-size: 12px !important;
          }

          /* Featured scroll section on mobile */
          .featured-section {
            margin-bottom: 24px;
          }

          .featured-cards-scroll {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding-bottom: 12px;
            scrollbar-width: none;
            mask-image: linear-gradient(to right, black 85%, transparent 100%);
            -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
          }

          .featured-card {
            flex: 0 0 144px;
            padding: 14px;
            border-radius: 14px;
          }

          .featured-card-cover-container {
            border-radius: 8px;
            margin-bottom: 10px;
          }

          .featured-card-play-btn {
            opacity: 1;
            transform: translateY(0);
            width: 30px;
            height: 30px;
            right: 6px;
            bottom: 6px;
          }

          .featured-card-title {
            font-size: 12px;
          }

          .featured-card-artist {
            font-size: 10px;
          }

          /* Category grid full-width on mobile */
          .categories-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .category-card {
            height: 76px !important;
            display: flex !important;
            align-items: center !important;
            padding: 0 20px !important;
          }

          .category-card h3 {
            font-size: 18px !important;
          }

          .category-overlay-icon {
            right: 12px !important;
            bottom: 50% !important;
            transform: translateY(50%) rotate(15deg) scale(1.2) !important;
            opacity: 0.25 !important;
          }

          /* Search Results stack on mobile */
          .search-split-layout {
            flex-direction: column !important;
            gap: 16px !important;
          }

          .top-result-section, .songs-list-column {
            width: 100% !important;
            flex: none !important;
          }

          .top-result-card {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            padding: 12px 14px !important;
            gap: 14px !important;
            height: auto !important;
            min-height: auto !important;
            position: relative;
          }

          .top-result-cover {
            width: 56px !important;
            height: 56px !important;
            margin-bottom: 0 !important;
            flex-shrink: 0;
          }

          .top-result-info {
            flex: 1 !important;
            min-width: 0 !important;
          }

          .top-result-name {
            font-size: 15px !important;
            margin-bottom: 4px !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block !important;
          }

          .top-result-artist-row {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            font-size: 12px !important;
            color: var(--text-muted) !important;
            min-width: 0 !important;
            justify-content: flex-start !important;
          }

          .top-result-artist-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
            min-width: 0;
            display: block !important;
          }

          .top-result-tag {
            font-size: 9px !important;
            padding: 1px 6px !important;
            border-radius: 4px !important;
            background: rgba(255,255,255,0.08) !important;
            color: var(--primary) !important;
            font-weight: 700;
            text-transform: uppercase;
            flex-shrink: 0;
          }

          .top-result-artist-row .bullet {
            display: inline !important;
            color: var(--text-dimmed);
          }

          .top-result-play-btn {
            position: static !important;
            opacity: 1 !important;
            transform: none !important;
            width: 38px !important;
            height: 38px !important;
            flex-shrink: 0;
            display: flex !important;
            align-items: center;
            justify-content: center;
            margin-left: auto;
          }

          /* 2-column shortcut grid like Spotify */
          .shortcuts-container {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .shortcut-card {
            padding: 10px;
            gap: 12px;
          }

          .shortcut-card span {
            font-size: 12px;
          }

          .detail-header {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 16px;
          }

          .detail-header-meta {
            align-items: center;
          }

          .detail-title {
            font-size: 24px;
          }

          /* Library View */
          .view-library {
            text-align: left;
          }

          .library-filter-pills {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
          }

          .lib-pill {
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            background: rgba(255,255,255,0.07);
            color: var(--text-muted);
            border: 1px solid rgba(255,255,255,0.08);
            transition: all 0.2s;
          }

          .lib-pill.active {
            background: rgba(255,255,255,0.15);
            color: var(--text-main);
            border-color: rgba(255,255,255,0.2);
          }

          .lib-section-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-dimmed);
            margin-bottom: 10px;
            margin-top: 20px;
          }

          .lib-item {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 12px 16px;
            margin-bottom: 8px;
            background: rgba(255,255,255,0.015);
            border: 1px solid rgba(255,255,255,0.03);
            cursor: pointer;
            border-radius: 12px;
            transition: all 0.2s;
          }

          .lib-item:hover {
            background: rgba(255,255,255,0.04);
            border-color: rgba(255,255,255,0.08);
          }

          .lib-item:active {
            background: rgba(255,255,255,0.06) !important;
          }

          .lib-item-art {
            width: 56px;
            height: 56px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 22px;
          }

          .custom-art {
            background: linear-gradient(135deg, rgba(0,229,255,0.2), rgba(0,229,255,0.05));
            color: var(--primary);
            border: 1px solid var(--border-color);
          }

          .featured-art {
            background: linear-gradient(135deg, rgba(108,92,231,0.3), rgba(108,92,231,0.08));
            color: #a78bfa;
            border: 1px solid rgba(139,92,246,0.2);
          }

          .lib-item-meta {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 3px;
            overflow: hidden;
          }

          .lib-item-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-main);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .lib-item-sub {
            font-size: 12px;
            color: var(--text-dimmed);
          }

          /* Empty library CTA */
          .lib-empty-cta {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 10px;
            padding: 48px 20px;
            color: var(--text-dimmed);
          }

          .lib-empty-icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary);
            margin-bottom: 8px;
          }

          .lib-empty-cta h3 {
            font-size: 17px;
            color: var(--text-main);
          }

          .lib-empty-cta p {
            font-size: 13px;
            max-width: 240px;
          }

          .lib-create-btn {
            margin-top: 8px;
            background: var(--primary);
            color: var(--bg-darker);
            font-weight: 700;
            padding: 10px 24px;
            border-radius: 24px;
            font-size: 13px;
          }
        }

        /* Spotify Import Styles */
        .library-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          margin-top: 16px;
        }

        .library-actions {
          display: flex;
          gap: 10px;
        }

        .lib-action-btn-secondary {
          background: rgba(0, 229, 255, 0.08);
          border: 1px solid rgba(0, 229, 255, 0.2);
          color: var(--primary);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          transition: all 0.2s ease;
        }

        .lib-action-btn-secondary:hover {
          background: rgba(0, 229, 255, 0.15);
          border-color: var(--primary);
          box-shadow: 0 0 10px rgba(0, 229, 255, 0.25);
          transform: translateY(-1px);
        }

        .import-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(2, 3, 6, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: fadeIn 0.25s ease;
        }

        .import-modal-content {
          width: 95%;
          max-width: 440px;
          background: rgba(10, 12, 22, 0.8) !important;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(0, 229, 255, 0.05);
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .import-modal-content h2 {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          font-family: var(--font-display);
        }

        .import-description {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.5;
          text-align: left;
        }

        .import-url-input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          font-size: 14px;
          color: #fff;
          width: 100%;
          outline: none;
          transition: border-color 0.2s;
        }

        .import-url-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 10px rgba(0, 229, 255, 0.15);
        }

        .import-error-msg {
          font-size: 12px;
          color: #ff4d4d;
          background: rgba(255, 77, 77, 0.08);
          padding: 10px;
          border-radius: 6px;
          border: 1px solid rgba(255, 77, 77, 0.2);
          text-align: left;
        }

        .import-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }

        .import-btn-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: var(--text-main);
          padding: 10px 18px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .import-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .import-btn-confirm {
          background: linear-gradient(135deg, var(--primary) 0%, #00b0ff 100%);
          border: none;
          color: #05060b;
          padding: 10px 22px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 4px 15px rgba(0, 229, 255, 0.35);
          transition: all 0.2s;
        }

        .import-btn-confirm:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 229, 255, 0.5);
        }

        .import-btn-confirm:disabled {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-dimmed);
          box-shadow: none;
          cursor: not-allowed;
        }

        .import-loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 0;
          gap: 16px;
        }

        .import-spinner-circle {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0, 229, 255, 0.1);
          border-radius: 50%;
          border-top-color: var(--primary);
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .import-status-text {
          font-size: 13px;
          color: var(--text-main);
          text-align: center;
          font-weight: 500;
        }

        .import-progress-bar-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
        }

        .import-progress-bar-bg {
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
          overflow: hidden;
        }

        .import-progress-bar {
          height: 100%;
          background: linear-gradient(to right, var(--primary), #00b0ff);
          border-radius: 3px;
          transition: width 0.3s ease;
          box-shadow: 0 0 8px rgba(0, 229, 255, 0.4);
        }

        .import-progress-label {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
