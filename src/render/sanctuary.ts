import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BASKET, FONT, NESTS, POND, ROCKS, SHOP_STALL, TREES } from '../content/layout';
import { ISLANDS, inWater, isBlocked, islandGeo, type Geo } from '../content/islands';
import { globeCenter, globeNormal, globePoint, globeRadius } from '../content/globe';
import { SPOTS } from '../content/world';
import { mulberry32 } from '../core/rng';
import type { IslandId } from '../core/types';
import { addOutlines, glowSprite, glowTexture, toon, uniqueToon, vertexToon } from './materials';
import { buildShopkeeper } from './creatureModels';

// Island dioramas. Everything static is merged into one vertex-colored mesh per
// island (one draw call, plus one for its outline); animated or tappable bits stay separate.

const UP = new THREE.Vector3(0, 1, 0);

/** Matrix that stands something on the globe: moved to the surface and turned to its normal. */
function standMatrix(terrain: Geo, x: number, z: number): THREE.Matrix4 {
  const n = globeNormal(terrain, x, z);
  const p = globePoint(terrain, x, z);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(n.x, n.y, n.z));
  return new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1));
}

/** Lift and tilt an object placed at ground level (its position's y is its height above the ground). */
function standOn(o: THREE.Object3D, terrain: Geo): void {
  const local = new THREE.Matrix4().compose(new THREE.Vector3(0, o.position.y, 0), o.quaternion, o.scale);
  standMatrix(terrain, o.position.x, o.position.z).multiply(local).decompose(o.position, o.quaternion, o.scale);
}

/**
 * 'stand' (default) moves a part onto the globe, upright to its surface;
 * 'drape' bends a part over the globe vertex by vertex (wide flat things, the volcano);
 * 'fixed' keeps raw coordinates.
 */
type Fit = 'stand' | 'drape' | 'fixed';

class Merger {
  private parts: THREE.BufferGeometry[] = [];
  /** The island whose globe parts stand on; null keeps everything flat. */
  terrain: Geo | null = null;
  /** While set, standing parts are placed as one rigid piece around this point (buildings). */
  anchor: { x: number; z: number } | null = null;

  /** Build a multi-part structure that stands on the globe as one piece. */
  piece(x: number, z: number, build: () => void): void {
    this.anchor = { x, z };
    build();
    this.anchor = null;
  }

  add(geo: THREE.BufferGeometry, color: string, pos: THREE.Vector3Like, rot: THREE.Vector3Like = { x: 0, y: 0, z: 0 }, scale: THREE.Vector3Like = { x: 1, y: 1, z: 1 }, fit: Fit = 'stand'): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    const t = this.terrain && fit !== 'fixed' ? this.terrain : null;
    const stand = fit === 'stand' && !!t;
    const at = this.anchor ?? pos;
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(stand ? pos.x - at.x : pos.x, pos.y, stand ? pos.z - at.z : pos.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x, rot.y, rot.z)),
      new THREE.Vector3(scale.x, scale.y, scale.z),
    );
    g.applyMatrix4(stand ? standMatrix(t, at.x, at.z).multiply(local) : local);
    if (fit === 'drape' && t) {
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const w = globePoint(t, p.getX(i), p.getZ(i), p.getY(i));
        p.setXYZ(i, w.x, w.y, w.z);
      }
    }
    const c = new THREE.Color(color);
    const n = g.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
  }

  /** Grass blades: darker at the root, lighter at the tip, for soft shading without outlines. */
  addBlade(geo: THREE.BufferGeometry, root: string, tip: string, pos: THREE.Vector3Like, rot: THREE.Vector3Like): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(this.terrain ? 0 : pos.x, pos.y, this.terrain ? 0 : pos.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x, rot.y, rot.z)), new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(this.terrain ? standMatrix(this.terrain, pos.x, pos.z).multiply(local) : local);
    const a = new THREE.Color(root);
    const b = new THREE.Color(tip);
    const p = g.getAttribute('position');
    const colors = new Float32Array(p.count * 3);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < p.count; i++) {
      minY = Math.min(minY, p.getY(i));
      maxY = Math.max(maxY, p.getY(i));
    }
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      c.copy(a).lerp(b, (p.getY(i) - minY) / Math.max(0.001, maxY - minY));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  build(): THREE.Mesh {
    const merged = mergeGeometries(this.parts, false)!;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, vertexToon());
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }
}

export interface SpotDish { root: THREE.Group; bait: THREE.Mesh; glow: THREE.Sprite; marker: THREE.Mesh }

export interface HomeParts {
  font: THREE.Group;
  fontWater: THREE.Mesh;
  stall: THREE.Group;
  basket: THREE.Group;
}

export interface IslandView {
  id: IslandId;
  key: string;
  group: THREE.Group;
  water: THREE.Mesh[];
  lava: THREE.Mesh[];
  canopies: THREE.Object3D[];
  spotDishes: Record<string, SpotDish>;
  home?: HomeParts;
  /** The sell booth. */
  booth?: THREE.Group;
  fireflies?: THREE.Points;
  pickables: THREE.Object3D[];
  ground: THREE.Mesh;
  /** World geometry the island's dome follows. */
  groundGeo: Geo;
  /** Every tree and palm, in build order (the index is how a chopped one is remembered). */
  trees: { x: number; z: number; s: number; chopped: boolean }[];
  /** Indices of trees the keeper has chopped down. */
  chopped: Set<number>;
}

const mix = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

/** Soft colour patches give the globe's ground some shading and depth. */
function islandPatches(g: Geo, pal: (typeof ISLANDS)['home']['palette'], rand: () => number, soft: Merger): void {
  const R = g.r;
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (R - 0.8);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    const s = 1.2 + rand() * 1.8;
    // keep patches clear of ponds and lava
    if ([...g.water, ...g.lava].some((c) => Math.hypot(x - c.x, z - c.z) < c.r + s * 1.1)) continue;
    soft.add(new THREE.RingGeometry(0.001, s, 40, 6), i % 3 ? pal.patch : mix(pal.top, '#ffffff', 0.12), { x, y: 0.04 + i * 0.0006, z }, { x: -Math.PI / 2, y: 0, z: 0 }, { x: 1, y: 0.75 + rand() * 0.5, z: 1 }, 'drape');
  }
}

