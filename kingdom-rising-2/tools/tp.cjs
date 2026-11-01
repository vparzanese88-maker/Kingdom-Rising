const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 520 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/kingdom-rising-2/index.html');
  await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 180000 });
  await p.evaluate(async () => { const { G, startGame, Game, sim } = window.KR2; const C = await import('./src/character.js'); const h = Game.newHero({ name: 'T', race: 'highelf', cls: 'warrior', sex: 'm', app: { skin: '#f2dcc4', hair: '#f4ead0', hairStyle: 1, beard: 0, height: 1, build: 0 } }); h.introDone = true; startGame(h); const pl = G.player; pl.place(0, 250, 0); pl.camDistT = pl.camDist = 0; sim(0.2); pl.vm.g.position.y = -9;
    [0, Math.PI / 2, Math.PI].forEach((r, i) => { const ch = C.buildHumanoid({ race: 'human', sex: 'm', cls: 'warrior', skin: '#e0ac85', hair: '#5a3a1e' }); C.equipWeapon(ch, 'swordshield', i ? 3 : 1); C.bake(ch.root); ch.root.position.set(pl.pos.x - 1.6 + i * 1.6, pl.pos.y, pl.pos.z + 3.6); ch.root.rotation.y = Math.PI + r; G.scene.add(ch.root); for (let k = 0; k < 20; k++) C.animateHumanoid(ch, 0.05, { speed: 0, armed: true }); });
    pl.pitch = -0.12; sim(0.1); document.getElementById('hud').hidden = true; });
  await p.waitForTimeout(300); await p.screenshot({ path: out, timeout: 120000 }); await b.close();
})();
