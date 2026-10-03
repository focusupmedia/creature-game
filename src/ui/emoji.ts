// Every emoji the game uses, redrawn as a chunky SVG icon in the house style
// (flat fills, thick navy outlines, a white gloss). Text anywhere in the UI is
// run through emojify(), and creature emote bubbles draw these too, so the game
// looks the same on every phone instead of using each phone's emoji font.

import { COIN, CREATE, GEAR, GEM, GESTURE_PINCH, GESTURE_TWIST, HAND_OPEN, HAND_POINT, HAND_RIGHT, HAND_WAVE, JOURNAL, MONKEY, PAW, POTION } from './icons';

const INK = '#1b2a4a';
const O = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const o3 = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body: string) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
const gloss = (d: string) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`;

// ---------------------------------------------------------------- building blocks

const star = (cx: number, cy: number, r: number, fill: string, extra = O) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return `<path d="${d}Z" fill="${fill}" ${extra}/>`;
};
const sparkle = (cx: number, cy: number, r: number, fill = '#ffd21a') =>
  `<path d="M${cx} ${cy - r}Q${cx + r * 0.2} ${cy - r * 0.2} ${cx + r} ${cy}Q${cx + r * 0.2} ${cy + r * 0.2} ${cx} ${cy + r}Q${cx - r * 0.2} ${cy + r * 0.2} ${cx - r} ${cy}Q${cx - r * 0.2} ${cy - r * 0.2} ${cx} ${cy - r}Z" fill="${fill}" ${o3}/>`;
const heart = (cx: number, cy: number, s: number, fill: string, stroke = O) =>
  `<path transform="translate(${cx} ${cy}) scale(${s})" d="M0 14C-14 4-20-3-20-10a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 7-6 14-20 24z" fill="${fill}" ${stroke}/>`;
const cloud = (x: number, y: number, s: number, fill = '#ffffff') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M-18 8a9 9 0 0 1 1-18 12 12 0 0 1 22-4 10 10 0 0 1 14 9 8 8 0 0 1-1 13z" fill="${fill}" ${O}/>`;
const drop = (x: number, y: number, s: number, fill = '#3aa8ff') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0-14C6-5 10 0 10 5a10 10 0 0 1-20 0c0-5 4-10 10-19z" fill="${fill}" ${O}/>`;
const sun = (cx: number, cy: number, r: number) => {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rays += `<path d="M${(cx + Math.cos(a) * (r + 4)).toFixed(1)} ${(cy + Math.sin(a) * (r + 4)).toFixed(1)}L${(cx + Math.cos(a) * (r + 10)).toFixed(1)} ${(cy + Math.sin(a) * (r + 10)).toFixed(1)}" stroke="#ff9f1a" stroke-width="5" stroke-linecap="round"/>`;
  }
  return `${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd21a" ${O}/>`;
};

/** A round face; `eyes` and `mouth` are SVG fragments drawn on top. */
const face = (eyes: string, mouth: string, fill = '#ffd23d', extra = '') =>
  svg(`<circle cx="32" cy="33" r="25" fill="${fill}" ${O}/>${gloss('M17 22a17 17 0 0 1 9-7')}${extra}${eyes}${mouth}`);
const dotEyes = `<circle cx="24" cy="30" r="3.5" fill="${INK}"/><circle cx="40" cy="30" r="3.5" fill="${INK}"/>`;
const happyEyes = `<path d="M19 31q5-6 10 0M35 31q5-6 10 0" fill="none" ${O}/>`;
const shutEyes = `<path d="M19 30q5 4 10 0M35 30q5 4 10 0" fill="none" ${O}/>`;
const blush = `<ellipse cx="17" cy="39" rx="4" ry="2.5" fill="#ff8fb0"/><ellipse cx="47" cy="39" rx="4" ry="2.5" fill="#ff8fb0"/>`;
const smile = `<path d="M23 41q9 8 18 0" fill="none" ${O}/>`;

// ---------------------------------------------------------------- the icons

