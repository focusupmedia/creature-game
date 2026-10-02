import { species } from '../content/species';
import { TUNING } from '../content/tuning';
import type { GameState, MutationId, SpeciesId } from './types';

/** Records a sighting. Returns true the first time a species is ever seen (and pays the discovery reward). */
export function recordSpecies(state: GameState, sp: SpeciesId, t: number): boolean {
  const entry = state.journal.species[sp];
  if (entry) {
    entry.count += 1;
    return false;
  }
  state.journal.species[sp] = { firstAt: t, count: 1 };
  const r = species(sp).origin === 'hybrid' ? TUNING.rewards.newHybrid : TUNING.rewards.newSpecies;
  state.glimmer += r.glimmer;
  state.shards += r.shards;
  return true;
}

export function recordMutation(state: GameState, m: MutationId, t: number): boolean {
  if (state.journal.mutations[m]) return false;
  state.journal.mutations[m] = t;
  state.glimmer += TUNING.rewards.newMutation.glimmer;
  state.shards += TUNING.rewards.newMutation.shards;
  return true;
}

export function recordResonance(state: GameState, id: string, t: number): boolean {
  if (state.journal.resonances[id]) return false;
  state.journal.resonances[id] = t;
  return true;
}

/**
 * Observations are how the game teaches without a wiki: the first time the
 * player causes a relationship, the journal writes it down in plain words.
 */
export function addNote(state: GameState, key: string, text: string, t: number): boolean {
  if (state.journal.notes.some((n) => n.key === key)) return false;
  state.journal.notes.unshift({ t, key, text });
  return true;
}
