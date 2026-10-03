// Time of day and the sky-event schedule.
// The schedule is a pure function of (seed, createdAt, time), so it is identical
// whether the player is watching or away, and can be replaced by a server-driven
// calendar via remote config later.

import { EVENTS } from '../content/world';
import { TUNING } from '../content/tuning';
import { hash01 } from './rng';
import type { EventKind, GameState } from './types';

const MIN = 60_000;

/** 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk. */
export function dayPhase(state: Pick<GameState, 'createdAt'>, t: number): number {
  const len = TUNING.dayLengthMin * MIN;
  const p = ((t - state.createdAt) / len + TUNING.startPhase) % 1;
  return p < 0 ? p + 1 : p;
}

/** 0 at night, 1 at full day, with smooth dawn/dusk. */
export function daylight(phase: number): number {
  const s = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  if (phase < 0.5) return s(phase, 0.2, 0.28);
  return 1 - s(phase, 0.72, 0.8);
}

export function dayNumber(state: Pick<GameState, 'createdAt'>, t: number): number {
  const len = TUNING.dayLengthMin * MIN;
  return Math.floor((t - state.createdAt) / len + TUNING.startPhase) + 1;
}

export interface SkyEvent {
  /** Unique id for bookkeeping: window number for scheduled events, "s<start>" for summoned ones. */
  key: string;
  kind: EventKind;
  start: number;
  end: number;
  summoned?: boolean;
}

type Sched = Pick<GameState, 'seed' | 'createdAt'> & { summoned?: GameState['summoned'] };

const KINDS: EventKind[] = ['storm', 'eclipse', 'starry', 'fullmoon', 'blizzard', 'rainbow', 'aurora', 'meteor', 'fog'];

function pickKind(r: number): EventKind {
  const total = KINDS.reduce((s, k) => s + (TUNING.eventWeights[k] ?? 0), 0);
  let x = r * total;
  for (const k of KINDS) {
    x -= TUNING.eventWeights[k] ?? 0;
    if (x <= 0) return k;
  }
  return 'storm';
}

/** The event (if any) scheduled in a given window. */
export function eventInWindow(state: Pick<GameState, 'seed' | 'createdAt'>, w: number): SkyEvent | null {
  const winMs = TUNING.eventWindowMin * MIN;
  const winStart = state.createdAt + w * winMs;
  if (w < 0) return null;
  if (w === 0) {
    const start = state.createdAt + TUNING.firstStormAtMin * MIN;
    return { key: '0', kind: 'storm', start, end: start + 4 * MIN };
  }
  if (hash01(state.seed, w, 1) > TUNING.eventChancePerWindow) return null;
  const kind = pickKind(hash01(state.seed, w, 2));
  const [dMin, dMax] = EVENTS[kind].durationMin;
  const dur = (dMin + (dMax - dMin) * hash01(state.seed, w, 3)) * MIN;
  const start = winStart + hash01(state.seed, w, 4) * (winMs - dur - MIN);
  return { key: String(w), kind, start, end: start + dur };
}

export function windowAt(state: Pick<GameState, 'createdAt'>, t: number): number {
  return Math.floor((t - state.createdAt) / (TUNING.eventWindowMin * MIN));
}

export function activeEvent(state: Sched, t: number): SkyEvent | null {
  const s = state.summoned;
  if (s && t >= s.start && t < s.end) return { key: `s${s.start}`, kind: s.kind, start: s.start, end: s.end, summoned: true };
  const w = windowAt(state, t);
  for (const k of [w, w - 1]) {
    const e = eventInWindow(state, k);
    if (e && t >= e.start && t < e.end) return e;
  }
  return null;
}

/** The next event that hasn't started yet. */
export function nextEvent(state: Pick<GameState, 'seed' | 'createdAt'>, t: number): SkyEvent | null {
  const w = windowAt(state, t);
  for (let k = w; k < w + 6; k++) {
    const e = eventInWindow(state, k);
    if (e && e.start > t) return e;
  }
  return null;
}

/** Whether nocturnal creatures are about: real night, or a dark event. */
export function isDark(state: Sched, t: number): boolean {
  if (daylight(dayPhase(state, t)) < 0.5) return true;
  const e = activeEvent(state, t);
  return !!e && EVENTS[e.kind].dark;
}
