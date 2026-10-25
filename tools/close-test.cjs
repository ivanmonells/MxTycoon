/* Headless test of closing piece circuits: a manual piece that reaches the start a
   little too high, the automatic close from the same spot, from high above the start,
   and from an end boxed in against the edge of the land (the last pieces are rebuilt).
   Usage: node tools/close-test.cjs */
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
const log = (...a) => console.log(...a);
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };
const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);
const R2 = [P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 })];

/* a rectangle that ends 3 units behind the start, facing it, with a short climb on
   the way (start at 30,45 facing +x; the end lands at 27,45 facing +x) */
function loop(climb) {
  const g = MX.Game.create({ mode: 'sandbox', seed: 4242, preset: 'valle', parkName: 'Cierres' });
  const tr = g.newTrack('mx');
  const r = g.placeStart(tr, 30, 45, 0, 8, 'dirt');
  if (!r.ok) throw new Error('start ' + r.reason);
  g.setChuteSide(tr, 0);   // these loops close through where the wide start straight would go
  const seq = [...R2, P({ t: 'straight', n: 3 }), ...R2, P({ t: 'straight', n: 6 }), P({ t: 'straight', n: 6 }), ...R2].concat(climb, [...R2]);
  for (const p of seq) { const b = g.buildPiece(tr, p); if (!b.ok) throw new Error('piece ' + JSON.stringify(p) + ' ' + b.reason); }
  return { g, tr };
}

/* 1. the case from the phone: a level 12 m straight reaches the start 0.5 m too high */
{
  const { g, tr } = loop([P({ t: 'straight', n: 1, slope: 1 }), P({ t: 'straight', n: 2 })]);
  check('end lands 3 units behind the start at +0.5 m', tr.endPose.x === 27 && tr.endPose.z === 45 && tr.endPose.h === 0 && Math.abs(tr.endPose.e - 0.5) < 1e-6, tr.endPose);
  const pr = tr.probePiece(g.world, P({ t: 'straight', n: 3 }));
  check('the level straight is accepted and re-sloped', pr.ok && pr.closes && !!pr.fix, { ok: pr.ok, reason: pr.reason, fix: pr.fix && pr.fix.map(p => p.t + p.n + '/' + p.slope) });
  const b = g.buildPiece(tr, P({ t: 'straight', n: 3 }));
  check('building it closes the loop at the start height', b.ok && b.closes && b.adjusted && tr.closed, { ok: b.ok, reason: b.reason });
  const iss = tr.validate(g.world).filter(i => i.level === 'error' && /Pendiente|cruza|imposible/.test(i.msg));
  check('closed loop has no slope or crossing errors', !iss.length, iss.map(i => i.msg));
}
/* 2. the same spot closed with «Cerrar» */
{
  const { g, tr } = loop([P({ t: 'straight', n: 1, slope: 1 }), P({ t: 'straight', n: 2 })]);
  const t0 = Date.now();
  const r = g.autoComplete(tr, 8, 'dirt');
  check('«Cerrar» from 12 m away at +0.5 m', r.ok && tr.closed && r.replaced === 0, { ok: r.ok, reason: r.reason, added: r.added, ms: Date.now() - t0, pieces: tr.pieces.slice(-r.added || -1).map(p => p.t + (p.n || p.k) + '/' + p.slope) });
}
/* 3. four metres up, right behind the start: it has to take the long way down */
{
  const { g, tr } = loop([P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 3, slope: 2 })]);
  const t0 = Date.now();
  const r = g.autoComplete(tr, 8, 'dirt');
  const iss = r.ok ? tr.validate(g.world).filter(i => i.level === 'error' && /Pendiente|cruza|imposible/.test(i.msg)).map(i => i.msg) : [];
  check('«Cerrar» from ' + tr.pieces.length + ' pieces at +' + (r.ok ? '' : '') + 'height above the start', r.ok && tr.closed && !iss.length, { ok: r.ok, reason: r.reason, added: r.added, replaced: r.replaced, ms: Date.now() - t0, iss });
}
/* 4. an end driven straight at the edge of the land, with no room left to turn: the
   last plain pieces are rebuilt (career land: tiles 16..63 x 32..78) */
{
  const g = MX.Game.create({ mode: 'career', seed: 4242, preset: 'valle', parkName: 'Borde' });
  const tr = g.newTrack('mx');
  let r = g.placeStart(tr, 40, 66, 6, 8, 'dirt');
  check('start placed facing the north edge', r.ok, r.reason);
  g.setChuteSide(tr, 0);
  for (let i = 0; i < 40; i++) { const b = g.buildPiece(tr, P({ t: 'straight', n: 1 })); if (!b.ok) break; }
  const e = tr.endPose;
  const direct = MX.Track.planClosure(g.world, tr, 8, 'dirt');
  check('from the very end there is no way back', !direct.ok, { end: e, reason: direct.reason });
  const t0 = Date.now();
  r = g.autoComplete(tr, 8, 'dirt');
  const iss = r.ok ? tr.validate(g.world).filter(i => i.level === 'error' && /Pendiente|cruza|imposible|terreno/.test(i.msg)).map(i => i.msg) : [];
  check('«Cerrar» rebuilds the last pieces and closes', r.ok && tr.closed && r.replaced > 0 && !iss.length, { ok: r.ok, reason: r.reason, added: r.added, replaced: r.replaced, ms: Date.now() - t0, iss });
}
/* 5. the closing pieces never undo a jump the player placed */
{
  const g = MX.Game.create({ mode: 'career', seed: 4242, preset: 'valle', parkName: 'Salto' });
  const tr = g.newTrack('mx');
  g.placeStart(tr, 40, 66, 6, 8, 'dirt');
  g.setChuteSide(tr, 0);
  for (let i = 0; i < 40; i++) { const b = g.buildPiece(tr, P({ t: 'straight', n: 1 })); if (!b.ok) break; }
  for (let i = 0; i < 9; i++) g.removeLastPiece(tr);
  const sp = g.buildPiece(tr, P({ t: 'special', f: 'tabletop_s' }));
  check('a jump fits near the end', sp.ok, sp.reason);
  const r = g.autoComplete(tr, 8, 'dirt');
  check('«Cerrar» keeps the jump at the end', r.ok && tr.closed && tr.pieces.some(p => p.t === 'special') && tr.features.some(f => f.type === 'tabletop_s'), { close: r.ok, reason: r.reason, replaced: r.replaced, added: r.added });
}
log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
