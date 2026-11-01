/* MX Tycoon - interactive tutorial: each step watches the real game state. */
(function (MX) {
  'use strict';
  const { h, icon, clear } = MX.DOM;

  class Tutorial {
    constructor(app, root) {
      this.app = app; this.root = root;
      this.el = h('div', { id: 'tutorial', hidden: true, role: 'dialog', 'aria-label': 'Tutorial' });
      root.appendChild(this.el);
      this.i = -1; this.active = false; this.hl = null;
      MX.Bus.on('ui:open', (id) => { if (id.startsWith('agent-')) this.openedAgent = true; });
      this.steps = this.defineSteps();
    }
    defineSteps() {
      const app = this.app;
      const g = () => app.game;
      const tr = () => g().selectedTrack || g().tracks[0];
      const hasFeat = (t, pred) => t && t.features.some(pred);
      return [
        { title: '¡Bienvenido a MX Tycoon!', text: 'Tienes un terreno junto a la carretera y 150.000 €. Tu misión: convertirlo en un complejo de motocross de referencia mundial. Te enseño lo básico en un par de minutos.', next: 'Empezar' },
        { title: 'La cámara', text: 'Arrastra con el botón derecho del ratón (o usa WASD) para moverte y la rueda para acercarte. Q y E giran la vista. En pantallas táctiles, arrastra con un dedo y pellizca.', init: () => { const c = app.renderer.cam; this.c0 = [c.tx, c.tz, c.targetZoom]; },
          tp: 'Arrastra con un dedo para moverte y pellizca para acercarte. Los botones de la derecha giran la vista y acercan o alejan.',
          check: () => { const c = app.renderer.cam; return Math.hypot(c.tx - this.c0[0], c.tz - this.c0[1]) > 12 || Math.abs(c.targetZoom - this.c0[2]) > 1.5; } },
        { title: 'Tu primer circuito', text: 'Abre el menú Circuitos en la barra inferior.', target: '[data-id="tracks"]', check: () => MX.WM.isOpen('tracks') },
        { title: 'Coloca la salida', text: 'Pulsa «Nuevo circuito» y haz clic en tu terreno, la zona clara, para colocar la parrilla de salida. En pantallas táctiles, toca para verla y vuelve a tocar encima. La tecla R o el botón «Girar» la orientan.', tp: 'Pulsa «Nuevo circuito»: aparece la parrilla. Arrástrala o toca tu terreno (la zona clara) para moverla y pulsa «Colocar». El botón amarillo la gira.', target: '#win-tracks-new', check: () => g().tracks.some(t => t.pieces && t.pieces.length) || g().tracks.some(t => t.closed) },
        { title: 'Construye pieza a pieza', text: 'Como en los clásicos: elige la dirección (recta o curva cerrada, media o abierta) y la pendiente, y pulsa «Construir pieza». La pieza fantasma te enseña dónde irá. Mete un salto y la «Línea de meta» desde la pestaña «Especiales». Vuelve hasta la salida para cerrar el circuito, o pulsa «Cerrar automáticamente».', tp: 'Elige dirección y pendiente y pulsa «Construir»: la pieza fantasma enseña dónde irá. En «Especiales» tienes saltos y la meta. Vuelve a la salida o pulsa «Cerrar» para completar la vuelta.', target: '#bld-build', check: () => g().tracks.some(t => t.closed) },
        { title: 'Salida y meta', text: 'Tu circuito necesita la línea de meta. Si no la pusiste al construir, colócala en la pestaña Elementos haciendo clic o tocando sobre una recta.', tp: 'Falta la línea de meta: en la pestaña Elementos elígela, toca una recta del circuito y pulsa «Colocar».', check: () => hasFeat(tr(), f => f.type === 'start') && hasFeat(tr(), f => f.type === 'finish') },
        { title: 'Hora de volar', text: 'Añade al menos un salto: un tabletop en una recta es perfecto para empezar. Los saltos atraen pilotos y público.', check: () => hasFeat(tr(), f => MX.Catalog.features[f.type].group === 'jump') },
        { title: 'El paddock', text: 'Abre Construir → Pilotos y coloca un Paddock tocando la carretera (la franja gris del borde inferior). Ahí aparcan las furgonetas de los pilotos. Pulsa R para girarlo.', tp: 'Abre Construir → Pilotos y elige el Paddock. Arrástralo hasta que toque la carretera (la franja gris del borde) y pulsa «Colocar». El botón amarillo lo gira.', target: '[data-id="build"]', check: () => g().buildingsOf('paddock').some(b => g().doorTiles(b, 'road').length) },
        { title: 'Servicios para el público', text: 'En Construir → Público: pon una Taquilla y acceso, un Aparcamiento tocando la carretera y unos Baños.', target: '[data-id="build"]', check: () => g().count('entrance') && g().count('parking') && g().count('toilets') },
        { title: 'Caminos', text: 'Abre Caminos y une el aparcamiento con la taquilla, y la taquilla con los baños y con una zona junto a la pista. El público solo anda por caminos. Se construyen como un circuito: toca dónde empieza, elige girar o seguir recto, subir o bajar, y pulsa «Construir».', tp: 'Abre Caminos, elige un camino y toca la casilla donde empieza, junto al aparcamiento. Como en el constructor de circuitos, elige girar o seguir recto y pulsa «Construir» para alargarlo hasta la taquilla y los baños.', target: '[data-id="paths"]',
          check: () => { const G = g(); if (G.fieldsDirty) G.rebuildFields(); const lot = G.buildingsOf('parking')[0]; const ent = G.buildingsOf('entrance')[0]; if (!lot || !ent) return false; return G.doorTiles(lot, 'path').some(t => G.fieldReach('entrance', t.tx, t.tz)) && G.doorTiles(ent, 'path').some(t => G.fieldReach('toilet', t.tx, t.tz)); } },
        { title: '¡Abrimos!', text: 'Vuelve a Circuitos, pulsa «Validar» para revisar que todo está bien y luego «Abrir al público». Si algo falla, la lista te dice qué arreglar.', target: '[data-id="tracks"]', check: () => g().tracks.some(t => t.state === 'open') },
        { title: 'Llegan los pilotos', text: 'Las furgonetas ya vienen por la carretera. Cuando veas un piloto en pista, haz clic sobre él para ver sus datos y pulsa «Seguir».', init: () => { this.openedAgent = false; this.t0 = performance.now(); }, check: () => this.openedAgent || performance.now() - this.t0 > 90000 },
        { title: 'A crecer', text: 'Acelera el tiempo con los botones de velocidad de arriba. Contrata personal (un limpiador y un mecánico), mira Finanzas y sigue los Objetivos. Organiza carreras para ganar prestigio. ¡Suerte!', tp: 'Acelera el tiempo con el botón de velocidad de arriba. En «Gestión» contrata personal, mira Finanzas y sigue los Objetivos. Organiza carreras para ganar prestigio. ¡Suerte!', target: '.tb-speed', next: 'Terminar' }
      ];
    }
    start(force) {
      if (!force && MX.Save.flag('tutorialDone') === '1') return;
      this.active = true; this.i = -1;
      this.el.hidden = false;
      this.root.classList.add('tut-on');
      this.next();
    }
    stop(done) {
      this.active = false; this.el.hidden = true; this.highlight(null);
      this.root.classList.remove('tut-on');
      this.remeasure();
      if (done) MX.Save.flag('tutorialDone', '1');
    }
    next() {
      this.i++;
      if (this.i >= this.steps.length) { this.stop(true); this.app.game && this.app.game.notify('Tutorial completado. ¡Ahora el complejo es tuyo!', 'success'); return; }
      const s = this.steps[this.i];
      if (s.init) s.init();
      this.el.classList.remove('min'); this.root.classList.remove('tut-min');
      this.render();
      MX.Audio && MX.Audio.sfx('notify');
    }
    render() {
      const s = this.steps[this.i];
      const phone = document.documentElement.classList.contains('phone');
      clear(this.el);
      this.el.classList.remove('more');
      this.el.append(
        h('div', { class: 'tut-h', title: 'Plegar o desplegar', onclick: () => { const m = this.el.classList.toggle('min'); this.root.classList.toggle('tut-min', m); this.remeasure(); } },
          icon('objectives'), h('b', null, s.title), h('small', null, 'Paso ' + (this.i + 1) + ' de ' + this.steps.length),
          h('button', { class: 'tut-skip', title: 'Saltar el tutorial', onclick: (e) => { e.stopPropagation(); this.stop(true); } }, 'Saltar'),
          h('i', { class: 'tut-fold', 'aria-hidden': 'true' })),
        h('p', { title: 'Ver el texto completo', onclick: () => { this.el.classList.toggle('more'); this.remeasure(); } }, phone && s.tp ? s.tp : s.text),
        s.check ? h('div', { class: 'tut-wait' }, 'Hazlo y seguimos…') : h('div', { class: 'row gap' }, h('button', { class: 'btn primary', onclick: () => this.next() }, s.next || 'Siguiente')));
      this.highlight(s.target);
      this.remeasure();
    }
    /* toasts on phones sit under the banner, so its height matters */
    remeasure() { requestAnimationFrame(() => MX.WM.measure()); }
    highlight(sel) {
      if (this.hl) this.hl.classList.remove('tut-hl');
      this.hl = null;
      if (!sel) return;
      const el = document.querySelector(sel);
      if (el) { el.classList.add('tut-hl'); this.hl = el; }
    }
    update() {
      if (!this.active || !this.app.game) return;
      const s = this.steps[this.i];
      if (s && s.target && !this.hl) this.highlight(s.target);
      if (s && s.check) { let ok = false; try { ok = s.check(); } catch (e) { ok = false; } if (ok) this.next(); }
    }
  }
  MX.Tutorial = Tutorial;
})(window.MX);
