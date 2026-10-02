import { describe, expect, it } from 'vitest';
import { Composer, MOODS, type MoodId } from '../src/platform/composer';
import { mulberry32 } from '../src/core/rng';

describe('music composer', () => {
  for (const mood of Object.keys(MOODS) as MoodId[]) {
    it(`${mood}: stays in key, in a comfortable range, and keeps playing`, () => {
      const c = new Composer(mood, mulberry32(7));
      const def = MOODS[mood];
      const keys = new Set(def.scale.map((s) => (def.root + s) % 12));
      let lead = 0;
      for (let i = 0; i < 2000; i++) {
        for (const n of c.next()) {
          expect(keys.has(((n.midi % 12) + 12) % 12)).toBe(true);
          expect(n.midi).toBeGreaterThanOrEqual(24);
          expect(n.midi).toBeLessThanOrEqual(96);
          if (n.inst === def.lead) lead++;
        }
      }
      // Melody plays often, but leaves room to breathe (well under every step).
      expect(lead).toBeGreaterThan(150);
      expect(lead).toBeLessThan(1600);
    });
  }

  it('changes mood only on a bar line', () => {
    const c = new Composer('day', mulberry32(3));
    for (let i = 0; i < 3; i++) c.next();
    c.setMood('eclipse');
    for (let i = 3; i < 8; i++) {
      c.next();
      expect(c.mood).toBe('day');
    }
    c.next();
    expect(c.mood).toBe('eclipse');
  });
});
