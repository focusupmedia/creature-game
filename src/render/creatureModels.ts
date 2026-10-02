import * as THREE from 'three';
import { species as speciesDef } from '../content/species';
import { visibleMutations } from '../core/creatures';
import type { MutationId, Movement, SpeciesId } from '../core/types';
import { addOutlines, glowSprite, uniqueToon } from './materials';

// Procedural, primitive-built creatures. This is a deliberate prototype choice:
// silhouettes and mutation overlays can be iterated in code in minutes, and each
// builder documents the "parts contract" (body/head/wings/legs/tail) that
// production glTF models will need to honor.

export interface CreatureModel {
  root: THREE.Group;
  /** Scaled/squashed for bounces. */
  body: THREE.Group;
  wings: THREE.Object3D[];
  legs: THREE.Object3D[];
  tail?: THREE.Object3D;
  segments: THREE.Object3D[];
  glows: THREE.Sprite[];
  sparks?: THREE.Group;
  /** Starlit: tiny lights that twinkle across the body. */
  twinkles?: THREE.Group;
  materials: THREE.MeshToonMaterial[];
  height: number;
  movement: Movement;
  baseScale: number;
}

interface Palette { main: string; second: string; accent: string; belly: string }

const PALETTES: Record<string, Palette> = {
  mossfrog: { main: '#6cbf4f', second: '#3f8a3a', accent: '#f39bb0', belly: '#dff3b8' },
  pebbleback: { main: '#b8c98a', second: '#6f8f86', accent: '#a7aaa6', belly: '#f0e8c8' },
  glowbeetle: { main: '#2c4573', second: '#1b2a46', accent: '#d4ff6a', belly: '#3d5b8e' },
  petalwing: { main: '#f59ab8', second: '#ffd56b', accent: '#ffffff', belly: '#6b4b5a' },
  glimmerfin: { main: '#5cb8e6', second: '#2f7fb8', accent: '#fff3a6', belly: '#e6f7ff' },
  puffwren: { main: '#d08a55', second: '#7a4a2f', accent: '#ffb347', belly: '#fff0d6' },
  vinecoil: { main: '#4f9e4a', second: '#cfe36a', accent: '#89d16a', belly: '#e8f5b0' },
  burrowbun: { main: '#f4ece2', second: '#f2a7bd', accent: '#ffdb5c', belly: '#ffffff' },
  capling: { main: '#e2483e', second: '#fff3e2', accent: '#ffffff', belly: '#f4dcc2' },
  fernkit: { main: '#e98a46', second: '#5bc76a', accent: '#2a1d16', belly: '#fff1dc' },
  duskmoth: { main: '#6b52a3', second: '#3b2d63', accent: '#ffd36a', belly: '#c9b6ff' },
  lumewisp: { main: '#c9f0ff', second: '#7fd3ff', accent: '#ffffff', belly: '#ffffff' },
  lilyhop: { main: '#f4a7c4', second: '#5fbf5a', accent: '#ffe066', belly: '#fff0f6' },
  shellshroom: { main: '#a8b882', second: '#6d7f5c', accent: '#e2483e', belly: '#f0e8c8' },
  moonmoth: { main: '#c4ccff', second: '#7e86d9', accent: '#ffffff', belly: '#eef0ff' },
  thunderwren: { main: '#3d4c78', second: '#232c4a', accent: '#ffd83d', belly: '#c9d4ff' },
  starkoi: { main: '#26357e', second: '#141c4a', accent: '#ffe9a0', belly: '#6c7fd6' },
  nimbuwhale: { main: '#eaf2ff', second: '#9db8e8', accent: '#ffffff', belly: '#ffffff' },
};

// Shared unit geometries; parts are scaled meshes.
const G = {
  sphere: new THREE.SphereGeometry(1, 14, 10),
  lowSphere: new THREE.SphereGeometry(1, 8, 6),
  hemi: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  cone: new THREE.ConeGeometry(1, 1, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  rock: new THREE.DodecahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.28, 6, 16, Math.PI * 1.25),
  tetra: new THREE.TetrahedronGeometry(1, 0),
};

