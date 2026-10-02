// Every balance number in one place. RemoteConfig can override any of these
// at boot without an app update (see src/platform/remoteConfig.ts).
// Durations are prototype-short so a playtest session sees the whole loop;
// the "production" column in docs/GAME_DESIGN.md lists intended live values.

export const TUNING = {
  /** Length of a full day/night cycle in minutes. */
  dayLengthMin: 20,
  /** Day phase fraction [0..1) where 0 = midnight; a new sanctuary starts in the morning. */
  startPhase: 0.3,

  /** Each window may host one sky event. */
  eventWindowMin: 22,
  eventChancePerWindow: 0.65,
  eventWeights: { storm: 0.65, eclipse: 0.35 },
  /** The very first window always brings a storm so new keepers see the world change. */
  firstStormAtMin: 7,
  forecastLeadMin: 1.5,
  /** Average seconds between sparkfall strikes during a storm. */
  sparkfallEverySec: 35,
  sparkfallMutationChance: 0.3,
  maxStrikesPerStorm: 2,
  /** Moonbeams per eclipse that silver a resident creature. */
  moonbeamsPerEclipse: 1,
  moonbeamChance: 0.6,

  rarityWeight: { common: 10, uncommon: 4, rare: 1.2, legendary: 0.3 } as Record<string, number>,
  prismaticChance: 0.005,
  /** Combining two of the same species can awaken Giant. */
  purebredGiantChance: 0.12,
  tonicGiantChance: 0.6,
  /** Chance a new mutation of the active sky event sparks during combining. */
  combineEventMutationChance: 0.15,
  /** Hybrid rule chance multiplier when a required trait only comes from the sky. */
  skyResonanceFactor: 0.5,

  incubationMin: { common: 2, uncommon: 5, rare: 12, legendary: 30 } as Record<string, number>,
  /** Extra minutes per mutation the egg carries. */
  incubationPerMutationMin: 1.5,
  freeNests: 2,
  maxNests: 4,
  nestPriceShards: [0, 0, 50, 120],
  basketSize: 3,

  capacity: 20,
  /** Gifts: each resident leaves one every N minutes on average... */
  giftEveryMin: 5,
  /** ...but only this many residents count, so hoarding creatures isn't an income strategy. */
  giftResidentsCap: 8,
  giftGlimmer: [3, 8] as [number, number],
  giftShardChance: 0.03,
  maxGiftsOnGround: 14,

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
  adsPerDay: 6,
  /** Premium skip price: shards per started 5 minutes. */
  skipShardsPer5Min: 1,

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
