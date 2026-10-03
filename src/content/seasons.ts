// Limited-time seasons. Halloween runs from October 1 to November 7: one of
// its spooky skies comes at least once an hour, each leaving its own mark.
// Dates are UTC so every player's schedule is the same pure function of time.

import type { EventKind } from '../core/types';

export const HALLOWEEN_SKIES: EventKind[] = ['haunting', 'boneyard', 'tomb', 'graveyard', 'bloodmoon', 'pumpkinpatch'];

const START = { month: 10, day: 1 };
const END = { month: 11, day: 7 };

/** For playtesting: force the season on or off (null = follow the calendar). */
export const SEASON_OVERRIDE: { halloween: boolean | null } = { halloween: null };

export function inHalloween(t: number): boolean {
  if (SEASON_OVERRIDE.halloween !== null) return SEASON_OVERRIDE.halloween;
  const d = new Date(t);
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  return md >= START.month * 100 + START.day && md <= END.month * 100 + END.day;
}

/** When this year's Halloween season ends (ms), for the countdown. */
export function halloweenEndsAt(t: number): number {
  const y = new Date(t).getUTCFullYear();
  return Date.UTC(y, END.month - 1, END.day + 1);
}
