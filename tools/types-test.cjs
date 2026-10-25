/* Headless test of the circuit disciplines: a suggested loop of each type in a
   sandbox park, analyzer figures, riders of each discipline riding it, the new
   facilities, an event per discipline (the enduro one as a time trial) and a save
   round trip. Usage: node tools/types-test.cjs [days] */
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
const Cat = MX.Catalog;
const log = (...a) => console.log(...a);
const days = +(process.argv[2] || 6);
const g = MX.Game.create({ mode: 'sandbox', seed: 777, preset: 'valle', parkName: 'Tipos' });
const N = g.world.N;

/* largest free rectangle helper (tiles), like the «Trazado sugerido» button */
function freeRect(minW, minH, avoid) {
  const w = g.world, free = new Uint8Array(N * N);
  for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
    const i = tx + tz * N;
    free[i] = (w.owned[i] && w.bld[i] < 0 && !w.path[i] && !w.trackOcc[i] && !w.isWater(tx, tz) && w.tileSlope(tx, tz) < 2.5 && !(avoid && avoid(tx, tz))) ? 1 : 0;
  }
  let best = null;
  for (let z0 = 0; z0 < N; z0 += 2) for (let x0 = 0; x0 < N; x0 += 2) {
    for (let h = minH; h <= minH + 10 && z0 + h <= N; h += 2) for (let ww = minW; ww <= minW + 10 && x0 + ww <= N; ww += 2) {
      let ok = true;
      for (let z = z0; z < z0 + h && ok; z++) for (let x = x0; x < x0 + ww; x++) if (!free[x + z * N]) { ok = false; break; }
      if (ok && (!best || ww * h > best.w * best.h)) best = { x0, z0, w: ww, h };
    }
  }
  return best;
}

