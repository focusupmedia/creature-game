// Behaviour traits ("quirks" in code, "traits" to players). Every creature
// has 2-5 of them, rolled at birth and partly inherited. They are separate
// from breeding types (Grove, Mammal...) and change how a creature acts.
// The six original personalities are quirks too; the first one a creature
// has sets its overall temper (speed, naps, squabbles).

import type { Personality } from '../core/types';

export type QuirkId =
  | Personality
  | 'lucky' | 'digger' | 'greedy' | 'sleepy' | 'glutton' | 'brave' | 'nightowl' | 'earlybird'
  | 'social' | 'loner' | 'swimmer' | 'explorer' | 'showoff' | 'musical' | 'clumsy';

export interface QuirkDef {
  id: QuirkId;
  name: string;
  icon: string;
  blurb: string;
  /** Temper quirks are the original personalities. */
  temper?: boolean;
  /** Quirks that can't sit together. */
  clashes?: QuirkId[];
}

export const QUIRKS: Record<QuirkId, QuirkDef> = {
  energetic: { id: 'energetic', name: 'Energetic', icon: '⚡', temper: true, blurb: 'Always on the move. Digs a lot and picks playful squabbles.', clashes: ['lazy'] },
  lazy: { id: 'lazy', name: 'Lazy', icon: '🛋️', temper: true, blurb: 'Naps whenever it can. Rarely bothers to dig.', clashes: ['energetic'] },
  shy: { id: 'shy', name: 'Shy', icon: '🙈', temper: true, blurb: 'Keeps to the quiet side of the island and hides behind things.', clashes: ['showoff', 'social'] },
  curious: { id: 'curious', name: 'Curious', icon: '🔍', temper: true, blurb: 'Pokes at everything. Digs up more interesting finds.' },
  grumpy: { id: 'grumpy', name: 'Grumpy', icon: '😤', temper: true, blurb: 'Grumbles at neighbours. Squabbles, but means well.', clashes: ['friendly'] },
  friendly: { id: 'friendly', name: 'Friendly', icon: '💕', temper: true, blurb: 'Says hello to everyone it meets.', clashes: ['grumpy', 'loner'] },
  lucky: { id: 'lucky', name: 'Lucky', icon: '🍀', blurb: 'Finds more coins and Starshards when it digs, fishes or forages.' },
  digger: { id: 'digger', name: 'Digger', icon: '⛏️', blurb: 'Digs things up twice as often.' },
  greedy: { id: 'greedy', name: 'Greedy', icon: '💰', blurb: 'Can\'t resist shiny things. Runs over and collects coins on the ground for you.' },
  sleepy: { id: 'sleepy', name: 'Sleepy', icon: '💤', blurb: 'Takes long naps, even in the middle of the day.', clashes: ['nightowl', 'earlybird'] },
  glutton: { id: 'glutton', name: 'Glutton', icon: '🍰', blurb: 'Lingers at lures, eating every last crumb.' },
  brave: { id: 'brave', name: 'Brave', icon: '🦁', blurb: 'Never hides from storms or snow. Sometimes the sky changes it for it.', clashes: ['shy'] },
  nightowl: { id: 'nightowl', name: 'Night Owl', icon: '🦉', blurb: 'Stays up all night, whatever its kind usually does.', clashes: ['earlybird', 'sleepy'] },
  earlybird: { id: 'earlybird', name: 'Early Bird', icon: '🌅', blurb: 'Up with the sun, even if its kind sleeps by day.', clashes: ['nightowl', 'sleepy'] },
  social: { id: 'social', name: 'Social', icon: '🤝', blurb: 'Seeks out company and makes friends quickly.', clashes: ['loner', 'shy'] },
  loner: { id: 'loner', name: 'Loner', icon: '🌙', blurb: 'Prefers its own company and wanders off on its own.', clashes: ['social', 'friendly'] },
  swimmer: { id: 'swimmer', name: 'Swimmer', icon: '🏊', blurb: 'Loves the water. Wades and paddles even if its kind doesn\'t.' },
  explorer: { id: 'explorer', name: 'Explorer', icon: '🧭', blurb: 'Wanders all the way around the island.' },
  showoff: { id: 'showoff', name: 'Show-off', icon: '✨', blurb: 'Strikes a pose whenever someone is watching.', clashes: ['shy'] },
  musical: { id: 'musical', name: 'Musical', icon: '🎵', blurb: 'Sings little songs. Nearby creatures cheer up.' },
  clumsy: { id: 'clumsy', name: 'Clumsy', icon: '💫', blurb: 'Trips over its own feet now and then. Bounces right back.' },
};

export const QUIRK_IDS = Object.keys(QUIRKS) as QuirkId[];
export const TEMPER_QUIRKS = QUIRK_IDS.filter((q) => QUIRKS[q].temper);
