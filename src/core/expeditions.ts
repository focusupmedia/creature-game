// Send a pet on an expedition; when it's back, welcome it home for its finds.

import { EXPEDITIONS, expeditionSlots, type ExpeditionId } from '../content/expeditions';
import { ITEMS } from '../content/world';
import { TUNING } from '../content/tuning';
import { displayName, growth } from './creatures';
import { findBonus } from './friendship';
import { levelOf } from './levels';
import { hasQuirk } from './quirks';
import { StateRng } from './rng';
import { layEgg, rollEggTier } from './actions';
import type { GameEvent, GameState } from './types';

const HOUR = 3_600_000;

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

export function awayOnTrip(state: GameState, id: string): boolean {
  return state.expeditions.some((e) => e.creatureId === id);
}

export function sendOnExpedition(state: GameState, creatureId: string, dest: ExpeditionId, t: number): { ok: true; message: string } | Fail {
  const c = state.creatures.find((x) => x.id === creatureId);
  const def = EXPEDITIONS[dest];
  if (!c || !def) return fail('Who?');
  if (c.stored) return fail('Bring it out of storage first.');
  if (awayOnTrip(state, c.id)) return fail(`${displayName(c)} is already exploring.`);
  if (state.visitors.some((v) => v.creature.id === c.id)) return fail('Visitors can\'t go exploring yet.');
  if (levelOf(state.xp) < def.level) return fail(`Reach keeper level ${def.level} to explore the ${def.name}.`);
  if (growth(c, t) < 1) return fail(`${displayName(c)} is too little to go exploring. Let it grow up first.`);
  if (c.fullness < TUNING.hungry) return fail(`${displayName(c)} is too hungry to go. Feed it first!`);
  if (state.expeditions.length >= expeditionSlots(levelOf(state.xp))) return fail('Everyone who can go is already out exploring. More can go as you level up.');
  state.expeditions.push({ creatureId: c.id, dest, start: t, end: t + def.hours * HOUR });
  c.trip = t + def.hours * HOUR;
  return { ok: true, message: `${displayName(c)} set off for the ${def.name}. Back in ${def.hours} hour${def.hours === 1 ? '' : 's'}!` };
}

/** Let the player know when someone is back (once). */
export function stepExpeditions(state: GameState, t: number, out: GameEvent[]): void {
  for (const e of state.expeditions) {
    if (e.end <= t && !e.announced) {
      e.announced = true;
      out.push({ type: 'expeditionBack', creatureId: e.creatureId, dest: e.dest, t });
    }
  }
}

export interface ExpeditionHaul { story: string; coins: number; shards: number; item?: string; egg: boolean }

/** Welcome a pet home and collect what it found. */
export function claimExpedition(state: GameState, creatureId: string, t: number): ({ ok: true } & ExpeditionHaul) | Fail {
  const e = state.expeditions.find((x) => x.creatureId === creatureId);
  if (!e) return fail('Nobody to welcome back.');
  if (t < e.end) return fail('Still exploring!');
  state.expeditions = state.expeditions.filter((x) => x !== e);
  const c = state.creatures.find((x) => x.id === creatureId);
  if (c) c.trip = undefined;
  const def = EXPEDITIONS[e.dest as ExpeditionId];
  if (!c || !def) return { ok: true, story: 'They came home safe.', coins: 0, shards: 0, egg: false };
  const rng = new StateRng(state);
  const boost = (hasQuirk(c, 'explorer') ? 1.5 : 1) * findBonus(c) * (hasQuirk(c, 'lucky') ? 1.2 : 1);
  const coins = Math.round(rng.int(def.coins[0], def.coins[1]) * boost);
  const shards = rng.chance(def.shardChance * (hasQuirk(c, 'lucky') ? 1.5 : 1)) ? rng.int(def.shards[0], def.shards[1]) : 0;
  const item = rng.chance(def.itemChance) ? rng.pick(def.items.filter((i) => ITEMS[i])) : undefined;
  const basketRoom = state.eggs.filter((x) => x.nest === null).length < TUNING.basketSize;
  const egg = basketRoom && rng.chance(def.eggChance);
  state.glimmer += coins;
  state.shards += shards;
  if (item) state.items[item] = (state.items[item] ?? 0) + 1;
  if (egg) layEgg(state, rollEggTier(state, 'starry'), 'gift', t);
  c.fullness = Math.max(0.15, c.fullness - 0.25);
  const story = rng.pick(def.stories).replace('{name}', displayName(c));
  c.history.push({ t, text: story });
  return { ok: true, story, coins, shards, item, egg };
}
