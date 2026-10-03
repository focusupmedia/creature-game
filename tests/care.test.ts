import { describe, expect, it } from 'vitest';
import { buyStorageSlot, feedCreature, harvestTree, isHungry, retrieveCreature, sellCreature, sellPrice, storeCreature } from '../src/core/care';
import { startCombine } from '../src/core/actions';
import { tick } from '../src/core/sim';
import { createGame } from '../src/core/state';

const HOUR = 3_600_000;

describe('care', () => {
  it('creatures get hungry slowly, hungry ones can\'t breed, and food fixes it', () => {
    const s = createGame(1, 0);
    tick(s, 5 * HOUR, { maxStepMs: 60_000 });
    expect(s.creatures.some(isHungry)).toBe(false);
    tick(s, 9 * HOUR, { maxStepMs: 60_000 });
    expect(s.creatures.every(isHungry)).toBe(true);
    const [a, b] = s.creatures;
    const r = startCombine(s, a.id, b.id, s.lastTick);
    expect(r.ok).toBe(false);
    s.food.snack = 2;
    expect(feedCreature(s, a.id).ok).toBe(true);
    expect(isHungry(a)).toBe(false);
  });

  it('feedbags feed hungry creatures while you are away', () => {
    const s = createGame(2, 0);
    s.feedbags.home = 20;
    tick(s, 12 * HOUR, { maxStepMs: 60_000 });
    expect(s.creatures.some(isHungry)).toBe(false);
    expect(s.feedbags.home).toBeLessThan(20);
  });

  it('berry trees grow berries you can pick', () => {
    const s = createGame(3, 0);
    s.placedDecor.push({ id: 'ft', decor: 'fruittree', x: 0, z: 2, rot: 0, harvestedAt: 0 });
    expect(harvestTree(s, 'ft', 30 * 60_000).ok).toBe(false);
    expect(harvestTree(s, 'ft', 10 * HOUR).ok).toBe(true);
    expect(s.food.fruit).toBe(3);
  });

  it('storage pauses creatures and has limited slots', () => {
    const s = createGame(4, 0);
    s.creatures.push({ ...s.creatures[0], id: 'x1' }, { ...s.creatures[0], id: 'x2' });
    const c = s.creatures[0];
    c.fullness = 0.5;
    expect(storeCreature(s, c.id, 0).ok).toBe(true);
    tick(s, 20 * HOUR, { maxStepMs: 60_000 });
    expect(c.fullness).toBe(0.5);
    expect(retrieveCreature(s, c.id, 'home', s.lastTick, 20).ok).toBe(true);
    s.glimmer = 0;
    expect(buyStorageSlot(s).ok).toBe(false);
    s.glimmer = 1000;
    expect(buyStorageSlot(s).ok).toBe(true);
    expect(s.storageSlots).toBe(5);
  });

  it('favourites can\'t be sold, and the Collector pays more', () => {
    const s = createGame(5, 0);
    s.creatures.push({ ...s.creatures[0], id: 'y1' }, { ...s.creatures[0], id: 'y2' });
    const c = s.creatures[2];
    expect(sellPrice(s, c, true)).toBeGreaterThan(sellPrice(s, c, false));
    c.favorite = true;
    expect(sellCreature(s, c.id, 0).ok).toBe(false);
    c.favorite = false;
    const coins = s.glimmer;
    expect(sellCreature(s, c.id, 0).ok).toBe(true);
    expect(s.glimmer).toBeGreaterThan(coins);
  });
});

describe('lure visitors', () => {
  it('wait by the lure until you keep them or send them away', async () => {
    const { keepVisitor, sendAwayVisitor } = await import('../src/core/care');
    const { placeLure } = await import('../src/core/actions');
    const s = createGame(8, 0);
    const before = s.creatures.length;
    placeLure(s, 'glade', 'mossberry', 0);
    for (let m = 1; m <= 60 && s.visitors.length < 2; m++) tick(s, m * 60_000, { maxStepMs: 1000 });
    expect(s.visitors.length).toBeGreaterThanOrEqual(2);
    expect(s.creatures.length).toBe(before);
    const [a, b] = s.visitors;
    expect(keepVisitor(s, a.creature.id, 20).ok).toBe(true);
    expect(s.creatures.length).toBe(before + 1);
    const coins = s.glimmer;
    expect(sendAwayVisitor(s, b.creature.id).ok).toBe(true);
    expect(s.glimmer).toBeGreaterThan(coins);
    expect(keepVisitor(s, b.creature.id, 20).ok).toBe(false);
  });

  it('a full world asks you to make space first', async () => {
    const { keepVisitor } = await import('../src/core/care');
    const s = createGame(9, 0);
    s.visitors.push({ creature: { ...s.creatures[0], id: 'vv' }, spot: 'glade', island: 'home', until: 1e12 });
    const r = keepVisitor(s, 'vv', s.creatures.length);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('full');
  });
});

