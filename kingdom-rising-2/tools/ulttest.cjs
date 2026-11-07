// Ultimate escape test (see docs/ULTIMATES.md).
// Every class stands in an enemy necromancer's demon ring, waits out the freeze, then runs straight out, dodging
// forward whenever it can (as many dodges as its endurance allows). It prints who escaped and who was caught.
//
// Needs a local web server on the repo root, e.g.  python3 -m http.server 8765  (run from the Kingdom-Rising folder)
//   node kingdom-rising-2/tools/ulttest.cjs                     all 18 classes, dead centre, the game's freeze
//   node kingdom-rising-2/tools/ulttest.cjs --off 2.59          start 2.59 m from the centre (25% of the 10.35 m ring)
//   node kingdom-rising-2/tools/ulttest.cjs --freeze 1.65       try another freeze length without editing the game
//   node kingdom-rising-2/tools/ulttest.cjs --only monk,warrior just these classes
//   node kingdom-rising-2/tools/ulttest.cjs --lag 0.2            a human's reaction time: wait 0.2 s after the freeze and after each dodge (default 0 = frame-perfect)
// Times printed are game seconds after the cast.
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FRZ = arg('freeze') ? +arg('freeze') : 0, OFF = +arg('off', 0), LAG = +arg('lag', 0), URL = arg('url', 'http://localhost:8765/kingdom-rising-2/index.html');
const ALL = ['warrior', 'paladin', 'darkknight', 'cleric', 'berserker', 'musketeer', 'blunderbuss', 'wizard', 'elementalist', 'enchanter', 'necromancer', 'shaman', 'druid', 'bard', 'monk', 'rogue', 'ranger', 'beastmaster'];
const CLS = arg('only') ? arg('only').split(',') : ALL;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL + '?mode=yard', { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 200000 }); await p.waitForTimeout(800);
  const res = await p.evaluate(async ([CLS, FRZ, OFF, LAG]) => {
    const Y = await import('./src/yard.js'); const G = KR2.G, out = []; if (FRZ) G.ringFRZ = FRZ; const DT = 0.033; // (KR2.sim steps in 0.033 s frames)
    for (const cls of CLS) {
      Y.YD.startGame(Y.yardHero(cls)); KR2.sim(0.4); const P = G.player; P.place(-60, -60, 0); P.yaw = 0; P.pitch = 0; KR2.sim(0.3); P.end = P.maxEnd;
      const c = P.pos.clone(); c.z -= OFF; // (the ring's centre: OFF metres behind you, so you run straight out)
      const V3 = c.constructor, foe = { pos: new V3(c.x + 30, c.y, c.z + 30), team: 99, heroName: 'Test Necro' };
      G.hooks.arenaDemon(foe, c.clone());
      let t = 0, dodges = 0, grabbedAt = null, outAt = null, readyAt = null; const R = 10.35;
      while (t < 9) { G.keys.KeyW = true;
        const free = !P.isFrozen() && !P.held && !P.dodge; if (!free) readyAt = null; else if (readyAt == null) readyAt = t + LAG;
        if (free && t >= readyAt) { const e0 = P.end; P.tryDodge(new V3(Math.sin(P.yaw), 0, Math.cos(P.yaw))); if (P.end < e0) { dodges++; readyAt = null; } }
        KR2.sim(DT); t += DT; const d = Math.hypot(P.pos.x - c.x, P.pos.z - c.z);
        if (outAt == null && d > R) outAt = +t.toFixed(2); if (P.held) { grabbedAt = +t.toFixed(2); break; } }
      G.keys.KeyW = false;
      out.push({ cls, dodges, outAt, grabbedAt, dist: +Math.hypot(P.pos.x - c.x, P.pos.z - c.z).toFixed(2) });
      KR2.sim(9); P.held = false; P.cine = null; if (P.dead) { P.dead = false; P.hp = P.maxHp; } document.body.classList.remove('cine');
    }
    return out; }, [CLS, FRZ, OFF, LAG]);
  console.log(`freeze ${FRZ || 'game default'} s, start ${OFF} m from centre, reaction ${LAG} s`);
  for (const r of res) console.log(`${r.cls.padEnd(13)} ${r.grabbedAt != null ? 'CAUGHT  at ' + r.grabbedAt + ' s, ' + r.dist + ' m out' : 'ESCAPED, out of the ring at ' + r.outAt + ' s'}  (${r.dodges} dodges)`);
  if (errs.length) console.log('page errors:\n' + errs.join('\n'));
  await b.close();
})();
