import { describe, expect, it } from 'vitest';
import { CHEST_MIN_MS, fillAwayChest, openAwayChest, welcomeBackGift } from '../src/core/away';
import { planNotifications, MAX_REMINDERS } from '../src/core/notify';
import { createGame } from '../src/core/state';

const T = Date.UTC(2026, 9, 3, 12);
const HOUR = 3_600_000;

describe('coming back', () => {
  it('the away chest fills with time away (capped at 12 hours) and an ad doubles it', () => {
    const s = createGame(1, T);
    expect(fillAwayChest(s, CHEST_MIN_MS - 1)).toBeNull();
    const short = fillAwayChest(s, 2 * HOUR)!.coins;
    s.awayChest = null;
    const long = fillAwayChest(s, 12 * HOUR)!.coins;
    s.awayChest = null;
    expect(long).toBeGreaterThan(short * 3);
    expect(fillAwayChest(s, 48 * HOUR)!.coins).toBe(long);
    const coins = s.glimmer;
    const c = openAwayChest(s, true)!;
    expect(s.glimmer - coins).toBe(c.coins);
    expect(c.coins).toBe(long * 2);
    expect(s.awayChest).toBeNull();
  });

  it('a day or more away brings a welcome-back gift with a charm; three days brings more', () => {
    const s = createGame(2, T);
    expect(welcomeBackGift(s, 20 * HOUR, T)).toBeNull();
    const one = welcomeBackGift(s, 26 * HOUR, T)!;
    expect(s.charms?.wildcharm).toBe(1);
    const three = welcomeBackGift(s, 80 * HOUR, T)!;
    expect(three.coins).toBeGreaterThan(one.coins);
    expect(three.egg).toBe(true);
  });

  it('reminders stay few, and a rare sky or the daily gift comes first', () => {
    const s = createGame(3, T);
    const notes = planNotifications(s, T);
    expect(notes.length).toBeLessThanOrEqual(MAX_REMINDERS);
    expect(notes.some((n) => n.id === 'daily' || n.id === 'sky')).toBe(true);
  });
});

describe('review fixes', () => {
  it('pays level rewards owed past the old cap, once', async () => {
    const { payOwedLevels, xpForLevel } = await import('../src/core/levels');
    const s = createGame(4, T);
    delete s.levelPaid;
    s.xp = xpForLevel(54);
    const coins = s.glimmer;
    const ups = payOwedLevels(s, T);
    expect(ups.map((u) => u.level)).toEqual([51, 52, 53, 54]);
    expect(s.glimmer).toBeGreaterThan(coins);
    expect(payOwedLevels(s, T)).toEqual([]);
  });

  it('the Market board stays the same all day even after new discoveries', async () => {
    const { marketWants } = await import('../src/core/market');
    const { recordSpecies } = await import('../src/core/journal');
    const s = createGame(1234, T);
    const before = JSON.stringify(marketWants(s, T));
    for (const sp of ['dunefox', 'cloudlamb', 'kitewing', 'magmole', 'ashowl']) recordSpecies(s, sp, T);
    expect(JSON.stringify(marketWants(s, T + 3600_000))).toBe(before);
  });

  it('an event ad after midnight does not refill the free-coin batch', async () => {
    const { claimCoinAd, coinAdsLeft, consumeAd } = await import('../src/core/actions');
    const s = createGame(5, T);
    const late = Date.UTC(2026, 9, 3, 23, 50);
    for (let i = 0; i < 8; i++) claimCoinAd(s, late + i * 1000);
    consumeAd(s, Date.UTC(2026, 9, 4, 0, 1));
    expect(coinAdsLeft(s, Date.UTC(2026, 9, 4, 0, 2))).toBe(0);
  });
});
