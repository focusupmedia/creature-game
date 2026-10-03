import { ISLANDS } from './islands';
import { DECOR_LIST } from './decor';
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
  sunkissed: {
    id: 'sunkissed', trait: 'Sunkissed', name: 'Sunkissed', inheritChance: 0.45, tier: 'common', glow: '#ffc04a',
    blurb: 'Basked through a heatwave. Warm golden coat, freckled with sunspots.',
  },
  blossom: {
    id: 'blossom', trait: 'Blossom', name: 'Blossom', inheritChance: 0.45, tier: 'common', glow: '#ffb0d8',
    blurb: 'Caught in a blossom breeze. Little flowers keep sprouting on its back.',
  },
  glowing: {
    id: 'glowing', trait: 'Glowing', name: 'Glowing', inheritChance: 0.45, tier: 'rare', glow: '#e8ff6a',
    blurb: 'Danced with the fireflies until some of their light stayed behind.',
  },
  breezy: {
    id: 'breezy', trait: 'Breezy', name: 'Breezy', inheritChance: 0.45, tier: 'rare', glow: '#c8f0ff',
    blurb: 'A gale blew right through it. Now a little wind swirls around it everywhere.',
  },
  bubbly: {
    id: 'bubbly', trait: 'Bubbly', name: 'Bubbly', inheritChance: 0.4, tier: 'rare', glow: '#9ae6ff',
    blurb: 'Came out of the bubble rain shimmering like a soap bubble. Pops bubbles when happy.',
  },
  cosmic: {
    id: 'cosmic', trait: 'Cosmic', name: 'Cosmic', inheritChance: 0.35, tier: 'epic', glow: '#9a6aff',
    blurb: 'Touched by the tail of the Great Comet. Its coat is a little night sky, with a tiny moon in orbit.',
  },
  crystal: {
    id: 'crystal', trait: 'Crystal', name: 'Crystal', inheritChance: 0.35, tier: 'epic', glow: '#bff4ff',
    blurb: 'Came home from the Crystal Caves with glittering gems growing from its back.',
  },
  golden: {
    id: 'golden', trait: 'Golden', name: 'Golden', inheritChance: 0.2, tier: 'legendary', glow: '#ffd23d',
    blurb: 'So loved it turned to gold. It starts with a best friend, and sometimes its babies carry it on.',
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
export const GIFTABLE_MUTATIONS: MutationId[] = ['lunar', 'storm', 'frost', 'starlit', 'giant', 'prismatic', 'sunkissed', 'blossom', 'glowing', 'breezy', 'bubbly', 'cosmic'];

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
  breeze: {
    id: 'breeze', name: 'Breeze Lure', attracts: 'Sky', durationMin: 6, expectedVisitors: 2.2,
    price: 65, scent: 'Fresh as the top of a mountain. Feathers and wisps drift closer.', color: '#a8d8ff',
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
const C = ISLANDS.cloud;
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
  // Growing an island to Medium, then Large, opens a new lure spot further round the globe.
  hollow: { id: 'hollow', island: 'home', name: 'Mushroom Hollow', x: -4.4, z: -9.5, affinity: { Mystic: 1.5, Fungus: 2 }, water: false, minSize: 1 },
  meadow: { id: 'meadow', island: 'home', name: 'Flower Meadow', x: 9.1, z: -9.1, affinity: { Bloom: 2, Insect: 1.5 }, water: false, minSize: 2 },
  ridge: { id: 'ridge', island: 'volcano', name: 'Obsidian Ridge', x: V.ox + 0.9, z: V.oz - 9.9, affinity: { Ember: 1.5, Dragon: 2 }, water: false, minSize: 1 },
  cinder: { id: 'cinder', island: 'volcano', name: 'Cinder Cone', x: V.ox + 11.8, z: V.oz - 3.2, affinity: { Ember: 2, Reptile: 1.3, Primate: 1.5 }, water: false, minSize: 2 },
  sandbar: { id: 'sandbar', island: 'lagoon', name: 'Sandbar', x: L.ox + 5, z: L.oz + 8.6, affinity: { Reef: 1.3, Shore: 1.5, Bird: 1.3 }, water: false, minSize: 1 },
  grotto: { id: 'grotto', island: 'lagoon', name: 'Glow Grotto', x: L.ox - 6.1, z: L.oz - 10.6, affinity: { Reef: 1.5, Spirit: 2 }, water: false, minSize: 2 },
  driftwood: { id: 'driftwood', island: 'beach', name: 'Driftwood Cove', x: B.ox + 2.4, z: B.oz - 9, affinity: { Shore: 1.5, Reptile: 1.5 }, water: false, minSize: 1 },
  gullrocks: { id: 'gullrocks', island: 'beach', name: 'Gull Rocks', x: B.ox - 8.9, z: B.oz - 7.4, affinity: { Bird: 2, Shore: 1.3 }, water: false, minSize: 2 },
  cactus: { id: 'cactus', island: 'desert', name: 'Cactus Patch', x: D.ox - 5.4, z: D.oz + 7.7, affinity: { Sand: 1.5, Insect: 1.5 }, water: false, minSize: 1 },
  cloudtop: { id: 'cloudtop', island: 'cloud', name: 'Cloud Tops', x: C.ox - 1.6, z: C.oz + 0.4, affinity: { Sky: 2, Bird: 1.5 }, water: false },
  mistpool: { id: 'mistpool', island: 'cloud', name: 'Mist Pool', x: C.ox + 2.2, z: C.oz + 2.0, affinity: { Sky: 1.5, Spirit: 1.5, Tide: 1.3 }, water: true },
  windmill: { id: 'windmill', island: 'cloud', name: 'Windmill Hill', x: C.ox + 6.4, z: C.oz - 7.6, affinity: { Sky: 1.5, Bird: 2 }, water: false, minSize: 1 },
  skyshrine: { id: 'skyshrine', island: 'cloud', name: 'Sky Shrine', x: C.ox - 8.4, z: C.oz - 8.0, affinity: { Sky: 1.3, Spirit: 2, Mystic: 1.5 }, water: false, minSize: 2 },
  ruins: { id: 'ruins', island: 'desert', name: 'Old Ruins', x: D.ox + 6.6, z: D.oz - 9.5, affinity: { Sand: 1.3, Mystic: 1.5, Spirit: 1.5 }, water: false, minSize: 2 },
};

/** A lure spot you can use: its island is yours and has grown big enough. */
export function spotOpen(islands: Partial<Record<IslandId, { owned: boolean; size: number }>>, id: string): boolean {
  const s = SPOTS[id];
  const isl = s && islands[s.island];
  return !!isl?.owned && isl.size >= (s.minSize ?? 0);
}

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
  heatwave: {
    arrive: 'Phew! A heatwave shimmers over the island. Sun-lovers are out in force.', leave: 'A cool breeze returns. The heatwave is over.', away: 'A heatwave baked the island golden.',
    kind: 'heatwave', name: 'Heatwave', icon: '☀️', mutation: 'sunkissed', empowers: 'Sand',
    attracts: { Reptile: 2, Sand: 2, Ember: 1.5, Insect: 1.3 },
    arrivalMutationChance: 0.15, empoweredMutationChance: 0.45, eggMutationChance: 0.2,
    teaser: 'The air is getting very warm and still. The lizards are lining up to sunbathe.',
    durationMin: [3, 5], dark: false,
    touch: {
      name: 'sunbeam', perEvent: 2, chance: 0.35, favor: 'Reptile',
      story: 'Basked in a heatwave until its coat turned golden.',
      lesson: 'Creatures that bask in a heatwave can come out Sunkissed.',
      bubble: 'Soaking up the sun ☀️',
    },
  },
  blossom: {
    arrive: 'A warm breeze carries petals everywhere. A Blossom Breeze!', leave: 'The last petals settle.', away: 'Blossom petals drifted over the island.',
    kind: 'blossom', name: 'Blossom Breeze', icon: '🌸', mutation: 'blossom', empowers: 'Bloom',
    attracts: { Bloom: 2.5, Insect: 2, Mammal: 1.3, Bird: 1.3 },
    arrivalMutationChance: 0.15, empoweredMutationChance: 0.45, eggMutationChance: 0.2,
    teaser: 'Something sweet is on the wind. Petals are starting to drift by.',
    durationMin: [3, 5], dark: false,
    touch: {
      name: 'petal shower', perEvent: 2, chance: 0.35, favor: 'Bloom',
      story: 'A shower of petals landed on it, and little flowers began to grow.',
      lesson: 'In a Blossom Breeze, petals can take root on a creature: Blossom.',
      bubble: 'Covered in petals 🌸',
    },
  },
  firefly: {
    arrive: 'Thousands of fireflies rise from the grass. A Firefly Night!', leave: 'The fireflies drift off to sleep.', away: 'Fireflies lit up the island all night.',
    kind: 'firefly', name: 'Firefly Night', icon: '✨', mutation: 'glowing', empowers: 'Grove',
    attracts: { Insect: 3, Grove: 1.5, Amphibian: 1.5 },
    arrivalMutationChance: 0.12, empoweredMutationChance: 0.4, eggMutationChance: 0.2,
    teaser: 'Tiny lights are blinking on in the grass, one by one.',
    durationMin: [3, 5], dark: true,
    touch: {
      name: 'firefly swarm', perEvent: 2, chance: 0.35, favor: 'Insect',
      story: 'Danced with a swarm of fireflies, and kept a little of their light.',
      lesson: 'On a Firefly Night, a creature caught in the swarm can start Glowing.',
      bubble: 'Dancing with fireflies ✨',
    },
  },
  gale: {
    arrive: 'Whoosh! A great gale is blowing. Hold on to something!', leave: 'The wind drops to a whisper.', away: 'A gale blew across the island.',
    kind: 'gale', name: 'Gale', icon: '🌬️', mutation: 'breezy', empowers: 'Sky',
    attracts: { Bird: 2.5, Sky: 2, Spirit: 1.3 },
    arrivalMutationChance: 0.12, empoweredMutationChance: 0.4, eggMutationChance: 0.2,
    teaser: 'The trees are starting to sway. The birds are very excited about something.',
    durationMin: [3, 4.5], dark: false,
    touch: {
      name: 'whirlwind', perEvent: 2, chance: 0.35, favor: 'Bird',
      story: 'A little whirlwind spun it round and round. Some of the wind stayed.',
      lesson: 'A whirlwind in a gale can leave a creature Breezy.',
      bubble: 'Whirled around by the wind 🌬️',
    },
  },
  bubbles: {
    arrive: 'Huge shimmering bubbles are floating up from the sea. Bubble Rain!', leave: 'The last bubble pops.', away: 'Bubble Rain shimmered over the island.',
    kind: 'bubbles', name: 'Bubble Rain', icon: '🫧', mutation: 'bubbly', empowers: 'Reef', rare: true,
    attracts: { Fish: 2, Reef: 2, Amphibian: 1.5, Spirit: 1.3 },
    arrivalMutationChance: 0.12, empoweredMutationChance: 0.35, eggMutationChance: 0.15,
    teaser: 'The sea is fizzing. A few bubbles are already drifting up into the sky.',
    durationMin: [2.5, 4], dark: false,
    touch: {
      name: 'giant bubble', perEvent: 2, chance: 0.35, favor: 'Fish',
      story: 'Floated around inside a giant bubble for a while, and came out shimmering.',
      lesson: 'Creatures caught in a giant bubble come out Bubbly.',
      bubble: 'Floating in a bubble 🫧',
    },
  },
  comet: {
    arrive: 'A Great Comet blazes across the night sky! Something very rare is happening.', leave: 'The comet sails on into the dark.', away: 'A Great Comet crossed the sky.',
    kind: 'comet', name: 'Great Comet', icon: '💫', mutation: 'cosmic', empowers: 'Mystic', rare: true,
    attracts: { Dragon: 2, Spirit: 2, Mystic: 1.5 },
    arrivalMutationChance: 0.1, empoweredMutationChance: 0.3, eggMutationChance: 0.12,
    teaser: 'A new bright star appeared last night, and it has a tail.',
    durationMin: [3, 4.5], dark: true,
    touch: {
      name: 'comet dust', perEvent: 1, chance: 0.45, favor: 'Mystic',
      story: 'Comet dust fell softly onto it. Now its coat holds a tiny night sky.',
      lesson: 'Dust from the Great Comet can make a creature Cosmic.',
      bubble: 'Sparkling with comet dust 💫',
    },
  },
};

