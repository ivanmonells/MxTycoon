/* MX Tycoon - World: continuous heightmap terrain on a tile grid, land ownership,
   paths and roads, scenery and occupancy. Pure simulation (no DOM, no WebGL). */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U;
  const T = C.TILE;

  /* ground types */
  const G = { GRASS: 0, DRY: 1, DIRT: 2, SAND: 3, ROCK: 4, FOREST: 5, GRAVEL: 6, SNOW: 7 };
  const GROUND_NAMES = ['Césped', 'Hierba seca', 'Tierra', 'Arena', 'Roca', 'Sotobosque', 'Grava', 'Nieve'];

  /* path types */
  const P = { NONE: 0, GRAVEL: 1, PAVED: 2, ROAD: 3 };
  const ADDON = { NONE: 0, BENCH: 1, BIN: 2, LAMP: 3 };

  let WORLD_UID = 0;
  class World {
    constructor(size) {
      const N = this.N = size || C.MAP;
      this.uid = ++WORLD_UID; // tells caches of one world from the next
      const V = this.V = N + 1;
      this.heights = new Float32Array(V * V);
      this.ground = new Uint8Array(N * N);
      this.owned = new Uint8Array(N * N);
      this.path = new Uint8Array(N * N);
      this.addon = new Uint8Array(N * N);
      this.litter = new Uint8Array(N * N);
      this.bld = new Int32Array(N * N).fill(-1);
      this.trackOcc = new Uint16Array(N * N);
      this.scen = new Int32Array(N * N).fill(-1);
      this.scenery = new Map();
      this.nextScenId = 1;
      this.PN = Math.ceil(N / C.PARCEL);
      this.parcels = new Uint8Array(this.PN * this.PN); // 0 locked, 1 for sale, 2 owned
      this.expansionLevel = 0;
      this.seed = 1;
      this.preset = 'valle';
      this.roadRow = N - 1;
      this.terrainVer = 1; this.pathVer = 1; this.sceneryVer = 1; this.ownerVer = 1; this.groundVer = 1;
      this.litterVer = 1; this.addonVer = 1;
      this.dirtyTerrain = null; // {x0,z0,x1,z1} tile bounds
      this._hRange = null;
    }

    /* ---------- basic accessors ---------- */
    inBounds(tx, tz) { return tx >= 0 && tz >= 0 && tx < this.N && tz < this.N; }
    idx(tx, tz) { return tx + tz * this.N; }
    vh(vx, vz) {
      vx = vx < 0 ? 0 : vx > this.N ? this.N : vx;
      vz = vz < 0 ? 0 : vz > this.N ? this.N : vz;
      return this.heights[vx + vz * this.V];
    }
    setVh(vx, vz, h) { this.heights[vx + vz * this.V] = U.clamp(h, C.MIN_HEIGHT, C.MAX_HEIGHT); }
    corners(tx, tz) {
      return [this.vh(tx, tz), this.vh(tx + 1, tz), this.vh(tx + 1, tz + 1), this.vh(tx, tz + 1)];
    }
    tileMinMax(tx, tz) {
      const a = this.vh(tx, tz), b = this.vh(tx + 1, tz), c = this.vh(tx + 1, tz + 1), d = this.vh(tx, tz + 1);
      return [Math.min(a, b, c, d), Math.max(a, b, c, d)];
    }
    tileSlope(tx, tz) { const m = this.tileMinMax(tx, tz); return m[1] - m[0]; }
    tileCenterH(tx, tz) {
      return (this.vh(tx, tz) + this.vh(tx + 1, tz) + this.vh(tx + 1, tz + 1) + this.vh(tx, tz + 1)) * 0.25;
    }
    /* Diagonal used to split each tile into two triangles (shared with the renderer). */
    tileDiag(tx, tz) {
      const h00 = this.vh(tx, tz), h10 = this.vh(tx + 1, tz), h01 = this.vh(tx, tz + 1), h11 = this.vh(tx + 1, tz + 1);
      return Math.abs(h00 - h11) <= Math.abs(h10 - h01) ? 0 : 1;
    }
    /* Exact surface height (metres) matching the rendered triangles. */
    heightAt(x, z) {
      const N = this.N;
      let fx = x / T, fz = z / T;
      if (fx < 0) fx = 0; if (fz < 0) fz = 0;
      if (fx > N - 1e-4) fx = N - 1e-4; if (fz > N - 1e-4) fz = N - 1e-4;
      const tx = fx | 0, tz = fz | 0;
      const u = fx - tx, v = fz - tz;
      const V = this.V, H = this.heights;
      const i = tx + tz * V;
      const h00 = H[i], h10 = H[i + 1], h01 = H[i + V], h11 = H[i + V + 1];
      if (Math.abs(h00 - h11) <= Math.abs(h10 - h01)) {
        if (u >= v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
        return h00 + (h11 - h01) * u + (h01 - h00) * v;
      }
      if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
      return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
    }
    heightRange() {
      if (this._hRange && this._hRange.ver === this.terrainVer) return this._hRange;
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < this.heights.length; i++) { const h = this.heights[i]; if (h < mn) mn = h; if (h > mx) mx = h; }
      this._hRange = { min: mn, max: mx, ver: this.terrainVer };
      return this._hRange;
    }
    isWater(tx, tz) { return this.tileMinMax(tx, tz)[0] < C.WATER_LEVEL - 0.02; }
    isOwned(tx, tz) { return this.inBounds(tx, tz) && this.owned[this.idx(tx, tz)] === 1; }
    isRoadRow(tz) { return tz === this.roadRow; }

    markTerrainDirty(x0, z0, x1, z1) {
      const d = this.dirtyTerrain;
      if (!d) this.dirtyTerrain = { x0, z0, x1, z1 };
      else { d.x0 = Math.min(d.x0, x0); d.z0 = Math.min(d.z0, z0); d.x1 = Math.max(d.x1, x1); d.z1 = Math.max(d.z1, z1); }
      this.terrainVer++;
    }

    /* ---------- generation ---------- */
    generate(seed, preset) {
      this.seed = seed >>> 0;
      this.preset = preset || 'valle';
      /* the five starting environments (Catalog.environments) live in MX.Terrain; 'valle'
         is the gentle valley of the first versions */
      if (MX.Terrain && MX.Terrain.ENVS[this.preset]) { MX.Terrain.generate(this, seed, this.preset); return; }
      const N = this.N, V = this.V, rng = new U.RNG(seed);
      const s = this.seed % 100000;
      const cfg = { amp: 3.2, scale: 22, ridge: 1.2, forest: 0.6, dry: 0.15, sand: 0, lakes: 2 };
      const cx = N / 2, cz = N * 0.72;
      for (let vz = 0; vz < V; vz++) {
        for (let vx = 0; vx < V; vx++) {
          const n1 = U.fbm(vx / cfg.scale, vz / cfg.scale, s, 4) - 0.5;
          const n2 = U.fbm(vx / 9, vz / 9, s + 77, 3) - 0.5;
          const ridge = Math.abs(U.fbm(vx / 30, vz / 30, s + 991, 3) - 0.5) * 2;
          const d = Math.hypot((vx - cx) / (N * 0.24), (vz - cz) / (N * 0.26));
          const flat = U.smoothstep(0.55, 1.35, d);
          const edge = U.smoothstep(0.75, 1.6, d);
          let h = C.BASE_HEIGHT + n1 * 2 * cfg.amp * (0.25 + 0.75 * flat) + n2 * 1.1 * (0.3 + flat);
          h += (1 - ridge) * cfg.ridge * edge * 2.2;
          this.heights[vx + vz * V] = h;
        }
      }
      /* lakes: depressions outside the starting plot */
      for (let l = 0; l < cfg.lakes; l++) {
        let lx, lz, tries = 0;
        do {
          lx = rng.range(6, N - 6); lz = rng.range(6, N * 0.55);
          tries++;
        } while (tries < 40 && Math.abs(lx - cx) < 22 && lz > N * 0.45);
        const r = rng.range(4.5, 8.5);
        for (let vz = 0; vz < V; vz++) for (let vx = 0; vx < V; vx++) {
          const dd = Math.hypot(vx - lx, (vz - lz) * 1.25) / r;
          if (dd < 1.6) {
            const k = 1 - U.smoothstep(0.2, 1.6, dd);
            const i = vx + vz * V;
            this.heights[i] = U.lerp(this.heights[i], C.WATER_LEVEL - 1.6, k * 0.95);
          }
        }
      }
      /* public road along the southern edge: flatten a gentle strip */
      for (let vx = 0; vx < V; vx++) {
        const base = C.BASE_HEIGHT + (U.fbm(vx / 30, 3.3, s + 5, 2) - 0.5) * 1.2;
        for (let k = 0; k <= 2; k++) {
          const vz = N - k;
          const i = vx + vz * V;
          const w = k <= 1 ? 1 : 0.5;
          this.heights[i] = U.lerp(this.heights[i], base, w);
        }
      }
      for (let i = 0; i < this.heights.length; i++) {
        this.heights[i] = U.clamp(Math.round(this.heights[i] * 20) / 20, C.MIN_HEIGHT + 0.5, C.MAX_HEIGHT - 2);
      }
      /* ground types */
      for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
        const i = tx + tz * N;
        const dn = U.fbm(tx / 7, tz / 7, s + 333, 3);
        const sn = U.fbm(tx / 11, tz / 11, s + 444, 3);
        let g = G.GRASS;
        if (dn < cfg.dry * 0.9 + 0.22 && cfg.dry > 0.5) g = G.DRY;
        else if (dn > 0.72 - cfg.dry * 0.25) g = G.DRY;
        if (cfg.sand > 0 && sn > 0.66 - cfg.sand * 0.3) g = G.SAND;
        if (this.tileSlope(tx, tz) > 3.2) g = G.ROCK;
        this.ground[i] = g;
      }
      /* road */
      this.path.fill(0);
      for (let tx = 0; tx < N; tx++) this.path[tx + this.roadRow * N] = P.ROAD;
      /* scenery: forests and scattered trees */
      this.scenery.clear(); this.scen.fill(-1); this.nextScenId = 1;
      for (let tz = 0; tz < N - 1; tz++) for (let tx = 0; tx < N; tx++) {
        if (this.isWater(tx, tz) || tz >= this.roadRow - 1) continue;
        const f = U.fbm(tx / 8, tz / 8, s + 555, 3);
        const dPlot = Math.hypot((tx - cx) / (N * 0.2), (tz - cz) / (N * 0.24));
        let p = 0;
        if (f > 0.62 - cfg.forest * 0.12) p = 0.55 * cfg.forest + 0.1;
        else p = 0.02 + 0.03 * cfg.forest;
        if (dPlot < 1) p *= 0.25;
        if (rng.chance(p)) {
          let type;
          const r = rng.next();
          type = r < 0.42 ? 'tree_pine' : r < 0.72 ? 'tree_oak' : r < 0.84 ? 'tree_poplar' : r < 0.95 ? 'bush' : 'rock';
          this.addScenery(type, tx, tz, rng);
          if (type.startsWith('tree') && f > 0.6) this.ground[tx + tz * N] = G.FOREST;
        }
      }
      this.markTerrainDirty(0, 0, N - 1, N - 1);
      this.pathVer++; this.sceneryVer++; this.groundVer++;
    }

    /* Starting plot (career): touching the public road so a parking lot can be placed. */
    setupOwnership(mode) {
      const N = this.N, PN = this.PN, PS = C.PARCEL;
      this.owned.fill(0); this.parcels.fill(0);
      if (mode === 'sandbox') {
        for (let i = 0; i < PN * PN; i++) this.parcels[i] = 2;
      } else {
        /* 6 x 6 parcels (192 m square) against the road in the middle of the map */
        const px0 = Math.max(0, Math.floor(PN / 2) - 3);
        for (let pz = Math.max(0, PN - 6); pz < PN; pz++) for (let px = px0; px < Math.min(PN, px0 + 6); px++) this.parcels[px + pz * PN] = 2;
      }
      for (let pz = 0; pz < PN; pz++) for (let px = 0; px < PN; px++) {
        if (this.parcels[px + pz * PN] !== 2) continue;
        for (let tz = pz * PS; tz < Math.min(N, (pz + 1) * PS); tz++)
          for (let tx = px * PS; tx < Math.min(N, (px + 1) * PS); tx++)
            if (tz !== this.roadRow) this.owned[tx + tz * N] = 1;
      }
      this.ownerVer++;
    }
    /* Make parcels within ring distance `level` of the owned area purchasable. */
    setExpansionLevel(level) {
      this.expansionLevel = Math.max(this.expansionLevel, level);
      const PN = this.PN;
      const ownedP = [];
      for (let i = 0; i < PN * PN; i++) if (this.parcels[i] === 2) ownedP.push(i);
      for (let pz = 0; pz < PN; pz++) for (let px = 0; px < PN; px++) {
        const i = px + pz * PN;
        if (this.parcels[i] !== 0) continue;
        let best = 99;
        for (const j of ownedP) {
          const ox = j % PN, oz = (j / PN) | 0;
          best = Math.min(best, Math.max(Math.abs(ox - px), Math.abs(oz - pz)));
        }
        if (best <= this.expansionLevel) this.parcels[i] = 1;
      }
      this.ownerVer++;
    }
    parcelAt(tx, tz) { return { px: Math.floor(tx / C.PARCEL), pz: Math.floor(tz / C.PARCEL) }; }
    parcelState(px, pz) { return (px < 0 || pz < 0 || px >= this.PN || pz >= this.PN) ? -1 : this.parcels[px + pz * this.PN]; }
    parcelPrice(px, pz) {
      const PN = this.PN;
      const cx = (PN - 1) / 2, cz = PN - 1;
      const d = Math.hypot(px - cx, pz - cz);
      let trees = 0, water = 0;
      const PS = C.PARCEL;
      for (let tz = pz * PS; tz < (pz + 1) * PS; tz++) for (let tx = px * PS; tx < (px + 1) * PS; tx++) {
        if (!this.inBounds(tx, tz)) continue;
        if (this.scen[this.idx(tx, tz)] >= 0) trees++;
        if (this.isWater(tx, tz)) water++;
      }
      return Math.round((9000 + d * 900 + trees * 20 - water * 40) / 100) * 100;
    }
    buyParcel(px, pz) {
      if (this.parcelState(px, pz) !== 1) return false;
      this.parcels[px + pz * this.PN] = 2;
      const PS = C.PARCEL, N = this.N;
      for (let tz = pz * PS; tz < Math.min(N, (pz + 1) * PS); tz++)
        for (let tx = px * PS; tx < Math.min(N, (px + 1) * PS); tx++)
          if (tz !== this.roadRow) this.owned[tx + tz * N] = 1;
      this.setExpansionLevel(this.expansionLevel);
      this.ownerVer++;
      return true;
    }

    /* ---------- scenery ---------- */
    addScenery(type, tx, tz, rng, opts) {
      if (!this.inBounds(tx, tz)) return null;
      const i = this.idx(tx, tz);
      if (this.scen[i] >= 0) return null;
      rng = rng || U.rng;
      /* themed pieces fill their tile and face where the player turned them; the loose
         ones (plants, animals) shift and turn a little so rows of them look natural */
      const d = MX.Catalog.decor[type], loose = !!(d && d.loose);
      const big = !!(d && d.theme) || type === 'statue' || type === 'arch' || type === 'banner' || type === 'safetyfence' || type === 'tires' || type === 'haybales';
      const id = this.nextScenId++;
      const off = () => loose ? T / 2 + rng.range(-0.45, 0.45) : big ? T / 2 : rng.range(0.9, T - 0.9);
      const o = {
        id, type, tx, tz,
        ox: off(),
        oz: off(),
        rot: ((opts && opts.rot != null) ? opts.rot : (big ? 0 : rng.range(0, Math.PI * 2))) + (loose ? rng.range(-0.35, 0.35) : 0),
        s: loose ? rng.range(0.9, 1.1) : big ? 1 : rng.range(0.8, 1.25),
        v: rng.int(0, 3),
        sponsor: (opts && opts.sponsor) || null
      };
      this.scenery.set(id, o);
      this.scen[i] = id;
      this.sceneryVer++;
      return o;
    }
    removeSceneryAt(tx, tz) {
      if (!this.inBounds(tx, tz)) return null;
      const i = this.idx(tx, tz);
      const id = this.scen[i];
      if (id < 0) return null;
      const o = this.scenery.get(id);
      this.scenery.delete(id);
      this.scen[i] = -1;
      this.sceneryVer++;
      return o;
    }
    sceneryAt(tx, tz) {
      if (!this.inBounds(tx, tz)) return null;
      const id = this.scen[this.idx(tx, tz)];
      return id >= 0 ? this.scenery.get(id) : null;
    }
    isTree(o) { return o && (o.type.startsWith('tree') || o.type === 'bush' || o.type === 'rock'); }

    /* ---------- occupancy ---------- */
    tileInfo(tx, tz) {
      const i = this.idx(tx, tz);
      return { owned: this.owned[i] === 1, path: this.path[i], bld: this.bld[i], track: this.trackOcc[i], scen: this.scen[i], water: this.isWater(tx, tz) };
    }
    /* Free for building: owned, no building/path/track/water. Trees are cleared at a cost. */
    canBuildOn(tx, tz, opts) {
      if (!this.inBounds(tx, tz)) return 'Fuera del mapa';
      const i = this.idx(tx, tz);
      if (this.owned[i] !== 1) return 'Terreno no comprado';
      if (this.bld[i] >= 0) return 'Ya hay un edificio';
      if (this.path[i] && !(opts && opts.allowPath)) return 'Hay un camino';
      if (this.trackOcc[i]) return 'Ocupado por un circuito';
      if (this.isWater(tx, tz)) return 'Hay agua';
      const sc = this.scen[i];
      if (sc >= 0 && !(opts && opts.clearScenery)) {
        const o = this.scenery.get(sc);
        if (!this.isTree(o)) return 'Hay una decoración';
      }
      return null;
    }

    /* Vertex is editable if every tile that shares it is owned, has no building and no road. */
    vertexEditable(vx, vz, blockTrack) {
      if (vx < 0 || vz < 0 || vx > this.N || vz > this.N) return false;
      for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
        const tx = vx + dx, tz = vz + dz;
        if (!this.inBounds(tx, tz)) continue;
        const i = this.idx(tx, tz);
        if (this.owned[i] !== 1) return false;
        if (this.bld[i] >= 0) return false;
        if (this.path[i] === P.ROAD && tz === this.roadRow) return false;
        if (blockTrack && (this.trackOcc[i] & blockTrack)) return false;
      }
      return true;
    }

    /* ---------- terrain editing ---------- */
    /* Brush covering tiles [tx0..tx1]x[tz0..tz1] edits vertices [tx0..tx1+1]. */
    terrainEdit(op, tx0, tz0, tx1, tz1, opts) {
      opts = opts || {};
      const N = this.N;
      const vx0 = Math.max(0, tx0), vz0 = Math.max(0, tz0), vx1 = Math.min(N, tx1 + 1), vz1 = Math.min(N, tz1 + 1);
      const amount = opts.amount != null ? opts.amount : C.HEIGHT_STEP;
      const blockMask = opts.blockTrack || 0;
      const changes = [];
      const apply = (vx, vz, nh) => {
        nh = U.clamp(Math.round(nh * 20) / 20, C.MIN_HEIGHT, C.MAX_HEIGHT);
        const oh = this.vh(vx, vz);
        if (Math.abs(nh - oh) < 0.001) return;
        if (!this.vertexEditable(vx, vz, blockMask)) return;
        changes.push([vx, vz, oh, nh]);
      };
      if (op === 'raise' || op === 'lower') {
        const sgn = op === 'raise' ? 1 : -1;
        for (let vz = vz0; vz <= vz1; vz++) for (let vx = vx0; vx <= vx1; vx++) apply(vx, vz, this.vh(vx, vz) + sgn * amount);
      } else if (op === 'level') {
        const target = opts.target != null ? opts.target : this.vh(Math.round((vx0 + vx1) / 2), Math.round((vz0 + vz1) / 2));
        for (let vz = vz0; vz <= vz1; vz++) for (let vx = vx0; vx <= vx1; vx++) apply(vx, vz, target);
      } else if (op === 'smooth') {
        for (let vz = vz0; vz <= vz1; vz++) for (let vx = vx0; vx <= vx1; vx++) {
          let sum = 0, n = 0;
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
            const x = vx + dx, z = vz + dz;
            if (x < 0 || z < 0 || x > N || z > N) continue;
            const w = (dx === 0 && dz === 0) ? 2 : 1;
            sum += this.vh(x, z) * w; n += w;
          }
          apply(vx, vz, sum / n);
        }
      }
      if (!changes.length) return { cost: 0, changed: 0 };
      /* apply, then soften the surroundings so a brush never leaves a spike */
      const touched = new Map();
      for (const c of changes) { this.setVh(c[0], c[1], c[3]); touched.set(c[0] + c[1] * this.V, c[2]); }
      if (op === 'raise' || op === 'lower') {
        const maxStep = 2.4;
        for (let ring = 1; ring <= 5; ring++) {
          let any = false;
          for (let vz = vz0 - ring; vz <= vz1 + ring; vz++) for (let vx = vx0 - ring; vx <= vx1 + ring; vx++) {
            if (vx >= vx0 && vx <= vx1 && vz >= vz0 && vz <= vz1) continue;
            if (vx < 0 || vz < 0 || vx > N || vz > N) continue;
            if (!this.vertexEditable(vx, vz, blockMask)) continue;
            const h = this.vh(vx, vz);
            let lim = h;
            for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dz) continue;
              const nh = this.vh(vx + dx, vz + dz);
              if (op === 'raise' && nh - maxStep > lim) lim = nh - maxStep;
              if (op === 'lower' && nh + maxStep < lim) lim = nh + maxStep;
            }
            if (Math.abs(lim - h) > 0.001) {
              const key = vx + vz * this.V;
              if (!touched.has(key)) touched.set(key, h);
              this.setVh(vx, vz, Math.round(lim * 20) / 20);
              any = true;
            }
          }
          if (!any) break;
        }
      }
      let volume = 0, minx = N, minz = N, maxx = 0, maxz = 0;
      for (const [key, oh] of touched) {
        const vx = key % this.V, vz = (key / this.V) | 0;
        volume += Math.abs(this.heights[key] - oh);
        minx = Math.min(minx, vx); minz = Math.min(minz, vz); maxx = Math.max(maxx, vx); maxz = Math.max(maxz, vz);
      }
      /* steep tiles turn rocky, rocky tiles that flatten regain grass */
      for (let tz = Math.max(0, minz - 1); tz <= Math.min(N - 1, maxz); tz++)
        for (let tx = Math.max(0, minx - 1); tx <= Math.min(N - 1, maxx); tx++) {
          const i = this.idx(tx, tz), sl = this.tileSlope(tx, tz);
          if (sl > 3.2 && this.ground[i] !== G.SAND) this.ground[i] = G.ROCK;
          else if (sl < 2.4 && this.ground[i] === G.ROCK) this.ground[i] = G.DIRT;
        }
      this.groundVer++;
      this.markTerrainDirty(Math.max(0, minx - 1), Math.max(0, minz - 1), Math.min(N - 1, maxx), Math.min(N - 1, maxz));
      return { cost: volume, changed: touched.size, bounds: [minx, minz, maxx, maxz], undo: touched };
    }
    undoTerrain(undo) {
      let minx = this.N, minz = this.N, maxx = 0, maxz = 0;
      for (const [key, oh] of undo) {
        this.heights[key] = oh;
        const vx = key % this.V, vz = (key / this.V) | 0;
        minx = Math.min(minx, vx); minz = Math.min(minz, vz); maxx = Math.max(maxx, vx); maxz = Math.max(maxz, vz);
      }
      this.markTerrainDirty(Math.max(0, minx - 1), Math.max(0, minz - 1), Math.min(this.N - 1, maxx), Math.min(this.N - 1, maxz));
    }
    /* Height a building footprint would be levelled to, and the earthwork volume. */
    footprintLevel(tx, tz, w, h) {
      let sum = 0, n = 0;
      for (let vz = tz; vz <= tz + h; vz++) for (let vx = tx; vx <= tx + w; vx++) { sum += this.vh(vx, vz); n++; }
      const target = Math.max(C.WATER_LEVEL + 0.3, Math.round((sum / n) * 4) / 4);
      let vol = 0;
      for (let vz = tz; vz <= tz + h; vz++) for (let vx = tx; vx <= tx + w; vx++) vol += Math.abs(this.vh(vx, vz) - target);
      return { target, volume: vol };
    }
    flattenFootprint(tx, tz, w, h, target, onlyEditable) {
      for (let vz = tz; vz <= tz + h; vz++) for (let vx = tx; vx <= tx + w; vx++) {
        if (onlyEditable && !this.vertexEditable(vx, vz, 0xffff)) continue;
        this.setVh(vx, vz, target);
      }
      this.markTerrainDirty(Math.max(0, tx - 1), Math.max(0, tz - 1), Math.min(this.N - 1, tx + w), Math.min(this.N - 1, tz + h));
    }
    paintGround(tx, tz, type) {
      if (!this.isOwned(tx, tz)) return false;
      const i = this.idx(tx, tz);
      if (this.ground[i] === type) return false;
      this.ground[i] = type; this.groundVer++;
      this.markTerrainDirty(tx, tz, tx, tz);
      return true;
    }

    /* ---------- paths ---------- */
    pathMask(tx, tz, roadsOnly) {
      let m = 0;
      const test = (x, z) => {
        if (!this.inBounds(x, z)) return false;
        const p = this.path[this.idx(x, z)];
        return roadsOnly ? p === P.ROAD : (p === P.GRAVEL || p === P.PAVED);
      };
      if (test(tx, tz - 1)) m |= 1;      // north (-z)
      if (test(tx + 1, tz)) m |= 2;      // east (+x)
      if (test(tx, tz + 1)) m |= 4;      // south (+z)
      if (test(tx - 1, tz)) m |= 8;      // west (-x)
      return m;
    }
    canPlacePath(tx, tz, type) {
      if (!this.inBounds(tx, tz)) return 'Fuera del mapa';
      const i = this.idx(tx, tz);
      if (tz === this.roadRow) return 'Carretera pública';
      if (this.owned[i] !== 1) return 'Terreno no comprado';
      if (this.bld[i] >= 0) return 'Hay un edificio';
      if (this.trackOcc[i]) return 'No se puede cruzar el circuito';
      if (this.isWater(tx, tz)) return 'Hay agua';
      if (this.tileSlope(tx, tz) > 2.6) return 'Demasiado inclinado';
      if (this.path[i] === type) return 'Ya hay uno igual';
      const sc = this.scen[i];
      if (sc >= 0 && !this.isTree(this.scenery.get(sc))) return 'Hay una decoración';
      return null;
    }
    setPath(tx, tz, type) {
      const i = this.idx(tx, tz);
      this.path[i] = type;
      if (type !== P.GRAVEL && type !== P.PAVED) { this.addon[i] = 0; this.litter[i] = 0; }
      this.pathVer++;
    }
    isWalkable(tx, tz) {
      if (!this.inBounds(tx, tz)) return false;
      const p = this.path[this.idx(tx, tz)];
      return p === P.GRAVEL || p === P.PAVED;
    }

    /* ---------- picking ---------- */
    raycast(ox, oy, oz, dx, dy, dz) {
      const r = this.heightRange();
      const top = r.max + 2, bot = r.min - 1;
      if (Math.abs(dy) < 1e-6) return null;
      let t0 = (top - oy) / dy, t1 = (bot - oy) / dy;
      if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
      t0 = Math.max(t0, 0);
      const size = this.N * T;
      const step = 0.4;
      let prevT = t0, prevD = null;
      for (let t = t0; t <= t1 + step; t += step) {
        const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
        const inside = x >= 0 && z >= 0 && x <= size && z <= size;
        const h = inside ? this.heightAt(x, z) : -1e9;
        const d = y - h;
        if (prevD !== null && prevD > 0 && d <= 0 && inside) {
          let a = prevT, b = t;
          for (let k = 0; k < 10; k++) {
            const m = (a + b) / 2;
            const mx = ox + dx * m, mz = oz + dz * m;
            if (oy + dy * m - this.heightAt(mx, mz) > 0) a = m; else b = m;
          }
          const tt = (a + b) / 2;
          return { x: ox + dx * tt, y: oy + dy * tt, z: oz + dz * tt, t: tt };
        }
        prevD = inside ? d : null; prevT = t;
      }
      return null;
    }

    /* ---------- serialization ---------- */
    serialize() {
      const h16 = new Int16Array(this.heights.length);
      for (let i = 0; i < h16.length; i++) h16[i] = Math.round(this.heights[i] * 100);
      const scen = [];
      for (const o of this.scenery.values()) scen.push([o.type, o.tx, o.tz, +o.ox.toFixed(2), +o.oz.toFixed(2), +o.rot.toFixed(2), +o.s.toFixed(2), o.v, o.sponsor || 0]);
      return {
        N: this.N, seed: this.seed, preset: this.preset, exp: this.expansionLevel,
        h: U.typedToB64(h16), g: U.typedToB64(this.ground), o: U.typedToB64(this.owned),
        p: U.typedToB64(this.path), a: U.typedToB64(this.addon), l: U.typedToB64(this.litter),
        pc: U.typedToB64(this.parcels), scen
      };
    }
    static deserialize(d) {
      const w = new World(d.N);
      w.seed = d.seed; w.preset = d.preset; w.expansionLevel = d.exp || 0;
      const h16 = U.b64ToTyped(d.h, Int16Array);
      for (let i = 0; i < h16.length; i++) w.heights[i] = h16[i] / 100;
      w.ground.set(U.b64ToTyped(d.g, Uint8Array));
      w.owned.set(U.b64ToTyped(d.o, Uint8Array));
      w.path.set(U.b64ToTyped(d.p, Uint8Array));
      w.addon.set(U.b64ToTyped(d.a, Uint8Array));
      w.litter.set(U.b64ToTyped(d.l, Uint8Array));
      w.parcels.set(U.b64ToTyped(d.pc, Uint8Array));
      for (const s of d.scen) {
        const id = w.nextScenId++;
        const o = { id, type: s[0], tx: s[1], tz: s[2], ox: s[3], oz: s[4], rot: s[5], s: s[6], v: s[7], sponsor: s[8] || null };
        w.scenery.set(id, o);
        w.scen[w.idx(o.tx, o.tz)] = id;
      }
      w.markTerrainDirty(0, 0, w.N - 1, w.N - 1);
      return w;
    }
  }

  MX.World = World;
  MX.World.G = G;
  MX.World.P = P;
  MX.World.ADDON = ADDON;
  MX.World.GROUND_NAMES = GROUND_NAMES;
})(window.MX);
