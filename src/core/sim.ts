// The world tick. Runs identically live (small steps) and offline (catch-up in
// larger steps), producing GameEvents that the renderer, UI, audio and
// analytics react to. "What happened while I was gone?" is just this function
// run over the gap.

import { species } from '../content/species';
import { DIG_KINDS, EVENTS, LURES, MUTATIONS, SPOTS, spotOpen } from '../content/world';
import { TUNING } from '../content/tuning';
import { ISLAND_ORDER, ISLANDS, SIZE_CAPACITY, islandGeo, randomLand } from '../content/islands';
import { addMutation, creatureTraits, displayName, growth, makeCreature, newId } from './creatures';
import { addHowTo, addNote, recordMutation, recordSpecies } from './journal';
import { arrivalChance, arrivalMutations, arrivalWeights, totemBoost, TOTEMS } from './lures';
import { StateRng } from './rng';
import { refreshShop } from './shop';
import { weekBoost } from '../content/weeks';
import { stepLegendary } from './legendary';
import { hasQuirk, temperOf } from './quirks';
import { stepCare } from './care';
import { startCombine } from './actions';
import { stepWanderer } from './wanderers';
import { findBonus } from './friendship';
import { stepExpeditions } from './expeditions';
import { freeNest } from './state';
import type { DigKind, EventKind, GameEvent, GameState, Gift, IslandId } from './types';
import { activeEvent, isDark } from './world';

const MIN = 60_000;

/** `live`: the keeper is playing right now (wanderers only come then); `here`: the world they're looking at. */
export function tick(state: GameState, now: number, opts: { maxStepMs?: number; live?: boolean; here?: IslandId } = {}): GameEvent[] {
  const out: GameEvent[] = [];
  // the journal remembers every behaviour trait you've seen on your own pets
  const seenQuirks = (state.journal.quirks ??= {});
  for (const c of state.creatures) for (const q of c.quirks ?? []) seenQuirks[q] ??= now;
  const maxStep = opts.maxStepMs ?? 1000;
  const cap = TUNING.offlineCapHours * 60 * MIN;
  if (now - state.lastTick > cap) state.lastTick = now - cap;
  let t = state.lastTick;
  while (t < now) {
    const dt = Math.min(maxStep, now - t);
    t += dt;
    step(state, t, dt, out, opts.live ?? false, opts.here);
  }
  state.lastTick = now;
  return out;
}

