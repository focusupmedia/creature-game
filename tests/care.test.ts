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
