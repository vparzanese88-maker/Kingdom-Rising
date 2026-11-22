// The battle itself. Only the host (or a solo player) runs this; friends receive what it decides.
import { scrapCost, techMul, CLASSES, TURRETS, UPG_COST, MAX_TURRETS, UPGRADES, UPG_PRICES, ALIENS, WAVES, waveList, hpScale, BOUNDS, countScale, bossScale } from './data.js';
import { placeError, HUB_R } from './world.js';
import { PATH_W, SPECIALS, MISSILE, ALLIES, DROP_EVERY, DROP_COST, SQUAD, SQUAD_COST, MAX_ALLIES } from './data.js';

const LV = { dmg: [1, 1.6, 2.4], rng: [1, 1.12, 1.25], rate: [1, 1.15, 1.32] };
export const KITS = 2;   // turret kits a marine can carry; more are picked up in the hub
// welding torch power cell: about 1.5 upgrades for most marines, far more for the Engineer
export const pwMax = cls => cls === 'engineer' ? 160 : 100;
export const DRESS = 2;
// scrap: piles everywhere, picked up just by running over them; welded upgrades cost scrap
export const SCRAP_COST = [0, 15, 30], SCRAP_PILES = 150;   // field dressings: a little health back out in the field
export const BUILD = { teleporter: 3, pulse: 4,  ammocache: 2,  resupply: 5, uav: 1,  minigun: 4, tesla: 5, missile: 6, barricade: 3, repair: 4, stasis: 3, flamer: 4, railgun: 6, mines: 2, beacon: 3, mortar: 5, medbay: 4 };
export function pickSpecial() { const e = Object.entries(SPECIALS), tot = e.reduce((a, [, v]) => a + v.w, 0); let r = Math.random() * tot; for (const [k, v] of e) { r -= v.w; if (r <= 0) return k; } return 'stim'; }
export const LEVEL_T = 60, DROP_FALL = 9, DROP_LIFE = 60;
export const START_GOLD = 350, FIRST_COUNT = 5, NEXT_COUNT = 25;
export function maxHp(cls, ups) { return CLASSES[cls].hp + 25 * (ups.hp || 0); }
export const TECH = { k: 1 };
export function tStat(t) { const T = TURRETS[t.kind], l = t.lvl - 1; return { mark: T.mark ? T.mark + 0.1 * l : 0, range: (T.range || 0) * LV.rng[l], dmg: (T.dmg || 0) * LV.dmg[l] * TECH.k, rate: (T.rate || 0) * LV.rate[l], heal: (T.heal || 0) * LV.dmg[l], chain: (T.chain || 0) + l, slow: T.slow ? Math.max(0.25, T.slow - l * 0.08) : 0, splash: T.splash || 0 }; }
export function upgradeCost(t) { return t.lvl >= 3 ? 0 : Math.round(TURRETS[t.kind].cost * UPG_COST[t.lvl]); }

export class Sim {
  constructor(W, emit) {
    this.W = W; this.path = W.path; this.emit = emit; this.players = new Map(); this.reset();
  }
  reset() { TECH.k = 1; this.hubSaid = {}; this.cmdA = 120; this.cmdD = 150; this.dropN = 0;
    this.wave = 0; this.el = 0; this.phase = 'build'; this.timer = FIRST_COUNT; this.hub = 100; this.hubMax = 100; this.aliens = []; this.turrets = []; this.shells = []; this.pods = []; this.q = []; this.qt = 0; this.nid = 1; this.endless = false; this.podT = 0; this.storm = 0; this.meteors = []; this.allies = []; this.allyN = 0; this.ammo = []; this.items = []; this.pools = []; this.tm = []; this.drones = []; this.lasers = []; this.medz = []; this.domes = []; this.later = []; this.spores = []; this.stormT = 0; this.stormI = 0; this.cmd = { lv: 0, sz: 0, un: ['trooper'], t: DROP_EVERY[0] }; this.spawnHive(1);
    for (const p of this.players.values()) this.resetPlayer(p);
    this.scrap = []; this.scrapT = 0; for (let i = 0; i < SCRAP_PILES; i++) this.spawnScrap();   // after the id counter is set
  }
  resetPlayer(p) { p.scrap = 25; p.dr = DRESS; p.kits = KITS; p.pw = pwMax(p.cls); p.special = ''; p.acd = [0, 0, 0, 0]; p.items = CLASSES[p.cls] ? CLASSES[p.cls].throw.n : 2; p.buf = {}; p.cl = 0; p.adrT = 0; p.stimT = 0; p.rv = p.rv || 0; p.gold = START_GOLD; p.ups = { dmg: 0, rate: 0, mag: 0, spd: 0, hp: 0, arm: 0 }; p.mhp = p.hp = maxHp(p.cls, p.ups); p.dead = false; p.rt = 0; p.kills = 0; p.sp = (p.sp || 0) + 1; }
  addPlayer(id, name, cls) {
    let p = this.players.get(id); if (p) { p.name = name; if (p.cls !== cls) { p.cls = cls; p.items = CLASSES[cls].throw.n; p.mhp = maxHp(cls, p.ups); p.hp = Math.min(p.hp, p.mhp); } return p; }
    { const f = bossScale(this.players.size + 1) / bossScale(this.players.size); for (const a of this.aliens) if (a.type === 'broodqueen' || a.type === 'royal') { a.hp *= f; a.mhp *= f; } }
    p = { id, name, cls, x: this.W.spawn.x, y: this.W.top(this.W.spawn.x, this.W.spawn.z), z: this.W.spawn.z, yaw: 0, sp: 0, seen: 0 }; this.resetPlayer(p); p.gold = START_GOLD + this.wave * 55; this.players.set(id, p);
    this.emit({ k: 'toast', m: `${name} (${CLASSES[cls].name}) has joined the defense. Squad of ${this.players.size}: the hive sends more, tougher aliens.` }); return p;
  }
  // turrets go down almost anywhere, the track included
  dropError(x, z) { const W = this.W; if (!isFinite(x) || !isFinite(z) || Math.abs(x) > BOUNDS - 2 || Math.abs(z) > BOUNDS - 2) return 'Too close to the edge'; if (Math.hypot(x - W.hubP.x, z - W.hubP.z) < 9) return 'Not on the hub core'; if (W.cave && Math.hypot(x - W.cave.q.x, z - W.cave.q.z) < 7) return 'Too close to the queen'; if (W.T.chasm(x, z) < 0.9) return 'Not in the chasm'; return ''; }
  settle(t) { const n = this.path.near(t.x, t.z); t.y = this.W.top(t.x, t.z); if (TURRETS[t.kind].onPath && n.d < PATH_W / 2 + 2) { t.s = n.s; t.x = n.x; t.z = n.z; t.y = this.path.y(n.s); t.ry = Math.atan2(n.tx, n.tz); t.on = 1; } else { t.s = n.s; t.on = 0; } t.inCave = this.inCave(t.x, t.z) && !!this.W.cave; }
  // scrap turns up around wrecks, scattered a few metres from each one
  spawnScrap() { const W = this.W, Wr = W.wrecks || []; for (let k = 0; k < 20; k++) { let x, z; if (Wr.length) { const w = Wr[Math.random() * Wr.length | 0], a = Math.random() * 6.283, d = (w.r || 2) + 1.5 + Math.random() * 6; x = w.x + Math.cos(a) * d; z = w.z + Math.sin(a) * d; if (Math.abs(x) > BOUNDS - 4 || Math.abs(z) > BOUNDS - 4) continue; } else { x = (Math.random() * 2 - 1) * (BOUNDS - 6); z = (Math.random() * 2 - 1) * (BOUNDS - 6); } if (W.T.chasm(x, z) < 0.99 || Math.hypot(x - W.hubP.x, z - W.hubP.z) < 10 || Math.hypot(x - W.hiveP.x, z - W.hiveP.z) < 36) continue; this.scrap.push({ id: this.nid++, x, z, n: 3 + (Math.random() * 4 | 0) }); return; } }
  // put the turret you are carrying back in your pack: its gold and the kit come back
  stow(p) { const i = this.turrets.findIndex(q => q.carry === p.id); if (i < 0) return; const t = this.turrets[i]; if (t.owner !== p.id) { t.carry = 0; this.settle(t); return; }   // someone else's turret just goes down where you stand
    this.turrets.splice(i, 1); p.kits = Math.min(KITS, (p.kits ?? KITS) + 1); p.scrap = (p.scrap || 0) + scrapCost(t.kind); this.emit({ k: 'stowed', to: p.id, n: TURRETS[t.kind].name }); }
  removePlayer(id) { const p = this.players.get(id); if (!p) return; this.players.delete(id); this.emit({ k: 'toast', m: p.name + ' left.' }); }
  living() { return [...this.players.values()].filter(p => !p.dead && !(p.buf && p.buf.cloak > 0)); }

