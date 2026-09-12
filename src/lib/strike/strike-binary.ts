import {
  PACKET_OPCODES,
  PlayerInput,
  PlayerSnapshot,
  WeaponId,
  HitscanRay,
  HitscanHitResult,
  ScoreboardPlayer
} from './strike-types';

const WEAPON_INDEX_MAP: Record<WeaponId, number> = {
  rifle: 0,
  sniper: 1,
  pistol: 2,
  knife: 3,
  katana: 4
};

const INDEX_WEAPON_MAP: WeaponId[] = ['rifle', 'sniper', 'pistol', 'knife', 'katana'];

export function weaponToId(w: WeaponId): number {
  return WEAPON_INDEX_MAP[w] ?? 0;
}

export function idToWeapon(id: number): WeaponId {
  return INDEX_WEAPON_MAP[id] ?? 'rifle';
}

/**
 * Encodes client inputs into a compact 12-byte binary payload.
 * [opcode:1, tick:4, buttons:2, yaw:2, pitch:2, weapon:1]
 */
export function encodeInputPacket(input: PlayerInput): ArrayBuffer {
  const buffer = new ArrayBuffer(12);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_OPCODES.C2S_INPUT);
  view.setUint32(1, input.tick, true);
  view.setUint16(5, input.buttons, true);

  // Normalize yaw [-PI, PI] to int16 [-32767, 32767]
  const qYaw = Math.max(-32767, Math.min(32767, Math.round((input.yaw / Math.PI) * 32767)));
  view.setInt16(7, qYaw, true);

  // Normalize pitch [-PI/2, PI/2] to int16 [-32767, 32767]
  const qPitch = Math.max(-32767, Math.min(32767, Math.round((input.pitch / (Math.PI / 2)) * 32767)));
  view.setInt16(9, qPitch, true);

  view.setUint8(11, weaponToId(input.weaponId));

  return buffer;
}

export function decodeInputPacket(buffer: ArrayBuffer): PlayerInput {
  const view = new DataView(buffer);
  const tick = view.getUint32(1, true);
  const buttons = view.getUint16(5, true);
  const qYaw = view.getInt16(7, true);
  const qPitch = view.getInt16(9, true);
  const weaponIndex = view.getUint8(11);

  return {
    tick,
    buttons,
    yaw: (qYaw / 32767) * Math.PI,
    pitch: (qPitch / 32767) * (Math.PI / 2),
    weaponId: idToWeapon(weaponIndex)
  };
}

/**
 * Encodes shot action into a 17-byte binary payload.
 */
export function encodeShootPacket(
  shooterId: number,
  weaponId: WeaponId,
  ray: HitscanRay,
  isHeadshot: boolean,
  targetId: number | null
): ArrayBuffer {
  const buffer = new ArrayBuffer(17);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_OPCODES.C2S_SHOOT);
  view.setUint8(1, shooterId);
  view.setUint8(2, weaponToId(weaponId));

  // Quantize origin coords to cm (scale * 100)
  view.setInt16(3, Math.round(ray.origin.x * 100), true);
  view.setInt16(5, Math.round(ray.origin.y * 100), true);
  view.setInt16(7, Math.round(ray.origin.z * 100), true);

  // Normalized direction vector scaled to int16
  view.setInt16(9, Math.round(ray.direction.x * 32767), true);
  view.setInt16(11, Math.round(ray.direction.y * 32767), true);
  view.setInt16(13, Math.round(ray.direction.z * 32767), true);

  view.setUint8(15, targetId ?? 255);
  view.setUint8(16, isHeadshot ? 1 : 0);

  return buffer;
}

export function decodeShootPacket(buffer: ArrayBuffer): {
  shooterId: number;
  weaponId: WeaponId;
  ray: HitscanRay;
  isHeadshot: boolean;
  targetId: number | null;
} {
  const view = new DataView(buffer);
  const shooterId = view.getUint8(1);
  const weaponId = idToWeapon(view.getUint8(2));

  const origin = {
    x: view.getInt16(3, true) / 100,
    y: view.getInt16(5, true) / 100,
    z: view.getInt16(7, true) / 100
  };

  const direction = {
    x: view.getInt16(9, true) / 32767,
    y: view.getInt16(11, true) / 32767,
    z: view.getInt16(13, true) / 32767
  };

  const rawTargetId = view.getUint8(15);
  const targetId = rawTargetId === 255 ? null : rawTargetId;
  const isHeadshot = view.getUint8(16) === 1;

  return {
    shooterId,
    weaponId,
    ray: {
      origin,
      direction,
      maxDistance: 200,
      shooterId,
      weaponId
    },
    isHeadshot,
    targetId
  };
}

