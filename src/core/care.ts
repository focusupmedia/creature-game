// Looking after creatures: gentle hunger, food, storage, selling and the
// travelling Collector. Hunger is slow (about 10 hours from full to empty);
// hungry creatures get grumpy and won't dig or breed, but never leave.

import { species } from '../content/species';
import { FOODS, MUTATIONS } from '../content/world';
import { ISLAND_ORDER } from '../content/islands';
import { TUNING } from '../content/tuning';
import { displayName, isOutlier } from './creatures';
import { StateRng } from './rng';
import type { Creature, GameEvent, GameState, IslandId, Rarity, Trait } from './types';

const MIN = 60_000;
const HOUR = 60 * MIN;

type Result = { ok: true; message: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export function isHungry(c: Pick<Creature, 'fullness'>): boolean {
  return c.fullness < TUNING.hungry;
}

/** Runs inside the sim step: hunger drains, feedbags refill, the Collector comes and goes. */
export function stepCare(state: GameState, t: number, dt: number, rng: StateRng, out: GameEvent[]): void {
  const drain = dt / (TUNING.hungerHours * HOUR);
  for (const c of state.creatures) {
    if (c.stored) continue;
    c.fullness = Math.max(0, (c.fullness ?? 1) - drain);
    const bag = state.feedbags[c.island] ?? 0;
    if (bag > 0 && c.fullness < 0.45) {
      state.feedbags[c.island] = bag - 1;
      c.fullness = Math.min(1, c.fullness + 0.5);
    }
  }
  const col = state.collector;
  if (col.until && t >= col.until) {
    col.until = 0;
    col.nextAt = t + TUNING.collectorEveryHours * HOUR * (0.75 + rng.next() * 0.5);
  } else if (!col.until && t >= col.nextAt) {
    col.until = t + TUNING.collectorStayMin * MIN;
    col.wants = rng.pick<Trait>(['Grove', 'Tide', 'Bloom', 'Mystic', 'Ember', 'Reef', 'Sand', 'Shore', 'Bird', 'Reptile', 'Mammal', 'Insect', 'Fish', 'Primate']);
    out.push({ type: 'collector', wants: col.wants, until: col.until, t });
  }
}

export function collectorHere(state: GameState, t: number): boolean {
  return state.collector.until > t;
}

// ---------------------------------------------------------------- feeding

/** Feed one creature from the pantry: Berries first, then Snacks. */
export function feedCreature(state: GameState, id: string): Result {
  const c = state.creatures.find((x) => x.id === id);
  if (!c) return fail('Who?');
  if (c.fullness >= 0.98) return fail(`${displayName(c)} is full!`);
  const food = (state.food.fruit ?? 0) > 0 ? 'fruit' : (state.food.snack ?? 0) > 0 ? 'snack' : null;
  if (!food) return fail('Your pantry is empty. Pick berries from a Berry Tree or buy snacks from Mango.');
  state.food[food] -= 1;
  c.fullness = Math.min(1, c.fullness + FOODS[food].amount);
  return { ok: true, message: `${displayName(c)} munched a ${FOODS[food].name}. Yum!` };
}

/** A Feast Basket feeds everyone on an island. */
export function feastIsland(state: GameState, island: IslandId): Result {
  if ((state.food.feast ?? 0) < 1) return fail('You need a Feast Basket from Mango.');
  const fed = state.creatures.filter((c) => c.island === island && !c.stored);
  if (!fed.length) return fail('Nobody lives here yet.');
  state.food.feast -= 1;
  for (const c of fed) c.fullness = Math.min(1, c.fullness + FOODS.feast.amount);
  return { ok: true, message: `A feast! ${fed.length} creatures ate their fill.` };
}

/** Hang a Feedbag on an island: portions feed hungry creatures there, even while you're away. */
export function hangFeedbag(state: GameState, island: IslandId): Result {
  if ((state.food.feedbag ?? 0) < 1) return fail('You need a Feedbag from Mango.');
  state.food.feedbag -= 1;
  state.feedbags[island] = (state.feedbags[island] ?? 0) + FOODS.feedbag.amount;
  return { ok: true, message: `Feedbag hung: ${state.feedbags[island]} portions ready.` };
}

/** Berries waiting on a Berry Tree. */
export function ripeFruit(harvestedAt: number | undefined, t: number): number {
  if (harvestedAt === undefined) return 0;
  return Math.min(TUNING.fruitMax, Math.floor((t - harvestedAt) / (TUNING.fruitEveryMin * MIN)));
}

export function harvestTree(state: GameState, decorId: string, t: number): Result {
  const d = state.placedDecor.find((x) => x.id === decorId && x.decor === 'fruittree');
  if (!d) return fail('That tree is gone.');
  const n = ripeFruit(d.harvestedAt ?? t, t);
  if (!n) return fail('No berries yet. Check back soon!');
  // keep the time already spent growing the next one
  d.harvestedAt = (d.harvestedAt ?? t) + n * TUNING.fruitEveryMin * MIN;
  if (n >= TUNING.fruitMax) d.harvestedAt = t;
  state.food.fruit = (state.food.fruit ?? 0) + n;
  return { ok: true, message: `Picked ${n} ${n === 1 ? 'berry' : 'berries'}!` };
}

// ---------------------------------------------------------------- storage

export function storedCount(state: GameState): number {
  return state.creatures.filter((c) => c.stored).length;
}

/** Stored creatures pause: no hunger and no growing up. */
export function storeCreature(state: GameState, id: string, t: number): Result {
  const c = state.creatures.find((x) => x.id === id);
  if (!c) return fail('Who?');
  if (c.stored) return fail('Already in storage.');
  if (storedCount(state) >= state.storageSlots) return fail('Storage is full. Buy another slot, or bring someone back.');
  if (state.creatures.filter((x) => !x.stored).length <= 2) return fail('Keep at least two creatures out on your islands.');
  c.stored = true;
  c.storedAt = t;
  return { ok: true, message: `${displayName(c)} is resting in storage.` };
}

export function retrieveCreature(state: GameState, id: string, island: IslandId, t: number, capacity: number): Result {
  const c = state.creatures.find((x) => x.id === id);
  if (!c?.stored) return fail('Not in storage.');
  const pop = state.creatures.filter((x) => x.island === island && !x.stored).length;
  if (pop >= capacity) return fail('That island is full.');
  // the time spent in storage doesn't count toward growing up
  if (c.growMs && c.storedAt) c.bornAt += t - c.storedAt;
  c.stored = false;
  c.storedAt = undefined;
  c.island = island;
  return { ok: true, message: `${displayName(c)} is back!` };
}

export function nextSlotPrice(state: GameState): number | null {
  const i = state.storageSlots - TUNING.storageBase;
  return TUNING.storageSlotPrice[i] ?? null;
}

export function buyStorageSlot(state: GameState): Result {
  const price = nextSlotPrice(state);
  if (price === null) return fail('Storage is as big as it gets.');
  if (state.glimmer < price) return fail('Not enough coins.');
  state.glimmer -= price;
  state.storageSlots += 1;
  return { ok: true, message: `Storage now holds ${state.storageSlots}.` };
}

// ---------------------------------------------------------------- selling

const BASE: Record<Rarity, number> = { common: 40, uncommon: 90, rare: 220, legendary: 600, mythical: 1500 };

export function canSell(state: GameState, c: Creature): string | null {
  if (c.favorite) return 'Favourites can\'t be sold. Unmark it first.';
  if (species(c.species).origin === 'reward') return 'Level gifts can\'t be sold.';
  if (state.creatures.filter((x) => !x.stored && x.id !== c.id).length < 2) return 'Keep at least two creatures.';
  return null;
}

/** Price = rarity × size × mutations; the Collector pays double, triple for the type he wants. */
export function sellPrice(state: GameState, c: Creature, toCollector: boolean): number {
  const sp = species(c.species);
  let p = BASE[sp.rarity];
  p *= 0.8 + Math.min(2.7, c.size) * 0.25;
  if (isOutlier(c.size)) p *= 1.5;
  for (const m of c.mutations) p *= MUTATIONS[m].tier === 'legendary' ? 3 : MUTATIONS[m].tier === 'epic' ? 2 : 1.4;
  if (toCollector) p *= sp.traits.includes(state.collector.wants) ? 3 : 2;
  return Math.max(5, Math.round(p / 5) * 5);
}

export function sellCreature(state: GameState, id: string, t: number): Result {
  const c = state.creatures.find((x) => x.id === id);
  if (!c) return fail('Who?');
  const why = canSell(state, c);
  if (why) return fail(why);
  const collector = collectorHere(state, t);
  const price = sellPrice(state, c, collector);
  state.creatures = state.creatures.filter((x) => x !== c);
  state.glimmer += price;
  return { ok: true, message: `${displayName(c)} went to ${collector ? 'the Collector' : 'a new home'} for ${price} coins.` };
}

/** When the first creature on the islands will get hungry (for a reminder). */
export function nextHungryAt(state: GameState, t: number): number | null {
  let soonest: number | null = null;
  for (const c of state.creatures) {
    if (c.stored || ISLAND_ORDER.indexOf(c.island) < 0) continue;
    const left = c.fullness - TUNING.hungry;
    if (left <= 0) continue;
    const at = t + (left * TUNING.hungerHours * HOUR);
    if (soonest === null || at < soonest) soonest = at;
  }
  return soonest;
}
