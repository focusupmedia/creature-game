import type { DecorDef } from '../core/types';

// The decoration catalog. Everything is always for sale in Mango's DECOR tab once
// your keeper level is high enough; the Magic set costs Starshards. `r` is how
// much ground a piece covers (placement keeps pieces from overlapping).

export type DecorCat = 'nature' | 'stone' | 'lights' | 'cozy' | 'fun' | 'magic';

export const DECOR_CATS: { id: DecorCat; name: string; icon: string }[] = [
  { id: 'nature', name: 'Nature', icon: '🌿' },
  { id: 'stone', name: 'Stone', icon: '⛰️' },
  { id: 'lights', name: 'Lights', icon: '🔥' },
  { id: 'cozy', name: 'Cozy', icon: '🛋️' },
  { id: 'fun', name: 'Fun', icon: '🎁' },
  { id: 'magic', name: 'Magic', icon: '✨' },
];

type Row = [id: string, name: string, cat: DecorCat, price: number, level: number, r: number, blurb: string];

const COIN_ROWS: Row[] = [
  // ---- nature
  ['flowerbed', 'Wildflower Patch', 'nature', 50, 1, 0.9, 'A tumble of color.'],
  ['clover', 'Clover Patch', 'nature', 30, 1, 0.6, 'Somewhere in there is a lucky one.'],
  ['flowerpots', 'Flower Pots', 'nature', 45, 1, 0.5, 'Three little pots, three little blooms.'],
  ['tulips', 'Tulip Row', 'nature', 60, 1, 0.7, 'Neat as a pin and twice as cheerful.'],
  ['fern', 'Curly Fern', 'nature', 40, 1, 0.5, 'Unfurls a little more every morning.'],
  ['fruittree', 'Berry Tree', 'nature', 150, 1, 0.8, 'Grows a fresh berry every hour and a half. Tap it to pick them.'],
  ['sunflowers', 'Sunflower Trio', 'nature', 70, 2, 0.6, 'They turn to follow the sun. And you.'],
  ['cattails', 'Cattail Clump', 'nature', 45, 2, 0.4, 'Fluffy brown tops that sway in the breeze.'],
  ['mushrooms', 'Toadstool Cluster', 'nature', 55, 2, 0.5, 'Do not lick. Probably.'],
  ['mushroomRing', 'Fairy Ring', 'nature', 110, 4, 1.0, 'Some say things dance here at night.'],
  ['cactuspot', 'Potted Cactus', 'nature', 50, 2, 0.4, 'Prickly outside, soft inside.'],
  ['logpile', 'Log Pile', 'nature', 55, 2, 0.6, 'Neatly stacked. Beetles approve.'],
  ['rosebush', 'Rose Bush', 'nature', 90, 3, 0.6, 'Smells like a summer afternoon.'],
  ['hedge', 'Hedge Wall', 'nature', 80, 3, 0.9, 'A tidy green wall for a tidy garden.'],
  ['berrybush', 'Blueberry Bush', 'nature', 70, 3, 0.6, 'For looking at. The real berries grow on Berry Trees.'],
  ['haybale', 'Hay Bale', 'nature', 60, 3, 0.6, 'A comfy seat for anyone who doesn\'t mind itching.'],
  ['pine', 'Pine Tree', 'nature', 150, 4, 0.7, 'Tall, green and always ready for winter.'],
  ['topiary', 'Topiary Ball', 'nature', 120, 5, 0.6, 'Trimmed perfectly round by a very patient gardener.'],
  ['birch', 'Birch Tree', 'nature', 160, 5, 0.7, 'Papery white bark and trembling leaves.'],
  ['bigshroom', 'Giant Toadstool', 'nature', 160, 6, 0.8, 'Big enough to shelter under. Small creatures do.'],
  ['bamboo', 'Bamboo Grove', 'nature', 140, 6, 0.6, 'Knocks gently in the wind.'],
  ['pumpkins', 'Pumpkin Patch', 'nature', 130, 7, 0.9, 'Round, orange and very proud of it.'],
  ['bonsai', 'Tiny Bonsai', 'nature', 180, 8, 0.5, 'A whole old tree, just very small.'],
  ['palmtree', 'Palm Tree', 'nature', 200, 8, 0.7, 'Brings a holiday feeling wherever it goes.'],
  ['topiarybun', 'Bunny Topiary', 'nature', 220, 9, 0.7, 'Burrowbuns find it confusing.'],
  ['maple', 'Red Maple', 'nature', 260, 10, 0.8, 'Forever in its autumn colors.'],
  ['willow', 'Weeping Willow', 'nature', 320, 12, 1.0, 'Long green curtains to hide behind.'],
  // ---- stone
  ['steppingstones', 'Stepping Stones', 'stone', 40, 1, 0.9, 'Hop, hop, hop.'],
  ['boulder', 'Mossy Boulder', 'stone', 70, 2, 0.7, 'It has been here longer than anyone.'],
  ['cairn', 'Stone Cairn', 'stone', 60, 3, 0.4, 'Somebody balanced these very carefully.'],
  ['birdbath', 'Bird Bath', 'stone', 110, 4, 0.5, 'Birds love a splash.'],
  ['stoneArch', 'Mossy Arch', 'stone', 140, 5, 1.0, 'Old stones, older moss.'],
  ['standingstone', 'Standing Stone', 'stone', 150, 7, 0.5, 'Hums faintly when the moon is full.'],
  ['pillar', 'Broken Pillar', 'stone', 200, 9, 0.5, 'From a palace nobody remembers.'],
  ['geode', 'Open Geode', 'stone', 260, 11, 0.6, 'Plain rock outside, purple sparkles inside.'],
  ['well', 'Wishing Well', 'stone', 380, 13, 0.8, 'Toss in a coin. Nothing happens. Probably.'],
  ['fossil', 'Fossil Rock', 'stone', 300, 14, 0.7, 'A spiral shell from a very long time ago.'],
  ['statue', 'Frog Statue', 'stone', 350, 15, 0.6, 'A Mossfrog, carved in stone. It looks smug.'],
  ['obelisk', 'Little Obelisk', 'stone', 420, 18, 0.5, 'Covered in tiny carved creatures.'],
  ['fountain', 'Garden Fountain', 'stone', 600, 20, 0.9, 'A tinkling fountain. Very relaxing.'],
  // ---- lights
  ['lantern', 'Firefly Lantern', 'lights', 80, 1, 0.5, 'Glows warmly after dusk.'],
  ['torch', 'Tiki Torch', 'lights', 70, 3, 0.3, 'A cheerful flame on a stick.'],
  ['candles', 'Candle Cluster', 'lights', 60, 4, 0.4, 'Little flames that never quite go out.'],
  ['glowjar', 'Firefly Jar', 'lights', 90, 5, 0.3, 'The fireflies visit. They leave when they like.'],
  ['lamppost', 'Lamp Post', 'lights', 160, 6, 0.4, 'A proper lamp for a proper path.'],
  ['campfire', 'Campfire', 'lights', 140, 7, 0.7, 'Gather round. Somebody bring marshmallows.'],
  ['mushroomlamp', 'Mushroom Lamp', 'lights', 150, 8, 0.4, 'A glowing toadstool on a stem.'],
  ['stringlights', 'Lantern String', 'lights', 240, 10, 1.0, 'Paper lanterns strung between two posts.'],
  ['starlamp', 'Star Lamp', 'lights', 280, 16, 0.4, 'A little star on a pole, glowing all night.'],
  ['moonlamp', 'Moon Lamp', 'lights', 300, 18, 0.4, 'A crescent moon that lights up at dusk.'],
  // ---- cozy
  ['signpost', 'Signpost', 'cozy', 60, 1, 0.4, 'Points to "Here" and "Also here".'],
  ['fence', 'Picket Fence', 'cozy', 50, 1, 0.9, 'White, pointy and very neat.'],
  ['bench', 'Garden Bench', 'cozy', 100, 2, 0.8, 'A good place to watch your creatures.'],
  ['mailbox', 'Mailbox', 'cozy', 70, 2, 0.3, 'No letters yet. Maybe someday.'],
  ['picnic', 'Picnic Blanket', 'cozy', 90, 3, 0.9, 'Checked blanket, basket, and a pie cooling.'],
  ['barrel', 'Barrels', 'cozy', 80, 3, 0.5, 'Full of... nobody knows.'],
  ['birdhouse', 'Birdhouse', 'cozy', 85, 4, 0.4, 'A tiny house on a tall post.'],
  ['crates', 'Crate Stack', 'cozy', 90, 4, 0.6, 'Mango\'s spare stock. Don\'t tell him.'],
  ['table', 'Tea Table', 'cozy', 150, 5, 0.8, 'Table, two stools, and a teapot.'],
  ['parasol', 'Garden Parasol', 'cozy', 160, 6, 0.8, 'Striped shade for sunny days.'],
  ['wheelbarrow', 'Wheelbarrow', 'cozy', 130, 7, 0.7, 'Full of flowers, going nowhere.'],
  ['rocker', 'Rocking Chair', 'cozy', 180, 8, 0.6, 'Rocks gently all by itself.'],
  ['swing', 'Swing Set', 'cozy', 220, 9, 0.9, 'Wheee.'],
  ['hammock', 'Hammock', 'cozy', 260, 11, 1.0, 'For the laziest afternoons.'],
  ['tent', 'Camping Tent', 'cozy', 300, 12, 1.0, 'Zip it up and tell spooky stories.'],
  ['flowercart', 'Flower Cart', 'cozy', 350, 15, 0.9, 'A wooden cart overflowing with blooms.'],
  // ---- fun
  ['ball', 'Bouncy Ball', 'fun', 50, 1, 0.4, 'Boing.'],
  ['foodbowl', 'Snack Bowl', 'fun', 60, 2, 0.4, 'Always full in spirit.'],
  ['blocks', 'Toy Blocks', 'fun', 70, 3, 0.5, 'Somebody built a tower. Somebody else knocked it down.'],
  ['pinwheels', 'Pinwheels', 'fun', 65, 3, 0.4, 'Spin in the slightest breeze.'],
  ['petbed', 'Pet Bed', 'fun', 120, 4, 0.6, 'Squishy, round and just the right size for a nap.'],
  ['gnome', 'Garden Gnome', 'fun', 110, 5, 0.3, 'Pip\'s cousin. Much quieter.'],
  ['balloons', 'Balloon Bunch', 'fun', 100, 5, 0.4, 'Tied to a rock so they don\'t float off.'],
  ['bunting', 'Flag Bunting', 'fun', 120, 6, 1.0, 'Little flags for every celebration.'],
  ['scarecrow', 'Scarecrow', 'fun', 150, 6, 0.5, 'Scares nobody. Everybody likes him.'],
  ['snowman', 'Snowman', 'fun', 140, 7, 0.5, 'Never melts. Nobody asks how.'],
  ['sandbox', 'Sandbox', 'fun', 200, 8, 0.9, 'Bucket and spade included.'],
  ['seesaw', 'Seesaw', 'fun', 240, 9, 0.9, 'Up, down, up, down.'],
  ['slide', 'Little Slide', 'fun', 280, 10, 0.9, 'A tiny slide for tiny friends.'],
  ['windmill', 'Windmill', 'fun', 500, 17, 0.8, 'Its sails turn slowly all day long.'],
  ['airballoon', 'Hot Air Balloon', 'fun', 900, 25, 0.8, 'Tethered, just in case.'],
  ['nursery', 'Nursery', 'cozy', 2500, 10, 0.9, 'Leave two pets here and they make an egg every few hours, even while you\'re away. Needs a free nest.'],
];

