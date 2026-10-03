import { describe, expect, it } from 'vitest';
import { LEVEL_CREATURES, MAX_LEVEL, addXp, levelOf, levelReward, xpForLevel } from '../src/core/levels';
import { createGame } from '../src/core/state';

describe('keeper levels', () => {
  it('has a gentle start and a long but reachable top', () => {
    expect(xpForLevel(5)).toBeLessThan(200);
    expect(xpForLevel(20)).toBeGreaterThan(3000);
    expect(xpForLevel(20)).toBeLessThan(7000);
    expect(xpForLevel(50)).toBeGreaterThan(40_000);
    expect(xpForLevel(50)).toBeLessThan(80_000);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(1e9)).toBe(MAX_LEVEL);
  });

  it('rewards grow with level, with a level-only creature every 5', () => {
    const small = Array.from({ length: 49 }, (_, i) => i + 2).filter((l) => l % 5);
    for (let i = 1; i < small.length; i++) expect(levelReward(small[i]).coins).toBeGreaterThan(levelReward(small[i - 1]).coins);
    for (let l = 10; l <= 50; l += 5) {
      expect(levelReward(l).coins).toBeGreaterThan(levelReward(l - 5).coins);
      expect(levelReward(l).coins).toBeGreaterThan(levelReward(l - 1).coins);
    }
    expect(Object.keys(LEVEL_CREATURES).map(Number)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  });

  it('applies rewards when you level up, including the level creature', () => {
    const s = createGame(1, 0);
    const coins = s.glimmer;
    const ups = addXp(s, xpForLevel(5), 0);
    expect(ups.map((u) => u.level)).toEqual([2, 3, 4, 5]);
    // level rewards, plus the discovery bonus for meeting a new species
    expect(s.glimmer).toBeGreaterThanOrEqual(coins + ups.reduce((a, u) => a + u.coins, 0));
    expect(s.creatures.some((c) => c.species === 'jackalope')).toBe(true);
  });
});
