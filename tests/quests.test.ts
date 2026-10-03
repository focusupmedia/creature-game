import { describe, expect, it } from 'vitest';
import { claimDaily, claimLasting, claimable, questEvent, refreshDailies, DAILY_POOL } from '../src/core/quests';
import { createGame } from '../src/core/state';

const DAY = 86_400_000;

describe('quests', () => {
  it('hands out 3 new dailies each day', () => {
    const s = createGame(1, 0);
    refreshDailies(s, 0);
    expect(s.quests.daily.length).toBe(3);
    expect(new Set(s.quests.daily.map((q) => q.id)).size).toBe(3);
    const first = s.quests.day;
    refreshDailies(s, 1000);
    expect(s.quests.day).toBe(first);
    refreshDailies(s, DAY + 1000);
    expect(s.quests.day).not.toBe(first);
  });

  it('counts what you do and pays out once', () => {
    const s = createGame(2, 0);
    s.quests = { day: '1970-01-01', daily: [{ id: 'd-hatch', progress: 0, claimed: false }], tiers: {} };
    expect(claimDaily(s, 'd-hatch').ok).toBe(false);
    for (let i = 0; i < 5; i++) questEvent(s, { kind: 'hatch', species: 'mossfrog', newSpecies: false, newMutations: 0 });
    expect(claimable(s)).toBeGreaterThan(0);
    const coins = s.glimmer;
    expect(claimDaily(s, 'd-hatch').ok).toBe(true);
    expect(s.glimmer).toBe(coins + DAILY_POOL.find((d) => d.id === 'd-hatch')!.reward.coins);
    expect(claimDaily(s, 'd-hatch').ok).toBe(false);
  });

  it('lasting quests go tier by tier', () => {
    const s = createGame(3, 0);
    for (let i = 0; i < 5; i++) questEvent(s, { kind: 'hatch', species: 'mossfrog', newSpecies: false, newMutations: 0 });
    expect(claimLasting(s, 'hatcher').ok).toBe(true);
    expect(s.quests.tiers.hatcher).toBe(1);
    expect(claimLasting(s, 'hatcher').ok).toBe(false);
    questEvent(s, { kind: 'gift', glimmer: 30, shards: 0, byCreature: true });
    expect(s.questStats.creatureCoins).toBe(30);
    expect(s.questStats.coinsPicked ?? 0).toBe(0);
  });
});
