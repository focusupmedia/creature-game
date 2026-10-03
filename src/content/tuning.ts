// Every balance number in one place. RemoteConfig can override any of these
// at boot without an app update (see src/platform/remoteConfig.ts).
// Durations are prototype-short so a playtest session sees the whole loop;
// the "production" column in docs/GAME_DESIGN.md lists intended live values.

export const TUNING = {
  /** Length of a full day/night cycle in minutes. */
  dayLengthMin: 20,
  /** Day phase fraction [0..1) where 0 = midnight; a new sanctuary starts in the morning. */
  startPhase: 0.3,

  /** Each window may host one sky event (windows are 1.5x as frequent as they used to be: 22 → 15 min). */
  eventWindowMin: 15,
  eventChancePerWindow: 0.65,
  /**
   * Natural frequencies. Storms are still the most common sky, but no longer hog
   * the windows: every other sky gets a real turn. Starry Night, Full Moon,
   * Blizzard, Aurora and Meteor Shower stay rarer unless summoned.
   */
  eventWeights: {
    storm: 0.22, eclipse: 0.15, rainbow: 0.15, fog: 0.13, starry: 0.08, fullmoon: 0.07, blizzard: 0.07, aurora: 0.07, meteor: 0.06,
  } as Record<string, number>,
  /** Starshard rocks a meteor shower drops on each world you own. */
  meteorRocks: [2, 4] as [number, number],
  /** The very first window always brings a storm so new keepers see the world change. */
  firstStormAtMin: 7,
  forecastLeadMin: 1.5,

  rarityWeight: { common: 10, uncommon: 4, rare: 1.2, legendary: 0.3, mythical: 0.8 } as Record<string, number>,
  prismaticChance: 0.005,
  /** Combining two of the same species can awaken Giant. */
  purebredGiantChance: 0.12,
  tonicGiantChance: 0.6,
  /** Chance a new mutation of the active sky event sparks during combining. */
  combineEventMutationChance: 0.15,
  /** Hybrid rule chance multiplier when a required trait only comes from the sky. */
  skyResonanceFactor: 0.5,

  incubationMin: { common: 2, uncommon: 5, rare: 12, legendary: 30, mythical: 45 } as Record<string, number>,
  /** Extra minutes per mutation the egg carries. */
  incubationPerMutationMin: 1.5,
  freeNests: 2,
  maxNests: 4,
  nestPriceShards: [0, 0, 50, 120],
  basketSize: 3,

  capacity: 20,
  /** Hatchlings start at this fraction of their grown size... */
  hatchlingScale: 0.45,
  /** ...and take this long to grow up. */
  growMin: 15,
  /** Grown size range (before Giant). */
  sizeRange: [0.88, 1.14] as [number, number],
  /** Rare outliers outside the normal range. */
  sizeOutlierChance: 0.06,
  /** The first N eggs a keeper makes always hold a creature they haven't discovered. */
  firstNewEggs: 3,
  /**
   * After that, chance an egg holds a different creature that shares a type
   * with a parent (picked by rarity) instead of a copy of a parent: half the time.
   */
  distantRelativeChance: 0.5,
  /** Digging: relative dig rate by personality. */
  digRate: { energetic: 1.8, lazy: 0.4, shy: 0.8, curious: 1.4, grumpy: 1, friendly: 1 } as Record<string, number>,
  digItemChance: 0.03,
  digEggChance: 0.006,
  /** Gifts: each resident leaves one every N minutes on average... */
  giftEveryMin: 5,
  /** ...but only this many residents count, so hoarding creatures isn't an income strategy. */
  giftResidentsCap: 8,
  giftGlimmer: [3, 8] as [number, number],
  giftShardChance: 0.03,
  maxGiftsOnGround: 14,
  /** Dig spots (sparkly dust, bubbling puddles, berry bushes) you drop creatures on. Per owned island. */
  /**
   * Keeper levels: XP to go from level L to L+1 is 20 + base * L^0.9 (about 49k XP to reach 50).
   * Measured with the economy sim (an active keeper, four 20-minute sessions a day earns ~1.2k XP a day):
   * level 5 in the first hour, level 20 in about a week, level 50 in about six weeks.
   */
  levelXpBase: 55,
  /** XP for things the player does. Idle time earns none. */
  xp: { lure: 3, breed: 8, hatch: 12, newSpecies: 40, newMutation: 25, gift: 0, digSpot: 4, shopEgg: 4, blessing: 40, arrivalNew: 25 } as Record<string, number>,
  /** Hunger: hours from full to empty; below `hungry` a creature is grumpy and won't dig or breed. */
  /** Lure visitors wait this long for you, at most this many per lure spot. */
  visitorWaitHours: 6,
  visitorsPerSpot: 3,
  hungerHours: 10,
  hungry: 0.3,
  wellFed: 0.7,
  /** Fruit trees: a fruit every N minutes, up to `fruitMax` waiting. */
  fruitEveryMin: 90,
  fruitMax: 3,
  /** Storage: free slots, then the price of each extra slot. */
  /** Storage starts roomy and can grow to 30. */
  storageBase: 10,
  storageSlotPrice: [300, 500, 800, 1200, 1600, 2000, 2500, 3000, 3600, 4200, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13500, 15000],
  /** The Collector visits every few hours and stays a while. */
  collectorEveryHours: 6,
  collectorStayMin: 45,
  digSpotEveryMin: 6,
  digSpotMax: 2,
  digSpotLifeMin: 25,
  /** Wanderers drop by about this often while you're playing. */
  wandererEveryMin: 14,
  /** How long a legendary event's gift waits to be claimed. */
  blessingHours: 24,

  shopRefreshMin: 20,
  shopRefreshShards: 5,
  mysteryEggPrice: 150,

  rewards: {
    newSpecies: { glimmer: 40, shards: 2 },
    newHybrid: { glimmer: 80, shards: 5 },
    newMutation: { glimmer: 30, shards: 3 },
  },

  /** Rewarded ads: optional, capped, never interrupting. */
  adHatchMaxRemainingMin: 15,
  adsPerDay: 12,
  /** Free coins for watching an ad (coins tab of the shop): this many a day... */
  coinAdsPerDay: 5,
  /** ...each worth this much, plus a bit per keeper level. */
  coinAdBase: 60,
  coinAdPerLevel: 15,
  /** Premium skip price: shards per minute of incubation left (a 30-minute egg costs 15). */
  skipShardsPerMin: 0.5,

  start: {
    glimmer: 120,
    shards: 10,
    lures: { mossberry: 3, riverweed: 2 } as Record<string, number>,
    creatures: ['mossfrog', 'petalwing', 'burrowbun'],
  },

  /** Offline catch-up step size. */
  offlineStepSec: 10,
  /** Cap for offline simulation (beyond this the sanctuary "rests"). */
  offlineCapHours: 12,
};

export type Tuning = typeof TUNING;
