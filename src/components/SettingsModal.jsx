import React, { useState } from 'react';
import { X, Volume2, Palette, Shield, Trash2, Check, User, Sparkles } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';

export default function SettingsModal({ isOpen, onClose, activeTheme, onChangeTheme }) {
  const { audioQuality, setAudioQuality } = useAudio();
  const { user, isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState('audio');
  const [clearedNotice, setClearedNotice] = useState(false);

  if (!isOpen) return null;

  const themes = [
    { id: 'default', name: 'Obsidian Glacier', color: '#6366f1' },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', color: '#00ffcc' },
    { id: 'nordic', name: 'Nordic Emerald', color: '#10b981' },
    { id: 'rose', name: 'Sunset Rose', color: '#f43f5e' },
    { id: 'solar', name: 'Solar Amber', color: '#f59e0b' },
    { id: 'amethyst', name: 'Royal Amethyst', color: '#a855f7' },
    { id: 'amoled', name: 'Midnight AMOLED', color: '#3b82f6' },
    { id: 'vaporwave', name: 'Tokyo Vaporwave', color: '#ff71ce' },
    { id: 'abyss', name: 'Deep Ocean Abyss', color: '#00d2ff' },
    { id: 'gold', name: 'Champagne Gold', color: '#eab308' },
  ];

  const handleClearData = () => {
    try {
      localStorage.removeItem('tunely_search_history');
      localStorage.removeItem('tunely_recently_played');
      localStorage.removeItem('tunely_last_seen_broadcast_ts');
      localStorage.removeItem('tunely_liked_songs_metadata');
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 3000);
    } catch (e) {
      console.error('Failed to clear local cache:', e);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '85vh',
          backgroundColor: '#121318',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#ffffff',
          fontFamily: "'Outfit', 'Inter', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} style={{ color: '#6366f1' }} />
            <h2 id="settings-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              Settings & Privacy
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0 16px',
            gap: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          {[
            { id: 'audio', label: 'Audio', icon: Volume2 },
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'account', label: 'Account & Privacy', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                  color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* AUDIO TAB */}
          {activeTab === 'audio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: '#ffffff' }}>
                  Streaming Audio Quality
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', margin: '0 0 16px 0' }}>
                  Select streaming bitrates for music playback.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { id: '320kbps', label: 'High (320kbps)', desc: 'Best audio fidelity' },
                    { id: '160kbps', label: 'Standard (160kbps)', desc: 'Balanced bandwidth and quality' },
                    { id: '96kbps', label: 'Data Saver (96kbps)', desc: 'Saves mobile data' },
                  ].map((option) => {
                    const isSelected = audioQuality === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setAudioQuality(option.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 18px',
                          borderRadius: '12px',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                          border: isSelected ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{option.label}</div>
                          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                            {option.desc}
                          </div>
                        </div>
                        {isSelected && <Check size={18} style={{ color: '#6366f1' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: '#ffffff' }}>
                Application Theme
              </h3>
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', margin: '0 0 16px 0' }}>
                Customize your visual palette.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                {themes.map((theme) => {
                  const isSelected = activeTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => onChangeTheme && onChangeTheme(theme.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                        color: '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: theme.color,
                          boxShadow: `0 0 8px ${theme.color}66`,
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400 }}>{theme.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ACCOUNT & PRIVACY TAB */}
          {activeTab === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Identity Status */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6366f1',
                  }}
                >
                  <User size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                    {isLoggedIn && user ? (user.name || 'Cloud User') : 'Guest Listener'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                    {isLoggedIn && user ? `Registered Account (${user.email || 'Cloud user'})` : 'Offline Guest Mode'}
                  </div>
                </div>
              </div>

              {/* Data & Privacy Actions */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#ffffff' }}>
                  Privacy & Data Management
                </h4>
                <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.5, marginBottom: '14px' }}>
                  Tunely features zero third-party tracking, PBKDF2 password hashing, and minimal data retention. Session history is stored locally or synced securely to Cloudflare D1.
                </p>

                <button
                  onClick={handleClearData}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={16} />
                  <span>Clear Cached Local Data</span>
                </button>

                {clearedNotice && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#34d399',
                      fontSize: '12px',
                      textAlign: 'center',
                    }}
                  >
                    Local search history and cached data cleared safely.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
