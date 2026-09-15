-- ==========================================================
-- WaifuSpace: DM / Presence / Call RPCs (SECURITY DEFINER)
-- These run as the caller between service-role server code and
-- the database. Every function verifies that a caller presenting a
-- real user JWT (auth.uid() != null) may only touch their own data;
-- the server routes always pass the verified session user id.
-- ==========================================================

-- Effective presence for a stored user_presence row. A row whose last-seen
-- stamp is older than two minutes is treated as offline (the client
-- heartbeats every ~45s while the page is open), and invisible/offline rows
-- always read as offline for other users.
CREATE OR REPLACE FUNCTION public.dm_effective_status(
  p_status text,
  p_last_seen timestamptz
) RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_status IS NULL OR p_status IN ('invisible', 'offline') THEN 'offline'
    WHEN p_last_seen IS NULL OR p_last_seen < (now() - interval '2 minutes') THEN 'offline'
    ELSE p_status
  END;
$$;

-- Personalized summary of every DM conversation for a user.
CREATE OR REPLACE FUNCTION public.get_dm_conversations(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'type', c.type,
          'createdAt', c.created_at,
          'updatedAt', c.updated_at,
          'lastReadAt', my_p.last_read_at,
          'unreadCount', (
            SELECT count(*)::int
            FROM public.messages m
            WHERE m.conversation_id = c.id
              AND m.sender_id <> p_user_id
              AND m.created_at > COALESCE(my_p.last_read_at, 'epoch'::timestamptz)
          ),
          'lastMessage', lm.last_msg,
          'otherUser', ou.other_user
        )
        ORDER BY COALESCE(lm.last_msg->>'createdAt', c.updated_at::text) DESC
      ),
      '[]'::jsonb
    )
    FROM public.conversations c
    JOIN public.conversation_participants my_p
      ON my_p.conversation_id = c.id AND my_p.user_id = p_user_id
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'id', m.id,
        'conversationId', m.conversation_id,
        'senderId', m.sender_id,
        'content', CASE WHEN m.deleted_at IS NOT NULL THEN '' ELSE m.content END,
        'messageType', m.message_type,
        'mediaUrl', CASE WHEN m.deleted_at IS NOT NULL THEN NULL ELSE m.media_url END,
        'createdAt', m.created_at,
        'editedAt', m.edited_at,
        'deletedAt', m.deleted_at,
        'replyToId', m.reply_to_id
      ) AS last_msg
      FROM public.messages m
      WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'id', pu.id,
        'username', pu.username,
        'avatarUrl', COALESCE(pu.avatar_url, ''),
        'bio', COALESCE(pu.bio, ''),
        'presenceStatus', public.dm_effective_status(pr.status, pr.last_seen_at),
        'customStatus', pr.custom_status
      ) AS other_user
      FROM public.conversation_participants op
      JOIN public.profiles pu ON pu.id = op.user_id
      LEFT JOIN public.user_presence pr ON pr.user_id = pu.id
      WHERE op.conversation_id = c.id AND op.user_id <> p_user_id
      LIMIT 1
    ) ou ON true
  );
END;
$$;

-- Find an existing DM between two users or create it atomically.
CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(
  p_user_id uuid,
  p_other_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_my_last_read timestamptz;
  v_unread int;
  v_other record;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  IF p_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'cannot DM yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'recipient does not exist';
  END IF;

  SELECT cp.conversation_id INTO v_conv_id
  FROM public.conversation_participants cp
  WHERE cp.user_id = p_user_id
    AND cp.conversation_id IN (
      SELECT cp2.conversation_id FROM public.conversation_participants cp2 WHERE cp2.user_id = p_other_user_id
    )
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (type) VALUES ('dm') RETURNING id INTO v_conv_id;
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, p_user_id), (v_conv_id, p_other_user_id);
  END IF;

  SELECT COALESCE(cp.last_read_at, now()) INTO v_my_last_read
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = v_conv_id AND cp.user_id = p_user_id;

  SELECT count(*)::int INTO v_unread
  FROM public.messages m
  WHERE m.conversation_id = v_conv_id
    AND m.sender_id <> p_user_id
    AND m.created_at > COALESCE(v_my_last_read, 'epoch'::timestamptz);

  SELECT pu.id, pu.username, COALESCE(pu.avatar_url, '') AS avatar_url,
         COALESCE(pu.bio, '') AS bio,
         public.dm_effective_status(pr.status, pr.last_seen_at) AS presence_status,
         pr.custom_status
    INTO v_other
  FROM public.profiles pu
  LEFT JOIN public.user_presence pr ON pr.user_id = pu.id
  WHERE pu.id = p_other_user_id;

  SELECT jsonb_build_object(
    'id', c.id,
    'type', c.type,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at,
    'lastReadAt', v_my_last_read,
    'unreadCount', v_unread,
    'lastMessage', NULL,
    'otherUser', jsonb_build_object(
      'id', v_other.id,
      'username', v_other.username,
      'avatarUrl', v_other.avatar_url,
      'bio', v_other.bio,
      'presenceStatus', v_other.presence_status,
      'customStatus', v_other.custom_status
    )
  ) INTO v_result
  FROM public.conversations c
  WHERE c.id = v_conv_id;

  RETURN v_result;
