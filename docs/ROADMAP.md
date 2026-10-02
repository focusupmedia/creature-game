# J. Development roadmap

Milestones are gated: each ends with a checkpoint (what was built and tested, what works and what doesn't, decisions needed) before the next starts.

## M0: Vertical slice ✅ (this build)
The full discover → create → evolve → live loop, playable in a phone browser. See [MVP_SCOPE.md](MVP_SCOPE.md).

## M1: Prove the fun (2 to 3 weeks)
- Ship the slice link to 10 to 20 playtesters. Add an in-game feedback button and session analytics export.
- Measure the MVP_SCOPE playtest table. Iterate on lure feel, pairing clarity, reveal pacing, event frequency.
- Tune prototype timers toward production pacing in steps, and watch where curiosity turns into waiting.
- Add a **second-wind lure ad**, **local secrets** (seeded per-sanctuary quirks), and a "Share this creature" card.
- **Exit gate:** the "fun" thresholds are met, or a documented pivot of the creation system.

## M2: Mobile foundation (3 to 4 weeks, can overlap M1)
- Generate Capacitor iOS/Android projects. Status bar, safe areas, haptics on hatch and strikes, app icon, splash.
- **Device benchmark gate** (see ARCHITECTURE). Instanced vegetation, off-screen actor sleep, battery-saver mode.
- Native storage, local notifications (egg ready, storm coming), Sentry/Crashlytics, Firebase Analytics, Remote Config.
- Accounts (Sign in with Apple / Google) + cloud save backend (small serverless store) + server time for anti-clock-skew.
- TestFlight and Play internal testing tracks.

## M3: Art and audio production (4 to 6 weeks, artist-dependent)
- Lock the art bible (from GAME_DESIGN §F) with a 3D artist. Model the 18 MVP creatures as glTF, honoring the parts contract.
- Sanctuary art pass, custom UI icon set, typography, the hatch reveal VFX polish.
- Authored music (day, night, storm, eclipse layers) and SFX set.

## M4: Content for launch (6 to 8 weeks)
- **Roster:** 28 to 30 wild + 12 to 15 created species. **Mutations:** +Bloom, Frost, Ember, Mist (8 total).
- **Lures:** 8 to 10, including event-only scents. **Events:** + Meteor shower (a mysterious object lands), Aurora, Fog, Bloom.
- **Expeditions** (the "exploration" pillar without an avatar).
- **Sanctuary growth:** unlock a second area (Tidepool or Crystal Hollow) with new spots and creatures, plus capacity growth.
- **Seasons:** rotating resonance rules and cosmetic collections through remote config.

## M5: Monetization, compliance and store readiness (3 to 4 weeks)
- RevenueCat IAP (packs, nests, cosmetics), server receipt validation. AdMob rewarded + UMP consent + ATT prompt.
- Privacy policy, data safety forms, age rating, App Store / Play listings, screenshots, trailer.
- Parental/age-gate approach per the audience decision (D5).

## M6: Soft launch (6 to 8 weeks)
- Limited countries (for example Canada, Australia, New Zealand, Philippines).
- **Targets:** D1 ≥ 40%, D7 ≥ 15%, D30 ≥ 6%, crash-free ≥ 99.5%, payer conversion 2 to 4%, ads opt-in ≥ 25% of DAU.
- Weekly balance and content updates through remote config.

## M7: Global launch and live ops
- A monthly content drop (new creatures, a resonance season, a cosmetic collection). Quarterly a new habitat or event type.
- Live events through the server calendar (for example a "Great Eclipse" weekend with rare resonances).

## Rough team for M1 to M6
1 to 2 engineers (TS/three.js), 1 3D artist (+ freelance animator/VFX), 1 part-time game designer/economy, part-time audio, QA in the soft-launch phase.
