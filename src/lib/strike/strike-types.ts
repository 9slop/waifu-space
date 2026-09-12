export type WeaponId = 'rifle' | 'sniper' | 'pistol' | 'knife';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  category: 'primary' | 'secondary' | 'melee';
  damage: number;
  headshotMultiplier: number;
  fireRateRpm: number;
  magazineSize: number;
  reserveAmmo: number;
  reloadTimeMs: number;
  spreadMoving: number;
  spreadStill: number;
  recoilVertical: number;
  recoilHorizontal: number;
  isAutomatic: boolean;
  hasScope: boolean;
  scopeZoom: number; // FOV multiplier e.g. 0.3 for sniper
  color: string;
  viewmodelScale: number;
}

export interface PlayerInput {
  tick: number;
  buttons: number; // bitfield: W=1, A=2, S=4, D=8, JUMP=16, CROUCH=32, WALK=64, FIRE=128, RELOAD=256, SCOPE=512
  yaw: number;     // radians
  pitch: number;   // radians
  weaponId: WeaponId;
}

export const INPUT_BUTTONS = {
  FORWARD: 1 << 0,
  LEFT: 1 << 1,
  BACKWARD: 1 << 2,
  RIGHT: 1 << 3,
  JUMP: 1 << 4,
  CROUCH: 1 << 5,
  WALK: 1 << 6,
  FIRE: 1 << 7,
  RELOAD: 1 << 8,
  SCOPE: 1 << 9
} as const;

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface PlayerSnapshot {
  id: number;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  animState: number; // 0=idle, 1=walk, 2=run, 3=jump, 4=crouch, 5=firing, 6=dead
  health: number;
  activeWeapon: WeaponId;
  kills: number;
  deaths: number;
  headshots: number;
  streak: number;
  ping: number;
}

export interface HitscanRay {
  origin: Vector3D;
  direction: Vector3D;
  maxDistance: number;
  shooterId: number;
  weaponId: WeaponId;
}

export interface HitscanHitResult {
  hit: boolean;
  point: Vector3D;
  normal: Vector3D;
  targetId: number | null;
  isHeadshot: boolean;
  damage: number;
}

export interface KillfeedEntry {
  id: string;
  killerName: string;
  victimName: string;
  weaponId: WeaponId;
  isHeadshot: boolean;
  timestamp: number;
}

export interface StrikeMatchStats {
  kills: number;
  deaths: number;
  headshots: number;
  bestStreak: number;
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
  durationSeconds: number;
}

export interface ScoreboardPlayer {
  id: number;
  name: string;
  isBot: boolean;
  kills: number;
  deaths: number;
  headshots: number;
  score: number;
  streak: number;
  avatarOutfit: string;
}

export const PACKET_OPCODES = {
  C2S_JOIN: 0x01,
  C2S_INPUT: 0x02,
  C2S_SHOOT: 0x03,
  C2S_RELOAD: 0x04,
  C2S_SWITCH_WEAPON: 0x05,

  S2C_WELCOME: 0x10,
  S2C_SNAPSHOT: 0x11,
  S2C_KILL_EVENT: 0x12,
  S2C_RESPAWN: 0x13,
  S2C_SCOREBOARD: 0x14,
  S2C_HIT_CONFIRM: 0x15
} as const;

export type P2PSignalType = 'offer' | 'answer' | 'ice-candidate';

export interface P2PSignalPayload {
  to: string;
  from: string;
  type: P2PSignalType;
  sdp?: any;
  candidate?: any;
}

export interface P2PPlayerState {
  peerId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  animState: number;
  health: number;
  weaponId: WeaponId;
  kills: number;
  deaths: number;
  headshots: number;
  streak: number;
  avatarOutfit: string;
  seq?: number;
  timestamp?: number;
}

export interface P2PShootEvent {
  shooterId: string;
  weaponId: WeaponId;
  origin: Vector3D;
  direction: Vector3D;
  targetId: string | null;
  isHeadshot: boolean;
  part?: 'head' | 'torso' | 'limb';
  damage: number;
  seq?: number;
  timestamp?: number;
}

