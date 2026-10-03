import type { QuirkId } from '../content/quirks';

// Core data types shared by simulation, rendering and UI.
// Everything in src/core is pure (no DOM, no three.js) so it can run in tests,
// in offline catch-up, and later on a server for validation.

export type Trait =
  // Habitats — what lures and places attract
  | 'Grove' | 'Tide' | 'Bloom' | 'Mystic' | 'Ember' | 'Reef' | 'Sand' | 'Shore'
  // Kinds — body plans
  | 'Amphibian' | 'Reptile' | 'Insect' | 'Bird' | 'Fish' | 'Mammal' | 'Fungus' | 'Spirit' | 'Dragon' | 'Primate' | 'Arachnid'
  // Mutation traits — acquired, never native
  | 'Lunar' | 'Storm' | 'Giant' | 'Prismatic' | 'Starlit' | 'Frost' | 'Angelic' | 'Infernal' | 'Abyssal' | 'Aurora' | 'Misty';

export type SpeciesId = string;
export type MutationId = 'lunar' | 'storm' | 'giant' | 'prismatic' | 'starlit' | 'frost' | 'angelic' | 'infernal' | 'abyssal' | 'aurora' | 'misty';
/** Very rare events that grant a gift and leave one creature with a legendary mutation. Never summoned by ads. */
export type LegendaryKind = 'angel' | 'infernal' | 'abyssal';
export type LureId = string;
export type ItemId = string;
export type DecorId = string;
export type SpotId = string;
export type IslandId = 'home' | 'volcano' | 'lagoon' | 'beach' | 'desert';
export type Personality = 'energetic' | 'lazy' | 'shy' | 'curious' | 'grumpy' | 'friendly';
export type EventKind = 'storm' | 'eclipse' | 'starry' | 'fullmoon' | 'blizzard' | 'rainbow' | 'aurora' | 'meteor' | 'fog';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythical';
export type Activity = 'day' | 'night' | 'any';
export type Movement = 'hop' | 'walk' | 'scuttle' | 'fly' | 'swim' | 'slither' | 'waddle' | 'float';

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  traits: Trait[];
  rarity: Rarity;
  activity: Activity;
  movement: Movement;
  /** Base species can arrive via lures; hybrids only come from eggs; rewards only from keeper levels. */
  origin: 'wild' | 'hybrid' | 'reward';
  blurb: string;
  /** Shown in the journal before discovery. Should point at experiments, never give the answer. */
  hint: string;
  /** Egg shell colors [base, pattern]. */
  eggColors: [string, string];
  /** Wild species that only answer a lure during this sky event... */
  onlyDuring?: EventKind;
  /** ...and only at these lure spots. */
  onlyAt?: SpotId[];
}

export interface MutationDef {
  id: MutationId;
  trait: Trait;
  name: string; // adjective used in creature names
  blurb: string;
  /** Chance a parent passes this mutation to an egg. */
  inheritChance: number;
  /** How rare it is: rarer mutations glow (see glowLevel). */
  tier: MutationTier;
  /** Glow and aura color. */
  glow: string;
}

export type MutationTier = 'common' | 'rare' | 'epic' | 'legendary';

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
  island: IslandId;
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
  /** Only while this sky event is overhead (its trait then counts in full). */
  sky?: EventKind;
  /** Both parents must carry this trait. */
  both?: Trait;
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
  /** How the event reaches down and changes a resident creature. */
  touch: {
    /** e.g. "sparkfall", "moonbeam" */
    name: string;
    /** Touches per event, spread across its duration. */
    perEvent: number;
    /** Chance a touch actually mutates the creature. */
    chance: number;
    /** Creatures with this trait are 4× more likely to be chosen. */
    favor?: Trait;
    story: string;
    /** Journal line the first time it changes a creature. */
    lesson: string;
    /** Shown in the creature's bubble. */
    bubble: string;
  };
  icon: string;
  /** Toast when it begins / ends, and a line for the away report. */
  arrive: string;
  leave: string;
  away: string;
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
  /** Which island it lives on. */
  island: IslandId;
  /** Grown-up size, rolled at birth (1 = typical). Giant multiplies on top. */
  size: number;
  /** How long it takes to grow up (0 = already grown). Hatchlings start small. */
  growMs: number;
  personality: Personality;
  /** Behaviour traits, 2-5 (see content/quirks.ts). */
  quirks: QuirkId[];
  /** 1 = full, 0 = starving. Empties over about 10 hours. */
  fullness: number;
  /** Favourites can't be sold. */
  favorite?: boolean;
  /** How you met (shown on its card). Missing on creatures from older saves. */
  met?: CreatureOrigin;
  /** In storage: paused (no hunger, no growing), not on any island. */
  stored?: boolean;
  storedAt?: number;
}

export interface Visitor {
  creature: Creature;
  spot: SpotId;
  island: IslandId;
  /** They wander off if nobody says hello in time. */
  until: number;
}

export interface CreatureOrigin {
  how: 'starter' | 'lure' | 'bred' | 'shop' | 'dug' | 'level' | 'island' | 'other';
  /** What was happening in the sky when you met. */
  sky?: EventKind | LegendaryKind | null;
  lure?: string;
  spot?: SpotId;
  parents?: { name: string; species: SpeciesId }[];
  /** Shop egg tier. */
  tier?: string;
  level?: number;
}

