import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  Ray,
  Plane,
  Color3,
  Color4,
  AbstractMesh,
  GroundMesh,
  GizmoManager,
  MeshBuilder,
  DynamicTexture,
  Texture,
  StandardMaterial,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  GlowLayer,
  PointerEventTypes
} from '@babylonjs/core';
import type { MapBuilder } from '../types';
import { createMapBuilder } from '../builder';
import { buildLayout, buildLayoutLight, buildMapObject, disposeObjectMeshes, loadDefaultLayout } from '../layout';
import { buildSky } from '../sections';
import { emptyLayout, parseLayout, serializeLayout } from '../map-format';
import type { MapBoxObject, MapGroundObject, MapLayout, MapLight, MapObject, MapSpawn } from '../map-format';
import { createComponentObject, COMPONENTS } from '../components/registry';
import {
  TERRAIN_SUBDIVISIONS,
  TERRAIN_MIN_SUBDIVISIONS,
  makeTerrainHeights,
  sanitizeTerrainHeights,
  subdivisionsFromHeightmap,
  terrainCellSizeX,
  terrainCellSizeZ,
  terrainWorldToGrid,
  raiseHeights,
  lowerHeights,
  smoothHeights,
  applyHeightmapToMesh
} from '../terrain';
import type { TerrainBrushSpec } from '../terrain';

export interface EditorTool {
  type: 'translate' | 'rotate' | 'scale';
}

/** Terrain painting tools. 'none' restores normal object editing. */
export type TerrainTool = 'none' | 'raise' | 'lower' | 'smooth' | 'paint';

/** Live editor state for one sculpted ground object. */
export interface TerrainGroundEntry {
  id: string;
  width: number;
  height: number;
  /** Target subdivision count (persisted on the layout object on first edit). */
  subdivisions: number;
  /** Subdivisions of the live mesh (differs until a legacy ground is upgraded). */
  meshSubdivisions: number;
  /** Working heightfield; null until a legacy (subdivision-1-like) ground gets sculpted. */
  heights: number[] | null;
  control: GroundMesh | null;
}

export interface EditorObjectInfo {
  id: string;
  name: string;
  kind: 'box' | 'ground' | 'component';
  component?: string;
  locked: boolean;
}

export interface EditorSelectionInfo {
  id: string;
  name: string;
  kind: 'box' | 'ground' | 'component';
  component?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: [number, number, number];
  material?: string;
  collidable: boolean;
  locked: boolean;
  params: Record<string, number | string | boolean>;
}

export interface EditorLightInfo {
  id: string;
  name: string;
  position: [number, number, number];
  color: [number, number, number];
  intensity: number;
  range: number;
}

export interface EditorSpawnInfo {
  index: number;
  team: 'A' | 'B';
  position: [number, number, number];
  yaw: number;
}

export type EditorSelectionKind = 'none' | 'object' | 'light' | 'spawn';

/** Human-friendly editors for each reusable component's params (inspector). */
export const COMPONENT_PARAM_SPECS: Record<
  string,
  Record<string, { type: 'number' | 'boolean' | 'choice'; label?: string; default?: number | string | boolean; choices?: string[] }>
> = {
  machia: {
    w: { type: 'number', label: 'Width', default: 8 },
    h: { type: 'number', label: 'Height', default: 4.5 },
    d: { type: 'number', label: 'Depth', default: 6 },
    hasVeranda: { type: 'boolean', label: 'Veranda', default: true },
    verandaSide: { type: 'choice', label: 'Veranda side', default: 'south', choices: ['north', 'south', 'east', 'west'] },
    hasShoji: { type: 'boolean', label: 'Shoji screens', default: true }
  },
  kura: {
    w: { type: 'number', label: 'Width', default: 6 },
    h: { type: 'number', label: 'Height', default: 5.5 },
    d: { type: 'number', label: 'Depth', default: 5 }
  },
  sakura: {},
  bush: { radius: { type: 'number', label: 'Radius', default: 1 } },
  bamboo: {
    length: { type: 'number', label: 'Length', default: 5 },
    alongZ: { type: 'boolean', label: 'Along Z', default: true }
  },
  torii: { scale: { type: 'number', label: 'Scale', default: 1 } },
  stoneLantern: {},
  hangingLantern: {},
  crateCluster: { withStack: { type: 'boolean', label: 'Stacked', default: true } },
  merchantStall: {
    w: { type: 'number', label: 'Width', default: 6 },
    d: { type: 'number', label: 'Depth', default: 4 },
    openSide: { type: 'choice', label: 'Open side', default: 'south', choices: ['north', 'south', 'east', 'west'] }
  },
  sakeBarrels: { isLarge: { type: 'boolean', label: 'Large stack', default: false } },
  woodenCart: {},
  lamppost: {
    height: { type: 'number', label: 'Height', default: 3.6 },
    lightOn: { type: 'boolean', label: 'Light on', default: true }
  },
  well: {},
  parkBench: {},
  storeSign: {
    glyph: { type: 'choice', label: 'Sign text', default: '茶', choices: ['茶', '酒', '食', '花', '店', '石'] }
  },
  fountain: { tiers: { type: 'number', label: 'Tiers', default: 3 } },
  flowerPot: { size: { type: 'number', label: 'Size', default: 1 } },
  bambooWaterFeature: {},
  rockGarden: { scale: { type: 'number', label: 'Scale', default: 1 } },
  stonePath: { length: { type: 'number', label: 'Length', default: 5 } },
  windChime: {},
  stoneArch: { scale: { type: 'number', label: 'Scale', default: 1 } },
  pagoda: { tiers: { type: 'number', label: 'Tiers', default: 3 } },
  shrineTable: {},
  bannerPole: {
    color: { type: 'choice', label: 'Banner color', default: 'red', choices: ['red', 'white'] }
  },
  pathMarker: {},
  ornamentalBridge: { span: { type: 'number', label: 'Span', default: 4 } },
  door: {
    width: { type: 'number', label: 'Width', default: 1.2 },
    height: { type: 'number', label: 'Height', default: 2.4 },
    swing: { type: 'choice', label: 'Hinge swing', default: 1, choices: ['1', '-1'] }
  },
  futon: { width: { type: 'number', label: 'Width', default: 1.9 } },
  table: {
    width: { type: 'number', label: 'Width', default: 1.8 },
    depth: { type: 'number', label: 'Depth', default: 1 }
  },
  chair: {},
  mangaPile: { count: { type: 'number', label: 'Volumes', default: 6 } },
  serverRack: {
    rows: { type: 'number', label: 'Bays', default: 3 },
    blinkSpeed: { type: 'number', label: 'Blink speed', default: 2 }
  },
  computerDesk: {
    rgbOn: { type: 'boolean', label: 'RGB lighting', default: true },
    monitorSize: { type: 'number', label: 'Monitor size', default: 1 }
  },
  bambooPlant: { height: { type: 'number', label: 'Height', default: 4 } },
  sakuraBig: { scale: { type: 'number', label: 'Scale', default: 1 } },
  oakFence: {
    length: { type: 'number', label: 'Length', default: 4 },
    alongZ: { type: 'boolean', label: 'Along Z', default: true }
  },
  fallenWood: {
    length: { type: 'number', label: 'Length', default: 1.6 },
    alongZ: { type: 'boolean', label: 'Along Z', default: true }
  },
  japanFlag: { size: { type: 'number', label: 'Size', default: 1 } },
  rock: {
    variant: { type: 'choice', label: 'Variant', default: 0, choices: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] },
    scale: { type: 'number', label: 'Scale', default: 1 }
  },
  wall: {
    width: { type: 'number', label: 'Width', default: 4 },
    height: { type: 'number', label: 'Height', default: 3 },
    style: { type: 'choice', label: 'Style', default: 'plaster', choices: ['plaster', 'timber', 'stone', 'shoji'] }
  },
  floor: {
    width: { type: 'number', label: 'Width', default: 4 },
    depth: { type: 'number', label: 'Depth', default: 4 },
    style: { type: 'choice', label: 'Style', default: 'woodDeck', choices: ['woodDeck', 'tatami', 'stone', 'sand'] }
  },
  roof: {
    width: { type: 'number', label: 'Width', default: 4 },
    depth: { type: 'number', label: 'Depth', default: 4 },
    style: { type: 'choice', label: 'Style', default: 'tileRoof', choices: ['tileRoof', 'straw', 'shrineRed', 'metal'] }
  }
};