/** Events an ad can summon, with weights. The rarer natural events are favored. */
export const SUMMON_WEIGHTS: Record<EventKind, number> = {
  storm: 1, eclipse: 1, starry: 1.3, fullmoon: 1.3, blizzard: 1.3, rainbow: 1.1, aurora: 1.3, meteor: 1.3, fog: 1,
  heatwave: 1, blossom: 1.1, firefly: 1.2, gale: 1, bubbles: 1.3, comet: 1.3,
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
  { id: 'r-aurorastag', requires: ['Mammal', 'Spirit'], sky: 'aurora', result: 'aurorastag', chance: 0.35 },
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
    name: 'Sparkly dust', verb: 'Dug up', icon: '✨', islands: { home: 3, volcano: 4, lagoon: 3, beach: 3, desert: 5, cloud: 4 },
    glimmer: [12, 28], shardChance: 0.12, itemChance: 0.06, items: ['warmstone', 'rootswell'], eggChance: 0.03,
  },
  puddle: {
    name: 'Bubbling puddle', verb: 'Fished up', icon: '🫧', islands: { home: 2, lagoon: 3, beach: 3, desert: 1, cloud: 2 },
    glimmer: [8, 22], shardChance: 0.08, itemChance: 0.08, items: ['rootswell'], eggChance: 0.01,
  },
  bush: {
    name: 'Berry bush', verb: 'Foraged', icon: '🫐', islands: { home: 3, lagoon: 1, volcano: 1, beach: 1, desert: 1, cloud: 1 },
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
    blurb: 'Give it to an egg in a nest: a thick, earthy draught. Eggs that drink it tend to hatch... big.',
  },
  warmstone: {
    id: 'warmstone', name: 'Warm Stone', target: 'egg', effect: 'warmth', price: 45,
    blurb: 'Set it by an egg in a nest: it holds the heat of a summer afternoon and halves the time left to hatch.',
  },
  // egg sprays: each kind works once per egg
  growmist: {
    id: 'growmist', name: 'Grow Mist', target: 'egg', effect: 'grow', price: 70, spray: true,
    blurb: 'Spray it on an egg in a nest: the creature inside hatches big, and sometimes enormous.',
  },
  shrinkmist: {
    id: 'shrinkmist', name: 'Shrink Mist', target: 'egg', effect: 'shrink', price: 70, spray: true,
    blurb: 'Spray it on an egg in a nest: the creature inside hatches small, and sometimes teeny.',
  },
  glitter: {
    id: 'glitter', name: 'Glitter Spray', target: 'egg', effect: 'glitter', price: 160, spray: true,
    blurb: 'Spray it on an egg in a nest: half the time the egg soaks it up and hatches with a mutation.',
  },
  speedy: {
    id: 'speedy', name: 'Speedy Spritz', target: 'egg', effect: 'speedy', price: 60, spray: true,
    blurb: 'Spray it on an egg in a nest: it hatches 30% faster.',
  },
};

