import { describe, expect, it } from 'vitest';
import { LEVEL_CREATURES, MAX_LEVEL, addXp, levelOf, levelReward, starRank, xpForLevel } from '../src/core/levels';
import { SPECIES_BY_ID } from '../src/content/species';
import { createGame } from '../src/core/state';

describe('keeper levels', () => {
  it('has a gentle start and a long but reachable top', () => {
    expect(xpForLevel(5)).toBeLessThan(700);
    expect(xpForLevel(20)).toBeGreaterThan(6000);
    expect(xpForLevel(20)).toBeLessThan(11_000);
    expect(xpForLevel(50)).toBeGreaterThan(40_000);
    expect(xpForLevel(50)).toBeLessThan(60_000);
    // the Star Keeper levels take a few devoted months more
    expect(xpForLevel(100)).toBeGreaterThan(150_000);
    expect(xpForLevel(100)).toBeLessThan(220_000);
    expect(MAX_LEVEL).toBe(100);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(1e9)).toBe(MAX_LEVEL);
  });

  it('rewards grow with level, with a level-only creature every 5 to 50 and every 10 after', () => {
    const small = Array.from({ length: 99 }, (_, i) => i + 2).filter((l) => l % 5);
    for (let i = 1; i < small.length; i++) expect(levelReward(small[i]).coins).toBeGreaterThan(levelReward(small[i - 1]).coins);
    for (let l = 10; l <= 100; l += 5) {
      expect(levelReward(l).coins).toBeGreaterThan(levelReward(l - 5).coins);
      expect(levelReward(l).coins).toBeGreaterThan(levelReward(l - 1).coins);
    }
    expect(Object.keys(LEVEL_CREATURES).map(Number)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100]);
    for (const sp of Object.values(LEVEL_CREATURES)) expect(SPECIES_BY_ID[sp].origin).toBe('reward');
  });

  it('Star Keeper badge ranks', () => {
    expect([1, 50, 51, 74, 75, 99, 100].map(starRank)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('reaching 100 hands over every level creature', () => {
    const s = createGame(1, 0);
    addXp(s, xpForLevel(100), 0);
    expect(levelOf(s.xp)).toBe(100);
    for (const sp of Object.values(LEVEL_CREATURES)) expect(s.creatures.some((c) => c.species === sp)).toBe(true);
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
