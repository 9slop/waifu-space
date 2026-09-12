import { WeaponDef, WeaponId } from './strike-types';

export const WEAPON_CATALOG: Record<WeaponId, WeaponDef> = {
  rifle: {
    id: 'rifle',
    name: 'Type-89 Sakura Rifle',
    category: 'primary',
    damage: 24, // 5 shots unarmored (24 * 5 = 120), ~6-7 shots armored (takes 4-5+ bullets to kill)
    headshotMultiplier: 2.2, // 52-53 headshot damage (~36 armored, requiring 2 headshots or 1 head + 2-3 body)
    fireRateRpm: 600, // 10 rounds/sec = 100ms between shots
    magazineSize: 30,
    reserveAmmo: 90,
    reloadTimeMs: 2100,
    spreadMoving: 0.048,
    spreadStill: 0.004,
    recoilVertical: 0.024,
    recoilHorizontal: 0.012,
    isAutomatic: true,
    hasScope: false,
    scopeZoom: 1.0,
    color: '#ffd32a', // Vibrant yellow bullet tracer
    viewmodelScale: 1.0,
    range: 300,
    moveSpeed: 6.6
  },
  sniper: {
    id: 'sniper',
    name: 'Aether Railgun (AWP)',
    category: 'primary',
    damage: 105, // 1-shot kill to chest on 100 HP (~72 armored, lethal on unarmored or 1-tap headshot)
    headshotMultiplier: 1.6, // 168 headshot damage (clean lethal headshot through armor, no absurd 460/480 overkills)
    fireRateRpm: 48, // Responsive bolting
    magazineSize: 5,
    reserveAmmo: 30,
    reloadTimeMs: 2200, // Responsive reload
    spreadMoving: 0.12,
    spreadStill: 0.0002, // Scoped stationary laser accuracy
    recoilVertical: 0.08,
    recoilHorizontal: 0.02,
    isAutomatic: false,
    hasScope: true,
    scopeZoom: 0.28,
    color: '#ffd32a', // Vibrant yellow bullet tracer
    viewmodelScale: 1.25,
    range: 300,
    moveSpeed: 5.6
  },
  pistol: {
    id: 'pistol',
    name: 'Neo Deagle',
    category: 'secondary',
    damage: 32, // 4 body hits to eliminate 100 HP (32 * 4 = 128), ~5 hits armored
    headshotMultiplier: 2.2, // ~70 headshot damage (~48 armored, requiring 2 headshots or 1 head + 2 body)
    fireRateRpm: 320, // 187ms between shots
    magazineSize: 7,
    reserveAmmo: 70,
    reloadTimeMs: 1500,
    spreadMoving: 0.055,
    spreadStill: 0.012, // Lower accuracy than rifles and snipers; noticeable spread at range
    recoilVertical: 0.035,
    recoilHorizontal: 0.015,
    isAutomatic: false,
    hasScope: false,
    scopeZoom: 1.0,
    color: '#ffd32a', // Vibrant yellow bullet tracer
    viewmodelScale: 0.75,
    range: 300,
    moveSpeed: 6.8
  },
  knife: {
    id: 'knife',
    name: 'Kitsune Blade',
    category: 'melee',
    damage: 35, // Quick slash base damage
    heavyDamage: 65, // Heavy right-click stab frontal damage
    backstabDamage: 200, // Heavy right-click backstab (instant kill!)
    quickBackstabDamage: 70, // Quick left-click backstab
    headshotMultiplier: 1.5,
    fireRateRpm: 150, // 400ms cooldown for quick slashes
    heavyFireRateRpm: 60, // 1000ms cooldown for heavy thrusts
    magazineSize: 1,
    reserveAmmo: 1,
    reloadTimeMs: 0,
    spreadMoving: 0,
    spreadStill: 0,
    recoilVertical: 0,
    recoilHorizontal: 0,
    isAutomatic: false,
    hasScope: false,
    scopeZoom: 1.0,
    color: '#fdcb6e',
    viewmodelScale: 0.65,
    range: 2.2, // authentic close-quarters combat
    moveSpeed: 7.0
  },
  katana: {
    id: 'katana',
    name: 'Muramasa Katana',
    category: 'melee',
    damage: 55, // Quick slash base damage (higher than knife 35)
    heavyDamage: 95, // Heavy right-click stab frontal damage (higher than knife 65)
    backstabDamage: 220, // Heavy backstab instant kill (higher than knife 200)
    quickBackstabDamage: 110, // Quick backstab (higher than knife 70)
    headshotMultiplier: 1.5,
    fireRateRpm: 120, // 500ms cooldown for quick slashes
    heavyFireRateRpm: 50, // 1200ms cooldown for heavy thrusts
    magazineSize: 1,
    reserveAmmo: 1,
    reloadTimeMs: 0,
    spreadMoving: 0,
    spreadStill: 0,
    recoilVertical: 0,
    recoilHorizontal: 0,
    isAutomatic: false,
    hasScope: false,
    scopeZoom: 1.0,
    color: '#ff4757',
    viewmodelScale: 0.75,
    range: 2.8, // longer reach than knife 2.2
    moveSpeed: 6.2
  }
};

