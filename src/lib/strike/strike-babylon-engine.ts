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
import { createKyotoMap, BabylonMapData } from './strike-babylon-map';
import { BabylonViewmodel, BabylonAvatarModel } from './strike-babylon-avatars';

export interface StrikeBabylonCallbacks {
  onHealthChange: (hp: number, maxHp: number) => void;
  onAmmoChange: (mag: number, reserve: number) => void;
  onWeaponChange: (weapon: WeaponDef) => void;
  onHitmarker: (isHeadshot: boolean, damage: number) => void;
  onLocalShoot: (ray: HitscanRay, isHeadshot: boolean, targetId: string | null, part?: 'head' | 'torso' | 'limb', damage?: number) => void;
  onKillAnnouncement: (text: string) => void;
  onScoreboardToggle: (visible: boolean) => void;
  onScopeChange?: (isScoped: boolean) => void;
  onPlayerDeath?: (attackerName: string) => void;
  onToggleFullscreen?: () => void;
}

export class StrikeBabylonEngine {
  public engine: Engine;
  public scene: Scene;
  public camera: UniversalCamera;
  public canvas: HTMLCanvasElement;

  // Map Data
  public mapData: BabylonMapData | null = null;

  // Player Physics Collider Body
  public playerCollider: AbstractMesh;

  // Play state (false until player clicks "Drop In & Play")
  public isPlaying = false;

  // Local Player Physics State
  public velocity = new Vector3(0, 0, 0);
  public onGround = true;
  public isCrouching = false;
  public isWalking = false;
  public baseEyeHeight = 1.62;
  public currentEyeHeight = 1.62;

  // Spawn invulnerability (1s god mode)
  public isInvulnerable = false;
  public invulnerableUntil = 0;
  private footstepAccumulator = 0;

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

  // Local Stats (150 HP base)
  public health = 150;
  public maxHealth = 150;
  public isDead = false;

  // Input & Sensitivity
  private keysDown: Record<string, boolean> = {};
  private mouseButtons: Record<number, boolean> = {};
  public mouseSensitivity = 0.0012; // Default 1.2 sensitivity
  public defaultFov = 1.25; // ~72 deg vertical in radians (standard 85 deg horizontal)

  // Viewmodel & Remote Avatars
  public viewmodel: BabylonViewmodel;
  public remoteAvatars: Map<string | number, BabylonAvatarModel> = new Map();

