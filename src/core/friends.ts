// Friends without a server: each keeper has a friend code that holds a small
// snapshot of their grove (name, level, best pets). Paste a friend's code to
// add them, visit their grove and collect a small daily gift from them.
// Sharing your code again later updates what friends see.

import { SPECIES } from '../content/species';
import { MUTATIONS } from '../content/world';
import { levelOf } from './levels';
import { StateRng } from './rng';
import { today } from './quests';
import type { Friend, GameState, MutationId } from './types';

export const MAX_FRIENDS = 30;
export const GIFTS_PER_DAY = 5;
export const FRIEND_GIFT = { coins: 60, food: 'snack' as const };

const RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3, mythical: 4 };
const MUT_IDS = Object.keys(MUTATIONS);
const SHADES = ['classic', 'shiny', 'pastel'];

export function keeperId(state: GameState): string {
  if (!state.keeperId) {
    const rng = new StateRng(state);
    state.keeperId = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(rng.next() * 32)]).join('');
  }
  return state.keeperId;
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

/** My friend code: favourites first, then my rarest pets. */
export function myFriendCode(state: GameState): string {
  const pets = state.creatures
    .filter((c) => !c.trip)
    .map((c) => {
      const sp = SPECIES.findIndex((s) => s.id === c.species);
      return { c, sp, rank: (c.favorite ? 10 : 0) + (RANK[SPECIES[sp]?.rarity ?? 'common'] ?? 0) + c.mutations.length * 0.5 };
    })
    .filter((x) => x.sp >= 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 8)
    .map(({ c, sp }) => [sp, c.mutations.map((m) => MUT_IDS.indexOf(m)).filter((i) => i >= 0), Math.max(0, SHADES.indexOf(c.shade ?? 'classic')), Math.round(c.size * 100), c.nickname ?? '']);
  const found = Object.keys(state.journal.species).length;
  const data = [1, keeperId(state), (state.keeperName ?? 'Keeper').slice(0, 20), levelOf(state.xp), found, pets];
  return `PG-${b64(JSON.stringify(data))}`;
}

/** Read a friend code. Returns null if it isn't one. */
export function readFriendCode(code: string, t: number): Friend | null {
  const m = code.trim().match(/PG-([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const [v, id, name, level, found, pets] = JSON.parse(unb64(m[1]));
    if (v !== 1 || typeof id !== 'string' || !Array.isArray(pets)) return null;
    return {
      id: id.slice(0, 12), name: String(name).slice(0, 20) || 'Keeper', level: Math.max(1, Math.min(100, Number(level) || 1)), found: Math.max(0, Number(found) || 0),
      pets: pets.slice(0, 8).filter((p: unknown[]) => SPECIES[Number(p[0])]).map((p: unknown[]) => ({
        species: SPECIES[Number(p[0])].id,
        mutations: (Array.isArray(p[1]) ? p[1] : []).map((i: number) => MUT_IDS[i]).filter(Boolean) as MutationId[],
        shade: SHADES[Number(p[2])] ?? 'classic',
        size: Math.max(0.3, Math.min(3, Number(p[3]) / 100 || 1)),
        name: p[4] ? String(p[4]).slice(0, 20) : undefined,
      })),
      addedAt: t, updatedAt: t,
    };
  } catch {
    return null;
  }
}

/** Add (or update) a friend from their code. */
export function addFriend(state: GameState, code: string, t: number): { ok: true; friend: Friend; updated: boolean } | { ok: false; error: string } {
  const f = readFriendCode(code, t);
  if (!f) return { ok: false, error: 'That doesn\'t look like a friend code. It starts with PG-' };
  if (f.id === keeperId(state)) return { ok: false, error: 'That\'s your own code! Share it with a friend.' };
  const list = (state.friends ??= []);
  const old = list.find((x) => x.id === f.id);
  if (old) { Object.assign(old, { ...f, addedAt: old.addedAt }); return { ok: true, friend: old, updated: true }; }
  if (list.length >= MAX_FRIENDS) return { ok: false, error: `You can have up to ${MAX_FRIENDS} friends.` };
  list.push(f);
  return { ok: true, friend: f, updated: false };
}

export function removeFriend(state: GameState, id: string): void {
  state.friends = (state.friends ?? []).filter((f) => f.id !== id);
}

function gifts(state: GameState, t: number) {
  const day = today(t);
  if (state.friendGifts?.day !== day) state.friendGifts = { day, from: [] };
  return state.friendGifts;
}

export function canCollectGift(state: GameState, id: string, t: number): boolean {
  const g = gifts(state, t);
  return !g.from.includes(id) && g.from.length < GIFTS_PER_DAY && !!state.friends?.some((f) => f.id === id);
}

export function giftsLeft(state: GameState, t: number): number {
  const g = gifts(state, t);
  return Math.min(GIFTS_PER_DAY - g.from.length, (state.friends ?? []).filter((f) => !g.from.includes(f.id)).length);
}

/** A small gift from a friend, once a day each (up to five friends a day). */
export function collectGift(state: GameState, id: string, t: number): boolean {
  if (!canCollectGift(state, id, t)) return false;
  gifts(state, t).from.push(id);
  state.glimmer += FRIEND_GIFT.coins;
  state.food[FRIEND_GIFT.food] = (state.food[FRIEND_GIFT.food] ?? 0) + 1;
  return true;
}