describe('egg sprays', () => {
  it('Speedy Spritz speeds an egg up, Grow Mist makes it hatch big, and each works once', async () => {
    const { useItem, hatch } = await import('../src/core/actions');
    const s = createGame(7, 1_000_000);
    const egg = { id: 'e1', species: 'mossfrog', mutations: [], seed: 5, source: 'shop' as const, laidAt: 0, incubationMs: 100_000, progressMs: 0, nest: 0, witnessed: [] };
    s.eggs.push(egg);
    s.items.speedy = 1;
    s.items.growmist = 2;
    s.items.shrinkmist = 1;
    expect(useItem(s, 'speedy', 'e1').ok).toBe(true);
    expect(egg.progressMs).toBeCloseTo(30_000);
    expect(useItem(s, 'growmist', 'e1').ok).toBe(true);
    expect(useItem(s, 'growmist', 'e1').ok).toBe(false);
    expect(useItem(s, 'shrinkmist', 'e1').ok).toBe(false);
    egg.progressMs = egg.incubationMs;
    const r = hatch(s, 'e1', 1_000_000);
    expect(r.ok && r.creature.size).toBeGreaterThan(1.1);
  });
});

describe('wanderers', () => {
  it('only come while you play; the Goblin steals or spoils a lure unless tapped, and tapping scares him off', async () => {
    const { meetWanderer } = await import('../src/core/wanderers');
    const { StateRng } = await import('../src/core/rng');
    const s = createGame(11, 0);
    s.glimmer = 500;
    // offline: nobody comes
    tick(s, 2 * HOUR, { maxStepMs: 10_000 });
    expect(s.wanderer).toBeNull();
    // live: someone turns up
    let t = 2 * HOUR;
    for (let i = 0; i < 3600 && !s.wanderer; i++) tick(s, (t += 1000), { live: true, here: 'home' });
    expect(s.wanderer).not.toBeNull();
    // a goblin left alone does mischief
    s.wanderer = { kind: 'goblin', island: 'home', x: 0, z: 0, arrivedAt: t, until: t + 1000 };
    const before = s.glimmer;
    const evs = tick(s, (t += 2000), { live: true, here: 'home' });
    const g = evs.find((e) => e.type === 'goblin');
    expect(g).toBeTruthy();
    expect(s.glimmer < before || (g as { did: string }).did === 'lure').toBe(true);
    // a goblin tapped in time runs off and drops coins
    s.wanderer = { kind: 'goblin', island: 'home', x: 0, z: 0, arrivedAt: t, until: t + 60_000 };
    const coins = s.glimmer;
    const r = meetWanderer(s, t, new StateRng(s));
    expect(r.ok).toBe(true);
    expect(s.glimmer).toBe(coins + 5);
    expect(s.wanderer).toBeNull();
  });

  it('the Gardener Gnome gives a Berry Tree and the Treasure Hunter marks dig spots', async () => {
    const { meetWanderer } = await import('../src/core/wanderers');
    const { StateRng } = await import('../src/core/rng');
    const s = createGame(12, 0);
    s.wanderer = { kind: 'gnome', island: 'home', x: 0, z: 0, arrivedAt: 0, until: 60_000 };
    meetWanderer(s, 1000, new StateRng(s));
    expect(s.decorOwned.fruittree).toBe(1);
    const spots = s.digSpots.length;
    s.wanderer = { kind: 'treasure', island: 'home', x: 0, z: 0, arrivedAt: 0, until: 60_000 };
    meetWanderer(s, 1000, new StateRng(s));
    expect(s.digSpots.length).toBe(spots + 2);
  });
});

