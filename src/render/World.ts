import * as THREE from 'three';
import { BASKET, NESTS } from '../content/layout';
import { ISLAND_ORDER, inWater, isBlocked, islandGeo, onLand } from '../content/islands';
import { EVENTS, LURES, SPOTS } from '../content/world';
import type { Creature, Egg, EventKind, GameEvent, GameState, IslandId } from '../core/types';
import { groundAt, groundNormal, groundY } from '../content/terrain';
import { CameraRig } from './CameraRig';
import { CreatureActor, type ActorContext, type FxKind } from './CreatureActor';
import { animateDigSpot, buildDigSpot, disposeDigSpot, type DigSpotView } from './digSpots';
import { buildDecor } from './decor';
import { animateShopkeeper } from './creatureModels';
import { buildEgg, disposeEgg, type EggModel } from './eggModel';
import { glowSprite, toon } from './materials';
import { Portraits } from './portraits';
import { Reveal, type RevealPhase } from './Reveal';
import { buildIsland, type IslandView } from './sanctuary';
import { Sky } from './sky';

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
  | { kind: 'dig'; id: string };

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
  private quality = 1;
  private frameTimes: number[] = [];
  private nowMs = Date.now();
  onFrame: (dt: number) => void = () => {};
  onTap: (p: Pick | null) => void = () => {};
  onRevealTap: () => void = () => {};
  /** The player pushed past the island edge toward another island. */
  onEdgePush: (toward: IslandId) => void = () => {};
  onCarryStart: (creatureId: string) => void = () => {};
  onCarryDrop: (creatureId: string, target: CarryTarget | null) => void = () => {};
  private carry: { actor: CreatureActor; hover: CarryTarget | null } | null = null;
  private hoverRing: THREE.Mesh;
  private dropShadow: THREE.Mesh;
  private digViews = new Map<string, DigSpotView & { island: IslandId; x: number; z: number }>();

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.scene.fog = new THREE.Fog('#bfe6ff', 45, 110);
    this.rig = new CameraRig(this.renderer.domElement);
    this.rig.onTap = (x, y) => this.handleTap(x, y);
    this.rig.ground = (x, z) => this.groundAt(x, z);
    this.rig.onHold = (x, y) => this.holdAt(x, y);
    this.rig.onCarry = (x, y) => this.carryMove(x, y);
    this.rig.onCarryEnd = () => this.carryEnd();
    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.92, 32), new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.9, depthWrite: false }));
    this.hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);
    this.dropShadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: '#1b2a4a', transparent: true, opacity: 0.25, depthWrite: false }));
    this.dropShadow.rotation.x = -Math.PI / 2;
    this.dropShadow.visible = false;
    this.scene.add(this.dropShadow);
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
    const g = islandGeo(id, this.sizes[id] ?? 0);
    this.rig.center.set(g.ox, 0, g.oz);
    this.rig.bound = Math.max(5, g.r - 2);
    this.rig.overflow.set(0, 0);
    if (instant) {
      this.rig.focus.set(g.ox, 0, g.oz);
    } else {
      this.rig.flyTo({ x: g.ox, z: g.oz }, Math.max(this.rig.distance, 26));
    }
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
    this.skyKind = sky;
    this.nowMs = now;

    // islands: (re)build when ownership or size changes
    for (const id of ISLAND_ORDER) {
      const isl = state.islands[id] ?? { owned: false, size: 0 };
      this.sizes[id] = isl.size;
      this.owned[id] = isl.owned;
      const key = `${isl.owned}:${isl.size}`;
      const view = this.islands.get(id);
      if (view && view.key === key) continue;
      if (view) this.scene.remove(view.group);
      const fresh = buildIsland(id, isl.size, isl.owned);
      this.islands.set(id, fresh);
      this.scene.add(fresh.group);
      if (view && isl.owned) {
        const g = islandGeo(id, isl.size);
        this.burst(new THREE.Vector3(g.ox, groundY(g, g.ox, g.oz) + 1, g.oz), '#fff6c8', 40, 3);
      }
      if (id === this.current) this.travelTo(id, true);
    }

    // creatures (rebuild when mutations, island or island size change)
    const alive = new Set<string>();
    for (const c of state.creatures) {
      alive.add(c.id);
      const key = `${c.mutations.join(',')}|${c.island}|${this.sizes[c.island] ?? 0}`;
      const actor = this.actors.get(c.id);
      if (!actor) {
        this.addActor(c);
      } else if (this.actorKeys.get(c.id) !== key) {
        const sameIsland = actor.geo.id === c.island;
        const pos = actor.position.clone();
        const mutated = this.actorKeys.get(c.id)?.split('|')[0] !== c.mutations.join(',');
        actor.dispose(this.scene);
        const fresh = this.addActor(c);
        if (sameIsland) fresh.root.position.copy(pos);
        if (mutated) {
          fresh.celebrate();
          fresh.note('Just changed! ✨');
          this.burst(pos.clone().setY(pos.y + 0.6), '#fff4b0', 26);
        }
      } else {
        actor.creature = c;
      }
    }
    for (const [id, a] of this.actors) {
      if (!alive.has(id)) {
        if (a.root.visible) this.burst(a.position.clone().setY(a.position.y + 0.5), '#ffffff', 14);
        a.dispose(this.scene);
        this.actors.delete(id);
      }
    }
    for (const a of this.actors.values()) a.root.visible = a.geo.id === this.current;

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
          if (Math.random() < 0.08) this.burst(new THREE.Vector3(spot.x, this.groundAt(spot.x, spot.z) + 0.4, spot.z), lure.color, 1, 0.6);
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
      v.root.position.set(d.x, this.groundAt(d.x, d.z), d.z);
      const n = groundNormal(islandGeo(d.island, this.sizes[d.island] ?? 0), d.x, d.z);
      v.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n.x, n.y, n.z));
      this.scene.add(v.root);
      this.digViews.set(d.id, v);
    }
    for (const [id, v] of this.digViews) {
      if (!digAlive.has(id)) {
        if (v.island === this.current) this.burst(v.root.position.clone().setY(v.root.position.y + 0.3), '#fff3b0', 8);
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
      const gem = g.item === 'egg'
        ? (() => { const e = buildEgg('mossfrog', [], 3, 0.22); return e.root; })()
        : new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), toon(rare ? '#c9b6ff' : '#ffe58a', rare ? '#9f7fff' : '#ffc94a', 0.6));
      gem.position.y = 0.3;
      const sparkle = glowSprite(rare ? '#c9b6ff' : '#fff0a0', rare ? 1.3 : 0.9, 0.7);
      sparkle.position.y = 0.3;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.3;
      hit.userData.pick = { kind: 'gift', id: g.id };
      group.add(gem, sparkle, hit);
      group.position.set(g.x, this.groundAt(g.x, g.z), g.z);
      group.userData.island = g.island ?? 'home';
      this.scene.add(group);
      this.gifts.set(g.id, group);
    }
    for (const [id, group] of this.gifts) {
      if (!giftAlive.has(id)) {
        if (group.visible) this.burst(group.position.clone().setY(group.position.y + 0.4), '#ffe58a', 10);
        this.scene.remove(group);
        this.gifts.delete(id);
        this.hiddenGifts.delete(id);
      } else {
        group.visible = group.userData.island === this.current && !this.hiddenGifts.has(id);
        group.children[0].rotation.y += 0.03;
        group.children[0].position.y = 0.3 + Math.sin(this.time * 3 + group.position.x) * 0.06;
      }
    }

    // decor
    const decorAlive = new Set(state.placedDecor.map((d) => d.id));
    for (const d of state.placedDecor) {
      if (this.decor.has(d.id)) continue;
      const g = buildDecor(d.decor);
      g.position.set(d.x, this.groundAt(d.x, d.z), d.z);
      g.rotation.y = d.rot;
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.75;
      hit.userData.pick = { kind: 'decor', id: d.id };
      g.add(hit);
      this.scene.add(g);
      this.decor.set(d.id, g);
      this.burst(g.position.clone().setY(g.position.y + 0.5), '#ffffff', 16);
    }
    for (const [id, g] of this.decor) {
      if (!decorAlive.has(id)) {
        this.scene.remove(g);
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
        root.position.set(n.x, 0.42 + this.groundAt(n.x, n.z), n.z);
        entry.model.shell.userData.pick = { kind: 'nest', index: e.nest };
      } else {
        root.position.set(BASKET.x + (basketIdx - 1) * 0.28, 0.12 + this.groundAt(BASKET.x, BASKET.z), BASKET.z);
        entry.model.shell.userData.pick = { kind: 'basket' };
        basketIdx++;
      }
      const ready = e.progressMs >= e.incubationMs;
      const prog = e.progressMs / e.incubationMs;
      const shake = ready ? 0.12 : prog > 0.8 ? 0.05 : 0;
      root.rotation.z = Math.sin(this.time * (ready ? 14 : 9) + e.seed) * shake * (Math.sin(this.time * 1.3 + e.seed) > 0.3 ? 1 : 0.15);
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
        a.arrive(spot, () => this.burst(a.position.clone().setY(a.position.y + 0.6), '#ffffff', 12));
        break;
      }
      case 'gift': {
        // Watch it happen: the creature walks over and digs the find up.
        const a = ev.gift.from ? this.actors.get(ev.gift.from) : undefined;
        if (a && a.root.visible && a.state !== 'sleep' && a.state !== 'arrive' && !a.carried) {
          this.hiddenGifts.add(ev.gift.id);
          a.digAt(ev.gift.x, ev.gift.z, () => {
            this.hiddenGifts.delete(ev.gift.id);
            this.burst(new THREE.Vector3(ev.gift.x, this.groundAt(ev.gift.x, ev.gift.z) + 0.3, ev.gift.z), ev.gift.shards || ev.gift.item ? '#d9c6ff' : '#ffe58a', 16, 1.4);
          }, ev.gift.via === 'puddle' ? 'splash' : ev.gift.via === 'bush' ? 'leaf' : 'dirt');
        }
        break;
      }
      case 'skyTouch': {
        const a = this.actors.get(ev.creature.id);
        if (!a) break;
        a.note(EVENTS[ev.event].touch.bubble);
        if (!a.root.visible) break;
        const at = a.position.clone().setY(a.position.y + 0.3);
        if (ev.event === 'storm') {
          this.sky.strike(at);
          this.burst(at, '#fff27a', 22, 2);
        } else if (ev.event === 'eclipse' || ev.event === 'fullmoon') {
          this.sky.moonbeam(a.position);
        } else if (ev.event === 'starry') {
          this.sky.fallingStar(at, () => this.burst(at, '#fff1a8', 26, 1.8));
        } else {
          this.burst(a.position.clone().setY(a.position.y + 0.6), '#ffffff', 30, 1.4);
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

  get zoom(): number {
    return this.rig.distance;
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

  /** Height of the (domed) ground at a world point. */
  groundAt(x: number, z: number): number {
    return groundAt(x, z, this.sizes);
  }

  focus(p: { x: number; z: number }, distance?: number): void {
    this.rig.flyTo(p, distance);
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
    const hit = this.raycaster.intersectObject(view.ground, false)[0];
    if (hit) return hit.point;
    // past the rim: slide along a plane at rim height, then keep it over the island
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return null;
    const g = islandGeo(this.current, this.sizes[this.current] ?? 0);
    const dx = p.x - g.ox;
    const dz = p.z - g.oz;
    const len = Math.hypot(dx, dz);
    const max = g.r - 0.6;
    if (len > max) p.set(g.ox + (dx / len) * max, 0, g.oz + (dz / len) * max);
    return p;
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
    actor.pickUp();
    this.carry = { actor, hover: null };
    this.select(null);
    this.burst(actor.position.clone().setY(actor.position.y + 0.3), '#ffffff', 8, 0.8);
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
        if (a === actor || !a.root.visible) continue;
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
    const gy = this.groundAt(actor.position.x, actor.position.z);
    this.dropShadow.visible = true;
    this.dropShadow.position.set(actor.position.x, gy + 0.04, actor.position.z);
    let at: { x: number; z: number } | null = null;
    if (hover?.kind === 'dig') at = this.digViews.get(hover.id) ?? null;
    if (hover?.kind === 'creature') {
      const a = this.actors.get(hover.id);
      at = a ? { x: a.position.x, z: a.position.z } : null;
    }
    this.hoverRing.visible = !!at;
    if (at) {
      this.hoverRing.position.set(at.x, this.groundAt(at.x, at.z) + 0.06, at.z);
      this.hoverRing.scale.setScalar(1 + Math.sin(this.time * 8) * 0.08);
      (this.hoverRing.material as THREE.MeshBasicMaterial).color.set(hover?.kind === 'creature' ? '#ff8fc8' : '#ffe27a');
    }
  }

  // ------------------------------------------------------------------ decor placement

  startPlacement(decorId: string): void {
    this.cancelPlacement();
    this.ghost = buildDecor(decorId);
    this.ghost.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = (o.material as THREE.Material).clone();
        (o.material as THREE.Material).transparent = true;
        (o.material as THREE.Material).opacity = 0.55;
      }
    });
    this.ghost.position.set(this.rig.focus.x, this.groundAt(this.rig.focus.x, this.rig.focus.z), this.rig.focus.z);
    this.scene.add(this.ghost);
  }

  moveGhost(x: number, z: number): boolean {
    if (!this.ghost) return false;
    this.ghost.position.set(x, this.groundAt(x, z), z);
    return this.validPlacement(x, z);
  }

  validPlacement(x: number, z: number): boolean {
    const g = islandGeo(this.current, this.sizes[this.current] ?? 0);
    return onLand(g, x, z, 0.9) && !inWater(g, x, z, 0.4) && !isBlocked(g, x, z, 0.5);
  }

  ghostPosition(): { x: number; z: number } | null {
    return this.ghost ? { x: this.ghost.position.x, z: this.ghost.position.z } : null;
  }

  cancelPlacement(): void {
    if (this.ghost) this.scene.remove(this.ghost);
    this.ghost = null;
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
    for (const d of this.decor.values()) targets.push(d.children[d.children.length - 1]);
    if (this.current === 'home') for (const e of this.eggs.values()) targets.push(e.model.shell);
    for (const v of this.digViews.values()) if (v.root.visible) targets.push(v.root.children[v.root.children.length - 1]);
    const hits = this.raycaster.intersectObjects(targets, false);
    // prefer creatures and gifts over big structures, and those over the ground
    const rank = (k: string) => (k === 'creature' || k === 'gift' || k === 'dig' ? 0 : k === 'ground' ? 2 : 1);
    let best: Pick | null = null;
    let bestRank = 9;
    for (const h of hits) {
      const p = h.object.userData.pick as (Pick & { island?: IslandId }) | undefined;
      if (!p) continue;
      const r = rank(p.kind);
      if (r < bestRank) {
        bestRank = r;
        if (p.kind === 'ground') {
          best = p.island && p.island !== this.current ? { kind: 'island', id: p.island } : { kind: 'ground', x: h.point.x, z: h.point.z };
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
    this.checkEdgePush();
    const darkness = this.sky.darkness;
    const visible = [...this.actors.values()].filter((a) => a.root.visible);
    const ctx: ActorContext = { darkness, sky: this.skyKind, lures: this.lureCtx, actors: visible, now: this.nowMs, fx: this.fx };
    // Only the island you're on is simulated visually; others are "unloaded".
    for (const a of visible) a.update(dt, this.time, ctx);
    this.updateCarry();
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
  private checkEdgePush(): void {
    const o = this.rig.overflow;
    if (o.length() < 3.5) return;
    const from = islandGeo(this.current, this.sizes[this.current] ?? 0);
    const dir = new THREE.Vector2(o.x, o.y).normalize();
    let best: IslandId | null = null;
    let bestDot = 0.6;
    for (const id of ISLAND_ORDER) {
      if (id === this.current) continue;
      const g = islandGeo(id, this.sizes[id] ?? 0);
      const to = new THREE.Vector2(g.ox - from.ox, g.oz - from.oz).normalize();
      const d = to.dot(dir);
      if (d > bestDot) {
        bestDot = d;
        best = id;
      }
    }
    o.set(0, 0);
    if (best) this.onEdgePush(best);
  }
}
