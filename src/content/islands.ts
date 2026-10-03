// The archipelago. Each island is its own sanctuary with its own habitat, lure
// spots and native creatures. All coordinates in the game are world coordinates:
// an island's local layout is offset by (ox, oz).

import type { IslandId, SpeciesId, Trait } from '../core/types';
import { FONT, NESTS, POND, ROCKS, SHOP_STALL, TREES, BASKET } from './layout';

export interface Circle { x: number; z: number; r: number }

export interface IslandDef {
  id: IslandId;
  name: string;
  icon: string;
  blurb: string;
  habitat: Trait;
  ox: number;
  oz: number;
  baseRadius: number;
  /** 'soon' islands are visible on the horizon but not purchasable yet. */
  status: 'home' | 'buyable' | 'soon';
  /** Unlock: reach the keeper level first, then pay coins. */
  price: { coins: number; level: number };
  /** Extra creature room on top of the size's base (later worlds hold more). */
  capacityBonus: number;
  palette: { top: string; patch: string; lip: string; under: string; rock: string; grass: string };
  /** Local coordinates (relative to the island centre). */
  water: Circle[];
  lava?: Circle[];
  obstacles: Circle[];
  /** Places creatures run to in bad weather. */
  shelters: { x: number; z: number; s: number }[];
  /** A pair you get when you unlock the island, to breed from. */
  starters?: SpeciesId[];
  /** Where the sell booth stands (local coordinates). */
  booth: { x: number; z: number };
  /** Where the world's first nest goes (local coordinates; it can be moved later). */
  nest: { x: number; z: number };
}

export const SIZE_NAMES = ['Small', 'Medium', 'Large'];
export const SIZE_SCALE = [1, 1.25, 1.5];
/** Room for creatures by size (plus each world's bonus): smaller numbers keep worlds uncluttered. */
export const SIZE_CAPACITY = [10, 14, 18];
/** Price to reach size index 1 and 2. */
export const SIZE_PRICE = [{ coins: 0, gems: 0 }, { coins: 2500, gems: 150 }, { coins: 7000, gems: 400 }];

