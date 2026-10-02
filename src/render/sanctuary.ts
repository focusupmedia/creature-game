import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BASKET, FONT, NESTS, POND, ROCKS, SHOP_STALL, TREES } from '../content/layout';
import { ISLANDS, inWater, isBlocked, islandGeo, type Geo } from '../content/islands';
import { SPOTS } from '../content/world';
import { mulberry32 } from '../core/rng';
import type { IslandId } from '../core/types';
import { addOutlines, glowSprite, glowTexture, toon, vertexToon } from './materials';

// Island dioramas. Everything static is merged into one vertex-colored mesh per
// island (one draw call, plus one for its outline); animated or tappable bits stay separate.

class Merger {
  private parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, color: string, pos: THREE.Vector3Like, rot: THREE.Vector3Like = { x: 0, y: 0, z: 0 }, scale: THREE.Vector3Like = { x: 1, y: 1, z: 1 }): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(pos.x, pos.y, pos.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x, rot.y, rot.z)),
      new THREE.Vector3(scale.x, scale.y, scale.z),
    ));
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
    g.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(pos.x, pos.y, pos.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x, rot.y, rot.z)), new THREE.Vector3(1, 1, 1),
    ));
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
  nests: THREE.Group[];
  nestLocks: THREE.Sprite[];
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
  fireflies?: THREE.Points;
  pickables: THREE.Object3D[];
  ground: THREE.Mesh;
}

const mix = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

/** Floating island body: grassy (or sandy, or ashy) top, cliff lip, rocky underside. */
function islandBody(M: Merger, g: Geo, pal: (typeof ISLANDS)['home']['palette'], rand: () => number, soft: Merger = M): void {
  const R = g.r;
  M.add(new THREE.CylinderGeometry(R, R * 0.97, 0.6, 64, 1), pal.top, { x: g.ox, y: -0.3, z: g.oz });
  M.add(new THREE.CylinderGeometry(R * 0.985, R * 0.9, 0.7, 64, 1), pal.lip, { x: g.ox, y: -0.95, z: g.oz });
  const under = new THREE.ConeGeometry(R * 0.9, 6.5 * Math.min(1.3, R / 9.5), 16, 3);
  const pos = under.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 3.2) {
      pos.setX(i, pos.getX(i) * (0.85 + rand() * 0.3));
      pos.setZ(i, pos.getZ(i) * (0.85 + rand() * 0.3));
    }
  }
  M.add(under, pal.under, { x: g.ox, y: -1.3 - 3.25 * Math.min(1.3, R / 9.5), z: g.oz }, { x: Math.PI, y: 0, z: 0 });
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = R * (0.3 + rand() * 0.4);
    M.add(new THREE.DodecahedronGeometry(0.6 + rand() * 0.6, 0), pal.rock, { x: g.ox + Math.cos(a) * r, y: -1.6 - rand() * 2.5, z: g.oz + Math.sin(a) * r });
  }
  // Soft colour patches on the ground give it shading and depth.
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (R - 1.8);
    const x = g.ox + Math.cos(a) * r;
    const z = g.oz + Math.sin(a) * r;
    if (inWater(g, x, z, 1.2)) continue;
    const s = 1.2 + rand() * 1.8;
    soft.add(new THREE.CylinderGeometry(s, s, 0.02, 18), i % 3 ? pal.patch : mix(pal.top, '#ffffff', 0.12), { x, y: 0.005 + i * 0.0004, z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0.75 + rand() * 0.5 });
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
    if (flowers && rand() < 0.22) {
      G.add(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 3), root, { x, y: 0.12, z });
      G.add(new THREE.SphereGeometry(0.07, 6, 4), flowerColors[Math.floor(rand() * flowerColors.length)], { x, y: 0.27, z });
    } else {
      for (let j = 0; j < 3; j++) {
        G.addBlade(blade, root, tip, { x: x + (j - 1) * 0.07, y: 0.15, z: z + (rand() - 0.5) * 0.08 }, { x: (j - 1) * 0.35, y: 0, z: (rand() - 0.5) * 0.45 });
      }
    }
  }
}

