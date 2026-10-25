/* Top-down previews and numbers of the five starting environments for a few seeds:
   relief of the starting land, slopes, water, trees and room to build by the road.
   Usage: node tools/terrain-preview.cjs <out.png> [seed ...] */
const fs = require('fs');
const zlib = require('zlib');
const { loadSim } = require('./load-sim.cjs');
const MX = loadSim();
const C = MX.C;
const [,, out = 'terrain.png', ...seedArgs] = process.argv;
const seeds = seedArgs.length ? seedArgs.map(Number) : [11, 2024, 777];
const envs = MX.Catalog.environments.map(e => e.id);
const SC = 3, N = C.MAP, PAD = 6;

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const W = envs.length * (N * SC + PAD) + PAD, Hh = seeds.length * (N * SC + PAD) + PAD;
const img = Buffer.alloc(W * Hh * 4, 40);
for (let i = 3; i < img.length; i += 4) img[i] = 255;
seeds.forEach((seed, row) => envs.forEach((id, col) => {
  const t0 = Date.now();
  const g = MX.Game.create({ mode: 'career', seed, preset: id, parkName: 'Prueba' });
  const ms = Date.now() - t0;
  const w = g.world, P = MX.Terrain.plotBox(N);
  const px = MX.Terrain.preview(w, true);
  const ox = PAD + col * (N * SC + PAD), oy = PAD + row * (N * SC + PAD);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) for (let a = 0; a < SC; a++) for (let b = 0; b < SC; b++) {
    const o = ((oy + z * SC + a) * W + ox + x * SC + b) * 4, i = (x + z * N) * 4;
    img[o] = px[i]; img[o + 1] = px[i + 1]; img[o + 2] = px[i + 2];
  }
  /* numbers for the starting land */
  let hmin = Infinity, hmax = -Infinity, steep = 0, water = 0, tiles = 0, trees = 0, rock = 0, impass = 0;
  for (let tz = P.z0; tz < N - 1; tz++) for (let tx = P.x0; tx < P.x1; tx++) {
    const h = w.tileCenterH(tx, tz), sl = w.tileSlope(tx, tz); tiles++;
    hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
    if (sl > 2.2) steep++; if (sl > 3.5) impass++;
    if (w.isWater(tx, tz)) water++;
    if (w.scen[w.idx(tx, tz)] >= 0) trees++;
    if (w.ground[w.idx(tx, tz)] === MX.World.G.ROCK) rock++;
  }
  /* 3x3 lots on the road that need no more than 3.2 m of levelling */
  let lots = 0;
  for (let tx = P.x0; tx + 3 <= P.x1; tx++) { const lv = w.footprintLevel(tx, N - 4, 3, 3); let mn = Infinity, mx = -Infinity; for (let vz = N - 4; vz <= N - 1; vz++) for (let vx = tx; vx <= tx + 3; vx++) { const v = w.vh(vx, vz); mn = Math.min(mn, v); mx = Math.max(mx, v); } if (mx - mn <= 3.2 && !w.isWater(tx, N - 3)) lots++; void lv; }
  const hr = w.heightRange();
  const types = {}; for (const o of w.scenery.values()) types[o.type] = (types[o.type] || 0) + 1;
  console.log(seed + ' ' + id.padEnd(9) + ' ' + ms + 'ms map ' + hr.min.toFixed(1) + '..' + hr.max.toFixed(1) + ' | plot h ' + hmin.toFixed(1) + '..' + hmax.toFixed(1) +
    ' steep>2.2 ' + (steep / tiles * 100).toFixed(1) + '% impass ' + impass + ' water ' + water + ' trees ' + trees + ' rock ' + rock + ' roadLots ' + lots + ' | ' + JSON.stringify(types));
}));
fs.writeFileSync(out, png(W, Hh, img));
console.log('wrote ' + out + ' (' + W + 'x' + Hh + ')');
