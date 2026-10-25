/* Headless test of the five starting environments over several seeds: the road stays dry
   and level, the basic facilities fit along it, riders can reach the starting land, the
   relief grows from the beach to the mountains, a circuit built piece by piece closes
   with «Cerrar» without slope errors, and a save keeps the map.
   Usage: node tools/env-test.cjs [seed ...] */
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
const C = MX.C;
const seeds = process.argv.slice(2).map(Number).filter(Boolean);
if (!seeds.length) seeds.push(11, 2024, 777, 31337);
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };
const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);
const relief = {};

for (const env of MX.Catalog.environments) {
  for (const seed of seeds) {
    const tag = env.id + '/' + seed;
    const g = MX.Game.create({ mode: 'career', seed, preset: env.id, parkName: 'Test' });
    const w = g.world, N = w.N, PB = MX.Terrain.plotBox(N);
    /* the road */
    let wet = 0, bumpy = 0;
    for (let tx = 0; tx < N; tx++) { if (w.isWater(tx, w.roadRow)) wet++; if (w.tileSlope(tx, w.roadRow) > 0.6) bumpy++; }
    if (wet || bumpy) check(tag + ' road dry and level', false, { wet, bumpy });
    /* relief of the starting land */
    let lo = Infinity, hi = -Infinity, water = 0, tiles = 0;
    for (let tz = PB.z0; tz < N - 1; tz++) for (let tx = PB.x0; tx < PB.x1; tx++) {
      const h = w.tileCenterH(tx, tz); tiles++;
      if (w.isWater(tx, tz)) water++; else { lo = Math.min(lo, h); hi = Math.max(hi, h); }
    }
    (relief[env.id] = relief[env.id] || []).push(hi - lo);
    if (water / tiles > 0.16) check(tag + ' starting land mostly dry', false, { water, tiles });
    /* the basic facilities along the road */
    const placed = {};
    const place = (type, z, rot, from, to) => { for (let x = from; x <= to; x++) { const r = g.placeBuilding(type, x, z, rot); if (r.ok) return (placed[type] = x); } return -1; };
    const px = place('parking', N - 4, 0, PB.x0 + 2, PB.x1 - 10);
    const pd = place('paddock', N - 4, 0, px + 4, PB.x1 - 4);
    place('entrance', N - 7, 2, px, px + 6);
    place('toilets', N - 8, 2, px + 3, pd + 3);
    if (Object.keys(placed).length < 4) check(tag + ' facilities fit by the road', false, placed);
    /* riders reach the land from the road */
    g.rebuildFields();
    const seen = new Uint8Array(N * N), q = [];
    for (let tx = 0; tx < N; tx++) { const i = tx + w.roadRow * N; if (g.riderPassable(tx, w.roadRow, i)) { seen[i] = 1; q.push(i); } }
    while (q.length) { const i = q.pop(), x = i % N, z = (i / N) | 0; for (const [a, b] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) { if (a < 0 || b < 0 || a >= N || b >= N) continue; const j = a + b * N; if (!seen[j] && g.riderPassable(a, b, j)) { seen[j] = 1; q.push(j); } } }
    let reach = 0, land = 0;
    for (let tz = PB.z0; tz < N - 1; tz++) for (let tx = PB.x0; tx < PB.x1; tx++) { const i = tx + tz * N; if (w.isWater(tx, tz) || w.bld[i] >= 0) continue; land++; if (seen[i]) reach++; }
    if (reach / land < 0.95) check(tag + ' riders reach the land', false, { reach, land });
    /* a circuit piece by piece in the upper half of the land, closed with «Cerrar» */
    const tr = g.newTrack('mx');
    let start = null;
    for (let z = PB.z0 + 14; z <= PB.z0 + 26 && !start; z += 3) for (let x = PB.x0 + 12; x <= PB.x1 - 18 && !start; x += 3) {
      if (tr.probeStart(w, x, z, 0, 8, 'dirt').ok) start = { x, z };
    }
    if (!start) { check(tag + ' room for a start', false); continue; }
    g.placeStart(tr, start.x, start.z, 0, 8, 'dirt');
    const seq = [P({ t: 'straight', n: 4 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'straight', n: 3 }), P({ t: 'curve', k: 2, dir: 1 })];
    const refused = [];
    for (const p of seq) { const b = g.buildPiece(tr, p); if (!b.ok) refused.push(b.reason); }
    const r = g.autoComplete(tr, 8, 'dirt');
    const errs = tr.closed ? tr.validate(w).filter(i => i.level === 'error' && /Pendiente|cruza|imposible/.test(i.msg)).map(i => i.msg) : [];
    const st = tr.closed ? tr.steepest(0, tr.S.n) : { slope: 0 };
    if (!r.ok || !tr.closed || errs.length) check(tag + ' circuit closes on this ground', false, { refused, reason: r.reason, errs, steepest: st.slope });
    else console.log('ok   ' + tag + ' circuit ' + Math.round(tr.length) + ' m, steepest ' + Math.round(st.slope * 100) + '%, refused ' + refused.length + ', relief ' + (hi - lo).toFixed(1) + ' m');
    /* save and load */
    const g2 = MX.Game.deserialize(JSON.parse(JSON.stringify(g.serialize())));
    if (g2.world.preset !== env.id || Math.abs(g2.world.tileCenterH(40, 50) - w.tileCenterH(40, 50)) > 0.02) check(tag + ' save keeps the map', false);
  }
}
/* the relief grows with the environment level */
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const order = MX.Catalog.environments.map(e => e.id), rel = order.map(id => +avg(relief[id]).toFixed(1));
check('relief grows from ' + order[0] + ' to ' + order[order.length - 1], rel.every((v, i) => i === 0 || v >= rel[i - 1] - 0.5), rel);
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
