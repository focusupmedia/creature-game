// Expeditions: send a pet off to explore for a while. It comes back with
// treasure and a little story. Longer trips find better things.

export type ExpeditionId = 'berryhill' | 'mistywoods' | 'crystalcaves' | 'farshores';

export interface ExpeditionDef {
  id: ExpeditionId;
  name: string;
  icon: string;
  hours: number;
  blurb: string;
  coins: [number, number];
  /** Chance of Starshards, and how many. */
  shardChance: number;
  shards: [number, number];
  /** Chance of bringing back an item (tonic, warm stone or a spray). */
  itemChance: number;
  items: string[];
  /** Chance of a whole egg (a wild one, leaning rare). */
  eggChance: number;
  /** Keeper level needed. */
  level: number;
  stories: string[];
}

export const EXPEDITIONS: Record<ExpeditionId, ExpeditionDef> = {
  berryhill: {
    id: 'berryhill', name: 'Berry Hill', icon: '🫐', hours: 1, level: 1,
    blurb: 'A quick stroll up the hill behind the grove. Good for snacks.',
    coins: [40, 80], shardChance: 0.05, shards: [1, 1], itemChance: 0.1, items: ['warmstone'], eggChance: 0,
    stories: ['{name} picked berries on Berry Hill and ate most of them on the way home.', '{name} rolled all the way down Berry Hill. Twice.', '{name} found a sunny rock on Berry Hill and had a nap on it.'],
  },
  mistywoods: {
    id: 'mistywoods', name: 'Misty Woods', icon: '🌫️', hours: 2, level: 3,
    blurb: 'Quiet woods where the fog never quite lifts. Things get lost there, and found.',
    coins: [90, 160], shardChance: 0.15, shards: [1, 2], itemChance: 0.25, items: ['warmstone', 'rootswell'], eggChance: 0.02,
    stories: ['{name} followed a glowing moth through the Misty Woods.', '{name} heard singing in the Misty Woods and sang right back.', '{name} came back from the Misty Woods a little damp and very pleased with itself.'],
  },
  crystalcaves: {
    id: 'crystalcaves', name: 'Crystal Caves', icon: '🔮', hours: 4, level: 8,
    blurb: 'Deep, sparkling caves. Starshards grow on the walls.',
    coins: [180, 320], shardChance: 0.45, shards: [2, 4], itemChance: 0.25, items: ['growmist', 'shrinkmist', 'speedy'], eggChance: 0.05,
    stories: ['{name} counted every crystal in the Crystal Caves. It lost count at seven.', '{name} found an echo in the Crystal Caves and talked to it for an hour.', '{name} came back from the Crystal Caves glittering from nose to tail.'],
  },
  farshores: {
    id: 'farshores', name: 'Far Shores', icon: '🧭', hours: 8, level: 15,
    blurb: 'A long voyage to a coast on no map. Anything could wash up there.',
    coins: [380, 650], shardChance: 0.6, shards: [3, 6], itemChance: 0.35, items: ['glitter', 'speedy', 'rootswell'], eggChance: 0.15,
    stories: ['{name} sailed to the Far Shores on a leaf and came back on a turtle.', '{name} watched the sunrise from the Far Shores and brought back a pocketful of sand.', '{name} made a friend on the Far Shores. They promised to write.'],
  },
};

export const EXPEDITION_ORDER = Object.keys(EXPEDITIONS) as ExpeditionId[];

/** How many pets can be away at once, by keeper level. */
export function expeditionSlots(level: number): number {
  return level >= 25 ? 4 : level >= 10 ? 3 : 2;
}
