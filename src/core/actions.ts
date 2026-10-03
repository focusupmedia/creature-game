// Player actions. Each validates, mutates state, and returns a result the UI can
// show. Keeping these pure makes them testable and server-verifiable later.

import { species } from '../content/species';
import { DECOR, DIG_KINDS, FOODS, TOOLS, EGG_TIERS, EVENTS, GLITTER_MUTATIONS, ITEMS, LURES, MUTATIONS, RESONANCES, SKY_ITEMS, SPOTS, SUMMON_WEIGHTS, spotOpen, wildSkies } from '../content/world';
import { ISLANDS, SIZE_PRICE } from '../content/islands';
import { WILD_SPECIES } from '../content/species';
import { islandCapacity, islandPopulation } from './sim';
import { TUNING } from '../content/tuning';
import { addMutation, displayName, makeCreature, newId } from './creatures';
import { compatibility, combine, incubationMs } from './genetics';
import { addNote, recordMutation, recordResonance, recordSpecies } from './journal';
import { StateRng } from './rng';
import { hasQuirk } from './quirks';
import { levelOf } from './levels';
import { addBond, findBonus } from './friendship';
import { refreshShop } from './shop';
import { freeNest } from './state';
import type { Creature, Egg, EventKind, GameState, Gift, IslandId, MutationId, SpeciesId, SpotId } from './types';
import { activeEvent, eventInWindow, windowAt, type SkyEvent } from './world';

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function placeLure(state: GameState, spot: SpotId, lure: string, t: number): Result {
  if (!SPOTS[spot]) return fail('Unknown spot.');
  if (!state.islands[SPOTS[spot].island]?.owned) return fail('You don\'t own that island yet.');
  if (!spotOpen(state.islands, spot)) return fail('Grow the island to open this spot.');
  if (state.spots[spot]) return fail('A lure is already here.');
  if (!state.lures[lure]) return fail(`You have no ${LURES[lure]?.name ?? 'lure'}.`);
  state.lures[lure] -= 1;
  state.spots[spot] = { lure, placedAt: t, expiresAt: t + LURES[lure].durationMin * 60_000, visitors: 0 };
  state.stats.lures += 1;
  return { ok: true };
}

export function removeLure(state: GameState, spot: SpotId): Result {
  if (!state.spots[spot]) return fail('No lure here.');
  state.spots[spot] = null;
  return { ok: true };
}

export function startCombine(state: GameState, aId: string, bId: string, t: number): Result<{ egg: Egg; notes: string[] }> {
  const a = state.creatures.find((c) => c.id === aId);
  const b = state.creatures.find((c) => c.id === bId);
  if (!a || !b) return fail('Choose two creatures.');
  const compat = compatibility(a, b);
  if (!compat.ok) return fail(compat.reason ?? 'Not kindred.');
  for (const c of [a, b]) if (c.fullness < TUNING.hungry) return fail(`${displayName(c)} is too hungry to breed. Feed it first!`);
  for (const c of [a, b]) if (c.stored) return fail(`${displayName(c)} is in storage.`);
  for (const c of [a, b]) if (c.trip) return fail(`${displayName(c)} is away exploring.`);
  const nest = freeNest(state);
  if (nest === null) return fail('Every nest is full. Hatch an egg first, or add a nest.');
  const rng = new StateRng(state);
  const sky = activeEvent(state, t)?.kind ?? null;
  const known = new Set(Object.keys(state.journal.species));
  const forceNew = state.stats.combines < TUNING.firstNewEggs;
  const o = combine(a, b, rng, sky, { known, forceNew });
  const egg: Egg = {
    id: newId(state, 'e'),
    species: o.species,
    mutations: o.mutations,
    seed: rng.seed(),
    source: 'combine',
    parentNames: [displayName(a), displayName(b)],
    parentSpecies: [a.species, b.species],
    laidAt: t,
    incubationMs: incubationMs(o.species, o.mutations),
    progressMs: 0,
    nest,
    witnessed: [],
    relative: o.relative,
    parentPersonalities: [a.personality, b.personality],
    parentShades: [a.shade, b.shade],
    parentQuirks: [a.quirks, b.quirks],
  };
  if (state.tutorial < 4) egg.incubationMs = Math.min(egg.incubationMs, 40_000);
  state.eggs.push(egg);
  state.stats.combines += 1;
  const story = `Shared a moment at the Kindred Font with ${displayName(b)}.`;
  a.history.push({ t, text: story });
  b.history.push({ t, text: `Shared a moment at the Kindred Font with ${displayName(a)}.` });
  const notes: string[] = [];
  if (addNote(state, 'kindred', 'Creatures must share at least one trait to make an egg together.', t)) {
    notes.push('Creatures must share at least one trait to make an egg together.');
  }
  return { ok: true, egg, notes };
}

