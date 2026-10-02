// Hand-drawn SVG icons in the chunky casual style: flat fills, thick navy outlines,
// a white gloss highlight. Inline strings so they render identically on every device.

const INK = '#1b2a4a';

const svg = (body: string, vb = '0 0 64 64') =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

/** The 8-bit coin (soft currency). Drawn on a 12×12 pixel grid. */
export const COIN = (() => {
  let rects = '';
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const d = Math.hypot(x - 5.5, (y - 5.5) * 1.02);
      if (d > 5.9) continue;
      let c = '#ffc21a';
      if (d > 4.85) c = '#8a4b00';
      else if (x >= 5 && x <= 6 && y >= 3 && y <= 8) c = '#e08a00';
      else if (x + y < 8) c = '#ffe680';
      else if (x + y > 14) c = '#f0a000';
      if ((x === 3 && (y === 3 || y === 4)) || (x === 4 && y === 3)) c = '#ffffff';
      rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`;
    }
  }
  return `<svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rects}</svg>`;
})();

/** Starshards (premium): a faceted pink gem. */
export const GEM = svg(`
  <path d="M32 6 54 19v26L32 58 10 45V19z" fill="#ff5fb5" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M32 6 54 19 32 30 10 19z" fill="#ff9bd3"/>
  <path d="M32 30v28L10 45V19z" fill="#e0399a"/>
  <path d="M20 18 32 11l9 5-12 7z" fill="#fff" opacity=".85"/>
  <path d="M32 6 54 19v26L32 58 10 45V19z" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);

export const GEAR = svg(`
  <path d="M27 6h10l2 7 6 3 7-3 7 9-5 6v6l5 6-7 9-7-3-6 3-2 7H27l-2-7-6-3-7 3-7-9 5-6v-6l-5-6 7-9 7 3 6-3z"
    fill="#ffffff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="32" cy="32" r="9" fill="#3aa0ff" stroke="${INK}" stroke-width="4"/>`);