  // ---------------------------------------------------------------- requests from marines
  request(id, r) {
    const p = this.players.get(id); if (!p) return; const say = m => this.emit({ k: 'say', to: id, m });
    if (r.a === 'start') { if (this.phase === 'build') this.timer = 0.01; else if (this.phase === 'lose') { this.reset(); this.emit({ k: 'toast', m: 'Defense restarted.' }); } else if (this.phase === 'win') { this.endless = true; this.phase = 'wave'; this.spawnHive(1, 1.5); this.emit({ k: 'toast', m: 'Endless mode: the hive keeps coming.' }); } return; }
    if (p.dead || this.phase === 'lose') return;
    if (r.a === 'place') {
      const T = TURRETS[r.kind], C = CLASSES[p.cls]; if (!T || ![C.sentry, C.defense, C.third].includes(r.kind)) return;
      if ((p.kits ?? KITS) < 1) return say('No turret kits left: pick up more in the hub (you carry 2).');
      const sc = scrapCost(r.kind); if ((p.scrap || 0) < sc) return say(`Need ${sc} scrap for a ${T.name}. Run over the scrap piles around the wrecks.`);
      if (this.turrets.filter(t => t.owner === id).length >= MAX_TURRETS) return say(`You can have ${MAX_TURRETS} at once. Sell one (Y) first.`);
      const err = this.dropError(r.x, r.z); if (err) return say(err);
      p.kits = (p.kits ?? KITS) - 1; p.scrap -= sc; const t = { id: this.nid++, kind: r.kind, owner: id, x: r.x, z: r.z, ry: r.ry || 0, lvl: 1, hp: T.hp, mhp: T.hp, cd: 0, tg: 0, spent: T.cost, ch: T.charges || T.uses || 0, y: this.W.top(r.x, r.z), b: BUILD[r.kind], bt: BUILD[r.kind], fresh: true };
      if (T.ball && r.thrown) { this.settle(t); } else { this.stow(p); t.carry = id; this.settle(t); }
      this.turrets.push(t); this.emit({ k: 'placed', x: t.x, z: t.z, by: id });
    } else if (r.a === 'upg') {
      const t = this.turrets.find(q => q.id === r.id); if (!t || t.lvl >= 3) return; const c = upgradeCost(t); if (p.gold < c) return say(`Need ${c} gold to upgrade.`);
      if (t.b > 0) return say('That turret is still under construction.'); p.gold -= c; t.spent += c; t.next = t.lvl + 1; t.b = t.bt = 3 + 2 * t.lvl; this.emit({ k: 'upgstart', id: t.id, by: id, x: t.x, z: t.z });
    } else if (r.a === 'salvage') {
      if (this.time - (p.salT ?? -99) < 30) return; p.salT = this.time; const pm = pwMax(p.cls); p.pw = Math.min(pm, (p.pw ?? pm) + pm * 0.5);
    } else if (r.a === 'dress') {
      if ((p.dr ?? DRESS) < 1 || p.hp >= p.mhp) return; p.dr = (p.dr ?? DRESS) - 1; p.hp = Math.min(p.mhp, p.hp + 40); this.emit({ k: 'dressed', to: id });
    } else if (r.a === 'cls') {
      // change class in the hub: every turret and barricade you own is sold first
      if (!CLASSES[r.cls] || r.cls === p.cls) return; if (!this.W.T.hubAt(p.x, p.z)) return say('Change class inside the hub.');
      let refund = 0, n = 0; this.turrets = this.turrets.filter(t => { if (t.owner !== id) return true; refund += Math.round(t.spent * 0.6 * t.hp / t.mhp); n++; this.emit({ k: 'boom', x: t.x, y: 0.5, z: t.z, r: 1.5, small: 1 }); return false; });
      p.kits = KITS; const f = p.hp / p.mhp; p.cls = r.cls; p.items = CLASSES[r.cls].throw.n; p.mhp = maxHp(r.cls, p.ups); p.hp = Math.max(1, Math.round(p.mhp * f)); p.pw = pwMax(r.cls); p.special = p.special || '';
      this.emit({ k: 'swapped', to: id, cls: r.cls, n, refund }); this.emit({ k: 'toast', m: `${p.name} is now a ${CLASSES[r.cls].name}.` });
    } else if (r.a === 'stow') { this.stow(p);
    } else if (r.a === 'carry') {
      const t = this.turrets.find(q => q.id === r.id); if (!t || t.carry || this.turrets.some(q => q.carry === id)) return; if (Math.hypot(t.x - p.x, t.z - p.z) > 6) return;
      t.carry = id; this.emit({ k: 'carry', id: t.id, by: id });
    } else if (r.a === 'drop') {
      const t = this.turrets.find(q => q.carry === id); if (!t) return; const err = this.dropError(+r.x, +r.z);
      if (err) { t.x = p.x; t.z = p.z; } else { t.x = +r.x; t.z = +r.z; } t.ry = +r.ry || 0; t.carry = 0; this.settle(t); this.emit({ k: 'dropped', id: t.id, x: t.x, z: t.z, by: id });
    } else if (r.a === 'sell') {
      const i = this.turrets.findIndex(q => q.id === r.id && q.owner === id); if (i < 0) return; const t = this.turrets[i]; p.kits = Math.min(KITS, (p.kits ?? KITS) + 1); p.scrap = (p.scrap || 0) + Math.floor(scrapCost(t.kind) * 0.6); this.turrets.splice(i, 1); this.emit({ k: 'boom', x: t.x, y: 0.5, z: t.z, r: 1.5, small: 1 });
    } else if (r.a === 'buy-disabled') {
      if (!UPGRADES.some(u => u.id === r.up)) return; const lv = p.ups[r.up] || 0; if (lv >= 5) return; const c = UPG_PRICES[lv]; if (p.gold < c) return say(`Need ${c} gold.`);
      p.gold -= c; p.ups[r.up] = lv + 1; const m = maxHp(p.cls, p.ups); p.hp += m - p.mhp; p.mhp = m; this.emit({ k: 'bought', to: id });
    } else if (r.a === 'hit') {
      const a = this.aliens.find(q => q.id === r.id); if (!a) return;
      if (a.cave && !this.inCave(p.x, p.z)) { if (this.time - (a.far || -9) > 4) { a.far = this.time; say('Your shots can\'t reach into the cavern: get inside to hurt the queen and her guards.'); } return; }
      if (p.cls === 'sniper') { a.mark = Math.max(a.mark || 0, 1.25); a.markT = 6; a.rev = 6; a.hidden = false; } if (p.cls === 'gunner' && !ALIENS[a.type].boss) { a.slowT = 0.5; a.slowF = Math.min(a.slowF ?? 1, 0.8); }
      this.hurtAlien(a, Math.min(+r.d || 0, 2400), id, r.ap);
    } else if (r.a === 'cmd') {
      const C = this.cmd; let c = 0, msg = '';
      if (r.w === 'rate') { if (C.lv >= DROP_EVERY.length - 1) return; c = DROP_COST[C.lv + 1]; if (p.gold < c) return say(`Need ${c} gold.`); C.lv++; msg = `Reinforcements now every ${DROP_EVERY[C.lv]} s`; }
      else if (r.w === 'size') { if (C.sz >= SQUAD.length - 1) return; c = SQUAD_COST[C.sz + 1]; if (p.gold < c) return say(`Need ${c} gold.`); C.sz++; msg = `Reinforcements now ${SQUAD[C.sz]} marines per drop`; }
      else if (ALLIES[r.w] && !C.un.includes(r.w)) { c = ALLIES[r.w].unlock; if (p.gold < c) return say(`Need ${c} gold.`); C.un.push(r.w); msg = `${ALLIES[r.w].name}s will now join the reinforcements`; }
      else return;
      p.gold -= c; this.emit({ k: 'toast', m: `${p.name}: ${msg}.` }); this.emit({ k: 'bought', to: id });
    } else if (r.a === 'heal') {
      if (p.cls !== 'medic') return; const dt = Math.min(0.5, +r.dt || 0);
      const tg = r.k === 'a' ? this.allies.find(m => m.id === r.id) : r.k === 'p' ? this.players.get(r.id) : null;
      if (tg && !tg.dead && Math.hypot(tg.x - p.x, tg.z - p.z) < 16) { tg.hp = Math.min(tg.mhp, tg.hp + 28 * dt); this.emit({ k: 'beam', c: 0x40ff80, a: [p.x, p.y + 1.3, p.z], b: [tg.x, (tg.y || 0) + 1.2, tg.z], f: id }); } else p.hp = Math.min(p.mhp, p.hp + 8 * dt);
    } else if (r.a === 'repair') {
      // the welding torch: a short laser that repairs turrets, welds on free upgrades, and burns aliens; it always draws power while lit
      const eng = p.cls === 'engineer', dt = Math.min(0.5, +r.dt || 0), pm = pwMax(p.cls), reach = eng ? 8 : 6;
      if ((p.pw ?? pm) <= 0) { if (this.time - (p.upgSay || -9) > 3) { p.upgSay = this.time; say('Welder out of power: recharge in the hub, at a Forward Resupply or Ammo Cache, or grab a supply drop.'); } return; }
      p.pw = Math.max(0, (p.pw ?? pm) - 2 * dt);
      if (r.k === 'a') { const a = this.aliens.find(q => q.id === r.id); if (a && !a.dead && Math.hypot(a.x - p.x, a.z - p.z) < reach + ALIENS[a.type].r) { p.pw = Math.max(0, p.pw - 6 * dt); this.hurtAlien(a, (eng ? 95 : 60) * dt, id, true); this.emit({ k: 'beam', c: 0xff8040, a: [p.x, p.y + 1.3, p.z], b: [a.x, a.y + ALIENS[a.type].h * 0.6, a.z], f: id, torch: 1 }); } return; }
      const t = this.turrets.find(q => q.id === r.id);
      if (t && Math.hypot(t.x - p.x, t.z - p.z) < reach + 1.5) {
        if (t.hp < t.mhp) { t.hp = Math.min(t.mhp, t.hp + (eng ? 81 : 27) * dt); p.pw = Math.max(0, p.pw - 2 * dt); }
        else if (t.lvl < 3 && !t.fresh && !t.carry) {
          // scrap burns as the weld goes on: no up-front cost, the weld just stops when you run out
          let dp = dt / (4 + 2 * t.lvl) * (eng ? 3 : 1); const cost = SCRAP_COST[t.lvl] || 30, need = cost * dp;
          if ((p.scrap || 0) < need) { if ((p.scrap || 0) <= 0.001) { p.scrap = 0; if (this.time - (p.upgSay || -9) > 3) { p.upgSay = this.time; say('Out of scrap: the weld stops. Run over the scrap piles lying around the map.'); } return; } dp *= p.scrap / need; p.scrap = 0; } else p.scrap -= need;
          if (!t.next) { t.next = t.lvl + 1; t.up = 0; this.emit({ k: 'upgstart', id: t.id, by: id, x: t.x, z: t.z }); }
          t.up = (t.up || 0) + dp; p.pw = Math.max(0, p.pw - 10 * dt);
          if (t.up >= 1) { t.lvl = t.next; t.next = 0; t.up = 0; const k = TURRETS[t.kind].hp * (1 + 0.4 * (t.lvl - 1)); t.hp += k - t.mhp; t.mhp = k; this.emit({ k: 'upg', id: t.id, lvl: t.lvl, x: t.x, z: t.z }); }
        }
        this.emit({ k: 'beam', c: eng ? 0x60c0ff : 0xffc060, a: [p.x, p.y + 1.3, p.z], b: [t.x, t.y + 1.2, t.z], f: id, torch: 1 });
      }
    } else if (r.a === 'ability') {
      if (!CLASSES[p.cls].abilities) return; const n = Math.max(0, Math.min(3, r.n | 0)), A = CLASSES[p.cls].abilities[n]; if (p.acd[n] > 0) return; p.acd[n] = A.cd; this.ability(p, A.id, r); this.emit({ k: 'ability', id: A.id, by: id, x: p.x, y: p.y, z: p.z, n: p.name, name: A.name });
    } else if (r.a === 'throw') {
      if (p.items <= 0) return say('Nothing left to throw: restock at the hub or a Forward Resupply.'); const kind = CLASSES[p.cls].throw.kind; if (kind === 'frag') { p.items--; return; }
      const x = Math.max(-BOUNDS, Math.min(BOUNDS, +r.x)), z = Math.max(-BOUNDS, Math.min(BOUNDS, +r.z)); if (Math.hypot(x - p.x, z - p.z) > 16) return; p.items--;
      if (kind === 'claymore') { if (this.turrets.filter(t => t.kind === 'claymore' && t.owner === id).length >= 3) { p.items++; return say('Three claymores are already out.'); } this.turrets.push({ id: this.nid++, kind: 'claymore', owner: id, x, z, y: this.W.top(x, z), ry: +r.ry || 0, lvl: 1, hp: 99999, mhp: 99999, cd: 0, tg: 0, spent: 0, b: 0, bt: 0 }); }
      else this.items.push({ id: this.nid++, kind, x, z, life: 90, by: id });
    } else if (r.a === 'special') {
      const sp = p.special; if (!sp) return;
      if (sp === 'missile') { if (r.x === undefined) return; const x = Math.max(-BOUNDS, Math.min(BOUNDS, +r.x)), z = Math.max(-BOUNDS, Math.min(BOUNDS, +r.z)), y = this.W.top(x, z), hx = this.W.hubP.x, hz = this.W.hubP.z, hy = this.path.y(this.path.len);
        const d = Math.hypot(x - hx, z - hz), fly = 1.5 + d / MISSILE.speed, m = { x, y, z, t: MISSILE.launch + fly, owner: id }; this.tm.push(m);
        this.emit({ k: 'tmiss', a: [hx, hy + 8, hz], b: [+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)], l: MISSILE.launch, f: +fly.toFixed(2), n: p.name }); }
      else if (SPECIALS[sp].aim && r.x === undefined) return;
      else if (SPECIALS[sp].aim) this.callIn(sp, Math.max(-BOUNDS + 4, Math.min(BOUNDS - 4, +r.x)), Math.max(-BOUNDS + 4, Math.min(BOUNDS - 4, +r.z)), p);
      else if (sp === 'drone') { for (let i = 0; i < 3; i++) this.drones.push({ id: this.nid++, x: p.x, z: p.z, y: p.y, t: 15, a: i * 2.09, cd: 0, tg: 0, owner: id, follow: id }); }
      else if (sp === 'hubrepair') this.hub = Math.min(this.hubMax, this.hub + 25);
      else if (sp === 'overdrive') { for (const t of this.turrets) if (t.owner === id) t.od = 15; }
      else if (sp === 'stim') { p.hp = p.mhp; p.stimT = 12; }
      else if (sp === 'squad') { const n = this.path.near(p.x, p.z); for (let i = 0; i < 4; i++) { const type = ['gunner', 'rocketeer', 'trooper', 'medic'][i], A = ALLIES[type]; this.allies.push({ id: this.nid++, type, s: n.s, lat: (Math.random() - 0.5) * 3, x: p.x + (Math.random() - 0.5) * 3, y: p.y, z: p.z + (Math.random() - 0.5) * 3, hp: A.hp * 1.5, mhp: A.hp * 1.5, ry: 0, cd: 0, tg: 0, vet: 1 }); } }
      this.emit({ k: 'usedspecial', s: sp, by: id, n: p.name }); p.special = '';
    } else if (r.a === 'fall') {
      this.hurtPlayer(p, 15);
    } else if (r.a === 'boom') {
      this.splash(+r.x, +r.y, +r.z, Math.min(+r.r || 0, 7), Math.min(+r.d || 0, 600), id);
      if (r.fire && p.buf.napalm > 0) { p.buf.napalm = 0; this.pools.push({ x: +r.x, y: +r.y, z: +r.z, r: 7, t: 6, dps: 70, owner: id, fire: 1 }); }
    }
  }
  pose(id, x, y, z, yaw, kn, veh) { const p = this.players.get(id); if (!p || p.dead) return; p.kn = kn || 0; p.veh = veh || 0; p.x = Math.max(-500, Math.min(500, x)); p.y = y; p.z = Math.max(-500, Math.min(500, z)); p.yaw = yaw; }

  // ---------------------------------------------------------------- damage
  hurtAlien(a, d, owner, ap) {
    if (a.hp <= 0) return; a.lastHit = this.time; if (a.markT > 0) d *= a.mark || 1; if (a.ballT > 0) d *= a.ballK || 1.2;   // inside a Sentry Ball's field
    const op = owner && this.players.get(owner); if (op) { if (op.stimT > 0) d *= 1.5; if (op.buf.rally > 0) d *= 1.25; if (op.buf.fortify > 0) d *= 1.3; for (const q of this.players.values()) if (q !== op && !q.dead && q.cls === 'assault' && Math.hypot(q.x - op.x, q.z - op.z) < 14) { d *= 1.15; break; } }
    const A = ALIENS[a.type]; a.hp -= d * (ap ? 1 : 1 - (A.armor || 0));
    if (a.hp <= 0) this.killAlien(a, owner);
  }
  splash(x, y, z, r, d, owner) {
    this.emit({ k: 'boom', x, y, z, r });
    const outside = !this.inCave(x, z); for (const a of this.aliens) { if (a.cave && outside) continue; const dist = Math.hypot(a.x - x, a.y + ALIENS[a.type].h * 0.5 - y, a.z - z) - ALIENS[a.type].r; if (dist < r) this.hurtAlien(a, d * (1 - Math.max(0, dist) / r * 0.6), owner, true); }
  }
  killAlien(a, owner) {
    a.dead = true; const A = ALIENS[a.type]; this.emit({ k: 'die', id: a.id, x: a.x, y: a.y, z: a.z, t: a.type });
    const p = this.players.get(owner); if (p) p.kills++;
    for (const q of this.players.values()) q.gold += Math.round(A.bounty * (q.id === owner ? 1 : 0.4));
    if (A.boss || a.type === 'broodqueen') this.emit({ k: 'toast', m: `${A.name} destroyed${p ? ' by ' + p.name : ''}!`, big: 1 });
    if (a.type === 'broodqueen') { this.phase = 'win'; this.emit({ k: 'win', w: this.wave, el: Math.floor(this.el || 0) }); }
  }
  closest(list, a, r, dy = 99) { let best = null, bd = r; for (const q of list) { if (q.dead) continue; const d = Math.hypot(q.x - a.x, q.z - a.z); if (d < bd && Math.abs((q.y || 0) - a.y) < dy + 3) { bd = d; best = q; } } return best; }
  aggro(a, k, id, time) { a.mode = 'hunt'; a.tk = k; a.tid = id; a.ht = time ? (ALIENS[a.type].hunt || {}).time || 8 : (ALIENS[a.type].hunt || {}).time || 8; this.emit({ k: 'aggro', x: a.x, z: a.z, to: k === 'p' ? id : '', t: a.type }); }
  hurtPlayer(p, d, by) {
    if (p.dead) return; for (const dm of this.domes) if (Math.hypot(p.x - dm.x, p.z - dm.z) < dm.r) return; for (const q of this.players.values()) if (q !== p && !q.dead && q.cls === 'heavy' && Math.hypot(q.x - p.x, q.z - p.z) < 12) { d *= 0.8; break; } p.hp -= d * (p.buf.iron > 0 ? 0.4 : 1) * (p.buf.nano > 0 ? 0.6 : 1); if (by) this.emit({ k: 'hitp', to: p.id, x: +by.x.toFixed(1), z: +by.z.toFixed(1) });
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.rt = 7; this.emit({ k: 'toast', m: p.name + ' is down! Back in 7 seconds.' }); }
  }
  hurtTurret(t, d, by) { if (t.carry) d *= 2; t.hp -= d; if (by && this.time - (t.warned || -99) > 5) { t.warned = this.time; this.emit({ k: 'tatk', id: t.id, o: t.owner, kind: t.kind, x: t.x, z: t.z }); } if (t.hp <= 0) { this.turrets = this.turrets.filter(q => q !== t); this.emit({ k: 'boom', x: t.x, y: 1, z: t.z, r: 2.5 }); this.emit({ k: 'say', to: t.owner, m: `Your ${TURRETS[t.kind].name} was destroyed.` }); } }

  // ---------------------------------------------------------------- waves
  // No separate waves: the threat level rises every LEVEL_T seconds, and that level's aliens join one steady stream.
  startWave() {
    const first = this.phase !== 'wave'; this.wave++; TECH.k = techMul(this.wave); this.commander();
    if (first) { this.radio('gen', 'Station Olympus to ground force. The queen\'s hive is confirmed in the mountain. You are cleared to engage.', 1); this.later.push({ t: 6, f: () => this.radio('cmd', 'Copy, Olympus. Marines, hold the hub, keep the turrets fed and push for that cave. I\'ll keep troops and supplies coming.', 1) }); }
    else if (this.wave % 2 === 0) this.radio('gen', ['Olympus scans show the swarm thickening. More of them are coming out of that mountain.', 'Hive activity rising on our sensors, Commander. Brace your people.', 'Hale here: the bugs are pouring out faster. Hold that line.', 'Orbital count just doubled on the north slope. Stay sharp down there.'][this.wave % 4]); this.phase = 'wave'; this.lvlT = LEVEL_T;
    const N = this.players.size, cs = countScale(N), rest = [], bosses = [];
    for (const [type, n0] of waveList(this.wave, this.W.id)) { const boss = ALIENS[type].boss, n = boss ? n0 : Math.round(n0 * cs); for (let i = 0; i < n; i++) (boss ? bosses : rest).push(type); }
    for (let i = rest.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const span = LEVEL_T * 0.96; rest.forEach((type, i) => this.q.push({ type, t: this.qt + (i + Math.random() * 0.8) * span / rest.length }));
    bosses.forEach((type, i) => this.q.push({ type, t: this.qt + span * 0.3 + i * 6 })); this.q.sort((x, y) => x.t - y.t);
    const bonus = 0;
    this.emit({ k: 'wave', w: this.wave, first: first ? 1 : 0, b: bonus, boss: bosses[0] || '' });
    if (this.W.def.hazard === 'nests' && this.wave >= 2 && this.wave % 3 === 2) for (const n of this.W.nestP) if (!this.aliens.some(a => a.nestOf === n.i)) { const a = this.spawn('nest', n.s); a.x = n.x; a.z = n.z; a.y = n.y; a.nestOf = n.i; a.qcd = 8 + n.i * 6; a.mode = 'nest'; }
    if (first) this.hzT = 300;   // the first storm comes five minutes in
  }
  dropPods(n) {
    for (let i = 0; i < n; i++) {
      let x, z, ok = false; for (let k = 0; k < 30 && !ok; k++) { x = (Math.random() * 2 - 1) * (BOUNDS - 10); z = (Math.random() * 2 - 1) * (BOUNDS - 10); ok = this.path.near(x, z).d > 6 && this.W.T.chasm(x, z) > 0.99 && this.W.T.ridge(x, z) < 2 && Math.hypot(x - this.W.hiveP.x, z - this.W.hiveP.z) > 38 && !this.W.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 1.5); }
      if (ok) { const pod = { id: this.nid++, x, z, land: DROP_FALL, life: DROP_FALL + DROP_LIFE, sp: Math.random() < 0.6 ? pickSpecial() : '' }; this.pods.push(pod); }
    }
    if (n) this.emit({ k: 'drop2', n });
  }
  spawn(type, s = 0) {
    const A = ALIENS[type], p = this.path.at(s), lat = (Math.random() - 0.5) * (A.boss ? 0.5 : 3.2), sc = A.boss ? hpScale(this.wave, 1) * bossScale(this.players.size) : hpScale(this.wave, this.players.size), hp = A.hp * sc;
    const a = { id: this.nid++, type, s, lat, x: p.x - p.tz * lat, y: p.y + (A.fly ? 4.5 : 0), z: p.z + p.tx * lat, hp, mhp: hp, ry: Math.atan2(-p.tx, -p.tz), spd: A.speed * (0.92 + Math.random() * 0.16), slowT: 0, stun: 0, atk: 0, mode: 'path', cc: Math.random() * 3, tgt: null, rcd: 1 + Math.random() * 2, qcd: 6 };
    this.aliens.push(a); if (A.boss) { this.emit({ k: 'roar', t: type }); this.radio && this.radio('gen', `Olympus here: a ${A.name} just came out of the hive. Focus everything on it!`, 1); } return a;
  }

  update(dt) {
    const P = this.path, T = this.W.T; this.time = (this.time || 0) + dt;
    // marines
    for (const p of this.players.values()) {
      if (p.dead) { p.rt -= dt; if (p.rt <= 0) { p.dead = false; p.hp = p.mhp; p.sp++; p.x = this.W.spawn.x; p.z = this.W.spawn.z; p.y = this.W.top(p.x, p.z); } continue; }
      if (this.phase === 'wave') p.gold += dt * (1.6 + this.wave * 0.08);
      for (let k = 0; k < 4; k++) p.acd[k] = Math.max(0, p.acd[k] - dt); for (const k in p.buf) p.buf[k] = Math.max(0, p.buf[k] - dt); p.adrT = Math.max(0, p.adrT - dt); p.stimT = Math.max(0, p.stimT - dt);
      const inHub = !!this.W.T.hubAt(p.x, p.z); p.regen = this.hub > 0 && inHub && p.hp < p.mhp; if (p.regen) p.hp = Math.min(p.mhp, p.hp + 16 * dt);
      { const pm = pwMax(p.cls); if (inHub) p.pw = Math.min(pm, (p.pw ?? pm) + 25 * dt); else if (this.turrets.some(t => (t.kind === 'resupply' || t.kind === 'ammocache') && !t.fresh && !t.carry && Math.hypot(t.x - p.x, t.z - p.z) < 6)) p.pw = Math.min(pm, (p.pw ?? pm) + 3 * dt); }
      for (const sc of this.scrap) if (!sc.got && Math.abs(sc.x - p.x) < 2.6 && Math.abs(sc.z - p.z) < 2.6 && Math.hypot(sc.x - p.x, sc.z - p.z) < 2.6) { sc.got = true; p.scrap = (p.scrap || 0) + sc.n; this.emit({ k: 'scrap', to: p.id, n: sc.n }); }
      if (inHub && (p.dr ?? DRESS) < DRESS) { p.drT = (p.drT || 0) + dt; if (p.drT > 4) { p.drT = 0; p.dr = (p.dr ?? DRESS) + 1; } }
      if (inHub && (p.kits ?? KITS) < KITS) { p.kitT = (p.kitT || 0) + dt; if (p.kitT > 3) { p.kitT = 0; p.kits = (p.kits ?? KITS) + 1; this.emit({ k: 'kit', to: p.id, n: p.kits }); } }
      if (inHub && p.items < CLASSES[p.cls].throw.n) { p.irT = (p.irT || 0) + dt; if (p.irT > 2) { p.irT = 0; p.items++; } }
      for (const it of this.items) if (!it.got && Math.hypot(it.x - p.x, it.z - p.z) < 2) { if (it.kind === 'medkit' && p.hp < p.mhp) { it.got = true; p.hp = Math.min(p.mhp, p.hp + 60); this.emit({ k: 'pickup', to: p.id, kind: 'medkit' }); } else if (it.kind === 'ammo' && !(it.by === p.id && it.age < 2)) { it.got = true; this.emit({ k: 'ammo', to: p.id }); } }
      if (this.stormI > 0.5 && !this.sheltered(p, inHub)) { p.hp -= 2 * (this.stormI - 0.5) * 2 * dt; p.cold = 1; if (p.hp <= 0) this.hurtPlayer(p, 1); } else p.cold = 0;
      p.toxic = Math.max(0, (p.toxic || 0) - dt); for (const c of this.spores) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r * c.k) { p.hp -= 4 * c.k * dt; p.toxic = 0.3; if (p.hp <= 0) this.hurtPlayer(p, 1); }
      for (const c of this.ammo) if (Math.hypot(p.x - c.x, p.z - c.z) < 2.6 && (c.cd[p.id] || 0) < this.time) { c.cd[p.id] = this.time + 1; this.emit({ k: 'ammo', to: p.id }); }
      for (const pod of this.pods) if (!pod.got && pod.kind && pod.land <= 0 && Math.hypot(pod.x - p.x, pod.z - p.z) < 2.4) { pod.got = true; if (pod.kind === 'ammo') { this.emit({ k: 'ammo', to: p.id, big: 1 }); p.pw = pwMax(p.cls); p.items = CLASSES[p.cls].throw.n; } else { p.dr = DRESS; p.hp = Math.min(p.mhp, p.hp + 30); this.emit({ k: 'dresskit', to: p.id }); } this.emit({ k: 'pod', by: p.id, g: 0, x: pod.x, z: pod.z, sp: '', kind: pod.kind }); }
      for (const pod of this.pods) if (!pod.got && !pod.kind && pod.land <= 0 && Math.hypot(pod.x - p.x, pod.z - p.z) < 2.4) { pod.got = true; const g = 90 + this.wave * 15; for (const q of this.players.values()) q.gold += q === p ? g : Math.round(g * 0.4); if (pod.sp) { if (p.special) this.emit({ k: 'say', to: p.id, m: `${SPECIALS[pod.sp].name} replaced your ${SPECIALS[p.special].name}.` }); p.special = pod.sp; } this.emit({ k: 'pod', by: p.id, g, x: pod.x, z: pod.z, sp: pod.sp || '' }); this.emit({ k: 'ammo', to: p.id, big: 1 }); p.pw = pwMax(p.cls); }
    }
    if (this.scrap.some(s => s.got)) this.scrap = this.scrap.filter(s => !s.got); this.scrapT += dt; if (this.scrapT > 4 && this.scrap.length < SCRAP_PILES) { this.scrapT = 0; this.spawnScrap(); }
    for (const q of this.pods) { q.land -= dt; q.life -= dt; if (q.life <= 0 && !q.got) { q.got = true; this.emit({ k: 'podgone', x: q.x, z: q.z }); } }
    if (this.pods.some(q => q.got)) this.pods = this.pods.filter(q => !q.got);
    for (const it of this.items) { it.life -= dt; it.age = (it.age || 0) + dt; } if (this.items.some(it => it.got || it.life <= 0)) this.items = this.items.filter(it => !it.got && it.life > 0);
    if (this.phase === 'lose' || this.phase === 'win') return;

    if (this.phase === 'build') { if (this.timer > 0) { this.timer -= dt; if (this.timer <= 0) this.startWave(); } }
    else if (this.phase === 'assault') { this.hazards(dt); }
    else if (this.phase === 'wave') {
      // the stream keeps flowing, but never more than about 110 aliens on the field at once (the rest wait their turn)
      const alive = this.aliens.length; if (alive < 110) this.qt += dt; while (this.q.length && this.q[0].t <= this.qt && this.aliens.length < 110) this.spawn(this.q.shift().type);
      this.lvlT -= dt; if (this.lvlT <= 0) this.startWave(); this.el = (this.el || 0) + dt;
      this.podT += dt; if (this.podT >= 60) { this.podT = 0; this.dropPods(2); }
      this.hazards(dt);
    }

    // turrets that change aliens around them
    for (const t of this.turrets) if (t.kind === 'stasis' && !t.fresh) { const st = tStat(t); for (const a of this.aliens) if (!ALIENS[a.type].boss || t.lvl > 1) if (Math.hypot(a.x - t.x, a.z - t.z) < st.range) { a.slowT = 0.15; a.slowF = st.slow; } }

    // aliens
    const living = this.living();
    for (const a of this.aliens) {
      if (a.dead) continue; const A = ALIENS[a.type]; a.cc -= dt; a.atk -= dt; a.rcd -= dt; if (a.markT > 0) a.markT -= dt; if (a.rev > 0) a.rev -= dt; if (a.ballT > 0) a.ballT -= dt;
      // nests sit off the track and hatch crawlers that go for the nearest marine
      if (A.nest) { a.qcd -= dt; if (a.qcd <= 0 && this.phase === 'wave') { a.qcd = 26 + Math.random() * 10; this.emit({ k: 'hatch', x: a.x, z: a.z }); for (let i = 0, nn = Math.round(4 * countScale(this.players.size)); i < nn; i++) { const c = this.spawn('crawler', a.s); c.x = a.x + (Math.random() - 0.5) * 3; c.z = a.z + (Math.random() - 0.5) * 3; c.y = this.W.ground(c.x, c.z, a.y + 1); c.lat = (Math.random() - 0.5) * 3; const p = this.closest(living, c, 45); if (p) this.aggro(c, 'p', p.id, 1.5); else c.mode = 'return'; } } continue; }
      // the Brood Queen: heals when left alone, spits at anyone in her cave, and births Royal Guards and Stalkers while she is under attack
      if (a.type === 'broodqueen') {
        const near = t => this.inCave(t.x, t.z), foes = [...living.filter(near), ...this.allies.filter(near), ...this.turrets.filter(t => near(t) && !t.carry && !TURRETS[t.kind].mine)], guards = this.aliens.filter(q => q.type === 'royal' && !q.dead).length;
        if (a.rcd <= 0 && foes.length) { let tg = null, bd = A.ranged; for (const f of foes) { const d = Math.hypot(f.x - a.x, f.z - a.z); if (d < bd) { bd = d; tg = f; } } if (tg) { a.rcd = 1.3; const isP = 'cls' in tg; this.emit({ k: 'spit', a: [a.x, a.y + 5, a.z], b: [tg.x, (tg.y || 0) + 1.2, tg.z], q: 1 }); if (isP) this.hurtPlayer(tg, A.dmg, a); else if (tg.kind) this.hurtTurret(tg, A.dmg * 1.5, a); else this.hurtAlly(tg, A.dmg * 1.5); } }
        if (!foes.length && this.time - (a.lastHit ?? -99) > 10) a.hp = Math.min(a.mhp, a.hp + a.mhp * 0.01 * dt);   // heals only when her cave is clear
        a.qcd -= dt; if (a.qcd <= 0) {
          if (foes.length) { a.qcd = 12; if (guards < 3 + 2 * this.players.size) this.spawnGuard(a); for (let i = 0; i < 2; i++) { const c = this.spawn('crawler', 0); c.x = a.x + (Math.random() - 0.5) * 6; c.z = a.z + (Math.random() - 0.5) * 6; c.mode = 'hunt'; const tg = living.find(near); if (tg) { c.tk = 'p'; c.tid = tg.id; c.ht = 10; } else c.mode = 'path'; } this.emit({ k: 'hatch', x: a.x, z: a.z }); }
          else { a.qcd = 20; if (guards < 4 + 2 * this.players.size) this.spawnGuard(a); }
        }
        continue;
      }
      // Royal Guards keep to the queen's chamber: they rush anyone who comes in and go back to their posts when it is clear
      if (a.mode === 'guard') {
        const inCave = t => this.inCave(t.x, t.z); let tg = null, bd = 40;
        for (const f of [...living, ...this.allies, ...this.turrets.filter(t => !t.carry && !TURRETS[t.kind].mine)]) { if (!inCave(f)) continue; const d = Math.hypot(f.x - a.x, f.z - a.z); if (d < bd) { bd = d; tg = f; } }
        const gx = tg ? tg.x : a.px, gz = tg ? tg.z : a.pz, dx = gx - a.x, dz = gz - a.z, d = Math.hypot(dx, dz) || 1; if (a.stun > 0) { a.stun -= dt; continue; }
        const sp = a.spd * (a.slowT > 0 ? (a.slowF ?? 0.5) : 1); if (a.slowT > 0) a.slowT -= dt;
        if (tg && d < A.r + 1.5) { this.face(a, dx, dz); if (a.atk <= 0) { a.atk = 1; if ('cls' in tg) this.hurtPlayer(tg, A.dmg, a); else if (tg.kind) this.hurtTurret(tg, A.dmg, a); else this.hurtAlly(tg, A.dmg * 1.5); this.emit({ k: 'bite', x: a.x, z: a.z }); } }
        else if (d > 0.6) { this.face(a, dx, dz); a.x += dx / d * sp * dt; a.z += dz / d * sp * dt; a.y = this.W.ground(a.x, a.z, a.y + 1); }
        a.hidden = false; continue;
      }
      if (a.stun > 0) { a.stun -= dt; continue; }
      const sp = a.spd * (a.slowT > 0 ? (a.slowF ?? 0.5) : 1) * (1 + 0.15 * (this.stormI || 0)); if (a.slowT > 0) a.slowT -= dt;
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
        let wall = null; for (const t of this.turrets) if (t.kind === 'barricade' && t.on && !t.carry && !t.fresh && t.s > a.s && t.s - a.s < A.r + 0.9) { wall = t; break; }
        if (wall) { this.face(a, wall.x - a.x, wall.z - a.z); if (a.atk <= 0) { a.atk = 1; this.hurtTurret(wall, A.dmg * (a.type === 'brute' || A.boss ? 2.2 : 1), a); this.emit({ k: 'bite', x: a.x, z: a.z }); } if (A.fly) a.y += (P.y(a.s) + 2 - a.y) * Math.min(1, dt * 3); continue; }
        // something worth leaving the track for?
        if (A.melee && !A.boss && a.cc <= 0 && a.mode === 'path') { const rs = this.turrets.find(t => t.kind === 'resupply' && !t.fresh && (t.pd ?? (t.pd = this.path.near(t.x, t.z).d)) < 22 && Math.hypot(t.x - a.x, t.z - a.z) < 24); if (rs) { this.aggro(a, 't', rs.id); continue; } }
        if (A.hunt && a.cc <= 0) { const H = A.hunt, tt = H.t && this.closest(this.turrets.filter(t => !TURRETS[t.kind].onPath && !TURRETS[t.kind].mine), a, H.t), pp = H.p && this.closest(living, a, H.p, A.fly ? 9 : 2.5); if (tt) this.aggro(a, 't', tt.id); else if (pp) this.aggro(a, 'p', pp.id); }
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
      if (a.s >= P.len - 4) { a.dead = true; a.reached = true; this.hub = Math.max(0, this.hub - A.hub); this.emit({ k: 'hubhit', d: A.hub, x: a.x, y: a.y, z: a.z }); for (const th of [75, 50, 25]) if (this.hub <= th && !(this.hubSaid || {})[th]) { (this.hubSaid = this.hubSaid || {})[th] = 1; this.radio('cmd', th === 25 ? 'The hub is about to fall! Everyone back to the hub, now!' : `Hub at ${th} percent. They are getting through, marines!`, 1); } }
    }
    if (this.aliens.some(a => a.dead)) this.aliens = this.aliens.filter(a => !a.dead);
    if (this.hub <= 0 && this.phase !== 'lose') { this.phase = 'lose'; this.emit({ k: 'lose', w: this.wave, el: Math.floor(this.el || 0) }); }

    // turrets
    for (const t of this.turrets) if (t.kind === 'uav' && !t.fresh && !t.carry) { const st = tStat(t), k = 1.2 + 0.1 * (t.lvl - 1); for (const a of this.aliens) if (Math.hypot(a.x - t.x, a.z - t.z) < st.range) { a.ballK = Math.max(a.ballT > 0 && a.ballK || 1, k); a.ballT = 0.4; a.rev = Math.max(a.rev || 0, 0.4); a.hidden = false; } }
    for (const t of this.turrets) if (t.life !== undefined) { t.life -= dt; if (t.life <= 0) t.hp = 0; } if (this.turrets.some(t => t.hp <= 0)) this.turrets = this.turrets.filter(t => t.hp > 0);
    for (const t of this.turrets) if (t.carry) { const c = this.players.get(t.carry); if (!c || c.dead) { t.carry = 0; this.settle(t); continue; } t.x = c.x - Math.sin(c.yaw) * 1.7; t.z = c.z - Math.cos(c.yaw) * 1.7; t.y = (c.y || 0) + 0.3; t.ry = c.yaw; }
    for (const t of this.turrets) {
      if (t.carry) { t.tg = 0; continue; }
      // building and upgrading take time; a new turret does nothing until it is finished, an upgrading one keeps its old level
      if (t.b > 0) { t.b -= dt; if (t.b <= 0) { t.b = 0; if (t.fresh) { t.fresh = false; this.emit({ k: 'built', id: t.id, x: t.x, z: t.z, o: t.owner, kind: t.kind }); } if (t.next) { t.lvl = t.next; t.next = 0; const k = TURRETS[t.kind].hp * (1 + 0.4 * (t.lvl - 1)); t.hp += k - t.mhp; t.mhp = k; this.emit({ k: 'upg', id: t.id }); } } t.tg = 0; continue; }
      t.oc = Math.max(0, (t.oc || 0) - dt); t.od = Math.max(0, (t.od || 0) - dt);
      const st = tStat(t); st.rate *= (t.oc > 0 ? 1.6 : 1) * (t.od > 0 ? 2 : 1); t.cd -= dt; t.tg = 0;
      if (t.kind === 'flamer' || t.kind === 'railgun') {
        let tg = null, bs = -1; const open = this.hiveOpen(); for (const a of this.aliens) { if (a.dead || a.hidden || (a.cave && !t.inCave) || (a.type === 'hivecore' && !open)) continue; const d = Math.hypot(a.x - t.x, a.z - t.z); if (d < st.range && a.s > bs) { bs = a.s; tg = a; } }
        if (!tg) continue; t.tg = tg.id; const want = Math.atan2(-(tg.x - t.x), -(tg.z - t.z)); let dr = want - t.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; t.ry += dr * Math.min(1, dt * 8);
        if (t.cd > 0) continue; t.cd = 1 / st.rate; const fx = -Math.sin(t.ry), fz = -Math.cos(t.ry);
        if (t.kind === 'flamer') { for (const a of this.aliens) { if (a.dead || a.hidden || (a.cave && !t.inCave) || (a.type === 'hivecore' && !open)) continue; const dx = a.x - t.x, dz = a.z - t.z, d = Math.hypot(dx, dz); if (d < st.range && (dx * fx + dz * fz) / (d || 1) > Math.cos(TURRETS.flamer.cone)) this.hurtAlien(a, st.dmg, t.owner, true); } }
        else { const L = st.range, ex = t.x + fx * L, ez = t.z + fz * L; for (const a of this.aliens) { if (a.dead || (a.cave && !t.inCave) || (a.type === 'hivecore' && !open)) continue; const px = a.x - t.x, pz = a.z - t.z, along = px * fx + pz * fz; if (along < 0 || along > L) continue; if (Math.abs(px * fz - pz * fx) < ALIENS[a.type].r + 0.6) this.hurtAlien(a, st.dmg, t.owner, true); } this.emit({ k: 'rail', a: [t.x, t.y + 2.2, t.z], b: [+ex.toFixed(1), +(tg.y + 1).toFixed(1), +ez.toFixed(1)] }); }
      } else if (t.kind === 'mines') {
        if (t.cd > 0) continue; for (const a of this.aliens) { if (a.dead || ALIENS[a.type].fly || ALIENS[a.type].static) continue; if (Math.hypot(a.x - t.x, a.z - t.z) < st.range) { this.splash(t.x, t.y + 0.4, t.z, TURRETS.mines.splash, st.dmg, t.owner); t.ch--; t.cd = 1.2; if (t.ch <= 0) { t.hp = 0; this.turrets = this.turrets.filter(q => q !== t); } break; } }
      } else if (t.kind === 'minigun' || t.kind === 'pulse' || t.kind === 'tesla' || t.kind === 'missile') {
        let tg = null, bs = -1; const open = this.hiveOpen(); for (const a of this.aliens) { if (a.dead || a.hidden || (a.cave && !t.inCave) || (a.type === 'hivecore' && !open)) continue; const d = Math.hypot(a.x - t.x, a.z - t.z); if (d < st.range && a.s > bs) { bs = a.s; tg = a; } }
        if (!tg) continue; t.tg = tg.id; const want = Math.atan2(-(tg.x - t.x), -(tg.z - t.z)); let dr = want - t.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; t.ry += dr * Math.min(1, dt * 10);
        if (t.cd > 0) continue; t.cd = 1 / st.rate;
        if (t.kind === 'minigun' || t.kind === 'pulse') this.hurtAlien(tg, st.dmg, t.owner);
        else if (t.kind === 'tesla') {
          const pts = [[t.x, 3.05 + 1.2 - 1.2, t.z]], hit = [tg]; let cur = tg;
          for (let i = 0; i < st.chain; i++) { let nx = null, nd = 7; for (const a of this.aliens) if (!a.dead && !a.hidden && !hit.includes(a)) { const d = Math.hypot(a.x - cur.x, a.z - cur.z); if (d < nd) { nd = d; nx = a; } } if (!nx) break; hit.push(nx); cur = nx; }
          for (const a of hit) { pts.push([+a.x.toFixed(1), +(a.y + ALIENS[a.type].h * 0.6).toFixed(1), +a.z.toFixed(1)]); a.stun = Math.max(a.stun, ALIENS[a.type].boss ? 0.05 : 0.35); this.hurtAlien(a, st.dmg, t.owner, true); }
          pts[0][1] = t.y + 4.25; this.emit({ k: 'zap', p: pts });
        } else if (t.kind === 'missile') {
          const d = Math.hypot(tg.x - t.x, tg.z - t.z), dur = 0.25 + d / 32; this.shells.push({ tg: tg.id, x: tg.x, y: tg.y, z: tg.z, t: dur, d: st.dmg, r: st.splash, owner: t.owner });
          this.emit({ k: 'msl', a: [t.x, t.y + 2.9, t.z], tg: tg.id, b: [tg.x, tg.y, tg.z], t: dur });
        }
      } else if (t.kind === 'resupply') {
        t.tick = (t.tick || 0) + dt; if (t.tick < 1) continue; t.tick = 0; const f = [0.05, 0.08, 0.12][t.lvl - 1], hl = [2, 3.5, 5][t.lvl - 1];
        for (const p of living) if (Math.hypot(p.x - t.x, p.z - t.z) < st.range + 1) { p.hp = Math.min(p.mhp, p.hp + hl); this.emit({ k: 'resup', to: p.id, f }); p.rsT = (p.rsT || 0) + 1; if (p.items < CLASSES[p.cls].throw.n && p.rsT >= [12, 9, 6][t.lvl - 1]) { p.rsT = 0; p.items++; } }
      } else if (t.kind === 'ammocache') {
        t.cdp = t.cdp || {}; for (const p of living) if (Math.hypot(p.x - t.x, p.z - t.z) < st.range + 0.5 && (t.cdp[p.id] || 0) < this.time) { t.cdp[p.id] = this.time + 20; this.emit({ k: 'ammo', to: p.id }); t.ch--; if (t.ch <= 0) { t.hp = 0; this.emit({ k: 'boom', x: t.x, y: t.y, z: t.z, r: 1, small: 1 }); break; } }
      } else if (t.kind === 'claymore') {
        const fx = -Math.sin(t.ry), fz = -Math.cos(t.ry); for (const a of this.aliens) { if (ALIENS[a.type].fly || ALIENS[a.type].static) continue; const dx = a.x - t.x, dz = a.z - t.z, d = Math.hypot(dx, dz); if (d < 5 && (dx * fx + dz * fz) / (d || 1) > 0.3) { this.splash(t.x - fx * -2, t.y + 0.6, t.z - fz * -2, 6, 420, t.owner); t.hp = 0; break; } }
      } else if (t.kind === 'medbay') {
        const h = st.heal * dt; for (const p of living) if (Math.hypot(p.x - t.x, p.z - t.z) < st.range && p.hp < p.mhp) p.hp = Math.min(p.mhp, p.hp + h);
        for (const m of this.allies) if (Math.hypot(m.x - t.x, m.z - t.z) < st.range) m.hp = Math.min(m.mhp, m.hp + h);
      } else if (t.kind === 'mortar') {
        let tg = null, bs = -1; const open = this.hiveOpen(); for (const a of this.aliens) { if (a.dead || a.hidden || (a.cave && !t.inCave) || (a.type === 'hivecore' && !open)) continue; const d = Math.hypot(a.x - t.x, a.z - t.z); if (d > 6 && d < st.range && a.s > bs) { bs = a.s; tg = a; } }
        if (!tg) continue; t.tg = tg.id; t.ry = Math.atan2(-(tg.x - t.x), -(tg.z - t.z)); if (t.cd > 0) continue; t.cd = 1 / st.rate;
        const d = Math.hypot(tg.x - t.x, tg.z - t.z), dur = 1 + d / 25, lead = tg.spd * dur * 0.7, n = this.path.at(tg.s + lead), px = n.x, pz = n.z;
        this.shells.push({ x: px, y: n.y, z: pz, t: dur, d: st.dmg, r: st.splash, owner: t.owner, pool: st.dmg * 0.5 });
        this.emit({ k: 'mortar', a: [t.x, t.y + 2, t.z], b: [+px.toFixed(1), +n.y.toFixed(1), +pz.toFixed(1)], t: +dur.toFixed(2) });
      }
    }
    this.updateAllies(dt);
    for (const m of this.tm) { m.t -= dt; if (m.t <= 0) { m.done = true; this.splash(m.x, m.y + 1, m.z, MISSILE.radius, MISSILE.dmg, m.owner); this.emit({ k: 'nuke', x: m.x, y: m.y, z: m.z }); } } if (this.tm.some(m => m.done)) this.tm = this.tm.filter(m => !m.done);
    for (const q of this.pools) { q.t -= dt; for (const a of this.aliens) if (!ALIENS[a.type].fly && Math.hypot(a.x - q.x, a.z - q.z) < q.r) this.hurtAlien(a, q.dps * dt, q.owner, true); } if (this.pools.some(q => q.t <= 0)) this.pools = this.pools.filter(q => q.t > 0);
    for (const c of this.spores) { c.life -= dt; c.k = Math.min(1, (c.age = (c.age || 0) + dt) / 15, Math.max(0, c.life) / 15); }
    if (this.spores.some(c => c.life <= 0)) this.spores = this.spores.filter(c => c.life > 0);
    for (const c of this.spores) { c.a += (Math.random() - 0.5) * dt * 0.8; c.x += Math.cos(c.a) * 2.2 * dt; c.z += Math.sin(c.a) * 2.2 * dt; if (Math.abs(c.x) > BOUNDS - 10) c.a = Math.PI - c.a; if (Math.abs(c.z) > BOUNDS - 10) c.a = -c.a; c.x = Math.max(-BOUNDS + 10, Math.min(BOUNDS - 10, c.x)); c.z = Math.max(-BOUNDS + 10, Math.min(BOUNDS - 10, c.z)); }
    for (const e of this.later) { e.t -= dt; if (e.t <= 0 && !e.done) { e.done = true; e.f(); } } if (this.later.some(e => e.done)) this.later = this.later.filter(e => !e.done);
    for (const d of this.drones) { d.t -= dt; d.a += dt * 0.9; d.cd -= dt; d.tg = 0; const fp = d.follow && this.players.get(d.follow); if (fp && !fp.dead) { d.x += (fp.x - d.x) * Math.min(1, dt * 2); d.z += (fp.z - d.z) * Math.min(1, dt * 2); d.y = fp.y; } const cx = d.x + Math.cos(d.a) * 8, cz = d.z + Math.sin(d.a) * 8; let tg = null, bd = 22; for (const a of this.aliens) { if (ALIENS[a.type].static) continue; const dd = Math.hypot(a.x - cx, a.z - cz); if (dd < bd) { bd = dd; tg = a; } } if (tg) { d.tg = tg.id; if (d.cd <= 0) { d.cd = 0.12; this.hurtAlien(tg, 9, d.owner, true); } } } if (this.drones.some(d => d.t <= 0)) this.drones = this.drones.filter(d => d.t > 0);
    for (const l of this.lasers) { l.t -= dt; for (const a of this.aliens) if (Math.hypot(a.x - l.x, a.z - l.z) < 6) this.hurtAlien(a, 340 * dt, l.owner, true); } if (this.lasers.some(l => l.t <= 0)) this.lasers = this.lasers.filter(l => l.t > 0);
    for (const m of this.medz) { m.t -= dt; for (const p of this.living()) if (Math.hypot(p.x - m.x, p.z - m.z) < m.r) p.hp = Math.min(p.mhp, p.hp + 25 * dt); for (const a of this.allies) if (Math.hypot(a.x - m.x, a.z - m.z) < m.r) a.hp = Math.min(a.mhp, a.hp + 25 * dt); } if (this.medz.some(m => m.t <= 0)) this.medz = this.medz.filter(m => m.t > 0);
    for (const d of this.domes) d.t -= dt; if (this.domes.some(d => d.t <= 0)) this.domes = this.domes.filter(d => d.t > 0);
    for (const c of this.ammo) c.life -= dt; if (this.ammo.some(c => c.life <= 0)) this.ammo = this.ammo.filter(c => c.life > 0);
    // missiles in the air follow their target and burst when they arrive
    for (const s of this.shells) { const a = this.aliens.find(q => q.id === s.tg); if (a) { s.x = a.x; s.y = a.y; s.z = a.z; } s.t -= dt; if (s.t <= 0) { s.done = true; this.splash(s.x, s.y + 0.6, s.z, s.r, s.d, s.owner); if (s.pool) this.pools.push({ x: s.x, y: s.y, z: s.z, r: s.r, t: 4, dps: s.pool, owner: s.owner }); } }
    if (this.shells.some(s => s.done)) this.shells = this.shells.filter(s => !s.done);
  }
  // The hive itself and its two Guardian towers. The hive is shielded until the final assault, and while a Guardian stands.
  // the Brood Queen in her cave at the start of the track, with her Royal Guards
  spawnHive(full, boost = 1) {
    if (!full) return; this.aliens = this.aliens.filter(a => !['hivecore', 'guardian', 'broodqueen', 'royal'].includes(a.type));
    const p0 = this.path.at(0), Cq = this.W.cave ? this.W.cave.q : p0, q = this.spawn('broodqueen', 0); q.x = Cq.x; q.z = Cq.z; q.y = this.W.top(q.x, q.z); q.cave = 1; q.mode = 'static'; q.ry = Math.atan2(-p0.tx, -p0.tz); q.hp = q.mhp = ALIENS.broodqueen.hp * boost * bossScale(this.players.size); q.qcd = 3;
    for (let i = 0; i < 4 + 2 * this.players.size; i++) this.spawnGuard(q, i);
  }
  spawnGuard(q, i) { const n = this.aliens.filter(a => a.type === 'royal').length, k = i ?? n, ang = k * 2.4, r = 6 + (k % 3) * 2.5, g = this.spawn('royal', 0); g.px = q.x + Math.cos(ang) * r; g.pz = q.z + Math.sin(ang) * r; g.x = q.x + Math.cos(ang) * 2; g.z = q.z + Math.sin(ang) * 2; g.y = this.W.ground(g.x, g.z, q.y + 2); g.mode = 'guard'; g.cave = 1; return g; }
  // inside the queen's cavern? (her guards and the queen can only be hurt from in there)
  inCave(x, z) { const C = this.W.cave; return !C || Math.hypot(x - C.x, z - C.z) < C.r + 1.5; }
  hiveOpen() { return this.phase !== 'lose' && this.phase !== 'win'; }
  // Reinforcements: the hub sends marines down the track toward the hive.
  updateAllies(dt) {
    const P = this.path, C = this.cmd;
    if (this.phase === 'wave' || this.phase === 'assault') { C.t -= dt; if (C.t <= 0) { C.t = DROP_EVERY[C.lv];
      // reinforcements come down on a dropship that lands on the track just outside the hub, unloads and takes off again
      const n = Math.min(SQUAD[C.sz], MAX_ALLIES - this.allies.length); if (n > 0) { const sL = P.len - 30, q = P.at(sL), ly = P.y(sL); this.emit({ k: 'dropship', a: [q.x - q.tz * 70, ly + 55, q.z + q.tx * 70], b: [+q.x.toFixed(1), +ly.toFixed(1), +q.z.toFixed(1)], t: 4.5, hold: 3 });
        this.later.push({ t: 4.9, f: () => { for (let i = 0; i < n && this.allies.length < MAX_ALLIES; i++) { const type = C.un[this.allyN++ % C.un.length], A = ALLIES[type], s = sL - i * 1.6, q2 = P.at(s), lat = (Math.random() - 0.5) * 3; this.allies.push({ id: this.nid++, type, s, lat, x: q2.x - q2.tz * lat, y: P.y(s), z: q2.z + q2.tx * lat, hp: A.hp, mhp: A.hp, ry: Math.atan2(q2.tx, q2.tz), cd: Math.random(), tg: 0 }); } } });
        if ((this.dropN = (this.dropN || 0) + 1) % 3 === 1) this.radio('cmd', [`Dropship touching down at the hub gate: ${n} veteran${n > 1 ? 's' : ''} joining the push.`, 'Fresh troops on the ground. Move up with them, marines.', 'Reinforcements landing outside the hub. Give them cover.'][this.dropN % 3]); } } }
    // the commander's airdrops: ammo on a marine every 2 minutes, field dressings every 2.5 (sooner with more marines)
    if (this.phase === 'wave') { const k = 1 + 0.3 * (this.players.size - 1), L = this.living(); this.cmdA = (this.cmdA ?? 120) - dt * k; this.cmdD = (this.cmdD ?? 150) - dt * k;
      if (L.length && this.cmdA <= 0) { this.cmdA = 120; const p = L[(this.cmdAi = (this.cmdAi || 0) + 1) % L.length]; this.airdrop(p, 'ammo'); }
      if (L.length && this.cmdD <= 0) { this.cmdD = 150; const p = L[(this.cmdDi = (this.cmdDi || 0) + 1) % L.length]; this.airdrop(p, 'dress'); } }
    const open = this.hiveOpen();
    for (const m of this.allies) {
      const A = ALLIES[m.type]; m.cd -= dt; m.tg = 0;
      if (A.heal) { for (const o of this.allies) if (o !== m && o.hp < o.mhp && Math.hypot(o.x - m.x, o.z - m.z) < 8) o.hp = Math.min(o.mhp, o.hp + A.heal * dt); for (const p of this.living()) if (p.hp < p.mhp && Math.hypot(p.x - m.x, p.z - m.z) < 8) p.hp = Math.min(p.mhp, p.hp + A.heal * 0.6 * dt); }
      let tg = null, bd = A.range; for (const a of this.aliens) { if (a.dead || a.hidden || (a.cave && !this.inCave(m.x, m.z)) || (a.type === 'hivecore' && !open)) continue; const d = Math.hypot(a.x - m.x, a.z - m.z); if (d < bd && Math.abs(a.y - m.y) < 9) { bd = d; tg = a; } }
      if (tg) { m.tg = tg.id; m.ry = Math.atan2(-(tg.x - m.x), -(tg.z - m.z)); if (m.cd <= 0) { m.cd = 1 / A.rate; if (A.splash) { const dur = 0.2 + bd / 30; this.shells.push({ tg: tg.id, x: tg.x, y: tg.y, z: tg.z, t: dur, d: A.dmg * TECH.k * 1.25, r: A.splash, owner: null }); this.emit({ k: 'msl', a: [m.x, m.y + 1.6, m.z], tg: tg.id, b: [tg.x, tg.y, tg.z], t: dur, rk: 1 }); } else this.hurtAlien(tg, A.dmg * TECH.k * 1.25, null); } continue; }
      if (m.s > 7) { m.s -= A.speed * dt; const q = P.at(m.s); m.x = q.x - q.tz * m.lat; m.z = q.z + q.tx * m.lat; m.y = q.y; m.ry = Math.atan2(q.tx, q.tz); }
      else { // the end of the track: push on through the cavern toward the queen until she is in range
        const Q = this.aliens.find(a => a.type === 'broodqueen' && !a.dead); if (Q) { const dx = Q.x - m.x, dz = Q.z - m.z, d = Math.hypot(dx, dz), want = Math.max(6, A.range * 0.7) + ALIENS.broodqueen.r; if (d > want) { const st = Math.min(d - want, A.speed * dt); m.x += dx / d * st + (m.lat || 0) * 0.02 * dz / d; m.z += dz / d * st - (m.lat || 0) * 0.02 * dx / d; m.y = this.W.ground(m.x, m.z, m.y + 1); m.ry = Math.atan2(-dx, -dz); } }
      }
    }
    if (this.allies.some(m => m.hp <= 0)) { for (const m of this.allies) if (m.hp <= 0) this.emit({ k: 'adie', x: m.x, y: m.y, z: m.z }); this.allies = this.allies.filter(m => m.hp > 0); }
  }
  hurtAlly(m, d) { m.hp -= d; }
  // a parachute crate from the commander, a few metres from the marine it is meant for
  airdrop(p, kind) {
    const a = Math.random() * 6.28, x = Math.max(-BOUNDS + 4, Math.min(BOUNDS - 4, p.x + Math.cos(a) * 3.5)), z = Math.max(-BOUNDS + 4, Math.min(BOUNDS - 4, p.z + Math.sin(a) * 3.5));
    this.pods.push({ id: this.nid++, x, z, land: 6, life: 6 + 75, sp: '', kind });
    this.radio('cmd', kind === 'ammo' ? [`${p.name}, ammo crate inbound on your position. Grab it.`, `Resupply dropping on ${p.name}. Keep those guns fed.`, `Olympus cleared an ammo drop: it's coming down next to ${p.name}.`][Math.random() * 3 | 0] : [`Med supplies inbound on ${p.name}: fresh field dressings.`, `${p.name}, dressings coming down beside you. Patch up and keep moving.`][Math.random() * 2 | 0], 1);
  }
  // radio chatter between the commander on the ground and General Hale on Station Olympus in orbit
  radio(who, m, force) { if (!force && this.time - (this.radioT || -99) < 7) return; this.radioT = this.time; this.emit({ k: 'radio', w: who, m }); }
  // the CPU commander: as the threat level rises it speeds up drops, grows the squads and brings in new kinds of veteran
  commander() {
    const C = this.cmd, w = this.wave, plan = { 3: 'rate', 4: 'gunner', 5: 'size', 6: 'rate', 7: 'medic', 8: 'rocketeer', 9: 'rate', 10: 'size', 12: 'rate', 14: 'size', 16: 'rate' }[w]; if (!plan) return; let msg = '';
    if (plan === 'rate' && C.lv < DROP_EVERY.length - 1) { C.lv++; msg = `reinforcements now every ${DROP_EVERY[C.lv]} s`; }
    else if (plan === 'size' && C.sz < SQUAD.length - 1) { C.sz++; msg = `${SQUAD[C.sz]} veterans per drop`; }
    else if (ALLIES[plan] && !C.un.includes(plan)) { C.un.push(plan); msg = `${ALLIES[plan].name}s join the reinforcements`; }
    if (msg) { this.radio('gen', ['Olympus here. I\'m releasing more of my people to you, Commander.', 'Station Olympus authorises more troops for the push.', 'You\'ll get what you need down there, Commander. Hale out.'][Math.random() * 3 | 0], 1); this.later.push({ t: 4, f: () => this.radio('cmd', `Copy, Olympus. Marines: ${msg}.`, 1) }); }
  }
  ability(p, id, r) {
    const near = (rad, f) => { for (const q of this.players.values()) if (!q.dead && Math.hypot(q.x - p.x, q.z - p.z) < rad) f(q); }, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const ahead = (rad, f) => { for (const a of this.aliens) { if (ALIENS[a.type].static) continue; const dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz); if (d < rad && (dx * fx + dz * fz) / (d || 1) > 0.5) f(a); } };
    const B = (q, k, t) => { q.buf[k] = Math.max(q.buf[k] || 0, t); };
    if (id === 'adrenaline') { p.adrT = 8; }
    else if (id === 'volley') { /* the grenades are thrown by the marine's own game */ }
    else if (id === 'rally') near(20, q => B(q, 'rally', 10));
    else if (id === 'airburst') B(p, 'airburst', 30);
    else if (id === 'overclock') { for (const t of this.turrets) if (Math.hypot(t.x - p.x, t.z - p.z) < 18) t.oc = 10; }
    else if (id === 'shieldwall') { const n = this.path.near(p.x, p.z); if (n.d < 25) { const s = n.s + 10, q = this.path.at(s); const T0 = TURRETS.barricade; this.turrets.push({ id: this.nid++, kind: 'barricade', owner: p.id, x: q.x, z: q.z, y: q.y, s, ry: Math.atan2(q.tx, q.tz), lvl: 3, hp: T0.hp * 2, mhp: T0.hp * 2, cd: 0, tg: 0, spent: 0, b: 0, bt: 0, life: 15 }); } }
    else if (id === 'emp') { for (const a of this.aliens) if (!ALIENS[a.type].static && Math.hypot(a.x - p.x, a.z - p.z) < 12) a.stun = Math.max(a.stun, ALIENS[a.type].boss ? 0.8 : 3); this.emit({ k: 'emp', x: p.x, y: p.y, z: p.z }); }
    else if (id === 'fixall') { for (const t of this.turrets) if (Math.hypot(t.x - p.x, t.z - p.z) < 15) t.hp = t.mhp; }
    else if (id === 'shockwave') { this.splash(p.x, p.y + 0.5, p.z, 9, 200, p.id); for (const a of this.aliens) { if (ALIENS[a.type].static) continue; const dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz); if (d < 9) { a.stun = Math.max(a.stun, ALIENS[a.type].boss ? 0.3 : 1.5); if (!ALIENS[a.type].boss) { a.x += dx / (d || 1) * 4; a.z += dz / (d || 1) * 4; } } } }
    else if (id === 'barrage') { const x = +r.x, z = +r.z; if (isFinite(x) && Math.hypot(x - p.x, z - p.z) < 90) for (let i = 0; i < 6; i++) { const ox = x + (Math.random() - 0.5) * 9, oz = z + (Math.random() - 0.5) * 9, y = this.W.top(ox, oz); this.later.push({ t: 0.5 + i * 0.25, f: () => this.splash(ox, y + 0.5, oz, 5, 130, p.id) }); } }
    else if (id === 'ironskin') B(p, 'iron', 8);
    else if (id === 'napalmround') B(p, 'napalm', 20);
    else if (id === 'ammo') this.ammo.push({ id: this.nid++, x: p.x - Math.sin(p.yaw) * 2, z: p.z - Math.cos(p.yaw) * 2, life: 40, cd: {} });
    else if (id === 'storm') B(p, 'storm', 6);
    else if (id === 'suppress') ahead(25, a => { a.slowT = 6; a.slowF = 0.5; });
    else if (id === 'fortify') B(p, 'fortify', 10);
    else if (id === 'overcharge') { }
    else if (id === 'cloak') B(p, 'cloak', 8);
    else if (id === 'recon') for (const a of this.aliens) a.rev = 10;
    else if (id === 'markall') ahead(35, a => { a.mark = 1.5; a.markT = 8; a.rev = 8; a.hidden = false; });
    else if (id === 'revive') { near(18, q => q.hp = Math.min(q.mhp, q.hp + 80)); for (const q of this.players.values()) if (q.dead && Math.hypot(q.x - p.x, q.z - p.z) < 18) { q.dead = false; q.rt = 0; q.hp = q.mhp * 0.6; q.rv++; this.emit({ k: 'toast', m: `${p.name} revived ${q.name}!` }); } for (const m of this.allies) if (Math.hypot(m.x - p.x, m.z - p.z) < 18) m.hp = Math.min(m.mhp, m.hp + 80); }
    else if (id === 'stimshot') near(10, q => { q.stimT = 10; });
    else if (id === 'healnade') { const x = +r.x, z = +r.z; if (isFinite(x) && Math.hypot(x - p.x, z - p.z) < 30) this.medz.push({ id: this.nid++, x, y: this.W.top(x, z), z, t: 10, r: 7 }); }
    else if (id === 'nano') near(15, q => B(q, 'nano', 8));
  }
  // specials aimed on the map
  callIn(sp, x, z, p) {
    const y = this.W.top(x, z), id = p.id, n = this.path.near(x, z);
    if (sp === 'dropship') { const q = this.path.at(n.s); this.emit({ k: 'dropship', a: [this.W.hubP.x, this.path.y(this.path.len) + 40, this.W.hubP.z], b: [+q.x.toFixed(1), +q.y.toFixed(1), +q.z.toFixed(1)], t: 5 }); this.later.push({ t: 5, f: () => { for (let i = 0; i < 6; i++) { const type = ['gunner', 'rocketeer', 'trooper', 'trooper', 'medic', 'gunner'][i], A = ALLIES[type]; this.allies.push({ id: this.nid++, type, s: n.s, lat: (Math.random() - 0.5) * 4, x: q.x + (Math.random() - 0.5) * 4, y: q.y, z: q.z + (Math.random() - 0.5) * 4, hp: A.hp * 1.5, mhp: A.hp * 1.5, ry: 0, cd: 0, tg: 0, vet: 1 }); } } }); }
    else if (sp === 'drone') for (let i = 0; i < 3; i++) this.drones.push({ id: this.nid++, x, z, y, t: 12, a: i * 2.09, cd: 0, tg: 0, owner: id });
    else if (sp === 'airstrike') { const s0 = n.s; this.emit({ k: 'bomber', a: [...Object.values(this.path.at(s0 - 30)).slice(0, 2)], b: [...Object.values(this.path.at(s0 + 30)).slice(0, 2)], y: y + 40, t: 2 }); for (let i = 0; i < 9; i++) { const q = this.path.at(s0 - 20 + i * 5); this.later.push({ t: 2 + i * 0.18, f: () => this.splash(q.x, q.y + 0.5, q.z, 6, 320, id) }); } }
    else if (sp === 'orbital') { this.lasers.push({ x, y, z, t: 6, owner: id }); this.emit({ k: 'orbital', x, y, z, t: 6 }); }
    else if (sp === 'napalm') { this.emit({ k: 'bomber', a: [x - 60, z - 20], b: [x + 60, z + 20], y: y + 35, t: 1.5 }); this.later.push({ t: 1.5, f: () => { this.splash(x, y + 1, z, 6, 150, id); this.pools.push({ x, y, z, r: 10, t: 8, dps: 70, owner: id, fire: 1 }); } }); }
    else if (sp === 'emp') { for (const a of this.aliens) if (!ALIENS[a.type].static && Math.hypot(a.x - x, a.z - z) < 25) { a.stun = Math.max(a.stun, ALIENS[a.type].boss ? 1.5 : 5); a.hidden = false; } this.emit({ k: 'emp', x, y, z }); }
    else if (sp === 'cryo') { for (const a of this.aliens) if (!ALIENS[a.type].static && Math.hypot(a.x - x, a.z - z) < 15) { a.stun = Math.max(a.stun, ALIENS[a.type].boss ? 1 : 3); a.slowT = 10; a.slowF = 0.25; } this.emit({ k: 'cryo', x, y, z }); }
    else if (sp === 'medkit') this.medz.push({ id: this.nid++, x, y, z, t: 30, r: 8 });
    else if (sp === 'ammodrop') this.ammo.push({ id: this.nid++, x, z, life: 45, cd: {} });
    else if (sp === 'sentrydrop') { let tx = x, tz = z; if (n.d < PATH_W / 2 + 2) { tx = n.x - n.tz * 7; tz = n.z + n.tx * 7; } const T0 = TURRETS.minigun, hp = T0.hp * 1.8; this.turrets.push({ id: this.nid++, kind: 'minigun', owner: id, x: tx, z: tz, y: this.W.top(tx, tz), ry: 0, lvl: 3, hp, mhp: hp, cd: 0, tg: 0, spent: 0, b: 0, bt: 0 }); this.emit({ k: 'boom', x: tx, y: this.W.top(tx, tz), z: tz, r: 2, small: 1 }); }
    else if (sp === 'dome') this.domes.push({ x, y, z, t: 12, r: 10 });
  }
  // Mars drops meteors; Kryos whips up blizzards. Both strike during waves.
  // Shelter from the blizzard: the hub walls, the cave, a tunnel, a heated hut, or near a turret that gives off heat
  sheltered(p, inHub) {
    if (inHub) return true; const W = this.W, T = W.T; if ((W.shelters || []).some(h => Math.hypot(h.x - p.x, h.z - p.z) < h.r)) return true;
    const n = this.path.near(p.x, p.z); if (n.d < PATH_W / 2 + 1 && T.tunnelAt(n.s)) return true;
    // under anything: a platform, a roof or an overhang above your head
    if (T.ground(p.x, p.z, p.y + 30) > p.y + 1.6 || T.ceiling(p.x, p.z, p.y + 0.5) < p.y + 12) return true;
    // behind something on the side the wind blows from: low cover works if you crouch or go prone, tall cover works standing
    const wa = this.windA || 0, ux = -Math.cos(wa), uz = -Math.sin(wa), hy = p.y + (p.kn === 2 ? 0.3 : p.kn === 1 ? 0.75 : 1.45);
    for (let d = 0.6; d <= 4; d += 0.45) { const x = p.x + ux * d, z = p.z + uz * d; if (T.solid(x, hy, z) || (T.block && T.block(x, hy, z))) return true; }
    const tall = { barricade: 1.6, ammocache: 1.0, mortar: 1.1, missile: 1.6, minigun: 1.5, railgun: 1.6, tesla: 2, pulse: 1.4 };
    if (this.turrets.some(t => { const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz); return d < 3.5 && d > 0.2 && (dx * ux + dz * uz) / d > 0.6 && t.y + (tall[t.kind] || 0) > hy; })) return true;
    return this.turrets.some(t => (t.kind === 'flamer' || t.kind === 'medbay' || t.kind === 'resupply') && Math.hypot(t.x - p.x, t.z - p.z) < 8);
  }
  // Map dangers come rarely, build up slowly, last a while and fade: Mars meteor showers, Kryos blizzards, jungle spore clouds.
  hazards(dt) {
    const hz = this.W.def.hazard;
    if (this.stormT > 0) { this.stormT -= dt; const e = 90 - this.stormT; this.stormI = Math.max(0, Math.min(1, e / 20, this.stormT / 25)); if (this.stormT <= 0) { this.stormI = 0; this.emit({ k: 'toast', m: 'The blizzard has passed.' }); } }
    for (const m of this.meteors || []) { m.t -= dt; if (m.t <= 0 && !m.done) { m.done = true; this.splash(m.x, m.y + 0.5, m.z, 4.5, 110, null); for (const p of this.living()) if (Math.hypot(p.x - m.x, p.z - m.z) < 4.5) this.hurtPlayer(p, 35, m); for (const t of this.turrets) if (Math.hypot(t.x - m.x, t.z - m.z) < 4) this.hurtTurret(t, 60); } }
    if (this.meteors) this.meteors = this.meteors.filter(m => !m.done);
    if (this.W.def.weather === 'rain') { this.boltT = (this.boltT ?? 12) - dt; if (this.boltT <= 0) { this.boltT = 14 + Math.random() * 22; this.emit({ k: 'bolt' }); } }
    this.hzT = (this.hzT ?? 300) - dt; if (this.hzT > 0) return; this.hzT = 300 + Math.random() * 120;
    if (hz === 'meteor') {
      this.meteors = this.meteors || []; this.emit({ k: 'toast', m: '☄ A meteor shower is starting. Stay clear of the red circles.', big: 1 });
      // sparse at first, heavy in the middle, then thinning out, over about 50 seconds
      const nm = Math.round(14 * countScale(this.players.size)); for (let i = 0; i < nm; i++) { const u = (i + Math.random() * 0.6) / nm, tm = 4 + 46 * (0.5 - Math.asin(1 - 2 * u) / Math.PI), x = (Math.random() * 2 - 1) * (BOUNDS - 8), z = (Math.random() * 2 - 1) * (BOUNDS - 8), y = this.W.top(x, z);
        this.meteors.push({ x, y, z, t: tm }); this.later.push({ t: Math.max(0, tm - 3), f: () => this.emit({ k: 'meteor', x: +x.toFixed(1), y: +y.toFixed(1), z: +z.toFixed(1), t: 3 }) }); }
    } else if (hz === 'blizzard') { this.stormT = 90; this.windA = Math.random() * 6.283; this.emit({ k: 'toast', m: '❄ A blizzard is rolling in. When it gets heavy, get under a roof or overhang, or crouch or go prone behind a rock, wall or barricade on the side the snow blows from (the hub, huts, the cave, tunnels and Flame Turrets work too).', big: 1 }); }
    else if (hz === 'nests') { for (let i = 0; i < 3; i++) this.spores.push({ x: (Math.random() - 0.5) * BOUNDS * 1.4, z: (Math.random() - 0.5) * BOUNDS * 1.4, a: Math.random() * 6.28, r: 9 + i * 2, life: 85, k: 0 }); this.emit({ k: 'toast', m: '☣ Toxic spore clouds are drifting in. Keep out of the green haze.', big: 1 }); }
  }
  face(a, dx, dz) { const want = Math.atan2(-dx, -dz); let dr = want - a.ry; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; a.ry += dr * 0.2; }

  // what friends receive, ten times a second
  pack() {
    const r1 = v => Math.round(v * 10) / 10;
    return {
      w: this.wave, ph: this.phase, tm: r1(this.timer), hub: r1(this.hub), en: this.endless ? 1 : 0, left: this.aliens.filter(a => !ALIENS[a.type].static).length, lt: Math.ceil(this.lvlT || 0), el: Math.floor(this.el || 0), n: this.players.size, wx: +(this.stormI || 0).toFixed(2), wa: +(this.windA || 0).toFixed(2),
      A: this.aliens.map(a => [a.id, a.type, r1(a.x), r1(a.y), r1(a.z), Math.round(a.hp), Math.round(a.mhp), +a.ry.toFixed(2), a.stun > 0 ? 1 : 0, a.mode === 'hunt' ? (a.tk === 'p' ? a.tid : 't') : 0, a.rev > 0 || a.markT > 0 ? 1 : 0]),
      T: this.turrets.map(t => [t.id, t.kind, t.owner, r1(t.x), r1(t.z), +t.ry.toFixed(2), t.lvl, Math.round(t.hp), Math.round(t.mhp), t.tg, r1(t.y), r1(t.b || 0), t.bt || 0, t.fresh ? 1 : 0, t.ch || 0, t.carry || 0, t.next ? +(t.up || 0).toFixed(2) : 0]),
      P: [...this.players.values()].map(p => [p.id, p.name, p.cls, r1(p.x), r1(p.y), r1(p.z), +p.yaw.toFixed(2), Math.round(p.hp), p.mhp, Math.floor(p.gold), p.ups, p.dead ? 1 : 0, p.kills, p.sp, Math.ceil(p.rt), p.kn || 0, p.special || '', p.acd.map(Math.ceil), +p.adrT.toFixed(1), +p.stimT.toFixed(1), p.rv, p.cold ? 1 : 0, p.toxic > 0 ? 1 : 0, p.veh || 0, p.items, p.kits ?? KITS, Math.round(p.pw ?? 100), p.dr ?? DRESS, Math.floor(p.scrap || 0), Object.fromEntries(Object.entries(p.buf).filter(([, v]) => v > 0).map(([k, v]) => [k, +v.toFixed(1)]))]),
      I: this.items.map(it => [it.id, it.kind, r1(it.x), r1(it.z)]), SC: this.scrap.map(s => [s.id, r1(s.x), r1(s.z)]),
      M: this.ammo.map(c => [c.id, r1(c.x), r1(c.z), Math.ceil(c.life)]), Z: this.spores.map(c => [r1(c.x), r1(c.z), +(c.r * c.k).toFixed(1)]), K: this.pools.map(q => [r1(q.x), r1(q.y), r1(q.z), q.r, q.fire ? 1 : 0]), D: this.drones.map(d => [d.id, r1(d.x + Math.cos(d.a) * 8), r1(d.y + 7), r1(d.z + Math.sin(d.a) * 8), d.tg]), Q: this.medz.map(m => [m.id, r1(m.x), r1(m.y), r1(m.z), m.r, Math.ceil(m.t)]), S2: this.domes.map(d => [r1(d.x), r1(d.y), r1(d.z), d.r]),
      O: this.pods.map(p => [p.id, r1(p.x), r1(p.z), Math.ceil(Math.max(0, p.life)), r1(Math.max(0, p.land)), p.kind === 'ammo' ? 1 : p.kind === 'dress' ? 2 : 0]),
      L: this.allies.map(m => [m.id, m.type, r1(m.x), r1(m.y), r1(m.z), Math.round(m.hp), m.mhp, +m.ry.toFixed(2), m.tg]), C: { lv: this.cmd.lv, sz: this.cmd.sz, un: this.cmd.un, t: Math.ceil(this.cmd.t) }, open: this.hiveOpen() ? 1 : 0,
    };
  }
}
