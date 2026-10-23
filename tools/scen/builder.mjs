import { install, clickWorld, clickText } from './helpers.mjs';
export default async ({ page, shot, wait, ev, logs }) => {
  await wait(500);
  await ev(() => MX.App.newGame({ mode: 'career', preset: 'valle', parkName: 'Constructor QA', tutorial: false }));
  await wait(800);
  await install(ev);
  await ev(() => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 4.2; __q.focus(150, 220, 860, 380); });
  await page.click('[data-id="tracks"]'); await wait(400);
  await page.click('#win-tracks-new'); await wait(300);
  /* hover the start ghost, rotate twice (90 degrees) and back, place it */
  const sp = await ev(() => __q.w2s(132, 178, 0));
  await page.mouse.move(sp.x, sp.y, { steps: 3 }); await wait(400);
  await shot('start-ghost');
  await page.keyboard.press('r'); await wait(200); await page.keyboard.press('r'); await wait(200);
  await shot('start-rotated');
  for (let k = 0; k < 6; k++) { await page.keyboard.press('r'); await wait(120); }
  await page.mouse.move(sp.x + 2, sp.y, { steps: 2 }); await wait(300);
  await page.mouse.down(); await page.mouse.up(); await wait(600);
  logs.push('after start: ' + await ev(() => { const t = MX.App.game.selectedTrack; return JSON.stringify({ pieces: t.pieces.length, origin: t.origin, tool: MX.Tools.current.name, len: Math.round(t.length) }); }));
  await shot('constructor');
  /* build with the buttons */
  const pressDir = async (label) => { await page.locator('.bld-dirs .bld-btn[aria-label="' + label + '"]').click(); await wait(250); };
  const build = async () => { await page.click('#bld-build'); await wait(450); };
  await pressDir('Recta'); await clickText(page, '.builder .btn.small', 'Media'); await build();
  await page.locator('.bld-specials .feat', { hasText: 'Tabletop mediano' }).click(); await wait(250); await build();
  await pressDir('Curva media a la derecha'); await clickText(page, '.builder .btn.small', 'Peralte', true); await build(); await build();
  await shot('after-curve');
  /* keyboard: straight, slope up then down */
  await page.keyboard.press('ArrowLeft'); await wait(150);   // R2 -> R3
  await page.keyboard.press('ArrowLeft'); await wait(150);   // -> S
  await page.keyboard.press('ArrowUp'); await wait(200);
  await page.keyboard.press('Enter'); await wait(400);
  await page.keyboard.press('ArrowDown'); await wait(150); await page.keyboard.press('ArrowDown'); await wait(150);
  await page.keyboard.press('Enter'); await wait(400);
  await page.keyboard.press('ArrowUp'); await wait(150);
  await page.locator('.bld-specials .feat', { hasText: 'Rollers' }).click(); await wait(250); await build();
  await pressDir('Curva abierta a la derecha'); await build(); await build();
  await page.locator('.bld-specials .feat', { hasText: 'Línea de meta' }).click(); await wait(250); await build();
  logs.push('built: ' + await ev(() => { const t = MX.App.game.selectedTrack; return t.pieces.map(p => p.t[0] + (p.k || p.n || p.f || '') + (p.slope ? (p.slope > 0 ? '+' : '-') : '')).join(' ') + ' len ' + Math.round(t.length) + ' end ' + JSON.stringify(t.endPose); }));
  await pressDir('Curva cerrada a la izquierda'); await wait(300);
  await ev(() => { const t = MX.App.game.selectedTrack, e = t.endPose; const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 9; __q.focus(e.x * 4, e.z * 4, 820, 380); });
  await wait(500);
  await shot('ghost-left');
  /* remove the last piece with Backspace and rebuild it */
  const n0 = await ev(() => MX.App.game.selectedTrack.pieces.length);
  await page.keyboard.press('Backspace'); await wait(400);
  const n1 = await ev(() => MX.App.game.selectedTrack.pieces.length);
  logs.push('backspace pieces ' + n0 + ' -> ' + n1);
  await page.locator('.bld-specials .feat', { hasText: 'Línea de meta' }).click(); await wait(250); await build();
  /* auto close */
  await page.click('#bld-auto'); await wait(1500);
  logs.push('auto: ' + await ev(() => { const t = MX.App.game.selectedTrack; return JSON.stringify({ closed: t.closed, pieces: t.pieces.length, len: Math.round(t.length), tool: MX.Tools.current.name, money: Math.round(MX.App.game.econ.money) }); }));
  await ev(() => { const c = MX.App.renderer.cam; c.zoom = c.targetZoom = 3; __q.focus(160, 215, 820, 400); });
  await wait(600);
  await shot('closed');
  logs.push('validate ' + await ev(() => JSON.stringify(MX.App.game.validateTrack(MX.App.game.selectedTrack).map(i => i.level + ':' + i.msg))));
  /* suggested loop in sandbox-like check: delete and suggest */
  await clickText(page, '.win .btn', 'Trazado sugerido'); await wait(800);
  logs.push('suggested: ' + await ev(() => MX.App.game.tracks.map(t => t.name + ' ' + t.state + ' ' + Math.round(t.length) + ' closed=' + t.closed).join(' | ')));
  await shot('suggested');
};
