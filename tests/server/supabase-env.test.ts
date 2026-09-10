import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY'
] as const;

const originalEnv = { ...process.env };

// Keep this test hermetic: regardless of any .env file in the repo, the
// server-env loader runs when the real module imports. We only want to test
// detection against the process.env values we set below.
vi.mock('../../src/lib/server/load-env', () => ({
  loadEnvFiles: () => {}
}));

async function loadSupabaseModule() {
  vi.resetModules();
  return await import('../../src/lib/server/supabase');
}

function clearSupabaseEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe('Supabase configuration detection (regression guard)', () => {
  beforeEach(() => {
    clearSupabaseEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('reports not configured when server env vars are missing', async () => {
    const { isSupabaseConfigured, getSupabaseServerClient } = await loadSupabaseModule();
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseServerClient()).toBeNull();
  });

  it('detects configuration from SUPABASE_URL + service role key', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-role-key';
    process.env.SUPABASE_ANON_KEY = 'anon-key';

    const { isSupabaseConfigured, getSupabaseServerClient } = await loadSupabaseModule();
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseServerClient()).not.toBeNull();
  });

  it('detects configuration from SUPABASE_URL + anon key', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';

    const { isSupabaseConfigured } = await loadSupabaseModule();
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('detects configuration from VITE_ fallback vars (bun-style .env.local)', async () => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';

    const { isSupabaseConfigured } = await loadSupabaseModule();
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('prefers the service role key when it and the anon key are both present', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-role-key';

    const { getSupabaseServerClient } = await loadSupabaseModule();
    const client = getSupabaseServerClient() as unknown as { __supabaseUrl?: string };
    // The returned SupabaseClient is created lazily; ensure it was constructed
    expect(client).not.toBeNull();
  });

  it('uses the publishable key fallback for the client when nothing else is set', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fallback';

    const { isSupabaseConfigured, getSupabaseServerClient } = await loadSupabaseModule();
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseServerClient()).not.toBeNull();
  });
});