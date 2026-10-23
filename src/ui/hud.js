/* MX Tycoon - HUD: top bar, toolbar, notifications, objective tracker, tool hint,
   minimap, toasts, floating money and in-world labels/thought bubbles. */
(function (MX) {
  'use strict';
  const { h, icon, clear } = MX.DOM;
  const U = MX.U, C = MX.C, Cat = MX.Catalog;
  const T = C.TILE;

  class HUD {
    constructor(app, root) {
      this.app = app; this.root = root;
      this.floats = [];
      this.toasts = [];
      this.build();
      MX.Bus.on('notify', (n) => this.addNote(n));
      MX.Bus.on('money', (d) => this.floatMoney(d));
    }
    get game() { return this.app.game; }
    build() {
      const app = this.app;
      /* top bar */
      this.top = h('div', { id: 'topbar' });
      this.parkEl = h('div', { class: 'tb-park' }, h('span', { class: 'tb-logo' }, 'MX'), h('span', { class: 'tb-name' }, ''));
      this.moneyEl = h('div', { class: 'tb-stat tb-money', title: 'Dinero · clic: finanzas', onclick: () => app.panels.finance() }, icon('money'), h('b', null, '0 €'));
      this.dateEl = h('div', { class: 'tb-stat', title: 'Fecha' }, icon('calendar'), h('b', null, ''));
      this.repEl = h('div', { class: 'tb-stat tb-rep', title: 'Reputación · clic: parque', onclick: () => app.panels.park() }, icon('star'), h('b', null, ''), h('small', null, ''));
      this.visEl = h('div', { class: 'tb-stat', title: 'Visitantes en el parque', onclick: () => app.panels.park('people') }, icon('visitor'), h('b', null, '0'));
      this.ridEl = h('div', { class: 'tb-stat', title: 'Pilotos en el complejo', onclick: () => app.panels.park('riders') }, icon('rider'), h('b', null, '0'));
      this.wxEl = h('div', { class: 'tb-stat tb-wx', title: 'Tiempo' }, icon('sun'), h('b', null, ''));
      this.speedEl = h('div', { class: 'tb-speed', role: 'group', 'aria-label': 'Velocidad' });
      const speeds = [[0, 'pause', 'Pausa (Espacio)'], [1, 'play', 'Normal (1)'], [2, 'fast', 'Rápido (2)'], [4, 'faster', 'Muy rápido (3)'], [8, 'turbo', 'Turbo (4)']];
      this.speedBtns = speeds.map(([v, ic, t]) => {
        const b = h('button', { class: 'sp', title: t, 'aria-label': t, onclick: () => app.setSpeed(v) }, icon(ic));
        b.dataset.v = v;
        this.speedEl.appendChild(b);
        return b;
      });
      this.soundBtn = h('button', { class: 'tb-btn', title: 'Sonido', onclick: () => app.toggleSound() }, icon('sound'));
      this.rotBtn = h('button', { class: 'tb-btn', title: 'Girar cámara (Q / E)', onclick: () => { app.renderer.cam.yawIndex = (app.renderer.cam.yawIndex + 1) % 4; } }, icon('rotate'));
      this.menuBtn = h('button', { class: 'tb-btn', title: 'Menú (Esc)', onclick: () => this.menu() }, icon('menu'));
      this.top.append(this.parkEl, h('div', { class: 'tb-stats' }, this.moneyEl, this.dateEl, this.repEl, this.visEl, this.ridEl, this.wxEl), this.speedEl, h('div', { class: 'tb-right' }, this.rotBtn, this.soundBtn, this.menuBtn));
      /* toolbar */
      this.bar = h('div', { id: 'toolbar', role: 'toolbar' });
      const groups = [
        [['track', 'Circuitos', () => app.panels.tracks(), 'tracks'], ['terrain', 'Terreno', () => app.panels.terrain(), 'terrain'], ['build', 'Construir', () => app.panels.build(), 'build'], ['path', 'Caminos', () => app.panels.paths(), 'paths'], ['decor', 'Decorar', () => app.panels.decor(), 'decor'], ['demolish', 'Demoler', () => MX.Tools.set(MX.Tools.list.Demolish), 'demolish']],
        [['staff', 'Personal', () => app.panels.staff(), 'staff'], ['finance', 'Finanzas', () => app.panels.finance(), 'finance'], ['events', 'Eventos', () => app.panels.events(), 'events'], ['research', 'Investigar', () => app.panels.research(), 'research'], ['objectives', 'Objetivos', () => app.panels.objectives(), 'objectives'], ['park', 'Parque', () => app.panels.park(), 'park']]
      ];
      this.toolBtns = {};
      groups.forEach((g, gi) => {
        const grp = h('div', { class: 'tg' });
        for (const [ic, label, fn, id] of g) {
          const b = h('button', { class: 'tbtn', title: label, onclick: () => { MX.Audio && MX.Audio.sfx('click'); fn(); } }, icon(ic), h('span', null, label));
          b.dataset.id = id;
          this.toolBtns[id] = b;
          grp.appendChild(b);
        }
        this.bar.appendChild(grp);
        if (gi === 0) this.bar.appendChild(h('div', { class: 'tsep' }));
      });
      /* other HUD parts */
      this.objEl = h('div', { id: 'objtracker', onclick: () => app.panels.objectives() });
      this.notesEl = h('div', { id: 'notes', 'aria-live': 'polite' });
      this.hintEl = h('div', { id: 'toolhint' });
      this.toastEl = h('div', { id: 'toasts' });
      this.raceEl = h('div', { id: 'racebar', hidden: true });
      this.mini = h('canvas', { id: 'minimap', width: 168, height: 168, title: 'Minimapa · clic para ir' });
      this.miniWrap = h('div', { id: 'minimap-wrap' }, this.mini, h('div', { class: 'mm-btns' },
        h('button', { title: 'Acercar', onclick: () => app.input.zoomAt(innerWidth / 2, innerHeight / 2, 1.3) }, '+'),
        h('button', { title: 'Alejar', onclick: () => app.input.zoomAt(innerWidth / 2, innerHeight / 2, 0.77) }, '−'),
        h('button', { title: 'Cuadrícula (G)', onclick: () => { app.settings.grid = !app.settings.grid; app.renderer.grid = app.settings.grid; app.saveSettings(); } }, icon('grid'))
      ));
      this.mini.addEventListener('pointerdown', (e) => this.miniClick(e));
      this.mini.addEventListener('pointermove', (e) => { if (e.buttons) this.miniClick(e); });
      this.overlay = h('canvas', { id: 'overlay' });
      this.root.append(this.overlay, this.top, this.objEl, this.raceEl, this.notesEl, this.hintEl, this.toastEl, this.miniWrap, this.bar);
      this.octx = this.overlay.getContext('2d');
    }
    setVisible(v) { this.root.classList.toggle('hud-hidden', !v); }
    setHint(t) { this.hintEl.textContent = t || ''; this.hintEl.classList.toggle('show', !!t); }
    toast(msg, kind) {
      const el = h('div', { class: 'toast toast-' + (kind || 'info') }, msg);
      this.toastEl.appendChild(el);
      setTimeout(() => el.classList.add('out'), 2200);
      setTimeout(() => el.remove(), 2700);
      while (this.toastEl.children.length > 3) this.toastEl.firstChild.remove();
    }
    addNote(n) {
      if (this.app.demo) return;
      const kindIcon = { info: 'info', warn: 'warn', danger: 'warn', success: 'check', money: 'money', event: 'events', weather: n.text.includes('lluv') ? 'rain' : 'cloud' }[n.kind] || 'info';
      const el = h('div', { class: 'note note-' + n.kind },
        icon(kindIcon), h('span', { class: 'note-t' }, n.text),
        (n.x != null || n.agentId) ? h('button', { class: 'note-go', title: 'Ver', onclick: (e) => { e.stopPropagation(); this.app.locate(n); } }, icon('follow')) : null);
      el.addEventListener('click', () => el.remove());
      this.notesEl.prepend(el);
      setTimeout(() => el.classList.add('fade'), 9000);
      setTimeout(() => el.remove(), 9800);
      while (this.notesEl.children.length > 4) this.notesEl.lastChild.remove();
      if (MX.Audio) MX.Audio.sfx(n.kind === 'danger' ? 'alert' : n.kind === 'success' ? 'success' : 'notify');
    }
    floatMoney(d) {
      if (this.app.demo) return;
      if (!this.app.settings.floatMoney && d.small) return;
      this.floats.push({ x: d.x, z: d.z, y: null, amount: d.amount, t: 0, small: d.small });
      if (this.floats.length > 40) this.floats.shift();
      if (d.amount > 0 && !d.small && MX.Audio) MX.Audio.sfx('cash');
    }
    menu() { this.app.panels.menu(); }

    update(dt) {
      const g = this.game;
      if (!g) return;
      const money = g.econ.money;
      this.moneyEl.querySelector('b').textContent = U.fmtMoney(money);
      this.moneyEl.classList.toggle('neg', money < 0);
      this.dateEl.querySelector('b').textContent = g.dateText();
      this.repEl.querySelector('b').textContent = Math.round(g.rep);
      this.repEl.querySelector('small').textContent = g.repLabel();
      this.visEl.querySelector('b').textContent = g.visitors.length;
      this.ridEl.querySelector('b').textContent = g.riders.filter(r => !r.dead).length;
      const wd = g.weatherDef();
      const wic = this.wxEl.querySelector('.px-icon');
      const wn = wd.icon === 'sun' ? 'sun' : wd.icon;
      if (this._wx !== wn) { this._wx = wn; wic.style.backgroundImage = 'url(' + MX.DOM.iconURL(wn, 3) + ')'; }
      this.wxEl.querySelector('b').textContent = wd.name;
      this.parkEl.querySelector('.tb-name').textContent = g.parkName;
      for (const b of this.speedBtns) b.classList.toggle('on', +b.dataset.v === g.speed);
      const snd = MX.Audio && MX.Audio.enabled;
      const sic = this.soundBtn.querySelector('.px-icon');
      const sn = snd ? 'sound' : 'mute';
      if (this._snd !== sn) { this._snd = sn; sic.style.backgroundImage = 'url(' + MX.DOM.iconURL(sn, 3) + ')'; }
      /* toolbar highlight */
      const tname = MX.Tools.current ? MX.Tools.current.name : '';
      const map = { trackstart: 'tracks', trackbuild: 'tracks', trackdraw: 'tracks', trackedit: 'tracks', trackfeature: 'tracks', tracksurface: 'tracks', trackwidth: 'tracks', trackelev: 'tracks', build: 'build', path: 'paths', addon: 'paths', decor: 'decor', demolish: 'demolish', terrain: 'terrain', paint: 'terrain', land: 'terrain' };
      for (const id in this.toolBtns) this.toolBtns[id].classList.toggle('on', map[tname] === id || MX.WM.isOpen(id));
      this.updateObjective();
      this.updateRaceBar();
      this.miniT = (this.miniT || 0) - dt;
      if (this.miniT <= 0) { this.drawMinimap(); this.miniT = 0.5; }
    }
    updateObjective() {
      const g = this.game;
      if (g.mode === 'sandbox') { this.objEl.hidden = true; return; }
      const o = g.prog.objective;
      this.objEl.hidden = false;
      const key = (o ? o.id : 'done') + ':' + g.prog.progress().map(p => p.v).join(',');
      if (this._objKey === key) return;
      this._objKey = key;
      clear(this.objEl);
      if (!o) { this.objEl.append(h('div', { class: 'ot-h' }, icon('trophy'), '¡Carrera completada!'), h('div', { class: 'ot-d' }, 'Eres una leyenda del motocross. Sigue ampliando tu imperio.')); return; }
      this.objEl.append(h('div', { class: 'ot-h' }, icon('objectives'), h('span', null, 'Objetivo ' + (g.prog.objIndex + 1) + ': ' + o.name)));
      for (const p of g.prog.progress()) {
        const v = p.money ? U.fmtMoney(p.v) : U.fmtInt(p.v), t = p.money ? U.fmtMoney(p.t) : U.fmtInt(p.t);
        this.objEl.append(h('div', { class: 'ot-row' }, h('span', null, p.label), h('b', null, v + ' / ' + t)), MX.DOM.bar(p.v, p.t, p.v >= p.t ? 'good' : ''));
      }
    }
    updateRaceBar() {
      const g = this.game, race = g.race;
      if (!race) { if (!this.raceEl.hidden) this.raceEl.hidden = true; return; }
      this.raceEl.hidden = false;
      const order = race.order.length ? race.order : race.riders;
      const lead = order[0];
      let txt;
      if (race.phase === 'gather') txt = 'Llegada del público · ' + race.def.name;
      else if (race.phase === 'grid') txt = 'Parrilla · salida en ' + Math.max(0, Math.ceil(9 - race.t)) + ' s';
      else if (race.phase === 'race') txt = 'Vuelta ' + Math.min(race.laps, (lead && lead.lapsDone != null ? lead.lapsDone + 1 : 1)) + '/' + race.laps + ' · Líder: ' + (lead ? '#' + lead.num + ' ' + lead.name : '');
      else txt = '¡Bandera a cuadros! ' + (race.finishOrder[0] ? race.finishOrder[0].name + ' gana' : '');
      if (this._raceTxt !== txt) {
        this._raceTxt = txt;
        clear(this.raceEl);
        this.raceEl.append(icon('events'), h('span', null, txt), h('button', { onclick: () => this.app.panels.race() }, 'Clasificación'));
      }
    }
    miniClick(e) {
      const g = this.game;
      if (!g) return;
      const r = this.mini.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const S = g.world.N * T;
      const cam = this.app.renderer.cam;
      cam.tx = px * S; cam.tz = py * S; cam.follow = null;
    }
    drawMinimap() {
      const g = this.game, w = g.world, N = w.N;
      const c = this.mini, ctx = c.getContext('2d');
      const S = c.width;
      if (!this._miniBase || this._miniVer !== w.terrainVer + ':' + w.ownerVer + ':' + w.pathVer + ':' + g.bldVer + ':' + w.groundVer) {
        this._miniVer = w.terrainVer + ':' + w.ownerVer + ':' + w.pathVer + ':' + g.bldVer + ':' + w.groundVer;
        const img = ctx.createImageData(N, N);
        const gc = [[86, 152, 58], [160, 156, 78], [140, 102, 64], [214, 190, 135], [138, 134, 128], [64, 90, 42], [176, 168, 150]];
        const hr = w.heightRange();
        for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
          const i = tx + tz * N, o = i * 4;
          let col = gc[w.ground[i]] || gc[0];
          const hh = w.tileCenterH(tx, tz);
          let k = 0.82 + 0.3 * (hh - hr.min) / Math.max(1, hr.max - hr.min);
          if (w.isWater(tx, tz)) col = [60, 120, 160], k = 1;
          if (w.scen[i] >= 0) col = [46, 96, 40];
          if (w.path[i] === 3) col = [70, 70, 75], k = 1;
          else if (w.path[i]) col = [205, 195, 170], k = 1;
          if (w.trackOcc[i]) col = [160, 108, 60], k = 1;
          if (w.bld[i] >= 0) col = [230, 120, 40], k = 1;
          if (!w.owned[i] && tz !== w.roadRow) k *= 0.55;
          img.data[o] = col[0] * k; img.data[o + 1] = col[1] * k; img.data[o + 2] = col[2] * k; img.data[o + 3] = 255;
        }
        const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N;
        tmp.getContext('2d').putImageData(img, 0, 0);
        this._miniBase = tmp;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this._miniBase, 0, 0, S, S);
      const k = S / (N * T);
      /* tracks */
      for (const tr of g.tracks) {
        if (!tr.S) continue;
        ctx.strokeStyle = tr.state === 'open' ? '#ffd22e' : '#ff6a13'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < tr.S.n; i += 6) { const x = tr.S.x[i] * k, z = tr.S.z[i] * k; i ? ctx.lineTo(x, z) : ctx.moveTo(x, z); }
        if (tr.closed) ctx.closePath();
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      for (const r of g.riders) if (r.state === 'ride') ctx.fillRect(r.x * k - 1, r.z * k - 1, 2, 2);
      /* view frustum footprint */
      const ren = this.app.renderer, cam = ren.cam;
      const pts = [[0, 0], [cam.w, 0], [cam.w, cam.h], [0, cam.h]].map(([sx, sy]) => {
        const ray = cam.ray(sx, sy); const t = (cam.ty - ray.oy) / ray.dy; return [(ray.ox + ray.dx * t) * k, (ray.oz + ray.dz * t) * k];
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
    }

    /* ---------- 2D overlay: labels, bubbles, money ---------- */
    resizeOverlay(w, hgt, dpr) {
      this.overlay.width = Math.round(w * dpr); this.overlay.height = Math.round(hgt * dpr);
      this.overlay.style.width = w + 'px'; this.overlay.style.height = hgt + 'px';
      this.odpr = dpr;
    }
    drawOverlay(dt) {
      const ctx = this.octx, g = this.game, ren = this.app.renderer;
      const dpr = this.odpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      if (!g || this.app.demo) return;
      const zoom = ren.cam.zoom;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      /* thought bubbles when zoomed in */
      if (zoom >= 9 && this.app.settings.bubbles) {
        ctx.font = '600 12px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
        let n = 0;
        const drawBubble = (a, yOff) => {
          if (!a.bubble || n > 14) return;
          const p = ren.worldToCss(a.x, (a.y || g.world.heightAt(a.x, a.z)) + yOff, a.z);
          if (p[0] < -50 || p[1] < -30 || p[0] > innerWidth + 50 || p[1] > innerHeight + 30) return;
          n++;
          const txt = a.bubble.text;
          const w = Math.min(220, ctx.measureText(txt).width + 14);
          const alpha = Math.min(1, a.bubble.t * 2);
          ctx.globalAlpha = alpha;
          const def = Cat.thoughts[a.bubble.key];
          const good = def && def.mood > 0;
          ctx.fillStyle = good ? '#f1ffe9' : '#fff8ee';
          ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.5;
          const x = p[0] - w / 2, y = p[1] - 30;
          roundRect(ctx, x, y, w, 20, 6); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(p[0] - 4, p[1] - 6, 3, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#1a1410';
          ctx.fillText(txt, p[0], y + 10.5, w - 8);
          ctx.globalAlpha = 1;
        };
        for (const v of g.visitors) drawBubble(v, 1.9);
        for (const r of g.riders) drawBubble(r, 2.2);
      }
      /* race number plates */
      if (g.race && g.race.phase !== 'gather' && zoom >= 5) {
        ctx.font = '800 11px "Saira Condensed", "Arial Narrow", sans-serif';
        const order = g.race.order.length ? g.race.order : g.race.riders;
        order.slice(0, 30).forEach((r, i) => {
          if (r.dead) return;
          const p = ren.worldToCss(r.x, (r.y || 0) + 2.4, r.z);
          ctx.fillStyle = i === 0 ? '#ffd22e' : '#ffffff'; ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.5;
          roundRect(ctx, p[0] - 13, p[1] - 8, 26, 15, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#1a1410'; ctx.fillText((i + 1) + 'º', p[0], p[1]);
        });
      }
      /* selected / hovered agent ring label */
      const sel = this.app.selectedAgent;
      if (sel && !sel.dead) {
        const p = ren.worldToCss(sel.x, (sel.y || g.world.heightAt(sel.x, sel.z)) + 2.6, sel.z);
        ctx.font = '700 12px "Saira Condensed", "Arial Narrow", sans-serif';
        const name = sel.displayName || sel.name;
        const w = ctx.measureText(name).width + 12;
        ctx.fillStyle = 'rgba(26,20,16,0.85)'; roundRect(ctx, p[0] - w / 2, p[1] - 9, w, 18, 4); ctx.fill();
        ctx.fillStyle = '#ffd22e'; ctx.fillText(name, p[0], p[1]);
      }
      /* tool labels */
      const tool = MX.Tools.current;
      if (tool && tool.labels) {
        ctx.font = '700 13px "Saira Condensed", "Arial Narrow", sans-serif';
        for (const l of tool.labels()) {
          const p = ren.worldToCss(l.x, l.y, l.z);
          const w = ctx.measureText(l.text).width + 14;
          ctx.fillStyle = l.bad ? 'rgba(160,30,25,0.92)' : l.warn ? 'rgba(150,100,0,0.92)' : 'rgba(26,20,16,0.88)';
          roundRect(ctx, p[0] - w / 2, p[1] - 11, w, 22, 4); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillText(l.text, p[0], p[1] + 0.5);
        }
      }
      /* building warnings (no access) */
      if (zoom >= 4) for (const b of g.buildings.values()) {
        if (!b.warn) continue;
        const p = ren.worldToCss(b.cx, b.y + (b.height || 3) + 2, b.cz);
        ctx.drawImage(this.warnImg || (this.warnImg = imgFromURL(MX.DOM.iconURL('warn', 3))), p[0] - 12, p[1] - 12 + Math.sin(performance.now() / 250) * 2, 24, 24);
      }
      /* floating money */
      ctx.font = '800 14px "Saira Condensed", "Arial Narrow", sans-serif';
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.t += dt;
        if (f.t > 1.6) { this.floats.splice(i, 1); continue; }
        if (f.y == null) f.y = g.world.heightAt(f.x, f.z) + 2;
        const p = ren.worldToCss(f.x, f.y + f.t * 2.2, f.z);
        ctx.globalAlpha = Math.min(1, (1.6 - f.t) * 2);
        const txt = (f.amount > 0 ? '+' : '') + U.fmtMoney(f.amount);
        ctx.lineWidth = 3; ctx.strokeStyle = '#1a1410';
        ctx.strokeText(txt, p[0], p[1]);
        ctx.fillStyle = f.amount > 0 ? '#7dff7a' : '#ff6b5b';
        ctx.fillText(txt, p[0], p[1]);
        ctx.globalAlpha = 1;
      }
    }
  }
  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + hh - r); ctx.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function imgFromURL(u) { const i = new Image(); i.src = u; return i; }
  MX.HUD = HUD;
})(window.MX);
