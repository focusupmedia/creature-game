import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/content/tuning';
import { SKY_ITEMS } from '../src/content/world';
import { buyOffer, canSeeForecast, claimCoinAd, coinAdsLeft, upcomingEvents, useCharm } from '../src/core/actions';
import { sellPrice } from '../src/core/care';
import { fillWant, marketPrice, marketWants, wantMatches } from '../src/core/market';
import { createGame } from '../src/core/state';
import { activeEvent } from '../src/core/world';

const T = Date.UTC(2026, 9, 3, 12);
const MIN = 60_000;

describe('selling and the Market board', () => {
  it('bigger pets and more mutations sell for much more', () => {
    const s = createGame(3, T);
    const c = { ...s.creatures[0], size: 1, mutations: [], shade: 'classic' };
    const plain = sellPrice(s, c, false);
    expect(sellPrice(s, { ...c, size: 2.4 }, false)).toBeGreaterThan(plain * 3);
    expect(sellPrice(s, { ...c, mutations: ['lunar', 'aurora'] }, false)).toBeGreaterThan(plain * 2.5);
    expect(sellPrice(s, { ...c, shade: 'shiny' }, false)).toBe(Math.round(plain * 3 / 5) * 5);
  });

  it('offers three wants a day, the same all day, and pays over the usual price once each', () => {
    const s = createGame(4, T);
    const w = marketWants(s, T);
    expect(w).toHaveLength(3);
    expect(marketWants(s, T + 3 * 3_600_000).map((x) => x.id)).toEqual(w.map((x) => x.id));
    expect(marketWants(s, T + 30 * 3_600_000)[0].id).not.toBe(w[0].id);
    // the first want is always a species you've met, so it can be filled
    const want = w[0];
    for (let i = 0; i < 3; i++) s.creatures.push({ ...s.creatures[0], id: `m${i}`, species: want.target, favorite: false });
    const c = s.creatures.find((x) => wantMatches(want, x))!;
    const price = marketPrice(s, want, c);
    expect(price).toBeGreaterThan(sellPrice(s, c, false) * 2);
    const coins = s.glimmer;
    expect(fillWant(s, want.id, c.id, T).ok).toBe(true);
    expect(s.glimmer - coins).toBe(price);
    const again = s.creatures.find((x) => wantMatches(want, x))!;
    expect(fillWant(s, want.id, again.id, T).ok).toBe(false);
  });
});

describe('free coin ads', () => {
  it('come in a batch that refills a while after your most recent watch', () => {
    const s = createGame(5, T);
    const n = TUNING.coinAdsPerBatch;
    for (let i = 0; i < n; i++) expect(claimCoinAd(s, T + i * 5 * MIN).ok).toBe(true);
    const last = T + (n - 1) * 5 * MIN;
    expect(coinAdsLeft(s, last + MIN)).toBe(0);
    expect(claimCoinAd(s, last + MIN).ok).toBe(false);
    // the clock runs from the latest watch
    expect(coinAdsLeft(s, last + (TUNING.coinAdRefillMin - 1) * MIN)).toBe(0);
    expect(coinAdsLeft(s, last + TUNING.coinAdRefillMin * MIN)).toBe(n);
  });
});

describe('sky items', () => {
  it('charms start their event now; the Star Chart and Telescope show what is coming', () => {
    const s = createGame(6, T);
    s.shards = 2000;
    const t = T + 60 * MIN;
    expect(useCharm(s, 'charm-aurora', t).ok).toBe(false);
    s.charms = { 'charm-aurora': 1 };
    if (activeEvent(s, t)) s.summoned = null;
    const free = [t, t + 7 * MIN, t + 13 * MIN, t + 29 * MIN].find((x) => !activeEvent(s, x))!;
    expect(useCharm(s, 'charm-aurora', free).ok).toBe(true);
    expect(activeEvent(s, free + MIN)?.kind).toBe('aurora');
    expect(canSeeForecast(s, free)).toBe(false);
    const chart = s.shop.offers.find((o) => o.kind === 'sky' && o.ref === 'starchart')!;
    expect(chart.price).toBe(SKY_ITEMS.starchart.price);
    expect(buyOffer(s, chart.id, free).ok).toBe(true);
    expect(canSeeForecast(s, free + 23 * 3_600_000)).toBe(true);
    expect(canSeeForecast(s, free + 25 * 3_600_000)).toBe(false);
    expect(upcomingEvents(s, free, 3)).toHaveLength(3);
  });
});