describe('island growth', () => {
  it('growing an island opens new lure spots (but not more nests)', async () => {
    const { placeLure, upgradeIsland } = await import('../src/core/actions');
    const s = createGame(5, 0);
    s.glimmer = 100_000;
    s.lures.mossberry = 5;
    const nests = s.nests;
    expect(placeLure(s, 'hollow', 'mossberry', 0).ok).toBe(false);
    expect(upgradeIsland(s, 'home', 'glimmer').ok).toBe(true);
    expect(placeLure(s, 'hollow', 'mossberry', 0).ok).toBe(true);
    expect(placeLure(s, 'meadow', 'mossberry', 0).ok).toBe(false);
    expect(upgradeIsland(s, 'home', 'glimmer').ok).toBe(true);
    expect(placeLure(s, 'meadow', 'mossberry', 0).ok).toBe(true);
    expect(s.nests).toBe(nests);
  });
});

describe('decor and trees', () => {
  it('decorations go on the world you are on, and chopping a tree pays a little and is remembered', async () => {
    const { chopTree, placeDecor } = await import('../src/core/actions');
    const s = createGame(9, 0);
    s.decorOwned.lantern = 1;
    expect(placeDecor(s, 'lantern', 1, 1, 0, 'volcano').ok).toBe(false);
    s.islands.volcano = { owned: true, size: 0 };
    expect(placeDecor(s, 'lantern', 1, 1, 0, 'volcano').ok).toBe(true);
    expect(s.placedDecor[0].island).toBe('volcano');
    const coins = s.glimmer;
    expect(chopTree(s, 'home', 3).ok).toBe(true);
    expect(chopTree(s, 'home', 3).ok).toBe(false);
    expect(s.glimmer).toBeGreaterThan(coins);
    expect(s.chopped?.home).toEqual([3]);
  });
});

describe('saving', () => {
  it('keeps saving after many ad-summoned sky events', async () => {
    const { summonEvent } = await import('../src/core/actions');
    const { serialize, deserialize } = await import('../src/core/save');
    const s = createGame(21, 0);
    let t = 60_000;
    for (let i = 0; i < 8; i++) {
      // wait for a clear sky, then summon
      while (!summonEvent(s, t).ok) t += 60_000;
      t += 10 * 60_000;
      tick(s, t, { maxStepMs: 5000 });
      expect(() => deserialize(serialize(s, t))).not.toThrow();
    }
    expect(Object.keys(s.eventsApplied).filter((k) => k.startsWith('s')).length).toBeLessThanOrEqual(5);
  });
});

describe('scan fixes', () => {
  it('a level gift goes to a world with room, or storage when every world is full', async () => {
    const { addXp, xpForLevel } = await import('../src/core/levels');
    const s = createGame(31, 0);
    const c0 = s.creatures[0];
    while (s.creatures.filter((c) => c.island === 'home' && !c.stored).length < 10) s.creatures.push({ ...c0, id: `x${s.creatures.length}` });
    const ups = addXp(s, xpForLevel(5), 1000);
    const gift = s.creatures.find((c) => c.id === ups.find((u) => u.creatureId)?.creatureId);
    expect(gift?.stored).toBe(true);
    expect(s.creatures.filter((c) => c.island === 'home' && !c.stored).length).toBe(10);
  });

  it('finds left lying on one world do not stop digging on another', () => {
    const s = createGame(32, 0);
    s.islands.volcano = { owned: true, size: 0 };
    for (let i = 0; i < 14; i++) s.gifts.push({ id: `v${i}`, x: -48, z: -34, glimmer: 1, shards: 0, island: 'volcano' });
    tick(s, 3 * HOUR, { maxStepMs: 10_000 });
    expect(s.gifts.some((g) => g.island === 'home')).toBe(true);
  });
});

describe('color shades', () => {
  it('most pets are common shades, Pastel is rare, Shiny very rare, and babies take after parents', async () => {
    const { rollShade, SHADES } = await import('../src/content/shades');
    const { StateRng } = await import('../src/core/rng');
    const rng = new StateRng({ rng: 7 } as never);
    const n: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) { const s = rollShade(rng); n[s] = (n[s] ?? 0) + 1; }
    expect((n.shiny ?? 0) / 20000).toBeLessThan(0.02);
    expect((n.pastel ?? 0) / 20000).toBeLessThan(0.1);
    expect(Object.keys(n).every((k) => k in SHADES)).toBe(true);
    let same = 0;
    for (let i = 0; i < 2000; i++) if (rollShade(rng, ['rosy', 'rosy']) === 'rosy') same++;
    expect(same / 2000).toBeGreaterThan(0.45);
  });
});
