import { describe, it, expect } from 'vitest';
import {
  encodeInputPacket,
  decodeInputPacket,
  encodeShootPacket,
  decodeShootPacket,
  encodeSnapshotPacket,
  decodeSnapshotPacket,
  encodeKillEventPacket,
  decodeKillEventPacket
} from '../../src/lib/strike/strike-binary';
import { INPUT_BUTTONS, PlayerSnapshot } from '../../src/lib/strike/strike-types';

describe('Waifu Strike: Binary Serialization & Bandwidth Budget', () => {
  it('encodes player input into exactly 12 bytes and decodes accurately', () => {
    const input = {
      tick: 4096,
      buttons: INPUT_BUTTONS.FORWARD | INPUT_BUTTONS.JUMP | INPUT_BUTTONS.FIRE,
      yaw: 1.25,
      pitch: -0.45,
      weaponId: 'rifle' as const
    };

    const buffer = encodeInputPacket(input);
    expect(buffer.byteLength).toBe(12);

    const decoded = decodeInputPacket(buffer);
    expect(decoded.tick).toBe(4096);
    expect(decoded.buttons & INPUT_BUTTONS.FORWARD).toBeTruthy();
    expect(decoded.buttons & INPUT_BUTTONS.JUMP).toBeTruthy();
    expect(decoded.buttons & INPUT_BUTTONS.FIRE).toBeTruthy();
    expect(decoded.buttons & INPUT_BUTTONS.CROUCH).toBeFalsy();
    expect(decoded.weaponId).toBe('rifle');
    expect(decoded.yaw).toBeCloseTo(1.25, 2);
    expect(decoded.pitch).toBeCloseTo(-0.45, 2);
  });

  it('encodes shoot packet into exactly 17 bytes and recovers hit info', () => {
    const buffer = encodeShootPacket(
      1,
      'sniper',
      {
        origin: { x: 10.5, y: 1.6, z: -25.25 },
        direction: { x: 0.707, y: 0, z: 0.707 },
        maxDistance: 200,
        shooterId: 1,
        weaponId: 'sniper'
      },
      true,
      3
    );

    expect(buffer.byteLength).toBe(17);

    const decoded = decodeShootPacket(buffer);
    expect(decoded.shooterId).toBe(1);
    expect(decoded.weaponId).toBe('sniper');
    expect(decoded.targetId).toBe(3);
    expect(decoded.isHeadshot).toBe(true);
    expect(decoded.ray.origin.x).toBeCloseTo(10.5, 1);
    expect(decoded.ray.origin.y).toBeCloseTo(1.6, 1);
    expect(decoded.ray.origin.z).toBeCloseTo(-25.25, 1);
  });

  it('encodes a full 8-player snapshot in under 110 bytes (under 3 KB/s at 25 Hz)', () => {
    const players: PlayerSnapshot[] = [];
    for (let i = 0; i < 8; i++) {
      players.push({
        id: i + 1,
        name: `Waifu_${i}`,
        isBot: i > 0,
        x: i * 5,
        y: 0,
        z: -i * 3,
        yaw: 0.5,
        pitch: 0.1,
        animState: 1,
        health: 100 - i * 10,
        activeWeapon: 'rifle',
        kills: i * 2,
        deaths: i,
        headshots: i,
        streak: i,
        ping: 25
      });
    }

    const buffer = encodeSnapshotPacket(100, players);
    // 6 bytes header + 8 * 12 bytes = 102 bytes total
    expect(buffer.byteLength).toBe(102);

    // 102 bytes * 25 updates/sec = 2550 bytes/sec ~= 2.5 KB/s! Far below 15-25 KB/s requirement!
    expect(buffer.byteLength * 25).toBeLessThan(15000);

    const decoded = decodeSnapshotPacket(buffer);
    expect(decoded.serverTick).toBe(100);
    expect(decoded.players).toHaveLength(8);
    expect(decoded.players[0].id).toBe(1);
    expect(decoded.players[0].health).toBe(100);
    expect(decoded.players[7].health).toBe(30);
  });

  it('encodes kill events into exactly 5 bytes', () => {
    const buffer = encodeKillEventPacket(1, 2, 'rifle', true);
    expect(buffer.byteLength).toBe(5);

    const decoded = decodeKillEventPacket(buffer);
    expect(decoded.killerId).toBe(1);
    expect(decoded.victimId).toBe(2);
    expect(decoded.weaponId).toBe('rifle');
    expect(decoded.isHeadshot).toBe(true);
  });

  it('encodes and decodes katana melee packets accurately', () => {
    const buffer = encodeShootPacket(
      2,
      'katana',
      {
        origin: { x: 5, y: 1.6, z: 12 },
        direction: { x: 0, y: 0, z: 1 },
        maxDistance: 2.8,
        shooterId: 2,
        weaponId: 'katana'
      },
      false,
      4
    );
    expect(buffer.byteLength).toBe(17);

    const decoded = decodeShootPacket(buffer);
    expect(decoded.weaponId).toBe('katana');
    expect(decoded.targetId).toBe(4);

    const killBuf = encodeKillEventPacket(2, 4, 'katana', false);
    const decodedKill = decodeKillEventPacket(killBuf);
    expect(decodedKill.weaponId).toBe('katana');
  });
});
