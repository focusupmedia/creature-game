// The traveling stall. Inventory rotates on a timer; staples are always there,
// curiosities come and go. Premium cosmetics rotate too: urgency without ever
// selling discovery itself.

import { WILD_SPECIES } from '../content/species';
import { DECOR, ITEMS } from '../content/world';
import { TUNING } from '../content/tuning';
import { mulberry32 } from './rng';
import type { GameState, ShopOffer, ShopState } from './types';

export function generateShop(seed: number, rotation: number, t: number): ShopState {
  const r = mulberry32((seed ^ (rotation * 2654435761)) >>> 0);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const offers: ShopOffer[] = [];
  const add = (o: Omit<ShopOffer, 'id'>) => offers.push({ ...o, id: `o${rotation}-${offers.length}` });

  add({ kind: 'lure', ref: 'mossberry', price: 20, currency: 'glimmer', qty: 1, stock: 99 });
  add({ kind: 'lure', ref: 'riverweed', price: 25, currency: 'glimmer', qty: 1, stock: 99 });
  // Curious lures rotate. The first visit always shows Moonpetal as a tease.
  if (rotation === 0 || r() < 0.55) add({ kind: 'lure', ref: 'moonpetal', price: 60, currency: 'glimmer', qty: 1, stock: 2 });
  if (rotation === 0 || r() < 0.7) add({ kind: 'lure', ref: 'honeydew', price: 35, currency: 'glimmer', qty: 1, stock: 3 });

  const item = pick(Object.values(ITEMS));
  add({ kind: 'item', ref: item.id, price: item.price, currency: 'glimmer', qty: 1, stock: 2 });

  // A traveler's egg: something wild, never a hybrid (hybrids must be made).
  const pool = WILD_SPECIES.filter((s) => s.rarity !== 'common');
  add({ kind: 'egg', ref: pick(pool).id, price: TUNING.mysteryEggPrice, currency: 'glimmer', qty: 1, stock: 1 });

  const basic = Object.values(DECOR).filter((d) => !d.rotating);
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
  state.shop = generateShop(state.seed, state.shop.rotation + 1, t);
}
