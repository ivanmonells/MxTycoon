/* MX Tycoon - Renderer: owns the WebGL2 context, static scene meshes (terrain chunks,
   paths, buildings, tracks, scenery instances) and per-frame dynamic instances
   (riders, people, vehicles, particles). Renders shadow, main and post passes into a
   low-resolution target that the browser upscales with nearest-neighbour. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U, GLU = MX.GL, M4 = GLU.M4, SH = MX.Shaders;
  const T = C.TILE;

  class Camera {
    constructor() {
      this.tx = 160; this.ty = 6; this.tz = 200;
      this.yawIndex = 0; this.yaw = Math.PI / 4; this.pitch = Math.PI / 6;
      this.zoom = 8; this.targetZoom = 8;
      this.minZoom = 2.2; this.maxZoom = 36;
      /* zoom counts half CSS pixels per metre whatever the pixel size: finer pixels show more detail, not more map */
      this.zoomMul = 1;
      this.view = M4.create(); this.proj = M4.create(); this.viewProj = M4.create(); this.inv = M4.create();
      this.w = 640; this.h = 360;
      this.dist = 600;
      this.follow = null;
      this.right = [1, 0, 0]; this.up = [0, 1, 0]; this.fwd = [0, 0, -1];
      this.shake = 0;
    }
    eyeDir() {
      const cp = Math.cos(this.pitch);
      return [cp * Math.cos(this.yaw), Math.sin(this.pitch), cp * Math.sin(this.yaw)];
    }
    update(dt) {
      if (!this.freeYaw) {
        const want = Math.PI / 4 + this.yawIndex * Math.PI / 2;
        this.yaw += U.wrapAngle(want - this.yaw) * Math.min(1, dt * 9);
        if (Math.abs(U.wrapAngle(want - this.yaw)) < 0.001) this.yaw = want;
      }
      const z0 = this.zoom;
      this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 12);
      if (Math.abs(this.zoom - this.targetZoom) < 0.01) this.zoom = this.targetZoom;
      void z0;
      this.compute();
    }
    compute() {
      const d = this.eyeDir();
      /* camera basis */
      let fx = -d[0], fy = -d[1], fz = -d[2];
      let rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0;
      const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
      const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
      this.right = [rx, ry, rz]; this.up = [ux, uy, uz]; this.fwd = [fx, fy, fz];
      /* pixel snap the target so static geometry never shimmers while panning */
      const zr = this.zoom * this.zoomMul;
      const px = 1 / zr;
      let tx = this.tx, ty = this.ty, tz = this.tz;
      if (this.shake > 0) { tx += (Math.random() - 0.5) * this.shake; tz += (Math.random() - 0.5) * this.shake; }
      const tr = tx * rx + ty * ry + tz * rz, tu = tx * ux + ty * uy + tz * uz;
      const sr = Math.round(tr / px) * px - tr, su = Math.round(tu / px) * px - tu;
      tx += rx * sr + ux * su; ty += ry * sr + uy * su; tz += rz * sr + uz * su;
      this.stx = tx; this.sty = ty; this.stz = tz;
      const ex = tx + d[0] * this.dist, ey = ty + d[1] * this.dist, ez = tz + d[2] * this.dist;
      M4.lookAt(this.view, ex, ey, ez, tx, ty, tz, 0, 1, 0);
      const hw = this.w / 2 / zr, hh = this.h / 2 / zr;
      M4.ortho(this.proj, -hw, hw, -hh, hh, 1, 1500);
      M4.mul(this.viewProj, this.proj, this.view);
      M4.invert(this.inv, this.viewProj);
      this.eye = [ex, ey, ez];
    }
    /* screen pixel (render-target coordinates) to a world ray */
    ray(px, py) {
      const nx = (px / this.w) * 2 - 1, ny = 1 - (py / this.h) * 2;
      const o = M4.transform(this.inv, nx, ny, -1);
      return { ox: o[0], oy: o[1], oz: o[2], dx: this.fwd[0], dy: this.fwd[1], dz: this.fwd[2] };
    }
    project(x, y, z, out) {
      const m = this.viewProj;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
      out = out || {};
      out.x = (cx * 0.5 + 0.5) * this.w; out.y = (0.5 - cy * 0.5) * this.h; out.d = cz;
      return out;
    }
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.cam = new Camera();
      this.pixelScale = 2;
      this.shadows = true;
      this.outline = true;
      this.ready = false;
      this.chunks = [];
      this.trackMeshes = new Map();
      this.bldChunks = new Map();
      this.instPools = {};
      this.time = 0;
      this.ghost = null;
      this.brush = [0, 0, 0, 0]; this.brushCol = [0, 0, 0, 0];
      this.grid = false; this.showLand = false;
      this.versions = {};
      this.flash = 0;
      this.stats = { tris: 0, draws: 0 };
    }

    init() {
      const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WEBGL2');
      this.gl = gl;
      if (!this._ctxBound) {
        this._ctxBound = true;
        this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; MX.Bus.emit('gl:lost'); }, false);
        this.canvas.addEventListener('webglcontextrestored', () => this._restore(), false);
      }
      this.progs = {
        mesh: GLU.program(gl, SH.MESH_VS, SH.MESH_FS, 'mesh'),
        terrain: GLU.program(gl, SH.MESH_VS, SH.TERRAIN_FS, 'terrain'),
        inst: GLU.program(gl, SH.INST_VS, SH.MESH_FS, 'inst'),
        shadow: GLU.program(gl, SH.SHADOW_VS, SH.SHADOW_FS, 'shadow'),
        shadowInst: GLU.program(gl, SH.SHADOW_INST_VS, SH.SHADOW_FS, 'shadowInst'),
        water: GLU.program(gl, SH.WATER_VS, SH.WATER_FS, 'water'),
        sprite: GLU.program(gl, SH.SPRITE_VS, SH.SPRITE_FS, 'sprite'),
        post: GLU.program(gl, SH.POST_VS, SH.POST_FS, 'post')
      };
      this.matTex = MX.Tex.uploadMaterials(gl);
      this.atlasTex = GLU.texFromCanvas(gl, MX.Tex.buildAtlas(), {});
      this.noiseTex = this._noiseTexture();
      this.ownTex = gl.createTexture();
      this.groundTex = gl.createTexture();
      this.heightTex = gl.createTexture();
      this.emptyVao = gl.createVertexArray();
      /* model VAOs */
      const lib = MX.Models.buildAll();
      this.models = {};
      for (const k in lib) {
        const m = GLU.makeMeshVAO(gl, lib[k].data, lib[k].count);
        GLU.attachInstancing(gl, m, k.startsWith('person') || k.startsWith('tree') ? 1400 : k === 'bush' || k === 'rock' ? 1000 : 400);
        this.models[k] = m;
      }
      MX.BuildModels && MX.BuildModels.init && MX.BuildModels.init();
      this._initSprites();
      this.shadowRes = 2048;
      this.shadowTarget = GLU.makeTarget(gl, this.shadowRes, this.shadowRes, false);
      this.shadowMat = M4.create();
      this.lightVP = M4.create();
      this.dyn = GLU.makeMeshVAO(gl, new Float32Array(GLU.STRIDE * 6), 0);
      this.ghostMesh = GLU.makeMeshVAO(gl, new Float32Array(GLU.STRIDE * 6), 0);
      this.overlayMesh = GLU.makeMeshVAO(gl, new Float32Array(GLU.STRIDE * 6), 0);
      this.ready = true;
    }
    _noiseTexture() {
      const gl = this.gl, S = 128;
      const data = new Uint8Array(S * S * 4);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let v = 0, a = 0.5, f = 1, n = 0;
        for (let o = 0; o < 4; o++) {
          const per = 8 * f;
          const fx = x / S * per, fy = y / S * per;
          const xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi;
          const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
          const h = (i, j) => U.hash2(U.mod(i, per), U.mod(j, per), 77 + o);
          v += U.lerp(U.lerp(h(xi, yi), h(xi + 1, yi), u), U.lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), w) * a;
          n += a; a *= 0.5; f *= 2;
        }
        const k = Math.round(v / n * 255);
        const o = (x + y * S) * 4;
        data[o] = data[o + 1] = data[o + 2] = k; data[o + 3] = 255;
      }
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      return t;
    }
    _initSprites() {
      const gl = this.gl;
      this.spriteMax = 6000;
      this.spriteVao = gl.createVertexArray();
      gl.bindVertexArray(this.spriteVao);
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      this.spriteBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
      const B = 4 * 11 + 4; // pos3 size2 uv4 rot1 + col4ub
      this.spriteStride = B;
      gl.bufferData(gl.ARRAY_BUFFER, this.spriteMax * B, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, B, 0); gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, B, 12); gl.vertexAttribDivisor(2, 1);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, B, 20); gl.vertexAttribDivisor(4, 1);
      gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, B, 36); gl.vertexAttribDivisor(5, 1);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, B, 40); gl.vertexAttribDivisor(3, 1);
      gl.bindVertexArray(null);
      this.spriteData = new ArrayBuffer(this.spriteMax * B);
      this.spriteF = new Float32Array(this.spriteData);
      this.spriteU8 = new Uint8Array(this.spriteData);
      this.spriteCount = 0;
    }

    /* every GPU resource is derived from game state, so a lost context is rebuilt from scratch */
    _restore() {
      this.chunks = []; this.trackMeshes = new Map(); this.bldChunks = new Map(); this.instPools = {};
      this.mainTarget = null; this.ghost = null; this.overlayCount = 0; this.spriteCount = 0;
      this.skirtMesh = null; this.pathMesh = null; this.decorMesh = null; this.waterVao = null; this.waterBuf = null;
      try {
        this.init();
        this.lost = false;
        if (this._css) this.resize(this._css[0], this._css[1], this.dpr);
        if (this.game) this.setGame(this.game);
        MX.Bus.emit('gl:restored');
      } catch (e) { console.error('context restore failed', e); }
    }
    resize(cssW, cssH, dpr) {
      this._css = [cssW, cssH];
      const ps = Math.max(1, Math.round(this.pixelScale * dpr));
      const w = Math.max(64, Math.ceil(cssW * dpr / ps));
      const h = Math.max(64, Math.ceil(cssH * dpr / ps));
      this.dpr = dpr; this.ps = ps;
      this.canvas.width = w; this.canvas.height = h;
      this.canvas.style.width = (w * ps / dpr) + 'px';
      this.canvas.style.height = (h * ps / dpr) + 'px';
      this.cssScale = ps / dpr; // css px per render px
      this.cam.w = w; this.cam.h = h;
      this.cam.zoomMul = 2 / this.cssScale;
      if (this.gl) this.mainTarget = GLU.makeTarget(this.gl, w, h, true, this.mainTarget);
    }
    cssToRender(x, y) { return [x / this.cssScale, y / this.cssScale]; }
    renderToCss(x, y) { return [x * this.cssScale, y * this.cssScale]; }

    /* ---------- static scene sync ---------- */
    setGame(game) {
      this.game = game;
      this.versions = {};
      for (const c of this.chunks) if (c) this._freeMesh(c);
      this.chunks = [];
      for (const [, m] of this.trackMeshes) { this._freeMesh(m.main); if (m.gate) this._freeMesh(m.gate); if (m.decor) this._freeMesh(m.decor); }
      this.trackMeshes.clear();
      for (const [, m] of this.bldChunks) this._freeMesh(m);
      this.bldChunks.clear();
      const world = game.world;
      const nC = Math.ceil(world.N / MX.Geom.CH);
      this.nC = nC;
      for (let cz = 0; cz < nC; cz++) for (let cx = 0; cx < nC; cx++) this.chunks.push(null);
      world.dirtyTerrain = { x0: 0, z0: 0, x1: world.N - 1, z1: world.N - 1 };
      this._buildWater();
      this.sync(true);
    }
    _freeMesh(m) { if (!m) return; const gl = this.gl; gl.deleteBuffer(m.vbo); gl.deleteVertexArray(m.vao); if (m.ibuf) gl.deleteBuffer(m.ibuf); }
    _buildWater() {
      const gl = this.gl, S = this.game.world.N * T, m = 60;
      const y = C.WATER_LEVEL;
      const data = new Float32Array([-m, y, -m, S + m, y, -m, S + m, y, S + m, -m, y, -m, S + m, y, S + m, -m, y, S + m]);
      if (!this.waterVao) {
        this.waterVao = gl.createVertexArray(); this.waterBuf = gl.createBuffer();
        gl.bindVertexArray(this.waterVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuf);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
      } else { gl.bindVertexArray(this.waterVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuf); }
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
    }
    _uploadHeights() {
      const gl = this.gl, w = this.game.world, V = w.V;
      gl.bindTexture(gl.TEXTURE_2D, this.heightTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, V, V, 0, gl.RED, gl.FLOAT, w.heights);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    _uploadOwnership() {
      const gl = this.gl, w = this.game.world, N = w.N;
      const data = new Uint8Array(N * N);
      for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
        const i = tx + tz * N;
        if (w.owned[i]) data[i] = 255;
        else {
          const p = w.parcelAt(tx, tz);
          data[i] = w.parcelState(p.px, p.pz) === 1 ? 128 : 0;
        }
        if (tz === w.roadRow) data[i] = 255;
      }
      gl.bindTexture(gl.TEXTURE_2D, this.ownTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, N, N, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    _uploadGround() {
      const gl = this.gl, w = this.game.world, N = w.N;
      const data = new Uint8Array(N * N);
      const L = MX.Tex.L, G = MX.Geom.GROUND_LAYER;
      for (let i = 0; i < N * N; i++) data[i] = L[G[w.ground[i]] || 'grass'];
      gl.bindTexture(gl.TEXTURE_2D, this.groundTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, N, N, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    sync(force) {
      const game = this.game, world = game.world, gl = this.gl, V = this.versions;
      /* terrain */
      const d = world.dirtyTerrain;
      if (d) {
        const CH = MX.Geom.CH;
        const c0x = Math.max(0, Math.floor((d.x0 - 1) / CH)), c1x = Math.min(this.nC - 1, Math.floor((d.x1 + 1) / CH));
        const c0z = Math.max(0, Math.floor((d.z0 - 1) / CH)), c1z = Math.min(this.nC - 1, Math.floor((d.z1 + 1) / CH));
        for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
          const g = MX.Geom.terrainChunk(world, cx, cz);
          const k = cx + cz * this.nC;
          this.chunks[k] = GLU.makeMeshVAO(gl, g.data, g.count, this.chunks[k]);
        }
        const sk = MX.Geom.skirt(world);
        this.skirtMesh = GLU.makeMeshVAO(gl, sk.data, sk.count, this.skirtMesh);
        world.dirtyTerrain = null;
        this._uploadHeights();
        V.paths = -1; V.scenery = -1; V.bld = -1;
        for (const tr of game.tracks) tr._meshVer = -1;
      }
      if (force || V.own !== world.ownerVer) { this._uploadOwnership(); V.own = world.ownerVer; }
      if (force || V.ground !== world.groundVer) { this._uploadGround(); V.ground = world.groundVer; }
      const pkey = world.pathVer + ':' + world.litterVer + ':' + world.addonVer;
      if (V.paths !== pkey) {
        const g = MX.Geom.paths(world);
        this.pathMesh = GLU.makeMeshVAO(gl, g.data, g.count, this.pathMesh);
        V.paths = pkey;
      }
      /* tracks */
      const live = new Set();
      for (const tr of game.tracks) {
        live.add(tr.id);
        let tm = this.trackMeshes.get(tr.id);
        const key = tr.ver + ':' + (tr.visualVer || 0) + ':' + (tr.gateDown ? 1 : 0);
        if (!tm || tm.key !== key || tr._meshVer === -1) {
          if (!tm) { tm = { main: null, gate: null, decor: null, decorKey: null }; this.trackMeshes.set(tr.id, tm); }
          const g = MX.Geom.track(tr, world, { highlight: game.selectedTrack === tr, decor: false });
          if (g) tm.main = GLU.makeMeshVAO(gl, g.data, g.count, tm.main); else if (tm.main) tm.main.count = 0;
          const gg = MX.Geom.startGate(tr, world, tr.gateDown);
          if (gg) tm.gate = GLU.makeMeshVAO(gl, gg.data, gg.count, tm.gate); else if (tm.gate) tm.gate.count = 0;
          /* stakes, walls and obstacles only change with the layout, not with wear or rain */
          if (tr._meshVer === -1) tm.decorGen = (tm.decorGen || 0) + 1;
          const dk = tr.ver + ':' + tr.type + ':' + (tm.decorGen || 0);
          if (tm.decorKey !== dk) {
            const d = MX.Geom.trackDecor(tr, world);
            if (d && d.count) tm.decor = GLU.makeMeshVAO(gl, d.data, d.count, tm.decor); else if (tm.decor) tm.decor.count = 0;
            tm.decorKey = dk;
          }
          tm.key = key; tr._meshVer = tr.ver;
        }
      }
      for (const [id, tm] of this.trackMeshes) if (!live.has(id)) { this._freeMesh(tm.main); this._freeMesh(tm.gate); if (tm.decor) this._freeMesh(tm.decor); this.trackMeshes.delete(id); }
      /* buildings */
      if (V.bld !== game.bldVer && MX.BuildModels) {
        const CH = MX.Geom.CH;
        const groups = new Map();
        for (const b of game.buildings.values()) {
          const k = Math.floor(b.tx / CH) + Math.floor(b.tz / CH) * this.nC;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(b);
        }
        const dirty = game.bldDirtyChunks;
        for (let k = 0; k < this.nC * this.nC; k++) {
          if (V.bld !== -1 && dirty && !dirty.has(k) && this.bldChunks.has(k)) continue;
          const list = groups.get(k);
          if (!list || !list.length) { if (this.bldChunks.has(k)) { this._freeMesh(this.bldChunks.get(k)); this.bldChunks.delete(k); } continue; }
          const mb = new MX.MeshBuilder(8192);
          for (const b of list) MX.BuildModels.build(mb, b, game);
          const g = mb.build();
          this.bldChunks.set(k, GLU.makeMeshVAO(gl, g.data, g.count, this.bldChunks.get(k)));
        }
        if (dirty) dirty.clear();
        V.bld = game.bldVer;
      }
      /* scenery: trees instanced, other decor merged */
      if (V.scenery !== world.sceneryVer) {
        this._buildScenery();
        V.scenery = world.sceneryVer;
      }
    }
    _buildScenery() {
      const world = this.game.world, gl = this.gl;
      const trees = { tree_pine: [], tree_oak: [], tree_poplar: [], tree_fir: [], tree_palm: [], tree_cactus: [], bush: [], rock: [] };
      const mb = new MX.MeshBuilder(8192);
      for (const o of world.scenery.values()) {
        const x = o.tx * T + o.ox, z = o.tz * T + o.oz;
        const y = world.heightAt(x, z);
        if (trees[o.type]) trees[o.type].push({ x, y, z, o });
        else if (MX.BuildModels && MX.BuildModels.decor) MX.BuildModels.decor(mb, o, x, y, z, this.game);
      }
      this.treeInst = trees;
      const g = mb.build();
      this.decorMesh = GLU.makeMeshVAO(gl, g.data, g.count, this.decorMesh);
      /* write static tree instance buffers */
      for (const k in trees) {
        const m = this.models[k];
        const list = trees[k];
        m.staticCount = Math.min(list.length, m.imax);
        for (let i = 0; i < m.staticCount; i++) {
          const t = list[i];
          const tint = this._treeTint(k, t.o);
          this._writeInst(m, i, t.x, t.y, t.z, t.o.rot, 0, 0, t.o.s, 1, tint, null, null, null);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, m.ibuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.iu8.subarray(0, m.staticCount * GLU.INST_BYTES));
      }
    }
    _treeTint(k, o) {
      const v = o.v || 0;
      const season = this.game ? this.game.seasonTint() : 0;
      if (k === 'rock') return [200 + v * 8, 198 + v * 6, 190 + v * 5, 255];
      if (k === 'tree_cactus') return [[160, 200, 140], [170, 210, 150], [150, 190, 135], [180, 205, 140]][v % 4];
      const base = [[150, 200, 120], [170, 215, 120], [130, 185, 110], [190, 205, 115]][v % 4];
      /* evergreens (firs and palms) hardly change with the seasons */
      const sk = k === 'tree_fir' || k === 'tree_palm' ? 0.3 : 1;
      return [U.clamp(base[0] + season * 60 * sk, 0, 255), U.clamp(base[1] - season * 25 * sk, 0, 255), U.clamp(base[2] - season * 35 * sk, 0, 255), 255];
    }
    _writeInst(m, i, x, y, z, yaw, pitch, roll, scale, flags, a, b, c, d) {
      const f = m.if32, u8 = m.iu8, o = i * (GLU.INST_BYTES / 4), ob = i * GLU.INST_BYTES + 32;
      f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = yaw; f[o + 4] = pitch; f[o + 5] = roll; f[o + 6] = scale; f[o + 7] = flags;
      const w = (off, col) => {
        if (!col) { u8[ob + off] = 255; u8[ob + off + 1] = 255; u8[ob + off + 2] = 255; u8[ob + off + 3] = 255; return; }
        u8[ob + off] = col[0]; u8[ob + off + 1] = col[1]; u8[ob + off + 2] = col[2]; u8[ob + off + 3] = 255;
      };
      w(0, a); w(4, b); w(8, c); w(12, d);
    }

    /* ---------- dynamic instances ---------- */
    beginInstances() {
      for (const k in this.models) { const m = this.models[k]; m.icount = 0; }
      this.spriteCount = 0;
    }
    pushInst(model, x, y, z, yaw, pitch, roll, scale, a, b, c, d) {
      const m = this.models[model];
      if (!m) return;
      const base = m.staticCount || 0;
      if (base + m.icount >= m.imax) return;
      this._writeInst(m, base + m.icount++, x, y, z, yaw, pitch, roll, scale, 0, a, b, c, d);
    }
    pushSprite(x, y, z, sw, sh, region, r, g, b, a, rot) {
      if (this.spriteCount >= this.spriteMax) return;
      const reg = typeof region === 'string' ? MX.Tex.regions[region] : region;
      if (!reg) return;
      const i = this.spriteCount++;
      const f = this.spriteF, o = i * (this.spriteStride / 4);
      f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = sw; f[o + 4] = sh;
      f[o + 5] = reg.uv[0]; f[o + 6] = reg.uv[1]; f[o + 7] = reg.uv[2]; f[o + 8] = reg.uv[3]; f[o + 9] = rot || 0;
      const ob = i * this.spriteStride + 40;
      this.spriteU8[ob] = r; this.spriteU8[ob + 1] = g; this.spriteU8[ob + 2] = b; this.spriteU8[ob + 3] = a;
    }
    inView(x, y, z, margin) {
      const p = this.cam.project(x, y, z, this._pv || (this._pv = {}));
      const m = margin || 40;
      return p.x > -m && p.y > -m && p.x < this.cam.w + m && p.y < this.cam.h + m;
    }

    /* ---------- overlays (ghosts, markers) ---------- */
    setGhostMesh(data, count, tint, dither) {
      if (!data || !count) { this.ghost = null; return; }
      this.ghostMesh = GLU.makeMeshVAO(this.gl, data, count, this.ghostMesh);
      this.ghost = { tint, dither: dither || 0.72 };
    }
    setOverlayMesh(data, count) {
      if (!data || !count) { this.overlayCount = 0; return; }
      this.overlayMesh = GLU.makeMeshVAO(this.gl, data, count, this.overlayMesh);
      this.overlayCount = count;
    }

    /* ---------- lighting from weather ---------- */
    lighting() {
      const g = this.game;
      const w = g && g.weatherDef ? g.weatherDef() : MX.Catalog.weather.sunny;
      const k = w.light;
      const sun = [1.0 * k, 0.94 * k, 0.82 * k];
      const amb = [0.52 + 0.05 * (1 - k), 0.56, 0.66];
      const sd = [-0.52, 0.74, -0.42];
      const l = Math.hypot(sd[0], sd[1], sd[2]);
      return { sun, amb: amb.map(v => v * (0.75 + 0.25 * k)), dir: [sd[0] / l, sd[1] / l, sd[2] / l], cloud: g ? g.cloudCover() : 0.3, wet: g ? g.wetness() : 0 };
    }

    _shadowMatrices(L) {
      const cam = this.cam;
      const world = this.game.world;
      const hr = world.heightRange();
      /* ground footprint of the view */
      const pts = [];
      for (const [sx, sy] of [[0, 0], [cam.w, 0], [0, cam.h], [cam.w, cam.h]]) {
        const r = cam.ray(sx, sy);
        for (const hy of [hr.min - 1, hr.max + 12]) {
          const t = (hy - r.oy) / r.dy;
          pts.push([r.ox + r.dx * t, hy, r.oz + r.dz * t]);
        }
      }
      let cx = 0, cy = 0, cz = 0;
      for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
      cx /= pts.length; cy /= pts.length; cz /= pts.length;
      const view = M4.create();
      M4.lookAt(view, cx + L.dir[0] * 400, cy + L.dir[1] * 400, cz + L.dir[2] * 400, cx, cy, cz, 0, 1, 0);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of pts) {
        const v = M4.transform(view, p[0], p[1], p[2]);
        minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
        minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
        minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
      }
      /* snap to shadow texels to avoid swimming */
      const size = Math.max(maxX - minX, maxY - minY) + 8;
      const texel = size / this.shadowRes;
      const mx = Math.floor((minX + maxX) / 2 / texel) * texel, my = Math.floor((minY + maxY) / 2 / texel) * texel;
      const proj = M4.create();
      M4.ortho(proj, mx - size / 2, mx + size / 2, my - size / 2, my + size / 2, 1, 900);
      M4.mul(this.lightVP, proj, view);
    }

    _setLightUniforms(p, L) {
      const gl = this.gl, u = p.u;
      gl.uniform3fv(u.uSunDir, L.dir); gl.uniform3fv(u.uSunCol, L.sun); gl.uniform3fv(u.uAmb, L.amb);
      if (u.uShadowMat) gl.uniformMatrix4fv(u.uShadowMat, false, this.lightVP);
      gl.uniform1f(u.uShadowOn, this.shadows ? 1 : 0);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uCloud, L.cloud > 0.05 ? 0.45 : 0);
      gl.uniform1f(u.uCloudThr, 1.0 - L.cloud * 0.55);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.shadowTarget.depth); gl.uniform1i(u.uShadowTex, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.noiseTex); gl.uniform1i(u.uNoise, 3);
    }
    _bindMats(p) {
      const gl = this.gl, u = p.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.matTex); if (u.uMats) gl.uniform1i(u.uMats, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.atlasTex); if (u.uAtlas) gl.uniform1i(u.uAtlas, 1);
    }
    _drawMesh(m) {
      if (!m || !m.count) return;
      const gl = this.gl;
      gl.bindVertexArray(m.vao);
      gl.drawArrays(gl.TRIANGLES, 0, m.count);
      this.stats.draws++; this.stats.tris += m.count / 3;
    }
    _drawInstanced(m, count) {
      if (!m || !count) return;
      const gl = this.gl;
      gl.bindVertexArray(m.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, count);
      this.stats.draws++; this.stats.tris += m.count / 3 * count;
    }
    _staticMeshes() {
      const list = [];
      for (const m of this.chunks) if (m) list.push(['terrain', m]);
      if (this.skirtMesh) list.push(['terrain', this.skirtMesh]);
      if (this.pathMesh) list.push(['mesh', this.pathMesh]);
      for (const [, tm] of this.trackMeshes) { if (tm.main) list.push(['mesh', tm.main]); if (tm.gate) list.push(['mesh', tm.gate]); if (tm.decor) list.push(['mesh', tm.decor]); }
      for (const [, m] of this.bldChunks) list.push(['mesh', m]);
      if (this.decorMesh) list.push(['mesh', this.decorMesh]);
      return list;
    }

    render(dt) {
      if (!this.ready || !this.game || this.lost) return;
      const gl = this.gl, cam = this.cam;
      this.time += dt;
      this.stats.draws = 0; this.stats.tris = 0;
      cam.update(dt);
      this.sync(false);
      const L = this.lighting();
      /* upload dynamic instances */
      for (const k in this.models) {
        const m = this.models[k];
        const total = (m.staticCount || 0) + m.icount;
        if (m.icount) {
          /* dynamic instances are appended after the static ones */
          const off = (m.staticCount || 0) * GLU.INST_BYTES;
          gl.bindBuffer(gl.ARRAY_BUFFER, m.ibuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, off, m.iu8.subarray(off, off + m.icount * GLU.INST_BYTES));
        }
        m.total = total;
      }
      /* ---- shadow pass ---- */
      if (this.shadows) {
        this._shadowMatrices(L);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowTarget.fb);
        gl.viewport(0, 0, this.shadowRes, this.shadowRes);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2.0, 3.0);
        let p = this.progs.shadow;
        gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uViewProj, false, this.lightVP);
        for (const [kind, m] of this._staticMeshes()) { void kind; this._drawMesh(m); }
        p = this.progs.shadowInst;
        gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uViewProj, false, this.lightVP);
        for (const k in this.models) { const m = this.models[k]; if (m.total) this._drawInstanced(m, m.total); }
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
      /* ---- main pass ---- */
      const mt = this.mainTarget;
      gl.bindFramebuffer(gl.FRAMEBUFFER, mt.fb);
      gl.viewport(0, 0, mt.w, mt.h);
      const sky = this.skyColor(L);
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      const world = this.game.world;
      /* terrain */
      let p = this.progs.terrain;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.u.uViewProj, false, cam.viewProj);
      this._setLightUniforms(p, L); this._bindMats(p);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.ownTex); gl.uniform1i(p.u.uOwn, 4);
      gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, this.groundTex); gl.uniform1i(p.u.uGroundTex, 6); gl.uniform1i(p.u.uTiles, world.N);
      gl.uniform4fv(p.u.uBrush, this.brush); gl.uniform4fv(p.u.uBrushCol, this.brushCol);
      gl.uniform1f(p.u.uGrid, this.grid ? 1 : 0); gl.uniform1f(p.u.uShowLand, this.showLand ? 1 : 0);
      gl.uniform1f(p.u.uMapSize, world.N * T); gl.uniform1f(p.u.uWater, C.WATER_LEVEL);
      gl.uniform1f(p.u.uRock, MX.Tex.L.rock); gl.uniform1f(p.u.uSand, MX.Tex.L.sand); gl.uniform1f(p.u.uWet, L.wet);
      for (const m of this.chunks) this._drawMesh(m);
      this._drawMesh(this.skirtMesh);
      /* other static meshes */
      p = this.progs.mesh;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.u.uViewProj, false, cam.viewProj);
      this._setLightUniforms(p, L); this._bindMats(p);
      gl.uniform4f(p.u.uGhost, 0, 0, 0, 0);
      for (const [kind, m] of this._staticMeshes()) if (kind === 'mesh') this._drawMesh(m);
      /* instanced */
      p = this.progs.inst;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.u.uViewProj, false, cam.viewProj);
      this._setLightUniforms(p, L); this._bindMats(p);
      gl.uniform4f(p.u.uGhost, 0, 0, 0, 0);
      for (const k in this.models) { const m = this.models[k]; if (m.total) this._drawInstanced(m, m.total); }
      /* water */
      p = this.progs.water;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.u.uViewProj, false, cam.viewProj);
      this._setLightUniforms(p, L);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.heightTex); gl.uniform1i(p.u.uHeights, 5);
      gl.uniform1f(p.u.uMapSize, world.N * T); gl.uniform1f(p.u.uVerts, world.V); gl.uniform1f(p.u.uWater, C.WATER_LEVEL);
      gl.bindVertexArray(this.waterVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      /* sprites (particles, icons) */
      if (this.spriteCount) {
        p = this.progs.sprite;
        gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uViewProj, false, cam.viewProj);
        gl.uniform3fv(p.u.uRight, cam.right); gl.uniform3fv(p.u.uUp, cam.up);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.atlasTex); gl.uniform1i(p.u.uAtlas, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.spriteU8.subarray(0, this.spriteCount * this.spriteStride));
        gl.bindVertexArray(this.spriteVao);
        gl.depthMask(false);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.spriteCount);
        gl.depthMask(true);
      }
      /* ghost preview */
      if (this.ghost) {
        p = this.progs.mesh;
        gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uViewProj, false, cam.viewProj);
        this._setLightUniforms(p, L); this._bindMats(p);
        gl.uniform4fv(p.u.uGhost, this.ghost.tint);
        gl.uniform1f(p.u.uGhostDither, this.ghost.dither);
        this._drawMesh(this.ghostMesh);
        gl.uniform4f(p.u.uGhost, 0, 0, 0, 0);
      }
      if (this.overlayCount) {
        p = this.progs.mesh;
        gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uViewProj, false, cam.viewProj);
        this._setLightUniforms(p, L); this._bindMats(p);
        gl.uniform4f(p.u.uGhost, 0, 0, 0, 0);
        gl.disable(gl.DEPTH_TEST);
        this._drawMesh(this.overlayMesh);
        gl.enable(gl.DEPTH_TEST);
      }
      /* ---- post ---- */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.disable(gl.DEPTH_TEST);
      p = this.progs.post;
      gl.useProgram(p.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mt.color); gl.uniform1i(p.u.uColor, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mt.depth); gl.uniform1i(p.u.uDepth, 1);
      gl.uniform2f(p.u.uTexel, 1 / mt.w, 1 / mt.h);
      gl.uniform1f(p.u.uNear, 1); gl.uniform1f(p.u.uFar, 1500);
      gl.uniform1f(p.u.uOutline, this.outline ? 1 : 0);
      gl.uniform1f(p.u.uThr, 0.9);
      const tint = this.game.screenTint ? this.game.screenTint() : [1, 1, 1];
      gl.uniform3fv(p.u.uTint, tint);
      gl.uniform1f(p.u.uFlash, this.flash);
      this.flash = Math.max(0, this.flash - dt * 2.5);
      gl.bindVertexArray(this.emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST);
    }
    skyColor(L) {
      const k = L.sun[0];
      return [0.36 * k + 0.12, 0.56 * k + 0.12, 0.72 * k + 0.14];
    }

    /* ---------- picking ---------- */
    pickGround(cssX, cssY) {
      const [rx, ry] = this.cssToRender(cssX, cssY);
      const r = this.cam.ray(rx, ry);
      return this.game.world.raycast(r.ox, r.oy, r.oz, r.dx, r.dy, r.dz);
    }
    worldToCss(x, y, z) {
      const p = this.cam.project(x, y, z, this._pw || (this._pw = {}));
      return [p.x * this.cssScale, p.y * this.cssScale, p.d];
    }
    rayAABB(cssX, cssY, minx, miny, minz, maxx, maxy, maxz) {
      const [rx, ry] = this.cssToRender(cssX, cssY);
      const r = this.cam.ray(rx, ry);
      let t0 = 0, t1 = 1e9;
      const o = [r.ox, r.oy, r.oz], d = [r.dx, r.dy, r.dz], mn = [minx, miny, minz], mx = [maxx, maxy, maxz];
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return -1; continue; }
        let a = (mn[i] - o[i]) / d[i], b = (mx[i] - o[i]) / d[i];
        if (a > b) { const t = a; a = b; b = t; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) return -1;
      }
      return t0;
    }
    /* Render a small thumbnail of a mesh (build menu icons, a rider on their bike);
       dir: direction from the target to the camera, isometric by default. */
    thumbnail(data, count, size, center, radius, dir) {
      const gl = this.gl;
      const tgt = GLU.makeTarget(gl, size, size, true);
      const mesh = GLU.makeMeshVAO(gl, data, count);
      const view = M4.create(), proj = M4.create(), vp = M4.create();
      const d = dir || [0.612, 0.5, 0.612];
      M4.lookAt(view, center[0] + d[0] * 100, center[1] + d[1] * 100, center[2] + d[2] * 100, center[0], center[1], center[2], 0, 1, 0);
      M4.ortho(proj, -radius, radius, -radius, radius, 1, 300);
      M4.mul(vp, proj, view);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tgt.fb);
      gl.viewport(0, 0, size, size);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      const p = this.progs.mesh;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.u.uViewProj, false, vp);
      const L = { sun: [1, 0.95, 0.85], amb: [0.55, 0.57, 0.65], dir: [-0.52 / 1.0, 0.74, -0.42], cloud: 0 };
      const was = this.shadows; this.shadows = false;
      this._setLightUniforms(p, L); this._bindMats(p);
      this.shadows = was;
      gl.uniform4f(p.u.uGhost, 0, 0, 0, 0);
      this._drawMesh(mesh);
      const px = new Uint8Array(size * size * 4);
      gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this._freeMesh(mesh);
      gl.deleteTexture(tgt.color); gl.deleteTexture(tgt.depth); gl.deleteFramebuffer(tgt.fb);
      const c = document.createElement('canvas'); c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      ctx.putImageData(img, 0, 0);
      return c.toDataURL();
    }
  }

  MX.Renderer = Renderer;
  MX.Camera = Camera;
})(window.MX);