export interface HatchResult {
  creature: Creature;
  newSpecies: boolean;
  newMutations: MutationId[];
  hybrid: boolean;
  notes: string[];
}

export function hatch(state: GameState, eggId: string, t: number): Result<HatchResult> {
  const egg = state.eggs.find((e) => e.id === eggId);
  if (!egg) return fail('No such egg.');
  if (egg.progressMs < egg.incubationMs) return fail('Not ready yet.');
  if (islandPopulation(state, 'home') >= islandCapacity(state, 'home')) {
    return fail('Kindred Grove is full. Move a creature to another island, or say goodbye to one, to make room.');
  }
  state.eggs = state.eggs.filter((e) => e !== egg);
  const story = egg.parentNames
    ? `Hatched from an egg made by ${egg.parentNames[0]} and ${egg.parentNames[1]}.`
    : egg.source === 'shop' ? `Hatched from a ${egg.tier ? EGG_TIERS[egg.tier]?.name ?? 'shop egg' : 'traveler\'s egg'}.`
      : egg.source === 'dug' ? 'Hatched from an egg a creature dug up.' : 'Hatched from a mysterious egg.';
  const c = makeCreature(state, egg.species, egg.mutations, t, story, {
    seed: egg.seed, island: 'home', hatchling: true, parents: egg.parentPersonalities, parentQuirks: egg.parentQuirks, parentShades: egg.parentShades,
    sizeSpray: egg.sprays?.includes('grow') ? 'grow' : egg.sprays?.includes('shrink') ? 'shrink' : undefined,
    met: {
      how: egg.source === 'combine' ? 'bred' : egg.source === 'shop' ? 'shop' : egg.source === 'dug' ? 'dug' : 'other',
      sky: state.legendary?.kind ?? activeEvent(state, t)?.kind ?? null,
      parents: egg.parentNames && egg.parentSpecies
        ? [{ name: egg.parentNames[0], species: egg.parentSpecies[0] }, { name: egg.parentNames[1], species: egg.parentSpecies[1] }] : undefined,
      tier: egg.tier,
    },
  });
  if (egg.relative) c.history.push({ t, text: 'A distant relative! It looks nothing like its parents.' });
  for (const ev of new Set(egg.witnessed)) {
    c.history.push({ t, text: `As an egg, it felt a ${EVENTS[ev].name.toLowerCase()} pass overhead.` });
  }
  state.creatures.push(c);
  state.stats.hatches += 1;
  if (state.tutorial < 5) state.tutorial = 5;
  const newSpecies = recordSpecies(state, egg.species, t);
  const newMutations = c.mutations.filter((m) => recordMutation(state, m, t));
  const sp = species(egg.species);
  const notes: string[] = [];
  if (sp.origin === 'hybrid') {
    const rule = RESONANCES.find((r) => r.result === sp.id);
    if (rule && recordResonance(state, rule.id, t)) {
      const text = `${rule.requires.join(' + ')} kin can create a ${sp.name}.`;
      if (addNote(state, `res-${rule.id}`, text, t)) notes.push(text);
    }
  }
  for (const ev of new Set(egg.witnessed)) {
    const m = EVENTS[ev].mutation;
    if (c.mutations.includes(m)) {
      const text = `Eggs incubating during a ${EVENTS[ev].name} can absorb its ${MUTATIONS[m].name} touch.`;
      if (addNote(state, `egg-${ev}`, text, t)) notes.push(text);
    }
  }
  if (c.mutations.includes('giant') && egg.tonic) {
    const text = 'Rootswell Tonic can make an egg hatch Giant.';
    if (addNote(state, 'tonic', text, t)) notes.push(text);
  }
  return { ok: true, creature: c, newSpecies, newMutations, hybrid: sp.origin === 'hybrid', notes };
}

