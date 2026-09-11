import * as THREE from 'three';
import {
  WeaponId,
  WeaponDef,
  Vector3D,
  HitscanRay,
  HitscanHitResult,
  INPUT_BUTTONS,
  PlayerInput
} from './strike-types';
import { WEAPON_CATALOG, strikeAudio } from './strike-weapons';
import { createCyberShrineMap, resolveMovementCollision, MapCollider, MapSpawnPoint } from './strike-map';
import { FirstPersonViewmodel, ThirdPersonAvatarModel } from './strike-avatars';

export interface StrikeEngineCallbacks {
  onHealthChange: (hp: number, maxHp: number) => void;
  onAmmoChange: (mag: number, reserve: number) => void;
  onWeaponChange: (weapon: WeaponDef) => void;
  onHitmarker: (isHeadshot: boolean, damage: number) => void;
  onLocalShoot: (ray: HitscanRay, isHeadshot: boolean, targetId: number | null) => void;
  onKillAnnouncement: (text: string) => void;
  onScoreboardToggle: (visible: boolean) => void;
}

export class StrikeEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer | null = null;
  public container: HTMLElement | null = null;

  // Map & Physics
  public colliders: MapCollider[] = [];
  public spawnPoints: MapSpawnPoint[] = [];
  public botWaypoints: Vector3D[] = [];

  // Local Player Physics State
  public position = new THREE.Vector3(0, 0.1, 20);
  public velocity = new THREE.Vector3(0, 0, 0);
  public yaw = 0;
  public pitch = 0;
  public onGround = true;
  public isCrouching = false;
  public isWalking = false;
  public currentEyeHeight = 1.62;

  // Weapon State
  public activeWeaponId: WeaponId = 'rifle';
  public ammoMag: Record<WeaponId, number> = {
    rifle: 30,
    sniper: 5,
    pistol: 7,
    knife: 1
  };
  public ammoReserve: Record<WeaponId, number> = {
    rifle: 90,
    sniper: 25,
    pistol: 35,
    knife: 1
  };
  public isReloading = false;
  public isScoped = false;
  public lastShotTime = 0;
  public reloadEndTime = 0;
  public currentSpread = 0.003;
  public recoilSpreadX = 0;
  public recoilSpreadY = 0;

  // Local Stats
  public health = 100;
  public maxHealth = 100;
  public isDead = false;

  // Input State
  private keysDown: Record<string, boolean> = {};
  private mouseButtons: Record<number, boolean> = {};
  public mouseSensitivity = 0.0022;
  public fov = 85;

  // Viewmodel & Rendering
  private viewmodel: FirstPersonViewmodel;
  public remoteAvatars: Map<number, ThirdPersonAvatarModel> = new Map();
  private tracersGroup: THREE.Group;

  private isPointerLocked = false;
  private animFrameId: number | null = null;
  private lastFrameTime = 0;
  private currentTick = 0;

  private callbacks: StrikeEngineCallbacks;

  constructor(callbacks: StrikeEngineCallbacks) {
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f141d);
    this.scene.fog = new THREE.FogExp2(0x0f141d, 0.015);

    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.05, 300);

    this.viewmodel = new FirstPersonViewmodel();
    this.camera.add(this.viewmodel.root);
    this.scene.add(this.camera);

    this.tracersGroup = new THREE.Group();
    this.scene.add(this.tracersGroup);

    // Build Map
    const mapData = createCyberShrineMap();
    this.scene.add(mapData.sceneGroup);
    this.colliders = mapData.colliders;
    this.spawnPoints = mapData.spawnPoints;
    this.botWaypoints = mapData.botWaypoints;

    this.respawnLocalPlayer();
  }

  public init(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.setupInputListeners(this.renderer.domElement);

    this.callbacks.onHealthChange(this.health, this.maxHealth);
    this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
    this.callbacks.onWeaponChange(WEAPON_CATALOG[this.activeWeaponId]);

    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.renderer && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      this.renderer.dispose();
      this.renderer = null;
    }
    this.remoteAvatars.forEach(av => {
      this.scene.remove(av.root);
    });
    this.remoteAvatars.clear();
  }

  public requestPointerLock() {
    if (this.renderer) {
      this.renderer.domElement.requestPointerLock?.();
    }
  }

  private setupInputListeners(canvas: HTMLCanvasElement) {
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });

    window.addEventListener('keydown', e => {
      this.keysDown[e.code] = true;
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'Digit1') this.switchWeapon('rifle');
      if (e.code === 'Digit2') this.switchWeapon('sniper');
      if (e.code === 'Digit3') this.switchWeapon('pistol');
      if (e.code === 'Digit4') this.switchWeapon('knife');
      if (e.code === 'Tab') {
        e.preventDefault();
        this.callbacks.onScoreboardToggle(true);
      }
    });

    window.addEventListener('keyup', e => {
      this.keysDown[e.code] = false;
      if (e.code === 'Tab') {
        this.callbacks.onScoreboardToggle(false);
      }
    });

    window.addEventListener('mousemove', e => {
      if (!this.isPointerLocked) return;
      this.yaw -= e.movementX * this.mouseSensitivity;
      this.pitch -= e.movementY * this.mouseSensitivity;

      // Clamp pitch to [-89 deg, 89 deg]
      const maxPitch = (89 * Math.PI) / 180;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });

    window.addEventListener('mousedown', e => {
      if (!this.isPointerLocked) {
        this.requestPointerLock();
        return;
      }
      this.mouseButtons[e.button] = true;
      if (e.button === 2) {
        // Right click: Scope toggle for sniper
        this.toggleScope();
      }
    });

    window.addEventListener('mouseup', e => {
      this.mouseButtons[e.button] = false;
    });

    window.addEventListener('contextmenu', e => e.preventDefault());
  }

  public respawnLocalPlayer() {
    const idx = Math.floor(Math.random() * this.spawnPoints.length);
    const sp = this.spawnPoints[idx] || { position: { x: 0, y: 0.1, z: 20 }, yaw: 0 };

    this.position.set(sp.position.x, sp.position.y + 0.1, sp.position.z);
    this.velocity.set(0, 0, 0);
    this.yaw = sp.yaw;
    this.pitch = 0;
    this.health = 100;
    this.isDead = false;
    this.isScoped = false;
    this.isReloading = false;

    // Replenish ammo
    this.ammoMag = { rifle: 30, sniper: 5, pistol: 7, knife: 1 };
    this.ammoReserve = { rifle: 90, sniper: 25, pistol: 35, knife: 1 };

    this.callbacks.onHealthChange(this.health, this.maxHealth);
    this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
  }

  public switchWeapon(id: WeaponId) {
    if (this.activeWeaponId === id || this.isDead) return;
    this.activeWeaponId = id;
    this.isReloading = false;
    this.isScoped = false;
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    this.viewmodel.setWeapon(id);
    this.callbacks.onWeaponChange(WEAPON_CATALOG[id]);
    this.callbacks.onAmmoChange(this.ammoMag[id], this.ammoReserve[id]);
  }

  public toggleScope() {
    const def = WEAPON_CATALOG[this.activeWeaponId];
    if (!def.hasScope) return;
    this.isScoped = !this.isScoped;
    this.camera.fov = this.isScoped ? this.fov * def.scopeZoom : this.fov;
    this.camera.updateProjectionMatrix();
  }

  public reload() {
    if (this.isReloading || this.isDead) return;
    const def = WEAPON_CATALOG[this.activeWeaponId];
    const needed = def.magazineSize - this.ammoMag[this.activeWeaponId];
    if (needed <= 0 || this.ammoReserve[this.activeWeaponId] <= 0) return;

    this.isReloading = true;
    this.reloadEndTime = performance.now() + def.reloadTimeMs;
    this.viewmodel.triggerReload(def.reloadTimeMs);
    strikeAudio.playReload();
  }

  private shoot() {
    if (this.isDead || this.isReloading) return;
    const now = performance.now();
    const def = WEAPON_CATALOG[this.activeWeaponId];
    const shotCooldown = (60 / def.fireRateRpm) * 1000;

    if (now - this.lastShotTime < shotCooldown) return;

    if (this.activeWeaponId !== 'knife' && this.ammoMag[this.activeWeaponId] <= 0) {
      this.reload();
      return;
    }

    this.lastShotTime = now;
    if (this.activeWeaponId !== 'knife') {
      this.ammoMag[this.activeWeaponId]--;
      this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
    }

    // Audio and Recoil kick
    strikeAudio.playGunfire(this.activeWeaponId);
    this.viewmodel.triggerRecoil(def.recoilVertical, def.recoilHorizontal);

    // Apply pitch kick to camera
    this.pitch += def.recoilVertical * 0.4;
    this.yaw += (Math.random() - 0.5) * def.recoilHorizontal;

    // Calculate spread
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const baseSpread = speed > 1.0 ? def.spreadMoving : def.spreadStill;
    const spreadMultiplier = this.isScoped ? 0.3 : this.isCrouching ? 0.6 : 1.0;
    const effectiveSpread = baseSpread * spreadMultiplier;

    // Bullet direction with spread
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const spreadX = (Math.random() - 0.5) * 2 * effectiveSpread;
    const spreadY = (Math.random() - 0.5) * 2 * effectiveSpread;
    forward.addScaledVector(right, spreadX);
    forward.addScaledVector(up, spreadY);
    forward.normalize();

    const rayOrigin = this.camera.position.clone();
    const hitResult = this.castHitscan(rayOrigin, forward, 250);

    // Spawn tracer visual
    this.createTracer(rayOrigin, hitResult.point, def.color);

    if (hitResult.hit && hitResult.targetId !== null) {
      strikeAudio.playHitmarker(hitResult.isHeadshot);
      this.callbacks.onHitmarker(hitResult.isHeadshot, hitResult.damage);
    }

    this.callbacks.onLocalShoot(
      {
        origin: { x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z },
        direction: { x: forward.x, y: forward.y, z: forward.z },
        maxDistance: 250,
        shooterId: 0,
        weaponId: this.activeWeaponId
      },
      hitResult.isHeadshot,
      hitResult.targetId
    );
  }

  private castHitscan(origin: THREE.Vector3, direction: THREE.Vector3, maxDist: number): HitscanHitResult {
    let closestDist = maxDist;
    let hitPoint = origin.clone().addScaledVector(direction, maxDist);
    let hitNormal = new THREE.Vector3(0, 1, 0);
    let targetId: number | null = null;
    let isHeadshot = false;

    // 1. Check map colliders (walls and crates)
    const ray = new THREE.Ray(origin, direction);
    const box = new THREE.Box3();
    const targetVec = new THREE.Vector3();

    for (const c of this.colliders) {
      box.min.set(c.min.x, c.min.y, c.min.z);
      box.max.set(c.max.x, c.max.y, c.max.z);

      const hit = ray.intersectBox(box, targetVec);
      if (hit) {
        const dist = origin.distanceTo(targetVec);
        if (dist < closestDist) {
          closestDist = dist;
          hitPoint.copy(targetVec);
          targetId = null;
        }
      }
    }

    // 2. Check remote players / bots hitboxes
    const def = WEAPON_CATALOG[this.activeWeaponId];
    for (const [id, avatar] of this.remoteAvatars.entries()) {
      // Head sphere check
      const headCenter = new THREE.Vector3();
      avatar.headMesh.getWorldPosition(headCenter);
      const headDist = ray.distanceToPoint(headCenter);

      if (headDist <= 0.28) {
        const d = origin.distanceTo(headCenter);
        if (d < closestDist) {
          closestDist = d;
          hitPoint.copy(headCenter);
          targetId = id;
          isHeadshot = true;
        }
      }

      // Body box check
      const bodyCenter = new THREE.Vector3();
      avatar.bodyMesh.getWorldPosition(bodyCenter);
      const bodyDist = ray.distanceToPoint(bodyCenter);
      if (bodyDist <= 0.45) {
        const d = origin.distanceTo(bodyCenter);
        if (d < closestDist) {
          closestDist = d;
          hitPoint.copy(bodyCenter);
          targetId = id;
          isHeadshot = false;
        }
      }
    }

    const mult = isHeadshot ? def.headshotMultiplier : 1.0;
    const damage = Math.round(def.damage * mult);

    return {
      hit: closestDist < maxDist,
      point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
      normal: { x: hitNormal.x, y: hitNormal.y, z: hitNormal.z },
      targetId,
      isHeadshot,
      damage
    };
  }

  private createTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex: string) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      start.clone().add(new THREE.Vector3(0, -0.1, 0)),
      new THREE.Vector3(end.x, end.y, end.z)
    ]);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(colorHex), linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    this.tracersGroup.add(line);

    setTimeout(() => {
      this.tracersGroup.remove(line);
      geo.dispose();
      mat.dispose();
    }, 65);
  }

  public applyDamage(dmg: number, attackerName: string) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - dmg);
    this.callbacks.onHealthChange(this.health, this.maxHealth);

    if (this.health <= 0) {
      this.isDead = true;
      this.callbacks.onKillAnnouncement(`Killed by ${attackerName}!`);
      setTimeout(() => {
        this.respawnLocalPlayer();
      }, 2500);
    }
  }

  private updateMovement(dt: number) {
    if (this.isDead) return;

    this.isCrouching = !!this.keysDown['KeyC'] || !!this.keysDown['ControlLeft'];
    this.isWalking = !!this.keysDown['ShiftLeft'] || !!this.keysDown['ShiftRight'];

    // Smooth crouch eye height
    const targetHeight = this.isCrouching ? 1.05 : 1.62;
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetHeight, dt * 12);

    // Compute intended movement vector
    const moveVector = new THREE.Vector3();
    if (this.keysDown['KeyW']) moveVector.z -= 1;
    if (this.keysDown['KeyS']) moveVector.z += 1;
    if (this.keysDown['KeyA']) moveVector.x -= 1;
    if (this.keysDown['KeyD']) moveVector.x += 1;

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize();
      moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    }

    // Speeds in m/s
    const def = WEAPON_CATALOG[this.activeWeaponId];
    let maxSpeed = 7.2;
    if (def.id === 'knife') maxSpeed = 7.6;
    if (def.id === 'sniper') maxSpeed = 6.2;
    if (this.isCrouching) maxSpeed *= 0.45;
    else if (this.isWalking) maxSpeed *= 0.55;

    // Ground vs Air acceleration
    const accel = this.onGround ? 65 : 14;
    const friction = 7.0;

    if (this.onGround) {
      // Friction
      const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (hSpeed > 0) {
        const drop = hSpeed * friction * dt;
        const newSpeed = Math.max(0, hSpeed - drop);
        this.velocity.x *= newSpeed / hSpeed;
        this.velocity.z *= newSpeed / hSpeed;
      }

      // Acceleration
      this.velocity.x += moveVector.x * accel * dt;
      this.velocity.z += moveVector.z * accel * dt;

      // Clamp max horizontal speed
      const curSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (curSpeed > maxSpeed) {
        this.velocity.x = (this.velocity.x / curSpeed) * maxSpeed;
        this.velocity.z = (this.velocity.z / curSpeed) * maxSpeed;
      }

      // Jump
      if (this.keysDown['Space']) {
        this.velocity.y = 6.2;
        this.onGround = false;
      }
    } else {
      // Air strafing
      this.velocity.x += moveVector.x * accel * dt;
      this.velocity.z += moveVector.z * accel * dt;
      this.velocity.y -= 20.0 * dt; // Gravity
    }

    // Resolve collision with map geometry
    const resolved = resolveMovementCollision(
      { x: this.position.x, y: this.position.y, z: this.position.z },
      { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt },
      0.4,
      targetHeight,
      this.colliders
    );

    this.position.set(resolved.position.x, resolved.position.y, resolved.position.z);
    this.velocity.set(resolved.velocity.x / dt, resolved.velocity.y / dt, resolved.velocity.z / dt);
    this.onGround = resolved.onGround;

    // Update Camera
    this.camera.position.set(this.position.x, this.position.y + this.currentEyeHeight, this.position.z);
    this.camera.rotation.set(0, this.yaw, 0, 'YXZ');
    this.camera.rotateX(this.pitch);

    // Update Viewmodel
    const curSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.viewmodel.update(dt, curSpeed > 0.5, curSpeed / maxSpeed);

    // Automatic weapon firing check
    if (this.mouseButtons[0]) {
      if (def.isAutomatic || this.activeWeaponId === 'knife') {
        this.shoot();
      }
    }
  }

  public getPlayerInput(): PlayerInput {
    let buttons = 0;
    if (this.keysDown['KeyW']) buttons |= INPUT_BUTTONS.FORWARD;
    if (this.keysDown['KeyA']) buttons |= INPUT_BUTTONS.LEFT;
    if (this.keysDown['KeyS']) buttons |= INPUT_BUTTONS.BACKWARD;
    if (this.keysDown['KeyD']) buttons |= INPUT_BUTTONS.RIGHT;
    if (this.keysDown['Space']) buttons |= INPUT_BUTTONS.JUMP;
    if (this.isCrouching) buttons |= INPUT_BUTTONS.CROUCH;
    if (this.isWalking) buttons |= INPUT_BUTTONS.WALK;
    if (this.mouseButtons[0]) buttons |= INPUT_BUTTONS.FIRE;
    if (this.isReloading) buttons |= INPUT_BUTTONS.RELOAD;
    if (this.isScoped) buttons |= INPUT_BUTTONS.SCOPE;

    return {
      tick: this.currentTick++,
      buttons,
      yaw: this.yaw,
      pitch: this.pitch,
      weaponId: this.activeWeaponId
    };
  }

  public handleResize() {
    if (!this.container || !this.renderer) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private loop = (time: number) => {
    const dt = Math.min(0.1, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;

    // Check reload completion
    if (this.isReloading && time >= this.reloadEndTime) {
      this.isReloading = false;
      const def = WEAPON_CATALOG[this.activeWeaponId];
      const needed = def.magazineSize - this.ammoMag[this.activeWeaponId];
      const available = Math.min(needed, this.ammoReserve[this.activeWeaponId]);
      this.ammoMag[this.activeWeaponId] += available;
      this.ammoReserve[this.activeWeaponId] -= available;
      this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
    }

    this.updateMovement(dt);

    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };
}
