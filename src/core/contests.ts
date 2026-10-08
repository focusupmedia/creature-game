// Weekly pet contests. Each week has a theme; enter one pet and it's judged
// against other keepers' pets. When the week ends, collect a prize for where
// you placed. Scores are fixed when you enter, so nothing can go wrong later.

import { species } from '../content/species';
import { SHADES, type ShadeId } from '../content/shades';
import { MUTATIONS } from '../content/world';
import { displayName, growth } from './creatures';
import { hearts } from './friendship';
import type { Creature, GameState } from './types';

const DAY = 86_400_000;
/** Weeks start on Monday (1970-01-05 was a Monday). */
const MONDAY = Date.UTC(1970, 0, 5);

export type ContestTheme = 'big' | 'tiny' | 'rare' | 'sparkly' | 'shade' | 'friend';

export const THEMES: Record<ContestTheme, { name: string; icon: string; blurb: string }> = {
  big: { name: 'Biggest Pet', icon: '⛰️', blurb: 'The judges want size! Colossal pets shine here.' },
  tiny: { name: 'Tiniest Pet', icon: '🐜', blurb: 'Small is beautiful. Teeny pets win hearts.' },
  rare: { name: 'Rarest Pet', icon: '💎', blurb: 'Legendary and Mythical pets impress the judges.' },
  sparkly: { name: 'Most Sparkly', icon: '✨', blurb: 'Mutations, the rarer the better!' },
  shade: { name: 'Prettiest Shade', icon: '🎨', blurb: 'Pastel and Shiny pets turn heads.' },
  friend: { name: 'Best Friends', icon: '💞', blurb: 'The pet that loves you most wins.' },
};
const ORDER = Object.keys(THEMES) as ContestTheme[];

export const PRIZES = [
  { place: 1, coins: 1500, shards: 20 },
  { place: 2, coins: 800, shards: 10 },
  { place: 3, coins: 500, shards: 6 },
];
export const ENTRY_PRIZE = { coins: 150, shards: 1 };

const RIVALS = ['Pip\'s Puffball', 'Old Bramble\'s Toad', 'Marigold\'s Moth', 'The Duchess\'s Drake', 'Juniper\'s Bun', 'Captain Kelp\'s Crab', 'Wren\'s Little Wisp'];

export function weekOf(t: number): number {
  return Math.floor((t - MONDAY) / (7 * DAY));
}

export function themeOf(week: number): ContestTheme {
  return ORDER[((week % ORDER.length) + ORDER.length) % ORDER.length];
}

/** When this week's contest is judged. */
export function weekEnds(week: number): number {
  return MONDAY + (week + 1) * 7 * DAY;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

/** How well a pet fits the theme (0-100), plus a little judge's flair. */
export function scorePet(c: Creature, theme: ContestTheme, week: number): number {
  let base: number;
  switch (theme) {
    case 'big': base = (Math.min(2.7, c.size) / 2.7) * 100; break;
    case 'tiny': base = Math.min(100, (0.32 / Math.max(0.3, c.size)) * 100); break;
    case 'rare': base = { common: 20, uncommon: 40, rare: 65, legendary: 85, mythical: 100 }[species(c.species).rarity]; break;
    case 'sparkly': base = Math.min(100, c.mutations.reduce((s, m) => s + ({ common: 15, rare: 22, epic: 32, legendary: 40 }[MUTATIONS[m].tier] ?? 15), 0)); break;
    case 'shade': base = { common: 35, rare: 75, shiny: 100 }[SHADES[(c.shade ?? 'classic') as ShadeId]?.tier ?? 'common'] - (c.shade === 'classic' || !c.shade ? 20 : 0); break;
    default: base = (hearts(c) / 5) * 100;
  }
  const flair = (hash(`${week}:${c.id}`) - 0.5) * 16;
  return Math.max(0, Math.min(100, Math.round(base + flair)));
}

export function rivals(week: number): { name: string; score: number }[] {
  return RIVALS.map((name, i) => ({ name, score: Math.round(30 + hash(`${week}:rival:${i}`) * 62) }));
}

/** Where a score would place this week (1 = winner). */
export function placeFor(score: number, week: number): number {
  return 1 + rivals(week).filter((r) => r.score > score).length;
}

type Fail = { ok: false; error: string };

export function enterContest(state: GameState, creatureId: string, t: number): { ok: true; score: number; message: string } | Fail {
  const week = weekOf(t);
  const c = state.creatures.find((x) => x.id === creatureId);
  if (!c) return { ok: false, error: 'Who?' };
  if (growth(c, t) < 1) return { ok: false, error: 'Only grown-up pets can enter.' };
  if (state.contest?.week === week && state.contest.entry) return { ok: false, error: 'You\'ve already entered a pet this week.' };
  if (contestReady(state, t)) return { ok: false, error: 'Collect last week\'s prize first!' };
  const score = scorePet(c, themeOf(week), week);
  state.contest = { week, entry: c.id, name: displayName(c), species: c.species, score, claimed: false };
  return { ok: true, score, message: `${displayName(c)} is entered in ${THEMES[themeOf(week)].name}! The judges gave ${score} points. Results when the week ends.` };
}

/** Last week's results are in: collect the prize. */
export function claimContest(state: GameState, t: number): { ok: true; place: number; coins: number; shards: number } | Fail {
  const c = state.contest;
  if (!c?.entry || c.claimed) return { ok: false, error: 'Nothing to collect.' };
  if (weekOf(t) <= c.week) return { ok: false, error: 'The judges are still deciding. Results when the week ends.' };
  const place = placeFor(c.score ?? 0, c.week);
  const prize = PRIZES.find((p) => p.place === place) ?? ENTRY_PRIZE;
  state.glimmer += prize.coins;
  state.shards += prize.shards;
  c.claimed = true;
  if (place <= 3) state.trophies = (state.trophies ?? 0) + 1;
  return { ok: true, place, coins: prize.coins, shards: prize.shards };
}

export function contestReady(state: GameState, t: number): boolean {
  return !!state.contest?.entry && !state.contest.claimed && weekOf(t) > state.contest.week;
}
