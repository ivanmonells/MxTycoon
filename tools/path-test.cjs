/* Headless test of paths built like circuits: ramps and raised decks that join only at
   the same height, people walking up them, footbridges over the lake, paths under a
   raised circuit and over a low one (never over a jump), the lake reported before the
   land, refunds (all of it while building, half afterwards) and saves.
   Usage: node tools/path-test.cjs */
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };
const W = MX.World, T = MX.C.TILE, RISE = W.RISE;
const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);

/* a level patch of ground at height h over tiles [x0..x1] x [z0..z1], cleared */
function flatten(w, x0, z0, x1, z1, h) {
  for (let vz = z0; vz <= z1 + 1; vz++) for (let vx = x0; vx <= x1 + 1; vx++) w.setVh(vx, vz, h);
  for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) w.removeSceneryAt(tx, tz);
  w.markTerrainDirty(x0, z0, x1, z1);
}

/* ramps, decks and links */
{
  const g = MX.Game.create({ mode: 'sandbox', seed: 2024, preset: 'campo', parkName: 'Rampas' });
  const w = g.world;
  flatten(w, 8, 18, 30, 26, 8);
  const ok = (r) => r && r.ok;
  check('a ground path', ok(g.placePath(10, 20, 1)));
  const y0 = w.groundEdgeH(10, 20, 1);
  check('a ramp up to the east from it', ok(g.placePath(11, 20, 1, y0, 2)), y0);
  check('a level deck at the top', ok(g.placePath(12, 20, 1, y0 + RISE, 0)));
  check('ground, ramp and deck join', w.pathLink(10, 20, 1) && w.pathLink(11, 20, 1) && w.pathLink(12, 20, 3));
  const mid = w.walkHeight(11.5 * T, 20.5 * T);
  check('people walk half way up the ramp in its middle', Math.abs(mid - (y0 + RISE / 2 + W.PATH_LIFT)) < 0.01, mid);
  check('and on the deck', Math.abs(w.walkHeight(12.5 * T, 20.5 * T) - (y0 + RISE + W.PATH_LIFT)) < 0.01);
  /* a ground path beside the deck and the ramp: no way across */
  g.placePath(12, 21, 1); g.placePath(11, 21, 1);
  check('a deck does not join the ground path beside it', !w.pathLink(12, 20, 2) && !w.pathLink(12, 21, 0));
  check('a ramp only joins at its ends', !w.pathLink(11, 20, 2));
  check('the ground beside it still draws a curb (mask)', (w.pathMask(12, 21) & 1) === 0);
  /* turning off a raised deck keeps its height: a deck to the north joins */
  check('a deck turning north at the same height', ok(g.placePath(12, 19, 1, y0 + RISE, 0)) && w.pathLink(12, 20, 0));
  /* down again: a ramp descending to the east ends on the ground */
  check('a ramp back down', ok(g.placePath(13, 20, 1, y0, 4)) && w.pathLink(12, 20, 1));
  check('and the ground path after it joins', ok(g.placePath(14, 20, 1)) && w.pathLink(13, 20, 1));
  /* walking fields go up and over, never across from the ground beside */
  const N = w.N, walk = (x, z, i) => w.isWalkable(x, z), link = (x, z, k) => w.pathLink(x, z, k);
  const f = MX.Pathing.bfs(N, [w.idx(10, 20)], walk, 0, link);
  check('a walk from the ground reaches the deck over the ramp', f.get(12, 20) === 2 && f.get(14, 20) === 4, [f.get(12, 20), f.get(14, 20)]);
  check('and not the ground path beside the deck through it', f.get(12, 21) === -1 || f.get(12, 21) > 3, f.get(12, 21));
  /* limits */
  check('a deck can not sink into the ground', /bajo tierra/.test(w.canPlacePath(16, 20, 1, y0 - 1, 0) || ''), w.canPlacePath(16, 20, 1, y0 - 1, 0));
  check('nor stand more than 12 m up', /máximo 12 m/.test(w.canPlacePath(16, 20, 1, y0 + 13, 0) || ''));
  check('roads stay on the ground', /ras de suelo/.test(w.canPlacePath(16, 22, 3, y0 + 2, 0) || ''));
  check('the ground under a raised path can not be dug', !w.vertexEditable(12, 20) && w.vertexEditable(20, 24));

  /* refunds: everything back while building, half once out of the path tools */
  const m0 = g.econ.money;
  const r1 = g.placePath(16, 24, 2, y0, 2);
  const m1 = g.econ.money;
  g.removePath(16, 24);
  check('taking back a tile laid this session refunds all of it', r1.ok && Math.abs(g.econ.money - m0) < 1, { paid: r1.cost, back: g.econ.money - m1 });
  g.placePath(16, 24, 2, y0, 2);
  g.endPathSession();
  const m2 = g.econ.money, val = g.pathValue(16, 24, 2, y0, 2);
  g.removePath(16, 24);
  check('after leaving the path tools it refunds half', Math.abs(g.econ.money - m2 - Math.round(val * MX.C.REFUND_RATE)) < 1, { value: val, back: g.econ.money - m2 });
  check('a raised tile costs more than one on the ground', g.pathCost(16, 24, 1, y0 + 3, 0) > g.pathCost(16, 24, 1) + 40);

  /* saves keep heights and slopes */
  const g2 = MX.Game.deserialize(JSON.parse(JSON.stringify(g.serialize())));
  const w2 = g2.world;
  check('a save keeps raised paths', w2.isRaisedPath(11, 20) && w2.pathS[w2.idx(11, 20)] === 2 && Math.abs(w2.pathY[w2.idx(12, 20)] - (y0 + RISE)) < 0.011 && !w2.isRaisedPath(10, 20) && w2.pathLink(11, 20, 1));
}

