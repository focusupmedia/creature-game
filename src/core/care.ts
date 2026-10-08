// Looking after creatures: gentle hunger, food, storage, selling and the
// travelling Collector. Hunger is slow (about 10 hours from full to empty);
// hungry creatures get grumpy and won't dig or breed, but never leave.

import { species } from '../content/species';
import { FOODS, MUTATIONS } from '../content/world';
import { ISLAND_ORDER, islandGeo, randomLand } from '../content/islands';
import { TUNING } from '../content/tuning';
import { displayName, growth, isOutlier, newId } from './creatures';
import { today } from './quests';
import { hasQuirk } from './quirks';
import { addBond, hearts, isBestFriend } from './friendship';
import { StateRng } from './rng';
import { layEgg, rollEggTier } from './actions';
import type { Creature, GameEvent, GameState, Gift, IslandId, Rarity, Trait } from './types';

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
  // a Musical pet out on a world cheers everyone there up: they get hungry a bit slower
  const music = new Set(state.creatures.filter((c) => !c.stored && !c.trip && hasQuirk(c, 'musical')).map((c) => c.island));
  for (const c of state.creatures) {
    if (c.stored) continue;
    const rate = (hasQuirk(c, 'hearty') ? 0.5 : 1) * (music.has(c.island) ? 0.85 : 1) * (isBestFriend(c) ? 0.7 : 1);
    c.fullness = Math.max(0, (c.fullness ?? 1) - drain * rate);
    const bag = state.feedbags[c.island] ?? 0;
    if (bag > 0 && c.fullness < 0.45) {
      state.feedbags[c.island] = bag - 1;
      c.fullness = Math.min(1, c.fullness + 0.5);
    }
  }
  // good friends (3+ hearts) now and then leave a little gift while you play
  for (const c of state.creatures) {
    if (c.stored || c.trip || hearts(c) < 3 || !state.islands[c.island]?.owned || state.gifts.length >= TUNING.maxGiftsOnGround) continue;
    if (!rng.chance((dt / HOUR) * 0.25)) continue;
    const p = randomLand(islandGeo(c.island, state.islands[c.island].size), () => rng.next());
    const gift: Gift = { id: newId(state, 'g'), x: p.x, z: p.z, glimmer: rng.int(8, 20) * hearts(c), shards: 0, island: c.island, from: c.id };
    state.gifts.push(gift);
    out.push({ type: 'gift', gift, t });
  }
  // best friends leave you a little present once a day, somewhere on their world
  const day = today(t);
  for (const c of state.creatures) {
    if (c.stored || c.trip || !isBestFriend(c) || c.bfGiftDay === day || !state.islands[c.island]?.owned) continue;
    c.bfGiftDay = day;
    const p = randomLand(islandGeo(c.island, state.islands[c.island].size), () => rng.next());
    const gift: Gift = { id: newId(state, 'g'), x: p.x, z: p.z, glimmer: rng.int(30, 60), shards: rng.chance(0.25) ? 2 : 0, island: c.island, from: c.id };
    state.gifts.push(gift);
    out.push({ type: 'gift', gift, t });
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
  // feeding by hand makes friends
  const r = addBond(c, 2, state);
  return { ok: true, message: `${displayName(c)} munched a ${FOODS[food].name}. Yum!${r.newHeart ? ` Friendship grew to ${hearts(c)} hearts!` : ''}${r.golden ? ' So much love turned it Golden! ✨' : ''}` };
}

