import { describe, expect, it } from 'vitest';
import { decideSync, isFresh, summarize, type SaveSummary } from '../src/core/cloud';
import { deserialize, serialize } from '../src/core/save';
import { SAVE_VERSION, createGame } from '../src/core/state';

const T = Date.UTC(2026, 9, 3, 12);
const sum = (o: Partial<SaveSummary>): SaveSummary => ({
  saveId: 'a', version: SAVE_VERSION, savedAt: T, level: 12, creatures: 20, species: 18, coins: 500, shards: 20, worlds: 3, device: 'x', ...o,
});

describe('cloud save decisions', () => {
  it('uploads when the cloud is empty or only this device moved on', () => {
    expect(decideSync(sum({}), undefined, null).kind).toBe('upload');
    expect(decideSync(sum({ savedAt: T + 5000 }), T, sum({ savedAt: T })).kind).toBe('upload');
    expect(decideSync(sum({ savedAt: T }), T, sum({ savedAt: T })).kind).toBe('none');
  });

  it('downloads quietly when only the cloud moved on (the other phone played)', () => {
    expect(decideSync(sum({ savedAt: T }), T, sum({ savedAt: T + 9000 }))).toEqual({ kind: 'download', quiet: true });
  });

  it('asks when both devices played since the last sync', () => {
    expect(decideSync(sum({ savedAt: T + 4000 }), T, sum({ savedAt: T + 9000 })).kind).toBe('ask');
  });

  it('a brand-new game offers to restore a real save; a real save is never replaced by a new game', () => {
    const fresh = sum({ saveId: 'new', level: 1, species: 3, worlds: 1 });
    expect(isFresh(fresh)).toBe(true);
    expect(decideSync(fresh, undefined, sum({}))).toEqual({ kind: 'download', quiet: false });
    expect(decideSync(sum({}), undefined, fresh).kind).toBe('upload');
    expect(decideSync(sum({}), undefined, sum({ saveId: 'other' })).kind).toBe('ask');
  });

  it('never touches a save from a newer version of the game', () => {
    expect(decideSync(sum({}), T, sum({ version: SAVE_VERSION + 1, savedAt: T + 1 })).kind).toBe('update-needed');
  });

  it('every game has a save id, kept through saving and loading', () => {
    const s = createGame(T, 77);
    expect(s.cloud?.saveId).toBeTruthy();
    const back = deserialize(serialize(s, T));
    expect(back.cloud?.saveId).toBe(s.cloud?.saveId);
    expect(summarize(back, 'phone')).toMatchObject({ saveId: s.cloud?.saveId, level: 1, device: 'phone' });
  });

  it('older saves get a save id when they load', () => {
    const s = createGame(T, 78);
    const raw = JSON.parse(serialize(s, T));
    raw.version = 13;
    delete raw.cloud;
    expect(deserialize(JSON.stringify(raw)).cloud?.saveId).toBeTruthy();
  });
});
