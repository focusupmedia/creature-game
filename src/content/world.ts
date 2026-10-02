import { ISLANDS } from './islands';
import type {
  DecorDef, EventDef, EventKind, ItemDef, LureDef, MutationDef, MutationId, ResonanceRule, SpotDef,
} from '../core/types';

// ---------------------------------------------------------------- mutations
// Mutations add, never replace: a creature accumulates them in order.
export const MUTATIONS: Record<MutationId, MutationDef> = {
  lunar: {
    id: 'lunar', trait: 'Lunar', name: 'Lunar', inheritChance: 0.45,
    blurb: 'Silvered by an eclipse. Glows softly in the dark.',
  },
  storm: {
    id: 'storm', trait: 'Storm', name: 'Storm', inheritChance: 0.45,
    blurb: 'Touched by sparkfall. Crackles when excited.',
  },
  giant: {
    id: 'giant', trait: 'Giant', name: 'Giant', inheritChance: 0.35,
    blurb: 'Grew far beyond its kind. Nobody knows why it stopped.',
  },
  prismatic: {
    id: 'prismatic', trait: 'Prismatic', name: 'Prismatic', inheritChance: 0.5,
    blurb: 'Every color at once. Vanishingly rare.',
  },
  starlit: {
    id: 'starlit', trait: 'Starlit', name: 'Starlit', inheritChance: 0.45,
    blurb: 'Kissed by a falling star. Tiny lights twinkle in its coat.',
  },
  frost: {
    id: 'frost', trait: 'Frost', name: 'Frost', inheritChance: 0.45,
    blurb: 'Came through a blizzard frosted over. It leaves a chill wherever it goes.',
  },
};

// ---------------------------------------------------------------- lures
// Lures are named for what they smell like, so players learn by association
// ("river things like riverweed") rather than reading a stat table.
export const LURES: Record<string, LureDef> = {
  mossberry: {
    id: 'mossberry', name: 'Mossberry Lure', attracts: 'Grove', durationMin: 6, expectedVisitors: 2.4,
    price: 20, scent: 'Damp moss and tart berries. The forest leans closer.', color: '#6fbf5a',
  },
  riverweed: {
    id: 'riverweed', name: 'Riverweed Lure', attracts: 'Tide', durationMin: 6, expectedVisitors: 2.2,
    price: 25, scent: 'Cool, green and a little muddy. Smells like a riverbank.', color: '#4fa8d8',
  },
  honeydew: {
    id: 'honeydew', name: 'Honeydew Lure', attracts: 'Bloom', durationMin: 6, expectedVisitors: 2.4,
    price: 35, scent: 'Sticky-sweet nectar. Wings start to hum nearby.', color: '#f2b94b',
  },
  emberpepper: {
    id: 'emberpepper', name: 'Emberpepper Lure', attracts: 'Ember', durationMin: 6, expectedVisitors: 2.2,
    price: 45, scent: 'Smoky and spicy. Your eyes water a little.', color: '#ff6a2a',
  },
  saltkelp: {
    id: 'saltkelp', name: 'Saltkelp Lure', attracts: 'Reef', durationMin: 6, expectedVisitors: 2.4,
    price: 45, scent: 'Briny and fresh, like a wave breaking on coral.', color: '#2ad0c8',
  },
  moonpetal: {
    id: 'moonpetal', name: 'Moonpetal Lure', attracts: 'Mystic', durationMin: 8, expectedVisitors: 1.8,
    price: 60, scent: 'Faintly silver, faintly cold. It smells like a secret.', color: '#b9a6ff',
  },
};

// ---------------------------------------------------------------- lure spots
const V = ISLANDS.volcano;
const L = ISLANDS.lagoon;
export const SPOTS: Record<string, SpotDef> = {
  glade: { id: 'glade', island: 'home', name: 'Mossy Glade', x: -3.6, z: 2.4, affinity: { Grove: 1.5, Mystic: 1.3 }, water: false },
  pond: { id: 'pond', island: 'home', name: 'Pond Edge', x: 3.3, z: 0.6, affinity: { Tide: 2, Amphibian: 1.5 }, water: true },
  vent: { id: 'vent', island: 'volcano', name: 'Lava Vent', x: V.ox + 0.6, z: V.oz + 1.4, affinity: { Ember: 2, Dragon: 1.5 }, water: false },
  ash: { id: 'ash', island: 'volcano', name: 'Ash Field', x: V.ox - 4.2, z: V.oz + 0.2, affinity: { Ember: 1.3, Reptile: 1.5 }, water: false },
  reef: { id: 'reef', island: 'lagoon', name: 'Coral Reef', x: L.ox - 2.2, z: L.oz + 1.2, affinity: { Reef: 2, Fish: 1.5 }, water: true },
  shallows: { id: 'shallows', island: 'lagoon', name: 'Shallows', x: L.ox + 2.6, z: L.oz - 1.4, affinity: { Reef: 1.3, Amphibian: 2, Spirit: 1.5 }, water: true },
};

