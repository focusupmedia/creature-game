import * as THREE from 'three';
import { species } from '../content/species';
import { ISLAND_RADIUS, OBSTACLES, POND, TREES, inPond, onIsland, randomLandPoint, randomPondPoint } from '../content/layout';
import { creatureTraits } from '../core/creatures';
import type { Creature, EventKind, Trait } from '../core/types';
import { animatePrismatic, buildCreature, disposeCreature, type CreatureModel } from './creatureModels';
import { emoteTexture } from './materials';

// The living world: creatures pick small goals (wander, nap, visit a lure,
// shelter from rain, greet a friend) so the sanctuary is worth just watching.

export interface ActorContext {
  darkness: number;
  sky: EventKind | null;
  lures: { id: string; x: number; z: number; attracts: Trait }[];
  actors: CreatureActor[];
}

type State = 'arrive' | 'wander' | 'idle' | 'eat' | 'sleep' | 'shelter' | 'social' | 'celebrate' | 'lookup';

const SPEED: Record<string, number> = { hop: 1.1, walk: 0.7, scuttle: 1.0, fly: 1.3, swim: 0.8, slither: 0.6, waddle: 0.45, float: 0.55 };

export class CreatureActor {
  readonly model: CreatureModel;
  readonly root: THREE.Group;
  readonly hit: THREE.Mesh;
  readonly traits: Trait[];
  state: State = 'idle';
  private target = new THREE.Vector3();
  private timer = 0;
  private hopT = 0;
  private heading = Math.random() * Math.PI * 2;
  private emoteSprite: THREE.Sprite;
  private emoteLife = 0;
  private socialCooldown = 5 + Math.random() * 10;
  private partner: CreatureActor | null = null;
  private phase = Math.random() * 10;
  private flyHeight = 1 + Math.random() * 0.4;
  private onArrived: (() => void) | null = null;
  private ring: THREE.Mesh;
  private nightOwl: boolean;
  private dayOnly: boolean;

