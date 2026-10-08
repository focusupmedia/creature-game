import * as THREE from 'three';
import { SHADES, type ShadeId } from '../content/shades';
import { species as speciesDef } from '../content/species';
import { MUTATIONS } from '../content/world';
import { glowLevel, rarestMutation, visibleMutations } from '../core/creatures';
import type { MutationId, Movement, SpeciesId } from '../core/types';
import { addOutlines, glowOutlineMaterial, glowSprite, uniqueToon } from './materials';

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
  /** The species' own body materials (the first N of `materials`); Prismatic recolors only these. */
  bodyMats: number;
  /** Rare-mutation glow: colored rim, aura and (epic+) orbiting sparkles. */
  aura?: Aura;
  height: number;
  movement: Movement;
  baseScale: number;
}

interface Palette { main: string; second: string; accent: string; belly: string }

interface Aura {
  level: number;
  color: THREE.Color;
  prismatic: boolean;
  outline: THREE.ShaderMaterial;
  sprite: THREE.Sprite;
  /** Body materials that glow softly with the rim. */
  mats: THREE.MeshToonMaterial[];
  orbit?: THREE.Group;
}

const PALETTES: Record<string, Palette> = {
  sunscale: { main: '#ffc83d', second: '#4fb34a', accent: '#ff7a2a', belly: '#fff2b8' },
  cinderskink: { main: '#3a2e34', second: '#ff7a2a', accent: '#ffd23d', belly: '#5a4448' },
  emberdrake: { main: '#e2483e', second: '#ffc83d', accent: '#ffe14d', belly: '#ffd8a0' },
  starwyrm: { main: '#2a2f8a', second: '#7c4dff', accent: '#fff1a8', belly: '#6a7ad8' },
  coralpuff: { main: '#ff9f4a', second: '#ffffff', accent: '#ff5f7a', belly: '#fff0d6' },
  driftjelly: { main: '#c9a6ff', second: '#7fe8ff', accent: '#ffffff', belly: '#efe0ff' },
  axolotl: { main: '#ffb3d0', second: '#ff5f9a', accent: '#ff7ab0', belly: '#ffe0ec' },
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
  // shared by every creature that needs them (never disposed)
  halo: new THREE.TorusGeometry(1, 0.13, 6, 24),
  ribbon: new THREE.TorusGeometry(1, 0.06, 4, 20, Math.PI),
  swirl: new THREE.TorusGeometry(1, 0.05, 4, 24, Math.PI * 1.3),
  octa: new THREE.OctahedronGeometry(1, 0),
  smile: new THREE.TorusGeometry(0.11, 0.022, 6, 16, Math.PI),
  tetra: new THREE.TetrahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
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
  sunscale: (k, P, m) => lizard(k, P, m, 'sun'),
  cinderskink: (k, P, m) => lizard(k, P, m, 'cinder'),
  emberdrake: (k, P, m) => dragon(k, P, m, false),
  starwyrm: (k, P, m) => dragon(k, P, m, true),

  coralpuff: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.3, P.main, [0, 0.12, 0], [1, 0.95, 1.05]));
    b.add(k.ball(0.22, P.belly, [0, 0.04, 0.08], [0.95, 0.7, 0.9]));
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996;
      const y = Math.cos(i * 1.3) * 0.8;
      const r = Math.sqrt(1 - y * y);
      const spike = k.mesh(G.cone, P.second, [0.03, 0.09, 0.03], [Math.cos(a) * r * 0.3, 0.12 + y * 0.28, Math.sin(a) * r * 0.3]);
      spike.lookAt(new THREE.Vector3(Math.cos(a) * r * 2, 0.12 + y * 2, Math.sin(a) * r * 2));
      spike.rotateX(Math.PI / 2);
      spike.userData.noOutline = true;
      b.add(spike);
    }
    k.eye(b, 0.13, 0.2, 0.22, 0.075, new THREE.Vector3(0.4, 0, 0.9));
    k.eye(b, -0.13, 0.2, 0.22, 0.075, new THREE.Vector3(-0.4, 0, 0.9));
    b.add(k.ball(0.04, P.accent, [0, 0.08, 0.31], [1.4, 0.8, 0.6]));
    const tail = new THREE.Group();
    tail.position.set(0, 0.12, -0.3);
    const fin = k.ball(0.11, P.accent, [0, 0, -0.06], [0.3, 1, 0.9]);
    tail.add(fin);
    b.add(tail);
    m.tail = tail;
    for (const s of [1, -1]) {
      const f = pivot(0.28 * s, 0.1, 0.02, k.ball(0.07, P.accent, [0.04 * s, 0, 0], [1, 0.3, 0.8]));
      b.add(f);
      m.wings.push(f);
    }
    m.height = 0.55;
  },

  driftjelly: (k, P, m) => {
    const b = m.body;
    const domeMat = new THREE.MeshToonMaterial({ color: P.main, transparent: true, opacity: 0.85, emissive: P.second, emissiveIntensity: 0.35 });
    k.mats.push(domeMat);
    const dome = new THREE.Mesh(G.hemi, domeMat);
    dome.scale.set(0.34, 0.3, 0.34);
    dome.position.y = 0.1;
    b.add(dome);
    k.mats.push(domeMat);
    b.add(k.ball(0.18, P.belly, [0, 0.12, 0], [1, 0.4, 1], P.second));
    k.eye(b, 0.09, 0.2, 0.27, 0.045);
    k.eye(b, -0.09, 0.2, 0.27, 0.045);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const tent = pivot(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2, k.mesh(G.cyl, P.second, [0.025, 0.42, 0.025], [0, -0.21, 0], P.second));
      b.add(tent);
      m.legs.push(tent);
    }
    const glow = glowSprite(P.second, 1.4, 0.6);
    glow.position.y = 0.1;
    b.add(glow);
    m.glows.push(glow);
    m.height = 0.55;
  },

  axolotl: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.26, P.main, [0, 0.24, -0.12], [0.9, 0.7, 1.35]));
    b.add(k.ball(0.2, P.belly, [0, 0.18, -0.08], [0.8, 0.55, 1.2]));
    const head = new THREE.Group();
    head.position.set(0, 0.33, 0.22);
    head.add(k.ball(0.26, P.main, [0, 0, 0], [1.3, 0.8, 1]));
    k.eye(head, 0.15, 0.1, 0.19, 0.065, new THREE.Vector3(0.2, 0.1, 1));
    k.eye(head, -0.15, 0.1, 0.19, 0.065, new THREE.Vector3(-0.2, 0.1, 1));
    // the smile
    const smile = new THREE.Mesh(G.smile, k.mat('#7a2a4a'));
    smile.position.set(0, -0.05, 0.25);
    smile.rotation.set(0, 0, Math.PI);
    smile.userData.noOutline = true;
    head.add(smile);
    for (const s of [1, -1]) {
      head.add(k.ball(0.045, '#ff8fb8', [0.2 * s, -0.04, 0.17], [1, 0.6, 0.5]));
      // three big feathery gill fronds on each side, fanned out like a crown
      for (let i = 0; i < 3; i++) {
        const frond = pivot(0.25 * s, 0.12 - i * 0.09, -0.06, k.ball(0.1, P.second, [0.17 * s, 0, 0], [2, 0.42, 0.55]));
        frond.rotation.z = s * (0.85 - i * 0.6);
        for (let j = 0; j < 3; j++) {
          const nub = k.ball(0.035, P.accent, [(0.1 + j * 0.08) * s, 0.04, 0], [1, 1, 1]);
          nub.userData.noOutline = true;
          frond.add(nub);
        }
        head.add(frond);
        m.wings.push(frond);
      }
    }
    b.add(head);
    for (const sx of [1, -1]) {
      for (const sz of [0.12, -0.32]) {
        const leg = pivot(0.2 * sx, 0.1, sz, k.ball(0.06, P.main, [0.02 * sx, -0.04, 0], [1, 0.7, 1.4]));
        b.add(leg);
        m.legs.push(leg);
      }
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.24, -0.42);
    tail.add(k.ball(0.18, P.main, [0, 0, -0.16], [0.35, 0.7, 1.3]));
    tail.add(k.ball(0.16, P.second, [0, 0.04, -0.2], [0.12, 0.85, 1.25]));
    b.add(tail);
    m.tail = tail;
    const glow = glowSprite('#ffc8e0', 1.2, 0.25);
    glow.position.y = 0.4;
    b.add(glow);
    m.glows.push(glow);
    m.height = 0.75;
  },

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
    const bunHead = k.ball(0.24, P.main, [0, 0.56, 0.2]);
    bunHead.userData.head = true;
    b.add(bunHead);
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
    const shellMat = new THREE.MeshToonMaterial({ color: P.main, transparent: true, opacity: 0.45, emissive: P.second, emissiveIntensity: 0.5 });
    k.mats.push(shellMat);
    const shell = new THREE.Mesh(G.sphere, shellMat);
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

function lizard(k: Kit, P: Palette, m: Parameters<Builder>[2], kind: 'sun' | 'cinder') {
  const b = m.body;
  b.add(k.ball(0.24, P.main, [0, 0.18, -0.02], [0.85, 0.55, 1.5]));
  if (kind === 'sun') {
    for (const z of [0.15, -0.05, -0.25]) b.add(k.ball(0.07, P.second, [0, 0.29, z], [1.4, 0.4, 0.6]));
  } else {
    for (let i = 0; i < 7; i++) {
      const glowSpot = k.ball(0.035, P.second, [Math.sin(i * 2.3) * 0.14, 0.27, 0.25 - i * 0.08], [1, 0.5, 1], P.second);
      glowSpot.userData.noOutline = true;
      b.add(glowSpot);
    }
    const glow = glowSprite('#ff8a3a', 1.3, 0.45);
    glow.position.y = 0.2;
    b.add(glow);
    m.glows.push(glow);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.24, 0.36);
  head.add(k.ball(0.15, P.main, [0, 0, 0.04], [1, 0.75, 1.3]));
  k.eye(head, 0.1, 0.06, 0.06, 0.05, new THREE.Vector3(0.7, 0, 0.7));
  k.eye(head, -0.1, 0.06, 0.06, 0.05, new THREE.Vector3(-0.7, 0, 0.7));
  if (kind === 'sun') {
    // the frill: folded normally, pops open when excited (animated through wings[])
    const frill = pivot(0, 0.02, -0.08, k.ball(0.22, P.accent, [0, 0, 0], [1.25, 1, 0.12]));
    frill.scale.setScalar(0.45);
    head.add(frill);
    m.wings.push(frill);
  }
  b.add(head);
  const tail = new THREE.Group();
  tail.position.set(0, 0.16, -0.36);
  const t1 = k.mesh(G.cone, P.main, [0.11, 0.55, 0.08], [0, 0, -0.26]);
  t1.rotation.x = -Math.PI / 2;
  tail.add(t1);
  b.add(tail);
  m.tail = tail;
  for (const sx of [1, -1]) {
    for (const sz of [0.18, -0.2]) {
      const leg = pivot(0.18 * sx, 0.12, sz, k.ball(0.055, P.main, [0.08 * sx, -0.06, 0], [1.6, 0.6, 0.8]));
      b.add(leg);
      m.legs.push(leg);
    }
  }
  m.height = 0.55;
}

function dragon(k: Kit, P: Palette, m: Parameters<Builder>[2], star: boolean) {
  const b = m.body;
  b.add(k.ball(0.3, P.main, [0, 0, 0], [0.9, 0.85, 1.15]));
  b.add(k.ball(0.24, P.belly, [0, -0.04, 0.1], [0.8, 0.75, 0.95]));
  const head = new THREE.Group();
  head.position.set(0, 0.26, 0.28);
  head.add(k.ball(0.2, P.main, [0, 0, 0], [1, 0.9, 1.05]));
  head.add(k.ball(0.12, P.main, [0, -0.04, 0.17], [1, 0.75, 1]));
  head.add(k.ball(0.025, '#3a1a1a', [0.05, 0, 0.28]));
  head.add(k.ball(0.025, '#3a1a1a', [-0.05, 0, 0.28]));
  k.eye(head, 0.1, 0.07, 0.13, 0.055);
  k.eye(head, -0.1, 0.07, 0.13, 0.055);
  for (const s of [1, -1]) {
    const horn = k.mesh(G.cone, P.accent, [0.04, 0.16, 0.04], [0.09 * s, 0.2, -0.04]);
    horn.rotation.set(-0.5, 0, -0.25 * s);
    head.add(horn);
  }
  b.add(head);
  for (const s of [1, -1]) {
    const wing = new THREE.Group();
    wing.position.set(0.22 * s, 0.14, -0.04);
    const bone = k.mesh(G.cyl, P.main, [0.025, 0.42, 0.025], [0.2 * s, 0.1, 0]);
    bone.rotation.z = -1.1 * s;
    wing.add(bone);
    const membrane = k.ball(0.3, P.second, [0.26 * s, 0.02, -0.06], [1, 0.06, 0.75]);
    membrane.rotation.z = -0.25 * s;
    wing.add(membrane);
    b.add(wing);
    m.wings.push(wing);
    const leg = pivot(0.14 * s, -0.18, 0.04, k.ball(0.07, P.main, [0, -0.04, 0], [0.9, 1, 1.1]));
    b.add(leg);
    m.legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, -0.02, -0.3);
  const t1 = k.mesh(G.cone, P.main, [0.12, 0.5, 0.1], [0, 0, -0.24]);
  t1.rotation.x = -Math.PI / 2;
  tail.add(t1);
  const tip = k.mesh(G.tetra, P.accent, [0.09, 0.09, 0.09], [0, 0, -0.5]);
  tail.add(tip);
  b.add(tail);
  m.tail = tail;
  for (let i = 0; i < 3; i++) {
    const spike = k.mesh(G.cone, P.accent, [0.04, 0.1, 0.04], [0, 0.26 - i * 0.03, 0.05 - i * 0.16]);
    spike.rotation.x = -0.3;
    b.add(spike);
  }
  if (star) {
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39996;
      const s = k.ball(0.022, P.accent, [Math.cos(a) * 0.26, Math.sin(i * 1.7) * 0.18, Math.sin(a) * 0.3], [1, 1, 1], P.accent);
      s.userData.noOutline = true;
      b.add(s);
    }
    const glow = glowSprite('#b9a6ff', 1.8, 0.5);
    b.add(glow);
    m.glows.push(glow);
  } else {
    const glow = glowSprite('#ffb84d', 1.2, 0.3);
    glow.position.set(0, 0.2, 0.5);
    b.add(glow);
    m.glows.push(glow);
  }
  m.height = 0.7;
}

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
  head.userData.head = true;
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

