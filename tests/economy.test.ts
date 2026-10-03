// Economy simulation: a scripted "active casual" keeper plays four 20-minute
// sessions a day (away in between) and spends like a sensible player. We track
// every coin in and out by source and check the big purchases land at a good
// pace. Run `ECON=1 npx vitest run tests/economy.test.ts` to print the tables.

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/state';
import { islandCapacity, tick } from '../src/core/sim';
import * as A from '../src/core/actions';
import {
  awayFinds, canSell, feedCreature, isHungry, keepVisitor, sellCreature, sellPrice, sendAwayVisitor,
} from '../src/core/care';
import { claimDaily, claimLasting, LASTING, questEvent, refreshDailies } from '../src/core/quests';
import { addXp, levelOf } from '../src/core/levels';
import { xpFor, type PlayEvent } from '../src/core/progress';
import { meetWanderer } from '../src/core/wanderers';
import { compatibility } from '../src/core/genetics';
import { StateRng } from '../src/core/rng';
import { ISLANDS, ISLAND_ORDER, SIZE_PRICE } from '../src/content/islands';
import { LURES, SPOTS, spotOpen } from '../src/content/world';
import { species } from '../src/content/species';
import type { GameState, IslandId } from '../src/core/types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export interface DayLog {
  day: number;
  coins: number;
  shards: number;
  level: number;
  xp: number;
  species: number;
  islands: string;
  earned: Record<string, number>;
  spent: Record<string, number>;
  dailiesDone: number;
}

