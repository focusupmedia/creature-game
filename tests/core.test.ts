import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/state';
import { tick } from '../src/core/sim';
import {
  adHatch, buyIsland, buyOffer, canAdHatch, collectGift, hatch, moveCreature, placeLure, rollEggTier, startCombine,
  summonEvent, upgradeIsland, useItem,
} from '../src/core/actions';
import { currentScale, growth } from '../src/core/creatures';
import { SPECIES_BY_ID } from '../src/content/species';
import { islandCapacity } from '../src/core/sim';
import { compatibility, combine } from '../src/core/genetics';
import { StateRng } from '../src/core/rng';
import { activeEvent, eventInWindow, isDark, nextEvent } from '../src/core/world';
import { deserialize, serialize } from '../src/core/save';
import { addMutation, creatureTraits, makeCreature, speciesTitle } from '../src/core/creatures';
import { arrivalWeights } from '../src/core/lures';
import { TUNING } from '../src/content/tuning';
import { xpForLevel } from '../src/core/levels';
import { LURES, SPOTS } from '../src/content/world';
import type { Creature, GameState } from '../src/core/types';

const T0 = Date.UTC(2026, 0, 1, 12);
const MIN = 60_000;

function fresh(seed = 42): GameState {
  return createGame(T0, seed);
}

