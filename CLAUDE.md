# Pocket Grove: handoff notes for new sessions

Cozy mobile creature-discovery game **Pocket Grove** by Focus Up Media (formerly the working title Kindred Grove; storage keys still use `kindred-grove.*` on purpose). TypeScript + three.js + Vite, wrapped for iOS/Android with Capacitor. Work on branch `claude/mobile-game-dev-0nsqvl`.

## Working rules (from the owner)
- **Confirm before any major addition or change.** Explain the decision, give 2–3 options with tradeoffs and a recommendation, and wait for the owner's OK. Small fixes: just do them and report.
- Owner is non-technical. Keep chat replies plain-language and short.
- North Star: every session should make the player wonder what they'll discover next.

## Commands
`npm run dev` · `npm test` (142 tests, includes a pacing bot, an economy sim (`ECON=1 npx vitest run tests/economy.test.ts` prints the day-by-day table), music checks and an every-emoji-is-drawn check) · `npx tsc --noEmit` · `npm run build:single` (one-file build)

Playable link (private artifact, republish to the same URL): https://claude.ai/artifact/Vp8BW1soCF5jXTZ76FZ3hP. To republish, convert `dist-single/index.html` to artifact format (no doctype/html/head/body; keep title, styles, body divs, scripts) and publish it with the Artifact tool. Visual checks: Playwright with `executablePath: '/opt/pw-browsers/chromium'` against `npx vite preview --port 4173`, and `?debug` exposes `window.game`.

