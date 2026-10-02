import * as THREE from 'three';
import type { LegendaryKind } from '../core/types';
import { buildCherub } from './creatureModels';
import { glowSprite } from './materials';

// The 3D side of a legendary event: angels spiralling down, a volcano
// spitting glowing rocks, or glowing bubbles rising from the deep.

interface Bit { obj: THREE.Object3D; vel: THREE.Vector3; life: number; max: number }

export class LegendaryFx {
  private kind: LegendaryKind | null = null;
  private cherubs: THREE.Group[] = [];
  private bits: Bit[] = [];
  private spawn = 0;
  private t = 0;
  private leaving = false;
  private center = new THREE.Vector3();
  private radius = 8;

  constructor(private scene: THREE.Scene) {}

  get active(): boolean {
    return this.kind !== null;
  }

  start(kind: LegendaryKind, center: THREE.Vector3, radius: number): void {
    this.stop();
    this.kind = kind;
    this.center.copy(center);
    this.radius = radius;
    this.t = 0;
    this.leaving = false;
    if (kind === 'angel') {
      for (let i = 0; i < 3; i++) {
        const c = buildCherub();
        c.scale.setScalar(1.3);
        c.userData.i = i;
        this.scene.add(c);
        this.cherubs.push(c);
      }
    }
  }

  /** The event is ending: angels fly home, effects taper off. */
  leave(): void {
    this.leaving = true;
    this.t = Math.max(this.t, 0);
  }

  stop(): void {
    for (const c of this.cherubs) this.scene.remove(c);
    for (const b of this.bits) this.scene.remove(b.obj);
    this.cherubs = [];
    this.bits = [];
    this.kind = null;
  }

  update(dt: number, ground: (x: number, z: number) => number): void {
    if (!this.kind) return;
    this.t += dt;
    const c = this.center;
    if (this.kind === 'angel') {
      let gone = 0;
      this.cherubs.forEach((g, n) => {
        const i = g.userData.i as number;
        const a = this.t * 0.5 + (i / 3) * Math.PI * 2;
        const r = this.radius * 0.45;
        const descend = Math.min(1, this.t / 5);
        const ease = 1 - Math.pow(1 - descend, 3);
        const lift = this.leaving ? (g.userData.lift = (g.userData.lift ?? 0) + dt * 6) : 0;
        const y = 22 - ease * 18 + Math.sin(this.t * 1.6 + i) * 0.4 + lift;
        const x = c.x + Math.cos(a) * r;
        const z = c.z + Math.sin(a) * r;
        g.position.set(x, ground(x, z) + y, z);
        g.rotation.y = -a;
        (g.userData.wings as THREE.Object3D[]).forEach((w, k) => (w.rotation.y = Math.sin(this.t * 8 + n) * 0.5 * (k ? -1 : 1)));
        if (lift > 30) gone++;
      });
      this.spawn -= dt;
      if (this.spawn <= 0 && !this.leaving) {
        this.spawn = 0.12;
        // golden motes drifting down
        const s = glowSprite(Math.random() < 0.5 ? '#fff3b0' : '#ffffff', 0.35, 0.9);
        const x = c.x + (Math.random() - 0.5) * this.radius * 1.6;
        const z = c.z + (Math.random() - 0.5) * this.radius * 1.6;
        s.position.set(x, ground(x, z) + 6 + Math.random() * 4, z);
        this.addBit(s, new THREE.Vector3((Math.random() - 0.5) * 0.3, -1.2, (Math.random() - 0.5) * 0.3), 5);
      }
      if (gone === this.cherubs.length && this.leaving) this.stop();
    } else if (this.kind === 'infernal') {
      this.spawn -= dt;
      if (this.spawn <= 0 && !this.leaving) {
        this.spawn = 0.35;
        // glowing rocks arc out of the crater and land around the island
        const s = glowSprite(Math.random() < 0.4 ? '#ffe27a' : '#ff6a1a', 0.9, 1);
        s.position.set(c.x, ground(c.x, c.z - 3.6) + 4.6, c.z - 3.6);
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 2;
        this.addBit(s, new THREE.Vector3(Math.cos(a) * sp, 6 + Math.random() * 3, Math.sin(a) * sp), 2.4, true);
      }
      if (this.leaving && this.bits.length === 0) this.stop();
    } else {
      this.spawn -= dt;
      if (this.spawn <= 0 && !this.leaving) {
        this.spawn = 0.08;
        // glowing bubbles rise out of the lagoon
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * this.radius * 0.55;
        const x = c.x + Math.cos(a) * r;
        const z = c.z + Math.sin(a) * r;
        const s = glowSprite(Math.random() < 0.5 ? '#3affe0' : '#6a8aff', 0.3 + Math.random() * 0.3, 0.9);
        s.position.set(x, ground(x, z) + 0.1, z);
        this.addBit(s, new THREE.Vector3(0, 1 + Math.random() * 1.5, 0), 3);
      }
      if (this.leaving && this.bits.length === 0) this.stop();
    }
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.life -= dt;
      if (b.obj.userData.gravity) b.vel.y -= 9 * dt;
      b.obj.position.addScaledVector(b.vel, dt);
      const fade = Math.min(1, b.life / Math.min(1, b.max * 0.3));
      ((b.obj as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.max(0, fade) * 0.95;
      if (b.life <= 0) {
        this.scene.remove(b.obj);
        ((b.obj as THREE.Sprite).material as THREE.SpriteMaterial).dispose();
        this.bits.splice(i, 1);
      }
    }
  }

  private addBit(obj: THREE.Object3D, vel: THREE.Vector3, life: number, gravity = false): void {
    obj.userData.gravity = gravity;
    this.scene.add(obj);
    this.bits.push({ obj, vel, life, max: life });
  }
}
