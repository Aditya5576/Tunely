import { Home, Search, Library, Plus, Music, Trash2, Heart, LogIn, LogOut, Palette, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

import TunelyLogo from './TunelyLogo';

const PRE_CONFIGURED_PLAYLISTS = [
  { id: '1079336813', name: 'Chill Lo-Fi Mix', type: 'playlist' },
  { id: '83313988', name: 'Top Hindi Hits', type: 'playlist' },
  { id: '1108582', name: 'Global Top 50', type: 'playlist' },
  { id: '69996470', name: 'AiSh, Vol. 4', type: 'album' }
];

export default function Sidebar({ selectedPlaylistId, customPlaylists, setCustomPlaylists, isSidebarOpen, setIsSidebarOpen, createNewPlaylist, onShowAuthModal, onShowThemeModal, onShowWhatsNew }) {
  const { user, isLoggedIn, logout } = useAuth() || {};
  const navigate = useNavigate();
  const location = useLocation();

  // Handles deleting a custom playlist
  const deletePlaylist = (e, playlistId) => {
    e.stopPropagation();
    const playlistToDelete = customPlaylists.find(p => p.id === playlistId);
    if (confirm(`Are you sure you want to delete "${playlistToDelete?.name}"?`)) {
      const updatedPlaylists = customPlaylists.filter(p => p.id !== playlistId);
      setCustomPlaylists(updatedPlaylists);
      localStorage.setItem('spotify_custom_playlists', JSON.stringify(updatedPlaylists));
    }
  };

  const handlePlaylistClick = (playlist) => {
    if (playlist.id === 'liked') {
      navigate('/custom/liked');
    } else if (playlist.type) {
      navigate(`/${playlist.type}/${playlist.id}`);
    } else {
      navigate(`/custom/${playlist.id}`);
    }
    if (setIsSidebarOpen) setIsSidebarOpen(false);
  };

  return (
    <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
      {/* Sidebar Header / Brand Logo */}
      <div className="sidebar-header" onClick={() => navigate('/')}>
        <TunelyLogo size={28} />
        <h2>Tunely🎶<span className="dot">.</span></h2>
      </div>

      {/* Main Navigation Menu */}
      <nav className="nav-menu">
        <div 
          className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => { navigate('/'); if (setIsSidebarOpen) setIsSidebarOpen(false); }}
        >
          <Home size={18} />
          <span>Home</span>
        </div>
        <div 
          className={`nav-item ${location.pathname === '/search' ? 'active' : ''}`}
          onClick={() => { navigate('/search'); if (setIsSidebarOpen) setIsSidebarOpen(false); }}
        >
          <Search size={18} />
          <span>Search</span>
        </div>
        <div 
          className={`nav-item ${location.pathname === '/library' ? 'active' : ''}`}
          onClick={() => { navigate('/library'); if (setIsSidebarOpen) setIsSidebarOpen(false); }}
        >
          <Library size={18} />
          <span>Your Library</span>
        </div>
      </nav>

      {/* Playlists Section */}
      <div className="sidebar-playlists">
        <div className="playlists-header">
          <span>PLAYLISTS</span>
          <button className="create-playlist-btn" onClick={createNewPlaylist} title="Create Playlist">
            <Plus size={16} />
          </button>
        </div>

        <div className="playlists-scroll">
          {/* Static Liked Songs Playlist */}
          <div 
            className={`playlist-item ${selectedPlaylistId === 'liked' ? 'active' : ''}`}
            onClick={() => handlePlaylistClick({ id: 'liked' })}
          >
            <div className="playlist-icon liked" style={{ 
              background: 'linear-gradient(135deg, #450af5 0%, #8e2de2 100%)',
              color: '#ffffff',
              border: '1px solid rgba(0, 229, 255, 0.25)',
              boxShadow: '0 0 10px rgba(0, 229, 255, 0.15)'
            }}>
              <Heart size={11} fill="currentColor" />
            </div>
            <span className="playlist-name" style={{ fontWeight: selectedPlaylistId === 'liked' ? '600' : 'normal' }}>Liked Songs</span>
          </div>

          {/* Custom Playlists */}
          {customPlaylists.length > 0 && (
            <div className="playlist-group">
              <span className="group-title">Custom Playlists</span>
              {customPlaylists.map(playlist => (
                <div 
                  key={playlist.id} 
                  className={`playlist-item ${selectedPlaylistId === playlist.id ? 'active' : ''}`}
                  onClick={() => handlePlaylistClick(playlist)}
                >
                  <div className="playlist-icon custom">
                    <Music size={14} />
                  </div>
                  <span className="playlist-name">{playlist.name}</span>
                  <button 
                    className="delete-playlist-btn"
                    onClick={(e) => deletePlaylist(e, playlist.id)}
                    title="Delete Playlist"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Featured Playlists */}
          <div className="playlist-group">
            <span className="group-title">Featured Content</span>
            {PRE_CONFIGURED_PLAYLISTS.map(playlist => (
              <div 
                key={playlist.id} 
                className={`playlist-item ${selectedPlaylistId === playlist.id ? 'active' : ''}`}
                onClick={() => handlePlaylistClick(playlist)}
              >
                <div className="playlist-icon">
                  <Music size={14} />
                </div>
                <span className="playlist-name">{playlist.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Account Section */}
      <div className="sidebar-account">
        {isLoggedIn ? (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" style={{ cursor: user?.email === 'aditya@admin.com' ? 'pointer' : 'default' }} onClick={() => { if (user?.email === 'aditya@admin.com') navigate('/admin'); }}>
              {(user?.name || user?.email || 'U').trim().charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info" style={{ cursor: user?.email === 'aditya@admin.com' ? 'pointer' : 'default' }} onClick={() => { if (user?.email === 'aditya@admin.com') navigate('/admin'); }}>
              <span className="sidebar-user-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {user?.name}
                {user?.email === 'aditya@admin.com' && <Shield size={12} color="#ef4444" fill="#ef4444" style={{ display: 'inline-block' }} />}
              </span>
              <span className="sidebar-user-email">{user?.email}</span>
            </div>
            <button className="sidebar-logout-btn" onClick={logout} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button className="sidebar-signin-btn" onClick={onShowAuthModal}>
            <LogIn size={16} />
            <span>Sign in to sync</span>
          </button>
        )}
        <div className="sidebar-dev-credit" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', marginTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Developed by <span className="dev-name" style={{ color: '#fff', fontWeight: 600 }}>Aditya Patil</span></div>
          <span 
            className="sidebar-version-badge" 
            onClick={onShowWhatsNew}
            title="View latest updates"
            style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700, background: 'rgba(0, 229, 255, 0.08)', padding: '3px 10px', borderRadius: 10, border: '1px solid rgba(0, 229, 255, 0.25)', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            v4.1.0-stable • What's New ✨
          </span>
        </div>
      </div>

      {/* Embedded CSS for Sidebar styling */}
      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          height: 100%;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-color);
          background: var(--bg-panel);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          padding: 24px 16px;
          z-index: 10;
          overflow: hidden;
          box-sizing: border-box;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px 24px;
          cursor: pointer;
        }

        .logo-icon {
          width: 24px;
          height: 24px;
          background-color: var(--primary);
          border-radius: 50%;
          position: relative;
          box-shadow: 0 0 10px var(--primary-glow);
        }

        .logo-icon::before {
          content: '';
          position: absolute;
          width: 12px;
          height: 12px;
          border-top: 2px solid var(--bg-darker);
          border-right: 2px solid var(--bg-darker);
          border-radius: 0 50% 0 0;
          top: 7px;
          left: 4px;
          transform: rotate(45deg);
        }

        .sidebar-header h2 {
          font-family: var(--font-serif);
          font-size: 24px;
          font-weight: 600;
          color: var(--text-main);
          letter-spacing: -0.02em;
        }

        .sidebar-header .dot {
          color: var(--primary);
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 24px;
        }

        .nav-item {
          width: 100%;
          padding: 12px 16px;
          justify-content: flex-start;
          gap: 16px;
          border-radius: 8px;
          color: var(--text-muted);
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .nav-item:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.03);
          transform: translateX(2px);
        }

        .nav-item.active {
          color: var(--text-main);
          background: rgba(0, 229, 255, 0.04);
          font-weight: 600;
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 25%;
          height: 50%;
          width: 3px;
          background: var(--primary);
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 10px var(--primary-glow);
        }

        .library-section {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .library-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 12px;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 12px;
        }

        .library-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .add-playlist-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: var(--text-muted);
          transition: all 0.2s;
        }

        .add-playlist-btn:hover {
          color: var(--text-main);
          background: var(--bg-hover);
        }

        .playlists-container {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-right: 4px;
        }

        .playlist-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .group-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-dimmed);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 12px;
        }

        .playlist-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          color: var(--text-muted);
          position: relative;
          group: hover;
        }

        .playlist-item:hover {
          color: var(--text-main);
          background: var(--bg-hover);
        }

        .playlist-item.active {
          color: var(--text-main);
          background: var(--bg-active);
          font-weight: 500;
        }

        .playlist-icon {
          width: 24px;
          height: 24px;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .playlist-icon.custom {
          background: rgba(0, 229, 255, 0.1);
          color: var(--primary);
        }

        .playlist-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .delete-playlist-btn {
          opacity: 0;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          color: var(--text-dimmed);
          transition: all 0.2s;
        }

        .playlist-item:hover .delete-playlist-btn {
          opacity: 1;
        }

        .delete-playlist-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .sidebar-footer {
          margin-top: auto;
          padding: 16px 8px 0;
          border-top: 1px solid var(--border-color);
          text-align: center;
          font-size: 11px;
          color: var(--text-dimmed);
          font-weight: 500;
          letter-spacing: 0.03em;
        }

        .sidebar-account {
          flex-shrink: 0;
          padding-top: 12px;
          margin-top: 8px;
          border-top: 1px solid var(--border-color);
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          margin-bottom: 8px;
        }

        .sidebar-user-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          color: #fff;
          flex-shrink: 0;
        }

        .sidebar-user-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .sidebar-user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-user-email {
          font-size: 10px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-logout-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
          flex-shrink: 0;
        }

        .sidebar-logout-btn:hover { color: #ff6b6b; }

        .sidebar-signin-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          background: rgba(255,255,255,0.04);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 8px;
        }

        .sidebar-signin-btn:hover {
          background: rgba(var(--primary-rgb, 139, 92, 246), 0.12);
          color: var(--primary);
          border-color: var(--primary);
        }

        .sidebar-dev-credit {
          font-size: 11px;
          color: var(--text-muted);
          text-align: center;
          padding: 10px 0 4px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin-top: 12px;
          letter-spacing: 0.03em;
        }

        .sidebar-dev-credit .dev-name {
          color: var(--primary);
          font-weight: 700;
          text-shadow: 0 0 8px var(--primary-glow);
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            height: 100vh;
            height: 100dvh;
            width: 270px;
            transform: translate3d(-100%, 0, 0);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 1000;
            background: rgba(10, 10, 15, 0.95);
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            border-radius: 0 16px 16px 0;
            border: 1px solid var(--border-color);
            border-left: none;
          }

          .sidebar.open {
            transform: translate3d(0, 0, 0);
            box-shadow: 10px 0 45px rgba(0, 0, 0, 0.65);
          }
        }
      `}</style>
    </aside>
  );
}
