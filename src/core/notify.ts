// Gentle reminders: work out which phone notifications are worth sending
// while the keeper is away. Never more than a couple, never at night.

import { species } from '../content/species';
import { EXPEDITIONS, type ExpeditionId } from '../content/expeditions';
import { displayName } from './creatures';
import { nextHungryAt } from './care';
import type { GameState } from './types';

export interface PlannedNote { id: string; at: number; title: string; body: string; priority: number }

const HOUR = 3_600_000;
export const MAX_REMINDERS = 2;
const QUIET_START = 21;
const QUIET_END = 8;

/** Shift a time out of the quiet hours (9pm-8am local) to 8am. */
export function outsideQuietHours(at: number): number {
  const d = new Date(at);
  const h = d.getHours();
  if (h >= QUIET_START) {
    d.setDate(d.getDate() + 1);
    d.setHours(QUIET_END, 0, 0, 0);
  } else if (h < QUIET_END) d.setHours(QUIET_END, 0, 0, 0);
  return d.getTime();
}

export function planNotifications(state: GameState, now: number): PlannedNote[] {
  const out: PlannedNote[] = [];
  // a rare (or rarer) visitor is waiting at a lure
  const rare = state.visitors
    .filter((v) => ['rare', 'legendary', 'mythical'].includes(species(v.creature.species).rarity) && v.until - now > HOUR)
    .sort((a, b) => a.until - b.until)[0];
  if (rare) {
    out.push({ id: 'visitor', at: now + HOUR, priority: 5, title: `A ${species(rare.creature.species).rarity} visitor is waiting!`, body: `A ${species(rare.creature.species).name} is at your lure. It won't wait forever.` });
  }
  // an egg is ready
  const eggs = state.eggs.filter((e) => e.nest !== null && e.progressMs < e.incubationMs);
  const egg = eggs.map((e) => now + (e.incubationMs - e.progressMs)).sort((a, b) => a - b)[0];
  if (egg) out.push({ id: 'egg', at: egg, priority: 4, title: 'An egg is ready to hatch!', body: 'Something is wriggling in the nest. Come see who it is.' });
  // a pet is back from exploring
  const trip = [...state.expeditions].sort((a, b) => a.end - b.end).find((e) => e.end > now);
  if (trip) {
    const c = state.creatures.find((x) => x.id === trip.creatureId);
    const d = EXPEDITIONS[trip.dest as ExpeditionId];
    if (c && d) out.push({ id: 'trip', at: trip.end, priority: 3, title: `${displayName(c)} is home!`, body: `Back from the ${d.name} with treasure and a story.` });
  }
  // the Collector is in town
  if (state.collector.nextAt > now) out.push({ id: 'collector', at: state.collector.nextAt + 5 * 60_000, priority: 2, title: 'The Collector is visiting!', body: `He's paying double for creatures, and triple for ${state.collector.wants} ones.` });
  // hungry pets (lowest priority)
  const hungry = nextHungryAt(state, now);
  if (hungry) out.push({ id: 'hunger', at: hungry, priority: 1, title: 'Your pets are getting peckish', body: 'Pop by with a snack. A feedbag can feed them while you\'re away.' });
  return out
    .map((n) => ({ ...n, at: outsideQuietHours(n.at) }))
    .filter((n) => n.at - now < 24 * HOUR)
    .sort((a, b) => b.priority - a.priority || a.at - b.at)
    .slice(0, MAX_REMINDERS);
}
