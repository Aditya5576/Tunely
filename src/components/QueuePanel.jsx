import { useAudio } from '../context/AudioContext';
import { X, Play, Trash2 } from 'lucide-react';

export default function QueuePanel() {
  const { 
    queue, 
    currentIndex, 
    currentTrack, 
    isPlaying, 
    isQueueVisible, 
    setIsQueueVisible, 
    playQueueTrack, 
    removeFromQueue, 
    clearQueue 
  } = useAudio();

  if (!isQueueVisible) return null;

  const upcomingTracks = queue.slice(currentIndex + 1);

  const getArtistsString = (track) => {
    if (track.artists?.primary && track.artists.primary.length > 0) {
      return track.artists.primary.map(a => a.name).join(', ');
    }
    return 'Unknown Artist';
  };

  return (
    <div className="queue-panel glass-panel">
      {/* Header */}
      <div className="queue-header">
        <h3>Play Queue</h3>
        <div className="queue-header-actions">
          {queue.length > 0 && (
            <button className="clear-queue-btn" onClick={clearQueue} title="Clear Queue">
              Clear All
            </button>
          )}
          <button className="close-queue-btn" onClick={() => setIsQueueVisible(false)} title="Close Queue">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="queue-content">
        
        {/* Currently Playing Track */}
        <div className="queue-section">
          <span className="section-title">Now Playing</span>
          {currentTrack ? (
            <div className="queue-item playing active">
              <img src={currentTrack.image?.[0]?.url} alt={currentTrack.name} className="queue-item-cover" />
              <div className="queue-item-meta">
                <span className="queue-track-name">{currentTrack.name}</span>
                <span className="queue-artist-name">{getArtistsString(currentTrack)}</span>
              </div>
              <div className="eq-wave-mini">
                <div className={`eq-bar ${isPlaying ? 'animated' : ''}`}></div>
                <div className={`eq-bar ${isPlaying ? 'animated' : ''}`}></div>
                <div className={`eq-bar ${isPlaying ? 'animated' : ''}`}></div>
              </div>
            </div>
          ) : (
            <div className="queue-empty-text">No track playing</div>
          )}
        </div>

        {/* Next Up Tracks */}
        <div className="queue-section next-up">
          <span className="section-title">Next Up</span>
          {upcomingTracks.length > 0 ? (
            <div className="upcoming-list">
              {upcomingTracks.map((track, idx) => {
                const actualIndex = currentIndex + 1 + idx;
                return (
                  <div key={`${track.id}_${actualIndex}`} className="queue-item">
                    <img src={track.image?.[0]?.url} alt={track.name} className="queue-item-cover" />
                    <div className="queue-item-meta">
                      <span className="queue-track-name">{track.name}</span>
                      <span className="queue-artist-name">{getArtistsString(track)}</span>
                    </div>
                    <div className="queue-item-actions">
                      <button 
                        className="item-action-btn play" 
                        onClick={() => playQueueTrack(actualIndex)}
                        title="Play Now"
                      >
                        <Play size={12} fill="currentColor" />
                      </button>
                      <button 
                        className="item-action-btn delete" 
                        onClick={() => removeFromQueue(actualIndex)}
                        title="Remove from Queue"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="queue-empty-text">Queue is empty</div>
          )}
        </div>

      </div>

      {/* Embedded CSS for QueuePanel styling */}
      <style>{`
        .queue-panel {
          width: 320px;
          height: 100%;
          border-left: 1px solid var(--border-color);
          background: rgba(12, 12, 18, 0.85);
          display: flex;
          flex-direction: column;
          z-index: 10;
          animation: slide-in-q 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slide-in-q {
          from {
            transform: translate3d(100%, 0, 0);
          }
          to {
            transform: translate3d(0, 0, 0);
          }
        }

        .queue-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
        }

        .queue-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-main);
        }

        .queue-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .clear-queue-btn {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          transition: all 0.2s;
        }

        .clear-queue-btn:hover {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.05);
        }

        .close-queue-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: var(--text-muted);
          transition: all 0.2s;
        }

        .close-queue-btn:hover {
          color: var(--text-main);
          background: var(--bg-hover);
        }

        .queue-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .queue-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
          text-align: left;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-dimmed);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .queue-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 6px;
          background: rgba(255,255,255,0.02);
          border: 1px solid transparent;
          transition: all 0.2s;
        }

        .queue-item:hover {
          background: var(--bg-hover);
          border-color: var(--border-color);
        }

        .queue-item.active {
          background: rgba(29, 185, 84, 0.05);
          border-color: rgba(29, 185, 84, 0.15);
        }

        .queue-item-cover {
          width: 36px;
          height: 36px;
          border-radius: 4px;
          object-fit: cover;
          background: rgba(255,255,255,0.05);
        }

        .queue-item-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .queue-track-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .queue-artist-name {
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .queue-empty-text {
          font-size: 12px;
          color: var(--text-dimmed);
          padding: 12px;
          text-align: center;
          background: rgba(255,255,255,0.01);
          border-radius: 6px;
          border: 1px dashed var(--border-color);
        }

        .upcoming-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* Tiny EQ Wave indicator */
        .eq-wave-mini {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 12px;
        }

        .eq-bar {
          width: 2px;
          height: 2px;
          background: var(--primary);
          border-radius: 1px;
        }

        .eq-bar.animated {
          animation: eq-mini-bounce 0.8s ease-in-out infinite alternate;
        }

        .eq-bar.animated:nth-child(1) { animation-duration: 0.6s; }
        .eq-bar.animated:nth-child(2) { animation-duration: 0.9s; animation-delay: 0.2s; }
        .eq-bar.animated:nth-child(3) { animation-duration: 0.7s; animation-delay: 0.4s; }

        @keyframes eq-mini-bounce {
          to { height: 12px; }
        }

        /* Hover actions in upcoming queue */
        .queue-item-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .queue-item:hover .queue-item-actions {
          opacity: 1;
        }

        .item-action-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          color: var(--text-muted);
        }

        .item-action-btn:hover {
          color: var(--text-main);
          background: rgba(255,255,255,0.05);
        }
        
        .item-action-btn.delete:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        @media (max-width: 768px) {
          .queue-panel {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            height: 100vh;
            height: 100dvh;
            z-index: 2000;
            background: rgba(10, 10, 15, 0.98);
            border-left: none;
          }
        }
      `}</style>
    </div>
  );
}
