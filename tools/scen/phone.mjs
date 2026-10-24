import { install } from './helpers.mjs';
/* phone layout: one-row HUD, sheets that fold for map tools, compact constructor */
export default async ({ page, shot, wait, ev, logs }) => {
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const tapXY = async (x, y) => { await touch('touchStart', [[x, y]]); await wait(50); await touch('touchEnd', []); await wait(350); };
  const tap = async (sel) => { await page.locator(sel).first().tap(); await wait(350); };
  const layout = async (label) => logs.push(label + ' ' + await ev(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const b = e.getBoundingClientRect(); return b.width ? [Math.round(b.top), Math.round(b.bottom)] : null; };
    const win = document.querySelector('.win');
    return JSON.stringify({ classes: document.documentElement.className, top: r('#topbar'), toolbar: r('#toolbar'), sheet: win ? [win.dataset.sheet, Math.round(win.getBoundingClientRect().top), Math.round(win.getBoundingClientRect().bottom)] : null, tut: r('#tutorial'), h: innerHeight });
  }));
  await wait(600);
  await tap('#title button:has-text("Nueva partida")');
  await tap('#modal .btn:has-text("Empezar")');
  await wait(800);
  await install(ev);
  await layout('start');
  await shot('p-start');
  await tap('#tutorial .btn:has-text("Empezar")');
  await tap('[data-id="tracks"]');
  await layout('tracks sheet');
  await shot('p-tracks');
  await tap('#win-tracks-new');
  await layout('after nuevo circuito (should fold)');
  await shot('p-start-tool');
  await ev(() => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 3; __q.focus(140, 178, innerWidth > innerHeight ? (innerWidth + 380) / 2 : innerWidth / 2, innerHeight / 2); });
  await wait(300);
  const p = await ev(() => __q.w2s(140, 178, 0));
  await tapXY(p.x, p.y); await tapXY(p.x, p.y);
  await wait(500);
  await layout('constructor');
  logs.push('pieces ' + await ev(() => MX.App.game.selectedTrack.pieces.length) + ' tool ' + await ev(() => MX.Tools.current.name));
  await shot('p-constructor');
  for (let k = 0; k < 2; k++) await tap('#bld-build');
  await tap('.bld-dirs .bld-btn[aria-label="Curva media a la derecha"]');
  await tap('#bld-build'); await tap('#bld-build');
  await wait(600);
  await shot('p-built');
  logs.push('end on screen ' + await ev(() => { const t = MX.App.game.selectedTrack, e = t.endPose; const q = MX.App.renderer.worldToCss(e.x * 4, t.S.y[t.S.n - 1], e.z * 4); const win = document.querySelector('.win').getBoundingClientRect(); return JSON.stringify({ x: Math.round(q[0]), y: Math.round(q[1]), sheetTop: Math.round(win.top) }); }));
  await tap('.bld-dots');
  await layout('more menu');
  await tap('.bld-more .btn:has-text("Especiales")');
  await layout('specials');
  await shot('p-specials');
  await tap('.bld-dots');
  await tap('#bld-auto');
  await wait(1500);
  await layout('closed');
  logs.push('closed ' + await ev(() => MX.App.game.selectedTrack.closed));
  logs.push('origin ' + await ev(() => {
    const t = MX.App.game.selectedTrack, w = MX.App.game.world, o = t.origin, T = MX.Track, v = T.DIRV[o.h];
    const len = 3 * (o.h & 1 ? Math.SQRT2 : 1) * 4, ux = v[0] / Math.hypot(v[0], v[1]), uz = v[1] / Math.hypot(v[0], v[1]), nx = -uz, nz = ux, hw = 4 + 0.5;
    const bad = [];
    for (let d = 1; d < len + hw + 0.25; d += 1.5) for (const of of [-hw, 0, hw]) {
      const px = o.x * 4 - ux * d + nx * of, pz = o.z * 4 - uz * d + nz * of, tx = Math.floor(px / 4), tz = Math.floor(pz / 4), i = tx + tz * w.N;
      const why = w.owned[i] !== 1 ? 'unowned' : w.bld[i] >= 0 ? 'bld' : w.path[i] ? 'path' : (w.trackOcc[i] & ~t.bit) ? 'track' : w.isWater(tx, tz) ? 'water' : '';
      if (why) bad.push(d.toFixed(1) + '/' + of + ':' + why + '@' + tx + ',' + tz);
    }
    return JSON.stringify({ o, seed: MX.App.game.seed, bad: bad.slice(0, 8) });
  }));
  await shot('p-closed');
  /* fold and unfold the sheet by tapping its title bar */
  const tb = await ev(() => { const b = document.querySelector('.win .win-title').getBoundingClientRect(); return { x: b.left + 60, y: b.top + 20 }; });
  await tapXY(tb.x, tb.y);
  await layout('after title tap');
  await shot('p-folded');
  await tap('.win .win-exp');
  await layout('after expand');
  await shot('p-full');
  await tap('.win .win-x');
  await layout('after close');
  /* toolbar switch to management */
  await tap('.tg-switch');
  await shot('p-mgmt');
  await tap('[data-id="finance"]');
  await shot('p-finance');
  await tap('.win .win-x');
  await tap('.tg-switch');
  await tap('[data-id="build"]');
  await tap('.win .card:has-text("Paddock")');
  await layout('paddock tool (should fold)');
  await shot('p-build-tool');
  logs.push('rot button ' + await ev(() => !!document.querySelector('.win .win-rot')));
};