class Kit {
  mats: THREE.MeshToonMaterial[] = [];
  private byColor = new Map<string, THREE.MeshToonMaterial>();

  mat(color: string, emissive?: string, ei = 0.8): THREE.MeshToonMaterial {
    const key = color + (emissive ?? '');
    let m = this.byColor.get(key);
    if (!m) {
      m = uniqueToon(color);
      if (emissive) {
        m.emissive = new THREE.Color(emissive);
        m.emissiveIntensity = ei;
      }
      this.byColor.set(key, m);
      this.mats.push(m);
    }
    return m;
  }

  mesh(geo: THREE.BufferGeometry, color: string, s: [number, number, number], p: [number, number, number] = [0, 0, 0], emissive?: string): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.mat(color, emissive));
    m.scale.set(...s);
    m.position.set(...p);
    m.castShadow = true;
    return m;
  }

  ball(r: number, color: string, p: [number, number, number], s: [number, number, number] = [1, 1, 1], emissive?: string) {
    return this.mesh(G.sphere, color, [r * s[0], r * s[1], r * s[2]], p, emissive);
  }

  eye(parent: THREE.Object3D, x: number, y: number, z: number, r: number, dir = new THREE.Vector3(0, 0, 1)) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const white = this.ball(r, '#ffffff', [0, 0, 0]);
    white.castShadow = false;
    white.userData.noOutline = r < 0.05;
    const pupil = this.ball(r * 0.62, '#1a1420', [dir.x * r * 0.5, dir.y * r * 0.5, dir.z * r * 0.5]);
    pupil.castShadow = false;
    pupil.userData.noOutline = true;
    const shine = this.ball(r * 0.22, '#ffffff', [dir.x * r * 0.75 + r * 0.2, r * 0.35, dir.z * r * 0.75]);
    shine.castShadow = false;
    shine.userData.noOutline = true;
    g.add(white, pupil, shine);
    parent.add(g);
    return g;
  }
}

function pivot(x: number, y: number, z: number, child: THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(child);
  return g;
}

type Builder = (k: Kit, P: Palette, m: Omit<CreatureModel, 'root' | 'materials' | 'movement' | 'baseScale'>) => void;

