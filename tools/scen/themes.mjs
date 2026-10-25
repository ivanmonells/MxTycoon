import { install } from './helpers.mjs';
/* the decoration window with one tab per themed pack, placing pieces of each pack
   beside a suggested motocross track, the themed zone on the track card and close-ups */
export default async ({ page, shot, wait, ev, logs }) => {
  const phone = await ev(() => document.documentElement.classList.contains('phone'));
  const click = async (sel) => { const l = page.locator(sel).first(); if (phone) await l.tap(); else await l.click(); await wait(350); };
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'sandbox', preset: 'valle', parkName: 'Temático', tutorial: false }));
  await wait(800);
  await install(ev);
  /* a suggested motocross loop to decorate */
  await click('[data-id="tracks"]');
  await click('.win .btn:has-text("Trazado sugerido")');
  await click('.type-card:has-text("Motocross")');
  await wait(500);
  logs.push('track ' + await ev(() => { const t = MX.App.game.selectedTrack; return t ? t.type + ' closed ' + t.closed + ' len ' + Math.round(t.length) : 'none'; }));
  await ev(() => { for (const b of document.querySelectorAll('.win .win-x')) b.click(); MX.Tools.select(); });
  await wait(300);

  /* the decoration window: every tab */
  await click('[data-id="decor"]');
  const tabs = await ev(() => Array.from(document.querySelectorAll('.win .tab')).map(t => t.textContent));
  logs.push('tabs ' + tabs.join(' | '));
  for (const name of tabs) {
    await click('.win .tab:has-text("' + name + '")');
    const cards = await ev(() => Array.from(document.querySelectorAll('.win .card b')).map(b => b.textContent));
    logs.push('  ' + name + ': ' + cards.join(', '));
    if (name === 'Mad Max' || name === 'Granja') await shot('tab-' + name.replace(/\s+/g, '-'));
  }
  /* pick a piece from a tab: the tool follows and the info box shows it */
  await click('.win .tab:has-text("Granja")');
  await click('.win .card:has-text("Granero")');
  logs.push('tool ' + await ev(() => MX.Tools.current.name + ' ' + MX.Tools.current.type + ' info ' + (document.querySelector('.win .card-info b') || {}).textContent));

  /* place pieces of every pack around the track, three or more per pack */
  const placed = await ev(() => {
    const g = MX.App.game, w = g.world, tr = g.selectedTrack || g.tracks[0];
    const occ = new Set(tr.tiles), spots = [];
    for (const t of tr.tiles) {
      const x = t % w.N, z = (t / w.N) | 0;
      for (const [dx, dz] of [[0, 2], [2, 0], [0, -2], [-2, 0], [2, 2], [-2, -2]]) {
        const tx = x + dx, tz = z + dz, i = w.idx(tx, tz);
        if (!w.inBounds(tx, tz) || occ.has(i) || w.trackOcc[i] || w.bld[i] >= 0 || w.path[i] || w.isWater(tx, tz) || !w.owned[i]) continue;
        if (spots.some(s => Math.abs(s.tx - tx) < 2 && Math.abs(s.tz - tz) < 2)) continue;
        spots.push({ tx, tz });
      }
    }
    const packs = MX.Catalog.decorThemes.filter(t => t.id !== 'basic').map(t => t.id);
    const out = {};
    let k = 0;
    for (const p of packs) {
      const items = Object.keys(MX.Catalog.decor).filter(d => MX.Catalog.decor[d].theme === p);
      for (const d of items) {
        const s = spots[k++];
        if (!s) break;
        w.removeSceneryAt(s.tx, s.tz);
        const r = g.placeDecor(d, s.tx, s.tz, (k % 4) * Math.PI / 2);
        out[p] = (out[p] || 0) + (r.ok ? 1 : 0);
        if (!r.ok) out[p + ':' + d] = r.reason;
      }
    }
    for (let i = 0; i < 10; i++) g.step(1 / 30);
    window.__spots = spots.slice(0, k);
    return JSON.stringify(out) + ' spots ' + spots.length;
  });
  logs.push('placed ' + placed);
  logs.push('zones ' + await ev(() => { const t = MX.App.game.tracks[0]; if (!t.stats) MX.TrackAnalyzer.analyze(t, MX.App.game.world, MX.App.game); return JSON.stringify({ themes: t.stats.themes, rating: +t.stats.rating.toFixed(2), base: +t.stats.base.rating.toFixed(2) }); }));
  /* the pack tab says where its zone is (on a phone, picking a piece folds the sheet) */
  if (phone) { logs.push('sheet after picking ' + await ev(() => document.querySelector('.win').dataset.sheet)); await ev(() => MX.WM.setSheet('decor', 'half')); await wait(300); }
  await click('.win .tab:has-text("Surf")');
  logs.push('surf tab note ' + await ev(() => { const e = document.querySelector('.win .theme-zone'); return e ? e.textContent : 'none'; }));
  await shot('tab-surf-zone');
  await ev(() => { for (const b of document.querySelectorAll('.win .win-x')) b.click(); MX.Tools.select(); });
  /* the track card lists the themed zones */
  await ev(() => { MX.App.trackUI.section = 'stats'; MX.App.panels.tracks(MX.App.game.tracks[0]); });
  await wait(500);
  logs.push('track card ' + await ev(() => { const r = Array.from(document.querySelectorAll('.win .kv')).find(e => /temáticas/.test(e.textContent)); return r ? r.textContent : 'none'; }));
  await ev(() => { for (const b of document.querySelectorAll('.win .win-x')) b.click(); });
  await wait(300);
  /* close-ups of the decorated park */
  const groups = await ev(() => {
    const s = window.__spots, out = [];
    for (let i = 0; i < s.length; i += 6) { const g = s.slice(i, i + 6); out.push({ x: g.reduce((a, p) => a + p.tx, 0) / g.length, z: g.reduce((a, p) => a + p.tz, 0) / g.length }); }
    return out;
  });
  for (let i = 0; i < groups.length; i++) {
    await ev(([x, z]) => { const c = MX.App.renderer.cam; c.follow = null; c.zoom = c.targetZoom = 7; __q.focus((x + 0.5) * 4, (z + 0.5) * 4, innerWidth / 2, innerHeight / 2); }, [groups[i].x, groups[i].z]);
    await wait(700);
    await shot('zone-' + i);
  }
  /* the preview turns with R before placing */
  await click('[data-id="decor"]');
  await click('.win .tab:has-text("Mundial MX")');
  await click('.win .card:has-text("Camión de equipo")');
  logs.push('preview ' + await ev(() => { const t = MX.Tools.current; t.hover({ x: 40 * 4, z: 60 * 4 }); const a = t.why; t.rotate(); t.hover({ x: 40 * 4, z: 60 * 4 }); return t.type + ' rot ' + t.rot + ' why ' + (a || 'ok') + ' box ' + Math.round(t.box.y1 - t.box.y0); }));
};
