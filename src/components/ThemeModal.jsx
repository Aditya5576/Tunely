import { X } from 'lucide-react';

export default function ThemeModal({ onClose, activeTheme, onChangeTheme }) {
  const themes = [
    { id: 'default', name: 'Obsidian Glacier', color: '#00e5ff', bg: 'linear-gradient(135deg, #00e5ff 0%, #3b82f6 50%, #8b5cf6 100%)' },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', color: '#ff007f', bg: 'linear-gradient(135deg, #ff007f 0%, #9d4edd 50%, #00f0ff 100%)' },
    { id: 'nordic', name: 'Nordic Emerald', color: '#00e676', bg: 'linear-gradient(135deg, #00e676 0%, #10b981 50%, #14b8a6 100%)' },
    { id: 'rose', name: 'Sunset Rose', color: '#ff4d6d', bg: 'linear-gradient(135deg, #ff4d6d 0%, #ffb703 50%, #f72585 100%)' },
    { id: 'solar', name: 'Solar Amber', color: '#ffa000', bg: 'linear-gradient(135deg, #ffa000 0%, #ff5722 50%, #d97706 100%)' },
    { id: 'amethyst', name: 'Royal Amethyst', color: '#a855f7', bg: 'linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #d946ef 100%)' },
    { id: 'amoled', name: 'Midnight AMOLED', color: '#10b981', bg: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #000000 100%)' },
    { id: 'vaporwave', name: 'Tokyo Vaporwave', color: '#f43f5e', bg: 'linear-gradient(135deg, #f43f5e 0%, #8b5cf6 50%, #0ea5e9 100%)' },
    { id: 'abyss', name: 'Deep Ocean Abyss', color: '#0284c7', bg: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 50%, #4338ca 100%)' },
    { id: 'gold', name: 'Champagne Gold', color: '#eab308', bg: 'linear-gradient(135deg, #eab308 0%, #f59e0b 50%, #ea580c 100%)' }
  ];

  return (
    <div className="theme-modal-overlay" onClick={onClose}>
      <div className="theme-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="theme-modal-header">
          <h2>Select Theme</h2>
          <button className="theme-modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="theme-list">
          {themes.map((t) => (
            <div
              key={t.id}
              className={`theme-option-card ${activeTheme === t.id ? 'active' : ''}`}
              onClick={() => onChangeTheme(t.id)}
              style={{
                '--theme-preview-accent': t.color
              }}
            >
              <div className="theme-info-wrapper">
                <div className="theme-color-preview" style={{ background: t.bg, border: '1.5px solid rgba(255,255,255,0.25)' }}></div>
                <span className="theme-name">{t.name}</span>
              </div>
              {activeTheme === t.id && <div className="theme-active-dot"></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
