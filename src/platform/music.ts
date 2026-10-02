// Plays the Composer's notes with small synthesized instruments (kalimba,
// marimba, bells, soft bass and pad) through a gentle echo. Final audio can
// replace these voices with recorded samples behind the same Note calls.

import { Composer, MOODS, type MoodId, type Note } from './composer';

const LOOKAHEAD_S = 0.3;
const MUSIC_VOL = 0.9;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class Music {
  readonly composer = new Composer();
  private bus: GainNode;
  private dry: GainNode;
  private echoSend: GainNode;
  private nextTime = 0;
  private enabled = true;

  constructor(private ctx: AudioContext, out: AudioNode) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(out);
    // Everything plays into `dry`; a soft, darkened echo gives a cozy room feel.
    this.dry = ctx.createGain();
    this.dry.connect(this.bus);
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = MOODS.day.echo;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    this.dry.connect(this.echoSend).connect(delay).connect(tone).connect(fb).connect(delay);
    tone.connect(this.bus);
    this.fadeTo(MUSIC_VOL * MOODS.day.volume, 3);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.fadeTo(on ? MUSIC_VOL * this.composer.def.volume : 0, 0.4);
  }

  setMood(m: MoodId): void {
    this.composer.setMood(m);
  }

  /** Called every frame: schedules notes a little ahead of time. */
  update(): void {
    const now = this.ctx.currentTime;
    // After the tab sleeps, pick up from now instead of rushing to catch up.
    if (this.nextTime < now) this.nextTime = now + 0.05;
    while (this.nextTime < now + LOOKAHEAD_S) {
      const before = this.composer.mood;
      const notes = this.composer.next();
      if (this.composer.mood !== before) this.onMoodApplied();
      if (this.enabled) for (const n of notes) this.voice(n, this.nextTime + n.offset);
      this.nextTime += this.composer.stepDur;
    }
  }

  private onMoodApplied(): void {
    const d = this.composer.def;
    const t = this.ctx.currentTime;
    this.echoSend.gain.setTargetAtTime(d.echo, t, 1);
    if (this.enabled) this.fadeTo(MUSIC_VOL * d.volume, 1.5);
  }

  private fadeTo(v: number, secs: number): void {
    this.bus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, secs / 3);
  }

  private voice(n: Note, t: number): void {
    const f = hz(n.midi);
    switch (n.inst) {
      case 'kalimba':
        // Warm tine plus a short, slightly out-of-tune overtone: the "plink".
        this.partial(t, f, 0.11 * n.vol, 0.004, f < 400 ? 1.8 : 1.3);
        this.partial(t, f * 5.4, 0.022 * n.vol, 0.002, 0.12);
        this.partial(t, f * 2, 0.012 * n.vol, 0.002, 0.05, 'triangle');
        break;
      case 'marimba':
        // Woody bar: fundamental plus the bar's 4th partial, short and round.
        this.partial(t, f, 0.12 * n.vol, 0.003, f < 300 ? 1.1 : 0.8);
        this.partial(t, f * 3.93, 0.03 * n.vol, 0.002, 0.1);
        break;
      case 'bell':
        this.partial(t, f, 0.09 * n.vol, 0.003, 2.4);
        this.partial(t, f * 2.76, 0.018 * n.vol, 0.003, 0.9);
        this.partial(t, f * 5.4, 0.006 * n.vol, 0.002, 0.3);
        break;
      case 'bass':
        this.partial(t, f, 0.13 * n.vol, 0.01, 1.4);
        this.partial(t, f * 2, 0.02 * n.vol, 0.005, 0.25, 'triangle');
        break;
      case 'pad':
        this.pad(t, f, 0.012 * n.vol, n.hold ?? 4);
        break;
    }
  }

  private partial(t: number, f: number, vol: number, attack: number, decay: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(this.dry);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  /** Soft breathy chord tone: two detuned triangles through a low filter. */
  private pad(t: number, f: number, vol: number, hold: number): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const rise = Math.min(1.5, hold / 2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + rise);
    g.gain.setValueAtTime(vol, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold + 1.5);
    lp.connect(g).connect(this.dry);
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(lp);
      o.start(t);
      o.stop(t + hold + 1.6);
    }
  }
}
