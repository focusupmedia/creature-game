# Releasing Pocket Grove to the App Store and Google Play

The `ios/` and `android/` app projects are ready. Real ads (Google AdMob,
rewarded) and real purchases (RevenueCat over the App Store / Google Play) are
wired in and only run in the phone apps; the web build keeps its test stubs.
Until the keys below are filled in, the apps show Google's **test** ads.

## Every time you change the game
`npm run cap:sync` (builds the web game and copies it into both apps).

## Keys to fill in (one time)
| What | Where to get it | Where it goes |
|---|---|---|
| AdMob app id (Android) ✅ filled in | admob.google.com → Apps → add app | `android/app/src/main/res/values/strings.xml` → `admob_app_id` |
| AdMob app id (iOS) ✅ filled in | same | `ios/App/App/Info.plist` → `GADApplicationIdentifier` |
| AdMob rewarded ad unit ids ✅ filled in | AdMob → app → Ad units → Rewarded | `src/platform/storeKeys.ts` (set `testing: false` only for the store release) |
| RevenueCat API keys (Apple ✅ filled in, Google still to do) | app.revenuecat.com → project → API keys | `src/platform/storeKeys.ts` |
| Play Games project id | Play Console → Play Games Services → Configuration | `strings.xml` → `game_services_project_id` |

## In-app products to create (same ids in App Store Connect, Google Play and RevenueCat)
All are **Consumable**, including the pass: `pass_monthly` is bought again for each month's pass (so no Restore button is needed).
`shards_small` $0.99 · `shards_medium` $4.99 · `shards_large` $9.99 · `shards_huge` $19.99 · `shards_mega` $49.99 · `shards_ultimate` $99.99 ·
`coins_small` $0.99 · `coins_medium` $4.99 · `coins_large` $9.99 · `coins_huge` $19.99 · `coins_mega` $49.99 · `coins_ultimate` $99.99 ·
`pass_monthly` $4.99

## Build and upload
- **iPhone (needs a Mac with Xcode):** `npx cap open ios` → pick your team under Signing & Capabilities → Product → Archive → Distribute → App Store Connect. Test with TestFlight, then submit for review.
- **Android:** `npx cap open android` (Android Studio) → Build → Generate Signed App Bundle → upload the `.aab` in Play Console → Internal testing first, then Production.

## Store listing needs
App name, short and full description, screenshots (phone sizes), the 1024px icon (`resources/icon.png`), privacy policy URL, support email, age rating questionnaire, Data safety form (Android) and App Privacy (iOS): ads use the device advertising id; purchases go through the stores.

## Leaderboards and achievements

- **iPhone:** App Store Connect → your app → Game Center. Add 3 leaderboards with the ids `pg_level`, `pg_species`, `pg_streak`, and one achievement per id in `src/platform/storeKeys.ts` (`pg_first_hatch`, `pg_hatch_50`, …). Turn on the Game Center capability in Xcode.
- **Android:** Play Console → Play Games Services → Leaderboards and Achievements. Create the same ones, then paste each generated id (like `CgkI…`) into `GAME_SERVICE_IDS.android` in `src/platform/storeKeys.ts`.

## app-ads.txt (AdMob)

Put a file named `app-ads.txt` at the root of the website listed as the developer site in both stores, containing exactly:

    google.com, pub-9126133036218343, DIRECT, f08c47fec0942fa0

## Android: cloud build (no Android Studio)
`.github/workflows/android.yml` builds the signed Play Store bundle (.aab) on GitHub.
- One-time: in GitHub → repo Settings → Secrets and variables → Actions, add `ANDROID_KEYSTORE_BASE64`
  (the upload key, base64) and `ANDROID_KEYSTORE_PASSWORD`. The owner keeps the original `upload.jks` and
  password somewhere safe (with Play App Signing, a lost upload key can be reset through Play support).
- Each build: Actions → "Android build" → Run workflow, then download the `pocket-grove-android` artifact
  and upload `app-release.aab` in Play Console. The version code goes up automatically per run.
- Play Games stays off until `game_services_project_id` in `android/app/src/main/res/values/strings.xml`
  holds the real project id.
