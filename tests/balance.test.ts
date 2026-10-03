// Pacing simulation: a scripted "curious player" plays the sanctuary so we can
// see how fast discoveries come. Run with `npm run sim` and read the table.
// The assertions guard the two failure modes that kill this genre:
// discoveries too slow (boring) and everything found too fast (nothing left to wonder about).

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/state';
import { islandCapacity, tick } from '../src/core/sim';
import { keepVisitor, sendAwayVisitor } from '../src/core/care';
import { buyOffer, collectGift, hatch, placeLure, release, startCombine } from '../src/core/actions';
import { compatibility } from '../src/core/genetics';
import { isDark } from '../src/core/world';
import { SPECIES } from '../src/content/species';
import { StateRng } from '../src/core/rng';
import type { GameState } from '../src/core/types';

const MIN = 60_000;

interface Snapshot { min: number; species: number; hybrids: number; mutations: number; glimmer: number; creatures: number }

function playMinute(s: GameState, t: number, rng: StateRng): void {
  for (const g of [...s.gifts]) collectGift(s, g.id);
  // Greet lure visitors: keep the interesting ones, thank the rest.
  for (const v of [...s.visitors]) {
    const keep = v.creature.mutations.length > 0 || s.journal.species[v.creature.species].count <= 2;
    if (!keep || !keepVisitor(s, v.creature.id, islandCapacity(s, v.island)).ok) sendAwayVisitor(s, v.creature.id);
  }
  for (const e of s.eggs.filter((e) => e.progressMs >= e.incubationMs)) hatch(s, e.id, t);
  const dark = isDark(s, t);
  for (const spot of ['glade', 'pond']) {
    if (s.spots[spot]) continue;
    const want = dark && spot === 'glade' ? 'moonpetal' : spot === 'pond' ? 'riverweed' : rng.chance(0.3) ? 'honeydew' : 'mossberry';
    if (!s.lures[want]) {
      const offer = s.shop.offers.find((o) => o.ref === want && o.stock > 0);
      if (offer) buyOffer(s, offer.id, t);
    }
    if (s.lures[want]) placeLure(s, spot, want, t);
    else if (s.lures.mossberry) placeLure(s, spot, 'mossberry', t);
  }
  // Experiment: try a random kindred pair, favouring creatures that carry mutations.
  for (let tries = 0; tries < 10; tries++) {
    const a = rng.pick(s.creatures);
    const b = rng.pick(s.creatures);
    if (!compatibility(a, b).ok) continue;
    if (startCombine(s, a.id, b.id, t).ok) break;
  }
  // Like a real keeper, make room by saying goodbye to plain duplicates.
  while (s.creatures.length >= islandCapacity(s, 'home') - 1) {
    const plain = s.creatures.find((c) => c.mutations.length === 0 && s.journal.species[c.species].count > 1)
      ?? s.creatures.find((c) => c.mutations.length === 0);
    if (!plain || !release(s, plain.id).ok) break;
  }
}

function snapshot(s: GameState, min: number): Snapshot {
  const found = Object.keys(s.journal.species);
  return {
    min,
    species: found.length,
    hybrids: found.filter((id) => SPECIES.find((x) => x.id === id)!.origin === 'hybrid').length,
    mutations: Object.keys(s.journal.mutations).length,
    glimmer: s.glimmer,
    creatures: s.creatures.length,
  };
}

function run(seed: number, pattern: 'binge' | 'checkins'): Snapshot[] {
  const t0 = Date.UTC(2026, 0, 1, 12);
  const s = createGame(t0, seed);
  s.tutorial = 9;
  const rng = new StateRng({ rng: seed * 31 + 7 });
  const out: Snapshot[] = [];
  const marks = [5, 15, 30, 60, 120, 240, 480, 1440, 4320, 10080];
  let t = t0;
  let mi = 0;
  for (let min = 1; min <= 10080; min++) {
    t = t0 + min * MIN;
    // binge = always watching; checkins = a 6-minute visit every 2 hours, 8am-11pm
    const hour = Math.floor(min / 60) % 24;
    const present = pattern === 'binge' ? min <= 480 : (min % 120) < 6 && hour >= 8 && hour <= 23;
    tick(s, t, { maxStepMs: present ? 2000 : 15_000 });
    if (present) playMinute(s, t, rng);
    if (min === marks[mi]) {
      out.push(snapshot(s, min));
      mi++;
    }
  }
  return out;
}

describe('pacing', () => {
  it('binge player: steady discoveries, never everything in a day', () => {
    const runs = [1, 2, 3, 4, 5].map((seed) => run(seed, 'binge'));
    const avg = (min: number, k: keyof Snapshot) =>
      runs.reduce((sum, r) => sum + (r.find((x) => x.min === min)?.[k] ?? 0), 0) / runs.length;
    const rows = [5, 15, 30, 60, 120, 240, 480].map((m) =>
      `${String(m).padStart(5)}m  species ${avg(m, 'species').toFixed(1).padStart(4)}  hybrids ${avg(m, 'hybrids').toFixed(1)}  mutations ${avg(m, 'mutations').toFixed(1)}  glimmer ${avg(m, 'glimmer').toFixed(0).padStart(5)}  creatures ${avg(m, 'creatures').toFixed(1)}`);
    console.log(`\nBINGE (always watching, first 8h)\n${rows.join('\n')}`);
    expect(avg(30, 'species')).toBeGreaterThanOrEqual(6);
    expect(avg(60, 'mutations')).toBeGreaterThanOrEqual(1);
    expect(avg(480, 'species')).toBeLessThan(SPECIES.length);
  });

  it('check-in player: still has things to find after a week', () => {
    const runs = [1, 2, 3, 4, 5].map((seed) => run(seed, 'checkins'));
    const avg = (min: number, k: keyof Snapshot) =>
      runs.reduce((sum, r) => sum + (r.find((x) => x.min === min)?.[k] ?? 0), 0) / runs.length;
    const rows = [120, 480, 1440, 4320, 10080].map((m) =>
      `${String(m / 60).padStart(5)}h  species ${avg(m, 'species').toFixed(1).padStart(4)}  hybrids ${avg(m, 'hybrids').toFixed(1)}  mutations ${avg(m, 'mutations').toFixed(1)}  glimmer ${avg(m, 'glimmer').toFixed(0).padStart(5)}`);
    console.log(`\nCHECK-INS (6 min every 2h while awake)\n${rows.join('\n')}`);
    expect(avg(1440, 'species')).toBeGreaterThanOrEqual(8);
  });
});
