import { species } from '../content/species';
import { Capacitor } from '@capacitor/core';
import { AdMobAds, StorePurchases } from '../platform/nativeServices';
import { DECOR, DIG_KINDS, EVENTS, ITEMS, LEGENDARY, LURES, MUTATIONS, SPOTS } from '../content/world';
import { claimBlessing, startLegendary } from '../core/legendary';
import { addXp, grantMissingLevelCreatures, payOwedLevels } from '../core/levels';
import { petCreature, playWith } from '../core/friendship';
import { claimExpedition, sendOnExpedition } from '../core/expeditions';
import { canClaimLogin, claimLogin } from '../core/login';
import { claimCollection } from '../core/collections';
import { claimContest, enterContest } from '../core/contests';
import { planNotifications } from '../core/notify';
import { voiceOf } from '../render/voices';
import { EXPEDITIONS, type ExpeditionId } from '../content/expeditions';
import { claimDaily, claimLasting, questEvent, refreshDailies } from '../core/quests';
import { claimStarter, starterEvent, starterStep } from '../core/starter';
import { RUMOUR_REWARD, checkRumour, rumourText, todaysRumour } from '../core/rumours';
import { awayFinds, bulkRelease, bulkRetrieve, bulkSell, bulkStore, buyStorageSlot, findVisitor, keepVisitor, releaseCreature, sendAwayVisitor, feastIsland, feedCreature, hangFeedbag, feedSprout, harvestTree, retrieveCreature, sellCreature, storeCreature } from '../core/care';
import { islandCapacity } from '../core/sim';
import { xpFor, type PlayEvent } from '../core/progress';
import { addCandy, candyFor, markCandy, unlockPass } from '../core/pass';
import { ISLANDS, islandGeo } from '../content/islands';
import { WANDERERS } from '../content/wanderers';
import { dismissWanderer, meetWanderer, takeDeal } from '../core/wanderers';
import { StateRng } from '../core/rng';
import { refreshShop } from '../core/shop';
import { fillWant } from '../core/market';
import { fillAwayChest, openAwayChest, welcomeBackGift } from '../core/away';
import { decideSync, summarize, type CloudBlob } from '../core/cloud';
import { createCloudSave, deviceName, TestCloudSave, type CloudSave, type CloudStatus } from '../platform/cloudSave';
import { TUNING } from '../content/tuning';
import * as A from '../core/actions';
import { displayName, speciesTitle } from '../core/creatures';
import { deserialize, serialize } from '../core/save';
import { tick } from '../core/sim';
import { createGame, newSaveId } from '../core/state';
import type { GameEvent, GameState, IslandId, LegendaryKind, MutationId } from '../core/types';
import { activeEvent, dayPhase, nextEvent } from '../core/world';
import { Audio } from '../platform/audio';
import {
  ConsoleAnalytics, ConsoleCrash, StubAds, StubPurchases, WebNotifications, WebStorage,
  type Ads, type Analytics, type Crash, type Notifications, type Purchases, type Storage,
} from '../platform/services';
import { World, type CarryTarget, type Pick } from '../render/World';
import { UI } from '../ui/UI';

const SAVE_KEY = 'kindred-grove.save.v1';
/** Set just before a reload that swapped in the cloud save, so we can say so afterwards. */
const CLOUD_LOADED_KEY = 'kindred-grove.cloud.loaded';
const CLOUD_EVERY_S = 300;
const SETTINGS_KEY = 'kindred-grove.settings';
const SPIN_HINT_KEY = 'kindred-grove.hint.globe';
const REMINDERS_KEY = 'kindred-grove.reminders';
const LIVE_TICK_S = 0.25;
const AWAY_REPORT_MS = 90_000;

export class Game {
  state: GameState;
  readonly world: World;
  readonly ui: UI;
  readonly audio = new Audio();
  readonly storage: Storage = new WebStorage();
  readonly analytics: Analytics = new ConsoleAnalytics();
  readonly purchases: Purchases = Capacitor.isNativePlatform() ? new StorePurchases() : new StubPurchases();
  readonly notifications: Notifications = new WebNotifications();
  readonly crash: Crash = new ConsoleCrash();
  readonly cloud: CloudSave = createCloudSave();
  cloudStatus: CloudStatus | null = null;
  /** When this session last saved to the cloud (for Settings). */
  cloudSavedAt = 0;
  /** The cloud holds a save from a newer version of the game: never overwrite it. */
  private cloudBlocked = false;
  private cloudBusy = false;
  private cloudAcc = 0;
  readonly ads: Ads;
  timeScale = 1;
  placing: ((x: number, z: number) => void) | null = null;
  private tickAcc = 0;
  private saveAcc = 0;
  private dirty = false;
  private hiddenAt = 0;
  /** A reload is on its way (cloud save swapped in): don't save over it. */
  private reloading = false;
  private digHints = 0;
  private questCheck = 0;

  constructor(container: HTMLElement) {
    this.state = this.load();
    this.loadSettings();
    this.world = new World(container);
    this.ui = new UI(this, container);
    this.ads = Capacitor.isNativePlatform() ? new AdMobAds() : new StubAds((s) => this.ui.showAd(s));
    this.world.onTap = (p) => this.onTap(p);
    this.world.onEdgePush = (id) => {
      if (this.state.islands[id]?.owned) this.travel(id);
      else this.ui.showIslands(id);
    };
    this.world.onFrame = (dt) => this.frame(dt);
    this.world.onRevealTap = () => this.audio.play('crack');
    this.world.onHoldDecor = (id) => {
      const d = this.state.placedDecor.find((x) => x.id === id);
      if (!d || this.placing) return;
      navigator.vibrate?.(20);
      this.ui.beginPlacement(d.decor, id);
    };
    this.world.onCarryStart = (id) => {
      this.audio.play('egg');
      const c = this.state.creatures.find((x) => x.id === id);
      if (c) this.audio.voice(voiceOf(c), c.size, 'alarm');
    };
    // creatures on screen pipe up now and then
    this.world.onVoice = (c) => this.audio.voice(voiceOf(c), c.size);
    this.world.onCreatureCollect = (giftId, by) => this.collectGift(giftId, by);
    this.world.onDigFound = (giftId, by) => this.collectGift(giftId, by, true);
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
    this.dispatch(events, false);
    this.offerLogin();
    // older saves: hand over any level-only creatures the keeper already earned
    if (grantMissingLevelCreatures(this.state, this.now()).length) this.saveSoon();
    const owed = payOwedLevels(this.state, this.now());
    if (owed.length) {
      this.ui.toast(`★ Levels ${owed[0].level}-${owed[owed.length - 1].level} rewards: {coin} +${owed.reduce((n, u) => n + u.coins, 0).toLocaleString()}  {gem} +${owed.reduce((n, u) => n + u.shards, 0)}`, 'discovery', undefined, 6000);
      this.saveSoon();
    }
    this.welcomeBack(events, away);
    // just restarted on the cloud save?
    const fromCloud = this.storage.load(CLOUD_LOADED_KEY);
    if (fromCloud) {
      this.storage.remove(CLOUD_LOADED_KEY);
      setTimeout(() => this.ui.toast(`☁️ Welcome back! Your level ${fromCloud} save is loaded.`, 'discovery', undefined, 5000, { priority: 3 }), 600);
    }
    // see what's in the cloud (signs in automatically on phones)
    setTimeout(() => void this.cloudSync(), 1500);
    this.analytics.track('session_start', { creatures: this.state.creatures.length, away_min: Math.round(away / 60000) });
    this.world.start();
    if (!this.storage.load(SPIN_HINT_KEY)) {
      this.storage.save(SPIN_HINT_KEY, '1');
      setTimeout(() => this.ui.showControls(), 2500);
    }
  }