  // Event listener references for leak-free disposal
  private boundPointerLockChange: (() => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: ((e: PointerEvent) => void) | null = null;
  private boundContextMenu: ((e: MouseEvent) => void) | null = null;
  private boundWheel: ((e: WheelEvent) => void) | null = null;

  private lastClientX: number | null = null;
  private lastClientY: number | null = null;

  public isPointerLocked = false;
  private callbacks: StrikeBabylonCallbacks;
  public isDisposed = false;

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
    // Balanced daytime Japanese sky clear color
    this.scene.clearColor = new Color4(0.42, 0.65, 0.88, 1.0);
    this.scene.collisionsEnabled = true;

    // 2. Setup FPS Universal Camera & Physics Collider
    this.camera = new UniversalCamera('fpsCamera', new Vector3(0, 1.62, 20), this.scene);
    this.camera.fov = this.defaultFov;
    this.camera.minZ = 0.05;
    this.camera.maxZ = 300;
    this.camera.checkCollisions = false;

    // Physics collider mesh for smooth swept-sphere / box collision against world geometry
    this.playerCollider = MeshBuilder.CreateBox('playerCollider', { width: 0.84, height: 1.7, depth: 0.84 }, this.scene);
    this.playerCollider.isVisible = false;
    this.playerCollider.isPickable = false;
    this.playerCollider.checkCollisions = true;
    this.playerCollider.ellipsoid = new Vector3(0.42, 0.85, 0.42);
    this.playerCollider.ellipsoidOffset = new Vector3(0, 0, 0);

    // 3. Build Kyoto Tactical Map (104x104m)
    this.mapData = createKyotoMap(this.scene);

    // 4. Viewmodel
    this.viewmodel = new BabylonViewmodel(this.scene, this.camera);

    // 5. Setup Input & Resize Listeners
    this.setupInputs();

    // 6. Spawn Local Player (Initial positioning)
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

  public startPlaying() {
    this.isPlaying = true;
    this.respawnLocalPlayer();
    this.requestPointerLock();
  }

  public pausePlaying() {
    this.isPlaying = false;
    this.keysDown = {};
    this.mouseButtons = {};
  }

  private setupInputs() {
    this.boundPointerLockChange = () => {
      const plEl = document.pointerLockElement || (document as any).mozPointerLockElement;
      this.isPointerLocked = plEl === this.canvas || plEl === this.canvas.parentElement;
      this.lastClientX = null;
      this.lastClientY = null;
      if (!this.isPointerLocked) {
        this.keysDown = {};
        this.mouseButtons = {};
      }
    };
    document.addEventListener('pointerlockchange', this.boundPointerLockChange);
    document.addEventListener('mozpointerlockchange', this.boundPointerLockChange);

    this.boundKeyDown = (e) => {
      if (!this.isPlaying) return;
      this.keysDown[e.code] = true;
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'Digit1') this.switchWeapon('rifle');
      if (e.code === 'Digit2') this.switchWeapon('sniper');
      if (e.code === 'Digit3') this.switchWeapon('pistol');
      if (e.code === 'Digit4') this.switchWeapon('knife');
      if (e.code === 'KeyQ') this.switchWeapon(this.lastWeaponId);
      if (e.code === 'KeyF') {
        this.callbacks.onToggleFullscreen?.();
      }
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

    this.boundPointerMove = (e: PointerEvent) => {
      if (!this.isPlaying) return;

      let movementX = e.movementX ?? (e as any).mozMovementX ?? 0;
      let movementY = e.movementY ?? (e as any).mozMovementY ?? 0;

      // When pointer lock is not active (or in Firefox before lock engages / when holding mouse buttons)
      if (!this.isPointerLocked) {
        if (!this.mouseButtons[0] && !this.mouseButtons[2]) {
          this.lastClientX = e.clientX;
          this.lastClientY = e.clientY;
          return;
        }

        // In Firefox without pointer lock, movementX/Y is 0. Fall back to client delta.
        if (movementX === 0 && movementY === 0 && this.lastClientX !== null && this.lastClientY !== null) {
          movementX = e.clientX - this.lastClientX;
          movementY = e.clientY - this.lastClientY;
        }
      }

      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;

      if (movementX === 0 && movementY === 0) return;

      const sens = this.isScoped ? this.mouseSensitivity * 0.4 : this.mouseSensitivity;
      this.camera.rotation.y += movementX * sens;
      this.camera.rotation.x += movementY * sens;

      // Clamp pitch between -89 deg and +89 deg
      const maxPitch = (89 * Math.PI) / 180;
      this.camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, this.camera.rotation.x));
    };
    window.addEventListener('pointermove', this.boundPointerMove);

    this.boundPointerDown = (e: PointerEvent) => {
      if (!this.isPlaying || this.isDead) return;

      const target = e.target as HTMLElement | null;
      // Do not intercept clicks on buttons or UI overlays (top banner, controls modal, summary modal, etc.)
      if (
        target?.closest('button') ||
        target?.closest('.strike-top-banner') ||
        target?.closest('.strike-controls-modal') ||
        target?.closest('.strike-summary-modal') ||
        target?.closest('.strike-weapon-card')
      ) {
        return;
      }

      const isGameTarget =
        this.isPointerLocked ||
        target === this.canvas;

      if (!isGameTarget) return;

      e.preventDefault();

      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;

      if (!this.isPointerLocked) {
        this.requestPointerLock();
      }

      this.mouseButtons[e.button] = true;
      if (e.button === 0) {
        // Immediate shot execution on left click
        this.shoot();
      } else if (e.button === 2) {
        // Right click: Scope toggle
        this.toggleScope();
      }
    };
    window.addEventListener('pointerdown', this.boundPointerDown);

    this.boundPointerUp = (e: PointerEvent) => {
      this.mouseButtons[e.button] = false;
      this.lastClientX = null;
      this.lastClientY = null;
    };
    window.addEventListener('pointerup', this.boundPointerUp);

