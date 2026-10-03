// Lure arrivals: who comes depends on the scent, the place, the time of day,
// and the sky. Players learn these relationships by trying combinations.

import { WILD_SPECIES } from '../content/species';
import { EVENTS, LURES, SPOTS } from '../content/world';
import { TUNING } from '../content/tuning';
import { StateRng } from './rng';
import type { EventKind, MutationId, SpeciesDef, SpotId } from './types';

/**
 * Rarity decides how often something turns up, whatever else answers the
 * scent: about 62% commons, 28% uncommons, 8% rares, 1.5% legendaries.
 * A lone legendary answering a scent is never a sure thing.
 */
export const RARITY_SHARE: Record<string, number> = { common: 0.62, uncommon: 0.28, rare: 0.08, legendary: 0.015, mythical: 0.005 };

/** Visitor weights; they add up to at most 1 (the rest is "nobody came this time"). */
export function arrivalWeights(lureId: string, spotId: SpotId, dark: boolean, sky: EventKind | null): [SpeciesDef, number][] {
  const raw = rawWeights(lureId, spotId, dark, sky);
  const byTier = new Map<string, number>();
  for (const [sp, w] of raw) byTier.set(sp.rarity, (byTier.get(sp.rarity) ?? 0) + w);
  // sky events make rare-and-up visitors a little more likely
  const boost = (r: string) => (sky && (r === 'rare' || r === 'legendary') ? 1.5 : 1);
  // A rarity nobody answers passes its share down to the next commoner rarity that does
  // (never up), so lures stay busy but legendaries stay rare.
  const share: Record<string, number> = {};
  let carry = 0;
  for (const r of ['mythical', 'legendary', 'rare', 'uncommon', 'common']) {
    const mass = (RARITY_SHARE[r] ?? 0) * boost(r) + carry;
    if (byTier.has(r)) {
      share[r] = mass;
      carry = 0;
    } else carry = mass;
  }
  return raw.map(([sp, w]) => [sp, (share[sp.rarity] ?? 0) * (w / byTier.get(sp.rarity)!)]);
}

function rawWeights(lureId: string, spotId: SpotId, dark: boolean, sky: EventKind | null): [SpeciesDef, number][] {
  const lure = LURES[lureId];
  const spot = SPOTS[spotId];
  const out: [SpeciesDef, number][] = [];
  for (const sp of WILD_SPECIES) {
    if (!sp.traits.includes(lure.attracts)) continue;
    if (sp.movement === 'swim' && !spot.water) continue;
    if (sp.onlyDuring && sp.onlyDuring !== sky) continue;
    if (sp.onlyAt && !sp.onlyAt.includes(spotId)) continue;
    if (sp.activity === 'day' && dark) continue;
    if (sp.activity === 'night' && !dark) continue;
    let w = 1;
    for (const t of sp.traits) w *= spot.affinity[t] ?? 1;
    if (sky) for (const t of sp.traits) w *= EVENTS[sky].attracts[t] ?? 1;
    out.push([sp, w]);
  }
  return out;
}

/** Poisson-ish chance that a visitor arrives within dt for this lure. */
export function arrivalChance(lureId: string, dtMs: number, sky: EventKind | null): number {
  const lure = LURES[lureId];
  let rate = lure.expectedVisitors / (lure.durationMin * 60_000);
  if (sky && EVENTS[sky].empowers === lure.attracts) rate *= 1.6;
  return 1 - Math.exp(-rate * dtMs);
}

export function arrivalMutations(lureId: string, sky: EventKind | null, rng: StateRng): MutationId[] {
  const out: MutationId[] = [];
  if (sky) {
    const ev = EVENTS[sky];
    const p = LURES[lureId].attracts === ev.empowers ? ev.empoweredMutationChance : ev.arrivalMutationChance;
    if (rng.chance(p)) out.push(ev.mutation);
  }
  if (rng.chance(TUNING.prismaticChance)) out.push('prismatic');
  return out;
}
