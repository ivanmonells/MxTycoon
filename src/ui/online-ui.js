/* MX Tycoon - online interface: account bar on the title screen, nickname dialog,
   cloud slots in the save window, publishing a circuit, the ranking of circuits and
   the bar shown while visiting someone else's park. Everything here stays hidden
   when MX.Online is not enabled. */
(function (MX) {
  'use strict';
  const { h, icon, clear } = MX.DOM;
  const U = MX.U, Cat = MX.Catalog;
  const WM = MX.WM;
  const app = () => MX.App;
  const O = () => MX.Online;
  const toast = (msg, kind) => { const a = app(); if (a.hud) a.hud.toast(msg, kind); };

  /* ---------------- account ---------------- */
  async function signIn() {
    const r = await O().signIn();
    if (!r.ok) { if (!r.cancelled) app().modal('No se pudo iniciar sesión', [h('p', null, r.reason)], [{ label: 'Vale' }]); return false; }
    if (r.redirect) return false;
    await waitProfile();
    if (!O().nick) await nickDialog(true);
    return true;
  }
  function waitProfile() {
    return new Promise((res) => { const t0 = Date.now(); const k = () => (O().profileLoaded || !O().user || Date.now() - t0 > 6000) ? res() : setTimeout(k, 60); k(); });
  }
  /* choose or change the nickname; resolves once the dialog closes */
  function nickDialog(first) {
    return new Promise((resolve) => {
      const on = O();
      const inp = h('input', { id: 'nick-in', class: 'inp', value: on.nick || on.suggestNick(), maxlength: 16, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Apodo' });
      const err = h('small', { class: 'nick-err' });
      const go = h('button', { class: 'btn primary', onclick: async () => {
        const bad = on.checkNick(inp.value);
        if (bad) { err.textContent = bad; return; }
        go.disabled = true; err.textContent = 'Comprobando…';
        const r = await on.claimNick(inp.value);
        go.disabled = false;
        if (!r.ok) { err.textContent = r.reason; return; }
        app()._modalClose && app()._modalClose();
        toast('Tu apodo es ' + on.nick, 'good');
        resolve(true);
      } }, 'Guardar apodo');
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
      inp.addEventListener('input', () => { err.textContent = on.checkNick(inp.value) || ''; });
      app().modal(first ? 'Elige tu apodo' : 'Cambiar apodo', [
        h('p', null, first ? 'Es el nombre con el que te verán los demás en el ranking de circuitos.' : 'Tus circuitos publicados pasarán a mostrar el nuevo apodo.'),
        h('label', { for: 'nick-in' }, 'Apodo (3 a 16 letras, números, guion o guion bajo)'), inp, err,
        h('div', { class: 'row gap' }, go)
      ], [{ label: first ? 'Más tarde' : 'Cancelar', fn: () => resolve(false) }]);
      setTimeout(() => { inp.focus(); inp.select(); }, 40);
    });
  }
  /* account bar for the title screen (re-rendered when the session changes) */
  function accountBar() {
    const el = h('div', { class: 'title-account' });
    const draw = () => {
      if (!el.isConnected && el._drawn) { off(); return; }
      el._drawn = true;
      clear(el);
      const on = O();
      if (on.state === 'loading' || (on.state === 'off')) { el.append(h('small', { class: 'muted' }, 'Conectando con el servidor…')); return; }
      if (on.state === 'error') { el.append(h('small', { class: 'muted' }, 'Modo online no disponible ahora mismo. Puedes jugar sin conexión.')); return; }
      if (!on.user) {
        el.append(h('button', { class: 'btn google', onclick: () => signIn() }, icon('google'), 'Entrar con Google'),
          h('small', { class: 'muted' }, 'Guarda tus partidas en la nube, elige tu apodo y publica tus circuitos.'));
        return;
      }
      el.append(h('span', { class: 'acc-user' }, icon('user'), h('b', null, on.nick || 'Sin apodo')),
        h('button', { class: 'btn small', onclick: () => nickDialog(!on.nick) }, on.nick ? 'Cambiar apodo' : 'Elegir apodo'),
        h('button', { class: 'btn small', onclick: () => app().confirm('Cerrar sesión', 'Tus partidas en la nube seguirán guardadas.', () => on.signOut()) }, 'Salir'));
    };
    const off = O().on(draw);
    draw();
    O().init();
    return el;
  }
  /* the «Continuar» button picks the newest save, local or in the cloud */
  async function patchContinue(btn, local) {
    const on = O();
    if (!on.enabled) return;
    await on.init();
    const apply = async () => {
      if (!btn.isConnected || !on.user) return;
      let saves = [];
      try { saves = await on.listSaves(); } catch (e) { return; }
      const best = saves.sort((a, b) => b.ts - a.ts)[0];
      if (!best || (local && local.ts >= best.ts) || !btn.isConnected) return;
      btn.disabled = false;
      const small = btn.querySelector('small');
      if (small) small.textContent = best.park + ' · ' + best.date + ' (nube)';
      btn.onclick = async (e) => { e.stopImmediatePropagation(); await loadCloud(best.slot); };
    };
    apply();
    const off = on.on(() => { if (!btn.isConnected) { off(); return; } apply(); });
  }
  async function loadCloud(slot) {
    const r = await O().loadGame(slot);
    if (!r.ok) { app().modal('No se pudo cargar', [h('p', null, r.reason)], [{ label: 'Vale' }]); return r; }
    const l = app().loadData(r.data);
    if (l.ok) WM.close('saves');
    return l;
  }

  /* ---------------- cloud slots in the save window ---------------- */
  function cloudSection(mode) {
    const on = O();
    const box = h('div', { class: 'cloud' });
    if (!on.enabled) return null;
    const draw = async () => {
      clear(box);
      box.append(h('h4', null, icon('globe'), ' En la nube'));
      await on.init();
      if (!on.ready) { box.append(h('p', { class: 'muted small' }, on.error || 'Conectando…')); return; }
      if (!on.user) {
        box.append(h('p', { class: 'muted small' }, 'Inicia sesión para guardar tus partidas en tu cuenta y seguir en cualquier dispositivo.'),
          h('button', { class: 'btn google', onclick: async () => { if (await signIn()) draw(); } }, icon('google'), 'Entrar con Google'));
        return;
      }
      const list = h('div', { class: 'slots' }, h('p', { class: 'muted small' }, 'Cargando…'));
      box.append(list);
      let saves = [];
      try { saves = await on.listSaves(); } catch (e) { clear(list); list.append(h('p', { class: 'muted small' }, 'No se pudieron leer tus partidas.')); return; }
      clear(list);
      const g = app().game, canSave = mode !== 'load' && g && !app().demo && !g.visit;
      for (const slot of on.SLOTS) {
        const m = saves.find(s => s.slot === slot);
        list.append(h('div', { class: 'slot' },
          h('div', { class: 'grow' }, h('b', null, slot === 'auto' ? 'Autoguardado en la nube' : 'Nube ' + slot),
            m ? h('small', null, m.park + ' · ' + m.date + ' · ' + U.fmtMoney(m.money) + ' · ' + new Date(m.ts).toLocaleString('es-ES')) : h('small', { class: 'muted' }, 'Vacía')),
          canSave && slot !== 'auto' ? h('button', { class: 'btn', onclick: async (e) => { e.currentTarget.disabled = true; const r = await on.saveGame(slot, g); toast(r.ok ? 'Guardada en la nube' : r.reason, r.ok ? 'good' : 'bad'); draw(); } }, 'Guardar') : null,
          m ? h('button', { class: 'btn primary', onclick: () => loadCloud(slot) }, 'Cargar') : null,
          m && slot !== 'auto' ? h('button', { class: 'mini danger', title: 'Borrar', onclick: () => app().confirm('Borrar partida en la nube', '¿Borrar la ranura ' + slot + ' de tu cuenta?', async () => { await on.deleteSave(slot); draw(); }) }, icon('close')) : null));
      }
    };
    draw();
    return box;
  }

  /* ---------------- publishing ---------------- */
  async function publishTrack(tr) {
    const on = O(), g = app().game;
    if (!on.user && !(await signIn())) return;
    if (!on.nick && !(await nickDialog(true))) return;
    toast('Publicando ' + tr.name + '…', 'info');
    const r = await on.publish(g, tr);
    if (!r.ok) { toast(r.reason, 'bad'); return; }
    MX.Audio.sfx('success');
    toast(r.updated ? 'Circuito actualizado en el ranking' : '¡Circuito publicado en el ranking!', 'good');
    WM.rebuild('tracks');
  }
  function publishButton(tr) {
    const on = O();
    if (!on.enabled || app().game.visit) return null;
    const ok = tr.closed && tr.stats;
    return h('button', { class: 'btn', disabled: !ok, title: ok ? 'Comparte este circuito con todos los jugadores' : 'Prueba o abre el circuito para poder publicarlo', onclick: () => publishTrack(tr) }, icon('trophy'), 'Publicar en el ranking');
  }

  /* ---------------- ranking ---------------- */
  function drawShape(c, e) {
    const ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.fillStyle = '#211c18'; ctx.fillRect(0, 0, W, H);
    const p = e.pts || [];
    if (p.length < 6) return;
    /* the same isometric turn as the game camera */
    const pts = [];
    for (let i = 0; i < p.length; i += 2) pts.push([p[i] - p[i + 1], (p[i] + p[i + 1]) * 0.5]);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const k = Math.min((W - 10) / Math.max(1, x1 - x0), (H - 10) / Math.max(1, y1 - y0));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    const td = Cat.trackTypes[e.type] || Cat.trackTypes.mx;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, col] of [[6, '#0e0b09'], [3.5, td.color]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      pts.forEach(([x, y], i) => { const X = ox + (x - x0) * k, Y = oy + (y - y0) * k; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      ctx.closePath(); ctx.stroke();
    }
  }
  function rankingPanel() {
    const st = { order: 'best', type: null, mine: false };
    WM.open('ranking', {
      title: 'Ranking de circuitos', icon: 'trophy', width: 520, cls: 'rank-win',
      build: (body) => {
        const on = O();
        const head = h('div', { class: 'rk-head' });
        const filt = h('div', { class: 'rk-filter' });
        const list = h('div', { class: 'rk-list' });
        const acct = h('div', { class: 'rk-acct' });
        body.append(acct, head, filt, list);
        const drawAcct = () => {
          clear(acct);
          if (!on.user) acct.append(h('small', { class: 'muted' }, 'Puedes ver y visitar los circuitos sin cuenta. Para votar y publicar los tuyos:'), h('button', { class: 'btn small google', onclick: async () => { if (await signIn()) { drawAcct(); load(); } } }, icon('google'), 'Entrar con Google'));
          else acct.append(h('small', { class: 'muted' }, 'Conectado como ', h('b', null, on.nick || 'sin apodo'), '. Publica un circuito desde su ventana con «Publicar en el ranking».'));
        };
        const tabs = [['best', 'Mejores'], ['visits', 'Más visitados'], ['recent', 'Recientes'], ['mine', 'Mis circuitos']];
        for (const [k, l] of tabs) head.append(h('button', { class: 'btn small' + ((k === 'mine' ? st.mine : !st.mine && st.order === k) ? ' on' : ''), onclick: (e) => {
          if (k === 'mine') { if (!on.user) { toast('Inicia sesión para ver tus circuitos', 'info'); return; } st.mine = true; } else { st.mine = false; st.order = k; }
          for (const b of head.children) b.classList.remove('on'); e.currentTarget.classList.add('on'); load();
        } }, l));
        const types = [[null, 'Todos']].concat(Cat.trackTypeOrder.map(t => [t, Cat.trackTypes[t].name]));
        for (const [t, l] of types) filt.append(h('button', { class: 'chip-btn' + (st.type === t ? ' on' : ''), title: l, onclick: (e) => { st.type = t; for (const b of filt.children) b.classList.remove('on'); e.currentTarget.classList.add('on'); load(); } },
          t ? h('span', { class: 'type-tag', style: { background: Cat.trackTypes[t].color } }, Cat.trackTypes[t].short) : null, t ? null : l));
        let seq = 0;
        const load = async () => {
          const my = ++seq;
          clear(list); list.append(h('p', { class: 'muted' }, 'Cargando el ranking…'));
          const r = await on.top({ order: st.order, type: st.type, mine: st.mine, limit: 40 });
          if (my !== seq || !list.isConnected) return;
          clear(list);
          if (!r.ok) { list.append(h('div', { class: 'callout warn' }, icon('warn'), r.reason)); return; }
          let rows = r.list;
          if (st.mine && st.type) rows = rows.filter(e => e.type === st.type);
          if (!rows.length) { list.append(h('p', { class: 'muted' }, st.mine ? 'Todavía no has publicado ningún circuito.' : 'Aún no hay circuitos publicados aquí. ¡Sé el primero!')); return; }
          rows.forEach((e, i) => list.append(row(e, i, load)));
        };
        drawAcct(); load();
      }
    });
  }
  function row(e, i, reload) {
    const on = O(), td = Cat.trackTypes[e.type] || Cat.trackTypes.mx, mine = on.user && on.user.uid === e.uid;
    const c = h('canvas', { class: 'rk-shape', width: 84, height: 60 });
    drawShape(c, e);
    const rating = (e.r10 / 10).toFixed(1).replace('.', ',');
    return h('div', { class: 'rk-row' + (mine ? ' mine' : '') },
      h('span', { class: 'rk-pos' + (i < 3 ? ' top' : '') }, (i + 1) + 'º'), c,
      h('div', { class: 'grow rk-info' },
        h('div', { class: 'rk-name' }, h('span', { class: 'type-tag', style: { background: td.color }, title: td.name }, td.short), h('b', null, e.track)),
        h('small', null, e.park + ' · de ', h('b', null, e.nick)),
        h('small', { class: 'rk-stats' }, U.fmtInt(e.len) + ' m · valoración ' + rating + ' · ', icon('heart', 'rk-ic'), ' ' + U.fmtInt(e.likes || 0) + ' · ' + U.fmtInt(e.visits || 0) + ' visitas')),
      h('div', { class: 'rk-acts' },
        h('button', { class: 'btn primary small', onclick: () => app().visitCircuit(e.id) }, 'Visitar'),
        mine ? h('button', { class: 'btn small danger', onclick: () => app().confirm('Retirar del ranking', 'Se quitará «' + e.track + '» del ranking con sus votos y visitas.', async () => { const r = await on.unpublish(e.id); toast(r.ok ? 'Circuito retirado' : r.reason, r.ok ? 'info' : 'bad'); reload(); }) }, 'Retirar') : null));
  }

  /* ---------------- visiting a park ---------------- */
  let bar = null;
  function visitBar(g) {
    if (bar) { bar.remove(); bar = null; }
    if (!g || !g.visit) return;
    const e = g.visit.entry, on = O(), mine = on.user && on.user.uid === e.uid;
    const likeBtn = h('button', { class: 'btn small like', disabled: !!mine, title: mine ? 'Es tu circuito' : 'Me gusta' }, icon('heart'), h('span', null, U.fmtInt(e.likes || 0)));
    let liked = false;
    const paint = () => { likeBtn.classList.toggle('on', liked); likeBtn.lastChild.textContent = U.fmtInt(e.likes || 0); };
    likeBtn.onclick = async () => {
      if (!on.user && !(await signIn())) return;
      likeBtn.disabled = true;
      const r = await on.setLike(e.id, !liked);
      likeBtn.disabled = false;
      if (!r.ok) { toast(r.reason, 'bad'); return; }
      liked = r.on; e.likes = r.likes; paint();
      if (liked) MX.Audio.sfx('cash');
    };
    if (on.user && !mine) on.liked(e.id).then(v => { liked = v; paint(); });
    bar = h('div', { class: 'visit-bar' },
      h('span', { class: 'type-tag', style: { background: (Cat.trackTypes[e.type] || Cat.trackTypes.mx).color } }, (Cat.trackTypes[e.type] || Cat.trackTypes.mx).short),
      h('span', { class: 'vb-txt' }, h('small', null, 'Visitando'), h('b', null, e.track + ' · de ' + e.nick)),
      likeBtn,
      h('button', { class: 'btn small', title: 'Ver el circuito', onclick: () => focusTrack(g) }, icon('camera')),
      h('button', { class: 'btn small', onclick: () => rankingPanel() }, icon('trophy'), h('span', { class: 'vb-l' }, 'Ranking')),
      h('button', { class: 'btn small danger', onclick: () => app().toTitle() }, 'Salir'));
    app().uiRoot.appendChild(bar);
    paint();
  }
  function focusTrack(g) {
    const e = g.visit && g.visit.entry, tr = e && (g.tracks.find(t => t.slot === e.slot) || g.tracks[0]);
    if (!tr || !tr.S) return;
    let x = 0, z = 0;
    for (let i = 0; i < tr.S.n; i++) { x += tr.S.x[i]; z += tr.S.z[i]; }
    x /= tr.S.n; z /= tr.S.n;
    const cam = app().renderer.cam;
    cam.follow = null; cam.tx = x; cam.tz = z; cam.ty = g.world.heightAt(x, z); cam.targetZoom = Math.max(4.5, Math.min(9, 520 / Math.max(120, tr.length) * 4));
  }

  MX.OnlineUI = { accountBar, nickDialog, signIn, patchContinue, cloudSection, publishButton, publishTrack, rankingPanel, visitBar, focusTrack, drawShape };
})(window.MX);
