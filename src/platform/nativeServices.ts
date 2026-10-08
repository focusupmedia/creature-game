// Real ads and purchases for the phone apps (the web build keeps the stubs).
//   Ads:       Google AdMob rewarded ads (@capacitor-community/admob)
//   Purchases: RevenueCat (@revenuecat/purchases-capacitor) over the App Store / Google Play
// Product ids in the stores must match the ids in StubPurchases.products().

import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Purchases as RC, PRODUCT_CATEGORY, type PurchasesStoreProduct } from '@revenuecat/purchases-capacitor';
import { STORE_KEYS } from './storeKeys';
import { StubPurchases, type Ads, type Product, type Purchases } from './services';

const ios = () => Capacitor.getPlatform() === 'ios';
/** Resolves a moment after the first tap anywhere (the app is active by then). */
const afterFirstTap = () => new Promise<void>((resolve) => {
  window.addEventListener('pointerup', () => setTimeout(resolve, 600), { once: true, capture: true });
});
const errText = (e: unknown) => String((e as { message?: unknown })?.message ?? e ?? 'unknown').slice(0, 80);

export class AdMobAds implements Ads {
  private ready = false;
  private loaded = false;
  lastError?: string;

  private starting?: Promise<void>;

  constructor() {
    void this.start();
  }

  /** Set up once; a call while setup is still running waits for that one. */
  private start(): Promise<void> {
    this.starting ??= this.init().finally(() => { this.starting = undefined; });
    return this.starting;
  }

  private async init(): Promise<void> {
    try {
      await AdMob.initialize({ initializeForTesting: STORE_KEYS.admob.testing });
      // privacy: the consent form where the law asks for one (a missing or failing form never blocks ads)
      try {
        const consent = await AdMob.requestConsentInfo();
        if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') await AdMob.showConsentForm();
      } catch (e) {
        this.lastError = errText(e);
      }
      // Apple's "Allow tracking?" prompt. iOS only shows it while the app is fully on
      // screen, so wait for the player's first tap instead of asking during launch.
      if (ios()) await afterFirstTap().then(() => AdMob.requestTrackingAuthorization()).catch(() => undefined);
      this.ready = true;
      await this.load();
    } catch (e) {
      this.ready = false;
      this.lastError = errText(e);
    }
  }

  private async load(): Promise<void> {
    try {
      await AdMob.prepareRewardVideoAd({
        adId: ios() ? STORE_KEYS.admob.rewardedIos : STORE_KEYS.admob.rewardedAndroid,
        isTesting: STORE_KEYS.admob.testing,
      });
      this.loaded = true;
    } catch (e) {
      this.loaded = false;
      this.lastError = errText(e);
    }
  }

  available(): boolean {
    return this.ready;
  }

  async showRewarded(): Promise<boolean> {
    if (!this.ready) await this.start(); // e.g. offline at launch: try again now
    if (!this.ready) return false;
    if (!this.loaded) await this.load();
    if (!this.loaded) return false;
    this.loaded = false;
    // The plugin only settles its promise when a reward is earned, so also listen
    // for the ad closing or failing, or a skipped ad would wait forever.
    let earned = false;
    let finish: () => void = () => undefined;
    const done = new Promise<void>((r) => { finish = r; });
    const subs = await Promise.all([
      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; }),
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish()),
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, (e) => { this.lastError = errText(e); finish(); }),
    ]);
    AdMob.showRewardVideoAd()
      .then((item) => { if (item && item.amount > 0) earned = true; finish(); })
      .catch(() => finish());
    await done;
    await new Promise((r) => setTimeout(r, 300)); // a late reward event still counts
    for (const s of subs) await s.remove().catch(() => undefined);
    void this.load(); // get the next one ready
    return earned;
  }
}

export class StorePurchases implements Purchases {
  private catalog = new StubPurchases().products();
  private store = new Map<string, PurchasesStoreProduct>();
  private configured = false;

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      if (!this.configured) {
        await RC.configure({ apiKey: ios() ? STORE_KEYS.revenuecat.ios : STORE_KEYS.revenuecat.android });
        this.configured = true;
      }
      const { products } = await RC.getProducts({ productIdentifiers: this.catalog.map((p) => p.id), type: PRODUCT_CATEGORY.NON_SUBSCRIPTION });
      for (const p of products) this.store.set(p.identifier, p);
    } catch {
      /* store not reachable: packs show as unavailable, tried again on the next buy */
    }
  }

  /** The packs, with real local prices from the store once they've loaded. */
  products(): Product[] {
    return this.catalog.map((p) => ({ ...p, price: this.store.get(p.id)?.priceString ?? p.price }));
  }

  async buy(productId: string) {
    if (!this.store.size) await this.init();
    const product = this.products().find((x) => x.id === productId);
    const sp = this.store.get(productId);
    if (!product || !sp) return { ok: false, error: 'The store isn\'t reachable right now. Nothing was charged.' };
    try {
      await RC.purchaseStoreProduct({ product: sp });
      return { ok: true, product };
    } catch (e) {
      const code = String((e as { code?: unknown })?.code ?? '');
      // Ask to Buy: a parent approves later; a pass then comes back through restore
      if (code === '20' || /pending/i.test(String((e as Error)?.message))) return { ok: false, error: 'Waiting for approval. Nothing was charged yet.' };
      return { ok: false }; // cancelled or failed: nothing charged
    }
  }

  /** Ids of the one-time purchases this store account already owns (the pass). */
  async owned(restore: boolean): Promise<string[]> {
    try {
      if (!this.configured) await this.init();
      const { customerInfo } = restore ? await RC.restorePurchases() : await RC.getCustomerInfo();
      return customerInfo.allPurchasedProductIdentifiers ?? [];
    } catch {
      return [];
    }
  }
}
