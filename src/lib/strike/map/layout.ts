import { Vector3, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import type { MapBuilder } from './types';
import type { PointLight } from '@babylonjs/core';
import { buildComponent } from './components/registry';
import kyotoRaw from './kyoto.wsmap?raw';
import { MAP_FORMAT, parseLayout, vec3 } from './map-format';
import type {
  MapGroundObject,
  MapObject,
  MapLayout,
  MapSpawn,
  MapLight
} from './map-format';

export type {
  MapLayout,
  MapObject,
  MapBoxObject,
  MapGroundObject,
  MapComponentObject,
  MapSpawn,
  MapLight
} from './map-format';

export {
  MapRecorder,
  MAP_FORMAT,
  MAP_VERSION,
  MAP_OBJECT_KINDS,
  DEFAULT_KYOTO_SPAWNS,
  emptyLayout,
  parseLayout,
  serializeLayout,
  vec3,
  arr3,
  snapRound
} from './map-format';

/**
 * Loads the bundled default map (src/lib/strike/map/kyoto.wsmap).
 * Returns null if the file is missing or malformed so callers can fall
 * back to building the sections directly.
 */
export function loadDefaultLayout(): MapLayout | null {
  try {
    return parseLayout(kyotoRaw as string);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[map] kyoto.wsmap unreadable, falling back to built-in sections', err);
    return null;
  }
}

function resolveMaterial(b: MapBuilder, key: string): any {
  const mats = b.mats as unknown as Record<string, unknown>;
  return (mats[key] as any) ?? mats.plaster;
}

/** Builds a single layout object into the scene. */
export function buildMapObject(b: MapBuilder, o: MapObject, editor = false): void {
  switch (o.kind) {
    case 'box': {
      const mesh = b.addBox(
        o.name,
        o.w,
        o.h,
        o.d,
        new Vector3(o.position[0], o.position[1], o.position[2]),
        resolveMaterial(b, o.material),
        o.collidable,
        true,
        new Vector3(o.rotation[0], o.rotation[1], o.rotation[2])
      );
      if (editor) mesh.metadata = { editorId: o.id };
      break;
    }
    case 'ground': {
      const obj = o as MapGroundObject;
      const mesh = b.addGround(
        o.name,
        obj.width,
        obj.height,
        new Vector3(o.position[0], o.position[1], o.position[2]),
        resolveMaterial(b, o.material),
        obj.collidable,
        obj.subdivisions !== undefined || obj.heightmap !== undefined
          ? { subdivisions: obj.subdivisions, heightmap: obj.heightmap }
          : undefined
      );
      if (editor) mesh.metadata = { editorId: o.id };
      break;
    }
    case 'component': {
      const root = MeshBuilder.CreateBox(`${o.id}__root`, { width: 0.7, height: 0.7, depth: 0.7 }, b.scene);
      root.position = new Vector3(o.position[0], o.position[1], o.position[2]);
      root.rotation = new Vector3(o.rotation[0], o.rotation[1], o.rotation[2]);
      root.scaling = new Vector3(o.scale[0] || 1, o.scale[1] || 1, o.scale[2] || 1);
      root.isPickable = false;
      root.visibility = 0.001;
      root.material = b.mats.plaster;
      if (editor) root.metadata = { editorId: o.id };

      const meshes = buildComponent(b, o.component, o.name, Vector3.Zero(), o.params);
      for (const m of meshes) {
        // Meshes already parented (component-internal hierarchies like doors,
        // bamboo culms, tree branches) must NOT be re-parented — that would
        // detach them from their animated parent. Only scene-level meshes get
        // attached to the component root.
        if (m.parent) continue;
        m.parent = root;
        if (editor) m.metadata = { editorId: o.id };
      }
      const lights = b.takeComponentLights();
      for (const l of lights) {
        l.parent = root;
      }
      root.computeWorldMatrix(true);
      break;
    }
  }
}

/** Builds every object in a layout into the scene. */
export function buildLayout(b: MapBuilder, layout: MapLayout, editor = false): void {
  for (const o of layout.objects) {
    buildMapObject(b, o, editor);
  }
  for (const l of layout.lights ?? []) {
    buildLayoutLight(b, l, editor);
  }
}

const LIGHT_MARKER_MAT = '__editorLightMarkerMat';

function lightMarkerMaterial(b: MapBuilder): StandardMaterial {
  let mat = b.scene.getMaterialByName(LIGHT_MARKER_MAT) as StandardMaterial | undefined;
  if (!mat) {
    mat = new StandardMaterial(LIGHT_MARKER_MAT, b.scene);
    mat.diffuseColor = new Color3(1.0, 0.85, 0.5);
    mat.emissiveColor = new Color3(1.0, 0.8, 0.45);
    mat.disableLighting = true;
  }
  return mat;
}

/**
 * Builds a single layout light. Game mode creates just the point light; editor
 * mode additionally creates a pickable glow sphere that drives the light so it
 * can be selected and translated with the gizmos.
 */
export function buildLayoutLight(b: MapBuilder, l: MapLight, editor = false): PointLight {
  const light = b.addLanternLight(l.name, vec3(l.position), {
    diffuse: new Color3(l.color[0], l.color[1], l.color[2]),
    specular: new Color3(0.2, 0.16, 0.1),
    intensity: Math.max(0, l.intensity),
    range: Math.max(0, l.range)
  });
  light.metadata = { editorId: l.id };
  if (editor) {
    const marker = MeshBuilder.CreateSphere(`${l.id}__light`, { diameter: 1.0, segments: 14 }, b.scene);
    marker.position = vec3(l.position);
    marker.material = lightMarkerMaterial(b);
    marker.isPickable = true;
    marker.metadata = { editorId: l.id };
    light.position = Vector3.Zero();
    light.parent = marker;
  }
  return light;
}

/**
 * Removes every mesh belonging to a layout object (recursively for roots).
 * Boxes/grounds are never parented and are disposed directly. Lights owned by
 * the layout are also disposed (their marker children go with the mesh).
 */
export function disposeObjectMeshes(b: MapBuilder, id: string): void {
  for (const m of [...b.scene.meshes]) {
    if (m.isDisposed()) continue;
    const meta = m.metadata as { editorId?: string } | undefined;
    if (meta && meta.editorId === id && !m.parent) {
      m.dispose();
    }
  }
  for (const light of b.scene.lights) {
    if (light.isDisposed()) continue;
    const meta = light.metadata as { editorId?: string } | undefined;
    if (meta && meta.editorId === id) {
      light.dispose();
    }
  }
}