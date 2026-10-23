/* Headless end-to-end simulation: builds a starter park by script and runs months. */
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
const months = +(process.argv[2] || 3);
const g = MX.Game.create({ mode: 'career', seed: 4242, preset: 'valle', parkName: 'Test Park' });
const T = MX.C.TILE;
const log = (...a) => console.log(...a);
function must(r, what) { if (!r || r.ok === false) { log('FAIL', what, r && r.reason); } return r; }
// clear trees in the plot first (cheap) and flatten a bit
// track oval
const tr = g.newTrack();
const cx = 160, cz = 214;
for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; tr.addNode(cx + Math.cos(a) * 50, cz + Math.sin(a) * 38, 8, 'dirt'); }
must(g.editTrack(tr, (t) => { t.closed = true; }), 'close track');
function placeF(type) { for (let s = 0; s < tr.length; s += 2) { const c = tr.checkFeature(type, s); if (c.ok) { return must(g.addFeature(tr, type, s), 'feature ' + type); } } log('no spot for', type); }
['start', 'finish', 'tabletop_m', 'rollers', 'tabletop_s', 'whoops', 'berm', 'berm'].forEach(placeF);
// buildings
must(g.placeBuilding('parking', 26, 76, 0), 'parking');
must(g.placeBuilding('paddock', 50, 76, 0), 'paddock');
for (let x = 26; x <= 48; x++) must(g.placePath(x, 73, 1), 'path ' + x);
for (let z = 74; z <= 78; z++) must(g.placePath(29, z, 1), 'path col ' + z);
for (let z = 67; z <= 72; z++) must(g.placePath(40, z, 1), 'path spur ' + z);
for (let x = 34; x <= 46; x++) must(g.placePath(x, 66, 1), 'path view ' + x);
must(g.placeBuilding('entrance', 30, 74, 0), 'entrance');
must(g.placeBuilding('toilets', 34, 72, 2), 'toilets');
must(g.placeBuilding('foodtruck', 36, 72, 2), 'foodtruck');
must(g.placeBuilding('grandstand', 41, 65, 2), 'grandstand');
must(g.placeBuilding('workshop', 44, 74, 0), 'workshop');
must(g.placeBuilding('showers', 47, 74, 0), 'showers');
g.rebuildFields();
const issues = g.validateTrack(tr);
log('track len', tr.length.toFixed(0), 'issues', JSON.stringify(issues.map(i => i.level + ':' + i.msg)));
const op = g.openTrack(tr);
log('open', op.ok, op.reason || '', 'stats diff', tr.stats && tr.stats.diff.toFixed(2), 'rating', tr.stats && tr.stats.rating.toFixed(2), 'safety', tr.stats && tr.stats.safety.toFixed(2));
must(g.hire('cleaner', g.candidates('cleaner')[0]), 'hire cleaner');
must(g.hire('mechanic', g.candidates('mechanic')[0]), 'hire mech');
log('money after build', Math.round(g.econ.money));
const t0 = Date.now();
let lastDay = -1;
const totalSteps = Math.round(months * MX.C.MONTH_DAYS * MX.C.DAY_SEC * 30);
let maxV = 0, maxR = 0;
for (let i = 0; i < totalSteps; i++) {
  if (g.fieldsDirty) g.rebuildFields();
  g.step(1 / 30);
  maxV = Math.max(maxV, g.visitors.length); maxR = Math.max(maxR, g.riders.length);
  if (g.day !== lastDay && g.day % 7 === 0) {
    lastDay = g.day;
    const onTrack = g.riders.filter(r => r.state === 'ride').length;
    const st = {};
    for (const v of g.visitors) st[v.state] = (st[v.state] || 0) + 1;
    const rs = {};
    for (const r of g.riders) rs[r.state] = (rs[r.state] || 0) + 1;
    log(`day ${g.day} ${g.dateText()} money ${Math.round(g.econ.money)} rep ${g.rep.toFixed(0)} vis ${g.visitors.length} ${JSON.stringify(st)} riders ${g.riders.length} ${JSON.stringify(rs)} cars ${g.cars.length} laps ${tr.totals.laps} crashes ${tr.totals.crashes} wear ${tr.avgWear().toFixed(2)} weather ${g.weather}`);
  }
  if (g.gameOver) { log('GAME OVER', g.gameOver); break; }
}
log('elapsed ms', Date.now() - t0, 'maxV', maxV, 'maxR', maxR);
for (const m of g.econ.history) {
  const inc = Object.entries(m.income).filter(e => e[1]).map(e => e[0] + ':' + Math.round(e[1])).join(' ');
  const exp = Object.entries(m.expense).filter(e => e[1]).map(e => e[0] + ':' + Math.round(e[1])).join(' ');
  log('MONTH', m.index, 'profit', Math.round(g.econ.profit(m)), '| IN', inc, '| OUT', exp);
}
log('thoughts', JSON.stringify(Object.entries(g.thoughtStats).sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(e => e[0] + ':' + e[1].n.toFixed(0))));
log('objective', g.prog.objective && g.prog.objective.id, 'done', JSON.stringify(g.prog.done));
log('record', JSON.stringify(tr.records), 'totals', JSON.stringify(tr.totals));
log('notes', g.notes.slice(0, 12).map(n => n.text).join(' || '));
