import { TUNING } from '../content/tuning';
import { SPOTS } from '../content/world';
import { makeCreature, newId } from './creatures';
import { recordSpecies } from './journal';
import { generateShop } from './shop';
import { ISLANDS } from '../content/islands';
import { NESTS } from '../content/layout';
import type { GameState, IslandId, PlacedDecor } from './types';

export const SAVE_VERSION = 15;

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
    nestsBought: 0,
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
  // two free nests at home to start with
  addWorldNest(state, 'home', NESTS[0]);
  addWorldNest(state, 'home', NESTS[1]);
  // Starters don't pay discovery rewards.
  state.glimmer = TUNING.start.glimmer;
  state.shards = TUNING.start.shards;
  return state;
}

export function residents(state: GameState) {
  return state.creatures;
}

/** Every nest placed on your worlds (nests are decorations you can move or put away). */
export function placedNests(state: GameState): PlacedDecor[] {
  return state.placedDecor.filter((d) => d.decor === 'nest');
}

export function nestOccupant(state: GameState, nestId: string) {
  return state.eggs.find((e) => e.nest === nestId) ?? null;
}

/** A free nest, on the given world if it has one, otherwise anywhere (home first). */
export function freeNest(state: GameState, prefer?: IslandId): string | null {
  const free = placedNests(state).filter((n) => !nestOccupant(state, n.id) && state.islands[n.island ?? 'home']?.owned);
  const pick = (prefer && free.find((n) => (n.island ?? 'home') === prefer)) || free.find((n) => (n.island ?? 'home') === 'home') || free[0];
  return pick?.id ?? null;
}

/** Puts a new nest on a world, at its usual nest spot. */
export function addWorldNest(state: GameState, island: IslandId, at: { x: number; z: number }): void {
  const def = ISLANDS[island];
  state.placedDecor.push({ id: newId(state, 'n'), decor: 'nest', x: def.ox + at.x, z: def.oz + at.z, rot: 0, island });
}
