import { install } from './helpers.mjs';
/* the wide motocross start straight: a suggested loop with it, the field lined up at the
   gate, the gate dropping and the pack funnelling into the first corner (QA_ENV picks the map) */
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  const env = process.env.QA_ENV || 'campo';
  await ev((env) => {
    const g = MX.Game.create({ mode: 'sandbox', seed: 2024, preset: env, parkName: 'Salida ancha' });
    MX.App.startGame(g);
  }, env);
  await wait(600);
  await install(ev);
  logs.push('setup ' + await ev(() => {
    const g = MX.App.game, w = g.world, N = w.N;
    const tr = g.newTrack('mx');
    const r = g.suggestLoop(tr, { x0: 24, z0: 16, w: 36, h: 34 }, 8, 'dirt');
    const B = (t, x, z, rot) => g.placeBuilding(t, x, z, rot || 0);
    const xs = (a, b) => { const o = []; for (let x = a; x <= b; x++) o.push(x); return o; };
    const tryPlace = (type, z, rot, list) => { for (const x of list) if (B(type, x, z, rot).ok) return x; return -1; };
    const px = tryPlace('parking', N - 4, 0, xs(20, 50));
    tryPlace('paddock', N - 4, 0, xs(px + 4, 60));
    tryPlace('entrance', N - 7, 2, xs(px, px + 4));
    tryPlace('toilets', N - 8, 2, xs(px + 3, px + 12));
    g.rebuildFields();
    const op = g.openTrack(tr);
    g.selectedTrack = null; g.speed = 0;
    return JSON.stringify({ ok: r.ok, reason: r.reason, side: tr.chuteSide, chute: !!tr.chute, open: op.ok, why: op.reason, len: Math.round(tr.length) });
  }));
  const focusChute = async (zoom, yaw) => ev(([zoom, yaw]) => {
    const g = MX.App.game, tr = g.tracks[0], c = tr.chute;
    const cam = MX.App.renderer.cam; cam.follow = null; cam.zoom = cam.targetZoom = zoom; if (yaw != null) cam.yawIndex = yaw;
    const i = c.sIndex((c.gateS + c.mergeAt) / 2);
    __q.focus(c.S.x[i], c.S.z[i], innerWidth / 2, innerHeight / 2);
  }, [zoom, yaw]);
  await focusChute(5.5, 0);
  await wait(900);
  await shot('chute-empty');
  /* close-up of where the start straight meets the circuit */
  await ev(() => {
    const tr = MX.App.game.tracks[0], c = tr.chute, F = c.frame;
    const u = (c.joinU + F.uM) / 2, x = F.ox + F.dx * u + F.nx * F.w0, z = F.oz + F.dz * u + F.nz * F.w0;
    const cam = MX.App.renderer.cam; cam.zoom = cam.targetZoom = 12;
    __q.focus(x, z, innerWidth / 2, innerHeight / 2);
  });
  await wait(900);
  await shot('chute-junction');
  /* a race straight away */
  await ev(() => {
    const g = MX.App.game, tr = g.tracks[0];
    g.race = new MX.Race(g, { id: 99, type: 'national', trackId: tr.id, day: g.day, ticket: MX.Catalog.events.national.ticket }, tr);
    g.race.begin();
    g.race.phase = 'grid'; g.race.t = 0;
    MX.WM.closeAll();
  });
  await wait(800);
  await ev(() => {
    const c = MX.App.game.tracks[0].chute, i = c.sIndex(c.gateS);
    const cam = MX.App.renderer.cam; cam.zoom = cam.targetZoom = 9;
    __q.focus(c.S.x[i], c.S.z[i], innerWidth / 2, innerHeight / 2);
  });
  await wait(900);
  await shot('chute-grid');
  logs.push('grid ' + await ev(() => { const r = MX.App.game.race; return r.riders.length + ' riders, chute start ' + r.chute; }));
  /* gate drops */
  await ev(() => { const g = MX.App.game; for (let i = 0; i < 30 * 9.2; i++) g.step(1 / 30); });
  await wait(300);
  await shot('chute-gate-down');
  await ev(() => { const g = MX.App.game; for (let i = 0; i < 30 * 2.2; i++) g.step(1 / 30); MX.WM.closeAll(); });
  await focusChute(6.5, 0);
  await wait(600);
  await shot('chute-launch');
  await ev(() => { const g = MX.App.game; for (let i = 0; i < 30 * 2.4; i++) g.step(1 / 30); });
  await wait(600);
  await shot('chute-funnel');
  logs.push('after 5s ' + await ev(() => { const r = MX.App.game.race; return 'on chute ' + r.riders.filter(x => x.m && x.m.chute).length + ', joined ' + r.riders.filter(x => x.m && !x.m.chute).length; }));
  await focusChute(4, 2);
  await wait(800);
  await shot('chute-north');
};
