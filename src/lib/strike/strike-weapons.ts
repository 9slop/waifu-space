import { WeaponDef, WeaponId } from './strike-types';

export const WEAPON_CATALOG: Record<WeaponId, WeaponDef> = {
  rifle: {
    id: 'rifle',
    name: 'Type-89 Sakura Rifle',
    category: 'primary',
    damage: 36,
    headshotMultiplier: 3.5, // 126 damage = 1-tap headshot
    fireRateRpm: 600, // 10 rounds/sec = 100ms between shots
    magazineSize: 30,
    reserveAmmo: 90,
    reloadTimeMs: 2100,
    spreadMoving: 0.045,
    spreadStill: 0.003,
    recoilVertical: 0.024,
    recoilHorizontal: 0.012,
    isAutomatic: true,
    hasScope: false,
    scopeZoom: 1.0,
    color: '#ff6584',
    viewmodelScale: 1.0
  },
  sniper: {
    id: 'sniper',
    name: 'Aether Railgun (AWP)',
    category: 'primary',
    damage: 115,
    headshotMultiplier: 3.5, // 402 damage
    fireRateRpm: 50, // 1 shot every 1200ms
    magazineSize: 5,
    reserveAmmo: 25,
    reloadTimeMs: 3200,
    spreadMoving: 0.085,
    spreadStill: 0.0005,
    recoilVertical: 0.08,
    recoilHorizontal: 0.02,
    isAutomatic: false,
    hasScope: true,
    scopeZoom: 0.28,
    color: '#6c5ce7',
    viewmodelScale: 1.25
  },
  pistol: {
    id: 'pistol',
    name: 'Neo Deagle',
    category: 'secondary',
    damage: 52,
    headshotMultiplier: 3.0, // 156 damage
    fireRateRpm: 320, // 187ms between shots
    magazineSize: 7,
    reserveAmmo: 35,
    reloadTimeMs: 1600,
    spreadMoving: 0.025,
    spreadStill: 0.004,
    recoilVertical: 0.035,
    recoilHorizontal: 0.015,
    isAutomatic: false,
    hasScope: false,
    scopeZoom: 1.0,
    color: '#00cec9',
    viewmodelScale: 0.75
  },
  knife: {
    id: 'knife',
    name: 'Kitsune Blade',
    category: 'melee',
    damage: 65, // 130 on backstab
    headshotMultiplier: 1.5,
    fireRateRpm: 140, // 428ms between swings
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
    viewmodelScale: 0.65
  }
};

/**
 * Procedural Web Audio sound synthesizer for realistic, instantaneous gunfire and feedback.
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

  public playGunfire(weaponId: WeaponId) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;

    if (weaponId === 'knife') {
      // Whoosh sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
      return;
    }

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
    noiseGain.connect(this.masterGain);
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
    bassGain.connect(this.masterGain);
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

  public playFootstep() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }
}

export const strikeAudio = new ProceduralAudioEngine();
