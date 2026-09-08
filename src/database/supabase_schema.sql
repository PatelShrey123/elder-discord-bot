-- =========================================================
-- ELDER DISCORD BOT - SUPABASE SCHEMA SETUP
-- Paste this entire script into your Supabase SQL Editor and click RUN
-- =========================================================

-- 1. Elder Points Currency Table
CREATE TABLE IF NOT EXISTS elder_points (
  user_id TEXT PRIMARY KEY,
  username TEXT,
  points BIGINT DEFAULT 0,
  last_daily TIMESTAMPTZ
);

-- 2. Clan Blacklist Table
CREATE TABLE IF NOT EXISTS blacklist (
  target_id TEXT PRIMARY KEY,
  target_tag TEXT,
  reason TEXT,
  proof TEXT,
  added_by TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
  channel_id TEXT PRIMARY KEY,
  ticket_id TEXT,
  user_id TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_by TEXT
);

-- 4. Modmail Table
CREATE TABLE IF NOT EXISTS modmail (
  user_id TEXT PRIMARY KEY,
  thread_id TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) so the Bot API key can read/write without restriction
ALTER TABLE elder_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE modmail DISABLE ROW LEVEL SECURITY;
