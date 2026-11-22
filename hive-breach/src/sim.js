// The battle itself. Only the host (or a solo player) runs this; friends receive what it decides.
import { CLASSES, TURRETS, UPG_COST, MAX_TURRETS, UPGRADES, UPG_PRICES, ALIENS, WAVES, waveList, hpScale, BOUNDS, countScale, bossScale } from './data.js';
import { placeError } from './world.js';
import { PATH_W, ALLIES, DROP_EVERY, DROP_COST, SQUAD, SQUAD_COST, MAX_ALLIES } from './data.js';

const LV = { dmg: [1, 1.6, 2.4], rng: [1, 1.12, 1.25], rate: [1, 1.15, 1.32] };
export const BUILD = { minigun: 4, tesla: 5, missile: 6, barricade: 3, repair: 4, stasis: 3, flamer: 4, railgun: 6, mines: 2, beacon: 3 };
export const START_GOLD = 250, FIRST_COUNT = 45, NEXT_COUNT = 25;
export function maxHp(cls, ups) { return CLASSES[cls].hp + 25 * (ups.hp || 0); }
export function tStat(t) { const T = TURRETS[t.kind], l = t.lvl - 1; return { mark: T.mark ? T.mark + 0.1 * l : 0, range: (T.range || 0) * LV.rng[l], dmg: (T.dmg || 0) * LV.dmg[l], rate: (T.rate || 0) * LV.rate[l], heal: (T.heal || 0) * LV.dmg[l], chain: (T.chain || 0) + l, slow: T.slow ? Math.max(0.25, T.slow - l * 0.08) : 0, splash: T.splash || 0 }; }
export function upgradeCost(t) { return t.lvl >= 3 ? 0 : Math.round(TURRETS[t.kind].cost * UPG_COST[t.lvl]); }

export class Sim {
  constructor(W, emit) {
    this.W = W; this.path = W.path; this.emit = emit; this.players = new Map(); this.reset();
  }
  reset() {
    this.wave = 0; this.phase = 'build'; this.timer = FIRST_COUNT; this.hub = 100; this.hubMax = 100; this.aliens = []; this.turrets = []; this.shells = []; this.pods = []; this.q = []; this.qt = 0; this.nid = 1; this.endless = false; this.podT = 0; this.storm = 0; this.meteors = []; this.allies = []; this.allyN = 0; this.cmd = { lv: 0, sz: 0, un: ['trooper'], t: DROP_EVERY[0] }; this.spawnHive(1);
    for (const p of this.players.values()) this.resetPlayer(p);
  }
  resetPlayer(p) { p.gold = START_GOLD; p.ups = { dmg: 0, rate: 0, mag: 0, spd: 0, hp: 0, arm: 0 }; p.mhp = p.hp = maxHp(p.cls, p.ups); p.dead = false; p.rt = 0; p.kills = 0; p.sp = (p.sp || 0) + 1; }
  addPlayer(id, name, cls) {
    let p = this.players.get(id); if (p) { p.name = name; if (p.cls !== cls) { p.cls = cls; p.mhp = maxHp(cls, p.ups); p.hp = Math.min(p.hp, p.mhp); } return p; }
    { const f = bossScale(this.players.size + 1) / bossScale(this.players.size); for (const a of this.aliens) if (a.type === 'guardian' || a.type === 'hivecore') { a.hp *= f; a.mhp *= f; } }
    p = { id, name, cls, x: this.W.spawn.x, y: this.W.top(this.W.spawn.x, this.W.spawn.z), z: this.W.spawn.z, yaw: 0, sp: 0, seen: 0 }; this.resetPlayer(p); p.gold = START_GOLD + this.wave * 55; this.players.set(id, p);
    this.emit({ k: 'toast', m: `${name} (${CLASSES[cls].name}) has joined the defense. Squad of ${this.players.size}: the hive sends more, tougher aliens.` }); return p;
  }
  removePlayer(id) { const p = this.players.get(id); if (!p) return; this.players.delete(id); this.emit({ k: 'toast', m: p.name + ' left.' }); }
  living() { return [...this.players.values()].filter(p => !p.dead); }

