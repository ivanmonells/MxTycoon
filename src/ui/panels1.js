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
          h('button', { class: 'btn', title: 'Genera un trazado cerrado con salida y meta en tu terreno libre', onclick: () => suggested() }, icon('jump'), 'Trazado sugerido'));
        const detail = h('div', { class: 'track-detail' });
        body.append(head, list, detail);
        return () => {
          const g = game();
          keyed(list, g.tracks.map(t => t.id + t.state + t.name + (g.selectedTrack === t)).join('|'), (el) => {
            if (!g.tracks.length) el.append(h('p', { class: 'muted' }, 'Aún no tienes circuitos. Pulsa «Nuevo circuito» y dibuja el trazado con el ratón sobre tu terreno.'));
            for (const t of g.tracks) {
              const st = STATE[t.state];
              el.append(h('button', { class: 'track-chip' + (g.selectedTrack === t ? ' on' : ''), onclick: () => { g.selectedTrack = t; t.ver++; } },
                h('b', null, t.name), chip(st[0], st[1]), h('small', null, t.S ? U.fmtMeters(t.length) : 'sin trazado')));
            }
          });
          const tr = g.selectedTrack;
          keyed(detail, tr ? tr.id + ':' + tr.state + ':' + (tr.closed ? 1 : 0) + ':' + (app().trackUI.section) : 'none', (el) => buildTrackDetail(el, tr));
          if (tr && detail._upd) detail._upd();
        };
      }
    });
  }
  function newTrack() {
    const g = game();
    const tr = g.newTrack();
    if (!tr) { app().hud.toast('Has alcanzado el máximo de circuitos', 'bad'); return; }
    MX.Tools.set(TL().TrackDraw);
    app().hud.toast('Haz clic sobre el terreno para dibujar el trazado', 'info');
  }
  function buildTrackDetail(el, tr) {
    if (!tr) return;
    const g = game(), ui = app().trackUI;
    const nameIn = h('input', { id: 'track-name', class: 'inp', value: tr.name, maxlength: 28, 'aria-label': 'Nombre del circuito', onchange: (e) => { tr.name = e.target.value || tr.name; tr.ver++; } });
    const st = STATE[tr.state];
    el.append(h('div', { class: 'row gap center' }, nameIn, chip(st[0], st[1])));
    /* tools */
    const editable = tr.state !== 'open';
    const toolBtn = (ic, label, tool, extra) => {
      const b = h('button', { class: 'btn tool' + (MX.Tools.current === tool ? ' on' : ''), disabled: !editable, onclick: () => { if (extra) extra(); MX.Tools.set(tool); app().panels.tracks(); } }, icon(ic), label);
      return b;
    };
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
  function widthSurface(el, tr, beforeClose) {
    const g = game(), ui = app().trackUI;
    const editable = tr.state !== 'open';
    const srow = h('div', { class: 'row gap wrap' });
    for (const k of Cat.surfaceOrder) {
      const d = Cat.surfaces[k];
      const locked = !g.isUnlocked(d);
      const on = beforeClose ? ui.surface === k : (MX.Tools.current === TL().TrackSurface && TL().TrackSurface.surface === k);
      srow.append(h('button', { class: 'btn swatch' + (on ? ' on' : '') + (locked ? ' locked' : ''), disabled: !editable, title: locked ? lockReason(d) : d.name + ' · ' + U.fmtMoney(d.cost) + '/m',
        onclick: () => {
          if (locked) { app().hud.toast(lockReason(d), 'bad'); return; }
          ui.surface = k;
          if (!beforeClose) { TL().TrackSurface.surface = k; MX.Tools.set(TL().TrackSurface); }
          WM.rebuild('tracks');
        } }, h('i', { style: { background: d.color } }), d.name, locked ? icon('lock') : null));
    }
    const wrow = h('div', { class: 'row gap wrap' });
    for (const wv of [6, 7, 8, 10, 12]) {
      const on = beforeClose ? ui.width === wv : (MX.Tools.current === TL().TrackWidth && TL().TrackWidth.width === wv);
      wrow.append(h('button', { class: 'btn small' + (on ? ' on' : ''), disabled: !editable, onclick: () => { ui.width = wv; if (!beforeClose) { TL().TrackWidth.width = wv; MX.Tools.set(TL().TrackWidth); } WM.rebuild('tracks'); } }, wv + ' m'));
    }
    el.append(h('h4', null, beforeClose ? 'Superficie de los nuevos tramos' : 'Superficie (clic o arrastra sobre un tramo)'), srow,
      h('h4', null, beforeClose ? 'Anchura de los nuevos tramos' : 'Anchura (clic sobre un tramo)'), wrow);
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
    let tr = g.selectedTrack;
    if (!tr || tr.nodes.length) tr = g.newTrack();
    if (!tr) return;
    const cx = (best.x0 + best.w / 2) * T, cz = (best.z0 + best.h / 2) * T;
    const rx = (best.w / 2 - 2.6) * T, rz = (best.h / 2 - 2.6) * T;
    const n = 12;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      let r = 1;
      if (k === 3 || k === 9) r = 0.62;      /* two inward bends make a kidney shape */
      if (k === 6) r = 0.85;
      pts.push([cx + Math.cos(a) * rx * r, cz + Math.sin(a) * rz * (k === 3 || k === 9 ? 0.92 : r)]);
    }
    const res = g.editTrack(tr, (t) => { t.nodes = []; for (const p of pts) t.addNode(p[0], p[1], app().trackUI.width, app().trackUI.surface); t.closed = true; });
    if (!res.ok) { app().hud.toast(res.reason, 'bad'); return; }
    /* start gate and finish on the longest straight */
    for (const type of ['start', 'finish']) {
      for (let s = 0; s < tr.length; s += 2) { const c = tr.checkFeature(type, s + (type === 'finish' ? 30 : 0)); if (c.ok) { g.addFeature(tr, type, s + (type === 'finish' ? 30 : 0)); break; } }
    }
    MX.Tools.set(TL().TrackFeature);
    app().trackUI.section = 'features';
    WM.rebuild('tracks');
    app().lookAt(cx, cz);
    app().hud.toast('Trazado sugerido creado. Añade saltos y peraltes.', 'good');
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

  MX.Panels1 = { tracksPanel, terrainPanel, buildPanel, pathsPanel, decorPanel, thumb, suggested, STATE, statRow, lockReason };
})(window.MX);
