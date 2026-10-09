// Legendary events: the Angels, the Eruption (Ember Peak) and the Deep Tide
// (Coral Lagoon). Very rare, never sold or summoned by ads. Each leaves a gift
// you claim by choosing a creature and a change for it, and one creature with
// a legendary mutation (halo and wings, horns and embers, deep-sea glow).

import { LEGENDARY, LEGENDARY_ORDER, GIFTABLE_MUTATIONS, MUTATIONS } from '../content/world';
import { TUNING } from '../content/tuning';
import { addMutation, displayName, growth, hasMutation } from './creatures';
import { recordMutation } from './journal';
import { StateRng } from './rng';
import type { GameEvent, GameState, LegendaryKind, MutationId } from './types';

const MIN = 60_000;

export function startLegendary(state: GameState, kind: LegendaryKind, t: number): GameEvent[] {
  const def = LEGENDARY[kind];
  const rng = new StateRng(state);
  state.legendary = { kind, start: t, end: t + def.durationMin * MIN };
  const pool = state.creatures.filter((c) => !c.stored && !c.trip && (!def.island || c.island === def.island) && !hasMutation(c, def.mutation) && growth(c, t) >= 0.5);
  const c = pool.length ? rng.pick(pool) : null;
  let discovered = false;
  if (c) {
    addMutation(c, def.mutation, t, def.story);
    discovered = recordMutation(state, def.mutation, t);
  }
  state.blessing = { kind, expiresAt: t + TUNING.blessingHours * 60 * MIN };
  return [{ type: 'legendary', kind, creature: c, discovered, t }];
}

/** Runs inside the sim step. */
/** `canStart` false while the keeper is away: a legendary event is something to witness. */
export function stepLegendary(state: GameState, t: number, dt: number, rng: StateRng, out: GameEvent[], canStart = true): void {
  if (state.legendary && t >= state.legendary.end) {
    out.push({ type: 'legendaryEnd', kind: state.legendary.kind, t });
    state.legendary = null;
  }
  if (state.blessing && t >= state.blessing.expiresAt) state.blessing = null;
  if (state.legendary || !canStart) return;
  for (const kind of LEGENDARY_ORDER) {
    const def = LEGENDARY[kind];
    if (def.island && !state.islands[def.island]?.owned) continue;
    if (!rng.chance(1 - Math.exp(-dt / (def.meanHours * 60 * MIN)))) continue;
    out.push(...startLegendary(state, kind, t));
    return;
  }
}

export type BlessingResult = { ok: true; message: string; discovered: boolean } | { ok: false; error: string };

export function claimBlessing(state: GameState, creatureId: string, m: MutationId, t: number): BlessingResult {
  const b = state.blessing;
  if (!b || t >= b.expiresAt) return { ok: false, error: 'The gift has faded.' };
  if (!GIFTABLE_MUTATIONS.includes(m)) return { ok: false, error: 'That change can\'t be given.' };
  const c = state.creatures.find((x) => x.id === creatureId);
  if (!c) return { ok: false, error: 'Who?' };
  if (hasMutation(c, m)) return { ok: false, error: `${displayName(c)} is already ${MUTATIONS[m].name}.` };
  addMutation(c, m, t, `Was given the ${MUTATIONS[m].name} change by ${LEGENDARY[b.kind].name.toLowerCase()}.`);
  const discovered = recordMutation(state, m, t);
  state.blessing = null;
  return { ok: true, message: `${displayName(c)} became ${MUTATIONS[m].name}!`, discovered };
}
