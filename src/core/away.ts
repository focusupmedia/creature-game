// Coming back is worth it: an away chest that fills while you're gone (up to
// 12 hours; an ad doubles it), and a "we missed you" gift after a day or more.
// Presents your pets find while you're away live in care.ts (awayFinds).

import { ITEMS } from '../content/world';
import { levelOf } from './levels';
import { layEgg, rollEggTier } from './actions';
import { StateRng } from './rng';
import { TUNING } from '../content/tuning';
import type { GameState } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface AwayChest { coins: number; shards: number; items: Record<string, number>; hours: number }

/** How long you need to be away before the chest has anything in it. */
export const CHEST_MIN_MS = 30 * 60_000;
export const CHEST_MAX_HOURS = 12;

/** Fill the chest for an absence (it waits in the state until you open it). */
export function fillAwayChest(state: GameState, awayMs: number): AwayChest | null {
  if (awayMs < CHEST_MIN_MS) return null;
  const hours = Math.min(CHEST_MAX_HOURS, awayMs / HOUR);
  const rng = new StateRng(state);
  const lvl = levelOf(state.xp);
  const prev = state.awayChest;
  const coins = Math.round(((60 + lvl * 20) * Math.pow(hours, 0.85)) / 5) * 5;
  const shards = Math.floor(hours / 3) + (hours >= 8 ? 3 : 0);
  const items: Record<string, number> = { ...(prev?.items ?? {}) };
  if (hours >= 4) {
    const pool = Object.keys(ITEMS);
    const it = rng.pick(pool);
    items[it] = (items[it] ?? 0) + 1;
  }
  if (hours >= 8) items.snack = (items.snack ?? 0) + 3;
  // an unopened chest keeps what was in it (but never more than a full one's worth)
  const chest: AwayChest = {
    coins: Math.min((prev?.coins ?? 0) + coins, Math.round((60 + lvl * 20) * Math.pow(CHEST_MAX_HOURS, 0.85) * 1.5)),
    shards: Math.min((prev?.shards ?? 0) + shards, 12),
    items,
    hours: Math.min(CHEST_MAX_HOURS, (prev?.hours ?? 0) + hours),
  };
  state.awayChest = chest;
  return chest;
}

/** Open the chest; an ad doubles the coins and Starshards. */
export function openAwayChest(state: GameState, doubled: boolean): AwayChest | null {
  const c = state.awayChest;
  if (!c) return null;
  const k = doubled ? 2 : 1;
  state.glimmer += c.coins * k;
  state.shards += c.shards * k;
  for (const [id, n] of Object.entries(c.items)) {
    if (id === 'snack') state.food.snack = (state.food.snack ?? 0) + n;
    else state.items[id] = (state.items[id] ?? 0) + n;
  }
  state.awayChest = null;
  return { ...c, coins: c.coins * k, shards: c.shards * k };
}

export interface WelcomeGift { days: number; coins: number; shards: number; charm: boolean; egg: boolean; text: string }

/** Away a day or more: a "we missed you" gift with something rare in it. */
export function welcomeBackGift(state: GameState, awayMs: number, t: number): WelcomeGift | null {
  if (awayMs < DAY) return null;
  const days = Math.floor(awayMs / DAY);
  const lvl = levelOf(state.xp);
  const big = days >= 3;
  const gift: WelcomeGift = {
    days,
    coins: Math.round(((big ? 1500 : 500) + lvl * (big ? 60 : 30)) / 10) * 10,
    shards: big ? 40 : 15,
    charm: true,
    egg: big && state.eggs.filter((e) => e.nest === null).length < TUNING.basketSize,
    text: big ? 'You were gone a while! Everyone saved up a big welcome-home gift.' : 'We missed you! Here\'s a little something to say welcome back.',
  };
  state.glimmer += gift.coins;
  state.shards += gift.shards;
  state.charms ??= {};
  state.charms.wildcharm = (state.charms.wildcharm ?? 0) + 1;
  if (gift.egg) layEgg(state, rollEggTier(state, 'starry'), 'gift', t);
  return gift;
}
