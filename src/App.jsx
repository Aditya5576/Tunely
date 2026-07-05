import { useState, useEffect, useRef } from 'react';
import { Home, Search, ListMusic, Music, Settings, Info, Palette, X, User, Shield } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import PlayerBar from './components/PlayerBar';
import LyricsPanel from './components/LyricsPanel';
import QueuePanel from './components/QueuePanel';
import { AudioProvider } from './context/AudioContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import ThemeModal from './components/ThemeModal';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AdminPanel from './components/AdminPanel';

const API_BASE = (import.meta.env.VITE_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev').trim();

function TunelyApp() {
  const { user, logout, isLoggedIn, isLoading, authFetch } = useAuth() || {};
  const navigate = useNavigate();
  const location = useLocation();

  const [showSplash, setShowSplash] = useState(true);
  const [isSplashMounted, setIsSplashMounted] = useState(true);

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [activeTheme, _setActiveTheme] = useState(() => localStorage.getItem('tunely_theme') || 'default');

  const changeTheme = (themeId) => {
    document.body.classList.remove('theme-cyberpunk', 'theme-nordic', 'theme-rose', 'theme-solar');
    if (themeId !== 'default') document.body.classList.add(`theme-${themeId}`);
    localStorage.setItem('tunely_theme', themeId);
    _setActiveTheme(themeId);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('tunely_theme');
    if (savedTheme && savedTheme !== 'default') document.body.classList.add(`theme-${savedTheme}`);
  }, []);

  // Custom playlists state
  const [customPlaylists, _setCustomPlaylists] = useState(() => {
    try {
      const saved = localStorage.getItem('spotify_custom_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse custom playlists from localStorage:', e);
    }
    return [];
  });

  // Persists playlists locally AND pushes to server for cross-device sync
  const setCustomPlaylists = (newPlaylistsOrFn) => {
    _setCustomPlaylists(prev => {
      const updated = typeof newPlaylistsOrFn === 'function' ? newPlaylistsOrFn(prev) : newPlaylistsOrFn;
      const now = new Date().toISOString();
      localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));
      localStorage.setItem('tunely_custom_playlists_updated_at', now);
      return updated;
    });
  };

  // Push playlists to server (fire-and-forget)
  const pushPlaylistsToServer = useRef(null);
  useEffect(() => {
    pushPlaylistsToServer.current = async (playlists) => {
      if (!isLoggedIn || !authFetch || user?.isGuest) return;
      try {
        const localUpdatedAt = localStorage.getItem('tunely_custom_playlists_updated_at') || new Date().toISOString();
        await authFetch(`${API_BASE}/api/user/playlists/sync`, {
          method: 'POST',
          body: JSON.stringify({ playlists, localUpdatedAt })
        });
      } catch (e) {
        console.warn('Custom playlists push to server failed:', e);
      }
    };
  }, [isLoggedIn, authFetch, user]);

  // Sync custom playlists FROM server on login
  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn || !authFetch || user?.isGuest) return;

    const syncPlaylists = async () => {
      try {
        const localPlaylists = JSON.parse(localStorage.getItem('spotify_custom_playlists') || '[]');
        const localUpdatedAt = localStorage.getItem('tunely_custom_playlists_updated_at') || new Date(0).toISOString();

        const res = await authFetch(`${API_BASE}/api/user/playlists/sync`, {
          method: 'POST',
          body: JSON.stringify({ playlists: localPlaylists, localUpdatedAt })
        });
        if (!res.ok) return;
        const { data } = await res.json();
        if (data && Array.isArray(data.playlists)) {
          _setCustomPlaylists(data.playlists);
          localStorage.setItem('spotify_custom_playlists', JSON.stringify(data.playlists));
          if (data.serverUpdatedAt) {
            localStorage.setItem('tunely_custom_playlists_updated_at', data.serverUpdatedAt);
          }
        }
      } catch (e) {
        console.warn('Custom playlists sync from server failed:', e);
      }
    };

    syncPlaylists();
  }, [isLoggedIn, isLoading, authFetch, user]);

  // Push to server whenever playlists change (debounced 1s)
  const playlistPushTimer = useRef(null);
  useEffect(() => {
    if (!isLoggedIn || !authFetch || user?.isGuest || isLoading) return;
    clearTimeout(playlistPushTimer.current);
    playlistPushTimer.current = setTimeout(() => {
      if (pushPlaylistsToServer.current) {
        pushPlaylistsToServer.current(customPlaylists);
      }
    }, 1000);
    return () => clearTimeout(playlistPushTimer.current);
  }, [customPlaylists, isLoggedIn, authFetch, user, isLoading]);

  // Poll server every 30s for playlist changes from other devices
  useEffect(() => {
    if (isLoading || !isLoggedIn || !authFetch || user?.isGuest) return;
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const localPlaylists = JSON.parse(localStorage.getItem('spotify_custom_playlists') || '[]');
        const localUpdatedAt = localStorage.getItem('tunely_custom_playlists_updated_at') || new Date(0).toISOString();
        const res = await authFetch(`${API_BASE}/api/user/playlists/sync`, {
          method: 'POST',
          body: JSON.stringify({ playlists: localPlaylists, localUpdatedAt })
        });
        if (!res.ok) return;
        const { data } = await res.json();
        if (data?.playlists && data.source === 'server') {
          _setCustomPlaylists(data.playlists);
          localStorage.setItem('spotify_custom_playlists', JSON.stringify(data.playlists));
          if (data.serverUpdatedAt) localStorage.setItem('tunely_custom_playlists_updated_at', data.serverUpdatedAt);
        }
      } catch (e) {
        console.warn('Playlist poll failed:', e);
      }
    };
    const intervalId = setInterval(poll, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isLoggedIn, isLoading, authFetch, user]);

  // Splash animation
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setShowSplash(false);
      const unmountTimer = setTimeout(() => setIsSplashMounted(false), 600);
      return () => clearTimeout(unmountTimer);
    }, 1500);
    return () => clearTimeout(fadeTimer);
  }, []);

  // Logout handling – redirect to home
  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, isLoading, navigate]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Create new custom playlist (also triggers server push via the customPlaylists effect)
  const createNewPlaylist = () => {
    const name = prompt('Enter playlist name:', `My Playlist #${customPlaylists.length + 1}`);
    if (!name || name.trim() === '') return;
    const newPlaylist = { id: `custom_${Date.now()}`, name: name.trim(), type: 'custom', songs: [] };
    setCustomPlaylists(prev => [...prev, newPlaylist]);
  };

  // Determine current view based on route
  const pathParts = location.pathname.split('/').filter(Boolean);
  const viewMap = {
    '': 'home',
    search: 'search',
    library: 'library',
    playlist: 'playlist',
    album: 'album',
    custom: 'custom',
    'podcast-show': 'podcast-show',
  };
  const currentView = viewMap[pathParts[0] || ''] || 'home';
  const selectedPlaylistId = pathParts[1] || null;

  return (
    <>
      {isSplashMounted && (
        <div className={`splash-screen ${!showSplash ? 'fade-out' : ''}`}>
          <div className="splash-logo-container">
            <div className="splash-logo-circle">
              <Music className="splash-music-icon" size={38} />
              <div className="splash-logo-disc"></div>
            </div>
            <h1 className="splash-title">Tunely</h1>
            <p className="splash-tagline">Premium High-Fidelity Audio</p>
            <div className="splash-loader-bar"><div className="splash-loader-progress"></div></div>
          </div>
          <div className="splash-footer"><span>Developed by Aditya Patil</span></div>
        </div>
      )}

      {!isLoggedIn && !isLoading ? (
        <AuthModal onClose={() => {}} required={true} />
      ) : (
        <>
          <Sidebar
            customPlaylists={customPlaylists}
            setCustomPlaylists={setCustomPlaylists}
            createNewPlaylist={createNewPlaylist}
            onShowAuthModal={() => setShowAuthModal(true)}
            onShowThemeModal={() => setShowThemeModal(true)}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
          />

          {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>}

          <MainContent
            currentView={currentView}
            selectedPlaylistId={selectedPlaylistId}
            customPlaylists={customPlaylists}
            setCustomPlaylists={setCustomPlaylists}
            setIsSidebarOpen={setIsSidebarOpen}
            setIsAccountOpen={setIsAccountOpen}
            createNewPlaylist={createNewPlaylist}
          />

          <QueuePanel />
          <LyricsPanel />

          {/* Account drawer */}
          {isAccountOpen && <div className="drawer-backdrop" onClick={() => setIsAccountOpen(false)}></div>}
          <div className={`account-menu-drawer ${isAccountOpen ? 'open' : ''}`}>
            <div className="drawer-header">
              <div className="profile-badge-large" style={{
                background: user ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'rgba(255,255,255,0.1)'
              }}>{(user?.name || user?.email || 'U').trim().charAt(0).toUpperCase()}</div>
              <div className="profile-details-large">
                <h3>{user ? user.name : 'Guest'}</h3>
                <span className="view-profile-link">{user ? user.email : 'Not signed in'}</span>
              </div>
              <button className="close-drawer-btn" onClick={() => setIsAccountOpen(false)}><X size={24} /></button>
            </div>
            <div className="drawer-divider"></div>
            <div className="drawer-content">
              {user ? (
                <>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert(`Logged in as ${user.email}\nMember since ${new Date(user.createdAt || Date.now()).toLocaleDateString()}`); }}>
                    <User size={18} /><span>View profile</span>
                  </div>
                  {user.email === 'aditya@admin.com' && (
                    <div className="drawer-item drawer-item-highlight" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }} onClick={() => { setIsAccountOpen(false); navigate('/admin'); }}>
                      <Shield size={18} color="#ef4444" /><span>Admin Panel</span>
                    </div>
                  )}
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); setShowThemeModal(true); }}>
                    <Palette size={18} /><span>Switch Theme</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert('You are on the latest version of Tunely!'); }}>
                    <Info size={18} /><span>What's new</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert('Settings configuration coming soon!'); }}>
                    <Settings size={18} /><span>Settings and privacy</span>
                  </div>
                  <div className="drawer-divider" style={{ margin: '8px 0' }}></div>
                  <div className="drawer-item drawer-item-danger" onClick={() => { setIsAccountOpen(false); logout(); }}>
                    <Music size={18} /><span>Sign out</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="drawer-item drawer-item-highlight" onClick={() => { setIsAccountOpen(false); setShowAuthModal(true); }}>
                    <User size={18} /><span>Sign in / Create account</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); setShowThemeModal(true); }}>
                    <Palette size={18} /><span>Switch Theme</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert('You are on the latest version of Tunely!'); }}>
                    <Info size={18} /><span>What's new</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert('Settings configuration coming soon!'); }}>
                    <Settings size={18} /><span>Settings and privacy</span>
                  </div>
                </>
              )}
            </div>
            <div className="drawer-footer"><span className="app-version">Tunely Mobile v1.0</span></div>
          </div>

          {/* Mobile Tab Bar */}
          <div className="mobile-tab-bar">
            <button className={`tab-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => navigate('/')}> <Home size={22} /><span>Home</span></button>
            <button className={`tab-item ${location.pathname === '/search' ? 'active' : ''}`} onClick={() => navigate('/search')}> <Search size={22} /><span>Search</span></button>
            <button className={`tab-item ${['/library', '/playlist', '/album', '/custom', '/podcast-show'].some(p => location.pathname.startsWith(p)) ? 'active' : ''}`} onClick={() => navigate('/library')}> <ListMusic size={22} /><span>Library</span></button>
          </div>

          {showAuthModal && isLoggedIn && <AuthModal onClose={() => setShowAuthModal(false)} />}
          {showThemeModal && (
            <ThemeModal onClose={() => setShowThemeModal(false)} activeTheme={activeTheme} onChangeTheme={changeTheme} />
          )}

          <PlayerBar
            customPlaylists={customPlaylists}
            setCustomPlaylists={setCustomPlaylists}
            createNewPlaylist={createNewPlaylist}
          />
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AudioProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<TunelyApp />} />
            <Route path="/search" element={<TunelyApp />} />
            <Route path="/library" element={<TunelyApp />} />
            <Route path="/playlist/:id" element={<TunelyApp />} />
            <Route path="/album/:id" element={<TunelyApp />} />
            <Route path="/custom/:id" element={<TunelyApp />} />
            <Route path="/podcast-show/:id" element={<TunelyApp />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </BrowserRouter>
      </AudioProvider>
    </AuthProvider>
  );
}