END;
$$;

-- Insert a message as p_user_id (validated participant), bump thread activity.
CREATE OR REPLACE FUNCTION public.send_dm_message(
  p_user_id uuid,
  p_conversation_id uuid,
  p_content text DEFAULT '',
  p_message_type text DEFAULT 'text',
  p_media_url text DEFAULT NULL,
  p_reply_to_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg public.messages%ROWTYPE;
  v_reply_ok boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id AND cp.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'not a participant of this conversation';
  END IF;

  IF p_message_type NOT IN ('text', 'gif', 'image', 'video') THEN
    RAISE EXCEPTION 'invalid message type';
  END IF;

  IF (COALESCE(p_content, '') = '' AND COALESCE(p_media_url, '') = '') THEN
    RAISE EXCEPTION 'message body is empty';
  END IF;

  IF char_length(p_content) > 4000 THEN
    RAISE EXCEPTION 'message too long';
  END IF;

  IF p_reply_to_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = p_reply_to_id AND cp.user_id = p_user_id
    ) INTO v_reply_ok;
    IF NOT v_reply_ok THEN
      RAISE EXCEPTION 'reply target not found';
    END IF;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, media_url, reply_to_id)
  VALUES (p_conversation_id, p_user_id, COALESCE(p_content, ''), p_message_type, p_media_url, p_reply_to_id)
  RETURNING * INTO v_msg;

  UPDATE public.conversations SET updated_at = now() WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'id', v_msg.id,
    'conversationId', v_msg.conversation_id,
    'senderId', v_msg.sender_id,
    'content', v_msg.content,
    'messageType', v_msg.message_type,
    'mediaUrl', v_msg.media_url,
    'createdAt', v_msg.created_at,
    'editedAt', v_msg.edited_at,
    'replyToId', v_msg.reply_to_id,
    'reactions', '[]'::jsonb
  );
END;
$$;

