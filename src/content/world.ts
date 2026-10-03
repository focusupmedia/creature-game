import { ISLANDS } from './islands';
import type {
  DigKind, IslandId, LegendaryKind, DecorDef, EventDef, EventKind, ItemDef, LureDef, MutationDef, MutationId, ResonanceRule, SpotDef,
} from '../core/types';

// ---------------------------------------------------------------- mutations
// Mutations add, never replace: a creature accumulates them in order.
export const MUTATIONS: Record<MutationId, MutationDef> = {
  lunar: {
    id: 'lunar', trait: 'Lunar', name: 'Lunar', inheritChance: 0.45, tier: 'common', glow: '#b9c6ff',
    blurb: 'Silvered by an eclipse. Glows softly in the dark.',
  },
  storm: {
    id: 'storm', trait: 'Storm', name: 'Storm', inheritChance: 0.45, tier: 'common', glow: '#ffe14d',
    blurb: 'Touched by sparkfall. Crackles when excited.',
  },
  giant: {
    id: 'giant', trait: 'Giant', name: 'Giant', inheritChance: 0.35, tier: 'rare', glow: '#ffb36a',
    blurb: 'Grew far beyond its kind. Nobody knows why it stopped.',
  },
  prismatic: {
    id: 'prismatic', trait: 'Prismatic', name: 'Prismatic', inheritChance: 0.5, tier: 'epic', glow: '#ff7ae0',
    blurb: 'Every color at once. Vanishingly rare.',
  },
  starlit: {
    id: 'starlit', trait: 'Starlit', name: 'Starlit', inheritChance: 0.45, tier: 'rare', glow: '#c9b8ff',
    blurb: 'Kissed by a falling star. Tiny lights twinkle in its coat.',
  },
  frost: {
    id: 'frost', trait: 'Frost', name: 'Frost', inheritChance: 0.45, tier: 'rare', glow: '#9fe0ff',
    blurb: 'Came through a blizzard frosted over. It leaves a chill wherever it goes.',
  },
  angelic: {
    id: 'angelic', trait: 'Angelic', name: 'Angelic', inheritChance: 0.25, tier: 'legendary', glow: '#fff3b0',
    blurb: 'Touched by visiting angels. A golden halo and soft white wings.',
  },
  infernal: {
    id: 'infernal', trait: 'Infernal', name: 'Infernal', inheritChance: 0.25, tier: 'legendary', glow: '#ff5a2a',
    blurb: 'Kissed by the heart of the volcano. Little horns and a tail of embers.',
  },
  aurora: {
    id: 'aurora', trait: 'Aurora', name: 'Aurora', inheritChance: 0.4, tier: 'epic', glow: '#5affc0',
    blurb: 'Soaked up the northern lights. Ribbons of green and violet ripple over it.',
  },
  misty: {
    id: 'misty', trait: 'Misty', name: 'Misty', inheritChance: 0.45, tier: 'rare', glow: '#dfe9f2',
    blurb: 'Wandered out of a magic fog and kept a little of it. Soft wisps drift around it.',
  },
  abyssal: {
    id: 'abyssal', trait: 'Abyssal', name: 'Abyssal', inheritChance: 0.25, tier: 'legendary', glow: '#3affe0',
    blurb: 'Came back from the deep tide glowing like the bottom of the sea.',
  },
};

// ---------------------------------------------------------------- legendary events
// Very rare and never for sale or summoned by ads. Each leaves a gift (give
// one creature any mutation you choose) and one creature with a legendary mutation.
export interface LegendaryDef {
  name: string;
  icon: string;
  mutation: MutationId;
  /** Where it happens: null for anywhere; otherwise only once you own that island, touching its creatures. */
  island: IslandId | null;
  meanHours: number;
  durationMin: number;
  arrive: string;
  leave: string;
  giftTitle: string;
  giftBlurb: string;
  story: string;
}

