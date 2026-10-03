# Decisions log

## Made (low risk or reversible: decided and moving on)

| # | Decision | Why |
|---|---|---|
| M1 | Web stack (TS + three.js) wrapped with Capacitor for the stores | You chose web-first; it ships to both stores and is playtestable by link. A performance gate is in M2. See ARCHITECTURE. |
| M2 | Portrait-first layout | Short one-handed check-ins. Tablets and landscape get a wider lens automatically. |
| M3 | Parents are **not** consumed when combining | Creatures are companions with stories, not crafting inputs (the brief warns against commodities). Nests limit throughput. |
| M4 | **Kindred rule:** pairs must share a trait | Makes pairing a puzzle, and makes mutations open new pairings. |
| M5 | Hybrids are keyed on **traits**, not species pairs | Learnable, and resistant to breeding charts. The sky can lend a trait. |
| M6 | Lures pause when nothing can answer them | Avoids "I wasted my lure", and is itself a clue (Moonpetal by day). |
| M7 | Two currencies only: coins and Starshards | The brief asks to avoid excessive currencies. |
| M8 | Gifts are the main coins source, capped by 8 residents | Rewards looking at the world. Hoarding creatures isn't an income strategy. |
| M9 | Sanctuary capacity is 20. Full sanctuaries still record visitors in the journal. | Discovery continues even when full. "Say goodbye" is gentle and never sells creatures. |
| M10 | Sky schedule is deterministic per sanctuary (seed + time) | Identical live and offline. A server calendar can override it later. |
| M11 | First storm guaranteed at minute 7; first arrival guaranteed within about 30 s | The first session must show that the world changes. |
| M12 | Procedural placeholder art with a parts contract | Zero asset cost while proving the fun. A clean handoff to an artist. |

## Approved by you (Oct 2, 2026)

