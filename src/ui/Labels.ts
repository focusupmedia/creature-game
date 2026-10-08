import { BASKET, FONT, SHOP_STALL } from '../content/layout';
import { ISLANDS, ISLAND_ORDER } from '../content/islands';
import type { IslandId } from '../core/types';
import { LURES, SPOTS, spotOpen } from '../content/world';
import { remainingMs } from '../core/actions';
import { displayName, fmtWeight, isOutlier, sizeLabel, weightKg } from '../core/creatures';
import { arrivalWeights } from '../core/lures';
import { nestOccupant, placedNests } from '../core/state';
import { activeEvent, isDark } from '../core/world';
import type { Game } from '../game/Game';
import { hearts } from '../core/friendship';
import { h, setText } from './dom';
import { rarityTag } from './rarity';
import { QUIRKS } from '../content/quirks';
import { species } from '../content/species';
import { GEAR, icon, HAND_OPEN, HEART } from './icons';

// Labels that float over the 3D world and always face the player.
// - Signs (Shop, Kindred Fountain, nests) fade in when zoomed in.
// - Lure-spot pins and "egg ready" pins are always visible: they are calls to action.
// - The selected creature gets a name bubble with what it's doing and a ⚙️ menu.

interface Pin {
  el: HTMLElement;
  text: HTMLElement;
  pos: [number, number, number];
  /** 'always' ignores zoom; 'zoomed' fades in when the camera is close. */
  mode: () => 'always' | 'zoomed' | 'sign' | 'hidden';
  render: () => string;
  last: string;
  /** Only shown while this returns true (e.g. on the current island). */
  when: () => boolean;
  /** Zoomed-out variant: a compact marker, or null to hide. */
  far?: () => string | null;
}

const SIGN_NEAR = 19;
const SIGN_FAR = 24;

export interface LabelActions {
  openSpot(id: string): void;
  openNest(id: string): void;
  openFont(): void;
  openShop(): void;
  openBooth(): void;
  openBasket(): void;
  openCreatureMenu(id: string): void;
  pet(id: string): void;
  openIsland(id: IslandId): void;
}

export class WorldLabels {
  private host = h('div', { class: 'wl-layer' });
  private pins: Pin[] = [];
  private bubble: HTMLElement;
  private bubbleName = h('div', { class: 'wl-bubble-name' });
  private bubbleLine = h('div', { class: 'wl-bubble-line' });
  private bubbleHearts = h('div', { class: 'wl-bubble-hearts' });
  private lastHearts = -1;
  private bubbleFor: string | null = null;
  private lastName = '';
  private lastLine = '';

  constructor(private game: Game, mount: HTMLElement, private act: LabelActions) {
    mount.prepend(this.host);
    this.bubble = h('div', { class: 'wl wl-bubble hidden' },
      h('div', { class: 'wl-bubble-text' }, this.bubbleName, this.bubbleHearts, this.bubbleLine),
      h('button', {
        class: 'wl-cog wl-pet', 'aria-label': 'Pet it',
        onClick: (e: MouseEvent) => { e.stopPropagation(); if (this.bubbleFor) this.act.pet(this.bubbleFor); },
      }, icon(HAND_OPEN)),
      h('button', {
        class: 'wl-cog', 'aria-label': 'Creature options',
        onClick: (e: MouseEvent) => { e.stopPropagation(); if (this.bubbleFor) this.act.openCreatureMenu(this.bubbleFor); },
      }, icon(GEAR)),
    );
    this.host.append(this.bubble);
    this.buildPins();
  }

  private pin(
    cls: string, pos: [number, number, number], mode: Pin['mode'], render: Pin['render'], onTap: () => void,
    when: () => boolean, far?: Pin['far'],
  ): void {
    const text = h('span');
    const el = h('button', { class: `wl ${cls}`, onClick: (e: MouseEvent) => { e.stopPropagation(); this.game.audio.play('tap'); onTap(); } }, text);
    this.host.append(el);
    this.pins.push({ el, text, pos, mode, render, last: '', when, far });
  }

