import { json } from '@solidjs/router';
import { checkRateLimit } from '../../../lib/server/rate-limit';
import { registerLocalUser, getLocalUserByUsername, createSessionToken } from '../../../lib/server/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../lib/server/supabase';

export async function POST(event: { request: Request }) {
  const ip = event.request.headers.get('x-forwarded-for') || 'local';
  const limit = checkRateLimit(`reg_${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return json({ success: false, error: 'Too many registration requests. Please wait a moment.' }, { status: 429 });
  }

  try {
    const { username, email, password } = await event.request.json();

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return json({ success: false, error: 'Username must be at least 3 characters long.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return json({ success: false, error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email && typeof email === 'string' ? email.trim() : `${cleanUsername.toLowerCase()}@waifuspace.moe`;

    // Check if Supabase is active
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseServerClient()!;
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (existing) {
        return json({ success: false, error: 'Username already taken.' }, { status: 409 });
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password
      });

      if (authError) {
        return json({ success: false, error: authError.message }, { status: 400 });
      }

      const userId = authData.user?.id || 'usr_' + Date.now();
      await supabase.from('profiles').insert({
        id: userId,
        username: cleanUsername,
        email: cleanEmail
      });

      await supabase.from('user_progress').insert({
        user_id: userId,
        coins: 200,
        bond_exp: 0,
        bond_level: 1
      });

      const token = createSessionToken({ id: userId, username: cleanUsername, email: cleanEmail });
      return json({
        success: true,
        token,
        user: { id: userId, username: cleanUsername, email: cleanEmail }
      });
    }

    // Offline / demo store fallback
    const existing = getLocalUserByUsername(cleanUsername);
    if (existing) {
      return json({ success: false, error: 'Username already taken.' }, { status: 409 });
    }

    const newUser = registerLocalUser(cleanUsername, cleanEmail, password);
    const token = createSessionToken({ id: newUser.id, username: newUser.username, email: newUser.email });

    return json({
      success: true,
      token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email }
    });
  } catch (err: any) {
    return json({ success: false, error: err.message || 'Server error during registration.' }, { status: 500 });
  }
}