| # | Decision | Status |
|---|---|---|
| A1 | **Confirm-first rule:** major additions or changes are proposed with options and wait for your OK | Standing rule |
| A2 | **Storage:** pets can be picked up and stored; stored pets pause (no growth, mutations or wandering). Extra slots cost coins, not Starshards | Planned (economy phase) |
| A3 | **Selling, two ways:** quick-sell any time (lower price, "Are you sure?" step) and a traveling Collector who pays more. Price grows with rarity, size and mutations | Planned (economy phase) |
| A4 | **Favorites:** a ❤️ pet can never be sold | Planned (economy phase) |
| A5 | **Growth:** hatchlings start small and grow; each has a random max size | Planned (creature phase) |
| A6 | **Personalities:** e.g. energetic pets squabble and dig more; digging can turn up coins and shards | Planned (creature phase) |
| A7 | **First eggs:** the first 2–3 hatches are always a new creature; later ones have a small chance | Planned (creature phase) |
| A8 | **Coins:** the soft currency becomes an 8-bit coin | Planned (economy phase) |
| A9 | **Music:** cozy acoustic (kalimba/marimba), shifting for day, night, storms and eclipses. Option A chosen: the game composes it live (no music files), with a mood for day, night and each of the 5 sky events, plus a separate Music on/off in Settings | ✅ Built |
| A10 | **Tap a pet:** name and current activity above its head, ⚙️ for the full menu | ✅ Built |
| A11 | **Shop as a building** with a sign that faces the player when zoomed in | ✅ Built |
| A12 | **Clearer bait spots and a decluttered map** | ✅ Built |
| A13 | **UI visual style:** bright, chunky casual style from your reference image (glossy outlined buttons, purple panel headers, orange dock tiles, Lilita One + Nunito fonts) | ✅ Built |
| A14 | **Map style:** bright toy-box (saturated colors, navy outlines on creatures, buildings and scenery) | ✅ Built |
| A15 | **Ads summon events** (replaces the mutation-boost ad idea): watching an ad starts a random sky event, any time, within the 6-ads-a-day cap | ✅ Built |
| A16 | **New events:** Starry Night (new Starlit mutation), Full Moon (stronger Lunar, wakes night creatures), Blizzard (new Frost mutation). They can also happen naturally, but rarely | ✅ Built |
| A17 | **Storm clouds** sit on the horizon behind the island instead of covering the screen | ✅ Built |
| A18 | **Growth:** hatchlings start at 45% size and grow up over time (15 min in the prototype) to a random grown size (Tiny to Huge) | ✅ Built |
| A19 | **Personalities:** energetic, lazy, shy, curious, grumpy, friendly. They change wandering, napping, squabbling and how often a pet digs | ✅ Built |
| A20 | **Digging** replaces random ground gifts: pets walk over and dig up coins, sometimes gems, items, or even an egg | ✅ Built |
| A21 | **First 3 eggs** always hold an undiscovered creature; later eggs have a 6% "distant relative" chance | ✅ Built |
| A22 | **New creatures:** Sunscale and Cinderskink (lizards), Emberdrake (rare dragon), Starwyrm (legendary dragon, Dragon + Starlit), Coralpuff, Driftjelly, and the legendary **Axolotl** | ✅ Built |
| A23 | **Axolotl is the mascot**: it replaces the owl in the coach and on notifications | ✅ Built |
| A24 | **Archipelago, island hopping:** Ember Peak and Coral Lagoon to unlock (coins, or gems to skip ahead); Sunny Shore and Dune Hollow shown as "coming soon". Only the island you're on is fully simulated | ✅ Built |
| A25 | **Island sizes:** Small → Medium → Large (more room and capacity), coins or gems | ✅ Built |
| A26 | **Egg shop:** coin eggs (Meadow, Wanderer, Ember, Reef) plus a premium gem **Starry Egg** with better rare odds. Wild species only; hybrids must be made | ✅ Built |
| A27 | **Widgets:** in-game widget (next egg + pinned pet) now; real phone home-screen widgets come with the store build | ✅ In-game built |
| A28 | **HUD:** coins on the left, Starshards to their right | ✅ Built |
| A29 | **Stacking, glowing mutations:** every mutation's look shows at once; rarer mutations glow, the rarest glow strongly with sparkles. Tiers: common (Storm, Lunar), rare (Frost, Starlit, Giant), epic (Prismatic), legendary (coming); 3+ stacked mutations add a level | ✅ Built |
| A30 | **Shop tabs + monkey shopkeeper:** category buttons (Lures, Eggs, Decor, Food, Starshards) and a monkey at the counter (**Mango**, in a fez, waving from the shop window). Food tab arrives with hunger (A36) | ✅ Built |
| A31 | **Round dome islands you can spin:** each island is a rounded mound (top of a little globe); drag to rotate; creatures roam all of it. Built as a spherical-cap dome (height 20% of radius) with level terraces for water, lava, lure spots and buildings; trees lean with the slope. Controls: one-finger drag spins and tilts, two fingers pan, pinch zooms (mouse: right/shift-drag pans) | ✅ Built |
| A32 | **Pick up and drag creatures:** press-and-hold to lift. Drop on another creature → "Breed these two?" → egg in a free nest, both parents stay. Drop on a **dig spot** (sparkly dust, bubbling puddle, berry bush) → pet digs/fishes/forages for coins, gems, items. Automatic digging (A20) **stays** alongside. Built: hold ~0.3 s to lift; pink ring = breed target, gold ring = dig spot. Dig spots appear about every 6 min per owned island (max 2, last 25 min), saved in the game (save v3). Finds pop out as gifts you tap to collect | ✅ Built |
| A33 | **Legendary mutations:** first the rare **Angel event** (clouds sweep in, grand music; choose any rare mutation for one creature; a random creature becomes Angelic with halo + wings). Then **Infernal** (Ember Peak) and **Abyssal** (Coral Lagoon) events. Not summonable with ads. Built: Angels ~1 per 18 h, Eruption and Deep Tide ~1 per 24 h once you own the island (3 min each); clouds sweep across, the light changes, intense music; a 🎁 GIFT button appears for 24 h (choose any creature and any non-legendary mutation); new legendary mutations Angelic (halo + wings), Infernal (horns + embers), Abyssal (deep-sea glow). Settings has playtest buttons to trigger them | ✅ Built |
| A34 | **New creatures + open Sunny Shore and Dune Hollow:** ~9 new species (monkeys and kin, flamingos and wading birds, scorpions/snakes and kin). Unlocking an island gives only 1–2 starter creatures to breed from; the rest are bred or discovered, not pre-placed | ✅ Built (see A38) |
| A35 | **Mythical rarity (above Legendary):** Cloud Serpent (original long sky-dragon), Phoenix, Kraken (Coral Lagoon), Qilin, each found only in special ways | ✅ Built (see A39) |
| A36 | **Gentle hunger:** hungry after ~10 h; hungry pets get grumpy (squabble more, won't dig or breed) but never leave; fed pets get a happy bonus. Food: plantable fruit trees/bushes (regrow), feedbags (feed while away), shop food. Max 1 "peckish" reminder a day. Build with the Economy phase | Approved |
| A38 | **New roster:** Monkeys: Mossmonkey (common, Home), Lanternlemur (uncommon, night), Cindermonk (rare, Ember Peak). Sunny Shore: Flamingle, Pouchbill, Mistheron (uncommon). Dune Hollow: Sandpincer (scorpion), Dunecoil (sidewinder), Sunhood (rare cobra). Unlocking Sunny Shore / Dune Hollow gives a starter pair; lures there attract the commons; uncommon/rare come from breeding. Recipes: Mistheron = Bird + Shore + Tide (Flamingle × Pouchbill can make it); Sunhood = Reptile + Arachnid + Sand (Sandpincer × Dunecoil). Sunny Shore 3200 coins / 320 gems, Dune Hollow 4200 / 420; new lures Seaspray (Shore) and Sunbaked (Sand) | ✅ Built |
| A39 | **How Mythicals are found:** Cloud Serpent = breed two Dragons during a thunderstorm. Phoenix = breed a Bird with a fire creature during an eclipse. Kraken = only answers the Coral Reef lure under a Full Moon. Qilin = breed a Dragon with a magical furry creature on a Starry Night. Mythicals always glow, sit in their own journal section and get a special hatch title | ✅ Built |
| A40 | **Fully round globe islands** (replaces A31's dome): each island is a small planet; creatures walk all the way around it. Shop, nests and fountain stay on top; lure spots, dig spots and scenery spread around the globe. Built: the flat island map wraps onto a sphere (equal-area, `content/globe.ts`; globe radius = 0.7 × map radius); creatures walk anywhere at even speed; no cast shadows (blob shadows under creatures instead) | ✅ Built |
| A41 | **Globe controls:** one finger rolls the globe any direction (look anywhere), two-finger twist spins, pinch zooms; a short how-to shows the first time (also in Settings) | ✅ Built |
| A42 | **Coin packs for real money** (like Starshard packs). Coin bar gets the same design as the Starshard bar, with a + button | Approved |
| A43 | **Behaviour traits:** separate from breeding types. Each creature rolls 2-5 quirks (Speedy, Lucky, Digger, Sleepy, Social, Glutton, Brave, Night Owl...) with real behaviours; today's personalities join the list. Shown as icons on the creature card. Built: 21 traits in `content/quirks.ts` (6 personalities + Lucky, Digger, Greedy, Sleepy, Glutton, Brave, Night Owl, Early Bird, Social, Loner, Swimmer, Explorer, Show-off, Musical, Clumsy), each with behaviour; parents pass some on; breeding types now labelled "Types" on the card | ✅ Built |
| A44 | **Trait Deleter** (pick one trait to remove, never below 2) and **Trait Wiper** (confirm, wipe all, fresh random 2-5) in Mango's shop for Starshards (Deleter 30, Wiper 20; Items tab) | ✅ Built |
| A45 | **Levels 1-50:** XP from playing (not idling); 1-5 quick, 20 = plays a good amount, 50 = days of active play but reachable. Every level gives coins + Starshards, growing to 45-50. Every 5 levels a level-only creature: 5 Jackalope, 10 Kitsune, 15 Flying Snake, 20 Pegasus, 25 Griffin, 30 Hippocampus, 35 Thunderbird, 40 Baku, 45 Sphinx, 50 Unicorn. Tap the level badge to see all rewards. Built: `core/levels.ts`; XP to next = 8·L^1.5 (Lv5 ≈ 120 XP, Lv20 ≈ 4.6k, Lv50 ≈ 55k ≈ 3 days of active play); XP table in tuning; existing saves get XP for past progress | ✅ Built |
| A46 | **Quests:** 3 daily quests (new each day) plus lasting tiered goals; rewards coins, Starshards and XP. Built: `core/quests.ts` (8 daily kinds incl. a Greedy-only fetch quest; 14 lasting chains: hatching, breeding, lures, coins picked up, coins fetched by creatures, dig spots, species, rare, Mythical, birds, reptiles, mutations, Colossal, Teeny); QUESTS button with a ready badge; dailies reset at midnight UTC | ✅ Built |
| A47 | **Hunger + economy all approved:** hunger bar, food sources (trees, feedbags, shop snacks), storage, selling + Collector | Approved |
| A48 | **Fixes requested:** shard skip price scales with hatch time; nickname typing bug; shard purchase button; rarity on creature card and name bubble; creature sizes vary widely with obvious tiny/huge outliers | Approved |
| A37 | **Build order:** quick wins (A29, A30) → round islands (A31) → drag/breed/dig spots (A32) → creatures, islands, mythicals (A34, A35) → Angel then Infernal/Abyssal (A33) → hunger + economy (A36) | Approved |

## Where I'm challenging the brief

**C1 (resolved: replaced by A15). "Watch Ad → increase mutation opportunity."** This sells discovery odds, which contradicts the rule "do not monetize discovery itself", and it trains players to feel that un-boosted discoveries are second-class. **Recommendation:** don't build it. Use "Watch ad → lure second wind" instead, which saves time without changing odds. *Not built.*

**C2. Premium incubator slots.** Nests are the throughput of the Create pillar, so selling them edges toward selling discovery speed. **Recommendation:** keep 2 free nests plus nests 3 and 4 for Starshards (built). In M1, test making nest 3 **earnable** through a journal milestone, so a free player can reach it.

**C3. "Exploration" with no avatar.** As written, this pillar has no mechanic. **Recommendation:** add Expeditions in M4. Send a creature out for a few hours; it returns with a story, an item, sometimes an egg or a scent from somewhere new.

**C4. Real-time vs accelerated day/night.** Real-world time would lock nocturnal creatures away from people who always play at the same hour. **Recommendation:** an accelerated cycle (about 90 minutes in production; 20 in the prototype). *Built as accelerated.*

**C5. "Can I make something nobody else has?"** This needs some awareness of others, without social dependency. **Recommendation (post-M2):** a server-side rarity census ("only 0.4% of keepers have seen a Giant Lunar Storm Mossfrog") and a share card. No trading, no leaderboards.

**C6. Breeding-chart risk.** Even trait rules can be charted eventually. **Recommendation:** seasonal resonance rotations through remote config, plus per-sanctuary "local secrets", so guides are always a little incomplete.

**C7. Long names.** Stacked mutations produce names like *Prismatic Giant Lunar Storm Mossfrog*. **Recommendation:** in production, show the two most recent mutation adjectives plus a "✦3" badge, with full details in the creature sheet. *The prototype shows full names.*

## Needs your input (grouped checkpoint)

| # | Decision | Options | My recommendation |
|---|---|---|---|
| D1 | **Game name and bundle ID** (permanent after first store upload) | Kindred Grove (working title) / something else | Keep "Kindred Grove" for playtests. Pick the final name before M2 store setup. |
| D2 | Orientation | A: Portrait (built) / B: Landscape | A |
| D3 | Engine | A: Web + Capacitor (built) / B: Unity | A, with the M2 performance gate as the trigger to revisit |
| D4 | Monetization rules | Approve C1 (drop ad-for-mutation-chance) and C2 (earnable 3rd nest) | Approve both |
| D5 | **Target audience age** | A: 13+ (standard ads/IAP) / B: all ages, including under 13 (COPPA, Apple Kids Category, limited ads, parental gates) | A. The cozy art still appeals to younger players, but B adds significant compliance and monetization limits. |
| D6 | Production art direction | A: commission a 3D artist for a custom style / B: start from licensed low-poly kits and customize | A for creatures (they're the product), B is acceptable for scenery |
| D7 | Production day length | 60 / 90 / 120 minutes | 90 minutes |

### Things only you can provide (when we reach M2/M5)

Apple Developer account ($99/yr), Google Play Console ($25 once), AdMob account, RevenueCat account (free tier), Firebase project, a privacy policy URL and support email, and the legal entity that will publish the app.