    this.boundContextMenu = (e) => {
      if (this.isPlaying) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', this.boundContextMenu);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Prevent drag and text selection from canceling mousemove when dragging/holding buttons
    window.addEventListener('dragstart', (e) => {
      if (this.isPlaying) e.preventDefault();
    });
    window.addEventListener('selectstart', (e) => {
      if (this.isPlaying) e.preventDefault();
    });

    // Mouse wheel weapon cycling
    const weaponCycle: WeaponId[] = ['rifle', 'sniper', 'pistol', 'knife'];
    this.boundWheel = (e) => {
      if (!this.isPointerLocked || !this.isPlaying) return;
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
    try {
      this.canvas.focus?.();
      const req = this.canvas.requestPointerLock || (this.canvas as any).mozRequestPointerLock;
      req?.call(this.canvas);
    } catch (err) {
      console.warn('Pointer lock request error', err);
    }
  }

  public respawnLocalPlayer() {
    const spawns = this.mapData?.spawnPoints || [{ position: new Vector3(0, 1, 20), yaw: 0 }];
    const sp = spawns[Math.floor(Math.random() * spawns.length)];

    if (this.playerCollider) {
      this.playerCollider.position = new Vector3(sp.position.x, sp.position.y + 0.85, sp.position.z);
    }
    this.camera.position = new Vector3(sp.position.x, sp.position.y + this.baseEyeHeight, sp.position.z);
    this.camera.rotation = new Vector3(0, sp.yaw, 0);
    this.velocity = Vector3.Zero();
    this.health = this.maxHealth;
    this.isDead = false;
    this.isScoped = false;
    this.isReloading = false;
    this.camera.fov = this.defaultFov;
    this.viewmodel.root.setEnabled(true);
    this.callbacks.onScopeChange?.(false);

    // 2-second god mode upon spawn (CS2 deathmatch style spawn protection)
    this.isInvulnerable = true;
    this.invulnerableUntil = performance.now() + 2000;

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
    this.viewmodel.root.setEnabled(true);
    this.callbacks.onScopeChange?.(false);

    this.viewmodel.setWeapon(id);
    this.callbacks.onWeaponChange(WEAPON_CATALOG[id]);
    this.callbacks.onAmmoChange(this.ammoMag[id], this.ammoReserve[id]);
  }

  public toggleScope() {
    if (this.isReloading) return;
    const def = WEAPON_CATALOG[this.activeWeaponId];
    if (!def.hasScope) return;
    this.isScoped = !this.isScoped;
    this.camera.fov = this.isScoped ? this.defaultFov * def.scopeZoom : this.defaultFov;
    this.viewmodel.root.setEnabled(!this.isScoped);
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
      this.viewmodel.root.setEnabled(true);
      this.callbacks.onScopeChange?.(false);
    }

    this.isReloading = true;
    this.reloadEndTime = performance.now() + def.reloadTimeMs;
    this.viewmodel.triggerReload(def.reloadTimeMs);
    strikeAudio.playReload();
  }

