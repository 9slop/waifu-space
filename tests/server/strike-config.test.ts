import { describe, it, expect } from 'vitest';
import { GET as strikeConfigGET } from '../../src/routes/api/strike/config';

describe('GET /api/strike/config', () => {
  it('returns public supabase configuration for client-side matchmaking', async () => {
    const res = await strikeConfigGET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('supabaseUrl');
    expect(data).toHaveProperty('supabaseAnonKey');
    expect(data).toHaveProperty('isConfigured');
    expect(typeof data.isConfigured).toBe('boolean');
  });
});
