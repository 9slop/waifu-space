import {
  Engine,
  Scene,
  Vector3,
  Color4,
  Color3,
  UniversalCamera,
  Ray,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  AbstractMesh,
  DynamicTexture,
  GlowLayer
} from '@babylonjs/core';
import {
  WeaponId,
  WeaponDef,
  HitscanRay,
  StrikeMatchStats,
  StrikeKeybindings,
  DEFAULT_KEYBINDINGS,
  StrikeGraphicsSettings,
  DEFAULT_GRAPHICS_SETTINGS,
  GrenadeType,
  PlayerLoadout,
  DEFAULT_LOADOUT
} from './strike-types';
import { WEAPON_CATALOG, strikeAudio } from './strike-weapons';
import { createKyotoMap, BabylonMapData } from './strike-babylon-map';
import { BabylonViewmodel, BabylonAvatarModel } from './strike-babylon-avatars';
import { StrikeGrenadeManager } from './strike-grenades';

/**
 * Walks the parent chain of a picked mesh to detect whether it belongs to a
 * remote player avatar (root TransformNode named `PlayerAvatar_<id>`). Avatar
 * weapon meshes share generic names with the viewmodel (rifleBody, pistolSlide,
 * etc.), so ancestry is the only reliable check to avoid painting bullet marks
 * on players and to resolve hits on their held weapons.
 */
function isPlayerAffiliatedMesh(mesh: AbstractMesh): boolean {
  let node: { name?: string; parent?: unknown } | null = mesh;
  while (node) {
    const n = node.name || '';
    if (
      n.startsWith('PlayerAvatar_') ||
      n.startsWith('avatarHead_') ||
      n.startsWith('avatarBody_') ||
      n.startsWith('nameplate')
    ) {
      return true;
    }
    node = node.parent && typeof node.parent === 'object'
      ? (node.parent as { name?: string; parent?: unknown })
      : null;
  }
  return false;
}

