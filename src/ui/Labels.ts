import { BASKET, FONT, NESTS, SHOP_STALL } from '../content/layout';
import { ISLANDS, ISLAND_ORDER } from '../content/islands';
import type { IslandId } from '../core/types';
import { LURES, SPOTS } from '../content/world';
import { remainingMs, nestPrice } from '../core/actions';
import { displayName } from '../core/creatures';
import { arrivalWeights } from '../core/lures';
import { nestOccupant } from '../core/state';
import { activeEvent, isDark } from '../core/world';
import type { Game } from '../game/Game';
import { h } from './dom';
import { GEAR, icon } from './icons';

// Labels that float over the 3D world and always face the player.
// - Signs (Shop, Kindred Font, nests) fade in when zoomed in.
// - Lure-spot pins and "egg ready" pins are always visible: they are calls to action.
// - The selected creature gets a name bubble with what it's doing and a ⚙️ menu.

interface Pin {
  el: HTMLElement;
  text: HTMLElement;
  pos: [number, number, number];
  /** 'always' ignores zoom; 'zoomed' fades in when the camera is close. */
  mode: () => 'always' | 'zoomed' | 'hidden';
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
  openNest(i: number): void;
  openFont(): void;
  openShop(): void;
  openBasket(): void;
  openCreatureMenu(id: string): void;
  openIsland(id: IslandId): void;
}

export class WorldLabels {
  private host = h('div', { class: 'wl-layer' });
  private pins: Pin[] = [];
  private bubble: HTMLElement;
  private bubbleName = h('div', { class: 'wl-bubble-name' });
  private bubbleLine = h('div', { class: 'wl-bubble-line' });
  private bubbleFor: string | null = null;
  private lastName = '';
  private lastLine = '';

  constructor(private game: Game, mount: HTMLElement, private act: LabelActions) {
    mount.prepend(this.host);
    this.bubble = h('div', { class: 'wl wl-bubble hidden' },
      h('div', { class: 'wl-bubble-text' }, this.bubbleName, this.bubbleLine),
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
      }, () => this.act.openSpot(spot.id), on(spot.island), () => (s().spots[spot.id] ? null : '!'));
    }

    this.pin('wl-sign', [SHOP_STALL.x, 2.9, SHOP_STALL.z], () => 'zoomed', () => '🛍️ Shop', () => this.act.openShop(), home);
    this.pin('wl-sign', [FONT.x, 2.4, FONT.z], () => 'zoomed', () => '⛲ Kindred Font', () => this.act.openFont(), home);

    // Other islands on the horizon: name pins you can tap to visit (or unlock).
    for (const id of ISLAND_ORDER) {
      const def = ISLANDS[id];
      this.pin('wl-island', [def.ox, 2.5, def.oz], () => 'always', () => {
        const isl = s().islands[id];
        if (isl?.owned) return `${def.icon} ${def.name}`;
        return def.status === 'soon' ? `${def.icon} Coming soon` : `🔒 ${def.icon} ${def.name}`;
      }, () => this.act.openIsland(id), () => this.game.world.current !== id);
    }

    NESTS.forEach((n, i) => {
      this.pin('wl-nest', [n.x, 1.35, n.z], () => {
        const st = s();
        const egg = nestOccupant(st, i);
        if (egg && egg.progressMs >= egg.incubationMs) return 'always';
        if (i >= st.nests) return i === st.nests && nestPrice(st) !== null ? 'zoomed' : 'hidden';
        return 'zoomed';
      }, () => {
        const st = s();
        if (i >= st.nests) return '＋ Nest';
        const egg = nestOccupant(st, i);
        if (!egg) return 'Empty nest';
        if (egg.progressMs >= egg.incubationMs) return '🐣 Ready!';
        const ms = remainingMs(egg);
        return `🥚 ${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
      }, () => this.act.openNest(i), home);
    });

    this.pin('wl-nest', [BASKET.x, 0.9, BASKET.z], () => (s().eggs.some((e) => e.nest === null) ? 'zoomed' : 'hidden'),
      () => `🧺 ${s().eggs.filter((e) => e.nest === null).length} waiting`, () => this.act.openBasket(), home);
  }

  /** Show the name bubble for a creature (null hides it). */
  select(id: string | null): void {
    this.bubbleFor = id;
    this.lastName = '';
    this.lastLine = '';
    this.bubble.classList.toggle('hidden', !id);
  }

  get selected(): string | null {
    return this.bubbleFor;
  }

  update(hidden: boolean): void {
    this.host.classList.toggle('hidden', hidden);
    if (hidden) return;
    const w = this.game.world;
    const zoom = w.zoom;
    const near = Math.max(0, Math.min(1, (SIGN_FAR - zoom) / (SIGN_FAR - SIGN_NEAR)));

    for (const p of this.pins) {
      const mode = p.when() ? p.mode() : 'hidden';
      const sp = w.toScreen(p.pos[0], p.pos[1] + w.groundAt(p.pos[0], p.pos[2]), p.pos[2]);
      const farText = p.far && near < 0.5 && mode !== 'hidden' ? p.far() : undefined;
      let opacity = mode === 'hidden' || !sp.visible ? 0 : mode === 'always' ? 1 : near;
      if (p.far && near < 0.5) opacity = farText && sp.visible ? 1 : 0;
      p.el.style.opacity = String(opacity);
      p.el.style.pointerEvents = opacity > 0.4 ? 'auto' : 'none';
      if (opacity === 0) continue;
      p.el.style.transform = `translate(-50%, -100%) translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px)`;
      p.el.classList.toggle('mini', !!farText);
      const txt = farText ?? p.render();
      if (txt !== p.last) {
        p.last = txt;
        p.text.textContent = txt;
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
      this.bubble.style.opacity = sp.visible ? '1' : '0';
      this.bubble.style.transform = `translate(-50%, -100%) translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px)`;
      const name = displayName(c);
      const line = w.creatureActivity(c.id);
      if (name !== this.lastName) this.bubbleName.textContent = this.lastName = name;
      if (line !== this.lastLine) this.bubbleLine.textContent = this.lastLine = line;
    }
  }
}