const ICONS: Record<string, string> = {
  // --- stars and sparkles
  '✨': svg(`${sparkle(26, 34, 18)}${sparkle(48, 16, 10)}${sparkle(50, 46, 7)}`),
  '★': svg(star(32, 33, 26, '#ffd21a')),
  '⭐': svg(star(32, 33, 26, '#ffd21a')),
  '☆': svg(star(32, 33, 26, '#ffffff')),
  '✦': svg(sparkle(32, 32, 26, '#c9a8ff')),
  '🌟': svg(`<circle cx="32" cy="33" r="27" fill="#fff3a0" opacity=".6"/>${star(32, 33, 23, '#ffd21a')}`),
  '💫': svg(`<path d="M10 40c0-16 24-22 34-10 6 8-2 18-12 14-6-3-4-11 2-11" fill="none" stroke="#ffd21a" stroke-width="7" stroke-linecap="round"/><path d="M10 40c0-16 24-22 34-10 6 8-2 18-12 14-6-3-4-11 2-11" fill="none" ${o3}/>${star(48, 14, 10, '#ffd21a', o3)}`),
  '🌠': svg(`<path d="M6 50L34 26" stroke="#ffe680" stroke-width="9" stroke-linecap="round"/><path d="M12 56L36 34" stroke="#ff9fcf" stroke-width="5" stroke-linecap="round"/>${star(42, 22, 16, '#ffd21a')}`),
  '☄': svg(`<path d="M8 52Q22 30 40 24L46 34Q30 44 8 52z" fill="#ff9f1a" ${O}/><circle cx="44" cy="24" r="12" fill="#8a6a5a" ${O}/><circle cx="41" cy="21" r="3" fill="#5a4a46"/>`),

  // --- hearts
  '❤': svg(heart(32, 30, 1.25, '#ff4a6a') + gloss('M14 22a6 6 0 0 1 6-5')),
  '♥': svg(heart(32, 30, 1.25, '#ff4a8b') + gloss('M14 22a6 6 0 0 1 6-5')),
  '💚': svg(heart(32, 30, 1.25, '#5fd03a') + gloss('M14 22a6 6 0 0 1 6-5')),
  '🤍': svg(heart(32, 30, 1.25, '#ffffff')),
  '♡': svg(heart(32, 30, 1.25, '#ffffff')),
  '💕': svg(heart(24, 34, 0.95, '#ff5f9a') + heart(44, 20, 0.6, '#ff9fcf')),
  '💞': svg(heart(22, 36, 0.85, '#ff5f9a') + heart(44, 24, 0.7, '#ff9fcf') + `<path d="M10 20q10-14 26-10" fill="none" stroke="#ff5f9a" stroke-width="4" stroke-linecap="round"/>`),

  // --- emotes
  '❗': svg(`<rect x="24" y="6" width="16" height="36" rx="8" fill="#ff4a4a" ${O}/><circle cx="32" cy="53" r="7" fill="#ff4a4a" ${O}/>${gloss('M30 12v14')}`),
  '❓': svg(`<path d="M18 22a14 14 0 1 1 22 11c-5 3-6 5-6 10" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M18 22a14 14 0 1 1 22 11c-5 3-6 5-6 10" fill="none" stroke="#3aa8ff" stroke-width="7" stroke-linecap="round"/><circle cx="34" cy="55" r="6" fill="#3aa8ff" ${O}/>`),
  '❔': svg(`<path d="M18 22a14 14 0 1 1 22 11c-5 3-6 5-6 10" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M18 22a14 14 0 1 1 22 11c-5 3-6 5-6 10" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/><circle cx="34" cy="55" r="6" fill="#ffffff" ${O}/>`),
  '💤': svg(`<path d="M30 10h18L32 30h18" fill="none" stroke="${INK}" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/><path d="M30 10h18L32 30h18" fill="none" stroke="#9ab8ff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><path d="M12 36h12L14 50h12" fill="none" stroke="${INK}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/><path d="M12 36h12L14 50h12" fill="none" stroke="#c8d8ff" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`),
  '💢': svg(`<g fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"><path d="M26 10q2 12-14 14M38 10q-2 12 14 14M26 54q2-12-14-14M38 54q-2-12 14-14"/></g><g fill="none" stroke="#ff4a4a" stroke-width="6" stroke-linecap="round"><path d="M26 10q2 12-14 14M38 10q-2 12 14 14M26 54q2-12-14-14M38 54q-2-12 14-14"/></g>`),
  '🎵': svg(`<path d="M26 46V14l24-6v30" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M26 16l24-6v8l-24 6z" fill="${INK}"/><ellipse cx="19" cy="47" rx="9" ry="7" fill="#7a5aff" ${O}/><ellipse cx="43" cy="39" rx="9" ry="7" fill="#7a5aff" ${O}/>`),
  '🔍': svg(`<path d="M38 38l16 16" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M38 38l16 16" stroke="#b0742e" stroke-width="5" stroke-linecap="round"/><circle cx="26" cy="26" r="17" fill="#cdeeff" ${O}/>${gloss('M17 22a10 10 0 0 1 7-7')}`),
  '👀': svg(`<ellipse cx="20" cy="32" rx="12" ry="16" fill="#fff" ${O}/><ellipse cx="44" cy="32" rx="12" ry="16" fill="#fff" ${O}/><circle cx="24" cy="34" r="6" fill="${INK}"/><circle cx="48" cy="34" r="6" fill="${INK}"/><circle cx="26" cy="32" r="2" fill="#fff"/><circle cx="50" cy="32" r="2" fill="#fff"/>`),
  '😤': face(`<path d="M18 27l10 4M46 27l-10 4" fill="none" ${O}/>`, `<path d="M25 45h14" fill="none" ${O}/>`, '#ffd23d', `<path d="M8 48q-4-6 2-10M56 48q4-6-2-10" fill="#fff" ${o3}/>`),
  '😠': face(`<path d="M18 26l10 4M46 26l-10 4" fill="none" ${O}/>${dotEyes}`, `<path d="M24 47q8-7 16 0" fill="none" ${O}/>`, '#ff9a5a'),
  '😴': face(shutEyes, `<ellipse cx="32" cy="45" rx="4" ry="5" fill="${INK}"/>`),
  '😋': face(happyEyes, `<path d="M22 40q10 9 20 0z" fill="${INK}"/><path d="M33 44q6 2 4 8-6 0-6-6z" fill="#ff6a8a" ${o3}/>`),
  '😳': face(`<circle cx="24" cy="30" r="6" fill="#fff" ${o3}/><circle cx="40" cy="30" r="6" fill="#fff" ${o3}/><circle cx="24" cy="30" r="2.5" fill="${INK}"/><circle cx="40" cy="30" r="2.5" fill="${INK}"/>${blush}`, `<path d="M27 46h10" fill="none" ${O}/>`),
  '😮': face(dotEyes, `<ellipse cx="32" cy="45" rx="5" ry="6" fill="${INK}"/>`),
  '😆': face(`<path d="M19 26l8 4-8 4M45 26l-8 4 8 4" fill="none" ${O}/>`, `<path d="M20 40q12 14 24 0z" fill="${INK}"/>`),
  '😊': face(happyEyes + blush, smile),
  '😅': face(happyEyes, smile, '#ffd23d', drop(50, 18, 0.45, '#8fd8ff')),
  '🥶': face(`<path d="M19 29l8 2M45 29l-8 2" fill="none" ${O}/>`, `<path d="M22 45l4-3 4 3 4-3 4 3 4-3" fill="none" ${o3}/>`, '#8fc8ff'),
  '😎': face(`<path d="M12 26h40l-2 10q-8 4-14-2h-8q-6 6-14 2z" fill="${INK}"/>`, smile),
  '😇': face(happyEyes, smile, '#ffd23d', `<ellipse cx="32" cy="8" rx="16" ry="5" fill="none" stroke="#ffe27a" stroke-width="6"/><ellipse cx="32" cy="8" rx="16" ry="5" fill="none" ${o3}/>`),
  '😈': face(`<path d="M18 26l10 4M46 26l-10 4" fill="none" ${O}/>`, `<path d="M22 41q10 9 20 0" fill="none" ${O}/>`, '#a85ad8', `<path d="M12 18L8 4l14 8M52 18l4-14-14 8" fill="#a85ad8" ${O}/>`),
  '🙈': face(`<ellipse cx="22" cy="30" rx="10" ry="8" fill="#c8915a" ${O}/><ellipse cx="42" cy="30" rx="10" ry="8" fill="#c8915a" ${O}/>`, `<path d="M26 45q6 4 12 0" fill="none" ${O}/>`, '#a8743a'),
  '👺': face(`<path d="M18 26l10 4M46 26l-10 4" fill="none" ${O}/>${dotEyes}`, `<path d="M22 44q10 6 20 0" fill="none" ${O}/><path d="M26 44l2 5 3-4 3 4 2-5" fill="#fff" ${o3}/>`, '#7ac04a', `<path d="M9 32L-2 22l12 2M55 32l11-10-12 2" fill="#7ac04a" ${O}/>`),
  '👼': face(happyEyes + blush, smile, '#ffd8b0', `<ellipse cx="32" cy="8" rx="15" ry="5" fill="none" stroke="#ffe27a" stroke-width="6"/><path d="M8 40q-8-10 0-18 6 4 4 14zM56 40q8-10 0-18-6 4-4 14z" fill="#fff" ${o3}/>`),

  // --- hands (clean silhouettes, see icons.ts)
  '👆': HAND_POINT,
  '👉': HAND_RIGHT,
  '✋': HAND_OPEN,
  '🤏': GESTURE_PINCH,
  '👋': HAND_WAVE,
  '🤝': svg(`<g fill="${INK}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"><rect x="4" y="26" width="28" height="14" rx="7"/><rect x="32" y="26" width="28" height="14" rx="7"/><ellipse cx="32" cy="33" rx="12" ry="11"/></g><rect x="4" y="26" width="16" height="14" rx="5" fill="#3aa8ff"/><rect x="44" y="26" width="16" height="14" rx="5" fill="#ff7ab0"/><ellipse cx="32" cy="33" rx="12" ry="11" fill="#ffd3ad"/><path d="M26 28v10M31 27v12M36 28v10" stroke="#f2b384" stroke-width="3" stroke-linecap="round"/>`),
  '🔄': GESTURE_TWIST,

  // --- sky and weather
  '☀': svg(sun(32, 32, 14)),
  '🌤': svg(sun(24, 24, 11) + cloud(38, 44, 1.1)),
  '🌅': svg(`<rect x="4" y="38" width="56" height="20" rx="6" fill="#3aa8ff" ${O}/><path d="M14 38a18 18 0 0 1 36 0z" fill="#ffb02a" ${O}/><path d="M32 10v8M14 18l5 5M50 18l-5 5" stroke="#ff9f1a" stroke-width="5" stroke-linecap="round"/><path d="M12 48h14M34 48h16" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`),
  '🌇': svg(`<rect x="4" y="38" width="56" height="20" rx="6" fill="#7a5ad8" ${O}/><path d="M14 38a18 18 0 0 1 36 0z" fill="#ff7a4a" ${O}/><path d="M32 10v8M14 18l5 5M50 18l-5 5" stroke="#ff7a4a" stroke-width="5" stroke-linecap="round"/><path d="M12 48h14M34 48h16" stroke="#ffb0d0" stroke-width="4" stroke-linecap="round" opacity=".8"/>`),
  '🌙': svg(`<path d="M40 6a26 26 0 1 0 18 38A22 22 0 0 1 40 6z" fill="#ffe680" ${O}/>${gloss('M16 26a18 18 0 0 1 8-12')}`),
  '🌕': svg(`<circle cx="32" cy="32" r="26" fill="#fff4c0" ${O}/><circle cx="24" cy="24" r="5" fill="#e8d890"/><circle cx="40" cy="40" r="7" fill="#e8d890"/><circle cx="42" cy="22" r="3" fill="#e8d890"/>`),
  '🌘': svg(`<circle cx="32" cy="32" r="27" fill="#ffd21a" opacity=".55"/><circle cx="32" cy="32" r="22" fill="#2a1d4a" ${O}/><path d="M42 14a22 22 0 0 1 0 36" fill="none" stroke="#ffe680" stroke-width="5"/>`),
  '⛈': svg(`${cloud(32, 26, 1.4, '#8a94a8')}<path d="M30 40l-6 12h8l-4 10 14-16h-8l4-6z" fill="#ffd21a" ${o3}/>`),
  '⚡': svg(`<path d="M36 4L12 36h16l-6 24 28-34H34z" fill="#ffd21a" ${O}/>${gloss('M30 14l-8 12')}`),
  '☔': svg(`<path d="M6 32a26 26 0 0 1 52 0q-6-5-13 0-6-5-13 0-7-5-13 0-7-5-13 0z" fill="#ff5f9a" ${O}/><path d="M32 32v20a5 5 0 0 1-10 0" fill="none" ${O}/>${drop(52, 50, 0.5)}${drop(12, 52, 0.45)}`),
  '🌦': svg(sun(20, 20, 9) + cloud(36, 32, 1.15, '#e8eef6') + drop(28, 54, 0.4) + drop(44, 54, 0.4)),
  '❄': svg(`<g stroke="${INK}" stroke-width="10" stroke-linecap="round"><path d="M32 6v52M10 19l44 26M10 45l44-26"/></g><g stroke="#bfe8ff" stroke-width="5" stroke-linecap="round"><path d="M32 6v52M10 19l44 26M10 45l44-26"/></g><circle cx="32" cy="32" r="6" fill="#fff" ${o3}/>`),
  '🌨': svg(`${cloud(32, 24, 1.4, '#e8eef6')}<g fill="#fff" ${o3}><circle cx="20" cy="50" r="4"/><circle cx="34" cy="56" r="4"/><circle cx="46" cy="48" r="4"/></g>`),
  '🌈': svg(`<path d="M4 50a28 28 0 0 1 56 0" fill="none" stroke="${INK}" stroke-width="26"/><path d="M4 50a28 28 0 0 1 56 0" fill="none" stroke="#ff4a4a" stroke-width="20"/><path d="M10 50a22 22 0 0 1 44 0" fill="none" stroke="#ffb02a" stroke-width="7"/><path d="M15 50a17 17 0 0 1 34 0" fill="none" stroke="#ffe23a" stroke-width="6"/><path d="M20 50a12 12 0 0 1 24 0" fill="none" stroke="#5ad64a" stroke-width="6"/><path d="M25 50a7 7 0 0 1 14 0" fill="none" stroke="#3aa8ff" stroke-width="5"/>${cloud(12, 52, 0.55)}${cloud(54, 52, 0.55)}`),
  '🌌': svg(`<rect x="4" y="4" width="56" height="56" rx="14" fill="#14204a" ${O}/><path d="M6 40q12-20 24-8t28-14" fill="none" stroke="#4affc8" stroke-width="8" stroke-linecap="round" opacity=".9"/><path d="M6 50q14-16 26-6t26-12" fill="none" stroke="#b07aff" stroke-width="6" stroke-linecap="round" opacity=".9"/><circle cx="16" cy="16" r="2" fill="#fff"/><circle cx="44" cy="12" r="2" fill="#fff"/><circle cx="34" cy="22" r="1.5" fill="#fff"/>`),
  '🌫': svg(`<g fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"><path d="M8 18q12-6 24 0t24 0M8 32q12-6 24 0t24 0M8 46q12-6 24 0t24 0"/></g><g fill="none" stroke="#e8eef4" stroke-width="5" stroke-linecap="round"><path d="M8 18q12-6 24 0t24 0M8 32q12-6 24 0t24 0M8 46q12-6 24 0t24 0"/></g>`),

  // --- nature and places
  '🌳': svg(`<rect x="27" y="38" width="10" height="20" rx="3" fill="#b0642e" ${O}/><g fill="${INK}" stroke="${INK}" stroke-width="8"><circle cx="20" cy="30" r="12"/><circle cx="44" cy="30" r="12"/><circle cx="32" cy="20" r="14"/><circle cx="32" cy="34" r="11"/></g><g fill="#5fbf4a"><circle cx="20" cy="30" r="12"/><circle cx="44" cy="30" r="12"/><circle cx="32" cy="20" r="14"/><circle cx="32" cy="34" r="11"/></g><path d="M14 34q6 6 14 4M36 38q8 2 14-4" fill="none" stroke="#3f9a32" stroke-width="3" stroke-linecap="round"/>${gloss('M24 14a10 10 0 0 1 8-4')}`),
  '🌱': svg(`<path d="M32 58V30" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M32 58V30" stroke="#5fbf4a" stroke-width="4" stroke-linecap="round"/><path d="M32 32C30 18 18 12 8 14c0 12 10 20 24 18zM32 28c2-12 12-18 24-16-2 12-12 18-24 16z" fill="#7ed321" ${O}/>`),
  '🌿': svg(`<path d="M12 54L50 12" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M12 54L50 12" stroke="#4fae3a" stroke-width="3" stroke-linecap="round"/><g fill="#7ed321" ${o3}><path d="M22 42q-14-2-14-14 12 0 14 14zM30 34q-12-4-10-16 12 2 10 16zM38 24q-8-6-4-16 10 4 4 16zM26 46q2 12 14 12 0-12-14-12zM34 38q4 12 16 10-2-12-16-10z"/></g>`),
  '🪴': svg(`<path d="M16 38h32l-4 20H20z" fill="#ff9f1a" ${O}/><path d="M32 38V24" stroke="${INK}" stroke-width="4"/><path d="M32 26q-14 0-16-14 14 0 16 14zM32 26q14 0 16-14-14 0-16 14z" fill="#5fbf4a" ${O}/>`),
  '🌸': svg(`<g fill="#ffb0d0" ${O}>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="32" cy="16" rx="9" ry="12" transform="rotate(${a} 32 32)"/>`).join('')}</g><circle cx="32" cy="32" r="7" fill="#ffd21a" ${O}/>`),
  '🍀': svg(`<g fill="#5fd03a" ${O}>${[0, 90, 180, 270].map((a) => `<path transform="rotate(${a} 32 30)" d="M32 30C22 30 16 20 22 14c4-4 10-2 10 4 0-6 6-8 10-4 6 6 0 16-10 16z"/>`).join('')}</g><path d="M32 32q4 16 12 26" fill="none" ${O}/>`),
  '🫐': svg(`<circle cx="22" cy="38" r="12" fill="#5a6ad8" ${O}/><circle cx="42" cy="38" r="12" fill="#4a5ac8" ${O}/><circle cx="32" cy="22" r="12" fill="#6a7ae8" ${O}/><path d="M28 18l4 4 4-4" fill="none" ${o3}/>`),
  '🍓': svg(`<path d="M32 58C14 46 10 30 16 22c6-6 26-6 32 0 6 8 2 24-16 36z" fill="#ff4a5a" ${O}/><path d="M18 20q6-10 14-4 8-6 14 4-8 2-14-2-6 4-14 2z" fill="#5fbf4a" ${O}/><g fill="#ffe680"><circle cx="24" cy="32" r="2"/><circle cx="38" cy="30" r="2"/><circle cx="30" cy="42" r="2"/><circle cx="40" cy="42" r="2"/></g>`),
  '🪸': svg(`<path d="M30 58V40L18 28V14M30 40l10-12V12M30 46l14-8 4-14M18 28l-8-6" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 58V40L18 28V14M30 40l10-12V12M30 46l14-8 4-14M18 28l-8-6" fill="none" stroke="#ff7a8a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  '🌋': svg(`<path d="M4 58l18-34h20l18 34z" fill="#8a5a4a" ${O}/><path d="M22 24h20l-4 8-6-4-6 6z" fill="#ff6a1a" ${o3}/><path d="M26 18q-2-8 6-10 6 4 2 10" fill="#ffb02a" ${o3}/>`),
  '⛰': svg(`<path d="M4 56L26 14l12 18 6-8 16 32z" fill="#8a9aa8" ${O}/><path d="M20 26l6-12 6 10-6 4z" fill="#fff" ${o3}/>`),
  '🏖': svg(`<path d="M4 50q28-10 56 0v8H4z" fill="#ffd88a" ${O}/><path d="M34 52L22 16" stroke="${INK}" stroke-width="4"/><path d="M8 22q12-14 30-6-14 0-30 6z" fill="#ff5f5a" ${O}/>${sun(50, 14, 6)}`),
  '🏜': svg(`<path d="M2 54q16-16 30-6t30-4v14H2z" fill="#f0c070" ${O}/><path d="M40 46V20a5 5 0 0 1 10 0v26M40 34h-6v-8M50 30h6v-8" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M40 46V20a5 5 0 0 1 10 0v26M40 34h-6v-8M50 30h6v-8" fill="none" stroke="#5fbf4a" stroke-width="5" stroke-linecap="round"/>`),
  '🌊': svg(`<path d="M4 46q10-30 34-26-14 6-8 16 8 10 26 2v18H4z" fill="#3aa8ff" ${O}/><path d="M38 20q10 2 8 10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`),
  '💧': svg(drop(32, 34, 2.1) + gloss('M24 40a8 8 0 0 0 4 8')),
  '🫧': svg(`<circle cx="24" cy="36" r="16" fill="#cdeeff" ${O}/><circle cx="46" cy="18" r="10" fill="#cdeeff" ${O}/><circle cx="48" cy="46" r="6" fill="#cdeeff" ${O}/>${gloss('M14 30a10 10 0 0 1 6-6')}`),
  '🔥': svg(`<path d="M32 60c-14 0-20-10-18-20 2-10 10-12 10-24 8 4 12 10 12 16 2-4 2-8 0-12 10 6 16 16 14 24-2 10-8 16-18 16z" fill="#ff6a1a" ${O}/><path d="M32 56c-6 0-9-4-8-9 1-4 5-6 5-11 6 4 10 8 10 12 0 5-3 8-7 8z" fill="#ffd21a"/>`),

  // --- creatures and folk
  '🐒': MONKEY,
  '🐾': PAW,
  '🐦': svg(`<path d="M10 36q2-20 24-20 14 0 18 12l10 4-10 4c-2 12-12 18-24 18-12 0-18-8-18-18z" fill="#3aa8ff" ${O}/><path d="M24 38q8 10 20 0" fill="#bfe8ff" ${o3}/><circle cx="42" cy="28" r="3.5" fill="${INK}"/>`),
  '🦎': svg(`<path d="M10 30q-6 10 4 16t22 0" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M10 30q-6 10 4 16t22 0" fill="none" stroke="#5fbf4a" stroke-width="5" stroke-linecap="round"/><g fill="${INK}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"><ellipse cx="34" cy="34" rx="14" ry="9"/><ellipse cx="50" cy="28" rx="9" ry="7"/><rect x="24" y="38" width="6" height="12" rx="3" transform="rotate(25 27 44)"/><rect x="38" y="38" width="6" height="12" rx="3" transform="rotate(-25 41 44)"/><rect x="24" y="20" width="6" height="12" rx="3" transform="rotate(-25 27 26)"/><rect x="38" y="20" width="6" height="12" rx="3" transform="rotate(25 41 26)"/></g><g fill="#5fbf4a"><ellipse cx="34" cy="34" rx="14" ry="9"/><ellipse cx="50" cy="28" rx="9" ry="7"/><rect x="24" y="38" width="6" height="12" rx="3" transform="rotate(25 27 44)"/><rect x="38" y="38" width="6" height="12" rx="3" transform="rotate(-25 41 44)"/><rect x="24" y="20" width="6" height="12" rx="3" transform="rotate(-25 27 26)"/><rect x="38" y="20" width="6" height="12" rx="3" transform="rotate(25 41 26)"/></g><g fill="#ffd21a"><circle cx="30" cy="32" r="2.5"/><circle cx="38" cy="35" r="2.5"/></g><circle cx="52" cy="26" r="2.5" fill="${INK}"/>`),
  '🐜': svg(`<g fill="#7a3a2a" ${O}><circle cx="14" cy="34" r="8"/><ellipse cx="30" cy="34" rx="7" ry="6"/><ellipse cx="48" cy="34" rx="11" ry="9"/></g><path d="M26 30l-6-12M34 30l4-12M30 40l-6 12M34 40l6 12M10 28l-6-8M16 28l2-10" fill="none" ${o3}/>`),
  '🦁': svg(`<circle cx="32" cy="32" r="27" fill="#d07a2a" ${O}/><circle cx="32" cy="34" r="17" fill="#ffc04a" ${O}/>${dotEyes}<path d="M28 40h8l-4 4z" fill="${INK}"/>`),
  '🦉': svg(`<path d="M12 18l10 6h20l10-6v28c0 8-8 14-20 14S12 54 12 46z" fill="#a8743a" ${O}/><circle cx="23" cy="32" r="8" fill="#fff" ${O}/><circle cx="41" cy="32" r="8" fill="#fff" ${O}/><circle cx="23" cy="32" r="3.5" fill="${INK}"/><circle cx="41" cy="32" r="3.5" fill="${INK}"/><path d="M29 40h6l-3 5z" fill="#ffb02a" ${o3}/>`),
  '🏊': svg(`<path d="M4 46q7-6 14 0t14 0 14 0 14 0v12H4z" fill="#3aa8ff" ${O}/><circle cx="40" cy="22" r="8" fill="#ffd0a8" ${O}/><path d="M12 40l14-12 10 6" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M12 40l14-12 10 6" fill="none" stroke="#ffd0a8" stroke-width="5" stroke-linecap="round"/>`),

  // --- things
  '⚙': GEAR,
  '⛲': CREATE,
  '📖': JOURNAL,
  '🧪': POTION,
  '🪙': COIN,
  '💎': GEM,
  '🥚': svg(`<ellipse cx="32" cy="35" rx="19" ry="24" fill="#fff4e0" ${O}/><path d="M16 36c5 3 9-3 16 0s11 3 16 0" fill="none" stroke="#7ed321" stroke-width="5" stroke-linecap="round"/>${gloss('M22 20a12 12 0 0 1 8-8')}`),
  '🐣': svg(`<path d="M12 36h40c0 14-8 22-20 22s-20-8-20-22z" fill="#fff4e0" ${O}/><path d="M12 36l7-6 6 6 7-6 7 6 6-6 7 6" fill="none" ${O}/><circle cx="32" cy="22" r="13" fill="#ffd23d" ${O}/><circle cx="27" cy="20" r="2.5" fill="${INK}"/><circle cx="37" cy="20" r="2.5" fill="${INK}"/><path d="M29 25h6l-3 4z" fill="#ff9f1a" ${o3}/>`),
  '🪺': svg(`<path d="M6 34h52c-2 14-12 22-26 22S8 48 6 34z" fill="#b0742e" ${O}/><path d="M10 42q22 8 44 0" fill="none" ${o3}/><ellipse cx="24" cy="30" rx="8" ry="10" fill="#cdeeff" ${O}/><ellipse cx="40" cy="30" rx="8" ry="10" fill="#fff4e0" ${O}/>`),
  '🫙': svg(`<rect x="16" y="8" width="32" height="10" rx="3" fill="#b0742e" ${O}/><path d="M14 18h36v34a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill="#cdeeff" ${O}/><path d="M18 34h28v18a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#ffb02a"/>${gloss('M20 24v10')}`),
  '🧺': svg(`<path d="M16 26q16-22 32 0" fill="none" stroke="${INK}" stroke-width="10"/><path d="M16 26q16-22 32 0" fill="none" stroke="#d09a4a" stroke-width="5"/><path d="M8 26h48l-6 30H14z" fill="#d09a4a" ${O}/><path d="M12 36h40M14 46h36M24 26l2 30M40 26l-2 30" fill="none" stroke="#9a6a2a" stroke-width="3"/>`),
  '🎁': svg(`<rect x="8" y="24" width="48" height="12" rx="3" fill="#ff5f9a" ${O}/><rect x="12" y="36" width="40" height="22" rx="3" fill="#ff7ab0" ${O}/><path d="M32 24v34" stroke="#ffd21a" stroke-width="8"/><path d="M32 24q-16-16-16-4 0 4 16 4 16 0 16-4 0-12-16 4z" fill="#ffd21a" ${O}/>`),
  '🎩': svg(`<ellipse cx="32" cy="50" rx="27" ry="8" fill="#3a3650" ${O}/><path d="M16 50V16q16-6 32 0v34z" fill="#3a3650" ${O}/><rect x="16" y="36" width="32" height="7" fill="#e2483d"/>${gloss('M22 20v12')}`),
  '🍖': svg(`<path d="M10 54l10-10" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M10 54l10-10" stroke="#fff4e0" stroke-width="6" stroke-linecap="round"/><path d="M18 38c-6-14 6-30 22-30 12 0 18 10 16 20-2 14-18 22-30 18z" fill="#c8603a" ${O}/>${gloss('M30 16a12 12 0 0 1 10-2')}`),
  '💰': svg(`<path d="M24 16h16l-4 6q18 8 18 22c0 10-8 14-22 14S10 54 10 44c0-14 14-22 18-22z" fill="#d8a84a" ${O}/><path d="M22 10h20l-4 6H26z" fill="#d8a84a" ${O}/><text x="32" y="48" font-size="20" text-anchor="middle" font-family="sans-serif" font-weight="900" fill="${INK}">$</text>`),
  '📝': svg(`<rect x="10" y="6" width="38" height="52" rx="4" fill="#fff8e6" ${O}/><path d="M18 20h22M18 30h22M18 40h12" stroke="#9ab0c8" stroke-width="4" stroke-linecap="round"/><path d="M54 22L34 50l-6 2 2-6 20-28z" fill="#ffd21a" ${O}/>`),
  '📜': svg(`<path d="M14 12h32a6 6 0 0 1 6 6v36H22a6 6 0 0 1-6-6V18" fill="#f4e2b0" ${O}/><path d="M8 18a6 6 0 0 1 12 0v6H8z" fill="#e8c88a" ${O}/><path d="M26 24h18M26 34h18M26 44h12" stroke="#b0742e" stroke-width="4" stroke-linecap="round"/>`),
  '📦': svg(`<path d="M8 20l24-10 24 10v28L32 58 8 48z" fill="#d8a05a" ${O}/><path d="M8 20l24 10 24-10M32 30v28" fill="none" ${O}/><path d="M18 15l24 10v8" fill="none" stroke="#fff4c0" stroke-width="4"/>`),
  '📅': svg(`<rect x="8" y="12" width="48" height="44" rx="6" fill="#fff" ${O}/><path d="M8 18a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v8H8z" fill="#ff5f5a" ${O}/><path d="M20 6v12M44 6v12" ${O}/><g fill="#9ab0c8"><rect x="16" y="32" width="8" height="7" rx="2"/><rect x="28" y="32" width="8" height="7" rx="2"/><rect x="40" y="32" width="8" height="7" rx="2"/><rect x="16" y="43" width="8" height="7" rx="2"/></g>`),
  '📌': svg(`<path d="M32 40v20" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M20 10h24l-4 12 8 12H16l8-12z" fill="#ff4a5a" ${O}/>`),
  '✏': svg(`<path d="M12 52l4-14 30-30 10 10-30 30z" fill="#ffd21a" ${O}/><path d="M12 52l4-14 10 10z" fill="#f4d4a8" ${o3}/><path d="M40 14l10 10" stroke="${INK}" stroke-width="4"/>`),
  '✂': svg(`<circle cx="16" cy="46" r="8" fill="#ff5f9a" ${O}/><circle cx="16" cy="18" r="8" fill="#ff5f9a" ${O}/><path d="M22 42L56 14M22 22l34 28" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M22 42L56 14M22 22l34 28" stroke="#d8e4f0" stroke-width="4" stroke-linecap="round"/>`),
  '🧽': svg(`<rect x="8" y="18" width="48" height="30" rx="8" fill="#ffe23a" ${O}/><rect x="8" y="38" width="48" height="10" rx="4" fill="#5fbf4a" ${o3}/><g fill="#d8b81a"><circle cx="20" cy="26" r="3"/><circle cx="34" cy="30" r="2.5"/><circle cx="46" cy="25" r="3"/></g>`),
  '🧭': svg(`<circle cx="32" cy="32" r="26" fill="#d8a84a" ${O}/><circle cx="32" cy="32" r="19" fill="#fff8e6" ${o3}/><path d="M32 14l6 18h-12z" fill="#ff4a5a" ${o3}/><path d="M32 50l6-18h-12z" fill="#9ab0c8" ${o3}/>`),
  '🏆': svg(`<path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="#ffd21a" ${O}/><path d="M18 14H8q0 14 12 14M46 14h10q0 14-12 14" fill="none" ${O}/><path d="M28 36h8v10h-8z" fill="#ffd21a" ${o3}/><rect x="18" y="46" width="28" height="10" rx="3" fill="#b0742e" ${O}/>${gloss('M24 14v8')}`),
  '✅': svg(`<rect x="6" y="6" width="52" height="52" rx="14" fill="#5fd03a" ${O}/><path d="M18 32l10 10 18-20" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`),
  '✓': svg(`<path d="M12 32l14 14 26-28" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 32l14 14 26-28" fill="none" stroke="#5fd03a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  '🔒': svg(`<path d="M20 28V20a12 12 0 0 1 24 0v8" fill="none" stroke="${INK}" stroke-width="11"/><path d="M20 28V20a12 12 0 0 1 24 0v8" fill="none" stroke="#9ab0c8" stroke-width="5"/><rect x="12" y="28" width="40" height="30" rx="6" fill="#ffd21a" ${O}/><circle cx="32" cy="41" r="4" fill="${INK}"/><path d="M32 43v7" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`),
  '🎒': svg(`<path d="M14 24a18 18 0 0 1 36 0v28a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill="#3aa8ff" ${O}/><rect x="20" y="36" width="24" height="14" rx="4" fill="#ffd21a" ${o3}/><path d="M24 12q8-8 16 0" fill="none" ${O}/>`),
  '🪓': svg(`<path d="M20 58L44 14" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M20 58L44 14" stroke="#b0742e" stroke-width="5" stroke-linecap="round"/><path d="M36 10c6-6 18-4 22 4-6 0-10 4-12 12L34 20z" fill="#d8e4f0" ${O}/><path d="M42 10q8-2 12 4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  '🎾': svg(`<circle cx="32" cy="32" r="24" fill="#d8f03a" ${O}/><path d="M12 22q14 10 0 22M52 22q-14 10 0 22" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>${gloss('M20 16a14 14 0 0 1 8-4')}`),
  '🎨': svg(`<path d="M32 6C16 6 6 18 6 32c0 14 12 26 24 26 4 0 6-3 4-7-2-5 2-9 7-8 8 2 17-3 17-13C58 16 46 6 32 6z" fill="#f4d8a8" ${O}/><circle cx="20" cy="26" r="5" fill="#ff5a5a" ${o3}/><circle cx="32" cy="17" r="5" fill="#ffd21a" ${o3}/><circle cx="45" cy="24" r="5" fill="#3aa8ff" ${o3}/><circle cx="20" cy="40" r="5" fill="#5fd03a" ${o3}/>`),
  '🏅': svg(`<path d="M20 4h10l4 18h-8zM44 4H34l-4 18h8z" fill="#3aa8ff" ${o3}/><circle cx="32" cy="40" r="18" fill="#ffd21a" ${O}/>${star(32, 40, 10, '#ffe680', o3)}`),
  '⛏': svg(`<path d="M18 56L42 22" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M18 56L42 22" stroke="#b0742e" stroke-width="5" stroke-linecap="round"/><path d="M14 16q18-10 40 6-16-4-26 2-6-6-14-8z" fill="#9ab0c8" ${O}/>`),
  '🎣': svg(`<path d="M10 56L44 8" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M10 56L44 8" stroke="#b0742e" stroke-width="3.5" stroke-linecap="round"/><path d="M44 8q12 8 10 30" fill="none" stroke="${INK}" stroke-width="2"/><path d="M48 40q6-6 12 0-6 6-12 0z" fill="#ff9f1a" ${o3}/>`),
  '🍪': svg(`<circle cx="32" cy="32" r="25" fill="#d8a05a" ${O}/><g fill="#6a3a1a"><circle cx="22" cy="24" r="4"/><circle cx="40" cy="22" r="3.5"/><circle cx="36" cy="40" r="4"/><circle cx="22" cy="40" r="3"/></g>`),
  '🍰': svg(`<path d="M8 30l46-14v34H8z" fill="#fff4e0" ${O}/><path d="M8 30l46-14v10L8 40z" fill="#ff9fcf" ${o3}/><path d="M8 50h46" stroke="${INK}" stroke-width="4"/><circle cx="44" cy="12" r="6" fill="#ff4a5a" ${O}/>`),
  '🍲': svg(`<path d="M8 30h48c0 16-10 26-24 26S8 46 8 30z" fill="#5a6a7a" ${O}/><ellipse cx="32" cy="30" rx="24" ry="6" fill="#ffb02a" ${O}/><path d="M22 20q-4-6 0-12M32 20q-4-6 0-12M42 20q-4-6 0-12" fill="none" stroke="#9ab0c8" stroke-width="4" stroke-linecap="round"/>`),
  '🛍': svg(`<path d="M12 22h40l-4 36H16z" fill="#ff7ab0" ${O}/><path d="M22 28V18a10 10 0 0 1 20 0v10" fill="none" ${O}/>`),
  '🛋': svg(`<rect x="12" y="16" width="40" height="22" rx="8" fill="#7a5ad8" ${O}/><rect x="4" y="30" width="56" height="18" rx="7" fill="#9a7ae8" ${O}/><path d="M12 48v8M52 48v8" ${O}/>`),
  '🗺': svg(`<path d="M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6z" fill="#f4e2b0" ${O}/><path d="M22 8v42M42 14v42" fill="none" ${o3}/><path d="M28 28l8 8M36 28l-8 8" stroke="#ff4a4a" stroke-width="4" stroke-linecap="round"/>`),
  '🔮': svg(`<rect x="16" y="48" width="32" height="10" rx="4" fill="#b0742e" ${O}/><circle cx="32" cy="28" r="22" fill="#b08aff" ${O}/><circle cx="32" cy="28" r="12" fill="#e0d0ff" opacity=".6"/>${gloss('M20 22a14 14 0 0 1 8-8')}`),
  '⏩': svg(`<path d="M6 12l24 20-24 20zM32 12l24 20-24 20z" fill="#3aa8ff" ${O}/>`),
  '🍬': svg(`<circle cx="32" cy="32" r="14" fill="#ff7ab0" ${O}/><path d="M18 32L6 22v20zM46 32l12-10v20z" fill="#ff9fcf" ${O}/>`),
};

/** Variation selectors and joiners don't change which icon we draw. */
const norm = (ch: string) => ch.replace(/[︎️‍]/g, '');

const KEYS = Object.keys(ICONS).sort((a, b) => b.length - a.length);
const ESC = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERN = new RegExp(`(\\{coin\\}|\\{gem\\}|(?:${KEYS.map(ESC).join('|')})[\\uFE0E\\uFE0F]?)`, 'u');
const SPLIT = new RegExp(PATTERN.source, 'gu');

/** The drawn icon for an emoji, if there is one. */
export function emojiSvg(ch: string): string | undefined {
  return ICONS[norm(ch)];
}

/** Text with every emoji (and {coin}/{gem}) swapped for an inline drawn icon. */
export function emojify(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (!PATTERN.test(text)) {
    frag.append(text);
    return frag;
  }
  for (const part of text.split(SPLIT)) {
    if (!part) continue;
    const markup = part === '{coin}' ? COIN : part === '{gem}' ? GEM : ICONS[norm(part)];
    if (markup) {
      const s = document.createElement('span');
      s.className = 'icon ei';
      s.innerHTML = markup;
      frag.append(s);
    } else frag.append(part);
  }
  return frag;
}

/** True if the text has anything emojify() would swap. */
export function hasEmoji(text: string): boolean {
  return PATTERN.test(text);
}

/** Every emoji we draw, for tests. */
export const DRAWN = new Set(KEYS);
