/* Headless test of the piece-by-piece constructor: start, pieces, closure planner,
   suggested loop, validation, opening and a few days of riding. */
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
const log = (...a) => console.log(...a);
const g = MX.Game.create({ mode: 'career', seed: 4242, preset: 'valle', parkName: 'Piezas' });
const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);
/* 1. manual building */
const tr = g.newTrack();
let r = g.placeStart(tr, 30, 45, 0, 8, 'dirt');
log('placeStart', r.ok, r.reason || '', 'len', tr.length.toFixed(1), 'pieces', tr.pieces.length, 'end', JSON.stringify(tr.endPose));
const seq = [P({ t: 'straight', n: 3 }), P({ t: 'special', f: 'tabletop_m' }), P({ t: 'curve', k: 2, dir: 1, bank: 1 }), P({ t: 'curve', k: 2, dir: 1, bank: 1 }),
  P({ t: 'straight', n: 3, slope: 1 }), P({ t: 'straight', n: 3, slope: -1 }), P({ t: 'special', f: 'rollers' }), P({ t: 'curve', k: 3, dir: 1 }), P({ t: 'curve', k: 3, dir: 1 }), P({ t: 'special', f: 'finish' })];
for (const p of seq) {
  const pr = tr.probePiece(g.world, p);
  r = g.buildPiece(tr, p);
  log('build', p.t, p.k || p.n || p.f, 'probe', pr.ok, pr.reason, 'cost', pr.cost, '->', r.ok, r.reason || '', 'len', tr.length.toFixed(1), 'end', JSON.stringify(tr.endPose));
}
const money0 = g.econ.money;
r = g.removeLastPiece(tr);
log('removeLast', r.ok, 'refund', Math.round(g.econ.money - money0), 'pieces', tr.pieces.length);
r = g.buildPiece(tr, P({ t: 'special', f: 'finish' }));
log('rebuild finish', r.ok);
const t0 = Date.now();
r = g.autoComplete(tr, 8, 'dirt');
log('autoComplete', r.ok, r.reason || '', 'added', r.added, 'ms', Date.now() - t0, 'closed', tr.closed, 'len', tr.length.toFixed(1));
log('features', tr.features.map(f => f.type + '@' + f.s.toFixed(1) + (f.pin != null ? '#' + f.pin : '') + (f.auto ? '*' : '')).join(' '));
let iss = g.validateTrack(tr);
log('validate', JSON.stringify(iss.map(i => i.level + ':' + i.msg)));
/* 2. suggested loop in a second track */
const tr2 = g.newTrack();
const trA = tr; g.tracks = g.tracks.filter(t => t !== trA); trA.clearOccupancy(g.world);
r = g.suggestLoop(tr2, { x0: 24, z0: 40, w: 32, h: 38 }, 8, 'dirt');
log('suggest', r.ok, r.reason || '', 'len', tr2.length.toFixed(1), 'pieces', tr2.pieces.length, 'closed', tr2.closed);
log('validate2', JSON.stringify(tr2.validate(g.world).map(i => i.level + ':' + i.msg)));
/* 3. serialization round trip */
const d = JSON.parse(JSON.stringify(tr.serialize()));
const tr3 = MX.Track.deserialize(d, g.world);
log('roundtrip len', tr.length.toFixed(2), tr3.length.toFixed(2), 'features', tr.features.length, tr3.features.length, 'closed', tr3.closed);
/* 4. open and ride */
g.deleteTrack(tr2);
g.tracks.push(tr); tr.computeFootprint(g.world); tr.applyOccupancy(g.world);
log('b', JSON.stringify([g.placeBuilding('parking', 26, 76, 0), g.placeBuilding('paddock', 50, 76, 0)].map(r => r.ok || r.reason)));
for (let x = 26; x <= 48; x++) g.placePath(x, 73, 1);
for (let z = 74; z <= 78; z++) g.placePath(29, z, 1);
g.placeBuilding('entrance', 30, 74, 0); g.placeBuilding('toilets', 34, 72, 2);
g.rebuildFields();
const op = g.openTrack(tr);
log('open', op.ok, op.reason || '', tr.stats && ('diff ' + tr.stats.diff.toFixed(2) + ' rating ' + tr.stats.rating.toFixed(2) + ' lapPro ' + tr.stats.lapPro.toFixed(1)));
for (let i = 0; i < 30 * 30 * 10; i++) { if (g.fieldsDirty) g.rebuildFields(); g.step(1 / 30); }
log('after 10 days laps', tr.totals.laps, 'crashes', tr.totals.crashes, 'riders', g.riders.length, 'best', tr.records.best.toFixed(2));
const iss2 = tr.validate(g.world);
log('issues detail', JSON.stringify(iss2.map(i => [i.msg, i.x && Math.floor(i.x / 4), i.z && Math.floor(i.z / 4)])));
for (const b of g.buildings.values()) log('bld', b.type, b.tx, b.tz, b.w, b.h);
