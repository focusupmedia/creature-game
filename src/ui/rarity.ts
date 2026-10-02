import type { Rarity } from '../core/types';
import { h } from './dom';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary', mythical: 'Mythical',
};

/** A small colored rarity tag (Common, Rare, Mythical...). */
export function rarityTag(r: Rarity): HTMLElement {
  return h('span', { class: `rarity r-${r}` }, RARITY_LABEL[r]);
}
