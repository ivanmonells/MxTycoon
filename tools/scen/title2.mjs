export default async ({ page, shot, wait, ev, logs }) => {
  await wait(800);
  await page.locator('#title .btn', { hasText: 'Opciones' }).click(); await wait(500);
  await shot('t-options');
  await ev(() => MX.WM.closeAll());
  await page.locator('#title .btn', { hasText: 'Cómo jugar' }).click(); await wait(400);
  await shot('t-help');
  await ev(() => MX.WM.closeAll());
  await page.locator('#title .btn', { hasText: 'Cargar' }).click(); await wait(400);
  await shot('t-load');
};
