// Combining two creatures into an egg.
//
// Design goals: learnable (traits drive outcomes), experiment-friendly (any two
// kindred creatures can try), surprising (outcomes are rolled, not fixed), and
// hard to "solve" with a chart (mutations and the sky change what's possible).

import { WILD_SPECIES, species } from '../content/species';
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
  /** A "distant relative": a different species that shares a trait with a parent. */
  relative?: boolean;
}

export interface CombineOpts {
  /** Species the keeper has already discovered. */
  known?: Set<string>;
  /** Early eggs: always hatch something new, so first-time players feel the discovery loop. */
  forceNew?: boolean;
  /** Species of the keeper's most recent eggs (oldest first), to break up long runs of the same kind. */
  recent?: SpeciesId[];
}

/** Wild, non-legendary species that share a trait with either parent (preferring both). */
function relatives(a: Creature, b: Creature): [SpeciesId, number][] {
  const ta = new Set(creatureTraits(a));
  const tb = new Set(creatureTraits(b));
  return WILD_SPECIES
    .filter((s) => s.rarity !== 'legendary' && s.rarity !== 'mythical' && !s.onlyDuring && s.id !== a.species && s.id !== b.species)
    .map((s): [SpeciesId, number] => {
      const withA = s.traits.some((t) => ta.has(t));
      const withB = s.traits.some((t) => tb.has(t));
      const w = (TUNING.rarityWeight[s.rarity] ?? 1) * (withA && withB ? 3 : withA || withB ? 1 : 0);
      return [s.id, w];
    })
    .filter(([, w]) => w > 0);
}

export function combine(a: Creature, b: Creature, rng: StateRng, sky: EventKind | null, opts: CombineOpts = {}): CombineOutcome {
  const parentTraits = new Set<Trait>([...creatureTraits(a), ...creatureTraits(b)]);
  const skyTrait = sky ? MUTATIONS[EVENTS[sky].mutation].trait : undefined;

  // 1. Resonance: a hybrid may form if the parents (plus the sky) carry the right traits.
  let chosen: ResonanceRule | undefined;
  let skyLent: Trait | undefined;
  // Special-moment (mythical) rules first, then the most specific.
  const rules = [...RESONANCES].sort((x, y) => Number(!!y.sky) - Number(!!x.sky) || y.requires.length - x.requires.length);
  for (const rule of rules) {
    if (rule.result === a.species && rule.result === b.species) continue;
    if (rule.sky && rule.sky !== sky) continue;
    if (rule.both && !(creatureTraits(a).includes(rule.both) && creatureTraits(b).includes(rule.both))) continue;
    const missing = rule.requires.filter((t) => !parentTraits.has(t) && !(rule.sky && t === skyTrait));
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
  let sp = chosen ? chosen.result : rng.chance(0.5) ? a.species : b.species;
  let relative = false;
  const known = opts.known;
  if (opts.forceNew && known && known.has(sp)) {
    // Prefer a hybrid the keeper qualifies for, then an undiscovered relative.
    const hybrid = RESONANCES.find((r) => !r.sky && !r.both && !known.has(r.result) && r.requires.every((t) => parentTraits.has(t)));
    const fresh = relatives(a, b).filter(([id]) => !known.has(id));
    if (hybrid) {
      chosen = hybrid;
      sp = hybrid.result;
    } else if (fresh.length) {
      sp = rng.weighted(fresh) ?? sp;
      relative = true;
    }
  } else if (!chosen && rng.chance(TUNING.distantRelativeChance)) {
    const rel = relatives(a, b);
    if (rel.length) {
      sp = rng.weighted(rel) ?? sp;
      relative = true;
    }
  }

  // 1b. Legendary and mythical parents rarely pass on their own kind: they stay special.
  const rarest = (id: SpeciesId) => ['legendary', 'mythical'].includes(species(id).rarity);
  if (!chosen && !relative && rarest(sp) && rng.chance(species(sp).rarity === 'mythical' ? TUNING.mythicCopyDamp : TUNING.rareCopyDamp)) {
    const other = sp === a.species ? b.species : a.species;
    const rel = relatives(a, b);
    if (!rarest(other)) sp = other;
    else if (rel.length) {
      sp = rng.weighted(rel) ?? sp;
      relative = true;
    }
  }

  // 1c. Variety: after three eggs of the same kind in a row, the next one is something else if it can be.
  const last3 = opts.recent?.slice(-3) ?? [];
  if (last3.length === 3 && last3.every((x) => x === sp)) {
    const other = sp === a.species ? b.species : a.species;
    const rel = relatives(a, b).filter(([id]) => id !== sp);
    if (other !== sp) sp = other;
    else if (rel.length) {
      sp = rng.weighted(rel) ?? sp;
      relative = true;
    }
  }

  // 2. Inheritance: most babies hatch plain. Now and then one parent mutation passes on
  //    (the hardier ones more often), so stacking mutations is a deliberate plan:
  //    breed, then let a sky event touch the egg while it incubates.
  const muts: MutationId[] = [];
  const pool = [...new Set([...a.mutations, ...b.mutations])].filter((m) => MUTATIONS[m]);
  if (pool.length && rng.chance(TUNING.inheritOneChance)) {
    const m = rng.weighted(pool.map((x): [MutationId, number] => [x, MUTATIONS[x].inheritChance]));
    if (m) muts.push(m);
  }

  // 3. New sparks: purebreds may grow Giant; the sky may leave its mark; prismatic is a lightning bolt of luck.
  if (purebred && rng.chance(TUNING.purebredGiantChance)) muts.push('giant');
  if (sky && rng.chance(TUNING.combineEventMutationChance)) muts.push(EVENTS[sky].mutation);
  if (rng.chance(TUNING.prismaticChance)) muts.push('prismatic');

  const native = species(sp).traits;
  const mutations = [...new Set(muts)].filter((m) => !native.includes(MUTATIONS[m].trait));
  return { species: sp, mutations, rule: chosen, skyLent, purebred, relative };
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
  if (sp.rarity === 'mythical') clues.push('It hums. The air around it feels like the moment before thunder.');
  else if (sp.rarity === 'rare' || sp.rarity === 'legendary') clues.push('It takes its time. Whatever is inside is in no hurry.');
  return clues;
}