const BUILDERS: Record<string, Builder> = {
  mossfrog: (k, P, m) => frog(k, P, m, false),
  lilyhop: (k, P, m) => frog(k, P, m, true),

  pebbleback: (k, P, m) => turtle(k, P, m, false),
  shellshroom: (k, P, m) => turtle(k, P, m, true),

  glowbeetle: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.3, P.main, [0, 0.24, 0.02], [0.85, 0.62, 1.15]));
    const seam = k.mesh(G.cyl, P.second, [0.015, 0.5, 0.015], [0, 0.42, 0.02]);
    seam.rotation.x = Math.PI / 2;
    b.add(seam);
    const lamp = k.ball(0.2, P.accent, [0, 0.24, -0.3], [1, 0.9, 1.1], P.accent);
    b.add(lamp);
    b.add(k.ball(0.14, P.second, [0, 0.22, 0.34]));
    k.eye(b, 0.07, 0.27, 0.43, 0.045);
    k.eye(b, -0.07, 0.27, 0.43, 0.045);
    for (const s of [1, -1]) {
      const ant = k.mesh(G.cyl, P.second, [0.012, 0.22, 0.012], [0.06 * s, 0.38, 0.44]);
      ant.rotation.set(0.6, 0, -0.4 * s);
      b.add(ant, k.ball(0.03, P.accent, [0.11 * s, 0.47, 0.5], [1, 1, 1], P.accent));
      for (let i = 0; i < 3; i++) {
        const leg = pivot(0.2 * s, 0.14, 0.12 - i * 0.16, k.mesh(G.cyl, P.second, [0.018, 0.18, 0.018], [0.05 * s, -0.06, 0]));
        leg.rotation.z = 0.7 * s;
        b.add(leg);
        m.legs.push(leg);
      }
    }
    const glow = glowSprite(P.accent, 1.1, 0);
    glow.position.set(0, 0.24, -0.3);
    b.add(glow);
    m.glows.push(glow);
    m.height = 0.6;
  },

  petalwing: (k, P, m) => moth(k, P, m, 'petal'),
  duskmoth: (k, P, m) => moth(k, P, m, 'dusk'),
  moonmoth: (k, P, m) => moth(k, P, m, 'moon'),

  glimmerfin: (k, P, m) => fish(k, P, m, false),
  starkoi: (k, P, m) => fish(k, P, m, true),

  puffwren: (k, P, m) => bird(k, P, m, false),
  thunderwren: (k, P, m) => bird(k, P, m, true),

  vinecoil: (k, P, m) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const r = 0.15 - i * 0.011;
      const seg = new THREE.Group();
      seg.add(k.ball(r, i % 2 ? P.main : P.second, [0, r, 0], [1, 0.85, 1.1]));
      seg.position.set(0, 0, -i * 0.17);
      m.body.add(seg);
      m.segments.push(seg);
    }
    const head = m.segments[0];
    head.add(k.ball(0.17, P.main, [0, 0.18, 0.08], [1, 0.8, 1.25]));
    k.eye(head, 0.09, 0.27, 0.18, 0.05);
    k.eye(head, -0.09, 0.27, 0.18, 0.05);
    const leaf = k.ball(0.12, P.accent, [0, 0.36, 0.0], [0.5, 0.12, 1]);
    leaf.rotation.x = -0.5;
    head.add(leaf);
    m.height = 0.55;
  },

  burrowbun: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.3, P.main, [0, 0.3, -0.05], [1, 0.92, 1.1]));
    b.add(k.ball(0.24, P.main, [0, 0.56, 0.2]));
    k.eye(b, 0.1, 0.6, 0.38, 0.055);
    k.eye(b, -0.1, 0.6, 0.38, 0.055);
    b.add(k.ball(0.035, P.second, [0, 0.53, 0.44]));
    for (const s of [1, -1]) {
      const ear = pivot(0.09 * s, 0.74, 0.16, k.ball(0.08, P.main, [0, 0.2, 0], [1, 3, 0.55]));
      ear.rotation.z = -0.18 * s;
      ear.add(k.ball(0.05, P.second, [0, 0.2, 0.03], [1, 3, 0.4]));
      b.add(ear);
      m.wings.push(ear);
      b.add(k.ball(0.08, P.main, [0.14 * s, 0.07, 0.2], [1, 0.6, 1.4]));
    }
    b.add(k.ball(0.1, '#ffffff', [0, 0.32, -0.36]));
    // the flower it found
    const flower = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      flower.add(k.ball(0.045, P.second, [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05]));
    }
    flower.add(k.ball(0.035, P.accent, [0, 0.01, 0]));
    flower.position.set(0.16, 0.9, 0.16);
    flower.rotation.x = 1.2;
    b.add(flower);
    m.height = 1.1;
  },

  capling: (k, P, m) => {
    const b = m.body;
    b.add(k.mesh(G.cyl, P.belly, [0.2, 0.36, 0.2], [0, 0.2, 0]));
    const cap = k.mesh(G.hemi, P.main, [0.4, 0.32, 0.4], [0, 0.34, 0]);
    b.add(cap);
    const spots: [number, number][] = [[0.18, 0.1], [-0.15, 0.16], [0.02, -0.2], [-0.2, -0.1], [0.12, -0.12], [0, 0.04]];
    for (const [x, z] of spots) {
      const y = 0.34 + Math.sqrt(Math.max(0, 1 - (x * x + z * z) / 0.16)) * 0.3;
      b.add(k.ball(0.05, P.second, [x, y, z], [1, 0.4, 1]));
    }
    k.eye(b, 0.07, 0.24, 0.17, 0.045);
    k.eye(b, -0.07, 0.24, 0.17, 0.045);
    for (const s of [1, -1]) {
      const foot = pivot(0.09 * s, 0.03, 0.04, k.ball(0.06, P.belly, [0, 0, 0], [1, 0.6, 1.3]));
      b.add(foot);
      m.legs.push(foot);
    }
    const glow = glowSprite('#ffe9c4', 1.2, 0);
    glow.position.set(0, 0.5, 0);
    b.add(glow);
    m.glows.push(glow);
    m.height = 0.8;
  },

  fernkit: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.26, P.main, [0, 0.36, -0.02], [0.85, 0.82, 1.35]));
    b.add(k.ball(0.18, P.belly, [0, 0.31, 0.06], [0.8, 0.7, 1.2]));
    b.add(k.ball(0.22, P.main, [0, 0.58, 0.32]));
    b.add(k.ball(0.1, P.belly, [0, 0.52, 0.5], [1, 0.8, 1.2]));
    b.add(k.ball(0.035, P.accent, [0, 0.55, 0.61]));
    k.eye(b, 0.09, 0.64, 0.48, 0.05);
    k.eye(b, -0.09, 0.64, 0.48, 0.05);
    for (const s of [1, -1]) {
      const ear = k.mesh(G.cone, P.main, [0.08, 0.2, 0.06], [0.11 * s, 0.82, 0.3]);
      ear.rotation.z = -0.25 * s;
      b.add(ear);
      for (const z of [0.18, -0.2]) {
        const leg = pivot(0.11 * s, 0.22, z, k.mesh(G.cyl, P.accent, [0.045, 0.24, 0.045], [0, -0.1, 0]));
        b.add(leg);
        m.legs.push(leg);
      }
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.42, -0.3);
    tail.add(k.ball(0.15, P.main, [0, 0.16, -0.12], [1, 1.4, 1]));
    tail.add(k.ball(0.1, P.second, [0, 0.38, -0.18], [1, 1.2, 0.9], P.second));
    tail.rotation.x = -0.5;
    b.add(tail);
    m.tail = tail;
    const glow = glowSprite(P.second, 0.9, 0);
    glow.position.set(0, 0.8, -0.5);
    b.add(glow);
    m.glows.push(glow);
    m.height = 1.0;
  },

  lumewisp: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.2, P.accent, [0, 0, 0], [1, 1, 1], P.second));
    const shell = new THREE.Mesh(G.sphere, new THREE.MeshToonMaterial({ color: P.main, transparent: true, opacity: 0.45, emissive: P.second, emissiveIntensity: 0.5 }));
    shell.scale.set(0.32, 0.36, 0.32);
    b.add(shell);
    const tail = k.mesh(G.cone, P.main, [0.2, 0.5, 0.2], [0, -0.32, -0.12], P.second);
    tail.rotation.x = Math.PI + 0.5;
    b.add(tail);
    m.tail = tail;
    k.eye(b, 0.08, 0.04, 0.2, 0.04);
    k.eye(b, -0.08, 0.04, 0.2, 0.04);
    const glow = glowSprite(P.second, 1.6, 0.75);
    b.add(glow);
    m.glows.push(glow);
    m.height = 0.6;
  },

  nimbuwhale: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.42, P.main, [0, 0, 0], [0.9, 0.78, 1.5]));
    b.add(k.ball(0.36, P.second, [0, -0.12, 0.05], [0.8, 0.5, 1.4]));
    k.eye(b, 0.27, 0.06, 0.42, 0.06, new THREE.Vector3(0.6, 0, 0.8));
    k.eye(b, -0.27, 0.06, 0.42, 0.06, new THREE.Vector3(-0.6, 0, 0.8));
    const tail = new THREE.Group();
    tail.position.set(0, 0.04, -0.6);
    for (const s of [1, -1]) {
      const fluke = k.ball(0.16, P.main, [0.13 * s, 0.05, -0.12], [1.3, 0.25, 0.8]);
      fluke.rotation.y = 0.5 * s;
      tail.add(fluke);
    }
    b.add(tail);
    m.tail = tail;
    for (const s of [1, -1]) {
      const fin = pivot(0.34 * s, -0.12, 0.12, k.ball(0.14, P.main, [0.08 * s, 0, 0], [1.2, 0.25, 0.7]));
      b.add(fin);
      m.wings.push(fin);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const puff = k.ball(0.13 + (i % 2) * 0.05, '#ffffff', [Math.cos(a) * 0.32, -0.4, Math.sin(a) * 0.45]);
      puff.castShadow = false;
      b.add(puff);
    }
    m.height = 0.8;
  },
};

