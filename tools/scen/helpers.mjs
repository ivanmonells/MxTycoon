/* shared helpers for QA scenarios (run inside the page via ev) */
export async function install(ev) {
  await ev(() => {
    window.__q = {
      g: () => MX.App.game,
      w2s(x, z, yOff) { const g = MX.App.game; const y = g.world.heightAt(x, z) + (yOff || 0); const p = MX.App.renderer.worldToCss(x, y, z); return { x: p[0], y: p[1] }; },
      focus(x, z, sx, sy) {
        const cam = MX.App.renderer.cam;
        cam.follow = null;
        for (let it = 0; it < 4; it++) {
          cam.compute();
          const p0 = this.w2s(x, z);
          const save = [cam.tx, cam.tz];
          cam.tx += 1; cam.compute(); const px = this.w2s(x, z);
          cam.tx = save[0]; cam.tz += 1; cam.compute(); const pz = this.w2s(x, z);
          cam.tx = save[0]; cam.tz = save[1];
          const a = px.x - p0.x, b = pz.x - p0.x, c = px.y - p0.y, d = pz.y - p0.y;
          const ex = sx - p0.x, ey = sy - p0.y, det = a * d - b * c;
          cam.tx += (ex * d - b * ey) / det; cam.tz += (a * ey - c * ex) / det;
        }
        cam.compute();
      },
      freeAt(sx, sy) { const el = document.elementFromPoint(sx, sy); return el && el.id === 'gl'; },
      trackPoint(tr, s, lane) { const i = tr.sIndex(s); const S = tr.S; const hdg = S.hdg[i]; const x = S.x[i] - Math.sin(hdg) * (lane || 0), z = S.z[i] + Math.cos(hdg) * (lane || 0); return { x, z, y: S.y[i] }; }
    };
  });
}
export async function clickWorld(page, ev, x, z, opts = {}) {
  const p = await ev(([x, z, y]) => __q.w2s(x, z, y), [x, z, opts.y || 0]);
  const free = await ev(([a, b]) => __q.freeAt(a, b), [p.x, p.y]);
  if (!free && !opts.force) throw new Error('world point ' + x.toFixed(1) + ',' + z.toFixed(1) + ' covered by UI at ' + p.x.toFixed(0) + ',' + p.y.toFixed(0));
  await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.waitForTimeout(opts.hoverWait || 120);
  await page.mouse.down({ button: opts.button || 'left' });
  await page.mouse.up({ button: opts.button || 'left' });
  await page.waitForTimeout(opts.after || 150);
  return p;
}
export async function dragWorld(page, ev, pts, opts = {}) {
  const sp = [];
  for (const [x, z] of pts) sp.push(await ev(([x, z]) => __q.w2s(x, z, 0), [x, z]));
  await page.mouse.move(sp[0].x, sp[0].y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  for (const p of sp.slice(1)) { await page.mouse.move(p.x, p.y, { steps: opts.steps || 6 }); await page.waitForTimeout(opts.stepWait || 120); }
  await page.mouse.up();
  await page.waitForTimeout(200);
}
export async function clickText(page, sel, text) {
  const loc = page.locator(sel, { hasText: text }).first();
  await loc.click();
  await page.waitForTimeout(250);
}