/** A wide flat disc laid over the globe (pond rims, lure-spot pads, sand rings). */
function flatDisc(M: Merger, r: number, color: string, x: number, z: number, alt = 0.02): void {
  M.add(new THREE.RingGeometry(0.001, r, 36, Math.max(3, Math.ceil(r * 3))), color, { x, y: alt, z }, { x: -Math.PI / 2, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 'drape');
}

/** The globe itself. Also the tap target for the ground. */
function globeMesh(g: Geo, color: string): THREE.Mesh {
  const c = globeCenter(g);
  const geo = new THREE.SphereGeometry(globeRadius(g), 72, 48);
  // Gentle painted shading: a touch warmer and lighter on top, cooler and deeper
  // round the sides and underneath, with soft blotches so the ground never looks flat.
  const base = new THREE.Color(color);
  const warm = base.clone().lerp(new THREE.Color('#fff2c0'), 0.12);
  const cool = base.clone().lerp(new THREE.Color('#2a4a6a'), 0.18);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const R = globeRadius(g);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / R, y = pos.getY(i) / R, z = pos.getZ(i) / R;
    const up = (y + 1) / 2;
    tmp.copy(cool).lerp(warm, Math.pow(up, 0.8));
    const blotch = Math.sin(x * 5.1 + z * 3.7) * Math.sin(z * 4.3 - y * 2.9) * 0.045;
    tmp.offsetHSL(0, 0, blotch);
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = uniqueToon('#ffffff', { vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(c.x, c.y, c.z);
  // Cast shadows stretch into long streaks across a curved world; creatures
  // carry a soft blob shadow instead.
  mesh.receiveShadow = false;
  return mesh;
}

const PETAL = new THREE.SphereGeometry(0.045, 6, 4);
const FLOWER_MID = new THREE.SphereGeometry(0.035, 6, 4);

/** Round leafy bushes around a green island's rim (their own random numbers, so the rest of the island's layout never moves). */
function scatterBushes(M: Merger, g: Geo, clear: { x: number; z: number; r: number }[], count: number, seed: number): void {
  let st = seed >>> 0;
  const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const greens = ['#4fb83a', '#62c947', '#3fa535'];
  let placed = 0;
  for (let i = 0; i < count * 20 && placed < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = (0.62 + rnd() * 0.3) * (g.r - 0.6);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    if (inWater(g, x, z, 0.8) || isBlocked(g, x, z, 0.8)) continue;
    if (clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.6)) continue;
    placed++;
    const s = 0.28 + rnd() * 0.14;
    for (let j = 0; j < 3; j++) {
      const ox = (j - 1) * s * 0.75, oz = (rnd() - 0.5) * s * 0.6;
      M.add(new THREE.IcosahedronGeometry(s * (j === 1 ? 1.15 : 0.9), 1), greens[(i + j) % 3], { x: x + ox, y: s * 0.7, z: z + oz }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.85, z: 1 });
    }
    // some bushes carry little pink or white blossoms
    if (rnd() < 0.5) for (let j = 0; j < 3; j++) M.add(new THREE.SphereGeometry(0.06, 6, 4), j % 2 ? '#ffd1e3' : '#ffffff', { x: x + (rnd() - 0.5) * s * 1.6, y: s * 1.35, z: z + (rnd() - 0.5) * s * 0.8 });
  }
}

/** Sparse grass and flowers in a darker, shaded green, kept away from anything tappable. No outlines. */
function scatterGrass(G: Merger, g: Geo, pal: (typeof ISLANDS)['home']['palette'], rand: () => number, clear: { x: number; z: number; r: number }[], count: number, flowers = true): void {
  const blade = new THREE.ConeGeometry(0.06, 0.32, 4);
  const flowerColors = ['#ffd1e3', '#fff3a6', '#c9b6ff', '#ffffff'];
  const root = mix(pal.grass, '#0d2a10', 0.45);
  const tip = pal.grass;
  let placed = 0;
  for (let i = 0; i < count * 14 && placed < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = (0.35 + rand() * 0.6) * (g.r - 0.6);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    if (inWater(g, x, z, 0.4) || isBlocked(g, x, z, 0.2)) continue;
    if (clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
    placed++;
    if (flowers && rand() < 0.4) {
      // a little five-petal flower with a sunny middle
      const col = flowerColors[Math.floor(rand() * flowerColors.length)];
      G.add(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 3), root, { x, y: 0.12, z });
      for (let p = 0; p < 5; p++) {
        const a2 = (p / 5) * Math.PI * 2;
        G.add(PETAL, col, { x: x + Math.cos(a2) * 0.055, y: 0.27, z: z + Math.sin(a2) * 0.055 });
      }
      G.add(FLOWER_MID, '#ffd23d', { x, y: 0.285, z });
    } else {
      for (let j = 0; j < 3; j++) {
        G.addBlade(blade, root, tip, { x: x + (j - 1) * 0.07, y: 0.15, z: z + (rand() - 0.5) * 0.08 }, { x: (j - 1) * 0.35, y: 0, z: (rand() - 0.5) * 0.45 });
      }
    }
  }
}

function lureSpots(M: Merger, islandId: IslandId, size: number, pickables: THREE.Object3D[], group: THREE.Group, dishColor: string): Record<string, SpotDish> {
  const out: Record<string, SpotDish> = {};
  // bigger islands open more spots
  for (const spot of Object.values(SPOTS).filter((s) => s.island === islandId && size >= (s.minSize ?? 0))) {
    const root = new THREE.Group();
    root.position.set(spot.x, 0, spot.z);
    if (spot.water) {
      M.add(new THREE.BoxGeometry(1.4, 0.08, 0.9), '#a0764e', { x: spot.x, y: 0.12, z: spot.z });
      for (const [dx, dz] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) {
        M.add(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 5), '#7b5236', { x: spot.x + dx, y: 0.05, z: spot.z + dz });
      }
    } else {
      flatDisc(M, 1.0, '#f4dfa0', spot.x, spot.z, 0.03);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        M.add(new THREE.DodecahedronGeometry(0.15, 0), '#c9c2a8', { x: spot.x + Math.cos(a) * 1.0, y: 0.07, z: spot.z + Math.sin(a) * 1.0 });
      }
    }
    const px = spot.x + (spot.water ? -0.95 : -0.9);
    const pz = spot.z + (spot.water ? 0.55 : -0.6);
    M.add(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 5), '#7b5236', { x: px, y: 0.55, z: pz });
    M.add(new THREE.BoxGeometry(0.62, 0.32, 0.06), '#c8945a', { x: px, y: 1.0, z: pz + 0.03 });
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.14, 12), toon(dishColor));
    dish.position.y = spot.water ? 0.22 : 0.08;
    dish.castShadow = true;
    root.add(dish);
    const bait = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 6), toon('#ffffff'));
    bait.scale.set(1, 0.45, 1);
    bait.position.y = dish.position.y + 0.08;
    bait.visible = false;
    root.add(bait);
    const glow = glowSprite('#ffffff', 2.2, 0);
    glow.position.y = 0.5;
    root.add(glow);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.92, 40),
      new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.8, depthWrite: false }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = spot.water ? 0.17 : 0.05;
    root.add(marker);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.8, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.4;
    hit.userData.pick = { kind: 'spot', id: spot.id };
    root.add(hit);
    pickables.push(hit);
    group.add(root);
    out[spot.id] = { root, bait, glow, marker };
  }
  return out;
}

/** Water (or lava) laid over the globe's curve. Built in world space, so it is already placed. */
function waterDisc(g: Geo, c: { x: number; z: number; r: number }, color: string, emissive: string, y = 0.06): THREE.Mesh {
  const mat = new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.92, emissive, emissiveIntensity: 0.3 });
  const geo = new THREE.RingGeometry(0.001, c.r, 48, Math.max(4, Math.ceil(c.r * 4)));
  geo.rotateX(-Math.PI / 2);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const w = globePoint(g, c.x + p.getX(i), c.z + p.getZ(i), y);
    p.setXYZ(i, w.x, w.y, w.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.userData.placed = true;
  return m;
}