function spawn(state: GameState, species: string, mutations: Creature['mutations'] = []): Creature {
  const c: Creature = {
    id: `t${state.creatures.length}${species}`, species, mutations, bornAt: T0, seed: 1, history: [],
    island: 'home', size: 1, growMs: 0, personality: 'friendly', quirks: ['friendly', 'curious'], fullness: 1,
  };
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
    expect(nextEvent(s, T0)?.key).toBe('0');
  });

  it('is deterministic per seed and identical across devices', () => {
    const a = fresh(7);
    const b = fresh(7);
    for (let w = 0; w < 30; w++) expect(eventInWindow(a, w)).toEqual(eventInWindow(b, w));
  });

  it('schedules every kind of event naturally, with the new ones rare', () => {
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 20; seed++) {
      const s = fresh(seed);
      for (let w = 1; w < 60; w++) {
        const e = eventInWindow(s, w);
        if (e) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
      }
    }
    expect(Object.keys(counts).sort()).toEqual(['aurora', 'blizzard', 'blossom', 'bubbles', 'comet', 'eclipse', 'firefly', 'fog', 'fullmoon', 'gale', 'heatwave', 'meteor', 'rainbow', 'starry', 'storm']);
    expect(counts.comet).toBeLessThan(counts.heatwave);
    // storms are still the most common sky, but every other sky gets a real turn
    for (const k of Object.keys(counts)) if (k !== 'storm') expect(counts.storm).toBeGreaterThan(counts[k]);
    expect(counts.storm).toBeGreaterThan(counts.starry * 2);
    expect(counts.storm / Object.values(counts).reduce((a, b) => a + b, 0)).toBeLessThan(0.3);
    expect(counts.blizzard).toBeLessThan(counts.eclipse);
  });

  it('a new sky arrives 5-20 minutes after the last one ends', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = fresh(seed);
      let prev = eventInWindow(s, 0)!;
      for (let w = 1; w <= (24 * 60) / TUNING.eventWindowMin; w++) {
        const e = eventInWindow(s, w)!;
        expect(e).toBeTruthy();
        const gapMin = (e.start - prev.end) / 60_000;
        expect(gapMin).toBeGreaterThanOrEqual(5);
        expect(gapMin).toBeLessThanOrEqual(20);
        prev = e;
      }
    }
  });

  it('a meteor shower drops Starshard rocks you can pick up', () => {
    const s = fresh(3);
    const t0 = T0 + 60_000;
    s.summoned = { kind: 'meteor', start: t0, end: t0 + 3 * 60_000 };
    s.gifts = [];
    tick(s, t0 + 3 * 60_000, { maxStepMs: 1000 });
    const rocks = s.gifts.filter((g) => g.meteor);
    expect(rocks.length).toBeGreaterThan(0);
    expect(rocks.every((g) => g.shards >= 1)).toBe(true);
  });

  it('an ad can summon a random event right now, within the daily ad cap', () => {
    const s = fresh();
    const t = T0 + 30_000;
    const r = summonEvent(s, t);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(activeEvent(s, t + 1000)?.kind).toBe(r.kind);
    expect(summonEvent(s, t + 1000).ok).toBe(false);
    const events = tick(s, t + 6 * MIN, { maxStepMs: 5000 });
    expect(events.some((e) => e.type === 'eventStart' && e.kind === r.kind)).toBe(true);
    expect(events.some((e) => e.type === 'eventEnd' && e.kind === r.kind)).toBe(true);
    // Keep summoning whenever the sky is free; the daily ad cap is the only limit.
    let n = 1;
    for (let when = t + 10 * MIN; when < t + 6 * 60 * MIN; when += MIN) {
      if (activeEvent(s, when)) continue;
      if (summonEvent(s, when).ok) n++;
    }
    expect(n).toBe(TUNING.adsPerDay);
    expect(summonEvent(s, t + 7 * 60 * MIN).ok).toBe(false);
  });

  it('every event can touch and mutate residents', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80 && seen.size < 9; seed++) {
      const s = fresh(seed);
      for (let i = 0; i < 5; i++) {
        const t = T0 + (i * 60 + 30) * MIN;
        s.lastTick = t;
        if (!summonEvent(s, t).ok) continue;
        s.ads.count = 0;
        const ev = tick(s, t + 6 * MIN, { maxStepMs: 5000 });
        for (const e of ev) if (e.type === 'mutation') seen.add(e.cause);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(7);
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
    // (a meteor shower may drop a few Starshard rocks on top)
    expect(s.gifts.filter((g) => !g.meteor).length).toBe(TUNING.maxGiftsOnGround);
    const before = s.glimmer;
    const r = collectGift(s, s.gifts[0].id);
    expect(r.ok).toBe(true);
    expect(s.glimmer).toBeGreaterThan(before);
  });

  it('the egg shop sells coin eggs and a premium Starry Egg, all wild', () => {
    const s = fresh();
    const eggs = s.shop.offers.filter((o) => o.kind === 'egg');
    expect(eggs.map((o) => o.ref)).toContain('meadow');
    expect(eggs.find((o) => o.ref === 'starry')?.currency).toBe('shards');
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const sp = rollEggTier(s, 'starry');
      counts[SPECIES_BY_ID[sp].rarity] = (counts[SPECIES_BY_ID[sp].rarity] ?? 0) + 1;
      expect(SPECIES_BY_ID[sp].origin).toBe('wild');
    }
    expect(counts.common ?? 0).toBe(0);
    expect(counts.legendary).toBeGreaterThan(20);
    for (let i = 0; i < 300; i++) expect(SPECIES_BY_ID[rollEggTier(s, 'ember')].traits).toContain('Ember');
    const meadow = eggs.find((o) => o.ref === 'meadow')!;
    expect(buyOffer(s, meadow.id, T0).ok).toBe(true);
    expect(s.eggs.at(-1)?.tier).toBe('meadow');
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

describe('growth, personalities and first eggs', () => {
  it('hatchlings start small and grow into a random grown size', () => {
    const s = fresh();
    const [a, b] = s.creatures;
    const r = startCombine(s, a.id, b.id, T0);
    if (!r.ok) throw new Error(r.error);
    tick(s, T0 + r.egg.incubationMs + 1000);
    const h = hatch(s, r.egg.id, T0 + r.egg.incubationMs + 1000);
    if (!h.ok) throw new Error(h.error);
    const c = h.creature;
    const born = c.bornAt;
    expect(growth(c, born)).toBe(0);
    expect(currentScale(c, born)).toBeCloseTo(c.size * TUNING.hatchlingScale, 5);
    expect(growth(c, born + TUNING.growMin * MIN)).toBe(1);
    expect(currentScale(c, born + TUNING.growMin * MIN)).toBeCloseTo(c.size, 5);
    const sizes = new Set(Array.from({ length: 40 }, (_, i) => createGame(T0, i + 1).creatures[0].size.toFixed(3)));
    expect(sizes.size).toBeGreaterThan(30);
  });

  it('the first eggs always hold a creature the keeper has never seen', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = fresh(seed);
      s.tutorial = 9;
      const [frog, wing, bun] = s.creatures;
      for (const [x, y] of [[frog, wing], [wing, bun], [frog, bun]]) {
        const known = new Set(Object.keys(s.journal.species));
        const r = startCombine(s, x.id, y.id, T0);
        if (!r.ok) throw new Error(r.error);
        expect(known.has(r.egg.species)).toBe(false);
        r.egg.progressMs = r.egg.incubationMs;
        expect(hatch(s, r.egg.id, T0).ok).toBe(true);
      }
    }
  });

  it('every creature has a personality, and energetic ones dig more than lazy ones', () => {
    const s = fresh();
    expect(s.creatures.every((c) => !!c.personality)).toBe(true);
    s.creatures.forEach((c, i) => {
      c.personality = i === 0 ? 'energetic' : 'lazy';
      c.quirks = [c.personality, 'musical'];
    });
    const by: Record<string, number> = {};
    for (let i = 0; i < 40; i++) {
      s.gifts = [];
      const ev = tick(s, s.lastTick + 30 * MIN, { maxStepMs: 10_000 });
      for (const e of ev) if (e.type === 'gift') by[e.gift.from!] = (by[e.gift.from!] ?? 0) + 1;
    }
    const energetic = by[s.creatures[0].id] ?? 0;
    const lazy = (by[s.creatures[1].id] ?? 0);
    expect(energetic).toBeGreaterThan(lazy * 2);
  });

  it('digging can turn up items and eggs', () => {
    const s = fresh();
    s.gifts = [{ id: 'g1', x: 0, z: 0, glimmer: 3, shards: 0, island: 'home', item: 'warmstone' },
      { id: 'g2', x: 0, z: 0, glimmer: 3, shards: 0, island: 'home', item: 'egg' }];
    expect(collectGift(s, 'g1', T0).ok).toBe(true);
    expect(s.items.warmstone).toBe(1);
    const before = s.eggs.length;
    expect(collectGift(s, 'g2', T0).ok).toBe(true);
    expect(s.eggs.length).toBe(before + 1);
    expect(s.eggs.at(-1)?.source).toBe('dug');
  });
});

