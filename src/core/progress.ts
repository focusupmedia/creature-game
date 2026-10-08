// Things the player does, reported by the game so levels (and quests) can
// count them. Idle time never produces these.

import { TUNING } from '../content/tuning';
import type { SpeciesId } from './types';

export type PlayEvent =
  | { kind: 'lure' }
  | { kind: 'breed' }
  | { kind: 'hatch'; species: SpeciesId; newSpecies: boolean; newMutations: number; mutated?: boolean }
  | { kind: 'gift'; glimmer: number; shards: number; byCreature: boolean }
  | { kind: 'digSpot' }
  | { kind: 'shopEgg' }
  | { kind: 'blessing' }
  | { kind: 'arrival'; species: SpeciesId; isNew: boolean }
  | { kind: 'sold'; coins: number; count?: number }
  | { kind: 'market' }
  | { kind: 'befriend' }
  | { kind: 'feed' }
  | { kind: 'trip' }
  | { kind: 'deal' }
  /** Met a lure visitor: kept it or sent it on its way. */
  | { kind: 'meet'; kept: boolean };

export function xpFor(ev: PlayEvent): number {
  const X = TUNING.xp;
  switch (ev.kind) {
    case 'lure': return X.lure;
    case 'breed': return X.breed;
    case 'hatch': return X.hatch + (ev.newSpecies ? X.newSpecies : 0) + ev.newMutations * X.newMutation;
    case 'gift': return ev.byCreature ? 0 : X.gift;
    case 'digSpot': return X.digSpot;
    case 'shopEgg': return X.shopEgg;
    case 'blessing': return X.blessing;
    case 'arrival': return ev.isNew ? X.arrivalNew : 0;
    case 'sold': return 0;
    case 'market': return X.market ?? 15;
    case 'befriend': return X.befriend ?? 2;
    case 'feed': return 0;
    case 'trip': return X.trip ?? 10;
    case 'deal': return X.deal ?? 5;
    case 'meet': return 0;
  }
}
