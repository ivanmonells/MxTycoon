/* MX Tycoon - model library: low-poly motocross, enduro and flat track bikes in the
   factory colours of each make, buggies, riders in their kit, people and staff, voxel
   service vehicles and low-poly trees. Every model faces +X with its origin on the
   ground and +Z on its right-hand side. Colour slots on riders: 1 accent, 2 pants,
   3 jersey, 4 helmet; on people: 1 shirt, 2 trousers, 3 hair, 4 skin. */
(function (MX) {
  'use strict';
  const V = MX.VoxModel, MB = MX.MeshBuilder, Cat = MX.Catalog;
  const SOLID = MB.MAT_SOLID;
  const C = (h) => MB.rgba(h);
  const WH = [1, 1, 1, 1];
  const shade = (c, k) => MB.mulCol(c, k);

  /* ---------------- geometry helpers ---------------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const at3 = (p, z) => [p[0], p[1], z];

  /* axes of a ring around direction d, u following the hint where it can */
  function axes(d, hint) {
    let u = null;
    if (hint) {
      const k = dot(hint, d);
      u = [hint[0] - d[0] * k, hint[1] - d[1] * k, hint[2] - d[2] * k];
      if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = null;
    }
    if (!u) u = cross(Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], d);
    u = norm(u);
    return [u, cross(d, u)];
  }
  /* prism from a to b through two rings of [u, v] offsets listed counter-clockwise */
  function loft(mb, a, b, ra, rb, col, hint, caps) {
    const d = norm(sub(b, a)), [u, v] = axes(d, hint);
    const pt = (c, o) => [c[0] + u[0] * o[0] + v[0] * o[1], c[1] + u[1] * o[0] + v[1] * o[1], c[2] + u[2] * o[0] + v[2] * o[1]];
    const A = ra.map(o => pt(a, o)), B = rb.map(o => pt(b, o)), n = A.length;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; mb.quad(A[i], A[j], B[j], B[i], null, SOLID, col); }
    if (caps !== false) for (let i = 1; i < n - 1; i++) { mb.tri(B[0], B[i], B[i + 1], null, SOLID, col); mb.tri(A[0], A[i + 1], A[i], null, SOLID, col); }
  }
  const RINGS = {};
  function ring(n, r) {
    const k = n + ':' + r;
    return RINGS[k] || (RINGS[k] = Array.from({ length: n }, (_, i) => [Math.cos((i + 0.5) / n * Math.PI * 2) * r, Math.sin((i + 0.5) / n * Math.PI * 2) * r]));
  }
  /* round tube of radius ra at a narrowing to rb at b */
  function limb(mb, a, b, ra, rb, col, sides, caps) { loft(mb, a, b, ring(sides || 6, ra), ring(sides || 6, rb), col, null, caps); }
  /* bar of half width w (along the hint, Z by default) and half thickness t */
  function slab(mb, a, b, wa, ta, wb, tb, col, hint) {
    const R = (w, t) => [[w, t], [-w, t], [-w, -t], [w, -t]];
    loft(mb, a, b, R(wa, ta), R(wb, tb), col, hint || [0, 0, 1], true);
  }
  /* rounded trunk: elliptical section of half width w (side to side) and half depth d */
  function trunk(mb, a, b, wa, da, wb, db, col) {
    const E = (w, d) => Array.from({ length: 8 }, (_, i) => [Math.cos((i + 0.5) / 8 * Math.PI * 2) * w, Math.sin((i + 0.5) / 8 * Math.PI * 2) * d]);
    loft(mb, a, b, E(wa, da), E(wb, db), col, [0, 0, 1], true);
  }
  /* tube through a list of [x, y, z, r] points */
  function tube(mb, pts, col, sides) {
    for (let i = 0; i + 1 < pts.length; i++) limb(mb, pts[i], pts[i + 1], pts[i][3], pts[i + 1][3], col, sides || 6, true);
  }
  function ellipsoid(mb, c, rx, ry, rz, col, seg, rings) {
    seg = seg || 8; rings = rings || 5;
    const P = (j, i) => {
      const th = -Math.PI / 2 + Math.PI * j / rings, ph = Math.PI * 2 * i / seg;
      return [c[0] + Math.cos(th) * Math.cos(ph) * rx, c[1] + Math.sin(th) * ry, c[2] + Math.cos(th) * Math.sin(ph) * rz];
    };
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = P(j, i), b = P(j + 1, i), e = P(j + 1, i + 1), d = P(j, i + 1);
      if (j === 0) mb.tri(a, b, e, null, SOLID, col);
      else if (j === rings - 1) mb.tri(a, e, d, null, SOLID, col);
      else mb.quad(a, b, e, d, null, SOLID, col);
    }
  }
  /* convex side-view polygon (x, y) extruded between depths z0 and z1 */
  function panel(mb, pts, z0, z1, col, edge) {
    let A = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; }
    if (A < 0) pts = pts.slice().reverse();
    const n = pts.length, zb = Math.min(z0, z1), zt = Math.max(z0, z1);
    for (let i = 1; i < n - 1; i++) {
      mb.tri(at3(pts[0], zt), at3(pts[i], zt), at3(pts[i + 1], zt), null, SOLID, col);
      mb.tri(at3(pts[0], zb), at3(pts[i + 1], zb), at3(pts[i], zb), null, SOLID, col);
    }
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; mb.quad(at3(p, zb), at3(q, zb), at3(q, zt), at3(p, zt), null, SOLID, edge || col); }
  }
  /* the same panel on both sides of the bike, between |zi| and |zo| */
  function panels(mb, pts, zi, zo, col, edge) { panel(mb, pts, zi, zo, col, edge); panel(mb, pts, -zo, -zi, col, edge); }

  /* ---------------- wheels ---------------- */
  /* knobbly tyre, rim, spokes, hub and brake disc around (cx, cy), axle along Z */
  function wheel(mb, cx, cy, R, rimR, w, k) {
    const n = 14, hw = w / 2, rw = hw * 0.62, ri = rimR - 0.032;
    const pt = (r, a, z) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z];
    const knobR = k.slick ? R : R * 0.952;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const knob = i % 2 === 0, ro = knob ? R : knobR;
      mb.quad(pt(ro, a0, -hw), pt(ro, a1, -hw), pt(ro, a1, hw), pt(ro, a0, hw), null, SOLID, k.tire);
      mb.quad(pt(rimR, a0, hw), pt(ro, a0, hw), pt(ro, a1, hw), pt(rimR, a1, hw), null, SOLID, k.wall);
      mb.quad(pt(rimR, a0, -hw), pt(rimR, a1, -hw), pt(ro, a1, -hw), pt(ro, a0, -hw), null, SOLID, k.wall);
      if (knob && !k.slick) {
        mb.quad(pt(knobR, a0, -hw), pt(R, a0, -hw), pt(R, a0, hw), pt(knobR, a0, hw), null, SOLID, k.tire);
        mb.quad(pt(knobR, a1, -hw), pt(knobR, a1, hw), pt(R, a1, hw), pt(R, a1, -hw), null, SOLID, k.tire);
      }
      mb.quad(pt(ri, a0, rw), pt(rimR, a0, rw), pt(rimR, a1, rw), pt(ri, a1, rw), null, SOLID, k.rim);
      mb.quad(pt(ri, a0, -rw), pt(ri, a1, -rw), pt(rimR, a1, -rw), pt(rimR, a0, -rw), null, SOLID, k.rim);
    }
    limb(mb, [cx, cy, -hw * 1.1], [cx, cy, hw * 1.1], k.hubR || 0.045, k.hubR || 0.045, k.hub, 8);
    const tri = ring(3, 0.0075);
    for (let s = 0; s < 10; s++) {
      const side = s % 2 ? 1 : -1, a = s / 10 * Math.PI * 2;
      loft(mb, pt(0.04, a, side * hw * 0.85), pt(ri, a + 0.5 * side, side * rw * 0.5), tri, tri, k.spoke, null, false);
    }
    if (k.disc) limb(mb, [cx, cy, k.discZ - 0.005], [cx, cy, k.discZ + 0.005], k.discR || 0.12, k.discR || 0.12, k.disc, 12);
  }

  /* ---------------- motocross and enduro bikes ---------------- */
  /* L: factory colours of the make (see Catalog.brands); o.two: two-stroke engine;
     o.enduro: headlight, hand guards, tail light and registration plate */
  function mxBike(mb, L, o) {
    o = o || {};
    const main = C(L.main), gfx = C(L.gfx), frameC = C(L.frame), seatC = C(L.seat), sideC = C(L.side || L.main);
    const plateC = C(L.plate || '#f3f3f3'), digit = C(L.digit || '#1e1e1e'), fender = C(L.fender || L.main), rfender = C(L.rfender || L.fender || L.main);
    const forkC = C(L.fork || '#d4a017'), guard = C(L.guard || '#1e1e1e'), clampC = C(L.clamp || '#b9bdc2'), spring = C(L.spring || '#e0e0e0');
    const engine = C('#2c2d30'), alu = C('#b7bbc0'), dark = C('#242528'), black = C('#151516'), chrome = C('#dfe3e7');
    const wk = { tire: C('#19191a'), wall: C('#252527'), rim: C(L.rim || '#1e1e1e'), hub: C('#c3c7cc'), spoke: C('#a3a8ae'), disc: C('#a9adb3') };
    /* wheels: 19" rear, 21" front */
    wheel(mb, -0.72, 0.325, 0.325, 0.245, 0.12, Object.assign({ discZ: 0.075, discR: 0.105 }, wk));
    wheel(mb, 0.74, 0.345, 0.345, 0.265, 0.09, Object.assign({ discZ: -0.06, discR: 0.13 }, wk));
    /* swingarm, chain and rear sprocket (chain on the left) */
    for (const s of [-1, 1]) slab(mb, [-0.07, 0.43, s * 0.076], [-0.73, 0.33, s * 0.076], 0.02, 0.045, 0.016, 0.03, alu);
    limb(mb, [0.03, 0.40, -0.1], [-0.72, 0.425, -0.1], 0.009, 0.009, dark, 4);
    limb(mb, [0.03, 0.30, -0.1], [-0.72, 0.225, -0.1], 0.009, 0.009, dark, 4);
    limb(mb, [-0.72, 0.325, -0.104], [-0.72, 0.325, -0.092], 0.1, 0.1, C('#c9a227'), 12);
    /* engine: crankcase, cylinder and head leaning forward, side covers */
    slab(mb, [-0.11, 0.335, 0], [0.26, 0.35, 0], 0.105, 0.125, 0.1, 0.11, engine);
    slab(mb, [0.09, 0.44, 0], [0.17, 0.62, 0], 0.07, 0.07, 0.068, 0.068, o.two ? C('#8e9298') : C('#3a3c40'));
    if (o.two) for (let k = 0; k < 3; k++) slab(mb, [0.105 + k * 0.025, 0.48 + k * 0.045, 0], [0.11 + k * 0.025, 0.495 + k * 0.045, 0], 0.085, 0.085, 0.085, 0.085, C('#9da1a7'));
    else slab(mb, [0.17, 0.61, 0], [0.2, 0.69, 0], 0.08, 0.085, 0.075, 0.075, C(L.head || '#1f2023'));
    limb(mb, [0.07, 0.33, 0.1], [0.07, 0.33, 0.126], 0.085, 0.08, C('#8e9399'), 10);
    limb(mb, [-0.02, 0.35, -0.1], [-0.02, 0.35, -0.124], 0.075, 0.07, C('#8e9399'), 10);
    slab(mb, [-0.06, 0.2, 0], [0.3, 0.215, 0], 0.08, 0.012, 0.075, 0.012, o.enduro ? alu : dark);
    /* radiators behind the shrouds */
    panels(mb, [[0.24, 0.54], [0.4, 0.58], [0.42, 0.8], [0.26, 0.79]], 0.05, 0.11, C('#4a4e54'));
    /* frame: spars, cradle, downtube and subframe */
    const frm = (a, b, r) => limb(mb, a, b, r, r, frameC, 6);
    for (const s of [-1, 1]) {
      frm([0.43, 0.9, s * 0.05], [0.03, 0.72, s * 0.092], 0.026);
      frm([0.03, 0.72, s * 0.092], [-0.08, 0.44, s * 0.082], 0.026);
      frm([0.3, 0.22, s * 0.05], [-0.06, 0.17, s * 0.052], 0.017);
      frm([-0.06, 0.17, s * 0.052], [-0.08, 0.44, s * 0.072], 0.017);
      limb(mb, [0.03, 0.76, s * 0.08], [-0.6, 0.875, s * 0.068], 0.015, 0.012, alu, 5);
      limb(mb, [-0.07, 0.5, s * 0.07], [-0.52, 0.85, s * 0.064], 0.012, 0.011, alu, 5);
    }
    frm([0.43, 0.86, 0], [0.31, 0.22, 0], 0.024);
    limb(mb, [0.39, 0.8, 0], [0.48, 1.0, 0], 0.032, 0.032, frameC, 8);
    /* shock and airbox under the seat */
    limb(mb, [-0.12, 0.4, 0], [-0.21, 0.79, 0], 0.044, 0.04, spring, 8);
    limb(mb, [-0.21, 0.79, 0.02], [-0.33, 0.83, 0.05], 0.026, 0.026, alu, 6);
    slab(mb, [-0.1, 0.8, 0], [-0.46, 0.81, 0], 0.085, 0.11, 0.08, 0.1, dark);
    /* fork: axle lugs, guards, inner tubes, outer tubes and triple clamps */
    const F = [0.74, 0.345], T = [0.47, 1.0];
    const ax = norm([T[0] - F[0], T[1] - F[1], 0]), Lf = Math.hypot(T[0] - F[0], T[1] - F[1]);
    const fk = (s, z) => [F[0] + ax[0] * s, F[1] + ax[1] * s, z];
    for (const s of [-1, 1]) {
      const z = s * 0.078;
      limb(mb, fk(-0.03, z), fk(0.06, z), 0.03, 0.03, dark, 6);
      slab(mb, fk(0.03, z + s * 0.006), fk(0.3, z + s * 0.008), 0.024, 0.045, 0.022, 0.038, guard);
      limb(mb, fk(0.26, z), fk(0.4, z), 0.022, 0.022, chrome, 6);
      limb(mb, fk(0.37, z), fk(Lf + 0.02, z), 0.034, 0.032, forkC, 8);
    }
    slab(mb, fk(Lf * 0.72, 0), fk(Lf * 0.72 + 0.04, 0), 0.118, 0.055, 0.118, 0.055, clampC);
    slab(mb, fk(Lf - 0.035, 0), fk(Lf + 0.005, 0), 0.115, 0.05, 0.115, 0.05, clampC);
    /* handlebar, pad, grips and levers */
    const bc = [0.45, 1.06, 0];
    for (const s of [-1, 1]) {
      limb(mb, bc, [0.41, 1.09, s * 0.4], 0.012, 0.012, C(L.bar || '#2a2a2c'), 6);
      limb(mb, [0.405, 1.09, s * 0.3], [0.4, 1.092, s * 0.42], 0.02, 0.02, black, 6);
      limb(mb, [0.415, 1.09, s * 0.29], [0.51, 1.06, s * 0.37], 0.007, 0.007, alu, 4);
      if (o.enduro) slab(mb, [0.43, 1.1, s * 0.34], [0.53, 1.085, s * 0.43], 0.012, 0.045, 0.01, 0.04, main, [0, 1, 0]);
    }
    slab(mb, [0.455, 1.085, -0.1], [0.455, 1.085, 0.1], 0.03, 0.026, 0.03, 0.026, C(L.pad || L.main), [1, 0, 0]);
    /* front plate (or headlight mask) with its number */
    const pb = [0.6, 0.8, 0], pt = [0.535, 1.04, 0];
    slab(mb, pb, pt, 0.11, 0.01, 0.15, 0.01, plateC);
    const pd = norm(sub(pt, pb)), pv = [pd[1], -pd[0], 0];
    const onPlate = (t, z, out) => [pb[0] + (pt[0] - pb[0]) * t + pv[0] * out, pb[1] + (pt[1] - pb[1]) * t + pv[1] * out, z];
    if (o.enduro) {
      limb(mb, onPlate(0.42, 0, 0.005), onPlate(0.42, 0, 0.045), 0.06, 0.055, black, 10);
      limb(mb, onPlate(0.42, 0, 0.044), onPlate(0.42, 0, 0.05), 0.048, 0.048, C('#fff3c4'), 10);
    } else for (const z of [-0.045, 0.045]) slab(mb, onPlate(0.3, z, 0.012), onPlate(0.78, z, 0.012), 0.024, 0.004, 0.026, 0.004, digit);
    /* front fender, shrouds with graphics, tank and seat */
    slab(mb, [0.55, 0.785, 0], [0.82, 0.78, 0], 0.07, 0.012, 0.068, 0.012, fender);
    slab(mb, [0.82, 0.78, 0], [1.1, 0.7, 0], 0.068, 0.012, 0.05, 0.01, fender);
    panels(mb, [[0.5, 0.97], [0.17, 0.935], [0.15, 0.8], [0.21, 0.64], [0.37, 0.6], [0.51, 0.79]], 0.1, 0.152, main, shade(main, 0.82));
    panels(mb, [[0.46, 0.9], [0.18, 0.865], [0.18, 0.79], [0.43, 0.75]], 0.152, 0.158, gfx);
    slab(mb, [0.15, 0.9, 0], [0.46, 0.925, 0], 0.1, 0.065, 0.075, 0.055, C(L.tank || L.main));
    slab(mb, [0.38, 0.975, 0], [-0.6, 0.99, 0], 0.085, 0.036, 0.075, 0.032, seatC);
    /* side number plates, rear fender */
    const sidePts = [[-0.1, 0.935], [-0.53, 0.955], [-0.48, 0.7], [-0.19, 0.62]];
    panels(mb, sidePts, 0.085, 0.124, sideC);
    for (const x of [-0.41, -0.3]) panels(mb, [[x, 0.86], [x - 0.06, 0.86], [x - 0.06, 0.72], [x, 0.72]], 0.124, 0.128, digit);
    slab(mb, [-0.4, 0.975, 0], [-1.02, 1.05, 0], 0.11, 0.013, 0.07, 0.011, rfender);
    if (o.enduro) {
      slab(mb, [-0.97, 1.0, 0], [-0.99, 0.84, 0], 0.08, 0.006, 0.08, 0.006, C('#f4f4f4'));
      slab(mb, [-1.0, 1.03, 0], [-1.03, 1.0, 0], 0.035, 0.02, 0.035, 0.02, C('#d32f2f'));
    }
    /* exhaust on the right: expansion chamber or header, and the silencer */
    if (o.two) {
      tube(mb, [[0.19, 0.6, 0.04, 0.026], [0.31, 0.51, 0.07, 0.04], [0.33, 0.33, 0.105, 0.058], [0.15, 0.22, 0.135, 0.066], [-0.08, 0.29, 0.152, 0.055], [-0.21, 0.47, 0.152, 0.03]], C('#5c5955'), 8);
      limb(mb, [-0.24, 0.56, 0.15], [-0.62, 0.8, 0.13], 0.042, 0.04, C('#cfd3d8'), 8);
      limb(mb, [-0.62, 0.8, 0.13], [-0.66, 0.822, 0.128], 0.03, 0.026, dark, 8);
    } else {
      tube(mb, [[0.2, 0.62, 0.045, 0.024], [0.28, 0.55, 0.085, 0.024], [0.26, 0.4, 0.125, 0.024], [0.08, 0.37, 0.15, 0.024], [-0.1, 0.48, 0.158, 0.024], [-0.15, 0.56, 0.156, 0.03]], C('#a5866a'), 6);
      limb(mb, [-0.15, 0.56, 0.156], [-0.7, 0.84, 0.132], 0.055, 0.048, C('#cfd3d8'), 8);
      limb(mb, [-0.7, 0.84, 0.132], [-0.755, 0.866, 0.13], 0.04, 0.034, C('#2a2a2c'), 8);
    }
    /* footpegs */
    for (const s of [-1, 1]) limb(mb, [-0.06, 0.4, s * 0.12], [-0.06, 0.4, s * 0.215], 0.018, 0.018, alu, 4);
  }

  /* ---------------- flat track bike ---------------- */
  /* low and long, 19" wheels front and rear, no fenders, a tail section with the
     number, single or V-twin engine with high pipes */
  function flatBike(mb, L, o) {
    o = o || {};
    const main = C(L.main), gfx = C(L.gfx), frameC = C(L.frame), seatC = C(L.seat), plateC = C(L.plate || '#ffd400'), digit = C(L.digit || '#1e1e1e');
    const engine = C('#2f3034'), alu = C('#b7bbc0'), dark = C('#242528'), black = C('#151516'), chrome = C('#dfe3e7');
    const wk = { tire: C('#1c1c1d'), wall: C('#262628'), rim: C(L.rim || '#1e1e1e'), hub: C('#c3c7cc'), spoke: C('#a3a8ae'), disc: C('#a9adb3') };
    wheel(mb, -0.7, 0.315, 0.315, 0.24, 0.13, Object.assign({ discZ: 0.08, discR: 0.11 }, wk));
    wheel(mb, 0.74, 0.315, 0.315, 0.24, 0.1, Object.assign({}, wk, { disc: null }));
    for (const s of [-1, 1]) slab(mb, [-0.05, 0.4, s * 0.08], [-0.71, 0.315, s * 0.08], 0.02, 0.04, 0.016, 0.03, frameC);
    limb(mb, [0.03, 0.37, -0.1], [-0.7, 0.4, -0.1], 0.009, 0.009, dark, 4);
    limb(mb, [0.03, 0.29, -0.1], [-0.7, 0.23, -0.1], 0.009, 0.009, dark, 4);
    /* engine */
    slab(mb, [-0.12, 0.33, 0], [0.26, 0.34, 0], 0.11, 0.12, 0.1, 0.11, engine);
    if (o.twin) {
      for (const [a, b] of [[[0.06, 0.42], [0.2, 0.66]], [[-0.02, 0.42], [-0.12, 0.66]]]) {
        slab(mb, [a[0], a[1], 0], [b[0], b[1], 0], 0.075, 0.075, 0.072, 0.072, C('#9a9ea4'));
        for (let k = 1; k < 4; k++) { const p = mix([a[0], a[1], 0], [b[0], b[1], 0], k / 4); slab(mb, p, mix(p, [b[0], b[1], 0], 0.12), 0.09, 0.09, 0.09, 0.09, C('#b4b8bd')); }
      }
    } else {
      slab(mb, [0.08, 0.43, 0], [0.15, 0.62, 0], 0.075, 0.075, 0.07, 0.07, C('#3a3c40'));
      slab(mb, [0.15, 0.61, 0], [0.18, 0.68, 0], 0.08, 0.085, 0.075, 0.075, C('#1f2023'));
    }
    limb(mb, [0.06, 0.32, 0.1], [0.06, 0.32, 0.126], 0.085, 0.08, C('#8e9399'), 10);
    /* frame */
    for (const s of [-1, 1]) {
      limb(mb, [0.42, 0.84, s * 0.05], [0.02, 0.66, s * 0.085], 0.024, 0.024, frameC, 6);
      limb(mb, [0.02, 0.66, s * 0.085], [-0.05, 0.4, s * 0.078], 0.024, 0.024, frameC, 6);
      limb(mb, [0.02, 0.7, s * 0.07], [-0.62, 0.8, s * 0.06], 0.014, 0.012, frameC, 5);
    }
    limb(mb, [0.42, 0.8, 0], [0.3, 0.2, 0], 0.024, 0.02, frameC, 6);
    limb(mb, [0.38, 0.76, 0], [0.47, 0.95, 0], 0.03, 0.03, frameC, 8);
    limb(mb, [-0.12, 0.38, 0], [-0.24, 0.74, 0], 0.042, 0.038, C(L.spring || '#e0e0e0'), 8);
    /* fork (no front brake) and clamps */
    const F = [0.74, 0.315], T = [0.46, 0.95];
    const ax = norm([T[0] - F[0], T[1] - F[1], 0]), Lf = Math.hypot(T[0] - F[0], T[1] - F[1]);
    const fk = (s, z) => [F[0] + ax[0] * s, F[1] + ax[1] * s, z];
    for (const s of [-1, 1]) {
      const z = s * 0.08;
      limb(mb, fk(-0.03, z), fk(0.32, z), 0.03, 0.028, C(L.fork || '#2a2a2a'), 8);
      limb(mb, fk(0.3, z), fk(Lf + 0.02, z), 0.024, 0.024, chrome, 6);
    }
    slab(mb, fk(Lf * 0.72, 0), fk(Lf * 0.72 + 0.035, 0), 0.12, 0.05, 0.12, 0.05, C(L.clamp || '#1e1e1e'));
    slab(mb, fk(Lf - 0.03, 0), fk(Lf + 0.005, 0), 0.115, 0.045, 0.115, 0.045, C(L.clamp || '#1e1e1e'));
    /* wide flat bars */
    for (const s of [-1, 1]) {
      limb(mb, [0.44, 0.99, 0], [0.4, 0.99, s * 0.43], 0.012, 0.012, black, 6);
      limb(mb, [0.4, 0.99, s * 0.33], [0.395, 0.99, s * 0.45], 0.02, 0.02, black, 6);
    }
    /* front number plate */
    const pb = [0.6, 0.74, 0], pt = [0.55, 0.96, 0];
    slab(mb, pb, pt, 0.12, 0.01, 0.14, 0.01, plateC);
    const pd = norm(sub(pt, pb)), pv = [pd[1], -pd[0], 0];
    const onPlate = (t, z) => [pb[0] + (pt[0] - pb[0]) * t + pv[0] * 0.012, pb[1] + (pt[1] - pb[1]) * t + pv[1] * 0.012, z];
    for (const z of [-0.045, 0.045]) slab(mb, onPlate(0.25, z), onPlate(0.78, z), 0.024, 0.004, 0.026, 0.004, digit);
    /* teardrop tank with a stripe, seat and tail section with the side numbers */
    ellipsoid(mb, [0.25, 0.86, 0], 0.22, 0.09, 0.12, main, 10, 5);
    slab(mb, [0.07, 0.905, 0], [0.43, 0.9, 0], 0.035, 0.03, 0.02, 0.02, gfx);
    slab(mb, [0.04, 0.86, 0], [-0.4, 0.875, 0], 0.09, 0.035, 0.085, 0.035, seatC);
    panels(mb, [[-0.32, 0.98], [-0.72, 0.95], [-0.72, 0.78], [-0.36, 0.8]], 0.0, 0.11, C(L.side || L.main), shade(C(L.side || L.main), 0.85));
    for (const x of [-0.5, -0.4]) panels(mb, [[x, 0.93], [x - 0.07, 0.93], [x - 0.07, 0.82], [x, 0.82]], 0.11, 0.114, digit);
    /* high pipes on the right */
    if (o.twin) {
      for (const [y0, k] of [[0.62, 0], [0.6, 1]]) tube(mb, [[0.2 - k * 0.3, y0, 0.07, 0.024], [0.06 - k * 0.15, 0.7, 0.14, 0.026], [-0.3, 0.74 + k * 0.03, 0.16 - k * 0.02, 0.03], [-0.68, 0.84 + k * 0.03, 0.16 - k * 0.02, 0.036]], chrome, 6);
    } else {
      tube(mb, [[0.2, 0.62, 0.06, 0.025], [0.1, 0.7, 0.14, 0.028], [-0.3, 0.74, 0.16, 0.035]], C('#a5866a'), 6);
      limb(mb, [-0.3, 0.74, 0.16], [-0.7, 0.86, 0.15], 0.05, 0.045, C('#cfd3d8'), 8);
    }
    for (const s of [-1, 1]) limb(mb, [-0.04, 0.34, s * 0.12], [-0.04, 0.34, s * 0.2], 0.018, 0.018, alu, 4);
  }

  /* ---------------- car cross buggy ---------------- */
  /* tube frame, side pods and roof in the team colour (slot 1, stripes slot 2), engine
     behind the driver; the driver's suit is slot 3 and the helmet slot 4 */
  function buggy(mb) {
    const tube = C('#2b2b2e'), dark = C('#1d1d1f'), alu = C('#b7bbc0');
    const wk = { tire: C('#1a1a1b'), wall: C('#232325'), rim: C('#c3c7cc'), hub: C('#8e9399'), spoke: C('#c3c7cc'), slick: false };
    for (const [x, r] of [[-1.02, 0.32], [1.0, 0.3]]) for (const s of [-1, 1]) {
      mb.push(); mb.translate(0, 0, s * 0.8); wheel(mb, x, r, r, r * 0.66, 0.24, Object.assign({ hubR: 0.07 }, wk)); mb.pop();
      /* suspension arms */
      limb(mb, [x, r, s * 0.66], [x * 0.75, r + 0.06, s * 0.3], 0.02, 0.02, alu, 4);
      limb(mb, [x, r, s * 0.66], [x * 0.75, r - 0.08, s * 0.3], 0.02, 0.02, alu, 4);
    }
    /* floor pan and tube cage */
    slab(mb, [-1.15, 0.24, 0], [1.25, 0.24, 0], 0.32, 0.03, 0.28, 0.03, dark);
    const cage = (a, b) => limb(mb, a, b, 0.024, 0.024, tube, 5);
    for (const s of [-1, 1]) {
      cage([-0.5, 0.28, s * 0.34], [-0.42, 1.18, s * 0.3]);
      cage([0.3, 0.28, s * 0.34], [0.12, 1.12, s * 0.3]);
      cage([-0.42, 1.18, s * 0.3], [0.12, 1.12, s * 0.3]);
      cage([0.3, 0.28, s * 0.34], [1.15, 0.36, s * 0.2]);
      cage([0.12, 1.12, s * 0.3], [1.0, 0.5, s * 0.22]);
      cage([-0.42, 1.18, s * 0.3], [-1.1, 0.62, s * 0.26]);
    }
    cage([-0.42, 1.18, -0.3], [-0.42, 1.18, 0.3]); cage([0.12, 1.12, -0.3], [0.12, 1.12, 0.3]);
    /* body: side pods and roof (slot 1) with a stripe (slot 2), nose */
    mb.setSlot(1);
    panels(mb, [[-0.55, 0.3], [0.5, 0.3], [0.62, 0.62], [-0.45, 0.72]], 0.32, 0.38, WH, shade(WH, 0.82));
    slab(mb, [-0.5, 1.2, 0], [0.18, 1.14, 0], 0.33, 0.015, 0.33, 0.015, WH, [0, 0, 1]);
    slab(mb, [0.55, 0.42, 0], [1.25, 0.4, 0], 0.26, 0.1, 0.2, 0.06, WH);
    mb.setSlot(2);
    panels(mb, [[-0.5, 0.48], [0.52, 0.46], [0.56, 0.54], [-0.48, 0.58]], 0.38, 0.386, WH);
    mb.setSlot(0);
    panels(mb, [[-0.2, 0.36], [0.14, 0.36], [0.14, 0.56], [-0.2, 0.56]], 0.386, 0.39, C('#f5f5f5'));
    panels(mb, [[-0.12, 0.4], [-0.08, 0.4], [-0.08, 0.52], [-0.12, 0.52]], 0.39, 0.393, C('#1e1e1e'));
    panels(mb, [[0.0, 0.4], [0.06, 0.4], [0.06, 0.52], [0.0, 0.52]], 0.39, 0.393, C('#1e1e1e'));
    /* engine and exhaust at the back, rear wing */
    slab(mb, [-1.15, 0.5, 0], [-0.6, 0.5, 0], 0.22, 0.2, 0.24, 0.22, C('#55585d'));
    limb(mb, [-0.95, 0.5, 0.2], [-1.3, 0.7, 0.24], 0.04, 0.036, C('#cfd3d8'), 6);
    mb.setSlot(1);
    slab(mb, [-1.18, 1.0, -0.42], [-1.18, 1.0, 0.42], 0.16, 0.012, 0.16, 0.012, WH, [1, 0, 0]);
    mb.setSlot(0);
    for (const s of [-1, 1]) limb(mb, [-1.12, 0.62, s * 0.2], [-1.16, 0.99, s * 0.28], 0.015, 0.015, tube, 4);
    /* driver: seat, suit (slot 3), arms to the wheel, helmet (slot 4) */
    slab(mb, [-0.38, 0.32, 0], [-0.2, 0.75, 0], 0.2, 0.06, 0.19, 0.05, dark);
    mb.setSlot(3);
    slab(mb, [-0.2, 0.42, 0], [-0.12, 0.86, 0], 0.17, 0.11, 0.18, 0.1, WH);
    for (const s of [-1, 1]) { limb(mb, [-0.1, 0.8, s * 0.18], [0.12, 0.7, s * 0.2], 0.045, 0.04, WH, 6); limb(mb, [-0.1, 0.42, s * 0.1], [0.5, 0.38, s * 0.11], 0.06, 0.05, WH, 6); }
    mb.setSlot(0);
    limb(mb, [0.2, 0.68, 0], [0.24, 0.76, 0], 0.13, 0.13, C('#1e1e1e'), 10);
    mb.setSlot(4);
    ellipsoid(mb, [-0.1, 1.0, 0], 0.15, 0.14, 0.13, WH, 10, 6);
    mb.setSlot(0);
    slab(mb, [-0.01, 1.0, 0], [0.05, 1.0, 0], 0.09, 0.04, 0.085, 0.035, C('#22313a'));
  }

  /* ---------------- riders ---------------- */
  const RJ = {
    /* seated: hands on the grips, knees against the shrouds, boots on the pegs */
    sit: {
      hip: [-0.16, 1.06, 0.1], knee: [0.22, 0.9, 0.18], ankle: [-0.05, 0.5, 0.19], heel: [-0.13, 0.43, 0.19], toe: [0.09, 0.43, 0.19],
      waist: [-0.15, 1.1, 0], chest: [0.07, 1.48, 0], shoulder: [0.04, 1.46, 0.19], elbow: [0.21, 1.31, 0.33], wrist: [0.37, 1.12, 0.355], grip: [0.41, 1.095, 0.37],
      head: [0.14, 1.64, 0], pitch: -0.12
    },
    /* attack position: standing on the pegs, elbows up, weight forward */
    stand: {
      hip: [-0.2, 1.13, 0.1], knee: [0.16, 0.86, 0.19], ankle: [-0.05, 0.5, 0.19], heel: [-0.13, 0.43, 0.19], toe: [0.09, 0.43, 0.19],
      waist: [-0.19, 1.17, 0], chest: [0.12, 1.53, 0], shoulder: [0.1, 1.5, 0.2], elbow: [0.22, 1.37, 0.38], wrist: [0.37, 1.13, 0.36], grip: [0.41, 1.095, 0.37],
      head: [0.22, 1.67, 0], pitch: -0.28
    },
    /* flat track: low on the seat, wide bars */
    flat: {
      hip: [-0.18, 0.93, 0.1], knee: [0.17, 0.79, 0.19], ankle: [-0.03, 0.42, 0.18], heel: [-0.11, 0.36, 0.18], toe: [0.1, 0.36, 0.18],
      waist: [-0.17, 0.97, 0], chest: [0.06, 1.34, 0], shoulder: [0.04, 1.31, 0.19], elbow: [0.22, 1.18, 0.35], wrist: [0.37, 1.01, 0.4], grip: [0.4, 0.99, 0.41],
      head: [0.14, 1.5, 0], pitch: -0.2
    }
  };
  /* inside leg out for the slide on a flat track */
  const SLIDE_LEG = { hip: [-0.18, 0.93, 0.1], knee: [0.15, 0.62, 0.3], ankle: [0.41, 0.24, 0.42], heel: [0.33, 0.17, 0.43], toe: [0.56, 0.17, 0.45] };
  /* o.pack: hydration pack (enduro); o.leathers: one-piece suit and road helmet (flat
     track); o.slide: -1 / 1 puts the left / right boot down with a steel shoe */
  function riderBody(mb, J, o) {
    o = o || {};
    const boot = C(o.leathers ? '#1f1f21' : '#ededed'), sole = C('#232323'), buckle = C('#8f959b');
    const lens = C('#1f2d36');
    const legSlot = o.leathers ? 3 : 2;
    for (const s of [-1, 1]) {
      const Lg = o.slide === s ? SLIDE_LEG : J;
      const P = (p) => [p[0], p[1], s * p[2]];
      const hip = P(Lg.hip), knee = P(Lg.knee), ankle = P(Lg.ankle), heel = P(Lg.heel), toe = P(Lg.toe);
      const bootTop = mix(knee, ankle, 0.22);
      mb.setSlot(legSlot);
      limb(mb, hip, knee, 0.08, 0.064, WH, 6, false);
      limb(mb, knee, bootTop, 0.064, 0.06, WH, 6, false);
      ellipsoid(mb, knee, 0.066, 0.066, 0.066, shade(WH, 0.9), 6, 4);
      mb.setSlot(0);
      limb(mb, bootTop, ankle, 0.072, 0.064, boot, 6);
      for (const t of [0.3, 0.62]) limb(mb, mix(bootTop, ankle, t - 0.04), mix(bootTop, ankle, t + 0.04), 0.076, 0.074, buckle, 6, false);
      slab(mb, heel, toe, 0.052, 0.05, 0.046, 0.035, boot);
      slab(mb, [heel[0], heel[1] - 0.045, heel[2]], [toe[0], toe[1] - 0.04, toe[2]], 0.054, 0.012, 0.048, 0.01, o.slide === s ? C('#c9cdd2') : sole);
    }
    /* hips and torso: jersey (slot 3) with an accent band (slot 1) */
    mb.setSlot(legSlot);
    limb(mb, [J.hip[0], J.hip[1], -0.13], [J.hip[0], J.hip[1], 0.13], 0.1, 0.1, WH, 6);
    mb.setSlot(3);
    trunk(mb, J.waist, J.chest, 0.16, 0.11, 0.2, 0.12, WH);
    mb.setSlot(1);
    trunk(mb, mix(J.waist, J.chest, 0.42), mix(J.waist, J.chest, 0.6), 0.176, 0.119, 0.185, 0.122, WH);
    if (o.pack) {
      const ax = norm(sub(J.chest, J.waist)), back = [-ax[1], ax[0], 0];
      const off = (p, k) => [p[0] + back[0] * k, p[1] + back[1] * k, 0];
      mb.setSlot(0);
      slab(mb, off(mix(J.waist, J.chest, 0.3), 0.14), off(mix(J.waist, J.chest, 0.92), 0.14), 0.13, 0.05, 0.14, 0.045, C('#37474f'));
      slab(mb, off(mix(J.waist, J.chest, 0.5), 0.195), off(mix(J.waist, J.chest, 0.8), 0.195), 0.08, 0.012, 0.08, 0.012, C('#ff6a00'));
    }
    /* arms with accent cuffs and gloves */
    for (const s of [-1, 1]) {
      const P = (p) => [p[0], p[1], s * p[2]];
      const sh = P(J.shoulder), el = P(J.elbow), wr = P(J.wrist), gr = P(J.grip);
      mb.setSlot(3);
      ellipsoid(mb, sh, 0.065, 0.065, 0.065, WH, 6, 4);
      limb(mb, sh, el, 0.056, 0.048, WH, 6, false);
      limb(mb, el, wr, 0.048, 0.042, WH, 6, false);
      ellipsoid(mb, el, 0.05, 0.05, 0.05, WH, 6, 4);
      mb.setSlot(1);
      limb(mb, mix(el, wr, 0.74), wr, 0.046, 0.044, WH, 6, false);
      limb(mb, wr, gr, 0.038, 0.032, WH, 6);
    }
    /* neck brace and helmet: shell (slot 4), chin bar, peak (slot 1), goggles */
    mb.setSlot(0);
    const neckBase = mix(J.chest, J.head, 0.2), neckTop = mix(J.chest, J.head, 0.55);
    limb(mb, neckBase, neckTop, 0.085, 0.065, C('#2a2a2c'), 8);
    mb.push(); mb.translate(J.head[0], J.head[1], 0); mb.rotateZ(J.pitch || 0);
    mb.setSlot(4);
    ellipsoid(mb, [0, 0, 0], 0.15, 0.14, 0.13, WH, 10, 6);
    if (o.leathers) {
      mb.setSlot(0);
      slab(mb, [0.07, 0.0, 0], [0.135, 0.0, 0], 0.11, 0.045, 0.1, 0.04, C('#263238'));
    } else {
      slab(mb, [0.06, -0.06, 0], [0.18, -0.11, 0], 0.08, 0.045, 0.06, 0.035, WH);
      mb.setSlot(1);
      slab(mb, [0.06, 0.1, 0], [0.24, 0.085, 0], 0.11, 0.012, 0.1, 0.01, WH, [0, 0, 1]);
      const strap = Array.from({ length: 12 }, (_, i) => [Math.cos(i / 12 * Math.PI * 2) * 0.153, Math.sin(i / 12 * Math.PI * 2) * 0.134]);
      loft(mb, [-0.01, -0.005, 0], [-0.01, 0.04, 0], strap, strap, shade(WH, 0.7), [1, 0, 0], false);
      mb.setSlot(0);
      slab(mb, [0.1, 0.02, 0], [0.165, 0.02, 0], 0.1, 0.038, 0.095, 0.034, lens);
    }
    mb.pop();
    mb.setSlot(0);
  }

  /* ---------------- people ---------------- */
  /* joints of a standing / walking person (frame 0-3), a seated one or one cheering */
  function personJoints(frame, pose) {
    const leg = (s, thigh, bend) => {
      const hip = [0, 0.91, s * 0.09];
      const knee = [hip[0] + Math.sin(thigh) * 0.43, hip[1] - Math.cos(thigh) * 0.43, s * 0.095];
      const sa = thigh - bend;
      const ankle = [knee[0] + Math.sin(sa) * 0.41, knee[1] - Math.cos(sa) * 0.41, s * 0.095];
      const lift = Math.max(0, 0.075 - ankle[1]);
      ankle[1] += lift;
      return { hip, knee, ankle, heel: [ankle[0] - 0.06, ankle[1] - 0.055, ankle[2]], toe: [ankle[0] + 0.16, ankle[1] - 0.055, ankle[2]] };
    };
    const arm = (s, swing, up) => {
      const sh = [0, 1.39, s * 0.185];
      if (up) return { sh, el: [0.02, 1.62, s * 0.26], wr: [0.03, 1.86, s * 0.28] };
      const el = [Math.sin(swing) * 0.28, sh[1] - Math.cos(swing) * 0.28, s * 0.2];
      const fa = swing + 0.25 + Math.max(0, swing) * 0.6;
      return { sh, el, wr: [el[0] + Math.sin(fa) * 0.25, el[1] - Math.cos(fa) * 0.25, s * 0.2] };
    };
    const J = { waist: [0, 0.94, 0], chest: [0, 1.41, 0], head: [0.01, 1.59, 0] };
    if (pose === 'sit') {
      for (const [k, s] of [['L', -1], ['R', 1]]) {
        const hip = [0, 0.47, s * 0.09], knee = [0.42, 0.49, s * 0.1], ankle = [0.44, 0.09, s * 0.1];
        J[k] = { hip, knee, ankle, heel: [0.38, 0.035, s * 0.1], toe: [0.6, 0.035, s * 0.1], sh: [-0.01, 0.95, s * 0.185], el: [0.13, 0.72, s * 0.21], wr: [0.36, 0.6, s * 0.16] };
      }
      J.waist = [-0.02, 0.5, 0]; J.chest = [-0.02, 0.97, 0]; J.head = [0, 1.15, 0];
      return J;
    }
    const sw = frame === 1 ? 0.36 : frame === 3 ? -0.36 : 0;
    J.L = Object.assign(leg(-1, sw, sw > 0 ? 0.08 : sw < 0 ? 0.45 : 0.03), arm(-1, -sw * 0.9, pose === 'cheer'));
    J.R = Object.assign(leg(1, -sw, -sw > 0 ? 0.08 : -sw < 0 ? 0.45 : 0.03), arm(1, sw * 0.9, pose === 'cheer'));
    return J;
  }
  /* o: extra items for staff (vest, cap, hard hat, broom, flag, clipboard, medic cross) */
  function human(mb, J, o) {
    o = o || {};
    const shoe = C('#2a2a2c'), eye = C('#1d1d1d');
    for (const k of ['L', 'R']) {
      const j = J[k];
      mb.setSlot(2);
      limb(mb, j.hip, j.knee, 0.075, 0.06, WH, 5, false);
      limb(mb, j.knee, j.ankle, 0.06, 0.048, WH, 5, false);
      mb.setSlot(0);
      slab(mb, j.heel, j.toe, 0.048, 0.04, 0.045, 0.032, shoe);
      mb.setSlot(1);
      limb(mb, j.sh, j.el, 0.052, 0.046, WH, 5, false);
      mb.setSlot(o.longSleeves ? 1 : 4);
      limb(mb, j.el, j.wr, 0.042, 0.036, WH, 5, false);
      mb.setSlot(4);
      ellipsoid(mb, mix(j.el, j.wr, 1.12), 0.04, 0.045, 0.035, WH, 5, 3);
    }
    /* hips, torso, neck and head with hair (slot 3) */
    mb.setSlot(2);
    limb(mb, [J.L.hip[0], J.L.hip[1] + 0.02, -0.13], [J.R.hip[0], J.R.hip[1] + 0.02, 0.13], 0.095, 0.095, WH, 5);
    mb.setSlot(1);
    trunk(mb, J.waist, J.chest, 0.15, 0.1, 0.18, 0.105, WH);
    for (const k of ['L', 'R']) ellipsoid(mb, J[k].sh, 0.058, 0.058, 0.058, WH, 6, 4);
    mb.setSlot(4);
    limb(mb, mix(J.chest, J.head, 0.1), mix(J.chest, J.head, 0.6), 0.05, 0.048, WH, 5, false);
    const hd = J.head;
    ellipsoid(mb, hd, 0.105, 0.125, 0.097, WH, 8, 5);
    mb.setSlot(0);
    for (const s of [-1, 1]) slab(mb, [hd[0] + 0.09, hd[1] + 0.02, s * 0.037], [hd[0] + 0.106, hd[1] + 0.02, s * 0.037], 0.013, 0.013, 0.013, 0.013, eye);
    mb.setSlot(3);
    if (!o.cap && !o.helmet) ellipsoid(mb, [hd[0] - 0.024, hd[1] + 0.036, 0], 0.107, 0.11, 0.103, WH, 8, 4);
    else ellipsoid(mb, [hd[0] - 0.03, hd[1] + 0.0, 0], 0.09, 0.105, 0.1, WH, 7, 4);
    mb.setSlot(0);
    if (o.vest) {
      trunk(mb, mix(J.waist, J.chest, 0.08), mix(J.waist, J.chest, 0.95), 0.158, 0.108, 0.186, 0.112, C(o.vest));
      trunk(mb, mix(J.waist, J.chest, 0.4), mix(J.waist, J.chest, 0.5), 0.165, 0.112, 0.172, 0.114, C('#e9edf0'));
    }
    if (o.cross) {
      const p = mix(J.waist, J.chest, 0.7);
      slab(mb, [p[0] + 0.1, p[1] - 0.07, 0], [p[0] + 0.1, p[1] + 0.07, 0], 0.025, 0.012, 0.025, 0.012, C('#d32f2f'), [0, 0, 1]);
      slab(mb, [p[0] + 0.1, p[1], -0.07], [p[0] + 0.1, p[1], 0.07], 0.025, 0.012, 0.025, 0.012, C('#d32f2f'), [0, 1, 0]);
    }
    if (o.cap) {
      ellipsoid(mb, [hd[0] - 0.005, hd[1] + 0.07, 0], 0.105, 0.065, 0.1, C(o.cap), 7, 4);
      slab(mb, [hd[0] + 0.05, hd[1] + 0.06, 0], [hd[0] + 0.18, hd[1] + 0.045, 0], 0.08, 0.008, 0.07, 0.008, C(o.cap));
    }
    if (o.helmet) {
      ellipsoid(mb, [hd[0], hd[1] + 0.07, 0], 0.125, 0.085, 0.115, C(o.helmet), 8, 4);
      slab(mb, [hd[0] - 0.13, hd[1] + 0.05, 0], [hd[0] + 0.14, hd[1] + 0.05, 0], 0.13, 0.008, 0.13, 0.008, C(o.helmet));
    }
    const hand = J.R.wr;
    if (o.broom) {
      limb(mb, [hand[0] - 0.05, hand[1] + 0.35, hand[2]], [hand[0] + 0.32, 0.06, hand[2] + 0.02], 0.016, 0.016, C('#9a6b3d'), 5);
      slab(mb, [hand[0] + 0.3, 0.08, hand[2] - 0.14], [hand[0] + 0.3, 0.08, hand[2] + 0.18], 0.05, 0.05, 0.05, 0.05, C('#e0c050'), [1, 0, 0]);
    }
    if (o.flag) {
      const top = [hand[0] + 0.02, hand[1] + 0.85, hand[2]];
      limb(mb, [hand[0], hand[1] - 0.05, hand[2]], top, 0.012, 0.012, C('#cfcfcf'), 4);
      panel(mb, [[top[0], top[1]], [top[0] + 0.42, top[1] - 0.02], [top[0] + 0.42, top[1] - 0.3], [top[0], top[1] - 0.3]], hand[2] - 0.005, hand[2] + 0.005, C(o.flag));
    }
    if (o.clip) slab(mb, [J.L.wr[0] + 0.02, J.L.wr[1] - 0.02, J.L.wr[2] + 0.06], [J.L.wr[0] + 0.03, J.L.wr[1] + 0.2, J.L.wr[2] + 0.06], 0.1, 0.012, 0.1, 0.012, C('#795548'), [1, 0, 0]);
    mb.setSlot(0);
  }
  function person(frame, opts) {
    opts = opts || {};
    const mb = new MB(4096);
    if (opts.pose === 'lie') {
      /* lying on the back along +X with the head at +X */
      mb.push(); mb.translate(-0.95, 0.12, 0); mb.rotateY(Math.PI); mb.rotateZ(Math.PI / 2);
      human(mb, personJoints(0, 'stand'), opts);
      mb.pop();
      return mb;
    }
    human(mb, personJoints(frame, opts.pose), opts);
    return mb;
  }

  /* ---------------- vehicles ---------------- */
  function car(kind) {
    const vm = new V(40, 20, 16, 20, 0, 8, 0.15);
    const body = vm.pal('#ffffff', 1), bodyD = vm.pal('#cccccc', 1), glass = vm.pal('#2e4452'), tire = vm.pal('#1a1a1a'), rim = vm.pal('#9aa0a6');
    const light = vm.pal('#fff6c8'), tail = vm.pal('#c62828'), bumper = vm.pal('#2b2b2b');
    if (kind === 'van') {
      vm.disc(-9, 2.4, -6, -5, 2.4, tire, rim, 0.9).disc(9, 2.4, -6, -5, 2.4, tire, rim, 0.9);
      vm.box(-15, 2, -6, 14, 11, 5, body);
      vm.box(9, 7, -6, 13, 10, 5, glass).box(14, 4, -5, 14, 5, 4, bumper);
      vm.box(-15, 2, -6, -15, 3, 5, bumper);
      vm.box(-12, 7, -6, 6, 9, -6, bodyD);
      vm.set(14, 6, -5, light).set(14, 6, 4, light).set(-15, 6, -5, tail).set(-15, 6, 4, tail);
      vm.box(-14, 12, -5, 12, 12, 4, vm.pal('#3a3a3a'));
      vm.mirrorZ();
      vm.disc(-9, 2.4, -6, -5, 2.4, tire, rim, 0.9).disc(9, 2.4, -6, -5, 2.4, tire, rim, 0.9);
      return vm;
    }
    if (kind === 'tractor') {
      const green = vm.pal('#ffffff', 1), dark = vm.pal('#2b2b2b'), orange = vm.pal('#ef6c00'), seatC = vm.pal('#202020');
      vm.disc(-6, 4.5, -7, -5, 4.5, tire, vm.pal('#f9a825'), 1.4);
      vm.disc(6, 2.6, -6, -5, 2.6, tire, vm.pal('#f9a825'), 1);
      vm.box(-3, 4, -3, 9, 7, 2, green);
      vm.box(-7, 6, -3, -3, 7, 2, green);
      vm.box(-7, 8, -3, -2, 8, 2, seatC);
      vm.box(-8, 8, -4, -1, 13, -4, glass).box(-8, 14, -4, -1, 14, 3, green);
      vm.box(-8, 8, -4, -8, 13, 3, dark).box(-1, 8, -4, -1, 13, 3, dark);
      vm.box(5, 8, -1, 5, 11, -1, dark);
      /* drag harrow behind */
      vm.box(-18, 1, -7, -12, 1, -7, orange).box(-18, 1, -7, -18, 1, 6, orange);
      for (let z = -7; z <= 6; z += 2) vm.set(-18, 0, z, dark);
      vm.box(-12, 1, -1, -9, 1, 0, orange);
      vm.mirrorZ();
      vm.disc(-6, 4.5, -7, -5, 4.5, tire, vm.pal('#f9a825'), 1.4);
      vm.disc(6, 2.6, -6, -5, 2.6, tire, vm.pal('#f9a825'), 1);
      return vm;
    }
    if (kind === 'truck') {
      const tank = vm.pal('#90caf9'), tankD = vm.pal('#64b5f6'), cab = vm.pal('#ffffff', 1);
      vm.disc(-8, 2.6, -6, -5, 2.6, tire, rim, 1).disc(10, 2.6, -6, -5, 2.6, tire, rim, 1);
      vm.box(8, 3, -5, 15, 10, 4, cab).box(12, 7, -5, 15, 9, 4, glass);
      vm.box(-15, 3, -5, 7, 4, 4, bumper);
      vm.box(-14, 5, -4, 6, 11, 3, tank).box(-14, 5, -4, 6, 5, 3, tankD);
      vm.box(-16, 3, -2, -15, 4, 1, vm.pal('#455a64'));
      vm.mirrorZ();
      vm.disc(-8, 2.6, -6, -5, 2.6, tire, rim, 1).disc(10, 2.6, -6, -5, 2.6, tire, rim, 1);
      return vm;
    }
    /* sedan */
    vm.disc(-8, 2, -6, -5, 2, tire, rim, 0.8).disc(9, 2, -6, -5, 2, tire, rim, 0.8);
    vm.box(-14, 2, -6, 13, 5, 5, body);
    vm.box(-8, 6, -5, 5, 8, 4, glass);
    vm.box(-7, 9, -5, 4, 9, 4, body);
    vm.box(-8, 6, -6, -8, 8, 5, bodyD).box(5, 6, -6, 5, 8, 5, bodyD).box(-1, 6, -6, -1, 8, -6, bodyD);
    vm.box(13, 2, -6, 13, 3, 5, bumper).box(-14, 2, -6, -14, 3, 5, bumper);
    vm.set(13, 4, -5, light).set(13, 4, 4, light).set(-14, 4, -5, tail).set(-14, 4, 4, tail);
    vm.mirrorZ();
    vm.disc(-8, 2, -6, -5, 2, tire, rim, 0.8).disc(9, 2, -6, -5, 2, tire, rim, 0.8);
    return vm;
  }
  function quad() {
    const vm = new V(30, 20, 14, 15, 0, 7, 0.1);
    const tire = vm.pal('#1a1a1a'), rim = vm.pal('#9aa0a6'), red = vm.pal('#d32f2f'), white = vm.pal('#f5f5f5'), dark = vm.pal('#2b2b2b');
    for (const wx of [-6, 6]) { vm.disc(wx, 3, -6, -5, 3, tire, rim, 1); vm.disc(wx, 3, 4, 5, 3, tire, rim, 1); }
    vm.box(-7, 4, -4, 8, 7, 3, red).box(-2, 8, -2, 2, 8, 1, dark).box(6, 8, -4, 6, 9, 3, dark);
    vm.box(-14, 5, -4, -7, 6, 3, white).box(-14, 7, -4, -7, 7, -4, red).box(-14, 7, 3, -7, 7, 3, red);
    vm.set(-11, 7, 0, red).set(-11, 7, -1, red).set(-10, 7, -1, red).set(-12, 7, -1, red);
    return vm;
  }

  /* ---------------- trees and rocks (low poly) ---------------- */
  function pine(mb, seed) {
    const trunk = MB.rgba('#6b4a2e');
    mb.setSlot(0); mb.box(-0.18, 0, -0.18, 0.18, 1.6, 0.18, { col: trunk });
    mb.setSlot(1);
    const g = [0.55, 0.62, 0.7];
    mb.cone(0, 1.0, 0, 1.9, 2.6, 7, [g[0] * 0.75, g[1] * 0.9, g[2] * 0.6, 1], 0.2);
    mb.cone(0, 2.4, 0, 1.45, 2.3, 7, [g[0] * 0.8, g[1] * 0.95, g[2] * 0.62, 1], 0.2);
    mb.cone(0, 3.7, 0, 0.95, 2.1, 6, [g[0] * 0.86, g[1], g[2] * 0.66, 1], 0.2);
    mb.setSlot(0);
    void seed;
  }
  function oak(mb, seed) {
    const trunk = MB.rgba('#6e4c30');
    mb.setSlot(0);
    mb.box(-0.22, 0, -0.22, 0.22, 2.0, 0.22, { col: trunk });
    mb.box(-0.12, 1.6, -0.12, 0.7, 1.8, 0.12, { col: trunk });
    mb.setSlot(1);
    const c = [0.62, 0.78, 0.5, 1];
    mb.blob(0, 3.0, 0, 1.9, 1.35, 1.9, c, seed);
    mb.blob(0.9, 2.6, 0.5, 1.1, 0.9, 1.1, MB.mulCol(c, 0.92), seed + 1);
    mb.blob(-0.7, 3.4, -0.6, 1.1, 0.95, 1.0, MB.mulCol(c, 1.06), seed + 2);
    mb.setSlot(0);
  }
  function poplar(mb, seed) {
    const trunk = MB.rgba('#8a7a62');
    mb.setSlot(0); mb.box(-0.15, 0, -0.15, 0.15, 1.6, 0.15, { col: trunk });
    mb.setSlot(1);
    const c = [0.7, 0.85, 0.48, 1];
    mb.blob(0, 3.9, 0, 0.95, 2.9, 0.95, c, seed, 0.12);
    mb.setSlot(0);
  }
  function bush(mb, seed) {
    mb.setSlot(1);
    const c = [0.58, 0.74, 0.46, 1];
    mb.blob(0, 0.45, 0, 0.8, 0.6, 0.8, c, seed);
    mb.blob(0.5, 0.35, 0.3, 0.55, 0.45, 0.55, MB.mulCol(c, 0.9), seed + 3);
    mb.setSlot(0);
  }
  function rock(mb, seed) {
    mb.setSlot(1);
    mb.blob(0, 0.35, 0, 0.9, 0.6, 0.75, [0.78, 0.76, 0.72, 1], seed, 0.3);
    mb.blob(0.6, 0.2, 0.4, 0.45, 0.35, 0.4, [0.7, 0.68, 0.65, 1], seed + 9, 0.3);
    mb.setSlot(0);
  }


  /* ---------------- library ---------------- */
  const lib = {};
  function add(name, mb) { lib[name] = mb.build(); }
  function make(fn) { const mb = new MB(8192); fn(mb); return mb; }
  function buildAll() {
    if (Object.keys(lib).length) return lib;
    /* the machines of every make, named kind_make_engine (see Catalog.bikeModel) */
    for (const id in Cat.brands) {
      const L = Cat.brands[id];
      if (L.cls.includes('mx') || L.cls.includes('mini')) for (const two of [false, true]) add('mx_' + id + (two ? '_2t' : '_4t'), make(mb => mxBike(mb, L, { two })));
      if (L.cls.includes('enduro')) for (const two of [false, true]) add('en_' + id + (two ? '_2t' : '_4t'), make(mb => mxBike(mb, L, { two, enduro: true })));
      if (L.cls.includes('flat')) for (const twin of [false, true]) add('ft_' + id + (twin ? '_twin' : '_single'), make(mb => flatBike(mb, L, { twin })));
    }
    add('buggy', make(buggy));
    /* the riders, drawn on top of their machine with the same transform */
    add('rb_sit', make(mb => riderBody(mb, RJ.sit)));
    add('rb_stand', make(mb => riderBody(mb, RJ.stand)));
    add('rb_sit_pack', make(mb => riderBody(mb, RJ.sit, { pack: true })));
    add('rb_stand_pack', make(mb => riderBody(mb, RJ.stand, { pack: true })));
    add('rb_flat', make(mb => riderBody(mb, RJ.flat, { leathers: true })));
    add('rb_flat_l', make(mb => riderBody(mb, RJ.flat, { leathers: true, slide: -1 })));
    add('rb_flat_r', make(mb => riderBody(mb, RJ.flat, { leathers: true, slide: 1 })));
    for (const f of [0, 1, 2, 3]) add('person_' + f, person(f === 2 ? 0 : f));
    add('person_sit', person(0, { pose: 'sit' }));
    add('person_lie', person(0, { pose: 'lie' }));
    add('person_cheer', person(0, { pose: 'cheer' }));
    const staffDefs = {
      mechanic: { cap: '#1e3a8a', longSleeves: true },
      crew: { vest: '#ff6d00', helmet: '#fdd835' },
      cleaner: { broom: true, cap: '#2e7d32' },
      medic: { cross: true, longSleeves: true },
      marshal: { vest: '#ff6d00', flag: '#ffd600' },
      coach: { cap: '#c62828', clip: true }
    };
    for (const k in staffDefs) for (const f of [0, 1, 3]) add('staff_' + k + '_' + f, person(f, staffDefs[k]));
    add('car', car('sedan').toMesh());
    add('van', car('van').toMesh());
    add('tractor', car('tractor').toMesh());
    add('truck', car('truck').toMesh());
    add('quad', quad().toMesh());
    const trees = { tree_pine: pine, tree_oak: oak, tree_poplar: poplar, bush, rock };
    for (const k in trees) { const mb = new MB(2048); trees[k](mb, k.length * 7); add(k, mb); }
    return lib;
  }

  MX.Models = { lib, buildAll, person, car, mxBike, flatBike, riderBody, RJ, geo: { loft, ring, limb, slab, trunk, tube, ellipsoid, panel, panels, wheel } };
})(window.MX);
