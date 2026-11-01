/* MX Tycoon - management panels: staff, finances, events and live races, research,
   objectives, park overview, info windows, options, save/load and menus. */
(function (MX) {
  'use strict';
  const { h, icon, clear, bar, chip, stars, portrait } = MX.DOM;
  const U = MX.U, C = MX.C, Cat = MX.Catalog;
  const WM = MX.WM;
  const keyed = MX.UIKeyed;
  const app = () => MX.App;
  const game = () => MX.App.game;
  const { statRow } = MX.Panels1;

  /* ================= Staff ================= */
  function staffPanel(role) {
    WM.open('staff', {
      title: 'Personal', icon: 'staff', width: 460,
      tabs: Cat.staffOrder.map(r => ({ id: r, label: Cat.staff[r].plural, build: (body) => staffRole(body, r) })), tab: role
    });
  }
  function staffRole(body, role) {
    const g = game(), d = Cat.staff[role];
    const locked = !g.isUnlocked(d);
    body.append(h('p', { class: 'muted small' }, d.desc + (d.needs ? ' Requiere: ' + Cat.buildings[d.needs].name + '.' : '')));
    const cands = h('div', { class: 'cands' });
    const list = h('div', { class: 'staff-list' });
    body.append(h('h4', null, 'Candidatos'), cands, h('h4', null, 'En plantilla'), list);
    const fillCands = () => {
      clear(cands);
      if (locked) { cands.append(h('p', { class: 'muted' }, 'Bloqueado: ' + MX.Panels1.lockReason(d))); return; }
      for (const c of g.candidates(role)) {
        cands.append(h('div', { class: 'cand' }, portrait(c.cols, 'person'),
          h('div', { class: 'grow' }, h('b', null, c.name), h('div', null, stars(c.skill, 5)), h('small', null, U.fmtMoney(c.salary) + ' al mes')),
          h('button', { class: 'btn primary', onclick: () => { const r = g.hire(role, c); if (r.ok) { MX.Audio.sfx('cash'); fillCands(); } else { app().hud.toast(r.reason, 'bad'); MX.Audio.sfx('error'); } } }, 'Contratar')));
      }
    };
    fillCands();
    return () => keyed(list, g.staff.filter(s => s.role === role).map(s => s.id + ':' + s.state + ':' + s.worked).join(','), (el) => {
      const mine = g.staff.filter(s => s.role === role);
      if (!mine.length) el.append(h('p', { class: 'muted' }, 'Nadie contratado.'));
      for (const s of mine) el.append(h('div', { class: 'staff-row' }, portrait(s.cols, 'person'),
        h('div', { class: 'grow' }, h('b', null, s.name), h('small', null, staffStatus(s))), stars(s.skill, 5), h('small', null, U.fmtMoney(s.salary)),
        h('button', { class: 'mini', title: 'Ver', onclick: () => agentPanel(s) }, icon('follow')),
        h('button', { class: 'mini danger', title: 'Despedir', onclick: () => app().confirm('Despedir a ' + s.name, 'Pagarás una indemnización de ' + U.fmtMoney(Math.round(s.salary * 0.5)) + '.', () => g.fire(s.id)) }, icon('close'))));
    });
  }
  function staffStatus(s) {
    const g = game();
    const m = {
      mechanic: () => s.home ? 'Trabajando en el taller' : 'Sin taller asignado',
      coach: () => s.home ? 'Dando clases en la escuela' : 'Sin escuela',
      cleaner: () => s.task ? (s.task.kind === 'toilet' ? 'Limpiando baños' : 'Recogiendo basura') : 'Patrullando caminos',
      crew: () => ({ idle: 'En la nave', drive: 'Yendo a la pista', groom: 'Reparando la pista', ret: 'Volviendo' })[s.state] || 'Volviendo a la nave',
      medic: () => ({ respond: 'Atendiendo una emergencia', treat: 'Curando a un piloto', back: 'Volviendo' })[s.state] || 'De guardia',
      marshal: () => s.flagT > 0 ? '¡Bandera amarilla!' : 'Vigilando la pista'
    };
    void g;
    return (m[s.role] || (() => ''))();
  }

  /* ================= Finance ================= */
  function financePanel(tab) {
    WM.open('finance', {
      title: 'Finanzas', icon: 'finance', width: 500, tab,
      tabs: [
        { id: 'summary', label: 'Resumen', build: finSummary },
        { id: 'charts', label: 'Gráficos', build: finCharts },
        { id: 'prices', label: 'Precios', build: finPrices },
        { id: 'loan', label: 'Préstamo', build: finLoan },
        { id: 'marketing', label: 'Marketing', build: finMarketing },
        { id: 'sponsors', label: 'Patrocinios', build: finSponsors }
      ]
    });
  }
  function finSummary(body) {
    const tbl = h('div', { class: 'fin-table' });
    body.append(tbl);
    return () => {
      const g = game(), E = g.econ;
      const cur = E.month, prev = E.history[E.history.length - 1];
      keyed(tbl, Math.round(E.sumIncome(cur)) + ':' + Math.round(E.sumExpense(cur)) + ':' + E.history.length, (el) => {
        const head = h('div', { class: 'fin-row head' }, h('span', null, ''), h('b', null, 'Este mes'), h('b', null, 'Mes anterior'));
        el.append(head);
        const section = (title, map, key) => {
          el.append(h('div', { class: 'fin-row sec' }, h('span', null, title)));
          for (const k in map) {
            const a = cur[key][k] || 0, b = prev ? prev[key][k] || 0 : 0;
            if (!a && !b) continue;
            el.append(h('div', { class: 'fin-row' }, h('span', null, map[k]), h('b', { class: key === 'income' ? 'pos' : 'neg' }, U.fmtMoney(a)), h('small', null, U.fmtMoney(b))));
          }
        };
        section('Ingresos', MX.Economy.INCOME, 'income');
        section('Gastos', MX.Economy.EXPENSE, 'expense');
        const p = E.profit(cur), pp = prev ? E.profit(prev) : 0;
        el.append(h('div', { class: 'fin-row total' }, h('span', null, 'Beneficio'), h('b', { class: p >= 0 ? 'pos' : 'neg' }, U.fmtMoneySigned(p)), h('small', null, prev ? U.fmtMoneySigned(pp) : '-')));
        el.append(h('div', { class: 'fin-row' }, h('span', null, 'Dinero en caja'), h('b', { class: E.money >= 0 ? '' : 'neg' }, U.fmtMoney(E.money)), h('small', null, 'Préstamo: ' + U.fmtMoney(E.loan))));
        if (E.money < 0) el.append(h('div', { class: 'callout warn' }, icon('warn'), 'Números rojos durante ' + E.negDays + ' días. A los ' + C.BANKRUPT_DAYS + ' días, o por debajo de ' + U.fmtMoney(C.BANKRUPT_LIMIT) + ', el banco cierra el complejo.'));
      });
    };
  }
  function finCharts(body) {
    const c1 = h('canvas', { class: 'chart', width: 460, height: 170 });
    const c2 = h('canvas', { class: 'chart', width: 460, height: 150 });
    body.append(h('h4', null, 'Evolución del dinero'), c1, h('h4', null, 'Ingresos y gastos por mes'), c2);
    return () => {
      const g = game();
      drawLine(c1, g.econ.cash.slice(-140).map(p => p.m), '#ffd22e');
      const months = g.econ.history.slice(-12).concat([g.econ.month]);
      drawBars(c2, months.map(m => [g.econ.sumIncome(m), g.econ.sumExpense(m)]), months.map(m => U.MONTHS_SHORT[(C.START_MONTH + m.index) % 12]));
    };
  }
  function drawLine(c, vals, colr) {
    const ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#211c18'; ctx.fillRect(0, 0, W, H);
    if (vals.length < 2) { ctx.fillStyle = '#b8a894'; ctx.font = '13px sans-serif'; ctx.fillText('Aún no hay datos suficientes', 12, H / 2); return; }
    let mn = Math.min(0, ...vals), mx = Math.max(...vals);
    if (mx - mn < 1) mx = mn + 1;
    const pad = 34;
    const x = (i) => pad + i / (vals.length - 1) * (W - pad - 8), y = (v) => H - 16 - (v - mn) / (mx - mn) * (H - 28);
    ctx.strokeStyle = '#3a312a'; ctx.lineWidth = 1; ctx.fillStyle = '#b8a894'; ctx.font = '10px sans-serif';
    for (let k = 0; k <= 3; k++) {
      const v = mn + (mx - mn) * k / 3, yy = y(v);
      ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(W - 8, yy); ctx.stroke();
      ctx.fillText(Math.abs(v) >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v), 2, yy + 3);
    }
    if (mn < 0) { ctx.strokeStyle = '#e53935'; ctx.beginPath(); ctx.moveTo(pad, y(0)); ctx.lineTo(W - 8, y(0)); ctx.stroke(); }
    ctx.beginPath();
    vals.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.lineTo(x(vals.length - 1), y(mn)); ctx.lineTo(x(0), y(mn)); ctx.closePath();
    ctx.fillStyle = 'rgba(255,210,46,0.14)'; ctx.fill();
    ctx.beginPath(); vals.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.strokeStyle = colr; ctx.lineWidth = 2; ctx.stroke();
    const lx = x(vals.length - 1), ly = y(vals[vals.length - 1]);
    ctx.fillStyle = colr; ctx.beginPath(); ctx.arc(lx, ly, 3, 0, 7); ctx.fill();
  }
  function drawBars(c, pairs, labels) {
    const ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#211c18'; ctx.fillRect(0, 0, W, H);
    const mx = Math.max(1, ...pairs.flat());
    const bw = (W - 20) / pairs.length;
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    pairs.forEach(([a, b], i) => {
      const x0 = 10 + i * bw;
      const ha = a / mx * (H - 30), hb = b / mx * (H - 30);
      ctx.fillStyle = '#5cc26a'; ctx.fillRect(x0 + bw * 0.12, H - 16 - ha, bw * 0.36, ha);
      ctx.fillStyle = '#ef5350'; ctx.fillRect(x0 + bw * 0.52, H - 16 - hb, bw * 0.36, hb);
      ctx.fillStyle = '#b8a894'; ctx.fillText(labels[i], x0 + bw / 2, H - 4);
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5cc26a'; ctx.fillRect(W - 140, 6, 10, 10); ctx.fillStyle = '#e8ddd0'; ctx.fillText('Ingresos', W - 126, 15);
    ctx.fillStyle = '#ef5350'; ctx.fillRect(W - 70, 6, 10, 10); ctx.fillStyle = '#e8ddd0'; ctx.fillText('Gastos', W - 56, 15);
  }
  function slider(id, label, min, max, step, value, fmt, onInput, hint) {
    const out = h('b', null, fmt(value));
    const inp = h('input', { id, type: 'range', min, max, step, value, oninput: (e) => { const v = +e.target.value; out.textContent = fmt(v); onInput(v); } });
    return h('div', { class: 'slider' }, h('label', { for: id }, label), inp, out, hint ? h('small', { class: 'muted' }, hint) : null);
  }
  function finPrices(body) {
    const g = game(), P = g.econ.prices;
    const fairT = 7 + g.rep / 80, fairR = 24 + g.rep / 35;
    /* each discipline charges its own share of the base fee */
    const feeBy = h('small', { class: 'muted fee-by' });
    const feeTxt = () => {
      const types = Cat.trackTypeOrder.filter(k => k !== 'mx' && (g.tracks.some(t => t.type === k) || g.trackTypeUnlocked(k)));
      feeBy.textContent = types.length ? 'Otras disciplinas: ' + types.map(k => Cat.trackTypes[k].name + ' ' + U.fmtMoney(g.riderFeeFor(k))).join(' · ') + '.' : '';
    };
    feeTxt();
    body.append(
      slider('p-ticket', 'Entrada de espectadores', 0, 60, 1, P.ticket, (v) => U.fmtMoney(v), (v) => { P.ticket = v; }, 'Precio justo ahora: unos ' + U.fmtMoney(Math.round(fairT)) + '. Con buenos circuitos y servicios el público paga más.'),
      slider('p-fee', 'Tarifa de pista para pilotos', 0, 90, 1, P.riderFee, (v) => U.fmtMoney(v), (v) => { P.riderFee = v; feeTxt(); }, 'Precio justo ahora: unos ' + U.fmtMoney(Math.round(fairR)) + ' por día de rodaje de motocross.'),
      feeBy,
      slider('p-pass', 'Abono de temporada (mensual)', 20, 260, 5, P.pass, (v) => U.fmtMoney(v), (v) => { P.pass = v; }, 'Los pilotos satisfechos se abonan. Abonados actuales: ' + g.passHolders.length + '.'),
      slider('p-food', 'Nivel de precios de comida y bebida', 0.6, 1.8, 0.05, P.food, (v) => 'Bocadillo ' + U.fmtMoney(Math.round(7 * v)) + ' · bebida ' + U.fmtMoney(Math.round(3 * v)), (v) => { P.food = v; }),
      slider('p-merch', 'Nivel de precios del merchandising', 0.6, 1.8, 0.05, P.merch, (v) => 'Camiseta ' + U.fmtMoney(Math.round(20 * v)), (v) => { P.merch = v; }),
      slider('p-parking', 'Aparcamiento por coche', 0, 10, 1, P.parking, (v) => U.fmtMoney(v), (v) => { P.parking = v; })
    );
  }
  function finLoan(body) {
    const info = h('div');
    body.append(info);
    return () => {
      const g = game(), E = g.econ;
      keyed(info, E.loan + ':' + E.maxLoan + ':' + Math.round(E.money / 1000), (el) => {
        if (g.mode === 'sandbox') { el.append(h('p', null, 'En el modo sandbox no hacen falta préstamos.')); return; }
        el.append(statRow('Préstamo actual', U.fmtMoney(E.loan)), statRow('Límite de crédito', U.fmtMoney(E.maxLoan)),
          statRow('Interés anual', (C.LOAN_RATE_YEAR * 100).toFixed(1).replace('.', ',') + '%'), statRow('Intereses al mes', U.fmtMoney(E.interest())),
          h('div', { class: 'row gap' },
            h('button', { class: 'btn primary', disabled: E.loan >= E.maxLoan, onclick: () => { const a = E.takeLoan(C.LOAN_STEP); if (a) { MX.Audio.sfx('cash'); g.notify('El banco te presta ' + U.fmtMoney(a) + '.', 'money'); } } }, 'Pedir ' + U.fmtMoney(C.LOAN_STEP)),
            h('button', { class: 'btn', disabled: E.loan <= 0 || E.money < C.LOAN_STEP, onclick: () => { E.repayLoan(C.LOAN_STEP); MX.Audio.sfx('click'); } }, 'Devolver ' + U.fmtMoney(C.LOAN_STEP))),
          h('p', { class: 'muted small' }, 'El límite de crédito crece con la reputación y el valor del complejo.'));
      });
    };
  }
  function finMarketing(body) {
    const g = game();
    const box = h('div');
    body.append(box);
    if (!g.count('office')) box.append(h('div', { class: 'callout warn' }, icon('warn'), 'Necesitas una oficina para lanzar campañas de marketing.'));
    const weeks = { v: 2 };
    const wrow = h('div', { class: 'row gap' }, h('span', null, 'Duración:'));
    for (const w of [1, 2, 4]) wrow.append(h('button', { class: 'btn small' + (weeks.v === w ? ' on' : ''), onclick: (e) => { weeks.v = w; for (const b of wrow.querySelectorAll('button')) b.classList.remove('on'); e.currentTarget.classList.add('on'); } }, w + ' sem.'));
    box.append(wrow);
    const list = h('div', { class: 'mk-list' });
    box.append(list);
    return () => keyed(list, g.marketing.map(m => m.id + m.days).join(','), (el) => {
      for (const d of Cat.marketing) {
        const act = g.marketing.find(m => m.id === d.id);
        const locked = !g.isUnlocked(d);
        el.append(h('div', { class: 'mk' + (act ? ' on' : '') },
          h('div', { class: 'grow' }, h('b', null, d.name), h('small', null, d.desc + ' ' + U.fmtMoney(d.week) + '/semana.' + (d.visitors ? ' +' + Math.round(d.visitors * 100) + '% público.' : '') + (d.riders ? ' +' + Math.round(d.riders * 100) + '% pilotos.' : ''))),
          act ? h('span', { class: 'chip chip-good' }, act.days + ' días') :
            h('button', { class: 'btn', disabled: locked || !g.count('office'), title: locked ? 'Investiga marketing digital' : '', onclick: () => { const r = g.amb.startCampaign(d.id, weeks.v); if (!r.ok) app().hud.toast(r.reason, 'bad'); else MX.Audio.sfx('cash'); } }, locked ? 'Bloqueada' : 'Lanzar')));
      }
    });
  }
  function finSponsors(body) {
    const g = game();
    const box = h('div');
    body.append(box);
    return () => keyed(box, g.sponsors.map(s => s.id + s.months).join(',') + ':' + g.amb.pending.length, (el) => {
      if (!g.count('office')) el.append(h('div', { class: 'callout' }, icon('info'), 'Con una oficina empezarás a recibir ofertas de patrocinio.'));
      if (!g.sponsors.length) el.append(h('p', { class: 'muted' }, 'Sin patrocinadores. Las marcas se interesan por complejos con buena reputación y circuitos abiertos.'));
      for (const s of g.sponsors) {
        const d = Cat.sponsors.find(x => x.id === s.id);
        el.append(h('div', { class: 'sp-row' }, h('img', { class: 'logo', alt: d.name, src: logoURL(d) }),
          h('div', { class: 'grow' }, h('b', null, d.name), h('small', null, d.kind + ' · ' + U.fmtMoney(s.pay) + '/mes · quedan ' + s.months + ' meses' + (s.needBanners ? ' · exige ' + s.needBanners + ' pancartas' : '')))));
      }
      for (const p of g.amb.pending.filter(x => x.meta.kind === 'sponsor')) el.append(h('div', { class: 'callout' }, icon('money'), h('span', { class: 'grow' }, p.text), h('button', { class: 'btn primary', onclick: () => g.amb.decide(p.id, 'yes') }, 'Aceptar'), h('button', { class: 'btn', onclick: () => g.amb.decide(p.id, 'no') }, 'Rechazar')));
    });
  }
  function logoURL(d) {
    const c = document.createElement('canvas'); c.width = 96; c.height = 30;
    const x = c.getContext('2d');
    x.fillStyle = d.c1; x.fillRect(0, 0, 96, 30); x.fillStyle = d.c2; x.fillRect(0, 25, 96, 5);
    x.font = 'italic 800 16px "Saira Condensed", "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(d.name.toUpperCase(), 48, 13, 90);
    return c.toDataURL();
  }

  /* ================= Events ================= */
  function eventsPanel(tab) {
    WM.open('events', {
      title: 'Eventos y competiciones', icon: 'events', width: 520, tab,
      tabs: [{ id: 'organize', label: 'Organizar', build: evOrganize }, { id: 'calendar', label: 'Calendario', build: evCalendar }, { id: 'history', label: 'Historial', build: evHistory }]
    });
  }
  function evOrganize(body) {
    const g = game();
    /* an event runs on a track of its own discipline, open ones first */
    const tracksFor = (type) => { const want = Cat.events[type].track; return g.tracks.filter(t => !want || t.type === want).sort((a, b) => (b.state === 'open') - (a.state === 'open')); };
    const st = { type: app().evSel || 'training', track: null, day: g.comp.nextDates()[0], ticket: null };
    const fitTrack = () => { const list = tracksFor(st.type); if (!list.some(t => t.id === st.track)) st.track = list.length ? list[0].id : null; };
    fitTrack();
    const types = h('div', { class: 'ev-types' });
    const detail = h('div', { class: 'ev-detail' });
    body.append(types, detail);
    for (const k of Cat.eventOrder) {
      const d = Cat.events[k];
      const locked = !g.isUnlocked(d);
      const td = d.track && Cat.trackTypes[d.track];
      types.append(h('button', { class: 'evt' + (st.type === k ? ' on' : '') + (locked ? ' locked' : ''), onclick: (e) => { st.type = k; app().evSel = k; st.ticket = null; fitTrack(); for (const b of types.children) b.classList.remove('on'); e.currentTarget.classList.add('on'); draw(); } },
        h('b', null, td ? h('span', { class: 'type-tag', style: { background: td.color }, title: td.name }, td.short) : null, d.name), h('small', null, locked ? 'Bloqueado' : 'Reputación ' + d.rep + '+')));
    }
    const draw = () => {
      clear(detail);
      const d = Cat.events[st.type];
      const tr = st.track != null ? g.trackById(st.track) : null;
      if (st.ticket == null) st.ticket = d.ticket || 0;
      detail.append(h('p', null, d.desc));
      if (st.type !== 'training') {
        const list = tracksFor(st.type), td = Cat.trackTypes[d.track];
        if (!list.length) detail.append(h('div', { class: 'callout warn' }, icon('warn'), 'Hace falta un circuito de ' + td.name.toLowerCase() + '. Créalo en Circuitos, con «Nuevo circuito».'));
        else {
          const sel = h('select', { id: 'ev-track', class: 'inp', onchange: (e) => { st.track = +e.target.value; draw(); } });
          for (const t of list) sel.append(h('option', { value: t.id, selected: t.id === st.track }, t.name + (t.state === 'open' ? '' : ' (' + MX.Panels1.STATE[t.state][0].toLowerCase() + ')')));
          detail.append(h('div', { class: 'row gap center' }, h('label', { for: 'ev-track' }, 'Circuito'), sel));
        }
        if (d.format === 'crono') detail.append(h('p', { class: 'muted small' }, 'Contrarreloj: los pilotos salen de uno en uno y gana el mejor tiempo.'));
      }
      const dsel = h('select', { id: 'ev-day', class: 'inp', onchange: (e) => { st.day = +e.target.value; } });
      for (const dd of g.comp.nextDates()) dsel.append(h('option', { value: dd, selected: dd === st.day }, g.dateText(dd)));
      detail.append(h('div', { class: 'row gap center' }, h('label', { for: 'ev-day' }, 'Fecha'), dsel));
      if (d.ticket) {
        const att = h('b');
        const upd = () => { att.textContent = U.fmtInt(g.comp.expectedAttendance(st.type, st.ticket)) + ' espectadores (aforo ' + U.fmtInt(g.comp.capacity()) + ')'; };
        detail.append(slider('ev-ticket', 'Precio de la entrada', 0, d.ticket * 3, 1, st.ticket, (v) => U.fmtMoney(v), (v) => { st.ticket = v; upd(); }));
        detail.append(h('div', { class: 'kv' }, h('span', null, 'Asistencia prevista'), att));
        upd();
        detail.append(statRow(d.track === 'carcross' ? 'Pilotos inscritos (buggies)' : 'Pilotos inscritos', d.riders + ' · ' + U.fmtMoney(d.entryFee) + ' de inscripción'), statRow('Vueltas', tr ? g.comp.lapsFor(st.type, tr) : '-'),
          statRow('Patrocinio del evento', U.fmtMoney(d.sponsor) + (d.tv ? ' · TV hasta ' + U.fmtMoney(Math.round(d.tv * 1.5)) : '')), statRow('Premios', U.fmtMoney(d.prize)));
      }
      detail.append(statRow('Coste de organización', U.fmtMoney(d.cost)));
      const reqs = g.comp.requirements(st.type, tr);
      const rl = h('div', { class: 'reqs' });
      for (const r of reqs) rl.append(h('div', { class: 'req ' + (r.ok ? 'ok' : 'no') }, icon(r.ok ? 'check' : 'cross'), h('span', null, r.label), h('b', null, r.fmt === 'bool' ? '' : r.have + ' / ' + r.need)));
      detail.append(h('h4', null, 'Requisitos'), rl);
      const chk = g.comp.canSchedule(st.type, tr, st.day);
      detail.append(h('button', { class: 'btn primary big', disabled: !chk.ok, onclick: () => {
        const r = g.comp.schedule(st.type, tr ? tr.id : null, st.day, st.ticket);
        if (r.ok) { MX.Audio.sfx('success'); WM.setTab('events', 'calendar'); } else app().hud.toast(r.reason, 'bad');
      } }, icon('events'), chk.ok ? 'Programar evento' : 'Faltan requisitos'));
    };
    draw();
  }
  function evCalendar(body) {
    const g = game();
    const box = h('div');
    body.append(box);
    return () => keyed(box, g.comp.scheduled.map(e => e.id).join(',') + ':' + g.day, (el) => {
      if (!g.comp.scheduled.length) el.append(h('p', { class: 'muted' }, 'No hay eventos programados. Organiza uno en la pestaña «Organizar».'));
      for (const e of g.comp.scheduled) {
        const d = Cat.events[e.type], tr = e.trackId != null ? g.trackById(e.trackId) : null;
        el.append(h('div', { class: 'ev-row' }, icon('calendar'), h('div', { class: 'grow' }, h('b', null, d.name), h('small', null, g.dateText(e.day) + ' · faltan ' + (e.day - g.day) + ' días' + (tr ? ' · ' + tr.name : '') + (d.ticket ? ' · entrada ' + U.fmtMoney(e.ticket) : ''))),
          h('button', { class: 'btn small', onclick: () => app().confirm('Cancelar evento', 'Recuperas la mitad de la inversión.', () => g.comp.cancel(e.id)) }, 'Cancelar')));
      }
    });
  }
  function evHistory(body) {
    const g = game();
    const box = h('div');
    body.append(box);
    return () => keyed(box, g.comp.history.length, (el) => {
      if (!g.comp.history.length) el.append(h('p', { class: 'muted' }, 'Todavía no has organizado ningún evento.'));
      for (const e of g.comp.history.slice().reverse()) {
        if (e.type === 'training') { el.append(h('div', { class: 'ev-row' }, icon('rider'), h('div', { class: 'grow' }, h('b', null, 'Jornada de entrenamiento'), h('small', null, g.dateText(e.day))))); continue; }
        el.append(h('div', { class: 'ev-row clickable', onclick: () => e.standings && resultsPanel(e) }, icon('trophy'), h('div', { class: 'grow' }, h('b', null, e.name || Cat.events[e.type].name), h('small', null, g.dateText(e.day) + (e.cancelled ? ' · suspendido' : ' · ' + U.fmtInt(e.attendance) + ' espectadores · ingresos ' + U.fmtMoney(e.revenue)))),
          e.cancelled ? chip('Suspendido', 'bad') : chip(e.quality + '/100', e.quality >= 60 ? 'good' : 'warn')));
      }
    });
  }
  function racePanel() {
    WM.open('race', {
      title: 'Carrera en directo', icon: 'events', width: 380, every: 0.3, cls: 'race-win',
      build: (body) => {
        const head = h('div', { class: 'race-head' });
        const tbl = h('div', { class: 'race-table' });
        const feed = h('div', { class: 'race-feed' });
        const acts = h('div', { class: 'row gap' },
          h('button', { class: 'btn', onclick: () => { const r = game().race; if (r) { const lead = (r.order[0] || r.riders[0]); if (lead) app().follow(lead); } } }, icon('follow'), 'Seguir al líder'));
        body.append(head, tbl, feed, acts);
        return () => {
          const r = game().race;
          if (!r) { clear(head); head.append(h('p', null, 'No hay ninguna carrera en curso.')); clear(tbl); return; }
          clear(head);
          head.append(h('b', null, r.def.name + ' · ' + r.tr.name), h('small', null, r.phase === 'race' ? r.laps + ' vueltas' : r.phase === 'grid' ? 'Parrilla de salida' : r.phase === 'gather' ? 'Llegada del público' : 'Resultados'));
          clear(tbl);
          const order = r.order.length ? r.order : r.riders;
          const lead = order[0];
          order.slice(0, 20).forEach((x, i) => {
            const gap = i === 0 ? '' : x.done && lead.done ? '+' + U.fmt1((x.finishT || 0) - (lead.finishT || 0)) + ' s' : x.raceDist != null ? '-' + Math.max(0, Math.round((lead.raceDist - x.raceDist))) + ' m' : '';
            tbl.append(h('div', { class: 'race-row' + (i < 3 ? ' top' : '') + (x.m && x.m.crash ? ' crash' : ''), onclick: () => app().follow(x) },
              h('span', { class: 'pos' }, (i + 1) + 'º'), h('span', { class: 'num' }, '#' + x.num), h('i', { class: 'brand-dot', title: x.bikeName, style: { background: Cat.brands[x.brand] ? Cat.brands[x.brand].main : '#777' } }), h('span', { class: 'nm' }, x.name),
              h('small', null, x.done ? 'Meta' : (x.lapsDone != null ? 'V' + Math.min(r.laps, x.lapsDone + 1) : '')), h('small', null, gap), h('small', null, x.bestRace ? U.fmtLap(x.bestRace) : '')));
          });
          clear(feed);
          for (const f of r.feed.slice(0, 4)) feed.append(h('div', null, f.t));
        };
      }
    });
  }
  function resultsPanel(res) {
    WM.open('results', {
      title: 'Resultados · ' + (res.name || ''), icon: 'trophy', width: 420, rebuild: true,
      build: (body) => {
        const pod = h('div', { class: 'podium' });
        const top = res.standings.slice(0, 3);
        const order = [top[1], top[0], top[2]];
        order.forEach((r, i) => { if (!r) return; pod.append(h('div', { class: 'pod p' + (i === 1 ? 1 : i === 0 ? 2 : 3) }, h('b', null, r.name), h('small', null, '#' + r.num), h('div', { class: 'step' }, i === 1 ? '1' : i === 0 ? '2' : '3'))); });
        body.append(pod);
        body.append(h('div', { class: 'big-stats' },
          h('div', null, h('small', null, 'Valoración'), h('b', null, res.quality), h('em', null, '/100')),
          h('div', null, h('small', null, 'Público'), h('b', null, U.fmtInt(res.attendance)), h('em', null, 'personas')),
          h('div', null, h('small', null, 'Prestigio'), h('b', null, '+' + res.repGain), h('em', null, 'puntos'))));
        body.append(statRow('Ingresos del evento', U.fmtMoney(res.revenue)), statRow('Coste y premios', U.fmtMoney(res.cost)),
          statRow('Adelantamientos · caídas · lesiones', res.overtakes + ' · ' + res.crashes + ' · ' + res.injuries),
          statRow('Vuelta rápida', res.fastest ? U.fmtLap(res.fastest.t) + ' · ' + res.fastest.name : '-'));
        const tbl = h('div', { class: 'race-table' });
        for (const r of res.standings) tbl.append(h('div', { class: 'race-row' }, h('span', { class: 'pos' }, r.pos + 'º'), h('span', { class: 'num' }, '#' + r.num), h('span', { class: 'nm' }, r.name), h('small', null, r.done ? U.fmtLap(r.time) : 'No terminó'), h('small', null, r.best ? U.fmtLap(r.best) : '')));
        body.append(h('h4', null, 'Clasificación'), tbl);
      }
    });
  }

  /* ================= Research ================= */
  function researchPanel() {
    WM.open('research', {
      title: 'Investigación y desarrollo', icon: 'research', width: 470,
      build: (body) => {
        const cur = h('div', { class: 'res-cur' });
        const list = h('div', { class: 'res-list' });
        body.append(cur, list);
        return () => {
          const g = game(), R = g.prog.research;
          keyed(cur, (R.current || '') + ':' + Math.floor(R.progress * 10), (el) => {
            if (!R.current) { el.append(h('p', { class: 'muted' }, 'No hay ninguna investigación en marcha. Elige una de la lista: se paga día a día mientras dura.')); return; }
            const d = g.prog.researchDef(R.current);
            el.append(h('div', { class: 'row gap center' }, icon('research'), h('b', null, d.name), h('small', null, Math.floor(R.progress) + '/' + d.days + ' días')), bar(R.progress, d.days, 'info'),
              h('small', { class: 'muted' }, d.desc + (g.count('office') ? ' La oficina acelera la investigación un 25%.' : '')));
          });
          const repLow = (d) => d.minRep && g.mode !== 'sandbox' && g.rep < d.minRep;
          keyed(list, R.done.join(',') + ':' + (R.current || '') + ':' + R.queue.join(',') + ':' + Cat.research.filter(repLow).length, (el) => {
            for (const d of Cat.research) {
              const done = R.done.includes(d.id), avail = g.prog.researchAvailable(d.id), queued = R.queue.includes(d.id), current = R.current === d.id;
              const reqTxt = (d.req || []).filter(r => !R.done.includes(r)).map(r => g.prog.researchDef(r).name).concat(!done && repLow(d) ? ['reputación ' + d.minRep] : []).join(', ');
              el.append(h('div', { class: 'res' + (done ? ' done' : '') + (current ? ' on' : '') },
                h('div', { class: 'grow' }, h('b', null, d.name), h('small', null, d.desc + ' ' + U.fmtMoney(d.cost) + ' · ' + d.days + ' días.' + (reqTxt ? ' Requiere: ' + reqTxt + '.' : ''))),
                done ? chip('Hecho', 'good') : current ? h('button', { class: 'btn small', onclick: () => g.prog.cancelResearch(d.id) }, 'Detener') :
                  queued ? h('button', { class: 'btn small', onclick: () => g.prog.cancelResearch(d.id) }, 'En cola ×') :
                    h('button', { class: 'btn small primary', disabled: !avail, onclick: () => { const r = g.prog.startResearch(d.id); if (r.ok) MX.Audio.sfx('click'); } }, R.current ? 'A la cola' : 'Investigar')));
            }
          });
        };
      }
    });
  }

  /* ================= Objectives ================= */
  function objectivesPanel() {
    WM.open('objectives', {
      title: 'Objetivos', icon: 'objectives', width: 440,
      build: (body) => {
        const box = h('div');
        body.append(box);
        return () => {
          const g = game();
          keyed(box, g.prog.objIndex + ':' + g.prog.progress().map(p => p.v).join(',') + ':' + g.prog.challenges.map(c => c.state + c.value).join(','), (el) => {
            if (g.mode === 'sandbox') { el.append(h('p', null, 'Modo sandbox: construye sin límites. Todo está desbloqueado y no hay objetivos.')); return; }
            el.append(h('h4', null, 'Modo carrera'));
            Cat.objectives.forEach((o, i) => {
              const done = i < g.prog.objIndex, cur = i === g.prog.objIndex;
              const card = h('div', { class: 'obj' + (done ? ' done' : '') + (cur ? ' on' : '') },
                h('div', { class: 'row gap center' }, icon(done ? 'check' : cur ? 'objectives' : 'lock'), h('b', null, (i + 1) + '. ' + o.name)),
                (done || cur) ? h('small', null, o.desc) : h('small', { class: 'muted' }, 'Se desvelará más adelante.'));
              if (cur) {
                for (const p of g.prog.progress()) card.append(h('div', { class: 'ot-row' }, h('span', null, p.label), h('b', null, (p.money ? U.fmtMoney(p.v) : U.fmtInt(p.v)) + ' / ' + (p.money ? U.fmtMoney(p.t) : U.fmtInt(p.t)))), bar(p.v, p.t, p.v >= p.t ? 'good' : ''));
                const r = o.reward;
                card.append(h('small', { class: 'reward' }, 'Recompensa: ' + [r.money ? U.fmtMoney(r.money) : '', r.parcels ? 'terrenos nuevos' : '', r.unlock ? 'nueva categoría de competición' : ''].filter(Boolean).join(' · ')));
              }
              el.append(card);
            });
            el.append(h('h4', null, 'Desafíos del mes'));
            if (!g.prog.challenges.length) el.append(h('p', { class: 'muted' }, 'Abre un circuito para recibir desafíos mensuales.'));
            for (const c of g.prog.challenges) {
              const t = g.prog.challengeText(c);
              el.append(h('div', { class: 'obj ' + (c.state === 'done' ? 'done' : c.state === 'failed' ? 'failed' : 'on') },
                h('div', { class: 'row gap center' }, icon(c.state === 'done' ? 'check' : c.state === 'failed' ? 'cross' : 'star'), h('b', null, t.name), chip(U.fmtMoney(t.reward), 'good')),
                h('small', null, t.desc), c.state === 'active' ? bar(c.value || 0, c.target || 1) : null));
            }
          });
        };
      }
    });
  }

  /* ================= Park overview ================= */
  function parkPanel(tab) {
    WM.open('park', {
      title: 'Parque', icon: 'park', width: 460, tab,
      tabs: [{ id: 'summary', label: 'Resumen', build: parkSummary }, { id: 'thoughts', label: 'Opiniones', build: parkThoughts }, { id: 'riders', label: 'Pilotos', build: (b) => peopleList(b, 'riders') }, { id: 'people', label: 'Visitantes', build: (b) => peopleList(b, 'visitors') }]
    });
  }
  function parkSummary(body) {
    const g = game();
    const nameIn = h('input', { id: 'park-name', class: 'inp', value: g.parkName, maxlength: 30, 'aria-label': 'Nombre del complejo', onchange: (e) => { g.parkName = e.target.value || g.parkName; MX.Tex.redrawParkName(app().renderer.gl, app().renderer.atlasTex, g.parkName); g.bldVer++; } });
    const box = h('div');
    body.append(h('div', { class: 'row gap center' }, h('label', { for: 'park-name' }, 'Nombre'), nameIn), box);
    return () => keyed(box, Math.round(g.rep) + ':' + g.visitors.length + ':' + g.riders.length + ':' + g.day, (el) => {
      const rp = g.repParts;
      el.append(h('div', { class: 'big-stats' },
        h('div', null, h('small', null, 'Reputación'), h('b', null, Math.round(g.rep)), h('em', null, g.repLabel())),
        h('div', null, h('small', null, 'Visitantes'), h('b', null, g.visitors.length), h('em', null, U.fmtInt(g.totals.visitors) + ' en total')),
        h('div', null, h('small', null, 'Pilotos'), h('b', null, g.riders.length), h('em', null, U.fmtInt(g.totals.riders) + ' en total'))));
      const row = (label, v) => h('div', { class: 'kv' }, h('span', null, label), bar(v, 1, v > 0.6 ? 'good' : v < 0.35 ? 'bad' : ''), h('b', null, Math.round(v * 100) + '%'));
      el.append(h('h4', null, 'Qué construye tu reputación'),
        row('Satisfacción del público', rp.vis), row('Satisfacción de los pilotos', rp.rid), row('Calidad de los circuitos', rp.track), row('Instalaciones', rp.fac),
        statRow('Prestigio por eventos', '+' + Math.round(rp.prestige || 0)), statRow('Penalización (lesiones, basura)', '−' + Math.round(rp.pen || 0)));
      const env = Cat.environments.find(e => e.id === g.world.preset);
      el.append(h('h4', null, 'Estadísticas'), statRow('Terreno', env ? env.name + ' · relieve ' + env.relief + ' de 5' : 'Valle verde · relieve 1 de 5'),
        statRow('Vueltas totales', U.fmtInt(g.totals.laps || g.tracks.reduce((a, t) => a + t.totals.laps, 0))),
        statRow('Caídas · lesiones', g.totals.crashes + ' · ' + g.totals.injuries), statRow('Abonados de temporada', g.passHolders.length),
        statRow('Personal', g.staff.length), statRow('Eventos organizados', g.totals.events), statRow('Patrocinadores', g.sponsors.length));
      const byDisc = {};
      for (const r of g.riders) byDisc[r.disc] = (byDisc[r.disc] || 0) + 1;
      const discs = Cat.trackTypeOrder.filter(k => byDisc[k]);
      if (discs.length > 1 || g.tracks.some(t => t.type !== 'mx')) el.append(statRow('Pilotos por disciplina', discs.length ? discs.map(k => Cat.trackTypes[k].name + ' ' + byDisc[k]).join(' · ') : '-'));
    });
  }
  function parkThoughts(body) {
    const g = game();
    const box = h('div', { class: 'thoughts' });
    body.append(h('p', { class: 'muted small' }, 'Lo que más se comenta últimamente entre el público y los pilotos.'), box);
    return () => keyed(box, Object.keys(g.thoughtStats).map(k => k + Math.round(g.thoughtStats[k].n)).join(','), (el) => {
      const list = Object.entries(g.thoughtStats).sort((a, b) => b[1].n - a[1].n).slice(0, 14);
      if (!list.length) el.append(h('p', { class: 'muted' }, 'Aún no hay opiniones.'));
      for (const [k, s] of list) {
        const def = Cat.thoughts[k];
        el.append(h('div', { class: 'th ' + (def.mood > 0 ? 'good' : def.mood < 0 ? 'bad' : '') }, h('span', { class: 'n' }, Math.round(s.n)), h('span', null, def.t[0])));
      }
    });
  }
  function peopleList(body, which) {
    const g = game();
    const box = h('div', { class: 'people' });
    body.append(box);
    return () => keyed(box, g[which].length + ':' + Math.floor(g.time / 2), (el) => {
      const arr = g[which].filter(a => !a.dead).slice(0, 80);
      if (!arr.length) el.append(h('p', { class: 'muted' }, which === 'riders' ? 'No hay pilotos en este momento.' : 'No hay visitantes en este momento.'));
      for (const a of arr) el.append(h('button', { class: 'person', onclick: () => agentPanel(a) }, portrait(a.cols, which === 'riders' && !a.onFoot ? 'rider' : 'person'),
        h('span', { class: 'grow' }, h('b', null, a.displayName || a.name), h('small', null, which === 'riders' ? (a.disc !== 'mx' ? Cat.trackTypes[a.disc].name + ' · ' : '') + (Cat.brands[a.brand] ? Cat.brands[a.brand].name + ' · ' : '') + MX.Agents.CAT_NAMES[a.cat] + ' · ' + riderStatus(a) : visitorStatus(a))),
        bar(a.satisfaction ? a.satisfaction() : a.happy, 100, (a.satisfaction ? a.satisfaction() : a.happy) > 60 ? 'good' : 'bad')));
    });
  }
  function visitorStatus(v) {
    return ({ arrive: 'Llegando a la taquilla', walk: { food: 'Busca comida', toilet: 'Busca un baño', shop: 'Va a la tienda', seat: 'Busca asiento', view: 'Va a ver las motos', camping: 'Va al camping' }[v.goal] || 'Caminando', inside: 'Usando una instalación', watch: 'Viendo a los pilotos', seat: 'Sentado en la grada', bench: 'Descansando en un banco', wander: 'Paseando', leave: 'Se marcha' })[v.state] || v.state;
  }
  function riderStatus(r) {
    if (r.race) return 'Compitiendo';
    return ({ prep: 'Preparando la moto', toTrack: 'Va a la pista', wait: 'Esperando para entrar', ride: 'Rodando', toPaddock: 'Vuelve al paddock', rest: 'Descansando', foot: { workshop: 'Va al taller', shower: 'Va a la ducha', food: 'Va a comer', school: 'Va a la escuela', wash: 'Va al lavadero', parts: 'Va a la tienda de recambios' }[r.footWhat] || 'Caminando', inside: 'En una instalación', leave: 'Se marcha', carried: 'En el puesto médico', grid: 'En parrilla' })[r.state] || r.state;
  }

  /* ================= Info windows ================= */
  /* the rider on their machine, seen from the right-hand side, in their kit */
  const shots = {};
  function bikeShot(a) {
    const body = a.veh.car ? null : a.veh.sit;
    const key = a.bikeModel + ':' + body + ':' + a.cols.map(c => c.join('.')).join(':') + ':' + (a.disc === 'kids' ? 1 : 0);
    if (shots[key]) return shots[key];
    const mb = new MX.MeshBuilder(16384);
    for (const m of [a.bikeModel, body]) if (m) MX.BuildModels.bakeModel(mb, m, 0, 0, 0, 0, a.cols, 1);
    const mesh = mb.build();
    try { shots[key] = app().renderer.thumbnail(mesh.data, mesh.count, 128, [0, a.veh.car ? 0.7 : 0.82, 0], a.veh.car ? 1.55 : 1.2, [0.3, 0.28, 0.91]); } catch (e) { shots[key] = ''; }
    return shots[key];
  }
  function agentPanel(a) {
    const id = 'agent-' + a.id;
    app().selectedAgent = a;
    WM.open(id, {
      title: a.kind === 'rider' ? 'Piloto' : a.kind === 'staff' ? Cat.staff[a.role].name : 'Visitante', icon: a.kind === 'rider' ? 'rider' : a.kind === 'staff' ? 'staff' : 'visitor', width: 330,
      onClose: () => { if (app().selectedAgent === a) app().selectedAgent = null; },
      build: (body) => {
        const top = h('div', { class: 'agent-top' }, portrait(a.cols, a.kind === 'rider' ? 'rider' : 'person'), h('div', { class: 'grow' }, h('b', { class: 'agent-name' }, a.displayName || a.name), h('small', { class: 'agent-st' }, '')));
        const acts = h('div', { class: 'row gap' },
          h('button', { class: 'btn', onclick: () => app().follow(a) }, icon('follow'), 'Seguir'),
          h('button', { class: 'btn', onclick: () => app().lookAt(a.x, a.z) }, icon('camera'), 'Localizar'),
          a.kind === 'staff' ? h('button', { class: 'btn danger', onclick: () => app().confirm('Despedir a ' + a.name, 'Pagarás una indemnización de ' + U.fmtMoney(Math.round(a.salary * 0.5)) + '.', () => { game().fire(a.id); WM.close(id); }) }, 'Despedir') : null);
        const info = h('div');
        const th = h('div', { class: 'thoughts' });
        const brand = a.kind === 'rider' && Cat.brands[a.brand];
        const shot = a.kind === 'rider' ? h('div', { class: 'bike-shot' }, h('img', { src: bikeShot(a), width: 128, height: 128, alt: a.bikeName }),
          h('div', null, h('small', null, a.veh.car ? 'Buggy' : 'Su moto'), h('b', null, a.bikeName), brand ? h('span', { class: 'brand-tag', style: { background: brand.main, color: brand.main === '#f4f4f4' || brand.main === '#ffd400' || brand.main === '#78d21a' ? '#151515' : '#fff' } }, brand.name) : null)) : null;
        body.append(top, acts, shot, info, h('h4', null, a.kind === 'staff' ? '' : 'Pensamientos'), th);
        return () => {
          if (a.dead) { clear(info); info.append(h('p', { class: 'muted' }, a.kind === 'staff' ? 'Ya no trabaja aquí.' : 'Se ha marchado del complejo.')); return; }
          top.querySelector('.agent-st').textContent = a.kind === 'rider' ? riderStatus(a) : a.kind === 'visitor' ? visitorStatus(a) : staffStatus(a);
          keyed(info, Math.floor(game().time * 2), (el) => {
            if (a.kind === 'visitor') {
              const need = (l, v, inv) => h('div', { class: 'kv' }, h('span', null, l), bar(inv ? 100 - v : v, 100, (inv ? v > 65 : v < 35) ? 'bad' : 'good'));
              el.append(need('Felicidad', a.happy), need('Diversión', a.fun), need('Hambre', a.hunger, true), need('Sed', a.thirst, true), need('Baño', a.bladder, true), need('Energía', a.energy),
                statRow('Dinero', U.fmtMoney(a.money) + ' · gastado ' + U.fmtMoney(a.spent)), statRow('En el parque', Math.round(a.timeIn / C.DAY_SEC * 10) / 10 + ' días'));
            } else if (a.kind === 'rider') {
              const at = a.attr;
              const a2 = (l, v) => h('div', { class: 'kv' }, h('span', null, l), bar(v, 100, 'info'), h('b', null, Math.round(v)));
              el.append(statRow('Disciplina', Cat.trackTypes[a.disc].name + (a.rental ? ' · moto de alquiler' : '')),
                statRow('Categoría', MX.Agents.CAT_NAMES[a.cat] + ' · dorsal #' + a.num + (a.passHolder ? ' · abonado' : '')),
                a2('Técnica', at.skill), a2('Velocidad', at.speed), a2('Resistencia', at.stamina), a2('Salto', at.jump), a2('Agresividad', at.aggr * 100), a2('Experiencia', at.exp), a2('Popularidad', at.pop),
                statRow(a.veh.car ? 'Estado del buggy' : 'Estado de la moto', Math.round(a.bikeCond * 100) + '%'),
                statRow('Vueltas · mejor vuelta', a.stats.laps + ' · ' + (a.stats.best ? U.fmtLap(a.stats.best) : '-')),
                statRow('Saltos limpios · caídas', a.stats.clean + ' · ' + a.stats.crashes),
                a.m ? statRow('Velocidad', U.fmtKmh(a.m.v) + (a.m.air ? ' · en el aire' : '')) : null,
                h('div', { class: 'kv' }, h('span', null, 'Satisfacción'), bar(a.satisfaction(), 100, a.satisfaction() > 60 ? 'good' : 'bad')));
            } else {
              el.append(statRow('Habilidad', ''), stars(a.skill, 5), statRow('Sueldo', U.fmtMoney(a.salary) + '/mes'), statRow('Trabajos hechos', a.worked || 0), statRow('Contratado', game().dateText(a.hired || 0)));
            }
          });
          keyed(th, a.thoughts.map(t => t.text).join('|'), (el) => {
            for (const t of a.thoughts) { const d = Cat.thoughts[t.key]; el.append(h('div', { class: 'th ' + (d && d.mood > 0 ? 'good' : d && d.mood < 0 ? 'bad' : '') }, h('span', null, '«' + t.text + '»'))); }
            if (!a.thoughts.length && a.kind !== 'staff') el.append(h('p', { class: 'muted small' }, 'Nada que contar por ahora.'));
          });
        };
      }
    });
  }
  function buildingPanel(b) {
    const d = Cat.buildings[b.type];
    WM.open('bld-' + b.id, {
      title: d.name, icon: 'build', width: 320,
      build: (body) => {
        const info = h('div');
        body.append(h('div', { class: 'agent-top' }, h('img', { src: MX.Panels1.thumb('b', b.type), width: 72, height: 72, alt: '' }), h('div', { class: 'grow' }, h('b', null, d.name), h('small', null, d.desc))), info,
          h('div', { class: 'row gap' }, h('button', { class: 'btn', onclick: () => app().lookAt(b.cx, b.cz) }, icon('camera'), 'Localizar'),
            h('button', { class: 'btn danger', onclick: () => app().confirm('Demoler ' + d.name, 'Recuperas ' + U.fmtMoney(Math.round(d.cost * 0.4)) + '.', () => { game().removeBuilding(b.id); WM.close('bld-' + b.id); MX.Audio.sfx('demolish'); }) }, icon('demolish'), 'Demoler')));
        return () => {
          const g = game();
          if (!g.buildings.has(b.id)) { clear(info); info.append(h('p', { class: 'muted' }, 'Demolido.')); return; }
          keyed(info, Math.round(b.rev || 0) + ':' + (b.customers || 0) + ':' + Math.round(b.clean) + ':' + Math.floor(g.time), (el) => {
            el.append(statRow('Construido', g.dateText(b.built)), statRow('Mantenimiento', U.fmtMoney(d.upkeep) + '/mes'));
            if (b.revTotal) el.append(statRow('Ingresos totales', U.fmtMoney(b.revTotal)), statRow('Clientes', U.fmtInt(b.customers || 0)));
            if (b.type === 'toilets' || b.type === 'showers') el.append(h('div', { class: 'kv' }, h('span', null, 'Limpieza'), bar(b.clean, 100, b.clean < 40 ? 'bad' : 'good')));
            if (b.seats) el.append(statRow('Asientos ocupados', b.seats.filter(s => s.who).length + ' / ' + b.seats.length));
            if (b.slots) el.append(statRow('Plazas ocupadas', b.slots.filter(s => s.used).length + ' / ' + b.slots.length));
            if (b.type === 'workshop') el.append(statRow('Mecánicos', g.mechanicsAt(b)));
            if (d.staff && !g.staff.some(s => s.role === d.staff)) el.append(h('div', { class: 'callout warn' }, icon('warn'), 'Sin personal: contrata ' + Cat.staff[d.staff].plural.toLowerCase() + '.'));
            if (b.warn) el.append(h('div', { class: 'callout warn' }, icon('warn'), b.warn));
          });
        };
      }
    });
  }
  function testReport(tr) {
    WM.open('test', {
      title: 'Prueba · ' + tr.name, icon: 'rider', width: 380, rebuild: true,
      build: (body) => {
        const st = tr.stats;
        if (!st) { body.append(h('p', null, 'Sin datos.')); return; }
        const td = tr.typeDef;
        body.append(h('p', { class: 'muted small' }, 'Cuatro pilotos de prueba de ' + td.name.toLowerCase() + ', del menos al más rápido, ruedan dos vueltas. Así se comporta el trazado:'));
        const names = ['Principiante', 'Amateur', 'Experto', 'Profesional'];
        const tbl = h('div', { class: 'fin-table' });
        tbl.append(h('div', { class: 'fin-row head' }, h('span', null, 'Nivel'), h('b', null, 'Vuelta'), h('b', null, 'Aire'), h('small', null, 'Saltos')));
        for (const [i, r] of st.runs.entries()) tbl.append(h('div', { class: 'fin-row' }, h('span', null, names[i]), h('b', null, U.fmtLap(r.lap)), h('b', null, U.fmt1(r.air) + ' s'), h('small', null, r.jumps + (r.hard ? ' · ' + r.hard + ' duros' : ''))));
        body.append(tbl, h('div', { class: 'big-stats' },
          h('div', null, h('small', null, 'Dificultad'), h('b', null, U.fmt1(st.diff)), h('em', null, MX.TrackAnalyzer.difficultyLabel(st.diff))),
          h('div', null, h('small', null, 'Valoración'), h('b', null, U.fmt1(st.rating)), h('em', null, '/10')),
          h('div', null, h('small', null, 'Seguridad'), h('b', null, Math.round(st.safety * 100) + '%'), h('em', null, ''))));
        const tips = [];
        if (td.jumps && st.jumps === 0) tips.push('Añade saltos: sin ellos el público se aburre.');
        if (tr.type === 'enduro' && !st.natural) tips.push('Pon troncos, pedreras o vadeos: es lo que buscan los pilotos de enduro. Los árboles alrededor también suman.');
        if (tr.type === 'carcross' && st.rating < 5) tips.push('Una pista ancha con cambios de rasante, un vadeo y curvas de varios radios gusta más a los pilotos de buggy.');
        if (tr.type === 'flat' && st.rating < 5) tips.push('Un óvalo ancho de arcilla con dos curvas largas da las carreras más igualadas.');
        if (st.rating < 5 && (tr.type === 'mx' || tr.type === 'sx' || tr.type === 'kids')) tips.push('Varía los elementos: rítmicos, peraltes, desnivel y algo de decoración suben la valoración.');
        if (st.safety < 0.55) tips.push('Coloca balas de paja o neumáticos junto a los saltos y curvas rápidas.');
        if (st.diff > 7) tips.push('Es un circuito muy exigente: los principiantes evitarán venir.');
        if (st.diff < 2.5) tips.push('Demasiado fácil para los pilotos con nivel.');
        if (st.longest > 130 && tr.type !== 'flat') tips.push('La recta más larga mide ' + Math.round(st.longest) + ' m: rómpela con una curva' + (td.jumps ? ' o un salto.' : '.'));
        for (const t of tips) body.append(h('div', { class: 'callout' }, icon('info'), t));
      }
    });
  }

  /* ================= Options, saves and menus ================= */
  function optionsPanel() {
    WM.open('options', {
      title: 'Opciones', icon: 'gear', width: 380,
      build: (body) => {
        const s = app().settings;
        const tog = (id, label, key, fn) => h('label', { class: 'tog', for: id }, h('input', { id, type: 'checkbox', checked: !!s[key], onchange: (e) => { s[key] = e.target.checked; fn && fn(s[key]); app().saveSettings(); } }), h('span', null, label));
        body.append(
          h('h4', null, 'Sonido'),
          tog('o-sfx', 'Efectos de sonido', 'sfx', (v) => MX.Audio.setSfx(v)),
          slider('o-sfxv', 'Volumen de efectos', 0, 1, 0.05, s.sfxVol, (v) => Math.round(v * 100) + '%', (v) => { s.sfxVol = v; MX.Audio.setVolumes(s); app().saveSettings(); }),
          tog('o-music', 'Música', 'music', (v) => MX.Audio.setMusic(v)),
          slider('o-musv', 'Volumen de la música', 0, 1, 0.05, s.musicVol, (v) => Math.round(v * 100) + '%', (v) => { s.musicVol = v; MX.Audio.setVolumes(s); app().saveSettings(); }),
          h('h4', null, 'Gráficos'),
          h('div', { class: 'row gap wrap' }, ...[[1, 'Nítido'], [2, 'Retro'], [3, 'Píxel grueso']].map(([v, l]) => h('button', { class: 'btn small' + (s.pixelScale === v ? ' on' : ''), onclick: () => { s.pixelScale = v; app().applyGraphics(); app().saveSettings(); WM.rebuild('options'); } }, l))),
          tog('o-shadows', 'Sombras', 'shadows', () => app().applyGraphics()),
          tog('o-outline', 'Contornos', 'outline', () => app().applyGraphics()),
          tog('o-grid', 'Cuadrícula', 'grid', (v) => { app().renderer.grid = v; }),
          tog('o-bubbles', 'Bocadillos de pensamientos', 'bubbles'),
          tog('o-money', 'Mostrar cada venta como dinero flotante', 'floatMoney'),
          tog('o-edge', 'Desplazar la cámara en el borde de la pantalla', 'edgeScroll'),
          h('h4', null, 'Partida'),
          slider('o-auto', 'Autoguardado', 0, 4, 1, s.autosaveWeeks, (v) => v ? 'cada ' + v + ' semana' + (v > 1 ? 's' : '') : 'desactivado', (v) => { s.autosaveWeeks = v; app().saveSettings(); }),
          h('button', { class: 'btn', onclick: () => helpPanel() }, icon('info'), 'Controles y ayuda'));
      }
    });
  }
  function helpPanel() {
    WM.open('help', {
      title: 'Controles y ayuda', icon: 'info', width: 420,
      build: (body) => {
        const rows = [['Mover la cámara', 'Arrastrar con botón derecho · WASD o flechas · en táctil, arrastrar con un dedo'], ['Zoom', 'Rueda del ratón · + / − · pellizcar'], ['Girar la vista', 'Q / E'],
          ['Construir circuitos', 'Intro: construir la pieza · Retroceso: quitar la última · flechas: dirección y pendiente'],
          ['Pausa y velocidad', 'Espacio · teclas 1 a 4'], ['Girar edificio', 'R o clic derecho'], ['Cancelar herramienta', 'Esc o clic derecho'], ['Cuadrícula', 'G'], ['Guardado rápido', 'Ctrl+S']];
        for (const [a, b] of rows) body.append(statRow(a, b));
        body.append(h('h4', null, 'Cómo empezar'), h('ol', { class: 'steps' },
          h('li', null, 'Pulsa Circuitos → Nuevo circuito y coloca la parrilla de salida en tu terreno.'),
          h('li', null, 'Construye pieza a pieza eligiendo dirección y pendiente, mete saltos y la meta desde la pestaña «Especiales» y vuelve hasta la salida para cerrar el circuito.'),
          h('li', null, 'En motocross, supercross y minicross la salida tiene una recta ancha con la valla: elige en el constructor si va a la izquierda, a la derecha o si prefieres no ponerla.'),
          h('li', null, 'Puedes subir el trazado hasta 12 m sobre el terreno. Un tramo a 4,5 m o más por encima de otro pasa sobre él en un puente, y el de abajo cruza por un túnel (del mismo circuito o de otro). Bajo un puente no caben saltos.'),
          h('li', null, 'Construye un paddock y un aparcamiento tocando la carretera, una taquilla, baños y caminos.'),
          h('li', null, 'Valida, prueba y abre el circuito. Llegarán pilotos y espectadores.'),
          h('li', null, 'Contrata personal, ajusta precios, organiza eventos y cumple objetivos.')));
      }
    });
  }
  function savePanel(mode) {
    WM.open('saves', {
      title: mode === 'load' ? 'Cargar partida' : 'Guardar y cargar', icon: 'save', width: 440, rebuild: true,
      build: (body) => {
        const S = MX.Save;
        const list = h('div', { class: 'slots' });
        const fill = () => {
          clear(list);
          for (const slot of S.SLOTS) {
            const meta = S.meta(slot);
            const canSave = mode !== 'load' && slot !== 'auto' && app().game && !app().demo && !app().game.visit;
            list.append(h('div', { class: 'slot' },
              h('div', { class: 'grow' }, h('b', null, slot === 'auto' ? 'Autoguardado' : 'Ranura ' + slot), meta ? h('small', null, meta.park + ' · ' + meta.date + ' · ' + U.fmtMoney(meta.money) + ' · ' + new Date(meta.ts).toLocaleString('es-ES')) : h('small', { class: 'muted' }, 'Vacía')),
              canSave ? h('button', { class: 'btn', onclick: async () => { const r = await S.save(slot, app().game); app().hud && app().hud.toast(r.ok ? 'Partida guardada' : r.reason, r.ok ? 'good' : 'bad'); fill(); } }, 'Guardar') : null,
              meta ? h('button', { class: 'btn primary', onclick: async () => { const r = await app().loadSlot(slot); if (!r.ok) app().toastAny(r.reason, 'bad'); else WM.close('saves'); } }, 'Cargar') : null,
              meta && slot !== 'auto' ? h('button', { class: 'mini danger', title: 'Borrar', onclick: () => app().confirm('Borrar partida', '¿Borrar la ranura ' + slot + '?', () => { S.remove(slot); fill(); }) }, icon('close')) : null));
          }
        };
        fill();
        const ta = h('textarea', { id: 'save-code', class: 'inp code', rows: 3, placeholder: 'Pega aquí un código de partida para importarla', 'aria-label': 'Código de partida' });
        const file = h('input', { id: 'save-file', type: 'file', accept: '.json,.txt,application/json,text/plain', onchange: async (e) => { const f = e.target.files[0]; if (f) { ta.value = await f.text(); } } });
        if (app().game && app().game.visit && !app().demo) body.append(h('div', { class: 'callout' }, icon('info'), 'Estás visitando el circuito de otro jugador: aquí no se puede guardar.'));
        body.append(list, MX.OnlineUI.cloudSection(mode), h('h4', null, 'Copia de seguridad'),
          h('p', { class: 'muted small' }, 'Las partidas se guardan en este navegador. Exporta un código para conservarlas en otro sitio.'),
          h('div', { class: 'row gap wrap' },
            app().game && !app().demo ? h('button', { class: 'btn', onclick: async () => { const code = await S.exportCode(app().game); ta.value = code; ta.select(); try { await navigator.clipboard.writeText(code); app().toastAny('Código copiado al portapapeles', 'good'); } catch (err) { app().toastAny('Selecciona el texto y cópialo', 'info'); } } }, icon('save'), 'Exportar código') : null,
            h('button', { class: 'btn primary', onclick: async () => { const r = await app().importCode(ta.value); if (!r.ok) app().toastAny(r.reason, 'bad'); else WM.close('saves'); } }, 'Importar código'),
            h('label', { class: 'btn', for: 'save-file' }, 'Abrir archivo…'), file), ta);
      }
    });
  }
  function menuPanel() {
    WM.open('menu', {
      title: 'Menú', icon: 'menu', width: 300, cls: 'menu-win',
      build: (body) => {
        const b = (ic, label, fn) => h('button', { class: 'btn block', onclick: () => { WM.close('menu'); fn(); } }, icon(ic), label);
        body.append(
          b('play', 'Continuar', () => {}),
          b('save', 'Guardar o cargar', () => savePanel()),
          MX.Online && MX.Online.enabled ? b('trophy', 'Ranking de circuitos', () => MX.OnlineUI.rankingPanel()) : null,
          MX.Online && MX.Online.enabled ? b('user', MX.Online.user ? 'Cuenta: ' + (MX.Online.nick || 'sin apodo') : 'Entrar con Google', () => (MX.Online.user ? MX.OnlineUI.nickDialog(!MX.Online.nick) : MX.OnlineUI.signIn())) : null,
          b('gear', 'Opciones', () => optionsPanel()),
          b('info', 'Controles y ayuda', () => helpPanel()),
          b('objectives', 'Ver tutorial de nuevo', () => app().tutorial && app().tutorial.start(true)),
          b('close', 'Salir al menú principal', () => app().confirm('Salir al menú principal', 'Se guardará automáticamente la partida.', () => app().toTitle())));
      }
    });
  }
  function decisionPanel(d) {
    WM.open('dlg-' + d.id, {
      title: d.title, icon: 'warn', width: 360, cls: 'dlg',
      build: (body) => {
        body.append(h('p', null, d.text));
        const row = h('div', { class: 'row gap wrap' });
        d.options.forEach((o, i) => row.append(h('button', { class: 'btn' + (i === 0 ? ' primary' : ''), onclick: () => { game().amb.decide(d.id, o.key); WM.close('dlg-' + d.id); MX.Audio.sfx('click'); } }, o.label)));
        body.append(row, h('small', { class: 'muted' }, 'Si no decides en unos días, se aplicará la última opción.'));
      }
    });
  }

  MX.Panels2 = { staffPanel, financePanel, eventsPanel, racePanel, resultsPanel, researchPanel, objectivesPanel, parkPanel, agentPanel, buildingPanel, testReport, optionsPanel, helpPanel, savePanel, menuPanel, decisionPanel, riderStatus, visitorStatus };
})(window.MX);
