import bcrypt from 'bcryptjs';

export interface UserSession {
  userId: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  exp: number; // expiry timestamp
}

// In-memory demo/offline user store when external Supabase is not connected
export interface LocalUserData {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
}

const localUsers = new Map<string, LocalUserData>();
const localSessions = new Map<string, UserSession>();

// Initialize a default demo user for testing
const demoPasswordHash = bcrypt.hashSync('waifu123', 8);
localUsers.set('user_demo_1', {
  id: 'user_demo_1',
  username: 'AkariFan',
  email: 'senpai@waifuspace.moe',
  passwordHash: demoPasswordHash,
  avatarUrl: '',
  bio: 'Akari is the best tsundere waifu.',
  createdAt: new Date().toISOString()
});

/**
 * Creates a base64url signed-like session token
 */
export function createSessionToken(user: { id: string; username: string; email?: string; avatarUrl?: string }): string {
  const payload: UserSession = {
    userId: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  const str = JSON.stringify(payload);
  const token = 'ws_' + Buffer.from(str).toString('base64url');
  localSessions.set(token, payload);
  return token;
}

/**
 * Validates session token and returns UserSession or null
 */
export function verifySessionToken(token: string | null | undefined): UserSession | null {
  if (!token || !token.startsWith('ws_')) return null;

  // Check local cache
  const cached = localSessions.get(token);
  if (cached && cached.exp > Date.now()) {
    return cached;
  }

  try {
    const raw = Buffer.from(token.slice(3), 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as UserSession;
    if (parsed.exp && parsed.exp > Date.now()) {
      localSessions.set(token, parsed);
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function invalidateSessionToken(token: string) {
  localSessions.delete(token);
}

// Helper methods for local auth mock / fallback
export function getLocalUserByUsername(username: string): LocalUserData | undefined {
  for (const u of localUsers.values()) {
    if (u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === username.toLowerCase())) {
      return u;
    }
  }
  return undefined;
}

export function getLocalUserById(id: string): LocalUserData | undefined {
  return localUsers.get(id);
}

export function registerLocalUser(username: string, email: string, password: string):LocalUserData {
  const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const passwordHash = bcrypt.hashSync(password, 8);
  const user: LocalUserData = {
    id,
    username,
    email,
    passwordHash,
    avatarUrl: '',
    bio: 'Proud companion commander in WaifuSpace.',
    createdAt: new Date().toISOString()
  };
  localUsers.set(id, user);
  return user;
}
