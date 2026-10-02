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
  moonpetal: {
    id: 'moonpetal', name: 'Moonpetal Lure', attracts: 'Mystic', durationMin: 8, expectedVisitors: 1.8,
    price: 60, scent: 'Faintly silver, faintly cold. It smells like a secret.', color: '#b9a6ff',
  },
};

// ---------------------------------------------------------------- lure spots
export const SPOTS: Record<string, SpotDef> = {
  glade: { id: 'glade', name: 'Mossy Glade', x: -3.6, z: 2.4, affinity: { Grove: 1.5, Mystic: 1.3 }, water: false },
  pond: { id: 'pond', name: 'Pond Edge', x: 3.3, z: 0.6, affinity: { Tide: 2, Amphibian: 1.5 }, water: true },
};

// ---------------------------------------------------------------- events
export const EVENTS: Record<EventKind, EventDef> = {
  storm: {
    kind: 'storm', name: 'Thunderstorm', mutation: 'storm', empowers: 'Tide',
    attracts: { Tide: 2, Amphibian: 2, Fish: 1.5 },
    arrivalMutationChance: 0.1, empoweredMutationChance: 0.35, eggMutationChance: 0.2,
    teaser: 'The air feels heavy. The Mossfrogs have started singing.',
    durationMin: [3, 5], dark: false,
  },
  eclipse: {
    kind: 'eclipse', name: 'Eclipse', mutation: 'lunar', empowers: 'Mystic',
    attracts: { Mystic: 3, Spirit: 3 },
    arrivalMutationChance: 0.15, empoweredMutationChance: 0.55, eggMutationChance: 0.25,
    teaser: 'The light looks strange today, as if something is crossing the sun.',
    durationMin: [2.5, 4], dark: true,
  },
};

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
