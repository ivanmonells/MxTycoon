import { install } from './helpers.mjs';
/* close-ups of where the wide start straight meets the circuit, on suggested loops of
   several maps (QA_ENV, QA_SEEDS) and from two sides */
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  const env = process.env.QA_ENV || 'colinas';
  const seeds = (process.env.QA_SEEDS || '11,2024,777').split(',').map(Number);
  await ev(([du, dv, type]) => { window.__du = du; window.__dv = dv; window.__type = type; }, [process.env.QA_DU || -4, process.env.QA_DV || 2, process.env.QA_TYPE || 'mx']);
  const zoom = +(process.env.QA_ZOOM || 11);
  for (const seed of seeds) {
    const info = await ev(([env, seed]) => {
      const g = MX.Game.create({ mode: 'sandbox', seed, preset: env, parkName: 'Union ' + seed });
      MX.App.startGame(g);
      g.speed = 0;
      const type = window.__type || 'mx', td = MX.Catalog.trackTypes[type];
      const tr = g.newTrack(type);
      let r = null;
      for (const rect of [{ x0: 24, z0: 30, w: 40, h: 34 }, { x0: 20, z0: 14, w: 40, h: 34 }, { x0: 40, z0: 20, w: 40, h: 34 }]) {
        r = g.suggestLoop(tr, rect, td.width, td.surface);
        if (r.ok && tr.chute) break;
      }
      if (!tr.chute) return { ok: false, reason: r && r.reason };
      g.selectedTrack = null;
      const c = tr.chute, F = c.frame, S = c.S, M = tr.S;
      const u = (c.joinU + F.uM) / 2;
      /* heights where they meet: start straight's own level against the circuit's */
      const near = c.nearestS(F.ox + F.dx * c.joinU + F.nx * (F.w0 / 2 + 3), F.oz + F.dz * c.joinU + F.nz * (F.w0 / 2 + 3));
      const ju = c.joinU + +(window.__du || -4), jv = F.w0 / 2 + +(window.__dv || 2);
      const jx = F.ox + F.dx * ju + F.nx * jv, jz = F.oz + F.dz * ju + F.nz * jv;
      /* at the height of the track there, not of the ground under it */
      window.__j = { x: jx, z: jz, y: M.y[tr.sIndex(Math.max(0, ju))] };
      return { ok: true, side: tr.chuteSide, step: +(S.y[near.i] - M.y[tr.sIndex(c.joinU)]).toFixed(2), joinU: +c.joinU.toFixed(1), u: +u.toFixed(1) };
    }, [env, seed]);
    logs.push(env + ' ' + seed + ' ' + JSON.stringify(info));
    if (!info.ok) continue;
    await install(ev);
    for (const yaw of [0, 2]) {
      await ev(([yaw, zoom]) => {
        const cam = MX.App.renderer.cam, r = MX.App.renderer; cam.follow = null; cam.zoom = cam.targetZoom = zoom; cam.yawIndex = yaw;
        cam.yaw = Math.PI / 4 + yaw * Math.PI / 2; cam.ty = __j.y;
        /* centre the screen on the point at track height (the ground under a raised track is lower) */
        for (let it = 0; it < 4; it++) {
          cam.compute();
          const p0 = r.worldToCss(__j.x, __j.y, __j.z), K = 10;
          const t0 = [cam.tx, cam.tz];
          cam.tx += K; cam.compute(); const px = r.worldToCss(__j.x, __j.y, __j.z);
          cam.tx = t0[0]; cam.tz += K; cam.compute(); const pz = r.worldToCss(__j.x, __j.y, __j.z);
          cam.tx = t0[0]; cam.tz = t0[1];
          const a = (px[0] - p0[0]) / K, b = (pz[0] - p0[0]) / K, c = (px[1] - p0[1]) / K, d = (pz[1] - p0[1]) / K;
          const ex = innerWidth / 2 - p0[0], ey = innerHeight / 2 - p0[1], det = a * d - b * c;
          if (Math.abs(det) < 1e-6) break;
          cam.tx += (ex * d - b * ey) / det; cam.tz += (a * ey - c * ex) / det;
        }
        cam.compute();
      }, [yaw, zoom]);
      await wait(900);
      await shot(env + '-' + seed + '-yaw' + yaw);
    }
  }
};
