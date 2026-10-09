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
| A36 | **Gentle hunger (built, see A47):** hungry after ~10 h; hungry pets get grumpy (squabble more, won't dig or breed) but never leave; fed pets get a happy bonus. Food: plantable fruit trees/bushes (regrow), feedbags (feed while away), shop food. Max 1 "peckish" reminder a day. Build with the Economy phase | Approved |
| A38 | **New roster:** Monkeys: Mossmonkey (common, Home), Lanternlemur (uncommon, night), Cindermonk (rare, Ember Peak). Sunny Shore: Flamingle, Pouchbill, Mistheron (uncommon). Dune Hollow: Sandpincer (scorpion), Dunecoil (sidewinder), Sunhood (rare cobra). Unlocking Sunny Shore / Dune Hollow gives a starter pair; lures there attract the commons; uncommon/rare come from breeding. Recipes: Mistheron = Bird + Shore + Tide (Flamingle × Pouchbill can make it); Sunhood = Reptile + Arachnid + Sand (Sandpincer × Dunecoil). Sunny Shore 3200 coins / 320 gems, Dune Hollow 4200 / 420; new lures Seaspray (Shore) and Sunbaked (Sand) | ✅ Built |
| A39 | **How Mythicals are found:** Cloud Serpent = breed two Dragons during a thunderstorm. Phoenix = breed a Bird with a fire creature during an eclipse. Kraken = only answers the Coral Reef lure under a Full Moon. Qilin = breed a Dragon with a magical furry creature on a Starry Night. Mythicals always glow, sit in their own journal section and get a special hatch title | ✅ Built |
| A40 | **Fully round globe islands** (replaces A31's dome): each island is a small planet; creatures walk all the way around it. Shop, nests and fountain stay on top; lure spots, dig spots and scenery spread around the globe. Built: the flat island map wraps onto a sphere (equal-area, `content/globe.ts`; globe radius = 0.7 × map radius); creatures walk anywhere at even speed; no cast shadows (blob shadows under creatures instead) | ✅ Built |
| A41 | **Globe controls:** one finger rolls the globe any direction (look anywhere), two-finger twist spins, pinch zooms; a short how-to shows the first time (also in Settings) | ✅ Built |
| A42 | **Coin packs for real money** (like Starshard packs). Coin bar gets the same design as the Starshard bar, with a + button | Approved |
| A43 | **Behaviour traits:** separate from breeding types. Each creature rolls 2-5 quirks (Speedy, Lucky, Digger, Sleepy, Social, Glutton, Brave, Night Owl...) with real behaviours; today's personalities join the list. Shown as icons on the creature card. Built: 21 traits in `content/quirks.ts` (6 personalities + Lucky, Digger, Greedy, Sleepy, Glutton, Brave, Night Owl, Early Bird, Social, Loner, Swimmer, Explorer, Show-off, Musical, Clumsy), each with behaviour; parents pass some on; breeding types now labelled "Types" on the card | ✅ Built |
| A44 | **Trait Deleter** (pick one trait to remove, never below 2) and **Trait Wiper** (confirm, wipe all, fresh random 2-5) in Mango's shop for Starshards (Deleter 30, Wiper 20; Items tab) | ✅ Built |
| A45 | **Levels 1-50:** XP from playing (not idling); 1-5 quick, 20 = plays a good amount, 50 = days of active play but reachable. Every level gives coins + Starshards, growing to 45-50. Every 5 levels a level-only creature: 5 Jackalope, 10 Kitsune, 15 Flying Snake, 20 Pegasus, 25 Griffin, 30 Hippocampus, 35 Thunderbird, 40 Baku, 45 Sphinx, 50 Unicorn. Tap the level badge to see all rewards. Built: `core/levels.ts`; XP to next = 8·L^1.5 (Lv5 ≈ 120 XP, Lv20 ≈ 4.6k, Lv50 ≈ 55k ≈ 3 days of active play); XP table in tuning; existing saves get XP for past progress | ✅ Built |
| A46 | **Quests:** 3 daily quests (new each day) plus lasting tiered goals; rewards coins, Starshards and XP. Built: `core/quests.ts` (8 daily kinds incl. a Greedy-only fetch quest; 14 lasting chains: hatching, breeding, lures, coins picked up, coins fetched by creatures, dig spots, species, rare, Mythical, birds, reptiles, mutations, Colossal, Teeny); QUESTS button with a ready badge; dailies reset at midnight UTC | ✅ Built |
| A47 | **Hunger + economy all approved:** hunger bar, food sources (trees, feedbags, shop snacks), storage, selling + Collector. Built (`core/care.ts`): full→hungry in ~7 h, empty in 10 h; hungry = no digging/breeding + grumpier; well fed digs 25% more; Berry Tree decor (a berry every 90 min, up to 3); Snack, Feast Basket (whole island), Feedbag (20 portions, feeds hungry ones while away) in a FOOD shop tab; 1 'peckish' reminder a day; Storage 4 free slots + 5 paid (400-6000 coins), stored pets pause; Sell from the card with confirm (rarity × size × mutations), favourites and level gifts can't be sold; the Collector visits every ~6 h for 45 min, pays 2× and 3× for one type (BUYER button) | ✅ Built |
| A48 | **Fixes requested:** shard skip price scales with hatch time; nickname typing bug; shard purchase button; rarity on creature card and name bubble; creature sizes vary widely with obvious tiny/huge outliers | Approved |
| A49 | **Fixes batch:** breeding gives more variety (any species sharing a type with a parent can hatch, rarity-weighted; parents still need one shared type); dig-spot finds auto-collect; lower island capacity that grows with size; storage/inventory easy to find; rarity matches spawn rates (Axolotl truly legendary) and shows in the world; sheets keep their scroll; smaller XP bar; tapping a wandering creature stops it | ✅ Built |
| A50 | **Economy:** first new world cheap, later ones climb; each new world needs a keeper level first, then coins (no Starshards) | ✅ Built |
| A51 | **New sky events:** Rainbow (Prismatic more likely), Aurora (new Aurora mutation), Meteor Shower (Starshard rocks to pick up), Misty Fog (shy/magical visitors, new Misty mutation). All sky events 1.5× as common. Built: event windows every 15 min (was 22); each event has its own sky and music mood; meteor rocks hold 1-2 Starshards | ✅ Built |
| A52 | **Lure visitors wait** by the lure with a ! — tap to Keep or Send away (a small coin thank-you). Full world: Keep offers Make space (store/release) or Send to another world | ✅ Built |
| A53 | **Wanderers:** Fortune Teller (hint for a new pairing), Treasure Hunter (extra dig spots), Travelling Chef (berries → feast + happy), Gardener Gnome (free Berry Tree sapling / seeds), and a Goblin who steals a few coins or spoils a lure unless you tap him in time (tap scares him off, no prompt). Built (`core/wanderers.ts`): one at a time, about every 14 min of live play, never while you're away | ✅ Built |
| A54 | **Egg sprays** (Mango): Grow Mist, Shrink Mist, Glitter Spray (mutation chance), Speedy Spritz (30% faster) | ✅ Built |
| A55 | **Bigger, gentler globes** (~40% bigger, flatter-looking, still fully round) | ✅ Built |
| A56 | **One journal with world filters** | ✅ Built |
| A57 | **Replace every emoji with drawn icons**, menus and creature bubbles alike. Built: `ui/emoji.ts`; a test fails if an emoji has no drawn icon | ✅ Built |
| A58 | **Personal history:** card shows date met, sky event at the time, how obtained (lure, egg bred from X × Y, shop egg tier, level gift, dig find...). **Away finds:** creatures bring back coins/items while you're away ("Axolotl found 30 coins"). **Cross-world alerts:** ! on the Islands button/world when an egg is ready or an Epic+ visitor waits. **Inventory:** Wandering and Storage tabs, sort, favourites; full-world prompt offers Make space (store/release); level gifts ask place now or store | ✅ Built |
| A59 | **Growing worlds opens lure spots:** Medium and Large each open one new lure spot on every world (10 new spots); nests stay limited | ✅ Built |
| A60 | **Graphics clean-up:** new shaded coin to match the Starshard gem; hands drawn as clean silhouettes; gesture drawings on the controls card; tutorial coach card with Lotl the axolotl and step dots, never shown over a pop-up | ✅ Built |
| A61 | **Economy rebalance** (measured with `tests/economy.test.ts`, a bot playing four 20-min sessions a day): level 20 in about a week, 50 in about six weeks; worlds 1.5k/4k/9k/16k coins at Lv 4/8/14/20; growing 2.5k then 7k; selling pays less and mutation bonuses add up (capped) instead of multiplying; daily quests bigger (400-600 coins, 6-10 Starshards each) | ✅ Built |
| A62 | **Ads:** 12 rewarded ads a day for events/hatching/shop refresh; 5 free-coin ads a day in the shop's coins tab (60 + 15 per level) | ✅ Built |
| A63 | **Decor:** placement rebuilt (drag with arrows, Turn, green/red ring, only on open ground, on any world); scenery trees can be chopped (stump stays, a few coins); 96-piece catalog in six groups unlocked by keeper level (Magic set for Starshards) with thumbnails | ✅ Built |
| A64 | **Small fixes:** "Favorite" spelling and a heart that fills in; Feed button in the Pets list; islands spaced ~1.5x further apart; weather and sky follow the world you're on | ✅ Built |
| A65 | **Pet colors:** every pet rolls a color shade (common shades, rare Pastel, very rare Shiny); babies tend to inherit a parent's shade; color mutations tint on top. No patterns or accessories for now | Approved |
| A66 | **Expeditions:** send a pet away for 1-8 hours; it returns with coins/items/sometimes a rare egg and a short story | Approved |
| A67 | **Daily login calendar:** 7-day reward calendar that grows each day, big day-7 reward | Approved |
| A68 | **Collection rewards:** finishing a journal page (a world's creatures, all mutations...) pays a big one-time reward + badge | Approved |
| A69 | **Pet contests:** a weekly show; enter a pet judged on rarity, size and looks; prizes for placing | Approved |
| A70 | **Content (built):** ~10 new creatures (incl. 2 Mythicals with secret recipes), levels 51-100 (prestige), a 6th world: Cloud Isle (sky island, rainbow bridges, bird + spirit creatures, Breeze lure) | Approved |
| A71 | **Immersion:** friendship hearts (pet/feed/play; best friends follow you, dig better), gentle phone notifications (egg ready, rare visitor, Collector; max a couple a day), creature voices + world/weather ambience | Approved |
| A72 | **Build order:** colors → friendship → expeditions → login calendar → collections → notifications → voices → contests → new creatures → levels 51-100 → new world | Approved |
| A73 | **Quick fixes (Oct 3):** "Worlds" button; pet card: only Feed beside the hunger bar, heart on the picture, Store/Explore/Sell in one row; "go to shop" opens the right tab; spray text says it goes on eggs; Sound and Music volume sliders; storms rarer (22%, then 16% with the new skies); halos, wings, horns and frost fitted to each body; cleaner breed prompt | Approved, built |
| A74 | **Pets:** storage 10 free (up to 30), world chips and world groups, press-and-hold or Select to sell/store/move/release several at once | Approved, built |
| A75 | **Selling:** size (squared) and mutations (multiplied) raise prices; a daily Market board of three buyers paying ×2-3 plus a bonus | Approved ("Prices + Market board"), built |
| A76 | **Ads and packs:** free-coin ads come 8 at a time and quietly refill 30 min after the last watch (no visible timer); $19.99/$49.99/$99.99 coin and shard packs | Approved, built |
| A77 | **Sky items (Starshards):** a charm per sky, a Wild Sky Charm (random rare sky), a Star Chart (24 h forecast of the next 3 skies) and the Sky Telescope (forever) | Approved, built |
| A78 | **Keepers:** only the Goblin is chased off; the Fortune Teller, Treasure Hunter, Chef and Gnome open menus with a free kindness and role-fitting deals (once per visit) | Approved, built |
| A79 | **Large content round:** 6 skies (Heatwave, Blossom Breeze, Firefly Night, Gale, rare Bubble Rain and Great Comet), 8 mutations (one per new sky, plus Crystal from Crystal Caves trips and Golden for some best friends), 20 quests, 8 pet activities (chase, cuddle, butterflies/fireflies/bubbles, stargaze, splash, dance, sunbathe, ball) | Approved ("Large"), built |
| A80 | **Coming back:** away chest (fills up to 12 h; an ad doubles it), pets bring presents, a welcome-back gift after 1+ day (bigger after 3+) | Approved ("all three"), built |
| A81 | **Messages:** in-game pop-ups queue by importance, one at a time; real phone notifications wait for the native build (planner ready: rare sky starting, daily gift/contest ready, at most two) | Approved, built |
| A82 | **Cloud save:** Apple/Google built-in saved games (Game Center on iPhone, Play Games on Android; saves don't move between them), signed in automatically with a Sign in link in Settings, and a side-by-side "pick a save" card when saves disagree. Game side built; native plugins written, wired in at the app-build step (docs/CLOUD_SAVE.md) | Approved, built |
| A83 | **Branding:** the game is **Pocket Grove** by **Focus Up Media**; app ID `com.focusupmedia.pocketgrove`; axolotl mascot app icon; bright & chunky look; title splash. Save/storage keys keep their old `kindred-grove.*` names so nobody loses progress; the home world keeps its name "Kindred Grove" | Approved, built |
| A84 | **Small fixes:** sky events 5-20 minutes apart; babies mostly hatch plain (12% carry one parent mutation, sky events still mark eggs, so stacking is a plan); parting tutorial tips; eggs named and drawn in their own colours; glowing spreading hatch cracks; weights in kg; Store beside Feed; a ! when a new world can be opened | Approved, built |
| A85 | **Shop and selling:** a sell booth on every world; Shop/Sell signs seen from afar (Settings slider); anything can be sold, with a warning for Legendary+ and level gifts; Epic/Legendary/Mythical eggs and Shimmer/Golden/Mythic lures with a schedule that guarantees sightings (Legendary every 3 looks, Mythical within 6). Legendary/Mythical eggs may hold bred-only kinds | Approved, built |
| A86 | **Nests:** nests are decorations (press and hold to move, put away), one free nest per world, eggs go to a free nest on the world you're on, babies hatch there or straight into storage when full, up to 8 more nests from Mango for Starshards. Eggs take ~1.5x longer to hatch to keep the economy steady (save v15) | Approved, built |
| A87 | **Breeding, traits, growth:** no more than three of a kind in a row; hidden legendary after 30 eggs (then every 50) that shares a type with a parent; legendary parents rarely hatch copies; 5 new traits (Haggler, Sprouty, Doting, Hearty, Lure Lover) + real Social/Musical perks; Journal Traits tab; best friends get a crown and perks; growing takes 40 min x rarity and carries on while away; Sprout Snacks; Colossal up to 3.5x | Approved, built |
| A88 | **Halloween and extras:** Halloween season (Oct 1 - Nov 7) with six spooky skies at least hourly and six marks; Halloween Pass (25 tiers, free + paid track, $4.99 (approved)); Rare+/Epic+/Legendary+ totems; Nursery (level 10); 6 creatures (Sunmane Lion, Ember Tiger, Mossyphant, Bamboo Panda, Waddlefin, Duskbat); painted ground shading | Approved, built  |
| A91 | **Onboarding:** progressive button unlocks, quiet start during Lotl's Quest, bottom tap-to-dismiss toasts, just-in-time gesture tips instead of the controls card, found counter, name the first baby, glowing Lotl's Egg, next-day Sleepy Egg | Approved, built |
| A92 | **First store build:** iPhone + iPad (iPad portrait, full screen), real ads (`storeKeys.ts testing:false`), Restore purchases (Settings + pass card, silent check at launch), portrait only on phones; pre-release bug pass (native plugins now load via `SceneDelegate` → `ViewController`) | Approved, built |
| A93 | **Away is quieter (owner chose "small trickle"):** sky events, their mutations and legendary events only start while playing; at most 2 visitors per absence (`tuning.awayVisitors`); finds stop piling at 4 per world (`tuning.awayGiftsOnGround`) and are marked `gift.away` so they give no quest progress or XP | Approved, built |
| A94 | **Pass is monthly, one Consumable `pass_monthly`** (owner): no Restore button (all purchases consumable); buying is blocked while the current pass is owned; November pass comes as the first update. **Hunger half as fast while away** (`tuning.awayHungerRate`). "Make it bigger" prompts for full worlds (`UI.growRow`) | Approved, built |
| A95 | **Store page + ratings:** egg "See chances" (App Store rule for random paid items, `actions.eggOdds`), App Store / Play rating prompt after a happy hatch (`Game.maybeAskForRating`, native `requestReview` in GameServicesPlugin; after a day or 10 hatches, every 60 days max), captioned store screenshots (hatch, collection, skies, grove, monthly creatures) | Approved, built |
| A90 | **Social round:** friend codes + Game Center/Play Games leaderboards and achievements (owner chose codes over a server), a year of weekly mini-events with holiday festivals, growing login streaks, share cards, faster first eggs | Approved, built |
| A89 | **Playtest feedback round:** make-space picks highlighted + error sounds, condensed tutorial (no stuck highlights), Kindred Fountain, Journal "How to get" tab (`journal.howTo`), random limited lure/food/gadget stock + GADGETS tab (Nursery max 2) + restock toasts/notes, visitor pins + Go button, rarer mythicals, nursery eggs ready at once (no nest), hatch spin, friendship gifts/ignoring, Settings → What's new (`content/updates.ts`), Halloween Pass creatures (Pumpkit on purchase, mythical Wisp Stag at paid tier 25), Daily Rumours (`core/rumours.ts`) | Approved, built |
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
| D1 | **Game name and bundle ID** (permanent after first store upload) | Decided (A83): Pocket Grove, com.focusupmedia.pocketgrove | Search both stores for clashes right before the first upload |
| D2 | Orientation | A: Portrait (built) / B: Landscape | A |
| D3 | Engine | A: Web + Capacitor (built) / B: Unity | A, with the M2 performance gate as the trigger to revisit |
| D4 | Monetization rules | Approve C1 (drop ad-for-mutation-chance) and C2 (earnable 3rd nest) | Approve both |
| D5 | **Target audience age** | A: 13+ (standard ads/IAP) / B: all ages, including under 13 (COPPA, Apple Kids Category, limited ads, parental gates) | A. The cozy art still appeals to younger players, but B adds significant compliance and monetization limits. |
| D6 | Production art direction | A: commission a 3D artist for a custom style / B: start from licensed low-poly kits and customize | A for creatures (they're the product), B is acceptable for scenery |
| D7 | Production day length | 60 / 90 / 120 minutes | 90 minutes |

### Things only you can provide (when we reach M2/M5)

Apple Developer account ($99/yr), Google Play Console ($25 once), AdMob account, RevenueCat account (free tier), Firebase project, a privacy policy URL and support email, and the legal entity that will publish the app.
