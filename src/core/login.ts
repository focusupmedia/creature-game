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

export function claimLogin(state: GameState, t: number): { ok: true; reward: LoginReward } | { ok: false; error: string } {
  if (!canClaimLogin(state, t)) return { ok: false, error: 'Already claimed today. Come back tomorrow!' };
  const reward = LOGIN_REWARDS[loginDay(state) - 1];
  state.login = { day: today(t), claimed: (state.login?.claimed ?? 0) + 1 };
  state.glimmer += reward.coins;
  state.shards += reward.shards;
  if (reward.egg) {
    if (state.eggs.filter((e) => e.nest === null).length < TUNING.basketSize) layEgg(state, rollEggTier(state, 'starry'), 'shop', t).tier = 'starry';
    else state.shards += Math.round(EGG_TIERS.starry.price / 2);
  }
  return { ok: true, reward };
}