/**
 * Encodes delta snapshot for all active entities.
 * Header: [opcode:1, tick:4, count:1] = 6 bytes
 * Per Player: [id:1, x:2, y:2, z:2, yaw:1, pitch:1, anim:1, hp:1, weapon:1] = 12 bytes
 */
export function encodeSnapshotPacket(serverTick: number, players: PlayerSnapshot[]): ArrayBuffer {
  const count = Math.min(255, players.length);
  const totalLength = 6 + count * 12;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET_OPCODES.S2C_SNAPSHOT);
  view.setUint32(1, serverTick, true);
  view.setUint8(5, count);

  let offset = 6;
  for (let i = 0; i < count; i++) {
    const p = players[i];
    view.setUint8(offset, p.id);
    view.setInt16(offset + 1, Math.round(p.x * 100), true);
    view.setInt16(offset + 3, Math.round(p.y * 100), true);
    view.setInt16(offset + 5, Math.round(p.z * 100), true);

    const qYaw = Math.max(-127, Math.min(127, Math.round((p.yaw / Math.PI) * 127)));
    view.setInt8(offset + 7, qYaw);

    const qPitch = Math.max(-127, Math.min(127, Math.round((p.pitch / (Math.PI / 2)) * 127)));
    view.setInt8(offset + 8, qPitch);

    view.setUint8(offset + 9, p.animState & 0xff);
    view.setUint8(offset + 10, Math.max(0, Math.min(100, Math.round(p.health))));
    view.setUint8(offset + 11, weaponToId(p.activeWeapon));

    offset += 12;
  }

  return buffer;
}

export function decodeSnapshotPacket(buffer: ArrayBuffer): {
  serverTick: number;
  players: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    animState: number;
    health: number;
    weaponId: WeaponId;
  }>;
} {
  const view = new DataView(buffer);
  const serverTick = view.getUint32(1, true);
  const count = view.getUint8(5);

  const players: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    animState: number;
    health: number;
    weaponId: WeaponId;
  }> = [];

  let offset = 6;
  for (let i = 0; i < count; i++) {
    const id = view.getUint8(offset);
    const x = view.getInt16(offset + 1, true) / 100;
    const y = view.getInt16(offset + 3, true) / 100;
    const z = view.getInt16(offset + 5, true) / 100;
    const qYaw = view.getInt8(offset + 7);
    const qPitch = view.getInt8(offset + 8);
    const animState = view.getUint8(offset + 9);
    const health = view.getUint8(offset + 10);
    const weaponId = idToWeapon(view.getUint8(offset + 11));

    players.push({
      id,
      x,
      y,
      z,
      yaw: (qYaw / 127) * Math.PI,
      pitch: (qPitch / 127) * (Math.PI / 2),
      animState,
      health,
      weaponId
    });

    offset += 12;
  }

  return { serverTick, players };
}

/**
 * Encodes a death/kill event: [opcode:1, killerId:1, victimId:1, weaponId:1, headshot:1] = 5 bytes
 */
export function encodeKillEventPacket(
  killerId: number,
  victimId: number,
  weaponId: WeaponId,
  isHeadshot: boolean
): ArrayBuffer {
  const buffer = new ArrayBuffer(5);
  const view = new DataView(buffer);
  view.setUint8(0, PACKET_OPCODES.S2C_KILL_EVENT);
  view.setUint8(1, killerId);
  view.setUint8(2, victimId);
  view.setUint8(3, weaponToId(weaponId));
  view.setUint8(4, isHeadshot ? 1 : 0);
  return buffer;
}

export function decodeKillEventPacket(buffer: ArrayBuffer): {
  killerId: number;
  victimId: number;
  weaponId: WeaponId;
  isHeadshot: boolean;
} {
  const view = new DataView(buffer);
  return {
    killerId: view.getUint8(1),
    victimId: view.getUint8(2),
    weaponId: idToWeapon(view.getUint8(3)),
    isHeadshot: view.getUint8(4) === 1
  };
}