function frog(k: Kit, P: Palette, m: Parameters<Builder>[2], lily: boolean) {
  const b = m.body;
  b.add(k.ball(0.42, P.main, [0, 0.32, 0], [1.12, 0.78, 1.05]));
  b.add(k.ball(0.36, P.belly, [0, 0.25, 0.12], [0.95, 0.62, 0.85]));
  for (const s of [1, -1]) {
    b.add(k.ball(0.15, P.main, [0.19 * s, 0.6, 0.16]));
    k.eye(b, 0.2 * s, 0.66, 0.25, 0.085);
    b.add(k.ball(0.06, P.accent, [0.3 * s, 0.38, 0.33], [1, 0.6, 0.4]));
    const thigh = pivot(0.33 * s, 0.18, -0.12, k.ball(0.17, P.main, [0, 0, 0], [0.9, 0.7, 1.4]));
    b.add(thigh);
    m.legs.push(thigh);
    b.add(k.ball(0.08, P.main, [0.2 * s, 0.05, 0.32], [1, 0.5, 1.3]));
  }
  if (!lily) {
    for (const [x, z, r] of [[0, -0.05, 0.12], [0.12, -0.12, 0.08], [-0.1, -0.15, 0.09]] as const) {
      b.add(k.ball(r, P.second, [x, 0.6, z], [1, 0.6, 1]));
    }
    const sprout = k.ball(0.07, '#9be06a', [0.02, 0.72, -0.08], [0.5, 0.15, 1]);
    sprout.rotation.z = 0.5;
    b.add(sprout);
  } else {
    b.add(k.mesh(G.cyl, P.second, [0.34, 0.02, 0.34], [0, 0.74, -0.02]));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = k.ball(0.07, '#ffffff', [Math.cos(a) * 0.07, 0.8, -0.02 + Math.sin(a) * 0.07], [0.6, 1, 1.2]);
      petal.rotation.y = -a;
      b.add(petal);
    }
    b.add(k.ball(0.04, P.accent, [0, 0.83, -0.02]));
  }
  m.height = 0.95;
}