function lureSpots(M: Merger, islandId: IslandId, pickables: THREE.Object3D[], group: THREE.Group, dishColor: string): Record<string, SpotDish> {
  const out: Record<string, SpotDish> = {};
  for (const spot of Object.values(SPOTS).filter((s) => s.island === islandId)) {
    const root = new THREE.Group();
    root.position.set(spot.x, 0, spot.z);
    if (spot.water) {
      M.add(new THREE.BoxGeometry(1.4, 0.08, 0.9), '#a0764e', { x: spot.x, y: 0.12, z: spot.z });
      for (const [dx, dz] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) {
        M.add(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 5), '#7b5236', { x: spot.x + dx, y: 0.05, z: spot.z + dz });
      }
    } else {
      M.add(new THREE.CylinderGeometry(1.0, 1.0, 0.04, 24), '#f4dfa0', { x: spot.x, y: 0.01, z: spot.z });
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

function waterDisc(c: { x: number; z: number; r: number }, color: string, emissive: string, y = 0.06): THREE.Mesh {
  const mat = new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.92, emissive, emissiveIntensity: 0.3 });
  const m = new THREE.Mesh(new THREE.CircleGeometry(c.r, 48), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(c.x, y, c.z);
  m.receiveShadow = true;
  return m;
}

function tree(view: IslandView, M: Merger, t: { x: number; z: number; s: number }, rand: () => number, greens = ['#4fc23a', '#6fdc45', '#3fae35'], trunk = '#9a5a32'): void {
  M.add(new THREE.CylinderGeometry(0.2 * t.s, 0.32 * t.s, 2.2 * t.s, 7), trunk, { x: t.x, y: 1.1 * t.s, z: t.z });
  const canopy = new THREE.Group();
  canopy.position.set(t.x, 2.2 * t.s, t.z);
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry((1.2 - i * 0.18) * t.s, 0), toon(greens[i]));
    blob.position.set((rand() - 0.5) * 0.6 * t.s, i * 0.65 * t.s, (rand() - 0.5) * 0.6 * t.s);
    blob.rotation.set(rand(), rand(), rand());
    blob.castShadow = true;
    canopy.add(blob);
  }
  view.group.add(canopy);
  view.canopies.push(canopy);
}

