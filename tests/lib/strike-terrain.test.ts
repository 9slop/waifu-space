import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NullEngine, Scene, MeshBuilder, GroundMesh, Vector3 } from '@babylonjs/core';
import {
  PAINT_LIFT,
  createPaintOverlay,
  createPaintTexture,
  findPaintOverlay,
  stampPaint
} from '../../src/lib/strike/map/paint';
import {
  TERRAIN_SUBDIVISIONS,
  brushFalloff,
  makeTerrainHeights,
  raiseHeights,
  lowerHeights,
  sanitizeTerrainHeights,
  smoothHeights,
  subdivisionsFromHeightmap,
  terrainCellSizeX,
  terrainIndex,
  terrainVertexCount,
  terrainWorldToGrid,
  applyHeightmapToMesh
} from '../../src/lib/strike/map/terrain';

describe('strike terrain heightfield math', () => {
  it('indexes row-major and counts vertices as (subdivisions + 1)²', () => {
    const n = 4;
    expect(terrainVertexCount(n)).toBe(25);
    expect(terrainIndex(0, 0, n)).toBe(0);
    expect(terrainIndex(n, 0, n)).toBe(n);
    expect(terrainIndex(0, 1, n)).toBe(n + 1);
    expect(terrainIndex(n, n, n)).toBe(24);
  });

  it('maps local corners onto the CreateGround vertex layout (col left→right, row +Z→-Z)', () => {
    const width = 10;
    const height = 8;
    const n = 4;
    const halfW = width / 2;
    const halfH = height / 2;

    const topLeft = terrainWorldToGrid(-halfW, halfH, width, height, n);
    expect(topLeft.col).toBeCloseTo(0);
    expect(topLeft.row).toBeCloseTo(0);

    const bottomRight = terrainWorldToGrid(halfW, -halfH, width, height, n);
    expect(bottomRight.col).toBeCloseTo(n);
    expect(bottomRight.row).toBeCloseTo(n);

    const center = terrainWorldToGrid(0, 0, width, height, n);
    expect(center.col).toBeCloseTo(n / 2);
    expect(center.row).toBeCloseTo(n / 2);
  });

  it('clamps world-to-grid coordinates to the terrain bounds', () => {
    const clamped = terrainWorldToGrid(-999, 999, 10, 10, 8);
    expect(clamped.col).toBe(0);
    expect(clamped.row).toBe(0);
    const clamped2 = terrainWorldToGrid(999, -999, 10, 10, 8);
    expect(clamped2.col).toBe(8);
    expect(clamped2.row).toBe(8);
  });

  it('computes per-axis cell sizes for non-square grounds', () => {
    expect(terrainCellSizeX(100, 50)).toBe(2);
  });

  it('falls off from 1 at the brush center to 0 at the edge', () => {
    expect(brushFalloff(0, 2)).toBeCloseTo(1);
    expect(brushFalloff(2, 2)).toBe(0);
    expect(brushFalloff(3, 2)).toBe(0);
    const mid = brushFalloff(1, 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('derives subdivisions from a heightmap vertex count', () => {
    expect(subdivisionsFromHeightmap(terrainVertexCount(TERRAIN_SUBDIVISIONS))).toBe(TERRAIN_SUBDIVISIONS);
    expect(subdivisionsFromHeightmap(25)).toBe(4);
    expect(subdivisionsFromHeightmap(24)).toBeNull();
    expect(subdivisionsFromHeightmap(0)).toBeNull();
  });

  it('sanitizes malformed heightmaps', () => {
    expect(sanitizeTerrainHeights(null, 4)).toBeNull();
    expect(sanitizeTerrainHeights([0, 1, 2], 4)).toBeNull();
    const fixed = sanitizeTerrainHeights([0, NaN, Infinity, 'x', ...new Array(21).fill(0)], 4);
    expect(fixed).not.toBeNull();
    expect(fixed!.length).toBe(25);
    expect(fixed!.every((v) => Number.isFinite(v))).toBe(true);
    expect(fixed![0]).toBe(0);
  });
});

describe('strike terrain brushes', () => {
  const n = 16;
  const spec = { centerCol: 8, centerRow: 8, radiusCols: 3, radiusRows: 3 };

  it('raises the center more than the edge and leaves cells outside the brush untouched', () => {
    const heights = makeTerrainHeights(n);
    raiseHeights(heights, n, spec, 1);

    const center = heights[terrainIndex(8, 8, n)];
    const nearEdge = heights[terrainIndex(10, 8, n)];
    const outside = heights[terrainIndex(16, 16, n)];

    expect(center).toBeCloseTo(1);
    expect(nearEdge).toBeGreaterThan(0);
    expect(nearEdge).toBeLessThan(center);
    expect(heights[terrainIndex(11, 8, n)]).toBe(0);
    expect(outside).toBe(0);
  });

  it('is symmetric around the brush center', () => {
    const heights = makeTerrainHeights(n);
    raiseHeights(heights, n, spec, 1);
    expect(heights[terrainIndex(7, 8, n)]).toBeCloseTo(heights[terrainIndex(9, 8, n)]);
    expect(heights[terrainIndex(8, 7, n)]).toBeCloseTo(heights[terrainIndex(8, 9, n)]);
  });

  it('lowers with the same magnitude as raising', () => {
    const raised = makeTerrainHeights(n);
    const lowered = makeTerrainHeights(n);
    raiseHeights(raised, n, spec, 2);
    lowerHeights(lowered, n, spec, 2);
    for (let i = 0; i < raised.length; i++) {
      expect(lowered[i]).toBeCloseTo(-raised[i]);
    }
  });

  it('smooths a single spike back toward its neighbors', () => {
    const heights = makeTerrainHeights(n);
    heights[terrainIndex(8, 8, n)] = 10;
    const before = heights[terrainIndex(8, 8, n)];
    smoothHeights(heights, n, spec, 0.5);
    expect(heights[terrainIndex(8, 8, n)]).toBeLessThan(before);
    expect(heights[terrainIndex(8, 8, n)]).toBeGreaterThan(0);
  });

  it('treats brush radii independently per axis on non-square grounds', () => {
    const tall = { centerCol: 8, centerRow: 8, radiusCols: 1, radiusRows: 4 };
    const heights = makeTerrainHeights(n);
    raiseHeights(heights, n, tall, 1);
    expect(heights[terrainIndex(8, 11, n)]).toBeGreaterThan(0);
    expect(heights[terrainIndex(9, 8, n)]).toBe(0);
  });
});

describe('applyHeightmapToMesh', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('writes vertex heights matching the CreateGround vertex layout', () => {
    const n = 4;
    const mesh = MeshBuilder.CreateGround('t', { width: 10, height: 10, subdivisions: n }, scene) as GroundMesh;
    const heights = makeTerrainHeights(n).map((_, i) => i);
    applyHeightmapToMesh(mesh, heights, n);

    const positions = mesh.getVerticesData('position')!;
    for (let row = 0; row <= n; row++) {
      for (let col = 0; col <= n; col++) {
        const idx = terrainIndex(col, row, n);
        expect(positions[idx * 3 + 1]).toBeCloseTo(heights[idx]);
        expect(positions[idx * 3]).toBeCloseTo(-5 + (col * 10) / n);
        expect(positions[idx * 3 + 2]).toBeCloseTo(5 - (row * 10) / n);
      }
    }
  });

  it('updates collision height quads so getHeightAtCoordinates tracks the sculpted surface', () => {
    const n = 4;
    const mesh = MeshBuilder.CreateGround('t2', { width: 10, height: 10, subdivisions: n }, scene) as GroundMesh;
    const heights = makeTerrainHeights(n).fill(1.5);
    applyHeightmapToMesh(mesh, heights, n);
    expect(mesh.getHeightAtCoordinates(0, 0)).toBeCloseTo(1.5, 1);
  });

  it('ignores mismatched heightmap lengths', () => {
    const n = 4;
    const mesh = MeshBuilder.CreateGround('t3', { width: 6, height: 6, subdivisions: n }, scene) as GroundMesh;
    applyHeightmapToMesh(mesh, [1, 2, 3], n);
    const positions = mesh.getVerticesData('position')!;
    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i + 1]).toBeCloseTo(0);
    }
  });

  it('lifts every vertex by the optional lift offset', () => {
    const n = 2;
    const mesh = MeshBuilder.CreateGround('t4', { width: 4, height: 4, subdivisions: n }, scene) as GroundMesh;
    applyHeightmapToMesh(mesh, makeTerrainHeights(n).fill(0.5), n, 0.25);
    const positions = mesh.getVerticesData('position')!;
    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i + 1]).toBeCloseTo(0.75);
    }
  });
});

