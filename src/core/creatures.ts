import { species } from '../content/species';
import { MUTATIONS } from '../content/world';
import { TUNING } from '../content/tuning';
import { SHADES, rollShade, type ShadeId } from '../content/shades';
import type { Creature, GameState, IslandId, MutationId, Personality, SpeciesId, Trait } from './types';
import { StateRng } from './rng';
import { rollQuirks } from './quirks';
import type { QuirkId } from '../content/quirks';
import type { CreatureOrigin } from './types';

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

export function speciesTitle(c: { species: SpeciesId; mutations: MutationId[]; shade?: string }): string {
  const adj = visibleMutations(c).map((m) => MUTATIONS[m].name);
  // rare shades show in the name: "Shiny Frost Mossfrog"
  const shade = c.shade && SHADES[c.shade as ShadeId]?.tier !== 'common' ? [SHADES[c.shade as ShadeId].name] : [];
  return [...shade, ...adj, species(c.species).name].join(' ');
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
  /** Parents' traits; some pass on. */
  parentQuirks?: QuirkId[][];
  met?: CreatureOrigin;
  /** An egg spray nudged its size: Grow Mist or Shrink Mist. */
  sizeSpray?: 'grow' | 'shrink';
  /** Parents' color shades; babies often take after one. */
  parentShades?: (string | undefined)[];
}

/** Grown-up size, mostly in the normal range with rare tiny or huge outliers. */
export function rollSize(rng: StateRng): number {
  const [lo, hi] = TUNING.sizeRange;
  // Outliers are unmistakable: a teeny one at a third of normal, or a colossal one twice as big or more.
  // Colossal ones now range all the way up to three and a half times normal.
  if (rng.chance(TUNING.sizeOutlierChance)) return rng.chance(0.5) ? rng.range(0.32, 0.5) : rng.chance(0.3) ? rng.range(2.7, 3.5) : rng.range(1.9, 2.7);
  return lo + (hi - lo) * ((rng.next() + rng.next()) / 2);
}

/** Grow Mist makes a big one (sometimes huge); Shrink Mist a small one (sometimes teeny). */
export function spraySize(rng: StateRng, size: number, spray?: 'grow' | 'shrink'): number {
  if (spray === 'grow') return rng.chance(0.25) ? rng.range(1.9, 3) : Math.max(size, rng.range(1.15, 1.5));
  if (spray === 'shrink') return rng.chance(0.25) ? rng.range(0.35, 0.5) : Math.min(size, rng.range(0.62, 0.85));
  return size;
}

/** Tiny or huge beyond the normal range: worth showing off. */
export function isOutlier(size: number): boolean {
  return size < 0.6 || size > 1.6;
}

export function makeCreature(
  state: GameState, sp: SpeciesId, mutations: MutationId[], t: number, story: string, opts: CreatureOpts = {},
): Creature {
  const rng = new StateRng(state);
  const personality = opts.parents?.length && rng.chance(0.6) ? rng.pick(opts.parents) : rng.pick(PERSONALITY_IDS);
  const size = spraySize(rng, rollSize(rng), opts.sizeSpray);
  const quirks = rollQuirks(rng, opts.parentQuirks, personality);
  return {
    id: newId(state, 'c'),
    species: sp,
    mutations: dedupe(mutations),
    bornAt: t,
    seed: opts.seed ?? rng.seed(),
    history: [{ t, text: story }],
    island: opts.island ?? 'home',
    size,
    growMs: opts.hatchling ? growTime(sp, quirks) : 0,
    personality,
    quirks,
    fullness: 1,
    met: opts.met,
    shade: rollShade(rng, opts.parentShades),
  };
}

/** 0..1 how grown-up a creature is. */
export function growth(c: Pick<Creature, 'bornAt' | 'growMs'> & { growBoostMs?: number }, t: number): number {
  if (!c.growMs) return 1;
  return Math.min(1, Math.max(0, (t - c.bornAt + (c.growBoostMs ?? 0)) / c.growMs));
}

/** How long a hatchling takes to grow up: rarer kinds take longer; Sprouty ones half the time. */
export function growTime(sp: SpeciesId, quirks: QuirkId[] = []): number {
  const ms = TUNING.growMin * 60_000 * (TUNING.growRarity[species(sp).rarity] ?? 1);
  return Math.round(quirks.includes('sprouty') ? ms / 2 : ms);
}

