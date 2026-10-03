// Versioned save format. Saves are plain JSON so they can be synced to a cloud
// save backend unchanged. Migrations run in order on load.

import { SAVE_VERSION } from './state';
import { generateShop } from './shop';
import type { GameState, Personality } from './types';
import { StateRng } from './rng';
import { rollQuirks } from './quirks';

type Migration = (raw: Record<string, unknown>) => void;

/** migrations[n] upgrades a save from version n to n+1. */
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: islands, growth, personalities, dig finds, tiered egg shop.
  1: (raw) => {
    const personalities = ['energetic', 'lazy', 'shy', 'curious', 'grumpy', 'friendly'];
    raw.islands = {
      home: { owned: true, size: 0 }, volcano: { owned: false, size: 0 }, lagoon: { owned: false, size: 0 },
      beach: { owned: false, size: 0 }, desert: { owned: false, size: 0 },
    };
    for (const c of (raw.creatures as Record<string, unknown>[]) ?? []) {
      const seed = Number(c.seed) || 0;
      c.island = 'home';
      // Existing creatures keep roughly the size they always had, and are fully grown.
      c.size = 0.94 + ((seed >>> 3) % 100) / 100 * 0.12;
      c.growMs = 0;
      c.personality = personalities[seed % personalities.length];
    }
    for (const g of (raw.gifts as Record<string, unknown>[]) ?? []) g.island = 'home';
    const spots = (raw.spots ?? {}) as Record<string, unknown>;
    for (const k of ['vent', 'ash', 'reef', 'shallows']) spots[k] ??= null;
    raw.spots = spots;
    // Old shop egg offers referenced species directly; start a fresh rotation.
    const shop = raw.shop as { rotation: number; nextRefreshAt: number };
    const fresh = generateShop(Number(raw.seed), (shop?.rotation ?? 0) + 1, Number(raw.lastTick));
    raw.shop = fresh;
  },
  // v2 → v3: dig spots you drop creatures on.
  2: (raw) => {
    raw.digSpots = [];
  },
  // v11 → v12: Cloud Isle.
  11: (raw) => {
    const islands = (raw.islands ?? {}) as Record<string, unknown>;
    islands.cloud ??= { owned: false, size: 0 };
    raw.islands = islands;
    const spots = (raw.spots ?? {}) as Record<string, unknown>;
    for (const k of ['cloudtop', 'mistpool', 'windmill', 'skyshrine']) spots[k] ??= null;
    raw.spots = spots;
  },
  // v10 → v11: expeditions.
  10: (raw) => {
    raw.expeditions = [];
  },
  // v9 → v10: wanderers.
  9: (raw) => {
    raw.wanderer = null;
    raw.wandererNextAt = Number(raw.lastTick) + 8 * 60_000;
  },
  // v8 → v9: lure visitors wait for you.
  8: (raw) => {
    raw.visitors = [];
  },
  // v7 → v8: hunger, food, storage and the Collector. Everyone starts full.
  7: (raw) => {
    for (const c of (raw.creatures as Record<string, unknown>[]) ?? []) c.fullness = 1;
    raw.food = { snack: 3 };
    raw.feedbags = {};
    raw.storageSlots = 4;
    raw.collector = { nextAt: Number(raw.lastTick) + 60 * 60_000, until: 0, wants: 'Grove' };
  },
  // v6 → v7: quests. Lifetime counts start from what the save already tracked.
  6: (raw) => {
    const stats = raw.stats as { hatches?: number; combines?: number; lures?: number } | undefined;
    raw.quests = { day: '', daily: [], tiers: {} };
    raw.questStats = { hatch: stats?.hatches ?? 0, breed: stats?.combines ?? 0, lure: stats?.lures ?? 0 };
  },
  // v5 → v6: keeper levels. Existing keepers start with XP for what they've already done.
  5: (raw) => {
    const journal = raw.journal as { species?: Record<string, unknown>; mutations?: Record<string, unknown> } | undefined;
    const stats = raw.stats as { hatches?: number; combines?: number; lures?: number } | undefined;
    raw.xp = Object.keys(journal?.species ?? {}).length * 50 + Object.keys(journal?.mutations ?? {}).length * 30
      + (stats?.hatches ?? 0) * 25 + (stats?.combines ?? 0) * 15 + (stats?.lures ?? 0) * 6;
  },
  // v4 → v5: behaviour traits (2-5 per creature, keeping its personality) and trait tools.
  4: (raw) => {
    raw.tools = {};
    for (const c of (raw.creatures as Record<string, unknown>[]) ?? []) {
      const rng = new StateRng({ rng: (Number(c.seed) || 1) >>> 0 });
      c.quirks = rollQuirks(rng, [], c.personality as Personality);
    }
  },
  // v3 → v4: Sunny Shore and Dune Hollow lure spots.
  3: (raw) => {
    const spots = (raw.spots ?? {}) as Record<string, unknown>;
    for (const k of ['tidepool', 'dunegrass', 'oasis', 'sandpit']) spots[k] ??= null;
    raw.spots = spots;
  },
};

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
  // Keys are window numbers ("12") for scheduled events and "s<start>" for summoned ones.
  // Keep the four newest of each kind; drop older ones that have finished.
  const ev = state.eventsApplied;
  const order = (k: string) => Number(k.startsWith('s') ? k.slice(1) : k);
  for (const summoned of [false, true]) {
    const keys = Object.keys(ev).filter((k) => k.startsWith('s') === summoned).sort((a, b) => order(a) - order(b));
    for (const k of keys.slice(0, Math.max(0, keys.length - 4))) {
      if (ev[k]?.ended) delete ev[k];
    }
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
