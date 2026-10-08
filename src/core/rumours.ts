// Daily Rumours: each day Lotl hears a whisper about one creature the keeper
// has never found, with a much bigger clue than the journal gives. Finding that
// creature the same day pays a bonus. A new day, a new mystery.

import { SPECIES, species } from '../content/species';
import { EVENTS, LURES, RESONANCES, SPOTS } from '../content/world';
import { today } from './quests';
import { StateRng } from './rng';
import type { GameState, SpeciesId } from './types';

export const RUMOUR_REWARD = { coins: 250, shards: 15 };

export interface Rumour { day: string; species: SpeciesId; found: boolean; told?: boolean }

const A_AN = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

/** Today's rumour (a new one each day), or null once every creature has been found. */
export function todaysRumour(state: GameState, t: number): Rumour | null {
  const day = today(t);
  if (state.rumour?.day === day) return state.rumour;
  const owned = (id: string) => state.islands[SPOTS[id]?.island ?? '']?.owned;
  const unknown = SPECIES.filter((s) => s.origin !== 'reward' && !state.journal.species[s.id]);
  // creatures the keeper can actually reach today come first
  const near = unknown.filter((s) => s.origin !== 'wild' || !s.onlyAt || s.onlyAt.some(owned));
  const pool = near.length ? near : unknown;
  if (!pool.length) return null;
  const rng = new StateRng(state);
  state.rumour = { day, species: rng.pick(pool).id, found: false };
  return state.rumour;
}

/** The whisper itself: a real clue, never the name. */
export function rumourText(id: SpeciesId): string {
  const sp = species(id);
  const who = `${A_AN(sp.rarity)} ${sp.rarity} creature`;
  const when = sp.activity === 'night' ? ' after dark' : sp.activity === 'day' ? ' in daylight' : '';
  if (sp.origin === 'wild') {
    const lure = Object.values(LURES).find((l) => l.attracts !== 'Any' && sp.traits.includes(l.attracts));
    const where = sp.onlyAt?.length ? ` at the ${sp.onlyAt.map((s) => SPOTS[s]?.name ?? s).join(' or ')}` : '';
    const sky = sp.onlyDuring ? ` during ${A_AN(EVENTS[sp.onlyDuring].name)} ${EVENTS[sp.onlyDuring].name}` : '';
    return `I heard ${who} answers ${lure ? `the ${lure.name}` : 'a lure'}${where}${sky}${when}!`;
  }
  const rule = RESONANCES.find((r) => r.result === id);
  if (rule) {
    const sky = rule.sky ? ` while ${A_AN(EVENTS[rule.sky].name)} ${EVENTS[rule.sky].name} is overhead` : '';
    return `I heard ${who} hatches when the parents carry ${rule.requires.join(' + ')}${sky}!`;
  }
  return `I heard ${who} is out there... “${sp.hint}”`;
}

/** A new creature was found: was it today's rumour? Pays once and returns true. */
export function checkRumour(state: GameState, sp: SpeciesId, t: number): boolean {
  const r = state.rumour;
  if (!r || r.found || r.species !== sp || r.day !== today(t)) return false;
  r.found = true;
  state.glimmer += RUMOUR_REWARD.coins;
  state.shards += RUMOUR_REWARD.shards;
  return true;
}
