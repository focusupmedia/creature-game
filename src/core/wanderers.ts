// Wanderers: travellers who drop by one of your worlds while you're playing.
// Four are friendly (tap to meet them); the Goblin causes mischief unless you
// tap him first. They only arrive during live play, so nobody robs you while
// you're away.

import { DIG_KINDS, EGG_TIERS, EVENTS, FOODS, RESONANCES, SKY_ITEMS } from '../content/world';
import { DECOR_LIST } from '../content/decor';
import { WANDERERS, WANDERER_ORDER } from '../content/wanderers';
import { ISLAND_ORDER, islandGeo, randomLand } from '../content/islands';
import { TUNING } from '../content/tuning';
import { species } from '../content/species';
import { displayName, newId } from './creatures';
import { addNote } from './journal';
import { canSell } from './care';
import { levelOf } from './levels';
import { layEgg, rollEggTier, upcomingEvents } from './actions';
import { hash01, type StateRng } from './rng';
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

// ---------------------------------------------------------------- keeper menus
// Every friendly wanderer has a little menu: a free kindness, and a few deals
// that fit who they are. Each deal can be taken once per visit. The Goblin has
// no menu: tap him and he runs.

export interface WandererDeal {
  id: string;
  label: string;
  desc: string;
  coins?: number;
  shards?: number;
  /** Needs you to pick one of your pets. */
  needsPet?: boolean;
  /** Free kindness (the first thing on the menu). */
  free?: boolean;
}

/** The deals a wanderer offers on this visit (they can vary visit to visit). */
export function wandererDeals(state: GameState, w: NonNullable<GameState['wanderer']>): WandererDeal[] {
  const lvl = levelOf(state.xp);
  switch (w.kind) {
    case 'fortune': return [
      { id: 'hint', label: 'A free reading', desc: 'A hint about a pairing you haven\'t tried yet.', free: true },
      { id: 'deep', label: 'A deep reading', desc: 'The full secret of a Mythical: who to pair, and under which sky.', shards: 12 },
      { id: 'sky', label: 'Read the sky', desc: 'She tells you the next three sky events and when they come.', coins: 60 + lvl * 10 },
      { id: 'charm', label: 'A lucky charm', desc: 'A Wild Sky Charm at her special price (Mango asks more).', shards: 40 },
    ];
    case 'treasure': return [
      { id: 'mark', label: 'Mark some spots', desc: 'Two new dig spots on this world.', free: true },
      { id: 'map', label: 'Buy a treasure map', desc: 'Five dig spots at once, all over this world.', coins: 150 + lvl * 15 },
      { id: 'trade', label: 'Trade a pet for an egg', desc: 'He takes a pet you can spare and hands you a mystery egg from his travels (rarer pets get better eggs).', needsPet: true },
    ];
    case 'chef': return [
      { id: 'cook', label: 'Cook for everyone', desc: 'A stew for every pet on this world (bring 2 berries and it\'s a full feast).', free: true },
      { id: 'feast', label: 'Feast Basket, cheap', desc: `A Feast Basket for less than Mango's ${FOODS.feast.price}.`, coins: Math.round(FOODS.feast.price * 0.7) },
      { id: 'snacks', label: 'Bag of 5 snacks', desc: 'Crunchy snacks from his pot, a bargain.', coins: Math.round(FOODS.snack.price * 5 * 0.7) },
      { id: 'berries', label: 'Sell him your berries', desc: `He pays 10 coins a berry. You have ${state.food.fruit ?? 0}.` },
    ];
    case 'gnome': {
      const picks = gnomeDecor(state, w);
      return [
        { id: 'gift', label: 'A gift from the garden', desc: 'A Berry Tree sapling, or snacks if you have plenty of trees.', free: true },
        ...picks.map((d) => ({ id: `decor-${d.id}`, label: d.name, desc: `${d.blurb} (Garden price, a quarter off.)`, coins: Math.round(d.price * 0.75) })),
        { id: 'ripen', label: 'Ripen every Berry Tree', desc: 'A little gnome magic: every Berry Tree you own is full of berries right now.', coins: 80 },
      ];
    }
    default: return [];
  }
}

