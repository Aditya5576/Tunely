import { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, Music, Clock, User, Heart, Compass, Eye, Menu } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import SongRow from './SongRow';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3000').trim();

export default function MainContent({ 
  currentView, 
  setCurrentView, 
  selectedPlaylistId, 
  setSelectedPlaylistId,
  customPlaylists,
  setCustomPlaylists,
  setIsSidebarOpen
}) {
  const { playTrack, queue, currentIndex, isPlaying, togglePlay } = useAudio();
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  // Home states
  const [homeTrending, setHomeTrending] = useState([]);
  const [homeLoading, setHomeLoading] = useState(true);

  // Playlist/Album detail states
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch trending songs for Home view on mount
  useEffect(() => {
    fetchHomeTrending();
  }, []);

  // Fetch playlist/album details when selected ID changes
  useEffect(() => {
    if (selectedPlaylistId) {
      if (currentView === 'custom') {
        // Custom playlist loading
        const playlist = customPlaylists.find(p => p.id === selectedPlaylistId);
        setDetailData(playlist);
      } else {
        fetchDetailData();
      }
    }
  }, [selectedPlaylistId, currentView, customPlaylists]);

  const fetchHomeTrending = async () => {
    setHomeLoading(true);
    try {
      // Query popular Hindi and English songs
      const res = await fetch(`${API_BASE}/api/search/songs?query=Lofi&limit=8`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        const obj = await res.json();
        setHomeTrending(obj.data.results || []);
      }
    } catch (e) {
      console.error("Error loading home page trending tracks:", e);
    } finally {
      setHomeLoading(false);
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

    setSearchLoading(true);
    const delayDebounceFn = setTimeout(() => {
      performSearch(searchQuery);
    }, 400); // 400ms debounce to prevent API spam

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, currentView]);

  async function performSearch(query) {
    try {
      const res = await fetch(`${API_BASE}/api/search/songs?query=${encodeURIComponent(query)}&limit=15`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        const obj = await res.json();
        const resultsList = obj.data.results || [];
        
        // Sorting algorithm using a multi-factor relevance score:
        // song title matches (exact/starts-with/contains), artist matches, and popularity (play count)
        const sorted = [...resultsList].sort((a, b) => {
          const q = query.toLowerCase().trim();
          
          const getScore = (track) => {
            let score = 0;
            const title = track.name.toLowerCase();
            const primaryArtists = track.artists?.primary?.map(art => art.name.toLowerCase()) || [];
            const allArtists = track.artists?.all?.map(art => art.name.toLowerCase()) || [];
            const playCount = Number(track.playCount) || 0;

            // 1. Song Title Matches
            if (title === q) {
              score += 100;
            } else if (title.startsWith(q)) {
              score += 60;
            } else if (title.includes(q)) {
              score += 30;
            }

            // 2. Artist Matches
            const exactArtist = primaryArtists.some(name => name === q) || allArtists.some(name => name === q);
            const startsArtist = primaryArtists.some(name => name.startsWith(q)) || allArtists.some(name => name.startsWith(q));
            const includesArtist = primaryArtists.some(name => name.includes(q)) || allArtists.some(name => name.includes(q));

            if (exactArtist) {
              score += 80;
            } else if (startsArtist) {
              score += 45;
            } else if (includesArtist) {
              score += 15;
            }

            // 3. Popularity Score (Logarithmic playCount mapping to give weight to most played songs)
            if (playCount > 0) {
              score += Math.log10(playCount) * 8;
            }

            return score;
          };

          return getScore(b) - getScore(a);
        });

        setSearchResults({
          songs: sorted
        });
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

  return (
    <div className="main-content">
      {/* Mobile Top Bar */}
      <div className="mobile-header">
        <button className="menu-toggle-btn" onClick={() => setIsSidebarOpen(true)} title="Open Menu">
          <Menu size={20} />
        </button>
        <div className="mobile-logo">
          <div className="logo-icon-mini"></div>
          <h2>Tunely</h2>
        </div>
        <div style={{ width: 36 }}></div>
      </div>

      {/* Scrollable Container */}
      <div className="content-scroll">
        
        {/* VIEW 1: HOME */}
        {currentView === 'home' && (
          <div className="view-home">
            {/* Hero banner */}
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

            {/* Quick shortcuts */}
            <div className="shortcuts-grid">
              <h2>Quick Discoveries</h2>
              <div className="shortcuts-container">
                {['Lo-Fi Mix', 'Arijit Hits', 'Top Pop', 'Retro Indian'].map((cat, idx) => (
                  <div 
                    key={idx} 
                    className="shortcut-card glass-panel"
                    onClick={() => {
                      window.location.hash = 'search';
                      handleCategoryClick(cat);
                    }}
                  >
                    <div className="shortcut-icon-container">
                      <Music size={18} className="shortcut-icon" />
                    </div>
                    <span>{cat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending Section */}
            <div className="trending-section">
              <h2>Trending Today</h2>
              {homeLoading ? (
                <div className="main-loading">
                  <div className="bounce-loader">
                    <div></div><div></div><div></div>
                  </div>
                </div>
              ) : (
                <div className="song-list-table">
                  {homeTrending.map((track, idx) => (
                    <SongRow 
                      key={track.id} 
                      track={track} 
                      index={idx}
                      customPlaylists={customPlaylists}
                      setCustomPlaylists={setCustomPlaylists}
                      playlistTracks={homeTrending}
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
                            alt={searchResults.songs[0].name} 
                            className="top-result-cover" 
                          />
                          <span className="top-result-name">{searchResults.songs[0].name}</span>
                          <div className="top-result-artist">
                            <span>{searchResults.songs[0].artists?.primary?.map(a => a.name).join(', ') || 'Unknown Artist'}</span>
                            <span className="top-result-tag">Song</span>
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

      </div>

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
        
        .from-pink-500 { background: linear-gradient(135deg, #ec4899, #6366f1); }
        .from-purple-600 { background: linear-gradient(135deg, #8b5cf6, #3b82f6); }
        .from-emerald-500 { background: linear-gradient(135deg, #10b981, #14b8a6); }
        .from-orange-500 { background: linear-gradient(135deg, #f97316, #f43f5e); }
        .from-yellow-500 { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .from-cyan-500 { background: linear-gradient(135deg, #06b6d4, #3b82f6); }

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

        .top-result-artist {
          font-size: 13px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .top-result-tag {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(255,255,255,0.06);
          color: var(--text-main);
          padding: 3px 10px;
          border-radius: 12px;
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
            padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 12px;
            background: rgba(10, 15, 30, 0.45);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border-bottom: 1px solid var(--border-color);
            z-index: 50;
            width: 100%;
          }

          button, 
          .shortcut-card, 
          .category-card, 
          .top-result-card {
            touch-action: manipulation;
          }

          .menu-toggle-btn {
            color: var(--text-main);
            width: 36px;
            height: 36px;
            border-radius: 50%;
          }

          @media (hover: hover) {
            .menu-toggle-btn:hover {
              background: var(--bg-hover);
            }
          }

          /* Ensure action buttons are visible and styled on mobile views */
          .top-result-play-btn {
            opacity: 1;
            transform: translateY(0);
          }

          .remove-song-custom-btn {
            opacity: 1;
          }

          .mobile-logo {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .logo-icon-mini {
            width: 16px;
            height: 16px;
            background-color: var(--primary);
            border-radius: 50%;
            position: relative;
            box-shadow: 0 0 6px var(--primary-glow);
          }

          .logo-icon-mini::before {
            content: '';
            position: absolute;
            width: 8px;
            height: 8px;
            border-top: 1.5px solid var(--bg-darker);
            border-right: 1.5px solid var(--bg-darker);
            border-radius: 0 50% 0 0;
            top: 5px;
            left: 3px;
            transform: rotate(45deg);
          }

          .mobile-logo h2 {
            font-size: 15px;
            font-weight: 800;
            letter-spacing: -0.03em;
            color: var(--text-main);
          }

          .content-scroll {
            padding: 16px 16px 120px;
          }

          .hero-banner {
            padding: 24px;
            margin-bottom: 20px;
          }

          .hero-banner h1 {
            font-size: 26px;
          }

          .hero-banner p {
            font-size: 13px;
            margin-bottom: 16px;
          }

          .shortcuts-container {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
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
        }
      `}</style>
    </div>
  );
}
