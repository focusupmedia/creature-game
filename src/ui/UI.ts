import { SPECIES, species } from '../content/species';
import { DECOR, EGG_TIERS, EVENTS, FOODS, GIFTABLE_MUTATIONS, TOOLS, ITEMS, LEGENDARY, LEGENDARY_ORDER, LURES, MUTATIONS, SPOTS, spotOpen } from '../content/world';
import { ISLANDS, ISLAND_ORDER, SIZE_NAMES, SIZE_PRICE } from '../content/islands';
import { TUNING } from '../content/tuning';
import { NESTS, FONT, SHOP_STALL } from '../content/layout';
import * as A from '../core/actions';
import { creatureTraits, displayName, growth, isOutlier, sizeLabel, speciesTitle } from '../core/creatures';
import { compatibility, eggClues } from '../core/genetics';
import { arrivalWeights } from '../core/lures';
import { nestOccupant } from '../core/state';
import type { Creature, Egg, GameEvent, IslandId, LegendaryKind, MutationId, SpotId, Trait } from '../core/types';
import { islandCapacity } from '../core/sim';
import { activeEvent, dayPhase, daylight, isDark, nextEvent } from '../core/world';
import type { Game } from '../game/Game';
import { fmtDuration, h, img, rich, setText } from './dom';
import * as I from './icons';
import { WorldLabels } from './Labels';
import { QUIRKS } from '../content/quirks';
import { WANDERERS } from '../content/wanderers';
import { deleteQuirk, wipeQuirks } from '../core/quirks';
import { MAX_LEVEL, levelOf, levelProgress, levelReward, type LevelUp } from '../core/levels';
import { DAILY_POOL, LASTING, claimable, lastingReward, refreshDailies } from '../core/quests';
import { type AwayFind, canSell, collectorHere, findVisitor, isHungry, visitorThanks, nextSlotPrice, ripeFruit, sellPrice, storedCount } from '../core/care';
import { rarityTag } from './rarity';

type PetsSort = 'newest' | 'rarity' | 'name' | 'size' | 'hunger';

const fmtClock = (ms: number) => `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, '0')}`;

const MUT_ICON: Record<MutationId, string> = { lunar: '🌙', storm: '⚡', giant: '⛰️', prismatic: '🌈', starlit: '🌟', frost: '❄️', angelic: '😇', infernal: '😈', abyssal: '🫧', aurora: '🌌', misty: '🌫️' };
const ITEM_ICON: Record<string, string> = { warmth: '🔥', giantChance: '🧪', grow: '🌱', shrink: '💧', glitter: '✨', speedy: '⚡' };
const HABITAT_ICON: Partial<Record<Trait, string>> = { Grove: '🌳', Tide: '💧', Bloom: '🌸', Mystic: '🔮' };
const MUTATION_TRAITS: Trait[] = ['Lunar', 'Storm', 'Giant', 'Prismatic', 'Starlit', 'Frost', 'Angelic', 'Infernal', 'Abyssal', 'Aurora', 'Misty'];

