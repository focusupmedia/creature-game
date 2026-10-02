// Generative cozy music: decides which notes play, one eighth-note step at a
// time. Pure (no WebAudio) so it can be tested; music.ts turns the notes into
// sound. Each mood is a small "song recipe": key, tempo, chords, instruments.

export type MoodId = 'day' | 'night' | 'storm' | 'eclipse' | 'starry' | 'fullmoon' | 'blizzard' | 'angel' | 'infernal' | 'abyssal';
export type Inst = 'kalimba' | 'marimba' | 'bell' | 'bass' | 'pad';

export interface Note {
  inst: Inst;
  midi: number;
  vol: number;
  /** Seconds after the step starts (swing). */
  offset: number;
  /** Only pads use it: how long the chord is held. */
  hold?: number;
}

export interface MoodDef {
  bpm: number;
  /** MIDI note of the key's root, around middle C. */
  root: number;
  /** Semitones of the 7-note mode. */
  scale: number[];
  /** Chord per bar, as scale-degree roots (triads are built from the scale). */
  chords: number[];
  lead: Inst;
  arp: Inst | null;
  pad: boolean;
  bass: boolean;
  /** Chance a melody note sounds on an off-beat / on-beat step. */
  density: [number, number];
  /** Arpeggio chance per step. */
  arpDensity: number;
  swing: number;
  /** Overall loudness and echo amount for this mood. */
  volume: number;
  echo: number;
}

const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];

export const MOODS: Record<MoodId, MoodDef> = {
  // Bright, bouncy marimba in C major: I–V–vi–IV.
  day: { bpm: 100, root: 60, scale: IONIAN, chords: [0, 4, 5, 3], lead: 'marimba', arp: 'kalimba', pad: false, bass: true, density: [0.35, 0.75], arpDensity: 0.55, swing: 0.08, volume: 1, echo: 0.18 },
  // Slow kalimba lullaby in F major over a soft pad.
  night: { bpm: 66, root: 53, scale: IONIAN, chords: [0, 5, 3, 4], lead: 'kalimba', arp: null, pad: true, bass: true, density: [0.12, 0.5], arpDensity: 0, swing: 0.04, volume: 0.85, echo: 0.3 },
  // Low, thoughtful marimba in D dorian; quiet so the rain sits on top.
  storm: { bpm: 76, root: 50, scale: DORIAN, chords: [0, 3, 0, 6], lead: 'marimba', arp: null, pad: true, bass: true, density: [0.15, 0.5], arpDensity: 0, swing: 0, volume: 0.7, echo: 0.28 },
  // Mysterious, floaty kalimba in E phrygian.
  eclipse: { bpm: 58, root: 52, scale: PHRYGIAN, chords: [0, 1, 0, 6], lead: 'kalimba', arp: null, pad: true, bass: true, density: [0.1, 0.45], arpDensity: 0, swing: 0, volume: 0.85, echo: 0.42 },
  // Twinkly bells and kalimba sparkles in E lydian.
  starry: { bpm: 80, root: 64, scale: LYDIAN, chords: [0, 1, 0, 4], lead: 'bell', arp: 'kalimba', pad: true, bass: false, density: [0.15, 0.55], arpDensity: 0.35, swing: 0.05, volume: 0.85, echo: 0.4 },
  // Warm, glowing D major with kalimba and pad.
  fullmoon: { bpm: 64, root: 62, scale: IONIAN, chords: [0, 3, 5, 4], lead: 'kalimba', arp: 'bell', pad: true, bass: true, density: [0.12, 0.55], arpDensity: 0.15, swing: 0.04, volume: 0.85, echo: 0.36 },
  // Legendary events: bigger and more intense.
  // Angels: soaring bells and a full shimmering arpeggio in D lydian.
  angel: { bpm: 88, root: 62, scale: LYDIAN, chords: [0, 1, 4, 0], lead: 'bell', arp: 'kalimba', pad: true, bass: true, density: [0.35, 0.85], arpDensity: 0.75, swing: 0, volume: 1.15, echo: 0.45 },
  // The Eruption: driving low marimba in D phrygian.
  infernal: { bpm: 104, root: 50, scale: PHRYGIAN, chords: [0, 1, 0, 6], lead: 'marimba', arp: 'kalimba', pad: true, bass: true, density: [0.35, 0.85], arpDensity: 0.65, swing: 0, volume: 1.1, echo: 0.22 },
  // The Deep Tide: slow, echoing kalimba and bells far below.
  abyssal: { bpm: 56, root: 57, scale: AEOLIAN, chords: [0, 5, 3, 4], lead: 'kalimba', arp: 'bell', pad: true, bass: true, density: [0.12, 0.5], arpDensity: 0.3, swing: 0, volume: 1.05, echo: 0.55 },
  // Glassy, hushed bells in B minor.
  blizzard: { bpm: 62, root: 59, scale: AEOLIAN, chords: [0, 5, 2, 6], lead: 'bell', arp: null, pad: true, bass: false, density: [0.08, 0.4], arpDensity: 0, swing: 0, volume: 1, echo: 0.45 },
};

const STEPS_PER_BAR = 8;
const MOTIF_STEPS = 16;

