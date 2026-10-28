// Kingdom Rising — armies on the march: a war party follows the roads to the enemy capital in a column two
// abreast, behind a flag bearer who carries the king's banner and nothing else, with two drummers at the
// back beating the war drums all the way there (they quicken when the fighting starts). Bearer and drummers
// fall to a single blow. On arrival the column raises a war cry and charges.
(function () {
  const KR = window.KR; const { D, G, U, W } = KR; const Sys = KR.Sys, War = KR.War, A = KR.A;
  if (!War) return;
  const TS = D.TS;

  // ---- the column: two abreast, one row per tile and a third, the bearer alone in front, drummers last ----
  War.formationTarget = function (r) {
    const sq = r.squad; if (!sq || !sq.path) return null;
    const live = sq.order.filter((m) => !m.dead && !m.removed && m.warState === 'march');
    const bearer = live.filter((m) => m.soldier === 'bearer'), drums = live.filter((m) => m.soldier === 'drummer'), troops = live.filter((m) => !m.nonCombat);
    let row, side;
    if (r.soldier === 'bearer') { row = 0; side = 0; }
    else if (r.soldier === 'drummer') { row = 1 + Math.ceil(troops.length / 2) + 0.4; side = drums.indexOf(r) ? 1 : -1; }
    else { const k = troops.indexOf(r); row = 1 + Math.floor(k / 2) + (bearer.length ? 0.3 : -1); side = troops.length % 2 && k === troops.length - 1 ? 0 : k % 2 ? 1 : -1; }
    const back = row * 1.35;
    const fi = Math.max(0, Math.min(sq.path.length - 1, sq.hi - back)); const i0 = Math.floor(fi), i1 = Math.min(sq.path.length - 1, i0 + 1), t = fi - i0;
    const ax = sq.path[i0][0] + (sq.path[i1][0] - sq.path[i0][0]) * t, ay = sq.path[i0][1] + (sq.path[i1][1] - sq.path[i0][1]) * t;
    // direction of the road here (smoothed over a few tiles), for the side-by-side offset
    const j0 = Math.max(0, i0 - 3), j1 = Math.min(sq.path.length - 1, i0 + 3); let dx = sq.path[j1][0] - sq.path[j0][0], dy = sq.path[j1][1] - sq.path[j0][1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    let x = (ax + 0.5 - dy * side * 0.62) * TS, y = (ay + 0.5 + dx * side * 0.62) * TS;
    if (W.isBlockedTile(Math.floor(x / TS), Math.floor(y / TS))) { x = (ax + 0.5) * TS; y = (ay + 0.5) * TS; }
    return { x, y };
  };

  // ---- the flag bearer and the drummers ----
  function standard(sq, kind, k) {
    const bk = sq.bk; const F = D.FACTIONS[sq.f];
    const e = War.makeSoldier(sq.f, 'manatarms', bk[0] * TS + 16 + (k - 1) * 18, bk[1] * TS + 16, Math.max(1, Sys.cityLevel(sq.f) * 4), null);
    e.soldier = kind; e.nonCombat = true; e.hpMax = e.hp = 1; e.dmg = 0; e.ac = 0; e.passive = true;
    e.name = kind === 'bearer' ? `${F.city} Standard-Bearer` : `${F.city} Drummer`; e.title = kind === 'bearer' ? 'Carries the king\'s banner' : 'Beats the war drum';
    e.look = Object.assign({}, e.look, { weapon: null, offhand: null, ranged: null, rangeW: null, back: null, helm: kind === 'bearer' ? 'plate' : null, hat: kind === 'drummer' ? 'feather' : null, hatCol: F.banner, hatTrim: '#e0c050', armor: Object.assign({}, (e.look || {}).armor, { kind: kind === 'bearer' ? 'plate' : 'cloth', col: kind === 'bearer' ? '#c8ccd4' : F.banner, trim: '#e0c050' }), cape: F.banner, standard: kind === 'bearer' ? sq.f : null, drum: kind === 'drummer' });
    e.squad = sq; e.warState = 'march'; e.pi = 0; e.hate.clear(); e.inCombat = false;
    return e;
  }
  const launch0 = War.launchRaid;
  War.launchRaid = function (f, quiet) {
    const n0 = War.squads.length; const n = launch0.apply(this, arguments);
    const sq = War.squads.length > n0 ? War.squads[War.squads.length - 1] : null;
    if (n && sq && sq.f === f) {
      const bearer = standard(sq, 'bearer', 1), d1 = standard(sq, 'drummer', 0), d2 = standard(sq, 'drummer', 2);
      sq.members.push(bearer, d1, d2); sq.order.unshift(bearer); sq.order.push(d1, d2);
      sq.beat = 0; sq.beatT = 0;
      G.say(bearer, U.pick([`For ${D.FACTIONS[f].king}!`, 'Follow the banner!', 'Two by two! Keep the line!']), 3);
      const p = G.player; if (!quiet && p && p.c.faction === f) G.log(`They march two by two along the road behind the standard, the drums beating.`, 'status', '#9affb8');
    }
    return n;
  };
  // bearer and drummers never fight: they keep their place in the column, then hold back behind the battle line
  const upd0 = War.updateRaider;
  War.updateRaider = function (r, dt) {
    if (!r.nonCombat || r.dead) return upd0.apply(this, arguments);
    const sq = r.squad; r.hate.clear(); r.inCombat = false; r.target = null; r.autoAttack = false;
    G.statusTick(r, dt);
    let T = null;
    if (!sq || !sq.path) { War.removeRaider(r); return; }
    if (r.warState === 'march') T = War.formationTarget(r);
    else if (r.warState === 'assault' || sq.arrived && r.warState !== 'home') { const i = Math.max(0, sq.path.length - 12); const [tx, ty] = sq.path[i]; T = { x: (tx + 0.5) * TS + (r.soldier === 'drummer' ? (sq.members.indexOf(r) % 2 ? 26 : -26) : 0), y: (ty + 0.5) * TS + (r.soldier === 'drummer' ? 22 : 0) }; }
    else if (r.warState === 'home') {
      r.pi = r.pi == null || r.pi <= 0 ? Math.max(0, sq.path.length - 1) : r.pi; const [tx, ty] = sq.path[r.pi]; T = { x: tx * TS + 16, y: ty * TS + 16 };
      if (Math.hypot(T.x - r.x, T.y - r.y) < 20) { r.pi -= 2; if (r.pi <= 0) { War.removeRaider(r); return; } }
    }
    if (!T) { r.moving = false; return; }
    const d = Math.hypot(T.x - r.x, T.y - r.y);
    if (d < 6) { r.moving = false; const cdE = W.cityData[sq.ef]; if (cdE) G.faceTo(r, { x: cdE.cx * TS, y: cdE.cy * TS }); return; }
    const pace = 108 * (d > 90 ? 1.35 : 1); G.chase(r, T, dt, Math.min(pace, d / Math.max(dt, 1e-3)) / r.speed);
  };

  // ---- the drums: a steady marching beat, faster once battle is joined; louder the closer you are ----
  const MARCH = [1, 0, 1, 0, 1, 1, 1, 0], BATTLE = [1, 1, 0, 1, 1, 0, 1, 1];
  const tick0 = War.tick;
  War.tick = function (dt) {
    tick0.apply(this, arguments);
    const p = G.player; if (!p || !A || !A.sfx) return;
    for (const sq of War.squads) {
      const drums = sq.members.filter((m) => m.soldier === 'drummer' && !m.dead && !m.removed); if (!drums.length) continue;
      const fight = sq.arrived; const step = fight ? 0.27 : 0.34; sq.beatT = (sq.beatT || 0) + dt; if (sq.beatT < step) continue; sq.beatT = 0; sq.beat = ((sq.beat || 0) + 1) % 8;
      const pat = fight ? BATTLE : MARCH; if (!pat[sq.beat]) continue;
      const dr = drums[sq.beat % drums.length]; dr.drumHit = G.now;
      const dist = Math.hypot(dr.x - p.x, dr.y - p.y); const vol = Math.max(0, 1 - dist / 1500) ** 1.5 * (sq.beat === 0 || sq.beat === 4 ? 1 : 0.7);
      if (vol > 0.02) A.sfx('wardrum', vol, Math.max(-1, Math.min(1, (dr.x - p.x) / 600)));
    }
  };
  // ---- the charge ----
  const arrive0 = War.onArrive;
  War.onArrive = function (sq) {
    const r = arrive0.apply(this, arguments);
    const troops = sq.members.filter((m) => !m.dead && !m.nonCombat);
    const cries = ['CHARGE!', `For ${D.FACTIONS[sq.f].king}!`, `${D.FACTIONS[sq.f].city}!`, 'Break their gates!', 'No mercy!', 'Hold the line, archers!', 'With me, lads!'];
    troops.slice(0, 5).forEach((m, i) => setTimeout(() => { if (!m.dead) G.say(m, U.pick(cries), 2.5); }, i * 350));
    const p = G.player; if (p) { const d = Math.hypot(sq.members[0].x - p.x, sq.members[0].y - p.y); const v = Math.max(0, 1 - d / 1500); if (v > 0.05) { A.sfx('warcry', v); setTimeout(() => A.sfx('warcry', v * 0.8), 250); setTimeout(() => A.sfx('charge', v * 0.6), 500); } }
    return r;
  };
  // shouts in the thick of it
  setInterval(() => { try { for (const sq of War.squads) { if (!sq.arrived || Math.random() > 0.35) continue; const m = U.pick(sq.members.filter((x) => !x.dead && !x.nonCombat && x.inCombat)); if (m) G.say(m, U.pick(['Push!', 'Shields up!', 'Get up, get up!', 'Watch the tower!', 'They break! They break!', 'Medic!', 'For the king!', 'Again!']), 2); } } catch (e) {} }, 2500);

  // ---- the CPU rival hero: with friends on your side, only one of you runs them, so there is only one ----
  const rival0 = War.rivalTick;
  War.rivalTick = function () {
    const Net = Sys.Net, p = G.player;
    if (Net && Net.me && Net.peers && p) { const mine = Net.peers.filter((pp) => pp.f === p.c.faction).map((pp) => pp.peer).concat([Net.me]).sort(); if (mine[0] !== Net.me) return; }
    return rival0.apply(this, arguments);
  };
})();

// =====================================================================
// Sieges: when the alarm bell rings the portcullis drops and every gate of the city is shut to everyone, in and
// out, until the attack is over. A war party needs a battering ram to get in: the ram rolls at the head of the
// column, soldiers fall in behind it, and at the gate it swings every three seconds; five blows burst the gate.
// Catapults and trebuchets stand inside the walls, throw a very long way and turn slowly onto their target.
// Townsfolk hide in different houses, and soldiers, guards and townsfolk keep a little room around each other.
// =====================================================================
(function () {
  const KR = window.KR; const { D, G, U, W } = KR; const Sys = KR.Sys, War = KR.War, A = KR.A;
  if (!War) return;
  const TS = D.TS;
  const sfx = (n, v) => { try { A && A.sfx && v > 0.02 && A.sfx(n, Math.min(1, v)); } catch (e) {} };
  const near = (x, y, R) => { const p = G.player; if (!p) return 0; const d = Math.hypot(x - p.x, y - p.y); return d < R ? 1 - d / R : 0; };
  const mainRealm = () => !W.realm || W.realm === 'main';
  const mineF = (f) => { const p = G.player; return !!(p && p.c && p.c.faction === f); };

  // ---- data ----
  D.RAM = { name: 'Battering Ram', tier: 2, hits: 5, swing: 3, speed: 128 * 0.85, max: 2 };
  // the long-range engines moved inside the walls: the gates keep the towers, ballistas and cannons
  D.SIEGE_BY_TIER = [['archer', 'archer'], ['ballista', 'ballista'], ['heavyballista', 'heavyballista'], ['heavyballista', 'ballista'], ['cannon', 'heavyballista']];
  D.SIEGE_INSIDE = [[], [], [], ['catapult', 'catapult'], ['trebuchet', 'trebuchet', 'catapult', 'catapult']];
  Object.assign(D.SIEGE.catapult, { range: 1500, minRange: 220, delay: 6.5, turn: 0.32, aoe: 80, mul: 2.6, hpMul: 14 });
  Object.assign(D.SIEGE.trebuchet, { range: 2000, minRange: 320, delay: 8.5, turn: 0.2, aoe: 110, mul: 3.4, hpMul: 18 });
  War.events = [];
  War.ev = (o) => { War.events.push(o); if (War.events.length > 60) War.events.splice(0, War.events.length - 60); };

  // ---- inside or outside a city's walls ----
  War.insideWalls = function (f, px, py) { const cd = W.cityData[f]; if (!cd) return false; const tx = Math.floor(px / TS), ty = Math.floor(py / TS); return Math.max(Math.abs(tx - cd.cx), Math.abs(ty - cd.cy)) < cd.R; };

  // ---- the gates ----
  const GS = {};
  function buildGates(f) {
    const cd = W.cityData[f]; if (!cd || !cd.gates || cd.walled === false) return []; // an open town (no walls yet) has no gates to shut or break
    const { cx, cy, R } = cd;
    return cd.gates.map(([gx, gy], i) => {
      let tiles = [], o;
      if (gy === cy + R) { o = [0, 1]; for (let x = gx - 1; x <= gx + 1; x++) tiles.push([x, gy]); }
      else if (gy === cy - R) { o = [0, -1]; for (let x = gx - 2; x <= gx + 2; x++) tiles.push([x, gy]); }
      else { o = [gx > cx ? 1 : -1, 0]; for (let y = gy - 1; y <= gy + 1; y++) tiles.push([gx, y]); }
      tiles = tiles.filter(([x, y]) => W.inb(x, y) && W.tile(x, y) !== KR.T.CWALL);
      const name = o[1] > 0 ? 'south gate' : o[1] < 0 ? (cd.harbour ? 'sea gate' : 'north gate') : o[0] > 0 ? 'east gate' : 'west gate';
      return { f, i, gx, gy, tiles, out: o, x: (gx + 0.5) * TS, y: (gy + 0.5) * TS, name, closed: false, broken: false, hits: 0, prev: null };
    });
  }
  function setBlock(g, on) {
    if (on) { g.arr = W.block; g.prev = g.tiles.map(([x, y]) => W.block[y * W.W + x]); for (const [x, y] of g.tiles) W.block[y * W.W + x] = 1; return; }
    if (g.arr !== W.block || !g.prev) { g.prev = null; return; } // the city was rebuilt since: nothing of ours is left
    g.tiles.forEach(([x, y], k) => { W.block[y * W.W + x] = g.prev[k] || 0; }); g.prev = null;
  }
  War.gateList = function (f) {
    const cd = W.cityData[f]; let s = GS[f];
    if (!s || s.cd !== cd || !cd || s.R !== cd.R || s.cx !== cd.cx || s.block !== W.block || s.walled !== cd.walled) {
      if (s) for (const g of s.list) if (g.closed) setBlock(g, false);
      s = GS[f] = { cd, R: cd && cd.R, cx: cd && cd.cx, walled: cd && cd.walled, block: W.block, list: mainRealm() ? buildGates(f) : [] };
    }
    return s.list;
  };
  War.gatesDown = (f) => War.gateList(f).some((g) => g.closed);
  War.gatesClosed = (f) => War.gateList(f).some((g) => g.closed && !g.broken); // somewhere a shut gate still stands
  War.gateAt = (tx, ty) => { for (const f of D.FACTION_IDS) for (const g of War.gateList(f)) if (g.tiles.some(([x, y]) => x === tx && y === ty)) return g; return null; };
  // /stuck and other teleports: never across the walls of a city whose gates are down
  War.stuckAllowed = function (x0, y0, x1, y1) { for (const f of D.FACTION_IDS) if (War.gatesDown(f) && War.insideWalls(f, x0, y0) !== War.insideWalls(f, x1, y1)) return false; return true; };
  // anyone standing in the gateway when the portcullis falls is shoved out to the side they were on
  function clearGate(g) {
    const [ox, oy] = g.out; const list = G.ents.concat(G.player ? [G.player] : []);
    for (const e of list) {
      if (!e || e.dead || e.removed || e.static || e.onWall || e.upB) continue;
      const tx = Math.floor(e.x / TS), ty = Math.floor(e.y / TS); if (!g.tiles.some(([x, y]) => x === tx && y === ty)) continue;
      const s = (e.x - g.x) * ox + (e.y - g.y) * oy >= 0 ? 1 : -1;
      e.x = (tx + 0.5 + ox * s * 1.05) * TS; e.y = (ty + 0.5 + oy * s * 1.05) * TS;
      if (e.path) e.path = null; e.cpath = null; e.lp = null; e.gp = null;
    }
  }
  War.closeGates = function (f, quiet) {
    if (!mainRealm()) return 0; const list = War.gateList(f); const st = War.alarm[f] || (War.alarm[f] = {}); const br = st.broken || (st.broken = {});
    let n = 0, best = null, bd = 1e9;
    for (const g of list) {
      if (g.closed) continue;
      if (br[g.i]) { g.closed = true; g.broken = true; g.hits = D.RAM.hits; continue; } // broken earlier in this attack (before a trip to a dungeon)
      clearGate(g); g.closed = true; g.broken = false; g.hits = 0; g.dropAt = G.now; setBlock(g, true); n++;
      War.ev({ k: 'gateclose', f, i: g.i, quiet: !!quiet });
      const p = G.player; const d = p ? Math.hypot(p.x - g.x, p.y - g.y) : 1e9; if (d < bd) { bd = d; best = g; }
    }
    if (!n || quiet || !best) return n;
    const v = near(best.x, best.y, 1800); sfx('rumble', v); setTimeout(() => { sfx('heavy', v); sfx('creak', v * 0.8); }, 450); if (v > 0.6) G.shake = Math.max(G.shake || 0, 0.4);
    const F = D.FACTIONS[f]; const p = G.player;
    if (mineF(f)) G.log(`The portcullis crashes down! Every gate of ${F.city} is shut until the attack is over.`, 'status', '#ff9a6a');
    else if (p && War.squads.some((s) => s.f === p.c.faction && s.ef === f)) G.log(`The gates of ${F.city} slam shut! ${War.ramCount(p.c.faction) || War.squads.some((s) => s.f === p.c.faction && s.ram && !s.ram.dead) ? 'Your battering ram will have to break one.' : 'Without a battering ram your soldiers cannot get in.'}`, 'status', '#ffb24a');
    else if (v > 0) G.log(`The gates of ${F.city} slam shut.`, 'status', '#ffb24a');
    return n;
  };
  War.openGates = function (f, quiet) {
    const list = War.gateList(f); let n = 0;
    for (const g of list) { if (!g.closed) continue; g.closed = false; g.broken = false; g.hits = 0; setBlock(g, false); n++; War.ev({ k: 'gateopen', f, i: g.i }); }
    const st = War.alarm[f]; if (st) st.broken = {};
    if (n && !quiet) { if (mineF(f)) G.log(`The gates of ${D.FACTIONS[f].city} are raised again, and carpenters set to mending what was broken.`, 'status', '#9affb8'); const p = G.player; const g = list[0]; if (g && p) sfx('creak', near(g.x, g.y, 1600)); }
    return n;
  };
  // a blow of the ram: the gate shudders, cracks and buckles, and on the fifth it bursts
  War.hitGate = function (g, src) {
    if (!g || !g.closed || g.broken) return false;
    g.hits++; g.hitAt = G.now; const v = near(g.x, g.y, 2000); const F = D.FACTIONS[g.f];
    const last = g.hits >= D.RAM.hits;
    sfx('heavy', v); sfx(last ? 'treefall' : 'chop', v * 0.9); setTimeout(() => sfx('creak', v * 0.7), 160);
    const p = G.player; const dd = p ? Math.hypot(p.x - g.x, p.y - g.y) : 1e9; if (dd < 900) G.shake = Math.max(G.shake || 0, (last ? 1.4 : 0.55) * (1 - dd / 900) + 0.15);
    G.fxAdd({ k: 'ring', x: g.x + g.out[0] * 10, y: g.y + g.out[1] * 10, r: last ? 90 : 46, col: '#c8b090', life: 0.7 });
    War.ev({ k: last ? 'gatebreak' : 'gatehit', f: g.f, i: g.i, n: g.hits });
    const att = src && src.faction; const watching = mineF(g.f) || mineF(att) || dd < 1400;
    if (last) {
      g.broken = true; setBlock(g, false); const st = War.alarm[g.f] || (War.alarm[g.f] = {}); (st.broken || (st.broken = {}))[g.i] = 1;
      sfx('rockbreak', v); setTimeout(() => sfx('heavy', v), 120);
      if (mineF(g.f)) { G.log(`The ${g.name} of ${F.city} has been smashed open! The enemy is coming in!`, 'status', '#ff6a5a'); KR.UI && KR.UI.banner && KR.UI.banner('The gate has fallen!', `Enemy soldiers pour through the ${g.name}. Defend the king!`); }
      else if (watching) G.log(`The ${g.name} of ${F.city} bursts apart! ${mineF(att) ? 'Your soldiers charge through.' : ''}`, 'status', mineF(att) ? '#9affb8' : '#ffb24a');
      // defenders holding the gate rush the breach
      for (const o of G.ents) if (o.holdGate === g) { o.holdGate = null; o.holdAt = null; }
      if (src && src.squad) for (const m of src.squad.members) if (!m.dead && !m.nonCombat && !m.ram && Math.random() < 0.5) { G.say(m, U.pick(['CHARGE!', 'Through the breach!', 'It is open! Go, go!', 'For the king!']), 2.5); break; }
    } else if (watching && (g.hits === 1 || mineF(g.f))) G.log(mineF(g.f) ? `A battering ram hammers the ${g.name}! (${g.hits} of ${D.RAM.hits})` : `The ram strikes the ${g.name} of ${F.city}. (${g.hits} of ${D.RAM.hits})`, 'status', mineF(g.f) ? '#ff9a6a' : '#e8d48a');
    return true;
  };

  // ---- the alarm: lookouts spot a column long before it arrives; the bell drops the portcullis ----
  const ring0 = War.ringBell;
  War.ringBell = function (f, who) {
    const st = War.alarm[f]; const was = !!(st && st.state === 'ringing');
    const r = ring0.apply(this, arguments);
    if (!was) { try { War.closeGates(f); War.holdGates(f); } catch (e) { console.warn(e); } }
    return r;
  };
  const at0 = War.alarmTick;
  War.alarmTick = function () {
    for (const f of D.FACTION_IDS) {
      const cd = W.cityData[f]; if (!cd || !mainRealm()) continue;
      const cheb = (e) => Math.max(Math.abs(e.x / TS - cd.cx), Math.abs(e.y / TS - cd.cy));
      let foe = null, close = false;
      for (const s of War.squads) { if (s.ef !== f) continue; for (const m of s.members) { if (m.dead || m.removed) continue; const c = cheb(m); if (c < cd.R + 45 && (!foe || c < cheb(foe))) foe = m; if (c < cd.R + 9) close = true; } }
      if (foe) War.raiseAlarm(f, { x: foe.x, y: foe.y });
      const st = War.alarm[f];
      // the runner made it (or a gatekeeper saw them coming): ring before they reach the walls
      if (close && st && st.state === 'running') { const r = st.runner && !st.runner.dead ? st.runner : null; if (r) r.alarmRun = false; War.ringBell(f, r); }
    }
    at0.apply(this, arguments);
    for (const f of D.FACTION_IDS) {
      const st = War.alarm[f];
      if (!st || !st.state) { if (War.gatesDown(f)) War.openGates(f); }
      else if (st.state === 'ringing' && mainRealm()) War.closeGates(f, true); // after a trip to a dungeon the city was rebuilt: shut it again
    }
  };
  // when the gates are shut, guards inside form up behind the gate the enemy is coming at, spread out
  War.holdGates = function (f) {
    const st = War.alarm[f] || {}; const list = War.gateList(f).filter((g) => g.closed && !g.broken); if (!list.length) return;
    const w = st.where; const g = w ? list.slice().sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))[0] : list[0];
    const guards = G.ents.filter((o) => o.type === 'guard' && o.faction === f && !o.dead && !o.raider && !o.siege && !o.towerGuard && !o.alarmRun && o.title !== 'Royal Guard' && !o.static && War.insideWalls(f, o.x, o.y));
    const slots = War.formSlots(g, guards.length, -1);
    guards.sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y)).forEach((o, k) => { o.holdGate = g; o.holdAt = slots[k]; o.rally = null; });
  };
  // spread-out places in a fan before (side 1, outside) or behind (side -1, inside) a gate, a soldier's width apart
  const openPx = (x, y) => { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return !W.isBlockedTile(tx, ty) && !W.buildingAt(x, y); };
  War.formSlots = function (g, n, side, back) {
    const [ox, oy] = g.out; const ax = ox * side, ay = oy * side; const px = -ay, py = ax; const out = []; let row = 0;
    while (out.length < n && row < 12) {
      const dist = ((back || 3.2) + row * 1.15) * TS; const per = 5 + row * 2;
      for (let k = 0; k < per && out.length < n; k++) {
        const lat = (k - (per - 1) / 2) * 34; let x = g.x + ax * dist + px * lat, y = g.y + ay * dist + py * lat;
        if (!openPx(x, y) || (side < 0 ? !War.insideWalls(g.f, x, y) : War.insideWalls(g.f, x, y))) continue;
        out.push({ x, y });
      }
      row++;
    }
    while (out.length < n) out.push({ x: g.x + ax * 3 * TS, y: g.y + ay * 3 * TS });
    return out;
  };
  const gm0 = War.guardMove;
  War.guardMove = function (g, dt) {
    if (g.holdAt && !(g.stun > 0 || g.root > 0 || g.mez > 0)) {
      const st = War.alarm[g.faction]; const gate = g.holdGate;
      if (!st || !st.state || !gate || !gate.closed || gate.broken) { g.holdAt = null; g.holdGate = null; }
      else {
        const d = Math.hypot(g.holdAt.x - g.x, g.holdAt.y - g.y);
        if (d > 8) G.chase(g, g.holdAt, dt, Math.min(1.05, d / Math.max(1e-3, dt * g.speed))); else { g.moving = false; G.faceTo(g, gate); }
        g.homeX = g.x; g.homeY = g.y; return true;
      }
    }
    return gm0.apply(this, arguments);
  };
  // melee guards don't hurl themselves at a foe on the far side of a shut gate (archers still shoot over the wall)
  const ug0 = Sys.updateGuard;
  Sys.updateGuard = function (g, dt) {
    if (g && !g.raider && !g.siege && !g.dead && g.inCombat && !g.ranged && War.gatesClosed(g.faction)) {
      const t = G.topHate(g);
      if (t && War.insideWalls(g.faction, g.x, g.y) !== War.insideWalls(g.faction, t.x, t.y) && !(t.type === 'player' && t === G.player && Math.hypot(t.x - g.x, t.y - g.y) < 90)) { g.hate.delete(t); if (!g.hate.size) { g.inCombat = false; g.target = null; } }
    }
    return ug0.apply(this, arguments);
  };

  // ---- the battering ram ----
  const acctWar = () => { const a = G.account; if (!a) return null; a.war = a.war || {}; a.war.rams = a.war.rams || {}; return a.war; };
  War.ramCount = (f) => { const w = acctWar(); return w ? w.rams[f] || 0 : 0; };
  War.ramCost = (f) => Math.round(War.hireCost(f, 'knight') * 3);
  // buy one at the barracks (the recruiter): needs Kingdom Level 2; it leads your next war party
  War.buyRam = function (f) {
    const p = G.player; if (!p) return false; f = f || p.c.faction; const c = p.c; const w = acctWar(); const tier = U.clamp(Sys.cityLevel(f), 1, 5);
    if (tier < D.RAM.tier) { G.log(`A battering ram needs Kingdom Level ${D.RAM.tier}.`, 'sys', '#ffb24a'); sfx('fail', 0.5); return false; }
    if (War.ramCount(f) >= D.RAM.max) { G.log(`The barracks yard has room for ${D.RAM.max} rams.`, 'sys', '#ffb24a'); sfx('fail', 0.5); return false; }
    const cost = War.ramCost(f); if (c.coins < cost) { G.log('Not enough coin for a battering ram.', 'sys', '#ffb24a'); sfx('fail', 0.5); return false; }
    c.coins -= cost; w.rams[f] = (w.rams[f] || 0) + 1;
    sfx('coin', 1); sfx('craft', 0.6);
    G.log(`The carpenters of ${D.FACTIONS[f].city} build you a battering ram (${G.fmtCoins(cost)}). It will roll at the head of your next war party and break the enemy's gates.`, 'sys', '#9affb8');
    War.ev({ k: 'rambought', f });
    Sys.saveAccount && Sys.saveAccount(true); Sys.save && Sys.save(true);
    if (KR.UI.isOpen && KR.UI.isOpen('barracks')) War.renderBarracks(KR.UI.wins.barracks); KR.UI.refresh && KR.UI.refresh();
    return true;
  };
  function makeRam(sq) {
    const f = sq.f, F = D.FACTIONS[f], bk = sq.bk, lv = Sys.cityTierLevel(f);
    const e = G.makeEnt({ type: 'guard', raider: true, ram: true, faction: f, city: null, name: `${F.city} Battering Ram`, title: 'Breaks the enemy gates', x: bk[0] * TS + 16, y: bk[1] * TS + 16, homeX: bk[0] * TS + 16, homeY: bk[1] * TS + 16, level: lv, hostile: true, seed: Math.random() });
    e.hpMax = e.hp = Math.round(G.mobHp(lv) * 16); e.ac = 1600; e.r = 30; e.h = 64; e.speed = D.RAM.speed; e.leash = 1e9; e.aggroR = 0; e.passive = true; e.look = null; e.noLoot = true;
    e.res = { fire: 0, cold: 80, magic: 60, poison: 100, disease: 100 }; e.dmg = 0;
    e.squad = sq; e.warState = 'march'; e.pi = 0; e.swingT = 0; e.ramPh = 0;
    return e;
  }
  const launch1 = War.launchRaid;
  War.launchRaid = function (f, quiet) {
    const n0 = War.squads.length; const n = launch1.apply(this, arguments);
    const sq = War.squads.length > n0 ? War.squads[War.squads.length - 1] : null;
    if (n && sq && sq.f === f) {
      const mine = mineF(f);
      // the enemy's carpenters always build them a ram; yours come from the barracks yard
      if (War.ramCount(f) > 0 || (!mine && !(War.cpuActive && War.cpuActive()))) { // the computer's kingdom has to build its rams too
        const ram = makeRam(sq); sq.ram = ram; sq.members.push(ram); sq.order.unshift(ram);
        if (mine && !quiet) G.log('Your battering ram rolls out at the head of the column. The soldiers fall in behind it.', 'status', '#9affb8');
        else if (!quiet && mineF(sq.ef)) G.log(`Scouts report a battering ram at the head of the ${D.FACTIONS[f].city} column.`, 'status', '#ffb24a');
      } else if (!quiet) G.log(`No battering ram marches with them: if the gates of ${D.FACTIONS[sq.ef].city} are shut, your soldiers cannot get in. Build one at the Siege Workshop.`, 'sys', '#ffb24a');
    }
    return n;
  };
  // the ram leads the column; the standard and the soldiers follow behind it
  const ft1 = War.formationTarget;
  War.formationTarget = function (r) {
    const sq = r.squad; if (!sq || !sq.path || !sq.ram || sq.ram.dead || sq.ram.removed || sq.ram.warState !== 'march') return ft1.apply(this, arguments);
    if (r === sq.ram) { const i = Math.max(0, Math.min(sq.path.length - 1, sq.hi)); return { x: sq.path[i][0] * TS + 16, y: sq.path[i][1] * TS + 16 }; }
    const h = sq.hi; sq.hi = h - 3.4; try { return ft1.apply(this, arguments); } finally { sq.hi = h; }
  };
  const arrive1 = War.onArrive;
  War.onArrive = function (sq) {
    const r = arrive1.apply(this, arguments);
    const end = sq.path[sq.path.length - 1]; const ex = end[0] * TS + 16, ey = end[1] * TS + 16;
    sq.gate = War.gateList(sq.ef).slice().sort((a, b) => Math.hypot(a.x - ex, a.y - ey) - Math.hypot(b.x - ex, b.y - ey))[0] || null;
    return r;
  };
  // the gate barring this war party's way in: shut, unbroken, and no other way in yet
  War.blockingGate = function (sq) {
    const list = War.gateList(sq.ef); if (!list.some((g) => g.closed && !g.broken) || list.some((g) => g.closed && g.broken)) return null;
    if (!sq.gate || !sq.gate.closed) { const lead = sq.members.find((m) => !m.dead && !m.removed) || sq.members[0]; if (lead) sq.gate = list.filter((g) => g.closed).sort((a, b) => Math.hypot(a.x - lead.x, a.y - lead.y) - Math.hypot(b.x - lead.x, b.y - lead.y))[0]; }
    return sq.gate || null;
  };
  War.ramTick = function (r, dt) {
    const sq = r.squad; r.stun = r.mez = r.root = r.fear = 0; r.hate.clear(); r.inCombat = false; r.target = null; G.statusTick(r, dt); if (r.dead) return;
    r.ramAim = null;
    if (!sq || !sq.path) { War.removeRaider(r); return; }
    const troops = sq.members.filter((m) => m !== r && !m.dead && !m.removed && !m.nonCombat);
    if (r.warState !== 'home' && sq.arrived && (!troops.length || troops.every((m) => m.warState === 'home'))) { r.warState = 'home'; r.pi = Math.max(0, sq.path.length - 1); }
    const go = (T, pace) => { const d = Math.hypot(T.x - r.x, T.y - r.y); if (d < 5) { r.moving = false; return true; } G.chase(r, T, dt, Math.min(pace, d / Math.max(dt, 1e-3)) / r.speed); return false; };
    if (r.warState === 'march') { const T = War.formationTarget(r); if (T) go(T, D.RAM.speed * (Math.hypot(T.x - r.x, T.y - r.y) > 90 ? 1.2 : 1)); r.swingT = 0; r.ramPh = 0; return; }
    if (r.warState === 'home') {
      r.swingT = 0; r.ramPh = 0;
      r.pi = r.pi == null ? Math.max(0, sq.path.length - 1) : r.pi; const [tx, ty] = sq.path[Math.max(0, r.pi)];
      if (go({ x: tx * TS + 16, y: ty * TS + 16 }, D.RAM.speed) || Math.hypot(tx * TS + 16 - r.x, ty * TS + 16 - r.y) < 24) { r.pi -= 2; if (r.pi <= 0) { War.removeRaider(r); return; } }
      return;
    }
    // at the enemy kingdom: up to the gate, then swing
    const g = sq.gate || War.blockingGate(sq); if (!g) { r.moving = false; return; }
    const [ox, oy] = g.out; const front = { x: g.x + ox * (TS * 0.5 + 80), y: g.y + oy * (TS * 0.5 + 80) }; // the swinging head just reaches the portcullis (siege3d.js)
    r.ramAim = { x: g.x, y: g.y };
    if (!go(front, D.RAM.speed)) { r.swingT = 0; r.ramPh = 0; if (Math.hypot(front.x - r.x, front.y - r.y) > 120) r.ramAim = null; return; }
    if (!g.closed || g.broken) { r.ramPh = 0; r.swingT = 0; return; }
    const P = D.RAM.swing; const prev = r.swingT; r.swingT += dt; const at = P * 0.75;
    if (prev < at && r.swingT >= at) War.hitGate(g, r);
    if (prev < 0.05 && r.swingT >= 0.05 && Math.random() < 0.5) G.say(r, U.pick(['Heave!', 'Again!', 'Put your backs into it!', 'Swing!', 'One more!']), 1.6);
    if (r.swingT >= P) r.swingT -= P;
    r.ramPh = r.swingT / P;
  };
  // soldiers wait spread out behind the ram, fighting whatever defends the outside of the walls
  War.siegeHold = function (r, g, dt) {
    const sq = r.squad; G.statusTick(r, dt); if (r.dead) return; if (r.stun > 0 || r.root > 0 || r.mez > 0) { r.moving = false; return; }
    r.returning = false; r.leash = 1e9; r.homeX = r.x; r.homeY = r.y;
    if (r.priest && War.priestTick(r, dt)) return;
    r.scanT = (r.scanT || 0) - dt;
    if (r.scanT <= 0 || (r.want && (r.want.dead || r.want.removed))) {
      r.scanT = 0.5; let want = War.attackerOf(r); if (want && War.insideWalls(sq.ef, want.x, want.y)) want = null;
      if (!want) { let bd = r.ranged ? 340 : 300; for (const o of G.ents.concat(G.player ? [G.player] : [])) { if (!War.isFoe(r.faction, o) || War.insideWalls(sq.ef, o.x, o.y)) continue; const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; want = o; } } }
      r.want = want; r.hate.clear(); if (want) { r.hate.set(want, 100); r.inCombat = true; } else r.inCombat = false;
    }
    const t = r.want;
    if (t && !t.dead && !t.removed) {
      const d = Math.hypot(t.x - r.x, t.y - r.y);
      if (r.ranged ? d <= 340 && W.lineClear(r.x, r.y - 10, t.x, t.y - 10) : d <= G.meleeRange(r, t) + 30) { G.updateMob(r, dt); r.returning = false; r.leash = 1e9; return; }
      G.chase(r, t, dt, 1); return;
    }
    // my place in the fan behind the ram (archers further back)
    const holders = sq.members.filter((m) => !m.dead && !m.removed && !m.nonCombat && !m.ram && m.warState === 'assault');
    const melee = holders.filter((m) => !m.ranged), ranged = holders.filter((m) => m.ranged);
    if (!sq.slots || sq.slotN !== holders.length || sq.slotGate !== g) { sq.slotN = holders.length; sq.slotGate = g; sq.slots = new Map(); const a = War.formSlots(g, melee.length, 1, 4.6), b = War.formSlots(g, ranged.length, 1, 8.2); melee.forEach((m, k) => sq.slots.set(m, a[k])); ranged.forEach((m, k) => sq.slots.set(m, b[k])); }
    const s = sq.slots.get(r); if (!s) { r.moving = false; return; }
    const d = Math.hypot(s.x - r.x, s.y - r.y);
    if (d > 8) G.chase(r, s, dt, Math.min(1, d / Math.max(1e-3, dt * r.speed)));
    else { r.moving = false; G.faceTo(r, g); if (Math.random() < dt * 0.02) G.say(r, U.pick(['Break it down!', 'Come out and fight!', 'Open up, cowards!', 'Hit it again!']), 2); }
  };
  const upd1 = War.updateRaider;
  War.updateRaider = function (r, dt) {
    if (!r.dead && r.ram && !r.trollFree) return War.ramTick(r, dt); // a troll giant fights on once the gate is down
    const sq = r.squad;
    if (!r.dead && sq && !r.nonCombat && r.warState === 'assault' && sq.arrived) {
      const g = War.blockingGate(sq);
      if (g && !War.insideWalls(sq.ef, r.x, r.y)) return War.siegeHold(r, g, dt);
    }
    return upd1.apply(this, arguments);
  };
  const killed0 = War.onRaiderKilled;
  War.onRaiderKilled = function (r) {
    if (r.ram) {
      const w = acctWar(); if (w && w.rams[r.faction] > 0) w.rams[r.faction]--;
      const sq = r.squad; const p = G.player; const F = D.FACTIONS[r.faction];
      if (mineF(r.faction)) G.log('Your battering ram has been destroyed! Without it the gates will hold.', 'status', '#ff6a5a');
      else if (p && sq && mineF(sq.ef)) { G.log(`The ${F.city} battering ram is destroyed! The gates will hold.`, 'status', '#9affb8'); Sys.addStatus && Sys.addStatus(sq.ef, 15, `destroying the enemy's battering ram`); }
      War.ev({ k: 'ramdie', x: r.x, y: r.y });
      Sys.saveAccount && Sys.saveAccount(true);
      return;
    }
    return killed0.apply(this, arguments);
  };
  // a war party with no way in mills about outside, then gives up and marches home
  War.siegeStall = function () {
    for (const sq of War.squads) {
      if (!sq.arrived || sq.giveUp) continue;
      const g = War.blockingGate(sq); const ram = sq.ram && !sq.ram.dead && !sq.ram.removed;
      if (!g || ram) { sq.stallT = 0; continue; }
      const fighting = sq.members.some((m) => !m.dead && m.inCombat && m.want && !m.want.dead);
      sq.stallT = (sq.stallT || 0) + (fighting ? 0.3 : 1);
      if (sq.stallT < 30) continue;
      sq.giveUp = true; const F = D.FACTIONS[sq.f], E = D.FACTIONS[sq.ef];
      for (const m of sq.members) if (!m.dead) { m.warState = 'home'; m.hate.clear(); m.inCombat = false; m.want = null; m.focus = null; m.pi = Math.min(sq.hi, sq.path.length - 1); }
      const lead = sq.members.find((m) => !m.dead && !m.nonCombat); if (lead) G.say(lead, U.pick(['We cannot break it. Fall back!', 'Retreat! Back to the road!', 'No way in. Fall back!']), 3);
      if (mineF(sq.f)) G.log(`Your soldiers cannot break the gates of ${E.city} without a battering ram, and march home.`, 'status', '#ffb24a');
      else if (mineF(sq.ef)) { G.log(`The soldiers of ${F.city} cannot break our gates. They retreat!`, 'status', '#9affb8'); Sys.addStatus && Sys.addStatus(sq.ef, 10, 'holding the gates'); }
    }
  };

  // ---- catapults and trebuchets: inside the walls, huge, slow to turn, very long range ----
  const blk = {};
  War.insideSpots = function (f, n) {
    const cd = W.cityData[f]; if (!cd || !n) return [];
    const { cx, cy, R } = cd; const x0 = cx - R, y0 = cy - R, N = R * 2 + 1;
    const occ = new Uint8Array(N * N); // buildings, with a tile's margin, and the wall stairs
    for (const b of W.buildings) { if (b.city !== f) continue; for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) { const i = (y - y0) * N + (x - x0); if (x >= x0 && y >= y0 && x < x0 + N && y < y0 + N) occ[i] = 1; }
      if (b.gate) for (let y = b.y + b.h; y <= b.y + b.h + 4; y++) for (let x = b.gate.x0 - 2; x <= b.gate.x1 + 2; x++) if (x >= x0 && y >= y0 && x < x0 + N && y < y0 + N) occ[(y - y0) * N + (x - x0)] = 1; }
    if (W.stairs) for (const [i] of W.stairs) { const x = i % W.W, y = Math.floor(i / W.W); for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const xx = x + k, yy = y + j; if (xx >= x0 && yy >= y0 && xx < x0 + N && yy < y0 + N) occ[(yy - y0) * N + (xx - x0)] = 1; } }
    const ok = (tx, ty) => {
      if (Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) > R - 4) return false;
      if (Math.abs(tx - cx) <= 3 || (ty - cy >= -1 && ty - cy <= 7)) return false; // keep the avenues gate to gate clear
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const x = tx + i, y = ty + j; if (occ[(y - y0) * N + (x - x0)] || W.isBlockedTile(x, y) || War.gateAt(x, y)) return false; }
      return true;
    };
    const castle = W.buildings.find((b) => b.city === f && (b.gate || b.terr)) || W.buildings.find((b) => b.city === f && b.type === 'hall');
    const ax = castle ? (castle.gate ? (castle.gate.x0 + castle.gate.x1) / 2 : castle.x + castle.w / 2) : cx, ay = castle ? castle.y + castle.h + 3 : cy;
    const cand = [];
    for (let ty = cy - R + 4; ty <= cy + R - 4; ty++) for (let tx = cx - R + 4; tx <= cx + R - 4; tx++) if (ok(tx, ty)) cand.push([tx, ty, Math.hypot(tx - ax, (ty - ay) * 1.3)]);
    cand.sort((a, b) => a[2] - b[2]);
    const out = [];
    for (const c of cand) { if (out.length >= n) break; if (out.some((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) < 6)) continue; out.push(c); }
    return out;
  };
  const sd1 = War.spawnDefenses;
  War.spawnDefenses = function (f, mk) {
    const ob = blk[f]; if (ob && ob.arr === W.block) for (const t of ob.list) W.block[t[1] * W.W + t[0]] = t[2]; blk[f] = { arr: W.block, list: [] };
    for (const e of G.ents.slice()) if (e.siege && e.big && e.faction === f) G.remove(e);
    if (GS[f]) { for (const g of GS[f].list) if (g.closed) setBlock(g, false); GS[f] = null; }
    sd1.apply(this, arguments);
    const tier = U.clamp(Sys.cityLevel(f), 1, 5), lv = Sys.cityTierLevel(f); const kinds = D.SIEGE_INSIDE[tier - 1] || [];
    const spots = War.insideSpots(f, kinds.length); const cd = W.cityData[f];
    kinds.forEach((kind, i) => {
      const s = spots[i]; if (!s) return; const def = D.SIEGE[kind];
      const t = mk('tower', s[0] * TS + 16, s[1] * TS + 16, { type: 'guard', title: 'City defense', level: lv, name: `${D.FACTIONS[f].city} ${def.name}` });
      War.makeSiege(t, kind); t.big = true; t.r = def.bigR || (kind === 'trebuchet' ? 46 : 38); t.h = def.bigH || (kind === 'trebuchet' ? 230 : 120); t.aggroR = def.range;
      // at rest each engine faces the nearest gate
      const gs = cd.gates.map(([gx, gy]) => [gx, gy, Math.hypot(gx - s[0], gy - s[1])]).sort((a, b) => a[2] - b[2])[0];
      t.aimAng = gs ? Math.atan2(gs[1] - s[1], gs[0] - s[0]) : -Math.PI / 2;
      for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const x = s[0] + k, y = s[1] + j, ii = y * W.W + x; blk[f].list.push([x, y, W.block[ii]]); W.block[ii] = 1; }
    });
    const st = War.alarm[f]; if (st && st.state === 'ringing') War.closeGates(f, true);
  };
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const us1 = War.updateSiege;
  War.updateSiege = function (t, dt) {
    if (!t.big || t.dead) return us1.apply(this, arguments);
    const def = D.SIEGE[t.siege]; t.fireK = Math.max(0, (t.fireK || 0) - dt * 1.2);
    t.scanT = (t.scanT || 0) - dt;
    if (t.scanT <= 0) {
      t.scanT = 0.7; let best = null, bs = 1e9; const p = G.player;
      for (const e of G.ents.concat(p ? [p] : [])) {
        if (e === t || !War.isFoe(t.faction, e) || (e.type === 'guard' && !e.raider) || e.type === 'king' || e.nonCombat) continue;
        const d = Math.hypot(e.x - t.x, e.y - t.y); if (d > def.range || d < def.minRange) continue;
        const s = d * (e.ram ? 0.35 : 1) + Math.abs(wrapA(Math.atan2(e.y - t.y, e.x - t.x) - t.aimAng)) * 260; // the ram first; otherwise whatever needs least turning
        if (s < bs) { bs = s; best = e; }
      }
      t.tgt = best; t.inCombat = !!best;
    }
    const tg = t.tgt; if (!tg || tg.dead || tg.removed) { t.tgt = null; t.turning = 0; t.fireT = Math.max(t.fireT || 0, 1.5); return; }
    const want = Math.atan2(tg.y - t.y, tg.x - t.x); const diff = wrapA(want - t.aimAng); const step = U.clamp(diff, -def.turn * dt, def.turn * dt);
    t.aimAng = wrapA(t.aimAng + step); t.turning = Math.abs(diff) > 0.01 ? Math.sign(diff) : 0;
    if (t.turning) { t.creakT = (t.creakT || 0) - dt; if (t.creakT <= 0) { t.creakT = 1.4; sfx('creak', near(t.x, t.y, 900) * 0.5); } }
    t.fireT -= dt; if (t.fireT > 0 || Math.abs(diff) > 0.05) return;
    t.fireT = def.delay * (0.9 + Math.random() * 0.2); t.fireK = 1; t.fireAt = G.now;
    const v = near(t.x, t.y, 1100); const gun = def.vis === 'ironball', bolt = def.vis === 'bigbolt';
    if (gun) { sfx(def.bigR ? 'bombard' : 'cannon', v); const pp = G.player; if (pp && Math.hypot(t.x - pp.x, t.y - pp.y) < 500) G.shake = Math.max(G.shake || 0, 0.35); }
    else if (bolt) { sfx('ballista', v); sfx('creak', v * 0.5); }
    else { sfx('whoosh', v * 0.8); sfx('creak', v * 0.6); }
    War.ev({ k: 'fire', f: t.faction, x: t.x, y: t.y, ang: t.aimAng, kind: t.siege, id: t.id });
    const dmg = () => Math.round(t.dmg * (0.75 + Math.random() * 0.5));
    const d = Math.hypot(tg.x - t.x, tg.y - t.y);
    const sx0 = t.x, sy0 = t.y;
    G.shoot(t, tg, def.vis || 'boulder', -1, { arc: bolt ? 0.25 : U.clamp(d * 0.05 * 0.42 * (def.arcK || 1), gun ? 1.2 : 5, 26), onHit: () => {
      if (def.pierce) { // the great bolt goes through a whole file of men
        const x0 = sx0, y0 = sy0, dx = tg.x - x0, dy = tg.y - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        for (const e of G.ents.concat(G.player ? [G.player] : [])) { if (e === tg || !War.isFoe(t.faction, e)) continue; const ax = e.x - x0, ay = e.y - y0; const along = ax * ux + ay * uy; if (along < L * 0.5 || along > L + 260) continue; if (Math.abs(ax * uy - ay * ux) < 26 + (e.r || 12)) G.damage(t, e, Math.round(G.mitigate(t, e, dmg()) * 0.8), {}); }
      }
      const x = tg.x, y = tg.y; G.fxAdd({ k: 'ring', x, y, r: def.aoe, col: '#c8b090', life: 0.8 });
      War.ev({ k: 'impact', x, y, r: def.aoe, big: t.siege === 'trebuchet' });
      const w = near(x, y, 1200); sfx('heavy', w); sfx('rockbreak', w * 0.8); const pp = G.player; if (pp && Math.hypot(x - pp.x, y - pp.y) < 600) G.shake = Math.max(G.shake || 0, 0.7);
      for (const e of G.ents.concat(G.player ? [G.player] : [])) if (War.isFoe(t.faction, e) && Math.hypot(e.x - x, e.y - y) < def.aoe + (e.r || 12)) G.damage(t, e, Math.round(G.mitigate(t, e, dmg()) * (e === tg ? 1 : 0.6)), {});
    } });
    const pr = G.proj[G.proj.length - 1]; if (pr && pr.src === t) pr.speed = Math.max(300, d / (def.flight || 2.6));
  };

  // ---- townsfolk hide in different houses, a spot each ----
  const taken = new Map();
  const freeSpotIn = (b) => {
    const out = [];
    for (let ty = b.y + 1; ty < b.y + b.h - 1; ty++) for (let tx = b.x + 1; tx < b.x + b.w - 1; tx++) {
      if (W.isBlockedTile(tx, ty) || taken.has(ty * W.W + tx)) continue;
      if (b.door && Math.abs(tx - b.door.tx) <= 1 && ty >= b.door.ty - 1) continue; // keep the doorway clear
      out.push([tx, ty]);
    }
    return out.length ? out[Math.floor(Math.random() * out.length)] : null;
  };
  War.npcFlee = function (e) {
    e.fleeing = true;
    const inside = W.buildingAt(e.x, e.y); if (inside && inside.type !== 'barracks') return; // already indoors: stay put
    const houses = W.buildings.filter((b) => b.city === e.city && (b.type === 'house' || b.type === 'inn'));
    const order = houses.map((b) => [b, Math.hypot(b.px + b.pw / 2 - e.x, b.py + b.ph / 2 - e.y) + (b._hideN || 0) * 110]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    if (e.home && houses.includes(e.home) && (e.home._hideN || 0) < 3) order.unshift(e.home);
    for (const b of order.slice(0, 5)) {
      const s = freeSpotIn(b); if (!s) continue;
      const path = W.findPathLong(Math.floor(e.x / TS), Math.floor(e.y / TS), s[0], s[1], 20000); if (!path) continue;
      const key = s[1] * W.W + s[0]; taken.set(key, e); e.hideKey = key; e.hideB = b; b._hideN = (b._hideN || 0) + 1;
      if (e.static) { e.wasStatic = true; e.static = false; }
      e.fleeSpeed = e.speed; e.speed = Math.max(e.speed, 110) * 1.4;
      e.path = path; e.task = 'hide'; e.taskDur = 9999; e.doing = null;
      if (Math.random() < 0.4) G.say(e, U.pick(['Raiders! Run!', 'Get inside!', 'Hide the children!', 'They are at the gates!', 'Bar the door!']), 2.5);
      return;
    }
    e.moving = false; // outside the walls with the gates shut, or nowhere free: crouch where you are
  };
  const ret0 = War.npcReturn;
  War.npcReturn = function (e) {
    if (e.hideKey != null) { if (taken.get(e.hideKey) === e) taken.delete(e.hideKey); if (e.hideB) e.hideB._hideN = Math.max(0, (e.hideB._hideN || 1) - 1); e.hideKey = null; e.hideB = null; }
    return ret0.apply(this, arguments);
  };

  // ---- everyone keeps a little room: soldiers, guards, the ram and townsfolk running for cover ----
  const CELL = 64; const grid = new Map();
  War.separate = function (dt) {
    grid.clear(); const list = [];
    for (const e of G.ents) {
      if (e.dead || e.removed || e.siege || e.bell || e.raidBoard || e.barracks || e.onWall || e.upB) continue;
      let ok = false;
      if (e.raider) ok = !(e.warState === 'garrison' && e.sit);
      else if (e.type === 'guard') ok = !e.static || e.inCombat;
      else if (e.type === 'npc') ok = !!e.fleeing && !e.static;
      if (!ok) continue;
      list.push(e); const k = Math.floor(e.x / CELL) * 4096 + Math.floor(e.y / CELL); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(e);
    }
    const step = Math.min(60 * dt, 6);
    for (const a of list) {
      const gx = Math.floor(a.x / CELL), gy = Math.floor(a.y / CELL);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const c = grid.get((gx + i) * 4096 + gy + j); if (!c) continue;
        for (const b of c) {
          if (b.id <= a.id) continue;
          const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy);
          const min = a.ram || b.ram ? 44 + (a.ram && b.ram ? 40 : 0) : a.type === 'npc' && b.type === 'npc' ? 20 : 25;
          if (d >= min) continue;
          const nx = d > 0.01 ? dx / d : Math.cos(a.id * 2.4), ny = d > 0.01 ? dy / d : Math.sin(a.id * 2.4);
          const push = Math.min(min - d, step);
          const wa = a.ram ? 0 : b.ram ? 1 : 0.5, wb = b.ram ? 0 : a.ram ? 1 : 0.5;
          if (wa && !(a.sit && a.warState === 'garrison')) G.moveEnt(a, -nx * push * wa, -ny * push * wa);
          if (wb && !(b.sit && b.warState === 'garrison')) G.moveEnt(b, nx * push * wb, ny * push * wb);
        }
      }
    }
  };

  let acc = 0;
  const tick2 = War.tick;
  War.tick = function (dt) { tick2.apply(this, arguments); acc += dt; if (acc >= 1) { acc = 0; try { War.siegeStall(); } catch (e) { console.warn(e); } } };

  // ---- the barracks: build a battering ram ----
  const rb0 = War.renderBarracks;
  War.renderBarracks = function (w) {
    rb0.apply(this, arguments);
    const p = G.player; if (!p) return; const f = p.c.faction; const tier = U.clamp(Sys.cityLevel(f), 1, 5); const b = w.body;
    const have = War.ramCount(f), cost = War.ramCost(f), locked = tier < D.RAM.tier, full = have >= D.RAM.max;
    const sec = document.createElement('div'); sec.className = 'bk-siege';
    sec.innerHTML = `<h4 class="abh">Siege <small class="dim">${have} of ${D.RAM.max} battering ram${D.RAM.max > 1 ? 's' : ''} in the yard</small></h4>
      <div class="row-item${locked ? ' locked' : ''}"><span class="ic">🐏</span><div class="ri-m"><b>Battering Ram</b><small>${locked ? `Needs kingdom level ${D.RAM.tier}` : G.fmtCoins(cost)} · siege engine</small><small class="dim">When the alarm bell rings, a city drops its portcullis and nobody gets in or out. A ram rolls at the head of your war party, the soldiers following behind it, and breaks a gate in ${D.RAM.hits} blows. Defend it: if it is destroyed, the gates hold. It comes home with the survivors.</small></div></div>`;
    if (!locked) { const bt = document.createElement('button'); bt.className = 'btn gold small'; bt.textContent = 'Build'; bt.disabled = full || p.c.coins < cost; bt.title = full ? 'The yard is full' : p.c.coins < cost ? 'Not enough coin' : ''; bt.onclick = () => War.buyRam(f); sec.querySelector('.row-item').appendChild(bt); }
    const vic = [...b.querySelectorAll('h4.abh')].find((h) => /Victory|Your rival/.test(h.textContent));
    if (vic) b.insertBefore(sec, vic); else b.appendChild(sec);
  };
  // what each kingdom level brings to the defenses
  const ut0 = Sys.cityUpgrades;
  if (ut0) Sys.cityUpgrades = function (lvl) {
    const out = (ut0.apply(this, arguments) || []).map((s) => (/Catapults guard every gate/.test(s) ? s.replace('🪨 Catapults guard every gate', '🪨 Two great catapults stand inside the walls') : /Trebuchets and cannons defend the walls/.test(s) ? s.replace('💣 Trebuchets and cannons defend the walls', '💣 Trebuchets inside the walls, cannons at the gates') : s));
    if (lvl === D.RAM.tier) out.push('🐏 Battering rams can be built at the barracks: your war parties need one to break the enemy\'s gates');
    return out;
  };
})();