export const ISLANDS: Record<IslandId, IslandDef> = {
  home: {
    id: 'home', name: 'Kindred Grove', icon: '🌳', habitat: 'Grove', status: 'home',
    blurb: 'Your first sanctuary: a mossy forest with a quiet pond.',
    ox: 0, oz: 0, baseRadius: 9.5, price: { coins: 0, level: 1 }, capacityBonus: 0,
    palette: { top: '#7fd94f', patch: '#6cc840', lip: '#c27a3e', under: '#a4603a', rock: '#8a7f86', grass: '#4fa83a' },
    water: [POND],
    obstacles: [
      { x: FONT.x, z: FONT.z, r: 1.1 },
      { x: SHOP_STALL.x, z: SHOP_STALL.z, r: 1.4 },
      { x: BASKET.x, z: BASKET.z, r: 0.5 },
      ...TREES.map((t) => ({ x: t.x, z: t.z, r: 0.75 * t.s })),
      ...ROCKS.map((r) => ({ x: r.x, z: r.z, r: 0.7 * r.s })),
    ],
    shelters: TREES,
    booth: { x: -4.9, z: 3.0 },
    nest: NESTS[0],
  },
  volcano: {
    id: 'volcano', name: 'Ember Peak', icon: '🌋', habitat: 'Ember', status: 'buyable',
    blurb: 'Warm black sand, glowing lava pools and a sleepy volcano. Fire-loving creatures nest here.',
    ox: -48, oz: -34, baseRadius: 9, price: { coins: 1500, level: 4 }, capacityBonus: 1,
    palette: { top: '#6e5a52', patch: '#5d4a44', lip: '#3a2e2e', under: '#4a3434', rock: '#2f2a35', grass: '#c9a24a' },
    water: [],
    lava: [{ x: 3.2, z: 2.2, r: 1.3 }, { x: -3.6, z: 3.4, r: 0.9 }],
    obstacles: [
      { x: 0, z: -3.6, r: 3.2 },
      { x: 3.2, z: 2.2, r: 1.5 },
      { x: -3.6, z: 3.4, r: 1.1 },
      { x: -5.6, z: -1.5, r: 0.8 },
      { x: 6.2, z: -1.8, r: 0.7 },
    ],
    shelters: [{ x: -5.6, z: -1.5, s: 1 }, { x: 6.2, z: -1.8, s: 1 }],
    booth: { x: -1.4, z: 3.6 },
    nest: { x: 3.6, z: 4.8 },
  },
  lagoon: {
    id: 'lagoon', name: 'Coral Lagoon', icon: '🪸', habitat: 'Reef', status: 'buyable',
    blurb: 'A ring of soft sand around a glittering lagoon, full of coral. Water creatures love it here.',
    ox: 48, oz: -34, baseRadius: 9, price: { coins: 4000, level: 8 }, capacityBonus: 2,
    palette: { top: '#ffe2a0', patch: '#ffd88a', lip: '#e8b46a', under: '#c88e58', rock: '#ff8fa8', grass: '#5fc23f' },
    water: [{ x: 0, z: 0.4, r: 5.2 }],
    obstacles: [{ x: -6.6, z: -3, r: 0.6 }, { x: 6.8, z: -2.4, r: 0.6 }, { x: 0.5, z: -7.2, r: 0.6 }],
    shelters: [{ x: -6.6, z: -3, s: 0.9 }, { x: 6.8, z: -2.4, s: 0.9 }, { x: 0.5, z: -7.2, s: 0.9 }],
    booth: { x: -4.1, z: 5.2 },
    nest: { x: 4.8, z: 3.8 },
  },
  beach: {
    id: 'beach', name: 'Sunny Shore', icon: '🏖️', habitat: 'Shore', status: 'buyable',
    blurb: 'Golden sand, warm tide pools and a lazy sea breeze. Shore birds wade here.',
    ox: -56, oz: 22, baseRadius: 8.5, price: { coins: 9000, level: 14 }, capacityBonus: 3,
    palette: { top: '#ffe6a8', patch: '#ffdc90', lip: '#e8b46a', under: '#c88e58', rock: '#d0b090', grass: '#6fc23f' },
    water: [{ x: -2.4, z: 1.8, r: 1.6 }, { x: 3.0, z: -2.2, r: 1.1 }],
    obstacles: [{ x: 4.6, z: 2.8, r: 0.7 }, { x: -4.8, z: -2.6, r: 0.6 }, { x: -1.5, z: -5.2, r: 0.5 }, { x: 5.2, z: -3.6, r: 0.5 }],
    shelters: [{ x: -1.5, z: -5.2, s: 1 }, { x: 5.2, z: -3.6, s: 0.9 }],
    booth: { x: -2.6, z: 4.6 },
    nest: { x: 3.6, z: 4.8 },
    starters: ['flamingle', 'pouchbill'],
  },
  desert: {
    id: 'desert', name: 'Dune Hollow', icon: '🏜️', habitat: 'Sand', status: 'buyable',
    blurb: 'Windswept dunes, a cool little oasis and tracks you can\'t quite explain.',
    ox: 56, oz: 22, baseRadius: 8.5, price: { coins: 16000, level: 20 }, capacityBonus: 4,
    palette: { top: '#f2c46a', patch: '#e8b45a', lip: '#d08a40', under: '#b06a34', rock: '#c09060', grass: '#9fbf3f' },
    water: [{ x: -1.6, z: -1.8, r: 1.7 }],
    obstacles: [{ x: 3.6, z: -3.2, r: 0.5 }, { x: 4.8, z: 1.6, r: 0.5 }, { x: -4.6, z: 2.4, r: 0.5 }, { x: 1.6, z: 4.4, r: 0.9 }, { x: -3.8, z: -3.4, r: 0.5 }],
    shelters: [{ x: 1.6, z: 4.4, s: 1 }, { x: -3.8, z: -3.4, s: 1 }],
    booth: { x: -3.2, z: 3.6 },
    nest: { x: 3.6, z: 3.8 },
    starters: ['sandpincer', 'dunecoil'],
  },
  cloud: {
    id: 'cloud', name: 'Cloud Isle', icon: '☁️', habitat: 'Sky', status: 'buyable',
    blurb: 'A soft island floating above the sea, joined to the others by rainbow bridges. Birds and sky spirits drift here on the breeze.',
    ox: 0, oz: -78, baseRadius: 8.5, price: { coins: 25000, level: 26 }, capacityBonus: 5,
    palette: { top: '#a8d0ff', patch: '#f4f8ff', lip: '#8ab0e8', under: '#7a98d8', rock: '#c9b8ff', grass: '#c8f0ff' },
    water: [{ x: 2.2, z: 2.0, r: 1.5 }],
    obstacles: [{ x: -3.4, z: -3.0, r: 0.7 }, { x: 4.2, z: -2.6, r: 0.7 }, { x: -4.4, z: 2.6, r: 0.6 }, { x: 0.4, z: -5.4, r: 0.9 }],
    shelters: [{ x: -3.4, z: -3.0, s: 1 }, { x: 4.2, z: -2.6, s: 1 }, { x: -4.4, z: 2.6, s: 0.9 }],
    booth: { x: -2.6, z: 3.6 },
    nest: { x: 3.6, z: 3.8 },
    starters: ['kitewing', 'cloudlamb'],
  },
};

