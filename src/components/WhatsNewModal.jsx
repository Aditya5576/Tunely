import { X, Sparkles, Zap, Shield, Music, Layers, CheckCircle2 } from 'lucide-react';
import TunelyLogo from './TunelyLogo';

export default function WhatsNewModal({ onClose }) {
  const HIGHLIGHTS = [
    {
      icon: <Zap size={18} color="var(--primary)" />,
      title: "Real-Time Multi-Device Sync",
      desc: "Sub-8-second real-time library synchronization across mobile & desktop with active 15s user activity heartbeats."
    },
    {
      icon: <Sparkles size={18} color="#a855f7" />,
      title: "Redesigned Library & Grid View",
      desc: "Liked Songs showcase hero card, responsive playlist cards, and automated playlist deduplication."
    },
    {
      icon: <Layers size={18} color="#3b82f6" />,
      title: "Executive Desktop & Mobile UI",
      desc: "72px sticky glass header bar, 48px desktop breathing side padding, and native mobile container isolation."
    },
    {
      icon: <Shield size={18} color="#10b981" />,
      title: "Live D1 SQL Admin Panel",
      desc: "4-column executive metrics, real-time user directory, active session status badges, and 99.3% KV optimization."
    },
    {
      icon: <Music size={18} color="#f43f5e" />,
      title: "10 Ambient Color Themes & Quality Control",
      desc: "3-stop radial color themes with live switching and Lossless 320kbps audio streaming selection."
    }
  ];

  return (
    <div className="whatsnew-modal-overlay" onClick={onClose}>
      <div className="whatsnew-modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="whatsnew-header">
          <div className="whatsnew-brand">
            <TunelyLogo size={32} />
            <div>
              <div className="whatsnew-title-row">
                <h2>What's New in Tunely</h2>
                <span className="whatsnew-version-badge">v4.1.0-stable</span>
              </div>
              <span className="whatsnew-subtitle">Latest product updates & performance engine enhancements</span>
            </div>
          </div>
          <button className="whatsnew-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Status Banner */}
        <div className="whatsnew-status-banner">
          <CheckCircle2 size={16} color="var(--primary)" />
          <span>You are on the latest production build • Live on Cloudflare Edge</span>
        </div>

        {/* Feature List */}
        <div className="whatsnew-list">
          {HIGHLIGHTS.map((item, idx) => (
            <div key={idx} className="whatsnew-item">
              <div className="whatsnew-item-icon">
                {item.icon}
              </div>
              <div className="whatsnew-item-text">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="whatsnew-footer">
          <button className="whatsnew-done-btn" onClick={onClose}>
            Awesome, let's play music!
          </button>
        </div>
      </div>

      <style>{`
        .whatsnew-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(4, 5, 10, 0.88);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: whatsnew-fade-in 0.2s ease-out;
        }

        @keyframes whatsnew-fade-in {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }

        .whatsnew-modal-content {
          width: 100%;
          max-width: 520px;
          background: rgba(14, 16, 26, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 28px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .whatsnew-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .whatsnew-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .whatsnew-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .whatsnew-title-row h2 {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .whatsnew-version-badge {
          font-size: 11px;
          font-weight: 700;
          color: var(--primary);
          background: rgba(0, 229, 255, 0.1);
          border: 1px solid rgba(0, 229, 255, 0.25);
          padding: 2px 8px;
          border-radius: 12px;
        }

        .whatsnew-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
          display: block;
        }

        .whatsnew-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .whatsnew-close-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        .whatsnew-status-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(0, 229, 255, 0.05);
          border: 1px solid rgba(0, 229, 255, 0.15);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-main);
        }

        .whatsnew-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-height: 340px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .whatsnew-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: background 0.2s;
        }

        .whatsnew-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .whatsnew-item-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .whatsnew-item-text h3 {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 4px;
        }

        .whatsnew-item-text p {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.45;
        }

        .whatsnew-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 4px;
        }

        .whatsnew-done-btn {
          width: 100%;
          padding: 12px;
          border-radius: 20px;
          background: var(--primary);
          color: #000;
          font-size: 13px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 16px var(--primary-glow);
          transition: transform 0.2s;
        }

        .whatsnew-done-btn:hover {
          transform: scale(1.01);
        }

        .whatsnew-done-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
