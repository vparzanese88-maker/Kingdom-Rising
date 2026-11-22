// The battle itself. Only the host (or a solo player) runs this; friends receive what it decides.
import { CLASSES, TURRETS, UPG_COST, MAX_TURRETS, UPGRADES, UPG_PRICES, ALIENS, WAVES, waveList, hpScale, BOUNDS } from './data.js';
import { placeError } from './world.js';

const LV = { dmg: [1, 1.6, 2.4], rng: [1, 1.12, 1.25], rate: [1, 1.15, 1.32] };
export const START_GOLD = 250;
export function maxHp(cls, ups) { return CLASSES[cls].hp + 25 * (ups.hp || 0); }
export function tStat(t) { const T = TURRETS[t.kind], l = t.lvl - 1; return { range: (T.range || 0) * LV.rng[l], dmg: (T.dmg || 0) * LV.dmg[l], rate: (T.rate || 0) * LV.rate[l], heal: (T.heal || 0) * LV.dmg[l], chain: (T.chain || 0) + l, slow: T.slow ? Math.max(0.25, T.slow - l * 0.08) : 0, splash: T.splash || 0 }; }
export function upgradeCost(t) { return t.lvl >= 3 ? 0 : Math.round(TURRETS[t.kind].cost * UPG_COST[t.lvl]); }

export class Sim {
  constructor(W, emit) {
    this.W = W; this.path = W.path; this.emit = emit; this.players = new Map(); this.reset();
  }
  reset() {
    this.wave = 0; this.phase = 'build'; this.timer = -1; this.hub = 100; this.hubMax = 100; this.aliens = []; this.turrets = []; this.shells = []; this.pods = []; this.q = []; this.qt = 0; this.nid = 1; this.endless = false; this.podT = 0;
    for (const p of this.players.values()) this.resetPlayer(p);
  }
  resetPlayer(p) { p.gold = START_GOLD; p.ups = { dmg: 0, rate: 0, mag: 0, spd: 0, hp: 0, arm: 0 }; p.mhp = p.hp = maxHp(p.cls, p.ups); p.dead = false; p.rt = 0; p.kills = 0; p.sp = (p.sp || 0) + 1; }
  addPlayer(id, name, cls) {
    let p = this.players.get(id); if (p) { p.name = name; if (p.cls !== cls) { p.cls = cls; p.mhp = maxHp(cls, p.ups); p.hp = Math.min(p.hp, p.mhp); } return p; }
    p = { id, name, cls, x: this.W.spawn.x, y: 0, z: this.W.spawn.z, yaw: 0, sp: 0, seen: 0 }; this.resetPlayer(p); p.gold = START_GOLD + this.wave * 55; this.players.set(id, p);
    this.emit({ k: 'toast', m: `${name} (${CLASSES[cls].name}) has joined the defense.` }); return p;
  }
  removePlayer(id) { const p = this.players.get(id); if (!p) return; this.players.delete(id); this.emit({ k: 'toast', m: p.name + ' left.' }); }
  living() { return [...this.players.values()].filter(p => !p.dead); }

