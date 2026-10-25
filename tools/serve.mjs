#!/usr/bin/env node
/* MX Tycoon - small static server for hosting platforms such as Railway. Serves the
   online build (dist/web/index.html, made when the Firebase web configuration is in
   online.config.json or MX_ONLINE_CONFIG) or else the offline single file
   (dist/mx-tycoon.html) at /, compressed, and answers /healthz for health checks.
   Run node build.mjs first (npm start does both). Usage: PORT=3000 node tools/serve.mjs */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const online = join(root, 'dist/web/index.html');
const file = existsSync(online) ? online : join(root, 'dist/mx-tycoon.html');
if (!existsSync(file)) { console.error('No hay nada que servir: ejecuta antes node build.mjs'); process.exit(1); }
const html = readFileSync(file);
const enc = {
  br: brotliCompressSync(html, { params: { [constants.BROTLI_PARAM_QUALITY]: 10 } }),
  gzip: gzipSync(html, { level: 9 })
};
const port = +process.env.PORT || 3000;

createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (path === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); res.end(); return; }
  /* a single page: anything else goes back to it */
  if (path !== '/' && path !== '/index.html') { res.writeHead(302, { location: '/' }); res.end(); return; }
  const accept = req.headers['accept-encoding'] || '';
  const coding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  const body = coding ? enc[coding] : html;
  const head = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'content-length': body.length, vary: 'accept-encoding', 'x-content-type-options': 'nosniff' };
  if (coding) head['content-encoding'] = coding;
  res.writeHead(200, head);
  res.end(req.method === 'HEAD' ? undefined : body);
}).listen(port, '0.0.0.0', () => {
  console.log('MX Tycoon en el puerto ' + port + ' (' + (file === online ? 'versión online' : 'versión sin conexión') + ', ' + Math.round(html.length / 1024) + ' KB, ' + Math.round(enc.br.length / 1024) + ' KB comprimido)');
});