function palm(view: IslandView, M: Merger, x: number, z: number, s: number, rand: () => number): void {
  const lean = (rand() - 0.5) * 0.4;
  for (let i = 0; i < 5; i++) {
    M.add(new THREE.CylinderGeometry(0.13 * s, 0.16 * s, 0.5 * s, 7), i % 2 ? '#b07a44' : '#9a6638', { x: x + lean * i * 0.25, y: 0.25 * s + i * 0.48 * s, z });
  }
  const crown = new THREE.Group();
  crown.position.set(x + lean * 1.2, 2.5 * s, z);
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
export function buildIsland(id: IslandId, size: number, owned: boolean): IslandView {
  const def = ISLANDS[id];
  const g = islandGeo(id, size);
  const group = new THREE.Group();
  const rand = mulberry32(1234 + id.length * 97);
  const M = new Merger();
  const G = new Merger();
  const view: IslandView = {
    id, key: `${owned}:${size}`, group, water: [], lava: [], canopies: [], spotDishes: {}, pickables: [],
    ground: new THREE.Mesh(new THREE.CircleGeometry(g.r, 40), new THREE.MeshBasicMaterial({ visible: false })),
  };
  view.ground.rotation.x = -Math.PI / 2;
  view.ground.position.set(g.ox, 0.01, g.oz);
  view.ground.userData.pick = { kind: 'ground', island: id };
  group.add(view.ground);

  if (!owned) {
    // A hazy silhouette: you can see it's there, and what kind of place it is.
    const fog = '#c8dcf0';
    const pal = { ...def.palette };
    for (const k of Object.keys(pal) as (keyof typeof pal)[]) pal[k] = mix(pal[k], fog, def.status === 'soon' ? 0.6 : 0.4);
    islandBody(M, g, pal, rand);
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const r = g.r * (0.3 + rand() * 0.45);
      M.add(new THREE.IcosahedronGeometry(1 + rand() * 0.6, 0), mix(id === 'volcano' ? '#5a4a4a' : '#5fc23f', fog, 0.5), { x: g.ox + Math.cos(a) * r, y: 1.1, z: g.oz + Math.sin(a) * r });
    }
    if (id === 'volcano') M.add(new THREE.ConeGeometry(3.4, 4.2, 9, 1, true), mix('#4a3434', fog, 0.4), { x: g.ox, y: 2.1, z: g.oz - 3.6 });
    group.add(M.build());
    return view;
  }

  islandBody(M, g, def.palette, rand, G);
  const clear: { x: number; z: number; r: number }[] = Object.values(SPOTS).filter((s) => s.island === id).map((s) => ({ x: s.x, z: s.z, r: 1.9 }));

  if (id === 'home') buildHome(view, M, g, rand, clear);
  if (id === 'volcano') buildVolcano(view, M, g, rand);
  if (id === 'lagoon') buildLagoon(view, M, g, rand);

  view.spotDishes = lureSpots(M, id, view.pickables, group, id === 'volcano' ? '#4a3a3a' : '#8d8f86');

  scatterGrass(G, g, def.palette, rand, clear, id === 'home' ? 46 : id === 'lagoon' ? 22 : 18, id !== 'volcano');
  const scenery = M.build();
  group.add(scenery);
  addOutlines(scenery, 2.6);
  if (!G.empty) group.add(G.build());
  for (const c of view.canopies) addOutlines(c, 3);
  if (view.home) {
    addOutlines(view.home.stall, 3);
    addOutlines(view.home.font, 2.6);
    for (const n of view.home.nests) addOutlines(n, 2.4);
  }

  // fireflies (visible at night)
  const n = Math.round(30 + g.r * 3);
  const fp = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (g.r - 1);
    fp.set([g.ox + Math.cos(a) * r, 0.4 + rand() * 1.8, g.oz + Math.sin(a) * r], i * 3);
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
  M.add(new THREE.CylinderGeometry(POND.r + 0.15, POND.r + 0.15, 0.05, 32), '#5f8e4a', { x: POND.x, y: 0.0, z: POND.z });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.2;
    M.add(new THREE.DodecahedronGeometry(0.22 + rand() * 0.12, 0), i % 3 ? '#a3a59c' : '#8b8e86',
      { x: POND.x + Math.cos(a) * (POND.r + 0.1), y: 0.05, z: POND.z + Math.sin(a) * (POND.r + 0.1) }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.6, z: 1 });
  }
  const water = waterDisc(POND, '#36c6ff', '#1a8fd0');
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
    const x = 0.4 * (1 - t) + FONT.x * t + Math.sin(i) * 0.3;
    const z = 1.5 * (1 - t) + (FONT.z + 1.4) * t;
    M.add(new THREE.CylinderGeometry(0.32, 0.36, 0.06, 8), '#f4dfa0', { x, y: 0.01, z }, { x: 0, y: rand(), z: 0 });
  }

  for (const t of TREES) tree(view, M, t, rand);
  // larger islands get a few extra trees around the new rim
  if (g.r > 10) {
    for (let i = 0; i < Math.round((g.r - 9.5) * 2.5); i++) {
      const a = -Math.PI * 0.95 + (i / Math.max(1, (g.r - 9.5) * 2.5)) * Math.PI * 1.9 + rand() * 0.2;
      tree(view, M, { x: Math.cos(a) * (g.r - 1.4), z: Math.sin(a) * (g.r - 1.4) - 0.5, s: 0.7 + rand() * 0.3 }, rand);
    }
  }
  for (const r of ROCKS) {
    M.add(new THREE.DodecahedronGeometry(r.s, 0), '#9ea3a0', { x: r.x, y: r.s * 0.35, z: r.z }, { x: rand(), y: rand(), z: rand() }, { x: 1, y: 0.7, z: 1 });
    M.add(new THREE.SphereGeometry(r.s * 0.55, 6, 4), '#6fae55', { x: r.x + 0.1, y: r.s * 0.75, z: r.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0.35, z: 1 });
  }

  // the Kindred Font (combining)
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

  // nests
  const nests: THREE.Group[] = [];
  const nestLocks: THREE.Sprite[] = [];
  NESTS.forEach((n, i) => {
    const ng = new THREE.Group();
    ng.position.set(n.x, 0, n.z);
    M.add(new THREE.CylinderGeometry(0.45, 0.55, 0.35, 8), '#b9b19a', { x: n.x, y: 0.17, z: n.z });
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.13, 6, 14), toon('#a8783f'));
    nest.rotation.x = -Math.PI / 2;
    nest.position.y = 0.42;
    nest.castShadow = true;
    ng.add(nest);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 10), toon('#e8c872'));
    straw.position.y = 0.4;
    ng.add(straw);
    const lock = glowSprite('#ffffff', 0.01, 0);
    ng.add(lock);
    nestLocks.push(lock);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.8;
    hit.userData.pick = { kind: 'nest', index: i };
    ng.add(hit);
    pickables.push(hit);
    group.add(ng);
    nests.push(ng);
  });

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

  // the shop cottage
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
  const sHit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 2.0), new THREE.MeshBasicMaterial({ visible: false }));
  sHit.position.y = 1.4;
  sHit.userData.pick = { kind: 'shop' };
  stall.add(sHit);
  pickables.push(sHit);
  group.add(stall);

  view.home = { font, fontWater, nests, nestLocks, stall, basket };
}

