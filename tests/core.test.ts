import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/state';
import { tick } from '../src/core/sim';
import {
  adHatch, buyOffer, canAdHatch, collectGift, hatch, placeLure, startCombine, useItem,
} from '../src/core/actions';
import { compatibility, combine } from '../src/core/genetics';
import { StateRng } from '../src/core/rng';
import { activeEvent, eventInWindow, isDark, nextEvent } from '../src/core/world';
import { deserialize, serialize } from '../src/core/save';
import { addMutation, creatureTraits, speciesTitle } from '../src/core/creatures';
import { arrivalWeights } from '../src/core/lures';
import { TUNING } from '../src/content/tuning';
import type { Creature, GameState } from '../src/core/types';

const T0 = Date.UTC(2026, 0, 1, 12);
const MIN = 60_000;

function fresh(seed = 42): GameState {
  return createGame(T0, seed);
}

function spawn(state: GameState, species: string, mutations: Creature['mutations'] = []): Creature {
  const c: Creature = { id: `t${state.creatures.length}${species}`, species, mutations, bornAt: T0, seed: 1, history: [] };
  state.creatures.push(c);
  return c;
}

describe('new sanctuary', () => {
  it('starts alive with starter creatures and lures', () => {
    const s = fresh();
    expect(s.creatures.map((c) => c.species)).toEqual(['mossfrog', 'petalwing', 'burrowbun']);
    expect(Object.keys(s.journal.species)).toHaveLength(3);
    expect(s.lures.mossberry).toBe(3);
    expect(s.glimmer).toBe(TUNING.start.glimmer);
  });
});

describe('sky events', () => {
  it('always brings a first storm early', () => {
    const s = fresh();
    const e = eventInWindow(s, 0)!;
    expect(e.kind).toBe('storm');
    expect(e.start - T0).toBe(TUNING.firstStormAtMin * MIN);
    expect(activeEvent(s, e.start + 1000)?.kind).toBe('storm');
    expect(nextEvent(s, T0)?.window).toBe(0);
  });

  it('is deterministic per seed and identical across devices', () => {
    const a = fresh(7);
    const b = fresh(7);
    for (let w = 0; w < 30; w++) expect(eventInWindow(a, w)).toEqual(eventInWindow(b, w));
  });

  it('schedules both kinds of events over a day of play', () => {
    const s = fresh(3);
    const kinds = new Set<string>();
    for (let w = 0; w < 40; w++) {
      const e = eventInWindow(s, w);
      if (e) kinds.add(e.kind);
    }
    expect(kinds).toEqual(new Set(['storm', 'eclipse']));
  });

  it('emits start and end once', () => {
    const s = fresh();
    const events = tick(s, T0 + 15 * MIN);
    expect(events.filter((e) => e.type === 'eventStart')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'eventEnd')).toHaveLength(1);
  });
});

describe('lures', () => {
  it('first lure guarantees a quick first discovery', () => {
    for (let seed = 1; seed < 20; seed++) {
      const s = fresh(seed);
      expect(placeLure(s, 'glade', 'mossberry', T0).ok).toBe(true);
      const events = tick(s, T0 + 45_000);
      expect(events.some((e) => e.type === 'arrival')).toBe(true);
    }
  });

  it('only swimmers reach the water spot', () => {
    const w = arrivalWeights('riverweed', 'glade', false, null).map(([s]) => s.id);
    expect(w).not.toContain('glimmerfin');
    const p = arrivalWeights('riverweed', 'pond', false, null).map(([s]) => s.id);
    expect(p).toContain('glimmerfin');
  });

  it('a lure with nobody to answer it waits instead of wasting', () => {
    const s = fresh();
    s.lures.moonpetal = 1;
    placeLure(s, 'glade', 'moonpetal', T0 + 30_000);
    const before = s.spots.glade!.expiresAt;
    tick(s, T0 + 3 * MIN);
    expect(isDark(s, T0 + 3 * MIN)).toBe(false);
    expect(s.spots.glade!.expiresAt).toBeGreaterThan(before);
  });

  it('nocturnal creatures only answer after dark or during an eclipse', () => {
    const day = arrivalWeights('moonpetal', 'glade', false, null);
    expect(day).toHaveLength(0);
    const night = arrivalWeights('moonpetal', 'glade', true, null).map(([s]) => s.id);
    expect(night).toEqual(expect.arrayContaining(['duskmoth', 'lumewisp', 'fernkit']));
  });
});

