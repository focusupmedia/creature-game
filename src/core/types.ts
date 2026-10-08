import type { QuirkId } from '../content/quirks';

// Core data types shared by simulation, rendering and UI.
// Everything in src/core is pure (no DOM, no three.js) so it can run in tests,
// in offline catch-up, and later on a server for validation.

export type Trait =
  // Habitats — what lures and places attract
  | 'Grove' | 'Tide' | 'Bloom' | 'Mystic' | 'Ember' | 'Reef' | 'Sand' | 'Shore' | 'Sky'
  // Kinds — body plans
  | 'Amphibian' | 'Reptile' | 'Insect' | 'Bird' | 'Fish' | 'Mammal' | 'Fungus' | 'Spirit' | 'Dragon' | 'Primate' | 'Arachnid'
  // Mutation traits — acquired, never native
  | 'Lunar' | 'Storm' | 'Giant' | 'Prismatic' | 'Starlit' | 'Frost' | 'Angelic' | 'Infernal' | 'Abyssal' | 'Aurora' | 'Misty'
  | 'Sunkissed' | 'Blossom' | 'Glowing' | 'Breezy' | 'Bubbly' | 'Cosmic' | 'Crystal' | 'Golden'
  // Halloween marks
  | 'Ghostly' | 'Calcified' | 'Mummified' | 'Zombified' | 'Vampire' | 'Pumpkin';

export type SpeciesId = string;
export type MutationId = 'lunar' | 'storm' | 'giant' | 'prismatic' | 'starlit' | 'frost' | 'angelic' | 'infernal' | 'abyssal' | 'aurora' | 'misty'
  | 'sunkissed' | 'blossom' | 'glowing' | 'breezy' | 'bubbly' | 'cosmic' | 'crystal' | 'golden'
  | 'ghostly' | 'calcified' | 'mummified' | 'zombified' | 'vampire' | 'pumpkin';
/** Very rare events that grant a gift and leave one creature with a legendary mutation. Never summoned by ads. */
export type LegendaryKind = 'angel' | 'infernal' | 'abyssal';
export type LureId = string;
export type ItemId = string;
export type DecorId = string;
export type SpotId = string;
export type IslandId = 'home' | 'volcano' | 'lagoon' | 'beach' | 'desert' | 'cloud';
export type Personality = 'energetic' | 'lazy' | 'shy' | 'curious' | 'grumpy' | 'friendly';
export type WandererKind = 'fortune' | 'treasure' | 'chef' | 'gnome' | 'goblin';
export type EventKind = 'storm' | 'eclipse' | 'starry' | 'fullmoon' | 'blizzard' | 'rainbow' | 'aurora' | 'meteor' | 'fog'
  | 'heatwave' | 'blossom' | 'firefly' | 'gale' | 'bubbles' | 'comet'
  // Halloween skies: only during the Halloween season
  | 'haunting' | 'boneyard' | 'tomb' | 'graveyard' | 'bloodmoon' | 'pumpkinpatch';

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
  /** The type it draws in; 'Any' for charmed lures (anyone who lives at the spot). */
  attracts: Trait | 'Any';
  durationMin: number;
  /** Expected visitors per lure (Poisson rate over the duration). */
  expectedVisitors: number;
  price: number;
  /** Flavor text; deliberately sensory, never a stat sheet. */
  scent: string;
  color: string;
  /** Charmed lures: paid in Starshards instead of coins. */
  currency?: 'glimmer' | 'shards';
  /** Charmed lures: how much more often each rarity answers. */
  boost?: Partial<Record<Rarity, number>>;
  grade?: 'epic' | 'legendary' | 'mythical';
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
  /** Opens once the island grows to this size (1 = Medium, 2 = Large). */
  minSize?: number;
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
  /** A rare sky (a Wild Sky Charm can bring it). */
  rare?: boolean;
  /** Only during a limited-time season (e.g. Halloween). */
  season?: 'halloween';
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
  effect: 'giantChance' | 'warmth' | 'grow' | 'shrink' | 'glitter' | 'speedy';
  /** Egg sprays are sold by Mango and each kind works once per egg. */
  spray?: boolean;
}

