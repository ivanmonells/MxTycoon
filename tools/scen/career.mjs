import { install, clickWorld, dragWorld, clickText } from './helpers.mjs';
export default async ({ page, shot, wait, ev, logs }) => {
  const tut = async () => ev(() => { const t = MX.App.tutorial; return t.active ? (t.i + 1) + ':' + t.steps[t.i].title : 'off'; });
  const step = async (label) => { logs.push('[' + label + '] tutorial=' + await tut() + ' money=' + await ev(() => Math.round(MX.App.game.econ.money))); };
  await wait(800);
  await clickText(page, '#title button', 'Nueva partida');
  await shot('newgame-dialog');
  await clickText(page, '#modal .btn', 'Empezar');
  await wait(1200);
  await install(ev);
  await shot('game-start');
  await step('start');
  logs.push('map ' + await ev(() => MX.App.game.world.preset + ' seed ' + MX.App.game.seed));
  await clickText(page, '#tutorial .btn', 'Empezar');
  /* camera: wheel zoom + keyboard pan */
  await page.mouse.move(900, 300);
  await page.mouse.wheel(0, -400); await wait(500);
  await page.keyboard.down('d'); await wait(900); await page.keyboard.up('d');
  await wait(400);
  await step('camera');
  await page.click('[data-id="tracks"]'); await wait(400);
  await step('tracks open');
  await page.click('#win-tracks-new'); await wait(300);
  await shot('tracks-window');
  /* place the start gate by clicking the terrain */
  await ev(() => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 3.2; __q.focus(152, 224, 830, 390); });
  await wait(300);
  const sp = await ev(() => __q.w2s(146, 176, 0));
  await page.mouse.move(sp.x, sp.y, { steps: 3 }); await wait(300);
  await page.mouse.down(); await page.mouse.up(); await wait(600);
  await step('start placed');
  /* build piece by piece with the constructor */
  const dir = async (label) => { await page.locator('.bld-dirs .bld-btn[aria-label="' + label + '"]').click(); await wait(200); };
  const len = async (label) => { await clickText(page, '.builder .btn.small', label); };
  const buildP = async (n) => { for (let i = 0; i < (n || 1); i++) { await page.click("#bld-build"); await wait(350); } };
  const special = async (name) => { await page.locator('.bld-specials .feat', { hasText: name }).first().click(); await wait(200); };
  await dir('Recta'); await len('Media'); await buildP();
  await dir('Curva media a la derecha'); await clickText(page, '.builder .btn.small', 'Peralte', true); await buildP(2);
  await special('Tabletop mediano'); await buildP();
  await dir('Recta'); await len('Larga'); await buildP();
  await dir('Curva media a la derecha'); await buildP(2);
  await special('Línea de meta'); await buildP();
  await shot('track-under-construction');
  await page.click('#bld-auto'); await wait(1500);
  await shot('track-closed');
  await step('closed');
  const tinfo = await ev(() => { const t = MX.App.game.tracks[0]; return { pieces: t.pieces.length, closed: t.closed, len: Math.round(t.length), feats: t.features.map(f => f.type).join(','), issues: (t.issues || []).map(i => i.msg) }; });
  logs.push('track ' + JSON.stringify(tinfo));
  /* more elements on the closed circuit through the feature palette */
  const featName = async (k) => ev((k) => MX.Catalog.features[k].name, k);
  const placeFeature = async (type, from) => {
    const name = await featName(type);
    await page.locator('.feat', { hasText: name }).first().click(); await wait(250);
    const s = await ev(([type, from]) => {
      const tr = MX.App.game.tracks[0], d = MX.Catalog.features[type];
      for (let s = from; s < tr.length + from; s += 3) {
        const ss = s % tr.length;
        if (!tr.checkFeature(type, ss).ok) continue;
        const off = (d.kind === 'berm' || d.kind === 'start' || d.kind === 'finish') ? 1 : (d.len || tr.featureLen(type, ss)) / 2;
        const p = __q.trackPoint(tr, ss + off, 0);
        const sp = __q.w2s(p.x, p.z, p.y - MX.App.game.world.heightAt(p.x, p.z));
        if (__q.freeAt(sp.x, sp.y)) return { s: ss, x: p.x, z: p.z, y: p.y };
      }
      return null;
    }, [type, from]);
    if (!s) { logs.push('no spot for ' + type); return; }
    await clickWorld(page, ev, s.x, s.z, { y: s.y - await ev(([x, z]) => MX.App.game.world.heightAt(x, z), [s.x, s.z]) });
    await wait(300);
    const has = await ev((type) => MX.App.game.tracks[0].features.filter(f => f.type === type).length, type);
    logs.push('placed ' + type + ' at s=' + s.s + ' -> count ' + has);
  };
  await placeFeature('rollers', 120);
  await placeFeature('whoops', 200);
  await shot('features');
  await step('jumps');
  /* paddock touching the road */
  await page.keyboard.press('Escape'); await wait(200);
  await page.click('[data-id="build"]'); await wait(500);
  await shot('build-window');
  await ev(() => { MX.App.renderer.cam.targetZoom = MX.App.renderer.cam.zoom = 4.5; __q.focus(150, 296, 850, 330); }); await wait(400);
  const build = async (tab, name, tx, tz, w, h) => {
    if (tab) await clickText(page, '.win .tab', tab);
    await page.locator('.card', { hasText: name }).first().click(); await wait(200);
    const x = (tx + w / 2) * 4, z = (tz + h / 2) * 4;
    await clickWorld(page, ev, x, z);
    await wait(250);
    const n = await ev(() => MX.App.game.buildings.size);
    logs.push('build ' + name + ' at ' + tx + ',' + tz + ' -> buildings ' + n);
  };
  await build('Pilotos', 'Paddock', 40, 76, 3, 3);
  await step('paddock');
  await build('Público', 'Aparcamiento', 30, 76, 3, 3);
  await build(null, 'Taquilla', 31, 73, 2, 1);
  await build(null, 'Baños', 35, 72, 1, 1);
  await build(null, 'Food truck', 33, 71, 1, 1);
  await step('public');
  await shot('buildings');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await wait(200);
  /* paths: parking door row -> entrance -> toilets -> towards the track */
  await page.click('[data-id="paths"]'); await wait(400);
  await page.locator('.win .btn.tool').first().click(); await wait(200);
  const T = 4, c = (t) => t * T + 2;
  await dragWorld(page, ev, [[c(32), c(75)], [c(32), c(74)]]);
  await dragWorld(page, ev, [[c(31), c(72)], [c(38), c(72)]]);
  await dragWorld(page, ev, [[c(37), c(71)], [c(37), c(64)]]);
  await shot('paths');
  await step('paths');
  const issues = await ev(() => { const g = MX.App.game; return [...g.buildings.values()].map(b => b.type + ':' + (b.warn || 'ok')); });
  logs.push('warnings ' + JSON.stringify(issues));
  await page.keyboard.press('Escape'); await wait(200);
  /* validate and open */
  await page.click('[data-id="tracks"]'); await wait(400);
  await clickText(page, '.win .btn', 'Validar'); await wait(300);
  await shot('validate');
  const val = await ev(() => (MX.App.game.tracks[0].fullIssues || []).map(i => i.level + ':' + i.msg));
  logs.push('validation ' + JSON.stringify(val));
  logs.push('entry ' + await ev(() => { const t = MX.App.game.tracks[0]; return JSON.stringify({ side: t.chuteSide, entry: t.entry && [t.entry.tx, t.entry.tz, Math.round(t.entry.s)], origin: t.origin, pieces: t.pieces.map(p => p.t[0] + (p.k || p.n || p.f || '') + (p.dir || '')).join(' ') }); }));
  await clickText(page, '.win .btn', 'Abrir al público'); await wait(800);
  await step('opened');
  const st = await ev(() => MX.App.game.tracks[0].state);
  logs.push('track state ' + st);
  await shot('opened');
  await phase2({ page, shot, wait, ev, logs });
  await phase3({ page, shot, wait, ev, logs });
};
export async function phase2({ page, shot, wait, ev, logs }) {
  /* time passes: riders arrive; follow one */
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await wait(200);
  await page.click('.tb-speed .sp[data-v="8"]'); await wait(300);
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    const n = await ev(() => MX.App.game.riders.filter(r => r.m && r.state === 'ride').length);
    if (n >= 2) break;
    await wait(1500);
  }
  await page.click('.tb-speed .sp[data-v="1"]'); await wait(300);
  const info = await ev(() => { const g = MX.App.game; return { day: g.dateText(), riders: g.riders.length, riding: g.riders.filter(r => r.m).length, vis: g.visitors.length, money: Math.round(g.econ.money), tut: MX.App.tutorial.active ? MX.App.tutorial.i + 1 : 'off' }; });
  logs.push('after waiting ' + JSON.stringify(info));
  /* click a rider on track */
  const rp = await ev(() => { const g = MX.App.game; const r = g.riders.find(r => r.m && !r.m.crash); if (!r) return null; const cam = MX.App.renderer.cam; cam.tx = r.m.x; cam.tz = r.m.z; cam.compute(); return true; });
  await wait(600);
  const pos = await ev(() => { const g = MX.App.game; const r = g.riders.find(r => r.m && !r.m.crash); if (!r) return null; const p = MX.App.renderer.worldToCss(r.m.x, r.m.y + 1, r.m.z); return { x: p[0], y: p[1], id: r.id }; });
  if (pos) { await page.mouse.click(pos.x, pos.y); await wait(600); }
  const opened = await ev(() => [...MX.WM.wins.keys()].join(','));
  logs.push('windows after rider click: ' + opened);
  await shot('rider-window');
  const fb = page.locator('.win .btn', { hasText: 'Seguir' }).first();
  if (await fb.count()) { await fb.click(); await wait(1500); }
  await shot('follow');
  logs.push('tutorial now ' + await ev(() => MX.App.tutorial.active ? MX.App.tutorial.i + 1 + ':' + MX.App.tutorial.steps[MX.App.tutorial.i].title : 'off'));
}
export async function phase3({ page, shot, wait, ev, logs }) {
  await clickText(page, '#tutorial .btn', 'Terminar').catch(() => {});
  for (const id of await ev(() => [...MX.WM.wins.keys()])) await ev((id) => MX.WM.close(id), id);
  /* hire staff through the panel */
  await page.click('[data-id="staff"]'); await wait(400);
  await clickText(page, '.win .tab', 'Limpiadores');
  await page.locator('.win .cand .btn', { hasText: 'Contratar' }).first().click(); await wait(300);
  await clickText(page, '.win .tab', 'Mecánicos');
  await shot('staff');
  logs.push('staff ' + await ev(() => MX.App.game.staff.map(s => s.role).join(',')));
  await ev(() => MX.WM.close('staff'));
  /* build a workshop so mechanics can be hired */
  await page.click('[data-id="build"]'); await wait(400);
  await clickText(page, '.win .tab', 'Pilotos');
  await page.locator('.card', { hasText: 'Taller' }).first().click(); await wait(200);
  await ev(() => { MX.App.renderer.cam.targetZoom = MX.App.renderer.cam.zoom = 4.5; __q.focus(176, 296, 850, 360); }); await wait(400);
  await clickWorld(page, ev, 44 * 4 + 4, 77 * 4 + 4);
  logs.push('workshop ' + await ev(() => MX.App.game.count('workshop')));
  await page.keyboard.press('Escape'); await ev(() => MX.WM.closeAll());
  await page.click('[data-id="staff"]'); await wait(300);
  await clickText(page, '.win .tab', 'Mecánicos');
  await page.locator('.win .cand .btn', { hasText: 'Contratar' }).first().click(); await wait(300);
  logs.push('staff ' + await ev(() => MX.App.game.staff.map(s => s.role).join(',')));
  await ev(() => MX.WM.closeAll());
  /* finance panel tabs */
  await page.click('[data-id="finance"]'); await wait(500);
  await shot('finance');
  await clickText(page, '.win .tab', 'Precios'); await wait(300);
  await shot('prices');
  await clickText(page, '.win .tab', 'Gráficos'); await wait(400);
  await ev(() => MX.WM.closeAll());
  /* run time at turbo for a few in-game weeks */
  await page.click('.tb-speed .sp[data-v="8"]');
  const t0 = await ev(() => MX.App.game.day);
  const until = Date.now() + 150000;
  while (Date.now() < until && await ev(() => MX.App.game.day) < t0 + 21) await wait(2000);
  await page.click('.tb-speed .sp[data-v="1"]'); await wait(300);
  const st = await ev(() => { const g = MX.App.game; return { date: g.dateText(), money: Math.round(g.econ.money), rep: Math.round(g.rep), vis: g.visitors.length, riders: g.riders.length, laps: g.tracks[0].totals.laps, obj: g.prog.objIndex, month: g.econ.history.length }; });
  logs.push('after 3 weeks ' + JSON.stringify(st));
  await ev(() => { const g = MX.App.game; const cam = MX.App.renderer.cam; cam.targetZoom = cam.zoom = 6; __q.focus(140, 270, 640, 380); });
  await wait(800);
  await shot('park-running');
  /* events panel and research */
  await page.click('[data-id="events"]'); await wait(500);
  await shot('events');
  await ev(() => MX.WM.closeAll());
  await page.click('[data-id="research"]'); await wait(400);
  await page.locator('.win .res .btn', { hasText: 'Investigar' }).first().click(); await wait(300);
  await shot('research');
  logs.push('research ' + await ev(() => MX.App.game.prog.research.current));
  await ev(() => MX.WM.closeAll());
  await page.click('[data-id="park"]'); await wait(400);
  await clickText(page, '.win .tab', 'Opiniones'); await wait(300);
  await shot('park-thoughts');
  await ev(() => MX.WM.closeAll());
  /* save through the menu */
  await page.click('.tb-right .tb-btn[title^="Menú"]'); await wait(300);
  await clickText(page, '.win .btn', 'Guardar o cargar'); await wait(300);
  await page.locator('.win .slot', { hasText: 'Ranura 1' }).locator('.btn', { hasText: 'Guardar' }).click(); await wait(800);
  await shot('saved');
  const sig = await ev(() => { const g = MX.App.game; return { name: g.parkName, money: Math.round(g.econ.money), day: g.day, b: g.buildings.size, f: g.tracks[0].features.length, staff: g.staff.length }; });
  logs.push('saved signature ' + JSON.stringify(sig));
  await page.reload();
  await page.waitForFunction(() => window.MX && MX.App && MX.App.game && document.getElementById('loading').hidden, null, { timeout: 120000 });
  await wait(800);
  await shot('title-after-reload');
  await clickText(page, '#title button', 'Continuar'); await wait(1500);
  const sig2 = await ev(() => { const g = MX.App.game; return { name: g.parkName, money: Math.round(g.econ.money), day: g.day, b: g.buildings.size, f: g.tracks[0].features.length, staff: g.staff.length, demo: MX.App.demo }; });
  logs.push('loaded signature ' + JSON.stringify(sig2));
  await shot('continued');
}