export const PLUS = svg(`<path d="M26 10h12v16h16v12H38v16H26V38H10V26h16z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);

export const CLOSE = svg(`<path d="M14 22l8-8 10 10 10-10 8 8-10 10 10 10-8 8-10-10-10 10-8-8 10-10z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);

export const SHOP = svg(`
  <rect x="10" y="28" width="44" height="28" rx="3" fill="#fff4e0" stroke="${INK}" stroke-width="4"/>
  <rect x="17" y="36" width="12" height="20" fill="#3aa0ff" stroke="${INK}" stroke-width="4"/>
  <rect x="35" y="36" width="13" height="10" fill="#bfeaff" stroke="${INK}" stroke-width="4"/>
  <path d="M6 16h52l-2 12H8z" fill="#ff4d4d" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M15 16l-2 12M24 16v12M32 16v12M40 16v12M49 16l2 12" stroke="${INK}" stroke-width="3"/>
  <path d="M19 16h5v12h-6zM32 16h8v12h-8zM45 16h4l2 12h-6z" fill="#fff"/>
  <path d="M10 10h44v6H6z" fill="#ff4d4d" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);

export const LURE = svg(`
  <path d="M14 30h36l-4 24a4 4 0 0 1-4 3H22a4 4 0 0 1-4-3z" fill="#bfeaff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M17 40h30l-2 14a3 3 0 0 1-3 2H22a3 3 0 0 1-3-2z" fill="#7ed321"/>
  <circle cx="26" cy="46" r="3" fill="#ff5fb5"/><circle cx="37" cy="48" r="3" fill="#ffd21a"/><circle cx="32" cy="43" r="2.5" fill="#fff"/>
  <rect x="12" y="22" width="40" height="9" rx="3" fill="#ff9f1a" stroke="${INK}" stroke-width="4"/>
  <path d="M30 22c-2-8 4-14 10-14-1 6-5 10-10 14z" fill="#7ed321" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M20 34h4v8h-4z" fill="#fff" opacity=".8"/>`);

export const CREATE = svg(`
  <ellipse cx="32" cy="38" rx="17" ry="20" fill="#fff4e0" stroke="${INK}" stroke-width="4"/>
  <path d="M17 36c5 3 9-3 15 0s10 3 15 0" fill="none" stroke="#7ed321" stroke-width="5" stroke-linecap="round"/>
  <path d="M19 46c5 3 9-3 13 0s9 3 13 0" fill="none" stroke="#ff5fb5" stroke-width="5" stroke-linecap="round"/>
  <path d="M24 24c2-4 5-5 8-5" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <path d="M50 6l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffd21a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`);

export const JOURNAL = svg(`
  <path d="M12 12a4 4 0 0 1 4-4h34v46H16a4 4 0 0 0-4 4z" fill="#3aa0ff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M12 58a4 4 0 0 1 4-4h34v6H16a4 4 0 0 1-4-2z" fill="#fff4e0" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="32" cy="29" r="9" fill="#ffd21a" stroke="${INK}" stroke-width="3.5"/>
  <circle cx="29" cy="27" r="2" fill="${INK}"/><circle cx="35" cy="27" r="2" fill="${INK}"/>
  <path d="M28 32q4 3 8 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M18 14h4v34h-4z" fill="#fff" opacity=".5"/>`);

export const DECOR = svg(`
  <path d="M18 38h28l-4 18H22z" fill="#ff9f1a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <rect x="15" y="34" width="34" height="8" rx="3" fill="#ffb84d" stroke="${INK}" stroke-width="4"/>
  <path d="M32 34V18" stroke="${INK}" stroke-width="4"/>
  <path d="M32 24c-10 0-15-6-15-14 9 0 15 5 15 14z" fill="#7ed321" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M32 20c0-8 6-13 15-13 0 9-6 13-15 13z" fill="#5fc21a" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <circle cx="44" cy="28" r="5" fill="#ff5fb5" stroke="${INK}" stroke-width="3"/>`);

export const SUMMON = svg(`
  <rect x="8" y="16" width="48" height="36" rx="6" fill="#7c4dff" stroke="${INK}" stroke-width="4"/>
  <rect x="14" y="22" width="36" height="24" rx="3" fill="#1e2a6a"/>
  <path d="M27 27l11 7-11 7z" fill="#fff"/>
  <path d="M22 8l10 8 10-8" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M48 4l2.5 5.5L56 12l-5.5 2.5L48 20l-2.5-5.5L40 12l5.5-2.5z" fill="#ffd21a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`);

/** Turn an SVG string into an element. */
export function icon(markup: string, cls = 'icon'): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  s.innerHTML = markup;
  return s;
}

export const ISLANDS = svg(`
  <ellipse cx="32" cy="50" rx="26" ry="7" fill="#3aa0ff" stroke="${INK}" stroke-width="4"/>
  <path d="M10 44c4-10 12-14 22-14s18 4 22 14z" fill="#7ed321" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M22 40l-4-14 4-2 4 14z" fill="#9a5a32" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="20" cy="22" r="8" fill="#5fc21a" stroke="${INK}" stroke-width="3.5"/>
  <path d="M38 36l8-16 8 16z" fill="#ff7a2a" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M43 26h6l-3-6z" fill="#ffd21a"/>
  <path d="M14 46h8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`);

/** The mascot: a smiling axolotl face. */
export const AXOLOTL = svg(`
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M12 26c-6-4-9-2-10 1 3 0 6 2 9 4zM10 34c-7-1-9 2-9 5 3-1 7-1 10-1zM13 41c-5 2-6 6-5 8 2-2 5-4 8-5z" fill="#ff5f9a"/>
    <path d="M52 26c6-4 9-2 10 1-3 0-6 2-9 4zM54 34c7-1 9 2 9 5-3-1-7-1-10-1zM51 41c5 2 6 6 5 8-2-2-5-4-8-5z" fill="#ff5f9a"/>
    <ellipse cx="32" cy="36" rx="22" ry="17" fill="#ffb3d0"/>
  </g>
  <ellipse cx="32" cy="42" rx="14" ry="8" fill="#ffe0ec"/>
  <circle cx="22" cy="32" r="4.2" fill="${INK}"/><circle cx="42" cy="32" r="4.2" fill="${INK}"/>
  <circle cx="23.4" cy="30.6" r="1.5" fill="#fff"/><circle cx="43.4" cy="30.6" r="1.5" fill="#fff"/>
  <ellipse cx="17" cy="39" rx="3.6" ry="2.2" fill="#ff7ab0" opacity=".8"/><ellipse cx="47" cy="39" rx="3.6" ry="2.2" fill="#ff7ab0" opacity=".8"/>
  <path d="M25 39q7 7 14 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <path d="M20 23q6-4 12-4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`);
