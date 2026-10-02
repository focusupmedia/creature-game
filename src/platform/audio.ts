// Tiny procedural audio: ambience and UI sounds synthesized with WebAudio, so
// the prototype has sound without an asset pipeline. Production replaces these
// with authored sounds behind the same calls. Background music lives in music.ts.

import type { EventKind } from '../core/types';
import type { MoodId } from './composer';
import { Music } from './music';

type Sfx = 'tap' | 'place' | 'arrive' | 'discover' | 'crack' | 'hatch' | 'coin' | 'thunder' | 'chime' | 'egg' | 'error';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rain: GainNode | null = null;
  private wind: GainNode | null = null;
  private chirpTimer = 0;
  private music: Music | null = null;
  private mood: MoodId = 'day';
  enabled = true;
  musicEnabled = true;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.6 : 0;
    this.master.connect(this.ctx.destination);
    this.wind = this.noiseBed(400, 0.05);
    this.rain = this.noiseBed(2400, 0);
    this.music = new Music(this.ctx, this.master);
    this.music.setMood(this.mood);
    this.music.setEnabled(this.musicEnabled);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.1);
  }

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    this.music?.setEnabled(on);
  }

  private noiseBed(freq: number, vol: number): GainNode {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = freq > 1000 ? Math.random() * 2 - 1 : last * 8;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = freq > 1000 ? 'highpass' : 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    return g;
  }

  /** Called every frame with world conditions. */
  ambience(dt: number, darkness: number, sky: EventKind | null): void {
    // Sky events set the music's mood; otherwise day or night, with a little
    // overlap at dawn and dusk so it doesn't flip back and forth.
    if (sky) this.mood = sky;
    else if (darkness > 0.6) this.mood = 'night';
    else if (darkness < 0.4 || this.mood !== 'night') this.mood = 'day';
    if (!this.ctx || !this.rain || !this.wind) return;
    this.music?.setMood(this.mood);
    this.music?.update();
    const storm = sky === 'storm';
    const t = this.ctx.currentTime;
    this.rain.gain.setTargetAtTime(storm ? 0.09 : 0, t, 1.5);
    this.wind.gain.setTargetAtTime(storm ? 0.12 : 0.04, t, 2);
    this.chirpTimer -= dt;
    if (this.chirpTimer <= 0) {
      this.chirpTimer = 2 + Math.random() * 6;
      if (!storm) darkness > 0.6 ? this.cricket() : this.bird();
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** One-shot low noise burst for thunder. */
  private rumble(): void {
    const ctx = this.ctx!;
    const dur = 2.5;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = last * 0.985 + (Math.random() * 2 - 1) * 0.015;
      d[i] = last * 10 * (1 - i / d.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g).connect(this.master!);
    src.start();
  }

  private bird(): void {
    const base = 2200 + Math.random() * 1500;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(base + Math.random() * 400, 0.08, 'sine', 0.03, 600, i * 0.11);
  }

  private cricket(): void {
    for (let i = 0; i < 4; i++) this.tone(4200, 0.03, 'square', 0.008, 0, i * 0.06);
  }

  play(s: Sfx): void {
    if (!this.ctx) return;
    switch (s) {
      case 'tap': this.tone(660, 0.06, 'triangle', 0.08); break;
      case 'place': this.tone(330, 0.12, 'triangle', 0.15, 120); this.tone(495, 0.15, 'sine', 0.08, 0, 0.05); break;
      case 'arrive': this.tone(523, 0.1, 'sine', 0.1); this.tone(784, 0.18, 'sine', 0.08, 0, 0.08); break;
      case 'discover': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.12, 0, i * 0.09)); break;
      case 'crack': this.tone(180, 0.08, 'square', 0.12, -80); break;
      case 'hatch': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.1, 0, i * 0.07)); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.04); this.tone(1319, 0.12, 'square', 0.04, 0, 0.06); break;
      case 'thunder': this.rumble(); break;
      case 'chime': [880, 1109, 1319].forEach((f, i) => this.tone(f, 0.8, 'sine', 0.06, 0, i * 0.15)); break;
      case 'egg': this.tone(392, 0.15, 'sine', 0.12, 200); break;
      case 'error': this.tone(200, 0.15, 'sawtooth', 0.05, -60); break;
    }
  }
}
