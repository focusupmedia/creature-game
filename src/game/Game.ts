import { species } from '../content/species';
import { DIG_KINDS, EVENTS, ITEMS, LURES, MUTATIONS, SPOTS } from '../content/world';
import { ISLANDS } from '../content/islands';
import { refreshShop } from '../core/shop';
import { NESTS } from '../content/layout';
import { TUNING } from '../content/tuning';
import * as A from '../core/actions';
import { displayName, speciesTitle } from '../core/creatures';
import { deserialize, serialize } from '../core/save';
import { tick } from '../core/sim';
import { createGame } from '../core/state';
import type { GameEvent, GameState, IslandId } from '../core/types';
import { activeEvent, dayPhase, nextEvent } from '../core/world';
import { Audio } from '../platform/audio';
import {
  ConsoleAnalytics, ConsoleCrash, StubAds, StubPurchases, WebNotifications, WebStorage,
  type Ads, type Analytics, type Crash, type Notifications, type Purchases, type Storage,
} from '../platform/services';
import { World, type CarryTarget, type Pick } from '../render/World';
import { UI } from '../ui/UI';

const SAVE_KEY = 'kindred-grove.save.v1';
const SETTINGS_KEY = 'kindred-grove.settings';
const SPIN_HINT_KEY = 'kindred-grove.hint.controls';
const LIVE_TICK_S = 0.25;
const AWAY_REPORT_MS = 90_000;

export class Game {
  state: GameState;
  readonly world: World;
  readonly ui: UI;
  readonly audio = new Audio();
  readonly storage: Storage = new WebStorage();
  readonly analytics: Analytics = new ConsoleAnalytics();
  readonly purchases: Purchases = new StubPurchases();
  readonly notifications: Notifications = new WebNotifications();
  readonly crash: Crash = new ConsoleCrash();
  readonly ads: Ads;
  timeScale = 1;
  placing: ((x: number, z: number) => void) | null = null;
  private tickAcc = 0;
  private saveAcc = 0;
  private dirty = false;
  private hiddenAt = 0;
  private digHints = 0;

