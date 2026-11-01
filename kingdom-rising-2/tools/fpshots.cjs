// node tools/fpshots.cjs outPrefix weapon cls
const { chromium } = require('playwright');
(async () => {
  const [out, wpn = 'swordshield', cls = 'warrior'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/kingdom-rising-2/index.html');
  await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 180000 });
  await p.evaluate(([wpn, cls]) => { const { G, startGame, Game, sim } = window.KR2; const h = Game.newHero({ name: 'T', race: 'highelf', cls, sex: 'm', app: { skin: '#f2dcc4', hair: '#f4ead0', hairStyle: 1, beard: 0, height: 1, build: 0 } }); if (wpn !== 'swordshield') { h.equip.w1 = Game.makeWeapon(wpn, 2); h.equip.w2 = null; } h.introDone = true; startGame(h); const pl = G.player; pl.place(6, 378, Math.atan2(2 - 6, 363 - 378)); sim(0.4); document.getElementById('banner').classList.remove('on'); document.getElementById('hud').hidden = true; window.__pl = pl; }, [wpn, cls]);
  await p.waitForTimeout(300); await p.screenshot({ path: out + '_rest.png', timeout: 120000 });
  await p.evaluate(() => { const { sim } = window.KR2; __pl.rmbDown = true; sim(0.4); });
  await p.screenshot({ path: out + '_block.png', timeout: 120000 });
  await p.evaluate(() => { const { sim } = window.KR2; __pl.rmbDown = false; sim(0.3); __pl.light(); sim(0.17); });
  await p.screenshot({ path: out + '_swing.png', timeout: 120000 });
  await b.close();
})();
