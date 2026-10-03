// Quests: three daily quests that change every day, plus lasting goals in
// tiers that never expire. Both pay coins, Starshards and keeper XP.
// Counting comes from PlayEvents (things the player does) and, for "own" or
// "discover" goals, from the state itself.

import { SPECIES } from '../content/species';
import { isOutlier, growth } from './creatures';
import { hasQuirk } from './quirks';
import type { PlayEvent } from './progress';
import { StateRng } from './rng';
import type { GameState, Rarity, Trait } from './types';

export interface QuestReward { coins: number; shards: number; xp: number }

/** Lifetime counters that quests read. */
export type QuestStat = 'hatch' | 'breed' | 'lure' | 'coinsPicked' | 'creatureCoins' | 'digSpot' | 'finds' | 'shopEgg';

export interface DailyDef {
  id: string;
  stat: QuestStat;
  target: number;
  text: string;
  reward: QuestReward;
  /** Only offered when it's possible right now. */
  when?: (s: GameState) => boolean;
}

// Dailies take a couple of sessions and pay well: together, the three are worth
// about a session's earnings (measured with the economy sim).
export const DAILY_POOL: DailyDef[] = [
  { id: 'd-hatch', stat: 'hatch', target: 5, text: 'Hatch 5 eggs', reward: { coins: 600, shards: 8, xp: 150 } },
  { id: 'd-breed', stat: 'breed', target: 5, text: 'Breed 5 pairs', reward: { coins: 550, shards: 8, xp: 140 } },
  { id: 'd-lure', stat: 'lure', target: 12, text: 'Set out 12 lures', reward: { coins: 450, shards: 6, xp: 120 } },
  { id: 'd-coins', stat: 'coinsPicked', target: 300, text: 'Pick up 300 coins from the ground', reward: { coins: 500, shards: 6, xp: 120 } },
  { id: 'd-finds', stat: 'finds', target: 25, text: 'Collect 25 finds', reward: { coins: 450, shards: 6, xp: 120 } },
  { id: 'd-dig', stat: 'digSpot', target: 8, text: 'Drop creatures on 8 dig spots', reward: { coins: 600, shards: 8, xp: 150 } },
  { id: 'd-egg', stat: 'shopEgg', target: 2, text: 'Buy 2 eggs from Mango', reward: { coins: 400, shards: 10, xp: 100 } },
  {
    id: 'd-fetch', stat: 'creatureCoins', target: 120, text: 'Have your creatures fetch 120 coins', reward: { coins: 550, shards: 8, xp: 130 },
    when: (s) => s.creatures.some((c) => !c.stored && hasQuirk(c, 'greedy')),
  },
];

export interface LastingDef {
  id: string;
  name: string;
  icon: string;
  /** Text with {n} for the tier's target. */
  text: string;
  tiers: number[];
  /** How far along the keeper is (lifetime). */
  progress: (s: GameState) => number;
}

const discovered = (s: GameState, keep: (r: Rarity, t: Trait[]) => boolean) =>
  Object.keys(s.journal.species).filter((id) => {
    const sp = SPECIES.find((x) => x.id === id);
    return sp ? keep(sp.rarity, sp.traits) : false;
  }).length;
const stat = (k: QuestStat) => (s: GameState) => s.questStats[k] ?? 0;

export const LASTING: LastingDef[] = [
  { id: 'hatcher', name: 'Hatcher', icon: '🐣', text: 'Hatch {n} eggs', tiers: [5, 25, 100, 300], progress: stat('hatch') },
  { id: 'matchmaker', name: 'Matchmaker', icon: '💞', text: 'Breed {n} pairs', tiers: [5, 25, 100], progress: stat('breed') },
  { id: 'lures', name: 'Lure Master', icon: '🫙', text: 'Set out {n} lures', tiers: [10, 50, 200], progress: stat('lure') },
  { id: 'coins', name: 'Coin Collector', icon: '🪙', text: 'Pick up {n} coins from the ground', tiers: [200, 1000, 5000], progress: stat('coinsPicked') },
  { id: 'fetch', name: 'Treasure Team', icon: '💰', text: 'Have your creatures fetch {n} coins', tiers: [50, 300, 1500], progress: stat('creatureCoins') },
  { id: 'dig', name: 'Digger', icon: '⛏️', text: 'Work {n} dig spots', tiers: [5, 25, 100], progress: stat('digSpot') },
  { id: 'naturalist', name: 'Naturalist', icon: '📖', text: 'Discover {n} kinds of creature', tiers: [10, 20, 30, 45], progress: (s) => Object.keys(s.journal.species).length },
  { id: 'rare', name: 'Rare Finds', icon: '💎', text: 'Discover {n} rare or rarer creatures', tiers: [3, 8, 15], progress: (s) => discovered(s, (r) => r === 'rare' || r === 'legendary' || r === 'mythical') },
  { id: 'mythic', name: 'Myth Hunter', icon: '✦', text: 'Discover {n} Mythical creatures', tiers: [1, 3, 5], progress: (s) => discovered(s, (r) => r === 'mythical') },
  { id: 'birds', name: 'Bird Watcher', icon: '🐦', text: 'Discover {n} kinds of bird', tiers: [3, 6], progress: (s) => discovered(s, (_, t) => t.includes('Bird')) },
  { id: 'reptiles', name: 'Scale Seeker', icon: '🦎', text: 'Discover {n} kinds of reptile', tiers: [3, 6], progress: (s) => discovered(s, (_, t) => t.includes('Reptile')) },
  { id: 'mutations', name: 'Changeling', icon: '✨', text: 'See {n} kinds of mutation', tiers: [2, 5, 9], progress: (s) => Object.keys(s.journal.mutations).length },
  {
    id: 'colossal', name: 'Big Love', icon: '⛰️', text: 'Own {n} fully grown Colossal creatures', tiers: [1, 3],
    progress: (s) => s.creatures.filter((c) => c.size > 1.6 && growth(c, s.lastTick) >= 1).length,
  },
  {
    id: 'teeny', name: 'Tiny Friends', icon: '🐜', text: 'Own {n} fully grown Teeny creatures', tiers: [1, 3],
    progress: (s) => s.creatures.filter((c) => isOutlier(c.size) && c.size < 1 && growth(c, s.lastTick) >= 1).length,
  },
];

