import { json } from '@solidjs/router';
import { getSessionTokenFromRequest, verifySessionToken, createClearSessionCookie } from '../../../lib/server/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../lib/server/supabase';

export async function GET(event: { request: Request }) {
  const token = getSessionTokenFromRequest(event.request);
  const session = verifySessionToken(token);

  if (!session || !token) {
    return json(
      { success: false, user: null, token: null },
      {
        status: 401,
        headers: {
          'Set-Cookie': createClearSessionCookie()
        }
      }
    );
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServerClient()!;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url, bio')
      .eq('id', session.userId)
      .maybeSingle();

    return json({
      success: true,
      token,
      user: {
        id: session.userId,
        username: profile?.username || session.username,
        email: profile?.email || session.email,
        avatarUrl: profile?.avatar_url || session.avatarUrl || '',
        bio: profile?.bio || ''
      }
    });
  }

  return json({
    success: true,
    token,
    user: {
      id: session.userId,
      username: session.username,
      email: session.email,
      avatarUrl: session.avatarUrl || '',
      bio: ''
    }
  });
}

export async function POST(event: { request: Request }) {
  // Logout action: clear session cookie
  return json(
    { success: true },
    {
      headers: {
        'Set-Cookie': createClearSessionCookie()
      }
    }
  );
}
