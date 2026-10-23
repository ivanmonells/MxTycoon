/* MX Tycoon - voxel models with greedy meshing. Voxels carry a palette entry with a
   colour and a slot (0 fixed colour, 1-4 = per-instance colours A-D, multiplied). */
(function (MX) {
  'use strict';
  const MB = MX.MeshBuilder;

  class VoxModel {
    constructor(sx, sy, sz, ox, oy, oz, size) {
      this.sx = sx; this.sy = sy; this.sz = sz;
      this.ox = ox; this.oy = oy; this.oz = oz; // voxel coordinate that maps to model origin
      this.size = size || 0.1;
      this.cells = new Uint8Array(sx * sy * sz);
      this.palette = [null];
    }
    pal(hex, slot) {
      const c = MB.hex(hex);
      const key = hex + ':' + (slot || 0);
      for (let i = 1; i < this.palette.length; i++) if (this.palette[i].key === key) return i;
      this.palette.push({ key, rgb: c, slot: slot || 0 });
      return this.palette.length - 1;
    }
    idx(x, y, z) {
      x += this.ox; y += this.oy; z += this.oz;
      if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return -1;
      return x + this.sx * (y + this.sy * z);
    }
    set(x, y, z, p) { const i = this.idx(Math.round(x), Math.round(y), Math.round(z)); if (i >= 0) this.cells[i] = p; return this; }
    get(x, y, z) { const i = this.idx(x, y, z); return i < 0 ? 0 : this.cells[i]; }
    box(x0, y0, z0, x1, y1, z1, p) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
          for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, p);
      return this;
    }
    /* disc in the X-Y plane (wheels), thickness z0..z1 */
    disc(cx, cy, z0, z1, r, pOuter, pInner, ringW) {
      const rw = ringW == null ? 1.1 : ringW;
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
        for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d > r + 0.35) continue;
          const p = d >= r - rw ? pOuter : pInner;
          if (!p) continue;
          for (let z = z0; z <= z1; z++) this.set(x, y, z, p);
        }
      return this;
    }
    line(x0, y0, z0, x1, y1, z1, p) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        this.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), Math.round(z0 + (z1 - z0) * t), p);
      }
      return this;
    }
    mirrorZ() {
      /* copy cells with z<0 to -z-1 (models built centred between z=-1 and z=0) */
      for (let x = -this.ox; x < this.sx - this.ox; x++) for (let y = -this.oy; y < this.sy - this.oy; y++)
        for (let z = -this.oz; z < 0; z++) { const p = this.get(x, y, z); if (p) this.set(x, y, -z - 1, p); }
      return this;
    }
    clone() {
      const v = new VoxModel(this.sx, this.sy, this.sz, this.ox, this.oy, this.oz, this.size);
      v.cells.set(this.cells); v.palette = this.palette.slice();
      return v;
    }
    /* Greedy meshing into a MeshBuilder (or a new one). */
    toMesh(mb) {
      mb = mb || new MB(4096);
      const { sx, sy, sz, cells } = this;
      const dims = [sx, sy, sz];
      const s = this.size;
      const ox = this.ox, oy = this.oy, oz = this.oz;
      const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) ? 0 : cells[x + sx * (y + sy * z)];
      for (let d = 0; d < 3; d++) {
        const u = (d + 1) % 3, v = (d + 2) % 3;
        const q = [0, 0, 0]; q[d] = 1;
        const mask = new Int32Array(dims[u] * dims[v]);
        const x = [0, 0, 0];
        for (x[d] = -1; x[d] < dims[d];) {
          let n = 0;
          for (x[v] = 0; x[v] < dims[v]; x[v]++) for (x[u] = 0; x[u] < dims[u]; x[u]++) {
            const a = x[d] >= 0 ? at(x[0], x[1], x[2]) : 0;
            const b = x[d] < dims[d] - 1 ? at(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : 0;
            if (!!a === !!b) mask[n++] = 0;
            else if (a) mask[n++] = a;
            else mask[n++] = -b;
          }
          x[d]++;
          n = 0;
          for (let j = 0; j < dims[v]; j++) {
            for (let i = 0; i < dims[u];) {
              const c = mask[n];
              if (c) {
                let w = 1;
                while (i + w < dims[u] && mask[n + w] === c) w++;
                let h = 1, done = false;
                while (j + h < dims[v]) {
                  for (let k = 0; k < w; k++) if (mask[n + k + h * dims[u]] !== c) { done = true; break; }
                  if (done) break;
                  h++;
                }
                x[u] = i; x[v] = j;
                const du = [0, 0, 0], dv = [0, 0, 0];
                du[u] = w; dv[v] = h;
                const pal = this.palette[Math.abs(c)];
                const P = (p) => [(p[0] - ox) * s, (p[1] - oy) * s, (p[2] - oz) * s];
                const p0 = [x[0], x[1], x[2]];
                const p1 = [x[0] + du[0], x[1] + du[1], x[2] + du[2]];
                const p2 = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]];
                const p3 = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]];
                mb.setSlot(pal.slot);
                const col = [pal.rgb[0], pal.rgb[1], pal.rgb[2], 1];
                if (c > 0) mb.quad(P(p0), P(p1), P(p2), P(p3), null, MB.MAT_SOLID, col);
                else mb.quad(P(p0), P(p3), P(p2), P(p1), null, MB.MAT_SOLID, col);
                for (let l = 0; l < h; l++) for (let k = 0; k < w; k++) mask[n + k + l * dims[u]] = 0;
                i += w; n += w;
              } else { i++; n++; }
            }
          }
        }
      }
      mb.setSlot(0);
      return mb;
    }
  }
  MX.VoxModel = VoxModel;
})(window.MX);
