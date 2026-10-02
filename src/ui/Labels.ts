import { BASKET, FONT, NESTS, SHOP_STALL } from '../content/layout';
import { LURES, SPOTS } from '../content/world';
import { remainingMs, nestPrice } from '../core/actions';
import { displayName } from '../core/creatures';
import { arrivalWeights } from '../core/lures';
import { nestOccupant } from '../core/state';
import { activeEvent, isDark } from '../core/world';
import type { Game } from '../game/Game';
import { h } from './dom';

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
      }, '⚙️'),
    );
    this.host.append(this.bubble);
    this.buildPins();
  }

  private pin(cls: string, pos: [number, number, number], mode: Pin['mode'], render: Pin['render'], onTap: () => void): void {
    const text = h('span');
    const el = h('button', { class: `wl ${cls}`, onClick: (e: MouseEvent) => { e.stopPropagation(); this.game.audio.play('tap'); onTap(); } }, text);
    this.host.append(el);
    this.pins.push({ el, text, pos, mode, render, last: '' });
  }

  private buildPins(): void {
    const s = () => this.game.state;
    const now = () => this.game.now();

    for (const spot of Object.values(SPOTS)) {
      this.pin('wl-spot', [spot.x, spot.water ? 1.1 : 0.9, spot.z], () => 'always', () => {
        const active = s().spots[spot.id];
        if (!active) return '＋ Lure';
        const dormant = arrivalWeights(active.lure, spot.id, isDark(s(), now()), activeEvent(s(), now())?.kind ?? null).length === 0;
        if (dormant) return '💤 Waiting';
        const ms = Math.max(0, active.expiresAt - now());
        return `${LURES[active.lure].name.split(' ')[0]} · ${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
      }, () => this.act.openSpot(spot.id));
    }

    this.pin('wl-sign', [SHOP_STALL.x, 2.9, SHOP_STALL.z], () => 'zoomed', () => '🛍️ Shop', () => this.act.openShop());
    this.pin('wl-sign', [FONT.x, 2.4, FONT.z], () => 'zoomed', () => '⛲ Kindred Font', () => this.act.openFont());

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
      }, () => this.act.openNest(i));
    });

    this.pin('wl-nest', [BASKET.x, 0.9, BASKET.z], () => (s().eggs.some((e) => e.nest === null) ? 'zoomed' : 'hidden'),
      () => `🧺 ${s().eggs.filter((e) => e.nest === null).length} waiting`, () => this.act.openBasket());
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
      const mode = p.mode();
      const sp = w.toScreen(...p.pos);
      const opacity = mode === 'hidden' || !sp.visible ? 0 : mode === 'always' ? 1 : near;
      p.el.style.opacity = String(opacity);
      p.el.style.pointerEvents = opacity > 0.4 ? 'auto' : 'none';
      if (opacity === 0) continue;
      p.el.style.transform = `translate(-50%, -100%) translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px)`;
      const txt = p.render();
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
