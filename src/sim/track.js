/* MX Tycoon - Track: circuits built piece by piece on the tile lattice (or, in old
   saves, closed splines through free nodes), with jumps and rhythm sections as real
   height profiles, berms, surfaces, widths and elevation. Produces the sampled
   geometry used by physics, AI, validation and rendering. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U, Cat = MX.Catalog;
  const DS = C.TRACK_DS;
  const THICK = 0.12;
  const SURF_IDX = {}; Cat.surfaceOrder.forEach((k, i) => { SURF_IDX[k] = i; });

  /* ---------------- feature profiles ---------------- */
  class Prof {
    constructor() { this.segs = []; this.u = 0; this.h = 0; this.slope = 0; this.lips = []; }
    seg(len, s1) {
      if (len <= 0) { this.slope = s1; return this; }
      const s0 = this.slope;
      this.segs.push({ u0: this.u, len, h0: this.h, s0, s1 });
      this.h += s0 * len + (s1 - s0) * len * 0.5;
      this.u += len; this.slope = s1;
      return this;
    }
    hold(len) { return this.seg(len, this.slope); }
    /* Ramp at `slope` (with transitions) until reaching `target`, ending at `endSlope`. */
    rampTo(target, slope, tIn, tOut, endSlope, markLip) {
      let dh1 = (this.slope + slope) * 0.5 * tIn;
      let dh3 = (slope + endSlope) * 0.5 * tOut;
      let a = (target - this.h - dh1 - dh3) / slope;
      if (a < 0) {
        const k = U.clamp((target - this.h) / (dh1 + dh3 || 1e-6), 0.05, 1);
        tIn *= k; tOut *= k; a = 0;
      }
      this.seg(tIn, slope).hold(a);
      if (markLip) this.lips.push({ u: this.u, slope });
      this.seg(tOut, endSlope);
      return this;
    }
    heightAt(u) {
      const segs = this.segs;
      if (u <= 0) return 0;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (u <= s.u0 + s.len) {
          const v = u - s.u0;
          return s.h0 + s.s0 * v + (s.s1 - s.s0) * v * v / (2 * s.len);
        }
      }
      return this.h;
    }
  }

  function featureShape(type) {
    const d = Cat.features[type];
    if (!d) return null;
    const out = { kind: d.kind, len: d.len || 0, lips: [], noLip: false, fn: null, bermH: 0 };
    if (d.kind === 'table') {
      const sf = U.clamp(0.4 + d.H * 0.065, 0.44, 0.62);
      const p = new Prof();
      p.rampTo(d.H, sf, 1.4, 0.35, 0, true).hold(d.top).rampTo(0, -sf, 1.4, 2.4, 0);
      out.len = p.u; out.lips = p.lips; out.fn = (u) => p.heightAt(u);
    } else if (d.kind === 'double') {
      const sf = U.clamp(0.45 + d.H * 0.05, 0.48, 0.62);
      const p = new Prof();
      p.rampTo(d.H, sf, 1.4, 0.45, -0.95, true).rampTo(0.05, -0.95, 0, 0.8, 0).hold(d.gap)
        .rampTo(d.H * 0.97, 1.0, 0.6, 0.9, 0).rampTo(0, -0.56, 1.2, 2.6, 0);
      out.len = p.u; out.lips = p.lips; out.fn = (u) => p.heightAt(u);
    } else if (d.kind === 'triple') {
      const sf = 0.6;
      const p = new Prof();
      p.rampTo(d.H, sf, 1.4, 0.45, -0.95, true).rampTo(0.05, -0.95, 0, 0.8, 0).hold(d.gap)
        .rampTo(d.H * 0.78, 0.85, 0.6, 0.5, -0.85, true).rampTo(0.05, -0.85, 0, 0.8, 0).hold(d.gap2)
        .rampTo(d.H * 0.97, 1.0, 0.6, 0.9, 0).rampTo(0, -0.58, 1.2, 2.8, 0);
      out.len = p.u; out.lips = p.lips; out.fn = (u) => p.heightAt(u);
    } else if (d.kind === 'stepup') {
      const p = new Prof();
      const h1 = d.H * 0.5;
      p.rampTo(h1, 0.62, 1.2, 0.3, 0, true).rampTo(Math.max(0.1, h1 - 0.55), -0.8, 0.35, 0.35, 0).hold(1.6)
        .rampTo(d.H, 1.15, 0.4, 0.6, 0).hold(d.top).rampTo(0, -0.3, 1.6, 1.8, 0);
      out.len = p.u; out.lips = p.lips; out.fn = (u) => p.heightAt(u);
    } else if (d.kind === 'bumps') {
      const L = d.n * d.pitch;
      out.len = L;
      out.fn = (u) => (u <= 0 || u >= L) ? 0 : d.H * Math.pow(Math.sin(Math.PI * u / d.pitch), 2);
      out.noLip = true;   // ridden by pumping: speed limited by technique, no takeoffs
    } else if (d.kind === 'rhythm') {
      const p = new Prof();
      const hs = d.heights, sp = d.spacing;
      let startU = 0;
      for (let k = 0; k < hs.length; k++) {
        if (k > 0) {
          const target = startU + sp[k - 1];
          if (target > p.u) p.hold(target - p.u);
        }
        startU = p.u;
        p.rampTo(hs[k], 0.64, 0.5, 0.55, -0.64, k < hs.length - 1).rampTo(0.12, -0.64, 0, 0.5, 0);
      }
      out.len = p.u; out.lips = p.lips; out.fn = (u) => p.heightAt(u);
    } else if (d.kind === 'berm') {
      out.bermH = d.H;
      out.fn = null;
    } else {
      out.fn = null;
    }
    return out;
  }
  const shapeCache = {};
  function getShape(type) {
    if (!shapeCache[type]) shapeCache[type] = featureShape(type);
    return shapeCache[type];
  }

  /* ---------------- spline helpers ---------------- */
  function catmull(p0, p1, p2, p3, t, out) {
    const d01 = Math.max(1e-3, Math.sqrt(Math.hypot(p1.x - p0.x, p1.z - p0.z)));
    const d12 = Math.max(1e-3, Math.sqrt(Math.hypot(p2.x - p1.x, p2.z - p1.z)));
    const d23 = Math.max(1e-3, Math.sqrt(Math.hypot(p3.x - p2.x, p3.z - p2.z)));
    const t0 = 0, t1 = d01, t2 = t1 + d12, t3 = t2 + d23;
    const tt = t1 + (t2 - t1) * t;
    const lerpP = (a, b, ta, tb) => {
      const k = (tt - ta) / (tb - ta);
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
    };
    const A1 = lerpP(p0, p1, t0, t1), A2 = lerpP(p1, p2, t1, t2), A3 = lerpP(p2, p3, t2, t3);
    const B1 = lerpP(A1, A2, t0, t2), B2 = lerpP(A2, A3, t1, t3);
    const Cc = lerpP(B1, B2, t1, t2);
    out.x = Cc.x; out.z = Cc.z;
    return out;
  }

  /* ---------------- construction pieces ----------------
     A piece-built circuit starts at a lattice point (a tile corner) facing one of
     8 headings and chains pieces that always end on lattice points: straights,
     45 degree curves in three sizes (two make a quarter turn) and special straights
     that carry a jump or the finish line. Pieces may climb or drop; the loop closes
     when the last piece ends exactly on the start pose. */
  const LAT = C.TILE;
  const DIRV = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const unitLen = (h) => (h & 1 ? Math.SQRT2 : 1) * LAT;
  const KAPPA = 0.64;                          // cubic control length for a 45 degree arc
  const GRADE = [-0.2, -0.1, 0, 0.1, 0.2];     // by slope class -2..2
  const ELEV_MAX = 8;
  const START_LEN = 36, START_GATE = 15;       // gate 15 m into the start straight: grid behind it
  const SPECIAL_OFF = 1.5;                     // clearance between a special piece edge and its feature

  function specialUnits(type, h) {
    const sh = getShape(type);
    return Math.max(2, Math.ceil(((sh ? sh.len : 4) + 2 * SPECIAL_OFF) / unitLen(h) - 1e-6));
  }
  function pieceUnits(p, h) {
    if (p.t === 'start') return Math.ceil(START_LEN / unitLen(h) - 1e-6);
    if (p.t === 'special') return specialUnits(p.f, h);
    return p.n || 1;
  }
  function slopeDelta(p, len) {
    if (!p.slope || p.t === 'start' || p.t === 'special') return 0;
    const d = Math.round(GRADE[p.slope + 2] * len * 2) / 2;
    return d || Math.sign(p.slope) * 0.5;
  }
  function bez(b, t, out) {
    const u = 1 - t, a = u * u * u, c = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
    out = out || [0, 0];
    out[0] = a * b[0] + c * b[2] + d * b[4] + e * b[6];
    out[1] = a * b[1] + c * b[3] + d * b[5] + e * b[7];
    return out;
  }
  /* Geometry of piece p starting at lattice (x0, z0) with heading h0 and elevation e0. */
  function pieceGeom(p, x0, z0, h0, e0) {
    const v0 = DIRV[h0];
    const g = { x0, z0, h0, e0: e0 || 0, curve: p.t === 'curve' };
    if (g.curve) {
      const h1 = (h0 + p.dir + 8) % 8, v1 = DIRV[h1];
      g.h1 = h1; g.x1 = x0 + p.k * (v0[0] + v1[0]); g.z1 = z0 + p.k * (v0[1] + v1[1]);
      const a0 = h0 * Math.PI / 4, a1 = h1 * Math.PI / 4;
      const l0 = p.k * unitLen(h0) * KAPPA, l1 = p.k * unitLen(h1) * KAPPA;
      const ax = x0 * LAT, az = z0 * LAT, bx = g.x1 * LAT, bz = g.z1 * LAT;
      g.b = [ax, az, ax + Math.cos(a0) * l0, az + Math.sin(a0) * l0, bx - Math.cos(a1) * l1, bz - Math.sin(a1) * l1, bx, bz];
      let L = 0, px = ax, pz = az;
      const q = [0, 0];
      for (let k = 1; k <= 48; k++) { bez(g.b, k / 48, q); L += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }
      g.len = L;
    } else {
      const n = pieceUnits(p, h0);
      g.n = n; g.h1 = h0; g.x1 = x0 + n * v0[0]; g.z1 = z0 + n * v0[1];
      g.len = n * unitLen(h0);
    }
    g.e1 = g.e0 + slopeDelta(p, g.len);
    return g;
  }
  function piecePoint(g, t, out) {
    if (g.curve) return bez(g.b, t, out);
    out = out || [0, 0];
    out[0] = (g.x0 + (g.x1 - g.x0) * t) * LAT; out[1] = (g.z0 + (g.z1 - g.z0) * t) * LAT;
    return out;
  }
  function boxSmooth(arr, r, closed) {
    const n = arr.length, src = Float32Array.from(arr);
    for (let i = 0; i < n; i++) {
      let sum = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        let q = i + k;
        if (closed) q = U.mod(q, n); else if (q < 0 || q >= n) continue;
        sum += src[q]; c++;
      }
      arr[i] = sum / c;
    }
  }

  let TRACK_UID = 1;

  class Track {
    constructor(id, name) {
      this.id = id != null ? id : TRACK_UID++;
      if (this.id >= TRACK_UID) TRACK_UID = this.id + 1;
      this.name = name || ('Circuito ' + this.id);
      this.slot = 0;          // occupancy bit index
      this.nodes = [];        // free-node circuits (old saves): {x, z, w, surf, elev}
      this.pieces = null;     // piece-built circuits: [{t, n | k, dir, slope, bank, f, w, surf}]
      this.origin = null;     // lattice start pose {x, z, h}
      this.e0 = 0;            // elevation at the origin (construction probes start mid-air)
      this.endPose = null;    // lattice pose after the last piece
      this.closed = false;
      this.features = [];     // {uid, type, s, len, ax, az, side}
      this.nextFeatUid = 1;
      this.state = 'building';
      this.paid = 0;
      this.featPaid = 0;
      this.S = null;
      this.length = 0;
      this.tiles = [];
      this.issues = [];
      this.valid = false;
      this.stats = null;
      this.statsTested = false;
      this.wear = new Float32Array(1);
      this.moisture = 0;
      this.dust = 0;
      this.records = { best: 0, holder: '', day: 0 };
      this.totals = { laps: 0, crashes: 0, injuries: 0, riders: 0 };
      this.ver = 0;
      this.entry = null;
      this.crashMarks = [];
    }
    get bit() { return 1 << this.slot; }

    /* ---------- node editing ---------- */
    addNode(x, z, w, surf) {
      if (this.pieces && !this.pieces.length) this.pieces = null;   // scripted free-node circuits (title demo, tests)
      this.nodes.push({ x, z, w: w || 8, surf: surf || 'dirt', elev: 0 });
    }
    insertNode(idx, x, z) {
      const ref = this.nodes[Math.max(0, idx - 1)] || { w: 8, surf: 'dirt', elev: 0 };
      this.nodes.splice(idx, 0, { x, z, w: ref.w, surf: ref.surf, elev: ref.elev });
    }
    removeNode(idx) { if (idx >= 0 && idx < this.nodes.length) this.nodes.splice(idx, 1); }

    /* ---------- geometry ---------- */
    /* Dense centreline with per-point width, surface, elevation and segment index. */
    _lineNodes() {
      const nodes = this.nodes;
      if (nodes.length < 2) return null;
      const closed = this.closed && nodes.length >= 3;
      const nseg = closed ? nodes.length : nodes.length - 1;
      const getN = (i) => {
        if (closed) return nodes[U.mod(i, nodes.length)];
        if (i < 0) { const a = nodes[0], b = nodes[1]; return { x: 2 * a.x - b.x, z: 2 * a.z - b.z }; }
        if (i >= nodes.length) { const a = nodes[nodes.length - 1], b = nodes[nodes.length - 2]; return { x: 2 * a.x - b.x, z: 2 * a.z - b.z }; }
        return nodes[i];
      };
      const L = { px: [], pz: [], pw: [], ps: [], pe: [], pg: [], closed };
      const tmp = { x: 0, z: 0 };
      const push = (x, z, sg, t) => {
        const na = nodes[sg], nb = closed ? nodes[(sg + 1) % nodes.length] : nodes[Math.min(nodes.length - 1, sg + 1)];
        L.px.push(x); L.pz.push(z); L.pg.push(sg);
        L.pw.push(U.lerp(na.w, nb.w, t)); L.pe.push(U.lerp(na.elev, nb.elev, U.smoothstep(0, 1, t))); L.ps.push(SURF_IDX[na.surf] || 0);
      };
      for (let i = 0; i < nseg; i++) {
        const p0 = getN(i - 1), p1 = getN(i), p2 = getN(i + 1), p3 = getN(i + 2);
        const chord = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const m = Math.max(6, Math.ceil(chord / 0.35));
        for (let k = 0; k < m; k++) { const t = k / m; catmull(p0, p1, p2, p3, t, tmp); push(tmp.x, tmp.z, i, t); }
      }
      if (!closed) { const last = nodes[nodes.length - 1]; push(last.x, last.z, nseg - 1, 1); }
      return L;
    }
    _linePieces() {
      const P = this.pieces;
      if (!this.origin || !P.length) { this.endPose = null; return null; }
      let x = this.origin.x, z = this.origin.z, h = this.origin.h, e = this.e0 || 0, s = 0;
      const L = { px: [], pz: [], pw: [], ps: [], pe: [], pg: [], closed: this.closed };
      const q = [0, 0];
      P.forEach((p, i) => {
        const g = pieceGeom(p, x, z, h, e);
        p._g = g; p._s0 = s;
        const m = Math.max(4, Math.ceil(g.len / 0.25));
        const si = SURF_IDX[p.surf] || 0;
        for (let k = 0; k < m; k++) {
          const t = k / m;
          piecePoint(g, t, q);
          L.px.push(q[0]); L.pz.push(q[1]); L.pw.push(p.w || 8); L.ps.push(si); L.pe.push(g.e0 + (g.e1 - g.e0) * t); L.pg.push(i);
        }
        s += g.len; x = g.x1; z = g.z1; h = g.h1; e = g.e1;
      });
      this.endPose = { x, z, h, e, s };
      if (!this.closed) {
        const lp = P[P.length - 1];
        L.px.push(x * LAT); L.pz.push(z * LAT); L.pw.push(lp.w || 8); L.ps.push(SURF_IDX[lp.surf] || 0); L.pe.push(e); L.pg.push(P.length - 1);
      }
      this._syncPieceFeatures();
      return L;
    }
    /* Pinned features follow their piece; banked curves turn into berms. */
    _syncPieceFeatures() {
      const P = this.pieces;
      for (const f of this.features) if (f.pin != null && P[f.pin]) f.s = P[f.pin]._s0 + (f.off || 0);
      const keep = this.features.filter(f => f.auto !== 'bank');
      const old = this.features.filter(f => f.auto === 'bank');
      const runs = [];
      let cur = null;
      P.forEach((p, i) => {
        const b = p.t === 'curve' ? (p.bank || 0) : 0;
        if (b && cur && cur.dir === p.dir && cur.bank === b && cur.len + p._g.len <= 62) { cur.len += p._g.len; return; }
        if (cur) runs.push(cur);
        cur = b ? { s0: p._s0, len: p._g.len, dir: p.dir, bank: b, pin: i } : null;
      });
      if (cur) runs.push(cur);
      for (const r of runs) {
        const type = r.bank === 2 ? 'berm_big' : 'berm';
        const f = old.find(o => o.pin === r.pin && o.type === type) || { uid: this.nextFeatUid++, type, auto: 'bank', pin: r.pin, ax: 0, az: 0, side: 0 };
        f.off = SPECIAL_OFF; f.s = r.s0 + SPECIAL_OFF; f.len = Math.max(4, r.len - 2 * SPECIAL_OFF); f.side = 0;
        keep.push(f);
      }
      this.features = keep;
    }

    /* ---------- geometry ---------- */
    /* Rebuild sampled geometry. `world` gives terrain heights; occupancy is not touched here. */
    rebuild(world) {
      this.ver++;
      const line = this.pieces ? this._linePieces() : this._lineNodes();
      if (!line || line.px.length < 2) { this.S = null; this.length = 0; return; }
      const closed = line.closed;
      const px = line.px, pz = line.pz, cum = [0];
      const np = px.length;
      for (let i = 1; i < np; i++) cum.push(cum[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]));
      let total = cum[np - 1];
      if (closed) total += Math.hypot(px[0] - px[np - 1], pz[0] - pz[np - 1]);
      const n = Math.max(2, Math.floor(total / DS));
      this.length = closed ? n * DS : (n - 1) * DS;
      const S = {
        n, L: this.length, closed,
        x: new Float32Array(n), z: new Float32Array(n), hdg: new Float32Array(n), curv: new Float32Array(n),
        w: new Float32Array(n), surf: new Uint8Array(n), seg: new Uint16Array(n), elev: new Float32Array(n),
        base: new Float32Array(n), prof: new Float32Array(n), y: new Float32Array(n), yRide: new Float32Array(n),
        slope: new Float32Array(n), berm: new Float32Array(n), bermSide: new Int8Array(n),
        feat: new Int16Array(n).fill(-1), noLip: new Uint8Array(n), vc0: new Float32Array(n),
        lipAt: new Int16Array(n).fill(-1), bad: new Uint8Array(n), terr: new Float32Array(n)
      };
      /* uniform resampling */
      let j = 0;
      for (let i = 0; i < n; i++) {
        const s = closed ? i * total / n : i * total / (n - 1);
        while (j < np - 1 && cum[j + 1] < s) j++;
        let a = j, b = j + 1, k = 0;
        if (j >= np - 1) {
          a = np - 1;
          if (closed) { b = 0; const segLen = total - cum[np - 1]; k = segLen > 1e-6 ? (s - cum[np - 1]) / segLen : 0; } else b = np - 1;
        } else {
          const segLen = cum[j + 1] - cum[j];
          k = segLen > 1e-6 ? (s - cum[j]) / segLen : 0;
        }
        S.x[i] = px[a] + (px[b] - px[a]) * k; S.z[i] = pz[a] + (pz[b] - pz[a]) * k;
        S.w[i] = line.pw[a] + (line.pw[b] - line.pw[a]) * k;
        S.elev[i] = line.pe[a] + (line.pe[b] - line.pe[a]) * k;
        S.surf[i] = line.ps[a]; S.seg[i] = line.pg[a];
      }
      if (this.pieces) { boxSmooth(S.w, Math.round(3 / DS), closed); boxSmooth(S.elev, Math.round(4 / DS), closed); }
      /* headings and curvature */
      const idx = (i) => closed ? U.mod(i, n) : U.clamp(i, 0, n - 1);
      for (let i = 0; i < n; i++) {
        const a = idx(i - 1), b = idx(i + 1);
        S.hdg[i] = Math.atan2(S.z[b] - S.z[a], S.x[b] - S.x[a]);
      }
      const rawK = new Float32Array(n);
      const kk = 3;
      for (let i = 0; i < n; i++) {
        const a = idx(i - kk), b = idx(i + kk);
        const span = (closed ? 2 * kk : (b - a)) * DS;
        rawK[i] = span > 0 ? U.wrapAngle(S.hdg[b] - S.hdg[a]) / span : 0;
      }
      const win = 4;
      for (let i = 0; i < n; i++) {
        let sum = 0, c = 0;
        for (let k = -win; k <= win; k++) {
          const q = i + k;
          if (!closed && (q < 0 || q >= n)) continue;
          sum += rawK[idx(q)]; c++;
        }
        S.curv[i] = sum / c;
        S.vc0[i] = Math.sqrt(C.G / Math.max(Math.abs(S.curv[i]), 1e-4));
      }
      /* terrain-based base height: max across width, smoothed */
      const tmax = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const nx = -Math.sin(S.hdg[i]), nz = Math.cos(S.hdg[i]);
        const hw = S.w[i] * 0.5;
        let m = world.heightAt(S.x[i], S.z[i]);
        S.terr[i] = m;
        for (const f of [-1, -0.5, 0.5, 1]) {
          const h = world.heightAt(S.x[i] + nx * hw * f, S.z[i] + nz * hw * f);
          if (h > m) m = h;
        }
        tmax[i] = m;
      }
      const mx = new Float32Array(n);
      const r1 = Math.round(2 / DS);
      for (let i = 0; i < n; i++) {
        let m = -Infinity;
        for (let k = -r1; k <= r1; k++) { const q = i + k; if (!closed && (q < 0 || q >= n)) continue; const v = tmax[idx(q)]; if (v > m) m = v; }
        mx[i] = m;
      }
      const r2 = Math.round(5 / DS);
      for (let i = 0; i < n; i++) {
        let sum = 0, c = 0;
        for (let k = -r2; k <= r2; k++) { const q = i + k; if (!closed && (q < 0 || q >= n)) continue; sum += mx[idx(q)]; c++; }
        S.base[i] = Math.max(sum / c, tmax[i] - 0.06) + S.elev[i];
      }
      /* features */
      this._placeFeatureSamples(S);
      for (let i = 0; i < n; i++) S.y[i] = S.base[i] + S.prof[i] + THICK;
      /* ride line: light low-pass (suspension) */
      const r3 = 2;
      for (let i = 0; i < n; i++) {
        if (S.noLip[i]) {
          let sum = 0, c = 0;
          for (let k = -5; k <= 5; k++) { const q = i + k; if (!closed && (q < 0 || q >= n)) continue; sum += S.y[idx(q)]; c++; }
          S.yRide[i] = sum / c;
        } else {
          let sum = 0, c = 0;
          for (let k = -r3; k <= r3; k++) { const q = i + k; if (!closed && (q < 0 || q >= n)) continue; sum += S.y[idx(q)]; c++; }
          S.yRide[i] = Math.max(sum / c, S.y[i] - 0.05);
        }
      }
      for (let i = 0; i < n; i++) {
        const a = idx(i - 1), b = idx(i + 1);
        S.slope[i] = (S.y[b] - S.y[a]) / (2 * DS);
      }
      this.S = S;
      const fin = this.features.find(f => f.type === 'finish');
      this.finishS = fin && closed ? U.mod(fin.s + 1, this.length) : null;
      const st = this.features.find(f => f.type === 'start');
      this.startS = st && closed ? U.mod(st.s, this.length) : null;
      /* lips and jump tables */
      this._buildLips();
      this.wear = new Float32Array(Math.max(1, Math.ceil(this.length / 5)));
      this._computeEntry(world);
      if (this.pieces) for (const f of this.features) { const i = this.sIndex(f.s); f.ax = S.x[i]; f.az = S.z[i]; }
    }

    _placeFeatureSamples(S) {
      const n = S.n;
      for (let fi = 0; fi < this.features.length; fi++) {
        const f = this.features[fi];
        const sh = getShape(f.type);
        if (!sh) continue;
        const len = f.len || sh.len;
        const i0 = Math.round(f.s / DS);
        const cnt = Math.max(1, Math.round(len / DS));
        let ksum = 0;
        for (let k = 0; k <= cnt; k++) {
          const i = S.closed ? U.mod(i0 + k, n) : i0 + k;
          if (i < 0 || i >= n) continue;
          S.feat[i] = fi;
          const u = k * DS;
          if (sh.fn) S.prof[i] += sh.fn(u);
          if (sh.noLip) S.noLip[i] = 1;
          ksum += S.curv[i];
        }
        if (sh.kind === 'berm') {
          const side = f.side || (ksum > 0 ? -1 : 1);
          f.side = side;
          for (let k = 0; k <= cnt; k++) {
            const i = S.closed ? U.mod(i0 + k, n) : i0 + k;
            if (i < 0 || i >= n) continue;
            const u = k * DS;
            const ramp = U.smoothstep(0, 3, u) * U.smoothstep(0, 3, len - u);
            S.berm[i] = Math.max(S.berm[i], sh.bermH * ramp);
            S.bermSide[i] = side;
          }
        }
      }
    }

    /* Ballistic tables: for each lip, outcome of a takeoff at each speed. */
    _buildLips() {
      const S = this.S;
      this.lips = [];
      if (!S) return;
      S.lipAt.fill(-1);
      for (let fi = 0; fi < this.features.length; fi++) {
        const f = this.features[fi];
        const sh = getShape(f.type);
        if (!sh || !sh.lips.length) continue;
        for (const lp of sh.lips) {
          let s = f.s + lp.u;
          if (S.closed) s = U.mod(s, S.L);
          const i = Math.round(s / DS);
          if (i < 0 || i >= S.n) continue;
          const lip = { i, s: i * DS, slope: Math.max(0.15, S.slope[U.clamp(i - 2, 0, S.n - 1)]), feat: fi, type: f.type };
          lip.maxLand = (sh.len - lp.u) + 4;
          lip.table = this._jumpTable(lip);
          S.lipAt[i] = this.lips.length;
          this.lips.push(lip);
        }
      }
    }
    groundY(s) {
      const S = this.S;
      let f = s / DS;
      if (S.closed) f = U.mod(f, S.n);
      else f = U.clamp(f, 0, S.n - 1.001);
      const i = Math.floor(f), t = f - i;
      const j = S.closed ? (i + 1) % S.n : Math.min(S.n - 1, i + 1);
      return S.y[i] + (S.y[j] - S.y[i]) * t;
    }
    slopeAt(s) {
      const S = this.S;
      let i = Math.round(s / DS);
      i = S.closed ? U.mod(i, S.n) : U.clamp(i, 0, S.n - 1);
      return S.slope[i];
    }
    simulateFlight(s0, y0, v, vz0, out) {
      const g = C.G, dt = 1 / 120;
      let s = s0, y = y0, vz = vz0, t = 0;
      while (t < 5) {
        s += v * dt; y += vz * dt; vz -= g * dt; t += dt;
        const gy = this.groundY(s);
        if (t > 0.04 && y <= gy) {
          const sl = this.slopeAt(s);
          out.landS = s; out.air = t; out.impact = Math.abs((vz - v * sl) / Math.sqrt(1 + sl * sl));
          out.vzLand = vz; out.peak = Math.max(out.peak || 0, 0);
          return out;
        }
      }
      out.landS = s; out.air = t; out.impact = 99; out.vzLand = vz;
      return out;
    }
    _jumpTable(lip) {
      const y0 = this.S.y[lip.i];
      const res = [];
      const tmp = {};
      for (let v = 2; v <= 32.01; v += 0.25) {
        this.simulateFlight(lip.s, y0, v, v * lip.slope, tmp);
        let kind;
        const landD = tmp.landS - lip.s;
        if (tmp.air < 0.24) kind = 'hop';
        else if (landD > lip.maxLand) kind = 'over';
        else if (tmp.impact < Track.LAND_CLEAN) kind = 'clean';
        else if (tmp.impact < Track.LAND_HARD) kind = 'hard';
        else kind = 'crash';
        res.push({ v, kind, air: tmp.air, impact: tmp.impact, land: landD });
      }
      let vRollMax = 2;
      for (const r of res) { if (r.kind === 'hop' || r.kind === 'clean') vRollMax = r.v; else break; }
      const options = [];
      let cur = null;
      for (const r of res) {
        if (r.kind === 'clean' && r.air >= 0.4) {
          if (!cur) cur = { vMin: r.v, vMax: r.v, air: r.air, land: r.land, sumImp: r.impact, cnt: 1 };
          else { cur.vMax = r.v; cur.air = Math.max(cur.air, r.air); cur.land = r.land; cur.sumImp += r.impact; cur.cnt++; }
        } else if (cur) { options.push(cur); cur = null; }
      }
      if (cur) options.push(cur);
      for (let k = options.length - 1; k >= 0; k--) {
        const o = options[k];
        if (o.vMax - o.vMin < 0.24 || o.vMax < Track.GLUE_SPEED + 0.5) options.splice(k, 1);
      }
      for (const o of options) {
        const width = o.vMax - o.vMin + 0.25;
        const below = res.find(r => r.v >= o.vMin - 0.6 && r.v < o.vMin);
        const gapBelow = below && (below.kind === 'crash');
        o.mid = (o.vMin + o.vMax) / 2;
        o.req = U.clamp(Math.round(8 + o.air * 14 + 16 / (width + 1.2) + (gapBelow ? 18 : 0) + Math.max(0, o.mid - 10) * 1.2), 5, 100);
        o.gap = !!gapBelow;
      }
      options.sort((a, b) => b.air - a.air);
      const big = options.length ? options[0] : null;
      return { vRollMax, options, res, maxAir: big ? big.air : 0, req: big ? big.req : 0 };
    }

    _computeEntry(world) {
      const S = this.S;
      this.entry = null;
      if (!S) return;
      const st = this.features.find(f => f.type === 'start') || this.features.find(f => f.type === 'finish');
      let s = st ? st.s + (st.type === 'start' ? 2 : 0) : 0;
      let i = S.closed ? U.mod(Math.round(s / DS), S.n) : U.clamp(Math.round(s / DS), 0, S.n - 1);
      const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
      /* prefer the outer side of the loop (away from the centroid) so the entry is reachable */
      let mx = 0, mz = 0;
      for (let k = 0; k < S.n; k += 8) { mx += S.x[k]; mz += S.z[k]; }
      const cnt = Math.ceil(S.n / 8); mx /= cnt; mz /= cnt;
      const outer = ((S.x[i] + nx - mx) ** 2 + (S.z[i] + nz - mz) ** 2) > ((S.x[i] - nx - mx) ** 2 + (S.z[i] - nz - mz) ** 2) ? 1 : -1;
      let best = null;
      for (const side of [outer, -outer]) {
        for (const extra of [3.5, 5.5, 8]) {
          const off = S.w[i] * 0.5 + extra;
          const x = S.x[i] + nx * off * side, z = S.z[i] + nz * off * side;
          const tx = Math.floor(x / C.TILE), tz = Math.floor(z / C.TILE);
          if (!world.inBounds(tx, tz)) continue;
          const id = world.idx(tx, tz);
          if (world.bld[id] >= 0 || world.isWater(tx, tz) || (world.trackOcc[id] & ~this.bit)) continue;
          if (!best) best = { x, z, tx, tz, s: i * DS, side, i };
          break;
        }
        if (best) break;
      }
      this.entry = best;
    }

    /* ---------- queries ---------- */
    wrapS(s) { return this.S && this.S.closed ? U.mod(s, this.S.L) : U.clamp(s, 0, this.length); }
    sIndex(s) {
      const S = this.S;
      const i = Math.round(s / DS);
      return S.closed ? U.mod(i, S.n) : U.clamp(i, 0, S.n - 1);
    }
    /* Interpolated pose at distance s and lateral offset lane (positive = left normal). */
    poseAt(s, lane, out) {
      const S = this.S;
      let f = s / DS;
      if (S.closed) f = U.mod(f, S.n); else f = U.clamp(f, 0, S.n - 1.001);
      const i = Math.floor(f), t = f - i;
      const j = S.closed ? (i + 1) % S.n : Math.min(S.n - 1, i + 1);
      const hdg = U.angleLerp(S.hdg[i], S.hdg[j], t);
      const nx = -Math.sin(hdg), nz = Math.cos(hdg);
      out = out || {};
      out.x = S.x[i] + (S.x[j] - S.x[i]) * t + nx * lane;
      out.z = S.z[i] + (S.z[j] - S.z[i]) * t + nz * lane;
      out.hdg = hdg;
      out.y = S.y[i] + (S.y[j] - S.y[i]) * t + this.bankAt(i, lane);
      out.yRide = S.yRide[i] + (S.yRide[j] - S.yRide[i]) * t + this.bankAt(i, lane);
      out.i = i;
      return out;
    }
    bankAt(i, lane) {
      const S = this.S;
      const bh = S.berm[i];
      if (bh <= 0) return 0;
      const hw = S.w[i] * 0.5;
      const q = U.clamp((lane * S.bermSide[i] / hw + 1) * 0.5, 0, 1);
      return bh * q * q;
    }
    nearestS(x, z, hint, range) {
      const S = this.S;
      if (!S) return null;
      let best = Infinity, bi = 0;
      let i0 = 0, i1 = S.n;
      if (hint != null && range) {
        const c = Math.round(hint / DS), r = Math.round(range / DS);
        i0 = c - r; i1 = c + r;
      }
      for (let k = i0; k < i1; k += 1) {
        const i = S.closed ? U.mod(k, S.n) : U.clamp(k, 0, S.n - 1);
        const d = U.dist2(x, z, S.x[i], S.z[i]);
        if (d < best) { best = d; bi = i; }
      }
      const hdg = S.hdg[bi];
      const lane = (x - S.x[bi]) * -Math.sin(hdg) + (z - S.z[bi]) * Math.cos(hdg);
      return { s: bi * DS, i: bi, dist: Math.sqrt(best), lane };
    }

    /* ---------- features ---------- */
    featureLen(type, s) {
      const sh = getShape(type);
      if (!sh) return 0;
      if (sh.kind === 'berm') return this._bermRange(s) ? this._bermRange(s).len : 0;
      return sh.len;
    }
    _bermRange(s) {
      const S = this.S;
      if (!S) return null;
      const thr = 1 / 45;
      const ic = this.sIndex(s);
      if (Math.abs(S.curv[ic]) < thr) return null;
      const sign = Math.sign(S.curv[ic]);
      let a = 0, b = 0;
      const maxK = Math.round(32 / DS);
      while (a < maxK) { const i = this.sIndex((ic - a - 1) * DS); if (Math.abs(S.curv[i]) < thr * 0.8 || Math.sign(S.curv[i]) !== sign) break; a++; }
      while (b < maxK) { const i = this.sIndex((ic + b + 1) * DS); if (Math.abs(S.curv[i]) < thr * 0.8 || Math.sign(S.curv[i]) !== sign) break; b++; }
      const s0 = this.wrapS((ic - a) * DS - 3);
      const len = Math.min(64, (a + b) * DS + 6);
      return { s0, len, side: sign > 0 ? -1 : 1 };
    }
    /* Check a feature placement; returns {ok, reason, s0, len, side}. */
    checkFeature(type, s, ignoreUid, fixed) {
      const S = this.S;
      const d = Cat.features[type];
      if (!S || !this.closed) return { ok: false, reason: 'Cierra el trazado primero' };
      if (!d) return { ok: false, reason: 'Elemento desconocido' };
      let s0 = Math.round(s), len = fixed ? fixed.len : this.featureLen(type, s), side = 0;
      if (fixed) s0 = fixed.s;
      if (d.kind === 'berm') {
        if (fixed) {
          const mid = this.sIndex(fixed.s + fixed.len / 2);
          if (Math.abs(S.curv[mid]) < 1 / 70) return { ok: false, reason: 'El peralte ya no está en una curva', s0, len };
          side = fixed.side;
        } else {
          const r = this._bermRange(s);
          if (!r) return { ok: false, reason: 'El peralte va en una curva', s0, len: 0 };
          s0 = r.s0; len = r.len; side = r.side;
        }
      }
      if ((d.kind === 'start' || d.kind === 'finish') && this.features.some(f => f.type === type && f.uid !== ignoreUid))
        return { ok: false, reason: 'Solo puede haber una ' + (d.kind === 'start' ? 'parrilla' : 'meta'), s0, len };
      if (len > S.L * 0.4) return { ok: false, reason: 'El circuito es demasiado corto para este elemento', s0, len };
      /* curvature restrictions */
      const needStraight = d.kind !== 'berm' && d.kind !== 'finish' && !(fixed && fixed.pin != null);
      if (needStraight) {
        const lim = d.kind === 'start' ? 1 / 40 : (d.kind === 'bumps' ? 1 / 22 : 1 / 30);
        const from = d.kind === 'start' ? s0 - 6 : s0, to = d.kind === 'start' ? s0 + len + 22 : s0 + len;
        for (let q = from; q <= to; q += 1) {
          if (Math.abs(S.curv[this.sIndex(q)]) > lim)
            return { ok: false, reason: d.kind === 'start' ? 'La parrilla necesita una recta larga' : 'Este elemento debe ir en una recta', s0, len };
        }
      }
      /* overlap with other features */
      for (const f of this.features) {
        if (f.uid === ignoreUid) continue;
        const flen = f.len || this.featureLen(f.type, f.s);
        if (this._overlap(s0 - 1.5, len + 3, f.s, flen)) return { ok: false, reason: 'Se solapa con ' + Cat.features[f.type].name.toLowerCase(), s0, len };
      }
      return { ok: true, s0, len, side };
    }
    _overlap(a0, alen, b0, blen) {
      const L = this.S.L;
      const segs = (s0, l) => {
        s0 = U.mod(s0, L);
        if (s0 + l <= L) return [[s0, s0 + l]];
        return [[s0, L], [0, s0 + l - L]];
      };
      for (const [x0, x1] of segs(a0, alen)) for (const [y0, y1] of segs(b0, blen)) if (x0 < y1 && y0 < x1) return true;
      return false;
    }
    addFeature(type, s0, len, side) {
      const S = this.S;
      const i = this.sIndex(s0);
      const f = { uid: this.nextFeatUid++, type, s: this.wrapS(s0), len, ax: S.x[i], az: S.z[i], side: side || 0 };
      this.features.push(f);
      return f;
    }
    removeFeature(uid) {
      const k = this.features.findIndex(f => f.uid === uid);
      if (k >= 0) return this.features.splice(k, 1)[0];
      return null;
    }
    featureAt(s) {
      for (const f of this.features) {
        const flen = f.len || this.featureLen(f.type, f.s);
        if (this._overlap(s, 0.01, f.s, Math.max(flen, 3))) return f;
      }
      return null;
    }
    /* After node edits, keep features attached to their world anchors. */
    reanchorFeatures(world, oldLen) {
      if (!this.S) return;
      for (const f of this.features) {
        const hint = oldLen > 0 ? f.s * this.length / oldLen : f.s;
        const r = this.nearestS(f.ax, f.az, hint, Math.max(30, this.length * 0.25)) || this.nearestS(f.ax, f.az);
        if (r) f.s = r.s;
        if (Cat.features[f.type].kind === 'berm') {
          const br = this._bermRange(f.s + (f.len || 0) / 2);
          if (br) { f.s = br.s0; f.len = br.len; f.side = br.side; }
        }
      }
      this.rebuild(world);
      for (const f of this.features) { const i = this.sIndex(f.s); f.ax = this.S.x[i]; f.az = this.S.z[i]; }
    }

    /* ---------- piece construction ---------- */
    pinFeature(type, pin, off) {
      const sh = getShape(type);
      const f = { uid: this.nextFeatUid++, type, pin, off, s: off, len: sh ? sh.len : 0, ax: 0, az: 0, side: 0 };
      this.features.push(f);
      return f;
    }
    pieceIndexAt(s) {
      if (!this.pieces || !this.S) return -1;
      return this.S.seg[this.sIndex(s)];
    }
    /* Try the start straight at lattice (x, z) facing h without building it. */
    probeStart(world, x, z, h, w, surf) {
      const tmp = Track.probeTrack(x, z, h, 0, { t: 'start', slope: 0, bank: 0, w, surf }, this.slot);
      tmp.rebuild(world);
      const res = { ok: true, tmp, g: tmp.pieces[0]._g, cost: 0, reason: '' };
      const why = this._probeTiles(world, tmp);
      if (why) { res.ok = false; res.reason = why; }
      else if (!Track.roomBehind(world, x, z, h, w, this.bit)) res.warn = 'Deja sitio detrás: el circuito tiene que volver a la salida por ahí';
      res.cost = this._probeCost(world, tmp);
      return res;
    }
    /* Try the next piece without building it: geometry, cost and the first problem found. */
    probePiece(world, p) {
      if (!this.pieces || !this.origin || !this.pieces.length) return { ok: false, reason: 'Coloca primero la parrilla de salida' };
      if (this.closed) return { ok: false, reason: 'El circuito ya está cerrado' };
      if (!this.endPose) this.rebuild(world);
      const e = this.endPose;
      const tmp = Track.probeTrack(e.x, e.z, e.h, e.e, p, this.slot);
      tmp.rebuild(world);
      const g = tmp.pieces[0]._g;
      const res = { ok: true, tmp, g, closes: false, cost: 0, reason: '' };
      const fail = (r) => { res.ok = false; res.reason = r; res.cost = this._probeCost(world, tmp); return res; };
      if (g.e1 < -0.01) return fail('No se puede bajar más: la pista ya va a ras de suelo');
      if (g.e1 > ELEV_MAX + 0.01) return fail('Demasiado alto: máximo ' + ELEV_MAX + ' m sobre el terreno');
      if (this.length + g.len > C.MAX_TRACK_LEN) return fail('El circuito sería demasiado largo');
      const o = this.origin;
      if (g.x1 === o.x && g.z1 === o.z) {
        if (g.h1 !== o.h) return fail('Llegas a la salida en otra dirección');
        if (Math.abs(g.e1 - (this.e0 || 0)) > 0.01) return fail('Llegas a la salida a otra altura: baja al nivel de la parrilla');
        res.closes = true;
      }
      const why = this._probeTiles(world, tmp);
      if (why) return fail(why);
      if (this._probeOverlap(tmp, res.closes)) return fail('Choca con el propio circuito');
      res.cost = this._probeCost(world, tmp);
      return res;
    }
    _probeTiles(world, tmp) {
      const S = tmp.S;
      for (let i = 0; i < S.n; i += 2) {
        const tx = Math.floor(S.x[i] / C.TILE), tz = Math.floor(S.z[i] / C.TILE);
        if (!world.inBounds(tx, tz)) return 'Fuera del mapa';
      }
      tmp.computeFootprint(world);
      let r = null;
      for (const t of tmp.tiles) {
        const tx = t % world.N, tz = (t / world.N) | 0;
        if (world.owned[t] !== 1) return 'Fuera de tu terreno';
        if (r) continue;
        if (world.bld[t] >= 0) r = 'Hay un edificio en medio';
        else if (world.path[t]) r = 'Hay un camino o una carretera en medio';
        else if (world.isWater(tx, tz)) r = 'No se puede construir sobre el agua';
        else if (world.trackOcc[t] & ~this.bit) r = 'Choca con otro circuito';
      }
      return r;
    }
    _probeOverlap(tmp, closes) {
      const S = this.S, T2 = tmp.S;
      if (!S) return false;
      const L = this.length, Ln = tmp.length;
      for (let i = 0; i < T2.n; i += 2) {
        const sn = i * DS;
        for (let j = 0; j < S.n; j += 2) {
          const sj = j * DS;
          const minD = (T2.w[i] + S.w[j]) * 0.5 + 0.8;
          let arc = (L - sj) + sn;
          if (closes) arc = Math.min(arc, (Ln - sn) + sj);
          if (arc < minD * 2.2 + 4) continue;
          if (U.dist2(T2.x[i], T2.z[i], S.x[j], S.z[j]) < minD * minD) return true;
        }
      }
      return false;
    }
    _probeCost(world, tmp) {
      if (!tmp.tiles.length) tmp.computeFootprint(world);
      let trees = 0;
      for (const t of tmp.tiles) {
        if ((world.trackOcc[t] & this.bit) || world.owned[t] !== 1 || world.scen[t] < 0) continue;
        if (world.isTree(world.scenery.get(world.scen[t]))) trees++;
      }
      return Math.round(tmp.geometryCost() + tmp.featureCost() + trees * C.TREE_CLEAR_COST);
    }

    /* ---------- footprint, cost, validation ---------- */
    computeFootprint(world) {
      const S = this.S;
      const set = new Set();
      if (!S) { this.tiles = []; return this.tiles; }
      for (let i = 0; i < S.n; i += 2) {
        const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
        const hw = S.w[i] * 0.5;
        for (const side of [-1, 1]) {
          const ex = S.x[i] + nx * hw * side, ez = S.z[i] + nz * hw * side;
          const eh = S.y[i] + this.bankAt(i, hw * side) - world.heightAt(ex, ez);
          const ext = 0.9 + U.clamp(eh * 1.25, 0, 7);
          for (let o = 0; o <= hw + ext; o += 0.9) {
            const x = S.x[i] + nx * o * side, z = S.z[i] + nz * o * side;
            const tx = Math.floor(x / C.TILE), tz = Math.floor(z / C.TILE);
            if (tx >= 0 && tz >= 0 && tx < world.N && tz < world.N) set.add(tx + tz * world.N);
          }
        }
      }
      this.tiles = Array.from(set);
      return this.tiles;
    }
    applyOccupancy(world) {
      const bit = this.bit;
      for (let i = 0; i < world.trackOcc.length; i++) if (world.trackOcc[i] & bit) world.trackOcc[i] &= ~bit;
      for (const t of this.tiles) world.trackOcc[t] |= bit;
    }
    clearOccupancy(world) {
      const bit = this.bit;
      for (let i = 0; i < world.trackOcc.length; i++) if (world.trackOcc[i] & bit) world.trackOcc[i] &= ~bit;
    }
    geometryCost() {
      const S = this.S;
      if (!S) return 0;
      let c = 0;
      for (let i = 0; i < S.n; i++) {
        const sd = Cat.surfaces[Cat.surfaceOrder[S.surf[i]]];
        c += DS * sd.cost * (S.w[i] / 8) + DS * S.w[i] * Math.max(0, S.elev[i]) * 6;
      }
      return Math.round(c);
    }
    featureCost() {
      let c = 0;
      for (const f of this.features) c += Cat.features[f.type].cost;
      return c;
    }

    /* Returns list of {level:'error'|'warn', msg, x, z}. Facility checks are done by Game. */
    validate(world) {
      const issues = [];
      const S = this.S;
      const at = (i) => ({ x: S.x[i], z: S.z[i] });
      if (!S || !this.closed || (!this.pieces && this.nodes.length < 4)) {
        issues.push({ level: 'error', msg: this.pieces ? 'El circuito no está cerrado: sigue construyendo hasta volver a la salida.' : 'El trazado no está cerrado (mínimo 4 puntos).' });
        this.issues = issues; this.valid = false; return issues;
      }
      S.bad.fill(0);
      if (this.length < C.MIN_TRACK_LEN) issues.push({ level: 'error', msg: 'Demasiado corto: ' + Math.round(this.length) + ' m (mínimo ' + C.MIN_TRACK_LEN + ' m).' });
      if (this.length > C.MAX_TRACK_LEN) issues.push({ level: 'error', msg: 'Demasiado largo: máximo ' + C.MAX_TRACK_LEN + ' m.' });
      /* radius */
      let radiusBad = -1;
      for (let i = 0; i < S.n; i++) if (Math.abs(S.curv[i]) > 1 / C.MIN_RADIUS) { S.bad[i] = 1; if (radiusBad < 0) radiusBad = i; }
      if (radiusBad >= 0) issues.push(Object.assign({ level: 'error', msg: 'Hay una curva imposible (radio menor de ' + C.MIN_RADIUS + ' m).' }, at(radiusBad)));
      /* slope of the base (features excluded) */
      let slopeBad = -1;
      for (let i = 0; i < S.n; i++) {
        const a = this.sIndex((i - 2) * DS), b = this.sIndex((i + 2) * DS);
        const sl = (S.base[b] - S.base[a]) / (4 * DS);
        if (Math.abs(sl) > C.MAX_SLOPE) { S.bad[i] = 1; if (slopeBad < 0) slopeBad = i; }
      }
      if (slopeBad >= 0) issues.push(Object.assign({ level: 'error', msg: 'Pendiente excesiva en el trazado.' }, at(slopeBad)));
      /* self overlap via spatial hash */
      const cell = 4, grid = new Map();
      for (let i = 0; i < S.n; i += 2) {
        const k = Math.floor(S.x[i] / cell) + ',' + Math.floor(S.z[i] / cell);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
      let overlapAt = -1;
      for (let i = 0; i < S.n; i += 2) {
        const cx = Math.floor(S.x[i] / cell), cz = Math.floor(S.z[i] / cell);
        const reach = Math.ceil((S.w[i] + 2) / cell);
        for (let dz = -reach; dz <= reach && !S.bad[i]; dz++) for (let dx = -reach; dx <= reach; dx++) {
          const list = grid.get((cx + dx) + ',' + (cz + dz));
          if (!list) continue;
          for (const j of list) {
            let arc = Math.abs(i - j) * DS;
            if (S.closed) arc = Math.min(arc, S.L - arc);
            const minD = (S.w[i] + S.w[j]) * 0.5 + 0.8;
            if (arc < minD * 2.2 + 4) continue;
            if (U.dist2(S.x[i], S.z[i], S.x[j], S.z[j]) < minD * minD) { S.bad[i] = 1; S.bad[j] = 1; if (overlapAt < 0) overlapAt = i; break; }
          }
        }
      }
      if (overlapAt >= 0) issues.push(Object.assign({ level: 'error', msg: 'El trazado se cruza o se pisa consigo mismo.' }, at(overlapAt)));
      /* footprint conflicts */
      this.computeFootprint(world);
      let notOwned = null, blocked = null, water = null, otherTrack = null;
      for (const t of this.tiles) {
        const tx = t % world.N, tz = (t / world.N) | 0;
        const c = { x: (tx + 0.5) * C.TILE, z: (tz + 0.5) * C.TILE };
        if (world.owned[t] !== 1) { notOwned = notOwned || c; continue; }
        if (world.bld[t] >= 0 || world.path[t]) blocked = blocked || c;
        if (world.isWater(tx, tz)) water = water || c;
        if (world.trackOcc[t] & ~this.bit) otherTrack = otherTrack || c;
      }
      if (notOwned) issues.push(Object.assign({ level: 'error', msg: 'Parte del circuito está fuera de tu terreno.' }, notOwned));
      if (blocked) issues.push(Object.assign({ level: 'error', msg: 'El circuito pisa edificios o caminos.' }, blocked));
      if (water) issues.push(Object.assign({ level: 'error', msg: 'El circuito pasa por el agua.' }, water));
      if (otherTrack) issues.push(Object.assign({ level: 'error', msg: 'Se solapa con otro circuito.' }, otherTrack));
      /* features */
      const start = this.features.find(f => f.type === 'start');
      const finish = this.features.find(f => f.type === 'finish');
      if (!start) issues.push({ level: 'error', msg: 'Falta la parrilla de salida.' });
      if (!finish) issues.push({ level: 'error', msg: 'Falta la línea de meta.' });
      for (const f of this.features) {
        const r = this.checkFeature(f.type, f.s, f.uid, { s: f.s, len: f.len || this.featureLen(f.type, f.s), side: f.side, pin: f.pin });
        if (!r.ok) {
          const i = this.sIndex(f.s);
          issues.push(Object.assign({ level: 'error', msg: Cat.features[f.type].name + ': ' + r.reason.toLowerCase() + '.' }, at(i)));
          S.bad[i] = 1;
        }
      }
      if (!this.entry) issues.push({ level: 'error', msg: 'No hay sitio junto a la parrilla para la entrada de pilotos.' });
      const jumps = this.features.filter(f => Cat.features[f.type].group === 'jump').length;
      if (!jumps) issues.push({ level: 'warn', msg: 'Sin saltos: los pilotos se aburrirán.' });
      if (this.length < 400) issues.push({ level: 'warn', msg: 'Un circuito corto se satura con pocos pilotos.' });
      this.issues = issues;
      this.valid = !issues.some(i => i.level === 'error');
      return issues;
    }

    /* Surface share and simple descriptors used by the analyzer and UI. */
    describe() {
      const S = this.S;
      const d = { surf: [0, 0, 0, 0], avgW: 0, minW: 99, corners: 0, tight: 0, medium: 0, open: 0, straights: 0, longestStraight: 0, elevRange: 0, climb: 0, berms: 0 };
      if (!S) return d;
      let ymin = Infinity, ymax = -Infinity;
      for (let i = 0; i < S.n; i++) {
        d.surf[S.surf[i]] += 1 / S.n;
        d.avgW += S.w[i] / S.n; d.minW = Math.min(d.minW, S.w[i]);
        if (S.base[i] < ymin) ymin = S.base[i]; if (S.base[i] > ymax) ymax = S.base[i];
        if (i > 0 && S.base[i] > S.base[i - 1]) d.climb += S.base[i] - S.base[i - 1];
      }
      d.elevRange = ymax - ymin;
      /* corners: contiguous regions with |k| > 1/60 */
      let inC = false, peak = 0, straightRun = 0;
      for (let k = 0; k < S.n; k++) {
        const kk = Math.abs(S.curv[k]);
        if (kk > 1 / 60) {
          if (!inC) { inC = true; peak = 0; }
          peak = Math.max(peak, kk);
          if (straightRun * DS > 40) d.straights++;
          d.longestStraight = Math.max(d.longestStraight, straightRun * DS);
          straightRun = 0;
        } else {
          straightRun++;
          if (inC) {
            inC = false; d.corners++;
            const R = 1 / peak;
            if (R < 12) d.tight++; else if (R < 28) d.medium++; else d.open++;
          }
        }
      }
      d.longestStraight = Math.max(d.longestStraight, straightRun * DS);
      d.berms = this.features.filter(f => Cat.features[f.type].kind === 'berm').length;
      return d;
    }

    /* ---------- serialization ---------- */
    serialize() {
      return {
        id: this.id, name: this.name, slot: this.slot, closed: this.closed, state: this.state,
        nodes: this.nodes.map(n => [+n.x.toFixed(2), +n.z.toFixed(2), n.w, n.surf, n.elev]),
        pieces: this.pieces ? this.pieces.map(p => [p.t, p.t === 'curve' ? p.k : (p.n || 0), p.dir || 0, p.slope || 0, p.bank || 0, p.f || '', p.w, p.surf]) : null,
        origin: this.origin ? [this.origin.x, this.origin.z, this.origin.h] : null,
        features: this.features.map(f => [f.type, +f.s.toFixed(2), +(f.len || 0).toFixed(2), +f.ax.toFixed(2), +f.az.toFixed(2), f.side || 0, f.pin != null ? f.pin : -1, f.off || 0, f.auto || '']),
        paid: this.paid, featPaid: this.featPaid, records: this.records, totals: this.totals,
        moisture: this.moisture, statsTested: this.statsTested,
        wear: Array.from(this.wear, v => Math.round(v * 1000) / 1000)
      };
    }
    static deserialize(d, world) {
      const t = new Track(d.id, d.name);
      t.slot = d.slot; t.closed = d.closed; t.state = d.state;
      t.nodes = d.nodes.map(a => ({ x: a[0], z: a[1], w: a[2], surf: a[3], elev: a[4] || 0 }));
      if (d.pieces) {
        t.pieces = d.pieces.map(a => {
          const p = { t: a[0], slope: a[3] || 0, bank: a[4] || 0, w: a[6], surf: a[7] };
          if (a[0] === 'curve') { p.k = a[1]; p.dir = a[2]; } else if (a[0] === 'straight') p.n = a[1];
          if (a[5]) p.f = a[5];
          return p;
        });
        t.origin = d.origin ? { x: d.origin[0], z: d.origin[1], h: d.origin[2] } : null;
      }
      t.features = d.features.map(a => {
        const f = { uid: t.nextFeatUid++, type: a[0], s: a[1], len: a[2] || 0, ax: a[3], az: a[4], side: a[5] || 0 };
        if (a[6] != null && a[6] >= 0) { f.pin = a[6]; f.off = a[7] || 0; }
        if (a[8]) f.auto = a[8];
        return f;
      });
      t.paid = d.paid || 0; t.featPaid = d.featPaid || 0;
      t.records = d.records || t.records; t.totals = d.totals || t.totals;
      t.moisture = d.moisture || 0; t.statsTested = !!d.statsTested;
      t.rebuild(world);
      if (d.wear && d.wear.length === t.wear.length) t.wear.set(d.wear);
      t.computeFootprint(world);
      return t;
    }
  }

  /* A one-piece scratch track used to preview and check the next piece. */
  Track.probeTrack = function (x, z, h, e, p, slot) {
    const t = new Track(-1, 'tmp');
    t.slot = slot || 0;
    t.pieces = [Object.assign({}, p)];
    t.origin = { x, z, h }; t.e0 = e || 0;
    if (p.t === 'start') t.pinFeature('start', 0, START_GATE);
    else if (p.t === 'special') t.pinFeature(p.f, 0, SPECIAL_OFF);
    return t;
  };

  /* Shortest chain of pieces from the end of an open piece circuit back to its start
     pose (weighted A* on lattice poses). Obstacles and the existing track are
     rasterised to tiles first so each move costs a handful of lookups. */
  const PLAN_MOVES = [
    { t: 'straight', n: 1 }, { t: 'straight', n: 3 },
    { t: 'curve', k: 1, dir: -1 }, { t: 'curve', k: 1, dir: 1 },
    { t: 'curve', k: 2, dir: -1 }, { t: 'curve', k: 2, dir: 1 },
    { t: 'curve', k: 3, dir: -1 }, { t: 'curve', k: 3, dir: 1 }
  ];
  /* The loop must come back into the start from behind: is there room for it? */
  Track.roomBehind = function (world, x, z, h, w, bit) {
    const v = DIRV[h], len = 3 * unitLen(h), ux = v[0] / Math.hypot(v[0], v[1]), uz = v[1] / Math.hypot(v[0], v[1]);
    const nx = -uz, nz = ux, hw = w * 0.5 + 0.5, N = world.N, T = C.TILE;
    for (let d = 1; d <= len; d += 1.5) for (const o of [-hw, 0, hw]) {
      const px = x * LAT - ux * d + nx * o, pz = z * LAT - uz * d + nz * o;
      const tx = Math.floor(px / T), tz = Math.floor(pz / T);
      if (tx < 0 || tz < 0 || tx >= N || tz >= N) return false;
      const i = tx + tz * N;
      if (world.owned[i] !== 1 || world.bld[i] >= 0 || world.path[i] || (world.trackOcc[i] & ~bit) || world.isWater(tx, tz)) return false;
    }
    return true;
  };
  Track.planClosure = function (world, tr, w, surf) {
    const o = tr.origin, e = tr.endPose, S = tr.S;
    if (!o || !e || !S) return { ok: false, reason: 'Coloca primero la parrilla de salida' };
    if (!Track.roomBehind(world, o.x, o.z, o.h, w, tr.bit)) return { ok: false, reason: 'No hay sitio detrás de la parrilla para entrar en ella. Libera ese espacio o empieza el circuito más lejos del borde.' };
    const N = world.N, T = C.TILE;
    const hw = w * 0.5;
    /* static obstacles */
    const blocked = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      const tx = i % N, tz = (i / N) | 0;
      if (world.owned[i] !== 1 || world.bld[i] >= 0 || world.path[i] || (world.trackOcc[i] & ~tr.bit) || world.isWater(tx, tz)) blocked[i] = 1;
    }
    /* tiles too close to the existing track (the two joints are left free) */
    const near = new Uint8Array(N * N);
    const L = tr.length;
    for (let j = 0; j < S.n; j += 2) {
      const sj = j * DS;
      if (sj > L - 14 || sj < 14) continue;
      const R = (w + S.w[j]) * 0.5 + 0.8;
      const x0 = Math.max(0, Math.floor((S.x[j] - R) / T)), x1 = Math.min(N - 1, Math.floor((S.x[j] + R) / T));
      const z0 = Math.max(0, Math.floor((S.z[j] - R) / T)), z1 = Math.min(N - 1, Math.floor((S.z[j] + R) / T));
      for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
        const cx = (tx + 0.5) * T, cz = (tz + 0.5) * T;
        if ((cx - S.x[j]) ** 2 + (cz - S.z[j]) ** 2 < R * R) near[tx + tz * N] = 1;
      }
    }
    const q = [0, 0], q2 = [0, 0];
    const tileOk = (x, z, centre) => {
      const tx = Math.floor(x / T), tz = Math.floor(z / T);
      if (tx < 0 || tz < 0 || tx >= N || tz >= N) return false;
      const i = tx + tz * N;
      return !blocked[i] && !(centre && near[i]);
    };
    const free = (g) => {
      const m = Math.max(2, Math.ceil(g.len / 2));
      for (let k = 0; k <= m; k++) {
        const t = k / m;
        piecePoint(g, t, q);
        piecePoint(g, Math.min(1, t + 0.02), q2);
        let dx = q2[0] - q[0], dz = q2[1] - q[1];
        if (t >= 1) { piecePoint(g, 0.98, q2); dx = q[0] - q2[0]; dz = q[1] - q2[1]; }
        const dl = Math.hypot(dx, dz) || 1, nx = -dz / dl, nz = dx / dl;
        if (!tileOk(q[0], q[1], true)) return false;
        if (!tileOk(q[0] + nx * (hw + 0.5), q[1] + nz * (hw + 0.5), false)) return false;
        if (!tileOk(q[0] - nx * (hw + 0.5), q[1] - nz * (hw + 0.5), false)) return false;
      }
      return true;
    };
    const OFF = 4, SZ = N + 1 + 2 * OFF;
    const key = (x, z, h) => ((z + OFF) * SZ + (x + OFF)) * 8 + h;
    const inRange = (x, z) => x >= -OFF + 1 && z >= -OFF + 1 && x < SZ - OFF - 1 && z < SZ - OFF - 1;
    const goal = key(o.x, o.z, o.h);
    const hEst = (x, z) => Math.hypot(x - o.x, z - o.z) * LAT * 1.15;
    const gScore = new Map(), came = new Map();
    const heap = [];
    const push = (f, item) => {
      heap.push([f, item]);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top[1];
    };
    const k0 = key(e.x, e.z, e.h);
    gScore.set(k0, 0);
    push(hEst(e.x, e.z), { k: k0, x: e.x, z: e.z, h: e.h, g: 0 });
    let found = null, expansions = 0;
    while (heap.length && expansions < 90000) {
      const cur = pop();
      if (cur.g > gScore.get(cur.k)) continue;
      if (cur.k === goal && cur.g > 0) { found = cur; break; }
      expansions++;
      for (let mi = 0; mi < PLAN_MOVES.length; mi++) {
        const mv = PLAN_MOVES[mi];
        const gg = pieceGeom(mv, cur.x, cur.z, cur.h, 0);
        if (!inRange(gg.x1, gg.z1)) continue;
        const nk = key(gg.x1, gg.z1, gg.h1);
        const cost = cur.g + gg.len + (mv.t === 'curve' ? 1.5 : 0);
        const old = gScore.get(nk);
        if (old != null && cost >= old) continue;
        if (!free(gg)) continue;
        gScore.set(nk, cost); came.set(nk, [cur.k, mi, cur]);
        push(cost + hEst(gg.x1, gg.z1), { k: nk, x: gg.x1, z: gg.z1, h: gg.h1, g: cost });
      }
    }
    if (!found) return { ok: false, reason: 'No encuentro un camino libre hasta la salida. Acércate un poco más o deja más espacio.' };
    const moves = [];
    let k = found.k;
    while (k !== k0) { const c = came.get(k); moves.push(c[1]); k = c[0]; }
    moves.reverse();
    const pieces = moves.map(mi => Object.assign({ slope: 0, bank: 0, w, surf }, PLAN_MOVES[mi]));
    /* drop back to the start height along the way: gentle drops first, then steeper */
    let left = Math.round(((e.e || 0) - (tr.e0 || 0)) * 2) / 2;
    if (left > 0) {
      const lens = [];
      let x = e.x, z = e.z, h = e.h;
      for (const p of pieces) { const g = pieceGeom(p, x, z, h, 0); lens.push(g.len); x = g.x1; z = g.z1; h = g.h1; }
      const drop = (p, sl, len) => -slopeDelta({ t: p.t, slope: sl }, len);
      pieces.forEach((p, i) => { const d = drop(p, -1, lens[i]); if (left >= d - 1e-6) { p.slope = -1; left -= d; } });
      pieces.forEach((p, i) => {
        if (left <= 1e-6 || p.slope !== -1) return;
        const extra = drop(p, -2, lens[i]) - drop(p, -1, lens[i]);
        if (left >= extra - 1e-6) { p.slope = -2; left -= extra; }
      });
      if (left > 1e-6) return { ok: false, reason: 'La pista va demasiado alta para cerrar desde aquí: baja primero un poco' };
    }
    return { ok: true, pieces };
  };

  Track.LAND_CLEAN = 4.2;   // m/s of impact velocity normal to the landing surface
  Track.LAND_HARD = 7.0;
  Track.GLUE_SPEED = 5.5;   // riders can keep the bike planted over any lip below this speed
  Track.getShape = getShape;
  Track.pieceGeom = pieceGeom;
  Track.piecePoint = piecePoint;
  Track.pieceUnits = pieceUnits;
  Track.unitLen = unitLen;
  Track.DIRV = DIRV;
  Track.LAT = LAT;
  Track.ELEV_MAX = ELEV_MAX;
  Track.START_GATE = START_GATE;
  Track.SPECIAL_OFF = SPECIAL_OFF;
  Track.SURF_IDX = SURF_IDX;
  Track.THICK = THICK;
  MX.Track = Track;
})(window.MX);
