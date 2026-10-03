# Cloud save

Approved Oct 3, 2026 (A82): the platform's own saved games, players signed in
automatically with a "Sign in" link in Settings, and a "pick a save" card when
two saves disagree.

| Platform | Service | Where the save lives |
|---|---|---|
| iPhone / iPad | Game Center saved games | the player's iCloud |
| Android | Google Play Games saved games (Snapshots) | the player's Google account |
| Web playtest | "Test cloud" | a separate slot in the browser's storage |

A save does not move between iPhone and Android (that was the trade-off of this option).

## How it works (game side, built)
- Every game has a `saveId`; each device remembers when it last matched the cloud (`state.cloud.syncedAt`). See `src/core/cloud.ts`.
- On start, on returning to the app, and from Settings ("Check now"), the game compares saves:
  - only this device played since the last sync: upload
  - only the cloud changed (another device played): load it quietly
  - both played, or a different game is in the cloud: show both saves side by side and let the player pick
  - a brand-new game on a new phone: "We found your save!" card
  - a cloud save from a newer game version: never overwritten; the player is asked to update
- Uploads happen every 5 minutes while playing and whenever the app goes to the background.
- Switching to the cloud save keeps a backup of this device's save (`kindred-grove.save.v1.before-cloud`).
- Transport: `src/platform/cloudSave.ts` (native plugin "CloudSave" on phones, Test cloud on web).

## When we make the app builds (to do)
1. `npx cap add ios` and `npx cap add android`.
2. iOS: copy `native/ios/CloudSavePlugin.swift` into the App target. In Xcode turn on **Game Center** and **iCloud → iCloud Documents** (a container is created automatically). Register the app in App Store Connect with Game Center enabled.
3. Android: copy `native/android/CloudSavePlugin.kt` into the app module, add `com.google.android.gms:play-services-games-v2` to `build.gradle`, add the Play Games app id to `AndroidManifest.xml`, and call `registerPlugin(CloudSavePlugin::class.java)` in `MainActivity` before `super.onCreate`. In the Play Console set up Play Games Services and turn on **Saved games**.
4. Test on two real devices signed into the same account: play on one, open the other, check the "pick a save" card.

The native files are written but untested until those projects exist.
