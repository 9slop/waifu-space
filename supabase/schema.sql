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

-- 5. Audit & Rate-Limit / Action Log (tracks server rolls & anti-cheat records)
CREATE TABLE IF NOT EXISTS public.action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- e.g. 'lootbox_roll', 'defense_verify', 'milestone_claim'
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
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view usernames and avatars (for showcase & leaderboard)
CREATE POLICY Profiles are publicly readable
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY Users can update own profile
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User Progress: Public can read for leaderboard stats; user updates via server API or authenticated role
CREATE POLICY Public can read leaderboard progress
  ON public.user_progress FOR SELECT
  USING (true);

CREATE POLICY Users can update own progress
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- User Inventory: Public can view items; inserts only permitted by service role / server APIs
CREATE POLICY Users can view inventory
  ON public.user_inventory FOR SELECT
  USING (true);

-- User Showcase: Publicly visible display case
CREATE POLICY Public can view showcase
  ON public.user_showcase FOR SELECT
  USING (true);

CREATE POLICY Users manage own showcase
  ON public.user_showcase FOR ALL
  USING (auth.uid() = user_id);

-- ==========================================================
-- Leaderboard View
-- ==========================================================
CREATE OR REPLACE VIEW public.leaderboard_view AS
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
