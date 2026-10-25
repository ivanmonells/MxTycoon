/* MX Tycoon - scene geometry builders: terrain chunks, map skirt, tracks (surface,
   embankments, stakes, finish arch, start gate), paths and roads. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U, MB = MX.MeshBuilder, Cat = MX.Catalog;
  const T = C.TILE;
  const L = () => MX.Tex.L;
  const GROUND_LAYER = ['grass', 'dry', 'dirt', 'sand', 'rock', 'forest', 'gravel', 'snow'];
  const TRACK_LAYER = ['t_dirt', 't_sand', 't_mud', 't_hard', 't_clay', 't_loam', 't_gravel'];
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
    const c = tr.chute && tr.chute.S ? tr.chute : null;
    const mb = new MB((S.n + (c ? c.S.n : 0)) * 40);
    /* crossings with itself and the other circuits: bridges over, tunnels under */
    const xs = opts.tracks && !opts.ghost ? MX.Track.crossingsFor(tr, opts.tracks) : [];
    const vg = c ? vergeOf(tr) : null;
    const marks = xs.length ? crossingMarks(tr, xs, world) : null;
    surface(mb, tr, world, opts, null, marks, vg);
    /* the wide start straight, tucked just under the circuit where the two overlap */
    if (c) { surface(mb, c, world, opts, tr, null, vg); verge(mb, tr, world, vg); }
    if (marks) for (const t of marks.tunnels) tunnel(mb, t);
    if (!opts.ghost && opts.decor !== false) trackDecor(tr, world, mb);
    return mb.build();
  }
  /* Bridges and tunnels. Walls are solid slabs WALL_T thick with one face per side, each
     facing its own way: a single face drawn twice with opposite normals fights itself for
     the depth buffer and comes out in light and dark stripes. */
  const WALL_T = 0.4, CONCRETE = [0.84, 0.83, 0.8, 1];
  /* bottom of the deck of crossing c above (x, z), or null when it is not over that point */
  function deckBottom(c, x, z) {
    const Up = c.U, h = Up.nearestS(x, z, c.iu * C.TRACK_DS, 40);
    if (!h) return null;
    const hw = Up.S.w[h.i] * 0.5;
    if (Math.abs(h.lane) > hw + WALL_T + 0.3) return null;
    return Up.S.y[h.i] + Up.bankAt(h.i, U.clamp(h.lane, -hw, hw)) - MX.Track.DECK;
  }
  /* Samples of tr whose embankment becomes a wall (it is the bridge of a crossing, the
     walls reaching far enough to keep the slopes off the path below), and the tunnel
     walls of the crossings it goes under: columns {x, y top, z, nx, nz outwards, f foot}
     per side, whose samples lose their slope on that side. */
  function crossingMarks(tr, xs, world) {
    const S = tr.S, n = S.n, wall = new Uint8Array(n), tun = { '-1': new Uint8Array(n), '1': new Uint8Array(n) }, tunnels = [];
    const wrap = (k) => S.closed ? U.mod(k, n) : U.clamp(k, 0, n - 1);
    for (const c of xs) {
      if (c.U === tr) {
        const h = Math.max(0, S.y[c.iu] - S.terr[c.iu]);
        const m = Math.ceil((MX.Track.bankRun(h) / Math.tan(Math.max(c.ang, 0.4)) + 3) / C.TRACK_DS);
        for (let k = c.iu + c.u0 - m; k <= c.iu + c.u1 + m; k++) { const i = S.closed ? U.mod(k, n) : k; if (i >= 0 && i < n) wall[i] = 1; }
      }
      if (c.L !== tr) continue;
      const walls = {};
      for (const side of [-1, 1]) {
        const cols = [];
        for (let k = c.il + c.l0 - 30; k <= c.il + c.l1 + 30; k++) {
          const i = wrap(k), hdg = S.hdg[i], lx = -Math.sin(hdg) * side, lz = Math.cos(hdg) * side, off = S.w[i] * 0.5 + 0.5;
          const x = S.x[i] + lx * off, z = S.z[i] + lz * off, top = deckBottom(c, x, z);
          if (top == null) { if (cols.length) break; continue; }
          cols.push({ x, y: top, z, nx: lx, nz: lz, f: Math.min(S.y[i], world.heightAt(x, z)) - 0.3, k });
          tun[side][i] = 1;
        }
        walls[side] = cols;
      }
      tunnels.push({ c, walls });
    }
    return { wall, tun, tunnels, xs: xs.filter(c => c.U === tr) };
  }
  /* A wall along columns {x, y top, z, nx, nz, fL, fR, split}: its face towards (nx, nz)
     stands WALL_T out from the columns, the other on them; normals follow the columns so
     curved walls shade smoothly. fL / fR: the foot on either side of a column (they differ
     where the wall is cut back over a tunnel, which gets an end face there). ends: close
     both ends too (a wall that ends in an embankment leaves them inside it). */
  function slab(mb, cols, mat, ends) {
    const T = WALL_T, up = [0, 1, 0], down = [0, -1, 0];
    let u = 0;
    for (let k = 0; k + 1 < cols.length; k++) {
      const A = cols[k], B = cols[k + 1];
      const len = Math.hypot(B.x - A.x, B.z - A.z);
      const u0 = u / 16, u1 = (u + len) / 16;
      u += len;
      const fa = A.fR, fb = B.fL;
      const ai = [A.x, A.y, A.z], bi = [B.x, B.y, B.z], ao = [A.x + A.nx * T, A.y, A.z + A.nz * T], bo = [B.x + B.nx * T, B.y, B.z + B.nz * T];
      const fl = (p, y) => [p[0], y, p[2]];
      const na = [A.nx, 0, A.nz], nb = [B.nx, 0, B.nz], ma = [-A.nx, 0, -A.nz], mbn = [-B.nx, 0, -B.nz];
      const v = (y) => -y / 16;
      mb.quadN(ao, bo, fl(bo, fb), fl(ao, fa), na, nb, nb, na, [u0, v(A.y)], [u1, v(B.y)], [u1, v(fb)], [u0, v(fa)], mat, CONCRETE);
      mb.quadN(bi, ai, fl(ai, fa), fl(bi, fb), mbn, ma, ma, mbn, [u1, v(B.y)], [u0, v(A.y)], [u0, v(fa)], [u1, v(fb)], mat, CONCRETE);
      mb.quadN(ai, bi, bo, ao, up, up, up, up, [u0, 0], [u1, 0], [u1, T / 16], [u0, T / 16], mat, CONCRETE);
      /* the underside where it is cut back over a tunnel (or just above the ground) */
      mb.quadN(fl(ai, fa), fl(ao, fa), fl(bo, fb), fl(bi, fb), down, down, down, down, [u0, 0], [u0, T / 16], [u1, T / 16], [u1, 0], mat, CONCRETE);
    }
    /* end faces where the wall is cut back over a tunnel and at both ends */
    const end = (k, dir) => {
      const P = cols[k], Q = cols[U.clamp(k + dir, 0, cols.length - 1)];
      let tx = Q.x - P.x, tz = Q.z - P.z;
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      return { P, n: [tx, 0, tz] };
    };
    const face = (P, lo, hi, n) => {
      const a = [P.x, hi, P.z], b = [P.x + P.nx * WALL_T, hi, P.z + P.nz * WALL_T];
      mb.quadN(a, b, [b[0], lo, b[2]], [a[0], lo, a[2]], n, n, n, n, [0, -hi / 16], [WALL_T / 16, -hi / 16], [WALL_T / 16, -lo / 16], [0, -lo / 16], mat, CONCRETE);
    };
    if (ends && cols.length > 1) {
      const s = end(0, 1), e = end(cols.length - 1, -1);
      face(s.P, s.P.fR, s.P.y, s.n.map(x => -x));
      face(e.P, e.P.fL, e.P.y, e.n.map(x => -x));
    }
    for (let k = 1; k + 1 < cols.length; k++) {
      const P = cols[k];
      if (!P.split) continue;
      /* faces the opening, which is on the side with the higher foot */
      const t = end(k, 1);
      face(P, Math.min(P.fL, P.fR), Math.max(P.fL, P.fR), P.fR > P.fL ? t.n : t.n.map(x => -x));
    }
  }
  /* The walls of a bridge on one side of the upper path (columns along its edge), cut back to
     the deck where a path below goes through, with the cut placed exactly on that path's
     tunnel walls. */
  function bridgeWall(mb, world, run, marks) {
    const DS = C.TRACK_DS, DECK = MX.Track.DECK;
    /* < 0 where a path below goes through */
    const gap = (p) => {
      let b = Infinity;
      for (const c of marks.xs) {
        const h = c.L.nearestS(p.x, p.z, c.il * DS, 40);
        if (h) b = Math.min(b, Math.abs(h.lane) - (c.L.S.w[h.i] * 0.5 + 0.5));
      }
      return b;
    };
    const ground = (p) => Math.min(p.y, world.heightAt(p.x, p.z)) - 0.25;
    const cols = [];
    let pb = null, pp = null;
    for (const p of run) {
      const b = gap(p);
      if (pp && (pb < 0) !== (b < 0)) {
        const t = pb / (pb - b), lp = (a, c) => a + (c - a) * t;
        let nx = lp(pp.nx, p.nx), nz = lp(pp.nz, p.nz);
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const q = { x: lp(pp.x, p.x), y: lp(pp.y, p.y), z: lp(pp.z, p.z), nx, nz, split: true };
        const fo = q.y - DECK, fc = ground(q);
        q.fL = pb < 0 ? fo : fc; q.fR = b < 0 ? fo : fc;
        cols.push(q);
      }
      const f = b < 0 ? p.y - DECK : ground(p);
      cols.push(Object.assign({}, p, { fL: f, fR: f }));
      pb = b; pp = p;
    }
    slab(mb, cols, L().concrete, false);
  }
  /* A tunnel under crossing c: walls along both sides of the lower path and the underside of
     the deck between them. */
  function tunnel(mb, t) {
    const conc = L().concrete;
    for (const side of [-1, 1]) slab(mb, t.walls[side].map(p => Object.assign({}, p, { fL: p.f, fR: p.f })), conc, true);
    const A = t.walls[-1], B = t.walls[1], down = [0, -1, 0];
    const byK = new Map(B.map(p => [p.k, p]));
    let prev = null;
    for (const a of A) {
      const b = byK.get(a.k);
      if (!b) { prev = null; continue; }
      if (prev) {
        const [pa, pb] = prev;
        mb.quadN([pa.x, pa.y, pa.z], [a.x, a.y, a.z], [b.x, b.y, b.z], [pb.x, pb.y, pb.z], down, down, down, down,
          [pa.x / 16, pa.z / 16], [a.x / 16, a.z / 16], [b.x / 16, b.z / 16], [pb.x / 16, pb.z / 16], conc, [0.62, 0.61, 0.59, 1]);
      }
      prev = [a, b];
    }
  }
  /* The ground between a start straight and the circuit running beside it: a grass verge
     from one edge to the other while they are within a few metres (two embankments
     dropping into a narrow ditch read as a dark hole), closing to a point where they meet.
     pts[i]: {e, m} for start straight sample i (its inner edge and the circuit's edge),
     inner[i]: the lane side of that edge; skip[i]: no slope on that side; u0..u1: where the
     circuit's own slope on that side is left out. */
  function vergeOf(tr) {
    const c = tr.chute, S = c.S, M = tr.S, F = c.frame, side = tr.chuteSide, n = S.n;
    const wIn = F.w0 * 0.5, pts = new Array(n).fill(null), inner = new Int8Array(n), skip = new Uint8Array(n);
    let u0 = Infinity, first = -1;
    for (let i = 0; i < n; i++) {
      const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg), hw = S.w[i] * 0.5;
      inner[i] = nx * F.nx + nz * F.nz > 0 ? -1 : 1;
      const ex = S.x[i] + nx * hw * inner[i], ez = S.z[i] + nz * hw * inner[i];
      const u = tr.chuteU(ex, ez), v = tr.chuteV(ex, ez);
      /* past the point where it reaches the circuit its edge lies under it */
      if (v - wIn < 0.05) { if (first >= 0) for (let k = i; k < n; k++) skip[k] = 1; break; }
      const mi = tr.sIndex(u < 0 ? M.L + u : u), mh = M.hdg[mi], mw = M.w[mi] * 0.5;
      const m = [M.x[mi] - Math.sin(mh) * mw * side, M.y[mi], M.z[mi] + Math.cos(mh) * mw * side];
      /* only beside the circuit's straight first piece, not where it bends away */
      if (v - wIn > 7 || Math.abs(tr.chuteV(m[0], m[2]) - wIn) > 0.8) continue;
      pts[i] = { e: [ex, S.y[i] + c.bankAt(i, hw * inner[i]), ez], m };
      skip[i] = 1;
      if (first < 0) first = i;
      u0 = Math.min(u0, u);
    }
    return { pts, inner, skip, u0, u1: F.uM - 0.5 };
  }
  /* a quad facing up whichever way round its corners come */
  function upQuad(mb, a, b, c, d, mat, col) {
    const uv = (p) => [p[0] / 16, p[2] / 16];
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny >= 0) mb.quad4(a, b, c, d, uv(a), uv(b), uv(c), uv(d), mat, col);
    else mb.quad4(a, d, c, b, uv(a), uv(d), uv(c), uv(b), mat, col);
  }
  function verge(mb, tr, world, vg) {
    const P = vg.pts, n = P.length, step = 2, grass = L().grass, em = L().embank;
    const col = [0.94, 0.97, 0.9, 1], ec = [0.9, 0.88, 0.86, 1];
    const foot = (p) => [p[0], Math.min(p[1], world.heightAt(p[0], p[2])) - 0.12, p[2]];
    let prev = -1;
    for (let k = 0; k < n; k += step) {
      const q = P[k];
      if (q && prev >= 0 && P[prev]) upQuad(mb, P[prev].e, P[prev].m, q.m, q.e, grass, col);
      /* where it begins or breaks off, close its end down to the ground */
      if (q && (prev < 0 || !P[prev]) || (!q && prev >= 0 && P[prev] && !vg.skip[k])) {
        const r = q || P[prev], a = r.e, b = r.m;
        /* two faces a few centimetres apart, each facing its own way (one face drawn twice
           would fight itself for the depth buffer and flicker in stripes) */
        let nx = -(b[2] - a[2]), nz = b[0] - a[0];
        const l = Math.hypot(nx, nz) || 1; nx *= 0.02 / l; nz *= 0.02 / l;
        const off = (p, s) => [p[0] + nx * s, p[1], p[2] + nz * s];
        const fa = foot(a), fb = foot(b);
        const n1 = [nx, 0, nz], n2 = [-nx, 0, -nz];
        mb.quadN(off(b, 1), off(a, 1), off(fa, 1), off(fb, 1), n1, n1, n1, n1, [0.2, 0], [0, 0], [0, 0.1], [0.2, 0.1], em, ec);
        mb.quadN(off(a, -1), off(b, -1), off(fb, -1), off(fa, -1), n2, n2, n2, n2, [0, 0], [0.2, 0], [0.2, 0.1], [0, 0.1], em, ec);
      }
      prev = k;
    }
  }
  function surface(mb, tr, world, opts, parent, marks, vg) {
    const S = tr.S;
    const step = 2;
    const n = S.n;
    const lastI = parent ? Math.min(n - 1, tr.sIndex(tr.mergeAt) + step) : S.closed ? n : n - 1;
    /* steps along the path ending exactly on its last sample (a loop back on its first one) */
    const ks = [];
    for (let k = step; k < lastI; k += step) ks.push(k);
    ks.push(lastI);
    /* the start straight is wide and ramps down to the circuit: finer across */
    const lanes = parent ? [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1] : [-1, -0.5, 0, 0.5, 1];
    const last = lanes.length - 1;
    const wIn = parent ? tr.frame.w0 * 0.5 : 0;
    const cross = (i) => {
      const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
      const hw = S.w[i] * 0.5;
      const ls = lanes.map(f => f * hw);
      const pts = ls.map((l) => {
        const p = [S.x[i] + nx * l, S.y[i] + tr.bankAt(i, l), S.z[i] + nz * l];
        /* just under the circuit where it lies on it */
        if (parent && parent.chuteV(p[0], p[2]) < wIn) p[1] -= 0.06;
        return p;
      });
      return { pts, ls, nx, nz, hw, i };
    };
    /* the slopes on either side of the verge between a start straight and its circuit */
    const vergeSide = (i, side) => {
      if (!vg) return false;
      if (parent) return vg.skip[i] && vg.inner[i] === side;
      const s = i * C.TRACK_DS, u = S.closed && s > S.L / 2 ? s - S.L : s;
      return side === tr.chuteSide && u >= vg.u0 - 0.5 && u <= vg.u1;
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
    /* cross-sections first, then a normal at each point from its neighbours along and across,
       so curved and twisted stretches (berms, ramps) shade smoothly instead of in facets */
    const rows = [cross(0)];
    for (const k of ks) { const r = cross(S.closed ? k % n : Math.min(k, n - 1)); r.k = k; rows.push(r); }
    rows[0].k = 0;
    const R = rows.length;
    for (let j = 0; j < R; j++) {
      const pa = rows[j > 0 ? j - 1 : S.closed ? R - 2 : 0].pts, pb = rows[j < R - 1 ? j + 1 : S.closed ? 1 : j].pts, r = rows[j].pts;
      rows[j].nrm = r.map((p, q) => {
        const qa = r[Math.max(0, q - 1)], qb = r[Math.min(last, q + 1)];
        const ax = pb[q][0] - pa[q][0], ay = pb[q][1] - pa[q][1], az = pb[q][2] - pa[q][2];
        const bx = qb[0] - qa[0], by = qb[1] - qa[1], bz = qb[2] - qa[2];
        let x = by * az - bz * ay, y = bz * ax - bx * az, z = bx * ay - by * ax;
        if (y < 0) { x = -x; y = -y; z = -z; }
        const l = Math.hypot(x, y, z) || 1;
        return [x / l, y / l, z / l];
      });
    }
    /* bridges: runs of wall along each edge, reaching the first cross-section of slope on
       either side (where the slope's end is closed by a wing wall) */
    if (marks && marks.xs.length) for (const side of [-1, 1]) {
      let run = [];
      for (let j = 0; j < R; j++) {
        const r = rows[j], on = marks.wall[r.i] || (j > 0 && marks.wall[rows[j - 1].i]) || (j + 1 < R && marks.wall[rows[j + 1].i]);
        if (on) { const e = side < 0 ? r.pts[0] : r.pts[last]; run.push({ x: e[0], y: e[1], z: e[2], nx: r.nx * side, nz: r.nz * side }); continue; }
        if (run.length > 1) bridgeWall(mb, world, run, marks);
        run = [];
      }
      if (run.length > 1) bridgeWall(mb, world, run, marks);
    }
    for (let j = 1; j < R; j++) {
      const prev = rows[j - 1], cur = rows[j], i = cur.i, k = cur.k;
      const mat = L()[TRACK_LAYER[S.surf[i]]];
      const col = tint(i), smooth = [col[0], col[1], col[2], 1.25];
      const v0 = prev.k * C.TRACK_DS / 16, v1 = k * C.TRACK_DS / 16;
      for (let q = 0; q < last; q++) {
        const a = prev.pts[q], b = prev.pts[q + 1], c = cur.pts[q + 1], d = cur.pts[q];
        const u0 = (prev.ls[q] + prev.hw) / 16, u1 = (prev.ls[q + 1] + prev.hw) / 16;
        /* order chosen so the face points up for a track heading +X with left normal +Z */
        mb.quadN(a, b, c, d, prev.nrm[q], prev.nrm[q + 1], cur.nrm[q + 1], cur.nrm[q], [u0, v0], [u1, v0], [u1, v1], [u0, v1], mat, smooth);
      }
      /* embankments on both sides */
      for (const side of [-1, 1]) {
        const ea = side < 0 ? prev.pts[0] : prev.pts[last];
        const eb = side < 0 ? cur.pts[0] : cur.pts[last];
        if (vergeSide(prev.i, side) && vergeSide(cur.i, side)) continue;
        if (marks) {
          const wa = marks.wall[prev.i], wb = marks.wall[cur.i];
          /* a bridge: walls instead of slopes (see bridgeWall) */
          if (wa || wb) {
            /* where the wall meets the slope, a wing wall closes the end of the slope,
               turned towards the bridge */
            if (wa !== wb) {
              const e = wa ? eb : ea, w = wa ? ea : eb, cc = wa ? cur : prev, ox = cc.nx * side, oz = cc.nz * side;
              const th = world.heightAt(e[0], e[2]), d = MX.Track.bankRun(Math.max(0, e[1] - th)) + 0.35;
              const o = [e[0] + ox * d, world.heightAt(e[0] + ox * d, e[2] + oz * d) - 0.18, e[2] + oz * d], g = [e[0], Math.min(e[1], th) - 0.25, e[2]];
              const nn = MB.normal(e, o, g), toward = (w[0] - e[0]) * nn[0] + (w[2] - e[2]) * nn[2];
              const uv = (p) => [((p[0] - e[0]) * ox + (p[2] - e[2]) * oz) / 16, -p[1] / 16];
              if (toward >= 0) mb.tri(e, o, g, [uv(e), uv(o), uv(g)], L().concrete, CONCRETE);
              else mb.tri(e, g, o, [uv(e), uv(g), uv(o)], L().concrete, CONCRETE);
            }
            continue;
          }
          /* through a tunnel its walls take the place of the slopes */
          if (marks.tun[side][prev.i] && marks.tun[side][cur.i]) continue;
        }
        const rim = (e, c) => {
          const ox = c.nx * side, oz = c.nz * side;
          const r = [e[0] + ox * 0.35, e[1] - 0.06, e[2] + oz * 0.35];
          const th = world.heightAt(e[0], e[2]);
          const d = MX.Track.bankRun(Math.max(0, e[1] - th));
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
    }
  }

  /* ---------------- track decoration: edges, finish arch and obstacles ----------------
     Built separately from the surface (which is rebuilt as it wears and dries) and
     styled by discipline: tape stakes (motocross), small coloured stakes (minicross),
     stadium walls (supercross), a white rail (dirt track), tape in the woods (enduro)
     and tyre walls (car cross). */
  function edgeAt(tr, world, i, side, extra) {
    const S = tr.S, hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
    const hw = S.w[i] * 0.5 + extra;
    const x = S.x[i] + nx * hw * side, z = S.z[i] + nz * hw * side;
    const y = Math.max(S.y[i] + tr.bankAt(i, S.w[i] * 0.5 * side) - 0.05, world.heightAt(x, z));
    return { x, y, z, nx: nx * side, nz: nz * side, hdg };
  }
  /* side of each sample facing away from the middle of the loop */
  function outerSide(S) {
    let mx = 0, mz = 0;
    for (let k = 0; k < S.n; k += 8) { mx += S.x[k]; mz += S.z[k]; }
    const cnt = Math.ceil(S.n / 8); mx /= cnt; mz /= cnt;
    return (i) => {
      const nx = -Math.sin(S.hdg[i]), nz = Math.cos(S.hdg[i]);
      return ((S.x[i] + nx - mx) ** 2 + (S.z[i] + nz - mz) ** 2) > ((S.x[i] - nx - mx) ** 2 + (S.z[i] - nz - mz) ** 2) ? 1 : -1;
    };
  }
  /* fn(i, k, open): open(side) is true where that edge is left open (start gate, start straight) */
  function eachEdge(tr, every, fn) {
    const S = tr.S, n = S.n, lastI = S.closed ? n : n - 1;
    const step = Math.max(1, Math.round(every / C.TRACK_DS));
    let k0 = 0;
    for (let k = 0; k <= lastI; k += step, k0++) {
      const i = S.closed ? k % n : Math.min(k, n - 1);
      fn(i, k0, (side) => tr.edgeOpen(i, side));
    }
  }
  /* a tape (or solid band) between two points, seen from both sides: one face for each
     side, a centimetre apart (one face drawn twice fights itself for the depth buffer) */
  function band(mb, a, b, y0, y1, mat, col) {
    const uv = [0, 0, 0.4, 0.05];
    let nx = -(b.z - a.z), nz = b.x - a.x;
    const l = Math.hypot(nx, nz) || 1; nx *= 0.005 / l; nz *= 0.005 / l;
    mb.quad([a.x + nx, a.y + y0, a.z + nz], [b.x + nx, b.y + y0, b.z + nz], [b.x + nx, b.y + y1, b.z + nz], [a.x + nx, a.y + y1, a.z + nz], uv, mat, col);
    mb.quad([b.x - nx, b.y + y0, b.z - nz], [a.x - nx, a.y + y0, a.z - nz], [a.x - nx, a.y + y1, a.z - nz], [b.x - nx, b.y + y1, b.z - nz], uv, mat, col);
  }
  /* posts every o.every metres, the tape between them following the edge round the curves
     (straight from post to post it would cut across them, floating over the slopes) */
  function stakes(mb, tr, world, o) {
    const FINE = 1.5, per = Math.max(1, Math.round(o.every / FINE));
    const last = { '-1': null, '1': null };
    const post = (e, n) => mb.box(e.x - o.t, e.y, e.z - o.t, e.x + o.t, e.y + o.h, e.z + o.t, { col: n % 2 ? o.colA : o.colB });
    eachEdge(tr, FINE, (i, k, open) => {
      const n = Math.floor(k / per), onPost = k % per === 0;
      for (const side of [-1, 1]) {
        const p = last[side];
        /* a post where the tape ends at an opening */
        if (open(side)) { if (p && !p.post) post(p, n); last[side] = null; continue; }
        const e = edgeAt(tr, world, i, side, o.extra);
        e.post = onPost || !p;
        if (e.post) post(e, n);
        if (p && U.dist2(p.x, p.z, e.x, e.z) < (FINE * 3) ** 2) band(mb, p, e, o.h * 0.78, o.h * 0.88, o.tapeMat, o.tapeCol);
        if (o.arrows && onPost && n % 7 === 3 && Math.abs(tr.S.curv[i]) > 1 / 30 && side === -Math.sign(tr.S.curv[i])) {
          /* yellow arrow board on the outside of a corner */
          const ax = -e.nz * 0.35, az = e.nx * 0.35, fx = e.nx * 0.005, fz = e.nz * 0.005;
          mb.quad([e.x - ax + fx, e.y + 0.55, e.z - az + fz], [e.x + ax + fx, e.y + 0.55, e.z + az + fz], [e.x + ax + fx, e.y + 0.95, e.z + az + fz], [e.x - ax + fx, e.y + 0.95, e.z - az + fz], null, MB.MAT_SOLID, MB.rgba('#fdd835'));
          mb.quad([e.x + ax - fx, e.y + 0.55, e.z + az - fz], [e.x - ax - fx, e.y + 0.55, e.z - az - fz], [e.x - ax - fx, e.y + 0.95, e.z - az - fz], [e.x + ax - fx, e.y + 0.95, e.z + az - fz], null, MB.MAT_SOLID, MB.rgba('#fdd835'));
        }
        last[side] = e;
      }
    });
  }
  /* supercross: low walls with sponsor boards */
  function walls(mb, tr, world) {
    const last = { '-1': null, '1': null };
    const logos = Cat.sponsors.map(sp => 'logo_' + sp.id).concat(['logo_mxt', 'sign_sx']);
    const H = 0.75, TH = 0.3;
    eachEdge(tr, 2, (i, k, open) => {
      for (const side of [-1, 1]) {
        if (open(side)) { last[side] = null; continue; }
        const e = edgeAt(tr, world, i, side, 0.35);
        const p = last[side];
        if (p && U.dist2(p.x, p.z, e.x, e.z) < 16) {
          const col = MB.rgba(Math.floor(k / 4) % 2 ? '#5e35b1' : '#eceff1');
          const po = [p.x + p.nx * TH, p.z + p.nz * TH], eo = [e.x + e.nx * TH, e.z + e.nz * TH];
          const f = side > 0;
          /* track-side face, top and back */
          const A = [p.x, p.y, p.z], B = [e.x, e.y, e.z], Bt = [e.x, e.y + H, e.z], At = [p.x, p.y + H, p.z];
          const Ao = [po[0], p.y, po[1]], Bo = [eo[0], e.y, eo[1]], Bot = [eo[0], e.y + H, eo[1]], Aot = [po[0], p.y + H, po[1]];
          if (f) { mb.quad(B, A, At, Bt, null, MB.MAT_SOLID, col); mb.quad(Bt, At, Aot, Bot, null, MB.MAT_SOLID, MB.mulCol(col, 1.08)); mb.quad(Ao, Bo, Bot, Aot, null, MB.MAT_SOLID, MB.mulCol(col, 0.8)); }
          else { mb.quad(A, B, Bt, At, null, MB.MAT_SOLID, col); mb.quad(At, Bt, Bot, Aot, null, MB.MAT_SOLID, MB.mulCol(col, 1.08)); mb.quad(Bo, Ao, Aot, Bot, null, MB.MAT_SOLID, MB.mulCol(col, 0.8)); }
          /* a sponsor board on the track side every 24 m */
          if (k % 12 === 6) {
            const r = MX.Tex.regions[logos[(Math.floor(k / 12) + (side > 0 ? 3 : 0)) % logos.length]];
            if (r) {
              const lift = (q, d) => [q[0] - e.nx * d, q[1], q[2] - e.nz * d];
              const a0 = lift([p.x, p.y + 0.12, p.z], 0.02), b0 = lift([e.x, e.y + 0.12, e.z], 0.02), b1 = lift([e.x, e.y + H - 0.08, e.z], 0.02), a1 = lift([p.x, p.y + H - 0.08, p.z], 0.02);
              if (f) mb.quad(b0, a0, a1, b1, r.uv, MB.MAT_ATLAS, [1, 1, 1, 1]); else mb.quad(a0, b0, b1, a1, r.uv, MB.MAT_ATLAS, [1, 1, 1, 1]);
            }
          }
        }
        last[side] = e;
      }
    });
  }
  /* dirt track: white rail on the outside (padded in the corners), white line inside */
  function rails(mb, tr, world) {
    const S = tr.S, outer = outerSide(S);
    let lastO = null, lastI = null;
    const white = MB.rgba('#f4f4f2'), pad = MB.rgba('#1e88e5'), line = MB.rgba('#fafafa');
    eachEdge(tr, 3, (i, k, open) => {
      const so = outer(i);
      if (open(so) || open(-so)) { lastO = null; lastI = null; return; }
      const e = edgeAt(tr, world, i, so, 0.7);
      const corner = Math.abs(S.curv[i]) > 1 / 30;
      if (corner) mb.box(e.x - 0.3, e.y, e.z - 0.3, e.x + 0.3, e.y + 1.1, e.z + 0.3, { col: k % 2 ? pad : white });
      else mb.box(e.x - 0.06, e.y, e.z - 0.06, e.x + 0.06, e.y + 1.0, e.z + 0.06, { col: white });
      if (lastO && U.dist2(lastO.x, lastO.z, e.x, e.z) < 64) { band(mb, lastO, e, 0.42, 0.52, MB.MAT_SOLID, white); band(mb, lastO, e, 0.86, 0.98, MB.MAT_SOLID, white); }
      lastO = e;
      /* inside: a painted line on the track edge */
      const hdg = S.hdg[i], nx = -Math.sin(hdg) * -so, nz = Math.cos(hdg) * -so;
      const hw = S.w[i] * 0.5;
      const a = [S.x[i] + nx * (hw - 0.05), S.y[i] + 0.04, S.z[i] + nz * (hw - 0.05)], b = [S.x[i] + nx * (hw - 0.35), S.y[i] + 0.04, S.z[i] + nz * (hw - 0.35)];
      /* keep the strip facing up whichever side it is on */
      if (lastI) {
        if (so < 0) mb.quad4(lastI[0], a, b, lastI[1], [0, 0], [1, 0], [1, 1], [0, 1], MB.MAT_SOLID, line);
        else mb.quad4(lastI[1], b, a, lastI[0], [0, 0], [1, 0], [1, 1], [0, 1], MB.MAT_SOLID, line);
      }
      lastI = [a, b];
    });
  }
  /* minicross: low plastic barrier blocks in bright colours */
  function blocks(mb, tr, world) {
    const cols = ['#29b6f6', '#fdd835', '#29b6f6', '#ef5350'].map(c => MB.rgba(c));
    eachEdge(tr, 1.6, (i, k, open) => {
      for (const side of [-1, 1]) {
        if (open(side)) continue;
        const e = edgeAt(tr, world, i, side, 0.45);
        mb.push(); mb.translate(e.x, e.y, e.z); mb.rotateY(e.hdg);
        mb.box(-0.68, 0, -0.17, 0.68, 0.42, 0.17, { col: cols[k % cols.length] });
        mb.pop();
      }
    });
  }
  /* supercross: floodlight towers at the corners of the stadium */
  function floodlights(mb, tr, world) {
    const S = tr.S;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < S.n; i += 4) { x0 = Math.min(x0, S.x[i]); x1 = Math.max(x1, S.x[i]); z0 = Math.min(z0, S.z[i]); z1 = Math.max(z1, S.z[i]); }
    const grey = MB.rgba('#78909c'), lamp = MB.rgba('#fffde7'), frame = MB.rgba('#37474f');
    for (const [x, z, sx, sz] of [[x0 - 2, z0 - 2, 1, 1], [x1 + 2, z0 - 2, -1, 1], [x0 - 2, z1 + 2, 1, -1], [x1 + 2, z1 + 2, -1, -1]]) {
      if (!world.inBounds(Math.floor(x / C.TILE), Math.floor(z / C.TILE))) continue;
      const y = world.heightAt(x, z), H = 13;
      mb.box(x - 0.6, y - 0.3, z - 0.6, x + 0.6, y + 0.4, z + 0.6, { col: MB.rgba('#9e9e9e') });
      mb.box(x - 0.18, y, z - 0.18, x + 0.18, y + H, z + 0.18, { col: grey });
      /* the lamp panel faces the middle of the track */
      mb.push(); mb.translate(x, y + H, z); mb.rotateY(Math.atan2(sz, sx));
      mb.box(-0.3, -0.2, -1.5, 0.1, 1.5, 1.5, { col: frame });
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) mb.box(0.1, 0.05 + r * 0.72, -1.3 + c * 0.9, 0.22, 0.6 + r * 0.72, -0.6 + c * 0.9, { col: lamp });
      mb.pop();
    }
  }
  /* car cross: stacked tyre walls */
  function tyres(mb, tr, world) {
    const black = MB.rgba('#1d1d1f'), red = MB.rgba('#e53935'), white = MB.rgba('#f2f2f2');
    eachEdge(tr, 3, (i, k, open) => {
      for (const side of [-1, 1]) {
        if (open(side)) continue;
        const e = edgeAt(tr, world, i, side, 0.8);
        mb.cylinder(e.x, e.y, e.z, 0.38, 0.26, 7, MB.MAT_SOLID, black);
        mb.cylinder(e.x, e.y + 0.26, e.z, 0.38, 0.26, 7, MB.MAT_SOLID, k % 4 === 0 ? (side > 0 ? red : white) : black);
      }
    });
  }
  /* logs, stones and water on the obstacles */
  function obstacles(mb, tr, world) {
    const S = tr.S;
    for (const f of tr.features) {
      const d = Cat.features[f.type];
      if (!d || (d.kind !== 'logs' && d.kind !== 'rocks' && d.kind !== 'water')) continue;
      const len = f.len || MX.Track.getShape(f.type).len;
      if (d.kind === 'logs') {
        for (let k = 0; k < d.n; k++) {
          const i = tr.sIndex(f.s + (k + 0.5) * d.pitch);
          const hw = S.w[i] * 0.5 + 0.4, R = d.H / 2;
          mb.push(); mb.translate(S.x[i], S.base[i] + Track_THICK() + R * 0.9, S.z[i]); mb.rotateY(S.hdg[i]); mb.rotateX(Math.PI / 2);
          mb.cylinder(0, -hw, 0, R, 2 * hw, 7, MB.MAT_SOLID, MB.rgba(k % 2 ? '#6d4c33' : '#7b5638'));
          mb.pop();
        }
      } else if (d.kind === 'rocks') {
        for (let q = 0; q < len * 1.6; q++) {
          const u = U.hash2(q, f.uid, 31) * len, lane = (U.hash2(q, f.uid, 37) - 0.5);
          const i = tr.sIndex(f.s + u);
          const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg), l = lane * S.w[i];
          const x = S.x[i] + nx * l, z = S.z[i] + nz * l, r = 0.18 + U.hash2(q, f.uid, 41) * 0.22;
          mb.blob(x, S.y[i] + r * 0.2, z, r * 1.3, r * 0.7, r, [0.66, 0.64, 0.6, 1], q + f.uid, 0.3);
        }
      } else {
        /* water surface over the dip, a little below the normal track level */
        const cnt = Math.max(2, Math.round(len / 1));
        let prev = null;
        for (let k = 0; k <= cnt; k++) {
          const i = tr.sIndex(f.s + 0.8 + (len - 1.6) * k / cnt);
          const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg), hw = S.w[i] * 0.5 + 0.2;
          const y = S.base[i] + Track_THICK() - Math.min(0.15, d.depth * 0.3);
          const a = [S.x[i] - nx * hw, y, S.z[i] - nz * hw], b = [S.x[i] + nx * hw, y, S.z[i] + nz * hw];
          if (prev) mb.quad4(prev[0], prev[1], b, a, [0, 0], [1, 0], [1, 1], [0, 1], MB.MAT_SOLID, MB.rgba('#5b8fb0'));
          prev = [a, b];
        }
      }
    }
  }
  const Track_THICK = () => MX.Track.THICK;
  function trackDecor(tr, world, into) {
    const S = tr.S;
    if (!S || S.n < 4) return null;
    const mb = into || new MB(S.n * 24);
    edges(mb, tr, world);
    if (tr.chute && tr.chute.S) edges(mb, tr.chute, world);
    if (tr.typeDef.edge === 'sxwall') floodlights(mb, tr, world);
    obstacles(mb, tr, world);
    finishArch(mb, tr, world);
    return into ? null : mb.build();
  }
  function edges(mb, tr, world) {
    const style = tr.typeDef.edge;
    if (style === 'sxwall') walls(mb, tr, world);
    else if (style === 'rails') rails(mb, tr, world);
    else if (style === 'tyres') tyres(mb, tr, world);
    else if (style === 'kids') blocks(mb, tr, world);
    else if (style === 'tape') stakes(mb, tr, world, { every: 9, h: 1.0, t: 0.04, extra: 0.35, colA: MB.rgba('#e53935'), colB: MB.rgba('#f5f5f5'), tapeMat: L().track_tape, tapeCol: [1, 1, 1, 1], arrows: true });
    else stakes(mb, tr, world, { every: 6, h: 0.95, t: 0.06, extra: 0.55, colA: MB.rgba('#ff6a13'), colB: MB.rgba('#f2f2f2'), tapeMat: L().track_tape, tapeCol: [1, 1, 1, 1] });
  }
  function finishArch(mb, tr, world) {
    const S = tr.S;
    if (tr.finishS == null) return;
    const cross = (i) => {
      const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg), hw = S.w[i] * 0.5;
      return [-1, -0.5, 0, 0.5, 1].map(f => [S.x[i] + nx * f * hw, S.y[i] + tr.bankAt(i, f * hw), S.z[i] + nz * f * hw]);
    };
    const i = tr.sIndex(tr.finishS - 1), j = tr.sIndex(tr.finishS + 0.5);
    const ci = cross(i), cj = cross(j);
    const chk = L().checker;
    for (let q = 0; q < 4; q++) {
      const lift = (p) => [p[0], p[1] + 0.03, p[2]];
      mb.quad4(lift(ci[q]), lift(ci[q + 1]), lift(cj[q + 1]), lift(cj[q]), [q * 0.25, 0], [(q + 1) * 0.25, 0], [(q + 1) * 0.25, 0.1], [q * 0.25, 0.1], chk, [1, 1, 1, 1]);
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

  /* Start of the circuit, styled by discipline. */
  function startGate(tr, world, down) {
    const S = tr.S;
    if (!S) return null;
    /* with a wide start straight the gate stands across it */
    if (tr.chute && tr.chute.S) return gateStart(tr.chute, tr.chute.gateS, world, down);
    if (tr.startS == null) return null;
    const style = tr.typeDef.start;
    if (style === 'gate') return gateStart(tr, tr.startS, world, down);
    const mb = new MB(4096);
    const m = tr.sIndex(tr.startS);
    const hdg = S.hdg[m], hw = S.w[m] * 0.5, baseY = S.y[m];
    const white = MB.rgba('#f5f5f5'), dark = MB.rgba('#2b2b2b');
    mb.push();
    mb.translate(S.x[m], baseY, S.z[m]);
    mb.rotateY(hdg);
    /* painted start line (local x along the track, z across) */
    mb.quad([-0.2, 0.04, hw], [0.2, 0.04, hw], [0.2, 0.04, -hw], [-0.2, 0.04, -hw], null, MB.MAT_SOLID, white);
    if (style === 'line') {
      /* grid boxes and the starter's stand with the green flag */
      for (let r = 0; r < 3; r++) for (const z of [-hw * 0.5, hw * 0.5]) {
        const x0 = -2.2 - r * 3.2 - (z > 0 ? 1.6 : 0);
        mb.quad([x0 - 0.12, 0.04, z + 0.9], [x0 + 0.12, 0.04, z + 0.9], [x0 + 0.12, 0.04, z - 0.9], [x0 - 0.12, 0.04, z - 0.9], null, MB.MAT_SOLID, white);
      }
      mb.box(-0.6, 0, -hw - 2.4, 0.6, 1.2, -hw - 1.2, { mat: L().wood, col: [1, 1, 1, 1] });
      mb.box(-0.04, 1.2, -hw - 1.84, 0.04, 3.0, -hw - 1.76, { col: MB.rgba('#cfcfcf') });
      mb.quad([0, 2.2, -hw - 1.8], [1.1, 2.3, -hw - 1.8], [1.1, 2.95, -hw - 1.8], [0, 3.0, -hw - 1.8], null, MB.MAT_SOLID, MB.rgba('#2e7d32'));
      mb.quad([1.1, 2.3, -hw - 1.8], [0, 2.2, -hw - 1.8], [0, 3.0, -hw - 1.8], [1.1, 2.95, -hw - 1.8], null, MB.MAT_SOLID, MB.rgba('#2e7d32'));
    } else if (style === 'lights') {
      /* gantry with the five red start lights */
      for (const z of [-hw - 0.9, hw + 0.9]) mb.box(-0.2, -0.3, z - 0.2, 0.2, 5.0, z + 0.2, { col: dark });
      mb.box(-0.25, 4.6, -hw - 1.1, 0.25, 5.2, hw + 1.1, { col: MB.rgba('#37474f') });
      for (let k = 0; k < 5; k++) {
        const z = (k - 2) * 0.9;
        mb.box(-0.3, 4.05, z - 0.32, 0.3, 4.6, z + 0.32, { col: dark });
        mb.box(-0.34, 4.15, z - 0.2, -0.28, 4.5, z + 0.2, { col: MB.rgba(down ? '#3a1010' : '#ff3b30') });
      }
      const r = MX.Tex.regions.sign_salida;
      if (r) mb.quad([-0.27, 4.62, -1.6], [-0.27, 4.62, 1.6], [-0.27, 5.18, 1.6], [-0.27, 5.18, -1.6], r.uv, MB.MAT_ATLAS, [1, 1, 1, 1]);
    } else if (style === 'crono') {
      /* timing arch, the clock and the timekeepers' table */
      const post = MB.rgba('#455a64');
      for (const z of [-hw - 0.5, hw + 0.5]) mb.box(-0.12, -0.3, z - 0.12, 0.12, 3.4, z + 0.12, { col: post });
      mb.box(-0.15, 3.0, -hw - 0.7, 0.15, 3.6, hw + 0.7, { col: dark });
      const r = MX.Tex.regions.sign_crono;
      if (r) {
        mb.quad([-0.17, 3.05, -1.4], [-0.17, 3.05, 1.4], [-0.17, 3.55, 1.4], [-0.17, 3.55, -1.4], r.uv, MB.MAT_ATLAS, [1, 1, 1, 1]);
        mb.quad([0.17, 3.05, 1.4], [0.17, 3.05, -1.4], [0.17, 3.55, -1.4], [0.17, 3.55, 1.4], r.uv, MB.MAT_ATLAS, [1, 1, 1, 1]);
      }
      mb.box(-0.3, 0, -hw - 2.4, 0.3, 1.9, -hw - 1.6, { col: dark });
      mb.quad([-0.31, 1.2, -hw - 2.3], [-0.31, 1.2, -hw - 1.7], [-0.31, 1.8, -hw - 1.7], [-0.31, 1.8, -hw - 2.3], [0, 0, 0.6 / 16, 0.6 / 16], L().screen, MB.rgba('#ff9800'));
      mb.box(1.0, 0, -hw - 3.6, 2.6, 0.8, -hw - 2.6, { mat: L().wood, col: [1, 1, 1, 1] });
      mb.gable(0.8, -hw - 3.9, 2.8, -hw - 2.3, 1.9, 2.5, 'x', L().stripes, MB.rgba('#43a047'), MB.rgba('#43a047'), 0.05);
      for (const [x, z] of [[0.85, -hw - 3.85], [2.75, -hw - 3.85], [0.85, -hw - 2.35], [2.75, -hw - 2.35]]) mb.box(x - 0.04, 0, z - 0.04, x + 0.04, 1.9, z + 0.04, { col: MB.rgba('#cfd8dc') });
    }
    mb.pop();
    return mb.build();
  }
  /* Motocross start gate: static frame plus gates up or down. */
  function gateStart(tr, s, world, down) {
    const S = tr.S;
    const mb = new MB(8192);
    const m = tr.sIndex(s);
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
    const nGates = MX.Track.gateSlots(S.w[m]);
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

  MX.Geom = { terrainChunk, skirt, track, trackDecor, startGate, paths, CH, GROUND_LAYER, TRACK_LAYER };
})(window.MX);