function mutatePalette(P: Palette, muts: MutationId[], seed: number, shade?: string): Palette {
  const out = { ...P };
  const jitter = ((seed % 1000) / 1000 - 0.5) * 0.06;
  const shift = (hex: string, dh: number, ds = 0, dl = 0) => {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL((hsl.h + dh + 1) % 1, Math.min(1, Math.max(0, hsl.s + ds)), Math.min(1, Math.max(0, hsl.l + dl)));
    return `#${c.getHexString()}`;
  };
  // the pet's own color shade first; mutations tint on top of it below
  const sh = shade ? SHADES[shade as ShadeId] : undefined;
  if (sh && sh.id !== 'classic') {
    const tint = (hex: string, k = sh.amount) => `#${new THREE.Color(hex).lerp(new THREE.Color(sh.tint), k).getHexString()}`;
    if (sh.id === 'shiny') {
      // Shiny: the colors turn right round, with a golden sheen
      out.main = tint(shift(out.main, 0.5, 0.15));
      out.second = tint(shift(out.second, 0.5, 0.15));
      out.accent = shift(out.accent, 0.5, 0.15);
    } else {
      out.main = tint(out.main);
      out.second = tint(out.second, sh.amount * 0.8);
      out.belly = tint(out.belly, sh.amount * 0.5);
      if (sh.id === 'pastel') out.accent = tint(out.accent);
    }
  }
  out.main = shift(out.main, jitter);
  const mix = (hex: string, to: string, t: number) => `#${new THREE.Color(hex).lerp(new THREE.Color(to), t).getHexString()}`;
  // One color mutation tints the whole creature. When several stack, each
  // takes its own part of the body so every one stays visible.
  const colorMuts = muts.filter((m) => m === 'lunar' || m === 'storm' || m === 'frost' || m === 'starlit');
  const solo = colorMuts.length <= 1;
  if (muts.includes('lunar')) {
    out.main = mix(out.main, '#c7cfff', solo ? 0.55 : 0.45);
    if (solo) {
      out.second = mix(out.second, '#7f86d6', 0.5);
      out.belly = mix(out.belly, '#eef0ff', 0.5);
    }
  }
  if (muts.includes('storm')) {
    out.accent = '#fff27a';
    if (solo || (!muts.includes('starlit') && !muts.includes('frost'))) out.second = '#ffd23d';
  }
  if (muts.includes('frost')) {
    out.belly = mix(out.belly, '#ffffff', 0.6);
    if (solo) {
      out.main = mix(out.main, '#cdeeff', 0.55);
      out.second = mix(out.second, '#8fd0ff', 0.45);
    } else {
      out.main = mix(out.main, '#cdeeff', 0.2);
      if (!muts.includes('starlit')) out.second = mix(out.second, '#8fd0ff', 0.5);
    }
  }
  if (muts.includes('starlit')) {
    out.second = mix(out.second, '#2a2c70', solo ? 0.4 : 0.55);
    if (solo) out.main = mix(out.main, '#3b3f9a', 0.45);
  }
  // legendary marks tint gently so the creature stays recognisable
  if (muts.includes('angelic')) {
    out.belly = mix(out.belly, '#ffffff', 0.6);
    out.main = mix(out.main, '#fff6e0', 0.25);
  }
  if (muts.includes('infernal')) {
    out.main = mix(out.main, '#b8382a', 0.35);
    out.accent = '#ffb02a';
  }
  if (muts.includes('abyssal')) {
    out.main = mix(out.main, '#1e3a78', 0.45);
    out.second = mix(out.second, '#1a6a8a', 0.5);
  }
  // aurora: green-to-violet ribbons; misty: soft and pale
  if (muts.includes('aurora')) {
    out.second = mix(out.second, '#3affb0', 0.55);
    out.accent = '#b07aff';
  }
  if (muts.includes('misty')) {
    out.main = mix(out.main, '#e8eef4', 0.35);
    out.belly = mix(out.belly, '#ffffff', 0.4);
  }
  // the newer skies' marks
  if (muts.includes('sunkissed')) {
    out.main = mix(out.main, '#ffc860', 0.35);
    out.accent = '#ff9a2a';
  }
  if (muts.includes('blossom')) out.belly = mix(out.belly, '#ffd0e6', 0.4);
  if (muts.includes('glowing')) out.accent = '#e8ff6a';
  if (muts.includes('breezy')) out.main = mix(out.main, '#e8f6ff', 0.22);
  if (muts.includes('bubbly')) out.second = mix(out.second, '#9ae6ff', 0.4);
  if (muts.includes('cosmic')) {
    out.main = mix(out.main, '#2a2060', 0.55);
    out.second = mix(out.second, '#6a4ad0', 0.5);
  }
  if (muts.includes('crystal')) out.accent = '#bff4ff';
  // Halloween marks
  if (muts.includes('ghostly')) {
    out.main = mix(out.main, '#e8eeff', 0.6);
    out.second = mix(out.second, '#c8d4ff', 0.5);
    out.belly = mix(out.belly, '#ffffff', 0.6);
  }
  if (muts.includes('calcified')) {
    out.main = mix(out.main, '#f4efe0', 0.7);
    out.second = mix(out.second, '#d8d0b8', 0.6);
    out.belly = mix(out.belly, '#fffaf0', 0.5);
  }
  if (muts.includes('mummified')) {
    out.main = mix(out.main, '#e8dcb8', 0.55);
    out.second = mix(out.second, '#c8b890', 0.4);
  }
  if (muts.includes('zombified')) {
    out.main = mix(out.main, '#8fbf6a', 0.5);
    out.second = mix(out.second, '#5a7a4a', 0.45);
    out.belly = mix(out.belly, '#c8e0a8', 0.4);
  }
  if (muts.includes('vampire')) {
    out.main = mix(out.main, '#d8d0e8', 0.25);
    out.accent = '#d8283e';
  }
  if (muts.includes('pumpkin')) out.second = mix(out.second, '#ff8a1a', 0.35);
  // Golden goes last: it gilds everything
  if (muts.includes('golden')) {
    out.main = mix(out.main, '#ffd23d', 0.6);
    out.second = mix(out.second, '#e8a020', 0.5);
    out.belly = mix(out.belly, '#fff2b0', 0.5);
  }
  return out;
}

const tmpColor = new THREE.Color();

interface Anchors {
  /** Top of the head (body space). */
  head: THREE.Vector3;
  headW: number;
  /** Top of the back, a little behind the middle. */
  back: THREE.Vector3;
  /** Half the body's width, and a size factor (1 = a typical small creature). */
  halfW: number;
  scale: number;
  /** Rear of the body. */
  tailZ: number;
  /** Middle of everything, for glows. */
  center: THREE.Vector3;
  /** Height of the body's surface straight down at (x, z), so things sit on it, not inside it. */
  top: (x: number, z: number) => number;
  /** The part that is the head, when it moves on its own (a serpent's front, a turtle's head). */
  headObj: THREE.Object3D | null;
}

/**
 * Measure a freshly built body: the head is the highest part (or the front
 * segment of a serpent), the back is the top of the biggest part. Flapping
 * wings, tails and glows are left out so they don't throw the measurement off.
 */
function anchors(m: Omit<CreatureModel, 'root' | 'materials' | 'movement' | 'baseScale'>): Anchors {
  const skip = new Set<THREE.Object3D>([...m.wings, ...(m.tail ? [m.tail] : [])]);
  const boxes: { box: THREE.Box3; seg0: boolean }[] = [];
  const meshes: THREE.Mesh[] = [];
  let headObj: THREE.Object3D | null = m.segments[0] ?? null;
  m.body.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(m.body.matrixWorld).invert();
  // a part the builder marked as the head counts even if it also turns to look around
  const walk = (o: THREE.Object3D, seg0: boolean) => {
    if (o instanceof THREE.Sprite) return;
    if (skip.has(o) && !o.userData.head && !o.userData.measure) return;
    // only a group can carry worn things (a scaled mesh would shrink them)
    if (o.userData.head && !(o instanceof THREE.Mesh)) headObj ??= o;
    const isSeg0 = seg0 || o === m.segments[0] || !!o.userData.head;
    if (o instanceof THREE.Mesh && o.geometry) {
      meshes.push(o);
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const box = o.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      boxes.push({ box, seg0: isSeg0 });
    }
    for (const c of o.children) walk(c, isSeg0);
  };
  for (const c of m.body.children) walk(c, false);
  if (!boxes.length) return { head: new THREE.Vector3(0, m.height, 0), headW: 0.3, back: new THREE.Vector3(0, m.height * 0.7, -0.1), halfW: 0.25, scale: 1, tailZ: -0.3, center: new THREE.Vector3(0, m.height * 0.5, 0), top: () => m.height * 0.7, headObj: null };
  const all = new THREE.Box3();
  for (const b of boxes) all.union(b.box);
  const H = all.max.y - all.min.y;
  // the head: the front serpent segment, else everything near the very top
  let headParts = boxes.filter((b) => b.seg0);
  if (!headParts.length) headParts = boxes.filter((b) => b.box.max.y >= all.max.y - Math.max(0.08, H * 0.18));
  const hb = new THREE.Box3();
  for (const b of headParts) hb.union(b.box);
  const hc = hb.getCenter(new THREE.Vector3());
  // the torso: the biggest single part
  let torso = boxes[0].box;
  const vol = (b: THREE.Box3) => { const v = b.getSize(new THREE.Vector3()); return v.x * v.y * v.z; };
  for (const b of boxes) if (vol(b.box) > vol(torso)) torso = b.box;
  const ts = torso.getSize(new THREE.Vector3());
  const tc = torso.getCenter(new THREE.Vector3());
  // drop a ray straight down onto the body (head parts left out, so the back is the back)
  const explicitHead = boxes.some((b) => b.seg0);
  const bodyMeshes = explicitHead ? meshes.filter((_, i) => !boxes[i].seg0) : meshes;
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const fallback = torso.max.y - ts.y * 0.12;
  const top = (x: number, z: number): number => {
    ray.set(new THREE.Vector3(x, all.max.y + 1, z).applyMatrix4(m.body.matrixWorld), down);
    const hit = ray.intersectObjects(bodyMeshes, false)[0];
    return hit ? m.body.worldToLocal(hit.point.clone()).y : fallback;
  };
  const backZ = tc.z - ts.z * 0.18;
  return {
    head: new THREE.Vector3(0, hb.max.y, hc.z),
    headW: Math.min(hb.max.x - hb.min.x, 0.5),
    back: new THREE.Vector3(0, top(0, backZ), backZ),
    top,
    headObj,
    halfW: ts.x / 2,
    scale: THREE.MathUtils.clamp(Math.max(ts.x, ts.z) / 0.55, 0.7, 1.7),
    tailZ: torso.min.z + ts.z * 0.1,
    center: all.getCenter(new THREE.Vector3()).setX(0),
  };
}