export function release(state: GameState, creatureId: string): Result {
  if (state.creatures.find((c) => c.id === creatureId)?.trip) return fail('It\'s away exploring. Welcome it home first.');
  if (state.creatures.length <= 2) return fail('Your sanctuary would feel empty. Keep at least two creatures.');
  const idx = state.creatures.findIndex((c) => c.id === creatureId);
  if (idx < 0) return fail('No such creature.');
  state.creatures.splice(idx, 1);
  return { ok: true };
}

export function rename(state: GameState, creatureId: string, name: string): Result {
  const c = state.creatures.find((x) => x.id === creatureId);
  if (!c) return fail('No such creature.');
  const clean = name.trim().slice(0, 18);
  c.nickname = clean || undefined;
  return { ok: true };
}

export function collectGift(state: GameState, giftId: string, t = Date.now()): Result<{ glimmer: number; shards: number; item?: string }> {
  const g = state.gifts.find((x) => x.id === giftId);
  if (!g) return fail('Gone.');
  state.gifts = state.gifts.filter((x) => x !== g);
  state.glimmer += g.glimmer;
  state.shards += g.shards;
  if (g.item === 'egg') {
    // a full basket turns the egg into a little extra treasure instead
    if (state.eggs.filter((e) => e.nest === null).length < TUNING.basketSize) layEgg(state, rollEggTier(state, 'wild'), 'dug', t);
    else {
      state.glimmer += 40;
      return { ok: true, glimmer: g.glimmer + 40, shards: g.shards };
    }
  } else if (g.item) {
    state.items[g.item] = (state.items[g.item] ?? 0) + 1;
  }
  return { ok: true, glimmer: g.glimmer, shards: g.shards, item: g.item };
}

/**
 * A creature you dropped on a dig spot works it. The find becomes a gift on
 * the ground (the creature digs it up in front of you; tap it to collect).
 */
export function workDigSpot(state: GameState, spotId: string, creatureId: string): Result<{ gift: Gift }> {
  const d = state.digSpots.find((x) => x.id === spotId);
  const c = state.creatures.find((x) => x.id === creatureId);
  if (!d) return fail('That spot has faded away.');
  if (!c) return fail('Who?');
  if (c.trip) return fail('It\'s away exploring.');
  if (c.island !== d.island) return fail('That creature lives on another island.');
  const kind = DIG_KINDS[d.kind];
  if (species(c.species).movement === 'swim' && d.kind !== 'puddle') return fail(`${displayName(c)} can't do that on dry land.`);
  const rng = new StateRng(state);
  const gift: Gift = {
    id: newId(state, 'g'), x: d.x, z: d.z, glimmer: Math.round(rng.int(kind.glimmer[0], kind.glimmer[1]) * findBonus(c)),
    shards: rng.chance(kind.shardChance * (hasQuirk(c, 'lucky') ? 2 : 1)) ? 1 : 0, from: c.id, island: d.island, via: d.kind,
  };
  if (hasQuirk(c, 'lucky')) gift.glimmer = Math.round(gift.glimmer * 1.5);
  if (rng.chance(kind.itemChance)) gift.item = rng.pick(kind.items);
  else if (rng.chance(kind.eggChance) && state.eggs.filter((e) => e.nest === null).length < TUNING.basketSize) gift.item = 'egg';
  state.digSpots = state.digSpots.filter((x) => x !== d);
  state.gifts.push(gift);
  addBond(c, 2, state);
  return { ok: true, gift };
}

