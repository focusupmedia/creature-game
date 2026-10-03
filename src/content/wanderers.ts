import type { WandererKind } from '../core/types';

// Travellers who drop by now and then while you're playing. Tap one to open
// their menu (see core/wanderers.ts). The Goblin is the odd one out: tap him
// before he gets up to mischief and he runs.

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
    blurb: 'A free reading, deeper secrets for Starshards, and a peek at the sky ahead.',
  },
  treasure: {
    kind: 'treasure', name: 'Digby the Treasure Hunter', icon: '🗺️', stayMin: 6, weight: 1,
    arrive: 'A Treasure Hunter has arrived with a map full of X marks!',
    blurb: 'Free dig spots, treasure maps, and he trades eggs for pets you can spare.',
  },
  chef: {
    kind: 'chef', name: 'Chef Bramble', icon: '🍲', stayMin: 6, weight: 1,
    arrive: 'A Travelling Chef is setting up a little stove. Something smells good!',
    blurb: 'A free stew for everyone, cheap food, and he buys your berries.',
  },
  gnome: {
    kind: 'gnome', name: 'Pip the Gardener Gnome', icon: '🌱', stayMin: 6, weight: 0.8,
    arrive: 'A Gardener Gnome is pottering about with a wheelbarrow.',
    blurb: 'A free gift from the garden, garden decor on sale, and gnome magic for your Berry Trees.',
  },
  goblin: {
    kind: 'goblin', name: 'A sneaky Goblin', icon: '👺', stayMin: 1.5, weight: 0.7,
    arrive: 'Uh oh… a Goblin is sneaking about! Tap him before he causes trouble.',
    blurb: 'Tap him to scare him off.',
  },
};

export const WANDERER_ORDER = Object.keys(WANDERERS) as WandererKind[];
