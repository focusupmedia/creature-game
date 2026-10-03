import * as THREE from 'three';
import { BASKET, NESTS } from '../content/layout';
import { ISLAND_ORDER, inWater, isBlocked, islandAt, islandGeo, onLand, type Geo } from '../content/islands';
import { DECOR, EVENTS, LURES, SPOTS } from '../content/world';
import type { Creature, Egg, EventKind, GameEvent, GameState, IslandId, LegendaryKind } from '../core/types';
import { globeCenter, globeNormal, globePoint, globeRadius, globeToMap } from '../content/globe';
import { CameraRig } from './CameraRig';
import { CreatureActor, type ActorContext, type FxKind } from './CreatureActor';
import { animateDigSpot, buildDigSpot, disposeDigSpot, type DigSpotView } from './digSpots';
import { LegendaryFx } from './legendaryFx';
import { ripeFruit } from '../core/care';
import { buildDecor } from './decor';
import { animateShopkeeper, animateWanderer, buildWanderer } from './creatureModels';
import { buildEgg, disposeEgg, type EggModel } from './eggModel';
import { disposeTree, emoteTexture, glowSprite, toon } from './materials';
import { Portraits } from './portraits';
import { Reveal, type RevealPhase } from './Reveal';
import { buildIsland, type IslandView } from './sanctuary';
import { Sky } from './sky';

const Y_UP = new THREE.Vector3(0, 1, 0);
const TMP_N = new THREE.Vector3();
const TMP_Q = new THREE.Quaternion();
const SHAKE = new THREE.Quaternion();
const TMP_V2 = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

export type Pick =
  | { kind: 'creature'; id: string }
  | { kind: 'spot'; id: string }
  | { kind: 'nest'; index: number }
  | { kind: 'font' }
  | { kind: 'shop' }
  | { kind: 'basket' }
  | { kind: 'gift'; id: string }
  | { kind: 'decor'; id: string }
  | { kind: 'island'; id: IslandId }
  | { kind: 'ground'; x: number; z: number }
  | { kind: 'dig'; id: string }
  | { kind: 'wanderer' }
  | { kind: 'tree'; island: IslandId; index: number };

/** What a carried creature is hovering over when you let go. */
export type CarryTarget = { kind: 'creature'; id: string } | { kind: 'dig'; id: string };

