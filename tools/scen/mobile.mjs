import { install, clickText } from './helpers.mjs';
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(800);
  await shot('m-title');
  await page.locator('#title button', { hasText: 'Nueva partida' }).tap(); await wait(400);
  await shot('m-dialog');
  await page.locator('#modal .btn', { hasText: 'Empezar' }).tap(); await wait(1200);
  await shot('m-game');
  await page.locator('#tutorial .btn', { hasText: 'Empezar' }).tap(); await wait(300);
  /* one-finger pan via touch events */
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const cam0 = await ev(() => [MX.App.renderer.cam.tx, MX.App.renderer.cam.tz, MX.App.renderer.cam.targetZoom]);
  await touch('touchStart', [[200, 400]]);
  for (let k = 1; k <= 8; k++) { await touch('touchMove', [[200 - k * 15, 400 - k * 10]]); await wait(40); }
  await touch('touchEnd', []);
  await wait(300);
  /* pinch zoom */
  await touch('touchStart', [[150, 450], [240, 450]]);
  for (let k = 1; k <= 8; k++) { await touch('touchMove', [[150 - k * 10, 450], [240 + k * 10, 450]]); await wait(40); }
  await touch('touchEnd', []);
  await wait(400);
  const cam1 = await ev(() => [MX.App.renderer.cam.tx, MX.App.renderer.cam.tz, MX.App.renderer.cam.targetZoom]);
  logs.push('cam before ' + cam0.map(v => v.toFixed(1)) + ' after ' + cam1.map(v => v.toFixed(1)));
  logs.push('tutorial ' + await ev(() => MX.App.tutorial.i + 1));
  await page.locator('[data-id="tracks"]').tap(); await wait(500);
  await shot('m-tracks');
  await shot('m-tracks-b');
  await page.locator('#win-tracks-new').tap(); await wait(300);
  /* draw by tapping */
  await install(ev);
  await ev(() => { MX.WM.closeAll(); const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 2.2; __q.focus(158, 212, 195, 470); });
  await wait(500);
  const pts = []; const N = 10;
  for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; pts.push([158 + Math.cos(a) * 50, 212 + Math.sin(a) * 38]); }
  pts.push(pts[0]);
  for (const [x, z] of pts) {
    const p = await ev(([x, z]) => __q.w2s(x, z, 0), [x, z]);
    await touch('touchStart', [[p.x, p.y]]); await wait(60); await touch('touchEnd', []); await wait(220);
  }
  await wait(600);
  logs.push('track ' + await ev(() => { const t = MX.App.game.tracks[0]; return t ? t.nodes.length + ' nodes closed=' + t.closed + ' len=' + Math.round(t.length) : 'none'; }));
  await shot('m-track');
  await page.locator('.tb-right .tb-btn').last().tap(); await wait(400);
  await shot('m-menu');
};
