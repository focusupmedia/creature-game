// Lotl's starter quest: a short list of easy goals, one at a time, that every
// new keeper gets after the tutorial. It teaches the main loop and pays out
// Lotl's Egg, which always hatches a creature the keeper doesn't have yet.

import { EGG_TIERS, MUTATIONS } from '../content/world';
import { SPECIES } from '../content/species';
import { layEgg, rollEggTier } from './actions';
import type { PlayEvent } from './progress';
import { StateRng } from './rng';
import type { GameState, MutationId, SpeciesId } from './types';

export interface StarterStep { text: string; kind: PlayEvent['kind']; target: number; tip: string }

export const STARTER_STEPS: StarterStep[] = [
  { text: 'Set out a lure', kind: 'lure', target: 1, tip: 'Tap LURES, then a glowing lure spot.' },
  { text: 'Meet a visitor', kind: 'meet', target: 1, tip: 'Tap the ! over a visitor, then Keep it or send it on its way.' },
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

/** Lotl's Egg always holds something that glows. */
const GLOWS: MutationId[] = ['starlit', 'glowing', 'frost', 'misty', 'breezy', 'bubbly'];

/** When tomorrow's egg wakes: 8am tomorrow (local), and at least 8 hours away. */
export function tomorrowMorning(t: number): number {
  const d = new Date(t);
  const wake = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 8).getTime();
  return Math.max(wake, t + 8 * 3_600_000);
}

/** Hand over Lotl's Egg (glowing, a creature you don't have), plus a Sleepy Egg that hatches tomorrow. */
export function claimStarter(state: GameState, t: number): boolean {
  const q = starterState(state);
  if (!q.claimable) return false;
  q.claimable = false;
  q.done = true;
  const rng = new StateRng(state);
  const egg = layEgg(state, lotlSpecies(state), 'shop', t);
  egg.tier = 'lotl';
  const glow = rng.pick(GLOWS.filter((m) => MUTATIONS[m]));
  if (glow && !egg.mutations.includes(glow)) egg.mutations.push(glow);
  egg.incubationMs = Math.min(egg.incubationMs, 180_000);
  const sleepy = layEgg(state, rollEggTier(state, 'sleepy'), 'shop', t);
  sleepy.tier = 'sleepy';
  sleepy.incubationMs = tomorrowMorning(t) - t;
  return true;
}