export function buildCreature(speciesId: SpeciesId, mutations: MutationId[], seed: number, shade?: string): CreatureModel {
  const sp = speciesDef(speciesId);
  const muts = visibleMutations({ species: speciesId, mutations });
  const k = new Kit();
  const P = mutatePalette(PALETTES[speciesId] ?? PALETTES.mossfrog, muts, seed, shade);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const m: CreatureModel = {
    root, body, wings: [], legs: [], segments: [], glows: [], materials: k.mats, bodyMats: 0, height: 0.8,
    movement: sp.movement, baseScale: 1,
  };
  (BUILDERS[speciesId] ?? BUILDERS.mossfrog)(k, P, m);
  m.bodyMats = k.mats.length;
  const plainMats = k.mats.filter((mat) => mat.emissive.getHex() === 0);
  // Where this particular body's head and back are, so halos, horns and wings sit right on every shape.
  const A = anchors(m);
  /** Things worn on the head ride along with it when the head moves. */
  const onHead = (o: THREE.Object3D) => {
    if (!A.headObj) return void body.add(o);
    body.updateMatrixWorld(true);
    o.position.copy(A.headObj.worldToLocal(body.localToWorld(o.position.clone())));
    A.headObj.add(o);
  };

  if (muts.includes('lunar') || speciesId === 'moonmoth') {
    const crescent = k.mesh(G.torus, '#eef2ff', [0.1, 0.1, 0.1], [A.head.x, A.head.y + 0.12, A.head.z], '#b9c6ff');
    crescent.rotation.z = 0.6;
    onHead(crescent);
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
      const sx = A.back.x + Math.cos(a) * 0.14 * A.scale;
      const sz = A.back.z + Math.sin(a) * 0.14 * A.scale;
      const spike = k.mesh(G.cone, '#f4fbff', [0.035, 0.14, 0.035], [sx, A.top(sx, sz) + 0.03, sz], '#bfe8ff');
      spike.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      body.add(spike);
    }
    const chill = glowSprite('#bfe8ff', 1.4, 0.35);
    chill.position.y = m.height * 0.4;
    body.add(chill);
    m.glows.push(chill);
  }
  if (muts.includes('angelic')) {
    // the halo floats just above the head, sized to it; the wings grow from the back, sized to the body
    const r = THREE.MathUtils.clamp(A.headW * 0.42, 0.09, 0.2);
    const halo = k.mesh(G.halo, '#ffe27a', [r, r, r], [A.head.x, A.head.y + 0.1 + r * 0.3, A.head.z], '#ffd23d');
    halo.rotation.x = Math.PI / 2;
    halo.userData.noOutline = true;
    onHead(halo);
    const wings: THREE.Object3D[] = [];
    for (const s of [1, -1]) {
      const wing = new THREE.Group();
      wing.position.set(A.back.x + A.halfW * 0.55 * s, A.back.y - 0.02, A.back.z);
      wing.scale.setScalar(A.scale);
      for (let i = 0; i < 3; i++) {
        const f = k.ball(0.13 - i * 0.025, '#ffffff', [(0.12 + i * 0.1) * s, 0.06 - i * 0.05, -0.05], [1, 0.32, 0.5]);
        f.rotation.z = (0.5 - i * 0.25) * s;
        wing.add(f);
      }
      body.add(wing);
      wings.push(wing);
    }
    root.userData.angelWings = wings;
  }
  if (muts.includes('infernal')) {
    for (const s of [1, -1]) {
      const hs = THREE.MathUtils.clamp(A.headW / 0.3, 0.6, 1.2);
      const horn = k.mesh(G.cone, '#5a1a1a', [0.045 * hs, 0.16 * hs, 0.045 * hs], [A.head.x + Math.max(0.05, A.headW * 0.3) * s, A.head.y + 0.03, A.head.z]);
      horn.rotation.z = -0.4 * s;
      onHead(horn);
    }
    const embers = new THREE.Group();
    embers.position.set(A.back.x, A.back.y - 0.02, A.tailZ);
    for (let i = 0; i < 3; i++) {
      const flame = k.mesh(G.cone, i === 1 ? '#ffe27a' : '#ff6a1a', [0.05, 0.16, 0.05], [(i - 1) * 0.05, 0.06, 0], '#ff5a00');
      flame.rotation.x = -0.6;
      flame.userData.noOutline = true;
      embers.add(flame);
    }
    const glow = glowSprite('#ff7a2a', 0.8, 0.6);
    embers.add(glow);
    body.add(embers);
  }
  if (muts.includes('abyssal')) {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.39996;
      const y = m.height * (0.25 + (i % 4) * 0.15);
      const dot = k.ball(0.035, '#7affea', [Math.cos(a) * 0.24, y, Math.sin(a) * 0.24], [1, 1, 1], '#3affe0');
      dot.castShadow = false;
      dot.userData.noOutline = true;
      body.add(dot);
    }
  }

  if (muts.includes('aurora')) {
    // two thin glowing ribbons drape over its back
    for (const [i, col] of (['#4affc8', '#b07aff'] as const).entries()) {
      const rr = (0.26 - i * 0.05) * A.scale;
      const band = k.mesh(G.ribbon, col, [rr, rr, 0.26], [A.back.x, A.back.y - rr * 0.8, A.back.z + 0.04 - i * 0.06], col);
      band.rotation.y = Math.PI / 2;
      band.castShadow = false;
      band.userData.noOutline = true;
      body.add(band);
    }
    const glow = glowSprite('#5affc0', 1.5, 0.45);
    glow.position.y = m.height * 0.5;
    body.add(glow);
    m.glows.push(glow);
  }
  if (muts.includes('misty')) {
    // little wisps of fog hang round it
    for (let i = 0; i < 5; i++) {
      const a = i * 1.257;
      const w = glowSprite('#f2f6fa', 0.5, 0.55);
      w.position.set(Math.cos(a) * 0.32, m.height * (0.2 + (i % 3) * 0.2), Math.sin(a) * 0.32);
      body.add(w);
    }
  }

  const spinners: THREE.Object3D[] = [];
  if (muts.includes('sunkissed')) {
    // sunspot freckles across the back
    for (let i = 0; i < 6; i++) {
      const a = i * 2.39996;
      const r = 0.08 + (i % 3) * 0.05;
      const fx = A.back.x + Math.cos(a) * r * A.scale;
      const fz = A.back.z + Math.sin(a) * r * A.scale;
      const dot = k.ball(0.025, '#ff8a2a', [fx, A.top(fx, fz) + 0.005, fz], [1, 0.5, 1]);
      dot.castShadow = false;
      dot.userData.noOutline = true;
      body.add(dot);
    }
  }
  if (muts.includes('blossom')) {
    // little flowers sprouting on the back and one on the head
    const spots: [number, number, number][] = [[A.back.x + 0.08, A.top(A.back.x + 0.08, A.back.z), A.back.z], [A.back.x - 0.1, A.top(A.back.x - 0.1, A.back.z - 0.08), A.back.z - 0.08], [A.head.x + 0.06, A.head.y, A.head.z]];
    spots.forEach(([x, y, z], j) => {
      const f = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        f.add(k.ball(0.03, j === 2 ? '#ffffff' : '#ff9ec4', [Math.cos(a) * 0.035, 0, Math.sin(a) * 0.035]));
      }
      f.add(k.ball(0.022, '#ffe066', [0, 0.01, 0]));
      f.position.set(x, y + 0.02, z);
      body.add(f);
    });
  }
  if (muts.includes('glowing')) {
    for (let i = 0; i < 6; i++) {
      const a = i * 2.39996;
      const dot = k.ball(0.03, '#f0ff8a', [Math.cos(a) * 0.22 * A.scale, A.center.y + Math.sin(i * 1.7) * 0.12, A.center.z + Math.sin(a) * 0.24 * A.scale], [1, 1, 1], '#e8ff6a');
      dot.castShadow = false;
      dot.userData.noOutline = true;
      body.add(dot);
    }
    const glow = glowSprite('#e8ff6a', 1.4 * A.scale, 0.55);
    glow.position.copy(A.center);
    body.add(glow);
    m.glows.push(glow);
  }
  if (muts.includes('breezy')) {
    const swirl = new THREE.Group();
    swirl.position.copy(A.center);
    for (let i = 0; i < 2; i++) {
      const ring = k.mesh(G.swirl, '#ffffff', [0.34 * A.scale - i * 0.05, 0.34 * A.scale - i * 0.05, 0.34], [0, -0.06 + i * 0.12, 0], '#dff4ff');
      ring.rotation.set(Math.PI / 2 + 0.2, 0, i * 2.4);
      ring.castShadow = false;
      ring.userData.noOutline = true;
      swirl.add(ring);
    }
    swirl.userData.spin = 2.2;
    body.add(swirl);
    spinners.push(swirl);
  }
  if (muts.includes('bubbly')) {
    const bubbles = new THREE.Group();
    bubbles.position.copy(A.center);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const bubMat = new THREE.MeshToonMaterial({ color: '#c8f2ff', transparent: true, opacity: 0.45, emissive: '#9ae6ff', emissiveIntensity: 0.3 });
      k.mats.push(bubMat);
      const bub = new THREE.Mesh(G.sphere, bubMat);
      bub.scale.setScalar(0.05 + (i % 2) * 0.03);
      bub.position.set(Math.cos(a) * 0.36 * A.scale, (i % 2) * 0.15, Math.sin(a) * 0.36 * A.scale);
      bub.add(k.ball(0.3, '#ffffff', [-0.35, 0.35, 0.6], [1, 1, 0.5]));
      bubbles.add(bub);
    }
    bubbles.userData.spin = 0.8;
    body.add(bubbles);
    spinners.push(bubbles);
  }
  if (muts.includes('cosmic')) {
    // a little night sky on its coat, and a tiny moon in orbit
    for (let i = 0; i < 8; i++) {
      const a = i * 2.39996;
      const s = k.mesh(G.tetra, '#ffffff', [0.022, 0.022, 0.022], [Math.cos(a) * 0.2 * A.scale, A.center.y + Math.sin(i * 1.3) * 0.12, A.center.z + Math.sin(a) * 0.22 * A.scale], '#ffffff');
      s.castShadow = false;
      s.userData.noOutline = true;
      body.add(s);
    }
    const orbit = new THREE.Group();
    orbit.position.set(A.head.x, A.head.y + 0.05, A.head.z);
    orbit.add(k.ball(0.045, '#f4f0ff', [0.28 * A.scale, 0, 0], [1, 1, 1], '#c9b8ff'));
    orbit.rotation.z = 0.3;
    orbit.userData.spin = 1.4;
    onHead(orbit);
    spinners.push(orbit);
  }
  if (muts.includes('crystal')) {
    // gems growing from the back
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const gx = A.back.x + Math.cos(a) * 0.09 * A.scale;
      const gz = A.back.z + Math.sin(a) * 0.09 * A.scale;
      const gem = k.mesh(G.octa, i % 2 ? '#bff4ff' : '#d8c8ff', [0.05, 0.12 + (i % 2) * 0.04, 0.05], [gx, A.top(gx, gz) + 0.05, gz], '#8ad8ff');
      gem.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      body.add(gem);
    }
  }
  // ---- Halloween marks
  if (muts.includes('ghostly')) {
    // see-through, with a cold glow
    for (const mat of k.mats.slice(0, m.bodyMats)) {
      mat.transparent = true;
      mat.opacity = 0.62;
    }
    const chill = glowSprite('#dfe8ff', 1.5 * A.scale, 0.5);
    chill.position.copy(A.center);
    body.add(chill);
    m.glows.push(chill);
  }
  if (muts.includes('calcified')) {
    // bones showing along its back, and a little skull charm on its head
    for (let i = 0; i < 4; i++) {
      const bz = A.back.z + (i - 1.5) * 0.07 * A.scale;
      const rib = k.mesh(G.cyl, '#b8ae90', [0.028, 0.22 * A.scale, 0.028], [A.back.x, A.top(A.back.x, bz) + 0.012, bz]);
      rib.rotation.z = Math.PI / 2;
      body.add(rib);
    }
    const spine = k.mesh(G.cyl, '#b8ae90', [0.025, 0.26 * A.scale, 0.025], [A.back.x, A.top(A.back.x, A.back.z) + 0.02, A.back.z]);
    spine.rotation.x = Math.PI / 2;
    body.add(spine);
    const skull = k.ball(0.05, '#fffaf0', [A.head.x + 0.05, A.head.y + 0.02, A.head.z + 0.04], [1, 0.85, 1]);
    onHead(skull);
    for (const sgn of [1, -1]) onHead(k.ball(0.012, '#1b2a4a', [A.head.x + 0.05 + sgn * 0.018, A.head.y + 0.025, A.head.z + 0.088]));
  }
  if (muts.includes('mummified')) {
    // wide bandage strips wrapped over its body, from tail to neck
    const front = A.head.z * 0.7;
    for (let i = 0; i < 5; i++) {
      const bz = A.tailZ + ((front - A.tailZ) * (i + 0.5)) / 5;
      const strip = k.mesh(G.box, i % 2 ? '#f4ecd8' : '#e0d4b0', [A.halfW * 2.3, 0.035, 0.055 * A.scale], [A.back.x, A.top(A.back.x, bz) + 0.008, bz]);
      strip.rotation.set((i % 2 ? 1 : -1) * 0.12, (i - 2) * 0.18, 0);
      body.add(strip);
    }
  }
  if (muts.includes('zombified')) {
    // a line of stitches across its back
    const yy = A.top(A.back.x, A.back.z) + 0.008;
    const len = 0.22 * A.scale;
    const line = k.mesh(G.box, '#2a2a20', [len, 0.014, 0.016], [A.back.x, yy, A.back.z]);
    line.userData.noOutline = true;
    body.add(line);
    for (let i = 0; i < 5; i++) {
      const st = k.mesh(G.box, '#2a2a20', [0.014, 0.016, 0.07], [A.back.x + (i - 2) * len / 5, yy, A.back.z]);
      st.userData.noOutline = true;
      body.add(st);
    }
  }
  if (muts.includes('vampire')) {
    // little bat wings, a cape over its back and tiny fangs
    for (const sgn of [1, -1]) {
      const wing = k.mesh(G.cone, '#2a1430', [0.07 * A.scale, 0.2 * A.scale, 0.02], [A.back.x + sgn * (A.halfW + 0.06 * A.scale), A.back.y - 0.02, A.back.z]);
      wing.rotation.set(0, 0, sgn * -1.9);
      body.add(wing);
      const lining = k.mesh(G.cone, '#c8203a', [0.05 * A.scale, 0.15 * A.scale, 0.012], [A.back.x + sgn * (A.halfW + 0.05 * A.scale), A.back.y - 0.02, A.back.z + 0.012]);
      lining.rotation.set(0, 0, sgn * -1.9);
      body.add(lining);
    }
    const cape = k.mesh(G.cone, '#2a1430', [0.22 * A.scale, 0.32 * A.scale, 0.1], [A.back.x, A.back.y - 0.04, A.back.z + 0.02]);
    cape.rotation.x = 0.25;
    body.add(cape);
    for (const sgn of [1, -1]) {
      const fang = k.mesh(G.cone, '#ffffff', [0.014, 0.045, 0.014], [A.head.x + sgn * 0.025, A.head.y - 0.12, A.head.z + 0.1]);
      fang.rotation.x = Math.PI;
      onHead(fang);
    }
  }
  if (muts.includes('pumpkin')) {
    // a jack-o'-lantern hat that glows in the dark
    const hs = Math.max(1, A.headW * 3);
    const hat = new THREE.Group();
    hat.position.set(A.head.x, A.head.y + 0.07 * hs, A.head.z);
    hat.add(k.ball(0.13 * hs, '#ff8a1a', [0, 0, 0], [1.25, 0.85, 1.25], '#7a3000'));
    for (const sgn of [1, -1]) {
      const eye = k.mesh(G.cone, '#3a1a00', [0.025 * hs, 0.035 * hs, 0.01], [sgn * 0.05 * hs, 0.02 * hs, 0.155 * hs], '#ffb030');
      eye.rotation.x = Math.PI / 2;
      hat.add(eye);
    }
    hat.add(k.mesh(G.box, '#3a1a00', [0.1 * hs, 0.02 * hs, 0.01], [0, -0.04 * hs, 0.155 * hs], '#ffb030'));
    hat.add(k.mesh(G.cyl, '#3a7a2a', [0.02 * hs, 0.07 * hs, 0.02 * hs], [0, 0.13 * hs, 0]));
    const face = glowSprite('#ffb030', 0.45 * hs, 0.6);
    face.position.set(0, 0, 0.12 * hs);
    face.userData.night = true;
    hat.add(face);
    onHead(hat);
  }
  if (muts.includes('golden')) {
    const shine = glowSprite('#ffd23d', 1.6 * A.scale, 0.5);
    shine.position.copy(A.center);
    body.add(shine);
    m.glows.push(shine);
  }
  root.userData.spinners = spinners;

  if (shade === 'shiny' && !m.twinkles) {
    // Shiny pets glint: little gold sparkles that twinkle around them
    const tw = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = i * 2.39996;
      const s = k.mesh(G.tetra, '#fff6b0', [0.045, 0.045, 0.045], [Math.cos(a) * 0.3, m.height * (0.3 + (i % 3) * 0.22), Math.sin(a) * 0.3], '#ffd21a');
      s.castShadow = false;
      s.userData.noOutline = true;
      tw.add(s);
    }
    body.add(tw);
    m.twinkles = tw;
  }

  // Mythicals always shine; otherwise the rarest mutation sets the glow.
  const mythic = MYTHIC_GLOW[speciesId];
  const level = Math.max(glowLevel({ species: speciesId, mutations }), mythic ? 2 : 0);
  addOutlines(body, level >= 2 ? 3.6 : level === 1 ? 3.2 : 2.6);
  if (level > 0) {
    const top = rarestMutation({ species: speciesId, mutations });
    const useMythic = mythic && (!top || MUTATIONS[top].tier !== 'epic');
    addAura(m, level, useMythic ? mythic : MUTATIONS[top!].glow, !useMythic && top === 'prismatic', plainMats, A.center);
  }
  // The creature's own rolled size and growth are applied on top by the actor.
  m.baseScale = (muts.includes('giant') ? 1.6 : 1) * (sp.rarity === 'legendary' || sp.rarity === 'mythical' ? 1.2 : 1);
  root.scale.setScalar(m.baseScale);
  root.userData.prismatic = muts.includes('prismatic');
  return m;
}

const MYTHIC_GLOW: Record<string, string> = {
  cloudserpent: '#ffe27a', phoenix: '#ff8a3a', kraken: '#ff8fc8', qilin: '#8fffe0',
};

function addAura(m: CreatureModel, level: number, glow: string, prismatic: boolean, mats: THREE.MeshToonMaterial[], center: THREE.Vector3): void {
  const color = new THREE.Color(glow);
  const outline = glowOutlineMaterial(color, level >= 2 ? 3.6 : 3.2);
  m.body.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData.outline) o.material = outline;
  });
  for (const mat of mats) mat.emissive = color.clone();
  const sprite = glowSprite(glow, m.height * (1.6 + level * 0.5), 0.4);
  sprite.position.copy(center);
  sprite.renderOrder = -1;
  m.body.add(sprite);
  const aura: Aura = { level, color, prismatic, outline, sprite, mats };
  if (level >= 2) {
    const orbit = new THREE.Group();
    for (let i = 0; i < 3 + level; i++) {
      const sp = glowSprite('#ffffff', 0.16, 0.9);
      sp.userData.i = i;
      orbit.add(sp);
    }
    orbit.position.copy(center);
    m.body.add(orbit);
    aura.orbit = orbit;
  }
  m.aura = aura;
  animateGlow(m, 0);
}

const WHITE = new THREE.Color('#ffffff');
const INK = new THREE.Color('#1b2a4a');
const RIM_MIX = [0, 0.6, 0.85, 1];
const EMISSIVE = [0, 0.1, 0.18, 0.22];
const AURA_OPACITY = [0, 0.35, 0.55, 0.75];

/** Pulse the rare-mutation glow; call every frame. */
export function animateGlow(model: CreatureModel, t: number): void {
  const wings = model.root.userData.angelWings as THREE.Object3D[] | undefined;
  wings?.forEach((w, i) => (w.rotation.y = Math.sin(t * 3) * 0.35 * (i ? -1 : 1)));
  const a = model.aura;
  if (!a) return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  if (a.prismatic) a.color.setHSL((t * 0.15) % 1, 0.9, 0.62);
  const rim = a.outline.uniforms.color.value as THREE.Color;
  rim.copy(INK).lerp(a.color, RIM_MIX[a.level] * (0.75 + 0.25 * pulse));
  if (a.level >= 2) rim.lerp(WHITE, 0.25 * pulse);
  for (const mat of a.mats) {
    mat.emissive.copy(a.color);
    mat.emissiveIntensity = EMISSIVE[a.level] * (0.6 + 0.4 * pulse);
  }
  const sm = a.sprite.material as THREE.SpriteMaterial;
  sm.color.copy(a.color);
  sm.opacity = AURA_OPACITY[a.level] * (0.7 + 0.3 * pulse);
  if (a.orbit) {
    const r = model.height * 0.75;
    a.orbit.children.forEach((s) => {
      const i = s.userData.i as number;
      const ang = t * 1.6 + (i / a.orbit!.children.length) * Math.PI * 2;
      s.position.set(Math.cos(ang) * r, Math.sin(t * 2 + i * 1.3) * model.height * 0.35, Math.sin(ang) * r);
      s.scale.setScalar(0.1 + 0.08 * Math.max(0, Math.sin(t * 5 + i * 2)));
    });
  }
}

