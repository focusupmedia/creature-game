import * as THREE from 'three';
import { species } from '../content/species';
import type { MutationId, SpeciesId } from '../core/types';
import { mulberry32 } from '../core/rng';
import { addOutlines, glowSprite, toonRamp } from './materials';

let eggGeo: THREE.LatheGeometry | null = null;
function eggGeometry(): THREE.LatheGeometry {
  if (eggGeo) return eggGeo;
  const pts: THREE.Vector2[] = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    // Rounded at both ends, fuller at the bottom: a classic egg.
    const th = (i / n) * Math.PI;
    const r = Math.sin(th) * (0.5 + 0.07 * Math.cos(th));
    const y = (1 - Math.cos(th)) * 0.65;
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  eggGeo = new THREE.LatheGeometry(pts, 20);
  return eggGeo;
}

/** Pattern texture: spots for wild species, swirls for hybrids, so eggs hint at what's inside. */
function eggTexture(sp: SpeciesId, seed: number): THREE.CanvasTexture {
  const def = species(sp);
  const [base, pat] = def.eggColors;
  const c = document.createElement('canvas');
  // drawn at 128 and stored at 256, so cracks drawn on it later (render/Reveal.ts) stay crisp
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  const r = mulberry32(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = pat;
  g.strokeStyle = pat;
  if (def.origin === 'hybrid') {
    g.lineWidth = 7;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      const y0 = 15 + i * 24;
      for (let x = 0; x <= 128; x += 4) g.lineTo(x, y0 + Math.sin(x / 12 + i) * 8);
      g.stroke();
    }
  } else if (def.traits.includes('Tide')) {
    for (let i = 0; i < 4; i++) g.fillRect(0, 20 + i * 28, 128, 6);
  } else {
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.arc(r() * 128, r() * 128, 3 + r() * 7, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export interface EggModel {
  root: THREE.Group;
  shell: THREE.Mesh;
  glow: THREE.Sprite;
  mat: THREE.MeshToonMaterial;
  prismatic: boolean;
}

export function buildEgg(sp: SpeciesId, mutations: MutationId[], seed: number, scale = 0.5): EggModel {
  const mat = new THREE.MeshToonMaterial({ map: eggTexture(sp, seed), gradientMap: toonRamp() });
  const shell = new THREE.Mesh(eggGeometry(), mat);
  shell.castShadow = true;
  const root = new THREE.Group();
  root.add(shell);
  addOutlines(root, 2.6);
  let glowColor = '#fff6d0';
  if (mutations.includes('lunar')) glowColor = '#b9c6ff';
  if (mutations.includes('storm')) glowColor = '#ffe14d';
  if (mutations.includes('starlit')) glowColor = '#fff1a8';
  if (mutations.includes('frost')) glowColor = '#bfe8ff';
  if (['lunar', 'storm', 'starlit', 'frost'].some((m) => mutations.includes(m as MutationId))) {
    mat.emissive = new THREE.Color(glowColor);
    mat.emissiveIntensity = 0.18;
  }
  const glow = glowSprite(glowColor, 2.4, 0);
  glow.position.y = 0.65;
  root.add(glow);
  const big = mutations.includes('giant') ? 1.25 : 1;
  root.scale.setScalar(scale * big);
  return { root, shell, glow, mat, prismatic: mutations.includes('prismatic') };
}

export function disposeEgg(e: EggModel): void {
  e.mat.map?.dispose();
  e.mat.dispose();
  (e.glow.material as THREE.SpriteMaterial).dispose();
}
