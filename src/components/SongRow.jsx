import { useState } from 'react';
import { Play, Pause, Plus, Check, Music } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export default function SongRow({ track, index, customPlaylists, setCustomPlaylists, playlistTracks = [] }) {
  const { currentTrack, isPlaying, playTrack } = useAudio();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isCurrentTrack = currentTrack && currentTrack.id === track.id;

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
      return track.artists.primary.map(a => a.name).join(', ');
    }
    return track.artists?.all ? track.artists.all.map(a => a.name).slice(0, 2).join(', ') : 'Unknown Artist';
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
        <span className="index-number">{index + 1}</span>
        <button className="row-play-btn" onClick={(e) => { e.stopPropagation(); handlePlayClick(); }}>
          {isCurrentTrack && isPlaying ? (
            <Pause size={14} fill="currentColor" />
          ) : (
            <Play size={14} fill="currentColor" className="play-icon-offset" />
          )}
        </button>
      </div>

      {/* Title & Cover */}
      <div className="song-title-col">
        <div className="song-cover-container">
          {getThumbnail() ? (
            <img src={getThumbnail()} alt={track.name} className="song-cover" />
          ) : (
            <div className="song-cover-placeholder">
              <Music size={14} />
            </div>
          )}
        </div>
        <div className="song-meta">
          <span className="song-name-text">{track.name}</span>
          <span className="song-artist-text">{getArtistsString()}</span>
        </div>
      </div>

      {/* Album Name */}
      <div className="song-album-col">
        <span className="album-text">{track.album?.name || 'Single'}</span>
      </div>

      {/* Duration & Playlist Operations */}
      <div className="song-duration-col">
        <span className="duration-text">{formatDuration(track.duration)}</span>
        
        {/* Add to Playlist Popup Trigger */}
        <div className="add-to-playlist-container">
          <button 
            className="row-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen(!isDropdownOpen);
            }}
            title="Add to playlist"
          >
            <Plus size={16} />
          </button>

          {isDropdownOpen && (
            <div className="playlist-dropdown glass-panel">
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
      </div>

      {/* Embedded CSS for SongRow styling */}
      <style>{`
        .song-row {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
          position: relative;
          touch-action: manipulation;
        }

        .song-row.active {
          background-color: rgba(29, 185, 84, 0.08);
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

          .song-row:hover .index-number {
            display: none;
          }

          .song-row:hover .row-play-btn {
            display: flex;
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
        }

        .song-cover-container {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          overflow: hidden;
          background: rgba(255,255,255,0.05);
          flex-shrink: 0;
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
        }

        .song-name-text {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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

        .row-action-btn {
          opacity: 0;
          color: var(--text-muted);
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }

        @media (hover: hover) {
          .song-row:hover .row-action-btn {
            opacity: 1;
          }

          .row-action-btn:hover {
            color: var(--text-main);
            background: rgba(255,255,255,0.05);
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
            width: 80px;
            gap: 10px;
          }
          .row-action-btn {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
