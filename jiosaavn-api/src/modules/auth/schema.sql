-- Tunely Database Schema
-- Uses UUID-based primary keys for distributed system safety

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                        -- e.g. usr_8f3a4b2c...
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,               -- PBKDF2 + SHA-256, 100000 iterations
  password_salt TEXT NOT NULL,               -- random 32-byte hex salt
  reset_token TEXT,                          -- for future forgot password flow
  reset_token_expires DATETIME,              -- expiry for reset token
  bio TEXT,                                  -- profile bio
  avatar_bg TEXT,                             -- profile avatar background gradient
  is_banned INTEGER DEFAULT 0,               -- admin ban status (0 = active, 1 = banned)
  last_seen_at DATETIME,                     -- last active timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sync_state (
  user_id TEXT PRIMARY KEY,
  liked_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  playlists_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS liked_songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  song_data TEXT NOT NULL,                   -- full metadata snapshot (JSON)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, song_id)                  -- prevent duplicate likes
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,                       -- e.g. pl_8f3a4b2c...
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  songs TEXT NOT NULL DEFAULT '[]',          -- full metadata snapshots array (JSON)
  spotify_playlist_id TEXT,                 -- linked Spotify playlist ID (e.g. 37i9dQZF1DXcBWIGoYBM5M)
  spotify_snapshot_id TEXT,                 -- Spotify playlist snapshot_id for change tracking
  last_spotify_sync_at DATETIME,            -- last successful sync timestamp
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Future-ready: listening history (enables Wrapped, recommendations, continue listening)
CREATE TABLE IF NOT EXISTS recently_played (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  song_data TEXT NOT NULL,                   -- metadata snapshot at time of play
  played_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_liked_user ON liked_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_user ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_spotify_id ON playlists(spotify_playlist_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_user ON recently_played(user_id, played_at);
CREATE INDEX IF NOT EXISTS idx_user_sync ON user_sync_state(user_id);
