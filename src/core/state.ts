import { TUNING } from '../content/tuning';
import { SPOTS } from '../content/world';
import { makeCreature } from './creatures';
import { recordSpecies } from './journal';
import { generateShop } from './shop';
import type { GameState } from './types';

export const SAVE_VERSION = 14;

/** A new game id for cloud save: unique enough per device and moment. */
export function newSaveId(seed: number, t: number): string {
  return `${(seed >>> 0).toString(36)}-${t.toString(36)}`;
}

export function createGame(now: number, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed ^ 0x9e3779b9,
    createdAt: now,
    lastTick: now,
    clockOffset: 0,
    glimmer: TUNING.start.glimmer,
    shards: TUNING.start.shards,
    lures: { ...TUNING.start.lures },
    items: {},
    tools: {},
    xp: 0,
    quests: { day: '', daily: [], tiers: {} },
    questStats: {},
    food: { snack: 3 },
    feedbags: {},
    storageSlots: TUNING.storageBase,
    levelPaid: 1,
    cloud: { saveId: newSaveId(seed, now) },
    visitors: [],
    wanderer: null,
    expeditions: [],
    wandererNextAt: now + 8 * 60_000,
    collector: { nextAt: now + 60 * 60_000, until: 0, wants: 'Grove' },
    decorOwned: {},
    placedDecor: [],
    creatures: [],
    islands: {
      home: { owned: true, size: 0 }, volcano: { owned: false, size: 0 }, lagoon: { owned: false, size: 0 },
      beach: { owned: false, size: 0 }, desert: { owned: false, size: 0 }, cloud: { owned: false, size: 0 },
    },
    eggs: [],
    nests: TUNING.freeNests,
    spots: Object.fromEntries(Object.keys(SPOTS).map((k) => [k, null])),
    gifts: [],
    digSpots: [],
    shop: generateShop(seed, 0, now),
    journal: { species: {}, mutations: {}, resonances: {}, notes: [], eventsSeen: {} },
    eventsApplied: {},
    tutorial: 0,
    ads: { day: '', count: 0 },
    stats: { combines: 0, hatches: 0, arrivals: 0, lures: 0 },
    nextId: 0,
    savedAt: now,
  };
  for (const sp of TUNING.start.creatures) {
    state.creatures.push(makeCreature(state, sp, [], now, 'Was already living here when you arrived.', { met: { how: 'starter' } }));
    recordSpecies(state, sp, now);
  }
  // Starters don't pay discovery rewards.
  state.glimmer = TUNING.start.glimmer;
  state.shards = TUNING.start.shards;
  return state;
}

export function residents(state: GameState) {
  return state.creatures;
}

export function nestOccupant(state: GameState, nest: number) {
  return state.eggs.find((e) => e.nest === nest) ?? null;
}

export function freeNest(state: GameState): number | null {
  for (let i = 0; i < state.nests; i++) if (!nestOccupant(state, i)) return i;
  return null;
}
