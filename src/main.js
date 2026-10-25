/* MX Tycoon - application: boot and loading, title screen with a live demo park,
   main loop, agent rendering, picking, dialogs, saves, autosave and error handling. */
(function (MX) {
  'use strict';
  const { h, icon, clear } = MX.DOM;
  const U = MX.U, C = MX.C, Cat = MX.Catalog;
  const T = C.TILE;

  const DEFAULTS = { sound: true, sfx: true, music: true, sfxVol: 0.7, musicVol: 0.45, pixelScale: 2, shadows: true, outline: true, grid: false, bubbles: true, floatMoney: false, edgeScroll: false, autosaveWeeks: 1 };
  const SKIN_RIDER = [236, 196, 160];

  const App = {
    game: null, renderer: null, demo: false, settings: null,
    trackUI: { width: 8, surface: 'dirt', section: 'features' },
    selectedAgent: null, hoverAgent: null,
    errors: 0,

    async boot() {
      this.settings = MX.Save.settings(DEFAULTS);
      this.el = document.getElementById('app');
      this.view = document.getElementById('view');
      this.uiRoot = document.getElementById('ui');
      this.loading = document.getElementById('loading');
      this.titleEl = document.getElementById('title');
      this.modalEl = document.getElementById('modal');
      window.addEventListener('error', (e) => this.onError(e.error || e.message));
      window.addEventListener('unhandledrejection', (e) => this.onError(e.reason));
      const step = async (pct, label) => { this.setLoading(pct, label); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); };
      try {
        await step(5, 'Preparando el motor gráfico…');
        this.renderer = new MX.Renderer(document.getElementById('gl'));
        this.renderer.pixelScale = this.settings.pixelScale;
        this.renderer.shadows = this.settings.shadows; this.renderer.outline = this.settings.outline;
        await step(15, 'Pintando texturas de tierra, arena y barro…');
        MX.Tex.buildMaterials();
        await step(40, 'Montando motos y pilotos…');
        MX.Models.buildAll();
        await step(60, 'Encendiendo los motores…');
        this.renderer.init();
      } catch (e) {
        console.error(e);
        this.fatal(e && e.message === 'WEBGL2'
          ? 'Tu navegador no admite WebGL2, necesario para MX Tycoon. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari, o activa la aceleración por hardware.'
          : 'No se pudo iniciar el motor gráfico: ' + (e && e.message ? e.message : e));
        return;
      }
      await step(75, 'Preparando la interfaz…');
      this.input = new MX.Input(this.view);
      this.hud = new MX.HUD(this, this.uiRoot);
      this.winRoot = h('div', { id: 'windows' });
      this.uiRoot.appendChild(this.winRoot);
      MX.WM.init(this.winRoot);
      this.fx = new MX.FX();
      this.tutorial = new MX.Tutorial(this, this.uiRoot);
      this.panels = {
        tracks: MX.Panels1.tracksPanel, terrain: MX.Panels1.terrainPanel, build: MX.Panels1.buildPanel, paths: MX.Panels1.pathsPanel, decor: MX.Panels1.decorPanel,
        staff: MX.Panels2.staffPanel, finance: MX.Panels2.financePanel, events: MX.Panels2.eventsPanel, research: MX.Panels2.researchPanel, objectives: MX.Panels2.objectivesPanel,
        park: MX.Panels2.parkPanel, agent: MX.Panels2.agentPanel, building: MX.Panels2.buildingPanel, testReport: MX.Panels2.testReport, menu: MX.Panels2.menuPanel,
        race: MX.Panels2.racePanel, results: MX.Panels2.resultsPanel, decision: MX.Panels2.decisionPanel, options: MX.Panels2.optionsPanel, saves: MX.Panels2.savePanel
      };
      this.busHooks();
      window.addEventListener('resize', () => this.resize());
      this.resize();
      await step(90, 'Regando la pista…');
      /* live updates of the published page keep the running game */
      const hot = window.claude && window.claude.hot;
      if (hot && hot.snapshot) hot.snapshot(() => (this.game && !this.demo ? { save: this.game.serialize() } : null));
      this.setLoading(100, '¡Listo!');
      this.loading.classList.add('done');
      setTimeout(() => { this.loading.hidden = true; }, 400);
      const start = (data) => {
        if (data && data.save) { try { this.startGame(MX.Game.deserialize(data.save)); return; } catch (e) { console.error(e); } }
        this.showTitle();
      };
      if (hot && hot.ready) hot.ready(start); else start(hot && hot.data);
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    },
    setLoading(pct, label) {
      const b = this.loading.querySelector('.load-fill'), l = this.loading.querySelector('.load-label');
      if (b) b.style.width = pct + '%';
      if (l) l.textContent = label;
    },
    fatal(msg) {
      this.loading.hidden = false;
      clear(this.loading);
      this.loading.append(h('div', { class: 'fatal' }, h('div', { class: 'logo-small' }, 'MX TYCOON'), h('p', null, msg)));
    },
    onError(err) {
      console.error(err);
      this.errors++;
      if (this.errors > 40) return;
      const msg = err && err.message ? err.message : String(err);
      if (this.hud) this.hud.toast('Error inesperado: ' + msg.slice(0, 120) + '. El juego intenta continuar.', 'bad');
    },
    busHooks() {
      MX.Bus.on('dialog', (d) => { if (!this.demo) this.panels.decision(d); });
      MX.Bus.on('race:begin', () => { if (!this.demo) { this.panels.race(); } });
      MX.Bus.on('race:results', (res) => { if (!this.demo) setTimeout(() => this.panels.results(res), 600); });
      MX.Bus.on('bankrupt', () => { if (!this.demo) this.gameOver(); });
      MX.Bus.on('victory', () => { if (!this.demo) this.victory(); });
      MX.Bus.on('day', (d) => {
        if (this.demo || !this.game) return;
        const w = this.settings.autosaveWeeks;
        if (w && d.day % (7 * w) === 0) this.autosave();
      });
      MX.Bus.on('track:changed', () => { if (MX.WM.isOpen('tracks')) MX.WM.get('tracks').t = 0; });
      MX.Bus.on('gl:lost', () => this.toastAny('Se ha perdido el contexto gráfico. Intentando recuperarlo…', 'bad'));
      MX.Bus.on('gl:restored', () => {
        if (this.game && !this.demo) MX.Tex.redrawParkName(this.renderer.gl, this.renderer.atlasTex, this.game.parkName);
        this.toastAny('Gráficos recuperados', 'good');
      });
    },
    resize() {
      const r = this.view.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.renderer.resize(r.width, r.height, dpr);
      this.hud.resizeOverlay(r.width, r.height, dpr);
      const root = document.documentElement;
      root.classList.toggle('narrow', r.width < 760);
      /* phones: bottom sheets in portrait, side sheet in landscape */
      const phone = r.width < 600 || (r.height < 500 && r.width < 1000);
      const land = phone && r.width > r.height;
      if (phone !== root.classList.contains('phone') || land !== root.classList.contains('land')) {
        root.classList.toggle('phone', phone);
        root.classList.toggle('land', land);
        MX.WM.relayout();
      }
    },
    /* The part of the screen where the map is not covered by bars, sheets or the tutorial. */
    freeRect() {
      const W = window.innerWidth, H = window.innerHeight;
      const tb = document.getElementById('topbar');
      let top = tb ? tb.getBoundingClientRect().bottom : 44;
      const tut = document.getElementById('tutorial');
      if (tut && !tut.hidden && document.documentElement.classList.contains('phone')) top = Math.max(top, tut.getBoundingClientRect().bottom);
      let bottom = H, left = 0;
      const bar = document.getElementById('toolbar');
      if (bar && bar.offsetHeight) bottom = Math.min(bottom, bar.getBoundingClientRect().top);
      for (const w of MX.WM.wins.values()) {
        if (!w.el.classList.contains('sheet')) continue;
        const b = w.el.getBoundingClientRect();
        if (document.documentElement.classList.contains('land')) left = Math.max(left, b.right); else bottom = Math.min(bottom, b.top);
      }
      return { left, top, right: W, bottom };
    },
    /* Pan so a world point sits inside the free part of the map. */
    frameWorld(x, y, z, force) {
      const p = this.renderer.worldToCss(x, y, z), f = this.freeRect(), m = 40;
      if (!force && p[0] > f.left + m && p[0] < f.right - m && p[1] > f.top + m && p[1] < f.bottom - m) return;
      const tx = (f.left + f.right) / 2, ty = f.top + (f.bottom - f.top) * 0.45;
      this.panAnim = { dx: tx - p[0], dy: ty - p[1], t: 0, ax: 0, ay: 0 };
    },
    /* ground point in the middle of the free part of the map */
    freeCenter() {
      const f = this.freeRect();
      return this.renderer.pickGround((f.left + f.right) / 2, f.top + (f.bottom - f.top) * 0.5);
    },
    applyGraphics() {
      const s = this.settings, r = this.renderer;
      r.pixelScale = s.pixelScale; r.shadows = s.shadows; r.outline = s.outline;
      this.resize();
    },
    saveSettings() { MX.Save.saveSettings(this.settings); },
    toastAny(msg, kind) { if (this.hud) this.hud.toast(msg, kind); },

    /* ---------------- title and demo ---------------- */
    showTitle() {
      this.makeDemo();
      MX.WM.closeAll();
      this.hud.setVisible(false);
      this.titleEl.hidden = false;
      clear(this.titleEl);
      const latest = MX.Save.latest();
      const menu = h('div', { class: 'title-menu' },
        h('button', { class: 'tbtn-big primary', onclick: () => this.newGameDialog('career') }, icon('play'), h('span', null, 'Nueva partida', h('small', null, 'Modo carrera con objetivos'))),
        h('button', { class: 'tbtn-big', disabled: !latest, onclick: () => this.continueLatest() }, icon('save'), h('span', null, 'Continuar', h('small', null, latest ? latest.park + ' · ' + latest.date : 'No hay partidas guardadas'))),
        h('button', { class: 'tbtn-big', onclick: () => this.newGameDialog('sandbox') }, icon('build'), h('span', null, 'Modo sandbox', h('small', null, 'Construye sin límites'))),
        h('div', { class: 'row gap center' },
          h('button', { class: 'btn', onclick: () => { this.startAudio(); this.panels.saves('load'); } }, icon('save'), 'Cargar'),
          h('button', { class: 'btn', onclick: () => { this.startAudio(); this.panels.options(); } }, icon('gear'), 'Opciones'),
          h('button', { class: 'btn', onclick: () => { this.startAudio(); MX.Panels2.helpPanel(); } }, icon('info'), 'Cómo jugar')));
      this.titleEl.append(
        h('div', { class: 'title-card' },
          h('div', { class: 'logo' }, h('span', { class: 'logo-mx' }, 'MX'), h('span', { class: 'logo-tycoon' }, 'TYCOON')),
          h('div', { class: 'logo-sub' }, 'Motocross Empire'),
          menu),
        h('div', { class: 'title-foot' }, 'Construye circuitos, gestiona tu complejo y organiza el Gran Premio · v' + MX.VERSION));
    },
    makeDemo() {
      this.demo = true;
      const g = MX.Game.create({ mode: 'sandbox', seed: 777, preset: 'valle', parkName: 'MX Park Los Pinares' });
      try { buildDemoPark(g); } catch (e) { console.error('demo', e); }
      this.game = g;
      g.speed = 1;
      this.renderer.setGame(g);
      for (let i = 0; i < 900; i++) { if (g.fieldsDirty) g.rebuildFields(); g.step(1 / 30); }
      const cam = this.renderer.cam;
      cam.tx = 160; cam.tz = 214; cam.ty = 6; cam.zoom = cam.targetZoom = 7.5; cam.freeYaw = true;
      cam.follow = null;
      this.input.enabled = false;
    },
    newGameDialog(mode) {
      this.startAudio();
      const nameDefault = U.rng.pick(Cat.names.parkPrefix) + ' ' + U.rng.pick(Cat.names.parkName);
      const st = { preset: 'valle', tut: mode === 'career' };
      const name = h('input', { id: 'ng-name', class: 'inp', value: nameDefault, maxlength: 30 });
      const presets = h('div', { class: 'row gap wrap' });
      const P = [['valle', 'Valle verde', 'Suave y con bosques. Ideal para empezar.'], ['colinas', 'Colinas', 'Desniveles fuertes para circuitos con subidas y bajadas.'], ['desierto', 'Desierto', 'Terreno seco y arenoso, poca vegetación.']];
      for (const [k, n, d] of P) presets.append(h('button', { class: 'preset' + (st.preset === k ? ' on' : ''), title: d, onclick: (e) => { st.preset = k; for (const b of presets.children) b.classList.remove('on'); e.currentTarget.classList.add('on'); } }, h('b', null, n), h('small', null, d)));
      const tut = mode === 'career' ? h('label', { class: 'tog', for: 'ng-tut' }, h('input', { id: 'ng-tut', type: 'checkbox', checked: true, onchange: (e) => { st.tut = e.target.checked; } }), h('span', null, 'Jugar con tutorial')) : null;
      this.modal(mode === 'career' ? 'Nueva partida' : 'Modo sandbox', [
        h('label', { for: 'ng-name' }, 'Nombre del complejo'), name,
        h('h4', null, 'Terreno'), presets, tut,
        h('p', { class: 'muted small' }, mode === 'career' ? 'Empiezas con 150.000 € y un terreno pequeño. Cumple objetivos para desbloquear terrenos, competiciones y mejoras.' : 'Dinero de sobra, todo el mapa comprado y todo desbloqueado. Sin objetivos ni bancarrota.')
      ], [{ label: 'Empezar', primary: true, fn: () => this.newGame({ mode, preset: st.preset, parkName: name.value.trim() || nameDefault, tutorial: st.tut }) }, { label: 'Cancelar' }]);
    },
    newGame(opts) {
      this.demo = false;
      const g = MX.Game.create({ mode: opts.mode, preset: opts.preset, parkName: opts.parkName });
      this.startGame(g);
      const cam = this.renderer.cam;
      cam.tx = 160; cam.tz = 250; cam.zoom = cam.targetZoom = 7;
      if (opts.tutorial) this.tutorial.start(true);
      else if (opts.mode === 'career' && MX.Save.flag('tutorialDone') !== '1') this.hud.toast('Consejo: abre Circuitos para dibujar tu primer trazado', 'info');
    },
    startGame(g) {
      this.demo = false;
      this.game = g;
      MX.Tex.redrawParkName(this.renderer.gl, this.renderer.atlasTex, g.parkName);
      this.renderer.setGame(g);
      this.renderer.grid = this.settings.grid;
      const cam = this.renderer.cam;
      cam.freeYaw = false; cam.yawIndex = 0; cam.follow = null;
      if (!cam.tx) { cam.tx = 160; cam.tz = 250; }
      this.titleEl.hidden = true;
      this.hud.setVisible(true);
      this.input.enabled = true;
      MX.WM.closeAll();
      MX.Tools.select();
      this.selectedAgent = null;
      this.startAudio();
      if (g.fieldsDirty) g.rebuildFields();
      for (const b of g.buildings.values()) b.warn = null;
    },
    async continueLatest() {
      const l = MX.Save.latest();
      if (!l) return;
      const r = await this.loadSlot(l.slot);
      if (!r.ok) this.modal('No se pudo cargar', [h('p', null, r.reason)], [{ label: 'Vale' }]);
    },
    async loadSlot(slot) {
      const r = await MX.Save.load(slot);
      if (!r.ok) return r;
      return this.loadData(r.data);
    },
    async importCode(code) {
      const r = await MX.Save.importCode(code);
      if (!r.ok) return r;
      return this.loadData(r.data);
    },
    loadData(data) {
      try {
        const g = MX.Game.deserialize(data);
        this.startGame(g);
        this.hud.toast('Partida cargada: ' + g.parkName, 'good');
        return { ok: true };
      } catch (e) {
        console.error(e);
        return { ok: false, reason: 'La partida guardada está dañada o es de otra versión' };
      }
    },
    async autosave() {
      if (!this.game || this.demo) return;
      const r = await MX.Save.save('auto', this.game);
      if (r.ok) this.hud.toast('Partida guardada automáticamente', 'info');
    },
    async quickSave() {
      if (!this.game || this.demo) return;
      const r = await MX.Save.save('1', this.game);
      this.hud.toast(r.ok ? 'Partida guardada en la ranura 1' : r.reason, r.ok ? 'good' : 'bad');
    },
    async toTitle() {
      if (this.game && !this.demo) await this.autosave();
      this.tutorial.stop(false);
      MX.Tools.select();
      this.showTitle();
    },
    startAudio() {
      MX.Audio.init(this.settings);
      MX.Audio.resume();
    },
    toggleSound() {
      this.startAudio();
      this.settings.sound = MX.Audio.toggle();
      this.saveSettings();
    },
    setSpeed(v) { if (!this.game || this.game.gameOver) return; this.game.speed = v; MX.Audio.sfx('click'); },
    togglePause() { if (!this.game) return; if (this.game.speed) { this._prevSpeed = this.game.speed; this.game.speed = 0; } else this.game.speed = this._prevSpeed || 1; },

    /* ---------------- dialogs ---------------- */
    modal(title, content, buttons) {
      const m = this.modalEl;
      clear(m);
      m.hidden = false;
      const close = () => { m.hidden = true; clear(m); };
      const box = h('div', { class: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'win-title' }, h('span', { class: 'win-t' }, title), h('span', { class: 'win-stripes' })),
        h('div', { class: 'modal-body' }, ...content),
        h('div', { class: 'modal-btns' }, ...(buttons || [{ label: 'Vale' }]).map(b => h('button', { class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), onclick: () => { close(); if (b.fn) b.fn(); } }, b.label))));
      m.appendChild(box);
      const first = box.querySelector('.btn.primary') || box.querySelector('.btn');
      if (first) setTimeout(() => first.focus(), 30);
      this._modalClose = close;
    },
    modalOpen() { return !this.modalEl.hidden; },
    confirm(title, text, onYes) { this.modal(title, [h('p', null, text)], [{ label: 'Sí', primary: true, fn: onYes }, { label: 'Cancelar' }]); },
    gameOver() {
      const g = this.game;
      this.modal('Bancarrota', [h('p', null, 'El banco ha cerrado ' + g.parkName + ' tras demasiado tiempo en números rojos.'),
        h('p', { class: 'muted' }, 'Duraste hasta el ' + g.dateText() + '. Reputación final: ' + Math.round(g.rep) + '.')],
      [{ label: 'Cargar partida', primary: true, fn: () => this.panels.saves('load') }, { label: 'Menú principal', fn: () => this.showTitle() }]);
    },
    victory() {
      this.modal('¡Has ganado el modo carrera!', [h('p', null, 'Tu complejo ha organizado un Gran Premio memorable. ' + this.game.parkName + ' ya es una leyenda del motocross.'), h('p', { class: 'muted' }, 'Puedes seguir jugando y ampliando tu imperio.')], [{ label: 'Seguir jugando', primary: true }]);
    },

    /* ---------------- camera helpers ---------------- */
    lookAt(x, z) { const cam = this.renderer.cam; cam.follow = null; cam.tx = x; cam.tz = z; cam.ty = this.game.world.heightAt(x, z); if (cam.targetZoom < 9) cam.targetZoom = 12; },
    follow(a) { const cam = this.renderer.cam; cam.follow = a; if (cam.targetZoom < 12) cam.targetZoom = 16; this.selectedAgent = a; },
    locate(n) {
      const g = this.game;
      if (n.agentId) {
        const a = g.riders.find(r => r.id === n.agentId) || g.visitors.find(v => v.id === n.agentId) || g.staff.find(s => s.id === n.agentId);
        if (a) { this.follow(a); this.panels.agent(a); return; }
      }
      if (n.x != null) this.lookAt(n.x, n.z);
    },

    /* ---------------- picking ---------------- */
    pickAgent(cx, cy) {
      const g = this.game, r = this.renderer;
      if (!g) return null;
      let best = null, bd = 18 * 18;
      const test = (a, hgt) => {
        if (a.dead) return;
        if (a.kind === 'visitor' && a.state === 'inside') return;
        const p = r.worldToCss(a.x, (a.y || g.world.heightAt(a.x, a.z)) + hgt, a.z);
        const d = (p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy);
        if (d < bd) { bd = d; best = a; }
      };
      for (const a of g.riders) if (a.state !== 'inside' && a.state !== 'leave' && a.state !== 'carried') test(a, 1.0);
      if (!best) { for (const a of g.staff) test(a, 0.9); for (const a of g.visitors) test(a, 0.9); }
      return best;
    },
    pickBuilding(cx, cy) {
      const g = this.game, r = this.renderer;
      let best = null, bt = Infinity;
      for (const b of g.buildings.values()) {
        const t = r.rayAABB(cx, cy, b.tx * T, b.y - 0.5, b.tz * T, (b.tx + b.w) * T, b.y + (b.height || 3), (b.tz + b.h) * T);
        if (t >= 0 && t < bt) { bt = t; best = b; }
      }
      return best;
    },

    /* ---------------- main loop ---------------- */
    loop(t) {
      requestAnimationFrame((tt) => this.loop(tt));
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      const g = this.game;
      try {
        if (this.demo && g) {
          const cam = this.renderer.cam;
          cam.yaw += dt * 0.045;
          g.speed = 1;
        }
        if (this.panAnim) {
          const pa = this.panAnim;
          pa.t += dt;
          const k = Math.min(1, pa.t / 0.35), e = 1 - Math.pow(1 - k, 3);
          this.input.panBy(pa.dx * e - pa.ax, pa.dy * e - pa.ay);
          pa.ax = pa.dx * e; pa.ay = pa.dy * e;
          if (k >= 1) this.panAnim = null;
        }
        this.input.update(dt);
        if (MX.Tools.current && MX.Tools.current.tick) MX.Tools.current.tick(dt);
        if (g) g.update(dt);
      } catch (e) { this.onError(e); }
      try {
        if (g) this.renderFrame(dt);
        if (!this.demo) { this.hud.update(dt); MX.WM.tick(dt); this.tutorial.update(); }
        this.hud.drawOverlay(dt);
        MX.Audio.update(dt);
      } catch (e) { this.onError(e); }
    },
    renderFrame(dt) {
      const r = this.renderer, g = this.game;
      if (r.lost) return;
      r.beginInstances();
      this.pushAgents();
      if (g.speed > 0) this.fx.update(dt * Math.min(g.speed, 2));
      else this.fx.update(0);
      this.fx.draw(r);
      this.pushMarkers();
      r.render(dt);
    },
    pushAgents() {
      const r = this.renderer, g = this.game, w = g.world;
      const zoom = r.cam.zoom;
      const tr = (id) => g.trackById(id);
      for (const v of g.visitors) {
        const m = v.model();
        if (!m) continue;
        let x = v.x, z = v.z, y, yaw = v.yaw;
        if (v.seat) { y = v.seat.y; yaw = v.seat.yaw - Math.PI / 2 + Math.PI / 2; x = v.seat.x; z = v.seat.z; }
        else y = w.heightAt(x, z) + (w.isWalkable(v.tx, v.tz) ? 0.07 : 0);
        if (!r.inView(x, y, z, 30)) continue;
        if (v.state === 'watch' && v.cheer) y += Math.abs(Math.sin(g.time * 7 + v.id)) * 0.25;
        r.pushInst(m, x, y, z, yaw, 0, 0, v.kid ? 0.72 : 1, v.cols[0], v.cols[1], v.cols[2], v.cols[3]);
      }
      for (const a of g.riders) {
        const m = a.model();
        if (!m) continue;
        let y = a.y;
        const c = a.cols;
        if (a.m) {
          if (!r.inView(a.m.x, a.m.y, a.m.z, 40)) continue;
          if (a.m.crash) {
            r.pushInst('bike', a.m.x, a.m.gy, a.m.z, a.m.hdg, 0, a.m.roll, 1, c[0], c[1], c[2], c[3]);
            const side = a.m.crash.side;
            const ox = -Math.sin(a.m.hdg) * side * 1.3, oz = Math.cos(a.m.hdg) * side * 1.3;
            r.pushInst('person_lie', a.m.x + ox, a.m.gy + 0.05, a.m.z + oz, a.m.hdg + a.m.crash.spin, 0, 0, 1, c[2], c[1], c[3], SKIN_RIDER);
          } else r.pushInst(m, a.m.x, a.m.y, a.m.z, a.m.hdg, a.m.pitch, a.m.roll, 1, c[0], c[1], c[2], c[3]);
          continue;
        }
        y = w.heightAt(a.x, a.z) + 0.05;
        if (!r.inView(a.x, y, a.z, 30)) continue;
        if (a.state === 'prep' || a.state === 'rest') {
          r.pushInst('bike', a.x + Math.cos(a.yaw + 1.5) * 1.2, y, a.z + Math.sin(a.yaw + 1.5) * 1.2, a.yaw, 0, 0.08, 1, c[0], c[1], c[2], c[3]);
          r.pushInst('person_0', a.x, y, a.z, a.yaw + Math.PI / 2, 0, 0, 1, c[2], c[1], c[3], SKIN_RIDER);
          continue;
        }
        if (a.onFoot || m.startsWith('person')) r.pushInst(m, a.x, y, a.z, a.yaw, 0, 0, 1, c[2], c[1], c[3], SKIN_RIDER);
        else r.pushInst(m, a.x, y, a.z, a.yaw, 0, 0, 1, c[0], c[1], c[2], c[3]);
      }
      for (const s of g.staff) {
        const m = s.model();
        const y = s.state === 'groom' ? s.y : w.heightAt(s.x, s.z) + 0.05;
        if (!r.inView(s.x, y, s.z, 30)) continue;
        if (s.vehicle) {
          const col = s.vehicle === 'quad' ? null : s.vehicle === 'tractor' ? [46, 125, 50] : [240, 240, 240];
          r.pushInst(m, s.x, y, s.z, s.yaw, 0, 0, 1, col, null, null, null);
        } else {
          let mm = m;
          if (s.role === 'marshal' && s.flagT > 0) mm = 'staff_marshal_' + (Math.floor(g.time * 6) % 2 ? 1 : 3);
          r.pushInst(mm, s.x, y, s.z, s.yaw, 0, 0, 1, s.cols[0], s.cols[1], s.cols[2], s.cols[3]);
        }
      }
      for (const car of g.cars) {
        if (!r.inView(car.x, car.y, car.z, 30)) continue;
        r.pushInst(car.model, car.x, car.y, car.z, car.yaw, 0, 0, 1, car.col, null, null, null);
      }
      /* riders on the podium after a race */
      if (g.race && g.race.phase === 'podium' && g.race.podium) {
        const pod = g.buildingsOf('podium')[0];
        if (pod) {
          const offs = [[2, 1.4], [0.8, 1.0], [3.2, 0.7]];
          g.race.podium.forEach((rd, i) => {
            const p = g.localToWorld(pod, offs[i][0], 2);
            r.pushInst('person_cheer', p.x, pod.y + offs[i][1], p.z, pod.frontYaw, 0, 0, 1, rd.cols[2], rd.cols[1], rd.cols[3], SKIN_RIDER);
          });
        }
      }
      /* dust trails */
      if (zoom > 2.5 && g.speed > 0) for (const a of g.riders) if (a.m && a.trackId != null) { const t = tr(a.trackId); if (t) this.fx.riderTrail(a, t, 1 / 60 * Math.min(2, g.speed)); }
    },
    pushMarkers() {
      const r = this.renderer, g = this.game;
      const sel = this.selectedAgent && !this.selectedAgent.dead ? this.selectedAgent : null;
      const hov = this.hoverAgent && !this.hoverAgent.dead ? this.hoverAgent : null;
      const ring = (a, col) => {
        const y = (a.m ? a.m.gy : g.world.heightAt(a.x, a.z)) + 0.15;
        r.pushSprite(a.x, y + 2.9 + Math.sin(g.time * 4) * 0.15, a.z, 0.7, 0.7, 'p_square', col[0], col[1], col[2], 255, Math.PI / 4);
      };
      if (sel) ring(sel, [255, 210, 46]);
      if (hov && hov !== sel) ring(hov, [255, 255, 255]);
      /* test crash markers */
      for (const t of g.tracks) if (t.state === 'testing') for (const m of t.crashMarks) r.pushSprite(m.x, g.world.heightAt(m.x, m.z) + 2, m.z, 1.4, 1.4, 'icon_warn', 255, 255, 255, 255, 0);
    }
  };

  /* Scripted showcase park used behind the title screen. */
  function buildDemoPark(g) {
    const tr = g.newTrack();
    tr.name = 'Demo';
    const cx = 160, cz = 214;
    const pts = [[0, 1], [0.55, 0.85], [0.95, 0.55], [1, 0], [0.8, -0.6], [0.3, -0.75], [-0.1, -0.4], [-0.45, -0.85], [-0.9, -0.6], [-1, 0], [-0.8, 0.6], [-0.4, 0.9]];
    g.editTrack(tr, (t) => { for (const p of pts) t.addNode(cx + p[0] * 54, cz + p[1] * 40, 9, 'dirt'); t.closed = true; });
    const place = (type, from) => { for (let s = from || 0; s < tr.length; s += 2) { const c = tr.checkFeature(type, s); if (c.ok) { g.addFeature(tr, type, s); return; } } };
    place('start'); place('finish', 40); place('tabletop_m'); place('double_s', 60); place('rollers', 90); place('tabletop_l', 130); place('whoops', 170); place('double_l', 200); place('rhythm', 240); place('tabletop_s', 300);
    for (let k = 0; k < 6; k++) place('berm', k * 60);
    g.placeBuilding('parking', 26, 76, 0); g.placeBuilding('paddock', 50, 76, 0); g.placeBuilding('parking', 30, 76, 0);
    for (let x = 26; x <= 52; x++) g.placePath(x, 73, 2);
    for (let z = 74; z <= 78; z++) g.placePath(29, z, 2);
    for (let z = 67; z <= 72; z++) g.placePath(40, z, 2);
    for (let x = 33; x <= 47; x++) g.placePath(x, 67, 2);
    g.placeBuilding('entrance', 30, 74, 0);
    g.placeBuilding('toilets', 34, 72, 2); g.placeBuilding('foodtruck', 36, 72, 2); g.placeBuilding('shop', 38, 72, 2);
    g.placeBuilding('grandstand', 34, 65, 2); g.placeBuilding('grandstand', 43, 65, 2); g.placeBuilding('grandstand_cov', 37, 65, 2);
    g.placeBuilding('restaurant', 42, 70, 2); g.placeBuilding('workshop', 46, 74, 0); g.placeBuilding('tower', 33, 68, 0); g.placeBuilding('medical', 47, 71, 0);
    g.placeBuilding('office', 44, 68, 0);
    for (const [x, z, t] of [[25, 60, 'flag'], [52, 58, 'flag'], [24, 64, 'banner'], [53, 63, 'arch'], [49, 67, 'statue'], [26, 70, 'flowers']]) g.placeDecor(t, x, z);
    g.rebuildFields();
    g.openTrack(tr);
    const rng = new U.RNG(99);
    for (let i = 0; i < 14; i++) {
      const r = new MX.Agents.Rider(g, rng, { skill: rng.range(35, 95) });
      r.joinTrack(g, tr, (i * 37) % tr.length, rng.range(-2, 2), 10);
      r.lapsPlan = 999; r.maxSessions = 9;
      g.riders.push(r);
    }
    for (let i = 0; i < 6; i++) g.hire(Cat.staffOrder[i % 4], g.candidates(Cat.staffOrder[i % 4])[0]);
    g.rep = 600;
  }

  MX.App = App;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => App.boot());
  else App.boot();
})(window.MX);
