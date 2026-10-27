// Kingdom Rising: city defenses (towers and siege engines) and war parties sent against the enemy capital
(function () {
  const KR = window.KR, D = KR.D, G = KR.G, Sys = KR.Sys, W = KR.W, U = KR.U;
  const TS = 32;
  const War = (KR.War = {});
  War.SIEGE_SCALE = 1.6;

  // ---------- data ----------
  // guards, tower crews and war parties scale with the kingdom's tier (city level 1-5)
  D.CITY_TIER_LEVELS = [20, 30, 40, 55, 70];
  D.SIEGE = {
    archer: { name: 'Archer Tower', range: 430, delay: 2.4, mul: 1.0, proj: 'ARC', hpMul: 5 },
    ballista: { name: 'Ballista', range: 480, delay: 3.4, mul: 1.8, proj: 'bolt', hpMul: 8 },
    heavyballista: { name: 'Heavy Ballista', range: 500, delay: 3.0, mul: 2.2, proj: 'bolt', hpMul: 9, pierce: 1 },
    catapult: { name: 'Catapult', range: 540, delay: 4.6, mul: 2.4, proj: 'boulder', hpMul: 10, aoe: 70 },
    trebuchet: { name: 'Trebuchet', range: 620, delay: 5.5, mul: 3.0, proj: 'boulder', hpMul: 12, aoe: 90 },
    cannon: { name: 'Cannon', range: 520, delay: 3.6, mul: 2.6, proj: 'ball', hpMul: 12, aoe: 60 },
  };
  // what defends each entrance at each tier: two engines per gate
  D.SIEGE_BY_TIER = [['archer', 'archer'], ['ballista', 'ballista'], ['heavyballista', 'heavyballista'], ['catapult', 'catapult'], ['trebuchet', 'cannon', 'catapult']];
  // soldiers of the realm: city guards and war parties use these instead of the hero classes
  // hp/dmg are multipliers; tier = kingdom level needed to hire one at the barracks; cost = multiplier on the contract price
  D.SOLDIERS = {
    longbowman: { name: 'Longbowman', plural: 'Longbowmen', icon: '🏹', hp: 2.4, dmg: 1.0, ranged: true, proj: 'ARC', delay: 2.4, kit: 'Archer', tier: 1, cost: 1, desc: 'Archer with a great bow. Shoots from long range.' },
    manatarms: { name: 'Man-at-Arms', plural: 'Men-at-Arms', icon: '⚔', hp: 3.4, dmg: 1.0, kit: 'Warrior', tier: 1, cost: 1, desc: 'Sword and shield. The steady backbone of every army.' },
    pikeman: { name: 'Pikeman', plural: 'Pikemen', icon: '🔱', hp: 3.2, dmg: 1.1, kit: 'Pike', tier: 1, cost: 1, antiSiege: 1.6, desc: 'Long pike. Deals extra damage to towers, siege engines and cavalry.' },
    priest: { name: 'Priest', icon: '✚', hp: 2.2, dmg: 0.6, kit: 'Priest', tier: 1, cost: 1.3, healer: true, desc: 'Heals wounded soldiers nearby and smites the enemy.' },
    knight: { name: 'Knight', icon: '🛡', hp: 5.0, dmg: 1.3, kit: 'Warrior', tier: 2, cost: 1.7, desc: 'Heavy plate, sword and shield. Very hard to kill.' },
    musketeer: { name: 'Musketeer', icon: '🔫', hp: 2.4, dmg: 2.1, ranged: true, proj: 'shot', delay: 3.6, kit: 'Musket', tier: 3, cost: 1.6, desc: 'Fires a musket: slow to reload, but every shot hits hard.' },
    cavalry: { name: 'Cavalryman', plural: 'Cavalrymen', icon: '🐎', hp: 4.5, dmg: 1.4, mounted: true, speed: 170, kit: 'Cavalry', tier: 4, cost: 2.2, desc: 'Mounted lancer. Fast, and charges into the enemy.' },
  };
  D.MOB_CLASS_KITS.Pike = ['trip', 'kick', 'bash', 'cleave'];
  D.MOB_CLASS_KITS.Priest = ['smite', 'ward', 'weaken', 'terrify'];
  D.MOB_CLASS_KITS.Musket = ['pinshot', 'kick'];
  D.MOB_CLASS_KITS.Cavalry = ['charge', 'cleave', 'trip', 'enrage'];
  D.WAR = { everyMin: 24, squad: ['longbowman', 'longbowman', 'longbowman', 'pikeman', 'pikeman', 'knight'], spawnGap: 1.6 };
  D.WAR.rosterMax = (tier) => 4 + tier * 2;
  War.hireCost = (f, cls) => Math.round(Sys.mercCost(Sys.cityTierLevel(f)) * 1.5 * D.SOLDIERS[cls].cost);
  Sys.cityTierLevel = (f) => D.CITY_TIER_LEVELS[U.clamp(Sys.cityLevel(f), 1, 5) - 1];
  War.enemyOf = (f) => D.FACTION_IDS.find((x) => x !== f);

  // ---------- long-range pathfinding (binary heap A*) ----------
  let PF = null;
  W.findPathLong = function (sx, sy, gx, gy, maxN = 160000, opts = { door: 'pass' }) {
    const WW = W.W, N = WW * W.H;
    if (!PF || PF.N !== N) PF = { N, g: new Float32Array(N).fill(1e9), came: new Int32Array(N).fill(-1), closed: new Uint8Array(N), touched: [] };
    const { g: gS, came, closed, touched } = PF;
    for (const k of touched) { gS[k] = 1e9; came[k] = -1; closed[k] = 0; } touched.length = 0;
    if (!W.inb(sx, sy) || !W.inb(gx, gy)) return null;
    if (W.isBlockedTile(gx, gy, opts)) { // aim for the nearest open tile next to a blocked goal (a tower, a doorway, a tree)
      let best = null; for (let r = 1; r <= 2 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!W.isBlockedTile(gx + dx, gy + dy, opts) && (!best || Math.hypot(dx, dy) < best[2])) best = [gx + dx, gy + dy, Math.hypot(dx, dy)];
      if (!best) return null; gx = best[0]; gy = best[1];
    }
    const heap = []; const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const s = sy * WW + sx, goal = gy * WW + gx; gS[s] = 0; touched.push(s); push(s, Math.hypot(gx - sx, gy - sy)); let n = 0;
    while (heap.length && n++ < maxN) {
      const [, k] = pop(); if (closed[k]) continue; closed[k] = 1;
      if (k === goal) { const path = []; let c = k; while (c !== s && c >= 0) { path.push([c % WW, Math.floor(c / WW)]); c = came[c]; } return path.reverse(); }
      const x = k % WW, y = Math.floor(k / WW);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
        if (W.isBlockedTile(nx, ny, opts)) continue;
        if (dx && dy && (W.isBlockedTile(x + dx, y, opts) || W.isBlockedTile(x, y + dy, opts))) continue;
        const nk = ny * WW + nx; if (closed[nk]) continue;
        // stay a little away from walls and props so wide soldiers don't scrape corners
        const ng = gS[k] + (dx && dy ? 1.414 : 1) + (W.tile(nx, ny) === KR.T.WATER ? 3 : 0) + (W.isBlockedTile(nx + 1, ny, opts) || W.isBlockedTile(nx - 1, ny, opts) || W.isBlockedTile(nx, ny + 1, opts) || W.isBlockedTile(nx, ny - 1, opts) ? 0.6 : 0);
        if (ng >= gS[nk]) continue; if (gS[nk] === 1e9) touched.push(nk); gS[nk] = ng; came[nk] = k; push(nk, ng + Math.hypot(gx - nx, gy - ny));
      }
    }
    return null;
  };

  // ---------- defenses ----------
  // called from Sys.spawnCity with its NPC factory
  War.spawnDefenses = function (f, mk) {
    const cd = W.cityData[f]; if (!cd) return; const cx = cd.cx, cy = cd.cy, R = cd.R;
    const tier = U.clamp(Sys.cityLevel(f), 1, 5), lv = Sys.cityTierLevel(f);
    const kinds = D.SIEGE_BY_TIER[tier - 1];
    // two engines flanking each of the three gates, each with a guard posted beside it
    // engines stand just outside the wall on both sides of each gate, so attackers have to break them first
    const spots = [];
    const offs = kinds.length > 2 ? [-3, 3, -6] : [-3, 3];
    offs.forEach((o, i) => { spots.push([[cx + o, cy + R + 1], [0, 1], i]); spots.push([[cx + R + 1, cy + 3 + o], [1, 0], i]); spots.push([[cx - R - 1, cy + 3 + o], [-1, 0], i]); });
    spots.forEach(([[tx, ty], [ix, iy], ki]) => {
      const kind = kinds[ki]; const def = D.SIEGE[kind];
      const t = mk('tower', tx * TS + 16, ty * TS + 16, { type: 'guard', title: `Tier ${tier} defense`, level: lv, name: `${D.FACTIONS[f].city} ${def.name}` });
      War.makeSiege(t, kind);
      const g = mk('guard', (tx + ix) * TS + 16, (ty + iy) * TS + 16, { type: 'guard', title: 'Tower Guard', level: lv }); Sys.makeGuard(g, true); War.dress(g, 'pikeman'); g.towerGuard = true;
    });
    // the barracks is a building inside the walls (it grows with the city); soldiers muster inside and a recruiter hires more
    const bb = cd.barracksB && W.buildings.includes(cd.barracksB) ? cd.barracksB : W.buildings.find((x) => x.city === f && x.type === 'barracks');
    if (bb) {
      const sp = (bb.spots.spawn || [[bb.px + bb.pw / 2, bb.py + bb.ph - 40]])[0]; cd.barracks = [Math.floor(sp[0] / TS), Math.floor(sp[1] / TS)];
      const [rx, ry] = (bb.spots.recruiter || [sp])[0];
      const r = mk('recruiter', rx, ry, { type: 'npc', title: 'Recruiter · hire soldiers', gender: 'm' });
      r.recruiter = true; r.static = true; r.invuln = true;
      const F = D.FACTIONS[f]; r.look = Object.assign(r.look || {}, { armor: { kind: 'plate', col: '#b8bcc4', trim: F.banner }, helm: null, cape: F.banner, weapon: '1HS', offhand: null, hat: null, robe: false, sash: F.banner });
      // the war board by the door counts down to the next march
      const d = bb.door; const wb = mk('warboard', (d.tx + 3) * TS + 16, (d.ty + 2) * TS + 26, { type: 'npc', title: '', name: 'War Board' });
      wb.raidBoard = true; wb.static = true; wb.invuln = true; wb.look = null; wb.r = 16; wb.h = 64;
    } else { const ga = War.bestGates(f, War.enemyOf(f)); if (ga) cd.barracks = ga.a; }
    War.spawnBell(f, mk);
    // the kingdom's soldiers live in the barracks until the war horns sound
    for (const e of G.ents.slice()) if (e.raider && e.faction === f && e.warState === 'garrison') G.remove(e);
    War.fillGarrison(f, true);
  };
  // ---------- garrison: soldiers waiting in the barracks ----------
  War.garrison = (f) => G.ents.filter((e) => e.raider && e.faction === f && e.warState === 'garrison' && !e.dead && !e.removed);
  War.garrisonWanted = function (f) {
    const tier = U.clamp(Sys.cityLevel(f), 1, 5); const out = [];
    for (let s = 0; s < tier; s++) for (const cls of D.WAR.squad) out.push({ cls });
    for (const h of War.roster(f)) out.push({ cls: h.cls, hired: h });
    return out;
  };
  War.barracksOf = (f) => { const cd = W.cityData[f]; return cd && cd.barracksB && W.buildings.includes(cd.barracksB) ? cd.barracksB : W.buildings.find((x) => x.city === f && x.type === 'barracks'); };
  War.addGarrison = function (f, want) {
    const bb = War.barracksOf(f); if (!bb) return null;
    let tx = 0, ty = 0;
    for (let k = 0; k < 40; k++) { tx = bb.x + 1 + Math.floor(Math.random() * (bb.w - 2)); ty = bb.y + 1 + Math.floor(Math.random() * (bb.h - 2)); if (!W.isBlockedTile(tx, ty)) break; }
    const m = War.makeSoldier(f, want.cls, tx * TS + 16 + (Math.random() - 0.5) * 12, ty * TS + 18, Sys.cityTierLevel(f), want.hired ? Object.assign({ owner: want.hired.owner }, want.hired) : null);
    m.warState = 'garrison'; m.squad = null; m.hiredId = want.hired ? want.hired.id : null; m.sit = Math.random() < 0.45; m.face = Math.random() < 0.5 ? 1 : -1;
    return m;
  };
  // top the garrison up: everyone at once (new city / new level), or one recruit at a time after a raid
  War.fillGarrison = function (f, all) {
    if (!War.barracksOf(f)) return;
    const have = War.garrison(f); const want = War.garrisonWanted(f);
    const free = have.slice(); const missing = [];
    for (const w of want) { const i = free.findIndex((m) => (w.hired ? m.hiredId === w.hired.id : !m.hiredId && m.soldier === w.cls)); if (i >= 0) free.splice(i, 1); else missing.push(w); }
    for (const m of free) if (m.hiredId && !War.roster(f).some((h) => h.id === m.hiredId)) G.remove(m); // dismissed
    missing.sort((a, b) => (b.hired ? 1 : 0) - (a.hired ? 1 : 0));
    const room = Math.max(0, War.expectedGarrison(f) - (have.length - free.filter((m) => m.removed).length));
    for (const w of missing.slice(0, all ? room : Math.min(1, room))) War.addGarrison(f, w);
  };
  // how many soldiers should be in the barracks right now
  War.cycle = function (f) {
    const a = G.account || {}; const w = (a.war = a.war || {}); w.next = w.next || {}; w.lastLaunch = w.lastLaunch || {};
    const len = D.WAR.everyMin * 60000; const now = Date.now();
    if (!w.next[f]) w.next[f] = now + len + (f === D.FACTION_IDS[0] ? 0 : len / 2);
    const start = w.lastLaunch[f] && w.lastLaunch[f] > w.next[f] - len * 1.5 ? w.lastLaunch[f] : w.next[f] - len;
    const N = War.garrisonWanted(f).length; const every = len / Math.max(1, N);
    return { start, N, every, len };
  };
  War.expectedGarrison = function (f) { const c = War.cycle(f); return Math.min(c.N, 1 + Math.floor(Math.max(0, Date.now() - c.start) / c.every)); };
  War.nextRecruitIn = function (f) { const c = War.cycle(f); const k = War.expectedGarrison(f); if (k >= c.N) return null; return Math.max(0, Math.ceil((c.start + k * c.every - Date.now()) / 1000)); };
  War.secondsToNext = (f) => { const a = G.account; const t = a && a.war && a.war.next && a.war.next[f]; return t ? Math.max(0, Math.ceil((t - Date.now()) / 1000)) : D.WAR.everyMin * 60; };
  War.bestGates = function (f, ef) {
    if (!ef || !W.cityData[f] || !W.cityData[ef]) return null;
    let best = null; for (const a of gatesOf(f)) for (const b of gatesOf(ef)) { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (!best || d < best.d) best = { a, b, d }; }
    return best;
  };
  // give a guard or soldier one of the realm's soldier classes: look, stats and fighting style
  War.dress = function (e, cls) {
    const S = D.SOLDIERS[cls]; if (!S) return e; const F = D.FACTIONS[e.faction];
    e.soldier = cls; e.title = e.title === 'Patrol' ? 'Kingdom Guard' : e.title && e.title !== 'Guard' ? e.title : S.name;
    const base = e.raider ? G.mobHp(e.level) * S.hp : G.mobHp(e.level) * 3 * (S.hp / 3.2);
    e.hpMax = e.hp = Math.round(base); e.dmg = Math.round((3 + e.level * (e.raider ? 2.6 : 3.2)) * S.dmg);
    e.ranged = S.ranged ? 'archer' : null; e.proj = S.proj || null; e.delay = S.delay || 2.2; e.healer = false; e.priest = !!S.healer; e.mounted = !!S.mounted;
    if (S.speed) e.speed = S.speed; e.antiSiege = S.antiSiege || 1;
    e.mclass = S.kit; e.mabil = (D.MOB_CLASS_KITS[S.kit] || []).slice(0, Math.min(4, D.mobAbilityCount(e.level) + 1)); e.abCd = {}; e.abT = 2 + Math.random() * 3;
    const L = e.look || {}; const ban = F.banner, trim = F.trim;
    const looks = {
      longbowman: { armor: { kind: 'leather', col: '#4a6b35', trim: ban }, helm: null, hat: 'hood', hatCol: '#3a5a2a', weapon: 'ARC', offhand: null, cape: null, back: 'quiver' },
      manatarms: { armor: { kind: 'chain', col: '#8e9298', trim: ban }, helm: 'chain', hat: null, weapon: '1HS', offhand: 'shield', shieldCol: ban, shieldEmb: trim, cape: null },
      pikeman: { armor: { kind: 'chain', col: '#7e8288', trim: ban }, helm: 'plate', helmPlume: null, hat: null, weapon: 'spear', offhand: null, cape: null },
      priest: { armor: { kind: 'cloth', col: '#f1efe6', trim: ban }, robe: true, helm: null, hat: 'mitre', hatCol: '#f1efe6', hatTrim: ban, weapon: '2HB', staff: true, orb: '#fff2a0', offhand: null, cape: null },
      knight: { armor: { kind: 'plate', col: '#c8ccd4', trim: ban }, helm: 'plate', helmPlume: ban, hat: null, weapon: '1HS', offhand: 'shield', shieldCol: ban, shieldEmb: trim, cape: ban },
      musketeer: { armor: { kind: 'leather', col: '#5a3a2a', trim: ban }, helm: null, hat: 'feather', hatCol: '#2a2a2a', weapon: null, offhand: null, cape: ban, sash: ban },
      cavalry: { armor: { kind: 'plate', col: '#b8bcc4', trim: ban }, helm: 'plate', helmPlume: trim, hat: null, weapon: 'spear', offhand: 'shield', shieldCol: ban, shieldEmb: trim, cape: ban },
    };
    e.look = Object.assign({ race: e.race, gender: e.gender, skin: e.skin, hair: e.hair, hairStyle: e.hairStyle }, L, { robe: false, staff: false, orb: null, back: null, sash: null }, looks[cls]);
    return e;
  };
  // priests heal the most wounded soldier near them
  War.priestTick = function (e, dt) {
    e.healT = (e.healT || 2) - dt; if (e.healT > 0 || e.stun > 0 || e.mez > 0) return false;
    e.healT = 5;
    let best = null; for (const o of G.ents) { if (o.dead || o.removed || o.faction !== e.faction || !(o.type === 'guard' || o.type === 'king') || o.siege) continue; if (o.hp > o.hpMax * 0.7 || Math.hypot(o.x - e.x, o.y - e.y) > 320) continue; if (!best || o.hp / o.hpMax < best.hp / best.hpMax) best = o; }
    if (!best) return false;
    G.heal(e, best, best.hpMax * 0.22, { show: true }); e.casting = true; setTimeout(() => (e.casting = false), 600);
    G.fxAdd({ k: 'aura', x: best.x, y: best.y, col: '#fff2a0', life: 0.9, ent: best });
    return true;
  };
  War.makeSiege = function (t, kind) {
    const def = D.SIEGE[kind];
    t.siege = kind; t.static = true; t.passive = true; t.look = null; t.r = 30; t.h = (kind === 'archer' ? 122 : kind === 'trebuchet' ? 112 : 64) * War.SIEGE_SCALE; t.speed = 0;
    t.hpMax = t.hp = Math.round(G.mobHp(t.level) * def.hpMul); t.ac = 1200; t.dmg = Math.round((3 + t.level * 2.4) * def.mul); t.delay = def.delay;
    t.res = { fire: 30, cold: 60, magic: 60, poison: 100, disease: 100 }; t.aggroR = def.range; t.fireT = Math.random() * 2; t.aimAng = Math.PI / 2; t.leash = 0;
  };
  const factionOf = (e) => (!e ? null : e.c ? e.c.faction : e.owner && e.owner.c ? e.owner.c.faction : e.faction || null);
  War.factionOf = factionOf;
  // is this entity a valid enemy for the given faction's soldiers and engines?
  War.isFoe = function (f, e) {
    if (!e || e.dead || e.removed || e.fd) return false;
    if (e.type === 'mob') return false; // engines and war parties leave wild monsters alone unless attacked
    const ef = factionOf(e); if (!ef || ef === f) return false;
    return e.type === 'player' || e.type === 'merc' || e.type === 'pet' || e.raider || e.type === 'guard' || e.type === 'king';
  };
  War.updateSiege = function (t, dt) {
    if (t.dead) { if (t.respawnAt && G.now > t.respawnAt) { t.dead = false; t.hp = t.hpMax; t.respawnAt = null; t.hate.clear(); t.inCombat = false; const i = G.corpses.indexOf(t); if (i >= 0) G.corpses.splice(i, 1); G.log(`${t.name} has been rebuilt.`, 'sys', '#cccccc'); } return; }
    const def = D.SIEGE[t.siege]; t.fireK = Math.max(0, (t.fireK || 0) - dt * 2);
    t.scanT = (t.scanT || 0) - dt;
    if (t.scanT <= 0) {
      t.scanT = 0.5; let best = null, bd = def.range;
      for (const e of G.ents) { if (e === t || !War.isFoe(t.faction, e) || (e.type === 'guard' && !e.raider) || e.type === 'king') continue; const d = Math.hypot(e.x - t.x, e.y - t.y); if (d < bd) { bd = d; best = e; } }
      const p = G.player; if (p && War.isFoe(t.faction, p) && Math.hypot(p.x - t.x, p.y - t.y) < def.range && (!best || Math.hypot(p.x - t.x, p.y - t.y) < bd)) best = p;
      t.tgt = best; t.inCombat = !!best;
    }
    const tg = t.tgt; if (!tg || tg.dead || tg.removed) { t.tgt = null; return; }
    t.aimAng = Math.atan2(tg.y - t.y, tg.x - t.x);
    t.fireT -= dt; if (t.fireT > 0) return;
    t.fireT = def.delay * (0.9 + Math.random() * 0.2); t.fireK = 1;
    const near = Math.hypot(t.x - G.player.x, t.y - G.player.y) < 700;
    if (near) KR.A.sfx(t.siege === 'cannon' ? 'heavy' : t.siege === 'archer' ? 'bow' : 'whoosh', t.siege === 'cannon' ? 0.7 : 0.4);
    const dmg = () => Math.round(t.dmg * (0.75 + Math.random() * 0.5));
    if (def.aoe) {
      G.shoot(t, tg, def.proj, -1, { onHit: () => {
        const x = tg.x, y = tg.y; G.fxAdd({ k: 'ring', x, y, r: def.aoe, col: t.siege === 'cannon' ? '#ffb24a' : '#c8b090', life: 0.6 });
        if (Math.hypot(x - G.player.x, y - G.player.y) < 700) { KR.A.sfx('heavy', 0.6); G.shake = Math.max(G.shake || 0, 0.5); }
        for (const e of G.ents.concat([G.player])) if (War.isFoe(t.faction, e) && Math.hypot(e.x - x, e.y - y) < def.aoe + (e.r || 12)) G.damage(t, e, Math.round(G.mitigate(t, e, dmg()) * (e === tg ? 1 : 0.6)), {});
      } });
    } else {
      const hit = Math.random() < 0.88;
      G.shoot(t, tg, def.proj, hit ? Math.max(1, Math.round(G.mitigate(t, tg, dmg()))) : 0);
    }
  };

  // ---------- war parties ----------
  War.squads = [];
  War.makeSoldier = function (f, cls, x, y, lv, hired) {
    const F = D.FACTIONS[f];
    const race = (hired && hired.race) || U.pick(F.races), gender = (hired && hired.gender) || (Math.random() < 0.5 ? 'm' : 'f');
    const NM = D.NAMES[f]; const nm = (hired && hired.name) || `${U.pick(NM[gender])} ${U.pick(NM.last)}`;
    const e = G.makeEnt({ type: 'guard', raider: true, faction: f, city: null, name: nm, title: '', x, y, homeX: x, homeY: y, level: lv, gender, race, hostile: true, seed: Math.random(),
      skin: KR.S.skinOf(race, Math.floor(Math.random() * 4)), hair: KR.S.HAIRS[Math.floor(Math.random() * 7)], hairStyle: Math.floor(Math.random() * 4) });
    e.ac = 600; e.r = 12; e.speed = 118; e.leash = 1e9; e.aggroR = 260; e.passive = true; e.res = { fire: 30, cold: 30, magic: 30, poison: 30, disease: 30 };
    War.dress(e, cls);
    e.title = hired ? `${hired.owner}'s ${D.SOLDIERS[cls].name}` : `${F.city} ${D.SOLDIERS[cls].name}`; e.hired = !!hired;
    return e; // makeEnt already adds it to the world
  };
  const gatesOf = (f) => { const cd = W.cityData[f]; return [[[cd.cx, cd.cy + cd.R + 2], [0, 1]], [[cd.cx + cd.R + 2, cd.cy + 3], [1, 0]], [[cd.cx - cd.R - 2, cd.cy + 3], [-1, 0]]].map(([p]) => p); };
  War.roster = function (f) { const a = G.account; a.war = a.war || {}; a.war.roster = a.war.roster || {}; return (a.war.roster[f] = a.war.roster[f] || []); };
  const RANK = { knight: 0, cavalry: 0, manatarms: 1, pikeman: 1, priest: 2, musketeer: 3, longbowman: 3 };
  War.launchRaid = function (f, quiet) {
    if (W.realm && W.realm !== 'main') return 0;
    const ef = War.enemyOf(f); const best = War.bestGates(f, ef); if (!best) return 0;
    const lv = Sys.cityTierLevel(f);
    const a = G.account; a.war = a.war || {}; a.war.lastLaunch = a.war.lastLaunch || {}; a.war.next = a.war.next || {};
    a.war.lastLaunch[f] = Date.now(); a.war.next[f] = Date.now() + D.WAR.everyMin * 60000; // the 24-minute cycle starts again
    const members = War.garrison(f);
    const F = D.FACTIONS[f], E = D.FACTIONS[ef], p = G.player; const mine = p && p.c.faction === f, theirs = p && p.c.faction === ef;
    if (!members.length) { if (mine && !quiet) G.log(`The war horns of ${F.city} sound, but the barracks is empty. No one marches this time.`, 'status', '#ffb24a'); return 0; }
    const bk = W.cityData[f].barracks || best.a;
    let path = W.findPathLong(bk[0], bk[1], best.b[0], best.b[1]);
    if (!path) { path = []; const n = Math.ceil(best.d / 4); for (let i = 1; i <= n; i++) path.push([Math.round(best.a[0] + (best.b[0] - best.a[0]) * i / n), Math.round(best.a[1] + (best.b[1] - best.a[1]) * i / n)]); }
    path.unshift(bk.slice());
    const sq = { f, ef, members: [], order: [], queue: [], path, hi: 0, id: Math.random().toString(36).slice(2, 7), started: G.now, arrived: false, bk };
    members.sort((x, y) => (RANK[x.soldier] || 1) - (RANK[y.soldier] || 1));
    for (const m of members) {
      m.squad = sq; m.warState = 'march'; m.sit = false; m.pi = 0; m.delayT = 0; m.hate.clear(); m.inCombat = false; sq.members.push(m); sq.order.push(m);
      if (m.hiredId) { const h = War.roster(f).find((x) => x.id === m.hiredId); if (h) h.raids = (h.raids || 0) + 1; }
    }
    War.squads.push(sq);
    G.say(sq.order[0], U.pick(['Form up! We march!', 'For the kingdom! Move out!', 'To war!']), 3);
    const n = members.length;
    if (!quiet) {
      G.log(`War horns sound! ${n} soldier${n > 1 ? 's' : ''} (level ${lv}) march out of the ${F.city} barracks together to attack ${E.city}.`, 'status', mine ? '#9affb8' : '#ff9a6a');
      if (KR.UI && KR.UI.toast) KR.UI.toast(theirs ? `${E.city} will be attacked!` : `${F.city} marches to war`, theirs ? `${n} soldiers from ${F.city} are on their way. Defend your kingdom.` : `${n} soldiers march on ${E.city}. Join them to tear down its defenses.`);
      KR.A.sfx('warcry', 0.5);
    }
    return n;
  };
  // the column advances along the road; it waits for stragglers and halts while any soldier is fighting
  War.squadTick = function (dt) {
    for (const sq of War.squads) {
      if (sq.arrived || !sq.path) continue;
      const live = sq.order.filter((m) => !m.dead && !m.removed && m.warState === 'march');
      if (!live.length) continue;
      const lead = live[0]; const [hx, hy] = sq.path[Math.min(sq.hi, sq.path.length - 1)];
      const cdE = W.cityData[sq.ef]; const nearCity = cdE && Math.max(Math.abs(lead.x / TS - cdE.cx), Math.abs(lead.y / TS - cdE.cy)) < cdE.R + 12;
      if (live.some((m) => m.inCombat)) { if (nearCity) sq.hi = sq.path.length; else continue; } // under fire at the enemy kingdom: deploy now
      const tail = live[live.length - 1]; const tt = War.formationTarget(tail);
      const lag = tt ? Math.hypot(tt.x - tail.x, tt.y - tail.y) : 0;
      if (Math.hypot(hx * TS + 16 - lead.x, hy * TS + 16 - lead.y) < 26 && lag < 110) sq.hi++;
      if (sq.hi >= sq.path.length - 10) { sq.arrived = true; for (const m of sq.members) if (m.warState === 'march') m.warState = 'assault'; War.onArrive(sq); }
    }
  };
  // where a soldier stands in the column: two abreast, one tile between ranks
  War.formationTarget = function (r) {
    const sq = r.squad; if (!sq || !sq.path) return null;
    const live = sq.order.filter((m) => !m.dead && !m.removed && m.warState === 'march'); const k = Math.max(0, live.indexOf(r));
    const row = Math.floor(k / 2), col = k % 2;
    const i = Math.max(0, Math.min(sq.path.length - 1, sq.hi - row)); const j = Math.min(sq.path.length - 1, i + 1);
    const [ax, ay] = sq.path[i], [bx, by] = sq.path[j]; let dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const side = row === 0 && live.length === 1 ? 0 : col ? 9 : -9;
    let x = ax * TS + 16 - dy * side, y = ay * TS + 16 + dx * side;
    if (W.solidAtPx(x, y)) { x = ax * TS + 16; y = ay * TS + 16; }
    return { x, y };
  };
  // walk a raider toward a world position, pathing around buildings when the straight line is blocked
  function walkTo(r, gx, gy, dt, mul = 1) {
    const d = Math.hypot(gx - r.x, gy - r.y); if (d < 4) { r.moving = false; return true; }
    const now = G.now;
    if (!r.lp || now > (r.lpT || 0) || Math.hypot((r.lpG || [0, 0])[0] - gx, (r.lpG || [0, 0])[1] - gy) > 64) {
      r.lpT = now + 2500; r.lpG = [gx, gy];
      r.lp = d < 70 ? null : W.findPathLong(Math.floor(r.x / TS), Math.floor(r.y / TS), Math.floor(gx / TS), Math.floor(gy / TS), 30000);
      r.lpi = 0;
    }
    let tx = gx, ty = gy;
    if (r.lp && r.lp.length) { while (r.lpi < r.lp.length - 1 && Math.hypot(r.lp[r.lpi][0] * TS + 16 - r.x, r.lp[r.lpi][1] * TS + 16 - r.y) < 14) r.lpi++; tx = r.lp[r.lpi][0] * TS + 16; ty = r.lp[r.lpi][1] * TS + 16; }
    G.chase(r, { x: tx, y: ty }, dt, mul);
    return false;
  }
  const PRIORITY = [
    (o, ef) => o.siege && o.faction === ef,
    (o, ef) => o.towerGuard && o.faction === ef,
    (o, ef) => o.type === 'npc' && o.city === ef && !o.barracks && !o.bell && !o.recruiter && !o.raidBoard,
    (o, ef) => o.type === 'guard' && !o.raider && !o.siege && o.faction === ef,
    (o, ef) => o.type === 'king' && o.faction === ef,
  ];
  War.pickTarget = function (r) {
    const ef = r.squad.ef; const cd = W.cityData[ef];
    for (const test of PRIORITY) {
      let best = null, bd = 1e9;
      for (const o of G.ents) { if (o.dead || o.removed || !test(o, ef)) continue; if (Math.max(Math.abs(o.x / TS - cd.cx), Math.abs(o.y / TS - cd.cy)) > cd.R + 2) continue; const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; best = o; } }
      if (best) return best;
    }
    return null;
  };
  War.updateRaider = function (r, dt) {
    if (r.dead) { if (!r.goneAt) r.goneAt = G.now + 25000; if (G.now > r.goneAt) War.removeRaider(r); return; }
    if (r.delayT > 0) { r.delayT -= dt; return; }
    if (r.warState === 'garrison' || r.warState === 'mustering') { // waiting in the barracks: rest, but defend it against intruders
      G.statusTick(r, dt);
      r.scanT = (r.scanT || Math.random()) - dt;
      if (r.scanT <= 0) { r.scanT = 0.8; const p = G.player; if (p && War.isFoe(r.faction, p) && Math.hypot(p.x - r.x, p.y - r.y) < 160) { r.sit = false; G.addHate(r, p, 5); } }
      const tg = r.inCombat ? G.topHate(r) : null;
      if (tg) { r.leash = 1e9; G.updateMob(r, dt); r.returning = false; } else { r.moving = false; r.inCombat = false; }
      return;
    }
    const sq = r.squad; r.returning = false; r.homeX = r.x; r.homeY = r.y;
    if (r.priest && War.priestTick(r, dt)) return;
    if (r.warState === 'assault') War.assaultThink(r);
    else {
      // on the road: deal with anyone who attacks the column or blocks its way
      r.scanT = (r.scanT || 0) - dt;
      if (r.scanT <= 0) {
        r.scanT = 0.5;
        const att = War.attackerOf(r);
        if (att) G.addHate(r, att, 10);
        else if (!r.inCombat || !G.topHate(r)) { let best = null, bd = 200; for (const o of G.ents.concat([G.player])) { if (!War.isFoe(r.faction, o) || o.siege) continue; const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; best = o; } } if (best) { G.addHate(r, best, 5); if (!sq.shouted && best === G.player) { sq.shouted = true; G.say(r, U.pick([`For ${D.FACTIONS[r.faction].city}!`, 'Cut them down!'])); } } }
      }
    }
    const tgt = r.inCombat ? G.topHate(r) : null;
    if (tgt && r.ranged && r.warState === 'assault' && sq && sq.arrived) { // archers and musketeers hold a shoulder-to-shoulder line
      const slot = (r.slotFail || 0) > G.now ? null : War.lineSlot(r);
      const dT = Math.hypot(tgt.x - r.x, tgt.y - r.y);
      if (slot && Math.hypot(slot.x - r.x, slot.y - r.y) > 22 && dT > 90) {
        G.statusTick(r, dt); if (r.stun > 0 || r.root > 0 || r.mez > 0) { r.moving = false; return; }
        if (!r.slotStart) r.slotStart = G.now; else if (G.now - r.slotStart > 6000) { r.slotFail = G.now + 8000; r.slotStart = 0; } // can't reach the spot: fight from where you are
        walkTo(r, slot.x, slot.y, dt); return;
      }
      r.slotStart = 0;
      if (dT <= 340 && W.lineClear(r.x, r.y - 10, tgt.x, tgt.y - 10)) { G.updateMob(r, dt); r.returning = false; r.leash = 1e9; return; }
      G.statusTick(r, dt); if (r.stun > 0 || r.root > 0 || r.mez > 0) { r.moving = false; return; } walkTo(r, tgt.x, tgt.y, dt); return;
    }
    if (tgt) {
      const reach = r.ranged ? 300 : G.meleeRange(r, tgt) + 2; const d = Math.hypot(tgt.x - r.x, tgt.y - r.y);
      if (d > reach + 30) { G.statusTick(r, dt); if (r.stun > 0 || r.root > 0 || r.mez > 0) { r.moving = false; return; } walkTo(r, tgt.x, tgt.y, dt); return; }
      G.updateMob(r, dt); r.returning = false; r.leash = 1e9; return;
    }
    G.statusTick(r, dt); if (r.stun > 0 || r.root > 0 || r.mez > 0) { r.moving = false; return; }
    if (r.warState === 'march') {
      const T = War.formationTarget(r); if (!T) return;
      const d = Math.hypot(T.x - r.x, T.y - r.y);
      if (d < 5) { r.moving = false; G.faceTo(r, { x: r.x + (sq.path[Math.min(sq.hi + 1, sq.path.length - 1)][0] * TS - r.x), y: r.y }); return; }
      // everyone marches at the same pace (cavalry rein in); stragglers jog to catch up
      const pace = 108 * (d > 90 ? 1.35 : 1); if (d > 220) walkTo(r, T.x, T.y, dt, pace / r.speed); else G.chase(r, T, dt, Math.min(pace, d / dt) / r.speed);
    } else if (r.warState === 'assault') {
      const t = War.pickTarget(r); if (!t) { r.warState = 'home'; return; } G.addHate(r, t, 20);
    } else if (r.warState === 'home') {
      // the city has nothing left to fight: march back home and stand down
      if (r.pi > 0) { r.pi--; const [tx, ty] = sq.path[r.pi]; walkTo(r, tx * TS + 16, ty * TS + 16, dt); if (!r.hb) { r.hb = 1; } }
      else War.returnHome(r);
      if (r.pi > 0 && Math.hypot(sq.path[r.pi][0] * TS + 16 - r.x, sq.path[r.pi][1] * TS + 16 - r.y) < 20) r.pi--;
    }
  };
  War.onArrive = function (sq) {
    sq.arrived = true; const p = G.player; const E = D.FACTIONS[sq.ef];
    if (p && p.c.faction === sq.ef) { G.log(`${E.city} is under attack! Soldiers of ${D.FACTIONS[sq.f].city} are at the gates.`, 'status', '#ff6a5a'); KR.A.sfx('warcry', 0.7); }
    else if (p && p.c.faction === sq.f) G.log(`Your war party has reached the gates of ${E.city}.`, 'status', '#9affb8');
  };
  War.removeRaider = function (r) {
    G.remove(r); const i = G.corpses.indexOf(r); if (i >= 0) G.corpses.splice(i, 1);
    const sq = r.squad; if (!sq) return; sq.members = sq.members.filter((m) => m !== r);
    if (!sq.members.length && !(sq.queue && sq.queue.length)) { War.squads = War.squads.filter((s) => s !== sq); }
  };
  War.onRaiderKilled = function (r) {
    if (r.hiredId) { const ros = War.roster(r.faction); const i = ros.findIndex((h) => h.id === r.hiredId); if (i >= 0) { ros.splice(i, 1); const p = G.player; if (p && p.c.faction === r.faction) G.log(`${r.name} the ${D.SOLDIERS[r.soldier].name} has fallen. Recruit another at the barracks.`, 'combat', '#ff9a6a'); } }
    const sq = r.squad; if (!sq || sq.reported) return;
    if (!(sq.queue && sq.queue.length) && sq.members.every((m) => m.dead)) { sq.reported = true; const p = G.player; if (p && (p.c.faction === sq.f || p.c.faction === sq.ef)) G.log(`A war party from ${D.FACTIONS[sq.f].city} has been wiped out.`, 'status', p.c.faction === sq.ef ? '#9affb8' : '#ff9a6a'); }
  };
  // timer: every 24 minutes of play each kingdom sends 1 war party per tier
  let acc = 0;
  War.tick = function (dt) {
    War.active = War.squads.length > 0;
    if (War.active) War.squadTick(dt);
    acc += dt; if (acc < 1) return; acc = 0;
    try { War.alarmTick(); } catch (e) { console.warn(e); }
    // new recruits trickle into the barracks between raids (one every 15 seconds)
    // recruits arrive on a schedule: one when the raid timer restarts, then one every (24 min / barracks size)
    if (!W.realm || W.realm === 'main') for (const f of D.FACTION_IDS) War.fillGarrison(f, false);
    if (!G.account || !G.player || (W.realm && W.realm !== 'main')) return;
    const a = G.account; a.war = a.war || {}; a.war.next = a.war.next || {};
    const now = Date.now();
    for (const f of D.FACTION_IDS) {
      if (!a.war.next[f]) a.war.next[f] = now + D.WAR.everyMin * 60000 + (f === D.FACTION_IDS[0] ? 0 : D.WAR.everyMin * 30000);
      if (now >= a.war.next[f]) { War.launchRaid(f); a.war.next[f] = Date.now() + D.WAR.everyMin * 60000; a.war.lastLaunch = a.war.lastLaunch || {}; a.war.lastLaunch[f] = Date.now(); }
    }
  };
  War.minutesToNext = (f) => { const a = G.account; const t = a && a.war && a.war.next && a.war.next[f]; return t ? Math.max(0, Math.ceil((t - Date.now()) / 60000)) : D.WAR.everyMin; };
  const origUpdate = G.update;
  G.update = function (dt, input) { origUpdate(dt, input); try { War.tick(dt); } catch (e) { console.warn(e); } };


  // ---------- patrols, alarm bell and the "under attack" alert ----------
  // patrol routes: a loop of streets just inside the wall, and a loop around the outside of the wall
  War.patrolRoute = function (f, outer) {
    const cd = W.cityData[f]; const cx = cd.cx, cy = cd.cy, r = outer ? cd.R + 3 : cd.R - 3;
    const pts = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].map(([a, b]) => [cx + a * r, cy + b * r]);
    // nudge each waypoint to the nearest open tile
    return pts.map(([x, y]) => { for (let k = 0; k < 6; k++) for (const [dx, dy] of [[0, 0], [k, 0], [-k, 0], [0, k], [0, -k], [k, k], [-k, -k]]) if (!W.isBlockedTile(x + dx, y + dy)) return [x + dx, y + dy]; return [x, y]; });
  };
  War.makePatrol = function (g, i) {
    const outer = i % 3 === 2; g.patrolRoute = War.patrolRoute(g.faction, outer); g.pIdx = i % 8; g.pDir = i % 2 ? 1 : -1; g.static = false;
  };
  function guardWalk(g, gx, gy, dt, mul) {
    const d = Math.hypot(gx - g.x, gy - g.y); if (d < 10) { g.moving = false; g.gp = null; return true; }
    if (!g.gp || g.gpGoal !== gx + ',' + gy || G.now > g.gpT) {
      g.gpGoal = gx + ',' + gy; g.gpT = G.now + 6000; g.gpi = 0;
      g.gp = W.findPathLong(Math.floor(g.x / TS), Math.floor(g.y / TS), Math.floor(gx / TS), Math.floor(gy / TS), 30000);
    }
    let tx = gx, ty = gy;
    if (g.gp && g.gp.length) { while (g.gpi < g.gp.length - 1 && Math.hypot(g.gp[g.gpi][0] * TS + 16 - g.x, g.gp[g.gpi][1] * TS + 16 - g.y) < 14) g.gpi++; tx = g.gp[g.gpi][0] * TS + 16; ty = g.gp[g.gpi][1] * TS + 16; }
    G.chase(g, { x: tx, y: ty }, dt, mul);
    return false;
  }
  // returns true when it handled the guard's movement this frame
  War.guardMove = function (g, dt) {
    if (g.stun > 0 || g.root > 0 || g.mez > 0) return false;
    if (g.alarmRun) { const bell = War.bellOf(g.faction); if (!bell) { g.alarmRun = false; return false; } if (guardWalk(g, bell.x + 26, bell.y + 6, dt, 1.15)) { g.alarmRun = false; War.ringBell(g.faction, g); } g.homeX = g.x; g.homeY = g.y; return true; }
    if (g.rally) { if (guardWalk(g, g.rally[0], g.rally[1], dt, 1.05) || G.now > g.rallyUntil) g.rally = null; g.homeX = g.x; g.homeY = g.y; return true; }
    if (g.patrolRoute) {
      const [tx, ty] = g.patrolRoute[g.pIdx];
      if (guardWalk(g, tx * TS + 16, ty * TS + 16, dt, 0.55)) { g.pIdx = (g.pIdx + g.pDir + g.patrolRoute.length) % g.patrolRoute.length; g.pauseT = 1 + Math.random() * 3; }
      if (g.pauseT > 0) { g.pauseT -= dt; g.moving = false; }
      g.homeX = g.x; g.homeY = g.y; return true;
    }
    return false;
  };
  War.bellOf = (f) => G.ents.find((e) => e.bell && e.faction === f && !e.removed);
  War.alarm = {};
  // the first sign of an attack sends the nearest guard running to the bell
  War.raiseAlarm = function (f, near) {
    const st = War.alarm[f] || (War.alarm[f] = {}); st.lastSeen = G.now; if (near) st.where = near;
    if (st.state) return;
    st.state = 'running'; st.since = G.now;
    const bell = War.bellOf(f); if (!bell) { War.ringBell(f, null); return; }
    let best = null, bd = 1e9; for (const o of G.ents) { if (o.type !== 'guard' || o.faction !== f || o.dead || o.raider || o.siege || o.inCombat || o.title === 'Royal Guard') continue; const d = Math.hypot(o.x - bell.x, o.y - bell.y); if (d < bd) { bd = d; best = o; } }
    if (!best) { War.ringBell(f, null); return; }
    best.alarmRun = true; st.runner = best; G.say(best, U.pick(['Raiders at the gate! To the bell!', 'Sound the alarm!', 'We are under attack! Ring the bell!']), 3);
    const p = G.player; if (p && p.c.faction === f) G.log(`${best.name} runs to ring the alarm bell!`, 'status', '#ffb24a');
  };
  War.ringBell = function (f, who) {
    const st = War.alarm[f] || (War.alarm[f] = {}); if (st.state === 'ringing') return; st.state = 'ringing'; st.rangAt = G.now;
    const bell = War.bellOf(f); if (bell) bell.ringUntil = G.now + 9000;
    const p = G.player; const F = D.FACTIONS[f]; const mine = p && p.c.faction === f;
    const near = bell && p && Math.hypot(bell.x - p.x, bell.y - p.y) < 1400;
    for (let i = 0; i < 7; i++) setTimeout(() => KR.A.sfx('alarmbell', mine || near ? (near ? 0.9 : 0.55) : 0.2), i * 1100);
    if (who) G.say(who, 'To arms! To arms!', 3);
    const where = st.where ? War.gateName(f, st.where) : 'the gates';
    G.log(`🔔 The alarm bell of ${F.city} rings! The city is under attack at ${where}!`, 'status', mine ? '#ff6a5a' : '#ffb24a');
    if (mine) { KR.UI && KR.UI.banner && KR.UI.banner(`${F.city} is under attack!`, `The alarm bell rings. Enemy soldiers are at ${where}. Defend the towers!`); }
    // patrols and off-duty guards rush to the fight
    if (st.where) for (const o of G.ents) if (o.type === 'guard' && o.faction === f && !o.dead && !o.raider && !o.siege && !o.inCombat && o.patrolRoute) { o.rally = [st.where.x + (Math.random() - 0.5) * 80, st.where.y + (Math.random() - 0.5) * 80]; o.rallyUntil = G.now + 40000; }
  };
  War.gateName = function (f, pos) {
    const cd = W.cityData[f]; const dx = pos.x / TS - cd.cx, dy = pos.y / TS - cd.cy;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'the east gate' : 'the west gate') : dy > 0 ? 'the south gate' : 'the north side';
  };
  // checks once a second: enemy soldiers inside or right outside a city raise the alarm; the alert clears when they are gone
  War.alarmTick = function () {
    for (const f of D.FACTION_IDS) {
      const cd = W.cityData[f]; if (!cd) continue;
      const foe = G.ents.find((e) => e.raider && !e.dead && e.squad && e.faction !== f && Math.max(Math.abs(e.x / TS - cd.cx), Math.abs(e.y / TS - cd.cy)) < cd.R + 9);
      const st = War.alarm[f] || (War.alarm[f] = {});
      if (foe) War.raiseAlarm(f, { x: foe.x, y: foe.y });
      else if (st.state && G.now - (st.lastSeen || 0) > 20000) { const p = G.player; if (p && p.c.faction === f) G.log(`The attack on ${D.FACTIONS[f].city} is over. The guards return to their posts.`, 'status', '#9affb8'); War.alarm[f] = {}; }
      // a runner who fell: send another
      if (st.state === 'running' && (!st.runner || st.runner.dead || G.now - st.since > 30000)) { if (st.runner && !st.runner.dead && G.now - st.since > 30000) War.ringBell(f, st.runner); else { st.state = null; War.raiseAlarm(f); } }
    }
    War.renderAlert();
  };
  War.renderAlert = function () {
    const p = G.player; if (!p) return; const f = p.c.faction; const st = War.alarm[f] || {};
    let el = document.getElementById('war-alert');
    if (!st.state) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'war-alert'; el.className = 'war-alert'; const ui = document.getElementById('ui'); if (!ui) return; ui.appendChild(el); }
    const n = G.ents.filter((e) => e.raider && !e.dead && e.faction !== f && e.squad).length;
    const txt = `⚔ ${D.FACTIONS[f].city} is under attack${st.where ? ' at ' + War.gateName(f, st.where) : ''} · ${n} enemy soldier${n === 1 ? '' : 's'}${st.state === 'running' ? ' · a guard runs to the alarm bell' : ''}`;
    if (el.textContent !== txt) el.textContent = txt;
  };
  War.spawnBell = function (f, mk) {
    const cd = W.cityData[f]; let spot = [cd.cx + 2, cd.cy + 1];
    for (const c of [[cd.cx + 2, cd.cy + 1], [cd.cx - 2, cd.cy + 1], [cd.cx + 3, cd.cy - 1], [cd.cx - 3, cd.cy - 1]]) if (!W.isBlockedTile(c[0], c[1]) && !G.ents.some((e) => e.city === f && Math.hypot(e.x - (c[0] * TS + 16), e.y - (c[1] * TS + 16)) < 30)) { spot = c; break; }
    const b = mk('bell', spot[0] * TS + 16, spot[1] * TS + 16, { type: 'npc', title: 'Rung when the kingdom is attacked', name: 'Alarm Bell' });
    b.bell = true; b.static = true; b.look = null; b.r = 14; b.h = 90; b.invuln = true;
  };
  War.raidStatus = function (f) {
    const sq = War.squads.filter((s) => s.f === f);
    if (sq.some((s) => s.queue && s.queue.length)) return { big: 'MARCHING OUT', small: 'the war party leaves now' };
    if (sq.some((s) => s.members.some((m) => !m.dead))) return { big: 'AT WAR', small: `next march in ${fmtT(War.secondsToNext(f))}` };
    return { big: fmtT(War.secondsToNext(f)), small: 'until the war party marches' };
  };
  const fmtT = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  War.drawBoard = function (g, e, t) {
    const x = e.x, y = e.y, F = D.FACTIONS[e.faction] || {}; const st = War.raidStatus(e.faction);
    const n = War.garrison(e.faction).length, want = War.garrisonWanted(e.faction).length;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 4, 34, 7, 0, 0, 6.28); g.fill();
    rect(g, '#4a3220', x - 30, y - 50, 5, 54); rect(g, '#4a3220', x + 25, y - 50, 5, 54);
    rect(g, '#6a4a2a', x - 40, y - 74, 80, 46); rect(g, '#7a5a36', x - 37, y - 71, 74, 40); g.strokeStyle = '#3a2614'; g.lineWidth = 2; g.strokeRect(x - 40, y - 74, 80, 46);
    rect(g, F.banner || '#7a1e1e', x - 40, y - 84, 80, 11); g.fillStyle = F.trim || '#e0c060'; g.font = 'bold 8px "Alegreya Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('NEXT RAID', x, y - 76);
    const urgent = st.big === 'MARCHING OUT' || st.big === 'AT WAR' || War.secondsToNext(e.faction) < 60;
    g.fillStyle = urgent ? `rgba(255,${Math.round(120 + 60 * Math.sin(t * 6))},90,1)` : '#fff0c8'; g.font = `bold ${st.big.length > 6 ? 11 : 17}px "Alegreya Sans", system-ui, sans-serif`; g.fillText(st.big, x, y - 52);
    g.fillStyle = '#f0dca8'; g.font = '8px "Alegreya Sans", system-ui, sans-serif'; g.fillText(st.small, x, y - 41);
    const nr = War.nextRecruitIn(e.faction); g.fillText(`garrison ${n} / ${want}${nr != null ? ' · recruit in ' + fmtT(nr) : ''}`, x, y - 33);
    g.restore();
  };
  War.drawBell = function (g, e, t) {
    const x = e.x, y = e.y; const ring = e.ringUntil && e.ringUntil > G.now; const sw = ring ? Math.sin(t * 9) * 0.5 : 0;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 4, 22, 7, 0, 0, 6.28); g.fill();
    rect(g, '#6d665e', x - 18, y - 6, 36, 10); // stone base
    rect(g, '#5a3e24', x - 16, y - 78, 5, 74); rect(g, '#5a3e24', x + 11, y - 78, 5, 74); rect(g, '#4a3220', x - 20, y - 84, 40, 7);
    g.fillStyle = '#6a3a2a'; g.beginPath(); g.moveTo(x - 24, y - 84); g.lineTo(x, y - 100); g.lineTo(x + 24, y - 84); g.closePath(); g.fill();
    g.translate(x, y - 76); g.rotate(sw);
    g.fillStyle = '#c89a3a'; g.beginPath(); g.moveTo(-3, 0); g.quadraticCurveTo(-11, 6, -11, 22); g.lineTo(11, 22); g.quadraticCurveTo(11, 6, 3, 0); g.closePath(); g.fill();
    g.fillStyle = '#a07a2a'; g.fillRect(-12, 20, 24, 4); g.fillStyle = '#5a4020'; g.beginPath(); g.arc(Math.sin(t * 9 + 1) * (ring ? 5 : 0), 25, 3, 0, 6.28); g.fill();
    g.restore();
    if (ring) { g.save(); g.strokeStyle = `rgba(255,220,120,${0.5 + 0.3 * Math.sin(t * 9)})`; g.lineWidth = 2; for (let i = 0; i < 2; i++) { const r = 18 + ((t * 40 + i * 20) % 40); g.globalAlpha = 1 - r / 58; g.beginPath(); g.arc(x, y - 64, r, 0, 6.28); g.stroke(); } g.restore(); }
  };

  // ---------- townsfolk advice: what to do next and how ----------
  Sys.advice = function () {
    const p = G.player; if (!p) return []; const c = p.c, f = c.faction, F = D.FACTIONS[f]; const ef = War.enemyOf(f), E = D.FACTIONS[ef];
    const out = []; const city = G.account.cities[f]; const lvl = city.level;
    // quests ready to hand in or waiting to be picked up
    const roles = {}; for (const e of G.ents) if (e.city === f && e.type === 'npc' && !e.dead) roles[e.role] = e;
    let ready = null, avail = null;
    for (const r in roles) { const q = Sys.questsFor(roles[r]); if (!ready && q.ready.length) ready = [roles[r], q.ready[0]]; if (!avail && q.avail.length) avail = [roles[r], q.avail[0]]; }
    if (ready) out.push(`${ready[0].name} is waiting for you to finish "${ready[1].title}". Hand it in for coin, experience${ready[1].reward && ready[1].reward.status ? ' and status for the kingdom' : ''}.`);
    const act = Object.keys(c.quests.active).map((id) => Sys.QUESTS[id]).filter((q) => q && !Sys.questComplete(q));
    if (act.length) out.push(`You still have "${act[0].title}" to do. ${Sys.questProgText ? '' : ''}Open your journal with J to see where to go.`);
    if (avail) out.push(`${avail[0].name}${avail[0].title ? ' the ' + avail[0].title : ''} has work for you: "${avail[1].title}". Look for the gold ! above people's heads.`);
    const kq = Sys.kingQuestFor(c); if (kq && c.level >= kq.lv - 2) out.push(`${F.king} has a task for you in the great hall. The king's quests give the most status for ${F.city}.`);
    // where to hunt
    if (c.level <= 10 && !(c.bossKills && (c.bossKills.rattigan || c.bossKills.drainjaw))) out.push(f === 'crown' ? 'Those cutpurses outside the walls are the Rat Tail Gang. They hide in the Valenmoor Sewers, just east of the kingdom walls. Good hunting for a young hero, and I hear they keep a prisoner down there.' : 'The orc pawns sneak in through the Aelindor Sewers, just west of the kingdom walls. Clear them out, it is safe enough for a young hero. Folk say the orcs caught some poor fool down there, too.');
    let regs = D.REGIONS.filter((r) => r.mobs && r.lv && c.level >= r.lv[0] - 1 && c.level <= r.lv[1] && (!r.faction || r.faction === f) && (!r.home || r.home === f));
    if (!regs.length) regs = D.REGIONS.filter((r) => r.mobs && r.lv && c.level >= r.lv[0] - 1 && c.level <= r.lv[1]);
    if (regs.length) { const r = regs.sort((a, b) => Math.abs((a.lv[0] + a.lv[1]) / 2 - c.level) - Math.abs((b.lv[0] + b.lv[1]) / 2 - c.level))[0]; out.push(`At your level, hunt in ${r.name} (levels ${r.lv[0]} to ${r.lv[1]}). White and blue monsters are fair fights; yellow hurt; red will kill you.`); }
    // status and the next kingdom level
    const need = D.statusToNext(lvl);
    if (need !== Infinity) out.push(`${F.city} has ${city.status} of ${need} status needed for Kingdom Level ${lvl + 1}. Quests, the king's tasks and slaying bosses all add status. Level ${lvl + 1} brings ${(Sys.unlockText ? Sys.unlockText(lvl + 1) : 'new merchants and stronger defenses').replace(/\.$/, '')}.`);
    else out.push(`${F.city} is a capital at Kingdom Level 5. Now march on ${E.city} and bring down ${E.king} to win the war.`);
    // bosses near the hero's level
    const boss = D.BOSSES.filter((b) => b.lv >= c.level - 3 && b.lv <= c.level + 6).sort((a, b) => Math.abs(a.lv - c.level) - Math.abs(b.lv - c.level))[0];
    if (boss) { const reg = D.REGIONS[D.REGION_BY_ID[boss.region]]; out.push(`${boss.name} (level ${boss.lv}) lurks in ${reg ? reg.name : 'the wilds'}. Slaying it gives a lot of status. Bring good gear, mercenaries or friends.`); }
    // gear holes
    const empty = ['head', 'chest', 'legs', 'feet', 'hands'].filter((s) => !c.equip[s]);
    if (empty.length >= 2) out.push(`You have nothing on your ${empty.slice(0, 2).join(' or ')}. Your stats come only from gear: visit the merchants, or craft your own at the smithy.`);
    // mercenaries
    if ((c.mercs || []).length < Sys.mercSlots()) out.push(`You can lead ${Sys.mercSlots()} mercenar${Sys.mercSlots() > 1 ? 'ies' : 'y'} and have ${(c.mercs || []).length}. The Mercenary Trader in the plaza hires companions who fight at your level.`);
    // war
    const ros = War.roster(f).length;
    { const max = War.maxRecruits(f); const home = War.garrison(f).length; out.push(ros < max ? `Our barracks has room for ${max - ros} more soldier${max - ros > 1 ? 's' : ''}. Talk to the recruiter in the barracks to sign them up, then send the war party against ${E.city} when you are ready.` : `The barracks is full: ${home} soldiers are waiting for your order to march on ${E.city}.`); }
    if (War.rivalActive && War.rivalActive()) { const R = War.rival(); out.push(`They say ${R.name}, a level ${R.level} ${D.CLASSES[R.cls].name}, leads ${E.city} now. Expect their soldiers at our gates when we least expect it.`); }
    out.push(`When the alarm bell rings, ${E.city}'s soldiers are attacking. Help the guards defend the towers at the gates.`);
    out.push(`The war is won when ${E.king} of ${E.city} falls, to you or to our war parties. Raise our city first: a stronger kingdom sends more soldiers and better ones.`);
    return out;
  };
  // ---------- barracks: hire permanent soldiers for your kingdom's war parties ----------
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  War.openBarracks = function (b) {
    const p = G.player; if (!p) return;
    if (b.faction !== p.c.faction) { G.log(`The quartermaster of ${D.FACTIONS[b.faction].city} spits at your feet. "We don't arm the enemy."`, 'sys', '#ff9a6a'); return; }
    const UI = KR.UI; UI.win('barracks', `${D.FACTIONS[b.faction].city} Barracks`, { w: 580, h: 620, x: 120, y: 60, render: War.renderBarracks }); UI.open('barracks');
  };
  War.renderBarracks = function (w) {
    const p = G.player, c = p.c, f = c.faction, b = w.body; const tier = U.clamp(Sys.cityLevel(f), 1, 5), lv = Sys.cityTierLevel(f);
    const ros = War.roster(f), max = D.WAR.rosterMax(tier);
    const counts = {}; for (const k of D.WAR.squad) counts[k] = (counts[k] || 0) + 1;
    const squadTxt = Object.keys(counts).map((k) => `${counts[k]} ${counts[k] > 1 ? D.SOLDIERS[k].plural || D.SOLDIERS[k].name + 's' : D.SOLDIERS[k].name}`).join(', ');
    b.innerHTML = `<p class="hint">Every ${D.WAR.everyMin} minutes ${D.FACTIONS[f].city} sends <b>${tier}</b> war part${tier > 1 ? 'ies' : 'y'} (one per kingdom level) at <b>level ${lv}</b>: ${squadTxt} each. Soldiers leave these barracks one at a time. Next march in about <b>${War.minutesToNext(f)} min</b>.</p>
      <p class="hint">Soldiers you hire are <b>permanent</b>: they join the first war party of every raid, and if they fall they return for the next one. They always fight at your kingdom's level.</p>
      <h4 class="abh">Your hired soldiers <small class="dim">${ros.length} of ${max} · each kingdom level adds 2 more places</small></h4><div class="bk-ros"></div>
      <h4 class="abh">Hire a soldier <small class="dim">you have ${G.fmtCoins(c.coins)}</small></h4><div class="bk-hire"></div>
      <h4 class="abh">Victory</h4><p class="hint">Slay the enemy king, yourself or with your war parties, to conquer their kingdom and win the game. You keep your hero, and both kingdoms start a new age at level 1.${c.victories ? ` You have won <b>${c.victories}</b> time${c.victories > 1 ? 's' : ''}.` : ''}</p>`;
    const rl = b.querySelector('.bk-ros');
    if (!ros.length) rl.innerHTML = '<p class="empty-note">No soldiers hired yet.</p>';
    ros.forEach((h) => {
      const S = D.SOLDIERS[h.cls];
      const row = document.createElement('div'); row.className = 'row-item';
      row.innerHTML = `<span class="ic">${S.icon}</span><div class="ri-m"><b>${esc(h.name)}</b><small>${S.name} · level ${lv}${h.raids ? ` · ${h.raids} raid${h.raids > 1 ? 's' : ''}` : ''}</small></div>`;
      const bt = document.createElement('button'); bt.className = 'btn small'; bt.textContent = 'Dismiss';
      bt.onclick = () => { KR.UI.confirm(`Dismiss ${h.name}? You will not get the coin back.`, () => { ros.splice(ros.indexOf(h), 1); for (const m of War.garrison(f)) if (m.hiredId === h.id) G.remove(m); Sys.saveAccount && Sys.saveAccount(true); War.renderBarracks(w); }); };
      row.appendChild(bt); rl.appendChild(row);
    });
    const hl = b.querySelector('.bk-hire');
    for (const k in D.SOLDIERS) {
      const S = D.SOLDIERS[k]; const cost = War.hireCost(f, k); const locked = tier < S.tier;
      const row = document.createElement('div'); row.className = 'row-item' + (locked ? ' locked' : '');
      row.innerHTML = `<span class="ic">${S.icon}</span><div class="ri-m"><b>${S.name}</b><small>${locked ? `Needs kingdom level ${S.tier}` : G.fmtCoins(cost)} · ${S.ranged ? 'ranged' : S.healer ? 'healer' : S.mounted ? 'mounted' : 'melee'}</small><small class="dim">${S.desc}</small></div>`;
      if (!locked) { const bt = document.createElement('button'); bt.className = 'btn gold small'; bt.textContent = 'Hire'; bt.disabled = c.coins < cost || ros.length >= max; bt.title = ros.length >= max ? 'All places are filled. Raise your kingdom level for more.' : c.coins < cost ? 'Not enough coin' : '';
        bt.onclick = () => War.hire(k); row.appendChild(bt); }
      hl.appendChild(row);
    }
  };
  War.hire = function (cls) {
    const p = G.player, c = p.c, f = c.faction; const tier = U.clamp(Sys.cityLevel(f), 1, 5);
    const ros = War.roster(f); const cost = War.hireCost(f, cls);
    if (ros.length >= D.WAR.rosterMax(tier) || c.coins < cost || tier < D.SOLDIERS[cls].tier) { KR.A.sfx('fail', 0.5); return; }
    const F = D.FACTIONS[f]; const gender = Math.random() < 0.5 ? 'm' : 'f'; const NM = D.NAMES[f];
    c.coins -= cost;
    const h = { id: Math.random().toString(36).slice(2, 8), cls, gender, race: U.pick(F.races), name: `${U.pick(NM[gender])} ${U.pick(NM.last)}`, owner: c.name, raids: 0 };
    ros.push(h); War.addGarrison(f, { cls, hired: h }); KR.A.sfx('coin'); G.log(`${h.name} the ${D.SOLDIERS[cls].name} joins your war party for ${G.fmtCoins(cost)}.`, 'sys', '#9affb8');
    Sys.saveAccount && Sys.saveAccount(true); Sys.save && Sys.save(true);
    if (KR.UI.isOpen('barracks')) War.renderBarracks(KR.UI.wins.barracks); KR.UI.refresh && KR.UI.refresh();
  };

  // ---------- victory: the enemy king falls, the war is won and a new age begins ----------
  War.victory = function (k, killer) {
    const p = G.player, c = p.c, f = c.faction, ef = k.faction; const F = D.FACTIONS[f], E = D.FACTIONS[ef];
    c.victories = (c.victories || 0) + 1;
    const byYou = killer === p || (killer && killer.owner === p);
    for (const sq of War.squads.slice()) for (const m of sq.members.slice()) War.removeRaider(m);
    War.squads = [];
    KR.A.sfx('levelup', 0.8); setTimeout(() => KR.A.sfx('quest', 0.7), 700);
    G.log(`VICTORY! ${E.city} has fallen ${byYou ? 'by your hand' : 'to the armies of ' + F.city}. ${F.name} has won the war.`, 'status', '#ffd84a');
    document.querySelectorAll('.win-modal').forEach((x) => x.remove());
    const ov = document.createElement('div'); ov.className = 'modal win-modal';
    ov.innerHTML = `<div class="modal-b victory"><div class="vic-crown">👑</div><h2>Victory!</h2><p class="lead">${esc(k.name)} is slain${byYou ? ' by your hand' : ''}, and ${esc(E.city)} has fallen to ${esc(F.city)}.</p>
      <p>${esc(c.name)} is honoured as a hero of the realm${c.victories > 1 ? ` for the ${c.victories}${['th', 'st', 'nd', 'rd'][c.victories % 10 > 3 || Math.floor(c.victories / 10) === 1 ? 0 : c.victories % 10]} time` : ''}. You keep your hero, gear, levels and coin.</p>
      <p class="dim">A new age begins: both kingdoms rebuild from Kingdom Level 1 and the war starts again.</p><button class="btn gold big">Begin the new age</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector('button').onclick = () => { ov.remove(); War.newAge(); };
  };
  War.newAge = function () {
    const a = G.account; const p = G.player;
    for (const f of D.FACTION_IDS) { const ct = a.cities[f]; ct.level = 1; ct.status = 0; }
    a.war = a.war || {}; a.war.next = {}; a.war.age = (a.war.age || 1) + 1;
    if (p && p.c.bans) p.c.bans = {};
    if (!W.realm || W.realm === 'main') for (const f of D.FACTION_IDS) { W.stampCity(f, 1); Sys.spawnCity(f); }
    if (W.buildMinimap) W.buildMinimap();
    // keep the hero out of any rubble left by the rebuilt walls
    if (p && W.isBlockedTile(Math.floor(p.x / TS), Math.floor(p.y / TS))) { const cd = W.cityData[p.c.faction]; p.x = cd.cx * TS + 16; p.y = (cd.cy + 2) * TS + 16; }
    G.log(`A new age begins (Age ${a.war.age}). Both kingdoms start again at Kingdom Level 1.`, 'status', '#ffd84a');
    KR.UI && KR.UI.banner && KR.UI.banner(`Age ${a.war.age} begins`, 'Both kingdoms rebuild from level 1. Raise your kingdom and march to war again.');
    Sys.saveAccount && Sys.saveAccount(true); Sys.save && Sys.save(true);
  };

  // ---------- drawing ----------
  const rect = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  War.draw = function (g, e, t) {
    if (e.barracks) return War.drawBarracks(g, e, t);
    if (e.bell) return War.drawBell(g, e, t);
    if (e.raidBoard) return War.drawBoard(g, e, t);
    if (e.customDraw) return e.customDraw(g, e, t);
    const x = e.x, y = e.y, F = D.FACTIONS[e.faction] || {}; const k = e.siege; const rec = (e.fireK || 0);
    g.save();
    const SC = War.SIEGE_SCALE; g.translate(x, y); g.scale(SC, SC); g.translate(-x, -y); // towers and engines are drawn larger than life
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 6, 30, 9, 0, 0, 6.28); g.fill();
    if (e.dead) { // rubble and smoke
      for (let i = 0; i < 9; i++) rect(g, i % 2 ? '#6a625a' : '#4a3a2a', x - 24 + (i * 13) % 44, y - 6 + (i * 7) % 12, 10, 7);
      for (let i = 0; i < 3; i++) { const ph = (t * 0.4 + i / 3) % 1; g.fillStyle = `rgba(70,70,70,${0.35 * (1 - ph)})`; g.beginPath(); g.arc(x + (i - 1) * 10, y - 10 - ph * 50, 6 + ph * 12, 0, 6.28); g.fill(); }
      g.restore(); return;
    }
    const ang = e.aimAng || 0; const fx = Math.cos(ang) >= 0 ? 1 : -1;
    if (k === 'archer') {
      // wooden watch tower with an archer on top
      rect(g, '#5a3e24', x - 18, y - 66, 5, 70); rect(g, '#5a3e24', x + 13, y - 66, 5, 70);
      g.strokeStyle = '#4a3220'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 16, y - 4); g.lineTo(x + 16, y - 50); g.moveTo(x + 16, y - 4); g.lineTo(x - 16, y - 50); g.stroke();
      rect(g, '#7a5a3a', x - 24, y - 72, 48, 8); rect(g, '#6a4a2a', x - 24, y - 84, 48, 12);
      for (let i = 0; i < 5; i++) rect(g, '#8a6a42', x - 23 + i * 10, y - 90, 6, 6);
      rect(g, F.banner || '#333', x + 18, y - 116, 14, 10); rect(g, '#3a2818', x + 16, y - 118, 2, 34);
      // archer
      rect(g, '#d8b090', x - 4, y - 104, 8, 8); rect(g, '#4a6b35', x - 6, y - 96, 12, 12); rect(g, '#6a6a6a', x - 5, y - 108, 10, 4);
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.arc(x + fx * 8, y - 92, 9, -1.2, 1.2); g.stroke();
      if (rec > 0.5) { g.strokeStyle = '#e8e0c8'; g.beginPath(); g.moveTo(x + fx * 4, y - 92); g.lineTo(x + fx * 18, y - 92); g.stroke(); }
    } else {
      // stone emplacement
      rect(g, '#6d665e', x - 26, y - 22, 52, 26); rect(g, '#5a544c', x - 26, y - 26, 52, 6);
      for (let i = 0; i < 5; i++) rect(g, '#7d766e', x - 25 + i * 11, y - 32, 7, 7);
      rect(g, F.banner || '#333', x - 6, y - 16, 12, 10);
      g.translate(x, y - 34);
      if (k === 'ballista' || k === 'heavyballista') {
        g.scale(1, 0.75); g.rotate(ang); const back = -rec * 4;
        rect(g, '#5a3e24', -18 + back, -3, 34, 6); // stock
        g.strokeStyle = k === 'heavyballista' ? '#8e9298' : '#6a4a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(8, -20); g.quadraticCurveTo(-2, 0, 8, 20); g.stroke();
        g.strokeStyle = '#e8e0c8'; g.lineWidth = 1; g.beginPath(); g.moveTo(8, -20); g.lineTo(-14 + (rec > 0.5 ? 18 : 0), 0); g.lineTo(8, 20); g.stroke();
        if (rec < 0.5) { rect(g, '#8a6a3a', -12, -1.5, 30, 3); rect(g, '#ccc', 18, -3, 6, 6); }
        if (k === 'heavyballista') { rect(g, '#8e9298', -6, -5, 4, 10); rect(g, '#8e9298', 4, -5, 4, 10); }
      } else if (k === 'catapult' || k === 'trebuchet') {
        const big = k === 'trebuchet'; const H = big ? 56 : 30;
        rect(g, '#5a3e24', -22, -4, 44, 6); rect(g, '#3a2818', -20, 0, 8, 8); rect(g, '#3a2818', 12, 0, 8, 8);
        g.strokeStyle = '#6a4a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-12, 0); g.lineTo(0, -H); g.lineTo(12, 0); g.stroke();
        const swing = rec > 0 ? (1 - rec) : 1; const a2 = (-0.6 + swing * 1.7) * fx; // arm swings over on firing
        g.save(); g.translate(0, -H); g.rotate(a2);
        rect(g, '#7a5a3a', -3, -H * 0.9, 6, H * 1.25);
        if (big) rect(g, '#4a4a4a', -9, H * 0.3, 18, 16); // counterweight
        if (rec < 0.3) { g.fillStyle = '#8a8070'; g.beginPath(); g.arc(0, -H * 0.9, 6, 0, 6.28); g.fill(); }
        g.restore();
      } else if (k === 'cannon') {
        g.scale(1, 0.8); g.rotate(ang);
        rect(g, '#3a2818', -12, -14, 8, 28); g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(-14 - rec * 6, -8); g.lineTo(26 - rec * 6, -6); g.lineTo(26 - rec * 6, 6); g.lineTo(-14 - rec * 6, 8); g.closePath(); g.fill();
        rect(g, '#4a4a52', 22 - rec * 6, -7, 5, 14); rect(g, '#5a5a62', -10, -9, 3, 18);
        if (rec > 0.6) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,190,90,${rec})`; g.beginPath(); g.arc(34, 0, 10 * rec, 0, 6.28); g.fill(); g.globalCompositeOperation = 'source-over'; }
      }
    }
    g.restore();
    // health bar, always shown: towers and engines can be attacked and destroyed like monsters
    { const top = y - (e.h || 80) - 30; const k = Math.max(0, e.hp / e.hpMax); g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(x - 31, top - 1, 62, 8); g.fillStyle = k > 0.5 ? '#c8402a' : k > 0.25 ? '#e0782a' : '#ff3a2a'; g.fillRect(x - 30, top, 60 * k, 6); g.strokeStyle = 'rgba(255,220,160,0.5)'; g.lineWidth = 1; g.strokeRect(x - 30.5, top - 0.5, 61, 7); }
  };
  War.drawBarracks = function (g, e, t) {
    const x = e.x, y = e.y, F = D.FACTIONS[e.faction] || {};
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 8, 50, 12, 0, 0, 6.28); g.fill();
    rect(g, '#7a6a58', x - 46, y - 40, 92, 46); // stone walls
    for (let i = 0; i < 7; i++) rect(g, '#6a5a48', x - 46 + i * 14, y - 40 + (i % 2) * 10, 10, 4);
    g.fillStyle = '#6a3a2a'; g.beginPath(); g.moveTo(x - 54, y - 38); g.lineTo(x, y - 74); g.lineTo(x + 54, y - 38); g.closePath(); g.fill(); // roof
    g.fillStyle = '#5a2a1a'; for (let i = 0; i < 5; i++) g.fillRect(x - 44 + i * 20, y - 44 - (i === 2 ? 22 : i % 4 ? 12 : 2), 3, 8);
    rect(g, '#3a2818', x - 10, y - 26, 20, 32); rect(g, '#2a1a10', x - 8, y - 24, 16, 30); // door
    rect(g, F.banner || '#333', x - 34, y - 34, 12, 20); rect(g, F.banner || '#333', x + 22, y - 34, 12, 20);
    g.fillStyle = F.trim || '#e0c060'; g.fillRect(x - 31, y - 28, 6, 6); g.fillRect(x + 25, y - 28, 6, 6);
    // weapon rack
    g.strokeStyle = '#8e9298'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + 52 + i * 5, y + 4); g.lineTo(x + 50 + i * 5, y - 26); g.stroke(); }
    g.restore();
  };
  // a horse under a mounted soldier
  War.drawHorse = function (g, e, t) {
    const x = e.x, y = e.y, f = e.face || 1; const w = e.moving ? Math.sin((e.walk || 0) * 1.2) : 0;
    g.save(); g.translate(x, y); g.scale(f, 1);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 4, 26, 7, 0, 0, 6.28); g.fill();
    const col = e.seed > 0.66 ? '#5a3a24' : e.seed > 0.33 ? '#2a2420' : '#c8c0b0';
    g.strokeStyle = col; g.lineWidth = 4; g.lineCap = 'round';
    for (const [lx, ph] of [[-14, 0], [-8, Math.PI], [10, Math.PI], [16, 0]]) { g.beginPath(); g.moveTo(lx, -16); g.lineTo(lx + Math.sin(w + ph) * 5, 2); g.stroke(); }
    g.fillStyle = col; g.beginPath(); g.ellipse(0, -20, 22, 9, 0, 0, 6.28); g.fill();
    g.beginPath(); g.moveTo(14, -24); g.lineTo(24, -40); g.lineTo(31, -36); g.lineTo(20, -18); g.closePath(); g.fill(); // neck
    g.beginPath(); g.ellipse(29, -38, 7, 4, 0.5, 0, 6.28); g.fill(); // head
    g.fillStyle = '#1a1410'; g.fillRect(17, -40, 6, 3); // mane
    g.strokeStyle = '#1a1410'; g.lineWidth = 3; g.beginPath(); g.moveTo(-21, -22); g.quadraticCurveTo(-30, -16, -27, -4); g.stroke(); // tail
    const F = D.FACTIONS[e.faction] || {}; g.fillStyle = F.banner || '#7a1e1e'; g.fillRect(-10, -28, 18, 10); g.fillStyle = F.trim || '#e0c060'; g.fillRect(-10, -19, 18, 2); // caparison
    g.restore();
  };
  War.drawMusket = function (g, e) {
    const f = e.face || 1; g.save(); g.translate(e.x + f * 4, e.y - 24); g.scale(f, 1); g.rotate(-0.15);
    g.fillStyle = '#4a2e1a'; g.fillRect(-8, -2, 12, 4); g.fillStyle = '#2a2a30'; g.fillRect(2, -1.5, 22, 3); g.restore();
  };
  // projectile looks for the engines
  War.drawProj = function (g, p, t) {
    if (p.vis === 'bolt') { g.strokeStyle = '#6a4a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-18, 0); g.lineTo(10, 0); g.stroke(); g.fillStyle = '#ccc'; g.beginPath(); g.moveTo(10, -5); g.lineTo(18, 0); g.lineTo(10, 5); g.fill(); return true; }
    if (p.vis === 'boulder') { const s = 1 + Math.sin(Math.min(1, p.t / 1.2) * Math.PI) * 0.6; g.rotate(t * 6); g.fillStyle = '#8a8070'; g.beginPath(); g.arc(0, 0, 7 * s, 0, 6.28); g.fill(); g.fillStyle = '#6a6258'; g.fillRect(-3 * s, -2 * s, 4 * s, 3 * s); return true; }
    if (p.vis === 'shot') { g.fillStyle = '#ffe0a0'; g.fillRect(-6, -1, 8, 2); g.fillStyle = 'rgba(200,200,200,0.5)'; g.fillRect(-16, -1, 10, 2); return true; }
    if (p.vis === 'ball') { g.fillStyle = '#1e1e22'; g.beginPath(); g.arc(0, 0, 6, 0, 6.28); g.fill(); g.fillStyle = 'rgba(255,170,80,0.5)'; g.beginPath(); g.arc(-8, 0, 4, 0, 6.28); g.fill(); return true; }
    return false;
  };

  // =====================================================================
  // v30: recruit-and-send war parties, single-file march then deployment,
  //      spacing between soldiers, and a CPU rival hero for solo play
  // =====================================================================
  D.WAR.perTier = 6;
  War.maxRecruits = (f) => D.WAR.perTier * U.clamp(Sys.cityLevel(f), 1, 5);
  War.minutesToNext = () => 0; // no more raid timer
  // the barracks holds exactly the soldiers you recruited and who are not out on a raid
  War.garrisonWanted = (f) => War.roster(f).filter((h) => !h.out).map((h) => ({ cls: h.cls, hired: h }));
  War.fillGarrison = function (f) {
    if (!War.barracksOf(f)) return;
    const ros = War.roster(f);
    for (const m of War.garrison(f)) { const h = ros.find((x) => x.id === m.hiredId); if (!h || h.out) G.remove(m); }
    const have = new Set(War.garrison(f).map((m) => m.hiredId));
    for (const h of ros) if (!h.out && !have.has(h.id)) War.addGarrison(f, { cls: h.cls, hired: h });
  };
  War.expectedGarrison = (f) => War.garrisonWanted(f).length;
  War.nextRecruitIn = () => null;
  // soldiers get their own spot in the barracks instead of piling up
  War.addGarrison = function (f, want) {
    const bb = War.barracksOf(f); if (!bb) return null;
    const taken = War.garrison(f).map((m) => [Math.floor(m.x / TS), Math.floor(m.y / TS)]);
    const spots = [];
    for (let ty = bb.y + 1; ty < bb.y + bb.h - 1; ty++) for (let tx = bb.x + 1; tx < bb.x + bb.w - 1; tx++) if (!W.isBlockedTile(tx, ty) && !(tx === bb.door.tx && ty >= bb.door.ty - 1)) spots.push([tx, ty, taken.filter(([a, b]) => a === tx && b === ty).length]);
    spots.sort((a, b) => a[2] - b[2] || Math.random() - 0.5);
    const [tx, ty, n] = spots[0] || [bb.x + 1, bb.y + 1, 0];
    const m = War.makeSoldier(f, want.cls, tx * TS + 16 + (n ? (Math.random() - 0.5) * 18 : 0), ty * TS + 18, Sys.cityTierLevel(f), want.hired ? Object.assign({ owner: want.hired.owner }, want.hired) : null);
    m.warState = 'garrison'; m.squad = null; m.hiredId = want.hired ? want.hired.id : null; m.sit = Math.random() < 0.4; m.face = Math.random() < 0.5 ? 1 : -1;
    return m;
  };
  War.hire = function (cls, f, owner, quiet) {
    const p = G.player; f = f || p.c.faction; const isPlayer = !owner;
    const ros = War.roster(f); const cost = War.hireCost(f, cls); const tier = U.clamp(Sys.cityLevel(f), 1, 5);
    if (ros.length >= War.maxRecruits(f) || tier < D.SOLDIERS[cls].tier) { if (isPlayer) KR.A.sfx('fail', 0.5); return false; }
    if (isPlayer) { if (p.c.coins < cost) { KR.A.sfx('fail', 0.5); return false; } p.c.coins -= cost; }
    const F = D.FACTIONS[f]; const gender = Math.random() < 0.5 ? 'm' : 'f'; const NM = D.NAMES[f];
    const h = { id: Math.random().toString(36).slice(2, 8), cls, gender, race: U.pick(F.races), name: `${U.pick(NM[gender])} ${U.pick(NM.last)}`, owner: owner || p.c.name, raids: 0 };
    ros.push(h); if (!W.realm || W.realm === 'main') War.addGarrison(f, { cls, hired: h });
    if (isPlayer && !quiet) { KR.A.sfx('coin'); G.log(`${h.name} the ${D.SOLDIERS[cls].name} joins the barracks for ${G.fmtCoins(cost)}.`, 'sys', '#9affb8'); }
    Sys.saveAccount && Sys.saveAccount(true); if (isPlayer) { Sys.save && Sys.save(true); if (KR.UI.isOpen('barracks')) War.renderBarracks(KR.UI.wins.barracks); KR.UI.refresh && KR.UI.refresh(); }
    return true;
  };
  War.launchRaid = function (f, quiet) {
    if (W.realm && W.realm !== 'main') return 0;
    const ef = War.enemyOf(f); const best = War.bestGates(f, ef); if (!best) return 0;
    War.fillGarrison(f);
    const members = War.garrison(f);
    const F = D.FACTIONS[f], E = D.FACTIONS[ef], p = G.player; const mine = p && p.c.faction === f, theirs = p && p.c.faction === ef;
    if (!members.length) { if (mine && !quiet) G.log('The barracks is empty. Recruit soldiers first.', 'sys', '#ffb24a'); return 0; }
    const bk = W.cityData[f].barracks || best.a;
    let path = W.findPathLong(bk[0], bk[1], best.b[0], best.b[1]);
    if (!path) { path = []; const n = Math.ceil(best.d / 4); for (let i = 1; i <= n; i++) path.push([Math.round(best.a[0] + (best.b[0] - best.a[0]) * i / n), Math.round(best.a[1] + (best.b[1] - best.a[1]) * i / n)]); }
    path.unshift(bk.slice());
    const cdE = W.cityData[ef]; const end = path[path.length - 1]; let ax = cdE.cx - end[0], ay = cdE.cy - end[1]; const al = Math.hypot(ax, ay) || 1;
    const sq = { f, ef, members: [], order: [], queue: [], path, hi: 0, id: Math.random().toString(36).slice(2, 7), started: G.now, arrived: false, bk, dir: [ax / al, ay / al] };
    members.sort((x, y) => (RANK[x.soldier] || 1) - (RANK[y.soldier] || 1));
    for (const m of members) {
      m.squad = sq; m.warState = 'march'; m.sit = false; m.pi = 0; m.delayT = 0; m.hate.clear(); m.inCombat = false; sq.members.push(m); sq.order.push(m);
      const h = War.roster(f).find((x) => x.id === m.hiredId); if (h) { h.out = true; h.raids = (h.raids || 0) + 1; }
    }
    War.squads.push(sq);
    G.say(sq.order[0], U.pick(['Form up! We march!', 'Single file! Move out!', 'To war!']), 3);
    const n = members.length;
    if (!quiet) {
      G.log(`${n} soldier${n > 1 ? 's' : ''} of ${F.city} march out of the barracks in single file to attack ${E.city}.`, 'status', mine ? '#9affb8' : '#ff9a6a');
      if (KR.UI && KR.UI.toast) KR.UI.toast(theirs ? `${E.city} will be attacked!` : `${F.city} marches to war`, theirs ? `${n} soldiers from ${F.city} are on their way. Defend your kingdom.` : `${n} soldiers march on ${E.city}.`);
      KR.A.sfx('warcry', 0.5);
    }
    Sys.saveAccount && Sys.saveAccount(true);
    if (mine && KR.UI.isOpen('barracks')) War.renderBarracks(KR.UI.wins.barracks);
    return n;
  };
  // survivors who make it home go back into the barracks
  War.returnHome = function (r) {
    const h = War.roster(r.faction).find((x) => x.id === r.hiredId); if (h) h.out = false;
    War.removeRaider(r); War.fillGarrison(r.faction);
    const p = G.player; if (p && p.c.faction === r.faction && h) G.log(`${r.name} is back in the barracks.`, 'sys', '#9affb8');
  };
  War.recall = function (f) {
    for (const sq of War.squads) if (sq.f === f) { for (const m of sq.members) if (!m.dead) { m.warState = 'home'; m.hate.clear(); m.inCombat = false; m.focus = null; m.pi = Math.min(m.pi || sq.hi, sq.path.length - 1); if (!m.pi) m.pi = Math.min(sq.hi, sq.path.length - 1); } sq.arrived = true; }
    G.log('You sound the retreat. Your soldiers march back to the barracks.', 'sys', '#e8d48a');
  };
  // single file on the road: one soldier per tile behind the leader
  War.formationTarget = function (r) {
    const sq = r.squad; if (!sq || !sq.path) return null;
    const live = sq.order.filter((m) => !m.dead && !m.removed && m.warState === 'march'); const k = Math.max(0, live.indexOf(r));
    const i = Math.max(0, Math.min(sq.path.length - 1, sq.hi - k));
    return { x: sq.path[i][0] * TS + 16, y: sq.path[i][1] * TS + 16 };
  };
  War.squadTick = function (dt) {
    for (const sq of War.squads) {
      if (!sq.path) continue;
      // the shared objective for the archers' line
      sq.focusT = (sq.focusT || 0) - dt;
      if (sq.arrived && sq.focusT <= 0) { sq.focusT = 3; const lead = sq.members.find((m) => !m.dead && !m.ranged) || sq.members.find((m) => !m.dead); sq.focus = lead ? War.pickTarget(lead) : null; }
      if (sq.arrived) continue;
      const live = sq.order.filter((m) => !m.dead && !m.removed && m.warState === 'march');
      if (!live.length) continue;
      const lead = live[0]; const [hx, hy] = sq.path[Math.min(sq.hi, sq.path.length - 1)];
      const cdE = W.cityData[sq.ef]; const nearCity = cdE && Math.max(Math.abs(lead.x / TS - cdE.cx), Math.abs(lead.y / TS - cdE.cy)) < cdE.R + 12;
      if (live.some((m) => m.inCombat)) { if (nearCity) sq.hi = sq.path.length; else continue; } // under fire at the enemy kingdom: deploy now
      const tail = live[live.length - 1]; const tt = War.formationTarget(tail);
      const lag = tt ? Math.hypot(tt.x - tail.x, tt.y - tail.y) : 0;
      if (Math.hypot(hx * TS + 16 - lead.x, hy * TS + 16 - lead.y) < 24 && lag < 120) sq.hi++;
      if (sq.hi >= sq.path.length - 8) {
        // at the enemy kingdom: fan out. melee soldiers charge forward, ranged soldiers form a line behind them
        sq.arrived = true; for (const m of sq.members) if (m.warState === 'march') m.warState = 'assault';
        War.onArrive(sq); G.say(lead, U.pick(['Spread out! Archers, form a line!', 'Line up! Charge!', 'Deploy!']), 3);
      }
    }
  };
  // a ranged soldier's place in the line: shoulder to shoulder, a bow-shot back from the objective
  War.lineSlot = function (r) {
    const sq = r.squad; if (!sq) return null; const f = sq.focus || r.focus; if (!f) return null;
    const rangers = sq.members.filter((m) => !m.dead && m.ranged && m.warState === 'assault'); const i = rangers.indexOf(r); if (i < 0) return null;
    let [dx, dy] = sq.dir; const vx = f.x - (sq.lineFrom ? sq.lineFrom[0] : f.x - dx * 300), vy = f.y - (sq.lineFrom ? sq.lineFrom[1] : f.y - dy * 300); const L = Math.hypot(vx, vy) || 1; dx = vx / L; dy = vy / L;
    const back = 230; const sp = 30; const off = (i - (rangers.length - 1) / 2) * sp;
    let x = f.x - dx * back - dy * off, y = f.y - dy * back + dx * off;
    if (W.isBlockedTile(Math.floor(x / TS), Math.floor(y / TS))) { x = f.x - dx * back; y = f.y - dy * back; }
    return { x, y };
  };
  // keep soldiers from standing on top of each other
  War.separate = function (dt) {
    const list = G.ents.filter((e) => !e.dead && !e.removed && ((e.raider && e.warState !== 'march' && e.warState !== 'home') || (e.type === 'guard' && !e.raider && !e.siege && !e.static && e.inCombat)));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy);
      const min = 22; if (d >= min) continue;
      const push = Math.min(min - d, 40 * dt) * 0.5; const nx = d > 0.01 ? dx / d : Math.random() - 0.5, ny = d > 0.01 ? dy / d : Math.random() - 0.5;
      if (!(a.sit && a.warState === 'garrison')) G.moveEnt(a, -nx * push, -ny * push);
      if (!(b.sit && b.warState === 'garrison')) G.moveEnt(b, nx * push, ny * push);
    }
  };

  // ---------- the CPU rival: a hero of the enemy kingdom when nobody else is playing it ----------
  War.rival = function () {
    const a = G.account; const p = G.player; if (!a || !p) return null; a.war = a.war || {};
    const rf = War.enemyOf(p.c.faction); let R = a.war.rival;
    if (!R || R.f !== rf) {
      const F = D.FACTIONS[rf]; const race = U.pick(F.races); const cls = U.pick(Object.keys(D.CLASSES)); const gender = Math.random() < 0.5 ? 'm' : 'f'; const NM = D.NAMES[rf];
      R = a.war.rival = { f: rf, race, cls, gender, name: `${U.pick(NM[gender])} ${U.pick(NM.last)}`, level: Math.max(1, p.c.level - 1), xp: 0, nextRecruit: Date.now() + 4 * 60000, nextRaid: Date.now() + (20 + Math.random() * 20) * 60000, nextDeed: Date.now() + 90000, skin: Math.floor(Math.random() * 4), hair: Math.floor(Math.random() * 7), hairStyle: Math.floor(Math.random() * 4) };
    }
    return R;
  };
  War.rivalActive = function () { const p = G.player; if (!p) return false; const rf = War.enemyOf(p.c.faction); return !(Sys.Net && Sys.Net.peers && Sys.Net.peers.some((pp) => pp.f === rf)); };
  // runs once a second of real play time; paced like an ordinary player, never above your level + 2
  War.rivalTick = function () {
    const p = G.player; if (!p || !War.rivalActive()) return; const R = War.rival(); if (!R) return;
    const now = Date.now(); const rf = R.f; const F = D.FACTIONS[rf];
    const cap = Math.min(D.MAX_LEVEL, Math.max(5, p.c.level + 2));
    // experience: a level every few minutes early on, slower later
    if (R.level < cap) { R.xp += 1 / 60; const need = 5 + R.level * 0.7; if (R.xp >= need) { R.xp = 0; R.level++; War.updateRivalAvatar(); if (R.level % 5 === 0) G.log(`Word from the front: ${R.name}, the ${D.CLASSES[R.cls].name} of ${F.city}, has reached level ${R.level}.`, 'status', '#ffb0a0'); } }
    // deeds: quests, the king's tasks and bosses earn status for the rival's city
    if (now >= R.nextDeed) {
      R.nextDeed = now + (90 + Math.random() * 150) * 1000;
      const boss = D.BOSSES.filter((b) => b.lv <= R.level - 1).sort((a, b) => b.lv - a.lv)[0];
      if (boss && Math.random() < 0.18) { Sys.addStatus(rf, Math.round(boss.lv * 3), `slaying ${boss.name}`); G.log(`Rumor: ${R.name} of ${F.city} has slain ${boss.name}! ${F.city} grows stronger.`, 'status', '#ffb0a0'); }
      else Sys.addStatus(rf, Math.round(8 + R.level * 1.2 + Math.random() * 10), 'a quest');
    }
    // the rival recruits soldiers and sends them at random times, like a live player would
    if (W.realm && W.realm !== 'main') return;
    const ros = War.roster(rf);
    if (now >= R.nextRecruit) { R.nextRecruit = now + (150 + Math.random() * 210) * 1000; if (ros.length < War.maxRecruits(rf)) { const tier = U.clamp(Sys.cityLevel(rf), 1, 5); const opts = Object.keys(D.SOLDIERS).filter((k) => D.SOLDIERS[k].tier <= tier); War.hire(U.pick(opts), rf, R.name, true); } }
    const home = ros.filter((h) => !h.out).length; const away = War.squads.some((s) => s.f === rf && s.members.some((m) => !m.dead));
    if (now >= R.nextRaid && !away && home >= Math.max(3, Math.ceil(War.maxRecruits(rf) * 0.6))) {
      R.nextRaid = now + (18 + Math.random() * 30) * 60000;
      War.launchRaid(rf);
    } else if (now >= R.nextRaid && away) R.nextRaid = now + 5 * 60000;
  };
  // the rival hero walks the streets of the enemy kingdom; you can fight them
  War.updateRivalAvatar = function () {
    const p = G.player; if (!p) return; const R = War.rival(); if (!R) return;
    let e = G.ents.find((x) => x.rivalHero && !x.removed);
    if (!War.rivalActive() || (W.realm && W.realm !== 'main') || !W.cityData[R.f]) { if (e) G.remove(e); return; }
    if (!e) {
      const cd = W.cityData[R.f];
      e = G.makeEnt({ type: 'guard', faction: R.f, city: null, name: R.name, x: cd.cx * TS + 16, y: (cd.cy + 3) * TS + 16, level: R.level, gender: R.gender, race: R.race, hostile: true, seed: Math.random(),
        skin: KR.S.skinOf(R.race, R.skin), hair: KR.S.HAIRS[R.hair], hairStyle: R.hairStyle });
      e.rivalHero = true; e.look = Object.assign(KR.S.classLook(R.cls, null), { race: R.race, gender: R.gender, skin: e.skin, hair: e.hair, hairStyle: e.hairStyle, cls: R.cls });
      Sys.makeGuard(e, false); e.look = Object.assign(KR.S.classLook(R.cls, null), { race: R.race, gender: R.gender, skin: e.skin, hair: e.hair, hairStyle: e.hairStyle, cls: R.cls });
      War.makePatrol(e, 1);
    }
    e.level = R.level; e.title = `Level ${R.level} ${D.RACES[R.race] ? D.RACES[R.race].name : ''} ${D.CLASSES[R.cls].name} · Rival hero`;
    e.hpMax = Math.round(G.mobHp(R.level) * 2.4); if (e.hp > e.hpMax || !e.hp) e.hp = e.hpMax; e.dmg = Math.round(3 + R.level * 2.2); e.delay = 2.2;
  };

  let acc2 = 0;
  War.tick = function (dt) {
    War.active = War.squads.length > 0 || G.ents.some((e) => e.raider && e.warState === 'garrison');
    if (War.squads.length) War.squadTick(dt);
    War.separate(dt);
    acc2 += dt; if (acc2 < 1) return; acc2 = 0;
    try { War.alarmTick(); } catch (e) { console.warn(e); }
    try { War.rivalTick(); } catch (e) { console.warn(e); }
    if (Math.random() < 0.1) War.updateRivalAvatar();
  };
  // after the city is rebuilt: anyone marked away with no soldier on the field is back home
  const oldSpawnDefenses = War.spawnDefenses;
  War.spawnDefenses = function (f, mk) {
    for (const h of War.roster(f)) if (h.out && !G.ents.some((e) => e.raider && e.hiredId === h.id && !e.dead && !e.removed)) h.out = false;
    oldSpawnDefenses(f, mk);
    setTimeout(() => War.updateRivalAvatar(), 50);
  };
  // the board by the barracks door: soldiers ready, and how to send them
  War.raidStatus = function (f) {
    const out = War.squads.some((s) => s.f === f && s.members.some((m) => !m.dead));
    const n = War.garrison(f).length, max = War.maxRecruits(f);
    if (out) return { big: 'AT WAR', small: `${n} more waiting inside` };
    return { big: `${n} / ${max}`, small: n ? 'soldiers ready to march' : 'recruit soldiers inside' };
  };
  War.drawBoard = function (g, e, t) {
    const x = e.x, y = e.y, F = D.FACTIONS[e.faction] || {}; const st = War.raidStatus(e.faction);
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 4, 34, 7, 0, 0, 6.28); g.fill();
    rect(g, '#4a3220', x - 30, y - 50, 5, 54); rect(g, '#4a3220', x + 25, y - 50, 5, 54);
    rect(g, '#6a4a2a', x - 40, y - 74, 80, 46); rect(g, '#7a5a36', x - 37, y - 71, 74, 40); g.strokeStyle = '#3a2614'; g.lineWidth = 2; g.strokeRect(x - 40, y - 74, 80, 46);
    rect(g, F.banner || '#7a1e1e', x - 40, y - 84, 80, 11); g.fillStyle = F.trim || '#e0c060'; g.font = 'bold 8px "Alegreya Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('WAR PARTY', x, y - 76);
    g.fillStyle = st.big === 'AT WAR' ? `rgba(255,${Math.round(120 + 60 * Math.sin(t * 6))},90,1)` : '#fff0c8'; g.font = 'bold 17px "Alegreya Sans", system-ui, sans-serif'; g.fillText(st.big, x, y - 50);
    g.fillStyle = '#f0dca8'; g.font = '8px "Alegreya Sans", system-ui, sans-serif'; g.fillText(st.small, x, y - 39);
    g.fillText('talk to the recruiter', x, y - 31);
    g.restore();
  };
  War.renderBarracks = function (w) {
    const p = G.player, c = p.c, f = c.faction, b = w.body; const tier = U.clamp(Sys.cityLevel(f), 1, 5), lv = Sys.cityTierLevel(f);
    const ros = War.roster(f), max = War.maxRecruits(f); const home = War.garrison(f).length; const out = ros.filter((h) => h.out).length;
    const R = War.rivalActive() ? War.rival() : null; const ef = War.enemyOf(f), E = D.FACTIONS[ef];
    const atWar = War.squads.some((s) => s.f === f && s.members.some((m) => !m.dead));
    b.innerHTML = `<p class="hint">Recruit soldiers here and send them to attack ${E.city} whenever you are ready. The barracks holds <b>${max}</b> (6 per kingdom level); they fight at <b>level ${lv}</b>. Soldiers march in single file and spread into battle formation at the enemy kingdom: archers form a line, the rest charge. Survivors come back here; fallen soldiers are lost.</p>
      <div class="row bk-send"><button class="btn gold" id="bk-go" ${home && !atWar ? '' : 'disabled'}>⚔ Send the war party (${home})</button>${atWar ? '<button class="btn" id="bk-recall">Sound the retreat</button>' : ''}</div>
      <h4 class="abh">Your soldiers <small class="dim">${ros.length} of ${max} · ${home} in the barracks${out ? ` · ${out} at war` : ''}</small></h4><div class="bk-ros"></div>
      <h4 class="abh">Recruit <small class="dim">you have ${G.fmtCoins(c.coins)}</small></h4><div class="bk-hire"></div>
      ${R ? `<h4 class="abh">Your rival</h4><p class="hint"><b>${esc(R.name)}</b>, level ${R.level} ${D.RACES[R.race] ? D.RACES[R.race].name : ''} ${D.CLASSES[R.cls].name}, fights for ${E.city} (Kingdom Level ${Sys.cityLevel(ef)}). They level up, raise their kingdom and send their own war parties at unexpected times. ${E.city}'s barracks holds ${War.roster(ef).filter((h) => !h.out).length} soldiers.</p>` : ''}
      <h4 class="abh">Victory</h4><p class="hint">Slay the enemy king, yourself or with your war party, to conquer ${E.city} and win. You keep your hero, and both kingdoms start a new age at level 1.${c.victories ? ` You have won <b>${c.victories}</b> time${c.victories > 1 ? 's' : ''}.` : ''}</p>`;
    const go = b.querySelector('#bk-go'); if (go) go.onclick = () => { War.launchRaid(f); KR.UI.close('barracks'); };
    const rc = b.querySelector('#bk-recall'); if (rc) rc.onclick = () => { War.recall(f); War.renderBarracks(w); };
    const rl = b.querySelector('.bk-ros');
    if (!ros.length) rl.innerHTML = '<p class="empty-note">No soldiers yet. Recruit some below.</p>';
    ros.forEach((h) => {
      const S = D.SOLDIERS[h.cls];
      const row = document.createElement('div'); row.className = 'row-item';
      row.innerHTML = `<span class="ic">${S.icon}</span><div class="ri-m"><b>${esc(h.name)}</b><small>${S.name} · level ${lv} · ${h.out ? '<span style="color:#ff9a6a">at war</span>' : 'in the barracks'}${h.raids ? ` · ${h.raids} raid${h.raids > 1 ? 's' : ''}` : ''}</small></div>`;
      if (!h.out) { const bt = document.createElement('button'); bt.className = 'btn small'; bt.textContent = 'Dismiss';
        bt.onclick = () => { KR.UI.confirm(`Dismiss ${h.name}? You will not get the coin back.`, () => { ros.splice(ros.indexOf(h), 1); War.fillGarrison(f); Sys.saveAccount && Sys.saveAccount(true); War.renderBarracks(w); }); }; row.appendChild(bt); }
      rl.appendChild(row);
    });
    const hl = b.querySelector('.bk-hire');
    for (const k in D.SOLDIERS) {
      const S = D.SOLDIERS[k]; const cost = War.hireCost(f, k); const locked = tier < S.tier;
      const row = document.createElement('div'); row.className = 'row-item' + (locked ? ' locked' : '');
      row.innerHTML = `<span class="ic">${S.icon}</span><div class="ri-m"><b>${S.name}</b><small>${locked ? `Needs kingdom level ${S.tier}` : G.fmtCoins(cost)} · ${S.ranged ? 'ranged' : S.healer ? 'healer' : S.mounted ? 'mounted' : 'melee'}</small><small class="dim">${S.desc}</small></div>`;
      if (!locked) { const bt = document.createElement('button'); bt.className = 'btn gold small'; bt.textContent = 'Recruit'; bt.disabled = c.coins < cost || ros.length >= max; bt.title = ros.length >= max ? 'The barracks is full. Raise your kingdom level for 6 more places.' : c.coins < cost ? 'Not enough coin' : '';
        bt.onclick = () => War.hire(k); row.appendChild(bt); }
      hl.appendChild(row);
    }
  };
  // a new age also brings a new rival
  const oldNewAge = War.newAge;
  War.newAge = function () { const a = G.account; if (a && a.war) { a.war.rival = null; a.war.roster = {}; } oldNewAge(); War.rival(); War.updateRivalAvatar(); };

  // ---------- townsfolk run home when the alarm sounds ----------
  War.npcFlee = function (e) {
    e.fleeing = true;
    const inside = W.buildingAt(e.x, e.y);
    if (inside && inside.type !== 'barracks') return; // shopkeepers already indoors simply stay put
    const houses = W.buildings.filter((b) => b.city === e.city && (b.type === 'house' || b.type === 'inn'));
    let goal = e.home && e.home.spots && e.home.spots.home ? e.home.spots.home[0] : null;
    if (!goal && houses.length) { const hb = houses.slice().sort((a, b) => Math.hypot(a.px + a.pw / 2 - e.x, a.py + a.ph / 2 - e.y) - Math.hypot(b.px + b.pw / 2 - e.x, b.py + b.ph / 2 - e.y))[0]; goal = (hb.spots.home || hb.spots.seat || [[hb.px + hb.pw / 2, hb.py + hb.ph / 2]])[0]; }
    if (!goal) return;
    const path = W.findPathLong(Math.floor(e.x / TS), Math.floor(e.y / TS), Math.floor(goal[0] / TS), Math.floor(goal[1] / TS), 20000);
    if (!path) return;
    if (e.static) { e.wasStatic = true; e.static = false; }
    e.fleeSpeed = e.speed; e.speed = Math.max(e.speed, 110) * 1.4;
    e.path = path; e.task = 'hide'; e.taskDur = 9999; e.doing = null;
    if (Math.random() < 0.4) G.say(e, U.pick(['Raiders! Run!', 'Get inside!', 'Hide the children!', 'They are at the gates!']), 2.5);
  };
  War.npcReturn = function (e) {
    e.fleeing = false; if (e.fleeSpeed) { e.speed = e.fleeSpeed; e.fleeSpeed = null; }
    if (e.wasStatic) { e.wasStatic = false; e.static = true; e.path = null; e.x = e.homeX; e.y = e.homeY; e.moving = false; }
    else { e.path = null; e.idleT = 1 + Math.random() * 4; }
  };

  // ---------- the assault: march on the king, fight back against whoever attacks along the way ----------
  const od = G.damage;
  G.damage = function (src, tgt, amt, opt) {
    if (tgt && tgt.raider && src && src !== tgt && !src.raider) { const who = src; (tgt.hitBy || (tgt.hitBy = new Map())).set(who, G.now); }
    return od.apply(this, arguments);
  };
  War.attackerOf = function (r) {
    if (!r.hitBy) return null; let best = null, bt = 0;
    for (const [e, t] of r.hitBy) { if (e.dead || e.removed || G.now - t > 7000 || !War.isFoe(r.faction, e) && !(e.type === 'mob')) { r.hitBy.delete(e); continue; } if (Math.hypot(e.x - r.x, e.y - r.y) > (e.siege ? 700 : 520)) continue; if (t > bt) { bt = t; best = e; } }
    return best;
  };
  War.kingOf = (f) => G.ents.find((e) => e.type === 'king' && e.faction === f && !e.dead && !e.removed);
  War.pickTarget = function (r) {
    const ef = r.squad ? r.squad.ef : War.enemyOf(r.faction);
    const k = War.kingOf(ef); if (k) return k;
    // the king has fallen: finish the defenders still standing nearby, then go home
    let best = null, bd = 900; for (const o of G.ents) { if (!War.isFoe(r.faction, o) || o.type === 'npc') continue; const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; best = o; } }
    return best;
  };
  War.assaultThink = function (r) {
    r.thinkT = (r.thinkT || 0) - 0.05; if (r.thinkT > 0 && r.want && !r.want.dead && !r.want.removed) { r.inCombat = true; return; }
    r.thinkT = 0.4;
    const att = War.attackerOf(r);
    const p = G.player; const pClose = p && War.isFoe(r.faction, p) && !p.dead && Math.hypot(p.x - r.x, p.y - r.y) < 70;
    let want = att || (pClose ? p : null) || War.pickTarget(r);
    if (!want) { r.warState = 'home'; r.hate.clear(); r.inCombat = false; r.want = null; return; }
    r.want = want; r.focus = want; r.hate.clear(); r.hate.set(want, 100); r.inCombat = true;
  };
  // column shape: single file up to 12 soldiers, two abreast up to 24, three abreast beyond
  War.formationTarget = function (r) {
    const sq = r.squad; if (!sq || !sq.path) return null;
    const live = sq.order.filter((m) => !m.dead && !m.removed && m.warState === 'march'); const k = Math.max(0, live.indexOf(r));
    const n = sq.order.length; const cols = n > 24 ? 3 : n > 12 ? 2 : 1;
    const row = Math.floor(k / cols), col = k % cols;
    const i = Math.max(0, Math.min(sq.path.length - 1, sq.hi - row)); const j = Math.min(sq.path.length - 1, i + 1);
    const [ax, ay] = sq.path[i], [bx, by] = sq.path[j]; let dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const side = cols === 1 ? 0 : (col - (cols - 1) / 2) * 20;
    let x = ax * TS + 16 - dy * side, y = ay * TS + 16 + dx * side;
    if (side && (W.solidAtPx(x, y) || W.buildingAt(x, y))) { x = ax * TS + 16; y = ay * TS + 16; }
    return { x, y };
  };
  // the archers' line forms behind whatever the melee soldiers are fighting (or the road to the king)
  const openSpot = (x, y) => {
    const ok = (px, py) => { const tx = Math.floor(px / TS), ty = Math.floor(py / TS); return !W.isBlockedTile(tx, ty) && !W.buildingAt(px, py); };
    if (ok(x, y)) return { x, y };
    for (let r = 1; r <= 4; r++) for (let a = 0; a < 8; a++) { const px = x + Math.cos(a * 0.785) * r * TS, py = y + Math.sin(a * 0.785) * r * TS; if (ok(px, py)) return { x: px, y: py }; }
    return null;
  };
  War.lineSlot = function (r) {
    const sq = r.squad; if (!sq) return null;
    const melee = sq.members.filter((m) => !m.dead && !m.ranged && m.warState === 'assault');
    const f = (melee[0] && melee[0].want) || sq.focus || r.want; if (!f) return null;
    const rangers = sq.members.filter((m) => !m.dead && m.ranged && m.warState === 'assault'); const i = rangers.indexOf(r); if (i < 0) return null;
    const c = melee.length ? melee.reduce((a, m) => ({ x: a.x + m.x / melee.length, y: a.y + m.y / melee.length }), { x: 0, y: 0 }) : r;
    let dx = f.x - c.x, dy = f.y - c.y; let L = Math.hypot(dx, dy); if (L < 40) { dx = sq.dir[0]; dy = sq.dir[1]; L = 1; } dx /= L; dy /= L;
    const back = 220, sp = 28, off = (i - (rangers.length - 1) / 2) * sp;
    const s = openSpot(f.x - dx * back - dy * off, f.y - dy * back + dx * off);
    return s;
  };

  // =====================================================================
  // v32: hotbar auto-fill, victory celebration, more status, easter eggs
  // =====================================================================
  // ---------- new abilities go on the hotbar the moment they unlock (until it is full) ----------
  Sys.autoBarSync = function () {
    const p = G.player; if (!p || !p.c) return; const c = p.c;
    const wants = [];
    const C = D.CLASSES[c.cls];
    for (const [id, lv] of C.skills) if (c.level >= lv && D.SKILLS[id] && !D.SKILLS[id].passive) wants.push({ k: 'skill', id });
    for (const id of c.spells || []) if (D.SPELLS[id]) wants.push({ k: 'spell', id });
    const wt = G.weaponType(c); const rt = G.rangedType && G.rangedType(c);
    for (const t of [wt, rt, c.equip.secondary && c.equip.secondary.shield ? 'SHIELD' : null]) { if (!t || !D.WEAPON_ABILITIES[t]) continue; D.WEAPON_ABILITIES[t].forEach((ab, i) => { if ((c.wskill[t] || 0) >= D.WEAPON_UNLOCKS[i]) wants.push({ k: 'weapon', id: t + ':' + i, wt: t }); }); }
    const first = !c.barSeen; c.barSeen = c.barSeen || {};
    for (const a of wants) {
      const key = a.k + ':' + a.id; if (c.barSeen[key]) continue; c.barSeen[key] = 1;
      if (first) continue; // abilities a hero already had before this update are left where the player put them
      const bar = Sys.bar(); if (bar.some((x) => x && x.k === a.k && x.id === a.id)) continue;
      if (bar.every((x) => x)) { if (!c.barFullNote) { c.barFullNote = 1; G.log('Your hotbar is full, so new abilities are no longer added to it. Drag them from Abilities (K) or the Spellbook (P).', 'sys', '#e8d48a'); } continue; }
      const i = bar.findIndex((x) => !x); bar[i] = { k: a.k, id: a.id };
      const def = G.actionDef(bar[i]); G.log(`${def ? def.name : 'New ability'} is on your hotbar (key ${(i + 1) % 10}).`, 'skill', '#ffd84a');
      KR.UI && KR.UI.renderBar && KR.UI.renderBar(); KR.UI && KR.UI.saveSoon && KR.UI.saveSoon();
    }
  };
  // the older one-off placement now defers to the sync above
  Sys.autoBar = function () { setTimeout(Sys.autoBarSync, 50); return Sys.bar().some((x) => !x); };

  // ---------- more ways to earn status for your kingdom ----------
  const oldLevelUp = Sys.levelUp;
  Sys.levelUp = function () { oldLevelUp.apply(this, arguments); const c = G.player && G.player.c; if (c) Sys.addStatus(c.faction, 2 + Math.floor(c.level / 3), `reaching level ${c.level}`); setTimeout(Sys.autoBarSync, 100); };
  const oldKill = G.kill;
  G.kill = function (e, src) {
    const wasDead = e && e.dead; const killer = src && src.owner ? src.owner : src; const p = G.player;
    oldKill.apply(this, arguments);
    if (wasDead || !e || !p) return;
    const mine = killer === p || (killer && killer.type === 'merc') || (src && src.type === 'pet' && src.owner === p);
    if (mine && e.faction && e.faction !== p.c.faction) {
      const n = e.rivalHero ? 25 : e.siege ? 12 : e.title === 'Royal Guard' || e.title === 'Royal Patrol' ? 8 : e.raider ? 2 : e.type === 'guard' ? 3 : 0;
      if (n) Sys.addStatus(p.c.faction, n, e.rivalHero ? `defeating ${e.name}, the rival hero` : e.siege ? `destroying the ${e.name}` : `defeating ${e.name}`);
    }
    // war parties earn status for their own kingdom when they wreck the enemy's defenses
    if (killer && killer.raider && e.siege) Sys.addStatus(killer.faction, 10, `our soldiers destroying the ${e.name}`);
    // defenders earn status when an attacking war party is wiped out near their kingdom
    if (e.raider && e.squad && !e.squad.defendPaid && e.squad.members.every((m) => m.dead)) { e.squad.defendPaid = true; const cd = W.cityData[e.squad.ef]; if (cd && Math.hypot(e.x / TS - cd.cx, e.y / TS - cd.cy) < cd.R + 30) Sys.addStatus(e.squad.ef, 20, 'driving off an enemy war party'); }
  };

  // ---------- extra dialog: donations to the crown, Vinny, Old Gil ----------
  const VINNY_DAY = 24 * 60000;
  const egg = () => { const c = G.player.c; c.eggs = c.eggs || {}; return c.eggs; };
  const vinnyPay = (c) => Math.round(200 + c.level * c.level * 22);
  KR.UI.extraButtons = function (e, add, w) {
    const p = G.player, c = p.c;
    if (e.type === 'king' && e.faction === c.faction) {
      const gifts = [[10000, 3], [100000, 25], [1000000, 200]];
      for (const [amt, st] of gifts) if (c.coins >= amt) add(`Donate ${G.fmtCoins(amt)} to the crown (+${st} status)`, () => { c.coins -= amt; Sys.addStatus(c.faction, st, 'your donation to the crown'); KR.A.sfx('coin'); G.say(e, U.pick(['The realm thanks you.', 'Your generosity will be remembered.', 'Every coin builds a stronger wall.']), 3); KR.UI.refresh(); KR.UI.open('npc'); });
    }
    if (e.vinny && !e.vinnyGone && !e.vanished && !e.dead && !e.executing) {
      const V = egg().vinny || (egg().vinny = { state: 'captive' });
      if (V.state === 'captive') add('🔓 Free Vinny', () => War.vinnyFree(e));
      if (V.state === 'freed') add('💰 Ask Vinny for money', () => War.vinnyAsk(e, w));
      add((V.pays || 0) >= 5 ? '🗡 Kill Vinny (finally)' : '🗡 Kill Vinny', () => War.vinnyKill(e));
    }
    if (e.oldGil) {
      add('Ask about the desert', () => { G.say(e, 'Strange marks in the sand, south-west of here. An X, if you squint. My grandpa swore there\'s gold under it. Never had the knees to dig.', 7); KR.UI.close('npc'); });
      if (!egg().gil) add('Ask for a souvenir', () => { egg().gil = 1; const it = G.makeTrophy('Lucky Fishhook', Math.max(10, c.level), 1); it.value = 50000; it.icon = '🪝'; it.lore = 'Old Gil swears it has caught a sea serpent. Twice.'; Sys.addItem(it); G.say(e, 'Here. My lucky hook. It never caught me a thing, maybe it\'ll do better for you.', 5); KR.A.sfx('quest', 0.5); KR.UI.close('npc'); });
    }
  };
  // ---------- Vinny: a prisoner in the sewers beneath your kingdom ----------
  const vinnyHome = () => 'sewer_' + G.player.c.faction;
  const VINNY_PLEA = {
    crown: ['*cough* ...is someone there? Please... please don\'t be Rattigan. I only owe him forty silver. Forty! Get me out of this cage, friend, I\'m begging you.',
      'P-please... I can\'t feel my legs anymore. The rats come at night. They\'re getting braver.',
      'You\'re not one of them, are you? Oh, thank the gods. Please. Please get me out. I\'ll do anything.',
      'I\'ve been in this cage so long I\'ve started naming the rats. That one\'s Gerald. Gerald bit me. Please let me out...'],
    sylvan: ['*cough* ...is someone there? Please... the orcs keep talking about a stew. I think I\'m the stew. Get me out of this cage, I\'m begging you.',
      'P-please... they poke me with sticks to see if I\'m fat enough yet. I\'m not! I\'m all bones! Please...',
      'You\'re not an orc. Oh, thank the gods, you\'re not an orc. Please get me out. I\'ll do anything.',
      'I\'ve been in this cage so long I\'ve started naming the rats. That one\'s Gerald. Gerald bit me. Please let me out...'],
  };
  const VINNY_PAY = [
    (a) => `You saved my life down there. Here, take this: ${a}. Don't spend it all at the tavern!`,
    (a) => `Back already? Ha! Of course you are. Here's ${a}, pal. My hero. My wonderful, money-loving hero.`,
    (a) => `${a}. There. Say, did I ever tell you about my bunions? No? Well, the left one is shaped like a duck...`,
    (a) => `Money, money, money. That's all I am to you, isn't it? A walking purse. I have FEELINGS, you know. ${a}. Take it.`,
    (a) => `Oh good, you're here! I wrote a song about you! "Ohhh the hero came, and took my gold, and took my gold, and took my gold..." There are forty more verses. Here's ${a}.`,
    (a) => `Take it. TAKE IT. ${a}. Also I told everyone at the tavern you cried in the sewer. You did. I heard you.`,
    (a) => `Hey! Hey. Hey. HEY. Did you know I can hold my breath for four minutes? Watch. ...Okay, three seconds. Here's ${a}. Hey. Hey.`,
    (a) => `I've been following you, by the way. Not in a creepy way. In a fan way. I watched you eat lunch. You chew with your mouth open. ${a}.`,
    (a) => `From now on I'm calling you Pally-Wally. Pally. Pal-o-mino. Pally-Wally! Here's ${a}, Pally-Wally.`,
    (a) => `*licks the coins before handing them over* There you go, ${a}, Pally-Wally. Same time tomorrow. And the day after. Forever. We're bonded now. Forever and ever and ever and ever.`,
  ];
  const VINNY_GREET = [
    (n) => `${n}! You came! I never forgot what you did down in those sewers. Thank you, really. Let me pay you back.`,
    () => 'Hey hey, it\'s my hero! Good to see you, pal.',
    () => 'Oh, it\'s you! Hey, smell my hand. No reason. Just smell it.',
    () => 'Back for more gold? You know, some heroes save people for FREE. Just saying.',
    () => '*singing* Ohhh the hero came... and took my gold... Hey! Want to hear the rest? It\'s forty verses.',
    () => 'PALLY! I\'ve been standing here ALL DAY waiting for you. I didn\'t even go to the privy. Well, I did, sort of. Right here.',
    () => 'Did you miss me? I missed you. I counted the cobblestones. There are four hundred and twelve. Wanna count them with me?',
    () => 'Pally-Wally! *hugs your leg and won\'t let go* I had a dream about you. You were a goose. A big, money-loving goose.',
  ];
  const VINNY_BARK = ['Hey! Hey, hero! Over here! ...Nothing. Just wanted to see if you\'d look.', 'Psst. PSST. PSSSSSST.', 'Ohhh the hero came, and took my gold, and took my gold...',
    'Did you know I\'m allergic to cheese? Now you do!', 'HEY PALLY-WALLY!', 'You walk funny. Nobody\'s told you? I\'m telling you.', 'I saved you a seat at the tavern! It\'s wet. Don\'t ask why.',
    'Remember the sewer? I remember the sewer. Every night. Thanks for that.', '*whistles the same three notes, badly, over and over and over*', 'Is that a new weapon? It\'s ugly. Can I hold it? No? Can I hold it now? Now?',
    'Where are we going? Are we going somewhere? Can I come? I\'m coming.', 'Pally! Pally! Pally! Pally! Pally!', 'Knock knock! ...You\'re supposed to say who\'s there. Knock knock! KNOCK KNOCK!'];
  War.vinnyFree = function (e) {
    const V = egg().vinny; V.state = 'freed'; V.freedAt = Date.now(); V.pays = 0;
    KR.UI.close('npc'); e.cageOpen = true; KR.A.sfx('open', 0.7);
    G.say(e, 'Y-you... you opened it! Thank you! THANK you! I\'ll find you in town, I swear on my mother!', 3.5);
    Sys.addStatus(G.player.c.faction, 15, 'freeing a prisoner'); KR.A.sfx('quest', 0.6);
    setTimeout(() => {
      if (e.removed) return;
      // gone in a puff of smoke, like a rogue slipping into the shadows
      for (let k = 0; k < 4; k++) G.fxAdd({ k: 'smoke', x: e.x + (k % 2 ? 10 : -10), y: e.y + (k > 1 ? 6 : -4), life: 1 + k * 0.15 });
      G.fxAdd({ k: 'ring', x: e.x, y: e.y - 10, r: 34, col: '#c8c8d0', life: 0.6 }); KR.A.sfx('stealth', 0.9);
      e.vanished = true; e.name = 'Empty cage'; e.title = ''; e.greetFn = () => 'The cage door hangs open. Vinny is long gone.'; e.vinnyGone = true;
      G.log('Vinny vanishes in a puff of smoke. He says he will wait for you in your kingdom.', 'quest', '#ffe08a'); Sys.save && Sys.save();
    }, 1600);
  };
  War.vinnyAsk = function (e, w) {
    const c = G.player.c, V = egg().vinny; const day = Math.floor(Date.now() / VINNY_DAY); V.pays = V.pays || 0;
    if (V.paidDay === day) { G.say(e, V.pays > 4 ? 'I JUST gave you money, you cheapo! Come back tomorrow! Pally-Wally the cheapo! Cheapo-Wally!' : 'I just gave you money, you cheapo! Come back tomorrow.', 5); KR.A.sfx('fail', 0.4); KR.UI.close('npc'); return; }
    V.paidDay = day; const amt = vinnyPay(c); c.coins += amt; KR.A.sfx('coin');
    G.say(e, VINNY_PAY[Math.min(V.pays, VINNY_PAY.length - 1)](G.fmtCoins(amt)), 9);
    V.pays++; V.thanked = true; G.log(`Vinny gives you ${G.fmtCoins(amt)}.`, 'loot', '#ffe08a'); KR.UI.refresh(); KR.UI.close('npc'); Sys.save && Sys.save();
  };
  War.vinnyKill = function (e) { KR.UI.close('npc'); War.vinnyExecute(e); };
  const vinnyLook = (e) => ({ race: 'human', gender: 'm', skin: KR.S.skinOf('human', 1), hair: KR.S.HAIRS[1], hairStyle: 2, armor: { kind: 'none', col: '#7a6a52', trim: '#4a3a28' }, beard: '#4a3a28' });
  // a big iron cage, drawn in two halves so Vinny sits between the bars
  function drawCage(g, x, y, open, half, k) { k = k || 1.5; g.save(); g.translate(x, y); g.scale(k, k); drawCage0(g, 0, 0, open, half); g.restore(); }
  function drawCage0(g, x, y, open, half) {
    const w = 30, top = y - 66, bot = y + 8;
    g.save(); g.lineCap = 'round';
    if (half === 'back') {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, bot, w + 4, 9, 0, 0, 6.28); g.fill();
      g.strokeStyle = '#3a3634'; g.lineWidth = 2.5; for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(x + k * 7, top + 6); g.lineTo(x + k * 7, bot - 6); g.stroke(); }
      g.strokeStyle = '#6a6a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, top); g.lineTo(x, top - 40); g.stroke();
      g.restore(); return;
    }
    g.strokeStyle = '#5a5450'; g.lineWidth = 4; g.strokeRect(x - w, top, w * 2, bot - top);
    g.strokeStyle = '#4a4440'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - w, top + 22); g.lineTo(x + w, top + 22); g.stroke();
    g.lineWidth = 3;
    for (let k = -4; k <= 4; k++) { const bx = x + k * 7; if (open && k >= -1 && k <= 1) continue; g.strokeStyle = k % 2 ? '#6a6460' : '#5a5450'; g.beginPath(); g.moveTo(bx, top); g.lineTo(bx, bot); g.stroke(); g.strokeStyle = 'rgba(160,90,40,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, top + 30 + (k * 13 % 17)); g.lineTo(bx, top + 38 + (k * 13 % 17)); g.stroke(); g.lineWidth = 3; }
    if (open) { g.strokeStyle = '#5a5450'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo(x - 10 - k * 6, top + 4); g.lineTo(x - 18 - k * 9, bot - 2); } g.stroke(); }
    else { g.fillStyle = '#8a7030'; g.fillRect(x + 10, y - 20, 8, 9); g.strokeStyle = '#8a7030'; g.lineWidth = 2; g.beginPath(); g.arc(x + 14, y - 20, 3, Math.PI, 0); g.stroke(); }
    g.restore();
  }
  War.spawnVinny = function () {
    const p = G.player; if (!p) return; const V = egg().vinny || (egg().vinny = { state: 'captive' });
    G.ents.filter((x) => x.vinny).forEach((x) => G.remove(x));
    let x, y, title, greet; const realm = W.realm || 'main';
    if (realm === vinnyHome() && W.dungeons && W.dungeons[realm] && W.dungeons[realm].cell) {
      const cell = W.dungeons[realm].cell; x = cell.x * TS + 16; y = cell.y * TS + 16; title = V.state === 'captive' ? 'Prisoner' : '';
      greet = () => U.pick(VINNY_PLEA[p.c.faction] || VINNY_PLEA.crown);
    } else if (V.state === 'freed' && realm === 'main') {
      const inn = W.buildings.find((b) => b.city === p.c.faction && b.type === 'inn'); if (!inn) return; x = inn.door.x + 40; y = inn.door.y + 40; title = 'Lucky to be alive';
      greet = () => { const day = Math.floor(Date.now() / VINNY_DAY), n = V.pays || 0; if (V.paidDay === day) return n > 4 ? 'Don\'t look at me like that. I already paid you today, Pally-Wally. Want to hear my song instead?' : 'Hey, it\'s my hero! Don\'t look at me like that, I already paid you today.'; return VINNY_GREET[Math.min(n, VINNY_GREET.length - 1)](p.c.name); };
    } else return;
    const inCage = realm !== 'main';
    const e = G.makeEnt({ type: 'npc', role: 'vinny', city: inCage ? null : p.c.faction, faction: inCage ? null : p.c.faction, name: inCage && V.state !== 'captive' ? 'Empty cage' : 'Vinny', title, x, y, homeX: x, homeY: y, level: 5, gender: 'm', race: 'human', hostile: false, services: [], seed: 0.3 });
    e.vinny = true; e.static = true; e.hpMax = e.hp = 200; e.look = vinnyLook(e); e.greetFn = greet; e.r = inCage ? 34 : e.r;
    if (inCage) {
      e.sit = true; e.cageOpen = V.state !== 'captive'; e.vinnyGone = V.state !== 'captive';
      if (e.vinnyGone) { e.greetFn = () => (V.state === 'dead' ? 'An empty cage. Something dark has dried on the floor.' : 'The cage door hangs open. Vinny is long gone.'); }
      e.customDraw = (g, e2, t) => {
        drawCage(g, e2.x, e2.y, e2.cageOpen, 'back');
        if (!e2.vinnyGone && !e2.vanished) { const sh = Math.sin(t * 23) * 0.7; KR.S.drawHumanoid(g, e2.x + sh, e2.y, Object.assign({}, e2.look, { sit: true, dir: 0, dead: e2.dead, deadDir: 1 }), t); if (!e2.dead && Math.sin(t * 1.7) > 0.2) { const ph = (t * 1.4) % 1; g.fillStyle = `rgba(140,190,255,${0.8 * (1 - ph)})`; g.beginPath(); g.ellipse(e2.x - 3 + sh, e2.y - 27 + ph * 12, 1.2, 2, 0, 0, 6.28); g.fill(); } }
        drawCage(g, e2.x, e2.y, e2.cageOpen, 'front');
      };
    }
    return e;
  };
  // Vinny's pleas from the cage, his chatter (and stalking) in town
  War.vinnyTick = function (dt) {
    const p = G.player; if (!p || p.dead) return; const V = egg().vinny; if (!V) return;
    const e = G.ents.find((x) => x.vinny && !x.removed && !x.dead && !x.vinnyGone && !x.vanished); if (!e || e.executing) return;
    const d = Math.hypot(p.x - e.x, p.y - e.y); e.barkT = (e.barkT || 0) - dt;
    if (V.state === 'captive') { if (d < 260 && e.barkT <= 0) { e.barkT = 14 + Math.random() * 8; G.say(e, U.pick(['H-hello? Is someone there? Please...', 'Over here... please... *cough*', 'Water... please, just a little water...', 'Don\'t leave me down here! Please! I can hear you walking!']), 4); } return; }
    if (V.state !== 'freed') return; const n = V.pays || 0;
    if (n >= 2 && d < 420 && e.barkT <= 0) { e.barkT = Math.max(5, 34 - n * 3.5) + Math.random() * 6; G.say(e, U.pick(VINNY_BARK.slice(0, Math.min(VINNY_BARK.length, 3 + n * 2))), 4); }
    // after enough handouts he starts following you around town
    const cd = W.cityData && W.cityData[p.c.faction]; const inTown = cd && (W.realm || 'main') === 'main' && Math.max(Math.abs(p.x / TS - cd.cx), Math.abs(p.y / TS - cd.cy)) <= cd.R + 2;
    let tx = e.homeX, ty = e.homeY; if (n >= 6 && inTown && d < 700) { tx = p.x - 40 * Math.sign(p.x - e.x || 1); ty = p.y + 12; }
    const dx = tx - e.x, dy = ty - e.y, dd = Math.hypot(dx, dy);
    if (dd > (tx === e.homeX && ty === e.homeY ? 4 : 30)) { const sp = Math.min(dd, (n >= 8 ? 120 : 95) * dt); G.moveEnt(e, dx / dd * sp, dy / dd * sp); e.moving = true; e.walk = (e.walk || 0) + dt * 11; if (Math.abs(dx) > Math.abs(dy)) { e.dir = dx < 0 ? 1 : 2; e.face = dx < 0 ? -1 : 1; } else e.dir = dy < 0 ? 3 : 0; }
    else { e.moving = false; if (d < 300) { e.dir = Math.abs(p.x - e.x) > Math.abs(p.y - e.y) ? (p.x < e.x ? 1 : 2) : (p.y < e.y ? 3 : 0); } }
  };
  // ---------- the execution: a short cinematic, letterboxed, slow and glorious ----------
  War.vinnyExecute = function (e) {
    const p = G.player, c = p.c, V = egg().vinny || (egg().vinny = {}); const wasState = V.state; const caged = (W.realm || 'main') !== 'main';
    V.state = 'dead'; e.executing = true; Sys.save && Sys.save();
    const wpn = c.equip && c.equip.primary; const wName = wpn ? wpn.name : 'bare hands';
    const annoying = wasState === 'freed' && (V.pays || 0) >= 3;
    const lines = annoying
      ? [[0.5, 'W-wait. Wait wait wait. Pally? Pally-Wally? What\'s that for?'], [2.0, 'No, please! I\'ll stop singing! I\'ll stop! I\'ll give you ALL the gold! PLEASE!'], [3.5, '*sob* ...it was a good song... not like this...']]
      : [[0.5, 'N-no... no, please... please, no...'], [2.0, 'Please! I\'ll give you everything I have! I\'ll be quiet, I swear!'], [3.5, '*sob* ...not like this... not like this...']];
    document.querySelectorAll('.exec-scene').forEach((x) => x.remove());
    const ov = document.createElement('div'); ov.className = 'exec-scene';
    ov.innerHTML = `<canvas></canvas><div class="ex-cap"><div class="ex-kicker">Mercy, of a kind</div><h1>Executed</h1><p>Vinny has been put out of his misery<br><span>with your ${esc(wName)}</span></p><button class="btn gold ex-go">Continue</button></div><button class="ex-skip">Skip ›</button>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas'), g = cv.getContext('2d'); const cap = ov.querySelector('.ex-cap');
    const heroLook = Object.assign({}, p.look, { dir: 2, moving: false, cast: false });
    const vLook = Object.assign({}, e.look || vinnyLook(e), { dir: 0 });
    const parts = []; const t0 = performance.now(); let alive = true, struck = false, said = -1;
    const wasInv = p.invuln; p.invuln = true; KR.A.sfx('wail', 0.25);
    const bubble = (x, y, text, sc) => { g.save(); g.font = `600 ${Math.round(15 * sc)}px "Alegreya Sans", sans-serif`; const words = text.split(' '); const ls = []; let cur = ''; const maxW = 230 * sc; for (const w2 of words) { const tt = cur ? cur + ' ' + w2 : w2; if (g.measureText(tt).width > maxW && cur) { ls.push(cur); cur = w2; } else cur = tt; } ls.push(cur); const lh = 19 * sc, bw = Math.max(...ls.map((l) => g.measureText(l).width)) + 22 * sc, bh = ls.length * lh + 14 * sc; const bx = Math.max(10, Math.min(cv.width - bw - 10, x - bw / 2)), by = Math.max(cv.height * 0.12 + 10, y - bh - 12 * sc); g.fillStyle = 'rgba(250,244,228,0.95)'; g.strokeStyle = 'rgba(40,30,20,0.9)'; g.lineWidth = 2; g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, bh, 8 * sc); else g.rect(bx, by, bw, bh); g.moveTo(x - 6 * sc, by + bh); g.lineTo(x + 2 * sc, Math.max(by + bh + 4, y)); g.lineTo(x + 8 * sc, by + bh); g.fill(); g.stroke(); g.fillStyle = '#2a1a10'; g.textAlign = 'center'; ls.forEach((l, i) => g.fillText(l, bx + bw / 2, by + 7 * sc + lh * (i + 0.8))); g.restore(); };
    const end = () => {
      if (!alive) return; alive = false; ov.classList.add('out'); setTimeout(() => ov.remove(), 500); KR.Main.setMusicOverride(null); p.invuln = wasInv;
      if (!e.removed) { e.dead = true; e.hp = 0; e.executing = false; e.cageOpen = true; e.bubble = null; e.name = 'Vinny'; e.title = ''; }
      G.log(`You put Vinny out of his misery with your ${wName}.`, 'combat', '#ffd84a');
      if (caged) setTimeout(() => { if (!e.removed) G.remove(e); War.spawnVinny(); }, 3500);
      else setTimeout(() => { if (KR.Kingdom && KR.Kingdom.cremate && !e.removed) KR.Kingdom.cremate(e); else if (!e.removed) G.remove(e); }, 1200);
    };
    ov.querySelector('.ex-go').onclick = end; ov.querySelector('.ex-skip').onclick = end;
    const frame = (now) => {
      if (!alive) return; const t = (now - t0) / 1000;
      const W2 = cv.width = innerWidth, H2 = cv.height = innerHeight; const S = Math.min(W2, H2 * 1.4) / 360;
      // camera: a slow push in, a hard punch at the strike, and shake
      const STRIKE = 4.7; const zoom = 1 + Math.min(t, STRIKE) * 0.07 + (t > STRIKE ? Math.max(0, 0.35 - (t - STRIKE) * 0.5) : 0);
      const shake = t > STRIKE && t < STRIKE + 0.6 ? (1 - (t - STRIKE) / 0.6) * 14 : 0;
      // background: sewer bricks or the town square at dusk
      const bg = g.createLinearGradient(0, 0, 0, H2); if (caged) { bg.addColorStop(0, '#0a0e0c'); bg.addColorStop(0.65, '#1e2a24'); bg.addColorStop(1, '#0c100e'); } else { bg.addColorStop(0, '#2a1830'); bg.addColorStop(0.6, '#6a3a2a'); bg.addColorStop(1, '#1a1210'); }
      g.fillStyle = bg; g.fillRect(0, 0, W2, H2);
      const GY = H2 * 0.6; g.save(); g.translate(W2 / 2 + (Math.random() - 0.5) * shake, GY + (Math.random() - 0.5) * shake); g.scale(S * zoom, S * zoom);
      if (caged) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.8; for (let r = 0; r < 9; r++) { const yy = -150 + r * 14; g.beginPath(); g.moveTo(-400, yy); g.lineTo(400, yy); g.stroke(); for (let k = -20; k < 20; k++) { const xx = k * 26 + (r % 2) * 13; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 14); g.stroke(); } } g.fillStyle = '#1a201c'; g.fillRect(-400, 2, 800, 200); g.fillStyle = `rgba(80,130,110,${0.35 + Math.sin(t * 2) * 0.08})`; g.fillRect(-400, 26, 800, 10); }
      else { g.fillStyle = '#3a3028'; g.fillRect(-400, 2, 800, 200); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8; for (let k = -20; k < 20; k++) { g.beginPath(); g.moveTo(k * 22, 2); g.lineTo(k * 22 - 30, 200); g.stroke(); } }
      // god rays after the strike
      if (t > STRIKE) { const a = Math.min(1, (t - STRIKE) * 1.5); g.save(); g.translate(-30, -40); g.rotate(t * 0.15); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 14; i++) { g.rotate(Math.PI * 2 / 14); g.fillStyle = `rgba(255,210,120,${(0.06 + 0.03 * Math.sin(t * 3 + i)) * a})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(500, -30); g.lineTo(500, 30); g.closePath(); g.fill(); } g.restore(); }
      // Vinny, kneeling and sobbing (in his cage, if he is still in it)
      const vx = 30, vDead = t > STRIKE + 0.15; const sob = vDead ? 0 : Math.sin(t * 26) * 0.8;
      if (caged) drawCage(g, vx, 0, t > 2.6, 'back', 1.25);
      g.save(); if (vDead) g.globalAlpha = Math.max(0.35, 1 - (t - STRIKE) * 0.3);
      try { KR.S.drawHumanoid(g, vx + sob, 0, Object.assign({}, vLook, { sit: !vDead, dead: vDead, deadDir: 1 }), t); } catch (er) {}
      g.restore();
      if (!vDead) for (let k = 0; k < 2; k++) { const ph = (t * 1.8 + k * 0.5) % 1; g.fillStyle = `rgba(140,190,255,${0.85 * (1 - ph)})`; g.beginPath(); g.ellipse(vx - 2.5 + k * 5 + sob, -27 + ph * 16, 0.9, 1.6, 0, 0, 6.28); g.fill(); }
      if (caged) drawCage(g, vx, 0, t > 2.6, 'front', 1.25);
      if (t > 2.6 && t < 2.75 && caged && !ov._clang) { ov._clang = 1; KR.A.sfx('block', 0.8); }
      // the hero walks up, raises the weapon high, and brings it down
      const hx = -60 + Math.min(1, t / 3.2) * 66; const walking = t < 3.2;
      let atk = 0; if (t > 3.6 && t < STRIKE) atk = Math.min(0.5, (t - 3.6) / 0.9 * 0.5); else if (t >= STRIKE && t < STRIKE + 0.18) atk = 0.5 + (t - STRIKE) / 0.18 * 0.5; else if (t >= STRIKE + 0.18 && t < STRIKE + 1.8) atk = 1; else if (t >= STRIKE + 1.8) atk = Math.min(0.5, (t - STRIKE - 1.8) * 1.2);
      if (t > 3.6 && !ov._raise) { ov._raise = 1; KR.A.sfx('warcry', 0.7); }
      if (atk > 0.3 && t < STRIKE) { g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(hx + 8, -44, 1, hx + 8, -44, 26); gl.addColorStop(0, `rgba(255,230,160,${0.5 * atk})`); gl.addColorStop(1, 'rgba(255,230,160,0)'); g.fillStyle = gl; g.fillRect(hx - 30, -80, 80, 80); g.restore(); }
      try { KR.S.drawHumanoid(g, hx, 0, Object.assign({}, heroLook, { moving: walking, walk: t * 9, atk }), t); } catch (er) {}
      // the strike: a white flash, a golden arc, sparks
      if (t >= STRIKE && !struck) { struck = true; KR.A.sfx('heavy', 1); KR.A.sfx('slash', 0.9); setTimeout(() => KR.A.sfx('rumble', 0.7), 120); setTimeout(() => KR.A.sfx('chime', 0.6), 700); KR.Main.setMusicOverride('victory'); if (KR.A.play) KR.A.play('victory');
        for (let i = 0; i < 70; i++) { const a = -Math.PI * 0.9 + Math.random() * Math.PI * 0.8, s = 40 + Math.random() * 160; parts.push({ x: vx - 4, y: -22, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8 + Math.random() * 0.9, t: 0, col: Math.random() < 0.5 ? '#ffe9a0' : '#ffffff' }); } }
      if (t >= STRIKE && t < STRIKE + 0.5) { const a = 1 - (t - STRIKE) / 0.5; g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,236,170,${a})`; g.lineWidth = 7 * a + 1; g.beginPath(); g.arc(hx + 10, -24, 40, -1.6, 0.9); g.stroke(); g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 2.5; g.beginPath(); g.arc(hx + 10, -24, 40, -1.4, 0.8); g.stroke(); g.restore(); }
      g.globalCompositeOperation = 'lighter'; for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t += 1 / 60; if (q.t > q.life) { parts.splice(i, 1); continue; } q.x += q.vx / 60; q.y += q.vy / 60; q.vy += 2; g.fillStyle = q.col; g.globalAlpha = 1 - q.t / q.life; g.fillRect(q.x, q.y, 1.6, 1.6); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      // what Vinny says, as the hero closes in
      let ln = null; if (!vDead) for (let i = 0; i < lines.length; i++) if (t >= lines[i][0]) { ln = lines[i]; if (said < i) { said = i; KR.A.sfx('wail', 0.18 + i * 0.05); } }
      g.restore();
      if (ln) bubble(W2 / 2 + (vx + 4) * S * zoom, GY - 62 * S * zoom, ln[1], Math.max(1, S / 3));
      if (t >= STRIKE && t < STRIKE + 0.35) { g.fillStyle = `rgba(255,255,255,${1 - (t - STRIKE) / 0.35})`; g.fillRect(0, 0, W2, H2); }
      // letterbox bars slide in and stay
      const bar = Math.min(1, t / 0.6) * H2 * 0.12; g.fillStyle = '#000'; g.fillRect(0, 0, W2, bar); g.fillRect(0, H2 - bar, W2, bar);
      if (t > STRIKE + 1.1 && !cap.classList.contains('in')) cap.classList.add('in');
      if (t > 16) { end(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  // buried treasure in the desert, marked with an X that only the curious notice
  War.spawnTreasure = function () {
    if (W.realm && W.realm !== 'main') return; G.ents.filter((x) => x.treasureX).forEach((x) => G.remove(x));
    const [dx, dy] = D.HUBS.docks.at; let tx = dx - 34, ty = dy + 16;
    for (let r = 0; r < 12; r++) { let ok = false; for (let a = 0; a < 8 && !ok; a++) { const x = Math.round(dx - 34 + Math.cos(a) * r), y = Math.round(dy + 16 + Math.sin(a) * r); if (W.tile(x, y) === KR.T.SAND && !W.isBlockedTile(x, y)) { tx = x; ty = y; ok = true; } } if (ok) break; }
    const dug = !!egg().treasure;
    const e = G.makeEnt({ type: 'npc', role: 'treasure', city: null, faction: null, name: dug ? 'A dug-up hole' : 'Strange markings', title: '', x: tx * TS + 16, y: ty * TS + 16, homeX: tx * TS + 16, homeY: ty * TS + 16, level: 1, hostile: false, services: [] });
    e.treasureX = true; e.static = true; e.invuln = true; e.look = null; e.r = 14; e.h = 20;
    e.customDraw = (g, e2) => { g.save(); if (egg().treasure) { g.fillStyle = 'rgba(80,55,25,0.75)'; g.beginPath(); g.ellipse(e2.x, e2.y, 16, 8, 0, 0, 6.28); g.fill(); } else { g.strokeStyle = 'rgba(150,40,30,0.75)'; g.lineWidth = 4; g.beginPath(); g.moveTo(e2.x - 10, e2.y - 7); g.lineTo(e2.x + 10, e2.y + 7); g.moveTo(e2.x + 10, e2.y - 7); g.lineTo(e2.x - 10, e2.y + 7); g.stroke(); } g.restore(); };
  };
  War.digTreasure = function (e) {
    const c = G.player.c; if (egg().treasure) { G.log('Just a hole in the sand now.', 'sys', '#cccccc'); return; }
    egg().treasure = 1; e.name = 'A dug-up hole';
    const coins = Math.round(5000 + c.level * c.level * 120); c.coins += coins;
    const u = U.pick(D.UNIQUE_WORN.filter((x) => x.lvl <= c.level + 6)) || D.UNIQUE_WORN[0]; Sys.addItem(G.makeUniqueWorn(u));
    Sys.addStatus(c.faction, 30, 'unearthing a lost treasure'); KR.A.sfx('quest', 0.8); KR.A.sfx('coin');
    G.fxAdd({ k: 'ring', x: e.x, y: e.y, r: 50, col: '#ffd84a', life: 1 });
    KR.UI.banner('Buried treasure!', `You dig up ${G.fmtCoins(coins)} and the ${u.name}.`); Sys.save && Sys.save();
  };
  // Old Gil fishes off the end of the Sunscour pier
  War.spawnGil = function () {
    if (W.realm && W.realm !== 'main') return; G.ents.filter((x) => x.oldGil).forEach((x) => G.remove(x));
    const [dx, dy] = D.HUBS.docks.at; const x = (dx + 9) * TS + 16, y = (dy - 1) * TS + 20;
    const e = G.makeEnt({ type: 'npc', role: 'fisher', city: null, faction: null, name: 'Old Gil', title: 'Fisherman', x, y, homeX: x, homeY: y, level: 30, gender: 'm', race: 'dwarf', hostile: false, services: [], seed: 0.5 });
    e.oldGil = true; e.static = true; e.invuln = true; e.sit = true;
    e.look = { race: 'dwarf', gender: 'm', skin: KR.S.skinOf('dwarf', 2), hair: '#d8d0c0', hairStyle: 1, beard: '#d8d0c0', armor: { kind: 'none', col: '#4a5a6a', trim: '#2a3a4a' }, hat: 'strawhat' };
    e.greetFn = () => U.pick(['Shh! You\'ll scare the fish.', 'Forty years on this pier and the big one still gets away.', 'Ever seen a sea serpent? I have. Twice. Nobody believes me.']);
  };
  War.spawnEggs = function () { try { War.spawnVinny(); War.spawnTreasure(); War.spawnGil(); } catch (e) { console.warn(e); } };
  const oldHubs = Sys.spawnHubs;
  Sys.spawnHubs = function () { const r = oldHubs.apply(this, arguments); setTimeout(War.spawnEggs, 100); return r; };

  // ---------- victory: a hero's moment ----------
  War.victory = function (k, killer) {
    const p = G.player, c = p.c, f = c.faction, ef = k.faction; const F = D.FACTIONS[f], E = D.FACTIONS[ef];
    c.victories = (c.victories || 0) + 1;
    const byYou = killer === p || (killer && killer.owner === p);
    for (const sq of War.squads.slice()) for (const m of sq.members.slice()) War.removeRaider(m);
    War.squads = [];
    // send the hero home: bind point and position in their own city
    const [hx, hy] = D.CITY_CENTER[f]; c.bind = { x: hx * TS + 16, y: (hy + 3) * TS + 16, realm: 'main' };
    G.log(`VICTORY! ${E.city} has fallen ${byYou ? 'by your hand' : 'to the armies of ' + F.city}. ${F.name} has won the war.`, 'status', '#ffd84a');
    KR.Main.setMusicOverride('victory'); if (KR.A.play) KR.A.play('victory');
    War.victoryScene(k, byYou);
  };
  War.victoryScene = function (k, byYou) {
    const p = G.player, c = p.c; const F = D.FACTIONS[c.faction], E = D.FACTIONS[k.faction];
    document.querySelectorAll('.win-modal, .vic-scene').forEach((x) => x.remove());
    const ord = (n) => n + (['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10] || 'th');
    const ov = document.createElement('div'); ov.className = 'vic-scene';
    const mins = Math.round((c.playTime || 0) / 60);
    ov.innerHTML = `<canvas class="vic-bg"></canvas><div class="vic-wrap"><div class="vic-hero"><canvas class="vic-cv" width="420" height="520"></canvas></div>
      <div class="vic-text"><div class="vic-kicker">The war is won</div><h1>Victory</h1>
      <h2>${esc(c.name)}, Conqueror of ${esc(E.city)}</h2>
      <p class="vic-lead">${esc(k.name)} has fallen${byYou ? ' by your hand' : ''}. The banners of ${esc(F.city)} fly over ${esc(E.city)}, and every bard in the realm is already singing your name.</p>
      <div class="vic-stats"><div><b>${c.level}</b><span>Level</span></div><div><b>${(c.kills || 0).toLocaleString()}</b><span>Foes slain</span></div><div><b>${mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm'}</b><span>Time at war</span></div><div><b>${c.victories}</b><span>${c.victories > 1 ? 'Victories' : 'Victory'}</span></div></div>
      <p class="vic-note">${c.victories > 1 ? `Your ${ord(c.victories)} conquest. ` : ''}You keep your hero, your gear and your coin. A new age now begins: both kingdoms rebuild from Kingdom Level 1, and the war starts again.</p>
      <button class="btn gold big vic-go">Begin the new age</button></div></div>`;
    document.body.appendChild(ov);
    const bg = ov.querySelector('.vic-bg'), cv = ov.querySelector('.vic-cv'); const g = cv.getContext('2d'), gb = bg.getContext('2d');
    const look = Object.assign({}, p.look, { dir: 0, moving: false, atk: 0, cast: false });
    const parts = []; let alive = true; const t0 = performance.now(); let nextBoom = 0;
    const cols = ['#ffd84a', '#ff7a4a', '#7ad8ff', '#c8a8ff', '#9affb8', '#ffffff', F.color || '#ffd84a'];
    const boom = (x, y) => { const col = U.pick(cols); for (let i = 0; i < 46; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 220; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.4 + Math.random() * 0.8, t: 0, col, r: 1.5 + Math.random() * 1.8 }); } try { KR.A.sfx('fire', 0.25); } catch (e) {} };
    const frame = (now) => {
      if (!alive) return; const t = (now - t0) / 1000;
      const W2 = bg.width = innerWidth, H2 = bg.height = innerHeight;
      const grd = gb.createRadialGradient(W2 * 0.3, H2 * 0.55, 20, W2 * 0.3, H2 * 0.55, Math.max(W2, H2)); grd.addColorStop(0, '#5a3a14'); grd.addColorStop(0.4, '#2a1a0c'); grd.addColorStop(1, '#0a0604'); gb.fillStyle = grd; gb.fillRect(0, 0, W2, H2);
      // god rays behind the hero
      gb.save(); gb.translate(W2 * 0.3, H2 * 0.55); gb.rotate(t * 0.08); gb.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) { gb.rotate(Math.PI * 2 / 18); gb.fillStyle = `rgba(255,210,120,${0.05 + 0.03 * Math.sin(t * 2 + i)})`; gb.beginPath(); gb.moveTo(0, 0); gb.lineTo(Math.max(W2, H2), -60); gb.lineTo(Math.max(W2, H2), 60); gb.closePath(); gb.fill(); }
      gb.restore();
      // fireworks and falling confetti
      if (t > nextBoom) { nextBoom = t + 0.5 + Math.random() * 0.9; boom(W2 * (0.1 + Math.random() * 0.8), H2 * (0.1 + Math.random() * 0.35)); }
      if (Math.random() < 0.6) parts.push({ x: Math.random() * W2, y: -10, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 60, life: 8, t: 0, col: U.pick(cols), r: 2.5, conf: true, rot: Math.random() * 6 });
      gb.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t += 1 / 60; if (q.t > q.life) { parts.splice(i, 1); continue; } q.x += q.vx / 60; q.y += q.vy / 60; if (!q.conf) { q.vy += 60 / 60; q.vx *= 0.985; } else q.rot += 0.1; const a = 1 - q.t / q.life; gb.fillStyle = q.col; gb.globalAlpha = Math.max(0, a); if (q.conf) { gb.save(); gb.translate(q.x, q.y); gb.rotate(q.rot); gb.fillRect(-3, -1.5, 6, 3); gb.restore(); } else { gb.beginPath(); gb.arc(q.x, q.y, q.r, 0, 6.28); gb.fill(); } }
      gb.globalAlpha = 1; gb.globalCompositeOperation = 'source-over';
      // the hero, huge, with a crown hovering above
      g.clearRect(0, 0, cv.width, cv.height);
      const halo = g.createRadialGradient(210, 250, 10, 210, 250, 220); halo.addColorStop(0, 'rgba(255,220,140,0.55)'); halo.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = halo; g.fillRect(0, 0, cv.width, cv.height);
      g.save(); g.translate(210, 450); g.scale(5.2, 5.2); try { KR.S.drawHumanoid(g, 0, 0, Object.assign({}, look, { walk: 0, atk: Math.max(0, Math.sin(t * 1.2)) * 0.25 }), t); } catch (e) {} g.restore();
      const cy = 70 + Math.sin(t * 2) * 6; g.font = '64px serif'; g.textAlign = 'center'; g.shadowColor = 'rgba(255,210,90,0.9)'; g.shadowBlur = 24; g.fillText('👑', 210, cy); g.shadowBlur = 0;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    ov.querySelector('.vic-go').onclick = () => {
      alive = false; ov.remove(); KR.Main.setMusicOverride(null);
      War.newAge();
      // the hero wakes in the heart of their own city
      const [hx, hy] = D.CITY_CENTER[c.faction]; p.x = hx * TS + 16; p.y = (hy + 3) * TS + 16; p.dead = false; p.hp = p.hpMax; c.bind = { x: p.x, y: p.y, realm: 'main' };
      KR.Main.snapCamera && KR.Main.snapCamera(); Sys.save && Sys.save(true);
    };
  };
  // if the hero falls during the celebration chaos, they still wake at home
  const oldRespawn = Sys.respawn;
  Sys.respawn = function () { const c = G.player.c; if (c.victories && (!c.bind || c.bind.realm && c.bind.realm !== 'main')) { const [hx, hy] = D.CITY_CENTER[c.faction]; c.bind = { x: hx * TS + 16, y: (hy + 3) * TS + 16, realm: 'main' }; } return oldRespawn.apply(this, arguments); };

  // keep the hotbar in sync a couple of times a second (cheap), and on entering the world
  let syncT = 0;
  const tick32 = War.tick;
  War.tick = function (dt) { tick32(dt); try { War.vinnyTick(dt); } catch (e) {} syncT += dt; if (syncT > 2) { syncT = 0; try { Sys.autoBarSync(); } catch (e) {} } };
})();
