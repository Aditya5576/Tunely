-- Tunely D1 Database Migration: 0004_spotify_playlist_sync.sql
-- Adds Spotify linking & snapshot metadata to playlists table

ALTER TABLE playlists ADD COLUMN spotify_playlist_id TEXT;
ALTER TABLE playlists ADD COLUMN spotify_snapshot_id TEXT;
ALTER TABLE playlists ADD COLUMN last_spotify_sync_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_playlists_spotify_id ON playlists(spotify_playlist_id);
