// Duel simulator (see docs/ULTIMATES.md): two computer fighters fight a deathmatch in the Kingdom Arena while the
// player hides out of the way; prints kills each way. Needs a local server on the repo root at port 8765.
//   node kingdom-rising-2/tools/duelsim.cjs warrior paladin 240      (classes, seconds of game time)
const { chromium } = require('playwright');
const [A, B, SECS] = [process.argv[2] || 'warrior', process.argv[3] || 'paladin', +(process.argv[4] || 240)];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 480, height: 270 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const SET = JSON.stringify({ fmt: 'custom', objective: 'dm', lives: 'many', slots: [{ you: true, cls: 'cleric', race: 'human', team: 0 }, { cls: A, race: 'human', team: 0 }, { cls: B, race: 'human', team: 1 }] });
  await p.goto('http://localhost:8765/kingdom-rising-2/index.html', { timeout: 180000, waitUntil: 'domcontentloaded' }); await p.evaluate((s) => sessionStorage.setItem('kr2_arena_setup', s), SET);
  await p.goto('http://localhost:8765/kingdom-rising-2/index.html?mode=arena', { timeout: 180000, waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 200000 });
  await p.waitForTimeout(500);
  const r = await p.evaluate(async ([SECS]) => { const Ar = await import('./src/arena.js'); const Aa = Ar.A, G = KR2.G, P = G.player;
    const hide = () => { P.stealth = 1e6; P.ultImmT = 1e6; P.hp = P.maxHp; P.dead = false; P.place(0, -96, 0); };
    const fa = Aa.F.find(f => !f.you && f.team === 0), fb = Aa.F.find(f => !f.you && f.team === 1); Aa.target = 1e9; Aa.timeLimit = Infinity;
    let t = 0; const dmgA = { d: 0 }, dmgB = { d: 0 }; while (t < SECS + 25) { hide(); KR2.sim(1); t += 1; }
    return { a: fa.bot.cls, b: fb.bot.cls, killsA: fa.kills || 0, killsB: fb.kills || 0, state: Aa.state }; }, [SECS]);
  console.log(`${r.a} vs ${r.b}: ${r.killsA} - ${r.killsB}  (${r.state})`);
  if (errs.length) console.log('errors: ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
})();
