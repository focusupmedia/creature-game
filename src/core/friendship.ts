// Friendship: pet, feed and play with a creature to fill its hearts (0-5).
// Best friends (5 hearts) follow the keeper around, cheer when picked, and
// bring back better finds. Pets and play have a little cooldown so it stays
// a gentle daily ritual, not a button to mash.

import { displayName } from './creatures';
import type { Creature, GameState } from './types';

const MIN = 60_000;

/** Friendship points needed for each heart. */
export const HEARTS = [10, 25, 45, 70, 100];
export const BOND_MAX = 100;
export const PET_COOLDOWN_MIN = 20;
export const PLAY_COOLDOWN_MIN = 90;

export function hearts(c: Pick<Creature, 'bond'>): number {
  const b = c.bond ?? 0;
  return HEARTS.filter((h) => b >= h).length;
}

export const isBestFriend = (c: Pick<Creature, 'bond'>) => hearts(c) >= 5;
/** Close friends (4+ hearts) dig up a bit more. */
export const findBonus = (c: Pick<Creature, 'bond'>) => (hearts(c) >= 4 ? 1.25 : 1);

export type BondResult = { ok: true; gained: number; hearts: number; newHeart: boolean; message: string } | { ok: false; error: string };

/** Add friendship; reports when a new heart fills in. */
export function addBond(c: Creature, points: number): { gained: number; newHeart: boolean } {
  const before = hearts(c);
  const was = c.bond ?? 0;
  c.bond = Math.min(BOND_MAX, was + points);
  return { gained: c.bond - was, newHeart: hearts(c) > before };
}

function interact(state: GameState, id: string, t: number, kind: 'pet' | 'play'): BondResult {
  const c = state.creatures.find((x) => x.id === id);
  if (!c || c.stored) return { ok: false, error: 'They\'re not here right now.' };
  const last = kind === 'pet' ? c.pettedAt : c.playedAt;
  const wait = (kind === 'pet' ? PET_COOLDOWN_MIN : PLAY_COOLDOWN_MIN) * MIN;
  if (last !== undefined && t - last < wait) {
    const left = Math.ceil((wait - (t - last)) / MIN);
    return { ok: false, error: kind === 'pet' ? `${displayName(c)} is still happy from the last cuddle. Try again in ${left} min.` : `${displayName(c)} is tired from playing. Again in ${left} min.` };
  }
  if (kind === 'pet') c.pettedAt = t;
  else c.playedAt = t;
  const r = addBond(c, kind === 'pet' ? 3 : 6);
  const name = displayName(c);
  const message = r.newHeart
    ? (isBestFriend(c) ? `${name} is now your best friend! They'll follow you around.` : `${name}'s friendship grew to ${hearts(c)} hearts!`)
    : kind === 'pet' ? `${name} loved that.` : `${name} had a great time playing!`;
  return { ok: true, gained: r.gained, hearts: hearts(c), newHeart: r.newHeart, message };
}

export const petCreature = (state: GameState, id: string, t: number) => interact(state, id, t, 'pet');
export const playWith = (state: GameState, id: string, t: number) => interact(state, id, t, 'play');
