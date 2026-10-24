/* phone tutorial banner: fold, unfold, expand the text */
export default async ({ page, shot, wait, ev, logs }) => {
  const tap = async (sel) => { await page.locator(sel).first().tap(); await wait(350); };
  const tut = async (label) => logs.push(label + ' ' + await ev(() => { const t = document.getElementById('tutorial'), b = t.getBoundingClientRect(); return JSON.stringify({ cls: t.className, top: Math.round(b.top), bottom: Math.round(b.bottom), toasts: Math.round(document.getElementById('toasts').getBoundingClientRect().top) }); }));
  await wait(600);
  await tap('#title button:has-text("Nueva partida")');
  await tap('#modal .btn:has-text("Empezar")');
  await wait(800);
  await tap('#tutorial .btn:has-text("Empezar")');
  await tut('step2');
  await tap('#tutorial .tut-h b');
  await tut('folded');
  await shot('t-folded');
  await tap('#tutorial .tut-h b');
  await tut('unfolded');
  await tap('#tutorial p');
  await tut('expanded');
  await shot('t-expanded');
};