function step(state: GameState, t: number, dt: number, out: GameEvent[], live = false, here?: IslandId): void {
  const rng = new StateRng(state);
  const ev = activeEvent(state, t);
  const sky: EventKind | null = ev ? ev.kind : null;
  const dark = isDark(state, t);

  // ---- sky events
  if (ev) {
    const key = ev.key;
    const rec = (state.eventsApplied[key] ??= { kind: ev.kind, started: false, ended: false, touches: 0 });
    rec.touches ??= 0;
    if (!rec.started) {
      rec.started = true;
      state.journal.eventsSeen[ev.kind] = (state.journal.eventsSeen[ev.kind] ?? 0) + 1;
      out.push({ type: 'eventStart', kind: ev.kind, t, endsAt: ev.end });
      // Eggs feel the sky.
      const def = EVENTS[ev.kind];
      for (const egg of state.eggs) {
        if (egg.nest === null || egg.progressMs >= egg.incubationMs) continue;
        egg.witnessed.push(ev.kind);
        const native = species(egg.species).traits;
        if (!egg.mutations.includes(def.mutation) && !native.includes(MUTATIONS[def.mutation].trait)
          && rng.chance(def.eggMutationChance)) {
          egg.mutations.push(def.mutation);
          out.push({ type: 'eggTouched', egg, event: ev.kind, t });
        }
      }
    }
    skyTouch(state, ev.kind, t, dt, ev.end - ev.start, rec, rng, out);
    if (ev.kind === 'meteor') meteorRocks(state, t, dt, ev.end - ev.start, rng, out);
  }
  for (const [key, rec] of Object.entries(state.eventsApplied)) {
    if (rec.started && !rec.ended && (!ev || ev.key !== key)) {
      rec.ended = true;
      out.push({ type: 'eventEnd', kind: rec.kind, t });
    }
  }

  // ---- Nurseries make eggs from the pairs left in them (while you're away too)
  for (const d of state.placedDecor) {
    if (d.decor !== 'nursery' || !d.pair || (d.nextAt ?? Infinity) > t) continue;
    const island = d.island ?? 'home';
    const ok = d.pair.every((id) => state.creatures.some((c) => c.id === id && !c.stored && !c.trip && c.island === island));
    if (!ok) {
      d.pair = undefined;
      d.nextAt = undefined;
      continue;
    }
    // one egg waits by the Nursery at a time, ready to hatch (no nest needed)
    if (state.eggs.some((e) => e.nurseryId === d.id)) {
      d.nextAt = t + 10 * MIN;
      continue;
    }
    const r = startCombine(state, d.pair[0], d.pair[1], t, island, d.id);
    if (r.ok) {
      d.nextAt = t + TUNING.nurseryHours * 3_600_000;
      out.push({ type: 'nurseryEgg', egg: r.egg, island, t });
    } else d.nextAt = t + 10 * MIN;
  }

  // ---- rarity totems crumble away when their magic runs out
  if (state.placedDecor.some((d) => TOTEMS[d.decor] && (d.expiresAt ?? 0) <= t)) {
    for (const d of state.placedDecor.filter((x) => TOTEMS[x.decor] && (x.expiresAt ?? 0) <= t)) out.push({ type: 'totemDone', decor: d.decor, island: d.island ?? 'home', t });
    state.placedDecor = state.placedDecor.filter((d) => !(TOTEMS[d.decor] && (d.expiresAt ?? 0) <= t));
  }

  // ---- lures
  for (const spotId of Object.keys(SPOTS)) {
    const active = state.spots[spotId];
    if (!active) continue;
    if (!spotOpen(state.islands, spotId)) continue;
    const wk = weekBoost(t);
    const boost = totemBoost(state, SPOTS[spotId].island, t);
    // Lucky weeks nudge visitors toward the rarer end
    if (wk.lucky) { boost.rare = Math.max(boost.rare ?? 1, 1.3); boost.legendary = Math.max(boost.legendary ?? 1, 1.2); }
    const weights = arrivalWeights(active.lure, spotId, dark, sky, boost);
    if (weights.length === 0) {
      // Nothing that answers this scent is about: the lure waits instead of wasting.
      active.expiresAt += dt;
      continue;
    }
    if (t >= active.expiresAt) {
      state.spots[spotId] = null;
      out.push({ type: 'lureExpired', spot: spotId, t });
      continue;
    }
    let p = arrivalChance(active.lure, dt, sky);
    // this week's habitat lures are extra tempting
    if (wk.lureTrait && LURES[active.lure]?.attracts === wk.lureTrait) p *= 1.5;
    // a Lure Lover on this world makes lures a little more tempting
    if (state.creatures.some((c) => !c.stored && !c.trip && c.island === SPOTS[spotId].island && hasQuirk(c, 'lurelover'))) p *= 1.15;
    // First-ever lure (the tutorial): someone answers right away to keep the keeper's attention.
    const first = state.stats.arrivals === 0 && t - active.placedAt > 1500;
    if (first) p = 1;
    if (!rng.chance(p)) continue;
    // weights add up to at most 1: the rest of the time, nobody answers
    const total = weights.reduce((a, [, w]) => a + w, 0);
    if (!first && rng.next() > total) continue;
    const sp = rng.weighted(weights.map(([s, w]) => [s.id, w] as [string, number]));
    if (!sp) continue;
    const muts = arrivalMutations(active.lure, sky, rng);
    const lure = LURES[active.lure];
    const where = SPOTS[spotId].name;
    const when = sky ? ` during ${/^[aeiou]/i.test(EVENTS[sky].name) ? 'an' : 'a'} ${EVENTS[sky].name.toLowerCase()}` : dark ? ' in the dark of night' : '';
    const story = `Followed the scent of a ${lure.name} to the ${where}${when}.`;
    const island = SPOTS[spotId].island;
    const c = makeCreature(state, sp, muts, t, story, { island, met: { how: 'lure', lure: active.lure, spot: spotId, sky: state.legendary?.kind ?? sky } });
    c.arrivingAt = spotId;
    // a magic fog brings out the shy ones
    if (sky === 'fog' && rng.chance(0.5)) c.personality = 'shy';
    active.visitors += 1;
    state.stats.arrivals += 1;
    const discovered = recordSpecies(state, sp, t);
    for (const m of c.mutations) {
      if (recordMutation(state, m, t)) note(state, out, t, `mut-${m}`, `First ${m} creature seen.`);
    }
    if (sky && c.mutations.includes(EVENTS[sky].mutation)) {
      note(state, out, t, `lure-${active.lure}-${sky}`,
        `A ${lure.name} during a ${EVENTS[sky].name} drew a ${displayName(c)}. The sky seems to mark visitors.`);
    }
    if (dark && species(sp).activity === 'night') {
      note(state, out, t, `night-${active.lure}`, `${lure.name} attracts different visitors after dark.`);
    }
    // Visitors wait by the lure with a ! until you Keep them or Send them away.
    const here = state.visitors.filter((v) => v.spot === spotId);
    if (here.length >= TUNING.visitorsPerSpot) {
      const oldest = here[0];
      state.visitors = state.visitors.filter((v) => v !== oldest);
      out.push({ type: 'visitorLeft', creature: oldest.creature, t });
    }
    state.visitors.push({ creature: c, spot: spotId, island, until: t + TUNING.visitorWaitHours * 60 * MIN });
    addHowTo(state, sp, `${lure.name} at the ${SPOTS[spotId].name}${sky ? ` in a ${EVENTS[sky].name}` : ''}${dark ? ' after dark' : ''}`);
    out.push({ type: 'arrival', creature: c, spot: spotId, discovered, t });
  }
  for (const v of state.visitors) {
    if (t >= v.until) out.push({ type: 'visitorLeft', creature: v.creature, t });
  }
  state.visitors = state.visitors.filter((v) => t < v.until);

  // ---- eggs
  for (const egg of state.eggs) {
    if (egg.nest === null) continue;
    if (egg.progressMs >= egg.incubationMs) continue;
    egg.progressMs += dt;
    if (egg.progressMs >= egg.incubationMs) {
      egg.progressMs = egg.incubationMs;
      out.push({ type: 'eggReady', egg, t });
    }
  }
  for (const egg of state.eggs) {
    if (egg.nest !== null || egg.nurseryId) continue;
    const n = freeNest(state);
    if (n === null) break;
    egg.nest = n;
  }

  // ---- digging: residents dig things up, more or less often depending on personality
  if (state.creatures.length) {
    // hungry creatures don't dig; stored ones are away
    const diggers = state.creatures.filter((c) => !c.stored && !c.trip && growth(c, t) >= 0.5 && c.fullness >= TUNING.hungry);
    const rate1 = (c: (typeof diggers)[number]) => (TUNING.digRate[temperOf(c) ?? ''] ?? 1) * (hasQuirk(c, 'digger') ? 2 : 1) * (c.fullness >= TUNING.wellFed ? 1.25 : 1);
    const total = diggers.reduce((s, c) => s + rate1(c), 0);
    // Capped so hoarding creatures isn't an income strategy.
    const rate = Math.min(total, TUNING.giftResidentsCap) / (TUNING.giftEveryMin * MIN);
    const from = diggers.length && rng.chance(1 - Math.exp(-rate * dt)) ? rng.weighted(diggers.map((c) => [c, rate1(c)] as [typeof c, number])) : null;
    // each world has its own limit, so finds left lying on one world don't stop digging on the others
    if (from && state.gifts.filter((x) => x.island === from.island).length < TUNING.maxGiftsOnGround) {
      const g = islandGeo(from.island, state.islands[from.island]?.size ?? 0);
      const p = randomLand(g, () => rng.next());
      const [g0, g1] = TUNING.giftGlimmer;
      const curious = hasQuirk(from, 'curious') ? 2 : 1;
      const friend = findBonus(from);
      const lucky = hasQuirk(from, 'lucky') ? 2 : 1;
      const gift: Gift = {
        id: newId(state, 'g'), x: p.x, z: p.z, glimmer: Math.round(rng.int(g0, g1) * friend),
        shards: rng.chance(TUNING.giftShardChance * curious * lucky) ? 1 : 0, from: from.id, island: from.island,
      };
      if (lucky > 1) gift.glimmer = Math.round(gift.glimmer * 1.5);
      if (rng.chance(TUNING.digItemChance * curious)) gift.item = rng.chance(0.75) ? 'warmstone' : 'rootswell';
      else if (rng.chance(TUNING.digEggChance * curious) && state.eggs.filter((e) => e.nest === null && !e.nurseryId).length < TUNING.basketSize) {
        gift.item = 'egg';
      }
      state.gifts.push(gift);
      out.push({ type: 'gift', gift, t });
    }
  }

  // ---- dig spots: little signs on the ground that ask for a creature to be dropped on them
  state.digSpots = state.digSpots.filter((d) => d.expiresAt > t);
  for (const id of ISLAND_ORDER) {
    if (!state.islands[id]?.owned) continue;
    if (state.digSpots.filter((d) => d.island === id).length >= TUNING.digSpotMax) continue;
    if (!rng.chance(1 - Math.exp(-dt / (TUNING.digSpotEveryMin * MIN)))) continue;
    const kind = rng.weighted((Object.keys(DIG_KINDS) as DigKind[]).map((k) => [k, DIG_KINDS[k].islands[id] ?? 0] as [DigKind, number]));
    if (!kind) continue;
    const g = islandGeo(id, state.islands[id]?.size ?? 0);
    const p = randomLand(g, () => rng.next());
    if (state.digSpots.some((d) => Math.hypot(d.x - p.x, d.z - p.z) < 2.5)) continue;
    const spot = { id: newId(state, 'd'), kind, island: id, x: p.x, z: p.z, expiresAt: t + TUNING.digSpotLifeMin * MIN };
    state.digSpots.push(spot);
    out.push({ type: 'digSpot', spot, t });
  }

  // ---- hunger, feedbags and the Collector
  stepCare(state, t, dt, rng, out);

  // ---- legendary events (very rare)
  stepLegendary(state, t, dt, rng, out);

  // ---- pets coming home from expeditions
  stepExpeditions(state, t, out);

  // ---- wanderers (only while you're playing)
  stepWanderer(state, t, rng, out, live, here);

  // ---- shop rotation
  if (t >= state.shop.nextRefreshAt) {
    refreshShop(state, t);
    out.push({ type: 'shopRefresh', t });
  }
}

