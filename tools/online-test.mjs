/* End-to-end test of the online mode against the Firebase emulators (Authentication and
   Firestore running the real firestore.rules). Build first with `node build.mjs --emu`,
   then run it inside the emulators:
     npx firebase-tools emulators:exec --only auth,firestore --project demo-mxtycoon "node tools/online-test.mjs <shotsDir>"
   It serves dist/web-emu over HTTP, gives the page a local copy of the Firebase SDK and
   drives two players: nicknames, cloud saves, publishing, ranking, visits, likes and the
   writes the rules must refuse. Prints PASS/FAIL lines and exits 1 on any failure. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(process.argv[2] || join(root, 'tools/.cache/online-shots'));
mkdirSync(shots, { recursive: true });
const VER = '12.19.0';
const cache = join(root, 'tools/.cache/firebase-' + VER);
mkdirSync(cache, { recursive: true });
for (const f of ['app', 'auth', 'firestore']) {
  const file = join(cache, 'firebase-' + f + '-compat.js');
  if (!existsSync(file)) execSync('curl -sSfL -o "' + file + '" https://www.gstatic.com/firebasejs/' + VER + '/firebase-' + f + '-compat.js');
}
const html = readFileSync(join(root, 'dist/web-emu/index.html'));
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/?')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); return; }
  res.writeHead(404); res.end();
}).listen(5055, '127.0.0.1');

let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); };

/* one browser per player, as on two devices (software WebGL shares one GPU process per browser) */
const browsers = [];
async function player(label) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[' + label + '] pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[' + label + '] console ' + m.text().slice(0, 300)); });
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => {
    const name = route.request().url().split('/').pop();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(join(cache, name)) });
  });
  await page.goto('http://127.0.0.1:5055/');
  await page.waitForFunction(() => window.MX && MX.App && MX.App.game && document.getElementById('loading').hidden, null, { timeout: 120000 });
  return { page, ev: (fn, arg) => page.evaluate(fn, arg), shot: (n) => page.screenshot({ path: join(shots, label + '-' + n + '.png') }) };
}
/* a sandbox park with an open motocross circuit, built from the page */
const buildPark = () => {
  const A = MX.App;
  const g = MX.Game.create({ mode: 'sandbox', seed: 777, preset: 'valle', parkName: 'Pinar de Alicia' });
  A.startGame(g);
  const place = (t, x, z, r) => g.placeBuilding(t, x, z, r || 0);
  place('parking', 26, 76); place('paddock', 50, 76);
  for (let x = 22; x <= 66; x++) g.placePath(x, 73, 1);
  for (let z = 74; z <= 78; z++) g.placePath(29, z, 1);
  place('entrance', 30, 74); place('toilets', 34, 72, 2);
  g.rebuildFields();
  /* the first free, dry and gentle 30 x 22 rectangle away from the road */
  const w = g.world, N = w.N;
  const free = (tx, tz) => w.owned[tx + tz * N] && w.bld[tx + tz * N] < 0 && !w.path[tx + tz * N] && !w.isWater(tx, tz) && w.tileSlope(tx, tz) < 2.5;
  let rect = null;
  for (let z0 = 2; z0 < 46 && !rect; z0 += 2) for (let x0 = 2; x0 < 48 && !rect; x0 += 2) {
    let ok = true;
    for (let z = z0 - 1; z < z0 + 23 && ok; z++) for (let x = x0 - 1; x < x0 + 31; x++) if (!free(x, z)) { ok = false; break; }
    if (ok) rect = { x0, z0, w: 30, h: 22 };
  }
  const tr = g.newTrack('mx');
  const r = rect ? g.suggestLoop(tr, rect, 8, 'dirt') : { ok: false, reason: 'no room' };
  const o = r.ok ? g.openTrack(tr) : r;
  return { suggest: r.ok, open: o.ok, reason: o.reason || r.reason || '', rating: tr.stats && tr.stats.rating, slot: tr.slot, rect };
};

