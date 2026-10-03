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
