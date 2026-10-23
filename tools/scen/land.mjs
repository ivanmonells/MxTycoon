export default async ({ page, shot, wait, ev, logs }) => {
  await wait(800);
  await shot('l-title');
  await page.locator('#title button', { hasText: 'Modo sandbox' }).tap(); await wait(400);
  await page.locator('#modal .btn', { hasText: 'Empezar' }).tap(); await wait(1200);
  await page.locator('[data-id="build"]').tap(); await wait(600);
  await shot('l-build');
  logs.push('audio ' + await ev(() => JSON.stringify({ init: !!MX.Audio.ctx, state: MX.Audio.ctx && MX.Audio.ctx.state, enabled: MX.Audio.enabled })));
};
