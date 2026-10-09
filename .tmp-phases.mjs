export async function p1({ page, ev, W, shot, log, sanity, textCheck, tap, clickText, closeAll, toasts, hide }) {
  await shot('start');
  await sanity('start');
  log('pins', JSON.stringify(await ev(() => [...document.querySelectorAll('.wl')].filter((e) => e.offsetParent).map((e) => e.className + ':' + e.innerText.replace(/\n/g, ' ').slice(0, 40)))));
  // tap the glowing ring pin (lure spot pin)
  const pin = page.locator('.wl', { hasText: /glade|Mossy|lure|Lure|Place/i }).first();
  log('pin count', await pin.count());
  let ok = false;
  try { await pin.tap({ timeout: 2000 }); ok = true; } catch (e) { log('pin tap fail'); }
  await W(800);
  if (!(await ev(() => window.game.ui.sheetOpen))) { log('no sheet from pin; opening spot via ui'); await ev(() => window.game.ui.showSpot('glade')); await W(600); }
  await shot('spot-sheet');
  await tap('.tut-place');
  await W(1500);
  await shot('after-place');
  await sanity('placed');
  // wait for a visitor: skip a few minutes at a time
  for (let i = 0; i < 20; i++) {
    const v = await ev(() => window.game.state.visitors.length);
    if (v) break;
    await ev(() => window.game.skip(60_000));
    await W(400);
  }
  await W(1500);
  await shot('visitor');
  log('tut', await ev(() => window.game.state.tutorial), 'toasts', JSON.stringify(await toasts()));
  const vid = await ev(() => window.game.state.visitors[0]?.creature.id);
  log('visitor', vid);
  if (vid) {
    // tap the Go on toast if present, else goToVisitor
    await ev((id) => window.game.goToVisitor(id), vid);
    await W(1500);
    await shot('visitor-sheet');
    await tap('.tut-keep');
    await W(1500);
  }
  await shot('after-keep');
  log('tut', await ev(() => window.game.state.tutorial));
  await sanity('kept');
  // CREATE
  await tap('.dock button.tut-create');
  await W(1000);
  await shot('font');
  log('tut', await ev(() => window.game.state.tutorial));
  // pick two
  for (let i = 0; i < 2; i++) {
    const tiles = page.locator('.sheet .grid .tile:not(.dim):not(.sel)');
    log('tiles', await tiles.count());
    if (await tiles.count()) { await tiles.first().tap(); await W(500); }
  }
  await shot('font-picked');
  await tap('.tut-make');
  await W(1500);
  await shot('after-make');
  log('tut', await ev(() => window.game.state.tutorial), 'eggs', JSON.stringify(await ev(() => window.game.state.eggs.map((e) => ({ id: e.id, nest: e.nest, inc: e.incubationMs, p: e.progressMs })))));
  await sanity('made');
  // wait for egg
  for (let i = 0; i < 10; i++) {
    const ready = await ev(() => window.game.state.eggs.some((e) => e.progressMs >= e.incubationMs));
    if (ready) break;
    await ev(() => window.game.skip(60_000));
    await W(300);
  }
  await W(800);
  await shot('egg-ready');
  const egg = await ev(() => window.game.state.eggs[0]);
  if (egg) { await ev((n) => window.game.ui.showNest(n), egg.nest); await W(800); await shot('nest-sheet'); await tap('.tut-hatch'); }
  await W(6000);
  await shot('reveal');
  // tap through reveal
  for (let i = 0; i < 6; i++) { await page.touchscreen.tap(195, 500); await W(900); }
  await shot('after-reveal');
  log('tut', await ev(() => window.game.state.tutorial), 'modals', await ev(() => document.querySelector('.ui')?.innerText.slice(0, 600).replace(/\n/g, ' | ')));
  await textCheck('p1');
  await sanity('p1 end');
}

export async function p2({ page, ev, W, shot, log, sanity, textCheck, tap, clickText, closeAll, toasts, hide }) {
  await shot('load');
  log('tut', await ev(() => window.game.state.tutorial), 'text', await ev(() => document.querySelector('.ui')?.innerText.slice(0, 800).replace(/\n/g, ' | ')));
}