export interface SpatialAudioParams {
  sourcePosition?: { x: number; y: number; z: number };
  listenerPosition?: { x: number; y: number; z: number };
  sourcePos?: { x: number; y: number; z: number };
  listenerPos?: { x: number; y: number; z: number };
  listenerYaw?: number;
}

/**
 * Procedural Web Audio sound synthesizer for realistic, instantaneous gunfire, spatial feedback, and quiet footsteps.
 * Zero external audio assets required.
 */
class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.5;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  private createSpatialNode(ctx: AudioContext, params?: SpatialAudioParams): { input: AudioNode; output: AudioNode } {
    if (!params || !this.masterGain) {
      return { input: this.masterGain!, output: this.masterGain! };
    }

    const src = params.sourcePosition || params.sourcePos;
    const listener = params.listenerPosition || params.listenerPos;
    if (
      !src ||
      !listener ||
      typeof src.x !== 'number' ||
      typeof listener.x !== 'number' ||
      typeof src.z !== 'number' ||
      typeof listener.z !== 'number'
    ) {
      return { input: this.masterGain!, output: this.masterGain! };
    }

    const dx = src.x - listener.x;
    const dz = src.z - listener.z;
    const dist = Math.hypot(dx, dz);
    const yaw = params.listenerYaw || 0;

    // Relative angle in horizontal plane rotated by listener camera yaw
    const relX = dx * Math.cos(-yaw) - dz * Math.sin(-yaw);
    const panVal = Math.max(-0.9, Math.min(0.9, relX / Math.max(2.5, dist)));

    // Smooth distance attenuation: 1 / (1 + (dist / 14)^1.4)
    const distAttenuation = Math.max(0.08, Math.min(1.0, 1 / (1 + Math.pow(dist / 14, 1.4))));

