/* MX Tycoon - procedural building and decoration models. Local frame: x in [0,W],
   z in [0,D] metres, front (access/view side) facing +Z, ground at y = 0. */
(function (MX) {
  'use strict';
  const C = MX.C, Cat = MX.Catalog, MB = MX.MeshBuilder, U = MX.U;
  const T = C.TILE;
  const L = () => MX.Tex.L;
  const R = (n) => MX.Tex.regions[n];
  const ATL = MB.MAT_ATLAS, SOLID = MB.MAT_SOLID;
  const col = (h, k) => { const c = MB.rgba(h); return k ? MB.mulCol(c, k) : c; };
  const WHITE = [1, 1, 1, 1];

  /* sign plate on a wall facing +Z at local z (slightly in front) */
  function sign(mb, name, x0, y0, x1, y1, z, back) {
    const r = R(name);
    if (!r) return;
    const d = back ? -0.04 : 0.04;
    if (!back) mb.quad([x0, y0, z + d], [x1, y0, z + d], [x1, y1, z + d], [x0, y1, z + d], r.uv, ATL, WHITE);
    else mb.quad([x1, y0, z + d], [x0, y0, z + d], [x0, y1, z + d], [x1, y1, z + d], r.uv, ATL, WHITE);
  }
  function signX(mb, name, x, y0, y1, z0, z1, flip) {
    const r = R(name);
    if (!r) return;
    if (!flip) mb.quad([x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], r.uv, ATL, WHITE);
    else mb.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], r.uv, ATL, WHITE);
  }
  function windowZ(mb, x0, y0, x1, y1, z, name) { sign(mb, name || 'win', x0, y0, x1, y1, z); }
  function umbrella(mb, x, z, c) {
    mb.box(x - 0.05, 0, z - 0.05, x + 0.05, 2.1, z + 0.05, { col: col('#dddddd') });
    mb.cone(x, 1.9, z, 1.1, 0.5, 8, col(c));
    mb.cylinder(x, 0, z, 0.45, 0.72, 8, SOLID, col('#8d6e63'));
  }
  function crate(mb, x, z, s, c) { mb.box(x, 0, z, x + s, s, z + s, { mat: L().wood, col: c ? col(c) : WHITE }); }
  function lampPost(mb, x, z, h) {
    mb.box(x - 0.08, 0, z - 0.08, x + 0.08, h, z + 0.08, { col: col('#37474f') });
    mb.box(x - 0.35, h - 0.1, z - 0.2, x + 0.35, h + 0.1, z + 0.2, { col: col('#263238') });
    mb.box(x - 0.25, h - 0.18, z - 0.12, x + 0.25, h - 0.1, z + 0.12, { col: col('#fff59d') });
  }
  function fenceRun(mb, x0, z0, x1, z1, h, c) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 2));
    const pc = col(c || '#9aa0a6');
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      mb.box(x - 0.05, 0, z - 0.05, x + 0.05, h, z + 0.05, { col: pc });
    }
    const fm = L().fence;
    const a = [x0, 0.05, z0], b = [x1, 0.05, z1], cc = [x1, h, z1], d = [x0, h, z0];
    mb.quad(a, b, cc, d, [0, 0, len / 16, h / 16], fm, WHITE);
    mb.quad(b, a, d, cc, [0, 0, len / 16, h / 16], fm, WHITE);
    mb.box(Math.min(x0, x1) - 0.04, h - 0.06, Math.min(z0, z1) - 0.04, Math.max(x0, x1) + 0.04, h, Math.max(z0, z1) + 0.04, { col: pc });
  }
  function tent(mb, x0, z0, x1, z1, h, c) {
    const cc = col(c);
    mb.gable(x0, z0, x1, z1, 0, h, 'x', L().tent, cc, MB.mulCol(cc, 0.85), 0);
  }
  /* bake an instanced voxel model into a static mesh, resolving colour slots */
  /* mono: paint the whole model in one colour, keeping its light and dark parts (statues) */
  function bakeModel(mb, name, x, y, z, yaw, slots, scale, mono) {
    const m = MX.Models.lib[name];
    if (!m) return;
    const d = m.data, S = MX.GL.STRIDE;
    const sc = scale || 1;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    mb.ensure(m.count);
    for (let i = 0; i < m.count; i += 3) {
      const tri = [];
      let slot = 0, vcol = [1, 1, 1, 1];
      for (let k = 0; k < 3; k++) {
        const o = (i + k) * S;
        const px = d[o] * sc, py = d[o + 1] * sc, pz = d[o + 2] * sc;
        tri.push([x + px * c - pz * s, y + py, z + px * s + pz * c]);
        slot = d[o + 9]; vcol = [d[o + 10], d[o + 11], d[o + 12], 1];
      }
      if (slot > 0.5 && slots) {
        const sl = slots[Math.round(slot) - 1] || [255, 255, 255];
        vcol = [vcol[0] * sl[0] / 255, vcol[1] * sl[1] / 255, vcol[2] * sl[2] / 255, 1];
      }
      if (mono) {
        const k = 0.72 + 0.28 * (vcol[0] * 0.3 + vcol[1] * 0.59 + vcol[2] * 0.11);
        vcol = [mono[0] / 255 * k, mono[1] / 255 * k, mono[2] / 255 * k, 1];
      }
      mb.tri(tri[0], tri[1], tri[2], null, SOLID, vcol);
    }
  }

  const M = {};
  M.paddock = (mb, W, D, b) => {
    mb.quad([0, 0.04, D], [W, 0.04, D], [W, 0.04, 0], [0, 0.04, 0], [0, 0, W / 16, D / 16], L().paddockfloor, WHITE);
    fenceRun(mb, 0, 0, W, 0, 1.0); fenceRun(mb, 0, 0, 0, D - 2, 1.0); fenceRun(mb, W, 0, W, D - 2, 1.0);
    /* office cabin in the back corner */
    mb.box(0.3, 0, 0.3, 3.0, 2.6, 2.4, { mat: L().metal, col: col('#eceff1'), top: L().roofmetal, topCol: col('#90a4ae') });
    sign(mb, 'sign_paddock', 0.4, 2.0, 2.9, 2.55, 2.4);
    windowZ(mb, 1.8, 0.9, 2.7, 1.7, 2.4);
    /* canopy tent */
    const tc = (b && b.id % 2) ? '#ff6a13' : '#1e88e5';
    for (const [x, z] of [[W - 4.2, 0.6], [W - 0.6, 0.6], [W - 4.2, 3.8], [W - 0.6, 3.8]]) mb.box(x - 0.05, 0, z - 0.05, x + 0.05, 2.4, z + 0.05, { col: col('#cfd8dc') });
    mb.gable(W - 4.3, 0.5, W - 0.5, 3.9, 2.4, 3.1, 'x', L().stripes, col(tc), col(tc), 0.1);
    crate(mb, W - 3.6, 1.2, 0.6, '#c62828'); crate(mb, W - 2.6, 1.4, 0.5);
    mb.cylinder(W - 1.4, 0, 2.6, 0.25, 0.7, 8, SOLID, col('#d32f2f'));
    lampPost(mb, 0.5, D - 2.4, 5);
  };
  M.boxes = (mb, W, D) => {
    const wall = col('#cfd2d6');
    mb.box(0, 0, 0.5, W, 3.4, D, { mat: L().concrete, col: wall, top: L().roofmetal, topCol: col('#78909c') });
    for (let i = 0; i < 2; i++) {
      const x0 = 0.5 + i * 3.9, x1 = x0 + 3.0;
      mb.quad([x0, 0.05, D + 0.02], [x1, 0.05, D + 0.02], [x1, 2.6, D + 0.02], [x0, 2.6, D + 0.02], [0, 0, 3 / 16, 2.5 / 16], L().roller, col('#90a4ae'));
    }
    mb.box(-0.1, 3.0, D, W + 0.1, 3.15, D + 1.2, { col: col('#ff6a13') });
    sign(mb, 'sign_boxes', W / 2 - 1.3, 3.15, W / 2 + 1.3, 3.75, D + 1.2);
  };
  M.workshop = (mb, W, D) => {
    const wall = col('#8fa3b5');
    mb.box(0, 0, 0, W, 3.4, D - 0.6, { mat: L().metal, col: wall, noTop: true });
    mb.gable(0, 0, W, D - 0.6, 3.4, 5.0, 'z', L().roofmetal, col('#b0bec5'), wall, 0.3);
    mb.quad([1.2, 0.05, D - 0.58], [W - 1.2, 0.05, D - 0.58], [W - 1.2, 3.0, D - 0.58], [1.2, 3.0, D - 0.58], [0, 0, (W - 2.4) / 16, 3 / 16], L().roller, col('#cfd8dc'));
    sign(mb, 'sign_taller', W / 2 - 1.6, 3.4, W / 2 + 1.6, 4.1, D - 0.6);
    signX(mb, 'win_wide', W + 0.02, 1.2, 2.2, 1.5, D - 2.0);
    /* tyre stack and bench outside */
    for (let k = 0; k < 4; k++) mb.cylinder(0.6, k * 0.22, D + 0.2, 0.36, 0.2, 10, SOLID, col('#222222'));
    mb.box(W - 2.0, 0, D - 0.2, W - 0.4, 0.9, D + 0.4, { mat: L().wood, col: WHITE });
  };
  M.showers = (mb, W, D) => {
    mb.box(0.3, 0, 0.4, W - 0.3, 2.8, D - 0.3, { mat: L().white, col: col('#e3f2fd'), top: L().roofmetal, topCol: col('#90a4ae') });
    mb.cylinder(W / 2, 2.8, D / 2 - 0.4, 0.7, 0.9, 10, SOLID, col('#eceff1'));
    sign(mb, 'sign_duchas', 0.6, 2.1, W - 0.6, 2.7, D - 0.3);
    sign(mb, 'door', 1.4, 0, 2.4, 2.0, D - 0.3);
  };
  M.school = (mb, W, D) => {
    mb.box(0.3, 0, 0.3, 4.6, 3.0, 3.6, { mat: L().wood, col: col('#ffe0b2'), noTop: true });
    mb.gable(0.3, 0.3, 4.6, 3.6, 3.0, 4.2, 'x', L().tiles, WHITE, col('#ffe0b2'), 0.3);
    sign(mb, 'sign_escuela', 0.6, 2.2, 4.3, 2.9, 3.6);
    sign(mb, 'door', 3.2, 0, 4.0, 2.0, 3.6);
    windowZ(mb, 1.0, 1.0, 2.2, 2.0, 3.6);
    mb.quad([0.2, 0.03, D - 0.2], [W - 0.2, 0.03, D - 0.2], [W - 0.2, 0.03, 4.2], [0.2, 0.03, 4.2], [0, 0, W / 16, 0.25], L().dirt, WHITE);
    for (let i = 0; i < 6; i++) mb.cone(1 + i * 1.2, 0.03, 5.2 + (i % 2) * 1.4, 0.18, 0.45, 6, col('#ff6d00'));
    fenceRun(mb, 0.2, 4.2, 0.2, D - 0.2, 0.8, '#ffffff'); fenceRun(mb, W - 0.2, 4.2, W - 0.2, D - 0.2, 0.8, '#ffffff');
  };
  M.entrance = (mb, W, D) => {
    /* ticket booth on the left tile, gate arch on the right tile */
    mb.box(0.4, 0, 0.6, 3.2, 2.7, 3.4, { mat: L().wood, col: col('#ffcc80'), noTop: true });
    mb.gable(0.4, 0.6, 3.2, 3.4, 2.7, 3.7, 'z', L().tiles, WHITE, col('#ffcc80'), 0.25);
    sign(mb, 'counter', 0.8, 0.9, 2.8, 1.9, 3.4);
    sign(mb, 'sign_taquilla', 0.6, 2.05, 3.0, 2.65, 3.4);
    const post = col('#424242');
    mb.box(4.2, 0, 1.6, 4.6, 4.8, 2.4, { col: post });
    mb.box(7.4, 0, 1.6, 7.8, 4.8, 2.4, { col: post });
    mb.box(4.0, 4.0, 1.7, 8.0, 5.0, 2.3, { col: col('#151515') });
    sign(mb, 'park_name', 4.05, 4.08, 7.95, 4.92, 2.3);
    sign(mb, 'park_name', 4.05, 4.08, 7.95, 4.92, 1.7, true);
    for (const x of [5.2, 6.8]) { mb.box(x - 0.1, 0, 1.9, x + 0.1, 1.0, 2.1, { col: col('#9e9e9e') }); mb.box(x - 0.5, 0.8, 1.97, x + 0.5, 0.86, 2.03, { col: col('#bdbdbd') }); }
    for (const x of [4.4, 7.6]) { mb.box(x - 0.03, 4.9, 2.0 - 0.03, x + 0.03, 6.4, 2.0 + 0.03, { col: col('#eeeeee') }); mb.quad([x, 5.6, 2.0], [x + 1.0, 5.7, 2.0], [x + 1.0, 6.3, 2.0], [x, 6.35, 2.0], null, SOLID, col(x < 6 ? '#ff6a13' : '#ffd22e')); }
  };
  M.parking = (mb, W, D) => {
    mb.quad([0, 0.04, D], [W, 0.04, D], [W, 0.04, 0], [0, 0.04, 0], [0, 0, W / 16, D / 16], L().asphalt, WHITE);
    const line = col('#e8e8e8');
    for (let i = 0; i <= 6; i++) {
      const x = 0.12 + i * 1.96;
      mb.quad([x - 0.05, 0.06, 4.9], [x + 0.05, 0.06, 4.9], [x + 0.05, 0.06, 0.2], [x - 0.05, 0.06, 0.2], null, SOLID, line);
      mb.quad([x - 0.05, 0.06, D - 0.2], [x + 0.05, 0.06, D - 0.2], [x + 0.05, 0.06, 7.1], [x - 0.05, 0.06, 7.1], null, SOLID, line);
    }
    lampPost(mb, 0.4, 6, 5.2); lampPost(mb, W - 0.4, 6, 5.2);
    mb.box(W / 2 - 0.05, 0, D - 0.3, W / 2 + 0.05, 2.2, D - 0.2, { col: col('#9e9e9e') });
    sign(mb, 'sign_parking', W / 2 - 0.4, 2.2, W / 2 + 0.4, 3.0, D - 0.2);
  };
  function stand(mb, W, D, covered, b) {
    const steel = col('#78909c'), conc = col('#bdbdbd');
    const seatCol = col(['#1e88e5', '#e53935', '#fdd835', '#43a047', '#ff6a13'][(b ? b.id : 0) % 5]);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const z1 = D - 0.2 - r * (D - 1.2) / rows, z0 = z1 - (D - 1.2) / rows;
      const y = 0.3 + r * 0.62;
      mb.box(0.1, 0, z0, W - 0.1, y, z1, { mat: L().concrete, col: conc });
      /* seat row */
      mb.box(0.25, y, z1 - 0.55, W - 0.25, y + 0.22, z1 - 0.15, { mat: L().seats, col: seatCol, top: L().seats, uv: 1 / 4 });
      mb.box(0.25, y, z0 + 0.05, W - 0.25, y + 0.55, z0 + 0.15, { col: MB.mulCol(seatCol, 0.8) });
    }
    /* back rail and stairs */
    const top = 0.3 + (rows - 1) * 0.62;
    mb.box(0.1, top, 0.2, W - 0.1, top + 1.0, 0.32, { col: steel });
    mb.box(-0.5, 0, 0.4, 0.1, top, D - 0.4, { mat: L().concrete, col: conc });
    if (covered) {
      for (const x of [0.2, W - 0.2]) for (const z of [0.4, D - 0.4]) mb.box(x - 0.1, 0, z - 0.1, x + 0.1, z < 1 ? 5.0 : 4.0, z + 0.1, { col: steel });
      mb.shed(0, 0.2, W, D + 0.4, 4.0, 5.1, L().roofmetal, col('#eceff1'), 0.2);
      sign(mb, 'logo_mxt', W / 2 - 1.6, 4.1, W / 2 + 1.6, 4.9, 0.25, true);
    }
  }
  M.grandstand = (mb, W, D, b) => stand(mb, W, D, false, b);
  M.grandstand_cov = (mb, W, D, b) => stand(mb, W, D, true, b);
  M.foodtruck = (mb, W, D, b) => {
    const body = col(['#ff6a13', '#43a047', '#e53935', '#1e88e5'][(b ? b.id : 0) % 4]);
    mb.box(0.5, 0.4, 0.8, 3.5, 2.6, 2.6, { col: body, topCol: col('#eeeeee') });
    mb.box(3.5, 0.4, 0.9, 4.0, 1.8, 2.5, { col: MB.mulCol(body, 0.85) });
    for (const x of [1.0, 3.2]) for (const z of [0.75, 2.65]) mb.cylinder(x, 0.0, z, 0.32, 0.08, 8, SOLID, col('#212121'));
    sign(mb, 'counter', 0.9, 1.1, 3.1, 1.9, 2.6);
    mb.shed(0.6, 2.6, 3.4, 3.6, 2.3, 2.55, L().stripes, body, 0.05);
    sign(mb, 'sign_food', 1.0, 2.05, 3.0, 2.5, 2.62);
    umbrella(mb, 0.6, 3.6, '#fdd835');
  };
  M.restaurant = (mb, W, D) => {
    mb.box(0.4, 0, 0.4, W - 0.4, 0.8, 5.4, { mat: L().brick, col: WHITE });
    mb.box(0.4, 0.8, 0.4, W - 0.4, 3.4, 5.4, { mat: L().wood, col: col('#ffe0b2'), noTop: true });
    mb.gable(0.4, 0.4, W - 0.4, 5.4, 3.4, 4.8, 'x', L().tiles, WHITE, col('#ffe0b2'), 0.4);
    sign(mb, 'sign_bar', W / 2 - 1.2, 2.7, W / 2 + 1.2, 3.3, 5.4);
    windowZ(mb, 0.9, 1.2, 2.6, 2.4, 5.4, 'win_wide');
    windowZ(mb, W - 2.6, 1.2, W - 0.9, 2.4, 5.4, 'win_wide');
    sign(mb, 'door_glass', W / 2 - 0.5, 0, W / 2 + 0.5, 2.1, 5.4);
    mb.quad([0.3, 0.05, D - 0.2], [W - 0.3, 0.05, D - 0.2], [W - 0.3, 0.05, 5.4], [0.3, 0.05, 5.4], [0, 0, W / 16, 0.15], L().wood, WHITE);
    umbrella(mb, 1.6, 6.6, '#e53935'); umbrella(mb, W - 1.6, 6.6, '#fdd835');
  };
  M.restaurant_big = (mb, W, D) => {
    /* dining hall at the back, wooden terrace with tables and umbrellas at the front */
    mb.box(0.4, 0, 0.4, W - 0.4, 0.9, 4.4, { mat: L().brick, col: WHITE });
    mb.box(0.4, 0.9, 0.4, W - 0.4, 3.8, 4.4, { mat: L().wood, col: col('#d7b98e'), noTop: true });
    mb.gable(0.4, 0.4, W - 0.4, 4.4, 3.8, 5.3, 'x', L().tiles, WHITE, col('#d7b98e'), 0.45);
    sign(mb, 'sign_restaurante', W / 2 - 1.8, 3.0, W / 2 + 1.8, 3.65, 4.4);
    for (let x = 0.9; x < W - 2; x += 2.6) windowZ(mb, x, 1.3, x + 1.8, 2.6, 4.4, 'win_wide');
    sign(mb, 'door_glass', W - 1.8, 0, W - 0.8, 2.2, 4.4);
    mb.box(0.3, 0, 4.6, W - 0.3, 0.25, D - 0.3, { mat: L().wood, col: WHITE });
    fenceRun(mb, 0.3, 4.6, 0.3, D - 0.3, 0.9, '#8d6e63'); fenceRun(mb, W - 0.3, 4.6, W - 0.3, D - 0.3, 0.9, '#8d6e63');
    for (let x = 1.6; x < W - 0.8; x += 3.0) {
      mb.push(); mb.translate(0, 0.25, 0);
      mb.cylinder(x, 0, 6.3, 0.55, 0.72, 8, SOLID, col('#efebe9'));
      for (const dx of [-0.9, 0.9]) mb.box(x + dx - 0.2, 0, 6.1, x + dx + 0.2, 0.45, 6.5, { col: col('#6d4c41') });
      umbrella(mb, x, 6.3, ['#c62828', '#2e7d32', '#f9a825', '#1565c0'][Math.round(x) % 4]);
      mb.pop();
    }
  };
  M.megastore = (mb, W, D) => {
    const wall = col('#546e7a');
    mb.box(0.4, 0, 0.4, W - 0.4, 4.2, D - 1.2, { mat: L().metal, col: wall, top: L().roofmetal, topCol: col('#607d8b') });
    /* orange band and the brand on the back and the sides, so it reads as the store from any side */
    mb.box(0.35, 3.3, 0.35, W - 0.35, 3.75, D - 1.15, { col: col('#ff6a13'), noTop: true });
    sign(mb, 'logo_mxt', W / 2 - 1.6, 2.35, W / 2 + 1.6, 3.1, 0.4, true);
    signX(mb, 'logo_mxt', W - 0.36, 2.35, 3.1, D / 2 - 2.0, D / 2 + 1.2);
    signX(mb, 'logo_mxt', 0.36, 2.35, 3.1, D / 2 - 2.0, D / 2 + 1.2, true);
    mb.quad([0.8, 0.05, D - 1.18], [W - 0.8, 0.05, D - 1.18], [W - 0.8, 2.9, D - 1.18], [0.8, 2.9, D - 1.18], [0, 0, (W - 1.6) / 16, 2.85 / 16], L().glass, WHITE);
    sign(mb, 'tshirts', 1.2, 0.8, W / 2 - 0.4, 1.8, D - 1.16);
    sign(mb, 'tshirts', W / 2 + 0.4, 0.8, W - 1.2, 1.8, D - 1.16);
    sign(mb, 'sign_tienda', W / 2 - 2.0, 3.15, W / 2 + 2.0, 3.95, D - 1.18);
    mb.box(0.2, 4.2, D - 1.6, W - 0.2, 4.45, D - 0.4, { col: col('#ff6a13') });
    sign(mb, 'logo_mxt', W / 2 - 1.4, 4.45, W / 2 + 1.4, 5.1, D - 1.0);
    for (const x of [0.9, W - 0.9]) { mb.box(x - 0.08, 0, D - 0.5, x + 0.08, 3.4, D - 0.34, { col: col('#cfd8dc') }); mb.quad([x, 1.6, D - 0.42], [x + (x < W / 2 ? 0.9 : -0.9), 1.6, D - 0.42], [x + (x < W / 2 ? 0.9 : -0.9), 3.2, D - 0.42], [x, 3.2, D - 0.42], null, SOLID, col(x < W / 2 ? '#ff6a13' : '#fdd835')); }
  };
  M.playground = (mb, W, D) => {
    mb.quad([0.3, 0.04, D - 0.3], [W - 0.3, 0.04, D - 0.3], [W - 0.3, 0.04, 0.3], [0.3, 0.04, 0.3], [0, 0, W / 16, D / 16], L().sand, col('#ffe0b2'));
    fenceRun(mb, 0.3, 0.3, W - 0.3, 0.3, 0.8, '#43a047'); fenceRun(mb, 0.3, 0.3, 0.3, D - 1.6, 0.8, '#43a047'); fenceRun(mb, W - 0.3, 0.3, W - 0.3, D - 1.6, 0.8, '#43a047');
    /* slide tower */
    mb.box(1.0, 0, 1.0, 2.6, 1.6, 2.6, { col: col('#fdd835') });
    mb.cone(1.8, 1.6, 1.8, 1.3, 1.0, 4, col('#e53935'));
    mb.push(); mb.translate(2.6, 0, 1.4); mb.rotateZ(-0.62); mb.box(0, -0.05, 0, 2.6, 0.08, 0.8, { col: col('#1e88e5') }); mb.pop();
    /* swings */
    const metal = col('#78909c');
    for (const z of [5.0, 6.6]) { mb.box(4.4, 0, z - 0.06, 4.52, 2.4, z + 0.06, { col: metal }); mb.box(7.2, 0, z - 0.06, 7.32, 2.4, z + 0.06, { col: metal }); }
    mb.box(4.4, 2.36, 4.94, 7.32, 2.48, 6.66, { col: metal });
    for (const x of [5.2, 6.4]) { mb.box(x - 0.02, 0.5, 5.75, x + 0.02, 2.36, 5.85, { col: col('#424242') }); mb.box(x - 0.3, 0.45, 5.6, x + 0.3, 0.52, 6.0, { col: col('#e53935') }); }
    /* mini ramp and a spring rider */
    mb.push(); mb.translate(1.0, 0, 4.6); mb.rotateZ(0.3); mb.box(0, -0.1, 0, 1.8, 0.12, 1.6, { mat: L().wood, col: WHITE }); mb.pop();
    mb.cylinder(5.8, 0, 2.0, 0.08, 0.5, 6, SOLID, col('#9e9e9e'));
    mb.box(5.4, 0.5, 1.75, 6.3, 0.95, 2.25, { col: col('#ff6a13') });
    mb.box(W / 2 - 0.05, 0, D - 1.0, W / 2 + 0.05, 1.8, D - 0.9, { col: col('#6d4c41') });
    sign(mb, 'sign_infantil', W / 2 - 1.3, 1.8, W / 2 + 1.3, 2.35, D - 0.9);
  };
  M.parts = (mb, W, D) => {
    mb.box(0.3, 0, 0.4, W - 0.3, 2.9, D - 0.6, { mat: L().metal, col: col('#eceff1'), top: L().roofmetal, topCol: col('#90a4ae') });
    mb.quad([0.7, 0.05, D - 0.58], [W - 0.7, 0.05, D - 0.58], [W - 0.7, 2.2, D - 0.58], [0.7, 2.2, D - 0.58], [0, 0, (W - 1.4) / 16, 2.15 / 16], L().glass, WHITE);
    sign(mb, 'sign_recambios', 0.4, 2.25, W - 0.4, 2.85, D - 0.58);
    for (let k = 0; k < 4; k++) mb.cylinder(W - 0.4, k * 0.2, D - 0.2, 0.32, 0.18, 9, SOLID, col('#212121'));
    crate(mb, 0.3, D - 0.5, 0.5, '#c62828');
  };
  M.wash = (mb, W, D) => {
    /* two bays under a canopy, wet concrete, pressure washer columns */
    mb.quad([0.2, 0.05, D - 0.2], [W - 0.2, 0.05, D - 0.2], [W - 0.2, 0.05, 0.2], [0.2, 0.05, 0.2], [0, 0, W / 16, D / 16], L().concrete, col('#8fa3ad'));
    for (const x of [0.4, W / 2, W - 0.4]) mb.box(x - 0.1, 0, 0.4, x + 0.1, 2.9, 0.6, { col: col('#90a4ae') });
    mb.shed(0, 0, W, D - 0.6, 2.8, 3.2, L().roofmetal, col('#0288d1'), 0.1);
    for (const x of [W / 4, W * 3 / 4]) {
      mb.box(x - 0.25, 0, 0.7, x + 0.25, 1.4, 1.1, { col: col('#fdd835') });
      mb.quad([x - 1.4, 0.07, 3.2], [x + 1.4, 0.07, 3.2], [x + 1.4, 0.07, 1.4], [x - 1.4, 0.07, 1.4], null, SOLID, col('#5b8fb0'));
    }
    sign(mb, 'sign_lavadero', W / 2 - 1.3, 2.3, W / 2 + 1.3, 2.75, 0.62);
  };
  M.rental = (mb, W, D) => {
    const wall = col('#c8e6c9');
    mb.box(0.3, 0, 0.3, W - 0.3, 3.2, 3.8, { mat: L().concrete, col: wall, top: L().roofmetal, topCol: col('#607d8b') });
    mb.quad([0.8, 0.05, 3.82], [4.8, 0.05, 3.82], [4.8, 2.6, 3.82], [0.8, 2.6, 3.82], [0, 0, 4 / 16, 2.6 / 16], L().roller, col('#a5d6a7'));
    sign(mb, 'sign_alquiler', W / 2 - 1.4, 2.6, W / 2 + 1.4, 3.15, 3.82);
    sign(mb, 'door_glass', W - 1.6, 0, W - 0.7, 2.1, 3.82);
    mb.quad([0.3, 0.04, D - 0.3], [W - 0.3, 0.04, D - 0.3], [W - 0.3, 0.04, 4.2], [0.3, 0.04, 4.2], [0, 0, W / 16, 0.25], L().paddockfloor, WHITE);
    /* a row of small rental bikes in the house colours */
    for (let k = 0; k < 4; k++) bakeModel(mb, 'mx_kawara_2t', 1.3 + k * 1.7, 0, 5.8 + (k % 2) * 0.4, -Math.PI / 2 + 0.25, null, 0.72);
  };
  M.shop = (mb, W, D) => {
    mb.box(0.5, 0, 0.5, W - 0.5, 2.5, D - 0.8, { mat: L().wood, col: col('#d7ccc8'), noTop: true });
    mb.shed(0.4, 0.4, W - 0.4, D - 0.3, 2.5, 3.2, L().stripes, col('#7b1fa2'), 0.2);
    sign(mb, 'tshirts', 0.7, 0.9, W - 0.7, 1.9, D - 0.8);
    sign(mb, 'sign_merch', 0.8, 2.0, W - 0.8, 2.45, D - 0.78);
  };
  M.toilets = (mb, W, D) => {
    mb.box(0.4, 0, 0.5, W - 0.4, 2.7, D - 0.4, { mat: L().concrete, col: col('#e0e0e0'), top: L().roofmetal, topCol: col('#9e9e9e') });
    sign(mb, 'sign_wc', W / 2 - 0.6, 2.05, W / 2 + 0.6, 2.6, D - 0.4);
    mb.quad([0.9, 0, D - 0.38], [1.7, 0, D - 0.38], [1.7, 1.9, D - 0.38], [0.9, 1.9, D - 0.38], null, SOLID, col('#1e88e5'));
    mb.quad([2.3, 0, D - 0.38], [3.1, 0, D - 0.38], [3.1, 1.9, D - 0.38], [2.3, 1.9, D - 0.38], null, SOLID, col('#e91e63'));
  };
  M.camping = (mb, W, D) => {
    mb.quad([0.2, 0.03, D - 0.2], [W - 0.2, 0.03, D - 0.2], [W - 0.2, 0.03, 0.2], [0.2, 0.03, 0.2], [0, 0, W / 16, D / 16], L().forest, col('#a5d6a7'));
    tent(mb, 0.8, 0.8, 3.2, 2.6, 1.4, '#ff7043'); tent(mb, 4.8, 1.0, 7.0, 2.6, 1.3, '#42a5f5'); tent(mb, 8.8, 0.8, 11.0, 2.6, 1.4, '#66bb6a');
    tent(mb, 1.0, 5.0, 3.2, 6.6, 1.3, '#fdd835');
    mb.box(5.0, 0.4, 5.0, 9.0, 2.4, 7.0, { col: col('#fafafa'), topCol: col('#e0e0e0') });
    windowZ(mb, 5.6, 1.2, 7.0, 1.9, 7.0);
    mb.cylinder(7.8, 0, 9.5, 0.6, 0.2, 8, SOLID, col('#757575'));
    mb.cone(7.8, 0.2, 9.5, 0.35, 0.6, 6, col('#ff9800'));
    mb.box(W / 2 - 0.05, 0, D - 0.4, W / 2 + 0.05, 1.8, D - 0.3, { col: col('#6d4c41') });
    sign(mb, 'sign_camping', W / 2 - 1.2, 1.8, W / 2 + 1.2, 2.3, D - 0.3);
  };
  M.office = (mb, W, D) => {
    mb.box(0.3, 0, 0.4, W - 0.3, 3.4, D - 0.3, { mat: L().metal, col: col('#eceff1'), top: L().roofmetal, topCol: col('#90a4ae') });
    for (let x = 0.8; x < W - 1.5; x += 1.7) windowZ(mb, x, 1.3, x + 1.2, 2.3, D - 0.3);
    sign(mb, 'door_glass', W - 1.4, 0, W - 0.5, 2.1, D - 0.3);
    sign(mb, 'sign_oficina', W / 2 - 1.3, 2.55, W / 2 + 1.3, 3.2, D - 0.3);
    mb.box(1.0, 3.4, 1.0, 1.8, 3.9, 1.8, { col: col('#b0bec5') });
    mb.cylinder(W - 1.2, 3.4, 1.2, 0.05, 0.6, 6, SOLID, col('#9e9e9e'));
    mb.blob(W - 1.2, 4.1, 1.2, 0.45, 0.12, 0.45, col('#eeeeee'), 7, 0.05);
  };
  M.tower = (mb, W, D) => {
    const c = col('#cfd8dc');
    mb.box(0.6, 0, 0.6, W - 0.6, 6.5, D - 0.6, { mat: L().concrete, col: c });
    for (let y = 1.2; y < 6; y += 2.4) windowZ(mb, 1.3, y, W - 1.3, y + 1.2, D - 0.6);
    mb.box(0.2, 6.5, 0.2, W - 0.2, 6.7, D - 0.2, { col: col('#455a64') });
    mb.box(0.3, 6.7, 0.3, W - 0.3, 9.3, D - 0.3, { mat: L().glass, col: WHITE, noTop: true });
    mb.box(0.0, 9.3, 0.0, W, 9.6, D, { col: col('#263238') });
    mb.box(W / 2 - 0.04, 9.6, D / 2 - 0.04, W / 2 + 0.04, 11.2, D / 2 + 0.04, { col: col('#b0bec5') });
    sign(mb, 'sign_control', 0.3, 9.6, W - 0.3, 10.3, D - 0.3);
    mb.box(W - 0.6, 0, 1.2, W + 0.6, 0.15, 2.6, { col: col('#90a4ae') });
  };
  M.medical = (mb, W, D) => {
    mb.box(0.3, 0, 0.4, W - 0.3, 2.9, D - 0.3, { mat: L().white, col: WHITE, top: L().roofmetal, topCol: col('#b0bec5') });
    mb.box(0.3, 1.9, D - 0.31, W - 0.3, 2.15, D - 0.27, { col: col('#d32f2f') });
    sign(mb, 'sign_medico', W / 2 - 0.5, 2.2, W / 2 + 0.5, 2.85, D - 0.3);
    signX(mb, 'sign_medico', W - 0.28, 1.0, 2.0, D / 2 - 0.5, D / 2 + 0.5);
    sign(mb, 'door', 1.0, 0, 1.9, 1.95, D - 0.3);
  };
  M.depot = (mb, W, D) => {
    const wall = col('#d7c48a');
    mb.box(0, 0, 0, W, 4.0, 0.25, { mat: L().metal, col: wall });
    mb.box(0, 0, 0, 0.25, 4.0, D - 1, { mat: L().metal, col: wall });
    mb.box(W - 0.25, 0, 0, W, 4.0, D - 1, { mat: L().metal, col: wall });
    mb.quad([0, 0.03, D - 1], [W, 0.03, D - 1], [W, 0.03, 0], [0, 0.03, 0], [0, 0, W / 16, D / 16], L().concrete, col('#9e9e9e'));
    mb.gable(0, 0, W, D - 1, 4.0, 5.4, 'z', L().roofmetal, col('#a1887f'), wall, 0.4);
    mb.box(0.25, 0.03, 0.25, W - 0.25, 3.9, 0.3, { col: col('#3e2723') });
    sign(mb, 'sign_mant', W / 2 - 2.0, 4.0, W / 2 + 2.0, 4.6, D - 1);
    mb.cylinder(W + 0.3, 0, 1.5, 0.7, 1.6, 10, SOLID, col('#c62828'));
    mb.blob(1.2, 0.3, D + 0.6, 1.1, 0.6, 0.9, col('#8d6e63'), 3, 0.25);
  };
  M.screen = (mb, W, D) => {
    const truss = col('#546e7a');
    for (const x of [0.6, W - 0.6]) mb.box(x - 0.2, 0, D / 2 - 0.2, x + 0.2, 7.8, D / 2 + 0.2, { col: truss });
    mb.box(0.2, 3.0, D / 2 - 0.25, W - 0.2, 7.8, D / 2 + 0.05, { col: col('#212121') });
    mb.quad([0.5, 3.3, D / 2 + 0.07], [W - 0.5, 3.3, D / 2 + 0.07], [W - 0.5, 7.5, D / 2 + 0.07], [0.5, 7.5, D / 2 + 0.07], [0, 0, (W - 1) / 16, 4.2 / 16], L().screen, WHITE);
    sign(mb, 'logo_mxt', W / 2 - 1.5, 2.2, W / 2 + 1.5, 2.9, D / 2 + 0.05);
    mb.box(W / 2 - 1.6, 0, D / 2 - 0.1, W / 2 + 1.6, 2.2, D / 2 + 0.03, { col: truss });
  };
  M.podium = (mb, W, D) => {
    const c = col('#eceff1');
    mb.box(1.4, 0, 1.4, 2.6, 1.4, 2.6, { col: c }); sign(mb, 'podium_1', 1.6, 0.4, 2.4, 1.2, 2.6);
    mb.box(0.2, 0, 1.4, 1.4, 1.0, 2.6, { col: c }); sign(mb, 'podium_2', 0.4, 0.2, 1.2, 0.9, 2.6);
    mb.box(2.6, 0, 1.4, 3.8, 0.7, 2.6, { col: c }); sign(mb, 'podium_3', 2.8, 0.1, 3.6, 0.6, 2.6);
    mb.box(0.1, 0, 0.6, 3.9, 3.6, 0.8, { col: col('#151515') });
    sign(mb, 'logo_mxt', 0.5, 2.3, 3.5, 3.3, 0.8);
    sign(mb, 'sign_podio', 1.0, 1.6, 3.0, 2.1, 0.8);
  };

  /* Build a placed building in world space. */
  function build(mb, b, game) {
    const d = Cat.buildings[b.type];
    const W = d.w * T, D = d.h * T;
    const w = game.world;
    /* plinth where the ground is lower than the foundation */
    let mn = Infinity;
    for (let vz = b.tz; vz <= b.tz + b.h; vz++) for (let vx = b.tx; vx <= b.tx + b.w; vx++) mn = Math.min(mn, w.vh(vx, vz));
    const x0 = b.tx * T, z0 = b.tz * T, x1 = x0 + b.w * T, z1 = z0 + b.h * T;
    if (mn < b.y - 0.05) mb.box(x0, mn - 0.3, z0, x1, b.y + 0.02, z1, { mat: L().concrete, col: col('#a7a29a'), noTop: !OPEN_FLOOR[b.type] ? false : true });
    mb.push();
    mb.translate(b.cx, b.y, b.cz);
    mb.rotateY(-b.rot * Math.PI / 2);
    mb.translate(-W / 2, 0, -D / 2);
    if (!OPEN_FLOOR[b.type]) mb.box(0.05, -0.2, 0.05, W - 0.05, 0.06, D - 0.05, { mat: L().concrete, col: col('#b8b4ad') });
    (M[b.type] || M.office)(mb, W, D, b);
    mb.pop();
  }
  const OPEN_FLOOR = { paddock: 1, parking: 1, camping: 1, school: 1, playground: 1, wash: 1, depot: 0 };
  /* Mesh for a ghost preview at the origin (local footprint centred). */
  function preview(type, rot) {
    const d = Cat.buildings[type];
    const W = d.w * T, D = d.h * T;
    const mb = new MB(4096);
    mb.push();
    mb.rotateY(-rot * Math.PI / 2);
    mb.translate(-W / 2, 0, -D / 2);
    mb.box(0.05, -0.2, 0.05, W - 0.05, 0.06, D - 0.05, { mat: L().concrete, col: col('#b8b4ad') });
    (M[type] || M.office)(mb, W, D, { id: 1 });
    mb.pop();
    return mb.build();
  }

  /* Decorations (non-tree scenery) */
  function decor(mb, o, x, y, z, game) {
    const t = o.type;
    mb.push();
    mb.translate(x, y, z);
    mb.rotateY(o.rot || 0);
    if (t === 'flowers') {
      mb.box(-1.0, 0, -1.0, 1.0, 0.25, 1.0, { mat: L().dirt, col: col('#8d6e63') });
      const cs = ['#e53935', '#fdd835', '#ab47bc', '#ffffff', '#ff7043'];
      for (let i = 0; i < 9; i++) mb.blob(-0.7 + (i % 3) * 0.7, 0.4, -0.7 + Math.floor(i / 3) * 0.7, 0.28, 0.2, 0.28, col(i % 2 ? '#66bb6a' : cs[(i + o.v) % 5]), i + o.id, 0.2);
    } else if (t === 'flag') {
      mb.box(-0.05, 0, -0.05, 0.05, 5, 0.05, { col: col('#e0e0e0') });
      const fc = ['#ff6a13', '#1e88e5', '#fdd835', '#e53935'][o.v % 4];
      mb.quad([0, 4.0, 0], [1.6, 4.1, 0], [1.6, 4.9, 0], [0, 5.0, 0], null, SOLID, col(fc));
      mb.quad([1.6, 4.1, 0], [0, 4.0, 0], [0, 5.0, 0], [1.6, 4.9, 0], null, SOLID, col(fc, 0.85));
    } else if (t === 'banner' || t === 'arch') {
      const sp = o.sponsor ? Cat.sponsors.find(s => s.id === o.sponsor) : null;
      const logo = sp ? 'logo_' + sp.id : 'logo_mxt';
      if (t === 'banner') {
        mb.box(-1.85, 0, -0.05, -1.75, 1.6, 0.05, { col: col('#9e9e9e') }); mb.box(1.75, 0, -0.05, 1.85, 1.6, 0.05, { col: col('#9e9e9e') });
        sign(mb, logo, -1.8, 0.3, 1.8, 1.5, 0.0); sign(mb, logo, -1.8, 0.3, 1.8, 1.5, 0.0, true);
      } else {
        const c1 = sp ? col(sp.c1) : col('#ff6a13');
        for (const sx of [-1.9, 1.9]) mb.cylinder(sx, 0, 0, 0.42, 3.4, 10, SOLID, c1);
        for (let k = 0; k < 8; k++) {
          const a0 = Math.PI * k / 8, a1 = Math.PI * (k + 1) / 8;
          const p0 = [-Math.cos(a0) * 1.9, 3.4 + Math.sin(a0) * 1.4], p1 = [-Math.cos(a1) * 1.9, 3.4 + Math.sin(a1) * 1.4];
          mb.box(Math.min(p0[0], p1[0]) - 0.35, Math.min(p0[1], p1[1]) - 0.35, -0.42, Math.max(p0[0], p1[0]) + 0.35, Math.max(p0[1], p1[1]) + 0.35, 0.42, { col: c1 });
        }
        sign(mb, logo, -1.4, 4.2, 1.4, 4.95, 0.44); sign(mb, logo, -1.4, 4.2, 1.4, 4.95, -0.44, true);
      }
    } else if (t === 'haybales') {
      for (let i = 0; i < 3; i++) mb.box(-1.8 + i * 1.2, 0, -0.45, -0.7 + i * 1.2, 0.8, 0.45, { mat: L().hay, col: WHITE });
      mb.box(-1.2, 0.8, -0.45, -0.1, 1.6, 0.45, { mat: L().hay, col: WHITE });
    } else if (t === 'tires') {
      for (let i = 0; i < 5; i++) for (let k = 0; k < 3; k++) mb.cylinder(-1.6 + i * 0.8, k * 0.25, 0, 0.38, 0.24, 9, SOLID, col(k === 2 ? (i % 2 ? '#e53935' : '#fafafa') : '#1d1d1d'));
    } else if (t === 'safetyfence') {
      for (let i = 0; i < 2; i++) {
        const x0 = -1.9 + i * 1.95, x1 = x0 + 1.85;
        mb.box(x0, 0, -0.25, x1, 0.25, 0.25, { col: col('#e53935') });
        mb.box(x0 + 0.1, 0.25, -0.12, x1 - 0.1, 1.0, 0.12, { col: col(i % 2 ? '#e53935' : '#fafafa') });
      }
    } else if (t === 'statue') {
      mb.box(-1.0, 0, -1.0, 1.0, 1.4, 1.0, { mat: L().concrete, col: col('#bdbdbd') });
      mb.box(-1.2, 0, -1.2, 1.2, 0.3, 1.2, { mat: L().concrete, col: col('#9e9e9e') });
      mb.pop();
      for (const part of ['mx_kronos_4t', 'rb_stand']) bakeModel(mb, part, x, y + 1.4, z, o.rot || 0, null, 1.25, [222, 182, 66]);
      return;
    }
    mb.pop();
    void game;
  }
  function decorPreview(type) {
    const mb = new MB(2048);
    const o = { type, rot: 0, v: 0, id: 1, sponsor: null };
    if (MX.Models.lib[type]) {
      bakeModel(mb, type, 0, 0, 0, 0.6, [[120, 190, 100], [255, 255, 255], [255, 255, 255], [255, 255, 255]]);
    } else decor(mb, o, 0, 0, 0, null);
    return mb.build();
  }

  MX.BuildModels = { build, preview, decor, decorPreview, bakeModel };
  void U;
})(window.MX);
