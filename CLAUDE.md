# Kindred Grove: handoff notes for new sessions

Cozy mobile creature-discovery game (working title **Kindred Grove**). TypeScript + three.js + Vite, wrapped for iOS/Android with Capacitor. Work on branch `claude/mobile-game-dev-0nsqvl`.

## Working rules (from the owner)
- **Confirm before any major addition or change.** Explain the decision, give 2–3 options with tradeoffs and a recommendation, and wait for the owner's OK. Small fixes: just do them and report.
- Owner is non-technical. Keep chat replies plain-language and short.
- North Star: every session should make the player wonder what they'll discover next.

## Commands
`npm run dev` · `npm test` (54 tests, includes a pacing bot and music checks) · `npx tsc --noEmit` · `npm run build:single` (one-file build)

Playable link (private artifact, republish to the same URL): https://claude.ai/artifact/Vp8BW1soCF5jXTZ76FZ3hP. To republish, convert `dist-single/index.html` to artifact format (no doctype/html/head/body; keep title, styles, body divs, scripts) and publish it with the Artifact tool. Visual checks: Playwright with `executablePath: '/opt/pw-browsers/chromium'` against `npx vite preview --port 4173`, and `?debug` exposes `window.game`.

## Code map
- `src/core/`: pure, deterministic simulation (sim tick, actions, genetics, lures, world/events, shop, save + migrations; save version 4)
- `src/content/`: data (species, world: lures/spots/events/mutations/egg tiers, islands, terrain (dome height), layout, tuning)
- `src/platform/`: audio.ts (SFX + ambience), composer.ts + music.ts (generative music), services (storage, ads, IAP stubs)
- `src/render/`: World (multi-island, only the current island's actors animate), CreatureActor (AI, personalities, digging), creatureModels (procedural, outlined), sanctuary (island builders), sky (5 events)
- `src/ui/`: UI.ts (sheets, HUD, widget, islands), Labels.ts (world pins and name bubble), icons.ts (SVG incl. axolotl mascot), styles.css (chunky casual style)
- `docs/`: GAME_DESIGN, MVP_SCOPE, ARCHITECTURE, ROADMAP, DECISIONS (approved decisions A1–A37)

## Built so far
Lures, combining (trait-based hybrids), eggs and reveal, 9 mutations (common/rare/epic/legendary tiers), 5 sky events (Storm, Eclipse, plus rare Starry Night, Full Moon, Blizzard), 3 legendary events (Angels, Eruption, Deep Tide; `core/legendary.ts`, `render/legendaryFx.ts`) with a claimable gift and legendary mutations (Angelic, Infernal, Abyssal), ad-summoned events (6 ads/day), generative cozy music (kalimba/marimba/bells; moods for day, night and each sky event; Music toggle in Settings), stacking mutation looks with rarity glow (rim, aura, sparkles), rotating shop with category tabs and Mango the monkey shopkeeper, egg tiers (coin eggs + premium gem Starry Egg), coins (8-bit) + Starshards, decor, journal, away report, tutorial with axolotl coach, pick up and carry creatures (press and hold; drop on another to breed, on a dig spot to dig/fish/forage), dig spots, growth to random size, personalities, squabbles, digging finds, first-3-eggs-always-new, 25 species including dragons and the legendary Axolotl, round dome islands you spin by dragging (`content/terrain.ts` groundY: everything standing on the ground must use it), archipelago (Home, Ember Peak, Coral Lagoon; Beach and Desert "coming soon"), island sizes S/M/L, in-game widget.

## Next up (approved, not built; details in docs/DECISIONS.md A40–A48; build in this order)
1. **Small fixes** (A48, A42): skip price scales with hatch time, nickname typing bug, shard purchase button, rarity on card + bubble, coin bar like shard bar, coin packs.
2. **Size outliers** (A48): mostly normal sizes, rare obvious tiny/huge.
3. **Fully round globe islands + globe controls** (A40, A41).
4. **Behaviour traits 2-5 + Trait Deleter/Wiper** (A43, A44).
5. **Levels 1-50 + level creatures + rewards directory** (A45).
6. **Daily + lasting quests** (A46).
7. **Hunger, food, storage, selling + Collector** (A47, A36).

## Open / later
Real ads/IAP SDKs, native builds, real phone home-screen widgets, cloud save, final art and audio, final game name and bundle ID.