export const LEGENDARY: Record<LegendaryKind, LegendaryDef> = {
  angel: {
    name: 'Angels', icon: '👼', mutation: 'angelic', island: null, meanHours: 18, durationMin: 3,
    arrive: 'The clouds part… angels are descending!', leave: 'The angels drift back up into the light.',
    giftTitle: 'A gift from the angels', giftBlurb: 'Choose a creature, then choose any change for it.',
    story: 'Was visited by angels and left with a halo and wings.',
  },
  infernal: {
    name: 'The Eruption', icon: '🌋', mutation: 'infernal', island: 'volcano', meanHours: 24, durationMin: 3,
    arrive: 'Ember Peak rumbles awake… the volcano erupts!', leave: 'The volcano settles back to a warm, sleepy glow.',
    giftTitle: 'A gift from the volcano', giftBlurb: 'The fire offers one change. Choose a creature, then the change.',
    story: 'Stood too close to the eruption and came back Infernal.',
  },
  abyssal: {
    name: 'The Deep Tide', icon: '🌊', mutation: 'abyssal', island: 'lagoon', meanHours: 24, durationMin: 3,
    arrive: 'The lagoon glows… a deep tide is rising from below!', leave: 'The deep tide sinks back into the dark.',
    giftTitle: 'A gift from the deep', giftBlurb: 'Something old offers one change. Choose a creature, then the change.',
    story: 'Swam down into the deep tide and came back Abyssal.',
  },
};

export const LEGENDARY_ORDER: LegendaryKind[] = ['angel', 'infernal', 'abyssal'];

/** Mutations a legendary gift can grant (legendary ones only come from the events themselves). */
export const GIFTABLE_MUTATIONS: MutationId[] = ['lunar', 'storm', 'frost', 'starlit', 'giant', 'prismatic'];

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
  seaspray: {
    id: 'seaspray', name: 'Seaspray Lure', attracts: 'Shore', durationMin: 6, expectedVisitors: 2.4,
    price: 50, scent: 'Salty breeze and sun-warmed shells. Feathers ruffle nearby.', color: '#ff9ec4',
  },
  sunbaked: {
    id: 'sunbaked', name: 'Sunbaked Lure', attracts: 'Sand', durationMin: 6, expectedVisitors: 2.2,
    price: 55, scent: 'Hot dust and cactus flowers. Something clicks in the dunes.', color: '#f2b04a',
  },
  moonpetal: {
    id: 'moonpetal', name: 'Moonpetal Lure', attracts: 'Mystic', durationMin: 8, expectedVisitors: 1.8,
    price: 60, scent: 'Faintly silver, faintly cold. It smells like a secret.', color: '#b9a6ff',
  },
};