/** Current visual scale: hatchlings start small and grow into their rolled size. */
export function currentScale(c: Pick<Creature, 'bornAt' | 'growMs' | 'size'>, t: number): number {
  const g = growth(c, t);
  const start = TUNING.hatchlingScale;
  return c.size * (start + (1 - start) * (1 - (1 - g) * (1 - g)));
}

export function sizeLabel(size: number): string {
  if (size < 0.6) return '✦ Teeny';
  if (size < 0.95) return 'Small';
  if (size < 1.08) return 'Average';
  if (size < 1.6) return 'Big';
  return '✦ Colossal';
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

/**
 * Typical grown weight (kg) of an average-sized adult. Roughly what a real
 * animal of that kind would weigh, so a beetle is grams and a whale is tonnes.
 */
const BASE_KG: Partial<Record<SpeciesId, number>> = {
  mossfrog: 0.4, pebbleback: 6, glowbeetle: 0.03, petalwing: 0.02, glimmerfin: 0.8, puffwren: 0.05,
  vinecoil: 3, burrowbun: 2, capling: 0.6, fernkit: 4, duskmoth: 0.03, lumewisp: 0.01,
  sunscale: 8, cinderskink: 1.2, emberdrake: 140, coralpuff: 1.5, driftjelly: 2, axolotl: 0.3,
  lilyhop: 0.5, shellshroom: 1, moonmoth: 0.05, thunderwren: 0.1, starkoi: 4, nimbuwhale: 2400,
  starwyrm: 300, mossmonkey: 9, lanternlemur: 3, cindermonk: 12, flamingle: 3.5, pouchbill: 7,
  mistheron: 2.5, sandpincer: 1.2, dunecoil: 5, sunhood: 6, cloudserpent: 450, phoenix: 18,
  kraken: 1800, qilin: 320, hedgehum: 0.8, magmole: 1.5, ashowl: 2, bubblecrab: 0.9,
  glidemanta: 60, sandotter: 9, conchsnail: 0.7, dunefox: 2.5, aurorastag: 220, prismkoi: 5,
  cloudlamb: 30, kitewing: 1.5, zephyrwisp: 0.01, breezedrake: 120, jackalope: 3, kitsune: 8,
  flyingsnake: 1, pegasus: 480, griffin: 350, hippocampus: 260, thunderbird: 90, baku: 180,
  sphinx: 260, unicorn: 450, moonrabbit: 2.5, tanuki: 7, shisa: 40, leviathan: 6000, worldturtle: 9000, pumpkit: 3, wispstag: 180,
  sunmane: 190, embertiger: 160, mossyphant: 900, bamboopanda: 100, waddlefin: 12, duskbat: 0.2,
};

/** Weight in kg right now: grows with the creature, and with its size cubed (Giants are hefty). */
export function weightKg(c: Pick<Creature, 'species' | 'size' | 'bornAt' | 'growMs' | 'mutations'>, t: number): number {
  const scale = currentScale(c, t) * (c.mutations.includes('giant') ? 1.6 : 1);
  return (BASE_KG[c.species] ?? 2) * scale ** 3;
}

/** "450 g", "3.2 kg", "38 kg", "2,400 kg". */
export function fmtWeight(kg: number): string {
  if (kg < 1) return `${Math.max(1, Math.round(kg * 1000))} g`;
  if (kg < 10) return `${kg.toFixed(1)} kg`;
  if (kg < 1000) return `${Math.round(kg)} kg`;
  return `${Math.round(kg).toLocaleString('en-US')} kg`;
}

/**
 * How big a pet looks in the world. The rolled size stays as it is for prices
 * and labels; the picture exaggerates it so sizes are obvious at a glance:
 * Teeny ones are tiny, Small ones clearly small, Big ones big, a Giant stands
 * about 1.5x the shop's height and a Colossal one about 3x (capped so it still
 * fits on its world).
 */
export function displayScale(c: Pick<Creature, 'bornAt' | 'growMs' | 'size' | 'mutations'> & { growBoostMs?: number }, t: number): number {
  const s = c.size;
  const look = s < 0.6 ? s * 0.6 : s <= 1.6 ? Math.pow(s, 1.8) : 6 + (Math.min(s, 3.5) - 1.9) * 1.5;
  const grownPart = currentScale(c, t) / Math.max(0.01, s);
  const giant = c.mutations.includes('giant') ? 4.3 / 1.6 : 1; // the model already carries Giant's own 1.6
  return Math.min(9 / (c.mutations.includes('giant') ? 1.6 : 1), look * grownPart * giant);
}
