import { SPECIES, species } from '../content/species';
import { DECOR, EGG_TIERS, EVENTS, ITEMS, LURES, MUTATIONS, SPOTS } from '../content/world';
import { ISLANDS, ISLAND_ORDER, SIZE_CAPACITY, SIZE_NAMES, SIZE_PRICE } from '../content/islands';
import { TUNING } from '../content/tuning';
import { NESTS, FONT, SHOP_STALL } from '../content/layout';
import * as A from '../core/actions';
import { PERSONALITIES, creatureTraits, displayName, growth, sizeLabel, speciesTitle } from '../core/creatures';
import { compatibility, eggClues } from '../core/genetics';
import { arrivalWeights } from '../core/lures';
import { nestOccupant } from '../core/state';
import type { Creature, Egg, GameEvent, IslandId, MutationId, SpotId, Trait } from '../core/types';
import { activeEvent, dayPhase, daylight, isDark, nextEvent } from '../core/world';
import type { Game } from '../game/Game';
import { fmtDuration, h, img, rich } from './dom';
import * as I from './icons';
import { WorldLabels } from './Labels';

const fmtClock = (ms: number) => `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, '0')}`;

const MUT_ICON: Record<MutationId, string> = { lunar: '🌙', storm: '⚡', giant: '⛰️', prismatic: '🌈', starlit: '🌟', frost: '❄️' };
const HABITAT_ICON: Partial<Record<Trait, string>> = { Grove: '🌳', Tide: '💧', Bloom: '🌸', Mystic: '🔮' };
const MUTATION_TRAITS: Trait[] = ['Lunar', 'Storm', 'Giant', 'Prismatic', 'Starlit', 'Frost'];

