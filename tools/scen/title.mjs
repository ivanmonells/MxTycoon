export default async ({ page, shot, wait, ev, logs }) => {
  await wait(1500);
  await shot('title');
  const fps = await ev(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { if (++n < 20) requestAnimationFrame(f); else r(20000 / (performance.now() - t)); }; requestAnimationFrame(f); }));
  logs.push('fps ' + fps.toFixed(1));
  logs.push('title buttons: ' + await ev(() => [...document.querySelectorAll('#title button')].map(b => b.textContent + (b.disabled ? '(off)' : '')).join(' | ')));
};
