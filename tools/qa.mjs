/* QA driver: loads the game in headless Chromium (SwiftShader WebGL2), runs a
   scenario module and saves screenshots. Usage:
   node tools/qa.mjs <page.html> <scenario.mjs> <outDir> [width] [height] */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [,, pagePath, scenarioPath, outDir, w = '1280', h = '720'] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
const t0 = Date.now();
await page.goto(pathToFileURL(resolve(pagePath)).href);
await page.waitForFunction(() => window.MX && MX.App && MX.App.game && document.getElementById('loading').hidden, null, { timeout: 120000 }).catch(e => logs.push('boot timeout ' + e.message));
logs.push('booted in ' + (Date.now() - t0) + ' ms');
let n = 0;
const shot = async (name) => { const p = resolve(outDir, String(++n).padStart(2, '0') + '-' + name + '.png'); await page.screenshot({ path: p }); logs.push('shot ' + p); };
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
try {
  const sc = await import(pathToFileURL(resolve(scenarioPath)).href);
  await sc.default({ page, shot, wait, ev, logs });
} catch (e) { logs.push('scenario error: ' + e.message + '\n' + e.stack); }
console.log(logs.join('\n'));
await browser.close();