  constructor(public creature: Creature, scene: THREE.Object3D) {
    this.model = buildCreature(creature.species, creature.mutations, creature.seed);
    this.root = this.model.root;
    this.traits = creatureTraits(creature);
    const sp = species(creature.species);
    this.nightOwl = sp.activity === 'night';
    this.dayOnly = sp.activity === 'day';
    const h = this.model.height;
    this.hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.55, h * 0.7), 6, 4), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = h * 0.5;
    this.hit.userData.pick = { kind: 'creature', id: creature.id };
    this.root.add(this.hit);
    this.emoteSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, opacity: 0 }));
    this.emoteSprite.scale.setScalar(0.55 / this.model.baseScale);
    this.emoteSprite.renderOrder = 10;
    this.root.add(this.emoteSprite);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 28), new THREE.MeshBasicMaterial({ color: '#fff7c2', transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.root.add(this.ring);
    const start = this.isSwimmer ? randomPondPoint(Math.random) : randomLandPoint(Math.random);
    this.root.position.set(start.x, 0, start.z);
    this.pickWander();
    scene.add(this.root);
  }

  get id(): string { return this.creature.id; }
  get isFlyer(): boolean { return this.model.movement === 'fly' || this.model.movement === 'float'; }
  get isSwimmer(): boolean { return this.model.movement === 'swim'; }
  get position(): THREE.Vector3 { return this.root.position; }

  setSelected(on: boolean): void {
    this.ring.visible = on;
  }

  /** Enter from the island edge (or splash into the pond) and walk to a lure. */
  arrive(spot: { x: number; z: number }, done?: () => void): void {
    if (this.isSwimmer) {
      const p = randomPondPoint(Math.random);
      this.root.position.set(p.x, 0, p.z);
      this.target.set(spot.x - 0.6, 0, spot.z);
      this.clampToPond(this.target);
    } else {
      const a = Math.atan2(spot.z, spot.x) + (Math.random() - 0.5) * 1.2;
      this.root.position.set(Math.cos(a) * (ISLAND_RADIUS - 0.6), 0, Math.sin(a) * (ISLAND_RADIUS - 0.6));
      const off = new THREE.Vector3(spot.x, 0, spot.z).sub(this.root.position).normalize().multiplyScalar(0.8);
      this.target.set(spot.x - off.x, 0, spot.z - off.z);
    }
    this.state = 'arrive';
    this.onArrived = done ?? null;
    this.emote('❗', 1.6);
  }

  celebrate(): void {
    this.state = 'celebrate';
    this.timer = 2.5;
    this.emote('✨', 2.5);
  }

  emote(text: string, life = 2): void {
    const mat = this.emoteSprite.material as THREE.SpriteMaterial;
    mat.map = emoteTexture(text);
    mat.needsUpdate = true;
    this.emoteLife = life;
  }

  update(dt: number, time: number, ctx: ActorContext): void {
    const m = this.model;
    this.phase += dt;
    this.timer -= dt;
    this.socialCooldown -= dt;
    const asleepTime = (this.dayOnly && ctx.darkness > 0.7 && ctx.sky !== 'eclipse') || (this.nightOwl && ctx.darkness < 0.3);

    // ---- decide
    switch (this.state) {
      case 'arrive':
        if (this.moveToward(dt, 1.2)) {
          this.state = 'eat';
          this.timer = 3 + Math.random() * 2;
          this.onArrived?.();
          this.onArrived = null;
        }
        break;
      case 'wander':
        if (this.moveToward(dt, 1) || this.timer < -12) this.decide(ctx, asleepTime);
        break;
      case 'shelter':
        this.moveToward(dt, 1.1);
        if (ctx.sky !== 'storm') this.decide(ctx, asleepTime);
        break;
      case 'social':
        if (this.partner) this.face(this.partner.position, dt);
        if (this.timer <= 0) {
          this.partner = null;
          this.decide(ctx, asleepTime);
        }
        break;
      case 'sleep':
        if (!asleepTime) {
          this.emote('🌅', 1.2);
          this.decide(ctx, false);
        } else if (Math.random() < dt * 0.15) this.emote('💤', 2);
        break;
      default:
        if (this.timer <= 0) this.decide(ctx, asleepTime);
    }

    // ---- animate
    const mv = m.movement;
    const moving = (this.state === 'wander' || this.state === 'arrive' || this.state === 'shelter')
      && this.root.position.distanceTo(this.target) > 0.15;
    const body = m.body;
    body.position.y = 0;
    body.rotation.set(0, 0, 0);
    body.scale.set(1, 1, 1);

    if (mv === 'hop') {
      if (moving) {
        this.hopT += dt * 2.2;
        const h = Math.sin((this.hopT % 1) * Math.PI);
        body.position.y = h * 0.3;
        body.scale.set(1 - h * 0.08, 1 + h * 0.12, 1 - h * 0.08);
        for (const leg of m.legs) leg.rotation.x = -h * 0.8;
      } else {
        const b = Math.sin(this.phase * 2) * 0.03;
        body.scale.set(1 + b, 1 - b, 1 + b);
      }
    } else if (mv === 'walk' || mv === 'scuttle' || mv === 'waddle') {
      const sp = mv === 'scuttle' ? 18 : mv === 'waddle' ? 6 : 9;
      m.legs.forEach((leg, i) => (leg.rotation.x = moving ? Math.sin(this.phase * sp + i * Math.PI) * 0.6 : 0));
      body.position.y = moving ? Math.abs(Math.sin(this.phase * sp)) * 0.03 : 0;
      if (mv === 'waddle') body.rotation.z = moving ? Math.sin(this.phase * sp) * 0.15 : 0;
      if (!moving) body.scale.y = 1 + Math.sin(this.phase * 1.6) * 0.02;
    } else if (mv === 'fly') {
      const flap = Math.sin(this.phase * (moving ? 16 : 6));
      m.wings.forEach((w, i) => (w.rotation.z = flap * 0.7 * (i % 2 ? -1 : 1)));
      const resting = this.state === 'sleep' || this.state === 'eat';
      const targetY = resting ? 0.25 : this.flyHeight + Math.sin(this.phase * 1.7) * 0.15;
      this.root.position.y += (targetY - this.root.position.y) * Math.min(1, dt * 2);
    } else if (mv === 'float') {
      const targetY = (this.state === 'sleep' ? 0.5 : this.flyHeight) + Math.sin(this.phase * 1.3) * 0.2;
      this.root.position.y += (targetY - this.root.position.y) * Math.min(1, dt * 1.5);
      if (m.tail) m.tail.rotation.z = Math.sin(this.phase * 2) * 0.3;
      m.wings.forEach((w, i) => (w.rotation.z = Math.sin(this.phase * 2.5) * 0.4 * (i % 2 ? -1 : 1)));
    } else if (mv === 'swim') {
      this.root.position.y = -0.1 + Math.sin(this.phase * 2) * 0.03;
      if (m.tail) m.tail.rotation.y = Math.sin(this.phase * (moving ? 10 : 4)) * 0.5;
    } else if (mv === 'slither') {
      m.segments.forEach((s, i) => {
        s.position.x = Math.sin(this.phase * (moving ? 7 : 2) - i * 0.9) * (moving ? 0.1 : 0.04) * Math.min(1, i * 0.5);
      });
    }
    if (mv !== 'fly' && mv !== 'float' && mv !== 'swim') this.root.position.y = 0;

    if (m.tail && (mv === 'walk' || mv === 'hop')) m.tail.rotation.y = Math.sin(this.phase * 3) * 0.25;

    if (this.state === 'eat') {
      body.rotation.x = 0.25 + Math.sin(this.phase * 8) * 0.12;
      if (Math.random() < dt * 0.4) this.emote('😋', 1);
    } else if (this.state === 'sleep') {
      body.scale.set(1.05, 0.88 + Math.sin(this.phase * 1.2) * 0.03, 1.05);
    } else if (this.state === 'celebrate') {
      body.position.y += Math.abs(Math.sin(this.phase * 8)) * 0.35;
      this.root.rotation.y += dt * 4;
      if (this.timer <= 0) this.decide(ctx, asleepTime);
    } else if (this.state === 'lookup') {
      body.rotation.x = -0.35;
    }

    // glows show in the dark
    for (const g of m.glows) {
      const mat = g.material as THREE.SpriteMaterial;
      const base = g.userData.base ?? (g.userData.base = mat.opacity || 0.7);
      mat.opacity = base * Math.max(0.05, ctx.darkness) * (0.85 + Math.sin(this.phase * 3) * 0.15);
    }
    if (m.sparks) {
      m.sparks.children.forEach((s, i) => {
        const a = this.phase * 3 + (i * Math.PI) / 2;
        s.position.set(Math.cos(a) * 0.45, Math.sin(this.phase * 7 + i) * 0.2, Math.sin(a) * 0.45);
        s.visible = Math.sin(this.phase * 13 + i * 2) > -0.2;
        s.rotation.set(this.phase * 5, this.phase * 3, 0);
      });
    }
    if (this.root.userData.prismatic) animatePrismatic(m, time);

    // emote bubble
    this.emoteLife -= dt;
    const em = this.emoteSprite.material as THREE.SpriteMaterial;
    em.opacity = Math.max(0, Math.min(1, this.emoteLife * 2));
    this.emoteSprite.position.y = m.height + 0.35 + (2 - Math.max(0, this.emoteLife)) * 0.1;
    if (this.ring.visible) (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(time * 5) * 0.3;
  }

  private decide(ctx: ActorContext, asleepTime: boolean): void {
    if (asleepTime) {
      this.state = 'sleep';
      this.emote('💤', 2.5);
      return;
    }
    const exposed = !this.traits.some((t) => t === 'Tide' || t === 'Amphibian' || t === 'Fish' || t === 'Storm');
    if (ctx.sky === 'storm' && exposed && !this.isSwimmer && Math.random() < 0.85) {
      const tree = TREES.reduce((best, t) => (this.dist2(t) < this.dist2(best) ? t : best), TREES[0]);
      const a = Math.random() * Math.PI * 2;
      this.target.set(tree.x + Math.cos(a) * 0.9 * tree.s, 0, tree.z + Math.sin(a) * 0.9 * tree.s);
      this.state = 'shelter';
      this.emote('☔', 1.5);
      return;
    }
    if (ctx.sky === 'storm' && !exposed && Math.random() < 0.3) this.emote('🎵', 1.8);
    if (ctx.sky === 'eclipse' && Math.random() < 0.35) {
      this.state = 'lookup';
      this.timer = 2 + Math.random() * 2;
      this.emote(this.traits.includes('Mystic') || this.traits.includes('Spirit') ? '✨' : '❓', 2);
      return;
    }
    // visit a lure that smells right
    const lure = ctx.lures.find((l) => this.traits.includes(l.attracts));
    if (lure && Math.random() < 0.25 && !this.isSwimmer) {
      this.target.set(lure.x + (Math.random() - 0.5) * 1.2, 0, lure.z + (Math.random() - 0.5) * 1.2);
      this.state = 'arrive';
      return;
    }
    // say hello to a neighbor
    if (this.socialCooldown <= 0) {
      const near = ctx.actors.find((o) => o !== this && o.state !== 'sleep' && o.state !== 'arrive'
        && o.position.distanceTo(this.position) < 2.2 && o.isSwimmer === this.isSwimmer);
      if (near && Math.random() < 0.6) {
        const shared = this.traits.some((t) => near.traits.includes(t));
        for (const [a, b] of [[this, near], [near, this]] as const) {
          a.state = 'social';
          a.partner = b;
          a.timer = 2.5;
          a.socialCooldown = 25 + Math.random() * 20;
        }
        this.emote(shared ? '💕' : '👋', 2.2);
        near.emote(shared ? '💕' : '🎵', 2.2);
        return;
      }
    }
    if (Math.random() < 0.35) {
      this.state = 'idle';
      this.timer = 1.5 + Math.random() * 4;
      return;
    }
    this.pickWander();
  }

  private pickWander(): void {
    const p = this.isSwimmer ? randomPondPoint(Math.random) : randomLandPoint(Math.random);
    // prefer short trips so creatures stay readable on screen
    const cur = this.root.position;
    const d = Math.hypot(p.x - cur.x, p.z - cur.z);
    const k = d > 4 ? 4 / d : 1;
    this.target.set(cur.x + (p.x - cur.x) * k, 0, cur.z + (p.z - cur.z) * k);
    if (this.isSwimmer) this.clampToPond(this.target);
    else if (inPond(this.target.x, this.target.z, 0.3) && !this.traits.includes('Amphibian')) this.target.set(p.x, 0, p.z);
    this.state = 'wander';
    this.timer = 0;
  }

  private clampToPond(v: THREE.Vector3): void {
    const dx = v.x - POND.x;
    const dz = v.z - POND.z;
    const d = Math.hypot(dx, dz);
    const max = POND.r - 0.5;
    if (d > max) v.set(POND.x + (dx / d) * max, 0, POND.z + (dz / d) * max);
  }

  private dist2(p: { x: number; z: number }): number {
    return (p.x - this.root.position.x) ** 2 + (p.z - this.root.position.z) ** 2;
  }

  private face(p: THREE.Vector3, dt: number): void {
    const want = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, dt * 6);
    this.root.rotation.y = this.heading;
  }

  /** Steer toward target; returns true when arrived. */
  private moveToward(dt: number, speedMul: number): boolean {
    const pos = this.root.position;
    const to = new THREE.Vector3(this.target.x - pos.x, 0, this.target.z - pos.z);
    const d = to.length();
    if (d < 0.12) return true;
    to.normalize();
    // gentle obstacle avoidance
    if (!this.isFlyer && !this.isSwimmer) {
      for (const o of OBSTACLES) {
        const ox = pos.x - o.x;
        const oz = pos.z - o.z;
        const od = Math.hypot(ox, oz);
        if (od < o.r + 0.9 && od > 0.001) {
          const push = (o.r + 0.9 - od) / (o.r + 0.9);
          to.x += (ox / od) * push * 1.5;
          to.z += (oz / od) * push * 1.5;
        }
      }
      to.normalize();
    }
    // hoppers move in bursts
    let speed = (SPEED[this.model.movement] ?? 0.7) * speedMul;
    if (this.model.movement === 'hop') speed *= 0.4 + Math.sin((this.hopT % 1) * Math.PI) * 1.2;
    const step = Math.min(d, speed * dt);
    const nx = pos.x + to.x * step;
    const nz = pos.z + to.z * step;
    if (this.isSwimmer || onIsland(nx, nz, 0.4) || this.state === 'arrive') pos.set(nx, pos.y, nz);
    else this.target.set(pos.x * 0.8, 0, pos.z * 0.8);
    this.face(new THREE.Vector3(pos.x + to.x, 0, pos.z + to.z), dt);
    return false;
  }

  dispose(scene: THREE.Object3D): void {
    scene.remove(this.root);
    disposeCreature(this.model);
    this.hit.geometry.dispose();
    this.ring.geometry.dispose();
  }
}
