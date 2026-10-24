/* MX Tycoon - Game: the whole park state and its rules. Commands validate, charge
   money and emit events; step() advances the simulation in fixed sub-steps. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U, Cat = MX.Catalog, PF = MX.Pathing, A = MX.Agents;
  const T = C.TILE;
  const P = MX.World.P;
  const FRONT = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const OPEN_AREA = { paddock: 1, parking: 1, camping: 1 };

  class Game {
    constructor() {
      this.mode = 'career';
      this.seed = 1;
      this.parkName = 'MX Park';
      this.world = null;
      this.tracks = [];
      this.buildings = new Map();
      this.nextBld = 1;
      this.bldVer = 1;
      this.bldDirtyChunks = new Set();
      this.visitors = []; this.riders = []; this.staff = []; this.cars = [];
      this.econ = new MX.Economy(C.START_MONEY);
      this.time = 0; this.day = 0; this.dayT = 0; this.speed = 1;
      this.rep = 50;
      this.repParts = { vis: 0.5, rid: 0.5, track: 0, fac: 0, prestige: 0, pen: 0 };
      this.satV = []; this.satR = [];
      this.prestige = 0;
      this.weather = 'sunny'; this.weatherDays = 0;
      this.unlocked = new Set();
      this.notes = [];
      this.thoughtStats = {};
      this.stats = this.freshDayStats();
      this.totals = { visitors: 0, riders: 0, laps: 0, crashes: 0, injuries: 0, events: 0 };
      this.history = [];
      this.fields = new Map();
      this.fieldsDirty = true; this.fieldsT = 0;
      this.rng = new U.RNG(12345);
      this.spawnAccV = 0; this.spawnAccR = 0;
      this.medicJobs = [];
      this.passHolders = [];
      this.selectedTrack = null;
      this.race = null;
      this.paused = false;
      this.gameOver = null;
      this.exciteGrid = null; this.dustGrid = null; this.gridT = 0;
      this.flags = { trainingDays: 0, visitorBoost: 0, visitorBoostDays: 0, merchBoost: 0, merchDays: 0, maintMul: 1, maintDays: 0 };
      this.marketing = [];
      this.sponsors = [];
      this.sponsorOffer = null;
      this.prog = null; this.comp = null; this.amb = null;
      this.lastCrashT = -99;
    }
    freshDayStats() { return { visitorsToday: 0, ridersToday: 0, ridersOnTrackToday: 0, lapsToday: 0, crashesToday: 0, refusedTicket: 0, refusedFee: 0, visitorsTotal: 0 }; }

    static create(opts) {
      const g = new Game();
      opts = opts || {};
      g.mode = opts.mode || 'career';
      g.seed = opts.seed || ((Math.random() * 1e9) | 0);
      g.parkName = opts.parkName || (U.rng.pick(Cat.names.parkPrefix) + ' ' + U.rng.pick(Cat.names.parkName));
      g.rng = new U.RNG(g.seed ^ 0xabcdef);
      g.world = new MX.World(C.MAP);
      g.world.generate(g.seed, opts.preset || 'valle');
      g.world.setupOwnership(g.mode);
      if (g.mode !== 'sandbox') g.world.setExpansionLevel(1);
      g.econ = new MX.Economy(g.mode === 'sandbox' ? C.SANDBOX_MONEY : C.START_MONEY);
      g.econ.maxLoan = g.mode === 'sandbox' ? 0 : 100000;
      if (g.mode === 'sandbox') g.rep = 300;
      g.prog = new MX.Progression(g);
      g.comp = new MX.Competition(g);
      g.amb = new MX.Ambient(g);
      g.econ.sampleCash(0);
      g.notify('Bienvenido a ' + g.parkName + '. ¡Construye tu primer circuito!', 'info');
      return g;
    }

    /* ---------------- calendar ---------------- */
    date(dayIndex) {
      const d = dayIndex != null ? dayIndex : this.day;
      const mIdx = C.START_MONTH + Math.floor(d / C.MONTH_DAYS);
      return { day: d % C.MONTH_DAYS + 1, month: mIdx % 12, year: 1 + Math.floor(mIdx / 12), dow: d % 7, monthIndex: Math.floor(d / C.MONTH_DAYS) };
    }
    dateText(dayIndex) {
      const t = this.date(dayIndex);
      return U.DAYS_SHORT[t.dow] + ' ' + t.day + ' ' + U.MONTHS_SHORT[t.month] + ', año ' + t.year;
    }
    isWeekend() { const d = this.date(); return d.dow >= 5; }
    seasonTint() {
      const m = this.date().month;
      return [0.05, 0, 0, 0, 0, 0.05, 0.15, 0.25, 0.32, 0.4, 0.3, 0.12][m];
    }

    /* ---------------- money ---------------- */
    canAfford(c) { return this.mode === 'sandbox' || c <= 0 || this.econ.money - c >= 0; }
    spend(cat, c, x, z) {
      if (c <= 0) return true;
      this.econ.spend(cat, c);
      if (x != null) MX.Bus.emit('money', { amount: -c, x, z });
      MX.Bus.emit('cash', { amount: -c });
      return true;
    }
    earn(cat, c, x, z, quiet) {
      if (!c) return;
      this.econ.earn(cat, c);
      if (x != null && !quiet) MX.Bus.emit('money', { amount: c, x, z });
    }
    sale(b, cat, price, costRatio) {
      this.econ.earn(cat, price);
      if (costRatio) this.econ.spend('suministros', Math.round(price * costRatio * 100) / 100);
      if (b) { b.rev = (b.rev || 0) + price; b.revTotal = (b.revTotal || 0) + price; b.customers = (b.customers || 0) + 1; }
      if (b && Math.random() < 0.15) MX.Bus.emit('money', { amount: price, x: b.cx, z: b.cz, small: true });
    }

    /* ---------------- notifications and thoughts ---------------- */
    notify(text, kind, opts) {
      const n = Object.assign({ text, kind: kind || 'info', day: this.day, t: this.time, id: U.rng.int(1, 1e9) }, opts || {});
      if (n.agent) { n.agentId = n.agent.id; n.agentKind = n.agent.kind; delete n.agent; }
      this.notes.unshift(n);
      if (this.notes.length > 80) this.notes.pop();
      MX.Bus.emit('notify', n);
      return n;
    }
    recordThought(key, mood) {
      const s = this.thoughtStats[key] || (this.thoughtStats[key] = { n: 0, mood });
      s.n += 1;
    }

    /* ---------------- unlocks ---------------- */
    isUnlocked(def) {
      if (!def || !def.unlock) return true;
      if (this.mode === 'sandbox') return true;
      return this.unlocked.has(def.unlock);
    }
    unlock(key) { this.unlocked.add(key); MX.Bus.emit('unlock', key); }
    wateringUnlocked() { return this.mode === 'sandbox' || this.unlocked.has('research:watering'); }
    get machineryBonus() { return this.mode === 'sandbox' || this.unlocked.has('research:machinery'); }

    /* ---------------- buildings ---------------- */
    rect(type, tx, tz, rot) {
      const d = Cat.buildings[type];
      const odd = rot % 2 === 1;
      return { tx, tz, w: odd ? d.h : d.w, h: odd ? d.w : d.h };
    }
    checkBuilding(type, tx, tz, rot) {
      const d = Cat.buildings[type];
      if (!d) return { ok: false, reason: 'Desconocido' };
      if (!this.isUnlocked(d)) return { ok: false, reason: 'Bloqueado: investiga o completa objetivos' };
      const r = this.rect(type, tx, tz, rot);
      const w = this.world;
      let trees = 0;
      for (let z = r.tz; z < r.tz + r.h; z++) for (let x = r.tx; x < r.tx + r.w; x++) {
        const why = w.canBuildOn(x, z, { clearScenery: true });
        if (why) return { ok: false, reason: why, rect: r };
        if (w.scen[w.idx(x, z)] >= 0) trees++;
      }
      const lv = w.footprintLevel(r.tx, r.tz, r.w, r.h);
      let mn = Infinity, mx = -Infinity;
      for (let vz = r.tz; vz <= r.tz + r.h; vz++) for (let vx = r.tx; vx <= r.tx + r.w; vx++) { const h = w.vh(vx, vz); mn = Math.min(mn, h); mx = Math.max(mx, h); }
      if (mx - mn > 3.2) return { ok: false, reason: 'Terreno demasiado irregular', rect: r };
      /* vertices shared with roads or other buildings stay put; the building keeps a plinth */
      lv.volume = 0;
      for (let vz = r.tz; vz <= r.tz + r.h; vz++) for (let vx = r.tx; vx <= r.tx + r.w; vx++) if (w.vertexEditable(vx, vz, 0xffff)) lv.volume += Math.abs(w.vh(vx, vz) - lv.target);
      const earth = Math.round(lv.volume * C.TERRAIN_COST * (this.machineryBonus ? 0.6 : 1));
      const cost = d.cost + earth + trees * C.TREE_CLEAR_COST;
      const warn = [];
      const acc = this.accessFor(type, r, rot);
      if (d.access === 'path' && !acc.path) warn.push('Necesita un camino junto a la entrada');
      if (d.access === 'road' && !acc.road) warn.push('Debe tocar una carretera');
      return { ok: true, cost, rect: r, level: lv.target, trees, warn };
    }
    accessFor(type, r, rot) {
      const w = this.world;
      let path = false, road = false;
      const fr = FRONT[rot || 0];
      void fr;
      const tiles = [];
      for (let x = r.tx; x < r.tx + r.w; x++) { tiles.push([x, r.tz - 1]); tiles.push([x, r.tz + r.h]); }
      for (let z = r.tz; z < r.tz + r.h; z++) { tiles.push([r.tx - 1, z]); tiles.push([r.tx + r.w, z]); }
      for (const [x, z] of tiles) {
        if (!w.inBounds(x, z)) continue;
        const p = w.path[w.idx(x, z)];
        if (p === P.GRAVEL || p === P.PAVED) path = true;
        if (p === P.ROAD) road = true;
      }
      return { path, road };
    }
    placeBuilding(type, tx, tz, rot, free) {
      const chk = this.checkBuilding(type, tx, tz, rot);
      if (!chk.ok) return chk;
      if (!free && !this.canAfford(chk.cost)) return { ok: false, reason: 'No tienes suficiente dinero', cost: chk.cost };
      const w = this.world, r = chk.rect;
      for (let z = r.tz; z < r.tz + r.h; z++) for (let x = r.tx; x < r.tx + r.w; x++) w.removeSceneryAt(x, z);
      w.flattenFootprint(r.tx, r.tz, r.w, r.h, chk.level, true);
      const b = {
        id: this.nextBld++, type, tx: r.tx, tz: r.tz, w: r.w, h: r.h, rot: rot || 0, y: chk.level,
        built: this.day, rev: 0, revTotal: 0, customers: 0, clean: 100, users: 0, cond: 100
      };
      this._finishBuilding(b);
      this.buildings.set(b.id, b);
      for (let z = r.tz; z < r.tz + r.h; z++) for (let x = r.tx; x < r.tx + r.w; x++) w.bld[w.idx(x, z)] = b.id;
      if (!free) this.spend('construccion', chk.cost, b.cx, b.cz);
      this.touchBuildings(b);
      this.fieldsDirty = true;
      MX.Bus.emit('build', { b });
      if (chk.warn && chk.warn.length) this.notify(Cat.buildings[type].name + ': ' + chk.warn[0].toLowerCase() + '.', 'warn', { x: b.cx, z: b.cz });
      return { ok: true, b, cost: chk.cost };
    }
    _finishBuilding(b) {
      const d = Cat.buildings[b.type];
      b.cx = (b.tx + b.w / 2) * T; b.cz = (b.tz + b.h / 2) * T;
      b.frontYaw = Math.atan2(FRONT[b.rot][1], FRONT[b.rot][0]);
      b.height = d.height;
      if (b.type === 'grandstand' || b.type === 'grandstand_cov') this._makeSeats(b);
      if (b.type === 'parking') this._makeSlots(b, 'car');
      if (b.type === 'paddock') this._makeSlots(b, 'van');
    }
    touchBuildings(b) {
      this.bldVer++;
      const CH = MX.Geom ? MX.Geom.CH : 16;
      const nC = Math.ceil(this.world.N / CH);
      this.bldDirtyChunks.add(Math.floor(b.tx / CH) + Math.floor(b.tz / CH) * nC);
    }
    _makeSeats(b) {
      const d = Cat.buildings[b.type];
      const rows = 4, cols = d.capacity / rows;
      b.seats = [];
      /* local frame: width along building x (W*4 m), rows going back from the front */
      const W = Cat.buildings[b.type].w * T, D = Cat.buildings[b.type].h * T;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const lx = (c + 0.5) * W / cols, lz = D - 0.6 - r * (D - 1.2) / rows;
        const ly = 0.45 + r * 0.62;
        const wp = this.localToWorld(b, lx, lz);
        b.seats.push({ x: wp.x, z: wp.z, y: b.y + ly, who: 0, yaw: b.frontYaw, covered: b.type === 'grandstand_cov', b: b.id });
      }
    }
    localToWorld(b, lx, lz) {
      /* local model frame: x in [0,w*T], z in [0,h*T] with front at +z, rotated by rot */
      const d = Cat.buildings[b.type];
      const W = d.w * T, D = d.h * T;
      const cx = lx - W / 2, cz = lz - D / 2;
      const a = -b.rot * Math.PI / 2;
      const c = Math.cos(a), s = Math.sin(a);
      return { x: b.cx + cx * c - cz * s, z: b.cz + cx * s + cz * c };
    }
    _makeSlots(b, kind) {
      b.slots = [];
      const x0 = b.tx * T, z0 = b.tz * T;
      if (kind === 'car') {
        for (let i = 0; i < 6; i++) {
          b.slots.push({ x: x0 + 1.1 + i * 1.96, z: z0 + 2.4, yaw: -Math.PI / 2, used: 0 });
          b.slots.push({ x: x0 + 1.1 + i * 1.96, z: z0 + 9.6, yaw: Math.PI / 2, used: 0 });
        }
      } else {
        for (let i = 0; i < 4; i++) {
          b.slots.push({ x: x0 + 1.6 + i * 2.9, z: z0 + 3.0, yaw: Math.PI / 2, used: 0 });
          b.slots.push({ x: x0 + 1.6 + i * 2.9, z: z0 + 9.0, yaw: -Math.PI / 2, used: 0 });
        }
      }
    }
    freeSlot(lotId, slot) { if (slot) slot.used = 0; void lotId; }
    removeBuilding(id, refund) {
      const b = this.buildings.get(id);
      if (!b) return false;
      const w = this.world;
      for (let z = b.tz; z < b.tz + b.h; z++) for (let x = b.tx; x < b.tx + b.w; x++) w.bld[w.idx(x, z)] = -1;
      this.buildings.delete(id);
      this.touchBuildings(b);
      this.fieldsDirty = true;
      const back = refund === false ? 0 : Math.round(Cat.buildings[b.type].cost * 0.4);
      if (back) this.econ.refund('construccion', back);
      /* evict agents that depended on it */
      for (const v of this.visitors) {
        if (v.inside === id) { v.inside = null; v.state = 'wander'; v.timer = 1; }
        if (v.seat && v.seat.b === id) { v.seat = null; v.state = 'wander'; v.timer = 1; }
      }
      for (const c of this.cars) if (c.lot === id) c.dead = true;
      for (const s of this.staff) if (s.home === id) s.home = null;
      MX.Bus.emit('demolish', { b });
      return true;
    }
    count(type) { let n = 0; for (const b of this.buildings.values()) if (b.type === type) n++; return n; }
    buildingsOf(type) { const out = []; for (const b of this.buildings.values()) if (b.type === type) out.push(b); return out; }
    doorTiles(b, kind) {
      /* kind 'path' -> adjacent path tiles; 'road' -> adjacent road tiles; 'open' -> adjacent rider-walkable tiles */
      const w = this.world;
      const out = [];
      const fr = FRONT[b.rot];
      const add = (x, z, front) => {
        if (!w.inBounds(x, z)) return;
        const i = w.idx(x, z);
        const p = w.path[i];
        let ok;
        if (kind === 'path') ok = p === P.GRAVEL || p === P.PAVED;
        else if (kind === 'road') ok = p === P.ROAD;
        else ok = this.riderPassable(x, z, i);
        if (ok) out.push({ tx: x, tz: z, i, front });
      };
      for (let x = b.tx; x < b.tx + b.w; x++) { add(x, b.tz - 1, fr[1] === -1); add(x, b.tz + b.h, fr[1] === 1); }
      for (let z = b.tz; z < b.tz + b.h; z++) { add(b.tx - 1, z, fr[0] === -1); add(b.tx + b.w, z, fr[0] === 1); }
      out.sort((a, c) => (c.front ? 1 : 0) - (a.front ? 1 : 0));
      return out;
    }
    doorWorldPos(b) {
      if (b._door && b._doorVer === this.fieldVer) return b._door;
      const t = this.doorTiles(b, 'open')[0] || this.doorTiles(b, 'path')[0];
      let res;
      if (t) { const c = A.tileCenter(t.tx, t.tz); res = { x: c[0], z: c[1], tx: t.tx, tz: t.tz }; }
      else {
        const fr = FRONT[b.rot];
        res = { x: b.cx + fr[0] * (b.w * T / 2 + 1), z: b.cz + fr[1] * (b.h * T / 2 + 1), tx: Math.floor(b.cx / T), tz: Math.floor(b.cz / T) };
      }
      b._door = res; b._doorVer = this.fieldVer;
      return res;
    }
    buildingAtDoor(tx, tz, types) {
      const w = this.world;
      for (const [dx, dz] of PF.DIRS) {
        const x = tx + dx, z = tz + dz;
        if (!w.inBounds(x, z)) continue;
        const id = w.bld[w.idx(x, z)];
        if (id < 0) continue;
        const b = this.buildings.get(id);
        if (b && types.includes(b.type)) return b;
      }
      return null;
    }
    nearestBuilding(types, x, z) {
      if (typeof types === 'string') types = [types];
      let best = null, bd = Infinity;
      for (const b of this.buildings.values()) {
        if (!types.includes(b.type)) continue;
        const d = U.dist2(x, z, b.cx, b.cz);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    takeSeat(b, v) {
      if (!b.seats) return null;
      const free = b.seats.filter(s => !s.who);
      if (!free.length) return null;
      const s = free[Math.floor(Math.random() * free.length)];
      s.who = v.id;
      const d = this.doorTiles(b, 'path')[0];
      s.door = d ? [d.tx, d.tz] : null;
      v.x = s.x; v.z = s.z; v.yaw = s.yaw;
      return s;
    }
    freeSeat(s) { if (s) s.who = 0; }
    seatsTotal() { let n = 0; for (const b of this.buildings.values()) if (b.seats) n += b.seats.length; return n; }
    seatsCovered() { let n = 0; for (const b of this.buildings.values()) if (b.type === 'grandstand_cov') n += b.seats.length; return n; }

    /* ---------------- paths, decor, addons, terrain, land ---------------- */
    placePath(tx, tz, type) {
      const w = this.world;
      const why = w.canPlacePath(tx, tz, type);
      if (why) return { ok: false, reason: why };
      const cost = Cat.paths[type].cost + (w.scen[w.idx(tx, tz)] >= 0 ? C.TREE_CLEAR_COST : 0);
      if (!this.canAfford(cost)) return { ok: false, reason: 'No tienes suficiente dinero' };
      w.removeSceneryAt(tx, tz);
      w.setPath(tx, tz, type);
      this.spend('construccion', cost, (tx + 0.5) * T, (tz + 0.5) * T);
      this.fieldsDirty = true;
      return { ok: true, cost };
    }
    removePath(tx, tz) {
      const w = this.world;
      if (!w.inBounds(tx, tz) || tz === w.roadRow) return { ok: false, reason: 'No se puede quitar' };
      const i = w.idx(tx, tz);
      const p = w.path[i];
      if (!p) return { ok: false, reason: 'No hay camino' };
      w.setPath(tx, tz, 0);
      this.econ.refund('construccion', Math.round(Cat.paths[p].cost * 0.3));
      this.fieldsDirty = true;
      return { ok: true };
    }
    placeAddon(tx, tz, kind) {
      const w = this.world;
      if (!w.isWalkable(tx, tz)) return { ok: false, reason: 'Va sobre un camino peatonal' };
      const id = { bench: 1, bin: 2, lamp: 3 }[kind];
      const i = w.idx(tx, tz);
      if (w.addon[i] === id) return { ok: false, reason: 'Ya hay uno' };
      const cost = Cat.addons[kind].cost;
      if (!this.canAfford(cost)) return { ok: false, reason: 'No tienes suficiente dinero' };
      w.addon[i] = id; w.addonVer++;
      this.spend('construccion', cost, (tx + 0.5) * T, (tz + 0.5) * T);
      this.fieldsDirty = true;
      return { ok: true, cost };
    }
    placeDecor(type, tx, tz, rot) {
      const w = this.world;
      const d = Cat.decor[type];
      if (!d) return { ok: false, reason: 'Desconocido' };
      if (!w.inBounds(tx, tz)) return { ok: false, reason: 'Fuera del mapa' };
      const i = w.idx(tx, tz);
      if (!w.owned[i]) return { ok: false, reason: 'Terreno no comprado' };
      if (w.bld[i] >= 0 || w.path[i] || w.trackOcc[i]) return { ok: false, reason: 'Ocupado' };
      if (w.isWater(tx, tz)) return { ok: false, reason: 'Hay agua' };
      if (w.scen[i] >= 0) return { ok: false, reason: 'Ya hay algo aquí' };
      if (!this.canAfford(d.cost)) return { ok: false, reason: 'No tienes suficiente dinero' };
      const sp = d.banner && this.sponsors.length ? this.sponsors[this.rng.int(0, this.sponsors.length - 1)].id : null;
      w.addScenery(type, tx, tz, this.rng, { rot: rot != null ? rot : undefined, sponsor: sp });
      this.spend('construccion', d.cost, (tx + 0.5) * T, (tz + 0.5) * T);
      for (const tr of this.tracks) tr.statsStale = true;
      return { ok: true, cost: d.cost };
    }
    removeScenery(tx, tz) {
      const w = this.world;
      const o = w.sceneryAt(tx, tz);
      if (!o) return { ok: false, reason: 'No hay nada' };
      const natural = w.isTree(o);
      const cost = natural ? C.TREE_CLEAR_COST : 0;
      if (cost && !this.canAfford(cost)) return { ok: false, reason: 'No tienes suficiente dinero' };
      w.removeSceneryAt(tx, tz);
      if (cost) this.spend('terreno', cost, (tx + 0.5) * T, (tz + 0.5) * T);
      else if (Cat.decor[o.type]) this.econ.refund('construccion', Math.round(Cat.decor[o.type].cost * 0.3));
      return { ok: true, cost };
    }
    terrainEdit(op, tx0, tz0, tx1, tz1, opts) {
      opts = opts || {};
      let block = 0;
      for (const tr of this.tracks) if (tr.state === 'open' || tr.state === 'testing') block |= tr.bit;
      const res = this.world.terrainEdit(op, tx0, tz0, tx1, tz1, Object.assign({ blockTrack: block }, opts));
      if (!res.changed) return { ok: false, reason: 'No se puede modificar aquí', cost: 0 };
      const cost = Math.max(10, Math.round(res.cost * C.TERRAIN_COST * (this.machineryBonus ? 0.6 : 1)));
      if (!this.canAfford(cost)) { this.world.undoTerrain(res.undo); return { ok: false, reason: 'No tienes suficiente dinero', cost }; }
      this.spend('terreno', cost, (tx0 + tx1 + 1) * T / 2, (tz0 + tz1 + 1) * T / 2);
      /* trees and tracks follow the new ground */
      this.world.sceneryVer++;
      for (const tr of this.tracks) {
        if (!tr.S) continue;
        const touch = tr.tiles.some(t => { const x = t % this.world.N, z = (t / this.world.N) | 0; return x >= tx0 - 2 && x <= tx1 + 2 && z >= tz0 - 2 && z <= tz1 + 2; });
        if (touch) this.trackGeometryChanged(tr, false);
      }
      for (const b of this.buildings.values()) {
        if (b.tx + b.w >= tx0 - 1 && b.tx <= tx1 + 1 && b.tz + b.h >= tz0 - 1 && b.tz <= tz1 + 1) this.touchBuildings(b);
      }
      this.fieldsDirty = true;
      return { ok: true, cost };
    }
    paintGround(tx0, tz0, tx1, tz1, type) {
      let n = 0;
      for (let z = tz0; z <= tz1; z++) for (let x = tx0; x <= tx1; x++) if (this.world.paintGround(x, z, type)) n++;
      if (!n) return { ok: false, reason: 'Nada que pintar' };
      const cost = n * C.PAINT_COST;
      this.spend('terreno', cost);
      return { ok: true, cost };
    }
    buyParcel(px, pz) {
      const w = this.world;
      if (w.parcelState(px, pz) !== 1) return { ok: false, reason: w.parcelState(px, pz) === 2 ? 'Ya es tuyo' : 'Aún no está a la venta' };
      const price = w.parcelPrice(px, pz);
      if (!this.canAfford(price)) return { ok: false, reason: 'No tienes suficiente dinero', cost: price };
      w.buyParcel(px, pz);
      this.spend('terreno', price, (px + 0.5) * C.PARCEL * T, (pz + 0.5) * C.PARCEL * T);
      this.notify('Has comprado una nueva parcela por ' + U.fmtMoney(price) + '.', 'money');
      MX.Bus.emit('land', { px, pz });
      return { ok: true, cost: price };
    }

    /* ---------------- tracks ---------------- */
    newTrack() {
      const used = new Set(this.tracks.map(t => t.slot));
      let slot = 0; while (used.has(slot) && slot < 15) slot++;
      if (used.has(slot)) return null;
      const tr = new MX.Track(null, 'Circuito ' + (this.tracks.length + 1));
      tr.slot = slot;
      tr.pieces = [];
      this.tracks.push(tr);
      this.selectedTrack = tr;
      MX.Bus.emit('track:list');
      return tr;
    }
    trackById(id) { for (const t of this.tracks) if (t.id === id) return t; return null; }
    openTracks() { return this._openCache || (this._openCache = this.tracks.filter(t => t.state === 'open')); }
    /* Apply a geometry edit atomically: fn mutates the track; cost delta charged or refunded. */
    editTrack(tr, fn, reanchor) {
      if (tr.state === 'open') return { ok: false, reason: 'Cierra el circuito para modificarlo' };
      if (tr.state === 'testing') this.endTest(tr);
      const snap = {
        nodes: tr.nodes.map(n => Object.assign({}, n)), features: tr.features.map(f => Object.assign({}, f)), closed: tr.closed,
        pieces: tr.pieces ? tr.pieces.map(p => Object.assign({}, p)) : null, origin: tr.origin ? Object.assign({}, tr.origin) : null
      };
      const oldLen = tr.length;
      const oldCost = tr.geometryCost() + tr.featureCost();
      const r = fn(tr);
      if (r && r.ok === false) return r;
      tr.rebuild(this.world);
      if (reanchor && tr.features.length) tr.reanchorFeatures(this.world, oldLen);
      const newCost = tr.geometryCost() + tr.featureCost();
      tr.computeFootprint(this.world);
      let trees = 0;
      for (const t of tr.tiles) if (this.world.scen[t] >= 0 && this.world.owned[t]) { const o = this.world.scenery.get(this.world.scen[t]); if (this.world.isTree(o)) trees++; }
      const delta = newCost - oldCost + trees * C.TREE_CLEAR_COST;
      if (delta > 0 && !this.canAfford(delta)) {
        tr.nodes = snap.nodes; tr.features = snap.features; tr.closed = snap.closed; tr.pieces = snap.pieces; tr.origin = snap.origin;
        tr.rebuild(this.world); tr.computeFootprint(this.world);
        return { ok: false, reason: 'No tienes suficiente dinero', cost: delta };
      }
      this.trackGeometryChanged(tr, true);
      if (delta > 0) this.spend('construccion', delta);
      /* undoing work on a circuit that never opened gives the money back in full */
      else if (delta < 0) this.econ.refund('construccion', Math.round(-delta * (tr.state === 'building' ? 1 : C.REFUND_RATE)));
      tr.paid = Math.max(0, tr.paid + delta);
      return { ok: true, cost: delta };
    }
    trackGeometryChanged(tr, clearTrees) {
      const w = this.world;
      if (!clearTrees) tr.rebuild(w);
      tr.computeFootprint(w);
      if (clearTrees) for (const t of tr.tiles) {
        if (w.owned[t] && w.scen[t] >= 0) { const o = w.scenery.get(w.scen[t]); if (w.isTree(o)) w.removeSceneryAt(t % w.N, (t / w.N) | 0); }
      }
      tr.applyOccupancy(w);
      if (tr.closed) tr.validate(w);
      tr.stats = null; tr.statsTested = false;
      tr.ver++;
      this.fieldsDirty = true;
      this._openCache = null;
      MX.Bus.emit('track:changed', { track: tr });
    }
    addFeature(tr, type, s) {
      const d = Cat.features[type];
      if (!this.isUnlocked(d)) return { ok: false, reason: 'Bloqueado: necesitas investigarlo' };
      const chk = tr.checkFeature(type, s);
      if (!chk.ok) return chk;
      if (!this.canAfford(d.cost)) return { ok: false, reason: 'No tienes suficiente dinero' };
      return this.editTrack(tr, (t) => { t.addFeature(type, chk.s0, chk.len, chk.side); });
    }
    removeFeature(tr, uid) {
      const f = tr.features.find(x => x.uid === uid);
      if (f && f.type === 'start' && tr.pieces) return { ok: false, reason: 'La parrilla forma parte del circuito: no se puede quitar' };
      return this.editTrack(tr, (t) => {
        const ff = t.features.find(x => x.uid === uid);
        if (!ff) return { ok: false, reason: 'No encontrado' };
        /* a jump piece becomes a plain straight; a banked curve loses its banking */
        if (ff.auto === 'bank') { for (let i = ff.pin; i < t.pieces.length && t.pieces[i].t === 'curve' && t.pieces[i].bank; i++) t.pieces[i].bank = 0; }
        else if (ff.pin != null && t.pieces && t.pieces[ff.pin] && t.pieces[ff.pin].t === 'special') {
          const pc = t.pieces[ff.pin];
          pc.n = pc._g ? pc._g.n : MX.Track.pieceUnits(pc, 0); pc.t = 'straight'; delete pc.f;
        }
        t.removeFeature(uid);
      });
    }

    /* ---------------- piece-by-piece construction ---------------- */
    placeStart(tr, x, z, h, w, surf) {
      if (!tr.pieces) return { ok: false, reason: 'Este circuito usa el trazado libre antiguo' };
      if (tr.pieces.length) return { ok: false, reason: 'La parrilla de salida ya está colocada' };
      const pr = tr.probeStart(this.world, x, z, h, w, surf);
      if (!pr.ok) return pr;
      if (!this.canAfford(pr.cost)) return { ok: false, reason: 'No tienes suficiente dinero' };
      return this.editTrack(tr, (t) => {
        t.origin = { x, z, h }; t.e0 = 0; t.closed = false;
        t.pieces = [{ t: 'start', slope: 0, bank: 0, w, surf }];
        t.features = [];
        t.pinFeature('start', 0, MX.Track.START_GATE);
      });
    }
    buildPiece(tr, p) {
      if (p.t === 'special' && !this.isUnlocked(Cat.features[p.f])) return { ok: false, reason: 'Bloqueado: necesitas investigarlo' };
      if (p.t === 'curve' && p.bank === 2 && !this.isUnlocked(Cat.features.berm_big)) return { ok: false, reason: 'El peralte grande necesita investigación' };
      if (!this.isUnlocked(Cat.surfaces[p.surf])) return { ok: false, reason: 'Superficie bloqueada: investígala' };
      const pr = tr.probePiece(this.world, p);
      if (!pr.ok) return pr;
      if (!this.canAfford(pr.cost)) return { ok: false, reason: 'No tienes suficiente dinero', cost: pr.cost };
      const r = this.editTrack(tr, (t) => {
        t.pieces.push(Object.assign({}, p));
        if (p.t === 'special') t.pinFeature(p.f, t.pieces.length - 1, MX.Track.SPECIAL_OFF);
        if (pr.closes) t.closed = true;
      });
      if (r.ok && pr.closes) { r.closes = true; MX.Bus.emit('track:closed-loop', { track: tr }); }
      return r;
    }
    removeLastPiece(tr) {
      if (!tr.pieces) return { ok: false, reason: 'Este circuito usa el trazado libre antiguo' };
      if (tr.pieces.length <= 1) return { ok: false, reason: 'La parrilla de salida no se quita: borra el circuito para empezar de nuevo' };
      return this.editTrack(tr, (t) => {
        const i = t.pieces.length - 1;
        const cut = t.pieces[i]._s0 != null ? t.pieces[i]._s0 : t.length;
        t.pieces.pop(); t.closed = false;
        t.features = t.features.filter(f => f.pin != null ? f.pin < i : (f.s >= 0 && f.s + (f.len || 0) <= cut - 0.5));
      });
    }
    /* Finish the loop automatically with the shortest free chain of pieces. */
    autoComplete(tr, w, surf) {
      if (!tr.pieces || !tr.pieces.length) return { ok: false, reason: 'Coloca primero la parrilla de salida' };
      if (tr.closed) return { ok: false, reason: 'El circuito ya está cerrado' };
      if (!tr.endPose) tr.rebuild(this.world);
      const plan = MX.Track.planClosure(this.world, tr, w, surf);
      if (!plan.ok) return plan;
      /* check the whole loop on a copy before touching the real one */
      const copy = MX.Track.deserialize(tr.serialize(), this.world);
      copy.pieces.push(...plan.pieces.map(p => Object.assign({}, p)));
      copy.closed = true;
      copy.rebuild(this.world);
      const geomErr = copy.validate(this.world).find(i => i.level === 'error' && /cruza|terreno|edificios|agua|otro circuito|Pendiente|imposible|largo/.test(i.msg));
      if (geomErr) return { ok: false, reason: 'No encuentro un cierre limpio: ' + geomErr.msg.toLowerCase() };
      const r = this.editTrack(tr, (t) => { for (const p of plan.pieces) t.pieces.push(Object.assign({}, p)); t.closed = true; });
      if (r.ok) { r.closes = true; r.added = plan.pieces.length; MX.Bus.emit('track:closed-loop', { track: tr }); }
      return r;
    }
    /* Rounded-rectangle loop with a few elements inside rect {x0, z0, w, h} (tiles). */
    suggestLoop(tr, rect, w, surf) {
      if (!tr.pieces) return { ok: false, reason: 'Este circuito usa el trazado libre antiguo' };
      const m = Math.ceil((w * 0.5 + 2.5) / C.TILE);
      const startU = MX.Track.pieceUnits({ t: 'start' }, 0);
      let k = 2, a = rect.w - 2 * m - 6 * k - startU, b = rect.h - 2 * m - 6 * k;
      if (a < 0 || b < 2) { k = 1; a = rect.w - 2 * m - 6 * k - startU; b = rect.h - 2 * m - 6 * k; }
      if (a < 0 || b < 2) return { ok: false, reason: 'No hay sitio para un circuito: deja libre al menos ' + (startU + 6 + 2 * m) + ' x ' + (8 + 2 * m) + ' casillas' };
      const P = (o) => Object.assign({ slope: 0, bank: 0, w, surf }, o);
      const unlocked = (f) => this.isUnlocked(Cat.features[f]);
      const leg = (units, specials) => {
        const out = [];
        for (const f of specials) {
          if (!unlocked(f)) continue;
          const u = MX.Track.pieceUnits({ t: 'special', f }, 0);
          if (u <= units) { out.push(P({ t: 'special', f })); units -= u; }
        }
        while (units > 0) { const n = Math.min(6, units); out.push(P({ t: 'straight', n })); units -= n; }
        return out;
      };
      const turn = (bank) => [P({ t: 'curve', k, dir: 1, bank }), P({ t: 'curve', k, dir: 1, bank })];
      const pieces = [P({ t: 'start' })]
        .concat(leg(a, ['tabletop_m']), turn(1), leg(b, ['rollers', 'tabletop_s']), turn(0), leg(startU + a, ['finish', 'tabletop_s', 'whoops']), turn(1), leg(b, ['whoops']), turn(0));
      const ox = rect.x0 + m + 3 * k, oz = rect.z0 + m;
      let x = ox, z = oz, h = 0;
      for (const p of pieces) { const g = MX.Track.pieceGeom(p, x, z, h, 0); x = g.x1; z = g.z1; h = g.h1; }
      if (x !== ox || z !== oz || h !== 0) return { ok: false, reason: 'No se pudo cerrar el trazado sugerido' };
      return this.editTrack(tr, (t) => {
        t.origin = { x: ox, z: oz, h: 0 }; t.e0 = 0; t.closed = true;
        t.pieces = pieces; t.features = [];
        pieces.forEach((p, i) => {
          if (p.t === 'start') t.pinFeature('start', i, MX.Track.START_GATE);
          else if (p.t === 'special') t.pinFeature(p.f, i, MX.Track.SPECIAL_OFF);
        });
      });
    }
    validateTrack(tr) {
      const issues = tr.validate(this.world).slice();
      const pads = this.buildingsOf('paddock');
      if (!pads.length) issues.push({ level: 'error', msg: 'Construye un paddock: es la base de los pilotos.' });
      else if (!pads.some(b => this.doorTiles(b, 'road').length)) issues.push({ level: 'error', msg: 'El paddock debe tocar una carretera para que lleguen las furgonetas.' });
      if (!this.count('toilets')) issues.push({ level: 'error', msg: 'Faltan baños en el complejo.' });
      if (!this.count('entrance')) issues.push({ level: 'warn', msg: 'Sin taquilla de acceso no vendrán espectadores.' });
      else if (!this.count('parking')) issues.push({ level: 'warn', msg: 'Sin aparcamiento llegarán muy pocos espectadores.' });
      if (tr.entry && pads.length) {
        this.rebuildFields();
        const f = this.fields.get('r_entry_' + tr.id);
        const reach = f && pads.some(b => f.get(b.tx, b.tz) >= 0 || this.doorTiles(b, 'open').some(t => f.get(t.tx, t.tz) >= 0));
        if (!reach) issues.push({ level: 'error', msg: 'Los pilotos no pueden llegar desde el paddock hasta la entrada de pista.' });
      }
      tr.fullIssues = issues;
      return issues;
    }
    openTrack(tr) {
      const issues = this.validateTrack(tr);
      if (issues.some(i => i.level === 'error')) return { ok: false, reason: issues.find(i => i.level === 'error').msg, issues };
      if (!tr.stats) MX.TrackAnalyzer.analyze(tr, this.world, this);
      this.endTest(tr);
      tr.state = 'open';
      this._openCache = null;
      this.fieldsDirty = true;
      this.notify('¡' + tr.name + ' abre al público! Dificultad ' + U.fmt1(tr.stats.diff) + ', valoración ' + U.fmt1(tr.stats.rating) + '.', 'success');
      MX.Bus.emit('track:opened', { track: tr });
      return { ok: true };
    }
    closeTrack(tr) {
      if (this.race && this.race.trackId === tr.id) return { ok: false, reason: 'Hay una carrera en curso' };
      this.endTest(tr);
      tr.state = 'closed';
      this._openCache = null;
      for (const r of this.riders) if (r.trackId === tr.id && (r.state === 'ride' || r.state === 'wait' || r.state === 'toTrack')) {
        if (r.state === 'ride') r.leaveTrack(this, tr); else { r.state = 'rest'; r.timer = 4; }
      }
      this.fieldsDirty = true;
      MX.Bus.emit('track:closed', { track: tr });
      return { ok: true };
    }
    testTrack(tr) {
      const issues = tr.validate(this.world);
      if (issues.some(i => i.level === 'error')) return { ok: false, reason: issues.find(i => i.level === 'error').msg, issues };
      const st = MX.TrackAnalyzer.analyze(tr, this.world, this);
      tr.statsTested = true;
      tr.crashMarks = [];
      if (tr.state !== 'open') {
        tr.state = 'testing';
        /* three test riders of different levels ride two laps */
        const s0 = tr.startS != null ? tr.startS + 3 : 0;
        [26, 55, 86].forEach((sk, k) => {
          const rd = new A.Rider(this, this.rng, { skill: sk, bike: Cat.bikes[sk < 40 ? 1 : sk < 70 ? 2 : 4] });
          rd.name = ['Probador Novato', 'Probador Amateur', 'Probador Experto'][k];
          rd.test = tr.id; rd.cols = [[255, 255, 255], [40, 40, 40], [255, 106, 19], [255, 210, 40]];
          rd.joinTrack(this, tr, s0 - k * 6, (k - 1) * 1.6, 0.5);
          rd.lapsPlan = 2;
          this.riders.push(rd);
        });
      }
      MX.Bus.emit('track:tested', { track: tr, stats: st });
      return { ok: true, stats: st };
    }
    endTest(tr) {
      for (const r of this.riders) if (r.test === tr.id) r.dead = true;
      if (tr.state === 'testing') tr.state = 'closed';
    }
    deleteTrack(tr) {
      if (this.race && this.race.trackId === tr.id) return { ok: false, reason: 'Hay una carrera en curso' };
      this.closeTrack(tr);
      tr.clearOccupancy(this.world);
      /* a circuit that never opened is simply dismantled: everything paid comes back */
      const worth = tr.geometryCost() + tr.featureCost();
      const back = Math.round(tr.state === 'building' ? Math.min(tr.paid, worth) : worth * 0.35);
      this.econ.refund('construccion', back);
      this.tracks = this.tracks.filter(t => t !== tr);
      if (this.selectedTrack === tr) this.selectedTrack = null;
      this._openCache = null; this.fieldsDirty = true;
      MX.Bus.emit('track:list');
      return { ok: true, refund: back };
    }
    trackFit(rider, tr) {
      if (!tr.stats) return 0.5;
      const pref = U.clamp(rider.attr.skill / 10 + 0.6, 1.2, 9.5);
      const d = tr.stats.diff - pref;
      return U.clamp(1 - Math.abs(d) / (d > 0 ? 3 : 4.5), 0, 1) * (0.75 + tr.stats.rating / 40);
    }
    chooseTrack(rider, rng) {
      let best = null, bs = -1;
      for (const tr of this.openTracks()) {
        if (!tr.entry) continue;
        if (this.race && this.race.trackId === tr.id) continue;
        const crowd = this.ridersOn(tr) / Math.max(4, tr.stats ? tr.stats.capacity : 12);
        const s = this.trackFit(rider, tr) - crowd * 0.35 + rng.range(0, 0.15);
        if (s > bs) { bs = s; best = tr; }
      }
      return best;
    }
    ridersOn(tr) { let n = 0; for (const r of this.riders) if (r.trackId === tr.id && r.state === 'ride') n++; return n; }
    ridersOnTracks() { let n = 0; for (const r of this.riders) if (r.state === 'ride') n++; return n; }
    trackTraffic(tr, s, dist) {
      for (const r of this.riders) {
        if (r.state !== 'ride' || r.trackId !== tr.id || !r.m) continue;
        const d = U.mod(s - r.m.s, tr.length);
        if (d < dist || d > tr.length - 3) return true;
      }
      return false;
    }
    trackNeedingCare() {
      let best = null, bw = 0.06;
      for (const tr of this.tracks) {
        if (!tr.S || !tr.entry || tr.state === 'building') continue;
        if (this.race && this.race.trackId === tr.id) continue;
        if (this.staff.some(s => s.role === 'crew' && s.task && s.task.track === tr.id && s.state !== 'idle')) continue;
        const w = tr.avgWear();
        if (w > bw) { bw = w; best = tr; }
      }
      return best;
    }
    nearestTrackPoint(x, z) {
      let best = null, bd = Infinity;
      for (const tr of this.tracks) {
        if (!tr.S) continue;
        const r = tr.nearestS(x, z);
        if (r && r.dist < bd) { bd = r.dist; const i = r.i; best = { x: tr.S.x[i], z: tr.S.z[i], tr, d: r.dist }; }
      }
      return best;
    }

    /* ---------------- navigation fields ---------------- */
    riderPassable(tx, tz, i) {
      const w = this.world;
      if (w.owned[i] !== 1 && w.path[i] !== P.ROAD) return false;
      if (w.isWater(tx, tz)) return false;
      if (w.trackOcc[i]) return false;
      const b = w.bld[i];
      if (b >= 0) { const bb = this.buildings.get(b); if (!bb || !OPEN_AREA[bb.type]) return false; }
      if (w.tileSlope(tx, tz) > 3.5) return false;
      return true;
    }
    rebuildFields() {
      const w = this.world, N = w.N;
      this.fieldVer = (this.fieldVer || 0) + 1;
      const walk = (x, z, i) => { const p = w.path[i]; return p === P.GRAVEL || p === P.PAVED; };
      const rpass = (x, z, i) => this.riderPassable(x, z, i);
      const F = new Map();
      const srcPath = (types, filter) => {
        const out = [];
        for (const b of this.buildings.values()) if (types.includes(b.type) && (!filter || filter(b))) for (const t of this.doorTiles(b, 'path')) out.push(t.i);
        return out;
      };
      const srcOpen = (types, filter) => {
        const out = [];
        for (const b of this.buildings.values()) if (types.includes(b.type) && (!filter || filter(b))) {
          for (const t of this.doorTiles(b, 'open')) out.push(t.i);
          if (OPEN_AREA[b.type]) for (let z = b.tz; z < b.tz + b.h; z++) for (let x = b.tx; x < b.tx + b.w; x++) out.push(w.idx(x, z));
        }
        return out;
      };
      F.set('entrance', PF.bfs(N, srcPath(['entrance']), walk));
      F.set('food', PF.bfs(N, srcPath(['foodtruck', 'restaurant']), walk));
      F.set('toilet', PF.bfs(N, srcPath(['toilets']), walk));
      F.set('shop', PF.bfs(N, srcPath(['shop']), walk));
      F.set('camping', PF.bfs(N, srcPath(['camping']), walk));
      const seatSrc = srcPath(['grandstand', 'grandstand_cov', 'restaurant']);
      for (let i = 0; i < N * N; i++) if (w.addon[i] === MX.World.ADDON.BENCH && w.isWalkable(i % N, (i / N) | 0)) seatSrc.push(i);
      F.set('seat', PF.bfs(N, seatSrc, walk));
      /* viewing spots: path tiles close to open tracks */
      const view = new Set();
      for (const tr of this.tracks) {
        if (!tr.S || tr.state === 'building') continue;
        for (let k = 0; k < tr.S.n; k += 8) {
          const tx = Math.floor(tr.S.x[k] / T), tz = Math.floor(tr.S.z[k] / T);
          const R = Math.ceil((tr.S.w[k] / 2 + 12) / T);
          for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
            const x = tx + dx, z = tz + dz;
            if (!w.inBounds(x, z)) continue;
            const i = w.idx(x, z);
            if (walk(x, z, i)) view.add(i);
          }
        }
      }
      this.viewTiles = view;
      F.set('view', PF.bfs(N, Array.from(view), walk));
      /* exits: path tiles next to parkings, or next to the public road */
      const exits = srcPath(['parking']);
      for (let x = 0; x < N; x++) { const z = w.roadRow - 1; const i = w.idx(x, z); if (walk(x, z, i)) exits.push(i); }
      F.set('exit', PF.bfs(N, exits, walk));
      /* riders and service vehicles (off-road) */
      F.set('r_paddock', PF.bfs(N, srcOpen(['paddock']), rpass));
      F.set('r_shower', PF.bfs(N, srcOpen(['showers']), rpass));
      F.set('r_workshop', PF.bfs(N, srcOpen(['workshop']), rpass));
      F.set('r_food', PF.bfs(N, srcOpen(['foodtruck', 'restaurant']), rpass));
      F.set('r_toilet', PF.bfs(N, srcOpen(['toilets']), rpass));
      F.set('r_school', PF.bfs(N, srcOpen(['school']), rpass));
      F.set('r_depot', PF.bfs(N, srcOpen(['depot']), rpass));
      F.set('r_medical', PF.bfs(N, srcOpen(['medical']), rpass));
      for (const tr of this.tracks) {
        if (!tr.entry) continue;
        const e = tr.entry;
        F.set('r_entry_' + tr.id, PF.bfs(N, [w.idx(e.tx, e.tz)], (x, z, i) => rpass(x, z, i) || i === w.idx(e.tx, e.tz)));
      }
      this.fields = F;
      this.fieldsDirty = false;
      this._openCache = null;
      this.updateWarnings();
      MX.Bus.emit('fields');
    }
    /* in-world warning icons for facilities that cannot work as placed */
    updateWarnings() {
      const ent = this.fields.get('entrance');
      const hasEnt = this.count('entrance') > 0;
      for (const b of this.buildings.values()) {
        const d = Cat.buildings[b.type];
        let warn = null;
        if (d.access === 'road' && !this.doorTiles(b, 'road').length) warn = 'Debe tocar una carretera conectada con la vía pública.';
        else if (d.access === 'path' && b.type !== 'entrance') {
          const doors = this.doorTiles(b, 'path');
          if (!doors.length) warn = 'Sin acceso: une la entrada con un camino.';
          else if (hasEnt && ent && !doors.some(t => ent.get(t.tx, t.tz) >= 0)) warn = 'El camino no llega hasta la taquilla.';
        } else if (b.type === 'entrance' && !this.doorTiles(b, 'path').length) warn = 'Une la taquilla con el aparcamiento mediante caminos.';
        if (!warn && (b.type === 'grandstand' || b.type === 'grandstand_cov') && this.tracks.some(t => t.S) && !this.tracks.some(t => { const n = t.S && t.nearestS(b.cx, b.cz); return n && n.dist < 40; })) warn = 'Demasiado lejos de los circuitos para ver las motos.';
        b.warn = warn;
      }
    }
    fieldReach(key, tx, tz) { const f = this.fields.get(key); return f && f.get(tx, tz) >= 0; }
    countOnTile(tx, tz) {
      let n = 0;
      for (const v of this.visitors) if (v.tx === tx && v.tz === tz && v.state === 'watch') n++;
      return n;
    }
    binNear(tx, tz) {
      const w = this.world;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const x = tx + dx, z = tz + dz;
        if (w.inBounds(x, z) && w.addon[w.idx(x, z)] === MX.World.ADDON.BIN) return true;
      }
      return false;
    }

    /* ---------------- staff ---------------- */
    candidates(role) {
      const rng = new U.RNG((this.day * 131 + role.length * 7919 + this.staff.length) >>> 0);
      const out = [];
      for (let i = 0; i < 3; i++) {
        const s = new A.Staff(this, rng, role, {});
        out.push({ name: s.name, skill: s.skill, salary: s.salary, cols: s.cols });
      }
      return out;
    }
    hire(role, cand) {
      const def = Cat.staff[role];
      if (!this.isUnlocked(def)) return { ok: false, reason: 'Bloqueado' };
      if (def.needs && !this.count(def.needs)) return { ok: false, reason: 'Necesitas: ' + Cat.buildings[def.needs].name };
      const limit = 6 + this.count('office') * 14;
      if (this.staff.length >= limit) return { ok: false, reason: 'Límite de plantilla (' + limit + '). Construye una oficina.' };
      const fee = Math.round(cand.salary * 0.25);
      if (!this.canAfford(fee)) return { ok: false, reason: 'No tienes suficiente dinero' };
      const spawn = this.staffSpawn();
      const s = new A.Staff(this, this.rng, role, Object.assign({}, cand, spawn, { day: this.day }));
      s.cols[2] = cand.cols ? cand.cols[2] : s.cols[2]; s.cols[3] = cand.cols ? cand.cols[3] : s.cols[3];
      this.staff.push(s);
      this.spend('sueldos', fee);
      this.notify(def.name + ' contratado: ' + s.name + '.', 'info', { agent: s });
      MX.Bus.emit('staff');
      return { ok: true, s };
    }
    fire(id) {
      const s = this.staff.find(x => x.id === id);
      if (!s) return { ok: false };
      this.staff = this.staff.filter(x => x !== s);
      this.spend('sueldos', Math.round(s.salary * 0.5));
      MX.Bus.emit('staff');
      return { ok: true };
    }
    staffSpawn() {
      const e = this.buildingsOf('entrance')[0] || this.buildingsOf('paddock')[0] || this.buildingsOf('depot')[0];
      if (e) { const d = this.doorWorldPos(e); return { x: d.x, z: d.z, tx: d.tx, tz: d.tz }; }
      const c = Math.floor(this.world.N / 2);
      return { x: c * T, z: (this.world.roadRow - 2) * T, tx: c, tz: this.world.roadRow - 2 };
    }
    assignBuilding(s, type) {
      if (s.home) { const b = this.buildings.get(s.home); if (b && b.type === type) return b; }
      let best = null, bn = Infinity;
      for (const b of this.buildings.values()) {
        if (b.type !== type) continue;
        const n = this.staff.filter(x => x.home === b.id).length;
        if (n < bn) { bn = n; best = b; }
      }
      s.home = best ? best.id : null;
      return best;
    }
    mechanicsAt(b) { return this.staff.filter(s => s.role === 'mechanic' && s.home === b.id).length; }
    workshopOpen() { return this.staff.some(s => s.role === 'mechanic' && s.home && this.buildings.has(s.home)); }
    schoolOpen() { return this.staff.some(s => s.role === 'coach' && s.home && this.buildings.has(s.home)); }
    cleanerTask(s, rng) {
      const w = this.world, N = w.N;
      const dirty = this.buildingsOf('toilets').filter(b => b.clean < 55);
      if (dirty.length && rng.chance(0.5)) {
        const f = this.fields.get('toilet');
        if (f && f.get(s.tx, s.tz) >= 0) return { kind: 'toilet', field: f, b: (this.nearestBuilding('toilets', s.x, s.z) || {}).id };
      }
      /* nearest litter by BFS from the cleaner */
      const start = w.idx(s.tx, s.tz);
      if (!w.isWalkable(s.tx, s.tz)) {
        const f = this.fields.get('entrance');
        return f && f.get(s.tx, s.tz) >= 0 ? { kind: 'walk', field: f } : null;
      }
      const seen = new Int16Array(N * N).fill(-1);
      const q = [start]; seen[start] = 0;
      let found = -1;
      while (q.length) {
        const i = q.shift();
        if (w.litter[i] > 0) { found = i; break; }
        if (seen[i] > 30) continue;
        const x = i % N, z = (i / N) | 0;
        for (const [dx, dz] of PF.DIRS) {
          const nx = x + dx, nz = z + dz;
          if (!w.isWalkable(nx, nz)) continue;
          const j = w.idx(nx, nz);
          if (seen[j] >= 0) continue;
          seen[j] = seen[i] + 1; q.push(j);
        }
      }
      if (found < 0) return null;
      const field = PF.bfs(N, [found], (x, z, i) => w.isWalkable(x, z), 40);
      return { kind: 'litter', field };
    }
    requestMedic(rider, tr) {
      this.medicJobs.push({ rider: rider.id, t: this.time, track: tr.id });
      if (!this.staff.some(s => s.role === 'medic')) this.notify('Lesión de ' + rider.name + ' y no tienes sanitarios.', 'danger', { agent: rider });
      else this.notify('Lesión en pista: ' + rider.name + '. El sanitario va en camino.', 'warn', { agent: rider });
    }
    takeMedicJob(s) {
      void s;
      return this.medicJobs.shift() || null;
    }
    riderById(id) { for (const r of this.riders) if (r.id === id) return r; return null; }
    riderTreated(rider) {
      rider.m = null; rider.state = 'carried';
      rider.happy = Math.max(10, rider.happy - 15);
      rider.think(this, 'injured', true);
      rider.goLeave(this);
    }
    marshalPost(s) {
      const posts = this.marshalPosts();
      if (!posts.length) return null;
      const idx = this.staff.filter(x => x.role === 'marshal').indexOf(s);
      return posts[idx % posts.length];
    }
    marshalPosts() {
      if (this._posts && this._postsVer === this.fieldVer) return this._posts;
      const posts = [];
      for (const tr of this.tracks) {
        if (!tr.S || tr.state === 'building') continue;
        for (const lip of tr.lips) {
          const i = tr.sIndex(lip.s + 8);
          const hdg = tr.S.hdg[i], nx = -Math.sin(hdg), nz = Math.cos(hdg);
          for (const side of [1, -1]) {
            const off = tr.S.w[i] / 2 + 3.2;
            const x = tr.S.x[i] + nx * off * side, z = tr.S.z[i] + nz * off * side;
            const tx = Math.floor(x / T), tz = Math.floor(z / T);
            if (!this.world.inBounds(tx, tz) || this.world.trackOcc[this.world.idx(tx, tz)] & ~tr.bit) continue;
            posts.push({ x, z, yaw: Math.atan2(-nz * side, -nx * side), track: tr.id, s: lip.s });
            break;
          }
        }
      }
      this._posts = posts; this._postsVer = this.fieldVer;
      return posts;
    }

    /* ---------------- physics context and events from riders ---------------- */
    physCtx(rider, tr) {
      const c = this._ctx || (this._ctx = { emit: (t, m, d) => this.onRiderEvent(t, m, d) });
      c.rng = this.rng; c.time = this.time; c.race = !!rider.race; c.cap = rider.capV != null ? rider.capV : null; c.track = tr;
      return c;
    }
    onRiderEvent(type, m, d) {
      const r = m.rider, tr = this._ctx.track;
      if (!r) return;
      if (type === 'takeoff' && d.planned) {
        this.addExcite(m.x, m.z, 0.6);
        MX.Bus.emit('jump', { x: m.x, z: m.z, rider: r });
      } else if (type === 'land') {
        r.stats.air += d.air;
        if (d.quality === 'clean' && d.air > 0.7) {
          r.stats.clean++;
          r.fun = Math.min(100, r.fun + 2 + d.air);
          if (d.air > 1.3 && this.rng.chance(0.25)) r.think(this, 'nice_jump');
          this.addExcite(m.x, m.z, 0.5 + d.air * 0.4);
        } else if (d.quality === 'hard') {
          if (this.rng.chance(0.3)) r.think(this, 'cased');
          if (tr) tr.addWearAt(m.s, 0.01);
        }
        MX.Bus.emit('land', { x: m.x, z: m.z, q: d.quality, air: d.air });
      } else if (type === 'crash') {
        r.stats.crashes++;
        this.stats.crashesToday++; this.totals.crashes++;
        if (tr) { tr.totals.crashes++; if (tr.state === 'testing') tr.crashMarks.push({ x: m.x, z: m.z }); }
        this.addExcite(m.x, m.z, 2.2);
        const safety = tr && tr.stats ? tr.stats.safety : 0.5;
        const pInj = (0.03 + d.severity * 0.17) * (1.25 - safety) * (1.2 - r.attr.skill / 150) * (r.race ? 1.2 : 1);
        if (!r.test && this.rng.chance(pInj)) {
          m.crash.injured = true;
          this.totals.injuries++;
          if (tr) tr.totals.injuries++;
          this.injuriesMonth = (this.injuriesMonth || 0) + 1;
        }
        /* marshals wave yellow flags upstream */
        let flagged = false;
        for (const s of this.staff) if (s.role === 'marshal' && U.dist2(s.x, s.z, m.x, m.z) < 70 * 70) { s.flagT = 6; flagged = true; }
        if (flagged && tr) for (const o of this.riders) if (o.m && o.trackId === tr.id && o !== r) {
          const dd = U.mod(m.s - o.m.s, tr.length);
          if (dd < 60) o.m.flagSlow = 4.5;
        }
        this.lastCrashT = this.time;
        MX.Bus.emit('crash', { x: m.x, z: m.z, rider: r, severity: d.severity });
      } else if (type === 'remount') {
        void 0;
      }
    }
    addExcite(x, z, v) {
      if (!this.exciteGrid) return;
      const g = this.exciteGrid, n = g.n;
      const cx = Math.floor(x / g.cell), cz = Math.floor(z / g.cell);
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const X = cx + dx, Z = cz + dz;
        if (X < 0 || Z < 0 || X >= n || Z >= n) continue;
        const k = 1 / (1 + (dx * dx + dz * dz) * 0.35);
        g.ev[X + Z * n] = Math.min(4, g.ev[X + Z * n] + v * k);
      }
    }
    updateGrids(dt) {
      const W = this.world.N * T;
      if (!this.exciteGrid) {
        const cell = 8, n = Math.ceil(W / cell);
        this.exciteGrid = { cell, n, ev: new Float32Array(n * n), base: new Float32Array(n * n) };
        this.dustGrid = { cell, n, v: new Float32Array(n * n) };
      }
      const g = this.exciteGrid, n = g.n;
      for (let i = 0; i < g.ev.length; i++) g.ev[i] *= Math.exp(-dt * 0.9);
      g.base.fill(0);
      const dg = this.dustGrid;
      for (let i = 0; i < dg.v.length; i++) dg.v[i] *= Math.exp(-dt * 0.5);
      for (const r of this.riders) {
        if (r.state !== 'ride' || !r.m) continue;
        const cx = Math.floor(r.x / g.cell), cz = Math.floor(r.z / g.cell);
        const val = 0.1 + Math.min(r.m.v, 25) / 60 + (r.race ? 0.25 : 0);
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
          const X = cx + dx, Z = cz + dz;
          if (X < 0 || Z < 0 || X >= n || Z >= n) continue;
          g.base[X + Z * n] += val / (1 + (dx * dx + dz * dz) * 0.4);
        }
        const tr = this.trackById(r.trackId);
        if (tr && !r.m.air && r.m.v > 6) {
          const sd = Cat.surfaces[Cat.surfaceOrder[tr.S.surf[tr.sIndex(r.m.s)]]];
          const k = sd.dust * (1 - tr.moisture) * (this.wateringUnlocked() && this.staff.some(s => s.role === 'crew') ? 0.55 : 1);
          if (cx >= 0 && cz >= 0 && cx < n && cz < n) dg.v[cx + cz * n] = Math.min(3, dg.v[cx + cz * n] + k * dt * 0.8);
        }
      }
    }
    excitementAt(x, z) {
      const g = this.exciteGrid;
      if (!g) return 0;
      const cx = U.clamp(Math.floor(x / g.cell), 0, g.n - 1), cz = U.clamp(Math.floor(z / g.cell), 0, g.n - 1);
      const k = cx + cz * g.n;
      let v = Math.min(1.2, g.base[k]) + g.ev[k] * 0.45;
      if (this.race) v *= 1.6;
      const sc = this.screenBoost(x, z);
      return v + sc;
    }
    screenBoost(x, z) {
      for (const b of this.buildings.values()) if (b.type === 'screen' && U.dist2(x, z, b.cx, b.cz) < 40 * 40) return this.race ? 0.6 : 0.25;
      return 0;
    }
    dustAt(x, z) {
      const g = this.dustGrid;
      if (!g) return 0;
      const cx = U.clamp(Math.floor(x / g.cell), 0, g.n - 1), cz = U.clamp(Math.floor(z / g.cell), 0, g.n - 1);
      let v = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const X = cx + dx, Z = cz + dz;
        if (X >= 0 && Z >= 0 && X < g.n && Z < g.n) v += g.v[X + Z * g.n];
      }
      return v / 3;
    }
    merchBoost() { return (this.flags.merchBoost || 0) + Math.min(0.3, this.prestige / 1500); }

    /* ---------------- traffic on tracks ---------------- */
    updateTraffic(tr, list) {
      list.sort((a, b) => a.m.s - b.m.s);
      const L = tr.length;
      const n = list.length;
      for (let k = 0; k < n; k++) {
        const r = list[k], m = r.m;
        r.capV = null; m.laneBias *= 0.96;
        if (m.crash) continue;
        /* look at the next riders ahead (with wrap) */
        for (let j = 1; j < Math.min(n, 4); j++) {
          const o = list[(k + j) % n];
          if (o === r) break;
          const om = o.m;
          const gap = U.mod(om.s - m.s, L);
          if (gap > 10) break;
          const lateral = Math.abs(om.lane - m.lane);
          if (om.crash) {
            if (gap < 9 && lateral < 1.6) { m.laneBias += (m.lane >= om.lane ? 1 : -1) * 0.3; }
            if (gap < 1.4 && lateral < 0.9 && m.v > 5 && !m.air && this.rng.chance(m.flagSlow > 0 ? 0.05 : 0.25)) MX.RiderPhysics.crash(m, tr, 0.5, this.rng, this._ctx.emit, 'pileup');
            continue;
          }
          if (lateral < 1.5 && gap < 6) {
            const hw = tr.S.w[tr.sIndex(m.s)] * 0.5 - 0.7;
            const leftRoom = hw - om.lane, rightRoom = om.lane + hw;
            const dir = leftRoom > rightRoom ? 1 : -1;
            m.laneBias = U.clamp(m.laneBias + dir * 0.25, -hw, hw);
            if (gap < 3.2 && Math.max(leftRoom, rightRoom) < 1.7) r.capV = Math.max(2, om.v - 0.3);
          }
        }
      }
      /* tractor grooming the track is a slow obstacle */
      for (const s of this.staff) {
        if (s.role !== 'crew' || s.state !== 'groom' || !s.task || s.task.track !== tr.id) continue;
        for (const r of list) {
          const gap = U.mod(s.gs - r.m.s, L);
          if (gap < 14 && Math.abs(r.m.lane - s.glane) < 2.2) r.m.laneBias += (s.glane > 0 ? -1 : 1) * 0.4;
          if (gap < 4 && Math.abs(r.m.lane - s.glane) < 1.6) r.capV = 3;
        }
      }
    }

    /* ---------------- spawning ---------------- */
    weekdayFactor() { return this.isWeekend() ? 1.6 : 0.85; }
    weatherDef() { return Cat.weather[this.weather] || Cat.weather.sunny; }
    raining() { return this.weather === 'rain' || this.weather === 'storm'; }
    rainAmount() { return this.weatherDef().rain; }
    cloudCover() { return { sunny: 0.15, cloudy: 0.65, rain: 0.9, storm: 1, heat: 0.05 }[this.weather] || 0.3; }
    wetness() { return this.tracks.length ? Math.min(1, this.groundWet || 0) : (this.groundWet || 0); }
    screenTint() {
      const w = this.weather;
      if (w === 'storm') return [0.78, 0.8, 0.88];
      if (w === 'rain') return [0.88, 0.9, 0.96];
      if (w === 'heat') return [1.04, 1.0, 0.94];
      return [1, 1, 1];
    }
    marketingBoost(key) {
      let s = 0;
      for (const m of this.marketing) { const d = Cat.marketing.find(x => x.id === m.id); if (d && d[key]) s += d[key]; }
      return s;
    }
    ticketValue(event) {
      if (event && this.race) return this.race.def.ticket * 1.5;
      const best = this.openTracks().reduce((a, t) => Math.max(a, t.stats ? t.stats.rating : 0), 0);
      return (7 + this.rep / 80) * (0.75 + best / 20) * (1 + this.facilityScore() * 0.4);
    }
    eventTicketPrice() { return this.race ? this.race.ticket : this.econ.prices.ticket; }
    parkingCapacity() { let n = 0; for (const b of this.buildings.values()) if (b.type === 'parking') n += b.slots.length; return n; }
    visitorRate() {
      if (!this.count('entrance')) return 0;
      const open = this.openTracks();
      const riding = this.ridersOnTracks();
      let attraction = open.length ? (0.3 + 0.7 * Math.min(1, riding / 6)) * (0.7 + 0.06 * open.reduce((a, t) => Math.max(a, t.stats ? t.stats.rating : 0), 0)) : 0.1;
      const m = this.date().month;
      const fair = 7 + this.rep / 80;
      const priceF = U.clamp(1.25 - 0.07 * (this.econ.prices.ticket - fair), 0.12, 1.4);
      let rate = 0.21 * (0.35 + this.rep / 170) * attraction * Cat.seasonVisitors[m] * this.weekdayFactor() * this.weatherDef().visitors * (1 + this.marketingBoost('visitors')) * priceF;
      rate *= 1 + (this.flags.visitorBoost || 0);
      const cap = this.parkingCapacity() * 4.5 + 25;
      const present = this.visitors.filter(v => !v.event).length;
      if (present > cap) rate *= 0.15;
      if (present > C.MAX_VISITORS * 0.85) rate = 0;
      return rate;
    }
    riderRate() {
      const open = this.openTracks();
      if (!open.length) return 0;
      const m = this.date().month;
      const best = open.reduce((a, t) => Math.max(a, t.stats ? t.stats.rating : 0), 0);
      const appeal = 0.6 + best / 15 + Math.min(0.6, (open.length - 1) * 0.3);
      const fair = 24 + this.rep / 35;
      const feeF = U.clamp(1.3 - 0.045 * (this.econ.prices.riderFee - fair), 0.15, 1.4);
      let rate = 0.05 * (0.45 + this.rep / 260) * appeal * Cat.seasonVisitors[m] * (this.isWeekend() ? 1.5 : 0.9) * this.weatherDef().visitors * (1 + this.marketingBoost('riders')) * feeF;
      if (this.flags.trainingDays > 0) rate *= 2.3;
      return rate;
    }
    paddockCapacity() { return this.buildingsOf('paddock').length * Cat.buildings.paddock.capacity; }
    roadEnds() { const N = this.world.N, row = this.world.roadRow; return [row * N, row * N + N - 1]; }
    routeTo(goalTiles) {
      const goals = new Set(goalTiles);
      const ends = this.roadEnds();
      const start = ends[this.rng.int(0, 1)];
      return MX.Pathing.roadRoute(this.world, start, goals);
    }
    spawnCarTo(b, model, onArrive) {
      const slot = b.slots && b.slots.find(s => !s.used);
      if (!slot) return null;
      const roads = this.doorTiles(b, 'road');
      if (!roads.length) return null;
      const route = this.routeTo(roads.map(t => t.i));
      if (!route) return null;
      const N = this.world.N;
      const s0 = route[0];
      const c = A.tileCenter(s0 % N, (s0 / N) | 0);
      const car = new A.Car(this, this.rng, { x: c[0] + (s0 % N === 0 ? -6 : 6), z: c[1], yaw: s0 % N === 0 ? 0 : Math.PI, route, lot: b.id, slot, model, onArrive });
      slot.used = car.id;
      this.cars.push(car);
      return car;
    }
    spawnVisitorGroup(eventGuest) {
      const size = this.rng.int(1, 4);
      const lots = this.buildingsOf('parking').filter(b => b.slots.some(s => !s.used) && this.doorTiles(b, 'path').some(t => this.fieldReach('entrance', t.tx, t.tz)));
      if (lots.length && this.cars.length < C.MAX_CARS) {
        const b = this.rng.pick(lots);
        const car = this.spawnCarTo(b, null, (g, carObj) => {
          const tiles = g.doorTiles(b, 'path').filter(t => g.fieldReach('entrance', t.tx, t.tz));
          if (!tiles.length) { carObj.depart(g, g.leaveRoute(carObj)); return; }
          const t = tiles[0];
          for (let i = 0; i < size; i++) {
            const c = A.tileCenter(t.tx, t.tz);
            const v = new A.Visitor(g, g.rng, { x: c[0], z: c[1], tx: t.tx, tz: t.tz, carId: carObj.id, event: eventGuest });
            g.visitors.push(v);
          }
          carObj.members = size;
        });
        if (car && this.econ.prices.parking > 0) this.earn('aparcamiento', this.econ.prices.parking);
        if (car) return true;
      }
      /* walk-in from the public road */
      if (this.rng.chance(0.35)) {
        const w = this.world, N = w.N;
        const cand = [];
        for (let x = 0; x < N; x++) { const z = w.roadRow - 1; if (w.isWalkable(x, z) && this.fieldReach('entrance', x, z)) cand.push(x); }
        if (cand.length) {
          const x = this.rng.pick(cand), z = w.roadRow - 1;
          const c = A.tileCenter(x, z);
          const v = new A.Visitor(this, this.rng, { x: c[0], z: c[1] + 2, tx: x, tz: z, event: eventGuest });
          this.visitors.push(v);
          return true;
        }
      }
      return false;
    }
    leaveRoute(car) {
      const N = this.world.N;
      const b = this.buildings.get(car.lot);
      const roads = b ? this.doorTiles(b, 'road') : [];
      if (!roads.length) return [];
      const ends = this.roadEnds();
      const goal = ends[this.rng.int(0, 1)];
      const r = MX.Pathing.roadRoute(this.world, roads[0].i, new Set([goal]));
      void N;
      return r || [];
    }
    riderSkill(rng) {
      const rep = this.rep;
      const school = this.schoolOpen() ? 0.15 : 0;
      const mag = this.marketingBoost('experts');
      const w = [Math.max(0.08, 0.42 - rep / 3000 + school), 0.33, 0.18 + rep / 2500 + mag * 0.5, 0.05 + rep / 2200 + mag * 0.3];
      const k = rng.weighted([0, 1, 2, 3], (i) => w[i]);
      const ranges = [[12, 31], [32, 55], [56, 77], [78, 96]];
      return rng.range(ranges[k][0], ranges[k][1]);
    }
    spawnRiderVan() {
      const pads = this.buildingsOf('paddock').filter(b => b.slots.some(s => !s.used) && this.doorTiles(b, 'road').length);
      if (!pads.length) return false;
      const present = this.riders.filter(r => !r.race && !r.test).length;
      if (present >= this.paddockCapacity()) return false;
      const b = this.rng.pick(pads);
      const n = this.rng.chance(0.25) ? 3 : this.rng.chance(0.45) ? 2 : 1;
      const car = this.spawnCarTo(b, 'van', (g, van) => {
        for (let i = 0; i < n; i++) {
          let profile = null;
          if (g.passHolders.length && g.rng.chance(0.3)) {
            const free = g.passHolders.filter(p => !g.riders.some(r => r.profileId === p.pid));
            if (free.length) profile = g.rng.pick(free);
          }
          const sk = g.riderSkill(g.rng);
          const r = new A.Rider(g, g.rng, { skill: sk, profile: profile ? profile.data : null, vanId: van.id, paddockId: b.id });
          if (profile) { r.profileId = profile.pid; r.passHolder = true; }
          r.x = van.x + Math.cos(van.yaw + Math.PI / 2) * 1.6 + i; r.z = van.z + Math.sin(van.yaw + Math.PI / 2) * 1.6;
          r.tx = Math.floor(r.x / T); r.tz = Math.floor(r.z / T);
          r.vanSlot = { x: r.x, z: r.z, yaw: van.yaw };
          /* fee */
          if (!r.passHolder) {
            const val = { principiante: 24, amateur: 30, experto: 38, pro: 48 }[r.cat] * (0.75 + g.bestRating() / 20);
            r.feeOk = val;
            if (g.econ.prices.riderFee > val * 1.25) { r.think(g, 'expensive_fee', true); g.stats.refusedFee++; r.goLeave(g); g.riders.push(r); continue; }
            g.earn('tarifas', g.econ.prices.riderFee, r.x, r.z);
          }
          g.stats.ridersToday++; g.totals.riders++;
          g.riders.push(r);
        }
        van.members = n;
      });
      return !!car;
    }
    bestRating() { return this.openTracks().reduce((a, t) => Math.max(a, t.stats ? t.stats.rating : 0), 0); }
    paddockPos(r) {
      if (r.vanSlot) return { x: r.vanSlot.x, z: r.vanSlot.z, tx: Math.floor(r.vanSlot.x / T), tz: Math.floor(r.vanSlot.z / T), yaw: r.vanSlot.yaw };
      const b = this.buildingsOf('paddock')[0];
      if (!b) return null;
      return { x: b.cx, z: b.cz, tx: Math.floor(b.cx / T), tz: Math.floor(b.cz / T), yaw: 0 };
    }
    riderLeaving(r) {
      if (r.test || r.race) return;
      const sat = r.satisfaction();
      this.satR.push(sat); if (this.satR.length > 50) this.satR.shift();
      if (!r.passHolder && sat > 70 && this.rng.chance(0.16 * (1 + this.marketingBoost('passes') * 2))) {
        const val = { principiante: 24, amateur: 30, experto: 38, pro: 48 }[r.cat] * 3.4;
        if (this.econ.prices.pass <= val) {
          r.passHolder = true;
          const pid = U.rng.int(1, 1e9);
          this.passHolders.push({ pid, data: r.profile(), months: 1, since: this.day });
          this.earn('abonos', this.econ.prices.pass, r.x, r.z);
          r.think(this, 'pass_bought', true);
        }
      }
      if (r.passHolder && r.profileId) {
        const p = this.passHolders.find(x => x.pid === r.profileId);
        if (p) p.lastSat = sat;
      }
    }

    /* ---------------- reputation ---------------- */
    facilityScore() {
      const has = (t) => this.count(t) > 0 ? 1 : 0;
      const s = has('toilets') + has('foodtruck') * 0.7 + has('restaurant') * 0.5 + has('shop') * 0.5 + has('showers') + has('workshop')
        + has('medical') + Math.min(1, this.seatsTotal() / 72) + has('parking') + has('entrance') + has('boxes') * 0.5 + has('school') * 0.5;
      return U.clamp(s / 9, 0, 1);
    }
    updateReputation() {
      const avg = (a, d) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : d;
      const vs = avg(this.satV, 50) / 100, rs = avg(this.satR, 50) / 100;
      const open = this.openTracks();
      let tq = 0;
      for (const t of open) if (t.stats) tq = Math.max(tq, t.stats.rating / 10 * (1 - t.avgWear() * 0.4));
      tq = Math.min(1, tq + Math.max(0, open.length - 1) * 0.06);
      const fs = this.facilityScore();
      let litter = 0; for (let i = 0; i < this.world.litter.length; i++) litter += this.world.litter[i];
      const pen = Math.min(150, (this.injuriesMonth || 0) * 12) + Math.min(80, litter * 0.6);
      this.prestige = Math.max(0, this.prestige * 0.997);
      const base = open.length ? (0.3 * vs + 0.27 * rs + 0.25 * tq + 0.18 * fs) * 600 : 40 * fs + 20;
      const target = U.clamp(base + this.prestige - pen + Math.min(60, this.marketing.length * 15), 0, 1000);
      this.rep += (target - this.rep) * 0.025;
      this.rep = U.clamp(this.rep, 0, 1000);
      this.repParts = { vis: vs, rid: rs, track: tq, fac: fs, prestige: this.prestige, pen, target };
    }
    repLabel(v) {
      v = v == null ? this.rep : v;
      if (v < 100) return 'Desconocido';
      if (v < 250) return 'Local';
      if (v < 400) return 'Comarcal';
      if (v < 550) return 'Regional';
      if (v < 700) return 'Nacional';
      if (v < 850) return 'Internacional';
      return 'Leyenda';
    }

    /* ---------------- main loop ---------------- */
    update(realDt) {
      if (this.gameOver) return;
      if (this.fieldsDirty) { this.fieldsT -= realDt; if (this.fieldsT <= 0) { this.rebuildFields(); this.fieldsT = 0.25; } }
      const sp = this.speed;
      if (!sp) return;
      let simDt = Math.min(realDt, 0.1) * sp;
      while (simDt > 1e-6) {
        const h = Math.min(simDt, 1 / 30);
        simDt -= h;
        this.step(h);
      }
    }
    step(dt) {
      this.time += dt;
      if (!this.race || !this.race.freeze) {
        this.dayT += dt;
        if (this.dayT >= C.DAY_SEC) { this.dayT -= C.DAY_SEC; this.newDay(); }
      }
      /* spawning */
      this.spawnAccV += this.visitorRate() * dt;
      while (this.spawnAccV >= 1) { this.spawnAccV -= 1; if (this.visitors.length < C.MAX_VISITORS) this.spawnVisitorGroup(false); }
      if (this.riders.length < C.MAX_RIDERS && this.paddockCapacity()) {
        this.spawnAccR += this.riderRate() * dt;
        while (this.spawnAccR >= 1) { this.spawnAccR -= 1; this.spawnRiderVan(); }
      }
      if (this.comp) this.comp.update(dt);
      /* traffic per track */
      const byTrack = new Map();
      for (const r of this.riders) if (r.state === 'ride' && r.m) {
        if (!byTrack.has(r.trackId)) byTrack.set(r.trackId, []);
        byTrack.get(r.trackId).push(r);
      }
      for (const [id, list] of byTrack) { const tr = this.trackById(id); if (tr) this.updateTraffic(tr, list); }
      const rng = this.rng;
      for (let i = 0; i < this.riders.length; i++) this.riders[i].update(this, dt, rng);
      for (let i = 0; i < this.visitors.length; i++) this.visitors[i].update(this, dt, rng);
      for (let i = 0; i < this.staff.length; i++) this.staff[i].update(this, dt, rng);
      for (let i = 0; i < this.cars.length; i++) this.cars[i].update(this, dt);
      /* injured riders nobody attends */
      for (const job of this.medicJobs) {
        if (this.time - job.t > 28 && !this.staff.some(s => s.role === 'medic' && s.task === job)) {
          const r = this.riderById(job.rider);
          if (r && r.m && r.m.crash) { r.m.crash.injured = false; r.m.crash.dur = 0; r.happy = Math.max(0, r.happy - 30); r.think(this, 'injured', true); r.lapsPlan = 0; this.prestige = Math.max(0, this.prestige - 3); }
          job.dead = true;
        }
      }
      if (this.medicJobs.some(j => j.dead)) this.medicJobs = this.medicJobs.filter(j => !j.dead);
      this.cleanupDead();
      this.gridT -= dt;
      if (this.gridT <= 0) { this.updateGrids(0.2); this.gridT = 0.2; }
      if (this.amb) this.amb.update(dt);
      this.updateTrackSurfaces(dt);
    }
    cleanupDead() {
      if (this.visitors.some(v => v.dead)) {
        const keep = [];
        for (const v of this.visitors) {
          if (!v.dead) { keep.push(v); continue; }
          if (!v.event) { this.satV.push(v.satisfaction()); if (this.satV.length > 80) this.satV.shift(); }
          if (v.seat) this.freeSeat(v.seat);
          if (v.carId) {
            const car = this.cars.find(c => c.id === v.carId);
            if (car) { car.members--; if (car.members <= 0 && car.state === 'parked') car.depart(this, this.leaveRoute(car)); }
          }
        }
        this.visitors = keep;
      }
      if (this.riders.some(r => r.dead)) {
        const keep = [];
        for (const r of this.riders) {
          if (!r.dead) { keep.push(r); continue; }
          if (r.vanId) {
            const van = this.cars.find(c => c.id === r.vanId);
            if (van) { van.members--; if (van.members <= 0 && van.state === 'parked') van.depart(this, this.leaveRoute(van)); }
          }
        }
        this.riders = keep;
      }
      if (this.cars.some(c => c.dead)) {
        for (const c of this.cars) if (c.dead && c.slot) c.slot.used = 0;
        this.cars = this.cars.filter(c => !c.dead);
      }
    }
    updateTrackSurfaces(dt) {
      const w = this.weatherDef();
      for (const tr of this.tracks) {
        if (!tr.S) continue;
        const prevM = tr.moisture;
        tr.moisture = U.clamp(tr.moisture + (w.rain * 0.012 - (1 - w.rain) * w.dry * 0.004) * dt, 0, 1);
        const riding = this.ridersOn(tr);
        tr.dust = U.clamp((tr.dust || 0) + (riding * 0.002 * (1 - tr.moisture) - 0.003) * dt, 0, 1);
        if (Math.abs(prevM - tr.moisture) > 0.0001 && Math.floor(prevM * 10) !== Math.floor(tr.moisture * 10)) tr.visualVer = (tr.visualVer || 0) + 1;
      }
      this.groundWet = U.clamp((this.groundWet || 0) + (w.rain * 0.01 - 0.004) * dt, 0, 1);
    }

    newDay() {
      this.day++;
      const d = this.date();
      /* daily running costs */
      let upkeep = 0;
      for (const b of this.buildings.values()) upkeep += Cat.buildings[b.type].upkeep;
      let salaries = 0;
      for (const s of this.staff) salaries += s.salary;
      let maint = 0;
      for (const tr of this.tracks) if (tr.stats && (tr.state === 'open' || tr.state === 'closed')) maint += tr.stats.maint * (tr.state === 'open' ? 1 : 0.3);
      for (const tr of this.tracks) if (!tr.stats && tr.S && tr.state !== 'building') maint += tr.length * 0.6;
      const md = C.MONTH_DAYS;
      this.spend('mantenimiento', (upkeep * this.flags.maintMul + maint * this.flags.maintMul) / md);
      this.spend('sueldos', salaries / md);
      for (const m of this.marketing) { const def = Cat.marketing.find(x => x.id === m.id); if (def) this.spend('marketing', def.week / 7); m.days--; }
      this.marketing = this.marketing.filter(m => m.days > 0);
      if (this.prog) this.prog.daily();
      /* track wear from the day's laps */
      for (const tr of this.tracks) if (tr.S && tr.state === 'open') {
        const laps = tr.totals.laps - (tr._lapsYesterday || 0);
        tr._lapsYesterday = tr.totals.laps;
        if (laps > 0) tr.addWear(laps * 0.0012 * (this.wateringUnlocked() && this.staff.some(s => s.role === 'crew') ? 0.75 : 1));
        tr.visualVer = (tr.visualVer || 0) + 1;
      }
      /* toilets get dirty with use */
      for (const b of this.buildings.values()) if (b.type === 'toilets' || b.type === 'showers') b.clean = Math.max(0, b.clean - 4);
      for (const k in this.thoughtStats) { this.thoughtStats[k].n *= 0.85; if (this.thoughtStats[k].n < 0.3) delete this.thoughtStats[k]; }
      for (const k of ['trainingDays', 'visitorBoostDays', 'merchDays', 'maintDays']) if (this.flags[k] > 0) this.flags[k]--;
      if (!this.flags.visitorBoostDays) this.flags.visitorBoost = 0;
      if (!this.flags.merchDays) this.flags.merchBoost = 0;
      if (!this.flags.maintDays) this.flags.maintMul = 1;
      this.updateReputation();
      this.econ.sampleCash(this.day);
      this.history.push({ d: this.day, v: this.stats.visitorsToday, r: this.stats.ridersToday, rep: Math.round(this.rep), money: Math.round(this.econ.money) });
      if (this.history.length > 400) this.history.shift();
      this.stats = Object.assign(this.freshDayStats(), { visitorsTotal: this.stats.visitorsTotal });
      if (this.amb) this.amb.daily();
      if (this.comp) this.comp.daily();
      this.checkBankruptcy();
      if (d.day === 1) this.newMonth();
      MX.Bus.emit('day', { day: this.day });
    }
    newMonth() {
      const closed = this.econ.closeMonth(this.date().monthIndex);
      const interest = this.econ.interest();
      if (interest > 0) this.spend('intereses', interest);
      /* season pass renewals */
      let renew = 0, cancel = 0;
      for (const p of this.passHolders) {
        if (p.lastSat != null && p.lastSat < 45) { p.cancel = true; cancel++; continue; }
        if (this.econ.prices.pass > 260) { p.cancel = true; cancel++; continue; }
        this.earn('abonos', this.econ.prices.pass); p.months++; renew++;
      }
      this.passHolders = this.passHolders.filter(p => !p.cancel);
      this.injuriesMonth = 0;
      this.econ.maxLoan = this.mode === 'sandbox' ? 0 : Math.round((100000 + this.rep * 300 + this.buildings.size * 2000) / 10000) * 10000;
      if (this.amb) this.amb.monthly(closed);
      if (this.prog) this.prog.monthly(closed);
      const profit = this.econ.profit(closed);
      this.notify('Cierre de mes: ' + U.fmtMoneySigned(profit) + ' de beneficio. Abonos renovados: ' + renew + (cancel ? ', bajas: ' + cancel : '') + '.', profit >= 0 ? 'money' : 'warn');
      MX.Bus.emit('month', { record: closed });
    }
    checkBankruptcy() {
      if (this.mode === 'sandbox') return;
      const m = this.econ.money;
      if (m < 0) {
        this.econ.negDays++;
        if (this.econ.negDays === 1 || this.econ.negDays % 7 === 0) this.notify('¡Números rojos! Consigue liquidez (préstamo, precios, recortes) o el banco cerrará el parque.', 'danger');
      } else this.econ.negDays = 0;
      if (m < 0 && (m < C.BANKRUPT_LIMIT || this.econ.negDays > C.BANKRUPT_DAYS)) {
        this.gameOver = { reason: 'bankrupt', day: this.day };
        this.speed = 0;
        MX.Bus.emit('bankrupt', {});
      }
    }

    /* ---------------- serialization ---------------- */
    serialize() {
      const vis = this.visitors.filter(v => v.state !== 'arrive' && !v.event).slice(0, 400).map(v => ({
        n: v.name, x: +v.x.toFixed(1), z: +v.z.toFixed(1), tx: v.tx, tz: v.tz, c: v.cols, k: v.kid ? 1 : 0, h: Math.round(v.happy), f: Math.round(v.fun), m: Math.round(v.money),
        hu: Math.round(v.hunger), th: Math.round(v.thirst), bl: Math.round(v.bladder), en: Math.round(v.energy), ti: Math.round(v.timeIn), ms: Math.round(v.maxStay)
      }));
      return {
        v: C.SAVE_VERSION, mode: this.mode, seed: this.seed, parkName: this.parkName,
        time: this.time, day: this.day, dayT: this.dayT, speed: this.speed,
        rep: this.rep, prestige: this.prestige, weather: this.weather, weatherDays: this.weatherDays, groundWet: this.groundWet || 0,
        unlocked: Array.from(this.unlocked), totals: this.totals, history: this.history, thoughtStats: this.thoughtStats,
        satV: this.satV, satR: this.satR, flags: this.flags, marketing: this.marketing, sponsors: this.sponsors,
        passHolders: this.passHolders, notes: this.notes.slice(0, 30), nextBld: this.nextBld,
        world: this.world.serialize(),
        econ: this.econ.serialize(),
        tracks: this.tracks.map(t => t.serialize()),
        buildings: Array.from(this.buildings.values()).map(b => ({ id: b.id, type: b.type, tx: b.tx, tz: b.tz, rot: b.rot, y: b.y, built: b.built, rev: b.rev, revTotal: b.revTotal, customers: b.customers, clean: b.clean })),
        staff: this.staff.map(s => ({ role: s.role, name: s.name, skill: s.skill, salary: s.salary, x: +s.x.toFixed(1), z: +s.z.toFixed(1), tx: s.tx, tz: s.tz, cols: s.cols, hired: s.hired, worked: s.worked })),
        visitors: vis,
        prog: this.prog ? this.prog.serialize() : null,
        comp: this.comp ? this.comp.serialize() : null,
        amb: this.amb ? this.amb.serialize() : null,
        uid: A.getUid()
      };
    }
    static deserialize(d) {
      const g = new Game();
      g.mode = d.mode; g.seed = d.seed; g.parkName = d.parkName;
      g.time = d.time; g.day = d.day; g.dayT = d.dayT; g.speed = d.speed || 1;
      g.rep = d.rep; g.prestige = d.prestige || 0; g.weather = d.weather || 'sunny'; g.weatherDays = d.weatherDays || 0; g.groundWet = d.groundWet || 0;
      g.unlocked = new Set(d.unlocked || []); g.totals = Object.assign(g.totals, d.totals || {}); g.history = d.history || [];
      g.thoughtStats = d.thoughtStats || {}; g.satV = d.satV || []; g.satR = d.satR || []; g.flags = Object.assign(g.flags, d.flags || {});
      g.marketing = d.marketing || []; g.sponsors = d.sponsors || []; g.passHolders = d.passHolders || []; g.notes = d.notes || [];
      g.rng = new U.RNG((g.seed ^ 0xabcdef) + Math.floor(g.time));
      A.setUid(d.uid || 1);
      g.world = MX.World.deserialize(d.world);
      g.econ = MX.Economy.deserialize(d.econ);
      g.nextBld = d.nextBld || 1;
      for (const bd of d.buildings) {
        const def = Cat.buildings[bd.type];
        if (!def) continue;
        const r = g.rect(bd.type, bd.tx, bd.tz, bd.rot);
        const b = Object.assign({ users: 0, cond: 100 }, bd, { w: r.w, h: r.h });
        g._finishBuilding(b);
        g.buildings.set(b.id, b);
        for (let z = b.tz; z < b.tz + b.h; z++) for (let x = b.tx; x < b.tx + b.w; x++) g.world.bld[g.world.idx(x, z)] = b.id;
        g.nextBld = Math.max(g.nextBld, b.id + 1);
      }
      for (const td of d.tracks) {
        const t = MX.Track.deserialize(td, g.world);
        t.applyOccupancy(g.world);
        if (t.closed) t.validate(g.world);
        if (t.state === 'testing') t.state = 'closed';
        if (t.state !== 'building' && t.closed) MX.TrackAnalyzer.analyze(t, g.world, g);
        g.tracks.push(t);
      }
      for (const sd of d.staff) {
        const s = new A.Staff(g, g.rng, sd.role, { name: sd.name, skill: sd.skill, salary: sd.salary, x: sd.x, z: sd.z, tx: sd.tx, tz: sd.tz, day: sd.hired });
        if (sd.cols) s.cols = sd.cols;
        s.worked = sd.worked || 0;
        g.staff.push(s);
      }
      g.prog = MX.Progression.deserialize(g, d.prog);
      g.comp = MX.Competition.deserialize(g, d.comp);
      g.amb = MX.Ambient.deserialize(g, d.amb);
      g.rebuildFields();
      for (const vd of d.visitors || []) {
        if (!g.world.isWalkable(vd.tx, vd.tz)) continue;
        const v = new A.Visitor(g, g.rng, { x: vd.x, z: vd.z, tx: vd.tx, tz: vd.tz });
        Object.assign(v, { name: vd.n, cols: vd.c, kid: !!vd.k, happy: vd.h, fun: vd.f, money: vd.m, hunger: vd.hu, thirst: vd.th, bladder: vd.bl, energy: vd.en, timeIn: vd.ti, maxStay: vd.ms, state: 'wander', timer: 1 });
        g.visitors.push(v);
      }
      return g;
    }
  }

  /* track helpers used by the game */
  MX.Track.prototype.avgWear = function () { let s = 0; for (let i = 0; i < this.wear.length; i++) s += this.wear[i]; return this.wear.length ? s / this.wear.length : 0; };
  MX.Track.prototype.addWear = function (a) {
    const S = this.S;
    if (!S) return;
    for (let k = 0; k < this.wear.length; k++) {
      const i = Math.min(S.n - 1, Math.round(k * 5 / C.TRACK_DS));
      const sd = Cat.surfaces[Cat.surfaceOrder[S.surf[i]]];
      const corner = Math.abs(S.curv[i]) > 1 / 20 ? 1.5 : 1;
      this.wear[k] = Math.min(1, this.wear[k] + a * sd.wear * corner * (1 + this.moisture));
    }
  };
  MX.Track.prototype.addWearAt = function (s, a) {
    const k = Math.floor(U.mod(s, this.length) / 5);
    if (k >= 0 && k < this.wear.length) this.wear[k] = Math.min(1, this.wear[k] + a);
  };

  MX.Game = Game;
})(window.MX);
