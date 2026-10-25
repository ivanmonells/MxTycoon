/* MX Tycoon - terrain generator for the five starting environments, from the flat coast
   to the mountains (Catalog.environments): heights, water, ground types and natural
   vegetation. The starting land keeps slopes that circuits, paths and riders can use
   and a gentle strip along the road for the parking, the paddock and the entrance.
   Pure simulation, deterministic for a seed. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U;
  const G = MX.World.G;
  const WL = C.WATER_LEVEL;

  /* centred fractal noise of about [-1, 1] at a scale in tiles */
  const nz = (x, z, scale, seed, oct) => (U.fbm(x / scale, z / scale, seed, oct || 4) - 0.5) * 2.6;
  /* sharp crests in [0, 1] (dunes and ridges) */
  const ridged = (x, z, scale, seed, oct) => { const v = 1 - Math.abs(U.fbm(x / scale, z / scale, seed, oct || 4) - 0.5) * 2.6; return v < 0 ? 0 : v; };
  const ss = U.smoothstep;

  /* the career starting land (Game uses World.setupOwnership: 6 x 6 parcels on the road) */
  function plotBox(N) {
    const PS = C.PARCEL, PN = Math.ceil(N / PS), px0 = Math.max(0, Math.floor(PN / 2) - 3);
    return { x0: px0 * PS, x1: Math.min(N, (px0 + 6) * PS), z0: Math.max(0, PN - 6) * PS, z1: N };
  }

  /* ---------------- the environments ---------------- */
  /* height(x, z, k): metres at vertex (x, z); k has the seed (s), road level (road(x)),
     the fade towards the road (fade(z, rows)) and the weight of the starting land (core).
     caps: largest height step (m) between neighbouring vertices on the starting land, on
     the rest of the map and on the strip along the road. */
  const ENVS = {
    playa: {
      caps: { plot: 0.55, out: 1.1, shelf: 0.3 }, shelf: 6, trees: 0.35, sea: true,
      setup(k) {
        const N = k.N;
        /* the shoreline crosses the north of the starting land, nearer in the east */
        k.coast = new Float32Array(N + 1);
        for (let x = 0; x <= N; x++) k.coast[x] = N * (0.31 + 0.12 * x / N + 0.03 * Math.sin(x / N * 6.3 + k.s % 7)) + nz(x, 0, 12, k.s + 11, 3) * 2.2;
      },
      height(x, z, k) {
        const d = z - k.coast[x];
        if (d < 0) return WL - 0.35 - Math.min(3, -d * 0.22);
        const beach = WL - 0.35 + 1.05 * ss(0, 4, d);
        const span = Math.max(8, k.N - k.coast[x] - 4);
        let h = beach + (k.road(x) - beach) * ss(4, span, d);
        /* dunes behind the beach, then a gently rolling coastal plain */
        const band = ss(3, 6, d) * (1 - ss(14, 24, d));
        h += band * (ridged(x * 0.8 + z * 0.6, z * 0.8 - x * 0.6, 6, k.s + 21, 3) * 1.8 - 0.3);
        h += ss(10, 22, d) * nz(x, z, 18, k.s + 31) * 1.0 * k.fade(z, 8);
        return h;
      },
      ground(t) {
        if (t.d < 6) return G.SAND;
        if (t.d < 15) return t.n1 > 0.25 ? G.DRY : G.SAND;
        return t.n1 > 0.35 ? G.DRY : G.GRASS;
      },
      flora(t, r) {
        if (t.d < 2) return r < 0.01 ? 'rock' : null;
        if (t.d < 16) return r < 0.07 ? 'tree_palm' : r < 0.11 ? 'bush' : null;
        if (t.f > 0.62) return r < 0.32 ? 'tree_pine' : r < 0.38 ? 'bush' : null;
        return r < 0.018 ? 'tree_palm' : r < 0.035 ? 'tree_pine' : r < 0.05 ? 'bush' : null;
      }
    },
    campo: {
      caps: { plot: 0.8, out: 1.3, shelf: 0.35 }, shelf: 6, trees: 0.3, ponds: 2,
      height(x, z, k) {
        let h = k.road(x) + (nz(x, z, 20, k.s + 1) * 2.4 + nz(x, z, 8, k.s + 2) * 0.6) * k.fade(z, 10);
        h += (1 - k.core) * nz(x, z, 26, k.s + 3) * 3.2;
        h += ss(k.N * 0.38, 0, z) * (ridged(x, z, 22, k.s + 4) * 6 - 1);
        return h;
      },
      ground(t) {
        /* fields of wheat and ploughed earth outside the starting land */
        if (t.field >= 0 && t.core < 0.5) return t.field === 0 ? G.DRY : t.field === 1 ? G.DIRT : G.GRASS;
        return t.n1 > 0.42 ? G.DRY : G.GRASS;
      },
      flora(t, r) {
        if (t.hedge && t.core < 0.5) return r < 0.22 ? 'tree_poplar' : r < 0.36 ? 'bush' : r < 0.42 ? 'tree_oak' : null;
        if (t.field >= 0 && t.field < 2 && t.core < 0.5) return null;
        if (t.f > 0.64) return r < 0.4 ? 'tree_oak' : r < 0.52 ? 'tree_pine' : r < 0.6 ? 'bush' : null;
        return r < 0.025 ? 'tree_oak' : r < 0.035 ? 'tree_poplar' : r < 0.045 ? 'bush' : r < 0.05 ? 'rock' : null;
      }
    },
    desierto: {
      caps: { plot: 1.1, out: 3.8, shelf: 0.4 }, shelf: 7, trees: 0.4,
      setup(k) {
        const N = k.N, rng = k.rng, P = k.plot;
        k.angle = rng.range(0, Math.PI);
        /* flat-topped mesas around the land and one butte at its edge */
        k.mesas = [];
        for (let i = 0, tries = 0; i < 5 && tries < 200; tries++) {
          const r = rng.range(5, 10), x = rng.range(4, N - 4), z = rng.range(3, N * 0.62);
          if (x > P.x0 - 4 && x < P.x1 + 4 && z > P.z0 - 6) continue;
          if (k.mesas.some(m => Math.hypot(m.x - x, m.z - z) < m.r + r + 4)) continue;
          k.mesas.push({ x, z, r, h: rng.range(9, 15) }); i++;
        }
        const side = rng.chance(0.5) ? 1 : -1;
        k.mesas.push({ x: (P.x0 + P.x1) / 2 + side * (P.x1 - P.x0) * 0.32, z: P.z0 + 9, r: 3.6, h: 6.5 });
        /* the oasis, to one side of the land */
        k.oasis = { x: side > 0 ? P.x0 - 4 : P.x1 + 4, z: P.z0 + (P.z1 - P.z0) * 0.45, r: 4.2 };
        k.wadi = rng.range(0, 100);
      },
      height(x, z, k) {
        const N = k.N, c = Math.cos(k.angle), s = Math.sin(k.angle);
        const a = x * c + z * s, b = -x * s + z * c;
        const dune = ridged(a + nz(x, z, 14, k.s + 5, 2) * 4, b * 0.35, 7, k.s + 6, 3);
        let h = k.road(x) + ((dune - 0.45) * 3.6 + nz(x, z, 18, k.s + 7) * 1.6) * k.fade(z, 9);
        h += (1 - k.core) * nz(x, z, 24, k.s + 8) * 2.5;
        const rough = nz(x, z, 4, k.s + 9, 2) * 0.12;
        for (const m of k.mesas) {
          const d = Math.hypot(x - m.x, z - m.z) / m.r + rough;
          h += m.h * ss(1.12, 0.92, d) + m.h * 0.18 * ss(1.6, 1.1, d);
        }
        /* a dry riverbed winding across the north */
        const wz = N * 0.22 + Math.sin(x / N * 7 + k.wadi) * 5 + nz(x, 0, 10, k.s + 12, 2) * 2;
        h -= 2.4 * ss(3.2, 0.6, Math.abs(z - wz));
        return h;
      },
      water(H, k) { carvePond(H, k, k.oasis.x, k.oasis.z, k.oasis.r); },
      ground(t) {
        if (t.wadi) return t.n1 > 0.1 ? G.GRAVEL : G.DIRT;
        if (t.mesaTop) return t.n1 > 0.2 ? G.DIRT : G.DRY;
        if (t.oasis < 1.75) return G.GRASS;
        return t.n1 > 0.42 ? G.DRY : G.SAND;
      },
      flora(t, r) {
        if (t.oasis < 2.1) return r < 0.45 ? 'tree_palm' : r < 0.55 ? 'bush' : null;
        if (t.wadi) return r < 0.06 ? 'bush' : r < 0.1 ? 'rock' : null;
        if (t.steep) return r < 0.08 ? 'rock' : null;
        return r < 0.035 ? 'tree_cactus' : r < 0.055 ? 'bush' : r < 0.07 ? 'rock' : null;
      }
    },
    colinas: {
      caps: { plot: 1.3, out: 2.6, shelf: 0.4 }, shelf: 7, trees: 0.35, ponds: 2,
      height(x, z, k) {
        const N = k.N;
        let h = k.road(x) + (nz(x, z, 16, k.s + 1) * 9 + nz(x, z, 7, k.s + 2) * 1.6) * k.fade(z, 12) + 4 * ss(N - 8, N * 0.5, z);
        h += (1 - k.core) * (ridged(x, z, 22, k.s + 3) * 12 - 4);
        h += ss(N * 0.45, N * 0.05, z) * (6 + ridged(x, z, 16, k.s + 4) * 11);
        return h;
      },
      ground(t) {
        if (t.n1 > 0.45 && t.slope < 1.4) return G.DRY;
        return G.GRASS;
      },
      flora(t, r) {
        if (t.f > 0.58 && t.rel > -1) return r < 0.32 ? 'tree_pine' : r < 0.55 ? 'tree_oak' : r < 0.62 ? 'bush' : null;
        return r < 0.025 ? 'tree_oak' : r < 0.04 ? 'bush' : r < 0.048 ? 'tree_poplar' : r < 0.056 ? 'rock' : null;
      }
    },
    montana: {
      caps: { plot: 1.7, out: 4.8, shelf: 0.45 }, shelf: 9, trees: 0.4, snow: 44,
      setup(k) {
        const N = k.N, P = k.plot, rng = k.rng;
        k.lake = { x: rng.chance(0.5) ? P.x0 - 7 : P.x1 + 7, z: N - 15, r: 5.2 };
        /* the peaks: a chain along the north and one on each flank */
        k.peaks = [];
        const n = rng.int(3, 4);
        for (let i = 0; i < n; i++) k.peaks.push({ x: (i + 0.5) / n * N + rng.range(-6, 6), z: rng.range(2, N * 0.2), r: rng.range(16, 24), h: rng.range(18, 28) });
        k.peaks.push({ x: rng.range(-2, 6), z: rng.range(N * 0.4, N * 0.6), r: rng.range(13, 17), h: rng.range(16, 24) });
        k.peaks.push({ x: N - rng.range(-2, 6), z: rng.range(N * 0.4, N * 0.6), r: rng.range(13, 17), h: rng.range(16, 24) });
      },
      height(x, z, k) {
        const N = k.N, t = (N - z) / N;
        /* the valley climbs from the road towards the peaks in the north */
        let h = k.road(x) + 30 * Math.pow(ss(0.1, 1.0, t), 1.4);
        h += (nz(x, z, 12, k.s + 1) * 7.5 + nz(x, z, 5, k.s + 2) * 1.2) * k.fade(z, 11);
        let m = 0;
        for (const p of k.peaks) {
          const d = Math.hypot(x - p.x, (z - p.z) * 1.1) / p.r;
          if (d < 1) m = Math.max(m, p.h * Math.pow(1 - d, 1.35));
        }
        /* rocky ridges on the mountainsides, kept off the valley floor by the road */
        h += m * (0.75 + ridged(x, z, 9, k.s + 3) * 0.5) * ss(3, 12, N - z);
        h += ridged(x, z, 14, k.s + 4) * 6 * ss(0.45, 1.0, t);
        return h;
      },
      water(H, k) { carvePond(H, k, k.lake.x, k.lake.z, k.lake.r); },
      ground(t) {
        if (t.h > t.snowLine) return G.SNOW;
        if (t.h > t.snowLine - 6 && t.n1 > 0) return G.GRAVEL;
        if (t.n1 > 0.48) return G.DRY;
        return G.GRASS;
      },
      flora(t, r) {
        if (t.h > t.snowLine - 3) return r < 0.04 ? 'rock' : null;
        if (t.steep) return r < 0.1 ? 'rock' : r < 0.16 ? 'tree_fir' : null;
        if (t.h > 9 && t.f > 0.5) return r < 0.5 ? 'tree_fir' : r < 0.6 ? 'tree_pine' : r < 0.64 ? 'rock' : null;
        if (t.h > 9) return r < 0.06 ? 'tree_fir' : r < 0.08 ? 'rock' : r < 0.09 ? 'bush' : null;
        return r < 0.03 ? 'tree_oak' : r < 0.05 ? 'tree_fir' : r < 0.06 ? 'bush' : null;
      }
    }
  };

  /* bowl dug below the water level with gentle banks */
  function carvePond(H, k, cx, cz, r) {
    const V = k.N + 1;
    for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
      const d = Math.hypot(x - cx, (z - cz) * 1.15) / r + nz(x, z, 3, k.s + 77, 2) * 0.12;
      if (d >= 1.7) continue;
      const i = x + z * V;
      H[i] = U.lerp(H[i], WL - 1.5, (1 - ss(0.25, 1.7, d)) * 0.97);
    }
  }
  /* ponds and lakes in the lowest places outside the middle of the starting land */
  function ponds(H, k, n) {
    const N = k.N, V = N + 1, P = k.plot, rng = k.rng;
    const spots = [];
    for (let l = 0; l < n; l++) {
      let best = null;
      for (let tries = 0; tries < 60; tries++) {
        const x = rng.range(6, N - 6), z = rng.range(5, N - 14);
        const inMid = x > P.x0 + 3 && x < P.x1 - 3 && z > P.z0 + 3;
        if (inMid || spots.some(s => Math.hypot(s.x - x, s.z - z) < 16)) continue;
        const h = H[Math.round(x) + Math.round(z) * V];
        if (!best || h < best.h) best = { x, z, h };
      }
      if (best) { spots.push(best); carvePond(H, k, best.x, best.z, rng.range(3.8, 6.5)); }
    }
  }

  /* largest height step between neighbouring vertices, settled by relaxation; the road
     and the water stay where they are */
  function limitSlopes(H, V, cap, fixed) {
    const D = Math.SQRT2 * 0.9;
    const relax = (a, b, k) => {
      const c = (cap[a] < cap[b] ? cap[a] : cap[b]) * k;
      const d = H[a] - H[b], ad = d < 0 ? -d : d;
      if (ad <= c) return 0;
      const ex = ad - c, sg = d > 0 ? 1 : -1;
      if (fixed[a] && fixed[b]) return 0;
      if (fixed[a]) H[b] += sg * ex;
      else if (fixed[b]) H[a] -= sg * ex;
      else { H[a] -= sg * ex * 0.5; H[b] += sg * ex * 0.5; }
      return ex;
    };
    for (let it = 0; it < 90; it++) {
      let moved = 0;
      const rev = it % 2 === 1;
      for (let zz = 0; zz < V; zz++) {
        const z = rev ? V - 1 - zz : zz;
        for (let xx = 0; xx < V; xx++) {
          const x = rev ? V - 1 - xx : xx, i = x + z * V;
          if (x + 1 < V) moved += relax(i, i + 1, 1);
          if (z + 1 < V) {
            moved += relax(i, i + V, 1);
            if (x + 1 < V) moved += relax(i, i + V + 1, D);
            if (x > 0) moved += relax(i, i + V - 1, D);
          }
        }
      }
      if (moved < 0.01) break;
    }
  }

  function generate(w, seed, id) {
    const E = ENVS[id] || ENVS.campo;
    const N = w.N, V = w.V, H = w.heights;
    const s = (seed >>> 0) % 100000;
    const rng = new U.RNG((seed ^ 0x51ed27) >>> 0);
    const P = plotBox(N);
    const roadH = new Float32Array(V);
    for (let x = 0; x < V; x++) roadH[x] = C.BASE_HEIGHT + nz(x, 3.3, 30, s + 5, 2) * 0.45;
    const k = {
      N, V, s, rng, plot: P,
      road: (x) => roadH[Math.max(0, Math.min(N, Math.round(x)))],
      /* 0 on the road, 1 from `rows` vertices inland */
      fade: (z, rows) => ss(1.5, rows, N - z),
      core: 1
    };
    const coreAt = (x, z) => {
      const dx = Math.max(P.x0 - x, 0, x - P.x1), dz = Math.max(P.z0 - z, 0, z - P.z1);
      return 1 - ss(0, 10, Math.hypot(dx, dz));
    };
    if (E.setup) E.setup(k);
    for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
      k.core = coreAt(x, z);
      H[x + z * V] = E.height(x, z, k);
    }
    /* hollows stay dry above the water level: only the sea, ponds and lakes are water */
    if (!E.sea) {
      const F = WL + 1.2;
      for (let i = 0; i < H.length; i++) if (H[i] < F) H[i] = F + (H[i] - F) * 0.08;
    }
    /* the road itself is level with its verge */
    for (let x = 0; x < V; x++) for (let j = 0; j <= 2; j++) {
      const i = x + (N - j) * V;
      H[i] = j <= 1 ? roadH[x] : U.lerp(H[i], roadH[x], 0.5);
    }
    if (E.water) E.water(H, k);
    if (E.ponds) ponds(H, k, E.ponds);
    /* buildable slopes on the starting land, gentle ones along the road */
    const cap = new Float32Array(V * V), fixed = new Uint8Array(V * V);
    for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
      const i = x + z * V, c = coreAt(x, z);
      let m = U.lerp(E.caps.out, E.caps.plot, c);
      const fromRoad = N - z;
      if (fromRoad <= E.shelf) m = Math.min(m, E.caps.shelf);
      else if (fromRoad <= E.shelf + 4) m = Math.min(m, U.lerp(E.caps.shelf, E.caps.plot, (fromRoad - E.shelf) / 4));
      cap[i] = m;
      if (z >= N - 1 || H[i] < WL - 0.3) fixed[i] = 1;
    }
    limitSlopes(H, V, cap, fixed);
    for (let i = 0; i < H.length; i++) H[i] = U.clamp(Math.round(H[i] * 20) / 20, C.MIN_HEIGHT + 0.5, C.MAX_HEIGHT - 2);

    /* ground types */
    const snowLine = E.snow || 999;
    const fieldOf = (tx, tz) => {
      if (id !== 'campo') return { field: -1, hedge: false };
      const fx = Math.floor((tx + 3) / 7), fz = Math.floor((tz + 2) / 6);
      const hedge = (tx + 3) % 7 === 0 || (tz + 2) % 6 === 0;
      const r = U.hash2(fx, fz, s + 91);
      return { field: r < 0.38 ? 0 : r < 0.66 ? 1 : 2, hedge };
    };
    const tileInfo = (tx, tz) => {
      const h = w.tileCenterH(tx, tz), sl = w.tileSlope(tx, tz), cx = tx + 0.5, cz = tz + 0.5;
      const t = {
        h, slope: sl, steep: sl > 3.0, core: coreAt(cx, cz), snowLine: snowLine + nz(tx, tz, 6, s + 61, 2) * 2,
        n1: nz(tx, tz, 7, s + 333, 3), f: U.fbm(tx / 8, tz / 8, s + 555, 3),
        rel: h - (k.road(cx) || C.BASE_HEIGHT), d: k.coast ? cz - k.coast[Math.round(cx)] : 99,
        oasis: k.oasis ? Math.hypot(cx - k.oasis.x, cz - k.oasis.z) / k.oasis.r : 99,
        wadi: false, mesaTop: false
      };
      if (id === 'desierto') {
        const wz = N * 0.22 + Math.sin(cx / N * 7 + k.wadi) * 5 + nz(cx, 0, 10, s + 12, 2) * 2;
        t.wadi = Math.abs(cz - wz) < 1.6 && h < C.BASE_HEIGHT + 1;
        t.mesaTop = k.mesas.some(m => Math.hypot(cx - m.x, cz - m.z) < m.r * 0.85);
      }
      Object.assign(t, fieldOf(tx, tz));
      return t;
    };
    const info = new Array(N * N);
    for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
      const t = info[tx + tz * N] = tileInfo(tx, tz);
      let g = E.ground(t);
      if (t.slope > 3.2 && g !== G.SNOW) g = G.ROCK;
      w.ground[tx + tz * N] = g;
    }
    /* the public road */
    w.path.fill(0);
    for (let tx = 0; tx < N; tx++) w.path[tx + w.roadRow * N] = MX.World.P.ROAD;
    /* natural vegetation: thinner on the starting land so there is room to build */
    w.scenery.clear(); w.scen.fill(-1); w.nextScenId = 1;
    const count = {};
    for (let tz = 0; tz < N - 1; tz++) for (let tx = 0; tx < N; tx++) {
      if (w.isWater(tx, tz) || tz >= w.roadRow - 1) continue;
      const t = info[tx + tz * N];
      let r = rng.next();
      r /= U.lerp(1, E.trees, t.core);
      const type = E.flora(t, r);
      if (!type) continue;
      if ((count[type] || 0) >= (type.startsWith('tree') ? 1350 : 950)) continue;
      count[type] = (count[type] || 0) + 1;
      w.addScenery(type, tx, tz, rng);
      if (type.startsWith('tree') && t.f > 0.6 && w.ground[tx + tz * N] === G.GRASS) w.ground[tx + tz * N] = G.FOREST;
    }
    w.markTerrainDirty(0, 0, N - 1, N - 1);
    w.pathVer++; w.sceneryVer++; w.groundVer++;
  }

  /* RGBA pixels (N x N) of a world seen from above: ground colours shaded by the relief,
     water, woods and the road; the starting land is outlined when `plot` is set */
  const GROUND_RGB = [[86, 152, 58], [170, 162, 82], [146, 106, 66], [222, 198, 140], [140, 136, 130], [58, 96, 44], [176, 168, 150], [238, 243, 248]];
  function preview(w, plot) {
    const N = w.N, out = new Uint8ClampedArray(N * N * 4), P = plotBox(N);
    for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
      const i = tx + tz * N, o = i * 4;
      const a = w.vh(tx, tz), b = w.vh(tx + 1, tz), c = w.vh(tx, tz + 1);
      /* light from the north-west */
      let k = U.clamp(1 + ((a - b) + (a - c)) * 0.16, 0.55, 1.4);
      let col = GROUND_RGB[w.ground[i]] || GROUND_RGB[0];
      const h = w.tileCenterH(tx, tz);
      if (w.isWater(tx, tz)) { const dpt = U.clamp((C.WATER_LEVEL - h) / 3, 0, 1); col = [64 - dpt * 24, 136 - dpt * 40, 176 - dpt * 30]; k = 1; }
      else {
        k *= 0.86 + U.clamp(h / 45, 0, 1) * 0.3;
        const sc = w.scen[i] >= 0 ? w.scenery.get(w.scen[i]) : null;
        if (sc && sc.type.startsWith('tree')) col = sc.type === 'tree_cactus' ? [104, 150, 84] : sc.type === 'tree_palm' ? [92, 150, 70] : [40, 84, 36];
      }
      if (w.path[i] === MX.World.P.ROAD) { col = [70, 70, 76]; k = 1; }
      if (plot && ((tx === P.x0 || tx === P.x1 - 1) && tz >= P.z0 || tz === P.z0 && tx >= P.x0 && tx < P.x1) && (tx + tz) % 2 === 0) { col = [255, 214, 64]; k = 1; }
      out[o] = col[0] * k; out[o + 1] = col[1] * k; out[o + 2] = col[2] * k; out[o + 3] = 255;
    }
    return out;
  }

  MX.Terrain = { generate, preview, plotBox, ENVS };
})(window.MX);