/**
 * The sky reaches down to one resident: sparkfall, a moonbeam, a falling star,
 * a flurry of snow. Every touch is a visible moment; some of them change the creature.
 */
function skyTouch(
  state: GameState, kind: EventKind, t: number, dt: number, durMs: number, rec: { touches: number }, rng: StateRng, out: GameEvent[],
): void {
  const def = EVENTS[kind];
  const touch = def.touch;
  if (rec.touches >= touch.perEvent || !state.creatures.length) return;
  const rate = touch.perEvent / (durMs * 0.8);
  if (!rng.chance(1 - Math.exp(-rate * dt))) return;
  rec.touches += 1;
  const target = rng.weighted(state.creatures.filter((c) => !c.stored && !c.trip).map((c) => [c, touch.favor && creatureTraits(c).includes(touch.favor) ? 4 : 1] as [typeof c, number]));
  if (!target) return;
  const trait = MUTATIONS[def.mutation].trait;
  const changed = !creatureTraits(target).includes(trait) && rng.chance(touch.chance);
  out.push({ type: 'skyTouch', creature: target, event: kind, changed, t });
  if (!changed) {
    // A near miss still makes a story.
    note(state, out, t, `${kind}-miss`, `During a ${def.name.toLowerCase()}, the ${touch.name} reached a creature. It looked startled, but unchanged.`);
    return;
  }
  if (!addMutation(target, def.mutation, t, touch.story)) return;
  const discovered = recordMutation(state, def.mutation, t);
  out.push({ type: 'mutation', creature: target, mutation: def.mutation, cause: kind, t, discovered });
  note(state, out, t, `${kind}-hit`, touch.lesson);
}

