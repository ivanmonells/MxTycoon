/* MX Tycoon - construction panels: tracks (editor, features, surfaces, widths,
   validation, testing, opening), terrain, buildings, paths and decoration. */
(function (MX) {
  'use strict';
  const { h, icon, clear, bar, chip } = MX.DOM;
  const U = MX.U, C = MX.C, Cat = MX.Catalog;
  const T = C.TILE;
  const WM = MX.WM;
  const keyed = MX.UIKeyed;
  const app = () => MX.App;
  const game = () => MX.App.game;
  const TL = () => MX.Tools.list;

  const STATE = { building: ['En obras', 'warn'], testing: ['En pruebas', 'info'], open: ['Abierto', 'good'], closed: ['Cerrado', 'neutral'] };
  const thumbs = {};
  function thumb(kind, type) {
    const key = kind + ':' + type;
    if (thumbs[key]) return thumbs[key];
    const r = app().renderer;
    let mesh, center, radius;
    if (kind === 'b') {
      const d = Cat.buildings[type];
      mesh = MX.BuildModels.preview(type, 0);
      center = [0, d.height * 0.42, 0]; radius = Math.max(d.w, d.h) * T * 0.62 + 1;
    } else {
      mesh = MX.BuildModels.decorPreview(type);
      center = [0, 1.4, 0]; radius = 3.2;
    }
    try { thumbs[key] = r.thumbnail(mesh.data, mesh.count, 72, center, radius); } catch (e) { thumbs[key] = MX.DOM.iconURL('build', 4); }
    return thumbs[key];
  }
  function lockReason(def) {
    if (!def.unlock) return '';
    const [kind, id] = def.unlock.split(':');
    if (kind === 'research') { const r = Cat.research.find(x => x.id === id); return 'Investiga: ' + (r ? r.name : id); }
    return 'Completa objetivos de carrera';
  }
  function statRow(label, value, extra) { return h('div', { class: 'kv' }, h('span', null, label), h('b', null, value), extra || null); }

  /* ================= Tracks ================= */
  function tracksPanel(sel) {
    if (sel) game().selectedTrack = sel;
    WM.open('tracks', {
      title: 'Circuitos', icon: 'track', width: 420, rebuild: !!sel,
      build: (body) => {
        const list = h('div', { class: 'track-list' });
        const head = h('div', { class: 'row gap' },
          h('button', { id: 'win-tracks-new', class: 'btn primary', onclick: () => newTrack() }, icon('track'), 'Nuevo circuito'),
          h('button', { class: 'btn', title: 'Genera un circuito cerrado con salida, meta y algunos saltos en tu terreno libre', onclick: () => suggested() }, icon('jump'), 'Trazado sugerido'));
        const detail = h('div', { class: 'track-detail' });
        body.append(head, list, detail);
        return () => {
          const g = game();
          const sel = g.selectedTrack;
          const building = !!(sel && sel.pieces && !sel.closed && document.documentElement.classList.contains('phone'));
          body.classList.toggle('constructing', building);
          WM.setTitle('tracks', building ? 'Construcción · ' + sel.name : 'Circuitos');
          keyed(list, g.tracks.map(t => t.id + t.state + t.name + (g.selectedTrack === t)).join('|'), (el) => {
            if (!g.tracks.length) el.append(h('p', { class: 'muted' }, 'Aún no tienes circuitos. Pulsa «Nuevo circuito», coloca la parrilla de salida y construye el trazado pieza a pieza.'));
            for (const t of g.tracks) {
              const st = STATE[t.state];
              el.append(h('button', { class: 'track-chip' + (g.selectedTrack === t ? ' on' : ''), onclick: () => { g.selectedTrack = t; t.ver++; } },
                h('b', null, t.name), chip(st[0], st[1]), h('small', null, t.S ? U.fmtMeters(t.length) : 'sin trazado')));
            }
          });
          const tr = g.selectedTrack;
          keyed(detail, tr ? tr.id + ':' + tr.state + ':' + (tr.closed ? 1 : 0) + ':' + (tr.origin ? 1 : 0) + ':' + (app().trackUI.section) : 'none', (el) => buildTrackDetail(el, tr));
          if (tr && detail._upd) detail._upd();
        };
      }
    });
  }
  function newTrack() {
    const g = game();
    const tr = g.newTrack();
    if (!tr) { app().hud.toast('Has alcanzado el máximo de circuitos', 'bad'); return; }
    MX.Tools.set(TL().TrackStart);
    const phone = document.documentElement.classList.contains('phone');
    app().hud.toast(phone ? 'Toca tu terreno para ver la parrilla y toca encima para colocarla' : 'Haz clic en tu terreno para colocar la parrilla de salida (R para girarla)', 'info');
  }
  function buildTrackDetail(el, tr) {
    if (!tr) return;
    const g = game(), ui = app().trackUI;
    const nameIn = h('input', { id: 'track-name', class: 'inp', value: tr.name, maxlength: 28, 'aria-label': 'Nombre del circuito', onchange: (e) => { tr.name = e.target.value || tr.name; tr.ver++; } });
    const st = STATE[tr.state];
    el.append(h('div', { class: 'row gap center name-row' }, nameIn, chip(st[0], st[1])));
    /* tools */
    const editable = tr.state !== 'open';
    const toolBtn = (ic, label, tool, extra) => {
      const b = h('button', { class: 'btn tool' + (MX.Tools.current === tool ? ' on' : ''), disabled: !editable, onclick: () => { if (extra) extra(); MX.Tools.set(tool); app().panels.tracks(); } }, icon(ic), label);
      return b;
    };
    if (tr.pieces && !tr.origin) {
      el.append(h('div', { class: 'callout' }, icon('info'), h('span', null, 'Haz clic en tu terreno para colocar la parrilla de salida. Pulsa R para girarla. En pantallas táctiles, toca para verla y vuelve a tocar encima para colocarla. Después irás construyendo el circuito pieza a pieza.')),
        h('div', { class: 'row gap wrap' },
          toolBtn('track', 'Colocar la salida', TL().TrackStart),
          h('button', { class: 'btn', title: 'Girar la parrilla 45 grados (R)', onclick: () => { if (MX.Tools.current !== TL().TrackStart) MX.Tools.set(TL().TrackStart); TL().TrackStart.rotate(); } }, icon('rotate'), 'Girar'),
          h('button', { class: 'btn danger', onclick: () => delTrack(tr) }, icon('demolish'), 'Borrar')));
      widthSurface(el, tr, true);
      return;
    }
    if (tr.pieces && !tr.closed) { constructorUI(el, tr); return; }
    if (!tr.closed) {
      el.append(h('div', { class: 'callout' }, icon('info'), h('span', null, 'Dibuja el trazado haciendo clic sobre tu terreno. Cierra el circuito volviendo al primer punto. Coste: ', h('b', null, U.fmtMoney(tr.geometryCost())))));
      el.append(h('div', { class: 'row gap wrap' },
        toolBtn('track', 'Dibujar', TL().TrackDraw),
        h('button', { class: 'btn', disabled: tr.nodes.length < 4, onclick: () => TL().TrackDraw.close() }, icon('check'), 'Cerrar trazado'),
        h('button', { class: 'btn danger', onclick: () => delTrack(tr) }, icon('demolish'), 'Borrar')));
      widthSurface(el, tr, true);
      return;
    }
    const sections = [['features', 'Elementos', 'jump'], ['surface', 'Superficie', 'paint'], ['shape', 'Trazado', 'track'], ['stats', 'Ficha', 'chart']];
    const tabs = h('div', { class: 'subtabs' });
    for (const [id, label, ic] of sections) tabs.append(h('button', { class: 'tab' + (ui.section === id ? ' on' : ''), onclick: () => { ui.section = id; WM.rebuild('tracks'); } }, icon(ic), label));
    el.append(tabs);
    const sec = h('div', { class: 'sec' });
    el.append(sec);
    if (!editable && ui.section !== 'stats') sec.append(h('div', { class: 'callout warn' }, icon('lock'), 'El circuito está abierto. Ciérralo para modificarlo.'));
    if (ui.section === 'features') {
      for (const grp of Cat.featureGroups) {
        const row = h('div', { class: 'feat-grid' });
        for (const k in Cat.features) {
          const d = Cat.features[k];
          if (d.group !== grp.id) continue;
          const locked = !g.isUnlocked(d);
          const on = MX.Tools.current === TL().TrackFeature && TL().TrackFeature.type === k;
          row.append(h('button', { class: 'feat' + (on ? ' on' : '') + (locked ? ' locked' : ''), disabled: !editable, title: (locked ? lockReason(d) + ' · ' : '') + d.desc,
            onclick: () => { if (locked) { app().hud.toast(lockReason(d), 'bad'); return; } TL().TrackFeature.type = k; MX.Tools.set(TL().TrackFeature); WM.rebuild('tracks'); } },
            h('span', { class: 'feat-ic' }, featureGlyph(d)), h('b', null, d.name), h('small', null, locked ? 'Bloqueado' : U.fmtMoney(d.cost))));
        }
        sec.append(h('h4', null, grp.name), row);
      }
      const feats = h('div', { class: 'feat-list' });
      sec.append(h('h4', null, 'Elementos colocados'), feats);
      el._upd = () => keyed(feats, tr.features.map(f => f.uid).join(','), (fl) => {
        if (!tr.features.length) fl.append(h('p', { class: 'muted' }, 'Ninguno todavía.'));
        for (const f of tr.features) fl.append(h('div', { class: 'feat-row' }, h('span', null, Cat.features[f.type].name), h('small', null, Math.round(f.s) + ' m'),
          h('button', { class: 'mini', title: 'Ver', onclick: () => { const i = tr.sIndex(f.s); app().lookAt(tr.S.x[i], tr.S.z[i]); } }, icon('follow')),
          h('button', { class: 'mini danger', title: 'Quitar', disabled: !editable, onclick: () => { const r = g.removeFeature(tr, f.uid); if (r.ok) MX.Audio.sfx('demolish'); else app().hud.toast(r.reason, 'bad'); } }, icon('close'))));
      });
    } else if (ui.section === 'surface') {
      widthSurface(sec, tr, false);
    } else if (ui.section === 'shape' && tr.pieces) {
      const curves = tr.pieces.filter(p => p.t === 'curve').length;
      sec.append(statRow('Piezas', tr.pieces.length + ' (' + curves + ' curvas)'), statRow('Longitud', U.fmtMeters(tr.length)),
        h('p', { class: 'muted small' }, 'Para cambiar el trazado, quita piezas desde el final y vuelve a construir. La primera pieza que quites abre el circuito.'),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'btn', disabled: !editable, onclick: () => { const r = g.removeLastPiece(tr); if (r.ok) { MX.Audio.sfx('demolish'); MX.Tools.set(TL().TrackBuild); WM.rebuild('tracks'); } else app().hud.toast(r.reason, 'bad'); } }, icon('demolish'), 'Quitar la última pieza')));
    } else if (ui.section === 'shape') {
      sec.append(h('div', { class: 'row gap wrap' },
        toolBtn('track', 'Editar puntos', TL().TrackEdit),
        toolBtn('raise', 'Subidas y bajadas', TL().TrackElev),
        h('button', { class: 'btn', disabled: !editable, onclick: () => { g.editTrack(tr, (t) => { t.closed = false; }); MX.Tools.set(TL().TrackDraw); WM.rebuild('tracks'); } }, icon('track'), 'Reabrir trazado')));
      sec.append(h('p', { class: 'muted small' }, 'Arrastra los puntos para cambiar curvas y rectas. Haz clic sobre la pista para añadir un punto. Con «Subidas y bajadas» elevas la pista sobre un terraplén. Para colinas y vaguadas usa también la herramienta Terreno.'));
    } else if (ui.section === 'stats') {
      const box = h('div', { class: 'stats-box' });
      sec.append(box);
      el._upd = () => keyed(box, tr.stats ? tr.ver + ':' + tr.totals.laps + ':' + Math.round(tr.avgWear() * 20) : 'none:' + tr.ver, (b) => fillStats(b, tr));
    }
    /* validation and actions */
    const issues = h('div', { class: 'issues' });
    el.append(issues);
    const prevUpd = el._upd;
    el._upd = () => {
      if (prevUpd) prevUpd();
      keyed(issues, (tr.fullIssues || tr.issues || []).map(i => i.msg).join('|'), (box) => {
        const list = tr.fullIssues || tr.issues || [];
        if (!list.length) return;
        for (const i of list) box.append(h('div', { class: 'issue ' + i.level }, icon(i.level === 'error' ? 'cross' : 'warn'), h('span', null, i.msg),
          i.x != null ? h('button', { class: 'mini', title: 'Ver', onclick: () => app().lookAt(i.x, i.z) }, icon('follow')) : null));
      });
    };
    const acts = h('div', { class: 'row gap wrap actions' });
    acts.append(h('button', { class: 'btn', onclick: () => { const is = g.validateTrack(tr); const ok = !is.some(i => i.level === 'error'); app().hud.toast(ok ? 'Circuito válido' : 'Hay problemas que corregir', ok ? 'good' : 'bad'); MX.Audio.sfx(ok ? 'success' : 'error'); WM.rebuild('tracks'); } }, icon('check'), 'Validar'));
    if (tr.state !== 'open') {
      acts.append(h('button', { class: 'btn', onclick: () => { const r = g.testTrack(tr); if (r.ok) { MX.Audio.sfx('gate'); app().panels.testReport(tr); } else app().hud.toast(r.reason, 'bad'); WM.rebuild('tracks'); } }, icon('rider'), 'Probar'));
      acts.append(h('button', { class: 'btn primary', onclick: () => { const r = g.openTrack(tr); if (r.ok) { MX.Audio.sfx('success'); app().fx.confettiAt && app().fx.confettiAt(tr); } else { app().hud.toast(r.reason, 'bad'); MX.Audio.sfx('error'); } WM.rebuild('tracks'); } }, icon('events'), 'Abrir al público'));
    } else acts.append(h('button', { class: 'btn', onclick: () => { const r = g.closeTrack(tr); if (!r.ok) app().hud.toast(r.reason, 'bad'); WM.rebuild('tracks'); } }, icon('lock'), 'Cerrar para obras'));
    acts.append(h('button', { class: 'btn danger', onclick: () => delTrack(tr) }, icon('demolish'), 'Borrar'));
    el.append(acts);
  }
  function featureGlyph(d) {
    const c = h('canvas', { width: 34, height: 18, class: 'glyph' });
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(0, 15, 34, 3);
    ctx.fillStyle = '#b07a45';
    ctx.beginPath(); ctx.moveTo(0, 15);
    const sh = MX.Track.getShape(Object.keys(Cat.features).find(k => Cat.features[k] === d));
    if (sh && sh.fn && sh.len) {
      for (let x = 0; x <= 34; x++) { const u = x / 34 * sh.len; ctx.lineTo(x, 15 - Math.min(13, sh.fn(u) * 4.2)); }
    } else if (d.kind === 'berm') { ctx.lineTo(10, 15); ctx.quadraticCurveTo(28, 14, 32, 3); ctx.lineTo(34, 15); }
    else if (d.kind === 'start') { ctx.fillStyle = '#ffd22e'; for (let i = 0; i < 5; i++) ctx.fillRect(3 + i * 6, 6, 4, 9); }
    else if (d.kind === 'finish') { for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(4 + i * 4.5, 8 + j * 4, 4.5, 4); } }
    ctx.lineTo(34, 15); ctx.closePath(); ctx.fill();
    return c;
  }
  /* ================= Piece-by-piece constructor ================= */
  const BUILD_DIRS = [
    { id: 'L1', kind: 'curve', k: 1, dir: -1, name: 'Curva cerrada a la izquierda' },
    { id: 'L2', kind: 'curve', k: 2, dir: -1, name: 'Curva media a la izquierda' },
    { id: 'L3', kind: 'curve', k: 3, dir: -1, name: 'Curva abierta a la izquierda' },
    { id: 'S', kind: 'straight', name: 'Recta' },
    { id: 'R3', kind: 'curve', k: 3, dir: 1, name: 'Curva abierta a la derecha' },
    { id: 'R2', kind: 'curve', k: 2, dir: 1, name: 'Curva media a la derecha' },
    { id: 'R1', kind: 'curve', k: 1, dir: 1, name: 'Curva cerrada a la derecha' }
  ];
  const BUILD_SLOPES = [[-2, 'Bajada fuerte'], [-1, 'Bajada'], [0, 'Llano'], [1, 'Subida'], [2, 'Subida fuerte']];
  const BUILD_LENS = [[1, 'Corta'], [3, 'Media'], [6, 'Larga']];
  const BUILD_BANKS = [[0, 'Sin peralte'], [1, 'Peralte'], [2, 'Peralte grande']];
  const SPECIALS = ['finish', 'tabletop_s', 'tabletop_m', 'tabletop_l', 'double_s', 'double_l', 'triple', 'stepup', 'plateau', 'whoops', 'rollers', 'dubbies', 'rhythm'];
  function buildState() {
    const ui = app().trackUI;
    if (!ui.build) ui.build = { dir: 'S', n: 3, slope: 0, bank: 0, special: null };
    return ui.build;
  }
  function currentPiece() {
    const b = buildState(), ui = app().trackUI;
    const base = { w: ui.width, surf: ui.surface, slope: 0, bank: 0 };
    if (b.special) return Object.assign(base, { t: 'special', f: b.special });
    const d = BUILD_DIRS.find(x => x.id === b.dir) || BUILD_DIRS[3];
    if (d.kind === 'curve') return Object.assign(base, { t: 'curve', k: d.k, dir: d.dir, slope: b.slope, bank: b.bank });
    return Object.assign(base, { t: 'straight', n: b.n, slope: b.slope });
  }
  function pieceName(p) {
    if (p.t === 'special') return Cat.features[p.f].name;
    const sl = ({ '-2': ' en bajada fuerte', '-1': ' en bajada', '1': ' en subida', '2': ' en subida fuerte' })[p.slope] || '';
    if (p.t === 'curve') {
      const d = BUILD_DIRS.find(x => x.kind === 'curve' && x.k === p.k && x.dir === p.dir);
      return d.name + sl + (p.bank === 2 ? ' con peralte grande' : p.bank ? ' con peralte' : '');
    }
    return 'Recta ' + ({ 1: 'corta', 3: 'media', 6: 'larga' }[p.n] || '') + sl;
  }
  /* top view of a piece: brown band with an arrow */
  function dirGlyph(d) {
    const c = h('canvas', { width: 44, height: 34, class: 'glyph-dir' });
    const x = c.getContext('2d');
    x.lineCap = 'round';
    let ex = 22, ey = 6, ang = -Math.PI / 2;
    const path = () => {
      x.beginPath(); x.moveTo(22, 32);
      if (d.kind === 'straight') { x.lineTo(22, 8); ex = 22; ey = 8; ang = -Math.PI / 2; return; }
      const R = [0, 9, 14, 21][d.k], th = 1.15, s = d.dir;
      x.lineTo(22, 28);
      if (s > 0) { x.arc(22 + R, 28, R, Math.PI, Math.PI + th, false); ex = 22 + R + R * Math.cos(Math.PI + th); ey = 28 + R * Math.sin(Math.PI + th); ang = -Math.PI / 2 + th; }
      else { x.arc(22 - R, 28, R, 0, -th, true); ex = 22 - R + R * Math.cos(-th); ey = 28 + R * Math.sin(-th); ang = -Math.PI / 2 - th; }
    };
    x.strokeStyle = '#1a1410'; x.lineWidth = 9; path(); x.stroke();
    x.strokeStyle = '#b07a45'; x.lineWidth = 6; path(); x.stroke();
    x.fillStyle = '#ffd22e'; x.strokeStyle = '#1a1410'; x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(ex + Math.cos(ang) * 6, ey + Math.sin(ang) * 6);
    x.lineTo(ex + Math.cos(ang + 2.4) * 6, ey + Math.sin(ang + 2.4) * 6);
    x.lineTo(ex + Math.cos(ang - 2.4) * 6, ey + Math.sin(ang - 2.4) * 6);
    x.closePath(); x.fill(); x.stroke();
    return c;
  }
  /* side view of a slope */
  function slopeGlyph(sl) {
    const c = h('canvas', { width: 44, height: 24, class: 'glyph-slope' });
    const x = c.getContext('2d');
    const y0 = 16 + (sl > 0 ? 3 : sl < 0 ? -5 : 0), y1 = y0 - sl * 5.5;
    x.fillStyle = '#6b4a2b';
    x.beginPath(); x.moveTo(3, 23); x.lineTo(3, y0); x.lineTo(41, y1); x.lineTo(41, 23); x.closePath(); x.fill();
    x.strokeStyle = '#1a1410'; x.lineWidth = 5; x.beginPath(); x.moveTo(3, y0); x.lineTo(41, y1); x.stroke();
    x.strokeStyle = '#b07a45'; x.lineWidth = 3; x.beginPath(); x.moveTo(3, y0); x.lineTo(41, y1); x.stroke();
    return c;
  }
  function constructorUI(el, tr) {
    const g = game(), ui = app().trackUI, b = buildState();
    const status = h('div', { class: 'bld-status' });
    const preview = h('div', { class: 'bld-preview' });
    const box = h('div', { class: 'builder' });
    el.append(box);
    const cur = MX.Tools.current;
    if (cur !== TL().TrackBuild && (!cur || cur.name === 'select' || cur.name.startsWith('track'))) MX.Tools.set(TL().TrackBuild);
    const changed = () => { MX.Audio.sfx('click'); WM.rebuild('tracks'); TL().TrackBuild.refresh(); };
    /* mouse clicks don't take focus here, so Enter keeps meaning "build" */
    const noFocus = (e) => e.preventDefault();
    const opt = (cls, on, title, onclick, ...kids) => h('button', { class: cls + (on ? ' on' : ''), title, 'aria-label': title, 'aria-pressed': on ? 'true' : 'false', onclick, onmousedown: noFocus }, ...kids);
    const d = BUILD_DIRS.find(x => x.id === b.dir) || BUILD_DIRS[3];
    if (document.documentElement.classList.contains('phone')) { compactConstructor(box, tr, b, d, status, preview, opt, changed, noFocus, el); return; }
    box.append(status);
    /* direction */
    const dirs = h('div', { class: 'bld-dirs' });
    for (const dd of BUILD_DIRS) dirs.append(opt('bld-btn', !b.special && b.dir === dd.id, dd.name, () => { b.dir = dd.id; b.special = null; changed(); }, dirGlyph(dd)));
    box.append(h('h4', null, 'Dirección'), dirs);
    if (!b.special && d.kind === 'straight') {
      const lens = h('div', { class: 'row gap wrap' });
      for (const [n, label] of BUILD_LENS) lens.append(opt('btn small', b.n === n, 'Recta ' + label.toLowerCase(), () => { b.n = n; changed(); }, label + ' · ' + n * C.TILE + ' m'));
      box.append(lens);
    }
    if (!b.special && d.kind === 'curve') {
      const banks = h('div', { class: 'row gap wrap' });
      for (const [v, label] of BUILD_BANKS) {
        const locked = v === 2 && !g.isUnlocked(Cat.features.berm_big);
        banks.append(opt('btn small' + (locked ? ' locked' : ''), b.bank === v, locked ? lockReason(Cat.features.berm_big) : label, () => { if (locked) { app().hud.toast(lockReason(Cat.features.berm_big), 'bad'); return; } b.bank = v; changed(); }, label, locked ? icon('lock') : null));
      }
      box.append(banks);
    }
    /* slope */
    if (!b.special) {
      const slopes = h('div', { class: 'bld-slopes' });
      for (const [v, label] of BUILD_SLOPES) slopes.append(opt('bld-btn', (b.slope || 0) === v, label, () => { b.slope = v; changed(); }, slopeGlyph(v), h('small', null, label)));
      box.append(h('h4', null, 'Pendiente'), slopes);
    }
    /* special pieces */
    const sp = h('div', { class: 'bld-specials' });
    sp.append(opt('feat', !b.special, 'Pieza normal', () => { b.special = null; changed(); }, h('span', { class: 'feat-ic' }, dirGlyph(BUILD_DIRS[3])), h('b', null, 'Normal'), h('small', null, 'Tramo de pista')));
    for (const k of SPECIALS) {
      const fd = Cat.features[k];
      const locked = !g.isUnlocked(fd);
      sp.append(opt('feat' + (locked ? ' locked' : ''), b.special === k, (locked ? lockReason(fd) + ' · ' : '') + fd.desc, () => { if (locked) { app().hud.toast(lockReason(fd), 'bad'); return; } b.special = k; changed(); },
        h('span', { class: 'feat-ic' }, featureGlyph(fd)), h('b', null, fd.name), h('small', null, locked ? 'Bloqueado' : U.fmtMoney(fd.cost))));
    }
    box.append(h('h4', null, 'Pieza especial'), sp);
    widthSurface(box, tr, true);
    box.append(preview,
      h('div', { class: 'row gap wrap bld-actions' },
        h('button', { id: 'bld-build', class: 'btn primary big-ish', onmousedown: noFocus, onclick: () => TL().TrackBuild.build() }, icon('build'), 'Construir pieza'),
        h('button', { id: 'bld-undo', class: 'btn', onmousedown: noFocus, onclick: () => TL().TrackBuild.undo() }, icon('demolish'), 'Quitar la última'),
        h('button', { id: 'bld-auto', class: 'btn', onmousedown: noFocus, title: 'Busca el camino más corto hasta la salida y lo construye', onclick: () => TL().TrackBuild.auto() }, icon('check'), 'Cerrar automáticamente')),
      h('p', { class: 'muted small' }, 'Intro: construir · Retroceso: quitar la última · Flechas izquierda y derecha: dirección · arriba y abajo: pendiente'),
      h('div', { class: 'row gap' }, h('button', { class: 'btn small danger', onclick: () => delTrack(tr) }, icon('demolish'), 'Borrar circuito')));
    el._upd = constructorStatus(tr, status, preview);
  }
  function constructorStatus(tr, status, preview) {
    return () => {
      const e = tr.endPose, o = tr.origin;
      clear(status);
      if (e && o) {
        const dist = Math.hypot(e.x - o.x, e.z - o.z) * C.TILE;
        status.append(h('span', null, h('b', null, tr.pieces.length), tr.pieces.length === 1 ? ' pieza' : ' piezas'), h('span', null, h('b', null, U.fmtMeters(tr.length))),
          h('span', null, 'Altura ', h('b', null, (e.e > 0 ? '+' : '') + U.fmt1(e.e) + ' m')), h('span', null, 'Salida a ', h('b', null, U.fmtMeters(dist))),
          h('span', null, 'Invertido ', h('b', null, U.fmtMoney(tr.paid))));
      }
      const pr = TL().TrackBuild.probe;
      const key = pr ? (pr.ok ? 'ok' : 'no') + pr.reason + pr.cost + (pr.closes ? 'c' : '') + JSON.stringify(currentPiece()) : 'none';
      if (preview._k === key) return;
      preview._k = key;
      clear(preview);
      if (!pr) return;
      const p = currentPiece();
      preview.className = 'bld-preview ' + (pr.ok ? (pr.closes ? 'closes' : 'ok') : 'bad');
      preview.append(icon(pr.ok ? (pr.closes ? 'trophy' : 'check') : 'cross'),
        h('span', null, h('b', null, pieceName(p)), pr.g ? ' · ' + U.fmtMeters(pr.g.len) : '', pr.ok ? ' · ' + U.fmtMoney(pr.cost) : '', pr.ok && pr.closes ? ' · ¡cierra el circuito!' : '',
          !pr.ok ? h('em', null, pr.reason) : null));
    };
  }
  /* Phones: directions, slopes and the build buttons first; the rest folds away. */
  function compactConstructor(box, tr, b, d, status, preview, opt, changed, noFocus, el) {
    const g = game();
    box.classList.add('compact');
    box.append(status);
    const dirs = h('div', { class: 'bld-dirs' });
    for (const dd of BUILD_DIRS) dirs.append(opt('bld-btn', !b.special && b.dir === dd.id, dd.name, () => { b.dir = dd.id; b.special = null; changed(); }, dirGlyph(dd)));
    box.append(dirs);
    const ctx = h('div', { class: 'row gap bld-ctx' });
    if (b.special) {
      ctx.append(h('span', { class: 'chip chip-info' }, Cat.features[b.special].name), opt('btn small', false, 'Volver a una pieza normal', () => { b.special = null; changed(); }, 'Pieza normal'));
    } else if (d.kind === 'straight') {
      for (const [n, label] of BUILD_LENS) ctx.append(opt('btn small', b.n === n, 'Recta ' + label.toLowerCase(), () => { b.n = n; changed(); }, label));
    } else {
      for (const [v, label] of BUILD_BANKS) {
        const locked = v === 2 && !g.isUnlocked(Cat.features.berm_big);
        ctx.append(opt('btn small' + (locked ? ' locked' : ''), b.bank === v, label, () => { if (locked) { app().hud.toast(lockReason(Cat.features.berm_big), 'bad'); return; } b.bank = v; changed(); }, v === 0 ? 'Sin peralte' : v === 1 ? 'Peralte' : 'Grande', locked ? icon('lock') : null));
      }
    }
    box.append(ctx);
    if (!b.special) {
      const slopes = h('div', { class: 'bld-slopes' });
      for (const [v, label] of BUILD_SLOPES) slopes.append(opt('bld-btn', (b.slope || 0) === v, label, () => { b.slope = v; changed(); }, slopeGlyph(v)));
      box.append(slopes);
    }
    box.append(preview,
      h('div', { class: 'row gap bld-actions' },
        h('button', { id: 'bld-build', class: 'btn primary big-ish', onmousedown: noFocus, onclick: () => TL().TrackBuild.build() }, icon('build'), 'Construir'),
        h('button', { id: 'bld-undo', class: 'btn', title: 'Quitar la última pieza', onmousedown: noFocus, onclick: () => TL().TrackBuild.undo() }, icon('demolish'), 'Quitar'),
        h('button', { id: 'bld-auto', class: 'btn', title: 'Cerrar automáticamente: busca el camino más corto hasta la salida', onmousedown: noFocus, onclick: () => TL().TrackBuild.auto() }, icon('check'), 'Cerrar'),
        opt('btn bld-dots', !!b.more, 'Más opciones: piezas especiales, anchura, superficie', () => { b.more = b.more ? null : 'menu'; changed(); }, h('span', { class: 'dots' }, '•••'))));
    if (b.more) box.append(h('div', { class: 'row gap bld-more' },
      opt('btn small', b.more === 'sp', 'Piezas especiales: meta y saltos', () => { b.more = b.more === 'sp' ? 'menu' : 'sp'; changed(); }, icon('jump'), 'Especiales'),
      opt('btn small', b.more === 'ws', 'Anchura y superficie', () => { b.more = b.more === 'ws' ? 'menu' : 'ws'; changed(); }, icon('paint'), 'Ancho y suelo'),
      h('button', { class: 'btn small danger', title: 'Borrar circuito', 'aria-label': 'Borrar circuito', onmousedown: noFocus, onclick: () => delTrack(tr) }, icon('demolish'))));
    if (b.more === 'sp') {
      const sp = h('div', { class: 'bld-strip' });
      for (const k of SPECIALS) {
        const fd = Cat.features[k];
        const locked = !g.isUnlocked(fd);
        sp.append(opt('feat' + (locked ? ' locked' : ''), b.special === k, (locked ? lockReason(fd) + ' · ' : '') + fd.name, () => { if (locked) { app().hud.toast(lockReason(fd), 'bad'); return; } b.special = k; changed(); },
          h('span', { class: 'feat-ic' }, featureGlyph(fd)), h('b', null, fd.name), h('small', null, locked ? 'Bloqueado' : U.fmtMoney(fd.cost))));
      }
      box.append(sp);
    } else if (b.more === 'ws') widthSurface(box, tr, true);
    el._upd = constructorStatus(tr, status, preview);
  }

  function widthSurface(el, tr, beforeClose) {
    const g = game(), ui = app().trackUI;
    const editable = tr.state !== 'open';
    const srow = h('div', { class: 'row gap wrap' });
    for (const k of Cat.surfaceOrder) {
      const d = Cat.surfaces[k];
      const locked = !g.isUnlocked(d);
      const on = beforeClose ? ui.surface === k : (MX.Tools.current === TL().TrackSurface && TL().TrackSurface.surface === k);
      srow.append(h('button', { class: 'btn swatch' + (on ? ' on' : '') + (locked ? ' locked' : ''), disabled: !editable, title: locked ? lockReason(d) : d.name + ' · ' + U.fmtMoney(d.cost) + '/m', onmousedown: (e) => e.preventDefault(),
        onclick: () => {
          if (locked) { app().hud.toast(lockReason(d), 'bad'); return; }
          ui.surface = k;
          if (!beforeClose) { TL().TrackSurface.surface = k; MX.Tools.set(TL().TrackSurface); }
          WM.rebuild('tracks');
          if (MX.Tools.current === TL().TrackBuild || MX.Tools.current === TL().TrackStart) MX.Tools.current.refresh();
        } }, h('i', { style: { background: d.color } }), d.name, locked ? icon('lock') : null));
    }
    const wrow = h('div', { class: 'row gap wrap' });
    for (const wv of [6, 7, 8, 10, 12]) {
      const on = beforeClose ? ui.width === wv : (MX.Tools.current === TL().TrackWidth && TL().TrackWidth.width === wv);
      wrow.append(h('button', { class: 'btn small' + (on ? ' on' : ''), disabled: !editable, onmousedown: (e) => e.preventDefault(), onclick: () => { ui.width = wv; if (!beforeClose) { TL().TrackWidth.width = wv; MX.Tools.set(TL().TrackWidth); } WM.rebuild('tracks'); if (MX.Tools.current === TL().TrackBuild || MX.Tools.current === TL().TrackStart) MX.Tools.current.refresh(); } }, wv + ' m'));
    }
    el.append(h('h4', null, beforeClose ? 'Superficie de las nuevas piezas' : 'Superficie (clic o arrastra sobre un tramo)'), srow,
      h('h4', null, beforeClose ? 'Anchura de las nuevas piezas' : 'Anchura (clic sobre un tramo)'), wrow);
    const info = h('div', { class: 'surf-info' });
    const d = Cat.surfaces[ui.surface];
    info.append(h('small', { class: 'muted' }, d.name + ': agarre ' + Math.round(d.grip * 100) + '%, ' + (d.drag > 1.1 ? 'frena las motos' : d.drag < 1 ? 'rápida' : 'velocidad normal') + ', desgaste ×' + d.wear + ', dificultad ' + (d.diff >= 0 ? '+' : '') + d.diff + '.'));
    el.append(info);
  }
  function fillStats(b, tr) {
    const st = tr.stats;
    if (!st) {
      b.append(h('p', { class: 'muted' }, 'Pulsa «Probar» para que tres pilotos de prueba midan el circuito, o ábrelo para calcular su ficha.'));
      b.append(statRow('Longitud', U.fmtMeters(tr.length)), statRow('Coste de obra', U.fmtMoney(tr.geometryCost() + tr.featureCost())));
      return;
    }
    const A = MX.TrackAnalyzer;
    b.append(
      h('div', { class: 'big-stats' },
        h('div', null, h('small', null, 'Dificultad'), h('b', null, U.fmt1(st.diff)), h('em', null, A.difficultyLabel(st.diff))),
        h('div', null, h('small', null, 'Valoración'), h('b', null, U.fmt1(st.rating)), h('em', null, st.rating >= 7 ? 'Excelente' : st.rating >= 5.5 ? 'Buena' : st.rating >= 4 ? 'Correcta' : 'Floja')),
        h('div', null, h('small', null, 'Seguridad'), h('b', null, Math.round(st.safety * 100) + '%'), h('em', null, st.safety >= 0.7 ? 'Alta' : st.safety >= 0.5 ? 'Media' : 'Baja'))),
      statRow('Homologación', A.HOMOLOG_NAMES[st.homolog]),
      statRow('Longitud', U.fmtMeters(st.length) + ' · ancho medio ' + U.fmt1(st.width) + ' m'),
      statRow('Vuelta profesional', U.fmtLap(st.lapPro) + ' · amateur ' + U.fmtLap(st.lapAm)),
      statRow('Vuelta principiante', U.fmtLap(st.lapBeg)),
      statRow('Velocidad máx. / media', U.fmtKmh(st.maxSpeed) + ' / ' + U.fmtKmh(st.avgSpeed)),
      statRow('Tiempo en el aire (pro)', U.fmt1(st.airPro) + ' s por vuelta'),
      statRow('Saltos · rítmicos · peraltes', st.jumps + ' · ' + st.rhythm + ' · ' + st.berms),
      statRow('Curvas (cerradas)', st.corners + ' (' + st.tight + ')'),
      statRow('Desnivel', U.fmt1(st.elev) + ' m'),
      statRow('Zonas de riesgo protegidas', Math.round(st.protectedRatio * 100) + '% de ' + st.hazards),
      statRow('Capacidad', st.capacity + ' pilotos a la vez'),
      statRow('Mantenimiento', U.fmtMoney(st.maint) + ' al mes'),
      statRow('Estado de la pista', Math.round((1 - tr.avgWear()) * 100) + '%', bar(1 - tr.avgWear(), 1, tr.avgWear() > 0.5 ? 'bad' : 'good')),
      statRow('Vueltas · caídas · lesiones', U.fmtInt(tr.totals.laps) + ' · ' + tr.totals.crashes + ' · ' + tr.totals.injuries),
      statRow('Récord', tr.records.best ? U.fmtLap(tr.records.best) + ' · ' + tr.records.holder : '-')
    );
  }
  function delTrack(tr) {
    app().confirm('Borrar ' + tr.name, 'Se demolerá el circuito. Recuperas una parte de la inversión.', () => {
      const r = game().deleteTrack(tr);
      if (r.ok) { MX.Tools.select(); app().hud.toast('Circuito borrado. Reembolso: ' + U.fmtMoney(r.refund), 'info'); MX.Audio.sfx('demolish'); WM.rebuild('tracks'); }
      else app().hud.toast(r.reason, 'bad');
    });
  }
  /* auto-generate a closed loop in the largest free owned rectangle */
  function suggested() {
    const g = game(), w = g.world, N = w.N;
    const free = new Uint8Array(N * N);
    for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
      const i = tx + tz * N;
      free[i] = (w.owned[i] && w.bld[i] < 0 && !w.path[i] && !w.trackOcc[i] && !w.isWater(tx, tz) && w.tileSlope(tx, tz) < 2.5) ? 1 : 0;
    }
    const sum = new Int32Array((N + 1) * (N + 1));
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) sum[(x + 1) + (z + 1) * (N + 1)] = free[x + z * N] + sum[x + (z + 1) * (N + 1)] + sum[(x + 1) + z * (N + 1)] - sum[x + z * (N + 1)];
    const area = (x0, z0, x1, z1) => sum[x1 + z1 * (N + 1)] - sum[x0 + z1 * (N + 1)] - sum[x1 + z0 * (N + 1)] + sum[x0 + z0 * (N + 1)];
    let best = null;
    for (let wv = 30; wv >= 14; wv -= 2) for (let hv = Math.min(30, wv); hv >= 11; hv -= 2) {
      if (best && wv * hv <= best.w * best.h) continue;
      for (let z0 = 0; z0 + hv <= N; z0 += 2) for (let x0 = 0; x0 + wv <= N; x0 += 2) {
        if (area(x0, z0, x0 + wv, z0 + hv) === wv * hv) { best = { x0, z0, w: wv, h: hv }; break; }
      }
    }
    if (!best) { app().hud.toast('No hay un terreno libre suficientemente grande (mínimo 14 x 11 casillas)', 'bad'); return; }
    let tr = g.selectedTrack, fresh = false;
    if (!tr || !tr.pieces || tr.pieces.length || tr.nodes.length) { tr = g.newTrack(); fresh = true; }
    if (!tr) { app().hud.toast('Has alcanzado el máximo de circuitos', 'bad'); return; }
    const res = g.suggestLoop(tr, { x0: best.x0, z0: best.z0, w: best.w, h: best.h }, app().trackUI.width, app().trackUI.surface);
    if (!res.ok) {
      if (fresh) { g.deleteTrack(tr); g.selectedTrack = g.tracks[0] || null; WM.rebuild('tracks'); }
      app().hud.toast(res.reason, 'bad');
      return;
    }
    g.selectedTrack = tr;
    const cx = (best.x0 + best.w / 2) * T, cz = (best.z0 + best.h / 2) * T;
    MX.Tools.set(TL().TrackFeature);
    app().trackUI.section = 'features';
    WM.rebuild('tracks');
    const cam = app().renderer.cam;
    cam.follow = null; cam.tx = cx; cam.tz = cz; cam.ty = w.heightAt(cx, cz); cam.targetZoom = Math.min(cam.targetZoom, 5.5);
    app().hud.toast('Trazado sugerido creado. Revisa los elementos, valida y ábrelo.', 'good');
    MX.Audio.sfx('build');
  }

  /* ================= Terrain ================= */
  function terrainPanel() {
    WM.open('terrain', {
      title: 'Terreno', icon: 'terrain', width: 360,
      build: (body) => {
        const g = game();
        const tools = [['raise', 'Subir', 'raise'], ['lower', 'Excavar', 'lower'], ['level', 'Nivelar', 'level'], ['smooth', 'Suavizar', 'smooth']];
        const row = h('div', { class: 'row gap wrap' });
        for (const [op, label, ic] of tools) row.append(h('button', { class: 'btn tool' + (MX.Tools.current === TL().Terrain && TL().Terrain.op === op ? ' on' : ''), onclick: () => { TL().Terrain.op = op; MX.Tools.set(TL().Terrain); WM.rebuild('terrain'); } }, icon(ic), label));
        const sizes = h('div', { class: 'row gap' });
        for (const s of [1, 2, 3, 5, 7]) sizes.append(h('button', { class: 'btn small' + (TL().Terrain.size === s ? ' on' : ''), onclick: () => { TL().Terrain.size = s; TL().Paint.size = s; if (MX.Tools.current === TL().Terrain) MX.Tools.set(TL().Terrain); WM.rebuild('terrain'); } }, s + 'x' + s));
        const paint = h('div', { class: 'row gap wrap' });
        MX.World.GROUND_NAMES.forEach((n, i) => {
          if (i === 4) return;
          paint.append(h('button', { class: 'btn small' + (MX.Tools.current === TL().Paint && TL().Paint.ground === i ? ' on' : ''), onclick: () => { TL().Paint.ground = i; MX.Tools.set(TL().Paint); WM.rebuild('terrain'); } }, n));
        });
        body.append(h('h4', null, 'Movimiento de tierras'), row, h('h4', null, 'Tamaño del pincel'), sizes,
          h('p', { class: 'muted small' }, 'Cuesta ' + U.fmtMoney(C.TERRAIN_COST) + ' por m³' + (g.machineryBonus ? ' (−40% con maquinaria pesada)' : '') + '. Excava por debajo del nivel del agua para crear estanques. No puedes modificar el terreno bajo edificios ni bajo circuitos abiertos.'),
          h('h4', null, 'Pintar suelo'), paint,
          h('h4', null, 'Ampliar el complejo'),
          h('div', { class: 'row gap' }, h('button', { class: 'btn' + (MX.Tools.current === TL().Land ? ' on' : ''), onclick: () => { MX.Tools.set(TL().Land); WM.rebuild('terrain'); } }, icon('land'), 'Comprar terreno'),
            h('button', { class: 'btn', onclick: () => MX.Tools.set(TL().Demolish) }, icon('decor'), 'Talar árboles')));
      }
    });
  }

  /* ================= Buildings ================= */
  function buildPanel(cat) {
    WM.open('build', {
      title: 'Construir instalaciones', icon: 'build', width: 470,
      tabs: Cat.buildingCats.map(c => ({ id: c.id, label: c.name, build: (body) => buildCat(body, c.id) })), tab: cat
    });
  }
  function buildCat(body, cat) {
    const g = game();
    const grid = h('div', { class: 'card-grid' });
    const info = h('div', { class: 'card-info' });
    body.append(grid, info);
    const showInfo = (k) => {
      const d = Cat.buildings[k];
      clear(info);
      info.append(h('b', null, d.name), h('p', null, d.desc),
        h('div', { class: 'row gap wrap small' }, chip(U.fmtMoney(d.cost), 'neutral'), chip(U.fmtMoney(d.upkeep) + '/mes', 'neutral'), chip(d.w + 'x' + d.h + ' casillas', 'neutral'), d.capacity ? chip('Capacidad ' + d.capacity, 'info') : null,
          g.count(k) ? chip(g.count(k) + ' construidos', 'good') : null));
    };
    for (const k in Cat.buildings) {
      const d = Cat.buildings[k];
      if (d.cat !== cat) continue;
      const locked = !g.isUnlocked(d);
      const on = MX.Tools.current === TL().Build && TL().Build.type === k;
      const card = h('button', { class: 'card' + (on ? ' on' : '') + (locked ? ' locked' : ''), title: locked ? lockReason(d) : d.desc,
        onclick: () => {
          if (locked) { app().hud.toast(lockReason(d), 'bad'); MX.Audio.sfx('error'); return; }
          TL().Build.type = k; MX.Tools.set(TL().Build); showInfo(k);
          for (const c of grid.children) c.classList.remove('on');
          card.classList.add('on');
        },
        onmouseenter: () => showInfo(k) },
        h('img', { src: thumb('b', k), alt: '', width: 72, height: 72 }),
        h('b', null, d.name), h('small', null, locked ? 'Bloqueado' : U.fmtMoney(d.cost)), locked ? icon('lock', 'lk') : null);
      grid.append(card);
    }
    const first = Object.keys(Cat.buildings).find(k => Cat.buildings[k].cat === cat);
    if (first) showInfo(MX.Tools.current === TL().Build && Cat.buildings[TL().Build.type].cat === cat ? TL().Build.type : first);
  }

  /* ================= Paths ================= */
  function pathsPanel() {
    WM.open('paths', {
      title: 'Caminos y carreteras', icon: 'path', width: 360,
      build: (body) => {
        const row = h('div', { class: 'row gap wrap' });
        for (const t of [1, 2, 3]) {
          const d = Cat.paths[t];
          row.append(h('button', { class: 'btn tool' + (MX.Tools.current === TL().PathTool && TL().PathTool.type === t ? ' on' : ''), onclick: () => { TL().PathTool.type = t; MX.Tools.set(TL().PathTool); WM.rebuild('paths'); } }, icon(t === 3 ? 'road' : 'path'), d.name, h('small', null, U.fmtMoney(d.cost))));
        }
        const add = h('div', { class: 'row gap wrap' });
        for (const k in Cat.addons) {
          const d = Cat.addons[k];
          add.append(h('button', { class: 'btn' + (MX.Tools.current === TL().AddonTool && TL().AddonTool.kind === k ? ' on' : ''), title: d.desc, onclick: () => { TL().AddonTool.kind = k; MX.Tools.set(TL().AddonTool); WM.rebuild('paths'); } }, icon(k === 'bench' ? 'bench' : k === 'bin' ? 'demolish' : 'info'), d.name, h('small', null, U.fmtMoney(d.cost))));
        }
        body.append(h('h4', null, 'Trazar'), row,
          h('p', { class: 'muted small' }, 'Los espectadores solo caminan por caminos. Conecta el aparcamiento con la taquilla y la taquilla con gradas, comida, baños y zonas junto a la pista. Las furgonetas de los pilotos y los coches usan carreteras: el aparcamiento y el paddock deben tocar una carretera conectada con la vía pública.'),
          h('h4', null, 'Mobiliario'), add);
      }
    });
  }

  /* ================= Decoration ================= */
  function decorPanel() {
    WM.open('decor', {
      title: 'Decoración y seguridad', icon: 'decor', width: 440,
      build: (body) => {
        const g = game();
        const grid = h('div', { class: 'card-grid' });
        for (const k in Cat.decor) {
          const d = Cat.decor[k];
          const on = MX.Tools.current === TL().DecorTool && TL().DecorTool.type === k;
          grid.append(h('button', { class: 'card' + (on ? ' on' : ''), title: d.desc, onclick: () => { TL().DecorTool.type = k; MX.Tools.set(TL().DecorTool); WM.rebuild('decor'); } },
            h('img', { src: thumb('d', k), alt: '', width: 72, height: 72 }), h('b', null, d.name), h('small', null, U.fmtMoney(d.cost)), d.safety ? chip('Seguridad', 'good') : null));
        }
        body.append(grid, h('p', { class: 'muted small' }, 'Balas de paja, neumáticos y vallas junto a saltos y curvas rápidas mejoran la seguridad del circuito. Árboles, flores y estatuas suben su valoración y gustan al público. Las pancartas lucen los logos de tus patrocinadores.'));
        void g;
      }
    });
  }

  MX.Panels1 = { tracksPanel, terrainPanel, buildPanel, pathsPanel, decorPanel, thumb, suggested, STATE, statRow, lockReason, currentPiece, buildState, pieceName };
})(window.MX);
