# D. Technical architecture

## Engine decision

**Chosen: TypeScript + Three.js (WebGL) + Vite, shipped to iOS and Android through Capacitor.**

You chose "web game first" at the start of the project. I evaluated whether that holds up for an App Store / Google Play 3D game, and I think it does, with one risk to measure early.

| | Web + Three.js + Capacitor | Unity | Godot |
|---|---|---|---|
| Iteration speed | Fastest: hot reload, playtest by URL | Medium | Fast |
| Share a build with a playtester | A link | TestFlight / APK | APK / web (heavy) |
| 3D performance on low-end Android | **Risk:** WebView WebGL | Best | Good |
| Asset pipeline | glTF (artist-friendly, standard) | Best-in-class | Good |
| Ads/IAP/analytics SDKs | Mature Capacitor plugins (AdMob, RevenueCat, Firebase) | Most mature | Weaker |
| App size | Small (about 3 to 8 MB + assets) | 40 MB+ | 25 MB+ |
| Hiring | Huge web pool | Large | Small |
| Lock-in | None: core sim is plain TS | Engine | Engine |

**Mitigation for the performance risk:** the simulation (`src/core`) has no rendering dependencies, so if Milestone 2 device benchmarks fail, the renderer can be swapped (for example to Unity with a C# port of the roughly 1,300-line core) without redesigning the game. **Benchmark gate:** 60 fps on iPhone 11 and a stable 30 fps on a 2021 Galaxy A-series with 20 creatures during a storm.

## Project structure

```
src/
  core/            Pure, deterministic game logic — no DOM, no three.js
    types.ts         State + content types + GameEvent union
    rng.ts           Seeded RNG bound to save state; stateless hash for schedules
    world.ts         Day phase, sky-event schedule (pure function of seed+time)
    lures.ts         Arrival weights / chance / mutation rolls
    genetics.ts      Kindred rule, resonance, inheritance, incubation, egg clues
    creatures.ts     Traits, naming, mutation application
    journal.ts       Discoveries, rewards, observations
    shop.ts          Seeded rotations
    sim.ts           tick(): runs everything over any time span → GameEvent[]
    actions.ts       Validated player actions (place, combine, hatch, buy, …)
    state.ts save.ts New-game state; versioned save, migrations, cloud merge
  content/         Data: species, lures, spots, events, resonances, items, decor,
                   layout, tuning (all remote-config overridable)
  render/          three.js: World, Sky, sanctuary diorama, CreatureActor (AI +
                   animation), procedural creature/egg/decor models, Reveal, portraits
  ui/              DOM overlay: HUD, dock, sheets, modal, reveal card, coach
  platform/        Service seams: storage, ads, purchases, analytics, crash,
                   notifications, remote config, audio
  game/Game.ts     Orchestrator: loop, dispatch, persistence, input routing
tests/             Vitest: core rules + balance/pacing bot
```

## Data flow

```
 input ──► UI / World pick ──► actions.ts ──► GameState ◄── save.ts ◄─► Storage/Cloud
                                              │
          every 250 ms (live) / 10 s steps (offline catch-up)
                                              ▼
                                  sim.tick(state, now) ──► GameEvent[]
                                              │
             ┌───────────────┬────────────────┼──────────────┬─────────────┐
             ▼               ▼                ▼              ▼             ▼
      World.handle()     UI toasts      Audio sfx      Analytics    Notifications
      (strikes, arrivals) & reports
             │
      World.sync(state) every frame — reconciles actors/eggs/gifts/decor
```

- **Determinism:** the RNG state lives in the save. Sky events are a stateless hash of (seed, window), so every device computes the same weather, and a server could validate or replace it.
- **Offline progression** is the live tick run over the gap in 10-second steps, capped at 12 hours. There is no separate "idle math", so live and offline behavior can't drift apart.
- **Time** = `Date.now() + clockOffset`. The offset powers the playtest tools without touching the system clock. In production, a server time check prevents clock-skew exploits (for example, skipping egg timers by changing the device clock).

## Save system

- JSON, `version` field, ordered migrations (`MIGRATIONS[n]` upgrades n → n+1). Saves from newer versions are rejected.
- Autosave every 15 s, 1 s after any action, and on `visibilitychange` / `pagehide`.
- Corrupt saves are quarantined under a separate key, and the player gets a fresh sanctuary instead of a crash.
- **Cloud save (Milestone 2):** the same JSON goes to a backend keyed by Sign in with Apple / Google Play Games. Conflicts resolve with `pickSave()`: prefer more progress (journal, hatches), then the most recent. Discoveries are never silently discarded.

## Content pipeline

- **Data-first:** creatures, lures, resonances, events, items, decor and tuning are TypeScript data today. Moving them to versioned JSON served through remote config needs no code changes beyond the loader. New seasons can add resonance rules and shop rotations without an app update.
- **Art:** the procedural builders in `render/creatureModels.ts` define a **parts contract** (body, head, wings[], legs[], tail, segments[], glow anchors). Production glTF models export named nodes that match, and `CreatureActor` animates them unchanged. Mutation overlays (palette shift, crescent, sparks, scale, hue cycling) are applied generically to any model.
- **Audio:** placeholder WebAudio synthesis behind `Audio.play(name)`. Replace it with authored samples via the same API.
- **Music:** `platform/composer.ts` (pure, tested) writes cozy tunes one eighth-note at a time from a per-mood recipe (key, tempo, chords, instruments); `platform/music.ts` plays them with synthesized kalimba, marimba, bells, bass and pad through a soft echo. `Audio.ambience()` picks the mood from the sky event or day/night. Recorded samples can replace the voices in `Music.voice()` later.

## Mobile optimization

- **One draw call** for all static scenery: geometry merged with vertex colors and a shared toon material.
- Shared unit geometries for creature parts, shared toon ramp, a small material set (few shader programs, which avoids compile hitches).
- One shadow-casting light (1024² map), pixel ratio capped at 2, **adaptive resolution** that drops render scale when the frame time exceeds 25 ms.
- Particles are pooled sprites with short lives. Rain is a single LineSegments buffer.
- **Next steps:** instanced grass and flowers, frustum-aware actor updates (sleep off-screen creatures), KTX2 textures and meshopt for glTF, a 30 fps "battery saver" when idle, and pausing rendering when the app is backgrounded.

## Platform services (seams in `src/platform/services.ts`)

| Seam | Web stub (today) | Native (Milestone 2/5) |
|---|---|---|
| Storage | localStorage | @capacitor/preferences + cloud backend |
| Ads | Simulated 3 s rewarded overlay | AdMob rewarded (+ Google UMP consent, ATT on iOS) |
| Purchases | Catalogue shown; buying disabled | RevenueCat (StoreKit 2 / Play Billing), server receipt validation |
| Analytics | In-memory ring buffer / console | Firebase Analytics (or Amplitude) |
| Crash | console | Sentry or Crashlytics |
| Notifications | Logged schedule | @capacitor/local-notifications (egg ready, sky event coming) |
| Remote config | Optional JSON URL (`VITE_REMOTE_CONFIG_URL`) | Firebase Remote Config / CDN JSON with versioning |

### Analytics events already emitted

`session_start`, `ftue_step`, `lure_placed`, `creature_arrived`, `combine`, `egg_hatched`, `hybrid_discovered`, `mutation_gained`, `sky_event`, `gift_collected`, `shop_purchase`, `shop_refresh`, `nest_bought`, `egg_skip_shards`, `ad_offer_accepted`, `ad_rewarded`, `iap_tapped`, `decor_placed`.

## Building for the stores

```bash
npm run build            # web bundle → dist/
npx cap add ios          # once (needs macOS + Xcode)
npx cap add android      # once (needs Android Studio)
npm run cap:sync         # copy web build into native shells
npx cap open ios         # archive → TestFlight → App Store
npx cap open android     # build AAB → Play Console
```

The `appId` in `capacitor.config.ts` is a placeholder and **becomes permanent on first store upload** (D1).
