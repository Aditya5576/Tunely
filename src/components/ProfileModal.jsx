import { useState, useEffect } from 'react';
import { User, X, Edit3, Shield, Key, LogOut, Check, Sparkles, Calendar, Mail, Heart, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AVATAR_GRADIENTS = [
  { name: 'Cyan & Purple', value: 'linear-gradient(135deg, #00e5ff, #7f00ff)' },
  { name: 'Cyberpunk Pink', value: 'linear-gradient(135deg, #ff007f, #7f00ff)' },
  { name: 'Emerald Green', value: 'linear-gradient(135deg, #00e676, #00b0ff)' },
  { name: 'Sunset Orange', value: 'linear-gradient(135deg, #ff9100, #ff0055)' },
  { name: 'Ocean Blue', value: 'linear-gradient(135deg, #00b0ff, #3d5afe)' },
  { name: 'Obsidian Gold', value: 'linear-gradient(135deg, #ffd700, #ff8c00)' }
];

export default function ProfileModal({ isOpen, onClose, setShowAuthModal }) {
  const { user, logout, updateUserProfile, requestPasswordReset } = useAuth() || {};
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editBio, setEditBio] = useState(user?.bio || 'Music is the soundtrack of life 🎧');
  const [selectedGradient, setSelectedGradient] = useState(user?.avatarBg || AVATAR_GRADIENTS[0].value);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditBio(user.bio || 'Music is the soundtrack of life 🎧');
      setSelectedGradient(user.avatarBg || AVATAR_GRADIENTS[0].value);
    }
  }, [user]);

  if (!isOpen) return null;

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (updateUserProfile) {
      updateUserProfile({
        name: editName.trim() || user?.email?.split('@')[0] || 'Listener',
        bio: editBio.trim(),
        avatarBg: selectedGradient
      });
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsEditing(false);
    }, 1200);
  };

  const handlePasswordReset = async () => {
    if (!user?.email || user?.isGuest) return;
    setIsResettingPassword(true);
    setResetMessage('');
    try {
      const res = await requestPasswordReset(user.email);
      if (res.success) {
        setResetMessage('Reset code sent to your email!');
      } else {
        setResetMessage(res.error || 'Failed to send reset code');
      }
    } catch {
      setResetMessage('Connection error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'July 2026';

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal-container glass-panel" onClick={(e) => e.stopPropagation()}>
        
        {/* Header Bar */}
        <div className="profile-modal-header">
          <span className="profile-modal-title">
            {isEditing ? 'Edit Profile' : 'User Profile'}
          </span>
          <button className="profile-close-btn" onClick={onClose} title="Close Profile">
            <X size={20} />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="profile-modal-body">
          
          {/* FEATURE 1: PROFILE HEADER & IDENTITY */}
          <div className="profile-identity-section">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-large" style={{ background: selectedGradient }}>
                {(user?.name || user?.email || 'U').trim().charAt(0).toUpperCase()}
              </div>
              <span className="profile-status-badge">
                {user?.isGuest ? (
                  <>👤 Guest Mode</>
                ) : user?.email === 'aditya@admin.com' ? (
                  <>👑 Admin PRO</>
                ) : (
                  <>💎 PRO Member</>
                )}
              </span>
            </div>

            <div className="profile-identity-info">
              <h2>{user?.name || 'Guest Listener'}</h2>
              <span className="profile-email-text">
                <Mail size={13} style={{ marginRight: 4, display: 'inline-block' }} />
                {user?.email || 'Guest Mode'}
              </span>
              
              <div className="profile-meta-row">
                <span className="profile-meta-item">
                  <Calendar size={13} style={{ marginRight: 4, display: 'inline-block' }} />
                  Member since {memberSince}
                </span>
              </div>

              {!isEditing && (
                <p className="profile-bio-text">
                  "{user?.bio || 'Music is the soundtrack of life 🎧'}"
                </p>
              )}
            </div>
          </div>

          <div className="profile-divider"></div>

          {/* VIEW MODE VS EDIT MODE TOGGLE */}
          {user && !user.isGuest && (
            <div className="profile-mode-actions">
              <button 
                className={`profile-tab-btn ${!isEditing ? 'active' : ''}`}
                onClick={() => setIsEditing(false)}
              >
                <User size={15} />
                <span>View Identity</span>
              </button>
              <button 
                className={`profile-tab-btn ${isEditing ? 'active' : ''}`}
                onClick={() => setIsEditing(true)}
              >
                <Edit3 size={15} />
                <span>Edit Profile</span>
              </button>
            </div>
          )}

          {/* FEATURE 6: EDIT PROFILE FORM */}
          {isEditing && (
            <form onSubmit={handleSaveProfile} className="edit-profile-form">
              <div className="form-group">
                <label>Display Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter display name"
                  maxLength={30}
                  required
                />
              </div>

              <div className="form-group">
                <label>Music Bio / Quote</label>
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Share your favorite music quote..."
                  maxLength={120}
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label><Palette size={14} style={{ marginRight: 4, display: 'inline-block' }} /> Avatar Gradient Theme</label>
                <div className="gradient-picker-grid">
                  {AVATAR_GRADIENTS.map((g, idx) => (
                    <div 
                      key={idx}
                      className={`gradient-swatch ${selectedGradient === g.value ? 'selected' : ''}`}
                      style={{ background: g.value }}
                      onClick={() => setSelectedGradient(g.value)}
                      title={g.name}
                    >
                      {selectedGradient === g.value && <Check size={14} color="#fff" />}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="save-profile-btn" disabled={saveSuccess}>
                {saveSuccess ? <Check size={16} color="#10b981" /> : <Sparkles size={16} />}
                <span>{saveSuccess ? 'Changes Saved!' : 'Save Profile Changes'}</span>
              </button>
            </form>
          )}

          {/* FEATURE 7: ACCOUNT & SECURITY ACTIONS */}
          <div className="account-security-section">
            <h4 className="section-subtitle">Account & Security</h4>

            {user && !user.isGuest ? (
              <div className="security-actions-list">
                {/* 1. Change / Reset Password */}
                <button 
                  className="security-btn"
                  onClick={handlePasswordReset}
                  disabled={isResettingPassword}
                >
                  <Key size={16} className="security-icon" />
                  <div className="security-btn-text">
                    <span className="btn-title">Password & Security</span>
                    <span className="btn-sub">Send password reset OTP code</span>
                  </div>
                </button>
                {resetMessage && (
                  <div className="security-msg">{resetMessage}</div>
                )}

                {/* 2. Admin Panel Shortcut (if Admin) */}
                {user.email === 'aditya@admin.com' && (
                  <button 
                    className="security-btn admin-btn"
                    onClick={() => {
                      onClose();
                      navigate('/admin');
                    }}
                  >
                    <Shield size={16} color="#ef4444" />
                    <div className="security-btn-text">
                      <span className="btn-title" style={{ color: '#ef4444' }}>Admin Control Center</span>
                      <span className="btn-sub">Manage users & System broadcast</span>
                    </div>
                  </button>
                )}

                {/* 3. Sign Out Button */}
                <button 
                  className="security-btn danger-btn"
                  onClick={() => {
                    onClose();
                    logout();
                  }}
                >
                  <LogOut size={16} color="#f87171" />
                  <div className="security-btn-text">
                    <span className="btn-title" style={{ color: '#f87171' }}>Sign Out</span>
                    <span className="btn-sub">Safely log out of your session</span>
                  </div>
                </button>
              </div>
            ) : (
              <div className="guest-security-box">
                <p>You are currently listening in <strong>Guest Mode</strong>.</p>
                <button 
                  className="guest-signin-btn"
                  onClick={() => {
                    onClose();
                    if (setShowAuthModal) setShowAuthModal(true);
                  }}
                >
                  <User size={16} />
                  <span>Sign In or Create Free Account</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* EMBEDDED PROFILE MODAL STYLES */}
      <style>{`
        .profile-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .profile-modal-container {
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          background: rgba(14, 16, 24, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: profileModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes profileModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .profile-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .profile-modal-title {
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          font-family: var(--font-display);
        }

        .profile-close-btn {
          background: rgba(255, 255, 255, 0.06);
          border: none;
          color: #94a3b8;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .profile-close-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        .profile-modal-body {
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* FEATURE 1: IDENTITY */
        .profile-identity-section {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        @media (max-width: 480px) {
          .profile-identity-section {
            flex-direction: column;
            text-align: center;
          }
        }

        .profile-avatar-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .profile-avatar-large {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          box-shadow: 0 0 20px rgba(0, 229, 255, 0.3);
          border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .profile-status-badge {
          font-size: 10px;
          font-weight: 800;
          color: #00e5ff;
          background: rgba(0, 229, 255, 0.12);
          border: 1px solid rgba(0, 229, 255, 0.3);
          padding: 3px 8px;
          border-radius: 12px;
          letter-spacing: 0.02em;
        }

        .profile-identity-info h2 {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
        }

        .profile-email-text {
          font-size: 12px;
          color: #94a3b8;
          display: block;
          margin-bottom: 6px;
        }

        .profile-meta-row {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 8px;
        }

        .profile-bio-text {
          font-size: 13px;
          font-style: italic;
          color: #cbd5e1;
          line-height: 1.4;
        }

        .profile-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          width: 100%;
        }

        /* MODE TOGGLE */
        .profile-mode-actions {
          display: flex;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 4px;
          gap: 4px;
        }

        .profile-tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          border: none;
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .profile-tab-btn.active {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        /* FEATURE 6: EDIT FORM */
        .edit-profile-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 12px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .form-group input, .form-group textarea {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 12px;
          color: #fff;
          font-size: 13px;
          outline: none;
          transition: border 0.2s ease;
        }

        .form-group input:focus, .form-group textarea:focus {
          border-color: #00e5ff;
          background: rgba(255, 255, 255, 0.08);
        }

        .gradient-picker-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
        }

        .gradient-swatch {
          aspect-ratio: 1;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid transparent;
          transition: transform 0.2s ease, border 0.2s ease;
        }

        .gradient-swatch:hover {
          transform: scale(1.1);
        }

        .gradient-swatch.selected {
          border-color: #fff;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
        }

        .save-profile-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #00e5ff, #00b0ff);
          color: #000;
          font-size: 13px;
          font-weight: 800;
          padding: 12px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .save-profile-btn:active {
          transform: scale(0.98);
        }

        /* FEATURE 7: SECURITY */
        .account-security-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .section-subtitle {
          font-size: 13px;
          font-weight: 800;
          color: #94a3b8;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .security-actions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .security-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 12px 14px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }

        .security-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .security-icon {
          color: #00e5ff;
        }

        .security-btn-text {
          display: flex;
          flex-direction: column;
        }

        .btn-title {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
        }

        .btn-sub {
          font-size: 11px;
          color: #64748b;
        }

        .security-btn.admin-btn {
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.05);
        }

        .security-btn.danger-btn {
          border-color: rgba(239, 68, 68, 0.2);
        }

        .security-msg {
          font-size: 12px;
          color: #10b981;
          font-weight: 600;
          padding: 4px 8px;
        }

        .guest-security-box {
          background: rgba(0, 229, 255, 0.05);
          border: 1px solid rgba(0, 229, 255, 0.2);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .guest-security-box p {
          font-size: 13px;
          color: #cbd5e1;
        }

        .guest-signin-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #00e5ff;
          color: #000;
          font-size: 13px;
          font-weight: 800;
          padding: 10px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
