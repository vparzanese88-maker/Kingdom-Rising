// PvP round robin (balance check): every pair of arena classes duels several rounds in one page, both sides,
// with the player hidden out of the way. One browser, one page reused for every pair (?nomodels).
//   node kingdom-rising-2/tools/pvprr.cjs [rounds=3] [out.json] [classA,classB,...]   (PAIRS=a:b,c:d for chosen pairs)
// Each round: both fighters fresh (restartMatch), 6 perk points, no ult charge; first kill wins (cap CAP s = draw).
const { chromium } = require('playwright'); const fs = require('fs');
const ROUNDS = +(process.argv[2] || 3), OUT = process.argv[3] || 'pvprr.json', CAP = +(process.env.CAP || 90);
(async () => {
  let b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=1024'] });
  let p = await b.newPage({ viewport: { width: 320, height: 180 } });
  const base = 'http://localhost:8765/kingdom-rising-2/index.html';
  await p.goto(base + '?nomodels', { timeout: 180000, waitUntil: 'domcontentloaded' });
  let classes = process.argv[4] ? process.argv[4].split(',') : await p.evaluate(async () => { const D = await import('./src/data.js'); const Ar = await import('./src/arena.js'); return Object.keys(D.CLASSES).filter(c => !D.CLASSES[c].campaignOnly && Ar.kitOf(c).length); });
  console.log('classes', classes.length, classes.join(','));
  let pairs = []; if (process.env.PAIRS) pairs = process.env.PAIRS.split(',').map(s => s.split(':')); else for (let i = 0; i < classes.length; i++) for (let j = i + 1; j < classes.length; j++) pairs.push([classes[i], classes[j]]);
  const res = fs.existsSync(OUT) && !process.env.FRESH ? JSON.parse(fs.readFileSync(OUT)) : [];
  const done = new Set(res.map(r => r.a + ':' + r.b));
  const SET = JSON.stringify({ fmt: 'ffa', ffaN: 3, objective: 'dm', lives: 'many', slots: [{ you: true, cls: 'cleric', race: 'human', team: 0 }, { cls: 'warrior', race: 'human', team: 1 }, { cls: 'wizard', race: 'human', team: 2 }] });
  const boot = async () => { await p.evaluate((s) => sessionStorage.setItem('kr2_arena_setup', s), SET);
    await p.goto(base + '?mode=arena&nomodels', { timeout: 180000, waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => document.getElementById('loading') && document.getElementById('loading').hidden, null, { timeout: 200000 }); };
  const relaunch = async () => { try { await b.close(); } catch (e2) { /* gone */ } await new Promise(z => setTimeout(z, 30000)); b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); p = await b.newPage({ viewport: { width: 320, height: 180 } }); await p.goto(base + '?nomodels', { timeout: 180000, waitUntil: 'domcontentloaded' }); await boot(); };
  await boot(); let nPairs = 0;
  for (const [A, B] of pairs) {
    if (done.has(A + ':' + B)) continue; const t0 = Date.now(); let r;
    for (let tries = 0; tries < 3 && !r; tries++) { try {
      if (nPairs && nPairs % (+process.env.EVERY || 12) === 0) await boot(); // (a fresh page now and then: memory)
      r = await p.evaluate(async ([A, B, ROUNDS, CAP]) => { const Ar = await import('./src/arena.js'); const Aa = Ar.A, G = KR2.G, P = G.player;
        const hide = () => { P.stealth = 1e6; P.ultImmT = 1e6; P.hp = P.maxHp; P.dead = false; P.place(0, -96, 0); };
        const bots = Aa.F.filter(f => !f.you), out = [];
        const setCls = (f, cls) => { if (f.bot && f.bot.cls === cls) return; const Ctor = f.bot.constructor, old = f.bot; for (const pm of old.pets || []) { pm.dead = true; G.scene.remove(pm.root); } G.scene.remove(old.root); old.dead = true; const i = G.mobs.indexOf(old); if (i >= 0) G.mobs.splice(i, 1);
          f.cls = cls; const h = Ar.arenaHero(f, f.name); f.bot = new Ctor(f, h); };
        for (let rd = 0; rd < ROUNDS; rd++) {
          const sw = rd % 2; setCls(bots[0], sw ? B : A); setCls(bots[1], sw ? A : B);
          Ar.restartMatch();
          for (const f of bots) { const h = f.bot.h; h.ultCharge = 0; h.arenaPerks = {}; f.pp = 5; Ar.recomputePK(h); f.bot.recalc(); f.bot.hp = f.bot.maxHp; f.bot.buffs = {}; f.bot.dots = []; f.bot.hots = []; for (const k in f.bot.cd) f.bot.cd[k] = Math.random() * 2; }
          Aa.target = 1e9; Aa.timeLimit = Infinity; Aa.t = 0.1; hide(); KR2.sim(0.3); Aa.perkClock = 9.9; // (perk tick right away: 6 points)
          let t = 0, k0 = bots.map(f => f.kills), dmg0 = bots.map(f => f.dmg); let w = -1;
          const trail = []; let met = false;
          while (t < CAP) { hide(); KR2.sim(0.5); t += 0.5; trail.push(bots[0].bot.pos.clone());
            // no contact yet after 10 s: put the second fighter where the first one stood 3 s ago (walkable ground, ~10-15 m away)
            if (!met) { const d = bots[0].bot.pos.distanceTo(bots[1].bot.pos); if (d < 18 || bots[0].dmg > dmg0[0] || bots[1].dmg > dmg0[1]) met = true; else if (t >= 10 && t % 5 === 0) { const q = trail[Math.max(0, trail.length - 7)]; bots[1].bot.pos.copy(q); met = true; } } const kk = bots.map((f, i) => f.kills - k0[i]); if (kk[0] || kk[1]) { w = kk[0] && kk[1] ? -1 : kk[0] ? 0 : 1; break; } if (bots[0].bot.dead && bots[1].bot.dead) break; }
          const ia = sw ? 1 : 0, ib = 1 - ia, fa = bots[ia], fb = bots[ib];
          out.push({ w: w < 0 ? -1 : w === ia ? 0 : 1, sw, t, hpA: Math.round(Math.max(0, fa.bot.hp) / fa.bot.maxHp * 100), hpB: Math.round(Math.max(0, fb.bot.hp) / fb.bot.maxHp * 100), maxA: fa.bot.maxHp, maxB: fb.bot.maxHp, dA: Math.round(fa.dmg - dmg0[ia]), dB: Math.round(fb.dmg - dmg0[ib]) });
        }
        out.mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0; out.n = { mobs: G.mobs.length, scene: G.scene.children.length, timers: G.timers.length, shots: Aa.shots.length }; return { out, mem: out.mem, n: out.n }; }, [A, B, ROUNDS, CAP]);
      if (r) { console.log('mem', r.mem, JSON.stringify(r.n)); r = r.out; }
    } catch (e) { console.log('retry', A, B, e.message.slice(0, 200)); await relaunch(); } }
    if (!r) continue; nPairs++;
    res.push({ a: A, b: B, rounds: r }); fs.writeFileSync(OUT, JSON.stringify(res));
    console.log(`${A} vs ${B}: ${r.map(o => o.w < 0 ? 'D' : o.w ? 'B' : 'A').join('')}  t ${r.map(o => o.t).join(',')}  hp ${r.map(o => o.w < 0 ? '-' : o.w ? o.hpB : o.hpA).join(',')}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await b.close();
})();