  now(): number {
    return Date.now() + this.state.clockOffset;
  }

  // ------------------------------------------------------------------ persistence

  /** Device settings (sound, music) live outside the save so "Start over" keeps them. */
  private loadSettings(): void {
    try {
      const s = JSON.parse(this.storage.load(SETTINGS_KEY) ?? '{}') as { sound?: boolean; music?: boolean; soundVol?: number; musicVol?: number; signs?: number };
      if (typeof s.signs === 'number') this.signRange = s.signs;
      if (s.sound === false) this.audio.enabled = false;
      if (s.music === false) this.audio.musicEnabled = false;
      if (typeof s.soundVol === 'number') this.audio.soundVolume = s.soundVol;
      if (typeof s.musicVol === 'number') this.audio.musicVolume = s.musicVol;
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

  setVolume(which: 'sound' | 'music', v: number): void {
    this.audio.unlock();
    if (which === 'sound') this.audio.setSoundVolume(v);
    else this.audio.setMusicVolume(v);
    this.saveSettings();
  }

  private saveSettings(): void {
    this.storage.save(SETTINGS_KEY, JSON.stringify({ sound: this.audio.enabled, music: this.audio.musicEnabled, soundVol: this.audio.soundVolume, musicVol: this.audio.musicVolume, signs: this.signRange }));
  }

  /** How far away the Shop and Sell signs show (0-1; 1 = always). */
  signRange = 0.5;
  /** Visitors the keeper has already tapped: their bright highlight goes away. */
  seenVisitors = new Set<string>();

  setSignRange(v: number): void {
    this.signRange = Math.max(0, Math.min(1, v));
    this.saveSettings();
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
    if (this.reloading) return;
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

  // ------------------------------------------------------------------ cloud save

  /** Compare this device's save with the cloud copy and do the right thing (see core/cloud.ts). */
  async cloudSync(manual = false): Promise<void> {
    if (this.cloudBusy) return;
    this.cloudBusy = true;
    try {
      this.cloudStatus = await this.cloud.status();
      if (!this.cloudStatus.available || !this.cloudStatus.signedIn) {
        if (manual) this.ui.fail(`Sign in to ${this.cloudStatus.service} to save to the cloud.`);
        return;
      }
      const blob = await this.cloud.load();
      this.save();
      const local = summarize(this.state, deviceName());
      const d = decideSync(local, this.state.cloud?.syncedAt, blob?.summary ?? null);
      switch (d.kind) {
        case 'update-needed':
          this.cloudBlocked = true;
          this.ui.toast('Your cloud save comes from a newer version of Pocket Grove. Update the game to load it.', 'info', undefined, 6000, { priority: 3 });
          break;
        case 'download':
          if (d.quiet) this.useCloudSave(blob!);
          else this.ui.showSaveChoice(local, blob!.summary, (pick) => (pick === 'cloud' ? this.useCloudSave(blob!) : void this.cloudUpload(true)), true);
          break;
        case 'ask':
          this.ui.showSaveChoice(local, blob!.summary, (pick) => (pick === 'cloud' ? this.useCloudSave(blob!) : void this.cloudUpload(true)), false);
          break;
        case 'upload':
          this.cloudBusy = false;
          await this.cloudUpload(manual);
          break;
        default:
          if (manual) this.ui.toast(`☁️ Your save in ${this.cloudStatus.service} is up to date.`, 'info', undefined, 3000, { priority: 3 });
      }
    } catch (e) {
      this.crash.capture(e, 'cloudSync');
      if (manual) this.ui.fail('Couldn\'t reach the cloud just now. Your game is safe on this device.');
    } finally {
      this.cloudBusy = false;
    }
  }

  /** Put this device's save in the cloud. */
  async cloudUpload(manual = false): Promise<boolean> {
    if (this.cloudBlocked || this.cloudBusy || this.reloading) return false;
    if (!this.cloudStatus?.signedIn) {
      if (manual) await this.cloudSync(true);
      return false;
    }
    this.cloudBusy = true;
    try {
      const t = this.now();
      this.state.cloud ??= { saveId: newSaveId(this.state.seed, this.state.createdAt) };
      const before = this.state.cloud.syncedAt;
      // stamp the sync time into the copy we send, so both sides agree on it
      this.state.cloud.syncedAt = t;
      const data = serialize(this.state, t);
      const ok = await this.cloud.save({ data, summary: summarize(this.state, deviceName()) });
      if (!ok) {
        this.state.cloud.syncedAt = before;
        if (manual) this.ui.fail('Couldn\'t save to the cloud just now. Your game is safe on this device.');
        return false;
      }
      this.storage.save(SAVE_KEY, data);
      this.cloudSavedAt = t;
      if (manual) this.ui.toast(`☁️ Saved to ${this.cloudStatus.service}.`, 'info', undefined, 3000, { priority: 3 });
      return true;
    } catch (e) {
      this.crash.capture(e, 'cloudUpload');
      if (manual) this.ui.fail('Couldn\'t save to the cloud just now. Your game is safe on this device.');
      return false;
    } finally {
      this.cloudBusy = false;
    }
  }

  /** Link Game Center / Google Play Games from Settings, then sync. */
  async cloudSignIn(): Promise<void> {
    const ok = await this.cloud.signIn();
    this.cloudStatus = await this.cloud.status();
    this.ui.rerender();
    if (!ok) return this.ui.fail(`Couldn't sign in to ${this.cloudStatus.service}. You can try again any time.`);
    await this.cloudSync(true);
    this.ui.rerender();
  }

  /** Swap in the cloud save: keep a backup of this one, store the cloud copy, and restart on it. */
  private useCloudSave(blob: CloudBlob): void {
    try {
      deserialize(blob.data); // make sure it loads before replacing anything
    } catch (e) {
      this.crash.capture(e, 'cloudLoad');
      this.ui.fail('That cloud save couldn\'t be opened. Your game on this device is unchanged.');
      return;
    }
    this.save();
    const mine = this.storage.load(SAVE_KEY);
    if (mine) this.storage.save(`${SAVE_KEY}.before-cloud`, mine);
    const st = deserialize(blob.data);
    st.cloud = { saveId: blob.summary.saveId, syncedAt: blob.summary.savedAt };
    this.storage.save(SAVE_KEY, JSON.stringify(st));
    this.storage.save(CLOUD_LOADED_KEY, String(blob.summary.level));
    this.reloading = true;
    location.reload();
  }

  /** Playtest tool: pretend another phone kept playing this game and saved to the cloud. */
  simulateOtherDevice(): void {
    if (!(this.cloud instanceof TestCloudSave)) return;
    const st = deserialize(serialize(this.state, this.now()));
    st.glimmer += 5000;
    st.xp += 3000;
    const t = this.now() + 60_000;
    const data = serialize(st, t);
    this.cloud.write({ data, summary: { ...summarize(st, 'Another phone'), savedAt: t } });
    this.ui.toast('Another (pretend) phone saved to the test cloud. Play a little, then tap "Check now".', 'info', undefined, 5000, { priority: 3 });
  }

  reset(): void {
    this.storage.remove(SAVE_KEY);
    location.reload();
  }

  private onVisibility(): void {
    if (document.hidden) {
      this.hiddenAt = this.now();
      this.save();
      void this.cloudUpload();
      this.scheduleNotifications();
    } else if (this.hiddenAt) {
      const away = this.now() - this.hiddenAt;
      this.hiddenAt = 0;
      const events = tick(this.state, this.now(), { maxStepMs: TUNING.offlineStepSec * 1000 });
      this.dispatch(events, false);
      this.welcomeBack(events, away);
      this.offerLogin();
      // another device may have played while we were away
      if (away > 60_000) void this.cloudSync();
    }
  }

  /** The day's login gift pops up the first time you open the game each day (after the tutorial). */
  offerLogin(): void {
    if (this.state.tutorial < 6 || !canClaimLogin(this.state, this.now())) return;
    setTimeout(() => this.ui.showLoginCalendar(), 900);
  }

  claimCollection(id: string): void {
    const r = claimCollection(this.state, id, this.now());
    if (!r.ok) return this.ui.fail(r.error);
    this.audio.play('fanfare');
    this.ui.toast(`🏅 ${r.def.name} complete! {coin} +${r.def.reward.coins.toLocaleString()}  {gem} +${r.def.reward.shards}`, 'discovery', undefined, 5000);
    this.analytics.track('collection_claimed', { id });
    this.ui.rerender();
    this.saveSoon();
  }

  enterContest(id: string): void {
    const r = enterContest(this.state, id, this.now());
    if (!this.careResult(r.ok ? { ok: true, message: r.message } : r, 'chime')) return;
    this.analytics.track('contest_entered', { score: r.ok ? r.score : 0 });
  }

  claimContest(): void {
    const r = claimContest(this.state, this.now());
    if (!r.ok) return this.ui.fail(r.error);
    this.audio.play(r.place <= 3 ? 'fanfare' : 'coin');
    this.ui.toast(`${r.place === 1 ? '🏆 First place!' : r.place <= 3 ? `🏅 Place ${r.place}!` : `Thanks for entering!`} {coin} +${r.coins}  {gem} +${r.shards}`, 'discovery', undefined, 5000);
    this.analytics.track('contest_claimed', { place: r.place });
    this.ui.rerender();
    this.saveSoon();
  }

  claimLogin(): void {
    const r = claimLogin(this.state, this.now());
    if (!r.ok) return this.ui.fail(r.error);
    this.audio.play(r.reward.day === 7 ? 'fanfare' : 'coin');
    this.ui.toast(`Day ${r.reward.day} gift: ${r.reward.text}!`, 'discovery', undefined, 4000);
    this.analytics.track('login_claimed', { day: r.reward.day });
    this.saveSoon();
  }

  /** Gentle reminders while you're away: at most a couple, never at night, and only if you want them. */
  private scheduledNotes: string[] = [];
  private scheduleNotifications(): void {
    for (const id of this.scheduledNotes) this.notifications.cancel(id);
    this.scheduledNotes = [];
    if (this.storage.load(REMINDERS_KEY) === 'off') return;
    for (const n of planNotifications(this.state, this.now())) {
      this.notifications.schedule(n.id, n.at, n.title, n.body);
      this.scheduledNotes.push(n.id);
    }
  }

  get remindersOn(): boolean {
    return this.storage.load(REMINDERS_KEY) !== 'off';
  }

  setReminders(on: boolean): void {
    this.storage.save(REMINDERS_KEY, on ? 'on' : 'off');
    if (!on) for (const id of this.scheduledNotes) this.notifications.cancel(id);
  }

  // ------------------------------------------------------------------ loop

  private frame(dt: number): void {
    if (this.timeScale !== 1) this.state.clockOffset += dt * (this.timeScale - 1) * 1000;
    this.tickAcc += dt;
    if (this.tickAcc >= LIVE_TICK_S && !this.world.revealing) {
      this.tickAcc = 0;
      const events = tick(this.state, this.now(), { maxStepMs: 1000, live: true, here: this.world.current });
      if (events.length) this.dispatch(events, true);
    }
    const t = this.now();
    if (this.questCheck-- <= 0) {
      this.questCheck = 60;
      refreshDailies(this.state, t);
      this.tellRumour(t);
    }
    const sky = activeEvent(this.state, t)?.kind ?? null;
    const phase = dayPhase(this.state, t);
    this.world.sync(this.state, t, sky);
    this.world.sky.center.copy(this.world.rig.center);
    this.world.sky.update(phase, sky, dt, performance.now() / 1000);
    const legend = this.state.legendary && t < this.state.legendary.end ? this.state.legendary.kind : null;
    this.audio.ambience(dt, this.world.sky.darkness, sky, legend, this.world.current);
    this.ui.update(dt);
    this.cloudAcc += dt;
    if (this.cloudAcc > CLOUD_EVERY_S) {
      this.cloudAcc = 0;
      void this.cloudUpload();
    }
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
          if (live) this.record({ kind: 'arrival', species: ev.creature.species, isNew: ev.discovered });
          this.analytics.track('creature_arrived', { species: ev.creature.species, spot: ev.spot, mutations: ev.creature.mutations.length, new: ev.discovered });
          // the tutorial moves on even if the first visitor came while you were away
          if (!live) {
            if (this.state.tutorial <= 1) this.setTutorial(2);
            break;
          }
          const pic = this.world.portraits.of(ev.creature);
          const where = SPOTS[ev.spot].island === this.world.current ? `the ${SPOTS[ev.spot].name}` : ISLANDS[SPOTS[ev.spot].island].name;
          if (ev.discovered) {
            this.audio.play('discover');
            this.ui.toast(`New discovery: ${speciesTitle(ev.creature)}! It's waiting at ${where}.`, 'discovery', pic, 5000, { action: { label: 'Go', run: () => this.goToVisitor(ev.creature.id) } });
          } else {
            this.audio.play('arrive');
            this.ui.toast(`A ${speciesTitle(ev.creature)} is waiting at ${where}!`, 'info', pic, 3600, { action: { label: 'Go', run: () => this.goToVisitor(ev.creature.id) } });
          }
          if (this.state.tutorial <= 1) {
            this.setTutorial(2);
            this.world.focus(SPOTS[ev.spot], 15, SPOTS[ev.spot].island);
            // then follow the visitor itself so its ! is on screen
            setTimeout(() => { const at = this.world.creaturePosition(ev.creature.id); if (at) this.world.focus({ x: at.x, z: at.z }, 15, SPOTS[ev.spot].island); }, 1200);
          }
          break;
        }
        case 'wanderer': {
          if (!live) break;
          const def = WANDERERS[ev.wanderer.kind];
          const away = ev.wanderer.island !== this.world.current;
          this.audio.play(ev.wanderer.kind === 'goblin' ? 'error' : 'arrive');
          this.ui.toast(away ? `${def.name} is visiting ${ISLANDS[ev.wanderer.island].name}!` : def.arrive, ev.wanderer.kind === 'goblin' ? 'info' : 'discovery', undefined, 4500);
          break;
        }
        case 'wandererLeft':
          if (live) this.ui.toast(`${WANDERERS[ev.kind].name} went on their way.`);
          break;
        case 'goblin':
          if (!live) break;
          this.audio.play('error');
          this.ui.toast(ev.did === 'coins' ? `The Goblin pinched {coin} ${ev.coins} and ran off! Tap him quicker next time.`
            : ev.did === 'lure' ? `The Goblin spoiled your lure at the ${SPOTS[ev.spot!].name}! Tap him quicker next time.`
              : 'The Goblin found nothing worth taking and slunk off.', 'info', undefined, 5000);
          break;
        case 'expeditionBack': {
          if (!live) break;
          const c = this.state.creatures.find((x) => x.id === ev.creatureId);
          const def = EXPEDITIONS[ev.dest as ExpeditionId];
          if (c && def) {
            this.audio.play('chime');
            this.ui.toast(`${displayName(c)} is back from the ${def.name}! Welcome them home in Pets → Trips.`, 'discovery', this.world.portraits.of(c), 5000);
          }
          break;
        }
        case 'visitorLeft':
          if (live) this.ui.toast(`${speciesTitle(ev.creature)} got tired of waiting and wandered off.`, 'info', this.world.portraits.of(ev.creature));
          break;
        case 'mutation': {
          this.analytics.track('mutation_gained', { mutation: ev.mutation, cause: ev.cause, new: ev.discovered });
          markCandy(this.state, ev.cause, this.now());
          if (!live) break;
          this.audio.play('chime');
          const pic = this.world.portraits.of(ev.creature);
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
        case 'nurseryEgg':
          if (live) this.ui.toast(`🪺 The Nursery on ${ISLANDS[ev.island].name} made a new egg! What could be inside?`, 'discovery');
          break;
        case 'totemDone':
          if (live) this.ui.toast(`✨ Your ${DECOR[ev.decor]?.name ?? 'totem'} on ${ISLANDS[ev.island].name} has used up its magic and crumbled away.`);
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
        case 'legendary': {
          this.analytics.track('legendary_event', { kind: ev.kind, creature: ev.creature?.species ?? '' });
          if (!live) break;
          const def = LEGENDARY[ev.kind];
          this.audio.play('fanfare');
          this.ui.legendaryOverlay(ev.kind);
          this.world.legendaryStart(ev.kind, def.island);
          const where = def.island && def.island !== this.world.current ? ` (at ${ISLANDS[def.island].name})` : '';
          this.ui.toast(`${def.icon} ${def.arrive}${where}`, 'discovery', undefined, 6000);
          if (ev.creature) {
            const pic = this.world.portraits.of(ev.creature);
            const who = ev.creature.nickname ?? `Your ${species(ev.creature.species).name}`;
            setTimeout(() => this.ui.toast(`${who} became ${MUTATIONS[def.mutation].name}!${ev.discovered ? ' A legendary change!' : ''}`, 'discovery', pic, 6000), 3500);
          }
          setTimeout(() => this.ui.toast('🎁 A gift was left for you! Tap GIFT to choose a change for any creature.', 'discovery', undefined, 6000), 7000);
          break;
        }
        case 'legendaryEnd':
          // always clear the overlay, even if it ended while the app was in the background
          if (live) this.ui.toast(`${LEGENDARY[ev.kind].icon} ${LEGENDARY[ev.kind].leave}`);
          this.ui.legendaryOverlayEnd();
          this.world.legendaryEnd();
          break;
        case 'collector':
          if (live) this.ui.toast(`🎩 The Collector is visiting! He pays double, and triple for ${ev.wants} creatures. Tap BUYER.`, 'discovery', undefined, 6000);
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
      case 'creature':
        if (findVisitor(this.state, p.id)) return this.ui.showVisitor(p.id);
        return this.ui.selectCreature(p.id);
      case 'spot': return this.ui.showSpot(p.id);
      case 'nest': return this.ui.showNest(p.id);
      case 'font': return this.ui.showFont();
      case 'shop': return this.ui.showShop();
      case 'booth': return this.ui.showSellBooth();
      case 'basket': return this.ui.showBasket();
      case 'decor': return this.state.placedDecor.find((d) => d.id === p.id)?.decor === 'nest' ? this.ui.showNest(p.id) : this.ui.showPlacedDecor(p.id);
      case 'island':
        if (this.state.islands[p.id]?.owned) return this.travel(p.id);
        return this.ui.showIslands(p.id);
      case 'dig': {
        const d = this.state.digSpots.find((x) => x.id === p.id);
        if (!d) return;
        const k = DIG_KINDS[d.kind];
        return this.ui.toast(`${k.icon} ${k.name}! Press and hold a creature, then drop it here.`);
      }
      case 'gift': return this.collectGift(p.id);
      case 'wanderer': return this.meetWanderer();
      case 'tree': return this.ui.confirmChop(p.island, p.index);
    }
  }

  /** Pick up a find, by tapping it or because a Greedy creature fetched it. */
  collectGift(giftId: string, by?: string, dug = false): void {
    const found = this.state.gifts.find((x) => x.id === giftId);
    const via = found?.via;
    const meteor = !!found?.meteor;
    const r = A.collectGift(this.state, giftId, this.now());
    if (!r.ok) return;
    this.audio.play('coin');
    const extra = r.item === 'egg' ? ' …and a whole egg! It\'s in your basket.'
      : r.item ? ` …and a ${ITEMS[r.item]?.name ?? 'curiosity'}!` : '';
    const who = by ? this.state.creatures.find((c) => c.id === by) : undefined;
    const verb = via ? DIG_KINDS[via].verb.toLowerCase() : 'dug up';
    this.ui.toast(`${who ? `${displayName(who)} ${dug ? verb : 'grabbed'}` : meteor ? 'Starshard rock' : via ? DIG_KINDS[via].verb : 'Dug up'}: {coin} ${r.glimmer}${r.shards ? ` and {gem} ${r.shards}` : ''}${extra}`, r.item ? 'discovery' : 'info', undefined, r.item ? 4000 : 1800);
    this.record({ kind: 'gift', glimmer: r.glimmer, shards: r.shards, byCreature: !!by && !dug });
    this.analytics.track('gift_collected', { glimmer: r.glimmer, shards: r.shards, item: r.item ?? '', by: by ? 'creature' : 'player' });
    this.saveSoon();
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
      return this.ui.fail(r.error);
    }
    this.world.handle({ type: 'gift', gift: r.gift, t: this.now() }, true);
    this.record({ kind: 'digSpot' });
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

  buyIsland(id: IslandId): void {
    const r = A.buyIsland(this.state, id);
    if (!r.ok) {
      return this.ui.fail(r.error);
    }
    this.audio.play('discover');
    this.analytics.track('island_bought', { island: id });
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
      return this.ui.fail(r.error);
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
      return this.ui.fail(r.error);
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
      return this.ui.fail(r.error);
    }
    this.audio.play('place');
    this.analytics.track('lure_placed', { lure, spot, sky: activeEvent(this.state, this.now())?.kind ?? 'none' });
    this.record({ kind: 'lure' });
    this.ui.toast(`You set out a ${LURES[lure].name}. Now… wait and see.`);
    if (this.state.tutorial === 0) this.setTutorial(1);
    this.ui.closeSheet();
    this.world.focus(SPOTS[spot], 15, SPOTS[spot].island);
    this.saveSoon();
  }

  combine(aId: string, bId: string): void {
    const r = A.startCombine(this.state, aId, bId, this.now(), this.world.current);
    if (!r.ok) {
      return this.ui.fail(r.error);
    }
    this.audio.play('egg');
    this.record({ kind: 'breed' });
    this.analytics.track('combine', { a: this.state.creatures.find((c) => c.id === aId)?.species ?? '', b: this.state.creatures.find((c) => c.id === bId)?.species ?? '' });
    if (this.state.tutorial < 4) this.setTutorial(4);
    this.ui.closeSheet();
    const nest = this.state.placedDecor.find((d) => d.id === r.egg.nest);
    const where = nest?.island ?? 'home';
    if (nest && where === this.world.current) {
      this.world.focus(nest, 12, where);
      this.world.burst(this.world.at(nest.x, nest.z, 0.8, where), '#bff4ff', 24);
      this.ui.toast('A new egg settles into a warm nest. What could be inside?', 'discovery');
    } else {
      // every nest here is busy: it went to a free one on another world
      this.ui.toast(`This world's nests are busy, so the egg went to a nest on ${ISLANDS[where].name}.`, 'discovery');
    }
    for (const n of r.notes) this.ui.toast(`📝 Journal: ${n}`);
    this.saveSoon();
  }

  /** Hatch onto the world you're on (or another world, or straight into storage when it's full). */
  hatch(eggId: string, to: IslandId = this.world.current, toStorage = false): void {
    const egg = this.state.eggs.find((e) => e.id === eggId);
    if (!egg) return;
    const eggCopy = { ...egg, mutations: [...egg.mutations] };
    const r = A.hatch(this.state, eggId, this.now(), to, toStorage);
    if (!r.ok) {
      this.audio.play('error');
      // a full world: offer to make space, send the baby to another world, or keep it in storage
      if (r.error.includes('is full')) {
        return this.ui.showMakeSpace(to, () => this.hatch(eggId, to), (other) => this.hatch(eggId, other), () => this.hatch(eggId, to, true));
      }
      return this.ui.fail(r.error);
    }
    this.ui.closeSheet();
    this.ui.hideHud(true);
    const hatched = { kind: 'hatch' as const, species: r.creature.species, newSpecies: r.newSpecies, newMutations: r.newMutations.length, mutated: r.creature.mutations.length > 0 };
    this.analytics.track('egg_hatched', { species: r.creature.species, new: r.newSpecies, hybrid: r.hybrid, mutations: r.creature.mutations.join(',') });
    const view = this.ui.showReveal(r.creature, r.newSpecies, r.newMutations, () => {
      this.world.endReveal();
      this.ui.hideHud(false);
      this.record(hatched);
      if (toStorage) {
        this.ui.toast(`${displayName(r.creature)} is resting in storage. Bring it out from Pets whenever you like.`);
        for (const note of r.notes) this.ui.toast(`📝 Journal: ${note}`, 'info', undefined, 5000);
        this.saveSoon();
        return;
      }
      // the baby appears beside its nest if the nest is on this world, otherwise in the middle
      const nest = this.state.placedDecor.find((d) => d.id === eggCopy.nest);
      const geo = islandGeo(to);
      const n = nest && (nest.island ?? 'home') === to ? nest : { x: geo.ox, z: geo.oz + 1 };
      if (this.world.current !== to) this.world.travelTo(to, true);
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
    if (!r.ok) return this.ui.fail(r.error);
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
      this.ui.fail(r.error);
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
    this.ui.seenShopRotation = this.state.shop.rotation;
    this.analytics.track('ad_rewarded', { placement: 'shop_refresh' });
    this.ui.rerender();
    this.saveSoon();
  }

  /** Watch an ad for free coins (shop coins tab). */
  async adCoins(): Promise<void> {
    if (A.coinAdsLeft(this.state, this.now()) <= 0) return;
    const ok = await this.ads.showRewarded('free_coins');
    if (!ok) return;
    const r = A.claimCoinAd(this.state, this.now());
    if (!r.ok) return this.ui.fail(r.error);
    this.audio.play('coin');
    this.ui.toast(`{coin} +${r.coins} free coins. Thanks for watching!`, 'discovery');
    this.analytics.track('ad_rewarded', { placement: 'free_coins', coins: r.coins });
    this.ui.rerender();
    this.saveSoon();
  }

  buyDecor(id: string): void {
    const r = A.buyDecor(this.state, id);
    if (!r.ok) {
      return this.ui.fail(r.error);
    }
    this.audio.play('coin');
    this.analytics.track('decor_bought', { decor: id });
    this.ui.toast(r.message, 'info', undefined, 3200, { priority: 3 });
    this.ui.rerender();
    this.saveSoon();
  }

  buy(offerId: string): void {
    const offer = this.state.shop.offers.find((o) => o.id === offerId);
    const r = A.buyOffer(this.state, offerId, this.now());
    if (!r.ok) {
      return this.ui.fail(r.error);
    }
    this.audio.play('coin');
    if (offer?.kind === 'egg') this.record({ kind: 'shopEgg' });
    this.analytics.track('shop_purchase', { kind: offer?.kind ?? '', ref: offer?.ref ?? '', currency: offer?.currency ?? '', price: offer?.price ?? 0 });
    this.ui.toast(r.message, 'info', undefined, 3200, { priority: 3 });
    this.ui.rerender();
    this.saveSoon();
  }

  /** Something the player did: earns XP (and later counts toward quests). */
  record(ev: PlayEvent): void {
    if ((ev.kind === 'hatch' && ev.newSpecies) || (ev.kind === 'arrival' && ev.isNew)) {
      if (checkRumour(this.state, ev.species, this.now())) {
        this.audio.play('discover');
        this.ui.toast(`🦎 You found today's rumour! {coin} +${RUMOUR_REWARD.coins} {gem} +${RUMOUR_REWARD.shards}`, 'discovery', undefined, 5000, { priority: 3 });
      }
    }
    questEvent(this.state, ev);
    if (this.state.tutorial >= 6) {
      const step = starterEvent(this.state, ev);
      if (step === 'done') { this.audio.play('discover'); this.ui.toast('🦎 Lotl\'s Quest complete! Claim your egg.', 'discovery', undefined, 4000, { priority: 3 }); }
      else if (step === 'step') { this.audio.play('coin'); this.ui.toast(`🦎 Nice! Next: ${starterStep(this.state)?.text ?? ''}`, 'info', undefined, 3500, { priority: 2 }); }
    }
    this.gainXp(xpFor(ev));
    addCandy(this.state, candyFor(ev), this.now());
  }

  /** Lotl's starter quest is finished: hand over Lotl's Egg. */
  claimStarter(): void {
    if (!claimStarter(this.state, this.now())) return;
    this.audio.play('discover');
    this.ui.toast('🥚 Lotl\'s Egg is warming! It holds a creature you\'ve never had.', 'discovery', undefined, 5000, { priority: 3 });
    this.saveSoon();
  }

  /** Once a day (after the tutorial) Lotl whispers a new rumour. */
  private tellRumour(t: number): void {
    if (this.state.tutorial < 6 || this.world.revealing) return;
    const r = todaysRumour(this.state, t);
    if (!r || r.told) return;
    r.told = true;
    this.ui.toast(`🦎 Lotl's rumour: ${rumourText(r.species)}`, 'info', undefined, 8000, { priority: 2, action: { label: 'Quests', run: () => this.ui.showQuests() } });
    this.saveSoon();
  }

  private gainXp(amount: number): void {
    const ups = addXp(this.state, amount, this.now());
    for (const up of ups) {
      this.analytics.track('level_up', { level: up.level });
      setTimeout(() => this.ui.showLevelUp(up), this.world.revealing ? 2500 : 400);
    }
    if (ups.length) this.saveSoon();
  }

  // ------------------------------------------------------------------ lure visitors

  /** Jump to a lure visitor (on whichever world) and say hello. */
  goToVisitor(id: string): void {
    const v = this.state.visitors.find((x) => x.creature.id === id);
    if (!v) return this.ui.toast('They have wandered off.');
    this.ui.closeSheet();
    if (this.world.current !== v.island) this.world.travelTo(v.island, true);
    const at = this.world.creaturePosition(id);
    this.world.focus(at ? { x: at.x, z: at.z } : SPOTS[v.spot], 10, v.island);
    setTimeout(() => this.world.onTap({ kind: 'creature', id }), 700);
  }

  /** Keep a lure visitor. If its world is full, offer to make space or send it elsewhere. */
  keepVisitor(id: string, island?: IslandId): void {
    const v = findVisitor(this.state, id);
    if (!v) return this.ui.toast('They have wandered off.');
    const to = island ?? v.island;
    const r = keepVisitor(this.state, id, islandCapacity(this.state, to), to);
    if (!r.ok && r.error === 'full') {
      this.audio.play('error');
      return this.ui.showMakeSpace(to, () => this.keepVisitor(id, to), (other) => this.keepVisitor(id, other));
    }
    if (this.careResult(r, 'chime')) {
      this.world.emote(id, '💕');
      this.analytics.track('visitor_kept', { species: v.creature.species });
      if (to !== this.world.current) this.ui.toast(`${displayName(v.creature)} is off to ${ISLANDS[to].name}.`);
    }
  }

  /** Chop down a scenery tree to make room for decorations. */
  chop(island: IslandId, index: number): void {
    const r = A.chopTree(this.state, island, index);
    if (!r.ok) return this.ui.fail(r.error);
    this.audio.play('place');
    this.ui.toast(`Timber! The tree came down and you sold the wood for {coin} ${r.coins}.`);
    this.analytics.track('tree_chopped', { island });
    this.saveSoon();
  }

  /** You tapped the wanderer: the Goblin runs for it; anyone else opens their menu. */
  meetWanderer(): void {
    const w = this.state.wanderer;
    if (!w) return;
    if (w.kind !== 'goblin') {
      this.audio.play('chime');
      // they wait while you browse
      w.until = Math.max(w.until, this.now() + 2 * 60_000);
      this.ui.showWanderer();
      this.analytics.track('wanderer_met', { kind: w.kind });
      return;
    }
    const r = meetWanderer(this.state, this.now(), new StateRng(this.state));
    if (!r.ok) return this.ui.fail(r.error);
    this.world.wandererLeaves(w, true);
    this.audio.play('coin');
    this.ui.toast(`{coin} ${r.message}`, 'discovery', undefined, 5500, { priority: 3 });
    this.analytics.track('wanderer_met', { kind: r.kind });
    this.saveSoon();
  }

  /** Take one of a wanderer's deals (from their menu). */
  takeDeal(dealId: string, petId?: string): void {
    const w = this.state.wanderer;
    if (!w) return;
    const r = takeDeal(this.state, dealId, this.now(), new StateRng(this.state), petId);
    if (!r.ok) {
      return this.ui.fail(r.error);
    }
    this.audio.play('coin');
    this.ui.toast(`${WANDERERS[w.kind].name}: ${r.message}`, 'discovery', undefined, 6000, { priority: 3 });
    this.analytics.track('wanderer_deal', { kind: w.kind, deal: dealId });
    this.record({ kind: 'deal' });
    this.ui.rerender();
    this.saveSoon();
  }

  /** Wave a friendly wanderer goodbye. */
  sayGoodbye(): void {
    const w = this.state.wanderer;
    if (!w) return;
    dismissWanderer(this.state, this.now(), new StateRng(this.state));
    this.world.wandererLeaves(w, false);
    this.ui.closeSheet();
    this.saveSoon();
  }

  sendAwayVisitor(id: string): void {
    const v = findVisitor(this.state, id);
    if (this.careResult(sendAwayVisitor(this.state, id), 'coin')) this.analytics.track('visitor_sent', { species: v?.creature.species ?? '' });
  }

  /** Say goodbye to a creature for good (favorites are protected). */
  release(id: string): boolean {
    return this.careResult(releaseCreature(this.state, id));
  }

  // ------------------------------------------------------------------ care

  private careResult(r: { ok: true; message: string } | { ok: false; error: string }, sfx: 'coin' | 'place' | 'chime' = 'place'): boolean {
    if (!r.ok) {
      this.audio.play('error');
      this.ui.fail(r.error);
      return false;
    }
    this.audio.play(sfx);
    this.ui.toast(r.message, 'info', undefined, 3200, { priority: 3 });
    this.ui.rerender();
    this.saveSoon();
    return true;
  }

  sendExploring(id: string, dest: ExpeditionId): void {
    const r = sendOnExpedition(this.state, id, dest, this.now());
    if (!this.careResult(r)) return;
    this.ui.closeSheet();
    this.analytics.track('expedition_sent', { dest });
  }

  /** A pet is back from exploring: collect what it found. */
  welcomeHome(id: string): void {
    const r = claimExpedition(this.state, id, this.now());
    if (!r.ok) return this.ui.fail(r.error);
    this.audio.play('discover');
    const c = this.state.creatures.find((x) => x.id === id);
    this.ui.showExpeditionHaul(c ?? null, r);
    this.record({ kind: 'trip' });
    this.analytics.track('expedition_claimed', { coins: r.coins, shards: r.shards, egg: r.egg });
    this.ui.rerender();
    this.saveSoon();
  }

  /** Pet or play with a creature to grow your friendship. */
  befriend(id: string, how: 'pet' | 'play'): void {
    const r = how === 'pet' ? petCreature(this.state, id, this.now()) : playWith(this.state, id, this.now());
    if (!r.ok) return this.ui.fail(r.error);
    this.audio.play(r.newHeart ? 'chime' : 'tap');
    const pet = this.state.creatures.find((x) => x.id === id);
    if (pet) this.audio.voice(voiceOf(pet), pet.size, 'happy');
    this.world.cheer(id, how === 'play' || r.newHeart);
    this.record({ kind: 'befriend' });
    this.ui.toast(r.message, r.newHeart ? 'discovery' : 'info', undefined, r.newHeart ? 4000 : 1800);
    this.analytics.track('befriend', { how, hearts: r.hearts });
    this.ui.rerender();
    this.saveSoon();
  }

  feed(id: string): void {
    if (this.careResult(feedCreature(this.state, id))) {
      this.world.emote(id, '😋');
      this.record({ kind: 'feed' });
      this.analytics.track('fed', { how: 'one' });
    }
  }

  /** A Sprout Snack: helps a little one grow up faster. */
  sprout(id: string): void {
    if (this.careResult(feedSprout(this.state, id, this.now()))) {
      this.world.emote(id, '🌿');
      this.analytics.track('fed', { how: 'sprout' });
    }
  }

  feast(island: IslandId = this.world.current): void {
    if (this.careResult(feastIsland(this.state, island), 'chime')) this.analytics.track('fed', { how: 'feast' });
  }

  hangBag(island: IslandId = this.world.current): void {
    this.careResult(hangFeedbag(this.state, island));
  }

  harvest(decorId: string): void {
    if (this.careResult(harvestTree(this.state, decorId, this.now()), 'coin')) this.ui.closeSheet();
  }

  store(id: string, keepSheet = false): boolean {
    const ok = this.careResult(storeCreature(this.state, id, this.now()));
    if (ok && !keepSheet) this.ui.closeSheet();
    return ok;
  }

  retrieve(id: string): void {
    const here = this.world.current;
    this.careResult(retrieveCreature(this.state, id, here, this.now(), islandCapacity(this.state, here)));
  }

  /** Pets → Select: do the same thing to everyone picked. */
  bulk(kind: 'sell' | 'release' | 'store' | 'retrieve', ids: string[]): void {
    const t = this.now();
    const here = this.world.current;
    const r = kind === 'sell' ? bulkSell(this.state, ids, t)
      : kind === 'release' ? bulkRelease(this.state, ids)
        : kind === 'store' ? bulkStore(this.state, ids, t)
          : bulkRetrieve(this.state, ids, here, t, islandCapacity(this.state, here));
    if (!r.done) {
      this.audio.play('error');
      this.ui.fail(r.reason ?? 'Nobody could do that.');
      return;
    }
    this.audio.play(kind === 'sell' ? 'coin' : 'place');
    const n = `${r.done} pet${r.done === 1 ? '' : 's'}`;
    const msg = kind === 'sell' ? `Sold ${n} for {coin} ${r.coins.toLocaleString()}!`
      : kind === 'release' ? `${n} wandered off into the wild.`
        : kind === 'store' ? `${n} resting in storage.` : `${n} back on ${ISLANDS[here].name}.`;
    this.ui.toast(`${msg}${r.skipped ? ` (${r.skipped} stayed: ${r.reason})` : ''}`, kind === 'sell' ? 'discovery' : 'info', undefined, 3800, { priority: 3 });
    if (kind === 'sell') {
      this.record({ kind: 'sold', coins: r.coins, count: r.done });
      this.analytics.track('sold_bulk', { count: r.done, coins: r.coins });
    }
    this.ui.clearPetSelection();
    this.ui.rerender();
    this.saveSoon();
  }

  bulkMove(ids: string[], to: IslandId): void {
    const r = A.bulkMove(this.state, ids, to, this.now());
    if (!r.done) {
      this.audio.play('error');
      this.ui.fail(r.reason ?? 'Nobody could move.');
      return;
    }
    this.audio.play('place');
    this.ui.toast(`${r.done} pet${r.done === 1 ? '' : 's'} off to ${ISLANDS[to].name}!${r.skipped ? ` (${r.skipped} stayed: ${r.reason})` : ''}`, 'info', undefined, 3800, { priority: 3 });
    this.ui.clearPetSelection();
    this.ui.rerender();
    this.saveSoon();
  }

  buySlot(): void {
    this.careResult(buyStorageSlot(this.state), 'coin');
  }

  sell(id: string): void {
    const c = this.state.creatures.find((x) => x.id === id);
    const before = this.state.glimmer;
    const r = sellCreature(this.state, id, this.now());
    if (this.careResult(r, 'coin')) {
      this.record({ kind: 'sold', coins: this.state.glimmer - before });
      this.ui.closeSheet();
      this.analytics.track('sold', { species: c?.species ?? '' });
    }
  }

  claimQuest(kind: 'daily' | 'lasting', id: string): void {
    const r = kind === 'daily' ? claimDaily(this.state, id) : claimLasting(this.state, id);
    if (!r.ok) return this.ui.fail(r.error);
    this.audio.play('chime');
    this.analytics.track('quest_claimed', { kind, id });
    this.ui.toast(`✅ ${r.text}: {coin} +${r.reward.coins}  {gem} +${r.reward.shards}  ★ +${r.reward.xp} XP`, 'discovery', undefined, 3600, { priority: 3 });
    this.gainXp(r.reward.xp);
    this.ui.rerender();
    this.saveSoon();
  }

  /** Buy a Starshard or coin pack. On the web playtest build nothing is charged. */
  async buyPack(productId: string): Promise<void> {
    this.analytics.track('iap_tapped', { product: productId });
    const r = await this.purchases.buy(productId);
    if (!r.ok || !r.product) return this.ui.toast('That purchase didn\'t go through. Nothing was charged.');
    const p = r.product;
    if (p.currency === 'pass') {
      const pet = unlockPass(this.state, this.now());
      this.audio.play('discover');
      this.ui.toast(`🎃 Halloween Pass unlocked!${pet ? ' Pumpkit has joined you!' : ''} Claim your rewards in the Pass.${r.test ? ' (test purchase, nothing was charged)' : ''}`, 'discovery', undefined, 4000, { priority: 3 });
      this.saveSoon();
      return this.ui.showPass();
    }
    if (p.currency === 'shards') this.state.shards += p.amount;
    else this.state.glimmer += p.amount;
    this.audio.play('coin');
    this.ui.toast(`${p.currency === 'shards' ? '{gem}' : '{coin}'} +${p.amount}${r.test ? ' (test purchase, nothing was charged)' : ''}`, 'discovery', undefined, 3600, { priority: 3 });
    this.saveSoon();
  }

  // ------------------------------------------------------------------ playtest tools

  skip(ms: number): void {
    this.state.clockOffset += ms;
    const events = tick(this.state, this.now(), { maxStepMs: TUNING.offlineStepSec * 1000 });
    this.dispatch(events, false);
    if (ms >= 30 * 60_000) this.welcomeBack(events, ms);
    else this.ui.toast(`⏩ ${Math.round(ms / 60000)} minute${Math.round(ms / 60000) === 1 ? '' : 's'} passed.`);
  }

  /** Sell to a buyer on the Market board. */
  fillWant(wantId: string, creatureId: string): void {
    const r = fillWant(this.state, wantId, creatureId, this.now());
    if (!r.ok) {
      return this.ui.fail(r.error);
    }
    this.audio.play('fanfare');
    this.ui.toast(`🛒 ${r.message} {coin} +${r.coins.toLocaleString()}  {gem} +${r.shards}`, 'discovery', undefined, 4500, { priority: 3 });
    this.record({ kind: 'sold', coins: r.coins });
    this.record({ kind: 'market' });
    this.analytics.track('market_sale', { coins: r.coins });
    this.ui.rerender();
    this.saveSoon();
  }

  /** Back after a while: presents from your pets, the away chest, and a gift after a day or more. */
  private welcomeBack(events: GameEvent[], away: number): void {
    if (away <= AWAY_REPORT_MS) return;
    const finds = awayFinds(this.state, away);
    fillAwayChest(this.state, away);
    const gift = welcomeBackGift(this.state, away, this.now());
    if (gift) this.analytics.track('welcome_back', { days: gift.days });
    this.ui.showAwayReport(events, away, finds, gift);
    this.saveSoon();
  }

  /** Open the away chest (an ad doubles it). */
  async openChest(double: boolean): Promise<boolean> {
    if (!this.state.awayChest) return false;
    if (double) {
      const ok = await this.ads.showRewarded('away_chest');
      if (!ok) return false;
      this.analytics.track('ad_rewarded', { placement: 'away_chest' });
    }
    const c = openAwayChest(this.state, double);
    if (!c) return false;
    this.audio.play('fanfare');
    const items = Object.entries(c.items).map(([id, n]) => `${n > 1 ? `${n} ` : ''}${id === 'snack' ? 'snacks' : ITEMS[id]?.name ?? id}`);
    this.ui.toast(`🎁 Away chest: {coin} +${c.coins.toLocaleString()}${c.shards ? `  {gem} +${c.shards}` : ''}${items.length ? ` and ${items.join(', ')}` : ''}!`, 'discovery', undefined, 5000, { priority: 3 });
    this.ui.rerender();
    this.saveSoon();
    return true;
  }

  /** Break a sky charm from the EVENT sheet. */
  breakCharm(id: string): void {
    const r = A.useCharm(this.state, id, this.now());
    if (!r.ok) {
      return this.ui.fail(r.error);
    }
    this.audio.play('chime');
    this.analytics.track('charm_used', { charm: id, kind: r.kind });
    this.saveSoon();
  }

  /** Playtest: start a legendary event now. Players can never summon these. */
  summonLegendary(kind: LegendaryKind): void {
    const def = LEGENDARY[kind];
    if (def.island && !this.state.islands[def.island]?.owned) return this.ui.toast(`You need ${ISLANDS[def.island].name} for that one.`);
    if (this.state.legendary) return this.ui.toast('A legendary event is already happening.');
    this.dispatch(startLegendary(this.state, kind, this.now()), true);
    this.saveSoon();
  }

  claimBlessing(creatureId: string, m: MutationId): void {
    const r = claimBlessing(this.state, creatureId, m, this.now());
    if (!r.ok) {
      return this.ui.fail(r.error);
    }
    this.audio.play('chime');
    this.analytics.track('blessing_claimed', { mutation: m });
    this.record({ kind: 'blessing' });
    this.ui.closeSheet();
    this.ui.toast(`✨ ${r.message}${r.discovered ? ' A new kind of change!' : ''}`, 'discovery', undefined, 5000);
    const c = this.state.creatures.find((x) => x.id === creatureId);
    if (c && c.island !== this.world.current) this.travel(c.island);
    this.saveSoon();
  }

  skipToNextEvent(): void {
    const e = nextEvent(this.state, this.now());
    if (!e) return;
    this.state.clockOffset += e.start - this.now() + 1000;
    this.ui.closeSheet();
  }
}