  constructor(container: HTMLElement) {
    this.state = this.load();
    this.loadSettings();
    this.world = new World(container);
    this.ui = new UI(this, container);
    this.ads = new StubAds((s) => this.ui.showAd(s));
    this.world.onTap = (p) => this.onTap(p);
    this.world.onEdgePush = (id) => {
      if (this.state.islands[id]?.owned) this.travel(id);
      else this.ui.showIslands(id);
    };
    this.world.onFrame = (dt) => this.frame(dt);
    this.world.onRevealTap = () => this.audio.play('crack');
    this.world.onCarryStart = () => this.audio.play('egg');
    this.world.onCarryDrop = (id, target) => this.onCarryDrop(id, target);
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: false });
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => this.save());
    window.addEventListener('error', (e) => this.crash.capture(e.error, 'window.onerror'));
    window.addEventListener('unhandledrejection', (e) => this.crash.capture(e.reason, 'unhandledrejection'));
  }

  start(): void {
    const away = this.now() - this.state.lastTick;
    const events = tick(this.state, this.now(), { maxStepMs: TUNING.offlineStepSec * 1000 });
    this.world.sync(this.state, this.now(), activeEvent(this.state, this.now())?.kind ?? null);
    if (away > AWAY_REPORT_MS) this.ui.showAwayReport(events, away);
    this.analytics.track('session_start', { creatures: this.state.creatures.length, away_min: Math.round(away / 60000) });
    this.world.start();
    if (!this.storage.load(SPIN_HINT_KEY)) {
      this.storage.save(SPIN_HINT_KEY, '1');
      setTimeout(() => this.ui.toast('👆 Drag to spin your island. Press and hold a creature to pick it up and carry it!', 'info', undefined, 6500), 4000);
    }
  }

  now(): number {
    return Date.now() + this.state.clockOffset;
  }

  // ------------------------------------------------------------------ persistence

  /** Device settings (sound, music) live outside the save so "Start over" keeps them. */
  private loadSettings(): void {
    try {
      const s = JSON.parse(this.storage.load(SETTINGS_KEY) ?? '{}') as { sound?: boolean; music?: boolean };
      if (s.sound === false) this.audio.enabled = false;
      if (s.music === false) this.audio.musicEnabled = false;
    } catch { /* ignore bad settings */ }
  }

  setSound(on: boolean): void {
    this.audio.unlock();
    this.audio.setEnabled(on);
    this.saveSettings();
  }

  setMusic(on: boolean): void {
    this.audio.unlock();
    this.audio.setMusicEnabled(on);
    this.saveSettings();
  }

  private saveSettings(): void {
    this.storage.save(SETTINGS_KEY, JSON.stringify({ sound: this.audio.enabled, music: this.audio.musicEnabled }));
  }

  private load(): GameState {
    const raw = this.storage.load(SAVE_KEY);
    if (raw) {
      try {
        return deserialize(raw);
      } catch (e) {
        this.crash.capture(e, 'load');
        this.storage.save(`${SAVE_KEY}.corrupt.${Date.now()}`, raw);
      }
    }
    return createGame(Date.now());
  }

  save(): void {
    try {
      this.storage.save(SAVE_KEY, serialize(this.state, this.now()));
      this.dirty = false;
    } catch (e) {
      this.crash.capture(e, 'save');
    }
  }

  saveSoon(): void {
    this.dirty = true;
  }

  reset(): void {
    this.storage.remove(SAVE_KEY);
    location.reload();
  }

  private onVisibility(): void {
    if (document.hidden) {
      this.hiddenAt = this.now();
      this.save();
      this.scheduleNotifications();
    } else if (this.hiddenAt) {
      const away = this.now() - this.hiddenAt;
      this.hiddenAt = 0;
      const events = tick(this.state, this.now(), { maxStepMs: TUNING.offlineStepSec * 1000 });
      this.dispatch(events, false);
      if (away > AWAY_REPORT_MS) this.ui.showAwayReport(events, away);
    }
  }

  private scheduleNotifications(): void {
    for (const e of this.state.eggs) {
      if (e.nest === null || e.progressMs >= e.incubationMs) continue;
      this.notifications.schedule(`egg-${e.id}`, this.now() + A.remainingMs(e), 'Something is moving inside an egg…', 'Come see what hatches.');
    }
    const ev = nextEvent(this.state, this.now());
    if (ev) this.notifications.schedule('sky', ev.start, `A ${EVENTS[ev.kind].name.toLowerCase()} is coming`, 'The sanctuary is about to change.');
  }

  // ------------------------------------------------------------------ loop

  private frame(dt: number): void {
    if (this.timeScale !== 1) this.state.clockOffset += dt * (this.timeScale - 1) * 1000;
    this.tickAcc += dt;
    if (this.tickAcc >= LIVE_TICK_S && !this.world.revealing) {
      this.tickAcc = 0;
      const events = tick(this.state, this.now(), { maxStepMs: 1000 });
      if (events.length) this.dispatch(events, true);
    }
    const t = this.now();
    const sky = activeEvent(this.state, t)?.kind ?? null;
    const phase = dayPhase(this.state, t);
    this.world.sync(this.state, t, sky);
    this.world.sky.update(phase, sky, dt, performance.now() / 1000);
    this.audio.ambience(dt, this.world.sky.darkness, sky);
    this.ui.update(dt);
    this.saveAcc += dt;
    if (this.saveAcc > 15 || (this.dirty && this.saveAcc > 1)) {
      this.saveAcc = 0;
      this.save();
    }
  }

  private dispatch(events: GameEvent[], live: boolean): void {
    for (const ev of events) {
      this.world.handle(ev, live);
      switch (ev.type) {
        case 'arrival': {
          this.analytics.track('creature_arrived', { species: ev.creature.species, spot: ev.spot, mutations: ev.creature.mutations.length, new: ev.discovered });
          if (!live) break;
          const stayed = this.state.creatures.some((c) => c.id === ev.creature.id);
          const pic = this.world.portraits.get(ev.creature.species, ev.creature.mutations);
          if (ev.discovered) {
            this.audio.play('discover');
            this.ui.toast(`New discovery: ${speciesTitle(ev.creature)}!`, 'discovery', pic, 4500);
          } else {
            this.audio.play('arrive');
            this.ui.toast(`A ${speciesTitle(ev.creature)} ${stayed ? 'arrived' : 'visited, but your sanctuary is full'} at the ${SPOTS[ev.spot].name}.`, 'info', pic);
          }
          if (this.state.tutorial <= 1) {
            this.setTutorial(2);
            this.world.focus(SPOTS[ev.spot], 13);
          }
          break;
        }
        case 'mutation': {
          this.analytics.track('mutation_gained', { mutation: ev.mutation, cause: ev.cause, new: ev.discovered });
          if (!live) break;
          this.audio.play('chime');
          const pic = this.world.portraits.get(ev.creature.species, ev.creature.mutations);
          this.ui.toast(`${displayName(ev.creature)} became ${MUTATIONS[ev.mutation].name}!${ev.discovered ? ' A new kind of change!' : ''}`, 'discovery', pic, 5000);
          break;
        }
        case 'skyTouch':
          if (live) this.audio.play(ev.event === 'storm' ? 'thunder' : 'chime');
          break;
        case 'eventStart':
          this.analytics.track('sky_event', { kind: ev.kind });
          if (live) {
            this.ui.toast(`${EVENTS[ev.kind].icon} ${EVENTS[ev.kind].arrive}`, 'discovery', undefined, 5000);
            if (ev.kind === 'storm') this.audio.play('thunder'); else this.audio.play('chime');
          }
          break;
        case 'eventEnd':
          if (live) this.ui.toast(EVENTS[ev.kind].leave);
          break;
        case 'eggTouched':
          if (live) this.ui.toast(`An egg glows strangely as the ${EVENTS[ev.event].name.toLowerCase()} passes…`);
          break;
        case 'eggReady':
          if (live) {
            this.audio.play('egg');
            this.ui.toast('🐣 An egg is ready to hatch!');
          }
          this.notifications.cancel(`egg-${ev.egg.id}`);
          break;
        case 'lureExpired':
          if (live) this.ui.toast(`The lure at the ${SPOTS[ev.spot].name} has faded.`);
          break;
        case 'digSpot':
          if (live && ev.spot.island === this.world.current && this.digHints < 2) {
            this.digHints++;
            const k = DIG_KINDS[ev.spot.kind];
            this.ui.toast(`${k.icon} A ${k.name.toLowerCase()} appeared! Drop a creature on it to see what's there.`);
          }
          break;
        case 'shopRefresh':
          if (live) this.ui.toast('🐒 Mango has new wares at the shop!');
          break;
        case 'note':
          if (live) this.ui.toast(`📝 Journal: ${ev.text}`, 'info', undefined, 4500);
          break;
        default:
      }
    }
    this.dirty = true;
    this.ui.rerender();
  }

  // ------------------------------------------------------------------ input

  private onTap(p: Pick | null): void {
    if (this.placing) {
      if (p && p.kind === 'ground') this.placing(p.x, p.z);
      return;
    }
    if (!p || p.kind === 'ground') {
      if (this.ui.sheetOpen) this.ui.closeSheet();
      else this.ui.selectCreature(null);
      return;
    }
    this.audio.play('tap');
    switch (p.kind) {
      case 'creature': return this.ui.selectCreature(p.id);
      case 'spot': return this.ui.showSpot(p.id);
      case 'nest': return this.ui.showNest(p.index);
      case 'font': return this.ui.showFont();
      case 'shop': return this.ui.showShop();
      case 'basket': return this.ui.showBasket();
      case 'decor': return this.ui.showPlacedDecor(p.id);
      case 'island':
        if (this.state.islands[p.id]?.owned) return this.travel(p.id);
        return this.ui.showIslands(p.id);
      case 'dig': {
        const d = this.state.digSpots.find((x) => x.id === p.id);
        if (!d) return;
        const k = DIG_KINDS[d.kind];
        return this.ui.toast(`${k.icon} ${k.name}! Press and hold a creature, then drop it here.`);
      }
      case 'gift': {
        const via = this.state.gifts.find((x) => x.id === p.id)?.via;
        const r = A.collectGift(this.state, p.id, this.now());
        if (r.ok) {
          this.audio.play('coin');
          const extra = r.item === 'egg' ? ' …and a whole egg! It\'s in your basket.'
            : r.item ? ` …and a ${ITEMS[r.item]?.name ?? 'curiosity'}!` : '';
          this.ui.toast(`${via ? DIG_KINDS[via].verb : 'Dug up'}: {coin} ${r.glimmer}${r.shards ? ` and {gem} ${r.shards}` : ''}${extra}`, r.item ? 'discovery' : 'info', undefined, r.item ? 4000 : 1800);
          this.analytics.track('gift_collected', { glimmer: r.glimmer, shards: r.shards, item: r.item ?? '' });
          this.saveSoon();
        }
      }
    }
  }

  /** You put a creature down: on another creature (breed?), on a dig spot (work it), or just somewhere new. */
  private onCarryDrop(id: string, target: CarryTarget | null): void {
    this.audio.play('place');
    const c = this.state.creatures.find((x) => x.id === id);
    if (!c || !target) return;
    if (target.kind === 'creature') {
      const other = this.state.creatures.find((x) => x.id === target.id);
      if (other) this.ui.confirmBreed(c, other);
      return;
    }
    const r = A.workDigSpot(this.state, target.id, id);
    if (!r.ok) {
      this.audio.play('error');
      return this.ui.toast(r.error);
    }
    this.world.handle({ type: 'gift', gift: r.gift, t: this.now() }, true);
    this.analytics.track('dig_spot', { kind: r.gift.via ?? '', glimmer: r.gift.glimmer, shards: r.gift.shards, item: r.gift.item ?? '' });
    this.saveSoon();
  }

  // ------------------------------------------------------------------ actions

  get pinned(): string | null {
    return this.state.pinned && this.state.creatures.some((c) => c.id === this.state.pinned) ? this.state.pinned : null;
  }

  setPinned(id: string | null): void {
    this.state.pinned = id ?? undefined;
    if (id) this.ui.toast('Pinned to your widget. Tap it any time to jump to them.');
    this.saveSoon();
  }

  /** Hop the camera to another island you own. */
  travel(id: IslandId): void {
    if (!this.state.islands[id]?.owned) return;
    this.ui.closeSheet();
    this.world.travelTo(id);
    this.audio.play('place');
    this.ui.toast(`${ISLANDS[id].icon} ${ISLANDS[id].name}`, 'info', undefined, 1600);
    this.analytics.track('island_travel', { island: id });
  }

  buyIsland(id: IslandId, currency: 'glimmer' | 'shards'): void {
    const r = A.buyIsland(this.state, id, currency);
    if (!r.ok) {
      this.audio.play('error');
      return this.ui.toast(r.error);
    }
    this.audio.play('discover');
    this.analytics.track('island_bought', { island: id, currency });
    // the shop starts stocking the island's lure right away
    refreshShop(this.state, this.now());
    const lure = Object.values(LURES).find((l) => l.attracts === ISLANDS[id].habitat)?.id;
    if (lure) this.state.lures[lure] = (this.state.lures[lure] ?? 0) + 2;
    this.saveSoon();
    this.ui.closeSheet();
    setTimeout(() => this.travel(id), 50);
    const starters = (ISLANDS[id].starters ?? []).map((sp) => species(sp).name);
    const welcome = starters.length ? ` A ${starters.join(' and a ')} were waiting for you. Try breeding them!` : '';
    this.ui.toast(`${ISLANDS[id].icon} ${ISLANDS[id].name} is yours! Here are 2 free lures to get started.${welcome}`, 'discovery', undefined, 6500);
  }

  upgradeIsland(id: IslandId, currency: 'glimmer' | 'shards'): void {
    const r = A.upgradeIsland(this.state, id, currency);
    if (!r.ok) {
      this.audio.play('error');
      return this.ui.toast(r.error);
    }
    this.audio.play('discover');
    this.analytics.track('island_upgraded', { island: id, size: this.state.islands[id].size, currency });
    this.ui.toast(`${ISLANDS[id].name} grew! More room for creatures.`, 'discovery');
    this.saveSoon();
    this.ui.rerender();
  }

  moveCreature(creatureId: string, to: IslandId): void {
    const r = A.moveCreature(this.state, creatureId, to, this.now());
    if (!r.ok) {
      this.audio.play('error');
      return this.ui.toast(r.error);
    }
    this.audio.play('place');
    this.ui.closeSheet();
    this.ui.toast(`Off it goes to ${ISLANDS[to].name}!`);
    this.saveSoon();
  }

  setTutorial(step: number): void {
    if (step <= this.state.tutorial) return;
    this.state.tutorial = step;
    this.analytics.track('ftue_step', { step });
    this.saveSoon();
  }

  placeLure(spot: string, lure: string): void {
    const r = A.placeLure(this.state, spot, lure, this.now());
    if (!r.ok) {
      this.audio.play('error');
      return this.ui.toast(r.error);
    }
    this.audio.play('place');
    this.analytics.track('lure_placed', { lure, spot, sky: activeEvent(this.state, this.now())?.kind ?? 'none' });
    this.ui.toast(`You set out a ${LURES[lure].name}. Now… wait and see.`);
    if (this.state.tutorial === 0) this.setTutorial(1);
    this.ui.closeSheet();
    this.world.focus(SPOTS[spot], 15);
    this.saveSoon();
  }

  combine(aId: string, bId: string): void {
    const r = A.startCombine(this.state, aId, bId, this.now());
    if (!r.ok) {
      this.audio.play('error');
      return this.ui.toast(r.error);
    }
    this.audio.play('egg');
    this.analytics.track('combine', { a: this.state.creatures.find((c) => c.id === aId)?.species ?? '', b: this.state.creatures.find((c) => c.id === bId)?.species ?? '' });
    if (this.state.tutorial < 4) this.setTutorial(4);
    this.ui.closeSheet();
    const nest = NESTS[r.egg.nest ?? 0];
    this.world.focus(nest, 12);
    this.world.burstAt(nest.x, this.world.groundAt(nest.x, nest.z) + 0.8, nest.z, '#bff4ff', 24);
    this.ui.toast('A new egg settles into a warm nest. What could be inside?', 'discovery');
    for (const n of r.notes) this.ui.toast(`📝 Journal: ${n}`);
    this.notifications.schedule(`egg-${r.egg.id}`, this.now() + r.egg.incubationMs, 'Something is moving inside an egg…', 'Come see what hatches.');
    this.saveSoon();
  }

  hatch(eggId: string): void {
    const egg = this.state.eggs.find((e) => e.id === eggId);
    if (!egg) return;
    const nestIdx = egg.nest ?? 0;
    const eggCopy = { ...egg, mutations: [...egg.mutations] };
    const r = A.hatch(this.state, eggId, this.now());
    if (!r.ok) {
      this.audio.play('error');
      return this.ui.toast(r.error);
    }
    this.ui.closeSheet();
    this.ui.hideHud(true);
    this.analytics.track('egg_hatched', { species: r.creature.species, new: r.newSpecies, hybrid: r.hybrid, mutations: r.creature.mutations.join(',') });
    const view = this.ui.showReveal(r.creature, r.newSpecies, r.newMutations, () => {
      this.world.endReveal();
      this.ui.hideHud(false);
      const n = NESTS[nestIdx];
      if (this.world.current !== 'home') this.world.travelTo('home', true);
      this.world.focus(n, 11);
      setTimeout(() => {
        const pos = this.world.creaturePosition(r.creature.id);
        pos?.set(n.x, 0, n.z + 1.4);
        this.world.emote(r.creature.id, r.newSpecies ? '✨' : '💕');
        this.world.noteCreature(r.creature.id, 'Just hatched 🐣');
        this.ui.selectCreature(r.creature.id);
      }, 50);
      for (const note of r.notes) this.ui.toast(`📝 Journal: ${note}`, 'info', undefined, 5000);
      this.saveSoon();
    });
    this.world.startReveal(eggCopy, r.creature, (p) => {
      if (p === 'burst') this.audio.play(r.newSpecies ? 'discover' : 'hatch');
      view.phase(p);
    });
    this.audio.play('crack');
    if (species(r.creature.species).origin === 'hybrid' && r.newSpecies) this.analytics.track('hybrid_discovered', { species: r.creature.species });
    this.saveSoon();
  }

  async adHatch(eggId: string): Promise<void> {
    this.analytics.track('ad_offer_accepted', { placement: 'egg_hatch' });
    const ok = await this.ads.showRewarded('egg_hatch');
    if (!ok) return;
    const r = A.adHatch(this.state, eggId, this.now());
    if (!r.ok) return this.ui.toast(r.error);
    this.analytics.track('ad_rewarded', { placement: 'egg_hatch' });
    this.ui.rerender();
    this.saveSoon();
  }

  /** Rewarded ad → a random sky event starts right now. */
  async adSummon(): Promise<boolean> {
    if (activeEvent(this.state, this.now())) {
      this.ui.toast('The sky is already busy. Try again when this event passes.');
      return false;
    }
    this.analytics.track('ad_offer_accepted', { placement: 'summon_event' });
    const ok = await this.ads.showRewarded('summon_event');
    if (!ok) return false;
    const r = A.summonEvent(this.state, this.now());
    if (!r.ok) {
      this.ui.toast(r.error);
      return false;
    }
    this.analytics.track('ad_rewarded', { placement: 'summon_event', kind: r.kind });
    this.saveSoon();
    return true;
  }

  async adRefreshShop(): Promise<void> {
    if (A.adsLeft(this.state, this.now()) <= 0) return;
    const ok = await this.ads.showRewarded('shop_refresh');
    if (!ok) return;
    A.consumeAd(this.state, this.now());
    A.paidShopRefresh(this.state, this.now(), true);
    this.analytics.track('ad_rewarded', { placement: 'shop_refresh' });
    this.ui.rerender();
    this.saveSoon();
  }

  buy(offerId: string): void {
    const offer = this.state.shop.offers.find((o) => o.id === offerId);
    const r = A.buyOffer(this.state, offerId, this.now());
    if (!r.ok) {
      this.audio.play('error');
      return this.ui.toast(r.error);
    }
    this.audio.play('coin');
    this.analytics.track('shop_purchase', { kind: offer?.kind ?? '', ref: offer?.ref ?? '', currency: offer?.currency ?? '', price: offer?.price ?? 0 });
    this.ui.toast(r.message);
    this.ui.rerender();
    this.saveSoon();
  }

  async buyShards(productId: string): Promise<void> {
    this.analytics.track('iap_tapped', { product: productId });
    const r = await this.purchases.buy(productId);
    if (!r.ok) {
      this.ui.toast('Purchases arrive with the App Store and Google Play builds. Nothing was charged.');
      return;
    }
    this.state.shards += r.shards;
    this.saveSoon();
  }

  // ------------------------------------------------------------------ playtest tools

  skip(ms: number): void {
    this.state.clockOffset += ms;
    const events = tick(this.state, this.now(), { maxStepMs: TUNING.offlineStepSec * 1000 });
    this.dispatch(events, false);
    if (ms >= 30 * 60_000) this.ui.showAwayReport(events, ms);
    else this.ui.toast(`⏩ ${Math.round(ms / 60000)} minute${Math.round(ms / 60000) === 1 ? '' : 's'} passed.`);
  }

  skipToNextEvent(): void {
    const e = nextEvent(this.state, this.now());
    if (!e) return;
    this.state.clockOffset += e.start - this.now() + 1000;
    this.ui.closeSheet();
  }
}

