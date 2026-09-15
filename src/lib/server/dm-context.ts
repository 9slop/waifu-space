import { json } from '@solidjs/router';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSessionTokenFromRequest, verifySessionToken, type UserSession } from './auth';
import { getSupabaseServerClient, isSupabaseConfigured } from './supabase';

export interface DmContext {
  session: UserSession;
  supabase: SupabaseClient;
}

export function unauthorizedResponse() {
  return json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

export function badRequestResponse(error: string) {
  return json({ success: false, error }, { status: 400 });
}

export function unavailableResponse() {
  return json(
    { success: false, error: 'DM features require Supabase to be configured on the server' },
    { status: 503 }
  );
}

/**
 * Resolves the authenticated session + server client for a DM route.
 * Returns a Response (unauthenticated / supabase missing) or the context.
 */
export function resolveDmContext(request: Request): DmContext | Response {
  const token = getSessionTokenFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) return unauthorizedResponse();
  if (!isSupabaseConfigured()) return unavailableResponse();
  return { session, supabase: getSupabaseServerClient()! };
}

/** Normalizes an arbitrary user-supplied string into a safe search fragment. */
export function sanitizeSearchQuery(raw: string | null): string {
  if (!raw) return '';
  return raw
    .trim()
    .slice(0, 40)
    .replace(/[^A-Za-z0-9_\u4e00-\u9fff\u3040-\u30ff -]/g, '');
}

export function isUuidLike(value: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}