/** Camera fly speed in meters/second (Shift triples it). */
const FLY_SPEED = 14;

function cloneLayout(layout: MapLayout): MapLayout {
  return JSON.parse(JSON.stringify(layout)) as MapLayout;
}

function nextEditorId(layout: MapLayout): string {
  let max = 0;
  const all = [...layout.objects, ...layout.lights];
  for (const o of all) {
    const m = /^o_(\d{4,})$/.exec(o.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `o_${(max + 1).toString().padStart(4, '0')}`;
}

/**
 * Pure scene controller for the Waifu Strike map editor. Owns a Babylon
 * scene (engine + camera + gizmos + picking) and a working MapLayout that
 * stays in sync with the meshes. UI components talk to it through small
 * value methods and an onChange() callback.
 */
export class StrikeMapEditorController {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly b: MapBuilder;
  readonly canvas: HTMLCanvasElement;

  layout: MapLayout;
  dirty = false;

  snapEnabled = true;
  translateSnap = 0.5;
  rotateSnap = Math.PI / 12; // 15°
  /** When true, objects rest on the surface below them when moved/placed. */
  snapToGroundEnabled = true;

  onChange?: () => void;

  private camera: ArcRotateCamera;
  private gizmo: GizmoManager;
  private controlOf: Map<string, AbstractMesh> = new Map();
  private editorLights: Array<HemisphericLight | DirectionalLight> = [];
  private spawnMarkers: AbstractMesh[] = [];
  private pressedKeys: Set<string> = new Set();
  /** Object selected from the list while locked (scene clicks are ignored). */
  private lockedSel: string | null = null;

  // ── Terrain sculpting ────────────────────────────────────────────────────
  private terrainOf = new Map<string, TerrainGroundEntry>();
  private terrainStroke: {
    pointerId: number;
    objectId: string;
    lastWorld: Vector3 | null;
    historyPushed: boolean;
  } | null = null;
  private terrainCursor: AbstractMesh | null = null;

  onGizmoMode: 'translate' | 'rotate' | 'scale' = 'translate';

  /** Active terrain tool; 'none' puts the editor back in object-edit mode. */
  terrainTool: TerrainTool = 'none';
  /** Terrain brush size in meters (diameter). */
  brushSize = 8;
  /** Raise/lower amount in meters per unit of drag (smooth strength factor). */
  brushStrength = 1;
  /** Texture brush source material key (paint tool; see TerrainTool). */
  paintMaterial: string | null = null;

  /** Active shift+drag "move to cursor" gesture (null when idle). */
  private dragMove: {
    pointerId: number;
    objectId: string;
    offsetX: number;
    offsetZ: number;
    startHeight: number;
    moved: boolean;
  } | null = null;

  // History snapshots are serialized layouts captured *before* each mutation,
  // so undo() can cold-swap the working layout and rebuild the scene.
  private history: string[] = [];
  private readonly historyLimit = 100;
  private clipboard: { kind: 'object' | 'light' | 'spawn'; data: MapObject | MapLight | MapSpawn } | null = null;

  constructor(canvas: HTMLCanvasElement, onChange?: () => void) {
    this.canvas = canvas;
    this.onChange = onChange;

    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      antialias: false,
      doNotHandleContextLost: true,
      disableWebGL2Support: false
    });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.11, 0.14, 0.2, 1);

    // Editor lighting: same mood as the game, but shadowless so gizmo drags
    // never fight a static shadow pass reload. Bulbs are a touch dimmer so
    // user-placed point lights read clearly against the base fill.
    const hemi = new HemisphericLight('editHemi', new Vector3(0.2, 1, 0.1), this.scene);
    hemi.diffuse = new Color3(0.5, 0.58, 0.7);
    hemi.groundColor = new Color3(0.24, 0.24, 0.24);
    hemi.intensity = 0.52;
    const sun = new DirectionalLight('editSun', new Vector3(-0.4, -1, -0.25), this.scene);
    sun.position = new Vector3(70, 110, 40);
    sun.diffuse = new Color3(1.0, 0.95, 0.85);
    sun.intensity = 0.72;
    this.editorLights.push(hemi, sun);

    // Bloom so light markers + lantern components visibly radiate.
    const glow = new GlowLayer('editGlow', this.scene);
    glow.intensity = 0.55;

    this.camera = new ArcRotateCamera('editCam', Math.PI / 4, Math.PI / 3, 70, new Vector3(0, 4, 0), this.scene);
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 240;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 900;
    this.camera.upperBetaLimit = Math.PI / 2.05;
    // Right-click drag pans the camera target (arc rotate), left-drag orbits,
    // wheel zooms — Blender-like. panningSensibility is high so the pan is
    // slow/precise and the context menu is suppressed so right-drag works.
    this.camera.panningSensibility = 60;
    this.canvas.addEventListener('contextmenu', this.onContextMenu);

    this.layout = cloneLayout(loadDefaultLayout() ?? emptyLayout('kyoto'));
    this.b = createMapBuilder(this.scene, undefined, { editor: true });

    // Rebuild the editable geometry + helpers.
    this.buildWorld();
    this.buildGrid();
    this.buildSpawnMarkers();
    this.buildSky();

    // Gizmos: Babylon manages the 3 transform gizmos; we toggle which one is
    // active. Enable each gizmo once so it gets created (they stay in
    // gizmos.* even after being disabled) before wiring the drag observers.
    this.gizmo = new GizmoManager(this.scene);
    this.gizmo.usePointerToAttachGizmos = false;
    this.gizmo.positionGizmoEnabled = true;
    this.gizmo.rotationGizmoEnabled = true;
    this.gizmo.scaleGizmoEnabled = true;

    this.gizmo.gizmos.positionGizmo?.onDragStartObservable.add(() => {
      this.canvas.style.cursor = 'grabbing';
    });
    this.gizmo.gizmos.positionGizmo?.onDragEndObservable.add(() => {
      this.canvas.style.cursor = 'default';
      this.afterGizmoDrag();
    });
    this.gizmo.gizmos.rotationGizmo?.onDragEndObservable.add(() => {
      this.afterGizmoDrag();
    });
    this.gizmo.gizmos.scaleGizmo?.onDragEndObservable.add(() => {
      this.afterGizmoDrag();
    });

    this.applyGizmoMode(this.onGizmoMode);
    this.applySnap();
    this.applyTerrainMode();

    // Shift+drag object-to-cursor movement (only meaningful in translate mode).
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);

    // Picking: select objects/lights/spawns, clear on empty left-click.
    this.scene.onPointerObservable.add((evt) => {
      if (this.terrainTool !== 'none') return;
      if (evt.type !== PointerEventTypes.POINTERPICK) return;
      const hit = evt.pickInfo;
      if (!hit?.pickedMesh) {
        if (evt.event?.button === 0) this.select(null);
        return;
      }
      const meta = hit.pickedMesh.metadata as { spawnIndex?: number; editorId?: string } | undefined;
      if (meta && typeof meta === 'object') {
        if (typeof meta.spawnIndex === 'number') {
          this.selectSpawn(meta.spawnIndex);
          return;
        }
        if (typeof meta.editorId === 'string') {
          // Locked objects are not selectable from the viewport — only via
          // the object list (so they can be unlocked deliberately).
          const obj = this.layout.objects.find((o) => o.id === meta.editorId);
          if (obj?.locked) return;
          this.selectById(meta.editorId);
          return;
        }
      }
      // A gizmo axis or a component-internal mesh: keep the current selection.
    });

    // Keyboard: WASD/QE fly like Blender, Shift to hurry, F to frame the
    // selection, Home to reset the view. Ignored while typing in a field.
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    const renderLoop = () => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
      if (dt > 0) this.updateFly(dt);
      this.scene.render();
    };
    this.engine.runRenderLoop(renderLoop);
  }

  // ── Keyboard / camera ────────────────────────────────────────────────────

  private isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return (
      el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
    );
  }

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTypingTarget(e.target)) return;
    this.pressedKeys.add(e.code);
    if (e.code === 'KeyF') {
      e.preventDefault();
      this.frameSelected();
    } else if (e.code === 'Home') {
      e.preventDefault();
      this.resetCamera();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.pressedKeys.delete(e.code);
  };

  /** Moves the camera target along the view axes while fly keys are held. */
  private updateFly(dt: number): void {
    if (this.pressedKeys.size === 0) return;
    const k = this.pressedKeys;
    const speed = FLY_SPEED * (k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1) * dt;

    let fwd = this.camera.target.subtract(this.camera.position);
    if (fwd.lengthSquared() < 1e-6) return;
    fwd.normalize();
    let right = Vector3.Cross(fwd, new Vector3(0, 1, 0));
    if (right.lengthSquared() < 1e-6) {
      right = new Vector3(1, 0, 0);
    } else {
      right.normalize();
    }

    const move = new Vector3(0, 0, 0);
    if (k.has('KeyW')) move.addInPlace(fwd);
    if (k.has('KeyS')) move.subtractInPlace(fwd);
    if (k.has('KeyD')) move.addInPlace(right);
    if (k.has('KeyA')) move.subtractInPlace(right);
    if (k.has('KeyE')) move.y += 1;
    if (k.has('KeyQ')) move.y -= 1;
    if (move.lengthSquared() === 0) return;

    move.normalize().scaleInPlace(speed);
    this.camera.target.addInPlace(move);
  }

  /** Points the camera at the current selection without changing distance. */
  frameSelected(): void {
    const control = this.gizmo.attachedMesh;
    if (control) {
      this.camera.target = control.getAbsolutePosition().clone();
    }
  }

  resetCamera(): void {
    this.camera.alpha = Math.PI / 4;
    this.camera.beta = Math.PI / 3;
    this.camera.radius = 70;
    this.camera.target = new Vector3(0, 4, 0);
    this.onChange?.();
  }

  // ── Shift+drag object-to-cursor movement ────────────────────────────────

  /** Pointer position relative to the canvas (matches Babylon's pick coords). */
  private canvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Intersects a picking ray with the horizontal plane at `height`. */
  private rayPlaneHit(ray: Ray, height: number): Vector3 | null {
    const dist = ray.intersectsPlane(new Plane(0, 1, 0, -height));
    if (dist === null || dist === undefined || dist < 0) return null;
    return ray.origin.add(ray.direction.scale(dist));
  }

  /** Picks an editable layout object at the given canvas coordinates. */
  private pickEditableObjectAt(x: number, y: number): string | null {
    const pick = this.scene.pick(
      x,
      y,
      (m) => {
        if (!m.isPickable) return false;
        const meta = m.metadata as { editorId?: string } | undefined;
        return !!meta && typeof meta.editorId === 'string';
      },
      false,
      this.camera
    );
    if (!pick?.pickedMesh) return null;
    const meta = pick.pickedMesh.metadata as { editorId?: string } | undefined;
    return meta?.editorId ?? null;
  }

  /**
   * Shift + left-drag on an editable object (translate mode) grabs the object
   * and moves it to follow the cursor across the world, snapping to the
   * ground or the top of other objects when snap-to-ground is enabled.
   */
  private onPointerDown = (e: PointerEvent) => {
    if (this.terrainTool !== 'none') {
      this.terrainPointerDown(e);
      return;
    }
    if (this.dragMove) return;
    if (e.button !== 0 || !e.shiftKey) return;
    if (this.onGizmoMode !== 'translate') return;
    if (this.gizmo.isDragging) return;

    const { x, y } = this.canvasPoint(e);
    const editorId = this.pickEditableObjectAt(x, y);
    if (!editorId) return;
    const obj = this.layout.objects.find((o) => o.id === editorId);
    if (!obj || obj.locked) return;
    const control = this.controlOf.get(editorId);
    if (!control) return;

    this.selectById(editorId);
    const hit = this.rayPlaneHit(this.scene.createPickingRayInCameraSpace(x, y, this.camera), control.position.y);
    if (!hit) return;

    this.dragMove = {
      pointerId: e.pointerId,
      objectId: editorId,
      offsetX: control.position.x - hit.x,
      offsetZ: control.position.z - hit.z,
      startHeight: control.position.y,
      moved: false
    };
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* pointer may have already been released */
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.terrainTool !== 'none') {
      this.terrainPointerMove(e);
      return;
    }
    if (!this.dragMove || e.pointerId !== this.dragMove.pointerId) return;
    // If a gizmo axis drag grabbed the same pointer (shift held near an axis),
    // let the gizmo win — it constrains movement along that axis.
    if (this.gizmo.isDragging || this.gizmo.gizmos.positionGizmo?.isDragging) {
      this.cancelDragMove();
      return;
    }

    const dm = this.dragMove;
    const control = this.controlOf.get(dm.objectId);
    if (!control) {
      this.cancelDragMove();
      return;
    }

    const { x, y } = this.canvasPoint(e);
    const hit = this.rayPlaneHit(this.scene.createPickingRayInCameraSpace(x, y, this.camera), dm.startHeight);
    if (!hit) return;

    let px = hit.x + dm.offsetX;
    let pz = hit.z + dm.offsetZ;
    if (this.snapEnabled) {
      px = Math.round(px / this.translateSnap) * this.translateSnap;
      pz = Math.round(pz / this.translateSnap) * this.translateSnap;
    }

    if (!dm.moved) this.recordHistory();
    dm.moved = true;

    control.position.x = px;
    control.position.z = pz;
    if (this.snapToGroundEnabled) {
      control.position.y = this.snapToGroundPoint(new Vector3(px, dm.startHeight, pz), control).y;
    } else {
      control.position.y = dm.startHeight;
    }

    const obj = this.layout.objects.find((o) => o.id === dm.objectId);
    if (obj) obj.position = [control.position.x, control.position.y, control.position.z];
    this.dirty = true;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.terrainStroke && e.pointerId === this.terrainStroke.pointerId) {
      this.endTerrainStroke();
      return;
    }
    if (!this.dragMove || e.pointerId !== this.dragMove.pointerId) return;
    const dm = this.dragMove;
    this.dragMove = null;
    try {
      if (this.canvas.hasPointerCapture(dm.pointerId)) this.canvas.releasePointerCapture(dm.pointerId);
    } catch {
      /* ignore */
    }
    if (!dm.moved) return;
    const control = this.controlOf.get(dm.objectId);
    if (!control) return;
    const obj = this.layout.objects.find((o) => o.id === dm.objectId);
    if (!obj) return;
    obj.position = [control.position.x, control.position.y, control.position.z];
    if (obj.kind === 'component') {
      (obj as { scale: [number, number, number] }).scale = [
        control.scaling.x,
        control.scaling.y,
        control.scaling.z
      ];
    }
    this.dirty = true;
    this.onChange?.();
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (this.terrainStroke && e.pointerId === this.terrainStroke.pointerId) {
      this.endTerrainStroke();
      return;
    }
    if (!this.dragMove || e.pointerId !== this.dragMove.pointerId) return;
    this.cancelDragMove();
  };

  private cancelDragMove(): void {
    if (!this.dragMove) return;
    const pointerId = this.dragMove.pointerId;
    this.dragMove = null;
    try {
      if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }

  // ── Terrain sculpting ────────────────────────────────────────────────────

  /** Live subdivision count of an existing ground mesh (falls back to the builder default). */
  private meshSubdivisionsOf(control: AbstractMesh | undefined): number {
    if (!control) return 4;
    return subdivisionsFromHeightmap(control.getTotalVertices()) ?? 4;
  }

  /**
   * Registers a terrain entry per ground object. Legacy grounds (no
   * subdivisions in the layout) are upgraded lazily on first sculpt so
   * merely opening the editor never rewrites the map.
   */
  private initTerrainEditors(): void {
    this.terrainOf.clear();
    for (const o of this.layout.objects) {
      if (o.kind !== 'ground') continue;
      const obj = o as MapGroundObject;
      const control = this.controlOf.get(o.id);
      const hasTopology = typeof obj.subdivisions === 'number' && obj.subdivisions >= TERRAIN_MIN_SUBDIVISIONS;
      const subdivisions = hasTopology ? Math.round(obj.subdivisions as number) : TERRAIN_SUBDIVISIONS;
      const heights = hasTopology
        ? sanitizeTerrainHeights(obj.heightmap, subdivisions) ?? makeTerrainHeights(subdivisions)
        : null;
      this.terrainOf.set(o.id, {
        id: o.id,
        width: obj.width,
        height: obj.height,
        subdivisions,
        meshSubdivisions: hasTopology ? subdivisions : this.meshSubdivisionsOf(control),
        heights,
        control: control instanceof GroundMesh ? control : null
      });
    }
  }

  /** Replaces a legacy ground with a resampled, sculptable mesh at the target resolution. */
  private upgradeTerrainGround(entry: TerrainGroundEntry): void {
    const obj = this.layout.objects.find((o) => o.id === entry.id) as MapGroundObject | undefined;
    if (!obj || obj.kind !== 'ground') return;
    obj.subdivisions = entry.subdivisions;
    obj.heightmap = entry.heights ?? makeTerrainHeights(entry.subdivisions);
    entry.heights = obj.heightmap;
    disposeObjectMeshes(this.b, entry.id);
    this.controlOf.delete(entry.id);
    this.buildMapObjectNow(obj);
    const control = this.controlOf.get(entry.id);
    entry.control = control instanceof GroundMesh ? control : null;
    entry.meshSubdivisions = entry.subdivisions;
  }

  /** Picks the ground under a canvas position (surface-accurate for sculpted terrain). */
  private pickTerrainAt(x: number, y: number): { id: string; mesh: GroundMesh; point: Vector3 } | null {
    let pick;
    try {
      pick = this.scene.pick(
        x,
        y,
        (m) => {
          if (!m.isPickable) return false;
          const meta = m.metadata as { editorId?: string } | undefined;
          return typeof meta?.editorId === 'string' && this.terrainOf.has(meta.editorId);
        },
        false,
        this.camera
      );
    } catch {
      return null;
    }
    if (!pick?.pickedMesh || !pick.pickedPoint) return null;
    const meta = pick.pickedMesh.metadata as { editorId?: string } | undefined;
    if (!meta?.editorId) return null;
    return { id: meta.editorId, mesh: pick.pickedMesh as GroundMesh, point: pick.pickedPoint.clone() };
  }

  private terrainPointerDown(e: PointerEvent): void {
    if (this.terrainStroke) return;
    if (e.button !== 0) return;
    const { x, y } = this.canvasPoint(e);
    const hit = this.pickTerrainAt(x, y);
    if (!hit) return;
    this.terrainStroke = {
      pointerId: e.pointerId,
      objectId: hit.id,
      lastWorld: null,
      historyPushed: false
    };
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* pointer may have already been released */
    }
    this.applyTerrainBrush(hit.id, hit.point);
  }

  private terrainPointerMove(e: PointerEvent): void {
    const { x, y } = this.canvasPoint(e);
    if (this.terrainStroke && e.pointerId === this.terrainStroke.pointerId) {
      const hit = this.pickTerrainAt(x, y);
      if (hit) this.applyTerrainBrush(hit.id, hit.point);
      return;
    }
    const hit = this.pickTerrainAt(x, y);
    if (hit) this.updateTerrainCursor(hit.point);
  }

  private endTerrainStroke(): void {
    if (!this.terrainStroke) return;
    const pointerId = this.terrainStroke.pointerId;
    this.terrainStroke = null;
    try {
      if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    this.onChange?.();
  }

  /** Drag-distance-based raise/lower amount so strokes feel consistent per meter. */
  private terrainStrokeAmount(point: Vector3): number {
    const last = this.terrainStroke?.lastWorld;
    if (!last) return this.brushStrength * 0.15;
    const dist = Vector3.Distance(last, point);
    return this.brushStrength * Math.min(0.25, dist / Math.max(0.1, this.brushSize));
  }

  /** Applies the active tool at a world-space surface point. */
  private applyTerrainBrush(objectId: string, point: Vector3): void {
    if (this.terrainTool === 'none' || this.terrainTool === 'paint') return;
    const entry = this.terrainOf.get(objectId);
    if (!entry || !this.terrainStroke) return;

    if (!this.terrainStroke.historyPushed) {
      this.recordHistory();
      this.terrainStroke.historyPushed = true;
    }
    if (entry.heights === null) this.upgradeTerrainGround(entry);
    if (!entry.heights || !entry.control) return;

    const local = Vector3.TransformCoordinates(point, entry.control.getInverseWorldMatrix());
    const gp = terrainWorldToGrid(local.x, local.z, entry.width, entry.height, entry.subdivisions);
    const spec: TerrainBrushSpec = {
      centerCol: gp.col,
      centerRow: gp.row,
      radiusCols: this.brushSize / 2 / terrainCellSizeX(entry.width, entry.subdivisions),
      radiusRows: this.brushSize / 2 / terrainCellSizeZ(entry.height, entry.subdivisions)
    };

    const amount = this.terrainStrokeAmount(point);
    if (this.terrainTool === 'raise') {
      raiseHeights(entry.heights, entry.subdivisions, spec, amount);
    } else if (this.terrainTool === 'lower') {
      lowerHeights(entry.heights, entry.subdivisions, spec, amount);
    } else if (this.terrainTool === 'smooth') {
      smoothHeights(entry.heights, entry.subdivisions, spec, Math.min(0.9, this.brushStrength * 0.5));
    }

    const obj = this.layout.objects.find((o) => o.id === objectId) as MapGroundObject | undefined;
    if (obj) obj.heightmap = entry.heights;
    applyHeightmapToMesh(entry.control, entry.heights, entry.subdivisions);
    this.terrainStroke.lastWorld = point.clone();
    this.updateTerrainCursor(point);
    this.dirty = true;
  }

  private getTerrainCursor(): AbstractMesh {
    if (this.terrainCursor && !this.terrainCursor.isDisposed()) return this.terrainCursor;
    const disc = MeshBuilder.CreateDisc('ediTerrainCursor', { radius: 1, tessellation: 48 }, this.scene);
    const mat = new StandardMaterial('ediTerrainCursorMat', this.scene);
    mat.diffuseColor = new Color3(1.0, 0.85, 0.35);
    mat.emissiveColor = new Color3(0.9, 0.6, 0.12);
    mat.specularColor = new Color3(0, 0, 0);
    mat.disableLighting = true;
    mat.alpha = 0.6;
    disc.material = mat;
    disc.isPickable = false;
    disc.checkCollisions = false;
    disc.renderingGroupId = 9;
    disc.setEnabled(false);
    this.terrainCursor = disc;
    return disc;
  }

  private updateTerrainCursor(point: Vector3): void {
    const cursor = this.getTerrainCursor();
    const radius = Math.max(0.25, this.brushSize / 2);
    cursor.position = new Vector3(point.x, point.y + 0.05, point.z);
    cursor.scaling = new Vector3(radius, 1, radius);
    cursor.setEnabled(true);
  }

  private setTerrainCursorVisible(visible: boolean): void {
    const cursor = this.getTerrainCursor();
    cursor.setEnabled(visible);
  }

  /** Applies the camera-input + brush-cursor changes for the active terrain tool. */
  private applyTerrainMode(): void {
    const pointers = this.camera.inputs.attached?.pointers as unknown as { buttons?: number[] } | undefined;
    if (pointers) pointers.buttons = this.terrainTool === 'none' ? [0, 1, 2] : [2];
    this.setTerrainCursorVisible(this.terrainTool !== 'none');
  }

  /** Switches sculpting tools; 'none' restores normal object editing. */
  setTerrainTool(tool: TerrainTool): void {
    if (this.terrainTool === tool) return;
    this.endTerrainStroke();
    this.terrainTool = tool;
    this.applyTerrainMode();
    this.onChange?.();
  }

  /** Terrain brush size in meters (diameter). */
  setBrushSize(size: number): void {
    this.brushSize = Math.max(1, Math.min(64, size));
    this.onChange?.();
  }

  /** Raise/lower amount in meters per drag unit; also scales smooth strength. */
  setBrushStrength(strength: number): void {
    this.brushStrength = Math.max(0.05, Math.min(8, strength));
    this.onChange?.();
  }

  /** Texture brush source material key (used by the paint tool). */
  setPaintMaterial(key: string | null): void {
    this.paintMaterial = key;
    this.onChange?.();
  }

  // ── Scene assembly ───────────────────────────────────────────────────────

  private buildWorld(): void {
    buildLayout(this.b, this.layout, true);
    this.reindexControls();
    this.initTerrainEditors();
  }

  /** Full teardown + rebuild of every layout object/light (after open/reset). */
  private rebuildWorld(): void {
    for (const o of this.layout.objects) {
      disposeObjectMeshes(this.b, o.id);
    }
    for (const l of this.layout.lights) {
      disposeObjectMeshes(this.b, l.id);
    }
    this.controlOf.clear();
    this.select(null);
    this.gizmo.attachToMesh(null);
    this.buildWorld();
  }

  private reindexControls(): void {
    this.controlOf.clear();
    for (const o of this.layout.objects) {
      const root = this.scene.getMeshByName(`${o.id}__root`);
      if (root) {
        this.controlOf.set(o.id, root);
        continue;
      }
      const mesh = this.findControlMesh(o.id);
      if (mesh) this.controlOf.set(o.id, mesh);
    }
    for (const l of this.layout.lights) {
      const marker = this.findControlMesh(l.id);
      if (marker) this.controlOf.set(l.id, marker);
    }
  }

  private findControlMesh(id: string): AbstractMesh | undefined {
    return this.scene.meshes.find((m) => {
      if (m.isDisposed()) return false;
      const meta = m.metadata as { editorId?: string } | undefined;
      return !!meta && meta.editorId === id && !m.parent;
    });
  }

  private buildGrid(): void {
    const size = 220;
    const gridTex = new DynamicTexture('editGridTex', { width: 1024, height: 1024 }, this.scene, false);
    const ctx2d = gridTex.getContext();
    const cells = 44; // 44 px per cell → 5m cells across a 220m plane
    ctx2d.clearRect(0, 0, 1024, 1024);
    ctx2d.fillStyle = 'rgba(18, 26, 40, 0.55)';
    ctx2d.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i <= cells; i++) {
      const x = (i * 1024) / cells;
      ctx2d.strokeStyle = 'rgba(120, 160, 255, 0.16)';
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.lineTo(x, 1024);
      ctx2d.stroke();
      ctx2d.beginPath();
      ctx2d.moveTo(0, x);
      ctx2d.lineTo(1024, x);
      ctx2d.stroke();
    }
    ctx2d.fillStyle = 'rgba(120, 160, 255, 0.28)';
    ctx2d.fillRect(512 - 1, 0, 2, 1024);
    ctx2d.fillRect(0, 512 - 1, 1024, 2);
    gridTex.uScale = 1;
    gridTex.vScale = 1;
    gridTex.wrapU = Texture.CLAMP_ADDRESSMODE;
    gridTex.wrapV = Texture.CLAMP_ADDRESSMODE;

    const gridMat = new StandardMaterial('editGridMat', this.scene);
    gridMat.diffuseTexture = gridTex;
    gridMat.emissiveTexture = gridTex;
    gridMat.disableLighting = true;
    gridMat.backFaceCulling = false;

    const grid = MeshBuilder.CreateGround('editGrid', { width: size, height: size, subdivisions: 1 }, this.scene);
    grid.position = new Vector3(0, 0.001, 0);
    grid.material = gridMat;
    grid.isPickable = false;
    grid.checkCollisions = false;
    grid.renderingGroupId = 9;
  }

  /** Editable spawn markers: team disk + direction arrow (yaw lives on the disk). */
  buildSpawnMarkers(): void {
    this.spawnMarkers.forEach((m) => m.dispose());
    this.spawnMarkers = [];
    this.layout.spawns.forEach((s, i) => {
      const teamA = i < this.layout.spawns.length / 2;
      const base = MeshBuilder.CreateCylinder(
        `spawnMark_${i}`,
        { height: 0.14, diameter: 0.9, tessellation: 24 },
        this.scene
      );
      base.position = new Vector3(s.position[0], s.position[1], s.position[2]);
      base.rotation = new Vector3(0, s.yaw, 0);
      base.metadata = { spawnIndex: i };
      const markMat = new StandardMaterial(`spawnMark${i}Mat`, this.scene);
      markMat.diffuseColor = teamA ? new Color3(0.15, 0.8, 0.4) : new Color3(1.0, 0.55, 0.2);
      markMat.emissiveColor = markMat.diffuseColor.clone().scale(0.45);
      base.material = markMat;
      base.isPickable = true;
      base.checkCollisions = false;
      this.spawnMarkers.push(base);

      const arrow = MeshBuilder.CreateCylinder(
        `spawnArrow_${i}`,
        { height: 0.16, diameter: 0.42, tessellation: 16 },
        this.scene
      );
      arrow.parent = base;
      arrow.position = new Vector3(0, 0.15, 0);
      arrow.material = markMat;
      arrow.isPickable = true;
      arrow.checkCollisions = false;
      arrow.metadata = { spawnIndex: i };
    });
  }

  private buildSky(): void {
    const skyMat = buildSky(this.b);
    skyMat.disableLighting = true;
  }

  // ── Selection & gizmos ───────────────────────────────────────────────────

  getSelectionKind(): EditorSelectionKind {
    if (this.lockedSel) return 'object';
    const control = this.gizmo.attachedMesh;
    if (!control) return 'none';
    const meta = control.metadata as { spawnIndex?: number; editorId?: string } | undefined;
    if (typeof meta?.spawnIndex === 'number') return 'spawn';
    if (typeof meta?.editorId === 'string') {
      return this.layout.lights.some((l) => l.id === meta.editorId) ? 'light' : 'object';
    }
    return 'none';
  }

  get selectedId(): string | null {
    if (this.lockedSel) return this.lockedSel;
    const control = this.gizmo.attachedMesh;
    if (!control) return null;
    const meta = control.metadata as { editorId?: string } | undefined;
    return meta?.editorId ?? null;
  }

  get selectedObjectId(): string | null {
    const id = this.selectedId;
    if (!id) return null;
    return this.layout.objects.some((o) => o.id === id) ? id : null;
  }

  get selectedLightId(): string | null {
    const id = this.selectedId;
    if (!id) return null;
    return this.layout.lights.some((l) => l.id === id) ? id : null;
  }

  get selectedSpawnIndex(): number | null {
    const control = this.gizmo.attachedMesh;
    if (!control) return null;
    const meta = control.metadata as { spawnIndex?: number } | undefined;
    return typeof meta?.spawnIndex === 'number' ? meta.spawnIndex : null;
  }

  private selectByObject(obj: MapObject | undefined): void {
    if (!obj) {
      this.select(null);
      return;
    }
    const control = this.controlOf.get(obj.id);
    if (control) this.select(control);
  }

  selectById(id: string): void {
    const control = this.controlOf.get(id);
    if (control) this.select(control);
  }

  selectSpawn(index: number): void {
    const base = this.spawnMarkers[index];
    if (base) this.select(base);
  }

  select(control: AbstractMesh | null): void {
    this.lockedSel = null;
    if (control) {
      const id = this.resolveIdOf(control);
      if (id) {
        const obj = this.layout.objects.find((o) => o.id === id);
        if (obj?.locked) {
          // Locked objects keep their selection (for the inspector) but
          // never get an editable gizmo.
          this.lockedSel = id;
          if (this.gizmo.attachedMesh) this.gizmo.attachToMesh(null);
          this.onChange?.();
          return;
        }
      }
      // Only components take a scale gizmo; drop out of scale mode otherwise.
      if (this.onGizmoMode === 'scale') {
        const cid = this.resolveIdOf(control);
        const component =
          !!cid && this.layout.objects.some((o) => o.id === cid && o.kind === 'component');
        if (!component) this.setGizmoMode('translate');
      }
      this.gizmo.attachToMesh(control);
    } else if (this.gizmo.attachedMesh) {
      this.gizmo.attachToMesh(null);
    }
    this.onChange?.();
  }

  private resolveIdOf(mesh: AbstractMesh): string | null {
    const meta = mesh.metadata as { editorId?: string } | undefined;
    return meta?.editorId ?? null;
  }

  getSelectionInfo(): EditorSelectionInfo | null {
    const id = this.selectedObjectId;
    if (!id) return null;
    const obj = this.layout.objects.find((o) => o.id === id);
    if (!obj) return null;
    const control = this.controlOf.get(id);
    if (!control) return null;

    const info: EditorSelectionInfo = {
      id: obj.id,
      name: obj.name,
      kind: obj.kind,
      collidable: obj.kind === 'box' || obj.kind === 'ground' ? obj.collidable : true,
      locked: !!obj.locked,
      position: [control.position.x, control.position.y, control.position.z],
      rotation: [control.rotation.x, control.rotation.y, control.rotation.z],
      params: obj.kind === 'component' ? obj.params : {}
    };
    if (obj.kind === 'component') {
      info.component = obj.component;
      info.scale = [control.scaling.x, control.scaling.y, control.scaling.z];
    } else {
      info.material = obj.material;
    }
    return info;
  }

  getLightSelectionInfo(): EditorLightInfo | null {
    const id = this.selectedLightId;
    if (!id) return null;
    const l = this.layout.lights.find((o) => o.id === id);
    if (!l) return null;
    return {
      id: l.id,
      name: l.name,
      position: [...l.position],
      color: [...l.color],
      intensity: l.intensity,
      range: l.range
    };
  }

  getSpawnSelectionInfo(): EditorSpawnInfo | null {
    const i = this.selectedSpawnIndex;
    if (i === null || i === undefined) return null;
    const s = this.layout.spawns[i];
    if (!s) return null;
    return {
      index: i,
      team: i < this.layout.spawns.length / 2 ? 'A' : 'B',
      position: [...s.position],
      yaw: s.yaw
    };
  }

  getObjectList(): EditorObjectInfo[] {
    return this.layout.objects.map((o) => ({
      id: o.id,
      name: o.name,
      kind: o.kind,
      component: o.kind === 'component' ? o.component : undefined,
      locked: !!o.locked
    }));
  }

  getLightList(): { id: string; name: string }[] {
    return this.layout.lights.map((l) => ({ id: l.id, name: l.name }));
  }

  getSpawnList(): { index: number; team: 'A' | 'B' }[] {
    return this.layout.spawns.map((_, i) => ({
      index: i,
      team: i < this.layout.spawns.length / 2 ? 'A' : 'B'
    }));
  }

  get materialKeys(): string[] {
    return Object.keys(this.b.mats);
  }

  // ── Gizmo controls ───────────────────────────────────────────────────────

  setGizmoMode(mode: EditorTool['type']): void {
    this.onGizmoMode = mode;
    this.applyGizmoMode(mode);
  }

  private applyGizmoMode(mode: EditorTool['type']): void {
    this.gizmo.positionGizmoEnabled = mode === 'translate';
    this.gizmo.rotationGizmoEnabled = mode === 'rotate';
    this.gizmo.scaleGizmoEnabled = mode === 'scale';
    this.onChange?.();
  }

  setSnap(enabled: boolean): void {
    this.snapEnabled = enabled;
    this.applySnap();
  }

  setSnapToGround(enabled: boolean): void {
    this.snapToGroundEnabled = enabled;
    this.onChange?.();
  }

  /**
   * Raycasts straight down from a point and returns the surface below,
   * so an object can be dropped onto the ground — or onto whatever object
   * / platform happens to be underneath it.
   */
  private snapToGroundPoint(point: Vector3, excludeRoot?: AbstractMesh): Vector3 {
    if (!this.snapToGroundEnabled) return point.clone();
    const p = point.clone();
    const excludeId = excludeRoot ? this.resolveIdOf(excludeRoot) : null;
    const lightIds = new Set(this.layout.lights.map((l) => l.id));
    try {
      const ray = new Ray(new Vector3(p.x, p.y + 400, p.z), new Vector3(0, -1, 0), 800);
      const pick = this.scene.pickWithRay(ray, (m) => {
        // Babylon skips the isPickable check whenever a predicate is supplied,
        // so explicitly drop non-pickable scene dressing (sky dome, clouds,
        // hills, Mount Fuji, editor grid) — otherwise the snap ray hits the
        // sky box hundreds of metres above the actual ground.
        if (!m.isPickable) return false;
        const meta = m.metadata as { editorId?: string; spawnIndex?: number } | undefined;
        // Skip editor-only pickable helpers (spawn disks/arrows, light markers)
        // so objects rest on real geometry, not on gizmo representations.
        if (typeof meta?.spawnIndex === 'number') return false;
        if (typeof meta?.editorId === 'string' && lightIds.has(meta.editorId)) return false;
        // Don't snap an object onto its own meshes (root + component children).
        if (excludeRoot && m === excludeRoot) return false;
        if (excludeId) {
          if (meta && meta.editorId === excludeId) return false;
        }
        return true;
      });
      if (pick?.pickedPoint) p.y = pick.pickedPoint.y;
    } catch {
      /* fall through — keep the current height */
    }
    return p;
  }

  setTranslateSnap(step: number): void {
    this.translateSnap = step;
    if (this.snapEnabled) this.applySnap();
  }

  private applySnap(): void {
    const pos = this.gizmo.gizmos.positionGizmo;
    const rot = this.gizmo.gizmos.rotationGizmo;
    if (pos) pos.snapDistance = this.snapEnabled ? this.translateSnap : 0;
    if (rot) rot.snapDistance = this.snapEnabled ? this.rotateSnap : 0;
    this.onChange?.();
  }

  private applySnapTo(control: AbstractMesh): void {
    control.position.x = Math.round(control.position.x / this.translateSnap) * this.translateSnap;
    control.position.y = Math.round(control.position.y / this.translateSnap) * this.translateSnap;
    control.position.z = Math.round(control.position.z / this.translateSnap) * this.translateSnap;
  }

  private afterGizmoDrag(): void {
    const control = this.gizmo.attachedMesh;
    if (!control) return;
    this.recordHistory();

    const kind = this.getSelectionKind();

    if (kind === 'spawn') {
      const i = this.selectedSpawnIndex;
      if (i === null || i === undefined) return;
      const s = this.layout.spawns[i];
      if (!s) return;
      if (this.snapEnabled) {
        this.applySnapTo(control);
        control.rotation.y = Math.round(control.rotation.y / this.rotateSnap) * this.rotateSnap;
      }
      // Spawns face along Y only — ignore roll/pitch from the rotation gizmo.
      control.rotation.x = 0;
      control.rotation.z = 0;
      s.position = [control.position.x, control.position.y, control.position.z];
      s.yaw = control.rotation.y;
      this.dirty = true;
      this.onChange?.();
      return;
    }

    const id = this.selectedId;
    if (!id) return;

    if (kind === 'light') {
      const l = this.layout.lights.find((o) => o.id === id);
      if (!l) return;
      if (this.snapEnabled) this.applySnapTo(control);
      l.position = [control.position.x, control.position.y, control.position.z];
      this.dirty = true;
      this.onChange?.();
      return;
    }

    const obj = this.layout.objects.find((o) => o.id === id);
    if (!obj) return;

    if (this.snapEnabled) {
      this.applySnapTo(control);
      control.rotation.x = Math.round(control.rotation.x / this.rotateSnap) * this.rotateSnap;
      control.rotation.y = Math.round(control.rotation.y / this.rotateSnap) * this.rotateSnap;
      control.rotation.z = Math.round(control.rotation.z / this.rotateSnap) * this.rotateSnap;
    }

    if (this.snapToGroundEnabled) {
      const snapped = this.snapToGroundPoint(control.position, control);
      if (this.snapEnabled) {
        snapped.y = Math.round(snapped.y / this.translateSnap) * this.translateSnap;
      }
      control.position.y = snapped.y;
    }

    obj.position = [control.position.x, control.position.y, control.position.z];
    obj.rotation = [control.rotation.x, control.rotation.y, control.rotation.z];
    if (obj.kind === 'component') {
      const c = obj as typeof obj;
      (c as { scale: [number, number, number] }).scale = [
        control.scaling.x,
        control.scaling.y,
        control.scaling.z
      ];
    }
    this.dirty = true;
    this.onChange?.();
  }

  // ── Editing operations ───────────────────────────────────────────────────

  selectByIndex(index: number): void {
    const obj = this.layout.objects[index];
    if (obj) this.selectByObject(obj);
  }

  addBox(): void {
    this.recordHistory();
    const id = nextEditorId(this.layout);
    const projected = this.snapToGroundPoint(this.projectOnGround());
    const box: MapBoxObject = {
      id,
      name: `Box_${id}`,
      kind: 'box',
      w: 2,
      h: 2,
      d: 2,
      position: [projected.x, projected.y + 1, projected.z],
      rotation: [0, 0, 0],
      material: 'plaster',
      collidable: true
    };
    this.layout.objects.push(box);
    this.buildMapObjectNow(box);
    this.dirty = true;
    this.selectByObject(box);
  }

  addComponent(componentId: string): void {
    const def = COMPONENTS.find((c) => c.id === componentId);
    if (!def) return;
    this.recordHistory();
    const position: [number, number, number] = [0, 0, 0];
    const projected = this.snapToGroundPoint(this.projectOnGround());
    position[0] = projected.x;
    position[1] = projected.y;
    position[2] = projected.z;
    const obj = createComponentObject(componentId, def.label, position);
    this.layout.objects.push(obj);
    this.buildMapObjectNow(obj);
    this.dirty = true;
    this.selectByObject(obj);
  }

  addLight(): void {
    this.recordHistory();
    const id = nextEditorId(this.layout);
    const projected = this.projectOnGround();
    const light: MapLight = {
      id,
      name: `Light_${id}`,
      position: [projected.x, 4, projected.z],
      color: [1.0, 0.8, 0.45],
      intensity: 2.2,
      range: 18
    };
    this.layout.lights.push(light);
    buildLayoutLight(this.b, light, true);
    const marker = this.findControlMesh(id);
    if (marker) this.controlOf.set(id, marker);
    this.dirty = true;
    this.selectById(id);
  }

  addSpawn(): void {
    this.recordHistory();
    const projected = this.projectOnGround();
    const spawn: MapSpawn = { position: [projected.x, 1, projected.z], yaw: 0 };
    this.layout.spawns.push(spawn);
    this.buildSpawnMarkers();
    this.dirty = true;
    this.selectSpawn(this.layout.spawns.length - 1);
  }

  private buildMapObjectNow(obj: MapObject): void {
    buildMapObject(this.b, obj, true);
    const root = this.scene.getMeshByName(`${obj.id}__root`);
    if (root) {
      this.controlOf.set(obj.id, root);
      return;
    }
    const mesh = this.findControlMesh(obj.id);
    if (mesh) this.controlOf.set(obj.id, mesh);
  }

  deleteSelected(): void {
    if (this.isSelectedLocked()) return;
    this.recordHistory();
    const kind = this.getSelectionKind();
    if (kind === 'light') {
      this.deleteLight();
      return;
    }
    if (kind === 'spawn') {
      this.deleteSpawn();
      return;
    }
    const id = this.selectedObjectId;
    if (!id) return;
    const idx = this.layout.objects.findIndex((o) => o.id === id);
    if (idx === -1) return;
    disposeObjectMeshes(this.b, id);
    this.controlOf.delete(id);
    this.layout.objects.splice(idx, 1);
    this.gizmo.attachToMesh(null);
    this.dirty = true;
    this.onChange?.();
  }

  private deleteLight(): void {
    const id = this.selectedLightId;
    if (!id) return;
    const idx = this.layout.lights.findIndex((l) => l.id === id);
    if (idx === -1) return;
    disposeObjectMeshes(this.b, id);
    this.controlOf.delete(id);
    this.layout.lights.splice(idx, 1);
    this.gizmo.attachToMesh(null);
    this.dirty = true;
    this.onChange?.();
  }

  private deleteSpawn(): void {
    const i = this.selectedSpawnIndex;
    if (i === null || i === undefined) return;
    if (this.layout.spawns.length <= 1) return;
    this.layout.spawns.splice(i, 1);
    this.buildSpawnMarkers();
    this.gizmo.attachToMesh(null);
    this.dirty = true;
    this.onChange?.();
  }

  // ── History (undo) ───────────────────────────────────────────────────────

  /** Snapshots the current layout so the next mutation can be undone. */
  private recordHistory(): void {
    this.history.push(this.serialize());
    if (this.history.length > this.historyLimit) this.history.shift();
  }

  /** Reverts the last edit by swapping in its pre-change layout snapshot. */
  undo(): void {
    const prev = this.history.pop();
    if (prev === undefined) return;
    try {
      this.layout = parseLayout(prev);
      const reselect = this.selectedId;
      this.rebuildWorld();
      this.buildSpawnMarkers();
      this.dirty = true;
      if (reselect && this.controlOf.has(reselect)) this.selectById(reselect);
      this.onChange?.();
    } catch {
      /* malformed snapshot — ignore */
    }
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  // ── Clipboard (copy / cut / paste) ───────────────────────────────────────

  copySelected(): boolean {
    const done = this.captureSelectedToClipboard();
    if (done) this.onChange?.();
    return done;
  }

  cutSelected(): boolean {
    if (!this.copySelected()) return false;
    this.deleteSelected();
    return true;
  }

  pasteSelected(): void {
    if (!this.clipboard) return;
    this.recordHistory();
    const data = JSON.parse(JSON.stringify(this.clipboard.data)) as MapObject | MapLight | MapSpawn;

    if (this.clipboard.kind === 'spawn') {
      const spawn = data as MapSpawn;
      spawn.position = [spawn.position[0], spawn.position[1], spawn.position[2] + 1];
      this.layout.spawns.push(spawn);
      this.buildSpawnMarkers();
      this.dirty = true;
      this.selectSpawn(this.layout.spawns.length - 1);
    } else if (this.clipboard.kind === 'light') {
      const copy = data as MapLight;
      copy.id = nextEditorId(this.layout);
      copy.name = `Light_${copy.id}`;
      copy.position = [copy.position[0], copy.position[1], copy.position[2] + 1];
      this.layout.lights.push(copy);
      buildLayoutLight(this.b, copy, true);
      const marker = this.findControlMesh(copy.id);
      if (marker) this.controlOf.set(copy.id, marker);
      this.dirty = true;
      this.selectById(copy.id);
    } else {
      const copy = data as MapObject;
      copy.id = nextEditorId(this.layout);
      copy.name = `${copy.name} (copy)`;
      copy.position = [copy.position[0], copy.position[1], copy.position[2] + 1];
      this.layout.objects.push(copy);
      this.buildMapObjectNow(copy);
      this.dirty = true;
      this.selectByObject(copy);
    }
    this.onChange?.();
  }

  private captureSelectedToClipboard(): boolean {
    const kind = this.getSelectionKind();
    if (kind === 'spawn') {
      const i = this.selectedSpawnIndex;
      if (i === null || i === undefined) return false;
      const s = this.layout.spawns[i];
      if (!s) return false;
      this.clipboard = { kind: 'spawn', data: JSON.parse(JSON.stringify(s)) as MapSpawn };
      return true;
    }
    const id = this.selectedId;
    if (!id) return false;
    if (kind === 'light') {
      const l = this.layout.lights.find((o) => o.id === id);
      if (!l) return false;
      this.clipboard = { kind: 'light', data: JSON.parse(JSON.stringify(l)) as MapLight };
      return true;
    }
    const o = this.layout.objects.find((obj) => obj.id === id);
    if (!o) return false;
    this.clipboard = { kind: 'object', data: JSON.parse(JSON.stringify(o)) as MapObject };
    return true;
  }

  duplicateSelected(): void {
    if (this.isSelectedLocked()) return;
    if (!this.captureSelectedToClipboard()) return;
    this.pasteSelected();
  }

  /** True when the current object selection is locked (edits are blocked). */
  private isSelectedLocked(): boolean {
    const id = this.selectedObjectId;
    if (!id) return false;
    const obj = this.layout.objects.find((o) => o.id === id);
    return !!obj?.locked;
  }

  /**
   * Toggles editor protection for an object. Locked objects can't be picked
   * from the scene or edited until explicitly unlocked from the list/
   * inspector.
   */
  setLocked(id: string, locked: boolean): void {
    const obj = this.layout.objects.find((o) => o.id === id);
    if (!obj) return;
    this.recordHistory();
    obj.locked = locked;
    this.dirty = true;
    if (locked) {
      // Keep the object selected for its inspector, but drop the gizmo.
      this.lockedSel = id;
      if (this.gizmo.attachedMesh) this.gizmo.attachToMesh(null);
    } else if (this.lockedSel === id) {
      this.lockedSel = null;
      const control = this.controlOf.get(id);
      if (control) this.gizmo.attachToMesh(control);
    }
    this.onChange?.();
  }

  updateSpawn(index: number, partial: { position?: [number, number, number]; yaw?: number }): void {
    const s = this.layout.spawns[index];
    if (!s) return;
    this.recordHistory();
    if (partial.position) s.position = [...partial.position];
    if (typeof partial.yaw === 'number') s.yaw = partial.yaw;
    const base = this.spawnMarkers[index];
    if (base) {
      base.position = new Vector3(s.position[0], s.position[1], s.position[2]);
      base.rotation = new Vector3(0, s.yaw, 0);
    }
    this.dirty = true;
    this.onChange?.();
  }

  updateLightById(
    id: string,
    partial: {
      position?: [number, number, number];
      color?: [number, number, number];
      intensity?: number;
      range?: number;
    }
  ): void {
    const l = this.layout.lights.find((o) => o.id === id);
    if (!l) return;
    this.recordHistory();
    if (partial.position) l.position = [...partial.position];
    if (partial.color) {
      l.color = [
        Math.max(0, Math.min(1, partial.color[0])),
        Math.max(0, Math.min(1, partial.color[1])),
        Math.max(0, Math.min(1, partial.color[2]))
      ];
    }
    if (typeof partial.intensity === 'number') l.intensity = Math.max(0, partial.intensity);
    if (typeof partial.range === 'number') l.range = Math.max(0, partial.range);

    const marker = this.controlOf.get(id);
    if (marker) marker.position = new Vector3(l.position[0], l.position[1], l.position[2]);
    const light = (this.scene.getLightByName(l.name) as PointLight | null) ?? undefined;
    if (light) {
      light.diffuse = new Color3(l.color[0], l.color[1], l.color[2]);
      light.intensity = Math.max(0, l.intensity);
      light.range = Math.max(0, l.range);
    }
    this.dirty = true;
    this.onChange?.();
  }

  applyTransform(field: 'x' | 'y' | 'z', axis: 'position' | 'rotation' | 'scale', value: number): void {
    const id = this.selectedObjectId;
    if (!id) return;
    const control = this.controlOf.get(id);
    if (!control) return;
    const obj = this.layout.objects.find((o) => o.id === id);
    if (!obj || obj.locked) return;
    this.recordHistory();

    if (axis === 'position') {
      control.position[field] = value;
      obj.position = [control.position.x, control.position.y, control.position.z];
    } else if (axis === 'rotation') {
      control.rotation[field] = value;
      obj.rotation = [control.rotation.x, control.rotation.y, control.rotation.z];
    } else if (obj.kind === 'component') {
      control.scaling[field] = value;
      const c = obj as typeof obj;
      (c as { scale: [number, number, number] }).scale = [
        control.scaling.x,
        control.scaling.y,
        control.scaling.z
      ];
      obj.position = [control.position.x, control.position.y, control.position.z];
      obj.rotation = [control.rotation.x, control.rotation.y, control.rotation.z];
    }
    this.dirty = true;
  }

  renameSelected(name: string): void {
    const cleaned = name.trim();
    if (!cleaned) return;
    if (this.isSelectedLocked()) return;
    this.recordHistory();
    if (this.selectedObjectId) {
      const obj = this.layout.objects.find((o) => o.id === this.selectedObjectId);
      if (obj) {
        obj.name = cleaned;
        this.dirty = true;
      }
    } else if (this.selectedLightId) {
      const l = this.layout.lights.find((o) => o.id === this.selectedLightId);
      if (l) {
        l.name = cleaned;
        this.dirty = true;
      }
    }
  }

  applyMaterial(key: string): void {
    const id = this.selectedObjectId;
    if (!id) return;
    const obj = this.layout.objects.find((o) => o.id === id);
    if (!obj || (obj.kind !== 'box' && obj.kind !== 'ground') || obj.locked) return;
    const mat = (this.b.mats as unknown as Record<string, StandardMaterial>)[key];
    if (!mat) return;
    this.recordHistory();
    const control = this.controlOf.get(id);
    if (control) control.material = mat;
    obj.material = key;
    this.dirty = true;
  }

  applyCollidable(collidable: boolean): void {
    const id = this.selectedObjectId;
    if (!id) return;
    const obj = this.layout.objects.find((o) => o.id === id);
    if (!obj || (obj.kind !== 'box' && obj.kind !== 'ground') || obj.locked) return;
    this.recordHistory();
    obj.collidable = collidable;
    const control = this.controlOf.get(id);
    if (control) control.checkCollisions = collidable;
    this.dirty = true;
  }

  updateComponentParam(key: string, value: number | string | boolean): void {
    const id = this.selectedObjectId;
    if (!id) return;
    const obj = this.layout.objects.find((o) => o.id === id);
    if (!obj || obj.kind !== 'component' || obj.locked) return;
    this.recordHistory();
    obj.params = { ...obj.params, [key]: value };
    // Rebuild this component from its params.
    disposeObjectMeshes(this.b, id);
    this.controlOf.delete(id);
    this.buildMapObjectNow(obj);
    this.dirty = true;
    this.selectByObject(obj);
  }

  private projectOnGround(): Vector3 {
    try {
      const pick = this.scene.pick(
        this.canvas.clientWidth / 2,
        this.canvas.clientHeight / 2,
        (m) => {
          // Same as snapToGroundPoint: predicates disable Babylon's built-in
          // isPickable filtering, so exclude non-pickable dressing (sky dome,
          // clouds, hills, editor grid) from the center-screen projection.
          if (!m.isPickable) return false;
          const meta = m.metadata as { editorId?: string; spawnIndex?: number } | undefined;
          return !meta;
        }
      );
      if (pick?.pickedPoint) return pick.pickedPoint;
    } catch {
      /* fall through */
    }
    return new Vector3(0, 0, 0);
  }

  // ── Import / export ──────────────────────────────────────────────────────

  serialize(): string {
    return serializeLayout(this.layout);
  }

  importJSON(json: string): { ok: boolean; error?: string; count?: number } {
    try {
      const parsed = parseLayout(json);
      this.recordHistory();
      this.layout = parsed;
      this.rebuildWorld();
      this.buildSpawnMarkers();
      this.dirty = false;
      this.onChange?.();
      return { ok: true, count: parsed.objects.length };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Invalid map file' };
    }
  }

  resetToDefault(): void {
    this.recordHistory();
    this.layout = cloneLayout(loadDefaultLayout() ?? emptyLayout('kyoto'));
    this.rebuildWorld();
    this.buildSpawnMarkers();
    this.dirty = false;
    this.onChange?.();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  handleResize(): void {
    this.engine.resize();
  }

  dispose(): void {
    this.engine.stopRenderLoop();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.terrainStroke = null;
    this.terrainOf.clear();
    this.terrainCursor = null;
    this.gizmo.dispose();
    this.canvas.style.cursor = 'default';
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.scene.dispose();
    this.engine.dispose();
  }
}