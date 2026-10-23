/* MX Tycoon - Track: closed spline circuits drawn on the terrain, with jumps and
   rhythm sections as real height profiles, berms, surfaces, widths and elevation.
   Produces the sampled geometry used by physics, AI, validation and rendering. */
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

  let TRACK_UID = 1;

  class Track {
    constructor(id, name) {
      this.id = id != null ? id : TRACK_UID++;
      if (this.id >= TRACK_UID) TRACK_UID = this.id + 1;
      this.name = name || ('Circuito ' + this.id);
      this.slot = 0;          // occupancy bit index
      this.nodes = [];        // {x, z, w, surf, elev}
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
      this.nodes.push({ x, z, w: w || 8, surf: surf || 'dirt', elev: 0 });
    }
    insertNode(idx, x, z) {
      const ref = this.nodes[Math.max(0, idx - 1)] || { w: 8, surf: 'dirt', elev: 0 };
      this.nodes.splice(idx, 0, { x, z, w: ref.w, surf: ref.surf, elev: ref.elev });
    }
    removeNode(idx) { if (idx >= 0 && idx < this.nodes.length) this.nodes.splice(idx, 1); }

    /* ---------- geometry ---------- */
    /* Rebuild sampled geometry. `world` gives terrain heights; occupancy is not touched here. */
    rebuild(world) {
      const nodes = this.nodes;
      this.ver++;
      if (nodes.length < 2) { this.S = null; this.length = 0; return; }
      const closed = this.closed && nodes.length >= 3;
      const nseg = closed ? nodes.length : nodes.length - 1;
      const getN = (i) => {
        if (closed) return nodes[U.mod(i, nodes.length)];
        if (i < 0) { const a = nodes[0], b = nodes[1]; return { x: 2 * a.x - b.x, z: 2 * a.z - b.z }; }
        if (i >= nodes.length) { const a = nodes[nodes.length - 1], b = nodes[nodes.length - 2]; return { x: 2 * a.x - b.x, z: 2 * a.z - b.z }; }
        return nodes[i];
      };
      /* dense polyline with segment parameter */
      const px = [], pz = [], pseg = [], pt = [], cum = [0];
      const tmp = { x: 0, z: 0 };
      for (let i = 0; i < nseg; i++) {
        const p0 = getN(i - 1), p1 = getN(i), p2 = getN(i + 1), p3 = getN(i + 2);
        const chord = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const m = Math.max(6, Math.ceil(chord / 0.35));
        for (let k = 0; k < m; k++) {
          const t = k / m;
          catmull(p0, p1, p2, p3, t, tmp);
          px.push(tmp.x); pz.push(tmp.z); pseg.push(i); pt.push(t);
        }
      }
      if (!closed) { const last = nodes[nodes.length - 1]; px.push(last.x); pz.push(last.z); pseg.push(nseg - 1); pt.push(1); }
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
        let x, z, sg, t;
        if (j >= np - 1) {
          if (closed) {
            const segLen = total - cum[np - 1];
            const k = segLen > 1e-6 ? (s - cum[np - 1]) / segLen : 0;
            x = px[np - 1] + (px[0] - px[np - 1]) * k; z = pz[np - 1] + (pz[0] - pz[np - 1]) * k;
            sg = pseg[np - 1]; t = pt[np - 1];
          } else { x = px[np - 1]; z = pz[np - 1]; sg = pseg[np - 1]; t = 1; }
        } else {
          const segLen = cum[j + 1] - cum[j];
          const k = segLen > 1e-6 ? (s - cum[j]) / segLen : 0;
          x = px[j] + (px[j + 1] - px[j]) * k; z = pz[j] + (pz[j + 1] - pz[j]) * k;
          sg = pseg[j]; t = pt[j] + ((pseg[j + 1] === sg ? pt[j + 1] : 1) - pt[j]) * k;
        }
        S.x[i] = x; S.z[i] = z; S.seg[i] = sg;
        const na = nodes[sg], nb = closed ? nodes[(sg + 1) % nodes.length] : nodes[Math.min(nodes.length - 1, sg + 1)];
        S.w[i] = U.lerp(na.w, nb.w, t);
        S.elev[i] = U.lerp(na.elev, nb.elev, U.smoothstep(0, 1, t));
        S.surf[i] = SURF_IDX[na.surf] || 0;
      }
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
      const needStraight = d.kind !== 'berm' && d.kind !== 'finish';
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
      if (!S || this.nodes.length < 4 || !this.closed) {
        issues.push({ level: 'error', msg: 'El trazado no está cerrado (mínimo 4 puntos).' });
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
        const r = this.checkFeature(f.type, f.s, f.uid, { s: f.s, len: f.len || this.featureLen(f.type, f.s), side: f.side });
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
        features: this.features.map(f => [f.type, +f.s.toFixed(2), +(f.len || 0).toFixed(2), +f.ax.toFixed(2), +f.az.toFixed(2), f.side || 0]),
        paid: this.paid, featPaid: this.featPaid, records: this.records, totals: this.totals,
        moisture: this.moisture, statsTested: this.statsTested,
        wear: Array.from(this.wear, v => Math.round(v * 1000) / 1000)
      };
    }
    static deserialize(d, world) {
      const t = new Track(d.id, d.name);
      t.slot = d.slot; t.closed = d.closed; t.state = d.state;
      t.nodes = d.nodes.map(a => ({ x: a[0], z: a[1], w: a[2], surf: a[3], elev: a[4] || 0 }));
      t.features = d.features.map(a => ({ uid: t.nextFeatUid++, type: a[0], s: a[1], len: a[2] || 0, ax: a[3], az: a[4], side: a[5] || 0 }));
      t.paid = d.paid || 0; t.featPaid = d.featPaid || 0;
      t.records = d.records || t.records; t.totals = d.totals || t.totals;
      t.moisture = d.moisture || 0; t.statsTested = !!d.statsTested;
      t.rebuild(world);
      if (d.wear && d.wear.length === t.wear.length) t.wear.set(d.wear);
      t.computeFootprint(world);
      return t;
    }
  }

  Track.LAND_CLEAN = 4.2;   // m/s of impact velocity normal to the landing surface
  Track.LAND_HARD = 7.0;
  Track.GLUE_SPEED = 5.5;   // riders can keep the bike planted over any lip below this speed
  Track.getShape = getShape;
  Track.SURF_IDX = SURF_IDX;
  Track.THICK = THICK;
  MX.Track = Track;
})(window.MX);