function turtle(k: Kit, P: Palette, m: Parameters<Builder>[2], shrooms: boolean) {
  const b = m.body;
  b.add(k.mesh(G.hemi, P.second, [0.5, 0.42, 0.56], [0, 0.18, 0]));
  b.add(k.mesh(G.cyl, P.belly, [0.48, 0.06, 0.52], [0, 0.18, 0]));
  const head = pivot(0, 0.28, 0.5, k.ball(0.17, P.main, [0, 0, 0.05], [1, 0.9, 1.1]));
  k.eye(head, 0.08, 0.06, 0.17, 0.05);
  k.eye(head, -0.08, 0.06, 0.17, 0.05);
  b.add(head);
  m.wings.push(head); // used as "look" part
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const leg = pivot(0.34 * sx, 0.12, 0.3 * sz, k.ball(0.1, P.main, [0, -0.04, 0], [1, 0.9, 1.2]));
      b.add(leg);
      m.legs.push(leg);
    }
  }
  if (!shrooms) {
    for (const [x, z, s] of [[0, 0, 0.12], [0.2, 0.12, 0.08], [-0.2, -0.05, 0.09], [0.08, -0.25, 0.07], [-0.12, 0.22, 0.07]] as const) {
      const y = 0.18 + Math.sqrt(Math.max(0, 1 - (x * x) / 0.25 - (z * z) / 0.31)) * 0.42;
      b.add(k.mesh(G.rock, P.accent, [s, s * 0.7, s], [x, y, z]));
    }
  } else {
    for (const [x, z, s] of [[0, 0, 1.2], [0.2, 0.15, 0.8], [-0.18, -0.12, 0.9], [0.1, -0.24, 0.7]] as const) {
      const y = 0.18 + Math.sqrt(Math.max(0, 1 - (x * x) / 0.25 - (z * z) / 0.31)) * 0.42;
      b.add(k.mesh(G.cyl, P.belly, [0.03 * s, 0.14 * s, 0.03 * s], [x, y + 0.05 * s, z]));
      b.add(k.mesh(G.hemi, P.accent, [0.1 * s, 0.08 * s, 0.1 * s], [x, y + 0.11 * s, z]));
    }
  }
  m.height = 0.85;
}