/** Hue-cycle the body's own materials for Prismatic creatures (mutation extras keep their colors). */
export function animatePrismatic(model: CreatureModel, t: number): void {
  model.materials.slice(0, model.bodyMats).forEach((mat, i) => {
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
  model.aura?.outline.dispose();
  model.root.traverse((o) => {
    if (o instanceof THREE.Sprite) o.material.dispose();
  });
}

/** Mango, the monkey who runs the shop. Outlines come from the stall. */
export function buildShopkeeper(): THREE.Group {
  const k = new Kit();
  const fur = '#8a5a3c';
  const skin = '#f2c79a';
  const g = new THREE.Group();
  g.add(k.ball(0.28, fur, [0, 0.3, 0], [1, 1.05, 0.9]));
  g.add(k.ball(0.2, skin, [0, 0.28, 0.12], [1, 1.1, 0.6]));
  // a curly tail
  const tail = k.mesh(G.torus, fur, [0.16, 0.16, 0.16], [0.12, 0.3, -0.26]);
  tail.rotation.set(0, Math.PI / 2, 0.4);
  g.add(tail);
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0);
  head.add(k.ball(0.3, fur, [0, 0, 0]));
  head.add(k.ball(0.22, skin, [0, -0.04, 0.16], [1.15, 0.92, 0.62]));
  head.add(k.ball(0.12, skin, [0, -0.11, 0.26], [1.3, 0.8, 0.8]));
  for (const s of [1, -1]) {
    head.add(k.ball(0.11, fur, [s * 0.3, 0.02, 0], [1, 1, 0.6]));
    head.add(k.ball(0.07, skin, [s * 0.32, 0.02, 0.05], [1, 1, 0.4]));
    k.eye(head, s * 0.09, 0.04, 0.25, 0.055);
  }
  // merchant's fez with a gold tassel
  const fez = k.mesh(G.cyl, '#e2483d', [0.13, 0.15, 0.13], [0.05, 0.32, 0]);
  fez.rotation.z = -0.18;
  head.add(fez);
  head.add(k.ball(0.04, '#ffd36a', [0.18, 0.3, 0.02]));
  g.add(head);
  const arm = new THREE.Group();
  arm.position.set(0.24, 0.42, 0.02);
  arm.add(k.ball(0.075, fur, [0, 0.15, 0], [0.85, 2.1, 0.85]));
  arm.add(k.ball(0.07, skin, [0, 0.32, 0]));
  g.add(arm);
  const rest = k.ball(0.075, fur, [-0.25, 0.32, 0.1], [0.85, 1.9, 0.85]);
  rest.rotation.x = -0.5;
  g.add(rest);
  g.userData.head = head;
  g.userData.arm = arm;
  return g;
}

/** Idle bob, with a friendly wave every few seconds. */
export function animateShopkeeper(g: THREE.Group, t: number): void {
  const head = g.userData.head as THREE.Group;
  const arm = g.userData.arm as THREE.Group;
  head.rotation.z = Math.sin(t * 1.3) * 0.1;
  head.position.y = 0.72 + Math.abs(Math.sin(t * 2.6)) * 0.02;
  const waving = t % 7 < 1.6;
  arm.rotation.z = waving ? -0.5 + Math.sin(t * 12) * 0.45 : -2.6;
}

// ---------------------------------------------------------------- monkeys, shore birds, desert dwellers, mythicals

Object.assign(PALETTES, {
  mossmonkey: { main: '#9a6a3e', second: '#5fbf4a', accent: '#8fd06a', belly: '#f2d2a8' },
  lanternlemur: { main: '#9a96b0', second: '#3a3650', accent: '#ffd86a', belly: '#f4f0ff' },
  cindermonk: { main: '#c8502a', second: '#ffb02a', accent: '#ffe27a', belly: '#ffd6a8' },
  flamingle: { main: '#ff9ec4', second: '#ff6fa8', accent: '#2a1d2e', belly: '#ffd0e2' },
  pouchbill: { main: '#f8f4ec', second: '#ffcf8a', accent: '#ff9f1a', belly: '#ffffff' },
  mistheron: { main: '#a8bcd8', second: '#6a7ea8', accent: '#ffd23d', belly: '#eef4ff' },
  sandpincer: { main: '#e0a850', second: '#b0742e', accent: '#7a3a1a', belly: '#f4d49a' },
  dunecoil: { main: '#e8c890', second: '#b07a3a', accent: '#d05a3a', belly: '#fff0d0' },
  sunhood: { main: '#d89a3a', second: '#7a4a1a', accent: '#ffd23d', belly: '#fff0c0' },
  cloudserpent: { main: '#3aa86a', second: '#2a7a4a', accent: '#ffd23d', belly: '#f4f0c8' },
  phoenix: { main: '#ff5a2a', second: '#ff9a1a', accent: '#ffe27a', belly: '#ffd08a' },
  kraken: { main: '#8a5ad8', second: '#5a3aa8', accent: '#ff8fc8', belly: '#e8d8ff' },
  qilin: { main: '#6fd0bf', second: '#3a9a8a', accent: '#ffd23d', belly: '#f4fff8' },
});

function monkey(k: Kit, P: Palette, m: Parameters<Builder>[2], kind: 'moss' | 'lantern' | 'cinder') {
  const b = m.body;
  b.add(k.ball(0.24, P.main, [0, 0.36, 0], [1, 1.1, 0.9]));
  b.add(k.ball(0.17, P.belly, [0, 0.34, 0.09], [1, 1.1, 0.6]));
  const head = new THREE.Group();
  head.position.set(0, 0.7, 0.04);
  head.add(k.ball(0.22, P.main, [0, 0, 0]));
  head.add(k.ball(0.16, P.belly, [0, -0.03, 0.12], [1.15, 0.92, 0.62]));
  head.add(k.ball(0.09, P.belly, [0, -0.08, 0.2], [1.3, 0.8, 0.8]));
  const eye = kind === 'lantern' ? 0.075 : 0.05;
  for (const s of [1, -1]) {
    head.add(k.ball(0.08, P.main, [s * 0.22, 0.02, 0], [1, 1, 0.6]));
    head.add(k.ball(0.05, P.belly, [s * 0.235, 0.02, 0.03], [1, 1, 0.4]));
    k.eye(head, s * 0.075, 0.03, 0.17, eye);
  }
  b.add(head);
  for (const s of [1, -1]) {
    const leg = pivot(0.1 * s, 0.2, 0, k.mesh(G.cyl, P.main, [0.05, 0.2, 0.05], [0, -0.08, 0]));
    b.add(leg);
    m.legs.push(leg);
    const arm = pivot(0.22 * s, 0.5, 0.02, k.ball(0.055, P.main, [0.02 * s, -0.12, 0.02], [0.9, 2.1, 0.9]));
    arm.add(k.ball(0.05, P.belly, [0.03 * s, -0.27, 0.03]));
    b.add(arm);
    m.legs.push(arm);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.28, -0.2);
  if (kind === 'lantern') {
    // a long striped tail that curls up behind it
    for (let i = 0; i < 8; i++) {
      const a = i * 0.28;
      tail.add(k.ball(0.06 - i * 0.002, i % 2 ? P.second : P.belly, [0, Math.sin(a) * 0.45, -Math.cos(a) * 0.25 + 0.05 - i * 0.03]));
    }
    for (const s of [1, -1]) {
      const glow = glowSprite(P.accent, 0.35, 0.8);
      glow.position.set(s * 0.075, 0.73, 0.25);
      b.add(glow);
    }
  } else {
    const curl = k.mesh(G.torus, P.main, [0.17, 0.17, 0.17], [0, 0.12, -0.06]);
    curl.rotation.set(0, Math.PI / 2, 0.5);
    tail.add(curl);
  }
  if (kind === 'moss') {
    head.add(k.ball(0.13, P.second, [0, 0.19, -0.02], [1.2, 0.45, 1.1]));
    const leaf = k.ball(0.07, P.accent, [0.06, 0.27, 0], [0.5, 0.12, 1]);
    leaf.rotation.set(-0.4, 0.4, 0.3);
    head.add(leaf);
  }
  if (kind === 'cinder') {
    for (let i = 0; i < 3; i++) {
      const flame = k.mesh(G.cone, i === 1 ? P.accent : P.second, [0.05, 0.16, 0.05], [(i - 1) * 0.06, 0.24, -0.02], P.second);
      flame.rotation.z = (1 - i) * 0.3;
      head.add(flame);
    }
    const tip = k.ball(0.07, P.accent, [0, 0.36, -0.12], [1, 1.3, 1], P.second);
    tail.add(tip);
    const glow = glowSprite('#ff9a3a', 0.9, 0.6);
    glow.position.set(0, 0.36, -0.12);
    tail.add(glow);
  }
  b.add(tail);
  m.tail = tail;
  m.height = 0.95;
}

function wader(k: Kit, P: Palette, m: Parameters<Builder>[2], kind: 'flamingo' | 'heron') {
  const b = m.body;
  const hip = kind === 'flamingo' ? 0.68 : 0.62;
  b.add(k.ball(0.22, P.main, [0, hip + 0.08, -0.02], [0.85, 0.8, 1.35]));
  // neck: an S of small balls, then the head
  const neck: [number, number][] = kind === 'flamingo'
    ? [[0.12, 0.1], [0.24, 0.16], [0.36, 0.1], [0.48, 0.14]]
    : [[0.12, 0.14], [0.24, 0.18], [0.36, 0.2], [0.48, 0.22]];
  for (const [y, z] of neck) b.add(k.ball(0.055, P.main, [0, hip + 0.1 + y, z]));
  const head = new THREE.Group();
  head.position.set(0, hip + 0.65, kind === 'flamingo' ? 0.2 : 0.26);
  head.add(k.ball(0.09, P.main, [0, 0, 0]));
  k.eye(head, 0.05, 0.02, 0.06, 0.03);
  k.eye(head, -0.05, 0.02, 0.06, 0.03);
  if (kind === 'flamingo') {
    const beak = k.mesh(G.cone, P.belly, [0.04, 0.16, 0.04], [0, -0.05, 0.1]);
    beak.rotation.x = 2.2;
    head.add(beak);
    const tip = k.mesh(G.cone, P.accent, [0.03, 0.07, 0.03], [0, -0.11, 0.09]);
    tip.rotation.x = 2.6;
    head.add(tip);
  } else {
    const beak = k.mesh(G.cone, P.accent, [0.025, 0.22, 0.025], [0, 0, 0.17]);
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
    const plume = k.mesh(G.cone, P.second, [0.02, 0.2, 0.02], [0, 0.04, -0.14]);
    plume.rotation.x = -2.2;
    head.add(plume);
    const mist = glowSprite('#dfe8ff', 1.6, 0.4);
    mist.position.y = 0.5;
    b.add(mist);
  }
  b.add(head);
  for (const s of [1, -1]) {
    const wing = pivot(0.18 * s, hip + 0.1, -0.02, k.ball(0.14, P.second, [0.02 * s, 0, -0.04], [0.35, 0.7, 1.2]));
    b.add(wing);
    m.wings.push(wing);
  }
  const legColor = kind === 'flamingo' ? P.second : '#e8c040';
  const leg = pivot(0.05, hip, 0, k.mesh(G.cyl, legColor, [0.018, hip, 0.018], [0, -hip / 2, 0]));
  b.add(leg);
  m.legs.push(leg);
  if (kind === 'flamingo') {
    // the other leg tucked up, as flamingos do
    const tucked = pivot(-0.05, hip - 0.02, 0, k.mesh(G.cyl, legColor, [0.018, hip * 0.5, 0.018], [0, -hip * 0.22, 0.05]));
    tucked.rotation.x = -1.1;
    b.add(tucked);
  } else {
    const leg2 = pivot(-0.05, hip, 0, k.mesh(G.cyl, legColor, [0.018, hip, 0.018], [0, -hip / 2, 0]));
    b.add(leg2);
    m.legs.push(leg2);
  }
  const tail = new THREE.Group();
  tail.position.set(0, hip + 0.1, -0.3);
  tail.add(k.ball(0.07, P.second, [0, 0, -0.04], [0.8, 0.4, 1.3]));
  b.add(tail);
  m.tail = tail;
  m.height = hip + 0.8;
}

function snake(k: Kit, P: Palette, m: Parameters<Builder>[2], hood: boolean) {
  const n = hood ? 9 : 8;
  for (let i = 0; i < n; i++) {
    const r = 0.14 - i * 0.009;
    const seg = new THREE.Group();
    seg.add(k.ball(r, i % 2 ? P.main : P.second, [0, r, 0], [1, 0.85, 1.1]));
    if (!hood && i % 2 === 0) seg.add(k.ball(r * 0.4, P.accent, [0, r * 1.8, 0], [1, 0.3, 1]));
    seg.position.set(0, 0, -i * 0.16);
    m.body.add(seg);
    m.segments.push(seg);
  }
  const head = m.segments[0];
  if (hood) {
    // reared up, with a sunny hood
    head.position.set(0, 0.42, 0.02);
    const neck = k.ball(0.11, P.main, [0, -0.2, -0.02], [1, 2.2, 1]);
    head.add(neck);
    const hoodMesh = k.ball(0.26, P.main, [0, 0.04, -0.06], [1, 1.15, 0.22]);
    head.add(hoodMesh);
    const sun = k.ball(0.09, P.accent, [0, 0.06, 0.0], [1, 1, 0.2], P.accent);
    head.add(sun);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ray = k.ball(0.025, P.accent, [Math.cos(a) * 0.15, 0.06 + Math.sin(a) * 0.15, 0.0], [1, 1, 0.3], P.accent);
      ray.userData.noOutline = true;
      head.add(ray);
    }
    head.add(k.ball(0.11, P.main, [0, 0.2, 0.1], [1, 0.75, 1.3]));
    k.eye(head, 0.06, 0.25, 0.2, 0.035);
    k.eye(head, -0.06, 0.25, 0.2, 0.035);
    m.height = 0.95;
  } else {
    head.add(k.ball(0.15, P.main, [0, 0.16, 0.08], [1, 0.75, 1.25]));
    k.eye(head, 0.08, 0.24, 0.17, 0.045);
    k.eye(head, -0.08, 0.24, 0.17, 0.045);
    for (const s of [1, -1]) {
      const horn = k.mesh(G.cone, P.second, [0.025, 0.08, 0.025], [0.08 * s, 0.31, 0.12]);
      horn.rotation.z = -0.3 * s;
      head.add(horn);
    }
    m.height = 0.5;
  }
}

Object.assign(BUILDERS, {
  mossmonkey: (k, P, m) => monkey(k, P, m, 'moss'),
  lanternlemur: (k, P, m) => monkey(k, P, m, 'lantern'),
  cindermonk: (k, P, m) => monkey(k, P, m, 'cinder'),
  flamingle: (k, P, m) => wader(k, P, m, 'flamingo'),
  mistheron: (k, P, m) => wader(k, P, m, 'heron'),
  dunecoil: (k, P, m) => snake(k, P, m, false),
  sunhood: (k, P, m) => snake(k, P, m, true),

  pouchbill: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.3, P.main, [0, 0.38, -0.02], [1, 0.9, 1.2]));
    b.add(k.ball(0.17, P.main, [0, 0.74, 0.12]));
    k.eye(b, 0.08, 0.8, 0.24, 0.04);
    k.eye(b, -0.08, 0.8, 0.24, 0.04);
    b.add(k.ball(0.09, P.accent, [0, 0.74, 0.42], [0.55, 0.28, 2.1]));
    b.add(k.ball(0.1, P.second, [0, 0.62, 0.36], [0.6, 0.6, 1.5]));
    for (const s of [1, -1]) {
      const wing = pivot(0.27 * s, 0.44, -0.02, k.ball(0.15, '#e8e2d6', [0.03 * s, -0.04, -0.02], [0.4, 0.85, 1.2]));
      b.add(wing);
      m.wings.push(wing);
      const leg = pivot(0.12 * s, 0.1, 0.04, k.ball(0.07, P.accent, [0, -0.06, 0.05], [1, 0.3, 1.4]));
      b.add(leg);
      m.legs.push(leg);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.42, -0.34);
    tail.add(k.ball(0.08, '#e8e2d6', [0, 0, -0.04], [1, 0.4, 1.2]));
    b.add(tail);
    m.tail = tail;
    m.height = 0.95;
  },

  sandpincer: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.2, P.main, [0, 0.18, -0.02], [1, 0.5, 1.3]));
    b.add(k.ball(0.14, P.main, [0, 0.2, 0.22], [1.1, 0.6, 0.9]));
    k.eye(b, 0.05, 0.3, 0.3, 0.035);
    k.eye(b, -0.05, 0.3, 0.3, 0.035);
    for (const s of [1, -1]) {
      const arm = pivot(0.14 * s, 0.2, 0.28, k.ball(0.04, P.main, [0.06 * s, 0, 0.06], [1, 1, 2]));
      const claw = k.ball(0.08, P.second, [0.12 * s, 0.02, 0.18], [0.9, 0.6, 1.2]);
      arm.add(claw);
      const pinch = k.mesh(G.cone, P.second, [0.03, 0.1, 0.03], [0.09 * s, 0.03, 0.27]);
      pinch.rotation.x = Math.PI / 2;
      arm.add(pinch);
      b.add(arm);
      m.wings.push(arm);
      for (let i = 0; i < 3; i++) {
        const leg = pivot(0.15 * s, 0.14, 0.1 - i * 0.12, k.mesh(G.cyl, P.second, [0.018, 0.16, 0.018], [0.06 * s, -0.06, 0]));
        leg.rotation.z = 0.7 * s;
        b.add(leg);
        m.legs.push(leg);
      }
    }
    // the tail arcs up and over its back
    const tail = new THREE.Group();
    tail.position.set(0, 0.18, -0.24);
    for (let i = 0; i < 5; i++) {
      const a = (i / 4) * Math.PI * 0.85;
      tail.add(k.ball(0.07 - i * 0.006, i % 2 ? P.main : P.second, [0, Math.sin(a) * 0.4, -Math.cos(a) * 0.18 + 0.02]));
    }
    const sting = k.mesh(G.cone, P.accent, [0.035, 0.11, 0.035], [0, 0.42, 0.14]);
    sting.rotation.x = 2.4;
    tail.add(sting);
    b.add(tail);
    m.tail = tail;
    m.height = 0.7;
  },

  // ---- Mythicals

  cloudserpent: (k, P, m) => {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const r = 0.15 - i * 0.008;
      const seg = new THREE.Group();
      seg.add(k.ball(r, P.main, [0, 0, 0], [1, 0.95, 1.15]));
      seg.add(k.ball(r * 0.7, P.belly, [0, -r * 0.45, 0.01], [1, 0.6, 1.1]));
      if (i % 2 === 0) {
        const fin = k.mesh(G.cone, P.accent, [0.03, 0.09, 0.03], [0, r * 0.95, 0]);
        fin.rotation.x = -0.4;
        seg.add(fin);
      }
      seg.position.set(0, Math.sin(i * 0.7) * 0.12, 0.1 - i * 0.15);
      m.body.add(seg);
      m.segments.push(seg);
    }
    const head = m.segments[0];
    head.add(k.ball(0.17, P.main, [0, 0.03, 0.12], [1, 0.8, 1.3]));
    head.add(k.ball(0.1, P.belly, [0, -0.03, 0.27], [1, 0.6, 1]));
    k.eye(head, 0.09, 0.09, 0.2, 0.045);
    k.eye(head, -0.09, 0.09, 0.2, 0.045);
    for (const s of [1, -1]) {
      const horn = k.mesh(G.cone, P.accent, [0.03, 0.2, 0.03], [0.07 * s, 0.2, 0.02]);
      horn.rotation.set(-0.8, 0, -0.2 * s);
      head.add(horn);
      const whisker = k.mesh(G.cyl, P.accent, [0.008, 0.32, 0.008], [0.12 * s, -0.02, 0.32]);
      whisker.rotation.set(0.3, 0, -1.2 * s);
      whisker.userData.noOutline = true;
      head.add(whisker);
    }
    for (const i of [2, 7]) {
      for (const s of [1, -1]) {
        const leg = k.ball(0.04, P.main, [0.13 * s, -0.12, 0], [0.8, 1.4, 0.8]);
        m.segments[i].add(leg);
      }
    }
    for (let i = 0; i < 4; i++) {
      const puff = k.ball(0.12 + (i % 2) * 0.04, '#ffffff', [Math.sin(i * 1.9) * 0.3, -0.25, -0.2 - i * 0.35]);
      puff.castShadow = false;
      m.body.add(puff);
    }
    const glow = glowSprite('#ffe9a0', 2.2, 0.35);
    glow.position.z = -0.6;
    m.body.add(glow);
    m.height = 0.7;
  },

  phoenix: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.24, P.main, [0, 0.42, 0], [0.9, 0.95, 1.15], P.main));
    b.add(k.ball(0.17, P.belly, [0, 0.38, 0.1], [0.9, 1, 0.8]));
    const head = new THREE.Group();
    head.position.set(0, 0.74, 0.14);
    head.add(k.ball(0.15, P.main, [0, 0, 0], [1, 1, 1], P.main));
    k.eye(head, 0.07, 0.03, 0.12, 0.04);
    k.eye(head, -0.07, 0.03, 0.12, 0.04);
    const beak = k.mesh(G.cone, P.accent, [0.045, 0.11, 0.045], [0, -0.02, 0.17]);
    beak.rotation.x = Math.PI / 2 + 0.3;
    head.add(beak);
    for (let i = 0; i < 3; i++) {
      const crest = k.mesh(G.cone, i === 1 ? P.accent : P.second, [0.035, 0.18, 0.035], [(i - 1) * 0.05, 0.16, -0.04], P.second);
      crest.rotation.set(-0.5, 0, (1 - i) * 0.3);
      head.add(crest);
    }
    b.add(head);
    for (const s of [1, -1]) {
      const wing = new THREE.Group();
      wing.position.set(0.2 * s, 0.5, -0.02);
      for (let i = 0; i < 3; i++) {
        const f = k.ball(0.14 - i * 0.02, i === 0 ? P.main : i === 1 ? P.second : P.accent, [(0.14 + i * 0.12) * s, 0.04 - i * 0.03, -0.04 - i * 0.03], [1.1, 0.12, 0.55], i === 2 ? P.second : undefined);
        f.rotation.z = -0.25 * s;
        wing.add(f);
      }
      b.add(wing);
      m.wings.push(wing);
      const leg = pivot(0.08 * s, 0.18, 0.02, k.mesh(G.cyl, P.accent, [0.02, 0.14, 0.02], [0, -0.04, 0]));
      b.add(leg);
      m.legs.push(leg);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.36, -0.24);
    for (const s of [-1, 0, 1]) {
      const plume = k.mesh(G.cone, s === 0 ? P.accent : P.second, [0.06, 0.55, 0.03], [0.08 * s, -0.05, -0.24], P.second);
      plume.rotation.set(-2.0, 0, 0.25 * s);
      tail.add(plume);
    }
    b.add(tail);
    m.tail = tail;
    const glow = glowSprite('#ff9a3a', 2.0, 0.55);
    glow.position.y = 0.45;
    b.add(glow);
    m.height = 0.95;
  },

  kraken: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.28, P.main, [0, 0.42, -0.04], [1, 1.2, 1.05]));
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      const spot = k.ball(0.04, P.accent, [Math.cos(a) * 0.2, 0.5 + Math.sin(i * 2.1) * 0.12, Math.sin(a) * 0.2 - 0.04], [1, 1, 0.5]);
      spot.userData.noOutline = true;
      b.add(spot);
    }
    k.eye(b, 0.11, 0.36, 0.22, 0.07);
    k.eye(b, -0.11, 0.36, 0.22, 0.07);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      // fixed outward yaw outside, a wiggling arm inside (the swim cycle sways it)
      const socket = new THREE.Group();
      socket.position.set(Math.cos(a) * 0.16, 0.18, Math.sin(a) * 0.16);
      socket.rotation.y = -a + Math.PI / 2;
      const arm = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        arm.add(k.ball(0.065 - j * 0.012, j % 2 ? P.main : P.second, [0, -j * 0.03 + (j === 3 ? 0.05 : 0), 0.08 + j * 0.09]));
      }
      socket.add(arm);
      b.add(socket);
      m.wings.push(arm);
    }
    const glow = glowSprite('#ff8fc8', 1.8, 0.35);
    glow.position.y = 0.4;
    b.add(glow);
    m.height = 0.85;
  },

  qilin: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.25, P.main, [0, 0.58, -0.04], [0.8, 0.8, 1.4]));
    b.add(k.ball(0.17, P.belly, [0, 0.52, 0.02], [0.75, 0.6, 1.3]));
    for (let i = 0; i < 5; i++) {
      const scale = k.ball(0.05, P.accent, [0, 0.78, 0.2 - i * 0.12], [1.2, 0.5, 1]);
      scale.userData.noOutline = true;
      b.add(scale);
    }
    b.add(k.ball(0.1, P.main, [0, 0.82, 0.26], [0.9, 1.5, 0.9]));
    const head = new THREE.Group();
    head.position.set(0, 1.0, 0.36);
    head.add(k.ball(0.14, P.main, [0, 0, 0], [0.9, 0.95, 1.1]));
    head.add(k.ball(0.09, P.belly, [0, -0.04, 0.12], [1, 0.75, 1.1]));
    k.eye(head, 0.07, 0.04, 0.1, 0.04);
    k.eye(head, -0.07, 0.04, 0.1, 0.04);
    for (const s of [1, -1]) {
      const antler = k.mesh(G.cone, P.accent, [0.025, 0.2, 0.025], [0.06 * s, 0.18, -0.04], P.accent);
      antler.rotation.set(-0.5, 0, -0.35 * s);
      head.add(antler);
      const tine = k.mesh(G.cone, P.accent, [0.018, 0.1, 0.018], [0.11 * s, 0.2, 0.0], P.accent);
      tine.rotation.set(-0.2, 0, -1.0 * s);
      head.add(tine);
      const whisker = k.mesh(G.cyl, P.accent, [0.007, 0.2, 0.007], [0.08 * s, -0.06, 0.18]);
      whisker.rotation.z = -1.2 * s;
      whisker.userData.noOutline = true;
      head.add(whisker);
    }
    b.add(head);
    for (let i = 0; i < 4; i++) {
      const mane = k.mesh(G.cone, '#ffffff', [0.035, 0.14, 0.035], [0, 0.95 - i * 0.07, 0.24 - i * 0.07]);
      mane.rotation.x = -1.2;
      b.add(mane);
    }
    for (const s of [1, -1]) {
      for (const z of [0.24, -0.3]) {
        const leg = pivot(0.11 * s, 0.42, z, k.mesh(G.cyl, P.main, [0.04, 0.36, 0.04], [0, -0.18, 0]));
        leg.add(k.ball(0.045, P.accent, [0, -0.38, 0], [1, 0.7, 1.2]));
        const puff = k.ball(0.06, '#ffffff', [0, -0.4, -0.02]);
        puff.castShadow = false;
        leg.add(puff);
        b.add(leg);
        m.legs.push(leg);
      }
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.6, -0.36);
    for (let i = 0; i < 3; i++) {
      const tuft = k.mesh(G.cone, i === 1 ? P.accent : '#ffffff', [0.05, 0.22, 0.05], [(i - 1) * 0.04, -0.04, -0.1], i === 1 ? P.accent : undefined);
      tuft.rotation.x = -2.2 + (i - 1) * 0.2;
      tail.add(tuft);
    }
    b.add(tail);
    m.tail = tail;
    const glow = glowSprite('#bfffe8', 2.0, 0.35);
    glow.position.y = 0.6;
    b.add(glow);
    m.height = 1.25;
  },
} satisfies Record<string, Builder>);

