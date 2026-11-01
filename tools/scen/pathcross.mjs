import { install } from './helpers.mjs';
/* paths and circuits on a desktop: a path under the raised stretch of a circuit (its
   embankment opens into a bridge over it), a footbridge over a stretch at ground level
   built with the path constructor and the keyboard, and a footbridge across the lake */
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'sandbox', preset: 'campo', seed: 2024, parkName: 'Cruces', tutorial: false }));
  await wait(800);
  await install(ev);
  const built = await ev(() => {
    const g = MX.App.game;
    const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);
    const tr = g.newTrack('mx');
    g.placeStart(tr, 36, 44, 7, 8, 'dirt', 0);
    const seq = [P({ t: 'straight', n: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
      P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
      P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 2, slope: 1 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 })];
    for (const p of seq) { const b = g.buildPiece(tr, p); if (!b.ok) return 'refused ' + b.reason; }
    const ac = g.autoComplete(tr, 8, 'dirt');
    g.selectedTrack = null;
    return ac.ok ? 'closed ' + Math.round(tr.length) + ' m' : 'not closed ' + ac.reason;
  });
  logs.push('circuit ' + built);
  /* a straight line of ground tiles through the raised stretch */
  const under = await ev(() => {
    const g = MX.App.game, w = g.world, tr = g.tracks[0], N = w.N, S = tr.S;
    for (const t of tr.tiles) {
      const tx = t % N, tz = (t / N) | 0;
      if (w.canPlacePath(tx, tz, 1)) continue;
      const h = tr.nearestS((tx + 0.5) * 4, (tz + 0.5) * 4);
      if (Math.abs(h.lane) > 1.5 || S.y[h.i] - w.heightAt((tx + 0.5) * 4, (tz + 0.5) * 4) < 4) continue;
      for (const [dx, dz] of [[1, 0], [0, 1]]) {
        const line = [];
        for (let k = -5; k <= 5; k++) line.push([tx + dx * k, tz + dz * k]);
        if (line.every(([x, z]) => !w.canPlacePath(x, z, 1))) { for (const [x, z] of line) g.placePath(x, z, 1); return { tx, tz, dx, dz, n: line.length }; }
      }
    }
    return null;
  });
  logs.push('path under the circuit ' + JSON.stringify(under));
  logs.push('circuit still valid ' + await ev(() => JSON.stringify(MX.App.game.tracks[0].validate(MX.App.game.world).filter(i => i.level === 'error').map(i => i.msg))));
  if (under) {
    await ev((u) => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 7; c.yawIndex = 0; __q.focus((u.tx + 0.5) * 4, (u.tz + 0.5) * 4, innerWidth / 2, innerHeight / 2); }, under);
    await wait(700);
    await shot('under');
    await ev(() => { const c = MX.App.renderer.cam; c.yawIndex = 2; });
    await wait(900);
    await shot('under-other-side');
    await ev(() => { MX.App.renderer.cam.yawIndex = 0; });
  }
  /* a footbridge over a stretch at ground level, with the constructor and the keyboard */
  const fb = await ev(() => {
    const g = MX.App.game, w = g.world, tr = g.tracks[0], N = w.N, S = tr.S;
    const PB = MX.Tools.list.PathBuild;
    for (let i = 0; i < S.n; i += 6) {
      if (S.y[i] - w.heightAt(S.x[i], S.z[i]) > 0.5) continue;
      const tx = Math.floor(S.x[i] / 4), tz = Math.floor(S.z[i] / 4);
      for (const [k, dx, dz] of [[1, 1, 0], [2, 0, 1]]) {
        /* 6 tiles before, 4 over, 6 after: all free and on our level land */
        const line = [];
        for (let q = -8; q <= 8; q++) line.push([tx + dx * q, tz + dz * q]);
        const ok = line.every(([x, z]) => w.inBounds(x, z) && w.owned[w.idx(x, z)] && !w.path[w.idx(x, z)] && w.bld[w.idx(x, z)] < 0 && !w.isWater(x, z) && w.tileSlope(x, z) < 1.2);
        const ends = [line[0], line[line.length - 1]].every(([x, z]) => !w.trackOcc[w.idx(x, z)] && !w.canPlacePath(x, z, 1));
        if (ok && ends) return { tx: line[0][0], tz: line[0][1], dir: k, over: [tx, tz] };
      }
    }
    return null;
  });
  logs.push('footbridge line ' + JSON.stringify(fb));
  if (fb) {
    await ev(() => { MX.App.panels.paths(); });
    await wait(300);
    await page.locator('.win .btn.tool', { hasText: 'grava' }).first().click();
    await wait(200);
    await ev((fb) => { const pb = MX.Tools.list.PathBuild; pb.start({ tx: fb.tx, tz: fb.tz }); pb.dir = fb.dir; pb.refresh(); }, fb);
    await ev((fb) => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 5.5; __q.focus((fb.over[0] + 0.5) * 4, (fb.over[1] + 0.5) * 4, innerWidth / 2 + 120, innerHeight / 2); }, fb);
    const log = [];
    const press = async (key, n) => { for (let q = 0; q < (n || 1); q++) { await page.keyboard.press(key); await wait(120); } };
    await press('Enter');              // the first tile
    await press('ArrowUp');            // Subida
    for (let q = 0; q < 6; q++) { await press('Enter'); log.push(await ev(() => { const pb = MX.Tools.list.PathBuild; return pb.cur.tx + ',' + pb.cur.tz; })); }
    await press('ArrowDown');          // Llano
    let deck = 0, why = null;
    for (let q = 0; q < 8; q++) {
      const st = await ev(() => { const pb = MX.Tools.list.PathBuild, n = pb.plan(), w = MX.App.game.world; return { reason: n && n.reason, track: !!(n && w.inBounds(n.tx, n.tz) && w.trackOcc[w.idx(n.tx, n.tz)]) }; });
      if (st.reason) { why = st.reason; break; }
      await press('Enter'); deck++;
      const after = await ev(() => { const pb = MX.Tools.list.PathBuild, w = MX.App.game.world, c = pb.cur; return !!w.trackOcc[w.idx(c.tx, c.tz)]; });
      if (!after && !st.track && deck > 2) break;
    }
    log.push('deck ' + deck + (why ? ' stopped: ' + why : ''));
    await shot('footbridge-deck');
    await press('ArrowDown');          // Bajada
    for (let q = 0; q < 8; q++) {
      const r = await ev(() => { const pb = MX.Tools.list.PathBuild, n = pb.plan(), w = MX.App.game.world; return n && n.reason ? n.reason + ' at ' + n.tx + ',' + n.tz + ' y ' + n.y + ' s ' + n.s + ' slope ' + pb.slope + ' turn ' + pb.turn + ' dir ' + pb.dir + ' cur ' + pb.cur.tx + ',' + pb.cur.tz + ' h ' + w.pathEdgeH(pb.cur.tx, pb.cur.tz, n.dir) : null; });
      if (r) { log.push('down stopped: ' + r); break; }
      await press('Enter');
    }
    await press('ArrowUp'); await press('Enter');
    logs.push('footbridge ' + log.join(' | '));
    logs.push('walk over it ' + await ev((fb) => { const w = MX.App.game.world, pb = MX.Tools.list.PathBuild; const f = MX.Pathing.bfs(w.N, [w.idx(fb.tx, fb.tz)], (x, z) => w.isWalkable(x, z), 0, (x, z, k) => w.pathLink(x, z, k)); return f.get(pb.cur.tx, pb.cur.tz); }, fb));
    logs.push('circuit valid with it ' + await ev(() => JSON.stringify(MX.App.game.tracks[0].validate(MX.App.game.world).filter(i => i.level === 'error').map(i => i.msg))));
    logs.push('tunnels ' + await ev(() => JSON.stringify(MX.App.game.tracks[0].tunnels)));
    await ev(() => MX.Tools.select());
    await wait(500);
    await shot('footbridge');
  }
  /* the lake: a footbridge across it, the land tape over the water */
  await ev(() => MX.App.newGame({ mode: 'career', preset: 'valle', seed: 26, parkName: 'Lago', tutorial: false }));
  await wait(900);
  await install(ev);
  const lake = await ev(() => {
    const g = MX.App.game, w = g.world, N = w.N;
    /* an owned lake shore: land, then water ahead */
    for (let tz = N - 3; tz > 2; tz--) for (let tx = 2; tx < N - 2; tx++) {
      for (const [k, dx, dz] of [[0, 0, -1], [1, 1, 0], [3, -1, 0], [2, 0, 1]]) {
        const a = w.idx(tx, tz);
        if (!w.owned[a] || w.isWater(tx, tz) || w.canPlacePath(tx, tz, 1)) continue;
        let n = 0;
        for (let q = 1; q <= 4; q++) { const x = tx + dx * q, z = tz + dz * q; if (w.inBounds(x, z) && w.owned[w.idx(x, z)] && w.isWater(x, z)) n++; }
        if (n >= 3) return { tx, tz, dir: k };
      }
    }
    /* none of our own: the closest water to the land, to see the tape across it */
    for (let i = 0; i < N * N; i++) if (w.isWater(i % N, (i / N) | 0)) return { tx: i % N, tz: (i / N) | 0, dir: -1 };
    return null;
  });
  logs.push('lake ' + JSON.stringify(lake));
  if (lake) {
    await ev((l) => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 4; c.yawIndex = 0; __q.focus((l.tx + 0.5) * 4, (l.tz + 0.5) * 4, innerWidth / 2 + 150, innerHeight / 2); }, lake);
    if (lake.dir >= 0) {
      await ev(() => MX.App.panels.paths());
      await wait(300);
      await page.locator('.win .btn.tool', { hasText: 'grava' }).first().click();
      await wait(200);
      const res = await ev((l) => {
        const pb = MX.Tools.list.PathBuild, out = [];
        pb.start({ tx: l.tx, tz: l.tz }); pb.dir = l.dir; pb.slope = 0;
        pb.build();
        let n = pb.plan(); out.push('level into the water: ' + (n.reason || 'ok ' + n.y));
        if (n.reason) { pb.slope = 1; pb.build(); pb.slope = 0; n = pb.plan(); out.push('after one ramp: ' + (n.reason || 'ok')); }
        for (let q = 0; q < 6 && !pb.plan().reason; q++) pb.build();
        out.push('stopped at ' + JSON.stringify(pb.cur) + ' ' + (pb.plan().reason || ''));
        pb.refresh();
        return out.join(' | ');
      }, lake);
      logs.push('lake footbridge: ' + res);
      await wait(300);
      await shot('lake-building');
    }
    await ev(() => MX.Tools.select());
    await wait(300);
    await ev(() => { const r = MX.App.renderer; r.landEdge = 1; });
    await wait(300);
    await shot('lake');
  }
};
