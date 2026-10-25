/* MX Tycoon - particle effects: dust, roost, mud, smoke, landing bursts, crashes,
   construction puffs, rain and confetti. CPU particles drawn as dithered sprites. */
(function (MX) {
  'use strict';
  const U = MX.U, Cat = MX.Catalog;
  const MAX = 3000;

  class FX {
    constructor() {
      this.p = [];
      for (let i = 0; i < MAX; i++) this.p.push({ alive: false });
      this.next = 0;
      this.rainT = 0;
      this.drops = [];
      MX.Bus.on('land', (d) => { if (d.air > 0.5) this.burst(d.x, null, d.z, d.q === 'clean' ? 'land' : 'hard'); });
      MX.Bus.on('crash', (d) => this.burst(d.x, null, d.z, 'crash'));
      MX.Bus.on('race:winner', () => this.confetti());
      MX.Bus.on('race:start', (d) => { const tr = d.race.tr; const i = tr.sIndex(tr.startS); this.burst(tr.S.x[i], tr.S.y[i], tr.S.z[i], 'gate'); });
    }
    get game() { return MX.App.game; }
    spawn(x, y, z, o) {
      let k = 0, p = null;
      while (k < 40) { const c = this.p[this.next]; this.next = (this.next + 1) % MAX; if (!c.alive) { p = c; break; } k++; }
      if (!p) { p = this.p[this.next]; this.next = (this.next + 1) % MAX; }
      p.alive = true; p.x = x; p.y = y; p.z = z;
      p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
      p.life = 0; p.max = o.life || 1; p.size = o.size || 0.6; p.grow = o.grow || 0; p.g = o.g != null ? o.g : 0;
      p.drag = o.drag != null ? o.drag : 1.5; p.col = o.col || [200, 170, 130]; p.a = o.a != null ? o.a : 0.8;
      p.reg = o.reg || 'p_dust'; p.rot = o.rot || 0; p.vr = o.vr || 0; p.sh = o.sh || 1;
      return p;
    }
    groundY(x, z) { return this.game ? this.game.world.heightAt(x, z) : 0; }
    burst(x, y, z, kind) {
      if (y == null) y = this.groundY(x, z) + 0.3;
      const rng = U.rng;
      if (kind === 'land' || kind === 'hard') {
        const n = kind === 'hard' ? 14 : 9;
        for (let i = 0; i < n; i++) this.spawn(x + rng.range(-1, 1), y, z + rng.range(-1, 1), { vx: rng.range(-3, 3), vy: rng.range(0.5, 2.5), vz: rng.range(-3, 3), life: rng.range(0.7, 1.4), size: rng.range(0.6, 1.1), grow: 1.4, col: [196, 164, 120], a: 0.75 });
      } else if (kind === 'crash') {
        for (let i = 0; i < 22; i++) this.spawn(x, y, z, { vx: rng.range(-5, 5), vy: rng.range(1, 5), vz: rng.range(-5, 5), life: rng.range(0.8, 1.8), size: rng.range(0.7, 1.4), grow: 1.2, g: 3, col: [178, 140, 98], a: 0.85 });
        for (let i = 0; i < 10; i++) this.spawn(x, y + 0.3, z, { vx: rng.range(-4, 4), vy: rng.range(3, 7), vz: rng.range(-4, 4), life: 1.2, size: 0.18, g: 14, drag: 0.3, col: [90, 62, 40], a: 1, reg: 'p_square' });
      } else if (kind === 'build') {
        for (let i = 0; i < 26; i++) this.spawn(x + rng.range(-4, 4), y + rng.range(0, 1), z + rng.range(-4, 4), { vx: rng.range(-2, 2), vy: rng.range(0.5, 2.5), vz: rng.range(-2, 2), life: rng.range(0.8, 1.6), size: rng.range(1.2, 2.2), grow: 1.5, col: [220, 210, 195], a: 0.8 });
      } else if (kind === 'dirt') {
        for (let i = 0; i < 16; i++) this.spawn(x + rng.range(-3, 3), y, z + rng.range(-3, 3), { vx: rng.range(-1.5, 1.5), vy: rng.range(1, 3), vz: rng.range(-1.5, 1.5), life: rng.range(0.6, 1.2), size: rng.range(0.8, 1.6), grow: 1, col: [150, 110, 70], a: 0.8 });
      } else if (kind === 'gate') {
        for (let i = 0; i < 30; i++) this.spawn(x + rng.range(-5, 5), y, z + rng.range(-5, 5), { vx: rng.range(-2, 2), vy: rng.range(0.5, 2), vz: rng.range(-2, 2), life: rng.range(1, 2), size: rng.range(1, 2), grow: 1.5, col: [200, 175, 140], a: 0.7 });
      }
    }
    confetti() {
      const g = this.game;
      if (!g || !g.race) return;
      const tr = g.race.tr, i = tr.sIndex(tr.finishS);
      const x = tr.S.x[i], y = tr.S.y[i] + 6, z = tr.S.z[i];
      const cols = [[255, 106, 19], [255, 210, 46], [66, 165, 245], [229, 57, 53], [92, 194, 106], [255, 255, 255]];
      for (let k = 0; k < 160; k++) this.spawn(x + U.rng.range(-6, 6), y + U.rng.range(0, 3), z + U.rng.range(-6, 6), { vx: U.rng.range(-3, 3), vy: U.rng.range(-0.5, 2), vz: U.rng.range(-3, 3), life: U.rng.range(2.5, 4), size: 0.25, g: 1.2, drag: 0.8, col: U.rng.pick(cols), a: 1, reg: 'p_square', vr: U.rng.range(-8, 8) });
    }
    /* rider trail: dust, roost and mud depending on surface and moisture */
    riderTrail(r, tr, dt) {
      const m = r.m;
      if (!m || m.air || m.crash || m.v < 5) return;
      const S = tr.S, i = tr.sIndex(m.s);
      const sd = Cat.surfaces[Cat.surfaceOrder[S.surf[i]]];
      const wet = tr.moisture;
      const rate = (m.v / 18) * dt * 22;
      const back = -1.1;
      const cx = Math.cos(m.hdg), sz = Math.sin(m.hdg);
      const x = m.x + cx * back, z = m.z + sz * back, y = m.y + 0.25;
      const rng = U.rng;
      const surfName = Cat.surfaceOrder[S.surf[i]];
      if ((surfName === 'mud' || wet > 0.55) && rng.chance(rate * 0.6)) {
        this.spawn(x, y + 0.2, z, { vx: -cx * rng.range(2, 5) + rng.range(-1, 1), vy: rng.range(1.5, 4), vz: -sz * rng.range(2, 5) + rng.range(-1, 1), life: 0.9, size: 0.2, g: 12, drag: 0.5, col: [70, 48, 30], a: 1, reg: 'p_square' });
      } else if (surfName === 'sand' && rng.chance(rate * 0.8)) {
        this.spawn(x, y + 0.2, z, { vx: -cx * rng.range(3, 6), vy: rng.range(2, 4.5), vz: -sz * rng.range(3, 6), life: 0.8, size: 0.18, g: 11, drag: 0.4, col: [225, 200, 150], a: 1, reg: 'p_square' });
        if (rng.chance(rate * 0.3)) this.spawn(x, y, z, { vx: -cx, vy: 0.5, vz: -sz, life: 1.2, size: 0.8, grow: 1.4, col: [230, 210, 170], a: 0.45 });
      } else if (rng.chance(rate * sd.dust * (1 - wet) * (MX.App.game.wateringUnlocked() ? 0.6 : 1))) {
        this.spawn(x, y, z, { vx: -cx * 1.5 + rng.range(-0.5, 0.5), vy: rng.range(0.3, 1.2), vz: -sz * 1.5 + rng.range(-0.5, 0.5), life: rng.range(1.2, 2.2), size: rng.range(0.6, 1.0), grow: 1.6, drag: 1.2, col: [205, 175, 135], a: 0.55 });
      }
      if (m.throttle > 0.6 && rng.chance(dt * 4)) this.spawn(m.x + cx * -0.9 + sz * 0.25, m.y + 0.9, m.z + sz * -0.9 - cx * 0.25, { vx: -cx * 0.5, vy: 0.6, vz: -sz * 0.5, life: 0.8, size: 0.3, grow: 1.2, col: [180, 190, 205], a: 0.4 });
    }
    update(dt) {
      for (const p of this.p) {
        if (!p.alive) continue;
        p.life += dt;
        if (p.life >= p.max) { p.alive = false; continue; }
        const dk = Math.exp(-p.drag * dt);
        p.vx *= dk; p.vz *= dk; p.vy = p.vy * dk - p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rot += p.vr * dt;
        if (p.g > 0) { const gy = this.groundY(p.x, p.z); if (p.y < gy) { p.y = gy; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; } }
      }
      /* rain near the camera */
      const g = this.game;
      if (g && g.raining()) {
        const cam = MX.App.renderer.cam;
        const amt = g.rainAmount();
        const n = Math.round(dt * 900 * amt * Math.min(1.5, 8 / cam.zoom + 0.5));
        const span = cam.w / (cam.zoom * cam.zoomMul) * 0.7;
        for (let i = 0; i < n; i++) {
          const x = cam.tx + U.rng.range(-span, span), z = cam.tz + U.rng.range(-span, span);
          const gy = this.groundY(x, z);
          this.spawn(x - 3, gy + 14, z - 3, { vx: 3, vy: -22, vz: 3, life: 0.64, size: 0.08, sh: 9, drag: 0, col: [190, 210, 235], a: 0.8, reg: 'p_drop' });
        }
      }
    }
    draw(r) {
      for (const p of this.p) {
        if (!p.alive) continue;
        const t = p.life / p.max;
        const s = p.size * (1 + p.grow * t);
        const a = p.a * (1 - t * t);
        r.pushSprite(p.x, p.y, p.z, s, s * p.sh, p.reg, p.col[0], p.col[1], p.col[2], Math.round(a * 255), p.rot);
      }
    }
  }
  MX.FX = FX;
})(window.MX);
