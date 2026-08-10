import { useEffect, useMemo, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { X, Loader2 } from 'lucide-react';
import { decodeHtml, parseLyrics } from '../utils/lyrics';

export default function LyricsPanel() {
  const { currentTrack, lyrics, isLoadingLyrics, isLyricsVisible, setIsLyricsVisible, currentTime, duration } = useAudio();
  const activeLineRef = useRef(null);

  const parsedLines = useMemo(() => {
    return parseLyrics(lyrics, duration);
  }, [lyrics, duration]);

  const activeIndex = useMemo(() => {
    if (parsedLines.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < parsedLines.length; i++) {
      if (parsedLines[i].time <= currentTime) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [parsedLines, currentTime]);

  useEffect(() => {
    if (isLyricsVisible && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIndex, isLyricsVisible]);

  if (!isLyricsVisible) return null;

  return (
    <div className="lyrics-panel glass-panel">
      {/* Header */}
      <div className="lyrics-header">
        <h3>Lyrics</h3>
        <button className="close-lyrics-btn" onClick={() => setIsLyricsVisible(false)} title="Close lyrics">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="lyrics-content-container">
        {currentTrack ? (
          <>
            <div className="lyrics-track-info">
              <span className="lyrics-track-name">{decodeHtml(currentTrack.name)}</span>
              <span className="lyrics-track-artist">
                {decodeHtml(currentTrack.artists?.primary?.map(a => a.name).join(', ') || 'Unknown Artist')}
              </span>
            </div>

            {isLoadingLyrics ? (
              <div className="lyrics-loading">
                <Loader2 size={24} className="spinner" />
                <span>Fetching lyrics...</span>
              </div>
            ) : (
              <div className="lyrics-text">
                {parsedLines.length > 0 ? (
                  parsedLines.map((line, idx) => {
                    const isActive = idx === activeIndex;
                    return (
                      <p 
                        key={idx} 
                        ref={isActive ? activeLineRef : null}
                        className={`lyrics-line ${isActive ? 'active' : ''}`}
                        style={{
                          color: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.4)',
                          fontSize: isActive ? '20px' : '16px',
                          transform: isActive ? 'scale(1.02)' : 'scale(1)',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          fontWeight: isActive ? '700' : '500',
                          padding: '10px 0',
                          margin: 0,
                          textShadow: isActive ? '0 0 15px var(--primary-glow)' : 'none'
                        }}
                      >
                        {line.text}
                      </p>
                    );
                  })
                ) : (
                  <p className="lyrics-empty">No lyrics found for this song.</p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="lyrics-empty-state">
            <p>Select a track to view lyrics</p>
          </div>
        )}
      </div>

      {/* Embedded CSS for LyricsPanel styling */}
      <style>{`
        .lyrics-panel {
          width: 320px;
          height: 100%;
          border-left: 1px solid var(--border-color);
          background: rgba(12, 12, 18, 0.85);
          display: flex;
          flex-direction: column;
          z-index: 10;
          animation: slide-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slide-in {
          from {
            transform: translate3d(100%, 0, 0);
          }
          to {
            transform: translate3d(0, 0, 0);
          }
        }

        .lyrics-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
        }

        .lyrics-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-main);
        }

        .close-lyrics-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: var(--text-muted);
          transition: all 0.2s;
        }

        .close-lyrics-btn:hover {
          color: var(--text-main);
          background: var(--bg-hover);
        }

        .lyrics-content-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .lyrics-track-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .lyrics-track-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-main);
        }

        .lyrics-track-artist {
          font-size: 13px;
          color: var(--text-muted);
        }

        .lyrics-loading {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-muted);
          font-size: 14px;
        }

        .lyrics-text {
          font-size: 16px;
          line-height: 1.8;
          color: var(--text-muted);
          overflow-y: visible;
          padding-bottom: 40px;
        }

        .lyrics-line {
          margin-bottom: 8px;
          transition: color 0.2s;
          font-weight: 600;
          text-shadow: 0 0 10px rgba(255,255,255,0.02);
        }

        .lyrics-line:hover {
          color: var(--text-main);
        }

        .lyrics-break {
          height: 16px;
        }

        .lyrics-empty, .lyrics-empty-state {
          color: var(--text-dimmed);
          font-size: 14px;
          text-align: center;
          padding: 40px 0;
        }

        @media (max-width: 768px) {
          .lyrics-panel {
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
