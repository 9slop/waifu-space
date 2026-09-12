import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  PointLight,
  Ray,
  AbstractMesh,
  ParticleSystem,
  Texture,
  DynamicTexture
} from '@babylonjs/core';
import { GrenadeType } from './strike-types';
import { strikeAudio } from './strike-weapons';

export interface ActiveGrenadeProjectile {
  id: string;
  type: GrenadeType;
  mesh: AbstractMesh;
  position: Vector3;
  velocity: Vector3;
  throwerId: string;
  spawnTime: number;
  fuseTimeMs: number;
  bounces: number;
}

export interface ActiveFireZone {
  id: string;
  center: Vector3;
  radius: number; // 4.5m
  durationMs: number; // 6000ms (6 seconds)
  spawnTime: number;
  lastTickTime: number;
  mesh: AbstractMesh;          // ground disc (shows fire radius)
  fireParticles?: ParticleSystem;
  smokeParticles?: ParticleSystem;
  light?: PointLight;
  throwerId: string;
}

export interface ActiveSmokeCloud {
  id: string;
  center: Vector3;
  radius: number; // 5.5m
  durationMs: number; // 16000ms (16 seconds)
  spawnTime: number;
  meshes: AbstractMesh[];
  throwerId: string;
}

export interface ActiveExplosionEffect {
  id: string;
  center: Vector3;
  spawnTime: number;
  durationMs: number;
  mesh: AbstractMesh;
  light?: PointLight;
}

export interface StrikeGrenadeCallbacks {
  onDamageLocalPlayer: (damage: number, sourceName: string, sourcePos?: { x: number; y: number; z: number }) => void;
  onFireTick?: (damage: number) => void;
  onExplosionShake?: (trauma: number) => void;
  onExplosionSlowdown?: (slowdownMult: number, durationMs: number) => void;
}

export class StrikeGrenadeManager {
  private scene: Scene;
  private callbacks: StrikeGrenadeCallbacks;

  public activeProjectiles: ActiveGrenadeProjectile[] = [];
  public activeFireZones: ActiveFireZone[] = [];
  public activeSmokeClouds: ActiveSmokeCloud[] = [];
  public activeExplosions: ActiveExplosionEffect[] = [];

  // Cached materials & procedural particle textures
  private molotovMat: StandardMaterial | null = null;
  private smokeCanMat: StandardMaterial | null = null;
  private heGrenadeMat: StandardMaterial | null = null;
  private fireGroundMat: StandardMaterial | null = null;
  private smokeParticleMat: StandardMaterial | null = null;
  private explosionBlastMat: StandardMaterial | null = null;
  private flameTex: DynamicTexture | null = null;
  private smokeTex: DynamicTexture | null = null;
  private lastLocalPlayerPos: Vector3 = Vector3.Zero();

  constructor(scene: Scene, callbacks: StrikeGrenadeCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.initMaterials();
  }

