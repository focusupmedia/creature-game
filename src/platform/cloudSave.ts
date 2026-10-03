// Cloud save transport. The game uses the platform's own saved-games service:
//   iPhone / iPad -> Game Center saved games (stored in the player's iCloud)
//   Android       -> Google Play Games saved games
// Players are signed in automatically when the game starts (Game Center and
// Play Games both do this); anyone who isn't can link from Settings.
//
// The native side is a small Capacitor plugin named "CloudSave" (see
// docs/CLOUD_SAVE.md). In the web playtest build there is no native plugin,
// so a pretend cloud in this browser's storage stands in for it.

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { CloudBlob } from '../core/cloud';

export interface CloudStatus {
  available: boolean;
  signedIn: boolean;
  /** "Game Center", "Google Play Games" or "Test cloud". */
  service: string;
  /** The player's account name, when the service shares it. */
  account?: string;
}

export interface CloudSave {
  status(): Promise<CloudStatus>;
  /** Show the service's sign-in. Resolves true once signed in. */
  signIn(): Promise<boolean>;
  load(): Promise<CloudBlob | null>;
  save(blob: CloudBlob): Promise<boolean>;
}

/** The native plugin's surface (implemented in Swift and Kotlin). */
interface CloudSavePlugin {
  status(): Promise<{ available: boolean; signedIn: boolean; account?: string }>;
  signIn(): Promise<{ signedIn: boolean }>;
  load(options: { slot: string }): Promise<{ found: boolean; data?: string; summary?: string }>;
  save(options: { slot: string; data: string; summary: string; description: string }): Promise<{ ok: boolean }>;
}

const SLOT = 'kindred-grove-main';

class NativeCloudSave implements CloudSave {
  private plugin = registerPlugin<CloudSavePlugin>('CloudSave');
  private service = Capacitor.getPlatform() === 'ios' ? 'Game Center' : 'Google Play Games';

  async status(): Promise<CloudStatus> {
    try {
      const s = await this.plugin.status();
      return { ...s, service: this.service };
    } catch {
      return { available: false, signedIn: false, service: this.service };
    }
  }

  async signIn(): Promise<boolean> {
    try {
      return (await this.plugin.signIn()).signedIn;
    } catch {
      return false;
    }
  }

  async load(): Promise<CloudBlob | null> {
    const r = await this.plugin.load({ slot: SLOT });
    if (!r.found || !r.data || !r.summary) return null;
    return { data: r.data, summary: JSON.parse(r.summary) };
  }

  async save(blob: CloudBlob): Promise<boolean> {
    const s = blob.summary;
    const r = await this.plugin.save({
      slot: SLOT, data: blob.data, summary: JSON.stringify(s),
      description: `Level ${s.level} · ${s.creatures} creatures`,
    });
    return r.ok;
  }
}

const TEST_KEY = 'kindred-grove.testcloud';
const TEST_SIGNED_IN = 'kindred-grove.testcloud.signedin';

/** Web playtest stand-in: the "cloud" is a separate slot in this browser's storage. */
export class TestCloudSave implements CloudSave {
  private get signedIn(): boolean {
    try { return localStorage.getItem(TEST_SIGNED_IN) === '1'; } catch { return false; }
  }

  async status(): Promise<CloudStatus> {
    return { available: true, signedIn: this.signedIn, service: 'Test cloud', account: this.signedIn ? 'Playtest keeper' : undefined };
  }

  async signIn(): Promise<boolean> {
    try { localStorage.setItem(TEST_SIGNED_IN, '1'); } catch { return false; }
    return true;
  }

  async load(): Promise<CloudBlob | null> {
    if (!this.signedIn) return null;
    try {
      const raw = localStorage.getItem(TEST_KEY);
      return raw ? (JSON.parse(raw) as CloudBlob) : null;
    } catch {
      return null;
    }
  }

  async save(blob: CloudBlob): Promise<boolean> {
    if (!this.signedIn) return false;
    try {
      localStorage.setItem(TEST_KEY, JSON.stringify(blob));
      return true;
    } catch {
      return false;
    }
  }

  /** Playtest tool: pretend another phone played on and saved. */
  write(blob: CloudBlob): void {
    try { localStorage.setItem(TEST_KEY, JSON.stringify(blob)); } catch { /* ignore */ }
  }
}

export function createCloudSave(): CloudSave {
  return Capacitor.isNativePlatform() ? new NativeCloudSave() : new TestCloudSave();
}

/** A short name for this device on the "pick a save" card. */
export function deviceName(): string {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return /iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone';
  if (p === 'android') return 'Android phone';
  return 'This browser';
}
