// Achievements (also sent to Game Center / Google Play Games when signed in)
// and the scores that go on the leaderboards.

import { SPECIES, species } from '../content/species';
import { levelOf } from './levels';
import type { GameState } from './types';

export interface Achievement { id: string; name: string; desc: string; test: (s: GameState) => boolean }

const found = (s: GameState) => Object.keys(s.journal.species).length;
const owned = (s: GameState, r: string) => s.creatures.some((c) => species(c.species).rarity === r) || Object.keys(s.journal.species).some((id) => species(id).rarity === r);
const all = SPECIES.filter((x) => x.origin !== 'reward').length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_hatch', name: 'First Hatch', desc: 'Hatch your first egg.', test: (s) => s.stats.hatches >= 1 },
  { id: 'hatch_50', name: 'Egg Expert', desc: 'Hatch 50 eggs.', test: (s) => s.stats.hatches >= 50 },
  { id: 'lures_25', name: 'Scent Master', desc: 'Set out 25 lures.', test: (s) => s.stats.lures >= 25 },
  { id: 'species_10', name: 'Curious Keeper', desc: 'Discover 10 kinds of creature.', test: (s) => found(s) >= 10 },
  { id: 'species_25', name: 'Field Naturalist', desc: 'Discover 25 kinds of creature.', test: (s) => found(s) >= 25 },
  { id: 'species_50', name: 'Living Encyclopedia', desc: 'Discover 50 kinds of creature.', test: (s) => found(s) >= 50 },
  { id: 'species_all', name: 'Every Last One', desc: 'Discover every creature in the wild and bred.', test: (s) => SPECIES.every((x) => x.origin === 'reward' || s.journal.species[x.id]) && all > 0 },
  { id: 'legendary', name: 'Legend Found', desc: 'Find a Legendary creature.', test: (s) => owned(s, 'legendary') },
  { id: 'mythical', name: 'Myth Made Real', desc: 'Find a Mythical creature.', test: (s) => owned(s, 'mythical') },
  { id: 'level_10', name: 'Keeper Level 10', desc: 'Reach keeper level 10.', test: (s) => levelOf(s.xp) >= 10 },
  { id: 'level_25', name: 'Keeper Level 25', desc: 'Reach keeper level 25.', test: (s) => levelOf(s.xp) >= 25 },
  { id: 'level_50', name: 'Star Keeper', desc: 'Reach keeper level 50.', test: (s) => levelOf(s.xp) >= 50 },
  { id: 'level_100', name: 'Grand Keeper', desc: 'Reach keeper level 100.', test: (s) => levelOf(s.xp) >= 100 },
  { id: 'friend_1', name: 'Pen Pal', desc: 'Add a friend.', test: (s) => (s.friends?.length ?? 0) >= 1 },
  { id: 'friend_5', name: 'Popular Keeper', desc: 'Add 5 friends.', test: (s) => (s.friends?.length ?? 0) >= 5 },
  { id: 'streak_7', name: 'A Week of Visits', desc: 'Play 7 days in a row.', test: (s) => (s.streak?.best ?? 0) >= 7 },
  { id: 'streak_30', name: 'A Month of Visits', desc: 'Play 30 days in a row.', test: (s) => (s.streak?.best ?? 0) >= 30 },
];

export const LEADERBOARDS = {
  level: { name: 'Keeper level', score: (s: GameState) => levelOf(s.xp) },
  species: { name: 'Creatures discovered', score: (s: GameState) => found(s) },
  streak: { name: 'Best streak', score: (s: GameState) => s.streak?.best ?? 0 },
};
export type BoardId = keyof typeof LEADERBOARDS;

/** Newly earned achievements (and remembers them). */
export function checkAchievements(s: GameState): Achievement[] {
  const got = (s.achieved ??= []);
  const fresh = ACHIEVEMENTS.filter((a) => !got.includes(a.id) && a.test(s));
  got.push(...fresh.map((a) => a.id));
  return fresh;
}

/** Leaderboard scores that went up since we last sent them. */
export function changedScores(s: GameState): [BoardId, number][] {
  const last = (s.boards ??= {});
  const out: [BoardId, number][] = [];
  for (const [id, b] of Object.entries(LEADERBOARDS) as [BoardId, (typeof LEADERBOARDS)[BoardId]][]) {
    const v = b.score(s);
    if (v > (last[id] ?? 0)) { last[id] = v; out.push([id, v]); }
  }
  return out;
}
