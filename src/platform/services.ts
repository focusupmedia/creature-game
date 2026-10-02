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

export interface Purchases {
  products(): { id: string; shards: number; price: string; tag?: string }[];
  buy(productId: string): Promise<{ ok: boolean; shards: number }>;
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
  products() {
    return [
      { id: 'shards_small', shards: 60, price: '$0.99' },
      { id: 'shards_medium', shards: 330, price: '$4.99', tag: 'Popular' },
      { id: 'shards_large', shards: 720, price: '$9.99', tag: 'Best value' },
    ];
  }
  async buy(productId: string) {
    const p = this.products().find((x) => x.id === productId);
    // Web build never charges: purchases are disabled until store SDKs are wired.
    return { ok: false, shards: p?.shards ?? 0 };
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