  // ---------------------------------------------------------------- requests from marines
  request(id, r) {
    const p = this.players.get(id); if (!p) return; const say = m => this.emit({ k: 'say', to: id, m });
    if (r.a === 'start') { if (this.phase === 'build') this.timer = 0.01; else if (this.phase === 'lose') { this.reset(); this.emit({ k: 'toast', m: 'Defense restarted.' }); } else if (this.phase === 'win') { this.endless = true; this.phase = 'build'; this.timer = 20; this.emit({ k: 'toast', m: 'Endless mode: the hive keeps coming.' }); } return; }
    if (p.dead || this.phase === 'lose') return;
    if (r.a === 'place') {
      const T = TURRETS[r.kind], C = CLASSES[p.cls]; if (!T || (C.sentry !== r.kind && C.defense !== r.kind)) return;
      if (p.gold < T.cost) return say(`Need ${T.cost} gold for a ${T.name}.`);
      if (this.turrets.filter(t => t.owner === id).length >= MAX_TURRETS) return say(`You can have ${MAX_TURRETS} at once. Sell one (X) first.`);
      const err = placeError(r.kind, r.x, r.z, this.path, this.turrets, this.W.hubP, this.W.hiveP); if (err) return say(err);
      p.gold -= T.cost; const t = { id: this.nid++, kind: r.kind, owner: id, x: r.x, z: r.z, ry: r.ry || 0, lvl: 1, hp: T.hp, mhp: T.hp, cd: 0, tg: 0, spent: T.cost };
      if (T.onPath) { const n = this.path.near(r.x, r.z); t.s = n.s; t.x = n.x; t.z = n.z; t.ry = Math.atan2(n.tx, n.tz); }
      this.turrets.push(t); this.emit({ k: 'placed', x: t.x, z: t.z, by: id });
    } else if (r.a === 'upg') {
      const t = this.turrets.find(q => q.id === r.id); if (!t || t.lvl >= 3) return; const c = upgradeCost(t); if (p.gold < c) return say(`Need ${c} gold to upgrade.`);
      p.gold -= c; t.spent += c; t.lvl++; const k = TURRETS[t.kind].hp * (1 + 0.4 * (t.lvl - 1)); t.hp += k - t.mhp; t.mhp = k; this.emit({ k: 'upg', id: t.id, by: id });
    } else if (r.a === 'sell') {
      const i = this.turrets.findIndex(q => q.id === r.id && q.owner === id); if (i < 0) return; const t = this.turrets[i]; p.gold += Math.round(t.spent * 0.6 * t.hp / t.mhp); this.turrets.splice(i, 1); this.emit({ k: 'boom', x: t.x, y: 0.5, z: t.z, r: 1.5, small: 1 });
    } else if (r.a === 'buy') {
      if (!UPGRADES.some(u => u.id === r.up)) return; const lv = p.ups[r.up] || 0; if (lv >= 5) return; const c = UPG_PRICES[lv]; if (p.gold < c) return say(`Need ${c} gold.`);
      p.gold -= c; p.ups[r.up] = lv + 1; const m = maxHp(p.cls, p.ups); p.hp += m - p.mhp; p.mhp = m; this.emit({ k: 'bought', to: id });
    } else if (r.a === 'hit') {
      const a = this.aliens.find(q => q.id === r.id); if (a) this.hurtAlien(a, Math.min(+r.d || 0, 400), id, r.ap);
    } else if (r.a === 'boom') {
      this.splash(+r.x, +r.y, +r.z, Math.min(+r.r || 0, 7), Math.min(+r.d || 0, 600), id);
    }
  }
  pose(id, x, y, z, yaw) { const p = this.players.get(id); if (!p || p.dead) return; p.x = Math.max(-BOUNDS, Math.min(BOUNDS, x)); p.y = y; p.z = Math.max(-BOUNDS, Math.min(BOUNDS, z)); p.yaw = yaw; }