/** Roll which species an egg from a shop tier holds. Decided now, revealed at hatching. */
export function rollEggTier(state: GameState, tierId: string): SpeciesId {
  const tier = EGG_TIERS[tierId] ?? EGG_TIERS.meadow;
  const rng = new StateRng(state);
  const pool = WILD_SPECIES
    .filter((s) => !tier.habitats.length || s.traits.some((t) => tier.habitats.includes(t)))
    .map((s) => [s.id, tier.weights[s.rarity] ?? 0] as [SpeciesId, number]);
  return rng.weighted(pool) ?? 'mossfrog';
}

export function layEgg(state: GameState, sp: SpeciesId, source: Egg['source'], t: number): Egg {
  const rng = new StateRng(state);
  const muts: MutationId[] = rng.chance(TUNING.prismaticChance) ? ['prismatic'] : [];
  const egg: Egg = {
    id: newId(state, 'e'), species: sp, mutations: muts, seed: rng.seed(), source, laidAt: t,
    incubationMs: incubationMs(sp, muts), progressMs: 0, nest: freeNest(state), witnessed: [],
  };
  state.eggs.push(egg);
  return egg;
}

// ---------------------------------------------------------------- islands

export function buyIsland(state: GameState, id: IslandId): Result {
  const def = ISLANDS[id];
  if (!def || def.status !== 'buyable') return fail('That world isn\'t available yet.');
  if (state.islands[id]?.owned) return fail('You already own this world.');
  if (levelOf(state.xp) < def.price.level) return fail(`Reach keeper level ${def.price.level} first.`);
  if (state.glimmer < def.price.coins) return fail('Not enough coins.');
  state.glimmer -= def.price.coins;
  state.islands[id] = { owned: true, size: 0 };
  // A starter pair to breed from; the rest of the island's creatures come from lures and breeding.
  const t = state.lastTick;
  for (const sp of def.starters ?? []) {
    state.creatures.push(makeCreature(state, sp, [], t, `Was waiting on ${def.name} when you arrived.`, { island: id, met: { how: 'island' } }));
    recordSpecies(state, sp, t);
  }
  return { ok: true };
}

/** Worlds you could open right now: high enough level and enough coins. */
export function buyableWorlds(state: GameState): IslandId[] {
  return (Object.keys(ISLANDS) as IslandId[]).filter((id) => {
    const def = ISLANDS[id];
    return def.status === 'buyable' && !state.islands[id]?.owned && levelOf(state.xp) >= def.price.level && state.glimmer >= def.price.coins;
  });
}

export function upgradeIsland(state: GameState, id: IslandId, currency: 'glimmer' | 'shards'): Result {
  const isl = state.islands[id];
  if (!isl?.owned) return fail('You don\'t own this island.');
  const next = isl.size + 1;
  const price = SIZE_PRICE[next];
  if (!price) return fail('This island is already as big as it gets.');
  const cost = currency === 'glimmer' ? price.coins : price.gems;
  const wallet = currency === 'glimmer' ? state.glimmer : state.shards;
  if (wallet < cost) return fail(currency === 'glimmer' ? 'Not enough coins.' : 'Not enough Starshards.');
  if (currency === 'glimmer') state.glimmer -= cost; else state.shards -= cost;
  isl.size = next;
  return { ok: true };
}

export function moveCreature(state: GameState, creatureId: string, to: IslandId, t: number): Result {
  const c = state.creatures.find((x) => x.id === creatureId);
  if (c?.trip) return fail('It\'s away exploring. Welcome it home first.');
  if (!c) return fail('No such creature.');
  if (!state.islands[to]?.owned) return fail('You don\'t own that island yet.');
  if (c.island === to) return fail('It already lives there.');
  if (islandPopulation(state, to) >= islandCapacity(state, to)) return fail(`${ISLANDS[to].name} is full.`);
  c.island = to;
  c.history.push({ t, text: `Moved to ${ISLANDS[to].name}.` });
  return { ok: true };
}

