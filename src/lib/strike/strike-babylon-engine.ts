import {
  Engine,
  Scene,
  Vector3,
  Color4,
  Color3,
  UniversalCamera,
  Ray,
  MeshBuilder,
  StandardMaterial,
  AbstractMesh
} from '@babylonjs/core';
import {
  WeaponId,
  WeaponDef,
  HitscanRay,
  HitscanHitResult,
  StrikeMatchStats
} from './strike-types';
import { WEAPON_CATALOG, strikeAudio } from './strike-weapons';
import { createCyberShrineMap, BabylonMapData } from './strike-babylon-map';
import { BabylonViewmodel, BabylonAvatarModel } from './strike-babylon-avatars';

export interface StrikeBabylonCallbacks {
  onHealthChange: (hp: number, maxHp: number) => void;
  onAmmoChange: (mag: number, reserve: number) => void;
  onWeaponChange: (weapon: WeaponDef) => void;
  onHitmarker: (isHeadshot: boolean, damage: number) => void;
  onLocalShoot: (ray: HitscanRay, isHeadshot: boolean, targetId: string | null) => void;
  onKillAnnouncement: (text: string) => void;
  onScoreboardToggle: (visible: boolean) => void;
  onScopeChange?: (isScoped: boolean) => void;
  onPlayerDeath?: (attackerName: string) => void;
}

export class StrikeBabylonEngine {
  public engine: Engine;
  public scene: Scene;
  public camera: UniversalCamera;
  public canvas: HTMLCanvasElement;

  // Map Data
  public mapData: BabylonMapData | null = null;

  // Local Player Physics State
  public velocity = new Vector3(0, 0, 0);
  public onGround = true;
  public isCrouching = false;
  public isWalking = false;
  public baseEyeHeight = 1.62;
  public currentEyeHeight = 1.62;

  // Weapon State
  public activeWeaponId: WeaponId = 'rifle';
  public lastWeaponId: WeaponId = 'pistol';
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

  // Local Stats
  public health = 100;
  public maxHealth = 100;
  public isDead = false;

  // Input & Sensitivity
  private keysDown: Record<string, boolean> = {};
  private mouseButtons: Record<number, boolean> = {};
  public mouseSensitivity = 0.0022;
  public defaultFov = 1.25; // ~72 deg vertical in radians (standard 85 deg horizontal)

  // Viewmodel & Remote Avatars
  public viewmodel: BabylonViewmodel;
  public remoteAvatars: Map<string | number, BabylonAvatarModel> = new Map();

