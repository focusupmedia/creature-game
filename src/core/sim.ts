// The world tick. Runs identically live (small steps) and offline (catch-up in
// larger steps), producing GameEvents that the renderer, UI, audio and
// analytics react to. "What happened while I was gone?" is just this function
// run over the gap.

import { species } from '../content/species';
import { EVENTS, LURES, MUTATIONS, SPOTS } from '../content/world';
import { TUNING } from '../content/tuning';
import { randomLandPoint } from '../content/layout';
import { addMutation, creatureTraits, displayName, makeCreature, newId } from './creatures';
import { addNote, recordMutation, recordSpecies } from './journal';
import { arrivalChance, arrivalMutations, arrivalWeights } from './lures';
import { StateRng } from './rng';
import { refreshShop } from './shop';
import { freeNest } from './state';
import type { EventKind, GameEvent, GameState, MutationId } from './types';
import { activeEvent, isDark } from './world';

const MIN = 60_000;

export function tick(state: GameState, now: number, opts: { maxStepMs?: number } = {}): GameEvent[] {
  const out: GameEvent[] = [];
  const maxStep = opts.maxStepMs ?? 1000;
  const cap = TUNING.offlineCapHours * 60 * MIN;
  if (now - state.lastTick > cap) state.lastTick = now - cap;
  let t = state.lastTick;
  while (t < now) {
    const dt = Math.min(maxStep, now - t);
    t += dt;
    step(state, t, dt, out);
  }
  state.lastTick = now;
  return out;
}

function step(state: GameState, t: number, dt: number, out: GameEvent[]): void {
  const rng = new StateRng(state);
  const ev = activeEvent(state, t);
  const sky: EventKind | null = ev ? ev.kind : null;
  const dark = isDark(state, t);

  // ---- sky events
  if (ev) {
    const key = String(ev.window);
    const rec = (state.eventsApplied[key] ??= { kind: ev.kind, started: false, ended: false, strikes: 0, moonbeams: 0 });
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
    if (ev.kind === 'storm') sparkfall(state, t, dt, rec, rng, out);
    if (ev.kind === 'eclipse') moonbeam(state, t, dt, ev.end - ev.start, rec, rng, out);
  }
  for (const [key, rec] of Object.entries(state.eventsApplied)) {
    if (rec.started && !rec.ended && (!ev || String(ev.window) !== key)) {
      rec.ended = true;
      out.push({ type: 'eventEnd', kind: rec.kind, t });
    }
  }

  // ---- lures
  for (const spotId of Object.keys(SPOTS)) {
    const active = state.spots[spotId];
    if (!active) continue;
    const weights = arrivalWeights(active.lure, spotId, dark, sky);
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
    // First-ever lure: guarantee a quick first discovery.
    if (state.stats.arrivals === 0 && t - active.placedAt > 6000) p = Math.max(p, 0.25 * (dt / 1000));
    if (!rng.chance(p)) continue;
    const sp = rng.weighted(weights.map(([s, w]) => [s.id, w] as [string, number]));
    if (!sp) continue;
    const muts = arrivalMutations(active.lure, sky, rng);
    const lure = LURES[active.lure];
    const where = SPOTS[spotId].name;
    const when = sky ? ` during ${sky === 'eclipse' ? 'an eclipse' : 'a thunderstorm'}` : dark ? ' in the dark of night' : '';
    const story = `Followed the scent of a ${lure.name} to the ${where}${when}.`;
    const c = makeCreature(state, sp, muts, t, story);
    c.arrivingAt = spotId;
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
    if (state.creatures.length >= TUNING.capacity) {
      // Full sanctuary: the visitor is seen (journal) but moves on.
      out.push({ type: 'arrival', creature: c, spot: spotId, discovered, t });
      note(state, out, t, 'full', 'Your sanctuary is full. Visitors look around, then wander off.');
      continue;
    }
    state.creatures.push(c);
    out.push({ type: 'arrival', creature: c, spot: spotId, discovered, t });
  }

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
    if (egg.nest !== null) continue;
    const n = freeNest(state);
    if (n === null) break;
    egg.nest = n;
  }

  // ---- gifts: residents leave small things behind
  if (state.gifts.length < TUNING.maxGiftsOnGround && state.creatures.length) {
    const rate = Math.min(state.creatures.length, TUNING.giftResidentsCap) / (TUNING.giftEveryMin * MIN);
    if (rng.chance(1 - Math.exp(-rate * dt))) {
      const from = rng.pick(state.creatures);
      const p = randomLandPoint(() => rng.next());
      const [g0, g1] = TUNING.giftGlimmer;
      const gift = {
        id: newId(state, 'g'), x: p.x, z: p.z, glimmer: rng.int(g0, g1),
        shards: rng.chance(TUNING.giftShardChance) ? 1 : 0, from: from.id,
      };
      state.gifts.push(gift);
      out.push({ type: 'gift', gift, t });
    }
  }

  // ---- shop rotation
  if (t >= state.shop.nextRefreshAt) {
    refreshShop(state, t);
    out.push({ type: 'shopRefresh', t });
  }
}