/** A little visiting angel for the Angel event. */
export function buildCherub(): THREE.Group {
  const k = new Kit();
  const g = new THREE.Group();
  const robe = k.mesh(G.cone, '#ffffff', [0.26, 0.5, 0.26], [0, 0.25, 0]);
  g.add(robe);
  g.add(k.ball(0.2, '#ffe0c8', [0, 0.62, 0]));
  k.eye(g, 0.07, 0.65, 0.16, 0.035);
  k.eye(g, -0.07, 0.65, 0.16, 0.035);
  g.add(k.ball(0.04, '#ff9ab0', [0.11, 0.58, 0.14], [1, 0.6, 0.5]));
  g.add(k.ball(0.04, '#ff9ab0', [-0.11, 0.58, 0.14], [1, 0.6, 0.5]));
  g.add(k.ball(0.15, '#ffe27a', [0, 0.74, -0.03], [1.1, 0.6, 1.1]));
  const halo = k.mesh(new THREE.TorusGeometry(1, 0.14, 6, 24), '#ffe27a', [0.15, 0.15, 0.15], [0, 0.92, 0], '#ffd23d');
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  const wings: THREE.Object3D[] = [];
  for (const s of [1, -1]) {
    const wing = new THREE.Group();
    wing.position.set(0.1 * s, 0.42, -0.12);
    for (let i = 0; i < 3; i++) {
      const f = k.ball(0.16 - i * 0.03, '#ffffff', [(0.14 + i * 0.12) * s, 0.08 - i * 0.06, -0.04], [1, 0.3, 0.5]);
      f.rotation.z = (0.6 - i * 0.3) * s;
      wing.add(f);
    }
    g.add(wing);
    wings.push(wing);
  }
  addOutlines(g, 2.4);
  const glow = glowSprite('#fff3b0', 2.2, 0.6);
  glow.position.y = 0.5;
  g.add(glow);
  g.userData.wings = wings;
  return g;
}

// ---------------------------------------------------------------- level-reward creatures

Object.assign(PALETTES, {
  jackalope: { main: '#d8b88a', second: '#8a6a4a', accent: '#f4e8d0', belly: '#fff6e8' },
  kitsune: { main: '#ff9a4a', second: '#ffffff', accent: '#ff5a8a', belly: '#fff2e0' },
  flyingsnake: { main: '#5fd0a0', second: '#2a9a7a', accent: '#ffd23d', belly: '#e8fff0' },
  pegasus: { main: '#ffffff', second: '#a8d8ff', accent: '#ffd86a', belly: '#f4f8ff' },
  griffin: { main: '#c89a4a', second: '#ffffff', accent: '#ffb02a', belly: '#f4dca8' },
  hippocampus: { main: '#3ac8c8', second: '#2a8aa8', accent: '#a8ffe8', belly: '#e0fff8' },
  thunderbird: { main: '#2a3a7a', second: '#1a2450', accent: '#ffd83d', belly: '#c9d4ff' },
  baku: { main: '#3a3a4a', second: '#f4f0ff', accent: '#b9a6ff', belly: '#f4f0ff' },
  sphinx: { main: '#e8c070', second: '#3a6ad0', accent: '#ffd23d', belly: '#f8e8c0' },
  unicorn: { main: '#ffffff', second: '#ff9ee8', accent: '#ffd86a', belly: '#fff6fc' },
});
MYTHIC_GLOW.unicorn = '#ff9ee8';

interface BeastOpts {
  /** Body length and height. */
  long: number;
  tall: number;
  snout: 'horse' | 'cat' | 'fox' | 'beak' | 'trunk';
  ears: 'pointy' | 'long' | 'round' | 'none';
  horn?: 'unicorn' | 'antlers';
  wings?: boolean;
  tails?: number;
  mane?: string;
  headdress?: boolean;
}

/** A four-legged beast; options shape it into a horse, fox, cat, tapir or griffin. */
function beast(k: Kit, P: Palette, m: Parameters<Builder>[2], o: BeastOpts) {
  const b = m.body;
  const hip = o.tall;
  b.add(k.ball(0.24, P.main, [0, hip + 0.06, -0.02], [0.8, 0.78, o.long]));
  b.add(k.ball(0.17, P.belly, [0, hip + 0.02, 0.02], [0.72, 0.6, o.long * 0.9]));
  const neckZ = 0.24 * o.long;
  b.add(k.ball(0.11, P.main, [0, hip + 0.28, neckZ], [0.85, 1.4, 0.85]));
  const head = new THREE.Group();
  head.position.set(0, hip + 0.48, neckZ + 0.1);
  head.add(k.ball(0.15, P.main, [0, 0, 0], [0.95, 0.95, 1.05]));
  if (o.snout === 'horse') head.add(k.ball(0.1, P.main, [0, -0.05, 0.14], [0.9, 0.8, 1.4]));
  if (o.snout === 'fox') head.add(k.mesh(G.cone, P.main, [0.07, 0.18, 0.07], [0, -0.03, 0.17]).rotateX(Math.PI / 2));
  if (o.snout === 'cat') head.add(k.ball(0.07, P.belly, [0, -0.05, 0.12], [1.3, 0.8, 0.8]));
  if (o.snout === 'trunk') {
    const trunk = k.mesh(G.cyl, P.main, [0.04, 0.2, 0.04], [0, -0.1, 0.18]);
    trunk.rotation.x = 1.0;
    head.add(trunk);
  }
  if (o.snout === 'beak') {
    const beak = k.mesh(G.cone, P.accent, [0.06, 0.14, 0.06], [0, -0.02, 0.17]);
    beak.rotation.x = Math.PI / 2 + 0.4;
    head.add(beak);
  }
  for (const s of [1, -1]) {
    k.eye(head, s * 0.07, 0.04, 0.11, 0.04);
    if (o.ears === 'pointy') {
      const ear = k.mesh(G.cone, P.main, [0.05, 0.13, 0.04], [s * 0.08, 0.15, -0.02]);
      ear.rotation.z = -0.25 * s;
      head.add(ear);
    } else if (o.ears === 'long') {
      head.add(k.ball(0.05, P.main, [s * 0.06, 0.24, -0.03], [0.7, 2.6, 0.5]));
    } else if (o.ears === 'round') {
      head.add(k.ball(0.05, P.main, [s * 0.11, 0.1, -0.02], [1, 1, 0.5]));
    }
    if (o.horn === 'antlers') {
      const a1 = k.mesh(G.cone, P.accent, [0.02, 0.15, 0.02], [s * 0.05, 0.2, 0.02]);
      a1.rotation.z = -0.4 * s;
      head.add(a1);
      const a2 = k.mesh(G.cone, P.accent, [0.015, 0.08, 0.015], [s * 0.1, 0.22, 0.02]);
      a2.rotation.z = -1.1 * s;
      head.add(a2);
    }
    for (const z of [0.18 * o.long, -0.18 * o.long]) {
      const leg = pivot(s * 0.1, hip - 0.04, z, k.mesh(G.cyl, P.main, [0.035, hip, 0.035], [0, -hip / 2, 0]));
      leg.add(k.ball(0.04, o.snout === 'horse' ? P.accent : P.main, [0, -hip, 0.01], [1, 0.6, 1.2]));
      b.add(leg);
      m.legs.push(leg);
    }
  }
  if (o.horn === 'unicorn') {
    const horn = k.mesh(G.cone, P.accent, [0.035, 0.24, 0.035], [0, 0.2, 0.08], P.accent);
    horn.rotation.x = 0.5;
    head.add(horn);
  }
  if (o.headdress) {
    for (const s of [1, -1]) {
      const flap = k.ball(0.09, P.second, [s * 0.13, -0.06, -0.02], [0.4, 1.5, 0.8]);
      head.add(flap);
    }
    head.add(k.ball(0.16, P.accent, [0, 0.07, -0.02], [1.05, 0.55, 1.05]));
  }
  b.add(head);
  if (o.mane) {
    for (let i = 0; i < 4; i++) {
      const tuft = k.mesh(G.cone, i % 2 ? o.mane : P.second, [0.04, 0.14, 0.04], [0, hip + 0.42 - i * 0.07, neckZ - 0.02 - i * 0.05]);
      tuft.rotation.x = -1.3;
      b.add(tuft);
    }
  }
  if (o.wings) {
    for (const s of [1, -1]) {
      const wing = new THREE.Group();
      wing.position.set(s * 0.16, hip + 0.18, 0.02);
      for (let i = 0; i < 3; i++) {
        const f = k.ball(0.15 - i * 0.025, i === 2 ? P.second : '#ffffff', [(0.14 + i * 0.12) * s, 0.06 - i * 0.04, -0.03 - i * 0.03], [1.1, 0.13, 0.55]);
        f.rotation.z = (-0.35 + i * 0.1) * s;
        wing.add(f);
      }
      b.add(wing);
      m.wings.push(wing);
    }
  }
  const tail = new THREE.Group();
  tail.position.set(0, hip + 0.1, -0.26 * o.long);
  const n = o.tails ?? 1;
  for (let i = 0; i < n; i++) {
    const spread = n > 1 ? (i / (n - 1) - 0.5) * 1.6 : 0;
    const t = new THREE.Group();
    t.rotation.set(-0.6, 0, spread);
    t.add(k.ball(0.08, o.mane ?? P.main, [0, 0.12, -0.08], [0.9, 2.0, 0.9]));
    t.add(k.ball(0.06, P.second, [0, 0.3, -0.12]));
    tail.add(t);
  }
  b.add(tail);
  m.tail = tail;
  m.height = hip + 0.7;
}

