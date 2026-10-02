// Physical layout of the starting sanctuary. Shared by simulation (gift
// placement) and rendering (props, navigation) so both agree on the world.

export const ISLAND_RADIUS = 9.5;

// Home is a little globe: the Font, nests, basket and shop sit together on top
// (easy to find); the pond, lure spots, trees and rocks spread around the sides
// and underneath (see content/globe.ts for how the map wraps).
export const POND = { x: 3.6, z: 3.4, r: 1.7 };

export const FONT = { x: 0, z: -1.2 }; // the Kindred Font (combining)
export const NESTS = [
  { x: 1.6, z: -2.3 },
  { x: 2.6, z: -1.0 },
  { x: -1.6, z: -2.3 },
  { x: -2.6, z: -1.0 },
];
export const SHOP_STALL = { x: -2.4, z: 1.7 };
export const BASKET = { x: 0, z: -3.2 };

/** Trees all around the globe's sides and underside. They double as storm shelters. */
export const TREES = [
  { x: -6.8, z: -3.0, s: 1.1 },
  { x: 5.4, z: -4.6, s: 1.0 },
  { x: -3.6, z: -6.6, s: 0.9 },
  { x: 2.2, z: -7.6, s: 0.85 },
  { x: 7.4, z: -0.8, s: 0.85 },
  { x: -7.6, z: 1.8, s: 0.85 },
  { x: -5.4, z: 6.0, s: 0.7 },
  { x: 6.2, z: 5.6, s: 0.7 },
  { x: 0.6, z: 8.4, s: 0.8 },
  { x: -1.2, z: -8.8, s: 0.7 },
];

export const ROCKS = [
  { x: -5.0, z: -0.8, s: 0.55 },
  { x: 4.8, z: 1.2, s: 0.5 },
  { x: 1.2, z: 6.2, s: 0.5 },
];

export const OBSTACLES: { x: number; z: number; r: number }[] = [
  { x: FONT.x, z: FONT.z, r: 1.1 },
  { x: SHOP_STALL.x, z: SHOP_STALL.z, r: 1.4 },
  ...TREES.map((t) => ({ x: t.x, z: t.z, r: 0.75 * t.s })),
  ...ROCKS.map((r) => ({ x: r.x, z: r.z, r: 0.7 * r.s })),
];

export function inPond(x: number, z: number, margin = 0): boolean {
  return Math.hypot(x - POND.x, z - POND.z) < POND.r + margin;
}

export function onIsland(x: number, z: number, margin = 0.8): boolean {
  return Math.hypot(x, z) < ISLAND_RADIUS - margin;
}

export function blocked(x: number, z: number, pad = 0.3): boolean {
  return OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad);
}

/** A walkable point for land creatures. `rand` returns [0,1). */
export function randomLandPoint(rand: () => number): { x: number; z: number } {
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (ISLAND_RADIUS - 1.2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!inPond(x, z, 0.4) && !blocked(x, z)) return { x, z };
  }
  return { x: 0, z: 1 };
}

export function randomPondPoint(rand: () => number): { x: number; z: number } {
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * (POND.r - 0.6);
  return { x: POND.x + Math.cos(a) * r, z: POND.z + Math.sin(a) * r };
}
