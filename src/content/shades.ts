import type { StateRng } from '../core/rng';

// Every pet rolls a color shade when it's born. Most are gentle tints of their
// kind's colors; Pastel is rare and Shiny very rare. Babies often take after a
// parent. Color mutations (Lunar, Frost...) tint on top of the shade.

export type ShadeId = 'classic' | 'sunny' | 'rosy' | 'minty' | 'dusky' | 'ocean' | 'pastel' | 'shiny';

export interface ShadeDef {
  id: ShadeId;
  name: string;
  tier: 'common' | 'rare' | 'shiny';
  /** The color the body is tinted toward, and how strongly (0..1). Shiny also turns the hue right round. */
  tint: string;
  amount: number;
  /** Chance out of 100 when rolled fresh. */
  weight: number;
}

export const SHADES: Record<ShadeId, ShadeDef> = {
  classic: { id: 'classic', name: 'Classic', tier: 'common', tint: '#ffffff', amount: 0, weight: 41 },
  sunny: { id: 'sunny', name: 'Sunny', tier: 'common', tint: '#ffc93a', amount: 0.4, weight: 11 },
  rosy: { id: 'rosy', name: 'Rosy', tier: 'common', tint: '#ff7aa8', amount: 0.45, weight: 11 },
  minty: { id: 'minty', name: 'Minty', tier: 'common', tint: '#5fe0b0', amount: 0.32, weight: 10 },
  dusky: { id: 'dusky', name: 'Dusky', tier: 'common', tint: '#5a4a7a', amount: 0.35, weight: 10 },
  ocean: { id: 'ocean', name: 'Ocean', tier: 'common', tint: '#3a9aff', amount: 0.35, weight: 10 },
  pastel: { id: 'pastel', name: 'Pastel', tier: 'rare', tint: '#fff0fa', amount: 0.45, weight: 6 },
  shiny: { id: 'shiny', name: 'Shiny', tier: 'shiny', tint: '#ffe27a', amount: 0.25, weight: 1 },
};

export const SHADE_ORDER = Object.keys(SHADES) as ShadeId[];

/** Roll a shade for a new pet; a baby takes after a parent about half the time (a Shiny parent passes it on less often). */
export function rollShade(rng: StateRng, parents: (string | undefined)[] = []): ShadeId {
  const inherited = parents.filter((p): p is ShadeId => !!p && p in SHADES && p !== 'classic');
  if (inherited.length && rng.chance(0.5)) {
    const pick = rng.pick(inherited);
    if (pick !== 'shiny' || rng.chance(0.3)) return pick;
  }
  return rng.weighted(SHADE_ORDER.map((id) => [id, SHADES[id].weight] as [ShadeId, number])) ?? 'classic';
}