// ---------------------------------------------------------------- lure spots
const V = ISLANDS.volcano;
const L = ISLANDS.lagoon;
const B = ISLANDS.beach;
const D = ISLANDS.desert;
export const SPOTS: Record<string, SpotDef> = {
  glade: { id: 'glade', island: 'home', name: 'Mossy Glade', x: -2.4, z: 4.9, affinity: { Grove: 1.5, Mystic: 1.3 }, water: false },
  pond: { id: 'pond', island: 'home', name: 'Pond Edge', x: 3.0, z: 2.7, affinity: { Tide: 2, Amphibian: 1.5 }, water: true },
  vent: { id: 'vent', island: 'volcano', name: 'Lava Vent', x: V.ox + 0.6, z: V.oz + 1.4, affinity: { Ember: 2, Dragon: 1.5 }, water: false },
  ash: { id: 'ash', island: 'volcano', name: 'Ash Field', x: V.ox - 4.2, z: V.oz + 0.2, affinity: { Ember: 1.3, Reptile: 1.5 }, water: false },
  reef: { id: 'reef', island: 'lagoon', name: 'Coral Reef', x: L.ox - 2.2, z: L.oz + 1.2, affinity: { Reef: 2, Fish: 1.5 }, water: true },
  tidepool: { id: 'tidepool', island: 'beach', name: 'Tide Pool', x: B.ox - 2.4, z: B.oz + 1.8, affinity: { Shore: 1.5, Tide: 2, Fish: 1.3 }, water: true },
  dunegrass: { id: 'dunegrass', island: 'beach', name: 'Dune Grass', x: B.ox + 2.0, z: B.oz + 3.0, affinity: { Shore: 2, Bird: 1.5 }, water: false },
  oasis: { id: 'oasis', island: 'desert', name: 'Oasis', x: D.ox - 1.6, z: D.oz - 1.8, affinity: { Sand: 1.5, Tide: 1.5 }, water: true },
  sandpit: { id: 'sandpit', island: 'desert', name: 'Sand Pit', x: D.ox + 2.4, z: D.oz + 0.8, affinity: { Sand: 2, Reptile: 1.5, Arachnid: 1.5 }, water: false },
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
  rainbow: {
    arrive: 'Sun and rain together… a rainbow arcs over the island!', leave: 'The rainbow fades away.', away: 'A rainbow arced over the island.',
    kind: 'rainbow', name: 'Rainbow', icon: '🌈', mutation: 'prismatic', empowers: 'Bloom',
    attracts: { Bloom: 2, Insect: 1.5, Bird: 1.5 },
    arrivalMutationChance: 0.05, empoweredMutationChance: 0.12, eggMutationChance: 0.08,
    teaser: 'A soft sunshower is falling. Keep an eye on the sky for colours.',
    durationMin: [2.5, 4], dark: false,
    touch: {
      name: 'end of the rainbow', perEvent: 1, chance: 0.2, favor: 'Bloom',
      story: 'Stood right at the end of a rainbow. Every colour stuck to it.',
      lesson: 'A creature at the end of a rainbow can turn Prismatic. Rainbows make Prismatic far more likely.',
      bubble: 'Standing at the end of the rainbow 🌈',
    },
  },
  aurora: {
    arrive: 'Ribbons of green and violet light are dancing in the sky. An aurora!', leave: 'The aurora flickers out.', away: 'The northern lights danced over the island.',
    kind: 'aurora', name: 'Aurora', icon: '🌌', mutation: 'aurora', empowers: 'Reef',
    attracts: { Bird: 2, Spirit: 2, Mammal: 1.2 },
    arrivalMutationChance: 0.1, empoweredMutationChance: 0.3, eggMutationChance: 0.15,
    teaser: 'The night is very clear and very cold. Something is shimmering at the edge of the sky.',
    durationMin: [3, 4.5], dark: true,
    touch: {
      name: 'aurora light', perEvent: 2, chance: 0.4, favor: 'Spirit',
      story: 'Soaked up the aurora until its coat rippled green and violet.',
      lesson: 'Creatures that bathe in an aurora can come away Aurora-touched.',
      bubble: 'Glowing under the aurora 🌌',
    },
  },
  meteor: {
    arrive: 'Shooting stars everywhere! A meteor shower. Watch for glowing rocks landing.', leave: 'The last shooting star fizzles out.', away: 'A meteor shower rained Starshard rocks on the island.',
    kind: 'meteor', name: 'Meteor Shower', icon: '☄️', mutation: 'starlit', empowers: 'Ember',
    attracts: { Dragon: 2, Reptile: 1.5, Spirit: 1.5 },
    arrivalMutationChance: 0.1, empoweredMutationChance: 0.3, eggMutationChance: 0.15,
    teaser: 'Little streaks of light keep flashing high above. More are coming.',
    durationMin: [2.5, 4], dark: true,
    touch: {
      name: 'shooting star', perEvent: 1, chance: 0.4,
      story: 'A shooting star whizzed right past it. A few sparks stayed.',
      lesson: 'Meteor showers drop Starshard rocks you can pick up, and can leave a creature Starlit.',
      bubble: 'A shooting star whizzed past ☄️',
    },
  },
  fog: {
    arrive: 'A soft, magic fog rolls in. Shy visitors love it.', leave: 'The fog lifts.', away: 'A magic fog drifted over the island.',
    kind: 'fog', name: 'Misty Fog', icon: '🌫️', mutation: 'misty', empowers: 'Mystic',
    attracts: { Spirit: 3, Mystic: 2, Fungus: 1.5 },
    arrivalMutationChance: 0.15, empoweredMutationChance: 0.4, eggMutationChance: 0.2,
    teaser: 'The air is getting damp and still. Something shy might come out of hiding.',
    durationMin: [3, 5], dark: false,
    touch: {
      name: 'mist', perEvent: 2, chance: 0.35, favor: 'Spirit',
      story: 'Wandered into the magic fog and came back Misty.',
      lesson: 'Shy and magical creatures visit in a fog, and some come back Misty.',
      bubble: 'Lost in the fog 🌫️',
    },
  },
};

