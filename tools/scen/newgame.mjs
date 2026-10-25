/* the new game dialog: the five environments with their maps, another map, and a
   career game started in the mountains with the chosen map */
export default async ({ page, shot, wait, ev, logs }) => {
  const phone = await ev(() => document.documentElement.classList.contains('phone'));
  const click = async (sel) => { const l = page.locator(sel).first(); if (phone) await l.tap(); else await l.click(); await wait(350); };
  await wait(600);
  await click('#title button:has-text("Nueva partida")');
  await wait(900);
  logs.push('cards ' + await ev(() => Array.from(document.querySelectorAll('.env-card')).map(c => c.querySelector('b').textContent + (c.classList.contains('on') ? '*' : '')).join(' | ')));
  await shot('dialog');
  await click('.env-card[data-env="montana"]');
  logs.push('about ' + await ev(() => document.querySelector('.env-about').textContent));
  await click('.env-head .btn');
  await wait(900);
  await shot('dialog-reroll');
  await click('#modal .btn:has-text("Empezar")');
  await wait(1500);
  logs.push('game ' + await ev(() => { const g = MX.App.game, w = g.world, r = w.heightRange(); return g.mode + ' ' + w.preset + ' seed ' + g.seed + ' h ' + r.min.toFixed(1) + '..' + r.max.toFixed(1); }));
  await shot('started');
};