export interface Egg {
  id: string;
  species: SpeciesId;
  mutations: MutationId[];
  seed: number;
  source: 'combine' | 'shop' | 'gift' | 'dug';
  parentNames?: [string, string];
  parentSpecies?: [SpeciesId, SpeciesId];
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
  /** A different species than either parent. */
  relative?: boolean;
  parentPersonalities?: Personality[];
  parentQuirks?: QuirkId[][];
  /** Egg shop tier it came from, if bought. */
  tier?: string;
}

export interface ActiveLure {
  lure: LureId;
  placedAt: number;
  expiresAt: number;
  visitors: number;
}

/** A spot on the ground where a creature you drop on it can dig, fish or forage. */
export type DigKind = 'dust' | 'puddle' | 'bush';

export interface DigSpot {
  id: string;
  kind: DigKind;
  island: IslandId;
  x: number;
  z: number;
  expiresAt: number;
}

export interface Gift {
  id: string;
  x: number;
  z: number;
  glimmer: number;
  shards: number;
  from?: string; // creature id
  island: IslandId;
  /** Rare finds when digging. */
  item?: string;
  /** Came from a dig spot you sent a creature to (changes the wording: dug, fished, foraged). */
  via?: DigKind;
  /** A Starshard rock that fell in a meteor shower. */
  meteor?: boolean;
}

export interface ShopOffer {
  id: string;
  kind: 'lure' | 'item' | 'egg' | 'decor' | 'tool' | 'food';
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
  /** Fruit trees: when fruit was last picked (or the tree was planted). */
  harvestedAt?: number;
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
  /** Trait Deleter / Trait Wiper counts. */
  tools: Record<string, number>;
  /** Keeper XP (see core/levels.ts). */
  xp: number;
  /** Daily quests (new each day) and claimed tiers of lasting quests. */
  quests: { day: string; daily: { id: string; progress: number; claimed: boolean }[]; tiers: Record<string, number> };
  /** Lifetime counts that quests read. */
  questStats: Record<string, number>;
  /** Pantry: fruit, snack, feast, feedbag. */
  food: Record<string, number>;
  /** Feedbag portions hanging on each island; they feed hungry creatures while you're away. */
  feedbags: Partial<Record<IslandId, number>>;
  storageSlots: number;
  /** Lure visitors waiting for you to Keep them or Send them away. */
  visitors: Visitor[];
  /** The travelling Collector: pays more than a quick sale, most for one type of creature. */
  collector: { nextAt: number; until: number; wants: Trait };
  hungerNotifiedDay?: string;
  decorOwned: Record<DecorId, number>;
  placedDecor: PlacedDecor[];
  creatures: Creature[];
  islands: Record<IslandId, { owned: boolean; size: number }>;
  eggs: Egg[];
  nests: number;
  spots: Record<SpotId, ActiveLure | null>;
  gifts: Gift[];
  digSpots: DigSpot[];
  shop: ShopState;
  journal: JournalState;
  /** Event occurrences already applied (by window index) so effects don't double up. */
  eventsApplied: Record<string, { kind: EventKind; started: boolean; ended: boolean; touches: number }>;
  /** A legendary event in progress (Angel, Infernal, Abyssal). */
  legendary?: { kind: LegendaryKind; start: number; end: number } | null;
  /** The gift a legendary event left: give one creature any mutation you choose. */
  blessing?: { kind: LegendaryKind; expiresAt: number } | null;
  /** An event summoned by the player (rewarded ad). Takes precedence over the schedule. */
  summoned?: { kind: EventKind; start: number; end: number } | null;
  tutorial: number;
  ads: { day: string; count: number };
  stats: { combines: number; hatches: number; arrivals: number; lures: number };
  nextId: number;
  /** Creature shown in the on-screen widget. */
  pinned?: string;
  savedAt: number;
}

// ---------------------------------------------------------------- sim output

/** Things that happened during a tick. Rendering, UI, audio and analytics react to these. */
export type GameEvent =
  | { type: 'arrival'; creature: Creature; spot: SpotId; discovered: boolean; t: number }
  | { type: 'mutation'; creature: Creature; mutation: MutationId; cause: EventKind; t: number; discovered: boolean }
  /** The sky reached down to a creature (sparkfall, moonbeam, falling star, frost). It may or may not have changed it. */
  | { type: 'skyTouch'; creature: Creature; event: EventKind; changed: boolean; t: number }
  | { type: 'lureExpired'; spot: SpotId; t: number }
  | { type: 'eggReady'; egg: Egg; t: number }
  | { type: 'eggTouched'; egg: Egg; event: EventKind; t: number }
  | { type: 'eventStart'; kind: EventKind; t: number; endsAt: number }
  | { type: 'eventEnd'; kind: EventKind; t: number }
  | { type: 'gift'; gift: Gift; t: number }
  | { type: 'digSpot'; spot: DigSpot; t: number }
  | { type: 'legendary'; kind: LegendaryKind; creature: Creature | null; discovered: boolean; t: number }
  | { type: 'legendaryEnd'; kind: LegendaryKind; t: number }
  | { type: 'collector'; wants: Trait; until: number; t: number }
  | { type: 'visitorLeft'; creature: Creature; t: number }
  | { type: 'shopRefresh'; t: number }
  | { type: 'note'; text: string; t: number };
