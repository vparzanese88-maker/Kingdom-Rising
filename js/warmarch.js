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
    if (!War.hasB(f, R.need)) return fail(`${R.name}: build the ${({ barracks: 'Barracks', range: 'Archery Range', stable: 'Stable', workshop: 'Siege Workshop' })[R.need]} first.`);
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
    let k = 0; while (have < n && hireOne(f, 'guard', null, k > 0)) { have++; k++; }
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
    const towerKind = ['archer', 'ballista', 'heavyballista'][U.clamp(df.towerLvl || 0, 0, 2)];
    const inside = []; for (let i = 0; i < (E.trebuchet || 0); i++) inside.push('trebuchet'); for (let i = 0; i < (E.catapult || 0); i++) inside.push('catapult');
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
        const pick = opts.find((r) => r.id === 'ram' && !r.have) || opts.find((r) => r.kind === 'guard' && r.have < Math.min(r.max, 4)) || opts.find((r) => r.kind === 'siege' && r.id !== 'ram' && !r.have && cs.t > 40 * 60)
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
    if (id === 'towers') id = 'tower'; const nm = { sawmill: 'Sawmill', cutter: 'Stone Cutter', barracks: 'Barracks', range: 'Archery Range', stable: 'Stable', workshop: 'Siege Workshop', walls: 'walls', tower: 'archer tower', towerUp: 'towers' }[id] || id;
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
    const bn = { barracks: 'Barracks', range: 'Archery Range', stable: 'Stable', workshop: 'Siege Workshop' };
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
