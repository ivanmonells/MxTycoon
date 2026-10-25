/* Headless test of the wide start straight: suggested loops get one outside the first
   leg, the player can put it on either side or leave it out, the first bend moves an
   automatic one to the outside, races line the field up at its gate and every rider
   joins the circuit, and saves keep it. Usage: node tools/start-test.cjs */
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
const Cat = MX.Catalog;
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };
const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);
const facilities = (g) => {
  const B = (t, x, z, r) => g.placeBuilding(t, x, z, r || 0);
  B('parking', 26, 76); B('paddock', 50, 76);
  for (let x = 22; x <= 66; x++) g.placePath(x, 73, 1);
  B('entrance', 30, 74); B('toilets', 34, 72, 2);
  g.rebuildFields();
};

/* suggested loops: the start straight sits outside, clear of everything */
{
  const g = MX.Game.create({ mode: 'sandbox', seed: 777, preset: 'valle', parkName: 'Salidas' });
  const tr = g.newTrack('mx');
  const r = g.suggestLoop(tr, { x0: 20, z0: 10, w: 34, h: 30 }, 8, 'dirt');
  const c = tr.chute;
  check('suggested loop has a start straight', r.ok && !!c && tr.chuteSide === -1, { ok: r.ok, side: tr.chuteSide });
  const errs = tr.validate(g.world).filter(i => i.level === 'error').map(i => i.msg);
  check('no errors with it', !errs.length, errs);
  check('the gate is as wide as the straight', c && Math.abs(c.S.w[c.sIndex(c.gateS)] - MX.Track.chuteWidth('mx')) < 0.5 && MX.Track.gateSlots(22) >= 20);
  /* it joins the first piece: same place, heading and height where they meet */
  const pm = c.poseAt(c.mergeAt, 0, {}), pj = tr.poseAt(c.joinS, 0, {});
  check('it merges into the circuit', Math.hypot(pm.x - pj.x, pm.z - pj.z) < 0.6 && Math.abs(MX.U.wrapAngle(pm.hdg - pj.hdg)) < 0.08 && Math.abs(pm.y - pj.y) < 0.15,
    { d: +Math.hypot(pm.x - pj.x, pm.z - pj.z).toFixed(2), dh: +(pm.y - pj.y).toFixed(2) });
  /* the tiles under it belong to the circuit */
  const own = tr.tiles.filter(t => g.world.trackOcc[t] & tr.bit).length;
  check('its ground is taken by the circuit', own === tr.tiles.length && tr.tiles.length > 0);
  facilities(g);
  const op = g.openTrack(tr);
  check('it opens', op.ok, op.reason);
  /* races start from the gate on it */
  for (const type of ['amateur', 'gp']) {
    g.race = new MX.Race(g, { id: 99, type, trackId: tr.id, day: g.day, ticket: Cat.events[type].ticket }, tr);
    const race = g.race;
    race.begin();
    const inGate = race.riders.every(rr => Math.abs(tr.chuteV(rr.x, rr.z) - c.frame.vg) < c.frame.W / 2 && tr.chuteU(rr.x, rr.z) < c.frame.uG);
    let minGap = Infinity;
    for (let i = 0; i < race.riders.length; i++) for (let j = i + 1; j < race.riders.length; j++) minGap = Math.min(minGap, Math.hypot(race.riders[i].x - race.riders[j].x, race.riders[i].z - race.riders[j].z));
    check(type + ': field lined up behind the gate', inGate && minGap > 0.8, { riders: race.riders.length, minGap: +minGap.toFixed(2) });
    let t = 0, launched = 0, joined = null, maxBehind = 0;
    while (g.race && t < 1600) {
      if (g.fieldsDirty) g.rebuildFields();
      g.step(1 / 30); t += 1 / 30;
      if (race.phase === 'race' && !launched) launched = race.riders.filter(rr => rr.m && rr.m.chute).length;
      if (launched && joined == null && race.riders.every(rr => !rr.m || !rr.m.chute)) joined = race.t;
      if (race.phase === 'race') for (const rr of race.riders) if (rr.m && rr.m.chute) maxBehind = Math.max(maxBehind, race.t);
    }
    const res = g.comp.history[g.comp.history.length - 1];
    check(type + ': everyone starts on the straight and joins the circuit', launched === race.riders.length && joined != null && joined < 20, { launched, joined: joined && +joined.toFixed(1) });
    check(type + ': the race finishes with laps counted from the join', res && res.standings[0].done && res.standings[0].laps === res.laps && res.fastest && res.fastest.t > 10, res && { laps: res.laps, win: res.standings[0], fastest: res.fastest });
    check(type + ': holeshot announced', !!race.holeshot);
  }
  const g2 = MX.Game.deserialize(JSON.parse(JSON.stringify(g.serialize())));
  check('save keeps it', g2.tracks[0].chuteSide === -1 && !!g2.tracks[0].chute && Math.abs(g2.tracks[0].chute.length - c.length) < 0.01);
}