/** Remember a tree; chopped ones leave a stump, standing ones can be tapped. Returns true if it still stands. */
function registerTree(view: IslandView, M: Merger, x: number, z: number, s: number): boolean {
  const index = view.trees.length;
  const chopped = view.chopped.has(index);
  view.trees.push({ x, z, s, chopped });
  if (chopped) {
    M.add(new THREE.CylinderGeometry(0.26 * s, 0.32 * s, 0.28 * s, 8), '#9a5a32', { x, y: 0.14 * s, z });
    M.add(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.02, 8), '#e8c08a', { x, y: 0.29 * s, z });
    return false;
  }
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * s, 0.7 * s, 3 * s, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, 1.5 * s, z);
  standOn(hit, view.groundGeo);
  hit.userData.placed = true;
  hit.userData.pick = { kind: 'tree', island: view.id, index };
  view.group.add(hit);
  view.pickables.push(hit);
  return true;
}

function tree(view: IslandView, M: Merger, t: { x: number; z: number; s: number }, rand: () => number, greens = ['#4fc23a', '#6fdc45', '#3fae35'], trunk = '#9a5a32'): void {
  // roll everything first, so a chopped tree doesn't change how the rest of the island looks
  const blobs = Array.from({ length: 3 }, () => [rand(), rand(), rand(), rand(), rand()]);
  if (!registerTree(view, M, t.x, t.z, t.s)) return;
  M.add(new THREE.CylinderGeometry(0.2 * t.s, 0.32 * t.s, 2.2 * t.s, 7), trunk, { x: t.x, y: 1.1 * t.s, z: t.z });
  const canopy = new THREE.Group();
  canopy.position.set(t.x, 2.2 * t.s, t.z);
  standOn(canopy, view.groundGeo);
  canopy.userData.placed = true;
  blobs.forEach(([px, pz, rx, ry, rz], i) => {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry((1.2 - i * 0.18) * t.s, 1), toon(greens[i]));
    blob.position.set((px - 0.5) * 0.6 * t.s, i * 0.65 * t.s, (pz - 0.5) * 0.6 * t.s);
    blob.rotation.set(rx, ry, rz);
    blob.castShadow = true;
    canopy.add(blob);
  });
  view.group.add(canopy);
  view.canopies.push(canopy);
}

function palm(view: IslandView, M: Merger, x: number, z: number, s: number, rand: () => number): void {
  const lean = (rand() - 0.5) * 0.4;
  if (!registerTree(view, M, x, z, s)) return;
  M.piece(x, z, () => {
    for (let i = 0; i < 5; i++) {
      M.add(new THREE.CylinderGeometry(0.13 * s, 0.16 * s, 0.5 * s, 7), i % 2 ? '#b07a44' : '#9a6638', { x: x + lean * i * 0.25, y: 0.25 * s + i * 0.48 * s, z });
    }
  });
  const crown = new THREE.Group();
  crown.position.set(x, 2.5 * s, z);
  standOn(crown, view.groundGeo);
  crown.translateX(lean * 1.2);
  crown.userData.placed = true;
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s, 8, 4), toon(i % 2 ? '#3fbf4a' : '#5fd45a'));
    leaf.scale.set(1.5, 0.12, 0.45);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.6 * s, -0.1 * s, Math.sin(a) * 0.6 * s);
    leaf.rotation.set(0, -a, -0.35);
    crown.add(leaf);
  }
  crown.add(new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 6, 4), toon('#7a5a2a')));
  view.group.add(crown);
  view.canopies.push(crown);
}

