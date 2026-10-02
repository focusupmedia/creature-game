import * as THREE from 'three';
import { BASKET, NESTS, ISLAND_RADIUS, inPond, blocked } from '../content/layout';
import { LURES, SPOTS } from '../content/world';
import type { Creature, Egg, EventKind, GameEvent, GameState } from '../core/types';
import { CameraRig } from './CameraRig';
import { CreatureActor, type ActorContext } from './CreatureActor';
import { buildDecor } from './decor';
import { buildEgg, disposeEgg, type EggModel } from './eggModel';
import { glowSprite, toon } from './materials';
import { Portraits } from './portraits';
import { Reveal, type RevealPhase } from './Reveal';
import { buildSanctuary, type Sanctuary } from './sanctuary';
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
  | { kind: 'ground'; x: number; z: number };

interface Burst { sprite: THREE.Sprite; vel: THREE.Vector3; life: number; max: number }

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  readonly sky: Sky;
  readonly portraits: Portraits;
  private sanctuary: Sanctuary;
  private actors = new Map<string, CreatureActor>();
  private actorKeys = new Map<string, string>();
  private eggs = new Map<string, { model: EggModel; key: string }>();
  private gifts = new Map<string, THREE.Group>();
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
  onFrame: (dt: number) => void = () => {};
  onTap: (p: Pick | null) => void = () => {};
  onRevealTap: () => void = () => {};

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
    this.sky = new Sky(this.scene);
    this.sanctuary = buildSanctuary();
    this.scene.add(this.sanctuary.group);
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

  // ------------------------------------------------------------------ state sync

  /** Reconcile visuals with the game state. Cheap enough to call every frame. */
  sync(state: GameState, phase: number, sky: EventKind | null): void {
    this.skyKind = sky;
    void phase;
    // creatures (rebuild when mutations change so they visibly transform)
    const alive = new Set<string>();
    for (const c of state.creatures) {
      alive.add(c.id);
      const key = c.mutations.join(',');
      const actor = this.actors.get(c.id);
      if (!actor) {
        this.addActor(c);
      } else if (this.actorKeys.get(c.id) !== key) {
        const pos = actor.position.clone();
        actor.dispose(this.scene);
        const fresh = this.addActor(c);
        fresh.root.position.copy(pos);
        fresh.celebrate();
        fresh.note('Just changed! ✨');
        this.burst(pos.clone().setY(0.6), '#fff4b0', 26);
      } else {
        actor.creature = c;
      }
    }
    for (const [id, a] of this.actors) {
      if (!alive.has(id)) {
        this.burst(a.position.clone().setY(0.5), '#ffffff', 14);
        a.dispose(this.scene);
        this.actors.delete(id);
      }
    }

    // eggs in nests / basket
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
        model.shell.userData.pick = e.nest !== null ? { kind: 'nest', index: e.nest } : { kind: 'basket' };
        this.scene.add(model.root);
        entry = { model, key };
        this.eggs.set(e.id, entry);
      }
      const root = entry.model.root;
      if (e.nest !== null) {
        const n = NESTS[e.nest];
        root.position.set(n.x, 0.42, n.z);
        entry.model.shell.userData.pick = { kind: 'nest', index: e.nest };
      } else {
        root.position.set(BASKET.x + (basketIdx - 1) * 0.28, 0.12, BASKET.z);
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

    // nests: unpurchased ones are faint
    this.sanctuary.nests.forEach((g, i) => {
      const owned = i < state.nests;
      g.children.forEach((ch) => {
        if (ch instanceof THREE.Mesh && ch.material instanceof THREE.MeshToonMaterial) {
          ch.visible = owned;
        }
      });
      const lock = this.sanctuary.nestLocks[i];
      (lock.material as THREE.SpriteMaterial).opacity = 0;
    });

    // lures
    this.lureCtx = [];
    for (const spot of Object.values(SPOTS)) {
      const dish = this.sanctuary.spotDishes[spot.id];
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
        this.lureCtx.push({ id: spot.id, x: spot.x, z: spot.z, attracts: lure.attracts });
        if (Math.random() < 0.08) this.burst(new THREE.Vector3(spot.x, 0.4, spot.z), lure.color, 1, 0.6);
      } else {
        dish.bait.visible = false;
        gm.opacity = 0;
        mm.color.set('#ffe27a');
        mm.opacity = 0.65 + Math.sin(this.time * 3) * 0.3;
        dish.marker.scale.setScalar(1 + Math.sin(this.time * 3) * 0.06);
      }
    }

    // gifts
    const giftAlive = new Set(state.gifts.map((g) => g.id));
    for (const g of state.gifts) {
      if (this.gifts.has(g.id)) continue;
      const group = new THREE.Group();
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), toon(g.shards ? '#c9b6ff' : '#ffe58a', g.shards ? '#9f7fff' : '#ffc94a', 0.6));
      gem.position.y = 0.3;
      gem.userData.pick = { kind: 'gift', id: g.id };
      const sparkle = glowSprite(g.shards ? '#c9b6ff' : '#fff0a0', 0.9, 0.7);
      sparkle.position.y = 0.3;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.3;
      hit.userData.pick = { kind: 'gift', id: g.id };
      group.add(gem, sparkle, hit);
      group.position.set(g.x, 0, g.z);
      this.scene.add(group);
      this.gifts.set(g.id, group);
    }
    for (const [id, group] of this.gifts) {
      if (!giftAlive.has(id)) {
        this.burst(group.position.clone().setY(0.4), '#ffe58a', 10);
        this.scene.remove(group);
        this.gifts.delete(id);
      } else {
        group.children[0].rotation.y += 0.03;
        group.children[0].position.y = 0.3 + Math.sin(this.time * 3 + group.position.x) * 0.06;
      }
    }

    // decor
    const decorAlive = new Set(state.placedDecor.map((d) => d.id));
    for (const d of state.placedDecor) {
      if (this.decor.has(d.id)) continue;
      const g = buildDecor(d.decor);
      g.position.set(d.x, 0, d.z);
      g.rotation.y = d.rot;
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.75;
      hit.userData.pick = { kind: 'decor', id: d.id };
      g.add(hit);
      this.scene.add(g);
      this.decor.set(d.id, g);
      this.burst(g.position.clone().setY(0.5), '#ffffff', 16);
    }
    for (const [id, g] of this.decor) {
      if (!decorAlive.has(id)) {
        this.scene.remove(g);
        this.decor.delete(id);
      }
    }
  }

  private addActor(c: Creature): CreatureActor {
    const a = new CreatureActor(c, this.scene);
    this.actors.set(c.id, a);
    this.actorKeys.set(c.id, c.mutations.join(','));
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
        a.arrive(spot, () => this.burst(a.position.clone().setY(0.6), '#ffffff', 12));
        if (!this.actors.has(ev.creature.id)) this.actors.set(ev.creature.id, a);
        break;
      }
      case 'strike': {
        const a = this.actors.get(ev.creature.id);
        if (a) {
          a.note('Just got zapped by sparkfall ⚡');
          this.sky.strike(a.position.clone().setY(0.3));
          this.burst(a.position.clone().setY(0.3), '#fff27a', 22, 2);
        }
        break;
      }
      case 'moonbeam': {
        const a = this.actors.get(ev.creature.id);
        if (a) {
          this.sky.moonbeam(a.position);
          a.note('Bathed in a moonbeam 🌙');
        }
        break;
      }
      case 'eggTouched': {
        const e = this.eggs.get(ev.egg.id);
        if (e) this.burst(e.model.root.position.clone().setY(0.7), ev.event === 'storm' ? '#fff27a' : '#c9d4ff', 16);
        break;
      }
      case 'eggReady': {
        const e = this.eggs.get(ev.egg.id);
        if (e) this.burst(e.model.root.position.clone().setY(0.7), '#ffffff', 14);
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
    return a ? a.headPosition(this.tmpH) : null;
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

  focus(p: { x: number; z: number }, distance?: number): void {
    this.rig.flyTo(p, distance);
  }

  emote(id: string, text: string): void {
    this.actors.get(id)?.emote(text, 2);
  }

  // ------------------------------------------------------------------ effects

  burst(pos: THREE.Vector3, color: string, count: number, speed = 1.2): void {
    for (let i = 0; i < count; i++) {
      const s = glowSprite(color, 0.35, 0.9);
      s.position.copy(pos);
      this.scene.add(s);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 2).multiplyScalar(speed);
      const life = 0.8 + Math.random() * 0.6;
      this.bursts.push({ sprite: s, vel: v, life, max: life });
    }
  }

  burstAt(x: number, y: number, z: number, color: string, count: number): void {
    this.burst(new THREE.Vector3(x, y, z), color, count);
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
    this.ghost.position.set(this.rig.focus.x, 0, this.rig.focus.z);
    this.scene.add(this.ghost);
  }

  moveGhost(x: number, z: number): boolean {
    if (!this.ghost) return false;
    this.ghost.position.set(x, 0, z);
    return this.validPlacement(x, z);
  }

  validPlacement(x: number, z: number): boolean {
    return Math.hypot(x, z) < ISLAND_RADIUS - 0.9 && !inPond(x, z, 0.4) && !blocked(x, z, 0.5);
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
    const targets: THREE.Object3D[] = [...this.sanctuary.pickables, this.sanctuary.ground];
    for (const a of this.actors.values()) targets.push(a.hit);
    for (const g of this.gifts.values()) targets.push(...g.children);
    for (const d of this.decor.values()) targets.push(d.children[d.children.length - 1]);
    for (const e of this.eggs.values()) targets.push(e.model.shell);
    const hits = this.raycaster.intersectObjects(targets, false);
    // prefer creatures and gifts over big structures when both are hit
    const rank = (k: string) => (k === 'creature' || k === 'gift' ? 0 : k === 'ground' ? 2 : 1);
    let best: Pick | null = null;
    let bestRank = 9;
    for (const h of hits) {
      const p = h.object.userData.pick as Pick | undefined;
      if (!p) continue;
      const r = rank(p.kind);
      if (r < bestRank) {
        bestRank = r;
        best = p.kind === 'ground' ? { kind: 'ground', x: h.point.x, z: h.point.z } : p;
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
    const darkness = this.sky.darkness;
    const ctx: ActorContext = { darkness, sky: this.skyKind, lures: this.lureCtx, actors: [...this.actors.values()] };
    for (const a of this.actors.values()) a.update(dt, this.time, ctx);

    const s = this.sanctuary;
    s.canopies.forEach((c, i) => (c.rotation.z = Math.sin(this.time * 0.8 + i) * (this.skyKind === 'storm' ? 0.06 : 0.02)));
    const wm = s.water.material as THREE.MeshToonMaterial;
    wm.emissiveIntensity = 0.2 + Math.sin(this.time * 1.5) * 0.06 + darkness * 0.15;
    s.fontWater.rotation.z += dt * 0.4;
    (s.fontWater.material as THREE.MeshToonMaterial).emissiveIntensity = 0.5 + Math.sin(this.time * 2) * 0.2;
    for (const c of s.clouds.children) {
      c.userData.angle += c.userData.speed * dt;
      c.position.x = Math.cos(c.userData.angle) * c.userData.radius;
      c.position.z = Math.sin(c.userData.angle) * c.userData.radius;
    }
    const fm = s.fireflies.material as THREE.PointsMaterial;
    fm.opacity = Math.max(0, darkness - 0.35) * 1.4 * (this.skyKind === 'storm' ? 0.2 : 1);
    if (fm.opacity > 0) {
      const p = s.fireflies.geometry.getAttribute('position') as THREE.BufferAttribute;
      const base = s.fireflies.geometry.userData.base as Float32Array;
      for (let i = 0; i < p.count; i++) {
        p.setXYZ(i,
          base[i * 3] + Math.sin(this.time * 0.5 + i) * 0.5,
          base[i * 3 + 1] + Math.sin(this.time * 0.9 + i * 1.7) * 0.3,
          base[i * 3 + 2] + Math.cos(this.time * 0.4 + i * 0.7) * 0.5);
      }
      p.needsUpdate = true;
    }
    const lamp = s.stall.userData.lamp as THREE.Sprite;
    (lamp.material as THREE.SpriteMaterial).opacity = darkness * 0.9;
    for (const g of this.decor.values()) {
      g.traverse((o) => {
        if (o instanceof THREE.Sprite && o.userData.night) (o.material as THREE.SpriteMaterial).opacity = 0.15 + darkness * 0.75;
      });
    }

    for (const b of this.bursts) {
      b.life -= dt;
      b.vel.y -= dt * 2;
      b.sprite.position.addScaledVector(b.vel, dt);
      (b.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, b.life / b.max);
    }
    this.bursts = this.bursts.filter((b) => {
      if (b.life > 0) return true;
      this.scene.remove(b.sprite);
      b.sprite.material.dispose();
      return false;
    });

    this.renderer.render(this.scene, this.rig.camera);
  }
}
