import { describe, it, expect } from 'vitest';
import {
  generateDefenseMap,
  isBuildableTile,
  getTileAtPixel,
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE
} from '../../src/lib/defense-map';

describe('Procedural Defense Map Generation (defense-map.ts)', () => {
  it('generates a 20x12 grid with 40px tile dimensions', () => {
    const map = generateDefenseMap(42);
    expect(map.cols).toBe(GRID_COLS);
    expect(map.rows).toBe(GRID_ROWS);
    expect(map.tileSize).toBe(TILE_SIZE);
    expect(map.tiles.length).toBe(GRID_ROWS);
    expect(map.tiles[0].length).toBe(GRID_COLS);
  });

  it('creates a connected road starting at col 0 and ending at shrine col 18', () => {
    const map = generateDefenseMap(123);
    expect(map.waypoints.length).toBeGreaterThanOrEqual(4);
    // Waypoint 0 starts at x = 0
    expect(map.waypoints[0].x).toBe(0);
    // Final waypoint ends at shrine x
    const lastWp = map.waypoints[map.waypoints.length - 1];
    expect(lastWp.x).toBe(18 * TILE_SIZE + TILE_SIZE / 2);

    // Has road tiles cataloged
    expect(map.roadKeySet.size).toBeGreaterThan(15);
    map.roadKeySet.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(GRID_COLS);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(GRID_ROWS);
      expect(['road', 'shrine']).toContain(map.tiles[r][c].type);
    });
  });

  it('scatters obstacles strictly on non-road tiles', () => {
    const map = generateDefenseMap(999);
    expect(map.obstacleKeySet.size).toBeGreaterThanOrEqual(8);
    map.obstacleKeySet.forEach(key => {
      expect(map.roadKeySet.has(key)).toBe(false);
      const [c, r] = key.split(',').map(Number);
      const tile = map.tiles[r][c];
      expect(tile.type).toBe('obstacle');
      expect(tile.obstacleType).toBeDefined();
      expect(tile.obstacleIcon).toBeDefined();
    });
  });

  it('identifies buildable empty tiles and prevents placement on road or obstacles', () => {
    const map = generateDefenseMap(555);

    // Pick a road tile
    const roadKey = Array.from(map.roadKeySet)[0];
    const [rc, rr] = roadKey.split(',').map(Number);
    expect(isBuildableTile(map, rc, rr)).toBe(false);

    // Pick an obstacle tile
    const obsKey = Array.from(map.obstacleKeySet)[0];
    const [oc, or] = obsKey.split(',').map(Number);
    expect(isBuildableTile(map, oc, or)).toBe(false);

    // Shrine base is not buildable
    expect(isBuildableTile(map, map.shrineLocation.col, map.shrineLocation.row)).toBe(false);

    // Out of bounds is not buildable
    expect(isBuildableTile(map, -1, 0)).toBe(false);
    expect(isBuildableTile(map, 100, 100)).toBe(false);

    // Find an empty tile
    let foundEmpty = false;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (map.tiles[r][c].type === 'empty') {
          expect(isBuildableTile(map, c, r)).toBe(true);
          foundEmpty = true;
          break;
        }
      }
      if (foundEmpty) break;
    }
    expect(foundEmpty).toBe(true);
  });

  it('translates pixel coordinates into grid tiles via getTileAtPixel', () => {
    const map = generateDefenseMap(777);
    const tile = getTileAtPixel(map, 90, 160);
    expect(tile).toBeDefined();
    expect(tile?.col).toBe(Math.floor(90 / 40));
    expect(tile?.row).toBe(Math.floor(160 / 40));

    // Pixel out of bounds returns null
    expect(getTileAtPixel(map, -10, 50)).toBeNull();
    expect(getTileAtPixel(map, 850, 200)).toBeNull();
  });

  it('generates multiple distinct winding paths across seeds with tile (2,4) never on road', () => {
    const uniqueFirstTurns = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const map = generateDefenseMap(i * 17 + 3);
      // tile (2, 4) must never be a road tile
      expect(map.roadKeySet.has('2,4')).toBe(false);
      expect(map.tiles[4][2].type).not.toBe('road');

      // Check path variation by recording waypoint hashes
      const wpKey = map.waypoints.map(w => `${w.x},${w.y}`).join(';');
      uniqueFirstTurns.add(wpKey);
    }
    // We have 12 preset path variations, so 50 random seeds should sample at least 8 unique topologies
    expect(uniqueFirstTurns.size).toBeGreaterThanOrEqual(8);
  });
});