/** What Mango says on each shop tab; the line changes with every new stock. */
const MANGO_LINES: Record<'lure' | 'egg' | 'item' | 'decor' | 'shards' | 'food', string[]> = {
  egg: ['Ooh-ooh! Fresh eggs, still warm!', 'Who knows what is inside? Not me!', 'Shake it gently... I hear wings!'],
  lure: ['A good smell brings good friends.', 'This one makes my nose twitch!', 'Lures! Tastier than bananas. Almost.'],
  item: ['Curious things from far islands.', 'Do not ask where I found these.', 'Handle with care, keeper!'],
  decor: ['Make your island cozy!', 'Pretty things for pretty places.', 'Finest decor this side of the sea!'],
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
  private questTile = h('button', { class: 'hud-tile quests', 'aria-label': 'Quests', onClick: () => { this.game.audio.play('tap'); this.showQuests(); } },
    h('span', { class: 'emoji' }, '📜'), h('span', { class: 'lbl' }, 'QUESTS'), this.questBadge);
  private questTab: 'daily' | 'lasting' = 'daily';
  private petsTab: 'wandering' | 'storage' = 'wandering';
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
  private coachEl = h('div', { class: 'coach hidden' });
  private sheetHost = h('div');
  private modalHost = h('div');
  private revealHost = h('div');
  private placeHost = h('div');
  private dock: HTMLElement;
  private shopDot = h('span', { class: 'dot hidden' });
  private journalDot = h('span', { class: 'dot hidden' });
  private sheetRender: (() => void) | null = null;
  private lastGlimmer = -1;
  private lastShards = -1;
  private refreshTimer = 0;
  private fontPick: [string | null, string | null] = [null, null];
  private journalTab: 'creatures' | 'mutations' | 'notes' = 'creatures';
  private journalWorld: IslandId | 'all' = 'all';
  private shopTab: 'lure' | 'egg' | 'item' | 'decor' | 'shards' | 'food' = 'egg';
  private coachDismissed = -1;
  private coachShownAt = 0;
  private seenShopRotation = 0;
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
          h('div', { class: 'hud-col' }, h('div', { class: 'hud-row', style: 'gap:6px' }, this.levelBadge, h('div', { class: 'sky-chip' }, this.skyChip)), this.widget),
          h('div', { class: 'spacer' }),
          h('div', { class: 'hud-col right' },
            h('button', { class: 'hud-tile', 'aria-label': 'Watch an ad to summon a sky event', onClick: () => this.showSummon() },
              I.icon(I.SUMMON), h('span', { class: 'lbl' }, 'EVENT'), this.adsBadge),
            h('button', { class: 'hud-tile islands', 'aria-label': 'Islands', onClick: () => { this.game.audio.play('tap'); this.showIslands(this.firstAlert()); } },
              I.icon(I.ISLANDS), h('span', { class: 'lbl' }, 'ISLANDS'), this.islandsBadge),
            this.questTile,
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
      dockBtn(I.PAW, 'PETS', () => this.showPets()),
      dockBtn(I.JOURNAL, 'JOURNAL', () => this.showJournal(), this.journalDot),
      dockBtn(I.SHOP, 'SHOP', () => this.showShop(), this.shopDot),
      dockBtn(I.DECOR, 'DECOR', () => this.showDecor()),
    );
    this.root.append(top, this.banner, this.toasts, this.coachEl, this.dock, this.sheetHost, this.placeHost, this.modalHost, this.revealHost);
    mount.append(this.root);
    this.seenShopRotation = game.state.shop.rotation;
    this.seenNotes = game.state.journal.notes.length;
    this.labels = new WorldLabels(game, this.root, {
      openSpot: (id) => this.showSpot(id),
      openNest: (i) => this.showNest(i),
      openFont: () => this.showFont(),
      openShop: () => this.showShop(),
      openBasket: () => this.showBasket(),
      openCreatureMenu: (id) => this.showCreature(id),
      openIsland: (id) => (game.state.islands[id]?.owned ? game.travel(id) : this.showIslands(id)),
    });
  }

  /** Tap on a creature: name bubble over its head; ⚙️ opens the full menu. */
  selectCreature(id: string | null): void {
    if (this.sheetOpen) this.closeSheet(false);
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
      this.levelFill.style.width = `${Math.round(lp.pct * 100)}%`;
    }
    this.collectorTile.classList.toggle('hidden', !collectorHere(s, t));
    this.islandsBadge.classList.toggle('hidden', this.worldAlerts().size === 0);
    const ready = claimable(s);
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
    const ads = A.adsLeft(s, t);
    if (this.adsBadge.textContent !== String(ads)) this.adsBadge.textContent = String(ads);
    this.journalDot.classList.toggle('hidden', s.journal.notes.length === this.seenNotes);

    this.refreshTimer -= dt;
    const typing = document.activeElement instanceof HTMLInputElement && this.sheetHost.contains(document.activeElement);
    if (this.refreshTimer <= 0 && this.sheetRender && !typing) {
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

  toast(text: string, kind: 'info' | 'discovery' = 'info', image?: string, ms = 3200): void {
    // The axolotl mascot delivers any news that doesn't come with its own picture.
    const el = h('div', { class: `toast ${kind}` }, image ? img(image) : I.icon(I.AXOLOTL, 'icon toast-mascot'), h('span', null, rich(text)));
    this.toasts.append(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild!.remove();
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 450);
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
      body.replaceChildren();
      render(body);
      body.scrollTop = scroll;
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

  rerender(): void {
    this.sheetRender?.();
  }

  get sheetOpen(): boolean {
    return !!this.sheetRender;
  }

  private portrait(c: { species: string; mutations: MutationId[] }, cls = 'portrait'): HTMLImageElement {
    return img(this.game.world.portraits.get(c.species, c.mutations), cls);
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
    this.game.world.focus(spot, 14);
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
        h('button', { class: 'btn small', onClick: () => this.showShop() }, 'Visit shop')));
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
      const head = h('div', { class: 'row', style: 'align-items:flex-start' }, this.portrait(c, 'portrait big'),
        h('div', { class: 'col', style: 'flex:1' },
          renaming
            ? (() => {
              const input = h('input', { class: 'rename', value: c.nickname ?? '', placeholder: speciesTitle(c), maxLength: 18 });
              input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
              input.addEventListener('blur', () => { A.rename(this.game.state, c.id, input.value); renaming = false; this.game.saveSoon(); this.showCreature(c.id); });
              setTimeout(() => input.focus(), 50);
              return input;
            })()
            : h('button', { class: 'btn secondary small', style: 'align-self:flex-start', onClick: () => { renaming = true; this.rerender(); } }, '✏️ Name'),
          h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, rarityTag(sp.rarity), isOutlier(c.size) ? h('span', { class: 'rarity r-outlier' }, sizeLabel(c.size)) : h('span', { class: 'muted' }, sizeLabel(c.size))),
          h('div', { class: 'desc muted' }, sp.blurb),
          h('div', { class: 'quirk-row' }, ...c.quirks.map((q) => h('span', { class: 'quirk', title: QUIRKS[q].blurb }, `${QUIRKS[q].icon} ${QUIRKS[q].name}`))),
        ));
      b.append(head);
      const t = this.game.now();
      const grown = growth(c, t);
      b.append(this.metBlock(c));
      const tools = this.game.state.tools;
      const g = this.game;
      const full = Math.round(c.fullness * 100);
      const here = collectorHere(g.state, g.now());
      const price = sellPrice(g.state, c, here);
      const noSell = canSell(g.state, c);
      b.append(h('div', { class: 'care' },
        h('div', { class: 'row', style: 'gap:8px;align-items:center' },
          h('span', null, isHungry(c) ? '🍖' : '🍓'),
          h('div', { class: 'grow' }, h('div', { class: `progress small ${isHungry(c) ? 'hungry' : ''}` }, h('i', { style: `width:${full}%` })),
            h('span', { class: 'muted' }, isHungry(c) ? 'Hungry! It won\'t dig or breed until it eats.' : c.fullness >= 0.7 ? 'Well fed and happy' : 'Peckish')),
          h('button', { class: 'btn small', onClick: () => g.feed(c.id) }, `Feed (${(g.state.food.fruit ?? 0) + (g.state.food.snack ?? 0)})`)),
        h('div', { class: 'btns', style: 'margin-top:8px' },
          h('button', { class: `btn small ${c.favorite ? '' : 'secondary'}`, onClick: () => { c.favorite = !c.favorite; g.saveSoon(); this.rerender(); } }, c.favorite ? '❤️ Favourite' : '🤍 Favourite'),
          h('button', { class: 'btn small secondary', onClick: () => g.store(c.id) }, '📦 Store'),
          h('button', { class: 'btn small secondary', disabled: !!noSell, title: noSell ?? '', onClick: () => this.confirmSell(c) }, rich(here ? `🎩 Sell · {coin} ${price}` : `Sell · {coin} ${price}`))),
        noSell ? h('div', { class: 'muted' }, noSell) : null));
      b.append(h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('span', { class: 'k' }, `Traits (${c.quirks.length})`),
          ...c.quirks.map((q) => h('div', { class: 'quirk-line' }, h('b', null, `${QUIRKS[q].icon} ${QUIRKS[q].name}`), h('span', { class: 'muted' }, ` ${QUIRKS[q].blurb}`))),
          h('div', { class: 'btns', style: 'margin-top:8px' },
            h('button', { class: 'btn small secondary', onClick: () => (tools.traitDeleter ? this.chooseQuirkToDelete(c) : this.toolHint('traitDeleter')) }, `${TOOLS.traitDeleter.icon} Delete a trait (${tools.traitDeleter ?? 0})`),
            h('button', { class: 'btn small secondary', onClick: () => (tools.traitWiper ? this.confirmWipe(c) : this.toolHint('traitWiper')) }, `${TOOLS.traitWiper.icon} Wipe traits (${tools.traitWiper ?? 0})`))),
        h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Types'), this.traitChips(creatureTraits(c)), h('span', { class: 'muted' }, 'Creatures that share a type can breed.')),
        h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Size'), h('span', { class: 'v' }, `${sizeLabel(c.size)}${c.mutations.includes('giant') ? ' · Giant' : ''}`),
          grown < 1
            ? h('div', { class: 'col' }, h('div', { class: 'progress small' }, h('i', { style: `width:${Math.round(grown * 100)}%` })),
              h('span', { class: 'muted' }, `Growing up · ${fmtDuration((1 - grown) * c.growMs)} to go`))
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
        ...others.map((i) => h('button', { class: 'btn secondary', onClick: () => this.game.moveCreature(c.id, i) }, `${ISLANDS[i].icon} Move to ${ISLANDS[i].name}`)),
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
          h('button', { class: 'btn', onClick: () => { close(); this.shopTab = 'item'; this.showShop(); } }, 'Visit Mango\'s shop')));
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

  private confirmSell(c: Creature): void {
    const g = this.game;
    const here = collectorHere(g.state, g.now());
    const price = sellPrice(g.state, c, here);
    this.modal((m, close) => {
      m.append(h('h2', null, `Sell ${displayName(c)}?`),
        h('p', null, rich(`${here ? 'The Collector offers' : 'You\'ll get'} {coin} ${price}.`)),
        h('p', { class: 'muted' }, here ? 'He\'ll give it a lovely home in his travelling menagerie.' : 'Tip: the travelling Collector pays at least double.'),
        h('p', { class: 'muted' }, 'You can\'t undo this.'),
        h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Keep it'),
          h('button', { class: 'btn danger', onClick: () => { close(); g.sell(c.id); } }, 'Sell')));
    });
  }

  // ---- storage and the Collector

  /** Old name for the Storage tab of the Pets list. */
  showStorage(): void {
    this.showPets('storage');
  }

  /** Every creature you have: out on your worlds, or resting in storage. Sortable, with favourites. */
  showPets(tab?: 'wandering' | 'storage'): void {
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
    this.openSheet('Pets', 'Everyone you keep. Favourites (♥) can\'t be sold or released by mistake.', (b) => {
      const out = s.creatures.filter((c) => !c.stored);
      const stored = s.creatures.filter((c) => c.stored);
      const tabBtn = (id: typeof this.petsTab, label: string) =>
        h('button', { class: this.petsTab === id ? 'on' : '', onClick: () => { this.petsTab = id; this.rerender(); } }, label);
      const sort = SORTS.find((x) => x.id === this.petsSort) ?? SORTS[0];
      b.append(h('div', { class: 'tabs pets-tabs' },
        tabBtn('wandering', `Wandering (${out.length})`), tabBtn('storage', `Storage (${stored.length}/${s.storageSlots})`)),
        h('div', { class: 'sort-row' }, h('span', { class: 'muted' }, 'Favourites first, then'),
          h('button', { class: 'sort-btn', onClick: () => { this.petsSort = SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length].id; this.rerender(); } }, `Sort: ${sort.label} ▾`)));
      const heart = (c: Creature) => h('button', { class: `fav-btn ${c.favorite ? 'on' : ''}`, 'aria-label': c.favorite ? 'Unfavourite' : 'Favourite',
        onClick: (e: Event) => { e.stopPropagation(); c.favorite = !c.favorite; g.saveSoon(); this.rerender(); } }, c.favorite ? '♥' : '♡');
      const list = h('div', { class: 'list pets' });
      const favFirst = (a: Creature, b2: Creature) => Number(!!b2.favorite) - Number(!!a.favorite) || sort.cmp(a, b2);
      if (this.petsTab === 'wandering') {
        for (const c of out.sort(favFirst)) {
          const isl = ISLANDS[c.island];
          list.append(h('div', { class: 'item tappable', onClick: () => { this.closeSheet(false); this.focusCreature(c.id); } },
            this.portrait(c, 'swatch-img'),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, displayName(c)),
              h('div', { class: 'desc row', style: 'gap:6px;flex-wrap:wrap' }, rarityTag(species(c.species).rarity), h('span', { class: 'muted' }, `${isl.icon} ${isl.name}`)),
              h('div', { class: `progress tiny ${isHungry(c) ? 'hungry' : ''}` }, h('i', { style: `width:${Math.round(c.fullness * 100)}%` }))),
            heart(c),
            h('button', { class: 'btn small secondary', onClick: (e: Event) => { e.stopPropagation(); g.store(c.id, true); } }, 'Store')));
        }
      } else {
        if (!stored.length) b.append(h('p', { class: 'muted' }, 'Nobody is in storage. Store a creature to rest it here: no hunger, no growing, and it frees a spot on its world.'));
        for (const c of stored.sort(favFirst)) {
          list.append(h('div', { class: 'item' }, this.portrait(c, 'swatch-img'),
            h('div', { class: 'grow' }, h('div', { class: 'name' }, displayName(c)), h('div', { class: 'desc' }, rarityTag(species(c.species).rarity))),
            heart(c),
            h('button', { class: 'btn small', onClick: () => g.retrieve(c.id) }, `Bring to ${ISLANDS[g.world.current].icon}`)));
        }
      }
      b.append(list);
      if (this.petsTab === 'storage') {
        const price = nextSlotPrice(s);
        b.append(h('button', { class: 'btn wide', style: 'margin-top:10px', disabled: price === null || s.glimmer < price, onClick: () => g.buySlot() },
          price === null ? 'Storage is as big as it gets' : rich(`Add a storage slot · {coin} ${price}`)));
      }
    }, I.PAW);
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
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `${displayName(c)}${wanted ? ' ⭐' : ''}`), h('div', { class: 'desc' }, why ?? rarityTag(species(c.species).rarity))),
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
  showMakeSpace(island: IslandId, onDone: () => void, elsewhere?: (to: IslandId) => void): void {
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
      const list = h('div', { class: 'list make-space' });
      const storageFull = storedCount(s) >= s.storageSlots;
      for (const c of here) {
        list.append(h('div', { class: 'item' }, this.portrait(c, 'swatch-img'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `${c.favorite ? '♥ ' : ''}${displayName(c)}`), h('div', { class: 'desc' }, rarityTag(species(c.species).rarity))),
          h('button', { class: 'btn small', disabled: storageFull, onClick: () => { if (g.store(c.id, true)) { close(); onDone(); } } }, 'Store'),
          h('button', { class: 'btn small danger', disabled: !!c.favorite, onClick: () => { if (g.release(c.id)) { close(); onDone(); } } }, 'Release')));
      }
      m.append(list);
      if (storageFull) m.append(h('p', { class: 'muted' }, `Storage is full (${s.storageSlots} slots). You can add slots from the Storage list.`));
      m.append(h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Not now')));
    });
  }

  /** You dropped one creature on another: offer to breed them. Both parents stay. */
  confirmBreed(a: Creature, b: Creature): void {
    const s = this.game.state;
    const comp = compatibility(a, b);
    const free = Array.from({ length: s.nests }, (_, i) => i).filter((i) => !nestOccupant(s, i)).length;
    this.modal((m, close) => {
      m.append(
        h('h2', null, 'Breed these two?'),
        h('div', { class: 'slots', style: 'margin:10px 0' },
          h('div', { class: 'slot filled' }, this.portrait(a, ''), displayName(a)),
          h('span', { style: 'font-size:26px' }, '💞'),
          h('div', { class: 'slot filled' }, this.portrait(b, ''), displayName(b))),
        h('div', { class: `verdict ${comp.ok ? 'ok' : 'no'}` },
          comp.ok ? h('div', null, 'They feel kindred. They share ', this.traitChips(comp.shared, comp.shared)) : comp.reason ?? ''),
        h('p', { class: 'muted' }, comp.ok
          ? (free ? 'They will make an egg together and both stay with you. Who knows what hatches?' : 'Every nest is full. Hatch an egg first, or add a nest.')
          : 'Creatures must share at least one trait to make an egg.'),
        h('div', { class: 'btns' },
          h('button', { class: 'btn secondary', onClick: close }, comp.ok && free ? 'Not now' : 'OK'),
          comp.ok && free ? h('button', { class: 'btn', onClick: () => { close(); this.game.combine(a.id, b.id); } }, 'Breed!') : null),
      );
    });
  }

  /** How to get around a globe. Shown the first time, and from Settings. */
  showControls(): void {
    this.modal((m, close) => {
      const row = (svg: string, title: string, text: string) =>
        h('div', { class: 'ctl-row' }, h('span', { class: 'ctl-ico' }, I.icon(svg)), h('div', null, h('b', null, title), h('div', { class: 'muted' }, text)));
      m.append(h('h2', null, 'Getting around'),
        row(I.GESTURE_DRAG, 'Drag', 'Roll your island globe any way to look all around it.'),
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
      b.append(h('div', { class: 'tabs' }, tab('daily', '☀️ Daily'), tab('lasting', '🏆 Lasting')));
      const list = h('div', { class: 'list' });
      const reward = (r: { coins: number; shards: number; xp: number }) => rich(`{coin} ${r.coins}  ·  {gem} ${r.shards}  ·  ★ ${r.xp} XP`);
      if (this.questTab === 'daily') {
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

  /** Your level, how to earn XP, and every reward from 1 to 50. */
  showLevels(): void {
    const s = this.game.state;
    const lp = levelProgress(s.xp);
    let scrolled = false;
    this.openSheet(`Keeper level ${lp.level}`, lp.level >= MAX_LEVEL ? 'You reached the top. Legendary keeper!' : `${lp.into.toLocaleString()} / ${lp.need.toLocaleString()} XP to level ${lp.level + 1}`, (b) => {
      b.append(h('div', { class: 'progress', style: 'margin:4px 0 8px' }, h('i', { style: `width:${Math.round(lp.pct * 100)}%` })));
      b.append(h('p', { class: 'muted' }, 'Earn XP by hatching, breeding, setting lures, digging, discovering and finishing quests. Every level gives coins and Starshards, and every 5th level brings a creature you can only get here.'));
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
      m.append(h('div', { class: 'lv-burst' }, '★'), h('h2', null, `Level ${up.level}!`),
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

  // ---- Kindred Font

  showFont(): void {
    const s = this.game.state;
    this.ensureHome();
    this.game.world.focus(FONT, 15);
    if (s.tutorial === 3) this.game.setTutorial(3.5);
    this.openSheet('Kindred Font', 'Two creatures who share something can make an egg together.', (b) => {
      const [aId, bId] = this.fontPick;
      const a = s.creatures.find((c) => c.id === aId) ?? null;
      const bb = s.creatures.find((c) => c.id === bId) ?? null;
      const slot = (c: Creature | null, i: 0 | 1) => h('button', {
        class: `slot ${c ? 'filled' : ''}`,
        onClick: () => this.pickForFont(i),
      }, c ? this.portrait(c, '') : h('span', { class: 'plus' }, '＋'), c ? displayName(c) : 'Choose');
      b.append(h('div', { class: 'slots' }, slot(a, 0), h('span', { style: 'font-size:24px' }, '💞'), slot(bb, 1)));
      const free = Array.from({ length: s.nests }, (_, i) => i).filter((i) => !nestOccupant(s, i)).length;
      if (a && bb) {
        const comp = compatibility(a, bb);
        b.append(h('div', { class: `verdict ${comp.ok ? 'ok' : 'no'}` },
          comp.ok ? h('div', null, 'They feel kindred. They share ', this.traitChips(comp.shared, comp.shared)) : comp.reason ?? ''));
        const sky = activeEvent(s, this.game.now());
        if (comp.ok && sky) b.append(h('p', { class: 'muted' }, `The ${EVENTS[sky.kind].name.toLowerCase()} overhead makes the Font shimmer strangely...`));
        b.append(h('button', {
          class: 'btn wide', style: 'margin-top:12px', disabled: !comp.ok || free === 0,
          onClick: () => this.game.combine(a.id, bb.id),
        }, free === 0 ? 'Every nest is full' : 'Make an egg together'));
      } else {
        b.append(h('p', { class: 'muted' }, 'Pick two creatures. You won\'t know exactly what the egg holds until it hatches.'));
      }
      b.append(h('p', { class: 'muted' }, `Free nests: ${free} of ${s.nests}`));
    }, '⛲');
  }

  private pickForFont(i: 0 | 1): void {
    const s = this.game.state;
    const other = s.creatures.find((c) => c.id === this.fontPick[1 - i]) ?? null;
    this.openSheet('Choose a creature', other ? `Pairing with ${displayName(other)}` : 'Who will visit the Font?', (b) => {
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

  showNest(index: number): void {
    const s = this.game.state;
    const n = NESTS[index];
    this.ensureHome();
    this.game.world.focus(n, 12);
    if (index >= s.nests) {
      const price = A.nestPrice(s);
      this.openSheet('Empty pedestal', 'Room for another nest.', (b) => {
        b.append(h('p', null, 'A third and fourth nest let you keep more experiments warming at once. You already have the free nests every keeper gets.'));
        if (index !== s.nests) b.append(h('p', { class: 'muted' }, 'Build the nest before this one first.'));
        else if (price !== null) {
          b.append(h('button', { class: 'btn shard wide', disabled: s.shards < price, onClick: () => {
            const r = A.buyNest(s);
            if (!r.ok) return this.toast(r.error);
            this.game.audio.play('place');
            this.game.analytics.track('nest_bought', { nests: s.nests });
            this.toast('A new nest, warm and ready.');
            this.game.saveSoon();
            this.closeSheet();
          } }, rich(`Build nest · {gem} ${price}`)));
          if (s.shards < price) b.append(h('p', { class: 'muted' }, 'Starshards come from new discoveries and the occasional rare gift.'));
        }
      }, '🪺');
      return;
    }
    const egg = nestOccupant(s, index);
    if (!egg) {
      this.openSheet('Empty nest', 'Ready for an egg.', (b) => {
        b.append(h('p', null, 'Eggs made at the Kindred Font settle here to warm.'));
        b.append(h('button', { class: 'btn wide', onClick: () => this.showFont() }, '⛲ Go to the Kindred Font'));
      }, '🪺');
      return;
    }
    this.showEgg(egg);
  }

  showEgg(egg: Egg): void {
    const s = this.game.state;
    this.openSheet('A warm egg', egg.parentNames ? `From ${egg.parentNames[0]} & ${egg.parentNames[1]}` : egg.source === 'shop' ? 'A traveler\'s egg' : 'A mysterious egg', (b) => {
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
          if (!r.ok) return this.toast(r.error);
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
            if (!r.ok) return this.toast(r.error);
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
    }, '🥚');
  }

  showBasket(): void {
    this.ensureHome();
    const s = this.game.state;
    const waiting = s.eggs.filter((e) => e.nest === null);
    this.openSheet('Egg basket', `${waiting.length} of ${TUNING.basketSize} waiting`, (b) => {
      if (!waiting.length) b.append(h('p', { class: 'muted' }, 'Eggs from the traveling merchant wait here until a nest is free.'));
      for (const e of waiting) {
        b.append(h('div', { class: 'item' }, h('div', { class: 'swatch' }, '🥚'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, 'Waiting egg'), h('div', { class: 'desc' }, eggClues(e, !!s.journal.species[e.species])[0]))));
      }
    }, '🧺');
  }

  // ---- shop

  showShop(toShards = false): void {
    const s = this.game.state;
    this.seenShopRotation = s.shop.rotation;
    if (toShards) this.shopTab = 'shards';
    this.ensureHome();
    this.game.world.focus(SHOP_STALL, 15);
    this.openSheet("Mango's Shop", 'New wares arrive with every visit.', (b) => {
      const t = this.game.now();
      const line = MANGO_LINES[this.shopTab][s.shop.rotation % MANGO_LINES[this.shopTab].length];
      b.append(h('div', { class: 'shopkeeper' }, I.icon(I.MONKEY, 'icon mango'), h('div', { class: 'speech' }, line)));
      const tabs: [typeof this.shopTab, string, string][] = [
        ['egg', 'EGGS', I.CREATE], ['lure', 'LURES', I.LURE], ['food', 'FOOD', I.FOOD], ['item', 'ITEMS', I.POTION], ['decor', 'DECOR', I.DECOR], ['shards', 'BANK', I.GEM],
      ];
      b.append(h('div', { class: 'shop-tabs' }, ...tabs.map(([id, label, icon]) =>
        h('button', { class: `shop-tab ${this.shopTab === id ? 'on' : ''}`, 'aria-label': label, onClick: () => { this.game.audio.play('tap'); this.shopTab = id; this.rerender(); } },
          I.icon(icon), h('span', { class: 'lbl' }, label)))));

      if (this.shopTab === 'shards') {
        const iap = h('div', { class: 'list' });
        for (const cur of ['shards', 'coins'] as const) {
          iap.append(h('div', { class: 'section-title' }, cur === 'shards' ? 'Starshards' : 'Coins'));
          for (const p of this.game.purchases.products().filter((x) => x.currency === cur)) {
            iap.append(h('div', { class: 'item' }, h('div', { class: 'swatch' }, I.icon(cur === 'shards' ? I.GEM : I.COIN)),
              h('div', { class: 'grow' }, h('div', { class: 'name' }, `${p.amount.toLocaleString()} ${cur === 'shards' ? 'Starshards' : 'coins'}`), p.tag ? h('div', { class: 'desc' }, p.tag) : null),
              h('button', { class: `btn small ${cur === 'shards' ? 'shard' : ''}`, onClick: () => this.game.buyPack(p.id) }, p.price)));
          }
        }
        b.append(iap, h('p', { class: 'muted' }, 'Starshards buy nests, decorations and time — never creatures or discoveries.'));
        return;
      }

      b.append(h('div', { class: 'row muted' }, `New stock in ${fmtDuration(s.shop.nextRefreshAt - t)}`));
      b.append(h('div', { class: 'btns' },
        h('button', { class: 'btn shard small', disabled: s.shards < TUNING.shopRefreshShards, onClick: () => {
          const r = A.paidShopRefresh(s, t);
          if (!r.ok) return this.toast(r.error);
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
        const here = g.world.current;
        b.append(h('div', { class: 'pantry' },
          h('b', null, 'Your pantry: '), ...['fruit', 'snack', 'feast', 'feedbag'].map((f) => h('span', { class: 'quirk' }, `${FOODS[f].icon} ${s.food[f] ?? 0}`))));
        b.append(h('div', { class: 'btns' },
          h('button', { class: 'btn small', disabled: !(s.food.feast ?? 0), onClick: () => g.feast() }, `🧺 Feast for ${ISLANDS[here].name}`),
          h('button', { class: 'btn small secondary', disabled: !(s.food.feedbag ?? 0), onClick: () => g.hangBag() }, `🎒 Hang a feedbag here (${s.feedbags[here] ?? 0} left)`)));
        b.append(h('p', { class: 'muted' }, 'Feed a creature from its card. Berry Trees grow free berries: plant one from the list below.'));
      }
      const offers = s.shop.offers.filter((x) => x.kind === this.shopTab || (this.shopTab === 'item' && x.kind === 'tool')
        || (this.shopTab === 'food' && x.kind === 'decor' && x.ref === 'fruittree')).filter((x) => !(this.shopTab === 'decor' && x.ref === 'fruittree'));
      if (!offers.length) list.append(h('p', { class: 'muted' }, 'Nothing of this kind today. Check back when new stock arrives!'));
      for (const o of offers) {
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
          icon = '🥚';
          style = `background:linear-gradient(135deg, ${tier?.colors[0] ?? '#fff'}, ${tier?.colors[1] ?? '#fff'})`;
        }
        if (o.kind === 'decor') { const d = DECOR[o.ref]; name = d.name + (d.rotating ? ' ✦' : ''); desc = d.blurb + (d.rotating ? ' Only here for a short while.' : ''); icon = '🪴'; }
        const can = (o.currency === 'glimmer' ? s.glimmer : s.shards) >= o.price && o.stock > 0;
        list.append(h('div', { class: 'item' },
          h('div', { class: 'swatch', style }, icon),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, name), h('div', { class: 'desc' }, desc),
            o.stock < 10 ? h('div', { class: 'muted' }, o.stock > 0 ? `${o.stock} left` : 'Sold out') : null),
          h('button', { class: `btn small ${o.currency === 'shards' ? 'shard' : ''}`, disabled: !can, onClick: () => this.game.buy(o.id) },
            rich(`${o.currency === 'shards' ? '{gem}' : '{coin}'} ${o.price}`)),
        ));
      }
      b.append(list);
    }, I.SHOP);
  }

  // ---- journal

  showJournal(): void {
    this.seenNotes = this.game.state.journal.notes.length;
    const s = this.game.state;
    const found = Object.keys(s.journal.species).length;
    this.openSheet('Field Journal', `${found} of ${SPECIES.length} creatures discovered`, (b) => {
      const tab = (id: typeof this.journalTab, label: string) =>
        h('button', { class: this.journalTab === id ? 'on' : '', onClick: () => { this.journalTab = id; this.rerender(); } }, label);
      b.append(h('div', { class: 'tabs' }, tab('creatures', '🐾 Creatures'), tab('mutations', '✨ Mutations'), tab('notes', `📝 Notes (${s.journal.notes.length})`)));
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
      default: return 'Vanishingly rare. Nobody you know has seen one.';
    }
  }

  private showSpeciesEntry(id: string): void {
    const s = this.game.state;
    const sp = species(id);
    const entry = s.journal.species[id];
    this.modal((m, close) => {
      m.append(
        h('div', { class: 'row' }, img(this.game.world.portraits.get(id, [], !entry), 'portrait big'),
          h('div', { class: 'col' }, h('h2', null, entry ? sp.name : '???'), entry ? this.traitChips(sp.traits) : h('span', { class: 'muted' }, sp.origin === 'hybrid' ? 'Cannot be lured. Must be created.' : 'Not yet seen.'))),
        h('p', null, entry ? sp.blurb : `“${sp.hint}”`),
        entry ? h('p', { class: 'muted' }, `First seen ${this.when(entry.firstAt)}`) : '',
        h('button', { class: 'btn wide', onClick: close }, 'Close'),
      );
    });
  }

  // ---- decor

  showDecor(): void {
    const s = this.game.state;
    this.openSheet('Decorate', 'Make the sanctuary yours.', (b) => {
      const owned = Object.entries(s.decorOwned).filter(([, n]) => n > 0);
      if (!owned.length) b.append(h('p', { class: 'muted' }, 'You have no decorations to place. The merchant sells a few, and new ones rotate in.'));
      const list = h('div', { class: 'list' });
      for (const [id, n] of owned) {
        list.append(h('div', { class: 'item' }, h('div', { class: 'swatch' }, '🪴'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `${DECOR[id].name} ×${n}`), h('div', { class: 'desc' }, DECOR[id].blurb)),
          h('button', { class: 'btn small', onClick: () => this.beginPlacement(id) }, 'Place')));
      }
      b.append(list);
      if (s.placedDecor.length) b.append(h('p', { class: 'muted' }, 'Tap a placed decoration to put it back in your satchel.'));
      b.append(h('button', { class: 'btn secondary wide', style: 'margin-top:12px', onClick: () => this.showShop() }, 'Browse decorations'));
    }, I.DECOR);
  }

  beginPlacement(decorId: string): void {
    this.closeSheet();
    this.game.world.startPlacement(decorId);
    this.dock.classList.add('hidden');
    const label = h('div', { class: 'grow' }, `Tap the ground to position your ${DECOR[decorId].name}.`);
    const ok = h('button', { class: 'btn small', onClick: () => {
      const p = this.game.world.ghostPosition();
      if (!p || !this.game.world.validPlacement(p.x, p.z)) return this.toast('It won\'t fit there.');
      const r = A.placeDecor(this.game.state, decorId, p.x, p.z, Math.random() * Math.PI * 2);
      if (!r.ok) return this.toast(r.error);
      this.game.audio.play('place');
      this.game.analytics.track('decor_placed', { decor: decorId });
      this.endPlacement();
      this.game.saveSoon();
    } }, 'Place here');
    const cancel = h('button', { class: 'btn secondary small', onClick: () => this.endPlacement() }, 'Cancel');
    this.placeHost.replaceChildren(h('div', { class: 'place-bar' }, label, cancel, ok));
    this.game.placing = (x, z) => {
      const valid = this.game.world.moveGhost(x, z);
      label.textContent = valid ? 'Looks good here.' : 'It won\'t fit there. Try open ground.';
    };
  }

  private endPlacement(): void {
    this.game.world.cancelPlacement();
    this.placeHost.replaceChildren();
    this.dock.classList.remove('hidden');
    this.game.placing = null;
  }

  showPlacedDecor(id: string): void {
    const d = this.game.state.placedDecor.find((x) => x.id === id);
    if (!d) return;
    this.openSheet(DECOR[d.decor].name, DECOR[d.decor].blurb, (b) => {
      if (d.decor === 'fruittree') {
        const ripe = ripeFruit(d.harvestedAt, this.game.now());
        b.append(h('button', { class: 'btn wide', style: 'margin-bottom:8px', disabled: !ripe, onClick: () => this.game.harvest(id) }, ripe ? `🫐 Pick ${ripe} ${ripe === 1 ? 'berry' : 'berries'}` : 'No berries yet'));
      }
      b.append(h('button', { class: 'btn secondary wide', onClick: () => {
        A.storeDecor(this.game.state, id);
        this.game.saveSoon();
        this.closeSheet();
      } }, 'Put back in satchel'));
    }, '🪴');
  }

  // ---- settings / playtest tools

  showSettings(): void {
    const g = this.game;
    this.openSheet('Settings', 'Kindred Grove · prototype', (b) => {
      b.append(h('div', { class: 'item' }, h('div', { class: 'grow name' }, 'Sound'),
        h('button', { class: 'btn small secondary', onClick: () => { g.setSound(!g.audio.enabled); this.rerender(); } }, g.audio.enabled ? 'On' : 'Off')));
      b.append(h('div', { class: 'item' }, h('div', { class: 'grow name' }, 'Music'),
        h('button', { class: 'btn small secondary', onClick: () => { g.setMusic(!g.audio.musicEnabled); this.rerender(); } }, g.audio.musicEnabled ? 'On' : 'Off')));
      b.append(h('button', { class: 'btn secondary small', onClick: () => this.showControls() }, '👆 How to get around'));
      b.append(h('div', { class: 'section-title' }, 'Playtest tools'));
      b.append(h('p', { class: 'muted' }, 'These exist to test the prototype quickly and will not ship.'));
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
      b.append(h('div', { class: 'section-title' }, 'Save'));
      b.append(h('button', { class: 'btn danger', onClick: () => this.modal((m, close) => {
        m.append(h('h2', null, 'Start a new sanctuary?'), h('p', { class: 'muted' }, 'This erases your current save on this device.'),
          h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onClick: close }, 'Cancel'),
            h('button', { class: 'btn danger', onClick: () => g.reset() }, 'Erase & restart')));
      }) }, 'Start over'));
    }, '⚙️');
  }

  // ------------------------------------------------------------------ modal

  modal(build: (m: HTMLElement, close: () => void) => void): void {
    const m = h('div', { class: 'modal', role: 'dialog' });
    const wrap = h('div', { class: 'modal-wrap' }, m);
    const close = () => wrap.remove();
    const openedAt = performance.now();
    wrap.addEventListener('click', (e) => { if (e.target === wrap && performance.now() - openedAt > 350) close(); });
    build(m, close);
    this.modalHost.append(wrap);
  }

  /** "While you were away" — the answer to "what happened here?". */
  showAwayReport(events: GameEvent[], awayMs: number, finds: AwayFind[] = []): void {
    const s = this.game.state;
    const lines: HTMLElement[] = [];
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
      lines.push(h('div', { class: 'happen' }, this.portrait(a.creature, ''),
        h('span', null, `${a.discovered ? '🆕 ' : ''}A ${speciesTitle(a.creature)} came to the ${SPOTS[a.spot].name}${stayed ? '' : ', looked around, and left'}.`)));
    }
    for (const m of muts) lines.push(h('div', { class: 'happen' }, this.portrait(m.creature, ''),
      h('span', null, `${displayName(m.creature)} met the ${EVENTS[m.cause].touch.name} during a ${EVENTS[m.cause].name.toLowerCase()} and became ${MUTATIONS[m.mutation].name}!`)));
    if (touched.length) lines.push(h('div', { class: 'happen' }, h('span', { class: 'e' }, '🥚'), h('span', null, `${touched.length === 1 ? 'An egg' : `${touched.length} eggs`} glowed strangely during the storm.`)));
    if (ready.length) lines.push(h('div', { class: 'happen' }, h('span', { class: 'e' }, '🐣'), h('span', null, `${ready.length === 1 ? 'An egg is' : `${ready.length} eggs are`} ready to hatch!`)));
    if (gifts) lines.push(h('div', { class: 'happen' }, h('span', { class: 'e' }, I.icon(I.COIN)), h('span', null, `Your creatures dug up ${gifts} thing${gifts === 1 ? '' : 's'}. Go find them!`)));
    if (!lines.length) return;
    if (!arrivals.length && !Object.values(s.spots).some(Boolean)) {
      lines.push(h('div', { class: 'happen' }, h('span', { class: 'e' }, '🌿'), h('span', { class: 'muted' }, 'Tip: set out a lure before you leave. Visitors will be waiting when you return.')));
    }
    this.modal((m, close) => {
      m.append(h('h2', null, 'While you were away'), h('p', { class: 'muted' }, `${fmtDuration(awayMs)} passed in the sanctuary.`), ...lines,
        h('button', { class: 'btn wide', style: 'margin-top:14px', onClick: close }, 'Let\'s see'));
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
          h('button', { class: 'btn wide', style: 'margin-top:12px', onClick: () => {
            this.revealHost.replaceChildren();
            this.dock.classList.remove('hidden');
            onDone();
          } }, 'Welcome home'),
        ));
      },
    };
  }

  /** The EVENT tile: watch an ad to summon a random sky event. */
  showSummon(): void {
    const s = this.game.state;
    const t = this.game.now();
    const busy = activeEvent(s, t);
    const left = A.adsLeft(s, t);
    this.modal((m, close) => {
      m.append(
        h('h2', { class: 'outlined' }, 'Summon an event!'),
        h('p', null, 'Watch a short ad and the sky brings a random event. Maybe a storm or an eclipse… or something rare like a Starry Night, a Full Moon or a Blizzard.'),
        h('div', { class: 'row', style: 'justify-content:center;gap:14px;font-size:30px;margin:8px 0' },
          ...Object.values(EVENTS).map((e) => h('span', { title: e.name }, e.icon))),
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
      case 0: text = 'Welcome, keeper. This sanctuary is yours now. Tap the glowing ring in the Mossy Glade to set out a lure.'; break;
      case 1: text = 'Lures draw visitors. Watch for a while, or come back later. The sanctuary keeps living without you.'; break;
      case 2: text = 'Someone arrived at your lure! Tap the visitor with the ! to say hello, then Keep it or Send it on its way.'; break;
      case 3: text = 'Creatures who share a trait can make an egg together. Tap the stone Font, or the ⛲ Create button.'; break;
      case 3.5: text = 'Choose two creatures. Look for the 💚. Kindred creatures share at least one trait.'; break;
      case 4: {
        const ready = s.eggs.some((e) => e.progressMs >= e.incubationMs);
        text = ready ? 'Your egg is ready! Tap its nest to hatch it.' : 'Your egg is warming in a nest. Eggs hatch over time, and they feel the weather too.';
        break;
      }
      case 5:
        text = 'Wonderful. Try new lures, places and pairings. The sky has a mind of its own. What will you find next?';
        this.coachShownAt ||= performance.now();
        if (performance.now() - this.coachShownAt > 14_000) this.game.setTutorial(6);
        break;
      default: text = '';
    }
    // never talk over a pop-up (like the first-time controls card)
    if (!text || this.coachDismissed === step || this.sheetOpen && step !== 3.5 && step !== 4 || this.game.world.revealing || this.modalHost.childElementCount > 0) {
      this.coachEl.classList.add('hidden');
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
        h('button', { class: 'x', 'aria-label': 'Dismiss', onClick: () => { this.coachDismissed = step; if (step === 5) this.game.setTutorial(6); } }, I.icon(I.CLOSE)));
      this.coachEl.classList.remove('hidden');
    }
    if (this.sheetOpen && (step === 3.5 || step === 4)) this.coachEl.classList.add('hidden');
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
    if (here !== 'home' && s.eggs.some((e) => e.nest !== null && e.progressMs >= e.incubationMs)) out.set('home', 'An egg is ready to hatch!');
    return out;
  }

  private firstAlert(): IslandId | undefined {
    return this.worldAlerts().keys().next().value;
  }

  showIslands(highlight?: IslandId): void {
    const s = this.game.state;
    // centre the highlighted world once, not on every refresh (that fought your scrolling)
    let scrolled = false;
    this.openSheet('Islands', 'Tap an island to visit it. Roll each globe to explore it.', (b) => {
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
              alerts.has(id) ? h('div', { class: 'alert-line' }, h('b', null, '!'), alerts.get(id)!) : null,
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

  /** Small pinned panel: next egg timer and a favourite creature at a glance. */
  private updateWidget(): void {
    const s = this.game.state;
    const nestEggs = s.eggs.filter((e) => e.nest !== null).sort((a, b) => A.remainingMs(a) - A.remainingMs(b));
    const egg = nestEggs[0];
    const pinned = this.game.pinned ? s.creatures.find((c) => c.id === this.game.pinned) : undefined;
    const eggLine = egg ? (A.remainingMs(egg) <= 0 ? 'Ready to hatch!' : fmtClock(A.remainingMs(egg))) : '';
    const act = pinned ? this.game.world.creatureActivity(pinned.id) || `On ${ISLANDS[pinned.island].name}` : '';
    const key = `${egg?.id}|${eggLine}|${pinned?.id}|${pinned ? displayName(pinned) : ''}|${act}|${pinned?.mutations.join()}`;
    if (key === this.widgetKey) return;
    this.widgetKey = key;
    this.widget.classList.toggle('hidden', !egg && !pinned);
    this.widget.replaceChildren(
      egg ? h('button', { class: `w-row ${A.remainingMs(egg) <= 0 ? 'ready' : ''}`, onClick: () => this.showNest(egg.nest!) },
        h('span', { class: 'w-ico' }, '🥚'), h('span', { class: 'col' }, h('b', null, eggLine), h('small', null, nestEggs.length > 1 ? `+${nestEggs.length - 1} more` : 'Next egg'))) : '',
      pinned ? h('button', { class: 'w-row', onClick: () => this.focusCreature(pinned.id) },
        img(this.game.world.portraits.get(pinned.species, pinned.mutations), 'w-pic'),
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
