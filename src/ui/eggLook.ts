// What an egg looks like in menus: a small drawn egg in the same colours and
// pattern as the one in the nest, and a name that describes it ("Green
// Speckled Egg"), so you can tell your eggs apart at a glance.

import { species } from '../content/species';
import { EGG_TIERS } from '../content/world';
import { mulberry32 } from '../core/rng';
import type { Egg, MutationId, SpeciesId } from '../core/types';

const INK = '#1b2a4a';
const GLOWS: MutationId[] = ['lunar', 'storm', 'starlit', 'frost'];

type Pattern = 'swirly' | 'striped' | 'speckled';

/** Mirrors the nest egg's texture in render/eggModel.ts. */
function pattern(sp: SpeciesId): Pattern {
  const def = species(sp);
  return def.origin === 'hybrid' ? 'swirly' : def.traits.includes('Tide') ? 'striped' : 'speckled';
}

function colourWord(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (sat < 0.18) return l > 0.75 ? 'White' : l < 0.3 ? 'Dark' : 'Grey';
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  if (l < 0.25) return 'Dark';
  if (hue < 15 || hue >= 340) return l > 0.7 ? 'Pink' : 'Red';
  if (hue < 40) return l < 0.45 ? 'Brown' : 'Orange';
  if (hue < 65) return 'Golden';
  if (hue < 160) return 'Green';
  if (hue < 200) return 'Teal';
  if (hue < 255) return 'Blue';
  if (hue < 290) return 'Purple';
  return 'Pink';
}

/** "Green Speckled Egg", or the shop name for a bought egg. */
export function eggName(egg: Pick<Egg, 'species' | 'mutations' | 'tier'>): string {
  if (egg.tier && EGG_TIERS[egg.tier]) return EGG_TIERS[egg.tier].name;
  const p = pattern(egg.species);
  const glow = egg.mutations.some((m) => GLOWS.includes(m)) ? 'Glowing ' : '';
  return `${glow}${colourWord(species(egg.species).eggColors[0])} ${p[0].toUpperCase()}${p.slice(1)} Egg`;
}

/** A small SVG egg in the egg's own colours and pattern. */
export function eggIcon(egg: Pick<Egg, 'species' | 'seed'>): string {
  const [base, pat] = species(egg.species).eggColors;
  return drawEgg(base, pat, pattern(egg.species), egg.seed);
}

/** A shop egg in its tier's colours. */
export function tierEggIcon(tierId: string): string {
  const t = EGG_TIERS[tierId];
  return drawEgg(t?.colors[0] ?? '#fff', t?.colors[1] ?? '#ccc', 'speckled', tierId.length * 977);
}

let uid = 0;
function drawEgg(base: string, pat: string, p: Pattern, seed: number): string {
  const id = `egg-clip-${++uid}`;
  const shape = 'M32 6C20 6 11 24 11 38c0 12 9 20 21 20s21-8 21-20C53 24 44 6 32 6z';
  let marks = '';
  if (p === 'swirly') {
    for (let i = 0; i < 4; i++) {
      const y = 16 + i * 11;
      marks += `<path d="M6 ${y}q6.5-6 13 0t13 0 13 0 13 0" fill="none" stroke="${pat}" stroke-width="4"/>`;
    }
  } else if (p === 'striped') {
    for (let i = 0; i < 4; i++) marks += `<rect x="0" y="${15 + i * 11}" width="64" height="4" fill="${pat}"/>`;
  } else {
    const r = mulberry32(seed);
    for (let i = 0; i < 9; i++) marks += `<circle cx="${(14 + r() * 36).toFixed(1)}" cy="${(12 + r() * 42).toFixed(1)}" r="${(2 + r() * 3).toFixed(1)}" fill="${pat}"/>`;
  }
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${shape}"/></clipPath></defs>
    <path d="${shape}" fill="${base}"/>
    <g clip-path="url(#${id})">${marks}</g>
    <path d="M22 18q4-6 9-7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
    <path d="${shape}" fill="none" stroke="${INK}" stroke-width="4"/></svg>`;
}
