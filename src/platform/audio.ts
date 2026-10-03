// Tiny procedural audio: ambience and UI sounds synthesized with WebAudio, so
// the prototype has sound without an asset pipeline. Production replaces these
// with authored sounds behind the same calls. Background music lives in music.ts.

import type { EventKind, IslandId, LegendaryKind } from '../core/types';
import type { MoodId } from './composer';
import { Music } from './music';

/** The kinds of voice creatures have (see voiceOf in render/voices.ts). */
export type VoiceKind = 'croak' | 'tweet' | 'squeak' | 'purr' | 'hiss' | 'buzz' | 'bloop' | 'roar' | 'chime' | 'ooh' | 'pop' | 'click';

type Sfx = 'tap' | 'place' | 'arrive' | 'discover' | 'crack' | 'hatch' | 'coin' | 'thunder' | 'chime' | 'egg' | 'error' | 'fanfare';

export class Audio {
  private ctx: AudioContext | null = null;
  /** Everything goes out through here (always on). */
  private out: GainNode | null = null;
  /** Sound effects and ambience. */
  private master: GainNode | null = null;
  private rain: GainNode | null = null;
  private wind: GainNode | null = null;
  private chirpTimer = 0;
  private music: Music | null = null;
  private mood: MoodId = 'day';
  enabled = true;
  musicEnabled = true;
  /** Volume sliders, 0..1. */
  soundVolume = 1;
  musicVolume = 1;

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
    this.out = this.ctx.createGain();
    this.out.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.6 * this.soundVolume : 0;
    this.master.connect(this.out);
    this.wind = this.noiseBed(400, 0.05);
    this.rain = this.noiseBed(2400, 0);
    // music has its own level, so the Sound switch and slider don't touch it
    const musicBus = this.ctx.createGain();
    musicBus.gain.value = 0.6;
    musicBus.connect(this.out);
    this.music = new Music(this.ctx, musicBus);
    this.music.volume = this.musicVolume;
    this.music.setMood(this.mood);
    this.music.setEnabled(this.musicEnabled);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.6 * this.soundVolume : 0, this.ctx.currentTime, 0.1);
  }

  setSoundVolume(v: number): void {
    this.soundVolume = Math.max(0, Math.min(1, v));
    this.setEnabled(this.enabled);
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.music) {
      this.music.volume = this.musicVolume;
      this.music.setEnabled(this.musicEnabled);
    }
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
  ambience(dt: number, darkness: number, sky: EventKind | null, legendary: LegendaryKind | null = null, world: IslandId = 'home'): void {
    // Legendary and sky events set the music's mood; otherwise day or night,
    // with a little overlap at dawn and dusk so it doesn't flip back and forth.
    if (legendary) this.mood = legendary;
    else if (sky) this.mood = sky;
    else if (darkness > 0.6) this.mood = 'night';
    else if (darkness < 0.4 || this.mood !== 'night') this.mood = 'day';
    if (!this.ctx || !this.rain || !this.wind) return;
    this.music?.setMood(this.mood);
    this.music?.update();
    const storm = sky === 'storm';
    const t = this.ctx.currentTime;
    // each world and sky has its own bed of sound
    const windy = sky === 'gale' ? 0.2 : sky === 'blizzard' ? 0.16 : storm ? 0.12 : world === 'desert' ? 0.07 : world === 'cloud' ? 0.09 : sky === 'fog' ? 0.02 : 0.04;
    this.rain.gain.setTargetAtTime(storm ? 0.09 : sky === 'rainbow' ? 0.025 : 0, t, 1.5);
    this.wind.gain.setTargetAtTime(windy, t, 2);
    const shore = world === 'lagoon' || world === 'beach';
    this.waves ??= this.noiseBed(700, 0);
    this.waveT += dt;
    this.waves.gain.setTargetAtTime(shore ? 0.03 + Math.max(0, Math.sin(this.waveT * 0.7)) * 0.05 : 0, t, 0.4);
    this.chirpTimer -= dt;
    if (this.chirpTimer <= 0) {
      this.chirpTimer = 2 + Math.random() * 6;
      if (world === 'volcano') this.noiseBurst(0.6, 120, 0.05); // the mountain grumbles
      else if (!storm && sky !== 'blizzard') darkness > 0.6 ? this.cricket() : shore && Math.random() < 0.5 ? this.gull() : this.bird();
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

  // ---------------------------------------------------------------- creature voices

  /**
   * A creature's own little sound. The kind decides the voice (frogs croak,
   * birds tweet, dragons rumble...); bigger pets sound lower. `happy` is for
   * petting and playing, `alarm` for being picked up.
   */
  voice(kind: VoiceKind, size = 1, mood: 'idle' | 'happy' | 'alarm' = 'idle'): void {
    if (!this.ctx || !this.master || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this.lastVoice < 0.25) return;
    this.lastVoice = now;
    const p = 1 / Math.sqrt(Math.max(0.35, size)); // pitch: small pets squeak higher
    const up = mood === 'happy' ? 1.12 : mood === 'alarm' ? 1.25 : 1;
    const v = mood === 'idle' ? 0.035 : 0.06;
    const f = (hz: number) => hz * p * up;
    switch (kind) {
      case 'croak': this.tone(f(180), 0.12, 'square', v * 0.6, -40); this.tone(f(150), 0.14, 'square', v * 0.6, -30, 0.15); break;
      case 'tweet': for (let i = 0; i < (mood === 'happy' ? 3 : 2); i++) this.tone(f(2400 + i * 300), 0.07, 'sine', v, 500, i * 0.09); break;
      case 'squeak': this.tone(f(1400), 0.08, 'triangle', v, 400); if (mood !== 'idle') this.tone(f(1700), 0.07, 'triangle', v, 300, 0.1); break;
      case 'purr': for (let i = 0; i < 4; i++) this.tone(f(110), 0.09, 'sawtooth', v * 0.35, 10, i * 0.08); break;
      case 'hiss': this.noiseBurst(0.25, 3000 * p, v * 1.2); break;
      case 'buzz': this.tone(f(240), 0.25, 'sawtooth', v * 0.5, 30); break;
      case 'bloop': this.tone(f(400), 0.12, 'sine', v * 1.3, 500); if (mood !== 'idle') this.tone(f(500), 0.1, 'sine', v, 400, 0.13); break;
      case 'roar': this.tone(f(140), 0.45, 'sawtooth', v * 0.7, -50); this.noiseBurst(0.35, 600, v * 0.8); break;
      case 'chime': [1, 1.25, 1.5].forEach((k, i) => this.tone(f(880 * k), 0.5, 'sine', v * 0.8, 0, i * 0.08)); break;
      case 'ooh': this.tone(f(300), 0.25, 'sine', v * 1.2, 180); if (mood !== 'idle') this.tone(f(420), 0.2, 'sine', v, 200, 0.22); break;
      case 'pop': this.tone(f(700), 0.05, 'square', v * 0.6, -300); this.tone(f(900), 0.05, 'square', v * 0.5, -300, 0.08); break;
      case 'click': for (let i = 0; i < 3; i++) this.tone(f(2000), 0.02, 'square', v * 0.6, 0, i * 0.05); break;
    }
  }

  private lastVoice = 0;

  private noiseBurst(dur: number, freq: number, vol: number): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(flt).connect(g).connect(this.master!);
    src.start();
  }

  private bird(): void {
    const base = 2200 + Math.random() * 1500;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(base + Math.random() * 400, 0.08, 'sine', 0.03, 600, i * 0.11);
  }

  private waves: GainNode | null = null;
  private waveT = 0;

  private gull(): void {
    this.tone(1300, 0.18, 'triangle', 0.025, -500);
    this.tone(1200, 0.2, 'triangle', 0.02, -500, 0.22);
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
      case 'fanfare': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { this.tone(f, 0.9, 'triangle', 0.09, 0, i * 0.12); this.tone(f / 2, 1.2, 'sine', 0.06, 0, i * 0.12); }); break;
    }
  }
}
