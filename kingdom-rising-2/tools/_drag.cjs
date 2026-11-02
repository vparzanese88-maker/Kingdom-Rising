const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto('http://localhost:8765/kingdom-rising-2/index.html');
  await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 180000 });
  await p.evaluate(() => { const { G, startGame, Game, sim, UI } = window.KR2; const h = Game.newHero({ name: 'T', race: 'orc', cls: 'warrior', sex: 'm', app: { skin: '#7a9a5a', hair: '#222', hairStyle: 1, beard: 0, height: 1, build: 0 } }); h.introDone = true; h.inv[0] = Game.makeWeapon('spear', 0); h.inv[0].lvl = 1; h.inv[1] = { id: 'bandage', n: 3 }; h.inv[2] = { id: 'bandage', n: 2 }; startGame(h); sim(0.3); UI.toggleWin('inv'); });
  const drag = async (a, bsel) => { const A = await p.locator(a).boundingBox(), B = await p.locator(bsel).boundingBox(); await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2); await p.mouse.down(); await p.mouse.move(A.x + 30, A.y + 30, { steps: 5 }); await p.mouse.move(B.x + B.width / 2, B.y + B.height / 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200); };
  const st = () => p.evaluate(() => { const h = KR2.G.player.h; return [h.equip.w1?.wt, h.equip.w2?.wt, h.inv.slice(0, 6).map(x => x ? (x.wt || x.id + x.n) : null)]; });
  await drag('[data-inv="0"]', '[data-eq="w1"]'); console.log('spear->w1', JSON.stringify(await st()));
  await drag('[data-inv="2"]', '[data-inv="1"]'); console.log('stack', JSON.stringify(await st()));
  await drag('[data-eq="w1"]', '[data-inv="10"]'); console.log('w1->bag10 (spear, should refuse? sword in bag)', JSON.stringify(await st()));
  const si = await p.evaluate(() => KR2.G.player.h.inv.findIndex(x => x && x.wt === 'sword'));
  await drag(`[data-inv="${si}"]`, '#portrait'); console.log('sword->portrait', JSON.stringify(await st()));
  const sh = await p.evaluate(() => KR2.G.player.h.inv.findIndex(x => x && x.wt === 'shield'));
  await drag(`[data-inv="${sh}"]`, '[data-eq="w2"]'); console.log('shield->w2', JSON.stringify(await st()));
  console.log(errs.join('\n')); await b.close();
})();
