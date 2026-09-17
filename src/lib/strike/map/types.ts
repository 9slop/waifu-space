import {
  Scene,
  Vector3,
  Color3,
  AbstractMesh,
  StandardMaterial,
  PointLight,
  ShadowGenerator,
  DirectionalLight,
  HemisphericLight
} from '@babylonjs/core';
import type { ShadowQuality } from '../strike-types';

export interface BabylonSpawnPoint {
  position: Vector3;
  yaw: number;
}

export interface BabylonMapData {
  spawnPoints: BabylonSpawnPoint[];
  colliders: AbstractMesh[];
  shadowGenerator?: ShadowGenerator;
  sunLight?: DirectionalLight;
  hemiLight?: HemisphericLight;
  setRtxShadows?: (enabled: boolean) => void;
  setShadowQuality?: (quality: ShadowQuality) => void;
  updateDayNightCycle?: (elapsedSeconds: number) => void;
  /** Player-interactive elements (doors, etc.) for runtime behavior. */
  interactables?: MapInteractable[];
}

/** A player-interactive map element that the game engine can animate. */
export type MapInteractableType = 'door';

export interface MapDoorInteractable {
  type: 'door';
  id: string;
  /** The hinge pivot mesh rotated when the door opens / closes. The engine
   *  reads its live world position via getAbsolutePosition() for proximity
   *  checks (component meshes are re-parented after registration). */
  mesh: AbstractMesh;
  /** Swing direction around mesh rotation.y (1 = clockwise, -1 = counter). */
  swing: 1 | -1;
  /** Live state toggled by the engine when the player interacts. */
  open: boolean;
}

export type MapInteractable = MapDoorInteractable;

/**
 * Shared material library for the Kyoto map. Every material is created once
 * and shared across all sections to keep draw calls and GPU memory low.
 */
export interface MapMaterials {
  ground: StandardMaterial;
  wall: StandardMaterial;
  plaster: StandardMaterial;
  timber: StandardMaterial;
  tileRoof: StandardMaterial;
  shoji: StandardMaterial;
  shrineRed: StandardMaterial;
  crate: StandardMaterial;
  zenSand: StandardMaterial;
  woodDeck: StandardMaterial;
  bark: StandardMaterial;
  stone: StandardMaterial;
  darkWood: StandardMaterial;
  straw: StandardMaterial;
  gold: StandardMaterial;
  lanternGlow: StandardMaterial;
  windowGlow: StandardMaterial;
  sakura: StandardMaterial;
  bush: StandardMaterial;
  bamboo: StandardMaterial;
  neonPink: StandardMaterial;
  neonCyan: StandardMaterial;
  water: StandardMaterial;
  ceramic: StandardMaterial;
  moss: StandardMaterial;
  metal: StandardMaterial;
  fabric: StandardMaterial;
  blanket: StandardMaterial;
}

export interface PointLightOptions {
  diffuse?: Color3;
  specular?: Color3;
  intensity?: number;
  range?: number;
}

/** Mesh options for addGround: higher-resolution subdivision + optional heightfield. */
export interface GroundBuildOptions {
  /** Number of cells per side; defaults to the builder's flat-ground mesh. */
  subdivisions?: number;
  /** Local Y offsets per vertex, row-major (subdivisions + 1)² entries. */
  heightmap?: number[];
}

/**
 * Shared build context passed to every map component and section.
 * Owns collider registration, shadow casting, lantern light collection
 * (used later by the day/night cycle), and optional .wsmap recording.
 */
export interface MapBuilder {
  scene: Scene;
  mats: MapMaterials;
  colliders: AbstractMesh[];
  lanternLights: PointLight[];
  /** Player-interactive elements registered by components. */
  interactables: MapInteractable[];
  /** Editor mode: meshes are not frozen and stay transformable. */
  editor: boolean;
  /** Active .wsmap recorder (present when built with record: true). */
  recorder?: import('./map-format').MapRecorder;

  /** Box with automatic collision and shadow registration */
  addBox(
    name: string,
    w: number,
    h: number,
    d: number,
    pos: Vector3,
    mat: StandardMaterial,
    collidable?: boolean,
    castShadow?: boolean,
    rotation?: Vector3,
    scale?: Vector3
  ): AbstractMesh;

  /** Flat or sculpted ground plane recorded as a 'ground' object */
  addGround(
    name: string,
    width: number,
    height: number,
    pos: Vector3,
    mat: StandardMaterial,
    collidable?: boolean,
    terrain?: GroundBuildOptions
  ): AbstractMesh;

  /** Registers a warm point light that participates in the day/night cycle */
  addLanternLight(
    name: string,
    pos: Vector3,
    opts?: PointLightOptions
  ): PointLight;

  /** Registers a shadow caster if shadow generation is available */
  addShadowCaster(mesh: AbstractMesh): void;

  /** Opens a reusable component group (house/tree/lantern, …); no-op elsewhere */
  beginComponent(
    kind: string,
    name: string,
    pos: Vector3,
    params?: Record<string, number | string | boolean>,
    rotation?: Vector3
  ): void;

  /** Closes the currently open component group */
  endComponent(): void;

  /** Whether a component group is currently being built */
  inComponent(): boolean;

  /** Captures point lights emitted while the last component was being built */
  takeComponentLights(): PointLight[];

  /** Registers a player-interactive element (see MapInteractable) for the game engine */
  registerInteractable(interactable: MapInteractable): void;
}