  private initMaterials() {
    // Molotov bottle (amber brown glass + flame rag wick)
    this.molotovMat = new StandardMaterial('matMolotovBottle', this.scene);
    this.molotovMat.diffuseColor = new Color3(0.75, 0.4, 0.15);
    this.molotovMat.emissiveColor = new Color3(0.4, 0.15, 0.05);

    // Smoke canister (tactical olive green + white band)
    this.smokeCanMat = new StandardMaterial('matSmokeCanister', this.scene);
    this.smokeCanMat.diffuseColor = new Color3(0.35, 0.42, 0.35);
    this.smokeCanMat.emissiveColor = new Color3(0.1, 0.12, 0.1);

    // HE grenade (dark metallic steel + warning yellow stripe)
    this.heGrenadeMat = new StandardMaterial('matHeGrenade', this.scene);
    this.heGrenadeMat.diffuseColor = new Color3(0.2, 0.22, 0.2);
    this.heGrenadeMat.emissiveColor = new Color3(0.15, 0.12, 0.04);

    // Ground Fire Zone material (glowing molten lava/fire texture)
    this.fireGroundMat = new StandardMaterial('matFireGround', this.scene);
    this.fireGroundMat.diffuseColor = new Color3(1.0, 0.45, 0.1);
    this.fireGroundMat.emissiveColor = new Color3(1.2, 0.5, 0.1);
    this.fireGroundMat.alpha = 0.85;
    this.fireGroundMat.disableLighting = true;

    // Volumetric billowy smoke material (soft dense cloud)
    this.smokeParticleMat = new StandardMaterial('matSmokePuff', this.scene);
    this.smokeParticleMat.diffuseColor = new Color3(0.85, 0.88, 0.92);
    this.smokeParticleMat.emissiveColor = new Color3(0.18, 0.2, 0.22);
    this.smokeParticleMat.alpha = 0.86;
    this.smokeParticleMat.backFaceCulling = false;

    // HE Explosion flash sphere
    this.explosionBlastMat = new StandardMaterial('matExplosionBlast', this.scene);
    this.explosionBlastMat.diffuseColor = new Color3(1.0, 0.8, 0.2);
    this.explosionBlastMat.emissiveColor = new Color3(1.5, 0.9, 0.3);
    this.explosionBlastMat.alpha = 0.9;
    this.explosionBlastMat.disableLighting = true;

    // Procedural Molotov Flame Texture (soft feathered radial fire sprite)
    try {
      this.flameTex = new DynamicTexture('strikeFlameTex', 64, this.scene, false);
      const ctx = this.flameTex.getContext() as CanvasRenderingContext2D;
      if (ctx) {
        ctx.clearRect(0, 0, 64, 64);
        const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
        g.addColorStop(0.0, 'rgba(255, 255, 220, 1.0)');
        g.addColorStop(0.25, 'rgba(255, 190, 40, 0.95)');
        g.addColorStop(0.55, 'rgba(255, 90, 15, 0.7)');
        g.addColorStop(0.82, 'rgba(200, 30, 5, 0.3)');
        g.addColorStop(1.0, 'rgba(120, 10, 0, 0.0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        this.flameTex.hasAlpha = true;
        this.flameTex.update();
      }
    } catch {}

    // Procedural Molotov Smoke Texture (soft cloud puff sprite)
    try {
      this.smokeTex = new DynamicTexture('strikeSmokeTex', 64, this.scene, false);
      const ctx = this.smokeTex.getContext() as CanvasRenderingContext2D;
      if (ctx) {
        ctx.clearRect(0, 0, 64, 64);
        const g = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
        g.addColorStop(0.0, 'rgba(55, 50, 48, 0.75)');
        g.addColorStop(0.35, 'rgba(65, 60, 58, 0.55)');
        g.addColorStop(0.7, 'rgba(50, 45, 45, 0.25)');
        g.addColorStop(1.0, 'rgba(40, 35, 35, 0.0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        this.smokeTex.hasAlpha = true;
        this.smokeTex.update();
      }
    } catch {}
  }

  /**
   * Spawns a thrown grenade projectile with initial velocity and trajectory.
   */
  public throwGrenade(
    type: GrenadeType,
    origin: Vector3,
    velocity: Vector3,
    throwerId: string
  ): ActiveGrenadeProjectile {
    const id = `grenade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Create 3D projectile mesh
    let mesh: AbstractMesh;
    if (type === 'molotov') {
      mesh = MeshBuilder.CreateCylinder(id, { height: 0.26, diameter: 0.08 }, this.scene);
      mesh.material = this.molotovMat;
    } else if (type === 'smoke') {
      mesh = MeshBuilder.CreateCylinder(id, { height: 0.2, diameter: 0.09 }, this.scene);
      mesh.material = this.smokeCanMat;
    } else {
      mesh = MeshBuilder.CreateSphere(id, { diameter: 0.12 }, this.scene);
      mesh.material = this.heGrenadeMat;
    }

    mesh.position = origin.clone();
    mesh.isPickable = false;

    // Fuse timers:
    // Molotov: 0 (detonates immediately on ground contact)
    // Smoke: 1500ms (1.5s fuse)
    // HE: 1800ms (1.8s fuse)
    const fuseTimeMs = type === 'molotov' ? 0 : type === 'smoke' ? 1500 : 1800;

    const proj: ActiveGrenadeProjectile = {
      id,
      type,
      mesh,
      position: origin.clone(),
      velocity: velocity.clone(),
      throwerId,
      spawnTime: performance.now(),
      fuseTimeMs,
      bounces: 0
    };

    this.activeProjectiles.push(proj);
    strikeAudio.playGrenadePin();

    return proj;
  }

  /**
   * Updates all active grenade projectiles, fire zones, smoke screens, and explosion FX.
   */
  public update(dt: number, localPlayerPos: Vector3) {
    this.lastLocalPlayerPos = localPlayerPos.clone();
    const now = performance.now();

    // 1. Update Projectiles in flight
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      const elapsed = now - p.spawnTime;

      // Gravity & Air Drag
      p.velocity.y -= 18.0 * dt; // Gravity
      p.velocity.x *= Math.max(0, 1 - 0.25 * dt);
      p.velocity.z *= Math.max(0, 1 - 0.25 * dt);

      const step = p.velocity.scale(dt);
      const stepLen = step.length();

      if (stepLen > 0.001) {
        const ray = new Ray(p.position, step.clone().normalize(), stepLen + 0.1);
        const hit = this.scene.pickWithRay(ray, (m) => {
          return (
            m.isPickable &&
            !m.name.startsWith('grenade') &&
            !m.name.startsWith('Viewmodel') &&
            !m.name.startsWith('FirstPerson') &&
            !m.name.startsWith('playerCollider') &&
            !m.name.startsWith('hitbox')
          );
        });

        if (hit && hit.hit && hit.pickedPoint) {
          p.bounces++;
          const normal = hit.getNormal(true) || Vector3.Up();

          if (p.type === 'molotov') {
            // Molotov explodes immediately on impact with ground or wall!
            this.detonateGrenade(p, hit.pickedPoint);
            p.mesh.dispose();
            this.activeProjectiles.splice(i, 1);
            continue;
          }

          // Bounce reflection: v' = (v - 2*(v·n)*n) * restitution
          const dot = Vector3.Dot(p.velocity, normal);
          const reflected = p.velocity.subtract(normal.scale(2 * dot)).scale(0.48);
          p.velocity = reflected;
          p.position = hit.pickedPoint.add(normal.scale(0.06));

          strikeAudio.playGrenadeBounce({
            sourcePosition: { x: p.position.x, y: p.position.y, z: p.position.z },
            listenerPosition: { x: localPlayerPos.x, y: localPlayerPos.y, z: localPlayerPos.z }
          });
        } else {
          p.position.addInPlace(step);
        }
      }

      p.mesh.position = p.position.clone();
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.z += dt * 6;

      // Fuse timeout detonation check for HE and Smoke
      if (p.fuseTimeMs > 0 && elapsed >= p.fuseTimeMs) {
        this.detonateGrenade(p, p.position);
        p.mesh.dispose();
        this.activeProjectiles.splice(i, 1);
      }
    }

    // 2. Update Active Fire Zones (Molotov: 5 damage per 0.25s for 6s)
    for (let i = this.activeFireZones.length - 1; i >= 0; i--) {
      const f = this.activeFireZones[i];
      const elapsed = now - f.spawnTime;

      if (elapsed >= f.durationMs) {
        f.mesh.dispose();
        f.light?.dispose();
        f.fireParticles?.stop();
        f.fireParticles?.dispose();
        f.smokeParticles?.stop();
        f.smokeParticles?.dispose();
        this.activeFireZones.splice(i, 1);
        continue;
      }

      // Gentle pulsating flicker on the ground disc
      const pulse = 1.0 + Math.sin(elapsed * 0.015) * 0.15;
      f.mesh.scaling = new Vector3(pulse, 1, pulse);

      // Flicker the fire point light for a dynamic flame effect
      if (f.light) {
        f.light.intensity = 1.2 + Math.sin(elapsed * 0.028) * 0.4 + (Math.random() - 0.5) * 0.25;
      }

      // Damage tick check every 250ms (0.25s): 5 damage per tick (20 dmg / second)
      if (now - f.lastTickTime >= 250) {
        f.lastTickTime = now;
        const horizDist = Math.hypot(localPlayerPos.x - f.center.x, localPlayerPos.z - f.center.z);
        const vertDist = Math.abs(localPlayerPos.y - f.center.y);

        if (horizDist <= f.radius && vertDist <= 2.2) {
          // Local player is standing in fire zone!
          this.callbacks.onDamageLocalPlayer(5, 'Molotov Fire', { x: f.center.x, y: f.center.y, z: f.center.z });
          this.callbacks.onFireTick?.(5);
        }
      }
    }

    // 3. Update Active Smoke Clouds (16 seconds duration)
    for (let i = this.activeSmokeClouds.length - 1; i >= 0; i--) {
      const s = this.activeSmokeClouds[i];

      if (now - s.spawnTime >= s.durationMs) {
        for (const m of s.meshes) m.dispose();
        this.activeSmokeClouds.splice(i, 1);
        continue;
      }

      const lifeRatio = (now - s.spawnTime) / s.durationMs;
      // Gentle swirling billow expansion
      const scale = Math.min(1.0, lifeRatio * 4.0); // Expands to full volume within first 4 seconds
      const fade = lifeRatio > 0.85 ? (1.0 - lifeRatio) / 0.15 : 1.0; // Dissipates in final 15%

      for (let j = 0; j < s.meshes.length; j++) {
        const m = s.meshes[j];
        m.scaling = new Vector3(scale, scale * 0.85, scale);
        m.rotation.y += dt * (0.05 * (j % 2 === 0 ? 1 : -1));
        if (m.material && m.material instanceof StandardMaterial) {
          m.material.alpha = 0.86 * fade;
        }
      }
    }

    // 4. Update Explosion Effects (HE blast flash)
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const exp = this.activeExplosions[i];
      const elapsed = now - exp.spawnTime;

      if (elapsed >= exp.durationMs) {
        exp.mesh.dispose();
        exp.light?.dispose();
        this.activeExplosions.splice(i, 1);
        continue;
      }

      const t = elapsed / exp.durationMs;
      const s = 1.0 + t * 4.5;
      exp.mesh.scaling = new Vector3(s, s, s);
      if (exp.mesh.material && exp.mesh.material instanceof StandardMaterial) {
        exp.mesh.material.alpha = Math.max(0, 0.9 * (1.0 - t));
      }
      if (exp.light) {
        exp.light.intensity = Math.max(0, 3.5 * (1.0 - t));
      }
    }
  }

  /**
   * Detonates a grenade projectile at the given position.
   */
  public detonateGrenade(projectile: ActiveGrenadeProjectile, pos: Vector3) {
    if (projectile.type === 'molotov') {
      this.spawnFireZone(pos, projectile.throwerId);
    } else if (projectile.type === 'smoke') {
      this.spawnSmokeCloud(pos, projectile.throwerId);
    } else if (projectile.type === 'he') {
      this.spawnExplosion(pos, projectile.throwerId);
      this.applyExplosionDamageToPlayer(pos, this.lastLocalPlayerPos);
    }
  }

  /**
   * Spawns a Molotov Fire Zone (4.5m radius, 6s duration, 5 damage per 0.25s).
   * Uses a Babylon.js ParticleSystem to produce realistic rising flames and smoke.
   */
  public spawnFireZone(pos: Vector3, throwerId: string): ActiveFireZone {
    const id = `fire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const radius = 4.5;

    // Ground fire disc — faint emissive glow to mark the fire radius
    const mesh = MeshBuilder.CreateDisc(
      id,
      { radius, tessellation: 24 },
      this.scene
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position = new Vector3(pos.x, pos.y + 0.04, pos.z);
    mesh.material = this.fireGroundMat;
    mesh.isPickable = false;

    // ── Fire Particle System ─────────────────────────────────────────────────
    let fireParticles: ParticleSystem | undefined;
    try {
      fireParticles = new ParticleSystem(`${id}_fire`, 300, this.scene);
      if (this.flameTex) {
        fireParticles.particleTexture = this.flameTex;
      }
      fireParticles.emitter = new Vector3(pos.x, pos.y + 0.05, pos.z);
      // Spread across the fire disc area
      fireParticles.minEmitBox = new Vector3(-radius * 0.55, 0, -radius * 0.55);
      fireParticles.maxEmitBox = new Vector3(radius * 0.55, 0, radius * 0.55);
      // Upward with slight outward wobble
      fireParticles.direction1 = new Vector3(-0.4, 5, -0.4);
      fireParticles.direction2 = new Vector3(0.4, 8, 0.4);
      fireParticles.minLifeTime = 0.5;
      fireParticles.maxLifeTime = 1.1;
      fireParticles.emitRate = 140;
      fireParticles.minSize = 0.5;
      fireParticles.maxSize = 1.4;
      fireParticles.minEmitPower = 0.6;
      fireParticles.maxEmitPower = 1.4;
      // Fire color: bright yellow core → orange → deep red at end
      fireParticles.addColorGradient(0.0, new Color4(1.0, 0.95, 0.35, 0.9));
      fireParticles.addColorGradient(0.35, new Color4(1.0, 0.55, 0.1, 0.8));
      fireParticles.addColorGradient(0.7, new Color4(0.9, 0.2, 0.05, 0.5));
      fireParticles.addColorGradient(1.0, new Color4(0.4, 0.08, 0.02, 0.0));
      fireParticles.gravity = new Vector3(0, -1.5, 0);
      fireParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
      fireParticles.renderingGroupId = 1;
      fireParticles.start();
    } catch { /* fallback: particles unavailable (test env) */ }

    // ── Smoke Particle System ────────────────────────────────────────────────
    let smokeParticles: ParticleSystem | undefined;
    try {
      smokeParticles = new ParticleSystem(`${id}_smoke`, 80, this.scene);
      if (this.smokeTex) {
        smokeParticles.particleTexture = this.smokeTex;
      }
      smokeParticles.emitter = new Vector3(pos.x, pos.y + 1.5, pos.z);
      smokeParticles.minEmitBox = new Vector3(-radius * 0.3, 0, -radius * 0.3);
      smokeParticles.maxEmitBox = new Vector3(radius * 0.3, 0, radius * 0.3);
      smokeParticles.direction1 = new Vector3(-0.5, 3, -0.5);
      smokeParticles.direction2 = new Vector3(0.5, 5.5, 0.5);
      smokeParticles.minLifeTime = 1.5;
      smokeParticles.maxLifeTime = 3.0;
      smokeParticles.emitRate = 28;
      smokeParticles.minSize = 1.2;
      smokeParticles.maxSize = 2.8;
      smokeParticles.minEmitPower = 0.3;
      smokeParticles.maxEmitPower = 0.8;
      // Dark smoky grey, fading out
      smokeParticles.addColorGradient(0.0, new Color4(0.22, 0.18, 0.14, 0.0));
      smokeParticles.addColorGradient(0.2, new Color4(0.22, 0.18, 0.14, 0.55));
      smokeParticles.addColorGradient(0.7, new Color4(0.18, 0.15, 0.12, 0.35));
      smokeParticles.addColorGradient(1.0, new Color4(0.12, 0.10, 0.09, 0.0));
      smokeParticles.gravity = new Vector3(0, -0.3, 0);
      smokeParticles.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      smokeParticles.renderingGroupId = 1;
      smokeParticles.start();
    } catch { /* fallback */ }

    // Glowing warm fire point light (flicker updated in update loop)
    let light: PointLight | undefined;
    try {
      light = new PointLight(`${id}_light`, new Vector3(pos.x, pos.y + 1.0, pos.z), this.scene);
      light.diffuse = new Color3(1.0, 0.45, 0.08);
      light.intensity = 1.4;
      light.range = 10.0;
    } catch {}

    const zone: ActiveFireZone = {
      id,
      center: pos.clone(),
      radius,
      durationMs: 6000,
      spawnTime: performance.now(),
      lastTickTime: performance.now(),
      mesh,
      fireParticles,
      smokeParticles,
      light,
      throwerId
    };

    this.activeFireZones.push(zone);
    strikeAudio.playFireIgnite({
      sourcePosition: { x: pos.x, y: pos.y, z: pos.z }
    });

    return zone;
  }

  /**
   * Spawns a dense expanding Smoke Cloud (5.5m radius, 16s duration).
   */
  public spawnSmokeCloud(pos: Vector3, throwerId: string): ActiveSmokeCloud {
    const id = `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const radius = 5.5;
    const meshes: AbstractMesh[] = [];

    // Cluster of 6 overlapping billowy spheres to create an organic volumetric cloud
    const offsets = [
      new Vector3(0, 1.4, 0),
      new Vector3(1.8, 1.2, 1.2),
      new Vector3(-1.8, 1.2, -1.2),
      new Vector3(1.5, 1.6, -1.5),
      new Vector3(-1.5, 1.6, 1.5),
      new Vector3(0, 2.2, 0)
    ];

    for (let i = 0; i < offsets.length; i++) {
      const puff = MeshBuilder.CreateSphere(
        `${id}_puff_${i}`,
        { diameter: radius * 1.05, segments: 8 },
        this.scene
      );
      puff.position = pos.add(offsets[i]);
      puff.material = this.smokeParticleMat;
      puff.isPickable = false;
      meshes.push(puff);
    }

    const cloud: ActiveSmokeCloud = {
      id,
      center: pos.clone(),
      radius,
      durationMs: 16000,
      spawnTime: performance.now(),
      meshes,
      throwerId
    };

    this.activeSmokeClouds.push(cloud);
    strikeAudio.playSmokePop({
      sourcePosition: { x: pos.x, y: pos.y, z: pos.z }
    });

    return cloud;
  }

  /**
   * Detonates an HE Explosive Grenade (100 damage at epicenter with falloff up to 6.5m).
   */
  public spawnExplosion(pos: Vector3, throwerId: string): ActiveExplosionEffect {
    const id = `he_blast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const blastRadius = 6.5;

    // Expanding fireball mesh
    const blastMesh = MeshBuilder.CreateSphere(id, { diameter: 2.2, segments: 12 }, this.scene);
    blastMesh.position = pos.clone();
    blastMesh.material = this.explosionBlastMat;
    blastMesh.isPickable = false;

    let light: PointLight | undefined;
    try {
      light = new PointLight(`${id}_light`, pos.clone(), this.scene);
      light.diffuse = new Color3(1.0, 0.85, 0.4);
      light.intensity = 3.5;
      light.range = 14.0;
    } catch {}

    const effect: ActiveExplosionEffect = {
      id,
      center: pos.clone(),
      spawnTime: performance.now(),
      durationMs: 400,
      mesh: blastMesh,
      light
    };

    this.activeExplosions.push(effect);
    strikeAudio.playExplosion({
      sourcePosition: { x: pos.x, y: pos.y, z: pos.z }
    });

    return effect;
  }

  /**
   * Applies explosive blast damage to local player if in range (100 at center with falloff up to 6.5m).
   */
  public applyExplosionDamageToPlayer(explosionPos: Vector3, playerPos: Vector3) {
    const blastRadius = 6.5;
    const dist = Vector3.Distance(explosionPos, playerPos);

    if (dist > blastRadius) return;

    // Check line of sight: do thick walls block the blast?
    const diff = playerPos.subtract(explosionPos);
    const dir = diff.normalize();
    const ray = new Ray(explosionPos, dir, dist);

    const hit = this.scene.pickWithRay(ray, (m) => {
      return (
        m.isPickable &&
        !m.name.startsWith('grenade') &&
        !m.name.startsWith('smoke') &&
        !m.name.startsWith('fire') &&
        !m.name.startsWith('Viewmodel') &&
        !m.name.startsWith('FirstPerson') &&
        !m.name.startsWith('playerCollider') &&
        !m.name.startsWith('hitbox')
      );
    });

    // If a solid wall is closer than player position, blast is obstructed
    if (hit && hit.hit && hit.distance < dist - 0.45) {
      return;
    }

    // Damage falloff: Exactly 100 at center (dist = 0), dropping to 0 at 6.5m
    const rawDamage = Math.round(100 * (1 - dist / blastRadius));
    const damage = Math.max(1, rawDamage);

    // Screen shake / trauma proportional to proximity
    const trauma = Math.min(1.0, 1.2 * (1 - dist / blastRadius));
    this.callbacks.onExplosionShake?.(trauma);
    // Concussive movement speed penalty from explosive blast shockwave (45% speed, smoothly recovering over 1.8s)
    this.callbacks.onExplosionSlowdown?.(0.45, 1800);
    this.callbacks.onDamageLocalPlayer(damage, 'HE Grenade', { x: explosionPos.x, y: explosionPos.y, z: explosionPos.z });
  }

  /**
   * Returns true if the given position is inside an active smoke screen cloud.
   */
  public isPositionInSmoke(pos: Vector3): boolean {
    for (const s of this.activeSmokeClouds) {
      const dist = Vector3.Distance(pos, s.center);
      if (dist <= s.radius) {
        return true;
      }
    }
    return false;
  }

  public dispose() {
    for (const p of this.activeProjectiles) p.mesh.dispose();
    this.activeProjectiles = [];

    for (const f of this.activeFireZones) {
      f.mesh.dispose();
      f.light?.dispose();
      f.fireParticles?.stop();
      f.fireParticles?.dispose();
      f.smokeParticles?.stop();
      f.smokeParticles?.dispose();
    }
    this.activeFireZones = [];

    for (const s of this.activeSmokeClouds) {
      for (const m of s.meshes) m.dispose();
    }
    this.activeSmokeClouds = [];

    for (const e of this.activeExplosions) {
      e.mesh.dispose();
      e.light?.dispose();
    }
    this.activeExplosions = [];

    this.molotovMat?.dispose();
    this.smokeCanMat?.dispose();
    this.heGrenadeMat?.dispose();
    this.fireGroundMat?.dispose();
    this.smokeParticleMat?.dispose();
    this.explosionBlastMat?.dispose();
    this.flameTex?.dispose();
    this.smokeTex?.dispose();
    this.flameTex = null;
    this.smokeTex = null;
  }
}
