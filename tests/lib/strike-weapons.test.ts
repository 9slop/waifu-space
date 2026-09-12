import { describe, it, expect } from 'vitest';
import { WEAPON_CATALOG } from '../../src/lib/strike/strike-weapons';
import { P2PPlayerState, P2PShootEvent } from '../../src/lib/strike/strike-types';

describe('Waifu Strike: Weapons and P2P Networking Protocol', () => {
  it('defines all 4 core weapons with balanced CS-style stats', () => {
    expect(WEAPON_CATALOG.rifle).toBeDefined();
    expect(WEAPON_CATALOG.sniper).toBeDefined();
    expect(WEAPON_CATALOG.pistol).toBeDefined();
    expect(WEAPON_CATALOG.knife).toBeDefined();

    // Rifle headshot should be instant kill (>= 100 dmg)
    const rifleHeadshot = WEAPON_CATALOG.rifle.damage * WEAPON_CATALOG.rifle.headshotMultiplier;
    expect(rifleHeadshot).toBeGreaterThanOrEqual(100);

    // Sniper body shot: 80 dmg, headshot: 100 dmg
    expect(WEAPON_CATALOG.sniper.damage).toBe(80);
    expect(WEAPON_CATALOG.sniper.damage * WEAPON_CATALOG.sniper.headshotMultiplier).toBe(100);
    expect(WEAPON_CATALOG.sniper.hasScope).toBe(true);

    // Knife backstab
    expect(WEAPON_CATALOG.knife.damage * 2).toBeGreaterThanOrEqual(100);
  });

  it('validates P2P player state serialization and recovery', () => {
    const state: P2PPlayerState = {
      peerId: 'peer_123',
      name: 'AsukaCommander',
      x: 12.5,
      y: 1.62,
      z: -8.4,
      yaw: 1.57,
      pitch: -0.25,
      animState: 1,
      health: 85,
      weaponId: 'rifle',
      kills: 5,
      deaths: 2,
      headshots: 3,
      streak: 4,
      ping: 25,
      avatarOutfit: '#ff7597'
    };

    const serialized = JSON.stringify({ type: 'state', state });
    const parsed = JSON.parse(serialized);

    expect(parsed.type).toBe('state');
    expect(parsed.state.peerId).toBe('peer_123');
    expect(parsed.state.health).toBe(85);
    expect(parsed.state.x).toBeCloseTo(12.5);
    expect(parsed.state.kills).toBe(5);
  });

  it('validates P2P shoot events and hit detection payloads', () => {
    const shoot: P2PShootEvent = {
      shooterId: 'peer_123',
      shooterName: 'Commander',
      weaponId: 'sniper',
      origin: { x: 0, y: 1.62, z: 20 },
      direction: { x: 0, y: 0, z: -1 },
      targetId: 'peer_456',
      isHeadshot: true,
      damage: 100
    };

    const serialized = JSON.stringify({ type: 'shoot', shoot });
    const parsed = JSON.parse(serialized);

    expect(parsed.type).toBe('shoot');
    expect(parsed.shoot.shooterName).toBe('Commander');
    expect(parsed.shoot.weaponId).toBe('sniper');
    expect(parsed.shoot.isHeadshot).toBe(true);
    expect(parsed.shoot.damage).toBe(100);
  });

  it('verifies all firearms use yellow tracers (#ffd32a)', () => {
    expect(WEAPON_CATALOG.rifle.color).toBe('#ffd32a');
    expect(WEAPON_CATALOG.sniper.color).toBe('#ffd32a');
    expect(WEAPON_CATALOG.pistol.color).toBe('#ffd32a');
  });
});
