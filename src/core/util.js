/* MX Tycoon - core utilities: math, seeded RNG, noise, formatting, event bus. */
(function (root) {
  'use strict';
  const MX = root.MX = root.MX || {};
  MX.VERSION = '1.1.0';

  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.smoothstep = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  U.dist = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
  U.dist2 = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az; return dx * dx + dz * dz; };
  U.wrapAngle = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  U.angleLerp = (a, b, t) => a + U.wrapAngle(b - a) * t;
  U.mod = (a, n) => ((a % n) + n) % n;
  U.approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
  U.round = (v, step) => Math.round(v / step) * step;

  /* Mulberry32 seeded generator: deterministic worlds and riders. */
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
    next() {
      let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    normal() {
      let u = 0;
      while (u === 0) u = this.next();
      const v = this.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    weighted(list, wfn) {
      let total = 0;
      for (const it of list) total += Math.max(0, wfn(it));
      let r = this.next() * total;
      for (const it of list) {
        r -= Math.max(0, wfn(it));
        if (r <= 0) return it;
      }
      return list[list.length - 1];
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
  }
  U.RNG = RNG;
  U.rng = new RNG((Date.now() ^ 0x5bd1e995) >>> 0);

  /* Integer hash -> [0,1). Used by noise and by per-tile visual variation. */
  U.hash2 = (x, y, seed) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  U.valueNoise = (x, y, seed) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed);
    const c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
    return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
  };
  U.fbm = (x, y, seed, oct = 4) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += U.valueNoise(x * f, y * f, seed + i * 101) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };

  /* Formatting (Spanish conventions). */
  U.fmtInt = (n) => {
    const neg = n < 0;
    const s = String(Math.round(Math.abs(n)));
    let out = '';
    for (let i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += '.';
      out += s[i];
    }
    return (neg ? '-' : '') + out;
  };
  U.fmtMoney = (n) => U.fmtInt(n) + ' €';
  U.fmtMoneySigned = (n) => (n > 0 ? '+' : '') + U.fmtInt(n) + ' €';
  U.fmtPct = (v) => Math.round(v * 100) + '%';
  U.fmtLap = (sec) => {
    if (!isFinite(sec) || sec <= 0) return '--:--.--';
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  };
  U.fmtKmh = (mps) => Math.round(mps * 3.6) + ' km/h';
  U.fmtMeters = (m) => (m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(m) + ' m');
  U.fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');

  U.MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  U.MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  U.DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  U.DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  U.escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Base64 helpers for typed arrays (save games). */
  U.bytesToB64 = (bytes) => {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return (typeof btoa !== 'undefined') ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  };
  U.b64ToBytes = (b64) => {
    const bin = (typeof atob !== 'undefined') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  U.typedToB64 = (ta) => U.bytesToB64(new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength));
  U.b64ToTyped = (b64, Type) => {
    const bytes = U.b64ToBytes(b64);
    return new Type(bytes.buffer, 0, bytes.byteLength / Type.BYTES_PER_ELEMENT);
  };

  /* Minimal event bus decoupling simulation from UI, audio and rendering. */
  const listeners = new Map();
  MX.Bus = {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => listeners.get(evt).delete(fn);
    },
    off(evt, fn) { if (listeners.has(evt)) listeners.get(evt).delete(fn); },
    emit(evt, data) {
      const set = listeners.get(evt);
      if (!set) return;
      for (const fn of Array.from(set)) {
        try { fn(data); } catch (e) { console.error('[Bus]', evt, e); }
      }
    },
    clear() { listeners.clear(); }
  };

  MX.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
