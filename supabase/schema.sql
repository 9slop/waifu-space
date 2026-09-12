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
  worn_avatar_frame TEXT DEFAULT 'none' NOT NULL,
  appearance_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  settings_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  claimed_milestones INT[] DEFAULT '{}' NOT NULL,
  defense_high_wave INT DEFAULT 0 NOT NULL,
  defense_victories INT DEFAULT 0 NOT NULL,
  goblins_defeated INT DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  calendar_overrides JSONB DEFAULT '[]'::jsonb NOT NULL,
  calendar_synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_progress_defense_wave ON public.user_progress(defense_high_wave DESC);
CREATE INDEX IF NOT EXISTS idx_progress_bond_level ON public.user_progress(bond_level DESC);

-- 3. User Inventory Table (all cosmetics unlocked by the player)
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('outfit', 'accessory', 'hairstyle', 'avatar_frame')),
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
  rewarded BOOLEAN DEFAULT FALSE NOT NULL,
  color TEXT DEFAULT '#ff6584' NOT NULL,
  description TEXT DEFAULT '' NOT NULL,
  location TEXT DEFAULT '' NOT NULL,
  recurrence TEXT DEFAULT 'none' NOT NULL CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'weekdays')),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_items_user_start ON public.calendar_items(user_id, start_at);

-- ==========================================================
-- Calendar Sync (atomic replace, prevents partial-wipe data loss)
-- ==========================================================
-- Replaces the user's calendar_items rows with the client snapshot in a
-- single transaction: incoming rows are upserted, rows absent from the
-- snapshot are deleted, and the whole thing rolls back on any error — so a
-- malformed or cut-off push can never wipe calendar data.
CREATE OR REPLACE FUNCTION public.sync_calendar_items(
  p_user_id uuid,
  p_items jsonb,
  p_updated_at timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incoming_ids text[];
  v_count int;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  SELECT COALESCE(array_agg(item_id), '{}'::text[])
    INTO v_incoming_ids
    FROM jsonb_to_recordset(p_items) AS x(item_id text)
   WHERE x.item_id IS NOT NULL AND x.item_id <> '';

  -- Delete rows no longer present on the client. This runs inside the same
  -- transaction as the upserts below, so a later failure rolls it back.
  DELETE FROM public.calendar_items ci
   WHERE ci.user_id = p_user_id
     AND NOT (ci.item_id = ANY(v_incoming_ids));

  INSERT INTO public.calendar_items (
    user_id, item_id, title, start_at, end_at, all_day, type,
    completed, rewarded, color, description, location, recurrence, updated_at
  )
  SELECT
    p_user_id,
    x.item_id,
    x.title,
    x.start_at::timestamptz,
    x.end_at::timestamptz,
    COALESCE(x.all_day, false),
    x.type,
    COALESCE(x.completed, false),
    COALESCE(x.rewarded, false),
    COALESCE(x.color, '#ff6584'),
    COALESCE(x.description, ''),
    COALESCE(x.location, ''),
    x.recurrence,
    p_updated_at
  FROM jsonb_to_recordset(p_items) AS x(
    item_id text,
    title text,
    start_at text,
    end_at text,
    all_day boolean,
    type text,
    completed boolean,
    rewarded boolean,
    color text,
    description text,
    location text,
    recurrence text
  )
  WHERE x.item_id IS NOT NULL AND x.item_id <> ''
    AND x.title IS NOT NULL AND x.title <> ''
    AND x.start_at IS NOT NULL AND x.end_at IS NOT NULL
    AND x.type IN ('event', 'task', 'birthday')
    AND x.recurrence IN ('none', 'daily', 'weekly', 'monthly', 'weekdays')
  ON CONFLICT (user_id, item_id) DO UPDATE SET
    title       = EXCLUDED.title,
    start_at    = EXCLUDED.start_at,
    end_at      = EXCLUDED.end_at,
    all_day     = EXCLUDED.all_day,
    type        = EXCLUDED.type,
    completed   = EXCLUDED.completed,
    rewarded    = EXCLUDED.rewarded,
    color       = EXCLUDED.color,
    description = EXCLUDED.description,
    location    = EXCLUDED.location,
    recurrence  = EXCLUDED.recurrence,
    updated_at  = EXCLUDED.updated_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_calendar_items(uuid, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_calendar_items(uuid, jsonb, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.sync_calendar_items(uuid, jsonb, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_calendar_items(uuid, jsonb, timestamptz) TO service_role;

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
  up.worn_avatar_frame,
  up.updated_at
FROM public.profiles p
JOIN public.user_progress up ON p.id = up.user_id
ORDER BY up.defense_high_wave DESC, up.bond_level DESC, up.coins DESC;

-- ==========================================================
-- In-place migration for pre-existing databases (idempotent)
-- ==========================================================
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS worn_avatar_frame TEXT DEFAULT 'none' NOT NULL;
DO $$
BEGIN
  ALTER TABLE public.user_inventory DROP CONSTRAINT IF EXISTS user_inventory_category_check;
EXCEPTION WHEN others THEN
  NULL;
END $$;
ALTER TABLE public.user_inventory ADD CONSTRAINT user_inventory_category_check
  CHECK (category IN ('outfit', 'accessory', 'hairstyle', 'avatar_frame'));