Object.assign(BUILDERS, {
  jackalope: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.26, P.main, [0, 0.27, -0.04], [1, 0.9, 1.1]));
    b.add(k.ball(0.2, P.main, [0, 0.5, 0.17]));
    b.add(k.ball(0.12, P.belly, [0, 0.45, 0.3], [1, 0.8, 0.6]));
    k.eye(b, 0.08, 0.54, 0.32, 0.045);
    k.eye(b, -0.08, 0.54, 0.32, 0.045);
    for (const s of [1, -1]) {
      b.add(k.ball(0.05, P.main, [s * 0.07, 0.75, 0.12], [0.7, 2.4, 0.5]));
      const a1 = k.mesh(G.cone, P.accent, [0.02, 0.16, 0.02], [s * 0.09, 0.78, 0.2]);
      a1.rotation.z = -0.5 * s;
      b.add(a1);
      const a2 = k.mesh(G.cone, P.accent, [0.015, 0.08, 0.015], [s * 0.15, 0.8, 0.2]);
      a2.rotation.z = -1.2 * s;
      b.add(a2);
      const leg = pivot(s * 0.12, 0.12, 0.08, k.ball(0.06, P.main, [0, -0.04, 0.03], [0.8, 0.6, 1.4]));
      b.add(leg);
      m.legs.push(leg);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.28, -0.3);
    tail.add(k.ball(0.08, P.belly, [0, 0, 0]));
    b.add(tail);
    m.tail = tail;
    m.height = 0.85;
  },
  kitsune: (k, P, m) => {
    beast(k, P, m, { long: 1.2, tall: 0.3, snout: 'fox', ears: 'pointy', tails: 5, mane: '#ffffff' });
    const glow = glowSprite('#ff9ab8', 1.6, 0.4);
    glow.position.set(0, 0.5, -0.4);
    m.body.add(glow);
  },
  pegasus: (k, P, m) => beast(k, P, m, { long: 1.45, tall: 0.42, snout: 'horse', ears: 'pointy', wings: true, mane: '#a8d8ff' }),
  unicorn: (k, P, m) => beast(k, P, m, { long: 1.45, tall: 0.42, snout: 'horse', ears: 'pointy', horn: 'unicorn', mane: '#ff9ee8' }),
  griffin: (k, P, m) => beast(k, P, m, { long: 1.3, tall: 0.32, snout: 'beak', ears: 'none', wings: true, mane: '#ffffff' }),
  sphinx: (k, P, m) => beast(k, P, m, { long: 1.3, tall: 0.28, snout: 'cat', ears: 'none', headdress: true }),
  baku: (k, P, m) => {
    beast(k, P, m, { long: 1.35, tall: 0.3, snout: 'trunk', ears: 'round' });
    // two-tone: a pale saddle across its back, and drifting dream-stars
    m.body.add(k.ball(0.22, P.second, [0, 0.4, -0.05], [0.85, 0.6, 0.9]));
    for (let i = 0; i < 4; i++) {
      const star = k.ball(0.03, P.accent, [Math.sin(i * 1.7) * 0.3, 0.75 + (i % 2) * 0.15, Math.cos(i * 1.7) * 0.3], [1, 1, 1], P.accent);
      star.userData.noOutline = true;
      m.body.add(star);
    }
  },
  thunderbird: (k, P, m) => {
    bird(k, P, m, true);
    m.body.scale.setScalar(1.25);
    for (const w of m.wings) w.scale.set(1.6, 1.3, 1.6);
    const glow = glowSprite('#ffe14d', 1.8, 0.35);
    glow.position.y = 0.5;
    m.body.add(glow);
    m.height = 1.05;
  },
  flyingsnake: (k, P, m) => {
    snake(k, P, m, false);
    for (const s of [1, -1]) {
      const wing = new THREE.Group();
      wing.position.set(0.1 * s, 0.22, 0.06);
      for (let i = 0; i < 3; i++) {
        const f = k.ball(0.12 - i * 0.02, i === 2 ? P.accent : '#ffffff', [(0.1 + i * 0.1) * s, 0.04 - i * 0.03, -0.02], [1.1, 0.12, 0.5]);
        f.rotation.z = -0.3 * s;
        wing.add(f);
      }
      m.segments[1]?.add(wing);
      m.wings.push(wing);
    }
  },
  hippocampus: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.22, P.main, [0, 0.3, 0.08], [0.8, 0.9, 1]));
    b.add(k.ball(0.1, P.main, [0, 0.52, 0.2], [0.85, 1.4, 0.85]));
    const head = new THREE.Group();
    head.position.set(0, 0.7, 0.28);
    head.add(k.ball(0.14, P.main, [0, 0, 0]));
    head.add(k.ball(0.09, P.main, [0, -0.04, 0.13], [0.9, 0.8, 1.4]));
    k.eye(head, 0.07, 0.04, 0.1, 0.04);
    k.eye(head, -0.07, 0.04, 0.1, 0.04);
    for (const s of [1, -1]) {
      const fin = k.mesh(G.cone, P.accent, [0.05, 0.14, 0.03], [s * 0.08, 0.13, -0.03]);
      fin.rotation.z = -0.3 * s;
      head.add(fin);
      const leg = pivot(s * 0.1, 0.2, 0.2, k.mesh(G.cyl, P.main, [0.03, 0.16, 0.03], [0, -0.08, 0.02]));
      b.add(leg);
      m.wings.push(leg);
    }
    b.add(head);
    for (let i = 0; i < 4; i++) {
      const tuft = k.mesh(G.cone, P.accent, [0.035, 0.12, 0.035], [0, 0.66 - i * 0.08, 0.14 - i * 0.06]);
      tuft.rotation.x = -1.3;
      b.add(tuft);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.24, -0.12);
    for (let i = 0; i < 4; i++) tail.add(k.ball(0.15 - i * 0.03, i % 2 ? P.second : P.main, [0, -i * 0.02, -i * 0.15]));
    for (const s of [1, -1]) {
      const fluke = k.ball(0.1, P.accent, [s * 0.08, -0.04, -0.62], [1.1, 0.25, 0.7]);
      fluke.rotation.y = 0.5 * s;
      tail.add(fluke);
    }
    b.add(tail);
    m.tail = tail;
    m.height = 0.85;
  },
} satisfies Record<string, Builder>);

// ---------------------------------------------------------------- wanderers

/** The travellers who drop by: little round folk with a hat and a prop each. */
export function buildWanderer(kind: 'fortune' | 'treasure' | 'chef' | 'gnome' | 'goblin'): THREE.Group {
  const k = new Kit();
  const g = new THREE.Group();
  const look = {
    fortune: { robe: '#7a4ab8', skin: '#f2c79a', hat: '#4a2a8a', h: 1 },
    treasure: { robe: '#a8743a', skin: '#e8b88a', hat: '#6a4a2a', h: 1 },
    chef: { robe: '#ffffff', skin: '#f6d0a8', hat: '#ffffff', h: 1 },
    gnome: { robe: '#3a7ad8', skin: '#f6c8a8', hat: '#e2483d', h: 0.8 },
    goblin: { robe: '#6a4a2a', skin: '#7ac04a', hat: '#4a3a2a', h: 0.85 },
  }[kind];
  // body: a soft robe
  g.add(k.ball(0.32, look.robe, [0, 0.32, 0], [1, 1.05, 0.95]));
  const head = new THREE.Group();
  head.position.set(0, 0.78, 0);
  head.add(k.ball(0.25, look.skin, [0, 0, 0]));
  for (const s of [1, -1]) k.eye(head, s * 0.09, 0.03, 0.2, 0.06);
  head.add(k.ball(0.05, kind === 'goblin' ? '#5a9a3a' : '#ff9a8a', [0, -0.05, 0.25]));
  if (kind === 'fortune') {
    // headscarf and a glowing crystal ball
    head.add(k.ball(0.27, look.hat, [0, 0.07, -0.02], [1.02, 0.75, 1.02]));
    head.add(k.ball(0.05, '#ffd36a', [0, 0.16, 0.24]));
    const orb = k.ball(0.14, '#c8a8ff', [0, 0.42, 0.34], [1, 1, 1], '#9a6aff');
    g.add(orb);
    g.userData.prop = orb;
  } else if (kind === 'treasure') {
    // explorer hat and a rolled map
    head.add(k.mesh(G.cyl, look.hat, [0.38, 0.03, 0.38], [0, 0.1, 0]));
    head.add(k.mesh(G.cyl, look.hat, [0.2, 0.16, 0.2], [0, 0.18, 0]));
    const map = k.mesh(G.cyl, '#f4e2b0', [0.07, 0.34, 0.07], [0.22, 0.42, 0.28]);
    map.rotation.z = Math.PI / 2.4;
    g.add(map);
    g.userData.prop = map;
  } else if (kind === 'chef') {
    // tall chef's hat and a little pot
    head.add(k.mesh(G.cyl, '#ffffff', [0.16, 0.2, 0.16], [0, 0.26, 0]));
    head.add(k.ball(0.2, '#ffffff', [0, 0.42, 0], [1, 0.7, 1]));
    const pot = k.mesh(G.cyl, '#5a6a7a', [0.16, 0.13, 0.16], [0, 0.4, 0.32]);
    g.add(pot);
    g.add(k.ball(0.12, '#ffb02a', [0, 0.47, 0.32], [1, 0.4, 1]));
    g.userData.prop = pot;
  } else if (kind === 'gnome') {
    // pointy red hat, white beard and a tiny sapling
    const hat = k.mesh(G.cone, look.hat, [0.25, 0.5, 0.25], [0, 0.32, 0]);
    hat.rotation.z = 0.15;
    head.add(hat);
    head.add(k.ball(0.18, '#ffffff', [0, -0.14, 0.12], [1.1, 1, 0.7]));
    const sprout = k.mesh(G.cone, '#5fbf4a', [0.09, 0.22, 0.09], [0.28, 0.48, 0.2]);
    g.add(sprout);
    g.add(k.mesh(G.cyl, '#b0642e', [0.1, 0.12, 0.1], [0.28, 0.33, 0.2]));
    g.userData.prop = sprout;
  } else {
    // goblin: big pointy ears, a hood and a sack over his shoulder
    for (const s of [1, -1]) {
      const ear = k.mesh(G.cone, look.skin, [0.08, 0.3, 0.08], [s * 0.27, 0.06, 0]);
      ear.rotation.z = -s * 1.2;
      head.add(ear);
    }
    head.add(k.ball(0.26, look.hat, [0, 0.08, -0.05], [1.02, 0.75, 1.02]));
    const sack = k.ball(0.2, '#c8a46a', [-0.22, 0.6, -0.2]);
    g.add(sack);
    g.userData.prop = sack;
  }
  g.add(head);
  g.userData.head = head;
  // a little bigger than the creatures, so you spot them
  g.scale.setScalar(look.h * 1.4);
  addOutlines(g, 2.8);
  return g;
}

/** Wanderers bob and look about; the Goblin sneaks with a crouch. */
export function animateWanderer(g: THREE.Group, t: number, sneaky: boolean): void {
  const head = g.userData.head as THREE.Group;
  head.rotation.y = Math.sin(t * (sneaky ? 3 : 0.9)) * (sneaky ? 0.6 : 0.3);
  g.children[0].position.y = 0.32 + Math.abs(Math.sin(t * (sneaky ? 9 : 4))) * 0.03;
  const prop = g.userData.prop as THREE.Object3D | undefined;
  if (prop) prop.position.y += Math.sin(t * 2) * 0.0008;
}

// ---------------------------------------------------------------- wave 2 creatures

Object.assign(PALETTES, {
  hedgehum: { main: '#c9a27a', second: '#7a5a42', accent: '#f7a6c4', belly: '#fff0dc' },
  magmole: { main: '#5a4a52', second: '#3a2e34', accent: '#ff8a3a', belly: '#8a7078' },
  ashowl: { main: '#8a8590', second: '#5a5660', accent: '#ffb04a', belly: '#e8e2da' },
  bubblecrab: { main: '#ff7a5a', second: '#e2483e', accent: '#bfefff', belly: '#ffe0c8' },
  glidemanta: { main: '#3a5aa8', second: '#24397a', accent: '#bfe8ff', belly: '#eaf6ff' },
  sandotter: { main: '#a8784e', second: '#7a5232', accent: '#9aa7a0', belly: '#f2dcc0' },
  conchsnail: { main: '#9fd0c0', second: '#f7b8a0', accent: '#fff1e0', belly: '#d8f0e8' },
  dunefox: { main: '#f0c88a', second: '#d89a5a', accent: '#ffb0a0', belly: '#fff6e4' },
  aurorastag: { main: '#c9d2ff', second: '#8a7aff', accent: '#5affc0', belly: '#f4f6ff' },
  prismkoi: { main: '#ffe8f4', second: '#ff6a8a', accent: '#6ad8ff', belly: '#ffffff' },
});
Object.assign(MYTHIC_GLOW, { aurorastag: '#5affc0', prismkoi: '#ff9ee8' });

const RAINBOW = ['#ff5a5a', '#ffa83a', '#ffe14d', '#5fd06a', '#4ab8ff', '#9a6aff'];

