import type { WandererKind } from '../core/types';

// Travellers who drop by now and then while you're playing. Tap one to meet it.
// The Goblin is the odd one out: tap him before he gets up to mischief.

export interface WandererDef {
  kind: WandererKind;
  name: string;
  icon: string;
  /** Toast when they turn up. */
  arrive: string;
  /** What they're about, on their card. */
  blurb: string;
  /** How long they stay (minutes). */
  stayMin: number;
  /** How often they come, relative to the others. */
  weight: number;
}

export const WANDERERS: Record<WandererKind, WandererDef> = {
  fortune: {
    kind: 'fortune', name: 'Madame Mystra', icon: '🔮', stayMin: 6, weight: 1,
    arrive: 'A Fortune Teller has wandered onto the island. She sees things…',
    blurb: 'Tap her to hear a hint about a pairing you haven\'t tried.',
  },
  treasure: {
    kind: 'treasure', name: 'Digby the Treasure Hunter', icon: '🗺️', stayMin: 6, weight: 1,
    arrive: 'A Treasure Hunter has arrived with a map full of X marks!',
    blurb: 'Tap him and he marks extra dig spots for your creatures.',
  },
  chef: {
    kind: 'chef', name: 'Chef Bramble', icon: '🍲', stayMin: 6, weight: 1,
    arrive: 'A Travelling Chef is setting up a little stove. Something smells good!',
    blurb: 'Tap him: he cooks a feast for everyone on this island (berries make it extra special).',
  },
  gnome: {
    kind: 'gnome', name: 'Pip the Gardener Gnome', icon: '🌱', stayMin: 6, weight: 0.8,
    arrive: 'A Gardener Gnome is pottering about with a wheelbarrow.',
    blurb: 'Tap him for a free Berry Tree sapling or some seeds.',
  },
  goblin: {
    kind: 'goblin', name: 'A sneaky Goblin', icon: '👺', stayMin: 1.5, weight: 0.7,
    arrive: 'Uh oh… a Goblin is sneaking about! Tap him before he causes trouble.',
    blurb: 'Tap him to scare him off.',
  },
};

export const WANDERER_ORDER = Object.keys(WANDERERS) as WandererKind[];
