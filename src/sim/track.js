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
    } else if (d.kind === 'logs') {
      /* logs lying across the track: round bumps the size of a log */
      const L = d.n * d.pitch, R = d.H / 2;
      out.len = L;
      out.fn = (u) => {
        if (u <= 0 || u >= L) return 0;
        const k = Math.floor(u / d.pitch), c = (k + 0.5) * d.pitch, x = u - c;
        return Math.abs(x) < R ? R + Math.sqrt(R * R - x * x) : 0;
      };
      out.noLip = true;
    } else if (d.kind === 'rocks') {
      /* loose stones: irregular low bumps fading in and out */
      const L = d.len;
      out.len = L;
      out.fn = (u) => {
        if (u <= 0 || u >= L) return 0;
        const env = U.smoothstep(0, 1.5, u) * U.smoothstep(0, 1.5, L - u);
        return d.H * env * (0.55 * Math.abs(Math.sin(u * 2.1)) + 0.45 * Math.abs(Math.sin(u * 3.7 + 1)));
      };
      out.noLip = true;
    } else if (d.kind === 'water') {
      /* a dip that fills with water (drawn by the renderer) */
      const L = d.len;
      out.len = L;
      out.fn = (u) => (u <= 0 || u >= L) ? 0 : -d.depth * U.smoothstep(0, 2.2, u) * U.smoothstep(0, 2.2, L - u);
      out.noLip = true;
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
  const ELEV_MAX = 12;
  const START_LEN = 36, START_GATE = 15;       // gate 15 m into the start straight: grid behind it
  /* motocross start straight: as wide as the gate (m) for the disciplines that start
     from a gate; it runs at an angle beside the first straight and joins it */
  const CHUTE_W = { mx: 22, sx: 18, kids: 11 };
  /* minicross circuits use a shorter start straight (its length rides on the piece as sl) */
  const startLenFor = (type) => type === 'kids' ? 24 : START_LEN;
  const gateOff = (p) => Math.min(START_GATE, (p.sl || START_LEN) * 0.42);
  const SPECIAL_OFF = 1.5;                     // clearance between a special piece edge and its feature

  function specialUnits(type, h) {
    const sh = getShape(type);
    return Math.max(2, Math.ceil(((sh ? sh.len : 4) + 2 * SPECIAL_OFF) / unitLen(h) - 1e-6));
  }
  function pieceUnits(p, h) {
    if (p.t === 'start') return Math.ceil((p.sl || START_LEN) / unitLen(h) - 1e-6);
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

  /* ---------- crossings ----------
     A stretch of circuit may pass over another circuit, or over itself, if it runs at
     least CLEAR metres higher and crosses at a fair angle: the upper one becomes a bridge
     between walls and the lower one goes through underneath, as through a tunnel. */
  const CLEAR = 4.5, CROSS_ANGLE = Math.PI / 6, DECK = 0.8;
  /* jumps and rhythm sections throw riders into the air: not under a bridge */
  const AIR_KINDS = new Set(['table', 'double', 'triple', 'stepup', 'rhythm', 'bumps']);
  /* horizontal run of an embankment h metres high (steeper when tall) */
  const bankRun = (h) => h <= 3 ? Math.max(0.7, h * 1.15 + 0.45) : 3.9 + (h - 3) * 0.6;
  /* signed shortest difference between sample indices a and b on a path of n samples */
  const idxDiff = (a, b, n, closed) => { let d = a - b; if (closed) { d = U.mod(d, n); if (d > n / 2) d -= n; } return d; };

  /* Where path A meets path B (B === A: a circuit with itself). skip(i, j) leaves out the
     sample pairs that are meant to touch (a circuit's own joints). Each meeting:
     {ok, why: 'height' | 'angle', U, L: the upper and lower path, iu, il: their closest
      samples, u0..u1, l0..l1: sample offsets from them where the two overlap, x, z, ang,
      R: radius around (x, z) where their embankments may share ground} */
  function crossingsOf(A, B, skip, clear) {
    const SA = A.S, SB = B.S;
    if (!SA || !SB) return [];
    clear = clear || CLEAR;
    const cell = 6, grid = new Map();
    for (let j = 0; j < SB.n; j += 2) {
      const k = Math.floor(SB.x[j] / cell) * 4096 + Math.floor(SB.z[j] / cell);
      let l = grid.get(k);
      if (!l) grid.set(k, l = []);
      l.push(j);
    }
    const groups = [];
    for (let i = 0; i < SA.n; i += 2) {
      const cx = Math.floor(SA.x[i] / cell), cz = Math.floor(SA.z[i] / cell), reach = Math.ceil(((SA.w[i] + 14) * 0.5 + 0.8) / cell);
      for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
        const l = grid.get((cx + dx) * 4096 + cz + dz);
        if (!l) continue;
        for (const j of l) {
          if (skip && skip(i, j)) continue;
          const minD = (SA.w[i] + SB.w[j]) * 0.5 + 0.8, d2 = U.dist2(SA.x[i], SA.z[i], SB.x[j], SB.z[j]);
          if (d2 >= minD * minD) continue;
          /* pairs a few metres apart on both paths belong to the same meeting */
          let q = null, di = 0, dj = 0;
          for (const g of groups) {
            di = idxDiff(i, g.i, SA.n, SA.closed); dj = idxDiff(j, g.j, SB.n, SB.closed);
            if (di >= g.a0 - 12 && di <= g.a1 + 12 && dj >= g.b0 - 12 && dj <= g.b1 + 12) { q = g; break; }
          }
          if (!q) { groups.push(q = { i, j, a0: 0, a1: 0, b0: 0, b1: 0, dyMin: Infinity, dyMax: -Infinity, best: Infinity, ic: i, jc: j }); di = 0; dj = 0; }
          q.a0 = Math.min(q.a0, di); q.a1 = Math.max(q.a1, di); q.b0 = Math.min(q.b0, dj); q.b1 = Math.max(q.b1, dj);
          const dy = SA.y[i] - SB.y[j];
          q.dyMin = Math.min(q.dyMin, dy); q.dyMax = Math.max(q.dyMax, dy);
          if (d2 < q.best) { q.best = d2; q.ic = i; q.jc = j; }
        }
      }
    }
    /* a circuit with itself finds every meeting twice, once from each stretch: keep the
       one seen from the upper stretch (either one when they clash) */
    const keep = A !== B ? groups : groups.filter(q => q.dyMin >= clear || (q.dyMax > -clear && q.ic < q.jc));
    return keep.map((q) => {
      const aUp = q.dyMin >= clear, bUp = !aUp && q.dyMax <= -clear;
      let ang = Math.abs(U.wrapAngle(SA.hdg[q.ic] - SB.hdg[q.jc]));
      if (ang > Math.PI / 2) ang = Math.PI - ang;
      const why = !(aUp || bUp) ? 'height' : ang < CROSS_ANGLE ? 'angle' : '';
      const dic = idxDiff(q.ic, q.i, SA.n, SA.closed), djc = idxDiff(q.jc, q.j, SB.n, SB.closed);
      const ra = [q.a0 - dic, q.a1 - dic], rb = [q.b0 - djc, q.b1 - djc];
      const Up = bUp ? B : A, Lo = bUp ? A : B, iu = bUp ? q.jc : q.ic, il = bUp ? q.ic : q.jc;
      const ru = bUp ? rb : ra, rl = bUp ? ra : rb;
      const SU = Up.S, SL = Lo.S;
      const hU = Math.max(0, SU.y[iu] - SU.terr[iu]), hL = Math.max(0, SL.y[il] - SL.terr[il]);
      const R = (SU.w[iu] * 0.5 + bankRun(hU) + SL.w[il] * 0.5 + bankRun(hL) + 2) / Math.max(0.5, Math.sin(ang));
      return {
        ok: !why, why, U: Up, L: Lo, iu, il, u0: ru[0], u1: ru[1], l0: rl[0], l1: rl[1],
        x: (SA.x[q.ic] + SB.x[q.jc]) / 2, z: (SA.z[q.ic] + SB.z[q.jc]) / 2, ang, R, dy: bUp ? -q.dyMax : q.dyMin
      };
    });
  }
  /* the lower path's jump or rhythm section under (or flying into) a bridge, if any */
  function tunnelClash(c) {
    const L = c.L, Ln = L.length, a = (c.il + c.l0) * DS - 16, b = (c.il + c.l1) * DS + 3;
    for (const f of L.features) {
      const d = Cat.features[f.type];
      if (!d || !AIR_KINDS.has(d.kind)) continue;
      const fs = f.s, fe = f.s + (f.len || 0);
      for (const k of L.S && L.S.closed ? [-Ln, 0, Ln] : [0]) if (a < fe + k && fs + k < b) return f;
    }
    return null;
  }
  /* a circuit with itself: stretches close along the track are joined, not crossing */
  const selfSkip = (S) => (i, j) => {
    let arc = Math.abs(j - i) * DS;
    if (S.closed) arc = Math.min(arc, S.L - arc);
    return arc < ((S.w[i] + S.w[j]) * 0.5 + 0.8) * 2.2 + 4;
  };
  const XCACHE = new Map();
  /* valid crossings of a circuit with itself and with the others, cached by version */
  function crossingsFor(tr, tracks) {
    const out = [];
    if (!tr.S) return out;
    for (const o of tracks) {
      if (!o.S || o.isChute) continue;
      const a = tr.inst < o.inst ? tr : o, b = a === tr ? o : tr;
      const key = a.inst + ':' + a.ver + '|' + b.inst + ':' + b.ver;
      let list = XCACHE.get(key);
      if (!list) {
        list = a === b ? crossingsOf(a, a, selfSkip(a.S), CLEAR - 0.25) : crossingsOf(a, b, null, CLEAR - 0.25);
        if (XCACHE.size > 300) XCACHE.clear();
        XCACHE.set(key, list);
      }
      for (const c of list) if (c.ok) out.push(c);
    }
    return out;
  }

  let TRACK_UID = 1, INSTANCE = 0;

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
      this.chuteSide = 0;     // side of the start straight beside the first piece (1 right, -1 left as the riders see it, 0 none)
      this.chuteSet = false;  // chosen by the player (otherwise it moves to the outside of the first bend)
      this.chute = null;      // its geometry as an open scratch track (see _buildChute)
      this.endPose = null;    // lattice pose after the last piece
      this.closed = false;
      this.features = [];     // {uid, type, s, len, ax, az, side}
      this.nextFeatUid = 1;
      this.state = 'building';
      this.paid = 0;
      this.opened = false;    // ever opened to the public: from then on edits refund half
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
      this.type = 'mx';       // discipline: a key of Catalog.trackTypes
      this.inst = ++INSTANCE; // unique per object (ids repeat when a save is loaded again)
    }
    get bit() { return 1 << this.slot; }
    get typeDef() { return Cat.trackTypes[this.type] || Cat.trackTypes.mx; }

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
      if (!this.isChute) this._buildChute(world);
      this._computeEntry(world);
      if (this.pieces) for (const f of this.features) { const i = this.sIndex(f.s); f.ax = S.x[i]; f.az = S.z[i]; }
    }

    /* ---------- motocross start straight ----------
       Race riders line up at a gate as wide as the field, ride a start straight that
       comes in at an angle beside the first piece and join the circuit near its end;
       laps never come back through it. Frame: u along the first piece from the origin,
       v towards the start straight's side. */
    chuteFrame() {
      const W = CHUTE_W[this.type], p0 = this.pieces && this.pieces[0];
      if (!W || !this.chuteSide || !this.origin || !p0 || p0.t !== 'start') return null;
      const o = this.origin, d = DIRV[o.h], dl = Math.hypot(d[0], d[1]), dx = d[0] / dl, dz = d[1] / dl;
      const sl = p0.sl || START_LEN, w0 = p0.w || 8;
      /* gate behind the origin, level with the run-in to the start; a parallel stretch,
         then an S bend that narrows into the first piece two metres before its end */
      const uG = -Math.round(sl * 0.4), vg = w0 / 2 + 3.5 + W / 2, uP = -2, uM = sl - 2;
      return { ox: o.x * LAT, oz: o.z * LAT, dx, dz, nx: -dz * this.chuteSide, nz: dx * this.chuteSide, W, w0, sl, uG, vg, uP, uM };
    }
    _buildChute(world) {
      this.chute = null;
      const F = this.chuteFrame();
      if (!F || !this.S) return;
      const c = new Track(-1000 - Math.abs(this.id), 'Recta de salida');
      c.type = this.type; c.slot = this.slot; c.isChute = true; c.parent = this; c.frame = F;
      const surf = this.pieces[0].surf || 'dirt', e0 = this.e0 || 0;
      const world2 = (u, v) => [F.ox + F.dx * u + F.nx * v, F.oz + F.dz * u + F.nz * v];
      const k = (F.uM - F.uP) * 0.42;
      const P = [[F.uP, F.vg], [F.uP + k, F.vg], [F.uM - k, 0], [F.uM, 0]];
      const bez = (t) => {
        const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, cc = 3 * (1 - t) * t * t, d = t ** 3;
        return [a * P[0][0] + b * P[1][0] + cc * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + cc * P[2][1] + d * P[3][1]];
      };
      /* [u, v, narrowing 0..1]: pad behind the gate, the parallel stretch, the bend, and a
         few metres on the circuit so the riders arrive lined up with it */
      const pts = [];
      for (let u = F.uG - 7; u < F.uP; u += 3) pts.push([u, F.vg, 0]);
      for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(bez(t).concat([U.smoothstep(0.12, 0.9, t)])); }
      for (const ahead of [3, 6]) pts.push([F.uM + ahead, 0, 1]);
      for (const [u, v, q] of pts) {
        const [x, z] = world2(u, v);
        c.nodes.push({ x, z, w: U.lerp(F.W, F.w0, q), surf, elev: e0 });
      }
      c.closed = false;
      c.moisture = this.moisture;
      c.rebuild(world);
      if (!c.S) return;
      const near = (u, v) => { const [x, z] = world2(u, v); return c.nearestS(x, z); };
      c.gateS = near(F.uG, F.vg).s;
      c.mergeAt = near(F.uM, 0).s;
      c.joinS = F.uM;
      /* where it meets the circuit its surface ramps to the circuit's level, gentler the bigger the step */
      const CS = c.S, M = this.S, R = new Float32Array(CS.n);
      for (let j = 0; j < CS.n; j++) {
        const u = (CS.x[j] - F.ox) * F.dx + (CS.z[j] - F.oz) * F.dz;
        R[j] = U.clamp(Math.abs(M.y[this.sIndex(Math.max(0, u))] - CS.y[j]) * 4, 3, 10);
      }
      boxSmooth(R, Math.round(4 / DS), false);
      c.rampW = R;
      c.bankAt = chuteBank;
      this.chute = c;
      c.joinU = null;
      c.joinU = this.chuteJoinU();
      /* where the strip of ground between the two narrows below 2 m it is filled with dirt
         up to the circuit (a narrow ditch between two embankments looks like a hole) */
      c.fillS = c.mergeAt; c.fillU = F.uM;
      for (let j = c.sIndex(c.gateS); j < CS.n; j++) {
        const hdg = CS.hdg[j], dv = Math.abs(-Math.sin(hdg) * F.nx + Math.cos(hdg) * F.nz);
        const vIn = this.chuteV(CS.x[j], CS.z[j]) - CS.w[j] * 0.5 * dv;
        if (vIn - F.w0 / 2 < 2) { c.fillS = j * DS; c.fillU = this.chuteU(CS.x[j], CS.z[j]); break; }
      }
    }
    /* lateral position (v) of a world point in the start straight's frame */
    chuteV(x, z) { const F = this.chute && this.chute.frame; return F ? (x - F.ox) * F.nx + (z - F.oz) * F.nz : 0; }
    chuteU(x, z) { const F = this.chute && this.chute.frame; return F ? (x - F.ox) * F.dx + (z - F.oz) * F.dz : 0; }
    /* where the start straight already overlaps the circuit, along the first piece */
    /* first sample of path T (i0..i1) that runs into the start straight, -1 if none;
       skip(i) leaves out the samples where the two are meant to meet */
    chuteClash(T, i0, i1, skip) {
      const c = this.chute;
      if (!c) return -1;
      const CS = c.S, joinU = this.chuteJoinU();
      for (let i = i0; i < i1; i += 2) {
        if (skip && skip(i)) continue;
        for (let j = 0; j < CS.n; j += 2) {
          if (this.chuteU(CS.x[j], CS.z[j]) > joinU) break;
          const minD = (T.w[i] + CS.w[j]) * 0.5 + 0.6;
          if (U.dist2(T.x[i], T.z[i], CS.x[j], CS.z[j]) < minD * minD) return i;
        }
      }
      return -1;
    }
    chuteJoinU() {
      const c = this.chute;
      if (!c) return null;
      if (c.joinU != null) return c.joinU;
      const F = c.frame, S = c.S;
      for (let i = 0; i < S.n; i++) {
        const v = this.chuteV(S.x[i], S.z[i]), hdg = S.hdg[i];
        const inner = v - S.w[i] * 0.5 * Math.abs(Math.cos(hdg - Math.atan2(F.dz, F.dx)));
        if (inner < F.w0 / 2 + 0.6) return this.chuteU(S.x[i], S.z[i]);
      }
      return F.uM;
    }

    /* where the edge markers leave an opening: around the start gate, and where the start
       straight meets the circuit (side 1 right, -1 left of the direction of travel) */
    edgeOpen(i, side) {
      const S = this.S, s = i * DS;
      if (this.isChute) {
        if (Math.abs(s - this.gateS) < 1.2 || s > this.mergeAt) return true;
        /* the inner edge stops where the ground up to the circuit is filled */
        const hdg = S.hdg[i], hw = S.w[i] * 0.5, P = this.parent;
        const v = P.chuteV(S.x[i] - Math.sin(hdg) * hw * side, S.z[i] + Math.cos(hdg) * hw * side);
        return v < P.chuteV(S.x[i], S.z[i]) && (s >= this.fillS - 0.5 || v < this.frame.w0 / 2 + 1);
      }
      if (this.chute) {
        const u = S.closed && s > S.L / 2 ? s - S.L : s;
        return side === this.chuteSide && u > this.chute.fillU - 1.5 && u < this.chute.frame.uM - 0.5;
      }
      return S.feat[i] >= 0 && Cat.features[this.features[S.feat[i]].type].kind === 'start';
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

    /* Where practice riders come onto the track: beside the start, on the outside of the
       loop. entries keeps the alternatives (the outside first) for the game to pick one
       riders can reach from the paddock (see Game#rebuildFields). */
    _computeEntry(world) {
      const S = this.S;
      this.entry = null; this.entries = [];
      if (!S) return;
      const st = this.features.find(f => f.type === 'start') || this.features.find(f => f.type === 'finish');
      let s = st ? st.s + (st.type === 'start' ? 2 : 0) : 0;
      /* with a wide start straight beside the first piece, riders come in just after it joins */
      const c = this.chute;
      const spots = c && S.closed ? [0, 4, 8, 12, 16, 20, 26, 32, 40, 50].map(d => c.joinS + 10 + d) : [s, s + 8, s + 16, s + 24, s + 36];
      /* prefer the outer side of the loop (away from the centroid) so the entry is reachable */
      let mx = 0, mz = 0;
      for (let k = 0; k < S.n; k += 8) { mx += S.x[k]; mz += S.z[k]; }
      const cnt = Math.ceil(S.n / 8); mx /= cnt; mz /= cnt;
      const clearOfChute = (x, z) => {
        if (!c) return true;
        const CS = c.S;
        for (let j = 0; j < CS.n; j += 4) if (U.dist2(x, z, CS.x[j], CS.z[j]) < (CS.w[j] * 0.5 + 3) ** 2) return false;
        return true;
      };
      for (const inside of [false, true]) for (const s0 of spots) {
        const i = S.closed ? U.mod(Math.round(s0 / DS), S.n) : U.clamp(Math.round(s0 / DS), 0, S.n - 1);
        const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
        const outer = ((S.x[i] + nx - mx) ** 2 + (S.z[i] + nz - mz) ** 2) > ((S.x[i] - nx - mx) ** 2 + (S.z[i] - nz - mz) ** 2) ? 1 : -1;
        const side = inside ? -outer : outer;
        for (const extra of [3.5, 5.5, 8]) {
          const off = S.w[i] * 0.5 + extra;
          const x = S.x[i] + nx * off * side, z = S.z[i] + nz * off * side;
          const tx = Math.floor(x / C.TILE), tz = Math.floor(z / C.TILE);
          if (!world.inBounds(tx, tz)) continue;
          const id = world.idx(tx, tz);
          if (world.bld[id] >= 0 || world.isWater(tx, tz) || (world.trackOcc[id] & ~this.bit) || !clearOfChute(x, z)) continue;
          this.entries.push({ x, z, tx, tz, s: i * DS, side, i });
          break;
        }
      }
      this.entry = this.entries[0] || null;
    }

    /* ---------- queries ---------- */
    wrapS(s) { return this.S && this.S.closed ? U.mod(s, this.S.L) : U.clamp(s, 0, this.length); }
    sIndex(s) {
      const S = this.S;
      const i = Math.round(s / DS);
      return S.closed ? U.mod(i, S.n) : U.clamp(i, 0, S.n - 1);
    }
    /* steepest stretch of the riding base (jumps aside) between samples i0 and i1, measured
       like validate does: rise over 4 m */
    steepest(i0, i1) {
      const S = this.S;
      let worst = 0, at = -1;
      for (let i = Math.max(0, i0); i < Math.min(S.n, i1); i++) {
        const a = this.sIndex((i - 2) * DS), b = this.sIndex((i + 2) * DS);
        const sl = Math.abs(S.base[b] - S.base[a]) / (4 * DS);
        if (sl > worst) { worst = sl; at = i; }
      }
      return { slope: worst, i: at };
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
        const lim = d.kind === 'start' ? 1 / 40 : d.kind === 'water' || d.kind === 'rocks' ? 1 / 12 : (d.kind === 'bumps' || d.kind === 'logs' ? 1 / 22 : 1 / 30);
        const from = d.kind === 'start' ? s0 - 6 : s0, to = d.kind === 'start' ? s0 + len + 22 : s0 + len;
        for (let q = from; q <= to; q += 1) {
          if (Math.abs(S.curv[this.sIndex(q)]) > lim)
            return { ok: false, reason: d.kind === 'start' ? 'La parrilla necesita una recta larga' : 'Este elemento debe ir en una recta', s0, len };
        }
      }
      /* nothing that jumps under a bridge */
      if (AIR_KINDS.has(d.kind) && this.tunnels) for (const [a, b] of this.tunnels) if (this._overlap(s0, len, a, b - a)) return { ok: false, reason: 'Debajo de un puente no caben saltos ni secciones rítmicas', s0, len };
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
    /* side: where the start straight goes (1 right, -1 left, 0 none); without it the side that fits */
    probeStart(world, x, z, h, w, surf, side) {
      const sides = !CHUTE_W[this.type] ? [0] : side != null ? [side] : [1, -1];
      let res = null;
      for (const cs of sides) {
        const tmp = Track.probeTrack(x, z, h, 0, Track.startPiece(this.type, w, surf), this.slot, this.type, cs);
        tmp.rebuild(world);
        const r = { ok: true, tmp, g: tmp.pieces[0]._g, cost: 0, reason: '', chuteSide: cs };
        const why = this._probeTiles(world, tmp);
        if (why) { r.ok = false; r.reason = cs ? why + ' (contando la recta de salida)' : why; }
        else if (!Track.roomBehind(world, x, z, h, w, this.bit)) r.warn = 'Deja sitio detrás: el circuito tiene que volver a la salida por ahí';
        r.cost = this._probeCost(world, tmp);
        if (!res || (r.ok && !res.ok)) res = r;
        if (r.ok) break;
      }
      return res;
    }
    /* Try the next piece without building it: geometry, cost and the first problem found. */
    probePiece(world, p) {
      if (!this.pieces || !this.origin || !this.pieces.length) return { ok: false, reason: 'Coloca primero la parrilla de salida' };
      if (this.closed) return { ok: false, reason: 'El circuito ya está cerrado' };
      if (!this.endPose) this.rebuild(world);
      const e = this.endPose;
      const tmp = Track.probeTrack(e.x, e.z, e.h, e.e, p, this.slot, this.type);
      tmp.rebuild(world);
      const g = tmp.pieces[0]._g;
      const res = { ok: true, tmp, g, closes: false, cost: 0, reason: '' };
      const fail = (r) => { res.ok = false; res.reason = r; res.cost = this._probeCost(world, tmp); return res; };
      if (g.e1 < -0.01) return fail('No se puede bajar más: la pista ya va a ras de suelo');
      if (g.e1 > ELEV_MAX + 0.01) return fail('Demasiado alto: máximo ' + ELEV_MAX + ' m sobre el terreno');
      if (this.length + g.len > this.typeDef.len[1]) return fail('Demasiado largo para ' + this.typeDef.name.toLowerCase() + ': máximo ' + this.typeDef.len[1] + ' m');
      const o = this.origin;
      if (g.x1 === o.x && g.z1 === o.z) {
        if (g.h1 !== o.h) return fail('Llegas a la salida en otra dirección: pulsa «Cerrar» y lo uno yo');
        if (Math.abs(g.e1 - (this.e0 || 0)) > 0.01) {
          /* same footprint, re-sloped so it arrives level with the start */
          const fix = Track.fitHeight(p, e.h, e.e, this.e0 || 0, this.typeDef.slopes);
          if (!fix) return fail('Llegas a la salida a otra altura (' + U.fmt1(g.e1 - (this.e0 || 0)) + ' m): pulsa «Cerrar» y lo ajusto yo');
          res.fix = fix;
        }
        res.closes = true;
      }
      const why = this._probeTiles(world, tmp);
      if (why) return fail(why);
      const over = this._probeOverlap(tmp, res.closes);
      if (over) return fail(over);
      if (this.chuteClash(tmp.S, 0, tmp.S.n, res.closes ? (i) => i * DS > tmp.length - 8 : null) >= 0) return fail('Choca con la recta de salida: llévalo por el otro lado o cambia la salida de lado');
      /* the track follows the ground: on a hillside the piece adds its own grade to the hill's */
      const n = tmp.S.n, edge = Math.round(3 / DS), st = n > 2 * edge + 2 ? tmp.steepest(edge, n - edge) : { slope: 0 };
      if (st.slope > C.MAX_SLOPE) return fail('Demasiado empinado (' + Math.round(st.slope * 100) + ' %): prueba otra pendiente u otra dirección, o allana la ladera');
      res.cost = this._probeCost(world, tmp);
      res.cross = tmp.crossNote || null;
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
      const shared = [];
      /* the lake first: from above it is hard to tell whose land it lies on */
      for (const t of tmp.tiles) if (world.isWater(t % world.N, (t / world.N) | 0)) return 'No se puede construir sobre el agua (es el lago)';
      for (const t of tmp.tiles) {
        if (world.owned[t] !== 1) return 'Se sale de tu terreno (la línea roja y blanca)';
        if (r) continue;
        if (world.bld[t] >= 0) r = 'Hay un edificio en medio';
        else if (world.path[t] === MX.World.P.ROAD) r = 'Hay una carretera en medio';
        else if (world.path[t]) { const c = tmp.pathClash(world, t, (x, z) => world.pathSurfAt(t % world.N, (t / world.N) | 0, x, z)); if (c && c.reason) r = c.reason; }
        if (!r && (world.trackOcc[t] & ~this.bit)) shared.push(t);
      }
      if (r || !shared.length) return r;
      const x = this._crossOthers(world, tmp, shared, CLEAR);
      return x ? x.reason : null;
    }
    /* A footpath on tile t (its surface at surf(x, z)) against this circuit: under the
       deck with headroom, over it on a footbridge high enough with no jump under it, or
       beside it, where the embankment becomes a wall. {reason} | {over, s0, s1} | {under}
       | null when it only lies beside it. */
    pathClash(world, t, surf) {
      if (!this.S) return null;
      const N = world.N, tx = t % N, tz = (t / N) | 0, UNDER = MX.World.PATH_UNDER, OVER = MX.World.PATH_OVER;
      let under = false, over = false;
      const ss = [];
      for (const tr of this.chute && this.chute.S ? [this, this.chute] : [this]) {
        const TS = tr.S;
        for (const [x, z] of MX.World.pathProbePts(tx, tz)) {
          const h = tr.nearestS(x, z);
          if (!h) continue;
          const hw = TS.w[h.i] * 0.5;
          if (Math.abs(h.lane) > hw + 0.6) continue;
          const ty = TS.y[h.i] + tr.bankAt(h.i, U.clamp(h.lane, -hw, hw)), py = surf(x, z);
          if (ty - py >= UNDER) { under = true; continue; }
          if (py - ty >= OVER) {
            over = true;
            if (tr === this) { ss.push(h.s); if (this.airNear(h.s)) return { reason: 'Debajo de la pasarela no caben saltos ni secciones rítmicas: los pilotos chocarían con ella' }; }
            continue;
          }
          return { reason: py > ty ? 'Pasa demasiado bajo sobre el circuito: una pasarela tiene que ir ' + U.fmt1(OVER) + ' m por encima de la pista' : 'El circuito pasa demasiado bajo: para cruzarlo por debajo tiene que ir ' + U.fmt1(UNDER) + ' m por encima del camino' };
        }
      }
      if (under && over) return { reason: 'Cruza el circuito a dos alturas a la vez' };
      if (!over) return under ? { under: true } : null;
      /* where it spans the loop's join, count on from the end of the loop */
      const L = this.S.L;
      if (this.S.closed && ss.length && Math.max(...ss) - Math.min(...ss) > L / 2) for (let k = 0; k < ss.length; k++) if (ss[k] < L / 2) ss[k] += L;
      return { over: true, s0: ss.length ? Math.min(...ss) : 0, s1: ss.length ? Math.max(...ss) : 0 };
    }
    /* a jump or rhythm section takes riders into the air at s (or they fly into s)? */
    airNear(s) {
      const L = this.S ? this.S.L : this.length;
      for (const f of this.features) {
        const d = Cat.features[f.type];
        if (!d || !AIR_KINDS.has(d.kind)) continue;
        const fs = f.s, fe = f.s + (f.len || 0);
        for (const k of this.S && this.S.closed ? [-L, 0, L] : [0]) if (s - 16 < fe + k && fs + k < s + 3) return true;
      }
      return false;
    }
    /* Ground shared with other circuits (tiles) is fine only around a crossing over or
       under them; path is this circuit or a piece of it. The first problem {reason, t}. */
    _crossOthers(world, path, tiles, clear) {
      const list = world.trackList || [], cache = new Map();
      for (const t of tiles) {
        let bits = world.trackOcc[t] & ~this.bit;
        const x = (t % world.N + 0.5) * C.TILE, z = (((t / world.N) | 0) + 0.5) * C.TILE;
        /* a start straight has no bridges */
        if (path.isChute) return { reason: 'Choca con otro circuito', t };
        for (const o of list) {
          if (o === this || !(bits & o.bit)) continue;
          bits &= ~o.bit;
          if (!o.S) return { reason: 'Choca con otro circuito', t };
          if (!cache.has(o)) cache.set(o, crossingsOf(path, o, null, clear));
          const xs = cache.get(o);
          const bad = xs.find(c => !c.ok);
          if (bad) return { reason: bad.why === 'height' ? 'Choca con otro circuito: para cruzarlo por encima o por debajo hace falta ' + U.fmt1(CLEAR) + ' m de diferencia de altura' : 'Choca con otro circuito: crúzalo en ángulo, no en paralelo', t };
          if (xs.some(c => tunnelClash(c))) return { reason: 'Debajo del puente no caben saltos ni secciones rítmicas: los pilotos chocarían con él', t };
          if (!xs.some(c => U.dist2(x, z, c.x, c.z) < c.R * c.R)) return { reason: 'Choca con otro circuito', t };
          if (path !== this) for (const c of xs) path.crossNote = c.U === path ? 'over' : 'under';
        }
        if (bits) return { reason: 'Choca con otro circuito', t };
      }
      return null;
    }
    /* the next piece against the circuit so far: crossing over or under it is fine with
       enough height and angle, and nothing that jumps under a bridge (reason or null) */
    _probeOverlap(tmp, closes) {
      const S = this.S, T2 = tmp.S;
      if (!S) return null;
      const L = this.length, Ln = tmp.length;
      const skip = (i, j) => {
        const sn = i * DS, sj = j * DS, minD = (T2.w[i] + S.w[j]) * 0.5 + 0.8;
        let arc = (L - sj) + sn;
        if (closes) arc = Math.min(arc, (Ln - sn) + sj);
        return arc < minD * 2.2 + 4;
      };
      for (const c of crossingsOf(tmp, this, skip, CLEAR)) {
        if (c.why === 'height') return 'Choca con el propio circuito: para pasar por encima o por debajo hace falta ' + U.fmt1(CLEAR) + ' m de diferencia de altura';
        if (c.why) return 'Choca con el propio circuito: crúzalo en ángulo, no en paralelo';
        if (tunnelClash(c)) return 'Debajo del puente no caben saltos ni secciones rítmicas: los pilotos chocarían con él';
        tmp.crossNote = c.U === tmp ? 'over' : 'under';
      }
      return null;
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
      const add = (t) => {
        const S = t.S;
        for (let i = 0; i < S.n; i += 2) {
          const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
          const hw = S.w[i] * 0.5;
          for (const side of [-1, 1]) {
            const ex = S.x[i] + nx * hw * side, ez = S.z[i] + nz * hw * side;
            const eh = S.y[i] + t.bankAt(i, hw * side) - world.heightAt(ex, ez);
            /* as wide as ever for the heights old saves use, wider only for the new tall ones */
            const ext = Math.max(0.9 + U.clamp(eh * 1.25, 0, 7), 0.35 + bankRun(Math.max(0, eh)));
            for (let o = 0; o <= hw + ext; o += 0.9) {
              const x = S.x[i] + nx * o * side, z = S.z[i] + nz * o * side;
              const tx = Math.floor(x / C.TILE), tz = Math.floor(z / C.TILE);
              if (tx >= 0 && tz >= 0 && tx < world.N && tz < world.N) set.add(tx + tz * world.N);
            }
          }
        }
      };
      add(this);
      if (this.chute) add(this.chute);
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
      /* the start straight is flat graded dirt: half the price of shaped track */
      if (this.chute) c += this.chute.geometryCost() * 0.5;
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
      const td = this.typeDef;
      if (this.length < td.len[0]) issues.push({ level: 'error', msg: 'Demasiado corto para ' + td.name.toLowerCase() + ': ' + Math.round(this.length) + ' m (mínimo ' + td.len[0] + ' m).' });
      if (this.length > td.len[1]) issues.push({ level: 'error', msg: 'Demasiado largo para ' + td.name.toLowerCase() + ': máximo ' + td.len[1] + ' m.' });
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
      if (slopeBad >= 0) issues.push(Object.assign({ level: 'error', msg: 'Pendiente excesiva en el trazado: rodea la ladera, cambia la pendiente de esas piezas o allana el terreno.' }, at(slopeBad)));
      /* the circuit over itself: only as a bridge, high enough and at an angle */
      let overlapAt = -1, lowAt = -1;
      const crossings = [];
      for (const c of crossingsOf(this, this, selfSkip(S), CLEAR - 0.25)) {
        if (c.ok) { crossings.push(c); continue; }
        S.bad[c.iu] = 1; S.bad[c.il] = 1;
        if (c.why === 'height') { if (lowAt < 0) lowAt = c.iu; } else if (overlapAt < 0) overlapAt = c.iu;
      }
      if (overlapAt >= 0) issues.push(Object.assign({ level: 'error', msg: 'El trazado se pisa consigo mismo: si se cruza, que sea en ángulo.' }, at(overlapAt)));
      if (lowAt >= 0) issues.push(Object.assign({ level: 'error', msg: 'El trazado se cruza consigo mismo: para pasar por debajo, un tramo tiene que ir al menos ' + U.fmt1(CLEAR) + ' m más alto que el otro.' }, at(lowAt)));
      const chuteHit = this.chuteClash(S, 0, S.n, (j) => j * DS < this.chute.joinS + 12 || j * DS > S.L - 8);
      if (chuteHit >= 0) { S.bad[chuteHit] = 1; issues.push(Object.assign({ level: 'error', msg: 'El circuito pasa por la recta de salida: cambia la salida de lado o aleja el trazado de ella.' }, at(chuteHit))); }
      /* footprint conflicts */
      this.computeFootprint(world);
      let notOwned = null, blocked = null, water = null, otherTrack = null, pathLow = null;
      const shared = [], bridges = [];
      for (const t of this.tiles) {
        const tx = t % world.N, tz = (t / world.N) | 0;
        const c = { x: (tx + 0.5) * C.TILE, z: (tz + 0.5) * C.TILE };
        if (world.isWater(tx, tz)) water = water || c;
        if (world.owned[t] !== 1) { notOwned = notOwned || c; continue; }
        if (world.bld[t] >= 0 || world.path[t] === MX.World.P.ROAD) blocked = blocked || c;
        else if (world.path[t]) {
          /* footpaths go under the circuit with headroom or over it on a footbridge */
          const pc = this.pathClash(world, t, (x, z) => world.pathSurfAt(tx, tz, x, z));
          if (pc && pc.reason) pathLow = pathLow || Object.assign({ msg: pc.reason }, c);
          else if (pc && pc.over) bridges.push([pc.s0 - 16, pc.s1 + 3]);
        }
        if (world.trackOcc[t] & ~this.bit) shared.push(t);
      }
      const xo = shared.length ? this._crossOthers(world, this, shared, CLEAR - 0.25) : null;
      if (xo) otherTrack = { x: (xo.t % world.N + 0.5) * C.TILE, z: (((xo.t / world.N) | 0) + 0.5) * C.TILE, msg: xo.reason + '.' };
      for (const o of world.trackList || []) if (o !== this && o.bit !== this.bit && o.S && !o.isChute) for (const c of crossingsOf(this, o, null, CLEAR - 0.25)) if (c.ok) crossings.push(c);
      /* stretches under a bridge (and the run-up into it): no jumps there (see checkFeature) */
      this.tunnels = crossings.filter(c => c.L === this).map(c => [(c.il + c.l0) * DS - 16, (c.il + c.l1) * DS + 3]).concat(bridges);
      this.crossings = crossings.length;
      if (notOwned) issues.push(Object.assign({ level: 'error', msg: 'Parte del circuito está fuera de tu terreno.' }, notOwned));
      if (blocked) issues.push(Object.assign({ level: 'error', msg: 'El circuito pisa edificios o carreteras.' }, blocked));
      if (pathLow) issues.push({ level: 'error', msg: 'Un camino cruza el circuito: ' + pathLow.msg.charAt(0).toLowerCase() + pathLow.msg.slice(1) + '.', x: pathLow.x, z: pathLow.z });
      if (water) issues.push(Object.assign({ level: 'error', msg: 'El circuito pasa por el agua.' }, water));
      if (otherTrack) issues.push({ level: 'error', msg: otherTrack.msg.replace(/^Choca con otro circuito/, 'Se solapa con otro circuito'), x: otherTrack.x, z: otherTrack.z });
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
      if (td.jumps && !jumps) issues.push({ level: 'warn', msg: 'Sin saltos: los pilotos se aburrirán.' });
      if (this.type === 'enduro' && !this.features.some(f => Cat.features[f.type].group === 'natural')) issues.push({ level: 'warn', msg: 'Sin troncos, pedreras ni vadeos la especial resultará sosa.' });
      if (this.length < td.len[0] * 1.6) issues.push({ level: 'warn', msg: 'Un circuito corto se satura con pocos pilotos.' });
      this.issues = issues;
      this.valid = !issues.some(i => i.level === 'error');
      return issues;
    }

    /* Surface share and simple descriptors used by the analyzer and UI. */
    describe() {
      const S = this.S;
      const d = { surf: Cat.surfaceOrder.map(() => 0), avgW: 0, minW: 99, corners: 0, tight: 0, medium: 0, open: 0, straights: 0, longestStraight: 0, elevRange: 0, climb: 0, berms: 0 };
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
        id: this.id, name: this.name, slot: this.slot, closed: this.closed, state: this.state, type: this.type,
        nodes: this.nodes.map(n => [+n.x.toFixed(2), +n.z.toFixed(2), n.w, n.surf, n.elev]),
        pieces: this.pieces ? this.pieces.map(p => [p.t, p.t === 'curve' ? p.k : p.t === 'start' ? (p.sl || 0) : (p.n || 0), p.dir || 0, p.slope || 0, p.bank || 0, p.f || '', p.w, p.surf]) : null,
        origin: this.origin ? [this.origin.x, this.origin.z, this.origin.h] : null,
        features: this.features.map(f => [f.type, +f.s.toFixed(2), +(f.len || 0).toFixed(2), +f.ax.toFixed(2), +f.az.toFixed(2), f.side || 0, f.pin != null ? f.pin : -1, f.off || 0, f.auto || '']),
        paid: this.paid, featPaid: this.featPaid, op: this.opened ? 1 : 0, records: this.records, totals: this.totals,
        moisture: this.moisture, statsTested: this.statsTested, cs: this.chuteSide || 0, cf: this.chuteSet ? 1 : 0,
        wear: Array.from(this.wear, v => Math.round(v * 1000) / 1000)
      };
    }
    static deserialize(d, world) {
      const t = new Track(d.id, d.name);
      t.slot = d.slot; t.closed = d.closed; t.state = d.state;
      t.type = Cat.trackTypes[d.type] ? d.type : 'mx';
      t.nodes = d.nodes.map(a => ({ x: a[0], z: a[1], w: a[2], surf: a[3], elev: a[4] || 0 }));
      if (d.pieces) {
        t.pieces = d.pieces.map(a => {
          const p = { t: a[0], slope: a[3] || 0, bank: a[4] || 0, w: a[6], surf: a[7] };
          if (a[0] === 'curve') { p.k = a[1]; p.dir = a[2]; } else if (a[0] === 'straight') p.n = a[1]; else if (a[0] === 'start' && a[1]) p.sl = a[1];
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
      /* older saves: a circuit that is or was open (closed again) counts as opened */
      t.opened = d.op != null ? !!d.op : d.state === 'open' || d.state === 'closed';
      t.records = d.records || t.records; t.totals = d.totals || t.totals;
      t.moisture = d.moisture || 0; t.statsTested = !!d.statsTested;
      t.chuteSide = d.cs || 0; t.chuteSet = !!d.cf;
      t.rebuild(world);
      if (d.wear && d.wear.length === t.wear.length) t.wear.set(d.wear);
      t.computeFootprint(world);
      return t;
    }
  }

  /* surface height of a start straight across its width (as Track#bankAt): its own level,
     and the circuit's where the two meet */
  function chuteBank(i, lane) {
    const S = this.S, F = this.frame, P = this.parent;
    const hdg = S.hdg[i], x = S.x[i] - Math.sin(hdg) * lane, z = S.z[i] + Math.cos(hdg) * lane;
    const v = (x - F.ox) * F.nx + (z - F.oz) * F.nz;
    const k = 1 - U.smoothstep(F.w0 / 2, F.w0 / 2 + this.rampW[i], v);
    if (k <= 0) return 0;
    const u = (x - F.ox) * F.dx + (z - F.oz) * F.dz;
    return k * (P.S.y[P.sIndex(Math.max(0, u))] - S.y[i]);
  }

  /* A one-piece scratch track used to preview and check the next piece. */
  Track.probeTrack = function (x, z, h, e, p, slot, type, chuteSide) {
    const t = new Track(-1, 'tmp');
    t.slot = slot || 0;
    t.type = type || 'mx';
    t.chuteSide = chuteSide || 0;
    t.pieces = [Object.assign({}, p)];
    t.origin = { x, z, h }; t.e0 = e || 0;
    if (p.t === 'start') t.pinFeature('start', 0, gateOff(p));
    else if (p.t === 'special') t.pinFeature(p.f, 0, SPECIAL_OFF);
    return t;
  };

  /* Cheapest chain of pieces from the end of an open piece circuit (or from an earlier
     pose, when the last pieces are being replaced) back into the start pose at the
     start's height: weighted A* on lattice poses with the elevation in half metres,
     so drops and climbs are planned together with the turns. Obstacles and the kept
     part of the track are rasterised to tiles first. */
  const PLAN_MOVES = [
    { t: 'straight', n: 1 }, { t: 'straight', n: 2 }, { t: 'straight', n: 3 },
    { t: 'curve', k: 1, dir: -1 }, { t: 'curve', k: 1, dir: 1 },
    { t: 'curve', k: 2, dir: -1 }, { t: 'curve', k: 2, dir: 1 },
    { t: 'curve', k: 3, dir: -1 }, { t: 'curve', k: 3, dir: 1 }
  ];
  /* The loop must come back into the start from behind: is there room for it? */
  Track.roomBehind = function (world, x, z, h, w, bit) {
    const v = DIRV[h], len = 3 * unitLen(h), ux = v[0] / Math.hypot(v[0], v[1]), uz = v[1] / Math.hypot(v[0], v[1]);
    const nx = -uz, nz = ux, hw = w * 0.5 + 0.5, N = world.N, T = C.TILE;
    const dMax = len + hw + 0.25, ds = [];
    for (let d = 1; d < dMax; d += 1.5) ds.push(d);
    ds.push(dMax);
    for (const d of ds) for (const o of [-hw, 0, hw]) {
      const px = x * LAT - ux * d + nx * o, pz = z * LAT - uz * d + nz * o;
      const tx = Math.floor(px / T), tz = Math.floor(pz / T);
      if (tx < 0 || tz < 0 || tx >= N || tz >= N) return false;
      const i = tx + tz * N;
      if (world.owned[i] !== 1 || world.bld[i] >= 0 || world.path[i] || (world.trackOcc[i] & ~bit) || world.isWater(tx, tz)) return false;
    }
    return true;
  };
  /* opts.from: pose {x, z, h, e} to plan from (default: the end of the track);
     opts.cutS: arc length of the part of the track that stays (default: all of it) */
  Track.planClosure = function (world, tr, w, surf, opts) {
    opts = opts || {};
    const o = tr.origin, e = opts.from || tr.endPose, S = tr.S;
    if (!o || !e || !S) return { ok: false, fatal: true, reason: 'Coloca primero la parrilla de salida' };
    if (!Track.roomBehind(world, o.x, o.z, o.h, w, tr.bit)) return { ok: false, fatal: true, reason: 'No hay sitio detrás de la parrilla para entrar en ella. Libera ese espacio o empieza el circuito más lejos del borde.' };
    const N = world.N, T = C.TILE, hw = w * 0.5, td = tr.typeDef;
    const cutS = opts.cutS != null ? opts.cutS : tr.length;
    /* heights in half metres; the plan only moves towards the start's height */
    const E2 = (v) => Math.round(v * 2);
    const goalE = E2(tr.e0 || 0), EMAX = ELEV_MAX * 2, fromE = E2(e.e || 0);
    const down = td.slopes.filter(v => v < 0), up = td.slopes.filter(v => v > 0);
    const maxDown = down.length ? Math.max(...down.map(v => -GRADE[v + 2])) : 0, maxUp = up.length ? Math.max(...up.map(v => GRADE[v + 2])) : 0;
    if ((fromE > goalE && !down.length) || (fromE < goalE && !up.length)) return { ok: false, fatal: true, reason: 'Vas a otra altura que la salida y este tipo de circuito no tiene pendientes' };
    /* static obstacles */
    const blocked = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      const tx = i % N, tz = (i / N) | 0;
      if (world.owned[i] !== 1 || world.bld[i] >= 0 || world.path[i] || (world.trackOcc[i] & ~tr.bit) || world.isWater(tx, tz)) blocked[i] = 1;
    }
    /* the start straight (up to where it bends in) is in the way like a building */
    if (tr.chute) {
      const CS = tr.chute.S, joinU = tr.chuteJoinU();
      for (let j = 0; j < CS.n; j += 2) {
        if (tr.chuteU(CS.x[j], CS.z[j]) > joinU) break;
        const R = CS.w[j] * 0.5 + 0.2;
        const x0 = Math.max(0, Math.floor((CS.x[j] - R) / T)), x1 = Math.min(N - 1, Math.floor((CS.x[j] + R) / T));
        const z0 = Math.max(0, Math.floor((CS.z[j] - R) / T)), z1 = Math.min(N - 1, Math.floor((CS.z[j] + R) / T));
        for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
          const cx = (tx + 0.5) * T, cz = (tz + 0.5) * T;
          if ((cx - CS.x[j]) ** 2 + (cz - CS.z[j]) ** 2 < R * R) blocked[tx + tz * N] = 1;
        }
      }
    }
    /* tiles too close to the part of the track that stays (the two joints are left free) */
    const near = new Uint8Array(N * N);
    for (let j = 0; j < S.n; j += 2) {
      const sj = j * DS;
      if (sj > cutS - 14 || sj < 14) continue;
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
    /* how much the ground climbs and drops along a piece (the track follows it) */
    const hill = (g) => {
      const m = Math.max(2, Math.round(g.len / 3)), hs = [];
      for (let k = 0; k <= m; k++) {
        const t = k / m;
        piecePoint(g, t, q);
        piecePoint(g, t < 1 ? Math.min(1, t + 0.02) : 0.98, q2);
        let dx = q2[0] - q[0], dz = q2[1] - q[1];
        if (t >= 1) { dx = -dx; dz = -dz; }
        const dl = Math.hypot(dx, dz) || 1, nx = -dz / dl, nz = dx / dl;
        hs.push(Math.max(world.heightAt(q[0], q[1]), world.heightAt(q[0] + nx * hw, q[1] + nz * hw), world.heightAt(q[0] - nx * hw, q[1] - nz * hw)));
      }
      let up = 0, down = 0;
      const step = g.len / m;
      for (let k = 1; k < hs.length; k++) { const s = (hs[k] - hs[k - 1]) / step; if (s > up) up = s; if (s < down) down = s; }
      return { up, down };
    };
    const hills = new Map();
    const OFF = 4, SZ = N + 1 + 2 * OFF;
    const pose = (x, z, h) => ((z + OFF) * SZ + (x + OFF)) * 8 + h;
    const key = (x, z, h, eh) => pose(x, z, h) * (EMAX + 1) + eh;
    const inRange = (x, z) => x >= -OFF + 1 && z >= -OFF + 1 && x < SZ - OFF - 1 && z < SZ - OFF - 1;
    const goal = key(o.x, o.z, o.h, goalE);
    /* distance left, or the run needed to reach the start's height at the steepest grade */
    const hEst = (x, z, eh) => {
      const d = Math.hypot(x - o.x, z - o.z) * LAT * 1.12;
      if (eh === goalE) return d;
      return Math.max(d, Math.abs(eh - goalE) * 0.5 / (eh > goalE ? maxDown : maxUp));
    };
    const gScore = new Map(), came = new Map(), geo = new Map(), clear = new Map();
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
    const k0 = key(e.x, e.z, e.h, fromE);
    gScore.set(k0, 0);
    push(hEst(e.x, e.z, fromE), { k: k0, x: e.x, z: e.z, h: e.h, e: fromE, g: 0 });
    let found = null, expansions = 0;
    while (heap.length && expansions < 160000) {
      const cur = pop();
      if (cur.g > gScore.get(cur.k)) continue;
      if (cur.k === goal && cur.g > 0) { found = cur; break; }
      expansions++;
      const pk = pose(cur.x, cur.z, cur.h);
      const slopes = cur.e > goalE ? [0].concat(down) : cur.e < goalE ? [0].concat(up) : [0];
      for (let mi = 0; mi < PLAN_MOVES.length; mi++) {
        const mv = PLAN_MOVES[mi], ck = pk * 16 + mi;
        let gg = geo.get(ck);
        if (!gg) { gg = pieceGeom(mv, cur.x, cur.z, cur.h, 0); geo.set(ck, gg); }
        if (!inRange(gg.x1, gg.z1)) continue;
        let ok = clear.get(ck);
        if (ok === undefined) { ok = free(gg); clear.set(ck, ok); }
        if (!ok) continue;
        let hl = hills.get(ck);
        if (!hl) { hl = hill(gg); hills.set(ck, hl); }
        for (const sl of slopes) {
          const gr = sl ? slopeDelta({ t: mv.t, slope: sl }, gg.len) / gg.len : 0;
          if (hl.up + gr > C.MAX_SLOPE * 0.92 || hl.down + gr < -C.MAX_SLOPE * 0.92) continue;
          const ne = cur.e + (sl ? E2(slopeDelta({ t: mv.t, slope: sl }, gg.len)) : 0);
          if (ne < 0 || ne > EMAX || (cur.e > goalE && ne < goalE) || (cur.e < goalE && ne > goalE)) continue;
          const nk = key(gg.x1, gg.z1, gg.h1, ne);
          const cost = cur.g + gg.len + (mv.t === 'curve' ? 1.5 : 0) + Math.abs(sl) * 0.8 + (mv.t === 'straight' && mv.n < 3 ? 0.25 : 0);
          const old = gScore.get(nk);
          if (old != null && cost >= old) continue;
          gScore.set(nk, cost); came.set(nk, [cur.k, mi, sl]);
          push(cost + hEst(gg.x1, gg.z1, ne), { k: nk, x: gg.x1, z: gg.z1, h: gg.h1, e: ne, g: cost });
        }
      }
    }
    if (!found) {
      const high = Math.abs(fromE - goalE) >= 6;
      return { ok: false, reason: high ? 'No encuentro un camino libre hasta la salida que dé tiempo a volver a su altura (' + U.fmt1(Math.abs(fromE - goalE) / 2) + ' m). Deja más espacio o baja antes.' : 'No encuentro un camino libre hasta la salida. Deja más espacio entre el final y la parrilla.' };
    }
    const steps = [];
    let k = found.k;
    while (k !== k0) { const c = came.get(k); steps.push(c); k = c[0]; }
    steps.reverse();
    const pieces = [];
    for (const [, mi, sl] of steps) {
      const p = Object.assign({ slope: sl, bank: 0, w, surf }, PLAN_MOVES[mi]);
      /* level straights in a row become one piece */
      const prev = pieces[pieces.length - 1];
      if (p.t === 'straight' && !p.slope && prev && prev.t === 'straight' && !prev.slope && prev.n + p.n <= 6) prev.n += p.n;
      else pieces.push(p);
    }
    return { ok: true, pieces, length: found.g };
  };
  /* A piece that lands on the start pose at another height: the same footprint, sloped
     (or a straight cut into short pieces) so that it arrives level with the start.
     Returns the pieces to build instead, or null when it cannot be done. */
  Track.fitHeight = function (p, h, eFrom, eTo, slopes) {
    const want = Math.round((eTo - eFrom) * 2);
    if (!want) return [p];
    if (p.t === 'start' || p.t === 'special') return null;
    const dir = slopes.filter(v => Math.sign(v) === Math.sign(want)).sort((a, b) => Math.abs(a) - Math.abs(b));
    if (!dir.length) return null;
    const len = pieceGeom(Object.assign({}, p, { slope: 0 }), 0, 0, h, 0).len;
    for (const sl of dir) if (Math.round(slopeDelta({ t: p.t, slope: sl }, len) * 2) === want) return [Object.assign({}, p, { slope: sl })];
    if (p.t !== 'straight' || (p.n || 1) < 2) return null;
    /* cut the straight into single units: the sloped ones first, then level ground */
    const n = p.n || 1, ul = unitLen(h);
    const step = dir.map(sl => ({ sl, d: Math.round(slopeDelta({ t: 'straight', slope: sl }, ul) * 2) }));
    let best = null;
    const tryMix = (i, used, sum, list) => {
      if (sum === want) { const cost = list.reduce((a, v) => a + Math.abs(v), 0); if (!best || cost < best.cost || (cost === best.cost && list.length < best.list.length)) best = { cost, list: list.slice() }; return; }
      if (used >= n || i >= step.length || Math.abs(sum) > Math.abs(want)) return;
      tryMix(i + 1, used, sum, list);
      list.push(step[i].sl); tryMix(i, used + 1, sum + step[i].d, list); list.pop();
    };
    tryMix(0, 0, 0, []);
    if (!best) return null;
    const out = best.list.map(sl => Object.assign({}, p, { n: 1, slope: sl }));
    const rest = n - out.length;
    if (rest > 0) out.push(Object.assign({}, p, { n: rest, slope: 0 }));
    return out;
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
  Track.gateOff = gateOff;
  Track.chuteWidth = (type) => CHUTE_W[type] || 0;
  Track.CLEAR = CLEAR;
  Track.DECK = DECK;
  Track.bankRun = bankRun;
  Track.crossingsFor = crossingsFor;
  /* places at a start gate of width w */
  Track.gateSlots = (w) => Math.max(4, Math.floor(w / 0.95));
  Track.startPiece = (type, w, surf) => { const p = { t: 'start', slope: 0, bank: 0, w, surf }; if (startLenFor(type) !== START_LEN) p.sl = startLenFor(type); return p; };
  Track.SPECIAL_OFF = SPECIAL_OFF;
  Track.SURF_IDX = SURF_IDX;
  Track.THICK = THICK;
  MX.Track = Track;
})(window.MX);
