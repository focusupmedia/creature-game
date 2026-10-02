# Kindred Grove: handoff notes for new sessions

Cozy mobile creature-discovery game (working title **Kindred Grove**). TypeScript + three.js + Vite, wrapped for iOS/Android with Capacitor. Work on branch `claude/mobile-game-dev-0nsqvl`.

## Working rules (from the owner)
- **Confirm before any major addition or change.** Explain the decision, give 2–3 options with tradeoffs and a recommendation, and wait for the owner's OK. Small fixes: just do them and report.
- Owner is non-technical. Keep chat replies plain-language and short.
- North Star: every session should make the player wonder what they'll discover next.

## Commands
`npm run dev` · `npm test` (49 tests, includes a pacing bot and music checks) · `npx tsc --noEmit` · `npm run build:single` (one-file build)

Playable link (private artifact, republish to the same URL): https://claude.ai/artifact/Vp8BW1soCF5jXTZ76FZ3hP. To republish, convert `dist-single/index.html` to artifact format (no doctype/html/head/body; keep title, styles, body divs, scripts) and publish it with the Artifact tool. Visual checks: Playwright with `executablePath: '/opt/pw-browsers/chromium'` against `npx vite preview --port 4173`, and `?debug` exposes `window.game`.

## Code map
- `src/core/`: pure, deterministic simulation (sim tick, actions, genetics, lures, world/events, shop, save + migrations; save version 4)
- `src/content/`: data (species, world: lures/spots/events/mutations/egg tiers, islands, terrain (dome height), layout, tuning)
- `src/platform/`: audio.ts (SFX + ambience), composer.ts + music.ts (generative music), services (storage, ads, IAP stubs)
- `src/render/`: World (multi-island, only the current island's actors animate), CreatureActor (AI, personalities, digging), creatureModels (procedural, outlined), sanctuary (island builders), sky (5 events)
- `src/ui/`: UI.ts (sheets, HUD, widget, islands), Labels.ts (world pins and name bubble), icons.ts (SVG incl. axolotl mascot), styles.css (chunky casual style)
- `docs/`: GAME_DESIGN, MVP_SCOPE, ARCHITECTURE, ROADMAP, DECISIONS (approved decisions A1–A37)

## Built so far
Lures, combining (trait-based hybrids), eggs and reveal, 6 mutations, 5 sky events (Storm, Eclipse, plus rare Starry Night, Full Moon, Blizzard), ad-summoned events (6 ads/day), generative cozy music (kalimba/marimba/bells; moods for day, night and each sky event; Music toggle in Settings), stacking mutation looks with rarity glow (rim, aura, sparkles), rotating shop with category tabs and Mango the monkey shopkeeper, egg tiers (coin eggs + premium gem Starry Egg), coins (8-bit) + Starshards, decor, journal, away report, tutorial with axolotl coach, pick up and carry creatures (press and hold; drop on another to breed, on a dig spot to dig/fish/forage), dig spots, growth to random size, personalities, squabbles, digging finds, first-3-eggs-always-new, 25 species including dragons and the legendary Axolotl, round dome islands you spin by dragging (`content/terrain.ts` groundY: everything standing on the ground must use it), archipelago (Home, Ember Peak, Coral Lagoon; Beach and Desert "coming soon"), island sizes S/M/L, in-game widget.

## Next up (approved, not built; details in docs/DECISIONS.md A29–A37, build in this order; A29–A35 are done)
1. **Legendary events:** Angel first, then Infernal and Abyssal (A33).
2. **Gentle hunger + Economy phase** (A36): storage (stored pets pause; extra slots cost coins), selling (quick-sell with an "Are you sure?" step, plus a traveling Collector who pays more; price = rarity × size × mutations), favorites can't be sold.

## Open / later
Real ads/IAP SDKs, native builds, real phone home-screen widgets, cloud save, final art and audio, final game name and bundle ID.
