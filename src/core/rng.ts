// Small deterministic RNG helpers. Simulation randomness flows through the
// state's rng so offline catch-up and tests are reproducible.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash -> [0,1). Used for schedules that must be identical on every device. */
export function hash01(...parts: number[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

/** RNG bound to a mutable state object so the seed advances and persists in saves. */
export class StateRng {
  constructor(private holder: { rng: number }) {}

  next(): number {
    const h = this.holder;
    h.rng = (h.rng + 0x6d2b79f5) >>> 0;
    let t = h.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(entries: readonly [T, number][]): T | null {
    const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const [v, w] of entries) {
      r -= Math.max(0, w);
      if (r <= 0) return v;
    }
    return entries[entries.length - 1][0];
  }

  seed(): number {
    return Math.floor(this.next() * 2 ** 31);
  }
}
