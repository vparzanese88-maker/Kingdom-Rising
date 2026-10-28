// Kingdom Rising — the realm: the city is the kingdom (Age of Empires style)
// Wood and stone are gathered by the kingdom's Arborist and Miner, buildings rise on fixed plots, and everything is
// built and upgraded through the court. Gold (the hero's coins) hires recruits and upgrades the workers.
//
// ---------------- API (KR.Realm) ----------------
// State, one per faction, saved with the account (G.account.cities[f].realm):
//   Realm.state(f) -> { wood, stone, buildings: { townhall: 1, sawmill: 0..3, cutter: 0..3, barracks: 0/1, range: 0/1,
//     stable: 0/1, workshop: 0/1, walls: 0..2, towers: 0..4 }, construction: [{ id, lvl, start, end }], workers: {
//     arborist: { hired, lvl: 0..3, deadUntil }, miner: { ... } }, liaison: bool, walls, towers, army: {} (war.js) }
// Buildings and upgrades (each building's next level; walls and towers too):
//   Realm.DEFS[id] -> { name, max, cost: [{ wood, stone }...], time: [s...], needs(lvl) -> [[id, lvl]...], desc }
//   Realm.has(f, id, lvl = 1), Realm.level(f, id), Realm.cost(id, lvl), Realm.can(f, id) -> { ok, why, lvl, cost }
//   Realm.build(f, id, opt) (also upgrades: builds the next level; opt.free skips the cost) -> true/false
//   Realm.upgrade(f, id) (same as build), Realm.building(f, id) -> construction entry or null,
//   Realm.progress(f, id) -> 0..1 or null, Realm.plots(f) -> W.cityData[f].plots ({ id, x, y, w, h }),
//   Realm.plotOf(f, id)
// Resources: Realm.add(f, { wood, stone }, why), Realm.afford(f, cost), Realm.spend(f, cost), Realm.rates(f) -> per minute
// Court and workers:
//   Realm.hireLiaison(f), Realm.hireWorker(f, 'arborist' | 'miner'), Realm.upgradeWorker(f, kind, opt) (gold; opt.free),
//   Realm.workerCost(kind, lvl) (gold for the next yield upgrade), Realm.yieldOf(f, kind) (per load),
//   Realm.workers(f) -> worker entities. Worker entities: type 'npc', e.realmWorker = 'arborist' | 'miner',
//   e.look.weapon 'axe' | 'pick', e.carry = 'wood' | 'stone' | null while carrying a load home (for the 3D view),
//   e.wk.st = 'start' | 'go' | 'work' | 'back' | 'wait' | 'shelter', e.chopping while working.
//   Mill hands: static NPCs at the sawmill / stone cutter, e.millHand = 'sawmill' | 'cutter' (one per level).
//   The Court Liaison: an NPC in the Town Hall vestibule, e.liaison = true, services ['liaison'].
// Events: Realm.on(name, fn) / Realm.off(name, fn); 'resources' (f), 'built' (f, id, lvl), 'construct' (f, id, lvl),
//   'worker' (f, kind, what: 'hired' | 'died' | 'back' | 'upgraded' | 'delivered'), 'liaison' (f), 'level' (f, lvl).
// The old Kingdom Level (Sys.cityLevel, walls and city size) now follows the buildings: Realm.cityLevel(f).
(function () {
  const KR = window.KR;
  const D = KR.D, U = KR.U, G = KR.G, W = KR.W, Sys = KR.Sys;
  const TS = D.TS;
  const R = (KR.Realm = {});

  // ---------------- buildings ----------------
  const c2 = (wood, stone) => ({ wood, stone });
  R.DEFS = {
    townhall: { name: 'Town Hall', max: 1, cost: [c2(0, 0)], time: [0], needs: () => [], desc: 'The king\'s seat. The court works from here.' },
    sawmill: { name: 'Sawmill', max: 3, cost: [c2(100, 40), c2(260, 140), c2(600, 360)], time: [60, 120, 180], needs: () => [],
      desc: 'Saws the arborist\'s logs. Every level adds a mill hand and 10% more wood per load.' },
    cutter: { name: 'Stone Cutter', max: 3, cost: [c2(60, 80), c2(200, 240), c2(480, 560)], time: [60, 120, 180], needs: () => [],
      desc: 'Dresses the miner\'s stone. Every level adds a mason and 10% more stone per load.' },
    barracks: { name: 'Barracks', max: 1, cost: [c2(300, 250)], time: [150], needs: () => [['sawmill', 1], ['cutter', 1]],
      desc: 'The Recruiter trains guards and raiders.' },
    range: { name: 'Archery Range', max: 1, cost: [c2(450, 250)], time: [180], needs: () => [['barracks', 1]], desc: 'Archers, and the archer towers on the walls.' },
    stable: { name: 'Stable', max: 1, cost: [c2(550, 400)], time: [210], needs: () => [['range', 1]], desc: 'Cavalry.' },
    workshop: { name: 'Siege Workshop', max: 1, cost: [c2(700, 650)], time: [240], needs: () => [['stable', 1]], desc: 'The battering ram, catapults and trebuchets.' },
    walls: { name: 'Walls', max: 2, cost: [c2(200, 600), c2(300, 900)], time: [180, 300], needs: (lv) => [['cutter', lv + 1]],
      levels: ['Wooden palisade', 'Stone walls', 'Fortified gates'], desc: 'From a wooden palisade to stone walls, then fortified gates.' },
    towers: { name: 'Archer Towers', max: 4, cost: [c2(120, 180), c2(140, 220), c2(160, 260), c2(180, 300)], time: [90, 90, 90, 90], needs: () => [['range', 1]],
      desc: 'Each one adds an archer tower to the walls.' },
  };
  R.ORDER = ['sawmill', 'cutter', 'barracks', 'range', 'stable', 'workshop'];
  R.WORKER = {
    arborist: { name: 'Arborist', res: 'wood', tool: 'axe', base: 12, mill: 'sawmill', icon: '🪵' },
    miner: { name: 'Miner', res: 'stone', tool: 'pick', base: 10, mill: 'cutter', icon: '🪨' },
  };
  R.YIELD_UP = [0, 0.25, 0.5, 1]; // +25 / +50 / +100% per load
  R.WORKER_GOLD = [2000, 8000, 25000]; // copper: 20s, 80s, 2g 50s
  R.RESPAWN_MS = 60000;
  R.START = c2(50, 50); // the king's own stores

  // ---------------- state ----------------
  const fresh = () => ({ v: 1, wood: R.START.wood, stone: R.START.stone, buildings: { townhall: 1, sawmill: 0, cutter: 0, barracks: 0, range: 0, stable: 0, workshop: 0, walls: 0, towers: 0 },
    construction: [], workers: { arborist: { hired: false, lvl: 0, deadUntil: 0 }, miner: { hired: false, lvl: 0, deadUntil: 0 } }, liaison: false, walls: 0, towers: 0, army: {}, log: [], earned: { wood: 0, stone: 0 } });
  // an older kingdom converts: its Kingdom Level becomes buildings already standing and some wood and stone
  function convert(st, lvl) {
    const b = st.buildings;
    if (lvl >= 2) { b.sawmill = 1; b.cutter = 1; }
    if (lvl >= 3) b.barracks = 1;
    if (lvl >= 4) b.range = 1;
    if (lvl >= 5) b.stable = 1;
    st.wood += 100 * lvl; st.stone += 100 * lvl;
    if (lvl >= 2) { st.liaison = true; st.workers.arborist.hired = true; st.workers.miner.hired = true; }
    st.converted = lvl;
  }
  R.state = function (f) {
    const a = G.account; if (!a || !a.cities || !a.cities[f]) return null;
    const ct = a.cities[f];
    if (!ct.realm || typeof ct.realm !== 'object') { ct.realm = fresh(); if ((ct.level || 1) > 1) convert(ct.realm, ct.level); }
    const st = ct.realm; const d = fresh();
    for (const k in d) if (st[k] == null) st[k] = d[k];
    for (const k in d.buildings) if (st.buildings[k] == null) st.buildings[k] = d.buildings[k];
    for (const k in d.workers) if (!st.workers[k]) st.workers[k] = d.workers[k];
    st.walls = st.buildings.walls; st.towers = st.buildings.towers;
    return st;
  };
  // the online host's snapshot carries each realm; a guest keeps only clean numbers from it
  R.sanitize = function (s) {
    const d = fresh(); if (!s || typeof s !== 'object') return d;
    const num = (v, lo, hi, def) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
    d.wood = num(s.wood, 0, 1e9, d.wood); d.stone = num(s.stone, 0, 1e9, d.stone); d.liaison = !!s.liaison;
    for (const k in d.buildings) d.buildings[k] = Math.round(num(s.buildings && s.buildings[k], 0, (R.DEFS[k] || { max: 1 }).max, d.buildings[k]));
    d.buildings.townhall = 1;
    for (const k in d.workers) { const w = s.workers && s.workers[k]; if (w) d.workers[k] = { hired: !!w.hired, lvl: Math.round(num(w.lvl, 0, 3, 0)), deadUntil: num(w.deadUntil, 0, 1e15, 0) }; }
    d.construction = Array.isArray(s.construction) ? s.construction.filter((c) => c && R.DEFS[c.id]).slice(0, 12).map((c) => ({ id: c.id, lvl: Math.round(num(c.lvl, 1, 4, 1)), start: num(c.start, 0, 1e15, 0), end: num(c.end, 0, 1e15, 0) })) : [];
    d.army = s.army && typeof s.army === 'object' ? JSON.parse(JSON.stringify(s.army)) : {};
    d.walls = d.buildings.walls; d.towers = d.buildings.towers;
    return d;
  };
  R.snapshot = (f) => { const st = R.state(f); return st && { wood: Math.floor(st.wood), stone: Math.floor(st.stone), buildings: st.buildings, construction: st.construction, workers: st.workers, liaison: st.liaison, army: st.army }; };

  // ---------------- events ----------------
  const subs = {};
  R.on = (n, fn) => { (subs[n] = subs[n] || []).push(fn); };
  R.off = (n, fn) => { if (subs[n]) subs[n] = subs[n].filter((x) => x !== fn); };
  R.emit = (n, ...a) => { for (const fn of subs[n] || []) { try { fn(...a); } catch (e) { console.warn('realm event', n, e); } } };

  // ---------------- queries ----------------
  R.level = (f, id) => { const st = R.state(f); return st ? st.buildings[id] || 0 : 0; };
  R.has = (f, id, lvl = 1) => R.level(f, id) >= lvl;
  R.cost = (id, lvl) => { const d = R.DEFS[id]; return d && d.cost[Math.max(0, Math.min(d.cost.length - 1, lvl - 1))]; };
  R.building = (f, id) => { const st = R.state(f); return (st && st.construction.find((c) => c.id === id)) || null; };
  R.progress = (f, id) => { const c = R.building(f, id); if (!c) return null; return Math.max(0, Math.min(1, (Date.now() - c.start) / Math.max(1, c.end - c.start))); };
  R.plots = (f) => (W.cityData && W.cityData[f] && W.cityData[f].plots) || [];
  R.plotOf = (f, id) => R.plots(f).find((p) => p.id === id || p.building === id) || null;
  R.afford = (f, cost) => { const st = R.state(f); return !!st && st.wood >= (cost.wood || 0) && st.stone >= (cost.stone || 0); };
  R.can = function (f, id) {
    const st = R.state(f), d = R.DEFS[id]; if (!st || !d) return { ok: false, why: 'Unknown building.' };
    const cur = st.buildings[id] || 0, lvl = cur + 1;
    if (cur >= d.max) return { ok: false, why: id === 'towers' ? 'Every tower post is manned.' : 'Fully built.', lvl: cur, max: true };
    if (R.building(f, id)) return { ok: false, why: 'Under construction.', lvl, building: true };
    const cost = R.cost(id, lvl);
    for (const [nid, nl] of d.needs(cur)) if ((st.buildings[nid] || 0) < nl) return { ok: false, why: `Needs ${R.DEFS[nid].name}${R.DEFS[nid].max > 1 ? ' level ' + nl : ''}.`, lvl, cost, locked: true };
    if (!R.afford(f, cost)) return { ok: false, why: `Needs ${cost.wood} wood and ${cost.stone} stone.`, lvl, cost, poor: true };
    return { ok: true, lvl, cost };
  };
  R.levelName = (id, lvl) => { const d = R.DEFS[id]; if (d.levels) return d.levels[lvl] || d.name; return d.max > 1 && id !== 'towers' ? `${d.name} (level ${lvl})` : d.name; };

  // ---------------- resources ----------------
  R.add = function (f, amt, why) {
    const st = R.state(f); if (!st) return;
    for (const k of ['wood', 'stone']) if (amt[k]) { st[k] = Math.max(0, st[k] + amt[k]); if (amt[k] > 0 && R.WORKER[why]) { st.earned[k] = (st.earned[k] || 0) + amt[k]; rateLog(f, k, amt[k]); } }
    R.emit('resources', f, amt, why);
  };
  R.spend = function (f, cost) { if (!R.afford(f, cost)) return false; R.add(f, { wood: -(cost.wood || 0), stone: -(cost.stone || 0) }, 'spent'); return true; };
  // a rolling five-minute record of what came in, for the "per minute" rates
  const rl = {};
  function rateLog(f, k, n) { const L = (rl[f] = rl[f] || []); L.push([Date.now(), k, n]); while (L.length && Date.now() - L[0][0] > 300000) L.shift(); }
  R.rates = function (f) {
    const L = rl[f] || []; const now = Date.now(); const out = { wood: 0, stone: 0 };
    const mins = Math.max(1, Math.min(5, (now - (L[0] ? L[0][0] : now)) / 60000));
    for (const [t, k, n] of L) if (now - t <= 300000) out[k] += n;
    for (const k of ['arborist', 'miner']) {
      const res = R.WORKER[k].res;
      // nothing delivered yet: what the worker on the job should bring in
      out[res] = out[res] ? out[res] / mins : R.workerOn(f, k) ? R.yieldOf(f, k) * 60000 / EST_TRIP : 0;
    }
    return { wood: Math.round(out.wood), stone: Math.round(out.stone) };
  };

  // ---------------- building ----------------
  R.build = function (f, id, opt = {}) {
    const st = R.state(f), d = R.DEFS[id]; if (!st || !d) return false;
    const ok = R.can(f, id);
    if (!ok.ok && !(opt.free && !ok.max && !ok.building && !ok.locked)) { if (f === myF() && !opt.quiet) { G.log(ok.why, 'sys', '#ffb24a'); KR.A && KR.A.sfx('fail', 0.5); } return false; }
    const lvl = ok.lvl; const cost = R.cost(id, lvl);
    if (!opt.free) R.spend(f, cost);
    const dur = (opt.instant ? 0 : (d.time[lvl - 1] || 60)) * 1000 * (opt.timeMul || 1);
    const now = Date.now(); st.construction.push({ id, lvl, start: now, end: now + dur });
    if (f === myF() && !opt.quiet) { G.log(`Construction begins: ${R.levelName(id, lvl)}.`, 'status', '#f0d48a'); KR.A && KR.A.sfx('anvil', 0.4); }
    R.emit('construct', f, id, lvl); R.emit('resources', f);
    if (!dur) finish(f);
    save();
    return true;
  };
  R.upgrade = (f, id, opt) => R.build(f, id, opt);
  function finish(f) {
    const st = R.state(f); if (!st || !st.construction.length) return;
    const now = Date.now(); const done = st.construction.filter((c) => c.end <= now);
    if (!done.length) return;
    st.construction = st.construction.filter((c) => c.end > now);
    for (const c of done) {
      st.buildings[c.id] = Math.max(st.buildings[c.id] || 0, c.lvl); st.walls = st.buildings.walls; st.towers = st.buildings.towers;
      if (f === myF()) { G.log(`${R.levelName(c.id, c.lvl)} is finished!`, 'status', '#ffd84a'); KR.UI && KR.UI.banner && KR.UI.banner(`${R.levelName(c.id, c.lvl)} is finished`, R.DEFS[c.id].desc); KR.A && KR.A.sfx('levelup', 0.45); }
      R.emit('built', f, c.id, c.lvl);
      if (c.id === 'sawmill' || c.id === 'cutter') respawnHands(f);
    }
    syncLevel(f); save();
  }

  // ---------------- the old Kingdom Level follows the buildings ----------------
  R.cityLevel = function (f) {
    const b = (R.state(f) || {}).buildings || {};
    return Math.min(5, 1 + (b.sawmill >= 1 && b.cutter >= 1 ? 1 : 0) + (b.barracks ? 1 : 0) + (b.range ? 1 : 0) + (b.stable ? 1 : 0));
  };
  function syncLevel(f) {
    const ct = G.account && G.account.cities[f]; if (!ct) return;
    const want = R.cityLevel(f); if (ct.level === want) return;
    const up = want > ct.level; ct.level = want;
    Sys.cityChanged(f, up); R.emit('level', f, want);
  }
  // a quieter city change: the walls and streets are rebuilt, nobody is left in a wall; no "Kingdom Level" fanfare
  Sys.cityChanged = function (f) {
    const lvl = G.account.cities[f].level;
    if (W.realm === 'main' || !W.realm) { W.stampCity(f, lvl); Sys.spawnCity(f); }
    const p = G.player;
    if (p && (!W.realm || W.realm === 'main') && W.isBlockedTile(Math.floor(p.x / TS), Math.floor(p.y / TS))) { const [cx, cy] = D.CITY_CENTER[p.c.faction]; p.x = cx * TS + 16; p.y = (cy + 3) * TS + 16; KR.Main && KR.Main.snapCamera && KR.Main.snapCamera(); }
    if (p && f === p.c.faction && (!W.realm || W.realm === 'main') && p.c.bind && W.isBlockedTile(Math.floor(p.c.bind.x / TS), Math.floor(p.c.bind.y / TS))) { const [cx, cy] = D.CITY_CENTER[f]; p.c.bind = { x: cx * TS + 16, y: (cy + 3) * TS + 16, realm: 'main' }; }
    KR.UI && KR.UI.refresh && KR.UI.refresh();
    Sys.save();
  };
  // status still counts (the court likes heroes) but it no longer raises the kingdom: buildings do
  Sys.addStatus = function (f, n, why) {
    const city = G.account && G.account.cities[f]; if (!city) return;
    city.status = (city.status || 0) + n;
    if (G.player && G.player.c.faction === f && n > 0) G.log(`+${n} renown for ${D.FACTIONS[f].city}${why ? ' for ' + why : ''}.`, 'status', '#f0c75e');
    KR.UI && KR.UI.refresh && KR.UI.refresh();
  };
  // the King's Works (timber and stone carried to the king for each Kingdom Level) are gone: the workers gather now
  if (KR.Kingdom) { KR.Kingdom.needFor = () => null; KR.Kingdom.checkRise = () => {}; }

  // ---------------- the court: the liaison and the workers ----------------
  const myF = () => (G.player && G.player.c ? G.player.c.faction : null);
  function save() { try { Sys.saveAccount && Sys.saveAccount(); } catch (e) {} }
  R.hireLiaison = function (f) {
    const st = R.state(f); if (!st || st.liaison) return false;
    st.liaison = true; R.emit('liaison', f); save();
    if (f === myF()) { G.log('The Court Liaison is at your service. Open the kingdom with N, or the crown button.', 'status', '#ffd84a'); KR.A && KR.A.sfx('quest', 0.6); }
    return true;
  };
  R.workerOn = (f, kind) => { const st = R.state(f); const w = st && st.workers[kind]; return !!(w && w.hired && !(w.deadUntil > Date.now())); };
  R.hireWorker = function (f, kind) {
    const st = R.state(f); const w = st && st.workers[kind]; if (!w || w.hired) return false;
    w.hired = true; w.deadUntil = 0; R.emit('worker', f, kind, 'hired'); save();
    if (f === myF()) { G.log(`The ${R.WORKER[kind].name} is hired and heads out of town to gather ${R.WORKER[kind].res}.`, 'status', '#ffd84a'); KR.A && KR.A.sfx('coin', 0.5); }
    spawnWorker(f, kind);
    return true;
  };
  R.workerCost = (kind, lvl) => R.WORKER_GOLD[Math.max(0, lvl - 1)] || null;
  R.upgradeWorker = function (f, kind, opt = {}) {
    const st = R.state(f); const w = st && st.workers[kind]; if (!w) return false;
    if (w.lvl >= 3) return false;
    const cost = R.workerCost(kind, w.lvl + 1);
    if (!opt.free) {
      const c = G.player && G.player.c; if (!c || f !== c.faction) return false;
      if (c.coins < cost) { G.log(`You need ${G.fmtCoins(cost)}.`, 'sys', '#ffb24a'); KR.A && KR.A.sfx('fail', 0.5); return false; }
      c.coins -= cost; KR.A && KR.A.sfx('coin', 0.6);
    }
    w.lvl++; R.emit('worker', f, kind, 'upgraded'); save(); Sys.save && Sys.save();
    if (f === myF()) G.log(`The ${R.WORKER[kind].name} brings ${Math.round(R.YIELD_UP[w.lvl] * 100)}% more ${R.WORKER[kind].res} per load.`, 'status', '#ffd84a');
    return true;
  };
  R.yieldOf = function (f, kind) {
    const st = R.state(f); const w = st && st.workers[kind]; if (!w) return 0; const W2 = R.WORKER[kind];
    return Math.round(W2.base * (1 + R.YIELD_UP[w.lvl || 0]) * (1 + 0.1 * (st.buildings[W2.mill] || 0)));
  };
  R.workers = (f) => G.ents.filter((e) => e.realmWorker && e.city === f && !e.removed);

  // ---------------- people ----------------
  const NAMES = { arborist: ['Hal Ashgrove', 'Brin Oakhand', 'Tamsin Fell'], miner: ['Dunstan Flint', 'Mags Quarry', 'Odo Cobb'], liaison: ['Lady Merriel Ashby', 'Lord Cassius Wren'] };
  function mkPerson(f, role, x, y, o = {}) {
    const n = (f.length * 7 + role.length) % 3;
    const gender = o.gender || (n % 2 ? 'f' : 'm');
    const e = G.makeEnt(Object.assign({ type: 'npc', role, city: f, faction: f, name: o.name, title: o.title, x, y, homeX: x, homeY: y, level: 20, gender, race: 'human',
      skin: KR.S.skinOf('human', (n + role.length) % 4), hair: KR.S.HAIRS[(n * 3 + role.length) % 7], hairStyle: (n + 1) % 4, speed: o.speed || 92, services: o.services || [], hostile: false, seed: 0.3 }, o.extra || {}));
    e.hpMax = e.hp = 500;
    const F = D.FACTIONS[f];
    e.look = Object.assign({ race: e.race, gender: e.gender, skin: e.skin, hair: e.hair, hairStyle: e.hairStyle }, o.look || {});
    if (!e.look.armor) e.look.armor = { kind: 'none', col: (F && F.color) || '#6a5a4a', trim: '#3a2a1a' };
    return e;
  }
  const hallOf = (f) => W.buildings.find((b) => b.city === f && b.type === 'hall' && b.terr) || W.buildings.find((b) => b.city === f && b.type === 'hall');
  // where loads are left: the sawmill or stone cutter once built, else the Town Hall gate
  function dropOf(f, kind) {
    const mill = R.WORKER[kind].mill; const pl = R.has(f, mill) && R.plotOf(f, mill);
    if (pl) return [pl.x + Math.floor(pl.w / 2), pl.y + pl.h];
    const h = hallOf(f);
    if (h && h.gate) return [Math.floor((h.gate.x0 + h.gate.x1) / 2), h.gate.ty + 1];
    if (h && h.door) return [h.door.tx, h.door.ty + 1];
    const [cx, cy] = D.CITY_CENTER[f]; return [cx, cy + 3];
  }
  function spawnWorker(f, kind) {
    if (W.realm && W.realm !== 'main') return null;
    if (R.workers(f).some((e) => e.realmWorker === kind)) return null;
    const st = R.state(f); const w = st.workers[kind];
    const [tx, ty] = dropOf(f, kind);
    const W2 = R.WORKER[kind];
    const e = mkPerson(f, kind, tx * TS + 16, ty * TS + 16, { name: NAMES[kind][f.length % 3], title: W2.name, speed: 96, extra: { realmWorker: kind, mute: true },
      look: kind === 'arborist' ? { armor: { kind: 'leather', col: '#5a6a3a', trim: '#3a2a1a' }, weapon: 'axe', hat: null } : { armor: { kind: 'leather', col: '#6a5a4a', trim: '#2a2218' }, weapon: 'pick', hat: null } });
    e.wk = { st: 'start', t: 0.5 + Math.random() };
    if (w.deadUntil > Date.now()) { e.dead = true; e.respawnAt = G.now + (w.deadUntil - Date.now()); }
    return e;
  }
  function spawnLiaison(f) {
    if (W.realm && W.realm !== 'main') return;
    if (G.ents.some((e) => e.liaison && e.city === f && !e.removed)) return;
    const h = hallOf(f); let x, y;
    if (h && h.terr) {
      // the vestibule inside the Town Hall gate: its east corner, just inside the door
      const T3 = h.terr; x = (T3.x0 + T3.w - 1) * TS + 16; y = (T3.y0 + T3.h - 2) * TS + 16;
    } else { const [tx, ty] = dropOf(f, 'arborist'); x = (tx + 2) * TS + 16; y = (ty - 1) * TS + 16; }
    const F = D.FACTIONS[f];
    const e = mkPerson(f, 'liaison', x, y, { name: NAMES.liaison[f.length % 2], title: 'Court Liaison', gender: f.length % 2 ? 'f' : 'm', services: ['liaison'],
      extra: { liaison: true, static: true }, look: { armor: { kind: 'cloth', col: (F && F.color) || '#3a4a7a', trim: '#e0c060' }, robe: true, hat: null } });
    e.greetFn = () => {
      const st = R.state(f); const pf = myF();
      if (pf !== f) return `The court of ${F.city} has no business with you.`;
      if (!st.liaison) return `The king has already paid my fee, so my service costs you nothing. Take me on and I will run the court for you: the stores, the builders, the workers, the army. You can reach me wherever you roam.`;
      if (!st.workers.arborist.hired || !st.workers.miner.hired) return `The Arborist and the Miner are waiting on your word, and their wages are paid too. Wood and stone are what this kingdom is built from.`;
      return `${Math.floor(st.wood)} wood and ${Math.floor(st.stone)} stone in the stores. What shall we build?`;
    };
  }
  // the mill hands: one at the sawmill or stone cutter for each level it has
  function respawnHands(f) {
    if (W.realm && W.realm !== 'main') return;
    G.ents.filter((e) => e.millHand && e.city === f).forEach((e) => G.remove(e));
    for (const mill of ['sawmill', 'cutter']) {
      const lv = R.level(f, mill), pl = R.plotOf(f, mill); if (!lv || !pl) continue;
      const spots = [[pl.x + 1, pl.y + pl.h], [pl.x + pl.w - 2, pl.y + pl.h], [pl.x + Math.floor(pl.w / 2), pl.y + pl.h + 1]];
      for (let i = 0; i < Math.min(lv, 3); i++) {
        const [tx, ty] = spots[i];
        const e = mkPerson(f, mill === 'sawmill' ? 'sawyer' : 'mason', tx * TS + 16, ty * TS + 16, { name: (mill === 'sawmill' ? ['Ivo', 'Ren', 'Gil'] : ['Bram', 'Tessa', 'Hob'])[i] + (mill === 'sawmill' ? ' the Sawyer' : ' the Mason'),
          title: mill === 'sawmill' ? 'Sawyer' : 'Mason', extra: { millHand: mill, static: true, work: true, mute: true },
          look: mill === 'sawmill' ? { armor: { kind: 'leather', col: '#7a5a3a', trim: '#3a2a1a' }, weapon: 'axe' } : { armor: { kind: 'leather', col: '#7a7468', trim: '#3a3428' }, weapon: '1HB' } });
        e.dir = 0;
      }
    }
  }
  // the realm's people come with the city: after the townsfolk, guards and king
  const spawnCity0 = Sys.spawnCity;
  Sys.spawnCity = function (f) {
    const r = spawnCity0.apply(this, arguments);
    try {
      if (!W.realm || W.realm === 'main') {
        G.ents.filter((e) => (e.realmWorker || e.liaison || e.millHand) && e.city === f).forEach((e) => G.remove(e));
        const st = R.state(f); if (st) {
          spawnLiaison(f);
          for (const k of ['arborist', 'miner']) if (st.workers[k].hired) spawnWorker(f, k);
          respawnHands(f);
        }
      }
    } catch (e) { console.warn('realm spawn', e); }
    return r;
  };

  // ---------------- the workers at work ----------------
  const EST_TRIP = 40000; // ms: a load out and back (for the stores' rate before anything comes in, and while away)
  const reserved = new Set();
  function outside(f, tx, ty) {
    if (KR.War && KR.War.insideWalls) return !KR.War.insideWalls(f, tx * TS + 16, ty * TS + 16);
    const cd = W.cityData[f]; return !cd || Math.max(Math.abs(tx - cd.cx), Math.abs(ty - cd.cy)) > (cd.R || 20) + 1;
  }
  const cands = {};
  function candidates(f, kind) {
    const key = f + kind; const K = KR.Kingdom; const tool = R.WORKER[kind].tool;
    const c = cands[key]; if (c && c.decor === W.decor && c.n === W.decor.length) return c.list;
    const [dx, dy] = dropOf(f, kind); const list = [];
    if (K && K.harvestOf) for (const d of W.decor) {
      const h = K.harvestOf(d); if (!h || h.tool !== tool) continue;
      const dist = Math.hypot(d.tx - dx, d.ty - dy); if (dist > 110) continue;
      if (!outside(f, d.tx, d.ty)) continue;
      list.push([dist, d]);
    }
    list.sort((a, b) => a[0] - b[0]);
    cands[key] = { decor: W.decor, n: W.decor.length, list: list.slice(0, 60).map((x) => x[1]) };
    return cands[key].list;
  }
  function pickTarget(e) {
    const f = e.city, list = candidates(f, e.realmWorker);
    const ok = list.filter((d) => !(d.cutUntil && d.cutUntil > G.now) && !reserved.has(d));
    if (!ok.length) return null;
    return ok[Math.floor(Math.random() * Math.min(4, ok.length))];
  }
  const gatesShut = (f) => !!(KR.War && KR.War.gatesClosed && KR.War.gatesClosed(f));
  function pathTo(e, tx, ty) {
    const sx = Math.floor(e.x / TS), sy = Math.floor(e.y / TS);
    const p = W.findPathLong ? W.findPathLong(sx, sy, tx, ty, 90000, { door: 'pass' }) : W.findPath(sx, sy, tx, ty, 20000, { door: 'pass' });
    return p && p.length ? p : null;
  }
  // follow the path; true when there
  function walk(e, dt) {
    if (!e.path || !e.path.length) { e.moving = false; return true; }
    const [tx, ty] = e.path[0]; const gx = tx * TS + 16, gy = ty * TS + 16;
    const dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy);
    if (d < 6) { e.path.shift(); e.stuckT = 0; if (!e.path.length) { e.moving = false; return true; } return false; }
    const sp = e.speed * dt; const ox = e.x, oy = e.y;
    G.moveEnt(e, dx / d * Math.min(sp, d), dy / d * Math.min(sp, d), { door: 'npc' });
    if (Math.abs(e.x - ox) + Math.abs(e.y - oy) < sp * 0.2) { e.stuckT = (e.stuckT || 0) + dt; if (e.stuckT > 1.5) { e.stuckT = 0; if (d < 24 && !W.isBlockedTile(tx, ty)) { e.x = gx; e.y = gy; } else { e.path = null; e.moving = false; return null; } } }
    e.moving = true; e.walk = (e.walk || 0) + dt * 9; G.faceTo(e, { x: gx, y: gy });
    return false;
  }
  R.updateWorker = function (e, dt) {
    const f = e.city, kind = e.realmWorker; const st = R.state(f); if (!st) return;
    const w = st.workers[kind]; const wk = e.wk || (e.wk = { st: 'start', t: 0 });
    if (e.atk > 0) { e.atk += dt * 3; if (e.atk > 1) e.atk = 0; }
    if (e.dead) {
      if (!e.respawnAt) { e.respawnAt = G.now + R.RESPAWN_MS; w.deadUntil = Date.now() + R.RESPAWN_MS; if (wk.tgt) reserved.delete(wk.tgt); e.carry = null; R.emit('worker', f, kind, 'died');
        if (f === myF()) G.log(`Your ${R.WORKER[kind].name} has been killed! Another takes up the work in a minute.`, 'status', '#ff8a6a'); }
      if (G.now >= e.respawnAt) { const [tx, ty] = dropOf(f, kind); e.dead = false; e.hp = e.hpMax; e.x = tx * TS + 16; e.y = ty * TS + 16; e.respawnAt = null; e.path = null; w.deadUntil = 0; e.wk = { st: 'start', t: 1 }; e.carry = null; R.emit('worker', f, kind, 'back'); }
      return;
    }
    if (wk.t > 0) { wk.t -= dt; if (wk.st !== 'work') return; }
    switch (wk.st) {
      case 'start': case 'wait': case 'shelter': {
        if (wk.tgt) { reserved.delete(wk.tgt); wk.tgt = null; }
        const inside = !outside(f, Math.floor(e.x / TS), Math.floor(e.y / TS));
        if (gatesShut(f) && inside) { wk.st = 'shelter'; wk.t = 4; e.moving = false; return; } // the bells: everyone in, the gates shut
        const d = pickTarget(e); if (!d) { wk.st = 'wait'; wk.t = 6; return; }
        e.path = pathTo(e, d.tx, d.ty); if (!e.path) { wk.st = 'wait'; wk.t = 5; return; }
        reserved.add(d); wk.tgt = d; wk.st = 'go'; e.carry = null; return;
      }
      case 'go': {
        const r = walk(e, dt);
        if (r === null || (wk.tgt && wk.tgt.cutUntil && wk.tgt.cutUntil > G.now)) { wk.st = 'start'; wk.t = 1; return; }
        if (r) { wk.st = 'work'; wk.t = 8 + Math.random() * 4; wk.swing = 0; e.chopping = true; if (wk.tgt) G.faceTo(e, { x: wk.tgt.tx * TS + 16, y: wk.tgt.ty * TS + 16 }); }
        return;
      }
      case 'work': {
        wk.swing -= dt; if (wk.swing <= 0) { wk.swing = 1.1; e.atk = 0.01; if (e.near && KR.A && Math.hypot(e.x - G.player.x, e.y - G.player.y) < 500) KR.A.sfx(kind === 'arborist' ? 'chop' : 'blunt', 0.2); }
        if (wk.t > 0) return;
        e.chopping = false;
        const d = wk.tgt; if (d) { d.cutUntil = G.now + (kind === 'arborist' ? 150000 : 180000); d.cutAt = G.now; reserved.delete(d); wk.tgt = null; }
        wk.load = R.yieldOf(f, kind); e.carry = R.WORKER[kind].res;
        const [tx, ty] = dropOf(f, kind); e.path = pathTo(e, tx, ty);
        wk.st = 'back'; if (!e.path) wk.t = 3;
        return;
      }
      case 'back': {
        if (!e.path) { const [tx, ty] = dropOf(f, kind); e.path = pathTo(e, tx, ty); if (!e.path) { wk.t = 4; return; } }
        const r = walk(e, dt); if (r === null) { e.path = null; wk.t = 2; return; }
        if (!r) return;
        const res = R.WORKER[kind].res, n = wk.load || 0; wk.load = 0; e.carry = null;
        if (n) { R.add(f, { [res]: n }, kind); if (e.near) G.float(e, `+${n} ${res}`, res === 'wood' ? '#d8a860' : '#c8ccd4'); R.emit('worker', f, kind, 'delivered', n); }
        wk.st = 'start'; wk.t = 1.5;
        return;
      }
      default: wk.st = 'start';
    }
  };
  // the game's own loop runs NPCs near the hero; the realm runs its workers everywhere else
  const updateNPC0 = Sys.updateNPC;
  Sys.updateNPC = function (e, dt) {
    if (e.realmWorker) { e._rwT = G.now; return R.updateWorker(e, dt); }
    return updateNPC0.apply(this, arguments);
  };
  let farAcc = 0, slowAcc = 0, hireChk = 0;
  R.tick = function (dt) {
    if (!G.account || !G.player) return;
    for (const f of D.FACTION_IDS) if (R.state(f).construction.length) finish(f);
    slowAcc += dt; if (slowAcc > 1) { slowAcc = 0; for (const f of D.FACTION_IDS) syncLevel(f); }
    const main = !W.realm || W.realm === 'main';
    if (main) {
      farAcc += dt; if (farAcc >= 0.1) {
        const step = Math.min(0.25, farAcc); farAcc = 0;
        for (const e of G.ents) if (e.realmWorker && !e.removed && (!e._rwT || G.now - e._rwT > 300)) R.updateWorker(e, step);
      }
      hireChk += dt; if (hireChk > 2) { hireChk = 0; for (const f of D.FACTION_IDS) { const st = R.state(f); for (const k of ['arborist', 'miner']) if (st.workers[k].hired && !R.workers(f).some((e) => e.realmWorker === k)) spawnWorker(f, k); if (!G.ents.some((e) => e.liaison && e.city === f && !e.removed) && W.cityData[f]) spawnLiaison(f); } }
    } else {
      // the hero is away in a dungeon or another land: the workers keep at it all the same
      for (const f of D.FACTION_IDS) { const st = R.state(f); for (const k of ['arborist', 'miner']) if (R.workerOn(f, k)) { const acc = (st._acc = st._acc || {}); const res = R.WORKER[k].res; acc[res] = (acc[res] || 0) + R.yieldOf(f, k) * dt * 1000 / EST_TRIP; if (acc[res] >= 1) { const n = Math.floor(acc[res]); acc[res] -= n; R.add(f, { [res]: n }, k); } } }
    }
  };
  const worldTick0 = Sys.worldTick;
  Sys.worldTick = function (dt) { const r = worldTick0.apply(this, arguments); try { R.tick(dt); } catch (e) { if (!R._warned) { R._warned = true; console.warn('realm tick', e); } } return r; };

  // ---------------- the liaison's words ----------------
  const xs0 = KR.UI.extraService;
  KR.UI.extraService = function (e, s, add) {
    if (xs0) xs0.apply(this, arguments);
    if (s !== 'liaison') return;
    const f = e.city; if (myF() !== f) return;
    const st = R.state(f);
    if (!st.liaison) { add('⚜ Take me into your service (free: the king paid in advance)', () => { R.hireLiaison(f); KR.UI.refresh(); KR.UI.openNPC(e); }); return; }
    for (const k of ['arborist', 'miner']) if (!st.workers[k].hired) add(`${R.WORKER[k].icon} Hire the ${R.WORKER[k].name} (free)`, () => { R.hireWorker(f, k); KR.UI.openNPC(e); });
    add('👑 Open the kingdom', () => { KR.UI.close('npc'); KR.UI.open('realm'); });
  };
})();
