// Cloud save: decide what to do when this device's save and the one in the
// player's iCloud / Google Play account meet. Pure logic; the platform layer
// (platform/cloudSave.ts) moves the bytes.
//
// Every game has a saveId. A device remembers when it last synced with the
// cloud (cloud.syncedAt). From that we can tell who has moved on since:
//   - only this device  -> upload
//   - only the cloud    -> download
//   - both              -> ask the player, showing both saves side by side
// A brand-new game (or one that has barely started) never blocks a real save
// from coming back: it is replaced without asking.

import { levelOf } from './levels';
import { SAVE_VERSION } from './state';
export { newSaveId } from './state';
import type { GameState, IslandId } from './types';

export interface SaveSummary {
  saveId: string;
  version: number;
  savedAt: number;
  level: number;
  creatures: number;
  species: number;
  coins: number;
  shards: number;
  worlds: number;
  /** Which device saved it, for the "pick a save" card. */
  device: string;
  /** Progress fingerprint (changes only when the player does something). Older saves lack it. */
  sig?: string;
}

/** Changes when the player makes progress, but not when the game is just opened and autosaved. */
export function progressSig(state: GameState): string {
  return `${state.xp}|${state.glimmer}|${state.shards}|${Object.keys(state.journal.species).length}`;
}

export interface CloudBlob {
  /** The serialized save. */
  data: string;
  summary: SaveSummary;
}

export type SyncDecision =
  | { kind: 'none' }
  | { kind: 'upload' }
  | { kind: 'download'; quiet: boolean }
  | { kind: 'ask' }
  /** The cloud save was made by a newer version of the game: leave it alone. */
  | { kind: 'update-needed' };

export function summarize(state: GameState, device: string): SaveSummary {
  return {
    saveId: state.cloud?.saveId ?? '',
    version: SAVE_VERSION,
    savedAt: state.savedAt,
    level: levelOf(state.xp),
    creatures: state.creatures.length,
    species: Object.keys(state.journal.species).length,
    coins: state.glimmer,
    shards: state.shards,
    worlds: (Object.keys(state.islands) as IslandId[]).filter((k) => state.islands[k]?.owned).length,
    device,
    sig: progressSig(state),
  };
}

/** A game that has barely begun: nothing worth asking about. */
export function isFresh(s: SaveSummary): boolean {
  return s.level <= 2 && s.species <= 4 && s.worlds <= 1;
}

/**
 * What to do now. `local` is this device's save; `syncedAt` is when this
 * device last matched the cloud (undefined if never).
 */
export function decideSync(local: SaveSummary, syncedAt: number | undefined, cloud: SaveSummary | null, syncedSig?: string): SyncDecision {
  if (!cloud) return { kind: 'upload' };
  if (cloud.version > SAVE_VERSION) return { kind: 'update-needed' };
  if (cloud.saveId === local.saveId) {
    const cloudMoved = syncedAt === undefined || cloud.savedAt > syncedAt;
    // every launch autosaves, so the save time alone would always say "moved on"
    const localMoved = syncedAt === undefined || (syncedSig !== undefined && local.sig !== undefined ? local.sig !== syncedSig : local.savedAt > syncedAt);
    if (!cloudMoved) return localMoved ? { kind: 'upload' } : { kind: 'none' };
    if (!localMoved) return { kind: 'download', quiet: true };
    // same game, both played since the last sync (two devices, or offline play)
    if (cloud.savedAt === local.savedAt) return { kind: 'none' };
    return { kind: 'ask' };
  }
  // a different game: one started on another device, or a reinstall
  if (isFresh(local)) return { kind: 'download', quiet: false };
  if (isFresh(cloud)) return { kind: 'upload' };
  return { kind: 'ask' };
}
