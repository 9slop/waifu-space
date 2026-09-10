import { COSMETIC_CATALOG, RpgCosmeticItem, LootboxResult } from '../store';

/**
 * Server-authoritative lootbox calculation.
 * Rates for standard:
 *   Common: 50%, Rare: 33%, Epic: 13%, Legendary: 3.5%, Mystical: 0.5%
 * Rates for royal:
 *   Rare: 40%, Epic: 40%, Legendary: 17%, Mystical: 3%
 */
export function rollLootboxServer(
  boxType: 'standard' | 'royal',
  userCoins: number,
  unlockedItemIds: string[]
): { success: boolean; error?: string; result?: LootboxResult; newCoins?: number; isDuplicate?: boolean } {
  const cost = boxType === 'standard' ? 100 : 250;
  if (userCoins < cost) {
    return { success: false, error: 'Insufficient coins' };
  }

  const rand = Math.random() * 100;
  let targetRarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mystical';

  if (boxType === 'standard') {
    if (rand < 50) targetRarity = 'common';
    else if (rand < 83) targetRarity = 'rare';
    else if (rand < 96) targetRarity = 'epic';
    else if (rand < 99.5) targetRarity = 'legendary';
    else targetRarity = 'mystical';
  } else {
    if (rand < 40) targetRarity = 'rare';
    else if (rand < 80) targetRarity = 'epic';
    else if (rand < 97) targetRarity = 'legendary';
    else targetRarity = 'mystical';
  }

  let candidates = COSMETIC_CATALOG.filter(c => c.id !== 'none' && c.rarity === targetRarity);
  if (candidates.length === 0) candidates = COSMETIC_CATALOG.filter(c => c.id !== 'none');

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const isDuplicate = unlockedItemIds.includes(picked.id);

  let duplicateCoins = 0;
  let duplicateExp = 0;

  if (isDuplicate) {
    if (picked.rarity === 'common') { duplicateCoins = 40; duplicateExp = 25; }
    else if (picked.rarity === 'rare') { duplicateCoins = 80; duplicateExp = 50; }
    else if (picked.rarity === 'epic') { duplicateCoins = 160; duplicateExp = 100; }
    else if (picked.rarity === 'legendary') { duplicateCoins = 300; duplicateExp = 200; }
    else { duplicateCoins = 600; duplicateExp = 400; }
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

  const coinsReward = 30 + submittedWave * 15;
  const expReward = 45 + submittedWave * 20;

  return {
    verified: true,
    coinsReward,
    expReward
  };
}