export const ISLAND_ORDER: IslandId[] = ['home', 'volcano', 'lagoon', 'beach', 'desert', 'cloud'];

/** World-space geometry of an island at a given size. */
export interface Geo {
  id: IslandId;
  ox: number;
  oz: number;
  r: number;
  water: Circle[];
  lava: Circle[];
  obstacles: Circle[];
  shelters: { x: number; z: number; s: number }[];
}

const geoCache = new Map<string, Geo>();

export function islandGeo(id: IslandId, size = 0): Geo {
  const key = `${id}:${size}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const d = ISLANDS[id];
  const w = (c: Circle) => ({ x: c.x + d.ox, z: c.z + d.oz, r: c.r });
  const g: Geo = {
    id, ox: d.ox, oz: d.oz, r: d.baseRadius * (SIZE_SCALE[size] ?? 1),
    water: d.water.map(w), lava: (d.lava ?? []).map(w), obstacles: [...d.obstacles, { ...d.booth, r: 1.1 }].map(w),
    shelters: d.shelters.map((s) => ({ x: s.x + d.ox, z: s.z + d.oz, s: s.s })),
  };
  geoCache.set(key, g);
  return g;
}

/** Islands are globes, so almost everywhere is land: only a small cap at the bottom pole is out of bounds. */
export function onLand(g: Geo, x: number, z: number, margin = 0.8): boolean {
  return Math.hypot(x - g.ox, z - g.oz) < g.r * 0.975 - margin * 0.1;
}

export function inWater(g: Geo, x: number, z: number, margin = 0): boolean {
  return g.water.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + margin);
}

export function isBlocked(g: Geo, x: number, z: number, pad = 0.3): boolean {
  return g.obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad)
    || g.lava.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad);
}

export function randomLand(g: Geo, rand: () => number): { x: number; z: number } {
  for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI * 2;
    // area-uniform on the map is area-uniform on the globe: all the way round
    const r = Math.sqrt(rand()) * g.r * 0.95;
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    if (!inWater(g, x, z, 0.4) && !isBlocked(g, x, z)) return { x, z };
  }
  // Mostly-water islands: walk the underside.
  const a = rand() * Math.PI * 2;
  return { x: g.ox + Math.cos(a) * g.r * 0.9, z: g.oz + Math.sin(a) * g.r * 0.9 };
}

export function randomWater(g: Geo, rand: () => number): { x: number; z: number } {
  const c = g.water[Math.floor(rand() * g.water.length)] ?? { x: g.ox, z: g.oz, r: 1 };
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * Math.max(0.3, c.r - 0.6);
  return { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r };
}

/** Which island (if any) a world point is on. */
export function islandAt(x: number, z: number, sizes: Partial<Record<IslandId, number>>): IslandId | null {
  for (const id of ISLAND_ORDER) {
    const g = islandGeo(id, sizes[id] ?? 0);
    if (Math.hypot(x - g.ox, z - g.oz) < g.r + 1) return id;
  }
  return null;
}