// =====================================================================
// The city is the kingdom (redesign): buildings, not Kingdom Levels, decide what each side can field.
// - the army API the Kingdom panel uses (recruit types, hiring in gold, guards, orders, what your scouts can see)
// - the enemy brother's kingdom run by the computer: it gathers, builds in tech order, hires and raids,
//   paced by the campaign's difficulty (Easy / Normal / Hard change only its building speed and its raids)
// - victory and defeat: a scene, then play again on the next difficulty, or try again
// KR.Realm (js/realm.js) owns the economy; until it is loaded every building counts as built for the player.
// =====================================================================
(function () {
  const KR = window.KR; const { D, G, U, W } = KR; const Sys = KR.Sys, War = KR.War, A = KR.A;
  if (!War) return;
  const TS = D.TS;
  const sfx = (n, v) => { try { A && A.sfx && A.sfx(n, v == null ? 1 : v); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const mainRealm = () => !W.realm || W.realm === 'main';
  const acct = () => { const a = G.account; if (!a) return null; a.war = a.war || {}; return a.war; };
  const pf = () => (G.player && G.player.c ? G.player.c.faction : null);

  // ---------- difficulty: per hero campaign ----------
  D.DIFFICULTY = {
    easy: { name: 'Easy', build: 0.6, raidEvery: [35, 50], firstRaid: 30, raidMax: 4, huntEvery: [25, 35] },
    normal: { name: 'Normal', build: 1, raidEvery: [20, 30], firstRaid: 18, raidMax: 8, huntEvery: [14, 20] },
    hard: { name: 'Hard', build: 1.5, raidEvery: [12, 18], firstRaid: 10, raidMax: 14, huntEvery: [8, 12] },
  };
  D.DIFF_IDS = ['easy', 'normal', 'hard'];
  War.campaign = (c) => { c = c || (G.player && G.player.c); if (!c) return { difficulty: 'normal', wins: 0, losses: 0 }; c.campaign = c.campaign || {}; if (!D.DIFFICULTY[c.campaign.difficulty]) c.campaign.difficulty = 'normal'; c.campaign.wins = c.campaign.wins || 0; c.campaign.losses = c.campaign.losses || 0; return c.campaign; };
  War.difficulty = (c) => War.campaign(c).difficulty;
  War.diff = (c) => D.DIFFICULTY[War.difficulty(c)];
  War.setDifficulty = function (c, d) { if (!D.DIFFICULTY[d]) return; War.campaign(c).difficulty = d; try { localStorage.setItem('kr_diff_' + c.id, d); } catch (e) {} };
  // the title menu stores a choice for a hero who is not loaded: it is applied when the hero is
  { const lc0 = Sys.loadChar; if (lc0) Sys.loadChar = async function (id) { const c = await lc0.apply(this, arguments); try { const d = localStorage.getItem('kr_diff_' + id); if (c && D.DIFFICULTY[d]) War.campaign(c).difficulty = d; } catch (e) {} return c; }; }
  { const cs0 = Sys.charSummary; if (cs0) Sys.charSummary = function (c) { const s = cs0.apply(this, arguments); if (s && c) s.diff = War.difficulty(c); return s; }; }

  // ---------- buildings: what each side has (KR.Realm when it exists) ----------
  const B_IDS = ['sawmill', 'cutter', 'barracks', 'range', 'stable', 'workshop'];
  const cpuState = () => { const w = acct(); return w && w.cpu; };
  War.bLevel = function (f, id) {
    const R = KR.Realm;
    if (R && R.state) { try { const st = R.state(f); if (st && st.buildings) return st.buildings[id] || 0; } catch (e) {} }
    const cs = cpuState(); if (cs && cs.f === f && cs.b) return cs.b[id] || 0;
    return id === 'sawmill' || id === 'cutter' ? 3 : 1; // no economy loaded yet: everything is open
  };
  War.hasB = (f, id, lvl) => War.bLevel(f, id) >= (lvl || 1);
  War.defenses = function (f) {
    const R = KR.Realm; let st = null; if (R && R.state) { try { st = R.state(f); } catch (e) {} }
    const cs = cpuState(); if (!st && cs && cs.f === f) st = cs;
    if (!st) return { towers: 6, towerLvl: 1, walls: 1 };
    return { towers: st.towers || 0, towerLvl: st.towerLvl || 0, walls: st.walls || 0 };
  };
  // the kingdom's might (1-5), from its military buildings: soldiers and engines fight at this strength
  War.powerTier = (f) => 1 + ['barracks', 'range', 'stable', 'workshop'].filter((b) => War.hasB(f, b)).length;
  // stored levels are on the internal scale (D.LV maps the 1-20 the player sees): soldiers show as level 16-20
  D.CITY_TIER_LEVELS = [16, 17, 18, 19, 20].map((n) => (D.LV ? D.LV(n) : Math.round(1 + (n - 1) * 49 / 19)));
  Sys.cityTierLevel = (f) => D.CITY_TIER_LEVELS[U.clamp(War.powerTier(f), 1, 5) - 1];

  // ---------- recruits: what each building trains, paid in gold ----------
  // costs in copper (100 = 1 silver, 10000 = 1 gold)
  D.RECRUITS = {
    guard: { name: 'Town Guard', icon: '🛡', need: 'barracks', cost: 1500, cls: 'manatarms', guard: true, desc: 'Stands watch at your gates and fights anyone who attacks the town. Never leaves on a raid.' },
    manatarms: { need: 'barracks', cost: 2000 },
    pikeman: { need: 'barracks', cost: 2200 },
    priest: { need: 'barracks', cost: 2600 },
    knight: { need: 'barracks', cost: 3600 },
    longbowman: { need: 'range', cost: 2200 },
    musketeer: { need: 'range', cost: 3400 },
    cavalry: { need: 'stable', cost: 4800 },
    ram: { name: 'Battering Ram', icon: '🐏', need: 'workshop', cost: 9000, siege: 'ram', desc: 'Rolls at the head of your next war party and breaks the enemy gate in five blows.' },
    catapult: { name: 'Catapult', icon: '🪨', need: 'workshop', cost: 12000, siege: 'engine', desc: 'A great catapult inside your walls. Turns slowly, throws far.' },
    trebuchet: { name: 'Trebuchet', icon: '🏰', need: 'workshop', cost: 18000, siege: 'engine', desc: 'The longest reach of any engine, from inside your walls.' },
  };
  for (const k in D.SOLDIERS) if (D.RECRUITS[k]) { const S = D.SOLDIERS[k], R = D.RECRUITS[k]; Object.assign(R, { name: R.name || S.name, icon: R.icon || S.icon, desc: R.desc || S.desc, cls: k }); }
  D.ENGINE_MAX = { catapult: 2, trebuchet: 2 };
  War.hireCost = (f, cls) => (D.RECRUITS[cls] ? D.RECRUITS[cls].cost : 2000);
  War.ramCost = () => D.RECRUITS.ram.cost;
  // the barracks holds 8 soldiers, each further military building 4 more; guards are counted on their own
  War.maxRecruits = (f) => (War.hasB(f, 'barracks') ? 8 + 4 * ['range', 'stable', 'workshop'].filter((b) => War.hasB(f, b)).length : 0);
  War.guardMax = (f) => (War.hasB(f, 'barracks') ? 4 + 4 * War.defenses(f).walls : 0);
  const engines = (f) => { const w = acct(); if (!w) return {}; w.engines = w.engines || {}; return (w.engines[f] = w.engines[f] || { catapult: 0, trebuchet: 0 }); };
  War.engines = (f) => Object.assign({}, engines(f));
  const roster = (f) => War.roster(f);
  const soldiersOf = (f) => roster(f).filter((h) => !h.guard);
  War.guardCount = (f) => roster(f).filter((h) => h.guard).length;

  War.recruitTypes = function (f) {
    f = f || pf(); const out = [];
    for (const id in D.RECRUITS) {
      const R = D.RECRUITS[id]; const unlocked = War.hasB(f, R.need);
      let have = 0, max = 0;
      if (R.guard) { have = War.guardCount(f); max = War.guardMax(f); }
      else if (R.siege === 'ram') { have = War.ramCount(f); max = D.RAM.max; }
      else if (R.siege === 'engine') { have = engines(f)[id] || 0; max = D.ENGINE_MAX[id]; }
      else { have = soldiersOf(f).filter((h) => h.cls === id).length; max = War.maxRecruits(f); }
      const S = D.SOLDIERS[R.cls] || {};
      const bname = { barracks: 'Barracks', range: 'Archery Range', stable: 'Stable', workshop: 'Siege Workshop' }[R.need];
      out.push({ id, name: R.name, icon: R.icon, desc: R.desc, building: R.need, unlocked, locked: !unlocked, why: unlocked ? (have >= max ? 'No room for more.' : '') : `Build the ${bname} first.`, cost: R.cost, have, max, kind: R.guard ? 'guard' : R.siege ? 'siege' : 'soldier', role: S.ranged ? 'ranged' : S.healer ? 'healer' : S.mounted ? 'mounted' : R.siege ? 'siege' : 'melee' });
    }
    return out;
  };

  // one recruit: payer is the hero's purse (the player's kingdom) or the computer's treasury
  const hireOne = function (f, id, owner, quiet) {
    const R = D.RECRUITS[id]; if (!R || !mainRealm() && !R.siege) { /* soldiers report to the barracks in the main world */ }
    if (!R) return false;
    const p = G.player; const isPlayer = !!(p && p.c.faction === f && !owner);
    const fail = (msg) => { if (isPlayer && !quiet) { if (msg) G.log(msg, 'sys', '#ffb24a'); sfx('fail', 0.5); } return false; };
    if (!War.hasB(f, R.need)) return fail(`${R.name}: build the ${({ barracks: 'Barracks', range: 'Archery Range', stable: (D.FACTION_ARMY && D.FACTION_ARMY[f] ? D.FACTION_ARMY[f].stable : 'Stable'), workshop: 'Siege Workshop' })[R.need]} first.`);
    let full = false;
    if (R.guard) full = War.guardCount(f) >= War.guardMax(f);
    else if (R.siege === 'ram') full = War.ramCount(f) >= D.RAM.max;
    else if (R.siege === 'engine') full = (engines(f)[id] || 0) >= D.ENGINE_MAX[id];
    else full = soldiersOf(f).length >= War.maxRecruits(f);
    if (full) return fail(R.guard ? 'You have all the guards your walls can post. Upgrade your walls for more.' : R.siege ? `You have as many ${R.name}s as your town can hold.` : 'The barracks is full. Build more military buildings for room.');
    const cost = R.cost;
    if (isPlayer) { if (p.c.coins < cost) return fail(`Not enough gold: a ${R.name} costs ${G.fmtCoins(cost)}.`); p.c.coins -= cost; }
    else { const cs = cpuState(); if (cs && cs.f === f) { if (cs.gold < cost) return false; cs.gold -= cost; } }
    if (R.siege === 'ram') { const w = acct(); w.rams = w.rams || {}; w.rams[f] = (w.rams[f] || 0) + 1; War.ev && War.ev({ k: 'rambought', f }); }
    else if (R.siege === 'engine') { engines(f)[id] = (engines(f)[id] || 0) + 1; War.refreshDefenses(f); }
    else {
      const F = D.FACTIONS[f]; const gender = Math.random() < 0.5 ? 'm' : 'f'; const NM = D.NAMES[f];
      const h = { id: Math.random().toString(36).slice(2, 8), cls: R.cls, gender, race: 'human', name: `${U.pick(NM[gender])} ${U.pick(NM.last)}`, owner: owner || (p ? p.c.name : F.king), raids: 0 };
      if (R.guard) h.guard = true;
      roster(f).push(h); if (mainRealm()) War.addGarrison(f, { cls: h.cls, hired: h });
      if (isPlayer && !quiet) G.log(`${h.name} the ${R.guard ? 'Town Guard' : D.SOLDIERS[R.cls].name} joins ${R.guard ? 'the watch' : 'the barracks'} for ${G.fmtCoins(cost)}.`, 'sys', '#9affb8');
    }
    if (isPlayer && !quiet) { sfx('coin'); if (R.siege) G.log(`The ${R.name} is ready (${G.fmtCoins(cost)}).`, 'sys', '#9affb8'); }
    Sys.saveAccount && Sys.saveAccount(true); if (isPlayer) { Sys.save && Sys.save(true); KR.UI.isOpen && KR.UI.isOpen('barracks') && War.renderBarracks(KR.UI.wins.barracks); KR.UI.refresh && KR.UI.refresh(); }
    War.emit('army', { f });
    return true;
  };
  // War.hire(f, type, n) for the Kingdom panel; the older War.hire(cls, f, owner, quiet) still works
  War.hire = function (a, b, c, d) {
    if (D.FACTION_IDS.includes(a)) { const n = Math.max(1, Math.round(+c || 1)); let k = 0; for (let i = 0; i < n; i++) { if (!hireOne(a, b, null, i > 0)) break; k++; } return k; }
    return hireOne(b || pf(), a, c, d) ? 1 : 0;
  };
  War.buyRam = (f) => War.hire(f || pf(), 'ram', 1) > 0;
  War.dismiss = function (f, rosterId) {
    const ros = roster(f); const i = ros.findIndex((h) => h.id === rosterId); if (i < 0 || ros[i].out) return false;
    ros.splice(i, 1); War.fillGarrison(f); Sys.saveAccount && Sys.saveAccount(true); War.emit('army', { f }); return true;
  };
  // set the number of town guards: hires (in gold) or dismisses down to n
  War.setGuards = function (f, n) {
    n = U.clamp(Math.round(n), 0, War.guardMax(f)); let have = War.guardCount(f);
    while (have > n) { const h = roster(f).filter((x) => x.guard).pop(); War.dismiss(f, h.id); have--; }
    let k = 0; while (have < n && hireOne(f, War.guardId ? War.guardId(f) : 'guard', null, k > 0)) { have++; k++; }
    return War.guardCount(f);
  };
  War.army = function (f) {
    f = f || pf(); const ros = roster(f); const sol = {};
    for (const h of ros) { if (h.guard) continue; const s = (sol[h.cls] = sol[h.cls] || { home: 0, out: 0 }); if (h.out) s.out++; else s.home++; }
    const out = ros.filter((h) => !h.guard && h.out).length, total = ros.filter((h) => !h.guard).length;
    const atWar = War.squads.some((s) => s.f === f && s.members.some((m) => !m.dead));
    const E2 = War.engines(f);
    // the readable lines show in the Kingdom panel's Status card; the details are there for code (not listed)
    const view = { 'Soldiers ready': `${total - out} / ${War.maxRecruits(f)}`, 'At war': out, 'Town guards': `${War.guardCount(f)} / ${War.guardMax(f)}`, 'Battering rams': War.ramCount(f), 'Siege engines': (E2.catapult || 0) + (E2.trebuchet || 0) };
    const data = { soldiers: sol, total, home: total - out, out, max: War.maxRecruits(f), guards: War.guardCount(f), guardMax: War.guardMax(f), rams: War.ramCount(f), engines: E2, defenses: War.defenses(f), atWar, upkeep: 0, tier: War.powerTier(f), level: Sys.cityTierLevel(f) };
    for (const k in data) Object.defineProperty(view, k, { value: data[k], enumerable: false });
    return view;
  };
  // the Status panel's order: the war party marches (behind the ram, if you have one). You may go with them or not.
  War.orderAttack = function (f, opts) {
    f = f || pf(); opts = opts || {};
    if (!mainRealm()) { if (f === pf()) G.log('Your soldiers can only march while you are in the kingdom lands.', 'sys', '#ffb24a'); return 0; }
    if (War.squads.some((s) => s.f === f && !s.hunt && s.members.some((m) => !m.dead))) { if (f === pf()) G.log('Your war party is already on the march.', 'sys', '#ffb24a'); return 0; }
    return War.launchRaid(f, !!opts.quiet, { max: opts.max });
  };
  // guards are posted at the gates and never march; a raid can be capped in size (the computer's raids are)
  const lr0 = War.launchRaid;
  War.launchRaid = function (f, quiet, opts) {
    if (mainRealm()) War.fillGarrison(f);
    const g0 = War.garrison, fg0 = War.fillGarrison; const max = opts && opts.max;
    War.garrison = function (ff) { let list = g0(ff).filter((m) => !m.guardPost); if (ff === f && max) list = list.slice(0, max); return list; };
    War.fillGarrison = () => {}; // already filled above; with guards hidden it would post them twice
    try { return lr0.call(this, f, quiet); } finally { War.garrison = g0; War.fillGarrison = fg0; }
  };
  // guards wait at the gates instead of the barracks, and go for any enemy who comes near
  const ag0 = War.addGarrison;
  // where soldiers muster when the town has no barracks building standing (yet): the Town Hall square
  const musterSpot = function (f) {
    const cd = W.cityData[f]; if (!cd) return null;
    // a barracks building that stands in the world is the muster point; otherwise just inside the gate facing the enemy
    let s = War.barracksOf(f) && cd.barracks;
    if (!s) { const bg = War.bestGates(f, War.enemyOf(f)); const gs = (cd.gates || []).slice().sort((p1, p2) => (bg ? Math.hypot(p1[0] - bg.a[0], p1[1] - bg.a[1]) - Math.hypot(p2[0] - bg.a[0], p2[1] - bg.a[1]) : 0)); const g = gs[0];
      s = g ? [g[0] + Math.sign(cd.cx - g[0]) * 5, g[1] + Math.sign(cd.cy - g[1]) * 5] : [cd.cx, cd.cy + 3]; }
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const tx = s[0] + dx, ty = s[1] + dy; if (!W.isBlockedTile(tx, ty)) return [tx, ty]; }
    return s;
  };
  War.fillGarrison = function (f) {
    if (!mainRealm() || !W.cityData[f]) return;
    const ros = War.roster(f);
    for (const m of War.garrison(f)) { const h = ros.find((x) => x.id === m.hiredId); if (!h || h.out) G.remove(m); }
    const have = new Set(War.garrison(f).map((m) => m.hiredId).concat(G.ents.filter((e) => e.raider && e.hunt && e.faction === f && !e.dead && !e.removed).map((e) => e.hiredId)));
    for (const h of ros) if (!h.out && !have.has(h.id)) War.addGarrison(f, { cls: h.cls, hired: h });
  };
  War.addGarrison = function (f, want) {
    let m = ag0.apply(this, arguments);
    if (!m && mainRealm() && W.cityData[f]) {
      const [tx, ty] = musterSpot(f); const n = War.garrison(f).length;
      m = War.makeSoldier(f, want.cls, tx * TS + 16 + ((n % 5) - 2) * 20, ty * TS + 16 + (Math.floor(n / 5) % 3) * 20, Sys.cityTierLevel(f), want.hired ? Object.assign({ owner: want.hired.owner }, want.hired) : null);
      m.warState = 'garrison'; m.squad = null; m.hiredId = want.hired ? want.hired.id : null; m.sit = false;
    }
    if (m && want && want.hired && want.hired.guard) {
      const cd = W.cityData[f]; const posts = (cd && cd.gates) || []; const mine = roster(f).filter((h) => h.guard); const i = Math.max(0, mine.indexOf(want.hired));
      const g = posts[i % Math.max(1, posts.length)];
      if (g) { const dx = Math.sign(cd.cx - g[0]), dy = Math.sign(cd.cy - g[1]); const side = (Math.floor(i / Math.max(1, posts.length)) % 2 ? 1 : -1) * (1 + Math.floor(i / (2 * Math.max(1, posts.length))));
        let tx = g[0] + dx * 2 + (dy ? side : 0), ty = g[1] + dy * 2 + (dx ? side : 0);
        if (W.isBlockedTile(tx, ty)) { tx = g[0] + dx * 3; ty = g[1] + dy * 3; }
        m.x = m.homeX = tx * TS + 16; m.y = m.homeY = ty * TS + 16; }
      m.guardPost = true; m.sit = false; m.title = `${D.FACTIONS[f].city} Town Guard`;
    }
    return m;
  };
  const ur0 = War.updateRaider;
  War.updateRaider = function (r, dt) {
    if (r.hunt && !r.dead) return huntTick(r, dt);
    if (!r.dead && !r.squad && r.warState !== 'garrison' && r.warState !== 'mustering') r.warState = 'garrison'; // a soldier with no orders waits where he stands
    if (r.guardPost && !r.dead && r.warState === 'garrison') {
      r.gScan = (r.gScan || Math.random()) - dt;
      if (r.gScan <= 0) { r.gScan = 0.7; let best = null, bd = 300; for (const o of G.ents) { if (o === r || !War.isFoe(r.faction, o) || o.siege) continue; const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; best = o; } } const p = G.player; if (p && War.isFoe(r.faction, p) && Math.hypot(p.x - r.x, p.y - r.y) < bd) best = p; if (best) G.addHate(r, best, 5); }
    }
    return ur0.apply(this, arguments);
  };
  // workers in the woods and quarries are fair game for the enemy's soldiers (wild monsters leave them be)
  War.isWorker = (e) => !!(e && !e.dead && !e.removed && (e.worker || e.realmWorker || e.role === 'arborist' || e.role === 'miner'));
  const foe0 = War.isFoe;
  War.isFoe = function (f, e) { if (War.isWorker(e)) { const ef = e.faction || e.city; return !!ef && ef !== f; } return foe0.apply(this, arguments); };
  // re-raise the defenses of a city after engines or towers change (the economy calls this after building too)
  let refT = {};
  War.refreshDefenses = function (f) { if (!mainRealm()) return; clearTimeout(refT[f]); refT[f] = setTimeout(() => { try { Sys.spawnCity(f); } catch (e) { console.warn(e); } }, 60); };
  // what defends the city now comes from what was built and bought, not from a Kingdom Level
  const sdR = War.spawnDefenses;
  War.spawnDefenses = function (f, mk) {
    const df = War.defenses(f); const E = engines(f);
    const towerKind = (War.towerKinds ? War.towerKinds(f) : ['archer', 'ballista', 'heavyballista'])[U.clamp(df.towerLvl || 0, 0, 2)];
    let inside = []; for (let i = 0; i < (E.trebuchet || 0); i++) inside.push('trebuchet'); for (let i = 0; i < (E.catapult || 0); i++) inside.push('catapult');
    if (War.insideKinds) inside = War.insideKinds(f, E); // each kingdom's own engines (faction armies, below)
    const byT = D.SIEGE_BY_TIER, ins = D.SIEGE_INSIDE;
    D.SIEGE_BY_TIER = [0, 1, 2, 3, 4].map(() => [towerKind, towerKind]); D.SIEGE_INSIDE = [0, 1, 2, 3, 4].map(() => inside);
    const before = new Set(G.ents);
    try { sdR.apply(this, arguments); } finally { D.SIEGE_BY_TIER = byT; D.SIEGE_INSIDE = ins; }
    // only as many gate towers as the kingdom has bought (each with the guard posted beside it)
    const made = G.ents.filter((e) => !before.has(e)); const towers = made.filter((e) => e.siege && !e.big && e.faction === f); const tg = made.filter((e) => e.towerGuard);
    const want = U.clamp(df.towers || 0, 0, towers.length);
    towers.forEach((t, i) => { if (i < want) return; G.remove(t); const g = tg.find((x) => !x.removed && Math.hypot(x.x - t.x, x.y - t.y) < 3 * TS); if (g) G.remove(g); });
  };

  // ---------- what your side can see: your soldiers, guards, towers and you ----------
  War.SIGHT = { raider: 12 * TS, guard: 10 * TS, tower: 14 * TS, player: 14 * TS };
  War.spotted = function (f) {
    f = f || pf(); const eyes = [];
    for (const e of G.ents) { if (e.dead || e.removed || e.faction !== f) continue; if (e.raider) eyes.push([e.x, e.y, War.SIGHT.raider]); else if (e.siege) eyes.push([e.x, e.y, War.SIGHT.tower]); else if (e.type === 'guard' || e.type === 'king') eyes.push([e.x, e.y, War.SIGHT.guard]); }
    const p = G.player; if (p && p.c.faction === f && !p.dead) eyes.push([p.x, p.y, War.SIGHT.player]);
    const out = [];
    for (const e of G.ents) {
      if (e.dead || e.removed || !(e.raider || e.rivalHero || e.ram) || !e.faction || e.faction === f) continue;
      if (eyes.some(([x, y, r]) => Math.hypot(e.x - x, e.y - y) <= r)) out.push({ x: e.x, y: e.y, tx: Math.floor(e.x / TS), ty: Math.floor(e.y / TS), name: e.name, kind: e.rivalHero ? 'hero' : e.ram ? 'ram' : e.soldier || 'soldier', hunt: !!e.hunt, e });
    }
    return out;
  };
  // your own forces on the map: war parties, hunters, the ram
  War.forces = function (f) {
    f = f || pf(); const out = [];
    for (const e of G.ents) if (!e.dead && !e.removed && e.faction === f && e.raider && e.warState !== 'garrison') out.push({ x: e.x, y: e.y, tx: Math.floor(e.x / TS), ty: Math.floor(e.y / TS), name: e.name, kind: e.ram ? 'ram' : e.soldier || 'soldier', state: e.warState, e });
    return out;
  };

  // ---------- tiny event hub for the Kingdom panel ----------
  const subs = {};
  War.on = (k, fn) => { (subs[k] = subs[k] || []).push(fn); };
  War.emit = (k, o) => { for (const fn of subs[k] || []) { try { fn(o); } catch (e) { console.warn(e); } } };

  // =====================================================================
  // the enemy kingdom, run by the computer
  // =====================================================================
  // fallback prices and build times when KR.Realm is not loaded (it owns the real ones)
  const COST = {
    sawmill: [{ wood: 150, stone: 50 }, { wood: 350, stone: 180 }, { wood: 700, stone: 400 }],
    cutter: [{ wood: 80, stone: 140 }, { wood: 200, stone: 350 }, { wood: 450, stone: 700 }],
    barracks: [{ wood: 400, stone: 300 }], range: [{ wood: 550, stone: 300 }], stable: [{ wood: 650, stone: 500 }], workshop: [{ wood: 900, stone: 800 }],
    walls: [{ wood: 600, stone: 300 }, { wood: 300, stone: 1200 }], tower: [{ wood: 160, stone: 260 }], towerUp: [{ wood: 400, stone: 600 }, { wood: 600, stone: 1000 }],
  };
  const costOf = (id, lvl) => { const R = KR.Realm; if (R && R.cost) { try { const c = R.cost(id, lvl); if (c) return c; } catch (e) {} } const t = COST[id]; return t ? t[U.clamp(lvl - 1, 0, t.length - 1)] : { wood: 999, stone: 999 }; };
  // the computer's order of play: mills first, then the barracks, then outward
  D.CPU_PLAN = ['sawmill', 'cutter', 'barracks', 'sawmill', 'cutter', 'range', 'tower', 'tower', 'walls', 'tower', 'tower', 'sawmill', 'cutter', 'stable', 'towerUp', 'tower', 'tower', 'workshop', 'walls', 'towerUp'];
  // base income per minute at Normal (wood and stone from its workers, gold from its lands), more with each mill level
  D.CPU_RATE = { wood: 40, stone: 40, perMill: 22, gold: 450, goldPerB: 160 };
  War.cpuFaction = () => { const f = pf(); return f ? War.enemyOf(f) : null; };
  War.cpu = function () {
    const w = acct(); const ef = War.cpuFaction(); if (!w || !ef) return null;
    if (!w.cpu || w.cpu.f !== ef) w.cpu = { f: ef, t: 0, wood: 60, stone: 60, gold: 0, b: {}, towers: 0, towerLvl: 0, walls: 0, plan: 0, busy: null, nextRaid: null, nextHunt: null, log: [] };
    return w.cpu;
  };
  const cpuRealm = (cs) => { const R = KR.Realm; if (!R || !R.state) return null; try { return R.state(cs.f) || null; } catch (e) { return null; } };
  // run the computer's kingdom for dt seconds of play (also used by tests to fast-forward)
  War.cpuStep = function (dt) {
    const cs = War.cpu(); if (!cs) return; const Df = War.diff(); const k = Df.build; const st = cpuRealm(cs);
    cs.t += dt; const mins = dt / 60;
    // income: with KR.Realm the computer hires its own court and workers, who gather like yours; the difficulty
    // speeds that up or slows it down. Without KR.Realm its income is counted here.
    const R = KR.Realm; const res = st || cs;
    if (st) {
      if (!st.liaison && R.hireLiaison) { try { R.hireLiaison(cs.f); } catch (e) {} }
      for (const wk of ['arborist', 'miner']) if (!st.workers[wk].hired && R.hireWorker) { try { R.hireWorker(cs.f, wk); } catch (e) {} }
      const rt = R.rates ? R.rates(cs.f) : { wood: 0, stone: 0 };
      res.wood = Math.max(0, res.wood + (k - 1) * (rt.wood || 0) * mins); res.stone = Math.max(0, res.stone + (k - 1) * (rt.stone || 0) * mins);
      // a small allowance besides the workers (the brother's lands), so a hunted-down workforce does not stall him for good
      res.wood += 8 * k * mins; res.stone += 8 * k * mins;
    } else { res.wood = (res.wood || 0) + (D.CPU_RATE.wood + D.CPU_RATE.perMill * War.bLevel(cs.f, 'sawmill')) * k * mins; res.stone = (res.stone || 0) + (D.CPU_RATE.stone + D.CPU_RATE.perMill * War.bLevel(cs.f, 'cutter')) * k * mins; }
    cs.gold += (D.CPU_RATE.gold + D.CPU_RATE.goldPerB * ['barracks', 'range', 'stable', 'workshop'].filter((b) => War.hasB(cs.f, b)).length) * k * mins;
    // building: one thing at a time, in plan order
    if (st) realmBuild(cs, st, k);
    else if (cs.busy) { cs.busy.t -= dt * k; if (cs.busy.t <= 0) { finish(cs, cs.busy); cs.busy = null; } }
    else if (cs.plan < D.CPU_PLAN.length) {
      const id = D.CPU_PLAN[cs.plan];
      const lvl = id === 'tower' ? 1 : id === 'towerUp' ? (War.defenses(cs.f).towerLvl || 0) + 1 : id === 'walls' ? (War.defenses(cs.f).walls || 0) + 1 : War.bLevel(cs.f, id) + 1;
      const c = costOf(id === 'towerUp' ? 'towerUp' : id, lvl);
      if (res.wood >= c.wood && res.stone >= c.stone) {
        let started = false;
        if (st && KR.Realm.build && B_IDS.includes(id)) { try { started = !!(War.bLevel(cs.f, id) ? (KR.Realm.upgrade || KR.Realm.build)(cs.f, id) : KR.Realm.build(cs.f, id)); } catch (e) { started = false; } if (started) { cs.plan++; note(cs, id, lvl); } }
        if (!started) { res.wood -= c.wood; res.stone -= c.stone; cs.busy = { id, lvl, t: id === 'tower' ? 45 : id === 'towerUp' || id === 'walls' ? 120 : 90 + 30 * lvl }; cs.plan++; }
      }
    }
    // the army grows with its buildings
    if (War.hasB(cs.f, 'barracks') && mainRealm()) {
      cs.hireT = (cs.hireT || 0) - dt;
      if (cs.hireT <= 0) {
        cs.hireT = 40 / k;
        const opts = War.recruitTypes(cs.f).filter((r) => r.unlocked && r.have < r.max && r.cost <= cs.gold);
        const pick = opts.find((r) => (r.id === 'ram' || r.ramLike) && !r.have) || opts.find((r) => r.kind === 'guard' && r.have < Math.min(r.max, 4)) || opts.find((r) => r.kind === 'siege' && r.id !== 'ram' && !r.ramLike && !r.have && cs.t > 40 * 60)
          || U.pick(opts.filter((r) => r.kind === 'soldier')) || null;
        if (pick) hireOne(cs.f, pick.id, D.FACTIONS[cs.f].king, true);
      }
    }
  };
  // with KR.Realm: the computer follows the same plan through the same construction yards (one job at a time)
  const RID = { tower: 'towers', walls: 'walls' };
  War.cpuTimeMul = 1; // tests shorten construction with this
  function realmBuild(cs, st, k) {
    const R = KR.Realm; if (st.construction.length) return;
    if (!cs.queue) cs.queue = D.CPU_PLAN.filter((x) => x !== 'towerUp').map((x) => RID[x] || x); // towers have no grades in the realm
    for (let i = 0; i < cs.queue.length; i++) {
      const id = cs.queue[i]; const ok = R.can(cs.f, id);
      if (ok.max) { cs.queue.splice(i, 1); i--; continue; } // already done
      if (ok.locked || ok.building) continue; // its prerequisite comes first: try the next thing on the list
      if (!ok.ok) return; // saving up for it
      if (R.build(cs.f, id, { quiet: true, timeMul: War.cpuTimeMul / k })) { cs.queue.splice(i, 1); note(cs, id, ok.lvl); }
      return;
    }
  }
  function note(cs, id, lvl) {
    if (id === 'towers') id = 'tower'; const nm = { sawmill: 'Sawmill', cutter: 'Stone Cutter', barracks: 'Barracks', range: 'Archery Range', stable: (D.FACTION_ARMY && D.FACTION_ARMY[cs.f] ? D.FACTION_ARMY[cs.f].stable : 'Stable'), workshop: 'Siege Workshop', walls: 'walls', tower: 'archer tower', towerUp: 'towers' }[id] || id;
    cs.log.push({ id, lvl, t: Math.round(cs.t) }); if (cs.log.length > 40) cs.log.shift();
    const E = D.FACTIONS[cs.f]; const msg = id === 'tower' ? `Scouts report a new archer tower on the walls of ${E.city}.` : id === 'walls' ? `${E.city} is raising stronger walls.` : id === 'towerUp' ? `${E.city} has strengthened its towers.` : lvl > 1 ? `${E.city} has upgraded its ${nm} (level ${lvl}).` : `${E.city} has built a ${nm}.`;
    if (['barracks', 'range', 'stable', 'workshop'].includes(id) || id === 'walls') G.log(`Word from the front: ${msg}`, 'status', '#ffb0a0');
  }
  function finish(cs, job) {
    const { id, lvl } = job;
    if (id === 'tower') cs.towers = (cs.towers || 0) + 1; else if (id === 'towerUp') cs.towerLvl = lvl; else if (id === 'walls') cs.walls = lvl; else cs.b[id] = lvl;
    note(cs, id, lvl);
    if (['tower', 'towerUp', 'walls'].includes(id) || ['barracks'].includes(id)) War.refreshDefenses(cs.f);
  }
  if (KR.Realm && KR.Realm.on) KR.Realm.on('built', (f, id) => { if (['towers', 'walls', 'barracks'].includes(id)) War.refreshDefenses(f); War.emit('army', { f }); });
  War.cpuReset = function () { const w = acct(); if (w) w.cpu = null; };
  War.cpuActive = function () {
    if (!G.player || !War.rivalActive()) return false;
    if (KR.Online && KR.Online.mode === 'join') return false; // the host runs the enemy for everyone
    return true;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  // raids on your town and hunts for your workers, paced by the difficulty
  War.cpuWarStep = function () {
    const cs = War.cpu(); if (!cs || !mainRealm()) return; const Df = War.diff(); const ef = cs.f, f = pf();
    if (!War.hasB(ef, 'barracks')) return;
    if (cs.nextRaid == null) cs.nextRaid = cs.t + Df.firstRaid * 60;
    if (cs.nextHunt == null) cs.nextHunt = cs.t + rand(Df.huntEvery[0], Df.huntEvery[1]) * 60;
    const away = War.squads.some((s) => s.f === ef && !s.hunt && s.members.some((m) => !m.dead));
    const home = War.garrison(ef).filter((m) => !m.guardPost).length;
    if (cs.t >= cs.nextRaid) {
      if (!away && home >= Math.min(3, Df.raidMax)) { War.launchRaid(ef, false, { max: Df.raidMax }); cs.raids = (cs.raids || 0) + 1; cs.nextRaid = cs.t + rand(Df.raidEvery[0], Df.raidEvery[1]) * 60; }
      else cs.nextRaid = cs.t + 3 * 60;
    }
    if (cs.t >= cs.nextHunt) { cs.nextHunt = cs.t + rand(Df.huntEvery[0], Df.huntEvery[1]) * 60; War.huntWorkers(ef, f); }
  };
  War.rivalTick = function () { /* the old rival's recruiting and raids are now the computer kingdom's (cpuStep / cpuWarStep) */ };
  let cpuAcc = 0;
  const tick0 = War.tick;
  War.tick = function (dt) {
    tick0.apply(this, arguments);
    if (!War.cpuActive()) return;
    cpuAcc += dt; if (cpuAcc < 1) return; const step = cpuAcc; cpuAcc = 0;
    try { War.cpuStep(step); War.cpuWarStep(); } catch (e) { console.warn('cpu kingdom', e); }
  };

  // ---------- hunting parties: a few soldiers (and sometimes the enemy hero) go after your workers ----------
  War.workersOf = (f) => G.ents.filter((e) => War.isWorker(e) && (e.faction || e.city) === f);
  War.huntWorkers = function (ef, f) {
    const targets = War.workersOf(f); if (!targets.length) return 0;
    const tgt = U.pick(targets); const pool = War.garrison(ef).filter((m) => !m.guardPost && !m.hunt);
    const n = Math.min(pool.length, 2 + (Math.random() < 0.5 ? 1 : 0)); let sent = 0;
    const from = [Math.floor((pool[0] || {}).x / TS) || W.cityData[ef].cx, Math.floor((pool[0] || {}).y / TS) || W.cityData[ef].cy];
    const path = n ? W.findPathLong(from[0], from[1], Math.floor(tgt.x / TS), Math.floor(tgt.y / TS), 300000, { door: 'pass', roads: true }) : null;
    for (let i = 0; i < n && path; i++) { const m = pool[i]; m.hunt = { tgt, path, i: 0, until: G.now + 6 * 60000, home: [m.x, m.y] }; m.warState = 'hunt'; m.sit = false; m.hate.clear(); m.inCombat = false; const h = roster(ef).find((x) => x.id === m.hiredId); if (h) h.out = true; sent++; }
    // the enemy's hero joins the hunt now and then
    const hero = G.ents.find((x) => x.rivalHero && !x.dead && !x.removed);
    if (hero && Math.random() < 0.35) { hero.huntTgt = tgt; hero.rally = [tgt.x, tgt.y]; hero.rallyUntil = G.now + 4 * 60000; hero.leash = 1e9; sent++; }
    if (sent && f === pf()) { const seen = War.spotted(f).some((s) => s.hunt); if (seen) G.log(`Enemy soldiers have been seen heading for your ${tgt.role === 'miner' || tgt.miner ? 'miner' : 'workers'}!`, 'status', '#ff9a6a'); }
    return sent;
  };
  // doors on the way stand open for them (doors far from the hero are not animated)
  const openDoor = (tx, ty) => { const d = W.doorAt && W.doorAt[ty * W.W + tx]; if (d && !d.locked) { d.want = 1; d.last = G.now; if (G.player && Math.hypot(tx * TS - G.player.x, ty * TS - G.player.y) > 900) d.open = 1; } };
  function huntTick(r, dt) {
    const H = r.hunt;
    if (r.delayT > 0) { r.delayT -= dt; return; }
    G.statusTick(r, dt); if (r.stun > 0 || r.root > 0 || r.mez > 0) { r.moving = false; return; }
    const backHome = () => { H.back = true; H.tgt = null; r.hate.clear(); r.inCombat = false; if (!H.rpath) { const hx = Math.floor(H.home[0] / TS), hy = Math.floor(H.home[1] / TS); H.rpath = W.findPathLong(Math.floor(r.x / TS), Math.floor(r.y / TS), hx, hy, 300000, { door: 'pass', roads: true }) || []; H.ri = 0; } };
    // fight whoever is on top of the hate list (workers, guards, the hero)
    const tg = r.inCombat ? G.topHate(r) : null;
    if (tg && !tg.dead && !tg.removed) { const d = Math.hypot(tg.x - r.x, tg.y - r.y); if (d < (r.ranged ? 300 : G.meleeRange(r, tg) + 4)) { r.leash = 1e9; G.updateMob(r, dt); r.returning = false; return; } G.chase(r, tg, dt, 1); return; }
    if (!H.back) {
      if (G.now > H.until) backHome();
      else {
        if (!H.tgt || !War.isWorker(H.tgt)) { let best = null, bd = 30 * TS; for (const w of War.workersOf(War.enemyOf(r.faction))) { const d = Math.hypot(w.x - r.x, w.y - r.y); if (d < bd) { bd = d; best = w; } } H.tgt = best; if (!best) backHome(); }
        if (H.tgt) {
          const d = Math.hypot(H.tgt.x - r.x, H.tgt.y - r.y);
          if (d < 8 * TS) { G.addHate(r, H.tgt, 10); G.chase(r, H.tgt, dt, 1); return; }
          while (H.i < H.path.length - 1 && Math.hypot(H.path[H.i][0] * TS + 16 - r.x, H.path[H.i][1] * TS + 16 - r.y) < 22) H.i++;
          const [px, py] = H.path[Math.min(H.i, H.path.length - 1)]; openDoor(px, py); G.chase(r, { x: px * TS + 16, y: py * TS + 16 }, dt, 1); return;
        }
      }
    }
    if (H.back) {
      const rp = H.rpath || [];
      while (H.ri < rp.length - 1 && Math.hypot(rp[H.ri][0] * TS + 16 - r.x, rp[H.ri][1] * TS + 16 - r.y) < 22) H.ri++;
      if (!rp.length || (H.ri >= rp.length - 1 && Math.hypot(H.home[0] - r.x, H.home[1] - r.y) < 40)) { r.hunt = null; r.warState = 'garrison'; r.moving = false; const h = roster(r.faction).find((x) => x.id === r.hiredId); if (h) h.out = false; return; }
      const [px, py] = rp[Math.min(H.ri, rp.length - 1)]; openDoor(px, py); G.chase(r, { x: px * TS + 16, y: py * TS + 16 }, dt, 1);
    }
  }
  // the enemy hero fights what it came for, then goes back to its streets
  const urh = War.updateRivalAvatar;
  War.updateRivalAvatar = function () { const r = urh.apply(this, arguments); const e = G.ents.find((x) => x.rivalHero && !x.removed); if (e && e.huntTgt) { if (!War.isWorker(e.huntTgt) || G.now > (e.rallyUntil || 0)) { e.huntTgt = null; e.rally = null; } else if (Math.hypot(e.huntTgt.x - e.x, e.huntTgt.y - e.y) < 6 * TS) G.addHate(e, e.huntTgt, 10); } return r; };

  // ---------- the barracks window: everything this kingdom can raise ----------
  War.renderBarracks = function (w) {
    const p = G.player, c = p.c, f = c.faction, b = w.body; const A2 = War.army(f); const ef = War.enemyOf(f), E = D.FACTIONS[ef];
    const bn = { barracks: 'Barracks', range: 'Archery Range', stable: (D.FACTION_ARMY && D.FACTION_ARMY[f] ? D.FACTION_ARMY[f].stable : 'Stable'), workshop: 'Siege Workshop' };
    const R = War.rivalActive() ? War.rival() : null;
    b.innerHTML = `<p class="hint">Recruit with gold. Soldiers wait in the barracks until you order an attack on ${esc(E.city)} (here or in the Kingdom panel). Guards stay at your gates. Soldiers fight at <b>level ${D.shown(A2.level)}</b>.</p>
      <div class="row bk-send"><button class="btn gold" id="bk-go" ${A2.home && !A2.atWar ? '' : 'disabled'}>⚔ Order the attack (${A2.home})</button>${A2.atWar ? '<button class="btn" id="bk-recall">Sound the retreat</button>' : ''}</div>
      <h4 class="abh">Your army <small class="dim">${A2.total} of ${A2.max} soldiers · ${A2.guards} of ${A2.guardMax} guards · ${A2.rams} ram${A2.rams === 1 ? '' : 's'}</small></h4><div class="bk-ros"></div>
      <h4 class="abh">Recruit <small class="dim">you have ${G.fmtCoins(c.coins)}</small></h4><div class="bk-hire"></div>
      ${R ? `<h4 class="abh">Your rival</h4><p class="hint"><b>${esc(R.name)}</b>, level ${D.shown(R.level)} ${D.CLASSES[R.cls].name}, fights for ${esc(E.city)}. Difficulty: <b>${War.diff().name}</b>.</p>` : ''}
      <h4 class="abh">Victory</h4><p class="hint">Slay ${esc(E.king)} in the Town Hall of ${esc(E.city)}, yourself or with your war party, to win the war.</p>`;
    const go = b.querySelector('#bk-go'); if (go) go.onclick = () => { War.orderAttack(f); KR.UI.close('barracks'); };
    const rc = b.querySelector('#bk-recall'); if (rc) rc.onclick = () => { War.recall(f); War.renderBarracks(w); };
    const rl = b.querySelector('.bk-ros'); const ros = roster(f);
    if (!ros.length) rl.innerHTML = '<p class="empty-note">No soldiers yet. Recruit some below.</p>';
    ros.forEach((h) => {
      const S = D.SOLDIERS[h.cls]; const row = document.createElement('div'); row.className = 'row-item';
      row.innerHTML = `<span class="ic">${h.guard ? '🛡' : S.icon}</span><div class="ri-m"><b>${esc(h.name)}</b><small>${h.guard ? 'Town Guard' : S.name} · ${h.out ? '<span style="color:#ff9a6a">away</span>' : h.guard ? 'at the gates' : 'in the barracks'}</small></div>`;
      if (!h.out) { const bt = document.createElement('button'); bt.className = 'btn small'; bt.textContent = 'Dismiss'; bt.onclick = () => KR.UI.confirm(`Dismiss ${h.name}? You will not get the gold back.`, () => { War.dismiss(f, h.id); War.renderBarracks(w); }); row.appendChild(bt); }
      rl.appendChild(row);
    });
    const hl = b.querySelector('.bk-hire');
    for (const r of War.recruitTypes(f)) {
      const row = document.createElement('div'); row.className = 'row-item' + (r.unlocked ? '' : ' locked');
      row.innerHTML = `<span class="ic">${r.icon}</span><div class="ri-m"><b>${esc(r.name)}</b><small>${r.unlocked ? G.fmtCoins(r.cost) : 'Needs the ' + bn[r.building]} · ${r.role} · ${r.have}/${r.max}</small><small class="dim">${esc(r.desc || '')}</small></div>`;
      if (r.unlocked) { const bt = document.createElement('button'); bt.className = 'btn gold small'; bt.textContent = r.kind === 'siege' ? 'Build' : 'Recruit'; bt.disabled = c.coins < r.cost || r.have >= r.max; bt.onclick = () => { War.hire(f, r.id, 1); War.renderBarracks(w); }; row.appendChild(bt); }
      hl.appendChild(row);
    }
  };

  // ---------- victory and defeat ----------
  const nextDiff = (d) => D.DIFF_IDS[Math.min(D.DIFF_IDS.length - 1, D.DIFF_IDS.indexOf(d) + 1)];
  // a new campaign: both kingdoms and the computer start over; the hero keeps level, gear and coin
  const na0 = War.newAge;
  War.newAge = function () {
    const w = acct(); if (w) { w.rams = {}; w.engines = {}; w.roster = {}; }
    War.squads = []; War.cpuReset();
    const R = KR.Realm; const a = G.account;
    for (const f of D.FACTION_IDS) {
      if (R && R.reset) { try { R.reset(f); } catch (e) { console.warn(e); } }
      else if (a && a.cities && a.cities[f]) { a.cities[f].level = 1; a.cities[f].realm = null; } // a fresh realm (Town Hall only) for both brothers
    }
    return na0.apply(this, arguments);
  };
  // the speech, line by line, then the choice (no skipping)
  function speech(el, lines, done) { let i = 0; const next = () => { if (!el.isConnected) return; if (i >= lines.length) return done && done(); el.innerHTML = `<b>${esc(lines[i][0])}:</b> “${esc(lines[i][1])}”`; el.style.opacity = 0; requestAnimationFrame(() => { el.style.transition = 'opacity .6s'; el.style.opacity = 1; }); i++; setTimeout(next, Math.max(3200, lines[i - 1][1].length * 60)); }; next(); }
  const vs0 = War.victoryScene;
  War.victoryScene = function (k, byYou) {
    vs0.apply(this, arguments);
    const ov = document.querySelector('.vic-scene'); if (!ov) return; const c = G.player.c; const F = D.FACTIONS[c.faction], E = D.FACTIONS[k.faction];
    const go = ov.querySelector('.vic-go'); if (!go) return; go.style.display = 'none';
    const cp = War.campaign(c); const cur = cp.difficulty, nd = nextDiff(cur);
    const note = ov.querySelector('.vic-note'); if (note) note.textContent = `${cp.wins + 1 > 1 ? `Victory number ${cp.wins + 1}. ` : ''}Won on ${D.DIFFICULTY[cur].name}. You keep your hero, level, gear and gold.`;
    const sp = document.createElement('p'); sp.className = 'vic-lead vic-speech'; go.parentNode.insertBefore(sp, go);
    const lines = [[F.king, `${E.city} burns, and my brother's banners lie in the mud. You did this, ${c.name}.`], [F.king, `The walls we raised together held, and the army you built broke his gates.`], [F.king, `Rest a while, hero. Kings forget, and brothers bear grudges. There will be another war.`]];
    const row = document.createElement('div'); row.className = 'row vic-choice'; row.style.display = 'none'; row.style.gap = '10px';
    row.innerHTML = `<button class="btn gold big" id="vic-again">Play again on ${D.DIFFICULTY[nd].name}</button><button class="btn big" id="vic-stay">Keep playing</button>`;
    go.parentNode.insertBefore(row, go.nextSibling);
    speech(sp, lines, () => { row.style.display = 'flex'; });
    row.querySelector('#vic-again').onclick = () => { cp.wins++; War.setDifficulty(c, nd); go.click(); G.log(`A new war begins on ${D.DIFFICULTY[nd].name}.`, 'status', '#ffd84a'); };
    row.querySelector('#vic-stay').onclick = () => { cp.wins++; ov.remove(); KR.Main.setMusicOverride && KR.Main.setMusicOverride(null); Sys.save && Sys.save(true); };
  };
  // your own king falls to the enemy: defeat
  const ksw0 = Sys.kingSlainByWar;
  Sys.kingSlainByWar = function (k, killer) { const r = ksw0.apply(this, arguments); if (k && pf() && k.faction === pf() && killer && killer.faction !== pf()) setTimeout(() => War.defeat(k), 1200); return r; };
  War.defeat = function (k) {
    const p = G.player; if (!p) return; const c = p.c; const F = D.FACTIONS[c.faction], E = D.FACTIONS[War.enemyOf(c.faction)]; const cp = War.campaign(c);
    if (document.querySelector('.vic-scene')) return;
    for (const sq of War.squads.slice()) for (const m of sq.members.slice()) War.removeRaider(m); War.squads = [];
    KR.Main.setMusicOverride && KR.Main.setMusicOverride('defeat');
    const ov = document.createElement('div'); ov.className = 'vic-scene def-scene';
    ov.innerHTML = `<canvas class="vic-bg"></canvas><div class="vic-wrap"><div class="vic-text"><div class="vic-kicker">The war is lost</div><h1>Defeat</h1>
      <h2>${esc(F.city)} has fallen</h2><p class="vic-lead">${esc(k.name)} is slain in his own Town Hall, and the banners of ${esc(E.city)} fly over the ruins.</p>
      <p class="vic-lead vic-speech"></p><p class="vic-note">Lost on ${D.DIFFICULTY[cp.difficulty].name}. You keep your hero at level ${D.shown(c.level)}, with your gear and gold.</p>
      <div class="row vic-choice" style="display:none;gap:10px"><button class="btn gold big" id="def-again">Try again</button><button class="btn big" id="def-stay">Fight on</button></div></div></div>`;
    document.body.appendChild(ov);
    const bg = ov.querySelector('.vic-bg'), g = bg.getContext('2d'); const embers = []; const t0 = performance.now();
    const frame = (now) => { if (!ov.isConnected) return; const t = (now - t0) / 1000; const W2 = (bg.width = innerWidth), H2 = (bg.height = innerHeight);
      const grd = g.createLinearGradient(0, 0, 0, H2); grd.addColorStop(0, '#120404'); grd.addColorStop(0.6, '#3a0c06'); grd.addColorStop(1, '#7a2208'); g.fillStyle = grd; g.fillRect(0, 0, W2, H2);
      // the burning skyline and falling banners
      g.fillStyle = '#080202'; for (let i = 0; i < 14; i++) { const x = (i / 14) * W2, h = 80 + ((i * 53) % 120); g.fillRect(x, H2 - h, W2 / 14 - 6, h); }
      for (let i = 0; i < 6; i++) { const x = W2 * (0.1 + i * 0.16), y = Math.min(H2 - 160, ((t * 40 + i * 70) % (H2 + 200)) - 100); g.save(); g.translate(x, y); g.rotate(Math.sin(t + i) * 0.6); g.fillStyle = E.color || '#8a2a2a'; g.fillRect(-14, 0, 28, 46); g.restore(); }
      if (Math.random() < 0.9) embers.push({ x: Math.random() * W2, y: H2, vy: -(40 + Math.random() * 80), vx: (Math.random() - 0.5) * 30, life: 4 });
      g.globalCompositeOperation = 'lighter'; for (let i = embers.length - 1; i >= 0; i--) { const q = embers[i]; q.life -= 1 / 60; if (q.life <= 0) { embers.splice(i, 1); continue; } q.x += q.vx / 60; q.y += q.vy / 60; g.fillStyle = `rgba(255,${120 + Math.random() * 80},40,${q.life / 4})`; g.fillRect(q.x, q.y, 2, 2); } g.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    const lines = [[E.king, `Did you think stone walls would stop me, brother? ${F.city} is mine.`], [E.king, `Run back to the sea, ${c.name}. Tell them who rules now.`]];
    speech(ov.querySelector('.vic-speech'), lines, () => { ov.querySelector('.vic-choice').style.display = 'flex'; });
    const home = () => { const [hx, hy] = D.CITY_CENTER[c.faction]; p.x = hx * TS + 16; p.y = (hy + 3) * TS + 16; p.dead = false; p.hp = p.hpMax; c.bind = { x: p.x, y: p.y, realm: 'main' }; KR.Main.snapCamera && KR.Main.snapCamera(); };
    ov.querySelector('#def-again').onclick = () => { cp.losses++; ov.remove(); KR.Main.setMusicOverride && KR.Main.setMusicOverride(null); War.newAge(); home(); Sys.save && Sys.save(true); G.log(`The war begins again on ${D.DIFFICULTY[cp.difficulty].name}.`, 'status', '#ffd84a'); };
    ov.querySelector('#def-stay').onclick = () => { cp.losses++; ov.remove(); KR.Main.setMusicOverride && KR.Main.setMusicOverride(null); Sys.save && Sys.save(true); };
  };
})();

// =====================================================================
// Faction armies: Valenmoor fights like a medieval kingdom with black powder (halberdier guards, men-at-arms,
// pikemen, crossbowmen, handgunners, knights; battering rams, cannons and great bombards), Aelindor with elven
// wild might (warden guards, elven blades, spearmen, longbows, druids; troll giants that pound the gates down,
// ballistas and great ballistas). Big units march out on a wide lane so nothing scrapes walls, houses or lamps.
// =====================================================================
(function () {
  const KR = window.KR; const { D, G, U, W } = KR; const Sys = KR.Sys, War = KR.War;
  if (!War || !D.RECRUITS || !D.SOLDIERS) return;
  const TS = D.TS;
  const pf = () => (G.player && G.player.c ? G.player.c.faction : null);
  const acct = () => { const a = G.account; if (!a) return null; a.war = a.war || {}; return a.war; };

  // ---- soldiers ----
  Object.assign(D.SOLDIERS.musketeer, { name: 'Handgunner', plural: 'Handgunners', icon: '🔥', desc: 'Fires a matchlock handgun: smoke and flame, slow to reload, and every ball hits hard.' });
  Object.assign(D.SOLDIERS, {
    crossbowman: { name: 'Crossbowman', plural: 'Crossbowmen', icon: '🎯', hp: 2.6, dmg: 1.25, ranged: true, proj: 'ARC', delay: 3.0, kit: 'Archer', tier: 1, cost: 1.1, desc: 'A heavy crossbow behind a pavise. Slow, but each bolt punches through mail.' },
    halberdier: { name: 'Halberdier', plural: 'Halberdiers', icon: '🪓', hp: 3.6, dmg: 1.1, kit: 'Pike', tier: 1, cost: 1, antiSiege: 1.4, desc: 'Steel, a tabard and a halberd: the city watch of Valenmoor.' },
    warden: { name: 'Elven Warden', plural: 'Elven Wardens', icon: '🍃', hp: 3.6, dmg: 1.1, kit: 'Warrior', tier: 1, cost: 1, desc: 'Leaf-steel armour and a long glaive: the guardians of Aelindor.' },
    royalwarden: { name: 'Royal Warden', plural: 'Royal Wardens', icon: '👑', hp: 5.0, dmg: 1.3, kit: 'Warrior', tier: 2, cost: 1.7, desc: 'The king\'s own wardens, in gilded leaf-steel.' },
    elvenblade: { name: 'Elven Blade', plural: 'Elven Blades', icon: '🗡', hp: 3.0, dmg: 1.25, kit: 'Warrior', tier: 1, cost: 1, desc: 'Two curved blades and no fear. Fast and deadly up close.' },
    spearman: { name: 'Elven Spearman', plural: 'Elven Spearmen', icon: '🔱', hp: 3.2, dmg: 1.1, kit: 'Pike', tier: 1, cost: 1, antiSiege: 1.6, desc: 'A long leaf-bladed spear and a tall shield. Extra damage to towers, engines and riders.' },
    elvenbow: { name: 'Elven Longbow', plural: 'Elven Longbows', icon: '🏹', hp: 2.4, dmg: 1.15, ranged: true, proj: 'ARC', delay: 2.2, kit: 'Archer', tier: 1, cost: 1.1, desc: 'Elven archers: the longest, quickest bows in the land.' },
    druid: { name: 'Druid', icon: '🌿', hp: 2.2, dmg: 0.6, kit: 'Priest', tier: 1, cost: 1.3, healer: true, desc: 'Mends the wounded with the green magic of the grove.' },
  });
  D.MOB_CLASS_KITS.Pike = D.MOB_CLASS_KITS.Pike || ['trip', 'kick', 'bash', 'cleave'];

  // ---- the engines inside the walls ----
  Object.assign(D.SIEGE, {
    bigcannon: { name: 'Cannon', range: 1700, minRange: 150, delay: 5.5, turn: 0.38, aoe: 70, mul: 2.8, proj: 'ironball', hpMul: 14, vis: 'ironball', arcK: 0.16, flight: 1.0 },
    bombard: { name: 'Bombard', range: 2100, minRange: 300, delay: 9, turn: 0.16, aoe: 120, mul: 3.6, proj: 'ironball', hpMul: 20, vis: 'ironball', arcK: 0.3, flight: 1.6, bigR: 46, bigH: 150 },
    bigballista: { name: 'Ballista', range: 1500, minRange: 100, delay: 4.5, turn: 0.45, aoe: 40, mul: 2.4, proj: 'bigbolt', hpMul: 13, vis: 'bigbolt', flight: 0.7, pierce: true },
    greatballista: { name: 'Great Ballista', range: 1900, minRange: 150, delay: 6.5, turn: 0.3, aoe: 55, mul: 3.2, proj: 'bigbolt', hpMul: 18, vis: 'bigbolt', flight: 0.9, pierce: true, bigR: 46, bigH: 140 },
  });

  // ---- what each kingdom raises ----
  D.FACTION_ARMY = {
    crown: { guard: 'guard', guardCls: 'halberdier', royal: 'knight', ram: 'ram', stable: 'Stable', engines: { cannon: 'bigcannon', bombard: 'bombard' }, towers: ['archer', 'cannon', 'cannon'],
      list: ['guard', 'manatarms', 'pikeman', 'priest', 'knight', 'crossbowman', 'musketeer', 'cavalry', 'ram', 'cannon', 'bombard'],
      soldier: { longbowman: 'crossbowman', elvenbow: 'crossbowman', elvenblade: 'manatarms', spearman: 'pikeman', druid: 'priest', warden: 'halberdier' },
      guardMap: { manatarms: 'halberdier', pikeman: 'halberdier', warden: 'halberdier' } },
    sylvan: { guard: 'sguard', guardCls: 'warden', royal: 'royalwarden', ram: 'troll', stable: 'Troll Den', engines: { ballista: 'bigballista', greatballista: 'greatballista' }, towers: ['archer', 'ballista', 'heavyballista'],
      list: ['sguard', 'elvenblade', 'spearman', 'druid', 'elvenbow', 'troll', 'ballista', 'greatballista'],
      soldier: { longbowman: 'elvenbow', crossbowman: 'elvenbow', musketeer: 'elvenbow', manatarms: 'elvenblade', knight: 'elvenblade', cavalry: 'elvenblade', pikeman: 'spearman', priest: 'druid', halberdier: 'warden' },
      guardMap: { manatarms: 'warden', pikeman: 'warden', halberdier: 'warden', knight: 'royalwarden' } },
  };
  const ARMY = (f) => D.FACTION_ARMY[f] || D.FACTION_ARMY.crown;
  Object.assign(D.RECRUITS, {
    crossbowman: { need: 'range', cost: 2000 },
    elvenblade: { need: 'barracks', cost: 2200 },
    spearman: { need: 'barracks', cost: 2200 },
    druid: { need: 'barracks', cost: 2600 },
    elvenbow: { need: 'range', cost: 2400 },
    sguard: { name: 'Elven Warden', icon: '🍃', need: 'barracks', cost: 1500, cls: 'warden', guard: true, desc: 'Stands watch at your gates with a glaive and fights anyone who attacks the town. Never leaves on a raid.' },
    troll: { name: 'Troll Giant', icon: '👹', need: 'stable', cost: 9000, siege: 'ram', desc: 'A giant three times the height of a man. Marches at the head of your war party, pounds the enemy gate to splinters, then fights on inside.' },
    cannon: { name: 'Cannon', icon: '💣', need: 'workshop', cost: 12000, siege: 'engine', desc: 'A bronze cannon on a wheeled carriage inside your walls: flame, smoke and an iron ball that flies flat and fast.' },
    bombard: { name: 'Bombard', icon: '🧨', need: 'workshop', cost: 18000, siege: 'engine', desc: 'A monstrous iron siege gun. Slow to turn and slower to load, but nothing hits harder or reaches further.' },
    ballista: { name: 'Ballista', icon: '🏹', need: 'workshop', cost: 12000, siege: 'engine', desc: 'A giant bolt thrower inside your walls. Its bolts fly straight and pierce whole files of men.' },
    greatballista: { name: 'Great Ballista', icon: '🎯', need: 'workshop', cost: 18000, siege: 'engine', desc: 'A double-armed elven war bow the size of a house. The longest reach of any elven engine.' },
  });
  Object.assign(D.RECRUITS.guard, { name: 'Halberdier Guard', cls: 'halberdier', desc: 'Stands watch at your gates with a halberd and fights anyone who attacks the town. Never leaves on a raid.' });
  Object.assign(D.RECRUITS.ram, { desc: 'Rolls at the head of your next war party and breaks the enemy gate in five blows.' });
  for (const k of ['crossbowman', 'elvenblade', 'spearman', 'druid', 'elvenbow', 'musketeer']) { const S = D.SOLDIERS[k], R = D.RECRUITS[k]; Object.assign(R, { name: S.name, icon: S.icon, desc: S.desc, cls: k }); }
  Object.assign(D.ENGINE_MAX, { cannon: 2, bombard: 2, ballista: 2, greatballista: 2 });
  War.guardId = (f) => ARMY(f).guard;
  War.towerKinds = (f) => ARMY(f).towers;
  War.ramName = (f) => D.RECRUITS[ARMY(f).ram].name;

  // old saves: the generic catapults and trebuchets become each kingdom's own engines
  const migrate = (f) => {
    const w = acct(); if (!w || !w.engines || !w.engines[f]) return; const E = w.engines[f]; const ids = Object.keys(ARMY(f).engines);
    if (E.catapult) { E[ids[0]] = (E[ids[0]] || 0) + E.catapult; E.catapult = 0; }
    if (E.trebuchet) { E[ids[1]] = (E[ids[1]] || 0) + E.trebuchet; E.trebuchet = 0; }
  };
  War.insideKinds = function (f, E) {
    migrate(f); const out = []; const A = ARMY(f).engines; const w = acct(); const cur = (w && w.engines && w.engines[f]) || E || {};
    const ids = Object.keys(A); for (const id of ids.slice().reverse()) for (let i = 0; i < Math.min(D.ENGINE_MAX[id] || 2, cur[id] || 0); i++) out.push(A[id]);
    return out;
  };

  // ---- the recruiter offers only the kingdom's own troops ----
  const rt0 = War.recruitTypes;
  War.recruitTypes = function (f) {
    f = f || pf(); migrate(f); const A = ARMY(f); const list = rt0.apply(this, arguments).filter((r) => A.list.includes(r.id));
    for (const r of list) {
      const R = D.RECRUITS[r.id];
      if (R.siege === 'ram') { r.ramLike = true; r.kind = r.kind || 'siege'; }
      if (r.building === 'stable') { r.buildingName = A.stable; if (r.why) r.why = r.why.replace('the Stable', `the ${A.stable}`).replace('the undefined', `the ${A.stable}`); }
    }
    return list.sort((a, b) => A.list.indexOf(a.id) - A.list.indexOf(b.id));
  };
  // a soldier or guard of the other kingdom's kind is turned into this kingdom's nearest equivalent
  War.factionCls = function (f, cls, guard) { const A = ARMY(f); return (guard ? A.guardMap[cls] : null) || A.soldier[cls] || cls; };
  const gw0 = War.garrisonWanted;
  War.garrisonWanted = function (f) { return gw0.apply(this, arguments).map((w) => Object.assign({}, w, { cls: War.factionCls(f, w.cls, w.hired && w.hired.guard) })); };
  const dr0 = War.dress;
  const LOOKS = (f) => {
    const F = D.FACTIONS[f] || {}; const ban = F.banner || '#7a1e1e', trim = F.trim || '#e0c060';
    return {
      halberdier: { armor: { kind: 'plate', col: '#a8acb4', trim: ban }, helm: 'plate', helmStyle: 'sallet', helmPlume: ban, hat: null, weapon: 'halberd', offhand: null, sash: ban, cape: null, tabard: ban },
      crossbowman: { armor: { kind: 'chain', col: '#8a8e96', trim: ban }, helm: 'plate', helmStyle: 'skull', hat: null, weapon: 'xbow', offhand: null, cape: null, back: 'quiver', sash: ban },
      musketeer: { armor: { kind: 'leather', col: '#5a3a2a', trim: ban }, helm: 'plate', helmStyle: 'skull', hat: null, weapon: null, offhand: null, cape: null, sash: ban },
      warden: { race: 'highelf', armor: { kind: 'chain', col: '#9cb894', trim: trim }, helm: 'plate', helmStyle: 'sallet', helmCol: '#a8c4a0', helmPlume: '#3a7a3a', hat: null, weapon: 'glaive', offhand: null, cape: '#2e5a2e' },
      royalwarden: { race: 'highelf', armor: { kind: 'plate', col: '#d8c890', trim: '#3a7a3a' }, helm: 'plate', helmStyle: 'barbute', helmCol: '#e0cc8a', helmPlume: '#2e6a2e', hat: null, weapon: 'glaive', offhand: null, cape: '#1e4a1e' },
      elvenblade: { race: 'woodelf', armor: { kind: 'leather', col: '#3e5a32', trim: trim }, helm: null, hat: 'hood', hatCol: '#2e4a26', weapon: '1HS', offhand: 'sword', cape: '#2e4a26' },
      spearman: { race: 'highelf', armor: { kind: 'chain', col: '#94b08c', trim: trim }, helm: 'plate', helmStyle: 'nasal', helmCol: '#a8c4a0', hat: null, weapon: 'spear', offhand: 'shield', shieldCol: '#2e5a2e', shieldEmb: trim, cape: null },
      elvenbow: { race: 'woodelf', armor: { kind: 'leather', col: '#4a6b35', trim: trim }, helm: null, hat: 'hood', hatCol: '#3a5a2a', weapon: 'ARC', offhand: null, cape: '#3a5a2a', back: 'quiver' },
      druid: { race: 'woodelf', armor: { kind: 'cloth', col: '#4a6a32', trim: '#c8a040' }, robe: true, helm: null, hat: 'hood', hatCol: '#3a5a26', weapon: '2HB', staff: true, orb: '#9aff8a', offhand: null, cape: null },
    };
  };
  War.dress = function (e, cls) {
    const f = e.faction; if (f && D.FACTION_ARMY[f]) cls = War.factionCls(f, cls, !e.raider);
    if (!D.SOLDIERS[cls]) return dr0.call(this, e, cls);
    const L0 = LOOKS(f)[cls];
    // dress with the stats of the class (the base knows the old classes; new ones borrow the nearest look then get their own)
    const base = { halberdier: 'pikeman', warden: 'manatarms', royalwarden: 'knight', elvenblade: 'manatarms', spearman: 'pikeman', elvenbow: 'longbowman', druid: 'priest', crossbowman: 'longbowman' }[cls];
    if (base) { const S0 = D.SOLDIERS[base]; D.SOLDIERS[base] = D.SOLDIERS[cls]; try { dr0.call(this, e, base); } finally { D.SOLDIERS[base] = S0; } e.soldier = cls; if (e.title === S0.name) e.title = D.SOLDIERS[cls].name; }
    else dr0.call(this, e, cls);
    if (L0) { e.look = Object.assign(e.look || {}, L0); if (L0.race) e.race = L0.race; }
    return e;
  };

  // ---- troll giants: Aelindor's battering rams. They march at the head, pound the gate, then fight on ----
  D.TROLL = { hpMul: 22, speed: 128 * 0.78, dmgMul: 3.4, r: 26, h: 170 };
  const lr0 = War.launchRaid;
  War.launchRaid = function (f) {
    const n0 = War.squads.length; const n = lr0.apply(this, arguments);
    const sq = War.squads.length > n0 ? War.squads[War.squads.length - 1] : null;
    if (n && sq && sq.f === f) {
      if (sq.ram && ARMY(f).ram === 'troll') {
        const e = sq.ram; e.troll = true; e.name = `${D.FACTIONS[f].city} Troll Giant`; e.title = 'Smashes the enemy gates';
        e.hpMax = e.hp = Math.round(G.mobHp(e.level) * D.TROLL.hpMul); e.r = D.TROLL.r; e.h = D.TROLL.h; e.speed = D.TROLL.speed; e.ac = 1300;
        e.res = { fire: 0, cold: 40, magic: 30, poison: 60, disease: 60 };
      }
      if (sq.ram) War.widenPath(sq);
    }
    return n;
  };
  const rtk0 = War.ramTick;
  War.ramTick = function (r, dt) {
    if (r.troll && !r.dead) {
      const sq = r.squad; const g = sq && sq.arrived ? War.blockingGate(sq) : null;
      // the gate is down (or there was none to break): the giant wades in and fights
      if (sq && sq.arrived && r.warState !== 'march' && r.warState !== 'home' && !g) { freeTroll(r); return; }
      const say0 = G.say; G.say = (e, txt, t) => say0.call(G, e, e === r ? U.pick(['RRAAAGH!', 'SMASH!', 'Troll break door!', 'HRRNNGH!', 'Little door. Big troll.']) : txt, t);
      try { return rtk0.apply(this, arguments); } finally { G.say = say0; }
    }
    return rtk0.apply(this, arguments);
  };
  function freeTroll(r) {
    r.trollFree = true; r.passive = false; r.aggroR = 300; r.ramAim = null; r.swingT = 0; r.ramPh = 0;
    r.dmg = Math.round((3 + r.level * 2.6) * D.TROLL.dmgMul); r.delay = 3.2; r.mclass = 'Warrior'; r.mabil = ['bash', 'cleave']; r.abCd = {}; r.abT = 2;
    G.say(r, 'SMASH LITTLE MEN!', 2.5); A2('bellow', r, 1);
  }
  const A2 = (n, e, v) => { try { const p = G.player; const d = p ? Math.hypot(e.x - p.x, e.y - p.y) : 1e9; if (d < 1400) KR.A.sfx(n, v * (1 - d / 1400)); } catch (er) {} };
  const killed1 = War.onRaiderKilled;
  War.onRaiderKilled = function (r) {
    if (r.troll) { const p = G.player; if (p && r.squad && mineF(r.squad.ef)) G.log('The troll giant crashes to the ground!', 'status', '#9affb8'); else if (mineF(r.faction)) G.log('Your troll giant has fallen!', 'status', '#ff6a5a'); }
    return killed1.apply(this, arguments);
  };
  const mineF = (f) => !!(G.player && G.player.c && G.player.c.faction === f);
  const army1 = War.army;
  War.army = function (f) {
    f = f || pf(); const v = army1.apply(this, arguments); const A = ARMY(f);
    if (A.ram === 'troll' && 'Battering rams' in v) { const d = Object.getOwnPropertyDescriptors(v); const n = v['Battering rams']; delete v['Battering rams']; v['Troll giants'] = n; for (const k in d) if (!d[k].enumerable) Object.defineProperty(v, k, d[k]); }
    if ('Siege engines' in v) { const w = acct(); const E = (w && w.engines && w.engines[f]) || {}; v['Siege engines'] = Object.keys(A.engines).reduce((s, id) => s + (E[id] || 0), 0); }
    return v;
  };

  // ---- room to march out: big units keep a tile of clear ground on every side ----
  const TALL = /lamp|lantern|post|tree|banner|flag|statue|well|cart|wagon|stall|crate|barrel|sign|fence|pillar|column|bench|rack|cauldron|anvil|forge|pile|logs|hay|keg|board|torch|brazier|fountain|pole/i;
  let decorSet = null, decorFor = null;
  const decorAt = (tx, ty) => {
    if (decorFor !== W.decor || !decorSet) { decorFor = W.decor; decorSet = new Set(); for (const d of W.decor || []) if (d && d.kind && TALL.test(d.kind)) decorSet.add(d.ty * W.W + d.tx); }
    return decorSet.has(ty * W.W + tx);
  };
  War.wideBlocked = function (tx, ty, rad) {
    for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) { const x = tx + i, y = ty + j; if (!W.inb(x, y)) return true; if ((i || j) && (W.isBlockedTile(x, y) || decorAt(x, y))) return true; if (!i && !j && decorAt(x, y)) return true; }
    return false;
  };
  War.decorAt = decorAt;
  // the nearest tile with room on every side, near (sx, sy)
  War.wideSpot = function (sx, sy, rad, maxR) {
    for (let r = 0; r <= (maxR || 8); r++) { let best = null; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = sx + dx, y = sy + dy; if (W.inb(x, y) && !W.isBlockedTile(x, y) && !War.wideBlocked(x, y, rad)) { const d = Math.hypot(dx, dy); if (!best || d < best[2]) best = [x, y, d]; } } if (best) return best; }
    return null;
  };
  War.widenPath = function (sq) {
    try {
      const bk = sq.bk || sq.path[0]; const end = sq.path[sq.path.length - 1];
      const s = War.wideSpot(bk[0], bk[1], 1, 10); const g = War.wideSpot(end[0], end[1], 1, 6) || end; if (!s) return false;
      const p = W.findPathLong(s[0], s[1], g[0], g[1], 600000, { door: 'pass', roads: true, clear: 1 }); if (!p) return false;
      const lead = []; if (s[0] !== bk[0] || s[1] !== bk[1]) { const q = W.findPathLong(bk[0], bk[1], s[0], s[1], 20000); if (q) lead.push(...q.slice(0, -1)); }
      sq.path = [bk.slice()].concat(lead, [[s[0], s[1]]], p); sq.wideFrom = 1 + lead.length; // the soldiers walk out of the barracks door; the big unit starts on open ground
      if (sq.ram) { sq.ram.x = s[0] * TS + 16; sq.ram.y = s[1] * TS + 16; sq.ram.homeX = sq.ram.x; sq.ram.homeY = sq.ram.y; }
      sq.wide = true; return true;
    } catch (er) { console.warn('widenPath', er); return false; }
  };
  // the big engines inside the walls also stand where they have room all round
  const is0 = War.insideSpots;
  War.insideSpots = function (f, n) {
    if (!n) return [];
    const many = is0.call(this, f, n * 4); const res = many.filter((s) => !War.wideBlocked(s[0], s[1], 2)).slice(0, n);
    for (const s of many) { if (res.length >= n) break; if (!res.includes(s)) res.push(s); }
    return res;
  };
})();

