/* MX Tycoon - MeshBuilder: accumulates flat-shaded geometry in the shared vertex layout
   (pos, normal, uv, material layer, colour slot, colour). Materials >= 0 index the
   material texture array, -1 samples the atlas, -2 means plain vertex colour. */
(function (MX) {
  'use strict';
  const S = MX.GL.STRIDE;
  const MAT_ATLAS = -1, MAT_SOLID = -2;

  class MeshBuilder {
    constructor(cap) {
      this.f = new Float32Array((cap || 2048) * S);
      this.n = 0;
      this.t = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; // 3x3 linear + translation
      this.stack = [];
      this.col = [1, 1, 1, 1];
      this.slot = 0;
      this.uvScale = 1 / 16; // repeating materials: 8 texels per metre on 128px layers
    }
    ensure(k) {
      if ((this.n + k) * S <= this.f.length) return;
      let cap = this.f.length * 2;
      while (cap < (this.n + k) * S) cap *= 2;
      const nf = new Float32Array(cap);
      nf.set(this.f.subarray(0, this.n * S));
      this.f = nf;
    }
    /* transforms */
    push() { this.stack.push(this.t.slice()); return this; }
    pop() { this.t = this.stack.pop(); return this; }
    translate(x, y, z) {
      const t = this.t;
      t[9] += t[0] * x + t[3] * y + t[6] * z;
      t[10] += t[1] * x + t[4] * y + t[7] * z;
      t[11] += t[2] * x + t[5] * y + t[8] * z;
      return this;
    }
    rotateY(a) {
      const c = Math.cos(a), s = Math.sin(a), t = this.t;
      const c0 = [t[0], t[1], t[2]], c2 = [t[6], t[7], t[8]];
      // new X axis = c*X + s*Z ; new Z axis = -s*X + c*Z  (maps local +X to (cos,0,sin))
      for (let i = 0; i < 3; i++) { t[i] = c0[i] * c + c2[i] * s; t[6 + i] = -c0[i] * s + c2[i] * c; }
      return this;
    }
    rotateX(a) {
      const c = Math.cos(a), s = Math.sin(a), t = this.t;
      const c1 = [t[3], t[4], t[5]], c2 = [t[6], t[7], t[8]];
      for (let i = 0; i < 3; i++) { t[3 + i] = c1[i] * c + c2[i] * s; t[6 + i] = -c1[i] * s + c2[i] * c; }
      return this;
    }
    rotateZ(a) {
      const c = Math.cos(a), s = Math.sin(a), t = this.t;
      const c0 = [t[0], t[1], t[2]], c1 = [t[3], t[4], t[5]];
      for (let i = 0; i < 3; i++) { t[i] = c0[i] * c + c1[i] * s; t[3 + i] = -c0[i] * s + c1[i] * c; }
      return this;
    }
    scale(x, y, z) {
      if (y == null) { y = x; z = x; }
      const t = this.t;
      for (let i = 0; i < 3; i++) { t[i] *= x; t[3 + i] *= y; t[6 + i] *= z; }
      return this;
    }
    xf(p) {
      const t = this.t;
      return [t[0] * p[0] + t[3] * p[1] + t[6] * p[2] + t[9], t[1] * p[0] + t[4] * p[1] + t[7] * p[2] + t[10], t[2] * p[0] + t[5] * p[1] + t[8] * p[2] + t[11]];
    }
    color(r, g, b, a) {
      if (typeof r === 'string') { const c = MeshBuilder.hex(r); this.col = [c[0], c[1], c[2], g != null ? g : 1]; }
      else this.col = [r, g, b, a != null ? a : 1];
      return this;
    }
    setSlot(s) { this.slot = s; return this; }

    /* raw vertex (already transformed) */
    _v(p, n, u, v, mat, col) {
      const f = this.f, o = this.n * S;
      f[o] = p[0]; f[o + 1] = p[1]; f[o + 2] = p[2];
      f[o + 3] = n[0]; f[o + 4] = n[1]; f[o + 5] = n[2];
      f[o + 6] = u; f[o + 7] = v; f[o + 8] = mat; f[o + 9] = this.slot;
      f[o + 10] = col[0]; f[o + 11] = col[1]; f[o + 12] = col[2]; f[o + 13] = col[3];
      this.n++;
    }
    static normal(a, b, c) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      return [nx / l, ny / l, nz / l];
    }
    /* Triangle with local coordinates; uvs [[u,v]x3]; winding counter-clockwise seen from outside. */
    tri(a, b, c, uvs, mat, col) {
      this.ensure(3);
      const A = this.xf(a), B = this.xf(b), Cc = this.xf(c);
      const n = MeshBuilder.normal(A, B, Cc);
      col = col || this.col;
      mat = mat == null ? MAT_SOLID : mat;
      uvs = uvs || [[0, 0], [1, 0], [1, 1]];
      this._v(A, n, uvs[0][0], uvs[0][1], mat, col);
      this._v(B, n, uvs[1][0], uvs[1][1], mat, col);
      this._v(Cc, n, uvs[2][0], uvs[2][1], mat, col);
    }
    /* Quad a-b-c-d (counter-clockwise from outside). uv: [u0,v0,u1,v1] mapped a=(u0,v1) b=(u1,v1) c=(u1,v0) d=(u0,v0). */
    quad(a, b, c, d, uv, mat, col) {
      this.ensure(6);
      const A = this.xf(a), B = this.xf(b), Cc = this.xf(c), D = this.xf(d);
      const n = MeshBuilder.normal(A, B, Cc);
      col = col || this.col;
      mat = mat == null ? MAT_SOLID : mat;
      uv = uv || [0, 0, 1, 1];
      const ua = [uv[0], uv[3]], ub = [uv[2], uv[3]], uc = [uv[2], uv[1]], ud = [uv[0], uv[1]];
      this._v(A, n, ua[0], ua[1], mat, col); this._v(B, n, ub[0], ub[1], mat, col); this._v(Cc, n, uc[0], uc[1], mat, col);
      this._v(A, n, ua[0], ua[1], mat, col); this._v(Cc, n, uc[0], uc[1], mat, col); this._v(D, n, ud[0], ud[1], mat, col);
    }
    /* Quad with explicit per-corner uvs (for terrain-like surfaces). */
    /* Quad with its own normal at each corner (smooth shading across curved surfaces). */
    quadN(a, b, c, d, na, nb, nc, nd, uva, uvb, uvc, uvd, mat, col) {
      this.ensure(6);
      const t = this.t;
      const A = this.xf(a), B = this.xf(b), Cc = this.xf(c), D = this.xf(d);
      const N = (n) => {
        const x = t[0] * n[0] + t[3] * n[1] + t[6] * n[2], y = t[1] * n[0] + t[4] * n[1] + t[7] * n[2], z = t[2] * n[0] + t[5] * n[1] + t[8] * n[2];
        const l = Math.hypot(x, y, z) || 1;
        return [x / l, y / l, z / l];
      };
      const NA = N(na), NB = N(nb), NC = N(nc), ND = N(nd);
      col = col || this.col;
      mat = mat == null ? MAT_SOLID : mat;
      this._v(A, NA, uva[0], uva[1], mat, col); this._v(B, NB, uvb[0], uvb[1], mat, col); this._v(Cc, NC, uvc[0], uvc[1], mat, col);
      this._v(A, NA, uva[0], uva[1], mat, col); this._v(Cc, NC, uvc[0], uvc[1], mat, col); this._v(D, ND, uvd[0], uvd[1], mat, col);
    }
    quad4(a, b, c, d, uva, uvb, uvc, uvd, mat, col) {
      this.ensure(6);
      const A = this.xf(a), B = this.xf(b), Cc = this.xf(c), D = this.xf(d);
      const n1 = MeshBuilder.normal(A, B, Cc), n2 = MeshBuilder.normal(A, Cc, D);
      col = col || this.col;
      mat = mat == null ? MAT_SOLID : mat;
      this._v(A, n1, uva[0], uva[1], mat, col); this._v(B, n1, uvb[0], uvb[1], mat, col); this._v(Cc, n1, uvc[0], uvc[1], mat, col);
      this._v(A, n2, uva[0], uva[1], mat, col); this._v(Cc, n2, uvc[0], uvc[1], mat, col); this._v(D, n2, uvd[0], uvd[1], mat, col);
    }
    /* Axis aligned box in local space. opts: mat (sides), top (mat), bottom (bool), col, topCol, uv: repeat scale */
    box(x0, y0, z0, x1, y1, z1, opts) {
      opts = opts || {};
      const mat = opts.mat == null ? MAT_SOLID : opts.mat;
      const top = opts.top == null ? mat : opts.top;
      const col = opts.col || this.col, tcol = opts.topCol || col;
      const k = opts.uv || this.uvScale;
      const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
      const vu = (len) => len * k;
      const side = (a, b, c, d, w, h, m, cc) => this.quad(a, b, c, d, [0, 0, vu(w), vu(h)], m, cc);
      if (!opts.noSides) {
        // +X face
        if (!opts.skip || !opts.skip.px) side([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], sz, sy, opts.matPX != null ? opts.matPX : mat, opts.colPX || col);
        // -X face
        if (!opts.skip || !opts.skip.nx) side([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], sz, sy, opts.matNX != null ? opts.matNX : mat, opts.colNX || col);
        // +Z face
        if (!opts.skip || !opts.skip.pz) side([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], sx, sy, opts.matPZ != null ? opts.matPZ : mat, opts.colPZ || col);
        // -Z face
        if (!opts.skip || !opts.skip.nz) side([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], sx, sy, opts.matNZ != null ? opts.matNZ : mat, opts.colNZ || col);
      }
      if (!opts.noTop) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 0, vu(sx), vu(sz)], top, tcol);
      if (opts.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 0, vu(sx), vu(sz)], top, tcol);
      return this;
    }
    /* Gable roof over [x0,x1]x[z0,z1] starting at y0 with ridge height y1; ridge along X or Z. */
    gable(x0, z0, x1, z1, y0, y1, along, mat, col, gableCol, overhang) {
      const o = overhang == null ? 0.25 : overhang;
      const k = this.uvScale;
      col = col || this.col;
      if (along === 'x') {
        const zm = (z0 + z1) / 2;
        const ax0 = x0 - o, ax1 = x1 + o, bz0 = z0 - o, bz1 = z1 + o;
        const slope = Math.hypot(zm - bz0, y1 - y0);
        this.quad([ax0, y0, bz1], [ax1, y0, bz1], [ax1, y1, zm], [ax0, y1, zm], [0, 0, (ax1 - ax0) * k, slope * k], mat, col);
        this.quad([ax1, y0, bz0], [ax0, y0, bz0], [ax0, y1, zm], [ax1, y1, zm], [0, 0, (ax1 - ax0) * k, slope * k], mat, col);
        const gc = gableCol || col;
        this.tri([x0, y0, z1], [x0, y1, zm], [x0, y0, z0], null, MAT_SOLID, gc);
        this.tri([x1, y0, z0], [x1, y1, zm], [x1, y0, z1], null, MAT_SOLID, gc);
      } else {
        const xm = (x0 + x1) / 2;
        const az0 = z0 - o, az1 = z1 + o, bx0 = x0 - o, bx1 = x1 + o;
        const slope = Math.hypot(xm - bx0, y1 - y0);
        this.quad([bx1, y0, az1], [bx1, y0, az0], [xm, y1, az0], [xm, y1, az1], [0, 0, (az1 - az0) * k, slope * k], mat, col);
        this.quad([bx0, y0, az0], [bx0, y0, az1], [xm, y1, az1], [xm, y1, az0], [0, 0, (az1 - az0) * k, slope * k], mat, col);
        const gc = gableCol || col;
        this.tri([x0, y0, z0], [xm, y1, z0], [x1, y0, z0], null, MAT_SOLID, gc);
        this.tri([x1, y0, z1], [xm, y1, z1], [x0, y0, z1], null, MAT_SOLID, gc);
      }
      return this;
    }
    /* Single slope (shed) roof, higher at z0 side. */
    shed(x0, z0, x1, z1, yLow, yHigh, mat, col, overhang) {
      const o = overhang == null ? 0.3 : overhang;
      const k = this.uvScale;
      col = col || this.col;
      const a = [x0 - o, yHigh, z0 - o], b = [x1 + o, yHigh, z0 - o], c = [x1 + o, yLow, z1 + o], d = [x0 - o, yLow, z1 + o];
      const L = Math.hypot(z1 - z0 + 2 * o, yHigh - yLow);
      this.quad(d, c, b, a, [0, 0, (x1 - x0 + 2 * o) * k, L * k], mat, col);
      this.quad(a, b, c, d, [0, 0, (x1 - x0 + 2 * o) * k, L * k], mat, MeshBuilder.mulCol(col, 0.7));
      return this;
    }
    cylinder(cx, y0, cz, r, h, sides, mat, col, capTop) {
      sides = sides || 8;
      col = col || this.col;
      for (let i = 0; i < sides; i++) {
        const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
        const p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
        this.quad([p1[0], y0, p1[2]], [p0[0], y0, p0[2]], [p0[0], y0 + h, p0[2]], [p1[0], y0 + h, p1[2]], [0, 0, 2 * Math.PI * r / sides * this.uvScale, h * this.uvScale], mat, col);
        if (capTop !== false) this.tri([cx, y0 + h, cz], [p1[0], y0 + h, p1[2]], [p0[0], y0 + h, p0[2]], null, mat, col);
      }
      return this;
    }
    cone(cx, y0, cz, r, h, sides, col, jitter) {
      sides = sides || 7;
      col = col || this.col;
      const top = [cx, y0 + h, cz];
      for (let i = 0; i < sides; i++) {
        const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
        const c = jitter ? MeshBuilder.mulCol(col, 1 + (MX.U.hash2(i, sides, (r * 100) | 0) - 0.5) * jitter) : col;
        this.tri([cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], top, null, MAT_SOLID, c);
        this.tri([cx, y0, cz], [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r], null, MAT_SOLID, MeshBuilder.mulCol(col, 0.6));
      }
      return this;
    }
    /* Low poly blob (octahedron subdivided once, jittered). */
    blob(cx, cy, cz, rx, ry, rz, col, seed, jit) {
      const base = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      const faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
      const verts = base.slice();
      const cache = {};
      const mid = (a, b) => {
        const key = a < b ? a + '_' + b : b + '_' + a;
        if (cache[key] != null) return cache[key];
        const p = verts[a], q = verts[b];
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
        const l = Math.hypot(m[0], m[1], m[2]);
        verts.push([m[0] / l, m[1] / l, m[2] / l]);
        return (cache[key] = verts.length - 1);
      };
      const sub = [];
      for (const f of faces) {
        const a = mid(f[0], f[1]), b = mid(f[1], f[2]), c = mid(f[2], f[0]);
        sub.push([f[0], a, c], [a, f[1], b], [c, b, f[2]], [a, b, c]);
      }
      const J = jit == null ? 0.18 : jit;
      const P = verts.map((v, i) => {
        const j = 1 + (MX.U.hash2(i, seed || 1, 7) - 0.5) * 2 * J;
        return [cx + v[0] * rx * j, cy + v[1] * ry * j, cz + v[2] * rz * j];
      });
      col = col || this.col;
      for (let i = 0; i < sub.length; i++) {
        const f = sub[i];
        const shade = 1 + (MX.U.hash2(i, seed || 3, 11) - 0.5) * 0.16;
        this.tri(P[f[0]], P[f[1]], P[f[2]], null, MAT_SOLID, MeshBuilder.mulCol(col, shade));
      }
      return this;
    }
    build() { return { data: this.f.subarray(0, this.n * S), count: this.n }; }
    static hex(h) {
      if (Array.isArray(h)) return h;
      const n = parseInt(h.slice(1), 16);
      if (h.length === 4) {
        const r = (n >> 8) & 15, g = (n >> 4) & 15, b = n & 15;
        return [r * 17 / 255, g * 17 / 255, b * 17 / 255];
      }
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    static mulCol(c, k) { return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k), c[3] != null ? c[3] : 1]; }
    static rgba(h, a) { const c = MeshBuilder.hex(h); return [c[0], c[1], c[2], a == null ? 1 : a]; }
  }
  MeshBuilder.MAT_ATLAS = MAT_ATLAS;
  MeshBuilder.MAT_SOLID = MAT_SOLID;
  MX.MeshBuilder = MeshBuilder;
})(window.MX);