describe('islands', () => {
  it('needs the keeper level first, then coins; and can be upgraded in size', () => {
    const s = fresh();
    s.glimmer = 50_000;
    expect(buyIsland(s, 'volcano').ok).toBe(false); // level 1
    s.xp = xpForLevel(4);
    expect(buyIsland(s, 'volcano').ok).toBe(true);
    expect(s.islands.volcano.owned).toBe(true);
    expect(buyIsland(s, 'lagoon').ok).toBe(false); // needs level 8
    s.xp = xpForLevel(20);
    expect(buyIsland(s, 'lagoon').ok).toBe(true);
    expect(buyIsland(s, 'beach').ok).toBe(true);
    // a starter pair to breed from, living on the new island
    const starters = s.creatures.filter((c) => c.island === 'beach').map((c) => c.species).sort();
    expect(starters).toEqual(['flamingle', 'pouchbill']);
    s.glimmer = 5000;
    const cap = islandCapacity(s, 'home');
    expect(upgradeIsland(s, 'home', 'glimmer').ok).toBe(true);
    expect(islandCapacity(s, 'home')).toBeGreaterThan(cap);
  });

  it('island lures bring island creatures, who live on that island', () => {
    const s = fresh(9);
    s.glimmer = 5000;
    s.xp = xpForLevel(20);
    buyIsland(s, 'volcano');
    s.lures.emberpepper = 2;
    expect(placeLure(s, 'vent', 'emberpepper', T0).ok).toBe(true);
    s.stats.arrivals = 5;
    const ev = tick(s, T0 + 12 * MIN, { maxStepMs: 2000 });
    const arrivals = ev.filter((e) => e.type === 'arrival');
    expect(arrivals.length).toBeGreaterThan(0);
    for (const a of arrivals) {
      if (a.type !== 'arrival') continue;
      expect(SPECIES_BY_ID[a.creature.species].traits).toContain('Ember');
      expect(a.creature.island).toBe('volcano');
    }
  });

  it('lures cannot be placed on islands you do not own; creatures can move between owned islands', () => {
    const s = fresh();
    s.lures.saltkelp = 1;
    expect(placeLure(s, 'reef', 'saltkelp', T0).ok).toBe(false);
    s.glimmer = 99_999;
    s.xp = xpForLevel(20);
    buyIsland(s, 'lagoon');
    expect(placeLure(s, 'reef', 'saltkelp', T0).ok).toBe(true);
    expect(moveCreature(s, s.creatures[0].id, 'lagoon', T0).ok).toBe(true);
    expect(s.creatures[0].island).toBe('lagoon');
    expect(moveCreature(s, s.creatures[0].id, 'volcano', T0).ok).toBe(false);
  });
});

