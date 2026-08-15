-- Tunely D1 Migration: 0002_add_auth_version.sql
-- Adds auth_version column to users table for global multi-isolate session invalidation

ALTER TABLE users ADD COLUMN auth_version INTEGER DEFAULT 1;
