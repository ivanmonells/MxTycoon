/* Headless test of the themed decoration packs: every piece has a model and a pack,
   three pieces of one pack beside a track make a themed zone that lifts its rating
   at once (and removing one takes it away), the pieces keep their place and turn
   through a save, and visitors walking past comment on them.
   Usage: node tools/theme-test.cjs */
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
const Cat = MX.Catalog, T = MX.C.TILE;
const log = (...a) => console.log(...a);
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };

/* catalogue: every themed piece belongs to a listed pack and has a height */
const packs = new Set(Cat.decorThemes.map(t => t.id));
const themed = Object.keys(Cat.decor).filter(k => Cat.decor[k].theme);
check('themed pieces in known packs', themed.length >= 30 && themed.every(k => packs.has(Cat.decor[k].theme) && Cat.decor[k].h > 0), themed.length);
check('every pack has pieces and a visitor thought', Cat.decorThemes.filter(t => t.id !== 'basic').every(t => themed.some(k => Cat.decor[k].theme === t.id) && Cat.thoughts['theme_' + t.id]));

/* a closed motocross loop (the rectangle of close-test) */
const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);
const R2 = [P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 })];
const g = MX.Game.create({ mode: 'sandbox', seed: 4242, preset: 'valle', parkName: 'Temas' });
const tr = g.newTrack('mx');
g.placeStart(tr, 30, 45, 0, 8, 'dirt');
for (const p of [...R2, P({ t: 'straight', n: 3 }), ...R2, P({ t: 'straight', n: 6 }), P({ t: 'straight', n: 6 }), ...R2, P({ t: 'straight', n: 3 }), ...R2]) g.buildPiece(tr, p);
if (!tr.closed) g.autoComplete(tr, 8, 'dirt');
check('loop closed', tr.closed);
const st0 = MX.TrackAnalyzer.analyze(tr, g.world, g);
const r0 = st0.rating;
check('analysed with no themed zone', st0 && st0.themes.length === 0 && st0.base, { rating: r0 });

/* free tiles a few metres outside the track */
const w = g.world, occ = new Set(tr.tiles);
const free = [];
for (const t of tr.tiles) {
  const x = t % w.N, z = (t / w.N) | 0;
  for (const [dx, dz] of [[0, 2], [2, 0], [0, -2], [-2, 0]]) {
    const tx = x + dx, tz = z + dz, i = w.idx(tx, tz);
    if (!w.inBounds(tx, tz) || occ.has(i) || w.trackOcc[i] || w.bld[i] >= 0 || w.path[i] || w.isWater(tx, tz)) continue;
    if (free.some(f => f.tx === tx && f.tz === tz)) continue;
    free.push({ tx, tz });
  }
}
for (const f of free.slice(0, 12)) w.removeSceneryAt(f.tx, f.tz);
const step = () => { for (let i = 0; i < 8; i++) g.step(1 / 30); };

const farm = ['fm_barn', 'fm_tractor', 'fm_cow'];
farm.forEach((k, i) => { const r = g.placeDecor(k, free[i].tx, free[i].tz, Math.PI / 2); if (!r.ok) log('place ' + k + ' ' + r.reason); });
step();
check('three farm pieces make a themed zone', tr.stats.themes.includes('farm'), tr.stats.themes);
check('the zone lifts the rating at once', tr.stats.rating > r0 + 0.15, { before: r0, after: tr.stats.rating });
g.removeScenery(free[2].tx, free[2].tz);
step();
check('removing one piece ends the zone', !tr.stats.themes.includes('farm') && tr.stats.rating < r0 + 0.15, { themes: tr.stats.themes, rating: tr.stats.rating });

/* placement: big pieces sit in the middle of their tile facing where they were turned,
   loose ones shift a little */
const barn = w.sceneryAt(free[0].tx, free[0].tz);
check('barn centred and turned', barn && barn.ox === T / 2 && barn.oz === T / 2 && Math.abs(barn.rot - Math.PI / 2) < 1e-9, barn && { ox: barn.ox, oz: barn.oz, rot: barn.rot });
g.placeDecor('ds_saguaro', free[3].tx, free[3].tz, 0);
const cac = w.sceneryAt(free[3].tx, free[3].tz);
check('cactus near the middle with a little turn', cac && Math.abs(cac.ox - T / 2) <= 0.45 && Math.abs(cac.oz - T / 2) <= 0.45 && Math.abs(cac.rot) <= 0.35, cac && { ox: cac.ox, oz: cac.oz, rot: cac.rot });

/* save and load */
const g2 = MX.Game.deserialize(JSON.parse(JSON.stringify(g.serialize())));
const barn2 = g2.world.sceneryAt(free[0].tx, free[0].tz);
check('themed pieces survive a save', barn2 && barn2.type === 'fm_barn' && Math.abs(barn2.rot - barn.rot) < 0.01 && barn2.ox === barn.ox, barn2 && { type: barn2.type, rot: barn2.rot });

/* visitors walking past a themed piece */
const V = MX.Agents ? MX.Agents.Visitor : null;
if (!V) check('visitor class exported', false);
else {
  const v = new V(g, new MX.U.RNG(3), { x: (free[0].tx + 0.5) * T, z: (free[0].tz + 1.5) * T, tx: free[0].tx, tz: free[0].tz + 1 });
  const h0 = v.happy, n0 = (g.thoughtStats.theme_farm || { n: 0 }).n;
  for (let i = 0; i < 12; i++) v.lookAround(g, new MX.U.RNG(10 + i));
  check('a visitor next to the barn enjoys it and says so once', v.happy > h0 && (g.thoughtStats.theme_farm || { n: 0 }).n === n0 + 1, { happy: [Math.round(h0), Math.round(v.happy)], thoughts: v.thoughts.map(t => t.text) });
}
log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
