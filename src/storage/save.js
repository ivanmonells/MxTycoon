/* MX Tycoon - saves: localStorage slots (+ autosave), gzip compression when the
   browser supports it, export/import as a text code. Every access is guarded. */
(function (MX) {
  'use strict';
  const U = MX.U;
  const PREFIX = 'mxtycoon.save.', META = 'mxtycoon.meta.';
  const SLOTS = ['auto', '1', '2', '3'];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return e; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  async function gzip(str) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const cs = new CompressionStream('gzip');
      const stream = new Blob([str]).stream().pipeThrough(cs);
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      return U.bytesToB64(buf);
    } catch (e) { return null; }
  }
  async function gunzip(b64) {
    const bytes = U.b64ToBytes(b64);
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }
  async function pack(obj) {
    const json = JSON.stringify(obj);
    const z = await gzip(json);
    return z ? 'gz:' + z : 'raw:' + json;
  }
  async function unpack(s) {
    if (!s) throw new Error('vacío');
    if (s.startsWith('gz:')) return JSON.parse(await gunzip(s.slice(3)));
    if (s.startsWith('raw:')) return JSON.parse(s.slice(4));
    return JSON.parse(s);
  }

  const Save = {
    SLOTS, pack, unpack,
    meta(slot) { const m = lsGet(META + slot); if (!m) return null; try { return JSON.parse(m); } catch (e) { return null; } },
    latest() {
      let best = null;
      for (const s of SLOTS) { const m = this.meta(s); if (m && (!best || m.ts > best.ts)) best = Object.assign({ slot: s }, m); }
      return best;
    },
    async save(slot, game) {
      if (!game) return { ok: false, reason: 'No hay partida' };
      let data;
      try { data = await pack(game.serialize()); } catch (e) { console.error(e); return { ok: false, reason: 'No se pudo preparar la partida' }; }
      const r = lsSet(PREFIX + slot, data);
      if (r !== true) return { ok: false, reason: 'El navegador no permite guardar (almacenamiento lleno o bloqueado). Exporta un código.' };
      lsSet(META + slot, JSON.stringify({ park: game.parkName, date: game.dateText(), money: Math.round(game.econ.money), ts: Date.now(), mode: game.mode, rep: Math.round(game.rep) }));
      return { ok: true };
    },
    async load(slot) {
      const raw = lsGet(PREFIX + slot);
      if (!raw) return { ok: false, reason: 'La ranura está vacía' };
      try { return { ok: true, data: await unpack(raw) }; } catch (e) { console.error(e); return { ok: false, reason: 'La partida guardada está dañada' }; }
    },
    remove(slot) { lsDel(PREFIX + slot); lsDel(META + slot); },
    async exportCode(game) { return 'MXT1.' + (await pack(game.serialize())); },
    async importCode(code) {
      code = (code || '').trim();
      if (!code) return { ok: false, reason: 'Pega primero un código de partida' };
      if (code.startsWith('MXT1.')) code = code.slice(5);
      try { return { ok: true, data: await unpack(code) }; } catch (e) { return { ok: false, reason: 'El código no es válido' }; }
    },
    settings(def) {
      const s = lsGet('mxtycoon.settings');
      try { return Object.assign({}, def, s ? JSON.parse(s) : {}); } catch (e) { return Object.assign({}, def); }
    },
    saveSettings(s) { lsSet('mxtycoon.settings', JSON.stringify(s)); },
    flag(k, v) { if (v === undefined) return lsGet('mxtycoon.flag.' + k); lsSet('mxtycoon.flag.' + k, String(v)); }
  };
  MX.Save = Save;
})(window.MX);
