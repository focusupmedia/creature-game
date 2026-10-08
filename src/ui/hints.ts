// Little gesture tips that appear the moment they're useful (instead of a card
// to read before playing). Each shows once, never blocks a tap, and goes away
// as soon as the player does the gesture (or after a few seconds).

import { h } from './dom';
import * as I from './icons';

export type HintId = 'drag' | 'pinch' | 'hold' | 'twist';

const HINTS: Record<HintId, { svg: string; text: string }> = {
  drag: { svg: I.GESTURE_DRAG, text: 'Drag to look around your island' },
  pinch: { svg: I.GESTURE_PINCH, text: 'Pinch to zoom in and out' },
  hold: { svg: I.GESTURE_HOLD, text: 'Press and hold a pet, then drop it on another to make an egg' },
  twist: { svg: I.GESTURE_TWIST, text: 'Twist with two fingers to spin the globe' },
};

const KEY = 'kindred-grove.hints';

export class Hints {
  private seen = new Set<HintId>();
  private el: HTMLElement | null = null;
  private showing: HintId | null = null;
  private down: { x: number; y: number } | null = null;

  constructor(private host: HTMLElement) {
    try { for (const id of JSON.parse(localStorage.getItem(KEY) ?? '[]')) this.seen.add(id); } catch { /* fine */ }
    // notice the gestures, so a tip goes away (or never shows) once the player knows it
    window.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY }; }, true);
    window.addEventListener('pointermove', (e) => {
      if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 40) this.done('drag');
    }, true);
    window.addEventListener('pointerup', () => { this.down = null; }, true);
    window.addEventListener('wheel', () => this.done('pinch'), { passive: true });
    window.addEventListener('touchmove', (e) => { if (e.touches.length >= 2) { this.done('pinch'); this.done('twist'); } }, { passive: true });
  }

  /** Show a tip once (if the player hasn't already done the gesture). */
  show(id: HintId): void {
    if (this.seen.has(id) || this.showing) return;
    this.mark(id);
    this.showing = id;
    const def = HINTS[id];
    this.el = h('div', { class: 'gesture-hint' }, h('span', { class: 'gh-ico' }, I.icon(def.svg)), h('span', null, def.text));
    this.host.append(this.el);
    setTimeout(() => this.hide(id), 6500);
  }

  /** Hide the tip while a menu or pop-up is open (it comes back when they close). */
  pause(on: boolean): void {
    this.el?.classList.toggle('paused', on);
  }

  /** The player did it: no need to tell them. */
  done(id: HintId): void {
    this.mark(id);
    if (this.showing === id) setTimeout(() => this.hide(id), 600);
  }

  private hide(id: HintId): void {
    if (this.showing !== id || !this.el) return;
    const el = this.el;
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
    this.el = null;
    this.showing = null;
  }

  private mark(id: HintId): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...this.seen])); } catch { /* fine */ }
  }
}
