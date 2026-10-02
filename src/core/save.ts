// Versioned save format. Saves are plain JSON so they can be synced to a cloud
// save backend unchanged. Migrations run in order on load.

import { SAVE_VERSION } from './state';
import type { GameState } from './types';

type Migration = (raw: Record<string, unknown>) => void;

/** migrations[n] upgrades a save from version n to n+1. */
const MIGRATIONS: Record<number, Migration> = {};

export function serialize(state: GameState, t: number): string {
  state.savedAt = t;
  pruneEvents(state);
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const raw = JSON.parse(json) as Record<string, unknown>;
  let v = typeof raw.version === 'number' ? raw.version : 0;
  if (v > SAVE_VERSION) throw new Error(`Save is from a newer version (${v}).`);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from save version ${v}.`);
    m(raw);
    v += 1;
    raw.version = v;
  }
  const state = raw as unknown as GameState;
  validate(state);
  return state;
}

function validate(s: GameState): void {
  const need: (keyof GameState)[] = ['seed', 'createdAt', 'lastTick', 'creatures', 'eggs', 'journal', 'shop', 'spots'];
  for (const k of need) if (s[k] === undefined) throw new Error(`Corrupt save: missing ${k}`);
}

/** Keep only recent event bookkeeping so saves stay small. */
function pruneEvents(state: GameState): void {
  const keys = Object.keys(state.eventsApplied).map(Number).sort((a, b) => a - b);
  for (const k of keys.slice(0, Math.max(0, keys.length - 4))) {
    if (state.eventsApplied[k].ended) delete state.eventsApplied[k];
  }
}

/**
 * Cloud conflict resolution: prefer the save with more total progress, falling
 * back to the most recent. Never silently discard discoveries.
 */
export function pickSave(a: GameState, b: GameState): GameState {
  const score = (s: GameState) =>
    Object.keys(s.journal.species).length * 1000 + s.stats.hatches * 10 + s.stats.arrivals;
  const sa = score(a);
  const sb = score(b);
  if (sa !== sb) return sa > sb ? a : b;
  return a.savedAt >= b.savedAt ? a : b;
}
