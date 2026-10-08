// Buttons appear one at a time as a new keeper progresses, so the first
// session isn't a wall of buttons. Each new one gets a little "New!" moment.
// Keepers who already have a button never lose it.

import { inHalloween } from '../content/seasons';
import { buyableWorlds } from '../core/actions';
import { levelOf } from '../core/levels';
import type { GameState } from '../core/types';

export type FeatureId = 'journal' | 'shop' | 'quests' | 'decor' | 'pass' | 'event' | 'worlds' | 'friends';

export interface Feature { id: FeatureId; name: string; intro: string; when: (s: GameState, t: number) => boolean }

const lv = (s: GameState) => levelOf(s.xp);

export const FEATURES: Feature[] = [
  { id: 'journal', name: 'JOURNAL', intro: 'Everything you find goes in here.', when: (s) => s.stats.hatches >= 1 },
  { id: 'shop', name: 'SHOP', intro: 'Mango sells lures, eggs, food and more.', when: (s) => (s.starter?.step ?? 0) >= 1 || !!s.starter?.done || lv(s) >= 3 },
  { id: 'quests', name: 'QUESTS', intro: 'Daily goals with prizes, a weekly event and Lotl\'s rumours.', when: (s) => lv(s) >= 2 },
  { id: 'decor', name: 'DECOR', intro: 'Make your island yours. Hold a decoration to move it.', when: (s) => lv(s) >= 3 },
  { id: 'pass', name: 'HALLOWEEN PASS', intro: 'Play to earn Candy and unlock spooky rewards.', when: (s, t) => lv(s) >= 3 && inHalloween(t) },
  { id: 'event', name: 'SKY EVENTS', intro: 'Summon a sky event. Storms and moons can change your pets!', when: (s) => lv(s) >= 4 },
  { id: 'worlds', name: 'WORLDS', intro: 'Travel to new islands full of new creatures.', when: (s) => lv(s) >= 4 || buyableWorlds(s).length > 0 || Object.values(s.islands).filter((i) => i?.owned).length > 1 },
  { id: 'friends', name: 'FRIENDS', intro: 'Swap codes with friends, visit their groves and get daily gifts.', when: (s) => lv(s) >= 5 },
];

export function featureOn(s: GameState, id: FeatureId, t: number): boolean {
  if (id === 'pass' && !inHalloween(t)) return false;
  return (s.features ?? []).includes(id);
}

/** Turn on anything newly earned. Returns the ones to announce (none before the tutorial ends, none the first time an older save loads). */
export function unlockFeatures(s: GameState, t: number): Feature[] {
  const first = s.features === undefined;
  const list = (s.features ??= []);
  const fresh = FEATURES.filter((f) => !list.includes(f.id) && f.when(s, t));
  list.push(...fresh.map((f) => f.id));
  // an older save (tutorial long done) gets everything it has earned, quietly
  if (first && s.tutorial >= 6) return [];
  return s.tutorial >= 6 ? fresh.filter((f) => f.id !== 'journal') : [];
}
