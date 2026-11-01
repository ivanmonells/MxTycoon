import { install } from './helpers.mjs';
/* paths piece by piece on a phone, with the circuit constructor: open Caminos from the
   toolbar, tap where the path starts, then straight on, up a ramp, along a deck, a turn and
   back down to the ground with «Construir»; «Quitar» gives back everything while building
   and half after leaving; the camera can still be dragged with a finger (MOBILE=1, 390 844) */
export default async ({ page, shot, wait, ev, logs }) => {
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const tapXY = async (x, y) => { await touch('touchStart', [[x, y]]); await wait(50); await touch('touchEnd', []); await wait(350); };
  const tap = async (sel) => { await page.locator(sel).first().tap(); await wait(300); };
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'career', preset: 'campo', seed: 2024, parkName: 'Caminos', tutorial: false }));
  await wait(800);
  await install(ev);
  /* a parking lot by the road to start from, on level ground in front of it */
  const lot = await ev(() => {
    const g = MX.App.game, w = g.world, N = w.N;
    for (let x = 24; x < 50; x++) { const r = g.placeBuilding('parking', x, N - 4, 0); if (r.ok) {
      for (let vz = N - 16; vz <= N - 4; vz++) for (let vx = x - 2; vx <= x + 8; vx++) w.setVh(vx, vz, w.vh(x + 1, N - 4));
      for (let tz = N - 16; tz < N - 4; tz++) for (let tx = x - 2; tx < x + 8; tx++) w.removeSceneryAt(tx, tz);
      w.markTerrainDirty(x - 3, N - 17, x + 8, N - 4);
      return { x, z: N - 4 };
    } }
    return null;
  });
  logs.push('parking ' + JSON.stringify(lot));
  await ev((lot) => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 7; c.yawIndex = 0; __q.focus((lot.x + 1.5) * 4, (lot.z - 1) * 4, innerWidth / 2, innerHeight * 0.36); }, lot);
  await wait(500);
  await tap('[data-id="paths"]');
  logs.push('mode ' + await ev(() => MX.App.pathUI && MX.App.pathUI.mode));
  await tap('.win .btn.tool:has-text("grava")');
  logs.push('tool ' + await ev(() => MX.Tools.current.name + ' sheet ' + document.querySelector('.win').dataset.sheet));
  await shot('pb-open');
  /* tap the tile in front of the parking door */
  const start = await ev(() => { const g = MX.App.game, b = g.buildingsOf('parking')[0]; const d = { tx: b.tx + 1, tz: b.tz - 1 }; window.__d = d; return __q.w2s((d.tx + 0.5) * 4, (d.tz + 0.5) * 4, 0); });
  await tapXY(start.x, start.y);
  logs.push('start ' + await ev(() => JSON.stringify(MX.Tools.list.PathBuild.cur) + ' door ' + JSON.stringify({ tx: __d.tx, tz: __d.tz }) + ' heading ' + MX.Tools.list.PathBuild.dir));
  await shot('pb-start');
  const money0 = await ev(() => MX.App.game.econ.money);
  const build = async (n) => { for (let k = 0; k < n; k++) await tap('#path-build'); };
  /* the first tile, then the heading away from the parking: straight on */
  await build(1);
  await ev(() => { const pb = MX.Tools.list.PathBuild, w = MX.App.game.world; /* face north, away from the road */ pb.dir = 0; pb.refresh(); });
  await build(2);
  await tap('.path-slopes .bld-btn[aria-label="Subida"]');
  await shot('pb-up-ghost');
  await build(3);
  await tap('.path-slopes .bld-btn[aria-label="Llano"]');
  await build(2);
  await tap('.path-dirs .bld-btn[aria-label="Girar a la derecha"]');
  logs.push('turn chosen ' + await ev(() => MX.Tools.list.PathBuild.turn));
  await build(1);
  logs.push('after the turn, straight on again ' + await ev(() => MX.Tools.list.PathBuild.turn === 0));
  await build(1);
  await tap('.path-slopes .bld-btn[aria-label="Bajada"]');
  await build(3);
  logs.push('one more down at ground level: ' + await ev(() => { const n = MX.Tools.list.PathBuild.plan(); return n && n.reason; }));
  await tap('.path-slopes .bld-btn[aria-label="Llano"]');
  await build(1);
  const sum = await ev(() => {
    const g = MX.App.game, w = g.world, N = w.N; let n = 0, raised = 0, top = 0;
    for (let i = 0; i < N * N; i++) if (w.path[i] === 1) { n++; if (w.pathY[i] === w.pathY[i]) { raised++; top = Math.max(top, w.pathY[i] + (w.pathS[i] ? 1 : 0) - w.heightAt((i % N + 0.5) * 4, ((i / N | 0) + 0.5) * 4)); } }
    const pb = MX.Tools.list.PathBuild, c = pb.cur;
    return { tiles: n, raised, top: +top.toFixed(2), session: g.pathSession.size, cur: c, linkedBack: c && w.pathLink(c.tx, c.tz, (pb.dir + 2) % 4) };
  });
  logs.push('built ' + JSON.stringify(sum));
  /* a walk from the parking door goes over the whole thing */
  logs.push('walk reaches the end ' + await ev(() => { const g = MX.App.game, w = g.world, pb = MX.Tools.list.PathBuild; const f = MX.Pathing.bfs(w.N, [w.idx(__d.tx, __d.tz)], (x, z) => w.isWalkable(x, z), 0, (x, z, k) => w.pathLink(x, z, k)); return f.get(pb.cur.tx, pb.cur.tz); }));
  await ev(() => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 6.5; });
  await wait(400);
  await shot('pb-built');
  const spent = await ev((m0) => Math.round(m0 - MX.App.game.econ.money), money0);
  /* Quitar while building: everything back */
  const m1 = await ev(() => MX.App.game.econ.money);
  await tap('#path-undo');
  const back1 = await ev((m) => Math.round(MX.App.game.econ.money - m), m1);
  logs.push('spent ' + spent + ', quitar while building gives back ' + back1 + ' (status: ' + await ev(() => document.querySelector('.path-constructor .bld-status').textContent) + ')');
  /* leave the path tools and come back: half */
  await tap('.win .win-x'); await wait(200);
  await tap('[data-id="paths"]');
  await tap('.win .btn.tool:has-text("grava")');
  const endT = await ev(() => { const g = MX.App.game, w = g.world, N = w.N; let best = null; for (let i = 0; i < N * N; i++) if (w.path[i] === 1 && w.pathY[i] === w.pathY[i]) best = i; return { tx: best % N, tz: (best / N) | 0 }; });
  await ev((t) => __q.focus((t.tx + 0.5) * 4, (t.tz + 3.5) * 4, innerWidth / 2, innerHeight * 0.3), endT);
  await wait(300);
  const p2 = await ev((t) => { const w = MX.App.game.world; return MX.App.renderer.worldToCss((t.tx + 0.5) * 4, w.walkHeight((t.tx + 0.5) * 4, (t.tz + 0.5) * 4), (t.tz + 0.5) * 4); }, endT);
  logs.push('deck on screen at ' + p2.map(Math.round).join(',') + ', ground under it at ' + await ev((t) => __q.w2s((t.tx + 0.5) * 4, (t.tz + 0.5) * 4, 0), endT).then(q => Math.round(q.x) + ',' + Math.round(q.y)));
  await tapXY(p2[0], p2[1]);
  logs.push('picked a raised tile by tapping its deck ' + await ev((t) => JSON.stringify(MX.Tools.list.PathBuild.cur) + ' wanted ' + JSON.stringify(t), endT));
  const m2 = await ev(() => MX.App.game.econ.money);
  const worth = await ev((t) => { const g = MX.App.game, w = g.world, i = w.idx(t.tx, t.tz); return g.pathValue(t.tx, t.tz, 1, w.pathY[i], w.pathS[i]); }, endT);
  await tap('#path-undo');
  logs.push('quitar after leaving gives back ' + await ev((m) => Math.round(MX.App.game.econ.money - m), m2) + ' of a tile worth ' + worth);
  /* a finger drag still moves the camera */
  const cam0 = await ev(() => [MX.App.renderer.cam.tx, MX.App.renderer.cam.tz]);
  await touch('touchStart', [[200, 300]]); for (let k = 1; k <= 6; k++) { await touch('touchMove', [[200 + k * 15, 300 + k * 6]]); await wait(30); } await touch('touchEnd', []); await wait(300);
  const cam1 = await ev(() => [MX.App.renderer.cam.tx, MX.App.renderer.cam.tz]);
  logs.push('camera moved by drag ' + (Math.hypot(cam1[0] - cam0[0], cam1[1] - cam0[1]) > 1));
  await shot('pb-after-pan');
  /* the toolbar is still there: Construir opens the buildings */
  await tap('[data-id="build"]');
  logs.push('build panel ' + await ev(() => MX.WM.isOpen('build') + ' toolbar ' + !!document.getElementById('toolbar').offsetHeight));
};
