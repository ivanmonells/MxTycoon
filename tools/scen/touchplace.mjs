import { install } from './helpers.mjs';
/* touch placement on a phone: tap to preview, drag the preview, confirm with «Colocar»
   or a second tap, and the map tools that act straight away (terrain, paths) */
export default async ({ page, shot, wait, ev, logs }) => {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const tapXY = async (x, y) => { await touch('touchStart', [[x, y]]); await wait(60); await touch('touchEnd', []); await wait(400); };
  const dragXY = async (a, b, steps = 8) => {
    await touch('touchStart', [a]); await wait(60);
    for (let k = 1; k <= steps; k++) { await touch('touchMove', [[a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps]]); await wait(40); }
    await touch('touchEnd', []); await wait(400);
  };
  const tap = async (sel) => { await page.locator(sel).first().tap(); await wait(400); };
  const state = (label) => ev(() => {
    const t = MX.Tools.current, bar = document.getElementById('placebar');
    return JSON.stringify({ tool: t.name, tile: t.tile || t.t || null, check: t.check ? { s: Math.round(t.check.s), ok: t.check.ok } : undefined,
      bar: bar.hidden ? null : bar.querySelector('.pb-go').textContent, sheet: (document.querySelector('.win') || {}).dataset ? document.querySelector('.win').dataset.sheet : null,
      bld: MX.App.game.buildings.size });
  }).then((s) => logs.push(label + ' ' + s));
  /* screen point of a world point, and whether the map is visible there */
  const scr = (x, z) => ev(([x, z]) => { const p = __q.w2s(x, z, 0); return { x: Math.round(p.x), y: Math.round(p.y), free: __q.freeAt(p.x, p.y) }; }, [x, z]);
  const ghostScr = () => ev(() => { const t = MX.Tools.current, c = t.center || (t.t && { x: (t.t.tx + 0.5) * 4, z: (t.t.tz + 0.5) * 4 }); if (!c) return null; const p = __q.w2s(c.x, c.z, 0); return { x: Math.round(p.x), y: Math.round(p.y) }; });

  await wait(600);
  await tap('#title button:has-text("Modo sandbox")');
  await tap('#modal .btn:has-text("Empezar")');
  await wait(800);
  await install(ev);
  /* a free 2x2 spot for the motocross school near the middle of the land */
  const spot = await ev(() => {
    const g = MX.App.game;
    for (let r = 0; r < 30; r++) for (let tz = 60 - r; tz <= 60 + r; tz++) for (let tx = 44 - r; tx <= 44 + r; tx++) {
      if (g.checkBuilding('school', tx, tz, 0).ok && g.checkBuilding('school', tx + 4, tz, 0).ok && g.checkBuilding('school', tx, tz + 4, 0).ok) return { tx, tz };
    }
    return null;
  });
  logs.push('spot ' + JSON.stringify(spot));
  await ev(([tx, tz]) => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 4; __q.focus((tx + 1) * 4, (tz + 1) * 4, innerWidth / 2, innerHeight * 0.28); }, [spot.tx, spot.tz]);
  await wait(300);

  /* buildings: the school, from the riders tab */
  await tap('[data-id="build"]');
  await tap('.win .tab:has-text("Pilotos")');
  await tap('.win .card:has-text("Escuela de motocross")');
  await wait(400);
  await state('school picked (preview in the middle)');
  await shot('t-school-picked');
  const target = await scr((spot.tx + 1) * 4, (spot.tz + 1) * 4);
  logs.push('target ' + JSON.stringify(target));
  await tapXY(target.x, target.y);
  await state('after tap (moved, not built)');
  await shot('t-school-preview');
  /* drag the preview by a few tiles and back */
  let g0 = await ghostScr();
  await dragXY([g0.x, g0.y], [g0.x + 70, g0.y + 30]);
  await state('after drag (moved, not built)');
  g0 = await ghostScr();
  await dragXY([g0.x, g0.y], [target.x, target.y]);
  await state('after drag back');
  await tap('#placebar .pb-go');
  await state('after Colocar (built, preview cleared)');
  await shot('t-school-built');
  /* second building: tap to preview, rotate, tap the preview to place */
  const t2 = await scr((spot.tx + 5) * 4, (spot.tz + 1) * 4);
  await tapXY(t2.x, t2.y);
  await tap('#placebar .pb-rot');
  await state('second preview rotated');
  g0 = await ghostScr();
  await tapXY(g0.x, g0.y);
  await state('after tapping the preview (built)');
  logs.push('rot ' + await ev(() => MX.Tools.current.rot));
  /* a tap on an occupied spot shows why in the bar and builds nothing */
  await tapXY(target.x, target.y);
  await state('preview on the built school');
  logs.push('bar disabled ' + await ev(() => document.querySelector('#placebar .pb-go').disabled));
  await page.locator('#placebar .pb-go').tap({ force: true }); await wait(300);
  await state('Colocar on a bad spot (nothing built)');
  await shot('t-bad-spot');
  await tap('.win .win-x');

  /* decoration: a pine, two-step */
  await tap('.tg-switch').catch(() => {});
  await ev(() => { const bar = document.getElementById('toolbar'); if (bar.classList.contains('mgmt')) document.querySelector('.tg-switch').click(); });
  await tap('[data-id="decor"]');
  await tap('.win .card:has-text("Pino")');
  await wait(300);
  const t3 = await scr((spot.tx + 1) * 4 + 2, (spot.tz + 6) * 4 + 2);
  await tapXY(t3.x, t3.y);
  await state('pine preview');
  await tap('#placebar .pb-go');
  logs.push('pine placed ' + await ev(([tx, tz]) => MX.App.game.world.scen[MX.App.game.world.idx(tx, tz)] >= 0, [spot.tx + 1, spot.tz + 6]));
  await state('after pine');
  await tap('.win .win-x');

  /* terrain: a tap raises the tile under the finger */
  await tap('[data-id="terrain"]');
  await tap('.win .btn.tool:has-text("Subir")');
  const tt = { tx: spot.tx + 6, tz: spot.tz + 6 };
  const h0 = await ev(([tx, tz]) => MX.App.game.world.tileCenterH(tx, tz), [tt.tx, tt.tz]);
  const t4 = await scr((tt.tx + 0.5) * 4, (tt.tz + 0.5) * 4);
  await tapXY(t4.x, t4.y);
  const h1 = await ev(([tx, tz]) => MX.App.game.world.tileCenterH(tx, tz), [tt.tx, tt.tz]);
  logs.push('terrain raised at the tapped tile ' + (h1 > h0) + ' (' + h0.toFixed(2) + ' -> ' + h1.toFixed(2) + ')');
  await tap('.win .win-x');

  /* paths, tile by tile (the default on touch screens): a tap picks the start, «Construir»
     lays it and the next tile along */
  await tap('[data-id="paths"]');
  await tap('.win .btn.tool');
  const pt = { tx: spot.tx + 8, tz: spot.tz + 2 };
  const t5 = await scr((pt.tx + 0.5) * 4, (pt.tz + 0.5) * 4);
  await tapXY(t5.x, t5.y);
  await tap('#path-build'); await tap('#path-build');
  logs.push('path at the tapped tile ' + await ev(([tx, tz]) => MX.App.game.world.path[MX.App.game.world.idx(tx, tz)], [pt.tx, pt.tz]) + ', tiles laid ' + await ev(() => MX.Tools.list.PathBuild.laid.length));
  /* the drag mode is one tap away: a tap there lays one tile where the finger is */
  await tap('.win .btn.small:has-text("Arrastrando")');
  const pt2 = { tx: spot.tx + 8, tz: spot.tz + 5 };
  const t6 = await scr((pt2.tx + 0.5) * 4, (pt2.tz + 0.5) * 4);
  await tapXY(t6.x, t6.y);
  logs.push('drag mode: path at the tapped tile ' + await ev(([tx, tz]) => MX.App.game.world.path[MX.App.game.world.idx(tx, tz)], [pt2.tx, pt2.tz]));
  await tap('.win .win-x');

  /* track features: a suggested loop, then a tabletop on it */
  await tap('[data-id="tracks"]');
  await tap('.win .btn:has-text("Trazado sugerido")');
  /* in sandbox every discipline is available, so it asks which one first */
  if (await ev(() => !!document.querySelector('.type-card'))) { await shot('t-type-picker'); await tap('.type-card:has-text("Motocross")'); }
  await wait(800);
  const tr = await ev(() => { const t = MX.App.game.selectedTrack; return t ? { closed: t.closed, feats: t.features.length } : null; });
  logs.push('suggested ' + JSON.stringify(tr));
  await state('after suggested (sheet folds for the feature tool)');
  /* unfold the sheet by tapping its title bar, then pick a jump */
  const tb = await ev(() => { const b = document.querySelector('.win .win-title').getBoundingClientRect(); return { x: b.left + 60, y: b.top + 20 }; });
  await tapXY(tb.x, tb.y);
  await state('after title tap');
  logs.push('feature cards ' + await ev(() => Array.from(document.querySelectorAll('.win .feat')).map(e => e.textContent.slice(0, 18) + (e.offsetParent ? '' : '(hidden)')).join(' | ')));
  await shot('t-features-sheet');
  await tap('.win .feat:has-text("Tabletop pequeño")');
  await wait(300);
  const fp = await ev(() => {
    const t = MX.App.game.selectedTrack, S = t.S, len = t.featureLen('tabletop_s', 0) || 20;
    /* the middle of the longest stretch where a small tabletop fits */
    let best = null, run = null;
    for (let s = 0; s < t.length; s += 2) {
      if (t.checkFeature('tabletop_s', s).ok) { if (!run) run = { a: s, b: s }; run.b = s; if (!best || run.b - run.a > best.b - best.a) best = { a: run.a, b: run.b }; }
      else run = null;
    }
    const sc = (best.a + best.b) / 2 + len / 2, i = t.sIndex(sc);
    const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 4; __q.focus(S.x[i], S.z[i], innerWidth / 2, innerHeight * 0.45); const p = MX.App.renderer.worldToCss(S.x[i], S.y[i], S.z[i]); return { x: Math.round(p[0]), y: Math.round(p[1]) }; });
  await wait(300);
  await tapXY(fp.x, fp.y);
  await state('tabletop preview');
  await shot('t-feature-preview');
  await tap('#placebar .pb-go');
  logs.push('features after Colocar ' + await ev(() => MX.App.game.selectedTrack.features.length));
  await state('after tabletop');
  await shot('t-feature-built');
};
