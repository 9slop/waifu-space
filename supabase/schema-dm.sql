-- ==========================================================
-- WaifuSpace: DM / Presence / Calling Schema (Discord clone)
-- Idempotent: safe to run against an existing database.
-- ==========================================================

-- 1. Conversations (DM threads, only 'dm' for now)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'dm' CHECK (type IN ('dm')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Conversation Participants (membership + per-user read cursor)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_user ON public.conversation_participants(user_id);

-- 3. Messages (text + GIF/image/video media)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'gif', 'image', 'video')),
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL
);

-- Soft-delete marker for pre-existing databases (idempotent).
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Widen the constraint on pre-existing databases (idempotent).
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'gif', 'image', 'video', 'system'));

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id);
-- Replica identity FULL so change-data capture can deliver full rows.
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 3b. GIF Favorites (per-user saved GIFs shown in the picker)
CREATE TABLE IF NOT EXISTS public.gif_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gif_id TEXT NOT NULL,
  url TEXT NOT NULL,
  preview TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'giphy',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (user_id, gif_id)
);

CREATE INDEX IF NOT EXISTS gif_favorites_user_created_idx
  ON public.gif_favorites (user_id, created_at DESC);

-- 4. User Presence (persisted status + custom status text)
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'idle', 'dnd', 'invisible', 'offline')),
  custom_status TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Call Sessions (P2P voice/video/screen metadata + signaling state)
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL DEFAULT 'voice' CHECK (call_type IN ('voice', 'video', 'screen')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended', 'declined', 'missed', 'canceled', 'busy')),
  started_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation ON public.call_sessions(conversation_id, created_at DESC);

-- 3c. Message Reactions (Discord-style emoji reactions, max 20 distinct per message)
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);

-- ==========================================================
-- Row-Level Security
-- ==========================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gif_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Conversations
DROP POLICY IF EXISTS "Participants can read conversations" ON public.conversations;
CREATE POLICY "Participants can read conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can create conversations" ON public.conversations;
CREATE POLICY "Anyone can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (true);

-- Conversation participants: you can read conversations you belong to and
-- manage your own membership/read cursor only.
DROP POLICY IF EXISTS "Participants can read own membership" ON public.conversation_participants;
CREATE POLICY "Participants can read own membership"
  ON public.conversation_participants FOR SELECT
  USING (user_id = auth.uid() OR conversation_id IN (
    SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own membership" ON public.conversation_participants;
CREATE POLICY "Users can insert own membership"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own membership" ON public.conversation_participants;
CREATE POLICY "Users can update own membership"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Messages: only participants can read, only the sender can insert.
DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Participants can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can update messages" ON public.messages;
CREATE POLICY "Participants can update messages"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

-- Presence: public read (needed to render other users' status), owner manages own.
DROP POLICY IF EXISTS "Presence is publicly readable" ON public.user_presence;
CREATE POLICY "Presence is publicly readable"
  ON public.user_presence FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users manage own presence" ON public.user_presence;
CREATE POLICY "Users manage own presence"
  ON public.user_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own presence" ON public.user_presence;
CREATE POLICY "Users update own presence"
  ON public.user_presence FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Call sessions: participants can read/update, caller creates.
DROP POLICY IF EXISTS "Participants can read call sessions" ON public.call_sessions;
CREATE POLICY "Participants can read call sessions"
  ON public.call_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = call_sessions.conversation_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Caller creates call sessions" ON public.call_sessions;
CREATE POLICY "Caller creates call sessions"
  ON public.call_sessions FOR INSERT
  WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update call sessions" ON public.call_sessions;
CREATE POLICY "Participants can update call sessions"
  ON public.call_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = call_sessions.conversation_id AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = call_sessions.conversation_id AND cp.user_id = auth.uid()
    )
  );

-- GIF favorites: strictly owner-scoped.
DROP POLICY IF EXISTS "gif_favorites_select_own" ON public.gif_favorites;
CREATE POLICY "gif_favorites_select_own"
  ON public.gif_favorites FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "gif_favorites_insert_own" ON public.gif_favorites;
CREATE POLICY "gif_favorites_insert_own"
  ON public.gif_favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "gif_favorites_delete_own" ON public.gif_favorites;
CREATE POLICY "gif_favorites_delete_own"
  ON public.gif_favorites FOR DELETE
  USING (user_id = auth.uid());

-- Message reactions: participants of the parent conversation can read, and
-- only the user themselves can add/remove their own reaction.
DROP POLICY IF EXISTS "Participants can read reactions" ON public.message_reactions;
CREATE POLICY "Participants can read reactions"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users add own reactions" ON public.message_reactions;
CREATE POLICY "Users add own reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users remove own reactions" ON public.message_reactions;
CREATE POLICY "Users remove own reactions"
  ON public.message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- ==========================================================
-- Realtime publication: deliver live message rows to subscribers
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;