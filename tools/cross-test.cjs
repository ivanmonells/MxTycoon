/* Headless test of raised sections and crossings: pieces climb up to 12 m over the
   ground, a circuit built piece by piece passes over its own start straight on a
   bridge, a crossing without enough height or with a jump underneath is refused, a
   second circuit runs under the raised one, riders lap it and saves keep it valid.
   Usage: node tools/cross-test.cjs */
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };
const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);
const errors = (tr, g, re) => tr.validate(g.world).filter(i => i.level === 'error' && (!re || re.test(i.msg))).map(i => i.msg);
/* out along a diagonal, round two bends climbing (slopes of the four climbing pieces),
   then back towards the start, ending just short of it */
const climb = (up) => [P({ t: 'straight', n: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
  P({ t: 'straight', n: 3, slope: up[0] }), P({ t: 'straight', n: 3, slope: up[1] }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
  P({ t: 'straight', n: 3, slope: up[2] }), P({ t: 'straight', n: 2, slope: up[3] }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
  P({ t: 'straight', n: 2 }), P({ t: 'straight', n: 2 }), P({ t: 'straight', n: 2 }), P({ t: 'straight', n: 2 })];
const HIGH = [2, 2, 2, 1], LOW = [1, 0, 1, 0];
/* the next piece runs over the first metres of the start straight */
const OVER = P({ t: 'straight', n: 3 });
const build = (g, seq) => {
  const tr = g.newTrack('mx');
  g.placeStart(tr, 36, 44, 7, 8, 'dirt', 0);
  for (const p of seq) { const b = g.buildPiece(tr, p); if (!b.ok) return { tr, refused: b.reason, at: tr.pieces.length }; }
  return { tr };
};

/* the elevation limit */
{
  const g = MX.Game.create({ mode: 'sandbox', seed: 2024, preset: 'campo', parkName: 'Alto' });
  const tr = g.newTrack('mx');
  g.placeStart(tr, 36, 44, 7, 8, 'dirt', 0);
  let top = 0, last = null;
  for (let k = 0; k < 12; k++) { const b = g.buildPiece(tr, P({ t: 'straight', n: 3, slope: 2 })); if (!b.ok) { last = b.reason; break; } top = tr.endPose.e; }
  check('pieces climb to 12 m and no further', MX.Track.ELEV_MAX === 12 && top > 10 && top <= 12 && /máximo 12 m/.test(last || ''), { top, last });
}

/* a circuit over its own start straight */
{
  const g = MX.Game.create({ mode: 'sandbox', seed: 2024, preset: 'campo', parkName: 'Ocho' });
  const { tr, refused } = build(g, climb(HIGH));
  check('the raised loop is built', !refused, refused);
  const pr = tr.probePiece(g.world, OVER);
  check('a piece over the start straight 11 m up is a bridge', pr.ok && pr.cross === 'over', pr.reason || pr.cross);
  const ac = g.autoComplete(tr, 8, 'dirt');
  const xs = MX.Track.crossingsFor(tr, g.tracks);
  check('it closes passing over itself', ac.ok && tr.closed && xs.length === 1 && xs[0].dy >= MX.Track.CLEAR - 0.25 && xs[0].ang > 1, { ok: ac.ok, crossings: xs.map(c => [+c.dy.toFixed(1), Math.round(c.ang * 57.3)]) });
  check('no crossing errors', !errors(tr, g, /cruza|pisa|solapa|puente/).length, errors(tr, g));
  /* finish line, facilities and riders */
  g.addFeature(tr, 'finish', tr.length * 0.3);
  const B = (t, x, z, r) => g.placeBuilding(t, x, z, r || 0);
  B('parking', 26, 76); B('paddock', 50, 76);
  for (let x = 22; x <= 66; x++) g.placePath(x, 73, 1);
  B('entrance', 30, 74); B('toilets', 34, 72, 2);
  g.rebuildFields();
  const op = g.openTrack(tr);
  check('it opens with the crossing in the rating', op.ok && tr.stats && tr.stats.crossings === 1, op.reason || (tr.stats && tr.stats.crossings));
  for (let i = 0; i < 30 * 30 * 10; i++) { if (g.fieldsDirty) g.rebuildFields(); g.step(1 / 30); }
  check('riders lap it', tr.totals.laps > 5, { laps: tr.totals.laps, crashes: tr.totals.crashes, riders: g.riders.length, entry: tr.entry && [tr.entry.tx, tr.entry.tz] });
  const g2 = MX.Game.deserialize(JSON.parse(JSON.stringify(g.serialize())));
  const t2 = g2.tracks[0];
  check('a save keeps it valid', t2.closed && !errors(t2, g2, /cruza|pisa|solapa|puente/).length && MX.Track.crossingsFor(t2, g2.tracks).length === 1);

  /* a second circuit at ground level running under the raised bends twice */
  const g3 = MX.Game.create({ mode: 'sandbox', seed: 2024, preset: 'campo', parkName: 'Dos' });
  const a = build(g3, climb(HIGH)).tr;
  g3.autoComplete(a, 8, 'dirt');
  const b = g3.newTrack('mx');
  g3.editTrack(b, (t) => {
    const cx = 245, cz = 190, L = 32, R = 10;
    for (let k = 0; k <= 6; k++) t.addNode(cx - L + 2 * L * k / 6, cz - R, 8, 'dirt');
    for (let k = 1; k < 6; k++) { const u = -Math.PI / 2 + Math.PI * k / 6; t.addNode(cx + L + R * Math.cos(u), cz + R * Math.sin(u), 8, 'dirt'); }
    for (let k = 0; k <= 6; k++) t.addNode(cx + L - 2 * L * k / 6, cz + R, 8, 'dirt');
    for (let k = 1; k < 6; k++) { const u = Math.PI / 2 + Math.PI * k / 6; t.addNode(cx - L + R * Math.cos(u), cz + R * Math.sin(u), 8, 'dirt'); }
    t.closed = true;
  });
  const xb = MX.Track.crossingsFor(b, g3.tracks);
  check('another circuit passes under it twice', xb.length === 2 && xb.every(c => c.U === a && c.L === b), xb.map(c => [c.U.id, c.L.id, +c.dy.toFixed(1)]));
  check('neither reports an overlap', !errors(b, g3, /solapa|cruza|puente/).length && !errors(a, g3, /solapa|cruza|puente/).length, errors(b, g3).concat(errors(a, g3)));
  /* no jump under those bridges, one elsewhere is fine */
  const under = b.tunnels && b.tunnels[0], mid = under ? (under[0] + under[1]) / 2 : 0;
  const cj = b.checkFeature('tabletop_s', mid);
  let free = null;
  for (let s = 0; s < b.length && !free; s += 4) if (b.checkFeature('tabletop_s', s).ok) free = s;
  check('no jump under a bridge', !!under && !cj.ok && /puente/.test(cj.reason) && free != null, { under, reason: cj.reason, free });
}

/* not high enough: the piece that would cross is refused */
{
  const g = MX.Game.create({ mode: 'sandbox', seed: 2024, preset: 'campo', parkName: 'Bajo' });
  const { tr, refused } = build(g, climb(LOW));
  const pr = tr.probePiece(g.world, OVER);
  check('a crossing 3 m up is refused', !refused && !pr.ok && /4,5 m de diferencia/.test(pr.reason), { refused, e: tr.endPose && tr.endPose.e, reason: pr.reason });
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