/** A meteor shower drops a few glowing Starshard rocks on every world you own. */
function meteorRocks(state: GameState, t: number, dt: number, durMs: number, rng: StateRng, out: GameEvent[]): void {
  const [lo, hi] = TUNING.meteorRocks;
  const rate = (lo + hi) / 2 / (durMs * 0.9);
  for (const id of ISLAND_ORDER) {
    if (!state.islands[id]?.owned || state.gifts.length >= TUNING.maxGiftsOnGround + 6) continue;
    if (!rng.chance(1 - Math.exp(-rate * dt))) continue;
    const g = islandGeo(id, state.islands[id]?.size ?? 0);
    const p = randomLand(g, () => rng.next());
    const gift: Gift = { id: newId(state, 'g'), x: p.x, z: p.z, glimmer: rng.int(2, 6), shards: rng.chance(0.25) ? 2 : 1, island: id, meteor: true };
    state.gifts.push(gift);
    out.push({ type: 'gift', gift, t });
  }
}

export function islandPopulation(state: GameState, island: IslandId): number {
  return state.creatures.reduce((n, c) => n + (c.island === island && !c.stored ? 1 : 0), 0);
}

export function islandCapacity(state: GameState, island: IslandId): number {
  return (SIZE_CAPACITY[state.islands[island]?.size ?? 0] ?? TUNING.capacity) + (ISLANDS[island]?.capacityBonus ?? 0);
}

function note(state: GameState, out: GameEvent[], t: number, key: string, text: string): void {
  if (addNote(state, key, text, t)) out.push({ type: 'note', text, t });
}
