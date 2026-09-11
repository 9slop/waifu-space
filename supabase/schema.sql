-- ==========================================================
-- WaifuSpace: Database Schema & Row-Level Security (RLS)
-- Target: Supabase (PostgreSQL 15+)
-- ==========================================================

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Profiles Table (linked to Supabase Auth or standalone user accounts)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT DEFAULT 'Just a companion traveller in WaifuSpace.',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 2. User Progress Table (stores stats, coins, XP, waifu setup)
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  coins BIGINT DEFAULT 200 NOT NULL CHECK (coins >= 0),
  bond_exp BIGINT DEFAULT 0 NOT NULL,
  bond_level INT DEFAULT 1 NOT NULL,
  waifu_name TEXT DEFAULT 'Akari' NOT NULL,
  waifu_personality TEXT DEFAULT 'tsundere' NOT NULL,
  worn_outfit TEXT DEFAULT 'seifuku' NOT NULL,
  worn_accessory TEXT DEFAULT 'none' NOT NULL,
  worn_hairstyle TEXT DEFAULT 'twintails' NOT NULL,
  appearance_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  settings_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  claimed_milestones INT[] DEFAULT '{}' NOT NULL,
  defense_high_wave INT DEFAULT 0 NOT NULL,
  defense_victories INT DEFAULT 0 NOT NULL,
  goblins_defeated INT DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_progress_defense_wave ON public.user_progress(defense_high_wave DESC);
CREATE INDEX IF NOT EXISTS idx_progress_bond_level ON public.user_progress(bond_level DESC);

-- 3. User Inventory Table (all cosmetics unlocked by the player)
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('outfit', 'accessory', 'hairstyle')),
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'mystical')),
  unlocked_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT uq_user_item UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON public.user_inventory(user_id);

-- 4. User Showcase Table (up to 6 featured items for public profile display)
CREATE TABLE IF NOT EXISTS public.user_showcase (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot_index INT NOT NULL CHECK (slot_index >= 0 AND slot_index <= 5),
  item_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (user_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_showcase_user_id ON public.user_showcase(user_id);

-- 5. Calendar Items Table (the user's calendar events & tasks)
-- A full copy of the client's calendar list, synchronized on every progress
-- push. Calendar data is private to its owner, unlike leaderboard stats.
CREATE TABLE IF NOT EXISTS public.calendar_items (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('event', 'task', 'birthday')),
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  color TEXT DEFAULT '#ff6584' NOT NULL,
  description TEXT DEFAULT '' NOT NULL,
  location TEXT DEFAULT '' NOT NULL,
  recurrence TEXT DEFAULT 'none' NOT NULL CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'weekdays')),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_items_user_start ON public.calendar_items(user_id, start_at);

-- 6. Audit & Action Logs (tracks server rolls & anti-cheat records)
CREATE TABLE IF NOT EXISTS public.action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_logs_user_time ON public.action_logs(user_id, created_at DESC);

-- ==========================================================
-- Row-Level Security (RLS) Policies
-- ==========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_showcase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view usernames and avatars
DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- User Progress: Public can read for leaderboard stats
DROP POLICY IF EXISTS "Public can read leaderboard progress" ON public.user_progress;
CREATE POLICY "Public can read leaderboard progress"
  ON public.user_progress FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;
CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;
CREATE POLICY "Users can update own progress"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User Inventory: Public can view items
DROP POLICY IF EXISTS "Users can view inventory" ON public.user_inventory;
CREATE POLICY "Users can view inventory"
  ON public.user_inventory FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages inventory" ON public.user_inventory;
CREATE POLICY "Service role manages inventory"
  ON public.user_inventory FOR ALL
  USING (true)
  WITH CHECK (true);

-- User Showcase: Publicly visible display case
DROP POLICY IF EXISTS "Public can view showcase" ON public.user_showcase;
CREATE POLICY "Public can view showcase"
  ON public.user_showcase FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users manage own showcase" ON public.user_showcase;
CREATE POLICY "Users manage own showcase"
  ON public.user_showcase FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Calendar Items: private to the owner (no public leaderboard read here)
DROP POLICY IF EXISTS "Users manage own calendar items" ON public.calendar_items;
CREATE POLICY "Users manage own calendar items"
  ON public.calendar_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Action Logs: Audit table
DROP POLICY IF EXISTS "Service role manages action logs" ON public.action_logs;
CREATE POLICY "Service role manages action logs"
  ON public.action_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==========================================================
-- Leaderboard View (security_invoker = true)
-- ==========================================================
CREATE OR REPLACE VIEW public.leaderboard_view WITH (security_invoker = true) AS
SELECT
  p.id as user_id,
  p.username,
  p.avatar_url,
  up.defense_high_wave,
  up.defense_victories,
  up.goblins_defeated,
  up.bond_level,
  up.coins,
  up.worn_outfit,
  up.worn_accessory,
  up.updated_at
FROM public.profiles p
JOIN public.user_progress up ON p.id = up.user_id
ORDER BY up.defense_high_wave DESC, up.bond_level DESC, up.coins DESC;
