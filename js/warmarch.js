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
