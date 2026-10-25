import { install } from './helpers.mjs';
/* every discipline through the «Trazado sugerido» picker in a sandbox park, the new
   facilities, a few days of riders and close-ups of each kind of circuit */
export default async ({ page, shot, wait, ev, logs }) => {
  const phone = await ev(() => document.documentElement.classList.contains('phone'));
  const click = async (sel) => { const l = page.locator(sel).first(); if (phone) await l.tap(); else await l.click(); await wait(350); };
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'sandbox', preset: 'valle', parkName: 'Disciplinas', tutorial: false }));
  await wait(800);
  await install(ev);
  /* the facilities by the road first, so the suggested loops keep clear of them */
  logs.push('facilities ' + await ev(() => {
    const g = MX.App.game, bad = [];
    const place = (type, tx, tz, rot) => { const r = g.placeBuilding(type, tx, tz, rot || 0); if (!r.ok) bad.push(type + ': ' + r.reason); };
    place('parking', 26, 76); place('paddock', 50, 76); place('paddock', 54, 76);
    for (let x = 22; x <= 66; x++) g.placePath(x, 73, 1);
    for (let z = 74; z <= 78; z++) g.placePath(29, z, 1);
    place('entrance', 30, 74); place('toilets', 34, 72, 2); place('restaurant_big', 36, 70, 2); place('megastore', 40, 71, 2);
    place('playground', 43, 71, 2); place('parts', 46, 74); place('wash', 47, 75); place('rental', 58, 75);
    place('medical', 62, 74); place('showers', 45, 74); place('grandstand', 22, 70, 2);
    g.rebuildFields();
    return bad.length ? bad.join(' | ') : 'ok';
  }));
  await click('[data-id="tracks"]');
  await click('.win .btn:has-text("Trazado sugerido")');
  await shot('picker');
  const names = { carcross: 'Car cross', enduro: 'Crono de enduro', mx: 'Motocross', kids: 'Minicross', flat: 'Dirt track', sx: 'Supercross' };
  for (const type of ['carcross', 'enduro', 'flat', 'mx', 'sx', 'kids']) {
    if (!await ev(() => !!document.querySelector('.type-card'))) await click('.win .btn:has-text("Trazado sugerido")');
    await click('.type-card:has-text("' + names[type] + '")');
    await wait(500);
    logs.push(type + ' ' + await ev((type) => {
      const t = MX.App.game.selectedTrack;
      if (!t || t.type !== type) return 'NOT CREATED (selected ' + (t && t.type) + '): ' + Array.from(document.querySelectorAll('#toasts > *')).map(e => e.textContent).join(' | ');
      return JSON.stringify({ len: Math.round(t.length), closed: t.closed, w: t.pieces[0] && t.pieces[0].w, surf: t.pieces[0] && t.pieces[0].surf, feats: t.features.map(f => f.type).join(',') });
    }, type));
  }
  await shot('constructor-last');
  logs.push('open ' + await ev(() => {
    const g = MX.App.game;
    return g.tracks.map(t => { const r = g.openTrack(t); return t.type + ':' + (r.ok ? 'ok' : r.reason); }).join(' | ');
  }));
  await click('.win .win-x');
  /* a few days of riders */
  await ev(() => { const g = MX.App.game; for (let i = 0; i < 30 * 30 * 6; i++) { if (g.fieldsDirty) g.rebuildFields(); g.step(1 / 30); } });
  await wait(1200);
  logs.push('laps ' + await ev(() => MX.App.game.tracks.map(t => t.type + ' ' + t.totals.laps + ' riding ' + MX.App.game.riders.filter(r => r.trackId === t.id && r.m).length).join(' | ')));
  logs.push('riders ' + await ev(() => { const g = MX.App.game, by = {}; for (const r of g.riders) { const k = r.disc + ':' + r.state; by[k] = (by[k] || 0) + 1; } return JSON.stringify(by) + ' rates ' + JSON.stringify(g.riderRates()) + ' day ' + g.day + ' open ' + g.openTracks().length; }));
  for (const type of ['carcross', 'enduro', 'flat', 'mx', 'sx', 'kids']) {
    const ok = await ev((type) => {
      const g = MX.App.game, t = g.tracks.find(x => x.type === type);
      if (!t || !t.S) return false;
      let x = 0, z = 0; for (let i = 0; i < t.S.n; i++) { x += t.S.x[i]; z += t.S.z[i]; }
      const c = MX.App.renderer.cam; c.follow = null; c.zoom = c.targetZoom = type === 'kids' ? 7 : type === 'carcross' || type === 'enduro' ? 4.2 : 5.2;
      __q.focus(x / t.S.n, z / t.S.n, innerWidth / 2, innerHeight / 2);
      return true;
    }, type);
    if (!ok) { logs.push('no track ' + type); continue; }
    await wait(900);
    await shot('track-' + type);
    const who = await ev((type) => {
      const g = MX.App.game, t = g.tracks.find(x => x.type === type);
      const r = g.riders.find(r => r.trackId === t.id && r.m && !r.m.crash) || g.riders.find(r => r.trackId === t.id && r.m);
      if (!r) return null;
      const c = MX.App.renderer.cam; c.follow = r; c.zoom = c.targetZoom = 15;
      return r.name + ' ' + r.disc + ' ' + r.bike.id;
    }, type);
    logs.push('follow ' + type + ' ' + who);
    if (who) { await wait(1300); await shot('ride-' + type); }
    if (who && (type === 'mx' || type === 'flat')) {
      await ev(() => MX.App.panels.agent(MX.App.renderer.cam.follow));
      await wait(600);
      logs.push('rider panel ' + await ev(() => { const e = document.querySelector('.bike-shot'); return e ? e.textContent + ' img ' + (e.querySelector('img').src.length > 100) : 'none'; }));
      await shot('panel-' + type);
      await ev(() => { for (const b of document.querySelectorAll('.win .win-x')) b.click(); });
    }
  }
  /* the new facilities */
  await ev(() => { const c = MX.App.renderer.cam; c.follow = null; c.zoom = c.targetZoom = 9; __q.focus(44 * 4, 73 * 4, innerWidth / 2, innerHeight / 2); });
  await wait(1200);
  await shot('facilities');
  /* events: only the circuits of the event's discipline */
  await click('.tg-switch').catch(() => {});
  await ev(() => { const bar = document.getElementById('toolbar'); if (!bar.classList.contains('mgmt')) { const s = document.querySelector('.tg-switch'); if (s) s.click(); } });
  await ev(() => MX.App.panels.events());
  await wait(400);
  await click('.evt:has-text("Enduro cronometrado")');
  logs.push('enduro event tracks ' + await ev(() => Array.from(document.querySelectorAll('#ev-track option')).map(o => o.textContent).join(' | ')));
  await shot('event-enduro');
  await click('.evt:has-text("Carrera amateur")');
  logs.push('amateur event tracks ' + await ev(() => Array.from(document.querySelectorAll('#ev-track option')).map(o => o.textContent).join(' | ')));
  await click('.win .win-x');
  await ev(() => MX.App.panels.build('public'));
  await wait(500);
  await shot('build-public');
  await click('.win .win-x');
};
