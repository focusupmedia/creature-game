import * as THREE from 'three';
import type { DigKind } from '../core/types';
import { addOutlines, glowSprite, toon } from './materials';

// Dig spots: small, lively signs on the ground that invite you to drop a
// creature on them. Sparkly dust (dig), a bubbling puddle (fish), a berry bush
// (forage). Each animates so it catches the eye from a distance.

export interface DigSpotView {
  root: THREE.Group;
  kind: DigKind;
  bits: THREE.Object3D[];
  glow: THREE.Sprite;
  born: number;
}

/** Marks a material as belonging to one dig spot, so it's freed with it. */
function own<T extends THREE.Material>(m: T): T {
  m.userData.own = true;
  return m;
}

export function disposeDigSpot(v: DigSpotView): void {
  v.root.traverse((o) => {
    const mats = (o as THREE.Mesh | THREE.Sprite).material as THREE.Material | undefined;
    if (mats?.userData?.own || o instanceof THREE.Sprite) mats?.dispose();
  });
}

export function buildDigSpot(kind: DigKind, id: string, born: number): DigSpotView {
  const root = new THREE.Group();
  const bits: THREE.Object3D[] = [];
  if (kind === 'dust') {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 6), toon('#a87a4a'));
    mound.scale.set(1, 0.32, 1);
    mound.position.y = 0.02;
    root.add(mound);
    for (let i = 0; i < 4; i++) {
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), toon('#8a6038'));
      const a = (i / 4) * Math.PI * 2 + 0.4;
      pebble.position.set(Math.cos(a) * 0.45, 0.04, Math.sin(a) * 0.45);
      root.add(pebble);
    }
    for (let i = 0; i < 4; i++) {
      const s = glowSprite(i % 2 ? '#fff3a0' : '#ffffff', 0.25, 0.9);
      s.userData.i = i;
      root.add(s);
      bits.push(s);
    }
  } else if (kind === 'puddle') {
    const rim = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), toon('#6a8a5a'));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.02;
    root.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), own(new THREE.MeshToonMaterial({ color: '#5fd0ff', emissive: '#2a9ad0', emissiveIntensity: 0.35 })));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.035;
    root.add(water);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 5), own(new THREE.MeshToonMaterial({ color: '#eafaff', transparent: true, opacity: 0.85 })));
      b.userData.i = i;
      root.add(b);
      bits.push(b);
    }
  } else {
    const greens = ['#3fae35', '#4fc23a', '#5fd04a'];
    for (let i = 0; i < 3; i++) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 - i * 0.04, 0), toon(greens[i]));
      blob.position.set((i - 1) * 0.22, 0.26 + (i % 2) * 0.1, (i % 2 ? 0.1 : -0.05));
      blob.castShadow = true;
      root.add(blob);
    }
    for (let i = 0; i < 6; i++) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), own(toon(i % 2 ? '#6a5aff' : '#ff4f8a', i % 2 ? '#4a3ad0' : '#d02a6a', 0.3).clone()));
      const a = (i / 6) * Math.PI * 2;
      berry.position.set(Math.cos(a) * 0.3, 0.32 + (i % 3) * 0.08, Math.sin(a) * 0.22 + 0.06);
      berry.userData.i = i;
      root.add(berry);
      bits.push(berry);
    }
  }
  addOutlines(root, 2.4);
  const glow = glowSprite(kind === 'puddle' ? '#bff0ff' : kind === 'bush' ? '#ffd0f0' : '#fff3b0', 1.6, 0.35);
  glow.position.y = 0.3;
  root.add(glow);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.5;
  hit.userData.pick = { kind: 'dig', id };
  root.add(hit);
  root.scale.setScalar(0.01);
  return { root, kind, bits, glow, born };
}

export function animateDigSpot(v: DigSpotView, t: number): void {
  const age = t - v.born;
  v.root.scale.setScalar(Math.min(1, age * 2.5) * (1 + Math.sin(t * 2.4) * 0.03));
  (v.glow.material as THREE.SpriteMaterial).opacity = 0.25 + Math.sin(t * 3) * 0.12;
  for (const b of v.bits) {
    const i = b.userData.i as number;
    if (v.kind === 'dust') {
      // sparkles drift up out of the dirt and fade
      const k = (t * 0.6 + i * 0.25) % 1;
      const a = i * 1.7 + t * 0.8;
      b.position.set(Math.cos(a) * 0.28, 0.1 + k * 0.9, Math.sin(a) * 0.28);
      (b as THREE.Sprite).material.opacity = Math.sin(k * Math.PI) * 0.95;
    } else if (v.kind === 'puddle') {
      // bubbles rise and pop
      const k = (t * 0.7 + i * 0.27) % 1;
      b.position.set(Math.cos(i * 2.1) * 0.22, 0.04 + k * 0.35, Math.sin(i * 2.1) * 0.22);
      b.scale.setScalar(0.6 + k * 0.8);
      ((b as THREE.Mesh).material as THREE.MeshToonMaterial).opacity = 0.9 * (1 - k);
    } else {
      // berries glint in turn
      const on = Math.max(0, Math.sin(t * 3 + i * 1.3));
      ((b as THREE.Mesh).material as THREE.MeshToonMaterial).emissiveIntensity = 0.2 + on * 0.6;
    }
  }
}
