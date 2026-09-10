import { json } from '@solidjs/router';
import bcrypt from 'bcryptjs';
import { checkRateLimit } from '../../../lib/server/rate-limit';
import { getLocalUserByUsername, createSessionToken } from '../../../lib/server/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../lib/server/supabase';

export async function POST(event: { request: Request }) {
  const ip = event.request.headers.get('x-forwarded-for') || 'local';
  const limit = checkRateLimit(`login_${ip}`, 15, 60_000);
  if (!limit.allowed) {
    return json({ success: false, error: 'Too many login attempts. Please wait.' }, { status: 429 });
  }

  try {
    const { username, password } = await event.request.json();

    if (!username || !password) {
      return json({ success: false, error: 'Username and password required.' }, { status: 400 });
    }

    const cleanUsername = String(username).trim();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseServerClient()!;
      const { data: profileByUsername } = await supabase
        .from('profiles')
        .select('email, username, avatar_url, bio')
        .ilike('username', cleanUsername)
        .maybeSingle();

      const cleanEmail = cleanUsername.includes('@')
        ? cleanUsername
        : profileByUsername?.email || `${cleanUsername.toLowerCase()}@waifuspace.moe`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        return json({ success: false, error: error.message }, { status: 401 });
      }

      const userId = data.user.id;
      let profile = profileByUsername;
      if (!profile?.username) {
        const res = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        profile = res.data;
      }

      const token = createSessionToken({
        id: userId,
        username: profile?.username || cleanUsername,
        email: data.user.email,
        avatarUrl: profile?.avatar_url
      });

      return json({
        success: true,
        token,
        user: {
          id: userId,
          username: profile?.username || cleanUsername,
          email: data.user.email,
          avatarUrl: profile?.avatar_url,
          bio: profile?.bio
        }
      });
    }

    // Local / offline fallback
    const user = getLocalUserByUsername(cleanUsername);
    if (!user) {
      return json({ success: false, error: 'Invalid username or password.' }, { status: 401 });
    }

    const match = bcrypt.compareSync(password, user.passwordHash);
    if (!match) {
      return json({ success: false, error: 'Invalid username or password.' }, { status: 401 });
    }

    const token = createSessionToken({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl
    });

    return json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio
      }
    });
  } catch (err: any) {
    return json({ success: false, error: err.message || 'Server error during login.' }, { status: 500 });
  }
}