  // ---------------------------------------------------------------- requests from marines
  request(id, r) {
    const p = this.players.get(id); if (!p) return; const say = m => this.emit({ k: 'say', to: id, m });
    if (r.a === 'start') { if (this.phase === 'build') this.timer = 0.01; else if (this.phase === 'lose') { this.reset(); this.emit({ k: 'toast', m: 'Defense restarted.' }); } else if (this.phase === 'win') { this.endless = true; this.phase = 'build'; this.timer = NEXT_COUNT; this.spawnHive(1); this.emit({ k: 'toast', m: 'Endless mode: the hive keeps coming.' }); } return; }
    if (p.dead || this.phase === 'lose') return;
    if (r.a === 'place') {
      const T = TURRETS[r.kind], C = CLASSES[p.cls]; if (!T || (C.sentry !== r.kind && C.defense !== r.kind)) return;
      if (p.gold < T.cost) return say(`Need ${T.cost} gold for a ${T.name}.`);
      if (this.turrets.filter(t => t.owner === id).length >= MAX_TURRETS) return say(`You can have ${MAX_TURRETS} at once. Sell one (X) first.`);
      const err = placeError(r.kind, r.x, r.z, this.path, this.turrets, this.W.hubP, this.W.hiveP, this.W.T); if (err) return say(err);
      p.gold -= T.cost; const t = { id: this.nid++, kind: r.kind, owner: id, x: r.x, z: r.z, ry: r.ry || 0, lvl: 1, hp: T.hp, mhp: T.hp, cd: 0, tg: 0, spent: T.cost, ch: T.charges || 0, y: this.W.top(r.x, r.z), b: BUILD[r.kind], bt: BUILD[r.kind], fresh: true };
      if (T.onPath) { const n = this.path.near(r.x, r.z); t.s = n.s; t.x = n.x; t.z = n.z; t.y = this.path.y(n.s); t.ry = Math.atan2(n.tx, n.tz); }
      this.turrets.push(t); this.emit({ k: 'placed', x: t.x, z: t.z, by: id });
    } else if (r.a === 'upg') {
      const t = this.turrets.find(q => q.id === r.id); if (!t || t.lvl >= 3) return; const c = upgradeCost(t); if (p.gold < c) return say(`Need ${c} gold to upgrade.`);
      if (t.b > 0) return say('That turret is still under construction.'); p.gold -= c; t.spent += c; t.next = t.lvl + 1; t.b = t.bt = 3 + 2 * t.lvl; this.emit({ k: 'upgstart', id: t.id, by: id, x: t.x, z: t.z });
    } else if (r.a === 'sell') {
      const i = this.turrets.findIndex(q => q.id === r.id && q.owner === id); if (i < 0) return; const t = this.turrets[i]; p.gold += Math.round(t.spent * 0.6 * t.hp / t.mhp); this.turrets.splice(i, 1); this.emit({ k: 'boom', x: t.x, y: 0.5, z: t.z, r: 1.5, small: 1 });
    } else if (r.a === 'buy') {
      if (!UPGRADES.some(u => u.id === r.up)) return; const lv = p.ups[r.up] || 0; if (lv >= 5) return; const c = UPG_PRICES[lv]; if (p.gold < c) return say(`Need ${c} gold.`);
      p.gold -= c; p.ups[r.up] = lv + 1; const m = maxHp(p.cls, p.ups); p.hp += m - p.mhp; p.mhp = m; this.emit({ k: 'bought', to: id });
    } else if (r.a === 'hit') {
      const a = this.aliens.find(q => q.id === r.id); if (a) this.hurtAlien(a, Math.min(+r.d || 0, 400), id, r.ap);
    } else if (r.a === 'cmd') {
      const C = this.cmd; let c = 0, msg = '';
      if (r.w === 'rate') { if (C.lv >= DROP_EVERY.length - 1) return; c = DROP_COST[C.lv + 1]; if (p.gold < c) return say(`Need ${c} gold.`); C.lv++; msg = `Reinforcements now every ${DROP_EVERY[C.lv]} s`; }
      else if (r.w === 'size') { if (C.sz >= SQUAD.length - 1) return; c = SQUAD_COST[C.sz + 1]; if (p.gold < c) return say(`Need ${c} gold.`); C.sz++; msg = `Reinforcements now ${SQUAD[C.sz]} marines per drop`; }
      else if (ALLIES[r.w] && !C.un.includes(r.w)) { c = ALLIES[r.w].unlock; if (p.gold < c) return say(`Need ${c} gold.`); C.un.push(r.w); msg = `${ALLIES[r.w].name}s will now join the reinforcements`; }
      else return;
      p.gold -= c; this.emit({ k: 'toast', m: `${p.name}: ${msg}.` }); this.emit({ k: 'bought', to: id });
    } else if (r.a === 'fall') {
      this.hurtPlayer(p, 15);
    } else if (r.a === 'boom') {
      this.splash(+r.x, +r.y, +r.z, Math.min(+r.r || 0, 7), Math.min(+r.d || 0, 600), id);
    }
  }
  pose(id, x, y, z, yaw, kn) { const p = this.players.get(id); if (!p || p.dead) return; p.kn = kn ? 1 : 0; p.x = Math.max(-BOUNDS, Math.min(BOUNDS, x)); p.y = y; p.z = Math.max(-BOUNDS, Math.min(BOUNDS, z)); p.yaw = yaw; }