// ---------------------------------------------------------------- Ember Peak

function buildVolcano(view: IslandView, M: Merger, g: Geo, rand: () => number): void {
  const { ox, oz } = g;
  // the volcano: layered cone with a glowing crater
  M.add(new THREE.CylinderGeometry(1.5, 3.4, 3.8, 10), '#5a4040', { x: ox, y: 1.9, z: oz - 3.6 });
  M.add(new THREE.CylinderGeometry(1.2, 1.55, 0.5, 10), '#4a3434', { x: ox, y: 4.0, z: oz - 3.6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    M.add(new THREE.BoxGeometry(0.35, 2.4, 0.2), '#ff7a2a', { x: ox + Math.cos(a) * 2.1, y: 2.4, z: oz - 3.6 + Math.sin(a) * 2.1 },
      { x: Math.sin(a) * 0.5, y: -a, z: -Math.cos(a) * 0.5 });
  }
  const crater = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), new THREE.MeshToonMaterial({ color: '#ffb02a', emissive: '#ff6a00', emissiveIntensity: 1 }));
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(ox, 4.27, oz - 3.6);
  view.group.add(crater);
  view.lava.push(crater);
  const smoke = glowSprite('#ff9a4a', 4, 0.5);
  smoke.position.set(ox, 5.2, oz - 3.6);
  view.group.add(smoke);

  // lava pools
  for (const c of g.lava) {
    M.add(new THREE.CylinderGeometry(c.r + 0.2, c.r + 0.25, 0.08, 20), '#2a2228', { x: c.x, y: 0.02, z: c.z });
    const lava = waterDisc(c, '#ff8a1a', '#ff4a00', 0.07);
    (lava.material as THREE.MeshToonMaterial).emissiveIntensity = 0.9;
    (lava.material as THREE.MeshToonMaterial).transparent = false;
    view.group.add(lava);
    view.lava.push(lava);
  }
  // obsidian spires and warm rocks
  for (const o of g.obstacles.slice(3)) {
    M.add(new THREE.ConeGeometry(0.55, 1.8, 5), '#2f2a3a', { x: o.x, y: 0.9, z: o.z }, { x: 0, y: rand(), z: 0 });
    M.add(new THREE.ConeGeometry(0.35, 1.1, 5), '#3f3850', { x: o.x + 0.45, y: 0.55, z: o.z + 0.2 }, { x: 0, y: rand(), z: 0.15 });
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
  M.add(new THREE.CylinderGeometry(lagoon.r + 0.35, lagoon.r + 0.35, 0.04, 48), '#7fe0d0', { x: lagoon.x, y: 0.01, z: lagoon.z });
  const water = waterDisc(lagoon, '#2ad0e8', '#0fa0c8');
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