  public shoot() {
    if (!this.isPlaying || this.isDead || this.isReloading) return;
    const now = performance.now();
    const def = WEAPON_CATALOG[this.activeWeaponId];

    // If weapon is out of ammo, clicking triggers reload immediately even during fire cooldown
    if (this.activeWeaponId !== 'knife' && this.ammoMag[this.activeWeaponId] <= 0) {
      this.reload();
      return;
    }

    const shotCooldown = (60 / def.fireRateRpm) * 1000;
    if (now - this.lastShotTime < shotCooldown) return;

    this.lastShotTime = now;
    if (this.activeWeaponId !== 'knife') {
      this.ammoMag[this.activeWeaponId]--;
      this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
    }

    // Raycast shooting via Babylon.js scene picking (BEFORE applying recoil so aim hits true crosshair center)
    // Knife is strictly capped at close melee combat range (2.2m), firearms at 300m
    const maxRayDist = this.activeWeaponId === 'knife' ? (def.range || 2.2) : 300;
    const forwardRay = this.camera.getForwardRay(maxRayDist);

    // Audio & Viewmodel attack animation (knife slash or gun recoil)
    strikeAudio.playGunfire(this.activeWeaponId);
    this.viewmodel.triggerAttack(this.activeWeaponId, def.recoilVertical, def.recoilHorizontal);

    // Apply slight pitch recoil to camera AFTER forward ray is computed (guns only)
    if (this.activeWeaponId !== 'knife') {
      this.camera.rotation.x -= def.recoilVertical * 0.35;
      this.camera.rotation.y += (Math.random() - 0.5) * def.recoilHorizontal;
    }

    const hit = this.scene.pickWithRay(forwardRay, (mesh) => {
      return (
        mesh.isPickable &&
        mesh !== this.playerCollider &&
        !mesh.name.startsWith('playerCollider') &&
        !mesh.name.startsWith('Viewmodel') &&
        !mesh.name.startsWith('FirstPerson') &&
        (!this.viewmodel || !mesh.isDescendantOf(this.viewmodel.root))
      );
    });

    let isHeadshot = false;
    let targetId: string | null = null;
    let hitPart: 'head' | 'torso' | 'limb' = 'torso';
    let hitPoint = forwardRay.origin.add(forwardRay.direction.scale(maxRayDist));

    if (hit && hit.hit && hit.pickedMesh) {
      if (hit.pickedPoint) {
        hitPoint = hit.pickedPoint;
      }
      const meta = hit.pickedMesh.metadata;
      if (meta && meta.isHitbox) {
        targetId = String(meta.playerId);
        hitPart = meta.part || 'torso';
        isHeadshot = hitPart === 'head';
      } else {
        const meshName = hit.pickedMesh.name;
        if (
          meshName.startsWith('avatarHead_') ||
          meshName.startsWith('hitboxHead_') ||
          meshName.startsWith('hairCap_') ||
          meshName.startsWith('lTail_') ||
          meshName.startsWith('rTail_')
        ) {
          isHeadshot = true;
          hitPart = 'head';
          targetId = meshName.split('_')[1] || null;
        } else if (
          meshName.startsWith('avatarBody_') ||
          meshName.startsWith('hitboxTorso_') ||
          meshName.startsWith('skirt_')
        ) {
          isHeadshot = false;
          hitPart = 'torso';
          targetId = meshName.split('_')[1] || null;
        } else if (
          meshName.startsWith('lArm_') ||
          meshName.startsWith('rArm_') ||
          meshName.startsWith('lLeg_') ||
          meshName.startsWith('rLeg_') ||
          meshName.startsWith('hitboxLimbs_')
        ) {
          isHeadshot = false;
          hitPart = 'limb';
          targetId = meshName.split('_')[1] || null;
        }
      }
    }

    // Visual Tracer line (guns only, knife does not emit bullet tracers)
    if (this.activeWeaponId !== 'knife') {
      this.createTracer(forwardRay.origin.add(new Vector3(0, -0.15, 0)), hitPoint, def.color);
    }

    if (targetId !== null) {
      strikeAudio.playHitmarker(isHeadshot);
      let mult = 1.0;
      if (hitPart === 'head') mult = def.headshotMultiplier;
      else if (hitPart === 'limb') mult = 0.75;
      const dmg = Math.round(def.damage * mult);
      this.callbacks.onHitmarker(isHeadshot, dmg);
    }

    let calculatedDmg = def.damage;
    if (hitPart === 'head') calculatedDmg = Math.round(def.damage * def.headshotMultiplier);
    else if (hitPart === 'limb') calculatedDmg = Math.round(def.damage * 0.75);

    this.callbacks.onLocalShoot(
      {
        origin: { x: forwardRay.origin.x, y: forwardRay.origin.y, z: forwardRay.origin.z },
        direction: { x: forwardRay.direction.x, y: forwardRay.direction.y, z: forwardRay.direction.z },
        maxDistance: maxRayDist,
        shooterId: 0,
        weaponId: this.activeWeaponId
      },
      isHeadshot,
      targetId,
      hitPart,
      calculatedDmg
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
    tracer.isPickable = false;

    setTimeout(() => {
      tracer.dispose();
    }, 65);
  }

  public applyDamage(dmg: number, attackerName: string) {
    if (!this.isPlaying || this.isDead) return;
    // 1-second god mode check on spawn
    if (this.isInvulnerable && performance.now() < this.invulnerableUntil) {
      return;
    }
    this.isInvulnerable = false;

    this.health = Math.max(0, this.health - dmg);
    this.callbacks.onHealthChange(this.health, this.maxHealth);

    if (this.health <= 0) {
      this.isDead = true;
      this.isScoped = false;
      this.camera.fov = this.defaultFov;
      this.viewmodel.root.setEnabled(true);
      this.callbacks.onScopeChange?.(false);
      this.callbacks.onKillAnnouncement(`Killed by ${attackerName}!`);
      this.callbacks.onPlayerDeath?.(attackerName);
      setTimeout(() => {
        this.respawnLocalPlayer();
      }, 2500);
    }
  }

  private update(dt: number) {
    if (!this.isPlaying || this.isDead) return;

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

    // Ground presence check: if on high ground, verify ground exists directly underneath collider
    if (this.onGround && this.playerCollider.position.y > 0.88) {
      const downRay = new Ray(this.playerCollider.position, new Vector3(0, -1, 0), 1.05);
      const groundHit = this.scene.pickWithRay(downRay, (mesh) => {
        return (
          mesh.isPickable &&
          mesh !== this.playerCollider &&
          !mesh.name.startsWith('playerCollider') &&
          !mesh.name.startsWith('hitbox') &&
          !mesh.name.startsWith('avatar') &&
          !mesh.name.startsWith('Viewmodel')
        );
      });
      if (!groundHit || !groundHit.hit || groundHit.distance > 0.96) {
        this.onGround = false;
      }
    }

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

    // Native Babylon moveWithCollisions on playerCollider slides smoothly along walls & obstacles
    const displacement = new Vector3(
      this.velocity.x * dt,
      this.velocity.y * dt,
      this.velocity.z * dt
    );
    const prevY = this.playerCollider.position.y;
    this.playerCollider.moveWithCollisions(displacement);
    const deltaY = this.playerCollider.position.y - prevY;

    // Detect landing on elevated surfaces/stairs/boxes when moving downward
    if (displacement.y < -0.01 && deltaY > displacement.y * 0.5) {
      this.onGround = true;
      this.velocity.y = 0;
    }

    // Safety ground floor limit (courtyard ground is y = 0, collider center is 0.85)
    if (this.playerCollider.position.y <= 0.85) {
      this.playerCollider.position.y = 0.85;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Smooth crouching eye height transition
    const targetEyeHeight = this.isCrouching ? 1.15 : 1.62;
    this.currentEyeHeight += (targetEyeHeight - this.currentEyeHeight) * Math.min(1, dt * 14);

    // Synchronize camera position to physics collider with dynamic eye height
    this.camera.position.x = this.playerCollider.position.x;
    this.camera.position.y = this.playerCollider.position.y + (this.currentEyeHeight - 0.85);
    this.camera.position.z = this.playerCollider.position.z;

    // Viewmodel update
    const curSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.viewmodel.update(dt, curSpeed > 0.5, curSpeed / maxSpeed);

    // Footstep audio when moving on ground
    if (this.onGround && curSpeed > 0.8) {
      const stepInterval = this.isWalking ? 0.38 : this.isCrouching ? 0.44 : 0.28;
      this.footstepAccumulator += dt;
      if (this.footstepAccumulator >= stepInterval) {
        this.footstepAccumulator = 0;
        strikeAudio.playFootstep(true);
      }
    } else {
      this.footstepAccumulator = 0;
    }

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
      document.removeEventListener('mozpointerlockchange', this.boundPointerLockChange);
    }
    if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
    if (this.boundKeyUp) window.removeEventListener('keyup', this.boundKeyUp);
    if (this.boundPointerMove) window.removeEventListener('pointermove', this.boundPointerMove);
    if (this.boundPointerDown) window.removeEventListener('pointerdown', this.boundPointerDown);
    if (this.boundPointerUp) window.removeEventListener('pointerup', this.boundPointerUp);
    if (this.boundContextMenu) window.removeEventListener('contextmenu', this.boundContextMenu);
    if (this.boundWheel) window.removeEventListener('wheel', this.boundWheel);

    // Dispose collider, viewmodel & avatars
    this.playerCollider?.dispose();
    this.viewmodel.dispose();
    this.remoteAvatars.forEach((av) => av.dispose());
    this.remoteAvatars.clear();

    // Dispose scene & engine
    this.scene.dispose();
    this.engine.dispose();
  }
}