/** Resolves the peer/player id of a mesh that belongs to a remote avatar. */
function resolveAvatarPlayerId(mesh: AbstractMesh): string | null {
  let node: { name?: string; parent?: unknown } | null = mesh;
  while (node) {
    const n = node.name || '';
    if (n.startsWith('PlayerAvatar_')) {
      return n.substring('PlayerAvatar_'.length) || null;
    }
    node = node.parent && typeof node.parent === 'object'
      ? (node.parent as { name?: string; parent?: unknown })
      : null;
  }
  return null;
}

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
  onGrenadeCountChange?: (count: number, type: GrenadeType) => void;
  onLocalGrenadeThrow?: (type: GrenadeType, origin: { x: number; y: number; z: number }, velocity: { x: number; y: number; z: number }) => void;
  onLoadoutToggle?: (visible: boolean) => void;
  onSmokeChange?: (inSmoke: boolean) => void;
  onGrenadeArmedChange?: (armed: boolean) => void;
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
    knife: 1,
    katana: 1
  };
  public ammoReserve: Record<WeaponId, number> = {
    rifle: 90,
    sniper: 25,
    pistol: 35,
    knife: 1,
    katana: 1
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
  private shakeRoll = 0;
  private shakePitch = 0;
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
  public bulletMarks: AbstractMesh[] = [];
  private bulletMarkMaterial: StandardMaterial | null = null;
  public glowLayer: GlowLayer | null = null;
  /** Meshes already excluded from the bloom glow layer (sky, clouds, weapons, nameplates). */
  private glowExcludedMeshes = new WeakSet<AbstractMesh>();
  public grenadeManager: StrikeGrenadeManager;
  public grenadeCount: number = 1;
  public loadout: PlayerLoadout = { ...DEFAULT_LOADOUT };
  private lastInSmoke: boolean = false;
  public grenadeArmed = false;
  public grenadeCharging = false;
  private grenadeTrajectoryPreview: AbstractMesh | null = null;
  private jumpQueued = false;

  // Blood FX (CS-style hit blood bursts + wall/floor blood marks)
  private bloodParticles: { mesh: AbstractMesh; velocity: Vector3; life: number }[] = [];
  private bloodMarkMaterial: StandardMaterial | null = null;
  private bloodParticleMaterial: StandardMaterial | null = null;

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

    // 4.5 Tactical Grenade Manager (Molotov, Smoke, HE Explosive)
    this.grenadeManager = new StrikeGrenadeManager(this.scene, {
      onDamageLocalPlayer: (dmg, source) => {
        this.applyDamage(dmg, source);
      },
      onExplosionShake: (trauma) => {
        this.screenShakeTrauma = Math.min(1.0, this.screenShakeTrauma + trauma);
      }
    });

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

    // Post-processing Bloom Glow Layer for map lamps, lanterns and fire
    try {
      this.glowLayer = new GlowLayer('glowLayer', this.scene, {
        blurKernelSize: 24,
        mainTextureRatio: 0.5
      });
      this.glowLayer.intensity = 0.85;
      this.glowLayer.isEnabled = this.graphicsSettings.postProcessing;
      this.refreshGlowExclusions();
    } catch (err) {
      console.warn('[StrikeEngine] GlowLayer initialization failed:', err);
    }

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

    // 5. Post-Processing / Bloom GlowLayer
    if (this.glowLayer) {
      this.glowLayer.isEnabled = !!this.graphicsSettings.postProcessing;
    }
  }

  /**
   * Excludes a mesh from the bloom GlowLayer once (idempotent WeakSet guard so
   * per-frame calls are cheap and disposed meshes auto-clean).
   */
  private addGlowExclusion(mesh: AbstractMesh | null | undefined) {
    if (!mesh || mesh.isDisposed()) return;
    if (this.glowExcludedMeshes.has(mesh)) return;
    if (!this.glowLayer) return;
    this.glowLayer.addExcludedMesh(mesh as Mesh);
    this.glowExcludedMeshes.add(mesh);
  }

  /**
   * Keeps sky dome + decorative cloud exclusions in sync with the bloom glow
   * layer so the sky stays clean and unmistakable with zero halo.
   */
  private refreshGlowExclusions() {
    if (!this.glowLayer || !this.glowLayer.isEnabled || !this.scene) return;
    this.addGlowExclusion(this.scene.getMeshByName('skyDome'));
    for (const m of this.scene.meshes) {
      if (m.name.startsWith('cloud')) this.addGlowExclusion(m);
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
      this.grenadeCharging = false;
      this.hideGrenadeTrajectory();
      this.velocity.x = 0;
      this.velocity.z = 0;
      // Restore the camera to neutral so pausing never leaves a tilted screen
      this.camera.rotation.z = 0;
      this.camera.rotation.x -= this.currentShakePitch + this.currentScopePitch;
      this.currentShakePitch = 0;
      this.currentScopePitch = 0;
      this.shakeRoll = 0;
      this.shakePitch = 0;
      this.screenShakeTrauma = 0;
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
      // Edge-triggered jump: only a fresh key press jumps (no infinite space-jumps),
      // but precise re-presses still allow bunnyhopping.
      if (e.code === this.keybindings.jump || e.code === 'Space') {
        this.jumpQueued = true;
      }
      if (e.code === this.keybindings.reload) this.reload();
      if (e.code === this.keybindings.weapon1) this.switchWeapon(this.loadout.primary);
      if (e.code === this.keybindings.weapon2) this.switchWeapon(this.loadout.secondary);
      if (e.code === this.keybindings.weapon3) this.switchWeapon(this.loadout.melee);
      if (e.code === this.keybindings.weapon4 || e.code === this.keybindings.grenade) this.toggleGrenadeArmed();
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
        if (this.grenadeArmed) {
          if (this.grenadeCount <= 0) {
            this.toggleGrenadeArmed();
          } else {
            this.grenadeCharging = true;
          }
        } else {
          // Immediate shot execution on left click
          this.shoot(false);
        }
      } else if (e.button === 2) {
        // Right click: Melee heavy attack OR Scope toggle
        const def = WEAPON_CATALOG[this.activeWeaponId];
        if (def.category === 'melee' || this.activeWeaponId === 'knife' || this.activeWeaponId === 'katana') {
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
      // Release-to-throw while a grenade is armed and charging
      if (e.button === 0 && this.grenadeArmed && this.grenadeCharging) {
        this.grenadeCharging = false;
        this.throwGrenade();
      }
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
    const weaponCycle: WeaponId[] = ['rifle', 'sniper', 'pistol', 'knife', 'katana'];
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
    this.ammoMag = { rifle: 30, sniper: 5, pistol: 7, knife: 1, katana: 1 };
    this.ammoReserve = { rifle: 90, sniper: 25, pistol: 35, knife: 1, katana: 1 };

    // Replenish tactical grenade according to loadout
    this.grenadeCount = 1;
    this.callbacks.onGrenadeCountChange?.(this.grenadeCount, this.loadout.grenade);

    this.callbacks.onHealthChange(this.health, this.maxHealth);
    this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
  }

  /**
   * Replenishes bullets to reserve ammo for the weapon used to secure a kill.
   * Returns updated reserve count, or 0 if melee.
   */
  public replenishReserveAmmo(weaponId: WeaponId, amount: number): number {
    if (weaponId === 'knife' || weaponId === 'katana') return 0;

    const maxReserves: Record<string, number> = {
      rifle: 180,
      sniper: 40,
      pistol: 70
    };
    const maxRes = maxReserves[weaponId] || 150;

    if (this.ammoReserve[weaponId] !== undefined) {
      this.ammoReserve[weaponId] = Math.min(maxRes, this.ammoReserve[weaponId] + amount);
      if (this.activeWeaponId === weaponId) {
        this.callbacks.onAmmoChange(this.ammoMag[weaponId], this.ammoReserve[weaponId]);
      }
      return this.ammoReserve[weaponId];
    }
    return 0;
  }

  public setLoadout(loadout: Partial<PlayerLoadout>) {
    this.loadout = { ...this.loadout, ...loadout };
    this.callbacks.onGrenadeCountChange?.(this.grenadeCount, this.loadout.grenade);
  }

  public throwGrenade() {
    if (!this.isPlaying || this.isDead || this.isPaused || this.grenadeCount <= 0) return;
    this.grenadeCount--;
    this.callbacks.onGrenadeCountChange?.(this.grenadeCount, this.loadout.grenade);

    const fwdRay = this.camera.getForwardRay(1.0);
    const origin = this.camera.position.add(fwdRay.direction.scale(0.35)).add(new Vector3(0, -0.1, 0));
    // Lofted throwing arc: 15.5 m/s forward + 2.8 m/s upward
    const velocity = fwdRay.direction.scale(15.5).add(new Vector3(0, 2.8, 0));

    this.grenadeManager.throwGrenade(this.loadout.grenade, origin, velocity, 'local');

    this.callbacks.onLocalGrenadeThrow?.(
      this.loadout.grenade,
      { x: origin.x, y: origin.y, z: origin.z },
      { x: velocity.x, y: velocity.y, z: velocity.z }
    );

    // Leave grenade aim mode after the throw
    this.grenadeCharging = false;
    this.disarmGrenade();
  }

  /**
   * Toggles grenade aim mode. While armed, holding LMB charges the throw and
   * shows a simulated trajectory preview; releasing LMB throws the grenade.
   */
  public toggleGrenadeArmed() {
    this.setGrenadeArmed(!this.grenadeArmed);
  }

  public armGrenade() {
    this.setGrenadeArmed(true);
  }

  public disarmGrenade() {
    this.setGrenadeArmed(false);
  }

  private setGrenadeArmed(armed: boolean) {
    if (armed && this.grenadeCount <= 0) {
      this.callbacks.onGrenadeArmedChange?.(false);
      return;
    }
    if (this.grenadeArmed === armed) return;
    this.grenadeArmed = armed;
    this.grenadeCharging = false;
    if (!armed) {
      this.hideGrenadeTrajectory();
    }
    this.callbacks.onGrenadeArmedChange?.(this.grenadeArmed);
  }

  /**
   * Simulates the grenade arc using the same physics as StrikeGrenadeManager
   * (gravity 18, drag 0.25, wall restitution 0.48) and renders a dashed preview.
   */
  private updateGrenadeTrajectory() {
    if (!this.scene || this.isDisposed) return;
    const fwdRay = this.camera.getForwardRay(1.0);
    const origin = this.camera.position.add(fwdRay.direction.scale(0.35)).add(new Vector3(0, -0.1, 0));
    const velocity = fwdRay.direction.scale(15.5).add(new Vector3(0, 2.8, 0));
    const points = this.computeGrenadeTrajectory(origin, velocity);

    if (!this.grenadeTrajectoryPreview) {
      this.grenadeTrajectoryPreview = MeshBuilder.CreateLines(
        'grenadeTrajectoryPreview',
        { points, updatable: true },
        this.scene
      );
      const lines = this.grenadeTrajectoryPreview as any;
      if (lines && typeof lines.color !== 'undefined') {
        lines.color = Color3.FromHexString('#00ffc9');
      }
      this.grenadeTrajectoryPreview.isPickable = false;
    } else {
      MeshBuilder.CreateLines(
        'grenadeTrajectoryPreview',
        { points, instance: this.grenadeTrajectoryPreview as any, updatable: true },
        this.scene
      );
    }
  }

  private computeGrenadeTrajectory(origin: Vector3, initialVel: Vector3, maxPoints = 46): Vector3[] {
    const pts: Vector3[] = [];
    const pos = origin.clone();
    let vel = initialVel.clone();
    const dtStep = 0.047;

    for (let i = 0; i < maxPoints; i++) {
      pts.push(pos.clone());
      vel.y -= 18.0 * dtStep;
      vel.x *= Math.max(0, 1 - 0.25 * dtStep);
      vel.z *= Math.max(0, 1 - 0.25 * dtStep);

      const step = vel.scale(dtStep);
      const stepLen = step.length();
      if (stepLen <= 0.001) break;

      const ray = new Ray(pos, step.clone().normalize(), stepLen + 0.06);
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
        pts.push(hit.pickedPoint.clone());
        const normal = hit.getNormal(true) || Vector3.Up();
        const dot = Vector3.Dot(vel, normal);
        vel = vel.subtract(normal.scale(2 * dot)).scale(0.48);
        pos.copyFrom(hit.pickedPoint.add(normal.scale(0.06)));
      } else {
        pos.addInPlace(step);
      }

      if (pos.y < -0.05) break;
    }
    return pts.length > 2 ? pts : [origin, origin.add(initialVel.scale(0.1))];
  }

  private hideGrenadeTrajectory() {
    if (this.grenadeTrajectoryPreview) {
      this.grenadeTrajectoryPreview.dispose();
      this.grenadeTrajectoryPreview = null;
    }
  }

  public switchWeapon(id: WeaponId) {
    if (this.activeWeaponId === id || this.isDead) return;
    // Swapping away disarms grenade aim mode (slot 4)
    if (this.grenadeArmed) {
      this.disarmGrenade();
    }
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
    const isMelee = def.category === 'melee' || this.activeWeaponId === 'knife' || this.activeWeaponId === 'katana';

    // If firearm is out of ammo, clicking triggers reload immediately even during fire cooldown
    if (!isMelee && this.ammoMag[this.activeWeaponId] <= 0) {
      this.reload();
      return;
    }

    const rpm = (isMelee && isHeavy) ? (def.heavyFireRateRpm || 50) : def.fireRateRpm;
    const shotCooldown = (60 / rpm) * 1000;
    if (now - this.lastShotTime < shotCooldown) return;

    this.lastShotTime = now;
    if (!isMelee) {
      this.ammoMag[this.activeWeaponId]--;
      this.callbacks.onAmmoChange(this.ammoMag[this.activeWeaponId], this.ammoReserve[this.activeWeaponId]);
    }

    // Raycast shooting via Babylon.js scene picking (BEFORE applying recoil so aim hits true crosshair center)
    // Melee weapons are capped at close combat range (knife 2.2m, katana 2.8m), firearms at 300m
    const maxRayDist = isMelee ? (def.range || 2.4) : 300;
    const forwardRay = this.camera.getForwardRay(maxRayDist);

    // Audio & Viewmodel attack animation (melee slash/thrust or gun recoil)
    strikeAudio.playGunfire(this.activeWeaponId, undefined, isHeavy);
    this.viewmodel.triggerAttack(this.activeWeaponId, def.recoilVertical, def.recoilHorizontal, isHeavy);

    // Apply slight pitch recoil to camera AFTER forward ray is computed (guns only)
    if (!isMelee) {
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
        } else if (isPlayerAffiliatedMesh(hit.pickedMesh)) {
          // Hit a remote avatar's held weapon / accessory mesh (generic names like
          // rifleBody, pistolSlide). Resolve ownership via the avatar root so the
          // shot never paints a floating bullet mark and counts as a limb hit.
          isHeadshot = false;
          hitPart = 'limb';
          targetId = resolveAvatarPlayerId(hit.pickedMesh);
        }
      }
    }

    // Visual Tracer line & Bullet Marks (guns only, melee weapons do not emit bullet tracers or marks)
    if (!isMelee) {
      this.createTracer(forwardRay.origin.add(new Vector3(0, -0.15, 0)), hitPoint, def.color);
      // Spawn bullet impact mark on world objects ONLY (walls, ground, crates, pillars).
      // Player hits (avatars, hitboxes, held weapons) never receive marks because the
      // player may move, leaving the decal floating in the air.
      const hitPlayer = targetId !== null || (hit && hit.hit && hit.pickedMesh && isPlayerAffiliatedMesh(hit.pickedMesh));
      if (!hitPlayer && hit && hit.hit && hit.pickedPoint) {
        const normal = hit.getNormal(true) || Vector3.Up();
        this.spawnBulletMark(hit.pickedPoint, normal);
      }
    }

    // CS-style blood burst + blood mark on the surface behind the victim when a
    // bullet connects with a player (firearms only).
    if (targetId !== null && !isMelee && hit && hit.hit && hit.pickedPoint) {
      const hitNormal = hit.getNormal(true) || Vector3.Up();
      this.spawnBloodBurst(hitPoint, hitNormal);
      this.spawnBloodMarkBehind(hitPoint, forwardRay.direction);
    }

    // Check Counter-Strike style backstab angle for melee attacks:
    // Attacker looking forward dot victim facing direction > 0.45 (within ~63 degrees behind victim)
    let isBackstab = false;
    if (isMelee && targetId !== null) {
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
    if (isMelee) {
      if (isHeavy) {
        // Right click heavy attack: frontal heavy damage vs backstab instant kill
        calculatedDmg = isBackstab ? (def.backstabDamage || 200) : (def.heavyDamage || 65);
      } else {
        // Left click quick attack
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

  public createTracer(start: Vector3, end: Vector3, colorHex: string) {
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

  /**
   * Spawns an authentic bullet impact mark on world surfaces.
   * Auto-removes after 2 minutes (120 seconds).
   */
  public spawnBulletMark(position: Vector3, normal: Vector3) {
    if (this.isDisposed || !this.scene) return;
    const norm = (normal && normal.lengthSquared() > 0.001) ? normal.normalize() : new Vector3(0, 1, 0);

    const mark = MeshBuilder.CreatePlane('bulletMark', { size: 0.16 }, this.scene);
    mark.position = position.add(norm.scale(0.006));
    mark.lookAt(mark.position.add(norm));
    mark.rotation.z = Math.random() * Math.PI * 2;
    mark.material = this.getOrCreateBulletMarkMaterial();
    mark.isPickable = false;
    mark.doNotSyncBoundingInfo = true;
    mark.freezeWorldMatrix();

    this.bulletMarks.push(mark);
    if (this.bulletMarks.length > 250) {
      const oldest = this.bulletMarks.shift();
      if (oldest && !oldest.isDisposed()) {
        oldest.dispose();
      }
    }

    // Auto-remove marks after exactly 2 minutes (120 seconds) for client
    setTimeout(() => {
      if (!mark.isDisposed()) {
        mark.dispose();
        const idx = this.bulletMarks.indexOf(mark);
        if (idx !== -1) {
          this.bulletMarks.splice(idx, 1);
        }
      }
    }, 120000);
  }

  /**
   * CS-style blood burst at a damage point: a handful of small crimson droplets
   * that spray outward with gravity and fade out within ~0.5s.
   */
  public spawnBloodBurst(position: Vector3, normal: Vector3) {
    if (this.isDisposed || !this.scene) return;
    const origin = position.add(normal.scale(0.03));
    const count = 10 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      const size = 0.018 + Math.random() * 0.03;
      const droplet = MeshBuilder.CreateSphere(
        `bloodDroplet_${i}`,
        { diameter: size, segments: 4 },
        this.scene
      );
      droplet.position = origin.clone();
      droplet.material = this.getOrCreateBloodParticleMaterial();
      droplet.isPickable = false;
      droplet.doNotSyncBoundingInfo = true;

      const speed = 2.2 + Math.random() * 3.2;
      const dir = new Vector3(
        (Math.random() - 0.5),
        Math.random() * 0.6 + 0.4,
        (Math.random() - 0.5)
      ).normalize().add(normal.scale(0.7)).normalize();
      const velocity = dir.scale(speed * (0.6 + Math.random()));

      this.bloodParticles.push({
        mesh: droplet,
        velocity,
        life: 0.35 + Math.random() * 0.2
      });
    }

    // Hard cap to protect against long firefights
    while (this.bloodParticles.length > 160) {
      const oldest = this.bloodParticles.shift();
      if (oldest && !oldest.mesh.isDisposed()) {
        oldest.mesh.dispose();
      }
    }
  }

  /**
   * Traces a short ray from a player hit point along the bullet's travel direction
   * to find the wall/floor behind the victim and splatter a blood mark there.
   */
  public spawnBloodMarkBehind(hitPoint: Vector3, dir: Vector3) {
    if (this.isDisposed || !this.scene) return;
    const dirN = dir.lengthSquared() > 0.001 ? dir.clone().normalize() : new Vector3(0, 0, 1);
    const ray = new Ray(hitPoint, dirN, 2.4);
    const hit = this.scene.pickWithRay(ray, (m) => {
      return (
        m.isPickable &&
        !m.name.startsWith('Viewmodel') &&
        !m.name.startsWith('FirstPerson') &&
        !m.name.startsWith('playerCollider') &&
        !m.name.startsWith('hitbox') &&
        !isPlayerAffiliatedMesh(m)
      );
    });
    if (hit && hit.hit && hit.pickedPoint) {
      const normal = hit.getNormal(true) || Vector3.Up();
      this.spawnBloodMark(hit.pickedPoint, normal);
    }
  }

  /** Places a persistent dark-crimson blood splat decal on a world surface. */
  public spawnBloodMark(position: Vector3, normal: Vector3) {
    if (this.isDisposed || !this.scene) return;
    const norm = (normal && normal.lengthSquared() > 0.001) ? normal.normalize() : new Vector3(0, 1, 0);

    const mark = MeshBuilder.CreatePlane('bloodMark', { size: 0.34 + Math.random() * 0.22 }, this.scene);
    mark.position = position.add(norm.scale(0.012));
    mark.lookAt(mark.position.add(norm));
    mark.rotation.z = Math.random() * Math.PI * 2;
    mark.material = this.getOrCreateBloodMarkMaterial();
    mark.isPickable = false;
    mark.doNotSyncBoundingInfo = true;
    mark.freezeWorldMatrix();

    this.bulletMarks.push(mark);
    if (this.bulletMarks.length > 250) {
      const oldest = this.bulletMarks.shift();
      if (oldest && !oldest.isDisposed()) {
        oldest.dispose();
      }
    }

    setTimeout(() => {
      if (!mark.isDisposed()) {
        mark.dispose();
        const idx = this.bulletMarks.indexOf(mark);
        if (idx !== -1) {
          this.bulletMarks.splice(idx, 1);
        }
      }
    }, 60000);
  }

  private getOrCreateBloodParticleMaterial(): StandardMaterial {
    if (this.bloodParticleMaterial && this.scene?.materials.includes(this.bloodParticleMaterial)) {
      return this.bloodParticleMaterial;
    }
    const mat = new StandardMaterial('bloodParticleMat', this.scene);
    mat.diffuseColor = new Color3(0.55, 0.06, 0.05);
    mat.emissiveColor = new Color3(0.3, 0.02, 0.02);
    mat.specularColor = new Color3(0, 0, 0);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    this.bloodParticleMaterial = mat;
    return mat;
  }

  private getOrCreateBloodMarkMaterial(): StandardMaterial {
    if (this.bloodMarkMaterial && this.scene?.materials.includes(this.bloodMarkMaterial)) {
      return this.bloodMarkMaterial;
    }
    const mat = new StandardMaterial('bloodMarkMat', this.scene);
    const tex = new DynamicTexture('bloodMarkTex', { width: 64, height: 64 }, this.scene, false);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);
      const grad = ctx.createRadialGradient ? ctx.createRadialGradient(32, 32, 4, 32, 32, 28) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(120, 8, 8, 0.95)');
        grad.addColorStop(0.45, 'rgba(100, 10, 12, 0.85)');
        grad.addColorStop(0.85, 'rgba(70, 12, 14, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
      }
      // Irregular spray splatter asymmetry
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 6 + Math.random() * 18;
        ctx.beginPath();
        ctx.arc(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 1.5 + Math.random() * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(110, 8, 10, ${(0.3 + Math.random() * 0.5).toFixed(2)})`;
        ctx.fill();
      }
      tex.hasAlpha = true;
      tex.update();
    }
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(0.02, 0.01, 0.01);
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    this.bloodMarkMaterial = mat;
    return mat;
  }

  private updateBloodParticles(dt: number) {
    if (this.bloodParticles.length === 0) return;
    for (let i = this.bloodParticles.length - 1; i >= 0; i--) {
      const p = this.bloodParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (!p.mesh.isDisposed()) p.mesh.dispose();
        this.bloodParticles.splice(i, 1);
        continue;
      }
      p.velocity.y -= 9.8 * dt;
      const pos = p.mesh.position;
      pos.x += p.velocity.x * dt;
      pos.y += p.velocity.y * dt;
      pos.z += p.velocity.z * dt;
      p.mesh.position = pos;
      // Quick fade via scaling down
      const s = Math.max(0.05, p.life / 0.45);
      p.mesh.scaling.set(s, s, s);
    }
  }

  private getOrCreateBulletMarkMaterial(): StandardMaterial {
    // Only reuse the cached material while it is still alive and registered to the
    // current scene. Babylon 9 dropped the `isDisposed()` method on Materials (it is
    // a property there), so `scene.materials.includes()` is the reliable liveness
    // check that prevents reusing a disposed material and freezing the render loop.
    if (this.bulletMarkMaterial && this.scene?.materials.includes(this.bulletMarkMaterial)) {
      return this.bulletMarkMaterial;
    }
    const mat = new StandardMaterial('bulletMarkMat', this.scene);
    const tex = new DynamicTexture('bulletMarkTex', { width: 64, height: 64 }, this.scene, false);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);

      // Charred radial scorch
      const grad = ctx.createRadialGradient ? ctx.createRadialGradient(32, 32, 3, 32, 32, 28) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(15, 15, 18, 0.95)');
        grad.addColorStop(0.35, 'rgba(35, 35, 40, 0.85)');
        grad.addColorStop(0.7, 'rgba(60, 60, 65, 0.45)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
      } else {
        ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
        ctx.fillRect(8, 8, 48, 48);
      }

      // Chipped stone / concrete jagged edge
      ctx.strokeStyle = 'rgba(180, 180, 190, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.45) {
        const r = 9 + Math.sin(a * 7) * 3;
        const x = 32 + Math.cos(a) * r;
        const y = 32 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Deep black core penetration
      ctx.fillStyle = '#0a0a0c';
      ctx.beginPath();
      ctx.arc(32, 32, 7.5, 0, Math.PI * 2);
      ctx.fill();

      tex.hasAlpha = true;
      tex.update();
    }
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(0.02, 0.02, 0.02);
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    this.bulletMarkMaterial = mat;
    return mat;
  }

  public handleRemoteBulletImpact(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    maxDist = 300,
    tracerColor = '#ffd32a'
  ) {
    if (this.isDisposed || !this.scene) return;
    const startVec = new Vector3(origin.x, origin.y, origin.z);
    const dirVec = new Vector3(dir.x, dir.y, dir.z).normalize();
    const ray = new Ray(startVec, dirVec, maxDist);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return (
        mesh.isPickable &&
        mesh !== this.playerCollider &&
        !mesh.name.startsWith('playerCollider') &&
        !mesh.name.startsWith('Viewmodel') &&
        !mesh.name.startsWith('FirstPerson') &&
        (!this.viewmodel || !mesh.isDescendantOf(this.viewmodel.root))
      );
    });

    const hitPoint = hit && hit.hit && hit.pickedPoint ? hit.pickedPoint : startVec.add(dirVec.scale(maxDist));
    this.createTracer(startVec, hitPoint, tracerColor);

    if (hit && hit.hit && hit.pickedMesh && hit.pickedPoint) {
      const isPlayer = hit.pickedMesh.metadata?.isHitbox ||
        isPlayerAffiliatedMesh(hit.pickedMesh) ||
        hit.pickedMesh.name.startsWith('avatar') ||
        hit.pickedMesh.name.startsWith('hitbox');
      if (isPlayer) {
        // Blood FX when a bullet connects with a player (owner shoots, others see it)
        const normal = hit.getNormal(true) || Vector3.Up();
        this.spawnBloodBurst(hit.pickedPoint, normal);
        this.spawnBloodMarkBehind(hit.pickedPoint, dirVec);
      } else {
        const normal = hit.getNormal(true) || Vector3.Up();
        this.spawnBulletMark(hit.pickedPoint, normal);
      }
    }
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

    // Blood spray on the local player's chest + a splatter on the floor beneath
    if (this.scene) {
      this.spawnBloodBurst(this.camera.position.add(new Vector3(0, 0.25, 0)), new Vector3(0, 1, 0));
      const downRay = new Ray(this.camera.position, new Vector3(0, -1, 0), 2.8);
      const floorHit = this.scene.pickWithRay(downRay, (m) => {
        return (
          m.isPickable &&
          !m.name.startsWith('Viewmodel') &&
          !m.name.startsWith('FirstPerson') &&
          !m.name.startsWith('playerCollider') &&
          !m.name.startsWith('hitbox')
        );
      });
      if (floorHit && floorHit.hit && floorHit.pickedPoint) {
        const normal = floorHit.getNormal(true) || Vector3.Up();
        this.spawnBloodMark(floorHit.pickedPoint, normal);
      }
    }

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
    this.grenadeManager.update(dt, this.playerCollider ? this.playerCollider.position : this.camera.position);
    this.updateBloodParticles(dt);
    this.refreshGlowExclusions();

    // Grenade aim trajectory preview while holding LMB to charge the throw
    if (this.grenadeArmed && this.grenadeCharging && this.mouseButtons[0]) {
      this.updateGrenadeTrajectory();
    } else if (this.grenadeTrajectoryPreview && !this.grenadeCharging) {
      this.hideGrenadeTrajectory();
    }

    const inSmoke = this.grenadeManager.isPositionInSmoke(this.camera.position);
    if (inSmoke !== this.lastInSmoke) {
      this.lastInSmoke = inSmoke;
      this.callbacks.onSmokeChange?.(inSmoke);
    }

    if (!this.isPlaying || this.isDead) return;

    // Trauma screen shake that ALWAYS decays smoothly back to neutral so the
    // screen never stays tilted after a hit.
    if (this.screenShakeTrauma > 0.001) {
      const traumaSq = this.screenShakeTrauma * this.screenShakeTrauma;
      this.shakeRoll += ((Math.random() - 0.5) * 0.045 * traumaSq - this.shakeRoll) * Math.min(1, dt * 14);
      this.shakePitch += ((Math.random() - 0.5) * 0.026 * traumaSq - this.shakePitch) * Math.min(1, dt * 14);
      this.screenShakeTrauma = Math.max(0, this.screenShakeTrauma - dt * 3.4);
    } else {
      this.screenShakeTrauma = 0;
      this.shakeRoll *= Math.max(0, 1 - dt * 12);
      this.shakePitch *= Math.max(0, 1 - dt * 12);
    }

    // Apply as a delta so pitch/roll always return to the mouse-control baseline
    this.camera.rotation.x += (this.shakePitch - this.currentShakePitch);
    this.currentShakePitch = this.shakePitch;
    this.camera.rotation.z = this.shakeRoll;

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
    if (def.id === 'katana') maxSpeed = 6.2; // katana is heavier to carry (~235 units/s)
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

        // 3. Ground Acceleration (Source/CS sv_accelerate style ramp)
        const addSpeed = maxSpeed - (this.velocity.x * wishDirX + this.velocity.z * wishDirZ);
        if (addSpeed > 0) {
          const accel = 8.0; // Source-like ground acceleration ramp (smooth build-up)
          const accelSpeed = Math.min(addSpeed, accel * maxSpeed * dt);
          this.velocity.x += wishDirX * accelSpeed;
          this.velocity.z += wishDirZ * accelSpeed;
        }
      }
    } else {
      // 4. Counter-Strike / Source Air Acceleration & Air Speed Cap
      // Responsive air steering with a slightly stronger air-control ramp
      if (moveLen > 0) {
        const airWishSpeed = Math.min(maxSpeed, 2.6);
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

    // Gravity & Jump (edge-triggered press: holding Space no longer re-jumps on
    // every landing, but a fresh press while landing still bunnyhops).
    let jumpPressed = false;
    if (this.jumpQueued) {
      this.jumpQueued = false;
      jumpPressed = true;
    }
    if (this.onGround) {
      if (!this.isPaused && jumpPressed) {
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

    // Full-auto continuous shooting / knife holding (blocked while a grenade is armed)
    if (this.mouseButtons[0] && !this.grenadeArmed) {
      if (def.isAutomatic || this.activeWeaponId === 'knife') {
        this.shoot(false);
      }
    }
    if (this.mouseButtons[2] && this.activeWeaponId === 'knife') {
      this.shoot(true);
    }

    // Keep held weapons (viewmodel + remote avatar guns) out of the bloom layer
    this.excludeWeaponGlow();
  }

  /** Held weapons never bloom: first-person viewmodel + every remote avatar gun */
  private excludeWeaponGlow() {
    const viewmodelRoot = this.viewmodel?.root;
    if (viewmodelRoot) {
      for (const m of viewmodelRoot.getChildMeshes(false)) this.addGlowExclusion(m);
    }
    this.remoteAvatars.forEach((av) => {
      const children = av.weaponMount?.getChildMeshes?.(false) || [];
      for (const m of children) this.addGlowExclusion(m);
    });
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

    // Dispose collider, viewmodel, bullet marks & avatars
    this.playerCollider?.dispose();
    this.localShadowCaster?.dispose();
    this.localShadowCaster = null;
    this.bulletMarks.forEach((m) => {
      if (!m.isDisposed()) m.dispose();
    });
    this.bulletMarks = [];
    this.bulletMarkMaterial?.dispose();
    this.bulletMarkMaterial = null;
    this.bloodParticles.forEach((p) => {
      if (!p.mesh.isDisposed()) p.mesh.dispose();
    });
    this.bloodParticles = [];
    this.bloodMarkMaterial?.dispose();
    this.bloodMarkMaterial = null;
    this.bloodParticleMaterial?.dispose();
    this.bloodParticleMaterial = null;
    this.hideGrenadeTrajectory();
    if (this.glowLayer) {
      this.glowLayer.dispose();
      this.glowLayer = null;
    }
    this.grenadeManager.dispose();
    this.viewmodel.dispose();
    this.remoteAvatars.forEach((av) => av.dispose());
    this.remoteAvatars.clear();

    // Dispose scene & engine
    this.scene.dispose();
    this.engine.dispose();
  }
}