export interface DecorDef {
  id: DecorId;
  name: string;
  blurb: string;
  price: number;
  currency: 'glimmer' | 'shards';
  /** Premium cosmetics rotate in and out of the shop. */
  rotating: boolean;
  /** How much ground it covers (radius, map units). */
  r?: number;
  /** Catalog group (nature, stone, lights, cozy, fun, magic). */
  cat?: string;
  /** Keeper level needed to buy it. */
  level?: number;
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
  /** Color shade rolled at birth (see content/shades.ts). Older pets: classic. */
  shade?: string;
  /** Friendship points 0-100 (hearts at 10/25/45/70/100), and when you last petted or played. */
  bond?: number;
  pettedAt?: number;
  playedAt?: number;
  /** Away on an expedition until this time (not on its world meanwhile). */
  trip?: number;
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
  /** Growing time skipped by Sprout Snacks. */
  growBoostMs?: number;
  /** The day a best friend last left you its daily present. */
  bfGiftDay?: string;
  personality: Personality;
  /** Behaviour traits, 2-5 (see content/quirks.ts). */
  quirks: QuirkId[];
  /** 1 = full, 0 = starving. Empties over about 10 hours. */
  fullness: number;
  /** Favorites can't be sold. */
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

/** A friend's island as shared in their friend code (a snapshot, not live). */
export interface Friend {
  id: string;
  name: string;
  level: number;
  found: number;
  pets: { species: SpeciesId; mutations: MutationId[]; shade?: string; size: number; name?: string }[];
  addedAt: number;
  updatedAt: number;
}

export interface CreatureOrigin {
  how: 'starter' | 'lure' | 'bred' | 'shop' | 'dug' | 'level' | 'island' | 'pass' | 'other';
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
  /** The placed nest (a PlacedDecor id) it sits in, or null while waiting in the basket. */
  nest: string | null;
  adUsed?: boolean;
  tonic?: boolean;
  warmed?: boolean;
  /** Egg sprays used on it (each kind once). */
  sprays?: string[];
  /** Events that touched the egg during incubation. */
  witnessed: EventKind[];
  /** A different species than either parent. */
  relative?: boolean;
  parentPersonalities?: Personality[];
  parentShades?: (string | undefined)[];
  parentQuirks?: QuirkId[][];
  /** Egg shop tier it came from, if bought. */
  tier?: string;
  /** The sky when the egg was made (for the Journal's "how to find"). */
  laySky?: EventKind;
  /** Made by a Nursery: waits beside it, ready to hatch. */
  nurseryId?: string;
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
  kind: 'lure' | 'item' | 'egg' | 'decor' | 'tool' | 'food' | 'sky';
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
  /** The keeper opened the shop during this stock. */
  viewed?: boolean;
}

export interface Expedition {
  creatureId: string;
  dest: string;
  start: number;
  end: number;
  /** The "back home" notice was shown. */
  announced?: boolean;
}

export interface Wanderer {
  kind: WandererKind;
  island: IslandId;
  x: number;
  z: number;
  arrivedAt: number;
  until: number;
  /** Deals already taken this visit (each is once per visit). */
  done?: string[];
  /** The gnome's decor picks, fixed for the visit. */
  picks?: string[];
}

export interface PlacedDecor {
  id: string;
  decor: DecorId;
  x: number;
  z: number;
  rot: number;
  /** Which world it's on (older saves: home). */
  island?: IslandId;
  /** Fruit trees: when fruit was last picked (or the tree was planted). */
  harvestedAt?: number;
  /** Rarity totems: when their magic runs out (then they crumble away). */
  expiresAt?: number;
  /** Nursery: the pair left here to make eggs, and when the next one comes. */
  pair?: [string, string];
  nextAt?: number;
}

export interface JournalState {
  species: Record<SpeciesId, { firstAt: number; count: number }>;
  mutations: Partial<Record<MutationId, number>>;
  resonances: Record<string, number>;
  notes: { t: number; key: string; text: string }[];
  eventsSeen: Partial<Record<EventKind, number>>;
  /** How you've found each creature: breeding pairs and lures (shown in the Journal). */
  howTo?: Record<SpeciesId, string[]>;
  /** Behaviour traits you've seen on your own pets (first time seen). */
  quirks?: Partial<Record<QuirkId, number>>;
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
  /** This week's mini-event progress (core/weekly.ts). */
  week?: { key: string; progress: number; claimed: boolean; told?: boolean };
  /** Days in a row with a login gift claimed (core/login.ts). */
  streak?: { day: string; count: number; best: number; shield: number };
  /** Friends added by code (core/friends.ts), and my keeper name. */
  friends?: Friend[];
  keeperName?: string;
  keeperId?: string;
  friendGifts?: { day: string; from: string[] };
  /** Achievements earned (core/achievements.ts) and the last scores sent to leaderboards. */
  achieved?: string[];
  boards?: Record<string, number>;
  /** Buttons the keeper has unlocked so far (ui/features.ts). */
  features?: string[];
  /** Lotl's starter quest (core/starter.ts). */
  starter?: { step: number; progress: number; done: boolean; open: boolean; claimable?: boolean; v?: number; startedAt?: number };
  /** Today's whisper about an undiscovered creature (core/rumours.ts). */
  rumour?: { day: string; species: SpeciesId; found: boolean; told?: boolean };
  /** Pantry: fruit, snack, feast, feedbag. */
  food: Record<string, number>;
  /** Feedbag portions hanging on each island; they feed hungry creatures while you're away. */
  feedbags: Partial<Record<IslandId, number>>;
  storageSlots: number;
  /** Lure visitors waiting for you to Keep them or Send them away. */
  visitors: Visitor[];
  /** This week's (or last week's) contest entry: the score is fixed when you enter. */
  contest?: { week: number; entry?: string; name?: string; species?: string; score?: number; claimed?: boolean };
  /** Contest podium finishes. */
  trophies?: number;
  /** Journal pages finished and claimed (collection id → when). */
  collections?: Record<string, number>;
  /** Daily login calendar: the last day claimed (UTC date) and how many days claimed in all. */
  login?: { day: string; claimed: number };
  /** Cloud save: this game's id, and when this device last matched the cloud copy. */
  cloud?: { saveId: string; syncedAt?: number };
  /** Highest keeper level whose coin and Starshard reward has been paid. */
  levelPaid?: number;
  /** The away chest, filled while you were gone and waiting to be opened. */
  awayChest?: { coins: number; shards: number; items: Record<string, number>; hours: number } | null;
  /** Market board: which of today's buyers you've sold to. */
  market?: { day: string; filled: string[]; wants?: unknown[] };
  /** Sky charms (summon an event) by charm id. */
  charms?: Record<string, number>;
  /** The Star Chart shows upcoming sky events until this time; the Telescope shows them forever. */
  chartUntil?: number;
  telescope?: boolean;
  /** Pets away exploring. */
  expeditions: Expedition[];
  /** A traveller visiting one of your worlds right now (only while you're playing). */
  wanderer: Wanderer | null;
  wandererNextAt: number;
  /** The travelling Collector: pays more than a quick sale, most for one type of creature. */
  collector: { nextAt: number; until: number; wants: Trait };
  hungerNotifiedDay?: string;
  decorOwned: Record<DecorId, number>;
  /** Scenery trees the keeper has chopped down, by world (indices in build order). */
  chopped?: Partial<Record<IslandId, number[]>>;
  placedDecor: PlacedDecor[];
  creatures: Creature[];
  islands: Record<IslandId, { owned: boolean; size: number }>;
  eggs: Egg[];
  /** Nests are placed decorations (decor 'nest'); this counts nests bought from the shop (for the price). */
  nestsBought?: number;
  /** Before save v15: how many fixed nests the home pedestals had. */
  nests?: number;
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
  /** Season pass progress (Candy, claimed tiers, whether the paid track is unlocked). */
  pass?: { id: string; points: number; free: number[]; paid: number[]; premium: boolean };
  /** Species of the last few eggs you bred (to break up runs of the same kind). */
  recentEggs?: SpeciesId[];
  /** Hidden: bred eggs since the last legendary, and how many legendaries breeding has given. */
  legendaryPity?: { eggs: number; got: number };
  /** Stocks you looked at in a row without a Legendary / Mythical egg (they're then guaranteed). */
  shopPity?: { legendary: number; mythical: number };
  /** Rewarded ads watched today: `count` for events, hatching and shop refreshes; `coins` for free coins. */
  /** Rewarded ads: event ads per day; free-coin ads come in batches that refill a while after your last watch. */
  ads: { day: string; count: number; coins?: number; coinsAt?: number };
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
  /** A Nursery pair made an egg (maybe while you were away). */
  | { type: 'nurseryEgg'; egg: Egg; island: IslandId; t: number }
  /** A rarity totem's magic ran out and it crumbled away. */
  | { type: 'totemDone'; decor: string; island: IslandId; t: number }
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
  | { type: 'wanderer'; wanderer: Wanderer; t: number }
  | { type: 'expeditionBack'; creatureId: string; dest: string; t: number }
  | { type: 'wandererLeft'; kind: WandererKind; t: number }
  | { type: 'goblin'; did: 'coins' | 'lure' | 'nothing'; coins?: number; spot?: SpotId; t: number }
  | { type: 'shopRefresh'; t: number }
  | { type: 'note'; text: string; t: number };
