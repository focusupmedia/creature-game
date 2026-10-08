// This week's mini-event (content/weeks.ts): its bonus, and the goal that pays out.

import { weekTheme, type WeekTheme } from '../content/weeks';
export { weekBoost } from '../content/weeks';
import { layEgg, rollEggTier } from './actions';
import type { PlayEvent } from './progress';
import type { GameState } from './types';

export function weekState(state: GameState, t: number): { key: string; theme: WeekTheme; endsAt: number; progress: number; claimed: boolean } {
  const w = weekTheme(t);
  if (state.week?.key !== w.key) state.week = { key: w.key, progress: 0, claimed: false };
  return { ...w, progress: state.week.progress, claimed: state.week.claimed };
}

export function weekEvent(state: GameState, ev: PlayEvent, t: number): boolean {
  const w = weekState(state, t);
  if (w.claimed || ev.kind !== w.theme.goal.kind || w.progress >= w.theme.goal.target) return false;
  state.week!.progress += ev.kind === 'sold' ? (ev.count ?? 1) : 1;
  return state.week!.progress >= w.theme.goal.target;
}

export function claimWeek(state: GameState, t: number): boolean {
  const w = weekState(state, t);
  if (w.claimed || w.progress < w.theme.goal.target) return false;
  state.week!.claimed = true;
  state.glimmer += w.theme.reward.coins;
  state.shards += w.theme.reward.shards;
  if (w.theme.reward.egg) layEgg(state, rollEggTier(state, w.theme.reward.egg), 'shop', t).tier = w.theme.reward.egg;
  return true;
}
