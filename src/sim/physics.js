/* MX Tycoon - rider physics on a track (corner limits, braking, jump decisions,
   ballistic flight, landings, crashes) and the track analyzer built on top of it. */
(function (MX) {
  'use strict';
  const C = MX.C, U = MX.U, Cat = MX.Catalog;
  const DS = C.TRACK_DS, G = C.G;
  const SURF = Cat.surfaceOrder.map(k => Cat.surfaces[k]);

  /* Create the motion state for a rider. attr values 0..100 except aggr 0..1. */
  function makeMotion(attr, bike) {
    return {
      s: 0, v: 0, y: 0, vy: 0, air: false, airT: 0, airMax: 0, lane: 0, laneT: 0, laneBias: 0, personal: (Math.random() - 0.5) * 1.6,
      pitch: 0, roll: 0, hdg: 0, x: 0, z: 0, gy: 0,
      crash: null, plans: new Map(), stam: 1, lap: 0, lapStart: 0, lastLap: 0, bestLap: 0, laps: 0,
      attr, bike, bikeCond: 1, throttle: 0, lastS: 0, lapTime: 0, fear: 0, airtimeLap: 0, totalAir: 0,
      cleanJumps: 0, hardLandings: 0, crashes: 0, flagSlow: 0, finishedLaps: 0, vt: 0
    };
  }

  function surfAt(track, i) { return SURF[track.S.surf[i]]; }
  function wetFactor(track, sd) { return 1 - (sd.wet != null ? sd.wet : 0.3) * track.moisture; }
  function wearAt(track, s) {
    const w = track.wear;
    const k = Math.floor(U.mod(s, track.length) / 5);
    return w[U.clamp(k, 0, w.length - 1)] || 0;
  }

  function cornerSpeed(m, track, i) {
    const S = track.S;
    const sd = surfAt(track, i);
    const tech = m.attr.skill / 100;
    const mu = sd.grip * wetFactor(track, sd) * (1 + 0.62 * S.berm[i]) * (0.72 + 0.43 * tech) * m.bike.handling * (1 - 0.12 * wearAt(track, i * DS));
    return S.vc0[i] * Math.sqrt(Math.max(0.15, mu)) * (0.9 + 0.12 * m.attr.aggr);
  }
  function brakeDecel(m, sd) { return 6.4 * (0.82 + 0.32 * m.attr.skill / 100) * Math.min(1, sd.grip + 0.1); }
  function topSpeed(m, sd) {
    return m.bike.top * (0.8 + 0.2 * m.attr.speed / 100) / Math.sqrt(sd.drag) * (0.86 + 0.14 * m.stam) * (1 - 0.08 * (1 - m.bikeCond));
  }

  /* Decide how a rider approaches a lip: jump an option or roll it. */
  function decide(m, track, lip, dist, ctx) {
    const tb = lip.table;
    const rng = ctx.rng || U.rng;
    const skill = m.attr.jump;
    const fearPen = m.fear * 25 + (m.stam < 0.3 ? 10 : 0);
    let choice = null;
    for (const opt of tb.options) {
      const conf = skill + m.attr.aggr * 22 - 12 + (ctx.race ? 6 : 0) - fearPen + rng.normal() * 6;
      if (conf < opt.req) continue;
      /* can we get there fast enough? */
      const a = m.bike.accel * 0.75;
      let vReach = Math.sqrt(m.v * m.v + 2 * a * Math.max(0, dist));
      const S = track.S;
      for (let d = 0; d < dist; d += 2) {
        const i = track.sIndex(m.s + d);
        const vc = cornerSpeed(m, track, i);
        const remain = dist - d;
        vReach = Math.min(vReach, Math.sqrt(vc * vc + 2 * a * remain));
      }
      if (vReach >= opt.vMin + 0.2 || (m.attr.aggr > 0.8 && rng.chance(0.15))) { choice = opt; break; }
    }
    if (ctx.analyzer && ctx.analyzerSkill != null) {
      choice = null;
      for (const opt of tb.options) if (ctx.analyzerSkill >= opt.req) { choice = opt; break; }
    }
    let plan;
    if (choice) {
      const sigma = 0.22 + (100 - skill) / 100 * 1.35;
      const err = ctx.analyzer ? 0 : rng.normal() * sigma;
      const bias = (skill / 100 - 0.5) * (choice.vMax - choice.vMin) * 0.3;
      plan = { jump: true, vJ: U.clamp(choice.mid + bias + err, choice.vMin - 1.4, choice.vMax + 1.4), opt: choice, lap: m.laps };
    } else {
      plan = { jump: false, vJ: U.clamp(Math.max(tb.vRollMax * 0.92, MX.Track.GLUE_SPEED * 0.88), 3.4, 6.5), lap: m.laps };
    }
    m.plans.set(lip, plan);
    return plan;
  }

  function targetSpeed(m, track, ctx) {
    const S = track.S;
    const i0 = track.sIndex(m.s);
    const sd = surfAt(track, i0);
    let vt = topSpeed(m, sd);
    const b = brakeDecel(m, sd);
    const look = 56;
    for (let d = 0; d <= look; d += 2) {
      const i = track.sIndex(m.s + d);
      const vc = cornerSpeed(m, track, i);
      const lim = Math.sqrt(vc * vc + 2 * b * d);
      if (lim < vt) vt = lim;
      if (S.noLip[i] && S.feat[i] >= 0) {
        const fd = Cat.features[track.features[S.feat[i]].type];
        const vw = fd.vb + fd.vs * Math.pow(m.attr.skill / 100, 1.3);
        const l2 = Math.sqrt(vw * vw + 2 * b * d);
        if (l2 < vt) vt = l2;
      }
    }
    /* lips ahead */
    for (const lip of track.lips) {
      let d = lip.s - m.s;
      if (track.S.closed) d = U.mod(d, track.length);
      if (d < 0 || d > 60) continue;
      let plan = m.plans.get(lip);
      if (!plan || plan.lap !== m.laps && d > 50) plan = null;
      if (!plan) plan = decide(m, track, lip, d, ctx);
      const lim = Math.sqrt(plan.vJ * plan.vJ + 2 * b * d);
      if (lim < vt) vt = lim;
    }
    if (m.flagSlow > 0) vt *= 0.62;
    if (ctx.cap != null) vt = Math.min(vt, ctx.cap);
    if (m.crawl) vt = Math.min(vt, m.crawl);
    return vt;
  }

  function preferredLane(m, track) {
    const S = track.S;
    const i = track.sIndex(m.s + 9);
    const hw = S.w[i] * 0.5 - 0.7;
    const k = S.curv[i];
    let lane = m.personal * 0.6;
    if (Math.abs(k) > 1 / 70) {
      const inside = Math.sign(k);
      if (S.berm[i] > 0.3) lane = -inside * hw * 0.78;  // ride high on the berm
      else lane = inside * hw * 0.72;                    // clip the apex
    }
    return U.clamp(lane + m.laneBias, -hw, hw);
  }

  /* Advance one rider. Returns nothing; emits events through ctx.emit(type, m, data). */
  function step(m, track, dt, ctx) {
    const S = track.S;
    if (!S) return;
    ctx = ctx || {};
    const emit = ctx.emit || (() => {});
    const rng = ctx.rng || U.rng;
    const L = track.length;
    const tech = m.attr.skill / 100;
    if (m.flagSlow > 0) m.flagSlow -= dt;

    if (m.crash) {
      const c = m.crash;
      c.t += dt;
      m.v = Math.max(0, m.v - 13 * dt);
      const hw = S.w[track.sIndex(m.s)] * 0.5;
      m.lane = U.approach(m.lane, c.side * (hw - 0.3), dt * 2.2);
      m.s = track.wrapS(m.s + m.v * dt);
      const p = track.poseAt(m.s, m.lane, POSE);
      m.x = p.x; m.z = p.z; m.y = p.y; m.gy = p.y; m.hdg = p.hdg + c.spin * Math.min(1, c.t);
      m.pitch = 0; m.roll = U.approach(m.roll, c.side * 1.35, dt * 5);
      if (!c.injured && c.t >= c.dur) {
        m.crash = null; m.v = 0; m.roll = 0; m.air = false;
        m.fear = Math.min(1, m.fear + 0.25);
        emit('remount', m, {});
      }
      return;
    }

    const prevS = m.s;
    const i0 = track.sIndex(m.s);
    const sd = surfAt(track, i0);
    const vt = targetSpeed(m, track, ctx);
    m.vt = vt;
    if (!m.air) {
      const grip = sd.grip * wetFactor(track, sd);
      const slope = S.slope[i0];
      if (m.v < vt) {
        const vTop = topSpeed(m, sd);
        const a = m.bike.accel * (1 - Math.pow(Math.min(1, m.v / vTop), 2)) * Math.min(1, grip + 0.15) / sd.drag * (0.82 + 0.18 * tech);
        m.v = Math.min(vt, m.v + (a - G * slope * 0.5) * dt);
        m.throttle = U.approach(m.throttle, 1, dt * 6);
      } else {
        m.v = Math.max(vt, m.v - brakeDecel(m, sd) * dt);
        m.throttle = U.approach(m.throttle, 0.15, dt * 8);
      }
      if (m.v < 0.4) m.v = 0.4;
    } else {
      m.throttle = U.approach(m.throttle, 0.6 + 0.4 * Math.sin(m.airT * 9), dt * 10);
    }

    /* integrate with fixed substeps */
    let remaining = dt;
    while (remaining > 1e-6) {
      const h = Math.min(remaining, 1 / 60);
      remaining -= h;
      if (m.air) {
        m.s += m.v * h; m.y += m.vy * h; m.vy -= G * h; m.airT += h;
        const pg = track.poseAt(m.s, m.lane, POSE);
        if (m.airT > 0.05 && m.y <= pg.y) {
          land(m, track, pg, ctx, emit, rng);
          if (m.crash) return finishPose(m, track);
        }
      } else {
        const s1 = m.s + m.v * h;
        /* lip crossing */
        let lipHit = null;
        for (const lip of track.lips) {
          let d0 = lip.s - m.s, d1 = lip.s - s1;
          if (S.closed) { d0 = U.wrapAngle((d0 / L) * Math.PI * 2) * L / (Math.PI * 2); d1 = d0 - m.v * h; }
          if (d0 > 0 && d1 <= 0) { lipHit = lip; break; }
        }
        if (lipHit) {
          const plan = m.plans.get(lipHit);
          const roll = !plan || !plan.jump;
          if (!roll || m.v > Math.max(lipHit.table.vRollMax * 1.12, MX.Track.GLUE_SPEED)) {
            m.air = true; m.airT = 0; m.airMax = 0;
            m.s = lipHit.s + 0.01;
            m.y = S.y[lipHit.i] + track.bankAt(lipHit.i, m.lane);
            m.vy = m.v * lipHit.slope;
            if (!ctx.noAirControl) airControl(m, track, lipHit);
            m.takeoffV = m.v;
            m.plannedJump = !roll;
            emit('takeoff', m, { lip: lipHit, planned: !roll });
          } else {
            m.s = s1;
          }
          m.plans.delete(lipHit);
        } else {
          m.s = s1;
        }
        if (!m.air) {
          const p = track.poseAt(m.s, m.lane, POSE);
          m.y = p.yRide;
        }
      }
      if (S.closed) m.s = U.mod(m.s, L);
      else if (m.s > L) m.s = L;
    }

    /* lane dynamics */
    m.laneT = preferredLane(m, track);
    const hw = S.w[track.sIndex(m.s)] * 0.5 - 0.6;
    m.lane = U.clamp(U.approach(m.lane, m.laneT, dt * (0.8 + m.v * 0.09)), -hw, hw);

    /* overspeed in corners */
    if (!m.air && !ctx.analyzer) {
      const i = track.sIndex(m.s);
      const vc = cornerSpeed(m, track, i);
      if (m.v > vc * 1.12) {
        const over = m.v / vc - 1.12;
        if (rng.chance(over * 3.2 * dt * (1.25 - tech))) {
          crash(m, track, 0.35, rng, emit, 'lowside');
          return finishPose(m, track);
        }
      }
    }

    /* stamina and fatigue */
    m.stam = Math.max(0.05, m.stam - dt * 0.0011 * sd.stamina * (0.5 + m.v / 18) * (1.25 - m.attr.stamina / 100 * 0.6));
    m.fear = Math.max(0, m.fear - dt * 0.01);

    /* lap detection at the finish line */
    if (track.finishS != null) {
      let d0 = U.mod(track.finishS - prevS, L);
      const moved = U.mod(m.s - prevS, L);
      if (moved > 0 && moved < L * 0.5 && d0 > 0 && d0 <= moved) {
        const now = ctx.time || 0;
        if (m.lapStart > 0 || m.laps > 0) {
          const lt = now - m.lapStart;
          m.lastLap = lt;
          if (lt > 5 && (!m.bestLap || lt < m.bestLap)) m.bestLap = lt;
          m.finishedLaps++;
          emit('lap', m, { time: lt, air: m.airtimeLap });
        }
        m.laps++;
        m.lapStart = now;
        m.airtimeLap = 0;
      }
    }
    finishPose(m, track);
  }

  const POSE = {};
  function finishPose(m, track) {
    const p = track.poseAt(m.s, m.lane, POSE);
    m.x = p.x; m.z = p.z; m.gy = p.y;
    if (!m.air && !m.crash) m.y = p.yRide;
    const S = track.S;
    const i = p.i;
    if (!m.crash) {
      m.hdg = p.hdg + U.clamp((m.laneT - m.lane) * 0.08, -0.25, 0.25);
      if (m.air) {
        const tgt = Math.atan2(m.vy, m.v) * 0.85;
        m.pitch = U.lerp(m.pitch, tgt, 0.12);
        m.airMax = Math.max(m.airMax, m.y - m.gy);
      } else {
        const sl = (track.S.yRide[track.sIndex(m.s + 0.8)] - track.S.yRide[track.sIndex(m.s - 0.8)]) / 1.6;
        m.pitch = U.lerp(m.pitch, Math.atan(sl), 0.35);
      }
      const vd = VEH[m.bike.vehicle] || VEH.mx;
      const lean = U.clamp(Math.atan(m.v * m.v * S.curv[i] / G) * (vd.car ? 0.12 : 0.55), -0.62, 0.62) * (S.berm[i] > 0.3 ? 0.55 : 1);
      m.roll = U.lerp(m.roll, m.air ? 0 : lean, 0.15);
      /* flat trackers and buggies slide: the nose points into the corner */
      if (vd.slide || vd.car) {
        const lat = m.v * m.v * S.curv[i] / G;
        const want = m.air ? 0 : U.clamp(lat * (vd.car ? 0.32 : 0.5), -0.6, 0.6);
        m.drift = U.lerp(m.drift || 0, want, 0.08);
        m.hdg += m.drift;
      }
    }
  }
  const VEH = Cat.vehicles;

  /* Riders stretch or shorten a jump in the air (body position, throttle, rear brake). */
  const AC = {};
  function airControl(m, track, lip) {
    const tech = (m.attr.jump * 0.7 + m.attr.skill * 0.3) / 100;
    const range = 0.025 + 0.07 * tech;
    const y0 = m.y, vz = m.vy, base = m.v;
    const impactFor = (v) => {
      track.simulateFlight(lip.s, y0, v, vz, AC);
      return AC.landS - lip.s > lip.maxLand ? 99 : AC.impact;
    };
    let bestV = base, best = impactFor(base);
    if (best < MX.Track.LAND_CLEAN * 0.7) return;
    for (let k = -4; k <= 4; k++) {
      if (!k) continue;
      const v = base * (1 + range * k / 4);
      const imp = impactFor(v);
      if (imp < best - 0.05) { best = imp; bestV = v; }
    }
    m.v = bestV;
  }

  function land(m, track, pg, ctx, emit, rng) {
    const S = track.S;
    const sl = track.slopeAt(m.s);
    const impact = Math.abs((m.vy - m.v * sl) / Math.sqrt(1 + sl * sl));
    const air = m.airT;
    m.air = false; m.y = pg.y;
    m.airtimeLap += air; m.totalAir += air;
    const tech = m.attr.skill / 100;
    const tol = MX.Track.LAND_CLEAN + tech * 1.2, thr = MX.Track.LAND_HARD + tech * 1.6;
    const wear = wearAt(track, m.s);
    let quality;
    if (impact < tol) {
      quality = 'clean';
      m.v *= 0.975;
      if (air > 0.45) m.cleanJumps++;
    } else if (impact < thr) {
      quality = 'hard';
      m.hardLandings++;
      m.v *= U.lerp(0.78, 0.6, (impact - tol) / (thr - tol));
      m.bikeCond = Math.max(0, m.bikeCond - 0.02 - 0.03 * (impact - tol) / (thr - tol));
      if (!ctx.analyzer && rng.chance(0.07 * (1.3 - tech) * (1 + wear))) { emit('land', m, { quality, impact, air }); crash(m, track, 0.5, rng, emit, 'case'); return; }
    } else {
      quality = 'crash';
      m.v *= 0.45;
      const p = U.clamp(0.55 + 0.35 * (impact - thr) / 3 - 0.32 * tech, 0.18, 0.97);
      if (!ctx.analyzer && rng.chance(p)) { emit('land', m, { quality, impact, air }); crash(m, track, U.clamp(0.6 + (impact - thr) * 0.12, 0.6, 1), rng, emit, 'case'); return; }
      m.bikeCond = Math.max(0, m.bikeCond - 0.08);
      quality = 'hard';
    }
    emit('land', m, { quality, impact, air });
  }

  function crash(m, track, severity, rng, emit, kind) {
    m.air = false;
    m.crashes++;
    const S = track.S;
    const hw = S.w[track.sIndex(m.s)] * 0.5;
    m.crash = {
      t: 0, dur: 3 + severity * 4 + rng.range(0, 2), severity, kind,
      side: m.lane >= 0 ? 1 : -1, spin: rng.range(-1.6, 1.6), injured: false
    };
    m.lane = U.clamp(m.lane, -hw, hw);
    m.plans.clear();
    m.bikeCond = Math.max(0, m.bikeCond - 0.05 - severity * 0.12);
    emit('crash', m, { severity, kind });
  }

  /* ---------------- analyzer ---------------- */
  /* the best vehicle of a class a rider of this skill would bring */
  function vehicleFor(cls, skill) {
    const list = Cat.bikes.filter(b => b.vehicle === cls && skill >= b.minSkill && skill <= b.maxSkill);
    if (!list.length) return Cat.bikes.find(b => b.vehicle === cls) || Cat.bikes[2];
    if (cls === 'mx') return skill < 30 ? Cat.bikes[1] : skill < 70 ? Cat.bikes[2] : Cat.bikes[4];
    return list[list.length - 1];
  }
  function virtualRider(skill, cls) {
    const attr = { skill, speed: skill, stamina: 80, jump: skill, aggr: 0.5, exp: skill };
    const m = makeMotion(attr, vehicleFor(cls || 'mx', skill));
    m.personal = 0;
    return m;
  }

  /* Simulate virtual riders and compute difficulty, rating, safety and more. */
  function analyze(track, world, game) {
    const S = track.S;
    if (!S || !track.closed) return null;
    const startF = track.features.find(f => f.type === 'start');
    const finishF = track.features.find(f => f.type === 'finish');
    track.finishS = finishF ? finishF.s + 1 : 0;
    const td = track.typeDef, type = track.type;
    /* four virtual riders spread over the skill range of the discipline */
    const skills = type === 'mx' ? [20, 45, 70, 92] : [0.08, 0.38, 0.68, 0.94].map(k => Math.round(td.skill[0] + (td.skill[1] - td.skill[0]) * k));
    const runs = [];
    const rng = new U.RNG(1234);
    for (const sk of skills) {
      const m = virtualRider(sk, td.vehicle);
      m.s = startF ? startF.s + 3 : track.finishS + 2;
      m.v = 0.5;
      let t = 0, events = { hard: 0, crashRisk: 0, clean: 0, jumps: 0, air: 0 }, maxV = 0, sumV = 0, n = 0;
      const ctx = {
        analyzer: true, analyzerSkill: sk, rng, time: 0,
        emit: (type, mm, d) => {
          if (type === 'land') {
            if (d.quality === 'clean') events.clean++;
            else if (d.quality === 'hard') { events.hard++; if (d.impact > 5) events.crashRisk++; }
            else events.crashRisk++;
            events.air += d.air;
          }
          if (type === 'takeoff' && d.planned) events.jumps++;
        }
      };
      let laps = 0, lap2 = 0, lapStartT = 0;
      const dt = 1 / 30;
      const maxT = track.length / 2 + 200;
      while (t < maxT) {
        const prevLaps = m.laps;
        ctx.time = t;
        step(m, track, dt, ctx);
        t += dt;
        if (m.laps !== prevLaps) {
          laps++;
          if (laps === 2) { lapStartT = t; events = { hard: 0, crashRisk: 0, clean: 0, jumps: 0, air: 0 }; maxV = 0; sumV = 0; n = 0; }
          if (laps === 3) { lap2 = t - lapStartT; break; }
        }
        if (laps >= 2) { maxV = Math.max(maxV, m.v); sumV += m.v; n++; }
      }
      if (!lap2) lap2 = track.length / Math.max(1, sumV / Math.max(1, n)) || 999;
      runs.push({ skill: sk, lap: lap2, maxV, avgV: n ? sumV / n : 0, ...events });
    }
    const desc = track.describe();
    /* jump demands */
    let maxReq = 0, gaps = 0;
    for (const lip of track.lips) {
      const o = lip.table.options[0];
      if (o) { maxReq = Math.max(maxReq, o.req); if (o.gap) gaps++; }
    }
    const surfDiff = desc.surf.reduce((acc, f, k) => acc + f * SURF[k].diff, 0);
    const whoops = track.features.some(f => f.type === 'whoops');
    const kinds = new Set(track.features.map(f => Cat.features[f.type].kind).filter(k => k !== 'start' && k !== 'finish'));
    const jumpCount = track.features.filter(f => Cat.features[f.type].group === 'jump').length;
    const rhythmCount = track.features.filter(f => Cat.features[f.type].group === 'rhythm').length;
    const natural = track.features.filter(f => Cat.features[f.type].group === 'natural');
    const natKinds = new Set(natural.map(f => f.type)).size;
    const pro = runs[3], mid = runs[1];
    let diff = 0.8 + 4.2 * (maxReq / 100) + 1.4 * U.clamp(desc.tight / Math.max(1, desc.corners), 0, 1) + surfDiff * 1.1
      + (whoops ? 0.6 : 0) + 0.8 * U.clamp(desc.elevRange / 12, 0, 1) + (desc.avgW < 7 ? 0.5 : desc.avgW > 10 ? -0.3 : 0)
      + gaps * 0.25 + U.clamp(pro.maxV / 30, 0, 1) * 0.6;
    if (type === 'enduro') diff += natural.length * 0.35 + (desc.avgW < 4.5 ? 0.6 : 0) + U.clamp(desc.climb / 40, 0, 1) * 0.8;
    if (type === 'flat') diff += U.clamp(pro.maxV / 30, 0, 1) * 1.2;
    diff = U.clamp(diff, 0, 10);
    const per100 = desc.corners / Math.max(1, track.length / 100);
    const lenScore = (a, b, w) => track.length >= a && track.length <= b ? w : track.length < a ? track.length / a * w * 0.65 : w * 0.55;
    let rating = 0;
    if (type === 'flat') {
      /* an oval: few corners, room to race side by side, long enough to slide */
      rating += desc.corners >= 2 && desc.corners <= 6 ? 2.6 : desc.corners < 2 ? 1 : 1.2;
      rating += U.clamp((desc.avgW - 6) / 5, 0, 1) * 1.6;
      rating += lenScore(260, 700, 1.6);
      rating += U.clamp(pro.maxV / 30, 0, 1) * 1.4;
      rating += desc.tight === 0 ? 0.8 : 0.2;
      rating += U.clamp(desc.surf[Cat.surfaceOrder.indexOf('clay')] || 0, 0, 1) * 0.8;
    } else if (type === 'enduro') {
      /* a long special through the hills: obstacles, climbs and trees */
      rating += lenScore(700, 2600, 1.8);
      rating += U.clamp(natKinds / 3, 0, 1) * 1.6 + U.clamp(natural.length / 6, 0, 1) * 1.0;
      rating += U.clamp(desc.elevRange / 10, 0, 1) * 1.2 + U.clamp(desc.climb / 30, 0, 1) * 0.6;
      rating += per100 >= 1.5 ? 0.9 : per100 / 1.5 * 0.9;
      rating -= desc.longestStraight > 90 ? 0.5 : 0;
    } else if (type === 'carcross') {
      /* wide, fast and varied, with something to jump or splash through */
      rating += U.clamp((desc.avgW - 8) / 5, 0, 1) * 1.4;
      rating += lenScore(450, 1300, 1.4);
      rating += (per100 >= 1 && per100 <= 4 ? 1.4 : 0.6);
      rating += U.clamp(kinds.size / 3, 0, 1) * 1.4;
      rating += U.clamp(pro.air / 3, 0, 1) * 0.8;
      rating += U.clamp(desc.elevRange / 6, 0, 1) * 0.6 + U.clamp(desc.berms / 3, 0, 1) * 0.5;
      rating += desc.surf.filter(f => f > 0.1).length > 1 ? 0.4 : 0;
    } else {
      rating += U.clamp(pro.air / (type === 'kids' ? 2.5 : 7), 0, 1) * 2.6;
      rating += U.clamp(kinds.size / (type === 'kids' ? 3 : 5), 0, 1) * 1.8;
      rating += U.clamp(jumpCount / (type === 'kids' ? 3 : 6), 0, 1) * 1.0;
      rating += U.clamp(rhythmCount / 2, 0, 1) * 0.6;
      rating += (per100 >= 1.2 && per100 <= 4.5 ? 1.0 : per100 < 1.2 ? per100 / 1.2 * 0.7 : 0.4);
      rating += U.clamp(desc.berms / 4, 0, 1) * 0.6;
      rating += U.clamp(desc.elevRange / 8, 0, 1) * 0.8;
      if (type === 'sx') rating += lenScore(260, 650, 0.9) + U.clamp(jumpCount / Math.max(1, track.length / 100) / 2, 0, 1) * 0.6;
      else if (type === 'kids') rating += lenScore(150, 450, 0.9);
      else rating += track.length >= 450 && track.length <= 1600 ? 0.9 : track.length < 450 ? track.length / 450 * 0.6 : 0.5;
      rating -= desc.longestStraight > (type === 'kids' ? 60 : 130) ? 0.6 : 0;
      rating -= (desc.tight > desc.corners * 0.7 && desc.corners > 3 && type !== 'sx') ? 0.4 : 0;
    }
    /* scenery and atmosphere near the track */
    let scen = 0, stands = 0, safetyItems = [];
    if (world) {
      const near = new Set();
      for (let i = 0; i < S.n; i += 16) {
        const tx = Math.floor(S.x[i] / C.TILE), tz = Math.floor(S.z[i] / C.TILE);
        for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
          const x = tx + dx, z = tz + dz;
          if (world.inBounds(x, z)) near.add(x + z * world.N);
        }
      }
      for (const t of near) {
        const sc = world.scen[t];
        if (sc >= 0) {
          const o = world.scenery.get(sc);
          const dd = Cat.decor[o.type];
          if (dd && dd.scenery) scen += dd.scenery;
          if (dd && dd.safety) safetyItems.push({ x: o.tx * C.TILE + o.ox, z: o.tz * C.TILE + o.oz, v: dd.safety });
        }
        if (game && world.bld[t] >= 0) {
          const b = game.buildings.get(world.bld[t]);
          if (b && (b.type === 'grandstand' || b.type === 'grandstand_cov')) stands++;
        }
      }
    }
    rating += U.clamp(scen / (type === 'enduro' ? 18 : 30), 0, 1) * (type === 'enduro' ? 1.6 : 0.8);
    rating += U.clamp(stands / 8, 0, 1) * (type === 'enduro' ? 0.2 : type === 'sx' ? 0.9 : 0.5);
    rating = U.clamp(rating, 0, 10);
    /* safety: hazards are jump landings and tight corners after fast sections */
    const hazards = [];
    for (const f of track.features) {
      const k = Cat.features[f.type].kind;
      if (k === 'table' || k === 'double' || k === 'triple' || k === 'stepup' || k === 'rhythm' || k === 'logs' || k === 'rocks') {
        const sh = MX.Track.getShape(f.type);
        const i = track.sIndex(f.s + sh.len * 0.75);
        hazards.push({ x: S.x[i], z: S.z[i], w: k === 'double' || k === 'triple' ? 1.4 : k === 'logs' || k === 'rocks' ? 0.6 : 1 });
      }
    }
    for (let i = 0; i < S.n; i += 6) {
      if (Math.abs(S.curv[i]) > 1 / 12) {
        const prev = track.sIndex((i - 50) * DS);
        if (Math.abs(S.curv[prev]) < 1 / 60) {
          if (!hazards.some(h => U.dist2(h.x, h.z, S.x[i], S.z[i]) < 400)) hazards.push({ x: S.x[i], z: S.z[i], w: 0.8 });
        }
      }
    }
    let protectedW = 0, totalW = 0;
    for (const h of hazards) {
      totalW += h.w;
      let p = 0;
      for (const it of safetyItems) if (U.dist2(h.x, h.z, it.x, it.z) < 16 * 16) p += it.v;
      protectedW += h.w * U.clamp(p / 2, 0, 1);
    }
    let safety = 0.42 + 0.42 * (totalW ? protectedW / totalW : 1) + (desc.avgW >= 8 ? 0.08 : 0) + (desc.minW >= 7 ? 0.04 : -0.06)
      - U.clamp(pro.crashRisk * 0.04 + mid.crashRisk * 0.03, 0, 0.25) - gaps * 0.02;
    safety = U.clamp(safety, 0.05, 1);
    const maint = Math.round(track.length * 0.9 * desc.surf.reduce((a, f, k) => a + f * SURF[k].maint, 0) + track.features.length * 30);
    const capacity = Math.max(4, Math.floor(track.length / td.cap));
    /* official homologation tiers only exist for motocross */
    let homolog = 'local';
    if (type === 'mx') {
      if (track.length >= 550 && diff >= 2.5 && diff <= 7.5 && safety >= 0.45) homolog = 'regional';
      if (track.length >= 750 && diff >= 4 && diff <= 8.5 && safety >= 0.6 && desc.avgW >= 7.8) homolog = 'nacional';
      if (track.length >= 900 && diff >= 5 && diff <= 9 && safety >= 0.7 && desc.avgW >= 8.4) homolog = 'internacional';
      if (track.length >= 1050 && diff >= 5.5 && diff <= 9.5 && safety >= 0.8 && desc.avgW >= 9) homolog = 'gp';
    }
    const stats = {
      length: track.length, diff, rating, safety, maint, capacity, homolog,
      lapPro: pro.lap, lapAm: mid.lap, lapBeg: runs[0].lap, lapExp: runs[2].lap,
      maxSpeed: pro.maxV, avgSpeed: pro.avgV, airPro: pro.air, airMid: mid.air, airBeg: runs[0].air,
      jumps: jumpCount, rhythm: rhythmCount, corners: desc.corners, tight: desc.tight, berms: desc.berms,
      elev: desc.elevRange, width: desc.avgW, longest: desc.longestStraight, hazards: hazards.length,
      protectedRatio: totalW ? protectedW / totalW : 1, maxReq, gaps, runs, surf: desc.surf, natural: natural.length, scenery: scen
    };
    track.stats = stats;
    return stats;
  }

  const HOMOLOG_NAMES = { local: 'Local', regional: 'Regional', nacional: 'Nacional', internacional: 'Internacional', gp: 'Gran Premio' };
  const HOMOLOG_RANK = { local: 1, regional: 2, nacional: 3, internacional: 4, gp: 5 };

  MX.RiderPhysics = { makeMotion, step, cornerSpeed, topSpeed, crash, decide, targetSpeed, vehicleFor };
  MX.TrackAnalyzer = { analyze, HOMOLOG_NAMES, HOMOLOG_RANK, difficultyLabel };
  function difficultyLabel(d) {
    if (d < 2) return 'Muy fácil';
    if (d < 3.5) return 'Fácil';
    if (d < 5) return 'Media';
    if (d < 6.5) return 'Difícil';
    if (d < 8) return 'Muy difícil';
    return 'Extrema';
  }
})(window.MX);
