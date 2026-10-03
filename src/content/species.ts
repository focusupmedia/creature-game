import type { SpeciesDef } from '../core/types';

// MVP roster: 12 wild species (arrive via lures) + 6 hybrids (eggs only).
// Each has a strong silhouette that survives mutation overlays and Giant scaling.
export const SPECIES: SpeciesDef[] = [
  {
    id: 'mossfrog', name: 'Mossfrog', traits: ['Amphibian', 'Grove', 'Tide'], rarity: 'common',
    activity: 'day', movement: 'hop', origin: 'wild',
    blurb: 'Grows a little garden on its back. Sings before it rains.',
    hint: 'Common wherever moss meets water.',
    eggColors: ['#7fbf6a', '#3f7a3a'],
  },
  {
    id: 'pebbleback', name: 'Pebbleback', traits: ['Reptile', 'Tide'], rarity: 'common',
    activity: 'day', movement: 'walk', origin: 'wild',
    blurb: 'Collects smooth stones on its shell. Never in a hurry.',
    hint: 'Something slow likes the smell of the river.',
    eggColors: ['#9aa7a0', '#5d6e68'],
  },
  {
    id: 'glowbeetle', name: 'Glowbeetle', traits: ['Insect', 'Grove'], rarity: 'common',
    activity: 'night', movement: 'scuttle', origin: 'wild',
    blurb: 'Its lantern brightens when it feels safe.',
    hint: 'A small light in the forest, after dark.',
    eggColors: ['#2f4a6e', '#c9f56a'],
  },
  {
    id: 'petalwing', name: 'Petalwing', traits: ['Insect', 'Bloom', 'Grove'], rarity: 'common',
    activity: 'day', movement: 'fly', origin: 'wild',
    blurb: 'Its wings are real petals. It replaces them every spring.',
    hint: 'Drawn to sweet things in the daylight.',
    eggColors: ['#f6b3c8', '#f7e27a'],
  },
  {
    id: 'glimmerfin', name: 'Glimmerfin', traits: ['Fish', 'Tide'], rarity: 'common',
    activity: 'any', movement: 'swim', origin: 'wild',
    blurb: 'Catches light in its scales and lets it out slowly.',
    hint: 'It will never walk to you. Meet it at the water.',
    eggColors: ['#7cc7e8', '#e9f7ff'],
  },
  {
    id: 'puffwren', name: 'Puffwren', traits: ['Bird', 'Grove'], rarity: 'common',
    activity: 'day', movement: 'hop', origin: 'wild',
    blurb: 'Mostly fluff. Puffs up to twice its size when surprised.',
    hint: 'A round little singer of the morning woods.',
    eggColors: ['#f0d9b5', '#b9784f'],
  },
  {
    id: 'vinecoil', name: 'Vinecoil', traits: ['Reptile', 'Grove'], rarity: 'uncommon',
    activity: 'any', movement: 'slither', origin: 'wild',
    blurb: 'Often mistaken for a vine. It finds this hilarious.',
    hint: 'Hides among the forest greens. Patience helps.',
    eggColors: ['#5fa35a', '#d7e86a'],
  },
  {
    id: 'burrowbun', name: 'Burrowbun', traits: ['Mammal', 'Grove', 'Bloom'], rarity: 'common',
    activity: 'day', movement: 'hop', origin: 'wild',
    blurb: 'Wears a flower it found. Will fight you for it, gently.',
    hint: 'Fond of both forest and flowers.',
    eggColors: ['#f3e6d8', '#e7a6b9'],
  },
  {
    id: 'capling', name: 'Capling', traits: ['Fungus', 'Grove'], rarity: 'uncommon',
    activity: 'night', movement: 'waddle', origin: 'wild',
    blurb: 'By day it is just a mushroom. Probably.',
    hint: 'Some mushrooms in the forest only wake at night.',
    eggColors: ['#e0574b', '#fff3e6'],
  },
  {
    id: 'fernkit', name: 'Fernkit', traits: ['Mammal', 'Grove', 'Mystic'], rarity: 'uncommon',
    activity: 'night', movement: 'walk', origin: 'wild',
    blurb: 'The fern on its tail glows when it dreams.',
    hint: 'A shy forest creature with a touch of magic. Nocturnal.',
    eggColors: ['#e58b4c', '#7ccf7a'],
  },
  {
    id: 'duskmoth', name: 'Duskmoth', traits: ['Insect', 'Mystic'], rarity: 'uncommon',
    activity: 'night', movement: 'fly', origin: 'wild',
    blurb: 'The eyes on its wings watch things you cannot see.',
    hint: 'Flutters toward strange scents after sundown.',
    eggColors: ['#6a5596', '#e8c66a'],
  },
  {
    id: 'lumewisp', name: 'Lumewisp', traits: ['Spirit', 'Mystic'], rarity: 'rare',
    activity: 'night', movement: 'float', origin: 'wild',
    blurb: 'Nobody is sure if it is alive. It seems sure.',
    hint: 'Only the most mystical scents reach it, and only in the dark.',
    eggColors: ['#bfe9ff', '#ffffff'],
  },
  {
    id: 'sunscale', name: 'Sunscale', traits: ['Reptile', 'Grove', 'Sand'], rarity: 'common',
    activity: 'day', movement: 'walk', origin: 'wild',
    blurb: 'Basks on warm stones. Its frill pops open when it gets excited.',
    hint: 'A sun-loving lizard that wanders in from the forest edge.',
    eggColors: ['#ffd36a', '#4fb34a'],
  },
  {
    id: 'cinderskink', name: 'Cinderskink', traits: ['Reptile', 'Ember'], rarity: 'common',
    activity: 'any', movement: 'walk', origin: 'wild',
    blurb: 'Its scales glow like coals. Very warm to hug, if it lets you.',
    hint: 'A lizard that loves heat. Look somewhere volcanic.',
    eggColors: ['#3a2e2e', '#ff7a2a'],
  },
  {
    id: 'emberdrake', name: 'Emberdrake', traits: ['Dragon', 'Reptile', 'Ember'], rarity: 'rare',
    activity: 'night', movement: 'fly', origin: 'wild',
    blurb: 'A pocket-sized dragon. Hoards shiny pebbles and sneezes sparks.',
    hint: 'Something with wings nests in the volcano. It only comes out after dark.',
    eggColors: ['#c8402a', '#ffc83d'],
  },
  {
    id: 'coralpuff', name: 'Coralpuff', traits: ['Fish', 'Reef'], rarity: 'common',
    activity: 'any', movement: 'swim', origin: 'wild',
    blurb: 'Puffs up into a perfect ball when startled. It is startled often.',
    hint: 'A round little fish that lives among coral.',
    eggColors: ['#ffb36a', '#ffffff'],
  },
  {
    id: 'driftjelly', name: 'Driftjelly', traits: ['Spirit', 'Reef'], rarity: 'uncommon',
    activity: 'night', movement: 'float', origin: 'wild',
    blurb: 'Floats through the air as if it were water, glowing softly.',
    hint: 'Something glows over the lagoon at night.',
    eggColors: ['#c9a6ff', '#7fe8ff'],
  },
  {
    id: 'axolotl', name: 'Axolotl', traits: ['Amphibian', 'Reef', 'Tide'], rarity: 'legendary',
    activity: 'any', movement: 'waddle', origin: 'wild',
    blurb: 'Always smiling. Nobody knows what it knows. The keeper of every sanctuary.',
    hint: 'A legendary smile lives somewhere in the water. Very, very rarely seen.',
    eggColors: ['#ffb3d0', '#ff6fa8'],
  },
  // ---- hybrids: only from eggs
  {
    id: 'lilyhop', name: 'Lilyhop', traits: ['Amphibian', 'Bloom', 'Tide'], rarity: 'uncommon',
    activity: 'day', movement: 'hop', origin: 'hybrid',
    blurb: 'Wears a lily pad like a hat. Blooms when happy.',
    hint: 'What if a creature of the pond met a creature of flowers?',
    eggColors: ['#f5c2d6', '#8fd18a'],
  },
  {
    id: 'shellshroom', name: 'Shellshroom', traits: ['Reptile', 'Fungus', 'Grove'], rarity: 'uncommon',
    activity: 'any', movement: 'walk', origin: 'hybrid',
    blurb: 'A whole forest floor travels on its back.',
    hint: 'Slow scales and soft spores might get along.',
    eggColors: ['#8b9a6a', '#e0574b'],
  },
  {
    id: 'moonmoth', name: 'Moonmoth', traits: ['Insect', 'Mystic', 'Lunar'], rarity: 'rare',
    activity: 'night', movement: 'fly', origin: 'hybrid',
    blurb: 'Its wings hold a little of the eclipse forever.',
    hint: 'Wings that have touched the moon...',
    eggColors: ['#cfd8ff', '#8f8fd6'],
  },
  {
    id: 'thunderwren', name: 'Thunderwren', traits: ['Bird', 'Grove', 'Storm'], rarity: 'rare',
    activity: 'day', movement: 'hop', origin: 'hybrid',
    blurb: 'Its song is followed by a tiny clap of thunder.',
    hint: 'A singer charged by the storm.',
    eggColors: ['#3c4a6b', '#ffe066'],
  },
  {
    id: 'starkoi', name: 'Starkoi', traits: ['Fish', 'Tide', 'Mystic'], rarity: 'rare',
    activity: 'any', movement: 'swim', origin: 'hybrid',
    blurb: 'Reflects a night sky even at noon.',
    hint: 'A swimmer with something mystical in its blood.',
    eggColors: ['#1f2f6b', '#ffe9a8'],
  },
  {
    id: 'nimbuwhale', name: 'Nimbuwhale', traits: ['Spirit', 'Tide', 'Storm'], rarity: 'legendary',
    activity: 'any', movement: 'float', origin: 'hybrid',
    blurb: 'A tiny whale that swims through the air, trailing weather.',
    hint: 'Spirit, water and storm, all at once. Has anyone seen one?',
    eggColors: ['#eef4ff', '#9bb6e8'],
  },
  {
    id: 'starwyrm', name: 'Starwyrm', traits: ['Dragon', 'Mystic', 'Starlit'], rarity: 'legendary',
    activity: 'night', movement: 'fly', origin: 'hybrid',
    blurb: 'A dragon made of the night sky. Every scale holds a star.',
    hint: 'What would a dragon become if a falling star touched it?',
    eggColors: ['#1e2468', '#fff1a8'],
  },
  // ---- monkeys and kin
  {
    id: 'mossmonkey', name: 'Mossmonkey', traits: ['Primate', 'Grove'], rarity: 'common',
    activity: 'day', movement: 'walk', origin: 'wild',
    blurb: 'Swings from branch to branch and steals your hat. Gives it back, mostly.',
    hint: 'Something cheeky chatters in the forest canopy by day.',
    eggColors: ['#a0703e', '#8fd06a'],
  },
  {
    id: 'lanternlemur', name: 'Lanternlemur', traits: ['Primate', 'Mystic', 'Grove'], rarity: 'uncommon',
    activity: 'night', movement: 'walk', origin: 'wild',
    blurb: 'Its huge eyes glow like lanterns. It uses them to read bedtime stories.',
    hint: 'Two little lights watch the forest after dark. Something strange might tempt them.',
    eggColors: ['#9a96b0', '#ffd86a'],
  },
  {
    id: 'cindermonk', name: 'Cindermonk', traits: ['Primate', 'Ember'], rarity: 'rare',
    activity: 'day', movement: 'walk', origin: 'wild',
    blurb: 'A tiny fire monkey with a tail like a sparkler. Very proud of it.',
    hint: 'A warm, mischievous shape is sometimes seen near the lava.',
    eggColors: ['#c8502a', '#ffd23d'],
  },
  // ---- Sunny Shore
  {
    id: 'flamingle', name: 'Flamingle', traits: ['Bird', 'Shore'], rarity: 'common',
    activity: 'day', movement: 'walk', origin: 'wild',
    blurb: 'Stands on one leg for hours. Nobody has ever seen it switch.',
    hint: 'A pink shape stands very still by the sea.',
    eggColors: ['#ff9ec4', '#ffffff'],
  },
  {
    id: 'pouchbill', name: 'Pouchbill', traits: ['Bird', 'Shore', 'Tide'], rarity: 'common',
    activity: 'day', movement: 'waddle', origin: 'wild',
    blurb: 'Keeps a snack, a shell and a very surprised crab in its pouch.',
    hint: 'A big beak waddles along the tideline.',
    eggColors: ['#f4efe4', '#ffb84d'],
  },
  {
    id: 'mistheron', name: 'Mistheron', traits: ['Bird', 'Tide', 'Mystic'], rarity: 'uncommon',
    activity: 'any', movement: 'walk', origin: 'hybrid',
    blurb: 'Steps out of the sea fog without a sound, and back into it.',
    hint: 'Shore birds who share the tide might raise something misty.',
    eggColors: ['#c8d8e8', '#7a8ab0'],
  },
  // ---- Dune Hollow
  {
    id: 'sandpincer', name: 'Sandpincer', traits: ['Arachnid', 'Sand'], rarity: 'common',
    activity: 'night', movement: 'scuttle', origin: 'wild',
    blurb: 'Waves its claws to say hello. Its tail is only for show. Probably.',
    hint: 'Something clicks across the dunes at night.',
    eggColors: ['#e0a850', '#7a4a2a'],
  },
  {
    id: 'dunecoil', name: 'Dunecoil', traits: ['Reptile', 'Sand'], rarity: 'common',
    activity: 'day', movement: 'slither', origin: 'wild',
    blurb: 'Sidewinds across hot sand, leaving tidy little S shapes behind.',
    hint: 'Strange S-shaped tracks cross the warm sand.',
    eggColors: ['#e8c890', '#b07a3a'],
  },
  {
    id: 'sunhood', name: 'Sunhood', traits: ['Reptile', 'Sand', 'Mystic'], rarity: 'rare',
    activity: 'day', movement: 'slither', origin: 'hybrid',
    blurb: 'When it spreads its hood, a golden sun shines on it. It loves an audience.',
    hint: 'Desert creatures with claws and scales might share a sunny secret.',
    eggColors: ['#f2c46a', '#ff7a2a'],
  },
  // ---- Mythical: found only in special moments
  {
    id: 'cloudserpent', name: 'Cloud Serpent', traits: ['Dragon', 'Spirit', 'Storm'], rarity: 'mythical',
    activity: 'any', movement: 'float', origin: 'hybrid',
    blurb: 'A long sky dragon that rides the thunder. It grants one wish a year, but only small ones.',
    hint: 'Two dragons, and thunder overhead.',
    eggColors: ['#3aa86a', '#ffd23d'],
  },
  {
    id: 'phoenix', name: 'Phoenix', traits: ['Bird', 'Ember', 'Spirit'], rarity: 'mythical',
    activity: 'any', movement: 'fly', origin: 'hybrid',
    blurb: 'Burns bright, then rests as embers, then rises again. It is never sad about it.',
    hint: 'A bird and a creature of fire, kindred under a darkened sun.',
    eggColors: ['#ff5a2a', '#ffd23d'],
  },
  {
    id: 'kraken', name: 'Kraken', traits: ['Reef', 'Tide', 'Spirit'], rarity: 'mythical',
    activity: 'night', movement: 'swim', origin: 'wild', onlyDuring: 'fullmoon', onlyAt: ['reef'],
    blurb: 'Far smaller than the stories say. Far friendlier too. Hugs with all eight arms.',
    hint: 'Something stirs beneath the coral when the moon is full.',
    eggColors: ['#7a4ad0', '#ff8fc8'],
  },
  {
    id: 'qilin', name: 'Qilin', traits: ['Dragon', 'Mammal', 'Mystic'], rarity: 'mythical',
    activity: 'any', movement: 'walk', origin: 'hybrid',
    blurb: 'Walks so gently that flowers bloom in its hoofprints.',
    hint: 'A dragon and a gentle magical creature, beneath a sky full of falling stars.',
    eggColors: ['#7fd6c8', '#ffd86a'],
  },
  // ---- Level rewards: only from reaching keeper levels (one every 5)
  {
    id: 'jackalope', name: 'Jackalope', traits: ['Mammal', 'Grove', 'Mystic'], rarity: 'legendary',
    activity: 'day', movement: 'hop', origin: 'reward',
    blurb: 'A bunny with tiny antlers. It insists they are perfectly normal.',
    hint: 'A gift for reaching keeper level 5.', eggColors: ['#d8b88a', '#8a6a4a'],
  },
  {
    id: 'kitsune', name: 'Kitsune', traits: ['Mammal', 'Mystic', 'Spirit'], rarity: 'legendary',
    activity: 'night', movement: 'walk', origin: 'reward',
    blurb: 'A clever fox spirit. It grows a new tail every hundred years, and is very proud of each one.',
    hint: 'A gift for reaching keeper level 10.', eggColors: ['#ff9a4a', '#ffffff'],
  },
  {
    id: 'flyingsnake', name: 'Flying Snake', traits: ['Reptile', 'Spirit', 'Bloom'], rarity: 'legendary',
    activity: 'day', movement: 'float', origin: 'reward',
    blurb: 'A feathered serpent that glides on warm air, humming as it goes.',
    hint: 'A gift for reaching keeper level 15.', eggColors: ['#5fd0a0', '#ffd23d'],
  },
  {
    id: 'pegasus', name: 'Pegasus', traits: ['Mammal', 'Spirit', 'Bird'], rarity: 'legendary',
    activity: 'day', movement: 'fly', origin: 'reward',
    blurb: 'A winged horse. It gallops on clouds and lands without a sound.',
    hint: 'A gift for reaching keeper level 20.', eggColors: ['#ffffff', '#a8d8ff'],
  },
  {
    id: 'griffin', name: 'Griffin', traits: ['Bird', 'Mammal', 'Ember'], rarity: 'legendary',
    activity: 'day', movement: 'walk', origin: 'reward',
    blurb: 'Half eagle, half lion, all heart. Guards anything shiny it finds.',
    hint: 'A gift for reaching keeper level 25.', eggColors: ['#c89a4a', '#ffffff'],
  },
  {
    id: 'hippocampus', name: 'Hippocampus', traits: ['Fish', 'Mammal', 'Tide'], rarity: 'legendary',
    activity: 'any', movement: 'swim', origin: 'reward',
    blurb: 'A sea horse in the grandest sense: a horse in front, a fish behind.',
    hint: 'A gift for reaching keeper level 30.', eggColors: ['#3ac8c8', '#a8ffe8'],
  },
  {
    id: 'thunderbird', name: 'Thunderbird', traits: ['Bird', 'Spirit', 'Storm'], rarity: 'legendary',
    activity: 'any', movement: 'fly', origin: 'reward',
    blurb: 'When it beats its great wings, the sky rumbles. Politely.',
    hint: 'A gift for reaching keeper level 35.', eggColors: ['#2a3a7a', '#ffd83d'],
  },
  {
    id: 'baku', name: 'Baku', traits: ['Mammal', 'Mystic', 'Spirit'], rarity: 'legendary',
    activity: 'night', movement: 'walk', origin: 'reward',
    blurb: 'A dream tapir. It nibbles bad dreams away and leaves the good ones.',
    hint: 'A gift for reaching keeper level 40.', eggColors: ['#2a2a3a', '#f4f0ff'],
  },
  {
    id: 'sphinx', name: 'Sphinx', traits: ['Mammal', 'Sand', 'Mystic'], rarity: 'legendary',
    activity: 'day', movement: 'walk', origin: 'reward',
    blurb: 'A regal cat who asks riddles. It always lets you win.',
    hint: 'A gift for reaching keeper level 45.', eggColors: ['#e8c070', '#3a6ad0'],
  },
  {
    id: 'unicorn', name: 'Unicorn', traits: ['Mammal', 'Mystic', 'Bloom'], rarity: 'mythical',
    activity: 'any', movement: 'walk', origin: 'reward',
    blurb: 'The rarest friend of all. Flowers turn toward it as it passes.',
    hint: 'A gift for reaching keeper level 50.', eggColors: ['#ffffff', '#ff9ee8'],
  },
];

export const SPECIES_BY_ID: Record<string, SpeciesDef> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const WILD_SPECIES = SPECIES.filter((s) => s.origin === 'wild');

export function species(id: string): SpeciesDef {
  const s = SPECIES_BY_ID[id];
  if (!s) throw new Error(`Unknown species ${id}`);
  return s;
}
