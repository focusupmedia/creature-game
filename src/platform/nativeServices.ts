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

export class AdMobAds implements Ads {
  private ready = false;
  private loaded = false;

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await AdMob.initialize({ initializeForTesting: STORE_KEYS.admob.testing });
      // privacy: the consent form where the law asks for one, and Apple's tracking prompt
      const consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') await AdMob.showConsentForm();
      if (ios()) await AdMob.requestTrackingAuthorization().catch(() => undefined);
      this.ready = true;
      await this.load();
    } catch {
      this.ready = false;
    }
  }

  private async load(): Promise<void> {
    try {
      await AdMob.prepareRewardVideoAd({
        adId: ios() ? STORE_KEYS.admob.rewardedIos : STORE_KEYS.admob.rewardedAndroid,
        isTesting: STORE_KEYS.admob.testing,
      });
      this.loaded = true;
    } catch {
      this.loaded = false;
    }
  }

  available(): boolean {
    return this.ready;
  }

  async showRewarded(): Promise<boolean> {
    if (!this.ready) return false;
    if (!this.loaded) await this.load();
    if (!this.loaded) return false;
    let earned = false;
    const sub = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; });
    try {
      this.loaded = false;
      const item = await AdMob.showRewardVideoAd();
      if (item && item.amount > 0) earned = true;
    } catch {
      /* closed early or failed: no reward */
    } finally {
      await sub.remove();
      void this.load(); // get the next one ready
    }
    return earned;
  }
}

export class StorePurchases implements Purchases {
  private catalog = new StubPurchases().products();
  private store = new Map<string, PurchasesStoreProduct>();

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await RC.configure({ apiKey: ios() ? STORE_KEYS.revenuecat.ios : STORE_KEYS.revenuecat.android });
      const { products } = await RC.getProducts({ productIdentifiers: this.catalog.map((p) => p.id), type: PRODUCT_CATEGORY.NON_SUBSCRIPTION });
      for (const p of products) this.store.set(p.identifier, p);
    } catch {
      /* store not reachable: packs show as unavailable */
    }
  }

  /** The packs, with real local prices from the store once they've loaded. */
  products(): Product[] {
    return this.catalog.map((p) => ({ ...p, price: this.store.get(p.id)?.priceString ?? p.price }));
  }

  async buy(productId: string) {
    const product = this.products().find((x) => x.id === productId);
    const sp = this.store.get(productId);
    if (!product || !sp) return { ok: false };
    try {
      await RC.purchaseStoreProduct({ product: sp });
      return { ok: true, product };
    } catch {
      return { ok: false }; // cancelled or failed: nothing charged
    }
  }
}
