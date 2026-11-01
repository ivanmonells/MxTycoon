import { install } from './helpers.mjs';
/* paths tile by tile on a phone: open Caminos from the toolbar, tap where the path starts,
   turn with the arrows and press «Construir» and «Quitar»; the camera can still be
   dragged with a finger while the builder is open (MOBILE=1, 390 844) */
export default async ({ page, shot, wait, ev, logs }) => {
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const tapXY = async (x, y) => { await touch('touchStart', [[x, y]]); await wait(50); await touch('touchEnd', []); await wait(350); };
  const tap = async (sel) => { await page.locator(sel).first().tap(); await wait(300); };
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'career', preset: 'campo', seed: 2024, parkName: 'Caminos', tutorial: false }));
  await wait(800);
  await install(ev);
  /* a parking lot by the road to start from */
  const lot = await ev(() => { const g = MX.App.game, N = g.world.N; for (let x = 24; x < 50; x++) { const r = g.placeBuilding('parking', x, N - 4, 0); if (r.ok) return { x, z: N - 4 }; } return null; });
  logs.push('parking ' + JSON.stringify(lot));
  await ev((lot) => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 9; c.yawIndex = 0; __q.focus((lot.x + 1.5) * 4, (lot.z - 4) * 4, innerWidth / 2, innerHeight * 0.32); }, lot);
  await wait(500);
  await tap('[data-id="paths"]');
  logs.push('mode ' + await ev(() => MX.App.pathUI && MX.App.pathUI.mode));
  await tap('.win .btn.tool:has-text("grava")');
  logs.push('tool ' + await ev(() => MX.Tools.current.name + ' sheet ' + document.querySelector('.win').dataset.sheet));
  await shot('pb-open');
  /* tap the tile in front of the parking door */
  const start = await ev((lot) => { const g = MX.App.game; const d = g.doorTiles(g.buildingsOf('parking')[0], 'path')[0] || { tx: lot.x + 1, tz: lot.z - 1 }; window.__d = d; return __q.w2s((d.tx + 0.5) * 4, (d.tz + 0.5) * 4, 0); }, lot);
  await tapXY(start.x, start.y);
  logs.push('start ' + await ev(() => JSON.stringify(MX.Tools.list.PathBuild.cur) + ' door ' + JSON.stringify(__d)));
  await tap('#path-build');
  /* north-west on screen is up-left: walk four tiles that way, then turn up-right for three */
  const dirFor = async (sx, sy) => ev(([sx, sy]) => { const pb = MX.Tools.list.PathBuild; pb.turn(sx, sy); return pb.dir; }, [sx, sy]);
  await tap('.path-dir[aria-label="Hacia arriba a la izquierda"]');
  for (let k = 0; k < 4; k++) await tap('#path-build');
  await tap('.path-dir[aria-label="Hacia arriba a la derecha"]');
  for (let k = 0; k < 3; k++) await tap('#path-build');
  await shot('pb-built');
  logs.push('built ' + await ev(() => { const pb = MX.Tools.list.PathBuild, w = MX.App.game.world; let n = 0; for (const t of pb.laid) if (w.path[w.idx(t.tx, t.tz)] === 1) n++; return n + ' of ' + pb.laid.length + ' laid, cur ' + JSON.stringify(pb.cur) + ' dir ' + pb.dir; }));
  await tap('#path-undo');
  logs.push('after undo ' + await ev(() => { const pb = MX.Tools.list.PathBuild; return pb.laid.length + ' laid, cur ' + JSON.stringify(pb.cur); }));
  void dirFor;
  /* a finger drag still moves the camera */
  const cam0 = await ev(() => [MX.App.renderer.cam.tx, MX.App.renderer.cam.tz]);
  await touch('touchStart', [[200, 300]]); for (let k = 1; k <= 6; k++) { await touch('touchMove', [[200 + k * 15, 300 + k * 6]]); await wait(30); } await touch('touchEnd', []); await wait(300);
  const cam1 = await ev(() => [MX.App.renderer.cam.tx, MX.App.renderer.cam.tz]);
  logs.push('camera moved by drag ' + (Math.hypot(cam1[0] - cam0[0], cam1[1] - cam0[1]) > 1) + ', laid unchanged ' + await ev(() => MX.Tools.list.PathBuild.laid.length));
  await shot('pb-after-pan');
  /* the toolbar is still there: Construir opens the buildings */
  await tap('[data-id="build"]');
  logs.push('build panel ' + await ev(() => MX.WM.isOpen('build') + ' toolbar ' + !!document.getElementById('toolbar').offsetHeight));
  await shot('pb-build-panel');
};