/** Build an island. Locked or upcoming islands are drawn as simple misty silhouettes. */
export function buildIsland(id: IslandId, size: number, owned: boolean, chopped: number[] = [], sizes: Partial<Record<IslandId, number>> = {}): IslandView {
  const def = ISLANDS[id];
  // build from the full layout: chopped trees are filtered out of the live geo, but
  // the scenery (and every tree's index) must stay where it always was
  const live = islandGeo(id, size) as Geo & { base?: { shelters: Geo['shelters']; obstacles: Geo['obstacles'] } };
  const g: Geo = live.base ? { ...live, shelters: live.base.shelters, obstacles: live.base.obstacles } : live;
  const group = new THREE.Group();
  const rand = mulberry32(1234 + id.length * 97);
  const M = new Merger();
  const G = new Merger();
  const view: IslandView = {
    id, key: `${owned}:${size}:${chopped.join(',')}`, group, water: [], lava: [], canopies: [], spotDishes: {}, pickables: [], groundGeo: g,
    trees: [], chopped: new Set(chopped),
    ground: globeMesh(g, owned ? def.palette.top : mix(def.palette.top, '#c8dcf0', def.status === 'soon' ? 0.6 : 0.4)),
  };
  view.ground.userData.pick = { kind: 'ground', island: id };
  group.add(view.ground);
  M.terrain = g;
  G.terrain = g;

  if (!owned) {
    // A hazy silhouette: you can see it's there, and what kind of place it is.
    const fog = '#c8dcf0';
    const pal = { ...def.palette };
    for (const k of Object.keys(pal) as (keyof typeof pal)[]) pal[k] = mix(pal[k], fog, def.status === 'soon' ? 0.6 : 0.4);
    islandPatches(g, pal, rand, M);
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const r = g.r * (0.3 + rand() * 0.45);
      M.add(new THREE.IcosahedronGeometry(1 + rand() * 0.6, 0), mix(id === 'volcano' ? '#5a4a4a' : id === 'cloud' ? '#ffffff' : '#5fc23f', fog, 0.5), { x: g.ox + Math.cos(a) * r, y: 1.1, z: g.oz + Math.sin(a) * r });
    }
    if (id === 'volcano') M.add(new THREE.ConeGeometry(3.4, 4.2, 12, 1, true), mix('#4a3434', fog, 0.4), { x: g.ox, y: 0.9, z: g.oz - 3.6 });
    group.add(M.build());
    return view;
  }

  islandPatches(g, def.palette, rand, G);
  const clear: { x: number; z: number; r: number }[] = Object.values(SPOTS).filter((s) => s.island === id).map((s) => ({ x: s.x, z: s.z, r: 1.9 }));

  if (id === 'home') buildHome(view, M, g, rand, clear);
  if (id === 'volcano') buildVolcano(view, M, g, rand);
  if (id === 'lagoon') buildLagoon(view, M, g, rand);
  if (id === 'beach') buildBeach(view, M, g, rand);
  if (id === 'desert') buildDesert(view, M, g, rand);
  if (id === 'cloud') buildCloud(view, M, g, rand, sizes);

  view.spotDishes = lureSpots(M, id, size, view.pickables, group, id === 'volcano' ? '#4a3a3a' : '#8d8f86');
  view.booth = sellBooth(view, g, def.booth);

  scatterGrass(G, g, def.palette, rand, clear, id === 'home' ? 110 : id === 'lagoon' ? 40 : 26, id !== 'volcano');
  if (id === 'home' || id === 'lagoon') scatterBushes(M, g, [...clear, ...(id === 'home' ? [...TREES.map((t) => ({ x: t.x, z: t.z, r: 1.6 })), ...ROCKS.map((r) => ({ x: r.x, z: r.z, r: 1.2 })), { x: POND.x, z: POND.z, r: POND.r + 1 }] : [])], id === 'home' ? 14 : 6, id === 'home' ? 7 : 13);
  // Stand every separately-built piece (water, nests, font, shop, lure dishes...) on the dome.
  for (const o of group.children) if (o !== view.ground && !o.userData.placed) standOn(o, g);
  const scenery = M.build();
  group.add(scenery);
  addOutlines(scenery, 2.6);
  if (!G.empty) group.add(G.build());
  for (const c of view.canopies) addOutlines(c, 3);
  addOutlines(view.booth, 2.6);
  if (view.home) {
    addOutlines(view.home.stall, 3);
    addOutlines(view.home.font, 2.6);
  }

  // fireflies (visible at night)
  const n = Math.round(30 + g.r * 3);
  const fp = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (g.r - 1);
    const fx = g.ox + Math.cos(a) * r;
    const fz = g.oz + Math.sin(a) * r;
    const w = globePoint(g, fx, fz, 0.4 + rand() * 1.8);
    fp.set([w.x, w.y, w.z], i * 3);
  }
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  fgeo.userData.base = fp.slice();
  view.fireflies = new THREE.Points(fgeo, new THREE.PointsMaterial({
    color: id === 'volcano' ? '#ffb46a' : '#e8ff8a', size: 0.35, map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  group.add(view.fireflies);
  return view;
}

// ---------------------------------------------------------------- Kindred Grove (home)

function buildHome(view: IslandView, M: Merger, g: Geo, rand: () => number, clear: { x: number; z: number; r: number }[]): void {
  const { group, pickables } = view;
  clear.push(
    { x: FONT.x, z: FONT.z, r: 2.3 }, { x: SHOP_STALL.x, z: SHOP_STALL.z, r: 2.4 }, { x: BASKET.x, z: BASKET.z, r: 1 },
    ...NESTS.map((n) => ({ x: n.x, z: n.z, r: 1.1 })),
  );

  // pond
  flatDisc(M, POND.r + 0.15, '#5f8e4a', POND.x, POND.z, 0.03);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.2;
    M.add(new THREE.DodecahedronGeometry(0.22 + rand() * 0.12, 1), i % 3 ? '#a3a59c' : '#8b8e86',
      { x: POND.x + Math.cos(a) * (POND.r + 0.1), y: 0.05, z: POND.z + Math.sin(a) * (POND.r + 0.1) }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.6, z: 1 });
  }
  const water = waterDisc(g, POND, '#36c6ff', '#1a8fd0');
  group.add(water);
  view.water.push(water);
  for (const [dx, dz] of [[-0.8, 0.6], [0.6, -0.9], [0.9, 0.7]]) {
    M.add(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 10), '#5fbf5a', { x: POND.x + dx, y: 0.08, z: POND.z + dz });
  }
  M.add(new THREE.SphereGeometry(0.08, 6, 4), '#ffd1e3', { x: POND.x + 0.62, y: 0.12, z: POND.z - 0.88 });
  for (let i = 0; i < 7; i++) {
    const a = 2.2 + i * 0.18;
    M.add(new THREE.CylinderGeometry(0.03, 0.04, 0.9 + rand() * 0.4, 5), '#4f8a33',
      { x: POND.x + Math.cos(a) * (POND.r - 0.1), y: 0.45, z: POND.z + Math.sin(a) * (POND.r - 0.1) }, { x: rand() * 0.2, y: 0, z: rand() * 0.2 - 0.1 });
  }

  // stepping-stone path toward the font and nests
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = 0.8 * (1 - t) + FONT.x * t + Math.sin(i) * 0.3;
    const z = 3.4 * (1 - t) + (FONT.z + 1.4) * t;
    M.add(new THREE.CylinderGeometry(0.32, 0.36, 0.06, 8), '#f4dfa0', { x, y: 0.07, z }, { x: 0, y: rand(), z: 0 });
  }

  // a soft winding dirt path under the stepping stones, with a branch to the shop door
  const dirt = '#e6cf9a';
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const x = 0.8 * (1 - t) + FONT.x * t + Math.sin(t * Math.PI * 2) * 0.35;
    const z = 3.4 * (1 - t) + (FONT.z + 1.4) * t;
    flatDisc(M, 0.52, dirt, x, z, 0.058);
  }
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    flatDisc(M, 0.42, dirt, SHOP_STALL.x + 0.2 + t * 2.4, SHOP_STALL.z + 1.3 + Math.sin(t * Math.PI) * 0.4, 0.057);
  }
  // little wooden fences: beside the shop, and round the far side of the pond
  const fence = (pts: { x: number; z: number }[]) => {
    pts.forEach((p, i) => {
      M.add(new THREE.CylinderGeometry(0.06, 0.07, 0.62, 6), '#b07a46', { x: p.x, y: 0.31, z: p.z });
      M.add(new THREE.SphereGeometry(0.075, 6, 4), '#c8945a', { x: p.x, y: 0.64, z: p.z });
      const q = pts[i + 1];
      if (!q) return;
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      const yaw = Math.atan2(q.x - p.x, q.z - p.z);
      for (const h of [0.22, 0.46]) M.add(new THREE.BoxGeometry(0.06, 0.07, len), '#c8945a', { x: (p.x + q.x) / 2, y: h, z: (p.z + q.z) / 2 }, { x: 0, y: yaw, z: 0 });
    });
  };
  fence([0, 1, 2, 3, 4].map((i) => ({ x: SHOP_STALL.x - 1.7, z: SHOP_STALL.z - 1.0 + i * 0.6 })));
  fence([0, 1, 2, 3, 4].map((i) => { const a = -0.55 + i * 0.32; return { x: POND.x + Math.cos(a) * (POND.r + 1.1), z: POND.z + Math.sin(a) * (POND.r + 1.1) }; }));
  // red-and-white toadstools at the foot of some trees
  const shroom = (x: number, z: number, sc: number) => {
    M.add(new THREE.CylinderGeometry(0.07 * sc, 0.09 * sc, 0.22 * sc, 7), '#fff4e0', { x, y: 0.11 * sc, z });
    M.add(new THREE.SphereGeometry(0.17 * sc, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e2483e', { x, y: 0.2 * sc, z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.75, z: 1 });
    for (const [dx, dz] of [[0.07, 0.03], [-0.06, 0.06], [0, -0.08]]) M.add(new THREE.SphereGeometry(0.03 * sc, 6, 4), '#ffffff', { x: x + dx * sc, y: 0.3 * sc, z: z + dz * sc });
  };
  for (const [i, t] of TREES.slice(0, 7).entries()) {
    const a = i * 2.1;
    shroom(t.x + Math.cos(a) * 1.05, t.z + Math.sin(a) * 1.05, 1);
    shroom(t.x + Math.cos(a + 0.45) * 1.25, t.z + Math.sin(a + 0.45) * 1.25, 0.7);
  }

  for (const t of TREES) tree(view, M, t, rand);
  // larger islands get a few extra trees around the new rim
  if (g.r > 10) {
    // each extra tree keeps its own spot as the island grows (golden-angle spacing),
    // so a chopped one stays chopped in the same place after an upgrade
    for (let i = 0; i < Math.round((g.r - 9.5) * 2.5); i++) {
      const a = -Math.PI * 0.95 + ((i * 0.618034) % 1) * Math.PI * 1.9 + rand() * 0.2;
      tree(view, M, { x: Math.cos(a) * (g.r - 1.4), z: Math.sin(a) * (g.r - 1.4) - 0.5, s: 0.7 + rand() * 0.3 }, rand);
    }
  }
  for (const r of ROCKS) {
    M.add(new THREE.DodecahedronGeometry(r.s, 1), '#9ea3a0', { x: r.x, y: r.s * 0.35, z: r.z }, { x: rand(), y: rand(), z: rand() }, { x: 1, y: 0.7, z: 1 });
    M.add(new THREE.SphereGeometry(r.s * 0.55, 6, 4), '#6fae55', { x: r.x + 0.1, y: r.s * 0.75, z: r.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.35, z: 1 });
  }

  // the Kindred Fountain (combining): stands as one piece
  M.anchor = { x: FONT.x, z: FONT.z };
  const font = new THREE.Group();
  font.position.set(FONT.x, 0, FONT.z);
  M.add(new THREE.CylinderGeometry(1.15, 1.25, 0.12, 10), '#e8dcc0', { x: FONT.x, y: 0.06, z: FONT.z });
  M.add(new THREE.CylinderGeometry(0.3, 0.42, 0.6, 8), '#b4ad95', { x: FONT.x, y: 0.42, z: FONT.z });
  M.add(new THREE.CylinderGeometry(0.75, 0.5, 0.35, 10), '#efe4c8', { x: FONT.x, y: 0.85, z: FONT.z });
  for (const s of [1, -1]) {
    M.add(new THREE.BoxGeometry(0.35, 1.7, 0.3), '#a8a28b', { x: FONT.x + 1.0 * s, y: 0.85, z: FONT.z - 0.2 }, { x: 0, y: 0, z: -0.08 * s });
    M.add(new THREE.SphereGeometry(0.25, 6, 4), '#6fae55', { x: FONT.x + 1.0 * s, y: 1.7, z: FONT.z - 0.2 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.4, z: 1 });
    const rune = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 4, 10), toon('#bff4ff', '#7fe0ff', 1));
    rune.position.set(1.0 * s, 1.0, -0.04);
    font.add(rune);
  }
  const fontWater = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshToonMaterial({ color: '#9ff0ff', emissive: '#4fd6ff', emissiveIntensity: 0.6 }));
  fontWater.rotation.x = -Math.PI / 2;
  fontWater.position.y = 1.03;
  font.add(fontWater);
  const fontGlow = glowSprite('#8fe8ff', 2.4, 0.35);
  fontGlow.position.y = 1.3;
  font.add(fontGlow);
  const fontHit = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2, 8), new THREE.MeshBasicMaterial({ visible: false }));
  fontHit.position.y = 1;
  fontHit.userData.pick = { kind: 'font' };
  font.add(fontHit);
  pickables.push(fontHit);
  group.add(font);

  M.anchor = null;

  // egg basket
  const basket = new THREE.Group();
  basket.position.set(BASKET.x, 0, BASKET.z);
  const weave = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.38, 0.35, 10, 1, true), toon('#b98a4a'));
  weave.position.y = 0.18;
  (weave.material as THREE.Material).side = THREE.DoubleSide;
  basket.add(weave);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 4, 16, Math.PI), toon('#9a6f35'));
  handle.position.y = 0.3;
  basket.add(handle);
  const bHit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1, 8), new THREE.MeshBasicMaterial({ visible: false }));
  bHit.position.y = 0.5;
  bHit.userData.pick = { kind: 'basket' };
  basket.add(bHit);
  pickables.push(bHit);
  group.add(basket);

  // the shop cottage: stands as one piece
  M.anchor = { x: SHOP_STALL.x, z: SHOP_STALL.z };
  const stall = new THREE.Group();
  stall.position.set(SHOP_STALL.x, 0, SHOP_STALL.z);
  const SX = SHOP_STALL.x;
  const SZ = SHOP_STALL.z;
  M.add(new THREE.BoxGeometry(2.3, 0.2, 1.9), '#b9b19a', { x: SX, y: 0.1, z: SZ });
  M.add(new THREE.BoxGeometry(2.0, 1.5, 1.6), '#f3e6c8', { x: SX, y: 0.95, z: SZ });
  for (const dx of [-1.0, 1.0]) M.add(new THREE.BoxGeometry(0.14, 1.5, 0.14), '#8a5a36', { x: SX + dx, y: 0.95, z: SZ + 0.8 });
  M.add(new THREE.BoxGeometry(0.56, 0.95, 0.06), '#8a5a36', { x: SX - 0.45, y: 0.67, z: SZ + 0.81 });
  M.add(new THREE.SphereGeometry(0.04, 6, 4), '#ffd36a', { x: SX - 0.27, y: 0.67, z: SZ + 0.85 });
  M.add(new THREE.BoxGeometry(0.62, 0.5, 0.06), '#a8e0ff', { x: SX + 0.45, y: 1.05, z: SZ + 0.81 });
  M.add(new THREE.BoxGeometry(0.72, 0.08, 0.14), '#8a5a36', { x: SX + 0.45, y: 0.78, z: SZ + 0.85 });
  M.add(new THREE.BoxGeometry(0.3, 0.7, 0.3), '#a8a28b', { x: SX + 0.6, y: 2.2, z: SZ - 0.3 });
  for (const side of [1, -1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.15), toon(side > 0 ? '#e2584a' : '#c4473b'));
    slope.position.set(0, 1.98, side * 0.43);
    slope.rotation.x = side * 0.62;
    slope.castShadow = true;
    stall.add(slope);
  }
  M.add(new THREE.BoxGeometry(2.0, 0.55, 0.06), '#f3e6c8', { x: SX, y: 1.95, z: SZ + 0.78 }, { x: 0, y: 0, z: 0 }, { x: 0.5, y: 1, z: 1 });
  for (let i = 0; i < 5; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.42), toon(i % 2 ? '#fff3e2' : '#e2584a'));
    strip.position.set(0.13 + i * 0.16, 1.42, 1.0);
    strip.rotation.x = 0.45;
    stall.add(strip);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.06), toon('#c8945a'));
  board.position.set(0, 1.86, 0.84);
  stall.add(board);
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 12), toon('#ffd36a', '#c99a1a', 0.3));
  coin.rotation.x = Math.PI / 2;
  coin.position.set(0, 1.86, 0.89);
  stall.add(coin);
  const lamp = glowSprite('#ffd27a', 1.4, 0);
  lamp.position.set(1.15, 1.5, 1.0);
  stall.add(lamp);
  stall.userData.lamp = lamp;
  // Mango the monkey minds the counter, standing on a crate by the window.
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), toon('#b07a46'));
  crate.position.set(0.45, 0.2, 1.22);
  crate.castShadow = true;
  stall.add(crate);
  const keeper = buildShopkeeper();
  keeper.position.set(0.45, 0.4, 1.22);
  keeper.scale.setScalar(0.75);
  stall.add(keeper);
  stall.userData.keeper = keeper;
  const sHit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 2.0), new THREE.MeshBasicMaterial({ visible: false }));
  sHit.position.y = 1.4;
  sHit.userData.pick = { kind: 'shop' };
  stall.add(sHit);
  pickables.push(sHit);
  group.add(stall);
  M.anchor = null;

  view.home = { font, fontWater, stall, basket };
}

