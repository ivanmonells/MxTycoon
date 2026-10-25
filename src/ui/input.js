/* MX Tycoon - input: mouse, keyboard and touch. Camera pan/zoom/rotate and
   forwarding of picked world points to the active tool. */
(function (MX) {
  'use strict';
  const U = MX.U;

  class Input {
    constructor(el) {
      this.el = el;
      this.keys = new Set();
      this.down = null;
      this.captureDrag = false;
      this.touches = new Map();
      this.pinch = null;
      this.mouse = { x: 0, y: 0, inside: false };
      this.lastType = 'mouse';
      this.enabled = true;
      this._bind();
    }
    get app() { return MX.App; }
    /* the last thing that touched the page was a finger: no hover, previews wait for a confirmation */
    get touchMode() { return this.lastType === 'touch'; }
    pick(x, y) { return this.app.renderer.pickGround(x, y); }
    _local(e) { const r = this.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    _bind() {
      const el = this.el;
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('pointerdown', (e) => this.onDown(e));
      el.addEventListener('pointermove', (e) => this.onMove(e));
      el.addEventListener('pointerup', (e) => this.onUp(e));
      el.addEventListener('pointercancel', (e) => this.onUp(e, true));
      el.addEventListener('pointerleave', () => { this.mouse.inside = false; });
      el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      window.addEventListener('pointerdown', (e) => { this.lastType = e.pointerType || 'mouse'; }, true);
      window.addEventListener('keydown', (e) => this.onKey(e, true));
      window.addEventListener('keyup', (e) => this.onKey(e, false));
      window.addEventListener('blur', () => this.keys.clear());
    }
    tool() { return MX.Tools.current; }
    onDown(e) {
      if (!this.enabled) return;
      const p = this._local(e);
      this.el.setPointerCapture && this.el.setPointerCapture(e.pointerId);
      if (e.pointerType === 'touch') {
        this.touches.set(e.pointerId, p);
        if (this.touches.size === 2) { this._startPinch(); return; }
      }
      this.down = { x: p.x, y: p.y, sx: p.x, sy: p.y, button: e.button, moved: false, t: performance.now(), pan: false, grab: false, id: e.pointerId, touch: e.pointerType === 'touch' };
      const wp = this.pick(p.x, p.y);
      const tool = this.tool();
      this.down.pan = e.button === 1;
      /* a finger has no hover: on the preview of a placing tool it grabs it, and
         any other tool first sees the point under the finger */
      if (this.down.touch && tool && e.button === 0) {
        if (tool.preview) { if (tool.grab && tool.grab(wp, p)) { this.down.grab = true; this.captureDrag = true; } }
        else if (tool.hover) { tool.lastP = wp; tool.hover(wp, p); }
      }
      if (tool && tool.down && (e.button === 0 || e.button === 2)) tool.down(wp, { button: e.button, shift: e.shiftKey }, p);
    }
    onMove(e) {
      const p = this._local(e);
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.inside = true;
      if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
        this.touches.set(e.pointerId, p);
        if (this.pinch) { this._movePinch(); return; }
      }
      const d = this.down;
      if (d) {
        const dx = p.x - d.x, dy = p.y - d.y;
        if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 6) d.moved = true;
        const tool = this.tool();
        /* dragging a grabbed preview moves it instead of the camera */
        if (d.grab) {
          if (d.moved && tool && tool.dragTo) tool.dragTo(this.pick(p.x, p.y), p);
          d.x = p.x; d.y = p.y;
          return;
        }
        const wantsPan = d.pan || (d.moved && !this.captureDrag && (d.button === 2 || (d.button === 0 && (!tool || tool.name === 'select' || (d.touch && !tool.touchDraw)))));
        if (wantsPan && d.moved) { this.panBy(dx, dy); d.pan = true; }
        d.x = p.x; d.y = p.y;
      }
      const tool = this.tool();
      /* a finger only drives the hover of tools that paint or draw; previews stay put */
      if (tool && tool.hover && !(this.down && this.down.pan) && !(e.pointerType === 'touch' && tool.preview)) {
        const wp = this.pick(p.x, p.y);
        tool.lastP = wp;
        tool.hover(wp, p);
      }
    }
    onUp(e, cancel) {
      if (e.pointerType === 'touch') {
        this.touches.delete(e.pointerId);
        if (this.pinch) { if (this.touches.size < 2) this.pinch = null; this.down = null; return; }
      }
      const d = this.down;
      this.down = null;
      if (d && d.grab) this.captureDrag = false;
      /* a tap can open or fold a sheet under the finger; its late click must not land there */
      if (d && d.touch) MX.WM.eatClick(e.clientX, e.clientY);
      if (!d || cancel) return;
      const p = this._local(e);
      const tool = this.tool();
      const wp = this.pick(p.x, p.y);
      /* a tap on the grabbed preview places it; a drag only moved it */
      if (d.grab) { if (!d.moved && tool && tool.place) tool.place(); return; }
      if (tool && tool.up) tool.up(wp, { button: d.button }, p);
      if (!d.moved && !d.pan) {
        /* a tap elsewhere moves the preview there; placing needs a second tap or «Colocar» */
        if (d.button === 0 && tool && d.touch && tool.preview) { tool.lastP = wp; tool.hover(wp, p); }
        else if (d.button === 0 && tool && tool.click) tool.click(wp, { button: 0, shift: e.shiftKey, touch: d.touch }, p);
        else if (d.button === 2) {
          if (tool && tool.rightClick) tool.rightClick(wp, p);
          else if (tool && tool.name !== 'select') MX.Tools.select();
        }
      }
    }
    onWheel(e) {
      e.preventDefault();
      if (!this.enabled) return;
      const p = this._local(e);
      const k = Math.exp(-e.deltaY * 0.0015);
      this.zoomAt(p.x, p.y, k);
    }
    zoomAt(cx, cy, k) {
      const r = this.app.renderer, cam = r.cam;
      const before = this._planeHit(cx, cy);
      cam.targetZoom = U.clamp(cam.targetZoom * k, cam.minZoom, cam.maxZoom);
      const z0 = cam.zoom;
      cam.zoom = cam.targetZoom; cam.compute();
      const after = this._planeHit(cx, cy);
      if (before && after) { cam.tx += before.x - after.x; cam.tz += before.z - after.z; }
      cam.zoom = z0; cam.compute();
      this.clampCam();
    }
    _planeHit(cx, cy) {
      const r = this.app.renderer, cam = r.cam;
      const [rx, ry] = r.cssToRender(cx, cy);
      const ray = cam.ray(rx, ry);
      const t = (cam.ty - ray.oy) / ray.dy;
      return { x: ray.ox + ray.dx * t, z: ray.oz + ray.dz * t };
    }
    panBy(dx, dy) {
      const r = this.app.renderer, cam = r.cam;
      const k = 1 / (cam.zoom * cam.zoomMul * r.cssScale);
      const fx = cam.fwd[0], fz = cam.fwd[2];
      const fl = Math.hypot(fx, fz) || 1;
      const sinP = Math.sin(cam.pitch);
      cam.tx += -cam.right[0] * dx * k + (fx / fl) * dy * k / sinP;
      cam.tz += -cam.right[2] * dx * k + (fz / fl) * dy * k / sinP;
      cam.follow = null;
      this.clampCam();
    }
    clampCam() {
      const cam = this.app.renderer.cam, S = this.app.game.world.N * MX.C.TILE;
      cam.tx = U.clamp(cam.tx, -20, S + 20); cam.tz = U.clamp(cam.tz, -20, S + 20);
    }
    _startPinch() {
      /* a second finger turns any drag in progress into a pinch */
      const tool = this.tool();
      if (this.down && tool && tool.cancelDrag) tool.cancelDrag();
      this.captureDrag = false;
      const pts = Array.from(this.touches.values());
      this.pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
      this.down = null;
    }
    _movePinch() {
      const pts = Array.from(this.touches.values());
      if (pts.length < 2) return;
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
      this.panBy(cx - this.pinch.cx, cy - this.pinch.cy);
      if (this.pinch.d > 10) this.zoomAt(cx, cy, d / this.pinch.d);
      this.pinch.d = d; this.pinch.cx = cx; this.pinch.cy = cy;
    }
    onKey(e, down) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      /* a focused button already reacts to Enter and Space by itself */
      if ((tag === 'BUTTON' || tag === 'LABEL') && (e.key === 'Enter' || e.key === ' ')) return;
      const k = e.key;
      if (!down) { this.keys.delete(k.toLowerCase()); return; }
      if (!this.enabled || !this.app.game) { this.keys.add(k.toLowerCase()); return; }
      const tool = this.tool();
      if (tool && tool.key && !(this.app.modalOpen && this.app.modalOpen()) && tool.key(e)) { e.preventDefault(); return; }
      this.keys.add(k.toLowerCase());
      const app = this.app;
      if (k === 'Escape') {
        if (app.modalOpen && app.modalOpen()) return;
        if (tool && tool.name !== 'select') { MX.Tools.select(); return; }
        if (MX.WM.closeTop()) return;
        app.hud.menu();
        return;
      }
      if (k === ' ') { e.preventDefault(); app.togglePause(); return; }
      if (k === '1' || k === '2' || k === '3' || k === '4') { app.setSpeed(+k === 3 ? 4 : +k === 4 ? 8 : +k); return; }
      if (k === 'q' || k === 'Q') { app.renderer.cam.yawIndex = (app.renderer.cam.yawIndex + 3) % 4; return; }
      if (k === 'e' || k === 'E') { app.renderer.cam.yawIndex = (app.renderer.cam.yawIndex + 1) % 4; return; }
      if (k === '+' || k === '=') { const r = this.el.getBoundingClientRect(); this.zoomAt(r.width / 2, r.height / 2, 1.25); return; }
      if (k === '-' || k === '_') { const r = this.el.getBoundingClientRect(); this.zoomAt(r.width / 2, r.height / 2, 0.8); return; }
      if (k === 'g' || k === 'G') { app.settings.grid = !app.settings.grid; app.renderer.grid = app.settings.grid; app.saveSettings(); return; }
      if ((k === 's' || k === 'S') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); app.quickSave(); return; }
      if (k === 'F5') { e.preventDefault(); app.quickSave(); return; }
    }
    update(dt) {
      if (!this.enabled || !this.app.game) return;
      const cam = this.app.renderer.cam;
      let dx = 0, dy = 0;
      const K = this.keys;
      if (K.has('w') || K.has('arrowup')) dy += 1;
      if (K.has('s') || K.has('arrowdown')) dy -= 1;
      if (K.has('a') || K.has('arrowleft')) dx += 1;
      if (K.has('d') || K.has('arrowright')) dx -= 1;
      if (dx || dy) {
        const sp = 620 * dt;
        this.panBy(dx * sp, dy * sp);
      }
      if (this.app.settings.edgeScroll && this.mouse.inside && !this.down) {
        const r = this.el.getBoundingClientRect(), m = 14;
        let ex = 0, ey = 0;
        if (this.mouse.x < m) ex = 1; else if (this.mouse.x > r.width - m) ex = -1;
        if (this.mouse.y < m + 44) ey = 1; else if (this.mouse.y > r.height - m) ey = -1;
        if (ex || ey) this.panBy(ex * 500 * dt, ey * 500 * dt);
      }
      if (cam.follow) {
        const a = cam.follow;
        if (a.dead) cam.follow = null;
        else { cam.tx += (a.x - cam.tx) * Math.min(1, dt * 5); cam.tz += (a.z - cam.tz) * Math.min(1, dt * 5); cam.ty += ((a.y || cam.ty) - cam.ty) * Math.min(1, dt * 3); }
      }
    }
  }
  MX.Input = Input;
})(window.MX);
