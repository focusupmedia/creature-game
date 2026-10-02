import { species } from '../content/species';
import { MUTATIONS } from '../content/world';
import { TUNING } from '../content/tuning';
import type { Creature, GameState, IslandId, MutationId, Personality, SpeciesId, Trait } from './types';
import { StateRng } from './rng';

export function creatureTraits(c: { species: SpeciesId; mutations: MutationId[] }): Trait[] {
  const set = new Set<Trait>(species(c.species).traits);
  for (const m of c.mutations) set.add(MUTATIONS[m].trait);
  return [...set];
}

/** Mutations that actually show (a Moonmoth is already Lunar, so "Lunar Moonmoth" is redundant). */
export function visibleMutations(c: { species: SpeciesId; mutations: MutationId[] }): MutationId[] {
  const native = species(c.species).traits;
  return c.mutations.filter((m) => !native.includes(MUTATIONS[m].trait));
}

const TIER_LEVEL = { common: 0, rare: 1, epic: 2, legendary: 3 } as const;

/**
 * How strongly a creature glows: 0 none, 1 soft (rare mutation), 2 strong
 * (epic), 3 radiant (legendary). Stacking three or more mutations adds a level.
 */
export function glowLevel(c: { species: SpeciesId; mutations: MutationId[] }): number {
  const muts = visibleMutations(c);
  if (!muts.length) return 0;
  const top = Math.max(...muts.map((m) => TIER_LEVEL[MUTATIONS[m].tier]));
  return Math.min(3, top + (muts.length >= 3 ? 1 : 0));
}

/** The rarest visible mutation, whose color the glow takes. */
export function rarestMutation(c: { species: SpeciesId; mutations: MutationId[] }): MutationId | null {
  let best: MutationId | null = null;
  for (const m of visibleMutations(c)) {
    if (!best || TIER_LEVEL[MUTATIONS[m].tier] >= TIER_LEVEL[MUTATIONS[best].tier]) best = m;
  }
  return best;
}

export function speciesTitle(c: { species: SpeciesId; mutations: MutationId[] }): string {
  const adj = visibleMutations(c).map((m) => MUTATIONS[m].name);
  return [...adj, species(c.species).name].join(' ');
}

export function displayName(c: Creature): string {
  return c.nickname ? c.nickname : speciesTitle(c);
}

export function newId(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}${state.nextId.toString(36)}`;
}

export const PERSONALITIES: Record<Personality, { name: string; emoji: string; blurb: string }> = {
  energetic: { name: 'Energetic', emoji: '⚡', blurb: 'Always on the move. Digs a lot and picks playful squabbles.' },
  lazy: { name: 'Lazy', emoji: '😴', blurb: 'Naps whenever it can. Rarely bothers to dig.' },
  shy: { name: 'Shy', emoji: '🙈', blurb: 'Keeps to the edges and hides behind things.' },
  curious: { name: 'Curious', emoji: '🔍', blurb: 'Pokes at everything. Digs up more interesting finds.' },
  grumpy: { name: 'Grumpy', emoji: '😤', blurb: 'Grumbles at neighbours. Squabbles, but means well.' },
  friendly: { name: 'Friendly', emoji: '💕', blurb: 'Says hello to everyone it meets.' },
};
const PERSONALITY_IDS = Object.keys(PERSONALITIES) as Personality[];

export interface CreatureOpts {
  seed?: number;
  island?: IslandId;
  /** Hatchlings start small and grow up. */
  hatchling?: boolean;
  /** Parents' personalities; a child often takes after one of them. */
  parents?: Personality[];
}

/** Grown-up size, mostly in the normal range with rare tiny or huge outliers. */
export function rollSize(rng: StateRng): number {
  const [lo, hi] = TUNING.sizeRange;
  if (rng.chance(TUNING.sizeOutlierChance)) return rng.chance(0.5) ? rng.range(0.6, lo) : rng.range(hi, 1.55);
  return lo + (hi - lo) * ((rng.next() + rng.next()) / 2);
}

export function makeCreature(
  state: GameState, sp: SpeciesId, mutations: MutationId[], t: number, story: string, opts: CreatureOpts = {},
): Creature {
  const rng = new StateRng(state);
  const personality = opts.parents?.length && rng.chance(0.6) ? rng.pick(opts.parents) : rng.pick(PERSONALITY_IDS);
  return {
    id: newId(state, 'c'),
    species: sp,
    mutations: dedupe(mutations),
    bornAt: t,
    seed: opts.seed ?? rng.seed(),
    history: [{ t, text: story }],
    island: opts.island ?? 'home',
    size: rollSize(rng),
    growMs: opts.hatchling ? TUNING.growMin * 60_000 : 0,
    personality,
  };
}

/** 0..1 how grown-up a creature is. */
export function growth(c: Pick<Creature, 'bornAt' | 'growMs'>, t: number): number {
  if (!c.growMs) return 1;
  return Math.min(1, Math.max(0, (t - c.bornAt) / c.growMs));
}

/** Current visual scale: hatchlings start small and grow into their rolled size. */
export function currentScale(c: Pick<Creature, 'bornAt' | 'growMs' | 'size'>, t: number): number {
  const g = growth(c, t);
  const start = TUNING.hatchlingScale;
  return c.size * (start + (1 - start) * (1 - (1 - g) * (1 - g)));
}

export function sizeLabel(size: number): string {
  if (size < 0.8) return 'Tiny';
  if (size < 0.95) return 'Small';
  if (size < 1.12) return 'Average';
  if (size < 1.3) return 'Big';
  return 'Huge';
}

export function hasMutation(c: { species: SpeciesId; mutations: MutationId[] }, m: MutationId): boolean {
  return creatureTraits(c).includes(MUTATIONS[m].trait);
}

/** Adds a mutation if the creature doesn't already carry its trait. Returns true if it changed. */
export function addMutation(c: Creature, m: MutationId, t: number, story: string): boolean {
  if (hasMutation(c, m)) return false;
  c.mutations.push(m);
  c.history.push({ t, text: story });
  return true;
}

function dedupe(ms: MutationId[]): MutationId[] {
  return [...new Set(ms)];
}

export function rollPrismatic(rng: StateRng): MutationId[] {
  return rng.chance(TUNING.prismaticChance) ? ['prismatic'] : [];
}