// ---------------------------------------------------------------- events
export const EVENTS: Record<EventKind, EventDef> = {
  storm: {
    arrive: 'A thunderstorm rolls in. Things may change out there…', leave: 'The storm passes. The air smells clean.', away: 'A thunderstorm passed over the sanctuary.',
    kind: 'storm', name: 'Thunderstorm', icon: '⛈️', mutation: 'storm', empowers: 'Tide',
    attracts: { Tide: 2, Amphibian: 2, Fish: 1.5 },
    arrivalMutationChance: 0.1, empoweredMutationChance: 0.35, eggMutationChance: 0.2,
    teaser: 'The air feels heavy. The Mossfrogs have started singing.',
    durationMin: [3, 5], dark: false,
    touch: {
      name: 'sparkfall', perEvent: 2, chance: 0.3,
      story: 'Was struck by sparkfall during a thunderstorm, and changed.',
      lesson: 'Creatures caught out in a thunderstorm can be changed by sparkfall.',
      bubble: 'Just got zapped by sparkfall ⚡',
    },
  },
  eclipse: {
    arrive: 'The sun is going dark. An eclipse!', leave: 'The light returns.', away: 'The sun went dark in an eclipse.',
    kind: 'eclipse', name: 'Eclipse', icon: '🌘', mutation: 'lunar', empowers: 'Mystic',
    attracts: { Mystic: 3, Spirit: 3 },
    arrivalMutationChance: 0.15, empoweredMutationChance: 0.55, eggMutationChance: 0.25,
    teaser: 'The light looks strange today, as if something is crossing the sun.',
    durationMin: [2.5, 4], dark: true,
    touch: {
      name: 'moonbeam', perEvent: 1, chance: 0.6, favor: 'Mystic',
      story: 'Bathed in a moonbeam during an eclipse. Its colors silvered.',
      lesson: 'An eclipse can silver a creature that stands in its moonbeam.',
      bubble: 'Bathed in a moonbeam 🌙',
    },
  },
  starry: {
    arrive: 'The sky fills with stars. Watch for falling ones!', leave: 'The stars fade back to normal.', away: 'A Starry Night lit up the sky.',
    kind: 'starry', name: 'Starry Night', icon: '🌠', mutation: 'starlit', empowers: 'Bloom',
    attracts: { Insect: 2, Spirit: 2, Bloom: 1.5 },
    arrivalMutationChance: 0.12, empoweredMutationChance: 0.45, eggMutationChance: 0.2,
    teaser: 'The sky is turning clear and deep. Something up there is twinkling more than usual.',
    durationMin: [3, 4.5], dark: true,
    touch: {
      name: 'falling star', perEvent: 2, chance: 0.5, favor: 'Bloom',
      story: 'A falling star landed right beside it. It still twinkles.',
      lesson: 'Falling stars on a Starry Night can leave a creature Starlit.',
      bubble: 'A falling star landed nearby 🌠',
    },
  },
  fullmoon: {
    arrive: 'A full moon rises, huge and bright.', leave: 'The full moon sinks out of sight.', away: 'A full moon rose over the sanctuary.',
    kind: 'fullmoon', name: 'Full Moon', icon: '🌕', mutation: 'lunar', empowers: 'Mystic',
    attracts: { Mystic: 2.5, Spirit: 2, Mammal: 1.5 },
    arrivalMutationChance: 0.2, empoweredMutationChance: 0.6, eggMutationChance: 0.3,
    teaser: 'A huge, bright moon is rising. The night creatures are restless.',
    durationMin: [3, 4.5], dark: true,
    touch: {
      name: 'moonbeam', perEvent: 2, chance: 0.6, favor: 'Mystic',
      story: 'Soaked up the light of a full moon. Its colors silvered.',
      lesson: 'A full moon is even better than an eclipse for silvering creatures.',
      bubble: 'Soaking up the moonlight 🌕',
    },
  },
  blizzard: {
    arrive: 'Snow! A blizzard is sweeping in.', leave: 'The blizzard blows itself out.', away: 'A blizzard swept through the sanctuary.',
    kind: 'blizzard', name: 'Blizzard', icon: '🌨️', mutation: 'frost', empowers: 'Grove',
    attracts: { Mammal: 2, Bird: 1.5, Grove: 1.2 },
    arrivalMutationChance: 0.12, empoweredMutationChance: 0.4, eggMutationChance: 0.2,
    teaser: 'A sharp, cold wind is blowing in. Is that… snow?',
    durationMin: [3, 4.5], dark: false,
    touch: {
      name: 'frost', perEvent: 2, chance: 0.35,
      story: 'Got caught out in a blizzard and came back frosted.',
      lesson: 'Creatures caught out in a blizzard can come back Frost.',
      bubble: 'Covered in snow ❄️',
    },
  },
};

/** Events an ad can summon, with weights. The rarer natural events are favored. */
export const SUMMON_WEIGHTS: Record<EventKind, number> = { storm: 1, eclipse: 1, starry: 1.3, fullmoon: 1.3, blizzard: 1.3 };

