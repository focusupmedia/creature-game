import * as THREE from 'three';
import { species } from '../content/species';
import { inWater, isBlocked, onLand, randomLand, randomWater, type Geo } from '../content/islands';
import { creatureTraits, currentScale, displayName } from '../core/creatures';
import type { Creature, EventKind, Personality, Trait } from '../core/types';
import { animateGlow, animatePrismatic, buildCreature, disposeCreature, type CreatureModel } from './creatureModels';
import { emoteTexture } from './materials';

// The living world: creatures pick small goals (wander, nap, visit a lure, dig,
// squabble, shelter from weather, greet a friend) so the sanctuary is worth just
// watching. Personality changes how often each of those happens.

export interface ActorContext {
  darkness: number;
  sky: EventKind | null;
  lures: { id: string; x: number; z: number; attracts: Trait }[];
  actors: CreatureActor[];
  now: number;
  fx: (kind: 'dirt' | 'dust', at: THREE.Vector3) => void;
}

type State = 'arrive' | 'wander' | 'idle' | 'eat' | 'sleep' | 'nap' | 'shelter' | 'social' | 'squabble' | 'dig' | 'celebrate' | 'lookup';

const SPEED: Record<string, number> = { hop: 1.1, walk: 0.7, scuttle: 1.0, fly: 1.3, swim: 0.8, slither: 0.6, waddle: 0.45, float: 0.55 };

