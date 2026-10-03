import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DRAWN } from '../src/ui/emoji';

// Every emoji the game shows must have a drawn icon, so it looks the same on every phone.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2300}-\u{23FF}★☆✦✓]/gu;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') && !p.endsWith('emoji.ts') ? [p] : [];
  });
}

describe('drawn icons', () => {
  it('every emoji used in the game has a drawn icon', () => {
    const missing = new Map<string, string>();
    for (const f of files('src')) {
      for (const m of readFileSync(f, 'utf8').matchAll(EMOJI)) {
        if (!DRAWN.has(m[0])) missing.set(m[0], f);
      }
    }
    expect([...missing].map(([e, f]) => `${e} in ${f}`)).toEqual([]);
  });
});

describe('decor catalog', () => {
  it('has 50-100 decorations, each with a model, a group and an unlock level', async () => {
    const { DECOR_LIST } = await import('../src/content/decor');
    const src = readFileSync('src/render/decor.ts', 'utf8');
    expect(DECOR_LIST.length).toBeGreaterThanOrEqual(50);
    expect(DECOR_LIST.length).toBeLessThanOrEqual(100);
    expect(new Set(DECOR_LIST.map((d) => d.id)).size).toBe(DECOR_LIST.length);
    for (const d of DECOR_LIST) {
      expect(src.includes(`  ${d.id}(k)`), `${d.id} has no model`).toBe(true);
      expect(d.cat && d.level && d.r).toBeTruthy();
    }
  });
});