// ---------------------------------------------------------------- resonances
// Hybrids come from the *traits* both parents bring, not from fixed species pairs.
// Because mutations add traits, a mutated creature opens combinations its plain
// cousins never could — the chart can't be "solved" by species alone.
// The active sky event lends its trait too, at half strength.
export const RESONANCES: ResonanceRule[] = [
  { id: 'r-nimbuwhale', requires: ['Spirit', 'Tide', 'Storm'], result: 'nimbuwhale', chance: 0.3 },
  { id: 'r-moonmoth', requires: ['Insect', 'Lunar'], result: 'moonmoth', chance: 0.45 },
  { id: 'r-thunderwren', requires: ['Bird', 'Storm'], result: 'thunderwren', chance: 0.45 },
  { id: 'r-starkoi', requires: ['Fish', 'Mystic'], result: 'starkoi', chance: 0.35 },
  { id: 'r-lilyhop', requires: ['Amphibian', 'Bloom'], result: 'lilyhop', chance: 0.35 },
  { id: 'r-shellshroom', requires: ['Reptile', 'Fungus'], result: 'shellshroom', chance: 0.4 },
  { id: 'r-starwyrm', requires: ['Dragon', 'Starlit'], result: 'starwyrm', chance: 0.25 },
];

// ---------------------------------------------------------------- items
export const ITEMS: Record<string, ItemDef> = {
  rootswell: {
    id: 'rootswell', name: 'Rootswell Tonic', target: 'egg', effect: 'giantChance', price: 90,
    blurb: 'A thick, earthy draught. Eggs that drink it tend to hatch... big.',
  },
  warmstone: {
    id: 'warmstone', name: 'Warm Stone', target: 'egg', effect: 'warmth', price: 45,
    blurb: 'Holds the heat of a summer afternoon. Halves the remaining time of one egg.',
  },
};

// ---------------------------------------------------------------- cosmetics
export const DECOR: Record<string, DecorDef> = {
  lantern: { id: 'lantern', name: 'Firefly Lantern', blurb: 'Glows warmly after dusk.', price: 80, currency: 'glimmer', rotating: false },
  flowerbed: { id: 'flowerbed', name: 'Wildflower Patch', blurb: 'A tumble of color.', price: 50, currency: 'glimmer', rotating: false },
  stoneArch: { id: 'stoneArch', name: 'Mossy Arch', blurb: 'Old stones, older moss.', price: 140, currency: 'glimmer', rotating: false },
  mushroomRing: { id: 'mushroomRing', name: 'Fairy Ring', blurb: 'Some say things dance here at night.', price: 110, currency: 'glimmer', rotating: false },
  crystal: { id: 'crystal', name: 'Dreaming Crystal', blurb: 'Hums a note just below hearing. Glows at night.', price: 40, currency: 'shards', rotating: true },
  windchime: { id: 'windchime', name: 'Moonbell Chime', blurb: 'Rings by itself before an eclipse.', price: 35, currency: 'shards', rotating: true },
  sakura: { id: 'sakura', name: 'Blossom Tree', blurb: 'Petals drift across the sanctuary.', price: 55, currency: 'shards', rotating: true },
};

// ---------------------------------------------------------------- egg shop
export interface EggTier {
  id: string;
  name: string;
  blurb: string;
  price: number;
  currency: 'glimmer' | 'shards';
  /** Habitat filter; empty = any wild species. */
  habitats: string[];
  /** Rarity weights for this tier. */
  weights: Record<string, number>;
  colors: [string, string];
}

export const EGG_TIERS: Record<string, EggTier> = {
  meadow: {
    id: 'meadow', name: 'Meadow Egg', price: 120, currency: 'glimmer', habitats: ['Grove', 'Bloom', 'Tide'],
    weights: { common: 10, uncommon: 4, rare: 1, legendary: 0 }, colors: ['#9fe06a', '#ffffff'],
    blurb: 'Something from the forest and the pond. Usually familiar… usually.',
  },
  wild: {
    id: 'wild', name: 'Wanderer Egg', price: 260, currency: 'glimmer', habitats: [],
    weights: { common: 4, uncommon: 6, rare: 3, legendary: 0 }, colors: ['#ffb84d', '#6a3ce0'],
    blurb: 'Found far away. It could be anything wild.',
  },
  ember: {
    id: 'ember', name: 'Ember Egg', price: 300, currency: 'glimmer', habitats: ['Ember'],
    weights: { common: 10, uncommon: 4, rare: 2, legendary: 0 }, colors: ['#3a2e2e', '#ff7a2a'],
    blurb: 'Warm to the touch. Smells a bit like smoke.',
  },
  reef: {
    id: 'reef', name: 'Reef Egg', price: 300, currency: 'glimmer', habitats: ['Reef'],
    weights: { common: 10, uncommon: 5, rare: 2, legendary: 0 }, colors: ['#2ad0c8', '#ffb36a'],
    blurb: 'Wet and salty. Something inside is swimming in circles.',
  },
  starry: {
    id: 'starry', name: 'Starry Egg', price: 60, currency: 'shards', habitats: [],
    weights: { common: 0, uncommon: 6, rare: 4, legendary: 0.6 }, colors: ['#1e2468', '#fff1a8'],
    blurb: 'Always uncommon or rarer, with a small chance of something legendary.',
  },
};
