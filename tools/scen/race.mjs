import { install, clickText } from './helpers.mjs';
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  await clickText(page, '#title button', 'Modo sandbox');
  await clickText(page, '#modal .btn', 'Empezar');
  await wait(1000);
  await install(ev);
  const info = await ev(() => {
    const g = MX.App.game, Cat = MX.Catalog;
    const tr = g.newTrack();
    const cx = 160, cz = 200;
    const pts = [[0, 1], [0.55, 0.85], [0.95, 0.55], [1, 0], [0.8, -0.6], [0.3, -0.75], [-0.1, -0.4], [-0.45, -0.85], [-0.9, -0.6], [-1, 0], [-0.8, 0.6], [-0.4, 0.9]];
    g.editTrack(tr, (t) => { for (const p of pts) t.addNode(cx + p[0] * 62, cz + p[1] * 46, 9, 'dirt'); t.closed = true; });
    const place = (type, from) => { for (let s = from || 0; s < tr.length; s += 2) { if (tr.checkFeature(type, s).ok) { g.addFeature(tr, type, s); return true; } } return false; };
    ['start', 'finish', 'tabletop_m', 'double_s', 'rollers', 'tabletop_l', 'whoops', 'triple', 'rhythm', 'stepup'].forEach((t, i) => place(t, i * 30));
    for (let k = 0; k < 6; k++) place('berm', k * 60);
    const B = (t, x, z, r) => g.placeBuilding(t, x, z, r || 0);
    B('parking', 26, 76); B('parking', 30, 76); B('paddock', 50, 76); B('paddock', 46, 76);
    for (let x = 26; x <= 56; x++) g.placePath(x, 73, 2);
    for (let z = 74; z <= 78; z++) g.placePath(29, z, 2);
    for (let z = 66; z <= 72; z++) g.placePath(40, z, 2);
    for (let x = 30; x <= 50; x++) g.placePath(x, 66, 2);
    B('entrance', 30, 74); B('toilets', 34, 72, 2); B('foodtruck', 36, 72, 2); B('shop', 38, 72, 2);
    B('grandstand', 33, 64, 2); B('grandstand', 36, 64, 2); B('grandstand', 43, 64, 2); B('medical', 47, 70); B('tower', 33, 69); B('podium', 44, 70);
    g.rebuildFields();
    const op = g.openTrack(tr);
    g.hire('medic', g.candidates('medic')[0]); g.hire('marshal', g.candidates('marshal')[0]);
    return { len: Math.round(tr.length), open: op.ok, reason: op.reason, feats: tr.features.map(f => f.type).join(','), stats: tr.stats && { diff: tr.stats.diff.toFixed(1), rating: tr.stats.rating.toFixed(1) } };
  });
  logs.push('setup ' + JSON.stringify(info));
  await ev(() => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 4; __q.focus(160, 220, 640, 380); });
  await page.click('[data-id="events"]'); await wait(500);
  await page.locator('.evt', { hasText: 'Carrera amateur' }).click(); await wait(300);
  await shot('event-organize');
  const reqs = await ev(() => [...document.querySelectorAll('.req')].map(r => r.className + ' ' + r.textContent).join(' | '));
  logs.push('reqs ' + reqs);
  await page.locator('.win .btn.primary.big').click(); await wait(500);
  logs.push('scheduled ' + await ev(() => JSON.stringify(MX.App.game.comp.scheduled.map(e => ({ type: e.type, day: e.day })))));
  await ev(() => MX.WM.closeAll());
  await page.click('.tb-speed .sp[data-v="8"]');
  const until = Date.now() + 240000;
  let phase = '';
  while (Date.now() < until) {
    const p = await ev(() => MX.App.game.race ? MX.App.game.race.phase : '');
    if (p !== phase) { phase = p; logs.push('race phase: ' + p + ' at ' + await ev(() => MX.App.game.dateText())); }
    if (p === 'race') break;
    await wait(1000);
  }
  await page.click('.tb-speed .sp[data-v="1"]');
  await wait(4000);
  logs.push('crowd ' + await ev(() => { const g = MX.App.game; return JSON.stringify({ vis: g.visitors.length, ev: g.visitors.filter(v => v.event).length, watch: g.visitors.filter(v => v.state === 'watch' || v.state === 'seat').length }); }));
  await shot('race-live');
  await ev(() => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 8; __q.focus(150, 262, 640, 360); });
  await wait(1500);
  await shot('race-crowd');
  await page.click('.tb-speed .sp[data-v="4"]');
  const until2 = Date.now() + 300000;
  while (Date.now() < until2) {
    const st = await ev(() => { const g = MX.App.game; return { p: g.race ? g.race.phase : 'none', res: MX.WM.isOpen('results') }; });
    if (st.p !== phase) { phase = st.p; logs.push('race phase: ' + st.p); }
    if (st.res) break;
    await wait(1500);
  }
  await page.click('.tb-speed .sp[data-v="1"]');
  await wait(800);
  await shot('race-results');
  await ev(() => { const g = MX.App.game; const pod = g.buildingsOf('podium')[0]; const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 14; if (pod) __q.focus(pod.cx, pod.cz, 760, 360); MX.WM.closeAll(); });
  await wait(1200);
  await shot('podium');
  logs.push('history ' + await ev(() => JSON.stringify(MX.App.game.comp.history.slice(-1).map(e => ({ name: e.name, att: e.attendance, rev: e.revenue, q: e.quality, win: e.standings && e.standings[0] && e.standings[0].name })))));
  logs.push('money ' + await ev(() => Math.round(MX.App.game.econ.money)));
};
