// Lure arrivals: who comes depends on the scent, the place, the time of day,
// and the sky. Players learn these relationships by trying combinations.

import { WILD_SPECIES } from '../content/species';
import { EVENTS, LURES, SPOTS } from '../content/world';
import { TUNING } from '../content/tuning';
import { StateRng } from './rng';
import type { EventKind, MutationId, SpeciesDef, SpotId } from './types';

export function arrivalWeights(lureId: string, spotId: SpotId, dark: boolean, sky: EventKind | null): [SpeciesDef, number][] {
  const lure = LURES[lureId];
  const spot = SPOTS[spotId];
  const out: [SpeciesDef, number][] = [];
  for (const sp of WILD_SPECIES) {
    if (!sp.traits.includes(lure.attracts)) continue;
    if (sp.movement === 'swim' && !spot.water) continue;
    if (sp.activity === 'day' && dark) continue;
    if (sp.activity === 'night' && !dark) continue;
    let w = TUNING.rarityWeight[sp.rarity] ?? 1;
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