function sparkfall(state: GameState, t: number, dt: number, rec: { strikes: number }, rng: StateRng, out: GameEvent[]): void {
  if (rec.strikes >= TUNING.maxStrikesPerStorm || !state.creatures.length) return;
  if (!rng.chance(1 - Math.exp(-dt / (TUNING.sparkfallEverySec * 1000)))) return;
  const target = rng.pick(state.creatures);
  rec.strikes += 1;
  const changes = !creatureTraits(target).includes('Storm') && rng.chance(TUNING.sparkfallMutationChance);
  out.push({ type: 'strike', creature: target, t });
  if (!changes) {
    // A near miss still makes a story.
    note(state, out, t, 'sparkfall-miss', 'Sparkfall struck near a creature during the storm. It looked startled, but unchanged.');
    return;
  }
  applyMutation(state, target, 'storm', t, 'sparkfall', 'Was struck by sparkfall during a thunderstorm, and changed.', out);
}

function moonbeam(
  state: GameState, t: number, dt: number, durMs: number, rec: { moonbeams: number }, rng: StateRng, out: GameEvent[],
): void {
  if (rec.moonbeams >= TUNING.moonbeamsPerEclipse || !state.creatures.length) return;
  const rate = TUNING.moonbeamsPerEclipse / (durMs * 0.8);
  if (!rng.chance(1 - Math.exp(-rate * dt))) return;
  rec.moonbeams += 1;
  if (!rng.chance(TUNING.moonbeamChance)) return;
  // Mystic creatures catch the moonlight more easily.
  const cands = state.creatures.filter((c) => !creatureTraits(c).includes('Lunar'));
  if (!cands.length) return;
  const target = rng.weighted(cands.map((c) => [c, creatureTraits(c).includes('Mystic') ? 4 : 1] as [typeof c, number]));
  if (!target) return;
  out.push({ type: 'moonbeam', creature: target, t });
  applyMutation(state, target, 'lunar', t, 'moonbeam', 'Bathed in a moonbeam during an eclipse. Its colors silvered.', out);
}

function applyMutation(
  state: GameState, c: GameState['creatures'][number], m: MutationId, t: number,
  cause: 'sparkfall' | 'moonbeam', story: string, out: GameEvent[],
): void {
  if (!addMutation(c, m, t, story)) return;
  const discovered = recordMutation(state, m, t);
  out.push({ type: 'mutation', creature: c, mutation: m, cause, t, discovered });
  note(state, out, t, `${cause}-hit`, cause === 'sparkfall'
    ? 'Creatures caught out in a thunderstorm can be changed by sparkfall.'
    : 'An eclipse can silver a creature that stands in its moonbeam.');
}

function note(state: GameState, out: GameEvent[], t: number, key: string, text: string): void {
  if (addNote(state, key, text, t)) out.push({ type: 'note', text, t });
}
