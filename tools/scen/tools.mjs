import { install, clickWorld, dragWorld, clickText } from './helpers.mjs';
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'career', preset: 'colinas', parkName: 'QA Herramientas', tutorial: false }));
  await wait(800);
  await install(ev);
  const S = () => ev(() => { const g = MX.App.game; return Math.round(g.econ.money); });
  /* track by code, left under construction for editing */
  await ev(() => {
    const g = MX.App.game, tr = g.newTrack();
    g.editTrack(tr, (t) => { for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; t.addNode(160 + Math.cos(a) * 50, 210 + Math.sin(a) * 38, 8, 'dirt'); } t.closed = true; });
    g.selectedTrack = tr;
    const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 3.2; __q.focus(160, 210, 820, 400);
  });
  await wait(400);
  /* terrain: raise with hold, lower, level, smooth */
  await page.click('[data-id="terrain"]'); await wait(300);
  const h0 = await ev(() => MX.App.game.world.tileCenterH(50, 46));
  await clickText(page, '.win .btn.tool', 'Subir');
  await clickText(page, '.win .btn.small', '3x3');
  const p = await ev(() => __q.w2s(50 * 4 + 2, 46 * 4 + 2, 0));
  await page.mouse.move(p.x, p.y); await wait(150); await page.mouse.down(); await wait(900); await page.mouse.up(); await wait(200);
  const h1 = await ev(() => MX.App.game.world.tileCenterH(50, 46));
  await clickText(page, '.win .btn.tool', 'Excavar');
  const q = await ev(() => __q.w2s(30 * 4 + 2, 44 * 4 + 2, 0));
  await page.mouse.move(q.x, q.y); await wait(150); await page.mouse.down(); await wait(500); await page.mouse.up(); await wait(200);
  await clickText(page, '.win .btn.tool', 'Suavizar');
  await page.mouse.move(p.x, p.y); await wait(150); await page.mouse.down(); await wait(400); await page.mouse.up(); await wait(200);
  await clickText(page, '.win .btn.small', 'Arena');
  await page.mouse.move(q.x + 40, q.y); await wait(150); await page.mouse.down(); await page.mouse.move(q.x + 90, q.y + 10, { steps: 5 }); await page.mouse.up(); await wait(200);
  logs.push('terrain h ' + h0.toFixed(2) + ' -> ' + h1.toFixed(2) + ' after smooth ' + (await ev(() => MX.App.game.world.tileCenterH(50, 46))).toFixed(2) + ' money ' + await S());
  await shot('terrain');
  /* land purchase */
  await clickText(page, '.win .btn', 'Comprar terreno');
  const forSale = await ev(() => { const w = MX.App.game.world; for (let pz = 0; pz < w.PN; pz++) for (let px = 0; px < w.PN; px++) if (w.parcelState(px, pz) === 1) return { px, pz }; return null; });
  logs.push('parcel for sale ' + JSON.stringify(forSale));
  if (forSale) {
    const x = (forSale.px + 0.5) * 32, z = (forSale.pz + 0.5) * 32;
    await ev(([x, z]) => __q.focus(x, z, 820, 400), [x, z]); await wait(300);
    await shot('land-tool');
    await clickWorld(page, ev, x, z, { force: true });
    await wait(300);
    await shot('land-confirm');
    await clickText(page, '#modal .btn', 'Sí'); await wait(300);
    logs.push('parcel state now ' + await ev(([px, pz]) => MX.App.game.world.parcelState(px, pz), [forSale.px, forSale.pz]) + ' money ' + await S());
  }
  await page.keyboard.press('Escape'); await ev(() => MX.WM.closeAll());
  await ev(() => __q.focus(160, 210, 820, 400)); await wait(300);
  /* track editing: surface, width, elevation, drag a node */
  await page.click('[data-id="tracks"]'); await wait(400);
  await clickText(page, '.subtabs .tab', 'Superficie'); await wait(200);
  await ev(() => MX.App.game.unlock('research:sand'));
  await clickText(page, '.subtabs .tab', 'Elementos'); await clickText(page, '.subtabs .tab', 'Superficie');
  await clickText(page, '.win .btn.swatch', 'Arena');
  const n2 = await ev(() => { const t = MX.App.game.selectedTrack; const a = t.nodes[2], b = t.nodes[3]; return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }; });
  await clickWorld(page, ev, n2.x, n2.z);
  await clickText(page, '.win .btn.small', '12 m');
  const n6 = await ev(() => { const t = MX.App.game.selectedTrack; const a = t.nodes[6], b = t.nodes[7]; return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }; });
  await clickWorld(page, ev, n6.x, n6.z);
  logs.push('surfaces ' + await ev(() => MX.App.game.selectedTrack.nodes.map(n => n.surf[0] + n.w).join(' ')));
  await clickText(page, '.subtabs .tab', 'Trazado'); await wait(200);
  await clickText(page, '.win .btn.tool', 'Subidas y bajadas');
  const n4 = await ev(() => { const t = MX.App.game.selectedTrack; return { x: t.nodes[4].x, z: t.nodes[4].z }; });
  for (let k = 0; k < 4; k++) await clickWorld(page, ev, n4.x, n4.z, { y: k * 0.5 });
  logs.push('elev ' + await ev(() => MX.App.game.selectedTrack.nodes.map(n => n.elev).join(',')));
  await shot('elevation');
  await clickText(page, '.win .btn.tool', 'Editar puntos');
  const n8 = await ev(() => { const t = MX.App.game.selectedTrack; return { x: t.nodes[8].x, z: t.nodes[8].z }; });
  await dragWorld(page, ev, [[n8.x, n8.z], [n8.x - 4, n8.z - 6], [n8.x - 8, n8.z - 10]]);
  logs.push('node8 moved to ' + await ev(() => { const n = MX.App.game.selectedTrack.nodes[8]; return n.x.toFixed(1) + ',' + n.z.toFixed(1); }) + ' from ' + n8.x.toFixed(1) + ',' + n8.z.toFixed(1));
  /* features + test run + test report */
  await ev(() => { const g = MX.App.game, tr = g.selectedTrack; for (const type of ['start', 'finish', 'tabletop_m', 'berm', 'whoops']) { for (let s = 0; s < tr.length; s += 3) if (tr.checkFeature(type, s).ok) { g.addFeature(tr, type, s); break; } } });
  await clickText(page, '.subtabs .tab', 'Elementos'); await wait(300);
  const nf0 = await ev(() => MX.App.game.selectedTrack.features.length);
  await page.locator('.feat-row', { hasText: 'Whoops' }).locator('.mini.danger').click(); await wait(300);
  logs.push('features ' + nf0 + ' -> ' + await ev(() => MX.App.game.selectedTrack.features.length));
  logs.push('validate ' + await ev(() => JSON.stringify(MX.App.game.validateTrack(MX.App.game.selectedTrack).map(i => i.level + ':' + i.msg))));
  await clickText(page, '.win .btn', 'Probar'); await wait(500);
  logs.push('test state ' + await ev(() => MX.App.game.selectedTrack.state) + ' windows ' + await ev(() => [...MX.WM.wins.keys()].join(',')));
  await page.click('.tb-speed .sp[data-v="8"]');
  const until = Date.now() + 120000;
  while (Date.now() < until && await ev(() => MX.App.game.selectedTrack.state) === 'testing') await wait(1500);
  await page.click('.tb-speed .sp[data-v="1"]');
  logs.push('after test ' + await ev(() => { const t = MX.App.game.selectedTrack; return t.state + ' stats ' + (t.stats ? t.stats.diff.toFixed(1) + '/' + t.stats.rating.toFixed(1) : 'none'); }));
  await shot('test-report');
  await ev(() => MX.WM.closeAll()); await page.keyboard.press('Escape');
  /* decor + demolish */
  await page.click('[data-id="decor"]'); await wait(400);
  await shot('decor-window');
  await page.locator('.win .card').nth(2).click(); await wait(200);
  await ev(() => __q.focus(122, 282, 900, 380)); await wait(300);
  await clickWorld(page, ev, 120 + 2, 280 + 2);
  logs.push('scenery at tile ' + await ev(() => { const w = MX.App.game.world; return w.scen[w.idx(30, 70)]; }));
  await ev(() => MX.WM.closeAll()); await page.keyboard.press('Escape');
  await ev(() => { MX.App.game.placeBuilding('toilets', 33, 70, 0); const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 8; __q.focus(134, 282, 700, 380); });
  await wait(400);
  await page.click('[data-id="demolish"]'); await wait(200);
  const tb = await ev(() => { const b = MX.App.game.buildingsOf('toilets')[0]; return { x: b.cx, z: b.cz, y: b.y + 1.5 }; });
  const bp = await ev(([x, z, y]) => { const p = MX.App.renderer.worldToCss(x, y, z); return { x: p[0], y: p[1] }; }, [tb.x, tb.z, tb.y]);
  await page.mouse.move(bp.x, bp.y); await wait(200); await page.mouse.down(); await page.mouse.up(); await wait(300);
  await shot('demolish-confirm');
  await clickText(page, '#modal .btn', 'Sí'); await wait(300);
  logs.push('toilets left ' + await ev(() => MX.App.game.count('toilets')) + ' money ' + await S());
};
