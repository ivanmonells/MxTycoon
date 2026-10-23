export default async ({ page, shot, wait, ev, logs }) => {
  await wait(1000);
  const r = await ev(() => new Promise(res => {
    const A = MX.App, g = A.game, R = A.renderer;
    const acc = { upd: 0, frame: 0, render: 0, agents: 0, hud: 0, n: 0 };
    const wrap = (obj, k, key) => { const f = obj[k].bind(obj); obj[k] = (...a) => { const t = performance.now(); const r = f(...a); acc[key] += performance.now() - t; return r; }; };
    wrap(g, 'update', 'upd'); wrap(A, 'renderFrame', 'frame'); wrap(R, 'render', 'render'); wrap(A, 'pushAgents', 'agents');
    const t0 = performance.now();
    const f = () => { acc.n++; if (acc.n < 30) requestAnimationFrame(f); else { acc.wall = performance.now() - t0; res(acc); } };
    requestAnimationFrame(f);
  }));
  for (const k in r) if (k !== 'n') r[k] = +(r[k] / r.n).toFixed(2);
  logs.push('per-frame ms ' + JSON.stringify(r));
  const info = await ev(() => { const g = MX.App.game; return { vis: g.visitors.length, riders: g.riders.length, staff: g.staff.length, cars: g.cars.length, rt: [MX.App.renderer.rw, MX.App.renderer.rh] }; });
  logs.push(JSON.stringify(info));
};
