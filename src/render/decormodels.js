/* MX Tycoon - models of the themed decoration packs (Mad Max, desert, surf, farm, MX
   world championship and festival). Each one fits in a tile (about 3.8 m across),
   faces +X with its origin on the ground, and is merged into the scenery mesh by
   BuildModels.decor with the object's position and rotation already applied. */
(function (MX) {
  'use strict';
  const MB = MX.MeshBuilder;
  const SOLID = MB.MAT_SOLID, ATL = MB.MAT_ATLAS;
  const C = (h) => MB.rgba(h);
  /* vertex alpha 2: the mesh shader leaves these parts unlit (flames, bulbs) */
  const GLOW = (h) => { const c = MB.rgba(h); c[3] = 2; return c; };
  const shade = (c, k) => MB.mulCol(c, k);
  const G = () => MX.Models.geo;
  const hash = (a, b) => MX.U.hash2(a, b, 17);

  /* a sign from the texture atlas on a vertical plane facing +Z (or -Z when back) */
  function sign(mb, name, x0, y0, x1, y1, z, back) {
    const r = MX.Tex.regions[name];
    if (!r) return;
    const d = back ? -0.02 : 0.02;
    if (!back) mb.quad([x0, y0, z + d], [x1, y0, z + d], [x1, y1, z + d], [x0, y1, z + d], r.uv, ATL, [1, 1, 1, 1]);
    else mb.quad([x1, y0, z + d], [x0, y0, z + d], [x0, y1, z + d], [x1, y1, z + d], r.uv, ATL, [1, 1, 1, 1]);
  }
  /* flag cloth in the X-Y plane with horizontal or vertical stripes, seen from both sides
     (the renderer draws both faces of every triangle, so the two sides sit 2 cm apart) */
  function flag(mb, x0, y0, w, h, cols, vertical) {
    const n = cols.length;
    for (let i = 0; i < n; i++) {
      const a = vertical ? [x0 + w * i / n, y0, x0 + w * (i + 1) / n, y0 + h] : [x0, y0 + h * (n - 1 - i) / n, x0 + w, y0 + h * (n - i) / n];
      const c = C(cols[i]);
      mb.quad([a[0], a[1], 0.01], [a[2], a[1], 0.01], [a[2], a[3], 0.01], [a[0], a[3], 0.01], null, SOLID, c);
      mb.quad([a[2], a[1], -0.01], [a[0], a[1], -0.01], [a[0], a[3], -0.01], [a[2], a[3], -0.01], null, SOLID, shade(c, 0.85));
    }
  }
  /* cone made of alternating coloured gores (umbrellas, tents) */
  function striped(mb, cx, y0, cz, r, h, n, ca, cb) {
    const top = [cx, y0 + h, cz];
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const c = C(i % 2 ? cb : ca), dn = (p) => [p[0], p[1] - 0.03, p[2]];
      mb.tri(p1, p0, top, null, SOLID, c);
      mb.tri(dn(p0), dn(p1), dn(top), null, SOLID, shade(c, 0.7));
    }
  }
  /* plain wheel of a parked vehicle (tyre, rim and hub) with its axle along Z at (x, y, z) */
  function wheelAt(mb, x, y, z, R, w, rim) {
    const g = G(), hw = w / 2;
    g.limb(mb, [x, y, z - hw], [x, y, z + hw], R, R, C('#1c1c1d'), 12);
    g.limb(mb, [x, y, z - hw - 0.01], [x, y, z + hw + 0.01], R * 0.6, R * 0.6, C(rim || '#9aa0a6'), 8);
    g.limb(mb, [x, y, z - hw - 0.03], [x, y, z + hw + 0.03], R * 0.2, R * 0.2, C('#c3c7cc'), 6);
  }

  const M = {};
  /* ---------------- Mad Max ---------------- */
  M.mm_wreck = (mb, o) => {
    const g = G(), rust = C(['#8d4a24', '#7a5230', '#6d3b1f', '#8a5a2b'][o.v % 4]), dark = shade(rust, 0.7);
    mb.push(); mb.rotateZ(-0.05); mb.rotateX(0.07);
    g.slab(mb, [-1.75, 0.55, 0], [1.75, 0.55, 0], 0.78, 0.3, 0.75, 0.28, rust, [0, 0, 1]);
    g.slab(mb, [-0.75, 1.05, 0], [0.75, 1.0, 0], 0.66, 0.24, 0.62, 0.2, dark, [0, 0, 1]);
    for (const s of [-1, 1]) mb.quad([-0.6, 0.86, s * 0.67], [0.6, 0.86, s * 0.67], [0.55, 1.18, s * 0.63], [-0.55, 1.18, s * 0.63], null, SOLID, C('#1e2326'));
    for (const [x, z] of [[1.05, 0.8], [-1.1, 0.8], [-1.1, -0.8]]) wheelAt(mb, x, 0.32, z, 0.32, 0.22, '#5a4632');
    /* spikes on the bonnet and the roof */
    for (let i = 0; i < 5; i++) g.limb(mb, [1.2 + (i % 2) * 0.25, 0.85, -0.5 + i * 0.25], [1.75 + (i % 2) * 0.2, 1.05, -0.5 + i * 0.25], 0.05, 0.004, C('#8f8f8f'), 5);
    for (let i = 0; i < 3; i++) g.limb(mb, [-0.3 + i * 0.3, 1.22, 0], [-0.3 + i * 0.3, 1.6, 0.05], 0.05, 0.004, C('#8f8f8f'), 5);
    mb.pop();
    G().limb(mb, [1.55, 0, -1.35], [1.55, 0.22, -1.35], 0.32, 0.32, C('#1c1c1d'), 12);
    G().limb(mb, [1.55, 0.2, -1.35], [1.55, 0.24, -1.35], 0.19, 0.19, C('#5a4632'), 8);
  };
  M.mm_barrels = (mb, o) => {
    const g = G();
    const spots = [[-0.6, -0.35, 0.9, true], [0.45, 0.25, 0.9, true], [-0.15, 0.85, 0.9, false], [0.95, -0.7, 0.55, false]];
    spots.forEach(([x, z, hgt, fire], i) => {
      const c = C(['#6d3b1f', '#4e5a63', '#7a2f1d', '#5b5b2f'][(i + o.v) % 4]);
      if (hgt < 0.8) { mb.push(); mb.translate(x, 0.3, z); mb.rotateZ(Math.PI / 2); g.limb(mb, [0, -0.45, 0], [0, 0.45, 0], 0.3, 0.3, c, 10); mb.pop(); return; }
      g.limb(mb, [x, 0, z], [x, hgt, z], 0.3, 0.3, c, 10);
      for (const y of [0.25, 0.65]) g.limb(mb, [x, y - 0.03, z], [x, y + 0.03, z], 0.315, 0.315, shade(c, 0.7), 10, false);
      if (fire) {
        /* tongues of flame around the rim and a tall yellow core */
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * Math.PI * 2 + i, r = 0.15;
          mb.cone(x + Math.cos(a) * r, hgt, z + Math.sin(a) * r, 0.11, 0.4 + hash(k + i * 5, o.id) * 0.45, 4, GLOW(k % 2 ? '#ff3d00' : '#ff8f1a'), 0.3);
        }
        mb.cone(x, hgt, z, 0.16, 0.9 + hash(i, o.id) * 0.3, 5, GLOW('#ffd54f'), 0.2);
      }
    });
  };
  M.mm_spikes = (mb) => {
    const g = G(), wood = C('#5d4632'), metal = C('#9a9a9a');
    for (const x of [-1.3, 0, 1.3]) {
      g.slab(mb, [x - 0.55, 0, 0], [x + 0.55, 1.3, 0], 0.07, 0.07, 0.06, 0.06, wood);
      g.slab(mb, [x + 0.55, 0, 0], [x - 0.55, 1.3, 0], 0.07, 0.07, 0.06, 0.06, wood);
      g.limb(mb, [x - 0.55, 1.3, 0], [x - 0.75, 1.62, 0], 0.07, 0.01, wood, 5);
      g.limb(mb, [x + 0.55, 1.3, 0], [x + 0.75, 1.62, 0], 0.07, 0.01, wood, 5);
    }
    g.slab(mb, [-1.9, 0.66, 0], [1.9, 0.66, 0], 0.06, 0.08, 0.06, 0.08, shade(wood, 0.85), [0, 0, 1]);
    for (let i = 0; i < 9; i++) for (const s of [-1, 1]) g.limb(mb, [-1.7 + i * 0.42, 0.66, s * 0.05], [-1.7 + i * 0.42, 0.75, s * 0.55], 0.04, 0.003, metal, 4);
  };
  M.mm_tower = (mb, o) => {
    const g = G(), steel = C('#5f5a55'), rust = C('#8a4b26'), sheet = C('#7d6a58');
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.limb(mb, [sx * 1.3, 0, sz * 1.3], [sx * 1.0, 3.2, sz * 1.0], 0.08, 0.07, steel, 5);
    for (const y of [1.1, 2.2]) for (const [a, b] of [[[-1.25, -1.25], [1.25, -1.25]], [[-1.25, 1.25], [1.25, 1.25]], [[-1.25, -1.25], [-1.25, 1.25]], [[1.25, -1.25], [1.25, 1.25]]]) g.limb(mb, [a[0] * (1 - y * 0.07), y, a[1] * (1 - y * 0.07)], [b[0] * (1 - y * 0.07), y, b[1] * (1 - y * 0.07)], 0.045, 0.045, rust, 4);
    mb.box(-1.15, 3.2, -1.15, 1.15, 3.35, 1.15, { col: sheet });
    for (const [x0, z0, x1, z1] of [[-1.15, -1.15, 1.15, -1.15], [1.15, 1.15, -1.15, 1.15], [-1.15, 1.15, -1.15, -1.15]]) {
      mb.quad([x0, 3.35, z0], [x1, 3.35, z1], [x1, 4.3, z1], [x0, 4.3, z0], null, SOLID, (x0 === x1) ? rust : sheet);
      const k = 0.97;
      mb.quad([x1 * k, 3.35, z1 * k], [x0 * k, 3.35, z0 * k], [x0 * k, 4.3, z0 * k], [x1 * k, 4.3, z1 * k], null, SOLID, shade(sheet, 0.8));
    }
    mb.shed(-1.3, -1.3, 1.3, 1.3, 4.9, 5.4, null, C('#6b5e52'), 0.15);
    for (const [x, z] of [[1.1, -1.1], [1.1, 1.1], [-1.1, -1.1], [-1.1, 1.1]]) g.limb(mb, [x, 4.3, z], [x, 4.9, z], 0.05, 0.05, steel, 4);
    /* ladder and a tattered flag */
    for (const s of [-1, 1]) g.limb(mb, [1.55, 0, s * 0.25], [1.2, 3.3, s * 0.25], 0.035, 0.035, steel, 4);
    for (let k = 1; k < 9; k++) { const t = k / 9; g.limb(mb, [1.55 - 0.35 * t, 3.3 * t, -0.25], [1.55 - 0.35 * t, 3.3 * t, 0.25], 0.025, 0.025, steel, 4); }
    g.limb(mb, [-1.1, 5.2, -1.1], [-1.1, 6.2, -1.1], 0.03, 0.03, steel, 4);
    mb.push(); mb.translate(-1.1, 5.65, -1.1);
    mb.quad([0, 0, 0.01], [0.9, -0.05, 0.01], [0.8, 0.45, 0.01], [0, 0.5, 0.01], null, SOLID, C(['#8b1a1a', '#202020', '#5d4037', '#b5651d'][o.v % 4]));
    mb.quad([0.9, -0.05, -0.01], [0, 0, -0.01], [0, 0.5, -0.01], [0.8, 0.45, -0.01], null, SOLID, C('#4a1010'));
    mb.pop();
    sign(mb, 'sign_peligro', -0.8, 3.6, 0.8, 3.95, 1.16);
  };
  M.mm_skull = (mb) => {
    const g = G(), bone = C('#e6dcc3'), dark = C('#2a2420');
    for (let i = 0; i < 5; i++) mb.blob(-0.5 + (i % 3) * 0.5, 0.2, -0.3 + (i % 2) * 0.6, 0.45, 0.32, 0.4, C('#7b6e62'), i + 3, 0.3);
    g.limb(mb, [-0.5, 0.3, 0.5], [0.4, 0.3, 0.5], 0.33, 0.33, C('#1d1d1d'), 10);
    g.limb(mb, [0, 0, 0], [0, 2.8, 0], 0.08, 0.06, C('#5d4632'), 6);
    g.ellipsoid(mb, [0.05, 2.95, 0], 0.32, 0.3, 0.27, bone, 9, 6);
    g.slab(mb, [0.18, 2.72, 0], [0.32, 2.62, 0], 0.17, 0.08, 0.13, 0.06, bone);
    for (const s of [-1, 1]) {
      g.ellipsoid(mb, [0.3, 3.0, s * 0.11], 0.05, 0.08, 0.07, dark, 6, 4);
      g.tube(mb, [[0.0, 3.05, s * 0.25, 0.08], [0.0, 3.2, s * 0.55, 0.06], [0.1, 3.5, s * 0.72, 0.03], [0.22, 3.62, s * 0.7, 0.01]], C('#d8c9a8'), 6);
    }
    g.ellipsoid(mb, [0.34, 2.86, 0], 0.03, 0.05, 0.03, dark, 5, 3);
  };
  M.mm_rig = (mb, o) => {
    const g = G(), paint = C(['#3b3b3b', '#5a4a3a', '#2f3b2f', '#4a2f2a'][o.v % 4]), rust = C('#8a4b26'), steel = C('#8f8f8f');
    g.slab(mb, [-1.9, 0.75, 0], [1.4, 0.75, 0], 0.85, 0.15, 0.85, 0.15, C('#2a2a2a'));
    for (const [x, z] of [[1.15, 0.92], [1.15, -0.92], [-0.6, 0.92], [-0.6, -0.92], [-1.45, 0.92], [-1.45, -0.92]]) wheelAt(mb, x, 0.55, z, 0.55, 0.36, '#4a4a4a');
    mb.box(-0.2, 0.9, -0.9, 0.9, 2.5, 0.9, { col: paint });
    mb.quad([0.9, 1.75, -0.8], [0.9, 1.75, 0.8], [0.9, 2.35, 0.8], [0.9, 2.35, -0.8], null, SOLID, C('#1a2024'));
    mb.box(0.9, 0.9, -0.75, 1.75, 1.75, 0.75, { col: shade(paint, 1.1) });
    mb.box(-1.9, 0.9, -0.85, -0.25, 1.4, 0.85, { col: rust });
    /* spiked grille, bull bar and exhaust stacks */
    for (let i = 0; i < 7; i++) g.limb(mb, [1.78, 0.95 + (i % 2) * 0.35, -0.7 + i * 0.23], [2.05, 0.95 + (i % 2) * 0.35, -0.7 + i * 0.23], 0.05, 0.004, steel, 4);
    g.slab(mb, [1.8, 0.75, -0.85], [1.8, 0.75, 0.85], 0.08, 0.12, 0.08, 0.12, steel, [1, 0, 0]);
    for (const s of [-1, 1]) {
      g.limb(mb, [-0.1, 0.9, s * 0.95], [-0.1, 3.3, s * 0.95], 0.09, 0.08, C('#a5866a'), 8);
      g.limb(mb, [-0.1, 3.3, s * 0.95], [-0.1, 3.4, s * 0.95], 0.085, 0.085, C('#151515'), 8);
    }
  };

  /* ---------------- desert ---------------- */
  const cactus = C('#5f9445');
  M.ds_saguaro = (mb, o) => {
    const g = G(), H = 3.2 + (o.v % 3) * 0.3;
    mb.blob(0, 0.05, 0, 0.7, 0.18, 0.7, C('#c9a26b'), o.id, 0.2);
    g.limb(mb, [0, 0, 0], [0, H, 0], 0.3, 0.26, cactus, 10);
    g.ellipsoid(mb, [0, H, 0], 0.26, 0.24, 0.26, cactus, 10, 5);
    const arm = (y, s, out, up) => {
      g.limb(mb, [0, y, 0], [0, y + 0.18, s * out], 0.18, 0.17, cactus, 8);
      g.limb(mb, [0, y + 0.18, s * out], [0, y + 0.18 + up, s * out], 0.17, 0.15, cactus, 8);
      g.ellipsoid(mb, [0, y + 0.18 + up, s * out], 0.15, 0.14, 0.15, cactus, 8, 4);
      g.ellipsoid(mb, [0, y + 0.18, s * out], 0.18, 0.18, 0.18, cactus, 8, 4);
    };
    arm(1.3, -1, 0.62, 1.0);
    arm(1.9, 1, 0.55, 0.8 + (o.v % 2) * 0.3);
    for (let i = 0; i < 4; i++) g.limb(mb, [0.27, 0.4 + i * 0.7, 0], [0.31, 0.5 + i * 0.7, 0], 0.01, 0.002, C('#e8e2c0'), 3);
  };
  M.ds_pear = (mb, o) => {
    const g = G(), pad = C('#79b04a');
    mb.blob(0, 0.05, 0, 0.9, 0.12, 0.8, C('#b89462'), o.id, 0.2);
    const pads = [[0, 0.4, 0, 0], [0.3, 0.9, 0.1, 0.4], [-0.3, 0.95, -0.1, -0.5], [0.05, 1.35, 0.05, 0.15], [0.65, 0.4, 0.5, 0.8], [-0.7, 0.4, -0.45, -0.9], [0.7, 0.95, 0.55, 0.2], [-0.55, 0.9, 0.55, 1.2], [0.1, 0.45, -0.7, 2.0]];
    pads.forEach(([x, y, z, a], i) => {
      mb.push(); mb.translate(x, y, z); mb.rotateY(a + i); mb.rotateZ((i % 2 ? 0.3 : -0.25));
      g.ellipsoid(mb, [0, 0, 0], 0.34, 0.4, 0.08, i % 3 ? pad : shade(pad, 1.12), 8, 4);
      if (i % 2) for (const sx of [-0.12, 0.14]) g.ellipsoid(mb, [sx, 0.4, 0], 0.07, 0.08, 0.07, C('#d81b60'), 5, 3);
      mb.pop();
    });
  };
  M.ds_arch = (mb, o) => {
    const sand = C('#c98f5b'), dark = C('#a96d43'), light = C('#d9a86e');
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) mb.blob(s * (1.25 - k * 0.04), 0.4 + k * 0.72, 0, 0.55 - k * 0.04, 0.48, 0.62, k % 2 ? dark : sand, o.id + k * 7 + s, 0.14);
    for (let k = 0; k < 5; k++) mb.blob(-1.1 + k * 0.55, 3.15 + Math.sin(k) * 0.08, 0, 0.42, 0.36, 0.55, k % 2 ? light : sand, o.id + 40 + k, 0.15);
    for (let k = 0; k < 3; k++) mb.blob(-1.6 + k * 1.4, 0.15, (k - 1) * 0.6, 0.4, 0.2, 0.35, dark, o.id + 80 + k, 0.3);
  };
  M.ds_skull = (mb, o) => {
    const g = G(), bone = C('#e9dfc8'), dark = C('#2a2420');
    mb.blob(0.7, 0.2, -0.5, 0.45, 0.3, 0.4, C('#9c7b58'), o.id, 0.3);
    mb.push(); mb.rotateY(0.4 + o.v); mb.scale(1.5);
    g.ellipsoid(mb, [0, 0.16, 0], 0.32, 0.15, 0.2, bone, 8, 5);
    g.slab(mb, [0.2, 0.12, 0], [0.48, 0.08, 0], 0.11, 0.06, 0.07, 0.04, bone);
    for (const s of [-1, 1]) {
      g.ellipsoid(mb, [0.15, 0.22, s * 0.1], 0.05, 0.04, 0.05, dark, 5, 3);
      g.tube(mb, [[-0.05, 0.22, s * 0.16, 0.05], [-0.05, 0.3, s * 0.45, 0.04], [0.05, 0.45, s * 0.62, 0.02], [0.15, 0.52, s * 0.62, 0.005]], C('#d8c9a8'), 5);
    }
    mb.pop();
    for (let i = 0; i < 4; i++) mb.cone(-0.7 + i * 0.4, 0, 0.6 - (i % 2) * 0.3, 0.12, 0.45, 4, C('#c9b25e'), 0.3);
  };
  M.ds_windpump = (mb, o) => {
    const g = G(), steel = C('#9aa3a8'), blade = C('#cfd6da');
    const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [sx, sz] of legs) g.limb(mb, [sx * 0.95, 0, sz * 0.95], [sx * 0.2, 5.2, sz * 0.2], 0.05, 0.04, steel, 4);
    for (let k = 0; k < 4; k++) {
      const y0 = k * 1.3, y1 = y0 + 1.3, w0 = 0.95 - y0 * 0.144, w1 = 0.95 - y1 * 0.144;
      for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) g.limb(mb, [a[0] * w0, y0, a[1] * w0], [b[0] * w1, y1, b[1] * w1], 0.025, 0.025, steel, 4, false);
    }
    g.slab(mb, [-0.3, 5.25, 0], [0.4, 5.25, 0], 0.15, 0.12, 0.12, 0.1, C('#6f7a80'));
    mb.push(); mb.translate(0.45, 5.3, 0);
    g.limb(mb, [0, 0, 0], [0.1, 0, 0], 0.12, 0.12, steel, 8);
    const spin = (o.id % 12) * 0.26;
    for (let i = 0; i < 12; i++) {
      const a = spin + i / 12 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      g.slab(mb, [0.12, sn * 0.25, c * 0.25], [0.12, sn * 1.25, c * 1.25], 0.012, 0.09, 0.012, 0.16, i % 2 ? blade : shade(blade, 0.85), [1, 0, 0]);
    }
    mb.pop();
    g.slab(mb, [-0.3, 5.3, 0], [-1.6, 5.4, 0], 0.03, 0.05, 0.03, 0.05, steel);
    G().panel(mb, [[-1.3, 5.0], [-1.9, 5.15], [-1.9, 5.9], [-1.3, 5.75]], -0.02, 0.02, C('#c62828'));
    g.limb(mb, [1.2, 0, 1.1], [1.2, 0.8, 1.1], 0.6, 0.6, C('#7b8a8f'), 14);
    void o;
  };
  M.ds_tumble = (mb, o) => {
    const g = G(), twig = C('#c8a56a'), R = 0.7;
    const pt = (u, v) => [Math.cos(u) * Math.sin(v) * R, 0.66 + Math.cos(v) * R * 0.9, Math.sin(u) * Math.sin(v) * R];
    for (let i = 0; i < 26; i++) {
      const a = pt(hash(i, o.id) * 6.28, hash(i + 3, o.id) * 3.14), b = pt(hash(i + 7, o.id) * 6.28, hash(i + 9, o.id) * 3.14);
      g.limb(mb, a, b, 0.04, 0.03, i % 2 ? twig : shade(twig, 0.8), 3, false);
    }
  };

  /* ---------------- surf ---------------- */
  M.sf_palm = (mb, o) => {
    const g = G(), bark = C('#8d6e4a'), leaf = C('#3f8f3a'), lean = 0.5 + (o.v % 3) * 0.15;
    const pts = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([lean * t * t * 1.6, t * 5.2, 0, 0.2 - t * 0.07]); }
    g.tube(mb, pts, bark, 7);
    for (let k = 1; k < 6; k++) { const p = pts[k]; g.limb(mb, [p[0], p[1] - 0.04, 0], [p[0], p[1] + 0.04, 0], p[3] + 0.025, p[3] + 0.025, shade(bark, 0.8), 7, false); }
    const top = pts[6];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + o.v, ca = Math.cos(a), sa = Math.sin(a);
      const mid = [top[0] + ca * 0.9, top[1] + 0.25, sa * 0.9], tip = [top[0] + ca * 1.75, top[1] - 0.55, sa * 1.75];
      g.slab(mb, [top[0], top[1], 0], mid, 0.05, 0.02, 0.28, 0.02, i % 2 ? leaf : shade(leaf, 1.12), [-sa, 0, ca]);
      g.slab(mb, mid, tip, 0.28, 0.02, 0.05, 0.015, i % 2 ? shade(leaf, 0.9) : leaf, [-sa, 0, ca]);
    }
    for (let i = 0; i < 3; i++) g.ellipsoid(mb, [top[0] + Math.cos(i * 2.1) * 0.18, top[1] - 0.2, Math.sin(i * 2.1) * 0.18], 0.12, 0.13, 0.12, C('#5d4026'), 6, 4);
  };
  M.sf_boards = (mb, o) => {
    const g = G(), wood = C('#8d6e4a');
    for (const x of [-1.3, 1.3]) g.limb(mb, [x, 0, -0.4], [x, 1.6, -0.4], 0.06, 0.06, wood, 5);
    g.limb(mb, [-1.35, 1.5, -0.4], [1.35, 1.5, -0.4], 0.05, 0.05, wood, 5);
    const cols = ['#ff7043', '#29b6f6', '#ffd54f', '#66bb6a', '#ec407a', '#ffffff'];
    for (let i = 0; i < 4; i++) {
      const x = -0.95 + i * 0.63, c = C(cols[(i + o.v) % cols.length]);
      mb.push(); mb.translate(x, 1.12, -0.18); mb.rotateX(-0.22);
      g.ellipsoid(mb, [0, 0, 0], 0.26, 1.1, 0.05, c, 10, 6);
      g.slab(mb, [0, -0.95, 0.03], [0, 0.95, 0.03], 0.035, 0.01, 0.035, 0.01, C(cols[(i + o.v + 3) % cols.length]), [1, 0, 0]);
      mb.pop();
    }
  };
  M.sf_umbrella = (mb, o) => {
    const g = G(), cols = [['#e53935', '#ffffff'], ['#1e88e5', '#ffffff'], ['#fdd835', '#ff7043'], ['#43a047', '#ffffff']][o.v % 4];
    g.limb(mb, [0, 0, 0], [0.08, 2.3, 0], 0.035, 0.03, C('#dddddd'), 5);
    striped(mb, 0.08, 1.95, 0, 1.35, 0.55, 10, cols[0], cols[1]);
    for (const s of [-1, 1]) {
      mb.push(); mb.translate(0.2, 0, s * 1.0); mb.rotateY(s * 0.15);
      g.slab(mb, [-1.0, 0.32, 0], [0.4, 0.32, 0], 0.32, 0.03, 0.32, 0.03, C('#f5f5f5'));
      g.slab(mb, [0.4, 0.32, 0], [0.9, 0.7, 0], 0.32, 0.03, 0.32, 0.03, C('#f5f5f5'));
      g.slab(mb, [-0.9, 0.36, 0], [0.4, 0.36, 0], 0.27, 0.015, 0.27, 0.015, C(cols[0]));
      for (const x of [-0.9, 0.35]) for (const z of [-0.28, 0.28]) g.limb(mb, [x, 0, z], [x, 0.32, z], 0.025, 0.025, C('#cccccc'), 4);
      mb.pop();
    }
  };
  M.sf_lifeguard = (mb, o) => {
    const g = G(), wood = C('#f5f5f5'), red = C('#e53935');
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) g.limb(mb, [x * 1.15, 0, z * 1.15], [x, 2.0, z], 0.07, 0.07, C('#e0e0e0'), 5);
    mb.box(-1.05, 2.0, -1.05, 1.05, 2.15, 1.05, { col: C('#bdbdbd') });
    mb.box(-0.8, 2.15, -0.8, 0.8, 3.3, 0.8, { col: red });
    mb.box(-0.82, 2.15, -0.3, 0.82, 3.3, 0.3, { col: wood });
    mb.quad([0.81, 2.7, -0.6], [0.81, 2.7, 0.6], [0.81, 3.15, 0.6], [0.81, 3.15, -0.6], null, SOLID, C('#263238'));
    mb.gable(-0.95, -0.95, 0.95, 0.95, 3.3, 3.85, 'z', null, C('#ffffff'), red, 0.15);
    g.slab(mb, [2.0, 0, 0], [1.05, 2.05, 0], 0.4, 0.04, 0.4, 0.04, C('#d7ccc8'));
    g.limb(mb, [-1.0, 2.15, 1.0], [-1.0, 4.4, 1.0], 0.03, 0.03, C('#dddddd'), 4);
    mb.push(); mb.translate(-1.0, 3.9, 1.0); flag(mb, 0, 0, 0.75, 0.45, ['#e53935']); mb.pop();
    mb.push(); mb.translate(0.9, 2.6, 0.82);
    for (let i = 0; i < 8; i++) { const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2; g.limb(mb, [Math.cos(a0) * 0.22, Math.sin(a0) * 0.22, 0], [Math.cos(a1) * 0.22, Math.sin(a1) * 0.22, 0], 0.06, 0.06, i % 2 ? red : C('#ffffff'), 5, false); }
    mb.pop();
    void o;
  };
  M.sf_tiki = (mb, o) => {
    const g = G(), bamboo = C('#b48a4f'), straw = C('#c9a44c');
    for (const [x, z] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]]) g.limb(mb, [x, 0, z], [x, 2.5, z], 0.08, 0.07, bamboo, 6);
    mb.push(); mb.translate(0, 2.4, 0); mb.rotateY(Math.PI / 4); mb.cone(0, 0, 0, 2.35, 1.2, 4, straw, 0.15); mb.pop();
    mb.box(0.4, 0, -1.0, 1.1, 1.1, 1.0, { col: bamboo });
    for (let k = 0; k < 6; k++) g.limb(mb, [1.12, 0, -0.9 + k * 0.36], [1.12, 1.1, -0.9 + k * 0.36], 0.05, 0.05, shade(bamboo, 0.85), 5, false);
    mb.box(0.3, 1.1, -1.1, 1.25, 1.2, 1.1, { col: C('#8d6e4a') });
    sign(mb, 'sign_tiki', 0.0, 1.9, 1.3, 2.25, 1.22);
    for (let i = 0; i < 3; i++) { const z = -0.7 + i * 0.7; g.limb(mb, [1.7, 0, z], [1.7, 0.75, z], 0.04, 0.04, C('#5d4632'), 4); g.limb(mb, [1.7, 0.75, z], [1.7, 0.82, z], 0.2, 0.2, C('#e53935'), 8); }
    for (let i = 0; i < 3; i++) mb.box(0.5 + i * 0.2, 1.2, -0.6 + i * 0.4, 0.62 + i * 0.2, 1.42, -0.48 + i * 0.4, { col: C(['#ff7043', '#29b6f6', '#ffeb3b'][(i + o.v) % 3]) });
  };
  M.sf_van = (mb, o) => {
    const g = G(), body = C(['#7ec8e3', '#f4a261', '#e76f51', '#8bc34a'][o.v % 4]), white = C('#f5f5f0');
    for (const x of [1.15, -1.15]) for (const z of [-0.8, 0.8]) wheelAt(mb, x, 0.36, z, 0.36, 0.22, '#dcdcdc');
    mb.box(-1.8, 0.4, -0.85, 1.6, 1.25, 0.85, { col: body });
    mb.box(-1.8, 1.25, -0.85, 1.35, 2.15, 0.85, { col: white });
    g.slab(mb, [1.6, 0.42, 0], [1.42, 2.1, 0], 0.85, 0.05, 0.85, 0.05, body);
    mb.quad([1.48, 1.5, -0.7], [1.48, 1.5, 0.7], [1.4, 2.05, 0.7], [1.4, 2.05, -0.7], null, SOLID, C('#263238'));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) mb.quad([-1.6 + k * 0.9, 1.45, s * 0.86], [-0.9 + k * 0.9, 1.45, s * 0.86], [-0.9 + k * 0.9, 2.0, s * 0.86], [-1.6 + k * 0.9, 2.0, s * 0.86], null, SOLID, C('#2a3640'));
    g.ellipsoid(mb, [1.62, 0.95, 0], 0.03, 0.15, 0.15, white, 6, 4);
    for (let i = 0; i < 2; i++) { mb.push(); mb.translate(-0.2, 2.25 + i * 0.1, -0.35 + i * 0.6); mb.rotateZ(Math.PI / 2); g.ellipsoid(mb, [0, 0, 0], 0.07, 1.6, 0.25, C(['#ffd54f', '#ec407a'][i]), 10, 5); mb.pop(); }
    for (const x of [-1.2, 0.9]) g.limb(mb, [x, 2.15, -0.7], [x, 2.15, 0.7], 0.03, 0.03, C('#555555'), 4);
  };

  /* ---------------- farm ---------------- */
  M.fm_barn = (mb, o) => {
    const red = C(['#b23a2e', '#a33a2a', '#8e2f24', '#b5462f'][o.v % 4]), white = C('#f5f5f0'), roof = C('#4a4a4a');
    mb.box(-1.6, 0, -1.3, 1.6, 2.4, 1.3, { col: red });
    /* gambrel roof: steep lower slopes and a shallow top */
    const z0 = -1.45, z1 = 1.45, xs = [[-1.75, 2.35], [-1.0, 3.4], [0, 3.95], [1.0, 3.4], [1.75, 2.35]];
    for (let i = 0; i < 4; i++) {
      const a = xs[i], b = xs[i + 1];
      mb.quad([a[0], a[1], z1], [b[0], b[1], z1], [b[0], b[1], z0], [a[0], a[1], z0], null, SOLID, i % 2 ? shade(roof, 0.9) : roof);
    }
    for (const z of [-1.3, 1.3]) {
      const sgn = z > 0 ? 1 : -1;
      const tri = (a, b, c) => sgn > 0 ? mb.tri(a, b, c, null, SOLID, red) : mb.tri(a, c, b, null, SOLID, red);
      tri([-1.6, 2.4, z], [1.6, 2.4, z], [1.0, 3.35, z]); tri([-1.6, 2.4, z], [1.0, 3.35, z], [-1.0, 3.35, z]); tri([-1.0, 3.35, z], [1.0, 3.35, z], [0, 3.9, z]);
    }
    /* doors with the white cross and the hay loft */
    mb.quad([-0.8, 0, 1.31], [0.8, 0, 1.31], [0.8, 1.8, 1.31], [-0.8, 1.8, 1.31], null, SOLID, shade(red, 0.85));
    G().slab(mb, [-0.75, 0.05, 1.33], [0.75, 1.75, 1.33], 0.07, 0.015, 0.07, 0.015, white, [0, 0, 1]);
    G().slab(mb, [0.75, 0.05, 1.33], [-0.75, 1.75, 1.33], 0.07, 0.015, 0.07, 0.015, white, [0, 0, 1]);
    for (const [x0, y0, x1, y1] of [[-0.84, 0, -0.76, 1.85], [0.76, 0, 0.84, 1.85], [-0.84, 1.8, 0.84, 1.88]]) mb.quad([x0, y0, 1.33], [x1, y0, 1.33], [x1, y1, 1.33], [x0, y1, 1.33], null, SOLID, white);
    mb.quad([-0.4, 2.6, 1.32], [0.4, 2.6, 1.32], [0.4, 3.2, 1.32], [-0.4, 3.2, 1.32], null, SOLID, C('#3e2723'));
    for (const [x0, x1] of [[-1.62, -1.56], [1.56, 1.62]]) for (const z of [-1.32, 1.32]) mb.box(x0, 0, z - 0.03, x1, 2.4, z + 0.03, { col: white });
    sign(mb, 'sign_granja', -0.6, 2.05, 0.6, 2.3, 1.32);
  };
  M.fm_bales = (mb, o) => {
    const g = G(), hay = C('#d9b45a'), end = C('#e8c97a');
    const bale = (x, y, z, a) => { mb.push(); mb.translate(x, y, z); mb.rotateY(a); g.limb(mb, [0, 0, -0.55], [0, 0, 0.55], 0.6, 0.6, hay, 12); g.limb(mb, [0, 0, 0.55], [0, 0, 0.57], 0.5, 0.5, end, 12); g.limb(mb, [0, 0, -0.57], [0, 0, -0.55], 0.5, 0.5, end, 12); mb.pop(); };
    bale(-0.65, 0.6, 0, 0.1 * o.v); bale(0.65, 0.6, 0.1, -0.1); bale(0, 1.62, 0.05, 0.05);
  };
  M.fm_tractor = (mb, o) => {
    const g = G(), body = C(['#2e7d32', '#c62828', '#1565c0', '#ef6c00'][o.v % 4]), rim = ['#fdd835', '#f5f5f5', '#fdd835', '#2b2b2b'][o.v % 4];
    for (const s of [-1, 1]) wheelAt(mb, -0.75, 0.68, s * 0.78, 0.68, 0.38, rim);
    for (const s of [-1, 1]) wheelAt(mb, 1.05, 0.38, s * 0.62, 0.38, 0.22, rim);
    g.slab(mb, [-0.9, 0.9, 0], [1.4, 0.95, 0], 0.32, 0.32, 0.28, 0.26, body);
    g.slab(mb, [-1.05, 1.15, 0], [-0.5, 1.15, 0], 0.32, 0.06, 0.32, 0.06, C('#222222'));
    for (const s of [-1, 1]) mb.box(-1.25, 0.95, s * 0.45 - 0.35, -0.3, 1.05, s * 0.45 + 0.35, { col: body });
    g.limb(mb, [-0.2, 1.2, 0], [0.05, 1.6, 0], 0.03, 0.03, C('#333333'), 4);
    g.limb(mb, [0.0, 1.6, -0.18], [0.06, 1.62, 0.18], 0.16, 0.16, C('#222222'), 8);
    g.limb(mb, [0.9, 1.2, 0.15], [0.9, 2.05, 0.15], 0.05, 0.05, C('#555555'), 6);
    g.limb(mb, [1.45, 0.95, -0.25], [1.48, 0.95, 0.25], 0.12, 0.12, C('#bdbdbd'), 6);
  };
  M.fm_scarecrow = (mb, o) => {
    const g = G(), wood = C('#6d4c41'), shirt = C(['#c0392b', '#2e86c1', '#8e44ad', '#d35400'][o.v % 4]), straw = C('#e2c27a');
    g.limb(mb, [0, 0, 0], [0, 2.0, 0], 0.05, 0.05, wood, 5);
    g.limb(mb, [0, 1.55, -0.85], [0, 1.55, 0.85], 0.04, 0.04, wood, 5);
    G().trunk(mb, [0, 0.95, 0], [0, 1.62, 0], 0.22, 0.14, 0.28, 0.16, shirt);
    for (const s of [-1, 1]) {
      g.limb(mb, [0, 1.55, s * 0.2], [0, 1.52, s * 0.75], 0.08, 0.07, shirt, 6);
      for (let k = 0; k < 3; k++) g.limb(mb, [0, 1.5, s * 0.78], [0.05 * (k - 1), 1.35 - k * 0.04, s * (0.9 + k * 0.03)], 0.02, 0.005, straw, 3);
    }
    g.limb(mb, [0, 0.95, -0.1], [0, 0.6, -0.12], 0.08, 0.07, C('#3e5f8a'), 6);
    g.limb(mb, [0, 0.95, 0.1], [0, 0.6, 0.12], 0.08, 0.07, C('#3e5f8a'), 6);
    g.ellipsoid(mb, [0, 1.85, 0], 0.17, 0.2, 0.17, straw, 8, 5);
    g.limb(mb, [0, 1.98, 0], [0, 2.02, 0], 0.32, 0.32, C('#5d4037'), 10);
    g.limb(mb, [0, 2.02, 0], [0, 2.3, 0], 0.17, 0.13, C('#5d4037'), 8);
    for (const s of [-1, 1]) g.ellipsoid(mb, [0.15, 1.9, s * 0.06], 0.02, 0.025, 0.02, C('#222222'), 4, 3);
  };
  M.fm_cow = (mb, o) => {
    const g = G(), white = C('#f2f2f2'), black = C('#202020'), pink = C('#e8a0a0');
    mb.push(); mb.rotateY((o.v % 4) * 0.4 - 0.6);
    G().trunk(mb, [-0.75, 1.05, 0], [0.6, 1.08, 0], 0.32, 0.3, 0.3, 0.32, white);
    for (const [x, y, z] of [[-0.3, 1.25, 0.31], [0.25, 0.95, -0.31], [-0.55, 1.0, -0.3], [0.35, 1.3, 0.2]]) g.ellipsoid(mb, [x, y, z], 0.2, 0.15, 0.04, black, 6, 3);
    for (const [x, z] of [[-0.55, -0.18], [-0.55, 0.18], [0.45, -0.18], [0.45, 0.18]]) { g.limb(mb, [x, 0.9, z], [x, 0.08, z], 0.08, 0.06, white, 5); g.limb(mb, [x, 0.1, z], [x, 0, z], 0.065, 0.065, black, 5); }
    g.limb(mb, [0.65, 1.15, 0], [0.85, 1.35, 0], 0.16, 0.15, white, 6);
    G().slab(mb, [0.8, 1.38, 0], [1.15, 1.18, 0], 0.15, 0.14, 0.12, 0.11, white);
    G().slab(mb, [1.12, 1.2, 0], [1.22, 1.12, 0], 0.12, 0.09, 0.11, 0.08, pink);
    for (const s of [-1, 1]) { G().slab(mb, [0.85, 1.42, s * 0.14], [0.85, 1.45, s * 0.3], 0.05, 0.03, 0.06, 0.02, white, [1, 0, 0]); g.limb(mb, [0.9, 1.48, s * 0.08], [0.92, 1.58, s * 0.14], 0.025, 0.01, C('#e0d6c0'), 4); }
    g.limb(mb, [-0.82, 1.2, 0], [-0.95, 0.55, 0], 0.025, 0.02, white, 4);
    g.ellipsoid(mb, [0.1, 0.72, 0], 0.13, 0.08, 0.1, pink, 6, 3);
    mb.pop();
  };
  M.fm_silo = (mb) => {
    const g = G(), steel = C('#dfe3e6'), band = C('#aab1b7');
    g.limb(mb, [0, 0, 0], [0, 6.2, 0], 1.0, 1.0, steel, 14);
    for (let k = 1; k < 6; k++) g.limb(mb, [0, k * 1.1 - 0.04, 0], [0, k * 1.1 + 0.04, 0], 1.02, 1.02, band, 14, false);
    g.ellipsoid(mb, [0, 6.2, 0], 1.02, 0.65, 1.02, C('#b0b6ba'), 14, 6);
    for (const s of [-1, 1]) g.limb(mb, [1.04, 0, s * 0.18], [1.04, 6.4, s * 0.18], 0.025, 0.025, band, 4);
    for (let k = 1; k < 16; k++) g.limb(mb, [1.04, k * 0.4, -0.18], [1.04, k * 0.4, 0.18], 0.02, 0.02, band, 4, false);
    g.limb(mb, [0, 6.75, 0], [0, 7.2, 0], 0.15, 0.08, band, 8);
  };

  /* ---------------- MX world championship ---------------- */
  const NATIONS = [
    [['#c60b1e', '#ffc400', '#c60b1e'], false], [['#009246', '#ffffff', '#ce2b37'], true], [['#0055a4', '#ffffff', '#ef4135'], true],
    [['#ae1c28', '#ffffff', '#21468b'], false], [['#000000', '#fdda24', '#ef3340'], true], [['#000000', '#dd0000', '#ffce00'], false],
    [['#b22234', '#ffffff', '#b22234', '#ffffff', '#3c3b6e'], false], [['#ffffff', '#c8102e', '#ffffff'], false]
  ];
  M.mx_flags = (mb, o) => {
    const g = G();
    for (let i = 0; i < 4; i++) {
      const x = -1.5 + i * 1.0, [cols, vert] = NATIONS[(o.v * 2 + i) % NATIONS.length];
      g.limb(mb, [x, 0, 0], [x, 4.6, 0], 0.035, 0.03, C('#dfe3e7'), 5);
      g.ellipsoid(mb, [x, 4.62, 0], 0.05, 0.05, 0.05, C('#ffd54f'), 5, 3);
      mb.push(); mb.translate(x, 3.6, 0); flag(mb, 0.03, 0, 0.85, 0.55, cols, vert); mb.pop();
    }
  };
  M.mx_gantry = (mb, o) => {
    const g = G(), truss = C('#37474f');
    for (const s of [-1, 1]) {
      for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.limb(mb, [s * 1.7 + dx, 0, dz], [s * 1.7 + dx, 5.0, dz], 0.04, 0.04, truss, 4);
      for (let k = 0; k < 10; k++) g.limb(mb, [s * 1.7 - 0.2, k * 0.5, -0.2], [s * 1.7 + 0.2, k * 0.5 + 0.5, 0.2], 0.025, 0.025, truss, 3, false);
    }
    for (const y of [4.1, 5.0]) for (const z of [-0.2, 0.2]) g.limb(mb, [-1.9, y, z], [1.9, y, z], 0.04, 0.04, truss, 4);
    for (let k = 0; k < 8; k++) g.limb(mb, [-1.7 + k * 0.45, 4.1, -0.2], [-1.45 + k * 0.45, 5.0, 0.2], 0.02, 0.02, truss, 3, false);
    mb.box(-1.4, 4.15, -0.12, 1.4, 4.95, 0.12, { col: C('#0d47a1') });
    sign(mb, 'sign_mundial', -1.35, 4.25, 1.35, 4.85, 0.12);
    sign(mb, 'sign_mundial', -1.35, 4.25, 1.35, 4.85, -0.12, true);
    for (let i = 0; i < 6; i++) { const c = ['#ff3d00', '#ffd600', '#00e5ff', '#76ff03', '#ff4081', '#ffffff'][(i + o.v) % 6]; g.limb(mb, [-1.5 + i * 0.6, 5.02, 0], [-1.5 + i * 0.6, 5.12, 0], 0.08, 0.06, GLOW(c), 6); }
  };
  M.mx_trophy = (mb) => {
    const g = G(), gold = C('#e0b43c'), marble = C('#262626');
    mb.box(-0.8, 0, -0.8, 0.8, 1.0, 0.8, { col: marble });
    mb.box(-0.9, 0, -0.9, 0.9, 0.15, 0.9, { col: shade(marble, 1.4) });
    const prof = [[1.0, 0.45], [1.15, 0.45], [1.25, 0.3], [1.9, 0.14], [2.2, 0.28], [2.6, 0.42], [3.1, 0.55], [3.6, 0.62], [3.75, 0.66]];
    for (let i = 0; i + 1 < prof.length; i++) g.limb(mb, [0, prof[i][0], 0], [0, prof[i + 1][0], 0], prof[i][1], prof[i + 1][1], i % 2 ? gold : shade(gold, 1.08), 12, i === 0 || i === prof.length - 2);
    for (const s of [-1, 1]) g.tube(mb, [[0, 3.4, s * 0.6, 0.05], [0, 3.55, s * 0.95, 0.05], [0, 3.1, s * 1.05, 0.05], [0, 2.75, s * 0.75, 0.05], [0, 2.6, s * 0.45, 0.05]], gold, 6);
    g.ellipsoid(mb, [0, 3.62, 0], 0.6, 0.05, 0.6, C('#7a5a12'), 12, 3);
  };
  M.mx_teamtruck = (mb, o) => {
    const ids = ['kronos', 'hanza', 'yamato', 'kawara', 'huska', 'suzaki'], b = Cat().brands[ids[(o.v + o.id) % ids.length]];
    const main = C(b.main), second = C(b.main === '#f4f4f4' ? b.side : '#f4f4f4');
    for (const x of [-1.5, -1.0, 1.35]) for (const z of [-0.82, 0.82]) wheelAt(mb, x, 0.42, z, 0.42, 0.26, '#c3c7cc');
    mb.box(-1.95, 0.55, -0.95, 0.95, 3.1, 0.95, { col: main });
    mb.box(-1.95, 1.2, -0.96, 0.95, 1.45, 0.96, { col: second });
    mb.box(1.0, 0.5, -0.9, 1.9, 2.3, 0.9, { col: main });
    mb.quad([1.91, 1.5, -0.75], [1.91, 1.5, 0.75], [1.88, 2.15, 0.75], [1.88, 2.15, -0.75], null, SOLID, C('#22313a'));
    mb.box(1.0, 2.3, -0.88, 1.6, 2.85, 0.88, { col: shade(main, 0.9) });
    for (const s of [-1, 1]) {
      const r = MX.Tex.regions['logo_mxt'];
      if (r) { const z = s * 0.97; if (s > 0) mb.quad([-1.6, 1.7, z], [0.6, 1.7, z], [0.6, 2.7, z], [-1.6, 2.7, z], r.uv, ATL, [1, 1, 1, 1]); else mb.quad([0.6, 1.7, z], [-1.6, 1.7, z], [-1.6, 2.7, z], [0.6, 2.7, z], r.uv, ATL, [1, 1, 1, 1]); }
    }
    MX.BuildModels.bakeModel(mb, 'mx_' + ids[(o.v + o.id) % ids.length] + '_4t', -0.5, 0, 1.55, 0, null, 0.9);
  };
  M.mx_camera = (mb, o) => {
    const g = G(), steel = C('#9aa3a8');
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.limb(mb, [sx * 0.9, 0, sz * 0.9], [sx * 0.8, 3.0, sz * 0.8], 0.04, 0.04, steel, 4);
    for (const y of [1.0, 2.0]) for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) g.limb(mb, [a[0] * 0.86, y, a[1] * 0.86], [b[0] * 0.86, y + 0.9, b[1] * 0.86], 0.025, 0.025, steel, 3, false);
    mb.box(-1.0, 3.0, -1.0, 1.0, 3.12, 1.0, { col: C('#5d6a70') });
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]]]) g.limb(mb, [a[0], 4.0, a[1]], [b[0], 4.0, b[1]], 0.03, 0.03, C('#ffd54f'), 4);
    g.limb(mb, [0.3, 3.12, 0], [0.3, 3.85, 0], 0.03, 0.03, C('#222222'), 4);
    mb.box(0.1, 3.85, -0.15, 0.65, 4.2, 0.15, { col: C('#212121') });
    g.limb(mb, [0.65, 4.02, 0], [0.95, 4.02, 0], 0.09, 0.08, C('#111111'), 8);
    MX.BuildModels.bakeModel(mb, 'person_0', -0.3, 3.12, 0, 0, [[30, 30, 30], [40, 53, 147], [70, 45, 25], [224, 172, 130]], 1);
    g.limb(mb, [-0.6, 3.12, -0.6], [-0.6, 5.0, -0.6], 0.03, 0.03, C('#cccccc'), 4);
    striped(mb, -0.6, 4.6, -0.6, 0.9, 0.45, 8, '#1565c0', '#ffffff');
    void o;
  };
  M.mx_inflatable = (mb, o) => {
    const ids = ['kronos', 'hanza', 'yamato', 'kawara', 'huska', 'suzaki'];
    mb.box(-1.8, 0, -0.5, 1.8, 0.12, 0.5, { col: C('#455a64') });
    MX.BuildModels.bakeModel(mb, 'mx_' + ids[(o.v + o.id) % ids.length] + '_2t', 0, 0.12, 0, 0, null, 1.6);
    const g = G();
    for (const [x, z] of [[-1.7, 0.9], [1.7, -0.9], [1.6, 0.9], [-1.6, -0.9]]) g.limb(mb, [x, 0, z], [x * 0.55, 1.4, z * 0.15], 0.01, 0.01, C('#eeeeee'), 3, false);
  };

  /* ---------------- festival ---------------- */
  M.fs_stage = (mb, o) => {
    const g = G(), truss = C('#2b2b2b');
    mb.box(-1.85, 0, -1.4, 1.85, 1.0, 1.4, { col: C('#1f1f1f') });
    mb.box(-1.85, 1.0, -1.4, 1.85, 1.06, 1.4, { col: C('#3a3a3a') });
    for (const [x, z] of [[-1.75, -1.3], [1.75, -1.3], [-1.75, 1.3], [1.75, 1.3]]) g.limb(mb, [x, 1.0, z], [x, 4.2, z], 0.06, 0.06, truss, 4);
    for (const z of [-1.3, 1.3]) g.limb(mb, [-1.8, 4.2, z], [1.8, 4.2, z], 0.06, 0.06, truss, 4);
    for (const x of [-1.75, 1.75]) g.limb(mb, [x, 4.2, -1.35], [x, 4.2, 1.35], 0.06, 0.06, truss, 4);
    mb.box(-1.9, 4.25, -1.45, 1.9, 4.4, 0.6, { col: C('#111111') });
    mb.quad([-1.7, 1.06, -1.32], [1.7, 1.06, -1.32], [1.7, 4.1, -1.32], [-1.7, 4.1, -1.32], null, SOLID, C(['#4a148c', '#0d47a1', '#b71c1c', '#004d40'][o.v % 4]));
    for (const s of [-1, 1]) { mb.box(s * 1.45 - 0.3, 1.06, 0.6, s * 1.45 + 0.3, 2.4, 1.2, { col: C('#161616') }); for (const y of [1.45, 2.0]) g.limb(mb, [s * 1.45, y, 1.2], [s * 1.45, y, 1.23], 0.17, 0.17, C('#3d3d3d'), 8); }
    const lights = ['#ff00e5', '#00e5ff', '#ffea00', '#76ff03', '#ff3d00', '#ffffff'];
    for (let i = 0; i < 6; i++) g.limb(mb, [-1.5 + i * 0.6, 4.1, 1.3], [-1.5 + i * 0.6, 3.85, 1.15], 0.1, 0.09, GLOW(lights[(i + o.v) % 6]), 6);
    g.limb(mb, [-0.2, 1.06, 0.1], [-0.2, 1.25, 0.1], 0.3, 0.3, C('#d32f2f'), 10);
    g.limb(mb, [0.5, 1.06, 0.0], [0.5, 2.0, 0.0], 0.02, 0.02, C('#cccccc'), 4);
  };
  M.fs_lights = (mb, o) => {
    const g = G(), pole = C('#5d4632'), bulbs = ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#ff9100', '#e040fb'];
    for (const x of [-1.8, 1.8]) g.limb(mb, [x, 0, 0], [x, 3.4, 0], 0.06, 0.05, pole, 5);
    const n = 12;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = -1.8 + 3.6 * t, y = 3.3 - Math.sin(t * Math.PI) * 0.8, p = [x, y, 0];
      if (prev) g.limb(mb, prev, p, 0.01, 0.01, C('#333333'), 3, false);
      if (i > 0 && i < n) g.ellipsoid(mb, [x, y - 0.1, 0], 0.08, 0.1, 0.08, GLOW(bulbs[(i + o.v) % bulbs.length]), 5, 3);
      prev = p;
    }
  };
  M.fs_balloons = (mb, o) => {
    const g = G(), cols = ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#ff9100', '#e040fb', '#ffffff'];
    mb.box(-0.15, 0, -0.15, 0.15, 0.2, 0.15, { col: C('#455a64') });
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + o.v, r = 0.25 + (i % 2) * 0.2, top = [Math.cos(a) * r, 2.6 + (i % 3) * 0.3, Math.sin(a) * r];
      g.limb(mb, [0, 0.2, 0], [top[0], top[1] - 0.3, top[2]], 0.006, 0.006, C('#dddddd'), 3, false);
      g.ellipsoid(mb, top, 0.22, 0.28, 0.22, C(cols[(i + o.id) % cols.length]), 8, 5);
    }
  };
  M.fs_ferris = (mb, o) => {
    const g = G(), steel = C('#eceff1'), R = 1.65, cy = 2.25, cols = ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#ff9100', '#e040fb', '#00e5ff', '#ffffff'];
    for (const z of [-0.45, 0.45]) { g.limb(mb, [-1.2, 0, z], [0, cy, z], 0.06, 0.05, steel, 5); g.limb(mb, [1.2, 0, z], [0, cy, z], 0.06, 0.05, steel, 5); }
    mb.box(-1.5, 0, -0.7, 1.5, 0.15, 0.7, { col: C('#546e7a') });
    g.limb(mb, [0, cy, -0.5], [0, cy, 0.5], 0.1, 0.1, C('#b0bec5'), 8);
    const rot = (o.id % 8) * 0.1;
    for (const z of [-0.35, 0.35]) for (let i = 0; i < 16; i++) {
      const a0 = rot + i / 16 * Math.PI * 2, a1 = rot + (i + 1) / 16 * Math.PI * 2;
      g.limb(mb, [Math.cos(a0) * R, cy + Math.sin(a0) * R, z], [Math.cos(a1) * R, cy + Math.sin(a1) * R, z], 0.04, 0.04, steel, 4, false);
      if (i % 2 === 0) g.limb(mb, [0, cy, z], [Math.cos(a0) * R, cy + Math.sin(a0) * R, z], 0.025, 0.025, steel, 3, false);
    }
    for (let i = 0; i < 8; i++) {
      const a = rot + i / 8 * Math.PI * 2, x = Math.cos(a) * R, y = cy + Math.sin(a) * R;
      g.limb(mb, [x, y, -0.35], [x, y, 0.35], 0.03, 0.03, steel, 4, false);
      mb.box(x - 0.22, y - 0.55, -0.25, x + 0.22, y - 0.18, 0.25, { col: C(cols[(i + o.v) % cols.length]) });
      g.limb(mb, [x, y - 0.18, 0], [x, y, 0], 0.02, 0.02, steel, 3, false);
    }
  };
  M.fs_tent = (mb, o) => {
    const g = G(), pair = [['#e53935', '#ffffff'], ['#1e88e5', '#ffffff'], ['#fdd835', '#e53935'], ['#43a047', '#ffffff']][o.v % 4];
    const n = 12, r = 1.7;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, c = C(pair[i % 2]);
      const p0 = [Math.cos(a0) * r, 0, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, 0, Math.sin(a1) * r];
      if (i === 0) continue;
      const q0 = [p0[0] * 0.98, 0, p0[2] * 0.98], q1 = [p1[0] * 0.98, 0, p1[2] * 0.98];
      mb.quad(p1, p0, [p0[0], 2.0, p0[2]], [p1[0], 2.0, p1[2]], null, SOLID, c);
      mb.quad(q0, q1, [q1[0], 2.0, q1[2]], [q0[0], 2.0, q0[2]], null, SOLID, shade(c, 0.6));
    }
    striped(mb, 0, 2.0, 0, 1.95, 1.6, n, pair[0], pair[1]);
    g.limb(mb, [0, 3.5, 0], [0, 4.2, 0], 0.025, 0.025, C('#dddddd'), 4);
    mb.push(); mb.translate(0, 3.85, 0); flag(mb, 0.02, 0, 0.5, 0.32, [pair[0]]); mb.pop();
  };

  const Cat = () => MX.Catalog;
  MX.DecorModels = { has: (t) => !!M[t], build: (mb, o) => { if (o.s && o.s !== 1) mb.scale(o.s); M[o.type](mb, o); } };
})(window.MX);