/** A Sprout Snack: a growing pet skips part of its growing time (and enjoys a little snack). */
export function feedSprout(state: GameState, id: string, t: number): Result {
  const c = state.creatures.find((x) => x.id === id);
  if (!c) return fail('Who?');
  if (growth(c, t) >= 1) return fail(`${displayName(c)} is all grown up.`);
  if ((state.food.sprout ?? 0) < 1) return fail('You need a Sprout Snack from Mango (FOOD tab).');
  state.food.sprout -= 1;
  c.growBoostMs = (c.growBoostMs ?? 0) + c.growMs * TUNING.sproutShare;
  c.fullness = Math.min(1, c.fullness + FOODS.sprout.amount);
  addBond(c, 2, state);
  return { ok: true, message: growth(c, t) >= 1 ? `${displayName(c)} gobbled it up and is all grown up!` : `${displayName(c)} gobbled it up and shot up a little!` };
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
  if (c.trip) return fail('It\'s away exploring. Welcome it home first.');
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

const BASE: Record<Rarity, number> = { common: 15, uncommon: 35, rare: 100, legendary: 350, mythical: 900 };
/** Each mutation multiplies the price; rarer changes multiply more. */
const MUT_MULT: Record<string, number> = { common: 1.3, rare: 1.6, epic: 2.2, legendary: 3.2 };
const SHADE_MULT: Record<string, number> = { classic: 1, shiny: 3, pastel: 1.5 };

export function canSell(state: GameState, c: Creature): string | null {
  if (c.trip) return 'It\'s away exploring.';
  if (c.favorite) return 'Favorites can\'t be sold. Unmark it first.';
  if (state.creatures.filter((x) => !x.stored && x.id !== c.id).length < 2) return 'Keep at least two creatures.';
  return null;
}

/**
 * Price = rarity × size × mutations × shade. Bigger pets are worth a lot more
 * (a Colossal one several times an average one, and Giant on top of that), and
 * every mutation multiplies the price, so a well-bred pet is a real prize.
 * The Collector pays double, triple for the type he wants.
 */
export interface SellLine { label: string; mult: number; kind: 'base' | 'size' | 'mutation' | 'shade' | 'buyer'; tier?: string }

/** How a sell price is made, line by line: the base, then each multiplier. */
export function sellBreakdown(state: GameState, c: Creature, toCollector: boolean): { lines: SellLine[]; price: number } {
  const sp = species(c.species);
  const lines: SellLine[] = [{ label: `${sp.rarity[0].toUpperCase()}${sp.rarity.slice(1)} ${sp.name}`, mult: BASE[sp.rarity], kind: 'base' }];
  const size = Math.min(4.5, c.size * (c.mutations.includes('giant') ? 1.6 : 1));
  lines.push({ label: 'Size', mult: 0.6 + 0.4 * size * size, kind: 'size' });
  if (isOutlier(c.size)) lines.push({ label: c.size > 1 ? 'Colossal' : 'Teeny', mult: 1.6, kind: 'size' });
  // mutations: rarer ones multiply more (all together capped at x15)
  let left = 15;
  for (const id of c.mutations) {
    const m = MUTATIONS[id];
    const x = Math.min(left, MUT_MULT[m.tier] ?? 1);
    left /= x;
    lines.push({ label: m.name, mult: x, kind: 'mutation', tier: m.tier });
  }
  const shade = SHADE_MULT[c.shade ?? 'classic'] ?? 1.1;
  if (shade !== 1) lines.push({ label: `${(c.shade ?? 'classic')[0].toUpperCase()}${(c.shade ?? 'classic').slice(1)} color`, mult: shade, kind: 'shade' });
  if (toCollector) lines.push({ label: sp.traits.includes(state.collector.wants) ? `Collector (wants ${state.collector.wants})` : 'Collector', mult: sp.traits.includes(state.collector.wants) ? 3 : 2, kind: 'buyer' });
  // a Haggler out on the same world talks the price up
  if (state.creatures.some((x) => !x.stored && !x.trip && x.island === c.island && hasQuirk(x, 'haggler'))) lines.push({ label: 'Haggler nearby', mult: 1.1, kind: 'buyer' });
  const p = lines.reduce((a, l) => a * l.mult, 1);
  return { lines, price: Math.max(5, Math.round(p / 5) * 5) };
}

export function sellPrice(state: GameState, c: Creature, toCollector: boolean): number {
  return sellBreakdown(state, c, toCollector).price;
}

/** All of a creature's mutations together, as one sell multiplier. */
export function mutationMultiplier(c: Creature): number {
  return Math.min(15, c.mutations.reduce((m, id) => m * (MUT_MULT[MUTATIONS[id].tier] ?? 1), 1));
}

/** Pets worth a second thought before selling: Legendary and up, and one-of-a-kind level gifts. */
export function sellWarning(c: Creature): string | null {
  const sp = species(c.species);
  if (sp.origin === 'reward') return `${sp.name} was a level gift. You can't get another one.`;
  if (sp.rarity === 'mythical') return `A Mythical ${sp.name}! These are the rarest creatures of all. Are you sure?`;
  if (sp.rarity === 'legendary') return `A Legendary ${sp.name}! You may not find another for a long time. Are you sure?`;
  return null;
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

// ---------------------------------------------------------------- finds while you're away

export interface AwayFind { creatureId: string; text: string; coins: number; shards: number; item?: string }

/**
 * While you're away, creatures bring things back: a few coins here, a
 * Starshard or a curiosity there; Explorers go on journeys and find more.
 * Applied straight to your purse, and listed in the "while you were away" report.
 */
export function awayFinds(state: GameState, awayMs: number): AwayFind[] {
  const hours = Math.min(awayMs / HOUR, 12);
  if (hours < 0.25) return [];
  const rng = new StateRng(state);
  const out: AwayFind[] = [];
  for (const c of state.creatures) {
    if (c.stored || isHungry(c)) continue;
    const explorer = c.quirks?.includes('explorer');
    const lucky = c.quirks?.includes('lucky');
    // about one find every three hours, more for Explorers; good friends bring more, strangers less
    const h = hearts(c);
    const fond = 0.5 + h * 0.25;
    if (!rng.chance(Math.min(0.95, hours * (explorer ? 0.5 : 0.3) * fond))) continue;
    let coins = Math.round(rng.range(6, 18) * Math.max(1, hours / 3) * (lucky ? 1.5 : 1) * (explorer ? 1.6 : 1) * (1 + h * 0.15));
    const shards = rng.chance(lucky ? 0.2 : 0.08) ? 1 : 0;
    const item = rng.chance(explorer ? 0.15 : 0.05) ? rng.pick(['warmstone', 'rootswell']) : undefined;
    if (item) coins = Math.round(coins * 0.5);
    // presents: a snack it saved for you, and once in a while an egg it found
    const snack = rng.chance(0.25) ? 1 : 0;
    const egg = rng.chance(0.012 * hours * (explorer ? 2 : 1)) && state.eggs.filter((e) => e.nest === null && !e.nurseryId).length < TUNING.basketSize;
    const name = displayName(c);
    const what = [coins ? `${coins} coins` : '', shards ? 'a Starshard' : '', item === 'warmstone' ? 'a Warm Stone' : item === 'rootswell' ? 'a Rootswell Tonic' : '',
      snack ? 'a snack it saved for you' : '', egg ? 'an egg! 🥚' : '']
      .filter(Boolean).join(' and ');
    const text = h >= 3 ? `${name} missed you and brought you ${what}. 💕` : explorer ? `${name} went on a journey around the world and came back with ${what}.`
      : rng.chance(0.5) ? `${name} found ${what}.` : `${name} dug around and turned up ${what}.`;
    state.glimmer += coins;
    state.shards += shards;
    if (item) state.items[item] = (state.items[item] ?? 0) + 1;
    if (snack) state.food.snack = (state.food.snack ?? 0) + 1;
    if (egg) layEgg(state, rollEggTier(state, 'wild'), 'gift', state.lastTick);
    out.push({ creatureId: c.id, text, coins, shards, item });
  }
  return out;
}

// ---------------------------------------------------------------- lure visitors

const THANKS: Record<Rarity, number> = { common: 5, uncommon: 10, rare: 25, legendary: 60, mythical: 120 };

/** Coins a visitor leaves when you send it on its way. */
export function visitorThanks(c: Creature): number {
  return THANKS[species(c.species).rarity];
}

export function findVisitor(state: GameState, id: string) {
  return state.visitors.find((v) => v.creature.id === id);
}

/** Keep a visitor: it moves in (to its own world, or another one you choose). */
export function keepVisitor(state: GameState, id: string, capacity: number, island?: IslandId): Result {
  const v = findVisitor(state, id);
  if (!v) return fail('They have wandered off.');
  const to = island ?? v.island;
  if (!state.islands[to]?.owned) return fail('You don\'t own that world.');
  const pop = state.creatures.filter((c) => c.island === to && !c.stored).length;
  if (pop >= capacity) return fail('full');
  state.visitors = state.visitors.filter((x) => x !== v);
  v.creature.island = to;
  v.creature.arrivingAt = undefined;
  state.creatures.push(v.creature);
  return { ok: true, message: `${displayName(v.creature)} moved in!` };
}

/** Send a visitor on its way; it leaves a few coins as thanks. */
export function sendAwayVisitor(state: GameState, id: string): Result {
  const v = findVisitor(state, id);
  if (!v) return fail('They have wandered off.');
  state.visitors = state.visitors.filter((x) => x !== v);
  const coins = visitorThanks(v.creature);
  state.glimmer += coins;
  return { ok: true, message: `${displayName(v.creature)} waved goodbye and left ${coins} coins as thanks.` };
}

export function releaseCreature(state: GameState, id: string): Result {
  const c = state.creatures.find((x) => x.id === id);
  if (!c) return fail('Who?');
  if (c.trip) return fail('It\'s away exploring. Welcome it home first.');
  if (c.favorite) return fail('Favorites can\'t be released. Unmark it first.');
  if (state.creatures.filter((x) => !x.stored && x.id !== id).length < 2) return fail('Keep at least two creatures.');
  state.creatures = state.creatures.filter((x) => x !== c);
  return { ok: true, message: `${displayName(c)} wandered off into the wild.` };
}

// ---------------------------------------------------------------- doing many at once (Pets → Select)

export interface BulkResult { done: number; coins: number; skipped: number; reason?: string }

/** Sell several at once. Ones that can't be sold (favorites, level gifts, the last two) are skipped. */
export function bulkSell(state: GameState, ids: string[], t: number): BulkResult {
  const out: BulkResult = { done: 0, coins: 0, skipped: 0 };
  for (const id of ids) {
    const before = state.glimmer;
    const r = sellCreature(state, id, t);
    if (r.ok) {
      out.done += 1;
      out.coins += state.glimmer - before;
    } else {
      out.skipped += 1;
      out.reason ??= r.error;
    }
  }
  return out;
}

export function bulkRelease(state: GameState, ids: string[]): BulkResult {
  const out: BulkResult = { done: 0, coins: 0, skipped: 0 };
  for (const id of ids) {
    const r = releaseCreature(state, id);
    if (r.ok) out.done += 1;
    else {
      out.skipped += 1;
      out.reason ??= r.error;
    }
  }
  return out;
}

export function bulkStore(state: GameState, ids: string[], t: number): BulkResult {
  const out: BulkResult = { done: 0, coins: 0, skipped: 0 };
  for (const id of ids) {
    const r = storeCreature(state, id, t);
    if (r.ok) out.done += 1;
    else {
      out.skipped += 1;
      out.reason ??= r.error;
    }
  }
  return out;
}

/** Bring several out of storage onto one world, as many as fit. */
export function bulkRetrieve(state: GameState, ids: string[], island: IslandId, t: number, capacity: number): BulkResult {
  const out: BulkResult = { done: 0, coins: 0, skipped: 0 };
  for (const id of ids) {
    const r = retrieveCreature(state, id, island, t, capacity);
    if (r.ok) out.done += 1;
    else {
      out.skipped += 1;
      out.reason ??= r.error;
    }
  }
  return out;
}