/** Mutations Glitter Spray can give. */
export const GLITTER_MUTATIONS: MutationId[] = ['lunar', 'storm', 'frost', 'starlit', 'misty', 'aurora'];

// ---------------------------------------------------------------- cosmetics
export const DECOR: Record<string, DecorDef> = Object.fromEntries(DECOR_LIST.map((d) => [d.id, d]));

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
    weights: { common: 0, uncommon: 6, rare: 4, legendary: 0.8 }, colors: ['#1e2468', '#fff1a8'],
    blurb: 'Always uncommon or rarer, with a small chance of something legendary.',
  },
};

// ---------------------------------------------------------------- sky items (Starshards)
// Charms summon a sky event on the spot; the Star Chart and Telescope show
// what the sky has planned. Pricey on purpose: the free path is still the ad
// summon and simply waiting.

export interface SkyItemDef { id: string; name: string; icon: string; blurb: string; price: number; kind?: EventKind }

const RARE_SKIES: EventKind[] = ['starry', 'fullmoon', 'blizzard', 'aurora', 'meteor'];

function charmPrice(k: EventKind): number {
  return k === 'storm' ? 25 : RARE_SKIES.includes(k) || EVENTS[k].rare ? 70 : 40;
}

export const SKY_ITEMS: Record<string, SkyItemDef> = {
  ...Object.fromEntries((Object.keys(EVENTS) as EventKind[]).map((k) => [`charm-${k}`, {
    id: `charm-${k}`, name: `${EVENTS[k].name} Charm`, icon: EVENTS[k].icon, kind: k, price: charmPrice(k),
    blurb: `Break it and a ${EVENTS[k].name.toLowerCase()} rolls in right away, wherever you are.`,
  }])),
  wildcharm: {
    id: 'wildcharm', name: 'Wild Sky Charm', icon: '✨', price: 55,
    blurb: 'Break it for a random rare sky: Starry Night, Full Moon, Blizzard, Aurora, Meteor Shower or rarer.',
  },
  starchart: {
    id: 'starchart', name: 'Star Chart', icon: '🗺️', price: 40,
    blurb: 'For one day, see the next three sky events: what they are and when they arrive.',
  },
  telescope: {
    id: 'telescope', name: 'Sky Telescope', icon: '🔭', price: 400,
    blurb: 'Yours forever: always see the next three sky events coming, and when.',
  },
};

/** The rare skies a Wild Sky Charm can bring. */
export function wildSkies(): EventKind[] {
  return (Object.keys(EVENTS) as EventKind[]).filter((k) => RARE_SKIES.includes(k) || (EVENTS[k] as { rare?: boolean }).rare);
}
