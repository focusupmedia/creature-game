import * as THREE from 'three';
import type { Creature, Egg } from '../core/types';
import { animateGlow, buildCreature, animatePrismatic, disposeCreature, type CreatureModel } from './creatureModels';
import { buildEgg, disposeEgg, type EggModel } from './eggModel';
import { glowSprite, toon } from './materials';

// The hatch reveal: the most important 6 seconds in the game.
// "What is inside?" (tap to crack) → flash → "NEW DISCOVERY".

export type RevealPhase = 'egg' | 'burst' | 'show';

export class Reveal {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  phase: RevealPhase = 'egg';
  onPhase: (p: RevealPhase) => void = () => {};
  private egg: EggModel;
  private model: CreatureModel;
  private time = 0;
  private cracks = 0;
  private shake = 0;
  private flash: THREE.Sprite;
  private rays: THREE.Mesh;
  private confetti: THREE.Points;
  private confettiVel: Float32Array;
  private crackMeshes: THREE.Mesh[] = [];

  constructor(egg: Egg, creature: Creature) {
    this.scene.background = new THREE.Color('#141a2e');
    const hemi = new THREE.HemisphereLight('#ffffff', '#444466', 1.4);
    const key = new THREE.DirectionalLight('#fff4e0', 2);
    key.position.set(3, 5, 4);
    this.scene.add(hemi, key);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.4, 24), toon('#3a4468'));
    ped.position.y = -0.2;
    this.scene.add(ped);

    const rayGeo = new THREE.PlaneGeometry(9, 9);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.translate(128, 128);
    for (let i = 0; i < 14; i++) {
      g.rotate((Math.PI * 2) / 14);
      const grad = g.createLinearGradient(0, 0, 0, -128);
      grad.addColorStop(0, 'rgba(255,240,200,0.6)');
      grad.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-10, -128);
      g.lineTo(10, -128);
      g.fill();
    }
    const rayTex = new THREE.CanvasTexture(c);
    this.rays = new THREE.Mesh(rayGeo, new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.rays.position.set(0, 1, -1.5);
    this.scene.add(this.rays);

    this.egg = buildEgg(egg.species, egg.mutations, egg.seed, 1.1);
    this.scene.add(this.egg.root);
    for (let i = 0; i < 4; i++) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 0.03), new THREE.MeshBasicMaterial({ color: '#2a1a10' }));
      const a = (i / 4) * Math.PI * 2 + 0.4;
      crack.position.set(Math.sin(a) * 0.55, 0.75 + (i % 2) * 0.2, Math.cos(a) * 0.55);
      crack.rotation.set(0.3, a, 0.5 * (i % 2 ? 1 : -1));
      crack.visible = false;
      this.egg.root.add(crack);
      this.crackMeshes.push(crack);
    }

    this.model = buildCreature(creature.species, creature.mutations, creature.seed, creature.shade);
    this.model.root.visible = false;
    this.model.root.scale.setScalar(this.model.baseScale * 1.4);
    this.scene.add(this.model.root);

    this.flash = glowSprite('#ffffff', 0.1, 0);
    this.flash.position.y = 0.8;
    this.scene.add(this.flash);

    const n = 160;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    this.confettiVel = new Float32Array(n * 3);
    const palette = ['#ffd36a', '#ff8fb1', '#8fe8ff', '#b9a6ff', '#9be06a'].map((h) => new THREE.Color(h));
    for (let i = 0; i < n; i++) {
      const cc = palette[i % palette.length];
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.confetti = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0 }));
    this.scene.add(this.confetti);
    this.camera.position.set(0, 1.6, 5.2);
    this.camera.lookAt(0, 0.8, 0);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    const portrait = w < h;
    this.camera.fov = portrait ? 46 : 35;
    this.camera.position.set(0, portrait ? 1.9 : 1.6, portrait ? 7.4 : 5.2);
    this.camera.lookAt(0, 0.75, 0);
    this.camera.updateProjectionMatrix();
  }

  /** A tap on the egg during the 'egg' phase cracks it further. */
  tap(): void {
    if (this.phase !== 'egg') return;
    this.cracks += 1;
    this.shake = 0.6;
    this.crackMeshes.slice(0, this.cracks + 1).forEach((c) => (c.visible = true));
    if (this.cracks >= 3) this.burst();
  }

  private burst(): void {
    this.phase = 'burst';
    this.time = 0;
    this.onPhase('burst');
  }

  update(dt: number): void {
    this.time += dt;
    if (this.phase === 'egg') {
      const urge = Math.min(1, this.time / 5);
      this.shake = Math.max(0, this.shake - dt * 2);
      const w = Math.sin(this.time * (8 + urge * 10)) * (0.04 + urge * 0.08 + this.shake * 0.3);
      this.egg.root.rotation.z = w;
      this.egg.root.position.y = Math.abs(w) * 0.3;
      (this.egg.glow.material as THREE.SpriteMaterial).opacity = 0.2 + urge * 0.5;
      if (this.egg.prismatic) this.egg.mat.color.setHSL((this.time * 0.3) % 1, 0.6, 0.7);
      if (this.time > 7) this.burst();
    } else if (this.phase === 'burst') {
      const k = Math.min(1, this.time / 0.5);
      this.flash.scale.setScalar(0.1 + k * 14);
      (this.flash.material as THREE.SpriteMaterial).opacity = k < 0.6 ? k * 1.6 : 1;
      if (this.time > 0.5) {
        this.egg.root.visible = false;
        this.model.root.visible = true;
        this.phase = 'show';
        this.time = 0;
        const p = this.confetti.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          p.setXYZ(i, 0, 0.8, 0);
          const a = Math.random() * Math.PI * 2;
          const s = 1.5 + Math.random() * 2.5;
          this.confettiVel.set([Math.cos(a) * s, 2 + Math.random() * 3, Math.sin(a) * s * 0.5], i * 3);
        }
        (this.confetti.material as THREE.PointsMaterial).opacity = 1;
        this.onPhase('show');
      }
    } else {
      const fm = this.flash.material as THREE.SpriteMaterial;
      fm.opacity = Math.max(0, fm.opacity - dt * 2.5);
      const pop = Math.min(1, this.time * 3);
      const s = this.model.baseScale * 1.4 * (0.6 + 0.4 * (1 + Math.sin(pop * Math.PI) * 0.25));
      this.model.root.scale.setScalar(s);
      this.model.root.rotation.y = Math.sin(this.time * 0.8) * 0.6;
      this.model.root.position.y = (this.model.movement === 'fly' || this.model.movement === 'float') ? 0.6 + Math.sin(this.time * 2) * 0.1 : 0;
      this.model.wings.forEach((w, i) => (w.rotation.z = Math.sin(this.time * 10) * 0.5 * (i % 2 ? -1 : 1)));
      for (const g of this.model.glows) (g.material as THREE.SpriteMaterial).opacity = 0.5;
      if (this.model.root.userData.prismatic) animatePrismatic(this.model, this.time);
      animateGlow(this.model, this.time);
      const rm = this.rays.material as THREE.MeshBasicMaterial;
      rm.opacity = Math.min(0.8, this.time);
      this.rays.rotation.z += dt * 0.3;
      const p = this.confetti.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        this.confettiVel[i * 3 + 1] -= dt * 5;
        p.setXYZ(i, p.getX(i) + this.confettiVel[i * 3] * dt, p.getY(i) + this.confettiVel[i * 3 + 1] * dt, p.getZ(i) + this.confettiVel[i * 3 + 2] * dt);
      }
      p.needsUpdate = true;
      (this.confetti.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - this.time / 4);
    }
  }

  dispose(): void {
    disposeEgg(this.egg);
    disposeCreature(this.model);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
    });
  }
}
