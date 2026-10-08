// Lotl's starter quest: a short list of easy goals, one at a time, that every
// new keeper gets after the tutorial. It teaches the main loop and pays out
// Lotl's Egg, which always hatches a creature the keeper doesn't have yet.

import { EGG_TIERS } from '../content/world';
import { SPECIES } from '../content/species';
import { layEgg } from './actions';
import type { PlayEvent } from './progress';
import { StateRng } from './rng';
import type { GameState, SpeciesId } from './types';

export interface StarterStep { text: string; kind: PlayEvent['kind']; target: number; tip: string }

export const STARTER_STEPS: StarterStep[] = [
  { text: 'Set out a lure', kind: 'lure', target: 1, tip: 'Tap LURES, then a glowing lure spot.' },
  { text: 'Welcome a visitor', kind: 'arrival', target: 1, tip: 'Tap the ! over a visitor and Keep it.' },
  { text: 'Pet a creature', kind: 'befriend', target: 1, tip: 'Tap a creature, then Pet.' },
  { text: 'Buy an egg from Mango', kind: 'shopEgg', target: 1, tip: 'Tap SHOP, then the EGGS tab.' },
  { text: 'Make an egg', kind: 'breed', target: 1, tip: 'Tap CREATE and pick two pets that match.' },
  { text: 'Hatch 3 eggs', kind: 'hatch', target: 3, tip: 'Tap an egg in a nest when it is ready.' },
];

export function starterState(state: GameState) {
  const q = (state.starter ??= { step: 0, progress: 0, done: false, open: true, v: 2 });
  // v2 dropped the old 4th step (Feed a creature): saves past it move back one
  if (q.v !== 2) { if (q.step > 3 && !q.done) q.step--; q.v = 2; }
  return q;
}

export function starterStep(state: GameState): StarterStep | null {
  const q = starterState(state);
  return q.done || q.step >= STARTER_STEPS.length ? null : STARTER_STEPS[q.step];
}

/** Count something the keeper did. Returns 'step' when a step finishes, 'done' when the last one does. */
export function starterEvent(state: GameState, ev: PlayEvent): 'step' | 'done' | null {
  const q = starterState(state);
  const st = starterStep(state);
  if (!st || ev.kind !== st.kind || q.claimable) return null;
  q.progress++;
  if (q.progress < st.target) return null;
  q.step++;
  q.progress = 0;
  if (q.step >= STARTER_STEPS.length) { q.claimable = true; return 'done'; }
  return 'step';
}

/** A species the keeper has never had (rarer ones less often), for Lotl's Egg. */
export function lotlSpecies(state: GameState): SpeciesId {
  const w = EGG_TIERS.lotl.weights;
  const unseen = SPECIES.filter((s) => s.origin !== 'reward' && s.rarity !== 'mythical' && !state.journal.species[s.id] && !state.creatures.some((c) => c.species === s.id));
  const pool = unseen.map((s) => [s.id, w[s.rarity] ?? 1] as [SpeciesId, number]);
  return new StateRng(state).weighted(pool) ?? 'axolotl';
}

/** Hand over Lotl's Egg. */
export function claimStarter(state: GameState, t: number): boolean {
  const q = starterState(state);
  if (!q.claimable) return false;
  q.claimable = false;
  q.done = true;
  const egg = layEgg(state, lotlSpecies(state), 'shop', t);
  egg.tier = 'lotl';
  return true;
}
