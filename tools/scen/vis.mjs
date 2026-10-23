/* visual check: sandbox game with the demo park layout, close-up shots */
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  await ev(() => { MX.App.renderer.cam.freeYaw = false; MX.App.renderer.cam.yawIndex = 0; });
  await wait(1500);
  await ev(() => { const c = MX.App.renderer.cam; c.tx = 120; c.tz = 262; c.zoom = c.targetZoom = 9; document.getElementById('title').hidden = true; });
  await wait(1500);
  await shot('vis-facilities');
  await ev(() => { const c = MX.App.renderer.cam; const g = MX.App.game; const r = g.riders.find(r => r.m); c.follow = r; c.zoom = c.targetZoom = 14; });
  await wait(2500);
  await shot('vis-rider');
  await ev(() => { const c = MX.App.renderer.cam; c.follow = null; c.tx = 190; c.tz = 180; c.zoom = c.targetZoom = 5; });
  await wait(1500);
  await shot('vis-ground');
};
