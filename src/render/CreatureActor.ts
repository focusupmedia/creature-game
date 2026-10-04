import * as THREE from 'three';
import { species } from '../content/species';
import { inWater, isBlocked, onLand, randomLand, randomWater, type Geo } from '../content/islands';
import { globeNormal, globePoint, globeStep } from '../content/globe';
import { creatureTraits, displayName, displayScale } from '../core/creatures';
import { hasQuirk, temperOf } from '../core/quirks';
import { TUNING } from '../content/tuning';
import type { QuirkId } from '../content/quirks';
import type { Creature, EventKind, Personality, Trait } from '../core/types';
import { animateGlow, animatePrismatic, buildCreature, disposeCreature, type CreatureModel } from './creatureModels';
import { emoteTexture } from './materials';

// The living world: creatures pick small goals (wander, nap, visit a lure, dig,
// squabble, shelter from weather, greet a friend) so the sanctuary is worth just
// watching. Personality changes how often each of those happens.

export interface ActorContext {
  darkness: number;
  sky: EventKind | null;
  lures: { id: string; x: number; z: number; attracts: Trait | 'Any' }[];
  actors: CreatureActor[];
  now: number;
  fx: (kind: FxKind, at: THREE.Vector3) => void;
  /** Coins on the ground a Greedy creature could fetch. */
  gifts: { id: string; x: number; z: number }[];
  /** A creature picked up a gift for the player. */
  collect: (giftId: string, by: CreatureActor) => void;
  /** The patch of globe the keeper is looking at (best friends wander over to it). */
  focus: { x: number; z: number } | null;
}

export type FxKind = 'dirt' | 'dust' | 'splash' | 'leaf';

/** How a creature works a spot: dig in dirt, fish in a puddle, forage a bush. */
export type DigStyle = 'dirt' | 'splash' | 'leaf';
const DIG_LOOK: Record<DigStyle, { emote: string; note: string }> = {
  dirt: { emote: '⛏️', note: 'Just dug something up! ✨' },
  splash: { emote: '🎣', note: 'Just fished something up! ✨' },
  leaf: { emote: '🫐', note: 'Just foraged something! ✨' },
};

type State = 'arrive' | 'wander' | 'idle' | 'eat' | 'sleep' | 'nap' | 'shelter' | 'social' | 'squabble' | 'dig' | 'celebrate' | 'lookup' | 'carried' | 'fetch'
  // things pets get up to on their own
  | 'chase' | 'flee' | 'cuddle' | 'flutter' | 'splash' | 'dance' | 'sunbathe' | 'ball';

const NEUTRAL: Temper = { speed: 1, idle: 0.3, nap: 0.04, social: 0.4, squabble: 0.08, lure: 0.25 };

const CARRY_HEIGHT = 1.4;