    const spatialGain = ctx.createGain();
    spatialGain.gain.setValueAtTime(distAttenuation, ctx.currentTime);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(panVal, ctx.currentTime);
      spatialGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      spatialGain.connect(this.masterGain);
    }

    return { input: spatialGain, output: spatialGain };
  }

  public playFootstep(isLocal: boolean, spatial?: SpatialAudioParams) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || typeof ctx.createBuffer !== 'function') return;

    const t = ctx.currentTime;
    const dest = this.createSpatialNode(ctx, isLocal ? undefined : spatial);

    // Subtle, quiet footstep tap (low frequency pop + filtered noise)
    const baseVol = isLocal ? 0.08 : 0.065;

    // Filtered noise step
    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.35;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(450, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(baseVol * 0.65, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest.input);
    noiseSource.start(t);
    noiseSource.stop(t + 0.04);

    // Low wood/stone tap thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(105, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.05);

    oscGain.gain.setValueAtTime(baseVol, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(oscGain);
    oscGain.connect(dest.input);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playGunfire(weaponId: WeaponId, spatial?: SpatialAudioParams, isHeavy = false) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const dest = this.createSpatialNode(ctx, spatial);
    const t = ctx.currentTime;

    if (weaponId === 'knife' || weaponId === 'katana') {
      // Whoosh sound (sharp slash vs heavy thrust)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const isKatana = weaponId === 'katana';
      osc.type = (isHeavy || isKatana) ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isKatana ? (isHeavy ? 280 : 380) : (isHeavy ? 320 : 450), t);
      osc.frequency.exponentialRampToValueAtTime(isHeavy ? 45 : 80, t + (isHeavy ? 0.24 : 0.14));
      gain.gain.setValueAtTime(isKatana ? 0.48 : (isHeavy ? 0.45 : 0.3), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (isHeavy ? 0.24 : 0.14));
      osc.connect(gain);
      gain.connect(dest.input);
      osc.start(t);
      osc.stop(t + (isHeavy ? 0.24 : 0.14));
      return;
    }

    if (typeof ctx.createBuffer !== 'function') return;

    // Gunshot: Noise burst (crack) + Low-frequency Sine (thump)
    const bufferSize = ctx.sampleRate * 0.15;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(weaponId === 'sniper' ? 1200 : weaponId === 'rifle' ? 1800 : 2400, t);
    filter.Q.setValueAtTime(1.5, t);

    const noiseGain = ctx.createGain();
    const duration = weaponId === 'sniper' ? 0.35 : weaponId === 'rifle' ? 0.14 : 0.12;
    noiseGain.gain.setValueAtTime(weaponId === 'sniper' ? 0.9 : 0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest.input);
    whiteNoise.start(t);
    whiteNoise.stop(t + duration);

    // Bass Thump
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'triangle';
    bass.frequency.setValueAtTime(weaponId === 'sniper' ? 180 : 140, t);
    bass.frequency.exponentialRampToValueAtTime(30, t + duration);

    bassGain.gain.setValueAtTime(weaponId === 'sniper' ? 0.8 : 0.5, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    bass.connect(bassGain);
    bassGain.connect(dest.input);
    bass.start(t);
    bass.stop(t + duration);
  }

  public playHitmarker(isHeadshot: boolean) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isHeadshot) {
      // High-pitched bright chime ding
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, t); // A6
      osc.frequency.setValueAtTime(2637, t + 0.04); // E7
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    } else {
      // Tactile quick hit tick
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.06);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  public playReload() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Mag click out
    const click1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    click1.type = 'sine';
    click1.frequency.setValueAtTime(800, t);
    click1.frequency.exponentialRampToValueAtTime(200, t + 0.05);
    g1.gain.setValueAtTime(0.25, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    click1.connect(g1);
    g1.connect(this.masterGain);
    click1.start(t);
    click1.stop(t + 0.05);

    // Mag click in
    const click2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    click2.type = 'sine';
    click2.frequency.setValueAtTime(600, t + 0.4);
    click2.frequency.exponentialRampToValueAtTime(1000, t + 0.45);
    g2.gain.setValueAtTime(0.3, t + 0.4);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.47);
    click2.connect(g2);
    g2.connect(this.masterGain);
    click2.start(t + 0.4);
    click2.stop(t + 0.47);
  }

  public playGrenadePin() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(3200, t + 0.04);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  public playGrenadeBounce(spatial?: SpatialAudioParams) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const dest = this.createSpatialNode(ctx, spatial);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.05);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g);
    g.connect(dest.input);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playExplosion(spatial?: SpatialAudioParams) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const dest = this.createSpatialNode(ctx, spatial);
    const t = ctx.currentTime;

    // Sub-bass detonation thump
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.type = 'triangle';
    bass.frequency.setValueAtTime(160, t);
    bass.frequency.exponentialRampToValueAtTime(35, t + 0.65);
    bg.gain.setValueAtTime(0.9, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    bass.connect(bg);
    bg.connect(dest.input);
    bass.start(t);
    bass.stop(t + 0.65);

    // Shockwave crack
    if (typeof ctx.createBuffer === 'function') {
      const bufferSize = ctx.sampleRate * 0.4;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850, t);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.85, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      noise.connect(filter);
      filter.connect(ng);
      ng.connect(dest.input);
      noise.start(t);
      noise.stop(t + 0.4);
    }
  }

  public playFireIgnite(spatial?: SpatialAudioParams) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const dest = this.createSpatialNode(ctx, spatial);
    const t = ctx.currentTime;

    // Glass shatter clink
    const clink = ctx.createOscillator();
    const cg = ctx.createGain();
    clink.type = 'sine';
    clink.frequency.setValueAtTime(2400, t);
    clink.frequency.exponentialRampToValueAtTime(800, t + 0.08);
    cg.gain.setValueAtTime(0.35, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    clink.connect(cg);
    cg.connect(dest.input);
    clink.start(t);
    clink.stop(t + 0.08);

    // Fire whoosh
    const whoosh = ctx.createOscillator();
    const wg = ctx.createGain();
    whoosh.type = 'triangle';
    whoosh.frequency.setValueAtTime(320, t + 0.04);
    whoosh.frequency.exponentialRampToValueAtTime(90, t + 0.55);
    wg.gain.setValueAtTime(0.5, t + 0.04);
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    whoosh.connect(wg);
    wg.connect(dest.input);
    whoosh.start(t + 0.04);
    whoosh.stop(t + 0.55);
  }

  public playSmokePop(spatial?: SpatialAudioParams) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const dest = this.createSpatialNode(ctx, spatial);
    const t = ctx.currentTime;

    // Canister pop
    const pop = ctx.createOscillator();
    const pg = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(380, t);
    pop.frequency.exponentialRampToValueAtTime(110, t + 0.07);
    pg.gain.setValueAtTime(0.4, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    pop.connect(pg);
    pg.connect(dest.input);
    pop.start(t);
    pop.stop(t + 0.07);

    // Sustained gas hiss
    if (typeof ctx.createBuffer === 'function') {
      const bufferSize = ctx.sampleRate * 0.8;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.35, t + 0.05);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      noise.connect(filter);
      filter.connect(ng);
      ng.connect(dest.input);
      noise.start(t + 0.05);
      noise.stop(t + 0.8);
    }
  }

  public playAmmoReplenish() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Crisp high-frequency metallic slide
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.06);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);

    // Mechanical chamber lock click
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(950, t + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(320, t + 0.12);
    g2.gain.setValueAtTime(0.4, t + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc2.connect(g2);
    g2.connect(this.masterGain);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.12);
  }

  public playEmptyClick() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    // Subtle dry-fire mechanical click
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.035);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.035);
  }

}

export const strikeAudio = new ProceduralAudioEngine();