/** Move several creatures to one world, as many as fit. */
export function bulkMove(state: GameState, ids: string[], to: IslandId, t: number): { done: number; skipped: number; reason?: string } {
  const out: { done: number; skipped: number; reason?: string } = { done: 0, skipped: 0 };
  for (const id of ids) {
    const r = moveCreature(state, id, to, t);
    if (r.ok) out.done += 1;
    else {
      out.skipped += 1;
      out.reason ??= r.error;
    }
  }
  return out;
}

export function buyOffer(state: GameState, offerId: string, t: number): Result<{ message: string }> {
  const o = state.shop.offers.find((x) => x.id === offerId);
  if (!o) return fail('That offer has gone.');
  if (o.stock <= 0) return fail('Sold out.');
  const wallet = o.currency === 'glimmer' ? state.glimmer : state.shards;
  if (wallet < o.price) return fail(o.currency === 'glimmer' ? 'Not enough coins.' : 'Not enough Starshards.');
  if (o.kind === 'egg' && state.eggs.filter((e) => e.nest === null).length >= TUNING.basketSize) {
    return fail('Your egg basket is full.');
  }
  if (o.kind === 'sky' && o.ref === 'telescope' && state.telescope) return fail('You already have the Sky Telescope.');
  if (o.currency === 'glimmer') state.glimmer -= o.price; else state.shards -= o.price;
  o.stock -= 1;
  let message = '';
  switch (o.kind) {
    case 'lure':
      state.lures[o.ref] = (state.lures[o.ref] ?? 0) + o.qty;
      message = `${LURES[o.ref].name} added to your satchel.`;
      break;
    case 'item':
      state.items[o.ref] = (state.items[o.ref] ?? 0) + o.qty;
      message = `${ITEMS[o.ref].name} added to your satchel.`;
      break;
    case 'food':
      state.food[o.ref] = (state.food[o.ref] ?? 0) + o.qty;
      message = `${FOODS[o.ref]?.name ?? 'Food'} added to your pantry.`;
      break;
    case 'tool':
      state.tools[o.ref] = (state.tools[o.ref] ?? 0) + o.qty;
      message = `${TOOLS[o.ref]?.name ?? 'Tool'} added to your satchel.`;
      break;
    case 'sky':
      if (o.ref === 'telescope') state.telescope = true;
      else if (o.ref === 'starchart') state.chartUntil = Math.max(t, state.chartUntil ?? 0) + 24 * 3_600_000;
      else {
        state.charms ??= {};
        state.charms[o.ref] = (state.charms[o.ref] ?? 0) + o.qty;
      }
      message = o.ref === 'telescope' ? 'The Sky Telescope is yours: check the EVENT button to see what\'s coming.'
        : o.ref === 'starchart' ? 'Star Chart unrolled: check the EVENT button to see what\'s coming today.'
          : `${SKY_ITEMS[o.ref].name} added. Break it from the EVENT button.`;
      break;
    case 'decor':
      state.decorOwned[o.ref] = (state.decorOwned[o.ref] ?? 0) + o.qty;
      message = `${DECOR[o.ref].name} is ready to place.`;
      break;
    case 'egg': {
      const egg = layEgg(state, rollEggTier(state, o.ref), 'shop', t);
      egg.tier = o.ref;
      message = `${EGG_TIERS[o.ref]?.name ?? 'An egg'} is waiting ${egg.nest === null ? 'in your basket' : 'in a nest'}. What could be inside?`;
      break;
    }
  }
  return { ok: true, message };
}

export function paidShopRefresh(state: GameState, t: number, viaAd = false): Result {
  if (!viaAd) {
    if (state.shards < TUNING.shopRefreshShards) return fail('Not enough Starshards.');
    state.shards -= TUNING.shopRefreshShards;
  }
  const next = state.shop.nextRefreshAt;
  refreshShop(state, t);
  state.shop.nextRefreshAt = Math.max(next, state.shop.nextRefreshAt);
  return { ok: true };
}