interface Burst { sprite: THREE.Sprite; vel: THREE.Vector3; life: number; max: number; drag: number }

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  readonly sky: Sky;
  readonly portraits: Portraits;
  /** The island the camera is on. Only its creatures are simulated visually ("loaded"). */
  current: IslandId = 'home';
  private islands = new Map<IslandId, IslandView>();
  private sizes: Partial<Record<IslandId, number>> = {};
  private owned: Partial<Record<IslandId, boolean>> = { home: true };
  private clouds = new THREE.Group();
  private actors = new Map<string, CreatureActor>();
  private actorKeys = new Map<string, string>();
  private eggs = new Map<string, { model: EggModel; key: string }>();
  private gifts = new Map<string, THREE.Group>();
  private hiddenGifts = new Set<string>();
  private decor = new Map<string, THREE.Group>();
  private bursts: Burst[] = [];
  private raycaster = new THREE.Raycaster();
  private tmpV = new THREE.Vector3();
  private tmpH = new THREE.Vector3();
  private timer = new THREE.Timer();
  private time = 0;
  private selected: string | null = null;
  private reveal: Reveal | null = null;
  private ghost: THREE.Group | null = null;
  private lureCtx: ActorContext['lures'] = [];
  private skyKind: EventKind | null = null;
  /** Where on the current globe the camera is looking (refreshed a few times a second). */
  private focusPoint: { x: number; z: number } | null = null;
  private focusTimer = 0;
  private state: GameState | null = null;
  /** Decoration being placed: where, which way it faces, and how much room it needs. */
  private placing: { decorId: string; x: number; z: number; rot: number; footprint: number } | null = null;
  /** Called while placing whenever the ghost moves: is this a good spot? */
  onPlacementMove: (valid: boolean) => void = () => {};
  /** The visiting wanderer, strolling about near where it arrived. */
  private wanderer: { key: string; group: THREE.Group; island: IslandId; home: { x: number; z: number }; x: number; z: number; tx: number; tz: number; sneaky: boolean; wait: number } | null = null;
  private quality = 1;
  private frameTimes: number[] = [];
  private nowMs = Date.now();
  onFrame: (dt: number) => void = () => {};
  onTap: (p: Pick | null) => void = () => {};
  onRevealTap: () => void = () => {};
  /** The player pushed past the island edge toward another island. */
  onEdgePush: (toward: IslandId) => void = () => {};
  onCarryStart: (creatureId: string) => void = () => {};
  /** A creature on screen makes a little sound. */
  onVoice: (c: Creature) => void = () => {};
  private voiceTimer = 3;
  /** A Greedy creature picked up a gift for the player. */
  onCreatureCollect: (giftId: string, creatureId: string) => void = () => {};
  /** A creature you dropped on a dig spot found something (auto-collected). */
  onDigFound: (giftId: string, creatureId: string) => void = () => {};
  onCarryDrop: (creatureId: string, target: CarryTarget | null) => void = () => {};
  private carry: { actor: CreatureActor; hover: CarryTarget | null } | null = null;
  private hoverRing: THREE.Mesh;
  private dropShadow: THREE.Mesh;
  private digViews = new Map<string, DigSpotView & { island: IslandId; x: number; z: number }>();
  private legendaryFx: LegendaryFx;
  private legendaryIsland: IslandId = 'home';

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // No cast shadows: on little globes they stretch into streaks. Creatures carry blob shadows.
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.scene.fog = new THREE.Fog('#bfe6ff', 45, 110);
    this.rig = new CameraRig(this.renderer.domElement);
    this.rig.onTap = (x, y) => this.handleTap(x, y);
    this.rig.onHold = (x, y) => this.holdAt(x, y);
    this.rig.onCarry = (x, y) => this.carryMove(x, y);
    this.rig.onCarryEnd = () => this.carryEnd();
    this.rig.onDragStart = (x, y) => this.placementGrab(x, y);
    this.rig.onDrag = (x, y) => {
      const p = this.pointerGround(x, y);
      if (p) this.moveGhost(p.x, p.z);
    };
    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.92, 32), new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.9, depthWrite: false }));
    this.hoverRing.geometry.rotateX(-Math.PI / 2);
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);
    this.dropShadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: '#1b2a4a', transparent: true, opacity: 0.25, depthWrite: false }));
    this.dropShadow.geometry.rotateX(-Math.PI / 2);
    this.dropShadow.visible = false;
    this.scene.add(this.dropShadow);
    this.legendaryFx = new LegendaryFx(this.scene);
    this.sky = new Sky(this.scene);
    this.buildClouds();
    this.portraits = new Portraits(this.renderer);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w, h);
    this.reveal?.resize(w, h);
  }

  start(): void {
    const loop = (ts: number) => {
      this.timer.update(ts);
      const dt = Math.min(0.1, this.timer.getDelta());
      this.time += dt;
      this.onFrame(dt);
      this.frame(dt);
      this.adaptQuality(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Drop resolution on struggling devices instead of dropping frames. */
  private adaptQuality(dt: number): void {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    const base = Math.min(window.devicePixelRatio, 2);
    if (avg > 1 / 40 && this.quality > 0.55) this.quality -= 0.15;
    else if (avg < 1 / 57 && this.quality < 1) this.quality = Math.min(1, this.quality + 0.05);
    this.renderer.setPixelRatio(base * this.quality);
  }

  private buildClouds(): void {
    const cloudMat = toon('#ffffff', '#dfefff', 0.3);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rand() * 0.8, 1), cloudMat);
        p.position.set(j * 1.2 - 1.8, rand() * 0.5, rand() * 0.8);
        c.add(p);
      }
      const a = (i / 16) * Math.PI * 2;
      const r = 16 + rand() * 34;
      c.position.set(Math.cos(a) * r, -5 - rand() * 6, Math.sin(a) * r - 6);
      c.userData = { speed: 0.01 + rand() * 0.02, angle: a, radius: Math.hypot(c.position.x, c.position.z + 6) };
      this.clouds.add(c);
    }
    this.scene.add(this.clouds);
  }

  // ------------------------------------------------------------------ islands

  /** Move the camera to another island. Its creatures load in; the old island's unload. */
  travelTo(id: IslandId, instant = false): void {
    this.current = id;
    const g = this.geoOf(id);
    this.rig.setGlobe(globeCenter(g), globeRadius(g), instant);
    if (this.selected && this.actors.get(this.selected)?.geo.id !== id) this.select(null);
  }


  islandCenter(id: IslandId): { x: number; z: number } {
    const g = islandGeo(id, this.sizes[id] ?? 0);
    return { x: g.ox, z: g.oz };
  }

  creatureIsland(id: string): IslandId | null {
    return this.actors.get(id)?.geo.id ?? null;
  }

  // ------------------------------------------------------------------ state sync

  /** Reconcile visuals with the game state. Cheap enough to call every frame. */
  sync(state: GameState, now: number, sky: EventKind | null): void {
    this.state = state;
    this.skyKind = sky;
    this.nowMs = now;

    // islands: (re)build when ownership or size changes
    for (const id of ISLAND_ORDER) {
      const isl = state.islands[id] ?? { owned: false, size: 0 };
      this.sizes[id] = isl.size;
      this.owned[id] = isl.owned;
      const chopped = state.chopped?.[id] ?? [];
      const key = `${isl.owned}:${isl.size}:${chopped.join(',')}`;
      const view = this.islands.get(id);
      if (view && view.key === key) continue;
      if (view) {
        this.scene.remove(view.group);
        disposeTree(view.group);
      }
      // only a tree came down: keep the camera where it is
      const choppedOnly = !!view && view.key.split(':').slice(0, 2).join(':') === `${isl.owned}:${isl.size}`;
      const fresh = buildIsland(id, isl.size, isl.owned, chopped);
      // chopped trees no longer block the way or shelter anyone from the rain
      const geo = islandGeo(id, isl.size) as ReturnType<typeof islandGeo> & { base?: { shelters: Geo['shelters']; obstacles: Geo['obstacles'] } };
      geo.base ??= { shelters: geo.shelters, obstacles: geo.obstacles };
      const gone = fresh.trees.filter((t) => t.chopped);
      const stump = (p: { x: number; z: number }) => gone.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 0.3);
      geo.shelters = geo.base.shelters.filter((sh) => !stump(sh));
      geo.obstacles = geo.base.obstacles.filter((o) => !stump(o));
      // a tree just came down: a puff of leaves where it stood
      if (choppedOnly) {
        for (const i of chopped) {
          const t = fresh.trees[i];
          if (t && !view.chopped.has(i)) this.burst(this.at(t.x, t.z, 1.6 * t.s, id), '#7fd94f', 30, 2.2, 0.45);
        }
      }
      this.islands.set(id, fresh);
      this.scene.add(fresh.group);
      if (view && isl.owned && !choppedOnly) {
        const g = islandGeo(id, isl.size);
        this.burst(this.at(g.ox, g.oz, 1, id), '#fff6c8', 40, 3);
      }
      if (id === this.current && !choppedOnly) this.travelTo(id, true);
    }

    // creatures (rebuild when mutations, island or island size change)
    const alive = new Set<string>();
    for (const c of state.creatures) {
      if (c.stored || c.trip) continue;
      alive.add(c.id);
      const key = `${c.mutations.join(',')}|${c.island}|${this.sizes[c.island] ?? 0}`;
      const actor = this.actors.get(c.id);
      if (!actor) {
        this.addActor(c);
      } else if (this.actorKeys.get(c.id) !== key && !actor.carried) {
        // (a creature you're holding is rebuilt after you put it down)
        const sameIsland = actor.geo.id === c.island;
        const pos = actor.position.clone();
        const mutated = this.actorKeys.get(c.id)?.split('|')[0] !== c.mutations.join(',');
        actor.flushPending();
        actor.dispose(this.scene);
        const fresh = this.addActor(c);
        if (sameIsland) {
          fresh.position.copy(pos);
          fresh.place();
        }
        if (mutated) {
          fresh.celebrate();
          fresh.note('Just changed! ✨');
          this.burst(this.above(pos, 0.6, c.island), '#fff4b0', 26);
        }
      } else {
        actor.creature = c;
      }
    }
    // lure visitors wait by their lure with a ! until you meet them
    const waiting = new Set<string>();
    for (const v of state.visitors) {
      if (!this.owned[v.island]) continue;
      alive.add(v.creature.id);
      waiting.add(v.creature.id);
      let a = this.actors.get(v.creature.id);
      if (!a) {
        a = this.addActor({ ...v.creature, island: v.island });
        a.standNear(SPOTS[v.spot]);
      }
      a.waitAt = SPOTS[v.spot];
    }
    for (const [id, a] of this.actors) if (a.waitAt && !waiting.has(id)) a.waitAt = null;
    for (const [id, a] of this.actors) {
      if (!alive.has(id)) {
        if (a.root.visible) this.burst(this.above(a.position, 0.5, a.geo.id), '#ffffff', 14);
        a.flushPending();
        a.dispose(this.scene);
        this.actors.delete(id);
      }
    }
    for (const a of this.actors.values()) a.root.visible = a.geo.id === this.current;

    this.syncWanderer(state);
    this.syncEggs(state);

    // lures (only the current island's matter to its creatures)
    this.lureCtx = [];
    for (const spot of Object.values(SPOTS)) {
      const view = this.islands.get(spot.island);
      const dish = view?.spotDishes[spot.id];
      if (!dish) continue;
      const active = state.spots[spot.id];
      const gm = dish.glow.material as THREE.SpriteMaterial;
      const mm = dish.marker.material as THREE.MeshBasicMaterial;
      if (active) {
        const lure = LURES[active.lure];
        dish.bait.visible = true;
        dish.bait.material = toon(lure.color, lure.color, 0.35);
        gm.color.set(lure.color);
        gm.opacity = 0.35 + Math.sin(this.time * 3) * 0.12;
        mm.color.set(lure.color);
        mm.opacity = 0.55;
        dish.marker.scale.setScalar(1);
        if (spot.island === this.current) {
          this.lureCtx.push({ id: spot.id, x: spot.x, z: spot.z, attracts: lure.attracts });
          if (Math.random() < 0.08) this.burst(this.at(spot.x, spot.z, 0.4), lure.color, 1, 0.6);
        }
      } else {
        dish.bait.visible = false;
        gm.opacity = 0;
        mm.color.set('#ffe27a');
        mm.opacity = 0.55 + Math.sin(this.time * 3) * 0.25;
        dish.marker.scale.setScalar(1 + Math.sin(this.time * 3) * 0.05);
      }
    }

    // dig spots: drop a creature on one to dig, fish or forage
    const digAlive = new Set(state.digSpots.map((d) => d.id));
    for (const d of state.digSpots) {
      if (this.digViews.has(d.id)) continue;
      const v = { ...buildDigSpot(d.kind, d.id, this.time), island: d.island, x: d.x, z: d.z };
      this.place(v.root, d.x, d.z, 0, 0, d.island);
      this.scene.add(v.root);
      this.digViews.set(d.id, v);
    }
    for (const [id, v] of this.digViews) {
      if (!digAlive.has(id)) {
        if (v.island === this.current) this.burst(this.at(v.x, v.z, 0.3, v.island), '#fff3b0', 8);
        this.scene.remove(v.root);
        disposeDigSpot(v);
        this.digViews.delete(id);
      } else v.root.visible = v.island === this.current;
    }

    // gifts: things creatures dug up
    const giftAlive = new Set(state.gifts.map((g) => g.id));
    for (const g of state.gifts) {
      if (this.gifts.has(g.id)) continue;
      const group = new THREE.Group();
      const rare = g.shards > 0 || !!g.item;
      const gem = g.meteor ? meteorRock() : g.item === 'egg'
        ? (() => { const e = buildEgg('mossfrog', [], 3, 0.22); return e.root; })()
        : new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), toon(rare ? '#c9b6ff' : '#ffe58a', rare ? '#9f7fff' : '#ffc94a', 0.6));
      gem.position.y = 0.3;
      const sparkle = glowSprite(rare ? '#c9b6ff' : '#fff0a0', rare ? 1.3 : 0.9, 0.7);
      sparkle.position.y = 0.3;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.3;
      hit.userData.pick = { kind: 'gift', id: g.id };
      group.add(gem, sparkle, hit);
      group.userData.island = g.island ?? 'home';
      group.userData.x = g.x;
      group.userData.z = g.z;
      this.place(group, g.x, g.z, 0, 0, group.userData.island);
      this.scene.add(group);
      this.gifts.set(g.id, group);
    }
    for (const [id, group] of this.gifts) {
      if (!giftAlive.has(id)) {
        if (group.visible) this.burst(this.at(group.userData.x, group.userData.z, 0.4, group.userData.island), '#ffe58a', 10);
        this.scene.remove(group);
        disposeTree(group);
        this.gifts.delete(id);
        this.hiddenGifts.delete(id);
      } else {
        group.visible = group.userData.island === this.current && !this.hiddenGifts.has(id);
        group.children[0].rotation.y += 0.03;
        group.children[0].position.y = 0.3 + Math.sin(this.time * 3 + group.position.x) * 0.06;
      }
    }

    // decor (Berry Trees show their ripe berries)
    for (const d of state.placedDecor) {
      if (d.decor !== 'fruittree') continue;
      const g = this.decor.get(d.id);
      if (!g) continue;
      const ripe = ripeFruit(d.harvestedAt, now);
      g.traverse((o) => {
        if (o.userData.berry !== undefined) o.visible = o.userData.berry < ripe;
      });
    }
    const decorAlive = new Set(state.placedDecor.map((d) => d.id));
    for (const d of state.placedDecor) {
      if (this.decor.has(d.id)) continue;
      const g = buildDecor(d.decor);
      g.userData.x = d.x;
      g.userData.z = d.z;
      g.userData.island = d.island ?? 'home';
      this.place(g, d.x, d.z, 0, d.rot, g.userData.island);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.75;
      hit.userData.pick = { kind: 'decor', id: d.id };
      g.add(hit);
      this.scene.add(g);
      this.decor.set(d.id, g);
      this.burst(this.at(g.userData.x, g.userData.z, 0.5, g.userData.island), '#ffffff', 16);
    }
    for (const [id, g] of this.decor) {
      if (!decorAlive.has(id)) {
        this.scene.remove(g);
        disposeTree(g);
        this.decor.delete(id);
      }
    }
  }

  private syncEggs(state: GameState): void {
    const eggAlive = new Set<string>();
    let basketIdx = 0;
    for (const e of state.eggs) {
      eggAlive.add(e.id);
      const key = `${e.mutations.join(',')}`;
      let entry = this.eggs.get(e.id);
      if (!entry || entry.key !== key) {
        if (entry) {
          this.scene.remove(entry.model.root);
          disposeEgg(entry.model);
        }
        const model = buildEgg(e.species, e.mutations, e.seed, 0.42);
        this.scene.add(model.root);
        entry = { model, key };
        this.eggs.set(e.id, entry);
      }
      const root = entry.model.root;
      if (e.nest !== null) {
        const n = NESTS[e.nest];
        this.place(root, n.x, n.z, 0.42, 0, 'home', SHAKE.set(0, 0, 0, 1));
        root.userData.x = n.x;
        root.userData.z = n.z;
        entry.model.shell.userData.pick = { kind: 'nest', index: e.nest };
      } else {
        this.place(root, BASKET.x + (basketIdx - 1) * 0.28, BASKET.z, 0.12, 0, 'home');
        root.userData.x = BASKET.x + (basketIdx - 1) * 0.28;
        root.userData.z = BASKET.z;
        entry.model.shell.userData.pick = { kind: 'basket' };
        basketIdx++;
      }
      const ready = e.progressMs >= e.incubationMs;
      const prog = e.progressMs / e.incubationMs;
      const shake = ready ? 0.12 : prog > 0.8 ? 0.05 : 0;
      root.quaternion.multiply(SHAKE.setFromAxisAngle(Z_AXIS, Math.sin(this.time * (ready ? 14 : 9) + e.seed) * shake * (Math.sin(this.time * 1.3 + e.seed) > 0.3 ? 1 : 0.15)));
      const gm = entry.model.glow.material as THREE.SpriteMaterial;
      gm.opacity = ready ? 0.6 + Math.sin(this.time * 4) * 0.25 : 0.1 * prog;
      if (entry.model.prismatic) entry.model.mat.color.setHSL((this.time * 0.2) % 1, 0.5, 0.75);
    }
    for (const [id, entry] of this.eggs) {
      if (!eggAlive.has(id)) {
        this.scene.remove(entry.model.root);
        disposeEgg(entry.model);
        this.eggs.delete(id);
      }
    }
    // nests not yet built are hidden
    this.islands.get('home')?.home?.nests.forEach((g, i) => {
      const owned = i < state.nests;
      g.children.forEach((ch) => {
        if (ch instanceof THREE.Mesh && ch.material instanceof THREE.MeshToonMaterial) ch.visible = owned;
      });
    });
  }

  private syncWanderer(state: GameState): void {
    const w = state.wanderer;
    const key = w ? `${w.kind}:${w.arrivedAt}` : '';
    if (this.wanderer && this.wanderer.key !== key) {
      this.burst(this.at(this.wanderer.x, this.wanderer.z, 0.6, this.wanderer.island), '#ffffff', 16);
      this.scene.remove(this.wanderer.group);
      disposeTree(this.wanderer.group);
      this.wanderer = null;
    }
    if (w && !this.wanderer) {
      const group = buildWanderer(w.kind);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.6;
      hit.userData.pick = { kind: 'wanderer' };
      group.add(hit);
      // a friendly "!" over the helpers; the Goblin doesn't announce himself
      if (w.kind !== 'goblin') {
        const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTexture('❗'), transparent: true, depthWrite: false }));
        mark.scale.setScalar(0.5);
        mark.position.y = 1.45;
        group.add(mark);
        group.userData.mark = mark;
      }
      this.scene.add(group);
      this.wanderer = { key, group, island: w.island, home: { x: w.x, z: w.z }, x: w.x, z: w.z, tx: w.x, tz: w.z, sneaky: w.kind === 'goblin', wait: 0 };
      this.place(group, w.x, w.z, 0, 0, w.island);
      if (w.island === this.current) this.burst(this.at(w.x, w.z, 0.5, w.island), w.kind === 'goblin' ? '#8fd06a' : '#fff3b0', 18);
    }
  }

  /** A wanderer you tapped heads off: a poof (and, for the Goblin, a scatter of leaves). */
  wandererLeaves(w: { x: number; z: number; island: IslandId }, scared: boolean): void {
    const v = this.wanderer;
    const at = v ? this.at(v.x, v.z, 0.6, v.island) : this.at(w.x, w.z, 0.6, w.island);
    this.burst(at, scared ? '#8fd06a' : '#fff3b0', scared ? 30 : 22, scared ? 2.4 : 1.4);
  }

  private updateWanderer(dt: number): void {
    const v = this.wanderer;
    if (!v) return;
    v.group.visible = v.island === this.current;
    if (!v.group.visible) return;
    v.wait -= dt;
    const dx = v.tx - v.x;
    const dz = v.tz - v.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      if (v.wait <= 0) {
        // pick somewhere nearby to amble (or scurry) to
        const a = Math.random() * Math.PI * 2;
        const r = (v.sneaky ? 2.6 : 1.4) * Math.random();
        const g = this.geoOf(v.island);
        const nx = v.home.x + Math.cos(a) * r;
        const nz = v.home.z + Math.sin(a) * r;
        if (onLand(g, nx, nz) && !isBlocked(g, nx, nz) && !inWater(g, nx, nz, 0.3)) { v.tx = nx; v.tz = nz; }
        v.wait = v.sneaky ? 0.6 + Math.random() : 2 + Math.random() * 3;
      }
    } else {
      const step = Math.min(d, dt * (v.sneaky ? 1.6 : 0.6));
      v.x += (dx / d) * step;
      v.z += (dz / d) * step;
    }
    this.place(v.group, v.x, v.z, 0, Math.atan2(dx, dz), v.island);
    animateWanderer(v.group, this.time, v.sneaky);
    const mark = v.group.userData.mark as THREE.Sprite | undefined;
    if (mark) mark.position.y = 1.45 + Math.sin(this.time * 3) * 0.08;
  }

  private addActor(c: Creature): CreatureActor {
    const a = new CreatureActor(c, this.scene, islandGeo(c.island, this.sizes[c.island] ?? 0));
    this.actors.set(c.id, a);
    this.actorKeys.set(c.id, `${c.mutations.join(',')}|${c.island}|${this.sizes[c.island] ?? 0}`);
    if (this.selected === c.id) a.setSelected(true);
    return a;
  }

  // ------------------------------------------------------------------ events

  handle(ev: GameEvent, live: boolean): void {
    if (!live) return;
    switch (ev.type) {
      case 'arrival': {
        const spot = SPOTS[ev.spot];
        const a = this.actors.get(ev.creature.id) ?? this.addActor(ev.creature);
        a.note(`Just arrived at the ${spot.name}`);
        a.arrive(spot, () => this.burst(this.above(a.position, 0.6, a.geo.id), '#ffffff', 12));
        break;
      }
      case 'gift': {
        // a Starshard rock falls from the meteor shower
        if (ev.gift.meteor) {
          if (ev.gift.island !== this.current) break;
          const at = this.at(ev.gift.x, ev.gift.z, 0.3, ev.gift.island);
          this.hiddenGifts.add(ev.gift.id);
          this.sky.fallingStar(at, () => {
            this.hiddenGifts.delete(ev.gift.id);
            this.burst(at, '#ff9ad8', 22, 1.8);
          });
          break;
        }
        // Watch it happen: the creature walks over and digs the find up.
        const a = ev.gift.from ? this.actors.get(ev.gift.from) : undefined;
        if (a && a.root.visible && a.state !== 'sleep' && a.state !== 'arrive' && !a.carried) {
          this.hiddenGifts.add(ev.gift.id);
          a.digAt(ev.gift.x, ev.gift.z, () => {
            this.hiddenGifts.delete(ev.gift.id);
            this.burst(this.at(ev.gift.x, ev.gift.z, 0.3, ev.gift.island), ev.gift.shards || ev.gift.item ? '#d9c6ff' : '#ffe58a', 16, 1.4);
            // finds from a dig spot you sent it to go straight into your pocket
            if (ev.gift.via) this.onDigFound(ev.gift.id, a.id);
          }, ev.gift.via === 'puddle' ? 'splash' : ev.gift.via === 'bush' ? 'leaf' : 'dirt');
        }
        break;
      }
      case 'skyTouch': {
        const a = this.actors.get(ev.creature.id);
        if (!a) break;
        a.note(EVENTS[ev.event].touch.bubble);
        if (!a.root.visible) break;
        const at = this.above(a.position, 0.3, a.geo.id);
        if (ev.event === 'storm') {
          this.sky.strike(at);
          this.burst(at, '#fff27a', 22, 2);
        } else if (ev.event === 'eclipse' || ev.event === 'fullmoon') {
          this.sky.moonbeam(a.worldPosition, globeNormal(a.geo, a.position.x, a.position.z));
        } else if (ev.event === 'starry') {
          this.sky.fallingStar(at, () => this.burst(at, '#fff1a8', 26, 1.8));
        } else {
          this.burst(this.above(a.position, 0.6, a.geo.id), '#ffffff', 30, 1.4);
        }
        break;
      }
      case 'eggTouched': {
        const e = this.eggs.get(ev.egg.id);
        const color: Record<string, string> = { storm: '#fff27a', starry: '#fff1a8', blizzard: '#ffffff' };
        if (e) this.burst(e.model.root.position.clone().setY(e.model.root.position.y + 0.7), color[ev.event] ?? '#c9d4ff', 16);
        break;
      }
      case 'eggReady': {
        const e = this.eggs.get(ev.egg.id);
        if (e) this.burst(e.model.root.position.clone().setY(e.model.root.position.y + 0.7), '#ffffff', 14);
        break;
      }
      default:
    }
  }

  /** Project a world point to CSS pixels; `visible` is false when behind the camera. */
  toScreen(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const v = this.tmpV.set(x, y, z).project(this.rig.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
  }

  /** Distance from the camera to the globe's surface. */
  get zoom(): number {
    return this.rig.distance - this.rig.radius;
  }

  creatureHead(id: string): THREE.Vector3 | null {
    const a = this.actors.get(id);
    return a && a.root.visible ? a.headPosition(this.tmpH) : null;
  }

  creatureActivity(id: string): string {
    return this.actors.get(id)?.activity() ?? '';
  }

  noteCreature(id: string, text: string): void {
    this.actors.get(id)?.note(text);
  }

  get selectedId(): string | null {
    return this.selected;
  }

  creaturePosition(id: string): THREE.Vector3 | null {
    return this.actors.get(id)?.position ?? null;
  }

  select(id: string | null): void {
    if (this.selected) this.actors.get(this.selected)?.setSelected(false);
    this.selected = id;
    if (id) this.actors.get(id)?.setSelected(true);
  }

  /** A legendary event begins: angels over this island, or the volcano / deep tide on theirs. */
  legendaryStart(kind: LegendaryKind, island: IslandId | null): void {
    const id = island ?? this.current;
    const g = this.geoOf(id);
    this.legendaryIsland = id;
    const c = globeCenter(g);
    this.legendaryFx.start(kind, new THREE.Vector3(g.ox, 0, g.oz), g.r, new THREE.Vector3(c.x, c.y, c.z));
  }

  legendaryEnd(): void {
    this.legendaryFx.leave();
  }

  private geoOf(id: IslandId = this.current) {
    return islandGeo(id, this.sizes[id] ?? 0);
  }

  /** World position of an island map point, `alt` above the globe's surface. */
  at(x: number, z: number, alt = 0, island: IslandId = this.current): THREE.Vector3 {
    const w = globePoint(this.geoOf(island), x, z, alt);
    return new THREE.Vector3(w.x, w.y, w.z);
  }

  /** Screen position of an island map point; hidden when it is on the far side of its globe. */
  pinScreen(x: number, z: number, alt: number): { x: number; y: number; visible: boolean } {
    const id = islandAt(x, z, this.sizes) ?? this.current;
    const w = this.at(x, z, alt, id);
    const sp = this.toScreen(w.x, w.y, w.z);
    return { ...sp, visible: sp.visible && this.facesCamera(w, id) };
  }

  /** Is a point on a globe's near side (not hidden behind the planet)? */
  facesCamera(w: THREE.Vector3, island: IslandId = this.current): boolean {
    const c = globeCenter(this.geoOf(island));
    TMP_N.set(w.x - c.x, w.y - c.y, w.z - c.z).normalize();
    const cam = this.rig.camera.position;
    return TMP_N.dot(TMP_V2.set(cam.x - w.x, cam.y - w.y, cam.z - w.z).normalize()) > -0.05;
  }

  /** World position just above a map position whose y is its height above ground. */
  above(p: THREE.Vector3, extra = 0, island: IslandId = this.current): THREE.Vector3 {
    return this.at(p.x, p.z, p.y + extra, island);
  }

  /** Stand an object on a globe at a map point: upright to the surface, turned by `yaw`. */
  place(o: THREE.Object3D, x: number, z: number, alt = 0, yaw = 0, island: IslandId = this.current, extra?: THREE.Quaternion): void {
    const g = this.geoOf(island);
    const n = globeNormal(g, x, z);
    o.position.copy(this.at(x, z, alt, island));
    o.quaternion.setFromUnitVectors(Y_UP, TMP_N.set(n.x, n.y, n.z));
    if (yaw) o.quaternion.multiply(TMP_Q.setFromAxisAngle(Y_UP, yaw));
    if (extra) o.quaternion.multiply(extra);
  }

  /** Turn the globe to show a map point (distances are from the surface). */
  /** Turn the globe to look at a point. Points on another world are ignored (they'd aim at this globe's underside). */
  focus(p: { x: number; z: number }, distance?: number, island: IslandId = this.current): void {
    if (island !== this.current) return;
    const n = globeNormal(this.geoOf(), p.x, p.z);
    this.rig.lookAtDir(n, distance === undefined ? this.rig.distance : this.rig.radius + distance * 0.85);
  }

  cheer(id: string, big = false): void {
    this.actors.get(id)?.cheer(big);
  }

  emote(id: string, text: string): void {
    this.actors.get(id)?.emote(text, 2);
  }

  // ------------------------------------------------------------------ effects

  burst(pos: THREE.Vector3, color: string, count: number, speed = 1.2, size = 0.35, drag = 0): void {
    for (let i = 0; i < count; i++) {
      const s = glowSprite(color, size, 0.9);
      s.position.copy(pos);
      this.scene.add(s);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 2).multiplyScalar(speed);
      const life = 0.8 + Math.random() * 0.6;
      this.bursts.push({ sprite: s, vel: v, life, max: life, drag });
    }
  }

  burstAt(x: number, y: number, z: number, color: string, count: number): void {
    this.burst(new THREE.Vector3(x, y, z), color, count);
  }

  private fx = (kind: FxKind, at: THREE.Vector3): void => {
    if (kind === 'dirt') {
      const soil = this.current === 'lagoon' ? '#e8c27a' : this.current === 'volcano' ? '#3a2e2e' : '#8a5a32';
      this.burst(at, soil, 3, 0.9, 0.3, 0);
    } else if (kind === 'splash') {
      this.burst(at, '#bfefff', 4, 1.0, 0.3, 0);
    } else if (kind === 'leaf') {
      this.burst(at, Math.random() < 0.3 ? '#8a6aff' : '#6fcf4a', 3, 0.8, 0.3, 1);
    } else {
      this.burst(at, '#f4f0e8', 4, 0.7, 0.55, 2);
    }
  };

  // ------------------------------------------------------------------ carrying creatures

  /** Where a screen point lands on the current island's ground. */
  private pointerGround(x: number, y: number): THREE.Vector3 | null {
    const view = this.islands.get(this.current);
    if (!view) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);
    const g = this.geoOf();
    const hit = this.raycaster.intersectObject(view.ground, false)[0];
    let dir: THREE.Vector3;
    if (hit) dir = hit.point.clone();
    else {
      // off the globe's edge: use the closest point of the globe's silhouette
      const c = globeCenter(g);
      const ray = this.raycaster.ray;
      dir = ray.closestPointToPoint(new THREE.Vector3(c.x, c.y, c.z), new THREE.Vector3());
    }
    const c = globeCenter(g);
    const m = globeToMap(g, { x: dir.x - c.x, y: dir.y - c.y, z: dir.z - c.z });
    return new THREE.Vector3(m.x, 0, m.z);
  }

  private holdAt(x: number, y: number): boolean {
    if (this.reveal || this.ghost) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);
    const actors = [...this.actors.values()].filter((a) => a.root.visible);
    const hit = this.raycaster.intersectObjects(actors.map((a) => a.hit), false)[0];
    const actor = hit && actors.find((a) => a.hit === hit.object);
    if (!actor) return false;
    // visitors aren't yours yet: holding one says hello instead
    if (actor.waitAt) {
      this.onTap({ kind: 'creature', id: actor.id });
      return false;
    }
    actor.pickUp();
    this.carry = { actor, hover: null };
    this.select(null);
    this.burst(this.above(actor.position, 0.3), '#ffffff', 8, 0.8);
    this.onCarryStart(actor.id);
    return true;
  }

  private carryMove(x: number, y: number): void {
    if (!this.carry) return;
    const p = this.pointerGround(x, y);
    if (!p) return;
    const { actor } = this.carry;
    actor.carryTo(p.x, p.z);
    // what would it land on?
    let hover: CarryTarget | null = null;
    let best = 1.2;
    for (const [id, v] of this.digViews) {
      if (v.island !== this.current) continue;
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d < best) { best = d; hover = { kind: 'dig', id }; }
    }
    if (!hover) {
      best = 1.1;
      for (const a of this.actors.values()) {
        if (a === actor || !a.root.visible || a.waitAt) continue;
        const d = Math.hypot(a.position.x - p.x, a.position.z - p.z);
        if (d < best) { best = d; hover = { kind: 'creature', id: a.id }; }
      }
    }
    if (hover?.kind !== this.carry.hover?.kind || (hover && this.carry.hover && hover.id !== this.carry.hover.id)) {
      if (hover?.kind === 'creature') this.actors.get(hover.id)?.emote('❓', 1);
    }
    this.carry.hover = hover;
  }

  private carryEnd(): void {
    if (!this.carry) return;
    const { actor, hover } = this.carry;
    this.carry = null;
    this.hoverRing.visible = false;
    this.dropShadow.visible = false;
    if (hover?.kind === 'creature') {
      // set it down next to the other one, facing it
      const other = this.actors.get(hover.id);
      if (other) {
        const dx = actor.position.x - other.position.x;
        const dz = actor.position.z - other.position.z;
        const len = Math.hypot(dx, dz) || 1;
        actor.carryTo(other.position.x + (dx / len) * 0.9, other.position.z + (dz / len) * 0.9);
      }
    }
    actor.putDown();
    if (hover?.kind === 'creature') {
      const other = this.actors.get(hover.id);
      if (other) {
        actor.emote('💞', 2);
        other.emote('💞', 2);
      }
    }
    this.onCarryDrop(actor.id, hover);
  }

  /** Hover ring and drop shadow follow the carried creature. */
  private updateCarry(): void {
    if (!this.carry) return;
    const { actor, hover } = this.carry;
    this.dropShadow.visible = true;
    this.place(this.dropShadow, actor.position.x, actor.position.z, 0.05);
    let at: { x: number; z: number } | null = null;
    if (hover?.kind === 'dig') at = this.digViews.get(hover.id) ?? null;
    if (hover?.kind === 'creature') {
      const a = this.actors.get(hover.id);
      at = a ? { x: a.position.x, z: a.position.z } : null;
    }
    this.hoverRing.visible = !!at;
    if (at) {
      this.place(this.hoverRing, at.x, at.z, 0.07);
      this.hoverRing.scale.setScalar(1 + Math.sin(this.time * 8) * 0.08);
      (this.hoverRing.material as THREE.MeshBasicMaterial).color.set(hover?.kind === 'creature' ? '#ff8fc8' : '#ffe27a');
    }
  }

  // ------------------------------------------------------------------ decor placement

  /**
   * Start placing a decoration: a see-through copy sits on the ground with arrows
   * around it. Drag it (or tap the ground) to move it; the ring turns green on
   * open ground and red where it would bump into something.
   */
  startPlacement(decorId: string): void {
    this.cancelPlacement();
    const ghost = buildDecor(decorId);
    ghost.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = (o.material as THREE.Material).clone();
        (o.material as THREE.Material).transparent = true;
        (o.material as THREE.Material).opacity = 0.6;
        o.castShadow = false;
      }
      if (o instanceof THREE.Sprite) o.visible = false;
    });
    const footprint = DECOR[decorId]?.r ?? 0.8;
    // the ring and the four little arrows
    const ring = new THREE.Mesh(new THREE.RingGeometry(footprint + 0.05, footprint + 0.28, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#5fe05a', transparent: true, opacity: 0.9, depthWrite: false }));
    ring.position.y = 0.06;
    ring.name = 'ring';
    ghost.add(ring);
    const tri = new THREE.Shape([new THREE.Vector2(-0.32, 0), new THREE.Vector2(0.32, 0), new THREE.Vector2(0, 0.42)]);
    const arrows = new THREE.Group();
    arrows.name = 'arrows';
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const outline = new THREE.Mesh(new THREE.ShapeGeometry(tri).scale(1.35, 1.35, 1), new THREE.MeshBasicMaterial({ color: '#1b2a4a', depthWrite: false }));
      const arrow = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: '#ffffff', depthWrite: false }));
      arrow.position.set(0, 0.04, 0.0);
      outline.add(arrow);
      outline.rotation.x = -Math.PI / 2;
      const holder = new THREE.Group();
      holder.rotation.y = -a;
      outline.position.set(0, 0.08, -(footprint + 0.6));
      outline.rotation.z = Math.PI;
      holder.add(outline);
      arrows.add(holder);
    }
    ghost.add(arrows);
    this.ghost = ghost;
    this.scene.add(ghost);
    const r = this.renderer.domElement.getBoundingClientRect();
    const mid = this.pointerGround(r.left + r.width / 2, r.top + r.height / 2) ?? new THREE.Vector3(this.geoOf().ox, 0, this.geoOf().oz);
    this.placing = { decorId, x: mid.x, z: mid.z, rot: 0, footprint };
    // start somewhere it fits, as close to the middle of the screen as possible
    const spot = this.nearestFree(mid.x, mid.z, footprint) ?? mid;
    this.moveGhost(spot.x, spot.z);
  }

  /** Did this press land on the decoration being placed? Then it's a drag, not a globe roll. */
  private placementGrab(x: number, y: number): boolean {
    if (!this.placing) return false;
    const p = this.pointerGround(x, y);
    return !!p && Math.hypot(p.x - this.placing.x, p.z - this.placing.z) < this.placing.footprint + 1.2;
  }

  moveGhost(x: number, z: number): boolean {
    if (!this.ghost || !this.placing) return false;
    this.placing.x = x;
    this.placing.z = z;
    this.place(this.ghost, x, z, 0, this.placing.rot, this.current);
    const valid = this.validPlacement(x, z, this.placing.footprint);
    const ring = this.ghost.getObjectByName('ring') as THREE.Mesh | undefined;
    (ring?.material as THREE.MeshBasicMaterial | undefined)?.color.set(valid ? '#5fe05a' : '#ff5a5a');
    this.onPlacementMove(valid);
    return valid;
  }

  rotateGhost(): void {
    if (!this.placing) return;
    this.placing.rot += Math.PI / 4;
    this.moveGhost(this.placing.x, this.placing.z);
  }

  /** Things a decoration may not overlap on a world: buildings, standing trees, rocks, lure and dig spots, other decorations. */
  private blockers(island: IslandId): { x: number; z: number; r: number }[] {
    const g = this.geoOf(island);
    const view = this.islands.get(island);
    const trees = view?.trees ?? [];
    const out: { x: number; z: number; r: number }[] = [];
    // fixed obstacles, minus any chopped trees
    for (const o of g.obstacles) if (!trees.some((t) => t.chopped && Math.hypot(t.x - o.x, t.z - o.z) < 0.3)) out.push(o);
    for (const t of trees) if (!t.chopped) out.push({ x: t.x, z: t.z, r: 0.85 * t.s });
    for (const sh of g.shelters) if (!trees.some((t) => Math.hypot(t.x - sh.x, t.z - sh.z) < 0.3)) out.push({ x: sh.x, z: sh.z, r: 1.1 });
    for (const l of g.lava) out.push(l);
    for (const sp of Object.values(SPOTS)) if (sp.island === island) out.push({ x: sp.x, z: sp.z, r: 1.5 });
    for (const v of this.digViews.values()) if (v.island === island) out.push({ x: v.x, z: v.z, r: 0.9 });
    for (const d of this.state?.placedDecor ?? []) {
      if ((d.island ?? 'home') === island) out.push({ x: d.x, z: d.z, r: DECOR[d.decor]?.r ?? 0.8 });
    }
    return out;
  }

  /** Open, dry, empty ground with room for the decoration. */
  validPlacement(x: number, z: number, footprint = this.placing?.footprint ?? 0.8): boolean {
    const g = this.geoOf(this.current);
    if (!onLand(g, x, z, 0.9) || inWater(g, x, z, footprint * 0.7)) return false;
    return this.blockers(this.current).every((b) => Math.hypot(x - b.x, z - b.z) >= b.r + footprint * 0.85);
  }

  /** The closest spot (searching outward) where a decoration of this size fits. */
  private nearestFree(x: number, z: number, footprint: number): { x: number; z: number } | null {
    for (let r = 0; r < 12; r += 0.6) {
      const steps = Math.max(1, Math.round(r * 5));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (this.validPlacement(px, pz, footprint)) return { x: px, z: pz };
      }
    }
    return null;
  }

  ghostPosition(): { x: number; z: number; rot: number } | null {
    return this.placing ? { x: this.placing.x, z: this.placing.z, rot: this.placing.rot } : null;
  }

  cancelPlacement(): void {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      disposeTree(this.ghost);
    }
    this.ghost = null;
    this.placing = null;
  }

  /** Arrows bob outward so the ghost reads as "drag me". */
  private animateGhost(): void {
    const arrows = this.ghost?.getObjectByName('arrows');
    if (!arrows) return;
    const k = Math.sin(this.time * 5) * 0.12;
    arrows.children.forEach((h) => { (h.children[0] as THREE.Object3D).position.z = -((this.placing?.footprint ?? 0.8) + 0.6 + k); });
  }

  /** Where a scenery tree stands (for effects and the chop prompt). */
  treeAt(island: IslandId, index: number): { x: number; z: number; s: number } | null {
    return this.islands.get(island)?.trees[index] ?? null;
  }

  // ------------------------------------------------------------------ reveal

  startReveal(egg: Egg, creature: Creature, onPhase: (p: RevealPhase) => void): void {
    this.reveal?.dispose();
    this.reveal = new Reveal(egg, creature);
    this.reveal.onPhase = onPhase;
    this.reveal.resize(this.container.clientWidth, this.container.clientHeight);
  }

  revealTap(): void {
    this.reveal?.tap();
  }

  endReveal(): void {
    this.reveal?.dispose();
    this.reveal = null;
  }

  get revealing(): boolean {
    return !!this.reveal;
  }

  // ------------------------------------------------------------------ input

  private handleTap(x: number, y: number): void {
    if (this.reveal) {
      this.onRevealTap();
      this.reveal.tap();
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);
    const targets: THREE.Object3D[] = [];
    for (const v of this.islands.values()) {
      targets.push(v.ground);
      if (v.id === this.current) targets.push(...v.pickables);
    }
    for (const a of this.actors.values()) if (a.root.visible) targets.push(a.hit);
    for (const g of this.gifts.values()) if (g.visible) targets.push(...g.children);
    for (const d of this.decor.values()) if (d.userData.island === this.current) targets.push(d.children[d.children.length - 1]);
    if (this.current === 'home') for (const e of this.eggs.values()) targets.push(e.model.shell);
    for (const v of this.digViews.values()) if (v.root.visible) targets.push(v.root.children[v.root.children.length - 1]);
    if (this.wanderer?.group.visible) targets.push(...this.wanderer.group.children.filter((c) => c.userData.pick));
    const hits = this.raycaster.intersectObjects(targets, false);
    // prefer creatures and gifts over big structures, and those over the ground
    const rank = (k: string) => (k === 'creature' || k === 'gift' || k === 'dig' || k === 'wanderer' ? 0 : k === 'ground' ? 2 : 1);
    let best: Pick | null = null;
    let bestRank = 9;
    for (const h of hits) {
      const p = h.object.userData.pick as (Pick & { island?: IslandId }) | undefined;
      if (!p) continue;
      const r = rank(p.kind);
      if (r < bestRank) {
        bestRank = r;
        if (p.kind === 'ground') {
          // ground taps report map coordinates (the 3D hit point is on the curved globe)
          const g = p.island && p.island !== this.current ? null : this.pointerGround(x, y);
          best = !g ? { kind: 'island', id: p.island as IslandId } : { kind: 'ground', x: g.x, z: g.z };
        } else best = p;
      }
    }
    this.onTap(best);
  }

  // ------------------------------------------------------------------ frame

  private frame(dt: number): void {
    if (this.reveal) {
      this.reveal.update(dt);
      this.renderer.render(this.reveal.scene, this.reveal.camera);
      return;
    }
    this.rig.update(dt);
    this.focusTimer -= dt;
    if (this.focusTimer <= 0) {
      this.focusTimer = 0.5;
      const r = this.renderer.domElement.getBoundingClientRect();
      const p = this.pointerGround(r.left + r.width / 2, r.top + r.height * 0.55);
      this.focusPoint = p ? { x: p.x, z: p.z } : null;
    }
    const darkness = this.sky.darkness;
    const visible = [...this.actors.values()].filter((a) => a.root.visible);
    const gifts: ActorContext['gifts'] = [];
    for (const [id, g] of this.gifts) {
      if (g.userData.island === this.current && !this.hiddenGifts.has(id)) gifts.push({ id, x: g.userData.x, z: g.userData.z });
    }
    const ctx: ActorContext = {
      darkness, sky: this.skyKind, lures: this.lureCtx, actors: visible, now: this.nowMs, fx: this.fx,
      gifts, collect: (id, by) => this.onCreatureCollect(id, by.id), focus: this.focusPoint,
    };
    // Only the island you're on is simulated visually; others are "unloaded".
    for (const a of visible) a.update(dt, this.time, ctx);
    this.updateCarry();
    this.updateWanderer(dt);
    this.voiceTimer -= dt;
    if (this.voiceTimer <= 0) {
      this.voiceTimer = 4 + Math.random() * 6;
      const awake = visible.filter((a) => a.state !== 'sleep' && a.state !== 'nap' && !a.carried);
      if (awake.length) this.onVoice(awake[Math.floor(Math.random() * awake.length)].creature);
    }
    this.animateGhost();
    this.legendaryFx.update(dt, (x, z, alt) => this.at(x, z, alt, this.legendaryIsland));
    for (const v of this.digViews.values()) if (v.root.visible) animateDigSpot(v, this.time);

    const windy = this.skyKind === 'storm' || this.skyKind === 'blizzard';
    for (const v of this.islands.values()) {
      v.canopies.forEach((c, i) => {
        const lean = (c.userData.lean ??= c.rotation.z) as number;
        c.rotation.z = lean + Math.sin(this.time * 0.8 + i) * (windy ? 0.06 : 0.02);
      });
      for (const w of v.water) (w.material as THREE.MeshToonMaterial).emissiveIntensity = 0.2 + Math.sin(this.time * 1.5) * 0.06 + darkness * 0.15;
      for (const l of v.lava) (l.material as THREE.MeshToonMaterial).emissiveIntensity = 0.8 + Math.sin(this.time * 2.2) * 0.2;
      if (v.home) {
        v.home.fontWater.rotation.z += dt * 0.4;
        (v.home.fontWater.material as THREE.MeshToonMaterial).emissiveIntensity = 0.5 + Math.sin(this.time * 2) * 0.2;
        const lamp = v.home.stall.userData.lamp as THREE.Sprite;
        (lamp.material as THREE.SpriteMaterial).opacity = darkness * 0.9;
        if (v.id === this.current) animateShopkeeper(v.home.stall.userData.keeper as THREE.Group, this.time);
      }
      if (v.fireflies) {
        const fm = v.fireflies.material as THREE.PointsMaterial;
        fm.opacity = v.id === this.current ? Math.max(0, darkness - 0.35) * 1.4 * (windy ? 0.2 : 1) : 0;
        if (fm.opacity > 0) {
          const p = v.fireflies.geometry.getAttribute('position') as THREE.BufferAttribute;
          const base = v.fireflies.geometry.userData.base as Float32Array;
          for (let i = 0; i < p.count; i++) {
            p.setXYZ(i,
              base[i * 3] + Math.sin(this.time * 0.5 + i) * 0.5,
              base[i * 3 + 1] + Math.sin(this.time * 0.9 + i * 1.7) * 0.3,
              base[i * 3 + 2] + Math.cos(this.time * 0.4 + i * 0.7) * 0.5);
          }
          p.needsUpdate = true;
        }
      }
    }
    for (const c of this.clouds.children) {
      c.userData.angle += c.userData.speed * dt;
      c.position.x = Math.cos(c.userData.angle) * c.userData.radius;
      c.position.z = Math.sin(c.userData.angle) * c.userData.radius - 6;
    }
    for (const g of this.decor.values()) {
      g.traverse((o) => {
        if (o instanceof THREE.Sprite && o.userData.night) (o.material as THREE.SpriteMaterial).opacity = 0.15 + darkness * 0.75;
      });
    }

    for (const b of this.bursts) {
      b.life -= dt;
      b.vel.y -= dt * (b.drag ? 0.5 : 2);
      if (b.drag) b.vel.multiplyScalar(Math.pow(0.2, dt * b.drag));
      b.sprite.position.addScaledVector(b.vel, dt);
      (b.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, b.life / b.max) * 0.9;
    }
    this.bursts = this.bursts.filter((b) => {
      if (b.life > 0) return true;
      this.scene.remove(b.sprite);
      b.sprite.material.dispose();
      return false;
    });

    this.renderer.render(this.scene, this.rig.camera);
  }

  /** Swiping hard past the island's edge hops toward the neighbouring island in that direction. */

}

/** A dark space rock with a pink Starshard crystal poking out. */
function meteorRock(): THREE.Object3D {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), toon('#5a4a66', '#2a1a3a', 0.15));
  rock.scale.y = 0.75;
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), toon('#ff8fd0', '#ff4fb0', 0.8));
  shard.position.set(0.05, 0.14, 0);
  shard.scale.y = 1.6;
  g.add(rock, shard);
  return g;
}