/** Events an ad can summon, with weights. The rarer natural events are favored. */
export const SUMMON_WEIGHTS: Record<EventKind, number> = {
  storm: 1, eclipse: 1, starry: 1.3, fullmoon: 1.3, blizzard: 1.3, rainbow: 1.1, aurora: 1.3, meteor: 1.3, fog: 1,
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
  { id: 'r-starwyrm', requires: ['Dragon', 'Starlit'], result: 'starwyrm', chance: 0.25 },
  { id: 'r-mistheron', requires: ['Bird', 'Shore', 'Tide'], result: 'mistheron', chance: 0.35 },
  { id: 'r-sunhood', requires: ['Reptile', 'Arachnid', 'Sand'], result: 'sunhood', chance: 0.25 },
  // Mythicals: only in a special moment, with the sky's trait counting in full.
  { id: 'r-cloudserpent', requires: ['Dragon', 'Storm'], both: 'Dragon', sky: 'storm', result: 'cloudserpent', chance: 0.35 },
  { id: 'r-phoenix', requires: ['Bird', 'Ember'], sky: 'eclipse', result: 'phoenix', chance: 0.35 },
  { id: 'r-qilin', requires: ['Dragon', 'Mammal', 'Mystic'], sky: 'starry', result: 'qilin', chance: 0.35 },
];

// ---------------------------------------------------------------- dig spots
// Little signs on the ground. Drop a creature on one and it digs, fishes or
// forages there for a find. Swimmers can only fish.
export interface DigKindDef {
  name: string;
  verb: string;
  icon: string;
  /** Where it can appear (weights). */
  islands: Partial<Record<IslandId, number>>;
  glimmer: [number, number];
  shardChance: number;
  itemChance: number;
  items: string[];
  eggChance: number;
}

export const DIG_KINDS: Record<DigKind, DigKindDef> = {
  dust: {
    name: 'Sparkly dust', verb: 'Dug up', icon: '✨', islands: { home: 3, volcano: 4, lagoon: 3, beach: 3, desert: 5 },
    glimmer: [12, 28], shardChance: 0.12, itemChance: 0.06, items: ['warmstone', 'rootswell'], eggChance: 0.03,
  },
  puddle: {
    name: 'Bubbling puddle', verb: 'Fished up', icon: '🫧', islands: { home: 2, lagoon: 3, beach: 3, desert: 1 },
    glimmer: [8, 22], shardChance: 0.08, itemChance: 0.08, items: ['rootswell'], eggChance: 0.01,
  },
  bush: {
    name: 'Berry bush', verb: 'Foraged', icon: '🫐', islands: { home: 3, lagoon: 1, volcano: 1, beach: 1, desert: 1 },
    glimmer: [6, 16], shardChance: 0.05, itemChance: 0.12, items: ['rootswell', 'warmstone'], eggChance: 0,
  },
};

// ---------------------------------------------------------------- food
export const FOODS: Record<string, { id: string; name: string; icon: string; blurb: string; price: number; amount: number }> = {
  fruit: { id: 'fruit', name: 'Berry', icon: '🫐', blurb: 'Fresh from your Berry Trees. Fills a creature halfway.', price: 0, amount: 0.5 },
  snack: { id: 'snack', name: 'Crunchy Snack', icon: '🍪', blurb: 'Fills one creature halfway.', price: 15, amount: 0.5 },
  feast: { id: 'feast', name: 'Feast Basket', icon: '🧺', blurb: 'Feeds everyone on an island a big meal.', price: 90, amount: 0.6 },
  feedbag: { id: 'feedbag', name: 'Feedbag', icon: '🎒', blurb: 'Hang it on an island: 20 portions that feed hungry creatures while you\'re away.', price: 150, amount: 20 },
};

// ---------------------------------------------------------------- tools (used on creatures)
export const TOOLS: Record<string, { id: string; name: string; icon: string; blurb: string; price: number }> = {
  traitDeleter: { id: 'traitDeleter', name: 'Trait Deleter', icon: '✂️', price: 30, blurb: 'Remove one trait you choose from a creature (it keeps at least 2).' },
  traitWiper: { id: 'traitWiper', name: 'Trait Wiper', icon: '🧽', price: 20, blurb: 'Wipe all of a creature\'s traits and roll a fresh set of 2 to 5.' },
};

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
  fruittree: { id: 'fruittree', name: 'Berry Tree', blurb: 'Grows a fresh berry every hour and a half. Tap it to pick them.', price: 150, currency: 'glimmer', rotating: false },
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
