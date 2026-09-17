import {
  Scene,
  Vector3,
  Color3,
  MeshBuilder,
  AbstractMesh,
  StandardMaterial,
  PointLight,
  ShadowGenerator
} from '@babylonjs/core';
import type { MapBuilder, MapInteractable, MapMaterials, PointLightOptions, GroundBuildOptions } from './types';
import { createMapMaterials } from './materials';
import { MapRecorder } from './map-format';
import { applyHeightmapToMesh, subdivisionsFromHeightmap, terrainVertexCount } from './terrain';

export interface MapBuilderOptions {
  /** Editor mode: skip freezing world matrices so meshes stay editable. */
  editor?: boolean;
  /** Record every primitive/component so the built scene can be exported as .wsmap */
  record?: boolean;
}

function buildMaterialKeyIndex(mats: MapMaterials): Map<StandardMaterial, string> {
  const index = new Map<StandardMaterial, string>();
  (Object.keys(mats) as Array<keyof MapMaterials>).forEach((key) => {
    index.set(mats[key], key);
  });
  return index;
}

/**
 * Creates the shared build context used by every map component, section and
 * the map editor. Handles collider registration, shadow casting, day/night
 * lantern collection, and (optionally) .wsmap recording of everything built.
 */
export function createMapBuilder(
  scene: Scene,
  shadowGen?: ShadowGenerator,
  opts: MapBuilderOptions = {}
): MapBuilder {
  const colliders: AbstractMesh[] = [];
  const lanternLights: PointLight[] = [];
  const interactables: MapInteractable[] = [];
  const mats = createMapMaterials(scene);
  const matKeys = buildMaterialKeyIndex(mats);
  const matKey = (mat: StandardMaterial): string => matKeys.get(mat) ?? 'plaster';
  const recorder = opts.record ? new MapRecorder() : undefined;

  let componentDepth = 0;
  const componentLights: PointLight[] = [];

  return {
    scene,
    mats,
    colliders,
    lanternLights,
    interactables,
    editor: opts.editor ?? false,
    recorder,
    registerInteractable(interactable: MapInteractable): void {
      interactables.push(interactable);
    },
    beginComponent(
      kind: string,
      name: string,
      pos: Vector3,
      params: Record<string, number | string | boolean> = {},
      rotation: Vector3 = new Vector3(0, 0, 0)
    ): void {
      componentDepth += 1;
      recorder?.begin(kind, name, pos, params, rotation);
    },
    endComponent(): void {
      componentDepth = Math.max(0, componentDepth - 1);
      recorder?.end();
    },
    takeComponentLights(): PointLight[] {
      const captured = componentLights.slice();
      componentLights.length = 0;
      return captured;
    },
    inComponent(): boolean {
      return componentDepth > 0;
    },
    addBox(
      name: string,
      w: number,
      h: number,
      d: number,
      pos: Vector3,
      mat: StandardMaterial,
      collidable = true,
      castShadow = true,
      rotation?: Vector3,
      scale?: Vector3
    ): AbstractMesh {
      const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      box.position = pos;
      if (rotation) box.rotation = rotation;
      if (scale) box.scaling = scale;
      box.material = mat;
      box.receiveShadows = true;
      if (collidable) {
        box.checkCollisions = true;
        colliders.push(box);
      }
      if (castShadow && shadowGen) {
        shadowGen.addShadowCaster(box);
      }
      recorder?.recordBox(name, w, h, d, pos, matKey(mat), collidable);
      if (!(opts.editor ?? false)) {
        box.freezeWorldMatrix();
        box.doNotSyncBoundingInfo = true;
      }
      return box;
    },
    addGround(
      name: string,
      width: number,
      height: number,
      pos: Vector3,
      mat: StandardMaterial,
      collidable = true,
      terrain: GroundBuildOptions = {}
    ): AbstractMesh {
      const subdivisions =
        terrain.subdivisions ??
        (terrain.heightmap ? subdivisionsFromHeightmap(terrain.heightmap.length) : undefined) ??
        4;
      const ground = MeshBuilder.CreateGround(name, { width, height, subdivisions }, scene);
      ground.position = pos;
      ground.material = mat;
      ground.receiveShadows = true;
      if (terrain.heightmap && terrain.heightmap.length === terrainVertexCount(subdivisions)) {
        applyHeightmapToMesh(ground, terrain.heightmap, subdivisions);
      }
      if (collidable) {
        ground.checkCollisions = true;
        colliders.push(ground);
      }
      recorder?.recordGround(
        name,
        width,
        height,
        pos,
        matKey(mat),
        collidable,
        terrain.subdivisions !== undefined || terrain.heightmap ? { subdivisions, heightmap: terrain.heightmap } : undefined
      );
      if (!(opts.editor ?? false)) {
        ground.freezeWorldMatrix();
        ground.doNotSyncBoundingInfo = true;
      }
      return ground;
    },
    addLanternLight(name: string, pos: Vector3, optsLight: PointLightOptions = {}): PointLight {
      const pl = new PointLight(name, pos, scene);
      pl.diffuse = optsLight.diffuse ?? new Color3(1.0, 0.85, 0.5);
      pl.specular = optsLight.specular ?? new Color3(0.25, 0.18, 0.08);
      pl.intensity = optsLight.intensity ?? 1.2;
      pl.range = optsLight.range ?? 12;
      lanternLights.push(pl);
      if (componentDepth > 0) {
        componentLights.push(pl);
      }
      return pl;
    },
    addShadowCaster(mesh: AbstractMesh): void {
      if (shadowGen) {
        shadowGen.addShadowCaster(mesh);
      }
    }
  };
}