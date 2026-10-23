/* MX Tycoon - progression: career chapters, research and monthly challenges. */
(function (MX) {
  'use strict';
  const U = MX.U, Cat = MX.Catalog;

  const CHALLENGES = [
    { id: 'laps', name: 'Pista caliente', desc: (t) => 'Completa ' + t + ' vueltas este mes.', target: (g) => Math.max(120, Math.round(g.totals.laps * 0.05 / 10) * 10 + 150), reward: 4000, metric: (g, c) => g.totals.laps - c.base },
    { id: 'visitors', name: 'Lleno total', desc: (t) => 'Recibe ' + t + ' espectadores este mes.', target: (g) => Math.max(150, Math.round((g.totals.visitors || 0) * 0.02 / 10) * 10 + 200), reward: 5000, metric: (g, c) => g.totals.visitors - c.base },
    { id: 'noinjury', name: 'Mes sin lesiones', desc: () => 'Termina el mes sin ningún piloto lesionado.', target: () => 1, reward: 4500, endOnly: true, metric: (g) => (g.injuriesMonth || 0) === 0 ? 1 : 0, failFast: (g) => (g.injuriesMonth || 0) > 0 },
    { id: 'passes', name: 'Fidelización', desc: (t) => 'Llega a ' + t + ' abonados de temporada.', target: (g) => g.passHolders.length + 4, reward: 5500, metric: (g) => g.passHolders.length },
    { id: 'clean', name: 'Parque impecable', desc: () => 'Acaba el mes con los caminos limpios (menos de 10 papeles).', target: () => 1, reward: 3000, endOnly: true, metric: (g) => { let s = 0; for (let i = 0; i < g.world.litter.length; i++) s += g.world.litter[i]; return s < 10 ? 1 : 0; } },
    { id: 'profit', name: 'Caja fuerte', desc: (t) => 'Gana ' + U.fmtMoney(t) + ' este mes.', target: (g) => Math.max(5000, Math.round(g.econ.history.length ? Math.max(0, g.econ.profit(g.econ.history[g.econ.history.length - 1])) * 1.2 / 1000 : 5) * 1000), reward: 6000, endOnly: true, metric: (g) => g.econ.profit() },
    { id: 'happy', name: 'Público feliz', desc: () => 'Ten 40 o más visitantes y una satisfacción media de 70.', target: () => 70, reward: 4000, metric: (g) => g.visitors.length >= 40 ? Math.round(g.visitors.reduce((a, v) => a + v.satisfaction(), 0) / g.visitors.length) : 0 }
  ];

  class Progression {
    constructor(g) {
      this.g = g;
      this.objIndex = 0;
      this.done = [];
      this.research = { current: null, progress: 0, done: [], queue: [] };
      this.challenges = [];
      this.objStartMonth = 0;
      this.victory = false;
    }
    get objective() { return MX.Catalog.objectives[this.objIndex] || null; }
    /* progress bars for the current objective */
    progress() {
      const g = this.g, o = this.objective;
      if (!o) return [];
      const h = g.comp ? g.comp.history : [];
      const best = (type) => h.filter(e => e.type === type).reduce((a, e) => Math.max(a, e.quality), 0);
      const open = g.openTracks();
      switch (o.id) {
        case 'first_track': return [{ label: 'Circuitos abiertos', v: open.length, t: 1 }];
        case 'first_riders': return [{ label: 'Pilotos recibidos', v: g.totals.riders, t: 25 }, { label: 'Taller mecánico', v: g.count('workshop'), t: 1 }];
        case 'atmosphere': return [{ label: 'Visitantes a la vez', v: g.visitors.length, t: 40 }, { label: 'Reputación', v: Math.round(g.rep), t: 150 }];
        case 'amateur': return [{ label: 'Mejor carrera amateur', v: best('amateur'), t: 55 }];
        case 'profit': {
          const hist = g.econ.history.filter(m => m.index >= this.objStartMonth);
          const bestP = hist.reduce((a, m) => Math.max(a, g.econ.profit(m)), 0);
          return [{ label: 'Mejor beneficio mensual', v: Math.round(Math.max(bestP, g.econ.profit())), t: 10000, money: true }];
        }
        case 'regional': return [{ label: 'Reputación', v: Math.round(g.rep), t: 350 }, { label: 'Mejor campeonato regional', v: best('regional'), t: 60 }];
        case 'homolog': {
          let rank = 0;
          for (const t of open) if (t.stats) rank = Math.max(rank, MX.TrackAnalyzer.HOMOLOG_RANK[t.stats.homolog] || 0);
          return [{ label: 'Homologación (3 = nacional)', v: rank, t: 3 }];
        }
        case 'national': return [{ label: 'Mejor campeonato nacional', v: best('national'), t: 65 }];
        case 'world': return [{ label: 'Reputación', v: Math.round(g.rep), t: 700 }, { label: 'Visitantes a la vez', v: g.visitors.length, t: 250 }, { label: 'Eventos internacionales', v: h.filter(e => e.type === 'international').length, t: 1 }];
        case 'gp': return [{ label: 'Mejor Gran Premio', v: best('gp'), t: 70 }];
      }
      return [];
    }
    check() {
      const g = this.g, o = this.objective;
      if (!o || g.mode === 'sandbox') return;
      const prog = this.progress();
      let ok = prog.length && prog.every(p => p.v >= p.t);
      if (o.id === 'profit') {
        const hist = g.econ.history.filter(m => m.index >= this.objStartMonth);
        ok = hist.some(m => g.econ.profit(m) >= 10000);
      }
      if (!ok) return;
      this.complete(o);
    }
    complete(o) {
      const g = this.g;
      this.done.push({ id: o.id, day: g.day });
      const r = o.reward || {};
      if (r.money) g.earn('subvenciones', r.money);
      if (r.unlock) for (const k of r.unlock) g.unlock(k);
      if (r.parcels) {
        g.world.setExpansionLevel(g.world.expansionLevel + r.parcels);
        g.world.ownerVer++;
      }
      g.prestige += 8;
      this.objIndex++;
      this.objStartMonth = g.date().monthIndex;
      const next = this.objective;
      let msg = '¡Objetivo cumplido: ' + o.name + '!';
      if (r.money) msg += ' Premio: ' + U.fmtMoney(r.money) + '.';
      if (r.parcels) msg += ' Nuevos terrenos a la venta.';
      if (r.unlock && r.unlock.length) msg += ' Nuevas competiciones disponibles.';
      g.notify(msg, 'success');
      MX.Bus.emit('objective', { done: o, next });
      if (!next) { this.victory = true; MX.Bus.emit('victory', {}); }
    }

    /* ---------- research ---------- */
    researchDef(id) { return Cat.research.find(r => r.id === id); }
    researchAvailable(id) {
      const d = this.researchDef(id);
      if (!d || this.research.done.includes(id)) return false;
      return !(d.req || []).some(r => !this.research.done.includes(r));
    }
    startResearch(id) {
      if (!this.researchAvailable(id)) return { ok: false, reason: 'No disponible' };
      if (this.research.current === id) return { ok: false, reason: 'Ya se está investigando' };
      if (this.research.current) {
        if (!this.research.queue.includes(id)) this.research.queue.push(id);
        return { ok: true, queued: true };
      }
      this.research.current = id; this.research.progress = 0;
      MX.Bus.emit('research', {});
      return { ok: true };
    }
    cancelResearch(id) {
      if (this.research.current === id) { this.research.current = null; this.research.progress = 0; this._next(); }
      else this.research.queue = this.research.queue.filter(x => x !== id);
      MX.Bus.emit('research', {});
    }
    _next() {
      while (this.research.queue.length) {
        const id = this.research.queue.shift();
        if (this.researchAvailable(id)) { this.research.current = id; this.research.progress = 0; return; }
      }
    }
    daily() {
      const g = this.g;
      const R = this.research;
      if (R.current) {
        const d = this.researchDef(R.current);
        const perDay = d.cost / d.days;
        if (g.mode === 'sandbox' || g.econ.money >= perDay) {
          g.spend('investigacion', perDay);
          R.progress += g.count('office') ? 1.25 : 1;
          if (R.progress >= d.days) {
            R.done.push(d.id);
            g.unlock('research:' + d.id);
            g.notify('Investigación terminada: ' + d.name + '. ' + d.desc, 'success');
            R.current = null; R.progress = 0;
            this._next();
            MX.Bus.emit('research', { done: d });
          }
        }
      }
      this.check();
      this.updateChallenges(false);
    }
    monthly(closed) {
      void closed;
      this.updateChallenges(true);
      this.check();
    }

    /* ---------- monthly challenges ---------- */
    updateChallenges(monthEnd) {
      const g = this.g;
      if (g.mode === 'sandbox') return;
      if (!g.openTracks().length) return;
      for (const c of this.challenges) {
        if (c.state !== 'active') continue;
        const def = CHALLENGES.find(x => x.id === c.id);
        const v = def.metric(g, c);
        c.value = v;
        if (def.failFast && def.failFast(g)) { c.state = 'failed'; continue; }
        if ((!def.endOnly && v >= c.target) || (monthEnd && def.endOnly && v >= c.target)) {
          c.state = 'done';
          g.earn('subvenciones', def.reward);
          g.notify('¡Desafío superado: ' + def.name + '! +' + U.fmtMoney(def.reward), 'success');
          MX.Bus.emit('challenge', c);
        } else if (monthEnd) c.state = 'failed';
      }
      if (monthEnd || !this.challenges.some(c => c.state === 'active')) {
        if (monthEnd || !this.challenges.length) this.newChallenges();
      }
    }
    newChallenges() {
      const g = this.g;
      const pool = CHALLENGES.slice();
      g.rng.shuffle(pool);
      this.challenges = pool.slice(0, 2).map(def => {
        const c = { id: def.id, state: 'active', target: def.target(g), value: 0, base: 0 };
        if (def.id === 'laps') c.base = g.totals.laps;
        if (def.id === 'visitors') c.base = g.totals.visitors;
        return c;
      });
      MX.Bus.emit('challenge', null);
    }
    challengeText(c) { const def = CHALLENGES.find(x => x.id === c.id); return { name: def.name, desc: def.desc(c.target), reward: def.reward }; }

    serialize() { return { objIndex: this.objIndex, done: this.done, research: this.research, challenges: this.challenges, objStartMonth: this.objStartMonth, victory: this.victory }; }
    static deserialize(g, d) {
      const p = new Progression(g);
      if (d) Object.assign(p, { objIndex: d.objIndex, done: d.done || [], research: Object.assign(p.research, d.research || {}), challenges: d.challenges || [], objStartMonth: d.objStartMonth || 0, victory: !!d.victory });
      return p;
    }
  }
  Progression.CHALLENGES = CHALLENGES;
  MX.Progression = Progression;
})(window.MX);
