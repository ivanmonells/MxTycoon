/* MX Tycoon - floating window manager. Panels build their DOM once and return an
   update() function that the manager calls a few times per second. */
(function (MX) {
  'use strict';
  const { h, icon, clear } = MX.DOM;

  const WM = {
    root: null, wins: new Map(), z: 20, pos: {},
    init(root) {
      this.root = root;
      try { this.pos = JSON.parse(localStorage.getItem('mxtycoon.winpos') || '{}'); } catch (e) { this.pos = {}; }
    },
    isOpen(id) { return this.wins.has(id); },
    get(id) { return this.wins.get(id); },
    open(id, o) {
      if (this.wins.has(id)) {
        const w = this.wins.get(id);
        if (o.rebuild) this._build(w, o);
        this.focus(id);
        return w;
      }
      const el = h('div', { class: 'win ' + (o.cls || ''), role: 'dialog', 'aria-label': o.title });
      const title = h('div', { class: 'win-title' },
        o.icon ? icon(o.icon, 'win-ic') : null,
        h('span', { class: 'win-t' }, o.title),
        h('span', { class: 'win-stripes' }),
        h('button', { class: 'win-x', title: 'Cerrar (Esc)', 'aria-label': 'Cerrar', onclick: () => this.close(id) }, icon('close'))
      );
      const tabs = h('div', { class: 'win-tabs' });
      const body = h('div', { class: 'win-body' });
      el.append(title, tabs, body);
      this.root.appendChild(el);
      const w = { id, el, body, tabsEl: tabs, titleEl: title.querySelector('.win-t'), o, update: null, t: 0 };
      this.wins.set(id, w);
      const vw = this.root.clientWidth || window.innerWidth, vh = this.root.clientHeight || window.innerHeight;
      const width = Math.min(o.width || 360, vw - 16);
      el.style.width = width + 'px';
      const saved = this.pos[id];
      let x = saved ? saved.x : (o.x != null ? o.x : Math.max(8, Math.min(vw - width - 8, 70 + (this.wins.size % 5) * 28)));
      let y = saved ? saved.y : (o.y != null ? o.y : 64 + (this.wins.size % 5) * 24);
      x = Math.max(4, Math.min(x, vw - 80)); y = Math.max(48, Math.min(y, vh - 60));
      if (vw < 640) { x = 8; el.style.width = (vw - 16) + 'px'; }
      el.style.left = x + 'px'; el.style.top = y + 'px';
      this._drag(w, title);
      el.addEventListener('pointerdown', () => this.focus(id));
      this._build(w, o);
      this.focus(id);
      MX.Bus.emit('ui:open', id);
      return w;
    },
    _build(w, o) {
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
    },
    setTab(id, tab) { const w = this.wins.get(id); if (w) { w.tab = tab; this._build(w, w.o); } },
    rebuild(id) { const w = this.wins.get(id); if (w) this._build(w, w.o); },
    setTitle(id, t) { const w = this.wins.get(id); if (w) w.titleEl.textContent = t; },
    focus(id) {
      const w = this.wins.get(id);
      if (!w) return;
      w.el.style.zIndex = ++this.z;
      for (const o of this.wins.values()) o.el.classList.toggle('focus', o === w);
    },
    close(id) {
      const w = this.wins.get(id);
      if (!w) return false;
      w.el.remove();
      this.wins.delete(id);
      if (w.o.onClose) w.o.onClose();
      MX.Bus.emit('ui:close', id);
      return true;
    },
    closeTop() {
      let top = null;
      for (const w of this.wins.values()) if (!top || +w.el.style.zIndex > +top.el.style.zIndex) top = w;
      if (top) { this.close(top.id); return true; }
      return false;
    },
    closeAll() { for (const id of Array.from(this.wins.keys())) this.close(id); },
    tick(dt) {
      for (const w of this.wins.values()) {
        w.t -= dt;
        if (w.t > 0 || !w.update) continue;
        w.t = w.o.every || 0.4;
        try { w.update(); } catch (e) { console.error('[win ' + w.id + ']', e); }
      }
    },
    _drag(w, handle) {
      let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
      handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.win-x')) return;
        dragging = true; sx = e.clientX; sy = e.clientY; ox = w.el.offsetLeft; oy = w.el.offsetTop;
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const vw = this.root.clientWidth, vh = this.root.clientHeight;
        const x = Math.max(-w.el.offsetWidth + 80, Math.min(vw - 80, ox + e.clientX - sx));
        const y = Math.max(44, Math.min(vh - 40, oy + e.clientY - sy));
        w.el.style.left = x + 'px'; w.el.style.top = y + 'px';
      });
      const end = () => {
        if (!dragging) return;
        dragging = false;
        this.pos[w.id] = { x: w.el.offsetLeft, y: w.el.offsetTop };
        try { localStorage.setItem('mxtycoon.winpos', JSON.stringify(this.pos)); } catch (e) { /* storage unavailable */ }
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
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
