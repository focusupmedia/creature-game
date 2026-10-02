// Physical layout of the starting sanctuary. Shared by simulation (gift
// placement) and rendering (props, navigation) so both agree on the world.

export const ISLAND_RADIUS = 9.5;

export const POND = { x: 4.4, z: -0.6, r: 2.3 };

export const FONT = { x: -0.6, z: -3.6 }; // the Kindred Font (combining)
export const NESTS = [
  { x: 1.4, z: -4.4 },
  { x: 2.7, z: -3.5 },
  { x: -2.6, z: -4.6 },
  { x: -3.7, z: -3.4 },
];
export const SHOP_STALL = { x: -5.8, z: -1.0 };
export const BASKET = { x: 0.6, z: -5.8 };

/** Big trees ring the back and sides so the camera (looking from +z) sees an open meadow. They double as storm shelters. */
export const TREES = [
  { x: -7.2, z: -4.0, s: 1.15 },
  { x: 5.8, z: -5.4, s: 1.05 },
  { x: -4.6, z: -7.0, s: 0.9 },
  { x: 3.0, z: -7.9, s: 0.85 },
  { x: 7.9, z: -2.2, s: 0.8 },
  { x: -8.2, z: 0.6, s: 0.85 },
  { x: -6.9, z: 4.4, s: 0.6 },
  { x: 7.6, z: 3.6, s: 0.6 },
];

/** Kept to the rim so the meadow stays clear for creatures. */
export const ROCKS = [
  { x: -4.6, z: 7.6, s: 0.55 },
  { x: 8.3, z: 1.0, s: 0.5 },
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
