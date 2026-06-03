import { useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { 
  Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, 
  Volume2, VolumeX, ListMusic, Mic2, Loader2, ChevronDown 
} from 'lucide-react';

export default function PlayerBar() {
  const {
    isPlaying, currentTrack, currentTime, duration, volume, loopMode, isShuffle,
    isQueueVisible, isLyricsVisible, isLoadingTrack,
    togglePlay, nextTrack, prevTrack, setTrackTime, setTrackVolume, toggleLoop, toggleShuffle,
    setIsQueueVisible, setIsLyricsVisible
  } = useAudio();

  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [localTime, setLocalTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const getThumbnailLarge = () => {
    if (!currentTrack) return '';
    return currentTrack.image?.[2]?.url || currentTrack.image?.[1]?.url || currentTrack.image?.[0]?.url || '';
  };

  // Sync local time state with current time when not scrubbing manually
  useEffect(() => {
    if (!isDragging) {
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

  // Get primary artist names
  const getArtistsString = () => {
    if (!currentTrack) return '';
    if (currentTrack.artists?.primary && currentTrack.artists.primary.length > 0) {
      return currentTrack.artists.primary.map(a => a.name).join(', ');
    }
    return 'Unknown Artist';
  };

  return (
    <>
      {/* Top thin progress line for collapsed mobile player */}
      <div 
        className="mobile-progress-line" 
        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
      ></div>

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
              <img src={getThumbnail()} alt={currentTrack.name} className={`album-art ${isPlaying ? 'playing' : ''}`} />
              {isLoadingTrack && (
                <div className="art-loader">
                  <Loader2 size={16} className="spinner" />
                </div>
              )}
            </div>
            <div className="track-details">
              <span className="track-name">{currentTrack.name}</span>
              <span className="artist-name">{getArtistsString()}</span>
            </div>
            {/* Collapsed Mobile EQ Visualizer */}
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
          />
          <span className="time-display">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Extra controls (Lyrics, Queue, Volume) */}
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
          />
        </div>

        {/* Mobile-only Play/Pause Toggle */}
        <button className="mobile-play-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }} disabled={!currentTrack}>
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
      </div>
      </div>

      {/* Fullscreen Mobile Player Overlay */}
      {isExpanded && (
        <div className="player-fullscreen glass-panel">
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

          {/* Track Details */}
          <div className="pf-details">
            <span className="pf-track-name">{currentTrack?.name || 'No song selected'}</span>
            <span className="pf-artist-name">{getArtistsString()}</span>
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
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
          margin-bottom: 20px;
          position: relative;
          z-index: 2;
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

        @media (max-width: 768px) {
          .player-bar {
            height: calc(64px + env(safe-area-inset-bottom, 0px));
            padding: 0 16px env(safe-area-inset-bottom, 0px);
            cursor: pointer;
            box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
            border-radius: 16px 16px 0 0;
            background: rgba(12, 12, 18, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-color);
            border-bottom: none;
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100vw;
            display: flex;
            align-items: center;
          }

          /* Click latency reduction and touch action mapping for iPhone */
          button, 
          .player-bar,
          .pf-btn,
          .pf-play-btn,
          .pf-tool-btn {
            touch-action: manipulation;
          }

          .mobile-progress-line {
            display: block;
            position: fixed;
            bottom: calc(64px + env(safe-area-inset-bottom, 0px));
            left: 0;
            height: 2px;
            background: var(--primary);
            z-index: 101;
            transition: width 0.1s linear;
          }

          .song-info {
            width: calc(100% - 48px);
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

          .mobile-play-btn {
            display: flex;
            background: #fff;
            color: #000;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            align-items: center;
            justify-content: center;
            margin-left: auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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
            height: 2px;
            background: var(--primary);
            border-radius: 1px;
          }

          .mobile-eq-indicator .eq-bar.animated {
            animation: eq-mini-bounce 0.8s ease-in-out infinite alternate;
          }

          .mobile-eq-indicator .eq-bar.animated:nth-child(1) { animation-duration: 0.6s; }
          .mobile-eq-indicator .eq-bar.animated:nth-child(2) { animation-duration: 0.9s; animation-delay: 0.2s; }
          .mobile-eq-indicator .eq-bar.animated:nth-child(3) { animation-duration: 0.7s; animation-delay: 0.4s; }

          @keyframes eq-mini-bounce {
            to { height: 12px; }
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
        }
      `}</style>
    </>
  );
}