/**
 * The sell booth every world has: a little wooden counter under a green and gold
 * awning, with a big coin on a post so you can spot it from across the island.
 */
function sellBooth(view: IslandView, g: Geo, at: { x: number; z: number }): THREE.Group {
  const b = new THREE.Group();
  b.position.set(g.ox + at.x, 0, g.oz + at.z);
  // face the middle of the island
  b.rotation.y = Math.atan2(-at.x, -at.z);
  const add = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rx = 0) => {
    const m = new THREE.Mesh(geo, toon(color));
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    b.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(1.5, 0.75, 0.7), '#c8945a', 0, 0.38, 0.1);
  add(new THREE.BoxGeometry(1.6, 0.08, 0.8), '#e8c08a', 0, 0.78, 0.1);
  for (const dx of [-0.7, 0.7]) add(new THREE.BoxGeometry(0.1, 1.5, 0.1), '#8a5a36', dx, 1.2, 0.4);
  for (let i = 0; i < 5; i++) {
    add(new THREE.BoxGeometry(0.34, 0.06, 0.9), i % 2 ? '#fff3c4' : '#3fbf5a', -0.68 + i * 0.34, 1.95, 0.25, 0.32);
  }
  // little coin stacks on the counter
  for (const [x, n] of [[-0.45, 3], [-0.2, 2], [0.45, 4]] as [number, number][]) {
    for (let k = 0; k < n; k++) add(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), '#ffd36a', x, 0.84 + k * 0.045, 0.2);
  }
  // the sign: a coin on a post, high enough to read from afar
  add(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), '#8a5a36', 0.85, 2.3, -0.1);
  const coin = add(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 18), '#ffc21a', 0.85, 3.0, -0.1, Math.PI / 2);
  (coin.material as THREE.MeshToonMaterial).emissive = new THREE.Color('#c99a1a');
  (coin.material as THREE.MeshToonMaterial).emissiveIntensity = 0.35;
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.09, 5), '#e8930a', 0.85, 3.0, -0.1, Math.PI / 2);
  b.userData.coin = coin;
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.2, 1.4), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.5;
  hit.userData.pick = { kind: 'booth', island: view.id };
  b.add(hit);
  view.pickables.push(hit);
  view.group.add(b);
  return b;
}