Object.assign(BUILDERS, {
  hedgehum: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.3, P.belly, [0, 0.26, 0.02], [1, 0.85, 1.15]));
    // a brown spiky coat over the back; spines point straight out from it
    b.add(k.ball(0.31, P.main, [0, 0.29, -0.05], [1.02, 0.9, 1.1]));
    const up = new THREE.Vector3(0, 1, 0);
    for (let r = 0; r < 4; r++) {
      const n = 5 + r;
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1) - 0.5) * 2.6;
        const el = 1.25 - r * 0.32;
        const dir = new THREE.Vector3(Math.sin(a) * Math.cos(el) * 0.9, Math.cos(a) * Math.cos(el) * 0.9 + 0.1, -Math.sin(el) - 0.15 + r * 0.05).normalize();
        const sp = k.mesh(G.cone, r % 2 ? P.second : P.main, [0.055, 0.24, 0.055],
          [dir.x * 0.36, 0.29 + dir.y * 0.33, -0.05 + dir.z * 0.39]);
        sp.quaternion.setFromUnitVectors(up, dir);
        b.add(sp);
      }
    }
    const nose = k.mesh(G.cone, P.belly, [0.09, 0.16, 0.09], [0, 0.22, 0.36]);
    nose.rotation.x = Math.PI / 2;
    nose.userData.head = true;
    b.add(nose);
    b.add(k.ball(0.035, '#2a1d16', [0, 0.22, 0.45]));
    k.eye(b, 0.09, 0.32, 0.31, 0.045);
    k.eye(b, -0.09, 0.32, 0.31, 0.045);
    for (const s of [1, -1]) {
      b.add(k.ball(0.04, P.accent, [s * 0.15, 0.24, 0.3], [1, 0.6, 0.5]));
      for (const z of [0.16, -0.14]) {
        const leg = pivot(s * 0.14, 0.1, z, k.ball(0.05, P.second, [0, -0.04, 0.02], [0.9, 0.7, 1.2]));
        b.add(leg);
        m.legs.push(leg);
      }
    }
    // petals stuck in its spines
    for (const [x, y, z] of [[0.12, 0.52, -0.05], [-0.16, 0.44, -0.2]] as const) {
      const f = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        f.add(k.ball(0.035, P.accent, [Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04]));
      }
      f.add(k.ball(0.025, '#ffe066', [0, 0.01, 0]));
      f.position.set(x, y, z);
      f.rotation.x = 0.4;
      b.add(f);
    }
    m.height = 0.75;
  },
  magmole: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.3, P.main, [0, 0.3, -0.02], [1, 0.9, 1.2]));
    b.add(k.ball(0.22, P.belly, [0, 0.26, 0.1], [0.9, 0.8, 0.9]));
    // glowing nose and sleepy little eyes
    b.add(k.ball(0.08, P.accent, [0, 0.33, 0.38], [1, 0.85, 1], P.accent));
    k.eye(b, 0.1, 0.44, 0.27, 0.04);
    k.eye(b, -0.1, 0.44, 0.27, 0.04);
    for (const s of [1, -1]) {
      b.add(k.ball(0.035, P.accent, [s * 0.15, 0.32, 0.3], [1, 0.6, 0.5]));
      // big digging paws
      const paw = pivot(s * 0.24, 0.24, 0.22, k.ball(0.09, P.accent, [s * 0.04, -0.06, 0.03], [1.2, 0.5, 1]));
      for (let i = 0; i < 3; i++) {
        const claw = k.mesh(G.cone, '#fff1e0', [0.018, 0.07, 0.018], [s * 0.04 + (i - 1) * 0.04, -0.07, 0.12]);
        claw.rotation.x = Math.PI / 2;
        paw.add(claw);
      }
      paw.rotation.z = -0.4 * s;
      b.add(paw);
      m.wings.push(paw);
      const leg = pivot(s * 0.13, 0.08, -0.16, k.ball(0.06, P.second, [0, -0.02, 0.02], [1, 0.6, 1.3]));
      b.add(leg);
      m.legs.push(leg);
    }
    // a few hot cracks on its back
    for (let i = 0; i < 3; i++) b.add(k.ball(0.03, P.accent, [(i - 1) * 0.1, 0.56, -0.08 - i * 0.05], [1.6, 0.4, 0.6], P.accent));
    const tail = new THREE.Group();
    tail.position.set(0, 0.24, -0.34);
    tail.add(k.ball(0.04, P.accent, [0, 0.02, -0.06], [0.8, 0.8, 2]));
    b.add(tail);
    m.tail = tail;
    m.height = 0.7;
  },
  ashowl: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.32, P.main, [0, 0.38, 0], [1, 1.08, 0.95]));
    b.add(k.ball(0.24, P.belly, [0, 0.32, 0.12], [1, 1, 0.85]));
    // face disc with big wise eyes
    b.add(k.ball(0.2, P.belly, [0, 0.52, 0.18], [1.3, 0.85, 0.5]));
    k.eye(b, 0.1, 0.54, 0.27, 0.08);
    k.eye(b, -0.1, 0.54, 0.27, 0.08);
    for (const s of [1, -1]) b.add(k.ball(0.085, P.accent, [s * 0.1, 0.54, 0.24], [1, 1, 0.3]));
    const beak = k.mesh(G.cone, P.accent, [0.04, 0.1, 0.04], [0, 0.44, 0.31]);
    beak.rotation.x = Math.PI / 2 + 0.6;
    b.add(beak);
    for (const s of [1, -1]) {
      const tuft = k.mesh(G.cone, P.second, [0.06, 0.18, 0.05], [s * 0.17, 0.74, 0.05]);
      tuft.rotation.z = -0.35 * s;
      b.add(tuft);
      b.add(k.ball(0.025, P.accent, [s * 0.2, 0.83, 0.05], [1, 1, 1], P.accent));
      const wing = pivot(0.29 * s, 0.42, -0.02, k.ball(0.17, P.second, [0.03 * s, -0.05, 0], [0.4, 0.95, 1.1]));
      wing.add(k.ball(0.06, P.accent, [0.04 * s, -0.2, -0.04], [0.5, 0.8, 1], P.accent));
      b.add(wing);
      m.wings.push(wing);
      const leg = pivot(0.1 * s, 0.1, 0.04, k.mesh(G.cyl, P.accent, [0.025, 0.12, 0.025], [0, -0.03, 0]));
      b.add(leg);
      m.legs.push(leg);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.3, -0.28);
    tail.add(k.ball(0.08, P.second, [0, -0.04, -0.06], [1, 0.4, 1.4]));
    b.add(tail);
    m.tail = tail;
    m.height = 0.9;
  },
  bubblecrab: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.24, P.main, [0, 0.2, 0], [1.25, 0.6, 1]));
    b.add(k.ball(0.18, P.belly, [0, 0.15, 0.06], [1.2, 0.45, 0.9]));
    for (const s of [1, -1]) {
      const stalk = k.mesh(G.cyl, P.main, [0.02, 0.12, 0.02], [s * 0.08, 0.36, 0.14]);
      b.add(stalk);
      k.eye(b, s * 0.08, 0.44, 0.15, 0.05);
      const arm = pivot(0.24 * s, 0.2, 0.14, k.ball(0.04, P.main, [0.05 * s, 0.02, 0.05], [1, 1, 1.8]));
      arm.add(k.ball(0.1, P.second, [0.1 * s, 0.06, 0.15], [1, 0.8, 1.1]));
      const pinch = k.mesh(G.cone, P.second, [0.035, 0.1, 0.035], [0.07 * s, 0.1, 0.24]);
      pinch.rotation.x = Math.PI / 2 - 0.3;
      arm.add(pinch);
      b.add(arm);
      m.wings.push(arm);
      for (let i = 0; i < 3; i++) {
        const leg = pivot(0.24 * s, 0.14, 0.04 - i * 0.1, k.mesh(G.cyl, P.second, [0.018, 0.16, 0.018], [0.06 * s, -0.05, 0]));
        leg.rotation.z = 0.8 * s;
        b.add(leg);
        m.legs.push(leg);
      }
    }
    b.add(k.ball(0.06, '#c23a3a', [0, 0.2, 0.25], [1.2, 0.5, 0.4]));
    // its happy bubble
    const bubble = k.ball(0.08, P.accent, [0.06, 0.4, 0.3], [1, 1, 1], '#ffffff');
    bubble.userData.noOutline = true;
    b.add(bubble);
    b.add(k.ball(0.04, P.accent, [-0.05, 0.36, 0.32], [1, 1, 1], '#ffffff'));
    m.height = 0.55;
  },
  glidemanta: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.22, P.main, [0, 0.14, 0], [1.05, 0.38, 1.4]));
    b.add(k.ball(0.19, P.belly, [0, 0.1, 0.02], [1, 0.3, 1.3]));
    for (const s of [1, -1]) {
      const wing = new THREE.Group();
      wing.position.set(s * 0.18, 0.14, 0);
      const w = k.ball(0.26, P.main, [s * 0.22, 0, -0.02], [1.1, 0.12, 0.85]);
      w.rotation.y = 0.35 * s;
      wing.add(w);
      wing.add(k.ball(0.06, P.accent, [s * 0.26, 0.03, -0.02], [1, 0.3, 1], P.accent));
      b.add(wing);
      m.wings.push(wing);
      // little horn-fins by the face
      const fin = k.ball(0.05, P.second, [s * 0.11, 0.14, 0.32], [0.6, 0.4, 1.4]);
      fin.rotation.y = -0.3 * s;
      b.add(fin);
      k.eye(b, s * 0.15, 0.2, 0.22, 0.045, new THREE.Vector3(s, 0, 0.5));
    }
    for (let i = 0; i < 4; i++) b.add(k.ball(0.025, P.accent, [(i - 1.5) * 0.06, 0.22, -0.05 - (i % 2) * 0.06], [1, 1, 1], P.accent));
    const tail = new THREE.Group();
    tail.position.set(0, 0.14, -0.28);
    const whip = k.mesh(G.cone, P.second, [0.025, 0.42, 0.025], [0, 0, -0.2]);
    whip.rotation.x = -Math.PI / 2;
    tail.add(whip);
    b.add(tail);
    m.tail = tail;
    m.height = 0.45;
  },
  sandotter: (k, P, m) => {
    beast(k, P, m, { long: 1.6, tall: 0.14, snout: 'cat', ears: 'round' });
    // a long, thick tail instead of a fluffy one
    const tail = m.tail!;
    tail.clear();
    const t = k.mesh(G.cone, P.main, [0.08, 0.42, 0.06], [0, -0.06, -0.2]);
    t.rotation.x = -Math.PI / 2 - 0.25;
    tail.add(t);
    // a favourite pebble held on its tummy
    m.body.add(k.ball(0.05, P.accent, [0, 0.2, 0.26], [1.2, 0.8, 1]));
    for (const s of [1, -1]) m.body.add(k.ball(0.012, '#2a1d16', [s * 0.04, 0.58, 0.48]));
  },
  conchsnail: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.14, P.main, [0, 0.1, 0.06], [1, 0.6, 2.4]));
    b.add(k.ball(0.12, P.main, [0, 0.2, 0.32], [0.9, 1.1, 0.9]));
    for (const s of [1, -1]) {
      const stalk = k.mesh(G.cyl, P.main, [0.018, 0.16, 0.018], [s * 0.05, 0.36, 0.34]);
      stalk.rotation.z = -0.2 * s;
      b.add(stalk);
      k.eye(b, s * 0.07, 0.45, 0.35, 0.04);
    }
    b.add(k.ball(0.03, P.second, [0, 0.16, 0.43], [1.4, 0.5, 0.5]));
    // the spiral conch: shrinking rings climbing to a point
    const shell = new THREE.Group();
    shell.position.set(0, 0.24, -0.06);
    shell.rotation.x = -0.5;
    for (let i = 0; i < 6; i++) {
      const r = 0.2 - i * 0.03;
      const a = i * 1.3;
      shell.add(k.ball(r, i % 2 ? P.second : P.accent, [Math.cos(a) * 0.04, i * 0.07, Math.sin(a) * 0.04], [1, 0.7, 1]));
    }
    const tip = k.mesh(G.cone, P.second, [0.05, 0.12, 0.05], [0, 0.46, 0]);
    shell.add(tip);
    shell.userData.measure = true;
    b.add(shell);
    m.tail = shell;
    m.height = 0.75;
  },
  dunefox: (k, P, m) => {
    beast(k, P, m, { long: 1.15, tall: 0.26, snout: 'fox', ears: 'none', mane: P.belly });
    // enormous ears
    const head = m.body.children.find((c) => c instanceof THREE.Group && c.position.y > 0.6) ?? m.body;
    for (const s of [1, -1]) {
      const ear = k.mesh(G.cone, P.main, [0.1, 0.32, 0.04], [s * 0.13, 0.22, -0.03]);
      ear.rotation.z = -0.45 * s;
      ear.add(k.mesh(G.cone, P.accent, [0.55, 0.75, 0.5], [0, -0.04, 0.4]));
      head.add(ear);
    }
  },
  aurorastag: (k, P, m) => {
    beast(k, P, m, { long: 1.35, tall: 0.42, snout: 'horse', ears: 'pointy', mane: P.accent });
    const head = m.body.children.find((c) => c instanceof THREE.Group && c.position.y > 0.8) ?? m.body;
    // branching antlers that hold the northern lights
    for (const s of [1, -1]) {
      const antler = new THREE.Group();
      antler.position.set(s * 0.06, 0.13, -0.02);
      antler.rotation.z = -0.35 * s;
      const main = k.mesh(G.cyl, '#ffffff', [0.02, 0.36, 0.02], [0, 0.18, 0]);
      antler.add(main);
      for (let i = 0; i < 3; i++) {
        const tine = k.mesh(G.cyl, RAINBOW[(i * 2 + (s > 0 ? 3 : 4)) % 6], [0.014, 0.14, 0.014], [s * 0.05, 0.1 + i * 0.1, 0], RAINBOW[(i * 2 + (s > 0 ? 3 : 4)) % 6]);
        tine.rotation.z = -0.9 * s;
        antler.add(tine);
      }
      antler.add(k.ball(0.03, P.accent, [0, 0.37, 0], [1, 1, 1], P.accent));
      head.add(antler);
    }
    const glow = glowSprite('#5affc0', 1.4, 0.35);
    glow.position.set(0, 1.1, 0.3);
    m.body.add(glow);
    m.height += 0.3;
  },
  prismkoi: (k, P, m) => {
    fish(k, P, m, true);
    // every scale a different colour
    for (let i = 0; i < 12; i++) {
      const a = i * 2.1;
      const c = RAINBOW[i % 6];
      m.body.add(k.ball(0.055, c, [Math.cos(a) * 0.18, 0.1 + Math.sin(i * 1.7) * 0.12, -0.2 + (i / 11) * 0.42], [1, 1, 0.4], c));
    }
    const glow = glowSprite('#ff9ee8', 1.2, 0.35);
    glow.position.set(0, 0.2, 0);
    m.body.add(glow);
  },
} satisfies Record<string, Builder>);

// ---------------------------------------------------------------- star keeper rewards (levels 60-100)

Object.assign(PALETTES, {
  moonrabbit: { main: '#eeeaff', second: '#c9b8ff', accent: '#ffe680', belly: '#ffffff' },
  tanuki: { main: '#9a7552', second: '#3a2e2a', accent: '#5fbf5a', belly: '#f2e0c4' },
  shisa: { main: '#f0b04a', second: '#d8483e', accent: '#3aa86a', belly: '#fff0d0' },
  sunmane: { main: '#f2c060', second: '#b8642a', accent: '#5a3a2a', belly: '#fff0c8' },
  embertiger: { main: '#ff9a3a', second: '#2a1a1a', accent: '#ffd23d', belly: '#fff4e0' },
  mossyphant: { main: '#a8b4ac', second: '#6fbf5a', accent: '#ffe0d0', belly: '#c8d0cc' },
  bamboopanda: { main: '#ffffff', second: '#2a2a32', accent: '#7fd05a', belly: '#f4f4f4' },
  waddlefin: { main: '#2a3a5a', second: '#ffffff', accent: '#ff9a2a', belly: '#ffffff' },
  duskbat: { main: '#5a4a7a', second: '#3a2a5a', accent: '#ffd21a', belly: '#8a7aaa' },
  leviathan: { main: '#1f7aa8', second: '#14507a', accent: '#7affe0', belly: '#bff4ff' },
  worldturtle: { main: '#9ab87a', second: '#8a7a5a', accent: '#5fa35a', belly: '#e8dcb8' },
});
Object.assign(MYTHIC_GLOW, { worldturtle: '#b8ff8a' });

