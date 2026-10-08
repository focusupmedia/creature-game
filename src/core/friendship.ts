// Friendship: pet, feed and play with a creature to fill its hearts (0-5).
// Best friends (5 hearts) follow the keeper around, cheer when picked, and
// bring back better finds. Pets and play have a little cooldown so it stays
// a gentle daily ritual, not a button to mash.

import { addMutation, displayName } from './creatures';
import { recordMutation } from './journal';
import { hasQuirk } from './quirks';
import { weekBoost } from '../content/weeks';
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
/** Close friends (4 hearts) dig up a bit more, best friends half again as much. */
export const findBonus = (c: Pick<Creature, 'bond'>) => (hearts(c) >= 5 ? 1.5 : hearts(c) >= 4 ? 1.25 : 1);

/** What being best friends (5 hearts) does, for the creature card. */
export const BEST_FRIEND_PERKS = [
  'Follows you around and cheers when you pick it up',
  'Digs, fishes and forages up 50% more',
  'Gets hungry 30% slower',
  'Comes home from trips sooner',
  'Gives you a little present once a day',
];

export type BondResult = { ok: true; gained: number; hearts: number; newHeart: boolean; message: string } | { ok: false; error: string };

/** Add friendship; reports when a new heart fills in. */
/**
 * Add friendship. Some pets (about one in four) are so loved when they first
 * become a best friend that they turn Golden.
 */
export function addBond(c: Creature, points: number, state?: GameState): { gained: number; newHeart: boolean; golden: boolean } {
  const before = hearts(c);
  const was = c.bond ?? 0;
  // Social pets make friends half again as fast
  if (hasQuirk(c, 'social')) points *= 1.5;
  // Cuddle weeks: friends twice as fast
  if (state && points > 0) points *= weekBoost(state.lastTick).hearts;
  c.bond = Math.min(BOND_MAX, was + points);
  const newHeart = hearts(c) > before;
  let golden = false;
  if (state && newHeart && hearts(c) === HEARTS.length && (c.seed >>> 3) % 4 === 0) {
    golden = addMutation(c, 'golden', state.lastTick, 'Became your best friend, and was so loved it turned to gold.');
    if (golden) recordMutation(state, 'golden', state.lastTick);
  }
  return { gained: c.bond - was, newHeart, golden };
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
  const r = addBond(c, kind === 'pet' ? 3 : 6, state);
  const name = displayName(c);
  const message = r.newHeart
    ? (isBestFriend(c) ? `${name} is now your best friend! They'll follow you around.${r.golden ? ' And look: so much love turned it Golden! ✨' : ''}` : `${name}'s friendship grew to ${hearts(c)} hearts!`)
    : kind === 'pet' ? `${name} loved that.` : `${name} had a great time playing!`;
  return { ok: true, gained: r.gained, hearts: hearts(c), newHeart: r.newHeart, message };
}

export const petCreature = (state: GameState, id: string, t: number) => interact(state, id, t, 'pet');
export const playWith = (state: GameState, id: string, t: number) => interact(state, id, t, 'play');
