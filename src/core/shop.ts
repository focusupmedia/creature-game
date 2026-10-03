// The traveling stall. Inventory rotates on a timer; staples are always there,
// curiosities come and go. Premium cosmetics rotate too: urgency without ever
// selling discovery itself.

import { DECOR, EGG_TIERS, FOODS, ITEMS, TOOLS } from '../content/world';
import { TUNING } from '../content/tuning';
import { mulberry32 } from './rng';
import type { GameState, IslandId, ShopOffer, ShopState } from './types';

export function generateShop(seed: number, rotation: number, t: number, owned: IslandId[] = ['home']): ShopState {
  const r = mulberry32((seed ^ (rotation * 2654435761)) >>> 0);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const offers: ShopOffer[] = [];
  const add = (o: Omit<ShopOffer, 'id'>) => offers.push({ ...o, id: `o${rotation}-${offers.length}` });

  add({ kind: 'lure', ref: 'mossberry', price: 20, currency: 'glimmer', qty: 1, stock: 99 });
  add({ kind: 'lure', ref: 'riverweed', price: 25, currency: 'glimmer', qty: 1, stock: 99 });
  // Curious lures rotate. The first visit always shows Moonpetal as a tease.
  if (rotation === 0 || r() < 0.55) add({ kind: 'lure', ref: 'moonpetal', price: 60, currency: 'glimmer', qty: 1, stock: 2 });
  if (rotation === 0 || r() < 0.7) add({ kind: 'lure', ref: 'honeydew', price: 35, currency: 'glimmer', qty: 1, stock: 3 });

  // Island scents are always stocked once you own the island.
  if (owned.includes('volcano')) add({ kind: 'lure', ref: 'emberpepper', price: 45, currency: 'glimmer', qty: 1, stock: 99 });
  if (owned.includes('lagoon')) add({ kind: 'lure', ref: 'saltkelp', price: 45, currency: 'glimmer', qty: 1, stock: 99 });
  if (owned.includes('beach')) add({ kind: 'lure', ref: 'seaspray', price: 50, currency: 'glimmer', qty: 1, stock: 99 });
  if (owned.includes('desert')) add({ kind: 'lure', ref: 'sunbaked', price: 55, currency: 'glimmer', qty: 1, stock: 99 });

  // food is always stocked
  for (const f of ['snack', 'feast', 'feedbag']) add({ kind: 'food', ref: f, price: FOODS[f].price, currency: 'glimmer', qty: 1, stock: 99 });
  add({ kind: 'decor', ref: 'fruittree', price: DECOR.fruittree.price, currency: 'glimmer', qty: 1, stock: 99 });
  // trait tools are always stocked, for Starshards
  for (const t of Object.values(TOOLS)) add({ kind: 'tool', ref: t.id, price: t.price, currency: 'shards', qty: 1, stock: 99 });

  const item = pick(Object.values(ITEMS));
  add({ kind: 'item', ref: item.id, price: item.price, currency: 'glimmer', qty: 1, stock: 2 });

  // Egg shop: a staple meadow egg, one rotating coin egg, and the premium Starry Egg.
  // Wild species only: hybrids must always be made.
  const egg = (id: string, stock: number) => {
    const tier = EGG_TIERS[id];
    add({ kind: 'egg', ref: id, price: tier.price, currency: tier.currency, qty: 1, stock });
  };
  egg('meadow', 3);
  egg(['wild', 'ember', 'reef'][rotation % 3], 2);
  egg('starry', 2);

  const basic = Object.values(DECOR).filter((d) => !d.rotating && d.id !== 'fruittree');
  const premium = Object.values(DECOR).filter((d) => d.rotating);
  const d1 = pick(basic);
  let d2 = pick(basic);
  if (d2.id === d1.id) d2 = basic[(basic.indexOf(d1) + 1) % basic.length];
  for (const d of [d1, d2]) add({ kind: 'decor', ref: d.id, price: d.price, currency: d.currency, qty: 1, stock: 1 });
  const p = premium[rotation % premium.length];
  add({ kind: 'decor', ref: p.id, price: p.price, currency: 'shards', qty: 1, stock: 1 });

  return { rotation, offers, nextRefreshAt: t + TUNING.shopRefreshMin * 60_000 };
}

export function refreshShop(state: GameState, t: number): void {
  const owned = (Object.keys(state.islands ?? {}) as IslandId[]).filter((k) => state.islands[k].owned);
  state.shop = generateShop(state.seed, state.shop.rotation + 1, t, owned);
}
