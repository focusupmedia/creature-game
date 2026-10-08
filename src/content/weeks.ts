// A year of small weekly events, built into the game. Each week of the year
// has a theme with one bonus and one goal; holidays get a bigger one. They
// rotate by date on their own, so the game feels fresh every week with no
// server. (Halloween season runs alongside, see seasons.ts.)

import type { Trait } from '../core/types';

export type WeekBoost =
  | { kind: 'lure'; trait: Trait }   // lures that attract this habitat bring visitors 1.5x as often
  | { kind: 'lucky' }                // rarer visitors are more likely
  | { kind: 'xp' }                   // 1.5x keeper XP
  | { kind: 'sell' }                 // 1.25x sell prices
  | { kind: 'hatch' }                // eggs laid this week hatch twice as fast
  | { kind: 'hearts' };              // pets make friends twice as fast

export interface WeekGoal { kind: 'lure' | 'arrival' | 'breed' | 'hatch' | 'befriend' | 'feed' | 'sold' | 'trip' | 'digSpot' | 'market'; target: number; text: string }

export interface WeekTheme {
  id: string; name: string; icon: string; blurb: string;
  boost: WeekBoost; boostText: string;
  goal: WeekGoal;
  reward: { coins: number; shards: number; egg?: string };
  big?: boolean;
}

const T = (t: WeekTheme) => t;

export const WEEK_THEMES: Record<string, WeekTheme> = {
  bloom: T({ id: 'bloom', name: 'Bloom Week', icon: '🌸', blurb: 'Flowers everywhere and the bees are busy.', boost: { kind: 'lure', trait: 'Bloom' }, boostText: 'Bloom lures bring visitors 1.5x as often', goal: { kind: 'arrival', target: 8, text: 'Welcome 8 visitors' }, reward: { coins: 600, shards: 10 } }),
  grove: T({ id: 'grove', name: 'Mossy Week', icon: '🌳', blurb: 'The forest is extra green and extra curious.', boost: { kind: 'lure', trait: 'Grove' }, boostText: 'Grove lures bring visitors 1.5x as often', goal: { kind: 'lure', target: 6, text: 'Set out 6 lures' }, reward: { coins: 600, shards: 10 } }),
  tide: T({ id: 'tide', name: 'Splash Week', icon: '💧', blurb: 'Ponds are full and everyone wants a swim.', boost: { kind: 'lure', trait: 'Tide' }, boostText: 'Tide lures bring visitors 1.5x as often', goal: { kind: 'arrival', target: 8, text: 'Welcome 8 visitors' }, reward: { coins: 600, shards: 10 } }),
  mystic: T({ id: 'mystic', name: 'Mystery Week', icon: '🔮', blurb: 'Strange lights in the hollows at night.', boost: { kind: 'lure', trait: 'Mystic' }, boostText: 'Mystic lures bring visitors 1.5x as often', goal: { kind: 'lure', target: 6, text: 'Set out 6 lures' }, reward: { coins: 700, shards: 12 } }),
  ember: T({ id: 'ember', name: 'Ember Week', icon: '🔥', blurb: 'The volcano is warm and cosy.', boost: { kind: 'lure', trait: 'Ember' }, boostText: 'Ember lures bring visitors 1.5x as often', goal: { kind: 'arrival', target: 8, text: 'Welcome 8 visitors' }, reward: { coins: 700, shards: 12 } }),
  reef: T({ id: 'reef', name: 'Coral Week', icon: '🪸', blurb: 'The reef is bright and busy.', boost: { kind: 'lure', trait: 'Reef' }, boostText: 'Reef lures bring visitors 1.5x as often', goal: { kind: 'lure', target: 6, text: 'Set out 6 lures' }, reward: { coins: 700, shards: 12 } }),
  lucky: T({ id: 'lucky', name: 'Lucky Week', icon: '🍀', blurb: 'Rare creatures are wandering closer than usual.', boost: { kind: 'lucky' }, boostText: 'Rarer visitors are more likely', goal: { kind: 'arrival', target: 10, text: 'Welcome 10 visitors' }, reward: { coins: 800, shards: 15 } }),
  growth: T({ id: 'growth', name: 'Keeper Week', icon: '⭐', blurb: 'Everything you do teaches you more.', boost: { kind: 'xp' }, boostText: '1.5x keeper XP', goal: { kind: 'befriend', target: 15, text: 'Pet creatures 15 times' }, reward: { coins: 600, shards: 10 } }),
  market: T({ id: 'market', name: 'Market Week', icon: '🛒', blurb: 'Buyers are in a generous mood.', boost: { kind: 'sell' }, boostText: '1.15x sell prices', goal: { kind: 'sold', target: 5, text: 'Sell 5 creatures' }, reward: { coins: 900, shards: 8 } }),
  nest: T({ id: 'nest', name: 'Nesting Week', icon: '🥚', blurb: 'Eggs feel warm and hurry to hatch.', boost: { kind: 'hatch' }, boostText: 'Eggs laid this week hatch twice as fast', goal: { kind: 'hatch', target: 6, text: 'Hatch 6 eggs' }, reward: { coins: 600, shards: 10, egg: 'wild' } }),
  breed: T({ id: 'breed', name: 'Matchmaker Week', icon: '💞', blurb: 'Love is in the air.', boost: { kind: 'hatch' }, boostText: 'Eggs laid this week hatch twice as fast', goal: { kind: 'breed', target: 5, text: 'Make 5 eggs' }, reward: { coins: 700, shards: 12 } }),
  friends: T({ id: 'friends', name: 'Cuddle Week', icon: '💕', blurb: 'Your pets are extra snuggly.', boost: { kind: 'hearts' }, boostText: 'Pets make friends twice as fast', goal: { kind: 'feed', target: 10, text: 'Feed creatures 10 times' }, reward: { coins: 600, shards: 10 } }),
  explore: T({ id: 'explore', name: 'Explorer Week', icon: '🧭', blurb: 'Adventures are calling.', boost: { kind: 'xp' }, boostText: '1.5x keeper XP', goal: { kind: 'trip', target: 3, text: 'Send pets on 3 trips' }, reward: { coins: 800, shards: 12 } }),
  dig: T({ id: 'dig', name: 'Treasure Week', icon: '💎', blurb: 'Something shiny is buried somewhere.', boost: { kind: 'lucky' }, boostText: 'Rarer visitors are more likely', goal: { kind: 'digSpot', target: 8, text: 'Dig, fish or forage 8 times' }, reward: { coins: 700, shards: 12 } }),
  // holidays: bigger goals and an egg
  newyear: T({ id: 'newyear', name: 'New Year Sparkle', icon: '✨', blurb: 'A fresh year and fresh discoveries.', boost: { kind: 'lucky' }, boostText: 'Rarer visitors are more likely', goal: { kind: 'arrival', target: 12, text: 'Welcome 12 visitors' }, reward: { coins: 1500, shards: 25, egg: 'starry' }, big: true }),
  valentine: T({ id: 'valentine', name: 'Sweetheart Week', icon: '❤', blurb: 'Every pet has a valentine.', boost: { kind: 'hearts' }, boostText: 'Pets make friends twice as fast', goal: { kind: 'breed', target: 6, text: 'Make 6 eggs' }, reward: { coins: 1500, shards: 25, egg: 'starry' }, big: true }),
  spring: T({ id: 'spring', name: 'Spring Festival', icon: '🌱', blurb: 'The first warm days of the year.', boost: { kind: 'lure', trait: 'Bloom' }, boostText: 'Bloom lures bring visitors 1.5x as often', goal: { kind: 'hatch', target: 8, text: 'Hatch 8 eggs' }, reward: { coins: 1500, shards: 25, egg: 'starry' }, big: true }),
  summer: T({ id: 'summer', name: 'Midsummer Beach Party', icon: '🏖', blurb: 'The longest day of the year.', boost: { kind: 'lure', trait: 'Shore' }, boostText: 'Shore lures bring visitors 1.5x as often', goal: { kind: 'arrival', target: 12, text: 'Welcome 12 visitors' }, reward: { coins: 1500, shards: 25, egg: 'starry' }, big: true }),
  harvest: T({ id: 'harvest', name: 'Harvest Feast', icon: '🍓', blurb: 'Baskets of fruit for everyone.', boost: { kind: 'hearts' }, boostText: 'Pets make friends twice as fast', goal: { kind: 'feed', target: 15, text: 'Feed creatures 15 times' }, reward: { coins: 1500, shards: 25, egg: 'starry' }, big: true }),
  winter: T({ id: 'winter', name: 'Snowfall Festival', icon: '❄', blurb: 'Cosy lights and the first snow.', boost: { kind: 'lucky' }, boostText: 'Rarer visitors are more likely', goal: { kind: 'hatch', target: 8, text: 'Hatch 8 eggs' }, reward: { coins: 2000, shards: 30, egg: 'starry' }, big: true }),
};