// =====================================================================
// War and workers. Battering rams (and Aelindor's troll giants) only ever break gates; the kingdom's cannons,
// bombards and ballistas wait in the siege yard, march with the war party and blow a breach in the enemy's walls
// (a city with no walls is simply walked into). Up to three Arborists and three Miners, each with a bodyguard if
// you pay for one; war parties of the two kingdoms that meet on the road fight it out; the player can sound the
// retreat; the maps show your guards, raiders, workers and ships, and enemies only once they have been seen.
// =====================================================================
(function () {
  const KR = window.KR; const { D, G, U, W } = KR; const Sys = KR.Sys, War = KR.War, A = KR.A;
  if (!War) return;
  const TS = D.TS; const T = KR.T;
  const mainRealm = () => !W.realm || W.realm === 'main';
  const pf = () => (G.player && G.player.c ? G.player.c.faction : null);
  const mineF = (f) => !!f && f === pf();
  const acct = () => { const a = G.account; if (!a) return null; a.war = a.war || {}; return a.war; };
  const sfx = (n, v) => { try { A && A.sfx && v > 0.02 && A.sfx(n, Math.min(1, v)); } catch (e) {} };
  const near = (x, y, R) => { const p = G.player; if (!p) return 0; const d = Math.hypot(x - p.x, y - p.y); return d < R ? 1 - d / R : 0; };
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const live = (m) => m && !m.dead && !m.removed;
  const ARMY = (f) => (D.FACTION_ARMY && D.FACTION_ARMY[f]) || { engines: {} };

  // ---------- walls: does the city have any? ----------
  const wallCache = {};
  // any rebuild of a city (new walls, a new level) clears what we knew about its walls
  if (W.stampCity) { const sc9 = W.stampCity; W.stampCity = function (f) { wallCache[f] = null; if (BR && BR[f]) BR[f].list = []; return sc9.apply(this, arguments); }; }
  War.hasWalls = function (f) {
    const cd = W.cityData[f]; if (!cd || !mainRealm() || cd.R == null) return false;
    const c = wallCache[f]; if (c && c.tiles === W.tiles && c.R === cd.R && c.cx === cd.cx && G.now - c.t < 2000) return c.v;
    const { cx, cy, R } = cd; let n = 0;
    for (const [x, y] of [[cx - R, cy - R + 6], [cx + R, cy - R + 6], [cx - R + 6, cy + R], [cx + R - 6, cy + R], [cx - R + 6, cy - R], [cx + R - 6, cy - R], [cx - R, cy + R - 6], [cx + R, cy + R - 6]]) if (W.tile(x, y) === T.CWALL) n++;
    const v = n >= 2; wallCache[f] = { tiles: W.tiles, R, cx, t: G.now, v }; return v;
  };
  // no walls, no gates to shut: the bells still ring, but there is nothing to keep anyone out
  const cg0 = War.closeGates;
  War.closeGates = function (f) { if (!War.hasWalls(f)) return 0; return cg0.apply(this, arguments); };

  // ---------- breaching the walls ----------
  D.BREACH = { hp: 8 }; // a cannon or ballista shot is one, a bombard or great ballista shot two
  const BR = {};
  const brState = (f) => { let s = BR[f]; if (!s || s.tiles !== W.tiles) s = BR[f] = { tiles: W.tiles, list: [] }; return s; };
  const isRubble = (b) => b.broken && W.tiles[b.ty * W.W + b.tx] === T.MUD;
  War.breaches = (f) => brState(f).list.slice();
  War.breachOf = (f) => brState(f).list.find(isRubble) || null;
  // a war party that cannot get in (gates shut, no breach yet) waits; with a breach it goes through
  const bg0 = War.blockingGate;
  War.blockingGate = function (sq) {
    if (!War.hasWalls(sq.ef) || War.breachOf(sq.ef)) return null;
    return bg0.apply(this, arguments);
  };
  // the stretch of wall the siege guns aim at: three tiles of plain wall nearest the column, clear of gates and stairs
  War.wallTarget = function (sq) {
    const s = brState(sq.ef);
    if (sq.wall && s.list.includes(sq.wall)) return sq.wall;
    const cd = W.cityData[sq.ef]; if (!cd || !War.hasWalls(sq.ef) || !sq.path || !sq.path.length) return null;
    const ref = sq.path[sq.path.length - 1]; const gates = War.gateList(sq.ef); const { cx, cy, R } = cd;
    let best = null, bd = 1e9;
    for (let i = -R + 5; i <= R - 5; i++) for (const [x, y, ox, oy] of [[cx + i, cy - R, 0, -1], [cx + i, cy + R, 0, 1], [cx - R, cy + i, -1, 0], [cx + R, cy + i, 1, 0]]) {
      if (W.tile(x, y) !== T.CWALL) continue;
      if (gates.some((g) => Math.hypot(g.gx - x, g.gy - y) < 6)) continue;
      const ax = oy ? 1 : 0, ay = ox ? 1 : 0;
      if (W.tile(x - ax, y - ay) !== T.CWALL || W.tile(x + ax, y + ay) !== T.CWALL) continue;
      if (W.isBlockedTile(x + ox * 2, y + oy * 2) || W.isBlockedTile(x - ox * 2, y - oy * 2)) continue;
      if (W.stairs && [-1, 0, 1].some((k) => W.stairs.get((y + ay * k - oy) * W.W + (x + ax * k - ox)) || W.stairs.get((y + ay * k) * W.W + (x + ax * k)))) continue;
      const d = Math.hypot(x - ref[0], y - ref[1]); if (d < bd) { bd = d; best = { x, y, ox, oy, ax, ay }; }
    }
    if (!best) return null;
    const id = sq.ef + ':' + best.x + ',' + best.y;
    let b = s.list.find((q) => q.id === id);
    if (!b) {
      b = { id, f: sq.ef, tx: best.x, ty: best.y, out: [best.ox, best.oy], along: [best.ax, best.ay], tiles: [[best.x - best.ax, best.y - best.ay], [best.x, best.y], [best.x + best.ax, best.y + best.ay]],
        x: (best.x + 0.5) * TS, y: (best.y + 0.5) * TS, hits: 0, max: D.BREACH.hp, broken: false };
      s.list.push(b);
    }
    sq.wall = b; return b;
  };
  function invalidate(b) {
    const xs = b.tiles.map((t) => t[0]), ys = b.tiles.map((t) => t[1]); const x0 = Math.min(...xs) - 2, y0 = Math.min(...ys) - 2;
    try { KR.R && KR.R.invalidateArea && KR.R.invalidateArea(x0, y0, Math.max(...xs) - x0 + 3, Math.max(...ys) - y0 + 3); } catch (e) { console.warn(e); }
  }
  function breakWall(b, src) {
    b.broken = true; b.prev = []; b.tilesRef = W.tiles;
    for (const [x, y] of b.tiles) { const i = y * W.W + x; b.prev.push([i, W.tiles[i], W.block[i], W.wallTop ? W.wallTop[i] : 0]); W.tiles[i] = T.MUD; W.block[i] = 0; if (W.wallTop) W.wallTop[i] = 0; }
    wallCache[b.f] = null; invalidate(b);
    // anyone standing up on that stretch of wall comes down with it
    for (const e of G.ents.concat(G.player ? [G.player] : [])) if (e && e.onWall && b.tiles.some(([x, y]) => Math.floor(e.x / TS) === x && Math.floor(e.y / TS) === y)) e.onWall = false;
    const F = D.FACTIONS[b.f];
    if (mineF(b.f)) { G.log(`The wall of ${F.city} has been breached! The enemy is coming through the rubble!`, 'status', '#ff6a5a'); KR.UI && KR.UI.banner && KR.UI.banner('The wall is breached!', 'Enemy soldiers are coming through the gap. Defend the king!'); }
    else if (src && mineF(src.faction)) G.log(`The wall of ${F.city} comes crashing down! Your soldiers charge through the breach.`, 'status', '#9affb8');
    const v = near(b.x, b.y, 2600); sfx('treefall', v); setTimeout(() => sfx('rockbreak', v), 180); setTimeout(() => sfx('heavy', v * 0.8), 420);
    for (const sq of War.squads) if (sq.ef === b.f) { sq.slots = null; for (const m of sq.members) if (live(m) && !m.nonCombat && !m.fieldGun && !m.ram && Math.random() < 0.35) { G.say(m, U.pick(['Through the breach!', 'The wall is down! Go!', 'CHARGE!']), 2.5); break; } }
  }
  // a hit from a siege gun: dust and stone fly, the wall cracks a little more, and at the end it falls
  War.hitWall = function (b, src, power) {
    if (!b || b.broken) return false;
    b.hits = Math.min(b.max, b.hits + (power || 1)); b.hitAt = G.now; const last = b.hits >= b.max;
    const v = near(b.x, b.y, 2400); sfx('rockbreak', v); sfx('heavy', v * 0.9);
    const p = G.player; const dd = p ? Math.hypot(p.x - b.x, p.y - b.y) : 1e9; if (dd < 1100) G.shake = Math.max(G.shake || 0, (last ? 1.5 : 0.5) * (1 - dd / 1100) + 0.1);
    G.fxAdd({ k: 'ring', x: b.x + b.out[0] * 14, y: b.y + b.out[1] * 14, r: last ? 110 : 50, col: '#a89c88', life: 0.8 });
    War.ev({ k: last ? 'wallbreak' : 'wallhit', f: b.f, id: b.id, x: b.x, y: b.y, n: b.hits, max: b.max, out: b.out, along: b.along });
    const F = D.FACTIONS[b.f]; const pct = Math.round(b.hits / b.max * 100);
    if (last) breakWall(b, src);
    else if (mineF(b.f) && (b.hits <= (power || 1) || b.hits % 3 === 0)) G.log(`Enemy siege guns are battering the walls of ${F.city}! (${pct}% breached)`, 'status', '#ff9a6a');
    else if (src && mineF(src.faction) && (b.hits <= (power || 1) || b.hits % 3 === 0)) G.log(`Your siege guns hammer the wall of ${F.city}. (${pct}% breached)`, 'status', '#e8d48a');
    return true;
  };
  // after the war the masons fill the gap (a rebuilt city has whole walls anyway)
  War.repairWalls = function (f, quiet) {
    const s = BR[f]; if (!s) return 0; let n = 0;
    for (const b of s.list) {
      if (b.broken && b.prev && b.tilesRef === W.tiles) { for (const [i, t, bl, wt] of b.prev) { if (W.tiles[i] !== T.MUD) continue; W.tiles[i] = t; W.block[i] = bl; if (W.wallTop) W.wallTop[i] = wt; } invalidate(b); n++; }
      War.ev({ k: 'wallrepair', f, id: b.id });
    }
    s.list = []; wallCache[f] = null;
    if (n && !quiet && mineF(f)) G.log(`Masons fill the breach in the walls of ${D.FACTIONS[f].city}.`, 'status', '#9affb8');
    return n;
  };
  const repairT = {};
  function repairTick(dt) {
    for (const f of D.FACTION_IDS) {
      const s = BR[f]; if (!s || !s.list.length) { repairT[f] = 0; continue; }
      const st = War.alarm && War.alarm[f]; const attacked = War.squads.some((q) => q.ef === f && q.members.some((m) => live(m) && m.warState !== 'home'));
      if (attacked || (st && st.state)) { repairT[f] = 0; continue; }
      repairT[f] = (repairT[f] || 0) + dt; if (repairT[f] > 30) { repairT[f] = 0; War.repairWalls(f); }
    }
  }

  // ---------- the siege guns: cannons and bombards (Valenmoor), ballistas and great ballistas (Aelindor) ----------
  // They no longer stand inside the walls shooting at people: they wait in the siege yard and only ever fire at walls.
  War.insideKinds = function () { return []; };
  for (const id of ['cannon', 'bombard', 'ballista', 'greatballista']) if (D.RECRUITS[id]) {
    const nm = D.RECRUITS[id].name;
    D.RECRUITS[id].desc = { cannon: 'A bronze cannon on a wheeled carriage. It rolls out with your war party and blows a breach in the enemy walls (it is no use against men or gates).',
      bombard: 'A monstrous siege gun: every ball takes a great bite out of the enemy walls. Marches with your war party; only for walls.',
      ballista: 'A giant bolt thrower on wheels. It marches with your war party and splits the enemy walls open, bolt by bolt (not for men or gates).',
      greatballista: 'The great elven war bow: its bolts crack stone like a hammer. Marches with your war party; only for walls.' }[id] || D.RECRUITS[id].desc;
    D.RECRUITS[id].name = nm;
  }
  if (D.RECRUITS.ram) D.RECRUITS.ram.desc = 'Rolls at the head of your next war party and breaks the enemy gate in five blows (gates only: the siege guns breach the walls).';
  if (D.RECRUITS.troll) D.RECRUITS.troll.desc = 'A giant three times the height of a man. Marches at the head of your war party and pounds the enemy gate to splinters (gates only), then fights on inside.';
  const enginesOf = (f) => { const w = acct(); if (!w) return {}; w.engines = w.engines || {}; return (w.engines[f] = w.engines[f] || {}); };
  // where the guns wait: the siege yard before the Town Hall, or open ground in town
  function parkSpot(f, i) {
    const cd = W.cityData[f]; if (!cd) return null; const y = cd.siegeYard; let sx, sy;
    if (y) { const per = Math.max(1, Math.floor((y[2] - 2) / 4)); sx = y[0] + 2 + (i % per) * 4; sy = y[1] + 1 + Math.floor(i / per) * 3; }
    else { sx = cd.cx - 8 + i * 4; sy = cd.cy + 8; }
    const s = War.wideSpot ? War.wideSpot(sx, sy, 1, 8) : null;
    return s ? [s[0], s[1]] : [sx, sy];
  }
  function makeFieldGun(f, id, kind, tx, ty) {
    const F = D.FACTIONS[f]; const def = D.SIEGE[kind]; const lv = Sys.cityTierLevel(f);
    const e = G.makeEnt({ type: 'guard', faction: f, city: null, name: `${F.city} ${def.name}`, title: 'Breaches enemy walls', x: tx * TS + 16, y: ty * TS + 16, homeX: tx * TS + 16, homeY: ty * TS + 16, level: lv, hostile: true, seed: Math.random() });
    War.makeSiege(e, kind);
    e.static = false; e.big = true; e.raider = true; e.fieldGun = id; e.noLoot = true; e.passive = true; e.dmg = 0;
    e.r = def.bigR || 38; e.h = def.bigH || 120; e.speed = 128 * 0.66; e.leash = 1e9; e.aggroR = 0;
    e.aimAng = Math.PI / 2; e.warState = 'parked'; e.park = [tx, ty];
    return e;
  }
  function ensureGuns() {
    if (!mainRealm()) return;
    for (const f of D.FACTION_IDS) {
      if (!W.cityData[f]) continue;
      const E = enginesOf(f); const AE = ARMY(f).engines || {}; let k = 0;
      const have = G.ents.filter((e) => e.fieldGun && e.faction === f && !e.removed && !e.dead);
      for (const id in AE) {
        const want = Math.min(D.ENGINE_MAX[id] || 2, E[id] || 0); const mine = have.filter((e) => e.fieldGun === id);
        for (let h = mine.length; h < want; h++) { const s = parkSpot(f, k + h); if (s) makeFieldGun(f, id, AE[id], s[0], s[1]); }
        // fewer than we have (sold or old save): the parked ones go first
        for (let h = mine.length; h > want; h--) { const e = mine.find((x) => x.warState === 'parked') || null; if (!e) break; G.remove(e); mine.splice(mine.indexOf(e), 1); }
        k += want;
      }
    }
  }
  // city rebuilds clear out the big engines of a kingdom: the guns are not that sort of engine
  const sd9 = War.spawnDefenses;
  War.spawnDefenses = function () { const fg = G.ents.filter((e) => e.fieldGun); fg.forEach((e) => (e.big = false)); try { return sd9.apply(this, arguments); } finally { fg.forEach((e) => (e.big = true)); } };
  // the guns join the war party (when the enemy has walls to breach)
  const lr9 = War.launchRaid;
  War.launchRaid = function (f) {
    const n0 = War.squads.length; const n = lr9.apply(this, arguments);
    const sq = War.squads.length > n0 ? War.squads[War.squads.length - 1] : null;
    if (n && sq && sq.f === f) {
      const guns = G.ents.filter((e) => e.fieldGun && e.faction === f && live(e) && e.warState === 'parked');
      if (guns.length && War.hasWalls(sq.ef)) {
        sq.guns = [];
        guns.forEach((e, i) => { e.squad = sq; e.warState = 'march'; e.gunI = i; e.pi = 0; e.fp = null; e.fireSpot = null; e.hate.clear(); sq.members.push(e); sq.guns.push(e); });
        if (mineF(f)) G.log(`${guns.length > 1 ? guns.length + ' siege guns roll' : 'Your siege gun rolls'} out behind the column to breach the walls of ${D.FACTIONS[sq.ef].city}.`, 'status', '#9affb8');
        else if (mineF(sq.ef)) G.log(`Scouts report siege guns with the ${D.FACTIONS[f].city} column. They will try to breach our walls.`, 'status', '#ffb24a');
      }
    }
    return n;
  };
  // a war party with guns at work is not stuck at the gate: it is waiting for the breach
  const ss9 = War.siegeStall;
  War.siegeStall = function () {
    const lent = [];
    for (const sq of War.squads) { if (sq.ram && live(sq.ram)) continue; const g = (sq.guns || []).find(live); const b = sq.wall; if (g && !(b && b.broken)) { lent.push([sq, sq.ram]); sq.ram = g; } }
    try { return ss9.apply(this, arguments); } finally { for (const [sq, r] of lent) sq.ram = r; }
  };
  // walk a big gun along a path (or a fresh one to the goal), true when there
  function gunWalk(e, gx, gy, dt, pace) {
    const d = Math.hypot(gx - e.x, gy - e.y); if (d < 8) { e.moving = false; return true; }
    if (!e.fp || e.fpG !== gx + ',' + gy || G.now > (e.fpT || 0)) {
      e.fpG = gx + ',' + gy; e.fpT = G.now + 5000; e.fpi = 0;
      e.fp = d < 60 ? null : W.findPathLong(Math.floor(e.x / TS), Math.floor(e.y / TS), Math.floor(gx / TS), Math.floor(gy / TS), 60000, { door: 'pass', roads: true });
    }
    let tx = gx, ty = gy;
    if (e.fp && e.fp.length) { while (e.fpi < e.fp.length - 1 && Math.hypot(e.fp[e.fpi][0] * TS + 16 - e.x, e.fp[e.fpi][1] * TS + 16 - e.y) < 18) e.fpi++; tx = e.fp[e.fpi][0] * TS + 16; ty = e.fp[e.fpi][1] * TS + 16; }
    const ox = e.x, oy = e.y; G.chase(e, { x: tx, y: ty }, dt, Math.min(pace || 1, d / Math.max(dt * e.speed, 1e-3)));
    if (e.moving !== false) e.aimAng = K_turn(e.aimAng, Math.atan2(e.y - oy, e.x - ox), Math.hypot(e.x - ox, e.y - oy) > 0.2 ? dt * 2.5 : 0);
    return false;
  }
  const K_turn = (a, b, k) => (k ? wrapA(a + wrapA(b - a) * Math.min(1, k)) : a);
  function leaveSquad(e) { const sq = e.squad; if (sq) { sq.members = sq.members.filter((m) => m !== e); if (sq.guns) sq.guns = sq.guns.filter((m) => m !== e); if (!sq.members.length) War.squads = War.squads.filter((s) => s !== sq); } e.squad = null; }
  function fieldGunTick(e, dt) {
    if (e.dead) { if (!e.goneAt) e.goneAt = G.now + 15000; if (G.now > e.goneAt) { leaveSquad(e); G.remove(e); } return; }
    G.statusTick(e, dt); e.hate.clear(); e.inCombat = false; e.target = null; e.fireK = Math.max(0, (e.fireK || 0) - dt * 1.2); e.turning = 0;
    const sq = e.squad; const def = D.SIEGE[e.siege] || {};
    if (e.warState === 'parked' || !sq || !sq.path) {
      e.warState = 'parked'; if (sq && !sq.path) leaveSquad(e);
      if (e.park) { const gx = e.park[0] * TS + 16, gy = e.park[1] * TS + 16; if (Math.hypot(gx - e.x, gy - e.y) > 10) gunWalk(e, gx, gy, dt, 0.8); else e.moving = false; }
      return;
    }
    if (e.warState === 'march') {
      const troops = sq.order ? sq.order.filter((m) => live(m) && m.warState === 'march').length : 4;
      const back = 3.5 + Math.ceil(troops / 2) * 1.35 + (e.gunI || 0) * 3.2;
      const i = Math.max(0, Math.min(sq.path.length - 1, Math.round(sq.hi - back)));
      const [tx, ty] = sq.path[i]; gunWalk(e, tx * TS + 16, ty * TS + 16, dt, 1.15); return;
    }
    if (e.warState === 'home') {
      if (e.pi == null || e.pi > sq.path.length - 1) e.pi = nearestIdx(sq.path, e);
      const [tx, ty] = sq.path[Math.max(0, e.pi)];
      if (gunWalk(e, tx * TS + 16, ty * TS + 16, dt, 1) || Math.hypot(tx * TS + 16 - e.x, ty * TS + 16 - e.y) < 30) { e.pi -= 3; if (e.pi <= 0) { leaveSquad(e); e.warState = 'parked'; e.fp = null; } }
      return;
    }
    // at the enemy's walls: roll up to a firing spot in front of the target stretch, turn onto it slowly, fire
    const allHome = sq.members.every((m) => !live(m) || m === e || m.fieldGun || m.nonCombat || m.warState === 'home');
    if (allHome && sq.arrived) { e.warState = 'home'; e.pi = null; return; }
    const b = War.wallTarget(sq);
    if (!b || b.broken) { // nothing (left) to shoot at: wait behind the fighting
      const i = Math.max(0, sq.path.length - 14 - (e.gunI || 0) * 3); const [tx, ty] = sq.path[i]; gunWalk(e, tx * TS + 16, ty * TS + 16, dt, 1); return;
    }
    if (!e.fireSpot || e.fireSpot.id !== b.id) {
      const n = (sq.guns || []).length || 1; const lat = ((e.gunI || 0) - (n - 1) / 2) * 3.2 * TS;
      const dist = (e.siege === 'bombard' || e.siege === 'greatballista' ? 12 : 9) * TS;
      let px = b.x + b.out[0] * dist + b.along[0] * lat, py = b.y + b.out[1] * dist + b.along[1] * lat;
      const s = War.wideSpot ? War.wideSpot(Math.floor(px / TS), Math.floor(py / TS), 1, 7) : null; if (s) { px = s[0] * TS + 16; py = s[1] * TS + 16; }
      e.fireSpot = { id: b.id, x: px, y: py };
    }
    if (!gunWalk(e, e.fireSpot.x, e.fireSpot.y, dt, 1)) { e.fireT = Math.max(e.fireT || 0, 1.2); return; }
    const want = Math.atan2(b.y - e.y, b.x - e.x); const diff = wrapA(want - e.aimAng); const step = U.clamp(diff, -(def.turn || 0.3) * dt, (def.turn || 0.3) * dt);
    e.aimAng = wrapA(e.aimAng + step); e.turning = Math.abs(diff) > 0.01 ? Math.sign(diff) : 0;
    if (e.turning) { e.creakT = (e.creakT || 0) - dt; if (e.creakT <= 0) { e.creakT = 1.4; sfx('creak', near(e.x, e.y, 900) * 0.5); } }
    e.fireT = (e.fireT || 0) - dt; if (e.fireT > 0 || Math.abs(diff) > 0.05) return;
    e.fireT = (def.delay || 6) * (0.9 + Math.random() * 0.2); e.fireK = 1; e.fireAt = G.now;
    const v = near(e.x, e.y, 1300); const gun = def.vis === 'ironball';
    if (gun) { sfx(def.bigR ? 'bombard' : 'cannon', v); const pp = G.player; if (pp && Math.hypot(e.x - pp.x, e.y - pp.y) < 500) G.shake = Math.max(G.shake || 0, 0.35); }
    else { sfx('ballista', v); sfx('creak', v * 0.5); }
    War.ev({ k: 'fire', f: e.faction, x: e.x, y: e.y, ang: e.aimAng, kind: e.siege, id: e.id });
    const d = Math.hypot(b.x - e.x, b.y - e.y);
    const aim = { x: b.x + b.out[0] * 12 + (Math.random() - 0.5) * 20 * Math.abs(b.along[0]), y: b.y + b.out[1] * 12 + 24 + (Math.random() - 0.5) * 20 * Math.abs(b.along[1]), r: 16, hate: new Map(), buffs: [] };
    const power = e.siege === 'bombard' || e.siege === 'greatballista' ? 2 : 1;
    G.shoot(e, aim, def.vis || 'boulder', -1, { arc: gun ? U.clamp(d * 0.05 * 0.42 * (def.arcK || 1), 1.2, 26) : 0.25, onHit: () => {
      War.ev({ k: 'impact', x: aim.x, y: aim.y - 24, r: def.aoe || 60, big: power > 1 });
      if (sq.ef && War.squads.includes(sq)) War.hitWall(b, e, power);
    } });
    const pr = G.proj[G.proj.length - 1]; if (pr && pr.src === e) pr.speed = Math.max(300, d / (def.flight || 1.2));
  }
  const us9 = War.updateSiege;
  War.updateSiege = function (t, dt) { if (t.fieldGun) return fieldGunTick(t, dt); return us9.apply(this, arguments); };
  function nearestIdx(path, e) { let bi = path.length - 1, bd = 1e9; for (let i = 0; i < path.length; i++) { const d = Math.hypot(path[i][0] * TS + 16 - e.x, path[i][1] * TS + 16 - e.y); if (d < bd) { bd = d; bi = i; } } return bi; }

  // ---------- bodyguards: a soldier walks with a worker and fights whoever comes for them ----------
  const workerEnt = (id) => G.ents.find((x) => x.realmWorker && x.crewId === id && !x.removed);
  function ensureBodyguards() {
    const R = KR.Realm; if (!R || !R.crew || !mainRealm()) return;
    for (const f of D.FACTION_IDS) for (const k of ['arborist', 'miner']) {
      let crew = []; try { crew = R.crew(f, k) || []; } catch (er) { continue; }
      for (const m of crew) {
        if (!m.guard) continue;
        if (G.ents.some((e) => e.bodyguard && e.bodyguard.id === m.id && !e.removed && !e.dead)) continue;
        const w = workerEnt(m.id); if (!w || w.dead) continue;
        const e = War.makeSoldier(f, ARMY(f).guardCls || 'manatarms', w.x + 24, w.y + 12, Sys.cityTierLevel(f), null);
        e.bodyguard = { f, kind: k, id: m.id }; e.warState = 'bodyguard'; e.squad = null; e.title = `${m.name}'s Bodyguard`; e.sit = false; e.aggroR = 0;
      }
    }
  }
  function bgWalk(r, gx, gy, dt, mul) {
    const d = Math.hypot(gx - r.x, gy - r.y);
    if (d > 110 && (!r.bp || G.now > (r.bpT || 0))) { r.bpT = G.now + 2500; r.bpi = 0; r.bp = W.findPathLong(Math.floor(r.x / TS), Math.floor(r.y / TS), Math.floor(gx / TS), Math.floor(gy / TS), 30000, { door: 'pass' }); }
    if (d <= 110) r.bp = null;
    let tx = gx, ty = gy;
    if (r.bp && r.bp.length) { while (r.bpi < r.bp.length - 1 && Math.hypot(r.bp[r.bpi][0] * TS + 16 - r.x, r.bp[r.bpi][1] * TS + 16 - r.y) < 16) r.bpi++; tx = r.bp[r.bpi][0] * TS + 16; ty = r.bp[r.bpi][1] * TS + 16; }
    G.chase(r, { x: tx, y: ty }, dt, mul);
  }
  function bodyguardTick(r, dt) {
    const B = r.bodyguard; const w = workerEnt(B.id); const R = KR.Realm;
    let m = null; try { m = R && R.crew(B.f, B.kind).find((x) => x.id === B.id); } catch (er) {}
    if (!w || w.dead || !m || !m.guard) { G.remove(r); return; } // their worker is gone: back to the barracks
    G.statusTick(r, dt); if (r.stun > 0 || r.root > 0 || r.mez > 0) { r.moving = false; return; }
    r.leash = 1e9; r.returning = false; r.homeX = r.x; r.homeY = r.y;
    r.scanT = (r.scanT || Math.random() * 0.5) - dt;
    if (r.scanT <= 0) {
      r.scanT = 0.5; let best = live(w.foe) && w.foe !== r ? w.foe : null; let bd = 320;
      if (!best) for (const o of G.ents.concat(G.player ? [G.player] : [])) {
        if (!live(o) || o === r || o.fieldGun || o.ram || o.nonCombat || o.bldg) continue;
        if (o.type === 'mob' ? !(o.hate && (o.hate.has(w) || o.hate.has(r))) : !War.isFoe(B.f, o)) continue;
        const d = Math.hypot(o.x - w.x, o.y - w.y); if (d < bd) { bd = d; best = o; }
      }
      if (best) { G.addHate(r, best, 10); r.inCombat = true; }
    }
    const t = r.inCombat ? G.topHate(r) : null;
    if (live(t) && Math.hypot(t.x - w.x, t.y - w.y) < 560) {
      const d = Math.hypot(t.x - r.x, t.y - r.y); const reach = r.ranged ? 300 : G.meleeRange(r, t) + 2;
      if (d > reach + 20) { bgWalk(r, t.x, t.y, dt, 1.1); return; }
      G.updateMob(r, dt); r.returning = false; r.leash = 1e9; return;
    }
    if (t) { r.hate.clear(); r.inCombat = false; r.target = null; }
    // at the worker's shoulder
    const gx = w.x - 22, gy = w.y + 16; const d = Math.hypot(gx - r.x, gy - r.y);
    if (d > 640) { r.x = gx; r.y = gy; r.bp = null; return; } // they were far apart (out of sight): catch up
    if (d > 16) bgWalk(r, gx, gy, dt, U.clamp(d / 70, 0.6, 1.3)); else { r.moving = false; G.faceTo(r, live(w.foe) ? w.foe : { x: w.x + 1, y: w.y }); }
  }

  // ---------- war parties of the two kingdoms that meet on the road fight it out ----------
  function engage(us, them) {
    const foes = them.filter((m) => live(m) && !m.nonCombat);
    for (const m of us) {
      if (!live(m) || m.nonCombat || m.ram || m.fieldGun || (m.inCombat && live(G.topHate(m)))) continue;
      let best = null, bd = 1e9; for (const o of foes) { const d = Math.hypot(o.x - m.x, o.y - m.y); if (d < bd) { bd = d; best = o; } }
      if (best && bd < 22 * TS) { G.addHate(m, best, 8); m.inCombat = true; }
    }
  }
  function clashTick() {
    if (!mainRealm()) return;
    const sqs = War.squads.filter((s) => s.path && !s.arrived && s.members.some((m) => live(m) && m.warState === 'march'));
    for (let i = 0; i < sqs.length; i++) for (let j = i + 1; j < sqs.length; j++) {
      const a = sqs[i], b = sqs[j]; if (a.f === b.f) continue;
      const A1 = a.members.filter(live), B1 = b.members.filter(live); if (!A1.length || !B1.length) continue;
      let md = 1e9; for (const x of A1) for (const y of B1) { const d = Math.hypot(x.x - y.x, x.y - y.y); if (d < md) md = d; }
      if (md > 12 * TS) continue;
      if (!a.clash || a.clash !== b.id) {
        a.clash = b.id; b.clash = a.id;
        const p = G.player; const mine = mineF(a.f) ? a : mineF(b.f) ? b : null;
        if (mine) { G.log(`Your war party has run into the ${D.FACTIONS[mine === a ? b.f : a.f].city} column on the road! They clash!`, 'status', '#ffb24a'); KR.UI && KR.UI.toast && KR.UI.toast('The armies meet!', 'Your raiders and the enemy\'s have run into each other on the road.'); }
        const lead = A1.find((m) => !m.nonCombat && !m.ram && !m.fieldGun); if (lead) G.say(lead, U.pick(['Enemy column! Form up!', 'There they are! At them!', 'For the king! Charge!']), 2.5);
        const v = p ? near(A1[0].x, A1[0].y, 1600) : 0; if (v > 0.05) { sfx('warcry', v); setTimeout(() => sfx('charge', v * 0.7), 300); }
      }
      engage(A1, B1); engage(B1, A1);
    }
  }

  // ---------- the retreat ----------
  War.retreat = function (f, quiet) {
    f = f || pf(); let n = 0;
    for (const sq of War.squads) {
      if (sq.f !== f || !sq.path) continue;
      for (const m of sq.members) {
        if (!live(m)) continue;
        if (m.hunt) { m.hunt.until = 0; n++; continue; }
        m.warState = 'home'; m.retreating = true; m.hate.clear(); m.inCombat = false; m.focus = null; m.want = null; m.target = null;
        m.pi = nearestIdx(sq.path, m); if (m.fieldGun) m.fp = null; n++;
      }
      sq.arrived = true; sq.giveUp = true; sq.retreat = true;
    }
    for (const e of G.ents) if (e.raider && e.faction === f && e.hunt && live(e) && e.hunt.until) { e.hunt.until = 0; n++; }
    if (!quiet && mineF(f)) {
      G.log(n ? 'You sound the retreat! Your soldiers turn for home, fighting only whoever blocks their way.' : 'Nobody is out on a raid to call back.', 'status', n ? '#e8d48a' : '#ffb24a');
      if (n) sfx('horn', 0.6);
    }
    if (n) War.emit && War.emit('army', { f });
    return n;
  };
  War.recall = function (f) { return War.retreat(f); };

  // ---------- who runs what: bodyguards, retreating soldiers ----------
  const ur9 = War.updateRaider;
  War.updateRaider = function (r, dt) {
    if (r.bodyguard && !r.dead) return bodyguardTick(r, dt);
    if (r.retreating && !r.dead && r.warState === 'home') {
      // on the way home they only fight whoever stands in their way (or is hitting them up close)
      r.scanT = Math.max(r.scanT || 0, 0.6);
      const t = r.inCombat ? G.topHate(r) : null;
      if (t && (r.ranged || Math.hypot(t.x - r.x, t.y - r.y) > 70)) { r.hate.delete(t); if (!r.hate.size) { r.inCombat = false; r.target = null; } }
    }
    return ur9.apply(this, arguments);
  };
  const ork9 = War.onRaiderKilled;
  War.onRaiderKilled = function (r) {
    if (r.fieldGun) {
      const E = enginesOf(r.faction); if (E[r.fieldGun] > 0) E[r.fieldGun]--;
      const sq = r.squad; const F = D.FACTIONS[r.faction];
      if (mineF(r.faction)) G.log(`Your ${D.SIEGE[r.siege] ? D.SIEGE[r.siege].name : 'siege gun'} has been destroyed!`, 'status', '#ff6a5a');
      else if (sq && mineF(sq.ef)) G.log(`We destroyed a ${F.city} ${D.SIEGE[r.siege] ? D.SIEGE[r.siege].name : 'siege gun'}!`, 'status', '#9affb8');
      War.ev({ k: 'ramdie', x: r.x, y: r.y }); Sys.saveAccount && Sys.saveAccount(true); War.emit && War.emit('army', { f: r.faction });
      return;
    }
    if (r.bodyguard) {
      const B = r.bodyguard; const R = KR.Realm; let m = null; try { m = R && R.crew(B.f, B.kind).find((x) => x.id === B.id); } catch (er) {}
      if (m) { m.guard = false; Sys.saveAccount && Sys.saveAccount(true); }
      if (mineF(B.f)) G.log(`${m ? m.name + "'s" : 'A'} bodyguard has fallen. Hire another in the kingdom's Workers tab.`, 'status', '#ff9a6a');
      r.bodyguard = null;
    }
    return ork9.apply(this, arguments);
  };

  // ---------- the enemy kingdom keeps a crew too (and pays for bodyguards once it has a barracks) ----------
  const cpu9 = War.cpuStep;
  War.cpuStep = function (dt) {
    const r = cpu9.apply(this, arguments);
    try {
      const cs = War.cpu && War.cpu(); const R = KR.Realm; if (!cs || !R || !R.crew || !R.state(cs.f)) return r;
      cs.crewT = (cs.crewT || 0) - dt; if (cs.crewT > 0) return r; cs.crewT = 20;
      for (const k of ['arborist', 'miner']) {
        const n = R.crew(cs.f, k).length; const cost = R.crewCost(cs.f, k);
        if (n < R.MAX_CREW && cost != null && (cost === 0 || cs.gold >= cost * 2)) R.hireWorker(cs.f, k, { cpu: cs, quiet: true });
        if (War.hasB(cs.f, 'barracks') && cs.gold >= R.GUARD_GOLD * 4) { const m = R.crew(cs.f, k).find((x) => !x.guard); if (m) R.hireBodyguard(cs.f, k, m.id, { cpu: cs, quiet: true }); }
      }
    } catch (e) { console.warn('cpu crew', e); }
    return r;
  };

  // ---------- buildings take damage, burn, and fall ----------
  // Every kingdom building has a body in the world (e.bldg) that the other kingdom's soldiers and heroes can attack. Its
  // health follows its size (footprint and level). The more it is hurt the more it burns (ruin3d.js); at nothing it falls
  // to rubble and is lost from the kingdom (it can be built again). Walls and gates are not among them: only siege
  // engines break those. The Town Hall burns but never falls, and nobody can target it: the king inside still has to die.
  D.HALL_FLOOR = 0.15;
  const bodies = {}; // f -> Map(key -> entity)
  const RL = () => KR.Realm;
  const hallOf = (f) => W.buildings.find((b) => b.city === f && b.type === 'hall' && b.terr) || W.buildings.find((b) => b.city === f && b.type === 'hall');
  function footprint(f, id, lvl) {
    const R = RL(); const pl = R && R.plotOf ? R.plotOf(f, id) : null; if (!pl) return null;
    try { if (W.plotFootprint) { const fp = W.plotFootprint(pl, lvl); if (fp && fp.w) return fp; } } catch (e) {}
    return pl;
  }
  function wantedBodies(f) {
    const R = RL(); const out = []; if (!R || !R.state || !R.state(f)) return out;
    for (const id in R.DEFS) {
      if (id === 'townhall' || id === 'walls' || id === 'towers') continue;
      const lvl = R.level ? R.level(f, id) : (R.state(f).buildings[id] || 0); if (!lvl) continue;
      if (R.building && R.building(f, id) && lvl <= 1) continue; // still going up
      const fp = footprint(f, id, lvl); if (!fp) continue;
      out.push({ key: `${f}:${id}`, id, lvl, b: fp, name: R.DEFS[id].name });
    }
    const h = hallOf(f); if (h) out.push({ key: `${f}:hall`, id: 'hall', lvl: 1, b: { x: h.x, y: h.y, w: h.w, h: h.h }, name: 'Town Hall' });
    return out;
  }
  function makeBody(f, w) {
    const F = D.FACTIONS[f]; const { b, id, lvl } = w; const cx = (b.x + b.w / 2) * TS, cy = (b.y + b.h / 2) * TS; const lv = Sys.cityTierLevel(f);
    const e = G.makeEnt({ type: 'guard', faction: f, city: f, name: `${F.city} ${w.name}`, title: id === 'hall' ? 'The seat of the king' : 'Kingdom building', x: cx, y: cy, homeX: cx, homeY: cy, level: lv, hostile: true, seed: 0 });
    e.bldg = id; e.hall = id === 'hall'; e.bkey = w.key; e.blvl = lvl; e.static = true; e.passive = true; e.speed = 0; e.aggroR = 0; e.leash = 0; e.noLoot = true; e.big = true; e.look = null; e.dmg = 0; e.mute = true;
    e.bw = b.w * TS; e.bd = b.h * TS; e.r = Math.max(14, Math.min(b.w, b.h) * TS / 2); e.h = e.hall ? 320 : 100 + lvl * 30;
    e.hpMax = e.hp = Math.round(G.mobHp(lv) * b.w * b.h * 0.55 * (1 + 0.5 * (lvl - 1)) * (e.hall ? 2.5 : 1));
    e.ac = 900; e.res = { fire: -20, cold: 80, magic: 50, poison: 100, disease: 100 };
    return e;
  }
  function ensureBodies() {
    if (!mainRealm() || !RL()) return;
    for (const f of D.FACTION_IDS) {
      if (!W.cityData[f]) continue;
      const map = bodies[f] || (bodies[f] = new Map());
      for (const [k, e] of map) if (e.removed || !G.ents.includes(e)) map.delete(k);
      const want = wantedBodies(f); const keys = new Set(want.map((w) => w.key));
      for (const w of want) {
        const e = map.get(w.key);
        if (e && (e.razed || e.blvl !== w.lvl)) { const keepHp = !e.razed && e.hpMax ? e.hp / e.hpMax : 1; G.remove(e); map.delete(w.key); const n = makeBody(f, w); n.hp = Math.round(n.hpMax * keepHp); map.set(w.key, n); continue; }
        if (!e) map.set(w.key, makeBody(f, w));
      }
      // a building no longer standing (razed, or the city rebuilt): its rubble stays until it is built again
      for (const [k, e] of map) if (!keys.has(k) && !e.razed) { G.remove(e); map.delete(k); }
    }
  }
  function raze(e) {
    e.razed = true; e.razedAt = G.now; e.respawnAt = null; e.hate && e.hate.clear();
    const f = e.faction, F = D.FACTIONS[f]; const R = RL();
    if (!e.hall && R && R.state) {
      const st = R.state(f); if (st && st.buildings[e.bldg] != null) { st.buildings[e.bldg] = 0; st.construction = st.construction.filter((c) => c.id !== e.bldg); }
      try { R.emit && R.emit('destroyed', f, e.bldg); R.emit && R.emit('built', f, e.bldg, 0); } catch (er) { console.warn(er); }
      Sys.saveAccount && Sys.saveAccount(true);
    }
    const v = near(e.x, e.y, 2600); sfx('treefall', v); setTimeout(() => sfx('rockbreak', v), 220); setTimeout(() => sfx('heavy', v), 520);
    War.ev({ k: 'impact', x: e.x, y: e.y, r: 120, big: true });
    if (mineF(f)) { G.log(`The ${e.name.replace(F.city + ' ', '')} of ${F.city} has been destroyed! Rebuild it from the kingdom's Build tab.`, 'status', '#ff6a5a'); KR.UI && KR.UI.toast && KR.UI.toast('A building has fallen', `${e.name} lies in ruins.`); }
    else if (pf()) G.log(`The ${e.name} burns to the ground!`, 'status', '#9affb8');
    War.emit && War.emit('army', { f });
  }
  function bodyTick(e, dt) {
    if (e.razed) { e.dead = true; e.moving = false; return; }
    if (e.dead) { raze(e); return; }
    e.hate.clear(); e.inCombat = false; e.target = null; e.moving = false;
    if (e.hall && e.hp < e.hpMax * D.HALL_FLOOR) e.hp = Math.round(e.hpMax * D.HALL_FLOOR);
    // the fires go out and the carpenters patch it up once the fighting is over
    const quiet = G.now - (e.hitAt || 0) > 60000 && !War.squads.some((q) => q.ef === e.faction && q.members.some((m) => live(m) && m.warState !== 'home'));
    if (quiet && e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + e.hpMax * 0.01 * dt);
  }
  const ugB = Sys.updateGuard;
  Sys.updateGuard = function (g, dt) { if (g && g.bldg) return bodyTick(g, dt); return ugB.apply(this, arguments); };
  // nobody shouts or screams when a building is hit
  const mv0 = G.mobVoice; if (mv0) G.mobVoice = function (m) { if (m && m.bldg) return; return mv0.apply(this, arguments); };
  // the Town Hall can't be targeted by heroes, and it never falls
  const hostB = G.isHostile;
  G.isHostile = function (a, b) {
    if (b && b.bldg && (b.razed || (b.hall && a && (a.type === 'player' || a.type === 'pet' || a.type === 'merc')))) return false;
    if (a && a.bldg) return false;
    return hostB.apply(this, arguments);
  };
  const dmgB = G.damage;
  G.damage = function (src, tgt, amt) {
    if (tgt && tgt.bldg) {
      if (tgt.razed || (tgt.hall && src && (src.type === 'player' || src.type === 'pet' || src.type === 'merc'))) return 0;
      if (tgt.hall) { const floor = tgt.hpMax * D.HALL_FLOOR; if (tgt.hp <= floor + 1) return 0; arguments[2] = Math.min(amt, tgt.hp - floor); }
    }
    const r = dmgB.apply(this, arguments);
    if (tgt && tgt.bldg && r > 0) {
      if (tgt.hall && (tgt.dead || tgt.hp < tgt.hpMax * D.HALL_FLOOR)) { tgt.dead = false; tgt.hp = Math.round(tgt.hpMax * D.HALL_FLOOR); const i = G.corpses.indexOf(tgt); if (i >= 0) G.corpses.splice(i, 1); }
      tgt.hitAt = G.now;
      if (mineF(tgt.faction) && G.now - (tgt.warnAt || 0) > 25000) { tgt.warnAt = G.now; G.log(`The ${tgt.name} is under attack! (${Math.round(tgt.hp / tgt.hpMax * 100)}%)`, 'status', '#ff9a6a'); }
    }
    return r;
  };
  // soldiers fight the people first, then pull down the buildings; the Town Hall last of all, and once it is
  // burning it is the king they want
  const pt0 = War.pickTarget;
  War.pickTarget = function (r) {
    const t = pt0.apply(this, arguments); if (!t || !t.bldg) return t;
    const ef = r.squad && r.squad.ef; const cd = W.cityData[ef]; if (!cd) return t;
    const inCity = (o) => Math.max(Math.abs(o.x / TS - cd.cx), Math.abs(o.y / TS - cd.cy)) <= cd.R + 2;
    let alt = null, bd = 1e9;
    for (const o of G.ents) { if (!live(o) || o.faction !== ef || o.bldg || o.raider || o.siege || o.type !== 'guard' || !inCity(o)) continue; const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; alt = o; } }
    if (alt) return alt;
    if (!t.hall) return t;
    let b2 = null; bd = 1e9;
    for (const o of G.ents) { if (!live(o) || !o.bldg || o.hall || o.razed || o.faction !== ef) continue; const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; b2 = o; } }
    if (b2) return b2;
    const king = G.ents.find((o) => o.type === 'king' && o.faction === ef && live(o));
    return t.hp <= t.hpMax * D.HALL_FLOOR + 1 && king ? king : t;
  };
  War.buildingBodies = (f) => [...(bodies[f] || new Map()).values()].filter((e) => !e.removed);

  // ---------- orders: army, fleet, or everything ----------
  const fleetCall = (f, what) => {
    const N = KR.Naval || {};
    const fn = what === 'attack' ? (War.sendFleet || War.fleetAttack || War.orderFleet || N.attack || N.sendFleet) : (War.recallFleet || War.fleetRetreat || N.recall || N.retreat || N.recallFleet);
    if (typeof fn === 'function') { try { const own = Object.values(N).includes(fn) ? N : War; const r = fn.call(own, f, what); return typeof r === 'number' ? r : r ? 1 : 0; } catch (e) { console.warn('fleet order', e); return 0; } }
    // no fleet code: tell any warships we have where to go
    const ships = G.ents.filter((e) => e.ship && e.faction === f && live(e)); for (const s of ships) s.shipOrder = what;
    if (mineF(f)) G.log(ships.length ? `Your warships ${what === 'attack' ? 'set sail for the enemy' : 'turn back for harbour'}.` : 'You have no warships. Build a Shipyard first.', 'status', ships.length ? '#9affb8' : '#ffb24a');
    return ships.length;
  };
  War.command = function (f, what) {
    f = f || pf(); let n = 0;
    switch (what) {
      case 'army': n = War.orderAttack(f) || 0; break;
      case 'fleet': n = fleetCall(f, 'attack'); break;
      case 'all': n = (War.orderAttack(f, { quiet: false }) || 0) + fleetCall(f, 'attack'); if (mineF(f)) G.log('All-out attack! Every soldier and every ship marches on the enemy.', 'status', '#ffd84a'); break;
      case 'retreat-army': n = War.retreat(f); break;
      case 'retreat-fleet': n = fleetCall(f, 'retreat'); break;
      case 'retreat-all': n = War.retreat(f, true) + fleetCall(f, 'retreat'); if (mineF(f)) G.log(n ? 'You sound the retreat for everyone: soldiers and ships make for home.' : 'Nobody is out to call back.', 'status', n ? '#e8d48a' : '#ffb24a'); break;
    }
    War.emit && War.emit('army', { f }); KR.UI && KR.UI.refresh && KR.UI.refresh();
    return n;
  };
  const cmdB = Sys.command;
  if (cmdB) Sys.command = function (ln) {
    const t = String(ln || '').trim().toLowerCase().split(/\s+/); const f = pf();
    if (t[0] === '/retreat' || t[0] === '/fallback') { War.command(f, t[1] === 'fleet' || t[1] === 'ships' ? 'retreat-fleet' : t[1] === 'all' || t[1] === 'everything' ? 'retreat-all' : 'retreat-army'); return; }
    if (t[0] === '/march' || t[0] === '/raid') { War.command(f, 'army'); return; }
    if (t[0] === '/fleet') { War.command(f, t[1] === 'retreat' || t[1] === 'home' ? 'retreat-fleet' : 'fleet'); return; }
    if (t[0] === '/allout' || t[0] === '/charge') { War.command(f, 'all'); return; }
    return cmdB.apply(this, arguments);
  };

  // ---------- the clock ----------
  let acc9 = 0, slow9 = 0;
  const tick9 = War.tick;
  War.tick = function (dt) {
    tick9.apply(this, arguments);
    acc9 += dt; if (acc9 < 0.5) return; const step = acc9; acc9 = 0;
    try { clashTick(); } catch (e) { console.warn('clash', e); }
    slow9 += step; if (slow9 < 2) return; const s2 = slow9; slow9 = 0;
    try { ensureGuns(); ensureBodyguards(); ensureBodies(); repairTick(s2); } catch (e) { console.warn('war & workers', e); }
  };

  // ---------- the maps: your guards, raiders, workers and ships; enemies only once seen ----------
  const ICON = { raider: '#ffd84a', guard: '#6aa8ff', body: '#8ad0ff', worker: '#9ad870', ship: '#7ac8ff', gun: '#ffb070', foe: '#ff4a3a' };
  function unitsFor(f) {
    const out = [];
    for (const e of G.ents) {
      if (!live(e) || e.faction !== f || e.bldg) continue;
      if (e.ship) out.push([e, 'ship']);
      else if (e.fieldGun || e.ram) out.push([e, 'gun']);
      else if (e.bodyguard) out.push([e, 'body']);
      else if (e.raider && (e.guardPost || e.warState === 'garrison')) out.push([e, 'guard']);
      else if (e.raider) out.push([e, 'raider']);
      else if (e.realmWorker) out.push([e, 'worker']);
      else if (e.type === 'guard' && !e.siege) out.push([e, 'guard']);
    }
    return out;
  }
  function plot(g, list, toMap, s, w, h) {
    g.save();
    for (const [e, k] of list) {
      const [x, y] = toMap(e.x / TS, e.y / TS); if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
      g.fillStyle = ICON[k]; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 1;
      if (k === 'ship') { g.font = `${Math.max(11, Math.min(18, s * 3))}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⛵', x, y); continue; }
      const r = k === 'raider' || k === 'gun' || k === 'foe' ? Math.max(2.2, Math.min(4, s * 0.9)) : Math.max(1.6, Math.min(3.2, s * 0.7));
      g.beginPath();
      if (k === 'raider' || k === 'foe') { g.moveTo(x, y - r - 1); g.lineTo(x + r + 1, y + r); g.lineTo(x - r - 1, y + r); g.closePath(); } // a little triangle
      else if (k === 'gun') g.rect(x - r, y - r, r * 2, r * 2);
      else g.arc(x, y, r, 0, 6.283);
      g.fill(); g.stroke();
    }
    g.restore();
  }
  function foesFor(f) { try { return (War.spotted(f) || []).map((s) => [s.e || s, 'foe']).filter(([e]) => live(e)); } catch (e) { return []; } }
  const UI = KR.UI;
  if (UI && UI.drawWorldMap) {
    const wm0 = UI.drawWorldMap;
    UI.drawWorldMap = function (cv) {
      const r = wm0.apply(this, arguments);
      try {
        const f = pf(); if (!f || !mainRealm()) return r; const v = UI._mapView || { z: 1, cx: W.W / 2, cy: W.H / 2 };
        const span = W.W / v.z; const s = cv.width / span; const x0 = v.cx - span / 2, y0 = v.cy - span / 2;
        const g = cv.getContext('2d'); const toMap = (x, y) => [(x - x0) * s, (y - y0) * s];
        plot(g, unitsFor(f), toMap, s, cv.width, cv.height); plot(g, foesFor(f), toMap, s, cv.width, cv.height);
      } catch (e) { console.warn('map units', e); }
      return r;
    };
  }
  const Rd = KR.R;
  if (Rd && Rd.drawMinimap) {
    const mm9 = Rd.drawMinimap;
    Rd.drawMinimap = function (cv, scale = 3) {
      const r = mm9.apply(this, arguments);
      try {
        const p = G.player; const f = pf(); if (!p || !f || !mainRealm()) return r;
        const g = cv.getContext('2d'); const w = cv.width, h = cv.height; const ptx = p.x / TS, pty = p.y / TS;
        const toMap = (x, y) => [(x - ptx) * scale + w / 2, (y - pty) * scale + h / 2];
        plot(g, unitsFor(f).filter(([, k]) => k !== 'worker' || scale < 4), toMap, scale, w, h); plot(g, foesFor(f), toMap, scale, w, h);
      } catch (e) { console.warn('minimap units', e); }
      return r;
    };
  }
})();

// =====================================================================================================================
// The navy: the shipyard on the quay, its harbour guns and the warships of the Encircling Sea (world.js). A warship is
// bought with gold once the shipyard stands (one berth per shipyard level). Sent out, it sails round the sea to the
// enemy harbour and lays siege: long range broadsides (Valenmoor's galleons fire cannon, Aelindor's longships great
// bolts) at ships, harbour guns, towers and the buildings near the shore. Harbour guns (shipyard level 2 and 3) shoot
// back with a high, booming arc. API: War.sendFleet(f), War.recallFleet(f), War.fleet(f), War.naval (internals).
// 3D: kingdom-rising-3d/js3d/naval3d.js draws the shipyard, the guns and the ships (K3.navalModel) from War.naval.
// =====================================================================================================================
(function () {
  const KR = window.KR, D = KR.D, G = KR.G, W = KR.W, Sys = KR.Sys, U = KR.U, War = KR.War; const TS = D.TS;
  const pf = () => (G.player && G.player.c ? G.player.c.faction : null);
  const mainRealm = () => !W.realm || W.realm === 'main';
  const near = (x, y, r) => { const p = G.player; if (!p || !mainRealm()) return 0; const d = Math.hypot(x - p.x, y - p.y); return d > r ? 0 : 1 - d / r; };
  const sfx = (n, v) => { if (v > 0.02) { try { KR.A.sfx(n, Math.min(1, v)); } catch (e) {} } };
  const N = (War.naval = { events: [], seq: 0 });
  N.ev = (o) => { N.events.push(o); if (N.events.length > 80) N.events.splice(0, N.events.length - 80); };
  const enemyOf = (f) => (War.enemyOf ? War.enemyOf(f) : D.FACTION_IDS.find((x) => x !== f));
  const isWater = (tx, ty) => { const t = W.tile(tx, ty); return t === KR.T.WATER || t === KR.T.DEEP; };

  // ---------------- the ships and guns ----------------
  D.WARSHIP = {
    crown: { name: 'Galleon', kind: 'galleon', icon: '⛵', vis: 'ironball', shots: 3, gap: 0.28, delay: 6.5, mul: 3.0, aoe: 70, hpMul: 42, range: 3000, speed: 150, arcK: 3.0, flight: 2.5,
      desc: 'A great galleon with a broadside of cannon. Sails round the sea to the enemy harbour and bombards ships, guns and buildings from far off.' },
    sylvan: { name: 'Elven Longship', kind: 'longship', icon: '⛵', vis: 'bigbolt', shots: 2, gap: 0.35, delay: 5.2, mul: 3.4, aoe: 50, hpMul: 34, range: 3000, speed: 165, arcK: 1.4, flight: 2.2, pierce: true,
      desc: 'A swift elven longship carrying great bolt throwers. Sails round the sea to the enemy harbour and shoots ships, guns and buildings from far off.' },
  };
  D.WARSHIP_COST = 30000; // 3 gold
  D.HARBOUR_GUN = {
    crown: { name: 'Harbour Cannon', vis: 'ironball', delay: 5.5, mul: 8, aoe: 80, hpMul: 26, range: 1500, turn: 0.45, arcK: 3.4, flight: 2.4 },
    sylvan: { name: 'Harbour Ballista', vis: 'bigbolt', delay: 4.4, mul: 8.5, aoe: 55, hpMul: 24, range: 1500, turn: 0.55, arcK: 1.6, flight: 2.0, pierce: true },
  };
  for (const f in D.HARBOUR_GUN) D.SIEGE['harbour_' + f] = Object.assign({ minRange: 100 }, D.HARBOUR_GUN[f]);
  D.SIEGE.warship = { name: 'Warship', range: 3000, delay: 6, mul: 3, hpMul: 40 };

  // ---------------- the shipyard: a building of the realm (KR.Realm loads after this file) ----------------
  D.SHIPYARD = { cost: [{ wood: 400, stone: 300 }, { wood: 750, stone: 650 }, { wood: 1200, stone: 1100 }], time: [180, 240, 300] };
  if (D.CPU_PLAN && !D.CPU_PLAN.includes('shipyard')) { const i = D.CPU_PLAN.indexOf('workshop'); D.CPU_PLAN.splice(i >= 0 ? i + 1 : D.CPU_PLAN.length, 0, 'shipyard', 'shipyard'); }
  N.hooked = false;
  N.hookRealm = function () {
    const R = KR.Realm; if (!R || !R.DEFS) return false; if (N.hooked) return true; N.hooked = true;
    R.DEFS.shipyard = { name: 'Shipyard', max: 3, cost: D.SHIPYARD.cost, time: D.SHIPYARD.time, needs: (lv) => (lv ? [] : [['barracks', 1]]),
      levels: ['Shipyard', 'Shipyard', 'Shipyard with a harbour gun', 'Great Shipyard with two harbour guns'],
      get desc() { const f = pf() || 'crown'; return `Builds ${D.WARSHIP[f].name}s on the quay (one berth per level). Levels 2 and 3 add ${D.HARBOUR_GUN[f].name.toLowerCase()} towers to guard the harbour.`; } };
    if (!R.ORDER.includes('shipyard')) R.ORDER.push('shipyard');
    const st0 = R.state; R.state = function (f) { const st = st0.apply(this, arguments); if (st && st.buildings && st.buildings.shipyard == null) st.buildings.shipyard = 0; if (st && st.army && !st.army.navy) st.army.navy = { n: 0 }; return st; };
    const sz0 = R.sanitize; if (sz0) R.sanitize = function (s) { const d = sz0.apply(this, arguments); const v = +(s && s.buildings && s.buildings.shipyard); d.buildings.shipyard = Number.isFinite(v) ? U.clamp(Math.round(v), 0, 3) : 0; return d; };
    const po0 = R.plotOf; R.plotOf = function (f, id) { if (id === 'shipyard') { const cd = W.cityData && W.cityData[f]; return (cd && cd.shipyardPlot) || null; } return po0.apply(this, arguments); };
    R.on('built', (f, id) => { if (id !== 'shipyard') return; try { W.shipyardBlock && W.shipyardBlock(f); N.refreshGuns(f); N.ev({ k: 'yard', f }); } catch (e) { console.warn('naval', e); } });
    return true;
  };
  setTimeout(() => N.hookRealm(), 0);
  N.yardLevel = (f) => { try { return (KR.Realm && KR.Realm.level(f, 'shipyard')) || 0; } catch (e) { return 0; } };
  const navyState = (f) => { try { const st = KR.Realm && KR.Realm.state(f); if (!st) return null; st.army = st.army || {}; st.army.navy = st.army.navy || { n: 0 }; return st.army.navy; } catch (e) { return null; } };
  const save = () => { try { Sys.saveAccount && Sys.saveAccount(); } catch (e) {} };

  // ---------------- the harbour guns ----------------
  N.guns = (f) => G.ents.filter((e) => e.harbourGun && e.faction === f && !e.removed);
  N.refreshGuns = function (f) {
    if (!mainRealm()) return; const cd = W.cityData[f]; const H = cd && cd.harbour; if (!H) return;
    const want = Math.max(0, N.yardLevel(f) - 1);
    const have = N.guns(f); for (const g of have.slice(want)) G.remove(g);
    const spots = [[H.k - 1, -H.half], [H.k - 1, H.half]];
    for (let i = N.guns(f).length; i < want; i++) {
      const [ii, sd] = spots[i]; const tx = H.gx + H.dx * ii + H.px * sd, ty = H.gy + H.dy * ii + H.py * sd;
      const lv = Sys.cityTierLevel ? Sys.cityTierLevel(f) : D.LV(20); const def = D.SIEGE['harbour_' + f];
      const t = G.makeEnt({ type: 'guard', faction: f, city: f, name: `${D.FACTIONS[f].city} ${def.name}`, title: 'Harbour defense', x: tx * TS + 16, y: ty * TS + 16, level: lv, hostile: true });
      t.homeX = t.x; t.homeY = t.y; War.makeSiege(t, 'harbour_' + f); t.harbourGun = true; t.navalKind = 'harbourgun'; t.r = 30; t.h = 260; t.aimAng = Math.atan2(H.dy, H.dx); t.fireT = 2 + i;
      t.hpMax = t.hp = Math.round(G.mobHp(t.level) * def.hpMul); t.dmg = Math.round((3 + t.level * 2.4) * def.mul); t.delay = def.delay;
    }
  };

  // ---------------- the sea lanes: a coarse grid of open water (3x3 tiles a cell) ----------------
  let nav = null;
  N.nav = function () {
    if (nav && nav.tiles === W.tiles && nav.W === W.W) return nav;
    const C = 3, gw = Math.floor(W.W / C), gh = Math.floor(W.H / C); const ok = new Uint8Array(gw * gh);
    for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) { let n = 0; for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) if (isWater(cx * C + x, cy * C + y)) n++; ok[cy * gw + cx] = n === C * C ? 1 : 0; }
    // keep a little off the shore: cells next to land cost more
    const edge = new Uint8Array(gw * gh);
    for (let cy = 1; cy < gh - 1; cy++) for (let cx = 1; cx < gw - 1; cx++) { const i = cy * gw + cx; if (!ok[i]) continue; let land = 0; for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) if (!ok[i + j * gw + k]) land++; edge[i] = land; }
    nav = { tiles: W.tiles, W: W.W, C, gw, gh, ok, edge }; return nav;
  };
  const cellOf = (n, px, py) => [U.clamp(Math.floor(px / TS / n.C), 0, n.gw - 1), U.clamp(Math.floor(py / TS / n.C), 0, n.gh - 1)];
  const cellPx = (n, cx, cy) => [(cx * n.C + n.C / 2) * TS, (cy * n.C + n.C / 2) * TS];
  N.nearestOpen = function (px, py, maxR = 12) {
    const n = N.nav(); const [cx, cy] = cellOf(n, px, py);
    for (let r = 0; r <= maxR; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue; const x = cx + i, y = cy + j; if (x < 0 || y < 0 || x >= n.gw || y >= n.gh) continue; if (n.ok[y * n.gw + x]) return [x, y]; }
    return null;
  };
  // A* over the open-water cells, then straightened (a ship sails straight while the water allows)
  N.route = function (sx, sy, gx, gy) {
    const n = N.nav(); const a = N.nearestOpen(sx, sy), b = N.nearestOpen(gx, gy); if (!a || !b) return null;
    const gw = n.gw, start = a[1] * gw + a[0], goal = b[1] * gw + b[0];
    const g = new Float32Array(n.ok.length).fill(1e9), came = new Int32Array(n.ok.length).fill(-1), closed = new Uint8Array(n.ok.length);
    const heap = []; const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    g[start] = 0; push(start, 0); const bx = goal % gw, by = (goal / gw) | 0;
    while (heap.length) {
      const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === goal) break;
      const x = k % gw, y = (k / gw) | 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        if (!i && !j) continue; const nx = x + i, ny = y + j; if (nx < 0 || ny < 0 || nx >= gw || ny >= n.gh) continue; const nk = ny * gw + nx; if (!n.ok[nk] || closed[nk]) continue;
        if (i && j && (!n.ok[y * gw + nx] || !n.ok[ny * gw + x])) continue;
        const ng = g[k] + (i && j ? 1.414 : 1) + n.edge[nk] * 0.35; if (ng >= g[nk]) continue; g[nk] = ng; came[nk] = k; push(nk, ng + Math.hypot(bx - nx, by - ny));
      }
    }
    if (came[goal] < 0 && goal !== start) return null;
    const cells = []; for (let k = goal; k >= 0; k = came[k]) { cells.push(k); if (k === start) break; } cells.reverse();
    const clear = (k0, k1) => { const x0 = k0 % gw, y0 = (k0 / gw) | 0, x1 = k1 % gw, y1 = (k1 / gw) | 0; const L = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2; for (let s = 1; s < L; s++) { const x = Math.round(x0 + (x1 - x0) * s / L), y = Math.round(y0 + (y1 - y0) * s / L); if (!n.ok[y * gw + x] || n.edge[y * gw + x] > 2) return false; } return true; };
    const out = []; let i = 0; while (i < cells.length - 1) { let j = cells.length - 1; while (j > i + 1 && !clear(cells[i], cells[j])) j--; out.push(cells[j]); i = j; }
    return out.map((k) => cellPx(n, k % gw, (k / gw) | 0));
  };

  // ---------------- warships ----------------
  N.ships = (f) => G.ents.filter((e) => e.ship && !e.removed && (!f || e.faction === f));
  N.alive = (f) => N.ships(f).filter((e) => !e.dead && !e.sinking);
  N.maxShips = (f) => N.yardLevel(f);
  // a ship's moorings: in its own harbour basin, off the shipyard's slipway
  N.mooring = function (f, i) {
    const cd = W.cityData[f]; const pl = cd && cd.shipyardPlot; const H = cd && cd.harbour; if (!H) return null;
    const m = (pl && pl.moor && pl.moor[i % pl.moor.length]) || [H.gx + H.dx * (H.k + 12), H.gy + H.dy * (H.k + 12)];
    const c = N.nearestOpen(m[0] * TS + 16, m[1] * TS + 16, 10); return c ? cellPx(N.nav(), c[0], c[1]) : [m[0] * TS + 16, m[1] * TS + 16];
  };
  // where a fleet lies to bombard a city: just off the enemy's harbour, spread along the shore
  N.siegeSpot = function (ef, i) {
    const cd = W.cityData[ef]; const H = cd && cd.harbour; if (!H) return null;
    const sd = [-8, 8, -18, 18][i % 4], out = H.k + 24 + Math.floor(i / 4) * 5;
    const tx = H.gx + H.dx * out + H.px * sd, ty = H.gy + H.dy * out + H.py * sd;
    const c = N.nearestOpen(tx * TS + 16, ty * TS + 16, 10); return c ? cellPx(N.nav(), c[0], c[1]) : null;
  };
  N.launch = function (f, opts = {}) {
    if (!mainRealm()) return null; const S = D.WARSHIP[f]; const cd = W.cityData[f]; if (!cd || !cd.harbour) return null;
    const idx = N.ships(f).length; const at = N.mooring(f, idx); if (!at) return null;
    const lv = Sys.cityTierLevel ? Sys.cityTierLevel(f) : D.LV(20);
    const F = D.FACTIONS[f]; const names = f === 'crown' ? ['Valen\'s Pride', 'Iron Maiden', 'Thunderer', 'Royal Oak', 'Sea Lion', 'Defiant'] : ['Silverwing', 'Moonwake', 'Thornprow', 'Leafsong', 'Starfall', 'Greenwind'];
    const used = new Set(N.ships(f).map((x) => x.name)); const free = names.filter((x) => !used.has(x)); const s = G.makeEnt({ type: 'guard', faction: f, city: null, name: opts.name || U.pick(free.length ? free : names), title: `${F.city} ${S.name}`, x: at[0], y: at[1], level: lv, hostile: true });
    s.ship = true; s.siege = 'warship'; s.navalKind = S.kind; s.static = true; s.passive = true; s.look = null; s.r = 70; s.h = 300; s.speed = 0; s.leash = 0;
    s.hpMax = s.hp = Math.round(G.mobHp(lv) * S.hpMul); s.ac = 1500; s.dmg = Math.round((3 + lv * 2.4) * S.mul); s.delay = S.delay;
    s.res = { fire: 10, cold: 60, magic: 50, poison: 100, disease: 100 };
    s.heading = Math.atan2(cd.harbour.dy, cd.harbour.dx); s.vel = 0; s.state = 'moor'; s.path = null; s.pi = 0; s.fireT = 2 + Math.random() * 2; s.salvo = 0; s.slot = idx; s.aimAng = s.heading;
    return s;
  };
  // the fleet comes back into being in the harbour whenever the city is set up (a saved count)
  N.spawnFleet = function (f) {
    if (!mainRealm()) return; const ns = navyState(f); if (!ns) return;
    const want = Math.min(ns.n || 0, N.maxShips(f)); ns.n = want;
    for (let i = N.alive(f).length; i < want; i++) N.launch(f);
  };
  const go = (s, to, state) => { const r = to && N.route(s.x, s.y, to[0], to[1]); if (!r || !r.length) { s.state = state === 'out' ? 'moor' : state; return false; } s.path = r; s.pi = 0; s.state = state; return true; };
  War.sendFleet = function (f) {
    f = f || pf(); const ef = enemyOf(f); const list = N.alive(f).filter((s) => s.state !== 'out' && s.state !== 'siege'); if (!list.length) { if (f === pf()) G.log(N.alive(f).length ? 'Your fleet is already at sea.' : 'You have no warships. Build a Shipyard and buy one in the Army tab.', 'sys', '#ffb24a'); return 0; }
    let k = 0; list.forEach((s, i) => { if (go(s, N.siegeSpot(ef, i), 'out')) k++; });
    if (k && f === pf()) { G.log(`${k} warship${k > 1 ? 's' : ''} weigh anchor and sail for ${D.FACTIONS[ef].city}.`, 'status', '#f0d48a'); sfx('horn', 0.5); }
    if (k && pf() === ef) { KR.UI && KR.UI.banner && KR.UI.banner('Enemy warships!', `${D.FACTIONS[f].city}'s fleet has put to sea. It will reach our harbour within minutes.`); }
    War.emit && War.emit('army', { f }); return k;
  };
  War.recallFleet = function (f) {
    f = f || pf(); let k = 0; N.alive(f).forEach((s, i) => { if (s.state === 'moor') return; if (go(s, N.mooring(f, i), 'home')) k++; });
    if (k && f === pf()) G.log(`The fleet turns for home (${k} ship${k > 1 ? 's' : ''}).`, 'status', '#f0d48a');
    return k;
  };
  War.fleet = (f) => { f = f || pf(); const a = N.alive(f); return { ships: a.length, max: N.maxShips(f), atSea: a.filter((s) => s.state !== 'moor').length, siege: a.filter((s) => s.state === 'siege').length, list: a.map((s) => ({ name: s.name, hp: s.hp / s.hpMax, state: s.state })) }; };

  // what a ship (or a harbour gun) shoots at: ships first, then guns and engines, then buildings, then soldiers
  const buildingsOf = function (ef) {
    const R = KR.Realm; if (!R || !R.state) return []; const st = R.state(ef); if (!st) return []; const out = []; const cd = W.cityData[ef] || {};
    for (const id of ['barracks', 'shipyard', 'workshop', 'range', 'stable', 'sawmill', 'cutter']) {
      const lv = st.buildings[id] || 0; if (!lv) continue;
      let r = id === 'barracks' && cd.barracksB ? cd.barracksB : R.plotOf(ef, id); if (!r) continue;
      const x = (r.x + r.w / 2) * TS, y = (r.y + r.h / 2) * TS; out.push({ id, x, y, lv });
    }
    return out;
  };
  N.pickTarget = function (s, range) {
    const f = s.faction, ef = enemyOf(f); let best = null, bs = 1e18; const p = G.player;
    const consider = (e, w) => { const d = Math.hypot(e.x - s.x, e.y - s.y); if (d > range) return; const sc = d * w; if (sc < bs) { bs = sc; best = e; } };
    // first what shoots back: ships, harbour guns, engines
    for (const e of G.ents) {
      if (e === s || e.dead || e.removed || e.sinking || e.faction === f) continue;
      if (e.ship) consider(e, 0.25); else if (e.harbourGun) consider(e, 0.4); else if (e.siege && e.faction === ef) consider(e, 0.7);
    }
    if (best) return best;
    // then (laying siege) the buildings: the barracks and the shipyard before the rest
    // the kingdom's buildings have bodies of their own (War.buildingBodies): the Town Hall only when nothing else stands
    if (s.ship && s.state === 'siege') {
      let hall = null;
      for (const e of G.ents) { if (!e.bldg || e.faction !== ef || e.dead || e.removed || e.razed) continue; if (e.hall) { hall = e; continue; } const d = Math.hypot(e.x - s.x, e.y - s.y) * (e.bldg === 'barracks' || e.bldg === 'shipyard' ? 0.7 : 1); if (d < range && d < bs) { bs = d; best = e; } }
      if (best) return best; if (hall && Math.hypot(hall.x - s.x, hall.y - s.y) < range) return hall;
    }
    if (s.ship && s.state === 'siege' && !G.ents.some((e) => e.bldg)) { for (const b of buildingsOf(ef)) { const d = Math.hypot(b.x - s.x, b.y - s.y) * (b.id === 'barracks' || b.id === 'shipyard' ? 0.7 : 1); if (d < range && d < bs) { bs = d; best = { bld: b.id, f: ef, x: b.x, y: b.y }; } } if (best) return best; }
    // then soldiers and the enemy hero
    for (const e of G.ents) { if (e.dead || e.removed || e.faction !== ef || e.static) continue; if (e.raider || e.type === 'guard') consider(e, 1.6); }
    if (p && !p.dead && War.isFoe(f, p)) consider(p, 1.8);
    return best;
  };

  // ---------------- buildings take damage (the WAR & WORKERS fork's API when there is one; otherwise our own) ----------------
  N.bhp = {};
  N.damageBuilding = function (f, id, amt, src) {
    if (typeof War.damageBuilding === 'function' && War.damageBuilding !== N.damageBuilding) { try { return War.damageBuilding(f, id, amt, src); } catch (e) { console.warn(e); } }
    const R = KR.Realm; if (!R || !R.state) return false; const st = R.state(f); if (!st || !(st.buildings[id] > 0)) return false;
    const key = f + ':' + id; const max = 6000 * st.buildings[id]; if (N.bhp[key] == null) N.bhp[key] = max;
    N.bhp[key] -= amt; if (N.bhp[key] > 0) return false;
    // wrecked: the building falls back a level (a one-level building is razed)
    delete N.bhp[key]; st.buildings[id] = Math.max(0, st.buildings[id] - 1); st.walls = st.buildings.walls; st.towers = st.buildings.towers;
    const nm = R.DEFS[id] ? R.DEFS[id].name : id; const me = pf();
    if (me === f) { G.log(`Enemy warships have wrecked your ${nm}!`, 'status', '#ff6a5a'); KR.UI && KR.UI.banner && KR.UI.banner(`The ${nm} is wrecked`, 'Rebuild it in the kingdom panel (N).'); }
    else if (me) G.log(`Your warships have wrecked the enemy's ${nm}!`, 'status', '#9affb8');
    R.emit && R.emit('built', f, id, st.buildings[id]);
    try { const ct = G.account && G.account.cities && G.account.cities[f]; const want = R.cityLevel(f); if (ct && ct.level !== want) { ct.level = want; Sys.cityChanged(f, false); } else if (id === 'shipyard') { W.shipyardBlock && W.shipyardBlock(f); N.refreshGuns(f); } } catch (e) { console.warn(e); }
    save(); return true;
  };

  // ---------------- firing: a cannonball in a high arc, or a great bolt ----------------
  N.fire = function (t, tg, def) {
    const d = Math.hypot(tg.x - t.x, tg.y - t.y); t.fireAt = G.now; t.fireK = 1; t.aimAng = Math.atan2(tg.y - t.y, tg.x - t.x);
    const gun = def.vis === 'ironball'; const v = near(t.x, t.y, 2200);
    if (gun) { sfx('cannon', v * 1.1); const p = G.player; if (p && Math.hypot(t.x - p.x, t.y - p.y) < 700) G.shake = Math.max(G.shake || 0, 0.45); } else { sfx('bow', v); sfx('whoosh', v * 0.8); }
    N.ev({ k: 'muzzle', id: t.id, x: t.x, y: t.y, ang: t.aimAng, gun, ship: !!t.ship });
    // a long shot scatters: the farther, the wider (ships never miss by much at close range)
    const sc = (tg.bld ? 70 : 34) * (0.3 + d / (def.range || 2000)); const miss = !tg.bld && Math.random() < 0.18 + d / 9000;
    const ax = tg.x + (Math.random() - 0.5) * sc * (miss ? 5 : 1), ay = tg.y + (Math.random() - 0.5) * sc * (miss ? 5 : 1);
    const dummy = { id: 'naval' + (N.seq++), type: 'mob', x: ax, y: ay, h: 0, r: 1, dead: false, naval: true };
    G.shoot(t, dummy, def.vis, -1, { arc: U.clamp(d * 0.05 * 0.42 * (def.arcK || 1), gun ? 4 : 1.5, 48), onHit: () => N.impact(t, ax, ay, def, tg) });
    const pr = G.proj[G.proj.length - 1]; if (pr && pr.src === t) pr.speed = Math.max(320, d / (def.flight || 2.4));
  };
  N.impact = function (t, x, y, def, tg) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS); const wet = isWater(tx, ty); const v = near(x, y, 1800);
    const dmg = () => Math.round(t.dmg * (0.75 + Math.random() * 0.5));
    let hitShip = false;
    for (const e of G.ents.concat(G.player ? [G.player] : [])) {
      if (e === t || e.dead || e.removed || e.sinking || e.faction === t.faction || (e.c && e.c.faction === t.faction)) continue;
      if (!(e.ship || e.harbourGun || War.isFoe(t.faction, e))) continue;
      const rr = def.aoe + (e.ship ? 60 : e.r || 12); if (Math.hypot(e.x - x, e.y - y) > rr) continue;
      if (e.ship) hitShip = true;
      G.damage(t, e, Math.round(G.mitigate(t, e, dmg()) * (e === tg ? 1 : 0.6)), {});
    }
    if (tg && tg.bld && !wet) N.damageBuilding(tg.f, tg.bld, dmg() * 1.2, t);
    if (hitShip) { N.ev({ k: 'splinters', x, y }); sfx('rockbreak', v); sfx('heavy', v * 0.7); }
    else if (wet) { N.ev({ k: 'splash', x, y, big: def.vis === 'ironball' }); sfx('splash', v); }
    else { War.ev({ k: 'impact', x, y, r: def.aoe, big: true }); sfx('heavy', v); sfx('rockbreak', v * 0.8); }
    const p = G.player; if (p && Math.hypot(x - p.x, y - p.y) < 500) G.shake = Math.max(G.shake || 0, 0.6);
  };

  // ---------------- every frame: sail, aim, fire; the guns aim and fire ----------------
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  N.shipTick = function (s, dt) {
    const S = D.WARSHIP[s.faction];
    if (s.dead && !s.sinkT) { s.dead = false; s.sinking = true; s.invuln = true; s.hp = 0; s.inCombat = false; s.tgt = null; s.salvo = 0; const ci = G.corpses ? G.corpses.indexOf(s) : -1; if (ci >= 0) G.corpses.splice(ci, 1); if (G.player && G.player.target === s) G.player.target = null; }
    if (s.sinking) { // a sinking ship is no longer dead or alive: it settles by the stern and goes under (naval3d.js)
      if (!s.sinkT) { s.sinkT = 0.001; const ns = navyState(s.faction); if (ns) ns.n = Math.max(0, (ns.n || 0) - 1); save(); N.ev({ k: 'sink', x: s.x, y: s.y, id: s.id }); sfx('rockbreak', near(s.x, s.y, 2000)); sfx('splash', near(s.x, s.y, 2000));
        const me = pf(); if (me === s.faction) G.log(`The ${s.name} is sinking!`, 'status', '#ff6a5a'); else if (me) G.log(`The enemy ship ${s.name} goes down!`, 'status', '#9affb8'); }
      s.sinkT += dt; if (s.sinkT > 10) G.remove(s); return;
    }
    // sailing: steer for the next point of the route, slow in the turns
    if (s.path && s.pi < s.path.length) {
      const [wx, wy] = s.path[s.pi]; const dx = wx - s.x, dy = wy - s.y, d = Math.hypot(dx, dy);
      if (d < 50) { s.pi++; } else {
        const want = Math.atan2(dy, dx); const diff = wrapA(want - s.heading); s.heading = wrapA(s.heading + U.clamp(diff, -0.6 * dt, 0.6 * dt));
        const targetV = S.speed * (Math.abs(diff) > 0.9 ? 0.35 : 1) * (s.pi === s.path.length - 1 ? Math.min(1, d / 260) + 0.15 : 1);
        s.vel += (targetV - s.vel) * Math.min(1, dt * 0.8);
        const nx = s.x + Math.cos(s.heading) * s.vel * dt, ny = s.y + Math.sin(s.heading) * s.vel * dt;
        if (isWater(Math.floor(nx / TS), Math.floor(ny / TS))) { s.x = nx; s.y = ny; } else { s.heading = wrapA(s.heading + 0.8 * dt * (diff >= 0 ? 1 : -1)); s.vel *= 0.5; }
      }
      s.moving = s.vel > 5;
      if (s.pi >= s.path.length) { s.path = null; s.state = s.state === 'out' ? 'siege' : 'moor'; if (s.state === 'siege' && pf() === s.faction) G.log(`The ${s.name} has reached ${D.FACTIONS[enemyOf(s.faction)].city} and opens fire.`, 'status', '#f0d48a'); }
    } else { s.vel *= Math.max(0, 1 - dt * 1.5); s.moving = false; }
    s.homeX = s.x; s.homeY = s.y;
    // fighting: a broadside of shots, a moment apart, then a long reload
    s.fireT -= dt;
    if (s.salvo > 0 && s.fireT <= 0) { const tg = s.tgt; if (tg && !(tg.dead || tg.removed)) N.fire(s, tg, S); s.salvo--; s.fireT = s.salvo > 0 ? S.gap : S.delay * (0.9 + Math.random() * 0.2); }
    else if (s.fireT <= 0) { const tg = N.pickTarget(s, S.range); s.tgt = tg; s.inCombat = !!tg; if (tg) { s.salvo = S.shots; s.fireT = 0; } else s.fireT = 1; }
  };
  N.gunTick = function (t, dt) {
    const def = D.SIEGE[t.siege];
    if (t.dead) { // a wrecked gun is rebuilt after five minutes
      if (!t.respawnAt) t.respawnAt = G.now + 300000;
      if (G.now > t.respawnAt) { t.dead = false; t.hp = t.hpMax; t.respawnAt = null; t.hate && t.hate.clear(); t.inCombat = false; const i = G.corpses.indexOf(t); if (i >= 0) G.corpses.splice(i, 1); if (pf() === t.faction) G.log(`The ${t.name} has been rebuilt.`, 'sys', '#cccccc'); }
      return;
    }
    t.scanT = (t.scanT || 0) - dt; if (t.scanT <= 0) { t.scanT = 0.8; t.tgt = N.pickTarget(t, def.range); t.inCombat = !!t.tgt; }
    const tg = t.tgt; if (!tg || tg.dead || tg.removed) { t.tgt = null; t.turning = 0; t.fireT = Math.max(t.fireT || 0, 1.2); return; }
    const want = Math.atan2(tg.y - t.y, tg.x - t.x); const diff = wrapA(want - t.aimAng); t.aimAng = wrapA(t.aimAng + U.clamp(diff, -def.turn * dt, def.turn * dt)); t.turning = Math.abs(diff) > 0.01 ? Math.sign(diff) : 0;
    t.fireT -= dt; if (t.fireT > 0 || Math.abs(diff) > 0.06) return;
    t.fireT = def.delay * (0.9 + Math.random() * 0.2); N.fire(t, tg, def);
  };
  const us0 = War.updateSiege;
  War.updateSiege = function (t, dt) { if (t.ship || t.harbourGun) return; return us0.apply(this, arguments); }; // the naval tick drives these, near or far

  // ---------------- the army API: the warship in the Army tab ----------------
  const rt0 = War.recruitTypes;
  War.recruitTypes = function (f) {
    f = f || pf(); const list = rt0.apply(this, arguments) || []; const S = D.WARSHIP[f]; if (!S) return list;
    const lv = N.yardLevel(f), have = N.alive(f).length, max = N.maxShips(f);
    list.push({ id: 'warship', name: S.name, icon: S.icon, desc: S.desc, building: 'shipyard', buildingName: 'Shipyard', unlocked: lv > 0, locked: !lv, why: lv ? (have >= max ? (lv < 3 ? 'Every berth is taken. Upgrade the Shipyard for another.' : 'Every berth is taken.') : '') : 'Build the Shipyard first.', cost: D.WARSHIP_COST, have, max, kind: 'siege' });
    return list;
  };
  const hire0 = War.hire;
  War.hire = function (a, b, c, d) {
    const f = D.FACTION_IDS.includes(a) ? a : null; if (!(f && b === 'warship')) return hire0.apply(this, arguments);
    const n = Math.max(1, Math.round(+c || 1)); let k = 0;
    for (let i = 0; i < n; i++) {
      const p = G.player; const mine = !!(p && p.c.faction === f); const fail = (m) => { if (mine && i === 0) { G.log(m, 'sys', '#ffb24a'); sfx('fail', 0.5); } return false; };
      if (!N.yardLevel(f)) { fail('Build the Shipyard first.'); break; }
      if (N.alive(f).length >= N.maxShips(f)) { fail('Every berth in the shipyard is taken. Upgrade the Shipyard for another warship.'); break; }
      if (!mainRealm()) { fail('Warships are launched from the shipyard: be in the kingdom lands.'); break; }
      if (mine) { if (p.c.coins < D.WARSHIP_COST) { fail(`Not enough gold: a ${D.WARSHIP[f].name} costs ${G.fmtCoins(D.WARSHIP_COST)}.`); break; } p.c.coins -= D.WARSHIP_COST; }
      else { const cs = War.cpu && War.cpu(); if (cs && cs.f === f) { if ((cs.gold || 0) < D.WARSHIP_COST) break; cs.gold -= D.WARSHIP_COST; } }
      const s = N.launch(f); if (!s) break; const ns = navyState(f); if (ns) ns.n = (ns.n || 0) + 1; k++;
      if (mine) { G.log(`The ${s.name} slides down the slipway: a ${D.WARSHIP[f].name} joins your fleet (${G.fmtCoins(D.WARSHIP_COST)}).`, 'status', '#9affb8'); sfx('coin', 0.6); }
    }
    if (k) { save(); Sys.save && pf() === f && Sys.save(true); KR.UI && KR.UI.refresh && KR.UI.refresh(); War.emit && War.emit('army', { f }); }
    return k;
  };
  const army0 = War.army;
  War.army = function (f) { f = f || pf(); const v = army0.apply(this, arguments); try { const a = N.alive(f); if (N.yardLevel(f) || a.length) v['Warships'] = `${a.length} / ${N.maxShips(f)}${a.some((s) => s.state !== 'moor') ? ` (${a.filter((s) => s.state !== 'moor').length} at sea)` : ''}`; } catch (e) {} return v; };
  // the fleet's own card in the kingdom panel's Army tab (realmui.js calls it)
  War.fleetCard = function (pane, f) {
    const S = D.WARSHIP[f]; if (!S || !N.yardLevel(f)) return; const fl = War.fleet(f);
    const card = document.createElement('div'); card.className = 'rm-card';
    card.innerHTML = `<h4>⚓ The fleet <small>${fl.ships} / ${fl.max}</small></h4><p>${fl.ships ? fl.list.map((s) => `${s.name}: ${({ moor: 'in harbour', out: 'under sail', siege: 'bombarding the enemy', home: 'sailing home' })[s.state] || s.state} (${Math.round(s.hp * 100)}%)`).join('<br>') : `No warships yet. Buy a ${S.name} above.`}</p><div class="rm-row"></div>`;
    const row = card.querySelector('.rm-row');
    const b1 = document.createElement('button'); b1.className = 'btn small gold'; b1.textContent = '⚓ Attack with the fleet'; b1.disabled = !fl.ships; b1.onclick = () => { War.sendFleet(f); KR.UI.refresh && KR.UI.refresh(); };
    const b2 = document.createElement('button'); b2.className = 'btn small'; b2.textContent = '↩ Retreat the fleet'; b2.disabled = !fl.atSea; b2.onclick = () => { War.recallFleet(f); KR.UI.refresh && KR.UI.refresh(); };
    row.appendChild(b1); row.appendChild(b2); pane.appendChild(card);
  };

  // ---------------- the computer's navy ----------------
  let cpuT = 0;
  N.cpuTick = function (dt) {
    cpuT += dt; if (cpuT < 15) return; cpuT = 0;
    if (!War.cpuActive || !War.cpuActive()) return; const cs = War.cpu && War.cpu(); if (!cs) return; const f = cs.f;
    if (cs.queue && !cs.queue.includes('shipyard') && N.yardLevel(f) < 2 && KR.Realm && KR.Realm.has(f, 'workshop')) cs.queue.push('shipyard');
    if (N.yardLevel(f) && N.alive(f).length < N.maxShips(f) && (cs.gold || 0) > D.WARSHIP_COST * 1.4) War.hire(f, 'warship', 1);
    const Df = War.diff ? War.diff() : { build: 1 }; cs.nextFleet = cs.nextFleet || (G.now + 600000 / (Df.build || 1));
    if (G.now > cs.nextFleet && N.alive(f).some((s) => s.state === 'moor')) { cs.nextFleet = G.now + (720000 + Math.random() * 360000) / (Df.build || 1); War.sendFleet(f); }
    // a battered fleet goes home
    for (const s of N.alive(f)) if (s.state === 'siege' && s.hp < s.hpMax * 0.25) { War.recallFleet(f); break; }
  };
  const tk0 = War.tick;
  War.tick = function (dt) {
    tk0.apply(this, arguments);
    if (!mainRealm()) return; N.hookRealm();
    try { for (const s of N.ships()) N.shipTick(s, dt); for (const g of G.ents) if (g.harbourGun && !g.removed) N.gunTick(g, dt); } catch (e) { if (!N._w1) { N._w1 = true; console.warn('naval', e); } }
    try { N.cpuTick(dt); } catch (e) { if (!N._w2) { N._w2 = true; console.warn('naval cpu', e); } }
  };
  // the city is set up (new world, a rebuilt town): its guns and its fleet come back
  const sd0 = War.spawnDefenses;
  War.spawnDefenses = function (f) { const r = sd0.apply(this, arguments); try { N.hookRealm(); N.refreshGuns(f); N.spawnFleet(f); } catch (e) { console.warn('naval', e); } return r; };
})();

