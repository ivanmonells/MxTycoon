/* MX Tycoon - scene geometry builders: terrain chunks, map skirt, tracks (surface,
   embankments, stakes, finish arch, start gate), paths and roads. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U, MB = MX.MeshBuilder, Cat = MX.Catalog;
  const T = C.TILE;
  const L = () => MX.Tex.L;
  const GROUND_LAYER = ['grass', 'dry', 'dirt', 'sand', 'rock', 'forest', 'gravel'];
  const TRACK_LAYER = ['t_dirt', 't_sand', 't_mud', 't_hard'];
  const CH = 16;

  function terrainChunk(world, cx, cz) {
    const mb = new MB(CH * CH * 6 + 64);
    const N = world.N;
    const white = [1, 1, 1, 1];
    for (let tz = cz * CH; tz < Math.min(N, (cz + 1) * CH); tz++) {
      for (let tx = cx * CH; tx < Math.min(N, (cx + 1) * CH); tx++) {
        const x0 = tx * T, z0 = tz * T, x1 = x0 + T, z1 = z0 + T;
        const h00 = world.vh(tx, tz), h10 = world.vh(tx + 1, tz), h01 = world.vh(tx, tz + 1), h11 = world.vh(tx + 1, tz + 1);
        const mat = L()[GROUND_LAYER[world.ground[tx + tz * N]] || 'grass'];
        const uv = (x, z) => [x / 16, z / 16];
        const A = [x0, h00, z0], B = [x1, h10, z0], Cc = [x1, h11, z1], D = [x0, h01, z1];
        /* winding: counter-clockwise seen from above (+Y): A(x0,z0) -> D(x0,z1) -> C(x1,z1) -> B(x1,z0) */
        if (world.tileDiag(tx, tz) === 0) {
          mb.tri(A, D, Cc, [uv(x0, z0), uv(x0, z1), uv(x1, z1)], mat, white);
          mb.tri(A, Cc, B, [uv(x0, z0), uv(x1, z1), uv(x1, z0)], mat, white);
        } else {
          mb.tri(A, D, B, [uv(x0, z0), uv(x0, z1), uv(x1, z0)], mat, white);
          mb.tri(B, D, Cc, [uv(x1, z0), uv(x0, z1), uv(x1, z1)], mat, white);
        }
      }
    }
    return mb.build();
  }

  function skirt(world) {
    const mb = new MB(4096);
    const N = world.N, mat = L().strata, top = L().grass_edge;
    const base = -4;
    const col = [0.82, 0.8, 0.78, 1];
    for (let i = 0; i < N; i++) {
      /* south edge (z = N*T), facing +Z */
      let a = world.vh(i, N), b = world.vh(i + 1, N);
      let x0 = i * T, x1 = x0 + T, z = N * T;
      mb.quad([x0, base, z], [x1, base, z], [x1, b, z], [x0, a, z], [x0 / 16, -a / 16, x1 / 16, -base / 16], mat, col);
      /* east edge (x = N*T), facing +X */
      a = world.vh(N, i); b = world.vh(N, i + 1);
      const x = N * T, z0 = i * T, z1 = z0 + T;
      mb.quad([x, base, z1], [x, base, z0], [x, a, z0], [x, b, z1], [z0 / 16, -b / 16, z1 / 16, -base / 16], mat, col);
      /* north and west edges (back faces are hidden from the default camera but visible after rotating) */
      a = world.vh(i, 0); b = world.vh(i + 1, 0);
      mb.quad([x1, base, 0], [x0, base, 0], [x0, a, 0], [x1, b, 0], [x0 / 16, -a / 16, x1 / 16, -base / 16], mat, col);
      a = world.vh(0, i); b = world.vh(0, i + 1);
      mb.quad([0, base, z0], [0, base, z1], [0, b, z1], [0, a, z0], [z0 / 16, -a / 16, z1 / 16, -base / 16], mat, col);
    }
    void top;
    /* bottom plate so rotated views never show the void */
    mb.quad([0, base, 0], [N * T, base, 0], [N * T, base, N * T], [0, base, N * T], [0, 0, 1, 1], MB.MAT_SOLID, [0.25, 0.2, 0.16, 1]);
    return mb.build();
  }

  /* Track mesh. opts: {ghost, highlight} */
  function track(tr, world, opts) {
    opts = opts || {};
    const S = tr.S;
    if (!S || S.n < 4) return null;
    const mb = new MB(S.n * 40);
    const step = 2;
    const n = S.n;
    const lastI = S.closed ? n : n - 1;
    const lanes = [-1, -0.5, 0, 0.5, 1];
    const cross = (i) => {
      const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
      const hw = S.w[i] * 0.5;
      const pts = lanes.map((f) => {
        const l = f * hw;
        return [S.x[i] + nx * l, S.y[i] + tr.bankAt(i, l), S.z[i] + nz * l];
      });
      return { pts, nx, nz, hw, i };
    };
    const tint = (i) => {
      let c = [1, 1, 1, 1];
      const wear = tr.wear[Math.min(tr.wear.length - 1, Math.floor(i * C.TRACK_DS / 5))] || 0;
      const k = 1 - wear * 0.22 - tr.moisture * 0.18;
      c = [k, k * 0.98, k * 0.96, 1];
      if (S.bad[i]) c = [1.25, 0.45, 0.4, 1];
      if (opts.highlight) c = [c[0] * 1.08, c[1] * 1.06, c[2] * 0.96, 1];
      return c;
    };
    let prev = cross(0);
    for (let k = step; k <= lastI; k += step) {
      const i = S.closed ? k % n : Math.min(k, n - 1);
      const cur = cross(i);
      const mat = L()[TRACK_LAYER[S.surf[i]]];
      const col = tint(i);
      const v0 = (k - step) * C.TRACK_DS / 16, v1 = k * C.TRACK_DS / 16;
      for (let q = 0; q < 4; q++) {
        const a = prev.pts[q], b = prev.pts[q + 1], c = cur.pts[q + 1], d = cur.pts[q];
        const u0 = (lanes[q] + 1) * prev.hw / 16, u1 = (lanes[q + 1] + 1) * prev.hw / 16;
        /* order chosen so the normal points up for a track heading +X with left normal +Z */
        mb.quad4(a, b, c, d, [u0, v0], [u1, v0], [u1, v1], [u0, v1], mat, col);
      }
      /* embankments on both sides */
      for (const side of [-1, 1]) {
        const ea = side < 0 ? prev.pts[0] : prev.pts[4];
        const eb = side < 0 ? cur.pts[0] : cur.pts[4];
        const rim = (e, c) => {
          const ox = c.nx * side, oz = c.nz * side;
          const r = [e[0] + ox * 0.35, e[1] - 0.06, e[2] + oz * 0.35];
          const th = world.heightAt(e[0], e[2]);
          const diff = e[1] - th;
          const d = Math.max(0.7, diff * 1.15 + 0.45);
          const ox2 = e[0] + ox * (0.35 + d), oz2 = e[2] + oz * (0.35 + d);
          const o = [ox2, world.heightAt(ox2, oz2) - 0.18, oz2];
          return { r, o };
        };
        const A = rim(ea, prev), B = rim(eb, cur);
        const em = L().embank;
        const ec = [col[0] * 0.95, col[1] * 0.95, col[2] * 0.95, 1];
        if (side > 0) {
          mb.quad4(ea, A.r, B.r, eb, [0, v0], [0.03, v0], [0.03, v1], [0, v1], em, ec);
          mb.quad4(A.r, A.o, B.o, B.r, [0.03, v0], [0.2, v0], [0.2, v1], [0.03, v1], em, ec);
        } else {
          mb.quad4(ea, eb, B.r, A.r, [0, v0], [0, v1], [0.03, v1], [0.03, v0], em, ec);
          mb.quad4(A.r, B.r, B.o, A.o, [0.03, v0], [0.03, v1], [0.2, v1], [0.2, v0], em, ec);
        }
      }
      prev = cur;
    }
    if (!opts.ghost) {
      /* marker stakes with tape every 6 m on both sides */
      const tapeMat = L().track_tape;
      const every = Math.round(6 / C.TRACK_DS);
      let lastPts = null;
      for (let k = 0; k <= lastI; k += every) {
        const i = S.closed ? k % n : Math.min(k, n - 1);
        if (S.feat[i] >= 0 && Cat.features[tr.features[S.feat[i]].type].kind === 'start') { lastPts = null; continue; }
        const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
        const hw = S.w[i] * 0.5 + 0.55;
        const pts = [];
        for (const side of [-1, 1]) {
          const x = S.x[i] + nx * hw * side, z = S.z[i] + nz * hw * side;
          const y = Math.max(S.y[i] + tr.bankAt(i, (hw - 0.55) * side) - 0.05, world.heightAt(x, z));
          const col = (k / every) % 2 ? MB.rgba('#ff6a13') : MB.rgba('#f2f2f2');
          mb.box(x - 0.06, y, z - 0.06, x + 0.06, y + 0.95, z + 0.06, { col });
          pts.push([x, y]);
          pts.push(z);
        }
        if (lastPts) {
          for (let sIdx = 0; sIdx < 2; sIdx++) {
            const ax = lastPts[sIdx * 2][0], ay = lastPts[sIdx * 2][1], az = lastPts[sIdx * 2 + 1];
            const bx = pts[sIdx * 2][0], by = pts[sIdx * 2][1], bz = pts[sIdx * 2 + 1];
            if (U.dist2(ax, az, bx, bz) > 120) continue;
            const t0 = 0.74, t1 = 0.84;
            mb.quad([ax, ay + t0, az], [bx, by + t0, bz], [bx, by + t1, bz], [ax, ay + t1, az], [0, 0, 0.4, 0.05], tapeMat, [1, 1, 1, 1]);
            mb.quad([bx, by + t0, bz], [ax, ay + t0, az], [ax, ay + t1, az], [bx, by + t1, bz], [0, 0, 0.4, 0.05], tapeMat, [1, 1, 1, 1]);
          }
        }
        lastPts = pts;
      }
      /* finish line: checker band and arch */
      if (tr.finishS != null) {
        const i = tr.sIndex(tr.finishS - 1);
        const j = tr.sIndex(tr.finishS + 0.5);
        const ci = cross(i), cj = cross(j);
        const chk = L().checker;
        for (let q = 0; q < 4; q++) {
          const a = ci.pts[q], b = ci.pts[q + 1], c = cj.pts[q + 1], d = cj.pts[q];
          const lift = (p) => [p[0], p[1] + 0.03, p[2]];
          mb.quad4(lift(a), lift(b), lift(c), lift(d), [q * 0.25, 0], [(q + 1) * 0.25, 0], [(q + 1) * 0.25, 0.1], [q * 0.25, 0.1], chk, [1, 1, 1, 1]);
        }
        const m = tr.sIndex(tr.finishS);
        const hdg = S.hdg[m], nx = -Math.sin(hdg), nz = Math.cos(hdg), tx = Math.cos(hdg), tz = Math.sin(hdg);
        const hw = S.w[m] * 0.5 + 1.1;
        const post = MB.rgba('#2b2b2b');
        const baseY = S.y[m];
        for (const side of [-1, 1]) {
          const x = S.x[m] + nx * hw * side, z = S.z[m] + nz * hw * side;
          mb.box(x - 0.15, Math.min(baseY, world.heightAt(x, z)) - 0.2, z - 0.15, x + 0.15, baseY + 5, z + 0.15, { col: post });
        }
        const r = MX.Tex.regions.sign_meta;
        if (r) {
          const y0 = baseY + 3.9, y1 = baseY + 5.0;
          const ax = S.x[m] - nx * hw, az = S.z[m] - nz * hw, bx = S.x[m] + nx * hw, bz = S.z[m] + nz * hw;
          const off = 0.05;
          const mir = [r.uv[2], r.uv[1], r.uv[0], r.uv[3]];
          mb.quad([ax + tx * off, y0, az + tz * off], [bx + tx * off, y0, bz + tz * off], [bx + tx * off, y1, bz + tz * off], [ax + tx * off, y1, az + tz * off], mir, MB.MAT_ATLAS, [1, 1, 1, 1]);
          mb.quad([bx - tx * off, y0, bz - tz * off], [ax - tx * off, y0, az - tz * off], [ax - tx * off, y1, az - tz * off], [bx - tx * off, y1, bz - tz * off], mir, MB.MAT_ATLAS, [1, 1, 1, 1]);
        }
      }
    }
    return mb.build();
  }

  /* Start gate: static frame plus gates up or down. */
  function startGate(tr, world, down) {
    const S = tr.S;
    if (!S || tr.startS == null) return null;
    const mb = new MB(4096);
    const m = tr.sIndex(tr.startS);
    const hdg = S.hdg[m], nx = -Math.sin(hdg), nz = Math.cos(hdg), tx = Math.cos(hdg), tz = Math.sin(hdg);
    const hw = S.w[m] * 0.5;
    const baseY = S.y[m];
    /* concrete pad behind the gate */
    const padCol = MB.rgba('#b5b1aa');
    const conc = L().concrete;
    const p = (l, f, y) => [S.x[m] + nx * l + tx * f, y, S.z[m] + nz * l + tz * f];
    mb.quad4(p(-hw, -7, baseY + 0.04), p(hw, -7, baseY + 0.04), p(hw, 0, baseY + 0.04), p(-hw, 0, baseY + 0.04), [0, 0], [0.5, 0], [0.5, 0.45], [0, 0.45], conc, padCol);
    const metal = MB.rgba('#8e959c'), dark = MB.rgba('#3b3f44'), yellow = MB.rgba('#ffd22e');
    /* ground beam */
    mb.push();
    mb.translate(S.x[m], baseY, S.z[m]);
    mb.rotateY(hdg);
    mb.box(-0.25, 0, -hw - 0.4, 0.1, 0.3, hw + 0.4, { col: dark });
    mb.box(-0.2, 0, -hw - 0.6, 0.2, 1.6, -hw - 0.3, { col: metal });
    mb.box(-0.2, 0, hw + 0.3, 0.2, 1.6, hw + 0.6, { col: metal });
    const nGates = Math.max(4, Math.floor(S.w[m] / 0.95));
    const gw = (2 * hw) / nGates;
    for (let g = 0; g < nGates; g++) {
      const z0 = -hw + g * gw + 0.05, z1 = z0 + gw - 0.1;
      const col = g % 2 ? metal : yellow;
      if (!down) {
        mb.box(0.0, 0.3, z0, 0.08, 1.0, z1, { col });
        mb.box(0.0, 0.95, z0, 0.12, 1.05, z1, { col: dark });
      } else {
        mb.box(0.1, 0.25, z0, 0.85, 0.33, z1, { col });
      }
    }
    /* sign */
    const r = MX.Tex.regions.sign_salida;
    if (r) {
      mb.box(-0.1, 1.6, -hw - 0.6, 0.1, 2.6, -hw - 0.3, { col: metal });
      mb.quad([-0.12, 2.0, -hw - 1.9], [-0.12, 2.0, -hw + 1.0], [-0.12, 2.6, -hw + 1.0], [-0.12, 2.6, -hw - 1.9], r.uv, MB.MAT_ATLAS, [1, 1, 1, 1]);
    }
    mb.pop();
    return mb.build();
  }

  /* Paths, roads, parking surfaces and path addons. */
  function paths(world) {
    const mb = new MB(world.N * world.N);
    const N = world.N;
    const P = MX.World.P;
    const matFor = { 1: L().p_gravel, 2: L().p_paved, 3: L().asphalt };
    const curbCol = { 1: MB.rgba('#8d8676'), 2: MB.rgba('#7d766c'), 3: MB.rgba('#9a9a96') };
    for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
      const p = world.path[tx + tz * N];
      if (!p) continue;
      const x0 = tx * T, z0 = tz * T, x1 = x0 + T, z1 = z0 + T;
      const lift = p === P.ROAD ? 0.05 : 0.07;
      const h = (vx, vz) => world.vh(vx, vz) + lift;
      const A = [x0, h(tx, tz), z0], B = [x1, h(tx + 1, tz), z0], Cc = [x1, h(tx + 1, tz + 1), z1], D = [x0, h(tx, tz + 1), z1];
      const mat = matFor[p];
      const uv = (x, z) => [x / 16, z / 16];
      const col = [1, 1, 1, 1];
      if (world.tileDiag(tx, tz) === 0) {
        mb.tri(A, D, Cc, [uv(x0, z0), uv(x0, z1), uv(x1, z1)], mat, col);
        mb.tri(A, Cc, B, [uv(x0, z0), uv(x1, z1), uv(x1, z0)], mat, col);
      } else {
        mb.tri(A, D, B, [uv(x0, z0), uv(x0, z1), uv(x1, z0)], mat, col);
        mb.tri(B, D, Cc, [uv(x1, z0), uv(x0, z1), uv(x1, z1)], mat, col);
      }
      const roads = p === P.ROAD;
      const mask = world.pathMask(tx, tz, roads);
      const bw = roads ? 0.18 : 0.28;
      const cc = curbCol[p];
      const H = (x, z) => world.heightAt(x, z) + lift + (roads ? 0.01 : 0.09);
      const edge = (ax, az, bx, bz, ix, iz) => {
        const a = [ax, H(ax, az), az], b = [bx, H(bx, bz), bz];
        const c = [bx + ix * bw, H(bx + ix * bw, bz + iz * bw), bz + iz * bw], d = [ax + ix * bw, H(ax + ix * bw, az + iz * bw), az + iz * bw];
        mb.quad4(a, b, c, d, [0, 0], [1, 0], [1, 1], [0, 1], MB.MAT_SOLID, roads ? MB.rgba('#e8e8e0') : cc);
      };
      if (!(mask & 1)) edge(x1, z0, x0, z0, 0, 1);
      if (!(mask & 2)) edge(x1, z1, x1, z0, -1, 0);
      if (!(mask & 4)) edge(x0, z1, x1, z1, 0, -1);
      if (!(mask & 8)) edge(x0, z0, x0, z1, 1, 0);
      if (roads && (mask === 10 || mask === 5)) {
        /* dashed centre line on straight road pieces */
        const along = mask === 10;
        for (let k = 0; k < 2; k++) {
          const s0 = 0.4 + k * 2, s1 = s0 + 1.1;
          let a, b, c, d;
          if (along) {
            const zc = z0 + T / 2;
            a = [x0 + s0, 0, zc - 0.08]; b = [x0 + s1, 0, zc - 0.08]; c = [x0 + s1, 0, zc + 0.08]; d = [x0 + s0, 0, zc + 0.08];
          } else {
            const xc = x0 + T / 2;
            a = [xc - 0.08, 0, z0 + s0]; b = [xc + 0.08, 0, z0 + s0]; c = [xc + 0.08, 0, z0 + s1]; d = [xc - 0.08, 0, z0 + s1];
          }
          for (const q of [a, b, c, d]) q[1] = world.heightAt(q[0], q[2]) + lift + 0.015;
          mb.quad4(a, d, c, b, [0, 0], [0, 1], [1, 1], [1, 0], MB.MAT_SOLID, MB.rgba('#f2d64b'));
        }
      }
      /* addons */
      const ad = world.addon[tx + tz * N];
      if (ad) addonMesh(mb, world, tx, tz, ad, mask);
      /* litter */
      const lit = world.litter[tx + tz * N];
      for (let k = 0; k < Math.min(lit, 12); k++) {
        const lx = x0 + 0.5 + U.hash2(tx * 13 + k, tz, 5) * (T - 1), lz = z0 + 0.5 + U.hash2(tx, tz * 7 + k, 9) * (T - 1);
        const ly = world.heightAt(lx, lz) + lift + 0.02;
        const lc = MB.rgba(['#e53935', '#fdd835', '#ffffff', '#1e88e5'][k % 4]);
        mb.quad([lx - 0.12, ly, lz + 0.08], [lx + 0.12, ly, lz + 0.08], [lx + 0.12, ly, lz - 0.08], [lx - 0.12, ly, lz - 0.08], null, MB.MAT_SOLID, lc);
      }
    }
    return mb.build();
  }
  function addonMesh(mb, world, tx, tz, ad, mask) {
    const A = MX.World.ADDON;
    /* put addons on an unconnected edge, or the north edge */
    let side = 0;
    for (const s of [0, 1, 2, 3]) if (!(mask & (1 << s))) { side = s; break; }
    const cx = tx * T + T / 2, cz = tz * T + T / 2;
    const off = T / 2 - 0.5;
    const dir = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
    const x = cx + dir[0] * off, z = cz + dir[1] * off;
    const y = world.heightAt(x, z) + 0.07;
    const yaw = Math.atan2(dir[1], dir[0]) + Math.PI;
    mb.push(); mb.translate(x, y, z); mb.rotateY(yaw);
    if (ad === A.BENCH) {
      const wood = MB.rgba('#a1723f'), metal = MB.rgba('#3c3c3c');
      mb.box(-0.25, 0.42, -0.8, 0.2, 0.5, 0.8, { col: wood });
      mb.box(-0.32, 0.5, -0.8, -0.24, 0.9, 0.8, { col: wood });
      mb.box(-0.2, 0, -0.75, 0.15, 0.42, -0.65, { col: metal }).box(-0.2, 0, 0.65, 0.15, 0.42, 0.75, { col: metal });
    } else if (ad === A.BIN) {
      mb.cylinder(0, 0, 0, 0.28, 0.85, 7, MB.MAT_SOLID, MB.rgba('#2e7d32'));
      mb.cylinder(0, 0.85, 0, 0.3, 0.06, 7, MB.MAT_SOLID, MB.rgba('#1b5e20'));
    } else if (ad === A.LAMP) {
      mb.box(-0.06, 0, -0.06, 0.06, 3.4, 0.06, { col: MB.rgba('#37474f') });
      mb.box(-0.3, 3.3, -0.15, 0.3, 3.5, 0.15, { col: MB.rgba('#263238') });
      mb.box(-0.22, 3.22, -0.1, 0.22, 3.3, 0.1, { col: MB.rgba('#fff59d') });
    }
    mb.pop();
  }

  MX.Geom = { terrainChunk, skirt, track, startGate, paths, CH, GROUND_LAYER, TRACK_LAYER };
})(window.MX);
