-- Tunely D1 Database Migration: 0003_add_recently_played.sql
-- Adds recently_played table for Cloud persistent listening history

CREATE TABLE IF NOT EXISTS recently_played (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  song_data TEXT NOT NULL,
  played_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recently_played_user ON recently_played(user_id, played_at);
