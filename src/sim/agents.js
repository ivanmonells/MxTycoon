/* MX Tycoon - agents: spectators, riders, staff and vehicles with needs, thoughts,
   flow-field navigation and the behaviours that make the park feel alive. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U, Cat = MX.Catalog, PF = MX.Pathing;
  const T = C.TILE;
  let UID = 1;
  function setUid(n) { UID = Math.max(UID, n); }

  const SKIN = [[255, 219, 186], [241, 194, 160], [224, 172, 130], [198, 140, 98], [160, 110, 70], [118, 78, 50]];
  const HAIR = [[40, 30, 25], [70, 45, 25], [110, 70, 35], [200, 160, 90], [140, 60, 30], [30, 30, 30], [180, 180, 180]];
  const SHIRT = [[229, 57, 53], [30, 136, 229], [253, 216, 53], [67, 160, 71], [255, 255, 255], [255, 112, 67], [142, 36, 170], [33, 33, 33], [0, 172, 193], [244, 143, 177], [121, 85, 72]];
  const PANTS = [[40, 53, 147], [33, 33, 33], [93, 64, 55], [117, 117, 117], [55, 71, 79], [26, 35, 126], [197, 202, 233]];
  const TEAM = [[255, 106, 19], [230, 40, 40], [30, 110, 230], [250, 210, 30], [40, 170, 70], [245, 245, 245], [130, 50, 190], [20, 20, 20], [0, 180, 200]];

  function personName(rng) { return rng.pick(Cat.names.first) + ' ' + rng.pick(Cat.names.last); }
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  /* a make for a vehicle class, the popular ones more often */
  function pickBrand(rng, cls) {
    const ids = Cat.brandsFor(cls);
    if (!ids.length) return null;
    let t = rng.next() * ids.reduce((a, k) => a + Cat.brands[k].w, 0);
    for (const k of ids) { t -= Cat.brands[k].w; if (t <= 0) return k; }
    return ids[ids.length - 1];
  }
  function brandFromName(name, cls) {
    const ids = Cat.brandsFor(cls);
    if (!ids.length) return null;
    let h = 7;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return ids[h % ids.length];
  }

  /* ---------------- shared helpers ---------------- */
  function tileCenter(tx, tz) { return [tx * T + T / 2, tz * T + T / 2]; }
  function setWaypoint(a, tx, tz) {
    a.ntx = tx; a.ntz = tz;
    const c = tileCenter(tx, tz);
    a.px = c[0] + a.ox; a.pz = c[1] + a.oz;
  }
  function moveToward(a, speed, dt) {
    const dx = a.px - a.x, dz = a.pz - a.z;
    const d = Math.hypot(dx, dz);
    const step = speed * dt;
    if (d <= step || d < 0.01) { a.x = a.px; a.z = a.pz; return true; }
    a.x += dx / d * step; a.z += dz / d * step;
    a.yaw = U.angleLerp(a.yaw, Math.atan2(dz, dx), Math.min(1, dt * 10));
    a.walked = (a.walked || 0) + step;
    return false;
  }
  /* Follow a flow field one waypoint at a time. Returns 'moving' | 'arrived' | 'stuck'. */
  function followField(a, field, speed, dt, rng) {
    if (!field) return 'stuck';
    if (a.ntx == null) { a.ntx = a.tx; a.ntz = a.tz; setWaypoint(a, a.tx, a.tz); }
    if (moveToward(a, speed, dt)) {
      a.tx = a.ntx; a.tz = a.ntz;
      const d = field.get(a.tx, a.tz);
      if (d === 0) return 'arrived';
      if (d < 0) return 'stuck';
      const nxt = PF.nextStep(field, a.tx, a.tz, rng);
      if (nxt < 0) return 'stuck';
      setWaypoint(a, nxt % field.N, (nxt / field.N) | 0);
    }
    return 'moving';
  }

  class Thinker {
    think(g, key, force) {
      const def = Cat.thoughts[key];
      if (!def) return;
      const last = this._last || (this._last = {});
      if (!force && last[key] && g.time - last[key] < 40) return;
      last[key] = g.time;
      const text = def.t[Math.floor(Math.random() * def.t.length)];
      this.thoughts.unshift({ key, text, day: g.day });
      if (this.thoughts.length > 6) this.thoughts.pop();
      this.happy = U.clamp(this.happy + def.mood * 2.5, 0, 100);
      this.bubble = { key, text, t: 3.2 };
      g.recordThought(key, def.mood);
    }
  }

  /* ================================================================ */
  class Visitor extends Thinker {
    constructor(g, rng, opts) {
      super();
      this.id = UID++; this.kind = 'visitor';
      this.name = personName(rng);
      this.kid = rng.chance(0.18);
      this.cols = [rng.pick(SHIRT), rng.pick(PANTS), rng.pick(HAIR), rng.pick(SKIN)];
      this.x = opts.x; this.z = opts.z; this.tx = opts.tx; this.tz = opts.tz; this.ntx = null;
      this.ox = rng.range(-1.1, 1.1); this.oz = rng.range(-1.1, 1.1);
      this.yaw = 0; this.y = 0;
      this.state = 'arrive';
      this.hunger = rng.range(0, 35); this.thirst = rng.range(0, 35); this.bladder = rng.range(0, 30); this.energy = rng.range(70, 100);
      this.happy = rng.range(58, 82); this.fun = 40;
      this.money = Math.round(rng.range(25, 90) * (opts.event ? 1.4 : 1));
      this.spent = 0; this.timeIn = 0; this.maxStay = rng.range(110, 260) * (opts.event ? 1.5 : 1);
      this.loveJumps = rng.range(0.4, 1.0); this.loveRace = rng.range(0.3, 1.0);
      this.thoughts = []; this.bubble = null;
      this.carId = opts.carId || null;
      this.event = !!opts.event;
      this.litterT = 0;
      this.timer = 0; this.decideT = rng.range(0.5, 2);
      this.target = null; this.goal = null;
      this.seat = null; this.inside = null;
      this.stuckT = 0; this.watchT = 0;
      this.walked = 0;
    }
    update(g, dt, rng) {
      this.timeIn += dt;
      if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
      const heat = g.weather === 'heat' ? 1.7 : 1;
      this.hunger = Math.min(100, this.hunger + dt * 0.26);
      this.thirst = Math.min(100, this.thirst + dt * 0.32 * heat);
      this.bladder = Math.min(100, this.bladder + dt * 0.16);
      const seated = this.state === 'seat' || this.state === 'bench' || this.state === 'inside';
      this.energy = U.clamp(this.energy + dt * (seated ? 1.6 : -0.13), 0, 100);
      if (this.bladder > 88) this.happy = Math.max(0, this.happy - dt * 0.8);
      if (this.hunger > 90 || this.thirst > 92) this.happy = Math.max(0, this.happy - dt * 0.4);
      if (this.energy < 12) this.happy = Math.max(0, this.happy - dt * 0.3);
      if (g.raining() && !(this.inside || (this.seat && this.seat.covered))) {
        this.happy = Math.max(0, this.happy - dt * 0.25 * g.rainAmount());
        if (rng.chance(dt * 0.02)) this.think(g, 'rain');
      }
      switch (this.state) {
        case 'arrive': return this.uArrive(g, dt, rng);
        case 'walk': return this.uWalk(g, dt, rng);
        case 'inside': return this.uInside(g, dt, rng);
        case 'watch': return this.uWatch(g, dt, rng);
        case 'seat': return this.uSeat(g, dt, rng);
        case 'bench': return this.uBench(g, dt, rng);
        case 'wander': return this.uWander(g, dt, rng);
        case 'leave': return this.uLeave(g, dt, rng);
      }
    }
    speed() { return (this.kid ? 2.0 : 2.3) * (this.energy < 25 ? 0.8 : 1); }
    uArrive(g, dt, rng) {
      const f = g.fields.get('entrance');
      const r = followField(this, f, this.speed(), dt, rng);
      if (r === 'arrived') {
        /* event guests are a visible sample of the official attendance, already ticketed */
        const price = this.event ? 0 : g.econ.prices.ticket;
        const value = g.ticketValue(this.event);
        if (!this.event && price > value * (1.15 + rng.range(-0.1, 0.2))) {
          this.think(g, 'expensive_ticket', true);
          g.stats.refusedTicket++;
          this.state = 'leave'; this.ntx = null;
          return;
        }
        if (price > 0) { g.earn('entradas', price, this.x, this.z, true); this.spent += price; }
        if (price < value * 0.7) this.think(g, 'good_value');
        this.paid = price;
        g.stats.visitorsToday++; g.stats.visitorsTotal++; g.totals.visitors++;
        this.state = 'wander'; this.timer = rng.range(2, 6);
        this.decideT = 0.5;
      } else if (r === 'stuck') {
        this.stuckT += dt;
        if (this.stuckT > 6) { this.think(g, 'lost', true); this.state = 'leave'; this.ntx = null; }
      }
    }
    /* choose the next activity */
    decide(g, rng) {
      if (this.timeIn > this.maxStay || this.money < 3 || this.happy < 16) return this.goLeave(g);
      const P = g.econ.prices;
      const foodP = Math.round(7 * P.food), drinkP = Math.round(3 * P.food);
      if (this.bladder > 68) { if (this.goTo(g, 'toilet', rng)) return; this.think(g, 'no_toilet'); }
      if (this.hunger > 60 && this.money >= foodP) { if (this.goTo(g, 'food', rng)) { this.want = 'food'; return; } this.think(g, 'no_food'); }
      if (this.thirst > 56 && this.money >= drinkP) { if (this.goTo(g, 'food', rng)) { this.want = 'drink'; return; } this.think(g, 'thirsty'); }
      if (this.energy < 32) { if (this.goTo(g, 'seat', rng)) return; this.think(g, 'tired'); if (g.openTracks().length) this.think(g, 'no_seats'); }
      if (this.money > 24 * P.merch && this.happy > 55 && rng.chance(0.12)) { if (this.goTo(g, 'shop', rng)) return; }
      if (this.kid && this.fun < 80 && rng.chance(0.3) && this.goTo(g, 'play', rng)) return;
      if (g.openTracks().length || g.race) {
        if (rng.chance(0.25) && this.goTo(g, 'seat', rng, true)) return;
        if (this.goTo(g, 'view', rng)) return;
      }
      if (g.camping && this.event && rng.chance(0.05) && this.goTo(g, 'camping', rng)) return;
      this.state = 'wander'; this.timer = rng.range(5, 12);
    }
    goTo(g, key, rng, quiet) {
      const f = g.fields.get(key);
      if (!f || f.get(this.tx, this.tz) < 0) return false;
      this.goal = key; this.state = 'walk'; this.stuckT = 0;
      if (this.ntx == null || (this.x === this.px && this.z === this.pz)) { this.ntx = null; }
      void quiet; void rng;
      return true;
    }
    goLeave(g) {
      this.state = 'leave'; this.goal = 'exit'; this.ntx = null;
      if (this.happy > 60) this.think(g, 'leave_happy', true);
      else if (this.happy < 35) this.think(g, 'leave_angry', true);
    }
    uWalk(g, dt, rng) {
      const f = g.fields.get(this.goal);
      const r = followField(this, f, this.speed(), dt, rng);
      if (r === 'arrived') this.arrive(g, rng);
      else if (r === 'stuck') {
        this.stuckT += dt;
        if (this.stuckT > 3) { this.state = 'wander'; this.timer = 4; }
      }
      this.litter(g, dt, rng);
    }
    arrive(g, rng) {
      const key = this.goal;
      const P = g.econ.prices;
      if (key === 'view') {
        const crowd = g.countOnTile(this.tx, this.tz);
        if (crowd > 5) { this.think(g, 'crowded'); this.state = 'wander'; this.timer = 3; return; }
        this.state = 'watch'; this.watchT = rng.range(18, 40); this.seen = 0;
        const t = g.nearestTrackPoint(this.x, this.z);
        if (t) this.yaw = Math.atan2(t.z - this.z, t.x - this.x);
        return;
      }
      if (key === 'seat') {
        const b = g.buildingAtDoor(this.tx, this.tz, ['grandstand', 'grandstand_cov', 'restaurant', 'restaurant_big']);
        if (b && (b.type === 'grandstand' || b.type === 'grandstand_cov')) {
          const s = g.takeSeat(b, this);
          if (s) { this.state = 'seat'; this.seat = s; this.watchT = rng.range(25, 60); this.seen = 0; return; }
          this.think(g, 'no_seats'); this.state = 'wander'; this.timer = 3; return;
        }
        if (b && (b.type === 'restaurant' || b.type === 'restaurant_big')) { this.enter(g, b, rng.range(6, 10), rng); return; }
        if (g.world.addon[g.world.idx(this.tx, this.tz)] === MX.World.ADDON.BENCH) {
          this.state = 'bench'; this.timer = rng.range(10, 20); return;
        }
        this.state = 'wander'; this.timer = 2; return;
      }
      const types = { food: ['foodtruck', 'restaurant', 'restaurant_big'], toilet: ['toilets'], shop: ['shop', 'megastore'], camping: ['camping'], play: ['playground'] }[key];
      const b = types ? g.buildingAtDoor(this.tx, this.tz, types) : null;
      if (!b) { this.state = 'wander'; this.timer = 2; return; }
      const spend = Cat.buildings[b.type].spend || 1;
      if (key === 'food') {
        const drink = this.want === 'drink';
        const price = Math.round((drink ? 3 : 7) * P.food * (drink ? 1 : spend));
        if (this.money < price) { this.state = 'wander'; this.timer = 2; return; }
        if (P.food > 1.45 && rng.chance(0.5)) { this.think(g, 'expensive_food'); if (rng.chance(0.4)) { this.state = 'wander'; this.timer = 3; return; } }
        this.money -= price; this.spent += price;
        g.sale(b, 'comida', price, 0.38);
        if (drink) { this.thirst = Math.max(0, this.thirst - 70); this.bladder = Math.min(100, this.bladder + 18); }
        else { this.hunger = Math.max(0, this.hunger - 75); this.thirst = Math.max(0, this.thirst - 15); this.litterT = rng.range(10, 35); }
        if (!drink && this.money >= Math.round(3 * P.food) && this.thirst > 30) {
          const dp = Math.round(3 * P.food); this.money -= dp; this.spent += dp; g.sale(b, 'comida', dp, 0.35); this.thirst = 0;
        }
        if (b.type === 'restaurant_big' && !drink) { this.happy = Math.min(100, this.happy + 6); if (rng.chance(0.3)) this.think(g, 'big_meal'); }
        this.enter(g, b, b.type === 'restaurant_big' ? rng.range(8, 14) : b.type === 'restaurant' ? rng.range(5, 9) : rng.range(2, 4), rng);
      } else if (key === 'play') {
        this.fun = Math.min(100, this.fun + 30); this.happy = Math.min(100, this.happy + 8);
        this.maxStay += 25;
        if (rng.chance(0.4)) this.think(g, 'kids_fun');
        this.enter(g, b, rng.range(10, 20), rng);
      } else if (key === 'toilet') {
        if (b.clean < 35) this.think(g, 'toilet_dirty');
        b.clean = Math.max(0, b.clean - 0.6);
        this.bladder = 0;
        this.enter(g, b, rng.range(2.5, 4), rng);
      } else if (key === 'shop') {
        const price = Math.round(20 * P.merch * spend);
        if (this.money >= price && rng.chance((b.type === 'megastore' ? 0.7 : 0.55) + g.merchBoost())) {
          this.money -= price; this.spent += price; g.sale(b, 'merch', price, 0.45);
          this.think(g, 'bought_merch');
        }
        this.enter(g, b, rng.range(3, 6), rng);
      } else if (key === 'camping') {
        this.enter(g, b, rng.range(8, 14), rng);
        const fee = 12; if (this.money >= fee) { this.money -= fee; this.spent += fee; g.sale(b, 'camping', fee, 0.1); }
      }
    }
    enter(g, b, time, rng) {
      this.state = 'inside'; this.inside = b.id; this.timer = time;
      b.users = (b.users || 0) + 1;
      void g; void rng;
    }
    uInside(g, dt, rng) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const b = g.buildings.get(this.inside);
        if (b) b.users = Math.max(0, (b.users || 1) - 1);
        this.inside = null;
        this.state = 'wander'; this.timer = rng.range(1, 3);
      }
    }
    uWatch(g, dt, rng) {
      this.watchT -= dt;
      const ex = g.excitementAt(this.x, this.z);
      this.fun = U.clamp(this.fun + (ex * this.loveJumps - 0.18) * dt * 2.2, 0, 100);
      this.happy = U.clamp(this.happy + (ex - 0.12) * dt * 0.9, 0, 100);
      if (ex > 0.9 && rng.chance(dt * 0.25)) this.think(g, g.race ? 'love_race' : 'great_jump');
      if (ex < 0.05 && rng.chance(dt * 0.04)) this.think(g, g.ridersOnTracks() ? 'boring' : 'no_action');
      if (g.dustAt(this.x, this.z) > 0.6 && rng.chance(dt * 0.03)) this.think(g, 'dusty');
      this.cheer = ex > 0.9 || (g.race && ex > 0.4);
      if (this.watchT <= 0 || this.energy < 25 || this.bladder > 70 || this.hunger > 65 || this.thirst > 62) { this.cheer = false; this.state = 'wander'; this.timer = 0.5; }
    }
    uSeat(g, dt, rng) {
      this.watchT -= dt;
      const ex = g.excitementAt(this.x, this.z) * 1.25;
      this.fun = U.clamp(this.fun + (ex * this.loveJumps - 0.1) * dt * 2.4, 0, 100);
      this.happy = U.clamp(this.happy + (ex - 0.08) * dt * 1.0, 0, 100);
      if (ex > 0.9 && rng.chance(dt * 0.2)) this.think(g, g.race ? 'love_race' : 'great_view');
      this.cheer = ex > 1.0;
      if (this.watchT <= 0 || this.bladder > 75 || this.hunger > 70 || this.thirst > 66) {
        g.freeSeat(this.seat);
        const d = this.seat.door;
        this.seat = null; this.cheer = false;
        if (d) { this.tx = d[0]; this.tz = d[1]; const c = tileCenter(d[0], d[1]); this.x = c[0] + this.ox; this.z = c[1] + this.oz; }
        this.ntx = null;
        this.state = 'wander'; this.timer = 0.5;
      }
    }
    uBench(g, dt, rng) {
      this.timer -= dt;
      if (this.timer <= 0 || this.energy > 95) { this.state = 'wander'; this.timer = 0.5; }
      void g; void rng;
    }
    uWander(g, dt, rng) {
      this.timer -= dt;
      if (this.ntx == null) { this.ntx = this.tx; this.ntz = this.tz; setWaypoint(this, this.tx, this.tz); }
      if (moveToward(this, this.speed() * 0.8, dt)) {
        this.tx = this.ntx; this.tz = this.ntz;
        if (this.timer <= 0) { this.decide(g, rng); return; }
        const opts = [];
        for (const [dx, dz] of PF.DIRS) {
          const nx = this.tx + dx, nz = this.tz + dz;
          if (g.world.isWalkable(nx, nz) && !(nx === this.ptx && nz === this.ptz)) opts.push([nx, nz]);
        }
        if (!opts.length) {
          if (g.world.isWalkable(this.ptx, this.ptz)) opts.push([this.ptx, this.ptz]);
          else { this.stuckT += 1; if (this.stuckT > 8) this.goLeave(g); return; }
        }
        const c = rng.pick(opts);
        this.ptx = this.tx; this.ptz = this.tz;
        setWaypoint(this, c[0], c[1]);
        if (g.world.litter[g.world.idx(this.tx, this.tz)] > 4 && rng.chance(0.15)) this.think(g, 'dirty');
      }
      this.litter(g, dt, rng);
    }
    uLeave(g, dt, rng) {
      const f = g.fields.get('exit');
      const r = followField(this, f, this.speed(), dt, rng);
      if (r === 'arrived' || r === 'stuck') {
        this.stuckT += r === 'stuck' ? dt : 0;
        if (r === 'arrived' || this.stuckT > 5) this.dead = true;
      }
    }
    litter(g, dt, rng) {
      if (this.litterT <= 0) return;
      this.litterT -= dt;
      if (this.litterT <= 0) {
        if (g.binNear(this.tx, this.tz)) return;
        if (rng.chance(0.7) && g.world.isWalkable(this.tx, this.tz)) {
          const i = g.world.idx(this.tx, this.tz);
          g.world.litter[i] = Math.min(20, g.world.litter[i] + 1);
          g.world.litterVer++;
        }
      }
    }
    satisfaction() { return U.clamp(this.happy * 0.65 + this.fun * 0.35, 0, 100); }
    model() {
      if (this.state === 'inside') return null;
      if (this.state === 'seat' || this.state === 'bench') return 'person_sit';
      if (this.cheer && this.state === 'watch') return 'person_cheer';
      if (this.state === 'watch') return 'person_0';
      const f = Math.floor((this.walked || 0) / 0.45) % 4;
      return 'person_' + f;
    }
  }

  /* ================================================================ */
  function riderAttrs(rng, skill) {
    const j = (k) => U.clamp(Math.round(skill + rng.normal() * k), 3, 100);
    return { skill: j(8), speed: j(10), stamina: j(12), jump: j(10), aggr: U.clamp(rng.range(0.15, 0.95), 0, 1), exp: j(14), pop: U.clamp(Math.round(skill * 0.6 + rng.range(-10, 25)), 1, 100) };
  }
  function categoryOf(skill) {
    if (skill < 32) return 'principiante';
    if (skill < 56) return 'amateur';
    if (skill < 78) return 'experto';
    return 'pro';
  }
  const CAT_NAMES = { principiante: 'Principiante', amateur: 'Amateur', experto: 'Experto', pro: 'Profesional' };

  class Rider extends Thinker {
    constructor(g, rng, opts) {
      super();
      this.id = UID++; this.kind = 'rider';
      opts = opts || {};
      const skill = opts.skill != null ? opts.skill : 30;
      this.disc = opts.disc || 'mx';
      if (opts.profile) Object.assign(this, JSON.parse(JSON.stringify(opts.profile)), { id: this.id });
      else {
        this.name = opts.intl ? rng.pick(Cat.names.intlFirst) + ' ' + rng.pick(Cat.names.intlLast) : personName(rng);
        this.nick = rng.chance(0.25) ? rng.pick(Cat.names.nick) : '';
        this.attr = riderAttrs(rng, skill);
        /* each discipline brings its own machines */
        const cls = (Cat.trackTypes[this.disc] || Cat.trackTypes.mx).vehicle;
        const own = Cat.bikes.filter(b => b.vehicle === cls);
        const eligible = own.filter(b => this.attr.skill >= b.minSkill && this.attr.skill <= b.maxSkill);
        this.bikeId = (opts.bike || rng.pick(eligible.length ? eligible : own)).id;
        /* the make of the machine; many riders wear kit in its colours */
        this.brand = opts.brand || pickBrand(rng, cls);
        const team = rng.pick(TEAM), bc = this.brand ? hexRgb(Cat.brands[this.brand].main) : team;
        const kit = rng.chance(0.45) ? bc : team;
        this.cols = cls === 'car'
          ? [team, rng.pick(TEAM), rng.pick(TEAM), rng.pick(TEAM)]
          : [rng.chance(0.6) ? bc : rng.pick(TEAM), rng.pick([[30, 30, 30], [240, 240, 240], kit, rng.pick(TEAM)]), kit, rng.pick(TEAM)];
        this.num = rng.int(2, 999);
        this.passHolder = false;
      }
      this.bike = Cat.bikes.find(b => b.id === this.bikeId) || Cat.bikes[2];
      /* saves from before the makes: one from the name, always the same */
      if (this.brand === undefined) this.brand = brandFromName(this.name, this.bike.vehicle);
      this.cat = categoryOf(this.attr.skill);
      this.x = opts.x || 0; this.z = opts.z || 0; this.tx = opts.tx || 0; this.tz = opts.tz || 0; this.ntx = null;
      this.ox = rng.range(-1, 1); this.oz = rng.range(-1, 1);
      this.yaw = 0; this.y = 0;
      this.state = 'prep'; this.timer = rng.range(6, 12);
      this.happy = rng.range(60, 80); this.fun = 40;
      this.thoughts = []; this.bubble = null;
      this.m = null; this.trackId = null;
      this.lapsPlan = rng.int(3, 7); this.sessions = 0; this.maxSessions = rng.int(1, 3); this.feeOk = 40;
      this.bikeCond = rng.range(0.7, 1);
      this.vanId = opts.vanId || null;
      this.paddockId = opts.paddockId || null;
      this.race = opts.race || null;
      this.stats = { laps: 0, best: 0, crashes: 0, air: 0, clean: 0 };
      this.money = rng.range(40, 140);
      this.wantShower = false;
      this.injured = false;
      this.onFoot = false;
      this.walked = 0;
      this.stuckT = 0;
    }
    get displayName() { return this.name + (this.nick ? ' "' + this.nick + '"' : ''); }
    get veh() { return Cat.vehicles[this.bike.vehicle] || Cat.vehicles.mx; }
    /* library model of the machine and its full name (make and model) */
    get bikeModel() { return Cat.bikeModel(this.bike, this.brand); }
    get bikeName() { return Cat.bikeName(this.bike, this.brand); }
    profile() {
      return { name: this.name, nick: this.nick, attr: this.attr, bikeId: this.bikeId, brand: this.brand, cols: this.cols, num: this.num, passHolder: this.passHolder, passMonths: this.passMonths || 0, disc: this.disc };
    }
    update(g, dt, rng) {
      if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
      switch (this.state) {
        case 'prep': return this.uPrep(g, dt, rng);
        case 'toTrack': return this.uToTrack(g, dt, rng);
        case 'wait': return this.uWait(g, dt, rng);
        case 'ride': return this.uRide(g, dt, rng);
        case 'toPaddock': return this.uToPaddock(g, dt, rng);
        case 'rest': return this.uRest(g, dt, rng);
        case 'foot': return this.uFoot(g, dt, rng);
        case 'inside': return this.uInside(g, dt, rng);
        case 'carried': return;
        case 'leave': return this.uLeave(g, dt, rng);
      }
    }
    uPrep(g, dt, rng) {
      this.timer -= dt;
      if (this.timer > 0) return;
      if (this.race) { this.state = 'toTrack'; this.trackId = this.race.trackId; this.ntx = null; return; }
      const tr = g.chooseTrack(this, rng);
      if (!tr) {
        if (!g.openTracks().length) this.think(g, 'no_action', true);
        return this.goLeave(g);
      }
      this.trackId = tr.id; this.state = 'toTrack'; this.ntx = null; this.stuckT = 0;
    }
    uToTrack(g, dt, rng) {
      const tr = g.trackById(this.trackId);
      if (!tr || (!this.race && tr.state !== 'open') || !tr.entry) { this.state = 'rest'; this.timer = 4; return; }
      const f = g.fields.get('r_entry_' + tr.id);
      const r = followField(this, f, 4.5, dt, rng);
      if (r === 'arrived') {
        /* ride from the entry tile onto the track edge */
        this.state = 'wait'; this.timer = 0;
      } else if (r === 'stuck') {
        this.stuckT += dt;
        if (this.stuckT > 4) { this.stuckT = 0; this.state = 'rest'; this.timer = 5; }
      }
    }
    uWait(g, dt, rng) {
      const tr = g.trackById(this.trackId);
      if (!tr || !tr.S) { this.state = 'rest'; this.timer = 3; return; }
      const e = tr.entry;
      this.px = e.x; this.pz = e.z;
      moveToward(this, 3, dt);
      this.timer += dt;
      if (this.race) return; /* race manager places racers on the grid */
      if (tr.state !== 'open') { this.state = 'toPaddock'; this.ntx = null; return; }
      /* wait for a gap in traffic */
      if (g.trackTraffic(tr, e.s, 14) && this.timer < 12) return;
      if (g.ridersOn(tr) >= (tr.stats ? tr.stats.capacity : 12) && this.timer < 20) {
        if (this.timer > 8) this.think(g, 'crowded_track');
        return;
      }
      this.joinTrack(g, tr, e.s, e.side * (tr.S.w[e.i] * 0.5 - 1.0), 3);
    }
    joinTrack(g, tr, s, lane, v) {
      const m = MX.RiderPhysics.makeMotion(this.attr, this.bike);
      m.s = s; m.lane = lane; m.v = v; m.bikeCond = this.bikeCond;
      m.lapStart = g.time; m.laps = 0;
      m.rider = this;
      this.m = m;
      this.state = 'ride';
      this.lapsDone = 0;
      this.trackId = tr.id;
      tr.totals.riders++;
      if (!this.race) g.stats.ridersOnTrackToday++;
      this.sessionStart = g.time;
    }
    uRide(g, dt, rng) {
      const tr = g.trackById(this.trackId);
      if (!tr || !tr.S || (tr.state !== 'open' && !this.race && tr.state !== 'testing')) { this.leaveTrack(g, tr); return; }
      const m = this.m;
      const before = m.laps;
      MX.RiderPhysics.step(m, tr, dt, g.physCtx(this, tr));
      this.x = m.x; this.z = m.z; this.y = m.y; this.yaw = m.hdg;
      this.bikeCond = m.bikeCond;
      if (m.laps !== before && m.laps > 1) this.onLap(g, tr, rng);
      if (m.crash && m.crash.injured && !this.injured) { this.injured = true; g.requestMedic(this, tr); }
      if (!this.race && !m.crash) {
        const wantOut = this.lapsDone >= this.lapsPlan || m.stam < 0.28 || this.bikeCond < 0.12 || this.broken;
        if (wantOut && tr.entry) {
          const d = U.mod(m.s - tr.entry.s, tr.length);
          if (d > 0.5 && d < 6) this.leaveTrack(g, tr);
        }
      }
    }
    onLap(g, tr, rng) {
      const m = this.m;
      this.lapsDone++;
      this.stats.laps++;
      g.stats.lapsToday++; tr.totals.laps++;
      const lt = m.lastLap;
      if (lt > 4 && (!this.stats.best || lt < this.stats.best)) this.stats.best = lt;
      if (lt > 4 && (!tr.records.best || lt < tr.records.best)) {
        tr.records.best = lt; tr.records.holder = this.displayName; tr.records.day = g.day;
        if (tr.totals.laps > 10) g.notify('¡Récord de vuelta en ' + tr.name + '! ' + this.name + ' marca ' + U.fmtLap(lt), 'success', { agent: this });
      }
      /* satisfaction from the lap: airtime, flow, difficulty fit */
      const fit = g.trackFit(this, tr);
      this.fun = U.clamp(this.fun + m.airtimeLap * 2.2 + (fit - 0.5) * 8, 0, 100);
      if (fit < 0.25) this.think(g, tr.stats && tr.stats.diff > this.attr.skill / 10 ? 'too_hard' : 'too_easy');
      else if (fit > 0.75 && tr.stats && tr.stats.rating > 6) this.think(g, 'great_track');
      const wear = tr.avgWear ? tr.avgWear() : 0;
      if (wear > 0.55 && rng.chance(0.4)) this.think(g, 'bumpy');
      if (tr.dust > 0.65 && rng.chance(0.3)) this.think(g, 'dusty_track');
      if (tr.moisture > 0.7 && rng.chance(0.3)) this.think(g, 'muddy');
      /* mechanical reliability */
      const fail = (1 - this.bike.reliability) * 0.08 * (1.6 - this.bikeCond);
      if (!this.race && rng.chance(fail)) { this.broken = true; this.think(g, 'broken_bike', true); }
      if (this.race) g.race && g.race.onLap(this, lt);
    }
    leaveTrack(g, tr) {
      this.m = null;
      this.sessions++;
      this.state = 'toPaddock'; this.ntx = null; this.stuckT = 0;
      if (tr && tr.entry) {
        this.x = tr.entry.x; this.z = tr.entry.z; this.tx = tr.entry.tx; this.tz = tr.entry.tz;
      }
      this.wantShower = true;
    }
    uToPaddock(g, dt, rng) {
      const f = g.fields.get(this.homeField) || g.fields.get('r_paddock');
      const r = followField(this, f, 4.5, dt, rng);
      if (r === 'arrived' || (r === 'stuck' && (this.stuckT += dt) > 4)) {
        this.state = 'rest'; this.timer = rng.range(8, 16);
        const p = g.paddockPos(this);
        if (p) { this.x = p.x; this.z = p.z; this.tx = p.tx; this.tz = p.tz; this.yaw = p.yaw; }
        this.ntx = null;
      }
    }
    uRest(g, dt, rng) {
      this.timer -= dt;
      if (this.timer > 0) return;
      if (this.injured) return this.goLeave(g);
      if (this.broken || this.bikeCond < 0.35) {
        if (g.fieldReach('r_workshop', this.tx, this.tz) && g.workshopOpen()) return this.walkTo(g, 'r_workshop', 'workshop');
        if (this.broken) { this.think(g, 'no_workshop', true); return this.goLeave(g); }
      }
      if (this.wantShower) {
        this.wantShower = false;
        /* after a session: wash the mud off, buy spares, then a shower */
        const tr = g.trackById(this.trackId);
        const muddy = tr && (tr.moisture > 0.3 || (tr.S && Cat.surfaceOrder[tr.S.surf[0]] === 'mud'));
        if (!this.washed && (muddy || rng.chance(0.3)) && g.fieldReach('r_wash', this.tx, this.tz)) { this.washed = true; this.wantShower = true; return this.walkTo(g, 'r_wash', 'wash'); }
        if (!this.boughtParts && (this.bikeCond < 0.8 || rng.chance(0.2)) && g.fieldReach('r_parts', this.tx, this.tz)) { this.boughtParts = true; this.wantShower = true; return this.walkTo(g, 'r_parts', 'parts'); }
        if (g.fieldReach('r_shower', this.tx, this.tz)) return this.walkTo(g, 'r_shower', 'shower');
        if (g.count('showers') === 0 && rng.chance(0.6)) this.think(g, 'no_shower');
      }
      if (rng.chance(0.25) && g.fieldReach('r_food', this.tx, this.tz)) return this.walkTo(g, 'r_food', 'food');
      if (this.cat === 'principiante' && !this.schooled && g.fieldReach('r_school', this.tx, this.tz) && g.schoolOpen() && rng.chance(0.6)) return this.walkTo(g, 'r_school', 'school');
      if (this.sessions < this.maxSessions && this.happy > 40 && g.openTracks().length && this.bikeCond > 0.2) {
        /* every extra track session is paid like a new ticket (season pass holders ride free) */
        if (!this.passHolder && !this.race) {
          const fee = g.riderFeeFor(this.disc);
          if (fee > this.feeOk * 1.15 && rng.chance(0.6)) { this.think(g, 'expensive_fee', true); return this.goLeave(g); }
          if (fee > 0) g.earn('tarifas', fee, this.x, this.z);
        }
        this.lapsDone = 0; this.lapsPlan = rng.int(3, 8);
        this.state = 'prep'; this.timer = rng.range(2, 6);
        if (this.m) this.m.stam = Math.min(1, this.m.stam + 0.5);
        return;
      }
      this.goLeave(g);
    }
    walkTo(g, field, what) {
      this.onFoot = true; this.state = 'foot'; this.footField = field; this.footWhat = what; this.ntx = null; this.stuckT = 0;
    }
    uFoot(g, dt, rng) {
      const f = g.fields.get(this.footField);
      const r = followField(this, f, 2.2, dt, rng);
      if (r === 'arrived') {
        const P = g.econ.prices;
        const w = this.footWhat;
        if (w === 'workshop') {
          const b = g.nearestBuilding('workshop', this.x, this.z);
          const price = Cat.buildings.workshop.price;
          if (b) { g.sale(b, 'taller', price, 0.4); this.bikeCond = 1; this.broken = false; this.think(g, 'workshop_ok'); this.timer = 10 / Math.max(1, g.mechanicsAt(b)); }
          else this.timer = 1;
        } else if (w === 'shower') { this.think(g, 'shower_ok'); this.timer = rng.range(4, 7); }
        else if (w === 'wash') {
          const b = g.nearestBuilding('wash', this.x, this.z);
          if (b && this.money >= Cat.buildings.wash.price) { this.money -= Cat.buildings.wash.price; g.sale(b, 'lavadero', Cat.buildings.wash.price, 0.15); this.think(g, 'washed'); this.happy = Math.min(100, this.happy + 4); }
          this.timer = rng.range(3, 5);
        } else if (w === 'parts') {
          const b = g.nearestBuilding('parts', this.x, this.z);
          const price = Math.round(Cat.buildings.parts.price * (0.6 + rng.range(0, 0.9)));
          if (b && this.money >= price) { this.money -= price; g.sale(b, 'recambios', price, 0.5); this.bikeCond = Math.min(1, this.bikeCond + 0.25); this.think(g, 'parts_ok'); }
          this.timer = rng.range(3, 6);
        }
        else if (w === 'food') {
          const b = g.nearestBuilding(['foodtruck', 'restaurant'], this.x, this.z);
          const price = Math.round(7 * P.food);
          if (b && this.money >= price) { this.money -= price; g.sale(b, 'comida', price, 0.38); }
          this.timer = rng.range(3, 6);
        } else if (w === 'school') {
          const b = g.nearestBuilding('school', this.x, this.z);
          if (b) { g.sale(b, 'escuela', Cat.buildings.school.price, 0.15); this.schooled = true; this.attr.skill = Math.min(100, this.attr.skill + 6); this.attr.jump = Math.min(100, this.attr.jump + 8); this.think(g, 'school_ok'); }
          this.timer = rng.range(10, 16);
        }
        this.state = 'inside';
      } else if (r === 'stuck') { this.stuckT += dt; if (this.stuckT > 3) { this.onFoot = false; this.state = 'toPaddock'; this.ntx = null; } }
    }
    uInside(g, dt, rng) {
      this.timer -= dt;
      if (this.timer <= 0) { this.onFoot = false; this.state = 'toPaddock'; this.ntx = null; this.stuckT = 0; }
      void g; void rng;
    }
    goLeave(g) {
      this.state = 'leave'; this.timer = 2; this.ntx = null;
      g.riderLeaving(this);
    }
    /* rental customers start at the shop and walk back there */
    get homeField() { return this.rental ? 'r_rental_' + this.rental : 'r_paddock'; }
    uLeave(g, dt) {
      this.timer -= dt;
      if (this.timer <= 0) this.dead = true;
      void g;
    }
    satisfaction() { return U.clamp(this.happy * 0.55 + this.fun * 0.45, 0, 100); }
    /* the rider's body: a person on foot, or the pose on the machine (none in a buggy
       or after a crash, when the machine is drawn on its own) */
    model() {
      if (this.state === 'inside' || this.state === 'leave' || this.state === 'carried') return null;
      if (this.onFoot) return 'person_' + (Math.floor((this.walked || 0) / 0.45) % 4);
      const v = this.veh;
      if (v.car || (this.m && this.m.crash)) return null;
      if (v.slide && this.m && Math.abs(this.m.roll) > 0.22) return this.m.roll > 0 ? 'rb_flat_r' : 'rb_flat_l';
      if (this.m && (this.m.air || this.m.v > 12)) return v.stand;
      return v.sit;
    }
  }
  Rider.CAT_NAMES = CAT_NAMES;
  Rider.categoryOf = categoryOf;

  /* ================================================================ */
  const STAFF_COLS = {
    mechanic: [[30, 60, 150], [30, 60, 150], [30, 60, 150]],
    crew: [[255, 120, 20], [60, 60, 60], [250, 210, 40]],
    cleaner: [[67, 160, 71], [40, 90, 40], [46, 125, 50]],
    medic: [[245, 245, 245], [200, 40, 40], [245, 245, 245]],
    marshal: [[255, 120, 20], [40, 40, 40], [40, 40, 40]],
    coach: [[200, 40, 40], [30, 30, 30], [200, 40, 40]]
  };
  class Staff extends Thinker {
    constructor(g, rng, role, opts) {
      super();
      opts = opts || {};
      this.id = UID++; this.kind = 'staff'; this.role = role;
      this.name = opts.name || personName(rng);
      this.skill = opts.skill || rng.int(1, 5);
      this.salary = opts.salary || Math.round(Cat.staff[role].salary * (0.85 + this.skill * 0.07) / 10) * 10;
      const sc = STAFF_COLS[role];
      this.cols = [sc[0], sc[1], rng.pick(HAIR), rng.pick(SKIN)];
      this.x = opts.x || 0; this.z = opts.z || 0; this.tx = opts.tx || 0; this.tz = opts.tz || 0; this.ntx = null;
      this.ox = rng.range(-0.8, 0.8); this.oz = rng.range(-0.8, 0.8);
      this.yaw = 0; this.y = 0;
      this.state = 'idle'; this.timer = rng.range(1, 4);
      this.thoughts = []; this.happy = 75; this.bubble = null;
      this.hired = opts.day || 0;
      this.home = null; this.task = null; this.vehicle = null;
      this.walked = 0; this.stuckT = 0; this.worked = 0;
    }
    update(g, dt, rng) {
      if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
      switch (this.role) {
        case 'mechanic': return this.uMechanic(g, dt, rng);
        case 'coach': return this.uStation(g, dt, rng, 'school');
        case 'cleaner': return this.uCleaner(g, dt, rng);
        case 'crew': return this.uCrew(g, dt, rng);
        case 'medic': return this.uMedic(g, dt, rng);
        case 'marshal': return this.uMarshal(g, dt, rng);
      }
    }
    stationAt(g, type) {
      const b = g.assignBuilding(this, type);
      if (!b) return null;
      const d = b.doorPos || g.doorWorldPos(b);
      return { b, x: d.x, z: d.z };
    }
    uMechanic(g, dt, rng) { return this.uStation(g, dt, rng, 'workshop'); }
    uStation(g, dt, rng, type) {
      const st = this.stationAt(g, type);
      if (!st) { this.state = 'idle'; return; }
      this.px = st.x + Math.sin(this.id) * 0.8; this.pz = st.z + Math.cos(this.id) * 0.8;
      if (moveToward(this, 2, dt)) { this.state = 'work'; this.yaw = st.b.frontYaw || 0; }
      this.working = (g.time + this.id) % 6 < 3;
      void rng;
    }
    uCleaner(g, dt, rng) {
      const w = g.world;
      if (this.state === 'idle' || !this.task) {
        this.timer -= dt;
        if (this.timer > 0) return;
        this.task = g.cleanerTask(this, rng);
        if (!this.task) { this.timer = 2; this.wanderStep(g, dt, rng); return; }
        this.state = 'go'; this.ntx = null; this.stuckT = 0;
      }
      if (this.state === 'go') {
        const r = followField(this, this.task.field, 2.2, dt, rng);
        if (r === 'arrived') { this.state = 'clean'; this.timer = this.task.kind === 'toilet' ? 4 : 2.5; }
        else if (r === 'stuck') { this.stuckT += dt; if (this.stuckT > 3) { this.task = null; this.state = 'idle'; this.timer = 1; } }
      } else if (this.state === 'clean') {
        this.timer -= dt;
        this.working = true;
        if (this.timer <= 0) {
          this.working = false;
          if (this.task.kind === 'toilet') { const b = g.buildings.get(this.task.b); if (b) b.clean = 100; }
          else { const i = w.idx(this.tx, this.tz); if (w.litter[i]) { w.litter[i] = 0; w.litterVer++; } }
          this.worked++;
          this.task = null; this.state = 'idle'; this.timer = 0.5;
        }
      } else this.wanderStep(g, dt, rng);
    }
    wanderStep(g, dt, rng) {
      if (this.ntx == null) { this.ntx = this.tx; this.ntz = this.tz; setWaypoint(this, this.tx, this.tz); }
      if (moveToward(this, 1.8, dt)) {
        this.tx = this.ntx; this.tz = this.ntz;
        const opts = [];
        for (const [dx, dz] of PF.DIRS) if (g.world.isWalkable(this.tx + dx, this.tz + dz)) opts.push([this.tx + dx, this.tz + dz]);
        if (opts.length) { const c = rng.pick(opts); setWaypoint(this, c[0], c[1]); }
      }
    }
    /* Track crew: drive the tractor around the track restoring the surface. */
    uCrew(g, dt, rng) {
      const depot = g.assignBuilding(this, 'depot');
      if (!depot) { this.state = 'idle'; return; }
      if (this.state === 'idle') {
        this.timer -= dt;
        const dp = g.doorWorldPos(depot);
        this.x = dp.x; this.z = dp.z; this.tx = dp.tx; this.tz = dp.tz; this.vehicle = null;
        if (this.timer > 0) return;
        const tr = g.trackNeedingCare();
        if (!tr) { this.timer = 6; return; }
        this.task = { track: tr.id };
        this.state = 'drive'; this.ntx = null; this.stuckT = 0; this.vehicle = g.wateringUnlocked() ? 'truck' : 'tractor';
      } else if (this.state === 'drive') {
        const tr = g.trackById(this.task.track);
        if (!tr || !tr.entry) { this.state = 'return'; this.ntx = null; return; }
        const r = followField(this, g.fields.get('r_entry_' + tr.id), 5, dt, rng);
        if (r === 'arrived') {
          this.state = 'groom';
          this.gs = tr.entry.s; this.gd = 0;
          this.glane = (tr.entry.side || 1) * (tr.S.w[tr.entry.i] * 0.5 - 0.9);
        } else if (r === 'stuck') { this.stuckT += dt; if (this.stuckT > 4) { this.state = 'return'; this.ntx = null; } }
      } else if (this.state === 'groom') {
        const tr = g.trackById(this.task.track);
        if (!tr || !tr.S) { this.state = 'return'; this.ntx = null; return; }
        const sp = 4.5;
        this.gs = U.mod(this.gs + sp * dt, tr.length); this.gd += sp * dt;
        const p = tr.poseAt(this.gs, this.glane, {});
        this.x = p.x; this.z = p.z; this.y = p.y; this.yaw = p.hdg;
        const k = Math.floor(this.gs / 5);
        const restore = (0.004 + this.skill * 0.0012) * (g.machineryBonus ? 1.2 : 1);
        if (tr.wear[k] > 0) tr.wear[k] = Math.max(0, tr.wear[k] - restore * 60 * dt);
        if (g.wateringUnlocked()) tr.dust = Math.max(0, tr.dust - dt * 0.004);
        tr.visualVer = (tr.visualVer || 0) + (Math.random() < dt * 0.5 ? 1 : 0);
        if (this.gd >= tr.length) {
          this.worked++;
          this.state = 'return'; this.ntx = null; this.stuckT = 0;
          this.x = tr.entry.x; this.z = tr.entry.z; this.tx = tr.entry.tx; this.tz = tr.entry.tz;
        }
      } else if (this.state === 'return') {
        const r = followField(this, g.fields.get('r_depot'), 5, dt, rng);
        if (r === 'arrived' || (r === 'stuck' && (this.stuckT += dt) > 4)) { this.state = 'idle'; this.timer = rng.range(8, 16); this.vehicle = null; }
      }
    }
    /* Medic: respond to injured riders with the quad. */
    uMedic(g, dt, rng) {
      const post = g.assignBuilding(this, 'medical');
      if (!post) { this.state = 'idle'; return; }
      if (this.state === 'idle' || this.state === 'work') {
        const dp = g.doorWorldPos(post);
        this.x = dp.x; this.z = dp.z; this.tx = dp.tx; this.tz = dp.tz; this.vehicle = null; this.state = 'work'; this.yaw = post.frontYaw || 0;
        const job = g.takeMedicJob(this);
        if (job) { this.task = job; this.state = 'respond'; this.ntx = null; this.vehicle = 'quad'; this.stuckT = 0; }
      } else if (this.state === 'respond') {
        const rider = g.riderById(this.task.rider);
        if (!rider || !rider.m || !rider.m.crash) { this.state = 'back'; this.ntx = null; return; }
        this.px = rider.x + 1.4; this.pz = rider.z + 1.4;
        if (moveToward(this, 7, dt)) { this.state = 'treat'; this.timer = 6; }
        this.y = g.world.heightAt(this.x, this.z);
      } else if (this.state === 'treat') {
        this.timer -= dt; this.working = true;
        if (this.timer <= 0) {
          this.working = false;
          const rider = g.riderById(this.task.rider);
          if (rider) g.riderTreated(rider);
          this.worked++;
          this.state = 'back'; this.ntx = null;
        }
      } else if (this.state === 'back') {
        const dp = g.doorWorldPos(post);
        this.px = dp.x; this.pz = dp.z;
        if (moveToward(this, 7, dt)) { this.state = 'work'; this.task = null; }
        this.y = g.world.heightAt(this.x, this.z);
      }
      void rng;
    }
    /* Marshal: stand by a hazard and wave the yellow flag after crashes. */
    uMarshal(g, dt, rng) {
      const post = g.marshalPost(this);
      if (!post) { this.state = 'idle'; return; }
      this.px = post.x; this.pz = post.z;
      if (moveToward(this, 2.5, dt)) { this.yaw = post.yaw; this.state = 'post'; }
      this.y = g.world.heightAt(this.x, this.z);
      this.flagT = Math.max(0, (this.flagT || 0) - dt);
      this.working = this.flagT > 0;
      void rng;
    }
    model() {
      if (this.vehicle) return this.vehicle;
      const f = Math.floor((this.walked || 0) / 0.45) % 4;
      const fr = f === 1 ? 1 : f === 3 ? 3 : 0;
      return 'staff_' + this.role + '_' + fr;
    }
  }

  /* ================================================================ */
  class Car {
    constructor(g, rng, opts) {
      this.id = UID++; this.kind = 'car';
      this.model = opts.model || (rng.chance(0.8) ? 'car' : 'van');
      this.col = opts.col || rng.pick([[200, 30, 30], [230, 230, 230], [40, 40, 45], [30, 80, 160], [120, 120, 125], [20, 110, 60], [230, 190, 40], [150, 30, 30]]);
      this.route = opts.route || [];
      this.ri = 0;
      this.x = opts.x; this.z = opts.z; this.yaw = opts.yaw || 0; this.y = 0;
      this.state = 'in';
      this.lot = opts.lot || null; this.slot = opts.slot || null;
      this.members = opts.members || 0;
      this.rider = opts.rider || null;
      this.speed = 0;
      this.onArrive = opts.onArrive || null;
      this.lane = 1.1;
    }
    update(g, dt) {
      if (this.state === 'parked') return;
      if (this.state === 'in' || this.state === 'out') {
        const target = this.route[this.ri];
        if (target == null) { this.finishLeg(g); return; }
        const N = g.world.N;
        const tx = target % N, tz = (target / N) | 0;
        const c = tileCenter(tx, tz);
        /* keep right: offset from the centre line towards the right of travel */
        const nx = Math.cos(this.yaw + Math.PI / 2) * this.lane, nz = Math.sin(this.yaw + Math.PI / 2) * this.lane;
        const px = c[0] + nx, pz = c[1] + nz;
        const dx = px - this.x, dz = pz - this.z, d = Math.hypot(dx, dz);
        this.speed = U.approach(this.speed, 9, dt * 6);
        const step = this.speed * dt;
        if (d < step + 0.2) { this.ri++; }
        else { this.x += dx / d * step; this.z += dz / d * step; this.yaw = U.angleLerp(this.yaw, Math.atan2(dz, dx), Math.min(1, dt * 6)); }
      } else if (this.state === 'park') {
        const dx = this.slot.x - this.x, dz = this.slot.z - this.z, d = Math.hypot(dx, dz);
        if (d < 0.25) { this.x = this.slot.x; this.z = this.slot.z; this.yaw = this.slot.yaw; this.state = 'parked'; if (this.onArrive) { this.onArrive(g, this); this.onArrive = null; } return; }
        const step = 3 * dt;
        this.x += dx / d * Math.min(step, d); this.z += dz / d * Math.min(step, d);
        this.yaw = U.angleLerp(this.yaw, Math.atan2(dz, dx), Math.min(1, dt * 5));
      }
      this.y = g.world.heightAt(this.x, this.z);
    }
    finishLeg(g) {
      if (this.state === 'in') { this.state = 'park'; }
      else { this.dead = true; }
      void g;
    }
    depart(g, route) {
      if (this.slot) { g.freeSlot(this.lot, this.slot); this.slot = null; }
      this.route = route || []; this.ri = 0;
      this.state = 'out'; this.speed = 0;
    }
  }

  MX.Agents = { Visitor, Rider, Staff, Car, setUid, getUid: () => UID, SHIRT, PANTS, TEAM, SKIN, HAIR, categoryOf, CAT_NAMES, followField, moveToward, setWaypoint, tileCenter };
})(window.MX);
