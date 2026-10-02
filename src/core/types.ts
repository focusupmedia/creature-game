// Core data types shared by simulation, rendering and UI.
// Everything in src/core is pure (no DOM, no three.js) so it can run in tests,
// in offline catch-up, and later on a server for validation.

export type Trait =
  // Habitats — what lures and places attract
  | 'Grove' | 'Tide' | 'Bloom' | 'Mystic'
  // Kinds — body plans
  | 'Amphibian' | 'Reptile' | 'Insect' | 'Bird' | 'Fish' | 'Mammal' | 'Fungus' | 'Spirit'
  // Mutation traits — acquired, never native
  | 'Lunar' | 'Storm' | 'Giant' | 'Prismatic';

export type SpeciesId = string;
export type MutationId = 'lunar' | 'storm' | 'giant' | 'prismatic';
export type LureId = string;
export type ItemId = string;
export type DecorId = string;
export type SpotId = string;
export type EventKind = 'storm' | 'eclipse';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Activity = 'day' | 'night' | 'any';
export type Movement = 'hop' | 'walk' | 'scuttle' | 'fly' | 'swim' | 'slither' | 'waddle' | 'float';

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  traits: Trait[];
  rarity: Rarity;
  activity: Activity;
  movement: Movement;
  /** Base species can arrive via lures; hybrids only come from eggs. */
  origin: 'wild' | 'hybrid';
  blurb: string;
  /** Shown in the journal before discovery. Should point at experiments, never give the answer. */
  hint: string;
  /** Egg shell colors [base, pattern]. */
  eggColors: [string, string];
}

export interface MutationDef {
  id: MutationId;
  trait: Trait;
  name: string; // adjective used in creature names
  blurb: string;
  /** Chance a parent passes this mutation to an egg. */
  inheritChance: number;
}

export interface LureDef {
  id: LureId;
  name: string;
  attracts: Trait;
  durationMin: number;
  /** Expected visitors per lure (Poisson rate over the duration). */
  expectedVisitors: number;
  price: number;
  /** Flavor text; deliberately sensory, never a stat sheet. */
  scent: string;
  color: string;
}

export interface SpotDef {
  id: SpotId;
  name: string;
  x: number;
  z: number;
  /** Habitat bonus multipliers for this location. */
  affinity: Partial<Record<Trait, number>>;
  /** Swimmers can only arrive at water spots. */
  water: boolean;
}

export interface ResonanceRule {
  id: string;
  /** All of these traits must be present across both parents (or the sky, at a discount). */
  requires: Trait[];
  result: SpeciesId;
  chance: number;
}

export interface EventDef {
  kind: EventKind;
  name: string;
  mutation: MutationId;
  /** Trait whose lures become stronger during the event. */
  empowers: Trait;
  /** Arrival weight multipliers by trait. */
  attracts: Partial<Record<Trait, number>>;
  /** Base chance an arrival during the event carries the mutation. */
  arrivalMutationChance: number;
  /** Chance when the lure attracts the empowered trait. */
  empoweredMutationChance: number;
  /** Chance per event that an incubating egg absorbs the mutation. */
  eggMutationChance: number;
  teaser: string;
  durationMin: [number, number];
  /** Counts as night for nocturnal creatures. */
  dark: boolean;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  blurb: string;
  price: number;
  target: 'egg';
  effect: 'giantChance' | 'warmth';
}

export interface DecorDef {
  id: DecorId;
  name: string;
  blurb: string;
  price: number;
  currency: 'glimmer' | 'shards';
  /** Premium cosmetics rotate in and out of the shop. */
  rotating: boolean;
}

// ---------------------------------------------------------------- state

export interface HistoryEntry {
  t: number;
  text: string;
}

export interface Creature {
  id: string;
  species: SpeciesId;
  /** In acquisition order: a creature's identity accumulates. */
  mutations: MutationId[];
  bornAt: number;
  seed: number;
  nickname?: string;
  history: HistoryEntry[];
  /** Arrived but still walking in / eating at a lure. Purely presentational. */
  arrivingAt?: SpotId;
}

export interface Egg {
  id: string;
  species: SpeciesId;
  mutations: MutationId[];
  seed: number;
  source: 'combine' | 'shop' | 'gift';
  parentNames?: [string, string];
  laidAt: number;
  incubationMs: number;
  progressMs: number;
  /** Index of the nest it sits in, or null while waiting in the basket. */
  nest: number | null;
  adUsed?: boolean;
  tonic?: boolean;
  warmed?: boolean;
  /** Events that touched the egg during incubation. */
  witnessed: EventKind[];
}

export interface ActiveLure {
  lure: LureId;
  placedAt: number;
  expiresAt: number;
  visitors: number;
}

export interface Gift {
  id: string;
  x: number;
  z: number;
  glimmer: number;
  shards: number;
  from?: string; // creature id
}

export interface ShopOffer {
  id: string;
  kind: 'lure' | 'item' | 'egg' | 'decor';
  ref: string;
  price: number;
  currency: 'glimmer' | 'shards';
  qty: number;
  stock: number;
}

export interface ShopState {
  rotation: number;
  offers: ShopOffer[];
  nextRefreshAt: number;
}

export interface PlacedDecor {
  id: string;
  decor: DecorId;
  x: number;
  z: number;
  rot: number;
}

export interface JournalState {
  species: Record<SpeciesId, { firstAt: number; count: number }>;
  mutations: Partial<Record<MutationId, number>>;
  resonances: Record<string, number>;
  notes: { t: number; key: string; text: string }[];
  eventsSeen: Partial<Record<EventKind, number>>;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  createdAt: number;
  /** Simulation time of the last tick (ms, epoch-based). */
  lastTick: number;
  /** Debug/time-skip offset added to Date.now(). */
  clockOffset: number;
  glimmer: number;
  shards: number;
  lures: Record<LureId, number>;
  items: Record<ItemId, number>;
  decorOwned: Record<DecorId, number>;
  placedDecor: PlacedDecor[];
  creatures: Creature[];
  eggs: Egg[];
  nests: number;
  spots: Record<SpotId, ActiveLure | null>;
  gifts: Gift[];
  shop: ShopState;
  journal: JournalState;
  /** Event occurrences already applied (by window index) so effects don't double up. */
  eventsApplied: Record<string, { kind: EventKind; started: boolean; ended: boolean; strikes: number; moonbeams: number }>;
  tutorial: number;
  ads: { day: string; count: number };
  stats: { combines: number; hatches: number; arrivals: number; lures: number };
  nextId: number;
  savedAt: number;
}

// ---------------------------------------------------------------- sim output

/** Things that happened during a tick. Rendering, UI, audio and analytics react to these. */
export type GameEvent =
  | { type: 'arrival'; creature: Creature; spot: SpotId; discovered: boolean; t: number }
  | { type: 'mutation'; creature: Creature; mutation: MutationId; cause: 'sparkfall' | 'moonbeam'; t: number; discovered: boolean }
  | { type: 'strike'; creature: Creature; t: number }
  | { type: 'moonbeam'; creature: Creature; t: number }
  | { type: 'lureExpired'; spot: SpotId; t: number }
  | { type: 'eggReady'; egg: Egg; t: number }
  | { type: 'eggTouched'; egg: Egg; event: EventKind; t: number }
  | { type: 'eventStart'; kind: EventKind; t: number; endsAt: number }
  | { type: 'eventEnd'; kind: EventKind; t: number }
  | { type: 'gift'; gift: Gift; t: number }
  | { type: 'shopRefresh'; t: number }
  | { type: 'note'; text: string; t: number };
