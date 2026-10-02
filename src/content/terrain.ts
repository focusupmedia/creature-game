// Island terrain: each island top is a gentle dome, like the top of a little
// globe. Ponds, lava pools, lure spots and buildings sit on small level
// terraces so water stays flat and structures stand straight. Everything that
// stands on the ground (scenery, creatures, eggs, pins) asks groundY().

import { BASKET, FONT, NESTS, SHOP_STALL } from './layout';
import { ISLAND_ORDER, islandGeo, type Circle, type Geo } from './islands';
import { SPOTS } from './world';
import type { IslandId } from '../core/types';

/** Dome height as a fraction of the island radius. */
export const DOME = 0.2;

interface Flat { x: number; z: number; r: number; blend: number; level: number }
interface Terrain { S: number; H: number; flats: Flat[] }

const cache = new WeakMap<Geo, Terrain>();

/** Structures that need level ground, in island-local coordinates. */
const STRUCTURES: Partial<Record<IslandId, Circle[]>> = {
  home: [
    { x: FONT.x, z: FONT.z, r: 1.6 },
    { x: SHOP_STALL.x, z: SHOP_STALL.z, r: 1.9 },
    { x: BASKET.x, z: BASKET.z, r: 0.7 },
    ...NESTS.map((n) => ({ x: n.x, z: n.z, r: 0.7 })),
  ],
  volcano: [{ x: 0, z: -3.6, r: 3.4 }],
};

function dome(t: Pick<Terrain, 'S' | 'H'>, d: number): number {
  return Math.sqrt(Math.max(0, t.S * t.S - d * d)) - (t.S - t.H);
}

function terrain(g: Geo): Terrain {
  let t = cache.get(g);
  if (t) return t;
  const H = g.r * DOME;
  // A sphere through the rim (height 0) and the crown (height H).
  const S = (g.r * g.r + H * H) / (2 * H);
  const base = { S, H };
  const at = (x: number, z: number) => dome(base, Math.hypot(x - g.ox, z - g.oz));
  const flats: Flat[] = [];
  for (const c of [...g.water, ...g.lava]) flats.push({ x: c.x, z: c.z, r: c.r + 0.3, blend: 1.6, level: at(c.x, c.z) });
  for (const c of STRUCTURES[g.id] ?? []) {
    const x = c.x + g.ox;
    const z = c.z + g.oz;
    flats.push({ x, z, r: c.r, blend: 1.4, level: at(x, z) });
  }
  for (const s of Object.values(SPOTS)) {
    if (s.island === g.id && !s.water) flats.push({ x: s.x, z: s.z, r: 1.2, blend: 1.2, level: at(s.x, s.z) });
  }
  t = { S, H, flats };
  cache.set(g, t);
  return t;
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Height of the island's ground at a world point (0 at the rim and beyond). */
export function groundY(g: Geo, x: number, z: number): number {
  const t = terrain(g);
  const d = Math.hypot(x - g.ox, z - g.oz);
  if (d >= g.r) return 0;
  let h = dome(t, d);
  for (const f of t.flats) {
    const w = 1 - smooth(f.r, f.r + f.blend, Math.hypot(x - f.x, z - f.z));
    if (w > 0) h += (f.level - h) * w;
  }
  return h;
}

/** Surface normal of the ground (for tilting things that stand on it). */
export function groundNormal(g: Geo, x: number, z: number): { x: number; y: number; z: number } {
  const e = 0.15;
  const dx = groundY(g, x + e, z) - groundY(g, x - e, z);
  const dz = groundY(g, x, z + e) - groundY(g, x, z - e);
  const nx = -dx;
  const ny = 2 * e;
  const nz = -dz;
  const len = Math.hypot(nx, ny, nz);
  return { x: nx / len, y: ny / len, z: nz / len };
}

/** Ground height at any world point, whichever island it is on. */
export function groundAt(x: number, z: number, sizes: Partial<Record<IslandId, number>>): number {
  for (const id of ISLAND_ORDER) {
    const g = islandGeo(id, sizes[id] ?? 0);
    if (Math.hypot(x - g.ox, z - g.oz) < g.r) return groundY(g, x, z);
  }
  return 0;
}
