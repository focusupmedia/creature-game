// The Halloween Pass: a season pass that runs alongside the Halloween event.
// Playing earns Candy; every 120 Candy opens the next of 25 tiers. Each tier
// has a free reward, and a bigger one for keepers who unlock the paid track.
// Candy only counts while the season is on.

import { HALLOWEEN_SKIES, inHalloween } from '../content/seasons';
import { DECOR, EGG_TIERS, FOODS, LURES } from '../content/world';
import { TUNING } from '../content/tuning';
import { layEgg, rollEggTier } from './actions';
import { giveGiftCreature } from './levels';
import { species } from '../content/species';
import type { Result } from './actions';
import type { PlayEvent } from './progress';
import type { GameState, SpeciesId } from './types';

export const PASS = { id: 'halloween', name: 'Halloween Pass', pointsPerTier: 120, tiers: 25, productId: 'pass_halloween' };

export interface PassReward {
  coins?: number;
  shards?: number;
  lure?: [string, number];
  food?: [string, number];
  egg?: string;
  decor?: string;
  /** A pass-only creature. */
  creature?: SpeciesId;
}

const F = (r: PassReward) => r;
/** Tier rewards, 1 to 25: [free, paid]. */
export const PASS_TIERS: [PassReward, PassReward][] = [
  [F({ coins: 150 }), F({ shards: 20 })],
  [F({ food: ['snack', 3] }), F({ lure: ['shimmer', 1] })],
  [F({ coins: 200 }), F({ coins: 600 })],
  [F({ lure: ['moonpetal', 2] }), F({ food: ['sprout', 3] })],
  [F({ decor: 'jackolantern' }), F({ decor: 'cauldron' })],
  [F({ shards: 10 }), F({ shards: 30 })],
  [F({ food: ['sprout', 2] }), F({ egg: 'epic' })],
  [F({ coins: 300 }), F({ coins: 900 })],
  [F({ lure: ['shimmer', 1] }), F({ lure: ['golden', 1] })],
  [F({ shards: 15 }), F({ decor: 'spookytree' })],
  [F({ food: ['feast', 1] }), F({ shards: 40 })],
  [F({ coins: 400 }), F({ coins: 1200 })],
  [F({ egg: 'starry' }), F({ egg: 'legendary' })],
  [F({ food: ['snack', 5] }), F({ food: ['sprout', 5] })],
  [F({ decor: 'gravestone' }), F({ decor: 'batbanner' })],
  [F({ shards: 15 }), F({ shards: 50 })],
  [F({ coins: 500 }), F({ lure: ['golden', 2] })],
  [F({ lure: ['moonpetal', 3] }), F({ coins: 1500 })],
  [F({ food: ['feedbag', 1] }), F({ shards: 60 })],
  [F({ egg: 'epic' }), F({ egg: 'legendary' })],
  [F({ coins: 600 }), F({ coins: 2000 })],
  [F({ shards: 20 }), F({ lure: ['mythic', 1] })],
  [F({ food: ['sprout', 4] }), F({ shards: 80 })],
  [F({ lure: ['golden', 1] }), F({ coins: 3000 })],
  [F({ shards: 50 }), F({ creature: 'wispstag' })],
];

export function passState(state: GameState) {
  if (!state.pass || state.pass.id !== PASS.id) state.pass = { id: PASS.id, points: 0, free: [], paid: [], premium: false };
  return state.pass;
}

/** Candy for things the keeper does (only during the season). */
export function candyFor(ev: PlayEvent): number {
  switch (ev.kind) {
    case 'lure': return 2;
    case 'breed': return 4;
    case 'hatch': return 6 + (ev.newSpecies ? 10 : 0) + ev.newMutations * 8;
    case 'arrival': return ev.isNew ? 6 : 2;
    case 'digSpot': return 1;
    case 'sold': return 1;
    case 'market': return 8;
    case 'befriend': return 1;
    case 'feed': return 1;
    case 'trip': return 5;
    case 'deal': return 2;
    case 'shopEgg': return 3;
    default: return 0;
  }
}