// ---------------------------------------------------------------- Ember Peak

function buildVolcano(view: IslandView, M: Merger, g: Geo, rand: () => number): void {
  const { ox, oz } = g;
  // the volcano: layered cone with a glowing crater
  // Stood upright on the globe and sunk a little so its wide base meets the curve.
  const sink = 1.2;
  M.anchor = { x: ox, z: oz - 3.6 };
  M.add(new THREE.CylinderGeometry(1.5, 3.4, 3.8, 14), '#5a4040', { x: ox, y: 1.9 - sink, z: oz - 3.6 });
  M.add(new THREE.CylinderGeometry(1.2, 1.55, 0.5, 14), '#4a3434', { x: ox, y: 4.0 - sink, z: oz - 3.6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    M.add(new THREE.BoxGeometry(0.35, 2.4, 0.2), '#ff7a2a', { x: ox + Math.cos(a) * 2.1, y: 2.4 - sink, z: oz - 3.6 + Math.sin(a) * 2.1 },
      { x: Math.sin(a) * 0.5, y: -a, z: -Math.cos(a) * 0.5 });
  }
  M.anchor = null;
  const crater = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), new THREE.MeshToonMaterial({ color: '#ffb02a', emissive: '#ff6a00', emissiveIntensity: 1 }));
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(ox, 4.27 - sink, oz - 3.6);
  view.group.add(crater);
  view.lava.push(crater);
  const smoke = glowSprite('#ff9a4a', 4, 0.5);
  smoke.position.set(ox, 5.2 - sink, oz - 3.6);
  view.group.add(smoke);

  // lava pools
  for (const c of g.lava) {
    flatDisc(M, c.r + 0.25, '#2a2228', c.x, c.z, 0.03);
    const lava = waterDisc(g, c, '#ff8a1a', '#ff4a00', 0.07);
    (lava.material as THREE.MeshToonMaterial).emissiveIntensity = 0.9;
    (lava.material as THREE.MeshToonMaterial).transparent = false;
    view.group.add(lava);
    view.lava.push(lava);
  }
  // obsidian spires and warm rocks
  for (const o of g.obstacles.slice(3)) {
    M.piece(o.x, o.z, () => {
      M.add(new THREE.ConeGeometry(0.55, 1.8, 5), '#2f2a3a', { x: o.x, y: 0.9, z: o.z }, { x: 0, y: rand(), z: 0 });
      M.add(new THREE.ConeGeometry(0.35, 1.1, 5), '#3f3850', { x: o.x + 0.45, y: 0.55, z: o.z + 0.2 }, { x: 0, y: rand(), z: 0.15 });
    });
  }
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const r = 3 + rand() * (g.r - 4);
    const x = ox + Math.cos(a) * r;
    const z = oz + Math.sin(a) * r;
    if (isBlocked(g, x, z, 0.6)) continue;
    M.add(new THREE.DodecahedronGeometry(0.25 + rand() * 0.25, 0), i % 2 ? '#5a4a52' : '#ff9a4a', { x, y: 0.15, z }, { x: rand(), y: rand(), z: rand() });
  }
}

// ---------------------------------------------------------------- Coral Lagoon