/** Melody as scale degrees (relative to the root) per step, or null for a rest. */
type Motif = (number | null)[];

export class Composer {
  mood: MoodId;
  private pending: MoodId | null = null;
  private step = 0;
  private motif: Motif = [];
  private phrase = 0;
  private resting = false;

  constructor(mood: MoodId = 'day', private rng: () => number = Math.random) {
    this.mood = mood;
    this.motif = this.makeMotif();
  }

  get def(): MoodDef {
    return MOODS[this.mood];
  }

  /** Seconds per eighth-note step in the current mood. */
  get stepDur(): number {
    return 30 / this.def.bpm;
  }

  /** The new mood starts at the next bar so the rhythm never stumbles. */
  setMood(m: MoodId): void {
    this.pending = m === this.mood ? null : m;
  }

  /** Notes for the next step, then advances. */
  next(): Note[] {
    const inBar = this.step % STEPS_PER_BAR;
    if (inBar === 0) this.onBar();
    const d = this.def;
    const bar = Math.floor(this.step / STEPS_PER_BAR) % d.chords.length;
    const chord = d.chords[bar];
    const notes: Note[] = [];
    const swing = inBar % 2 === 1 ? d.swing * this.stepDur * 2 : 0;
    const v = () => 0.85 + this.rng() * 0.3;

    if (inBar === 0 && d.pad) {
      notes.push(...this.triad(chord, -12).map((midi) => ({ inst: 'pad' as Inst, midi, vol: 0.5, offset: 0, hold: this.stepDur * STEPS_PER_BAR })));
    }
    if (d.bass && (inBar === 0 || (inBar === 4 && this.rng() < 0.4))) {
      notes.push({ inst: 'bass', midi: this.degree(chord, -24), vol: 0.8 * v(), offset: 0 });
    }
    if (d.arp && this.rng() < d.arpDensity) {
      const tones = this.triad(chord, d.lead === d.arp ? -12 : 0);
      const pattern = [0, 1, 2, 1];
      notes.push({ inst: d.arp, midi: tones[pattern[inBar % 4]], vol: 0.45 * v(), offset: swing });
    }
    if (!this.resting) {
      const deg = this.motif[this.step % MOTIF_STEPS];
      if (deg !== null && deg !== undefined) {
        // Strong beats land on a chord tone so the melody always fits.
        const snapped = inBar % 4 === 0 ? this.nearestChordTone(deg, chord) : deg;
        notes.push({ inst: d.lead, midi: this.degree(snapped, 0), vol: (inBar % 4 === 0 ? 0.9 : 0.7) * v(), offset: swing });
      }
    }
    this.step++;
    return notes;
  }

  private onBar(): void {
    if (this.pending) {
      this.mood = this.pending;
      this.pending = null;
      this.step = 0;
      this.phrase = 0;
      this.resting = false;
      this.motif = this.makeMotif();
      return;
    }
    // Every two bars is a phrase. Breathe now and then, and write a new tune
    // every few phrases so it never loops for long.
    if (this.step % (STEPS_PER_BAR * 2) === 0 && this.step > 0) {
      this.phrase++;
      this.resting = this.rng() < 0.2;
      if (this.phrase % 4 === 0) this.motif = this.makeMotif();
      else if (this.rng() < 0.5) this.vary();
    }
  }

  private makeMotif(): Motif {
    const [off, on] = this.def.density;
    const m: Motif = [];
    let deg = 2 + Math.floor(this.rng() * 4);
    for (let i = 0; i < MOTIF_STEPS; i++) {
      const strong = i % 2 === 0;
      if (this.rng() >= (strong ? on : off)) {
        m.push(null);
        continue;
      }
      const r = this.rng();
      const move = r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : 0;
      deg = Math.max(0, Math.min(9, deg + move));
      m.push(deg);
    }
    if (!m.some((x) => x !== null)) m[0] = 4;
    return m;
  }

  /** Small change to the current tune: shift one note by a step. */
  private vary(): void {
    const idx = this.motif.map((x, i) => (x === null ? -1 : i)).filter((i) => i >= 0);
    const i = idx[Math.floor(this.rng() * idx.length)];
    const cur = this.motif[i]!;
    this.motif[i] = Math.max(0, Math.min(9, cur + (this.rng() < 0.5 ? -1 : 1)));
  }

  private nearestChordTone(deg: number, chord: number): number {
    let best = deg;
    let bestDist = Infinity;
    for (const c of [chord, chord + 2, chord + 4, chord + 7, chord + 9, chord - 3, chord - 5]) {
      const dist = Math.abs(c - deg);
      if (c >= 0 && c <= 11 && dist < bestDist) { best = c; bestDist = dist; }
    }
    return best;
  }

  private triad(chord: number, shift: number): number[] {
    return [chord, chord + 2, chord + 4].map((d) => this.degree(d, shift));
  }

  /** Scale degree (any integer) to MIDI. */
  private degree(deg: number, shift: number): number {
    const s = this.def.scale;
    const oct = Math.floor(deg / s.length);
    const i = ((deg % s.length) + s.length) % s.length;
    return this.def.root + oct * 12 + s[i] + shift;
  }
}