function moth(k: Kit, P: Palette, m: Parameters<Builder>[2], kind: 'petal' | 'dusk' | 'moon') {
  const b = m.body;
  const big = kind !== 'petal';
  b.add(k.ball(0.11, kind === 'petal' ? P.belly : P.main, [0, 0, 0], [1, 1, 2.2]));
  b.add(k.ball(0.1, kind === 'petal' ? P.belly : P.main, [0, 0.03, 0.22]));
  k.eye(b, 0.06, 0.06, 0.29, 0.035);
  k.eye(b, -0.06, 0.06, 0.29, 0.035);
  for (const s of [1, -1]) {
    const ant = k.mesh(G.cyl, kind === 'petal' ? P.belly : P.second, [0.01, 0.2, 0.01], [0.04 * s, 0.17, 0.3]);
    ant.rotation.set(0.5, 0, -0.4 * s);
    b.add(ant);
    const tip = big ? k.mesh(G.cone, P.second, [0.04, 0.08, 0.02], [0.09 * s, 0.26, 0.36]) : k.ball(0.025, P.second, [0.09 * s, 0.26, 0.36]);
    b.add(tip);
    const wing = new THREE.Group();
    wing.position.set(0.06 * s, 0.03, 0.02);
    const span = big ? 0.42 : 0.32;
    const front = k.ball(span, P.main, [span * 0.9 * s, 0, 0.1], [1, 0.05, 0.72]);
    front.rotation.y = 0.35 * s;
    const back = k.ball(span * 0.72, kind === 'petal' ? P.second : P.second, [span * 0.65 * s, -0.01, -0.2], [1, 0.05, 0.75]);
    back.rotation.y = -0.4 * s;
    wing.add(front, back);
    if (kind === 'dusk') {
      wing.add(k.ball(0.08, P.accent, [span * 0.95 * s, 0.025, 0.1], [1, 0.05, 1]));
      wing.add(k.ball(0.04, '#1a1420', [span * 0.95 * s, 0.03, 0.1], [1, 0.05, 1]));
    }
    if (kind === 'moon') {
      const c = k.mesh(G.torus, P.accent, [0.1, 0.1, 0.1], [span * 0.95 * s, 0.03, 0.1], P.accent);
      c.rotation.x = Math.PI / 2;
      wing.add(c);
    }
    b.add(wing);
    m.wings.push(wing);
  }
  if (big) {
    const glow = glowSprite(kind === 'moon' ? '#cfe0ff' : P.belly, kind === 'moon' ? 1.6 : 1, 0);
    b.add(glow);
    m.glows.push(glow);
  }
  m.height = 0.6;
}

function fish(k: Kit, P: Palette, m: Parameters<Builder>[2], koi: boolean) {
  const b = m.body;
  b.add(k.ball(0.28, P.main, [0, 0.1, 0], [0.7, 0.8, 1.3]));
  b.add(k.ball(0.22, P.belly, [0, 0.03, 0.04], [0.62, 0.55, 1.15]));
  k.eye(b, 0.16, 0.17, 0.2, 0.06, new THREE.Vector3(1, 0, 0.4));
  k.eye(b, -0.16, 0.17, 0.2, 0.06, new THREE.Vector3(-1, 0, 0.4));
  const tail = new THREE.Group();
  tail.position.set(0, 0.1, -0.34);
  const fin = k.mesh(G.cone, P.second, [0.2, koi ? 0.5 : 0.32, 0.05], [0, 0, -0.14]);
  fin.rotation.x = -Math.PI / 2;
  tail.add(fin);
  b.add(tail);
  m.tail = tail;
  const dorsal = k.mesh(G.cone, P.second, [0.06, 0.22, 0.14], [0, 0.36, -0.02]);
  dorsal.rotation.x = -0.4;
  b.add(dorsal);
  if (koi) {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      b.add(k.ball(0.025, P.accent, [Math.cos(a) * 0.19, 0.18 + Math.sin(i) * 0.08, Math.sin(a) * 0.3], [1, 1, 1], P.accent));
    }
    for (const s of [1, -1]) {
      const long = k.ball(0.18, P.second, [0.18 * s, -0.02, -0.05], [0.9, 0.08, 1.4]);
      long.rotation.z = 0.5 * s;
      b.add(long);
    }
  }
  m.height = 0.5;
}