/* the lake: footbridges over it, and the right message */
{
  const g = MX.Game.create({ mode: 'career', seed: 7, preset: 'valle', parkName: 'Lago' });
  const w = g.world, N = w.N;
  let own = null, foreign = null;
  for (let i = 0; i < N * N && (!own || !foreign); i++) {
    const tx = i % N, tz = (i / N) | 0;
    if (!w.isWater(tx, tz) || tz === w.roadRow) continue;
    if (w.owned[i] && !own) own = [tx, tz]; else if (!w.owned[i] && !foreign) foreign = [tx, tz];
  }
  if (foreign) {
    check('a lake outside your land says so, lake first', /lago está fuera de tu terreno/.test(w.canPlacePath(foreign[0], foreign[1], 1) || ''), w.canPlacePath(foreign[0], foreign[1], 1));
    check('buildings on the lake: "no se puede construir sobre el agua"', /agua/.test(w.canBuildOn(foreign[0], foreign[1]) || ''), w.canBuildOn(foreign[0], foreign[1]));
  } else check('the career map has a lake outside the land', false);
  /* make some lake of our own: sandbox owns everything */
  const s = MX.Game.create({ mode: 'sandbox', seed: 7, preset: 'valle', parkName: 'Lago2' });
  const ws = s.world;
  let lake = null;
  for (let i = 0; i < N * N && !lake; i++) { const tx = i % N, tz = (i / N) | 0; if (ws.isWater(tx, tz) && ws.tileMinMax(tx, tz)[1] < MX.C.WATER_LEVEL - 0.3 && tz < ws.roadRow - 1) lake = [tx, tz]; }
  if (lake) {
    const [lx, lz] = lake;
    check('a ground path into the lake is refused, pointing to a footbridge', /pasarela/.test(ws.canPlacePath(lx, lz, 1) || ''), ws.canPlacePath(lx, lz, 1));
    check('a deck just over the water is too low', /cerca del agua/.test(ws.canPlacePath(lx, lz, 1, MX.C.WATER_LEVEL + 0.1, 0) || ''));
    const yb = MX.C.WATER_LEVEL + 1.2;
    check('a footbridge over the lake', !ws.canPlacePath(lx, lz, 1, yb, 0), ws.canPlacePath(lx, lz, 1, yb, 0));
    check('a circuit over the lake: the lake first', /agua/.test(ws.canBuildOn(lx, lz) || ''));
  } else check('the sandbox map has deep water', false);
}

