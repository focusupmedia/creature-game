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
export type QuestStat = 'hatch' | 'breed' | 'lure' | 'coinsPicked' | 'creatureCoins' | 'digSpot' | 'finds' | 'shopEgg'
  | 'sold' | 'soldCoins' | 'market' | 'befriend' | 'feed' | 'trip' | 'deal' | 'arrival' | 'hatchMutated' | 'newSpecies';

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
  { id: 'd-sell', stat: 'sold', target: 5, text: 'Sell 5 pets', reward: { coins: 450, shards: 6, xp: 110 } },
  { id: 'd-soldcoins', stat: 'soldCoins', target: 1500, text: 'Earn 1,500 coins from selling pets', reward: { coins: 500, shards: 8, xp: 120 } },
  { id: 'd-market', stat: 'market', target: 1, text: 'Sell a pet to a buyer on the Market board', reward: { coins: 500, shards: 10, xp: 130 } },
  { id: 'd-befriend', stat: 'befriend', target: 10, text: 'Pet or play with your creatures 10 times', reward: { coins: 400, shards: 6, xp: 110 } },
  { id: 'd-feed', stat: 'feed', target: 8, text: 'Feed your creatures by hand 8 times', reward: { coins: 400, shards: 6, xp: 100 } },
  { id: 'd-trip', stat: 'trip', target: 2, text: 'Welcome 2 explorers home', reward: { coins: 550, shards: 8, xp: 140 } },
  { id: 'd-arrival', stat: 'arrival', target: 6, text: 'Meet 6 lure visitors', reward: { coins: 450, shards: 6, xp: 120 } },
  { id: 'd-hatchmut', stat: 'hatchMutated', target: 2, text: 'Hatch 2 eggs that carry a mutation', reward: { coins: 650, shards: 10, xp: 160 } },
  {
    id: 'd-new', stat: 'newSpecies', target: 1, text: 'Discover a creature you\'ve never met', reward: { coins: 600, shards: 10, xp: 150 },
    when: (s) => Object.keys(s.journal.species).length < SPECIES.length,
  },
  { id: 'd-deal', stat: 'deal', target: 1, text: 'Take a deal from a wandering keeper', reward: { coins: 400, shards: 8, xp: 100 } },
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
  { id: 'naturalist', name: 'Naturalist', icon: '📖', text: 'Discover {n} kinds of creature', tiers: [10, 20, 30, 45, 60], progress: (s) => Object.keys(s.journal.species).length },
  { id: 'rare', name: 'Rare Finds', icon: '💎', text: 'Discover {n} rare or rarer creatures', tiers: [3, 8, 15], progress: (s) => discovered(s, (r) => r === 'rare' || r === 'legendary' || r === 'mythical') },
  { id: 'mythic', name: 'Myth Hunter', icon: '✦', text: 'Discover {n} Mythical creatures', tiers: [1, 3, 5], progress: (s) => discovered(s, (r) => r === 'mythical') },
  { id: 'birds', name: 'Bird Watcher', icon: '🐦', text: 'Discover {n} kinds of bird', tiers: [3, 6], progress: (s) => discovered(s, (_, t) => t.includes('Bird')) },
  { id: 'reptiles', name: 'Scale Seeker', icon: '🦎', text: 'Discover {n} kinds of reptile', tiers: [3, 6], progress: (s) => discovered(s, (_, t) => t.includes('Reptile')) },
  { id: 'mutations', name: 'Changeling', icon: '✨', text: 'See {n} kinds of mutation', tiers: [2, 5, 9, 14, 19], progress: (s) => Object.keys(s.journal.mutations).length },
  {
    id: 'colossal', name: 'Big Love', icon: '⛰️', text: 'Own {n} fully grown Colossal creatures', tiers: [1, 3],
    progress: (s) => s.creatures.filter((c) => c.size > 1.6 && growth(c, s.lastTick) >= 1).length,
  },
  {
    id: 'teeny', name: 'Tiny Friends', icon: '🐜', text: 'Own {n} fully grown Teeny creatures', tiers: [1, 3],
    progress: (s) => s.creatures.filter((c) => isOutlier(c.size) && c.size < 1 && growth(c, s.lastTick) >= 1).length,
  },
  { id: 'merchant', name: 'Merchant', icon: '🛒', text: 'Sell {n} pets', tiers: [10, 50, 200], progress: stat('sold') },
  { id: 'tycoon', name: 'Tycoon', icon: '💰', text: 'Earn {n} coins from selling pets', tiers: [2000, 20000, 100000], progress: stat('soldCoins') },
  { id: 'market', name: 'Market Favourite', icon: '🛒', text: 'Sell to {n} Market buyers', tiers: [3, 15, 50], progress: stat('market') },
  { id: 'friends', name: 'Best Friends', icon: '💞', text: 'Have {n} best friends (5 hearts)', tiers: [1, 3, 8], progress: (s) => s.creatures.filter((c) => (c.bond ?? 0) >= 100).length },
  { id: 'explorer', name: 'Explorer', icon: '🧭', text: 'Welcome home {n} explorers', tiers: [5, 25, 100], progress: stat('trip') },
  { id: 'caretaker', name: 'Caretaker', icon: '🍓', text: 'Feed creatures by hand {n} times', tiers: [25, 150, 500], progress: stat('feed') },
  { id: 'worlds', name: 'World Builder', icon: '🗺️', text: 'Unlock {n} worlds', tiers: [2, 4, 6], progress: (s) => Object.values(s.islands).filter((i) => i.owned).length },
  { id: 'shades', name: 'Colour Collector', icon: '🎨', text: 'Own {n} pets with a special shade', tiers: [3, 10], progress: (s) => s.creatures.filter((c) => c.shade && c.shade !== 'classic').length },
  { id: 'skies', name: 'Sky Watcher', icon: '🌈', text: 'See {n} kinds of sky event', tiers: [4, 9, 15], progress: (s) => Object.keys(s.journal.eventsSeen ?? {}).length },
  { id: 'stacked', name: 'Masterpiece', icon: '🌟', text: 'Own a pet with {n} mutations at once', tiers: [2, 3, 4], progress: (s) => Math.max(0, ...s.creatures.map((c) => c.mutations.length)) },
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
    case 'hatch':
      add('hatch');
      if (ev.mutated) add('hatchMutated');
      if (ev.newSpecies) add('newSpecies');
      break;
    case 'breed': add('breed'); break;
    case 'lure': add('lure'); break;
    case 'digSpot': add('digSpot'); break;
    case 'shopEgg': add('shopEgg'); break;
    case 'sold':
      add('sold', ev.count ?? 1);
      add('soldCoins', ev.coins);
      break;
    case 'market': add('market'); break;
    case 'befriend': add('befriend'); break;
    case 'feed': add('feed'); break;
    case 'trip': add('trip'); break;
    case 'deal': add('deal'); break;
    case 'arrival': add('arrival'); break;
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


