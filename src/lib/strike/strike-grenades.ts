import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
  Ray,
  AbstractMesh
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
  mesh: AbstractMesh;
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
  onDamageLocalPlayer: (damage: number, sourceName: string) => void;
  onFireTick?: (damage: number) => void;
  onExplosionShake?: (trauma: number) => void;
}

export class StrikeGrenadeManager {
  private scene: Scene;
  private callbacks: StrikeGrenadeCallbacks;

  public activeProjectiles: ActiveGrenadeProjectile[] = [];
  public activeFireZones: ActiveFireZone[] = [];
  public activeSmokeClouds: ActiveSmokeCloud[] = [];
  public activeExplosions: ActiveExplosionEffect[] = [];

  // Cached materials
  private molotovMat: StandardMaterial | null = null;
  private smokeCanMat: StandardMaterial | null = null;
  private heGrenadeMat: StandardMaterial | null = null;
  private fireGroundMat: StandardMaterial | null = null;
  private smokeParticleMat: StandardMaterial | null = null;
  private explosionBlastMat: StandardMaterial | null = null;
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
        this.activeFireZones.splice(i, 1);
        continue;
      }

      // Gentle pulsating flicker
      const pulse = 1.0 + Math.sin(elapsed * 0.015) * 0.15;
      f.mesh.scaling = new Vector3(pulse, 1, pulse);

      // Damage tick check every 250ms (0.25s): 5 damage per tick (20 dmg / second)
      if (now - f.lastTickTime >= 250) {
        f.lastTickTime = now;
        const horizDist = Math.hypot(localPlayerPos.x - f.center.x, localPlayerPos.z - f.center.z);
        const vertDist = Math.abs(localPlayerPos.y - f.center.y);

        if (horizDist <= f.radius && vertDist <= 2.2) {
          // Local player is standing in fire zone!
          this.callbacks.onDamageLocalPlayer(5, 'Molotov Fire');
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
   */
  public spawnFireZone(pos: Vector3, throwerId: string): ActiveFireZone {
    const id = `fire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const radius = 4.5;

    // Flat ground fire disk
    const mesh = MeshBuilder.CreateDisc(
      id,
      { radius, tessellation: 24 },
      this.scene
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position = new Vector3(pos.x, pos.y + 0.04, pos.z);
    mesh.material = this.fireGroundMat;
    mesh.isPickable = false;

    // Glowing warm fire point light
    let light: PointLight | undefined;
    try {
      light = new PointLight(`${id}_light`, new Vector3(pos.x, pos.y + 0.5, pos.z), this.scene);
      light.diffuse = new Color3(1.0, 0.5, 0.1);
      light.intensity = 1.2;
      light.range = 8.0;
    } catch {}

    const zone: ActiveFireZone = {
      id,
      center: pos.clone(),
      radius,
      durationMs: 6000,
      spawnTime: performance.now(),
      lastTickTime: performance.now(),
      mesh,
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
    this.callbacks.onDamageLocalPlayer(damage, 'HE Grenade');
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
  }
}