describe('combining', () => {
  it('requires a shared trait, and mutations open new pairings', () => {
    const s = fresh();
    const fish = spawn(s, 'glimmerfin');
    const moth = spawn(s, 'duskmoth');
    expect(compatibility(fish, moth).ok).toBe(false);
    addMutation(fish, 'lunar', T0, 'test');
    addMutation(moth, 'lunar', T0, 'test');
    expect(compatibility(fish, moth)).toMatchObject({ ok: true, shared: ['Lunar'] });
  });

  it('produces hybrids from trait resonance at roughly the tuned rate', () => {
    const s = fresh();
    const frog = spawn(s, 'mossfrog');
    const bun = spawn(s, 'burrowbun');
    const rng = new StateRng({ rng: 99 });
    let hybrids = 0;
    for (let i = 0; i < 2000; i++) if (combine(frog, bun, rng, null).species === 'lilyhop') hybrids++;
    expect(hybrids / 2000).toBeGreaterThan(0.28);
    expect(hybrids / 2000).toBeLessThan(0.42);
  });

  it('the sky can lend a missing trait at reduced odds', () => {
    const s = fresh();
    const a = spawn(s, 'petalwing');
    const b = spawn(s, 'glowbeetle');
    const rng = new StateRng({ rng: 5 });
    let calm = 0;
    let eclipse = 0;
    for (let i = 0; i < 2000; i++) {
      if (combine(a, b, rng, null).species === 'moonmoth') calm++;
      if (combine(a, b, rng, 'eclipse').species === 'moonmoth') eclipse++;
    }
    expect(calm).toBe(0);
    expect(eclipse).toBeGreaterThan(300);
  });

  it('never names a native trait as a mutation', () => {
    const s = fresh();
    const m1 = spawn(s, 'duskmoth', ['lunar']);
    const m2 = spawn(s, 'glowbeetle', ['lunar']);
    const rng = new StateRng({ rng: 1 });
    for (let i = 0; i < 500; i++) {
      const o = combine(m1, m2, rng, null);
      if (o.species === 'moonmoth') expect(o.mutations).not.toContain('lunar');
    }
    expect(speciesTitle({ species: 'moonmoth', mutations: ['lunar', 'giant'] })).toBe('Giant Moonmoth');
  });

  it('runs the full create → incubate → hatch cycle', () => {
    const s = fresh();
    const [frog, wing] = s.creatures;
    const r = startCombine(s, frog.id, wing.id, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.egg.nest).toBe(0);
    expect(hatch(s, r.egg.id, T0).ok).toBe(false);
    const events = tick(s, T0 + r.egg.incubationMs + 1000);
    expect(events.some((e) => e.type === 'eggReady')).toBe(true);
    const h = hatch(s, r.egg.id, T0 + r.egg.incubationMs + 1000);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(s.creatures).toContain(h.creature);
    expect(h.creature.history[0].text).toMatch(/Hatched from an egg made by/);
  });

  it('blocks combining when every nest is full', () => {
    const s = fresh();
    const [a, b, c] = s.creatures;
    expect(startCombine(s, a.id, b.id, T0).ok).toBe(true);
    expect(startCombine(s, b.id, c.id, T0).ok).toBe(true);
    const third = startCombine(s, a.id, c.id, T0);
    expect(third.ok).toBe(false);
  });
});

