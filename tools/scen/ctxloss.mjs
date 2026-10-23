export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'sandbox', preset: 'valle', parkName: 'Prueba Contexto', tutorial: false }));
  await wait(800);
  await ev(() => { const g = MX.App.game; const tr = g.newTrack(); g.editTrack(tr, (t) => { for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; t.addNode(160 + Math.cos(a) * 50, 210 + Math.sin(a) * 38, 8, 'dirt'); } t.closed = true; }); g.placeBuilding('paddock', 40, 76, 0); const c = MX.App.renderer.cam; c.tx = 160; c.tz = 230; c.zoom = c.targetZoom = 4; });
  await wait(800);
  const ext = await ev(() => { const e = MX.App.renderer.gl.getExtension('WEBGL_lose_context'); window.__lc = e; if (e) e.loseContext(); return !!e; });
  await wait(800);
  logs.push('ext ' + ext + ' lost ' + await ev(() => MX.App.renderer.lost));
  await ev(() => window.__lc && window.__lc.restoreContext());
  await wait(2500);
  logs.push('after restore lost=' + await ev(() => MX.App.renderer.lost) + ' toasts=' + await ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ')));
  await shot('restored');
};
