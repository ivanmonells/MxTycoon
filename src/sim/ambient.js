/* MX Tycoon - ambient systems: weather, random events with decisions,
   sponsorship offers and marketing campaigns. */
(function (MX) {
  'use strict';
  const U = MX.U, Cat = MX.Catalog;

  class Ambient {
    constructor(g) {
      this.g = g;
      this.eventCooldown = 12;
      this.offerCooldown = 10;
      this.pending = [];   // open decisions {id, title, text, options:[{label, key}], expires}
      this.nextDecision = 1;
      this.log = [];
    }
    /* ---------------- weather ---------------- */
    rollWeather() {
      const g = this.g, m = g.date().month, rng = g.rng;
      const rain = Cat.seasonRain[m], heat = Cat.seasonHeat[m];
      const r = rng.next();
      let w;
      if (r < rain * 0.25) w = 'storm';
      else if (r < rain) w = 'rain';
      else if (r < rain + heat) w = 'heat';
      else if (r < rain + heat + 0.25) w = 'cloudy';
      else w = 'sunny';
      this.setWeather(w, rng.int(1, w === 'storm' ? 2 : 4));
    }
    setWeather(w, days) {
      const g = this.g;
      const prev = g.weather;
      g.weather = w; g.weatherDays = days;
      if (prev !== w) {
        const msg = { rain: 'Empieza a llover: el barro hará la pista más lenta y técnica.', storm: '¡Tormenta! Muchos visitantes se quedarán en casa.', heat: 'Ola de calor: el público tendrá mucha sed.', sunny: 'Vuelve el sol.', cloudy: 'Día nublado.' }[w];
        if (w !== 'cloudy' && w !== 'sunny') g.notify(msg, 'weather');
        else if (prev === 'rain' || prev === 'storm') g.notify(msg, 'weather');
        MX.Bus.emit('weather', { w });
      }
    }
    daily() {
      const g = this.g;
      if (g.weatherDays > 0) g.weatherDays--;
      if (g.weatherDays <= 0) this.rollWeather();
      if (g.weather === 'storm') for (const t of g.tracks) if (t.S) t.addWear(0.01);
      /* expire decisions with their default option */
      for (const d of this.pending.slice()) if (g.day >= d.expires) this.decide(d.id, d.options[d.options.length - 1].key, true);
      if (g.mode !== 'sandbox' || true) {
        this.eventCooldown--;
        if (this.eventCooldown <= 0 && g.day > 8) {
          if (g.rng.chance(0.3)) this.randomEvent();
          this.eventCooldown = g.rng.int(5, 11);
        }
      }
      this.offerCooldown--;
      if (this.offerCooldown <= 0) {
        this.offerCooldown = g.rng.int(9, 18);
        if (g.count('office') && g.sponsors.length < 3 && g.openTracks().length) this.sponsorOffer();
      }
    }
    monthly(closed) {
      const g = this.g;
      void closed;
      for (const s of g.sponsors) {
        const def = Cat.sponsors.find(x => x.id === s.id);
        const banners = Array.from(g.world.scenery.values()).filter(o => Cat.decor[o.type] && Cat.decor[o.type].banner).length;
        if (g.rep < def.minRep * 0.8 || (s.needBanners && banners < s.needBanners)) {
          s.strikes = (s.strikes || 0) + 1;
          if (s.strikes >= 2) { s.cancelled = true; g.notify(def.name + ' rescinde el patrocinio: no se cumplen las condiciones.', 'warn'); continue; }
          g.notify(def.name + ' avisa: ' + (s.needBanners && banners < s.needBanners ? 'faltan pancartas con su logo' : 'la reputación ha caído demasiado') + '.', 'warn');
        } else s.strikes = 0;
        g.earn('patrocinio', s.pay);
        s.months--;
        if (s.months <= 0) { s.cancelled = true; g.notify('Termina el contrato con ' + def.name + '.', 'info'); }
      }
      g.sponsors = g.sponsors.filter(s => !s.cancelled);
    }
    update(dt) { void dt; }

    /* ---------------- decisions ---------------- */
    ask(title, text, options, days, meta) {
      const d = { id: this.nextDecision++, title, text, options, expires: this.g.day + (days || 5), meta: meta || {} };
      this.pending.push(d);
      MX.Bus.emit('dialog', d);
      return d;
    }
    decide(id, key, auto) {
      const g = this.g;
      const d = this.pending.find(x => x.id === id);
      if (!d) return;
      this.pending = this.pending.filter(x => x !== d);
      const fn = this.handlers[d.meta.kind];
      if (fn) fn.call(this, key, d, auto);
      MX.Bus.emit('dialog:closed', d);
      void g;
    }

    /* ---------------- sponsorship ---------------- */
    sponsorOffer() {
      const g = this.g;
      const active = new Set(g.sponsors.map(s => s.id));
      const pool = Cat.sponsors.filter(s => !active.has(s.id) && g.rep >= s.minRep);
      if (!pool.length) return;
      const sp = g.rng.pick(pool);
      const pay = Math.round(g.rng.range(sp.pay[0], sp.pay[1]) * (1 + g.rep / 1500) / 50) * 50;
      const months = g.rng.int(4, 12);
      const needBanners = g.rng.chance(0.5) ? g.rng.int(1, 3) : 0;
      const text = sp.name + ' (' + sp.kind.toLowerCase() + ') ofrece ' + U.fmtMoney(pay) + ' al mes durante ' + months + ' meses' +
        (needBanners ? ' si colocas ' + needBanners + ' pancarta' + (needBanners > 1 ? 's' : '') + ' de patrocinio' : '') + ' y mantienes la reputación.';
      this.ask('Oferta de patrocinio', text, [{ label: 'Aceptar', key: 'yes' }, { label: 'Rechazar', key: 'no' }], 6, { kind: 'sponsor', sp: sp.id, pay, months, needBanners });
    }

    /* ---------------- marketing ---------------- */
    startCampaign(id, weeks) {
      const g = this.g;
      const def = Cat.marketing.find(m => m.id === id);
      if (!def) return { ok: false, reason: 'Desconocida' };
      if (!g.count('office')) return { ok: false, reason: 'Necesitas una oficina para gestionar el marketing' };
      if (!g.isUnlocked(def)) return { ok: false, reason: 'Bloqueada: investiga marketing digital' };
      if (g.marketing.some(m => m.id === id)) return { ok: false, reason: 'Ya está en marcha' };
      if (!g.canAfford(def.week)) return { ok: false, reason: 'No tienes suficiente dinero' };
      g.marketing.push({ id, days: weeks * 7, total: weeks * 7 });
      g.notify('Campaña lanzada: ' + def.name + ' (' + weeks + ' semana' + (weeks > 1 ? 's' : '') + ').', 'info');
      MX.Bus.emit('marketing', {});
      return { ok: true };
    }
    stopCampaign(id) { this.g.marketing = this.g.marketing.filter(m => m.id !== id); MX.Bus.emit('marketing', {}); }

    /* ---------------- random events ---------------- */
    randomEvent() {
      const g = this.g, rng = g.rng;
      const open = g.openTracks();
      const best = open.reduce((a, t) => Math.max(a, t.stats ? t.stats.rating : 0), 0);
      const avgSafety = open.length ? open.reduce((a, t) => a + (t.stats ? t.stats.safety : 0.5), 0) / open.length : 1;
      const list = [];
      const add = (w, fn) => list.push({ w, fn });
      if (open.length) add(2, () => {
        const name = rng.pick(Cat.names.intlFirst) + ' ' + rng.pick(Cat.names.intlLast);
        g.flags.visitorBoost = 0.5; g.flags.visitorBoostDays = 3; g.flags.merchBoost = 0.3; g.flags.merchDays = 3;
        g.notify('¡Visita estrella! El piloto profesional ' + name + ' entrena hoy en tu circuito. Llegan fans de toda la comarca.', 'event');
      });
      if (open.length && g.day > 20) add(1.4, () => {
        if (!g.count('medical') || avgSafety < 0.5) {
          g.spend('multas', 3000); g.rep = Math.max(0, g.rep - 20);
          g.notify('Inspección de seguridad: ' + (!g.count('medical') ? 'no hay puesto médico' : 'el circuito no es seguro') + '. Multa de 3.000 €.', 'danger');
        } else { g.prestige += 10; g.notify('Inspección de seguridad superada con nota. Tu reputación mejora.', 'success'); }
      });
      if (open.length) add(1.2, () => {
        if ((g.injuriesMonth || 0) > 2) { g.rep = Math.max(0, g.rep - 15); g.notify('Un vídeo de una caída brutal en tu circuito se hace viral. Mala publicidad.', 'warn'); }
        else { g.prestige += 15; g.notify('Un vídeo de un salto espectacular en tu circuito se hace viral. ¡Todo el mundo habla de ti!', 'event'); }
      });
      if (g.staff.some(s => s.role === 'crew')) add(1, () => this.ask('Avería en la maquinaria', 'El tractor de pista se ha roto. Repararlo cuesta 2.000 €. Si no, los operarios no podrán trabajar en unos días.',
        [{ label: 'Reparar (2.000 €)', key: 'pay' }, { label: 'Esperar', key: 'wait' }], 4, { kind: 'machinery' }));
      if (g.day > 30) add(0.9, () => this.ask('Queja vecinal por ruido', 'Los vecinos se quejan del ruido de las motos. Puedes instalar barreras acústicas por 1.500 € o arriesgarte a una campaña en contra.',
        [{ label: 'Instalar barreras (1.500 €)', key: 'pay' }, { label: 'Ignorar', key: 'ignore' }], 5, { kind: 'noise' }));
      add(0.8, () => { this.setWeather('heat', 4); });
      add(0.7, () => { this.setWeather('storm', 2); for (const t of g.tracks) { t.moisture = Math.min(1, t.moisture + 0.5); if (t.S) t.addWear(0.06); } });
      if (g.count('shop')) add(0.6, () => { const loss = rng.int(5, 20) * 100; g.spend('otros', loss); g.notify('Robo en la tienda de merchandising: pierdes ' + U.fmtMoney(loss) + '.', 'danger'); });
      add(1, () => { g.flags.visitorBoost = 0.4; g.flags.visitorBoostDays = 4; g.notify('Fiestas del pueblo: llegan más visitantes durante unos días.', 'event'); });
      add(0.6, () => { g.flags.maintMul = 1.2; g.flags.maintDays = 28; g.notify('Sube el precio del combustible: el mantenimiento será un 20% más caro este mes.', 'warn'); });
      if (open.length) add(1, () => {
        if (best >= 6.5) { g.prestige += 25; g.notify('La revista "Barro y Gloria" pone tu circuito por las nubes: ' + U.fmt1(best) + '/10.', 'event'); }
        else if (best < 4) { g.rep = Math.max(0, g.rep - 15); g.notify('La revista "Barro y Gloria" critica tu circuito: "aburrido y sin alma".', 'warn'); }
        else { g.prestige += 8; g.notify('La revista "Barro y Gloria" publica una reseña correcta de tu circuito.', 'info'); }
      });
      if ((g.injuriesMonth || 0) >= 3) add(1.5, () => { g.spend('multas', 5000); g.notify('Un piloto lesionado te demanda. Pagas 5.000 € en un acuerdo.', 'danger'); });
      if (g.count('school') || open.some(t => t.stats && t.stats.diff < 4)) add(0.8, () => { g.earn('subvenciones', 10000); g.notify('El ayuntamiento te concede una subvención de 10.000 € por fomentar el deporte base.', 'money'); });
      if (open.some(t => t.stats && t.stats.rating >= 6 && t.stats.diff >= 5)) add(0.8, () => this.ask('Un equipo oficial quiere alquilar la pista', 'Un equipo de fábrica pagaría 3.500 € por entrenar en exclusiva un día. Los pilotos normales no podrán rodar ese día.',
        [{ label: 'Aceptar (+3.500 €)', key: 'yes' }, { label: 'Rechazar', key: 'no' }], 4, { kind: 'team' }));
      if (!list.length) return;
      rng.weighted(list, (x) => x.w).fn();
    }
  }

  Ambient.prototype.handlers = {
    sponsor(key, d) {
      const g = this.g;
      if (key !== 'yes') return;
      const m = d.meta;
      if (g.sponsors.length >= 3) { g.notify('Ya tienes 3 patrocinadores.', 'warn'); return; }
      g.sponsors.push({ id: m.sp, pay: m.pay, months: m.months, needBanners: m.needBanners, since: g.day });
      const def = Cat.sponsors.find(x => x.id === m.sp);
      g.notify('Contrato firmado con ' + def.name + ': ' + U.fmtMoney(m.pay) + ' al mes.', 'money');
      /* existing banners show the new logo */
      for (const o of g.world.scenery.values()) if (Cat.decor[o.type] && Cat.decor[o.type].banner && !o.sponsor) o.sponsor = m.sp;
      g.world.sceneryVer++;
      MX.Bus.emit('sponsors', {});
    },
    machinery(key) {
      const g = this.g;
      if (key === 'pay') { g.spend('mantenimiento', 2000); g.notify('Tractor reparado.', 'info'); }
      else { for (const s of g.staff) if (s.role === 'crew') { s.state = 'idle'; s.timer = 5 * MX.C.DAY_SEC; } g.notify('Los operarios de pista estarán parados unos días.', 'warn'); }
    },
    noise(key) {
      const g = this.g;
      if (key === 'pay') { g.spend('construccion', 1500); g.notify('Barreras acústicas instaladas. Los vecinos están contentos.', 'info'); }
      else { g.rep = Math.max(0, g.rep - 15); g.notify('Los vecinos montan una campaña contra el circuito. Pierdes reputación.', 'warn'); }
    },
    team(key) {
      const g = this.g;
      if (key !== 'yes') return;
      g.earn('eventos', 3500);
      g.flags.teamDay = 1;
      g.prestige += 6;
      g.notify('El equipo oficial entrena en tu circuito. +3.500 €', 'money');
    }
  };

  Ambient.prototype.serialize = function () { return { eventCooldown: this.eventCooldown, offerCooldown: this.offerCooldown, pending: this.pending, nextDecision: this.nextDecision }; };
  Ambient.deserialize = function (g, d) {
    const a = new Ambient(g);
    if (d) Object.assign(a, { eventCooldown: d.eventCooldown, offerCooldown: d.offerCooldown, pending: d.pending || [], nextDecision: d.nextDecision || 1 });
    return a;
  };
  MX.Ambient = Ambient;
})(window.MX);
