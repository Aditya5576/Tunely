import { useState, useEffect } from 'react';
import { Play, Pause, Plus, Check, Music, Heart, X, MoreVertical, ListPlus, Trash2 } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { decodeHtml } from '../utils/lyrics';

export default function SongRow({ 
  track, 
  index, 
  customPlaylists, 
  setCustomPlaylists, 
  playlistTracks = [],
  showRemove = false,
  onRemove = null
}) {
  const { currentTrack, isPlaying, playTrack, likedSongs, toggleLikeTrack, addToQueue } = useAudio();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddedToQueue, setIsAddedToQueue] = useState(false);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutsideClick = (e) => {
      const isDropdownClick = e.target.closest('.playlist-dropdown') || e.target.closest('.row-action-btn');
      if (!isDropdownClick) {
        setIsDropdownOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  const isCurrentTrack = currentTrack && currentTrack.id === track.id;
  const isLiked = likedSongs?.includes(track.id);
  const isHQ = track.downloadUrl && track.downloadUrl.length > 2;

  const handlePlayClick = () => {
    // If it's a song in a list, play it and pass the current list as the context queue
    playTrack(track, playlistTracks);
  };

  const formatDuration = (seconds) => {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const addToCustomPlaylist = (playlistId) => {
    const updatedPlaylists = customPlaylists.map(playlist => {
      if (playlist.id === playlistId) {
        // Prevent duplicate songs in custom playlist
        if (playlist.songs.some(s => s.id === track.id)) {
          alert("Song is already in this playlist.");
          return playlist;
        }
        return {
          ...playlist,
          songs: [...playlist.songs, track]
        };
      }
      return playlist;
    });

    setCustomPlaylists(updatedPlaylists);
    localStorage.setItem('spotify_custom_playlists', JSON.stringify(updatedPlaylists));
    setIsDropdownOpen(false);
  };

  const getArtistsString = () => {
    if (track.artists?.primary && track.artists.primary.length > 0) {
      return decodeHtml(track.artists.primary.map(a => a.name).join(', '));
    }
    return decodeHtml(track.artists?.all ? track.artists.all.map(a => a.name).slice(0, 2).join(', ') : 'Unknown Artist');
  };

  const getThumbnail = () => {
    return track.image?.[1]?.url || track.image?.[0]?.url || '';
  };

  return (
    <div 
      className={`song-row ${isCurrentTrack ? 'active' : ''}`} 
      onClick={handlePlayClick}
      style={isDropdownOpen ? { zIndex: 10 } : {}}
    >
      {/* Index / Play Button */}
      <div className="song-index-col">
        {isCurrentTrack ? (
          isPlaying ? (
            <>
              <div className="row-eq-visualizer">
                <div className="eq-bar bar1"></div>
                <div className="eq-bar bar2"></div>
                <div className="eq-bar bar3"></div>
              </div>
              <button className="row-play-btn" onClick={(e) => { e.stopPropagation(); handlePlayClick(); }}>
                <Pause size={14} fill="currentColor" />
              </button>
            </>
          ) : (
            <>
              <span className="index-number active-index">{index + 1}</span>
              <button className="row-play-btn" onClick={(e) => { e.stopPropagation(); handlePlayClick(); }}>
                <Play size={14} fill="currentColor" className="play-icon-offset" />
              </button>
            </>
          )
        ) : (
          <>
            <span className="index-number">{index + 1}</span>
            <button className="row-play-btn" onClick={(e) => { e.stopPropagation(); handlePlayClick(); }}>
              <Play size={14} fill="currentColor" className="play-icon-offset" />
            </button>
          </>
        )}
      </div>

      {/* Title & Cover */}
      <div className="song-title-col">
        <div className="song-cover-container">
          {getThumbnail() ? (
            <img src={getThumbnail()} alt={decodeHtml(track.name)} className="song-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="song-cover-placeholder">
              <Music size={14} />
            </div>
          )}
        </div>
        <div className="song-meta">
          <div className="song-title-line">
            <span className="song-name-text">{decodeHtml(track.name)}</span>
            {isHQ && <span className="hq-badge">HQ</span>}
          </div>
          <span className="song-artist-text">{getArtistsString()}</span>
        </div>
      </div>

      {/* Album Name */}
      <div className="song-album-col">
        <span className="album-text">{decodeHtml(track.album?.name || 'Single')}</span>
      </div>

      {/* Duration & Playlist Operations */}
      <div className="song-duration-col">
        <span className="duration-text">{formatDuration(track.duration)}</span>
        
        {/* Heart / Like Button */}
        <button 
          className={`row-heart-btn ${isLiked ? 'liked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleLikeTrack(track);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          title={isLiked ? "Unlike" : "Like"}
        >
          <Heart size={15} fill={isLiked ? "currentColor" : "none"} />
        </button>

        {showRemove && (
          /* Remove from playlist button */
          <button 
            className="row-action-btn remove-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (onRemove) onRemove();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            title="Remove from playlist"
          >
            <X size={15} />
          </button>
        )}

        <div className="add-to-playlist-container">
          <button 
            className="row-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen(true);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            title="More options"
          >
            <MoreVertical size={16} />
          </button>

          {isDropdownOpen && (
            <div 
              className="spotify-action-backdrop"
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(false);
                setShowPlaylistSelector(false);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
            >
              <div 
                className="spotify-action-sheet"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {/* Header Track Info */}
                <div className="spotify-sheet-header">
                  {getThumbnail() ? (
                    <img src={getThumbnail()} alt={decodeHtml(track.name)} className="spotify-sheet-cover" />
                  ) : (
                    <div className="spotify-sheet-cover-placeholder"><Music size={22} /></div>
                  )}
                  <div className="spotify-sheet-meta">
                    <h4 className="spotify-sheet-title">{decodeHtml(track.name)}</h4>
                    <p className="spotify-sheet-artist">{getArtistsString()}</p>
                  </div>
                </div>

                <div className="spotify-sheet-divider" />

                {/* Option 1: Add to Queue */}
                <button
                  className="spotify-sheet-option"
                  onClick={(e) => {
                    e.stopPropagation();
                    addToQueue(track);
                    setIsAddedToQueue(true);
                    setTimeout(() => {
                      setIsAddedToQueue(false);
                      setIsDropdownOpen(false);
                      setShowPlaylistSelector(false);
                    }, 600);
                  }}
                  onTouchStart={(e) => { e.stopPropagation(); }}
                >
                  <div className="spotify-option-icon">
                    {isAddedToQueue ? <Check size={20} color="#00e5ff" /> : <Plus size={20} />}
                  </div>
                  <span style={{ color: isAddedToQueue ? '#00e5ff' : '#fff' }}>
                    {isAddedToQueue ? 'Added to Queue!' : 'Add to Queue'}
                  </span>
                </button>

                {/* Option 2: Add to Playlist */}
                <button
                  className="spotify-sheet-option"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlaylistSelector(!showPlaylistSelector);
                  }}
                  onTouchStart={(e) => { e.stopPropagation(); }}
                >
                  <div className="spotify-option-icon">
                    <ListPlus size={20} />
                  </div>
                  <span>Add to Playlist</span>
                </button>

                {/* Nested Playlist Selector */}
                {showPlaylistSelector && (
                  <div className="spotify-playlist-sublist">
                    {customPlaylists.length === 0 ? (
                      <span className="spotify-sublist-empty">No custom playlists created yet</span>
                    ) : (
                      customPlaylists.map(p => {
                        const alreadyAdded = p.songs.some(s => s.id === track.id);
                        return (
                          <button 
                            key={p.id} 
                            className="spotify-sublist-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCustomPlaylist(p.id);
                              setIsDropdownOpen(false);
                              setShowPlaylistSelector(false);
                            }}
                            onTouchStart={(e) => { e.stopPropagation(); }}
                            disabled={alreadyAdded}
                          >
                            <span>{p.name}</span>
                            {alreadyAdded && <Check size={16} className="check-icon" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Option 3: Save to Liked Songs */}
                <button
                  className="spotify-sheet-option"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLikeTrack(track);
                  }}
                  onTouchStart={(e) => { e.stopPropagation(); }}
                >
                  <div className="spotify-option-icon">
                    <Heart size={20} fill={isLiked ? "#00e5ff" : "none"} color={isLiked ? "#00e5ff" : "#fff"} />
                  </div>
                  <span>{isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
                </button>

                {/* Option 4: Remove from Playlist (if applicable) */}
                {showRemove && onRemove && (
                  <button
                    className="spotify-sheet-option danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                      setShowPlaylistSelector(false);
                      onRemove();
                    }}
                    onTouchStart={(e) => { e.stopPropagation(); }}
                  >
                    <div className="spotify-option-icon">
                      <Trash2 size={20} color="#ef4444" />
                    </div>
                    <span style={{ color: '#ef4444' }}>Remove from Playlist</span>
                  </button>
                )}

                {/* Cancel / Close button */}
                <button 
                  className="spotify-sheet-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    setShowPlaylistSelector(false);
                  }}
                  onTouchStart={(e) => { e.stopPropagation(); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded CSS for SongRow styling */}
      <style>{`
        .song-row {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          touch-action: manipulation;
        }

        .song-row.active {
          background-color: rgba(0, 229, 255, 0.04);
        }

        .song-row.active .song-name-text {
          color: var(--primary);
        }

        .song-index-col {
          width: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-dimmed);
          font-size: 14px;
          margin-right: 12px;
          flex-shrink: 0;
        }

        .row-eq-visualizer {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          width: 14px;
          height: 14px;
          margin-left: 2px;
        }

        .eq-bar {
          width: 2.5px;
          height: 100%;
          background-color: var(--primary);
          border-radius: 1px;
          transform-origin: bottom;
          animation: row-eq-bounce 1s ease-in-out infinite alternate;
        }

        .bar1 { animation-delay: 0.1s; animation-duration: 0.8s; }
        .bar2 { animation-delay: 0.3s; animation-duration: 1.1s; }
        .bar3 { animation-delay: 0.5s; animation-duration: 0.9s; }

        @keyframes row-eq-bounce {
          0% { transform: scaleY(0.2); }
          100% { transform: scaleY(1); }
        }

        .active-index {
          color: var(--primary);
          font-weight: 600;
        }

        .row-play-btn {
          display: none;
          color: var(--text-main);
          width: 24px;
          height: 24px;
        }

        @media (hover: hover) {
          .song-row:hover {
            background-color: var(--bg-hover);
            transform: translateX(4px);
          }

          .song-row:hover .index-number,
          .song-row:hover .row-eq-visualizer {
            display: none !important;
          }

          .song-row:hover .row-play-btn {
            display: flex !important;
          }
        }

        .play-icon-offset {
          margin-left: 1px;
        }

        .song-title-col {
          flex: 2;
          display: flex;
          align-items: center;
          gap: 12px;
          overflow: hidden;
          min-width: 0;
        }

        .song-cover-container {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          overflow: hidden;
          background: rgba(255,255,255,0.05);
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .song-row:hover .song-cover-container {
          transform: scale(1.05);
          box-shadow: 0 4px 12px var(--primary-glow);
        }

        .song-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .song-cover-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-dimmed);
        }

        .song-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
          min-width: 0;
          flex-grow: 1;
        }

        .song-title-line {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
        }

        .song-name-text {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }

        .hq-badge {
          font-size: 9px;
          font-weight: 800;
          color: #05060b;
          background: linear-gradient(135deg, var(--primary) 0%, #00b0ff 100%);
          padding: 1px 4px;
          border-radius: 3px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          flex-shrink: 0;
          box-shadow: 0 2px 5px rgba(0, 229, 255, 0.3);
        }

        .song-artist-text {
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .song-album-col {
          flex: 1.5;
          display: flex;
          align-items: center;
          color: var(--text-muted);
          font-size: 13px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          padding: 0 16px;
        }

        .song-duration-col {
          width: 100px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          color: var(--text-muted);
          font-size: 13px;
          gap: 16px;
          flex-shrink: 0;
        }

        .row-heart-btn {
          color: var(--text-muted);
          opacity: 0;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .row-heart-btn.liked {
          opacity: 1;
          color: var(--primary);
        }

        .row-action-btn {
          opacity: 0;
          color: var(--text-muted);
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }

        @media (hover: hover) {
          .song-row:hover .row-action-btn,
          .song-row:hover .row-heart-btn {
            opacity: 1;
          }

          .row-action-btn:hover,
          .row-heart-btn:hover {
            color: var(--text-main);
            background: rgba(255,255,255,0.05);
          }

          .row-action-btn.remove-btn:hover {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
          }

          .row-heart-btn:hover {
            color: var(--primary);
            background: rgba(0, 229, 255, 0.08);
            transform: scale(1.1);
          }
        }

        /* Dropdown popover */
        .add-to-playlist-container {
          position: relative;
        }

        .spotify-action-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          z-index: 99999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: spotify-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes spotify-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .spotify-action-sheet {
          width: 100%;
          max-width: 480px;
          background: #10111a;
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-bottom: none;
          padding: 20px 20px 24px;
          box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.85);
          display: flex;
          flex-direction: column;
          gap: 6px;
          animation: spotify-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          max-height: 85vh;
          overflow-y: auto;
        }

        @keyframes spotify-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .spotify-sheet-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 4px 0 8px;
          text-align: left;
        }

        .spotify-sheet-cover {
          width: 54px;
          height: 54px;
          border-radius: 8px;
          object-fit: cover;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
          flex-shrink: 0;
        }

        .spotify-sheet-cover-placeholder {
          width: 54px;
          height: 54px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-dimmed);
          flex-shrink: 0;
        }

        .spotify-sheet-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow: hidden;
          text-align: left;
        }

        .spotify-sheet-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .spotify-sheet-artist {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .spotify-sheet-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 6px 0 10px;
        }

        .spotify-sheet-option {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 16px;
          border-radius: 12px;
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          text-align: left;
          width: 100%;
        }

        .spotify-sheet-option:hover,
        .spotify-sheet-option:active {
          background: rgba(255, 255, 255, 0.08);
        }

        .spotify-option-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .spotify-playlist-sublist {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 12px 8px 56px;
          background: rgba(0, 0, 0, 0.25);
          border-radius: 12px;
          margin-bottom: 4px;
        }

        .spotify-sublist-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: #e0e0e0;
          font-size: 13px;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }

        .spotify-sublist-item:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .spotify-sublist-item:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .spotify-sublist-empty {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
          padding: 6px 0;
        }

        .spotify-sheet-close-btn {
          margin-top: 8px;
          padding: 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          text-align: center;
          width: 100%;
          transition: background 0.2s;
        }

        .spotify-sheet-close-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        @media (max-width: 768px) {
          .song-album-col {
            display: none;
          }
          .song-row {
            padding: 8px 10px;
          }
          .song-title-col {
            flex: 3;
          }
          .song-index-col {
            width: 24px;
            margin-right: 8px;
            justify-content: center;
          }
          .song-duration-col {
            width: 104px;
            gap: 12px;
            flex-shrink: 0;
          }
          .row-action-btn,
          .row-heart-btn {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