/* paths and circuits */
{
  const g = MX.Game.create({ mode: 'sandbox', seed: 2024, preset: 'campo', parkName: 'Cruces' });
  const w = g.world;
  /* the raised loop of cross-test: out on a diagonal, climbing round two bends */
  const tr = g.newTrack('mx');
  g.placeStart(tr, 36, 44, 7, 8, 'dirt', 0);
  const seq = [P({ t: 'straight', n: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
    P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
    P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 2, slope: 1 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 })];
  let refused = null;
  for (const p of seq) { const b = g.buildPiece(tr, p); if (!b.ok) { refused = b.reason; break; } }
  const ac = g.autoComplete(tr, 8, 'dirt');
  check('the raised circuit is built and closed', !refused && ac.ok && tr.closed, refused || ac.reason);
  /* tiles of its ground: where the deck runs 3.2 m or more over the ground, and where low */
  const S = tr.S, N = w.N;
  let under = null, low = null;
  for (const t of tr.tiles) {
    const tx = t % N, tz = (t / N) | 0;
    if (w.path[t] || w.bld[t] >= 0 || w.isWater(tx, tz) || w.tileSlope(tx, tz) > 2) continue;
    const pts = W.pathProbePts(tx, tz).map(([x, z]) => { const h = tr.nearestS(x, z); return { h, g: w.heightAt(x, z) }; });
    const onDeck = pts.filter(p => Math.abs(p.h.lane) <= S.w[p.h.i] * 0.5 + 0.6);
    if (onDeck.length < 3) continue;
    const clear = Math.min(...onDeck.map(p => S.y[p.h.i] - p.g));
    if (!under && clear > W.PATH_UNDER + 0.5) under = [tx, tz, +clear.toFixed(1)];
    if (!low && clear < 1) low = [tx, tz, +clear.toFixed(1)];
  }
  check('found ground under the raised part and under a low part', !!under && !!low, { under, low });
  if (low) check('a path under a low stretch is refused with the height it needs', /3,2 m por encima del camino/.test(w.canPlacePath(low[0], low[1], 1) || ''), w.canPlacePath(low[0], low[1], 1));
  if (under) {
    const r = g.placePath(under[0], under[1], 1);
    check('a path under the raised stretch', r.ok, r.reason);
    check('the circuit stays valid over it', !tr.validate(w).some(i => i.level === 'error' && /camino|pisa/.test(i.msg)), tr.validate(w).filter(i => i.level === 'error').map(i => i.msg));
    check('a path under it bumps the crossing version (bridge walls redrawn)', w.crossVer > 1);
  }
  /* a footbridge over a low stretch, and a jump under it */
  if (low) {
    const [tx, tz] = low, cx = (tx + 0.5) * T, cz = (tz + 0.5) * T, h = tr.nearestS(cx, cz);
    let top = -Infinity;
    for (const [x, z] of W.pathProbePts(tx, tz)) { const q = tr.nearestS(x, z); top = Math.max(top, S.y[q.i]); }
    const yb = Math.ceil((top + W.PATH_OVER + 0.2) * 10) / 10;
    check('a footbridge too low over it is refused', /pasarela tiene que ir/.test(w.canPlacePath(tx, tz, 1, top + 2, 0) || ''), w.canPlacePath(tx, tz, 1, top + 2, 0));
    const r = g.placePath(tx, tz, 1, yb, 0);
    check('a footbridge 4.5 m over the track', r.ok, r.reason);
    tr.validate(w);
    const L = tr.S.L, inRange = (s) => tr.tunnels.some(([a, b]) => [s, s + L].some(q => a <= q && q <= b));
    check('the circuit validates and keeps the footbridge clear of jumps', tr.tunnels && inRange(h.s) && tr.tunnels.every(([a, b]) => b - a < 40) && !tr.validate(w).some(i => i.level === 'error' && /camino/.test(i.msg)), tr.tunnels);
    const jf = tr.checkFeature('tabletop_s', h.s + 2, null);
    check('no jump under the footbridge', !jf.ok && /puente/.test(jf.reason), jf.reason);
  }
  /* refunds of circuits: in full until it has opened, half after */
  const worth = tr.geometryCost() + tr.featureCost();
  tr.opened = true;
  const m = g.econ.money, d = g.deleteTrack(tr);
  check('a circuit that has been open refunds half when deleted', d.ok && Math.abs(g.econ.money - m - Math.round(worth * MX.C.REFUND_RATE)) < 1, { worth, back: g.econ.money - m });
}

/* a circuit built over paths that are already there: fine with headroom, refused low */
{
  const g = MX.Game.create({ mode: 'sandbox', seed: 2024, preset: 'campo', parkName: 'Encima' });
  const w = g.world;
  const seq = [P({ t: 'straight', n: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
    P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
    P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 2, slope: 1 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 })];
  /* the tile found under the raised stretch in the test above, and one beside the start */
  const pu = g.placePath(56, 38, 1), pl = g.placePath(37, 44, 1);
  const tr = g.newTrack('mx');
  const st = g.placeStart(tr, 36, 44, 7, 8, 'dirt', 0);
  check('a start straight over a path at ground level is refused', !st.ok && /pasa demasiado bajo|camino/.test(st.reason || ''), st.reason);
  g.removePath(37, 44);
  const st2 = g.placeStart(tr, 36, 44, 7, 8, 'dirt', 0);
  let refused = null;
  for (const p of seq) { const b = g.buildPiece(tr, p); if (!b.ok) { refused = b.reason; break; } }
  check('the raised stretch is built over the path already there', pu.ok && st2.ok && !refused, refused || st2.reason);
  check('and the path keeps going under it', w.path[w.idx(56, 38)] === 1 && !!(w.trackOcc[w.idx(56, 38)] & tr.bit));
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
