/* MX Tycoon - interactive tools: selection, track drawing and editing, track features,
   surfaces, widths and elevation, buildings, paths, decorations, terrain, land and
   demolition. Tools receive picked world points and produce previews and commands. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U, Cat = MX.Catalog, MB = MX.MeshBuilder;
  const T = C.TILE;

  const app = () => MX.App;
  const game = () => MX.App.game;
  const R = () => MX.App.renderer;

  function toast(msg, kind) { MX.App.hud && MX.App.hud.toast(msg, kind); }
  function sfx(name) { MX.Audio && MX.Audio.sfx(name); }
  function result(r, okMsg) {
    if (!r) return false;
    if (r.ok === false) { toast(r.reason || 'No se puede', 'bad'); sfx('error'); return false; }
    if (okMsg) toast(okMsg, 'good');
    return true;
  }
  function tileOf(p) { return { tx: Math.floor(p.x / T), tz: Math.floor(p.z / T) }; }
  /* does a screen point fall on a world box? (projected corners plus a margin for fingers) */
  function onScreenBox(css, b, m) {
    if (!css || !b) return false;
    let ax = 1e9, ay = 1e9, bx = -1e9, by = -1e9;
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
      const q = R().worldToCss(x, y, z);
      ax = Math.min(ax, q[0]); bx = Math.max(bx, q[0]); ay = Math.min(ay, q[1]); by = Math.max(by, q[1]);
    }
    return css.x >= ax - m && css.x <= bx + m && css.y >= ay - m && css.y <= by + m;
  }
  /* Placing tools on touch screens (preview: true): a tap moves the preview, a finger
     on it drags it, and a tap on it or the «Colocar» button places it. They start with
     the preview in the middle of the free part of the map. */
  function previewAtCenter(tool) {
    if (!app().input || !app().input.touchMode) return;
    setTimeout(() => {
      if (Tools.current !== tool) return;
      const c = app().freeCenter();
      if (c) { tool.lastP = c; tool.hover(c); }
    }, 80);
  }
  const touchMode = () => !!(app().input && app().input.touchMode);

  /* translate a mesh (array copy) by an offset */
  function translated(mesh, dx, dy, dz) {
    const S = MX.GL.STRIDE;
    const out = new Float32Array(mesh.data.length);
    out.set(mesh.data);
    for (let i = 0; i < mesh.count; i++) { out[i * S] += dx; out[i * S + 1] += dy; out[i * S + 2] += dz; }
    return { data: out, count: mesh.count };
  }
  /* flat overlay quad following terrain over a tile */
  function tileQuad(mb, tx, tz, colr, lift) {
    const w = game().world;
    const l = lift || 0.12;
    const h = (x, z) => w.vh(x, z) + l;
    const x0 = tx * T, z0 = tz * T, x1 = x0 + T, z1 = z0 + T;
    mb.quad4([x0, h(tx, tz), z0], [x0, h(tx, tz + 1), z1], [x1, h(tx + 1, tz + 1), z1], [x1, h(tx + 1, tz), z0], [0, 0], [0, 1], [1, 1], [1, 0], MB.MAT_SOLID, colr);
  }
  /* outline of a footprint on the ground; overlays draw on top of everything, so it shows
     through trees and makes a green preview easy to see on grass */
  function footprintMesh(tx, tz, w, h, colr) {
    const mb = new MB(2048), wd = game().world, e = 0.6;
    const strip = (xa, za, xb, zb) => {
      const y = (x, z) => wd.heightAt(x, z) + 0.15;
      mb.quad4([xa, y(xa, za), za], [xa, y(xa, zb), zb], [xb, y(xb, zb), zb], [xb, y(xb, za), za], [0, 0], [0, 1], [1, 1], [1, 0], MB.MAT_SOLID, colr);
    };
    const x0 = tx * T, z0 = tz * T, x1 = (tx + w) * T, z1 = (tz + h) * T;
    for (let i = 0; i < w; i++) { const xa = x0 + i * T; strip(xa, z0, xa + T, z0 + e); strip(xa, z1 - e, xa + T, z1); }
    for (let j = 0; j < h; j++) { const za = z0 + j * T; strip(x0, za, x0 + e, za + T); strip(x1 - e, za, x1, za + T); }
    return mb.build();
  }
  function marker(mb, x, y, z, r, hgt, colr) {
    mb.cylinder(x, y, z, r, hgt, 6, MB.MAT_SOLID, colr);
    mb.cone(x, y + hgt, z, r * 1.6, r * 2.2, 6, MB.mulCol(colr, 1.1));
  }
  function ringMesh(mb, x, y, z, r, colr) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const p = (a, rr) => [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr];
      mb.quad(p(a0, r), p(a0, r + 0.25), p(a1, r + 0.25), p(a1, r), null, MB.MAT_SOLID, colr);
    }
  }
  function trackRegionMesh(mb, tr, s0, len, colr) {
    if (!tr.S) return;
    const S = tr.S;
    const step = 1;
    let prev = null;
    for (let d = 0; d <= len; d += step) {
      const s = tr.wrapS(s0 + d);
      const i = tr.sIndex(s);
      const hw = S.w[i] * 0.5 + 0.3;
      const hdg = S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
      const a = [S.x[i] - nx * hw, S.y[i] + tr.bankAt(i, -hw) + 0.25, S.z[i] - nz * hw];
      const b = [S.x[i] + nx * hw, S.y[i] + tr.bankAt(i, hw) + 0.25, S.z[i] + nz * hw];
      if (prev) mb.quad4(prev[0], prev[1], b, a, [0, 0], [1, 0], [1, 1], [0, 1], MB.MAT_SOLID, colr);
      prev = [a, b];
    }
  }

  /* ================= tools ================= */
  const Tools = {
    current: null,
    labels: [],
    set(tool) {
      if (this.current && this.current.exit) this.current.exit();
      this.current = tool;
      const r = R();
      if (r) { r.setGhostMesh(null); r.setOverlayMesh(null); r.brush = [0, 0, 0, 0]; r.showLand = false; r.grid = app().settings.grid; }
      if (tool && tool.enter) tool.enter();
      MX.Bus.emit('tool', tool ? tool.name : null);
      app().hud && app().hud.setHint(tool && tool.hint ? tool.hint : '');
    },
    select() { this.set(SelectTool); },
    is(name) { return this.current && this.current.name === name; }
  };

  /* -------- Select -------- */
  const SelectTool = {
    name: 'select',
    hint: '',
    hoverAgent: null,
    enter() { this.hoverAgent = null; },
    hover(p, css) {
      const a = app().pickAgent(css.x, css.y);
      this.hoverAgent = a;
      app().hoverAgent = a;
    },
    click(p, e, css) {
      const a = app().pickAgent(css.x, css.y);
      if (a) { app().panels.agent(a); sfx('click'); return; }
      const b = app().pickBuilding(css.x, css.y);
      if (b) { app().panels.building(b); sfx('click'); return; }
      if (p) {
        for (const tr of game().tracks) {
          if (!tr.S) continue;
          const r = tr.nearestS(p.x, p.z);
          if (r && r.dist < tr.S.w[r.i] * 0.5 + 1) { game().selectedTrack = tr; app().panels.tracks(tr); sfx('click'); return; }
        }
      }
    },
    exit() { app().hoverAgent = null; }
  };

  /* -------- Piece-by-piece track construction -------- */
  function joinMeshes(list) {
    const St = MX.GL.STRIDE;
    let n = 0;
    for (const m of list) if (m) n += m.count;
    const out = new Float32Array(Math.max(1, n) * St);
    let o = 0;
    for (const m of list) if (m) { out.set(m.data.subarray(0, m.count * St), o * St); o += m.count; }
    return { data: out, count: n };
  }
  function probeMesh(tmp) {
    if (!tmp || !tmp.S) return null;
    const w = game().world;
    return joinMeshes([MX.Geom.track(tmp, w, { ghost: true }), tmp.pieces[0].t === 'start' ? MX.Geom.startGate(tmp, w, false) : null]);
  }
  const GHOST_OK = [0.35, 1, 0.45, 0.42], GHOST_CLOSE = [1, 0.85, 0.2, 0.45], GHOST_BAD = [1, 0.22, 0.15, 0.55], GHOST_DITHER = 0.56;
  /* buildings and decorations: light enough to stand out on grass */
  const GHOST_B_OK = [0.7, 1, 0.75, 0.5], GHOST_B_WARN = [1, 0.85, 0.2, 0.45], GHOST_B_BAD = [1, 0.2, 0.15, 0.5], GHOST_B_DITHER = 0.82;

  /* Place the start straight: the cursor marks the gate, R turns it in 45 degree steps. */
  const TrackStart = {
    name: 'trackstart', h: 0, preview: true,
    get hint() { return 'Clic: colocar la parrilla de salida · R o clic derecho: girar · Esc: salir'; },
    get tr() { return game().selectedTrack; },
    enter() { this.lat = null; this.probe = null; this.center = null; previewAtCenter(this); },
    exit() { R().setGhostMesh(null); this.probe = null; },
    hover(p) {
      if (!p) return;
      this.center = { x: p.x, z: p.z };
      this.locate();
    },
    /* the start straight is centred on the cursor */
    locate() {
      const c = this.center;
      if (!c) return;
      const Tr = MX.Track, n = Tr.pieceUnits(Tr.startPiece(this.tr ? this.tr.type : 'mx', 8, 'dirt'), this.h), v = Tr.DIRV[this.h];
      const lx = Math.round(c.x / T - v[0] * n / 2), lz = Math.round(c.z / T - v[1] * n / 2);
      if (this.lat && this.lat.x === lx && this.lat.z === lz && this.lat.h === this.h) return;
      this.lat = { x: lx, z: lz, h: this.h };
      this.refresh();
    },
    refresh() {
      const l = this.lat, tr = this.tr;
      if (!l || !tr || !tr.pieces) return;
      const ui = app().trackUI;
      this.probe = tr.probeStart(game().world, l.x, l.z, l.h, ui.width, ui.surface);
      const m = probeMesh(this.probe.tmp);
      if (m) R().setGhostMesh(m.data, m.count, this.probe.ok ? (this.probe.warn ? GHOST_CLOSE : GHOST_OK) : GHOST_BAD, GHOST_DITHER);
    },
    /* touch: a finger on the gate drags it */
    grab(p) {
      const pr = this.probe, S = pr && pr.tmp && pr.tmp.S;
      if (!S || !p || !this.center) return false;
      const hit = pr.tmp.nearestS(p.x, p.z);
      if (!hit || hit.dist > S.w[hit.i] * 0.5 + 3) return false;
      this.grabOff = { x: p.x - this.center.x, z: p.z - this.center.z };
      return true;
    },
    dragTo(p) { if (p) this.hover({ x: p.x - this.grabOff.x, z: p.z - this.grabOff.z }); },
    placement() {
      const pr = this.probe;
      if (!pr || !pr.tmp) return null;
      return { ok: pr.ok, warn: pr.ok && !!pr.warn, text: pr.ok ? U.fmtMoney(pr.cost) : pr.reason };
    },
    emptyText: 'Toca tu terreno para ver la parrilla',
    click() { this.place(); },
    place() {
      const l = this.lat, tr = this.tr;
      if (!l || !tr) return;
      const ui = app().trackUI;
      if (result(game().placeStart(tr, l.x, l.z, l.h, ui.width, ui.surface))) {
        sfx('build');
        app().fx.burst((l.x + MX.Track.DIRV[l.h][0] * 4) * T, null, (l.z + MX.Track.DIRV[l.h][1] * 4) * T, 'dirt');
        Tools.set(TrackBuild);
        app().panels.tracks(tr);
        toast('Ahora elige dirección y pendiente y construye pieza a pieza', 'info');
      }
    },
    rotate() { this.h = (this.h + 1) % 8; this.locate(); sfx('click'); },
    rightClick() { this.rotate(); },
    key(e) { if (e.key === 'r' || e.key === 'R') { this.rotate(); return true; } return false; },
    labels() {
      const pr = this.probe;
      if (!pr || !pr.tmp || !pr.tmp.S) return [];
      const S = pr.tmp.S, i = Math.min(S.n - 1, Math.round(MX.Track.gateOff(pr.tmp.pieces[0]) / C.TRACK_DS));
      return [{ x: S.x[i], y: S.y[i] + 5, z: S.z[i], text: pr.ok ? 'Parrilla de salida · ' + U.fmtMoney(pr.cost) + (pr.warn ? ' · ' + pr.warn : '') : pr.reason, bad: !pr.ok, warn: pr.ok && !!pr.warn }];
    }
  };

  /* Build the next piece from the end of the circuit, like a ride construction window. */
  const BUILD_ORDER = ['L1', 'L2', 'L3', 'S', 'R3', 'R2', 'R1'];
  const TrackBuild = {
    name: 'trackbuild',
    hint: 'Elige dirección y pendiente · Intro o clic en la pieza fantasma: construir · Retroceso: quitar la última · Flechas: dirección y pendiente · Esc: salir',
    get tr() { return game().selectedTrack; },
    enter() { this.refresh(); this.frame(); },
    exit() { R().setGhostMesh(null); R().setOverlayMesh(null); this.probe = null; },
    piece() { return MX.Panels1.currentPiece(); },
    /* keep the construction point in sight, above the panel */
    frame() {
      const tr = this.tr, e = tr && tr.endPose;
      if (!e || tr.closed) return;
      const x = e.x * T, z = e.z * T;
      setTimeout(() => app().frameWorld(x, (tr.S ? tr.S.y[tr.S.n - 1] : game().world.heightAt(x, z)), z), 60);
    },
    refresh() {
      const tr = this.tr;
      this.probe = null;
      if (!tr || !tr.pieces || !tr.pieces.length || tr.closed) { R().setGhostMesh(null); R().setOverlayMesh(null); return; }
      const pr = tr.probePiece(game().world, this.piece());
      this.probe = pr;
      const m = probeMesh(pr.tmp);
      if (m) R().setGhostMesh(m.data, m.count, pr.ok ? (pr.closes ? GHOST_CLOSE : GHOST_OK) : GHOST_BAD, GHOST_DITHER);
      else R().setGhostMesh(null);
      /* target ring at the start, joints between pieces and an arrow at the construction point */
      const mb = new MB(8192), w = game().world, o = tr.origin, e = tr.endPose;
      if (tr.S) for (let i = 1; i < tr.pieces.length; i++) { const s0 = tr.pieces[i]._s0; if (s0 != null) trackRegionMesh(mb, tr, s0 - 0.5, 1, MB.rgba('#fff2c4')); }
      if (o && e) {
        const ox = o.x * T, oz = o.z * T, ex = e.x * T, ez = e.z * T;
        if (Math.hypot(ex - ox, ez - oz) > 2) ringMesh(mb, ox, w.heightAt(ox, oz) + 0.35, oz, 3.2, MB.rgba('#ffd22e'));
        const ey = (tr.S ? tr.S.y[tr.S.n - 1] : w.heightAt(ex, ez)) + 0.4;
        marker(mb, ex, ey, ez, 0.35, 2.2, pr.ok ? MB.rgba('#ffffff') : MB.rgba('#ff6b5b'));
      }
      const ov = mb.build();
      R().setOverlayMesh(ov.data, ov.count);
    },
    hover(p) { this.cursor = p; },
    click(p) {
      const pr = this.probe;
      if (!pr || !pr.tmp || !pr.tmp.S || !p) return;
      const r = pr.tmp.nearestS(p.x, p.z);
      if (r && r.dist < pr.tmp.S.w[r.i] * 0.5 + 2) this.build();
    },
    build() {
      const tr = this.tr;
      if (!tr) return;
      const r = game().buildPiece(tr, this.piece());
      if (result(r)) {
        sfx('build');
        if (r.closes) this.closed(tr, r.adjusted ? 'He ajustado la pendiente del último tramo para llegar a la salida a su altura.' : null);
      }
      this.refresh();
      app().panels.tracks();
      this.frame();
    },
    closed(tr, note) {
      sfx('success');
      toast('¡Circuito cerrado!' + (note ? ' ' + note : '') + ' Revisa los elementos, valida y ábrelo al público.', 'good');
      app().trackUI.section = 'features';
      Tools.set(TrackFeature);
      MX.WM.rebuild('tracks');
      MX.WM.setSheet('tracks', 'half');
    },
    undo() {
      const tr = this.tr;
      if (!tr) return;
      if (result(game().removeLastPiece(tr))) sfx('demolish');
      this.refresh();
      app().panels.tracks();
      this.frame();
    },
    auto() {
      const tr = this.tr, ui = app().trackUI;
      if (!tr) return;
      const r = game().autoComplete(tr, ui.width, ui.surface);
      if (result(r)) this.closed(tr, r.replaced ? 'He rehecho ' + (r.replaced === 1 ? 'la última pieza' : 'las últimas ' + r.replaced + ' piezas') + ' y añadido ' + r.added + ' para unirlo con la salida.' : 'He añadido ' + r.added + (r.added === 1 ? ' pieza.' : ' piezas.'));
      this.refresh();
    },
    key(e) {
      const b = MX.Panels1.buildState();
      if (e.key === 'Enter') { this.build(); return true; }
      if (e.key === 'Backspace' || e.key === 'Delete') { this.undo(); return true; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const i = BUILD_ORDER.indexOf(b.special ? 'S' : b.dir);
        b.special = null;
        b.dir = BUILD_ORDER[U.clamp(i + (e.key === 'ArrowLeft' ? -1 : 1), 0, BUILD_ORDER.length - 1)];
        this.changed(); return true;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        b.special = null;
        b.slope = U.clamp((b.slope || 0) + (e.key === 'ArrowUp' ? 1 : -1), -2, 2);
        this.changed(); return true;
      }
      return false;
    },
    changed() { sfx('click'); MX.WM.rebuild('tracks'); this.refresh(); },
    labels() {
      const tr = this.tr, pr = this.probe, out = [];
      if (pr && pr.tmp && pr.tmp.S) {
        const S = pr.tmp.S, i = Math.floor(S.n / 2);
        out.push({ x: S.x[i], y: S.y[i] + 4, z: S.z[i], text: pr.ok ? (pr.closes ? 'Cerrar circuito · ' : '') + U.fmtMoney(pr.cost) : pr.reason, bad: !pr.ok, warn: pr.ok && pr.closes });
      }
      if (tr && tr.origin && tr.endPose && tr.length > 60) {
        const x = tr.origin.x * T, z = tr.origin.z * T;
        out.push({ x, y: game().world.heightAt(x, z) + 3, z, text: 'Salida' });
      }
      return out;
    }
  };

  /* -------- Track drawing (free-node circuits from old saves) -------- */
  const TrackDraw = {
    name: 'trackdraw',
    hint: 'Clic: añadir punto · Mantén y arrastra para dibujar · Clic en el primer punto: cerrar · Clic derecho o Retroceso: deshacer · Esc: salir',
    enter() { this.cursor = null; this.dragging = false; this.lastAdd = null; this.refresh(); },
    exit() { R().setGhostMesh(null); R().setOverlayMesh(null); },
    get tr() { return game().selectedTrack; },
    canNode(p) {
      const t = tileOf(p), w = game().world;
      if (!w.inBounds(t.tx, t.tz)) return 'Fuera del mapa';
      if (!w.owned[w.idx(t.tx, t.tz)]) return 'Terreno no comprado';
      if (w.isWater(t.tx, t.tz)) return 'Hay agua';
      if (w.bld[w.idx(t.tx, t.tz)] >= 0) return 'Hay un edificio';
      return null;
    },
    nearFirst(p) {
      const tr = this.tr;
      if (!tr || tr.nodes.length < 4) return false;
      const n = tr.nodes[0];
      return U.dist(n.x, n.z, p.x, p.z) < 6;
    },
    hover(p) {
      this.cursor = p;
      if (this.dragging && p && this.lastAdd && U.dist(p.x, p.z, this.lastAdd.x, this.lastAdd.z) > 7) this.addAt(p);
      this.refreshThrottled();
    },
    touchDraw: true,
    down(p, e) { if (e.button === 0 && p) { this.dragging = true; this.downAt = p; app().input.captureDrag = true; } },
    up(p, e) { if (e.button === 0) { this.dragging = false; app().input.captureDrag = false; } },
    cancelDrag() { this.dragging = false; },
    click(p, e) {
      if (!p) return;
      const tr = this.tr;
      if (!tr) return;
      if (this.nearFirst(p)) { this.close(); return; }
      if (this.lastAdd && U.dist(p.x, p.z, this.lastAdd.x, this.lastAdd.z) < 2) return;
      this.addAt(p);
    },
    rightClick() { this.undo(); },
    key(e) {
      if (e.key === 'Backspace' || e.key === 'Delete') { this.undo(); return true; }
      if (e.key === 'Enter') { this.close(); return true; }
      return false;
    },
    addAt(p) {
      const tr = this.tr;
      if (!tr) return;
      if (tr.closed) { toast('El trazado ya está cerrado: usa Editar puntos', 'info'); return; }
      const why = this.canNode(p);
      if (why) { toast(why, 'bad'); sfx('error'); return; }
      if (tr.nodes.length) {
        const l = tr.nodes[tr.nodes.length - 1];
        if (U.dist(l.x, l.z, p.x, p.z) < 3) return;
      }
      const w = app().trackUI.width, s = app().trackUI.surface;
      const r = game().editTrack(tr, (t) => { t.addNode(p.x, p.z, w, s); });
      if (result(r)) { this.lastAdd = { x: p.x, z: p.z }; sfx('place'); }
      this.refresh();
    },
    undo() {
      const tr = this.tr;
      if (!tr || !tr.nodes.length) return;
      if (tr.closed) { game().editTrack(tr, (t) => { t.closed = false; }); }
      else game().editTrack(tr, (t) => { t.nodes.pop(); });
      this.lastAdd = tr.nodes.length ? tr.nodes[tr.nodes.length - 1] : null;
      sfx('click');
      this.refresh();
    },
    close() {
      const tr = this.tr;
      if (!tr || tr.nodes.length < 4) { toast('Necesitas al menos 4 puntos', 'bad'); return; }
      const r = game().editTrack(tr, (t) => { t.closed = true; });
      if (result(r, '¡Trazado cerrado! Ahora añade parrilla, meta y saltos.')) {
        sfx('build');
        MX.Bus.emit('track:closed-loop', { track: tr });
        Tools.set(TrackEdit);
        app().panels.tracks(tr);
      }
    },
    _t: 0,
    refreshThrottled() {
      const now = performance.now();
      if (now - this._t < 40) return;
      this._t = now;
      this.refresh();
    },
    refresh() {
      const tr = this.tr;
      const mb = new MB(4096);
      if (tr) {
        tr.nodes.forEach((n, i) => {
          const y = game().world.heightAt(n.x, n.z);
          marker(mb, n.x, y, n.z, 0.45, 2.2, i === 0 ? MB.rgba(this.cursor && this.nearFirst(this.cursor) ? '#5cff6a' : '#ffd22e') : MB.rgba('#ff6a13'));
        });
      }
      if (this.cursor) {
        const ok = !this.canNode(this.cursor);
        const y = game().world.heightAt(this.cursor.x, this.cursor.z);
        ringMesh(mb, this.cursor.x, y + 0.2, this.cursor.z, 1.2, ok ? MB.rgba('#ffffff') : MB.rgba('#ff3b30'));
      }
      const o = mb.build();
      R().setOverlayMesh(o.data, o.count);
      /* rubber band preview: the track with the cursor as an extra node */
      if (tr && !tr.closed && this.cursor && tr.nodes.length >= 1) {
        const ghost = new MX.Track(-1, 'ghost');
        ghost.nodes = tr.nodes.map(n => Object.assign({}, n));
        ghost.addNode(this.cursor.x, this.cursor.z, app().trackUI.width, app().trackUI.surface);
        if (this.nearFirst(this.cursor)) { ghost.nodes.pop(); ghost.closed = true; }
        ghost.rebuild(game().world);
        const g = ghost.S ? MX.Geom.track(ghost, game().world, { ghost: true }) : null;
        if (g) R().setGhostMesh(g.data, g.count, [1, 0.85, 0.4, 0.35]); else R().setGhostMesh(null);
      } else R().setGhostMesh(null);
    },
    labels() {
      const tr = this.tr;
      if (!tr || !this.cursor) return [];
      const y = game().world.heightAt(this.cursor.x, this.cursor.z);
      const txt = this.nearFirst(this.cursor) ? 'Cerrar circuito' : (tr.nodes.length ? Math.round(tr.length) + ' m · ' + U.fmtMoney(tr.geometryCost()) : 'Primer punto');
      return [{ x: this.cursor.x, y: y + 3, z: this.cursor.z, text: txt }];
    }
  };

  /* -------- Track node editing -------- */
  const TrackEdit = {
    name: 'trackedit',
    hint: 'Arrastra un punto para moverlo · Clic en la pista: insertar punto · Supr: borrar el punto elegido · Esc: salir',
    enter() { this.sel = -1; this.drag = -1; this.refresh(); },
    exit() { R().setOverlayMesh(null); R().setGhostMesh(null); },
    get tr() { return game().selectedTrack; },
    nodeAt(p) {
      const tr = this.tr;
      if (!tr || !p) return -1;
      let best = -1, bd = 3.5 * 3.5;
      tr.nodes.forEach((n, i) => { const d = U.dist2(n.x, n.z, p.x, p.z); if (d < bd) { bd = d; best = i; } });
      return best;
    },
    hover(p) {
      this.cursor = p;
      if (this.drag >= 0 && p) {
        const tr = this.tr;
        const n = tr.nodes[this.drag];
        n.x = p.x; n.z = p.z;
        tr.rebuild(game().world);
        const g = MX.Geom.track(tr, game().world, { ghost: true });
        if (g) R().setGhostMesh(g.data, g.count, [1, 0.9, 0.4, 0.3]);
      }
      this.refresh();
    },
    down(p, e) {
      if (e.button !== 0 || !p) return;
      const tr = this.tr;
      if (tr && tr.state === 'open') return;
      const i = this.nodeAt(p);
      if (i >= 0) {
        this.drag = i; this.sel = i;
        this.snap = { x: tr.nodes[i].x, z: tr.nodes[i].z };
        app().input.captureDrag = true;
      }
    },
    up(p, e) {
      if (this.drag < 0) return;
      const tr = this.tr, i = this.drag;
      this.drag = -1;
      app().input.captureDrag = false;
      const nx = tr.nodes[i].x, nz = tr.nodes[i].z;
      tr.nodes[i].x = this.snap.x; tr.nodes[i].z = this.snap.z;
      tr.rebuild(game().world);
      if (U.dist(nx, nz, this.snap.x, this.snap.z) > 0.3) {
        if (TrackDraw.canNode({ x: nx, z: nz })) { toast(TrackDraw.canNode({ x: nx, z: nz }), 'bad'); sfx('error'); }
        else result(game().editTrack(tr, (t) => { t.nodes[i].x = nx; t.nodes[i].z = nz; }, true));
      }
      R().setGhostMesh(null);
      this.refresh();
      void p; void e;
    },
    cancelDrag() {
      if (this.drag < 0) return;
      const tr = this.tr, i = this.drag;
      this.drag = -1;
      tr.nodes[i].x = this.snap.x; tr.nodes[i].z = this.snap.z;
      tr.rebuild(game().world);
      R().setGhostMesh(null);
      this.refresh();
    },
    click(p) {
      const tr = this.tr;
      if (!tr || !p || this.drag >= 0) return;
      const i = this.nodeAt(p);
      if (i >= 0) { this.sel = i; this.refresh(); MX.Bus.emit('track:node', { i }); return; }
      if (tr.state === 'open') { toast('Cierra el circuito para modificarlo', 'info'); return; }
      if (!tr.S) return;
      const r = tr.nearestS(p.x, p.z);
      if (r && r.dist < tr.S.w[r.i] * 0.5 + 1.5) {
        const seg = tr.S.seg[r.i];
        result(game().editTrack(tr, (t) => { t.insertNode(seg + 1, tr.S.x[r.i], tr.S.z[r.i]); }, true));
        this.sel = seg + 1;
        sfx('place');
        this.refresh();
      }
    },
    key(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel >= 0) { this.removeSel(); return true; }
      return false;
    },
    removeSel() {
      const tr = this.tr;
      if (!tr || this.sel < 0) return;
      if (tr.closed && tr.nodes.length <= 4) { toast('Un circuito cerrado necesita al menos 4 puntos', 'bad'); return; }
      const i = this.sel;
      if (result(game().editTrack(tr, (t) => { t.removeNode(i); }, true))) { this.sel = -1; sfx('demolish'); }
      this.refresh();
    },
    refresh() {
      const tr = this.tr;
      const mb = new MB(4096);
      if (tr) tr.nodes.forEach((n, i) => {
        const y = game().world.heightAt(n.x, n.z) + n.elev;
        const hov = this.cursor && U.dist2(n.x, n.z, this.cursor.x, this.cursor.z) < 12;
        marker(mb, n.x, y, n.z, i === this.sel ? 0.6 : 0.45, 2.4, i === this.sel ? MB.rgba('#5cff6a') : hov ? MB.rgba('#ffffff') : MB.rgba('#ff6a13'));
      });
      const o = mb.build();
      R().setOverlayMesh(o.data, o.count);
    }
  };

  /* -------- Track features -------- */
  const TrackFeature = {
    name: 'trackfeature', preview: true,
    type: 'tabletop_m',
    get hint() { return 'Clic sobre la pista: colocar ' + Cat.features[this.type].name.toLowerCase() + ' (' + U.fmtMoney(Cat.features[this.type].cost) + ') · Esc: salir'; },
    enter() { this.check = null; this.refresh(); },
    exit() { R().setOverlayMesh(null); },
    get tr() { return game().selectedTrack; },
    hover(p) {
      const tr = this.tr;
      this.check = null;
      if (tr && tr.S && p) {
        const r = tr.nearestS(p.x, p.z);
        if (r && r.dist < tr.S.w[r.i] * 0.5 + 3) {
          const d = Cat.features[this.type];
          let s = r.s;
          if (d.kind !== 'berm' && d.kind !== 'finish' && d.kind !== 'start') s = tr.wrapS(r.s - (d.len || tr.featureLen(this.type, r.s)) / 2);
          this.check = Object.assign({ s }, tr.checkFeature(this.type, s));
          if (this.check.ok && !game().isUnlocked(d)) this.check = { ok: false, reason: 'Bloqueado', s0: this.check.s0, len: this.check.len };
        }
      }
      this.refresh();
    },
    /* touch: a finger on the highlighted stretch drags it along the track */
    grab(p) {
      const tr = this.tr, c = this.check;
      if (!tr || !tr.S || !p || !c || c.s0 == null) return false;
      const r = tr.nearestS(p.x, p.z);
      if (!r || r.dist > tr.S.w[r.i] * 0.5 + 4) return false;
      const ds = tr.wrapS(r.s - c.s0);
      return ds <= (c.len || 0) + 6 || ds >= tr.length - 6;
    },
    dragTo(p) { if (p) { this.lastP = p; this.hover(p); } },
    placement() {
      if (!this.check) return null;
      return { ok: this.check.ok, text: this.check.ok ? U.fmtMoney(Cat.features[this.type].cost) : this.check.reason };
    },
    emptyText: 'Toca el circuito donde lo quieras',
    click() { this.place(); },
    place() {
      const tr = this.tr;
      if (!tr || !this.check) return;
      if (tr.state === 'open') { toast('Cierra el circuito para modificarlo', 'info'); return; }
      if (!this.check.ok) { toast(this.check.reason, 'bad'); sfx('error'); return; }
      if (result(game().addFeature(tr, this.type, this.check.s))) { sfx('build'); app().fx.burst(this.cx, this.cy, this.cz, 'dirt'); MX.Bus.emit('track:feature', { type: this.type }); }
      /* on touch screens the preview goes away until the next tap */
      if (touchMode()) { this.check = null; this.refresh(); }
      else this.hover(this.lastP);
    },
    refresh() {
      const tr = this.tr;
      const mb = new MB(4096);
      if (tr && this.check && this.check.len != null) {
        trackRegionMesh(mb, tr, this.check.s0, Math.max(2, this.check.len), this.check.ok ? MB.rgba('#5cff6a') : MB.rgba('#ff3b30'));
        const i = tr.sIndex(this.check.s0 + this.check.len / 2);
        this.cx = tr.S.x[i]; this.cy = tr.S.y[i]; this.cz = tr.S.z[i];
      }
      const o = mb.build();
      R().setOverlayMesh(o.data, o.count);
    },
    labels() {
      if (!this.check || this.cx == null) return [];
      const d = Cat.features[this.type];
      return [{ x: this.cx, y: this.cy + 4, z: this.cz, text: this.check.ok ? d.name + ' · ' + U.fmtMoney(d.cost) : this.check.reason, bad: !this.check.ok }];
    }
  };

  /* -------- Track surface / width / elevation -------- */
  function segmentAt(tr, p) {
    if (!tr || !tr.S || !p) return -1;
    const r = tr.nearestS(p.x, p.z);
    if (!r || r.dist > tr.S.w[r.i] * 0.5 + 2) return -1;
    return tr.S.seg[r.i];
  }
  function segmentMesh(tr, seg, colr) {
    const mb = new MB(4096);
    if (seg >= 0 && tr.S) {
      const S = tr.S;
      let s0 = -1, len = 0;
      for (let i = 0; i < S.n; i++) if (S.seg[i] === seg) { if (s0 < 0) s0 = i * C.TRACK_DS; len += C.TRACK_DS; }
      if (s0 >= 0) trackRegionMesh(mb, tr, s0, len, colr);
    }
    return mb.build();
  }
  const TrackSurface = {
    name: 'tracksurface', surface: 'dirt',
    get hint() { return 'Clic o arrastra sobre un tramo: superficie de ' + Cat.surfaces[this.surface].name.toLowerCase() + ' · Esc: salir'; },
    get tr() { return game().selectedTrack; },
    enter() { this.seg = -1; },
    exit() { R().setOverlayMesh(null); },
    hover(p) {
      this.seg = segmentAt(this.tr, p);
      const o = segmentMesh(this.tr, this.seg, MB.rgba(Cat.surfaces[this.surface].color));
      R().setOverlayMesh(o.data, o.count);
      if (this.painting && this.seg >= 0) this.apply();
    },
    down(p, e) { if (e.button === 0) { this.painting = true; app().input.captureDrag = true; } },
    up() { this.painting = false; app().input.captureDrag = false; },
    cancelDrag() { this.painting = false; },
    click() { this.apply(); },
    apply() {
      const tr = this.tr, seg = this.seg;
      if (!tr || seg < 0) return;
      if (!game().isUnlocked(Cat.surfaces[this.surface])) { toast('Superficie bloqueada: investígala', 'bad'); return; }
      const parts = tr.pieces || tr.nodes;
      if (!parts[seg] || parts[seg].surf === this.surface) return;
      if (tr.state === 'open') { toast('Cierra el circuito para modificarlo', 'info'); return; }
      if (result(game().editTrack(tr, (t) => { (t.pieces || t.nodes)[seg].surf = this.surface; }))) sfx('paint');
    }
  };
  const TrackWidth = {
    name: 'trackwidth', width: 8,
    get hint() { return 'Clic sobre un tramo: anchura de ' + this.width + ' m · Esc: salir'; },
    get tr() { return game().selectedTrack; },
    enter() { this.seg = -1; },
    exit() { R().setOverlayMesh(null); },
    hover(p) { this.seg = segmentAt(this.tr, p); const o = segmentMesh(this.tr, this.seg, MB.rgba('#4fc3f7')); R().setOverlayMesh(o.data, o.count); },
    click() {
      const tr = this.tr, seg = this.seg;
      if (!tr || seg < 0) return;
      if (tr.state === 'open') { toast('Cierra el circuito para modificarlo', 'info'); return; }
      if (tr.pieces) { if (result(game().editTrack(tr, (t) => { t.pieces[seg].w = this.width; }))) sfx('paint'); return; }
      const nxt = tr.closed ? (seg + 1) % tr.nodes.length : Math.min(tr.nodes.length - 1, seg + 1);
      if (result(game().editTrack(tr, (t) => { t.nodes[seg].w = this.width; t.nodes[nxt].w = this.width; }))) sfx('paint');
    }
  };
  const TrackElev = {
    name: 'trackelev',
    hint: 'Clic en un punto: subir 0,5 m · Clic derecho: bajar · Crea subidas y bajadas con terraplén · Esc: salir',
    get tr() { return game().selectedTrack; },
    enter() { this.cursor = null; this.refresh(); },
    exit() { R().setOverlayMesh(null); },
    hover(p) { this.cursor = p; this.refresh(); },
    change(dir) {
      const tr = this.tr;
      if (!tr || !this.cursor) return;
      const i = TrackEdit.nodeAt.call({ tr }, this.cursor);
      if (i < 0) { toast('Haz clic sobre un punto del trazado', 'info'); return; }
      if (tr.state === 'open') { toast('Cierra el circuito para modificarlo', 'info'); return; }
      const v = U.clamp(tr.nodes[i].elev + dir * 0.5, 0, 6);
      if (v === tr.nodes[i].elev) return;
      if (result(game().editTrack(tr, (t) => { t.nodes[i].elev = v; }))) sfx(dir > 0 ? 'raise' : 'lower');
      this.refresh();
    },
    click() { this.change(1); },
    rightClick() { this.change(-1); },
    refresh() {
      const tr = this.tr;
      const mb = new MB(4096);
      if (tr) tr.nodes.forEach((n) => {
        const y = game().world.heightAt(n.x, n.z);
        const hov = this.cursor && U.dist2(n.x, n.z, this.cursor.x, this.cursor.z) < 12;
        marker(mb, n.x, y + n.elev, n.z, 0.45, 1.6, hov ? MB.rgba('#ffffff') : n.elev > 0 ? MB.rgba('#4fc3f7') : MB.rgba('#ff6a13'));
      });
      const o = mb.build();
      R().setOverlayMesh(o.data, o.count);
    },
    labels() {
      const tr = this.tr;
      if (!tr) return [];
      return tr.nodes.filter(n => n.elev > 0).map(n => ({ x: n.x, y: game().world.heightAt(n.x, n.z) + n.elev + 2.5, z: n.z, text: '+' + U.fmt1(n.elev) + ' m' }));
    }
  };

  /* -------- Buildings -------- */
  const meshCache = {};
  const Build = {
    name: 'build', type: 'toilets', rot: 0, preview: true,
    get hint() { const d = Cat.buildings[this.type]; return d.name + ' · ' + U.fmtMoney(d.cost) + ' · R o clic derecho: girar · Esc: salir'; },
    enter() { this.clear(); previewAtCenter(this); },
    exit() { R().setGhostMesh(null); R().setOverlayMesh(null); },
    clear() { this.chk = null; this.tile = null; this.pos = null; this.box = null; this.center = null; R().setGhostMesh(null); R().setOverlayMesh(null); },
    hover(p) {
      if (!p) { this.clear(); return; }
      const d = Cat.buildings[this.type];
      const r = game().rect(this.type, 0, 0, this.rot);
      const tx = Math.floor(p.x / T - r.w / 2 + 0.5), tz = Math.floor(p.z / T - r.h / 2 + 0.5);
      if (this.tile && this.tile.tx === tx && this.tile.tz === tz && this.tile.rot === this.rot && !this.dirty) return;
      this.dirty = false;
      this.tile = { tx, tz, rot: this.rot };
      this.chk = game().checkBuilding(this.type, tx, tz, this.rot);
      const key = this.type + ':' + this.rot;
      if (!meshCache[key]) meshCache[key] = MX.BuildModels.preview(this.type, this.rot);
      const lv = this.chk.level != null ? this.chk.level : game().world.footprintLevel(tx, tz, r.w, r.h).target;
      const g = translated(meshCache[key], (tx + r.w / 2) * T, lv, (tz + r.h / 2) * T);
      const warn = this.chk.ok && this.chk.warn && this.chk.warn.length;
      R().setGhostMesh(g.data, g.count, this.chk.ok ? (warn ? GHOST_B_WARN : GHOST_B_OK) : GHOST_B_BAD, GHOST_B_DITHER);
      const fp = footprintMesh(tx, tz, r.w, r.h, MB.rgba(this.chk.ok ? (warn ? '#ffd22e' : '#7dff7a') : '#ff4a3d'));
      R().setOverlayMesh(fp.data, fp.count);
      this.pos = { x: (tx + r.w / 2) * T, y: lv + d.height + 1.5, z: (tz + r.h / 2) * T };
      this.center = { x: (tx + r.w / 2) * T, z: (tz + r.h / 2) * T };
      this.box = { x0: tx * T, x1: (tx + r.w) * T, y0: lv, y1: lv + d.height, z0: tz * T, z1: (tz + r.h) * T };
    },
    /* touch: a finger on the preview drags it */
    grab(p, css) {
      if (!this.tile || !onScreenBox(css, this.box, 18)) return false;
      this.grabOff = p ? { x: p.x - this.center.x, z: p.z - this.center.z } : { x: 0, z: 0 };
      return true;
    },
    dragTo(p) { if (p) this.hover({ x: p.x - this.grabOff.x, z: p.z - this.grabOff.z }); },
    placement() {
      if (!this.chk || !this.tile) return null;
      return { ok: this.chk.ok, warn: this.chk.ok && !!(this.chk.warn && this.chk.warn.length), text: this.chk.ok ? U.fmtMoney(this.chk.cost) : this.chk.reason };
    },
    emptyText: 'Toca el mapa donde lo quieras',
    click() { this.place(); },
    place() {
      if (!this.tile) return;
      const r = game().placeBuilding(this.type, this.tile.tx, this.tile.tz, this.rot);
      if (result(r)) {
        sfx('build');
        app().fx.burst(r.b.cx, r.b.y, r.b.cz, 'build');
        this.dirty = true;
        MX.Bus.emit('ui:built', r.b);
        /* on touch screens the preview goes away until the next tap */
        if (touchMode()) this.clear();
      }
    },
    rotate() {
      this.rot = (this.rot + 1) % 4; this.dirty = true; sfx('click');
      const c = touchMode() ? this.center : this.lastP;
      if (c) this.hover(c);
    },
    rightClick() { this.rotate(); },
    key(e) { if (e.key === 'r' || e.key === 'R') { this.rotate(); return true; } return false; },
    labels() {
      if (!this.chk || !this.pos) return [];
      const t = this.chk.ok ? U.fmtMoney(this.chk.cost) + (this.chk.warn && this.chk.warn.length ? ' · ' + this.chk.warn[0] : '') : this.chk.reason;
      return [{ x: this.pos.x, y: this.pos.y, z: this.pos.z, text: t, bad: !this.chk.ok, warn: this.chk.ok && this.chk.warn && this.chk.warn.length }];
    }
  };

  /* -------- Paths and roads -------- */
  const PathTool = {
    name: 'path', type: 1,
    get hint() { const d = Cat.paths[this.type]; return d.name + ' · ' + U.fmtMoney(d.cost) + '/casilla · Arrastra para trazar en línea · Clic derecho: quitar · Esc: salir'; },
    enter() { this.start = null; this.cur = null; this.tiles = []; },
    exit() { R().setOverlayMesh(null); },
    lineTiles(a, b) {
      const out = [];
      const dx = b.tx - a.tx, dz = b.tz - a.tz;
      if (Math.abs(dx) >= Math.abs(dz)) {
        for (let k = 0; k <= Math.abs(dx); k++) out.push({ tx: a.tx + Math.sign(dx) * k, tz: a.tz });
        for (let k = 1; k <= Math.abs(dz); k++) out.push({ tx: b.tx, tz: a.tz + Math.sign(dz) * k });
      } else {
        for (let k = 0; k <= Math.abs(dz); k++) out.push({ tx: a.tx, tz: a.tz + Math.sign(dz) * k });
        for (let k = 1; k <= Math.abs(dx); k++) out.push({ tx: a.tx + Math.sign(dx) * k, tz: b.tz });
      }
      return out;
    },
    hover(p) {
      if (!p) return;
      this.cur = tileOf(p);
      this.tiles = this.start ? this.lineTiles(this.start, this.cur) : [this.cur];
      const mb = new MB(4096);
      let cost = 0;
      for (const t of this.tiles) {
        const why = game().world.canPlacePath(t.tx, t.tz, this.type);
        tileQuad(mb, t.tx, t.tz, why ? (why === 'Ya hay uno igual' ? MB.rgba('#ffffff') : MB.rgba('#ff3b30')) : MB.rgba(this.erase ? '#ff9800' : '#5cff6a'));
        if (!why) cost += Cat.paths[this.type].cost;
      }
      this.cost = cost;
      const o = mb.build();
      R().setOverlayMesh(o.data, o.count);
    },
    down(p, e) { if (p && (e.button === 0 || e.button === 2)) { this.start = tileOf(p); this.erase = e.button === 2; app().input.captureDrag = true; this.hover(p); } },
    cancelDrag() { this.start = null; this.erase = false; this.tiles = []; R().setOverlayMesh(null); },
    up(p, e) {
      if (!this.start) return;
      app().input.captureDrag = false;
      let n = 0, fail = null;
      for (const t of this.tiles) {
        const r = this.erase ? game().removePath(t.tx, t.tz) : game().placePath(t.tx, t.tz, this.type);
        if (r.ok) n++; else if (!fail && r.reason !== 'Ya hay uno igual' && r.reason !== 'No hay camino') fail = r.reason;
      }
      if (n) sfx(this.erase ? 'demolish' : 'place');
      else if (fail) { toast(fail, 'bad'); sfx('error'); }
      this.start = null; this.erase = false;
      if (p) this.hover(p);
      void e;
    },
    labels() {
      if (!this.cur || !this.tiles.length) return [];
      const t = this.tiles[this.tiles.length - 1];
      return [{ x: (t.tx + 0.5) * T, y: game().world.tileCenterH(t.tx, t.tz) + 2, z: (t.tz + 0.5) * T, text: this.erase ? 'Quitar' : this.tiles.length + ' · ' + U.fmtMoney(this.cost) }];
    }
  };
  const AddonTool = {
    name: 'addon', kind: 'bench',
    get hint() { return Cat.addons[this.kind].name + ' · ' + U.fmtMoney(Cat.addons[this.kind].cost) + ' · Clic sobre un camino · Esc: salir'; },
    hover(p) {
      if (!p) return;
      this.t = tileOf(p);
      const mb = new MB(256);
      tileQuad(mb, this.t.tx, this.t.tz, game().world.isWalkable(this.t.tx, this.t.tz) ? MB.rgba('#5cff6a') : MB.rgba('#ff3b30'));
      const o = mb.build(); R().setOverlayMesh(o.data, o.count);
    },
    exit() { R().setOverlayMesh(null); },
    click() { if (this.t && result(game().placeAddon(this.t.tx, this.t.tz, this.kind))) sfx('place'); }
  };
  /* why a decoration can't go on a tile (the same rules as Game.placeDecor, money aside) */
  function decorWhy(tx, tz) {
    const w = game().world;
    if (!w.inBounds(tx, tz)) return 'Fuera del mapa';
    const i = w.idx(tx, tz);
    if (!w.owned[i]) return 'Terreno no comprado';
    if (w.bld[i] >= 0 || w.path[i] || w.trackOcc[i]) return 'Ocupado';
    if (w.isWater(tx, tz)) return 'Hay agua';
    if (w.scen[i] >= 0) return 'Ya hay algo aquí';
    return null;
  }
  const DECOR_H = { tree_pine: 9, tree_oak: 7, tree_poplar: 11, flag: 6, banner: 4 };
  const DecorTool = {
    name: 'decor', type: 'tree_pine', rot: 0, preview: true,
    get hint() { const d = Cat.decor[this.type]; return d.name + ' · ' + U.fmtMoney(d.cost) + ' · R: girar · Esc: salir'; },
    enter() { this.clear(); previewAtCenter(this); },
    clear() { this.t = null; this.box = null; this.why = null; R().setGhostMesh(null); R().setOverlayMesh(null); },
    hover(p) {
      if (!p) return;
      this.t = tileOf(p);
      const w = game().world;
      const key = 'decor:' + this.type + ':' + this.rot;
      if (!meshCache[key]) meshCache[key] = MX.BuildModels.decorPreview(this.type, this.rot * Math.PI / 2);
      const x = (this.t.tx + 0.5) * T, z = (this.t.tz + 0.5) * T, y = w.heightAt(x, z);
      const g = translated(meshCache[key], x, y, z);
      this.why = decorWhy(this.t.tx, this.t.tz);
      R().setGhostMesh(g.data, g.count, this.why ? GHOST_B_BAD : GHOST_B_OK, GHOST_B_DITHER);
      const fp = footprintMesh(this.t.tx, this.t.tz, 1, 1, MB.rgba(this.why ? '#ff4a3d' : '#7dff7a'));
      R().setOverlayMesh(fp.data, fp.count);
      this.box = { x0: this.t.tx * T, x1: (this.t.tx + 1) * T, y0: y, y1: y + (DECOR_H[this.type] || Cat.decor[this.type].h || 2.5), z0: this.t.tz * T, z1: (this.t.tz + 1) * T };
    },
    exit() { R().setGhostMesh(null); R().setOverlayMesh(null); },
    /* touch: a finger on the preview drags it */
    grab(p, css) {
      if (!this.t || !onScreenBox(css, this.box, 18)) return false;
      this.grabOff = p ? { x: p.x - (this.t.tx + 0.5) * T, z: p.z - (this.t.tz + 0.5) * T } : { x: 0, z: 0 };
      return true;
    },
    dragTo(p) { if (p) this.hover({ x: p.x - this.grabOff.x, z: p.z - this.grabOff.z }); },
    placement() { return this.t ? { ok: !this.why, text: this.why || U.fmtMoney(Cat.decor[this.type].cost) } : null; },
    emptyText: 'Toca el mapa donde lo quieras',
    click() { this.place(); },
    place() {
      if (!this.t) return;
      if (result(game().placeDecor(this.type, this.t.tx, this.t.tz, this.rot * Math.PI / 2))) {
        sfx('place');
        if (touchMode()) this.clear();
        else this.hover({ x: (this.t.tx + 0.5) * T, z: (this.t.tz + 0.5) * T });
      }
    },
    labels() {
      if (!this.t || !this.box) return [];
      return [{ x: (this.t.tx + 0.5) * T, y: this.box.y1 + 1.5, z: (this.t.tz + 0.5) * T, text: this.why || U.fmtMoney(Cat.decor[this.type].cost), bad: !!this.why }];
    },
    rotate() {
      this.rot = (this.rot + 1) % 4; sfx('click');
      const c = touchMode() ? (this.t && { x: (this.t.tx + 0.5) * T, z: (this.t.tz + 0.5) * T }) : this.lastP;
      if (c) this.hover(c);
    },
    key(e) { if (e.key === 'r' || e.key === 'R') { this.rotate(); return true; } return false; }
  };

  /* -------- Demolish -------- */
  const Demolish = {
    name: 'demolish',
    hint: 'Clic: demoler edificio, camino o decoración (recuperas parte del coste) · Esc: salir',
    hover(p, css) {
      this.target = null;
      const mb = new MB(512);
      const b = css ? app().pickBuilding(css.x, css.y) : null;
      if (b) {
        this.target = { kind: 'building', b };
        mb.box(b.tx * T - 0.1, b.y - 0.1, b.tz * T - 0.1, (b.tx + b.w) * T + 0.1, b.y + 0.35, (b.tz + b.h) * T + 0.1, { col: MB.rgba('#ff3b30') });
      } else if (p) {
        const t = tileOf(p), w = game().world;
        if (w.inBounds(t.tx, t.tz)) {
          const i = w.idx(t.tx, t.tz);
          if (w.scen[i] >= 0) this.target = { kind: 'scen', t };
          else if (w.addon[i]) this.target = { kind: 'addon', t };
          else if (w.path[i] && t.tz !== w.roadRow) this.target = { kind: 'path', t };
          if (this.target) tileQuad(mb, t.tx, t.tz, MB.rgba('#ff3b30'), 0.2);
        }
      }
      const o = mb.build(); R().setOverlayMesh(o.data, o.count);
    },
    exit() { R().setOverlayMesh(null); },
    click(p, e, css) {
      this.hover(p, css);
      const t = this.target;
      if (!t) return;
      if (t.kind === 'building') {
        const d = Cat.buildings[t.b.type];
        app().confirm('Demoler ' + d.name, '¿Seguro? Recuperas ' + U.fmtMoney(Math.round(d.cost * 0.4)) + '.', () => {
          game().removeBuilding(t.b.id); sfx('demolish'); app().fx.burst(t.b.cx, t.b.y, t.b.cz, 'build');
        });
      } else if (t.kind === 'scen') { if (result(game().removeScenery(t.t.tx, t.t.tz))) sfx('demolish'); }
      else if (t.kind === 'addon') { const w = game().world; w.addon[w.idx(t.t.tx, t.t.tz)] = 0; w.addonVer++; game().fieldsDirty = true; sfx('demolish'); }
      else if (t.kind === 'path') { if (result(game().removePath(t.t.tx, t.t.tz))) sfx('demolish'); }
      this.hover(p, css);
    }
  };

  /* -------- Terrain -------- */
  const Terrain = {
    name: 'terrain', op: 'raise', size: 1,
    get hint() {
      const n = { raise: 'Subir', lower: 'Excavar', level: 'Nivelar', smooth: 'Suavizar' }[this.op];
      return n + ' terreno (pincel ' + this.size + 'x' + this.size + ') · Mantén pulsado para repetir · [ ] cambia el tamaño · Esc: salir';
    },
    enter() { this.t = null; R().grid = true; },
    exit() { R().brush = [0, 0, 0, 0]; R().grid = app().settings.grid; },
    rect(p) {
      const t = tileOf(p);
      const h0 = Math.floor((this.size - 1) / 2);
      return { tx0: t.tx - h0, tz0: t.tz - h0, tx1: t.tx - h0 + this.size - 1, tz1: t.tz - h0 + this.size - 1 };
    },
    hover(p) {
      if (!p) { R().brush = [0, 0, 0, 0]; return; }
      if (this.holding && this.op === 'level') { /* keep target height while dragging */ }
      this.r = this.rect(p);
      const r = this.r;
      R().brush = [r.tx0 * T, r.tz0 * T, (r.tx1 + 1) * T, (r.tz1 + 1) * T];
      R().brushCol = this.op === 'lower' ? [1, 0.35, 0.2, 0.35] : this.op === 'level' ? [1, 0.9, 0.2, 0.35] : this.op === 'smooth' ? [0.4, 0.8, 1, 0.35] : [0.3, 1, 0.4, 0.35];
      if (this.holding && this.op !== 'level') { /* repeat handled in tick */ }
      if (this.holding && this.op === 'level') this.apply();
    },
    down(p, e) {
      if (e.button !== 0 || !p) return;
      this.holding = true; this.rep = 0;
      app().input.captureDrag = true;
      if (this.op === 'level') { const t = tileOf(p); this.levelH = game().world.tileCenterH(t.tx, t.tz); }
      this.apply();
    },
    up() { this.holding = false; app().input.captureDrag = false; },
    cancelDrag() { this.holding = false; },
    tick(dt) {
      if (!this.holding || this.op === 'level') return;
      this.rep += dt;
      if (this.rep > 0.18) { this.rep = 0; this.apply(); }
    },
    apply() {
      const r = this.r;
      if (!r) return;
      const res = game().terrainEdit(this.op, r.tx0, r.tz0, r.tx1, r.tz1, this.op === 'level' ? { target: Math.round(this.levelH * 2) / 2 } : {});
      if (res.ok) { sfx(this.op === 'lower' ? 'lower' : 'raise'); this.lastCost = res.cost; }
      else if (res.reason && !this._warned) { toast(res.reason, 'bad'); this._warned = true; setTimeout(() => { this._warned = false; }, 1200); }
    },
    key(e) {
      if (e.key === '[') { this.size = Math.max(1, this.size - 1); Tools.set(this); return true; }
      if (e.key === ']') { this.size = Math.min(7, this.size + 1); Tools.set(this); return true; }
      return false;
    }
  };
  const Paint = {
    name: 'paint', ground: 0, size: 2,
    get hint() { return 'Pintar suelo: ' + MX.World.GROUND_NAMES[this.ground].toLowerCase() + ' · Arrastra para pintar · Esc: salir'; },
    hover(p) {
      if (!p) return;
      this.r = Terrain.rect.call(this, p);
      const r = this.r;
      R().brush = [r.tx0 * T, r.tz0 * T, (r.tx1 + 1) * T, (r.tz1 + 1) * T];
      R().brushCol = [1, 1, 1, 0.3];
      if (this.holding) this.apply();
    },
    exit() { R().brush = [0, 0, 0, 0]; },
    down(p, e) { if (e.button === 0) { this.holding = true; app().input.captureDrag = true; this.apply(); } },
    up() { this.holding = false; app().input.captureDrag = false; },
    cancelDrag() { this.holding = false; },
    apply() { const r = this.r; if (r && game().paintGround(r.tx0, r.tz0, r.tx1, r.tz1, this.ground).ok) sfx('paint'); }
  };
  const Land = {
    name: 'land',
    hint: 'Las parcelas amarillas están a la venta · Clic: comprar · Esc: salir',
    enter() { R().showLand = true; },
    exit() { R().showLand = false; R().brush = [0, 0, 0, 0]; },
    hover(p) {
      if (!p) return;
      const w = game().world;
      const q = w.parcelAt(Math.floor(p.x / T), Math.floor(p.z / T));
      this.q = q;
      const PS = C.PARCEL * T;
      R().brush = [q.px * PS, q.pz * PS, (q.px + 1) * PS, (q.pz + 1) * PS];
      const st = w.parcelState(q.px, q.pz);
      R().brushCol = st === 1 ? [1, 0.9, 0.2, 0.35] : st === 2 ? [0.3, 1, 0.4, 0.2] : [1, 0.2, 0.2, 0.25];
    },
    click() {
      const q = this.q;
      if (!q) return;
      const w = game().world;
      const st = w.parcelState(q.px, q.pz);
      if (st === 2) { toast('Esta parcela ya es tuya', 'info'); return; }
      if (st !== 1) { toast('Aún no está a la venta: cumple objetivos para ampliar', 'bad'); return; }
      const price = w.parcelPrice(q.px, q.pz);
      app().confirm('Comprar parcela', 'Parcela de ' + C.PARCEL * T + ' x ' + C.PARCEL * T + ' m por ' + U.fmtMoney(price) + '.', () => { if (result(game().buyParcel(q.px, q.pz))) sfx('cash'); });
    },
    labels() {
      const q = this.q;
      if (!q) return [];
      const w = game().world, st = w.parcelState(q.px, q.pz);
      const PS = C.PARCEL * T;
      const x = (q.px + 0.5) * PS, z = (q.pz + 0.5) * PS;
      const y = w.heightAt(x, z) + 3;
      return [{ x, y, z, text: st === 2 ? 'Tu terreno' : st === 1 ? 'En venta: ' + U.fmtMoney(w.parcelPrice(q.px, q.pz)) : 'No disponible', bad: st === 0 }];
    }
  };

  Tools.list = { SelectTool, TrackStart, TrackBuild, TrackDraw, TrackEdit, TrackFeature, TrackSurface, TrackWidth, TrackElev, Build, PathTool, AddonTool, DecorTool, Demolish, Terrain, Paint, Land };
  Tools.helpers = { tileQuad, marker, ringMesh, trackRegionMesh, translated };
  MX.Tools = Tools;
})(window.MX);