describe('eggs and events', () => {
  it('incubating eggs can absorb the passing storm', () => {
    let touched = 0;
    for (let seed = 0; seed < 60; seed++) {
      const s = fresh(seed);
      const [a, b] = s.creatures;
      const r = startCombine(s, a.id, b.id, T0 + 6.5 * MIN);
      if (!r.ok) continue;
      r.egg.incubationMs = 60 * MIN;
      const ev = tick(s, T0 + 8 * MIN);
      if (ev.some((e) => e.type === 'eggTouched')) touched++;
    }
    expect(touched).toBeGreaterThan(3);
    expect(touched).toBeLessThan(30);
  });

  it('rewarded ad hatch is optional, once per egg, and only near the end', () => {
    const s = fresh();
    const [a, b] = s.creatures;
    s.tutorial = 9;
    const r = startCombine(s, a.id, b.id, T0);
    if (!r.ok) throw new Error(r.error);
    r.egg.incubationMs = 40 * MIN;
    expect(canAdHatch(s, r.egg, T0)).toBe(false);
    r.egg.progressMs = 30 * MIN;
    expect(canAdHatch(s, r.egg, T0)).toBe(true);
    expect(adHatch(s, r.egg.id, T0).ok).toBe(true);
    expect(canAdHatch(s, r.egg, T0)).toBe(false);
  });

  it('tonic can make an egg giant', () => {
    let giants = 0;
    for (let seed = 0; seed < 100; seed++) {
      const s = fresh(seed);
      s.items.rootswell = 1;
      const [a, b] = s.creatures;
      const r = startCombine(s, a.id, b.id, T0);
      if (!r.ok) continue;
      useItem(s, 'rootswell', r.egg.id);
      if (r.egg.mutations.includes('giant')) giants++;
    }
    expect(giants).toBeGreaterThan(45);
  });
});

describe('economy', () => {
  it('gifts accumulate while away but are capped', () => {
    const s = fresh();
    tick(s, T0 + 6 * 60 * MIN, { maxStepMs: 10_000 });
    expect(s.gifts.length).toBe(TUNING.maxGiftsOnGround);
    const before = s.glimmer;
    const r = collectGift(s, s.gifts[0].id);
    expect(r.ok).toBe(true);
    expect(s.glimmer).toBeGreaterThan(before);
  });

  it('shop rotates and purchases deliver', () => {
    const s = fresh();
    const lure = s.shop.offers.find((o) => o.ref === 'moonpetal')!;
    expect(lure).toBeDefined();
    expect(buyOffer(s, lure.id, T0).ok).toBe(true);
    expect(s.lures.moonpetal).toBe(1);
    const rot = s.shop.rotation;
    tick(s, T0 + (TUNING.shopRefreshMin + 1) * MIN, { maxStepMs: 10_000 });
    expect(s.shop.rotation).toBeGreaterThan(rot);
  });

  it('offline catch-up caps at the configured horizon', () => {
    const s = fresh();
    tick(s, T0 + 72 * 60 * MIN, { maxStepMs: 10_000 });
    expect(s.lastTick).toBe(T0 + 72 * 60 * MIN);
  });
});

describe('save', () => {
  it('round-trips without loss', () => {
    const s = fresh();
    placeLure(s, 'glade', 'mossberry', T0);
    tick(s, T0 + 10 * MIN, { maxStepMs: 5000 });
    const back = deserialize(serialize(s, T0 + 10 * MIN));
    expect(back).toEqual(s);
  });

  it('rejects saves from the future', () => {
    const s = fresh();
    const raw = JSON.parse(serialize(s, T0));
    raw.version = 999;
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/newer version/);
  });

  it('creature traits accumulate through mutations', () => {
    const s = fresh();
    const frog = s.creatures[0];
    addMutation(frog, 'giant', T0, 'x');
    addMutation(frog, 'lunar', T0, 'x');
    addMutation(frog, 'storm', T0, 'x');
    expect(speciesTitle(frog)).toBe('Giant Lunar Storm Mossfrog');
    expect(creatureTraits(frog)).toEqual(expect.arrayContaining(['Amphibian', 'Grove', 'Tide', 'Giant', 'Lunar', 'Storm']));
  });
});
