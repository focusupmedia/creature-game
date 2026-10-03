// The Market board: three buyers a day, each wanting something particular
// (a species you've met, a type, a mutation, a big one, a special shade).
// Fill a want and you're paid well over the normal price, plus a bonus.
// Gives players a reason to breed with a goal, and to come back tomorrow.

import { SPECIES, species } from '../content/species';
import { MUTATIONS } from '../content/world';
import { SHADES } from '../content/shades';
import { canSell, sellPrice } from './care';
import { displayName } from './creatures';
import { hash01 } from './rng';
import { today } from './quests';
import type { Result } from './actions';
import type { Creature, GameState, MutationId, Trait } from './types';

export type WantKind = 'species' | 'type' | 'mutation' | 'big' | 'shade';

export interface MarketWant {
  id: string;
  kind: WantKind;
  target: string;
  /** What the buyer says they want. */
  text: string;
  /** Pays the pet's normal price times this, plus the bonus. */
  mult: number;
  bonusCoins: number;
  bonusShards: number;
  buyer: string;
}

const BUYERS = ['Granny Fern', 'Captain Pip', 'Professor Moss', 'Little Juniper', 'Baron Bramble', 'Nell the Painter', 'Sir Waddleton', 'Old Mother Hen', 'Twig & Berry', 'Madame Lumen'];
const TYPES: Trait[] = ['Grove', 'Tide', 'Bloom', 'Mystic', 'Ember', 'Reef', 'Sand', 'Shore', 'Sky', 'Bird', 'Mammal', 'Reptile', 'Fish', 'Insect', 'Spirit', 'Amphibian', 'Dragon'];

/** Today's three wants. The same all day; something new tomorrow. */
export function marketWants(state: GameState, t: number): MarketWant[] {
  const day = today(t);
  const d = Number(day.replace(/-/g, '')) || 0;
  const h = (i: number) => hash01(state.seed, d, 77 + i);
  const pickFrom = <T,>(a: T[], i: number) => a[Math.floor(h(i) * a.length) % a.length];
  const met = SPECIES.filter((sp) => state.journal.species[sp.id] && sp.origin !== 'reward' && sp.rarity !== 'mythical' && !sp.onlyDuring);
  const out: MarketWant[] = [];
  const buyer = (i: number) => pickFrom(BUYERS, 10 + i);

  // 1. a species you've already met (so it's always doable)
  const sp = met.length ? pickFrom(met, 1) : species('mossfrog');
  const rank = { common: 1, uncommon: 2, rare: 3, legendary: 5, mythical: 6 }[sp.rarity];
  out.push({ id: `${day}-1`, kind: 'species', target: sp.id, text: `Any ${sp.name}`, mult: 2.5, bonusCoins: 60 * rank, bonusShards: rank >= 3 ? 3 : 1, buyer: buyer(1) });

  // 2. a type, from the ones your pets have shown you
  const known = TYPES.filter((ty) => met.some((x) => x.traits.includes(ty)));
  const ty = known.length ? pickFrom(known, 2) : 'Grove';
  out.push({ id: `${day}-2`, kind: 'type', target: ty, text: `Any ${ty} creature`, mult: 2, bonusCoins: 80, bonusShards: 1, buyer: buyer(2) });

  // 3. something special, which takes a bit of luck or planning
  const special = Math.floor(h(3) * 3);
  const seenMuts = (Object.keys(state.journal.mutations) as MutationId[]).filter((m) => MUTATIONS[m]);
  if (special === 0 && seenMuts.length) {
    const m = pickFrom(seenMuts, 4);
    out.push({ id: `${day}-3`, kind: 'mutation', target: m, text: `Any ${MUTATIONS[m].name} pet`, mult: 3, bonusCoins: 250, bonusShards: 5, buyer: buyer(3) });
  } else if (special === 1) {
    out.push({ id: `${day}-3`, kind: 'shade', target: 'any', text: 'Any pet with a special shade (not Classic)', mult: 2.5, bonusCoins: 200, bonusShards: 4, buyer: buyer(3) });
  } else {
    out.push({ id: `${day}-3`, kind: 'big', target: '1.3', text: 'A Big or Colossal pet', mult: 2.5, bonusCoins: 200, bonusShards: 4, buyer: buyer(3) });
  }
  return out;
}

export function wantMatches(w: MarketWant, c: Creature): boolean {
  switch (w.kind) {
    case 'species': return c.species === w.target;
    case 'type': return species(c.species).traits.includes(w.target as Trait);
    case 'mutation': return c.mutations.includes(w.target as MutationId);
    case 'big': return c.size * (c.mutations.includes('giant') ? 1.6 : 1) >= Number(w.target);
    case 'shade': return !!c.shade && c.shade !== 'classic' && !!SHADES[c.shade as keyof typeof SHADES];
  }
}

export function wantFilled(state: GameState, w: MarketWant, t: number): boolean {
  return state.market?.day === today(t) && state.market.filled.includes(w.id);
}

export function marketPrice(state: GameState, w: MarketWant, c: Creature): number {
  return Math.round((sellPrice(state, c, false) * w.mult + w.bonusCoins) / 5) * 5;
}

/** Sell a pet to a buyer on the board. Each want is filled once a day. */
export function fillWant(state: GameState, wantId: string, creatureId: string, t: number): Result<{ coins: number; shards: number; message: string }> {
  const w = marketWants(state, t).find((x) => x.id === wantId);
  if (!w) return { ok: false, error: 'That buyer has gone home.' };
  if (wantFilled(state, w, t)) return { ok: false, error: 'You already sold to this buyer today.' };
  const c = state.creatures.find((x) => x.id === creatureId);
  if (!c) return { ok: false, error: 'Who?' };
  if (!wantMatches(w, c)) return { ok: false, error: `${w.buyer} wants ${w.text.toLowerCase()}.` };
  const why = canSell(state, c);
  if (why) return { ok: false, error: why };
  const coins = marketPrice(state, w, c);
  state.creatures = state.creatures.filter((x) => x !== c);
  state.glimmer += coins;
  state.shards += w.bonusShards;
  if (state.market?.day !== today(t)) state.market = { day: today(t), filled: [] };
  state.market.filled.push(w.id);
  return { ok: true, coins, shards: w.bonusShards, message: `${w.buyer} is thrilled with ${displayName(c)}!` };
}

/** How many of today's wants you could fill right now (for a badge). */
export function marketReady(state: GameState, t: number): number {
  return marketWants(state, t).filter((w) => !wantFilled(state, w, t) && state.creatures.some((c) => !c.trip && wantMatches(w, c) && !canSell(state, c))).length;
}
