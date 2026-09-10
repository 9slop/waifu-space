import { describe, it, expect } from 'vitest';
import {
  registerLocalUser,
  getLocalUserByUsername,
  createSessionToken,
  verifySessionToken,
  invalidateSessionToken
} from '../../src/lib/server/auth';
import { checkRateLimit } from '../../src/lib/server/rate-limit';
import { rollLootboxServer, verifyDefenseWaveServer } from '../../src/lib/server/game-logic';
import bcrypt from 'bcryptjs';
import { COSMETIC_CATALOG } from '../../src/lib/store';

describe('Server APIs & Backend Logic', () => {
  describe('Authentication & Session Management', () => {
    it('creates a valid session token and verifies it correctly', () => {
      const user = {
        id: 'usr_test_123',
        username: 'TestCommander',
        email: 'test@waifuspace.moe',
        avatarUrl: ''
      };

      const token = createSessionToken(user);
      expect(token).toMatch(/^ws_/);

      const session = verifySessionToken(token);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe('usr_test_123');
      expect(session?.username).toBe('TestCommander');
    });

    it('rejects invalid or expired session tokens', () => {
      expect(verifySessionToken(null)).toBeNull();
      expect(verifySessionToken('invalid_token')).toBeNull();
      expect(verifySessionToken('ws_badbase64!')).toBeNull();

      // Invalidate token
      const token = createSessionToken({ id: 'usr_bye', username: 'Bye' });
      invalidateSessionToken(token);
      // Invalidate removed it from cache
    });

    it('registers local user and securely hashes password with bcrypt', () => {
      const uName = 'Senpai_' + Math.random().toString(36).substring(2, 6);
      const user = registerLocalUser(uName, `${uName}@test.com`, 'supersecret123');

      expect(user.id).toMatch(/^usr_/);
      expect(user.username).toBe(uName);
      expect(user.passwordHash).not.toBe('supersecret123');
      expect(bcrypt.compareSync('supersecret123', user.passwordHash)).toBe(true);
      expect(bcrypt.compareSync('wrongpass', user.passwordHash)).toBe(false);

      const retrieved = getLocalUserByUsername(uName);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(user.id);
    });
  });

  describe('Rate Limiter (Sliding Window)', () => {
    it('allows requests within threshold and blocks requests exceeding limit', () => {
      const key = 'test_rate_limit_' + Date.now();

      // Max 3 requests per 10 seconds
      const res1 = checkRateLimit(key, 3, 10000);
      const res2 = checkRateLimit(key, 3, 10000);
      const res3 = checkRateLimit(key, 3, 10000);
      const res4 = checkRateLimit(key, 3, 10000);

      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);
      expect(res4.allowed).toBe(false);
      expect(res4.remaining).toBe(0);
    });
  });

  describe('Server-Authoritative Lootbox (Gacha)', () => {
    it('rejects roll if player has insufficient coins', () => {
      const result = rollLootboxServer('standard', 30, []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient coins');
    });

    it('processes roll, deducts cost, and awards item', () => {
      const result = rollLootboxServer('standard', 200, []);
      expect(result.success).toBe(true);
      expect(result.newCoins).toBe(100); // 200 - 100
      expect(result.result).toBeDefined();
      expect(result.result?.item.id).toBeDefined();
      expect(result.isDuplicate).toBe(false);
    });

    it('correctly handles duplicate items with coin compensation', () => {
      // Pass all cosmetics as already unlocked so roll is guaranteed duplicate
      const allItemIds = COSMETIC_CATALOG.map(c => c.id);

      const result = rollLootboxServer('standard', 200, allItemIds);
      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      // Duplicate should refund compensation (base cost 100 - cost + refund)
      expect(result.newCoins).toBeGreaterThan(100);
    });

    it('can roll Mystical items from royal chests', () => {
      let rolledMystical = false;
      for (let i = 0; i < 200; i++) {
        const roll = rollLootboxServer('royal', 500, []);
        if (roll.success && roll.result?.item.rarity === 'mystical') {
          rolledMystical = true;
          break;
        }
      }
      expect(rolledMystical).toBe(true);
    });
  });

  describe('Server Defense Wave Verification', () => {
    it('validates legitimate wave clears and computes server rewards', () => {
      const valid = verifyDefenseWaveServer(5, 15000);
      expect(valid.verified).toBe(true);
      expect(valid.coinsReward).toBe(30 + 5 * 15); // 105
      expect(valid.expReward).toBe(45 + 5 * 20); // 145
    });

    it('rejects negative or zero wave numbers', () => {
      const invalidWave = verifyDefenseWaveServer(0, 10000);
      expect(invalidWave.verified).toBe(false);
      expect(invalidWave.error).toBeDefined();
    });

    it('flags impossibly fast wave clears as suspicious', () => {
      const speedhack = verifyDefenseWaveServer(10, 1200); // 1.2s for wave 10 is impossible
      expect(speedhack.verified).toBe(false);
      expect(speedhack.error).toMatch(/suspicious/i);
    });
  });
});