interface Temper { speed: number; idle: number; nap: number; social: number; squabble: number; lure: number }
const TEMPER: Record<Personality, Temper> = {
  energetic: { speed: 1.35, idle: 0.15, nap: 0.01, social: 0.5, squabble: 0.35, lure: 0.3 },
  lazy: { speed: 0.7, idle: 0.55, nap: 0.25, social: 0.3, squabble: 0.05, lure: 0.15 },
  shy: { speed: 0.9, idle: 0.4, nap: 0.05, social: 0.15, squabble: 0.02, lure: 0.15 },
  curious: { speed: 1.1, idle: 0.25, nap: 0.03, social: 0.45, squabble: 0.08, lure: 0.45 },
  grumpy: { speed: 0.95, idle: 0.4, nap: 0.06, social: 0.25, squabble: 0.45, lure: 0.2 },
  friendly: { speed: 1, idle: 0.3, nap: 0.04, social: 0.8, squabble: 0.03, lure: 0.25 },
};

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
  private onDug: (() => void) | null = null;
  private fxTimer = 0;
  private ring: THREE.Mesh;
  private noteText = '';
  private noteAt = -999;
  private nightOwl: boolean;
  private dayOnly: boolean;
  private temper: Temper;
  private scaleNow = 1;
  private amphibious: boolean;

  constructor(public creature: Creature, scene: THREE.Object3D, public geo: Geo) {
    this.model = buildCreature(creature.species, creature.mutations, creature.seed);
    this.root = this.model.root;
    this.traits = creatureTraits(creature);
    const sp = species(creature.species);
    this.nightOwl = sp.activity === 'night';
    this.dayOnly = sp.activity === 'day';
    this.temper = TEMPER[creature.personality] ?? TEMPER.friendly;
    this.amphibious = this.traits.includes('Amphibian');
    const h = this.model.height;
    this.hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.55, h * 0.7), 6, 4), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = h * 0.5;
    this.hit.userData.pick = { kind: 'creature', id: creature.id };
    this.root.add(this.hit);
    this.emoteSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, opacity: 0 }));
    this.emoteSprite.renderOrder = 10;
    this.root.add(this.emoteSprite);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 28), new THREE.MeshBasicMaterial({ color: '#fff7c2', transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.root.add(this.ring);
    const start = this.isSwimmer ? randomWater(geo, Math.random) : randomLand(geo, Math.random);
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

  /** Something notable just happened; it shows in the name bubble for a while. */
  note(text: string): void {
    this.noteText = text;
    this.noteAt = this.phase;
  }

  /** A short, human line about what the creature is doing right now. */
  activity(): string {
    if (this.noteText && this.phase - this.noteAt < 25) return this.noteText;
    switch (this.state) {
      case 'arrive': return this.onArrived ? 'Following a scent…' : 'Heading over to the lure';
      case 'eat': return 'Nibbling the lure 😋';
      case 'sleep': return 'Fast asleep 💤';
      case 'nap': return 'Having a little nap 😴';
      case 'shelter': return this.isCold ? 'Hiding from the snow ❄️' : 'Hiding from the rain ☔';
      case 'social': return this.partner ? `Saying hi to ${displayName(this.partner.creature)}` : 'Saying hi';
      case 'squabble': return this.partner ? `Squabbling with ${displayName(this.partner.creature)} 💢` : 'Grumbling 💢';
      case 'dig': return this.onDug ? 'Digging for something… ⛏️' : 'Digging';
      case 'celebrate': return 'Celebrating ✨';
      case 'lookup': return 'Staring up at the sky';
      case 'idle': return 'Taking in the view';
      default: return this.isSwimmer ? 'Swimming laps' : this.isFlyer ? 'Fluttering about' : 'Wandering about';
    }
  }

  private isCold = false;

  /** World-space point just above the creature's head. */
  headPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.root.position).setY(this.root.position.y + this.model.height * this.root.scale.y + 0.25);
  }

  /** Enter from the island edge (or splash into the water) and walk to a lure. */
  arrive(spot: { x: number; z: number }, done?: () => void): void {
    const g = this.geo;
    if (this.isSwimmer) {
      const p = randomWater(g, Math.random);
      this.root.position.set(p.x, 0, p.z);
      this.target.set(spot.x - 0.6, 0, spot.z);
      this.clampToWater(this.target);
    } else {
      const a = Math.atan2(spot.z - g.oz, spot.x - g.ox) + (Math.random() - 0.5) * 1.2;
      this.root.position.set(g.ox + Math.cos(a) * (g.r - 0.6), 0, g.oz + Math.sin(a) * (g.r - 0.6));
      const off = new THREE.Vector3(spot.x, 0, spot.z).sub(this.root.position).normalize().multiplyScalar(0.8);
      this.target.set(spot.x - off.x, 0, spot.z - off.z);
    }
    this.state = 'arrive';
    this.onArrived = done ?? null;
    this.emote('❗', 1.6);
  }

  /** Walk to a spot and dig something up there. `done` fires when the find pops out. */
  digAt(x: number, z: number, done: () => void): void {
    this.target.set(x, 0, z);
    if (this.isSwimmer) this.clampToWater(this.target);
    this.state = 'wander';
    this.onDug = done;
    this.timer = 0;
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
    this.isCold = ctx.sky === 'blizzard';
    const asleepTime = (this.dayOnly && ctx.darkness > 0.7 && ctx.sky !== 'eclipse') || (this.nightOwl && ctx.darkness < 0.3);

    // growth: hatchlings visibly grow into their rolled size
    this.scaleNow = m.baseScale * currentScale(this.creature, ctx.now);
    this.root.scale.setScalar(this.scaleNow);
    this.emoteSprite.scale.setScalar(0.55 / this.scaleNow);

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
        if (this.moveToward(dt, 1) || this.timer < -12) {
          if (this.onDug) {
            this.state = 'dig';
            this.timer = 2.4;
            this.emote('⛏️', 2);
          } else this.decide(ctx, asleepTime);
        }
        break;
      case 'dig':
        this.fxTimer -= dt;
        if (this.fxTimer <= 0) {
          this.fxTimer = 0.22;
          ctx.fx('dirt', this.root.position.clone().add(new THREE.Vector3(Math.sin(this.heading) * 0.3, 0.1, Math.cos(this.heading) * 0.3)));
        }
        if (this.timer <= 0) {
          const done = this.onDug;
          this.onDug = null;
          done?.();
          this.emote(Math.random() < 0.5 ? '✨' : '❗', 1.6);
          this.note('Just dug something up! ✨');
          this.state = 'idle';
          this.timer = 1.5;
        }
        break;
      case 'shelter':
        this.moveToward(dt, 1.1);
        if (ctx.sky !== 'storm' && ctx.sky !== 'blizzard') this.decide(ctx, asleepTime);
        break;
      case 'social':
        if (this.partner) this.face(this.partner.position, dt);
        if (this.timer <= 0) {
          this.partner = null;
          this.decide(ctx, asleepTime);
        }
        break;
      case 'squabble':
        if (this.partner) this.face(this.partner.position, dt);
        this.fxTimer -= dt;
        if (this.fxTimer <= 0 && this.partner && this.creature.id < this.partner.creature.id) {
          this.fxTimer = 0.35;
          ctx.fx('dust', this.root.position.clone().lerp(this.partner.position, 0.5).setY(0.25));
        }
        if (Math.random() < dt * 0.8) this.emote(Math.random() < 0.6 ? '💢' : '😤', 1);
        if (this.timer <= 0) {
          this.partner = null;
          this.emote(this.creature.personality === 'grumpy' ? '😤' : '😅', 1.4);
          this.pickWander();
        }
        break;
      case 'sleep':
        if (!asleepTime) {
          this.emote('🌅', 1.2);
          this.note('Just woke up 🌅');
          this.decide(ctx, false);
        } else if (Math.random() < dt * 0.15) this.emote('💤', 2);
        break;
      case 'nap':
        if (Math.random() < dt * 0.2) this.emote('💤', 2);
        if (this.timer <= 0) {
          this.note('Woke up from a nap');
          this.decide(ctx, asleepTime);
        }
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
        this.hopT += dt * 2.2 * this.temper.speed;
        const h = Math.sin((this.hopT % 1) * Math.PI);
        body.position.y = h * 0.3;
        body.scale.set(1 - h * 0.08, 1 + h * 0.12, 1 - h * 0.08);
        for (const leg of m.legs) leg.rotation.x = -h * 0.8;
      } else {
        const b = Math.sin(this.phase * 2) * 0.03;
        body.scale.set(1 + b, 1 - b, 1 + b);
      }
    } else if (mv === 'walk' || mv === 'scuttle' || mv === 'waddle') {
      const sp = (mv === 'scuttle' ? 18 : mv === 'waddle' ? 6 : 9) * this.temper.speed;
      m.legs.forEach((leg, i) => (leg.rotation.x = moving ? Math.sin(this.phase * sp + i * Math.PI) * 0.6 : 0));
      body.position.y = moving ? Math.abs(Math.sin(this.phase * sp)) * 0.03 : 0;
      if (mv === 'waddle') body.rotation.z = moving ? Math.sin(this.phase * sp) * 0.15 : 0;
      if (!moving) body.scale.y = 1 + Math.sin(this.phase * 1.6) * 0.02;
      if (m.tail) m.tail.rotation.y = Math.sin(this.phase * (moving ? 6 : 2)) * 0.3;
    } else if (mv === 'fly') {
      const flap = Math.sin(this.phase * (moving ? 16 : 6));
      m.wings.forEach((w, i) => (w.rotation.z = flap * 0.7 * (i % 2 ? -1 : 1)));
      const resting = this.state === 'sleep' || this.state === 'nap' || this.state === 'eat' || this.state === 'dig';
      const targetY = resting ? 0.25 : this.flyHeight + Math.sin(this.phase * 1.7) * 0.15;
      this.root.position.y += (targetY - this.root.position.y) * Math.min(1, dt * 2);
      if (m.tail) m.tail.rotation.y = Math.sin(this.phase * 2.5) * 0.3;
    } else if (mv === 'float') {
      const targetY = (this.state === 'sleep' || this.state === 'nap' ? 0.5 : this.flyHeight) + Math.sin(this.phase * 1.3) * 0.2;
      this.root.position.y += (targetY - this.root.position.y) * Math.min(1, dt * 1.5);
      if (m.tail) m.tail.rotation.z = Math.sin(this.phase * 2) * 0.3;
      m.wings.forEach((w, i) => (w.rotation.z = Math.sin(this.phase * 2.5) * 0.4 * (i % 2 ? -1 : 1)));
      m.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.phase * 2.2 + i) * 0.35));
    } else if (mv === 'swim') {
      this.root.position.y = -0.1 + Math.sin(this.phase * 2) * 0.03;
      if (m.tail) m.tail.rotation.y = Math.sin(this.phase * (moving ? 10 : 4)) * 0.5;
      m.wings.forEach((w, i) => (w.rotation.y = Math.sin(this.phase * 8 + i * Math.PI) * 0.5));
    } else if (mv === 'slither') {
      m.segments.forEach((s, i) => {
        s.position.x = Math.sin(this.phase * (moving ? 7 : 2) - i * 0.9) * (moving ? 0.1 : 0.04) * Math.min(1, i * 0.5);
      });
    }
    if (mv !== 'fly' && mv !== 'float' && mv !== 'swim') {
      // amphibians wade: sink a little in water
      this.root.position.y = this.amphibious && inWater(this.geo, this.root.position.x, this.root.position.z, -0.3) ? -0.12 : 0;
    }
    if (m.tail && mv === 'hop') m.tail.rotation.y = Math.sin(this.phase * 3) * 0.25;

    // species flourishes
    const excited = this.state === 'celebrate' || this.state === 'squabble' || this.state === 'social';
    if (this.creature.species === 'sunscale') {
      const want = excited ? 1 : 0.45;
      for (const f of m.wings) f.scale.setScalar(f.scale.x + (want - f.scale.x) * Math.min(1, dt * 8));
    } else if (this.creature.species === 'axolotl') {
      m.wings.forEach((f, i) => (f.rotation.x = Math.sin(this.phase * 2 + i) * 0.25));
    } else if (this.creature.species === 'coralpuff' && excited) {
      body.scale.multiplyScalar(1.3);
    }

    if (this.state === 'eat') {
      body.rotation.x = 0.25 + Math.sin(this.phase * 8) * 0.12;
      if (Math.random() < dt * 0.4) this.emote('😋', 1);
    } else if (this.state === 'dig') {
      body.rotation.x = 0.45 + Math.sin(this.phase * 18) * 0.15;
      body.position.y += Math.abs(Math.sin(this.phase * 18)) * 0.05;
    } else if (this.state === 'sleep' || this.state === 'nap') {
      body.scale.set(1.05, 0.88 + Math.sin(this.phase * 1.2) * 0.03, 1.05);
    } else if (this.state === 'squabble') {
      const bounce = Math.abs(Math.sin(this.phase * 10));
      body.position.y += bounce * 0.18;
      body.rotation.z = Math.sin(this.phase * 14) * 0.18;
      body.rotation.x = -0.15;
    } else if (this.state === 'celebrate') {
      body.position.y += Math.abs(Math.sin(this.phase * 8)) * 0.35;
      this.root.rotation.y += dt * 4;
      if (this.timer <= 0) this.decide(ctx, asleepTime);
    } else if (this.state === 'lookup') {
      body.rotation.x = -0.35;
    } else if (this.state === 'shelter' && this.isCold && !moving) {
      body.rotation.z = Math.sin(this.phase * 40) * 0.04; // shivering
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
    if (m.twinkles) {
      m.twinkles.children.forEach((s, i) => s.scale.setScalar(0.03 + Math.max(0, Math.sin(this.phase * 4 + i * 1.7)) * 0.05));
    }
    if (this.root.userData.prismatic) animatePrismatic(m, time);
    animateGlow(m, time);

    // emote bubble
    this.emoteLife -= dt;
    const em = this.emoteSprite.material as THREE.SpriteMaterial;
    em.opacity = Math.max(0, Math.min(1, this.emoteLife * 2));
    this.emoteSprite.position.y = m.height + 0.35 / Math.max(0.5, this.scaleNow) + (2 - Math.max(0, this.emoteLife)) * 0.1;
    if (this.ring.visible) (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(time * 5) * 0.3;
  }

  private decide(ctx: ActorContext, asleepTime: boolean): void {
    const T = this.temper;
    if (asleepTime) {
      this.state = 'sleep';
      this.emote('💤', 2.5);
      return;
    }
    // bad weather: most creatures run for cover
    const badWeather = ctx.sky === 'storm' || ctx.sky === 'blizzard';
    const hardy = ctx.sky === 'storm'
      ? this.traits.some((t) => t === 'Tide' || t === 'Amphibian' || t === 'Fish' || t === 'Storm' || t === 'Reef')
      : this.traits.some((t) => t === 'Frost' || t === 'Ember');
    if (badWeather && !hardy && !this.isSwimmer && this.geo.shelters.length && Math.random() < 0.85) {
      const s = this.geo.shelters.reduce((best, t) => (this.dist2(t) < this.dist2(best) ? t : best), this.geo.shelters[0]);
      const a = Math.random() * Math.PI * 2;
      this.target.set(s.x + Math.cos(a) * 0.9 * s.s, 0, s.z + Math.sin(a) * 0.9 * s.s);
      this.state = 'shelter';
      this.emote(ctx.sky === 'blizzard' ? '🥶' : '☔', 1.5);
      return;
    }
    if (badWeather && hardy && Math.random() < 0.3) this.emote(ctx.sky === 'blizzard' ? '❄️' : '🎵', 1.8);
    if ((ctx.sky === 'eclipse' || ctx.sky === 'fullmoon' || ctx.sky === 'starry') && Math.random() < 0.35) {
      this.state = 'lookup';
      this.timer = 2 + Math.random() * 2;
      this.emote(this.traits.includes('Mystic') || this.traits.includes('Spirit') ? '✨' : ctx.sky === 'starry' ? '🌠' : '❓', 2);
      return;
    }
    // lazy creatures nap during the day too
    if (Math.random() < T.nap) {
      this.state = 'nap';
      this.timer = 8 + Math.random() * 10;
      this.emote('😴', 2);
      return;
    }
    // visit a lure that smells right
    const lure = ctx.lures.find((l) => this.traits.includes(l.attracts));
    if (lure && Math.random() < T.lure && !this.isSwimmer) {
      this.target.set(lure.x + (Math.random() - 0.5) * 1.2, 0, lure.z + (Math.random() - 0.5) * 1.2);
      this.state = 'arrive';
      return;
    }
    // meet a neighbour: say hello, or pick a playful squabble
    if (this.socialCooldown <= 0) {
      const near = ctx.actors.find((o) => o !== this && o.geo === this.geo && !['sleep', 'nap', 'arrive', 'dig', 'squabble', 'social'].includes(o.state)
        && o.position.distanceTo(this.position) < 2.4 && o.isSwimmer === this.isSwimmer);
      if (near) {
        const r = Math.random();
        if (r < T.squabble && near.creature.personality !== 'shy') {
          for (const [a, b] of [[this, near], [near, this]] as const) {
            a.state = 'squabble';
            a.partner = b;
            a.timer = 2.6;
            a.socialCooldown = 30 + Math.random() * 20;
          }
          this.emote('💢', 1.4);
          near.emote('❗', 1.2);
          this.note(`Picked a squabble with ${displayName(near.creature)}`);
          near.note(`Got into a squabble with ${displayName(this.creature)}`);
          return;
        }
        if (r < T.squabble + T.social) {
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
    }
    if (Math.random() < T.idle) {
      this.state = 'idle';
      this.timer = 1.5 + Math.random() * 4;
      if (this.creature.personality === 'curious' && Math.random() < 0.3) this.emote('🔍', 1.5);
      return;
    }
    this.pickWander();
  }

  private pickWander(): void {
    const g = this.geo;
    let p = this.isSwimmer ? randomWater(g, Math.random) : randomLand(g, Math.random);
    // shy creatures keep to the edges
    if (this.creature.personality === 'shy' && !this.isSwimmer && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      const edge = { x: g.ox + Math.cos(a) * (g.r - 1.6), z: g.oz + Math.sin(a) * (g.r - 1.6) };
      if (!isBlocked(g, edge.x, edge.z) && !inWater(g, edge.x, edge.z, 0.4)) p = edge;
    }
    const cur = this.root.position;
    const d = Math.hypot(p.x - cur.x, p.z - cur.z);
    const reach = this.creature.personality === 'energetic' ? 6 : 4;
    const k = d > reach ? reach / d : 1;
    this.target.set(cur.x + (p.x - cur.x) * k, 0, cur.z + (p.z - cur.z) * k);
    if (this.isSwimmer) this.clampToWater(this.target);
    else if (inWater(g, this.target.x, this.target.z, 0.3) && !this.amphibious) this.target.set(p.x, 0, p.z);
    this.state = 'wander';
    this.timer = 0;
  }

  private clampToWater(v: THREE.Vector3): void {
    const water = this.geo.water;
    if (!water.length) return;
    const c = water.reduce((best, w) => (Math.hypot(v.x - w.x, v.z - w.z) - w.r < Math.hypot(v.x - best.x, v.z - best.z) - best.r ? w : best), water[0]);
    const dx = v.x - c.x;
    const dz = v.z - c.z;
    const d = Math.hypot(dx, dz);
    const max = c.r - 0.5;
    if (d > max) v.set(c.x + (dx / Math.max(d, 0.001)) * max, 0, c.z + (dz / Math.max(d, 0.001)) * max);
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
    if (!this.isFlyer && !this.isSwimmer) {
      for (const o of [...this.geo.obstacles, ...this.geo.lava]) {
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
    let speed = (SPEED[this.model.movement] ?? 0.7) * speedMul * this.temper.speed;
    if (this.model.movement === 'hop') speed *= 0.4 + Math.sin((this.hopT % 1) * Math.PI) * 1.2;
    const step = Math.min(d, speed * dt);
    const nx = pos.x + to.x * step;
    const nz = pos.z + to.z * step;
    const g = this.geo;
    if (this.isSwimmer || onLand(g, nx, nz, 0.4) || this.state === 'arrive') pos.set(nx, pos.y, nz);
    else this.target.set(g.ox + (pos.x - g.ox) * 0.8, 0, g.oz + (pos.z - g.oz) * 0.8);
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