-- Edit a text message: only the sender may edit, and only text messages.
CREATE OR REPLACE FUNCTION public.update_dm_message(
  p_user_id uuid,
  p_message_id uuid,
  p_content text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg public.messages%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  IF p_content IS NULL OR char_length(p_content) = 0 OR char_length(p_content) > 4000 THEN
    RAISE EXCEPTION 'invalid message content';
  END IF;

  SELECT * INTO v_msg
  FROM public.messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found';
  END IF;

  IF v_msg.sender_id <> p_user_id THEN
    RAISE EXCEPTION 'only the sender can edit this message';
  END IF;

  IF v_msg.message_type <> 'text' THEN
    RAISE EXCEPTION 'only text messages can be edited';
  END IF;

  IF v_msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'cannot edit a deleted message';
  END IF;

  UPDATE public.messages
     SET content = p_content, edited_at = now()
   WHERE id = p_message_id
  RETURNING * INTO v_msg;

  RETURN jsonb_build_object(
    'id', v_msg.id,
    'conversationId', v_msg.conversation_id,
    'senderId', v_msg.sender_id,
    'content', v_msg.content,
    'messageType', v_msg.message_type,
    'mediaUrl', v_msg.media_url,
    'createdAt', v_msg.created_at,
    'editedAt', v_msg.edited_at,
    'deletedAt', v_msg.deleted_at,
    'replyToId', v_msg.reply_to_id
  );
END;
$$;

-- Delete a message: only the sender may delete their own. The row is
-- soft-deleted (deleted_at set, body/media wiped) so replies to it survive
-- and render as "(deleted message)".
CREATE OR REPLACE FUNCTION public.delete_dm_message(
  p_user_id uuid,
  p_message_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg public.messages%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found';
  END IF;

  IF v_msg.sender_id <> p_user_id THEN
    RAISE EXCEPTION 'only the sender can delete this message';
  END IF;

  IF v_msg.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.messages
     SET deleted_at = now(), content = '', media_url = NULL, edited_at = NULL
   WHERE id = p_message_id;

  DELETE FROM public.message_reactions WHERE message_id = p_message_id;
END;
$$;

-- Mark a conversation read for p_user_id.
CREATE OR REPLACE FUNCTION public.mark_dm_conversation_read(
  p_user_id uuid,
  p_conversation_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  UPDATE public.conversation_participants
     SET last_read_at = now()
   WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;

-- Page through a conversation's messages (newest first, ascending response).
CREATE OR REPLACE FUNCTION public.get_dm_messages(
  p_user_id uuid,
  p_conversation_id uuid,
  p_before timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msgs jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id AND cp.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'not a participant of this conversation';
  END IF;

  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'createdAt') ASC), '[]'::jsonb) INTO v_msgs
  FROM (
    SELECT jsonb_build_object(
      'id', m.id,
      'conversationId', m.conversation_id,
      'senderId', m.sender_id,
      'content', CASE WHEN m.deleted_at IS NOT NULL THEN '' ELSE m.content END,
      'messageType', m.message_type,
      'mediaUrl', CASE WHEN m.deleted_at IS NOT NULL THEN NULL ELSE m.media_url END,
      'createdAt', m.created_at,
      'editedAt', m.edited_at,
      'deletedAt', m.deleted_at,
      'replyToId', m.reply_to_id,
      'reactions', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'emoji', rx.emoji,
            'count', rx.cnt,
            'userIds', rx.user_ids
          ) ORDER BY rx.emoji), '[]'::jsonb)
        FROM (
          SELECT emoji, count(*) AS cnt, array_agg(user_id::text ORDER BY created_at) AS user_ids
          FROM public.message_reactions
          WHERE message_id = m.id
          GROUP BY emoji
        ) rx
      )
    ) AS r
    FROM public.messages m
    WHERE m.conversation_id = p_conversation_id
      AND (p_before IS NULL OR m.created_at < p_before)
    ORDER BY m.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  ) msub;

  RETURN v_msgs;
END;
$$;

-- Toggle the requesting user's emoji reaction on a message. Enforces the
-- "max 20 distinct emoji per message" cap on first use of a new emoji and
-- returns the authoritative reaction buckets + whether the reaction was added
-- or removed.
CREATE OR REPLACE FUNCTION public.toggle_message_reaction(
  p_user_id uuid,
  p_message_id uuid,
  p_emoji text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_reactions jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE m.id = p_message_id AND cp.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'not a participant of this conversation';
  END IF;

  IF p_emoji IS NULL OR char_length(p_emoji) = 0 OR char_length(p_emoji) > 16 THEN
    RAISE EXCEPTION 'invalid emoji';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = p_user_id AND emoji = p_emoji
  ) THEN
    DELETE FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = p_user_id AND emoji = p_emoji;
    v_action := 'remove';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.message_reactions
      WHERE message_id = p_message_id AND emoji = p_emoji
    ) AND (
      SELECT count(DISTINCT emoji) FROM public.message_reactions WHERE message_id = p_message_id
    ) >= 20 THEN
      RAISE EXCEPTION 'too many distinct reactions';
    END IF;

    INSERT INTO public.message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, p_user_id, p_emoji);
    v_action := 'add';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'emoji', r.emoji,
      'count', r.cnt,
      'userIds', r.user_ids
    ) ORDER BY r.emoji), '[]'::jsonb) INTO v_reactions
  FROM (
    SELECT emoji, count(*) AS cnt, array_agg(user_id::text ORDER BY created_at) AS user_ids
    FROM public.message_reactions
    WHERE message_id = p_message_id
    GROUP BY emoji
  ) r;

  RETURN jsonb_build_object('action', v_action, 'emoji', p_emoji, 'reactions', v_reactions);
