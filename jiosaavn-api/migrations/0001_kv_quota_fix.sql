-- Tunely D1 Database Migration: 0001_kv_quota_fix.sql
-- Adds profile fields, ban status, last_seen_at timestamp to users table
-- Adds user_sync_state table for D1-backed synchronization timestamps

ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_bg TEXT;
ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_seen_at DATETIME;

CREATE TABLE IF NOT EXISTS user_sync_state (
  user_id TEXT PRIMARY KEY,
  liked_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  playlists_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sync ON user_sync_state(user_id);
