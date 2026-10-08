import { UPDATES } from '../content/updates';
import { SPECIES, species } from '../content/species';
import { DECOR, EGG_TIERS, EVENTS, FOODS, GIFTABLE_MUTATIONS, TOOLS, ITEMS, LEGENDARY, LEGENDARY_ORDER, LURES, MUTATIONS, SKY_ITEMS, SPOTS, spotOpen } from '../content/world';
import { ISLANDS, ISLAND_ORDER, SIZE_NAMES, SIZE_PRICE } from '../content/islands';
import { TUNING } from '../content/tuning';
import { FONT, SHOP_STALL } from '../content/layout';
import * as A from '../core/actions';
import { creatureTraits, displayName, fmtWeight, growth, isOutlier, sizeLabel, speciesTitle, weightKg } from '../core/creatures';
import { compatibility, eggClues } from '../core/genetics';
import { arrivalWeights } from '../core/lures';
import { nestOccupant, placedNests } from '../core/state';
import type { Creature, DecorDef, Egg, GameEvent, IslandId, LegendaryKind, MutationId, SpotId, Trait } from '../core/types';
import { islandCapacity } from '../core/sim';
import { marketPrice, marketReady, marketWants, wantFilled, wantMatches } from '../core/market';
import type { WelcomeGift } from '../core/away';
import type { SaveSummary } from '../core/cloud';
import { GAME_NAME } from './brand';
import { halloweenEndsAt, inHalloween } from '../content/seasons';
import { hasSpecial } from '../core/shop';
import { PASS, PASS_TIERS, type PassReward, claimPassTier, describeReward, passClaimable, passState, passTier } from '../core/pass';
import { eggIcon, eggName, tierEggIcon } from './eggLook';
import { wandererDeals } from '../core/wanderers';
import { activeEvent, dayPhase, daylight, isDark, nextEvent } from '../core/world';
import type { Game } from '../game/Game';
import { fmtDuration, fmtTimer, h, img, rich, setText } from './dom';
import * as I from './icons';
import { WorldLabels } from './Labels';
import { QUIRKS, QUIRK_IDS } from '../content/quirks';
import { SHADES, type ShadeId } from '../content/shades';
import { BEST_FRIEND_PERKS, PET_COOLDOWN_MIN, PLAY_COOLDOWN_MIN, hearts } from '../core/friendship';
import { EXPEDITIONS, EXPEDITION_ORDER, expeditionSlots, type ExpeditionId } from '../content/expeditions';
import type { ExpeditionHaul } from '../core/expeditions';
import { voiceOf } from '../render/voices';
import { LOGIN_REWARDS, STREAK_MILESTONES, canClaimLogin, loginDay, streakBonus, streakNow } from '../core/login';
import { COLLECTIONS, claimableCollections } from '../core/collections';
import { THEMES, contestReady, placeFor, rivals, scorePet, themeOf, weekEnds, weekOf } from '../core/contests';
import { DECOR_CATS, DECOR_LIST, GADGET_IDS } from '../content/decor';
/** Decorations for looks only (gadgets are sold on their own tab). */
const CATALOG = DECOR_LIST.filter((d) => !GADGET_IDS.includes(d.id));
import { WANDERERS } from '../content/wanderers';
import { deleteQuirk, wipeQuirks } from '../core/quirks';
import { MAX_LEVEL, STAR_LEVEL, levelOf, levelProgress, levelReward, starRank, type LevelUp } from '../core/levels';
import { weekState } from '../core/weekly';
import { FRIEND_GIFT, addFriend, canCollectGift, collectGift, giftsLeft, myFriendCode, removeFriend } from '../core/friends';
import { ACHIEVEMENTS } from '../core/achievements';
import { gameServices } from '../platform/gameServices';
import { makeShareCard, shareBlob, shareBlobText } from './shareCard';
import { Hints } from './hints';
import { FEATURES, featureOn, unlockFeatures, type FeatureId } from './features';
import { STARTER_STEPS, starterState, starterStep } from '../core/starter';
import { RUMOUR_REWARD, rumourText, todaysRumour } from '../core/rumours';
import { DAILY_POOL, LASTING, claimable, claimableBy, lastingReward, refreshDailies } from '../core/quests';
import { type AwayFind, canSell, sellBreakdown, collectorHere, findVisitor, isHungry, visitorThanks, nextSlotPrice, ripeFruit, sellPrice, sellWarning, storedCount } from '../core/care';
import { rarityTag } from './rarity';

type PetsSort = 'newest' | 'rarity' | 'name' | 'size' | 'hunger';
type ShopTab = 'lure' | 'egg' | 'item' | 'decor' | 'gadget' | 'shards' | 'food';
interface QueuedToast { text: string; kind: 'info' | 'discovery'; image?: string; ms: number; pri: number; at: number; action?: { label: string; run: () => void } }

