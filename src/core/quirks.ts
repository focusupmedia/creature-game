// Rolling, inheriting and changing behaviour traits (quirks).

import { QUIRKS, QUIRK_IDS, TEMPER_QUIRKS, type QuirkId } from '../content/quirks';
import { StateRng } from './rng';
import type { Creature, GameState, Personality } from './types';

export const MIN_QUIRKS = 2;
export const MAX_QUIRKS = 5;

/** How many traits: 2-5, mostly 3. */
function rollCount(rng: StateRng): number {
  return rng.weighted<number>([[2, 3], [3, 3.5], [4, 2.5], [5, 1]]) ?? 3;
}

function fits(q: QuirkId, have: QuirkId[]): boolean {
  if (have.includes(q)) return false;
  if (QUIRKS[q].temper && have.some((h) => QUIRKS[h].temper)) return false;
  return !have.some((h) => QUIRKS[h].clashes?.includes(q) || QUIRKS[q].clashes?.includes(h));
}

/**
 * A fresh set of 2-5 traits. The first is always a temper (personality);
 * parents pass some of theirs on.
 */
export function rollQuirks(rng: StateRng, parents: QuirkId[][] = [], temper?: Personality): QuirkId[] {
  const out: QuirkId[] = [temper ?? rng.pick(TEMPER_QUIRKS) as Personality];
  const n = rollCount(rng);
  for (const q of parents.flat()) {
    if (out.length >= n) break;
    if (!QUIRKS[q].temper && rng.chance(0.35) && fits(q, out)) out.push(q);
  }
  for (let tries = 0; out.length < n && tries < 50; tries++) {
    const q = rng.pick(QUIRK_IDS);
    if (fits(q, out)) out.push(q);
  }
  return out;
}

export function hasQuirk(c: Pick<Creature, 'quirks'>, q: QuirkId): boolean {
  return !!c.quirks?.includes(q);
}

/** The creature's temper: its first personality trait, if it still has one. */
export function temperOf(c: Pick<Creature, 'quirks' | 'personality'>): Personality | null {
  const t = c.quirks?.find((q) => QUIRKS[q].temper);
  return (t as Personality | undefined) ?? null;
}

export type QuirkResult = { ok: true; message: string } | { ok: false; error: string };

/** Trait Deleter: remove one chosen trait (never below 2). */
export function deleteQuirk(state: GameState, creatureId: string, q: QuirkId): QuirkResult {
  const c = state.creatures.find((x) => x.id === creatureId);
  if (!c) return { ok: false, error: 'Who?' };
  if ((state.tools.traitDeleter ?? 0) < 1) return { ok: false, error: 'You need a Trait Deleter from Mango\'s shop.' };
  if (!c.quirks.includes(q)) return { ok: false, error: 'It doesn\'t have that trait.' };
  if (c.quirks.length <= MIN_QUIRKS) return { ok: false, error: `Creatures always keep at least ${MIN_QUIRKS} traits.` };
  c.quirks = c.quirks.filter((x) => x !== q);
  state.tools.traitDeleter -= 1;
  return { ok: true, message: `${QUIRKS[q].name} is gone.` };
}

/** Trait Wiper: wipe every trait and roll a fresh 2-5. */
export function wipeQuirks(state: GameState, creatureId: string): QuirkResult {
  const c = state.creatures.find((x) => x.id === creatureId);
  if (!c) return { ok: false, error: 'Who?' };
  if ((state.tools.traitWiper ?? 0) < 1) return { ok: false, error: 'You need a Trait Wiper from Mango\'s shop.' };
  c.quirks = rollQuirks(new StateRng(state));
  c.personality = c.quirks[0] as Personality;
  state.tools.traitWiper -= 1;
  return { ok: true, message: `Fresh traits: ${c.quirks.map((q) => QUIRKS[q].name).join(', ')}.` };
}
