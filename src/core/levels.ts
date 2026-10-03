// Keeper levels 1-100. XP comes only from things the player does (hatching,
// breeding, lures, digging, quests), never from idle time. Levels 1-5 come
// in the first hour, 20 in about a week of regular play, and 50 in about six
// weeks: far, but always in sight for a returning player. Levels 51-100 are
// the Star Keeper levels for the most devoted keepers, a few months more.

import { TUNING } from '../content/tuning';
import { makeCreature } from './creatures';
import { recordSpecies } from './journal';
import { ISLANDS, ISLAND_ORDER, SIZE_CAPACITY } from '../content/islands';
import type { GameState, IslandId, SpeciesId } from './types';

export const MAX_LEVEL = 100;
/** Past this level you're a Star Keeper and your badge changes. */
export const STAR_LEVEL = 50;

/** Level-only creatures: one every 5 levels up to 50, then one every 10. */
export const LEVEL_CREATURES: Record<number, SpeciesId> = {
  5: 'jackalope', 10: 'kitsune', 15: 'flyingsnake', 20: 'pegasus', 25: 'griffin',
  30: 'hippocampus', 35: 'thunderbird', 40: 'baku', 45: 'sphinx', 50: 'unicorn',
  60: 'moonrabbit', 70: 'tanuki', 80: 'shisa', 90: 'leviathan', 100: 'worldturtle',
};

/** Star rank for the badge: 0 up to 50, 1 from 51, 2 from 75, 3 at 100. */
export function starRank(level: number): number {
  return level >= MAX_LEVEL ? 3 : level >= 75 ? 2 : level > STAR_LEVEL ? 1 : 0;
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(20 + TUNING.levelXpBase * Math.pow(level, 0.9));
}

/** Total XP needed to reach a level. */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

export function levelOf(xp: number): number {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++;
  return l;
}

/** Progress through the current level, 0..1 (1 at max level). */
export function levelProgress(xp: number): { level: number; into: number; need: number; pct: number } {
  const level = levelOf(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, need: 0, pct: 1 };
  const into = xp - xpForLevel(level);
  const need = xpToNext(level);
  return { level, into, need, pct: into / need };
}

export interface LevelReward {
  level: number;
  coins: number;
  shards: number;
  creature?: SpeciesId;
}

/** What reaching a level gives. Rewards grow all the way to 100; every 5th level is a big one. */
export function levelReward(level: number): LevelReward {
  const big = level % 5 === 0;
  const coins = Math.round((40 + level * 22 + Math.pow(level, 1.6)) * (big ? 2 : 1) / 5) * 5;
  const shards = 2 + Math.floor(level / 4) + (big ? 5 + Math.floor(level / 5) : 0);
  return { level, coins, shards, creature: LEVEL_CREATURES[level] };
}

export interface LevelUp extends LevelReward {
  creatureId?: string;
}

/** Add XP; applies the rewards of any levels reached and returns them. */
/** A level-only creature joins: on the first world with room, or resting in storage if every world is full. */
function giveLevelCreature(state: GameState, sp: SpeciesId, level: number, t: number): string {
  const owned = ISLAND_ORDER.filter((id) => state.islands[id]?.owned);
  const room = (id: IslandId) => state.creatures.filter((c) => c.island === id && !c.stored).length
    < (SIZE_CAPACITY[state.islands[id]?.size ?? 0] ?? 10) + (ISLANDS[id]?.capacityBonus ?? 0);
  const island = owned.find(room);
  const c = makeCreature(state, sp, [], t, `A gift for reaching keeper level ${level}.`, { island: island ?? 'home', met: { how: 'level', level } });
  if (!island) {
    c.stored = true;
    c.storedAt = t;
  }
  state.creatures.push(c);
  recordSpecies(state, sp, t);
  return c.id;
}

/** Older saves could pass a level without getting its creature: hand over any that are missing. */
export function grantMissingLevelCreatures(state: GameState, t: number): string[] {
  const out: string[] = [];
  const level = levelOf(state.xp);
  for (const [l, sp] of Object.entries(LEVEL_CREATURES)) {
    if (Number(l) > level) continue;
    if (state.creatures.some((c) => c.species === sp) || state.journal.species[sp]) continue;
    out.push(giveLevelCreature(state, sp, Number(l), t));
  }
  return out;
}

export function addXp(state: GameState, amount: number, t: number): LevelUp[] {
  if (amount <= 0) return [];
  const before = levelOf(state.xp);
  state.xp += amount;
  const after = levelOf(state.xp);
  const ups: LevelUp[] = [];
  for (let l = before + 1; l <= after; l++) {
    const r: LevelUp = levelReward(l);
    state.glimmer += r.coins;
    state.shards += r.shards;
    if (r.creature) r.creatureId = giveLevelCreature(state, r.creature, l, t);
    ups.push(r);
  }
  return ups;
}
