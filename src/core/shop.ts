// The traveling stall. Inventory rotates on a timer; staples are always there,
// curiosities come and go. Premium cosmetics rotate too: urgency without ever
// selling discovery itself.

import { DECOR, EGG_TIERS, EVENTS, FOODS, ITEMS, LURES, SKY_ITEMS, TOOLS } from '../content/world';
import { TUNING } from '../content/tuning';
import { inHalloween } from '../content/seasons';
import { mulberry32 } from './rng';
import type { GameState, IslandId, ShopOffer, ShopState } from './types';

/** Look at this many stocks without seeing one and the next stock is sure to have it. */
export const PITY = { legendary: 2, mythical: 5 };

export function generateShop(seed: number, rotation: number, t: number, owned: IslandId[] = ['home'], sure: { legendary?: boolean; mythical?: boolean } = {}): ShopState {
  const r = mulberry32((seed ^ (rotation * 2654435761)) >>> 0);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const offers: ShopOffer[] = [];
  const add = (o: Omit<ShopOffer, 'id'>) => offers.push({ ...o, id: `o${rotation}-${offers.length}` });

  // Lures: every kind can turn up at random; rarer ones less often and in smaller stacks.
  const lure = (ref: string, chance: number, stock: number) => {
    if (r() < chance) add({ kind: 'lure', ref, price: LURES[ref].price, currency: 'glimmer', qty: 1, stock });
  };
  lure('mossberry', 0.8, 8);
  lure('riverweed', 0.8, 8);
  lure('honeydew', 0.65, 6);
  if (rotation === 0) add({ kind: 'lure', ref: 'moonpetal', price: LURES.moonpetal.price, currency: 'glimmer', qty: 1, stock: 3 });
  else lure('moonpetal', 0.45, 3);
  const scents: [IslandId, string][] = [['volcano', 'emberpepper'], ['lagoon', 'saltkelp'], ['beach', 'seaspray'], ['desert', 'sunbaked'], ['cloud', 'breeze']];
  for (const [isl, ref] of scents) if (owned.includes(isl)) lure(ref, 0.65, 5);
  // never an empty lure shelf: a couple of everyday lures at least
  if (offers.filter((o) => o.kind === 'lure').length < 2) {
    for (const ref of ['mossberry', 'riverweed']) if (!offers.some((o) => o.ref === ref)) add({ kind: 'lure', ref, price: LURES[ref].price, currency: 'glimmer', qty: 1, stock: 6 });
  }

  // Food comes and goes too (snacks nearly always)
  const food = (ref: string, chance: number, stock: number) => {
    if (r() < chance) add({ kind: 'food', ref, price: FOODS[ref].price, currency: 'glimmer', qty: 1, stock });
  };
  food('snack', 0.9, 8);
  food('sprout', 0.5, 3);
  food('feast', 0.45, 2);
  food('feedbag', 0.35, 2);

  // Gadgets (decorations that do something): a few at a time, rarer ones seldom
  const gadget = (ref: string, chance: number, stock: number) => {
    if (r() < chance) add({ kind: 'decor', ref, price: DECOR[ref].price, currency: DECOR[ref].currency, qty: 1, stock });
  };
  gadget('fruittree', 0.6, 2);
  gadget('totemrare', 0.5, 2);
  gadget('totemepic', 0.3, 1);
  gadget('totemlegend', 0.12, 1);
  gadget('nursery', 0.35, 1);

  // trait tools are always stocked, for Starshards
  for (const t of Object.values(TOOLS)) add({ kind: 'tool', ref: t.id, price: t.price, currency: 'shards', qty: 1, stock: 99 });

  // one egg tonic and two of Mango's egg sprays each restock
  const tonics = Object.values(ITEMS).filter((i) => !i.spray);
  const item = pick(tonics);
  add({ kind: 'item', ref: item.id, price: item.price, currency: 'glimmer', qty: 1, stock: 2 });
  const sprays = Object.values(ITEMS).filter((i) => i.spray);
  const s1 = pick(sprays);
  add({ kind: 'item', ref: s1.id, price: s1.price, currency: 'glimmer', qty: 1, stock: 3 });
  const s2 = pick(sprays.filter((x) => x !== s1));
  add({ kind: 'item', ref: s2.id, price: s2.price, currency: 'glimmer', qty: 1, stock: 3 });

  // Sky items, for Starshards: two rotating charms, the wild charm and the forecasts
  // Halloween charms are only in stock during the Halloween season
  const charms = (Object.keys(EVENTS) as (keyof typeof EVENTS)[]).filter((k) => !EVENTS[k].season || inHalloween(t)).map((k) => `charm-${k}`);
  const c1 = pick(charms);
  const c2 = pick(charms.filter((x) => x !== c1));
  for (const id of [c1, c2, 'wildcharm', 'starchart']) add({ kind: 'sky', ref: id, price: SKY_ITEMS[id].price, currency: 'shards', qty: 1, stock: id === 'starchart' ? 99 : 2 });
  add({ kind: 'sky', ref: 'telescope', price: SKY_ITEMS.telescope.price, currency: 'shards', qty: 1, stock: 1 });

  // Egg shop: a staple meadow egg, one rotating coin egg, and the premium Starry Egg.
  // Wild species only: hybrids must always be made.
  const egg = (id: string, stock: number) => {
    const tier = EGG_TIERS[id];
    add({ kind: 'egg', ref: id, price: tier.price, currency: tier.currency, qty: 1, stock });
  };
  egg('meadow', 3);
  egg(['wild', 'ember', 'reef'][rotation % 3], 2);
  egg('starry', 2);

  // Decorations live in the always-open catalog (see buyDecor), not the rotating stock.

  // Special stock: Epic most of the time, Legendary now and then, Mythical seldom. Keepers who
  // keep checking are sure to see them (see refreshShop): in three days of play, at least one
  // Mythical egg and about three Legendary ones.
  if (r() < 0.55) egg('epic', 2);
  if (r() < 0.5) add({ kind: 'lure', ref: 'shimmer', price: LURES.shimmer.price, currency: 'glimmer', qty: 1, stock: 2 });
  const legendary = sure.legendary || r() < 0.2;
  const mythical = sure.mythical || r() < 0.05;
  if (legendary) {
    egg('legendary', 1);
    add({ kind: 'lure', ref: 'golden', price: LURES.golden.price, currency: 'glimmer', qty: 1, stock: 1 });
  }
  if (mythical) {
    egg('mythical', 1);
    add({ kind: 'lure', ref: 'mythic', price: LURES.mythic.price, currency: 'shards', qty: 1, stock: 1 });
  }

  return { rotation, offers, nextRefreshAt: t + TUNING.shopRefreshMin * 60_000 };
}

