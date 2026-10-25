import { install } from './helpers.mjs';
/* a career park in every environment: the basic facilities by the road, a suggested
   motocross loop through the «Trazado sugerido» button, opening it and a few days of
   riders (QA_SEED picks the map, QA_ENVS a subset) */
export default async ({ page, shot, wait, ev, logs }) => {
  const phone = await ev(() => document.documentElement.classList.contains('phone'));
  const click = async (sel) => { const l = page.locator(sel).first(); if (phone) await l.tap(); else await l.click(); await wait(350); };
  await wait(500);
  const envs = (process.env.QA_ENVS || 'playa,campo,desierto,colinas,montana').split(',');
  const seed = +(process.env.QA_SEED || 2024);
  for (const id of envs) {
    await ev(([id, seed]) => {
      MX.App.newGame({ mode: 'career', preset: id, seed, parkName: 'Pista ' + id, tutorial: false });
    }, [id, seed]);
    await wait(600);
    await install(ev);
    /* the facilities along the road, where the ground is gentle */
    logs.push(id + ' facilities ' + await ev(() => {
      const g = MX.App.game, w = g.world, N = w.N, out = [];
      const tryPlace = (type, z, rot, xs) => { for (const x of xs) { const r = g.placeBuilding(type, x, z, rot); if (r.ok) return x; } out.push(type + ' failed'); return -1; };
      const xs = (from, to) => { const a = []; for (let x = from; x <= to; x++) a.push(x); return a; };
      const px = tryPlace('parking', N - 4, 0, xs(20, 50));
      const pd = tryPlace('paddock', N - 4, 0, xs(px + 4, 60));
      for (let x = Math.max(16, px - 1); x <= pd + 4; x++) g.placePath(x, N - 6, 1);
      tryPlace('entrance', N - 7, 2, xs(px, px + 4));
      tryPlace('toilets', N - 8, 2, xs(px + 3, pd + 3));
      g.rebuildFields();
      return (out.join(', ') || 'ok') + ' money ' + Math.round(g.econ.money);
    }));
    await click('[data-id="tracks"]');
    await click('.win .btn:has-text("Trazado sugerido")');
    if (await ev(() => !!document.querySelector('.type-card'))) await click('.type-card:has-text("Motocross")');
    await wait(600);
    logs.push(id + ' suggested ' + await ev(() => {
      const g = MX.App.game, t = g.selectedTrack;
      if (!t || !t.closed) return 'NOT CREATED: ' + Array.from(document.querySelectorAll('#toasts > *')).map(e => e.textContent).join(' | ');
      const errs = g.validateTrack(t).filter(i => i.level === 'error').map(i => i.msg);
      let ymin = Infinity, ymax = -Infinity; for (let i = 0; i < t.S.n; i++) { ymin = Math.min(ymin, t.S.base[i]); ymax = Math.max(ymax, t.S.base[i]); }
      const st = t.steepest(0, t.S.n);
      return 'len ' + Math.round(t.length) + ' climb ' + (ymax - ymin).toFixed(1) + ' m steepest ' + Math.round(st.slope * 100) + '% errors ' + JSON.stringify(errs);
    }));
    logs.push(id + ' open ' + await ev(() => { const g = MX.App.game, t = g.selectedTrack; if (!t) return 'no track'; const r = g.openTrack(t); return r.ok ? 'ok rating ' + t.stats.rating.toFixed(2) + ' diff ' + t.stats.diff.toFixed(2) + ' elev ' + t.stats.elev.toFixed(1) : r.reason; }));
    await ev(() => { for (const b of document.querySelectorAll('.win .win-x')) b.click(); MX.Tools.select(); });
    await ev(() => { const g = MX.App.game; for (let i = 0; i < 30 * 30 * 3; i++) { if (g.fieldsDirty) g.rebuildFields(); g.step(1 / 30); } });
    logs.push(id + ' riding ' + await ev(() => { const g = MX.App.game, t = g.tracks[0]; return t ? 'laps ' + t.totals.laps + ' crashes ' + t.totals.crashes + ' riders ' + g.riders.length + ' visitors ' + g.visitors.length : 'none'; }));
    const ok = await ev(() => {
      const t = MX.App.game.tracks[0];
      if (!t || !t.S) return false;
      let x = 0, z = 0; for (let i = 0; i < t.S.n; i++) { x += t.S.x[i]; z += t.S.z[i]; }
      const c = MX.App.renderer.cam; c.follow = null; c.zoom = c.targetZoom = 4.2;
      __q.focus(x / t.S.n, z / t.S.n, innerWidth / 2, innerHeight / 2);
      return true;
    });
    if (ok) { await wait(900); await shot(id + '-track'); }
  }
};