describe('strike terrain paint overlay', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('builds an alpha-blended overlay lifted above the ground surface', () => {
    const subdivisions = 2;
    const heights = makeTerrainHeights(subdivisions).fill(1);
    const overlay = createPaintOverlay(scene, {
      id: 'g1',
      width: 8,
      height: 6,
      subdivisions,
      heights,
      position: new Vector3(3, 0.5, -2),
      editor: true
    });

    expect(overlay.mesh.name).toBe('g1__paint');
    expect(overlay.mesh.isPickable).toBe(false);
    expect(overlay.mesh.checkCollisions).toBe(false);
    expect(overlay.mesh.position.equals(new Vector3(3, 0.5, -2))).toBe(true);
    expect(overlay.mesh.metadata).toEqual({ editorId: 'g1', paintOverlay: true });

    const positions = overlay.mesh.getVerticesData('position')!;
    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i + 1]).toBeCloseTo(1 + PAINT_LIFT);
    }

    expect(overlay.material.diffuseTexture).toBe(overlay.texture);
    expect(overlay.material.opacityTexture).toBe(overlay.texture);
    expect(overlay.material.useAlphaFromDiffuseTexture).toBe(true);
    expect(overlay.texture.hasAlpha).toBe(true);
  });

  it('finds a built overlay by ground id and ignores unknown ids', () => {
    createPaintOverlay(scene, {
      id: 'g2',
      width: 4,
      height: 4,
      subdivisions: 2,
      heights: null,
      position: new Vector3(0, 0, 0),
      editor: true
    });

    expect(findPaintOverlay(scene, 'g2')?.mesh.name).toBe('g2__paint');
    expect(findPaintOverlay(scene, 'missing')).toBeNull();
  });

  it('stampPaint fails gracefully without a source or canvas', () => {
    const texture = createPaintTexture(scene, 'paintTex');
    expect(stampPaint(texture, null, 0, 0, 4, 4, 1, 1)).toBe(false);
  });
});