// ---- riding the warships: a free ride with your own fleet (naval ride) ----
// Walk up to one of your kingdom's warships (or answer the call when the fleet sails) and climb aboard: you stand on her
// deck and sail with her, free to walk the deck and to shoot or cast from it. Go ashore by the gangplank in harbour, or
// by the ship's boat at the enemy's coast when she lays siege. If she sinks under you, you swim for it (or wash ashore
// far out at sea). Nobody boards the other kingdom's ships. p.onShip: the ship; p.deckPos: [along, across] in pixels
// from her middle (along toward the bow); 3D: actors.js floorOf → K3.shipDeckY (naval3d.js) for the deck height.
(function () {
  const KR = window.KR, D = KR.D, G = KR.G, W = KR.W, Sys = KR.Sys, U = KR.U, War = KR.War; const TS = D.TS;
  const N = War && War.naval; if (!N) return;
  const DIM = { galleon: { L: 440, B: 132 }, longship: { L: 300, B: 68 } }; // her length and beam in pixels (20 px a metre)
  const pf = () => (G.player && G.player.c ? G.player.c.faction : null);
  const sfx = (n, v) => { try { KR.A.sfx(n, v); } catch (e) {} };
  const mainRealm = () => !W.realm || W.realm === 'main';
  const R = (N.ride = {});
  // the deck: a lens shape inside the bulwarks
  const clampDeck = (s, along, across) => { const d = DIM[s.navalKind] || DIM.galleon; const half = d.L / 2 - 30; along = U.clamp(along, -half, half);
    const k = Math.pow(Math.max(0, 1 - Math.pow(along / (d.L / 2), 2)), 0.4); const w = (d.B / 2) * 0.78 * k; return [along, U.clamp(across, -w, w)]; };
  const toWorld = (s, a, c) => { const h = s.heading || 0, ch = Math.cos(h), sh = Math.sin(h); return [s.x + ch * a - sh * c, s.y + sh * a + ch * c]; };
  R.DIM = DIM; R.clampDeck = clampDeck; R.toWorld = toWorld; // (3D: jumping aboard and over the side, js3d/boarding3d.js)
  const place = (p) => { const s = p.onShip; const [x, y] = toWorld(s, p.deckPos[0], p.deckPos[1]); p.x = x; p.y = y; p.homeX = x; p.homeY = y; p.moveTo = null; R.placed = [x, y]; };
  // walking the deck: the step turned into her frame, kept inside the bulwarks
  G.deckMove = function (p, dx, dy) {
    const s = p.onShip; if (!s) return; const h = s.heading || 0, ch = Math.cos(h), sh = Math.sin(h);
    p.deckPos = clampDeck(s, p.deckPos[0] + dx * ch + dy * sh, p.deckPos[1] - dx * sh + dy * ch); place(p);
  };
  // the nearest dry, open ground to a point (a beach, a quay), searched outward in rings
  R.landNear = function (px, py, maxR = 60) {
    const cx = Math.floor(px / TS), cy = Math.floor(py / TS); const T = KR.T;
    for (let r = 0; r <= maxR; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue; const x = cx + i, y = cy + j; if (!W.inb(x, y)) continue;
      const t = W.tile(x, y); if (t === T.WATER || t === T.DEEP) continue; if (W.isBlockedTile(x, y)) continue;
      return [x * TS + 16, y * TS + 16];
    }
    return null;
  };
  R.canBoard = function (s) { const p = G.player; return !!(p && s && s.ship && !s.dead && !s.removed && !s.sinking && s.faction === pf() && !p.onShip && !p.dead && mainRealm()); };
  // close by her side, or (in harbour) anywhere along the waterfront: the ship's boat comes in to fetch you
  R.reach = (s) => (s.state === 'moor' ? 1000 : 260);
  R.near = function () { const p = G.player; if (!p || p.onShip || !mainRealm()) return null; let best = null, bd = 1e9; for (const s of N.alive(pf())) { const d = Math.hypot(s.x - p.x, s.y - p.y) - (s.r || 70) - R.reach(s); if (d < bd) { bd = d; best = s; } } return best && bd < 0 ? best : null; };
  R.board = function (s, opts = {}) {
    const p = G.player; if (!R.canBoard(s)) return false;
    if (!opts.far && Math.hypot(s.x - p.x, s.y - p.y) - (s.r || 70) > R.reach(s)) { G.log('Get closer to her first: walk out along the pier.', 'sys', '#ffb24a'); return false; }
    if (p.cast) G.interrupt && G.interrupt(p, 'You climb aboard and your spell fizzles.');
    p.boardFrom = R.landNear(p.x, p.y, 20) || [p.x, p.y]; p.onShip = s; p.deckPos = clampDeck(s, -40, 0); p.swim = false; place(p);
    if (!opts.quiet) G.log(`You climb aboard the ${s.name}. Walk her deck, and go ashore when she lies off the enemy's coast. (/disembark)`, 'status', '#9ad8ff'); sfx('door', 0.5);
    return true;
  };
  R.leave = function (why) {
    const p = G.player; const s = p && p.onShip; if (!s) return false;
    const st = s.state;
    if (why !== 'sink' && why !== 'force' && st !== 'moor' && st !== 'siege') {
      // under way: you may only jump over the side close enough to land to swim for it
      const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
      if (!(W.swimmable && W.swimmable(tx, ty))) { G.log('Not out here in open water: wait until she drops anchor off the coast or in harbour.', 'sys', '#ffb24a'); return false; }
      p.onShip = null; p.deckPos = null; G.log('You leap over the side into the sea!', 'status', '#9ad8ff'); sfx('splash', 0.8); return true;
    }
    const at = R.landNear(s.x, s.y, 80) || p.boardFrom;
    p.onShip = null; p.deckPos = null;
    if (why === 'sink') { const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS); if (W.swimmable && W.swimmable(tx, ty)) { G.log(`The ${s.name} goes down beneath you: swim for the shore!`, 'status', '#ff8a6a'); sfx('splash', 0.9); return true; }
      G.log(`The ${s.name} goes down. You cling to the wreckage and wash up on the shore.`, 'status', '#ff8a6a'); }
    else G.log(st === 'siege' ? 'The ship\'s boat rows you through the surf and runs up on the beach.' : 'You walk down the gangplank onto the quay.', 'status', '#9ad8ff');
    if (at) { p.x = at[0]; p.y = at[1]; p.homeX = p.x; p.homeY = p.y; }
    sfx('door', 0.4); return true;
  };
  // every tick, after the ships have sailed: carry the rider along; let go if she sinks or the hero is moved off her
  const tk0 = War.tick;
  War.tick = function (dt) {
    tk0.apply(this, arguments);
    const p = G.player; const s = p && p.onShip; if (!s) return;
    if (!mainRealm() || p.dead) { p.onShip = null; p.deckPos = null; return; }
    if (s.removed || s.sinking || s.dead) { R.leave('sink'); return; }
    if (R.placed && Math.hypot(p.x - R.placed[0], p.y - R.placed[1]) > 220) { p.onShip = null; p.deckPos = null; return; } // a teleport, a gate spell: off the ship
    place(p);
  };
  // the call to sail: when you send the fleet out from home, you may go with it
  const send0 = War.sendFleet;
  War.sendFleet = function (f) {
    const k = send0.apply(this, arguments); const p = G.player;
    if (k && p && (f || pf()) === pf() && !p.onShip && mainRealm()) R.offerUntil = G.now + 90000;
    return k;
  };
  // saves never keep you out at sea: they keep the ground you boarded from
  for (const fn of ['save', 'saveAccount']) { const o = Sys[fn]; if (!o) continue; Sys[fn] = function () { const p = G.player; if (!p || !p.onShip || !p.boardFrom) return o.apply(this, arguments); const x = p.x, y = p.y; p.x = p.boardFrom[0]; p.y = p.boardFrom[1]; try { return o.apply(this, arguments); } finally { p.x = x; p.y = y; } }; }
  // chat: /board, /disembark (/ashore, /overboard)
  const cmd0 = Sys.command;
  if (cmd0) Sys.command = function (ln) {
    const t = String(ln || '').trim().toLowerCase().split(/\s+/)[0];
    if (t === '/board' || t === '/embark') { const s = R.near() || (R.offerUntil > G.now && N.alive(pf())[0]); if (!s) G.log('None of your warships is close enough to board.', 'sys', '#ffb24a'); else R.board(s, { far: R.offerUntil > G.now }); return; }
    if (t === '/disembark' || t === '/ashore' || t === '/overboard') { if (!G.player || !G.player.onShip) G.log('You are not aboard a ship.', 'sys', '#ffb24a'); else R.leave(t === '/overboard' ? 'jump' : null); return; }
    return cmd0.apply(this, arguments);
  };
  // the prompt: a small button above the hotbar when a ride is on offer, while aboard, and to go ashore
  let el = null, lastTxt = '';
  const css = '#ride-prompt{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:40;display:flex;gap:8px;align-items:center;padding:8px 12px;border-radius:10px;background:rgba(14,20,30,.82);border:1px solid #6a8aa8;color:#d8e8f8;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.5)}#ride-prompt button{font:700 14px system-ui,sans-serif;padding:6px 12px;border-radius:8px;border:1px solid #9ac0e0;background:linear-gradient(#2a4a6a,#1a3048);color:#eaf4ff;cursor:pointer}#ride-prompt button:hover{filter:brightness(1.25)}#ride-prompt button[disabled]{opacity:.45;cursor:default}';
  function ui() {
    const p = G.player; if (!p || !p.c || document.body.classList.contains('k3-menu')) { if (el) el.hidden = true; return; }
    let txt = '', btns = [];
    if (p.onShip) {
      const s = p.onShip; const where = ({ moor: 'at anchor in harbour', out: 'under sail', siege: 'lying off the enemy coast', home: 'sailing home' })[s.state] || s.state;
      txt = `⚓ Aboard the ${s.name}, ${where}`;
      if (R.jumpable) txt += ': jump over the side to leave (Space at her rail)';
      if (s.state === 'moor' || s.state === 'siege') btns.push([s.state === 'siege' ? 'Row ashore' : 'Go ashore', () => R.leave()]);
      else btns.push(['Jump overboard', () => R.leave('jump')]);
    } else {
      const s = R.near(); const offer = R.offerUntil > G.now && N.alive(pf()).some((x) => x.state === 'out');
      if (s && R.jumpable && R.jumpable(s)) txt = `⚓ The ${s.name}: jump aboard (Space)`;
      else if (s && !R.jumpable) { txt = `⚓ The ${s.name}`; btns.push(['Climb aboard', () => R.board(s)]); }
      else if (offer) { const lead = N.alive(pf()).find((x) => x.state === 'out'); if (lead) { txt = '⚓ The fleet sails'; btns.push([`Ride with the ${lead.name}`, () => { if (R.board(lead, { far: true })) R.offerUntil = 0; }]); } }
    }
    const key = txt + btns.map((b) => b[0]).join('|');
    if (!txt) { if (el) el.hidden = true; return; }
    if (!el) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); el = document.createElement('div'); el.id = 'ride-prompt'; document.body.appendChild(el); }
    el.hidden = false; if (key === lastTxt) return; lastTxt = key;
    el.innerHTML = ''; const sp = document.createElement('span'); sp.textContent = txt; el.appendChild(sp);
    for (const [label, fn] of btns) { const b = document.createElement('button'); b.textContent = label; b.onclick = (ev) => { ev.stopPropagation(); fn(); lastTxt = ''; ui(); }; el.appendChild(b); }
  }
  setInterval(() => { try { ui(); } catch (e) {} }, 250);
})();