Object.assign(BUILDERS, {
  moonrabbit: (k, P, m) => {
    BUILDERS.burrowbun(k, P, m);
    // swap the flower for a little crescent moon that glows
    const b = m.body;
    const flower = b.children.at(-1)!;
    b.remove(flower);
    const moon = new THREE.Group();
    // a little full moon that floats over its head
    moon.add(k.ball(0.08, P.accent, [0, 0, 0], [1, 1, 1], P.accent));
    moon.add(k.ball(0.02, '#e8d070', [0.03, 0.02, 0.07], [1, 1, 0.4]));
    moon.add(k.ball(0.015, '#e8d070', [-0.03, -0.025, 0.07], [1, 1, 0.4]));
    moon.position.set(0, 1.18, 0.12);
    b.add(moon);
    const glow = glowSprite('#fff3b0', 1.0, 0.45);
    glow.position.set(0, 1.18, 0.12);
    b.add(glow);
    // and a rice cake to share
    b.add(k.ball(0.06, '#ffffff', [0.12, 0.22, 0.36], [1.2, 0.7, 1.2]));
  },
  tanuki: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.3, P.main, [0, 0.32, -0.02], [1, 0.95, 1.05]));
    b.add(k.ball(0.24, P.belly, [0, 0.28, 0.1], [1, 1, 0.9]));
    const head = new THREE.Group();
    head.position.set(0, 0.66, 0.08);
    head.add(k.ball(0.2, P.main, [0, 0, 0], [1.1, 0.95, 1]));
    head.add(k.ball(0.09, P.belly, [0, -0.05, 0.16], [1.1, 0.8, 0.8]));
    head.add(k.ball(0.03, '#1a1420', [0, -0.03, 0.24]));
    for (const s of [1, -1]) {
      // the bandit mask
      head.add(k.ball(0.07, P.second, [s * 0.08, 0.02, 0.14], [1.3, 0.8, 0.5]));
      k.eye(head, s * 0.08, 0.03, 0.17, 0.04);
      head.add(k.ball(0.06, P.second, [s * 0.14, 0.16, -0.02], [1, 1, 0.5]));
      const leg = pivot(s * 0.13, 0.1, 0.05, k.ball(0.07, P.second, [0, -0.03, 0.02], [0.9, 0.8, 1.2]));
      b.add(leg);
      m.legs.push(leg);
    }
    // the shape-changing leaf
    const leaf = k.ball(0.09, P.accent, [0, 0.22, 0.02], [0.6, 0.12, 1.2]);
    leaf.rotation.set(0.3, 0.6, 0.2);
    head.add(leaf);
    head.userData.head = true;
    b.add(head);
    m.wings.push(head);
    const tail = new THREE.Group();
    tail.position.set(0, 0.24, -0.3);
    for (let i = 0; i < 4; i++) tail.add(k.ball(0.1 - i * 0.008, i % 2 ? P.second : P.main, [0, 0.02 + i * 0.03, -0.04 - i * 0.07]));
    b.add(tail);
    m.tail = tail;
    m.height = 0.95;
  },
  sunmane: (k, P, m) => {
    beast(k, P, m, { long: 1.25, tall: 0.3, snout: 'cat', ears: 'round', mane: P.second });
    const head = m.body.children.find((c) => c instanceof THREE.Group && c.position.y > 0.6) ?? m.body;
    // a big fluffy mane all around the face
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      head.add(k.ball(0.075, i % 2 ? P.second : '#d8843a', [Math.cos(a) * 0.17, Math.sin(a) * 0.16, -0.05], [1, 1, 0.8]));
    }
    head.add(k.ball(0.03, P.accent, [0, -0.02, 0.15]));
  },
  embertiger: (k, P, m) => {
    beast(k, P, m, { long: 1.3, tall: 0.28, snout: 'cat', ears: 'round' });
    // dark stripes over the back and a glowing tail tip
    for (let i = 0; i < 4; i++) {
      const stripe = k.mesh(G.box, P.second, [0.34, 0.03, 0.035], [0, 0.48, 0.18 - i * 0.11]);
      stripe.rotation.z = (i % 2 ? 1 : -1) * 0.12;
      m.body.add(stripe);
    }
    const tip = m.tail?.children[0];
    if (tip) tip.add(k.ball(0.05, P.accent, [0, 0.36, -0.13], [1, 1, 1], '#ff7a1a'));
  },
  mossyphant: (k, P, m) => {
    beast(k, P, m, { long: 1.2, tall: 0.26, snout: 'trunk', ears: 'none' });
    const head = m.body.children.find((c) => c instanceof THREE.Group && c.position.y > 0.5) ?? m.body;
    for (const sgn of [1, -1]) head.add(k.ball(0.11, P.main, [sgn * 0.16, 0.02, -0.04], [0.35, 1.2, 1]));
    for (const sgn of [1, -1]) head.add(k.ball(0.07, P.accent, [sgn * 0.17, 0.02, -0.02], [0.2, 0.9, 0.7]));
    // a mossy blanket with a tiny flower
    m.body.add(k.ball(0.17, P.second, [0, 0.42, -0.02], [1.1, 0.35, 1.2]));
    m.body.add(k.ball(0.035, '#ff8fc8', [0.05, 0.49, 0.02]));
  },
  bamboopanda: (k, P, m) => {
    beast(k, P, m, { long: 1.05, tall: 0.22, snout: 'cat', ears: 'round' });
    const head = m.body.children.find((c) => c instanceof THREE.Group && c.position.y > 0.4) ?? m.body;
    for (const sgn of [1, -1]) {
      head.add(k.ball(0.045, P.second, [sgn * 0.07, 0.03, 0.1], [1, 1.25, 0.5]));
      head.add(k.ball(0.05, P.second, [sgn * 0.11, 0.1, -0.02], [1, 1, 0.5]));
    }
    // dark legs and shoulders, and a bamboo snack
    for (const leg of m.legs) leg.traverse((o) => { if (o instanceof THREE.Mesh) o.material = k.mat(P.second); });
    m.body.add(k.ball(0.15, P.second, [0, 0.33, 0.12], [1.05, 0.6, 0.6]));
    const stick = k.mesh(G.cyl, P.accent, [0.02, 0.3, 0.02], [0.12, 0.5, 0.3]);
    stick.rotation.z = 0.6;
    m.body.add(stick);
  },
  waddlefin: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.26, P.main, [0, 0.34, 0], [0.9, 1.15, 0.85]));
    b.add(k.ball(0.2, P.belly, [0, 0.3, 0.07], [0.85, 1.1, 0.8]));
    k.eye(b, 0.08, 0.5, 0.19, 0.045);
    k.eye(b, -0.08, 0.5, 0.19, 0.045);
    const beak = k.mesh(G.cone, P.accent, [0.045, 0.12, 0.045], [0, 0.44, 0.24]);
    beak.rotation.x = Math.PI / 2;
    b.add(beak);
    for (const sgn of [1, -1]) {
      const flip = pivot(sgn * 0.23, 0.42, 0, k.ball(0.08, P.main, [sgn * 0.02, -0.1, 0], [0.35, 1.3, 0.6]));
      b.add(flip);
      m.wings.push(flip);
      const foot = pivot(sgn * 0.08, 0.06, 0.05, k.ball(0.06, P.accent, [0, -0.03, 0.03], [1, 0.4, 1.4]));
      b.add(foot);
      m.legs.push(foot);
    }
    m.height = 0.72;
  },
  duskbat: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.17, P.main, [0, 0.45, 0], [1, 1.05, 0.95]));
    b.add(k.ball(0.11, P.belly, [0, 0.42, 0.08], [0.9, 1, 0.7]));
    k.eye(b, 0.06, 0.5, 0.14, 0.04);
    k.eye(b, -0.06, 0.5, 0.14, 0.04);
    for (const sgn of [1, -1]) {
      const ear = k.mesh(G.cone, P.main, [0.06, 0.16, 0.05], [sgn * 0.09, 0.66, -0.01]);
      ear.rotation.z = -0.3 * sgn;
      b.add(ear);
      const wing = new THREE.Group();
      wing.position.set(sgn * 0.14, 0.48, -0.02);
      for (let i = 0; i < 3; i++) {
        const f = k.mesh(G.cone, i === 1 ? P.second : P.main, [0.08, 0.3 - i * 0.05, 0.02], [sgn * (0.12 + i * 0.07), -0.04 - i * 0.03, 0]);
        f.rotation.z = sgn * (1.9 + i * 0.25);
        wing.add(f);
      }
      b.add(wing);
      m.wings.push(wing);
    }
    b.add(k.ball(0.022, '#ffffff', [0.03, 0.38, 0.15]));
    b.add(k.ball(0.022, '#ffffff', [-0.03, 0.38, 0.15]));
    m.height = 0.8;
  },
  shisa: (k, P, m) => {
    beast(k, P, m, { long: 1.2, tall: 0.3, snout: 'cat', ears: 'round', mane: P.second });
    const head = m.body.children.find((c) => c instanceof THREE.Group && c.position.y > 0.7) ?? m.body;
    // a big curly mane all around the face
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      head.add(k.ball(0.07, i % 2 ? P.second : P.main, [Math.cos(a) * 0.17, Math.sin(a) * 0.16, -0.05], [1, 1, 0.8]));
    }
    // a little guardian grin and a bell
    head.add(k.ball(0.05, '#ffffff', [0, -0.09, 0.15], [1.4, 0.4, 0.5]));
    m.body.add(k.ball(0.05, '#ffd23d', [0, 0.52, 0.36], [1, 1, 1], '#ffd23d'));
    m.body.add(k.mesh(G.torus, P.accent, [0.12, 0.12, 0.12], [0, 0.6, 0.3]).rotateX(Math.PI / 2));
  },
  leviathan: (k, P, m) => {
    BUILDERS.cloudserpent(k, P, m);
    // no clouds under a sea dragon: swap the puffs for fins
    for (const c of [...m.body.children]) {
      if (m.segments.includes(c)) continue;
      m.body.remove(c);
      if (c instanceof THREE.Sprite) c.material.dispose();
    }
    for (const i of [3, 6, 9]) {
      for (const s of [1, -1]) {
        const fin = k.ball(0.09, P.accent, [0.14 * s, 0, 0], [1.2, 0.12, 0.8], P.accent);
        fin.rotation.z = 0.4 * s;
        m.segments[i].add(fin);
      }
    }
    const crest = k.mesh(G.cone, P.accent, [0.05, 0.16, 0.05], [0, 0.2, 0.08], P.accent);
    crest.rotation.x = -0.5;
    m.segments[0].add(crest);
    const glow = glowSprite('#7affe0', 1.8, 0.3);
    glow.position.z = -0.6;
    m.body.add(glow);
  },
  worldturtle: (k, P, m) => {
    turtle(k, P, m, false);
    const b = m.body;
    // drop the pebbles; a tiny island grows on its shell instead
    for (const c of [...b.children]) if ((c as THREE.Mesh).geometry === G.rock) b.remove(c);
    b.add(k.mesh(G.hemi, P.accent, [0.42, 0.18, 0.46], [0, 0.5, 0]));
    const tree = (x: number, z: number, sc: number) => {
      b.add(k.mesh(G.cyl, '#8a5a3a', [0.025 * sc, 0.2 * sc, 0.025 * sc], [x, 0.66 + 0.1 * sc, z]));
      b.add(k.mesh(G.cone, '#3f8a3a', [0.1 * sc, 0.24 * sc, 0.1 * sc], [x, 0.66 + 0.3 * sc, z]));
    };
    tree(0.05, -0.05, 1.3);
    tree(-0.18, 0.1, 0.9);
    tree(0.2, 0.15, 0.8);
    // a tiny hut and a pond
    b.add(k.mesh(G.cyl, '#fff1e0', [0.06, 0.08, 0.06], [-0.12, 0.7, -0.2]));
    b.add(k.mesh(G.cone, '#e2483e', [0.08, 0.08, 0.08], [-0.12, 0.78, -0.2]));
    b.add(k.mesh(G.cyl, '#6ad8ff', [0.08, 0.01, 0.08], [0.16, 0.66, -0.16]));
    m.height = 1.25;
  },
} satisfies Record<string, Builder>);

// ---------------------------------------------------------------- Halloween Pass creatures

Object.assign(PALETTES, {
  pumpkit: { main: '#3a2e3a', second: '#ff9a2a', accent: '#1a1420', belly: '#f2e4d0' },
  gloomwing: { main: '#3a2a4a', second: '#ff8a2a', accent: '#ffb02a', belly: '#6a5a7a' },
});
Object.assign(MYTHIC_GLOW, { gloomwing: '#ff9a3a' });

Object.assign(BUILDERS, {
  pumpkit: (k, P, m) => {
    BUILDERS.fernkit(k, P, m);
    const b = m.body;
    // a little jack-o'-lantern hat with a warm glow inside
    const hat = new THREE.Group();
    hat.position.set(0, 0.84, 0.3);
    hat.scale.setScalar(1.7);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      hat.add(k.ball(0.075, '#ff8a2a', [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], [0.8, 0.85, 0.8]));
    }
    hat.add(k.mesh(G.cyl, '#5a8a3a', [0.015, 0.06, 0.015], [0, 0.09, 0]));
    for (const s of [1, -1]) hat.add(k.ball(0.016, '#ffe14d', [s * 0.035, 0.015, 0.1], [1, 1, 0.4], '#ffe14d'));
    hat.add(k.ball(0.022, '#ffe14d', [0, -0.03, 0.11], [1.6, 0.6, 0.4], '#ffe14d'));
    b.add(hat);
    const glow = glowSprite('#ffb84a', 0.8, 0.4);
    glow.position.set(0, 0.86, 0.32);
    b.add(glow);
  },
  gloomwing: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.22, P.main, [0, 0.5, 0], [1, 1.05, 0.95]));
    b.add(k.ball(0.14, P.belly, [0, 0.46, 0.1], [0.9, 1, 0.7]));
    // glowing pumpkin eyes and two little fangs
    for (const s of [1, -1]) {
      b.add(k.ball(0.045, P.accent, [s * 0.08, 0.57, 0.18], [1, 1.1, 0.6], P.accent));
      b.add(k.ball(0.018, '#1a1020', [s * 0.08, 0.57, 0.205], [0.6, 1.2, 0.4]));
      b.add(k.mesh(G.cone, '#ffffff', [0.018, 0.05, 0.018], [s * 0.035, 0.42, 0.19]).rotateX(Math.PI));
      const ear = k.mesh(G.cone, P.main, [0.08, 0.22, 0.06], [s * 0.12, 0.78, -0.01]);
      ear.rotation.z = -0.3 * s;
      b.add(ear);
      b.add(k.mesh(G.cone, P.accent, [0.04, 0.12, 0.03], [s * 0.12, 0.76, 0.02]).rotateZ(-0.3 * s));
      // big scalloped wings, orange inside
      const wing = new THREE.Group();
      wing.position.set(s * 0.18, 0.54, -0.02);
      for (let i = 0; i < 4; i++) {
        const f = k.mesh(G.cone, i % 2 ? P.second : P.main, [0.1, 0.42 - i * 0.06, 0.02], [s * (0.14 + i * 0.09), -0.05 - i * 0.03, 0]);
        f.rotation.z = s * (1.8 + i * 0.22);
        wing.add(f);
      }
      b.add(wing);
      m.wings.push(wing);
    }
    // a tiny velvet cape with a gold clasp
    const cape = k.mesh(G.cone, '#8a1a3a', [0.2, 0.32, 0.08], [0, 0.42, -0.14]);
    cape.rotation.x = -0.25;
    b.add(cape);
    b.add(k.ball(0.03, '#ffd23d', [0, 0.6, 0.15], [1, 1, 0.6], '#ffd23d'));
    const glow = glowSprite('#ff9a3a', 1.1, 0.35);
    glow.position.set(0, 0.55, 0);
    b.add(glow);
    m.height = 0.95;
  },
} satisfies Record<string, Builder>);

// ---------------------------------------------------------------- Cloud Isle creatures

Object.assign(PALETTES, {
  cloudlamb: { main: '#ffffff', second: '#5a6488', accent: '#ffb0c8', belly: '#eef4ff' },
  kitewing: { main: '#ff7a8a', second: '#ffe14d', accent: '#ff9f3a', belly: '#fff0e0' },
  zephyrwisp: { main: '#d8f4ff', second: '#a8e0ff', accent: '#e8d8ff', belly: '#ffffff' },
  breezedrake: { main: '#7ad8c8', second: '#ffffff', accent: '#a8e8ff', belly: '#e8fff8' },
});

Object.assign(BUILDERS, {
  cloudlamb: (k, P, m) => {
    const b = m.body;
    // a body of cloud puffs
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996;
      b.add(k.ball(0.15 + (i % 3) * 0.02, P.main, [Math.cos(a) * 0.16, 0.34 + Math.sin(i * 1.3) * 0.08, Math.sin(a) * 0.2 - 0.04]));
    }
    b.add(k.ball(0.26, P.main, [0, 0.34, -0.04], [1, 0.85, 1.1]));
    const head = new THREE.Group();
    head.position.set(0, 0.46, 0.3);
    head.add(k.ball(0.13, P.second, [0, 0, 0], [0.95, 1, 1.1]));
    k.eye(head, 0.06, 0.03, 0.11, 0.04);
    k.eye(head, -0.06, 0.03, 0.11, 0.04);
    head.add(k.ball(0.1, P.main, [0, 0.12, -0.02], [1.2, 0.7, 1]));
    for (const s of [1, -1]) {
      const ear = k.ball(0.05, P.second, [s * 0.14, 0.03, -0.02], [1.6, 0.6, 0.8]);
      ear.rotation.z = 0.4 * s;
      head.add(ear);
      head.add(k.ball(0.025, P.accent, [s * 0.07, -0.05, 0.1], [1, 0.6, 0.5]));
      for (const z of [0.12, -0.18]) {
        const leg = pivot(s * 0.11, 0.18, z, k.mesh(G.cyl, P.second, [0.035, 0.18, 0.035], [0, -0.08, 0]));
        b.add(leg);
        m.legs.push(leg);
      }
    }
    head.userData.head = true;
    b.add(head);
    m.wings.push(head);
    const tail = new THREE.Group();
    tail.position.set(0, 0.4, -0.3);
    tail.add(k.ball(0.07, P.main, [0, 0, -0.03]));
    b.add(tail);
    m.tail = tail;
    m.height = 0.8;
  },
  kitewing: (k, P, m) => {
    bird(k, P, m, false);
    // a kite-ribbon tail with little bows
    const tail = m.tail!;
    for (let i = 0; i < 4; i++) {
      const z = -0.16 - i * 0.14;
      const y = -0.04 - i * 0.05;
      tail.add(k.mesh(G.cyl, P.second, [0.01, 0.15, 0.01], [0, y + 0.02, z + 0.07]).rotateX(Math.PI / 2 - 0.3));
      for (const s of [1, -1]) {
        const bow = k.mesh(G.cone, i % 2 ? P.accent : P.second, [0.035, 0.07, 0.02], [s * 0.035, y, z]);
        bow.rotation.z = (Math.PI / 2) * s;
        tail.add(bow);
      }
    }
    // diamond kite markings on the wings
    for (const w of m.wings) {
      const s = w.position.x > 0 ? 1 : -1;
      const d = k.mesh(G.tetra, P.second, [0.06, 0.09, 0.02], [0.08 * s, -0.04, 0.02]);
      d.rotation.z = Math.PI / 4;
      w.add(d);
    }
  },
  zephyrwisp: (k, P, m) => {
    const b = m.body;
    b.add(k.ball(0.18, P.main, [0, 0, 0], [1, 1, 1], P.second));
    const shellMat = new THREE.MeshToonMaterial({ color: P.accent, transparent: true, opacity: 0.4, emissive: P.second, emissiveIntensity: 0.4 });
    k.mats.push(shellMat);
    const shell = new THREE.Mesh(G.sphere, shellMat);
    shell.scale.set(0.28, 0.3, 0.28);
    b.add(shell);
    k.eye(b, 0.08, 0.05, 0.25, 0.045);
    k.eye(b, -0.08, 0.05, 0.25, 0.045);
    // little gusts swirling round it
    const swirl = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ring = k.mesh(G.torus, i === 1 ? P.accent : P.belly, [0.36 - i * 0.05, 0.36 - i * 0.05, 0.08], [0, -0.22 + i * 0.1, -0.04]);
      ring.rotation.set(Math.PI / 2 + 0.15, 0, i * 2.1);
      ring.userData.noOutline = true;
      swirl.add(ring);
    }
    b.add(swirl);
    m.wings.push(swirl);
    const tail = new THREE.Group();
    tail.position.set(0, -0.12, -0.12);
    const wisp = k.mesh(G.cone, P.main, [0.13, 0.4, 0.13], [0, -0.12, -0.08], P.second);
    wisp.rotation.x = Math.PI + 0.7;
    tail.add(wisp);
    b.add(tail);
    m.tail = tail;
    const glow = glowSprite(P.second, 1.3, 0.6);
    b.add(glow);
    m.glows.push(glow);
    m.height = 0.55;
  },
  breezedrake: (k, P, m) => {
    dragon(k, P, m, false);
    // feathered wings instead of leathery ones, and no fiery glow
    for (const w of m.wings) {
      const s = w.position.x > 0 ? 1 : -1;
      w.remove(w.children[1]);
      for (let i = 0; i < 4; i++) {
        const f = k.ball(0.15 - i * 0.015, i % 2 ? P.second : P.accent, [(0.12 + i * 0.09) * s, 0.1 - i * 0.05, -0.04 - i * 0.03], [1.1, 0.22, 0.7]);
        f.rotation.z = (-0.5 + i * 0.12) * s;
        w.add(f);
      }
    }
    for (const g of m.glows) {
      g.removeFromParent();
      g.material.dispose();
    }
    m.glows.length = 0;
    // a white feather crest
    const head = m.body.children.find((c) => c instanceof THREE.Group && c.position.z > 0.2)!;
    for (let i = 0; i < 3; i++) {
      const f = k.ball(0.05, P.second, [0, 0.2 + i * 0.02, -0.06 - i * 0.07], [0.5, 1.6, 0.6]);
      f.rotation.x = -0.6 - i * 0.2;
      head.add(f);
    }
  },
} satisfies Record<string, Builder>);