export function buyNest(state: GameState): Result {
  if (state.nests >= TUNING.maxNests) return fail('No room for more nests here yet.');
  const price = TUNING.nestPriceShards[state.nests] ?? 999;
  if (state.shards < price) return fail('Not enough Starshards.');
  state.shards -= price;
  state.nests += 1;
  return { ok: true };
}

export function nestPrice(state: GameState): number | null {
  if (state.nests >= TUNING.maxNests) return null;
  return TUNING.nestPriceShards[state.nests] ?? null;
}

export function remainingMs(egg: Egg): number {
  return Math.max(0, egg.incubationMs - egg.progressMs);
}

/** Shards to hatch now: scales with how long is left, so long (rare) eggs cost more. */
export function skipPrice(egg: Egg): number {
  return Math.max(1, Math.ceil((remainingMs(egg) / 60_000) * TUNING.skipShardsPerMin));
}

export function finishEggWithShards(state: GameState, eggId: string): Result {
  const egg = state.eggs.find((e) => e.id === eggId);
  if (!egg || egg.nest === null) return fail('No egg.');
  const price = skipPrice(egg);
  if (state.shards < price) return fail('Not enough Starshards.');
  state.shards -= price;
  egg.progressMs = egg.incubationMs;
  return { ok: true };
}

