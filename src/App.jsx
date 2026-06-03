import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import PlayerBar from './components/PlayerBar';
import LyricsPanel from './components/LyricsPanel';
import QueuePanel from './components/QueuePanel';
import { AudioProvider } from './context/AudioContext';

function TunelyApp() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'search' | 'playlist' | 'album' | 'custom'
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Custom user playlists state
  const [customPlaylists, setCustomPlaylists] = useState([]);

  // Load playlists from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem('spotify_custom_playlists');
    if (saved) {
      try {
        setCustomPlaylists(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse custom playlists from localStorage:", e);
      }
    }
  }, []);

  return (
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
        />

        {/* Right pane: Drawer sections for Lyrics and Playback Queue */}
        <QueuePanel />
        <LyricsPanel />
      </div>

      {/* Bottom sticky pane: Global player and track sliders */}
      <PlayerBar />
    </>
  );
}

export default function App() {
  return (
    <AudioProvider>
      <TunelyApp />
    </AudioProvider>
  );
}
