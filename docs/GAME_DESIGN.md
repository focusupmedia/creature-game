# Kindred Grove: Game Design

> **North Star:** every session should make the player wonder what they'll discover next.
>
> Working title: **Kindred Grove** (see [DECISIONS.md](DECISIONS.md), D1).

This document covers sections A, B, E, F, G, H and I of the brief. MVP scope is in [MVP_SCOPE.md](MVP_SCOPE.md). Technology is in [ARCHITECTURE.md](ARCHITECTURE.md). Milestones are in [ROADMAP.md](ROADMAP.md).

---

## A. Product definition

**One line:** a living pocket sanctuary where mysterious creatures arrive, mix, hatch and change with the weather, and you never quite know what comes next.

| | |
|---|---|
| Genre | Cozy discovery / creature collection. No combat. |
| Platforms | iOS (iPhone, iPad), Android phones and tablets |
| Orientation | Portrait first (one-handed check-ins). iPad and tablets get a wider lens. |
| Session shape | 3 to 8 minute check-ins, several times a day. Optional longer "just watching" sessions. |
| Audience | Cozy and collection players aged 13+ (Neko Atsume, Viridi, Pokémon Sleep, Animal Crossing fans). Audience age is an open decision with compliance impact (D5). |
| Business model | Free to play. Premium currency for cosmetics, nests and convenience. Optional rewarded ads. Discovery itself is never sold. |
| Comparable feel | "A snow globe that keeps surprising you." |

### Pillars

1. **Discovery is the product.** Every system has to produce "I wonder what happens if…" moments.
2. **Creation.** Players cause discoveries through lures, pairings, timing and items, not just luck.
3. **Evolution.** Creatures build up a history. A *Giant Lunar Storm Mossfrog* is a story, not a stat block.
4. **Living world.** The sanctuary moves, sleeps, shelters, sings and changes while you watch and while you're away.

### What it is not

No PvP, combat, power stats, energy, forced ads, loot-box-first monetization, trading, leaderboards, or quests that turn discovery into a checklist.

---

## B. Core gameplay specification

### The loop

```
        ┌──────────── DISCOVER ◄────────────┐
        │  lures, the sky, eggs, gifts       │
        ▼                                    │
     CREATE ──► EVOLVE ──► LIVE ─────────────┘
  pair kindred   mutations   the world runs on
  creatures at   from sky,   without you, and
  the Font       eggs, tonic surprises pile up
```

Each check-in follows roughly the same rhythm:

1. **"What happened here?"** The away report, new visitors, eggs ready, gifts lying around.
2. **Hatch.** The reveal ritual.
3. **Re-arm.** Set lures, start eggs, try a pairing.
4. **Watch for a while** (optional).
5. **Leave with something unresolved:** an egg warming, a lure out, a storm in the forecast.

### Discovery sources (MVP ✓ = built)

| Source | How it surprises |
|---|---|
| ✓ Lures | Scent × place × time of day × sky decides who comes. |
| ✓ Combining | Trait resonance can produce hybrids that can't be lured. |
| ✓ Eggs | Clues before hatching. The sky can change an egg mid-incubation. |
| ✓ Sky events | Sparkfall and moonbeams mutate residents. |
| ✓ Rotating shop | Traveler's eggs and rotating lures. |
| ✓ Gifts | Small surprises left by creatures, including rare Starshards. |
| ✓ Hidden relationships | Moonpetal lures go dormant by day; swimmers only come to water. |
| Post-MVP: Expeditions | Exploration without an avatar: send a creature out, and it returns with a story, an item or an egg. |
| Post-MVP: Local secrets | Each sanctuary has seeded quirks, so online guides are never complete. |

### Lures (the brief's "bait")

Lures are named for **what they smell like**. Players learn by association ("river things like riverweed") instead of reading a stat table.

