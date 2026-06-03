import { Home, Search, Library, Plus, Music, Trash2 } from 'lucide-react';

const PRE_CONFIGURED_PLAYLISTS = [
  { id: '1079336813', name: 'Chill Lo-Fi Mix', type: 'playlist' },
  { id: '83313988', name: 'Top Hindi Hits', type: 'playlist' },
  { id: '1108582', name: 'Global Top 50', type: 'playlist' },
  { id: '69996470', name: 'AiSh, Vol. 4', type: 'album' }
];

export default function Sidebar({ currentView, setCurrentView, selectedPlaylistId, setSelectedPlaylistId, customPlaylists, setCustomPlaylists, isSidebarOpen, setIsSidebarOpen }) {
  
  // Handles creating a new custom playlist
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

  // Handles deleting a custom playlist
  const deletePlaylist = (e, playlistId) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this playlist?")) return;
    
    const updated = customPlaylists.filter(p => p.id !== playlistId);
    setCustomPlaylists(updated);
    localStorage.setItem('spotify_custom_playlists', JSON.stringify(updated));
    
    // If the deleted playlist was selected, reset view to home
    if (selectedPlaylistId === playlistId) {
      setCurrentView('home');
      setSelectedPlaylistId(null);
      if (setIsSidebarOpen) setIsSidebarOpen(false);
    }
  };

  const handlePlaylistClick = (playlist) => {
    setSelectedPlaylistId(playlist.id);
    setCurrentView(playlist.type === 'album' ? 'album' : (playlist.type === 'custom' ? 'custom' : 'playlist'));
    if (setIsSidebarOpen) setIsSidebarOpen(false);
  };

  return (
    <div className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header" onClick={() => { setCurrentView('home'); setSelectedPlaylistId(null); if (setIsSidebarOpen) setIsSidebarOpen(false); }}>
        <div className="logo-icon"></div>
        <h2>Tunely<span className="dot">.</span></h2>
      </div>

      {/* Main Navigation */}
      <div className="nav-menu">
        <button 
          className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => { setCurrentView('home'); setSelectedPlaylistId(null); if (setIsSidebarOpen) setIsSidebarOpen(false); }}
        >
          <Home size={20} />
          <span>Home</span>
        </button>
        <button 
          className={`nav-item ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => { setCurrentView('search'); setSelectedPlaylistId(null); if (setIsSidebarOpen) setIsSidebarOpen(false); }}
        >
          <Search size={20} />
          <span>Search</span>
        </button>
      </div>

      {/* Library Title */}
      <div className="library-section">
        <div className="library-header">
          <div className="library-title">
            <Library size={20} />
            <span>Your Library</span>
          </div>
          <button className="add-playlist-btn" title="Create Playlist" onClick={createNewPlaylist}>
            <Plus size={18} />
          </button>
        </div>

        {/* Playlists Container */}
        <div className="playlists-container">
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

      {/* Developer Attribution */}
      <div className="sidebar-footer">
        Developed by <span className="dev-name">Aditya Patil</span>
      </div>

      {/* Embedded CSS for Sidebar styling */}
      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          height: 100%;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-color);
          background: rgba(10, 10, 15, 0.7);
          padding: 24px 16px;
          z-index: 10;
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
          font-size: 22px;
          font-weight: 800;
          color: var(--text-main);
          letter-spacing: -0.04em;
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
          border-radius: 10px;
          color: var(--text-muted);
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
        }

        .nav-item:hover {
          color: var(--text-main);
          background: var(--bg-hover);
        }

        .nav-item.active {
          color: var(--primary);
          background: rgba(0, 229, 255, 0.1);
        }

        .library-section {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
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

        .sidebar-footer .dev-name {
          color: var(--primary);
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            height: 100vh;
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
    </div>
  );
}
