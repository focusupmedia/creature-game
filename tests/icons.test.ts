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
