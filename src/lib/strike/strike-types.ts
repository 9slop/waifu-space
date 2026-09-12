export type WeaponId = 'rifle' | 'sniper' | 'pistol' | 'knife' | 'katana';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  category: 'primary' | 'secondary' | 'melee';
  damage: number;
  heavyDamage?: number;
  backstabDamage?: number;
  quickBackstabDamage?: number;
  headshotMultiplier: number;
  fireRateRpm: number;
  heavyFireRateRpm?: number;
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
  range?: number;
  moveSpeed?: number;
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

export interface StrikeChatMessage {
  id: string;
  sender: string;
  text: string;
  isSystem?: boolean;
  color?: string;
  timestamp: number;
}

export interface StrikeKeybindings {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  crouch: string;
  walk: string;
  reload: string;
  quickswitch: string;
  weapon1: string;
  weapon2: string;
  weapon3: string;
  weapon4: string;
  grenade: string;
  loadout: string;
  scoreboard: string;
  fullscreen: string;
}

export const DEFAULT_KEYBINDINGS: StrikeKeybindings = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  crouch: 'ControlLeft',
  walk: 'ShiftLeft',
  reload: 'KeyR',
  quickswitch: 'KeyQ',
  weapon1: 'Digit1',
  weapon2: 'Digit2',
  weapon3: 'Digit3',
  weapon4: 'Digit4',
  grenade: 'KeyG',
  loadout: 'KeyB',
  scoreboard: 'Tab',
  fullscreen: 'KeyF'
};

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'rtx';

export interface StrikeGraphicsSettings {
  preset: GraphicsPreset;
  shadows: ShadowQuality;
  renderScale: number; // 0.75, 1.0, 1.25
  anisotropicFiltering: number; // 1, 2, 4, 8
  fov: number; // 65 - 105 degrees (horizontal)
  postProcessing: boolean;
}

export const GRAPHICS_PRESETS: Record<GraphicsPreset, StrikeGraphicsSettings> = {
  low: {
    preset: 'low',
    shadows: 'off',
    renderScale: 1.0,
    anisotropicFiltering: 1,
    fov: 85,
    postProcessing: false
  },
  medium: {
    preset: 'medium',
    shadows: 'low',
    renderScale: 1.0,
    anisotropicFiltering: 2,
    fov: 85,
    postProcessing: true
  },
  high: {
    preset: 'high',
    shadows: 'medium',
    renderScale: 1.0,
    anisotropicFiltering: 4,
    fov: 85,
    postProcessing: true
  },
  ultra: {
    preset: 'ultra',
    shadows: 'rtx',
    renderScale: 1.25,
    anisotropicFiltering: 8,
    fov: 85,
    postProcessing: true
  }
};

export const DEFAULT_GRAPHICS_SETTINGS: StrikeGraphicsSettings = {
  ...GRAPHICS_PRESETS.low
};

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
  shooterName?: string;
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

export type GrenadeType = 'molotov' | 'smoke' | 'he';

export interface GrenadeDef {
  type: GrenadeType;
  name: string;
  icon: string;
  description: string;
  fuseTimeMs: number;
  radius: number;
  duration: number;
  damagePerSecond?: number;
  damagePerTick?: number;
  tickIntervalMs?: number;
  centerDamage?: number;
  blastRadius?: number;
  color: string;
}

export const GRENADE_CATALOG: Record<GrenadeType, GrenadeDef> = {
  molotov: {
    type: 'molotov',
    name: 'Kitsune Molotov',
    icon: '🍾',
    description: 'Ground fire zone dealing 20 dmg/s (5 dmg per 0.25s) for 6 seconds',
    fuseTimeMs: 0,
    radius: 4.5,
    duration: 6.0,
    damagePerSecond: 20,
    damagePerTick: 5,
    tickIntervalMs: 250,
    color: '#ff7675'
  },
  smoke: {
    type: 'smoke',
    name: 'Mist Veil Smoke',
    icon: '💨',
    description: 'Expanding smoke screen obstructing view for 16 seconds',
    fuseTimeMs: 1500,
    radius: 5.5,
    duration: 16.0,
    damagePerSecond: 0,
    color: '#dfe6e9'
  },
  he: {
    type: 'he',
    name: 'Type-97 HE Grenade',
    icon: '💣',
    description: 'High explosive frag dealing up to 100 damage at epicenter',
    fuseTimeMs: 1800,
    radius: 6.5,
    duration: 0.4,
    centerDamage: 100,
    blastRadius: 6.5,
    color: '#fdcb6e'
  }
};

export interface PlayerLoadout {
  primary: 'rifle' | 'sniper';
  secondary: 'pistol';
  melee: 'knife' | 'katana';
  grenade: GrenadeType;
}

export const DEFAULT_LOADOUT: PlayerLoadout = {
  primary: 'rifle',
  secondary: 'pistol',
  melee: 'knife',
  grenade: 'molotov'
};

export interface P2PGrenadeThrowEvent {
  shooterId: string;
  type: GrenadeType;
  origin: Vector3D;
  velocity: Vector3D;
  timestamp?: number;
}

