import { install } from './helpers.mjs';
export default async ({ page, shot, wait, ev, logs }) => {
  await install(ev);
  const r = await ev(() => {
    const cam = MX.App.renderer.cam;
    const out = [];
    out.push('before ' + JSON.stringify(__q.w2s(150, 214)) + ' cam ' + cam.tx + ',' + cam.tz + ' zoom ' + cam.zoom + ' css ' + MX.App.renderer.cssScale + ' w ' + cam.w);
    __q.focus(150, 214, 860, 330);
    out.push('after ' + JSON.stringify(__q.w2s(150, 214)) + ' cam ' + cam.tx.toFixed(1) + ',' + cam.tz.toFixed(1));
    return out;
  });
  logs.push(...r);
  await wait(500);
  logs.push('later ' + JSON.stringify(await ev(() => [__q.w2s(150, 214), MX.App.renderer.cam.tx, MX.App.renderer.cam.tz])));
};