export function simulate(seed: number, days: number, sessionsPerDay = 4, sessionMin = 20): DayLog[] {
  const t0 = Date.UTC(2026, 0, 5, 7);
  const s = createGame(seed, t0);
  s.tutorial = 6;
  const rng = new StateRng({ rng: seed * 7919 } as GameState);
  const logs: DayLog[] = [];
  let earned: Record<string, number> = {};
  let spent: Record<string, number> = {};
  let dailiesDone = 0;
  const book = (src: string, before: number) => {
    const d = s.glimmer - before;
    if (d > 0) earned[src] = (earned[src] ?? 0) + d;
    if (d < 0) spent[src] = (spent[src] ?? 0) - d;
  };
  const record = (ev: PlayEvent, t: number) => {
    questEvent(s, ev);
    const before = s.glimmer;
    addXp(s, xpFor(ev), t);
    book('level ups', before);
  };
  const owned = () => ISLAND_ORDER.filter((id) => s.islands[id]?.owned);
  const pop = (id: IslandId) => s.creatures.filter((c) => c.island === id && !c.stored).length;

  // Make room on a world: sell the plainest duplicate there.
  const makeRoom = (id: IslandId, t: number): boolean => {
    const dupes = s.creatures
      .filter((c) => c.island === id && !c.stored && !canSell(s, c) && (s.journal.species[c.species]?.count ?? 0) > 1)
      .sort((a, b) => sellPrice(s, a, false) - sellPrice(s, b, false));
    if (!dupes.length) return false;
    const before = s.glimmer;
    if (process.env.ECON_SALES) process.stdout.write(`sell ${dupes[0].species} ${species(dupes[0].species).rarity} [${dupes[0].mutations}] size ${dupes[0].size.toFixed(2)} -> ${sellPrice(s, dupes[0], t < s.collector.until)}\n`);
    const ok = sellCreature(s, dupes[0].id, t).ok;
    book('selling', before);
    return ok;
  };

  const playMinute = (t: number) => {
    refreshDailies(s, t);
    // wanderers: always say hello (and shoo the Goblin)
    if (s.wanderer) {
      const before = s.glimmer;
      meetWanderer(s, t, new StateRng(s));
      book('wanderers', before);
    }
    // pick up everything on the ground
    for (const g of [...s.gifts]) {
      const before = s.glimmer;
      const r = A.collectGift(s, g.id, t);
      book(g.meteor ? 'meteor rocks' : 'finds on the ground', before);
      if (r.ok) record({ kind: 'gift', glimmer: r.glimmer, shards: r.shards, byCreature: false }, t);
    }
    // send a creature to every dig spot (finds auto-collect)
    for (const d of [...s.digSpots]) {
      const c = s.creatures.find((x) => x.island === d.island && !x.stored && species(x.species).movement !== 'swim');
      if (!c) continue;
      const r = A.workDigSpot(s, d.id, c.id);
      if (!r.ok) continue;
      const before = s.glimmer;
      A.collectGift(s, r.gift.id, t);
      book('dig spots', before);
      record({ kind: 'digSpot' }, t);
      record({ kind: 'gift', glimmer: r.gift.glimmer, shards: r.gift.shards, byCreature: false }, t);
    }
    // visitors: keep new or rare ones, thank the rest
    for (const v of [...s.visitors]) {
      const sp = species(v.creature.species);
      const want = (s.journal.species[sp.id]?.count ?? 0) <= 2 || sp.rarity === 'rare' || sp.rarity === 'legendary' || sp.rarity === 'mythical';
      if (want && (pop(v.island) < islandCapacity(s, v.island) || makeRoom(v.island, t))) {
        keepVisitor(s, v.creature.id, islandCapacity(s, v.island));
      } else {
        const before = s.glimmer;
        sendAwayVisitor(s, v.creature.id);
        book('visitor thanks', before);
      }
    }
    // feed the hungry
    for (const c of s.creatures.filter((x) => !x.stored && isHungry(x))) {
      if (!(s.food.fruit ?? 0) && !(s.food.snack ?? 0)) {
        const offer = s.shop.offers.find((o) => o.ref === 'snack');
        if (!offer || s.glimmer < offer.price) break;
        const before = s.glimmer;
        A.buyOffer(s, offer.id, t);
        book('food', before);
      }
      feedCreature(s, c.id);
    }
    // keep a lure out on every open spot
    for (const id of Object.keys(SPOTS)) {
      if (!spotOpen(s.islands, id) || s.spots[id]) continue;
      const island = SPOTS[id].island;
      let lure = Object.keys(s.lures).find((l) => s.lures[l] > 0 && (island === 'home' || LURES[l].attracts === ISLANDS[island].habitat));
      if (!lure) {
        const offer = s.shop.offers
          .filter((o) => o.kind === 'lure' && o.stock > 0 && (island === 'home' ? ['Grove', 'Tide', 'Bloom', 'Mystic'].includes(LURES[o.ref].attracts) : LURES[o.ref].attracts === ISLANDS[island].habitat))
          .sort((a, b) => a.price - b.price)[0];
        if (!offer || s.glimmer < offer.price + 60) continue;
        const before = s.glimmer;
        A.buyOffer(s, offer.id, t);
        book('lures', before);
        lure = offer.ref;
      }
      if (A.placeLure(s, id, lure, t).ok) record({ kind: 'lure' }, t);
    }
    // hatch, then breed
    for (const e of s.eggs.filter((x) => x.nest !== null && x.progressMs >= x.incubationMs)) {
      if (pop('home') >= islandCapacity(s, 'home') && !makeRoom('home', t)) break;
      const before = s.glimmer;
      const r = A.hatch(s, e.id, t);
      book('discoveries', before);
      if (r.ok) record({ kind: 'hatch', species: r.creature.species, newSpecies: r.newSpecies, newMutations: r.newMutations.length }, t);
    }
    for (let tries = 0; tries < 8; tries++) {
      const home = s.creatures.filter((c) => !c.stored);
      const a = rng.pick(home);
      const b = rng.pick(home);
      if (a === b || !compatibility(a, b).ok) continue;
      if (A.startCombine(s, a.id, b.id, t).ok) {
        record({ kind: 'breed' }, t);
        break;
      }
    }
    // quests
    for (const q of s.quests.daily) {
      const before = s.glimmer;
      if (claimDaily(s, q.id).ok) dailiesDone++;
      book('daily quests', before);
    }
    for (const l of LASTING) {
      const before = s.glimmer;
      claimLasting(s, l.id);
      book('lasting quests', before);
    }
    // big purchases: the next world first, then growing worlds
    const next = ISLAND_ORDER.find((id) => !s.islands[id]?.owned && ISLANDS[id].status === 'buyable');
    if (next) {
      const before = s.glimmer;
      if (A.buyIsland(s, next).ok) book('new worlds', before);
    }
    const saving = next && levelOf(s.xp) >= ISLANDS[next].price.level;
    if (!saving) {
      for (const id of owned()) {
        const price = SIZE_PRICE[(s.islands[id]?.size ?? 0) + 1];
        if (price && s.glimmer > price.coins * 1.2) {
          const before = s.glimmer;
          A.upgradeIsland(s, id, 'glimmer');
          book('growing worlds', before);
        }
      }
      // a treat now and then: a Meadow Egg when flush
      const egg = s.shop.offers.find((o) => o.kind === 'egg' && o.currency === 'glimmer' && o.stock > 0);
      if (egg && s.glimmer > 1500 && rng.chance(0.05)) {
        const before = s.glimmer;
        if (A.buyOffer(s, egg.id, t).ok) record({ kind: 'shopEgg' }, t);
        book('shop eggs', before);
      }
    }
  };

  let t = t0;
  for (let day = 1; day <= days; day++) {
    earned = {};
    spent = {};
    dailiesDone = 0;
    for (let sIdx = 0; sIdx < sessionsPerDay; sIdx++) {
      // away until the next session
      const sessionStart = t0 + (day - 1) * DAY + sIdx * (16 / sessionsPerDay) * HOUR;
      if (sessionStart > t) {
        const away = sessionStart - t;
        let before = s.glimmer;
        tick(s, sessionStart, { maxStepMs: 10_000 });
        book('while away (sim)', before);
        before = s.glimmer;
        awayFinds(s, away);
        book('away finds', before);
        t = sessionStart;
      }
      for (let m = 0; m < sessionMin; m++) {
        for (let k = 0; k < 6; k++) {
          t += 10_000;
          const before = s.glimmer;
          tick(s, t, { maxStepMs: 1000, live: true, here: 'home' });
          book('live sim', before);
        }
        playMinute(t);
      }
    }
    logs.push({
      day, coins: s.glimmer, shards: s.shards, level: levelOf(s.xp), xp: s.xp, species: Object.keys(s.journal.species).length,
      islands: owned().map((id) => `${id}${'·SML'[s.islands[id].size + 1]}`).join(' '),
      earned, spent, dailiesDone,
    });
  }
  return logs;
}

