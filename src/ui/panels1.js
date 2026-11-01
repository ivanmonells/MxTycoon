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
      const d = Cat.decor[type], ht = (d && d.h) || 2.5;
      mesh = MX.BuildModels.decorPreview(type);
      center = [0, ht * 0.45, 0]; radius = Math.max(2.6, ht * 0.62 + 1.2);
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
          h('button', { id: 'win-tracks-new', class: 'btn primary', onclick: () => pickType('new') }, icon('track'), 'Nuevo circuito'),
          h('button', { class: 'btn', title: 'Genera un circuito cerrado con salida, meta y algunos elementos en tu terreno libre', onclick: () => pickType('suggest') }, icon('jump'), 'Trazado sugerido'));
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
              const st = STATE[t.state], td = t.typeDef;
              el.append(h('button', { class: 'track-chip' + (g.selectedTrack === t ? ' on' : ''), onclick: () => { g.selectedTrack = t; app().trackUI.picking = null; t.ver++; } },
                h('span', { class: 'type-tag', style: { background: td.color } }, td.short), h('b', null, t.name), chip(st[0], st[1]), h('small', null, t.S ? U.fmtMeters(t.length) : 'sin trazado')));
            }
          });
          const tr = g.selectedTrack, ui = app().trackUI;
          if (ui.picking) keyed(detail, 'pick:' + ui.picking + ':' + g.unlocked.size, (el) => typePicker(el, ui.picking));
          else keyed(detail, tr ? tr.id + ':' + tr.state + ':' + (tr.closed ? 1 : 0) + ':' + (tr.origin ? 1 : 0) + ':' + (ui.section) : 'none', (el) => buildTrackDetail(el, tr));
          if (tr && !ui.picking && detail._upd) detail._upd();
        };
      }
    });
  }
  /* «Nuevo circuito» and «Trazado sugerido» first ask which kind of circuit (unless only one is available) */
  function pickType(mode) {
    const g = game();
    const avail = Cat.trackTypeOrder.filter(k => g.trackTypeUnlocked(k));
    if (avail.length <= 1) { if (mode === 'new') newTrack(avail[0] || 'mx'); else suggested(avail[0] || 'mx'); return; }
    app().trackUI.picking = mode;
    MX.Tools.select();
    WM.rebuild('tracks');
    if (WM.setSheet) WM.setSheet('tracks', 'half');
  }
  function typePicker(el, mode) {
    const g = game();
    el.append(h('div', { class: 'row gap center pick-head' }, h('b', null, mode === 'suggest' ? '¿Qué circuito te sugiero?' : '¿Qué tipo de circuito quieres construir?'),
      h('button', { class: 'btn small', onclick: () => { app().trackUI.picking = null; WM.rebuild('tracks'); } }, 'Cancelar')));
    const grid = h('div', { class: 'type-grid' });
    for (const k of Cat.trackTypeOrder) {
      const td = Cat.trackTypes[k];
      const locked = !g.trackTypeUnlocked(k);
      let why = '';
      if (locked) {
        const r = Cat.research.find(x => 'research:' + x.id === td.unlock);
        why = 'Investiga «' + (r ? r.name : '') + '»' + (r && r.minRep ? ' (reputación ' + r.minRep + ')' : '');
      }
      grid.append(h('button', { class: 'type-card' + (locked ? ' locked' : ''), title: td.desc, onclick: () => {
        if (locked) { app().hud.toast(why, 'bad'); MX.Audio.sfx('error'); return; }
        app().trackUI.picking = null;
        if (mode === 'suggest') suggested(k); else newTrack(k);
      } },
      h('span', { class: 'type-tag big', style: { background: td.color } }, td.short),
      h('span', { class: 'type-txt' }, h('b', null, td.name), h('small', null, td.desc), h('em', null, locked ? why : 'Clientes: ' + td.riders + ' · ' + td.len[0] + ' a ' + td.len[1] + ' m')),
      locked ? icon('lock', 'lk') : null));
    }
    el.append(grid);
  }
  /* the constructor defaults (width and surface) follow the discipline */
  function typeDefaults(type, fresh) {
    const td = Cat.trackTypes[type] || Cat.trackTypes.mx, ui = app().trackUI;
    if (fresh || !td.widths.includes(ui.width)) ui.width = td.width;
    const unl = (k) => game().isUnlocked(Cat.surfaces[k]);
    if (fresh || !td.surfaces.includes(ui.surface) || !unl(ui.surface)) ui.surface = unl(td.surface) ? td.surface : (td.surfaces.find(unl) || 'dirt');
    const b = buildState();
    if (!td.slopes.includes(b.slope || 0)) b.slope = 0;
    if (!td.banks.includes(b.bank || 0)) b.bank = 0;
    if (b.special && !td.specials.includes(b.special)) b.special = null;
  }
  function newTrack(type) {
    const g = game();
    const tr = g.newTrack(type);
    if (!tr) { app().hud.toast('Has alcanzado el máximo de circuitos', 'bad'); return; }
    typeDefaults(tr.type, true);
    WM.rebuild('tracks');
    MX.Tools.set(TL().TrackStart);
    app().hud.toast(app().input.touchMode ? 'Mueve la parrilla con el dedo y pulsa «Colocar»' : 'Haz clic en tu terreno para colocar la parrilla de salida (R para girarla)', 'info');
  }
  function buildTrackDetail(el, tr) {
    if (!tr) return;
    const g = game(), ui = app().trackUI;
    const nameIn = h('input', { id: 'track-name', class: 'inp', value: tr.name, maxlength: 28, 'aria-label': 'Nombre del circuito', onchange: (e) => { tr.name = e.target.value || tr.name; tr.ver++; } });
    const st = STATE[tr.state], td = tr.typeDef;
    typeDefaults(tr.type);
    el.append(h('div', { class: 'row gap center name-row' }, h('span', { class: 'type-tag', style: { background: td.color }, title: td.name }, td.short), nameIn, chip(st[0], st[1])));
    el.append(h('p', { class: 'muted small type-line' }, h('b', null, td.name), ' · ', td.riders + '. Tarifa ×' + String(td.fee).replace('.', ',') + ', atractivo para el público ×' + String(td.crowd).replace('.', ',') + '.'));
    /* tools */
    const editable = tr.state !== 'open';
    const toolBtn = (ic, label, tool, extra) => {
      const b = h('button', { class: 'btn tool' + (MX.Tools.current === tool ? ' on' : ''), disabled: !editable, onclick: () => { if (extra) extra(); MX.Tools.set(tool); app().panels.tracks(); } }, icon(ic), label);
      return b;
    };
    if (tr.pieces && !tr.origin) {
      el.append(h('div', { class: 'callout' }, icon('info'), h('span', null, 'Haz clic en tu terreno para colocar la parrilla de salida. Pulsa R para girarla. En pantallas táctiles, arrástrala o toca donde la quieras y pulsa «Colocar». Después irás construyendo el circuito pieza a pieza.')),
        h('div', { class: 'row gap wrap' },
          toolBtn('track', 'Colocar la salida', TL().TrackStart),
          h('button', { class: 'btn', title: 'Girar la parrilla 45 grados (R)', onclick: () => { if (MX.Tools.current !== TL().TrackStart) MX.Tools.set(TL().TrackStart); TL().TrackStart.rotate(); } }, icon('rotate'), 'Girar'),
          h('button', { class: 'btn danger', onclick: () => delTrack(tr) }, icon('demolish'), 'Borrar')));
      chuteRow(el, tr);
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
          if (d.group !== grp.id || !td.features.includes(k)) continue;
          const locked = !g.isUnlocked(d);
          const on = MX.Tools.current === TL().TrackFeature && TL().TrackFeature.type === k;
          row.append(h('button', { class: 'feat' + (on ? ' on' : '') + (locked ? ' locked' : ''), disabled: !editable, title: (locked ? lockReason(d) + ' · ' : '') + d.desc,
            onclick: () => { if (locked) { app().hud.toast(lockReason(d), 'bad'); return; } TL().TrackFeature.type = k; MX.Tools.set(TL().TrackFeature); WM.rebuild('tracks'); } },
            h('span', { class: 'feat-ic' }, featureGlyph(d)), h('b', null, d.name), h('small', null, locked ? 'Bloqueado' : U.fmtMoney(d.cost))));
        }
        if (row.children.length) sec.append(h('h4', null, grp.name), row);
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
      chuteRow(sec, tr);
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
    const pub = MX.OnlineUI.publishButton(tr);
    if (pub) acts.append(pub);
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
    else if (d.kind === 'water') { ctx.lineTo(34, 15); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#5b8fb0'; ctx.fillRect(6, 12, 22, 4); ctx.beginPath(); ctx.moveTo(0, 15); }
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
  function buildState() {
    const ui = app().trackUI;
    if (!ui.build) ui.build = { dir: 'S', n: 3, slope: 0, bank: 0, special: null };
    return ui.build;
  }
  function currentPiece() {
    const b = buildState(), ui = app().trackUI;
    const tr = game() && game().selectedTrack;
    if (tr) typeDefaults(tr.type);
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
    const td = tr.typeDef;
    if (document.documentElement.classList.contains('phone')) { compactConstructor(box, tr, b, d, status, preview, opt, changed, noFocus, el); return; }
    box.append(status, pieceTabs(tr, b, opt, changed));
    /* special pieces, in place of direction and slope */
    if (b.special) box.append(specialCards(tr, b, opt, changed, 'bld-specials'));
    /* direction */
    const dirs = h('div', { class: 'bld-dirs' });
    for (const dd of BUILD_DIRS) dirs.append(opt('bld-btn', b.dir === dd.id, dd.name, () => { b.dir = dd.id; changed(); }, dirGlyph(dd)));
    if (!b.special) box.append(h('h4', null, 'Dirección'), dirs);
    if (!b.special && d.kind === 'straight') {
      const lens = h('div', { class: 'row gap wrap' });
      for (const [n, label] of BUILD_LENS) lens.append(opt('btn small', b.n === n, 'Recta ' + label.toLowerCase(), () => { b.n = n; changed(); }, label + ' · ' + n * C.TILE + ' m'));
      box.append(lens);
    }
    if (!b.special && d.kind === 'curve' && td.banks.length > 1) {
      const banks = h('div', { class: 'row gap wrap' });
      for (const [v, label] of BUILD_BANKS) {
        if (!td.banks.includes(v)) continue;
        const locked = v === 2 && !g.isUnlocked(Cat.features.berm_big);
        banks.append(opt('btn small' + (locked ? ' locked' : ''), b.bank === v, locked ? lockReason(Cat.features.berm_big) : label, () => { if (locked) { app().hud.toast(lockReason(Cat.features.berm_big), 'bad'); return; } b.bank = v; changed(); }, label, locked ? icon('lock') : null));
      }
      box.append(banks);
    }
    /* slope */
    if (!b.special && td.slopes.length > 1) {
      const slopes = h('div', { class: 'bld-slopes' });
      for (const [v, label] of BUILD_SLOPES) if (td.slopes.includes(v)) slopes.append(opt('bld-btn', (b.slope || 0) === v, label, () => { b.slope = v; changed(); }, slopeGlyph(v), h('small', null, label)));
      box.append(h('h4', null, 'Pendiente'), slopes);
    }
    /* what it builds and the buttons, then the settings that apply to every piece */
    box.append(preview,
      h('div', { class: 'row gap wrap bld-actions' },
        h('button', { id: 'bld-build', class: 'btn primary big-ish', onmousedown: noFocus, onclick: () => TL().TrackBuild.build() }, icon('build'), 'Construir pieza'),
        h('button', { id: 'bld-undo', class: 'btn', onmousedown: noFocus, onclick: () => TL().TrackBuild.undo() }, icon('demolish'), 'Quitar la última'),
        h('button', { id: 'bld-auto', class: 'btn', onmousedown: noFocus, title: 'Busca el camino de vuelta a la salida salvando la altura y lo construye; si el final está encajonado, rehace las últimas piezas', onclick: () => TL().TrackBuild.auto() }, icon('check'), 'Cerrar automáticamente')),
      h('p', { class: 'muted small' }, 'Intro: construir · Retroceso: quitar la última · Flechas izquierda y derecha: dirección · arriba y abajo: pendiente'));
    chuteRow(box, tr);
    widthSurface(box, tr, true);
    box.append(h('div', { class: 'row gap' }, h('button', { class: 'btn small danger', onclick: () => delTrack(tr) }, icon('demolish'), 'Borrar circuito')));
    el._upd = constructorStatus(tr, status, preview);
  }
  /* the two kinds of piece: «Rectas y curvas» and «Especiales» (jumps, rhythm sections and
     the finish line), with how many specials can be built */
  function pieceTabs(tr, b, opt, changed) {
    const g = game(), td = tr.typeDef;
    const usable = td.specials.filter(k => g.isUnlocked(Cat.features[k]));
    return h('div', { class: 'bld-tabs' },
      opt('bld-tab', !b.special, 'Rectas y curvas: dirección, longitud, peralte y pendiente', () => { if (b.special) b.lastSpecial = b.special; b.special = null; changed(); }, dirGlyph(BUILD_DIRS[4]), h('span', null, 'Rectas y curvas')),
      opt('bld-tab', !!b.special, 'Especiales: saltos, rítmicos y la línea de meta', () => {
        if (b.special) return;
        /* the last one used, the finish line while the circuit still needs one, or the first jump */
        const hasFinish = tr.pieces.some(p => p.t === 'special' && p.f === 'finish') || tr.features.some(f => f.type === 'finish');
        b.special = (b.lastSpecial && usable.includes(b.lastSpecial) && b.lastSpecial) || (!hasFinish && tr.pieces.length > 4 && usable.includes('finish') ? 'finish' : usable.find(k => k !== 'finish') || usable[0] || null);
        changed();
      }, icon('jump'), h('span', null, 'Especiales'), h('small', { class: 'bld-tab-n' }, String(usable.length))));
  }
  /* every special piece of the discipline, locked ones greyed out */
  function specialCards(tr, b, opt, changed, cls) {
    const g = game(), sp = h('div', { class: cls });
    for (const k of tr.typeDef.specials) {
      const fd = Cat.features[k];
      const locked = !g.isUnlocked(fd);
      sp.append(opt('feat' + (locked ? ' locked' : ''), b.special === k, (locked ? lockReason(fd) + ' · ' : '') + fd.name + ' · ' + fd.desc, () => { if (locked) { app().hud.toast(lockReason(fd), 'bad'); return; } b.special = k; b.lastSpecial = k; changed(); },
        h('span', { class: 'feat-ic' }, featureGlyph(fd)), h('b', null, fd.name), h('small', null, locked ? 'Bloqueado' : U.fmtMoney(fd.cost))));
    }
    return sp;
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
      /* near the start the «Cerrar» button lights up: it joins the loop by itself */
      const near = !!(e && o && !tr.closed && tr.pieces.length > 2 && Math.hypot(e.x - o.x, e.z - o.z) * C.TILE < 70 && !(pr && pr.ok && pr.closes));
      for (const b of document.querySelectorAll('#bld-auto')) b.classList.toggle('glow', near);
      const key = pr ? (pr.ok ? 'ok' : 'no') + pr.reason + pr.cost + (pr.closes ? 'c' : '') + (pr.fix ? 'f' : '') + (pr.cross || '') + (near ? 'n' : '') + JSON.stringify(currentPiece()) : 'none';
      if (preview._k === key) return;
      preview._k = key;
      clear(preview);
      if (!pr) return;
      const p = currentPiece();
      preview.className = 'bld-preview ' + (pr.ok ? (pr.closes ? 'closes' : 'ok') : 'bad');
      preview.append(icon(pr.ok ? (pr.closes ? 'trophy' : 'check') : 'cross'),
        h('span', null, h('b', null, pieceName(p)), pr.g ? ' · ' + U.fmtMeters(pr.g.len) : '', pr.ok ? ' · ' + U.fmtMoney(pr.cost) : '', pr.ok && pr.closes ? ' · ¡cierra el circuito!' : '',
          pr.ok && pr.fix ? h('em', { class: 'fix' }, 'Ajusto la pendiente para llegar a la salida a su altura') : null,
          pr.ok && pr.cross ? h('em', { class: 'fix' }, pr.cross === 'over' ? 'Pasa por encima en un puente' : 'Pasa por debajo, por un túnel') : null,
          !pr.ok ? h('em', null, pr.reason) : null,
          near && pr.ok ? h('em', { class: 'fix' }, 'Estás cerca de la salida: pulsa «Cerrar» y lo uno yo') : null));
    };
  }
  /* Phones: two tabs, «Rectas y curvas» (directions, lengths, banking and slopes) and
     «Especiales» (jumps, rhythm sections and the finish line), then the build buttons;
     width, surface and the start straight fold away under •••. */
  function compactConstructor(box, tr, b, d, status, preview, opt, changed, noFocus, el) {
    const g = game();
    box.classList.add('compact');
    box.append(status, pieceTabs(tr, b, opt, changed));
    if (b.special) {
      const sp = specialCards(tr, b, opt, changed, 'bld-strip bld-strip-tall');
      box.append(sp);
      /* the chosen card in view */
      requestAnimationFrame(() => { const on = sp.querySelector('.feat.on'); if (on) sp.scrollLeft = Math.max(0, on.offsetLeft - (sp.clientWidth - on.offsetWidth) / 2); });
    } else {
      const dirs = h('div', { class: 'bld-dirs' });
      for (const dd of BUILD_DIRS) dirs.append(opt('bld-btn', b.dir === dd.id, dd.name, () => { b.dir = dd.id; changed(); }, dirGlyph(dd)));
      box.append(dirs);
    }
    const ctx = h('div', { class: 'row gap bld-ctx' });
    if (b.special) {
      /* specials have their own length and lie flat: no lengths, banking or slopes */
    } else if (d.kind === 'straight') {
      for (const [n, label] of BUILD_LENS) ctx.append(opt('btn small', b.n === n, 'Recta ' + label.toLowerCase(), () => { b.n = n; changed(); }, label));
    } else if (tr.typeDef.banks.length > 1) {
      for (const [v, label] of BUILD_BANKS) {
        if (!tr.typeDef.banks.includes(v)) continue;
        const locked = v === 2 && !g.isUnlocked(Cat.features.berm_big);
        ctx.append(opt('btn small' + (locked ? ' locked' : ''), b.bank === v, label, () => { if (locked) { app().hud.toast(lockReason(Cat.features.berm_big), 'bad'); return; } b.bank = v; changed(); }, v === 0 ? 'Sin peralte' : v === 1 ? 'Peralte' : 'Grande', locked ? icon('lock') : null));
      }
    }
    if (ctx.children.length) box.append(ctx);
    if (!b.special && tr.typeDef.slopes.length > 1) {
      const slopes = h('div', { class: 'bld-slopes' });
      for (const [v, label] of BUILD_SLOPES) if (tr.typeDef.slopes.includes(v)) slopes.append(opt('bld-btn', (b.slope || 0) === v, label, () => { b.slope = v; changed(); }, slopeGlyph(v)));
      box.append(slopes);
    }
    box.append(preview,
      h('div', { class: 'row gap bld-actions' },
        h('button', { id: 'bld-build', class: 'btn primary big-ish', onmousedown: noFocus, onclick: () => TL().TrackBuild.build() }, icon('build'), 'Construir'),
        h('button', { id: 'bld-undo', class: 'btn', title: 'Quitar la última pieza', onmousedown: noFocus, onclick: () => TL().TrackBuild.undo() }, icon('demolish'), 'Quitar'),
        h('button', { id: 'bld-auto', class: 'btn', title: 'Cerrar automáticamente: busca el camino de vuelta a la salida salvando la altura', onmousedown: noFocus, onclick: () => TL().TrackBuild.auto() }, icon('check'), 'Cerrar'),
        opt('btn bld-dots', !!b.more, 'Más opciones: anchura, superficie y recta de salida', () => { b.more = b.more ? null : 'ws'; changed(); }, h('span', { class: 'dots' }, '•••'))));
    if (b.more) {
      box.append(h('div', { class: 'row gap bld-more' },
        h('span', { class: 'muted small grow' }, 'Anchura, superficie y recta de salida'),
        h('button', { class: 'btn small danger', title: 'Borrar circuito', 'aria-label': 'Borrar circuito', onmousedown: noFocus, onclick: () => delTrack(tr) }, icon('demolish'), 'Borrar')));
      chuteRow(box, tr); widthSurface(box, tr, true);
    }
    el._upd = constructorStatus(tr, status, preview);
  }

  /* the wide start straight of motocross, supercross and minicross: which side of the first
     piece it runs along, or none (the riders then line up in rows on the circuit itself) */
  const CHUTE_OPTS = [[-1, 'Izquierda', 'Recta de salida ancha a la izquierda de la primera recta'], [1, 'Derecha', 'Recta de salida ancha a la derecha de la primera recta'], [0, 'Sin recta ancha', 'Sin recta de salida: los pilotos salen en filas desde la propia pista']];
  function chuteRow(el, tr) {
    if (!tr.pieces || !MX.Track.chuteWidth(tr.type)) return;
    const ui = app().trackUI, placed = !!tr.origin, editable = tr.state !== 'open';
    const row = h('div', { class: 'row gap wrap' });
    const cur = placed ? tr.chuteSide : ui.chute;
    const opts = placed ? CHUTE_OPTS : [[null, 'Automática', 'El lado que quepa (se pasa al exterior de la primera curva)']].concat(CHUTE_OPTS);
    for (const [v, label, tip] of opts) {
      row.append(h('button', { class: 'btn small' + (cur === v ? ' on' : ''), title: tip, disabled: !editable, onmousedown: (e) => e.preventDefault(), onclick: () => {
        if (!placed) { ui.chute = v; WM.rebuild('tracks'); if (MX.Tools.current === TL().TrackStart) TL().TrackStart.refresh(); return; }
        if (tr.chuteSide === v) return;
        const r = game().setChuteSide(tr, v);
        if (!r.ok) { app().hud.toast(r.reason, 'bad'); return; }
        MX.Audio.sfx('build'); WM.rebuild('tracks');
        if (MX.Tools.current === TL().TrackBuild) TL().TrackBuild.refresh();
      } }, label));
    }
    el.append(h('h4', null, 'Recta de salida'), row);
  }
  function widthSurface(el, tr, beforeClose) {
    const g = game(), ui = app().trackUI;
    const editable = tr.state !== 'open';
    const srow = h('div', { class: 'row gap wrap' });
    const td = tr.typeDef;
    for (const k of td.surfaces) {
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
    for (const wv of td.widths) {
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
      tr.type === 'mx' ? statRow('Homologación', A.HOMOLOG_NAMES[st.homolog]) : statRow('Tipo de circuito', tr.typeDef.name),
      statRow('Longitud', U.fmtMeters(st.length) + ' · ancho medio ' + U.fmt1(st.width) + ' m'),
      statRow('Vuelta profesional', U.fmtLap(st.lapPro) + ' · amateur ' + U.fmtLap(st.lapAm)),
      statRow('Vuelta principiante', U.fmtLap(st.lapBeg)),
      statRow('Velocidad máx. / media', U.fmtKmh(st.maxSpeed) + ' / ' + U.fmtKmh(st.avgSpeed)),
      statRow('Tiempo en el aire (pro)', U.fmt1(st.airPro) + ' s por vuelta'),
      tr.type === 'enduro' ? statRow('Obstáculos', String(st.natural || 0)) : statRow('Saltos · rítmicos · peraltes', st.jumps + ' · ' + st.rhythm + ' · ' + st.berms),
      statRow('Curvas (cerradas)', st.corners + ' (' + st.tight + ')'),
      statRow('Desnivel', U.fmt1(st.elev) + ' m'),
      ...(st.crossings ? [statRow('Cruces con túnel', String(st.crossings))] : []),
      statRow('Zonas de riesgo protegidas', Math.round(st.protectedRatio * 100) + '% de ' + st.hazards),
      ...(st.themes && st.themes.length ? [statRow('Zonas temáticas', st.themes.map(id => (Cat.decorThemes.find(t => t.id === id) || { name: id }).name).join(', '))] : []),
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
  function suggested(type) {
    const g = game(), w = g.world, N = w.N;
    type = type || 'mx';
    const sel = g.selectedTrack;
    typeDefaults(type, !(sel && sel.type === type && sel.pieces && !sel.pieces.length && !sel.nodes.length));
    /* only land the riders can get to from the road: not inside another circuit, past the water or up a cliff */
    const reach = new Uint8Array(N * N), queue = [];
    for (let tx = 0; tx < N; tx++) { const i = tx + w.roadRow * N; if (g.riderPassable(tx, w.roadRow, i)) { reach[i] = 1; queue.push(i); } }
    while (queue.length) {
      const i = queue.pop(), tx = i % N, tz = (i - tx) / N;
      for (const [x, z] of [[tx + 1, tz], [tx - 1, tz], [tx, tz + 1], [tx, tz - 1]]) {
        if (x < 0 || z < 0 || x >= N || z >= N) continue;
        const j = x + z * N;
        if (reach[j] || !g.riderPassable(x, z, j)) continue;
        reach[j] = 1; queue.push(j);
      }
    }
    const free = new Uint8Array(N * N);
    for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
      const i = tx + tz * N;
      free[i] = (reach[i] && w.owned[i] && w.bld[i] < 0 && !w.path[i] && !w.trackOcc[i] && !w.isWater(tx, tz) && w.tileSlope(tx, tz) < 2.5) ? 1 : 0;
    }
    /* the embankments can spill one tile past the rectangle: that ring must be clear too */
    const clear = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) clear[i] = (w.owned[i] && w.bld[i] < 0 && !w.path[i] && !w.trackOcc[i] && !w.isWater(i % N, (i / N) | 0)) ? 1 : 0;
    const prefix = (a) => {
      const sum = new Int32Array((N + 1) * (N + 1));
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) sum[(x + 1) + (z + 1) * (N + 1)] = a[x + z * N] + sum[x + (z + 1) * (N + 1)] + sum[(x + 1) + z * (N + 1)] - sum[x + z * (N + 1)];
      return (x0, z0, x1, z1) => sum[x1 + z1 * (N + 1)] - sum[x0 + z1 * (N + 1)] - sum[x1 + z0 * (N + 1)] + sum[x0 + z0 * (N + 1)];
    };
    const areaFree = prefix(free), areaClear = prefix(clear);
    /* steepness of the ground, so the loop goes where it is gentlest */
    const steep = new Uint8Array(N * N);
    for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) steep[tx + tz * N] = Math.min(255, Math.round(w.tileSlope(tx, tz) * 20));
    const areaSteep = prefix(steep);
    const area = (x0, z0, x1, z1) => {
      const a = areaFree(x0, z0, x1, z1);
      if (a !== (x1 - x0) * (z1 - z0)) return a;
      const X0 = Math.max(0, x0 - 1), Z0 = Math.max(0, z0 - 1), X1 = Math.min(N, x1 + 1), Z1 = Math.min(N, z1 + 1);
      return areaClear(X0, Z0, X1, Z1) === (X1 - X0) * (Z1 - Z0) ? a : -1;
    };
    /* free rectangles of every size, each at its spot nearest the paddocks (or the road); the
       ones with the longest edges (the longest loop) and closest to the riders go first */
    const pads = g.buildingsOf('paddock');
    const ax = pads.length ? pads.reduce((a, b) => a + b.tx, 0) / pads.length : N / 2, az = pads.length ? pads.reduce((a, b) => a + b.tz, 0) / pads.length : w.roadRow;
    const dist = (c) => Math.hypot(c.x0 + c.w / 2 - ax, c.z0 + c.h / 2 - az);
    const cands = [];
    const big = type === 'carcross' || type === 'flat' ? 36 : type === 'kids' ? 20 : 30;
    /* near the riders and on the gentlest ground */
    const score = (c) => c.w + c.h - dist(c) / 3 - areaSteep(c.x0, c.z0, c.x0 + c.w, c.z0 + c.h) / (c.w * c.h) / 20 * 14;
    for (let wv = big; wv >= 14; wv -= 2) for (let hv = Math.min(big, wv); hv >= 11; hv -= 2) {
      let near = null;
      for (let z0 = 0; z0 + hv <= N; z0 += 2) for (let x0 = 0; x0 + wv <= N; x0 += 2) {
        if (area(x0, z0, x0 + wv, z0 + hv) !== wv * hv) continue;
        const c = { x0, z0, w: wv, h: hv };
        if (!near || score(c) > score(near)) near = c;
      }
      if (near) cands.push(near);
    }
    cands.sort((a, b) => score(b) - score(a) || b.w * b.h - a.w * a.h);
    if (!cands.length) { app().hud.toast('No hay un terreno libre suficientemente grande (mínimo 14 x 11 casillas)', 'bad'); return; }
    let tr = g.selectedTrack, fresh = false;
    if (!tr || !tr.pieces || tr.pieces.length || tr.nodes.length || tr.type !== type) { tr = g.newTrack(type); fresh = true; }
    if (!tr) { app().hud.toast('Has alcanzado el máximo de circuitos', 'bad'); return; }
    /* a loop that ends up somewhere the riders cannot use is taken down and the next spot tried */
    const WHERE = /llegar desde el paddock|agua|pisa edificios|fuera de tu terreno|otro circuito|entrada de pilotos|Pendiente|recta de salida/;
    let res = null, best = null;
    /* with the wide start straight outside the loop first, then without it */
    for (const chute of MX.Track.chuteWidth(type) ? [true, false] : [false]) {
      let checks = 0;
      for (const c of cands.slice(0, 16)) {
        res = g.suggestLoop(tr, c, app().trackUI.width, app().trackUI.surface, { chute });
        if (!res.ok) { if (res.short) continue; break; }
        const bad = checks++ < 6 ? g.validateTrack(tr).find(i => i.level === 'error' && WHERE.test(i.msg)) : null;
        if (!bad) { best = c; break; }
        g.editTrack(tr, (t) => { t.pieces = []; t.features = []; t.closed = false; t.origin = null; t.chuteSide = 0; });
        res = { ok: false, reason: bad.msg };
      }
      if (best) break;
    }
    if (!res.ok) {
      if (fresh) { g.deleteTrack(tr); g.selectedTrack = g.tracks[0] || null; WM.rebuild('tracks'); }
      app().hud.toast(res.reason, 'bad');
      return;
    }
    g.selectedTrack = tr;
    const cx = (best.x0 + best.w / 2) * T, cz = (best.z0 + best.h / 2) * T;
    /* the element tool starts with something this discipline uses */
    const tdf = tr.typeDef.features;
    if (!tdf.includes(TL().TrackFeature.type)) TL().TrackFeature.type = tdf.find(k => Cat.features[k].group !== 'basic' && Cat.features[k].group !== 'corner') || 'finish';
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
          if (i === MX.World.G.ROCK || i === MX.World.G.SNOW) return;
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
  /* Paths are built piece by piece with the same construction window as the circuits
     (the default), or dragged out in a line on the ground. */
  function pathsPanel() {
    const ui = app().pathUI || (app().pathUI = { mode: 'piece' });
    WM.open('paths', {
      title: 'Caminos y carreteras', icon: 'path', width: 380,
      build: (body) => {
        const pb = TL().PathBuild, pd = TL().PathTool;
        const tool = () => ui.mode === 'piece' ? pb : pd;
        const active = MX.Tools.current === pb ? pb : MX.Tools.current === pd ? pd : null;
        const pick = (t) => { const tl = tool(); tl.type = t; if (MX.Tools.current !== tl) MX.Tools.set(tl); else if (tl.refresh) tl.refresh(); WM.rebuild('paths'); };
        const phone = document.documentElement.classList.contains('phone');
        const row = h('div', { class: 'row gap wrap path-types' });
        for (const t of [1, 2, 3]) {
          const d = Cat.paths[t];
          row.append(h('button', { class: 'btn tool' + (active && active.type === t ? ' on' : ''), title: d.name, onclick: () => pick(t) }, icon(t === 3 ? 'road' : 'path'), phone ? ['Grava', 'Adoquinado', 'Carretera'][t - 1] : d.name, h('small', null, U.fmtMoney(d.cost))));
        }
        const mode = h('div', { class: 'row gap wrap path-mode' });
        for (const [m, label, tip] of [['piece', 'Pieza a pieza', 'Como el constructor de circuitos: dirección, pendiente y «Construir»'], ['drag', 'Arrastrando', 'Arrastra sobre el mapa para trazar una línea de casillas a ras de suelo']]) {
          mode.append(h('button', { class: 'btn small' + (ui.mode === m ? ' on' : ''), title: tip, onclick: () => {
            if (ui.mode === m) return;
            ui.mode = m;
            if (active) { const tl = tool(); tl.type = active.type; MX.Tools.set(tl); }
            WM.rebuild('paths');
          } }, label));
        }
        /* the constructor right under the kinds of path, the way of building below it */
        body.append(h('h4', null, 'Trazar'), row);
        let upd = null;
        if (active === pb) upd = pathBuilder(body, pb);
        body.append(mode);
        if (active !== pb) body.append(h('p', { class: 'muted small' }, ui.mode === 'piece' ? 'Elige el tipo de camino y toca en el mapa la casilla donde empieza (o el final de un camino para seguirlo). Luego se construye como un circuito: dirección, pendiente y «Construir».' : 'Elige el tipo de camino y arrástralo sobre el mapa. Arrastrando, los caminos van a ras de suelo; para subir o bajar, pieza a pieza.'));
        const add = h('div', { class: 'row gap wrap' });
        for (const k in Cat.addons) {
          const d = Cat.addons[k];
          add.append(h('button', { class: 'btn' + (MX.Tools.current === TL().AddonTool && TL().AddonTool.kind === k ? ' on' : ''), title: d.desc, onclick: () => { TL().AddonTool.kind = k; MX.Tools.set(TL().AddonTool); WM.rebuild('paths'); } }, icon(k === 'bench' ? 'bench' : k === 'bin' ? 'demolish' : 'info'), d.name, h('small', null, U.fmtMoney(d.cost))));
        }
        body.append(h('p', { class: 'muted small' }, 'Los espectadores solo caminan por caminos. Conecta el aparcamiento con la taquilla y la taquilla con gradas, comida, baños y zonas junto a la pista. Un camino puede subir en rampa, cruzar el lago por una pasarela, pasar por encima de un circuito (' + U.fmt1(MX.World.PATH_OVER) + ' m sobre la pista) o por debajo de uno que vaya alto (' + U.fmt1(MX.World.PATH_UNDER) + ' m sobre el camino). Las furgonetas de los pilotos y los coches usan carreteras: el aparcamiento y el paddock deben tocar una carretera conectada con la vía pública.'),
          h('p', { class: 'muted small' }, 'Mientras construyes, «Quitar» te devuelve todo lo que has pagado. Cuando cierras el modo de construcción, quitar un camino solo devuelve la mitad.'),
          h('h4', null, 'Mobiliario'), add);
        return upd;
      }
    });
  }
  /* top view of a path tile and the way out of it: straight on, or a turn */
  function pathTurnGlyph(t) {
    const c = h('canvas', { width: 44, height: 34, class: 'glyph-dir' });
    const x = c.getContext('2d');
    x.lineCap = 'butt'; x.lineJoin = 'miter';
    const path = () => {
      x.beginPath(); x.moveTo(22, 33);
      if (!t) { x.lineTo(22, 8); return; }
      x.lineTo(22, 17); x.lineTo(22 + t * 14, 17);
    };
    x.strokeStyle = '#1a1410'; x.lineWidth = 11; path(); x.stroke();
    x.strokeStyle = '#c9c2b2'; x.lineWidth = 8; path(); x.stroke();
    const ex = t ? 22 + t * 15 : 22, ey = t ? 17 : 7, ang = t ? (t > 0 ? 0 : Math.PI) : -Math.PI / 2;
    x.fillStyle = '#ffd22e'; x.strokeStyle = '#1a1410'; x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(ex + Math.cos(ang) * 6, ey + Math.sin(ang) * 6);
    x.lineTo(ex + Math.cos(ang + 2.4) * 6, ey + Math.sin(ang + 2.4) * 6);
    x.lineTo(ex + Math.cos(ang - 2.4) * 6, ey + Math.sin(ang - 2.4) * 6);
    x.closePath(); x.fill(); x.stroke();
    return c;
  }
  /* side view of a path slope, as the circuit one: the ground under it, the path on top */
  function pathSlopeGlyph(sl) {
    const c = h('canvas', { width: 44, height: 24, class: 'glyph-slope' });
    const x = c.getContext('2d');
    const y0 = 16 + (sl > 0 ? 3 : sl < 0 ? -5 : 0), y1 = y0 - sl * 5.5;
    x.fillStyle = '#6b4a2b';
    x.beginPath(); x.moveTo(3, 23); x.lineTo(3, y0); x.lineTo(41, y1); x.lineTo(41, 23); x.closePath(); x.fill();
    x.strokeStyle = '#1a1410'; x.lineWidth = 5; x.beginPath(); x.moveTo(3, y0); x.lineTo(41, y1); x.stroke();
    x.strokeStyle = '#c9c2b2'; x.lineWidth = 3; x.beginPath(); x.moveTo(3, y0); x.lineTo(41, y1); x.stroke();
    return c;
  }
  /* the path constructor: as the circuit one, a status line, the turn, the slope, what the
     next tile will be and «Construir» / «Quitar» */
  function pathBuilder(body, pb) {
    const noFocus = (e) => e.preventDefault();
    const phone = document.documentElement.classList.contains('phone');
    const opt = (cls, on, title, onclick, ...kids) => h('button', { class: cls + (on ? ' on' : ''), title, 'aria-label': title, 'aria-pressed': on ? 'true' : 'false', onclick, onmousedown: noFocus }, ...kids);
    const road = pb.road();
    const box = h('div', { class: 'builder path-constructor' + (phone ? ' compact' : '') });
    const status = h('div', { class: 'bld-status' });
    const preview = h('div', { class: 'bld-preview' });
    const dirs = h('div', { class: 'bld-dirs path-dirs' });
    for (const [t, label] of TL().PathBuild.TURNS) dirs.append(opt('bld-btn', pb.turn === t, label, () => { pb.turn = t; pb.changed(); }, pathTurnGlyph(t), phone ? null : h('small', null, t ? label.replace('Girar a la ', 'A la ') : label)));
    const slopes = h('div', { class: 'bld-slopes path-slopes' });
    for (const [v, label] of TL().PathBuild.SLOPES) {
      const lock = road && v !== 0;
      slopes.append(opt('bld-btn' + (lock ? ' locked' : ''), !lock && pb.slope === v, lock ? 'Las carreteras van siempre a ras de suelo' : label, () => { if (lock) { app().hud.toast('Las carreteras van siempre a ras de suelo', 'info'); return; } pb.slope = v; pb.changed(); }, pathSlopeGlyph(v), phone ? null : h('small', null, label)));
    }
    if (phone) box.append(status, h('div', { class: 'path-rows' }, dirs, slopes));
    else box.append(status, h('h4', null, 'Dirección'), dirs, h('h4', null, 'Pendiente'), slopes);
    box.append(preview,
      h('div', { class: 'row gap bld-actions' },
        h('button', { id: 'path-build', class: 'btn primary big-ish', onmousedown: noFocus, onclick: () => pb.build() }, icon('build'), 'Construir'),
        h('button', { id: 'path-undo', class: 'btn', title: 'Quitar la última casilla', onmousedown: noFocus, onclick: () => pb.undo() }, icon('demolish'), 'Quitar')));
    if (!phone) box.append(h('p', { class: 'muted small' }, 'Intro: construir · Retroceso: quitar · Flechas izquierda y derecha: dirección · arriba y abajo: pendiente'));
    body.append(box);
    const turnName = { '-1': 'girando a la izquierda', 0: 'recto', 1: 'girando a la derecha' };
    const slopeName = { '-1': ' en bajada', 0: '', 1: ' en subida' };
    return () => {
      const g = game(), w = g.world, c = pb.cur;
      let spent = 0;
      for (const v of g.pathSession.values()) spent += v;
      const key = (pb.ver || 0) + ':' + spent + ':' + Math.floor(g.econ.money / 500) + ':' + pb.turn + pb.slope;
      if (status._k === key) return;
      status._k = key;
      clear(status);
      if (c) {
        const i = w.idx(c.tx, c.tz), up = w.path[i] ? pb.topAt(c.tx, c.tz) - MX.World.PATH_LIFT - w.heightAt((c.tx + 0.5) * T, (c.tz + 0.5) * T) : 0;
        status.append(h('span', null, h('b', null, g.pathSession.size), g.pathSession.size === 1 ? ' casilla nueva' : ' casillas nuevas'),
          h('span', null, 'Altura ', h('b', null, (up > 0.05 ? '+' : '') + U.fmt1(Math.max(0, up)) + ' m')),
          h('span', null, 'Invertido ', h('b', null, U.fmtMoney(spent))));
        if (w.path[i]) {
          const fresh = g.pathSession.get(i);
          status.append(h('span', null, 'Quitar: ', h('b', null, '+' + U.fmtMoney(fresh != null ? fresh : Math.round(g.pathValue(c.tx, c.tz, w.path[i], w.pathY[i], w.pathS[i]) * C.REFUND_RATE))), fresh != null ? ' (todo)' : ' (la mitad)'));
        }
      }
      const n = pb.plan();
      clear(preview);
      preview.className = 'bld-preview' + (n ? (n.reason ? ' bad' : ' ok') : '');
      if (!n) { preview.append(icon('info'), h('span', null, 'Toca en el mapa la casilla donde empieza el camino, o el final de uno para seguirlo')); return; }
      const name = Cat.paths[pb.type].name + (n.first ? ' · primera casilla' : ' ' + turnName[pb.turn] + slopeName[road ? 0 : pb.slope]);
      const cx = (n.tx + 0.5) * T, cz = (n.tz + 0.5) * T;
      const up = n.y === n.y && w.inBounds(n.tx, n.tz) ? w.rampY(n.tx, n.tz, n.y, n.s, cx, cz) - w.heightAt(cx, cz) : 0;
      const over = !n.reason && !n.walk && w.inBounds(n.tx, n.tz) && w.trackOcc[w.idx(n.tx, n.tz)] && up > 1 ? 'Pasa por encima del circuito' : !n.reason && !n.walk && w.inBounds(n.tx, n.tz) && w.trackOcc[w.idx(n.tx, n.tz)] ? 'Pasa por debajo del circuito' : null;
      preview.append(icon(n.reason ? 'cross' : 'check'),
        h('span', null, h('b', null, name),
          n.walk ? ' · sigue por el camino que ya hay' : !n.reason ? ' · ' + U.fmtMoney(n.cost) + (up > 0.6 ? ' · a ' + U.fmt1(up) + ' m del suelo' : '') : '',
          over ? h('em', { class: 'fix' }, over) : null,
          n.reason ? h('em', null, n.reason) : null));
    };
  }

  /* ================= Decoration ================= */
  /* one tab per pack (Catalog.decorThemes); the basic one holds safety and sponsor items */
  function decorPanel(theme) {
    const tool = TL().DecorTool;
    const cur = MX.Tools.current === tool && Cat.decor[tool.type] ? (Cat.decor[tool.type].theme || 'basic') : null;
    WM.open('decor', {
      title: 'Decoración y seguridad', icon: 'decor', width: 520,
      tabs: Cat.decorThemes.map(t => ({ id: t.id, label: t.name, build: (body) => decorTheme(body, t) })), tab: theme || cur || undefined
    });
  }
  function decorTheme(body, th) {
    const g = game(), tool = TL().DecorTool;
    const placed = {};
    for (const o of g.world.scenery.values()) if (!g.world.isTree(o)) placed[o.type] = (placed[o.type] || 0) + 1;
    const keys = Object.keys(Cat.decor).filter(k => (Cat.decor[k].theme || 'basic') === th.id);
    const grid = h('div', { class: 'card-grid' });
    const info = h('div', { class: 'card-info' });
    const showInfo = (k) => {
      const d = Cat.decor[k];
      clear(info);
      info.append(h('b', null, d.name), h('p', null, d.desc),
        h('div', { class: 'row gap wrap small' }, chip(U.fmtMoney(d.cost), 'neutral'),
          d.scenery ? chip('Ambiente +' + U.fmt1(d.scenery), 'info') : null, d.safety ? chip('Seguridad', 'good') : null,
          d.banner ? chip('Patrocinio', 'info') : null, placed[k] ? chip(placed[k] + ' colocados', 'good') : null));
    };
    for (const k of keys) {
      const d = Cat.decor[k];
      const on = MX.Tools.current === tool && tool.type === k;
      const card = h('button', { class: 'card' + (on ? ' on' : ''), title: d.desc,
        onclick: () => {
          tool.type = k; MX.Tools.set(tool); showInfo(k);
          for (const c of grid.children) c.classList.remove('on');
          card.classList.add('on');
        },
        onmouseenter: () => showInfo(k) },
        h('img', { src: thumb('d', k), alt: '', width: 72, height: 72 }), h('b', null, d.name), h('small', null, U.fmtMoney(d.cost)), d.safety ? chip('Seguridad', 'good') : null);
      grid.append(card);
    }
    body.append(h('p', { class: 'muted small theme-desc' }, th.desc), grid, info);
    showInfo(MX.Tools.current === tool && keys.includes(tool.type) ? tool.type : keys[0]);
    if (th.id === 'basic') body.append(h('p', { class: 'muted small' }, 'Balas de paja, neumáticos y vallas junto a saltos y curvas rápidas mejoran la seguridad del circuito. Árboles, flores y estatuas suben su valoración y gustan al público. Las pancartas lucen los logos de tus patrocinadores.'));
    else {
      let n = 0;
      for (const k of keys) n += placed[k] || 0;
      const zones = g.tracks.filter(t => t.stats && t.stats.themes && t.stats.themes.includes(th.id)).map(t => t.name);
      body.append(h('p', { class: 'muted small' }, 'Coloca ' + C.THEME_ZONE + ' o más piezas de ' + th.name + ' cerca de un circuito y tendrás una zona temática: sube la valoración del circuito y el público que pasea por los caminos de al lado disfruta más. Gíralas con R o con el botón de girar antes de colocarlas.'));
      if (zones.length) body.append(h('p', { class: 'small theme-zone' }, 'Zona temática en: ' + zones.join(', ')));
      else if (n) body.append(h('p', { class: 'muted small' }, 'Tienes ' + n + (n === 1 ? ' pieza' : ' piezas') + ' de esta temática en el complejo.'));
    }
  }

  MX.Panels1 = { tracksPanel, terrainPanel, buildPanel, pathsPanel, decorPanel, thumb, suggested, STATE, statRow, lockReason, currentPiece, buildState, pieceName };
})(window.MX);