function bird(k: Kit, P: Palette, m: Parameters<Builder>[2], thunder: boolean) {
  const b = m.body;
  b.add(k.ball(0.33, P.main, [0, 0.38, 0]));
  b.add(k.ball(0.25, P.belly, [0, 0.33, 0.12], [1, 0.95, 0.9]));
  k.eye(b, 0.12, 0.5, 0.25, 0.06);
  k.eye(b, -0.12, 0.5, 0.25, 0.06);
  const beak = k.mesh(G.cone, P.accent, [0.06, 0.12, 0.06], [0, 0.44, 0.35]);
  beak.rotation.x = Math.PI / 2;
  b.add(beak);
  for (const s of [1, -1]) {
    const wing = pivot(0.29 * s, 0.42, -0.02, k.ball(0.16, P.second, [0.03 * s, -0.04, 0], [0.4, 0.85, 1.1]));
    b.add(wing);
    m.wings.push(wing);
    const leg = pivot(0.1 * s, 0.1, 0.02, k.mesh(G.cyl, P.accent, [0.02, 0.14, 0.02], [0, -0.03, 0]));
    b.add(leg);
    m.legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.28);
  for (const s of [1, 0, -1]) {
    const f = k.ball(0.07, P.second, [0.05 * s, 0.1, -0.06], [0.6, 1.8, 0.35]);
    f.rotation.set(-0.7, 0, -0.3 * s);
    tail.add(f);
  }
  b.add(tail);
  m.tail = tail;
  if (thunder) {
    for (let i = 0; i < 3; i++) {
      const spike = k.mesh(G.cone, P.accent, [0.05, 0.18, 0.05], [0, 0.72 + i * 0.02, 0.12 - i * 0.1], P.accent);
      spike.rotation.x = -0.4 - i * 0.25;
      b.add(spike);
    }
  } else {
    const tuft = k.ball(0.05, P.main, [0, 0.74, 0.05], [0.6, 1.6, 0.6]);
    tuft.rotation.x = -0.4;
    b.add(tuft);
  }
  m.height = 0.85;
}

// ---------------------------------------------------------------- mutation overlays

function mutatePalette(P: Palette, muts: MutationId[], seed: number): Palette {
  const out = { ...P };
  const jitter = ((seed % 1000) / 1000 - 0.5) * 0.06;
  const shift = (hex: string, dh: number, ds = 0, dl = 0) => {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL((hsl.h + dh + 1) % 1, Math.min(1, Math.max(0, hsl.s + ds)), Math.min(1, Math.max(0, hsl.l + dl)));
    return `#${c.getHexString()}`;
  };
  out.main = shift(out.main, jitter);
  if (muts.includes('lunar')) {
    const mix = (hex: string, to: string, t: number) => `#${new THREE.Color(hex).lerp(new THREE.Color(to), t).getHexString()}`;
    out.main = mix(out.main, '#c7cfff', 0.55);
    out.second = mix(out.second, '#7f86d6', 0.5);
    out.belly = mix(out.belly, '#eef0ff', 0.5);
  }
  if (muts.includes('storm')) {
    out.second = '#ffd23d';
    out.accent = '#fff27a';
  }
  const mix = (hex: string, to: string, t: number) => `#${new THREE.Color(hex).lerp(new THREE.Color(to), t).getHexString()}`;
  if (muts.includes('frost')) {
    out.main = mix(out.main, '#cdeeff', 0.55);
    out.second = mix(out.second, '#8fd0ff', 0.45);
    out.belly = mix(out.belly, '#ffffff', 0.6);
  }
  if (muts.includes('starlit')) {
    out.main = mix(out.main, '#3b3f9a', 0.45);
    out.second = mix(out.second, '#2a2c70', 0.4);
  }
  return out;
}

const tmpColor = new THREE.Color();

