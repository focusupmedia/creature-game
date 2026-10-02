# Kindred Grove (working title)

A cozy mobile game about a living sanctuary of mysterious creatures.
Set out lures, pair kindred creatures, hatch eggs, and watch the sky change everything.

**North Star:** every session should make the player wonder what they'll discover next.

This repository contains the **vertical slice**: the complete discover → create → evolve → live loop, playable in a phone browser, architected to ship to the App Store and Google Play through Capacitor.

## Play it

```bash
npm install
npm run dev        # http://localhost:5173 — open on your phone via the LAN URL
```

Controls: **drag** to pan · **pinch / scroll** to zoom · **two-finger twist** to rotate · **tap** anything.

**Playtest tools:** ⚙️ → *Playtest tools*. Use them to speed up time, skip ahead, jump to the next storm or eclipse, or grant currency. Add `?debug` to the URL to expose `window.game` in the console.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Core rules tests and the pacing simulation |
| `npm run sim` | Prints the discovery-pacing table from the bot keeper |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production web bundle in `dist/` (used by Capacitor) |
| `npm run build:single` | A single self-contained HTML file in `dist-single/` for sharing playtests |
| `npm run cap:sync` | Build and sync into the native iOS/Android projects |

## Docs

- [Game design](docs/GAME_DESIGN.md): product, systems, UX, art, creatures, economy, retention
- [MVP scope](docs/MVP_SCOPE.md): what's in the slice, and how we'll know it's fun
- [Architecture](docs/ARCHITECTURE.md): engine choice, structure, save, pipeline, mobile performance
- [Roadmap](docs/ROADMAP.md): milestones M0 to M7
- [Decisions](docs/DECISIONS.md): decisions made, challenges to the brief, decisions needed
