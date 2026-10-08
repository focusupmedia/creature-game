// Store and ad keys for the phone apps. Fill these in from your accounts before
// a public release; until then the apps show Google's official TEST ads and
// purchases go through the store sandbox (no real money).
//
//   AdMob:      admob.google.com → Apps → (your app) → Ad units → Rewarded
//   RevenueCat: app.revenuecat.com → Project → API keys (one for Apple, one for Google)
//
// The AdMob *app* IDs also go in the native projects: android/app/src/main/AndroidManifest.xml
// (com.google.android.gms.ads.APPLICATION_ID) and ios/App/App/Info.plist (GADApplicationIdentifier).

export const STORE_KEYS = {
  admob: {
    /** Pocket Grove's own ad units are in. Keep this true while testing on your own phones
     *  (Google bans accounts that view or tap their own real ads); set it to false for the store release. */
    testing: true,
    rewardedAndroid: 'ca-app-pub-9126133036218343/1867964409',
    rewardedIos: 'ca-app-pub-9126133036218343/7328085350',
  },
  revenuecat: {
    android: 'goog_REPLACE_ME',
    ios: 'appl_UKiFmeHcOyGrzCjbeuWraHgRPBQ',
  },
};

// Leaderboard and achievement ids. iPhone: you choose these in App Store
// Connect → (app) → Game Center (use exactly the ids below). Android: Play
// Console → Play Games Services → Leaderboards / Achievements gives each one
// an id like "CgkI..."; paste them here. Empty ids are skipped.
const ACH = ['first_hatch', 'hatch_50', 'lures_25', 'species_10', 'species_25', 'species_50', 'species_all', 'legendary', 'mythical',
  'level_10', 'level_25', 'level_50', 'level_100', 'friend_1', 'friend_5', 'streak_7', 'streak_30'];
export const GAME_SERVICE_IDS = {
  ios: {
    leaderboards: { level: 'pg_level', species: 'pg_species', streak: 'pg_streak' },
    achievements: Object.fromEntries(ACH.map((a) => [a, `pg_${a}`])) as Record<string, string>,
  },
  android: {
    leaderboards: { level: '', species: '', streak: '' },
    achievements: Object.fromEntries(ACH.map((a) => [a, ''])) as Record<string, string>,
  },
};