try {
  /* ---------- player A ---------- */
  const A = await player('alicia');
  check('online mode enabled in the web build', await A.ev(() => MX.Online.enabled));
  check('SDK loaded and ready', await A.ev(async () => { await MX.Online.init(); return MX.Online.state; }) === 'ready');
  await A.shot('01-title-signed-out');
  const ua = await A.ev(() => MX.Online._testSignIn('alicia-sub', 'Alicia Pérez'));
  check('A signs in with Google (emulator)', ua.ok && !!ua.uid, ua);
  check('A has no nickname yet', await A.ev(() => MX.Online.nick) === null);
  check('nickname too short refused', !(await A.ev(() => MX.Online.claimNick('al'))).ok);
  check('nickname with spaces refused', !(await A.ev(() => MX.Online.claimNick('al ic'))).ok);
  check('A claims «Alicia»', (await A.ev(() => MX.Online.claimNick('Alicia'))).ok);
  const park = await A.ev(buildPark);
  check('A builds and opens a circuit', park.suggest && park.open && park.rating > 0, park);
  const save = await A.ev(() => MX.Online.saveGame('1', MX.App.game));
  check('A saves to cloud slot 1', save.ok, save);
  const saves = await A.ev(() => MX.Online.listSaves());
  check('A lists the cloud save', saves.some(s => s.slot === '1' && s.park === 'Pinar de Alicia'), saves.map(s => s.slot + ':' + s.park));
  const back = await A.ev(async () => { const r = await MX.Online.loadGame('1'); return r.ok ? r.data.parkName + '|' + r.data.tracks.length : r.reason; });
  check('A loads the cloud save back', back === 'Pinar de Alicia|1', back);
  const pub = await A.ev(() => { const g = MX.App.game; return MX.Online.publish(g, g.tracks[0]); });
  check('A publishes the circuit', pub.ok && !pub.updated, pub);
  const pub2 = await A.ev(() => { const g = MX.App.game; g.tracks[0].name = 'El Pinar MX'; return MX.Online.publish(g, g.tracks[0]); });
  check('A republishes it (update keeps one entry)', pub2.ok && pub2.updated && pub2.id === pub.id, pub2);
  const own = await A.ev((id) => MX.Online.setLike(id, true), pub.id);
  check('A cannot like their own circuit', !own.ok, own.reason);

  /* ---------- player B ---------- */
  const B = await player('roberto');
  await B.shot('00-boot');
  check('second player renders the title park', await B.ev(() => { const r = MX.App.renderer; return !r.lost && r.gl && !r.gl.isContextLost(); }));
  const top0 = await B.ev(() => MX.Online.top({ order: 'best' }));
  check('ranking readable without signing in', top0.ok && top0.list.some(e => e.track === 'El Pinar MX'), top0.reason);
  const ub = await B.ev(() => MX.Online._testSignIn('roberto-sub', 'Roberto Gil'));
  check('B signs in', ub.ok, ub);
  const taken = await B.ev(() => MX.Online.claimNick('alicia'));
  check('B cannot take «alicia» (any case)', !taken.ok && /otro piloto/.test(taken.reason), taken.reason);
  check('B claims «Bobby»', (await B.ev(() => MX.Online.claimNick('Bobby'))).ok);
  const entry = await B.ev(async (id) => { const r = await MX.Online.circuit(id); return r.ok ? { e: r.entry, park: r.data.parkName } : r; }, pub.id);
  check('B opens the published park', entry.park === 'Pinar de Alicia' && entry.e.nick === 'Alicia', entry.park);
  await B.ev((e) => MX.Online.countVisit(e), entry.e);
  await B.ev((e) => MX.Online.countVisit(e), entry.e);
  const vis = await B.ev(async (id) => (await MX.Online.circuit(id)).entry.visits, pub.id);
  check('a visit counts once per session', vis === 1, vis);
  const l1 = await B.ev((id) => MX.Online.setLike(id, true), pub.id);
  const r10 = entry.e.r10;
  check('B likes it (score = rating x10 + 3 per like)', l1.ok && l1.likes === 1, l1);
  const l2 = await B.ev((id) => MX.Online.setLike(id, true), pub.id);
  check('liking twice does not count twice', l2.ok && l2.likes === 1, l2);
  const after = await B.ev(async (id) => (await MX.Online.circuit(id)).entry, pub.id);
  check('score follows the likes', after.score === r10 + 3 && after.likes === 1, { score: after.score, r10 });
  check('B sees their like', await B.ev((id) => MX.Online.liked(id), pub.id));
  const l3 = await B.ev((id) => MX.Online.setLike(id, false), pub.id);
  check('B removes the like', l3.ok && l3.likes === 0, l3);
  await B.ev((id) => MX.Online.setLike(id, true), pub.id);

  /* writes the rules must refuse */
  const denied = await B.ev(async ({ id, auid }) => {
    const db = MX.Online._db(), fv = firebase.firestore.FieldValue, out = {};
    const tryIt = async (k, fn) => { try { await fn(); out[k] = 'ALLOWED'; } catch (e) { out[k] = e.code || e.message; } };
    await tryIt('edit someone else circuit', () => db.doc('circuits/' + id).update({ track: 'Robado' }));
    await tryIt('jump the visits', () => db.doc('circuits/' + id).update({ visits: fv.increment(5) }));
    await tryIt('like without a vote document', () => db.doc('circuits/' + id).update({ likes: fv.increment(1), score: fv.increment(3) }));
    await tryIt('delete someone else circuit', () => db.doc('circuits/' + id).delete());
    await tryIt('overwrite the park data', () => db.doc('circuits/' + id + '/data/park').set({ z: 'x' }));
    await tryIt('read someone else saves', () => db.doc('users/' + auid + '/savedata/1').get());
    await tryIt('publish as someone else', () => db.doc('circuits/' + auid + '_abc_9').set({ uid: auid, nick: 'Alicia', park: 'x', track: 'x', type: 'mx', len: 300, r10: 99, diff: 1, safety: 1, jumps: 1, slot: 9, pts: [], score: 99, likes: 0, visits: 0, v: 1 }));
    await tryIt('publish with a fake score', () => db.doc('circuits/' + firebase.auth().currentUser.uid + '_abc_9').set({ uid: firebase.auth().currentUser.uid, nick: 'Bobby', park: 'x', track: 'x', type: 'mx', len: 300, r10: 50, diff: 1, safety: 1, jumps: 1, slot: 9, pts: [], score: 999, likes: 0, visits: 0, v: 1 }));
    await tryIt('take a nickname directly', () => db.doc('nicknames/alicia').set({ uid: firebase.auth().currentUser.uid }));
    await tryIt('edit someone else profile', () => db.doc('users/' + auid).set({ nick: 'Hacked', nickLower: 'hacked' }));
    return out;
  }, { id: pub.id, auid: ua.uid });
  for (const k in denied) check('rules refuse: ' + k, denied[k] !== 'ALLOWED', denied[k]);

  /* renaming releases the old nickname */
  check('B renames to «Roberto»', (await B.ev(() => MX.Online.claimNick('Roberto'))).ok);
  const nicks = await B.ev(async () => { const db = MX.Online._db(); return [(await db.doc('nicknames/bobby').get()).exists, (await db.doc('nicknames/roberto').get()).exists]; });
  check('old nickname freed, new one taken', !nicks[0] && nicks[1], nicks);

  /* the ranking window and a visit through the interface */
  await B.ev(() => MX.App.showTitle());
  await B.page.waitForTimeout(800);
  await B.shot('02-title-signed-in');
  await B.ev(() => MX.OnlineUI.rankingPanel());
  await B.page.waitForSelector('.rk-row', { timeout: 20000 });
  await B.page.waitForTimeout(300);
  await B.shot('03-ranking');
  check('ranking window lists the circuit', await B.ev(() => Array.from(document.querySelectorAll('.rk-row .rk-name b')).map(e => e.textContent).includes('El Pinar MX')));
  await B.page.click('.rk-row .btn:has-text("Visitar")');
  await B.page.waitForFunction(() => MX.App.game && MX.App.game.visit && document.querySelector('.visit-bar'), null, { timeout: 30000 });
  await B.page.waitForTimeout(1500);
  await B.shot('04-visit');
  const v = await B.ev(() => ({ park: MX.App.game.parkName, bar: document.querySelector('.visit-bar').textContent, liked: document.querySelector('.visit-bar .like').classList.contains('on') }));
  check('visit mode shows the owner park and the bar', v.park === 'Pinar de Alicia' && /Alicia/.test(v.bar), v);
  check('visit bar shows the existing like', v.liked);
  const blocked = await B.ev(async () => { const before = MX.Save.meta('auto'); await MX.App.autosave(); const after = MX.Save.meta('auto'); return JSON.stringify(before) === JSON.stringify(after); });
  check('nothing is saved while visiting', blocked);
  await B.page.click('.visit-bar .btn.danger');
  await B.page.waitForTimeout(800);
  check('leaving the visit returns to the title', await B.ev(() => !document.getElementById('title').hidden && !document.querySelector('.visit-bar')));

  /* A renames: the published circuit follows, then A takes it down */
  check('A renames to «AliciaMX»', (await A.ev(() => MX.Online.claimNick('AliciaMX'))).ok);
  await A.page.waitForTimeout(500);
  const renamed = await A.ev(async (id) => (await MX.Online.circuit(id)).entry.nick, pub.id);
  check('published circuit shows the new nickname', renamed === 'AliciaMX', renamed);
  const mine = await A.ev(() => MX.Online.top({ mine: true }));
  check('A sees it under «Mis circuitos» with its counters', mine.ok && mine.list.length === 1 && mine.list[0].visits === 1 && mine.list[0].likes === 1, mine.list.map(e => e.track + ' v' + e.visits + ' l' + e.likes));
  await A.ev(() => MX.OnlineUI.rankingPanel());
  await A.page.waitForSelector('.rk-row', { timeout: 20000 });
  await A.shot('05-ranking-owner');
  const un = await A.ev((id) => MX.Online.unpublish(id), pub.id);
  check('A takes the circuit down', un.ok, un);
  const top1 = await A.ev(() => MX.Online.top({ order: 'best' }));
  check('ranking no longer lists it', top1.ok && !top1.list.some(e => e.id === pub.id));
  const del = await A.ev(() => MX.Online.deleteSave('1'));
  check('A deletes the cloud save', del.ok && (await A.ev(() => MX.Online.listSaves())).length === 0);
  await A.ev(() => MX.Online.signOut());
  check('A signs out', await A.ev(() => !MX.Online.user));
} catch (e) {
  fails++;
  console.log('FAIL exception ' + (e && e.stack || e));
}
for (const b of browsers) await b.close();
server.close();
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