function today(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function adsLeft(state: GameState, t: number): number {
  if (state.ads.day !== today(t)) return TUNING.adsPerDay;
  return Math.max(0, TUNING.adsPerDay - state.ads.count);
}

export function canAdHatch(state: GameState, egg: Egg, t: number): boolean {
  return egg.nest !== null && !egg.adUsed && remainingMs(egg) > 0
    && remainingMs(egg) <= TUNING.adHatchMaxRemainingMin * 60_000 && adsLeft(state, t) > 0;
}

export function consumeAd(state: GameState, t: number): void {
  if (state.ads.day !== today(t)) state.ads = { ...state.ads, day: today(t), count: 0 };
  state.ads.count += 1;
}

/**
 * Free coins for a rewarded ad, worth more as you level up. They come in a
 * batch; the batch refills once you haven't watched one for a while (the
 * clock starts from your most recent watch, not the first).
 */
export function coinAdsLeft(state: GameState, t: number): number {
  const at = state.ads.coinsAt;
  if (at === undefined || t - at >= TUNING.coinAdRefillMin * 60_000) return TUNING.coinAdsPerBatch;
  return Math.max(0, TUNING.coinAdsPerBatch - (state.ads.coins ?? 0));
}

export function coinAdReward(state: GameState): number {
  return Math.round((TUNING.coinAdBase + TUNING.coinAdPerLevel * levelOf(state.xp)) / 5) * 5;
}

export function claimCoinAd(state: GameState, t: number): Result<{ coins: number }> {
  if (coinAdsLeft(state, t) <= 0) return fail('Mango is restocking free coins. Check back a little later!');
  const at = state.ads.coinsAt;
  if (at === undefined || t - at >= TUNING.coinAdRefillMin * 60_000) state.ads.coins = 0;
  state.ads.coins = (state.ads.coins ?? 0) + 1;
  state.ads.coinsAt = t;
  const coins = coinAdReward(state);
  state.glimmer += coins;
  return { ok: true, coins };
}

export function adHatch(state: GameState, eggId: string, t: number): Result {
  const egg = state.eggs.find((e) => e.id === eggId);
  if (!egg || !canAdHatch(state, egg, t)) return fail('Not available.');
  consumeAd(state, t);
  egg.adUsed = true;
  egg.progressMs = egg.incubationMs;
  return { ok: true };
}

export function useItem(state: GameState, itemId: string, eggId: string): Result<{ message: string }> {
  const egg = state.eggs.find((e) => e.id === eggId);
  if (!egg) return fail('No egg.');
  if (!state.items[itemId]) return fail('You have none.');
  const item = ITEMS[itemId];
  if (item.spray) return useSpray(state, item, egg);
  if (item.effect === 'giantChance') {
    if (egg.tonic) return fail('This egg has already had a tonic.');
    state.items[itemId] -= 1;
    egg.tonic = true;
    const rng = new StateRng(state);
    if (!egg.mutations.includes('giant') && rng.chance(TUNING.tonicGiantChance)) {
      egg.mutations.push('giant');
      egg.incubationMs += TUNING.incubationPerMutationMin * 60_000;
      return { ok: true, message: 'The egg drinks it all... and feels noticeably heavier.' };
    }
    return { ok: true, message: 'The egg absorbs the tonic. Nothing seems to change.' };
  }
  if (egg.warmed) return fail('This egg is already warm.');
  if (egg.nest === null) return fail('Place the egg in a nest first.');
  state.items[itemId] -= 1;
  egg.warmed = true;
  egg.progressMs += (egg.incubationMs - egg.progressMs) / 2;
  return { ok: true, message: 'The egg wriggles happily in the warmth.' };
}

/** Egg sprays: each kind once per egg; Grow and Shrink cancel each other out, so only one of them. */
function useSpray(state: GameState, item: (typeof ITEMS)[string], egg: Egg): Result<{ message: string }> {
  const used = (egg.sprays ??= []);
  if (used.includes(item.effect)) return fail(`This egg has already had ${item.name}.`);
  if ((item.effect === 'grow' && used.includes('shrink')) || (item.effect === 'shrink' && used.includes('grow'))) {
    return fail('Grow Mist and Shrink Mist would cancel out. Only one per egg.');
  }
  if (item.effect === 'speedy' && egg.nest === null) return fail('Place the egg in a nest first.');
  state.items[item.id] -= 1;
  used.push(item.effect);
  switch (item.effect) {
    case 'grow': return { ok: true, message: 'The egg soaks up the green mist and stretches a little.' };
    case 'shrink': return { ok: true, message: 'The egg shivers in the blue mist and tucks itself in.' };
    case 'speedy':
      egg.progressMs += (egg.incubationMs - egg.progressMs) * 0.3;
      return { ok: true, message: 'The egg fizzes and starts wiggling faster!' };
    default: {
      const rng = new StateRng(state);
      const options = GLITTER_MUTATIONS.filter((m) => !egg.mutations.includes(m));
      if (options.length && rng.chance(0.5)) {
        egg.mutations.push(rng.pick(options));
        return { ok: true, message: 'The glitter sinks right into the shell. Something has changed inside!' };
      }
      return { ok: true, message: 'The glitter sparkles… and slides off. Nothing changed this time.' };
    }
  }
}

export function placeDecor(state: GameState, decor: string, x: number, z: number, rot: number, island: IslandId = 'home'): Result {
  if (!state.decorOwned[decor]) return fail('You have none to place.');
  if (!state.islands[island]?.owned) return fail('You don\'t own that world.');
  state.decorOwned[decor] -= 1;
  state.placedDecor.push({ id: newId(state, 'd'), decor, x, z, rot, island, harvestedAt: decor === 'fruittree' ? state.lastTick : undefined });
  return { ok: true };
}

/** Buy a decoration from the catalog: needs the keeper level, then coins or Starshards. */
export function buyDecor(state: GameState, id: string): Result<{ message: string }> {
  const d = DECOR[id];
  if (!d) return fail('Unknown decoration.');
  if (levelOf(state.xp) < (d.level ?? 1)) return fail(`Reach keeper level ${d.level} to unlock the ${d.name}.`);
  const wallet = d.currency === 'shards' ? state.shards : state.glimmer;
  if (wallet < d.price) return fail(d.currency === 'shards' ? 'Not enough Starshards.' : 'Not enough coins.');
  if (d.currency === 'shards') state.shards -= d.price;
  else state.glimmer -= d.price;
  state.decorOwned[id] = (state.decorOwned[id] ?? 0) + 1;
  return { ok: true, message: `${d.name} bought! Find it in Decor to place it.` };
}

/** Chop down a scenery tree to make room. It leaves a stump and a little wood worth a few coins. */
export function chopTree(state: GameState, island: IslandId, index: number): Result<{ coins: number }> {
  if (!state.islands[island]?.owned) return fail('You don\'t own that world.');
  const list = ((state.chopped ??= {})[island] ??= []);
  if (list.includes(index)) return fail('Already chopped.');
  list.push(index);
  const coins = new StateRng(state).int(5, 12);
  state.glimmer += coins;
  return { ok: true, coins };
}

export function storeDecor(state: GameState, placedId: string): Result {
  const d = state.placedDecor.find((p) => p.id === placedId);
  if (!d) return fail('Not found.');
  state.placedDecor = state.placedDecor.filter((p) => p !== d);
  state.decorOwned[d.decor] = (state.decorOwned[d.decor] ?? 0) + 1;
  return { ok: true };
}

/**
 * Rewarded ad: summon a random sky event right now. Uses one of the day's ads.
 * Every summonable event can also happen naturally, so ad-free players see them too.
 */
export function summonEvent(state: GameState, t: number): Result<{ kind: EventKind }> {
  if (activeEvent(state, t)) return fail('The sky is already busy. Wait for this event to pass.');
  if (adsLeft(state, t) <= 0) return fail('No more ads today. Come back tomorrow!');
  const rng = new StateRng(state);
  const kind = rng.weighted(Object.entries(SUMMON_WEIGHTS) as [EventKind, number][]) ?? 'storm';
  const [dMin, dMax] = EVENTS[kind].durationMin;
  const dur = rng.range(dMin, dMax) * 60_000;
  consumeAd(state, t);
  state.summoned = { kind, start: t, end: t + dur };
  return { ok: true, kind };
}

/** Break a sky charm: its event (or a random rare one) starts right now. */
export function useCharm(state: GameState, charmId: string, t: number): Result<{ kind: EventKind }> {
  const def = SKY_ITEMS[charmId];
  if (!def || (!def.kind && charmId !== 'wildcharm')) return fail('That isn\'t a charm.');
  if (!(state.charms?.[charmId])) return fail(`You have no ${def.name}. Mango sells them in his shop.`);
  if (activeEvent(state, t)) return fail('The sky is already busy. Wait for this event to pass.');
  const rng = new StateRng(state);
  const kind = def.kind ?? rng.pick(wildSkies());
  const [dMin, dMax] = EVENTS[kind].durationMin;
  state.summoned = { kind, start: t, end: t + rng.range(dMin, dMax) * 60_000 };
  state.charms![charmId] -= 1;
  return { ok: true, kind };
}

/** Whether the Star Chart or Telescope is showing what's coming. */
export function canSeeForecast(state: GameState, t: number): boolean {
  return !!state.telescope || (state.chartUntil ?? 0) > t;
}

/** The next few scheduled sky events. */
export function upcomingEvents(state: GameState, t: number, n = 3): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (let w = windowAt(state, t); w < windowAt(state, t) + 60 && out.length < n; w++) {
    const e = eventInWindow(state, w);
    if (e && e.start > t) out.push(e);
  }
  return out;
}

/** Developer helper for testing: grant a mutation directly. */
export function devMutate(state: GameState, creatureId: string, m: MutationId, t: number): void {
  const c = state.creatures.find((x) => x.id === creatureId);
  if (c && addMutation(c, m, t, 'A strange shimmer passed over it.')) recordMutation(state, m, t);
}

export function devSpawn(state: GameState, sp: string, t: number): Creature {
  const c = makeCreature(state, sp, [], t, 'Appeared out of nowhere.', { island: 'home' });
  state.creatures.push(c);
  recordSpecies(state, sp, t);
  return c;
}
