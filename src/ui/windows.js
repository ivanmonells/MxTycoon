/* MX Tycoon - window manager. On desktop panels are floating windows. On phones
   they become one sheet at a time (bottom sheet in portrait, side sheet in
   landscape) that folds down to its title bar whenever a tool needs the map.
   Panels build their DOM once and return an update() function that the manager
   calls a few times per second. */
(function (MX) {
  'use strict';
  const { h, icon, clear } = MX.DOM;

  /* tools that work on the map: on phones the sheet folds while they are active */
  const MAP_TOOLS = new Set(['trackstart', 'trackfeature', 'tracksurface', 'trackwidth', 'trackedit', 'trackelev', 'trackdraw', 'build', 'path', 'addon', 'decor', 'demolish', 'terrain', 'paint', 'land']);
  const isPhone = () => document.documentElement.classList.contains('phone');

  const WM = {
    root: null, wins: new Map(), z: 20, pos: {}, measureT: 0,
    init(root) {
      this.root = root;
      try { this.pos = JSON.parse(localStorage.getItem('mxtycoon.winpos') || '{}'); } catch (e) { this.pos = {}; }
      MX.Bus.on('tool', (name) => this.onTool(name));
      /* a tap that changes the layout under the finger must not click what appears there:
         the browser sends that tap's click after the sheet has already moved */
      window.addEventListener('click', (e) => {
        const g = this._eat;
        if (!g) return;
        this._eat = null;
        if (performance.now() - g.t < 600 && Math.abs(e.clientX - g.x) < 30 && Math.abs(e.clientY - g.y) < 30) { e.preventDefault(); e.stopPropagation(); }
      }, true);
    },
    eatClick(x, y) { this._eat = { x, y, t: performance.now() }; },
    topLimit() { const tb = document.getElementById('topbar'); return tb && tb.offsetHeight ? tb.getBoundingClientRect().bottom + 4 : 48; },
    isOpen(id) { return this.wins.has(id); },
    get(id) { return this.wins.get(id); },
    open(id, o) {
      if (this.wins.has(id)) {
        const w = this.wins.get(id);
        if (o.rebuild) this._build(w, o);
        if (isPhone() && w.el.dataset.sheet === 'min') this.setSheet(id, 'half');
        this.focus(id);
        return w;
      }
      /* phones show one sheet at a time */
      if (isPhone()) for (const k of Array.from(this.wins.keys())) this.close(k, true);
      const el = h('div', { class: 'win ' + (o.cls || ''), role: 'dialog', 'aria-label': o.title });
      const acts = h('span', { class: 'win-acts' });
      const title = h('div', { class: 'win-title' },
        o.icon ? icon(o.icon, 'win-ic') : null,
        h('span', { class: 'win-t' }, o.title),
        h('span', { class: 'win-stripes' }),
        acts,
        h('button', { class: 'win-exp', title: 'Ampliar o reducir', 'aria-label': 'Ampliar o reducir', onclick: (e) => { e.stopPropagation(); this.setSheet(id, w.el.dataset.sheet === 'full' ? 'half' : 'full'); } }, h('i')),
        h('button', { class: 'win-x', title: 'Cerrar (Esc)', 'aria-label': 'Cerrar', onclick: (e) => { e.stopPropagation(); this.close(id); } }, icon('close'))
      );
      const tabs = h('div', { class: 'win-tabs' });
      const body = h('div', { class: 'win-body' });
      el.append(title, tabs, body);
      this.root.appendChild(el);
      const w = { id, el, body, tabsEl: tabs, titleEl: title.querySelector('.win-t'), actsEl: acts, o, update: null, t: 0 };
      this.wins.set(id, w);
      this._place(w);
      this._drag(w, title);
      el.addEventListener('pointerdown', () => this.focus(id));
      this._build(w, o);
      this.focus(id);
      this._toolActs(w);
      this.syncSheets();
      MX.Bus.emit('ui:open', id);
      return w;
    },
    /* desktop: floating position; phone: sheet laid out by CSS */
    _place(w) {
      const el = w.el, o = w.o;
      if (isPhone()) {
        el.classList.add('sheet');
        el.style.left = ''; el.style.top = ''; el.style.width = '';
        if (!el.dataset.sheet) el.dataset.sheet = 'half';
        return;
      }
      el.classList.remove('sheet');
      const vw = this.root.clientWidth || window.innerWidth, vh = this.root.clientHeight || window.innerHeight;
      const width = Math.min(o.width || 360, vw - 16);
      el.style.width = width + 'px';
      const saved = this.pos[w.id];
      let x = saved ? saved.x : (o.x != null ? o.x : Math.max(8, Math.min(vw - width - 8, 70 + (this.wins.size % 5) * 28)));
      let y = saved ? saved.y : (o.y != null ? o.y : this.topLimit() + 16 + (this.wins.size % 5) * 24);
      const top = this.topLimit();
      x = Math.max(4, Math.min(x, vw - 80)); y = Math.max(top, Math.min(y, vh - 60));
      if (vw < 640) { x = 8; el.style.width = (vw - 16) + 'px'; }
      el.style.left = x + 'px'; el.style.top = y + 'px';
    },
    /* after a resize or rotation that switches between phone and desktop layouts */
    relayout() {
      if (isPhone() && this.wins.size > 1) {
        let top = null;
        for (const w of this.wins.values()) if (!top || +w.el.style.zIndex > +top.el.style.zIndex) top = w;
        for (const k of Array.from(this.wins.keys())) if (k !== top.id) this.close(k, true);
      }
      for (const w of this.wins.values()) this._place(w);
      this.syncSheets();
    },
    _build(w, o) {
      /* rebuilding the same tab keeps the scroll position (option buttons rebuild the panel) */
      const keepScroll = w.builtTab === (w.tab || null) ? w.body.scrollTop : 0;
      clear(w.body); clear(w.tabsEl);
      w.o = o;
      if (o.tabs) {
        w.tabsEl.style.display = '';
        const sel = w.tab && o.tabs.find(t => t.id === w.tab) ? w.tab : (o.tab || o.tabs[0].id);
        for (const t of o.tabs) {
          const b = h('button', { class: 'tab' + (t.id === sel ? ' on' : ''), onclick: () => { w.tab = t.id; this._build(w, w.o); } }, t.icon ? icon(t.icon) : null, t.label);
          w.tabsEl.appendChild(b);
        }
        w.tab = sel;
        const t = o.tabs.find(x => x.id === sel);
        w.update = t.build(w.body, w) || null;
      } else {
        w.tabsEl.style.display = 'none';
        w.update = o.build ? (o.build(w.body, w) || null) : null;
      }
      if (w.update) try { w.update(); } catch (e) { console.error(e); }
      w.builtTab = w.tab || null;
      if (keepScroll) w.body.scrollTop = keepScroll;
    },
    setTab(id, tab) { const w = this.wins.get(id); if (w) { w.tab = tab; this._build(w, w.o); } },
    rebuild(id) { const w = this.wins.get(id); if (w) this._build(w, w.o); },
    /* run a window's update now instead of at its next tick (after a button press) */
    poke(id) { const w = this.wins.get(id); if (w && w.update) { w.t = w.o.every || 0.4; try { w.update(); } catch (e) { console.error('[win ' + id + ']', e); } } },
    setTitle(id, t) { const w = this.wins.get(id); if (w && w.titleEl.textContent !== t) w.titleEl.textContent = t; },
    focus(id) {
      const w = this.wins.get(id);
      if (!w) return;
      w.el.style.zIndex = ++this.z;
      for (const o of this.wins.values()) o.el.classList.toggle('focus', o === w);
    },
    /* sheet state on phones: 'min' (title bar only), 'half' or 'full' */
    setSheet(id, state) {
      const w = this.wins.get(id);
      if (!w || !isPhone()) return;
      w.el.dataset.sheet = state;
      this.syncSheets();
    },
    syncSheets() {
      const ui = document.getElementById('ui');
      if (!ui) return;
      const phone = isPhone();
      let full = false;
      for (const w of this.wins.values()) if (w.el.dataset.sheet === 'full') full = true;
      ui.classList.toggle('sheet-open', phone && this.wins.size > 0);
      ui.classList.toggle('sheet-full', phone && full);
      requestAnimationFrame(() => this.measure());
    },
    /* --bottom-ui: height of the sheet or toolbar at the bottom, for notes and framing;
       --top-ui: bottom edge of the top bar or the tutorial banner, for toasts */
    measure() {
      const root = document.documentElement;
      let b = 0, t = 0;
      if (isPhone()) {
        const vh = window.innerHeight;
        if (!root.classList.contains('land')) for (const w of this.wins.values()) b = Math.max(b, vh - w.el.getBoundingClientRect().top);
        /* the toolbar stays at the bottom, with or without a sheet above it */
        const tb = document.getElementById('toolbar');
        if (tb && tb.offsetHeight) b = Math.max(b, vh - tb.getBoundingClientRect().top);
        const tut = document.getElementById('tutorial');
        if (tut && !tut.hidden && tut.offsetHeight) t = tut.getBoundingClientRect().bottom;
      }
      const set = (k, px) => { const v = px ? Math.round(px) + 'px' : ''; if (root.style.getPropertyValue(k) !== v) root.style.setProperty(k, v); };
      set('--bottom-ui', b);
      set('--top-ui', t);
    },
    onTool(name) {
      /* the path constructor shows in the paths window only while it is the tool in hand */
      const was = this._lastTool;
      this._lastTool = name;
      if (was !== name && (name === 'pathbuild' || was === 'pathbuild') && this.wins.has('paths')) this.rebuild('paths');
      if (!isPhone()) { for (const w of this.wins.values()) this._toolActs(w); return; }
      for (const w of this.wins.values()) {
        if (MAP_TOOLS.has(name)) w.el.dataset.sheet = 'min';
        else if (((name === 'trackbuild' && w.id === 'tracks') || (name === 'pathbuild' && w.id === 'paths')) && w.el.dataset.sheet === 'min') w.el.dataset.sheet = 'half';
        this._toolActs(w);
      }
      this.syncSheets();
    },
    /* a rotate button in the title bar while a rotatable tool is active (phones have no R key) */
    _toolActs(w) {
      const t = MX.Tools && MX.Tools.current;
      const want = !!(t && t.rotate && isPhone());
      if (!!w.actsEl.firstChild === want) return;
      clear(w.actsEl);
      if (want) w.actsEl.append(h('button', { class: 'win-rot', title: 'Girar (R)', 'aria-label': 'Girar', onclick: (e) => { e.stopPropagation(); const c = MX.Tools.current; if (c && c.rotate) c.rotate(); } }, icon('rotate')));
    },
    close(id, quiet) {
      const w = this.wins.get(id);
      if (!w) return false;
      w.el.remove();
      this.wins.delete(id);
      if (w.o.onClose) w.o.onClose();
      MX.Bus.emit('ui:close', id);
      /* on phones closing the sheet also ends the tool it was driving */
      if (isPhone() && !quiet && !this.wins.size && MX.Tools && MX.Tools.current && MX.Tools.current.name !== 'select') MX.Tools.select();
      this.syncSheets();
      return true;
    },
    closeTop() {
      let top = null;
      for (const w of this.wins.values()) if (!top || +w.el.style.zIndex > +top.el.style.zIndex) top = w;
      if (top) { this.close(top.id); return true; }
      return false;
    },
    closeAll() { for (const id of Array.from(this.wins.keys())) this.close(id, true); this.syncSheets(); },
    tick(dt) {
      for (const w of this.wins.values()) {
        w.t -= dt;
        if (w.t > 0 || !w.update) continue;
        w.t = w.o.every || 0.4;
        try { w.update(); } catch (e) { console.error('[win ' + w.id + ']', e); }
      }
      this.measureT -= dt;
      if (this.measureT <= 0) { this.measureT = 0.3; this.measure(); }
    },
    _drag(w, handle) {
      let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false, sheetDrag = false;
      handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        dragging = true; sheetDrag = isPhone(); sx = e.clientX; sy = e.clientY; ox = w.el.offsetLeft; oy = w.el.offsetTop;
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      handle.addEventListener('pointermove', (e) => {
        if (!dragging || sheetDrag) return;
        const vw = this.root.clientWidth, vh = this.root.clientHeight;
        const x = Math.max(-w.el.offsetWidth + 80, Math.min(vw - 80, ox + e.clientX - sx));
        const y = Math.max(this.topLimit(), Math.min(vh - 40, oy + e.clientY - sy));
        w.el.style.left = x + 'px'; w.el.style.top = y + 'px';
      });
      const end = (e) => {
        if (!dragging) return;
        dragging = false;
        if (sheetDrag) {
          /* tap folds or unfolds; a swipe up or down steps between min, half and full */
          const dy = (e && e.clientY != null ? e.clientY : sy) - sy;
          if (e && e.clientX != null) this.eatClick(e.clientX, e.clientY);
          const st = w.el.dataset.sheet || 'half';
          const land = document.documentElement.classList.contains('land');
          if (Math.abs(dy) < 12 || land) this.setSheet(w.id, st === 'min' ? 'half' : 'min');
          else if (dy > 0) this.setSheet(w.id, st === 'full' ? 'half' : 'min');
          else this.setSheet(w.id, st === 'min' ? 'half' : 'full');
          return;
        }
        this.pos[w.id] = { x: w.el.offsetLeft, y: w.el.offsetTop };
        try { localStorage.setItem('mxtycoon.winpos', JSON.stringify(this.pos)); } catch (err) { /* storage unavailable */ }
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', () => { dragging = false; });
    }
  };

  /* Keyed list renderer: rebuild children only when the key changes. */
  function keyed(container, key, build) {
    if (container._key === key) return false;
    container._key = key;
    clear(container);
    build(container);
    return true;
  }

  MX.WM = WM;
  MX.UIKeyed = keyed;
})(window.MX);
