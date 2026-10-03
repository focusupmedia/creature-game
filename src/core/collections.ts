// Collections: finish a page of the journal for a big one-time reward and a
// badge. Each world's creatures, all the everyday mutations, every Mythical,
// every kind of sky, and a rainbow of pet shades.

import { ISLANDS, ISLAND_ORDER } from '../content/islands';
import { SHADE_ORDER } from '../content/shades';
import { SPECIES } from '../content/species';
import { EVENTS, MUTATIONS } from '../content/world';
import type { GameState, IslandId, Trait } from './types';

export interface CollectionDef {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  progress: (s: GameState) => { have: number; total: number };
  reward: { coins: number; shards: number };
}

/** A world's creatures are the ones its habitats attract (Home has four). */
export function worldHabitats(id: IslandId): Trait[] {
  return id === 'home' ? ['Grove', 'Tide', 'Bloom', 'Mystic'] : [ISLANDS[id].habitat];
}

const speciesOf = (id: IslandId) => SPECIES.filter((sp) => sp.origin !== 'reward' && worldHabitats(id).some((t) => sp.traits.includes(t)));

export const COLLECTIONS: CollectionDef[] = [
  ...ISLAND_ORDER.map((id): CollectionDef => ({
    id: `world-${id}`, name: `${ISLANDS[id].name} page`, icon: ISLANDS[id].icon,
    blurb: `Discover every creature that calls ${ISLANDS[id].name} home.`,
    progress: (s) => { const list = speciesOf(id); return { have: list.filter((sp) => s.journal.species[sp.id]).length, total: list.length }; },
    // bigger pages pay more
    reward: { coins: 400 + 120 * speciesOf(id).length, shards: 5 + speciesOf(id).length },
  })),
  {
    id: 'mutations', name: 'Changeling page', icon: '✨', blurb: 'See every everyday mutation (the legendary ones not needed).',
    progress: (s) => { const list = Object.values(MUTATIONS).filter((m) => m.tier !== 'legendary'); return { have: list.filter((m) => s.journal.mutations[m.id]).length, total: list.length }; },
    reward: { coins: 2500, shards: 25 },
  },
  {
    id: 'skies', name: 'Weather Watcher page', icon: '🌈', blurb: 'Live through every kind of sky event.',
    progress: (s) => { const list = Object.keys(EVENTS); return { have: list.filter((k) => s.journal.eventsSeen[k as keyof typeof EVENTS]).length, total: list.length }; },
    reward: { coins: 1500, shards: 15 },
  },
  {
    id: 'mythicals', name: 'Myth Keeper page', icon: '✦', blurb: 'Discover every Mythical creature.',
    progress: (s) => { const list = SPECIES.filter((sp) => sp.rarity === 'mythical' && sp.origin !== 'reward'); return { have: list.filter((sp) => s.journal.species[sp.id]).length, total: list.length }; },
    reward: { coins: 5000, shards: 50 },
  },
  {
    id: 'shades', name: 'Rainbow of Shades', icon: '🎨', blurb: 'Keep pets of six different color shades at the same time.',
    progress: (s) => ({ have: Math.min(6, new Set(s.creatures.map((c) => c.shade ?? 'classic').filter((x) => SHADE_ORDER.includes(x as never))).size), total: 6 }),
    reward: { coins: 1200, shards: 12 },
  },
];

export function collectionDone(s: GameState, c: CollectionDef): boolean {
  const p = c.progress(s);
  return p.total > 0 && p.have >= p.total;
}

export function claimableCollections(s: GameState): CollectionDef[] {
  return COLLECTIONS.filter((c) => s.collections?.[c.id] === undefined && collectionDone(s, c));
}

export function claimCollection(s: GameState, id: string, t: number): { ok: true; def: CollectionDef } | { ok: false; error: string } {
  const def = COLLECTIONS.find((c) => c.id === id);
  if (!def) return { ok: false, error: 'Unknown page.' };
  if (s.collections?.[id] !== undefined) return { ok: false, error: 'Already claimed.' };
  if (!collectionDone(s, def)) return { ok: false, error: 'Not finished yet.' };
  (s.collections ??= {})[id] = t;
  s.glimmer += def.reward.coins;
  s.shards += def.reward.shards;
  return { ok: true, def };
}
