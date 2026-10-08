// Daily login calendar: a gift for each day you visit, growing through the
// week, with a big one on day 7. Missing a day never resets it: the calendar
// simply waits for you (it's a cozy game).

import { EGG_TIERS } from '../content/world';
import { TUNING } from '../content/tuning';
import { layEgg, rollEggTier } from './actions';
import { today } from './quests';
import type { GameState } from './types';

export interface LoginReward { day: number; coins: number; shards: number; egg?: boolean; text: string }

export const LOGIN_REWARDS: LoginReward[] = [
  { day: 1, coins: 150, shards: 2, text: '150 coins and 2 Starshards' },
  { day: 2, coins: 200, shards: 2, text: '200 coins and 2 Starshards' },
  { day: 3, coins: 250, shards: 3, text: '250 coins and 3 Starshards' },
  { day: 4, coins: 300, shards: 3, text: '300 coins and 3 Starshards' },
  { day: 5, coins: 400, shards: 5, text: '400 coins and 5 Starshards' },
  { day: 6, coins: 500, shards: 5, text: '500 coins and 5 Starshards' },
  { day: 7, coins: 1000, shards: 15, egg: true, text: '1,000 coins, 15 Starshards and a Starry Egg' },
];

/** Which day of the calendar is next (1-7). */
export function loginDay(state: GameState): number {
  return ((state.login?.claimed ?? 0) % 7) + 1;
}

export function canClaimLogin(state: GameState, t: number): boolean {
  return state.login?.day !== today(t);
}

/** Streak milestones: a bigger present on these days in a row. */
export const STREAK_MILESTONES: Record<number, { coins: number; shards: number; text: string }> = {
  3: { coins: 300, shards: 5, text: '3 days in a row!' },
  7: { coins: 800, shards: 15, text: 'A whole week in a row!' },
  14: { coins: 1500, shards: 25, text: 'Two weeks in a row!' },
  30: { coins: 3000, shards: 50, text: 'A month in a row!' },
  60: { coins: 5000, shards: 80, text: 'Two months in a row!' },
  100: { coins: 10000, shards: 150, text: '100 days in a row!' },
};

/** What today's streak bonus adds on top of the calendar gift (it grows each day, up to 30). */
export function streakBonus(count: number): { coins: number; shards: number } {
  const n = Math.min(30, count);
  return { coins: n * 20, shards: Math.floor(n / 3) };
}

/** Days in a row. One missed day is forgiven each week (Lotl keeps it warm). */
export function streakNow(state: GameState, t: number): { count: number; best: number; shield: number; alive: boolean } {
  const s = state.streak;
  if (!s) return { count: 0, best: 0, shield: 1, alive: false };
  const gap = Math.round((Date.parse(today(t)) - Date.parse(s.day)) / 86_400_000);
  return { count: s.count, best: s.best, shield: s.shield, alive: gap <= 1 || (gap === 2 && s.shield > 0) };
}

function bumpStreak(state: GameState, t: number): { count: number; saved: boolean; milestone?: { coins: number; shards: number; text: string } } {
  const day = today(t);
  const s = state.streak;
  let count = 1;
  let saved = false;
  let shield = s?.shield ?? 1;
  if (s) {
    const gap = Math.round((Date.parse(day) - Date.parse(s.day)) / 86_400_000);
    if (gap <= 1) count = s.count + 1;
    else if (gap === 2 && shield > 0) { count = s.count + 1; shield -= 1; saved = true; }
  }
  if (count % 7 === 0) shield = Math.min(1, shield + 1);
  state.streak = { day, count, best: Math.max(count, s?.best ?? 0), shield };
  return { count, saved, milestone: STREAK_MILESTONES[count] };
}

export function claimLogin(state: GameState, t: number): { ok: true; reward: LoginReward; streak: { count: number; saved: boolean; bonus: { coins: number; shards: number }; milestone?: { coins: number; shards: number; text: string } } } | { ok: false; error: string } {
  if (!canClaimLogin(state, t)) return { ok: false, error: 'Already claimed today. Come back tomorrow!' };
  const reward = LOGIN_REWARDS[loginDay(state) - 1];
  const st = bumpStreak(state, t);
  const bonus = streakBonus(st.count);
  state.glimmer += bonus.coins + (st.milestone?.coins ?? 0);
  state.shards += bonus.shards + (st.milestone?.shards ?? 0);
  state.login = { day: today(t), claimed: (state.login?.claimed ?? 0) + 1 };
  state.glimmer += reward.coins;
  state.shards += reward.shards;
  if (reward.egg) {
    if (state.eggs.filter((e) => e.nest === null && !e.nurseryId).length < TUNING.basketSize) layEgg(state, rollEggTier(state, 'starry'), 'shop', t).tier = 'starry';
    else state.shards += Math.round(EGG_TIERS.starry.price / 2);
  }
  return { ok: true, reward, streak: { ...st, bonus } };
}
