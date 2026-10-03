import { describe, expect, it } from 'vitest';
import { globeNormal, globePoint, globeRadius, globeStep, globeToMap } from '../src/content/globe';

const g = { ox: 10, oz: -4, r: 9.5 };

describe('globe wrap', () => {
  it('puts the island centre on top and the rim at the bottom', () => {
    expect(globeNormal(g, 10, -4).y).toBeCloseTo(1);
    expect(globeNormal(g, 10 + 9.5, -4).y).toBeCloseTo(-1);
    expect(globeNormal(g, 10 + 9.5 * Math.SQRT1_2, -4).y).toBeCloseTo(0);
  });

  it('round-trips map points', () => {
    for (const [x, z] of [[11, -3], [3, 2], [16, -9], [10, 4.9]]) {
      const n = globeNormal(g, x, z);
      const back = globeToMap(g, n);
      expect(back.x).toBeCloseTo(x, 4);
      expect(back.z).toBeCloseTo(z, 4);
    }
  });

  it('walks at an even speed, even near the bottom', () => {
    const R = globeRadius(g);
    for (const [x, z, dx, dz] of [[12, -4, 1, 0], [18, -4, 1, 0], [18, -4, 0, 1], [10, 3, 0.6, -0.8]]) {
      const k = globeStep(g, x, z, dx, dz) * 0.01;
      const a = globePoint(g, x, z);
      const b = globePoint(g, x + dx * k, z + dz * k);
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeCloseTo(0.01, 3);
    }
    expect(R).toBeCloseTo(4.75 * 2);
  });
});
