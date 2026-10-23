import { install, clickWorld, clickText } from './helpers.mjs';
/* manual closed rectangle through the constructor buttons, then elements, opening and riders */
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'career', preset: 'valle', parkName: 'Cierre manual', tutorial: false }));
  await wait(800);
  await install(ev);
  await ev(() => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 3.2; __q.focus(152, 224, 830, 390); });
  await page.click('[data-id="tracks"]'); await wait(400);
  await page.click('#win-tracks-new'); await wait(300);
  /* gate (middle of the start straight) at lattice 32 + 4.5 = 36.5 -> world 146, z 176 */
  const sp = await ev(() => __q.w2s(146, 176, 0));
  await page.mouse.move(sp.x, sp.y, { steps: 3 }); await wait(300);
  await page.mouse.down(); await page.mouse.up(); await wait(600);
  logs.push('origin ' + await ev(() => JSON.stringify(MX.App.game.selectedTrack.origin)));
  const dir = async (label) => { await page.locator('.bld-dirs .bld-btn[aria-label="' + label + '"]').click(); await wait(200); };
  const len = async (label) => { await clickText(page, '.builder .btn.small', label); };
  const build = async (n) => { for (let i = 0; i < (n || 1); i++) { await page.click('#bld-build'); await wait(350); } };
  const R2 = 'Curva media a la derecha';
  await dir('Recta'); await len('Media'); await build();
  await dir(R2); await clickText(page, '.builder .btn.small', 'Peralte', true); await build(2);
  await dir('Recta'); await len('Larga'); await build(2);
  await dir(R2); await build(2);
  await dir('Recta'); await build(2);
  await dir(R2); await build(2);
  await dir('Recta'); await build(2);
  await dir(R2); await build(1);
  await shot('about-to-close');
  logs.push('preview before closing: ' + await ev(() => document.querySelector('.bld-preview').textContent));
  await build(1);
  logs.push('banks ' + await ev(() => MX.App.game.selectedTrack.pieces.map(p => p.t === 'curve' ? p.bank : '-').join('')));
  logs.push('closed? ' + await ev(() => { const t = MX.App.game.selectedTrack; return JSON.stringify({ closed: t.closed, pieces: t.pieces.length, len: Math.round(t.length), tool: MX.Tools.current.name, section: MX.App.trackUI.section }); }));
  await shot('closed-manual');
  /* elements tab: add a tabletop on a straight and the finish line */
  const place = async (name, type, from) => {
    await page.locator('.feat', { hasText: name }).first().click(); await wait(250);
    const spot = await ev(([type, from]) => {
      const tr = MX.App.game.selectedTrack, d = MX.Catalog.features[type];
      for (let s = from; s < tr.length + from; s += 2) {
        const ss = s % tr.length;
        if (!tr.checkFeature(type, ss).ok) continue;
        const off = (d.kind === 'finish') ? 1 : (d.len || tr.featureLen(type, ss)) / 2;
        const p = __q.trackPoint(tr, ss + off, 0);
        const scr = __q.w2s(p.x, p.z, p.y - MX.App.game.world.heightAt(p.x, p.z));
        if (__q.freeAt(scr.x, scr.y)) return { x: p.x, z: p.z, y: p.y - MX.App.game.world.heightAt(p.x, p.z) };
      }
      return null;
    }, [type, from]);
    if (!spot) { logs.push('no spot ' + type); return; }
    await clickWorld(page, ev, spot.x, spot.z, { y: spot.y });
  };
  await place('Tabletop mediano', 'tabletop_m', 140);
  await place('Línea de meta', 'finish', 250);
  logs.push('features ' + await ev(() => MX.App.game.selectedTrack.features.map(f => f.type + (f.auto ? '*' : '')).join(',')));
  await ev(() => { const g = MX.App.game; g.placeBuilding('parking', 26, 76, 0); g.placeBuilding('paddock', 50, 76, 0); for (let x = 26; x <= 48; x++) g.placePath(x, 73, 1); for (let z = 74; z <= 78; z++) g.placePath(29, z, 1); g.placeBuilding('entrance', 30, 74, 0); g.placeBuilding('toilets', 34, 72, 2); g.rebuildFields(); });
  await clickText(page, '.win .btn', 'Abrir al público'); await wait(600);
  logs.push('state ' + await ev(() => { const t = MX.App.game.selectedTrack; return t.state + ' ' + (t.stats ? t.stats.diff.toFixed(1) + '/' + t.stats.rating.toFixed(1) : '') + ' issues ' + JSON.stringify((t.issues || []).map(i => i.msg)); }));
  await page.click('.tb-speed .sp[data-v="8"]');
  const until = Date.now() + 90000;
  while (Date.now() < until && await ev(() => MX.App.game.selectedTrack.totals.laps) < 3) await wait(1500);
  await page.click('.tb-speed .sp[data-v="1"]');
  logs.push('laps ' + await ev(() => MX.App.game.selectedTrack.totals.laps + ' riders ' + MX.App.game.riders.length));
  await ev(() => { MX.WM.closeAll(); const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 4; __q.focus(152, 224, 640, 360); });
  await wait(1000);
  await shot('riding');
};