  // ---------------------------------------------------------------- damage
  hurtAlien(a, d, owner, ap) {
    if (a.hp <= 0) return; const A = ALIENS[a.type]; a.hp -= d * (ap ? 1 : 1 - (A.armor || 0));
    if (a.hp <= 0) this.killAlien(a, owner);
  }
  splash(x, y, z, r, d, owner) {
    this.emit({ k: 'boom', x, y, z, r });
    for (const a of this.aliens) { const dist = Math.hypot(a.x - x, a.y + ALIENS[a.type].h * 0.5 - y, a.z - z) - ALIENS[a.type].r; if (dist < r) this.hurtAlien(a, d * (1 - Math.max(0, dist) / r * 0.6), owner, true); }
  }
  killAlien(a, owner) {
    a.dead = true; const A = ALIENS[a.type]; this.emit({ k: 'die', x: a.x, y: a.y, z: a.z, t: a.type });
    const p = this.players.get(owner); if (p) p.kills++;
    for (const q of this.players.values()) q.gold += Math.round(A.bounty * (q.id === owner ? 1 : 0.4));
    if (A.boss) this.emit({ k: 'toast', m: `${A.name} destroyed${p ? ' by ' + p.name : ''}!`, big: 1 });
  }
  hurtPlayer(p, d) {
    if (p.dead) return; p.hp -= d * (1 - 0.08 * (p.ups.arm || 0));
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.rt = 7; this.emit({ k: 'toast', m: p.name + ' is down! Back in 7 seconds.' }); }
  }
  hurtTurret(t, d) { t.hp -= d; if (t.hp <= 0) { this.turrets = this.turrets.filter(q => q !== t); this.emit({ k: 'boom', x: t.x, y: 1, z: t.z, r: 2.5 }); this.emit({ k: 'say', to: t.owner, m: `Your ${TURRETS[t.kind].name} was destroyed.` }); } }

  // ---------------------------------------------------------------- waves
  startWave() {
    this.wave++; this.phase = 'wave'; this.q = []; let t = 0;
    for (const [type, n, gap] of waveList(this.wave)) { for (let i = 0; i < n; i++) { this.q.push({ type, t }); t += gap; } t += 2.5; }
    this.qt = 0; this.emit({ k: 'wave', w: this.wave, boss: this.q.some(e => ALIENS[e.type].boss) ? this.q.find(e => ALIENS[e.type].boss).type : '' });
    this.dropPods(2);
  }
  dropPods(n) {
    for (let i = 0; i < n; i++) {
      let x, z, ok = false; for (let k = 0; k < 30 && !ok; k++) { x = (Math.random() * 2 - 1) * (BOUNDS - 10); z = (Math.random() * 2 - 1) * (BOUNDS - 10); ok = this.path.near(x, z).d > 6 && Math.hypot(x - this.W.hiveP.x, z - this.W.hiveP.z) > 15 && !this.W.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 1.5); }
      if (ok) { const pod = { id: this.nid++, x, z }; this.pods.push(pod); }
    }
    if (n) this.emit({ k: 'toast', m: 'Supply pods dropped. Grab them for gold.' });
  }
  spawn(type, s = 0) {
    const A = ALIENS[type], p = this.path.at(s), lat = (Math.random() - 0.5) * (A.boss ? 0.5 : 3.2), sc = hpScale(this.wave, this.players.size), hp = A.hp * sc;
    const a = { id: this.nid++, type, s, lat, x: p.x - p.tz * lat, y: A.fly ? 4 : 0, z: p.z + p.tx * lat, hp, mhp: hp, ry: Math.atan2(-p.tx, -p.tz), spd: A.speed * (0.92 + Math.random() * 0.16), slowT: 0, stun: 0, atk: 0, mode: 'path', cc: Math.random() * 3, tgt: null, rcd: 1 + Math.random() * 2, qcd: 6 };
    this.aliens.push(a); if (A.boss) this.emit({ k: 'roar', t: type }); return a;
  }

  update(dt) {
    const P = this.path;
    // marines
    for (const p of this.players.values()) {
      if (p.dead) { p.rt -= dt; if (p.rt <= 0) { p.dead = false; p.hp = p.mhp; p.sp++; p.x = this.W.spawn.x; p.z = this.W.spawn.z; } continue; }
      if (this.phase === 'wave') p.gold += dt * (1.6 + this.wave * 0.08);
      for (const pod of this.pods) if (!pod.got && Math.hypot(pod.x - p.x, pod.z - p.z) < 2.2) { pod.got = true; const g = 60 + this.wave * 10; for (const q of this.players.values()) q.gold += q === p ? g : Math.round(g * 0.4); this.emit({ k: 'pod', by: p.id, g, x: pod.x, z: pod.z }); }
    }
    if (this.pods.some(q => q.got)) this.pods = this.pods.filter(q => !q.got);
    if (this.phase === 'lose' || this.phase === 'win') return;

    if (this.phase === 'build') { if (this.timer > 0) { this.timer -= dt; if (this.timer <= 0) this.startWave(); } }
    else if (this.phase === 'wave') {
      this.qt += dt; while (this.q.length && this.q[0].t <= this.qt) this.spawn(this.q.shift().type);
      this.podT += dt; if (this.podT > 45) { this.podT = 0; this.dropPods(1); }
      if (!this.q.length && !this.aliens.length) {
        const bonus = 60 + this.wave * 12; for (const p of this.players.values()) p.gold += bonus;
        if (this.wave === WAVES && !this.endless) { this.phase = 'win'; this.emit({ k: 'win', w: this.wave }); }
        else { this.phase = 'build'; this.timer = 22; this.emit({ k: 'clear', w: this.wave, b: bonus }); }
      }
    }

    // turrets that change aliens around them
    for (const t of this.turrets) if (t.kind === 'stasis') { const st = tStat(t); for (const a of this.aliens) if (!ALIENS[a.type].boss || t.lvl > 1) if (Math.hypot(a.x - t.x, a.z - t.z) < st.range) { a.slowT = 0.15; a.slowF = st.slow; } }

    // aliens
    const living = this.living();
    for (const a of this.aliens) {
      if (a.dead) continue; const A = ALIENS[a.type]; a.cc -= dt; a.atk -= dt; a.rcd -= dt;
      if (a.stun > 0) { a.stun -= dt; continue; }
      const sp = a.spd * (a.slowT > 0 ? (a.slowF ?? 0.5) : 1); if (a.slowT > 0) a.slowT -= dt;
      // spitters and the queen shoot at marines and turrets
      if (A.ranged && a.rcd <= 0) {
        let tg = null, bd = A.ranged; for (const p of living) { const d = Math.hypot(p.x - a.x, p.z - a.z); if (d < bd) { bd = d; tg = p; } }
        for (const t of this.turrets) { const d = Math.hypot(t.x - a.x, t.z - a.z); if (d < bd * 0.8) { bd = d; tg = t; } }
        if (tg) { a.rcd = a.type === 'queen' ? 1.4 : 2.4; const isP = 'cls' in tg; this.emit({ k: 'spit', a: [a.x, a.y + A.h, a.z], b: [tg.x, (isP ? 1.3 : 1.2), tg.z], q: a.type === 'queen' ? 1 : 0 }); if (isP) this.hurtPlayer(tg, A.dmg); else this.hurtTurret(tg, A.dmg * 1.5); }
      }
      // the queen keeps hatching crawlers
      if (a.type === 'queen') { a.qcd -= dt; if (a.qcd <= 0) { a.qcd = 7; for (let i = 0; i < 3; i++) this.spawn('crawler', Math.max(0, a.s - 2 - i)); } }
      // melee: bite a marine standing close
      if (A.melee) {
        let near = null, nd = A.r + 1.4; for (const p of living) { const d = Math.hypot(p.x - a.x, p.z - a.z); if (d < nd && p.y < A.h + 2.5) { nd = d; near = p; } }
        if (near) { this.face(a, near.x - a.x, near.z - a.z); if (a.atk <= 0) { a.atk = 1; this.hurtPlayer(near, A.dmg); this.emit({ k: 'bite', x: a.x, z: a.z }); } continue; }
        // crawlers peel off the track to chase a marine who comes close
        if (a.type === 'crawler' && a.mode === 'path' && a.cc <= 0) { for (const p of living) if (Math.hypot(p.x - a.x, p.z - a.z) < 7) { a.mode = 'chase'; a.tgt = p.id; a.ct = 3.5; break; } }
      }
      if (a.mode === 'chase') {
        const p = this.players.get(a.tgt); a.ct -= dt;
        if (!p || p.dead || a.ct <= 0 || Math.hypot(p.x - a.x, p.z - a.z) > 12) { a.mode = 'path'; a.cc = 5; }
        else { const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz) || 1; a.x += dx / d * sp * 1.25 * dt; a.z += dz / d * sp * 1.25 * dt; this.face(a, dx, dz); continue; }
      }
      // walls on the track stop walkers until they are torn down
      if (!A.fly) { let wall = null; for (const t of this.turrets) if (t.kind === 'barricade' && t.s > a.s && t.s - a.s < A.r + 0.8) { wall = t; break; } if (wall) { if (a.atk <= 0) { a.atk = 1; this.hurtTurret(wall, A.dmg * (a.type === 'brute' || A.boss ? 2 : 1)); this.emit({ k: 'bite', x: a.x, z: a.z }); } continue; } }
      // follow the track
      const q = P.at(a.s), tx = q.x - q.tz * a.lat, tz = q.z + q.tx * a.lat, off = Math.hypot(tx - a.x, tz - a.z);
      if (off > 1.2) { const dx = tx - a.x, dz = tz - a.z; a.x += dx / off * sp * dt; a.z += dz / off * sp * dt; this.face(a, dx, dz); }
      else { a.s += sp * dt; const n = P.at(a.s); a.x = n.x - n.tz * a.lat; a.z = n.z + n.tx * a.lat; this.face(a, n.tx, n.tz); }
      if (A.fly) a.y = 4 + Math.sin(a.s * 0.5) * 0.6;
      if (a.s >= P.len - 4) { a.dead = true; a.reached = true; this.hub = Math.max(0, this.hub - A.hub); this.emit({ k: 'hubhit', d: A.hub, x: a.x, y: a.y, z: a.z }); }
    }
    if (this.aliens.some(a => a.dead)) this.aliens = this.aliens.filter(a => !a.dead);
    if (this.hub <= 0 && this.phase !== 'lose') { this.phase = 'lose'; this.emit({ k: 'lose', w: this.wave }); }

    // turrets
    for (const t of this.turrets) {
      const st = tStat(t); t.cd -= dt; t.tg = 0;
      if (t.kind === 'minigun' || t.kind === 'tesla' || t.kind === 'missile') {
        let tg = null, bs = -1; for (const a of this.aliens) { if (a.dead) continue; const d = Math.hypot(a.x - t.x, a.z - t.z); if (d < st.range && a.s > bs) { bs = a.s; tg = a; } }
        if (!tg) continue; t.tg = tg.id; const want = Math.atan2(-(tg.x - t.x), -(tg.z - t.z)); let dr = want - t.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; t.ry += dr * Math.min(1, dt * 10);
        if (t.cd > 0) continue; t.cd = 1 / st.rate;
        if (t.kind === 'minigun') this.hurtAlien(tg, st.dmg, t.owner);
        else if (t.kind === 'tesla') {
          const pts = [[t.x, 3.05 + 1.2 - 1.2, t.z]], hit = [tg]; let cur = tg;
          for (let i = 0; i < st.chain; i++) { let nx = null, nd = 7; for (const a of this.aliens) if (!a.dead && !hit.includes(a)) { const d = Math.hypot(a.x - cur.x, a.z - cur.z); if (d < nd) { nd = d; nx = a; } } if (!nx) break; hit.push(nx); cur = nx; }
          for (const a of hit) { pts.push([+a.x.toFixed(1), +(a.y + ALIENS[a.type].h * 0.6).toFixed(1), +a.z.toFixed(1)]); a.stun = Math.max(a.stun, ALIENS[a.type].boss ? 0.05 : 0.35); this.hurtAlien(a, st.dmg, t.owner, true); }
          pts[0][1] = 4.25; this.emit({ k: 'zap', p: pts });
        } else if (t.kind === 'missile') {
          const d = Math.hypot(tg.x - t.x, tg.z - t.z), dur = 0.25 + d / 32; this.shells.push({ tg: tg.id, x: tg.x, y: tg.y, z: tg.z, t: dur, d: st.dmg, r: st.splash, owner: t.owner });
          this.emit({ k: 'msl', a: [t.x, 2.9, t.z], tg: tg.id, b: [tg.x, tg.y, tg.z], t: dur });
        }
      } else if (t.kind === 'repair') {
        const h = st.heal * dt;
        for (const p of living) if (Math.hypot(p.x - t.x, p.z - t.z) < st.range && p.hp < p.mhp) { p.hp = Math.min(p.mhp, p.hp + h); p.healed = 0.3; }
        for (const q of this.turrets) if (q !== t && q.hp < q.mhp && Math.hypot(q.x - t.x, q.z - t.z) < st.range) q.hp = Math.min(q.mhp, q.hp + h * 2.5);
        if (Math.hypot(this.W.hubP.x - t.x, this.W.hubP.z - t.z) < st.range + 12) this.hub = Math.min(this.hubMax, this.hub + dt * 0.12 * t.lvl);
      }
    }
    // missiles in the air follow their target and burst when they arrive
    for (const s of this.shells) { const a = this.aliens.find(q => q.id === s.tg); if (a) { s.x = a.x; s.y = a.y; s.z = a.z; } s.t -= dt; if (s.t <= 0) { s.done = true; this.splash(s.x, s.y + 0.6, s.z, s.r, s.d, s.owner); } }
    if (this.shells.some(s => s.done)) this.shells = this.shells.filter(s => !s.done);
  }
  face(a, dx, dz) { const want = Math.atan2(-dx, -dz); let dr = want - a.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; a.ry += dr * 0.2; }

  // what friends receive, ten times a second
  pack() {
    const r1 = v => Math.round(v * 10) / 10;
    return {
      w: this.wave, ph: this.phase, tm: r1(this.timer), hub: r1(this.hub), en: this.endless ? 1 : 0, left: this.q.length + this.aliens.length,
      A: this.aliens.map(a => [a.id, a.type, r1(a.x), r1(a.y), r1(a.z), Math.round(a.hp), Math.round(a.mhp), +a.ry.toFixed(2), a.stun > 0 ? 1 : 0]),
      T: this.turrets.map(t => [t.id, t.kind, t.owner, r1(t.x), r1(t.z), +t.ry.toFixed(2), t.lvl, Math.round(t.hp), Math.round(t.mhp), t.tg]),
      P: [...this.players.values()].map(p => [p.id, p.name, p.cls, r1(p.x), r1(p.y), r1(p.z), +p.yaw.toFixed(2), Math.round(p.hp), p.mhp, Math.floor(p.gold), p.ups, p.dead ? 1 : 0, p.kills, p.sp, Math.ceil(p.rt)]),
      O: this.pods.map(p => [p.id, r1(p.x), r1(p.z)]),
    };
  }
}