  private buildPins(): void {
    const s = () => this.game.state;
    const now = () => this.game.now();

    const on = (id: IslandId) => () => this.game.world.current === id;
    const home = on('home');

    // Lure spots: a full label up close; from afar just a small "!" when the spot is empty.
    for (const spot of Object.values(SPOTS)) {
      this.pin('wl-spot', [spot.x, spot.water ? 1.1 : 0.9, spot.z], () => 'zoomed', () => {
        const active = s().spots[spot.id];
        if (!active) return '＋ Lure';
        const dormant = arrivalWeights(active.lure, spot.id, isDark(s(), now()), activeEvent(s(), now())?.kind ?? null).length === 0;
        if (dormant) return '💤 Waiting';
        const ms = Math.max(0, active.expiresAt - now());
        return `${LURES[active.lure].name.split(' ')[0]} · ${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
      }, () => this.act.openSpot(spot.id), () => on(spot.island)() && spotOpen(s().islands, spot.id), () => (s().spots[spot.id] ? null : '!'));
    }

    // Shop and Sell signs show from further away (Settings → Sign distance); afar they shrink to an icon
    const signFar = (icon: string) => () => icon;
    this.pin('wl-sign shop', [SHOP_STALL.x, 2.9, SHOP_STALL.z], () => 'sign', () => '🛍️ Shop', () => this.act.openShop(), home, signFar('🛍️'));
    for (const id of ISLAND_ORDER) {
      const def = ISLANDS[id];
      this.pin('wl-sign sell', [def.ox + def.booth.x, 3.5, def.oz + def.booth.z], () => 'sign', () => '💰 Sell', () => this.act.openBooth(), () => on(id)() && !!s().islands[id]?.owned, signFar('💰'));
    }
    this.pin('wl-sign', [FONT.x, 2.4, FONT.z], () => 'zoomed', () => '⛲ Kindred Fountain', () => this.act.openFont(), home);

    // Other islands on the horizon: name pins you can tap to visit (or unlock).
    for (const id of ISLAND_ORDER) {
      const def = ISLANDS[id];
      this.pin('wl-island', [def.ox, 2.5, def.oz], () => 'always', () => {
        const isl = s().islands[id];
        if (isl?.owned) return `${def.icon} ${def.name}`;
        return def.status === 'soon' ? `${def.icon} Coming soon` : `🔒 ${def.icon} ${def.name}`;
      }, () => this.act.openIsland(id), () => this.game.world.current !== id);
    }

    this.pin('wl-nest', [BASKET.x, 0.9, BASKET.z], () => (s().eggs.some((e) => e.nest === null && !e.nurseryId) ? 'zoomed' : 'hidden'),
      () => `🧺 ${s().eggs.filter((e) => e.nest === null && !e.nurseryId).length} waiting`, () => this.act.openBasket(), home);
  }

  /** Show the name bubble for a creature (null hides it). */
  select(id: string | null): void {
    this.bubbleFor = id;
    this.lastName = '';
    this.lastLine = '';
    this.lastHearts = -1;
    this.bubble.classList.toggle('hidden', !id);
  }

  get selected(): string | null {
    return this.bubbleFor;
  }

  /** Nests can be placed, moved and put away on any world, so their pins come and go. */
  private nestPins = new Map<string, Pin>();

  private syncNestPins(): void {
    const st = this.game.state;
    const alive = new Set<string>();
    for (const n of placedNests(st)) {
      alive.add(n.id);
      let pin = this.nestPins.get(n.id);
      if (!pin) {
        const id = n.id;
        this.pin('wl-nest', [n.x, 1.35, n.z], () => {
          const egg = nestOccupant(this.game.state, id);
          return egg && egg.progressMs >= egg.incubationMs ? 'always' : 'zoomed';
        }, () => {
          const egg = nestOccupant(this.game.state, id);
          if (!egg) return 'Empty nest';
          if (egg.progressMs >= egg.incubationMs) return '🐣 Ready!';
          const ms = remainingMs(egg);
          return `🥚 ${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
        }, () => this.act.openNest(id), () => {
          const d = this.game.state.placedDecor.find((x) => x.id === id);
          return !!d && (d.island ?? 'home') === this.game.world.current;
        });
        pin = this.pins[this.pins.length - 1];
        this.nestPins.set(id, pin);
      }
      // follow the nest when it's moved
      pin.pos[0] = n.x;
      pin.pos[2] = n.z;
    }
    for (const [id, pin] of this.nestPins) {
      if (alive.has(id)) continue;
      pin.el.remove();
      this.pins = this.pins.filter((p) => p !== pin);
      this.nestPins.delete(id);
    }
  }

  /** A big bouncing ! over every lure visitor waiting to meet you, easy to spot on a busy island. */
  private visitorPins = new Map<string, Pin>();

