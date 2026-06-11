import { useState, useEffect, useRef } from 'react';
import { Home, Search, ListMusic, User, X, Info, Settings, Music, Palette } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import PlayerBar from './components/PlayerBar';
import LyricsPanel from './components/LyricsPanel';
import QueuePanel from './components/QueuePanel';
import { AudioProvider } from './context/AudioContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import ThemeModal from './components/ThemeModal';

const API_BASE = (import.meta.env.VITE_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev').trim();

function TunelyApp() {
  const { user, logout, isLoggedIn, isLoading, authFetch } = useAuth() || {};
  const [currentView, setCurrentView] = useState('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Startup splash screen states
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashMounted, setIsSplashMounted] = useState(true);

  // Dynamic Theme states
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [activeTheme, _setActiveTheme] = useState(() => {
    return localStorage.getItem('tunely_theme') || 'default';
  });

  const changeTheme = (themeId) => {
    document.body.classList.remove('theme-cyberpunk', 'theme-nordic', 'theme-rose', 'theme-solar');
    if (themeId !== 'default') {
      document.body.classList.add(`theme-${themeId}`);
    }
    localStorage.setItem('tunely_theme', themeId);
    _setActiveTheme(themeId);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('tunely_theme');
    if (savedTheme && savedTheme !== 'default') {
      document.body.classList.add(`theme-${savedTheme}`);
    }
  }, []);

  // Custom user playlists state
  const [customPlaylists, _setCustomPlaylists] = useState(() => {
    try {
      const saved = localStorage.getItem('spotify_custom_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse custom playlists from localStorage:", e);
    }
    return [];
  });

  const lastSyncedPlaylistsRef = useRef((() => {
    try {
      const saved = localStorage.getItem('spotify_custom_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return saved;
      }
    } catch {
      // ignore
    }
    return '[]';
  })());

  // Wrapper around state to update localStorage and set updated_at timestamp
  const setCustomPlaylists = (newPlaylistsOrFn) => {
    _setCustomPlaylists(prev => {
      const updated = typeof newPlaylistsOrFn === 'function' ? newPlaylistsOrFn(prev) : newPlaylistsOrFn;
      localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));
      localStorage.setItem('tunely_custom_playlists_updated_at', new Date().toISOString());
      return updated;
    });
  };

  // Control startup splash screen fade-out and unmount
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setShowSplash(false);
      const unmountTimer = setTimeout(() => {
        setIsSplashMounted(false);
      }, 600); // 600ms matching CSS transition duration
      return () => clearTimeout(unmountTimer);
    }, 1500); // Keep active for 1.5s
    return () => clearTimeout(fadeTimer);
  }, []);

  // On logout: clear playlists from view and reset navigation to home
  useEffect(() => {
    if (isLoading) return; // Wait for session restore before acting
    if (!isLoggedIn) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setCustomPlaylists([]);
      setSelectedPlaylistId(null);
      window.location.hash = 'home';
    }
  }, [isLoggedIn, isLoading]);

  // Keep ref of customPlaylists to avoid re-triggering polling interval on state change
  const customPlaylistsRef = useRef(customPlaylists);
  useEffect(() => {
    customPlaylistsRef.current = customPlaylists;
  }, [customPlaylists]);

  // Smart sync for custom playlists on login/load
  useEffect(() => {
    if (isLoading) return; // Wait for session restore
    if (user?.isGuest) return; // Skip guest sync
    if (!isLoggedIn || !authFetch) return;

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

        if (data.source === 'server') {
          // Server has newer/updated playlists, update local state
          _setCustomPlaylists(data.playlists);
          lastSyncedPlaylistsRef.current = JSON.stringify(data.playlists);
          localStorage.setItem('spotify_custom_playlists', JSON.stringify(data.playlists));
          localStorage.setItem('tunely_custom_playlists_updated_at', data.serverUpdatedAt || new Date().toISOString());
        } else if (data.source === 'local') {
          // Local was newer, server has updated itself, update ref
          lastSyncedPlaylistsRef.current = JSON.stringify(localPlaylists);
          if (data.serverUpdatedAt) {
            localStorage.setItem('tunely_custom_playlists_updated_at', data.serverUpdatedAt);
          }
        }
      } catch (e) {
        console.warn('Custom playlists initial sync failed:', e);
      }
    };

    syncPlaylists();
  }, [isLoggedIn, isLoading, authFetch, user]);

  // Live Sync / Periodic Polling for Playlists
  useEffect(() => {
    if (isLoading) return;
    if (user?.isGuest) return; // Skip guest sync
    if (!isLoggedIn || !authFetch) return;

    let intervalId;

    const performLiveSync = async () => {
      // Only sync if the tab/window is visible/focused
      if (document.visibilityState !== 'visible') return;

      try {
        const localPlaylists = JSON.parse(localStorage.getItem('spotify_custom_playlists') || '[]');
        const localUpdatedAt = localStorage.getItem('tunely_custom_playlists_updated_at') || new Date(0).toISOString();

        // Check if there are unsynced local changes in flight before overwriting
        const currentStr = JSON.stringify(customPlaylistsRef.current);
        if (lastSyncedPlaylistsRef.current !== null && currentStr !== lastSyncedPlaylistsRef.current) {
          // Local changes are currently syncing to server, skip this tick
          return;
        }

        const res = await authFetch(`${API_BASE}/api/user/playlists/sync`, {
          method: 'POST',
          body: JSON.stringify({ playlists: localPlaylists, localUpdatedAt })
        });
        if (!res.ok) return;
        const { data } = await res.json();

        if (data && data.source === 'server') {
          // Server has newer/updated playlists, update local state
          _setCustomPlaylists(data.playlists);
          lastSyncedPlaylistsRef.current = JSON.stringify(data.playlists);
          localStorage.setItem('spotify_custom_playlists', JSON.stringify(data.playlists));
          localStorage.setItem('tunely_custom_playlists_updated_at', data.serverUpdatedAt || new Date().toISOString());
        } else if (data && data.source === 'local') {
          // Local was newer, server has updated itself, update ref
          lastSyncedPlaylistsRef.current = JSON.stringify(localPlaylists);
          if (data.serverUpdatedAt) {
            localStorage.setItem('tunely_custom_playlists_updated_at', data.serverUpdatedAt);
          }
        }
      } catch (e) {
        console.warn('Custom playlists live sync failed:', e);
      }
    };

    // Poll every 30 seconds
    intervalId = setInterval(performLiveSync, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performLiveSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, isLoading, authFetch, user]);

  // Incremental Sync for local changes (creates, updates, deletes)
  useEffect(() => {
    if (isLoading) return;
    if (user?.isGuest) return; // Skip guest sync
    if (!isLoggedIn || !authFetch) return;

    // Wait until ref is initialized
    if (lastSyncedPlaylistsRef.current === null) return;

    const currentStr = JSON.stringify(customPlaylists);
    if (currentStr === lastSyncedPlaylistsRef.current) return;

    let prev;
    try {
      prev = JSON.parse(lastSyncedPlaylistsRef.current);
    } catch (e) {
      console.error("Failed to parse lastSyncedPlaylistsRef:", e);
      lastSyncedPlaylistsRef.current = currentStr;
      return;
    }
    if (!Array.isArray(prev)) return;

    lastSyncedPlaylistsRef.current = currentStr; // Prevent duplicate triggers

    const syncChanges = async () => {
      try {
        // A. Detect creations
        const created = customPlaylists.filter(pl => !prev.some(p => p.id === pl.id));
        for (const pl of created) {
          await authFetch(`${API_BASE}/api/user/playlists`, {
            method: 'POST',
            body: JSON.stringify({ id: pl.id, name: pl.name, songs: pl.songs })
          });
        }

        // B. Detect deletions
        const deleted = prev.filter(pl => !customPlaylists.some(p => p.id === pl.id));
        for (const pl of deleted) {
          await authFetch(`${API_BASE}/api/user/playlists/${pl.id}`, {
            method: 'DELETE'
          });
        }

        // C. Detect updates (name or songs content changed)
        const updated = customPlaylists.filter(pl => {
          const p = prev.find(prevPl => prevPl.id === pl.id);
          if (!p) return false;
          return p.name !== pl.name || JSON.stringify(p.songs) !== JSON.stringify(pl.songs);
        });
        for (const pl of updated) {
          await authFetch(`${API_BASE}/api/user/playlists/${pl.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name: pl.name, songs: pl.songs })
          });
        }
      } catch (e) {
        console.warn('Failed to sync incremental playlist changes to server:', e);
      }
    };

    syncChanges();
  }, [customPlaylists, isLoggedIn, isLoading, authFetch, user]);

  // Hash-based routing event listener for Safari Back/Forward button support (stops 404s)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#home';
      
      if (hash === '#home') {
        setCurrentView('home');
        setSelectedPlaylistId(null);
      } else if (hash === '#search') {
        setCurrentView('search');
        setSelectedPlaylistId(null);
      } else if (hash === '#library') {
        setCurrentView('library');
        setSelectedPlaylistId(null);
      } else if (hash.startsWith('#playlist-')) {
        const id = hash.replace('#playlist-', '');
        setSelectedPlaylistId(id);
        setCurrentView('playlist');
      } else if (hash.startsWith('#album-')) {
        const id = hash.replace('#album-', '');
        setSelectedPlaylistId(id);
        setCurrentView('album');
      } else if (hash.startsWith('#custom-')) {
        const id = hash.replace('#custom-', '');
        setSelectedPlaylistId(id);
        setCurrentView('custom');
      } else if (hash.startsWith('#podcast-show-')) {
        const id = hash.replace('#podcast-show-', '');
        setSelectedPlaylistId(id);
        setCurrentView('podcast-show');
      } else {
        setCurrentView('home');
        setSelectedPlaylistId(null);
      }
    };

    // Initialize routing based on current hash
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handles creating a new custom playlist (shared between sidebar and mobile library)
  const createNewPlaylist = () => {
    const name = prompt("Enter playlist name:", `My Playlist #${customPlaylists.length + 1}`);
    if (!name || name.trim() === "") return;
    
    const newPlaylist = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      type: 'custom',
      songs: []
    };
    
    const updated = [...customPlaylists, newPlaylist];
    setCustomPlaylists(updated);
    localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));
  };

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
            <div className="splash-loader-bar">
              <div className="splash-loader-progress"></div>
            </div>
          </div>
          <div className="splash-footer">
            <span>Developed by Aditya Patil</span>
          </div>
        </div>
      )}

      {!isLoggedIn && !isLoading ? (
        <AuthModal onClose={() => {}} required={true} />
      ) : (
        <>
          <div className="app-container">
            {/* Left pane: Navigation, Libraries and Custom Playlists */}
            <Sidebar 
              currentView={currentView}
              setCurrentView={setCurrentView}
              selectedPlaylistId={selectedPlaylistId}
              setSelectedPlaylistId={setSelectedPlaylistId}
              customPlaylists={customPlaylists}
              setCustomPlaylists={setCustomPlaylists}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              createNewPlaylist={createNewPlaylist}
              onShowAuthModal={() => setShowAuthModal(true)}
              onShowThemeModal={() => setShowThemeModal(true)}
            />

            {isSidebarOpen && (
              <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>
            )}

            {/* Center pane: Dashboard, Search or Details list */}
            <MainContent 
              currentView={currentView}
              setCurrentView={setCurrentView}
              selectedPlaylistId={selectedPlaylistId}
              setSelectedPlaylistId={setSelectedPlaylistId}
              customPlaylists={customPlaylists}
              setCustomPlaylists={setCustomPlaylists}
              setIsSidebarOpen={setIsSidebarOpen}
              setIsAccountOpen={setIsAccountOpen}
              createNewPlaylist={createNewPlaylist}
            />

            {/* Right pane: Drawer sections for Lyrics and Playback Queue */}
            <QueuePanel />
            <LyricsPanel />
          </div>

          {isAccountOpen && (
            <div className="drawer-backdrop" onClick={() => setIsAccountOpen(false)}></div>
          )}

          {/* Account Menu Drawer on Mobile */}
          <div className={`account-menu-drawer ${isAccountOpen ? 'open' : ''}`}>
            <div className="drawer-header">
              <div className="profile-badge-large" style={{
                background: user ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'rgba(255,255,255,0.1)'
              }}>
                {(user?.name || user?.email || 'U').trim().charAt(0).toUpperCase()}
              </div>
              <div className="profile-details-large">
                <h3>{user ? user.name : 'Guest'}</h3>
                <span className="view-profile-link">{user ? user.email : 'Not signed in'}</span>
              </div>
              <button className="close-drawer-btn" onClick={() => setIsAccountOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="drawer-divider"></div>
            <div className="drawer-content">
              {user ? (
                /* Logged in state */
                <>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert(`Logged in as ${user.email}\nMember since ${new Date(user.createdAt || Date.now()).toLocaleDateString()}`); }}>
                    <User size={18} />
                    <span>View profile</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); setShowThemeModal(true); }}>
                    <Palette size={18} />
                    <span>Switch Theme</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert("You are on the latest version of Tunely!"); }}>
                    <Info size={18} />
                    <span>What's new</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert("Settings configuration coming soon!"); }}>
                    <Settings size={18} />
                    <span>Settings and privacy</span>
                  </div>
                  <div className="drawer-divider" style={{ margin: '8px 0' }}></div>
                  <div className="drawer-item drawer-item-danger" onClick={() => { setIsAccountOpen(false); logout(); }}>
                    <Music size={18} />
                    <span>Sign out</span>
                  </div>
                </>
              ) : (
                /* Guest state */
                <>
                  <div className="drawer-item drawer-item-highlight" onClick={() => { setIsAccountOpen(false); setShowAuthModal(true); }}>
                    <User size={18} />
                    <span>Sign in / Create account</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); setShowThemeModal(true); }}>
                    <Palette size={18} />
                    <span>Switch Theme</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert("You are on the latest version of Tunely!"); }}>
                    <Info size={18} />
                    <span>What's new</span>
                  </div>
                  <div className="drawer-item" onClick={() => { setIsAccountOpen(false); alert("Settings configuration coming soon!"); }}>
                    <Settings size={18} />
                    <span>Settings and privacy</span>
                  </div>
                </>
              )}
            </div>
            <div className="drawer-footer">
              <span className="app-version">Tunely Mobile v1.0</span>
            </div>
          </div>

          {/* Mobile Bottom Tab Bar */}
          <div className="mobile-tab-bar">
            <button 
              className={`tab-item ${currentView === 'home' ? 'active' : ''}`}
              onClick={() => { window.location.hash = 'home'; }}
            >
              <Home size={22} />
              <span>Home</span>
            </button>
            <button 
              className={`tab-item ${currentView === 'search' ? 'active' : ''}`}
              onClick={() => { window.location.hash = 'search'; }}
            >
              <Search size={22} />
              <span>Search</span>
            </button>
            <button 
              className={`tab-item ${currentView === 'library' || currentView === 'playlist' || currentView === 'album' || currentView === 'custom' ? 'active' : ''}`}
              onClick={() => { window.location.hash = 'library'; }}
            >
              <ListMusic size={22} />
              <span>Library</span>
            </button>
          </div>

          {/* Auth Modal — optional (user-triggered) */}
          {showAuthModal && isLoggedIn && <AuthModal onClose={() => setShowAuthModal(false)} />}

          {/* Theme Switcher Modal */}
          {showThemeModal && (
            <ThemeModal 
              onClose={() => setShowThemeModal(false)} 
              activeTheme={activeTheme} 
              onChangeTheme={changeTheme} 
            />
          )}

          {/* Bottom sticky pane: Global player and track sliders */}
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
        <TunelyApp />
      </AudioProvider>
    </AuthProvider>
  );
}
