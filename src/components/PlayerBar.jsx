import { useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { 
  Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, 
  Volume2, VolumeX, ListMusic, Mic2, Loader2, ChevronDown, Heart, Sliders, PlusCircle
} from 'lucide-react';

export default function PlayerBar({ customPlaylists = [], setCustomPlaylists }) {
  const {
    isPlaying, currentTrack, currentTime, duration, volume, loopMode, isShuffle,
    isQueueVisible, isLyricsVisible, isLoadingTrack,
    togglePlay, nextTrack, prevTrack, setTrackTime, setTrackVolume, toggleLoop, toggleShuffle,
    setIsQueueVisible, setIsLyricsVisible, eqPreset, setEqPreset,
    likedSongs, toggleLikeTrack
  } = useAudio();

  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [localTime, setLocalTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isEqMenuVisible, setIsEqMenuVisible] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  // Close EQ menu when clicking outside
  useEffect(() => {
    if (!isEqMenuVisible) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.desktop-eq-wrapper')) {
        setIsEqMenuVisible(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isEqMenuVisible]);

  const handleTouchStart = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchEnd - touchStart;
    const isSwipeDown = distance > 100; // 100px threshold for collapse
    if (isSwipeDown) {
      setIsExpanded(false);
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const isLiked = currentTrack && likedSongs.includes(currentTrack.id);

  const toggleLike = (e) => {
    e.stopPropagation();
    if (currentTrack) {
      toggleLikeTrack(currentTrack);
    }
  };

  const addCurrentTrackToPlaylist = (playlistId) => {
    if (!currentTrack) return;
    const updatedPlaylists = customPlaylists.map(playlist => {
      if (playlist.id === playlistId) {
        if (playlist.songs.some(s => s.id === currentTrack.id)) {
          alert("Song is already in this playlist.");
          return playlist;
        }
        return {
          ...playlist,
          songs: [...playlist.songs, currentTrack]
        };
      }
      return playlist;
    });

    setCustomPlaylists(updatedPlaylists);
    localStorage.setItem('spotify_custom_playlists', JSON.stringify(updatedPlaylists));
    setShowPlaylistModal(false);
  };

  const handleCreateNewPlaylistFromModal = () => {
    const name = prompt("Enter playlist name:");
    if (!name || name.trim() === "") return;
    
    const newPlaylist = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      type: 'custom',
      songs: [currentTrack]
    };
    
    const updated = [...customPlaylists, newPlaylist];
    setCustomPlaylists(updated);
    localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));
    setShowPlaylistModal(false);
  };

  const getThumbnailLarge = () => {
    if (!currentTrack) return '';
    return currentTrack.image?.[2]?.url || currentTrack.image?.[1]?.url || currentTrack.image?.[0]?.url || '';
  };

  // Sync local time state with current time when not scrubbing manually
  useEffect(() => {
    if (!isDragging) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setLocalTime(currentTime);
    }
  }, [currentTime, isDragging]);

  const handleScrubChange = (e) => {
    setLocalTime(parseFloat(e.target.value));
  };

  const handleScrubEnd = (e) => {
    setIsDragging(false);
    setTrackTime(parseFloat(e.target.value));
  };

  const handleVolumeToggle = () => {
    if (isMuted) {
      setTrackVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setTrackVolume(0);
      setIsMuted(true);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Get track thumbnail
  const getThumbnail = () => {
    if (!currentTrack) return '';
    // Fetch 150x150 or 50x50 cover art
    return currentTrack.image?.[1]?.url || currentTrack.image?.[0]?.url || '';
  };

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

  // Get primary artist names
  const getArtistsString = () => {
    if (!currentTrack) return '';
    if (currentTrack.artists?.primary && currentTrack.artists.primary.length > 0) {
      return decodeHtml(currentTrack.artists.primary.map(a => a.name).join(', '));
    }
    return 'Unknown Artist';
  };

  const isLongName = currentTrack && currentTrack.name.length > 20;

  return (
    <>
      {/* Top thin progress line for collapsed mobile player */}
      <div className="mobile-progress-line-bg">
        <div 
          className="mobile-progress-line" 
          style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
        ></div>
      </div>

      <div className="player-bar glass-panel" onClick={(e) => {
        // Expand player on mobile if clicking on the bar itself, not on active buttons
        if (window.innerWidth <= 768 && !e.target.closest('button') && !e.target.closest('input')) {
          setIsExpanded(true);
        }
      }}>
        {/* Left: Song Info */}
      <div className="song-info">
        {currentTrack ? (
          <>
            <div className="album-art-container">
              <img src={getThumbnail()} alt={currentTrack.name} className={`album-art ${isPlaying ? 'playing' : ''}`} loading="lazy" decoding="async" />
              {isLoadingTrack && (
                <div className="art-loader">
                  <Loader2 size={16} className="spinner" />
                </div>
              )}
            </div>
            <div className="track-details">
              <div className="track-name-wrapper">
                <span className={`track-name ${isLongName ? 'marquee-active' : ''}`}>
                  {decodeHtml(currentTrack.name)}
                </span>
              </div>
              <span className="artist-name">{getArtistsString()}</span>
            </div>
            {/* Collapsed Mobile EQ Indicator */}
            <div className="mobile-eq-indicator">
              <div className={`eq-bar ${isPlaying ? 'animated' : ''}`}></div>
              <div className={`eq-bar ${isPlaying ? 'animated' : ''}`}></div>
              <div className={`eq-bar ${isPlaying ? 'animated' : ''}`}></div>
            </div>
          </>
        ) : (
          <div className="no-track">Select a song to start listening</div>
        )}
      </div>

      {/* Middle: Playback Controls & Progress */}
      <div className="playback-controls-container">
        <div className="control-buttons">
          <button 
            className={`control-btn shuffle ${isShuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
            disabled={!currentTrack}
            title="Shuffle"
          >
            <Shuffle size={16} />
          </button>
          
          <button 
            className="control-btn"
            onClick={prevTrack}
            disabled={!currentTrack}
            title="Previous"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>

          <button 
            className="play-pause-btn"
            onClick={togglePlay}
            disabled={!currentTrack}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoadingTrack ? (
              <Loader2 size={20} className="spinner" />
            ) : isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" className="play-icon-offset" />
            )}
          </button>

          <button 
            className="control-btn"
            onClick={nextTrack}
            disabled={!currentTrack}
            title="Next"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>

          <button 
            className={`control-btn loop ${loopMode !== 'none' ? 'active' : ''}`}
            onClick={toggleLoop}
            disabled={!currentTrack}
            title={`Repeat: ${loopMode === 'one' ? 'Track' : loopMode === 'all' ? 'All' : 'Off'}`}
          >
            <Repeat size={16} />
            {loopMode === 'one' && <span className="loop-indicator">1</span>}
          </button>
        </div>

        <div className="progress-bar-container">
          <span className="time-display">{formatTime(localTime)}</span>
          <input 
            type="range"
            min="0"
            max={duration || 100}
            value={localTime}
            onChange={handleScrubChange}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
            onMouseUp={handleScrubEnd}
            onTouchEnd={handleScrubEnd}
            disabled={!currentTrack}
            style={{
              background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(localTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.15) ${(localTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.15) 100%)`
            }}
          />
          <span className="time-display">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Extra controls (Lyrics, Queue, Equalizer, Volume) */}
      <div className="extra-controls">
        <button 
          className={`extra-btn ${isLyricsVisible ? 'active' : ''}`}
          onClick={() => setIsLyricsVisible(!isLyricsVisible)}
          disabled={!currentTrack}
          title="Lyrics"
        >
          <Mic2 size={16} />
        </button>

        <button 
          className={`extra-btn ${isQueueVisible ? 'active' : ''}`}
          onClick={() => setIsQueueVisible(!isQueueVisible)}
          title="Queue"
        >
          <ListMusic size={18} />
        </button>

        <div className="desktop-eq-wrapper">
          <button 
            className={`extra-btn eq-toggle-btn ${isEqMenuVisible ? 'active' : ''}`}
            onClick={() => setIsEqMenuVisible(!isEqMenuVisible)}
            disabled={!currentTrack}
            title="Audio Quality & Equalizer"
          >
            <Sliders size={16} />
          </button>
          
          {isEqMenuVisible && (
            <div className="desktop-eq-container glass-panel">
              <div className="desktop-eq-header">
                <span className="desktop-eq-title">Audio Profile / Voice EQ</span>
                <span className="desktop-eq-subtitle">High-Fidelity 320kbps</span>
              </div>
              <div className="desktop-eq-options">
                <button 
                  className={`desktop-eq-option ${eqPreset === 'flat' ? 'active' : ''}`}
                  onClick={() => { setEqPreset('flat'); setIsEqMenuVisible(false); }}
                >
                  <span className="option-name">Normal (Flat)</span>
                  <span className="option-desc">Pure studio response</span>
                </button>
                <button 
                  className={`desktop-eq-option ${eqPreset === 'vocal-boost' ? 'active' : ''}`}
                  onClick={() => { setEqPreset('vocal-boost'); setIsEqMenuVisible(false); }}
                >
                  <span className="option-name">Clear Voice (Vocals)</span>
                  <span className="option-desc">Enhanced vocals & dialogue</span>
                </button>
                <button 
                  className={`desktop-eq-option ${eqPreset === 'bass-boost' ? 'active' : ''}`}
                  onClick={() => { setEqPreset('bass-boost'); setIsEqMenuVisible(false); }}
                >
                  <span className="option-name">Bass Boost</span>
                  <span className="option-desc">Deep sub-bass power</span>
                </button>
                <button 
                  className={`desktop-eq-option ${eqPreset === 'treble-boost' ? 'active' : ''}`}
                  onClick={() => { setEqPreset('treble-boost'); setIsEqMenuVisible(false); }}
                >
                  <span className="option-name">Treble Clarity</span>
                  <span className="option-desc">Crisp highs & presence</span>
                </button>
                <button 
                  className={`desktop-eq-option ${eqPreset === 'hifi' ? 'active' : ''}`}
                  onClick={() => { setEqPreset('hifi'); setIsEqMenuVisible(false); }}
                >
                  <span className="option-name">Studio Hi-Fi</span>
                  <span className="option-desc">Dynamic full-range boost</span>
                </button>
                <button 
                  className={`desktop-eq-option ${eqPreset === 'spatial' ? 'active' : ''}`}
                  onClick={() => { setEqPreset('spatial'); setIsEqMenuVisible(false); }}
                >
                  <span className="option-name">3D Spatial (Surround)</span>
                  <span className="option-desc">Immersive wide soundstage</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="volume-slider-container">
          <button className="extra-btn" onClick={handleVolumeToggle} title="Mute/Unmute">
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input 
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const vol = parseFloat(e.target.value);
              setTrackVolume(vol);
              if (vol > 0) setIsMuted(false);
            }}
            style={{
              background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.15) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.15) 100%)`
            }}
          />
        </div>
      </div>

      {/* Mobile Only Playback & Action Controls */}
      <div className="mobile-player-controls">
        <button 
          className={`mp-action-btn heart ${isLiked ? 'liked' : ''}`}
          onClick={toggleLike}
          disabled={!currentTrack}
          title={isLiked ? 'Unlike' : 'Like'}
        >
          <Heart size={20} fill={isLiked ? 'var(--primary)' : 'none'} />
        </button>
        
        <button 
          className="mp-play-btn"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          disabled={!currentTrack}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="play-icon-offset-mini" />}
        </button>

        <button 
          className="mp-action-btn next"
          onClick={(e) => { e.stopPropagation(); nextTrack(); }}
          disabled={!currentTrack}
          title="Next Track"
        >
          <SkipForward size={18} fill="currentColor" />
        </button>
      </div>
      </div>

      {/* Fullscreen Mobile Player Overlay */}
      {isExpanded && (
        <div 
          className="player-fullscreen glass-panel"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Dynamic Blurred Artwork Background */}
          <div 
            className="pf-background" 
            style={{ backgroundImage: `url(${getThumbnailLarge()})` }}
          ></div>

          {/* Header */}
          <div className="pf-header">
            <button className="pf-collapse-btn" onClick={() => setIsExpanded(false)}>
              <ChevronDown size={24} />
            </button>
            <span className="pf-title">Now Playing</span>
            <div style={{ width: 24 }}></div>
          </div>

          {/* Large Album Art */}
          <div className="pf-art-container">
            <img src={getThumbnailLarge()} alt={currentTrack?.name} className={`pf-art ${isPlaying ? 'playing' : ''}`} />
          </div>

          {/* Track Details + Heart & Add to Playlist */}
          <div className="pf-details">
            <div className="pf-details-row">
              <div className="pf-details-text">
                <span className="pf-track-name">{decodeHtml(currentTrack?.name) || 'No song selected'}</span>
                <span className="pf-artist-name">{getArtistsString()}</span>
              </div>
              <div className="pf-actions-group">
                <button 
                  className={`pf-heart-btn ${isLiked ? 'liked' : ''}`}
                  onClick={toggleLike}
                  disabled={!currentTrack}
                  title={isLiked ? 'Unlike' : 'Like'}
                >
                  <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} />
                </button>
                <button 
                  className="pf-add-playlist-btn"
                  onClick={(e) => { e.stopPropagation(); setShowPlaylistModal(true); }}
                  disabled={!currentTrack}
                  title="Add to Playlist"
                >
                  <PlusCircle size={22} />
                </button>
              </div>
            </div>
          </div>

          {/* Progress Slider */}
          <div className="pf-progress-container">
            <div className="pf-progress-bar">
              <input 
                type="range"
                min="0"
                max={duration || 100}
                value={localTime}
                onChange={handleScrubChange}
                onMouseDown={() => setIsDragging(true)}
                onTouchStart={() => setIsDragging(true)}
                onMouseUp={handleScrubEnd}
                onTouchEnd={handleScrubEnd}
                disabled={!currentTrack}
                style={{
                  background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(localTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.15) ${(localTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.15) 100%)`
                }}
              />
            </div>
            <div className="pf-time-labels">
              <span>{formatTime(localTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Primary Controls */}
          <div className="pf-controls">
            <button className={`pf-btn shuffle ${isShuffle ? 'active' : ''}`} onClick={toggleShuffle}>
              <Shuffle size={20} />
            </button>
            <button className="pf-btn" onClick={prevTrack}>
              <SkipBack size={24} fill="currentColor" />
            </button>
            <button className="pf-play-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="play-icon-offset" />}
            </button>
            <button className="pf-btn" onClick={nextTrack}>
              <SkipForward size={24} fill="currentColor" />
            </button>
            <button className={`pf-btn loop ${loopMode !== 'none' ? 'active' : ''}`} onClick={toggleLoop}>
              <Repeat size={20} />
            </button>
          </div>

          {/* HD Equalizer Presets */}
          <div className="pf-eq-container">
            <span className="pf-eq-title">Audio Profile / Voice EQ</span>
            <div className="pf-eq-pills">
              <button 
                className={`pf-eq-pill ${eqPreset === 'flat' ? 'active' : ''}`}
                onClick={() => setEqPreset('flat')}
              >
                Normal (Flat)
              </button>
              <button 
                className={`pf-eq-pill ${eqPreset === 'vocal-boost' ? 'active' : ''}`}
                onClick={() => setEqPreset('vocal-boost')}
              >
                Clear Voice (Vocals)
              </button>
              <button 
                className={`pf-eq-pill ${eqPreset === 'bass-boost' ? 'active' : ''}`}
                onClick={() => setEqPreset('bass-boost')}
              >
                Bass Boost
              </button>
              <button 
                className={`pf-eq-pill ${eqPreset === 'treble-boost' ? 'active' : ''}`}
                onClick={() => setEqPreset('treble-boost')}
              >
                Treble Clarity
              </button>
              <button 
                className={`pf-eq-pill ${eqPreset === 'hifi' ? 'active' : ''}`}
                onClick={() => setEqPreset('hifi')}
              >
                Studio Hi-Fi
              </button>
              <button 
                className={`pf-eq-pill ${eqPreset === 'spatial' ? 'active' : ''}`}
                onClick={() => setEqPreset('spatial')}
              >
                3D Spatial
              </button>
            </div>
          </div>

          {/* Fullscreen Volume Slider */}
          <div className="pf-volume-container">
            <button 
              className="pf-volume-btn" 
              onClick={handleVolumeToggle} 
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              title="Mute/Unmute"
            >
              {isMuted || volume === 0 ? <VolumeX size={16} className="pf-volume-icon" /> : <Volume2 size={16} className="pf-volume-icon" />}
            </button>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const vol = parseFloat(e.target.value);
                setTrackVolume(vol);
                if (vol > 0) setIsMuted(false);
              }}
              style={{
                background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.15) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.15) 100%)`
              }}
            />
          </div>

          {/* Bottom Toolbar: Lyrics & Queue */}
          <div className="pf-toolbar">
            <button className={`pf-tool-btn ${isLyricsVisible ? 'active' : ''}`} onClick={() => { setIsLyricsVisible(!isLyricsVisible); setIsExpanded(false); }}>
              <Mic2 size={20} />
              <span>Lyrics</span>
            </button>
            <button className={`pf-tool-btn ${isQueueVisible ? 'active' : ''}`} onClick={() => { setIsQueueVisible(!isQueueVisible); setIsExpanded(false); }}>
              <ListMusic size={20} />
              <span>Queue</span>
            </button>
          </div>

          {/* Playlist Selection Overlay Modal */}
          {showPlaylistModal && (
            <div className="pf-playlist-modal glass-panel" onClick={(e) => e.stopPropagation()}>
              <div className="pf-modal-header">
                <h3>Add to Playlist</h3>
                <button className="pf-modal-close" onClick={() => setShowPlaylistModal(false)}>×</button>
              </div>
              <div className="pf-modal-list">
                {customPlaylists.length === 0 ? (
                  <div className="pf-modal-empty">No custom playlists found</div>
                ) : (
                  customPlaylists.map(playlist => {
                    const isAdded = playlist.songs.some(s => s.id === currentTrack?.id);
                    return (
                      <button 
                        key={playlist.id} 
                        className="pf-modal-item"
                        onClick={() => addCurrentTrackToPlaylist(playlist.id)}
                        disabled={isAdded}
                      >
                        <span className="pf-modal-item-name">{playlist.name}</span>
                        <span className="pf-modal-item-count">{playlist.songs?.length || 0} songs</span>
                        {isAdded && <span className="pf-modal-item-status">Already added</span>}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="pf-modal-actions">
                <button className="pf-modal-create-btn" onClick={handleCreateNewPlaylistFromModal}>
                  + Create New Playlist
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Embedded CSS for PlayerBar styling */}
      <style>{`
        .player-bar {
          height: var(--player-height);
          width: 100%;
          border-top: 1px solid var(--border-color);
          background: rgba(12, 12, 18, 0.85);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          z-index: 100;
          box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
          position: absolute;
          bottom: 0;
          left: 0;
        }

        /* Left Section: Song Info */
        .song-info {
          display: flex;
          align-items: center;
          width: 25%;
          min-width: 180px;
        }

        .album-art-container {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 6px;
          overflow: hidden;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          margin-right: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .album-art {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.8s ease-in-out;
        }

        .album-art.playing {
          /* Smooth pulse hover or spin slightly or stay clean */
        }

        .art-loader {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .track-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .track-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .artist-name {
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .no-track {
          font-size: 13px;
          color: var(--text-dimmed);
        }

        /* Middle Section: Controls */
        .playback-controls-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 45%;
          max-width: 600px;
        }

        .control-buttons {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .control-btn {
          color: var(--text-muted);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          transition: all 0.2s;
          position: relative;
        }

        .control-btn:hover:not(:disabled) {
          color: var(--text-main);
        }

        .control-btn.active {
          color: var(--primary);
        }

        .control-btn.active::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--primary);
        }

        .loop-indicator {
          position: absolute;
          font-size: 8px;
          font-weight: 700;
          top: 6px;
          right: 3px;
          background: var(--primary);
          color: var(--bg-darker);
          border-radius: 50%;
          width: 10px;
          height: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .play-pause-btn {
          background: #fff;
          color: #000;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          box-shadow: 0 4px 10px rgba(255,255,255,0.1);
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .play-pause-btn:hover:not(:disabled) {
          transform: scale(1.08);
          background: var(--primary-hover);
          color: #fff;
        }

        .play-pause-btn:active {
          transform: scale(0.94);
        }

        .play-icon-offset {
          margin-left: 2px;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .progress-bar-container {
          display: flex;
          align-items: center;
          width: 100%;
          gap: 12px;
        }

        .time-display {
          font-size: 11px;
          color: var(--text-dimmed);
          min-width: 35px;
          text-align: center;
        }

        /* Right Section: Extras & Volume */
        .extra-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 25%;
          justify-content: flex-end;
          min-width: 180px;
        }

        .extra-btn {
          color: var(--text-muted);
          width: 32px;
          height: 32px;
          border-radius: 50%;
        }

        .extra-btn:hover:not(:disabled) {
          color: var(--text-main);
          background: var(--bg-hover);
        }

        .extra-btn.active {
          color: var(--primary);
          background: rgba(29, 185, 84, 0.1);
        }

        .volume-slider-container {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 110px;
        }

        .volume-slider-container input[type="range"] {
          flex: 1;
        }

        /* Desktop Equalizer Popover */
        .desktop-eq-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .desktop-eq-container {
          position: absolute;
          bottom: 48px;
          right: -60px;
          width: 240px;
          background: rgba(12, 12, 20, 0.96) !important;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 229, 255, 0.15);
          z-index: 1000;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          animation: eq-fade-in 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        @keyframes eq-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .desktop-eq-header {
          display: flex;
          flex-direction: column;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 8px;
          margin-bottom: 4px;
        }

        .desktop-eq-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--primary);
          text-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
        }

        .desktop-eq-subtitle {
          font-size: 9px;
          color: var(--text-dimmed);
          margin-top: 2px;
        }

        .desktop-eq-options {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .desktop-eq-option {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .desktop-eq-option:hover {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-main);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .desktop-eq-option.active {
          background: rgba(0, 229, 255, 0.08);
          border-color: rgba(0, 229, 255, 0.3);
          color: var(--primary);
        }

        .desktop-eq-option .option-name {
          font-size: 12px;
          font-weight: 600;
        }

        .desktop-eq-option .option-desc {
          font-size: 9px;
          color: var(--text-dimmed);
          margin-top: 2px;
        }

        /* Collapsed Mobile Player progress line */
        .mobile-progress-line {
          display: none;
        }

        .mobile-play-btn {
          display: none;
        }

        .mobile-eq-indicator {
          display: none;
        }

        /* Fullscreen Mobile Player Overlay */
        .player-fullscreen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          background: rgba(6, 6, 9, 0.88);
          backdrop-filter: blur(35px) saturate(160%);
          -webkit-backdrop-filter: blur(35px) saturate(160%);
          z-index: 2000;
          display: flex;
          flex-direction: column;
          padding: calc(24px + env(safe-area-inset-top, 0px)) 32px calc(24px + env(safe-area-inset-bottom, 0px));
          animation: slide-up-player 0.35s cubic-bezier(0.25, 1, 0.5, 1);
          overflow: hidden;
        }

        @keyframes slide-up-player {
          from {
            transform: translate3d(0, 100%, 0);
          }
          to {
            transform: translate3d(0, 0, 0);
          }
        }

        .pf-background {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          filter: blur(60px) brightness(0.3);
          opacity: 0.5;
          z-index: 0;
          transform: scale(1.15) translate3d(0,0,0);
          transition: background-image 0.8s cubic-bezier(0.25, 1, 0.5, 1);
          pointer-events: none;
        }

        .pf-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          position: relative;
          z-index: 2;
        }

        .pf-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
        }

        .pf-collapse-btn {
          color: var(--text-main);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          transition: background 0.2s;
        }

        .pf-collapse-btn:hover {
          background: rgba(255,255,255,0.05);
        }

        .pf-art-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          max-height: 45vh;
          margin-bottom: 24px;
          position: relative;
          z-index: 2;
        }

        .pf-art {
          width: 260px;
          height: 260px;
          max-width: 75vw;
          max-height: 75vw;
          object-fit: cover;
          border-radius: 12px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.1);
          transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .pf-art.playing {
          animation: breathe-art 4s ease-in-out infinite;
        }

        @keyframes breathe-art {
          0%, 100% {
            transform: scale(1) translate3d(0,0,0);
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0px rgba(0, 229, 255, 0);
          }
          50% {
            transform: scale(1.03) translate3d(0,0,0);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(0, 229, 255, 0.3);
          }
        }

        .pf-details {
          text-align: left;
          margin-bottom: 20px;
          position: relative;
          z-index: 2;
        }

        .pf-details-row {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: space-between;
        }

        .pf-details-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          overflow: hidden;
        }

        .pf-track-name {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pf-artist-name {
          font-size: 14px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pf-heart-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          color: var(--text-muted);
          flex-shrink: 0;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .pf-heart-btn.liked {
          color: var(--primary);
          animation: heart-pop 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .pf-heart-btn:hover:not(:disabled) {
          color: var(--text-main);
          background: rgba(255,255,255,0.06);
        }

        @keyframes heart-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }

        .pf-progress-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 24px;
          position: relative;
          z-index: 2;
        }

        .pf-progress-bar {
          width: 100%;
        }

        .pf-time-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-dimmed);
        }

        .pf-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px;
          margin-bottom: 24px;
          position: relative;
          z-index: 2;
        }

        .pf-btn {
          color: var(--text-muted);
          width: 44px;
          height: 44px;
          border-radius: 50%;
        }

        .pf-btn.active {
          color: var(--primary);
        }

        .pf-play-btn {
          background: #fff;
          color: #000;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          box-shadow: 0 6px 20px rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pf-play-btn:active {
          transform: scale(0.95);
        }

        .pf-toolbar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 48px;
          border-top: 1px solid var(--border-color);
          padding-top: 20px;
          position: relative;
          z-index: 2;
        }

        .pf-tool-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
          font-size: 11px;
        }

        .pf-tool-btn.active {
          color: var(--primary);
        }

        /* Track marquee styles */
        .track-name-wrapper {
          overflow: hidden;
          white-space: nowrap;
          width: 100%;
          position: relative;
        }

        .track-name {
          display: inline-block;
          white-space: nowrap;
        }

        .track-name.marquee-active {
          animation: marquee-play 12s linear infinite;
          padding-right: 40px;
        }

        @keyframes marquee-play {
          0% { transform: translateX(0); }
          10% { transform: translateX(0); }
          80% { transform: translateX(-40%); }
          100% { transform: translateX(0); }
        }

        .mobile-player-controls {
          display: none;
        }

        .mobile-progress-line-bg {
          display: none;
        }

        @media (max-width: 768px) {
          .player-bar {
            height: 64px;
            padding: 0 16px;
            cursor: pointer;
            box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
            border-radius: 12px 12px 0 0;
            background: rgba(12, 12, 18, 0.85);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--border-color);
            border-bottom: none;
            position: fixed;
            bottom: calc(56px + env(safe-area-inset-bottom, 0px));
            left: 8px;
            right: 8px;
            display: flex;
            align-items: center;
            z-index: 200;
          }

          /* Click latency reduction and touch action mapping for iPhone */
          button, 
          .player-bar,
          .pf-btn,
          .pf-play-btn,
          .pf-tool-btn {
            touch-action: manipulation;
          }

          .mobile-progress-line-bg {
            display: block;
            position: fixed;
            bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 64px);
            left: 8px;
            right: 8px;
            height: 2px;
            background: rgba(255, 255, 255, 0.1);
            z-index: 201;
            border-radius: 1px;
            overflow: hidden;
          }

          .mobile-progress-line {
            height: 100%;
            background: var(--primary);
            transition: width 0.1s linear;
          }

          .song-info {
            width: calc(100% - 130px) !important;
          }

          .album-art-container {
            width: 40px;
            height: 40px;
            margin-right: 12px;
          }

          .track-name {
            font-size: 13px;
          }

          .artist-name {
            font-size: 11px;
          }

          .playback-controls-container,
          .extra-controls {
            display: none;
          }

          .mobile-player-controls {
            display: flex !important;
            align-items: center;
            gap: 10px;
            margin-left: auto;
            z-index: 10;
          }

          .mp-action-btn {
            color: var(--text-muted);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .mp-action-btn:active {
            background: rgba(255, 255, 255, 0.08);
          }

          .mp-action-btn.heart.liked {
            color: var(--primary);
          }

          .mp-play-btn {
            background: #fff;
            color: #000;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            flex-shrink: 0;
          }

          .mp-play-btn:active {
            transform: scale(0.92);
          }

          .play-icon-offset-mini {
            margin-left: 2px;
          }

          /* Fullscreen mobile viewport tweaks to fit Safari edges */
          .player-fullscreen {
            height: 100vh !important;
            height: 100dvh !important;
            padding: calc(10px + env(safe-area-inset-top, 0px)) 20px calc(10px + env(safe-area-inset-bottom, 0px)) !important;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .pf-art-container {
            margin-bottom: 8px !important;
            max-height: 30vh !important;
            flex: 1;
          }

          .pf-art {
            width: min(50vw, 200px) !important;
            height: min(50vw, 200px) !important;
            max-width: none !important;
            max-height: none !important;
          }

          .pf-details {
            margin-bottom: 8px !important;
          }

          .pf-track-name {
            font-size: 18px !important;
          }

          .pf-artist-name {
            font-size: 13px !important;
          }

          .pf-progress-container {
            margin-bottom: 8px !important;
            gap: 6px !important;
          }

          .pf-controls {
            margin-bottom: 8px !important;
          }

          .pf-controls .pf-btn {
            width: 38px !important;
            height: 38px !important;
          }

          .pf-controls .pf-play-btn {
            width: 50px !important;
            height: 50px !important;
          }

          /* Fullscreen Equalizer UI styles */
          .pf-eq-container {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 8px !important;
            padding: 0 8px;
            z-index: 2;
            position: relative;
          }

          .pf-eq-title {
            font-size: 11px;
            color: var(--text-dimmed);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 750;
          }

          .pf-eq-pills {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            overflow-x: auto;
            padding-bottom: 4px;
            scrollbar-width: none;
          }

          .pf-eq-pills::-webkit-scrollbar {
            display: none;
          }

          .pf-eq-pill {
            padding: 6px 14px;
            font-size: 11px;
            font-weight: 600;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            white-space: nowrap;
          }

          .pf-eq-pill.active {
            background: rgba(0, 229, 255, 0.12);
            border-color: var(--primary);
            color: var(--primary);
            box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
          }

          /* Custom Volume slider container for Fullscreen Mobile Player */
          .pf-volume-container {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            padding: 0 8px;
            margin-bottom: 8px !important;
            position: relative;
            z-index: 2;
          }

          .pf-volume-icon {
            color: var(--text-muted);
            flex-shrink: 0;
          }

          .pf-volume-container input[type="range"] {
            flex: 1;
            height: 4px;
            border-radius: 2px;
            background: rgba(255, 255, 255, 0.15);
            outline: none;
            -webkit-appearance: none;
          }

          /* Mobile Equalizer animation indicator */
          .mobile-eq-indicator {
            display: flex;
            align-items: flex-end;
            gap: 2px;
            height: 12px;
            margin-left: 8px;
            flex-shrink: 0;
          }

          .mobile-eq-indicator .eq-bar {
            width: 2px;
            height: 12px;
            background: var(--primary);
            border-radius: 1px;
            transform: scaleY(0.15);
            transform-origin: bottom;
            will-change: transform;
          }

          .mobile-eq-indicator .eq-bar.animated {
            animation: eq-mini-bounce 0.8s ease-in-out infinite alternate;
          }

          .mobile-eq-indicator .eq-bar.animated:nth-child(1) { animation-duration: 0.6s; }
          .mobile-eq-indicator .eq-bar.animated:nth-child(2) { animation-duration: 0.9s; animation-delay: 0.2s; }
          .mobile-eq-indicator .eq-bar.animated:nth-child(3) { animation-duration: 0.7s; animation-delay: 0.4s; }

          @keyframes eq-mini-bounce {
            from { transform: scaleY(0.15); }
            to { transform: scaleY(1); }
          }

          /* Grab-friendly range inputs on touch viewports */
          input[type="range"]::-webkit-slider-thumb {
            opacity: 1 !important;
            width: 14px !important;
            height: 14px !important;
            margin-top: -5px !important;
            background: var(--primary) !important;
            box-shadow: 0 2px 8px rgba(0, 229, 255, 0.5) !important;
          }

          input[type="range"]::-moz-range-thumb {
            opacity: 1 !important;
            width: 14px !important;
            height: 14px !important;
            background: var(--primary) !important;
            box-shadow: 0 2px 8px rgba(0, 229, 255, 0.5) !important;
          }

          .pf-toolbar {
            padding-top: 8px !important;
            gap: 32px !important;
          }

          /* Mobile Add to Playlist Modal */
          .pf-playlist-modal {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(12, 12, 22, 0.98) !important;
            border-top: 1px solid var(--border-color);
            border-radius: 20px 20px 0 0;
            padding: 20px 24px calc(20px + env(safe-area-inset-bottom, 0px));
            z-index: 3000;
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.8);
            animation: slide-up-modal 0.28s cubic-bezier(0.25, 0.8, 0.25, 1);
          }

          @keyframes slide-up-modal {
            from {
              transform: translate3d(0, 100%, 0);
            }
            to {
              transform: translate3d(0, 0, 0);
            }
          }

          .pf-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .pf-modal-header h3 {
            font-size: 16px;
            font-weight: 700;
            color: #fff;
          }

          .pf-modal-close {
            font-size: 24px;
            color: var(--text-muted);
            background: rgba(255, 255, 255, 0.05);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .pf-modal-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 200px;
            overflow-y: auto;
            scrollbar-width: none;
          }
          .pf-modal-list::-webkit-scrollbar {
            display: none;
          }

          .pf-modal-empty {
            text-align: center;
            font-size: 13px;
            color: var(--text-dimmed);
            padding: 24px 0;
          }

          .pf-modal-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 12px 16px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.04);
            color: var(--text-main);
            text-align: left;
            transition: all 0.2s;
          }

          .pf-modal-item:active {
            background: rgba(0, 229, 255, 0.08);
            border-color: rgba(0, 229, 255, 0.2);
          }

          .pf-modal-item:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .pf-modal-item-name {
            font-size: 13px;
            font-weight: 600;
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .pf-modal-item-count {
            font-size: 11px;
            color: var(--text-muted);
            margin-right: 12px;
          }

          .pf-modal-item-status {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--primary);
            letter-spacing: 0.03em;
          }

          .pf-modal-actions {
            display: flex;
            flex-direction: column;
            margin-top: 4px;
          }

          .pf-modal-create-btn {
            background: rgba(0, 229, 255, 0.1);
            border: 1px dashed rgba(0, 229, 255, 0.3);
            color: var(--primary);
            padding: 12px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .pf-modal-create-btn:active {
            background: rgba(0, 229, 255, 0.18);
            border-color: var(--primary);
          }

          /* Details Row Adjustments to fit actions group */
          .pf-details-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .pf-actions-group {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }

          .pf-add-playlist-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }

          .pf-add-playlist-btn:active {
            color: var(--primary);
            background: rgba(255,255,255,0.06);
          }
        }
      `}</style>
    </>
  );
}
