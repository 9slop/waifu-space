import { COSMETIC_CATALOG, RpgCosmeticItem, LootboxResult } from '../store';
import {
  getLootboxCost,
  rollLootRarity,
  DUPLICATE_COMPENSATION,
  getDefenseCoinsReward,
  getDefenseExpReward
} from '../economy';

/**
 * Server-authoritative lootbox calculation.
 * Shared rates & prices live in src/lib/economy.ts so both client & server agree.
 */
export function rollLootboxServer(
  boxType: 'standard' | 'royal',
  userCoins: number,
  unlockedItemIds: string[]
): { success: boolean; error?: string; result?: LootboxResult; newCoins?: number; isDuplicate?: boolean } {
  const cost = getLootboxCost(boxType);
  if (userCoins < cost) {
    return { success: false, error: 'Insufficient coins' };
  }

  const targetRarity = rollLootRarity(boxType);

  let candidates = COSMETIC_CATALOG.filter(c => c.id !== 'none' && c.rarity === targetRarity);
  if (candidates.length === 0) candidates = COSMETIC_CATALOG.filter(c => c.id !== 'none');

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const isDuplicate = unlockedItemIds.includes(picked.id);

  let duplicateCoins = 0;
  let duplicateExp = 0;

  if (isDuplicate) {
    const comp = DUPLICATE_COMPENSATION[picked.rarity];
    duplicateCoins = comp.coins;
    duplicateExp = comp.exp;
  }

  const finalCoins = userCoins - cost + duplicateCoins;

  return {
    success: true,
    result: {
      item: picked,
      isDuplicate,
      duplicateCoins,
      duplicateExp
    },
    newCoins: finalCoins,
    isDuplicate
  };
}

/**
 * Server-authoritative minigame wave verification.
 * Calculates verified coins and exp reward on the server so clients cannot inject values.
 */
export function verifyDefenseWaveServer(
  submittedWave: number,
  clientDurationMs: number
): { verified: boolean; error?: string; coinsReward: number; expReward: number } {
  if (submittedWave < 1 || submittedWave > 200) {
    return { verified: false, error: 'Invalid wave range', coinsReward: 0, expReward: 0 };
  }

  // Minimum plausible defense wave play time (must take at least 2.5s or 800ms per wave)
  const minPlausibleMs = Math.max(2500, submittedWave * 800);
  if (clientDurationMs < minPlausibleMs) {
    return { verified: false, error: 'Suspiciously fast wave completion duration', coinsReward: 0, expReward: 0 };
  }

  const coinsReward = getDefenseCoinsReward(submittedWave);
  const expReward = getDefenseExpReward(submittedWave);

  return {
    verified: true,
    coinsReward,
    expReward
  };
}