function buildLagoon(view: IslandView, M: Merger, g: Geo, rand: () => number): void {
  const lagoon = g.water[0];
  flatDisc(M, lagoon.r + 0.35, '#7fe0d0', lagoon.x, lagoon.z, 0.03);
  const water = waterDisc(g, lagoon, '#2ad0e8', '#0fa0c8');
  view.group.add(water);
  view.water.push(water);
  // coral and rocks under the water
  const corals = ['#ff6f91', '#ffb36a', '#c77dff', '#ff9a8a'];
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = (0.25 + rand() * 0.7) * (lagoon.r - 0.6);
    const x = lagoon.x + Math.cos(a) * r;
    const z = lagoon.z + Math.sin(a) * r;
    if (Object.values(SPOTS).some((s) => s.island === 'lagoon' && Math.hypot(s.x - x, s.z - z) < 1.3)) continue;
    const c = corals[i % corals.length];
    if (i % 3 === 0) {
      M.add(new THREE.SphereGeometry(0.28, 8, 5), c, { x, y: 0.02, z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.7, z: 1 });
    } else {
      for (let j = 0; j < 3; j++) {
        M.add(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 5), c, { x: x + (j - 1) * 0.12, y: 0.15, z: z + (rand() - 0.5) * 0.15 }, { x: (j - 1) * 0.4, y: 0, z: (rand() - 0.5) * 0.4 });
      }
    }
  }
  // shells and starfish on the sand
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = lagoon.r + 0.9 + rand() * (g.r - lagoon.r - 2);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    M.add(new THREE.ConeGeometry(0.12, 0.08, 5), i % 2 ? '#ff8f6a' : '#fff0d6', { x, y: 0.03, z }, { x: 0, y: rand(), z: 0 });
  }
  for (const s of g.shelters) palm(view, M, s.x, s.z, 1 + rand() * 0.2, rand);
  for (let i = 0; i < 3; i++) {
    const a = 0.6 + i * 1.9 + rand() * 0.4;
    const r = g.r - 1.3;
    palm(view, M, g.ox + Math.cos(a) * r, g.oz + Math.sin(a) * r, 0.8 + rand() * 0.2, rand);
  }
}

// ---------------------------------------------------------------- Sunny Shore

function buildBeach(view: IslandView, M: Merger, g: Geo, rand: () => number): void {
  // tide pools ringed with rocks
  for (const c of g.water) {
    flatDisc(M, c.r + 0.25, '#e8d6a0', c.x, c.z, 0.03);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rand() * 0.3;
      M.add(new THREE.DodecahedronGeometry(0.18 + rand() * 0.12, 0), i % 3 ? '#c8b89a' : '#a89a80',
        { x: c.x + Math.cos(a) * (c.r + 0.1), y: 0.05, z: c.z + Math.sin(a) * (c.r + 0.1) }, { x: 0, y: rand(), z: 0 }, { x: 1, y: 0.6, z: 1 });
    }
    const water = waterDisc(g, c, '#4fd8f0', '#1aa8d0');
    view.group.add(water);
    view.water.push(water);
  }
  // rocks and palms (palms double as shelters)
  for (const o of g.obstacles.slice(0, 2)) {
    M.add(new THREE.DodecahedronGeometry(o.r, 0), '#d0b090', { x: o.x, y: o.r * 0.4, z: o.z }, { x: rand(), y: rand(), z: rand() }, { x: 1, y: 0.75, z: 1 });
  }
  for (const s of g.shelters) palm(view, M, s.x, s.z, 1 + rand() * 0.2, rand);
  // a beach umbrella and towel: somebody was here before you
  const ux = g.ox - 4.2;
  const uz = g.oz + 2.6;
  M.anchor = { x: ux, z: uz };
  M.add(new THREE.BoxGeometry(1.1, 0.02, 0.6), '#ff7a8a', { x: ux + 0.6, y: 0.02, z: uz + 0.3 }, { x: 0, y: 0.3, z: 0 });
  for (let i = 0; i < 4; i++) M.add(new THREE.BoxGeometry(0.12, 0.021, 0.6), '#ffffff', { x: ux + 0.3 + i * 0.22, y: 0.025, z: uz + 0.3 }, { x: 0, y: 0.3, z: 0 });
  M.add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), '#f4efe4', { x: ux, y: 0.8, z: uz }, { x: 0.1, y: 0, z: 0.1 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const seg = new THREE.ConeGeometry(0.9, 0.35, 3, 1, true, a, Math.PI / 4);
    M.add(seg, i % 2 ? '#ffffff' : '#ff9ec4', { x: ux + 0.08, y: 1.6, z: uz + 0.08 });
  }
  M.anchor = null;
  // shells, starfish and little sand ripples
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.5 + rand() * (g.r - 2.5);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    if (inWater(g, x, z, 0.4) || isBlocked(g, x, z, 0.3)) continue;
    if (i % 3 === 0) M.add(new THREE.ConeGeometry(0.14, 0.06, 5), '#ff8f6a', { x, y: 0.03, z }, { x: 0, y: rand(), z: 0 });
    else M.add(new THREE.SphereGeometry(0.08, 6, 4, 0, Math.PI), i % 2 ? '#fff0d6' : '#ffd0e2', { x, y: 0.02, z }, { x: -Math.PI / 2, y: rand() * 3, z: 0 });
  }
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2;
    const r = 2 + rand() * (g.r - 3);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    if (inWater(g, x, z, 0.8)) continue;
    M.add(new THREE.TorusGeometry(0.5 + rand() * 0.3, 0.025, 3, 16, Math.PI * 0.6), '#f0d090', { x, y: 0.01, z }, { x: -Math.PI / 2, y: 0, z: rand() * 3 });
  }
}

// ---------------------------------------------------------------- Dune Hollow

function cactus(M: Merger, x: number, z: number, s: number, rand: () => number): void {
  M.piece(x, z, () => cactusParts(M, x, z, s, rand));
}

function cactusParts(M: Merger, x: number, z: number, s: number, rand: () => number): void {
  M.add(new THREE.CylinderGeometry(0.22 * s, 0.25 * s, 1.4 * s, 8), '#5fae4a', { x, y: 0.7 * s, z });
  M.add(new THREE.SphereGeometry(0.22 * s, 8, 6), '#5fae4a', { x, y: 1.4 * s, z });
  for (const side of [1, -1]) {
    if (rand() < 0.3) continue;
    const h = (0.55 + rand() * 0.35) * s;
    M.add(new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.35 * s, 6), '#5fae4a', { x: x + side * 0.28 * s, y: h, z }, { x: 0, y: 0, z: Math.PI / 2 });
    M.add(new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.4 * s, 6), '#5fae4a', { x: x + side * 0.44 * s, y: h + 0.18 * s, z });
    M.add(new THREE.SphereGeometry(0.11 * s, 6, 4), '#5fae4a', { x: x + side * 0.44 * s, y: h + 0.38 * s, z });
  }
  M.add(new THREE.SphereGeometry(0.09 * s, 6, 4), '#ff7ab0', { x, y: 1.62 * s, z });
}

