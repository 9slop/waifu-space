import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseDotenv } from '../../src/lib/server/load-env';

describe('parseDotenv', () => {
  it('parses simple KEY=VALUE lines', () => {
    expect(parseDotenv('FOO=bar\nBAZ=qux')).toEqual([
      ['FOO', 'bar'],
      ['BAZ', 'qux']
    ]);
  });

  it('ignores comments and blank lines', () => {
    const out = parseDotenv('# comment\n\nFOO=bar\n# another\nBAZ=qux');
    expect(out).toEqual([
      ['FOO', 'bar'],
      ['BAZ', 'qux']
    ]);
  });

  it('strips surrounding quotes from values', () => {
    expect(parseDotenv('A="quoted value"\nB=\'single\'\nC=plain')).toEqual([
      ['A', 'quoted value'],
      ['B', 'single'],
      ['C', 'plain']
    ]);
  });

  it('handles export prefix', () => {
    expect(parseDotenv('export SUPABASE_URL=https://x.supabase.co')).toEqual([
      ['SUPABASE_URL', 'https://x.supabase.co']
    ]);
  });

  it('skips malformed lines', () => {
    expect(parseDotenv('NOEQUALS\n=novalue\nGOOD=1')).toEqual([['GOOD', '1']]);
  });

  it('keeps values containing "=", e.g. JWTs', () => {
    const out = parseDotenv('SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.abc==');
    expect(out[0][1]).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.abc==');
  });
});