END;
$$;

-- Total unread message count across all the user's conversations.
CREATE OR REPLACE FUNCTION public.count_dm_unread(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  SELECT COALESCE(sum(cnt), 0)::int INTO v_total
  FROM (
    SELECT count(*) AS cnt
    FROM public.messages m
    JOIN public.conversation_participants cp
      ON cp.conversation_id = m.conversation_id AND cp.user_id = p_user_id
    WHERE m.sender_id <> p_user_id
      AND m.created_at > COALESCE(cp.last_read_at, 'epoch'::timestamptz)
    GROUP BY m.conversation_id
  ) t;

  RETURN v_total;
END;
$$;

-- Upsert presence (status + optional custom status text).
CREATE OR REPLACE FUNCTION public.upsert_user_presence(
  p_user_id uuid,
  p_status text DEFAULT 'online',
  p_custom_status text DEFAULT NULL,
  p_last_seen timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  IF p_status NOT IN ('online', 'idle', 'dnd', 'invisible', 'offline') THEN
    RAISE EXCEPTION 'invalid presence status';
  END IF;

  INSERT INTO public.user_presence (user_id, status, custom_status, last_seen_at)
  VALUES (p_user_id, p_status, NULLIF(COALESCE(p_custom_status, ''), ''), COALESCE(p_last_seen, now()))
  ON CONFLICT (user_id) DO UPDATE SET
    status = EXCLUDED.status,
    custom_status = EXCLUDED.custom_status,
    last_seen_at = EXCLUDED.last_seen_at
  RETURNING jsonb_build_object(
    'userId', user_id,
    'status', status,
    'customStatus', custom_status,
    'lastSeenAt', last_seen_at
  ) INTO v;

  RETURN v;
END;
$$;

-- Batch fetch presence for a set of user ids (fallback when realtime is down).
CREATE OR REPLACE FUNCTION public.get_user_presence_batch(p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      jsonb_object_agg(
        user_id::text,
        jsonb_build_object('userId', user_id, 'status', public.dm_effective_status(status, last_seen_at), 'customStatus', custom_status, 'lastSeenAt', last_seen_at)
      ),
      '{}'::jsonb
    )
    FROM public.user_presence
    WHERE user_id = ANY(p_user_ids)
  );
END;
$$;

-- Fetch the caller's own raw stored presence. Unlike get_user_presence_batch
-- this does NOT apply the staleness rule (last-seen older than 2 minutes reads
-- as offline), so a manually selected status survives a refresh / server
-- restart until the user changes it.
CREATE OR REPLACE FUNCTION public.get_own_presence(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  SELECT jsonb_build_object(
    'userId', user_id,
    'status', status,
    'customStatus', custom_status,
    'lastSeenAt', last_seen_at
  )
  INTO v
  FROM public.user_presence
  WHERE user_id = p_user_id;

  RETURN v;
END;
$$;

-- Create a ringing call session (server-authoritative record).
CREATE OR REPLACE FUNCTION public.create_call_session(
  p_user_id uuid,
  p_conversation_id uuid,
  p_callee_id uuid,
  p_call_type text DEFAULT 'voice'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call public.call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  IF p_user_id = p_callee_id THEN
    RAISE EXCEPTION 'cannot call yourself';
  END IF;

  IF p_call_type NOT IN ('voice', 'video', 'screen') THEN
    RAISE EXCEPTION 'invalid call type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id IN (p_user_id, p_callee_id)
  ) THEN
    RAISE EXCEPTION 'both users must be part of the conversation';
  END IF;

  INSERT INTO public.call_sessions (conversation_id, caller_id, callee_id, call_type, status)
  VALUES (p_conversation_id, p_user_id, p_callee_id, p_call_type, 'ringing')
  RETURNING * INTO v_call;

  RETURN jsonb_build_object(
    'id', v_call.id,
    'conversationId', v_call.conversation_id,
    'callerId', v_call.caller_id,
    'calleeId', v_call.callee_id,
    'callType', v_call.call_type,
    'status', v_call.status,
    'startedAt', v_call.started_at,
    'answeredAt', v_call.answered_at,
    'endedAt', v_call.ended_at,
    'createdAt', v_call.created_at
  );
END;
$$;

-- Update a call's lifecycle status (answer / decline / hang up / cancel).
CREATE OR REPLACE FUNCTION public.update_call_session(
  p_user_id uuid,
  p_call_id uuid,
  p_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call public.call_sessions%ROWTYPE;
  v_is_participant boolean;
  v_msg jsonb;
  v_kind text;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  IF p_status NOT IN ('ringing', 'active', 'ended', 'declined', 'missed', 'canceled', 'busy') THEN
    RAISE EXCEPTION 'invalid call status';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    JOIN public.call_sessions cs ON cs.conversation_id = cp.conversation_id
    WHERE cs.id = p_call_id AND cp.user_id = p_user_id
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'not a participant of this call';
  END IF;

  UPDATE public.call_sessions
     SET status = p_status,
         answered_at = CASE WHEN p_status = 'active' THEN now() END,
         ended_at = CASE WHEN p_status IN ('ended', 'declined', 'missed', 'canceled', 'busy') THEN COALESCE(ended_at, now()) END
   WHERE id = p_call_id
  RETURNING * INTO v_call;

  v_kind := CASE p_status
    WHEN 'active'   THEN 'call-started'
    WHEN 'ended'    THEN 'call-ended'
    WHEN 'canceled' THEN 'call-ended'
    WHEN 'declined' THEN 'call-declined'
    WHEN 'missed'   THEN 'call-missed'
    WHEN 'busy'     THEN 'call-declined'
    ELSE NULL
  END;

  v_msg := NULL;
  IF v_kind IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id = v_call.conversation_id
      AND m.message_type = 'system'
      AND m.media_url = v_kind || ':' || v_call.id::text
  ) THEN
    INSERT INTO public.messages (conversation_id, sender_id, content, message_type, media_url)
    VALUES (
      v_call.conversation_id,
      p_user_id,
      jsonb_build_object('kind', v_kind, 'callType', COALESCE(v_call.call_type, 'voice'))::text,
      'system',
      v_kind || ':' || v_call.id::text
    )
    RETURNING jsonb_build_object(
      'id', id,
      'conversationId', conversation_id,
      'senderId', sender_id,
      'content', content,
      'messageType', message_type,
      'mediaUrl', media_url,
      'createdAt', created_at
    ) INTO v_msg;
  END IF;

  RETURN jsonb_build_object(
    'id', v_call.id,
    'conversationId', v_call.conversation_id,
    'callerId', v_call.caller_id,
    'calleeId', v_call.callee_id,
    'callType', v_call.call_type,
    'status', v_call.status,
    'startedAt', v_call.started_at,
    'answeredAt', v_call.answered_at,
    'endedAt', v_call.ended_at,
    'createdAt', v_call.created_at,
    'systemMessage', v_msg
  );
END;
$$;

-- Public profile + waifu appearance snapshot for the DM profile panel.
CREATE OR REPLACE FUNCTION public.get_user_profile_public(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
BEGIN
  SELECT pu.id, pu.username, pu.avatar_url, pu.bio, pu.created_at
    INTO v_profile
  FROM public.profiles pu
  WHERE pu.id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', v_profile.id,
      'username', v_profile.username,
      'avatarUrl', COALESCE(v_profile.avatar_url, ''),
      'bio', COALESCE(v_profile.bio, ''),
      'createdAt', v_profile.created_at,
      'stats', jsonb_build_object(
        'coins', COALESCE(up.coins, 0),
        'bondLevel', COALESCE(up.bond_level, 1),
        'defenseHighWave', COALESCE(up.defense_high_wave, 0),
        'totalVictories', COALESCE(up.defense_victories, 0),
        'goblinsDefeated', COALESCE(up.goblins_defeated, 0)
      ),
      'waifu', jsonb_build_object(
        'name', COALESCE(up.waifu_name, 'Akari'),
        'personality', COALESCE(up.waifu_personality, 'tsundere'),
        'appearance', jsonb_build_object(
          'outfit', COALESCE(up.worn_outfit, 'seifuku'),
          'accessory', COALESCE(up.worn_accessory, 'ribbon'),
          'hairstyle', COALESCE(up.worn_hairstyle, 'twintails'),
          'avatarFrame', COALESCE(up.worn_avatar_frame, 'none'),
          'hairColor', COALESCE(up.appearance_data->>'hairColor', '#ff7597'),
          'eyeColor', COALESCE(up.appearance_data->>'eyeColor', '#4f86f7'),
          'skinTone', COALESCE(up.appearance_data->>'skinTone', '#fff1eb'),
          'avatarMode', COALESCE(up.appearance_data->>'avatarMode', 'svg')
        )
      )
    )
    FROM public.user_progress up
    WHERE up.user_id = p_user_id
  );
END;
$$;

-- Lightweight heartbeat: refresh last_seen_at without touching the stored
-- status or custom status, so callers can distinguish "stale" from "truly
-- offline" in the presence readers above.
CREATE OR REPLACE FUNCTION public.touch_user_presence(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  UPDATE public.user_presence SET last_seen_at = now() WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.user_presence (user_id, status, last_seen_at)
    VALUES (p_user_id, 'online', now());
  END IF;
END;
$$;

-- Grant EXECUTE to the roles in play.
REVOKE ALL ON FUNCTION public.get_dm_conversations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dm_conversations(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_or_create_dm_conversation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation(uuid, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.send_dm_message(uuid, uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_dm_message(uuid, uuid, text, text, text, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_dm_message(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_dm_message(uuid, uuid, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_dm_message(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_dm_message(uuid, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mark_dm_conversation_read(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_dm_conversation_read(uuid, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_dm_messages(uuid, uuid, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dm_messages(uuid, uuid, timestamptz, int) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.toggle_message_reaction(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(uuid, uuid, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.count_dm_unread(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_dm_unread(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.upsert_user_presence(uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_user_presence(uuid, text, text, timestamptz) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_presence_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_presence_batch(uuid[]) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_own_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_presence(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_call_session(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_call_session(uuid, uuid, uuid, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_call_session(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_call_session(uuid, uuid, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_profile_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_profile_public(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.touch_user_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_user_presence(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.dm_effective_status(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_effective_status(text, timestamptz) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.create_call_session(
  p_user_id uuid,
  p_conversation_id uuid,
  p_callee_id uuid,
  p_call_type text DEFAULT 'voice'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call public.call_sessions%ROWTYPE;
  v_join  public.call_sessions%ROWTYPE;
  v_joined boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_user_id does not match the session user';
  END IF;

  IF p_user_id = p_callee_id THEN
    RAISE EXCEPTION 'cannot call yourself';
  END IF;

  IF p_call_type NOT IN ('voice', 'video', 'screen') THEN
    RAISE EXCEPTION 'invalid call type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id IN (p_user_id, p_callee_id)
  ) THEN
    RAISE EXCEPTION 'both users must be part of the conversation';
  END IF;

  -- Issue 4: if the callee is already ringing/active on a call in THIS
  -- conversation (or the caller already has an ongoing call here), join that
  -- existing session instead of starting a second ringing session.
  SELECT * INTO v_join
    FROM public.call_sessions
   WHERE conversation_id = p_conversation_id
     AND status IN ('ringing', 'active')
     AND (caller_id IN (p_user_id, p_callee_id) OR callee_id IN (p_user_id, p_callee_id))
   ORDER BY started_at ASC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'joined', true,
      'call', jsonb_build_object(
        'id', v_join.id,
        'conversationId', v_join.conversation_id,
        'callerId', v_join.caller_id,
        'calleeId', v_join.callee_id,
        'callType', v_join.call_type,
        'status', v_join.status,
        'startedAt', v_join.started_at,
        'answeredAt', v_join.answered_at,
        'endedAt', v_join.ended_at,
        'createdAt', v_join.created_at
      )
    );
  END IF;

  INSERT INTO public.call_sessions (conversation_id, caller_id, callee_id, call_type, status)
  VALUES (p_conversation_id, p_user_id, p_callee_id, p_call_type, 'ringing')
  RETURNING * INTO v_call;

  RETURN jsonb_build_object(
    'joined', false,
    'call', jsonb_build_object(
      'id', v_call.id,
      'conversationId', v_call.conversation_id,
      'callerId', v_call.caller_id,
      'calleeId', v_call.callee_id,
      'callType', v_call.call_type,
      'status', v_call.status,
      'startedAt', v_call.started_at,
      'answeredAt', v_call.answered_at,
      'endedAt', v_call.ended_at,
      'createdAt', v_call.created_at
    )
  );
END;
$$;