function buildDesert(view: IslandView, M: Merger, g: Geo, rand: () => number): void {
  // the oasis
  const oasis = g.water[0];
  flatDisc(M, oasis.r + 0.45, '#9fbf5a', oasis.x, oasis.z, 0.03);
  const water = waterDisc(g, oasis, '#3ac8e8', '#1a98c8');
  view.group.add(water);
  view.water.push(water);
  for (let i = 0; i < 8; i++) {
    const a = 3.6 + i * 0.16;
    M.add(new THREE.CylinderGeometry(0.03, 0.04, 0.8 + rand() * 0.4, 5), '#6f9a3a',
      { x: oasis.x + Math.cos(a) * (oasis.r + 0.05), y: 0.4, z: oasis.z + Math.sin(a) * (oasis.r + 0.05) }, { x: rand() * 0.2, y: 0, z: rand() * 0.2 - 0.1 });
  }
  palm(view, M, g.shelters[1].x, g.shelters[1].z, 1.05, rand);
  // cacti with little pink flowers
  for (const o of g.obstacles.slice(0, 3)) cactus(M, o.x, o.z, 0.9 + rand() * 0.3, rand);
  // a sandstone arch (shelter from storms)
  const arch = g.shelters[0];
  M.piece(arch.x, arch.z, () => {
    for (const side of [1, -1]) {
      M.add(new THREE.BoxGeometry(0.5, 1.6, 0.6), '#d89a5a', { x: arch.x + side * 0.75, y: 0.8, z: arch.z }, { x: 0, y: 0, z: side * 0.06 });
    }
    M.add(new THREE.BoxGeometry(2.1, 0.45, 0.65), '#e0a868', { x: arch.x, y: 1.75, z: arch.z });
  });
  // soft dunes and scattered pebbles
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const r = 2.5 + rand() * (g.r - 3.5);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    if (inWater(g, x, z, 1.2) || isBlocked(g, x, z, 0.8)) continue;
    M.add(new THREE.SphereGeometry(1, 12, 6), i % 2 ? '#f6cc78' : '#eebc62', { x, y: -0.1, z }, { x: 0, y: rand() * 3, z: 0 }, { x: 1.2 + rand(), y: 0.3, z: 0.8 + rand() * 0.5 }, 'drape');
  }
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1 + rand() * (g.r - 2);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    if (inWater(g, x, z, 0.4) || isBlocked(g, x, z, 0.3)) continue;
    M.add(new THREE.DodecahedronGeometry(0.12 + rand() * 0.12, 0), i % 2 ? '#c09060' : '#a87a4a', { x, y: 0.06, z }, { x: rand(), y: rand(), z: rand() });
  }
}

// ---------------------------------------------------------------- Cloud Isle

const RAINBOW_BANDS = ['#ff5a5a', '#ffa83a', '#ffe14d', '#5fd06a', '#4ab8ff', '#9a6aff'];

function buildCloud(view: IslandView, M: Merger, g: Geo, rand: () => number, sizes: Partial<Record<IslandId, number>>): void {
  // the mist pool, ringed with little clouds
  const pool = g.water[0];
  flatDisc(M, pool.r + 0.35, '#e0ecff', pool.x, pool.z, 0.03);
  const water = waterDisc(g, pool, '#bfe8ff', '#8ad0ff');
  view.group.add(water);
  view.water.push(water);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rand() * 0.3;
    M.add(new THREE.IcosahedronGeometry(0.28 + rand() * 0.14, 1), i % 3 ? '#ffffff' : '#eef2ff',
      { x: pool.x + Math.cos(a) * (pool.r + 0.15), y: 0.12, z: pool.z + Math.sin(a) * (pool.r + 0.15) }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.7, z: 1 });
  }
  // a little rainbow arching over the pool
  const arch = new THREE.Group();
  arch.position.set(pool.x, 0, pool.z);
  RAINBOW_BANDS.forEach((c, i) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.9 - i * 0.12, 0.07, 6, 28, Math.PI), toon(c, c, 0.25));
    band.rotation.y = 0.6;
    arch.add(band);
  });
  view.group.add(arch);
  // cloud trees (shelters from the weather)
  for (const s of g.shelters) tree(view, M, s, rand, ['#ffffff', '#f4f0ff', '#e8f4ff'], '#c9b8ff');
  // a little sky temple
  const t = g.obstacles[3];
  M.piece(t.x, t.z, () => {
    M.add(new THREE.CylinderGeometry(1.0, 1.1, 0.2, 12), '#f4f0ff', { x: t.x, y: 0.1, z: t.z });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      M.add(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), '#ffffff', { x: t.x + Math.cos(a) * 0.75, y: 0.8, z: t.z + Math.sin(a) * 0.75 });
    }
    M.add(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 12), '#e8e0ff', { x: t.x, y: 1.45, z: t.z });
    M.add(new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#c9b8ff', { x: t.x, y: 1.5, z: t.z });
    M.add(new THREE.SphereGeometry(0.14, 8, 6), '#ffe14d', { x: t.x, y: 2.4, z: t.z });
  });
  // soft cloud tufts on the ground and pastel flowers
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.5 + rand() * (g.r - 2.5);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    if (inWater(g, x, z, 0.8) || isBlocked(g, x, z, 0.6)) continue;
    if (Object.values(SPOTS).some((sp) => sp.island === 'cloud' && Math.hypot(sp.x - x, sp.z - z) < 1.6)) continue;
    for (let j = 0; j < 3; j++) {
      M.add(new THREE.IcosahedronGeometry(0.3 + rand() * 0.2, 1), j % 2 ? '#ffffff' : '#f2f6ff',
        { x: x + (j - 1) * 0.35, y: 0.12 + (j % 2) * 0.1, z: z + (rand() - 0.5) * 0.3 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.6, z: 1 });
    }
  }
  // clouds drifting around the underside: the island floats
  const c = globeCenter(g);
  const R = globeRadius(g);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const puff = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rand() * 0.7, 1), toon('#ffffff', '#dfefff', 0.3));
      p.position.set(j * 1.1 - 1.6, rand() * 0.5, rand() * 0.6);
      puff.add(p);
    }
    puff.position.set(c.x + Math.cos(a) * R * 1.05, c.y - R * (0.15 + rand() * 0.35), c.z + Math.sin(a) * R * 1.05);
    puff.rotation.y = -a;
    puff.userData.placed = true;
    view.group.add(puff);
  }
  // rainbow bridges to the nearest worlds
  for (const to of ['home', 'volcano', 'lagoon'] as IslandId[]) rainbowBridge(M, g, islandGeo(to, sizes[to] ?? 0));
}

/** A rainbow arcing from this globe's side to another's. */
function rainbowBridge(M: Merger, from: Geo, to: Geo): void {
  const a = globeCenter(from);
  const b = globeCenter(to);
  const ra = globeRadius(from);
  const rb = globeRadius(to);
  const d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  // from each globe's side (its equator), arching gently between them: on the horizon, never across your view
  const start = new THREE.Vector3(a.x + d.x * ra * 0.98, a.y, a.z + d.z * ra * 0.98);
  const end = new THREE.Vector3(b.x - d.x * rb * 0.98, b.y, b.z - d.z * rb * 0.98);
  const mid = start.clone().lerp(end, 0.5);
  mid.y = Math.max(start.y, end.y) + 9;
  const side = new THREE.Vector3(-d.z, 0, d.x);
  RAINBOW_BANDS.forEach((col, i) => {
    const off = side.clone().multiplyScalar((i - 2.5) * 0.22);
    const curve = new THREE.QuadraticBezierCurve3(start.clone().add(off), mid.clone().add(off), end.clone().add(off));
    M.add(new THREE.TubeGeometry(curve, 48, 0.12, 5, false), col, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 'fixed');
  });
}
