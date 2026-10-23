/* MX Tycoon - model library: voxel riders, bikes, people, staff, vehicles, and
   low-poly trees/rocks. Every model faces +X with its origin on the ground. */
(function (MX) {
  'use strict';
  const V = MX.VoxModel, MB = MX.MeshBuilder;

  /* ---------------- bike + rider ---------------- */
  function bikeBase(vm) {
    const tire = vm.pal('#1d1d1f'), rim = vm.pal('#6f737a'), hub = vm.pal('#b8bcc2');
    const plastic = vm.pal('#ffffff', 1), plasticDark = vm.pal('#c8c8c8', 1);
    const engine = vm.pal('#36383c'), alu = vm.pal('#a9adb3'), pipe = vm.pal('#8a7d6e'), silencer = vm.pal('#c9ccd1');
    const black = vm.pal('#151515'), seat = vm.pal('#202020'), white = vm.pal('#f1f1f1'), gold = vm.pal('#d6a419'), chrome = vm.pal('#d9dde2');
    /* wheels */
    vm.disc(-7, 4, -1, 0, 4, tire, rim, 1.2);
    vm.set(-7, 4, -1, hub).set(-7, 4, 0, hub);
    vm.disc(7.5, 4.2, -1, 0, 4.2, tire, rim, 1.2);
    vm.set(7, 4, -1, hub).set(8, 4, 0, hub);
    /* swingarm */
    vm.box(-7, 4, -2, -2, 4, -2, alu).box(-7, 4, 1, -2, 4, 1, alu);
    /* engine */
    vm.box(-2, 2, -2, 2, 6, 1, engine).box(0, 6, -1, 2, 8, 0, engine);
    vm.box(-1, 3, -3, 1, 4, -3, alu);
    /* exhaust (right side, z +) */
    vm.line(2, 4, 2, 0, 7, 2, pipe).line(0, 7, 2, -5, 8, 2, pipe);
    vm.box(-9, 8, 2, -5, 9, 2, silencer);
    /* frame and steering head */
    vm.line(-2, 8, -1, 5, 10, -1, alu).line(-2, 8, 0, 5, 10, 0, alu);
    vm.box(5, 9, -1, 5, 11, 0, alu);
    /* shrouds and tank */
    vm.box(2, 7, -3, 5, 10, -2, plastic).box(2, 7, 1, 5, 10, 2, plastic);
    vm.box(1, 9, -2, 4, 10, 1, plastic);
    vm.box(3, 8, -3, 4, 8, -3, plasticDark).box(3, 8, 2, 4, 8, 2, plasticDark);
    /* seat */
    vm.box(-7, 10, -2, 1, 10, 1, seat).box(-8, 10, -1, -7, 11, 0, seat);
    /* side panels with number plate */
    vm.box(-6, 7, -3, -3, 9, -3, white).box(-6, 7, 2, -3, 9, 2, white);
    vm.set(-5, 8, -3, black).set(-4, 8, -3, black).set(-5, 8, 2, black).set(-4, 8, 2, black);
    /* rear fender */
    vm.box(-11, 10, -1, -7, 10, 0, plastic).box(-12, 11, -1, -11, 11, 0, plastic);
    /* fork: lower gold legs, upper chrome */
    for (let t = 0; t <= 7; t++) {
      const x = Math.round(7.5 - t * 0.33), y = 4 + t;
      const p = t < 4 ? gold : chrome;
      vm.set(x, y, -2, p).set(x, y, 1, p);
    }
    vm.box(5, 11, -2, 6, 11, 1, black);
    /* front fender and plate */
    vm.box(6, 9, -1, 11, 9, 0, plastic).box(11, 8, -1, 11, 8, 0, plastic);
    vm.box(5, 10, -2, 6, 12, 1, white).set(6, 11, -1, black).set(6, 11, 0, black);
    /* bars */
    vm.box(4, 12, -4, 4, 12, 3, black).set(4, 12, -5, seat).set(4, 12, 4, seat);
  }
  function riderBody(vm, pose) {
    const boot = vm.pal('#ececec'), sole = vm.pal('#202020');
    const pants = vm.pal('#ffffff', 2), pantsD = vm.pal('#d0d0d0', 2);
    const jersey = vm.pal('#ffffff', 3), jerseyD = vm.pal('#d4d4d4', 3);
    const helmet = vm.pal('#ffffff', 4), helmetD = vm.pal('#cfcfcf', 4);
    const glove = vm.pal('#222222'), goggle = vm.pal('#ff8f1f'), lens = vm.pal('#263238');
    const stand = pose === 'stand' || pose === 'air';
    const up = stand ? 3 : 0;
    /* boots on the pegs */
    vm.box(-2, 4, -4, 0, 7, -3, boot).box(-2, 4, 2, 0, 7, 3, boot);
    vm.box(-2, 4, -4, 1, 4, -3, sole).box(-2, 4, 2, 1, 4, 3, sole);
    if (!stand) {
      vm.box(-1, 8, -4, 1, 10, -3, pants).box(-1, 8, 2, 1, 10, 3, pants);
      vm.box(-3, 11, -3, 2, 12, -2, pants).box(-3, 11, 1, 2, 12, 2, pants);
      vm.box(-4, 11, -2, -2, 13, 1, pantsD);
      const rows = [[13, -4, -1], [14, -3, 0], [15, -3, 0], [16, -2, 1]];
      for (const r of rows) vm.box(r[1], r[0], -2, r[2], r[0], 1, jersey);
      vm.box(-3, 14, -2, -3, 15, 1, jerseyD);
      vm.line(0, 16, -3, 3, 13, -3, jersey).line(0, 16, 2, 3, 13, 2, jersey);
      vm.box(3, 12, -3, 4, 13, -3, glove).box(3, 12, 2, 4, 13, 2, glove);
      vm.box(-1, 17, -2, 2, 19, 1, helmet).box(2, 16, -1, 3, 17, 0, helmetD);
      vm.box(2, 19, -2, 4, 19, 1, helmetD);
      vm.box(2, 18, -2, 2, 18, 1, goggle).set(3, 18, -1, lens).set(3, 18, 0, lens);
    } else {
      vm.box(-1, 8, -4, 0, 11, -3, pants).box(-1, 8, 2, 0, 11, 3, pants);
      vm.box(-1, 12, -3, 1, 13, -2, pants).box(-1, 12, 1, 1, 13, 2, pants);
      vm.box(-2, 13, -2, 0, 15, 1, pantsD);
      const rows = [[15 + 1, -2, 1], [16 + 1, -1, 2], [17 + 1, -1, 2], [18 + 1, 0, 2]];
      for (const r of rows) vm.box(r[1], r[0], -2, r[2], r[0], 1, jersey);
      vm.line(1, 18, -3, 3, 14, -3, jersey).line(1, 18, 2, 3, 14, 2, jersey);
      vm.box(3, 12, -3, 4, 13, -3, glove).box(3, 12, 2, 4, 13, 2, glove);
      vm.box(0, 20, -2, 3, 22, 1, helmet).box(3, 19, -1, 4, 20, 0, helmetD);
      vm.box(3, 22, -2, 5, 22, 1, helmetD);
      vm.box(3, 21, -2, 3, 21, 1, goggle).set(4, 21, -1, lens).set(4, 21, 0, lens);
    }
    void up;
  }
  function makeRider(pose) {
    const vm = new V(28, 26, 12, 14, 0, 6, 0.1);
    bikeBase(vm);
    if (pose !== 'bike') riderBody(vm, pose);
    return vm;
  }

  /* ---------------- people ---------------- */
  function person(frame, opts) {
    opts = opts || {};
    const vm = new V(16, 22, 12, 8, 0, 6, 0.1);
    const shoe = vm.pal('#2a2a2a'), pants = vm.pal('#ffffff', 2), shirt = vm.pal('#ffffff', 1), shirtD = vm.pal('#dddddd', 1);
    const skin = vm.pal('#ffffff', 4), hair = vm.pal('#ffffff', 3), eye = vm.pal('#1d1d1d');
    const pose = opts.pose || 'walk';
    if (pose === 'sit') {
      vm.box(2, 0, -2, 3, 0, -1, shoe).box(2, 0, 0, 3, 0, 1, shoe);
      vm.box(2, 1, -2, 3, 4, -1, pants).box(2, 1, 0, 3, 4, 1, pants);
      vm.box(-1, 4, -2, 3, 5, 1, pants);
      vm.box(-1, 6, -2, 1, 10, 1, shirt);
      vm.box(-1, 8, -3, 1, 10, -3, shirtD).box(-1, 8, 2, 1, 10, 2, shirtD);
      vm.box(1, 6, -3, 2, 7, -3, skin).box(1, 6, 2, 2, 7, 2, skin);
      vm.box(0, 11, -1, 0, 11, 0, skin);
      vm.box(-1, 12, -2, 1, 14, 1, skin).box(-1, 15, -2, 1, 15, 1, hair).box(-1, 12, -2, -1, 14, 1, hair);
      vm.set(1, 13, -1, eye).set(1, 13, 0, eye);
      return vm;
    }
    if (pose === 'lie') {
      /* lying on the back along +X (head at +X) */
      vm.box(-7, 0, -2, -6, 1, -1, shoe).box(-7, 0, 0, -6, 1, 1, shoe);
      vm.box(-6, 0, -2, 0, 1, -1, pants).box(-6, 0, 0, 0, 1, 1, pants);
      vm.box(1, 0, -2, 5, 2, 1, shirt);
      vm.box(1, 0, -3, 4, 1, -3, shirtD).box(1, 0, 2, 4, 1, 2, shirtD);
      vm.box(6, 0, -2, 8, 2, 1, skin).box(6, 3, -2, 8, 3, 1, hair);
      return vm;
    }
    const legs = frame === 1 ? [1, -1] : frame === 3 ? [-1, 1] : [0, 0];
    /* legs */
    vm.box(-1 + legs[0], 0, -2, legs[0], 0, -1, shoe).box(-1 + legs[1], 0, 0, legs[1], 0, 1, shoe);
    vm.box(-1 + legs[0], 1, -2, legs[0], 4, -1, pants).box(-1 + legs[1], 1, 0, legs[1], 4, 1, pants);
    vm.box(-1, 5, -2, 0, 7, -1, pants).box(-1, 5, 0, 0, 7, 1, pants);
    /* torso */
    vm.box(-1, 8, -2, 1, 12, 1, shirt);
    if (opts.vest) { const vest = vm.pal(opts.vest); vm.box(-1, 9, -2, 1, 12, 1, vest); vm.box(-1, 10, -2, 1, 10, 1, vm.pal('#e8e8e8')); }
    if (opts.cross) { const red = vm.pal('#d32f2f'); vm.set(1, 11, -1, red).set(1, 11, 0, red).set(1, 10, 0, red).set(1, 12, 0, red); }
    /* arms */
    const armSw = frame === 1 ? [-1, 1] : frame === 3 ? [1, -1] : [0, 0];
    if (pose === 'cheer') {
      vm.box(0, 10, -3, 0, 15, -3, shirtD).box(0, 10, 2, 0, 15, 2, shirtD);
      vm.box(0, 16, -3, 0, 17, -3, skin).box(0, 16, 2, 0, 17, 2, skin);
    } else {
      vm.box(armSw[0], 10, -3, armSw[0], 12, -3, shirtD).box(armSw[1], 10, 2, armSw[1], 12, 2, shirtD);
      vm.box(armSw[0], 7, -3, armSw[0], 9, -3, skin).box(armSw[1], 7, 2, armSw[1], 9, 2, skin);
    }
    /* head */
    vm.box(0, 13, -1, 0, 13, 0, skin);
    vm.box(-1, 14, -2, 1, 16, 1, skin);
    vm.box(-1, 17, -2, 1, 17, 1, hair).box(-1, 14, -2, -1, 16, 1, hair);
    vm.set(1, 15, -1, eye).set(1, 15, 0, eye);
    if (opts.cap) { const cap = vm.pal(opts.cap); vm.box(-1, 17, -2, 1, 18, 1, cap).box(2, 17, -2, 3, 17, 1, cap); }
    if (opts.helmet) { const h = vm.pal(opts.helmet); vm.box(-1, 17, -2, 1, 18, 1, h).box(-2, 16, -2, 2, 16, 1, h); }
    if (opts.broom) {
      const stick = vm.pal('#9a6b3d'), brush = vm.pal('#e0c050');
      vm.line(2, 9, 2, 5, 0, 2, stick); vm.box(4, 0, 1, 6, 0, 3, brush);
    }
    if (opts.flag) {
      const stick = vm.pal('#cfcfcf'), cloth = vm.pal(opts.flag);
      vm.line(1, 8, 2, 2, 19, 2, stick); vm.box(3, 15, 2, 6, 19, 2, cloth);
    }
    if (opts.clip) { const cl = vm.pal('#795548'); vm.box(1, 8, 2, 2, 10, 3, cl); }
    return vm;
  }

  /* ---------------- vehicles ---------------- */
  function car(kind) {
    const vm = new V(40, 20, 16, 20, 0, 8, 0.15);
    const body = vm.pal('#ffffff', 1), bodyD = vm.pal('#cccccc', 1), glass = vm.pal('#2e4452'), tire = vm.pal('#1a1a1a'), rim = vm.pal('#9aa0a6');
    const light = vm.pal('#fff6c8'), tail = vm.pal('#c62828'), bumper = vm.pal('#2b2b2b');
    if (kind === 'van') {
      vm.disc(-9, 2.4, -6, -5, 2.4, tire, rim, 0.9).disc(9, 2.4, -6, -5, 2.4, tire, rim, 0.9);
      vm.box(-15, 2, -6, 14, 11, 5, body);
      vm.box(9, 7, -6, 13, 10, 5, glass).box(14, 4, -5, 14, 5, 4, bumper);
      vm.box(-15, 2, -6, -15, 3, 5, bumper);
      vm.box(-12, 7, -6, 6, 9, -6, bodyD);
      vm.set(14, 6, -5, light).set(14, 6, 4, light).set(-15, 6, -5, tail).set(-15, 6, 4, tail);
      vm.box(-14, 12, -5, 12, 12, 4, vm.pal('#3a3a3a'));
      vm.mirrorZ();
      vm.disc(-9, 2.4, -6, -5, 2.4, tire, rim, 0.9).disc(9, 2.4, -6, -5, 2.4, tire, rim, 0.9);
      return vm;
    }
    if (kind === 'tractor') {
      const green = vm.pal('#ffffff', 1), dark = vm.pal('#2b2b2b'), orange = vm.pal('#ef6c00'), seatC = vm.pal('#202020');
      vm.disc(-6, 4.5, -7, -5, 4.5, tire, vm.pal('#f9a825'), 1.4);
      vm.disc(6, 2.6, -6, -5, 2.6, tire, vm.pal('#f9a825'), 1);
      vm.box(-3, 4, -3, 9, 7, 2, green);
      vm.box(-7, 6, -3, -3, 7, 2, green);
      vm.box(-7, 8, -3, -2, 8, 2, seatC);
      vm.box(-8, 8, -4, -1, 13, -4, glass).box(-8, 14, -4, -1, 14, 3, green);
      vm.box(-8, 8, -4, -8, 13, 3, dark).box(-1, 8, -4, -1, 13, 3, dark);
      vm.box(5, 8, -1, 5, 11, -1, dark);
      /* drag harrow behind */
      vm.box(-18, 1, -7, -12, 1, -7, orange).box(-18, 1, -7, -18, 1, 6, orange);
      for (let z = -7; z <= 6; z += 2) vm.set(-18, 0, z, dark);
      vm.box(-12, 1, -1, -9, 1, 0, orange);
      vm.mirrorZ();
      vm.disc(-6, 4.5, -7, -5, 4.5, tire, vm.pal('#f9a825'), 1.4);
      vm.disc(6, 2.6, -6, -5, 2.6, tire, vm.pal('#f9a825'), 1);
      return vm;
    }
    if (kind === 'truck') {
      const tank = vm.pal('#90caf9'), tankD = vm.pal('#64b5f6'), cab = vm.pal('#ffffff', 1);
      vm.disc(-8, 2.6, -6, -5, 2.6, tire, rim, 1).disc(10, 2.6, -6, -5, 2.6, tire, rim, 1);
      vm.box(8, 3, -5, 15, 10, 4, cab).box(12, 7, -5, 15, 9, 4, glass);
      vm.box(-15, 3, -5, 7, 4, 4, bumper);
      vm.box(-14, 5, -4, 6, 11, 3, tank).box(-14, 5, -4, 6, 5, 3, tankD);
      vm.box(-16, 3, -2, -15, 4, 1, vm.pal('#455a64'));
      vm.mirrorZ();
      vm.disc(-8, 2.6, -6, -5, 2.6, tire, rim, 1).disc(10, 2.6, -6, -5, 2.6, tire, rim, 1);
      return vm;
    }
    /* sedan */
    vm.disc(-8, 2, -6, -5, 2, tire, rim, 0.8).disc(9, 2, -6, -5, 2, tire, rim, 0.8);
    vm.box(-14, 2, -6, 13, 5, 5, body);
    vm.box(-8, 6, -5, 5, 8, 4, glass);
    vm.box(-7, 9, -5, 4, 9, 4, body);
    vm.box(-8, 6, -6, -8, 8, 5, bodyD).box(5, 6, -6, 5, 8, 5, bodyD).box(-1, 6, -6, -1, 8, -6, bodyD);
    vm.box(13, 2, -6, 13, 3, 5, bumper).box(-14, 2, -6, -14, 3, 5, bumper);
    vm.set(13, 4, -5, light).set(13, 4, 4, light).set(-14, 4, -5, tail).set(-14, 4, 4, tail);
    vm.mirrorZ();
    vm.disc(-8, 2, -6, -5, 2, tire, rim, 0.8).disc(9, 2, -6, -5, 2, tire, rim, 0.8);
    return vm;
  }
  function quad() {
    const vm = new V(30, 20, 14, 15, 0, 7, 0.1);
    const tire = vm.pal('#1a1a1a'), rim = vm.pal('#9aa0a6'), red = vm.pal('#d32f2f'), white = vm.pal('#f5f5f5'), dark = vm.pal('#2b2b2b');
    for (const wx of [-6, 6]) { vm.disc(wx, 3, -6, -5, 3, tire, rim, 1); vm.disc(wx, 3, 4, 5, 3, tire, rim, 1); }
    vm.box(-7, 4, -4, 8, 7, 3, red).box(-2, 8, -2, 2, 8, 1, dark).box(6, 8, -4, 6, 9, 3, dark);
    vm.box(-14, 5, -4, -7, 6, 3, white).box(-14, 7, -4, -7, 7, -4, red).box(-14, 7, 3, -7, 7, 3, red);
    vm.set(-11, 7, 0, red).set(-11, 7, -1, red).set(-10, 7, -1, red).set(-12, 7, -1, red);
    return vm;
  }

  /* ---------------- trees and rocks (low poly) ---------------- */
  function pine(mb, seed) {
    const trunk = MB.rgba('#6b4a2e');
    mb.setSlot(0); mb.box(-0.18, 0, -0.18, 0.18, 1.6, 0.18, { col: trunk });
    mb.setSlot(1);
    const g = [0.55, 0.62, 0.7];
    mb.cone(0, 1.0, 0, 1.9, 2.6, 7, [g[0] * 0.75, g[1] * 0.9, g[2] * 0.6, 1], 0.2);
    mb.cone(0, 2.4, 0, 1.45, 2.3, 7, [g[0] * 0.8, g[1] * 0.95, g[2] * 0.62, 1], 0.2);
    mb.cone(0, 3.7, 0, 0.95, 2.1, 6, [g[0] * 0.86, g[1], g[2] * 0.66, 1], 0.2);
    mb.setSlot(0);
    void seed;
  }
  function oak(mb, seed) {
    const trunk = MB.rgba('#6e4c30');
    mb.setSlot(0);
    mb.box(-0.22, 0, -0.22, 0.22, 2.0, 0.22, { col: trunk });
    mb.box(-0.12, 1.6, -0.12, 0.7, 1.8, 0.12, { col: trunk });
    mb.setSlot(1);
    const c = [0.62, 0.78, 0.5, 1];
    mb.blob(0, 3.0, 0, 1.9, 1.35, 1.9, c, seed);
    mb.blob(0.9, 2.6, 0.5, 1.1, 0.9, 1.1, MB.mulCol(c, 0.92), seed + 1);
    mb.blob(-0.7, 3.4, -0.6, 1.1, 0.95, 1.0, MB.mulCol(c, 1.06), seed + 2);
    mb.setSlot(0);
  }
  function poplar(mb, seed) {
    const trunk = MB.rgba('#8a7a62');
    mb.setSlot(0); mb.box(-0.15, 0, -0.15, 0.15, 1.6, 0.15, { col: trunk });
    mb.setSlot(1);
    const c = [0.7, 0.85, 0.48, 1];
    mb.blob(0, 3.9, 0, 0.95, 2.9, 0.95, c, seed, 0.12);
    mb.setSlot(0);
  }
  function bush(mb, seed) {
    mb.setSlot(1);
    const c = [0.58, 0.74, 0.46, 1];
    mb.blob(0, 0.45, 0, 0.8, 0.6, 0.8, c, seed);
    mb.blob(0.5, 0.35, 0.3, 0.55, 0.45, 0.55, MB.mulCol(c, 0.9), seed + 3);
    mb.setSlot(0);
  }
  function rock(mb, seed) {
    mb.setSlot(1);
    mb.blob(0, 0.35, 0, 0.9, 0.6, 0.75, [0.78, 0.76, 0.72, 1], seed, 0.3);
    mb.blob(0.6, 0.2, 0.4, 0.45, 0.35, 0.4, [0.7, 0.68, 0.65, 1], seed + 9, 0.3);
    mb.setSlot(0);
  }

  /* ---------------- library ---------------- */
  const lib = {};
  function add(name, mb) { lib[name] = mb.build(); }
  function buildAll() {
    if (Object.keys(lib).length) return lib;
    add('rider_sit', makeRider('sit').toMesh());
    add('rider_stand', makeRider('stand').toMesh());
    add('bike', makeRider('bike').toMesh());
    for (const f of [0, 1, 2, 3]) add('person_' + f, person(f === 2 ? 0 : f).toMesh());
    add('person_sit', person(0, { pose: 'sit' }).toMesh());
    add('person_lie', person(0, { pose: 'lie' }).toMesh());
    add('person_cheer', person(0, { pose: 'cheer' }).toMesh());
    const staffDefs = {
      mechanic: { cap: '#1e3a8a' },
      crew: { vest: '#ff6d00', helmet: '#fdd835' },
      cleaner: { broom: true, cap: '#2e7d32' },
      medic: { cross: true },
      marshal: { vest: '#ff6d00', flag: '#ffd600' },
      coach: { cap: '#c62828', clip: true }
    };
    for (const k in staffDefs) for (const f of [0, 1, 3]) add('staff_' + k + '_' + f, person(f, staffDefs[k]).toMesh());
    add('car', car('sedan').toMesh());
    add('van', car('van').toMesh());
    add('tractor', car('tractor').toMesh());
    add('truck', car('truck').toMesh());
    add('quad', quad().toMesh());
    const trees = { tree_pine: pine, tree_oak: oak, tree_poplar: poplar, bush, rock };
    for (const k in trees) { const mb = new MB(2048); trees[k](mb, k.length * 7); add(k, mb); }
    return lib;
  }

  MX.Models = { lib, buildAll, person, makeRider, car };
})(window.MX);