/** Bigger tiers pay more. */
export function lastingReward(tier: number): QuestReward {
  const k = tier + 1;
  return { coins: 100 * k * k, shards: 3 * k + (k >= 3 ? 5 : 0), xp: 60 * k * k };
}

export function today(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Hand out three new daily quests when the day changes. */
export function refreshDailies(state: GameState, t: number): void {
  const day = today(t);
  if (state.quests.day === day) return;
  const rng = new StateRng(state);
  const pool = DAILY_POOL.filter((d) => !d.when || d.when(state));
  const picked: string[] = [];
  while (picked.length < 3 && picked.length < pool.length) {
    const d = rng.pick(pool);
    if (!picked.includes(d.id)) picked.push(d.id);
  }
  state.quests.day = day;
  state.quests.daily = picked.map((id) => ({ id, progress: 0, claimed: false }));
}

/** Count something the player did toward quests. */
export function questEvent(state: GameState, ev: PlayEvent): void {
  const add = (k: QuestStat, n = 1) => {
    state.questStats[k] = (state.questStats[k] ?? 0) + n;
    for (const q of state.quests.daily) {
      const def = DAILY_POOL.find((d) => d.id === q.id);
      if (def?.stat === k && !q.claimed) q.progress = Math.min(def.target, q.progress + n);
    }
  };
  switch (ev.kind) {
    case 'hatch': add('hatch'); break;
    case 'breed': add('breed'); break;
    case 'lure': add('lure'); break;
    case 'digSpot': add('digSpot'); break;
    case 'shopEgg': add('shopEgg'); break;
    case 'gift':
      add('finds');
      if (ev.byCreature) add('creatureCoins', ev.glimmer);
      else add('coinsPicked', ev.glimmer);
      break;
    default: break;
  }
}

export type ClaimResult = { ok: true; reward: QuestReward; text: string } | { ok: false; error: string };

export function claimDaily(state: GameState, id: string): ClaimResult {
  const q = state.quests.daily.find((x) => x.id === id);
  const def = DAILY_POOL.find((d) => d.id === id);
  if (!q || !def) return { ok: false, error: 'That quest is gone.' };
  if (q.claimed) return { ok: false, error: 'Already claimed.' };
  if (q.progress < def.target) return { ok: false, error: 'Not finished yet.' };
  q.claimed = true;
  state.glimmer += def.reward.coins;
  state.shards += def.reward.shards;
  return { ok: true, reward: def.reward, text: def.text };
}

export function claimLasting(state: GameState, id: string): ClaimResult {
  const def = LASTING.find((d) => d.id === id);
  if (!def) return { ok: false, error: 'Unknown quest.' };
  const tier = state.quests.tiers[id] ?? 0;
  if (tier >= def.tiers.length) return { ok: false, error: 'All done!' };
  if (def.progress(state) < def.tiers[tier]) return { ok: false, error: 'Not finished yet.' };
  state.quests.tiers[id] = tier + 1;
  const reward = lastingReward(tier);
  state.glimmer += reward.coins;
  state.shards += reward.shards;
  return { ok: true, reward, text: def.text.replace('{n}', String(def.tiers[tier])) };
}

/** How many quests are ready to claim (for the badge). */
export function claimable(state: GameState): number {
  let n = 0;
  for (const q of state.quests.daily) {
    const def = DAILY_POOL.find((d) => d.id === q.id);
    if (def && !q.claimed && q.progress >= def.target) n++;
  }
  for (const def of LASTING) {
    const tier = state.quests.tiers[def.id] ?? 0;
    if (tier < def.tiers.length && def.progress(state) >= def.tiers[tier]) n++;
  }
  return n;
}