const SHARD_ROWS: Row[] = [
  ['windchime', 'Moonbell Chime', 'magic', 35, 1, 0.4, 'Rings by itself before an eclipse.'],
  ['crystal', 'Dreaming Crystal', 'magic', 40, 1, 0.5, 'Hums a note just below hearing. Glows at night.'],
  ['sakura', 'Blossom Tree', 'magic', 55, 1, 0.8, 'Petals drift across the sanctuary.'],
  ['fairydoor', 'Fairy Door', 'magic', 45, 5, 0.4, 'A tiny door in a tiny hill. Knock politely.'],
  ['orbs', 'Floating Orbs', 'magic', 50, 6, 0.5, 'Three glowing orbs that bob in the air.'],
  ['starshrine', 'Star Shrine', 'magic', 70, 8, 0.6, 'A little shrine for wishing on stars.'],
  ['cloudcushion', 'Cloud Cushion', 'magic', 60, 9, 0.7, 'A real cloud, very soft, slightly damp.'],
  ['rainbowarch', 'Rainbow Arch', 'magic', 90, 10, 1.0, 'Your very own rainbow. It never fades.'],
  ['floatrock', 'Floating Rock', 'magic', 80, 12, 0.6, 'A mossy rock that forgot how to fall.'],
  ['auroralamp', 'Aurora Lamp', 'magic', 75, 13, 0.4, 'Ripples green and violet, like the northern lights.'],
  ['moongate', 'Moon Gate', 'magic', 110, 14, 1.0, 'A round gate that glows under the moon.'],
  ['glowtree', 'Glow Tree', 'magic', 100, 16, 0.8, 'Its leaves shine softly blue all night.'],
  ['shroomhouse', 'Mushroom House', 'magic', 130, 18, 1.0, 'Someone small lives here. You never see them.'],
  ['dragonstatue', 'Dragon Statue', 'magic', 150, 20, 0.8, 'A jade dragon, coiled and dreaming.'],
  ['portal', 'Shimmer Portal', 'magic', 180, 25, 0.9, 'Leads nowhere. Looks amazing.'],
  ['goldaxolotl', 'Golden Axolotl', 'magic', 200, 30, 0.6, 'A gleaming statue of the legendary Axolotl.'],
  // timed rarity totems: lures on their world bring rarer visitors until the magic runs out
  ['totemrare', 'Rare+ Totem', 'magic', 25, 3, 0.4, 'For 3 hours, lures on this world bring rare visitors twice as often. Works while you\'re away.'],
  ['totemepic', 'Epic+ Totem', 'magic', 60, 8, 0.4, 'For 2 hours, lures here bring rare visitors 3x and legendary ones 2x as often. Works while you\'re away.'],
  ['totemlegend', 'Legendary+ Totem', 'magic', 150, 15, 0.45, 'For 1 hour, lures here bring legendary visitors 5x as often, and mythical ones 2x. Works while you\'re away.'],
];

const toDef = (currency: 'glimmer' | 'shards') => ([id, name, cat, price, level, r, blurb]: Row): DecorDef =>
  ({ id, name, blurb, price, currency, rotating: false, cat, level, r });

export const DECOR_LIST: DecorDef[] = [...COIN_ROWS.map(toDef('glimmer')), ...SHARD_ROWS.map(toDef('shards'))];
