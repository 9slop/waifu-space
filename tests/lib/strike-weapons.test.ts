import { describe, it, expect } from 'vitest';
import { WEAPON_CATALOG } from '../../src/lib/strike/strike-weapons';
import { resolveMovementCollision } from '../../src/lib/strike/strike-map';

describe('Waifu Strike: Weapons and Movement Physics', () => {
  it('defines all 4 core weapons with balanced CS-style stats', () => {
    expect(WEAPON_CATALOG.rifle).toBeDefined();
    expect(WEAPON_CATALOG.sniper).toBeDefined();
    expect(WEAPON_CATALOG.pistol).toBeDefined();
    expect(WEAPON_CATALOG.knife).toBeDefined();

    // Rifle headshot should be instant kill (>= 100 dmg)
    const rifleHeadshot = WEAPON_CATALOG.rifle.damage * WEAPON_CATALOG.rifle.headshotMultiplier;
    expect(rifleHeadshot).toBeGreaterThanOrEqual(100);

    // Sniper body shot should be lethal (>= 100 dmg)
    expect(WEAPON_CATALOG.sniper.damage).toBeGreaterThanOrEqual(100);
    expect(WEAPON_CATALOG.sniper.hasScope).toBe(true);

    // Knife backstab
    expect(WEAPON_CATALOG.knife.damage * 2).toBeGreaterThanOrEqual(100);
  });

  it('prevents player from clipping through map colliders', () => {
    const colliders = [
      { min: { x: 5, y: 0, z: -5 }, max: { x: 7, y: 4, z: 5 }, tag: 'wall' }
    ];

    const startPos = { x: 4.5, y: 0, z: 0 };
    const velocity = { x: 1.0, y: 0, z: 0 }; // trying to push east through the wall

    const result = resolveMovementCollision(startPos, velocity, 0.4, 1.8, colliders);

    // Player should be stopped at obstacle boundary (min.x - radius)
    expect(result.position.x).toBeLessThanOrEqual(5 - 0.4);
    expect(result.velocity.x).toBe(0);
  });

  it('clamps player to floor on ground collision', () => {
    const colliders = [
      { min: { x: -10, y: -2, z: -10 }, max: { x: 10, y: 0, z: 10 }, tag: 'ground' }
    ];

    const startPos = { x: 0, y: 1.0, z: 0 };
    const velocity = { x: 0, y: -2.0, z: 0 }; // falling downwards

    const result = resolveMovementCollision(startPos, velocity, 0.4, 1.8, colliders);
    expect(result.position.y).toBe(0);
    expect(result.onGround).toBe(true);
    expect(result.velocity.y).toBe(0);
  });
});
