/* MX Tycoon - navigation: BFS flow fields over the tile grid for pedestrians (paths
   only), riders and service vehicles (off-road), and road routing for cars. */
(function (MX) {
  'use strict';
  const C = MX.C;
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  class FlowField {
    constructor(N) { this.N = N; this.d = new Int16Array(N * N).fill(-1); this.reach = 0; }
    get(tx, tz) { return (tx < 0 || tz < 0 || tx >= this.N || tz >= this.N) ? -1 : this.d[tx + tz * this.N]; }
  }

  /* Multi-source BFS. passable(tx,tz,i) decides traversal; sources are tile indices. */
  function bfs(N, sources, passable, maxDist) {
    const f = new FlowField(N);
    const q = new Int32Array(N * N);
    let h = 0, t = 0;
    for (const s of sources) { if (f.d[s] === -1) { f.d[s] = 0; q[t++] = s; } }
    const md = maxDist || 32000;
    while (h < t) {
      const i = q[h++];
      const tx = i % N, tz = (i / N) | 0, d = f.d[i];
      if (d >= md) continue;
      for (let k = 0; k < 4; k++) {
        const nx = tx + DIRS[k][0], nz = tz + DIRS[k][1];
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const j = nx + nz * N;
        if (f.d[j] !== -1) continue;
        if (!passable(nx, nz, j)) continue;
        f.d[j] = d + 1;
        q[t++] = j;
      }
    }
    f.reach = t;
    return f;
  }

  /* Choose the neighbour that goes downhill in a field. Returns tile index or -1. */
  function nextStep(field, tx, tz, rng, avoid) {
    const N = field.N;
    const cur = field.get(tx, tz);
    if (cur <= 0) return -1;
    let best = -1, bestD = cur, ties = 0;
    for (let k = 0; k < 4; k++) {
      const nx = tx + DIRS[k][0], nz = tz + DIRS[k][1];
      const d = field.get(nx, nz);
      if (d < 0 || d >= cur) continue;
      const j = nx + nz * N;
      if (j === avoid) continue;
      if (d < bestD) { bestD = d; best = j; ties = 1; }
      else if (d === bestD) { ties++; if (rng.next() < 1 / ties) best = j; }
    }
    return best;
  }

  /* Path tiles adjacent to a building footprint on a given side (or all sides). */
  function adjacentTiles(b, world, filter) {
    const out = [];
    for (let x = b.tx; x < b.tx + b.w; x++) { out.push([x, b.tz - 1, 0]); out.push([x, b.tz + b.h, 2]); }
    for (let z = b.tz; z < b.tz + b.h; z++) { out.push([b.tx - 1, z, 3]); out.push([b.tx + b.w, z, 1]); }
    return out.filter(([x, z, side]) => world.inBounds(x, z) && (!filter || filter(x, z, side)));
  }

  /* Road route for cars: BFS over road tiles from start to goal. Returns list of tile indices. */
  function roadRoute(world, fromI, goalSet) {
    const N = world.N;
    const prev = new Int32Array(N * N).fill(-2);
    const q = [fromI];
    prev[fromI] = -1;
    let found = -1;
    while (q.length) {
      const i = q.shift();
      if (goalSet.has(i)) { found = i; break; }
      const tx = i % N, tz = (i / N) | 0;
      for (const [dx, dz] of DIRS) {
        const nx = tx + dx, nz = tz + dz;
        if (!world.inBounds(nx, nz)) continue;
        const j = nx + nz * N;
        if (prev[j] !== -2) continue;
        if (world.path[j] !== MX.World.P.ROAD) continue;
        prev[j] = i;
        q.push(j);
      }
    }
    if (found < 0) return null;
    const route = [];
    for (let i = found; i !== -1; i = prev[i]) route.push(i);
    return route.reverse();
  }

  MX.Pathing = { FlowField, bfs, nextStep, adjacentTiles, roadRoute, DIRS };
})(window.MX);
