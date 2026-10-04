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
    /** true until your own ad units are in: shows Google's test ads only. */
    testing: true,
    rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
    rewardedIos: 'ca-app-pub-3940256099942544/1712485313',
  },
  revenuecat: {
    android: 'goog_REPLACE_ME',
    ios: 'appl_REPLACE_ME',
  },
};