  // Event listener references for leak-free disposal
  private boundPointerLockChange: (() => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundContextMenu: ((e: MouseEvent) => void) | null = null;
  private boundWheel: ((e: WheelEvent) => void) | null = null;

  public isPointerLocked = false;
  private callbacks: StrikeBabylonCallbacks;
  private isDisposed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: StrikeBabylonCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    // 1. Initialize Babylon.js Engine & Scene
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      powerPreference: 'high-performance'
    });

    this.scene = new Scene(this.engine);
    // Dark cyberpunk shrine night sky clear color (never black screen!)
    this.scene.clearColor = new Color4(0.08, 0.10, 0.14, 1.0);
    this.scene.collisionsEnabled = true;

    // 2. Setup FPS Universal Camera
    this.camera = new UniversalCamera('fpsCamera', new Vector3(0, 1.62, 20), this.scene);
    this.camera.fov = this.defaultFov;
    this.camera.minZ = 0.05;
    this.camera.maxZ = 300;
    this.camera.checkCollisions = true;
    this.camera.ellipsoid = new Vector3(0.42, 0.85, 0.42);

    // 3. Build Cyber Shrine Map
    this.mapData = createCyberShrineMap(this.scene);

    // 4. Viewmodel
    this.viewmodel = new BabylonViewmodel(this.scene, this.camera);

    // 5. Setup Input & Resize Listeners
    this.setupInputs();

    // 6. Spawn Local Player
    this.respawnLocalPlayer();

    // 7. Render Loop
    this.engine.runRenderLoop(() => {
      if (this.isDisposed) return;
      const dt = Math.min(0.1, this.engine.getDeltaTime() / 1000);
      this.update(dt);
      this.scene.render();
    });

    // Notify initial state
    this.callbacks.onHealthChange(this.health, this.maxHealth);
    this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
    this.callbacks.onWeaponChange(WEAPON_CATALOG[this.activeWeaponId]);
  }

  private setupInputs() {
    this.boundPointerLockChange = () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      if (!this.isPointerLocked) {
        this.keysDown = {};
        this.mouseButtons = {};
      }
    };
    document.addEventListener('pointerlockchange', this.boundPointerLockChange);

    this.boundKeyDown = (e) => {
      if (!this.isPointerLocked) return;
      this.keysDown[e.code] = true;
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'Digit1') this.switchWeapon('rifle');
      if (e.code === 'Digit2') this.switchWeapon('sniper');
      if (e.code === 'Digit3') this.switchWeapon('pistol');
      if (e.code === 'Digit4') this.switchWeapon('knife');
      if (e.code === 'KeyQ') this.switchWeapon(this.lastWeaponId);
      if (e.code === 'Tab') {
        e.preventDefault();
        this.callbacks.onScoreboardToggle(true);
      }
    };
    window.addEventListener('keydown', this.boundKeyDown);

    this.boundKeyUp = (e) => {
      if (this.keysDown[e.code]) {
        this.keysDown[e.code] = false;
      }
      if (e.code === 'Tab') {
        this.callbacks.onScoreboardToggle(false);
      }
    };
    window.addEventListener('keyup', this.boundKeyUp);

    this.boundMouseMove = (e) => {
      if (!this.isPointerLocked) return;
      const sens = this.isScoped ? this.mouseSensitivity * 0.4 : this.mouseSensitivity;
      this.camera.rotation.y += e.movementX * sens;
      this.camera.rotation.x += e.movementY * sens;

      // Clamp pitch between -89 deg and +89 deg
      const maxPitch = (89 * Math.PI) / 180;
      this.camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, this.camera.rotation.x));
    };
    window.addEventListener('mousemove', this.boundMouseMove);

    this.boundMouseDown = (e) => {
      if (!this.isPointerLocked) {
        if (e.target === this.canvas) {
          this.requestPointerLock();
        }
        return;
      }
      this.mouseButtons[e.button] = true;
      if (e.button === 0) {
        // Immediate shot execution for sniper/deagle single-clicks
        this.shoot();
      } else if (e.button === 2) {
        // Right click: Scope toggle
        this.toggleScope();
      }
    };
    window.addEventListener('mousedown', this.boundMouseDown);

    this.boundMouseUp = (e) => {
      this.mouseButtons[e.button] = false;
    };
    window.addEventListener('mouseup', this.boundMouseUp);

    this.boundContextMenu = (e) => {
      if (this.isPointerLocked) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', this.boundContextMenu);

    // Mouse wheel weapon cycling
    const weaponCycle: WeaponId[] = ['rifle', 'sniper', 'pistol', 'knife'];
    this.boundWheel = (e) => {
      if (!this.isPointerLocked) return;
      e.preventDefault();
      const curIdx = weaponCycle.indexOf(this.activeWeaponId);
      if (curIdx === -1) return;
      const nextIdx = e.deltaY > 0
        ? (curIdx + 1) % weaponCycle.length
        : (curIdx - 1 + weaponCycle.length) % weaponCycle.length;
      this.switchWeapon(weaponCycle[nextIdx]);
    };
    window.addEventListener('wheel', this.boundWheel, { passive: false });
  }

  public requestPointerLock() {
    this.canvas.requestPointerLock?.();
  }

  public respawnLocalPlayer() {
    const spawns = this.mapData?.spawnPoints || [{ position: new Vector3(0, 1, 20), yaw: 0 }];
    const sp = spawns[Math.floor(Math.random() * spawns.length)];

    this.camera.position = new Vector3(sp.position.x, sp.position.y + this.baseEyeHeight, sp.position.z);
    this.camera.rotation = new Vector3(0, sp.yaw, 0);
    this.velocity = Vector3.Zero();
    this.health = 100;
    this.isDead = false;
    this.isScoped = false;
    this.isReloading = false;
    this.callbacks.onScopeChange?.(false);

    // Replenish ammo
    this.ammoMag = { rifle: 30, sniper: 5, pistol: 7, knife: 1 };
    this.ammoReserve = { rifle: 90, sniper: 25, pistol: 35, knife: 1 };

    this.callbacks.onHealthChange(this.health, this.maxHealth);
    this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
  }

  public switchWeapon(id: WeaponId) {
    if (this.activeWeaponId === id || this.isDead) return;
    this.lastWeaponId = this.activeWeaponId;
    this.activeWeaponId = id;
    this.isReloading = false;
    this.isScoped = false;
    this.camera.fov = this.defaultFov;
    this.callbacks.onScopeChange?.(false);

    this.viewmodel.setWeapon(id);
    this.callbacks.onWeaponChange(WEAPON_CATALOG[id]);
    this.callbacks.onAmmoChange(this.ammoMag[id], this.ammoReserve[id]);
  }

  public toggleScope() {
    const def = WEAPON_CATALOG[this.activeWeaponId];
    if (!def.hasScope) return;
    this.isScoped = !this.isScoped;
    this.camera.fov = this.isScoped ? this.defaultFov * def.scopeZoom : this.defaultFov;
    this.callbacks.onScopeChange?.(this.isScoped);
  }

  public reload() {
    if (this.isReloading || this.isDead) return;
    const def = WEAPON_CATALOG[this.activeWeaponId];
    const needed = def.magazineSize - this.ammoMag[this.activeWeaponId];
    if (needed <= 0 || this.ammoReserve[this.activeWeaponId] <= 0) return;

    if (this.isScoped) {
      this.isScoped = false;
      this.camera.fov = this.defaultFov;
      this.callbacks.onScopeChange?.(false);
    }

    this.isReloading = true;
    this.reloadEndTime = performance.now() + def.reloadTimeMs;
    this.viewmodel.triggerReload(def.reloadTimeMs);
    strikeAudio.playReload();
  }

  public shoot() {
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

    // Audio & Viewmodel recoil
    strikeAudio.playGunfire(this.activeWeaponId);
    this.viewmodel.triggerRecoil(def.recoilVertical, def.recoilHorizontal);

    // Apply slight pitch recoil to camera
    this.camera.rotation.x -= def.recoilVertical * 0.35;
    this.camera.rotation.y += (Math.random() - 0.5) * def.recoilHorizontal;

    // Raycast shooting via Babylon.js scene picking
    const forwardRay = this.camera.getForwardRay(250);
    const hit = this.scene.pickWithRay(forwardRay);

    let isHeadshot = false;
    let targetId: string | null = null;
    let hitPoint = forwardRay.origin.add(forwardRay.direction.scale(250));

    if (hit && hit.hit && hit.pickedMesh) {
      if (hit.pickedPoint) {
        hitPoint = hit.pickedPoint;
      }
      const meshName = hit.pickedMesh.name;

      if (meshName.startsWith('avatarHead_')) {
        isHeadshot = true;
        targetId = meshName.replace('avatarHead_', '');
      } else if (meshName.startsWith('avatarBody_') || meshName.startsWith('lLeg_') || meshName.startsWith('rLeg_')) {
        isHeadshot = false;
        targetId = meshName.split('_')[1] || null;
      }
    }

    // Visual Tracer line
    this.createTracer(forwardRay.origin.add(new Vector3(0, -0.15, 0)), hitPoint, def.color);

    if (targetId !== null) {
      strikeAudio.playHitmarker(isHeadshot);
      const mult = isHeadshot ? def.headshotMultiplier : 1.0;
      const dmg = Math.round(def.damage * mult);
      this.callbacks.onHitmarker(isHeadshot, dmg);
    }

    this.callbacks.onLocalShoot(
      {
        origin: { x: forwardRay.origin.x, y: forwardRay.origin.y, z: forwardRay.origin.z },
        direction: { x: forwardRay.direction.x, y: forwardRay.direction.y, z: forwardRay.direction.z },
        maxDistance: 250,
        shooterId: 0,
        weaponId: this.activeWeaponId
      },
      isHeadshot,
      targetId
    );
  }

  private createTracer(start: Vector3, end: Vector3, colorHex: string) {
    const tracer = MeshBuilder.CreateLines(
      'bulletTracer',
      {
        points: [start, end],
        updatable: false
      },
      this.scene
    );
    tracer.color = Color3.FromHexString(colorHex);

    setTimeout(() => {
      tracer.dispose();
    }, 65);
  }

  public applyDamage(dmg: number, attackerName: string) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - dmg);
    this.callbacks.onHealthChange(this.health, this.maxHealth);

    if (this.health <= 0) {
      this.isDead = true;
      this.isScoped = false;
      this.camera.fov = this.defaultFov;
      this.callbacks.onScopeChange?.(false);
      this.callbacks.onKillAnnouncement(`Killed by ${attackerName}!`);
      this.callbacks.onPlayerDeath?.(attackerName);
      setTimeout(() => {
        this.respawnLocalPlayer();
      }, 2500);
    }
  }

  private update(dt: number) {
    if (this.isDead) return;

    // Reload timer check
    if (this.isReloading && performance.now() >= this.reloadEndTime) {
      this.isReloading = false;
      const def = WEAPON_CATALOG[this.activeWeaponId];
      const needed = def.magazineSize - this.ammoMag[this.activeWeaponId];
      const available = Math.min(needed, this.ammoReserve[this.activeWeaponId]);
      this.ammoMag[this.activeWeaponId] += available;
      this.ammoReserve[this.activeWeaponId] -= available;
      this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
    }

    // Crouch and Walk states
    this.isCrouching = !!this.keysDown['KeyC'] || !!this.keysDown['ControlLeft'];
    this.isWalking = !!this.keysDown['ShiftLeft'] || !!this.keysDown['ShiftRight'];

    // Speeds in m/s
    const def = WEAPON_CATALOG[this.activeWeaponId];
    let maxSpeed = 7.4;
    if (def.id === 'knife') maxSpeed = 7.8;
    if (def.id === 'sniper') maxSpeed = 6.2;
    if (this.isCrouching) maxSpeed *= 0.45;
    else if (this.isWalking) maxSpeed *= 0.55;

    // Movement direction
    let forward = 0;
    let strafe = 0;
    if (this.keysDown['KeyW']) forward += 1;
    if (this.keysDown['KeyS']) forward -= 1;
    if (this.keysDown['KeyA']) strafe -= 1;
    if (this.keysDown['KeyD']) strafe += 1;

    // Transform movement direction by camera yaw
    const yaw = this.camera.rotation.y;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);

    const moveX = strafe * cos + forward * sin;
    const moveZ = -strafe * sin + forward * cos;
    const moveLen = Math.hypot(moveX, moveZ);

    const targetVelX = moveLen > 0 ? (moveX / moveLen) * maxSpeed : 0;
    const targetVelZ = moveLen > 0 ? (moveZ / moveLen) * maxSpeed : 0;

    // Acceleration & ground friction
    const accel = this.onGround ? 20 : 6;
    this.velocity.x += (targetVelX - this.velocity.x) * Math.min(1, dt * accel);
    this.velocity.z += (targetVelZ - this.velocity.z) * Math.min(1, dt * accel);

    // Gravity & Jump
    if (this.onGround) {
      if (this.keysDown['Space']) {
        this.velocity.y = 6.5;
        this.onGround = false;
      } else {
        this.velocity.y = -0.5; // gentle ground stick
      }
    } else {
      this.velocity.y -= 19.6 * dt; // gravity
    }

    // Native Babylon moveWithCollisions slides smoothly along walls & obstacles
    const displacement = new Vector3(
      this.velocity.x * dt,
      this.velocity.y * dt,
      this.velocity.z * dt
    );
    this.camera.moveWithCollisions(displacement);

    // Check ground level
    if (this.camera.position.y <= 1.62) {
      this.camera.position.y = 1.62;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Viewmodel update
    const curSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.viewmodel.update(dt, curSpeed > 0.5, curSpeed / maxSpeed);

    // Full-auto continuous shooting
    if (this.mouseButtons[0]) {
      if (def.isAutomatic || this.activeWeaponId === 'knife') {
        this.shoot();
      }
    }
  }

  public setSensitivity(sens: number) {
    this.mouseSensitivity = Math.max(0.0005, Math.min(0.01, sens * 0.001));
  }

  public setFov(fovDeg: number) {
    this.defaultFov = (fovDeg * Math.PI) / 180;
    if (!this.isScoped) {
      this.camera.fov = this.defaultFov;
    }
  }

  public handleResize() {
    this.engine.resize();
  }

  public dispose() {
    this.isDisposed = true;

    // Detach listeners
    if (this.boundPointerLockChange) {
      document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
    }
    if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
    if (this.boundKeyUp) window.removeEventListener('keyup', this.boundKeyUp);
    if (this.boundMouseMove) window.removeEventListener('mousemove', this.boundMouseMove);
    if (this.boundMouseDown) window.removeEventListener('mousedown', this.boundMouseDown);
    if (this.boundMouseUp) window.removeEventListener('mouseup', this.boundMouseUp);
    if (this.boundContextMenu) window.removeEventListener('contextmenu', this.boundContextMenu);
    if (this.boundWheel) window.removeEventListener('wheel', this.boundWheel);

    // Dispose viewmodel & avatars
    this.viewmodel.dispose();
    this.remoteAvatars.forEach((av) => av.dispose());
    this.remoteAvatars.clear();

    // Dispose scene & engine
    this.scene.dispose();
    this.engine.dispose();
  }
}