| Lure | Draws | Duration | Notes |
|---|---|---|---|
| Mossberry | Grove | 6 min* | Cheap staple |
| Riverweed | Tide | 6 min* | Swimmers only come to the Pond Edge |
| Honeydew | Bloom | 6 min* | Rotates in the shop |
| Moonpetal | Mystic | 8 min* | Only nocturnal Mystics answer. **Dormant by day unless there's an eclipse.** |

\*Prototype values so a playtest sees the whole loop. Intended production values are 30 to 60 minutes (see Economy).

Arrival weight = rarity × spot affinity × sky attraction, filtered by activity (day or night) and body plan (swimmers need water).
- **Spots:** Mossy Glade (Grove ×1.5, Mystic ×1.3) and Pond Edge (Tide ×2, Amphibian ×1.5, the only place swimmers arrive).
- **Dormancy:** if nothing can answer a lure right now, its timer pauses. The scent waits instead of being wasted. That feels fair, and it's a clue in itself.
- **Sky interaction (the brief's key mechanic):** during an event, arrivals may carry the event's mutation. The chance is much higher when the lure's scent matches the event's "empowered" habitat:
  - Storm empowers **Tide**: Riverweed during a storm gives a 35% Storm-mutation chance on arrival (10% otherwise).
  - Eclipse empowers **Mystic**: Moonpetal during an eclipse gives 55% Lunar (15% otherwise). Eclipses also count as "dark", so nocturnal Mystics come out at noon.
- The journal writes the relationship down the first time the player causes it ("A Moonpetal Lure during an Eclipse drew a Lunar Duskmoth."). That replaces the wiki.

### Combining (the Kindred Font)

- **Kindred rule:** two creatures can pair only if they **share at least one trait**. Because mutations add traits, a Lunar fish and a Lunar moth become kindred even though their plain forms aren't. Mutations unlock pairings.
- **Resonance:** hybrids come from **traits**, not species pairs. If both parents together carry all the required traits, the hybrid can form (the chance is rolled):

| Hybrid | Needs | Chance |
|---|---|---|
| Lilyhop | Amphibian + Bloom | 35% |
| Shellshroom | Reptile + Fungus | 40% |
| Moonmoth | Insect + Lunar | 45% |
| Thunderwren | Bird + Storm | 45% |
| Starkoi | Fish + Mystic | 35% |
| Nimbuwhale | Spirit + Tide + Storm | 30% (legendary) |

- **The sky lends a trait:** if the only missing trait is the active event's (Lunar during an eclipse, Storm during a storm), the rule can still fire at half strength. *Combining during events matters.*
- **Otherwise:** the egg is one parent's species (50/50). Each parent mutation passes on independently (35 to 50%). Same-species pairs have a 12% chance of **Giant**. An active sky event adds a 15% chance of its mutation. Prismatic is a 0.5% bolt of luck.
- **Parents are not consumed.** Creatures are companions with histories, not crafting inputs. Throughput is limited by nests instead.

**Why this resists "solved breeding charts":** outcomes depend on mutation state (which varies per creature), the sky at the moment of pairing, and rolled chances. A chart can say "Insect + Lunar can make a Moonmoth". It can't hand you a Lunar insect. New resonance rules ship through remote config each season, so charts go stale.

### Eggs and incubation

- Eggs **physically sit in nests** in the world. They rock harder as they near hatching and glow and shake when ready.
- **Clues:** the shell pattern encodes type (spots for wild species, stripes for swimmers, swirls for hybrids). Inspecting an egg gives sensory hints ("cool and slightly damp", "crackles when you touch it", "surprisingly heavy"). The species name is never shown.
- **Eggs feel the sky:** an incubating egg can absorb a passing event's mutation (Storm 20%, Eclipse 25%). The egg flashes, and its story records it.
- **Incubation** (prototype): common 2 min, uncommon 5, rare 12, legendary 30, plus 1.5 min per mutation. Production is about 10× (see Economy).
- **Hatch ritual:** a dark stage, "Tap the egg!" (three taps crack it), a flash, then the creature appears with light rays and confetti. The title reads "NEW DISCOVERY" or "NEW CREATION" for a first sighting, and the card shows traits and a first-ever-mutation callout.

### Mutations

Mutations **add, never replace**, and are stored in the order they were gained, so names read as history: *Giant Lunar Storm Mossfrog*.

| Mutation | Trait | Visual | Sources (MVP) |
|---|---|---|---|
| Lunar | Lunar | Silvered palette, crescent mark, night halo | Eclipse arrivals, moonbeams, eggs during an eclipse, inheritance |
| Storm | Storm | Electric accents, orbiting sparks | Storm arrivals, sparkfall strikes, eggs during a storm, inheritance |
| Giant | Giant | 1.6× scale | Same-species pairing, Rootswell Tonic, inheritance |
| Prismatic | Prismatic | Cycling rainbow palette | 0.5% on any arrival, pairing or shop egg, inheritance |

Every mutation is a **visual + trait + new pairing possibility**. None of them are numbers.

### Sky events (environmental events)

The schedule is a pure function of (world seed, creation time, time), so the same events happen whether the player is watching or away. It can be replaced by a server calendar for global live events.

| Event | World changes | Discovery hooks |
|---|---|---|
| ⛈️ Thunderstorm | Rain, dark clouds, lightning, swaying trees. Exposed creatures run for tree shelter. Amphibians sing. | Tide lures strengthened (×1.6 rate). Storm arrivals. **Sparkfall** strikes a resident (up to 2 per storm, 30% to mutate). Eggs may absorb Storm. Lends Storm to pairings. |
| 🌘 Eclipse | The moon slides over the sun. Purple dusk, stars, a corona. Creatures stop and look up. Mystics sparkle. | Nocturnals wake at noon. Mystic ×3 and Spirit ×3 attraction. Lunar arrivals. **A moonbeam** silvers a resident (Mystics favored). Eggs may absorb Lunar. Lends Lunar to pairings. |

- **Forecast teaser:** about 90 seconds before an event, the banner hints at it ("The air feels heavy. The Mossfrogs have started singing."). This gives a reason to stay or to prepare a lure.
- **First-session guarantee:** the first storm arrives 7 minutes into a new sanctuary.

### The sanctuary (living world)

- A floating forest island diorama: pond, glade, the Kindred Font, nests, a merchant's stall, trees, rocks, wildflowers, drifting clouds below, fireflies at night.
- **Day and night:** an accelerated 20-minute cycle in the prototype (production recommendation: about 90 minutes, D7). Sky gradient, sun and moon, stars, and lighting moods all follow it.
- **Creature behavior:** wander, idle, nap (diurnals at night, nocturnals by day), visit lures that smell right, greet neighbors (💕 if kindred, 👋 otherwise), shelter from storms, sing in the rain, look up at eclipses, celebrate after a mutation. Each body plan has its own motion: hop, walk, scuttle, fly, swim, slither, waddle, float.
- **Gifts:** creatures leave small sparkling gifts (Glimmer, rarely Starshards). Tapping them is a reason to look closely at the world.
- **While you were away:** the same simulation runs over the gap (capped at 12 hours) and produces a story summary.

### Shop (the Traveling Merchant)

The stock rotates every 20 minutes in the prototype (production: about 4 hours).

- **Staples:** Mossberry and Riverweed, always available.
- **Curiosities:** Moonpetal and Honeydew rotate in. One item (Rootswell Tonic or Warm Stone). One **Traveler's Egg**: a non-common *wild* species, never a hybrid, because hybrids must be made.
- **Decor:** two Glimmer decorations plus one **rotating premium decoration** (Starshards only, shown with ✦).
- **Refresh early:** 5 💎 or one rewarded ad.

---

## E. UX / UI

### Principles

- **The world is the menu.** Tap the glade to place a lure, the Font to combine, a nest to hatch, the stall to shop. The dock below is a shortcut, not the primary interface.
- **One thumb.** Everything interactive sits in the bottom 60% of the screen. Sheets rise from the bottom.
- **Never block watching.** Sheets are dismissable by tapping the world. There are no full-screen interrupts except the hatch reveal and the away report.
- **Say it like a naturalist.** Copy is sensory and curious ("It smells faintly of moss"), never a stat sheet.

### Screen map

```
┌─────────────────────────────┐
│ ✨120  💎10       ☀️Morning ⚙ │  HUD: soft and premium currency, time/sky chip, settings
│   ⛈ Thunderstorm · 3:12      │  Event banner / forecast teaser
│   [toasts]                   │  Arrivals, discoveries, journal notes
│                              │
│        3D SANCTUARY          │  Drag: pan · Pinch: zoom · Twist: rotate · Tap: inspect
│                              │
│  🦉 coach bubble (FTUE)      │
│ ┌──────────────────────────┐ │
│ │🌿Lures ⛲Create 📖Journal 🛍Shop 🪴Decor│ Dock
│ └──────────────────────────┘ │
└─────────────────────────────┘
```

### Sheets

| Sheet | Opens from | Contents |
|---|---|---|
| Lure spot | Tap glade/pond, or 🌿 | Active lure timer and visitors, or a dormant explanation, or the lure list with scents → Place |
| Creature | Tap a creature | Portrait, name (renameable), blurb, trait chips (mutations highlighted), **Story** timeline, Create with…, Say goodbye |
| Kindred Font | Tap the Font, or ⛲ | Two slots; the picker marks kindred options with 💚; verdict shows shared traits; sky shimmer note; free nests |
| Nest / Egg | Tap a nest | Clues, progress, hatch / ▶ ad hatch / 💎 hatch / use item; build-nest offer on empty pedestals |
| Shop | Tap the stall, or 🛍 | Refresh timer, refresh options, lures / curiosities / decor, Starshard packs |
| Journal | 📖 | Creatures (silhouettes and hints for unknowns), Mutations (hints), Notes (observations) |
| Decor | 🪴 | Owned decorations → placement mode (ghost preview, valid/invalid feedback) |

### First-time user experience (built)

The coach is an owl. It is contextual and never modal.

1. "Tap the glowing ring in the Mossy Glade to set out a lure." (The glade ring pulses.)
2. Lure placed: "Watch for a while, or come back later. The sanctuary keeps living." The first arrival is guaranteed within about 10 to 30 seconds.
3. Arrival: "Someone new arrived! Tap a creature."
4. "Creatures who share a trait can make an egg together. Tap the stone Font."
5. Egg made (the tutorial egg is capped at 40 seconds): "Your egg is warming… eggs feel the weather too."
6. Hatch reveal, then: "Try new lures, places and pairings. The sky has a mind of its own."
7. The first storm arrives at minute 7.

---

## F. Art direction

**"A miniature world in a snow globe."** Stylized 3D, an angled diorama camera, soft toon shading.

- **Shapes:** chunky, rounded primitives; big readable silhouettes; oversized eyes with highlights; low-poly faceted scenery and smooth creatures, which separates them from the background.
- **Shading:** a single 3-band toon ramp shared by every material for one cohesive illustrated look, plus soft shadows from one sun.
- **Color:** saturated but warm. Habitats have color families (Grove greens, Tide blues, Bloom pinks and yellows, Mystic violets). Mutations have signature treatments that read across any species (Lunar silver-lavender with a crescent, Storm yellow with sparks, Giant scale, Prismatic hue cycling). These also work without color via shape cues: crescent, sparks, size.
- **Light tells time:** dawn peach, noon blue, dusk coral, night indigo with fireflies, storm slate, eclipse violet.
- **Readability over detail:** creatures must read at about 40 px tall. The mutation overlay must read at that size too.
- **Production pipeline:** the prototype builds creatures procedurally from primitives (fast iteration, zero asset cost). Production replaces them with hand-modeled low-poly glTF models that keep the same **parts contract** (body, head, wings, legs, tail, glow anchors), so the procedural animation code keeps working. No skeletal rigs are needed for most species, which is a large cost saving.
- **UI:** cream "field journal" paper, rounded type (Fredoka), emoji placeholders → a custom icon set in production.

---

## G. Creature system

### Model

```
Creature = Species (body plan, native traits, activity, rarity)
         + Mutations[] (ordered; each adds a trait + visual)
         + Story[] (arrival, pairings, strikes, moonbeams, hatching)
         + seed (subtle color/size variance) + optional nickname
```

### Trait taxonomy

| Family | Traits | Role |
|---|---|---|
| Habitat | Grove, Tide, Bloom, Mystic | What lures attract; spot affinity |
| Kind | Amphibian, Reptile, Insect, Bird, Fish, Mammal, Fungus, Spirit | Body plan; resonance ingredients |
| Acquired | Lunar, Storm, Giant, Prismatic | Mutation traits; unlock pairings and hybrids |

### MVP roster: 12 wild + 6 created

| Creature | Traits | Active | Rarity | Motion |
|---|---|---|---|---|
| Mossfrog | Amphibian Grove Tide | Day | Common | Hop |
| Pebbleback | Reptile Tide | Day | Common | Walk |
| Glowbeetle | Insect Grove | Night | Common | Scuttle |
| Petalwing | Insect Bloom Grove | Day | Common | Fly |
| Glimmerfin | Fish Tide | Any | Common | Swim |
| Puffwren | Bird Grove | Day | Common | Hop |
| Vinecoil | Reptile Grove | Any | Uncommon | Slither |
| Burrowbun | Mammal Grove Bloom | Day | Common | Hop |
| Capling | Fungus Grove | Night | Uncommon | Waddle |
| Fernkit | Mammal Grove Mystic | Night | Uncommon | Walk |
| Duskmoth | Insect Mystic | Night | Uncommon | Fly |
| Lumewisp | Spirit Mystic | Night | Rare | Float |
| *Lilyhop* | Amphibian Bloom Tide | Day | Uncommon | Hop |
| *Shellshroom* | Reptile Fungus Grove | Any | Uncommon | Walk |
| *Moonmoth* | Insect Mystic Lunar | Night | Rare | Fly |
| *Thunderwren* | Bird Grove Storm | Day | Rare | Hop |
| *Starkoi* | Fish Tide Mystic | Any | Rare | Swim |
| *Nimbuwhale* | Spirit Tide Storm | Any | Legendary | Float |

18 species × 2⁴ mutation combinations gives **288 distinct visual forms** in the MVP, from 18 models. With the full roster of 30 species and 8 mutations, that grows to tens of thousands of forms.

### Combinatorial depth by design

- Starkoi needs Fish + Mystic, but no plain Mystic shares a trait with a fish, so the player must **mutate both** (for example, both Lunar). It's a multi-step puzzle the player solves by understanding, not by lookup.
- Nimbuwhale needs Spirit + Tide + Storm across two kindred parents: for example, a Storm Lumewisp with a Storm Mossfrog, or a Lumewisp paired during a storm with a Tide creature it has become kindred with.

---

## H. Economy and monetization

### Currencies (only two)

| | Glimmer ✨ (soft) | Starshards 💎 (premium) |
|---|---|---|
| Earn | Gifts from creatures (capped at 8 contributing residents and 14 on the ground); discovery rewards | First discoveries (2 to 5), rare gifts (3%), purchase |
| Spend | Lures, tonics, Warm Stones, Traveler's Eggs, standard decor | Nests 3 and 4, finishing eggs early, early shop refresh, rotating premium decor |

**Faucets are tied to looking at the world** (tapping gifts), not to idling or grinding. Sinks are consumable lures, so Glimmer keeps flowing into discovery.

### Hard rules

1. **Never sell discovery.** No creature, lure, hybrid or mutation for Starshards. Traveler's Eggs are Glimmer only and never hybrids.
2. **Premium saves time or adds beauty.** It never adds power, because there isn't any power to add.
3. **Free players get a complete game:** 2 free nests, all content reachable, and a premium currency trickle from discoveries.

### Rewarded ads (optional, never interstitial)

| Placement | Offer | Limit |
|---|---|---|
| Egg (≤ 15 min left) | ▶ Hatch now | Once per egg |
| Shop | ▶ Free refresh | Shared cap |
| *(Post-MVP)* Lure expired | ▶ Second wind (+50% duration) | Shared cap |

There is a global cap of **6 ads per day**. Ads never appear at the start of a session, during a reveal, or as a condition of anything.

> I recommend **not** building "Watch ad → increase mutation chance" from the brief. It sells discovery odds (see [DECISIONS.md](DECISIONS.md), C1).

### Premium catalogue (launch)

- Starshard packs: $0.99 (60), $4.99 (330), $9.99 (720), $19.99 (1,600).
- **Nests 3 and 4:** 50 💎 and 120 💎 (a permanent quality-of-life upgrade, and the anchor purchase).
- **Rotating cosmetics:** premium decor, then sanctuary themes (Autumn Grove, Moonlit Grove), creature accessories (flower crowns, tiny scarves) and ambient effects (petal fall, aurora sky). These rotate out to create urgency without FOMO on discovery.
- **Post-MVP: Keeper's Pass** (monthly, about $4.99): a cosmetic track plus a +1 lure slot convenience. It must never contain creatures.

### Production pacing targets (prototype ÷ about 10)

| | Prototype | Production |
|---|---|---|
| Day cycle | 20 min | about 90 min |
| Lure duration | 6 to 8 min | 30 to 60 min |
| Common egg | 2 min | 15 to 20 min |
| Rare egg | 12 min | 2 to 4 h |
| Legendary egg | 30 min | 8 h |
| Shop rotation | 20 min | 4 h |
| Event window | 22 min | about 3 h |

All of these values live in `src/content/tuning.ts` and can be overridden through remote config.

---

## I. Retention design

| Horizon | The player should… | How the design delivers it |
|---|---|---|
| **First 5 min** | Enter, see life, place a lure, discover something, start an egg | 3 starter creatures already living; owl coach; guaranteed first arrival in under 30 s; tutorial egg hatches in 40 s; first reveal |
| **First session** | Multiple discoveries, first pairing, first event | Two lure spots; first storm at minute 7 with a forecast teaser; sparkfall; journal notes appearing |
| **Day 1** | Several discoveries, first mutations, eggs, a reason to return | Eggs left warming; lures that work while away; the away report; shop rotation dot; Moonpetal tease ("works at night?") |
| **Day 7** | A recognizable sanctuary, some combinations understood, unknowns remaining | Decor placed; named creatures with stories; journal at 60 to 70% (bot sim: about 11 of 18 after a week of check-ins); hybrids that need multi-step planning; legendary still unseen |
| **Long-term** | Keep wondering | Seasonal resonance rules; new habitats (Tidepool, Crystal Cavern) each bringing new lures, spots and creatures; new events (meteor shower, aurora, bloom); expeditions; local secrets; a rarity census ("only 0.4% of keepers have seen this") |

**Return reasons are curiosity, not obligation:** an egg warming, a lure working, a forecast, a shop rotation, gifts piling up. There are **no streak punishments, no daily login calendar** and **no expiring discoveries**. Missing a day costs nothing except the surprises that are waiting for you.

### KPIs to validate the fun (Milestone 1)

- Time to first hatch: under 4 minutes. Median pairings tried in session 1: at least 2.
- Percentage of players who "just watch" for 30+ seconds without input (signals the living world works).
- D1 retention at least 40%, D7 at least 15% in soft launch.
- Distinct species discovered per player per day; share of hybrids discovered through deliberate (trait-aware) pairings.