describe('save', () => {
  it('migrates version 1 saves (islands, sizes, personalities)', () => {
    const v1 = JSON.parse(serialize(fresh(), T0));
    v1.version = 1;
    delete v1.islands;
    for (const c of v1.creatures) { delete c.island; delete c.size; delete c.growMs; delete c.personality; }
    for (const k of ['vent', 'ash', 'reef', 'shallows']) delete v1.spots[k];
    const s = deserialize(JSON.stringify(v1));
    expect(s.version).toBe(14);
    expect(s.digSpots).toEqual([]);
    expect(s.islands.cloud).toEqual({ owned: false, size: 0 });
    expect(s.islands.home.owned).toBe(true);
    expect(s.creatures.every((c) => c.island === 'home' && c.size > 0.9 && c.growMs === 0 && !!c.personality)).toBe(true);
    expect(s.spots.vent).toBeNull();
    tick(s, T0 + 5 * MIN);
  });

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
    frog.shade = 'classic';
    addMutation(frog, 'giant', T0, 'x');
    addMutation(frog, 'lunar', T0, 'x');
    addMutation(frog, 'storm', T0, 'x');
    expect(speciesTitle(frog)).toBe('Giant Lunar Storm Mossfrog');
    expect(creatureTraits(frog)).toEqual(expect.arrayContaining(['Amphibian', 'Grove', 'Tide', 'Giant', 'Lunar', 'Storm']));
  });
});

describe('mutation glow', () => {
  it('rarer mutations glow more, and stacking three adds a level', async () => {
    const { glowLevel } = await import('../src/core/creatures');
    expect(glowLevel({ species: 'mossfrog', mutations: [] })).toBe(0);
    expect(glowLevel({ species: 'mossfrog', mutations: ['storm'] })).toBe(0);
    expect(glowLevel({ species: 'mossfrog', mutations: ['frost'] })).toBe(1);
    expect(glowLevel({ species: 'mossfrog', mutations: ['prismatic'] })).toBe(2);
    expect(glowLevel({ species: 'mossfrog', mutations: ['lunar', 'storm', 'frost'] })).toBe(2);
    expect(glowLevel({ species: 'mossfrog', mutations: ['lunar', 'storm', 'prismatic'] })).toBe(3);
  });
});

describe('dig spots', () => {
  it('appear on owned islands over time, expire, and turn into a find when worked', async () => {
    const { workDigSpot } = await import('../src/core/actions');
    const s = createGame(42, 0);
    for (let m = 10; m <= 240 && !s.digSpots.length; m += 10) tick(s, m * 60_000, { maxStepMs: 1000 });
    expect(s.digSpots.length).toBeGreaterThan(0);
    expect(s.digSpots.every((d) => d.island === 'home' && d.expiresAt > s.lastTick)).toBe(true);
    const spot = s.digSpots[0];
    const walker = s.creatures.find((c) => c.island === 'home')!;
    const r = workDigSpot(s, spot.id, walker.id);
    if (!r.ok) throw new Error(r.error);
    expect(r.gift.via).toBe(spot.kind);
    expect(s.digSpots.some((d) => d.id === spot.id)).toBe(false);
    expect(s.gifts).toContain(r.gift);
    expect(workDigSpot(s, spot.id, walker.id).ok).toBe(false);
  });
});

describe('inheritance', () => {
  it('most babies hatch plain; only a few carry one parent mutation', () => {
    const s = createGame(9, 0);
    const mk = (sp: string, m: string[]) => ({ ...s.creatures[0], id: sp + Math.random(), species: sp, mutations: m as never[] });
    const a = mk('mossfrog', ['lunar', 'storm']);
    const b = mk('mossfrog', ['frost']);
    let carried = 0;
    let many = 0;
    for (let i = 0; i < 2000; i++) {
      s.rng = i * 7919;
      const out = combine(a, b, new StateRng(s), null).mutations.filter((m) => m !== 'giant' && m !== 'prismatic');
      if (out.length) carried++;
      if (out.length > 1) many++;
    }
    expect(carried / 2000).toBeGreaterThan(0.07);
    expect(carried / 2000).toBeLessThan(0.18);
    expect(many).toBe(0);
  });
});

describe('mythicals', () => {
  it('Cloud Serpent only comes from two dragons in a thunderstorm', async () => {
    const { combine } = await import('../src/core/genetics');
    const s = createGame(5, 0);
    const mk = (sp: string) => ({ ...s.creatures[0], id: sp + Math.random(), species: sp, mutations: [] as never[] });
    const a = mk('emberdrake');
    const b = mk('emberdrake');
    const count = (sky: 'storm' | null) => {
      let n = 0;
      for (let i = 0; i < 400; i++) {
        s.rng = i * 7919;
        if (combine(a, b, new StateRng(s), sky).species === 'cloudserpent') n++;
      }
      return n;
    };
    expect(count(null)).toBe(0);
    expect(count('storm')).toBeGreaterThan(60);
    // one dragon is not enough
    const c = mk('cinderskink');
    s.rng = 1;
    let any = false;
    for (let i = 0; i < 300; i++) { s.rng = i * 31; if (combine(a, c, new StateRng(s), 'storm').species === 'cloudserpent') any = true; }
    expect(any).toBe(false);
  });

  it('the Kraken only answers the Coral Reef under a full moon', () => {
    const at = (spot: string, sky: 'fullmoon' | null) => arrivalWeights('saltkelp', spot, true, sky).some(([sp]) => sp.id === 'kraken');
    expect(at('reef', 'fullmoon')).toBe(true);
    expect(at('reef', null)).toBe(false);
    expect(at('shallows', 'fullmoon')).toBe(false);
  });
});

