import { X } from 'lucide-react';

export default function ThemeModal({ onClose, activeTheme, onChangeTheme }) {
  const themes = [
    { id: 'default', name: 'Obsidian Glacier', color: '#00e5ff', bg: '#05060b' },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', color: '#ff007f', bg: '#06030c' },
    { id: 'nordic', name: 'Nordic Emerald', color: '#00e676', bg: '#030806' },
    { id: 'rose', name: 'Sunset Rose', color: '#ff4d6d', bg: '#080405' },
    { id: 'solar', name: 'Solar Amber', color: '#ffa000', bg: '#060503' },
    { id: 'amethyst', name: 'Royal Amethyst', color: '#a855f7', bg: '#08030f' },
    { id: 'amoled', name: 'Midnight AMOLED', color: '#10b981', bg: '#000000' },
    { id: 'vaporwave', name: 'Tokyo Vaporwave', color: '#f43f5e', bg: '#09040e' },
    { id: 'abyss', name: 'Deep Ocean Abyss', color: '#0284c7', bg: '#020712' },
    { id: 'gold', name: 'Champagne Gold', color: '#eab308', bg: '#0a0803' }
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
                <div className="theme-color-preview" style={{ backgroundColor: t.bg }}></div>
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
