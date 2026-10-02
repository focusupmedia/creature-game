import { species } from '../content/species';
import { MUTATIONS } from '../content/world';
import { TUNING } from '../content/tuning';
import type { Creature, GameState, MutationId, SpeciesId, Trait } from './types';
import { StateRng } from './rng';

export function creatureTraits(c: { species: SpeciesId; mutations: MutationId[] }): Trait[] {
  const set = new Set<Trait>(species(c.species).traits);
  for (const m of c.mutations) set.add(MUTATIONS[m].trait);
  return [...set];
}

/** Mutations that actually show (a Moonmoth is already Lunar, so "Lunar Moonmoth" is redundant). */
export function visibleMutations(c: { species: SpeciesId; mutations: MutationId[] }): MutationId[] {
  const native = species(c.species).traits;
  return c.mutations.filter((m) => !native.includes(MUTATIONS[m].trait));
}

export function speciesTitle(c: { species: SpeciesId; mutations: MutationId[] }): string {
  const adj = visibleMutations(c).map((m) => MUTATIONS[m].name);
  return [...adj, species(c.species).name].join(' ');
}

export function displayName(c: Creature): string {
  return c.nickname ? c.nickname : speciesTitle(c);
}

export function newId(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}${state.nextId.toString(36)}`;
}

export function makeCreature(
  state: GameState, sp: SpeciesId, mutations: MutationId[], t: number, story: string, seed?: number,
): Creature {
  const rng = new StateRng(state);
  return {
    id: newId(state, 'c'),
    species: sp,
    mutations: dedupe(mutations),
    bornAt: t,
    seed: seed ?? rng.seed(),
    history: [{ t, text: story }],
  };
}

export function hasMutation(c: { species: SpeciesId; mutations: MutationId[] }, m: MutationId): boolean {
  return creatureTraits(c).includes(MUTATIONS[m].trait);
}

/** Adds a mutation if the creature doesn't already carry its trait. Returns true if it changed. */
export function addMutation(c: Creature, m: MutationId, t: number, story: string): boolean {
  if (hasMutation(c, m)) return false;
  c.mutations.push(m);
  c.history.push({ t, text: story });
  return true;
}

function dedupe(ms: MutationId[]): MutationId[] {
  return [...new Set(ms)];
}

export function rollPrismatic(rng: StateRng): MutationId[] {
  return rng.chance(TUNING.prismaticChance) ? ['prismatic'] : [];
}
