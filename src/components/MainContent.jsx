import { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Play, Music, Clock, User, Heart, Compass, Eye, Menu, Plus, ChevronLeft, ListMusic, Trash2, Download } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import SongRow from './SongRow';

const API_BASE = (import.meta.env.VITE_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev').trim();

const decodeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'");
};

// In-memory cache for search results and trending data
const searchCache = new Map();
const homeCache = { data: null, ts: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const PRE_CONFIGURED_PLAYLISTS = [
  { id: '1079336813', name: 'Chill Lo-Fi Mix', type: 'playlist', description: 'Relaxing beats for focus' },
  { id: '83313988', name: 'Top Hindi Hits', type: 'playlist', description: 'Best of Bollywood' },
  { id: '1108582', name: 'Global Top 50', type: 'playlist', description: 'Worldwide chart-toppers' },
  { id: '69996470', name: 'AiSh, Vol. 4', type: 'album', description: 'Featured album' }
];

export default function MainContent({ 
  currentView, 
  setCurrentView, 
  selectedPlaylistId, 
  setSelectedPlaylistId,
  customPlaylists,
  setCustomPlaylists,
  setIsSidebarOpen,
  setIsAccountOpen,
  createNewPlaylist
}) {
  const { playTrack, queue, currentIndex, isPlaying, togglePlay, likedSongs, likedSongsMetadata, toggleLikeTrack } = useAudio();
  const { user } = useAuth() || {};
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const searchInputRef = useRef(null);

  // Home states
  const [homeTrending, setHomeTrending] = useState([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeFeatured, setHomeFeatured] = useState([]);
  const [homeFeaturedLoading, setHomeFeaturedLoading] = useState(true);
  const [podcasts, setPodcasts] = useState([]);
  const [podcastsLoading, setPodcastsLoading] = useState(false);
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

  // Fetch trending songs for Home view on mount
  useEffect(() => {
    fetchHomeTrending();
    fetchHomeFeatured();
  }, []);

  // Fetch podcasts when filter changes to podcasts
  useEffect(() => {
    if (homeFilter === 'podcasts') {
      fetchPodcasts();
    }
  }, [homeFilter]);

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
          setDetailData({
            id: 'liked',
            name: 'Liked Songs',
            type: 'custom',
            songs: likedSongsMetadata
          });
        } else {
          // Custom playlist loading
          const playlist = customPlaylists.find(p => p.id === selectedPlaylistId);
          setDetailData(playlist);
        }
      } else {
        fetchDetailData();
      }
    }
  }, [selectedPlaylistId, currentView, customPlaylists, likedSongsMetadata]);

  const fetchHomeTrending = async () => {
    // Serve from in-memory cache if fresh
    if (homeCache.data && Date.now() - homeCache.ts < CACHE_TTL) {
      setHomeTrending(homeCache.data);
      setHomeLoading(false);
      return;
    }
    setHomeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=Lofi&limit=8`);
      if (res.ok) {
        const obj = await res.json();
        const results = obj.data.results || [];
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
    setHomeFeaturedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=Bollywood%20Hits&limit=6`);
      if (res.ok) {
        const obj = await res.json();
        setHomeFeatured(obj.data.results || []);
      }
    } catch (e) {
      console.error("Error loading home featured tracks:", e);
    } finally {
      setHomeFeaturedLoading(false);
    }
  };

  const fetchPodcasts = async () => {
    if (podcasts.length > 0) return;
    setPodcastsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=Podcast%20Story&limit=6`);
      if (res.ok) {
        const obj = await res.json();
        setPodcasts(obj.data.results || []);
      }
    } catch (e) {
      console.error("Error loading podcasts:", e);
    } finally {
      setPodcastsLoading(false);
    }
  };

  const fetchDetailData = async () => {
    setDetailLoading(true);
    setDetailData(null);
    try {
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
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    // Instant result from cache, no loader flash
    const cacheKey = searchQuery.trim().toLowerCase();
    if (searchCache.has(cacheKey)) {
      setSearchResults(searchCache.get(cacheKey));
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const delayDebounceFn = setTimeout(() => {
      performSearch(searchQuery);
    }, 200); // 200ms debounce for snappy feel

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, currentView]);

  async function performSearch(query) {
    const cacheKey = query.trim().toLowerCase();
    // Return cached result if available
    if (searchCache.has(cacheKey)) {
      setSearchResults(searchCache.get(cacheKey));
      setSearchLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=${encodeURIComponent(query)}&limit=15`);
      if (res.ok) {
        const obj = await res.json();
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
        const sorted = [...resultsList].sort((a, b) => getScore(b) - getScore(a));
        const result = { songs: sorted };
        // Cache result (max 100 entries to avoid memory bloat)
        if (searchCache.size > 100) searchCache.clear();
        searchCache.set(cacheKey, result);
        setSearchResults(result);
      }
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const handleStartImport = async () => {
    const playlistIdMatch = spotifyUrl.match(/playlist\/([a-zA-Z0-9]+)/);
    if (!playlistIdMatch) {
      setImportStatus(prev => ({ ...prev, error: 'Invalid Spotify playlist link format. Make sure it contains "playlist/ID".' }));
      return;
    }
    const playlistId = playlistIdMatch[1];
    
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
      
      for (let i = 0; i < trackList.length; i++) {
        const item = trackList[i];
        const title = item.title;
        const artist = item.artist || '';
        
        setImportStatus(prev => ({
          ...prev,
          text: `Matching "${title}" by ${artist}... (${i + 1}/${trackList.length})`,
          progress: i
        }));

        try {
          const searchQuery = `${title} ${artist}`.trim();
          const searchRes = await fetch(`${API_BASE}/api/search/songs?query=${encodeURIComponent(searchQuery)}&limit=5`);
          if (searchRes.ok) {
            const searchObj = await searchRes.json();
            const results = searchObj.data.results || [];
            if (results.length > 0) {
              matchedSongs.push(results[0]);
            }
          }
        } catch (err) {
          console.error(`Error matching track ${title}:`, err);
        }
      }

      if (matchedSongs.length === 0) {
        throw new Error('No songs could be matched on Tunely.');
      }

      const newPlaylist = {
        id: `custom_${Date.now()}`,
        name: `${playlistName} (Spotify)`,
        type: 'custom',
        songs: matchedSongs
      };

      const updated = [...customPlaylists, newPlaylist];
      setCustomPlaylists(updated);
      localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));

      setImportStatus({
        loading: false,
        text: '',
        progress: 0,
        total: 0,
        error: null
      });

      setShowImportModal(false);
      setSpotifyUrl('');
      
      window.location.hash = `custom-${newPlaylist.id}`;
    } catch (err) {
      setImportStatus(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'An unknown error occurred during import.'
      }));
    }
  };

  // Quick category search handler
  const handleCategoryClick = (category) => {
    setSearchQuery(category);
    setSearchLoading(true);
    performSearch(category);
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

  return (
    <div className="main-content">
      {/* Mobile Top Bar - Spotify Style */}
      <div className="mobile-header">
        {/* Left: Avatar or Back button */}
        {(currentView === 'playlist' || currentView === 'album' || currentView === 'custom') ? (
          <button className="mobile-back-btn" onClick={() => { window.location.hash = 'library'; }} title="Back">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <button className="mobile-avatar-btn" onClick={() => setIsAccountOpen && setIsAccountOpen(true)} title="Profile">
            <div className="mobile-avatar">A</div>
          </button>
        )}

        {/* Center: View-dependent content */}
        {currentView === 'home' && (
          <div className="mobile-filter-pills">
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
          <span className="mobile-view-title">Search</span>
        )}
        {currentView === 'library' && (
          <span className="mobile-view-title">Your Library</span>
        )}
        {(currentView === 'playlist' || currentView === 'album' || currentView === 'custom') && (
          <span className="mobile-view-title" style={{ fontSize: 15, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}></span>
        )}

        {/* Right: Context actions */}
        {currentView === 'library' ? (
          <button className="mobile-icon-btn" onClick={createNewPlaylist} title="New Playlist">
            <Plus size={22} />
          </button>
        ) : currentView === 'home' || currentView === 'search' ? (
          <button className="mobile-icon-btn" onClick={() => { window.location.hash = 'search'; }} title="Search">
            <SearchIcon size={20} />
          </button>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </div>

      {/* Scrollable Container */}
      <div className="content-scroll">
        
        {/* VIEW 1: HOME */}
        {currentView === 'home' && (
          <div className="view-home">
            {/* Mobile Greeting (hidden on desktop via CSS, styled beautiful on mobile) */}
            <div className="mobile-greeting-wrapper">
              <h1>{getGreeting()}, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
            </div>

            {/* Hero banner - visible on desktop, hidden on mobile */}
            <div className="hero-banner">
              <div className="hero-tag">Trending</div>
              <h1>Discover High Fidelity</h1>
              <p>Stream over 80 million tracks smoothly. Immerse yourself in obsidian sound design, zero-lag rendering, and live lyrics.</p>
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
            </div>

            {/* If homeFilter is All or Music, show Shortcuts and Featured for You */}
            {(homeFilter === 'all' || homeFilter === 'music') && (
              <>
                {/* Quick shortcuts */}
                <div className="shortcuts-grid">
                  <h2>Quick Discoveries</h2>
                  <div className="shortcuts-container">
                    {[
                      { name: 'Lo-Fi Mix', query: 'Lofi Chill', bg: 'rgba(108, 92, 231, 0.12)', border: 'rgba(108, 92, 231, 0.25)', color: '#a78bfa' },
                      { name: 'Arijit Hits', query: 'Arijit Singh Hits', bg: 'rgba(0, 229, 255, 0.12)', border: 'rgba(0, 229, 255, 0.25)', color: '#00e5ff' },
                      { name: 'Top Pop', query: 'Pop Hits', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.25)', color: '#f43f5e' },
                      { name: 'Retro Indian', query: 'Kishore Kumar Classics', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.25)', color: '#fb923c' }
                    ].map((item, idx) => (
                      <div 
                        key={idx} 
                        className="shortcut-card"
                        style={{ 
                          background: item.bg, 
                          borderColor: item.border,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}
                        onClick={() => {
                          window.location.hash = 'search';
                          handleCategoryClick(item.query);
                        }}
                      >
                        <div className="shortcut-icon-container" style={{ background: 'rgba(255,255,255,0.05)', color: item.color }}>
                          <Music size={18} />
                        </div>
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Horizontal scrollable Featured row */}
                <div className="featured-section">
                  <h2>Featured for You</h2>
                  {homeFeaturedLoading ? (
                    <div className="main-loading">
                      <div className="bounce-loader">
                        <div></div><div></div><div></div>
                      </div>
                    </div>
                  ) : (
                    <div className="featured-cards-scroll">
                      {homeFeatured.map(track => (
                        <div key={track.id} className="featured-card glass-panel" onClick={() => playTrack(track, homeFeatured)}>
                          <div className="featured-card-cover-container">
                            <img src={track.image?.[2]?.url || track.image?.[1]?.url} alt={track.name} className="featured-card-cover" />
                            <button className="featured-card-play-btn" title="Play">
                              <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                            </button>
                          </div>
                          <span className="featured-card-title">{track.name}</span>
                          <span className="featured-card-artist">{track.artists?.primary?.[0]?.name || 'Artist'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Podcasts Section */}
            {homeFilter === 'podcasts' && (
              <div className="podcasts-section">
                <h2>Trending Podcasts & Shows</h2>
                {podcastsLoading ? (
                  <div className="main-loading">
                    <div className="bounce-loader">
                      <div></div><div></div><div></div>
                    </div>
                  </div>
                ) : podcasts.length > 0 ? (
                  <div className="featured-cards-scroll">
                    {podcasts.map(track => (
                      <div key={track.id} className="featured-card glass-panel" onClick={() => playTrack(track, podcasts)}>
                        <div className="featured-card-cover-container" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                          <img src={track.image?.[2]?.url || track.image?.[1]?.url} alt={track.name} className="featured-card-cover" />
                          <button className="featured-card-play-btn" title="Play">
                            <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                          </button>
                        </div>
                        <span className="featured-card-title">{track.name}</span>
                        <span className="featured-card-artist">Episode · Tunely Podcasts</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-results">No podcasts available right now.</div>
                )}
              </div>
            )}

            {/* Trending Section */}
            <div className="trending-section" style={{ marginTop: '24px' }}>
              <h2>{homeFilter === 'podcasts' ? 'Podcast Episodes' : 'Trending Today'}</h2>
              {homeLoading || (homeFilter === 'podcasts' && podcastsLoading) ? (
                <div className="main-loading">
                  <div className="bounce-loader">
                    <div></div><div></div><div></div>
                  </div>
                </div>
              ) : (
                <div className="song-list-table">
                  {(homeFilter === 'podcasts' ? podcasts : homeTrending).map((track, idx) => (
                    <SongRow 
                      key={track.id} 
                      track={track} 
                      index={idx}
                      customPlaylists={customPlaylists}
                      setCustomPlaylists={setCustomPlaylists}
                      playlistTracks={homeFilter === 'podcasts' ? podcasts : homeTrending}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}


        {/* VIEW 2: SEARCH */}
        {currentView === 'search' && (
          <div className="view-search">
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
                {searchResults.songs.length === 0 ? (
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
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3 & 4: PLAYLIST / ALBUM DETAILS */}
        {(currentView === 'playlist' || currentView === 'album') && (
          <div className="view-detail">
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
                    <p className="detail-description" dangerouslySetInnerHTML={{ __html: detailData.description || '' }}></p>
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
          <div className="view-detail">
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
                        <div key={track.id} className="custom-track-row-wrapper">
                          <SongRow 
                            track={track} 
                            index={idx}
                            customPlaylists={customPlaylists}
                            setCustomPlaylists={setCustomPlaylists}
                            playlistTracks={detailData.songs}
                          />
                          {/* Remove button specifically for Custom Playlists */}
                          <button 
                            className="remove-song-custom-btn"
                            title="Remove from playlist"
                            onClick={(e) => {
                              e.stopPropagation();
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
                          >
                            ×
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="empty-tracklist-placeholder">
                        <Compass size={32} />
                        <h3>Your playlist is empty</h3>
                        <p>Go to the <strong>Search</strong> tab to find songs and click the "+" button to populate your playlist!</p>
                        <button className="go-search-btn" onClick={() => { window.location.hash = 'search'; }}>
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

        {/* VIEW 6: LIBRARY */}
        {currentView === 'library' && (
          <div className="view-library">
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
              onClick={() => { window.location.hash = 'custom-liked'; }}
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
                onClick={() => { window.location.hash = `custom-${playlist.id}`; }}
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
                onClick={() => { window.location.hash = `${playlist.type}-${playlist.id}`; }}
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

        /* Home View Styles */
        .mobile-greeting-wrapper {
          display: none;
        }

        .featured-section {
          margin-bottom: 32px;
          text-align: left;
        }

        .featured-section h2 {
          font-size: 20px;
          margin-bottom: 16px;
          color: var(--text-main);
        }

        .featured-cards-scroll {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          padding-bottom: 8px;
          scrollbar-width: none;
        }

        .featured-cards-scroll::-webkit-scrollbar {
          display: none;
        }

        .featured-card {
          flex: 0 0 160px;
          display: flex;
          flex-direction: column;
          padding: 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
        }

        .featured-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(0, 229, 255, 0.25);
          transform: translateY(-4px);
        }

        .featured-card-cover-container {
          width: 136px;
          height: 136px;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          margin-bottom: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }

        .featured-card-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .featured-card-play-btn {
          position: absolute;
          right: 8px;
          bottom: 8px;
          background: var(--primary);
          color: var(--bg-darker);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          opacity: 0;
          transform: translateY(4px);
          transition: all 0.2s;
          box-shadow: 0 4px 10px rgba(0, 229, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .featured-card:hover .featured-card-play-btn {
          opacity: 1;
          transform: translateY(0);
        }

        .featured-card-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 4px;
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
          background: linear-gradient(135deg, rgba(29, 185, 84, 0.15) 0%, rgba(108, 92, 231, 0.05) 50%, transparent 100%);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 40px;
          margin-bottom: 32px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          position: relative;
          overflow: hidden;
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
          font-size: 42px;
          font-weight: 850;
          margin-bottom: 12px;
          line-height: 1.1;
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
          font-size: 20px;
          margin-bottom: 16px;
          color: var(--text-main);
        }

        .shortcuts-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }

        .shortcut-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(255,255,255,0.02);
          text-align: left;
        }

        @media (hover: hover) {
          .shortcut-card:hover {
            background: var(--bg-hover);
            transform: translateY(-2px);
            border-color: rgba(29, 185, 84, 0.2);
          }
        }

        .shortcut-icon-container {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          background: rgba(29, 185, 84, 0.1);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .shortcut-card span {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main);
        }

        .trending-section {
          text-align: left;
        }

        .trending-section h2 {
          font-size: 20px;
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
          font-weight: 800;
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

        .remove-song-custom-btn {
          position: absolute;
          right: 120px;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 24px;
          color: var(--text-dimmed);
          font-size: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          opacity: 0;
        }

        @media (hover: hover) {
          .custom-track-row-wrapper:hover .remove-song-custom-btn {
            opacity: 1;
          }

          .remove-song-custom-btn:hover {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
          }
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
        .mobile-header {
          display: none;
        }

        @media (max-width: 768px) {
          .mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 12px;
            background: rgba(8, 10, 18, 0.65);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-bottom: 1px solid var(--border-color);
            z-index: 50;
            width: 100%;
            position: sticky;
            top: 0;
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
            background: linear-gradient(135deg, #e53935, #c62828);
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
          .mobile-filter-pills {
            display: flex;
            gap: 8px;
            flex: 1;
            justify-content: flex-start;
            overflow-x: auto;
            scrollbar-width: none;
          }
          .mobile-filter-pills::-webkit-scrollbar { display: none; }

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

          .remove-song-custom-btn {
            opacity: 1;
          }

          .content-scroll {
            padding: 16px 16px 160px;
          }

          .mobile-greeting-wrapper {
            display: block;
            margin-bottom: 20px;
            text-align: left;
          }

          .mobile-greeting-wrapper h1 {
            font-size: 22px;
            font-weight: 850;
            color: var(--text-main);
            letter-spacing: -0.03em;
          }

          .hero-banner {
            display: none !important;
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
            flex: 0 0 130px;
            padding: 8px;
            border-radius: 8px;
          }

          .featured-card-cover-container {
            width: 112px;
            height: 112px;
            margin-bottom: 8px;
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
            gap: 14px;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            cursor: pointer;
            border-radius: 8px;
            transition: background 0.15s;
          }

          .lib-item:active {
            background: rgba(255,255,255,0.06) !important;
          }

          .lib-item-art {
            width: 52px;
            height: 52px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 20px;
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