export function buildCreature(speciesId: SpeciesId, mutations: MutationId[], seed: number): CreatureModel {
  const sp = speciesDef(speciesId);
  const muts = visibleMutations({ species: speciesId, mutations });
  const k = new Kit();
  const P = mutatePalette(PALETTES[speciesId] ?? PALETTES.mossfrog, muts, seed);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const m: CreatureModel = {
    root, body, wings: [], legs: [], segments: [], glows: [], materials: k.mats, height: 0.8,
    movement: sp.movement, baseScale: 1,
  };
  (BUILDERS[speciesId] ?? BUILDERS.mossfrog)(k, P, m);

  if (muts.includes('lunar') || speciesId === 'moonmoth') {
    const crescent = k.mesh(G.torus, '#eef2ff', [0.1, 0.1, 0.1], [0, m.height + 0.08, 0], '#b9c6ff');
    crescent.rotation.z = 0.6;
    body.add(crescent);
    const halo = glowSprite('#b9c6ff', 1.8, 0);
    halo.position.y = m.height * 0.5;
    body.add(halo);
    m.glows.push(halo);
    for (const mat of k.mats) {
      if (mat.emissiveIntensity === 1 && mat.emissive.getHex() === 0) {
        mat.emissive = tmpColor.set('#3a3f7a').clone();
        mat.emissiveIntensity = 0.25;
      }
    }
  }
  if (muts.includes('storm') || speciesId === 'thunderwren' || speciesId === 'nimbuwhale') {
    const sparks = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const s = k.mesh(G.tetra, '#fff27a', [0.05, 0.05, 0.05], [0, 0, 0], '#ffe14d');
      s.castShadow = false;
      s.userData.noOutline = true;
      sparks.add(s);
    }
    sparks.position.y = m.height * 0.55;
    body.add(sparks);
    m.sparks = sparks;
  }
  if (muts.includes('starlit')) {
    const tw = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996;
      const y = m.height * (0.25 + (i % 4) * 0.15);
      const r = 0.22 + (i % 3) * 0.06;
      const s = k.mesh(G.lowSphere, '#fff6c0', [0.035, 0.035, 0.035], [Math.cos(a) * r, y, Math.sin(a) * r], '#ffe98a');
      s.castShadow = false;
      s.userData.noOutline = true;
      tw.add(s);
    }
    body.add(tw);
    m.twinkles = tw;
    const glow = glowSprite('#c9c4ff', 1.5, 0.5);
    glow.position.y = m.height * 0.5;
    body.add(glow);
    m.glows.push(glow);
  }
  if (muts.includes('frost')) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = k.mesh(G.cone, '#f4fbff', [0.035, 0.14, 0.035], [Math.cos(a) * 0.14, m.height * 0.9, Math.sin(a) * 0.14], '#bfe8ff');
      spike.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      body.add(spike);
    }
    const chill = glowSprite('#bfe8ff', 1.4, 0.35);
    chill.position.y = m.height * 0.4;
    body.add(chill);
    m.glows.push(chill);
  }
  addOutlines(body, 2.6);
  const size = 0.94 + ((seed >>> 3) % 100) / 100 * 0.12;
  m.baseScale = size * (muts.includes('giant') ? 1.6 : 1) * (sp.rarity === 'legendary' ? 1.2 : 1);
  root.scale.setScalar(m.baseScale);
  root.userData.prismatic = muts.includes('prismatic');
  return m;
}

/** Hue-cycle every material for Prismatic creatures. */
export function animatePrismatic(model: CreatureModel, t: number): void {
  model.materials.forEach((mat, i) => {
    if (!mat.userData.baseHsl) {
      const hsl = { h: 0, s: 0, l: 0 };
      mat.color.getHSL(hsl);
      mat.userData.baseHsl = hsl;
    }
    const b = mat.userData.baseHsl as { h: number; s: number; l: number };
    mat.color.setHSL((b.h + t * 0.15 + i * 0.07) % 1, Math.max(0.55, b.s), Math.min(0.7, Math.max(0.45, b.l)));
  });
}

export function disposeCreature(model: CreatureModel): void {
  for (const m of model.materials) m.dispose();
  model.root.traverse((o) => {
    if (o instanceof THREE.Sprite) o.material.dispose();
  });
}