export function refreshShop(state: GameState, t: number): void {
  const owned = (Object.keys(state.islands ?? {}) as IslandId[]).filter((k) => state.islands[k].owned);
  const pity = (state.shopPity ??= { legendary: 0, mythical: 0 });
  // only stocks you actually looked at count
  if (state.shop.viewed) {
    const has = (ref: string) => state.shop.offers.some((o) => o.kind === 'egg' && o.ref === ref);
    pity.legendary = has('legendary') ? 0 : pity.legendary + 1;
    pity.mythical = has('mythical') ? 0 : pity.mythical + 1;
  }
  state.shop = generateShop(state.seed, state.shop.rotation + 1, t, owned, { legendary: pity.legendary >= PITY.legendary, mythical: pity.mythical >= PITY.mythical });
}

/** Something rare in a stock: a Legendary or Mythical egg, or a Golden or Mythic lure. */
export function hasSpecial(shop: ShopState): boolean {
  return shop.offers.some((o) => (o.kind === 'egg' && (o.ref === 'legendary' || o.ref === 'mythical')) || (o.kind === 'lure' && (o.ref === 'golden' || o.ref === 'mythic')));
}

/** Peek at the next stock (it's decided by the seed), for the "something rare arrived" reminder. */
export function nextStockIsSpecial(state: GameState): boolean {
  const owned = (Object.keys(state.islands ?? {}) as IslandId[]).filter((k) => state.islands[k].owned);
  const pity = { ...(state.shopPity ?? { legendary: 0, mythical: 0 }) };
  if (state.shop.viewed) {
    const has = (ref: string) => state.shop.offers.some((o) => o.kind === 'egg' && o.ref === ref);
    pity.legendary = has('legendary') ? 0 : pity.legendary + 1;
    pity.mythical = has('mythical') ? 0 : pity.mythical + 1;
  }
  return hasSpecial(generateShop(state.seed, state.shop.rotation + 1, state.shop.nextRefreshAt, owned, { legendary: pity.legendary >= PITY.legendary, mythical: pity.mythical >= PITY.mythical }));
}