## Code map
- `src/core/`: pure, deterministic simulation (sim tick, actions, genetics, lures, world/events, shop, save + migrations, levels, quirks, progress, care, wanderers, market, away, expeditions, login, collections, contests, notify, cloud, pass (Halloween Pass); save version 15)
- `src/content/`: data (species, world: lures/spots/events/mutations/egg tiers, decor (100-piece catalog + nests, Halloween and totem pieces), wanderers, islands (each with a sell booth and first-nest spot), seasons (Halloween dates and skies), globe (map ↔ sphere wrap), layout, tuning)
- `src/platform/`: cloudSave.ts (Game Center / Play Games saved games via a native "CloudSave" plugin; Test cloud on web; see docs/CLOUD_SAVE.md and `native/`), audio.ts (SFX + ambience), composer.ts + music.ts (generative music), services (storage, ads, IAP stubs)
- `src/render/`: World (multi-island, only the current island's actors animate), CreatureActor (AI, personalities, digging), creatureModels (procedural, outlined), sanctuary (island builders; trees are choppable), decor (catalog models), sky (9 events, follows the current globe)
- `src/ui/`: brand.ts (name, app icon SVG, title splash; exported icons in `public/` and `resources/`), UI.ts (sheets, HUD, widget, islands, pets), Labels.ts (world pins and name bubble), icons.ts (SVG incl. axolotl mascot), emoji.ts (every emoji redrawn as SVG; text is auto-converted), styles.css (chunky casual style)
- `docs/`: GAME_DESIGN, MVP_SCOPE, ARCHITECTURE, ROADMAP, DECISIONS (approved decisions A1–A88)

## Built so far
Lures, combining (trait-based hybrids), eggs and reveal, 19 mutations (common/rare/epic/legendary tiers), 15 sky events (Storm, Eclipse, Rainbow, Misty Fog, Heatwave, Blossom Breeze, Gale, Firefly Night, plus rare Starry Night, Full Moon, Blizzard, Aurora, Meteor Shower, Bubble Rain, Great Comet), 3 legendary events (Angels, Eruption, Deep Tide; `core/legendary.ts`, `render/legendaryFx.ts`) with a claimable gift and legendary mutations (Angelic, Infernal, Abyssal), ad-summoned events (6 ads/day), generative cozy music (kalimba/marimba/bells; moods for day, night and each sky event; Music toggle in Settings), stacking mutation looks with rarity glow (rim, aura, sparkles), rotating shop with category tabs and Mango the monkey shopkeeper, egg tiers (coin eggs + premium gem Starry Egg), coins (8-bit) + Starshards, decor, journal, away report, tutorial with axolotl coach, pick up and carry creatures (press and hold; drop on another to breed, on a dig spot to dig/fish/forage), dig spots, growth to random size (with obvious Teeny/Colossal outliers), behaviour traits (2-5 per creature, `content/quirks.ts` + `core/quirks.ts`, Trait Deleter/Wiper), squabbles, digging finds, first-3-eggs-always-new, 25 species including dragons and the legendary Axolotl, fully round globe islands (game logic uses flat map x/z; `content/globe.ts` wraps it onto a sphere; render things with World.at/place, never raw x/y/z), drag-to-roll globe camera, archipelago (Home, Ember Peak, Coral Lagoon, Sunny Shore, Dune Hollow, Cloud Isle with rainbow bridges), island sizes S/M/L, in-game widget, keeper levels 1-100 (Star Keeper badge past 50) with a rewards list and 15 level-only creatures (`core/levels.ts`; player actions report to `Game.record()` for XP and quests), daily + lasting quests (`core/quests.ts`), gentle hunger, food (Berry Trees, snacks, feasts, feedbags), storage, selling and the travelling Collector (`core/care.ts`).

## Round A49-A58 (all built)
Breeding variety, dig finds auto-collect, capacity per island size/world, rarity shares (`core/lures.ts` RARITY_SHARE), level-gated worlds, bigger globes, lure visitors waiting with a ! (Keep / Send away / Make space), cross-world ! alerts, Pets sheet (Wandering/Storage, sort, favourites), how-you-met card, away finds, 4 new sky events (Rainbow, Aurora, Meteor Shower, Misty Fog; 1.5x as common), egg sprays, wanderers + Goblin, journal world filters, all emoji replaced by drawn icons.

## Round after that (A59-A64, all built)
Lure spots open as worlds grow, graphics clean-up (coin, hands, coach), economy rebalance with an economy sim, more ads + free-coin ads, decor placement rework + tree chopping + 96-piece decor catalog, Favorite heart, Feed in Pets, islands spaced out.

## Round A65-A72 (all built)
Pet color shades, friendship hearts, expeditions, daily login calendar, collection rewards, gentle notifications, creature voices + ambience, weekly pet contests, ~25 new creatures (incl. Aurora Stag and Prism Koi mythicals, 4 Cloud Isle creatures, 5 Star Keeper rewards), levels 51-100, Cloud Isle.

## Latest round (A73-A81, all built)
Quick fixes (Worlds button, pet card, shop tabs, volume sliders, rarer storms, fitted halos/wings via `anchors()` in creatureModels, breed prompt), toast queue (`UI.toast` priorities, `UI.fail` adds a Shop button), Pets multi-select + bulk actions, bigger storage, sell prices by size/mutations + Market board (`core/market.ts`), ad refills, big packs, sky charms + Star Chart/Telescope, keeper menus (`core/wanderers.ts` takeDeal), 6 skies + 8 mutations, 20 quests, 8 pet activities (CreatureActor states), away chest + presents + welcome-back gift (`core/away.ts`).

## Cloud save (A82, built)
`core/cloud.ts` decides upload / quiet download / ask (side-by-side card `UI.showSaveChoice`); `Game.cloudSync/cloudUpload/cloudSignIn`; Settings → Cloud save; playtest button "Pretend another phone saved". Native plugins in `native/ios` and `native/android` get wired in when the app projects are created.

## Latest round (A84-A88, all built)
Small fixes (events 5-20 min apart, babies mostly plain, egg names/icons `ui/eggLook.ts`, hatch cracks in `render/Reveal.ts`, weights `core/creatures.ts weightKg`), sell booths + far signs (`Game.signRange`), premium egg/lure tiers with a shop pity (`core/shop.ts PITY`), nests as placed decor `decor: 'nest'` (eggs reference the placed id; `core/state.ts placedNests/freeNest`; any decor can be moved via `UI.beginPlacement(id, movingId)` or press-and-hold), hatching onto the current world or into storage, breeding variety + hidden legendary pity (`state.legendaryPity`), new traits and best-friend perks, slower growth + Sprout Snacks, Halloween season (`content/seasons.ts`, `SEASON_OVERRIDE` for playtests), Halloween Pass (`core/pass.ts`), rarity totems (`core/lures.ts TOTEMS`), Nursery (`actions.setNurseryPair`, runs in the sim), 6 creatures, painted globe shading.

## Feedback round (A89, built)
Make-space highlights + `UI.fail` error sound, short tutorial, Journal "How to get" (`addHowTo`), shop random lures/food/gadgets with stock (`core/shop.ts`) + GADGETS tab (`GADGET_IDS/GADGET_LIMIT`), visitor pins + `Game.goToVisitor`, `tuning.mythicCopyDamp`, nursery eggs (`egg.nurseryId`, ready at once), hatch spin (`render/Reveal.ts`), friend gifts, What's new (`content/updates.ts`; add lines each release), pass creatures (`pumpkit` on purchase, `peekaboo` ghost at paid tier 1, `gloomwing` bat at paid tier 25; offer card + UNLOCK NOW button in `showPass`, `levels.giveGiftCreature`), Daily Rumours (`core/rumours.ts`, Quests daily tab). Then: sell price breakdown (`care.sellBreakdown`), card-style pass board (`UI.showPass`), Lotl's starter quest (`core/starter.ts`: pet, buy an egg, make an egg, hatch 3; side axolotl button `UI.syncLotl`, reward egg tier `lotl`).

## Social round (A90, built)
Friend codes without a server (`core/friends.ts`: snapshot of name/level/best pets in a `PG-` code, visit sheet, 5 friend gifts a day, friends leaderboard; Friends HUD tile), weekly mini-events for the whole year (`content/weeks.ts` themes + holidays by date, `core/weekly.ts`; boosts hook into sim/actions/care/friendship/XP; card in Quests), login streaks with milestones and a weekly "keep warm" shield (`core/login.ts`), share card (`ui/shareCard.ts`, Share on pet card and reveal), achievements + leaderboards (`core/achievements.ts`, `platform/gameServices.ts`, native GameServicesPlugin on iOS/Android; ids in `storeKeys.ts GAME_SERVICE_IDS`), first eggs hatch within 3 min (`tuning.firstEggMaxMs`).

## Onboarding round (A91, built)
Buttons unlock one at a time (`ui/features.ts`, `state.features`, "New!" toast + glow), quiet start while Lotl's Quest runs (≤10 min: rumour/week/login/achievement news wait, `Game.quiet()`), toasts at the very top edge over the coin bar (owner's choice) with tap-to-dismiss, Lotl's Quest moved to the lower-left above the dock so they never overlap, visitor Keep/Send away moves tutorial + Lotl (`meet` event), the controls card replaced by just-in-time gesture tips (`ui/hints.ts`; full card still in Settings), shorter tour, tutorial arrow on buttons only (owner's choice; world things keep their own ! signs) (`UI.arrowTarget`, `I.TUT_ARROW`, `.tut-*` button classes) with 3-6 word coach lines, name-your-first-baby prompt (`UI.nameFirstPet`), Lotl's Egg always has a glowing mutation, Sleepy Egg that hatches the next morning (`starter.ts tomorrowMorning`, egg tier `sleepy`).

## Phone apps (built)
`ios/` and `android/` Capacitor projects with icons/splash. Real AdMob rewarded ads + RevenueCat purchases in `src/platform/nativeServices.ts` (keys in `storeKeys.ts`; test ads until filled). Cloud-save plugins wired in. Release steps: docs/STORE_RELEASE.md.

## Next up
Ask the owner what's next (ideas: final art pass, store listing).

## Open / later
Fill in store keys and products (docs/STORE_RELEASE.md), first device test, real phone home-screen widgets, final art and audio.
