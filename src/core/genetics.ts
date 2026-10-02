// Combining two creatures into an egg.
//
// Design goals: learnable (traits drive outcomes), experiment-friendly (any two
// kindred creatures can try), surprising (outcomes are rolled, not fixed), and
// hard to "solve" with a chart (mutations and the sky change what's possible).

import { species } from '../content/species';
import { EVENTS, MUTATIONS, RESONANCES } from '../content/world';
import { TUNING } from '../content/tuning';
import { creatureTraits, hasMutation } from './creatures';
import { StateRng } from './rng';
import type { Creature, EventKind, MutationId, ResonanceRule, SpeciesId, Trait } from './types';

export interface Compatibility {
  ok: boolean;
  shared: Trait[];
  reason?: string;
}

/** Two creatures are kindred if they share at least one trait. Mutations add traits, so they open new pairings. */
export function compatibility(a: Creature, b: Creature): Compatibility {
  if (a.id === b.id) return { ok: false, shared: [], reason: 'A creature cannot pair with itself.' };
  const tb = new Set(creatureTraits(b));
  const shared = creatureTraits(a).filter((t) => tb.has(t));
  if (shared.length === 0) {
    return { ok: false, shared, reason: 'They have nothing in common. Kindred creatures share at least one trait.' };
  }
  return { ok: true, shared };
}

export interface CombineOutcome {
  species: SpeciesId;
  mutations: MutationId[];
  rule?: ResonanceRule;
  /** Traits that came from the sky event rather than the parents. */
  skyLent?: Trait;
  purebred: boolean;
}

export function combine(a: Creature, b: Creature, rng: StateRng, sky: EventKind | null): CombineOutcome {
  const parentTraits = new Set<Trait>([...creatureTraits(a), ...creatureTraits(b)]);
  const skyTrait = sky ? MUTATIONS[EVENTS[sky].mutation].trait : undefined;

  // 1. Resonance: a hybrid may form if the parents (plus the sky) carry the right traits.
  let chosen: ResonanceRule | undefined;
  let skyLent: Trait | undefined;
  const rules = [...RESONANCES].sort((x, y) => y.requires.length - x.requires.length);
  for (const rule of rules) {
    if (rule.result === a.species && rule.result === b.species) continue;
    const missing = rule.requires.filter((t) => !parentTraits.has(t));
    let chance = rule.chance;
    if (missing.length === 1 && missing[0] === skyTrait) chance *= TUNING.skyResonanceFactor;
    else if (missing.length > 0) continue;
    if (rng.chance(chance)) {
      chosen = rule;
      if (missing.length) skyLent = skyTrait;
      break;
    }
  }

  const purebred = a.species === b.species;
  const sp = chosen ? chosen.result : rng.chance(0.5) ? a.species : b.species;

  // 2. Inheritance: each parent mutation may pass on.
  const muts: MutationId[] = [];
  const consider = (c: Creature) => {
    for (const m of c.mutations) {
      if (!muts.includes(m) && rng.chance(MUTATIONS[m].inheritChance)) muts.push(m);
    }
  };
  consider(a);
  consider(b);

  // 3. New sparks: purebreds may grow Giant; the sky may leave its mark; prismatic is a lightning bolt of luck.
  if (purebred && rng.chance(TUNING.purebredGiantChance)) muts.push('giant');
  if (sky && rng.chance(TUNING.combineEventMutationChance)) muts.push(EVENTS[sky].mutation);
  if (rng.chance(TUNING.prismaticChance)) muts.push('prismatic');

  const native = species(sp).traits;
  const mutations = [...new Set(muts)].filter((m) => !native.includes(MUTATIONS[m].trait));
  return { species: sp, mutations, rule: chosen, skyLent, purebred };
}

export function incubationMs(sp: SpeciesId, mutations: MutationId[]): number {
  const base = TUNING.incubationMin[species(sp).rarity] ?? 3;
  return (base + mutations.length * TUNING.incubationPerMutationMin) * 60_000;
}

/** Words the egg "says" when inspected. Clues, never answers. */
export function eggClues(e: { species: SpeciesId; mutations: MutationId[]; witnessed?: EventKind[] }, known: boolean): string[] {
  const sp = species(e.species);
  const clues: string[] = [];
  if (sp.origin === 'hybrid' && !known) clues.push('The pattern is unlike anything in your journal.');
  else if (known) clues.push(`The markings look familiar, a bit like a ${sp.name}.`);
  else clues.push('You have never seen markings like these.');
  const habitat = sp.traits.find((t) => ['Grove', 'Tide', 'Bloom', 'Mystic'].includes(t));
  if (habitat === 'Tide') clues.push('The shell is cool and slightly damp.');
  if (habitat === 'Grove') clues.push('It smells faintly of moss.');
  if (habitat === 'Bloom') clues.push('It smells sweet, like nectar.');
  if (habitat === 'Mystic') clues.push('Something inside hums when no one is looking.');
  const has = (m: MutationId) => e.mutations.includes(m) || hasMutation(e, m);
  if (has('giant')) clues.push('It is surprisingly heavy.');
  if (has('lunar')) clues.push('A faint silver light pulses under the shell.');
  if (has('storm')) clues.push('It crackles when you touch it.');
  if (has('starlit')) clues.push('Tiny lights twinkle across the shell.');
  if (has('frost')) clues.push('It is cold, and frost keeps forming on it.');
  if (has('prismatic')) clues.push('The shell shifts color as you turn it.');
  if (sp.rarity === 'rare' || sp.rarity === 'legendary') clues.push('It takes its time. Whatever is inside is in no hurry.');
  return clues;
}