  // ---------------------------------------------------------------- damage
  hurtAlien(a, d, owner, ap) {
    if (a.hp <= 0) return; a.lastHit = this.time; if (a.markT > 0) d *= a.mark || 1;
    if (a.type === 'hivecore' && !this.hiveOpen()) { if (owner && this.time - (a.said || -9) > 4) { a.said = this.time; this.emit({ k: 'say', to: owner, m: 'The hive is shielded while a Hive Guardian stands. Destroy both Guardians to drop the shield.' }); } return; } const A = ALIENS[a.type]; a.hp -= d * (ap ? 1 : 1 - (A.armor || 0));
    if (a.hp <= 0) this.killAlien(a, owner);
  }
  splash(x, y, z, r, d, owner) {
    this.emit({ k: 'boom', x, y, z, r });
    for (const a of this.aliens) { const dist = Math.hypot(a.x - x, a.y + ALIENS[a.type].h * 0.5 - y, a.z - z) - ALIENS[a.type].r; if (dist < r) this.hurtAlien(a, d * (1 - Math.max(0, dist) / r * 0.6), owner, true); }
  }
  killAlien(a, owner) {
    a.dead = true; const A = ALIENS[a.type]; this.emit({ k: 'die', id: a.id, x: a.x, y: a.y, z: a.z, t: a.type });
    const p = this.players.get(owner); if (p) p.kills++;
    for (const q of this.players.values()) q.gold += Math.round(A.bounty * (q.id === owner ? 1 : 0.4));
    if (A.boss || a.type === 'guardian') this.emit({ k: 'toast', m: `${A.name} destroyed${p ? ' by ' + p.name : ''}!`, big: 1 });
    if (a.type === 'guardian' && !this.aliens.some(q => q.type === 'guardian' && !q.dead)) this.emit({ k: 'banner', a: 'HIVE SHIELD DOWN', b: 'Destroy the hive now to win!' });
    if (a.type === 'hivecore') { this.phase = 'win'; this.emit({ k: 'win', w: this.wave }); }
  }
  closest(list, a, r, dy = 99) { let best = null, bd = r; for (const q of list) { if (q.dead) continue; const d = Math.hypot(q.x - a.x, q.z - a.z); if (d < bd && Math.abs((q.y || 0) - a.y) < dy + 3) { bd = d; best = q; } } return best; }
  aggro(a, k, id, time) { a.mode = 'hunt'; a.tk = k; a.tid = id; a.ht = time ? (ALIENS[a.type].hunt || {}).time || 8 : (ALIENS[a.type].hunt || {}).time || 8; this.emit({ k: 'aggro', x: a.x, z: a.z, to: k === 'p' ? id : '', t: a.type }); }
  hurtPlayer(p, d, by) {
    if (p.dead) return; p.hp -= d * (1 - 0.08 * (p.ups.arm || 0)); if (by) this.emit({ k: 'hitp', to: p.id, x: +by.x.toFixed(1), z: +by.z.toFixed(1) });
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.rt = 7; this.emit({ k: 'toast', m: p.name + ' is down! Back in 7 seconds.' }); }
  }
  hurtTurret(t, d, by) { t.hp -= d; if (by && this.time - (t.warned || -99) > 5) { t.warned = this.time; this.emit({ k: 'tatk', id: t.id, o: t.owner, kind: t.kind, x: t.x, z: t.z }); } if (t.hp <= 0) { this.turrets = this.turrets.filter(q => q !== t); this.emit({ k: 'boom', x: t.x, y: 1, z: t.z, r: 2.5 }); this.emit({ k: 'say', to: t.owner, m: `Your ${TURRETS[t.kind].name} was destroyed.` }); } }

  // ---------------------------------------------------------------- waves
  startWave() {
    this.wave++; this.phase = 'wave'; this.q = []; let t = 0;
    const N = this.players.size, cs = countScale(N);
    for (const [type, n0, gap0] of waveList(this.wave, this.W.id)) { const boss = ALIENS[type].boss, n = boss ? n0 : Math.round(n0 * cs), gap = boss ? gap0 : gap0 / (1 + 0.3 * (N - 1)); for (let i = 0; i < n; i++) { this.q.push({ type, t }); t += gap; } t += 2.5; }
    this.qt = 0; this.emit({ k: 'wave', w: this.wave, boss: this.q.some(e => ALIENS[e.type].boss) ? this.q.find(e => ALIENS[e.type].boss).type : '' });
    this.dropPods(2);
    if (this.W.def.hazard === 'nests' && this.wave >= 2) for (const n of this.W.nestP) if (!this.aliens.some(a => a.nestOf === n.i)) { const a = this.spawn('nest', n.s); a.x = n.x; a.z = n.z; a.y = n.y; a.nestOf = n.i; a.qcd = 8 + n.i * 6; a.mode = 'nest'; }
    this.hzT = 25 + Math.random() * 15;
  }
  dropPods(n) {
    for (let i = 0; i < n; i++) {
      let x, z, ok = false; for (let k = 0; k < 30 && !ok; k++) { x = (Math.random() * 2 - 1) * (BOUNDS - 10); z = (Math.random() * 2 - 1) * (BOUNDS - 10); ok = this.path.near(x, z).d > 6 && this.W.T.chasm(x, z) > 0.99 && this.W.T.ridge(x, z) < 2 && Math.hypot(x - this.W.hiveP.x, z - this.W.hiveP.z) > 15 && !this.W.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 1.5); }
      if (ok) { const pod = { id: this.nid++, x, z }; this.pods.push(pod); }
    }
    if (n) this.emit({ k: 'toast', m: 'Supply pods dropped. Grab them for gold.' });
  }
  spawn(type, s = 0) {
    const A = ALIENS[type], p = this.path.at(s), lat = (Math.random() - 0.5) * (A.boss ? 0.5 : 3.2), sc = A.boss ? hpScale(this.wave, 1) * bossScale(this.players.size) : hpScale(this.wave, this.players.size), hp = A.hp * sc;
    const a = { id: this.nid++, type, s, lat, x: p.x - p.tz * lat, y: p.y + (A.fly ? 4.5 : 0), z: p.z + p.tx * lat, hp, mhp: hp, ry: Math.atan2(-p.tx, -p.tz), spd: A.speed * (0.92 + Math.random() * 0.16), slowT: 0, stun: 0, atk: 0, mode: 'path', cc: Math.random() * 3, tgt: null, rcd: 1 + Math.random() * 2, qcd: 6 };
    this.aliens.push(a); if (A.boss) this.emit({ k: 'roar', t: type }); return a;
  }

  update(dt) {
    const P = this.path, T = this.W.T; this.time = (this.time || 0) + dt;
    // marines
    for (const p of this.players.values()) {
      if (p.dead) { p.rt -= dt; if (p.rt <= 0) { p.dead = false; p.hp = p.mhp; p.sp++; p.x = this.W.spawn.x; p.z = this.W.spawn.z; p.y = this.W.top(p.x, p.z); } continue; }
      if (this.phase === 'wave') p.gold += dt * (1.6 + this.wave * 0.08);
      p.regen = this.hub > 0 && Math.hypot(p.x - this.W.hubP.x, p.z - this.W.hubP.z) < 15 && p.hp < p.mhp; if (p.regen) p.hp = Math.min(p.mhp, p.hp + 16 * dt);
      for (const pod of this.pods) if (!pod.got && Math.hypot(pod.x - p.x, pod.z - p.z) < 2.2) { pod.got = true; const g = 60 + this.wave * 10; for (const q of this.players.values()) q.gold += q === p ? g : Math.round(g * 0.4); this.emit({ k: 'pod', by: p.id, g, x: pod.x, z: pod.z }); }
    }
    if (this.pods.some(q => q.got)) this.pods = this.pods.filter(q => !q.got);
    if (this.phase === 'lose' || this.phase === 'win') return;

    if (this.phase === 'build') { if (this.timer > 0) { this.timer -= dt; if (this.timer <= 0) this.startWave(); } }
    else if (this.phase === 'assault') { this.hazards(dt); }
    else if (this.phase === 'wave') {
      this.qt += dt; while (this.q.length && this.q[0].t <= this.qt) this.spawn(this.q.shift().type);
      this.podT += dt; if (this.podT > 45) { this.podT = 0; this.dropPods(1); }
      this.hazards(dt);
      if (!this.q.length && !this.aliens.some(a => !ALIENS[a.type].static)) {
        const bonus = 60 + this.wave * 12; for (const p of this.players.values()) p.gold += bonus;
        if (this.wave === WAVES && !this.endless) { this.phase = 'assault'; this.emit({ k: 'assault', open: this.hiveOpen() ? 1 : 0 }); }
        else { this.phase = 'build'; this.timer = NEXT_COUNT; this.emit({ k: 'clear', w: this.wave, b: bonus }); }
      }
    }

    // turrets that change aliens around them
    for (const t of this.turrets) if (t.kind === 'stasis' && !t.fresh) { const st = tStat(t); for (const a of this.aliens) if (!ALIENS[a.type].boss || t.lvl > 1) if (Math.hypot(a.x - t.x, a.z - t.z) < st.range) { a.slowT = 0.15; a.slowF = st.slow; } }

    // aliens
    const living = this.living();
    for (const a of this.aliens) {
      if (a.dead) continue; const A = ALIENS[a.type]; a.cc -= dt; a.atk -= dt; a.rcd -= dt; if (a.markT > 0) a.markT -= dt;
      // nests sit off the track and hatch crawlers that go for the nearest marine
      if (A.nest) { a.qcd -= dt; if (a.qcd <= 0 && this.phase === 'wave') { a.qcd = 26 + Math.random() * 10; this.emit({ k: 'hatch', x: a.x, z: a.z }); for (let i = 0, nn = Math.round(4 * countScale(this.players.size)); i < nn; i++) { const c = this.spawn('crawler', a.s); c.x = a.x + (Math.random() - 0.5) * 3; c.z = a.z + (Math.random() - 0.5) * 3; c.y = this.W.ground(c.x, c.z, a.y + 1); c.lat = (Math.random() - 0.5) * 3; const p = this.closest(living, c, 45); if (p) this.aggro(c, 'p', p.id, 1.5); else c.mode = 'return'; } } continue; }
      if ((a.type === 'guardian' || a.type === 'hivecore') && this.time - (a.lastHit ?? -99) > 12) a.hp = Math.min(a.mhp, a.hp + a.mhp * 0.01 * dt);
      if (a.type === 'guardian') {
        if (a.rcd <= 0) { let tg = null, bd = A.guard; for (const p of living) { const d = Math.hypot(p.x - a.x, p.z - a.z); if (d < bd && Math.abs(p.y - a.y) < 12) { bd = d; tg = p; } } for (const m of this.allies) { const d = Math.hypot(m.x - a.x, m.z - a.z); if (d < bd) { bd = d; tg = m; } }
          if (tg) { a.rcd = 0.75; const isP = 'cls' in tg; this.emit({ k: 'spit', a: [a.x, a.y + 3.6, a.z], b: [tg.x, tg.y + 1.3, tg.z], q: 2 }); if (isP) this.hurtPlayer(tg, A.dmg, a); else this.hurtAlly(tg, A.dmg * 1.5); } }
        continue;
      }
      if (a.type === 'hivecore') { if (this.phase === 'assault' || this.hiveOpen()) { a.qcd -= dt; if (a.qcd <= 0) { a.qcd = 9; for (let i = 0, nn = Math.round(3 * countScale(this.players.size)); i < nn; i++) this.spawn('crawler', 2 + i); } } continue; }
      if (a.stun > 0) { a.stun -= dt; continue; }
      const sp = a.spd * (a.slowT > 0 ? (a.slowF ?? 0.5) : 1) * (this.storm > 0 ? 1.15 : 1); if (a.slowT > 0) a.slowT -= dt;
      // spitters and the queen shoot at marines first, then turrets
      if (A.ranged && a.rcd <= 0) {
        let tg = null, bd = A.ranged; for (const p of living) { const d = Math.hypot(p.x - a.x, p.z - a.z); if (d < bd) { bd = d; tg = p; } }
        if (!tg) for (const m of this.allies) { const d = Math.hypot(m.x - a.x, m.z - a.z); if (d < bd) { bd = d; tg = m; } }
        if (!tg) { bd = A.ranged * 0.85; for (const t of this.turrets) { if (TURRETS[t.kind].mine) continue; const d = Math.hypot(t.x - a.x, t.z - a.z); if (d < bd) { bd = d; tg = t; } } }
        if (tg) { a.rcd = a.type === 'queen' ? 1.4 : 2.2; const isP = 'cls' in tg; this.emit({ k: 'spit', a: [a.x, a.y + A.h, a.z], b: [tg.x, tg.y + (isP ? 1.3 : 1.2), tg.z], q: a.type === 'queen' ? 1 : 0 }); if (isP) this.hurtPlayer(tg, A.dmg, a); else if (tg.type && ALLIES[tg.type]) this.hurtAlly(tg, A.dmg); else this.hurtTurret(tg, A.dmg * 1.5, a); }
      }
      if (a.type === 'queen') { a.qcd -= dt; if (a.qcd <= 0) { a.qcd = 7; for (let i = 0; i < 3; i++) this.spawn('crawler', Math.max(0, a.s - 2 - i)); } }
      const home = P.at(a.s), hx = home.x - home.tz * a.lat, hz = home.z + home.tx * a.lat;
      // on the track: every alien stops at a barricade and tears it down
      if (a.mode === 'path') {
        let wall = null; for (const t of this.turrets) if (t.kind === 'barricade' && !t.fresh && t.s > a.s && t.s - a.s < A.r + 0.9) { wall = t; break; }
        if (wall) { this.face(a, wall.x - a.x, wall.z - a.z); if (a.atk <= 0) { a.atk = 1; this.hurtTurret(wall, A.dmg * (a.type === 'brute' || A.boss ? 2.2 : 1), a); this.emit({ k: 'bite', x: a.x, z: a.z }); } if (A.fly) a.y += (P.y(a.s) + 2 - a.y) * Math.min(1, dt * 3); continue; }
        // something worth leaving the track for?
        if (A.hunt && a.cc <= 0) { const H = A.hunt, tt = H.t && this.closest(this.turrets.filter(t => !TURRETS[t.kind].onPath), a, H.t), pp = H.p && this.closest(living, a, H.p, A.fly ? 9 : 2.5); if (tt) this.aggro(a, 't', tt.id); else if (pp) this.aggro(a, 'p', pp.id); }
      }
      if (a.mode === 'hunt') {
        const H = A.hunt || { leash: 30, time: 8, cd: 3 }, tg = a.tk === 'p' ? this.players.get(a.tid) : this.turrets.find(t => t.id === a.tid); a.ht -= dt;
        if (!tg || tg.dead || a.ht <= 0 || Math.hypot(a.x - hx, a.z - hz) > H.leash) { a.mode = 'return'; a.cc = H.cd; }
        else {
          const dx = tg.x - a.x, dz = tg.z - a.z, d = Math.hypot(dx, dz) || 1, reach = A.r + (a.tk === 't' ? 1.9 : 1.4); this.face(a, dx, dz);
          if (A.fly) a.y += (tg.y + (d < 4 ? 1.6 : 3) - a.y) * Math.min(1, dt * 3);
          if (d < reach && Math.abs(tg.y - a.y) < A.h + (A.fly ? 3.5 : 2.2)) { if (a.atk <= 0) { a.atk = 1; if (a.tk === 'p') this.hurtPlayer(tg, A.dmg, a); else this.hurtTurret(tg, A.dmg * (a.type === 'brute' || A.boss ? 2 : 1.2), a); this.emit({ k: 'bite', x: a.x, z: a.z }); } }
          else {
            const nx = a.x + dx / d * sp * 1.2 * dt, nz = a.z + dz / d * sp * 1.2 * dt;
            if (!A.fly && T.chasm(nx, nz) < 0.95 && P.near(nx, nz).d > PATH_W / 2) { a.mode = 'return'; a.cc = H.cd; }     // will not jump into a chasm
            else { a.x = nx; a.z = nz; if (!A.fly) a.y = this.W.ground(a.x, a.z, a.y + 1); }
          }
          a.hidden = false; continue;
        }
      }
      if (a.mode === 'return') {
        const dx = hx - a.x, dz = hz - a.z, d = Math.hypot(dx, dz);
        if (d < 1.2) a.mode = 'path';
        else { a.x += dx / d * sp * 1.1 * dt; a.z += dz / d * sp * 1.1 * dt; this.face(a, dx, dz); a.y = A.fly ? a.y + (home.y + 4.5 - a.y) * Math.min(1, dt * 3) : Math.max(this.W.ground(a.x, a.z, a.y + 1), d < 3 ? home.y : -99); a.hidden = false; continue; }
      }
      // reinforcements block the track: aliens stop to fight them
      if (A.melee) { let al = null; for (const m of this.allies) if (Math.hypot(m.x - a.x, m.z - a.z) < A.r + 1.3) { al = m; break; } if (al) { this.face(a, al.x - a.x, al.z - a.z); if (a.atk <= 0) { a.atk = 1; this.hurtAlly(al, A.dmg * (A.boss ? 2 : 1)); this.emit({ k: 'bite', x: a.x, z: a.z }); } continue; } }
      // a marine right next to the track gets bitten even by aliens that do not hunt
      if (A.melee) {
        let near = null, nd = A.r + 1.4; for (const p of living) { const d = Math.hypot(p.x - a.x, p.z - a.z); if (d < nd && Math.abs(p.y - a.y) < A.h + 2.2) { nd = d; near = p; } }
        if (near) { this.face(a, near.x - a.x, near.z - a.z); if (a.atk <= 0) { a.atk = 1; this.hurtPlayer(near, A.dmg, a); this.emit({ k: 'bite', x: a.x, z: a.z }); } continue; }
      }
      // follow the track
      const q = home, tx = hx, tz = hz, off = Math.hypot(tx - a.x, tz - a.z);
      if (off > 1.2) { const dx = tx - a.x, dz = tz - a.z; a.x += dx / off * sp * dt; a.z += dz / off * sp * dt; this.face(a, dx, dz); }
      else { a.s += sp * dt; const n = P.at(a.s); a.x = n.x - n.tz * a.lat; a.z = n.z + n.tx * a.lat; this.face(a, n.tx, n.tz); }
      // walkers keep to the track's height (over bridges, through tunnels); flyers go over the tunnel roofs
      if (A.fly) { const tu = T.tunnelAt(a.s, 6), want = (tu ? tu.top + 3 : P.y(a.s) + 4.5) + Math.sin(a.s * 0.5) * 0.6; a.y += (want - a.y) * Math.min(1, dt * 3); a.hidden = false; }
      else if (off <= 1.2) { a.y = P.y(a.s); a.hidden = !!T.tunnelAt(a.s, -1); } else { a.y = this.W.ground(a.x, a.z, a.y + 1); a.hidden = false; }
      void q;
      if (a.s >= P.len - 4) { a.dead = true; a.reached = true; this.hub = Math.max(0, this.hub - A.hub); this.emit({ k: 'hubhit', d: A.hub, x: a.x, y: a.y, z: a.z }); }
    }
    if (this.aliens.some(a => a.dead)) this.aliens = this.aliens.filter(a => !a.dead);
    if (this.hub <= 0 && this.phase !== 'lose') { this.phase = 'lose'; this.emit({ k: 'lose', w: this.wave }); }

    // turrets
    for (const t of this.turrets) if (t.kind === 'beacon' && !t.fresh) { const st = tStat(t); for (const a of this.aliens) if (Math.hypot(a.x - t.x, a.z - t.z) < st.range) { a.mark = st.mark; a.markT = 0.3; a.hidden = false; } }
    for (const t of this.turrets) {
      // building and upgrading take time; a new turret does nothing until it is finished, an upgrading one keeps its old level
      if (t.b > 0) { t.b -= dt; if (t.b <= 0) { t.b = 0; if (t.fresh) { t.fresh = false; this.emit({ k: 'built', id: t.id, x: t.x, z: t.z, o: t.owner, kind: t.kind }); } if (t.next) { t.lvl = t.next; t.next = 0; const k = TURRETS[t.kind].hp * (1 + 0.4 * (t.lvl - 1)); t.hp += k - t.mhp; t.mhp = k; this.emit({ k: 'upg', id: t.id }); } } if (t.fresh) { t.tg = 0; continue; } }
      const st = tStat(t); t.cd -= dt; t.tg = 0;
      if (t.kind === 'flamer' || t.kind === 'railgun') {
        let tg = null, bs = -1; const open = this.hiveOpen(); for (const a of this.aliens) { if (a.dead || a.hidden || (a.type === 'hivecore' && !open)) continue; const d = Math.hypot(a.x - t.x, a.z - t.z); if (d < st.range && a.s > bs) { bs = a.s; tg = a; } }
        if (!tg) continue; t.tg = tg.id; const want = Math.atan2(-(tg.x - t.x), -(tg.z - t.z)); let dr = want - t.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; t.ry += dr * Math.min(1, dt * 8);
        if (t.cd > 0) continue; t.cd = 1 / st.rate; const fx = -Math.sin(t.ry), fz = -Math.cos(t.ry);
        if (t.kind === 'flamer') { for (const a of this.aliens) { if (a.dead || a.hidden || (a.type === 'hivecore' && !open)) continue; const dx = a.x - t.x, dz = a.z - t.z, d = Math.hypot(dx, dz); if (d < st.range && (dx * fx + dz * fz) / (d || 1) > Math.cos(TURRETS.flamer.cone)) this.hurtAlien(a, st.dmg, t.owner, true); } }
        else { const L = st.range, ex = t.x + fx * L, ez = t.z + fz * L; for (const a of this.aliens) { if (a.dead || (a.type === 'hivecore' && !open)) continue; const px = a.x - t.x, pz = a.z - t.z, along = px * fx + pz * fz; if (along < 0 || along > L) continue; if (Math.abs(px * fz - pz * fx) < ALIENS[a.type].r + 0.6) this.hurtAlien(a, st.dmg, t.owner, true); } this.emit({ k: 'rail', a: [t.x, t.y + 2.2, t.z], b: [+ex.toFixed(1), +(tg.y + 1).toFixed(1), +ez.toFixed(1)] }); }
      } else if (t.kind === 'mines') {
        if (t.cd > 0) continue; for (const a of this.aliens) { if (a.dead || ALIENS[a.type].fly || ALIENS[a.type].static) continue; if (Math.hypot(a.x - t.x, a.z - t.z) < st.range) { this.splash(t.x, t.y + 0.4, t.z, TURRETS.mines.splash, st.dmg, t.owner); t.ch--; t.cd = 1.2; if (t.ch <= 0) { t.hp = 0; this.turrets = this.turrets.filter(q => q !== t); } break; } }
      } else if (t.kind === 'minigun' || t.kind === 'tesla' || t.kind === 'missile') {
        let tg = null, bs = -1; const open = this.hiveOpen(); for (const a of this.aliens) { if (a.dead || a.hidden || (a.type === 'hivecore' && !open)) continue; const d = Math.hypot(a.x - t.x, a.z - t.z); if (d < st.range && a.s > bs) { bs = a.s; tg = a; } }
        if (!tg) continue; t.tg = tg.id; const want = Math.atan2(-(tg.x - t.x), -(tg.z - t.z)); let dr = want - t.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; t.ry += dr * Math.min(1, dt * 10);
        if (t.cd > 0) continue; t.cd = 1 / st.rate;
        if (t.kind === 'minigun') this.hurtAlien(tg, st.dmg, t.owner);
        else if (t.kind === 'tesla') {
          const pts = [[t.x, 3.05 + 1.2 - 1.2, t.z]], hit = [tg]; let cur = tg;
          for (let i = 0; i < st.chain; i++) { let nx = null, nd = 7; for (const a of this.aliens) if (!a.dead && !a.hidden && !hit.includes(a)) { const d = Math.hypot(a.x - cur.x, a.z - cur.z); if (d < nd) { nd = d; nx = a; } } if (!nx) break; hit.push(nx); cur = nx; }
          for (const a of hit) { pts.push([+a.x.toFixed(1), +(a.y + ALIENS[a.type].h * 0.6).toFixed(1), +a.z.toFixed(1)]); a.stun = Math.max(a.stun, ALIENS[a.type].boss ? 0.05 : 0.35); this.hurtAlien(a, st.dmg, t.owner, true); }
          pts[0][1] = t.y + 4.25; this.emit({ k: 'zap', p: pts });
        } else if (t.kind === 'missile') {
          const d = Math.hypot(tg.x - t.x, tg.z - t.z), dur = 0.25 + d / 32; this.shells.push({ tg: tg.id, x: tg.x, y: tg.y, z: tg.z, t: dur, d: st.dmg, r: st.splash, owner: t.owner });
          this.emit({ k: 'msl', a: [t.x, t.y + 2.9, t.z], tg: tg.id, b: [tg.x, tg.y, tg.z], t: dur });
        }
      } else if (t.kind === 'repair') {
        const h = st.heal * dt;
        for (const p of living) if (Math.hypot(p.x - t.x, p.z - t.z) < st.range && p.hp < p.mhp) { p.hp = Math.min(p.mhp, p.hp + h); p.healed = 0.3; }
        for (const q of this.turrets) if (q !== t && q.hp < q.mhp && Math.hypot(q.x - t.x, q.z - t.z) < st.range) q.hp = Math.min(q.mhp, q.hp + h * 2.5);
        if (Math.hypot(this.W.hubP.x - t.x, this.W.hubP.z - t.z) < st.range + 12) this.hub = Math.min(this.hubMax, this.hub + dt * 0.12 * t.lvl);
      }
    }
    this.updateAllies(dt);
    // missiles in the air follow their target and burst when they arrive
    for (const s of this.shells) { const a = this.aliens.find(q => q.id === s.tg); if (a) { s.x = a.x; s.y = a.y; s.z = a.z; } s.t -= dt; if (s.t <= 0) { s.done = true; this.splash(s.x, s.y + 0.6, s.z, s.r, s.d, s.owner); } }
    if (this.shells.some(s => s.done)) this.shells = this.shells.filter(s => !s.done);
  }
  // The hive itself and its two Guardian towers. The hive is shielded until the final assault, and while a Guardian stands.
  spawnHive(full, boost = 1) {
    if (full) this.aliens = this.aliens.filter(a => a.type !== 'hivecore' && a.type !== 'guardian');
    const P = this.path, p0 = P.at(0), hy = P.y(0), have = this.aliens.filter(a => a.type === 'guardian').map(a => a.gi);
    if (full) { const h = this.spawn('hivecore', 0); h.x = p0.x; h.z = p0.z; h.y = hy; h.mode = 'static'; h.hp = h.mhp = ALIENS.hivecore.hp * boost * bossScale(this.players.size); }
    for (const [i, sd] of [[0, -1], [1, 1]]) { if (have.includes(i)) continue; let x = p0.x - p0.tz * sd * 10 + p0.tx * 6, z = p0.z + p0.tx * sd * 10 + p0.tz * 6; if (this.W.T.chasm(x, z) < 0.99) { x = p0.x + p0.tx * 12; z = p0.z + p0.tz * 12 + sd * 4; }
      const g = this.spawn('guardian', 0); g.x = x; g.z = z; g.y = this.W.top(x, z); g.gi = i; g.mode = 'static'; g.hp = g.mhp = ALIENS.guardian.hp * boost * bossScale(this.players.size); }
  }
  hiveOpen() { return this.phase !== 'lose' && this.phase !== 'win' && !this.aliens.some(a => a.type === 'guardian' && !a.dead); }
  // Reinforcements: the hub sends marines down the track toward the hive.
  updateAllies(dt) {
    const P = this.path, C = this.cmd;
    if (this.phase === 'wave' || this.phase === 'assault') { C.t -= dt; if (C.t <= 0) { C.t = DROP_EVERY[C.lv]; for (let i = 0; i < SQUAD[C.sz] && this.allies.length < MAX_ALLIES; i++) { const type = C.un[this.allyN++ % C.un.length], A = ALLIES[type], s = P.len - 9 - i * 1.6, q = P.at(s), lat = (Math.random() - 0.5) * 3; this.allies.push({ id: this.nid++, type, s, lat, x: q.x - q.tz * lat, y: q.y, z: q.z + q.tx * lat, hp: A.hp, mhp: A.hp, ry: Math.atan2(q.tx, q.tz), cd: Math.random(), tg: 0 }); } this.emit({ k: 'drop', n: SQUAD[C.sz] }); } }
    const open = this.hiveOpen();
    for (const m of this.allies) {
      const A = ALLIES[m.type]; m.cd -= dt; m.tg = 0;
      if (A.heal) { for (const o of this.allies) if (o !== m && o.hp < o.mhp && Math.hypot(o.x - m.x, o.z - m.z) < 8) o.hp = Math.min(o.mhp, o.hp + A.heal * dt); for (const p of this.living()) if (p.hp < p.mhp && Math.hypot(p.x - m.x, p.z - m.z) < 8) p.hp = Math.min(p.mhp, p.hp + A.heal * 0.6 * dt); }
      let tg = null, bd = A.range; for (const a of this.aliens) { if (a.dead || a.hidden || (a.type === 'hivecore' && !open)) continue; const d = Math.hypot(a.x - m.x, a.z - m.z); if (d < bd && Math.abs(a.y - m.y) < 9) { bd = d; tg = a; } }
      if (tg) { m.tg = tg.id; m.ry = Math.atan2(-(tg.x - m.x), -(tg.z - m.z)); if (m.cd <= 0) { m.cd = 1 / A.rate; if (A.splash) { const dur = 0.2 + bd / 30; this.shells.push({ tg: tg.id, x: tg.x, y: tg.y, z: tg.z, t: dur, d: A.dmg, r: A.splash, owner: null }); this.emit({ k: 'msl', a: [m.x, m.y + 1.6, m.z], tg: tg.id, b: [tg.x, tg.y, tg.z], t: dur, rk: 1 }); } else this.hurtAlien(tg, A.dmg, null); } continue; }
      if (m.s > 7) { m.s -= A.speed * dt; const q = P.at(m.s); m.x = q.x - q.tz * m.lat; m.z = q.z + q.tx * m.lat; m.y = q.y; m.ry = Math.atan2(q.tx, q.tz); }
    }
    if (this.allies.some(m => m.hp <= 0)) { for (const m of this.allies) if (m.hp <= 0) this.emit({ k: 'adie', x: m.x, y: m.y, z: m.z }); this.allies = this.allies.filter(m => m.hp > 0); }
  }
  hurtAlly(m, d) { m.hp -= d; }
  // Mars drops meteors; Kryos whips up blizzards. Both strike during waves.
  hazards(dt) {
    const hz = this.W.def.hazard; this.storm = Math.max(0, (this.storm || 0) - dt);
    for (const m of this.meteors || []) { m.t -= dt; if (m.t <= 0 && !m.done) { m.done = true; this.splash(m.x, m.y + 0.5, m.z, 4.5, 110, null); for (const p of this.living()) if (Math.hypot(p.x - m.x, p.z - m.z) < 4.5) this.hurtPlayer(p, 35, m); for (const t of this.turrets) if (Math.hypot(t.x - m.x, t.z - m.z) < 4) this.hurtTurret(t, 60); } }
    if (this.meteors) this.meteors = this.meteors.filter(m => !m.done);
    if (this.W.def.weather === 'rain') { this.boltT = (this.boltT ?? 12) - dt; if (this.boltT <= 0) { this.boltT = 10 + Math.random() * 16; this.emit({ k: 'bolt' }); } }
    this.hzT = (this.hzT ?? 30) - dt; if (this.hzT > 0) return; this.hzT = 50 + Math.random() * 25;
    if (hz === 'meteor') {
      this.meteors = this.meteors || []; this.emit({ k: 'toast', m: '☄ METEOR SHOWER! Watch for red circles on the ground.', big: 1 }); this.emit({ k: 'alarm' });
      for (let i = 0, nm = Math.round(9 * countScale(this.players.size)); i < nm; i++) { let x, z; const pl = this.living(); if (i % 3 === 2 && pl.length) { const p = pl[(Math.random() * pl.length) | 0]; x = p.x + (Math.random() - 0.5) * 8; z = p.z + (Math.random() - 0.5) * 8; } else { const q = this.path.at(Math.random() * this.path.len); x = q.x + (Math.random() - 0.5) * 10; z = q.z + (Math.random() - 0.5) * 10; }
        const y = this.W.top(x, z), t = 2 + i * 0.7; this.meteors.push({ x, y, z, t }); this.emit({ k: 'meteor', x: +x.toFixed(1), y: +y.toFixed(1), z: +z.toFixed(1), t }); }
    } else if (hz === 'blizzard') { this.storm = 22; this.emit({ k: 'toast', m: '❄ BLIZZARD! You can barely see, you move slower and the aliens move faster.', big: 1 }); this.emit({ k: 'alarm' }); }
  }
  face(a, dx, dz) { const want = Math.atan2(-dx, -dz); let dr = want - a.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; a.ry += dr * 0.2; }

  // what friends receive, ten times a second
  pack() {
    const r1 = v => Math.round(v * 10) / 10;
    return {
      w: this.wave, ph: this.phase, tm: r1(this.timer), hub: r1(this.hub), en: this.endless ? 1 : 0, left: this.q.length + this.aliens.filter(a => !ALIENS[a.type].static).length, n: this.players.size, wx: this.storm > 0 ? 1 : 0,
      A: this.aliens.map(a => [a.id, a.type, r1(a.x), r1(a.y), r1(a.z), Math.round(a.hp), Math.round(a.mhp), +a.ry.toFixed(2), a.stun > 0 ? 1 : 0, a.mode === 'hunt' ? (a.tk === 'p' ? a.tid : 't') : 0]),
      T: this.turrets.map(t => [t.id, t.kind, t.owner, r1(t.x), r1(t.z), +t.ry.toFixed(2), t.lvl, Math.round(t.hp), Math.round(t.mhp), t.tg, r1(t.y), r1(t.b || 0), t.bt || 0, t.fresh ? 1 : 0, t.ch || 0]),
      P: [...this.players.values()].map(p => [p.id, p.name, p.cls, r1(p.x), r1(p.y), r1(p.z), +p.yaw.toFixed(2), Math.round(p.hp), p.mhp, Math.floor(p.gold), p.ups, p.dead ? 1 : 0, p.kills, p.sp, Math.ceil(p.rt), p.kn || 0]),
      O: this.pods.map(p => [p.id, r1(p.x), r1(p.z)]),
      L: this.allies.map(m => [m.id, m.type, r1(m.x), r1(m.y), r1(m.z), Math.round(m.hp), m.mhp, +m.ry.toFixed(2), m.tg]), C: { lv: this.cmd.lv, sz: this.cmd.sz, un: this.cmd.un, t: Math.ceil(this.cmd.t) }, open: this.hiveOpen() ? 1 : 0,
    };
  }
}
