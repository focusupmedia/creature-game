// Platform service seams. The game only talks to these interfaces; web stubs
// ship today, and native implementations (Capacitor plugins) slot in later:
//
//   Storage        -> @capacitor/preferences (+ cloud save via backend)
//   Ads            -> AdMob rewarded (e.g. @capacitor-community/admob)
//   Purchases      -> RevenueCat (@revenuecat/purchases-capacitor) / StoreKit / Play Billing
//   Analytics      -> Firebase Analytics or similar
//   Crash          -> Sentry / Firebase Crashlytics
//   Notifications  -> @capacitor/local-notifications
//   RemoteConfig   -> Firebase Remote Config or a JSON endpoint

import { TUNING } from '../content/tuning';

export interface Storage {
  load(key: string): string | null;
  save(key: string, value: string): void;
  remove(key: string): void;
}

export interface Ads {
  /** Shows a rewarded ad. Resolves true only if the player earned the reward. */
  showRewarded(placement: string): Promise<boolean>;
  available(): boolean;
}

export interface Product {
  id: string;
  /** What the pack contains. */
  currency: 'shards' | 'coins';
  amount: number;
  price: string;
  tag?: string;
}

export interface Purchases {
  products(): Product[];
  /** `test` is true when no real money changed hands (web playtest build). */
  buy(productId: string): Promise<{ ok: boolean; product?: Product; test?: boolean }>;
}

export interface Analytics {
  track(event: string, props?: Record<string, string | number | boolean>): void;
}

export interface Notifications {
  schedule(id: string, at: number, title: string, body: string): void;
  cancel(id: string): void;
}

export interface Crash {
  capture(err: unknown, context?: string): void;
}

// ---------------------------------------------------------------- web stubs

export class WebStorage implements Storage {
  load(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  save(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* private mode or blocked: play continues unsaved */ }
  }
  remove(key: string): void {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

/** Simulates a short rewarded ad so the flow can be playtested on web. */
export class StubAds implements Ads {
  constructor(private overlay: (seconds: number) => Promise<boolean>) {}
  available(): boolean { return true; }
  showRewarded(): Promise<boolean> { return this.overlay(3); }
}

export class StubPurchases implements Purchases {
  products(): Product[] {
    return [
      { id: 'shards_small', currency: 'shards', amount: 60, price: '$0.99' },
      { id: 'shards_medium', currency: 'shards', amount: 330, price: '$4.99', tag: 'Popular' },
      { id: 'shards_large', currency: 'shards', amount: 720, price: '$9.99' },
      { id: 'shards_huge', currency: 'shards', amount: 1550, price: '$19.99', tag: '+8% bonus' },
      { id: 'shards_mega', currency: 'shards', amount: 4200, price: '$49.99', tag: '+17% bonus' },
      { id: 'shards_ultimate', currency: 'shards', amount: 9000, price: '$99.99', tag: 'Best value · +25%' },
      { id: 'coins_small', currency: 'coins', amount: 500, price: '$0.99' },
      { id: 'coins_medium', currency: 'coins', amount: 3000, price: '$4.99', tag: 'Popular' },
      { id: 'coins_large', currency: 'coins', amount: 7000, price: '$9.99' },
      { id: 'coins_huge', currency: 'coins', amount: 15000, price: '$19.99', tag: '+7% bonus' },
      { id: 'coins_mega', currency: 'coins', amount: 40000, price: '$49.99', tag: '+14% bonus' },
      { id: 'coins_ultimate', currency: 'coins', amount: 90000, price: '$99.99', tag: 'Best value · +29%' },
    ];
  }
  async buy(productId: string) {
    const product = this.products().find((x) => x.id === productId);
    // Web playtest build: packs are granted for free so the flow can be tested.
    // Store SDKs replace this class in the App Store / Google Play builds.
    return { ok: !!product, product, test: true };
  }
}

export class ConsoleAnalytics implements Analytics {
  readonly log: { t: number; event: string; props?: Record<string, unknown> }[] = [];
  track(event: string, props?: Record<string, string | number | boolean>): void {
    this.log.push({ t: Date.now(), event, props });
    if (this.log.length > 500) this.log.shift();
    if (import.meta.env.DEV) console.debug('[analytics]', event, props ?? '');
  }
}

export class WebNotifications implements Notifications {
  private timers = new Map<string, number>();
  schedule(id: string, at: number, title: string, body: string): void {
    this.cancel(id);
    // On web we only log; native builds schedule OS-level local notifications.
    if (import.meta.env.DEV) console.debug('[notify]', new Date(at).toLocaleTimeString(), title, body);
    this.timers.set(id, at);
  }
  cancel(id: string): void { this.timers.delete(id); }
}

export class ConsoleCrash implements Crash {
  capture(err: unknown, context?: string): void {
    console.error('[crash]', context ?? '', err);
  }
}

/** Remote config: defaults from TUNING, overridable by a fetched JSON blob. */
export async function applyRemoteConfig(url?: string): Promise<void> {
  if (!url) return;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const patch = (await res.json()) as Partial<typeof TUNING>;
    Object.assign(TUNING, patch);
  } catch {
    // Offline: defaults are always a complete, playable config.
  }
}