const print = (logs: DayLog[]) => {
  for (const l of logs) {
    const fmt = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
    const inn = Object.values(l.earned).reduce((a, b) => a + b, 0);
    const out = Object.values(l.spent).reduce((a, b) => a + b, 0);
    process.stdout.write(`day ${l.day}: lv ${l.level} (${l.xp} xp)  coins ${l.coins}  shards ${l.shards}  species ${l.species}  dailies ${l.dailiesDone}/3  worlds ${l.islands}\n`
      + `   in ${inn}: ${fmt(l.earned)}\n   out ${out}: ${fmt(l.spent)}\n`);
  }
};

describe('economy', () => {
  it('an active casual keeper unlocks worlds at a steady pace and always has something to save for', () => {
    const logs = simulate(3, 10);
    if (process.env.ECON) print(logs);
    const dayOwning = (id: string) => logs.find((l) => l.islands.includes(id))?.day ?? 99;
    // Ember Peak within the first two days, the last world in the second week
    expect(dayOwning('volcano')).toBeLessThanOrEqual(2);
    expect(dayOwning('lagoon')).toBeLessThanOrEqual(4);
    expect(dayOwning('beach')).toBeGreaterThanOrEqual(3);
    expect(dayOwning('desert')).toBeGreaterThanOrEqual(7);
    // levels: 20 in about a week, not in a day
    expect(logs[0].level).toBeLessThanOrEqual(8);
    expect(logs[6].level).toBeGreaterThanOrEqual(15);
    expect(logs[6].level).toBeLessThanOrEqual(24);
    // coins never pile up with nothing to buy, and no one source runs away with the economy
    expect(logs[logs.length - 1].coins).toBeLessThan(30_000);
    for (const l of logs.slice(2)) {
      const total = Object.values(l.earned).reduce((a, b) => a + b, 0);
      expect(Math.max(...Object.values(l.earned)) / total).toBeLessThan(0.75);
    }
  }, 60_000);
});
