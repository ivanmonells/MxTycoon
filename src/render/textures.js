/* MX Tycoon - procedural pixel-art textures: a 128px material array (8 texels per metre,
   tiling) and a 1024px atlas for signs, sponsor logos, windows, icons and particles. */
(function (MX) {
  'use strict';
  const U = MX.U;
  const SIZE = 128;

  /* periodic value noise so every material tiles seamlessly */
  function pn(x, y, period, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const P = period;
    const h = (a, b) => U.hash2(U.mod(a, P), U.mod(b, P), seed);
    return U.lerp(U.lerp(h(xi, yi), h(xi + 1, yi), u), U.lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  }
  function fbmP(x, y, period, seed, oct) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { s += pn(x * f, y * f, period * f, seed + i * 31) * a; n += a; a *= 0.5; f *= 2; }
    return s / n;
  }
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const shade = (c, k) => [U.clamp(c[0] * k, 0, 255), U.clamp(c[1] * k, 0, 255), U.clamp(c[2] * k, 0, 255)];

  function makeCanvas(w, h) {
    const c = (typeof document !== 'undefined') ? document.createElement('canvas') : new OffscreenCanvas(w, h);
    c.width = w; c.height = h;
    return c;
  }

  /* Pixel painter: fn(x, y) -> [r,g,b,a?] */
  function paint(fn, size) {
    size = size || SIZE;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const p = fn(x, y);
      const o = (y * size + x) * 4;
      d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = p.length > 3 ? p[3] : 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  /* Choose from a palette with noise bands: typical pixel art material */
  function palNoise(pal, scale, seed, sparkle) {
    return (x, y) => {
      const n = fbmP(x / scale, y / scale, SIZE / scale, seed, 3);
      const r = U.hash2(x, y, seed + 5);
      let t = n * 0.85 + r * 0.25;
      if (sparkle && r > 1 - sparkle) t = 1;
      const k = U.clamp(Math.floor(t * pal.length), 0, pal.length - 1);
      return pal[k];
    };
  }

  const L = {};       // name -> layer index
  const layers = [];  // canvases
  function layer(name, canvas) { L[name] = layers.length; layers.push(canvas); }

  function buildMaterials() {
    if (layers.length) return;
    const S = SIZE;
    /* --- terrain --- */
    const grassPal = ['#3f7a2e', '#4a8a33', '#56963a', '#5fa13f', '#6aab45', '#78b84c'].map(hex);
    layer('grass', paint((x, y) => {
      let c = palNoise(grassPal, 16, 11)(x, y);
      const r = U.hash2(x, y, 99);
      if (r > 0.985) c = hex('#8cc85a');
      else if (r < 0.02) c = hex('#356a27');
      const f = U.hash2(x, y, 1234);
      if (f > 0.9975) c = U.hash2(x, y, 77) > 0.5 ? hex('#f3e36b') : hex('#f4f0f2');
      return c;
    }));
    const dryPal = ['#7f7d3b', '#8e8a42', '#9c9648', '#a8a04e', '#b5ad5a', '#c2b964'].map(hex);
    layer('dry', paint((x, y) => {
      let c = palNoise(dryPal, 14, 21)(x, y);
      if (U.hash2(x, y, 3) > 0.985) c = hex('#6f6d33');
      return c;
    }));
    const dirtPal = ['#6b4a2c', '#7a5533', '#86603a', '#916b41', '#9c7649', '#a88352'].map(hex);
    layer('dirt', paint((x, y) => {
      let c = palNoise(dirtPal, 10, 31)(x, y);
      const r = U.hash2(x, y, 7);
      if (r > 0.992) c = hex('#c0a07a'); else if (r < 0.01) c = hex('#553a22');
      return c;
    }));
    const sandPal = ['#c7ab74', '#d1b67e', '#d9c088', '#e0c892', '#e7d19d', '#efdbab'].map(hex);
    layer('sand', paint((x, y) => {
      const rip = Math.sin((y + pn(x / 16, y / 16, 8, 3) * 10) / S * Math.PI * 2 * 9) * 0.5 + 0.5;
      let c = palNoise(sandPal, 12, 41)(x, y);
      if (rip > 0.86) c = shade(c, 0.9);
      return c;
    }));
    const rockPal = ['#6f6c68', '#7c7974', '#8a8781', '#97948e', '#a5a29b', '#b3b0a8'].map(hex);
    layer('rock', paint((x, y) => {
      let c = palNoise(rockPal, 9, 51)(x, y);
      const cr = Math.abs(fbmP(x / 20, y / 20, S / 20, 53, 2) - 0.5);
      if (cr < 0.025) c = hex('#55524e');
      return c;
    }));
    const forPal = ['#2f4f22', '#385a27', '#43632a', '#4f6b2f', '#5b5a2c', '#6a5a30'].map(hex);
    layer('forest', paint(palNoise(forPal, 8, 61, 0.01)));
    const gravPal = ['#8f887a', '#9b9384', '#a79f8f', '#b2aa99', '#bdb5a3', '#c9c1ae'].map(hex);
    layer('gravel', paint((x, y) => {
      const r = U.hash2(x, y, 71);
      const k = Math.floor(r * gravPal.length);
      return gravPal[U.clamp(k, 0, 5)];
    }));
    /* --- track surfaces: u across width, v along the track --- */
    const trackPal = ['#7a4f2c', '#875a32', '#946538', '#a0703f', '#ab7c48', '#b88a55'].map(hex);
    const ruts = (x, y, seed, depth) => {
      const lane = Math.abs(((x / S) * 6 + pn(y / 32, x / 32, 4, seed) * 0.6) % 1 - 0.5);
      return lane < 0.06 ? depth : 1;
    };
    layer('t_dirt', paint((x, y) => {
      let c = palNoise(trackPal, 8, 81)(x, y);
      c = shade(c, ruts(x, y, 82, 0.82));
      if (U.hash2(x, y, 83) > 0.99) c = hex('#c9a27a');
      const bump = Math.sin(y / S * Math.PI * 2 * 12 + pn(x / 32, 0, 4, 9) * 3);
      if (bump > 0.93) c = shade(c, 0.9);
      return c;
    }));
    const tsandPal = ['#c4a26b', '#cfae77', '#d8b981', '#e0c38d', '#e7cd98', '#eed7a6'].map(hex);
    layer('t_sand', paint((x, y) => {
      let c = palNoise(tsandPal, 8, 91)(x, y);
      c = shade(c, ruts(x, y, 92, 0.86));
      const rip = Math.sin((x * 0.3 + y + pn(x / 16, y / 16, 8, 3) * 12) / S * Math.PI * 2 * 14);
      if (rip > 0.8) c = shade(c, 0.92);
      return c;
    }));
    const mudPal = ['#3b281a', '#45301f', '#503824', '#5b4029', '#66492f', '#715336'].map(hex);
    layer('t_mud', paint((x, y) => {
      let c = palNoise(mudPal, 8, 101)(x, y);
      c = shade(c, ruts(x, y, 102, 0.8));
      const pud = fbmP(x / 24, y / 24, S / 24, 103, 3);
      if (pud > 0.66) c = mix(hex('#6d6a66'), hex('#8e8c88'), U.hash2(x, y, 104) > 0.8 ? 1 : 0.2);
      return c;
    }));
    const hardPal = ['#6f5e50', '#7a6857', '#84715f', '#8e7b68', '#998572', '#a3907c'].map(hex);
    layer('t_hard', paint((x, y) => {
      let c = palNoise(hardPal, 12, 111)(x, y);
      c = shade(c, ruts(x, y, 112, 0.9));
      if (U.hash2(x, y, 113) > 0.985) c = hex('#c1b5a5');
      return c;
    }));
    /* flat track clay: smooth, with a darker polished racing groove */
    const clayPal = ['#9a4f2c', '#a65732', '#b05f37', '#ba683d', '#c47244', '#cd7c4b'].map(hex);
    layer('t_clay', paint((x, y) => {
      let c = palNoise(clayPal, 14, 141)(x, y);
      const u = x / S;
      const groove = Math.abs(u - 0.38 - pn(y / 64, 0, 2, 142) * 0.08);
      if (groove < 0.12) c = shade(c, 0.86 + groove * 0.9);
      if (U.hash2(x, y, 143) > 0.993) c = hex('#e3a57a');
      return c;
    }));
    /* forest loam: dark soil with fallen leaves, roots and pebbles */
    const loamPal = ['#3e2c1d', '#463222', '#4f3926', '#58402b', '#614830', '#6b5036'].map(hex);
    layer('t_loam', paint((x, y) => {
      let c = palNoise(loamPal, 7, 151)(x, y);
      c = shade(c, ruts(x, y, 152, 0.84));
      const r = U.hash2(x, y, 153);
      if (r > 0.985) c = hex(['#c9822e', '#d9a441', '#9c5a25'][Math.floor(U.hash2(x, y, 154) * 3) % 3]);
      else if (r < 0.012) c = hex('#8a8178');
      const root = Math.abs(fbmP(x / 18, y / 18, S / 18, 155, 2) - 0.5);
      if (root < 0.012) c = hex('#2b1d12');
      return c;
    }));
    /* car cross gravel: grey stones over brown dirt with wheel ruts */
    const gravTrackPal = ['#7d7466', '#887e70', '#93897a', '#9e9484', '#aaa08f', '#b6ac9b'].map(hex);
    layer('t_gravel', paint((x, y) => {
      let c = palNoise(gravTrackPal, 6, 161)(x, y);
      const r = U.hash2(x, y, 162);
      if (r > 0.9) c = gravTrackPal[5]; else if (r < 0.08) c = hex('#6e5a44');
      const lane = Math.abs(((x / S) * 4 + pn(y / 32, x / 32, 4, 163) * 0.4) % 1 - 0.5);
      if (lane < 0.07) c = shade(hex('#7a6550'), 0.95);
      return c;
    }));
    const embPal = ['#6a4a2c', '#755233', '#805c39', '#8a6540', '#946f47', '#9e7a50'].map(hex);
    layer('embank', paint((x, y) => {
      let c = palNoise(embPal, 6, 121)(x, y);
      if (U.hash2(x, y, 122) > 0.97) c = hex('#4c7c31');
      if (U.hash2(x, y, 123) < 0.015) c = hex('#4b3420');
      return c;
    }));
    /* --- paths and roads --- */
    const pg = ['#a99f86', '#b4aa90', '#bdb39a', '#c6bca3', '#cfc5ad', '#d8cfb8'].map(hex);
    layer('p_gravel', paint((x, y) => pg[U.clamp(Math.floor(U.hash2(x, y, 131) * 6), 0, 5)]));
    layer('p_paved', paint((x, y) => {
      const bw = 16, bh = 8;
      const row = Math.floor(y / bh);
      const off = (row % 2) * (bw / 2);
      const bx = (x + off) % bw, by = y % bh;
      const id = Math.floor((x + off) / bw) + row * 31;
      const base = U.hash2(id, row, 132) > 0.5 ? hex('#b2a99c') : hex('#a39a8d');
      if (bx === 0 || by === 0) return hex('#7d766c');
      return shade(base, 0.94 + U.hash2(x, y, 133) * 0.1);
    }));
    layer('asphalt', paint((x, y) => {
      const r = U.hash2(x, y, 141);
      const n = fbmP(x / 16, y / 16, 8, 142, 2);
      const v = 70 + n * 18 + r * 14;
      return [v, v + 1, v + 6];
    }));
    layer('concrete', paint((x, y) => {
      const r = U.hash2(x, y, 151);
      const n = fbmP(x / 20, y / 20, S / 20, 152, 3);
      let v = 168 + n * 22 + r * 10;
      if (x % 64 === 0 || y % 64 === 0) v -= 30;
      return [v, v - 3, v - 8];
    }));
    layer('wood', paint((x, y) => {
      const pw = 10;
      const plank = Math.floor(x / pw);
      const base = hex(['#9b6a3c', '#a77544', '#8f6136', '#b07d4b'][plank % 4]);
      const grain = Math.sin(y * 0.4 + plank * 3 + pn(x / 8, y / 32, 16, 160) * 6) * 0.5 + 0.5;
      let c = shade(base, 0.9 + grain * 0.15);
      if (x % pw === 0) c = hex('#5e3e21');
      if (U.hash2(plank, Math.floor(y / 40), 161) > 0.85 && (y % 40) === 20 && x % pw === 3) c = hex('#4a301a');
      return c;
    }));
    layer('metal', paint((x, y) => {
      const rib = x % 8;
      const v = rib === 0 ? 150 : rib === 1 ? 232 : rib < 4 ? 214 : 200;
      const n = (U.hash2(x, y, 171) - 0.5) * 8;
      return [v + n, v + n + 2, v + n + 6];
    }));
    layer('brick', paint((x, y) => {
      const bw = 16, bh = 8;
      const row = Math.floor(y / bh), off = (row % 2) * 8;
      const bx = (x + off) % bw, by = y % bh;
      if (bx === 0 || by === 0) return hex('#cdbfa8');
      const id = Math.floor((x + off) / bw) * 7 + row * 13;
      const base = hex(['#a85a35', '#b4643b', '#9c5231', '#b86c42'][id % 4]);
      return shade(base, 0.92 + U.hash2(x, y, 181) * 0.12);
    }));
    layer('tiles', paint((x, y) => {
      const rh = 8;
      const row = Math.floor(y / rh), off = (row % 2) * 6;
      const tx = (x + off) % 12, ty = y % rh;
      let c = hex(['#a8462f', '#b54f35', '#9b3f2a'][(Math.floor((x + off) / 12) + row) % 3]);
      if (ty === rh - 1) c = hex('#6e2a1c');
      else if (tx === 0) c = shade(c, 0.8);
      else if (ty < 2) c = shade(c, 1.12);
      return c;
    }));
    layer('roofmetal', paint((x, y) => {
      const rib = y % 10;
      const v = rib === 0 ? 120 : rib === 1 ? 196 : rib < 5 ? 168 : 154;
      return [v, v + 3, v + 8];
    }));
    layer('stripes', paint((x, y) => (Math.floor(x / 12) % 2 === 0 ? [250, 250, 250] : [200, 200, 205])));
    layer('seats', paint((x, y) => {
      const rowH = 16;
      const ry = y % rowH;
      if (ry < 4) return [182, 180, 176];          // concrete step edge
      if (ry > 12) return [140, 138, 134];
      const sx = x % 8;
      if (sx === 0) return [120, 120, 125];
      return ry < 7 ? [240, 240, 245] : [215, 215, 222];  // seat (tinted by vertex colour)
    }));
    layer('fence', paint((x, y) => {
      const d1 = (x + y) % 8, d2 = (x - y + 128) % 8;
      if (d1 === 0 || d2 === 0) return [178, 182, 186, 255];
      if (y < 2 || y > S - 3) return [150, 154, 158, 255];
      return [0, 0, 0, 0];
    }));
    layer('rubber', paint((x, y) => {
      const t = (Math.floor(x / 4) + Math.floor(y / 4)) % 2;
      const v = t ? 44 : 34;
      return [v, v, v + 2];
    }));
    layer('hay', paint((x, y) => {
      const pal = ['#c9a54a', '#d4b154', '#ddbd5f', '#e7c96c', '#b8943f'].map(hex);
      const st = Math.floor((x * 0.7 + Math.sin(y * 0.5) * 2 + U.hash2(x >> 1, y, 201) * 3) % 5);
      return pal[U.clamp(st, 0, 4)];
    }));
    layer('checker', paint((x, y) => ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? [20, 20, 22] : [245, 245, 245])));
    layer('white', paint((x, y) => { const v = 236 + U.hash2(x, y, 211) * 14; return [v, v, v]; }));
    layer('glass', paint((x, y) => {
      const t = (x + y) % 48;
      if (t < 6) return [214, 232, 240];
      return [92 + y * 0.2, 128 + y * 0.2, 150 + y * 0.15];
    }));
    layer('foliage', paint(palNoise(['#2e5e22', '#376b27', '#41782c', '#4c8532', '#5a933a', '#6aa244'].map(hex), 5, 221)));
    layer('bark', paint((x, y) => {
      const v = Math.sin(x * 0.9 + pn(x / 8, y / 16, 16, 231) * 5) * 0.5 + 0.5;
      return shade(hex('#6b4a2e'), 0.75 + v * 0.35);
    }));
    layer('roller', paint((x, y) => {
      const r = y % 6;
      const v = r === 0 ? 110 : r === 1 ? 205 : 172;
      return [v, v + 2, v + 6];
    }));
    layer('tent', paint((x, y) => {
      let v = 238;
      if (x % 32 === 0) v = 205;
      return [v, v, v - 4];
    }));
    layer('paddockfloor', paint((x, y) => {
      const pal = ['#8a7a62', '#94846b', '#9e8e75', '#a8987f', '#7f705a'].map(hex);
      let c = pal[U.clamp(Math.floor(fbmP(x / 6, y / 6, S / 6, 241, 2) * 3.5 + U.hash2(x, y, 242) * 1.5), 0, 4)];
      return c;
    }));
    layer('strata', paint((x, y) => {
      const band = Math.floor((y + pn(x / 16, 0, 8, 251) * 8) / 10) % 4;
      const base = hex(['#6b4a2e', '#7d5a37', '#5e4128', '#8a6a49'][band]);
      return shade(base, 0.9 + U.hash2(x, y, 252) * 0.15);
    }));
    layer('grass_edge', paint((x, y) => {
      /* grass top band fading into dirt: used on embankment rims and terrain skirt tops */
      const g = palNoise(grassPal, 10, 261)(x, y);
      const d = palNoise(embPal, 6, 262)(x, y);
      const t = y + U.hash2(x, 0, 263) * 10;
      return t < 14 ? g : d;
    }));
    layer('track_tape', paint((x, y) => (Math.floor((x + y) / 16) % 2 ? [235, 60, 40] : [245, 245, 245])));
    layer('carbon', paint((x, y) => { const v = ((x >> 1) + (y >> 1)) % 2 ? 46 : 38; return [v, v, v + 4]; }));
    layer('screen', paint((x, y) => {
      if (y % 3 === 0) return [20, 30, 40];
      return [40 + (x % 3) * 30, 70, 110];
    }));
    layer('water_bottom', paint((x, y) => shade(hex('#5d7a63'), 0.85 + U.hash2(x, y, 271) * 0.2)));
  }

  /* ---------------- atlas ---------------- */
  const ATLAS = 1024;
  let atlasCanvas = null, actx = null;
  const regions = {};
  let shelfX = 0, shelfY = 0, shelfH = 0;
  function region(name, w, h, draw) {
    if (shelfX + w + 2 > ATLAS) { shelfX = 0; shelfY += shelfH + 2; shelfH = 0; }
    const x = shelfX, y = shelfY;
    shelfX += w + 2; shelfH = Math.max(shelfH, h);
    actx.save(); actx.translate(x, y);
    actx.beginPath(); actx.rect(0, 0, w, h); actx.clip();
    draw(actx, w, h);
    actx.restore();
    regions[name] = { x, y, w, h, uv: [(x + 0.01) / ATLAS, (y + 0.01) / ATLAS, (x + w - 0.01) / ATLAS, (y + h - 0.01) / ATLAS] };
    return regions[name];
  }
  const FONT = '"Saira Condensed", "Arial Narrow", "Roboto Condensed", Arial, sans-serif';
  function signPlate(text, bg, fg, opts) {
    opts = opts || {};
    return (c, w, h) => {
      c.fillStyle = opts.border || '#1b1b1b'; c.fillRect(0, 0, w, h);
      c.fillStyle = bg; c.fillRect(1, 1, w - 2, h - 2);
      if (opts.stripe) { c.fillStyle = opts.stripe; c.fillRect(1, h - 4, w - 2, 3); }
      c.fillStyle = fg;
      c.font = (opts.weight || '800') + ' ' + (opts.size || Math.floor(h * 0.72)) + 'px ' + FONT;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, w / 2, h / 2 + 1, w - 4);
    };
  }
  function buildAtlas(parkName) {
    atlasCanvas = makeCanvas(ATLAS, ATLAS);
    actx = atlasCanvas.getContext('2d');
    actx.imageSmoothingEnabled = false;
    shelfX = 0; shelfY = 0; shelfH = 0;
    const signs = [
      ['sign_taquilla', 'TAQUILLA', '#ffd22e', '#1d1d1d'], ['sign_taller', 'TALLER', '#e8e8e8', '#c62828'],
      ['sign_bar', 'BAR', '#2e7d32', '#ffffff'], ['sign_food', 'FOOD', '#ff6a13', '#ffffff'],
      ['sign_wc', 'WC', '#1565c0', '#ffffff'], ['sign_duchas', 'DUCHAS', '#0288d1', '#ffffff'],
      ['sign_merch', 'MERCH', '#151515', '#ffd22e'], ['sign_oficina', 'OFICINA', '#455a64', '#ffffff'],
      ['sign_paddock', 'PADDOCK', '#ff6a13', '#151515'], ['sign_escuela', 'ESCUELA MX', '#fdd835', '#1a237e'],
      ['sign_control', 'RACE CONTROL', '#151515', '#ffffff'], ['sign_mant', 'MANTENIMIENTO', '#f9a825', '#1d1d1d'],
      ['sign_camping', 'CAMPING', '#33691e', '#ffffff'], ['sign_boxes', 'BOXES', '#212121', '#ff6a13'],
      ['sign_salida', 'SALIDA', '#151515', '#ffffff'], ['sign_podio', 'PODIO', '#151515', '#ffd22e'],
      ['sign_restaurante', 'RESTAURANTE', '#5d4037', '#ffe0b2'], ['sign_tienda', 'TIENDA OFICIAL', '#151515', '#ff6a13'],
      ['sign_recambios', 'RECAMBIOS', '#c62828', '#ffffff'], ['sign_lavadero', 'LAVADERO', '#0277bd', '#ffffff'],
      ['sign_alquiler', 'ALQUILER', '#2e7d32', '#ffffff'], ['sign_infantil', 'ZONA INFANTIL', '#fdd835', '#e53935'],
      ['sign_crono', 'CRONO', '#151515', '#ffd22e'], ['sign_sx', 'SUPERCROSS', '#311b92', '#ffffff']
    ];
    for (const s of signs) region(s[0], 64, 14, signPlate(s[1], s[2], s[3]));
    region('sign_meta', 96, 20, (c, w, h) => {
      for (let i = 0; i < w; i += 5) for (let j = 0; j < 4; j++) { c.fillStyle = ((i / 5 + j) % 2) ? '#111' : '#fff'; c.fillRect(i, j * 5 / 4 * 1, 5, 1.25); }
      c.fillStyle = '#151515'; c.fillRect(0, 5, w, h - 10);
      c.fillStyle = '#ffffff'; c.font = '800 12px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('META', w / 2, h / 2 + 1);
      for (let i = 0; i < w; i += 5) for (let j = 0; j < 4; j++) { c.fillStyle = ((i / 5 + j) % 2) ? '#fff' : '#111'; c.fillRect(i, h - 5 + j * 1.25, 5, 1.25); }
    });
    region('sign_medico', 16, 16, (c, w, h) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d32f2f'; c.fillRect(6, 2, 4, 12); c.fillRect(2, 6, 12, 4);
    });
    region('sign_parking', 16, 16, (c, w, h) => {
      c.fillStyle = '#1565c0'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff';
      c.font = '800 14px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', w / 2, h / 2 + 1);
    });
    region('park_name', 160, 22, signPlate((parkName || 'MX PARK').toUpperCase(), '#151515', '#ffd22e', { stripe: '#ff6a13', size: 15 }));
    /* sponsor logos */
    for (const sp of MX.Catalog.sponsors) {
      region('logo_' + sp.id, 64, 20, (c, w, h) => {
        c.fillStyle = sp.c1; c.fillRect(0, 0, w, h);
        c.fillStyle = sp.c2; c.fillRect(0, h - 3, w, 3);
        c.font = 'italic 800 13px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = sp.c2; c.fillText(sp.name.toUpperCase(), w / 2, h / 2, w - 4);
      });
    }
    region('logo_mxt', 64, 20, (c, w, h) => {
      c.fillStyle = '#151515'; c.fillRect(0, 0, w, h);
      c.font = 'italic 800 13px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ff6a13'; c.fillText('MX TYCOON', w / 2, h / 2, w - 4);
    });
    /* windows and doors (8 texels per metre) */
    region('win', 12, 10, (c, w, h) => {
      c.fillStyle = '#eceae4'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3c5a6e'; c.fillRect(1, 1, w - 2, h - 2);
      c.fillStyle = '#6f93aa'; c.fillRect(2, 2, 3, 3);
      c.fillStyle = '#9fc2d4'; c.fillRect(2, 2, 1, 1);
      c.fillStyle = '#eceae4'; c.fillRect(w / 2, 1, 1, h - 2);
    });
    region('win_wide', 32, 10, (c, w, h) => {
      c.fillStyle = '#3a3a3a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#4a6b80'; c.fillRect(1, 1, w - 2, h - 2);
      c.fillStyle = '#7ea3b8'; for (let i = 3; i < w; i += 9) c.fillRect(i, 2, 2, 2);
      c.fillStyle = '#3a3a3a'; for (let i = 8; i < w; i += 8) c.fillRect(i, 1, 1, h - 2);
    });
    region('door', 8, 16, (c, w, h) => {
      c.fillStyle = '#2b2b2b'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#6d4a2b'; c.fillRect(1, 1, w - 2, h - 1);
      c.fillStyle = '#5a3c22'; c.fillRect(2, 3, w - 4, 4); c.fillRect(2, 9, w - 4, 5);
      c.fillStyle = '#d4b04a'; c.fillRect(w - 3, 8, 1, 1);
    });
    region('door_glass', 10, 16, (c, w, h) => {
      c.fillStyle = '#2f2f2f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#5c7f94'; c.fillRect(1, 1, w - 2, h - 1);
      c.fillStyle = '#9fc2d4'; c.fillRect(2, 2, 2, 4);
    });
    region('counter', 16, 8, (c, w, h) => {
      c.fillStyle = '#2a2a2a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffe9a8'; c.fillRect(1, 1, w - 2, h - 3);
      c.fillStyle = '#8a5a2c'; c.fillRect(0, h - 2, w, 2);
      c.fillStyle = '#c0392b'; c.fillRect(3, 2, 2, 2); c.fillStyle = '#f1c40f'; c.fillRect(8, 2, 3, 2);
    });
    region('menu', 12, 10, (c, w, h) => {
      c.fillStyle = '#222'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f5f5f5'; for (let i = 2; i < h - 1; i += 2) c.fillRect(2, i, 4 + (i * 3) % 5, 1);
      c.fillStyle = '#ffd22e'; c.fillRect(w - 3, 2, 2, 6);
    });
    region('tshirts', 24, 10, (c, w, h) => {
      c.fillStyle = '#3b3b3b'; c.fillRect(0, 0, w, h);
      const cols = ['#ff6a13', '#1565c0', '#ffd22e', '#c62828'];
      for (let i = 0; i < 4; i++) {
        c.fillStyle = cols[i]; const x = 1 + i * 6;
        c.fillRect(x, 2, 5, 2); c.fillRect(x + 1, 4, 3, 5);
      }
    });
    for (let p = 1; p <= 3; p++) region('podium_' + p, 16, 12, signPlate(String(p), p === 1 ? '#f9c934' : p === 2 ? '#cfd8dc' : '#cd8a4b', '#151515'));
    region('ring', 32, 32, (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 3;
      c.beginPath(); c.arc(16, 16, 13, 0, Math.PI * 2); c.stroke();
    });
    /* particles (dither handled in shader, alpha = coverage) */
    region('p_dust', 16, 16, (c) => {
      const g = c.createRadialGradient(8, 8, 1, 8, 8, 8);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 16, 16);
    });
    region('p_drop', 4, 16, (c) => { c.fillStyle = 'rgba(255,255,255,1)'; c.fillRect(1, 0, 2, 16); });
    region('p_square', 8, 8, (c) => { c.fillStyle = '#fff'; c.fillRect(1, 1, 6, 6); });
    region('icon_warn', 16, 16, (c) => {
      c.fillStyle = '#151515'; c.beginPath(); c.moveTo(8, 0); c.lineTo(16, 15); c.lineTo(0, 15); c.fill();
      c.fillStyle = '#ffd22e'; c.beginPath(); c.moveTo(8, 2); c.lineTo(14.2, 14); c.lineTo(1.8, 14); c.fill();
      c.fillStyle = '#151515'; c.fillRect(7, 5, 2, 5); c.fillRect(7, 11, 2, 2);
    });
    region('icon_money', 16, 16, (c) => {
      c.fillStyle = '#1b5e20'; c.beginPath(); c.arc(8, 8, 7.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#66bb6a'; c.beginPath(); c.arc(8, 8, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.font = '800 11px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('€', 8, 9);
    });
    region('icon_zzz', 16, 16, (c) => {
      c.fillStyle = '#fff'; c.font = '800 10px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 8, 8);
    });
    return atlasCanvas;
  }
  function redrawParkName(gl, tex, name) {
    const r = regions.park_name;
    if (!r || !atlasCanvas) return;
    actx.save(); actx.translate(r.x, r.y);
    actx.clearRect(0, 0, r.w, r.h);
    signPlate((name || 'MX PARK').toUpperCase(), '#151515', '#ffd22e', { stripe: '#ff6a13', size: 15 })(actx, r.w, r.h);
    actx.restore();
    if (gl && tex) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    }
  }

  function uploadMaterials(gl) {
    buildMaterials();
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, SIZE, SIZE, layers.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const tmp = makeCanvas(SIZE, SIZE);
    const tctx = tmp.getContext('2d');
    for (let i = 0; i < layers.length; i++) {
      const d = layers[i].getContext('2d').getImageData(0, 0, SIZE, SIZE);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, SIZE, SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, d.data);
    }
    void tctx;
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }
  /* Average colour per layer, used by the minimap and UI swatches. */
  function layerColor(name) {
    buildMaterials();
    const c = layers[L[name]];
    const d = c.getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return [r / n, g / n, b / n];
  }

  MX.Tex = { L, layers, SIZE, buildMaterials, uploadMaterials, buildAtlas, regions, ATLAS, redrawParkName, layerColor, makeCanvas, get atlasCanvas() { return atlasCanvas; } };
})(window.MX);