// ---- sallying out: your own gates open for your own army ----
// (found by the balance simulation: enemy hunting parties near the town kept the alarm ringing, the portcullis stayed
// down, and a war party ordered out could never leave its own walls.) Ordering an attack raises your gates and keeps
// them up for a minute while the column marches out; then the alarm works as before.
(function () {
  const KR = window.KR, G = KR.G, War = KR.War; if (!War || !War.orderAttack || !War.closeGates) return;
  War.sallyUntil = War.sallyUntil || {};
  const close0 = War.closeGates;
  // ...and they stay up while the column you sent out is still inside your walls (for up to five minutes)
  const leaving = (f) => War.squads.some((s) => s.f === f && !s.hunt && G.now - (s.startedAt || s.started || 0) < 300000 && s.members.some((m) => !m.dead && !m.removed && (m.warState === 'march' || m.warState === 'mustering') && War.insideWalls && War.insideWalls(f, m.x, m.y)));
  War.closeGates = function (f) { if ((War.sallyUntil[f] && G.now < War.sallyUntil[f]) || leaving(f)) return 0; return close0.apply(this, arguments); };
  // a soldier on the march who can't get at what it is fighting (behind a wall, across water) lets it go after a few
  // seconds, so the whole column doesn't stand still forever (the squad only moves on when nobody is in combat)
  const ur0 = War.updateRaider;
  War.updateRaider = function (r, dt) {
    const out = ur0.apply(this, arguments);
    try {
      if (r && !r.dead && r.warState === 'march' && r.inCombat) {
        const t = G.topHate(r); const d = t ? Math.hypot(t.x - r.x, t.y - r.y) : 0;
        // only what is within reach stops the column: archers on a wall or a foe across water don't
        if (t && d > (r.ranged ? 340 : 240)) { r.hate.delete(t); r.inCombat = false; r.scanT = 6; r._stallD = null; return out; }
        const dealt = t && t.lastHit && G.now - t.lastHit < 4000 && t._hurtBy && t._hurtBy.has(r);
        if (!t || dealt || r._stallD == null || d < r._stallD - 12) { r._stallD = d; r._stallAt = G.now; }
        else if (G.now - r._stallAt > 8000) { if (t) r.hate.delete(t); r.inCombat = false; r.scanT = 20; r._stallD = null; }
      } else if (r) r._stallD = null;
    } catch (e) {}
    return out;
  };
  // a battering ram (or troll) wedged in a narrow gateway on the march edges forward along its route, so the whole
  // column (which waits for its leader) doesn't stand still forever
  if (War.ramTick) { const rt0 = War.ramTick; War.ramTick = function (r, dt) {
    const x0 = r.x, y0 = r.y; const out = rt0.apply(this, arguments);
    try {
      if (r && !r.dead && r.warState === 'march') {
        if (Math.hypot(r.x - x0, r.y - y0) > 0.5 * dt * 10) r._wedgedT = 0; else r._wedgedT = (r._wedgedT || 0) + dt;
        if (r._wedgedT > 6) { const T = War.formationTarget(r); if (T) { const d = Math.hypot(T.x - r.x, T.y - r.y); if (d > 4) { const st = Math.min(d, (D.RAM ? D.RAM.speed : 100) * dt); r.x += (T.x - r.x) / d * st; r.y += (T.y - r.y) / d * st; r.moving = true; } } }
      }
    } catch (e) {}
    return out;
  }; }
  const order0 = War.orderAttack;
  War.orderAttack = function (f) {
    const ff = f || (G.player && G.player.c.faction);
    if (ff) { War.sallyUntil[ff] = G.now + 90000; if (War.gatesDown(ff)) { War.openGates(ff, true); if (G.player && G.player.c.faction === ff) G.log('The gates swing open to let your army march out.', 'status', '#9affb8'); } }
    const r = order0.apply(this, arguments);
    if (ff) for (const sq of War.squads) if (sq.f === ff && !sq.hunt && !sq.startedAt) sq.startedAt = G.now;
    return r;
  };
})();