  private syncVisitorPins(): void {
    const st = this.game.state;
    const alive = new Set<string>();
    for (const v of st.visitors) {
      const id = v.creature.id;
      alive.add(id);
      if (this.visitorPins.has(id)) continue;
      const spot = SPOTS[v.spot];
      // a small "!" over each new visitor (drawn on top of everything, clouds too) until it's first tapped
      this.pin('wl-visitor', [spot.x, 2.3, spot.z], () => 'always', () => '!', () => this.game.world.onTap({ kind: 'creature', id }),
        () => this.game.world.current === v.island && !this.game.seenVisitors.has(id) && !!this.game.world.creaturePosition(id)
          && this.game.state.visitors.some((x) => x.creature.id === id));
      this.visitorPins.set(id, this.pins[this.pins.length - 1]);
    }
    // follow the visitor as it moves about
    for (const [id, pin] of this.visitorPins) {
      const at = this.game.world.creaturePosition(id);
      if (at) { pin.pos[0] = at.x; pin.pos[1] = 1.9; pin.pos[2] = at.z; }
    }
    for (const [id, pin] of this.visitorPins) {
      if (alive.has(id)) continue;
      pin.el.remove();
      this.pins = this.pins.filter((p) => p !== pin);
      this.visitorPins.delete(id);
    }
  }

  update(hidden: boolean): void {
    this.syncNestPins();
    this.syncVisitorPins();
    this.host.classList.toggle('hidden', hidden);
    if (hidden) return;
    const w = this.game.world;
    const zoom = w.zoom;
    const near = Math.max(0, Math.min(1, (SIGN_FAR - zoom) / (SIGN_FAR - SIGN_NEAR)));
    // how far the Shop and Sell signs reach: 0 = like other signs, 1 = always
    const range = this.game.signRange;
    const signNear = range >= 0.99 ? 1 : Math.max(0, Math.min(1, (SIGN_FAR + range * 50 - zoom) / (SIGN_FAR - SIGN_NEAR)));

    for (const p of this.pins) {
      const mode = p.when() ? p.mode() : 'hidden';
      const sp = w.pinScreen(p.pos[0], p.pos[2], p.pos[1]);
      const farText = p.far && near < 0.5 && mode !== 'hidden' ? p.far() : undefined;
      let opacity = mode === 'hidden' || !sp.visible ? 0 : mode === 'always' ? 1 : near;
      if (p.far && near < 0.5) opacity = farText && sp.visible ? (mode === 'sign' ? signNear : 1) : 0;
      p.el.style.opacity = String(opacity);
      p.el.style.pointerEvents = opacity > 0.4 ? 'auto' : 'none';
      if (opacity === 0) continue;
      p.el.style.transform = `translate(-50%, -100%) translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px)`;
      p.el.classList.toggle('mini', !!farText);
      const txt = farText ?? p.render();
      if (txt !== p.last) {
        p.last = txt;
        setText(p.text, txt);
        p.el.classList.toggle('ready', txt.startsWith('🐣'));
        p.el.classList.toggle('empty', txt.startsWith('＋'));
      }
    }

    if (this.bubbleFor) {
      const c = this.game.state.creatures.find((x) => x.id === this.bubbleFor);
      const head = c ? w.creatureHead(c.id) : null;
      if (!c || !head) {
        this.select(null);
        return;
      }
      const sp = w.toScreen(head.x, head.y, head.z);
      this.bubble.style.opacity = sp.visible && w.facesCamera(head, c.island) ? '1' : '0';
      // keep the whole bubble on screen, even for a creature near the edge
      const half = this.bubble.offsetWidth / 2;
      const bx = Math.min(Math.max(sp.x, half + 8), window.innerWidth - half - 8);
      this.bubble.style.transform = `translate(-50%, -100%) translate(${bx.toFixed(1)}px, ${sp.y.toFixed(1)}px)`;
      const name = displayName(c);
      const line = [w.creatureActivity(c.id), fmtWeight(weightKg(c, this.game.now()))].filter(Boolean).join(' · ');
      const r = species(c.species).rarity;
      const odd = isOutlier(c.size) ? sizeLabel(c.size) : '';
      const icons = c.quirks.map((q) => QUIRKS[q].icon).join('');
      const key = `${name}|${r}|${odd}|${icons}|${hearts(c) >= 5}`;
      if (key !== this.lastName) {
        this.lastName = key;
        this.bubbleName.replaceChildren(document.createTextNode(`${hearts(c) >= 5 ? '👑 ' : ''}${name} `), rarityTag(r), odd ? h('span', { class: 'rarity r-outlier' }, odd) : '', h('span', { class: 'quirk-icons' }, icons));
      }
      if (line !== this.lastLine) setText(this.bubbleLine, (this.lastLine = line));
      const n = hearts(c);
      if (n !== this.lastHearts) {
        this.lastHearts = n;
        this.bubbleHearts.replaceChildren(...[0, 1, 2, 3, 4].map((i) => h('span', { class: `hr ${i < n ? 'on' : ''}` }, icon(HEART))));
      }
    }
  }
}
