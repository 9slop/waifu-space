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
  StrikeMatchStats,
  StrikeKeybindings,
  DEFAULT_KEYBINDINGS,
  StrikeGraphicsSettings,
  DEFAULT_GRAPHICS_SETTINGS
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
  onDamageReceived?: (damage: number, currentHp: number) => void;
  onEscapeMenuToggle?: (visible: boolean) => void;
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
  public isPaused = false;
  private screenShakeTrauma = 0;
  private currentShakePitch = 0;
  private elapsedGameTime = 0;

  // Input & Sensitivity
  public keybindings: StrikeKeybindings = { ...DEFAULT_KEYBINDINGS };
  private keysDown: Record<string, boolean> = {};
  private mouseButtons: Record<number, boolean> = {};
  public mouseSensitivity = 0.0012; // Default 1.2 sensitivity
  public defaultFov = 1.25; // ~72 deg vertical in radians (standard 85 deg horizontal)
  public graphicsSettings: StrikeGraphicsSettings = { ...DEFAULT_GRAPHICS_SETTINGS };

  // Viewmodel & Remote Avatars
  public viewmodel: BabylonViewmodel;
  public remoteAvatars: Map<string | number, BabylonAvatarModel> = new Map();
  public localShadowCaster: AbstractMesh | null = null;

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
    this.camera.maxZ = 600;
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

    // 3b. Local Player Shadow Caster
    // Invisible to FPS camera via layerMask separation, but casts real-time shadow from the sun
    const shadowProxy = MeshBuilder.CreateCapsule('localPlayerShadowProxy', { radius: 0.38, height: 1.72, subdivisions: 6 }, this.scene);
    shadowProxy.isPickable = false;
    shadowProxy.checkCollisions = false;
    shadowProxy.layerMask = 0x20000000;
    this.localShadowCaster = shadowProxy;

    if (this.mapData?.shadowGenerator) {
      this.mapData.shadowGenerator.addShadowCaster(shadowProxy);
    }

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

    // Apply initial graphics settings (default: Low for smooth playability across all hardware)
    this.setGraphicsSettings(DEFAULT_GRAPHICS_SETTINGS);

    // Notify initial state
    this.callbacks.onHealthChange(this.health, this.maxHealth);
    this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
    this.callbacks.onWeaponChange(WEAPON_CATALOG[this.activeWeaponId]);
  }

  public setGraphicsSettings(settings: Partial<StrikeGraphicsSettings>) {
    this.graphicsSettings = { ...this.graphicsSettings, ...settings };

    // 1. Shadow Quality
    if (this.mapData?.setShadowQuality) {
      this.mapData.setShadowQuality(this.graphicsSettings.shadows);
    } else if (this.mapData?.setRtxShadows) {
      this.mapData.setRtxShadows(this.graphicsSettings.shadows === 'rtx');
    }

    // 2. Hardware Render Scale (0.75, 1.0, 1.25)
    if (this.engine) {
      const scale = Math.max(0.5, Math.min(2.0, this.graphicsSettings.renderScale || 1.0));
      this.engine.setHardwareScalingLevel(1.0 / scale);
    }

    // 3. Dynamic Field of View
    if (this.camera) {
      const hFov = Math.max(65, Math.min(105, this.graphicsSettings.fov || 85));
      const hFovRad = (hFov * Math.PI) / 180;
      const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) * (9 / 16));
      this.defaultFov = vFovRad;
      if (!this.isScoped) {
        this.camera.fov = vFovRad;
      }
    }

    // 4. Anisotropic Texture Filtering
    if (this.scene) {
      const filterLevel = this.graphicsSettings.anisotropicFiltering || 1;
      for (const tex of this.scene.textures) {
        tex.anisotropicFilteringLevel = filterLevel;
      }
    }
  }

  public setRtxShadows(enabled: boolean) {
    this.setGraphicsSettings({ shadows: enabled ? 'rtx' : 'off' });
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

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      this.keysDown = {};
      this.mouseButtons = {};
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
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
      if (!this.isPlaying || this.isPaused) return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      this.keysDown[e.code] = true;
      if (e.code === this.keybindings.reload) this.reload();
      if (e.code === this.keybindings.weapon1) this.switchWeapon('rifle');
      if (e.code === this.keybindings.weapon2) this.switchWeapon('sniper');
      if (e.code === this.keybindings.weapon3) this.switchWeapon('pistol');
      if (e.code === this.keybindings.weapon4) this.switchWeapon('knife');
      if (e.code === this.keybindings.quickswitch) this.switchWeapon(this.lastWeaponId);
      if (e.code === this.keybindings.fullscreen) {
        this.callbacks.onToggleFullscreen?.();
      }
      if (e.code === this.keybindings.scoreboard) {
        e.preventDefault();
        this.callbacks.onScoreboardToggle(true);
      }
    };
    window.addEventListener('keydown', this.boundKeyDown);

    this.boundKeyUp = (e) => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      if (this.keysDown[e.code]) {
        this.keysDown[e.code] = false;
      }
      if (e.code === this.keybindings.scoreboard) {
        this.callbacks.onScoreboardToggle(false);
      }
    };
    window.addEventListener('keyup', this.boundKeyUp);

    this.boundPointerMove = (e: PointerEvent) => {
      if (!this.isPlaying || this.isPaused) return;

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
      if (!this.isPlaying || this.isDead || this.isPaused) return;

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
        this.shoot(false);
      } else if (e.button === 2) {
        // Right click: Knife heavy attack OR Scope toggle
        if (this.activeWeaponId === 'knife') {
          this.shoot(true);
        } else {
          this.toggleScope();
        }
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
    if (this.isReloading || this.isPaused) return;
    const def = WEAPON_CATALOG[this.activeWeaponId];
    if (!def.hasScope) return;
    this.isScoped = !this.isScoped;
    this.camera.fov = this.isScoped ? this.defaultFov * def.scopeZoom : this.defaultFov;
    this.viewmodel.root.setEnabled(!this.isScoped);
    this.callbacks.onScopeChange?.(this.isScoped);
  }

  public reload() {
    if (this.isReloading || this.isDead || this.isPaused) return;
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

  public shoot(isHeavy = false) {
    if (!this.isPlaying || this.isDead || this.isReloading || this.isPaused) return;
    const now = performance.now();
    const def = WEAPON_CATALOG[this.activeWeaponId];

    // If weapon is out of ammo, clicking triggers reload immediately even during fire cooldown
    if (this.activeWeaponId !== 'knife' && this.ammoMag[this.activeWeaponId] <= 0) {
      this.reload();
      return;
    }

    const rpm = (this.activeWeaponId === 'knife' && isHeavy) ? (def.heavyFireRateRpm || 60) : def.fireRateRpm;
    const shotCooldown = (60 / rpm) * 1000;
    if (now - this.lastShotTime < shotCooldown) return;

    this.lastShotTime = now;
    if (this.activeWeaponId !== 'knife') {
      this.ammoMag[this.activeWeaponId]--;
      this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
    }

    // Raycast shooting via Babylon.js scene picking (BEFORE applying recoil so aim hits true crosshair center)
    // Knife is strictly capped at close melee combat range (2.3m), firearms at 300m
    const maxRayDist = this.activeWeaponId === 'knife' ? (def.range || 2.3) : 300;
    const forwardRay = this.camera.getForwardRay(maxRayDist);

    // Audio & Viewmodel attack animation (knife slash or gun recoil)
    strikeAudio.playGunfire(this.activeWeaponId, undefined, isHeavy);
    this.viewmodel.triggerAttack(this.activeWeaponId, def.recoilVertical, def.recoilHorizontal, isHeavy);

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

    // Check Counter-Strike style backstab angle for knife attacks:
    // Attacker looking forward dot victim facing direction > 0.45 (within ~63 degrees behind victim)
    let isBackstab = false;
    if (this.activeWeaponId === 'knife' && targetId !== null) {
      const victim = this.remoteAvatars.get(targetId) || this.remoteAvatars.get(Number(targetId));
      if (victim) {
        const victimYaw = victim.root.rotation.y;
        const attackerYaw = this.camera.rotation.y;
        const dot = Math.cos(attackerYaw - victimYaw);
        if (dot > 0.45) {
          isBackstab = true;
        }
      } else {
        // Fallback hit confirmation if remote avatar object not directly indexed
        isBackstab = true;
      }
    }

    let calculatedDmg = def.damage;
    if (this.activeWeaponId === 'knife') {
      if (isHeavy) {
        // Right click heavy attack: 65 frontal, 200 backstab (instant kill!)
        calculatedDmg = isBackstab ? (def.backstabDamage || 200) : (def.heavyDamage || 65);
      } else {
        // Left click quick attack: 35 frontal, 70 backstab
        calculatedDmg = isBackstab ? (def.quickBackstabDamage || 70) : def.damage;
      }
    } else {
      if (hitPart === 'head') calculatedDmg = Math.round(def.damage * def.headshotMultiplier);
      else if (hitPart === 'limb') calculatedDmg = Math.round(def.damage * 0.75);
    }

    if (targetId !== null) {
      strikeAudio.playHitmarker(isHeadshot || isBackstab);
      this.callbacks.onHitmarker(isHeadshot || isBackstab, calculatedDmg);
      if (isBackstab) {
        this.callbacks.onKillAnnouncement('Backstab!');
      }
    }

    this.callbacks.onLocalShoot(
      {
        origin: { x: forwardRay.origin.x, y: forwardRay.origin.y, z: forwardRay.origin.z },
        direction: { x: forwardRay.direction.x, y: forwardRay.direction.y, z: forwardRay.direction.z },
        maxDistance: maxRayDist,
        shooterId: 0,
        weaponId: this.activeWeaponId
      },
      isHeadshot || isBackstab,
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

    // Screen shake / trauma proportional to damage
    this.screenShakeTrauma = Math.min(1.0, this.screenShakeTrauma + Math.max(0.3, dmg / 45));
    this.callbacks.onDamageReceived?.(dmg, this.health);

    if (this.health <= 0) {
      this.isDead = true;
      this.isScoped = false;
      this.camera.fov = this.defaultFov;
      this.camera.rotation.z = 0;
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
    this.elapsedGameTime += dt;
    this.mapData?.updateDayNightCycle?.(this.elapsedGameTime);

    if (!this.isPlaying || this.isDead) return;

    // Apply trauma screen shake
    if (this.screenShakeTrauma > 0) {
      const traumaSq = this.screenShakeTrauma * this.screenShakeTrauma;
      const shakeRoll = (Math.random() - 0.5) * 0.05 * traumaSq;
      const shakePitch = (Math.random() - 0.5) * 0.03 * traumaSq;
      this.camera.rotation.z = shakeRoll;
      this.camera.rotation.x += (shakePitch - this.currentShakePitch);
      this.currentShakePitch = shakePitch;
      this.screenShakeTrauma = Math.max(0, this.screenShakeTrauma - dt * 2.8);
      if (this.screenShakeTrauma <= 0) {
        this.camera.rotation.z = 0;
        if (this.currentShakePitch !== 0) {
          this.camera.rotation.x -= this.currentShakePitch;
          this.currentShakePitch = 0;
        }
      }
    } else {
      if (this.camera.rotation.z !== 0) {
        this.camera.rotation.z = 0;
      }
      if (this.currentShakePitch !== 0) {
        this.camera.rotation.x -= this.currentShakePitch;
        this.currentShakePitch = 0;
      }
    }

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

    // Crouch and Walk states (disabled while paused in ESC menu)
    this.isCrouching = !this.isPaused && (!!this.keysDown[this.keybindings.crouch] || !!this.keysDown['KeyC'] || !!this.keysDown['ControlLeft']);
    this.isWalking = !this.isPaused && (!!this.keysDown[this.keybindings.walk] || !!this.keysDown['ShiftLeft'] || !!this.keysDown['ShiftRight']);

    // Speeds in m/s (CS-accurate competitive scale: ~250 units/s ≈ 6.5 m/s)
    const def = WEAPON_CATALOG[this.activeWeaponId];
    let maxSpeed = 6.6; // rifle baseline (~250 units/s)
    if (def.id === 'knife') maxSpeed = 7.0; // knife fast sprint (~260 units/s)
    if (def.id === 'sniper') maxSpeed = 5.6; // AWP carry speed (~200 units/s)
    if (def.id === 'pistol') maxSpeed = 6.8; // Deagle carry speed (~255 units/s)
    if (this.isCrouching) maxSpeed *= 0.35; // CS duck speed (~85 units/s)
    else if (this.isWalking) maxSpeed *= 0.52; // CS sneak walk (~130 units/s)

    // Movement input direction
    let forward = 0;
    let strafe = 0;
    if (!this.isPaused) {
      if (this.keysDown[this.keybindings.forward]) forward += 1;
      if (this.keysDown[this.keybindings.backward]) forward -= 1;
      if (this.keysDown[this.keybindings.left]) strafe -= 1;
      if (this.keysDown[this.keybindings.right]) strafe += 1;
    }

    // Transform movement direction by camera yaw
    const yaw = this.camera.rotation.y;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);

    const moveX = strafe * cos + forward * sin;
    const moveZ = -strafe * sin + forward * cos;
    const moveLen = Math.hypot(moveX, moveZ);
    const wishDirX = moveLen > 0 ? moveX / moveLen : 0;
    const wishDirZ = moveLen > 0 ? moveZ / moveLen : 0;

    if (this.onGround) {
      // 1. Counter-Strike Ground Friction Model (sv_friction)
      const curSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (moveLen === 0) {
        // Releasing keys: crisp stop without sliding on ice, zeroing micro-drift below threshold
        if (curSpeed < 0.08) {
          this.velocity.x = 0;
          this.velocity.z = 0;
        } else {
          const friction = 9.5; // Rapid deceleration (halts in ~0.10s)
          const stopSpeed = 1.8;
          const control = Math.max(curSpeed, stopSpeed);
          const drop = control * friction * dt;
          const newSpeed = Math.max(0, curSpeed - drop);
          const frac = newSpeed / curSpeed;
          this.velocity.x *= frac;
          this.velocity.z *= frac;
        }
      } else if (curSpeed > 0.001) {
        const friction = 5.2; // CS standard moving friction
        const stopSpeed = 1.0;
        const control = Math.max(curSpeed, stopSpeed);
        const drop = control * friction * dt;
        const newSpeed = Math.max(0, curSpeed - drop);
        const frac = newSpeed / curSpeed;
        this.velocity.x *= frac;
        this.velocity.z *= frac;
      }

      // 2. Counter-strafing rapid deceleration
      // Tapping the opposing key halts momentum near-instantaneously for pin-point accuracy stops
      if (moveLen > 0) {
        const currentSpeedInWish = this.velocity.x * wishDirX + this.velocity.z * wishDirZ;
        if (currentSpeedInWish < 0) {
          this.velocity.x *= Math.max(0, 1 - dt * 18);
          this.velocity.z *= Math.max(0, 1 - dt * 18);
        }

        // 3. Ground Acceleration (sv_accelerate)
        const addSpeed = maxSpeed - (this.velocity.x * wishDirX + this.velocity.z * wishDirZ);
        if (addSpeed > 0) {
          const accel = 5.8; // CS ground acceleration
          const accelSpeed = Math.min(addSpeed, accel * maxSpeed * dt);
          this.velocity.x += wishDirX * accelSpeed;
          this.velocity.z += wishDirZ * accelSpeed;
        }
      }
    } else {
      // 4. Counter-Strike Air Acceleration & Air Speed Cap
      // Responsive air steering with 2.2 m/s wish cap
      if (moveLen > 0) {
        const airWishSpeed = Math.min(maxSpeed, 2.2);
        const currentSpeedInWish = this.velocity.x * wishDirX + this.velocity.z * wishDirZ;
        const addSpeed = airWishSpeed - currentSpeedInWish;
        if (addSpeed > 0) {
          const airAccel = 14.0;
          const accelSpeed = Math.min(addSpeed, airAccel * airWishSpeed * dt);
          this.velocity.x += wishDirX * accelSpeed;
          this.velocity.z += wishDirZ * accelSpeed;
        }
      }
      // Air drag is minimal to conserve forward momentum
      this.velocity.x *= Math.max(0, 1 - dt * 0.15);
      this.velocity.z *= Math.max(0, 1 - dt * 0.15);
    }

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
      if (!this.isPaused && (this.keysDown[this.keybindings.jump] || this.keysDown['Space'])) {
        this.velocity.y = 5.8; // CS jump impulse (~280 units/s)
        this.onGround = false;
      } else {
        // When already firmly resting on courtyard floor (y <= 0.852), zero downward stick to eliminate collider jitter
        if (this.playerCollider.position.y <= 0.852) {
          this.velocity.y = 0;
        } else {
          this.velocity.y = -0.5; // gentle ground stick on slopes/stairs
        }
      }
    } else {
      this.velocity.y -= 21.0 * dt; // CS gravity (~800 units/s^2)
    }

    const dispY = (this.onGround && this.playerCollider.position.y <= 0.852 && this.velocity.y <= 0)
      ? 0
      : this.velocity.y * dt;

    // Native Babylon moveWithCollisions on playerCollider slides smoothly along walls & obstacles
    const displacement = new Vector3(
      this.velocity.x * dt,
      dispY,
      this.velocity.z * dt
    );

    // Only invoke swept-sphere collision solver if there is non-zero displacement
    if (displacement.lengthSquared() > 1e-7) {
      const prevY = this.playerCollider.position.y;
      this.playerCollider.moveWithCollisions(displacement);
      const deltaY = this.playerCollider.position.y - prevY;

      // Detect landing on elevated surfaces/stairs/boxes when moving downward
      if (displacement.y < -0.01 && deltaY > displacement.y * 0.5) {
        this.onGround = true;
        this.velocity.y = 0;
        // Landing friction: slight momentum dampening upon impact
        this.velocity.x *= 0.85;
        this.velocity.z *= 0.85;
      }
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

    // Synchronize local player shadow caster position and crouching scale
    if (this.localShadowCaster && this.playerCollider) {
      this.localShadowCaster.position.x = this.playerCollider.position.x;
      this.localShadowCaster.position.y = this.playerCollider.position.y;
      this.localShadowCaster.position.z = this.playerCollider.position.z;
      this.localShadowCaster.rotation.y = this.camera.rotation.y;
      const targetScaleY = this.isCrouching ? 0.7 : 1.0;
      this.localShadowCaster.scaling.y += (targetScaleY - this.localShadowCaster.scaling.y) * Math.min(1, dt * 14);
      this.localShadowCaster.setEnabled(!this.isDead);
    }

    // Check tactical wall proximity to tuck weapon back when close to walls
    const tuckRay = this.camera.getForwardRay(0.85);
    const tuckHit = this.scene.pickWithRay(tuckRay, (mesh) => {
      return (
        mesh.checkCollisions &&
        mesh !== this.playerCollider &&
        !mesh.name.startsWith('playerCollider') &&
        !mesh.name.startsWith('Viewmodel') &&
        !mesh.name.startsWith('FirstPerson') &&
        !mesh.name.startsWith('bulletTracer') &&
        !mesh.name.startsWith('avatarHead_') &&
        !mesh.name.startsWith('avatarBody_') &&
        (!this.viewmodel || !mesh.isDescendantOf(this.viewmodel.root))
      );
    });
    const wallDist = (tuckHit && tuckHit.hit) ? tuckHit.distance : 1.0;
    this.viewmodel.setWallProximity(wallDist);

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

    // Full-auto continuous shooting / knife holding
    if (this.mouseButtons[0]) {
      if (def.isAutomatic || this.activeWeaponId === 'knife') {
        this.shoot(false);
      }
    }
    if (this.mouseButtons[2] && this.activeWeaponId === 'knife') {
      this.shoot(true);
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

  public setKeybindings(bindings: StrikeKeybindings) {
    this.keybindings = { ...bindings };
  }

  public setRtxShadows(enabled: boolean) {
    this.mapData?.setRtxShadows?.(enabled);
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
    this.localShadowCaster?.dispose();
    this.localShadowCaster = null;
    this.viewmodel.dispose();
    this.remoteAvatars.forEach((av) => av.dispose());
    this.remoteAvatars.clear();

    // Dispose scene & engine
    this.scene.dispose();
    this.engine.dispose();
  }
}
