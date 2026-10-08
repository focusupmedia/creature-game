// The update log shown in Settings → What's new. Newest first; keep lines short and friendly.

export interface UpdateNote { version: string; date: string; lines: string[] }

export const UPDATES: UpdateNote[] = [
  {
    version: '0.10', date: 'October 2026', lines: [
      'Friends! Swap friend codes to visit each other\'s groves and open a gift from each friend every day.',
      'Weekly events: a new themed week every Monday with a bonus and a prize, plus big holiday festivals.',
      'Daily streaks: your login gift grows every day in a row, with big presents at 3, 7, 14, 30, 60 and 100 days.',
      'Share a picture of your best creatures with the new Share button.',
      'Achievements, plus Game Center and Google Play Games leaderboards.',
      'Your first eggs hatch faster.',
      'A calmer start: buttons appear one at a time as you level up, and news waits while you do Lotl\'s Quest.',
      'Lotl\'s Quest now sits at the bottom left, so pop-ups never cover it. Tap a pop-up to put it away.',
      'Little gesture tips show up right when you need them.',
      'See how many creatures you\'ve found at a glance, name your first baby, and Lotl\'s Egg always glows.',
      'Finish Lotl\'s Quest for a Sleepy Egg that hatches the next day.',
    ],
  },
  {
    version: '0.9', date: 'October 2026', lines: [
      'Daily Rumours: Lotl hears a new whisper about a hidden creature every day.',
      'Halloween Pass creatures: Pumpkit when you unlock the pass, Peekaboo the ghost at tier 1, and Gloomwing, a Mythical bat, at the last tier.',
      'Field Journal: a "How to get" tab remembers how you found or bred each creature.',
      'Hatching: your new creature spins and turns to say hello.',
      'Shop: lures, food and gadgets now come in at random, with limited stock.',
      'Gadgets (like the Nursery) have their own shop tab and some have a limit.',
      'Nursery eggs are ready to hatch straight away and need no nest.',
      'Friendly pets bring gifts more often. Shy pets sometimes ignore you.',
      'Lure visitors are easier to spot, and tapping their alert takes you there.',
      'Mythicals are rarer. Shorter tutorial. Placed items follow bigger worlds.',
      'Kindred Font is now the Kindred Fountain.',
      'Selling shows how each mutation multiplies the price.',
      "Lotl's Quest: easy first goals that win an egg with a creature you don't have.",
      'A brand-new Halloween Pass screen.',
      'Your first lure gets a visitor right away, and new visitors show a ! (even through clouds) until you tap them.',
      'Make space: the Release button now lights up when picked, just like Store.',
    ],
  },
  {
    version: '0.8', date: 'September 2026', lines: [
      'Halloween season and the Halloween Pass.',
      'Nests you place yourself, the Nursery and rarity totems.',
      'Sell booths, premium eggs and lures, cloud save.',
    ],
  },
  {
    version: '0.7', date: 'August 2026', lines: [
      'Cloud Isle, levels up to 100, expeditions, contests and the Market board.',
    ],
  },
];
