/* screenshot of a test page: node tools/shotpage.mjs <page.html?query> <out.png> [w] [h] */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [,, page0, out, w = '1100', h = '700'] = process.argv;
const [file, query] = page0.split('?');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(pathToFileURL(resolve(file)).href + (query ? '?' + query : ''));
await page.waitForFunction(() => window.__done || window.__err, null, { timeout: 60000 }).catch(e => errs.push(e.message));
const e2 = await page.evaluate(() => window.__err || '');
await page.screenshot({ path: out });
console.log((errs.join('\n') + e2) || 'ok');
await browser.close();