describe('legendary events', () => {
  it('leave a legendary mutation and a one-time gift you can claim', async () => {
    const { startLegendary, claimBlessing } = await import('../src/core/legendary');
    const s = createGame(11, 0);
    tick(s, 60_000, { maxStepMs: 1000 });
    const ev = startLegendary(s, 'angel', s.lastTick)[0];
    if (ev.type !== 'legendary') throw new Error('expected a legendary event');
    expect(ev.creature?.mutations).toContain('angelic');
    expect(s.blessing?.kind).toBe('angel');
    const target = s.creatures.find((c) => !c.mutations.includes('frost'))!;
    expect(claimBlessing(s, target.id, 'angelic', s.lastTick).ok).toBe(false);
    const r = claimBlessing(s, target.id, 'frost', s.lastTick);
    expect(r.ok).toBe(true);
    expect(target.mutations).toContain('frost');
    expect(s.blessing).toBeNull();
    expect(claimBlessing(s, target.id, 'starlit', s.lastTick).ok).toBe(false);
  });

  it('the Eruption only happens once you own Ember Peak', () => {
    const s = createGame(12, 0);
    for (let h = 1; h <= 200; h++) {
      tick(s, h * 3_600_000, { maxStepMs: 60_000 });
      if (s.legendary) expect(s.legendary.kind).toBe('angel');
    }
  });
});

describe('behaviour traits', () => {
  it('every creature has 2-5 traits, one personality, and no clashing pairs', async () => {
    const { QUIRKS } = await import('../src/content/quirks');
    const s = fresh(3);
    for (let i = 0; i < 300; i++) {
      const c = makeCreatureForTest(s);
      expect(c.quirks.length).toBeGreaterThanOrEqual(2);
      expect(c.quirks.length).toBeLessThanOrEqual(5);
      expect(new Set(c.quirks).size).toBe(c.quirks.length);
      expect(c.quirks.filter((q) => QUIRKS[q].temper).length).toBe(1);
      for (const q of c.quirks) for (const o of c.quirks) expect(QUIRKS[q].clashes?.includes(o) ?? false).toBe(false);
    }
  });

  it('the Deleter removes a chosen trait but never below 2, and the Wiper rolls a fresh set', async () => {
    const { deleteQuirk, wipeQuirks } = await import('../src/core/quirks');
    const s = fresh(4);
    const c = s.creatures[0];
    c.quirks = ['friendly', 'lucky', 'digger'];
    expect(deleteQuirk(s, c.id, 'lucky').ok).toBe(false); // no tool yet
    s.tools.traitDeleter = 5;
    expect(deleteQuirk(s, c.id, 'lucky').ok).toBe(true);
    expect(c.quirks).toEqual(['friendly', 'digger']);
    expect(deleteQuirk(s, c.id, 'digger').ok).toBe(false);
    expect(s.tools.traitDeleter).toBe(4);
    s.tools.traitWiper = 1;
    expect(wipeQuirks(s, c.id).ok).toBe(true);
    expect(c.quirks.length).toBeGreaterThanOrEqual(2);
    expect(s.tools.traitWiper).toBe(0);
  });
});

function makeCreatureForTest(s: GameState): Creature {
  return makeCreature(s, 'mossfrog', [], T0, 'test');
}

describe('rarity odds', () => {
  it('a legendary is never more than a small share of lure visitors, wherever and whenever', () => {
    for (const spot of Object.keys(SPOTS)) for (const lure of Object.keys(LURES)) for (const dark of [false, true]) {
      for (const sky of [null, 'storm', 'eclipse', 'starry', 'fullmoon', 'blizzard'] as const) {
        const w = arrivalWeights(lure, spot, dark, sky);
        for (const [sp, x] of w) if (sp.rarity === 'legendary') expect(x).toBeLessThan(0.03);
        expect(w.reduce((a, [, x]) => a + x, 0)).toBeLessThanOrEqual(1.0001 + 0.05);
      }
    }
  });
});
