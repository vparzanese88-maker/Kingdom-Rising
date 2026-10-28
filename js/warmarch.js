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
    const cd = W.cityData[f]; if (!cd || !cd.gates) return [];
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
    if (!s || s.cd !== cd || !cd || s.R !== cd.R || s.cx !== cd.cx || s.block !== W.block) {
      if (s) for (const g of s.list) if (g.closed) setBlock(g, false);
      s = GS[f] = { cd, R: cd && cd.R, cx: cd && cd.cx, block: W.block, list: mainRealm() ? buildGates(f) : [] };
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
      if (!mine || War.ramCount(f) > 0) {
        const ram = makeRam(sq); sq.ram = ram; sq.members.push(ram); sq.order.unshift(ram);
        if (mine && !quiet) G.log('Your battering ram rolls out at the head of the column. The soldiers fall in behind it.', 'status', '#9affb8');
        else if (!quiet && mineF(sq.ef)) G.log(`Scouts report a battering ram at the head of the ${D.FACTIONS[f].city} column.`, 'status', '#ffb24a');
      } else if (!quiet) G.log(`No battering ram marches with them: if the gates of ${D.FACTIONS[sq.ef].city} are shut, your soldiers cannot get in. Build one at the barracks (Kingdom Level ${D.RAM.tier}).`, 'sys', '#ffb24a');
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
    if (!r.dead && r.ram) return War.ramTick(r, dt);
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
      const w = acctWar(); if (w && mineF(r.faction) && w.rams[r.faction] > 0) w.rams[r.faction]--;
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
      const t = mk('tower', s[0] * TS + 16, s[1] * TS + 16, { type: 'guard', title: `Tier ${tier} defense`, level: lv, name: `${D.FACTIONS[f].city} ${def.name}` });
      War.makeSiege(t, kind); t.big = true; t.r = kind === 'trebuchet' ? 46 : 38; t.h = kind === 'trebuchet' ? 230 : 120; t.aggroR = def.range;
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
    const v = near(t.x, t.y, 1100); sfx('whoosh', v * 0.8); sfx('creak', v * 0.6);
    const dmg = () => Math.round(t.dmg * (0.75 + Math.random() * 0.5));
    const d = Math.hypot(tg.x - t.x, tg.y - t.y);
    G.shoot(t, tg, 'boulder', -1, { arc: U.clamp(d * 0.05 * 0.42, 5, 26), onHit: () => {
      const x = tg.x, y = tg.y; G.fxAdd({ k: 'ring', x, y, r: def.aoe, col: '#c8b090', life: 0.8 });
      War.ev({ k: 'impact', x, y, r: def.aoe, big: t.siege === 'trebuchet' });
      const w = near(x, y, 1200); sfx('heavy', w); sfx('rockbreak', w * 0.8); const pp = G.player; if (pp && Math.hypot(x - pp.x, y - pp.y) < 600) G.shake = Math.max(G.shake || 0, 0.7);
      for (const e of G.ents.concat(G.player ? [G.player] : [])) if (War.isFoe(t.faction, e) && Math.hypot(e.x - x, e.y - y) < def.aoe + (e.r || 12)) G.damage(t, e, Math.round(G.mitigate(t, e, dmg()) * (e === tg ? 1 : 0.6)), {});
    } });
    const pr = G.proj[G.proj.length - 1]; if (pr && pr.src === t) pr.speed = Math.max(300, d / 2.6);
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