/** Two nature decorations the gnome brought this visit (unlocked ones only). */
function gnomeDecor(state: GameState, w: NonNullable<GameState['wanderer']>) {
  // chosen once per visit, so a level-up mid-visit doesn't reshuffle the menu
  if (w.picks) return w.picks.map((id) => DECOR_LIST.find((d) => d.id === id)!).filter(Boolean);
  const lvl = levelOf(state.xp);
  const pool = DECOR_LIST.filter((d) => d.cat === 'nature' && d.currency !== 'shards' && (d.level ?? 1) <= lvl && d.id !== 'fruittree');
  if (!pool.length) return [];
  const a = pool[Math.floor(hash01(w.arrivedAt, 1) * pool.length) % pool.length];
  const b = pool.filter((d) => d !== a)[Math.floor(hash01(w.arrivedAt, 2) * (pool.length - 1)) % Math.max(1, pool.length - 1)];
  const picks = b ? [a, b] : [a];
  w.picks = picks.map((d) => d.id);
  return picks;
}

export type DealResult = { ok: true; message: string; eggId?: string } | { ok: false; error: string };

/** Take one of a wanderer's deals. */
export function takeDeal(state: GameState, dealId: string, t: number, rng: StateRng, petId?: string): DealResult {
  const w = state.wanderer;
  if (!w || w.kind === 'goblin') return { ok: false, error: 'They\'ve gone.' };
  const deal = wandererDeals(state, w).find((d) => d.id === dealId);
  if (!deal) return { ok: false, error: 'That\'s not on offer.' };
  if (w.done?.includes(dealId)) return { ok: false, error: 'You already did that this visit.' };
  if ((deal.coins ?? 0) > state.glimmer) return { ok: false, error: 'Not enough coins.' };
  if ((deal.shards ?? 0) > state.shards) return { ok: false, error: 'Not enough Starshards.' };
  let message = '';
  let eggId: string | undefined;
  switch (`${w.kind}:${dealId.startsWith('decor-') ? 'decor' : dealId}`) {
    case 'fortune:hint':
    case 'treasure:mark':
    case 'chef:cook':
    case 'gnome:gift': {
      // the old one-tap kindness, now without sending them away
      const next = state.wandererNextAt;
      const r = meetWanderer(state, t, rng);
      state.wanderer = w;
      state.wandererNextAt = next;
      if (!r.ok) return r;
      message = r.message;
      break;
    }
    case 'fortune:deep': {
      const open = RESONANCES.filter((r) => r.sky && !state.journal.species[r.result]);
      const rule = open.length ? rng.pick(open) : rng.pick(RESONANCES.filter((r) => r.sky));
      const text = `Madame Mystra's secret: ${rule.requires.join(' + ')} kin${rule.both ? ` (both ${rule.both})` : ''}, bred during a ${EVENTS[rule.sky!].name}, can hatch a ${species(rule.result).name}.`;
      addNote(state, `deep-${rule.id}`, text, t);
      message = `"${rule.requires.join(' and ')} kin, beneath a ${EVENTS[rule.sky!].name.toLowerCase()}… a ${species(rule.result).name}." (Saved in your journal.)`;
      break;
    }
    case 'fortune:sky': {
      const next = upcomingEvents(state, t, 3);
      const mins = (ms: number) => `${Math.max(1, Math.round(ms / 60_000))} min`;
      message = next.length ? `"The sky will bring ${next.map((e) => `${EVENTS[e.kind].name} in ${mins(e.start - t)}`).join(', then ')}."` : '"The sky is quiet for now."';
      addNote(state, `sky-${t}`, `Madame Mystra read the sky: ${message}`, t);
      break;
    }
    case 'fortune:charm':
      state.charms ??= {};
      state.charms.wildcharm = (state.charms.wildcharm ?? 0) + 1;
      message = `A ${SKY_ITEMS.wildcharm.name}! Break it from the EVENT button.`;
      break;
    case 'treasure:map': {
      const g = islandGeo(w.island, state.islands[w.island]?.size ?? 0);
      const kinds = (Object.keys(DIG_KINDS) as DigKind[]).filter((k) => DIG_KINDS[k].islands[w.island]);
      for (let i = 0; i < 5; i++) {
        const p = randomLand(g, () => rng.next());
        state.digSpots.push({ id: newId(state, 'd'), kind: rng.pick(kinds), island: w.island, x: p.x, z: p.z, expiresAt: t + TUNING.digSpotLifeMin * MIN });
      }
      message = 'Five X marks on the map! Drop your creatures on the dig spots.';
      break;
    }
    case 'treasure:trade': {
      const c = state.creatures.find((x) => x.id === petId);
      if (!c) return { ok: false, error: 'Pick a pet to trade.' };
      const why = canSell(state, c);
      if (why) return { ok: false, error: why };
      const r = species(c.species).rarity;
      const tier = r === 'common' ? 'wild' : 'starry';
      if (state.eggs.filter((e) => e.nest === null).length >= TUNING.basketSize) return { ok: false, error: 'Your egg basket is full.' };
      state.creatures = state.creatures.filter((x) => x !== c);
      const egg = layEgg(state, rollEggTier(state, tier), 'shop', t);
      egg.tier = tier;
      eggId = egg.id;
      message = `He tipped his hat to ${displayName(c)} and handed you a ${EGG_TIERS[tier].name}. It's waiting with your eggs.`;
      break;
    }
    case 'chef:feast':
      state.food.feast = (state.food.feast ?? 0) + 1;
      message = 'A Feast Basket, still warm. Use it from the Food list.';
      break;
    case 'chef:snacks':
      state.food.snack = (state.food.snack ?? 0) + 5;
      message = 'Five crunchy snacks added to your pantry.';
      break;
    case 'chef:berries': {
      const n = state.food.fruit ?? 0;
      if (!n) return { ok: false, error: 'You have no berries. Pick some from a Berry Tree.' };
      state.food.fruit = 0;
      state.glimmer += n * 10;
      message = `He bought ${n} ${n === 1 ? 'berry' : 'berries'} for ${n * 10} coins.`;
      break;
    }
    case 'gnome:decor': {
      const id = dealId.slice('decor-'.length);
      state.decorOwned[id] = (state.decorOwned[id] ?? 0) + 1;
      message = `${deal.label} is ready to place from your Decor.`;
      break;
    }
    case 'gnome:ripen': {
      const trees = state.placedDecor.filter((d) => d.decor === 'fruittree');
      if (!trees.length) return { ok: false, error: 'You have no Berry Trees planted yet.' };
      for (const d of trees) d.harvestedAt = t - TUNING.fruitMax * TUNING.fruitEveryMin * MIN;
      message = `All ${trees.length} Berry Tree${trees.length === 1 ? ' is' : 's are'} heavy with berries!`;
      break;
    }
    default: return { ok: false, error: 'That\'s not on offer.' };
  }
  state.glimmer -= deal.coins ?? 0;
  state.shards -= deal.shards ?? 0;
  w.done = [...(w.done ?? []), dealId];
  // a good chat makes them stay a little longer
  w.until = Math.max(w.until, t + 2 * MIN);
  return { ok: true, message, eggId };
}

/** Say goodbye to a friendly wanderer. */
export function dismissWanderer(state: GameState, t: number, rng: StateRng): void {
  if (!state.wanderer) return;
  state.wanderer = null;
  state.wandererNextAt = nextVisit(t, rng);
}
