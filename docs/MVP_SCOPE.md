# C. MVP scope: the vertical slice

**Goal:** answer one question before content production starts: *is this actually fun?*
Specifically: do lures, pairings, eggs and the sky create "I wonder what happens if…" moments that bring people back?

## Brief checklist → what's built

| Brief asks for | Built in the slice | Status |
|---|---|---|
| 8 to 12 creatures | 12 wild + 6 created (18) | ✅ |
| 2 to 3 bait types | 4 lures (Mossberry, Riverweed, Honeydew, Moonpetal) | ✅ |
| Basic combining | Kindred Font: shared-trait rule, trait resonance, sky lending | ✅ |
| Eggs | Physical eggs, clues, patterns, shake/glow, sky absorption | ✅ |
| 1 to 2 incubators | 2 free nests + 2 premium nests (Starshards) + egg basket | ✅ |
| A small sanctuary | Floating forest island: pond, glade, Font, nests, stall | ✅ |
| 2 to 3 mutations | Lunar, Storm, Giant, Prismatic | ✅ |
| 2 environmental events | Thunderstorm (sparkfall), Eclipse (moonbeam) | ✅ |
| Basic rotating shop | Traveling Merchant: staples, rotating curiosities, premium decor | ✅ |
| Basic currency | Glimmer (soft) and Starshards (premium) | ✅ |
| Basic cosmetics | 7 decorations, free placement | ✅ |
| Basic save system | Versioned JSON, autosave, migrations, corrupt-save quarantine | ✅ |
| Camera controls | Drag pan with inertia, pinch/wheel zoom, twist rotate, tap pick | ✅ |
| Creature wandering | 8 motion styles, sleep, shelter, social, lure visits, eclipse gaze | ✅ |
| One complete discovery cycle | Lure → arrival → pairing → egg → hatch reveal → journal note | ✅ |

### Also built (cheap now, expensive to retrofit)

- Offline progression with a "While you were away" story report.
- Day/night cycle with lighting moods, stars, fireflies, procedural ambience and SFX.
- Field journal: silhouettes, hints, mutations, auto-written observations.
- Tutorial coach (contextual, non-blocking).
- Rewarded-ad flow (simulated), IAP catalogue (disabled on web), analytics events, crash hooks, notification scheduling, remote-config hook.
- Playtest tools: time ×10/×60, skip 5 min / 1 h, jump to the next sky event, grant currency.
- A pacing simulation (`npm run sim`): a bot "keeper" plays a week to check discovery speed.

## Explicitly out of scope for the slice

- Final art and audio (procedural placeholders now).
- Native iOS/Android builds and store submission (Milestone 2).
- Real ads/IAP SDKs, cloud save, accounts, backend.
- Expeditions, sanctuary expansion, seasons, more habitats.
- Localization, full accessibility pass.

## What the slice must prove (playtest plan)

Run 10 to 20 external playtesters on the link for one week:

| Question | Signal | "Fun" threshold |
|---|---|---|
| Is the first session magical? | Time to first hatch; reveal completion | < 4 min; > 90% |
| Do players experiment? | Distinct pairings tried in sessions 1 to 3 | ≥ 5 |
| Do they understand traits? | Hybrid made via a trait-aware pairing (not random) | ≥ 50% of hybrids by day 3 |
| Is the world worth watching? | Sessions with ≥ 30 s of no input while the app is foregrounded | ≥ 30% of sessions |
| Do they come back out of curiosity? | Return within 24 h; self-reported reason | ≥ 40%; "wanted to see…" |
| Do the events land? | Survey: "describe something surprising" mentions storm, eclipse or mutation | ≥ 50% |

**Kill or pivot criteria:** if players don't experiment beyond the tutorial pairing, or report the loop as "waiting on timers", revisit the creation system before producing content.
