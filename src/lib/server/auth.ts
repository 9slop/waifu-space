import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { loadEnvFiles } from './load-env';

loadEnvFiles();

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

const FALLBACK_SECRET = 'waifu-space-persistent-hmac-secret-v1-dev-fallback';

/**
 * HMAC signing secret for session tokens. Uses JWT_SECRET from environment/.env.local,
 * with a deterministic persistent fallback so sessions survive server restarts.
 */
const TOKEN_SECRET: string =
  (typeof process !== 'undefined' && process.env && process.env.JWT_SECRET) ||
  FALLBACK_SECRET;

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

function signPayload(body: string): string {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Creates an HMAC-signed session token. The token body is a base64url JSON
 * payload of the session, and it carries an attached signature so clients
 * cannot tamper with the user id or expiry.
 */
export function createSessionToken(user: { id: string; username: string; email?: string; avatarUrl?: string }): string {
  const payload: UserSession = {
    userId: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `ws_${body}.${signPayload(body)}`;
  localSessions.set(token, payload);
  return token;
}

/**
 * Validates session token and returns UserSession or null.
 * Both the cryptographic signature AND the expiry are checked, so a stale or
 * hand-crafted token (even one carrying a valid-looking user id) is rejected.
 */
export function verifySessionToken(token: string | null | undefined): UserSession | null {
  if (!token || !token.startsWith('ws_')) return null;

  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const body = token.slice(3, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  if (!safeEqual(sig, signPayload(body))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UserSession;
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

export const SESSION_COOKIE_NAME = 'ws_session';

/**
 * Formats a Set-Cookie header string for the session token.
 * Max-Age: 7 days (604800 seconds), Path: /, SameSite: Lax.
 */
export function createSessionCookie(token: string, maxAgeSeconds = 7 * 24 * 60 * 60): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

/**
 * Formats a Set-Cookie header string that immediately clears the session cookie.
 */
export function createClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Extracts a session token from either Authorization Bearer header OR ws_session cookie.
 */
export function getSessionTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const raw = authHeader.slice(7).trim();
    if (raw) return raw;
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }

  return null;
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

export function registerLocalUser(username: string, email: string, password: string): LocalUserData {
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