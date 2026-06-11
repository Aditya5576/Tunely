import { useState } from 'react';
import { Play, Pause, Plus, Check, Music, Heart, X } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';

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

export default function SongRow({ 
  track, 
  index, 
  customPlaylists, 
  setCustomPlaylists, 
  playlistTracks = [],
  showRemove = false,
  onRemove = null
}) {
  const { currentTrack, isPlaying, playTrack, likedSongs, toggleLikeTrack } = useAudio();
  const { user } = useAuth() || {};
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
    const targetPlaylist = customPlaylists.find(p => p.id === playlistId);
    if (user?.isGuest && targetPlaylist && targetPlaylist.songs.length >= 5) {
      alert("Guest Mode Limitation: Custom playlists are limited to 5 songs in Guest Mode. Please create an account to add unlimited tracks.");
      setIsDropdownOpen(false);
      return;
    }

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
      onMouseLeave={() => setIsDropdownOpen(false)}
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

        {showRemove ? (
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
        ) : (
          /* Add to Playlist Popup Trigger */
          <div className="add-to-playlist-container">
            <button 
              className="row-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              title="Add to playlist"
            >
              <Plus size={16} />
            </button>

            {isDropdownOpen && (
              <div 
                className="playlist-dropdown glass-panel"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <span className="dropdown-header">Add to Playlist</span>
                {customPlaylists.length === 0 ? (
                  <span className="dropdown-empty">No playlists created</span>
                ) : (
                  <div className="dropdown-list">
                    {customPlaylists.map(p => {
                      const alreadyAdded = p.songs.some(s => s.id === track.id);
                      return (
                        <button 
                          key={p.id} 
                          className="dropdown-item"
                          onClick={(e) => { e.stopPropagation(); addToCustomPlaylist(p.id); }}
                          onTouchStart={(e) => { e.stopPropagation(); }}
                          disabled={alreadyAdded}
                        >
                          <span>{p.name}</span>
                          {alreadyAdded && <Check size={14} className="check-icon" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Embedded CSS for SongRow styling */}
      <style>{`
        .song-row {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          border-left: 3px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          touch-action: manipulation;
        }

        .song-row.active {
          background-color: rgba(0, 229, 255, 0.05);
          border-left-color: var(--primary);
          padding-left: 13px;
        }

        .song-row.active .song-name-text {
          color: var(--primary);
        }

        .song-index-col {
          width: 40px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          color: var(--text-dimmed);
          font-size: 14px;
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

        .playlist-dropdown {
          position: absolute;
          right: 0;
          bottom: 30px;
          width: 200px;
          background: rgba(15, 15, 22, 0.95);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 8px 0;
          box-shadow: 0 8px 24px rgba(0,0,0,0.6);
          z-index: 100;
          display: flex;
          flex-direction: column;
          text-align: left;
        }

        .dropdown-header {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-dimmed);
          text-transform: uppercase;
          padding: 4px 12px 8px;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 4px;
        }

        .dropdown-empty {
          font-size: 12px;
          color: var(--text-dimmed);
          padding: 8px 12px;
          text-align: center;
        }

        .dropdown-list {
          max-height: 150px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          font-size: 13px;
          color: var(--text-muted);
          width: 100%;
          text-align: left;
          transition: all 0.2s;
        }

        .dropdown-item:hover:not(:disabled) {
          color: var(--text-main);
          background-color: var(--bg-hover);
        }

        .dropdown-item:disabled {
          color: var(--text-dimmed);
          cursor: not-allowed;
        }

        .check-icon {
          color: var(--primary);
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
            width: 30px;
          }
          .song-duration-col {
            width: 90px;
            gap: 12px;
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
