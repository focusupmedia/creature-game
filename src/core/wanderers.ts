// Wanderers: travellers who drop by one of your worlds while you're playing.
// Four are friendly (tap to meet them); the Goblin causes mischief unless you
// tap him first. They only arrive during live play, so nobody robs you while
// you're away.

import { DIG_KINDS, RESONANCES } from '../content/world';
import { WANDERERS, WANDERER_ORDER } from '../content/wanderers';
import { ISLAND_ORDER, islandGeo, randomLand } from '../content/islands';
import { TUNING } from '../content/tuning';
import { species } from '../content/species';
import { newId } from './creatures';
import { addNote } from './journal';
import type { StateRng } from './rng';
import type { DigKind, GameEvent, GameState, IslandId, WandererKind } from './types';

const MIN = 60_000;

function nextVisit(t: number, rng: StateRng): number {
  return t + TUNING.wandererEveryMin * MIN * (0.6 + rng.next() * 0.8);
}

export function stepWanderer(state: GameState, t: number, rng: StateRng, out: GameEvent[], live: boolean, here?: IslandId): void {
  const w = state.wanderer;
  if (w) {
    if (t < w.until) return;
    state.wanderer = null;
    state.wandererNextAt = nextVisit(t, rng);
    if (w.kind === 'goblin' && live) out.push(goblinMischief(state, t, rng));
    else out.push({ type: 'wandererLeft', kind: w.kind, t });
    return;
  }
  if (!live || t < state.wandererNextAt) return;
  const owned = ISLAND_ORDER.filter((id) => state.islands[id]?.owned);
  // usually where you are, so you actually see them
  const island = here && owned.includes(here) && rng.chance(0.8) ? here : rng.pick(owned);
  // the Goblin only bothers keepers who have something worth taking
  const kinds = WANDERER_ORDER.filter((k) => k !== 'goblin' || state.glimmer >= 40 || Object.values(state.spots).some(Boolean));
  const kind = rng.weighted(kinds.map((k) => [k, WANDERERS[k].weight] as [WandererKind, number]))!;
  const p = randomLand(islandGeo(island, state.islands[island]?.size ?? 0), () => rng.next());
  state.wanderer = { kind, island, x: p.x, z: p.z, arrivedAt: t, until: t + WANDERERS[kind].stayMin * MIN };
  out.push({ type: 'wanderer', wanderer: state.wanderer, t });
}

/** He wasn't stopped in time: pinch some coins, or spoil a lure. */
function goblinMischief(state: GameState, t: number, rng: StateRng): GameEvent {
  const lures = Object.entries(state.spots).filter(([, l]) => l).map(([id]) => id);
  if (lures.length && (rng.chance(0.5) || state.glimmer < 20)) {
    const spot = rng.pick(lures);
    state.spots[spot] = null;
    return { type: 'goblin', did: 'lure', spot, t };
  }
  const coins = Math.min(state.glimmer, Math.max(5, Math.min(60, Math.round(state.glimmer * 0.05))));
  if (!coins) return { type: 'goblin', did: 'nothing', t };
  state.glimmer -= coins;
  return { type: 'goblin', did: 'coins', coins, t };
}

export type MeetResult = { ok: true; kind: WandererKind; message: string } | { ok: false; error: string };

/** You tapped the wanderer. Friendly ones help out, then go on their way; the Goblin runs off. */
export function meetWanderer(state: GameState, t: number, rng: StateRng): MeetResult {
  const w = state.wanderer;
  if (!w) return { ok: false, error: 'They\'ve gone.' };
  state.wanderer = null;
  state.wandererNextAt = nextVisit(t, rng);
  switch (w.kind) {
    case 'fortune': {
      const open = RESONANCES.filter((r) => !state.journal.species[r.result] && !r.sky);
      if (!open.length) {
        state.glimmer += 20;
        return { ok: true, kind: w.kind, message: '"I see… a keeper who has found everything. Remarkable!" She leaves you 20 coins.' };
      }
      const rule = rng.pick(open);
      const kin = rule.requires.map((x) => `${x}`).join(' and ');
      const text = `The Fortune Teller saw ${kin} kin side by side, and an egg like none you've seen (${species(rule.result).rarity}).`;
      addNote(state, `fortune-${rule.id}`, text, t);
      return { ok: true, kind: w.kind, message: `"I see ${kin} kin, side by side… and an egg like none you've seen." (Saved in your journal.)` };
    }
    case 'treasure': {
      const g = islandGeo(w.island, state.islands[w.island]?.size ?? 0);
      const kinds = (Object.keys(DIG_KINDS) as DigKind[]).filter((k) => DIG_KINDS[k].islands[w.island]);
      for (let i = 0; i < 2; i++) {
        const p = randomLand(g, () => rng.next());
        const spot = { id: newId(state, 'd'), kind: rng.pick(kinds), island: w.island, x: p.x, z: p.z, expiresAt: t + TUNING.digSpotLifeMin * MIN };
        state.digSpots.push(spot);
      }
      return { ok: true, kind: w.kind, message: '"X marks the spot!" He marked two new dig spots. Drop a creature on one to dig.' };
    }
    case 'chef': {
      const berries = state.food.fruit ?? 0;
      const fancy = berries >= 2;
      if (fancy) state.food.fruit = berries - 2;
      for (const c of state.creatures) {
        if (c.island === w.island && !c.stored) c.fullness = fancy ? 1 : Math.min(1, c.fullness + 0.5);
      }
      return { ok: true, kind: w.kind, message: fancy
        ? 'He cooked a berry feast with 2 of your berries. Everyone here is full and happy!'
        : 'He cooked a simple stew and everyone here had a bowl. (Bring berries next time for a feast!)' };
    }
    case 'gnome': {
      const trees = (state.decorOwned.fruittree ?? 0) + state.placedDecor.filter((d) => d.decor === 'fruittree').length;
      if (trees < 4) {
        state.decorOwned.fruittree = (state.decorOwned.fruittree ?? 0) + 1;
        return { ok: true, kind: w.kind, message: 'He gave you a Berry Tree sapling! Find it in Decor and plant it anywhere.' };
      }
      state.food.snack = (state.food.snack ?? 0) + 3;
      return { ok: true, kind: w.kind, message: 'He gave you 3 snacks from his garden.' };
    }
    default:
      state.glimmer += 5;
      return { ok: true, kind: w.kind, message: 'You scared the Goblin off! He dropped 5 coins as he ran.' };
  }
}
