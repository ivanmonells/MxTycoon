import { install } from './helpers.mjs';
/* the five starting environments: a career park of each, the default view, a wide view
   from the south and one from the north (QA_SEED picks the map, QA_ENVS a subset) */
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  const envs = (process.env.QA_ENVS || 'playa,campo,desierto,colinas,montana').split(',');
  const seed = +(process.env.QA_SEED || 2024);
  for (const id of envs) {
    await ev(([id, seed]) => {
      const g = MX.Game.create({ mode: 'career', seed, preset: id, parkName: 'Entorno ' + id });
      MX.App.startGame(g);
      const c = MX.App.renderer.cam; c.tx = 160; c.tz = 250; c.ty = g.world.heightAt(160, 250); c.zoom = c.targetZoom = 7;
    }, [id, seed]);
    await install(ev);
    await wait(900);
    await shot(id + '-start');
    await ev(() => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 2.3; c.tx = 160; c.tz = 150; c.ty = MX.App.game.world.heightAt(160, 150); });
    await wait(900);
    await shot(id + '-wide');
    await ev(() => { const c = MX.App.renderer.cam; c.yawIndex = 2; });
    await wait(900);
    await shot(id + '-north');
    await ev(() => { const c = MX.App.renderer.cam; c.yawIndex = 0; });
    logs.push(id + ' ' + await ev(() => { const w = MX.App.game.world, r = w.heightRange(); return 'h ' + r.min.toFixed(1) + '..' + r.max.toFixed(1) + ' scenery ' + w.scenery.size; }));
  }
};
