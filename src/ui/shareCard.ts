// "Look what I found!" cards: a picture of a creature to share on social apps,
// with the game's name and the keeper's friend code so friends can join in.

import { APP_ICON, GAME_NAME } from './brand';

const RARITY_COLOR: Record<string, [string, string]> = {
  common: ['#9fe06a', '#4aa83a'], uncommon: ['#7ad8ff', '#2f8ff0'], rare: ['#c8a8ff', '#6a3ce0'],
  legendary: ['#ffe680', '#ff9a1a'], mythical: ['#ff9ee8', '#7c4dff'],
};

const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Draws the card and returns it as a PNG blob. */
export async function makeShareCard(o: { portrait: string; name: string; species: string; rarity: string; traits: string[]; line: string; code: string }): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const [c1, c2] = RARITY_COLOR[o.rarity] ?? RARITY_COLOR.common;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#bfeeff'); bg.addColorStop(1, '#2f8ff0');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // sunburst behind the creature
  g.save(); g.translate(W / 2, 560); g.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(-70, -900); g.lineTo(70, -900); g.fill(); }
  g.restore();
  // card
  g.lineWidth = 10; g.strokeStyle = '#1b2a4a';
  roundRect(g, 90, 150, W - 180, 820, 60);
  const card = g.createLinearGradient(0, 150, 0, 970); card.addColorStop(0, '#ffffff'); card.addColorStop(1, '#e9f8ff');
  g.fillStyle = card; g.fill(); g.stroke();
  const pic = await load(o.portrait);
  const s = Math.min(640 / pic.width, 640 / pic.height);
  g.drawImage(pic, W / 2 - (pic.width * s) / 2, 200 + (640 - pic.height * s) / 2, pic.width * s, pic.height * s);
  // rarity ribbon
  const rb = g.createLinearGradient(0, 860, 0, 940); rb.addColorStop(0, c1); rb.addColorStop(1, c2);
  roundRect(g, W / 2 - 200, 860, 400, 80, 40); g.fillStyle = rb; g.fill(); g.lineWidth = 8; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const text = (t: string, y: number, size: number, fill: string, stroke = 0) => {
    g.font = `${size}px 'Lilita One', 'Arial Rounded MT Bold', sans-serif`;
    if (stroke) { g.lineWidth = stroke; g.strokeStyle = '#1b2a4a'; g.lineJoin = 'round'; g.strokeText(t, W / 2, y); }
    g.fillStyle = fill; g.fillText(t, W / 2, y);
  };
  text(o.rarity.toUpperCase(), 902, 48, '#ffffff', 10);
  text('Look what I found!', 85, 72, '#ffffff', 16);
  text(o.name, 1040, o.name.length > 16 ? 72 : 92, '#ffffff', 18);
  if (o.name !== o.species) text(o.species, 1115, 46, '#e8f6ff', 10);
  text(o.traits.join(' · '), 1170, 38, '#ffffff', 8);
  text(o.line, 1225, 34, '#fff3b0', 8);
  // footer: logo, game name and friend code
  const icon = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(APP_ICON)}`);
  g.drawImage(icon, 60, H - 110, 80, 80);
  g.textAlign = 'left';
  g.font = `44px 'Lilita One', 'Arial Rounded MT Bold', sans-serif`;
  g.lineWidth = 8; g.strokeStyle = '#1b2a4a'; g.strokeText(GAME_NAME, 160, H - 70); g.fillStyle = '#ffffff'; g.fillText(GAME_NAME, 160, H - 70);
  g.textAlign = 'right'; g.font = `26px Nunito, sans-serif`; g.fillStyle = '#ffffff';
  g.fillText('Add me as a friend:', W - 60, H - 88);
  g.font = `bold 24px Nunito, sans-serif`;
  g.fillText(o.code.length > 34 ? `${o.code.slice(0, 32)}…` : o.code, W - 60, H - 52);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

/** Share through the phone's share sheet if it can; returns false if it can't. */
export async function shareBlob(blob: Blob, text: string): Promise<boolean> {
  const file = new File([blob], 'pocket-grove.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (nav.share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text }); return true; }
    if (nav.share) { await nav.share({ text }); return true; }
  } catch { /* cancelled */ }
  return false;
}

/** Share plain text through the phone's share sheet; false if it can't. */
export async function shareBlobText(text: string): Promise<boolean> {
  try {
    if (navigator.share) { await navigator.share({ text }); return true; }
  } catch { /* cancelled */ }
  return false;
}
