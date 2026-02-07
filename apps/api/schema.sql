-- IndraNet Database Schema
-- Run with: wrangler d1 execute indra-net-db --file=./schema.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  github_id TEXT UNIQUE,
  github_username TEXT UNIQUE,
  google_id TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'hobby' CHECK (tier IN ('hobby', 'pro', 'enterprise')),
  stripe_customer_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_github_username ON users(github_username);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- IndraBases table (remote .indra databases)
CREATE TABLE IF NOT EXISTS indra_bases (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  storage_key TEXT NOT NULL, -- R2 path
  size_bytes INTEGER NOT NULL DEFAULT 0,
  thought_count INTEGER NOT NULL DEFAULT 0,
  commit_count INTEGER NOT NULL DEFAULT 0,
  head_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  UNIQUE(owner_id, name)
);

-- Index for listing user's bases
CREATE INDEX IF NOT EXISTS idx_bases_owner ON indra_bases(owner_id);

-- Index for public discovery
CREATE INDEX IF NOT EXISTS idx_bases_visibility ON indra_bases(visibility);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for display
  key_hash TEXT NOT NULL,
  last_used TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Sync log (tracks push/pull history)
CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  base_id TEXT NOT NULL REFERENCES indra_bases(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('push', 'pull')),
  from_hash TEXT,
  to_hash TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for sync history
CREATE INDEX IF NOT EXISTS idx_sync_log_base ON sync_log(base_id);

-- Thoughts table (denormalized for search/analytics)
-- This is populated when a base is pushed, enabling server-side search
CREATE TABLE IF NOT EXISTS thoughts (
  id TEXT PRIMARY KEY,
  base_id TEXT NOT NULL REFERENCES indra_bases(id) ON DELETE CASCADE,
  thought_id TEXT NOT NULL, -- ID from the .indra file
  content TEXT NOT NULL,
  thought_type TEXT,
  has_embedding INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  committed_at TEXT,
  
  UNIQUE(base_id, thought_id)
);

-- Index for listing thoughts in a base
CREATE INDEX IF NOT EXISTS idx_thoughts_base ON thoughts(base_id);

-- Full-text search on thought content
CREATE VIRTUAL TABLE IF NOT EXISTS thoughts_fts USING fts5(
  content,
  content='thoughts',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS thoughts_ai AFTER INSERT ON thoughts BEGIN
  INSERT INTO thoughts_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS thoughts_ad AFTER DELETE ON thoughts BEGIN
  INSERT INTO thoughts_fts(thoughts_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS thoughts_au AFTER UPDATE ON thoughts BEGIN
  INSERT INTO thoughts_fts(thoughts_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO thoughts_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- Commits table (for tracking history on the server)
CREATE TABLE IF NOT EXISTS commits (
  id TEXT PRIMARY KEY,
  base_id TEXT NOT NULL REFERENCES indra_bases(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  message TEXT NOT NULL,
  author TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  parent_hash TEXT,
  
  UNIQUE(base_id, hash)
);

-- Index for commit history
CREATE INDEX IF NOT EXISTS idx_commits_base ON commits(base_id);
CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(base_id, timestamp DESC);
