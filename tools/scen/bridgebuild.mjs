import { install } from './helpers.mjs';
/* the constructor over its own start straight: after a climbing loop the next straight
   runs 11 m over the start; the ghost and the preview say it is a bridge, then it is
   built and the loop closed with «Cerrar» (MOBILE=1 for the phone layout) */
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'sandbox', preset: 'campo', seed: 2024, parkName: 'Puentes', tutorial: false }));
  await wait(800);
  await install(ev);
  logs.push('built ' + await ev(() => {
    const g = MX.App.game;
    const P = (o) => Object.assign({ slope: 0, bank: 0, w: 8, surf: 'dirt' }, o);
    const tr = g.newTrack('mx');
    g.placeStart(tr, 36, 44, 7, 8, 'dirt', 0);
    const seq = [P({ t: 'straight', n: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
      P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
      P({ t: 'straight', n: 3, slope: 2 }), P({ t: 'straight', n: 2, slope: 1 }), P({ t: 'curve', k: 2, dir: 1 }), P({ t: 'curve', k: 2, dir: 1 }),
      P({ t: 'straight', n: 2 }), P({ t: 'straight', n: 2 }), P({ t: 'straight', n: 2 }), P({ t: 'straight', n: 2 })];
    for (const p of seq) g.buildPiece(tr, p);
    g.selectedTrack = tr;
    MX.App.trackUI.build = { dir: 'S', n: 3, slope: 0, bank: 0, special: null };
    MX.App.panels.tracks(tr);
    const e = tr.endPose, cam = MX.App.renderer.cam;
    cam.follow = null; cam.zoom = cam.targetZoom = 6; cam.yawIndex = 1;
    __q.focus(e.x * 4, e.z * 4, innerWidth * 0.62, innerHeight * 0.55);
    return tr.pieces.length + ' pieces, height ' + e.e + ' m';
  }));
  await wait(1200);
  logs.push('probe ' + await ev(() => { const p = MX.Tools.list.TrackBuild.probe; return p ? JSON.stringify({ ok: p.ok, cross: p.cross, reason: p.reason }) : 'none'; }));
  await shot('bridge-ghost');
  await page.click('#bld-build'); await wait(600);
  await page.click('#bld-auto'); await wait(1500);
  logs.push('closed ' + await ev(() => { const t = MX.App.game.selectedTrack; return JSON.stringify({ closed: t.closed, len: Math.round(t.length), crossings: MX.Track.crossingsFor(t, MX.App.game.tracks).length }); }));
  await ev(() => { const t = MX.App.game.selectedTrack, cam = MX.App.renderer.cam; const c = MX.Track.crossingsFor(t, MX.App.game.tracks)[0]; MX.WM.closeAll(); MX.Tools.select(); cam.zoom = cam.targetZoom = 7; if (c) __q.focus(c.x, c.z, innerWidth / 2, innerHeight / 2); });
  await wait(1000);
  await shot('bridge-built');
};