const UP = new THREE.Vector3();
const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const BASIS = new THREE.Matrix4();
const SHADOW_GEO = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const RING_GEO = new THREE.RingGeometry(1.05, 1.3, 32).rotateX(-Math.PI / 2);
const RARITY_RING: Record<string, string> = { uncommon: '#4fdf5a', rare: '#3a9aff', legendary: '#ffc02a', mythical: '#ff6fd8' };
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: '#1b2a4a', transparent: true, opacity: 0.22, depthWrite: false });

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
  /** Where it is on the island map (x, z) and how high above the ground (y). The globe wrap happens in place(). */
  readonly p = new THREE.Vector3();
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
  private digStyle: DigStyle = 'dirt';
  /** Height left to fall after being put down. */
  private fall = 0;
  private fxTimer = 0;
  private ring: THREE.Mesh;
  private shadow: THREE.Mesh;
  private noteText = '';
  private noteAt = -999;
  private nightOwl: boolean;
  private dayOnly: boolean;
  private fetchId: string | null = null;
  private tripT = 0;
  private scaleNow = 1;
  /** A little toy for the moment: a butterfly, a firefly, a bubble or a ball. */
  private prop: THREE.Group | null = null;
  private propKind: 'butterfly' | 'firefly' | 'bubble' | 'ball' | null = null;
  private splashing = false;
  /** Its temper (first personality trait), adjusted by its other traits. */
  private get temper(): Temper {
    const t = temperOf(this.creature);
    const base = { ...(t ? TEMPER[t] : NEUTRAL) };
    if (this.q('sleepy')) base.nap += 0.2;
    if (this.q('social')) { base.social += 0.4; base.squabble *= 0.5; }
    if (this.q('loner')) { base.social = 0; base.squabble = 0; }
    if (this.q('glutton')) base.lure += 0.2;
    // hungry creatures get grumpy
    if (this.hungry) { base.squabble += 0.3; base.social *= 0.5; }
    return base;
  }

  get hungry(): boolean {
    return (this.creature.fullness ?? 1) < TUNING.hungry;
  }

  private q(id: QuirkId): boolean {
    return hasQuirk(this.creature, id);
  }

  private get amphibious(): boolean {
    return this.traits.includes('Amphibian') || this.q('swimmer');
  }

  constructor(public creature: Creature, scene: THREE.Object3D, public geo: Geo) {
    this.model = buildCreature(creature.species, creature.mutations, creature.seed, creature.shade);
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
    this.emoteSprite.renderOrder = 10;
    this.root.add(this.emoteSprite);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 28), new THREE.MeshBasicMaterial({ color: '#fff7c2', transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.root.add(this.ring);
    // a soft blob shadow that stays on the ground even when it flies or is carried
    this.shadow = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    this.shadow.scale.setScalar(Math.max(0.35, h * 0.45));
    this.shadow.renderOrder = -1;
    this.root.add(this.shadow);
    // a coloured ring on the ground shows rarity at a glance (uncommon and up)
    const rc = RARITY_RING[sp.rarity];
    if (rc) {
      const ring = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: rc, transparent: true, opacity: 0.75, depthWrite: false }));
      ring.renderOrder = -1;
      this.shadow.add(ring);
    }
    const start = this.isSwimmer ? randomWater(geo, Math.random) : randomLand(geo, Math.random);
    this.p.set(start.x, 0, start.z);
    this.place();
    this.pickWander();
    scene.add(this.root);
  }

  get id(): string { return this.creature.id; }
  get isFlyer(): boolean { return this.model.movement === 'fly' || this.model.movement === 'float'; }
  get isSwimmer(): boolean { return this.model.movement === 'swim'; }
  /** Map position (x, z) plus height above ground (y). */
  get position(): THREE.Vector3 { return this.p; }
  /** Where it really is in the 3D world. */
  get worldPosition(): THREE.Vector3 { return this.root.position; }

  setSelected(on: boolean): void {
    this.ring.visible = on;
    // a wandering creature stops and waits while you look at it
    this.held = on;
    if (on && ['wander', 'idle', 'chase', 'flee', 'flutter', 'ball', 'splash', 'dance', 'sunbathe'].includes(this.state)) {
      this.dropProp();
      this.partner = null;
      this.state = 'idle';
      this.timer = 1;
      this.emote('❓', 1.2);
    }
  }

  private held = false;
  /** A lure visitor waits near its lure with a ! until you say hello. */
  waitAt: { x: number; z: number } | null = null;

  /** Put a visitor next to its lure straight away (after a reload). */
  standNear(spot: { x: number; z: number }): void {
    const a = Math.random() * Math.PI * 2;
    this.p.set(spot.x + Math.cos(a) * 0.9, 0, spot.z + Math.sin(a) * 0.9);
    if (this.isSwimmer) this.clampToWater(this.p);
    this.state = 'idle';
    this.timer = 1;
    this.place();
  }

  /** Something notable just happened; it shows in the name bubble for a while. */
  note(text: string): void {
    this.noteText = text;
    this.noteAt = this.phase;
  }

  /** A short, human line about what the creature is doing right now. */
  activity(): string {
    if (this.waitAt && this.state !== 'arrive') return 'Waiting by the lure to meet you ❗';
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
      case 'fetch': return 'Off to grab something shiny 💰';
      case 'chase': return this.partner ? `Chasing ${displayName(this.partner.creature)}! 😆` : 'Playing chase';
      case 'flee': return this.partner ? `Running from ${displayName(this.partner.creature)}! 😆` : 'Playing chase';
      case 'cuddle': return this.partner ? `Snuggling up with ${displayName(this.partner.creature)} 🥰` : 'Snuggling up';
      case 'flutter': return this.propKind === 'firefly' ? 'Chasing fireflies ✨' : this.propKind === 'bubble' ? 'Popping bubbles 🫧' : 'Chasing a butterfly 🦋';
      case 'splash': return 'Splashing about 💦';
      case 'dance': return 'Dancing 🎵';
      case 'sunbathe': return 'Sunbathing 😎';
      case 'ball': return 'Playing with a ball ⚽';
      case 'idle': return this.hungry ? 'Hungry… 🍖' : 'Taking in the view';
      default: return this.isSwimmer ? 'Swimming laps' : this.isFlyer ? 'Fluttering about' : 'Wandering about';
    }
  }

  private isCold = false;

  /** World-space point just above the creature's head. */
  headPosition(out: THREE.Vector3): THREE.Vector3 {
    const w = globePoint(this.geo, this.p.x, this.p.z, this.p.y + this.model.height * this.root.scale.y + 0.25);
    return out.set(w.x, w.y, w.z);
  }

  /** Enter from the island edge (or splash into the water) and walk to a lure. */
  arrive(spot: { x: number; z: number }, done?: () => void): void {
    const g = this.geo;
    if (this.isSwimmer) {
      const p = randomWater(g, Math.random);
      this.p.set(p.x, 0, p.z);
      this.target.set(spot.x - 0.6, 0, spot.z);
      this.clampToWater(this.target);
    } else {
      const a = Math.atan2(spot.z - g.oz, spot.x - g.ox) + (Math.random() - 0.5) * 1.2;
      this.p.set(g.ox + Math.cos(a) * (g.r - 0.6), 0, g.oz + Math.sin(a) * (g.r - 0.6));
      const off = new THREE.Vector3(spot.x - this.p.x, 0, spot.z - this.p.z).normalize().multiplyScalar(0.8);
      this.target.set(spot.x - off.x, 0, spot.z - off.z);
    }
    this.state = 'arrive';
    this.onArrived = done ?? null;
    this.emote('❗', 1.6);
  }

  /** Walk to a spot and dig something up there. `done` fires when the find pops out. */
  digAt(x: number, z: number, done: () => void, style: DigStyle = 'dirt'): void {
    this.digStyle = style;
    this.target.set(x, 0, z);
    if (this.isSwimmer) this.clampToWater(this.target);
    this.state = 'wander';
    this.onDug = done;
    this.timer = 0;
  }

  get carried(): boolean {
    return this.state === 'carried';
  }

  /** Lifted by the player. Whatever it was doing is dropped (a pending dig still finishes later). */
  /** Finish anything waiting on this actor (a find it was digging up) before it goes away. */
  flushPending(): void {
    if (this.onArrived) {
      this.onArrived();
      this.onArrived = null;
    }
    if (this.onDug) {
      const done = this.onDug;
      this.onDug = null;
      done();
    }
  }

  pickUp(): void {
    if (this.onArrived) {
      this.onArrived();
      this.onArrived = null;
    }
    if (this.onDug) {
      // whatever it was digging for pops out anyway
      const done = this.onDug;
      this.onDug = null;
      this.digStyle = 'dirt';
      done();
    }
    this.partner = null;
    this.state = 'carried';
    this.emote(this.creature.personality === 'grumpy' ? '😤' : this.creature.personality === 'shy' ? '😳' : '😮', 1.5);
  }

  carryTo(x: number, z: number): void {
    this.face(new THREE.Vector3(x, 0, z), 0.05);
    this.p.x = x;
    this.p.z = z;
  }

  /** Put down where it hangs. Walkers hop back onto land, swimmers back into water. */
  putDown(): void {
    const g = this.geo;
    const p = this.p;
    const bad = this.isSwimmer ? !inWater(g, p.x, p.z, -0.3) : !onLand(g, p.x, p.z, 0.5) || (!this.amphibious && !this.isFlyer && inWater(g, p.x, p.z, 0.1));
    this.fall = CARRY_HEIGHT;
    this.state = 'idle';
    this.timer = 1;
    if (bad) {
      const to = this.isSwimmer ? randomWater(g, Math.random) : randomLand(g, Math.random);
      this.target.set(to.x, 0, to.z);
      this.state = 'wander';
      this.timer = 6;
    }
    this.emote(this.creature.personality === 'energetic' ? '😆' : '😊', 1.2);
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
    // Night Owls stay up all night, Early Birds are up all day, whatever their kind does.
    const sleepsAtNight = (this.dayOnly || this.q('earlybird')) && !this.q('nightowl');
    const sleepsByDay = this.nightOwl && !this.q('earlybird');
    const asleepTime = (sleepsAtNight && ctx.darkness > 0.7 && ctx.sky !== 'eclipse') || (sleepsByDay && ctx.darkness < 0.3);

    // growth: hatchlings visibly grow into their rolled size
    this.scaleNow = m.baseScale * displayScale(this.creature, ctx.now);
    this.root.scale.setScalar(this.scaleNow);
    this.emoteSprite.scale.setScalar(0.55 / this.scaleNow);

    // ---- decide
    switch (this.state) {
      case 'arrive':
        if (this.moveToward(dt, 1.2)) {
          this.state = 'eat';
          this.timer = (3 + Math.random() * 2) * (this.q('glutton') ? 2.5 : 1);
          this.onArrived?.();
          this.onArrived = null;
        }
        break;
      case 'wander':
        if (this.moveToward(dt, 1) || this.timer < -12) {
          if (this.onDug) {
            this.state = 'dig';
            this.timer = 2.4;
            this.emote(DIG_LOOK[this.digStyle].emote, 2);
          } else this.decide(ctx, asleepTime);
        }
        break;
      case 'dig':
        this.fxTimer -= dt;
        if (this.fxTimer <= 0) {
          this.fxTimer = 0.22;
          ctx.fx(this.digStyle, this.p.clone().add(new THREE.Vector3(Math.sin(this.heading) * 0.3, 0.1, Math.cos(this.heading) * 0.3)));
        }
        if (this.timer <= 0) {
          const done = this.onDug;
          this.onDug = null;
          done?.();
          this.emote(Math.random() < 0.5 ? '✨' : '❗', 1.6);
          this.note(DIG_LOOK[this.digStyle].note);
          this.digStyle = 'dirt';
          this.state = 'idle';
          this.timer = 1.5;
        }
        break;
      case 'carried':
        break;
      case 'chase':
        if (this.partner) this.target.set(this.partner.p.x, 0, this.partner.p.z);
        this.moveToward(dt, 1.5);
        if (this.timer <= 0 || !this.partner) {
          this.emote('😆', 1.4);
          this.partner = null;
          this.decide(ctx, asleepTime);
        }
        break;
      case 'flee':
        if (this.moveToward(dt, 1.45) || Math.random() < dt * 0.3) this.runAround(2.2);
        if (this.timer <= 0) {
          this.emote('😂', 1.4);
          this.partner = null;
          this.decide(ctx, asleepTime);
        }
        break;
      case 'cuddle':
        if (this.moveToward(dt, 0.9) || this.timer < -8) {
          this.state = 'sleep';
          this.emote('🥰', 2);
        }
        break;
      case 'flutter':
      case 'ball':
        // zig-zag after the toy
        if (this.moveToward(dt, this.state === 'ball' ? 1.2 : 1.35)) this.runAround(1.4);
        if (this.timer <= 0) {
          this.emote(this.state === 'ball' ? '⚽' : '😊', 1.4);
          this.dropProp();
          this.decide(ctx, asleepTime);
        }
        break;
      case 'splash': {
        const there = this.moveToward(dt, 1.1);
        if (there && !this.splashing) {
          this.splashing = true;
          this.timer = 2.5 + Math.random() * 1.5;
        }
        if (this.splashing) {
          this.fxTimer -= dt;
          if (this.fxTimer <= 0) {
            this.fxTimer = 0.3;
            ctx.fx('splash', this.p.clone().add(new THREE.Vector3(Math.sin(this.heading) * 0.35, 0.05, Math.cos(this.heading) * 0.35)));
          }
          if (Math.random() < dt * 0.6) this.emote('💦', 1);
          if (this.timer <= 0) {
            this.splashing = false;
            this.decide(ctx, asleepTime);
          }
        } else if (this.timer < -10) this.decide(ctx, asleepTime); // couldn't get to the water: never mind
        break;
      }
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
          ctx.fx('dust', this.p.clone().lerp(this.partner.position, 0.5).setY(this.p.y + 0.25));
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
      case 'fetch':
        if (this.fetchId && !ctx.gifts.some((g) => g.id === this.fetchId)) {
          this.fetchId = null;
          this.decide(ctx, asleepTime);
        } else if (this.moveToward(dt, 1.4) || this.timer < -10) {
          if (this.fetchId) ctx.collect(this.fetchId, this);
          this.fetchId = null;
          this.emote('💰', 1.6);
          this.note('Grabbed something shiny for you 💰');
          this.state = 'idle';
          this.timer = 1.2;
        }
        break;
      default:
        if (this.timer <= 0) this.decide(ctx, asleepTime);
    }
    // Clumsy creatures trip now and then while walking.
    if (this.q('clumsy') && this.state === 'wander' && this.tripT <= 0 && Math.random() < dt * 0.04) {
      this.tripT = 0.8;
      this.emote('💫', 1.4);
    }

    // ---- animate
    const mv = m.movement;
    const ground = 0;
    const moving = (this.state === 'wander' || this.state === 'arrive' || this.state === 'shelter' || this.state === 'chase' || this.state === 'flee'
      || this.state === 'cuddle' || this.state === 'flutter' || this.state === 'ball' || this.state === 'splash')
      && Math.hypot(this.p.x - this.target.x, this.p.z - this.target.z) > 0.15;
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
      const targetY = ground + (resting ? 0.25 : this.flyHeight + Math.sin(this.phase * 1.7) * 0.15);
      this.p.y += (targetY - this.p.y) * Math.min(1, dt * 2);
      if (m.tail) m.tail.rotation.y = Math.sin(this.phase * 2.5) * 0.3;
    } else if (mv === 'float') {
      // long floaters (the Cloud Serpent) ripple along their length
      m.segments.forEach((seg, i) => (seg.position.y = Math.sin(this.phase * 2.2 - i * 0.6) * 0.12));
      const targetY = ground + (this.state === 'sleep' || this.state === 'nap' ? 0.5 : this.flyHeight) + Math.sin(this.phase * 1.3) * 0.2;
      this.p.y += (targetY - this.p.y) * Math.min(1, dt * 1.5);
      if (m.tail) m.tail.rotation.z = Math.sin(this.phase * 2) * 0.3;
      m.wings.forEach((w, i) => (w.rotation.z = Math.sin(this.phase * 2.5) * 0.4 * (i % 2 ? -1 : 1)));
      m.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.phase * 2.2 + i) * 0.35));
    } else if (mv === 'swim') {
      this.p.y = ground - 0.1 + Math.sin(this.phase * 2) * 0.03;
      if (m.tail) m.tail.rotation.y = Math.sin(this.phase * (moving ? 10 : 4)) * 0.5;
      m.wings.forEach((w, i) => (w.rotation.y = Math.sin(this.phase * 8 + i * Math.PI) * 0.5));
    } else if (mv === 'slither') {
      m.segments.forEach((s, i) => {
        s.position.x = Math.sin(this.phase * (moving ? 7 : 2) - i * 0.9) * (moving ? 0.1 : 0.04) * Math.min(1, i * 0.5);
      });
    }
    if (mv !== 'fly' && mv !== 'float' && mv !== 'swim') {
      // amphibians wade: sink a little in water
      this.p.y = ground + (this.amphibious && inWater(this.geo, this.p.x, this.p.z, -0.3) ? -0.12 : 0);
    }
    if (m.tail && mv === 'hop') m.tail.rotation.y = Math.sin(this.phase * 3) * 0.25;
    if (this.tripT > 0) {
      this.tripT -= dt;
      body.rotation.x = -Math.sin(Math.min(1, (0.8 - this.tripT) / 0.3) * Math.PI) * 0.9;
    }
    if (this.state === 'carried') {
      // dangling in the air: legs paddle, body sways
      this.p.y = ground + CARRY_HEIGHT + Math.sin(this.phase * 5) * 0.06;
      body.rotation.z = Math.sin(this.phase * 7) * 0.15;
      m.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(this.phase * 16 + i * Math.PI) * 0.7));
      m.wings.forEach((w, i) => (w.rotation.z = Math.sin(this.phase * 14) * 0.6 * (i % 2 ? -1 : 1)));
    } else if (this.fall > 0) {
      this.fall = Math.max(0, this.fall - dt * 7);
      if (!this.isFlyer) this.p.y += this.fall;
    }

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
      this.heading += dt * 4;
      if (this.timer <= 0) this.decide(ctx, asleepTime);
    } else if (this.state === 'lookup') {
      body.rotation.x = -0.35;
    } else if (this.state === 'dance') {
      body.position.y += Math.abs(Math.sin(this.phase * 6)) * 0.22;
      body.rotation.z = Math.sin(this.phase * 6) * 0.25;
      this.heading += dt * 2.5;
      if (Math.random() < dt * 0.5) this.emote(Math.random() < 0.6 ? '🎵' : '💃', 1.2);
    } else if (this.state === 'sunbathe') {
      body.scale.set(1.12, 0.78, 1.12);
      body.rotation.x = -0.2;
      if (Math.random() < dt * 0.15) this.emote('😎', 1.6);
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
    for (const sp of (this.root.userData.spinners ?? []) as THREE.Object3D[]) sp.rotation.y += dt * (sp.userData.spin ?? 1.5);
    this.animateProp(dt, moving);
    if (this.root.userData.prismatic) animatePrismatic(m, time);
    animateGlow(m, time);

    // emote bubble
    this.emoteLife -= dt;
    const em = this.emoteSprite.material as THREE.SpriteMaterial;
    em.opacity = Math.max(0, Math.min(1, this.emoteLife * 2));
    this.emoteSprite.position.y = m.height + 0.35 / Math.max(0.5, this.scaleNow) + (2 - Math.max(0, this.emoteLife)) * 0.1;
    if (this.ring.visible) (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(time * 5) * 0.3;
    this.place();
  }

  /** Stand on the globe: up along the surface normal, facing the heading. */
  place(): void {
    const g = this.geo;
    const { x, z, y } = this.p;
    const w = globePoint(g, x, z, y);
    const n = globeNormal(g, x, z);
    const e = 0.05;
    const a = globePoint(g, x + Math.sin(this.heading) * e, z + Math.cos(this.heading) * e, y);
    UP.set(n.x, n.y, n.z);
    FWD.set(a.x - w.x, a.y - w.y, a.z - w.z);
    FWD.addScaledVector(UP, -FWD.dot(UP));
    if (FWD.lengthSq() < 1e-10) FWD.set(0, 0, 1).addScaledVector(UP, -UP.z);
    FWD.normalize();
    RIGHT.crossVectors(UP, FWD);
    BASIS.makeBasis(RIGHT, UP, FWD);
    this.root.quaternion.setFromRotationMatrix(BASIS);
    this.root.position.set(w.x, w.y, w.z);
    const s = this.root.scale.y || 1;
    this.shadow.position.y = (-y + 0.03) / s;
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.22;
    this.shadow.scale.setScalar(Math.max(0.35, this.model.height * 0.45) * Math.max(0.4, 1 - y * 0.25));
  }

  private decide(ctx: ActorContext, asleepTime: boolean): void {
    const T = this.temper;
    if (this.held && !asleepTime) {
      this.state = 'idle';
      this.timer = 1;
      return;
    }
    if (this.waitAt) {
      // visitors hang about by the lure, hoping you'll come say hello
      const w = this.waitAt;
      if (Math.hypot(this.p.x - w.x, this.p.z - w.z) > 1.8 && !this.isSwimmer) {
        const a = Math.random() * Math.PI * 2;
        this.target.set(w.x + Math.cos(a) * 0.9, 0, w.z + Math.sin(a) * 0.9);
        this.state = 'wander';
        this.timer = 0;
        return;
      }
      this.state = 'idle';
      this.timer = 1.5 + Math.random() * 2;
      this.emote('❗', this.timer + 0.6);
      return;
    }
    if (asleepTime) {
      // snuggle up next to a sleeping friend if one is close by
      const friend = !this.isSwimmer && !this.q('loner') && Math.random() < 0.5
        ? ctx.actors.find((o) => o !== this && o.geo === this.geo && o.state === 'sleep' && !o.isSwimmer && Math.hypot(o.p.x - this.p.x, o.p.z - this.p.z) < 6)
        : undefined;
      if (friend) {
        const a = Math.random() * Math.PI * 2;
        this.target.set(friend.p.x + Math.cos(a) * 0.6, 0, friend.p.z + Math.sin(a) * 0.6);
        this.partner = friend;
        this.state = 'cuddle';
        this.timer = 0;
        this.note(`Snuggling up with ${displayName(friend.creature)} 🥰`);
        return;
      }
      this.state = 'sleep';
      this.emote('💤', 2.5);
      return;
    }
    // bad weather: most creatures run for cover
    const badWeather = ctx.sky === 'storm' || ctx.sky === 'blizzard';
    const hardy = this.q('brave') || (ctx.sky === 'storm'
      ? this.traits.some((t) => t === 'Tide' || t === 'Amphibian' || t === 'Fish' || t === 'Storm' || t === 'Reef')
      : this.traits.some((t) => t === 'Frost' || t === 'Ember'));
    if (badWeather && !hardy && !this.isSwimmer && this.geo.shelters.length && Math.random() < 0.85) {
      const s = this.geo.shelters.reduce((best, t) => (this.dist2(t) < this.dist2(best) ? t : best), this.geo.shelters[0]);
      const a = Math.random() * Math.PI * 2;
      this.target.set(s.x + Math.cos(a) * 0.9 * s.s, 0, s.z + Math.sin(a) * 0.9 * s.s);
      this.state = 'shelter';
      this.emote(ctx.sky === 'blizzard' ? '🥶' : '☔', 1.5);
      return;
    }
    if (badWeather && hardy && Math.random() < 0.3) this.emote(ctx.sky === 'blizzard' ? '❄️' : '🎵', 1.8);
    if ((ctx.sky === 'eclipse' || ctx.sky === 'fullmoon' || ctx.sky === 'starry' || ctx.sky === 'comet' || ctx.sky === 'meteor' || ctx.sky === 'aurora') && Math.random() < 0.35) {
      this.state = 'lookup';
      this.timer = 2 + Math.random() * 2;
      this.emote(this.traits.includes('Mystic') || this.traits.includes('Spirit') ? '✨' : ctx.sky === 'starry' ? '🌠' : ctx.sky === 'comet' ? '💫' : '❓', 2);
      return;
    }
    if (this.weatherFun(ctx)) return;
    // Greedy creatures can't leave shiny things on the ground
    if (this.q('greedy') && !this.isSwimmer && ctx.gifts.length && Math.random() < 0.6) {
      const g = ctx.gifts.reduce((b, x) => (this.dist2(x) < this.dist2(b) ? x : b), ctx.gifts[0]);
      if (ctx.actors.every((o) => o === this || o.fetchId !== g.id)) {
        this.fetchId = g.id;
        this.target.set(g.x, 0, g.z);
        this.state = 'fetch';
        this.timer = 0;
        this.emote('👀', 1.2);
        return;
      }
    }
    // lazy and sleepy creatures nap during the day too
    if (Math.random() < T.nap) {
      this.state = 'nap';
      this.timer = (8 + Math.random() * 10) * (this.q('sleepy') ? 2 : 1);
      this.emote('😴', 2);
      return;
    }
    // visit a lure that smells right
    const lure = ctx.lures.find((l) => l.attracts === 'Any' || this.traits.includes(l.attracts));
    if (lure && Math.random() < T.lure && !this.isSwimmer) {
      this.target.set(lure.x + (Math.random() - 0.5) * 1.2, 0, lure.z + (Math.random() - 0.5) * 1.2);
      this.state = 'arrive';
      return;
    }
    // meet a neighbour: say hello, or pick a playful squabble
    if (this.socialCooldown <= 0) {
      const near = ctx.actors.find((o) => o !== this && o.geo === this.geo && !o.held && !o.waitAt
        && !['sleep', 'nap', 'arrive', 'dig', 'squabble', 'social', 'carried', 'fetch', 'chase', 'flee', 'cuddle', 'eat'].includes(o.state)
        && Math.hypot(o.position.x - this.position.x, o.position.z - this.position.z) < 2.4 && o.isSwimmer === this.isSwimmer);
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
        // a game of chase, for the lively ones
        if (r < T.squabble + T.social * 0.35 && !this.isFlyer && !near.isFlyer && T.speed >= 1 && near.creature.personality !== 'lazy') {
          this.state = 'chase';
          this.partner = near;
          this.timer = 4 + Math.random() * 3;
          this.socialCooldown = 30 + Math.random() * 20;
          near.state = 'flee';
          near.partner = this;
          near.timer = this.timer;
          near.socialCooldown = this.socialCooldown;
          near.runAround(2.2);
          this.emote('😆', 1.4);
          near.emote('❗', 1.2);
          this.note(`Chasing ${displayName(near.creature)}! 😆`);
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
    if (this.playSomething(ctx, T)) return;
    if (Math.random() < T.idle) {
      this.state = 'idle';
      this.timer = 1.5 + Math.random() * 4;
      if (this.hungry && Math.random() < 0.5) {
        this.emote(Math.random() < 0.5 ? '🍖' : '😠', 1.6);
        this.note('Hungry… feed me! 🍖');
        return;
      }
      if (this.q('curious') && Math.random() < 0.3) this.emote('🔍', 1.5);
      else if (this.q('showoff') && Math.random() < 0.35) {
        this.state = 'celebrate';
        this.timer = 1.6;
        this.emote('😎', 1.6);
      } else if (this.q('musical') && Math.random() < 0.4) {
        // a little song cheers up whoever is nearby
        this.emote('🎵', 2);
        for (const o of ctx.actors) {
          if (o !== this && o.state !== 'sleep' && Math.hypot(o.p.x - this.p.x, o.p.z - this.p.z) < 3) o.emote('💕', 1.6);
        }
      } else if (this.q('lucky') && Math.random() < 0.15) this.emote('🍀', 1.5);
      return;
    }
    // best friends come and hang out wherever you're looking
    if ((this.creature.bond ?? 0) >= 100 && ctx.focus && !this.isSwimmer && Math.random() < 0.55) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 1.4;
      const tx = ctx.focus.x + Math.cos(a) * r;
      const tz = ctx.focus.z + Math.sin(a) * r;
      if (!isBlocked(this.geo, tx, tz) && !inWater(this.geo, tx, tz, 0.3)) {
        this.target.set(tx, 0, tz);
        this.state = 'wander';
        this.timer = 0;
        if (Math.random() < 0.3) this.emote('💕', 1.4);
        return;
      }
    }
    this.pickWander();
  }

  /** Pick a nearby spot to dash to (chase, butterflies, ball). */
  private runAround(reach: number): void {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const tx = this.p.x + Math.cos(a) * reach;
      const tz = this.p.z + Math.sin(a) * reach;
      if (onLand(this.geo, tx, tz, 0.6) && !isBlocked(this.geo, tx, tz) && (this.isFlyer || this.amphibious || !inWater(this.geo, tx, tz, 0.3))) {
        this.target.set(tx, 0, tz);
        return;
      }
    }
    this.target.set(this.p.x, 0, this.p.z);
  }

  /** The sky sets the mood: sunbathing in a heatwave, dancing in a rainbow, chasing fireflies... */
  private weatherFun(ctx: ActorContext): boolean {
    const sky = ctx.sky;
    if (!sky || this.isSwimmer) return false;
    if (sky === 'heatwave' && Math.random() < (this.traits.includes('Reptile') || this.traits.includes('Sand') ? 0.6 : 0.3)) {
      this.state = 'sunbathe';
      this.timer = 5 + Math.random() * 5;
      this.emote('😎', 1.8);
      return true;
    }
    if ((sky === 'rainbow' || sky === 'blossom') && Math.random() < 0.3) {
      this.state = 'dance';
      this.timer = 3 + Math.random() * 2;
      this.emote('🎵', 1.6);
      return true;
    }
    if ((sky === 'firefly' || sky === 'bubbles' || sky === 'blossom') && Math.random() < 0.3) {
      this.startToy(sky === 'firefly' ? 'firefly' : sky === 'bubbles' ? 'bubble' : 'butterfly');
      return true;
    }
    return false;
  }

  /** Every so often, pets amuse themselves. */
  private playSomething(ctx: ActorContext, T: Temper): boolean {
    if (this.isSwimmer || this.hungry) return false;
    const lively = T.speed >= 1;
    const r = Math.random();
    if (r < (lively ? 0.07 : 0.03) && ctx.darkness < 0.5) {
      this.startToy('butterfly');
      return true;
    }
    if (r < (lively ? 0.12 : 0.05) && !this.isFlyer) {
      this.startToy('ball');
      return true;
    }
    // stargazing on a clear night
    if (r < 0.16 && ctx.darkness > 0.6 && !ctx.sky) {
      this.state = 'lookup';
      this.timer = 2.5 + Math.random() * 2;
      this.emote(Math.random() < 0.5 ? '🌙' : '✨', 2);
      this.note('Stargazing ✨');
      return true;
    }
    // a splash at the water's edge
    const w = this.geo.water.find((c) => Math.hypot(c.x - this.p.x, c.z - this.p.z) < c.r + 4);
    if (w && r < 0.22 && !this.isFlyer) {
      const a = Math.atan2(this.p.z - w.z, this.p.x - w.x);
      const edge = w.r + (this.amphibious ? -0.3 : 0.35);
      const tx = w.x + Math.cos(a) * edge;
      const tz = w.z + Math.sin(a) * edge;
      if (isBlocked(this.geo, tx, tz, 0.6)) return false;
      this.target.set(tx, 0, tz);
      this.state = 'splash';
      this.splashing = false;
      this.timer = 0;
      this.fxTimer = 0;
      return true;
    }
    // musical pets and cold-blooded sun-lovers
    if (r < 0.26 && this.q('musical')) {
      this.state = 'dance';
      this.timer = 3 + Math.random() * 2;
      return true;
    }
    if (r < 0.3 && ctx.darkness < 0.15 && (this.traits.includes('Reptile') || this.traits.includes('Sand'))) {
      this.state = 'sunbathe';
      this.timer = 4 + Math.random() * 4;
      return true;
    }
    return false;
  }

  private startToy(kind: 'butterfly' | 'firefly' | 'bubble' | 'ball'): void {
    this.dropProp();
    const g = new THREE.Group();
    if (kind === 'ball') {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshToonMaterial({ color: ['#ff5a5a', '#3aa8ff', '#ffd23d', '#5ad64a'][Math.floor(Math.random() * 4)] }));
      ball.add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 4, 16), new THREE.MeshToonMaterial({ color: '#ffffff' })));
      ball.position.y = 0.13;
      g.add(ball);
      g.position.set(0, 0, 0.55);
    } else if (kind === 'butterfly') {
      const col = ['#ff9ec4', '#ffd23d', '#8ad8ff', '#b88aff'][Math.floor(Math.random() * 4)];
      for (const s of [1, -1]) {
        const wing = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
        wing.position.x = s * 0.07;
        wing.userData.side = s;
        g.add(wing);
      }
      g.position.set(0, 0.7, 0.7);
    } else {
      const mat = kind === 'firefly'
        ? new THREE.SpriteMaterial({ color: '#e8ff6a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
        : new THREE.SpriteMaterial({ color: '#c8f2ff', transparent: true, opacity: 0.6, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(kind === 'firefly' ? 0.25 : 0.4);
      g.add(s);
      g.position.set(0, 0.8, 0.7);
    }
    this.root.add(g);
    this.prop = g;
    this.propKind = kind;
    this.state = kind === 'ball' ? 'ball' : 'flutter';
    this.timer = 4 + Math.random() * 3;
    this.runAround(1.4);
    this.emote(kind === 'ball' ? '⚽' : kind === 'firefly' ? '✨' : kind === 'bubble' ? '🫧' : '🦋', 1.6);
  }

  private dropProp(): void {
    if (!this.prop) return;
    this.root.remove(this.prop);
    this.prop.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.prop = null;
    this.propKind = null;
  }

  private animateProp(dt: number, moving: boolean): void {
    const g = this.prop;
    if (!g) return;
    if (this.state !== 'flutter' && this.state !== 'ball') {
      this.dropProp();
      return;
    }
    if (this.propKind === 'ball') {
      g.children[0].rotation.x += dt * (moving ? 9 : 0);
      g.position.y = Math.abs(Math.sin(this.phase * 6)) * (moving ? 0.08 : 0);
    } else {
      // the toy flits just ahead of the pet
      g.position.y = 0.7 + Math.sin(this.phase * 3.1) * 0.15;
      g.position.x = Math.sin(this.phase * 2.3) * 0.25;
      for (const w of g.children) if (w.userData.side) w.rotation.y = Math.sin(this.phase * 22) * 1.1 * w.userData.side;
      if (this.propKind === 'bubble' && Math.random() < dt * 0.15) {
        // pop! and another one floats along
        this.emote('🫧', 0.8);
      }
    }
  }

  /** You petted or played with it: a happy hop and hearts. */
  cheer(big = false): void {
    this.state = 'celebrate';
    this.timer = big ? 2.2 : 1.2;
    this.emote(big ? '💞' : '💕', big ? 2.5 : 1.6);
  }

  private pickWander(): void {
    const g = this.geo;
    let p = this.isSwimmer ? randomWater(g, Math.random) : randomLand(g, Math.random);
    // shy creatures keep to the edges
    if (this.q('shy') && !this.isSwimmer && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      const edge = { x: g.ox + Math.cos(a) * (g.r - 1.6), z: g.oz + Math.sin(a) * (g.r - 1.6) };
      if (!isBlocked(g, edge.x, edge.z) && !inWater(g, edge.x, edge.z, 0.4)) p = edge;
    }
    const cur = this.p;
    const d = Math.hypot(p.x - cur.x, p.z - cur.z);
    // Explorers go all the way round the globe
    const reach = this.q('explorer') ? 30 : this.q('energetic') ? 6 : 4;
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
    return (p.x - this.p.x) ** 2 + (p.z - this.p.z) ** 2;
  }

  private face(p: THREE.Vector3, dt: number): void {
    const want = Math.atan2(p.x - this.p.x, p.z - this.p.z);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, dt * 6);
  }

  /** Steer toward target; returns true when arrived. */
  private moveToward(dt: number, speedMul: number): boolean {
    const pos = this.p;
    const to = new THREE.Vector3(this.target.x - pos.x, 0, this.target.z - pos.z);
    const d = to.length();
    if (d < 0.12) return true;
    if (this.tripT > 0) return false;
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
    // keep real walking speed even where the globe wrap stretches the map
    const step = Math.min(d, speed * dt * globeStep(this.geo, pos.x, pos.z, to.x, to.z));
    const nx = pos.x + to.x * step;
    const nz = pos.z + to.z * step;
    const g = this.geo;
    if (this.isSwimmer || onLand(g, nx, nz, 0.4) || this.state === 'arrive') pos.set(nx, pos.y, nz);
    else this.target.set(g.ox + (pos.x - g.ox) * 0.8, 0, g.oz + (pos.z - g.oz) * 0.8);
    this.face(new THREE.Vector3(pos.x + to.x, 0, pos.z + to.z), dt);
    return false;
  }

  dispose(scene: THREE.Object3D): void {
    this.dropProp();
    scene.remove(this.root);
    disposeCreature(this.model);
    this.hit.geometry.dispose();
    this.ring.geometry.dispose();
  }
}
