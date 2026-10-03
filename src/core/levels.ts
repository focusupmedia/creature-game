// Keeper levels 1-50. XP comes only from things the player does (hatching,
// breeding, lures, digging, quests), never from idle time. Levels 1-5 come
// in minutes, 20 means you play a good amount, and 50 takes a few days of
// actual play: far, but always in sight for a returning player.

import { TUNING } from '../content/tuning';
import { makeCreature } from './creatures';
import { recordSpecies } from './journal';
import type { GameState, SpeciesId } from './types';

export const MAX_LEVEL = 50;

/** Level-only creatures, one every 5 levels. */
export const LEVEL_CREATURES: Record<number, SpeciesId> = {
  5: 'jackalope', 10: 'kitsune', 15: 'flyingsnake', 20: 'pegasus', 25: 'griffin',
  30: 'hippocampus', 35: 'thunderbird', 40: 'baku', 45: 'sphinx', 50: 'unicorn',
};

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(TUNING.levelXpBase * Math.pow(level, 1.5));
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

/** What reaching a level gives. Rewards grow all the way to 50; every 5th level is a big one. */
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
    if (r.creature) {
      const c = makeCreature(state, r.creature, [], t, `A gift for reaching keeper level ${l}.`, { island: 'home' });
      state.creatures.push(c);
      recordSpecies(state, r.creature, t);
      r.creatureId = c.id;
    }
    ups.push(r);
  }
  return ups;
}
