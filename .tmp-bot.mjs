import { chromium } from 'playwright';
import fs from 'fs';
const SP = '/tmp/claude-0/-home-user/d3e491b6-744c-5d76-9670-a4be52c23ec8/scratchpad/bot2';
const SAVEF = SP + '/save.json';
const phase = process.argv[2];
const fresh = process.argv[3] === 'fresh';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1 });
const errors = [];
if (!fresh && fs.existsSync(SAVEF)) {
  const saved = JSON.parse(fs.readFileSync(SAVEF, 'utf8'));
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('restored')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('restored', '1'); } }, saved);
}
const page = await ctx.newPage();
page.on('pageerror', (e) => { errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')); });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type().toUpperCase() + ' ' + m.text().slice(0, 300)); });
await page.goto('http://localhost:5185/?debug');
await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const W = (ms) => page.waitForTimeout(ms);
let shotN = 0;
const shot = async (name) => { const f = `${SP}/${phase}-${String(++shotN).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); console.log('SHOT', f); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const log = (...a) => console.log(...a);
const textCheck = async (tag) => {
  const bad = await ev(() => { const t = document.body.innerText; const out = []; for (const w of ['NaN', 'undefined', 'null', '[object', 'Infinity']) { let i = -1; while ((i = t.indexOf(w, i + 1)) >= 0) out.push(t.slice(Math.max(0, i - 50), i + 30).replace(/\n/g, ' | ')); } return out; });
  if (bad.length) log('TEXTBAD', tag, JSON.stringify(bad));
};
const sanity = async (tag) => {
  const r = await ev(() => {
    const g = window.game, s = g.state, out = [];
    if (!(s.glimmer >= 0)) out.push('glimmer ' + s.glimmer);
    if (!(s.shards >= 0)) out.push('shards ' + s.shards);
    for (const c of s.creatures) {
      if (c.fullness !== undefined && !(c.fullness >= 0 && c.fullness <= 1.0001)) out.push('fullness ' + c.id + ' ' + c.fullness);
      if (!s.islands[c.island]?.owned) out.push('creature on unowned island ' + c.id + ' ' + c.island);
      for (const k of ['x', 'z', 'size']) if (c[k] !== undefined && !Number.isFinite(c[k])) out.push('creature ' + k + ' ' + c.id + ' ' + c[k]);
    }
    for (const e of s.eggs) if (e.nest && !s.placedDecor.some((d) => d.id === e.nest)) out.push('egg missing nest ' + e.id + ' ' + e.nest);
    const nestIds = s.eggs.map((e) => e.nest).filter(Boolean); if (new Set(nestIds).size !== nestIds.length) out.push('two eggs in one nest ' + JSON.stringify(nestIds));
    for (const v of s.visitors) if (!s.islands[v.island]?.owned) out.push('visitor for unowned ' + v.island);
    for (const d of s.placedDecor) if (!s.islands[d.island ?? 'home']?.owned) out.push('decor on unowned ' + d.id);
    const per = {};
    for (const c of s.creatures) if (!c.stored && !c.away) per[c.island] = (per[c.island] || 0) + 1;
    return { out, coins: s.glimmer, shards: s.shards, xp: s.xp, tut: s.tutorial, creatures: s.creatures.length, per, eggs: s.eggs.length, visitors: s.visitors.length, owned: Object.keys(s.islands).filter((k) => s.islands[k]?.owned), now: new Date(g.now()).toISOString() };
  });
  const caps = await ev(() => { const g = window.game; return null; });
  log('SANITY', tag, JSON.stringify(r));
};
const save = async () => {
  await ev(() => window.game.save());
  const ls = await ev(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
  fs.writeFileSync(SAVEF, JSON.stringify(ls));
};
const tap = async (sel, opts = {}) => {
  const el = page.locator(sel).first();
  try { await el.tap({ timeout: 3000, ...opts }); return true; } catch (e) { log('TAPFAIL', sel, e.message.split('\n')[0]); return false; }
};
const clickText = async (text, scope = 'body') => {
  const el = page.locator(`${scope} button:visible`, { hasText: text }).first();
  try { await el.tap({ timeout: 3000 }); return true; } catch (e) { log('TAPFAIL text', text, e.message.split('\n')[0]); return false; }
};
const closeAll = async () => { await ev(() => { const g = window.game; g.ui.closeSheet?.(); document.querySelectorAll('.modal .x, .modal-host button.x').forEach((b) => b.click()); }); };
const toasts = async () => ev(() => [...document.querySelectorAll('.toast')].map((t) => t.innerText.replace(/\n/g, ' ')));
const hide = async (ms) => {
  await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await ev((ms) => { window.game.state.clockOffset += ms; }, ms);
  await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await W(1500);
};
const ctxObj = { page, ev, W, shot, log, sanity, textCheck, tap, clickText, closeAll, toasts, hide, save, errors };
const mod = await import(`./.tmp-phases.mjs?${Date.now()}`);
try {
  await mod[phase](ctxObj);
} catch (e) { log('PHASE THREW', e.stack); await shot('threw'); }
await save();
log('ERRORS', JSON.stringify(errors, null, 1));
await browser.close();
