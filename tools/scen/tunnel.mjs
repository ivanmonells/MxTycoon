import { install } from './helpers.mjs';
/* crossings: a circuit built piece by piece that climbs to 11 m and passes over its own
   start straight, and a second circuit at ground level running under its raised bends
   twice; both open with riders, views of the bridges from several sides (QA_YAW) */
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  await ev(() => {
    const g = MX.Game.create({ mode: 'sandbox', seed: 2024, preset: 'campo', parkName: 'Cruces' });
    MX.App.startGame(g);
  });
  await wait(600);
  await install(ev);
  logs.push('setup ' + await ev(() => {
    const g = MX.App.game;
    const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);
    const a = g.newTrack('mx');
    g.placeStart(a, 36, 44, 7, 8, 'dirt', 0);
    const seq = [P({ t: 'straight', n: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
      P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
      P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 2, slope: 1 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
      P({ t: 'straight', n: 2 }), P({ t: 'straight', n: 2 }), P({ t: 'straight', n: 2 }), P({ t: 'straight', n: 2 })];
    for (const p of seq) g.buildPiece(a, p);
    g.autoComplete(a, 8, 'dirt');
    g.addFeature(a, 'finish', a.length * 0.3);
    const b = g.newTrack('mx');
    g.editTrack(b, (t) => {
      const cx = 245, cz = 190, L = 32, R = 10;
      for (let k = 0; k <= 6; k++) t.addNode(cx - L + 2 * L * k / 6, cz - R, 8, 'dirt');
      for (let k = 1; k < 6; k++) { const u = -Math.PI / 2 + Math.PI * k / 6; t.addNode(cx + L + R * Math.cos(u), cz + R * Math.sin(u), 8, 'dirt'); }
      for (let k = 0; k <= 6; k++) t.addNode(cx + L - 2 * L * k / 6, cz + R, 8, 'dirt');
      for (let k = 1; k < 6; k++) { const u = Math.PI / 2 + Math.PI * k / 6; t.addNode(cx - L + R * Math.cos(u), cz + R * Math.sin(u), 8, 'dirt'); }
      t.closed = true;
    });
    const B = (t, x, z, r) => g.placeBuilding(t, x, z, r || 0);
    B('parking', 26, 76); B('paddock', 50, 76);
    for (let x = 22; x <= 66; x++) g.placePath(x, 73, 1);
    B('entrance', 30, 74); B('toilets', 34, 72, 2);
    g.rebuildFields();
    const oa = g.openTrack(a);
    const xs = MX.Track.crossingsFor(a, g.tracks);
    window.__xs = xs.map(c => ({ x: c.x, z: c.z }));
    for (let i = 0; i < 30 * 30 * 6; i++) { if (g.fieldsDirty) g.rebuildFields(); g.step(1 / 30); }
    g.selectedTrack = null;
    return JSON.stringify({ open: oa.ok, why: oa.reason, crossings: xs.map(c => [c.U.id, c.L.id, +c.dy.toFixed(1)]), riders: g.riders.filter(r => r.state === 'ride').length, issuesB: b.validate(g.world).filter(i => i.level === 'error').map(i => i.msg) });
  }));
  const yaw = +(process.env.QA_YAW || 1);
  await ev((z) => { window.__zoom = z; }, +(process.env.QA_ZOOM || 8));
  await ev((yaw) => { const cam = MX.App.renderer.cam; cam.follow = null; cam.zoom = cam.targetZoom = 3.2; cam.yawIndex = yaw; const x = __xs.reduce((s, c) => s + c.x, 0) / __xs.length, z = __xs.reduce((s, c) => s + c.z, 0) / __xs.length; __q.focus(x, z, innerWidth / 2, innerHeight / 2); }, yaw);
  await wait(900); await shot('crossings-wide');
  const n = await ev(() => __xs.length);
  for (let k = 0; k < n; k++) {
    for (const y of [yaw, (yaw + 2) % 4]) {
      await ev(([k, y]) => { const cam = MX.App.renderer.cam; cam.zoom = cam.targetZoom = +(window.__zoom || 8); cam.yawIndex = y; __q.focus(__xs[k].x, __xs[k].z, innerWidth / 2, innerHeight / 2); }, [k, y]);
      await wait(900); await shot('crossing-' + k + '-yaw' + y);
    }
  }
};
