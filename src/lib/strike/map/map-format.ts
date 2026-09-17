import { Vector3 } from '@babylonjs/core';

/**
 * The .wsmap serialization format for Waifu Space strike maps.
 *
 * A map is a list of reusable objects. Boxes and grounds are primitives;
 * components (machiya houses, sakura trees, torii, lanterns, …) are stored
 * by id + params so they stay fully reusable in the editor palette.
 *
 * Positions/rotations/scales are stored as plain arrays so the file is
 * trivially readable and diffable. Rotations are radians.
 */

export const MAP_FORMAT = 'waifu-space-map';
export const MAP_VERSION = 1;

export interface MapSpawn {
  position: [number, number, number];
  yaw: number;
}

export interface MapObjectBase {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  /** Editor safety: locked objects are ignored for scene picking/editing. */
  locked?: boolean;
}

export interface MapBoxObject extends MapObjectBase {
  kind: 'box';
  w: number;
  h: number;
  d: number;
  material: string;
  collidable: boolean;
}

export interface MapGroundObject extends MapObjectBase {
  kind: 'ground';
  width: number;
  height: number;
  material: string;
  collidable: boolean;
  /**
   * Sculpted terrain: subdivision count of the heightfield grid. Absent on
   * flat, never-edited grounds (they keep the builder's default mesh).
   */
  subdivisions?: number;
  /** Heightfield: local-space Y offsets per vertex, row-major, (N+1)² entries. */
  heightmap?: number[];
  /** Painted overlay texture as a base64 PNG data URL (texture brush). */
  paint?: string;
}

export interface MapComponentObject extends MapObjectBase {
  kind: 'component';
  component: string;
  scale: [number, number, number];
  params: Record<string, number | string | boolean>;
}

export type MapObject = MapBoxObject | MapGroundObject | MapComponentObject;

/** An artist-authored point light (colors 0..1) rendered from the layout. */
export interface MapLight {
  id: string;
  name: string;
  position: [number, number, number];
  color: [number, number, number];
  intensity: number;
  range: number;
}

export interface MapLayout {
  format: string;
  version: number;
  name: string;
  spawns: MapSpawn[];
  objects: MapObject[];
  lights: MapLight[];
}

export const MAP_OBJECT_KINDS: Array<MapObject['kind']> = ['box', 'ground', 'component'];

/**
 * Records every primitive emitted while a map is being built so the built
 * scene can be serialized back into a .wsmap layout. Components open a
 * "group" via begin()/end(); everything emitted inside the group is folded
 * into a single reusable component entry.
 */
export class MapRecorder {
  readonly objects: MapObject[] = [];
  private stack: Array<{ kind: string; name: string }> = [];
  private seq = 0;

  private nextId(): string {
    this.seq += 1;
    return `o_${this.seq.toString().padStart(4, '0')}`;
  }

  get inComponent(): boolean {
    return this.stack.length > 0;
  }

  begin(
    kind: string,
    name: string,
    pos: Vector3,
    params: Record<string, number | string | boolean> = {},
    rotation: Vector3 = new Vector3(0, 0, 0)
  ): void {
    this.objects.push({
      id: this.nextId(),
      name,
      kind: 'component',
      component: kind,
      position: [pos.x, pos.y, pos.z],
      rotation: [rotation.x, rotation.y, rotation.z],
      scale: [1, 1, 1],
      params
    });
    this.stack.push({ kind, name });
  }

  end(): void {
    this.stack.pop();
  }

  recordBox(
    name: string,
    w: number,
    h: number,
    d: number,
    pos: Vector3,
    material: string,
    collidable: boolean
  ): void {
    if (this.inComponent) return;
    this.objects.push({
      id: this.nextId(),
      name,
      kind: 'box',
      w,
      h,
      d,
      position: [pos.x, pos.y, pos.z],
      rotation: [0, 0, 0],
      material,
      collidable
    });
  }

  recordGround(
    name: string,
    width: number,
    height: number,
    pos: Vector3,
    material: string,
    collidable: boolean,
    terrain?: { subdivisions?: number; heightmap?: number[] }
  ): void {
    if (this.inComponent) return;
    const ground: MapGroundObject = {
      id: this.nextId(),
      name,
      kind: 'ground',
      width,
      height,
      position: [pos.x, pos.y, pos.z],
      rotation: [0, 0, 0],
      material,
      collidable
    };
    if (terrain && terrain.subdivisions !== undefined) ground.subdivisions = terrain.subdivisions;
    if (terrain?.heightmap && terrain.heightmap.length > 0) ground.heightmap = [...terrain.heightmap];
    this.objects.push(ground);
  }

  toLayout(name: string, spawns: MapSpawn[]): MapLayout {
    return {
      format: MAP_FORMAT,
      version: MAP_VERSION,
      name,
      spawns: spawns.map((s) => ({ position: [s.position[0], s.position[1], s.position[2]], yaw: s.yaw })),
      objects: this.objects,
      lights: []
    };
  }
}

/** Radians ⇄ plain-array helpers shared by the editor, loader and tests. */
export function arr3(v: Vector3): [number, number, number] {
  return [v.x, v.y, v.z];
}

export function vec3(v: [number, number, number]): Vector3 {
  return new Vector3(v[0], v[1], v[2]);
}

export function snapRound(v: number, step: number): number {
  if (!step || step <= 0) return v;
  return Math.round(v / step) * step;
}

/**
 * The default spawn layout (Kyoto). Mirrors the competitive south/north
 * base positions and is also used as a fallback when no .wsmap is present.
 */
