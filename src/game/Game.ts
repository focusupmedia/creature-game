import { species } from '../content/species';
import { EVENTS, LURES, MUTATIONS, SPOTS } from '../content/world';
import { NESTS } from '../content/layout';
import { TUNING } from '../content/tuning';
import * as A from '../core/actions';
import { displayName, speciesTitle } from '../core/creatures';
import { deserialize, serialize } from '../core/save';
import { tick } from '../core/sim';
import { createGame } from '../core/state';
import type { GameEvent, GameState } from '../core/types';
import { activeEvent, dayPhase, nextEvent } from '../core/world';
import { Audio } from '../platform/audio';
import {
  ConsoleAnalytics, ConsoleCrash, StubAds, StubPurchases, WebNotifications, WebStorage,
  type Ads, type Analytics, type Crash, type Notifications, type Purchases, type Storage,
} from '../platform/services';
import { World, type Pick } from '../render/World';
import { UI } from '../ui/UI';

const SAVE_KEY = 'kindred-grove.save.v1';
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

  constructor(container: HTMLElement) {
    this.state = this.load();
    this.world = new World(container);
    this.ui = new UI(this, container);
    this.ads = new StubAds((s) => this.ui.showAd(s));
    this.world.onTap = (p) => this.onTap(p);
    this.world.onFrame = (dt) => this.frame(dt);
    this.world.onRevealTap = () => this.audio.play('crack');
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: false });
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => this.save());
    window.addEventListener('error', (e) => this.crash.capture(e.error, 'window.onerror'));
    window.addEventListener('unhandledrejection', (e) => this.crash.capture(e.reason, 'unhandledrejection'));
  }

  start(): void {
    const away = this.now() - this.state.lastTick;
    const events = tick(this.state, this.now(), { maxStepMs: TUNING.offlineStepSec * 1000 });
    this.world.sync(this.state, dayPhase(this.state, this.now()), activeEvent(this.state, this.now())?.kind ?? null);
    if (away > AWAY_REPORT_MS) this.ui.showAwayReport(events, away);
    this.analytics.track('session_start', { creatures: this.state.creatures.length, away_min: Math.round(away / 60000) });
    this.world.start();
  }

  now(): number {
    return Date.now() + this.state.clockOffset;
  }

  // ------------------------------------------------------------------ persistence

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
    this.world.sync(this.state, phase, sky);
    this.world.sky.update(phase, sky, dt, performance.now() / 1000);
    this.audio.ambience(dt, this.world.sky.darkness, sky === 'storm');
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
        case 'strike':
          if (live) this.audio.play('thunder');
          break;
        case 'eventStart':
          this.analytics.track('sky_event', { kind: ev.kind });
          if (live) {
            this.ui.toast(ev.kind === 'storm' ? '⛈️ A thunderstorm rolls in. Things may change out there…' : '🌘 The sun is going dark. An eclipse!', 'discovery', undefined, 5000);
            if (ev.kind === 'storm') this.audio.play('thunder'); else this.audio.play('chime');
          }
          break;
        case 'eventEnd':
          if (live) this.ui.toast(ev.kind === 'storm' ? 'The storm passes. The air smells clean.' : 'The light returns.');
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
        case 'shopRefresh':
          if (live) this.ui.toast('🛍️ The merchant has new wares.');
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
      case 'gift': {
        const r = A.collectGift(this.state, p.id);
        if (r.ok) {
          this.audio.play('coin');
          this.ui.toast(`Picked up a little gift: ✨${r.glimmer}${r.shards ? ` and 💎${r.shards}` : ''}`, 'info', undefined, 1800);
          this.analytics.track('gift_collected', { glimmer: r.glimmer, shards: r.shards });
          this.saveSoon();
        }
      }
    }
  }

  // ------------------------------------------------------------------ actions

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
    this.world.burstAt(nest.x, 0.8, nest.z, '#bff4ff', 24);
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

