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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX IF NOT EXISTS idx_recently_played_user ON recently_played(user_id, played_at);