/* building piece by piece: sides, the automatic move and the player's choice */
{
  const g = MX.Game.create({ mode: 'sandbox', seed: 4242, preset: 'valle', parkName: 'Piezas' });
  const tr = g.newTrack('mx');
  const pr = tr.probeStart(g.world, 30, 45, 0, 8, 'dirt');
  check('the start probe picks a side', pr.ok && Math.abs(pr.chuteSide) === 1, { ok: pr.ok, side: pr.chuteSide, reason: pr.reason });
  g.placeStart(tr, 30, 45, 0, 8, 'dirt');
  const s0 = tr.chuteSide;
  g.buildPiece(tr, P({ t: 'straight', n: 2 }));
  g.buildPiece(tr, P({ t: 'curve', k: 2, dir: s0 }));
  check('an automatic straight moves outside the first bend', tr.chuteSide === -s0, { before: s0, after: tr.chuteSide });
  const r1 = g.setChuteSide(tr, s0);
  check('the player can move it back (inside the bend it fits while the loop is open)', r1.ok && tr.chuteSide === s0 && tr.chuteSet, r1.reason);
  g.buildPiece(tr, P({ t: 'curve', k: 2, dir: -s0 }));
  check('a chosen side stays put', tr.chuteSide === s0);
  const r0 = g.setChuteSide(tr, 0);
  check('it can be left out', r0.ok && tr.chuteSide === 0 && !tr.chute, r0.reason);
  const t2 = g.newTrack('mx');
  const pl = g.placeStart(t2, 30, 25, 0, 8, 'dirt', 0);
  check('a start placed without it', pl.ok && t2.chuteSide === 0 && !t2.chute, pl.reason);
  const t3 = g.newTrack('mx');
  const pl3 = g.placeStart(t3, 60, 25, 2, 8, 'dirt', 1);
  check('a start placed with it on the right', pl3.ok && t3.chuteSide === 1 && t3.chuteSet && !!t3.chute, pl3.reason);
}

/* disciplines: gate starts get one sized to them, the others none */
{
  const g = MX.Game.create({ mode: 'sandbox', seed: 777, preset: 'valle', parkName: 'Tipos' });
  const want = {};
  for (const type of Object.keys(Cat.trackTypes)) want[type] = MX.Track.chuteWidth(type);
  check('gate disciplines have one, the rest none', want.mx === 22 && want.kids > 0 && want.sx > 0 && !want.flat && !want.enduro && !want.carcross, want);
  const kids = g.newTrack('kids');
  const r = g.suggestLoop(kids, { x0: 20, z0: 10, w: 22, h: 20 }, 5, 'dirt');
  check('a minicross loop gets a narrower one', r.ok && kids.chute && Math.abs(kids.chute.frame.W - want.kids) < 0.01, r.reason);
  const flat = g.newTrack('flat');
  const r2 = g.suggestLoop(flat, { x0: 50, z0: 10, w: 30, h: 22 }, 10, 'clay');
  check('a dirt track loop has none', r2.ok && !flat.chute, r2.reason);
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