const sizes = { kids: [12, 9], mx: [24, 16], sx: [18, 12], flat: [24, 12], enduro: [26, 20], carcross: [30, 22] };
const made = [];
/* keep every loop out of the others' infields so riders can reach all of them */
const boxes = [];
const inBox = (tx, tz) => boxes.some(b => tx >= b[0] - 2 && tx <= b[2] + 2 && tz >= b[1] - 2 && tz <= b[3] + 2);
const order = process.env.SET === '2' ? ['flat', 'sx'] : ['carcross', 'enduro', 'mx', 'kids'];
for (const type of order) {
  const td = Cat.trackTypes[type];
  const tr = g.newTrack(type);
  const rect = freeRect(sizes[type][0], sizes[type][1], (tx, tz) => tz > 70 || inBox(tx, tz));
  if (rect) boxes.push([rect.x0, rect.z0, rect.x0 + rect.w, rect.z0 + rect.h]);
  if (!rect) { log(type, 'no room'); g.deleteTrack(tr); continue; }
  const r = g.suggestLoop(tr, rect, td.width, td.surface);
  if (!r.ok) { log(type, 'suggest failed', r.reason, JSON.stringify(rect)); g.deleteTrack(tr); continue; }
  const iss = g.validateTrack(tr).filter(i => i.level === 'error' && !/paddock|baños|pilotos no pueden/i.test(i.msg));
  log(type.padEnd(8), 'len', tr.length.toFixed(0).padStart(5), 'pieces', String(tr.pieces.length).padStart(2), 'features', tr.features.map(f => f.type).join(','), iss.length ? 'ERR ' + iss.map(i => i.msg).join(' | ') : '');
  made.push(tr);
}
/* facilities by the road */
const place = (type, tx, tz, rot) => { const r = g.placeBuilding(type, tx, tz, rot || 0); if (!r.ok) log('place', type, r.reason); return r; };
place('parking', 26, 76); place('paddock', 50, 76); place('paddock', 54, 76);
for (let x = 22; x <= 66; x++) g.placePath(x, 73, 1);
for (let z = 74; z <= 78; z++) g.placePath(29, z, 1);
place('entrance', 30, 74); place('toilets', 34, 72, 2); place('restaurant_big', 36, 70, 2); place('megastore', 40, 71, 2);
place('playground', 43, 71, 2); place('parts', 46, 74); place('wash', 47, 75); place('rental', 58, 75);
place('medical', 62, 74); place('showers', 45, 74);
g.rebuildFields();
for (const tr of made) {
  const op = g.openTrack(tr);
  const st = tr.stats;
  if (!op.ok) log('   entry', JSON.stringify(tr.entry && { tx: tr.entry.tx, tz: tr.entry.tz }), 'origin', JSON.stringify(tr.origin), 'paddock reach', g.fieldReach('r_paddock', tr.entry ? tr.entry.tx : 0, tr.entry ? tr.entry.tz : 0));
  log(tr.type.padEnd(8), 'open', op.ok, op.reason || '', st ? 'diff ' + st.diff.toFixed(1) + ' rating ' + st.rating.toFixed(1) + ' safety ' + Math.round(st.safety * 100) + '% lapPro ' + st.lapPro.toFixed(1) + ' cap ' + st.capacity + ' homolog ' + st.homolog : '');
}
log('rates', JSON.stringify(Object.fromEntries(Object.entries(g.riderRates()).map(([k, v]) => [k, +v.toFixed(4)]))));
const t0 = Date.now();
for (let i = 0; i < 30 * 30 * days; i++) { if (g.fieldsDirty) g.rebuildFields(); g.step(1 / 30); }
log('simulated', days, 'days in', Date.now() - t0, 'ms');
for (const tr of made) log(tr.type.padEnd(8), 'laps', String(tr.totals.laps).padStart(4), 'riders', String(tr.totals.riders).padStart(3), 'crashes', tr.totals.crashes, 'best', tr.records.best ? tr.records.best.toFixed(1) : '-');
const byDisc = {};
for (const r of g.riders) byDisc[r.disc + (r.rental ? '(alquiler)' : '')] = (byDisc[r.disc + (r.rental ? '(alquiler)' : '')] || 0) + 1;
log('riders now', JSON.stringify(byDisc), 'bikes', JSON.stringify([...new Set(g.riders.map(r => r.bike.id))]));
const inc = g.econ.month.income;
log('income', JSON.stringify(Object.fromEntries(Object.entries(inc).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v)]))));
if (process.env.DEBUG_RIDERS) {
  for (const r of g.riders.filter(r => r.disc !== 'mx')) {
    const tr = g.trackById(r.trackId), f = tr && g.fields.get('r_entry_' + tr.id);
    log('before events', r.disc, r.state, 'tile', r.tx, r.tz, 'field', f ? f.get(r.tx, r.tz) : '-', 'entry', tr && tr.entry ? tr.entry.tx + ',' + tr.entry.tz : '-', 'stuck', (r.stuckT || 0).toFixed(1), r.m ? 'laps ' + r.m.laps : '');
  }
}
/* one event per discipline */
const evFor = { kids: 'kids_cup', flat: 'flat_race', enduro: 'enduro_crono', carcross: 'carcross_race', sx: 'sx_night', mx: 'amateur' };
for (const tr of made) {
  const type = evFor[tr.type];
  const reqs = g.comp.requirements(type, tr).filter(r => !r.ok).map(r => r.label);
  g.race = new MX.Race(g, { id: 99, type, trackId: tr.id, day: g.day, ticket: Cat.events[type].ticket }, tr);
  g.race.begin();
  let t = 0;
  while (g.race && t < 1400) { if (g.fieldsDirty) g.rebuildFields(); g.step(1 / 30); t += 1 / 30; }
  const res = g.comp.history[g.comp.history.length - 1];
  log(type.padEnd(14), 'missing', JSON.stringify(reqs), res ? 'quality ' + res.quality + ' laps ' + res.laps + ' winner ' + (res.standings[0] && res.standings[0].name) + ' ' + (res.standings[0] && res.standings[0].time.toFixed(1)) + 's, 2nd ' + (res.standings[1] && res.standings[1].time.toFixed(1)) + 's, finished ' + res.standings.filter(s => s.done).length + '/' + res.standings.length : 'no result', 'secs', t.toFixed(0));
}
/* save round trip keeps the types */
const d = JSON.parse(JSON.stringify(g.serialize()));
const g2 = MX.Game.deserialize(d);
log('roundtrip types', g2.tracks.map(t => t.type).join(','), 'stats', g2.tracks.map(t => t.stats ? t.stats.rating.toFixed(1) : '-').join(','));
if (process.env.DEBUG_RIDERS) {
  for (const r of g.riders.filter(r => r.disc !== 'mx')) log('rider', r.disc, r.state, 'track', r.trackId, 'm', !!r.m, r.m ? 's ' + r.m.s.toFixed(1) + ' v ' + r.m.v.toFixed(1) + ' laps ' + r.m.laps + ' crash ' + !!r.m.crash : '', 'sessions', r.sessions, 'happy', Math.round(r.happy), 'th', r.thoughts.map(t => t.key).join(','));
}