export const DEFAULT_KYOTO_SPAWNS: MapSpawn[] = [
  { position: [-4, 1.0, 46], yaw: 0 },
  { position: [4, 1.0, 46], yaw: 0 },
  { position: [-10, 1.0, 44], yaw: 0 },
  { position: [10, 1.0, 44], yaw: 0 },
  { position: [-2, 1.0, 43], yaw: 0 },
  { position: [2, 1.0, 43], yaw: 0 },
  { position: [-4, 1.0, -46], yaw: Math.PI },
  { position: [4, 1.0, -46], yaw: Math.PI },
  { position: [-10, 1.0, -44], yaw: Math.PI },
  { position: [10, 1.0, -44], yaw: Math.PI },
  { position: [-2, 1.0, -43], yaw: Math.PI },
  { position: [2, 1.0, -43], yaw: Math.PI }
];

export function emptyLayout(name = 'new-map'): MapLayout {
  return {
    format: MAP_FORMAT,
    version: 1,
    name,
    spawns: DEFAULT_KYOTO_SPAWNS.map((s) => ({ position: [...s.position], yaw: s.yaw })),
    objects: [],
    lights: []
  };
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function toVec3Array(v: unknown): [number, number, number] {
  if (Array.isArray(v) && v.length === 3 && v.every(isFiniteNum)) {
    return [v[0], v[1], v[2]];
  }
  return [0, 0, 0];
}

/** Parses and validates a .wsmap JSON document. */
export function parseLayout(json: string): MapLayout {
  const raw = JSON.parse(json);
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid map file: not an object');
  }
  if (raw.format !== MAP_FORMAT) {
    throw new Error(`Invalid map format "${String(raw.format)}" — expected "${MAP_FORMAT}"`);
  }
  const version = isFiniteNum(raw.version) ? raw.version : Number.NaN;
  if (Number.isNaN(version)) {
    throw new Error('Invalid map file: missing version');
  }
  const objects: MapObject[] = Array.isArray(raw.objects)
    ? raw.objects
        .filter((o: unknown) => o && typeof o === 'object')
        .map((o: Record<string, unknown>) => {
          const base = {
            id: String(o.id ?? ''),
            name: String(o.name ?? 'unnamed'),
            position: toVec3Array(o.position),
            rotation: toVec3Array(o.rotation),
            ...(o.locked === true ? { locked: true } : {})
          };
          const mat = String(o.material ?? 'plaster');
          if (o.kind === 'box') {
            return {
              ...base,
              kind: 'box' as const,
              w: isFiniteNum(o.w) ? o.w : 1,
              h: isFiniteNum(o.h) ? o.h : 1,
              d: isFiniteNum(o.d) ? o.d : 1,
              material: mat,
              collidable: o.collidable !== false
            };
          }
          if (o.kind === 'ground') {
            const ground: MapGroundObject = {
              ...base,
              kind: 'ground' as const,
              width: isFiniteNum(o.width) ? o.width : 10,
              height: isFiniteNum(o.height) ? o.height : 10,
              material: mat,
              collidable: o.collidable !== false
            };
            if (isFiniteNum(o.subdivisions) && o.subdivisions >= 2) {
              ground.subdivisions = Math.round(o.subdivisions);
            }
            if (
              ground.subdivisions !== undefined &&
              Array.isArray(o.heightmap) &&
              o.heightmap.length === (ground.subdivisions + 1) * (ground.subdivisions + 1) &&
              o.heightmap.every(isFiniteNum)
            ) {
              ground.heightmap = (o.heightmap as number[]).slice();
            }
            if (typeof o.paint === 'string' && o.paint.length > 0) {
              ground.paint = o.paint;
            }
            return ground;
          }
          return {
            ...base,
            kind: 'component' as const,
            component: String(o.component ?? 'box'),
            scale: toVec3Array(o.scale),
            params: (o.params && typeof o.params === 'object' ? o.params : {}) as Record<string, number | string | boolean>
          };
        })
    : [];
  const spawns: MapSpawn[] = Array.isArray(raw.spawns)
    ? raw.spawns
        .filter((s: unknown) => s && typeof s === 'object')
        .map((s: Record<string, unknown>) => ({
          position: toVec3Array(s.position),
          yaw: isFiniteNum(s.yaw) ? s.yaw : 0
        }))
    : [];

  const lights: MapLight[] = Array.isArray(raw.lights)
    ? raw.lights
        .filter((o: unknown) => o && typeof o === 'object')
        .map((o: Record<string, unknown>) => {
          const rawColor = Array.isArray(o.color) ? o.color : [1, 0.8, 0.45];
          const clamp1 = (x: unknown, fb: number): number =>
            isFiniteNum(x) ? Math.max(0, Math.min(1, x)) : fb;
          return {
            id: String(o.id ?? ''),
            name: String(o.name ?? 'Light'),
            position: toVec3Array(o.position),
            color: [clamp1(rawColor[0], 1), clamp1(rawColor[1], 0.8), clamp1(rawColor[2], 0.45)] as [
              number,
              number,
              number
            ],
            intensity: isFiniteNum(o.intensity) ? Math.max(0, o.intensity) : 1,
            range: isFiniteNum(o.range) ? o.range : 12
          };
        })
    : [];

  return {
    format: MAP_FORMAT,
    version,
    name: String(raw.name ?? 'kyoto'),
    spawns,
    objects,
    lights
  };
}

/**
 * Serializes a layout to the compact .wsmap JSON document (single line —
 * the layout is machine-authored and edited from the in-browser editor).
 */
export function serializeLayout(layout: MapLayout): string {
  return JSON.stringify(layout);
}