export function addCandy(state: GameState, n: number, t: number): number {
  if (!inHalloween(t) || n <= 0) return 0;
  passState(state).points += n;
  return n;
}

/** A creature got a Halloween mark: a big handful of Candy. */
export function markCandy(state: GameState, sky: string, t: number): number {
  return HALLOWEEN_SKIES.includes(sky as never) ? addCandy(state, 15, t) : 0;
}

export function passTier(state: GameState): number {
  return Math.min(PASS.tiers, Math.floor(passState(state).points / PASS.pointsPerTier));
}

export function passClaimable(state: GameState): number {
  const p = passState(state);
  const reached = passTier(state);
  let n = 0;
  for (let i = 1; i <= reached; i++) {
    if (!p.free.includes(i)) n++;
    if (p.premium && !p.paid.includes(i)) n++;
  }
  return n;
}

export function describeReward(r: PassReward): string {
  if (r.coins) return `{coin} ${r.coins.toLocaleString()}`;
  if (r.shards) return `{gem} ${r.shards}`;
  if (r.lure) return `${LURES[r.lure[0]]?.name ?? 'Lure'} ×${r.lure[1]}`;
  if (r.food) return `${FOODS[r.food[0]]?.name ?? 'Food'} ×${r.food[1]}`;
  if (r.egg) return EGG_TIERS[r.egg]?.name ?? 'Egg';
  if (r.decor) return DECOR[r.decor]?.name ?? 'Decoration';
  if (r.creature) return `${species(r.creature).name} (exclusive ${species(r.creature).rarity})`;
  return '';
}

export function claimPassTier(state: GameState, tier: number, track: 'free' | 'paid', t: number): Result<{ message: string }> {
  const p = passState(state);
  if (tier < 1 || tier > PASS.tiers) return { ok: false, error: 'No such tier.' };
  if (tier > passTier(state)) return { ok: false, error: 'Collect more Candy to reach this tier.' };
  if (track === 'paid' && !p.premium) return { ok: false, error: 'Unlock the Halloween Pass to claim this.' };
  const list = track === 'free' ? p.free : p.paid;
  if (list.includes(tier)) return { ok: false, error: 'Already claimed.' };
  const r = PASS_TIERS[tier - 1][track === 'free' ? 0 : 1];
  if (r.egg && state.eggs.filter((e) => e.nest === null && !e.nurseryId).length >= TUNING.basketSize) {
    return { ok: false, error: 'Your egg basket is full. Hatch an egg first, then claim this.' };
  }
  if (r.coins) state.glimmer += r.coins;
  if (r.shards) state.shards += r.shards;
  if (r.lure) state.lures[r.lure[0]] = (state.lures[r.lure[0]] ?? 0) + r.lure[1];
  if (r.food) state.food[r.food[0]] = (state.food[r.food[0]] ?? 0) + r.food[1];
  if (r.decor) state.decorOwned[r.decor] = (state.decorOwned[r.decor] ?? 0) + 1;
  if (r.egg) layEgg(state, rollEggTier(state, r.egg), 'shop', t).tier = r.egg;
  if (r.creature) giveGiftCreature(state, r.creature, 'A Halloween Pass exclusive.', { how: 'pass' }, t);
  list.push(tier);
  return { ok: true, message: `${describeReward(r)}${r.decor ? ' is in your Decor satchel' : r.egg ? ' is warming in a nest' : r.creature ? ' has joined your sanctuary' : ''}!` };
}

/** The creature every pass holder gets the moment they unlock it. */
export const PASS_CREATURE: SpeciesId = 'pumpkit';

/** The paid track, after a successful purchase. Returns the new creature's id, if one joined. */
export function unlockPass(state: GameState, t: number): string | null {
  passState(state).premium = true;
  if (state.creatures.some((c) => c.species === PASS_CREATURE) || state.journal.species[PASS_CREATURE]) return null;
  return giveGiftCreature(state, PASS_CREATURE, 'A Halloween Pass exclusive.', { how: 'pass' }, t);
}
