-- ==========================================================
-- WaifuSpace: Database Schema & Row-Level Security (RLS)
-- Target: Supabase (PostgreSQL 15+)
-- ==========================================================
-- NOTE: The Discord-clone DM/presence/calling tables live in
-- supabase/schema-dm.sql (conversations, conversation_participants,
-- messages, user_presence, call_sessions + their RLS/schema policies).

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
  coins BIGINT DEFAULT 0 NOT NULL CHECK (coins >= 0),
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
GRANT EXECUTE ON FUNCTION public.sync_calendar_items(uuid, jsonb, timestamptz) TO anon, authenticated, service_role;

-- ==========================================================
-- Showcase Sync (atomic replace, prevents item-loss races)
-- ==========================================================
-- Replaces the user's showcase rows (up to slot 5) in a single transaction.
-- The previous client flow (DELETE all + INSERT) was not atomic: if the insert
-- failed, or two pushes interleaved, the showcase silently lost items. This
-- function keeps the replace atomic so a sync can never wipe the showcase.
CREATE OR REPLACE FUNCTION public.sync_showcase_items(
  p_user_id uuid,
  p_items jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  -- SECURITY DEFINER bypasses RLS, so a caller presenting a user JWT must only
  -- ever target their own rows. The server route calls this with no JWT
  -- (auth.uid() is null) and always passes the verified session user id.
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  DELETE FROM public.user_showcase
   WHERE user_id = p_user_id;

  INSERT INTO public.user_showcase (user_id, slot_index, item_id, updated_at)
  SELECT
    p_user_id,
    x.slot_index,
    x.item_id,
    now()
  FROM jsonb_to_recordset(p_items) AS x(slot_index int, item_id text)
  WHERE x.item_id IS NOT NULL AND x.item_id <> ''
    AND x.slot_index BETWEEN 0 AND 5
  ON CONFLICT (user_id, slot_index) DO UPDATE SET
    item_id    = EXCLUDED.item_id,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_showcase_items(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_showcase_items(uuid, jsonb) TO anon, authenticated, service_role;

-- ==========================================================
-- Time Budget & Calendar Sync (end-to-end encrypted blob)
-- ==========================================================
-- The time budget + calendar live together in a single END-TO-END encrypted
-- blob (AES-256-GCM, key derived per account on-device). The server never sees
-- plaintext; it stores the opaque ciphertext keyed by user. Direct table reads
-- require a live user JWT (see the RLS policy in the RLS section), but the
-- /api/timebudget/sync route runs as the anon role in dev/anon-key deployments
-- with no JWT, so it calls these SECURITY DEFINER RPCs -- the same pattern as
-- sync_showcase_items/sync_calendar_items. Each function verifies that a caller
-- presenting a user JWT only ever touches their own row.
CREATE TABLE IF NOT EXISTS public.time_budget_sync (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  blob_version INTEGER NOT NULL DEFAULT 1,
  kdf_salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE OR REPLACE FUNCTION public.save_time_budget_blob(
  p_user_id uuid,
  p_blob_version int,
  p_kdf_salt text,
  p_iv text,
  p_ciphertext text,
  p_updated_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  INSERT INTO public.time_budget_sync (user_id, blob_version, kdf_salt, iv, ciphertext, updated_at)
  VALUES (p_user_id, p_blob_version, p_kdf_salt, p_iv, p_ciphertext, p_updated_at)
  ON CONFLICT (user_id) DO UPDATE SET
    blob_version = EXCLUDED.blob_version,
    kdf_salt     = EXCLUDED.kdf_salt,
    iv           = EXCLUDED.iv,
    ciphertext   = EXCLUDED.ciphertext,
    updated_at   = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_time_budget_blob(p_user_id uuid)
RETURNS TABLE (
  blob_version int,
  kdf_salt text,
  iv text,
  ciphertext text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  RETURN QUERY
    SELECT b.blob_version, b.kdf_salt, b.iv, b.ciphertext, b.updated_at
    FROM public.time_budget_sync b
    WHERE b.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_time_budget_blob(uuid, int, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_time_budget_blob(uuid, int, text, text, text, timestamptz) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_time_budget_blob(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_time_budget_blob(uuid) TO anon, authenticated, service_role;

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
ALTER TABLE public.time_budget_sync ENABLE ROW LEVEL SECURITY;

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

-- Time Budget Sync: encrypted blob, private to the owner
DROP POLICY IF EXISTS "Users manage own time budget sync" ON public.time_budget_sync;
CREATE POLICY "Users manage own time budget sync"
  ON public.time_budget_sync FOR ALL
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