/** The ordinary weeks of the year cycle through these. */
const CYCLE = ['bloom', 'lucky', 'growth', 'tide', 'nest', 'market', 'grove', 'friends', 'mystic', 'explore', 'reef', 'breed', 'ember', 'dig'];

/** Holiday weeks win over the cycle: [month (1-12), first day, last day, theme]. */
const HOLIDAYS: [number, number, number, string][] = [
  [1, 1, 7, 'newyear'], [2, 10, 16, 'valentine'], [3, 18, 24, 'spring'], [6, 18, 24, 'summer'], [11, 21, 27, 'harvest'], [12, 18, 31, 'winter'],
];

/** Week number in the year (weeks start on Monday, UTC). */
export function weekOfYear(t: number): { year: number; week: number } {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  const jan1 = Date.UTC(new Date(monday).getUTCFullYear(), 0, 1);
  return { year: new Date(monday).getUTCFullYear(), week: Math.floor((monday - jan1) / (7 * 86_400_000)) };
}

/** This week's theme, and a key that changes when the week (or holiday) does. */
export function weekTheme(t: number): { key: string; theme: WeekTheme; endsAt: number } {
  const d = new Date(t);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  for (const [hm, a, b, id] of HOLIDAYS) {
    if (m === hm && day >= a && day <= b) return { key: `${d.getUTCFullYear()}-${id}`, theme: WEEK_THEMES[id], endsAt: Date.UTC(d.getUTCFullYear(), hm - 1, b + 1) };
  }
  const { year, week } = weekOfYear(t);
  const dow = (d.getUTCDay() + 6) % 7;
  const endsAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow + 7);
  return { key: `${year}-w${week}`, theme: WEEK_THEMES[CYCLE[(week + year) % CYCLE.length]], endsAt };
}

/** Bonuses for whatever week it is. */
export function weekBoost(t: number) {
  const b = weekTheme(t).theme.boost;
  return {
    lureTrait: b.kind === 'lure' ? b.trait : null as Trait | null,
    lucky: b.kind === 'lucky',
    xp: b.kind === 'xp' ? 1.5 : 1,
    sell: b.kind === 'sell' ? 1.15 : 1,
    hatch: b.kind === 'hatch' ? 0.5 : 1,
    hearts: b.kind === 'hearts' ? 2 : 1,
  };
}