/** Which shop tab fixes "you're out of…" (null when the shop isn't the answer). */
export function shopTabFor(text: string): ShopTab | null {
  const t = text.toLowerCase();
  if (/not enough (coins|starshards)|need more (coins|starshards)|can't afford/.test(t)) return 'shards';
  if (!/mango|shop|out of|you need|you have no|empty/.test(t)) return null;
  if (/lure/.test(t)) return 'lure';
  if (/pantry|food|snack|feast|feedbag|berr/.test(t)) return 'food';
  if (/spray|tonic|deleter|wiper|stone|mist|tracker|summon|item|charm|chart|telescope/.test(t)) return 'item';
  if (/nest|nursery|totem|berry tree|gadget/.test(t)) return 'gadget';
  if (/decor/.test(t)) return 'decor';
  if (/egg/.test(t)) return 'egg';
  return null;
}

const fmtClock = fmtTimer;

const MUT_ICON: Record<MutationId, string> = { lunar: '🌙', storm: '⚡', giant: '⛰️', prismatic: '🌈', starlit: '🌟', frost: '❄️', angelic: '😇', infernal: '😈', abyssal: '🫧', aurora: '🌌', misty: '🌫️', sunkissed: '☀️', blossom: '🌸', glowing: '✨', breezy: '🌬️', bubbly: '🫧', cosmic: '💫', crystal: '💎', golden: '👑',
  ghostly: '👻', calcified: '💀', mummified: '🧻', zombified: '🧟', vampire: '🧛', pumpkin: '🎃' };
const ITEM_ICON: Record<string, string> = { warmth: '🔥', giantChance: '🧪', grow: '🌱', shrink: '💧', glitter: '✨', speedy: '⚡' };
const HABITAT_ICON: Partial<Record<Trait | 'Any', string>> = { Grove: '🌳', Tide: '💧', Bloom: '🌸', Mystic: '🔮', Any: '✨' };
const MUTATION_TRAITS: Trait[] = ['Lunar', 'Storm', 'Giant', 'Prismatic', 'Starlit', 'Frost', 'Angelic', 'Infernal', 'Abyssal', 'Aurora', 'Misty'];

/** What Mango says on each shop tab; the line changes with every new stock. */
const MANGO_LINES: Record<ShopTab, string[]> = {
  gadget: ['Handy things that DO things!', 'Gadgets come and go. Grab them while you can!', 'Only a few of these at a time.'],
  egg: ['Ooh-ooh! Fresh eggs, still warm!', 'Who knows what is inside? Not me!', 'Shake it gently... I hear wings!'],
  lure: ['A good smell brings good friends.', 'This one makes my nose twitch!', 'Lures! Tastier than bananas. Almost.'],
  item: ['Curious things from far islands.', 'Do not ask where I found these.', 'Handle with care, keeper!'],
  decor: ['Make your world cozy!', 'Pretty things for pretty places.', 'Finest decor this side of the sea!'],
  food: ['Hungry tummies make grumpy friends!', 'Bananas are not on the menu. Sadly.', 'Plant a Berry Tree and never run out!'],
  shards: ['Starshards! Shiny, shiny!', 'Sparkly stones from fallen stars.', 'They twinkle in my paws!'],
};

export class UI {
  readonly root: HTMLElement;
  private glimmerVal = h('span', { class: 'val' });
  private shardsVal = h('span', { class: 'val' });
  private skyChip = h('span');
  private adsBadge = h('span', { class: 'count' });
  private giftTile = h('button', { class: 'hud-tile gift hidden', 'aria-label': 'Claim a legendary gift', onClick: () => { this.game.audio.play('tap'); this.showBlessing(); } },
    h('span', { class: 'emoji' }, '🎁'), h('span', { class: 'lbl' }, 'GIFT'));
  private overlay: HTMLElement | null = null;
  private questBadge = h('span', { class: 'count hidden' });
  private islandsBadge = h('span', { class: 'count alert hidden' }, '!');
  private worldsAnnounced = new Set<IslandId>();
  private questTile = h('button', { class: 'hud-tile quests', 'aria-label': 'Quests', onClick: () => { this.game.audio.play('tap'); this.showQuests(); } },
    h('span', { class: 'emoji' }, '📜'), h('span', { class: 'lbl' }, 'QUESTS'), this.questBadge);
  private passBadge = h('span', { class: 'count hidden' }, '0');
  /** The Halloween Pass: only on the HUD during the season. */
  /** Lotl's starter quest: the axolotl button and its fold-out card. */
  private lotlQuest = h('div', { class: 'lotl-quest hidden' });
  private lotlKey = '';
  private syncLotl(): void {
    const s = this.game.state;
    const q = starterState(s);
    const show = s.tutorial >= 6 && !q.done;
    this.lotlQuest.classList.toggle('hidden', !show);
    if (!show) return;
    const key = `${q.step}/${q.progress}/${q.open}/${q.claimable}`;
    if (key === this.lotlKey) return;
    this.lotlKey = key;
    const st = starterStep(s);
    const toggle = () => { this.game.audio.play('tap'); q.open = !q.open; this.game.saveSoon(); this.syncLotl(); };
    const btn = h('button', { class: `lotl-btn ${q.claimable ? 'ready' : ''}`, 'aria-label': 'Lotl\'s quest', onClick: toggle },
      I.icon(I.AXOLOTL, 'icon'), h('span', { class: 'lotl-count' }, q.claimable ? '!' : `${q.step + 1}/${STARTER_STEPS.length}`));
    const card = !q.open ? '' : h('div', { class: 'lotl-card' },
      h('div', { class: 'lotl-title' }, 'Lotl\'s Quest'),
      q.claimable
        ? h('div', null, h('div', { class: 'lotl-goal' }, 'All done! Here\'s my gift.'),
          h('button', { class: 'btn small', onClick: () => this.game.claimStarter() }, rich('🥚 Claim Lotl\'s Egg')))
        : h('div', null,
          h('div', { class: 'lotl-goal' }, `${st!.text}${st!.target > 1 ? ` (${q.progress}/${st!.target})` : ''}`),
          h('div', { class: 'lotl-tip' }, st!.tip),
          h('div', { class: 'lotl-dots' }, ...STARTER_STEPS.map((_, i) => h('i', { class: i < q.step ? 'done' : i === q.step ? 'now' : '' }))),
          h('div', { class: 'lotl-prize' }, rich('Prize: 🥚 an egg with a creature you don\'t have!'))));
    this.lotlQuest.replaceChildren(btn, card);
  }

  /** Buttons that appear one at a time as the keeper progresses (ui/features.ts). */
  private featureEl: Partial<Record<FeatureId, HTMLElement>> = {};
  /** "🐾 3/76 found": the big goal, always in view. */
  private foundChip = h('button', { class: 'found-chip hidden', 'aria-label': 'Creatures found', onClick: () => { this.game.audio.play('tap'); this.showJournal(); } });
  private syncFeatures(): void {
    const s = this.game.state;
    this.featureEl.quests = this.questTile;
    this.featureEl.friends = this.friendsTile;
    this.featureEl.pass = this.passTile;
    const fresh = unlockFeatures(s, this.game.now());
    for (const f of FEATURES) {
      const el = this.featureEl[f.id];
      if (!el) continue;
      const on = featureOn(s, f.id, this.game.now());
      if (f.id === 'pass') { if (!on) el.classList.add('hidden'); } else el.classList.toggle('feature-off', !on);
    }
    for (const f of fresh) {
      const el = this.featureEl[f.id];
      this.game.audio.play('discover');
      this.toast(`✨ New: ${f.name}! ${f.intro}`, 'discovery', undefined, 6000, { priority: 2, action: { label: 'Open', run: () => el?.click() } });
      if (el) { el.classList.add('new-feature'); setTimeout(() => el.classList.remove('new-feature'), 9000); }
    }
    const found = Object.keys(s.journal.species).length;
    this.foundChip.classList.toggle('hidden', s.tutorial < 5);
    setText(this.foundChip, `🐾 ${found}/${SPECIES.length}`);
  }
  private friendsBadge = h('span', { class: 'badge hidden' });
  private friendsTile = h('button', { class: 'hud-tile friends', 'aria-label': 'Friends', onClick: () => { this.game.audio.play('tap'); this.showFriends(); } },
    h('span', { class: 'icon emo' }, rich('🤝')), h('span', { class: 'lbl' }, 'FRIENDS'), this.friendsBadge);
  private passTile = h('button', { class: 'hud-tile pass hidden', 'aria-label': 'Halloween Pass', onClick: () => { this.game.audio.play('tap'); this.showPass(); } },
    h('span', { class: 'emoji' }, '🎃'), h('span', { class: 'lbl' }, 'PASS'), this.passBadge);
  private questTab: 'daily' | 'lasting' | 'contest' = 'daily';
  private petsTab: 'wandering' | 'storage' | 'trips' | 'market' = 'wandering';
  /** Pets → Select: the pets picked for a bulk action (null when not selecting). */
  private petSel: Set<string> | null = null;
  /** Pets → which world to show ('all' groups them by world). */
  private petWorld: IslandId | 'all' = 'all';
  private longPressFired = false;
  private heartPop: { id: string; at: number } | null = null;
  private petsSort: PetsSort = 'newest';
  private collectorTile = h('button', { class: 'hud-tile collector hidden', 'aria-label': 'The Collector is visiting', onClick: () => { this.game.audio.play('tap'); this.showCollector(); } },
    h('span', { class: 'emoji' }, '🎩'), h('span', { class: 'lbl' }, 'BUYER'));
  private levelNum = h('span', { class: 'lv-num' });
  private levelFill = h('i');
  private levelBadge = h('button', { class: 'level-badge', 'aria-label': 'Keeper level and rewards', onClick: () => { this.game.audio.play('tap'); this.showLevels(); } },
    h('span', { class: 'lv-star' }, '★'), this.levelNum, h('span', { class: 'lv-bar' }, this.levelFill));
  private lastXp = -1;
  private widget = h('div', { class: 'widget hidden' });
  private widgetKey = '';
  private banner = h('div', { class: 'banner hidden' });
  private toasts = h('div', { class: 'toasts' });
  private toastQueue: QueuedToast[] = [];
  private toastBusy = false;
  private coachEl = h('div', { class: 'coach hidden' });
  private sheetHost = h('div');
  private modalHost = h('div');
  private revealHost = h('div');
  private placeHost = h('div');
  private dock: HTMLElement;
  private shopDot = h('span', { class: 'dot hidden' });
  private journalDot = h('span', { class: 'dot hidden' });
  private petsDot = h('span', { class: 'dot hidden' });
  private sheetRender: (() => void) | null = null;
  private lastGlimmer = -1;
  private lastShards = -1;
  private refreshTimer = 0;
  private fontPick: [string | null, string | null] = [null, null];
  private journalTab: 'creatures' | 'mutations' | 'traits' | 'notes' | 'pages' = 'creatures';
  private journalWorld: IslandId | 'all' = 'all';
  private decorCat = 'all';
  private feedWorld: IslandId = 'home';
  private decorSort: 'level' | 'price' | 'name' = 'level';
  private shopTab: ShopTab = 'egg';
  private coachDismissed = -1;
  seenShopRotation = 0;
  private toldRotation = -1;
  private seenNotes = 0;
  readonly labels: WorldLabels;

  constructor(private game: Game, mount: HTMLElement) {
    this.root = h('div', { class: 'ui' });
    const top = h('div', { class: 'hud-top' },
      h('div', { class: 'hud-col', style: 'flex:1' },
        h('div', { class: 'hud-row' },
          h('button', { class: 'sq-btn', 'aria-label': 'Settings', onClick: () => this.showSettings() }, I.icon(I.GEAR)),
          h('div', { class: 'spacer' }),
          h('div', { class: 'bar', title: 'Coins' }, I.icon(I.COIN), this.glimmerVal,
            h('button', { class: 'bar-plus', 'aria-label': 'Get coins', onClick: () => this.showShop(true) }, I.icon(I.PLUS))),
          h('div', { class: 'bar', title: 'Starshards', style: 'margin-left:10px' }, I.icon(I.GEM), this.shardsVal,
            h('button', { class: 'bar-plus', 'aria-label': 'Get Starshards', onClick: () => this.showShop(true) }, I.icon(I.PLUS))),
        ),
        h('div', { class: 'hud-row', style: 'width:100%;align-items:flex-start' },
          h('div', { class: 'hud-col' }, h('div', { class: 'hud-row', style: 'gap:6px' }, this.levelBadge, h('div', { class: 'sky-chip' }, this.skyChip)), this.foundChip, this.widget),
          h('div', { class: 'spacer' }),
          h('div', { class: 'hud-col right' },
            this.featureEl.event = h('button', { class: 'hud-tile', 'aria-label': 'Watch an ad to summon a sky event', onClick: () => this.showSummon() },
              I.icon(I.SUMMON), h('span', { class: 'lbl' }, 'EVENT'), this.adsBadge),
            this.featureEl.worlds = h('button', { class: 'hud-tile islands', 'aria-label': 'Worlds', onClick: () => { this.game.audio.play('tap'); this.showIslands(this.firstAlert()); } },
              I.icon(I.ISLANDS), h('span', { class: 'lbl' }, 'WORLDS'), this.islandsBadge),
            this.questTile,
            this.friendsTile,
            this.passTile,
            this.collectorTile,
            this.giftTile,
          ),
        ),
      ),
    );
    const dockBtn = (svg: string, label: string, fn: () => void, dot?: HTMLElement) =>
      h('button', { onClick: () => { this.game.audio.play('tap'); fn(); } }, I.icon(svg), h('span', { class: 'lbl' }, label), dot ?? null);
    this.dock = h('nav', { class: 'dock' },
      dockBtn(I.LURE, 'LURES', () => this.showLures()),
      dockBtn(I.CREATE, 'CREATE', () => this.showFont()),
      dockBtn(I.PAW, 'PETS', () => this.showPets(this.game.state.expeditions.some((e) => e.end <= this.game.now()) ? 'trips' : undefined), this.petsDot),
      this.featureEl.journal = dockBtn(I.JOURNAL, 'JOURNAL', () => this.showJournal(), this.journalDot),
      this.featureEl.shop = dockBtn(I.SHOP, 'SHOP', () => this.showShop(), this.shopDot),
      this.featureEl.decor = dockBtn(I.DECOR, 'DECOR', () => this.showDecor()),
    );
    this.root.append(top, this.banner, this.lotlQuest, this.toasts, this.coachEl, this.dock, this.sheetHost, this.placeHost, this.modalHost, this.revealHost);
    // a finger down on a sheet pauses its live refresh until it lifts (so taps always land)
    this.sheetHost.addEventListener('pointerdown', () => { this.pressing = true; });
    window.addEventListener('pointerup', () => { this.pressing = false; }, true);
    window.addEventListener('pointercancel', () => { this.pressing = false; }, true);
    mount.append(this.root);
    this.seenShopRotation = game.state.shop.rotation;
    this.seenNotes = game.state.journal.notes.length;
    this.labels = new WorldLabels(game, this.root, {
      openSpot: (id) => this.showSpot(id),
      openNest: (i) => this.showNest(i),
      openFont: () => this.showFont(),
      openShop: () => this.showShop(),
      openBooth: () => this.showSellBooth(),
      openBasket: () => this.showBasket(),
      openCreatureMenu: (id) => this.showCreature(id),
      pet: (id) => game.befriend(id, 'pet'),
      openIsland: (id) => (game.state.islands[id]?.owned ? game.travel(id) : this.showIslands(id)),
    });
  }

  /** Tap on a creature: name bubble over its head; ⚙️ opens the full menu. */
  selectCreature(id: string | null): void {
    if (this.sheetOpen) this.closeSheet(false);
    const c = id ? this.game.state.creatures.find((x) => x.id === id) : undefined;
    if (c) this.game.audio.voice(voiceOf(c), c.size);
    this.game.world.select(id);
    this.labels.select(id);
    if (id && this.game.state.tutorial === 2) this.game.setTutorial(3);
  }

  // ------------------------------------------------------------------ per-frame

  update(dt: number): void {
    const s = this.game.state;
    const t = this.game.now();
    if (s.glimmer !== this.lastGlimmer) {
      this.glimmerVal.textContent = String(s.glimmer);
      if (this.lastGlimmer >= 0) this.bump(this.glimmerVal.parentElement!);
      this.lastGlimmer = s.glimmer;
    }
    if (s.shards !== this.lastShards) {
      this.shardsVal.textContent = String(s.shards);
      if (this.lastShards >= 0) this.bump(this.shardsVal.parentElement!);
      this.lastShards = s.shards;
    }
    if (s.xp !== this.lastXp) {
      this.lastXp = s.xp;
      const lp = levelProgress(s.xp);
      this.levelNum.textContent = `Lv ${lp.level}`;
      for (let r = 1; r <= 3; r++) this.levelBadge.classList.toggle(`star${r}`, starRank(lp.level) === r);
      this.levelFill.style.width = `${Math.round(lp.pct * 100)}%`;
    }
    this.collectorTile.classList.toggle('hidden', !collectorHere(s, t));
    const openable = A.buyableWorlds(s);
    this.islandsBadge.classList.toggle('hidden', this.worldAlerts().size === 0 && openable.length === 0);
    // a quick heads-up the first time a new world becomes affordable (once per world each session)
    for (const id of openable) {
      if (this.worldsAnnounced.has(id) || s.tutorial < 6 || this.game.quiet()) continue;
      this.worldsAnnounced.add(id);
      this.toast(`${ISLANDS[id].icon} A new world is ready to open: ${ISLANDS[id].name}! Tap Worlds.`, 'discovery', undefined, undefined, { action: { label: 'Worlds', run: () => this.showIslands(id) } });
    }
    const wkNow = weekState(s, t);
    const ready = claimable(s) + (contestReady(s, t) ? 1 : 0) + (canClaimLogin(s, t) && s.tutorial >= 5 ? 1 : 0) + (!wkNow.claimed && wkNow.progress >= wkNow.theme.goal.target ? 1 : 0);
    const season = inHalloween(t);
    this.passTile.classList.toggle('hidden', !season);
    this.syncLotl();
    this.syncFeatures();
    this.syncHints();
    const gl = giftsLeft(s, t);
    this.friendsBadge.textContent = String(gl);
    this.friendsBadge.classList.toggle('hidden', gl === 0);
    if (season) {
      const claim = passClaimable(s);
      this.passBadge.textContent = String(claim);
      this.passBadge.classList.toggle('hidden', claim === 0);
    }
    this.questBadge.textContent = String(ready);
    this.questBadge.classList.toggle('hidden', ready === 0);
    this.giftTile.classList.toggle('hidden', !(s.blessing && t < s.blessing.expiresAt));
    const phase = dayPhase(s, t);
    const ev = activeEvent(s, t);
    const light = daylight(phase);
    const icon = ev ? EVENTS[ev.kind].icon : light > 0.6 ? '☀️' : light > 0.1 ? (phase < 0.5 ? '🌅' : '🌇') : '🌙';
    const label = ev ? `${EVENTS[ev.kind].name} · ${fmtClock(ev.end - t)}` : light > 0.6 ? (phase < 0.5 ? 'Morning' : 'Afternoon') : light > 0.1 ? (phase < 0.5 ? 'Dawn' : 'Dusk') : 'Night';
    setText(this.skyChip, `${icon} ${label}`);

    // event banner / forecast teaser
    const next = nextEvent(s, t);
    let text = '';
    let cls = '';
    // The sky chip shows an active event; the banner is only for forecast teasers.
    if (!ev && next && next.start - t < TUNING.forecastLeadMin * 60_000) {
      text = EVENTS[next.kind].teaser;
    }
    setText(this.banner, text);
    this.banner.className = `banner ${cls} ${text ? '' : 'hidden'}`;

    this.shopDot.classList.toggle('hidden', s.shop.rotation === this.seenShopRotation);
    // a little heads-up when Mango restocks (and a bigger one when it's something rare)
    if (s.shop.rotation !== this.toldRotation) {
      if (this.toldRotation >= 0 && s.tutorial >= 6) {
        if (hasSpecial(s.shop)) this.toast('✨ Mango has something special in stock! Come and see.', 'discovery', undefined, 5000, { priority: 2, action: { label: 'Shop', run: () => this.showShop() } });
        else this.toast('🛒 Mango has new stock.', 'info', undefined, 2600, { action: { label: 'Shop', run: () => this.showShop() } });
      }
      this.toldRotation = s.shop.rotation;
    }
    const ads = A.adsLeft(s, t);
    if (this.adsBadge.textContent !== String(ads)) this.adsBadge.textContent = String(ads);
    this.journalDot.classList.toggle('hidden', s.journal.notes.length === this.seenNotes && !claimableCollections(s).length);
    this.petsDot.classList.toggle('hidden', !s.expeditions.some((e) => e.end <= t));

    this.refreshTimer -= dt;
    if ((this.refreshTimer <= 0 || this.pendingRender) && this.sheetRender) {
      this.refreshTimer = 1;
      this.rerender();
    }
    this.updateCoach();
    this.updateWidget();
    this.labels.update(this.game.world.revealing || !!this.game.placing);
  }

  private bump(el: HTMLElement): void {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /**
   * News pop-ups wait their turn: the most important shows first, one at a time,
   * and the next only appears once it fades. Replies to something you just did
   * (priority 3) show straight away. Old small news is dropped rather than piling up.
   */
  toast(text: string, kind: 'info' | 'discovery' = 'info', image?: string, ms = 3200, opts: { priority?: number; action?: { label: string; run: () => void } } = {}): void {
    const item: QueuedToast = { text, kind, image, ms, pri: opts.priority ?? (kind === 'discovery' ? 2 : 1), at: performance.now(), action: opts.action };
    if (item.pri >= 3) {
      this.showToast(item);
      return;
    }
    // the same message twice in a row is just noise
    if (this.toastQueue.some((q) => q.text === text)) return;
    let i = this.toastQueue.findIndex((q) => q.pri < item.pri);
    if (i < 0) i = this.toastQueue.length;
    this.toastQueue.splice(i, 0, item);
    // keep the line short: drop the oldest small news first
    while (this.toastQueue.length > 5) {
      const low = Math.min(...this.toastQueue.map((q) => q.pri));
      this.toastQueue.splice(this.toastQueue.findIndex((q) => q.pri === low), 1);
    }
    this.pumpToasts();
  }

  /** Something you tried didn't work: say why right away, with a shortcut to the shop when that's the fix. */
  fail(text: string): void {
    // a soft "nope" sound for anything that doesn't work
    this.game.audio.play('error');
    const tab = shopTabFor(text);
    this.toast(text, 'info', undefined, tab ? 4200 : 3200, { priority: 3, action: tab ? { label: 'Shop', run: () => this.openShopFor(tab) } : undefined });
  }

  /** Open Mango's shop on the tab you need. */
  openShopFor(tab: ShopTab): void {
    this.shopTab = tab;
    this.showShop();
  }

  private pumpToasts(): void {
    if (this.toastBusy) return;
    const now = performance.now();
    // small news that waited too long is no longer news
    this.toastQueue = this.toastQueue.filter((q) => q.pri >= 2 || now - q.at < 15_000);
    const next = this.toastQueue.shift();
    if (!next) return;
    this.toastBusy = true;
    // a longer line moves along a little faster
    const ms = this.toastQueue.length >= 2 ? Math.max(1800, next.ms * 0.7) : next.ms;
    this.showToast({ ...next, ms }, () => {
      this.toastBusy = false;
      setTimeout(() => this.pumpToasts(), 250);
    });
  }

  private showToast(t: QueuedToast, done?: () => void): void {
    // The axolotl mascot delivers any news that doesn't come with its own picture.
    let gone = false;
    const finish = () => { if (gone) return; gone = true; el.remove(); done?.(); };
    // tap a toast to put it away early
    const el = h('div', { class: `toast ${t.kind} ${t.pri >= 3 ? 'urgent' : ''}`, onClick: () => { el.classList.add('out'); setTimeout(finish, 200); } },
      t.image ? img(t.image) : I.icon(I.AXOLOTL, 'icon toast-mascot'), h('span', null, rich(t.text)),
      t.action ? h('button', { class: 'btn small toast-btn', onClick: (e: Event) => { e.stopPropagation(); finish(); t.action!.run(); } }, t.action.label) : null);
    if (t.pri >= 3) {
      // only one reply at a time
      this.toasts.querySelectorAll('.toast.urgent').forEach((e) => e.remove());
      this.toasts.prepend(el);
    } else this.toasts.append(el);
    setTimeout(() => el.classList.add('out'), t.ms);
    setTimeout(finish, t.ms + 450);
  }

  // ------------------------------------------------------------------ sheets

  private openSheet(title: string, sub: string, render: (body: HTMLElement) => void, icon?: string): void {
    this.closeSheet(false);
    const body = h('div', { class: 'body' });
    const sheet = h('section', { class: 'sheet', role: 'dialog', 'aria-label': title },
      h('div', { class: 'grab' }),
      h('header', null,
        icon ? h('span', null, icon.startsWith('<svg') ? I.icon(icon) : icon) : null,
        h('div', { class: 'col' }, h('h2', null, title), sub ? h('span', { class: 'sub' }, sub) : null),
        h('button', { class: 'close', 'aria-label': 'Close', onClick: () => this.closeSheet() }, I.icon(I.CLOSE)),
      ),
      body,
    );
    const openedAt = performance.now();
    const scrim = h('div', { class: 'scrim', onClick: () => { if (performance.now() - openedAt > 350) this.closeSheet(); } });
    this.sheetHost.append(scrim, sheet);
    this.sheetRender = () => {
      const scroll = body.scrollTop;
      // sideways-scrolling chip rows keep their place too
      const rows = [...body.querySelectorAll<HTMLElement>('.world-filter, .tabs, .pass-scroll')].map((el) => el.scrollLeft);
      body.replaceChildren();
      render(body);
      body.scrollTop = scroll;
      body.querySelectorAll<HTMLElement>('.world-filter, .tabs, .pass-scroll').forEach((el, i) => { el.scrollLeft = rows[i] ?? 0; });
    };
    this.sheetRender();
    this.refreshTimer = 1;
  }

  closeSheet(deselect = true): void {
    this.sheetHost.replaceChildren();
    this.sheetRender = null;
    if (deselect) {
      this.game.world.select(null);
      this.labels.select(null);
    }
  }

  /**
   * Rebuild the open sheet with fresh numbers. Never while a finger is down on it
   * (that would swallow the tap) or while typing a name: it catches up right after.
   */
  rerender(): void {
    const a = document.activeElement;
    const typing = (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) && this.sheetHost.contains(a);
    if (this.pressing || typing) {
      this.pendingRender = true;
      return;
    }
    this.pendingRender = false;
    this.sheetRender?.();
  }

  private pressing = false;
  private pendingRender = false;

  get sheetOpen(): boolean {
    return !!this.sheetRender;
  }

  private portrait(c: { species: string; mutations: MutationId[]; shade?: string }, cls = 'portrait'): HTMLImageElement {
    return img(this.game.world.portraits.of(c), cls);
  }

  private traitChips(traits: Trait[], highlight: Trait[] = []): HTMLElement {
    return h('div', { class: 'chips' }, ...traits.map((t) =>
      h('span', { class: `chip ${MUTATION_TRAITS.includes(t) ? 'mut' : ''} ${highlight.includes(t) ? 'shared' : ''}` },
        `${HABITAT_ICON[t] ?? (MUTATION_TRAITS.includes(t) ? MUT_ICON[t.toLowerCase() as MutationId] : '')} ${t}`.trim())));
  }

  // ---- lure spots

  showLures(): void {
    this.openSheet('Lures', 'Set out a scent and see who answers.', (b) => {
      const s = this.game.state;
      for (const id of ISLAND_ORDER) {
        if (!s.islands[id]?.owned) continue;
        const spots = Object.values(SPOTS).filter((x) => x.island === id);
        if (!spots.length) continue;
        if (Object.values(s.islands).filter((x) => x.owned).length > 1) {
          b.append(h('div', { class: 'section-title' }, `${ISLANDS[id].icon} ${ISLANDS[id].name}`));
        }
        for (const spot of spots) {
          if (spotOpen(s.islands, spot.id)) b.append(this.spotBlock(spot.id));
          else b.append(h('div', { class: 'spot-locked' }, `🔒 ${spot.name}: grow ${ISLANDS[id].name} to ${SIZE_NAMES[spot.minSize ?? 0]} to open this lure spot.`));
        }
      }
      b.append(h('p', { class: 'muted' }, 'Tip: the same lure can attract different visitors depending on where you place it, the time of day, and the sky.'));
    }, I.LURE);
  }

  showSpot(spotId: SpotId): void {
    const spot = SPOTS[spotId];
    if (this.game.world.current !== spot.island) this.game.world.travelTo(spot.island, true);
    this.game.world.focus(spot, 14, spot.island);
    const subs: Record<string, string> = { glade: 'A quiet ring of mossy stones.', pond: 'Where land meets water.', vent: 'Warm air rises from the rocks.', ash: 'Soft grey ash, still warm.', reef: 'Bright coral just under the surface.', shallows: 'Warm, clear, knee-deep water.' };
    this.openSheet(spot.name, subs[spotId] ?? '', (b) => b.append(this.spotBlock(spotId, true)), ISLANDS[spot.island].icon);
  }

  private spotBlock(spotId: SpotId, solo = false): HTMLElement {
    const s = this.game.state;
    const t = this.game.now();
    const spot = SPOTS[spotId];
    const active = s.spots[spotId];
    const wrap = h('div', { class: 'col', style: 'margin-bottom:14px' });
    if (!solo) wrap.append(h('div', { class: 'section-title' }, spot.name));
    if (active) {
      const lure = LURES[active.lure];
      const dormant = arrivalWeights(active.lure, spotId, isDark(s, t), activeEvent(s, t)?.kind ?? null).length === 0;
      wrap.append(h('div', { class: 'item' },
        h('div', { class: 'swatch', style: `background:${lure.color}33` }, '🫙'),
        h('div', { class: 'grow' },
          h('div', { class: 'name' }, lure.name),
          h('div', { class: 'desc' }, dormant
            ? 'The scent waits. Nothing nearby is answering it right now... perhaps at another time?'
            : `${fmtDuration(active.expiresAt - t)} left · ${active.visitors} visitor${active.visitors === 1 ? '' : 's'} so far`),
        ),
        h('button', { class: 'btn secondary small', onClick: () => { A.removeLure(s, spotId); this.game.saveSoon(); this.rerender(); } }, 'Clear'),
      ));
      return wrap;
    }
    const owned = Object.entries(s.lures).filter(([, n]) => n > 0);
    if (!owned.length) {
      wrap.append(h('div', { class: 'item' }, h('div', { class: 'grow desc' }, 'Your satchel is out of lures.'),
        h('button', { class: 'btn small', onClick: () => this.openShopFor('lure') }, 'Get lures')));
      return wrap;
    }
    const list = h('div', { class: 'list' });
    for (const [id, n] of owned) {
      const lure = LURES[id];
      list.append(h('div', { class: 'item' },
        h('div', { class: 'swatch', style: `background:${lure.color}33` }, HABITAT_ICON[lure.attracts] ?? '🫙'),
        h('div', { class: 'grow' }, h('div', { class: 'name' }, `${lure.name} ×${n}`), h('div', { class: 'desc' }, lure.scent)),
        h('button', { class: 'btn small', onClick: () => this.game.placeLure(spotId, id) }, 'Place'),
      ));
    }
    wrap.append(list);
    return wrap;
  }

  // ---- creature

  showCreature(id: string): void {
    const c = this.game.state.creatures.find((x) => x.id === id);
    if (!c) return;
    this.game.world.select(id);
    this.labels.select(id);
    if (this.game.state.tutorial === 2) this.game.setTutorial(3);
    let renaming = false;
    const s2 = this.game.state;
    this.openSheet(displayName(c), speciesTitle(c) !== displayName(c) ? speciesTitle(c) : species(c.species).origin === 'hybrid' ? 'Hybrid' : '', (b) => {
      const sp = species(c.species);
      const head = h('div', { class: 'row', style: 'align-items:flex-start' }, h('div', { class: 'portrait-wrap' }, this.portrait(c, 'portrait big'), this.heartToggle(c)),
        h('div', { class: 'col', style: 'flex:1' },
          renaming
            ? (() => {
              const input = h('input', { class: 'rename', value: c.nickname ?? '', placeholder: speciesTitle(c), maxLength: 18 });
              input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
              input.addEventListener('blur', () => { A.rename(this.game.state, c.id, input.value); renaming = false; this.game.saveSoon();
                const title = this.sheetHost.querySelector('.sheet header h2');
                if (title) title.textContent = displayName(c);
                this.rerender();
              });
              setTimeout(() => input.focus(), 50);
              return input;
            })()
            : h('div', { class: 'row', style: 'gap:6px' },
              h('button', { class: 'btn secondary small', onClick: () => { renaming = true; this.rerender(); } }, '✏️ Name'),
              h('button', { class: 'btn secondary small', onClick: () => void this.shareCreature(c) }, '📱 Share')),
          h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, rarityTag(sp.rarity), isOutlier(c.size) ? h('span', { class: 'rarity r-outlier' }, sizeLabel(c.size)) : h('span', { class: 'muted' }, sizeLabel(c.size)), h('span', { class: 'muted' }, fmtWeight(weightKg(c, this.game.now()))),
            this.shadeChip(c)),
          h('div', { class: 'desc muted' }, sp.blurb),
          h('div', { class: 'quirk-row' }, ...c.quirks.map((q) => h('span', { class: 'quirk', title: QUIRKS[q].blurb }, `${QUIRKS[q].icon} ${QUIRKS[q].name}`))),
        ));
      b.append(head);
      const t = this.game.now();
      const grown = growth(c, t);
      const tools = this.game.state.tools;
      const g = this.game;
      const full = Math.round(c.fullness * 100);
      const here = collectorHere(g.state, g.now());
      const price = sellPrice(g.state, c, here);
      const noSell = canSell(g.state, c);
      const want = marketWants(g.state, g.now()).find((w) => !wantFilled(g.state, w, g.now()) && wantMatches(w, c));
      const foodLeft = (g.state.food.fruit ?? 0) + (g.state.food.snack ?? 0);
      if (c.stored) {
        // resting in storage: no hunger, no trips; just bring it back out (or sell it)
        b.append(h('div', { class: 'care' },
          h('p', { class: 'muted', style: 'margin:0 0 8px' }, 'Resting in storage: no hunger, no growing up.'),
          h('div', { class: 'care-actions', style: 'grid-template-columns:1fr 1fr' },
            h('button', { class: 'btn small', onClick: () => g.retrieve(c.id) }, `Bring to ${ISLANDS[g.world.current].icon} ${ISLANDS[g.world.current].name}`),
            h('button', { class: 'btn small secondary', disabled: !!noSell, onClick: () => this.confirmSell(c) }, rich(`Sell {coin} ${price.toLocaleString()}`)))));
      } else b.append(h('div', { class: 'care' },
        h('div', { class: 'hunger-row' },
          h('span', { class: 'hunger-ico' }, isHungry(c) ? '🍖' : '🍓'),
          h('div', { class: 'hunger-bar' }, h('div', { class: `progress small ${isHungry(c) ? 'hungry' : ''}` }, h('i', { style: `width:${full}%` })),
            h('span', { class: 'muted' }, isHungry(c) ? 'Hungry! It won\'t dig or breed until it eats.' : c.fullness >= 0.7 ? 'Well fed and happy' : 'Peckish')),
          h('button', { class: `btn small feed-btn ${isHungry(c) ? '' : 'secondary'}`, disabled: c.fullness > 0.97, onClick: () => (foodLeft ? g.feed(c.id) : this.openShopFor('food')) }, foodLeft ? `🍓 Feed (${foodLeft})` : '🍓 Get food')),
        h('div', { class: 'care-actions' },
          h('button', { class: 'btn small secondary', onClick: () => g.store(c.id) }, '📦 Store'),
          h('button', { class: 'btn small secondary', onClick: () => this.showExpeditionPicker(c) }, '🧭 Explore'),
          h('button', { class: 'btn small secondary', disabled: !!noSell, title: noSell ?? '', onClick: () => this.confirmSell(c) }, rich(`${here ? '🎩 ' : ''}Sell {coin} ${price.toLocaleString()}`))),
        noSell ? h('div', { class: 'muted' }, noSell) : null,
        want && !noSell ? h('button', { class: 'market-hint', onClick: () => this.showPets('market') }, rich(`🛒 ${want.buyer} on the Market wants this! Sell there for {coin} ${marketPrice(g.state, want, c).toLocaleString()}`)) : null));
      b.append(this.friendBlock(c));
      b.append(this.metBlock(c));
      b.append(h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('span', { class: 'k' }, `Traits (${c.quirks.length})`),
          ...c.quirks.map((q) => h('div', { class: 'quirk-line' }, h('b', null, `${QUIRKS[q].icon} ${QUIRKS[q].name}`), h('span', { class: 'muted' }, ` ${QUIRKS[q].blurb}`))),
          h('div', { class: 'btns', style: 'margin-top:8px' },
            h('button', { class: 'btn small secondary', onClick: () => (tools.traitDeleter ? this.chooseQuirkToDelete(c) : this.toolHint('traitDeleter')) }, `${TOOLS.traitDeleter.icon} Delete a trait (${tools.traitDeleter ?? 0})`),
            h('button', { class: 'btn small secondary', onClick: () => (tools.traitWiper ? this.confirmWipe(c) : this.toolHint('traitWiper')) }, `${TOOLS.traitWiper.icon} Wipe traits (${tools.traitWiper ?? 0})`))),
        h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Types'), this.traitChips(creatureTraits(c)), h('span', { class: 'muted' }, 'Creatures that share a type can breed.')),
        h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Size'), h('span', { class: 'v' }, `${sizeLabel(c.size)}${c.mutations.includes('giant') ? ' · Giant' : ''} · ${fmtWeight(weightKg(c, g.now()))}`),
          grown < 1
            ? h('div', { class: 'col' }, h('div', { class: 'progress small' }, h('i', { style: `width:${Math.round(grown * 100)}%` })),
              h('span', { class: 'muted' }, `Growing up · ${fmtDuration((1 - grown) * c.growMs)} to go (keeps growing while you're away)`),
              c.stored ? null : h('button', { class: 'btn small secondary', style: 'align-self:flex-start;margin-top:4px', onClick: () => ((g.state.food.sprout ?? 0) ? g.sprout(c.id) : this.openShopFor('food')) },
                (g.state.food.sprout ?? 0) ? `🌿 Sprout Snack (${g.state.food.sprout})` : '🌿 Get Sprout Snacks'))
            : h('span', { class: 'muted' }, `Fully grown (${Math.round(c.size * 100)}% of a typical ${sp.name})`)),
        h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Home'), h('span', { class: 'v' }, `${ISLANDS[c.island].icon} ${ISLANDS[c.island].name}`)),
      ));
      b.append(h('div', { class: 'section-title' }, 'Story'));
      const story = h('div', { class: 'story' });
      for (const e of c.history) story.append(h('div', null, h('div', { class: 'when' }, this.when(e.t)), h('p', null, e.text)));
      b.append(story);
      const pinned = this.game.pinned === c.id;
      const others = ISLAND_ORDER.filter((i) => i !== c.island && s2.islands[i]?.owned);
      b.append(h('div', { class: 'btns' },
        h('button', { class: 'btn', onClick: () => { this.fontPick = [c.id, null]; this.showFont(); } }, '⛲ Create with…'),
        h('button', { class: 'btn secondary', onClick: () => { this.game.setPinned(pinned ? null : c.id); this.rerender(); } }, pinned ? '📌 Unpin' : '📌 Pin to widget'),
        ...(c.stored ? [] : others.map((i) => h('button', { class: 'btn secondary', onClick: () => this.game.moveCreature(c.id, i) }, `${ISLANDS[i].icon} Move to ${ISLANDS[i].name}`))),
        h('button', { class: 'btn danger', onClick: () => this.confirmRelease(c) }, 'Say goodbye'),
      ));
    });
  }

  private when(t: number): string {
    const d = new Date(t);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  private toolHint(id: string): void {
    this.modal((m, close) => {
      m.append(h('h2', null, TOOLS[id].name), h('p', { class: 'muted' }, TOOLS[id].blurb),
        h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Later'),
          h('button', { class: 'btn', onClick: () => { close(); this.openShopFor('item'); } }, 'Visit Mango\'s shop')));
    });
  }

  private chooseQuirkToDelete(c: Creature): void {
    this.modal((m, close) => {
      m.append(h('h2', null, 'Delete which trait?'),
        h('p', { class: 'muted' }, c.quirks.length <= 2 ? 'Creatures always keep at least 2 traits.' : 'Uses 1 Trait Deleter.'),
        h('div', { class: 'col', style: 'gap:6px' }, ...c.quirks.map((q) => h('button', { class: 'btn secondary', disabled: c.quirks.length <= 2, onClick: () => {
          close();
          const r = deleteQuirk(this.game.state, c.id, q);
          this.toast(r.ok ? `✂️ ${r.message}` : r.error);
          this.game.saveSoon();
          this.rerender();
        } }, `${QUIRKS[q].icon} ${QUIRKS[q].name}`))),
        h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Cancel')));
    });
  }

  private confirmWipe(c: Creature): void {
    this.modal((m, close) => {
      m.append(h('h2', null, `Wipe ${displayName(c)}'s traits?`),
        h('p', { class: 'muted' }, `All ${c.quirks.length} traits will be wiped and a fresh random set of 2 to 5 will appear. You can't undo this.`),
        h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Keep them'),
          h('button', { class: 'btn danger', onClick: () => {
            close();
            const r = wipeQuirks(this.game.state, c.id);
            this.toast(r.ok ? `🧽 ${r.message}` : r.error, r.ok ? 'discovery' : 'info', undefined, 4500);
            this.game.saveSoon();
            this.rerender();
          } }, 'Wipe them')));
    });
  }

  /** "How you met": when, how, and what the sky was doing. */
  private metBlock(c: Creature): HTMLElement {
    const m = c.met;
    const sp = species(c.species);
    let how = 'Joined your sanctuary.';
    if (m) {
      switch (m.how) {
        case 'starter': how = 'Was already living here when you arrived.'; break;
        case 'island': how = 'Was waiting for you when you unlocked its world.'; break;
        case 'lure': how = `Answered your ${m.lure ? LURES[m.lure]?.name ?? 'lure' : 'lure'}${m.spot ? ` at the ${SPOTS[m.spot]?.name ?? 'lure spot'}` : ''}.`; break;
        case 'bred': how = m.parents ? `Hatched from an egg you bred from ${m.parents.map((p) => `${p.name}${p.name !== species(p.species).name ? ` (${species(p.species).name})` : ''}`).join(' × ')}.` : 'Hatched from an egg you bred.'; break;
        case 'shop': how = `Hatched from a ${m.tier ? EGG_TIERS[m.tier]?.name ?? 'shop egg' : 'shop egg'} from Mango's shop.`; break;
        case 'dug': how = 'Hatched from an egg one of your creatures dug up.'; break;
        case 'level': how = `A gift for reaching keeper level ${m.level ?? '?'}.`; break;
        case 'pass': how = 'A Halloween Pass exclusive.'; break;
        default: break;
      }
    } else if (sp.origin === 'reward') how = 'A gift for levelling up.';
    const skyName = m?.sky ? (m.sky in EVENTS ? EVENTS[m.sky as keyof typeof EVENTS].name : LEGENDARY[m.sky as keyof typeof LEGENDARY]?.name) : null;
    return h('div', { class: 'met' },
      h('div', { class: 'k' }, 'How you met'),
      h('div', { class: 'met-row' }, h('b', null, '📅 '), this.when(c.bornAt)),
      h('div', { class: 'met-row' }, h('b', null, '🧭 '), how),
      h('div', { class: 'met-row' }, h('b', null, '🌤️ '), skyName ? `It was during ${/^[aeiou]/i.test(skyName) ? 'an' : 'a'} ${skyName.replace(/^The /, '')}.` : m ? 'Under a calm sky.' : 'A long time ago.'));
  }

  /** The sell booth on every world: sell this world's pets one by one, or several at once. */
  showSellBooth(): void {
    const g = this.game;
    const s = g.state;
    const here = g.world.current;
    this.openSheet('Sell booth', `${ISLANDS[here].name} · bigger, rarer and mutated pets sell for more`, (b) => {
      const collector = collectorHere(s, g.now());
      if (collector) b.append(h('p', { class: 'market-hint', style: 'cursor:default' }, '🎩 The Collector is visiting: he pays double (triple for his favourite type). Prices below include it.'));
      const pets = s.creatures.filter((c) => c.island === here && !c.stored && !c.trip)
        .sort((a, b2) => sellPrice(s, b2, collector) - sellPrice(s, a, collector));
      if (!pets.length) b.append(h('p', { class: 'muted' }, 'No pets on this world to sell.'));
      const list = h('div', { class: 'list' });
      for (const c of pets) {
        const why = canSell(s, c);
        const warn = sellWarning(c);
        list.append(h('div', { class: 'item' }, this.portrait(c, 'swatch-img'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `${displayName(c)}${c.favorite ? ' ♥' : ''}`),
            h('div', { class: 'desc row', style: 'gap:6px;flex-wrap:wrap' }, rarityTag(species(c.species).rarity), h('span', { class: 'muted' }, `${sizeLabel(c.size)} · ${fmtWeight(weightKg(c, g.now()))}${c.mutations.length ? ` · ${c.mutations.length} mutation${c.mutations.length === 1 ? '' : 's'}` : ''}`)),
            why ? h('div', { class: 'muted' }, why) : warn ? h('div', { class: 'sell-warn small' }, '❗ Rare! You\'ll be asked to confirm.') : null),
          h('button', { class: 'btn small', disabled: !!why, onClick: () => this.confirmSell(c) }, rich(`{coin} ${sellPrice(s, c, collector).toLocaleString()}`))));
      }
      b.append(list);
      b.append(h('div', { class: 'btns', style: 'margin-top:10px' },
        h('button', { class: 'btn secondary', onClick: () => { this.petsTab = 'wandering'; this.petWorld = here; this.petSel = new Set(); this.showPets('wandering'); } }, 'Sell several at once'),
        h('button', { class: 'btn secondary', onClick: () => this.showPets('market') }, `${marketReady(s, g.now()) ? '❗ ' : ''}Market board`)));
      b.append(h('p', { class: 'muted' }, 'Tip: buyers on the Market board pay much more for the pets they want.'));
    }, '💰');
  }

  private confirmSell(c: Creature): void {
    const g = this.game;
    const here = collectorHere(g.state, g.now());
    const { lines, price } = sellBreakdown(g.state, c, here);
    this.modal((m, close) => {
      const warn = sellWarning(c);
      const x = (n: number) => `×${+n.toFixed(n >= 10 ? 0 : 2)}`;
      const muts = lines.filter((l) => l.kind === 'mutation');
      const mutTotal = muts.reduce((a, l) => a * l.mult, 1);
      const table = h('div', { class: 'sell-math' },
        ...lines.map((l) => h('div', { class: `sell-line ${l.kind} ${l.tier ?? ''}` },
          h('span', null, l.kind === 'mutation' ? `✨ ${l.label} (${l.tier})` : l.label),
          h('b', null, l.kind === 'base' ? rich(`{coin} ${l.mult}`) : x(l.mult)))),
        muts.length ? h('div', { class: 'sell-line total' }, h('span', null, 'Mutations together'), h('b', null, x(mutTotal))) : '',
        h('div', { class: 'sell-line total' }, h('span', null, 'Price'), h('b', null, rich(`{coin} ${price.toLocaleString()}`))));
      m.append(h('h2', null, `Sell ${displayName(c)}?`),
        h('p', { class: 'muted' }, `${sizeLabel(c.size)} · ${fmtWeight(weightKg(c, g.now()))}`),
        warn ? h('p', { class: 'sell-warn' }, `❗ ${warn}`) : '',
        h('p', null, rich(`${here ? 'The Collector offers' : 'You\'ll get'} {coin} ${price}.`)),
        table,
        h('p', { class: 'muted' }, 'Each mutation multiplies the price: Common ×1.3 · Rare ×1.6 · Epic ×2.2 · Legendary ×3.2'),
        h('p', { class: 'muted' }, here ? 'He\'ll give it a lovely home in his travelling menagerie.' : 'Tip: the travelling Collector pays at least double.'),
        h('p', { class: 'muted' }, 'You can\'t undo this.'),
        h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Keep it'),
          h('button', { class: 'btn danger', onClick: () => { close(); g.sell(c.id); } }, 'Sell')));
    });
  }

  // ---- storage and the Collector

  // ---- weekly pet contest

  private contestTab(b: HTMLElement): void {
    const g = this.game;
    const s = g.state;
    const t = g.now();
    const week = weekOf(t);
    const theme = THEMES[themeOf(week)];
    const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
    // last week's results
    if (contestReady(s, t) && s.contest) {
      const place = placeFor(s.contest.score ?? 0, s.contest.week);
      b.append(h('div', { class: 'contest-result' }, h('b', null, `Results are in! ${s.contest.name} placed ${ordinal(place)}.`),
        h('button', { class: 'btn small', onClick: () => g.claimContest() }, 'Collect prize')));
    }
    b.append(h('div', { class: 'contest-head' }, h('span', { class: 'contest-ico' }, theme.icon),
      h('div', null, h('div', { class: 'name' }, `This week: ${theme.name}`), h('div', { class: 'muted' }, theme.blurb),
        h('div', { class: 'muted' }, `Judging in ${fmtDuration(weekEnds(week) - t)} · ${s.trophies ?? 0} trophies so far`))));
    b.append(h('p', { class: 'muted' }, rich(`Prizes: 1st {coin} 1,500 {gem} 20 · 2nd {coin} 800 {gem} 10 · 3rd {coin} 500 {gem} 6 · everyone else {coin} 150`)));
    const entered = s.contest?.week === week && s.contest.entry;
    const board: { name: string; score: number; you?: boolean }[] = rivals(week);
    if (entered) board.push({ name: `${s.contest!.name} (yours)`, score: s.contest!.score ?? 0, you: true });
    board.sort((a, b2) => b2.score - a.score);
    const lb = h('div', { class: 'list' });
    board.forEach((r, i) => lb.append(h('div', { class: `item ${r.you ? 'wanted' : ''}` }, h('b', { class: 'lb-place' }, `${i + 1}`),
      h('div', { class: 'grow name' }, r.name), h('b', null, `${r.score}`))));
    const showBoard = () => b.append(h('div', { class: 'section-title' }, 'Leaderboard'), lb);
    if (entered) {
      showBoard();
      return;
    }
    b.append(h('div', { class: 'section-title' }, 'Enter a pet (one per week)'));
    const list = h('div', { class: 'list' });
    const grown = s.creatures.filter((c) => !c.trip && growth(c, t) >= 1)
      .map((c) => ({ c, score: scorePet(c, themeOf(week), week) })).sort((a, b2) => b2.score - a.score);
    if (!grown.length) b.append(h('p', { class: 'muted' }, 'Only grown-up pets can enter.'));
    for (const { c, score } of grown.slice(0, 12)) {
      list.append(h('div', { class: 'item' }, this.portrait(c, 'swatch-img'),
        h('div', { class: 'grow' }, h('div', { class: 'name' }, displayName(c)), h('div', { class: 'desc' }, `Judges' guess: about ${score} points (${ordinal(placeFor(score, week))} place)`)),
        h('button', { class: 'btn small', onClick: () => g.enterContest(c.id) }, 'Enter')));
    }
    b.append(list);
    showBoard();
  }

  // ---- daily login calendar

  showLoginCalendar(): void {
    const g = this.game;
    const s = g.state;
    const next = loginDay(s);
    const can = canClaimLogin(s, g.now());
    this.modal((m, close) => {
      m.classList.add('login-cal');
      const st = streakNow(s, g.now());
      const nextCount = can ? (st.alive ? st.count + 1 : 1) : st.count;
      const bonus = streakBonus(nextCount);
      const nextMilestone = Object.keys(STREAK_MILESTONES).map(Number).find((d) => d >= (can ? nextCount : st.count + 1));
      m.append(h('h2', null, can ? 'Your daily gift!' : 'Daily gifts'),
        h('div', { class: 'streak-box' },
          h('div', { class: 'streak-flame' }, rich('🔥'), h('b', null, String(st.alive || !can ? st.count : 0))),
          h('div', { class: 'grow' },
            h('b', null, `${st.alive || !can ? st.count : 0}-day streak${st.best > 1 ? ` · best ${st.best}` : ''}`),
            h('div', null, rich(`${can ? 'Today' : 'Tomorrow'}'s streak bonus: {coin} ${bonus.coins}${bonus.shards ? ` {gem} ${bonus.shards}` : ''}`)),
            nextMilestone ? h('div', { class: 'muted' }, `Big present at ${nextMilestone} days in a row. Miss a day and Lotl keeps it warm once a week.`) : '')),
        h('p', { class: 'muted' }, 'A gift for every day you visit. It grows all week, with a big one on day 7.'));
      const grid = h('div', { class: 'cal' });
      // days already claimed this week (all 7 if today's claim finished the week)
      const total = s.login?.claimed ?? 0;
      const done = !can && total > 0 && total % 7 === 0 ? 7 : total % 7;
      for (const r of LOGIN_REWARDS) {
        const claimed = r.day <= done;
        const today = can && r.day === next;
        grid.append(h('div', { class: `cal-day ${today ? 'today' : ''} ${claimed ? 'done' : ''} ${r.day === 7 ? 'big' : ''}` },
          h('b', null, `Day ${r.day}`),
          h('div', { class: 'cal-ico' }, I.icon(r.day === 7 ? I.CREATE : r.shards >= 5 ? I.GEM : I.COIN)),
          h('small', null, rich(`{coin} ${r.coins.toLocaleString()}`)), h('small', null, rich(`{gem} ${r.shards}`)),
          claimed ? h('span', { class: 'cal-check' }, '✓') : ''));
      }
      m.append(grid, h('div', { class: 'btns' },
        can ? h('button', { class: 'btn wide', onClick: () => { close(); g.claimLogin(); } }, `Claim day ${next}!`)
          : h('button', { class: 'btn secondary wide', onClick: close }, 'Come back tomorrow')));
    });
  }

  // ---- expeditions

  /** Where should this pet go exploring? */
  showExpeditionPicker(c: Creature): void {
    const s = this.game.state;
    const lvl = levelOf(s.xp);
    const slots = expeditionSlots(lvl);
    this.modal((m, close) => {
      m.append(h('h2', null, `Send ${displayName(c)} exploring`),
        h('p', { class: 'muted' }, `It's away for a while and comes back with treasure and a story. ${s.expeditions.length} of ${slots} explorers out.`));
      const list = h('div', { class: 'list' });
      for (const id of EXPEDITION_ORDER) {
        const d = EXPEDITIONS[id];
        const locked = lvl < d.level;
        list.append(h('div', { class: `item ${locked ? 'locked' : ''}` }, h('div', { class: 'swatch' }, d.icon),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `${d.name} · ${d.hours} h`),
            h('div', { class: 'desc' }, locked ? `🔒 Keeper level ${d.level}` : d.blurb),
            h('div', { class: 'muted' }, rich(`{coin} ${d.coins[0]}-${d.coins[1]}${d.shardChance >= 0.3 ? ' · often {gem}' : ''}${d.eggChance ? ' · sometimes an egg' : ''}`))),
          h('button', { class: 'btn small', disabled: locked, onClick: () => { close(); this.game.sendExploring(c.id, id); } }, 'Go!')));
      }
      m.append(list, h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Not now')));
    });
  }

  /** The pet is home: what it found, and the story it tells. */
  showExpeditionHaul(c: Creature | null, r: ExpeditionHaul): void {
    this.modal((m, close) => {
      m.append(h('h2', null, c ? `${displayName(c)} is home!` : 'Welcome home!'),
        c ? h('div', { class: 'visitor-pic' }, this.portrait(c, '')) : '',
        h('p', null, r.story),
        h('div', { class: 'haul' },
          h('span', { class: 'quirk' }, rich(`{coin} +${r.coins}`)),
          r.shards ? h('span', { class: 'quirk' }, rich(`{gem} +${r.shards}`)) : '',
          r.item ? h('span', { class: 'quirk' }, `${ITEM_ICON[ITEMS[r.item]?.effect ?? ''] ?? '🧪'} ${ITEMS[r.item]?.name ?? r.item}`) : '',
          r.egg ? h('span', { class: 'quirk' }, '🥚 An egg! (in your basket)') : ''),
        h('div', { class: 'btns' }, h('button', { class: 'btn', onClick: close }, 'Yay!')));
    });
  }

  /** Friendship: five hearts, with Pet and Play buttons. */
  private friendBlock(c: Creature): HTMLElement {
    const g = this.game;
    const n = hearts(c);
    const t = g.now();
    const petWait = c.pettedAt !== undefined ? Math.max(0, PET_COOLDOWN_MIN * 60_000 - (t - c.pettedAt)) : 0;
    const playWait = c.playedAt !== undefined ? Math.max(0, PLAY_COOLDOWN_MIN * 60_000 - (t - c.playedAt)) : 0;
    return h('div', { class: 'friend' },
      h('div', { class: 'friend-top' }, h('span', { class: 'k' }, n >= 5 ? '👑 Best friends!' : 'Friendship'), this.heartsRow(c)),
      n >= 5
        ? h('ul', { class: 'perks' }, ...BEST_FRIEND_PERKS.map((p) => h('li', null, p)))
        : h('div', { class: 'muted' }, n >= 4 ? 'Close friends bring back better finds. One more heart to best friends!'
          : 'Pet, play with and feed it to fill the hearts. Best friends (5 hearts) get a crown and special perks.'),
      h('div', { class: 'btns', style: 'margin-top:6px' },
        h('button', { class: 'btn small', disabled: petWait > 0, onClick: () => g.befriend(c.id, 'pet') }, petWait > 0 ? `✋ Pet (${fmtDuration(petWait)})` : '✋ Pet'),
        h('button', { class: 'btn small', disabled: playWait > 0, onClick: () => g.befriend(c.id, 'play') }, playWait > 0 ? `🎾 Play (${fmtDuration(playWait)})` : '🎾 Play')));
  }

  heartsRow(c: Creature): HTMLElement {
    const n = hearts(c);
    return h('span', { class: 'hearts-row' }, ...[0, 1, 2, 3, 4].map((i) => h('span', { class: `hr ${i < n ? 'on' : ''}` }, I.icon(I.HEART))));
  }

  /** The pet's color shade: a little swatch chip (Pastel and Shiny stand out). */
  private shadeChip(c: Creature): HTMLElement {
    const sh = SHADES[(c.shade ?? 'classic') as ShadeId] ?? SHADES.classic;
    return h('span', { class: `shade-chip s-${sh.id}`, title: 'Color shade' }, sh.id === 'shiny' ? '✦ Shiny' : `${sh.name} shade`);
  }

  /** Favorite: a heart that fills in when you tap it. Favorites can't be sold or released by mistake. */
  private heartToggle(c: Creature): HTMLButtonElement {
    const pop = this.heartPop?.id === c.id && performance.now() - this.heartPop.at < 400;
    const btn = h('button', { class: `fav-heart ${c.favorite ? 'on' : ''} ${pop ? 'pop' : ''}`, 'aria-label': c.favorite ? 'Unfavorite' : 'Favorite', 'aria-pressed': String(!!c.favorite),
      onClick: (e: Event) => {
        e.stopPropagation();
        c.favorite = !c.favorite;
        this.heartPop = { id: c.id, at: performance.now() };
        this.game.audio.play(c.favorite ? 'chime' : 'tap');
        this.game.saveSoon();
        this.rerender();
      } }, I.icon(I.HEART));
    return btn;
  }

  /** Old name for the Storage tab of the Pets list. */
  showStorage(): void {
    this.showPets('storage');
  }

  /** Every creature you have: out on your worlds, or resting in storage. Sortable, with favorites. */
  showPets(tab?: 'wandering' | 'storage' | 'trips' | 'market'): void {
    const g = this.game;
    const s = g.state;
    if (tab) this.petsTab = tab;
    const RANK: Record<string, number> = { mythical: 0, legendary: 1, rare: 2, uncommon: 3, common: 4 };
    const SORTS: { id: PetsSort; label: string; cmp: (a: Creature, b: Creature) => number }[] = [
      { id: 'newest', label: 'Newest', cmp: (a, b) => b.bornAt - a.bornAt },
      { id: 'rarity', label: 'Rarity', cmp: (a, b) => RANK[species(a.species).rarity] - RANK[species(b.species).rarity] || b.bornAt - a.bornAt },
      { id: 'name', label: 'Name', cmp: (a, b) => displayName(a).localeCompare(displayName(b)) },
      { id: 'size', label: 'Size', cmp: (a, b) => b.size - a.size },
      { id: 'hunger', label: 'Hungriest', cmp: (a, b) => a.fullness - b.fullness },
    ];
    if (!tab) this.petSel = null;
    this.openSheet('Pets', 'Tap ♥ to make a Favorite (safe from selling). Press and hold a pet, or tap Select, to pick several at once.', (b) => {
      const out = s.creatures.filter((c) => !c.stored && !c.trip);
      const stored = s.creatures.filter((c) => c.stored);
      const tabBtn = (id: typeof this.petsTab, label: string) =>
        h('button', { class: this.petsTab === id ? 'on' : '', onClick: () => { this.petsTab = id; this.rerender(); } }, label);
      const sort = SORTS.find((x) => x.id === this.petsSort) ?? SORTS[0];
      b.append(h('div', { class: 'tabs pets-tabs' },
        tabBtn('wandering', `Out ${out.length}`), tabBtn('storage', `Stored ${stored.length}`),
        tabBtn('trips', `${s.expeditions.some((e) => e.end <= g.now()) ? '❗ ' : ''}Trips ${s.expeditions.length}`),
        tabBtn('market', `${marketReady(s, g.now()) ? '❗ ' : ''}Market`)),
        this.petsTab === 'market' ? '' : h('div', { class: 'sort-row' }, h('span', { class: 'muted' }, this.petSel ? 'Tap pets to pick them' : 'Favorites first, then'),
          h('button', { class: 'sort-btn', onClick: () => { this.petsSort = SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length].id; this.rerender(); } }, `Sort: ${sort.label} ▾`),
          this.petsTab !== 'trips' ? h('button', { class: `sort-btn ${this.petSel ? 'on' : ''}`, onClick: () => { this.petSel = this.petSel ? null : new Set(); this.rerender(); } }, this.petSel ? 'Cancel' : 'Select') : null));
      const heart = (c: Creature) => this.heartToggle(c);
      const list = h('div', { class: 'list pets' });
      const favFirst = (a: Creature, b2: Creature) => Number(!!b2.favorite) - Number(!!a.favorite) || sort.cmp(a, b2);
      const sel = this.petSel;
      // press and hold a pet to start picking several; tap to add or remove
      const pickable = (row: HTMLElement, c: Creature, open: () => void) => {
        let timer = 0;
        row.addEventListener('pointerdown', (e) => {
          this.longPressFired = false;
          // pressing a button in the row (Feed, the heart...) is just pressing that button
          if ((e.target as Element).closest('button')) return;
          timer = window.setTimeout(() => {
            this.longPressFired = true;
            this.petSel ??= new Set();
            this.petSel.add(c.id);
            navigator.vibrate?.(20);
            this.game.audio.play('tap');
            this.rerender();
          }, 450);
        });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) row.addEventListener(ev, () => clearTimeout(timer));
        row.addEventListener('click', () => {
          if (this.longPressFired) { this.longPressFired = false; return; }
          if (this.petSel) {
            if (this.petSel.has(c.id)) this.petSel.delete(c.id);
            else this.petSel.add(c.id);
            this.rerender();
          } else open();
        });
        if (sel) row.prepend(h('span', { class: `pick ${sel.has(c.id) ? 'on' : ''}` }, sel.has(c.id) ? '✓' : ''));
        return row;
      };
      if (this.petsTab === 'market') {
        this.petSel = null;
        this.marketTab(b);
      } else if (this.petsTab === 'trips') {
        this.petSel = null;
        if (!s.expeditions.length) b.append(h('p', { class: 'muted' }, 'Nobody is exploring. Open a pet\'s card and tap 🧭 Explore to send it on a trip.'));
        for (const e of [...s.expeditions].sort((a, b2) => a.end - b2.end)) {
          const c = s.creatures.find((x) => x.id === e.creatureId);
          const d = EXPEDITIONS[e.dest as ExpeditionId];
          if (!c || !d) continue;
          const back = e.end <= g.now();
          list.append(h('div', { class: `item ${back ? 'wanted' : ''}` }, this.portrait(c, 'swatch-img'),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, displayName(c)), h('div', { class: 'desc' }, `${d.icon} ${d.name}`),
              h('div', { class: 'muted' }, back ? 'Back home and bursting with news!' : `Back in ${fmtDuration(e.end - g.now())}`)),
            h('button', { class: 'btn small', disabled: !back, onClick: () => g.welcomeHome(c.id) }, back ? 'Welcome home' : 'Exploring…')));
        }
        b.append(list);
      } else {
        const owned = ISLAND_ORDER.filter((id) => s.islands[id]?.owned);
        if (this.petWorld !== 'all' && !owned.includes(this.petWorld)) this.petWorld = 'all';
        let shown: Creature[];
        if (this.petsTab === 'wandering') {
          // which world everyone is on, at a glance
          const chip = (id: IslandId | 'all', label: string) =>
            h('button', { class: `chip ${this.petWorld === id ? 'on' : ''}`, onClick: () => { this.petWorld = id; this.rerender(); } }, label);
          b.append(h('div', { class: 'world-filter' }, chip('all', `All ${out.length}`),
            ...owned.map((id) => chip(id, `${ISLANDS[id].icon} ${out.filter((c) => c.island === id).length}/${islandCapacity(s, id)}`))));
          shown = out.filter((c) => this.petWorld === 'all' || c.island === this.petWorld).sort(favFirst);
          const groups = this.petWorld === 'all' ? owned : [this.petWorld];
          for (const w of groups) {
            const here = shown.filter((c) => c.island === w);
            if (!here.length) continue;
            if (groups.length > 1) list.append(h('div', { class: 'pets-world' }, `${ISLANDS[w].icon} ${ISLANDS[w].name}`, h('span', { class: 'muted' }, `${here.length}/${islandCapacity(s, w)}`)));
            for (const c of here) {
              const row = h('div', { class: `item tappable ${sel?.has(c.id) ? 'picked' : ''}` },
                this.portrait(c, 'swatch-img'),
                h('div', { class: 'grow' }, h('div', { class: 'name' }, `${hearts(c) >= 5 ? '👑 ' : ''}${displayName(c)}`),
                  h('div', { class: 'desc row', style: 'gap:6px;flex-wrap:wrap' }, rarityTag(species(c.species).rarity), h('span', { class: 'muted' }, `${ISLANDS[c.island].icon} ${ISLANDS[c.island].name} · ${fmtWeight(weightKg(c, g.now()))}`)),
                  h('div', { class: `progress tiny ${isHungry(c) ? 'hungry' : ''}` }, h('i', { style: `width:${Math.round(c.fullness * 100)}%` }))),
                heart(c),
                sel ? null : h('div', { class: 'row-btns' },
                  h('button', { class: `btn small ${isHungry(c) ? '' : 'secondary'}`, disabled: c.fullness > 0.97, 'aria-label': `Feed ${displayName(c)}`,
                    onClick: (e: Event) => { e.stopPropagation(); g.feed(c.id); } }, '🍓 Feed'),
                  h('button', { class: 'btn small secondary', 'aria-label': `Store ${displayName(c)}`,
                    onClick: (e: Event) => { e.stopPropagation(); if (g.store(c.id, true)) this.rerender(); } }, '📦 Store')));
              list.append(pickable(row, c, () => { this.closeSheet(false); this.focusCreature(c.id); }));
            }
          }
        } else {
          shown = stored.sort(favFirst);
          b.append(h('p', { class: 'muted' }, `${stored.length} of ${s.storageSlots} storage slots used.`));
          if (!stored.length) b.append(h('p', { class: 'muted' }, 'Nobody is in storage. Store a creature to rest it here: no hunger, no growing, and it frees a spot on its world.'));
          for (const c of shown) {
            const row = h('div', { class: `item tappable ${sel?.has(c.id) ? 'picked' : ''}` }, this.portrait(c, 'swatch-img'),
              h('div', { class: 'grow' }, h('div', { class: 'name' }, displayName(c)), h('div', { class: 'desc row', style: 'gap:6px' }, rarityTag(species(c.species).rarity), h('span', { class: 'muted' }, fmtWeight(weightKg(c, g.now()))))),
              heart(c),
              sel ? null : h('button', { class: 'btn small', onClick: (e: Event) => { e.stopPropagation(); g.retrieve(c.id); } }, `Bring to ${ISLANDS[g.world.current].icon}`));
            list.append(pickable(row, c, () => this.showCreature(c.id)));
          }
        }
        b.append(list);
        if (this.petsTab === 'storage') {
          const price = nextSlotPrice(s);
          b.append(h('button', { class: 'btn wide', style: 'margin-top:10px', disabled: price === null || s.glimmer < price, onClick: () => g.buySlot() },
            price === null ? 'Storage is as big as it gets' : rich(`Add a storage slot · {coin} ${price.toLocaleString()}`)));
        }
        if (sel) {
          // drop anyone who left the list (sold, moved tab...)
          for (const id of [...sel]) if (!shown.some((c) => c.id === id)) sel.delete(id);
          const picked = shown.filter((c) => sel.has(c.id));
          const here = collectorHere(s, g.now());
          const total = picked.reduce((n, c) => n + (canSell(s, c) ? 0 : sellPrice(s, c, here)), 0);
          const none = picked.length === 0;
          b.append(h('div', { class: 'bulk-bar' },
            h('div', { class: 'bulk-top' },
              h('b', null, `${picked.length} picked`),
              h('button', { class: 'sort-btn', onClick: () => { picked.length === shown.length ? sel.clear() : shown.forEach((c) => sel.add(c.id)); this.rerender(); } }, picked.length === shown.length && shown.length ? 'None' : 'All'),
              h('button', { class: 'sort-btn', onClick: () => { this.petSel = null; this.rerender(); } }, 'Done')),
            h('div', { class: 'bulk-btns' },
              h('button', { class: 'btn small', disabled: none || !total, onClick: () => this.confirmBulk('sell', picked, total) }, rich(`Sell {coin} ${total.toLocaleString()}`)),
              this.petsTab === 'wandering'
                ? h('button', { class: 'btn small secondary', disabled: none, onClick: () => g.bulk('store', picked.map((c) => c.id)) }, '📦 Store')
                : h('button', { class: 'btn small secondary', disabled: none, onClick: () => g.bulk('retrieve', picked.map((c) => c.id)) }, `Bring to ${ISLANDS[g.world.current].icon}`),
              this.petsTab === 'wandering' && owned.length > 1
                ? h('button', { class: 'btn small secondary', disabled: none, onClick: () => this.pickWorldFor(picked) }, '🧭 Move')
                : null,
              h('button', { class: 'btn small danger', disabled: none, onClick: () => this.confirmBulk('release', picked, 0) }, 'Release'))));
        }
      }
    }, I.PAW);
  }

  /** Today's Market board: three buyers, each paying well over the usual price for what they want. */
  private marketTab(b: HTMLElement): void {
    const g = this.game;
    const s = g.state;
    const t = g.now();
    b.append(h('p', { class: 'muted' }, 'Three buyers visit each day. Sell them what they want for much more than the usual price, plus a bonus. New buyers tomorrow.'));
    for (const w of marketWants(s, t)) {
      const done = wantFilled(s, w, t);
      const matches = s.creatures.filter((c) => !c.trip && wantMatches(w, c))
        .sort((a, b2) => marketPrice(s, w, b2) - marketPrice(s, w, a));
      const card = h('div', { class: `market-want ${done ? 'done' : ''}` },
        h('div', { class: 'market-head' }, h('div', { class: 'grow' }, h('div', { class: 'name' }, w.text), h('div', { class: 'muted' }, `${w.buyer} pays ×${w.mult} the usual price`)),
          h('div', { class: 'market-bonus' }, rich(`+{coin} ${w.bonusCoins}`), h('br'), rich(`+{gem} ${w.bonusShards}`))));
      if (done) card.append(h('div', { class: 'market-done' }, '✓ Sold! Back tomorrow with something new.'));
      else if (!matches.length) card.append(h('div', { class: 'muted', style: 'margin-top:6px' }, 'None of your pets fit yet. Breed or lure one, then come back.'));
      else {
        for (const c of matches.slice(0, 4)) {
          const why = canSell(s, c);
          card.append(h('div', { class: 'item' }, this.portrait(c, 'swatch-img'),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, displayName(c)), h('div', { class: 'desc' }, why ?? `${sizeLabel(c.size)} · ${fmtWeight(weightKg(c, g.now()))}${c.mutations.length ? ` · ${c.mutations.length} mutation${c.mutations.length === 1 ? '' : 's'}` : ''}`)),
            h('button', { class: 'btn small', disabled: !!why, onClick: () => g.fillWant(w.id, c.id) }, rich(`Sell {coin} ${marketPrice(s, w, c).toLocaleString()}`))));
        }
      }
      b.append(card);
    }
  }

  /** A friendly wanderer's menu: a free kindness and a few deals. */
  showWanderer(): void {
    const g = this.game;
    const w0 = g.state.wanderer;
    if (!w0 || w0.kind === 'goblin') return;
    const def = WANDERERS[w0.kind];
    this.openSheet(def.name, def.blurb, (b) => {
      const s = g.state;
      const w = s.wanderer;
      if (!w) {
        b.append(h('p', { class: 'muted' }, 'They\'ve gone on their way. They\'ll be back another day.'));
        return;
      }
      b.append(h('p', { class: 'muted' }, `Staying a little longer on ${ISLANDS[w.island].name}: about ${fmtDuration(Math.max(0, w.until - g.now()))}.`));
      const list = h('div', { class: 'list' });
      for (const d of wandererDeals(s, w)) {
        const done = w.done?.includes(d.id);
        const price = d.coins ? rich(`{coin} ${d.coins.toLocaleString()}`) : d.shards ? rich(`{gem} ${d.shards}`) : d.free ? 'Free' : 'Sell';
        const short = (d.coins ?? 0) > s.glimmer || (d.shards ?? 0) > s.shards;
        list.append(h('div', { class: `item ${d.free ? 'wanted' : ''}` },
          h('div', { class: 'grow' }, h('div', { class: 'name' }, d.label), h('div', { class: 'desc' }, d.desc)),
          done ? h('span', { class: 'chip on' }, '✓ Done')
            : h('button', { class: `btn small ${d.shards ? 'shard' : ''}`, disabled: short, onClick: () => (d.needsPet ? this.pickPetForTrade(d.id) : g.takeDeal(d.id)) }, d.needsPet ? 'Pick a pet' : price)));
      }
      b.append(list, h('button', { class: 'btn secondary wide', style: 'margin-top:12px', onClick: () => g.sayGoodbye() }, '👋 Say goodbye'));
    }, def.icon);
  }

  /** Which pet will Digby take in trade? */
  private pickPetForTrade(dealId: string): void {
    const s = this.game.state;
    const pets = s.creatures.filter((c) => !c.trip && !canSell(s, c));
    this.modal((m, close) => {
      m.append(h('h2', null, 'Trade which pet?'),
        h('p', { class: 'muted' }, 'Commons get a Wanderer Egg; anything rarer gets a Starry Egg. Favorites and level gifts stay home.'),
        pets.length ? h('div', { class: 'list' }, ...pets.map((c) => h('div', { class: 'item' }, this.portrait(c, 'swatch-img'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, displayName(c)), h('div', { class: 'desc' }, rarityTag(species(c.species).rarity))),
          h('button', { class: 'btn small', onClick: () => { close(); this.game.takeDeal(dealId, c.id); } }, species(c.species).rarity === 'common' ? 'For a Wanderer Egg' : 'For a Starry Egg'))))
          : h('p', null, 'Nobody can be traded right now.'),
        h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Cancel')));
    });
  }

  clearPetSelection(): void {
    this.petSel = null;
  }

  /**
   * Two saves disagree (or a save turned up on a new phone): show both and let
   * the player choose. Nothing is replaced until they tap one.
   */
  showSaveChoice(local: SaveSummary, cloud: SaveSummary, onPick: (pick: 'local' | 'cloud') => void, found: boolean): void {
    const ago = (t: number) => {
      const m = Math.max(0, Math.round((this.game.now() - t) / 60000));
      return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
    };
    const service = this.game.cloudStatus?.service ?? 'the cloud';
    let done = () => {};
    const card = (s: SaveSummary, title: string, which: 'local' | 'cloud', best: boolean) =>
      h('div', { class: `save-card ${best ? 'best' : ''}` },
        h('div', { class: 'save-where' }, which === 'cloud' ? `☁️ ${title}` : `📱 ${title}`),
        h('div', { class: 'save-level' }, `★ Level ${s.level}`),
        h('div', { class: 'save-stats' },
          h('div', null, `${s.creatures} creatures`), h('div', null, `${s.species} kinds found`),
          h('div', null, `${s.worlds} world${s.worlds === 1 ? '' : 's'}`), h('div', null, rich(`{coin} ${s.coins.toLocaleString()}`))),
        h('div', { class: 'muted' }, `${s.device} · saved ${ago(s.savedAt)}`),
        h('button', { class: `btn ${best ? '' : 'secondary'} wide`, onClick: () => { done(); onPick(which); } }, which === 'cloud' ? 'Play this one' : 'Keep this one'));
    const cloudBest = cloud.level > local.level || (cloud.level === local.level && cloud.species >= local.species);
    this.modal((m, close) => {
      done = close;
      m.classList.add('save-choice');
      m.append(h('h2', null, found ? 'We found your save!' : 'Which save do you want?'),
        h('p', { class: 'muted' }, found
          ? `There's a Pocket Grove save in your ${service}. Pick up where you left off, or keep this new game.`
          : `This device and your ${service} have different saves. Pick the one to keep playing; the other is kept as a backup on this device.`),
        h('div', { class: 'save-cards' }, card(local, 'This device', 'local', !cloudBest), card(cloud, service, 'cloud', cloudBest)));
    }, false);
  }

  /** Sell or release everyone picked, after one clear check. */
  private confirmBulk(kind: 'sell' | 'release', picked: Creature[], total: number): void {
    const s = this.game.state;
    // you always keep at least two out on your worlds
    let outLeft = s.creatures.filter((c) => !c.stored && !c.trip).length;
    const ok = picked.filter((c) => {
      if (kind === 'sell' ? canSell(s, c) : c.favorite || c.trip) return false;
      if (!c.stored) {
        if (outLeft <= 2) return false;
        outLeft -= 1;
      }
      return true;
    });
    const skipped = picked.length - ok.length;
    if (kind === 'sell') total = ok.reduce((n, c) => n + sellPrice(s, c, collectorHere(s, this.game.now())), 0);
    this.modal((m, close) => {
      m.append(h('h2', null, kind === 'sell' ? `Sell ${ok.length} pet${ok.length === 1 ? '' : 's'}?` : `Release ${ok.length} pet${ok.length === 1 ? '' : 's'}?`),
        h('div', { class: 'bulk-faces' }, ...ok.slice(0, 8).map((c) => this.portrait(c, 'swatch-img')), ok.length > 8 ? h('span', { class: 'muted' }, `+${ok.length - 8}`) : null),
        kind === 'sell' ? h('p', { class: 'lv-rewards', style: 'text-align:center' }, rich(`{coin} +${total.toLocaleString()}`)) : h('p', { class: 'muted' }, 'They\'ll wander back into the wild. You can\'t undo this.'),
        ...(skipped ? [h('p', { class: 'muted' }, `${skipped} can't be ${kind === 'sell' ? 'sold' : 'released'} (favorites, pets on a trip, or your last two) and will stay.`)] : []),
        ...(ok.some((c) => sellWarning(c)) ? [h('p', { class: 'sell-warn' }, `❗ This includes ${ok.filter((c) => sellWarning(c)).map((c) => displayName(c)).slice(0, 3).join(', ')}${ok.filter((c) => sellWarning(c)).length > 3 ? '…' : ''}: Legendary or rarer, or a level gift. Are you sure?`)] : []),
        h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Keep them'),
          h('button', { class: `btn ${kind === 'release' ? 'danger' : ''}`, disabled: !ok.length, onClick: () => { close(); this.game.bulk(kind, ok.map((c) => c.id)); } },
            kind === 'sell' ? 'Sell' : 'Release')));
    });
  }

  /** Where should the picked pets go? */
  private pickWorldFor(picked: Creature[]): void {
    const s = this.game.state;
    this.modal((m, close) => {
      m.append(h('h2', null, `Move ${picked.length} pet${picked.length === 1 ? '' : 's'} to…`),
        h('div', { class: 'col', style: 'gap:6px' }, ...ISLAND_ORDER.filter((id) => s.islands[id]?.owned).map((id) => {
          const room = islandCapacity(s, id) - s.creatures.filter((c) => c.island === id && !c.stored && !c.trip).length;
          return h('button', { class: 'btn secondary', disabled: room <= 0, onClick: () => { close(); this.game.bulkMove(picked.map((c) => c.id), id); } },
            `${ISLANDS[id].icon} ${ISLANDS[id].name} · ${room > 0 ? `${room} free` : 'full'}`);
        })),
        h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Cancel')));
    });
  }

  showCollector(): void {
    const s = this.game.state;
    const g = this.game;
    if (!collectorHere(s, g.now())) return this.toast('The Collector has moved on. He\'ll be back!');
    this.openSheet('The Collector', `He pays double, and triple for ${s.collector.wants} creatures. Leaves in ${fmtDuration(s.collector.until - g.now())}.`, (b) => {
      const list = h('div', { class: 'list' });
      for (const c of s.creatures.filter((x) => !x.stored)) {
        const why = canSell(s, c);
        const wanted = species(c.species).traits.includes(s.collector.wants);
        list.append(h('div', { class: `item ${wanted ? 'wanted' : ''}` }, this.portrait(c, 'swatch-img'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `${displayName(c)}${wanted ? ' ⭐' : ''}`), h('div', { class: 'desc row', style: 'gap:6px' }, why ?? rarityTag(species(c.species).rarity), h('span', { class: 'muted' }, fmtWeight(weightKg(c, g.now()))))),
          h('button', { class: 'btn small', disabled: !!why, onClick: () => this.confirmSell(c) }, rich(`{coin} ${sellPrice(s, c, true)}`))));
      }
      b.append(list);
    }, '🎩');
  }

  private confirmRelease(c: Creature): void {
    this.modal((m, close) => {
      m.append(h('h2', null, `Say goodbye to ${displayName(c)}?`),
        h('p', { class: 'muted' }, 'It will wander off into the wild. Your journal will remember it.'),
        h('div', { class: 'btns' },
          h('button', { class: 'btn secondary', onClick: close }, 'Keep'),
          h('button', { class: 'btn danger', onClick: () => {
            close();
            if (this.game.release(c.id)) this.closeSheet();
          } }, 'Goodbye')));
    });
  }

  // ---- lure visitors

  /** A visitor waiting at a lure: keep it, or send it on its way. */
  showVisitor(id: string): void {
    const g = this.game;
    const v = findVisitor(g.state, id);
    if (!v) return;
    g.seenVisitors.add(id);
    const c = v.creature;
    const sp = species(c.species);
    const known = (g.state.journal.species[c.species]?.count ?? 0) > 1;
    this.modal((m, close) => {
      m.append(h('h2', null, `A visitor: ${speciesTitle(c)}`),
        h('div', { class: 'visitor-pic' }, this.portrait(c, '')),
        h('div', { class: 'met-row', style: 'text-align:center' }, rarityTag(sp.rarity)),
        this.traitChips(creatureTraits(c)),
        h('p', { class: 'muted' }, `${known ? '' : 'Your first one! '}It followed the scent to the ${SPOTS[v.spot].name} and is waiting to meet you. It will wander off in ${fmtDuration(v.until - g.now())}.`),
        h('div', { class: 'btns' },
          h('button', { class: 'btn secondary', onClick: () => { close(); g.sendAwayVisitor(id); } }, rich(`Send away · +{coin} ${visitorThanks(c)}`)),
          h('button', { class: 'btn', onClick: () => { close(); g.keepVisitor(id); } }, 'Keep it!')));
    });
  }

  /**
   * A world is full: store or release someone to make room, then carry on.
   * `elsewhere` (optional) offers to send the newcomer to another world with room instead.
   */
  showMakeSpace(island: IslandId, onDone: () => void, elsewhere?: (to: IslandId) => void, intoStorage?: () => void): void {
    const g = this.game;
    const s = g.state;
    const cap = islandCapacity(s, island);
    this.modal((m, close) => {
      const here = s.creatures.filter((c) => c.island === island && !c.stored);
      m.append(h('h2', null, `${ISLANDS[island].name} is full`),
        h('p', { class: 'muted' }, `${here.length} of ${cap} creatures live here. Make space by storing or releasing someone${elsewhere ? ', or send the newcomer to another world' : ''}.`));
      if (elsewhere) {
        const others = ISLAND_ORDER.filter((id) => id !== island && s.islands[id]?.owned
          && s.creatures.filter((c) => c.island === id && !c.stored).length < islandCapacity(s, id));
        if (others.length) {
          m.append(h('div', { class: 'btns wrap' }, ...others.map((id) => h('button', { class: 'btn small', onClick: () => { close(); elsewhere(id); } }, `Send to ${ISLANDS[id].icon} ${ISLANDS[id].name}`))));
        }
      }
      // quickest of all: the newcomer goes straight into storage
      if (intoStorage && storedCount(s) < s.storageSlots) {
        m.append(h('button', { class: 'btn wide', style: 'margin:6px 0', onClick: () => { close(); intoStorage(); } }, `📦 Put the newcomer in storage (${storedCount(s)}/${s.storageSlots})`));
      }
      // pick one or several (Store or Release each), then confirm
      const picks = new Map<string, 'store' | 'release'>();
      const list = h('div', { class: 'list make-space' });
      const room = () => s.storageSlots - storedCount(s);
      const confirm = h('button', { class: 'btn', disabled: true }) as HTMLButtonElement;
      const refresh = () => {
        const n = picks.size;
        const st = [...picks.values()].filter((x) => x === 'store').length;
        confirm.disabled = n === 0;
        setText(confirm, n ? `Confirm (${st ? `store ${st}` : ''}${st && n - st ? ', ' : ''}${n - st ? `release ${n - st}` : ''})` : 'Pick who to store or release');
        list.querySelectorAll<HTMLElement>('.item[data-row]').forEach((row) => {
          const a = picks.get(row.dataset.row!);
          row.classList.toggle('pick-store', a === 'store');
          row.classList.toggle('pick-release', a === 'release');
        });
        list.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach((b) => {
          const on = picks.get(b.dataset.id!) === b.dataset.act;
          // same as Store: grey until picked, then filled in (Release turns red) with a tick
          b.classList.toggle('secondary', !on);
          if (b.dataset.act === 'release') b.classList.toggle('danger', on);
          setText(b, `${on ? '✓ ' : ''}${b.dataset.act === 'store' ? 'Store' : 'Release'}`);
          if (b.dataset.act === 'store') b.disabled = !on && room() - st <= 0;
        });
      };
      const pickBtn = (c: Creature, act: 'store' | 'release', label: string, disabled: boolean) =>
        h('button', { class: 'btn small secondary', 'data-id': c.id, 'data-act': act, disabled, onClick: () => {
          const had = picks.get(c.id);
          if (had === act) picks.delete(c.id);
          else if (had) return this.fail(`${displayName(c)} is set to ${had === 'store' ? 'Store' : 'Release'}. Tap it again to undo first.`);
          else picks.set(c.id, act);
          refresh();
        } }, label);
      for (const c of here) {
        list.append(h('div', { class: 'item', 'data-row': c.id }, this.portrait(c, 'swatch-img'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `${c.favorite ? '♥ ' : ''}${displayName(c)}`), h('div', { class: 'desc' }, rarityTag(species(c.species).rarity))),
          pickBtn(c, 'store', 'Store', room() <= 0),
          pickBtn(c, 'release', 'Release', !!c.favorite)));
      }
      m.append(list);
      if (room() <= 0) m.append(h('p', { class: 'muted' }, `Storage is full (${s.storageSlots} slots). You can add slots from the Storage list.`));
      confirm.addEventListener('click', () => {
        const store = [...picks].filter(([, a]) => a === 'store').map(([id]) => id);
        const release = [...picks].filter(([, a]) => a === 'release').map(([id]) => id);
        if (store.length) g.bulk('store', store);
        if (release.length) g.bulk('release', release);
        close();
        onDone();
      });
      refresh();
      m.append(h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Not now'), confirm));
    });
  }

  /** Tapped a scenery tree: chop it down to make room? */
  confirmChop(island: IslandId, index: number): void {
    this.modal((m, close) => {
      m.append(h('h2', null, 'Chop down this tree?'),
        h('p', { class: 'muted' }, 'It makes room for decorations. A little stump stays behind, and you can sell the wood for a few coins. This can\'t be undone.'),
        h('div', { class: 'btns' },
          h('button', { class: 'btn secondary', onClick: close }, 'Keep it'),
          h('button', { class: 'btn', onClick: () => { close(); this.game.chop(island, index); } }, '🪓 Chop')));
    });
  }

  /** You dropped one creature on another: offer to breed them. Both parents stay. */
  confirmBreed(a: Creature, b: Creature): void {
    const s = this.game.state;
    const comp = compatibility(a, b);
    const free = placedNests(s).filter((n) => !nestOccupant(s, n.id)).length;
    const hungry = [a, b].find((c) => isHungry(c));
    const ready = comp.ok && free > 0 && !hungry;
    const parent = (c: Creature) => h('div', { class: 'breed-parent' },
      this.portrait(c, 'breed-pic'), h('b', null, displayName(c)), rarityTag(species(c.species).rarity));
    const note = !comp.ok ? (comp.reason ?? 'They need at least one type in common.')
      : hungry ? `${displayName(hungry)} is too hungry to breed. Feed it first.`
        : !free ? 'Every nest is full. Hatch an egg first, or add a nest.'
          : `Both stay with you · ${free} free nest${free === 1 ? '' : 's'}`;
    this.modal((m, close) => {
      m.classList.add('breed-modal');
      m.append(
        h('h2', null, 'Make an egg?'),
        h('div', { class: 'breed-parents' }, parent(a), h('div', { class: `breed-link ${comp.ok ? '' : 'no'}` }, comp.ok ? '💞' : I.icon(I.CLOSE)), parent(b)),
        ...(comp.ok ? [h('div', { class: 'breed-egg' }, I.icon(I.CREATE), h('span', null, '?')),
          h('div', { class: 'breed-shared' }, h('span', { class: 'muted' }, 'Shared:'), this.traitChips(comp.shared, comp.shared))] : []),
        h('p', { class: `breed-note ${ready ? '' : 'warn'}` }, note),
        h('div', { class: 'breed-btns' },
          ready ? h('button', { class: 'btn wide', onClick: () => { close(); this.game.combine(a.id, b.id); } }, '💞 Breed!') : null,
          hungry && comp.ok ? h('button', { class: 'btn wide', onClick: () => { this.game.feed(hungry.id); close(); this.confirmBreed(a, b); } }, `🍓 Feed ${displayName(hungry)}`) : null,
          h('button', { class: 'btn secondary wide', onClick: close }, ready ? 'Not now' : 'OK')),
      );
    });
  }

  /** How to get around a globe. Shown the first time, and from Settings. */
  showControls(): void {
    this.modal((m, close) => {
      const row = (svg: string, title: string, text: string) =>
        h('div', { class: 'ctl-row' }, h('span', { class: 'ctl-ico' }, I.icon(svg)), h('div', null, h('b', null, title), h('div', { class: 'muted' }, text)));
      m.append(h('h2', null, 'Getting around'),
        row(I.GESTURE_DRAG, 'Drag', 'Roll your world any way to look all around it.'),
        row(I.GESTURE_PINCH, 'Pinch (or mouse wheel)', 'Zoom in close or pull back.'),
        row(I.GESTURE_TWIST, 'Two-finger twist', 'Spin the globe.'),
        row(I.GESTURE_HOLD, 'Press and hold a creature', 'Pick it up and carry it. Drop it on another creature to breed, or on a dig spot.'),
        row(I.GESTURE_TAP, 'Tap', 'Choose things: creatures, nests, the shop, lure spots.'),
        h('div', { class: 'btns' }, h('button', { class: 'btn', onClick: close }, 'Got it!')));
    });
  }

  // ---- quests

  showQuests(): void {
    const s = this.game.state;
    refreshDailies(s, this.game.now());
    this.openSheet('Quests', 'Finish them for coins, Starshards and XP.', (b) => {
      const tab = (id: typeof this.questTab, label: string) =>
        h('button', { class: this.questTab === id ? 'on' : '', onClick: () => { this.questTab = id; this.rerender(); } }, label);
      const ready = claimableBy(s);
      b.append(h('div', { class: 'tabs' }, tab('daily', `☀️ Daily${ready.daily ? ' ❗' : ''}`), tab('lasting', `🏆 Lasting${ready.lasting ? ' ❗' : ''}`), tab('contest', `🏅 Contest${contestReady(s, this.game.now()) ? ' ❗' : ''}`),
        h('button', { class: canClaimLogin(s, this.game.now()) ? 'on' : '', onClick: () => this.showLoginCalendar() }, `📅 Gifts${canClaimLogin(s, this.game.now()) ? ' ❗' : ''}`)));
      const list = h('div', { class: 'list' });
      const reward = (r: { coins: number; shards: number; xp: number }) => rich(`{coin} ${r.coins}  ·  {gem} ${r.shards}  ·  ★ ${r.xp} XP`);
      if (this.questTab === 'contest') {
        this.contestTab(b);
        return;
      }
      if (this.questTab === 'daily') {
        const wk = weekState(s, this.game.now());
        const wdone = wk.progress >= wk.theme.goal.target;
        b.append(h('div', { class: `item week-card ${wk.theme.big ? 'big' : ''}` },
          h('div', { class: 'week-ico' }, rich(wk.theme.icon)),
          h('div', { class: 'grow' },
            h('div', { class: 'name' }, `${wk.theme.name}`, h('span', { class: 'muted' }, ` · ends in ${fmtDuration(wk.endsAt - this.game.now())}`)),
            h('div', { class: 'desc' }, `${wk.theme.blurb} Bonus: ${wk.theme.boostText}.`),
            h('div', { class: 'desc' }, rich(`Goal: ${wk.theme.goal.text} (${Math.min(wk.progress, wk.theme.goal.target)}/${wk.theme.goal.target}) → {coin} ${wk.theme.reward.coins} {gem} ${wk.theme.reward.shards}${wk.theme.reward.egg ? ' + 🥚' : ''}`)),
            h('div', { class: 'progress' }, h('i', { style: `width:${Math.round(Math.min(1, wk.progress / wk.theme.goal.target) * 100)}%` }))),
          wk.claimed ? h('span', { class: 'chip' }, '✓') : h('button', { class: 'btn small', disabled: !wdone, onClick: () => { this.game.claimWeek(); this.rerender(); } }, 'Claim')));
        const rumour = todaysRumour(s, this.game.now());
        if (rumour) {
          b.append(h('div', { class: `item rumour ${rumour.found ? 'done' : ''}` }, h('div', { class: 'grow' },
            h('div', { class: 'name' }, rumour.found ? '🦎 Rumour solved! ✓' : '🦎 Today\'s rumour'),
            h('div', { class: 'desc' }, rumourText(rumour.species)),
            h('div', { class: 'desc' }, rich(rumour.found ? `You found the ${species(rumour.species).name}.` : `Find it today for {coin} ${RUMOUR_REWARD.coins} and {gem} ${RUMOUR_REWARD.shards}.`)))));
        }
        const left = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1) - Date.now();
        b.append(h('p', { class: 'muted' }, `New daily quests in ${fmtDuration(left)}.`));
        for (const q of s.quests.daily) {
          const def = DAILY_POOL.find((d) => d.id === q.id);
          if (!def) continue;
          const done = q.progress >= def.target;
          list.append(h('div', { class: `item quest ${q.claimed ? 'claimed' : ''}` },
            h('div', { class: 'grow' }, h('div', { class: 'name' }, def.text), h('div', { class: 'desc' }, reward(def.reward)),
              h('div', { class: 'progress small' }, h('i', { style: `width:${Math.round((q.progress / def.target) * 100)}%` })),
              h('div', { class: 'muted' }, `${q.progress} / ${def.target}`)),
            q.claimed ? h('span', { class: 'quest-done' }, '✓') : h('button', { class: 'btn small', disabled: !done, onClick: () => this.game.claimQuest('daily', q.id) }, done ? 'Claim' : '…')));
        }
      } else {
        for (const def of LASTING) {
          const tier = s.quests.tiers[def.id] ?? 0;
          const all = tier >= def.tiers.length;
          const target = def.tiers[Math.min(tier, def.tiers.length - 1)];
          const prog = Math.min(target, def.progress(s));
          list.append(h('div', { class: `item quest ${all ? 'claimed' : ''}` },
            h('div', { class: 'swatch' }, def.icon),
            h('div', { class: 'grow' },
              h('div', { class: 'name' }, `${def.name} ${'★'.repeat(tier)}${'☆'.repeat(def.tiers.length - tier)}`),
              h('div', { class: 'desc' }, all ? 'Every tier complete!' : def.text.replace('{n}', target.toLocaleString())),
              all ? null : h('div', { class: 'desc' }, reward(lastingReward(tier))),
              all ? null : h('div', { class: 'progress small' }, h('i', { style: `width:${Math.round((prog / target) * 100)}%` })),
              all ? null : h('div', { class: 'muted' }, `${prog.toLocaleString()} / ${target.toLocaleString()}`)),
            all ? h('span', { class: 'quest-done' }, '🏆') : h('button', { class: 'btn small', disabled: prog < target, onClick: () => this.game.claimQuest('lasting', def.id) }, prog >= target ? 'Claim' : '…')));
        }
      }
      b.append(list);
    }, '📜');
  }

  // ---- keeper levels

  /** Your level, how to earn XP, and every reward from 1 to 100. */
  showLevels(): void {
    const s = this.game.state;
    const lp = levelProgress(s.xp);
    let scrolled = false;
    this.openSheet(`Keeper level ${lp.level}`, lp.level >= MAX_LEVEL ? 'You reached the top. Grand Keeper!' : `${lp.into.toLocaleString()} / ${lp.need.toLocaleString()} XP to level ${lp.level + 1}`, (b) => {
      b.append(h('div', { class: 'progress', style: 'margin:4px 0 8px' }, h('i', { style: `width:${Math.round(lp.pct * 100)}%` })));
      b.append(h('p', { class: 'muted' }, `Earn XP by hatching, breeding, setting lures, digging, discovering and finishing quests. Every level gives coins and Starshards. Every 5th level up to ${STAR_LEVEL}, then every 10th, brings a creature you can only get here. Past level ${STAR_LEVEL} you become a Star Keeper.`));
      const list = h('div', { class: 'list' });
      let current: HTMLElement | null = null;
      for (let l = 2; l <= MAX_LEVEL; l++) {
        const r = levelReward(l);
        const done = lp.level >= l;
        const sp = r.creature ? species(r.creature) : null;
        const row = h('div', { class: `item lv-row ${done ? 'done' : ''} ${l === lp.level + 1 ? 'next' : ''} ${sp ? 'big' : ''}` },
          h('div', { class: 'swatch lv-swatch' }, done ? '✓' : String(l)),
          h('div', { class: 'grow' },
            h('div', { class: 'name' }, `Level ${l}`),
            h('div', { class: 'desc' }, rich(`{coin} ${r.coins.toLocaleString()}  ·  {gem} ${r.shards}`)),
            sp ? h('div', { class: 'desc', style: 'font-weight:700;color:#8a4ad0' }, done || s.journal.species[sp.id] ? `+ ${sp.name}!` : '+ a mystery creature!') : null),
          sp ? img(this.game.world.portraits.get(sp.id, [], !(done || s.journal.species[sp.id])), 'lv-pic') : null);
        if (l === lp.level + 1) current = row;
        if (l === STAR_LEVEL + 1) list.append(h('div', { class: 'lv-divider' }, '★ Star Keeper levels ★'));
        list.append(row);
      }
      b.append(list);
      if (current && !scrolled) {
        scrolled = true;
        setTimeout(() => current!.scrollIntoView({ block: 'center' }), 60);
      }
    }, '★');
  }

  /** Celebrate reaching a level. */
  showLevelUp(up: LevelUp): void {
    this.game.audio.play('fanfare');
    const sp = up.creature ? species(up.creature) : null;
    const c = up.creatureId ? this.game.state.creatures.find((x) => x.id === up.creatureId) : null;
    this.modal((m, close) => {
      m.classList.add('levelup');
      const rank = starRank(up.level);
      const title = up.level === STAR_LEVEL + 1 ? 'You\'re a Star Keeper now! Your badge shines with starlight.'
        : up.level === 75 ? 'Your Star Keeper badge turns to gold!'
          : up.level === MAX_LEVEL ? 'Level 100! You are a Grand Keeper, the best there is.' : null;
      m.append(h('div', { class: `lv-burst ${rank ? `star${rank}` : ''}` }, '★'), h('h2', null, `Level ${up.level}!`),
        ...(title ? [h('p', { style: 'font-weight:800;color:#6a3ce0' }, title)] : []),
        h('p', { class: 'lv-rewards' }, rich(`{coin} +${up.coins.toLocaleString()}   {gem} +${up.shards}`)),
        ...(sp && c ? [h('div', { class: 'col', style: 'align-items:center' }, this.portrait(c, 'portrait big'), h('b', null, `A ${sp.name} joined you!`),
          h('span', { class: 'muted' }, 'Only keepers who reach this level ever meet one. It\'s on your Home world, or you can store it for later.'))] : []),
        h('div', { class: 'btns' },
          sp && c ? h('button', { class: 'btn secondary', onClick: () => { if (this.game.store(c.id, true)) close(); } }, 'Store it') : null,
          sp && c ? h('button', { class: 'btn secondary', onClick: () => { close(); this.focusCreature(c.id); } }, 'Go see it') : null,
          h('button', { class: 'btn', onClick: close }, 'Hooray!')));
    });
  }

  // ---- legendary events

  /** Clouds sweep across the screen and the light changes while a legendary event lasts. */
  legendaryOverlay(kind: LegendaryKind): void {
    this.overlay?.remove();
    const clouds = Array.from({ length: 7 }, (_, i) => h('div', { class: 'lg-cloud', style: `top:${8 + i * 12}%;animation-delay:${(i % 4) * 0.35}s;transform:scale(${1 + (i % 3) * 0.35})` }));
    this.overlay = h('div', { class: `lg-overlay ${kind}` }, h('div', { class: 'lg-tint' }), h('div', { class: 'lg-rays' }), ...clouds);
    this.root.prepend(this.overlay);
  }

  legendaryOverlayEnd(): void {
    const o = this.overlay;
    if (!o) return;
    this.overlay = null;
    o.classList.add('ending');
    setTimeout(() => o.remove(), 2200);
  }

  /** Claim a legendary gift: pick a creature, then any change for it. */
  showBlessing(): void {
    const s = this.game.state;
    const b = s.blessing;
    if (!b || this.game.now() >= b.expiresAt) return;
    const def = LEGENDARY[b.kind];
    this.openSheet(def.giftTitle, def.giftBlurb, (body) => {
      body.append(h('p', { class: 'muted' }, `The gift fades in ${fmtDuration(b.expiresAt - this.game.now())}.`));
      const grid = h('div', { class: 'grid' });
      for (const c of s.creatures.filter((x) => !x.stored)) {
        grid.append(h('button', { class: 'tile', onClick: () => this.chooseGift(c) }, this.portrait(c, ''), displayName(c)));
      }
      body.append(grid);
    }, '🎁');
  }

  private chooseGift(c: Creature): void {
    const sp = species(c.species);
    this.openSheet('Choose a change', `For ${displayName(c)}`, (body) => {
      const list = h('div', { class: 'list' });
      for (const m of GIFTABLE_MUTATIONS) {
        const def = MUTATIONS[m];
        const has = c.mutations.includes(m) || sp.traits.includes(def.trait);
        list.append(h('div', { class: 'item' },
          h('div', { class: 'swatch' }, MUT_ICON[m]),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `${def.name}${def.tier !== 'common' ? ` · ${def.tier}` : ''}`), h('div', { class: 'desc' }, def.blurb)),
          h('button', { class: 'btn small', disabled: has, onClick: () => this.modal((mm, close) => {
            mm.append(h('h2', null, `Make ${displayName(c)} ${def.name}?`),
              h('p', { class: 'muted' }, 'The gift can only be used once.'),
              h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Not yet'),
                h('button', { class: 'btn', onClick: () => { close(); this.game.claimBlessing(c.id, m); } }, 'Yes!')));
          }) }, has ? 'Has it' : 'Choose')));
      }
      body.append(list);
      body.append(h('button', { class: 'btn secondary wide', style: 'margin-top:10px', onClick: () => this.showBlessing() }, 'Pick a different creature'));
    }, '🎁');
  }

  // ---- Kindred Fountain

  showFont(): void {
    const s = this.game.state;
    this.ensureHome();
    this.game.world.focus(FONT, 15, 'home');
    if (s.tutorial === 3) this.game.setTutorial(3.5);
    this.openSheet('Kindred Fountain', 'Two creatures who share something can make an egg together.', (b) => {
      const [aId, bId] = this.fontPick;
      const a = s.creatures.find((c) => c.id === aId) ?? null;
      const bb = s.creatures.find((c) => c.id === bId) ?? null;
      const slot = (c: Creature | null, i: 0 | 1) => h('button', {
        class: `slot ${c ? 'filled' : ''}`,
        onClick: () => this.pickForFont(i),
      }, c ? this.portrait(c, '') : h('span', { class: 'plus' }, '＋'), c ? displayName(c) : 'Choose');
      b.append(h('div', { class: 'slots' }, slot(a, 0), h('span', { style: 'font-size:24px' }, '💞'), slot(bb, 1)));
      const free = placedNests(s).filter((n) => !nestOccupant(s, n.id)).length;
      if (a && bb) {
        const comp = compatibility(a, bb);
        b.append(h('div', { class: `verdict ${comp.ok ? 'ok' : 'no'}` },
          comp.ok ? h('div', null, 'They feel kindred. They share ', this.traitChips(comp.shared, comp.shared)) : comp.reason ?? ''));
        const sky = activeEvent(s, this.game.now());
        if (comp.ok && sky) b.append(h('p', { class: 'muted' }, `The ${EVENTS[sky.kind].name.toLowerCase()} overhead makes the Fountain shimmer strangely...`));
        b.append(h('button', {
          class: 'btn wide', style: 'margin-top:12px', disabled: !comp.ok || free === 0,
          onClick: () => this.game.combine(a.id, bb.id),
        }, free === 0 ? 'Every nest is full' : 'Make an egg together'));
      } else {
        b.append(h('p', { class: 'muted' }, 'Pick two creatures. You won\'t know exactly what the egg holds until it hatches.'));
      }
      b.append(h('p', { class: 'muted' }, `Free nests: ${free} of ${placedNests(s).length}. Eggs go to a free nest on the world you're on first.`));
    }, '⛲');
  }

  private pickForFont(i: 0 | 1): void {
    const s = this.game.state;
    const other = s.creatures.find((c) => c.id === this.fontPick[1 - i]) ?? null;
    this.openSheet('Choose a creature', other ? `Pairing with ${displayName(other)}` : 'Who will visit the Fountain?', (b) => {
      const grid = h('div', { class: 'grid' });
      for (const c of s.creatures.filter((x) => !x.stored)) {
        const comp = other ? compatibility(other, c) : { ok: true, shared: [] as Trait[] };
        grid.append(h('button', {
          class: `tile ${comp.ok ? '' : 'dim'} ${this.fontPick[i] === c.id ? 'sel' : ''}`,
          onClick: () => { this.fontPick[i] = c.id; this.showFont(); },
        }, this.portrait(c, ''), displayName(c), comp.ok && other ? h('span', { class: 'badge' }, '💚') : null));
      }
      b.append(grid);
      if (other) b.append(h('p', { class: 'muted' }, '💚 = shares a trait with your first pick. Faded ones have nothing in common.'));
    }, '⛲');
  }

  // ---- nests & eggs

  showNest(id: string): void {
    const s = this.game.state;
    const n = s.placedDecor.find((d) => d.id === id);
    if (!n) return;
    const island = n.island ?? 'home';
    if (this.game.world.current !== island) this.game.world.travelTo(island, true);
    this.game.world.focus(n, 12, island);
    const egg = nestOccupant(s, id);
    if (!egg) {
      this.openSheet('Empty nest', `On ${ISLANDS[island].name} · ready for an egg`, (b) => {
        b.append(h('p', null, 'Eggs you breed settle in a free nest on the world you\'re on. Breed at the Kindred Fountain, or drop one pet onto another.'));
        b.append(h('div', { class: 'btns' },
          h('button', { class: 'btn', onClick: () => this.showFont() }, '⛲ Kindred Fountain'),
          h('button', { class: 'btn secondary', onClick: () => this.beginPlacement('nest', id) }, '✋ Move'),
          h('button', { class: 'btn secondary', onClick: () => {
            const r = A.storeDecor(s, id);
            if (!r.ok) return this.fail(r.error);
            this.toast('The nest is in your satchel. Place it again from Decor.');
            this.game.saveSoon();
            this.closeSheet();
          } }, '📦 Put away')));
        b.append(h('p', { class: 'muted' }, 'Tip: press and hold a nest to move it. Mango sells more nests on the EGGS tab.'));
      }, '🪺');
      return;
    }
    this.showEgg(egg);
  }

  showEgg(egg: Egg): void {
    const s = this.game.state;
    this.openSheet(eggName(egg), egg.parentNames ? `From ${egg.parentNames[0]} & ${egg.parentNames[1]}` : egg.source === 'shop' ? 'A traveler\'s egg' : 'A mysterious egg', (b) => {
      const live = s.eggs.find((e) => e.id === egg.id);
      if (!live) { this.closeSheet(); return; }
      const t = this.game.now();
      const known = !!s.journal.species[live.species];
      const ready = live.progressMs >= live.incubationMs;
      const clues = h('div', { class: 'card col' }, ...eggClues(live, known).map((c) => h('div', null, `• ${c}`)));
      b.append(clues);
      if (live.nest === null) {
        b.append(h('p', { class: 'muted' }, 'Waiting in the basket for a free nest.'));
        return;
      }
      const pct = Math.min(100, (live.progressMs / live.incubationMs) * 100);
      b.append(h('div', { style: 'margin:14px 0 6px' }, h('div', { class: 'progress' }, h('i', { style: `width:${pct}%` }))));
      b.append(h('div', { class: 'muted' }, ready ? 'Something is moving inside!' : `Hatches in ${fmtDuration(A.remainingMs(live))}`));
      const btns = h('div', { class: 'btns' });
      if (ready) {
        btns.append(h('button', { class: 'btn wide', onClick: () => this.game.hatch(live.id) }, '🐣 Hatch!'));
      } else {
        if (A.canAdHatch(s, live, t)) {
          btns.append(h('button', { class: 'btn ad', onClick: () => this.game.adHatch(live.id) }, '▶ Watch ad · hatch now'));
        }
        const price = A.skipPrice(live);
        btns.append(h('button', { class: 'btn shard', disabled: s.shards < price, onClick: () => {
          const r = A.finishEggWithShards(s, live.id);
          if (!r.ok) return this.fail(r.error);
          this.game.analytics.track('egg_skip_shards', { price });
          this.game.saveSoon();
          this.rerender();
        } }, rich(`Hatch now · {gem} ${price}`)));
        for (const [id, n] of Object.entries(s.items)) {
          if (!n) continue;
          const item = ITEMS[id];
          const sprayed = live.sprays ?? [];
          const used = (item.effect === 'giantChance' && live.tonic) || (item.effect === 'warmth' && live.warmed)
            || sprayed.includes(item.effect) || (item.effect === 'grow' && sprayed.includes('shrink')) || (item.effect === 'shrink' && sprayed.includes('grow'));
          if (used) continue;
          btns.append(h('button', { class: 'btn secondary', onClick: () => {
            const r = A.useItem(s, id, live.id);
            if (!r.ok) return this.fail(r.error);
            this.toast(r.message);
            this.game.saveSoon();
            this.rerender();
          } }, `Use ${item.name} (${n})`));
        }
      }
      b.append(btns);
      if (live.sprays?.length) {
        const names = live.sprays.map((e) => Object.values(ITEMS).find((i) => i.effect === e)?.name ?? e);
        b.append(h('p', { class: 'muted' }, `Sprayed with ${names.join(', ')}.`));
      } else if (!ready && !Object.entries(s.items).some(([id, n]) => n && ITEMS[id]?.spray)) {
        b.append(h('p', { class: 'muted' }, 'Tip: Mango sells egg sprays to make an egg hatch bigger, smaller, faster or sparklier.'));
      }
      if (live.witnessed.length) {
        b.append(h('p', { class: 'muted' }, `This egg felt a ${EVENTS[live.witnessed[live.witnessed.length - 1]].name.toLowerCase()} pass overhead.`));
      }
    }, eggIcon(egg));
  }

  showBasket(): void {
    this.ensureHome();
    const s = this.game.state;
    const waiting = s.eggs.filter((e) => e.nest === null && !e.nurseryId);
    this.openSheet('Egg basket', `${waiting.length} of ${TUNING.basketSize} waiting`, (b) => {
      if (!waiting.length) b.append(h('p', { class: 'muted' }, 'Eggs from the traveling merchant wait here until a nest is free.'));
      for (const e of waiting) {
        b.append(h('div', { class: 'item' }, h('div', { class: 'swatch' }, I.icon(eggIcon(e))),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, eggName(e)), h('div', { class: 'desc' }, eggClues(e, !!s.journal.species[e.species])[0]))));
      }
    }, '🧺');
  }

  // ---- shop

  showShop(toShards = false): void {
    const s = this.game.state;
    // the shop is on Home; food bought here is for the world you came from (you can switch)
    if (this.game.world.current !== 'home' || !this.sheetOpen) this.feedWorld = this.game.world.current;
    this.seenShopRotation = s.shop.rotation;
    s.shop.viewed = true;
    if (toShards) this.shopTab = 'shards';
    this.ensureHome();
    this.game.world.focus(SHOP_STALL, 15);
    this.openSheet("Mango's Shop", 'New wares arrive with every visit.', (b) => {
      const t = this.game.now();
      const line = MANGO_LINES[this.shopTab][s.shop.rotation % MANGO_LINES[this.shopTab].length];
      b.append(h('div', { class: 'shopkeeper' }, I.icon(I.MONKEY, 'icon mango'), h('div', { class: 'speech' }, line)));
      const tabs: [typeof this.shopTab, string, string][] = [
        ['egg', 'EGGS', I.CREATE], ['lure', 'LURES', I.LURE], ['food', 'FOOD', I.FOOD], ['item', 'ITEMS', I.POTION], ['gadget', 'GADGETS', I.SUMMON], ['decor', 'DECOR', I.DECOR], ['shards', 'BANK', I.GEM],
      ];
      b.append(h('div', { class: 'shop-tabs' }, ...tabs.map(([id, label, icon]) =>
        h('button', { class: `shop-tab ${this.shopTab === id ? 'on' : ''}`, 'aria-label': label, onClick: () => { this.game.audio.play('tap'); this.shopTab = id; this.rerender(); } },
          I.icon(icon), h('span', { class: 'lbl' }, label)))));

      if (this.shopTab === 'shards') {
        const iap = h('div', { class: 'list' });
        for (const cur of ['shards', 'coins'] as const) {
          iap.append(h('div', { class: 'section-title' }, cur === 'shards' ? 'Starshards' : 'Coins'));
          if (cur === 'coins') {
            const left = A.coinAdsLeft(s, t);
            iap.append(h('div', { class: 'item free-coins' }, h('div', { class: 'swatch' }, I.icon(I.COIN)),
              h('div', { class: 'grow' }, h('div', { class: 'name' }, rich(`Free {coin} ${A.coinAdReward(s)}`)), h('div', { class: 'desc' }, left ? `Watch a short ad. ${left} ready.` : 'Mango is restocking. Check back a little later!')),
              h('button', { class: 'btn small ad', disabled: !left, onClick: () => this.game.adCoins() }, '▶ Watch')));
          }
          for (const p of this.game.purchases.products().filter((x) => x.currency === cur)) {
            iap.append(h('div', { class: 'item' }, h('div', { class: 'swatch' }, I.icon(cur === 'shards' ? I.GEM : I.COIN)),
              h('div', { class: 'grow' }, h('div', { class: 'name' }, `${p.amount.toLocaleString()} ${cur === 'shards' ? 'Starshards' : 'coins'}`), p.tag ? h('div', { class: 'desc' }, p.tag) : null),
              h('button', { class: `btn small ${cur === 'shards' ? 'shard' : ''}`, onClick: () => this.game.buyPack(p.id) }, p.price)));
          }
        }
        b.append(iap, h('p', { class: 'muted' }, 'Starshards buy nests, decorations and time — never creatures or discoveries.'));
        return;
      }

      if (this.shopTab === 'decor') {
        this.decorCatalog(b);
        return;
      }
      b.append(h('div', { class: 'row muted' }, `New stock in ${fmtDuration(s.shop.nextRefreshAt - t)}`));
      b.append(h('div', { class: 'btns' },
        h('button', { class: 'btn shard small', disabled: s.shards < TUNING.shopRefreshShards, onClick: () => {
          const r = A.paidShopRefresh(s, t);
          if (!r.ok) return this.fail(r.error);
          this.seenShopRotation = s.shop.rotation;
          this.game.analytics.track('shop_refresh', { via: 'shards' });
          this.game.saveSoon();
          this.rerender();
        } }, rich(`Refresh · {gem} ${TUNING.shopRefreshShards}`)),
        A.adsLeft(s, t) > 0 ? h('button', { class: 'btn ad small', onClick: () => this.game.adRefreshShop() }, '▶ Watch ad · refresh') : null,
      ));
      const list = h('div', { class: 'list' });
      if (this.shopTab === 'food') {
        const g = this.game;
        const owned = ISLAND_ORDER.filter((id) => s.islands[id]?.owned);
        if (!owned.includes(this.feedWorld)) this.feedWorld = 'home';
        const here = this.feedWorld;
        if (owned.length > 1) {
          b.append(h('div', { class: 'world-filter' }, ...owned.map((id) =>
            h('button', { class: `chip-btn ${here === id ? 'on' : ''}`, onClick: () => { this.feedWorld = id; this.rerender(); } }, `${ISLANDS[id].icon} ${ISLANDS[id].name}`))));
        }
        b.append(h('div', { class: 'pantry' },
          h('b', null, 'Your pantry: '), ...['fruit', 'snack', 'feast', 'feedbag'].map((f) => h('span', { class: 'quirk' }, `${FOODS[f].icon} ${s.food[f] ?? 0}`))));
        b.append(h('div', { class: 'btns' },
          h('button', { class: 'btn small', disabled: !(s.food.feast ?? 0), onClick: () => g.feast(here) }, `🧺 Feast for ${ISLANDS[here].name}`),
          h('button', { class: 'btn small secondary', disabled: !(s.food.feedbag ?? 0), onClick: () => g.hangBag(here) }, `🎒 Hang a feedbag on ${ISLANDS[here].name} (${s.feedbags[here] ?? 0} left)`)));
        b.append(h('p', { class: 'muted' }, 'Feed a creature from its card. Berry Trees grow free berries: plant one from the list below.'));
      }
      const offers = s.shop.offers.filter((x) => x.kind === this.shopTab || (this.shopTab === 'item' && (x.kind === 'tool' || x.kind === 'sky')) || (this.shopTab === 'gadget' && x.kind === 'decor'))
        .filter((x) => (x.kind === 'decor') === (this.shopTab === 'gadget'));
      if (!offers.length) list.append(h('p', { class: 'muted' }, 'Nothing of this kind today. Check back when new stock arrives!'));
      // special stock (Epic, Legendary, Mythical) goes first, with a sparkle
      const gradeOf = (o: (typeof offers)[number]) => (o.kind === 'egg' ? EGG_TIERS[o.ref]?.grade : o.kind === 'lure' ? LURES[o.ref]?.grade : undefined);
      const rank = (o: (typeof offers)[number]) => { const gr = gradeOf(o); return gr ? { mythical: 0, legendary: 1, epic: 2 }[gr] : 9; };
      offers.sort((a, b2) => rank(a) - rank(b2));
      for (const o of offers) {
        const grade = gradeOf(o);
        let name = '';
        let desc = '';
        let icon = '🫙';
        let style = '';
        if (o.kind === 'lure') { const l = LURES[o.ref]; name = l.name; desc = l.scent; icon = HABITAT_ICON[l.attracts] ?? '🫙'; style = `background:${l.color}33`; }
        if (o.kind === 'item') { const it = ITEMS[o.ref]; name = it.name; desc = it.blurb; icon = ITEM_ICON[it.effect] ?? '🧪'; }
        if (o.kind === 'food') { const f = FOODS[o.ref]; name = `${f.name} (have ${s.food[o.ref] ?? 0})`; desc = f.blurb; icon = f.icon; }
        if (o.kind === 'tool') { const tl = TOOLS[o.ref]; name = `${tl.name} (have ${s.tools[o.ref] ?? 0})`; desc = tl.blurb; icon = tl.icon; }
        if (o.kind === 'egg') {
          const tier = EGG_TIERS[o.ref];
          name = tier?.name ?? 'Egg';
          desc = tier?.blurb ?? '';
          icon = tierEggIcon(o.ref);
          style = `background:linear-gradient(135deg, ${tier?.colors[0] ?? '#fff'}55, ${tier?.colors[1] ?? '#fff'}55)`;
        }
        if (o.kind === 'sky') {
          const it = SKY_ITEMS[o.ref];
          if (o.ref === 'telescope' && s.telescope) continue;
          const have = s.charms?.[o.ref] ?? 0;
          name = it.name + (have ? ` (have ${have})` : '');
          desc = it.blurb + (o.ref === 'starchart' && (s.chartUntil ?? 0) > t ? ` Yours for ${fmtDuration((s.chartUntil ?? 0) - t)} more; buying adds a day.` : '');
          icon = it.icon;
          style = 'background:linear-gradient(135deg, #2a2f8a, #7c4dff)';
        }
        if (o.kind === 'decor') { const d = DECOR[o.ref]; name = d.name + (d.rotating ? ' ✦' : ''); desc = d.blurb + (d.rotating ? ' Only here for a short while.' : ''); icon = '🪴'; }
        const can = (o.currency === 'glimmer' ? s.glimmer : s.shards) >= o.price && o.stock > 0;
        list.append(h('div', { class: `item ${grade ? `special g-${grade}` : ''}` },
          h('div', { class: 'swatch', style }, icon.startsWith('<svg') ? I.icon(icon) : icon),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, name, grade ? h('span', { class: `grade g-${grade}` }, `✦ ${grade[0].toUpperCase()}${grade.slice(1)}`) : ''), h('div', { class: 'desc' }, desc),
            o.stock < 10 ? h('div', { class: 'muted' }, o.stock > 0 ? `${o.stock} left` : 'Sold out') : null),
          h('button', { class: `btn small ${o.currency === 'shards' ? 'shard' : ''}`, disabled: !can, onClick: () => this.game.buy(o.id) },
            rich(`${o.currency === 'shards' ? '{gem}' : '{coin}'} ${o.price}`)),
        ));
      }
      // nests are always in stock (eight more in all), and go to your Decor satchel to place on any world
      if (this.shopTab === 'gadget') {
        const price = A.nestPrice(s);
        list.append(h('div', { class: 'item' },
          h('div', { class: 'swatch' }, '🪺'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `Nest (you have ${placedNests(s).length + (s.decorOwned.nest ?? 0)})`),
            h('div', { class: 'desc' }, 'One more egg warming at a time. Place it on any of your worlds.')),
          price === null ? h('span', { class: 'muted' }, 'All bought')
            : h('button', { class: 'btn small shard', disabled: s.shards < price, onClick: () => {
              const r = A.buyNest(s);
              if (!r.ok) return this.fail(r.error);
              this.game.audio.play('place');
              this.game.analytics.track('nest_bought', { nests: placedNests(s).length + (s.decorOwned.nest ?? 0) });
              this.game.saveSoon();
              this.toast('A new nest! Choose where it goes.');
              this.beginPlacement('nest');
            } }, rich(`{gem} ${price}`))));
      }
      b.append(list);
    }, I.SHOP);
  }

  /** Mango's decoration catalog: always open, grouped and sorted, unlocked by keeper level. */
  private decorCatalog(b: HTMLElement): void {
    const s = this.game.state;
    const lvl = levelOf(s.xp);
    const chip = (id: string, label: string) => h('button', { class: `chip-btn ${this.decorCat === id ? 'on' : ''}`, onClick: () => { this.decorCat = id; this.rerender(); } }, label);
    b.append(h('div', { class: 'world-filter' }, chip('all', 'All'), ...DECOR_CATS.map((c) => chip(c.id, `${c.icon} ${c.name}`))));
    const sorts = [['level', 'Unlock level'], ['price', 'Price'], ['name', 'Name']] as const;
    const cur = sorts.find(([k]) => k === this.decorSort) ?? sorts[0];
    b.append(h('div', { class: 'sort-row' }, h('span', { class: 'muted' }, `${CATALOG.filter((d) => lvl >= (d.level ?? 1)).length} of ${CATALOG.length} unlocked`),
      h('button', { class: 'sort-btn', onClick: () => { this.decorSort = sorts[(sorts.indexOf(cur) + 1) % sorts.length][0]; this.rerender(); } }, `Sort: ${cur[1]} ▾`)));
    const cmp: Record<string, (a: DecorDef, b2: DecorDef) => number> = {
      level: (a, b2) => (a.level ?? 1) - (b2.level ?? 1) || a.price - b2.price,
      // Starshard prices are worth about 20 coins each when sorting by price
      price: (a, b2) => a.price * (a.currency === 'shards' ? 20 : 1) - b2.price * (b2.currency === 'shards' ? 20 : 1),
      name: (a, b2) => a.name.localeCompare(b2.name),
    };
    const list = h('div', { class: 'list decor-list' });
    for (const d of CATALOG.filter((x) => this.decorCat === 'all' || x.cat === this.decorCat).sort(cmp[this.decorSort])) {
      const locked = lvl < (d.level ?? 1);
      const owned = s.decorOwned[d.id] ?? 0;
      const placed = s.placedDecor.filter((p) => p.decor === d.id).length;
      const wallet = d.currency === 'shards' ? s.shards : s.glimmer;
      list.append(h('div', { class: `item ${locked ? 'locked' : ''}` },
        img(this.game.world.portraits.decor(d.id), 'swatch-img'),
        h('div', { class: 'grow' }, h('div', { class: 'name' }, d.name),
          h('div', { class: 'desc' }, locked ? `🔒 Unlocks at keeper level ${d.level}` : d.blurb),
          owned || placed ? h('div', { class: 'muted' }, `You have ${owned} to place${placed ? ` · ${placed} placed` : ''}`) : null),
        locked ? h('span', { class: 'chip locked' }, `Lv ${d.level}`)
          : h('button', { class: `btn small ${d.currency === 'shards' ? 'shard' : ''}`, disabled: wallet < d.price, onClick: () => this.game.buyDecor(d.id) },
            rich(`${d.currency === 'shards' ? '{gem}' : '{coin}'} ${d.price}`))));
    }
    b.append(list);
  }

  // ---- journal

  showJournal(): void {
    this.seenNotes = this.game.state.journal.notes.length;
    const s = this.game.state;
    const found = Object.keys(s.journal.species).length;
    this.openSheet('Field Journal', `${found} of ${SPECIES.length} creatures discovered`, (b) => {
      const tab = (id: typeof this.journalTab, label: string) =>
        h('button', { class: this.journalTab === id ? 'on' : '', onClick: () => { this.journalTab = id; this.rerender(); } }, label);
      const ready = claimableCollections(s).length;
      b.append(h('div', { class: 'tabs' }, tab('creatures', '🐾 Creatures'), tab('pages', `🏅 Pages${ready ? ' ❗' : ''}`), tab('mutations', '✨ Mutations'), tab('traits', `📖 Traits ${Object.keys(s.journal.quirks ?? {}).length}/${QUIRK_IDS.length}`), tab('notes', `📝 Notes (${s.journal.notes.length})`)));
      if (this.journalTab === 'pages') {
        b.append(h('p', { class: 'muted' }, 'Finish a page of your journal for a big reward and a badge.'));
        const list = h('div', { class: 'list' });
        for (const c of COLLECTIONS) {
          const p = c.progress(s);
          const claimed = s.collections?.[c.id] !== undefined;
          const done = p.have >= p.total;
          list.append(h('div', { class: `item ${done && !claimed ? 'wanted' : ''}` }, h('div', { class: `swatch ${claimed ? 'badge' : ''}` }, claimed ? '🏅' : c.icon),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, c.name), h('div', { class: 'desc' }, c.blurb),
              h('div', { class: 'progress small' }, h('i', { style: `width:${Math.round((p.have / Math.max(1, p.total)) * 100)}%` })),
              h('div', { class: 'muted' }, claimed ? 'Badge earned!' : rich(`${p.have} / ${p.total} · reward {coin} ${c.reward.coins.toLocaleString()} {gem} ${c.reward.shards}`))),
            done && !claimed ? h('button', { class: 'btn small', onClick: () => this.game.claimCollection(c.id) }, 'Claim') : null));
        }
        b.append(list);
        return;
      }
      if (this.journalTab === 'creatures') {
        // one journal, filtered by world: a world's creatures are the ones its habitats attract
        const worldOf = (id: IslandId): Trait[] => (id === 'home' ? ['Grove', 'Tide', 'Bloom', 'Mystic'] : [ISLANDS[id].habitat]);
        const inWorld = (x: (typeof SPECIES)[number]) => this.journalWorld === 'all' || worldOf(this.journalWorld).some((t) => x.traits.includes(t));
        const chip = (id: IslandId | 'all', label: string) => {
          const list = SPECIES.filter((x) => id === 'all' || worldOf(id).some((t) => x.traits.includes(t)));
          const got = list.filter((x) => s.journal.species[x.id]).length;
          return h('button', { class: `chip-btn ${this.journalWorld === id ? 'on' : ''}`, onClick: () => { this.journalWorld = id; this.rerender(); } }, `${label} ${got}/${list.length}`);
        };
        b.append(h('div', { class: 'world-filter' }, chip('all', 'All'), ...ISLAND_ORDER.map((id) => chip(id, `${ISLANDS[id].icon} ${ISLANDS[id].name}`))));
        const sections: [string, (x: (typeof SPECIES)[number]) => boolean][] = [
          ['Wild', (x) => x.origin === 'wild' && x.rarity !== 'mythical'],
          ['Created', (x) => x.origin === 'hybrid' && x.rarity !== 'mythical'],
          ['✦ Mythical', (x) => x.rarity === 'mythical' && x.origin !== 'reward'],
          ['★ Level rewards', (x) => x.origin === 'reward'],
        ];
        for (const [title, keep] of sections) {
          const shown = SPECIES.filter((x) => keep(x) && inWorld(x));
          if (!shown.length) continue;
          b.append(h('div', { class: 'section-title' }, title));
          const grid = h('div', { class: 'grid' });
          for (const sp of shown) {
            const entry = s.journal.species[sp.id];
            const el = h('button', { class: 'tile', onClick: () => this.showSpeciesEntry(sp.id) },
              img(this.game.world.portraits.get(sp.id, [], !entry)),
              entry ? sp.name : '???',
              entry ? h('span', { class: 'count' }, `seen ×${entry.count}`) : null);
            grid.append(el);
          }
          b.append(grid);
        }
      } else if (this.journalTab === 'traits') {
        // behaviour traits: what each one does stays a mystery until one of your pets has it
        b.append(h('p', { class: 'muted' }, 'Every pet has 2 to 5 traits that change how it behaves. Breed and lure new pets to discover them all.'));
        const list = h('div', { class: 'list' });
        const known = (q: string) => (s.journal.quirks?.[q as keyof typeof s.journal.quirks] !== undefined ? 0 : 1);
        for (const q of [...QUIRK_IDS].sort((x, y) => known(x) - known(y))) {
          const seen = known(q) === 0;
          list.append(h('div', { class: 'item' }, h('div', { class: 'swatch' }, seen ? QUIRKS[q].icon : '❔'),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, seen ? QUIRKS[q].name : 'Undiscovered trait'),
              h('div', { class: 'desc' }, seen ? QUIRKS[q].blurb : 'Find a pet with this trait to learn what it does.'))));
        }
        b.append(list);
      } else if (this.journalTab === 'mutations') {
        const list = h('div', { class: 'list' });
        for (const m of Object.values(MUTATIONS)) {
          const seen = s.journal.mutations[m.id];
          list.append(h('div', { class: 'item' }, h('div', { class: 'swatch' }, seen ? MUT_ICON[m.id] : '❔'),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, seen ? m.name : 'Unknown change'),
              h('div', { class: 'desc' }, seen ? m.blurb : this.mutationHint(m.id)))));
        }
        b.append(list);
      } else {
        if (!s.journal.notes.length) b.append(h('p', { class: 'muted' }, 'Your observations will appear here as you experiment.'));
        const story = h('div', { class: 'story' });
        for (const n of s.journal.notes) story.append(h('div', null, h('div', { class: 'when' }, this.when(n.t)), h('p', null, n.text)));
        b.append(story);
      }
    }, I.JOURNAL);
  }

  private mutationHint(m: MutationId): string {
    switch (m) {
      case 'lunar': return 'Something about the sun going dark... or a very bright moon.';
      case 'storm': return 'Creatures caught out in bad weather sometimes come back different.';
      case 'starlit': return 'Have you ever seen a star fall? Where did it land?';
      case 'frost': return 'Some creatures come back changed from the cold.';
      case 'giant': return 'Some say two of a kind make something bigger. Or a tonic could help.';
      case 'angelic': return 'Legendary. Some say angels visit, very rarely, and leave a mark.';
      case 'infernal': return 'Legendary. What happens if Ember Peak ever wakes up?';
      case 'abyssal': return 'Legendary. The lagoon is deeper than it looks. Something rises from it, once in a long while.';
      case 'aurora': return 'On the clearest, coldest nights, ribbons of light sometimes dance overhead.';
      case 'misty': return 'Shy things come out when a soft fog rolls in. Some keep a little of it.';
      case 'ghostly': return 'Halloween only: something friendly and see-through drifts by on spooky nights.';
      case 'calcified': return 'Halloween only: listen for rattling bones after dark.';
      case 'mummified': return 'Halloween only: an old wind blows out of the ruins.';
      case 'zombified': return 'Halloween only: a green fog creeps out of the graveyard.';
      case 'vampire': return 'Halloween only: the moon turns red, and the bats come out.';
      case 'pumpkin': return 'Halloween only: pumpkins pop up all over the meadow one night.';
      default: return 'Vanishingly rare. Nobody you know has seen one.';
    }
  }

  private showSpeciesEntry(id: string): void {
    const s = this.game.state;
    const sp = species(id);
    const entry = s.journal.species[id];
    const ways = s.journal.howTo?.[id] ?? [];
    this.modal((m, close) => {
      const body = h('div');
      const tab = (key: 'about' | 'how', label: string) => h('button', { class: key === 'about' ? 'on' : '', onClick: (e: Event) => {
        m.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
        show(key);
      } }, label);
      const show = (key: 'about' | 'how') => {
        body.replaceChildren();
        if (key === 'about') {
          body.append(h('p', null, entry ? sp.blurb : `“${sp.hint}”`),
            entry ? h('p', { class: 'muted' }, `First seen ${this.when(entry.firstAt)}`) : '');
        } else if (!ways.length) {
          body.append(h('p', { class: 'muted' }, sp.origin === 'reward' && entry ? sp.hint : entry ? 'Get another one yourself to write down how.' : 'Find or breed one to write down how.'));
        } else {
          body.append(h('div', { class: 'list' }, ...ways.map((w) => h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'name' }, w))))));
        }
      };
      show('about');
      m.append(
        h('div', { class: 'row' }, img(this.game.world.portraits.get(id, [], !entry), 'portrait big'),
          h('div', { class: 'col' }, h('h2', null, entry ? sp.name : '???'), entry ? this.traitChips(sp.traits) : h('span', { class: 'muted' }, sp.origin === 'hybrid' ? 'Cannot be lured. Must be created.' : 'Not yet seen.'))),
        h('div', { class: 'tabs' }, tab('about', '📖 About'), tab('how', `🔍 How to get${ways.length ? ` (${ways.length})` : ''}`)),
        body,
        h('button', { class: 'btn wide', onClick: close }, 'Close'),
      );
    });
  }

  // ---- decor

  showDecor(): void {
    const s = this.game.state;
    this.openSheet('Decorate', 'Make the sanctuary yours.', (b) => {
      const owned = Object.entries(s.decorOwned).filter(([id, n]) => n > 0 && DECOR[id]);
      if (!owned.length) b.append(h('p', { class: 'muted' }, 'Nothing to place yet. Mango sells decorations on the DECOR tab and gadgets on the GADGETS tab.'));
      // gadgets (things that do something) first, then decorations
      for (const [title, keep] of [['✨ Gadgets', true], ['🌿 Decorations', false]] as [string, boolean][]) {
        const rows = owned.filter(([id]) => GADGET_IDS.includes(id) === keep);
        if (!rows.length) continue;
        b.append(h('div', { class: 'section-title' }, title));
        const list = h('div', { class: 'list' });
        for (const [id, n] of rows) {
          list.append(h('div', { class: 'item' }, img(this.game.world.portraits.decor(id), 'swatch-img'),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, `${DECOR[id].name} ×${n}`), h('div', { class: 'desc' }, DECOR[id].blurb)),
            h('button', { class: 'btn small', onClick: () => this.beginPlacement(id) }, 'Place')));
        }
        b.append(list);
      }
      b.append(h('p', { class: 'muted' }, 'Tap a placed decoration to put it back in your satchel. Tap a scenery tree to chop it down and make room.'));
      b.append(h('button', { class: 'btn secondary wide', style: 'margin-top:12px', onClick: () => { this.shopTab = 'decor'; this.showShop(); } }, 'Browse the decor catalog'));
    }, I.DECOR);
  }

  /** Place a decoration from the satchel, or move one that's already out (`moving` = its placed id). */
  beginPlacement(decorId: string, moving?: string): void {
    this.closeSheet();
    const w = this.game.world;
    this.dock.classList.add('hidden');
    const label = h('div', { class: 'grow' });
    const ok = h('button', { class: 'btn small', onClick: () => {
      const p = w.ghostPosition();
      if (!p || !w.validPlacement(p.x, p.z)) return this.toast('It needs open ground. Drag it somewhere clear.');
      const r = moving ? A.moveDecor(this.game.state, moving, p.x, p.z, p.rot, w.current) : A.placeDecor(this.game.state, decorId, p.x, p.z, p.rot, w.current);
      if (!r.ok) return this.fail(r.error);
      this.game.audio.play('place');
      this.game.analytics.track(moving ? 'decor_moved' : 'decor_placed', { decor: decorId, island: w.current });
      this.endPlacement();
      this.game.saveSoon();
    } }, 'Place');
    const rotate = h('button', { class: 'btn secondary small', 'aria-label': 'Turn it', onClick: () => w.rotateGhost() }, '🔄 Turn');
    const cancel = h('button', { class: 'btn secondary small', onClick: () => this.endPlacement() }, 'Cancel');
    w.onPlacementMove = (valid) => {
      setText(label, valid ? `Drag your ${DECOR[decorId].name} to move it. Looks good here!` : 'Not here: it needs open ground, away from trees, buildings and lure spots.');
      label.classList.toggle('bad', !valid);
      ok.disabled = !valid;
    };
    w.startPlacement(decorId, moving);
    // moving something: it can also go back in the satchel from here
    const away = moving ? h('button', { class: 'btn secondary small', onClick: () => {
      const r = A.storeDecor(this.game.state, moving);
      if (!r.ok) return this.fail(r.error);
      this.endPlacement();
      this.toast(`${DECOR[decorId].name} is back in your satchel (Decor).`);
      this.game.saveSoon();
    } }, '📦 Put away') : null;
    this.placeHost.replaceChildren(h('div', { class: 'place-bar' }, label, h('div', { class: 'btns' }, cancel, away, rotate, ok)));
    this.game.placing = (x, z) => { w.moveGhost(x, z); };
  }

  private endPlacement(): void {
    this.game.world.cancelPlacement();
    this.placeHost.replaceChildren();
    this.dock.classList.remove('hidden');
    this.game.placing = null;
  }

  /** The Nursery: pick a kindred pair from this world; they make an egg every few hours, even while you're away. */
  private nurseryBlock(b: HTMLElement, id: string): void {
    const g = this.game;
    const s = g.state;
    const d = s.placedDecor.find((x) => x.id === id);
    if (!d) return;
    const island = d.island ?? 'home';
    const pair = d.pair?.map((pid) => s.creatures.find((c) => c.id === pid)).filter((c): c is Creature => !!c) ?? [];
    const ready = s.eggs.find((e) => e.nurseryId === id);
    if (ready) b.append(h('button', { class: 'btn wide', style: 'margin-bottom:8px', onClick: () => g.hatch(ready.id) }, `🐣 Hatch the ${eggName(ready)}`));
    if (pair.length === 2) {
      b.append(h('div', { class: 'slots' }, ...pair.map((c) => h('div', { class: 'slot filled' }, this.portrait(c, ''), displayName(c)))));
      b.append(h('p', { class: 'muted' }, ready ? 'Hatch this egg and they\'ll make the next one.' : `Next egg in ${fmtDuration(Math.max(0, (d.nextAt ?? 0) - g.now()))}. They never go hungry in here.`));
      b.append(h('button', { class: 'btn secondary wide', style: 'margin-bottom:8px', onClick: () => { A.setNurseryPair(s, id, null, g.now()); g.saveSoon(); this.rerender(); } }, 'Take them out'));
      return;
    }
    b.append(h('p', null, `Pick two pets on ${ISLANDS[island].name} that share a type. They'll make an egg every ${TUNING.nurseryHours} hours, even while you're away.`));
    const pick = this.nurseryPick.filter((pid) => s.creatures.some((c) => c.id === pid));
    const grid = h('div', { class: 'grid' });
    const busy = new Set(s.placedDecor.flatMap((x) => (x.id !== id && x.pair) || []));
    for (const c of s.creatures.filter((x) => x.island === island && !x.stored && !x.trip && !busy.has(x.id))) {
      const first = pick[0] ? s.creatures.find((x) => x.id === pick[0]) : undefined;
      const ok = !first || first.id === c.id || compatibility(first, c).ok;
      grid.append(h('button', { class: `tile ${ok ? '' : 'dim'} ${pick.includes(c.id) ? 'sel' : ''}`, onClick: () => {
        if (pick.includes(c.id)) this.nurseryPick = pick.filter((x) => x !== c.id);
        else if (pick.length < 2) this.nurseryPick = [...pick, c.id];
        if (this.nurseryPick.length === 2) {
          const r = A.setNurseryPair(s, id, [this.nurseryPick[0], this.nurseryPick[1]], g.now());
          this.nurseryPick = [];
          if (!r.ok) return this.fail(r.error);
          g.audio.play('egg');
          this.toast('They\'ve settled into the Nursery. 💕');
          g.saveSoon();
        }
        this.rerender();
      } }, this.portrait(c, ''), displayName(c), first && ok && first.id !== c.id ? h('span', { class: 'badge' }, '💚') : null));
    }
    b.append(grid);
  }

  private nurseryPick: string[] = [];

  showPlacedDecor(id: string): void {
    const d = this.game.state.placedDecor.find((x) => x.id === id);
    if (!d) return;
    this.openSheet(DECOR[d.decor].name, DECOR[d.decor].blurb, (b) => {
      if (d.decor === 'nursery') this.nurseryBlock(b, d.id);
      if (d.expiresAt) {
        b.append(h('p', { class: 'market-hint', style: 'cursor:default' }, `✨ Working its magic on ${ISLANDS[d.island ?? 'home'].name}'s lures: ${fmtDuration(Math.max(0, d.expiresAt - this.game.now()))} left. It crumbles away when it runs out.`));
      }
      if (d.decor === 'fruittree') {
        const ripe = ripeFruit(d.harvestedAt, this.game.now());
        b.append(h('button', { class: 'btn wide', style: 'margin-bottom:8px', disabled: !ripe, onClick: () => this.game.harvest(id) }, ripe ? `🫐 Pick ${ripe} ${ripe === 1 ? 'berry' : 'berries'}` : 'No berries yet'));
      }
      b.append(h('div', { class: 'btns' },
        h('button', { class: 'btn wide', onClick: () => this.beginPlacement(d.decor, id) }, '✋ Move'),
        h('button', { class: 'btn secondary wide', onClick: () => {
          const r = A.storeDecor(this.game.state, id);
          if (!r.ok) return this.fail(r.error);
          this.game.saveSoon();
          this.closeSheet();
        } }, 'Put back in satchel')));
      b.append(h('p', { class: 'muted' }, 'Tip: press and hold any decoration to pick it up and move it.'));
    }, '🪴');
  }

  // ---- settings / playtest tools

  /** Settings → Cloud save: where your game is backed up, and the link button. */
  private cloudSettings(): HTMLElement {
    const g = this.game;
    const st = g.cloudStatus;
    const box = h('div', { class: 'item cloud-item' });
    const service = st?.service ?? (/iPhone|iPad/.test(navigator.userAgent) ? 'Game Center' : 'the cloud');
    const status = !st ? 'Checking…'
      : !st.available ? `${service} isn't available on this device right now. Your game is saved on this device.`
        : !st.signedIn ? `Not linked. Sign in to ${service} to keep your game safe if you change or lose your phone.`
          : g.cloudSavedAt ? `Saved to ${service}${st.account ? ` (${st.account})` : ''} · ${fmtDuration(g.now() - g.cloudSavedAt)} ago`
            : `Linked to ${service}${st.account ? ` (${st.account})` : ''}. Saves automatically.`;
    box.append(h('div', { class: 'grow' }, h('div', { class: 'name' }, '☁️ Cloud save'), h('div', { class: 'desc' }, status)),
      h('div', { class: 'col', style: 'gap:6px' },
        st?.signedIn
          ? h('button', { class: 'btn small', onClick: () => void g.cloudUpload(true).then(() => this.rerender()) }, 'Save now')
          : h('button', { class: 'btn small', disabled: !!st && !st.available, onClick: () => void g.cloudSignIn() }, 'Sign in'),
        st?.signedIn ? h('button', { class: 'btn small secondary', onClick: () => void g.cloudSync(true) }, 'Check now') : null));
    if (!st) void g.cloud.status().then((s) => { g.cloudStatus = s; this.rerender(); });
    return box;
  }

  showSettings(): void {
    const g = this.game;
    this.openSheet('Settings', `${GAME_NAME} · playtest build`, (b) => {
      const volumeRow = (label: string, which: 'sound' | 'music', on: boolean, vol: number, toggle: () => void) => {
        const slider = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(vol * 100)), class: 'vol-slider', disabled: !on, 'aria-label': `${label} volume` }) as HTMLInputElement;
        const pct = h('span', { class: 'vol-pct' }, `${Math.round(vol * 100)}%`);
        slider.addEventListener('input', () => { pct.textContent = `${slider.value}%`; g.setVolume(which, Number(slider.value) / 100); });
        // a little test blip when you let go, so you can hear the level
        slider.addEventListener('change', () => { if (which === 'sound') g.audio.play('tap'); });
        return h('div', { class: 'item vol-item' },
          h('div', { class: 'grow' }, h('div', { class: 'name' }, label), h('div', { class: 'vol-row' }, slider, pct)),
          h('button', { class: `btn small ${on ? '' : 'secondary'}`, onClick: () => { toggle(); this.rerender(); } }, on ? 'On' : 'Off'));
      };
      b.append(volumeRow('Sound', 'sound', g.audio.enabled, g.audio.soundVolume, () => g.setSound(!g.audio.enabled)));
      b.append(volumeRow('Music', 'music', g.audio.musicEnabled, g.audio.musicVolume, () => g.setMusic(!g.audio.musicEnabled)));
      const signSlider = h('input', { type: 'range', min: '0', max: '100', step: '10', value: String(Math.round(g.signRange * 100)), class: 'vol-slider', 'aria-label': 'Sign distance' }) as HTMLInputElement;
      const signPct = h('span', { class: 'vol-pct' }, g.signRange >= 0.99 ? 'Always' : `${Math.round(g.signRange * 100)}%`);
      signSlider.addEventListener('input', () => { g.setSignRange(Number(signSlider.value) / 100); signPct.textContent = g.signRange >= 0.99 ? 'Always' : `${signSlider.value}%`; });
      b.append(h('div', { class: 'item vol-item' }, h('div', { class: 'grow' }, h('div', { class: 'name' }, 'Shop & Sell signs'),
        h('div', { class: 'desc' }, 'How far away you can see them. All the way right shows them always.'), h('div', { class: 'vol-row' }, signSlider, signPct))));
      b.append(this.cloudSettings());
      b.append(h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'name' }, 'Reminders'),
        h('div', { class: 'desc' }, 'At most two gentle notifications while you\'re away (egg ready, rare visitor, pet home, the Collector). Never at night.')),
        h('button', { class: 'btn small secondary', onClick: () => { g.setReminders(!g.remindersOn); this.rerender(); } }, g.remindersOn ? 'On' : 'Off')));
      b.append(h('div', { class: 'btns' },
        h('button', { class: 'btn secondary small', onClick: () => this.showControls() }, '👆 How to get around'),
        h('button', { class: 'btn secondary small', onClick: () => this.showUpdates() }, '📜 What\'s new')));
      // playtest tools: in the web playtest build only, never in the store apps
      if (!gameServices.available) {
        b.append(h('div', { class: 'section-title' }, 'Playtest tools'));
        b.append(h('p', { class: 'muted' }, 'These exist to test the prototype quickly and will not ship.'));
        if (g.cloudStatus?.service === 'Test cloud' && g.cloudStatus.signedIn) {
          b.append(h('button', { class: 'btn secondary small', onClick: () => g.simulateOtherDevice() }, '☁️ Pretend another phone saved'));
        }
        const speed = h('div', { class: 'btns' }, ...[1, 10, 60].map((x) =>
          h('button', { class: `btn small ${g.timeScale === x ? '' : 'secondary'}`, onClick: () => { g.timeScale = x; this.rerender(); } }, `${x}× time`)));
        b.append(speed);
        b.append(h('div', { class: 'btns' },
          h('button', { class: 'btn small secondary', onClick: () => g.skip(5 * 60_000) }, '⏩ Skip 5 min'),
          h('button', { class: 'btn small secondary', onClick: () => g.skip(60 * 60_000) }, '⏩ Skip 1 hour (away)'),
          h('button', { class: 'btn small secondary', onClick: () => g.skipToNextEvent() }, '🌦️ Next sky event'),
          ...LEGENDARY_ORDER.map((k) => h('button', { class: 'btn small secondary', onClick: () => { this.closeSheet(); g.summonLegendary(k); } }, `${LEGENDARY[k].icon} ${LEGENDARY[k].name}`)),
          h('button', { class: 'btn small secondary', onClick: () => { g.state.glimmer += 500; g.state.shards += 50; } }, '+500 coins +50 gems'),
        ));
      }
      b.append(h('div', { class: 'section-title' }, 'Save'));
      b.append(h('button', { class: 'btn danger', onClick: () => this.modal((m, close) => {
        m.append(h('h2', null, 'Start a new sanctuary?'), h('p', { class: 'muted' }, 'This erases your current save on this device.'),
          h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Cancel'),
            h('button', { class: 'btn danger', onClick: () => g.reset() }, 'Erase & restart')));
      }) }, 'Start over'));
    }, '⚙️');
  }

  // ---- friends (codes, no server) and achievements

  showFriends(): void {
    const g = this.game;
    const s = g.state;
    this.openSheet('Friends', 'Swap codes with friends to visit their groves', (b) => {
      const t = g.now();
      const code = myFriendCode(s);
      // my keeper name and code
      const name = h('input', { class: 'rename', value: s.keeperName ?? '', placeholder: 'Your keeper name', maxLength: 20, enterKeyHint: 'done', 'aria-label': 'Your keeper name' }) as HTMLInputElement;
      const saveName = () => {
        name.blur();   // closes the phone keyboard
        const v = name.value.trim().slice(0, 20) || undefined;
        if (v === s.keeperName) return;
        s.keeperName = v;
        g.saveSoon();
        this.toast(v ? `Hello, ${v}!` : 'Name cleared.');
        this.rerender();
      };
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
      const codeBox = h('textarea', { class: 'friend-code', readOnly: true, rows: 3, 'aria-label': 'Your friend code' }, code) as HTMLTextAreaElement;
      const copy = async () => {
        try { await navigator.clipboard.writeText(code); this.toast('Friend code copied! Send it to a friend.'); } catch { codeBox.select(); this.toast('Press and hold the code to copy it.'); }
      };
      b.append(h('div', { class: 'friend-me' },
        h('div', { class: 'section-title' }, 'You'),
        h('div', { class: 'row', style: 'gap:6px' }, name, h('button', { class: 'btn small', onClick: saveName }, 'Save')),
        h('div', { class: 'muted' }, 'Your friend code (it shows your best pets; share it again after you find new ones):'),
        codeBox,
        h('div', { class: 'btns' },
          h('button', { class: 'btn small', onClick: () => void copy() }, 'Copy code'),
          h('button', { class: 'btn small secondary', onClick: async () => { if (!(await shareBlobText(`Come play ${GAME_NAME} with me! Add me as a friend: ${code}`))) void copy(); } }, '📱 Share code'))));
      // add a friend
      const input = h('textarea', { class: 'friend-code', rows: 2, placeholder: 'Paste a friend\'s code here (it starts with PG-)', 'aria-label': 'Friend code' }) as HTMLTextAreaElement;
      b.append(h('div', { class: 'section-title' }, 'Add a friend'), input,
        h('button', { class: 'btn small', style: 'margin-top:6px', onClick: () => {
          const r = addFriend(s, input.value, g.now());
          if (!r.ok) return this.fail(r.error);
          g.audio.play('discover');
          this.toast(r.updated ? `${r.friend.name}'s grove is up to date!` : `${r.friend.name} is now your friend! 🤝`, 'discovery');
          g.saveSoon();
          this.rerender();
        } }, 'Add friend'));
      // friends list, with a little leaderboard
      const friends = s.friends ?? [];
      if (!friends.length) {
        b.append(h('p', { class: 'muted' }, 'No friends yet. Share your code, and paste theirs above. Each friend sends you a small gift every day.'));
      } else {
        b.append(h('div', { class: 'section-title' }, `Your friends (${friends.length}) · ${giftsLeft(s, t)} gift${giftsLeft(s, t) === 1 ? '' : 's'} to open today`));
        const list = h('div', { class: 'list' });
        for (const f of [...friends].sort((a, b2) => b2.level - a.level)) {
          const top = f.pets[0];
          list.append(h('div', { class: 'item' },
            top ? img(g.world.portraits.get(top.species, top.mutations, false, top.shade), 'swatch-img') : h('div', { class: 'swatch' }, rich('🤝')),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, f.name), h('div', { class: 'desc' }, `Level ${f.level} · ${f.found} creatures found`)),
            canCollectGift(s, f.id, t) ? h('button', { class: 'btn small', onClick: () => {
              if (!collectGift(s, f.id, g.now())) return;
              g.audio.play('coin');
              this.toast(rich(`🎁 A gift from ${f.name}: {coin} ${FRIEND_GIFT.coins} and a Snack!`).textContent ?? '', 'discovery');
              g.saveSoon();
              this.rerender();
            } }, rich('🎁 Gift')) : '',
            h('button', { class: 'btn small secondary', onClick: () => this.visitFriend(f.id) }, 'Visit')));
        }
        b.append(list);
        // how you stack up
        const me = { name: `${s.keeperName ?? 'You'} (you)`, level: levelOf(s.xp), found: Object.keys(s.journal.species).length };
        const board = [me, ...friends].sort((a, b2) => b2.found - a.found || b2.level - a.level);
        b.append(h('div', { class: 'section-title' }, '🏆 Most creatures found'),
          h('div', { class: 'list' }, ...board.slice(0, 10).map((x, i) => h('div', { class: `item ${x === me ? 'me' : ''}` },
            h('b', { class: 'rank' }, `${i + 1}`), h('div', { class: 'grow name' }, x.name), h('span', { class: 'muted' }, `${x.found} found · Lv ${x.level}`)))));
      }
      b.append(h('div', { class: 'btns', style: 'margin-top:12px' },
        h('button', { class: 'btn small secondary', onClick: () => this.showAchievements() }, '🏅 Achievements'),
        gameServices.available ? h('button', { class: 'btn small secondary', onClick: () => gameServices.showLeaderboards() }, '🏆 Leaderboards') : ''));
    }, '🤝');
  }

  private visitFriend(id: string): void {
    const g = this.game;
    const f = g.state.friends?.find((x) => x.id === id);
    if (!f) return;
    this.modal((m, close) => {
      m.append(h('h2', null, `${f.name}'s grove`), h('p', { class: 'muted' }, `Keeper level ${f.level} · ${f.found} creatures found`),
        h('div', { class: 'friend-pets' }, ...f.pets.map((p) => h('div', { class: 'friend-pet' },
          img(g.world.portraits.get(p.species, p.mutations, false, p.shade), 'portrait'),
          h('b', null, p.name || species(p.species).name),
          h('small', null, `${species(p.species).rarity}${p.mutations.length ? ` · ${p.mutations.map((x) => MUTATIONS[x]?.name ?? x).join(', ')}` : ''}`)))),
        f.pets.length ? '' : h('p', { class: 'muted' }, 'No pets to show yet.'),
        h('p', { class: 'muted' }, `Last updated ${this.when(f.updatedAt)}. Ask ${f.name} to send a new code to see their latest pets.`),
        h('div', { class: 'btns' },
          h('button', { class: 'btn small danger', onClick: () => { removeFriend(g.state, f.id); g.saveSoon(); close(); this.rerender(); } }, 'Remove'),
          h('button', { class: 'btn', onClick: close }, 'Close')));
    });
  }

  showAchievements(): void {
    const s = this.game.state;
    const got = new Set(s.achieved ?? []);
    this.modal((m, close) => {
      m.append(h('h2', null, `Achievements ${got.size}/${ACHIEVEMENTS.length}`),
        h('div', { class: 'list ach-list' }, ...ACHIEVEMENTS.map((a) => h('div', { class: `item ${got.has(a.id) ? 'done' : 'locked'}` },
          h('div', { class: 'swatch' }, rich(got.has(a.id) ? '🏅' : '🔒')),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, a.name), h('div', { class: 'desc' }, a.desc))))),
        h('div', { class: 'btns' },
          gameServices.available ? h('button', { class: 'btn secondary', onClick: () => gameServices.showAchievements() }, 'Open in Game Center / Play Games') : '',
          h('button', { class: 'btn', onClick: close }, 'Close')));
    });
  }

  /** The first baby hatched: give it a name. */
  nameFirstPet(id: string): void {
    const g = this.game;
    const c = g.state.creatures.find((x) => x.id === id);
    if (!c || c.nickname) return;
    this.modal((m, close) => {
      const input = h('input', { class: 'rename', placeholder: speciesTitle(c), maxLength: 18, 'aria-label': 'Name' }) as HTMLInputElement;
      const save = () => {
        if (input.value.trim()) { A.rename(g.state, c.id, input.value); g.audio.play('coin'); this.toast(`Welcome to the family, ${displayName(c)}! 💕`, 'discovery'); g.saveSoon(); }
        close();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      m.append(h('h2', null, 'Name your first baby!'), this.portrait(c, 'portrait big'),
        h('p', { class: 'muted' }, `Your very first ${species(c.species).name}. What will you call it?`), input,
        h('div', { class: 'btns', style: 'margin-top:10px' },
          h('button', { class: 'btn secondary', onClick: close }, 'Maybe later'),
          h('button', { class: 'btn', onClick: save }, 'That\'s the name!')));
      setTimeout(() => input.focus(), 100);
    });
  }

  /** Make a "look what I found" picture of a pet and share it. */
  async shareCreature(c: Creature): Promise<void> {
    const g = this.game;
    const sp = species(c.species);
    this.toast('Making your picture…', 'info', undefined, 1500);
    const blob = await makeShareCard({
      portrait: g.world.portraits.of(c), name: displayName(c), species: speciesTitle(c), rarity: sp.rarity,
      traits: creatureTraits(c).slice(0, 4), line: `${sizeLabel(c.size)} · ${fmtWeight(weightKg(c, g.now()))}`, code: myFriendCode(g.state),
    });
    const text = `I found a ${speciesTitle(c)} in ${GAME_NAME}! Add me as a friend: ${myFriendCode(g.state)}`;
    if (await shareBlob(blob, text)) return;
    // no share sheet here: show the picture to save by pressing and holding
    const url = URL.createObjectURL(blob);
    this.modal((m, close) => {
      m.append(h('h2', null, 'Your picture'), img(url, 'share-preview'),
        h('p', { class: 'muted' }, 'Press and hold the picture to save or share it.'),
        h('button', { class: 'btn wide', onClick: () => { URL.revokeObjectURL(url); close(); } }, 'Done'));
    });
  }

  /** Settings → What's new: the update log. */
  showUpdates(): void {
    this.modal((m, close) => {
      m.append(h('h2', null, 'What\'s new'));
      const list = h('div', { class: 'updates' });
      for (const u of UPDATES) {
        list.append(h('div', { class: 'section-title' }, `Update ${u.version} · ${u.date}`),
          h('ul', null, ...u.lines.map((l) => h('li', null, l))));
      }
      m.append(list, h('button', { class: 'btn wide', onClick: close }, 'Close'));
    });
  }

  // ------------------------------------------------------------------ modal

  /** A pop-up. `dismissable` false: tapping outside does nothing (a choice must be made). */
  modal(build: (m: HTMLElement, close: () => void) => void, dismissable = true): void {
    const m = h('div', { class: 'modal', role: 'dialog' });
    const wrap = h('div', { class: 'modal-wrap' }, m);
    const close = () => wrap.remove();
    const openedAt = performance.now();
    wrap.addEventListener('click', (e) => { if (dismissable && e.target === wrap && performance.now() - openedAt > 350) close(); });
    build(m, close);
    this.modalHost.append(wrap);
  }

  /** "While you were away" — the answer to "what happened here?". */
  showAwayReport(events: GameEvent[], awayMs: number, finds: AwayFind[] = [], gift: WelcomeGift | null = null): void {
    const s = this.game.state;
    const lines: HTMLElement[] = [];
    if (finds.length) lines.push(h('div', { class: 'section-title' }, '🎁 Presents from your pets'));
    for (const f of finds) {
      const c = s.creatures.find((x) => x.id === f.creatureId);
      lines.push(h('div', { class: 'happen' }, c ? this.portrait(c, '') : h('span', { class: 'e' }, I.icon(I.COIN)), h('span', null, f.text)));
    }
    const arrivals = events.filter((e) => e.type === 'arrival') as Extract<GameEvent, { type: 'arrival' }>[];
    const muts = events.filter((e) => e.type === 'mutation') as Extract<GameEvent, { type: 'mutation' }>[];
    const skies = events.filter((e) => e.type === 'eventStart') as Extract<GameEvent, { type: 'eventStart' }>[];
    const ready = events.filter((e) => e.type === 'eggReady');
    const touched = events.filter((e) => e.type === 'eggTouched');
    const gifts = events.filter((e) => e.type === 'gift').length;
    const kinds = new Map<string, number>();
    for (const sk of skies) kinds.set(sk.kind, (kinds.get(sk.kind) ?? 0) + 1);
    for (const [k, n] of kinds) {
      const def = EVENTS[k as keyof typeof EVENTS];
      lines.push(h('div', { class: 'happen' }, h('span', { class: 'e' }, def.icon), h('span', null, n === 1 ? def.away : `${def.away} (×${n})`)));
    }
    for (const a of arrivals) {
      const stayed = s.creatures.some((c) => c.id === a.creature.id);
      const waits = s.visitors.some((v) => v.creature.id === a.creature.id);
      lines.push(h('div', { class: 'happen' }, this.portrait(a.creature, ''),
        h('span', null, `${a.discovered ? '✨ New! ' : ''}A ${speciesTitle(a.creature)} came to the ${SPOTS[a.spot].name}${stayed ? '' : waits ? ' and is waiting for you with a ❗' : ', looked around, and left'}.`)));
    }
    for (const m of muts) lines.push(h('div', { class: 'happen' }, this.portrait(m.creature, ''),
      h('span', null, `${displayName(m.creature)} met the ${EVENTS[m.cause].touch.name} during a ${EVENTS[m.cause].name.toLowerCase()} and became ${MUTATIONS[m.mutation].name}!`)));
    if (touched.length) lines.push(h('div', { class: 'happen' }, h('span', { class: 'e' }, '🥚'), h('span', null, `${touched.length === 1 ? 'An egg' : `${touched.length} eggs`} glowed strangely as the sky changed.`)));
    if (ready.length) lines.push(h('div', { class: 'happen' }, h('span', { class: 'e' }, '🐣'), h('span', null, `${ready.length === 1 ? 'An egg is' : `${ready.length} eggs are`} ready to hatch!`)));
    if (gifts) lines.push(h('div', { class: 'happen' }, h('span', { class: 'e' }, I.icon(I.COIN)), h('span', null, `Your creatures dug up ${gifts} thing${gifts === 1 ? '' : 's'}. Go find them!`)));
    for (const e of events.filter((x) => x.type === 'expeditionBack') as Extract<GameEvent, { type: 'expeditionBack' }>[]) {
      const c = s.creatures.find((x) => x.id === e.creatureId);
      const d = EXPEDITIONS[e.dest as ExpeditionId];
      if (c && d) lines.push(h('div', { class: 'happen' }, this.portrait(c, ''), h('span', null, `${displayName(c)} is back from the ${d.name}! Welcome them home in Pets → Trips.`)));
    }
    const chest = s.awayChest;
    if (!lines.length && !chest && !gift) return;
    if (!arrivals.length && !Object.values(s.spots).some(Boolean)) {
      lines.push(h('div', { class: 'happen' }, h('span', { class: 'e' }, '🌿'), h('span', { class: 'muted' }, 'Tip: set out a lure before you leave. Visitors will be waiting when you return.')));
    }
    this.modal((m, close) => {
      m.append(h('h2', null, gift ? 'Welcome back!' : 'While you were away'), h('p', { class: 'muted' }, `${fmtDuration(awayMs)} passed in the sanctuary.`));
      if (gift) {
        m.append(h('div', { class: 'welcome-gift' }, h('div', { class: 'wg-icon' }, '💞'),
          h('div', { class: 'grow' }, h('b', null, gift.text),
            h('div', { class: 'lv-rewards' }, rich(`{coin} +${gift.coins.toLocaleString()}  {gem} +${gift.shards}`)),
            h('div', { class: 'muted' }, `Plus a Wild Sky Charm${gift.egg ? ' and a Starry Egg' : ''}!`))));
      }
      if (chest) {
        const items = Object.entries(chest.items).map(([id, n]) => `${n > 1 ? `${n} ` : ''}${id === 'snack' ? 'snacks' : ITEMS[id]?.name ?? id}`);
        const box = h('div', { class: 'away-chest' }, h('div', { class: 'wg-icon' }, '🎁'),
          h('div', { class: 'grow' }, h('b', null, `Your away chest (${Math.round(chest.hours * 10) / 10} h)`),
            h('div', { class: 'lv-rewards' }, rich(`{coin} ${chest.coins.toLocaleString()}${chest.shards ? `  {gem} ${chest.shards}` : ''}`)),
            items.length ? h('div', { class: 'muted' }, `and ${items.join(', ')}`) : null),
          h('div', { class: 'col', style: 'gap:6px' },
            h('button', { class: 'btn small ad', onClick: async () => { if (await this.game.openChest(true)) box.remove(); } }, '▶ Double'),
            h('button', { class: 'btn small', onClick: async () => { if (await this.game.openChest(false)) box.remove(); } }, 'Open')));
        m.append(box);
      }
      m.append(...lines,
        h('button', { class: 'btn wide', style: 'margin-top:14px', onClick: () => {
          // closing without opening still gives you the chest
          if (this.game.state.awayChest) void this.game.openChest(false);
          close();
        } }, 'Let\'s see'));
    });
  }

  // ------------------------------------------------------------------ reveal

  showReveal(creature: Creature, isNew: boolean, newMuts: MutationId[], onDone: () => void): { phase: (p: string) => void } {
    const prompt = h('div', { class: 'prompt' }, 'Tap the egg!');
    const top = h('div', null, prompt);
    const bottom = h('div', { style: 'width:100%;display:flex;justify-content:center' });
    const ui = h('div', { class: 'reveal-ui' }, top, bottom);
    this.revealHost.replaceChildren(ui);
    this.toasts.replaceChildren();
    this.coachEl.classList.add('hidden');
    this.dock.classList.add('hidden');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.revealHost.replaceChildren();
      this.dock.classList.remove('hidden');
      onDone();
    };
    return {
      phase: (p: string) => {
        if (p === 'burst') prompt.remove();
        if (p !== 'show') return;
        const sp = species(creature.species);
        const mythic = sp.rarity === 'mythical';
        top.replaceChildren(h('div', { class: `title ${isNew ? 'new' : ''} ${mythic ? 'mythic' : ''}` },
          mythic ? (isNew ? '✦ A MYTHICAL creature! ✦' : '✦ Mythical! ✦') : isNew ? (sp.origin === 'hybrid' ? 'New creation!' : 'New discovery!') : 'It hatched!'));
        const muts = creature.mutations.filter((m) => !sp.traits.includes(MUTATIONS[m].trait));
        bottom.replaceChildren(h('div', { class: 'card' },
          h('h3', null, speciesTitle(creature)),
          h('div', { class: 'chips', style: 'margin-top:6px' }, ...creatureTraits(creature).map((t) =>
            h('span', { class: `chip ${MUTATION_TRAITS.includes(t) ? 'mut' : ''}` }, t))),
          h('p', null, sp.blurb),
          isOutlier(creature.size) ? h('p', { style: 'color:#d0602a;font-weight:700' }, creature.size > 1 ? '✦ A Colossal one! It will grow far bigger than any other.' : '✦ A Teeny one! It will stay tiny forever.') : null,
          muts.some((m) => newMuts.includes(m)) ? h('p', { style: 'color:#6a4fd6;font-weight:600' }, `First ${muts.filter((m) => newMuts.includes(m)).map((m) => MUTATIONS[m].name).join(' & ')} creature you've ever seen!`) : null,
          h('div', { class: 'btns', style: 'margin-top:12px' },
            (isNew || sp.rarity === 'legendary' || sp.rarity === 'mythical') ? h('button', { class: 'btn secondary', onClick: (e: Event) => { e.stopPropagation(); void this.shareCreature(creature); } }, '📱 Share') : '',
            h('button', { class: 'btn', style: 'flex:1', onClick: (e: Event) => { e.stopPropagation(); finish(); } }, 'Welcome home')),
        ));
        // after the spin, a tap anywhere says hello
        setTimeout(() => {
          ui.style.pointerEvents = 'auto';
          ui.addEventListener('click', finish);
        }, 1300);
      },
    };
  }

  /** The EVENT tile: watch an ad (or break a charm) to summon a sky event, and see what's coming. */
  /** The Halloween Pass: Candy from playing fills tiers; free rewards for all, more on the paid track. */
  private passScrolled = false;
  showPass(): void {
    this.passScrolled = false;
    const g = this.game;
    const s = g.state;
    const t = g.now();
    this.openSheet(PASS.name, inHalloween(t) ? `Ends in ${Math.max(1, Math.ceil((halloweenEndsAt(t) - t) / 86_400_000))} days · earn Candy by playing` : 'Halloween is over for this year', (b) => {
      const p = passState(s);
      const tier = passTier(s);
      const into = p.points - tier * PASS.pointsPerTier;
      const pct = tier >= PASS.tiers ? 100 : Math.round((into / PASS.pointsPerTier) * 100);
      const prod = p.premium ? null : g.purchases.products().find((x) => x.id === PASS.productId);
      b.append(h('div', { class: 'pass-head' },
        h('div', { class: 'pass-badge' }, h('b', null, String(tier)), h('span', null, 'TIER')),
        h('div', { class: 'grow' },
          h('div', { class: 'pass-bar' }, h('i', { style: `width:${pct}%` }), h('span', null, rich(tier >= PASS.tiers ? 'All tiers reached! ✨' : `🍬 ${into} / ${PASS.pointsPerTier}`))),
          h('div', { class: 'pass-sub' }, 'Earn Candy from everything you do')),
        p.premium ? h('div', { class: 'pass-owned' }, rich('✓ Unlocked'))
          : h('button', { class: 'btn pass-unlock', onClick: () => void g.buyPack(PASS.productId) }, h('span', null, 'GET PASS'), h('small', null, prod?.price ?? '')),
      ));
      if (!p.premium) {
        // what's waiting on the paid track right now (passed tiers), then the big headline offer
        const waiting = Math.min(tier, PASS.tiers);
        b.append(h('div', { class: 'pass-offer' },
          h('div', { class: 'pass-offer-pets' }, ...(['pumpkit', 'peekaboo', 'gloomwing'] as const).map((id) => img(g.world.portraits.get(id, [], false), 'pass-offer-pet'))),
          h('div', { class: 'grow' },
            h('b', null, '3 exclusive creatures + 25 bonus rewards'),
            h('div', null, 'Pumpkit right away, Peekaboo at tier 1 and the Mythical Gloomwing at tier 25. Only this Halloween!'),
            waiting ? h('div', { class: 'pass-waiting' }, rich(`🎁 ${waiting} bonus reward${waiting === 1 ? '' : 's'} already waiting for you`)) : ''),
          h('button', { class: 'btn pass-cta', onClick: () => void g.buyPack(PASS.productId) }, h('span', null, 'UNLOCK NOW'), h('small', null, prod?.price ?? ''))));
      }
      // the track: tickets on the left, tiers scroll sideways (premium on top, free below)
      const ico = (r: PassReward): Node => {
        if (r.coins) return I.icon(I.COIN, 'pc-ico');
        if (r.shards) return I.icon(I.GEM, 'pc-ico');
        if (r.egg) return I.icon(tierEggIcon(r.egg), 'pc-ico');
        if (r.decor) return img(g.world.portraits.decor(r.decor), 'pc-img');
        if (r.creature) return img(g.world.portraits.get(r.creature, [], false), 'pc-img');
        if (r.lure) return h('span', { class: 'pc-emo' }, rich(HABITAT_ICON[LURES[r.lure[0]]?.attracts] ?? '✨'));
        if (r.food) return h('span', { class: 'pc-emo' }, rich(FOODS[r.food[0]]?.icon ?? '🍓'));
        return h('span');
      };
      const amount = (r: PassReward) => r.coins ? r.coins.toLocaleString() : r.shards ? String(r.shards) : r.lure ? `×${r.lure[1]}` : r.food ? `×${r.food[1]}` : r.egg ? 'Egg' : r.creature ? 'Creature!' : 'Decor';
      const card = (i: number, r: PassReward, track: 'free' | 'paid') => {
        const got = (track === 'free' ? p.free : p.paid).includes(i);
        const lockedPass = track === 'paid' && !p.premium;
        const ready = i <= tier && !got && !lockedPass;
        return h('button', { class: `pc ${track} ${got ? 'got' : ''} ${ready ? 'ready' : ''} ${r.creature ? 'star' : ''}`, title: describeReward(r).replace(/\{\w+\}/g, ''), onClick: () => {
          if (got) return this.toast(rich(`Already claimed: ${describeReward(r)}`).textContent ?? '');
          if (lockedPass) return this.fail('Unlock the Halloween Pass to claim this.');
          if (i > tier) return this.toast(`${describeReward(r).replace(/\{\w+\}/g, '').trim()} · reach tier ${i} to claim.`);
          const res = claimPassTier(s, i, track, g.now());
          if (!res.ok) return this.fail(res.error);
          g.audio.play('coin');
          this.toast(`🎃 ${res.message}`, 'discovery');
          g.saveSoon();
          this.rerender();
        } }, h('div', { class: 'pc-art' }, ico(r)), h('div', { class: 'pc-amt' }, amount(r)),
          got ? h('i', { class: 'pc-tick' }, rich('✓')) : lockedPass ? h('i', { class: 'pc-lock' }, rich('🔒')) : ready ? h('i', { class: 'pc-claim' }, 'CLAIM') : '');
      };
      const cols = h('div', { class: 'pass-cols' });
      for (let i = 1; i <= PASS.tiers; i++) {
        const [free, paid] = PASS_TIERS[i - 1];
        const fill = i < tier ? 100 : i === tier ? pct : 0;
        cols.append(h('div', { class: `pass-col ${i <= tier ? 'reached' : ''}` },
          card(i, paid, 'paid'),
          h('div', { class: 'pass-node' }, h('div', { class: 'pass-link' }, h('i', { style: `width:${i < PASS.tiers ? fill : 0}%` })), h('b', null, String(i))),
          card(i, free, 'free')));
      }
      const scroller = h('div', { class: 'pass-scroll' }, cols);
      b.append(h('div', { class: 'pass-board' },
        h('div', { class: 'pass-tickets' },
          h('div', { class: `pass-ticket gold ${p.premium ? 'on' : ''}` }, 'HALLOWEEN', h('br'), 'PASS'),
          h('div', { class: 'pass-ticket free' }, 'FREE', h('br'), 'PASS')),
        scroller));
      if (!this.passScrolled) {
        this.passScrolled = true;
        requestAnimationFrame(() => { scroller.scrollLeft = Math.max(0, (Math.min(Math.max(tier, 1), PASS.tiers) - 1) * 112); });
      }
    }, '🎃');
  }

  showSummon(): void {
    const s = this.game.state;
    const t = this.game.now();
    const busy = activeEvent(s, t);
    const left = A.adsLeft(s, t);
    const charms = Object.entries(s.charms ?? {}).filter(([, n]) => n > 0);
    this.modal((m, close) => {
      m.append(
        h('h2', { class: 'outlined' }, 'Summon an event!'),
        inHalloween(t) ? h('div', { class: 'halloween-banner' },
          h('b', null, `🎃 Halloween event · ${halloweenEndsAt(t) - t > 86_400_000 ? `${Math.ceil((halloweenEndsAt(t) - t) / 86_400_000)} days` : fmtDuration(halloweenEndsAt(t) - t)} left`),
          h('span', null, 'A spooky sky comes at least once an hour, and each one can leave a rare mark: Ghostly, Calcified, Mummified, Zombified, Vampire or Pumpkin. Eggs feel them too!'),
          h('button', { class: 'btn small', style: 'align-self:flex-start', onClick: () => { close(); this.showPass(); } }, '🎃 Halloween Pass')) : '',
        h('p', null, 'Watch a short ad and the sky brings a random event. Maybe a storm or an eclipse… or something rare like a Starry Night, a Full Moon or an Aurora.'),
        h('div', { class: 'row', style: 'justify-content:center;gap:10px;font-size:26px;margin:8px 0;flex-wrap:wrap' },
          ...Object.values(EVENTS).filter((e) => !e.season || inHalloween(t)).map((e) => h('span', { title: e.name }, e.icon))),
        h('p', { class: 'muted' }, busy
          ? `A ${EVENTS[busy.kind].name.toLowerCase()} is happening right now. Try again when it passes.`
          : `${left} ad${left === 1 ? '' : 's'} left today. Each event can change your creatures in its own way.`),
        h('div', { class: 'btns' },
          h('button', { class: 'btn secondary', onClick: close }, 'Not now'),
          h('button', { class: 'btn ad', style: 'flex:1', disabled: !!busy || left <= 0, onClick: async () => {
            close();
            await this.game.adSummon();
          } }, '▶ Watch ad'),
        ),
      );
      // sky charms you own
      if (charms.length) {
        m.append(h('div', { class: 'section-title' }, 'Your sky charms'),
          h('div', { class: 'list' }, ...charms.map(([id, n]) => h('div', { class: 'item' }, h('div', { class: 'swatch' }, SKY_ITEMS[id]?.icon ?? '✨'),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, `${SKY_ITEMS[id]?.name ?? id} ×${n}`)),
            h('button', { class: 'btn small shard', disabled: !!busy, onClick: () => { close(); this.game.breakCharm(id); } }, 'Break')))));
      }
      // what's coming
      m.append(h('div', { class: 'section-title' }, 'Coming up'));
      if (A.canSeeForecast(s, t)) {
        m.append(h('div', { class: 'list forecast' }, ...A.upcomingEvents(s, t, 3).map((e) =>
          h('div', { class: 'item' }, h('div', { class: 'swatch' }, EVENTS[e.kind].icon),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, EVENTS[e.kind].name), h('div', { class: 'desc' }, `In ${fmtDuration(e.start - t)} · lasts ${fmtDuration(e.end - e.start)}`))))),
        s.telescope ? h('p', { class: 'muted' }, '🔭 Your Telescope always shows the sky ahead.') : h('p', { class: 'muted' }, `🗺️ Star Chart: ${fmtDuration((s.chartUntil ?? 0) - t)} left.`));
      } else {
        m.append(h('div', { class: 'item' }, h('div', { class: 'swatch' }, '🔭'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, 'What\'s next in the sky?'), h('div', { class: 'desc' }, 'A Star Chart or the Sky Telescope from Mango shows the next three events and when they arrive.')),
          h('button', { class: 'btn small', onClick: () => { close(); this.openShopFor('item'); } }, 'Shop')));
      }
    });
  }

  showAd(seconds: number): Promise<boolean> {
    return new Promise((resolve) => {
      let left = seconds;
      const count = h('div', { class: 'count' }, String(left));
      const el = h('div', { class: 'ad-overlay' }, h('div', null, h('div', null, 'Rewarded ad (simulated)'), count, h('div', { class: 'muted' }, 'Real ads appear only in store builds.')));
      this.modalHost.append(el);
      const iv = setInterval(() => {
        left -= 1;
        count.textContent = String(left);
        if (left <= 0) {
          clearInterval(iv);
          el.remove();
          resolve(true);
        }
      }, 1000);
    });
  }

  // ------------------------------------------------------------------ tutorial coach

  private updateCoach(): void {
    const s = this.game.state;
    const step = s.tutorial;
    let text = '';
    switch (step) {
      case 0: text = 'Welcome! Tap the glowing ring to set out a lure.'; break;
      case 1: text = 'Now wait a moment. Visitors are on their way!'; break;
      case 2: text = 'A visitor! Tap the ! and Keep it.'; break;
      case 3: text = 'Two pets that share a type can make an egg. Tap ⛲ Create.'; break;
      case 3.5: text = 'Pick two pets. A 💚 means they match.'; break;
      case 4: {
        const ready = s.eggs.some((e) => e.progressMs >= e.incubationMs);
        text = ready ? 'Your egg is ready! Tap it to hatch.' : 'Your egg is warming. It hatches soon.';
        break;
      }
      default:
        if (step >= 5 && step < 6) text = this.tourStep(step)?.text ?? '';
        else text = '';

    }
    // never talk over a pop-up (like the first-time controls card)
    if (!text || this.coachDismissed === step || this.sheetOpen && step !== 3.5 && step !== 4 || this.game.world.revealing || this.modalHost.childElementCount > 0) {
      this.coachEl.classList.add('hidden');
      this.coachTarget?.classList.remove('coach-target');
      this.coachTarget = null;
      return;
    }
    if (this.coachEl.dataset.step !== String(step) || this.coachEl.classList.contains('hidden')) {
      this.coachEl.dataset.step = String(step);
      const order = [0, 1, 2, 3, 4, 5];
      const at = Math.floor(step);
      this.coachEl.replaceChildren(
        h('div', { class: 'coach-who' }, I.icon(I.AXOLOTL, 'icon who')),
        h('div', { class: 'coach-body' },
          h('div', { class: 'coach-name' }, 'Lotl', h('span', { class: 'coach-steps' }, ...order.map((i) => h('i', { class: i < at ? 'done' : i === at ? 'now' : '' })))),
          h('div', { class: 'coach-text' }, text)),
        step >= 5
          ? h('div', { class: 'coach-tour' },
            h('button', { class: 'btn small', onClick: () => this.game.setTutorial(this.nextTour(step)) }, this.nextTour(step) >= 6 ? 'Let\'s play!' : 'Next'),
            h('button', { class: 'coach-skip', onClick: () => this.game.setTutorial(6) }, 'Skip tour'))
          : h('button', { class: 'x', 'aria-label': 'Dismiss', onClick: () => { this.coachDismissed = step; } }, I.icon(I.CLOSE)));
      this.coachEl.classList.remove('hidden');
    }
    if (this.sheetOpen && (step === 3.5 || step === 4)) this.coachEl.classList.add('hidden');
    // point at the button the tour is talking about
    const target = step >= 5 && step < 6 && !this.coachEl.classList.contains('hidden') ? this.tourStep(step)?.target() : null;
    if (target !== this.coachTarget) {
      this.coachTarget?.classList.remove('coach-target');
      target?.classList.add('coach-target');
      this.coachTarget = target ?? null;
    }
  }

  private coachTarget: HTMLElement | null = null;
  readonly hints = new Hints(document.body);
  /** Gesture tips at the moments they help. */
  private syncHints(): void {
    const s = this.game.state;
    if (this.modalHost.childElementCount || this.sheetOpen || this.game.world.revealing) return;
    if (s.tutorial === 1) this.hints.show('drag');                     // waiting for the first visitor
    else if (s.tutorial === 4) this.hints.show('pinch');               // waiting for the first egg
    else if (s.tutorial >= 6) {
      const st = starterStep(s);
      if (st?.kind === 'breed') this.hints.show('hold');
      else if (st?.kind === 'hatch' || s.starter?.done) this.hints.show('twist');
    }
  }

  /** The after-the-first-hatch tour: one tip per feature, each pointing at its button. */
  private tour(): { text: string; target: () => HTMLElement | null }[] {
    const dock = (label: string) => () => [...this.dock.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.includes(label)) ?? null;
    const q = (sel: string) => () => document.querySelector<HTMLElement>(sel);
    // a short tour of what's on screen now; the other buttons appear one by one as you level up (ui/features.ts)
    const steps = [
      { text: 'Your first baby! A quick tour.', target: () => null },
      { text: 'LURES bring new visitors.', target: dock('LURES') },
      { text: 'CREATE makes eggs from two pets.', target: dock('CREATE') },
      { text: 'PETS: feed, store and sell.', target: dock('PETS') },
      { text: 'JOURNAL: everything you find. Can you find them all?', target: q('.found-chip') },
      { text: 'Pet your pets! Friends bring gifts. Strangers may not listen.', target: () => null },
      { text: 'More buttons unlock as you level up. Have fun!', target: q('.level-badge') },
    ];
    return steps;
  }

  private tourStep(step: number) {
    return this.tour()[Math.round((step - 5) * 20)];
  }

  private nextTour(step: number): number {
    const i = Math.round((step - 5) * 20) + 1;
    return i >= this.tour().length ? 6 : 5 + i / 20;
  }

  // ------------------------------------------------------------------ islands

  /** Things waiting for you on other worlds: a ready egg at home, or a rare-or-better visitor. */
  worldAlerts(): Map<IslandId, string> {
    const s = this.game.state;
    const here = this.game.world.current;
    const out = new Map<IslandId, string>();
    for (const v of s.visitors) {
      if (v.island === here || !s.islands[v.island]?.owned) continue;
      const r = species(v.creature.species).rarity;
      if (r === 'common' || r === 'uncommon') continue;
      out.set(v.island, `A ${r} ${species(v.creature.species).name} is waiting at the ${SPOTS[v.spot].name}!`);
    }
    if (s.wanderer && s.wanderer.island !== here) {
      out.set(s.wanderer.island, s.wanderer.kind === 'goblin' ? 'A Goblin is up to no good here!' : `${WANDERERS[s.wanderer.kind].name} is visiting!`);
    }
    for (const e of s.eggs) {
      if (e.nest === null || e.progressMs < e.incubationMs) continue;
      const at = s.placedDecor.find((d) => d.id === e.nest)?.island ?? 'home';
      if (at !== here) out.set(at, 'An egg is ready to hatch!');
    }
    return out;
  }

  private firstAlert(): IslandId | undefined {
    return this.worldAlerts().keys().next().value;
  }

  showIslands(highlight?: IslandId): void {
    const s = this.game.state;
    // centre the highlighted world once, not on every refresh (that fought your scrolling)
    let scrolled = false;
    this.openSheet('Worlds', 'Tap a world to visit it. Roll each globe to explore it.', (b) => {
      b.append(h('button', { class: 'btn secondary wide', style: 'margin-bottom:10px', onClick: () => this.showPets('storage') }, `Pets & storage (${storedCount(s)} / ${s.storageSlots} stored)`));
      const alerts = this.worldAlerts();
      for (const id of ISLAND_ORDER) {
        const def = ISLANDS[id];
        const isl = s.islands[id] ?? { owned: false, size: 0 };
        const here = this.game.world.current === id;
        const pop = s.creatures.filter((c) => c.island === id && !c.stored).length;
        const card = h('div', { class: `island-card ${highlight === id ? 'hl' : ''} ${def.status === 'soon' ? 'soon' : ''}` },
          h('div', { class: 'row' },
            h('div', { class: 'swatch big', style: `background:linear-gradient(160deg, ${def.palette.top}, ${def.palette.lip})` }, def.icon),
            h('div', { class: 'grow col' },
              h('div', { class: 'name' }, def.name, here ? h('span', { class: 'chip', style: 'margin-left:6px' }, 'You are here') : null),
              h('div', { class: 'desc' }, def.blurb),
              isl.owned ? h('div', { class: 'muted' }, `${SIZE_NAMES[isl.size]} · ${pop}/${islandCapacity(s, id)} creatures`) : null,
              alerts.has(id) ? h('div', { class: 'alert-line' }, h('b', null, '!'), alerts.get(id)!)
                : A.buyableWorlds(s).includes(id) ? h('div', { class: 'alert-line' }, h('b', null, '!'), 'Ready to open! You have the level and the coins.') : null,
            )),
        );
        const btns = h('div', { class: 'btns' });
        if (isl.owned) {
          if (!here) btns.append(h('button', { class: 'btn secondary small', onClick: () => this.game.travel(id) }, 'Visit'));
          const next = SIZE_PRICE[isl.size + 1];
          const newSpots = Object.values(SPOTS).filter((sp) => sp.island === id && sp.minSize === isl.size + 1);
          if (next) {
            btns.append(
              h('button', { class: 'btn small', disabled: s.glimmer < next.coins, onClick: () => this.game.upgradeIsland(id, 'glimmer') },
                rich(`Grow to ${SIZE_NAMES[isl.size + 1]} · {coin} ${next.coins}`)),
              ...newSpots.map((sp) => h('div', { class: 'muted', style: 'width:100%' }, `Opens a new lure spot: ${sp.name}`)),
              h('button', { class: 'btn shard small', disabled: s.shards < next.gems, onClick: () => this.game.upgradeIsland(id, 'shards') },
                rich(`{gem} ${next.gems}`)),
            );
          } else btns.append(h('span', { class: 'muted' }, 'Fully grown island.'));
        } else if (def.status === 'buyable') {
          const lvl = levelOf(s.xp);
          btns.append(lvl < def.price.level
            ? h('span', { class: 'chip locked' }, rich(`🔒 Reach level ${def.price.level} (you're ${lvl}), then {coin} ${def.price.coins.toLocaleString()}`))
            : h('button', { class: 'btn small', disabled: s.glimmer < def.price.coins, onClick: () => this.game.buyIsland(id) },
              rich(`Unlock · {coin} ${def.price.coins.toLocaleString()}`)));
          const natives = SPECIES.filter((sp) => sp.traits.includes(def.habitat)).length;
          btns.append(h('div', { class: 'muted', style: 'width:100%' }, `${natives} kinds of creature call this habitat home. Comes with its own lure spots.`));
        } else {
          btns.append(h('span', { class: 'chip' }, 'Coming soon'));
        }
        card.append(btns);
        b.append(card);
        if (highlight === id && !scrolled) {
          scrolled = true;
          setTimeout(() => card.scrollIntoView({ block: 'center' }), 60);
        }
      }
    }, I.ISLANDS);
  }

  // ------------------------------------------------------------------ widget

  /** Small pinned panel: next egg timer and a favorite creature at a glance. */
  private updateWidget(): void {
    const s = this.game.state;
    const nestEggs = s.eggs.filter((e) => e.nest !== null).sort((a, b) => A.remainingMs(a) - A.remainingMs(b));
    const egg = nestEggs[0];
    const pinned = this.game.pinned ? s.creatures.find((c) => c.id === this.game.pinned) : undefined;
    const eggLine = egg ? (A.remainingMs(egg) <= 0 ? 'Ready to hatch!' : fmtClock(A.remainingMs(egg))) : '';
    const act = pinned ? (pinned.stored ? 'Resting in storage' : this.game.world.creatureActivity(pinned.id) || `On ${ISLANDS[pinned.island].name}`) : '';
    const key = `${egg?.id}|${eggLine}|${pinned?.id}|${pinned ? displayName(pinned) : ''}|${act}|${pinned?.mutations.join()}`;
    if (key === this.widgetKey) return;
    this.widgetKey = key;
    this.widget.classList.toggle('hidden', !egg && !pinned);
    this.widget.replaceChildren(
      egg ? h('button', { class: `w-row ${A.remainingMs(egg) <= 0 ? 'ready' : ''}`, onClick: () => this.showNest(egg.nest!) },
        h('span', { class: 'w-ico' }, I.icon(eggIcon(egg))), h('span', { class: 'col' }, h('b', null, eggLine), h('small', null, nestEggs.length > 1 ? `+${nestEggs.length - 1} more` : 'Next egg'))) : '',
      pinned ? h('button', { class: 'w-row', onClick: () => (pinned.stored ? this.showPets('storage') : this.focusCreature(pinned.id)) },
        img(this.game.world.portraits.of(pinned), 'w-pic'),
        h('span', { class: 'col' }, h('b', null, displayName(pinned)), h('small', null, act))) : '',
    );
  }

  /** The Font, nests, basket and shop live on Kindred Grove. */
  private ensureHome(): void {
    if (this.game.world.current !== 'home') this.game.world.travelTo('home', true);
  }

  /** Jump to a creature, hopping islands if needed, and show its name bubble. */
  focusCreature(id: string): void {
    const c = this.game.state.creatures.find((x) => x.id === id);
    if (!c) return;
    if (this.game.world.current !== c.island) this.game.world.travelTo(c.island, true);
    setTimeout(() => {
      const p = this.game.world.creaturePosition(id);
      if (p) this.game.world.focus(p, 13);
      this.selectCreature(id);
    }, 30);
  }

  hideHud(hidden: boolean): void {
    this.root.querySelector('.hud-top')?.classList.toggle('hidden', hidden);
  }
}