export class UI {
  readonly root: HTMLElement;
  private glimmerVal = h('span', { class: 'val' });
  private shardsVal = h('span', { class: 'val' });
  private skyChip = h('span');
  private adsBadge = h('span', { class: 'count' });
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
          h('div', { class: 'bar', title: 'Coins' }, I.icon(I.COIN), this.glimmerVal),
          h('div', { class: 'bar', title: 'Starshards', style: 'margin-left:10px' }, I.icon(I.GEM), this.shardsVal,
            h('button', { class: 'bar-plus', 'aria-label': 'Get Starshards', onClick: () => this.showShop(true) }, I.icon(I.PLUS))),
        ),
        h('div', { class: 'hud-row', style: 'width:100%;align-items:flex-start' },
          h('div', { class: 'hud-col' }, h('div', { class: 'sky-chip' }, this.skyChip), this.widget),
          h('div', { class: 'spacer' }),
          h('div', { class: 'hud-col right' },
            h('button', { class: 'hud-tile', 'aria-label': 'Watch an ad to summon a sky event', onClick: () => this.showSummon() },
              I.icon(I.SUMMON), h('span', { class: 'lbl' }, 'EVENT'), this.adsBadge),
            h('button', { class: 'hud-tile islands', 'aria-label': 'Islands', onClick: () => { this.game.audio.play('tap'); this.showIslands(); } },
              I.icon(I.ISLANDS), h('span', { class: 'lbl' }, 'ISLANDS')),
          ),
        ),
      ),
    );
    const dockBtn = (svg: string, label: string, fn: () => void, dot?: HTMLElement) =>
      h('button', { onClick: () => { this.game.audio.play('tap'); fn(); } }, I.icon(svg), h('span', { class: 'lbl' }, label), dot ?? null);
    this.dock = h('nav', { class: 'dock' },
      dockBtn(I.LURE, 'LURES', () => this.showLures()),
      dockBtn(I.CREATE, 'CREATE', () => this.showFont()),
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
    const phase = dayPhase(s, t);
    const ev = activeEvent(s, t);
    const light = daylight(phase);
    const icon = ev ? EVENTS[ev.kind].icon : light > 0.6 ? '☀️' : light > 0.1 ? (phase < 0.5 ? '🌅' : '🌇') : '🌙';
    const label = ev ? `${EVENTS[ev.kind].name} · ${fmtClock(ev.end - t)}` : light > 0.6 ? (phase < 0.5 ? 'Morning' : 'Afternoon') : light > 0.1 ? (phase < 0.5 ? 'Dawn' : 'Dusk') : 'Night';
    this.skyChip.textContent = `${icon} ${label}`;

    // event banner / forecast teaser
    const next = nextEvent(s, t);
    let text = '';
    let cls = '';
    // The sky chip shows an active event; the banner is only for forecast teasers.
    if (!ev && next && next.start - t < TUNING.forecastLeadMin * 60_000) {
      text = EVENTS[next.kind].teaser;
    }
    this.banner.textContent = text;
    this.banner.className = `banner ${cls} ${text ? '' : 'hidden'}`;

    this.shopDot.classList.toggle('hidden', s.shop.rotation === this.seenShopRotation);
    const ads = A.adsLeft(s, t);
    if (this.adsBadge.textContent !== String(ads)) this.adsBadge.textContent = String(ads);
    this.journalDot.classList.toggle('hidden', s.journal.notes.length === this.seenNotes);

    this.refreshTimer -= dt;
    if (this.refreshTimer <= 0 && this.sheetRender) {
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
        for (const spot of spots) b.append(this.spotBlock(spot.id));
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
          h('div', { class: 'desc muted' }, sp.blurb),
          this.traitChips(creatureTraits(c)),
        ));
      b.append(head);
      const t = this.game.now();
      const grown = growth(c, t);
      const P = PERSONALITIES[c.personality];
      b.append(h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Personality'), h('span', { class: 'v' }, `${P.emoji} ${P.name}`), h('span', { class: 'muted' }, P.blurb)),
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

  private confirmRelease(c: Creature): void {
    this.modal((m, close) => {
      m.append(h('h2', null, `Say goodbye to ${displayName(c)}?`),
        h('p', { class: 'muted' }, 'It will wander off into the wild. Your journal will remember it.'),
        h('div', { class: 'btns' },
          h('button', { class: 'btn secondary', onClick: close }, 'Keep'),
          h('button', { class: 'btn danger', onClick: () => {
            close();
            const r = A.release(this.game.state, c.id);
            if (!r.ok) this.toast(r.error);
            else { this.closeSheet(); this.toast(`${displayName(c)} wandered off into the wild.`); this.game.saveSoon(); }
          } }, 'Goodbye')));
    });
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
      for (const c of s.creatures) {
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
          const used = (item.effect === 'giantChance' && live.tonic) || (item.effect === 'warmth' && live.warmed);
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

  showShop(scrollToShards = false): void {
    const s = this.game.state;
    this.seenShopRotation = s.shop.rotation;
    this.ensureHome();
    this.game.world.focus(SHOP_STALL, 15);
    this.openSheet('Traveling Merchant', 'New wares arrive with every visit.', (b) => {
      const t = this.game.now();
      b.append(h('div', { class: 'row muted' }, `New stock in ${fmtDuration(s.shop.nextRefreshAt - t)}`));
      const refresh = h('div', { class: 'btns' },
        h('button', { class: 'btn shard small', disabled: s.shards < TUNING.shopRefreshShards, onClick: () => {
          const r = A.paidShopRefresh(s, t);
          if (!r.ok) return this.toast(r.error);
          this.seenShopRotation = s.shop.rotation;
          this.game.analytics.track('shop_refresh', { via: 'shards' });
          this.game.saveSoon();
          this.rerender();
        } }, rich(`Refresh · {gem} ${TUNING.shopRefreshShards}`)),
        A.adsLeft(s, t) > 0 ? h('button', { class: 'btn ad small', onClick: () => this.game.adRefreshShop() }, '▶ Watch ad · refresh') : null,
      );
      b.append(refresh);
      const groups: [string, string[]][] = [['Eggs', ['egg']], ['Lures', ['lure']], ['Curiosities', ['item']], ['Decorations', ['decor']]];
      for (const [title, kinds] of groups) {
        b.append(h('div', { class: 'section-title' }, title));
        const list = h('div', { class: 'list' });
        for (const o of s.shop.offers.filter((x) => kinds.includes(x.kind))) {
          let name = '';
          let desc = '';
          let icon = '🫙';
          let style = '';
          if (o.kind === 'lure') { const l = LURES[o.ref]; name = l.name; desc = l.scent; icon = HABITAT_ICON[l.attracts] ?? '🫙'; style = `background:${l.color}33`; }
          if (o.kind === 'item') { const it = ITEMS[o.ref]; name = it.name; desc = it.blurb; icon = it.effect === 'warmth' ? '🔥' : '🧪'; }
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
      }
      const shardsTitle = h('div', { class: 'section-title' }, 'Starshards');
      b.append(shardsTitle);
      const iap = h('div', { class: 'list' });
      for (const p of this.game.purchases.products()) {
        iap.append(h('div', { class: 'item' }, h('div', { class: 'swatch' }, I.icon(I.GEM)),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, `${p.shards} Starshards`), p.tag ? h('div', { class: 'desc' }, p.tag) : null),
          h('button', { class: 'btn shard small', onClick: () => this.game.buyShards(p.id) }, p.price)));
      }
      b.append(iap, h('p', { class: 'muted' }, 'Starshards buy nests, decorations and time — never creatures or discoveries.'));
      if (scrollToShards) setTimeout(() => shardsTitle.scrollIntoView({ behavior: 'smooth' }), 50);
      scrollToShards = false;
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
        for (const [title, origin] of [['Wild', 'wild'], ['Created', 'hybrid']] as const) {
          b.append(h('div', { class: 'section-title' }, title));
          const grid = h('div', { class: 'grid' });
          for (const sp of SPECIES.filter((x) => x.origin === origin)) {
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
      b.append(h('div', { class: 'section-title' }, 'Playtest tools'));
      b.append(h('p', { class: 'muted' }, 'These exist to test the prototype quickly and will not ship.'));
      const speed = h('div', { class: 'btns' }, ...[1, 10, 60].map((x) =>
        h('button', { class: `btn small ${g.timeScale === x ? '' : 'secondary'}`, onClick: () => { g.timeScale = x; this.rerender(); } }, `${x}× time`)));
      b.append(speed);
      b.append(h('div', { class: 'btns' },
        h('button', { class: 'btn small secondary', onClick: () => g.skip(5 * 60_000) }, '⏩ Skip 5 min'),
        h('button', { class: 'btn small secondary', onClick: () => g.skip(60 * 60_000) }, '⏩ Skip 1 hour (away)'),
        h('button', { class: 'btn small secondary', onClick: () => g.skipToNextEvent() }, '🌦️ Next sky event'),
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
  showAwayReport(events: GameEvent[], awayMs: number): void {
    const s = this.game.state;
    const lines: HTMLElement[] = [];
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
        top.replaceChildren(h('div', { class: `title ${isNew ? 'new' : ''}` }, isNew ? (sp.origin === 'hybrid' ? 'New creation!' : 'New discovery!') : 'It hatched!'));
        const muts = creature.mutations.filter((m) => !sp.traits.includes(MUTATIONS[m].trait));
        bottom.replaceChildren(h('div', { class: 'card' },
          h('h3', null, speciesTitle(creature)),
          h('div', { class: 'chips', style: 'margin-top:6px' }, ...creatureTraits(creature).map((t) =>
            h('span', { class: `chip ${MUTATION_TRAITS.includes(t) ? 'mut' : ''}` }, t))),
          h('p', null, sp.blurb),
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
      case 2: text = 'Someone new arrived! Tap a creature to see what it\'s up to. Tap ⚙️ for more.'; break;
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
    if (!text || this.coachDismissed === step || this.sheetOpen && step !== 3.5 && step !== 4 || this.game.world.revealing) {
      this.coachEl.classList.add('hidden');
      return;
    }
    if (this.coachEl.dataset.step !== String(step) || this.coachEl.classList.contains('hidden')) {
      this.coachEl.dataset.step = String(step);
      this.coachEl.replaceChildren(I.icon(I.AXOLOTL, 'icon who'), h('span', null, text),
        h('button', { class: 'x', 'aria-label': 'Dismiss', onClick: () => { this.coachDismissed = step; if (step === 5) this.game.setTutorial(6); } }, I.icon(I.CLOSE)));
      this.coachEl.classList.remove('hidden');
    }
    if (this.sheetOpen && (step === 3.5 || step === 4)) this.coachEl.classList.add('hidden');
  }

  // ------------------------------------------------------------------ islands

  showIslands(highlight?: IslandId): void {
    const s = this.game.state;
    this.openSheet('Islands', 'Swipe past the edge, or tap an island on the horizon, to hop between them.', (b) => {
      for (const id of ISLAND_ORDER) {
        const def = ISLANDS[id];
        const isl = s.islands[id] ?? { owned: false, size: 0 };
        const here = this.game.world.current === id;
        const pop = s.creatures.filter((c) => c.island === id).length;
        const card = h('div', { class: `island-card ${highlight === id ? 'hl' : ''} ${def.status === 'soon' ? 'soon' : ''}` },
          h('div', { class: 'row' },
            h('div', { class: 'swatch big', style: `background:linear-gradient(160deg, ${def.palette.top}, ${def.palette.lip})` }, def.icon),
            h('div', { class: 'grow col' },
              h('div', { class: 'name' }, def.name, here ? h('span', { class: 'chip', style: 'margin-left:6px' }, 'You are here') : null),
              h('div', { class: 'desc' }, def.blurb),
              isl.owned ? h('div', { class: 'muted' }, `${SIZE_NAMES[isl.size]} · ${pop}/${SIZE_CAPACITY[isl.size]} creatures`) : null,
            )),
        );
        const btns = h('div', { class: 'btns' });
        if (isl.owned) {
          if (!here) btns.append(h('button', { class: 'btn secondary small', onClick: () => this.game.travel(id) }, 'Visit'));
          const next = SIZE_PRICE[isl.size + 1];
          if (next) {
            btns.append(
              h('button', { class: 'btn small', disabled: s.glimmer < next.coins, onClick: () => this.game.upgradeIsland(id, 'glimmer') },
                rich(`Grow to ${SIZE_NAMES[isl.size + 1]} · {coin} ${next.coins}`)),
              h('button', { class: 'btn shard small', disabled: s.shards < next.gems, onClick: () => this.game.upgradeIsland(id, 'shards') },
                rich(`{gem} ${next.gems}`)),
            );
          } else btns.append(h('span', { class: 'muted' }, 'Fully grown island.'));
        } else if (def.status === 'buyable') {
          btns.append(
            h('button', { class: 'btn small', disabled: s.glimmer < def.price.coins, onClick: () => this.game.buyIsland(id, 'glimmer') },
              rich(`Unlock · {coin} ${def.price.coins}`)),
            h('button', { class: 'btn shard small', disabled: s.shards < def.price.gems, onClick: () => this.game.buyIsland(id, 'shards') },
              rich(`Skip ahead · {gem} ${def.price.gems}`)),
          );
          const natives = SPECIES.filter((sp) => sp.traits.includes(def.habitat)).length;
          btns.append(h('div', { class: 'muted', style: 'width:100%' }, `${natives} kinds of creature call this habitat home. Comes with its own lure spots.`));
        } else {
          btns.append(h('span', { class: 'chip' }, 'Coming soon'));
        }
        card.append(btns);
        b.append(card);
        if (highlight === id) setTimeout(() => card.scrollIntoView({ block: 'center' }), 60);
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
