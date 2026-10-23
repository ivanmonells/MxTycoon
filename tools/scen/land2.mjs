export default async ({ page, shot, wait, ev, logs }) => {
  await wait(600);
  await page.locator('#title button', { hasText: 'Modo sandbox' }).tap(); await wait(300);
  await page.locator('#modal .btn', { hasText: 'Empezar' }).tap(); await wait(1000);
  await page.locator('[data-id="build"]').tap(); await wait(600);
  logs.push(await ev(() => { const w = document.querySelector('.win'); const r = w.getBoundingClientRect(); const t = document.getElementById('toolbar').getBoundingClientRect(); const el = document.elementFromPoint(150, r.bottom - 10); return JSON.stringify({ win: [r.top, r.bottom], tb: [t.top, t.bottom], hit: el && (el.id || el.className), zw: getComputedStyle(document.getElementById('windows')).zIndex, ztb: getComputedStyle(document.getElementById('toolbar')).zIndex, inner: innerHeight }); }));
};
