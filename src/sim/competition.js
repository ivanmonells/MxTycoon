/* MX Tycoon - competitions: requirements, scheduling, live races with a start
   gate, laps, positions, overtakes, results, revenue and prestige. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U, Cat = MX.Catalog, A = MX.Agents;

  const REQ_LABELS = {
    paddock: ['Paddocks', 'paddock'], toilets: ['Baños', 'toilets'], medical: ['Puestos médicos', 'medical'], office: ['Oficina', 'office'],
    tower: ['Torre de control', 'tower'], workshop: ['Talleres', 'workshop'], boxes: ['Boxes', 'boxes'], podium: ['Podio', 'podium'],
    parking: ['Aparcamientos', 'parking'], screen: ['Pantallas gigantes', 'screen'], camping: ['Zonas de acampada', 'camping']
  };

  class Competition {
    constructor(g) { this.g = g; this.scheduled = []; this.history = []; this.nextId = 1; }

    requirements(type, track) {
      const g = this.g, def = Cat.events[type];
      const out = [];
      const add = (label, have, need, ok, fmt) => out.push({ label, have, need, ok: ok != null ? ok : have >= need, fmt });
      if (g.mode !== 'sandbox') add('Reputación', Math.round(g.rep), def.rep);
      if (def.unlock && g.mode !== 'sandbox') add('Categoría desbloqueada', g.isUnlocked(def) ? 1 : 0, 1, g.isUnlocked(def), 'bool');
      if (track && type !== 'training') {
        const st = track.stats;
        add('Circuito abierto', track.state === 'open' ? 1 : 0, 1, track.state === 'open', 'bool');
        add('Longitud (m)', Math.round(track.length), def.minLen);
        if (st) add('Dificultad ' + def.diff[0] + ' a ' + def.diff[1], U.fmt1(st.diff), def.diff[0] + '-' + def.diff[1], st.diff >= def.diff[0] && st.diff <= def.diff[1], 'range');
        if (def.reqs.safety) add('Seguridad', st ? Math.round(st.safety * 100) : 0, Math.round(def.reqs.safety * 100), st && st.safety >= def.reqs.safety);
      }
      for (const k in def.reqs) {
        if (k === 'safety') continue;
        const need = def.reqs[k];
        if (REQ_LABELS[k]) add(REQ_LABELS[k][0], g.count(REQ_LABELS[k][1]), need);
        else if (k === 'medic') add('Sanitarios', g.staff.filter(s => s.role === 'medic').length, need);
        else if (k === 'marshal') add('Comisarios', g.staff.filter(s => s.role === 'marshal').length, need);
        else if (k === 'seats') add('Asientos en gradas', g.seatsTotal(), need);
        else if (k === 'foodtruck') add('Puestos de comida', g.count('foodtruck') + g.count('restaurant'), need);
      }
      return out;
    }
    lapsFor(type, track) {
      const def = Cat.events[type];
      const lap = track.stats ? track.stats.lapExp : track.length / 12;
      return U.clamp(Math.round(200 / Math.max(15, lap)), def.laps[0], def.laps[1]);
    }
    capacity() {
      const g = this.g;
      let viewTiles = g.viewTiles ? g.viewTiles.size : 0;
      const camping = g.count('camping');
      return Math.round(150 + g.seatsTotal() * 9 + viewTiles * 14 + camping * 300 + g.parkingCapacity() * 22);
    }
    expectedAttendance(type, ticket) {
      const g = this.g, def = Cat.events[type];
      if (!def.demand) return 0;
      const repF = U.clamp(Math.pow(Math.max(1, g.rep) / Math.max(1, def.rep), 1.3), 0.3, 2.2);
      const priceF = U.clamp(1.3 - 0.5 * (ticket / def.ticket - 1), 0.25, 1.5);
      const mk = 1 + g.marketingBoost('visitors') * 0.8;
      const demand = def.demand * repF * priceF * mk;
      return Math.round(Math.min(demand, this.capacity()));
    }
    nextDates() {
      const g = this.g;
      const out = [];
      for (let d = g.day + 4; out.length < 4 && d < g.day + 40; d++) if (d % 7 === 5 || d % 7 === 6) out.push(d);
      return out;
    }
    canSchedule(type, track, day) {
      const reqs = this.requirements(type, track);
      const fails = reqs.filter(r => !r.ok);
      if (this.scheduled.some(e => e.day === day)) fails.push({ label: 'Ya hay un evento ese día' });
      if (this.g.race) fails.push({ label: 'Hay una carrera en curso' });
      return { ok: !fails.length, fails, reqs };
    }
    schedule(type, trackId, day, ticket) {
      const g = this.g, def = Cat.events[type];
      const track = trackId != null ? g.trackById(trackId) : null;
      const chk = this.canSchedule(type, track, day);
      if (!chk.ok) return { ok: false, reason: chk.fails[0].label };
      if (!g.canAfford(def.cost)) return { ok: false, reason: 'No tienes suficiente dinero' };
      g.spend('eventos', def.cost);
      const ev = { id: this.nextId++, type, trackId, day, ticket: ticket || def.ticket || 0, state: 'scheduled' };
      this.scheduled.push(ev);
      g.notify(def.name + ' programado para el ' + g.dateText(day) + '.', 'event');
      MX.Bus.emit('events', {});
      return { ok: true, ev };
    }
    cancel(id) {
      const g = this.g;
      const ev = this.scheduled.find(e => e.id === id);
      if (!ev) return;
      this.scheduled = this.scheduled.filter(e => e !== ev);
      g.econ.refund('eventos', Math.round(Cat.events[ev.type].cost * 0.5));
      g.notify('Evento cancelado. Recuperas la mitad de la inversión.', 'warn');
      MX.Bus.emit('events', {});
    }
    daily() {
      const g = this.g;
      for (const ev of this.scheduled.slice()) {
        if (ev.day === g.day + 2) g.notify('Faltan 2 días para: ' + Cat.events[ev.type].name + '.', 'event');
        if (ev.day <= g.day) {
          this.scheduled = this.scheduled.filter(e => e !== ev);
          this.start(ev);
        }
      }
    }
    start(ev) {
      const g = this.g, def = Cat.events[ev.type];
      if (ev.type === 'training') {
        g.flags.trainingDays = 2;
        g.notify('¡Jornada de entrenamiento! Hoy vienen el doble de pilotos.', 'event');
        this.history.push({ type: ev.type, day: g.day, quality: 60, attendance: 0, revenue: 0 });
        return;
      }
      const track = g.trackById(ev.trackId);
      if (!track || track.state !== 'open' || g.race) {
        g.notify(def.name + ' suspendido: el circuito no está disponible. Pierdes la inversión.', 'danger');
        this.history.push({ type: ev.type, day: g.day, quality: 0, cancelled: true });
        return;
      }
      g.race = new Race(g, ev, track);
      g.race.begin();
    }
    update(dt) { if (this.g.race) this.g.race.update(dt); }
    finished(res) {
      this.history.push(res);
      if (this.history.length > 60) this.history.shift();
      this.g.totals.events++;
      MX.Bus.emit('race:results', res);
      this.g.prog && this.g.prog.check();
    }
    serialize() { return { scheduled: this.scheduled, history: this.history, nextId: this.nextId }; }
    static deserialize(g, d) {
      const c = new Competition(g);
      if (d) Object.assign(c, { scheduled: d.scheduled || [], history: d.history || [], nextId: d.nextId || 1 });
      return c;
    }
  }

  class Race {
    constructor(g, ev, track) {
      this.g = g; this.ev = ev; this.type = ev.type; this.def = Cat.events[ev.type];
      this.trackId = track.id; this.tr = track;
      this.phase = 'gather'; this.t = 0; this.freeze = true;
      this.laps = g.comp.lapsFor(ev.type, track);
      this.ticket = ev.ticket;
      this.riders = [];
      this.finishOrder = [];
      this.order = [];
      this.overtakes = 0; this.crashes = 0; this.injuries = 0;
      this.attendance = g.comp.expectedAttendance(ev.type, ev.ticket) * (g.raining() ? 0.75 : 1) | 0;
      this.visibleTarget = U.clamp(Math.round(this.attendance / 9), 25, 280);
      this.spawned = 0;
      this.feed = [];
      this.leaderDone = false;
    }
    begin() {
      const g = this.g, def = this.def, tr = this.tr;
      /* regular riders leave the track */
      for (const r of g.riders) if (r.trackId === tr.id && !r.race) {
        if (r.state === 'ride') r.leaveTrack(g, tr);
        else if (r.state === 'wait' || r.state === 'toTrack') { r.state = 'rest'; r.timer = 6; }
      }
      g.earn('entradas', Math.round(this.attendance * this.ticket));
      g.earn('inscripciones', def.riders * def.entryFee);
      g.earn('patrocinio', Math.round(def.sponsor * (0.8 + g.rep / 1200)));
      /* race riders appear on the start pad */
      const rng = g.rng;
      const tier = def.tier;
      const usedNum = new Set(), usedName = new Set();
      for (let i = 0; i < def.riders; i++) {
        const sk = rng.range(def.skill[0], def.skill[1]);
        const bike = sk < 40 ? Cat.bikes[1] : rng.pick([Cat.bikes[2], Cat.bikes[3], Cat.bikes[4]]);
        let r = null;
        for (let k = 0; k < 8; k++) { r = new A.Rider(g, rng, { skill: sk, bike, intl: tier >= 4 && rng.chance(0.7), race: this }); if (!usedName.has(r.name)) break; }
        usedName.add(r.name);
        let num = rng.int(1, 99);
        while (usedNum.has(num)) num = num % 99 + 1;
        usedNum.add(num);
        r.race = this; r.num = num; r.state = 'grid';
        r.attr.aggr = U.clamp(r.attr.aggr + 0.15, 0, 1);
        this.riders.push(r);
        g.riders.push(r);
      }
      this.riders.sort((a, b) => b.attr.skill - a.attr.skill);
      this.placeGrid();
      tr.gateDown = false;
      g.notify('¡Hoy se celebra el ' + def.name + '! Asistencia: ' + U.fmtInt(this.attendance) + ' espectadores.', 'event');
      MX.Bus.emit('race:begin', { race: this });
    }
    placeGrid() {
      const tr = this.tr, S = tr.S;
      const i0 = tr.sIndex(tr.startS);
      const w = S.w[i0];
      const perRow = Math.max(4, Math.floor(w / 1.25));
      this.riders.forEach((r, k) => {
        const row = Math.floor(k / perRow), col = k % perRow;
        const s = tr.wrapS(tr.startS - 1.4 - row * 2.6);
        const lane = (col - (perRow - 1) / 2) * (w - 1.2) / Math.max(1, perRow - 1);
        const p = tr.poseAt(s, lane, {});
        r.gridS = s; r.gridLane = lane;
        r.x = p.x; r.z = p.z; r.y = p.yRide; r.yaw = p.hdg;
      });
    }
    update(dt) {
      const g = this.g;
      this.t += dt;
      if (this.phase === 'gather') {
        const want = Math.min(this.visibleTarget, Math.floor(this.visibleTarget * this.t / 18));
        while (this.spawned < want) { this.spawned++; g.spawnVisitorGroup(true); }
        if (this.t > 20) { this.phase = 'grid'; this.t = 0; g.notify('Pilotos en parrilla. ¡Cartel de 30 segundos!', 'event'); MX.Bus.emit('race:grid', {}); }
      } else if (this.phase === 'grid') {
        if (this.t > 9) {
          this.phase = 'race'; this.t = 0; this.tr.gateDown = true;
          for (const r of this.riders) {
            r.joinTrack(g, this.tr, r.gridS, r.gridLane, 0.3);
            r.raceDist = 0; r.lastS = r.gridS; r.laps = 0; r.lapT0 = null; r.raceLaps = [];
          }
          this.startT = g.time;
          this.finishOffset = U.mod(this.tr.finishS - this.tr.startS, this.tr.length);
          MX.Bus.emit('race:start', { race: this });
          g.notify('¡Cae la parrilla! Comienza la carrera a ' + this.laps + ' vueltas.', 'event');
        }
      } else if (this.phase === 'race') {
        this.track(dt);
      } else if (this.phase === 'podium') {
        if (this.t > 9) this.end();
      }
    }
    /* progress, laps, positions and finish logic */
    track(dt) {
      const g = this.g, L = this.tr.length;
      for (const r of this.riders) {
        if (!r.m || r.done) continue;
        const ds = U.mod(r.m.s - r.lastS, L);
        if (ds < L / 2) r.raceDist += ds;
        r.lastS = r.m.s;
        /* crossing the finish line */
        const k = Math.floor((r.raceDist - this.finishOffset) / L);
        if (r.raceDist >= this.finishOffset && k >= 0 && k !== r.lastK) {
          r.lastK = k;
          if (r.lapT0 != null) {
            const lt = g.time - r.lapT0;
            r.raceLaps.push(lt);
            if (!r.bestRace || lt < r.bestRace) r.bestRace = lt;
            if (!this.fastest || lt < this.fastest.t) this.fastest = { t: lt, name: r.name };
          }
          r.lapT0 = g.time;
          r.lapsDone = k;
          if (this.leaderDone || k >= this.laps) {
            r.done = true; r.finishT = g.time - this.startT;
            this.finishOrder.push(r);
            if (!this.leaderDone) {
              this.leaderDone = true; this.leaderT = g.time;
              g.notify('¡' + r.name + ' gana el ' + this.def.name + '!', 'success', { agent: r });
              MX.Bus.emit('race:winner', { rider: r });
              r.think(g, 'race_win', true);
            }
            r.m.crawl = 6;
          }
        }
        if (r.m.crash && !r.crashCounted) { r.crashCounted = true; this.crashes++; if (r.m.crash.injured) this.injuries++; }
        if (!r.m.crash) r.crashCounted = false;
      }
      /* positions and overtakes */
      this.tickT = (this.tickT || 0) + dt;
      if (this.tickT > 0.5) {
        this.tickT = 0;
        const order = this.standings();
        if (this.order.length) {
          const prev = new Map(this.order.map((r, i) => [r.id, i]));
          for (let i = 0; i < order.length; i++) {
            const p = prev.get(order[i].id);
            if (p != null && p > i && !order[i].done) { this.overtakes++; if (i < 3 && Math.random() < 0.5) this.pushFeed(order[i].name + ' pasa a ' + (i + 1) + 'º'); }
          }
        }
        this.order = order;
      }
      const allDone = this.riders.every(r => r.done || !r.m || (r.m.crash && r.m.crash.injured));
      if ((this.leaderDone && (allDone || g.time - this.leaderT > 40)) || this.t > 600) this.results();
    }
    pushFeed(t) { this.feed.unshift({ t, at: this.g.time }); if (this.feed.length > 6) this.feed.pop(); MX.Bus.emit('race:feed', t); }
    standings() {
      const done = this.finishOrder.slice();
      const rest = this.riders.filter(r => !r.done).sort((a, b) => (b.raceDist || 0) - (a.raceDist || 0));
      return done.concat(rest);
    }
    results() {
      const g = this.g, def = this.def;
      this.phase = 'podium'; this.t = 0;
      const order = this.standings();
      const first = this.finishOrder[0], second = this.finishOrder[1];
      const gap = first && second ? second.finishT - first.finishT : 15;
      const cap = g.comp.capacity();
      const reqs = g.comp.requirements(this.type, this.tr);
      const reqOk = reqs.filter(r => r.ok).length / Math.max(1, reqs.length);
      let q = 0;
      q += U.clamp(1 - gap / 10, 0, 1) * 18;
      q += U.clamp(this.overtakes / (this.riders.length * 1.2), 0, 1) * 18;
      q += U.clamp(this.crashes / this.riders.length, 0, 0.4) * 15 - this.injuries * 7;
      q += U.clamp(this.attendance / Math.max(1, cap), 0, 1) * 12;
      q += reqOk * 12 + g.facilityScore() * 6;
      q += (this.tr.stats ? this.tr.stats.rating / 10 : 0.5) * 20;
      q += g.raining() ? 2 : 0;
      q = Math.round(U.clamp(q, 0, 100));
      const tv = Math.round(def.tv * (0.5 + q / 100));
      if (tv) g.earn('eventos', tv);
      const extraFood = Math.max(0, this.attendance - this.spawned * 2.5) * 4.2 * g.econ.prices.food;
      g.econ.earn('comida', Math.round(extraFood)); g.econ.spend('suministros', Math.round(extraFood * 0.36));
      const extraMerch = Math.max(0, this.attendance - this.spawned * 2.5) * 0.12 * 18 * g.econ.prices.merch;
      g.econ.earn('merch', Math.round(extraMerch)); g.econ.spend('suministros', Math.round(extraMerch * 0.45));
      g.spend('premios', def.prize);
      const gain = Math.round(def.repGain * (q / 100));
      g.prestige += gain;
      g.rep = Math.min(1000, g.rep + gain * 0.35);
      g.flags.merchBoost = 0.25; g.flags.merchDays = 5;
      const revenue = Math.round(this.attendance * this.ticket + def.riders * def.entryFee + def.sponsor * (0.8 + g.rep / 1200) + tv + extraFood + extraMerch);
      const res = {
        type: this.type, name: def.name, trackId: this.trackId, trackName: this.tr.name, day: g.day, laps: this.laps,
        quality: q, attendance: this.attendance, revenue, cost: def.cost + def.prize, repGain: gain, tv,
        overtakes: this.overtakes, crashes: this.crashes, injuries: this.injuries,
        fastest: this.fastest || null,
        standings: order.slice(0, 12).map((r, i) => ({ pos: i + 1, name: r.name, num: r.num, best: r.bestRace || 0, time: r.finishT || 0, done: !!r.done, laps: r.lapsDone || 0 }))
      };
      this.res = res;
      this.podium = this.finishOrder.slice(0, 3);
      for (const r of this.riders) { if (r.m) r.m.crawl = 5; }
      g.notify(def.name + ' terminado. Valoración: ' + q + '/100. Ingresos: ' + U.fmtMoney(revenue) + '.', q >= 60 ? 'success' : 'info');
      g.comp.finished(res);
    }
    end() {
      const g = this.g;
      for (const r of this.riders) r.dead = true;
      this.tr.gateDown = false;
      for (const v of g.visitors) if (v.event) { v.maxStay = Math.min(v.maxStay, v.timeIn + g.rng.range(10, 60)); v.event = false; }
      this.freeze = false;
      g.race = null;
      MX.Bus.emit('race:end', { res: this.res });
    }
    /* called by riders on each finish-line crossing (legacy hook) */
    onLap() {}
  }

  MX.Competition = Competition;
  MX.Race = Race;
  void C;
})(window.MX);
