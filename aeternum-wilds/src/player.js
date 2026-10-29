import * as THREE from 'three';
import { G } from './state.js';
import { WEAPONS, ABILITIES, MATS, NODES } from './data.js';
import { makeHumanoid, dressHumanoid, makeWeapon, box, mat } from './models.js';
import { animHumanoid } from './anim.js';
import { heightAt, walkable, collide, zoneAt } from './world.js';
import { telegraph, burst, shockRing, shake, later } from './fx.js';
import { stats, activeWeapon, activeWType, gainXp, gainMastery, gainTrade } from './stats.js';
import { weaponDmg, addMat, matCount } from './items.js';
import { floatText, toast, showDeath, castBar, refreshHud } from './ui.js';
import { sfx } from './audio.js';
import { enemiesNear, killEnemy, stunEnemy, knockEnemy, interruptEnemy } from './enemies.js';
import { questEvent } from './quests.js';
import { clamp, angDiff, rand, randi } from './util.js';

export const TOWN_SPAWN = { x: 0, z: 16 };
const HOLD_HEAVY = 0.28;
const PLAYER_R = 0.45;

export function createPlayer() {
  const h = makeHumanoid({ skin: 0xe2b48c, shirt: 0x7a6a52, pants: 0x4a3e30, hair: 0x5a3a1e });
  G.scene.add(h.root);
  const pos = G.p.pos ? { x: G.p.pos[0], z: G.p.pos[1] } : { ...TOWN_SPAWN };
  G.player = {
    h, pos, y: heightAt(pos.x, pos.z), facing: Math.PI, phase: 0, move: 0,
    hp: 1, stam: 100, stamDelay: 0, exhausted: 0,
    state: 'idle', atk: null, combo: 0, comboTimer: 0,
    press: null, draw: 0, dodge: null, iframes: 0, blocking: false,
    cds: {}, buffs: [], poison: null, slowUntil: 0, stunUntil: 0,
    inCombat: 0, potionCd: 0, recallCd: 0, gather: null, ability: null, swapT: 0,
  };
  G.statsDirty = true;
  G.player.hp = stats().maxHp;
  refreshLook();
}

const tierColor = (it, cols, none) => it ? cols[it.tier - 1] : none;
export function refreshLook() {
  const P = G.player, e = G.p.equip, h = P.h;
  dressHumanoid(h, {
    chest: tierColor(e.chest, [0x6a4a2a, 0x8aa2b8, 0xc89a48], 0x7a6a52),
    legs: tierColor(e.legs, [0x4a3420, 0x5a6a7a, 0x8a6a30], 0x4a3e30),
    feet: tierColor(e.feet, [0x3a2a1a, 0x4a5462, 0x6a5020], 0x2a2018),
    helm: e.head ? [0x6a4a2a, 0x9aaabb, 0xd8a848][e.head.tier - 1] : null,
    helmTier: e.head?.tier || 0,
  });
  h.mats[0].color.setHex(e.hands ? [0x5a3a22, 0x8a9aaa, 0xc89a48][e.hands.tier - 1] : 0xe2b48c);
  // weapons
  for (const k of ['wR', 'wL', 'wBack']) if (P[k]) { P[k].parent?.remove(P[k]); P[k] = null; }
  const w = activeWeapon(), other = G.p.activeW === 0 ? e.w2 : e.w1;
  if (w) {
    if (w.wtype === 'bow') { P.wL = makeWeapon('bow', w.tier); h.parts.handL.add(P.wL); }
    else {
      P.wR = makeWeapon(w.wtype, w.tier); h.parts.handR.add(P.wR);
      if (w.wtype === 'sword') { P.wL = makeWeapon('shield', w.tier); P.wL.position.set(0.12, 0.05, 0.15); P.wL.rotation.y = Math.PI / 2; h.parts.handL.add(P.wL); }
    }
  }
  if (other) {
    P.wBack = makeWeapon(other.wtype === 'sword' ? 'sword' : other.wtype, other.tier);
    P.wBack.rotation.set(0, 0, 0.7); P.wBack.position.set(0, 0.0, -0.25);
    if (other.wtype === 'bow') P.wBack.rotation.set(0, Math.PI / 2, 0.3);
    h.parts.upper.add(P.wBack);
  }
  G.statsDirty = true;
}

// ---------- Damage dealt ----------
export function playerDamage(mult, kind, e, extra = 1) {
  const s = stats(), P = G.player, m = s.mods;
  const w = activeWeapon();
  let d = (w ? weaponDmg(w) : 8) * mult * s.attrMult * extra;
  if (kind === 'light') d *= 1 + (m.lightDmg || 0);
  if (kind === 'heavy') d *= 1 + (m.heavyDmg || 0) + s.heavy;
  if (kind === 'ability') d *= s.abilityMult;
  for (const b of P.buffs) if (b.mods.dmg) d *= 1 + b.mods.dmg;
  const hpf = P.hp / s.maxHp;
  if (hpf > 0.7) d *= 1 + (m.highHpDmg || 0);
  if (hpf < 0.5) d *= 1 + (m.lowHpDmg || 0);
  if (e.hp / e.maxHp < 0.3) d *= 1 + (m.execDmg || 0);
  if (e.stunned > 0) d *= 1 + (m.stunnedDmg || 0);
  if (e.def.family === 'corrupted') d *= 1 + s.corrupt;
  if (e.def.family === 'beast') d *= 1 + s.beast;
  if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > 12) d *= 1 + (m.farDmg || 0);
  d *= rand(0.92, 1.08);
  let crit = false;
  if (Math.random() * 100 < s.crit) { crit = true; d *= 1.5 + s.critDmg; }
  return { d: Math.max(1, Math.round(d)), crit };
}

// opts: stagger, stun, knock, slow, dot:{dmg,dur}, heal(frac of dmg)
export function hitEnemy(e, mult, kind, opts = {}) {
  if (e.dead) return 0;
  const { d, crit } = playerDamage(mult, kind, e, opts.extra || 1);
  e.hp -= d;
  e.hitFlash = 0.12;
  e.aggro = true; e.lastHit = G.time;
  G.player.inCombat = 6;
  floatText({ x: e.pos.x, z: e.pos.z, y: e.y + 1.6 * e.size }, crit ? `${d}!` : `${d}`, crit ? 'crit' : 'dmg');
  burst(e.pos.x, e.y + 1 * e.size, e.pos.z, e.def.family === 'corrupted' ? 0xff3020 : e.def.family === 'lost' ? 0x9fd0c0 : 0xb02020, crit ? 10 : 6, 4, 0.4);
  sfx(crit ? 'crit' : 'hit', 0.8);
  const s = stats();
  if (s.lifesteal) healPlayer(d * s.lifesteal / 100, true);
  if (opts.heal) healPlayer(d * opts.heal);
  gainMastery(activeWType(), 2);
  if (opts.stun) stunEnemy(e, opts.stun * (1 + (s.mods.stunDur || 0)));
  else if (opts.stagger && !e.def.boss) interruptEnemy(e, 0.35);
  if (opts.knock) { const dx = e.pos.x - G.player.pos.x, dz = e.pos.z - G.player.pos.z, l = Math.hypot(dx, dz) || 1; knockEnemy(e, dx / l, dz / l, opts.knock); }
  if (opts.slow) e.slowUntil = G.time + opts.slow;
  if (opts.dot) { const td = playerDamage(opts.dot, 'ability', e).d; e.dot = { dps: td / opts.dotDur, until: G.time + opts.dotDur, tick: 0 }; }
  if (e.hp <= 0) {
    killEnemy(e);
    const kh = s.mods.killHeal || 0;
    if (kh) healPlayer(s.maxHp * kh);
  }
  return d;
}

export function healPlayer(n, quiet) {
  const P = G.player, mx = stats().maxHp;
  if (P.state === 'dead') return;
  const before = P.hp;
  P.hp = Math.min(mx, P.hp + n);
  if (!quiet && P.hp - before >= 1) floatText({ x: P.pos.x, z: P.pos.z, y: P.y + 2.2 }, `+${Math.round(P.hp - before)}`, 'heal');
}

// ---------- Damage taken ----------
export function hurtPlayer(raw, src, opts = {}) {
  const P = G.player;
  if (P.state === 'dead') return;
  if (P.iframes > 0) { floatText({ x: P.pos.x, z: P.pos.z, y: P.y + 2.2 }, 'Dodged', 'info'); return; }
  const s = stats();
  let dmg = raw;
  const w = activeWeapon();
  P.inCombat = 6;
  if (P.blocking && w && WEAPONS[w.wtype].block > 0 && !opts.unblockable && src) {
    const a = Math.atan2(src.x - P.pos.x, src.z - P.pos.z);
    if (Math.abs(angDiff(P.facing, a)) < 1.25) {
      const W = WEAPONS[w.wtype];
      const cost = Math.max(6, raw * W.blockCost * 0.6 * (1 + (s.mods.blockCost || 0)));
      if (P.stam >= cost && P.exhausted <= 0) {
        P.stam -= cost; P.stamDelay = 0.8;
        dmg *= 1 - W.block;
        sfx('block');
        burst(P.pos.x + Math.sin(P.facing) * 0.8, P.y + 1.3, P.pos.z + Math.cos(P.facing) * 0.8, 0xffe0a0, 6, 3, 0.3);
        if (dmg < 1) { floatText({ x: P.pos.x, z: P.pos.z, y: P.y + 2.2 }, 'Blocked', 'info'); return; }
      } else {
        P.stam = 0; P.exhausted = 1.6; P.blocking = false;
        P.stunUntil = G.time + 0.7;
        floatText({ x: P.pos.x, z: P.pos.z, y: P.y + 2.2 }, 'Guard broken!', 'warn');
      }
    }
  }
  const lv = src?.lv || 1;
  dmg *= 1 - s.armor / (s.armor + 100 + lv * 12);
  let dr = s.mods.dr || 0;
  for (const b of P.buffs) dr += b.mods.dr || 0;
  dmg *= 1 - Math.min(0.75, dr);
  dmg = Math.max(1, Math.round(dmg));
  P.hp -= dmg;
  P.hurtFlash = 0.15;
  floatText({ x: P.pos.x, z: P.pos.z, y: P.y + 2.2 }, `-${dmg}`, 'hurt');
  sfx('hurt', 0.7);
  shake(Math.min(0.6, 0.15 + dmg / s.maxHp * 2));
  if (opts.poison) P.poison = { dps: raw * 0.12, until: G.time + opts.poison };
  if (opts.slow) P.slowUntil = G.time + opts.slow;
  if (P.gather) cancelGather('Interrupted');
  if (P.recall) { P.recall = null; castBar(null); toast('Recall interrupted'); }
  if (P.hp <= 0) die();
}

function die() {
  const P = G.player;
  P.hp = 0; P.state = 'dead'; P.deadT = 0;
  P.buffs = []; P.poison = null;
  G.p.stats.deaths++;
  sfx('death');
  showDeath();
}

export function respawn() {
  const P = G.player;
  P.pos.x = TOWN_SPAWN.x; P.pos.z = TOWN_SPAWN.z;
  P.state = 'idle'; P.hp = stats().maxHp; P.stam = 100; P.atk = null; P.ability = null;
  P.iframes = 1.5; P.inCombat = 0;
  for (const e of G.enemies) { e.aggro = false; if (e.def.boss) e.hp = e.maxHp; }
}

// ---------- Projectiles ----------
const arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.9);
export function spawnProj(o) {
  let mesh;
  if (o.color && o.owner === 'enemy') mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: o.color }));
  else { mesh = new THREE.Mesh(arrowGeo, mat(o.owner === 'player' ? (o.poison ? 0x6adf3a : o.pierce ? 0xffe070 : 0xe8dcc0) : 0x5a4a3a)); }
  mesh.position.set(o.x, o.y, o.z);
  mesh.rotation.y = Math.atan2(o.dx, o.dz);
  G.scene.add(mesh);
  G.projectiles.push({ ...o, mesh, life: (o.range || 30) / o.speed, hit: new Set() });
}

export function updateProjectiles(dt) {
  const P = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    pr.life -= dt;
    pr.x += pr.dx * pr.speed * dt; pr.z += pr.dz * pr.speed * dt;
    const gy = heightAt(pr.x, pr.z) + 1.1;
    pr.y += (Math.max(pr.y0 ?? gy, gy) - pr.y) * Math.min(1, dt * 6);
    pr.mesh.position.set(pr.x, pr.y, pr.z);
    let dead = pr.life <= 0 || collide(pr.x, pr.z, 0.05)[0] !== pr.x;
    if (!dead && pr.owner === 'player') {
      for (const e of enemiesNear(pr.x, pr.z, 3)) {
        if (e.dead || pr.hit.has(e)) continue;
        if (Math.hypot(e.pos.x - pr.x, e.pos.z - pr.z) < e.radius + 0.35) {
          pr.hit.add(e);
          hitEnemy(e, pr.mult, pr.kind, pr.opts || {});
          if (!pr.pierce) { dead = true; break; }
        }
      }
    } else if (!dead && pr.owner === 'enemy' && P.state !== 'dead') {
      if (Math.hypot(P.pos.x - pr.x, P.pos.z - pr.z) < 0.75) {
        hurtPlayer(pr.dmg, { x: pr.x - pr.dx, z: pr.z - pr.dz, lv: pr.lv }, { poison: pr.poison });
        if (P.iframes <= 0) dead = true;
      }
    }
    if (dead) {
      G.scene.remove(pr.mesh);
      if (pr.mesh.geometry !== arrowGeo) { pr.mesh.geometry.dispose(); pr.mesh.material.dispose(); }
      G.projectiles.splice(i, 1);
    }
  }
}

// ---------- Actions ----------
const aimDir = () => { const P = G.player; const dx = G.input.aimX - P.pos.x, dz = G.input.aimZ - P.pos.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l, l]; };
const busy = () => { const s = G.player.state; return s === 'dodge' || s === 'ability' || s === 'dead' || s === 'stunned'; };
function atkSpeed() { let a = 1 + (stats().mods.atkSpeed || 0); for (const b of G.player.buffs) a += b.mods.atkSpeed || 0; return a; }

function startAttack(kind) {
  const P = G.player, w = activeWeapon();
  const wt = w ? w.wtype : 'fist';
  const W = WEAPONS[wt] || { light: { time: 0.4, hit: 0.5, range: 2, arc: 90, mult: 1, combo: 2 }, heavy: { time: 0.6, hit: 0.5, range: 2.2, arc: 90, mult: 1.6, kind: 'thrust' } };
  const spec = kind === 'light' ? W.light : W.heavy;
  let pose = 'slash', mult = spec.mult;
  if (kind === 'light') {
    if (P.comboTimer <= 0) P.combo = 0;
    pose = P.combo % 2 === 0 ? 'slash' : 'slash2';
    if (wt === 'hammer') pose = P.combo % 2 === 0 ? 'slash' : 'overhead';
    if (wt === 'sword' && P.combo === 2) { pose = 'thrust'; mult *= 1.25; }
    P.combo = (P.combo + 1) % spec.combo;
  } else pose = spec.kind === 'spin' ? 'spin' : spec.kind === 'slam' ? 'slam' : 'thrust';
  const dur = spec.time / atkSpeed();
  P.state = 'attack';
  P.atk = { kind, spec, pose, mult, t: 0, dur, hitDone: false, wt };
  sfx(kind === 'heavy' ? 'heavy' : 'swing');
}

function meleeHit(a) {
  const P = G.player, sp = a.spec;
  let n = 0;
  if (sp.kind === 'slam') {
    const cx = P.pos.x + Math.sin(P.facing) * sp.fwd, cz = P.pos.z + Math.cos(P.facing) * sp.fwd;
    shockRing(cx, cz, sp.radius, 0xffe0a0, 0.35); shake(0.25);
    burst(cx, P.y + 0.3, cz, 0x8a7a60, 12, 5, 0.5);
    for (const e of enemiesNear(cx, cz, sp.radius + 2)) if (!e.dead && Math.hypot(e.pos.x - cx, e.pos.z - cz) < sp.radius + e.radius) { hitEnemy(e, a.mult, a.kind, { stun: sp.stun }); n++; }
    return n;
  }
  for (const e of enemiesNear(P.pos.x, P.pos.z, sp.range + 3)) {
    if (e.dead) continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > sp.range + e.radius) continue;
    if (sp.arc < 360 && Math.abs(angDiff(P.facing, Math.atan2(dx, dz))) > sp.arc / 2 * Math.PI / 180 + 0.15) continue;
    hitEnemy(e, a.mult, a.kind, { stagger: a.kind === 'heavy' && sp.stagger });
    n++;
  }
  if (n) shake(a.kind === 'heavy' ? 0.2 : 0.08);
  return n;
}

function fireArrow(power) {
  const P = G.player, s = stats();
  const [dx, dz] = aimDir();
  const W = WEAPONS.bow;
  let mult = 0.3 + power * 0.7;
  if (power >= 0.99) mult *= 1 + (s.mods.fullDraw || 0);
  spawnProj({ owner: 'player', x: P.pos.x + dx * 0.6, z: P.pos.z + dz * 0.6, y: P.y + 1.4, dx, dz, speed: W.speed * (0.7 + power * 0.3), range: W.range, mult, kind: power >= 0.99 ? 'heavy' : 'light' });
  sfx('bow');
}

export function startDodge() {
  const P = G.player, s = stats();
  if (P.state === 'ability' || P.state === 'dodge' || P.state === 'dead' || P.state === 'stunned') return;
  if (P.gather) cancelGather();
  if (P.recall) { P.recall = null; castBar(null); }
  const cost = 25 * (1 + (s.mods.dodgeCost || 0));
  if (P.stam < cost || P.exhausted > 0) { if (P.exhausted > 0) floatText({ x: P.pos.x, z: P.pos.z, y: P.y + 2.2 }, 'Exhausted', 'warn'); return; }
  const k = G.input.keys;
  let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
  if (!mx && !mz) { mx = -Math.sin(P.facing); mz = -Math.cos(P.facing); }
  const l = Math.hypot(mx, mz);
  P.stam -= cost; P.stamDelay = 0.7;
  if (P.stam <= 0) { P.stam = 0; P.exhausted = 1.6; }
  P.state = 'dodge'; P.atk = null; P.press = null; P.draw = 0;
  P.dodge = { t: 0, dur: 0.42, dx: mx / l, dz: mz / l, speed: 13.5 };
  P.iframes = 0.34;
  sfx('dodge');
}

export function useAbility(slot) {
  const P = G.player;
  if (busy() || P.state === 'gather') return;
  const wt = activeWType();
  if (!wt) return;
  const id = G.p.mastery[wt].slots[slot];
  if (!id) { toast('No ability in that slot. Unlock one in the Mastery tree (K).'); return; }
  const A = ABILITIES[id], s = stats();
  if ((P.cds[id] || 0) > G.time) return;
  P.cds[id] = G.time + A.cd * (1 - s.cdr);
  P.cdMax = P.cdMax || {}; P.cdMax[id] = A.cd * (1 - s.cdr);
  P.atk = null; P.press = null; P.draw = 0;
  const [dx, dz, dl] = aimDir();
  P.facing = Math.atan2(dx, dz);
  sfx('magic', 0.6);
  switch (A.kind) {
    case 'dash': {
      P.state = 'ability';
      P.ability = { id, A, t: 0, dur: 0.38, dx, dz, speed: A.dist / 0.38, hit: new Set(), pose: id === 'whirl' ? 'spin' : id === 'shieldRush' ? 'block' : 'thrust' };
      sfx('heavy');
      break;
    }
    case 'leap': {
      const d = Math.min(A.max, dl);
      P.state = 'ability';
      P.ability = { id, A, t: 0, dur: 0.55, dx, dz, speed: d / 0.55, leap: true, pose: 'overhead' };
      break;
    }
    case 'evade': {
      P.state = 'ability'; P.iframes = 0.35;
      P.ability = { id, A, t: 0, dur: 0.35, dx: -dx, dz: -dz, speed: A.dist / 0.35, pose: 'shoot' };
      spawnProj({ owner: 'player', x: P.pos.x, z: P.pos.z, y: P.y + 1.4, dx, dz, speed: 44, range: 32, mult: A.dmg, kind: 'ability' });
      sfx('bow');
      break;
    }
    case 'proj': {
      P.state = 'ability';
      P.ability = { id, A, t: 0, dur: 0.3, pose: 'shoot' };
      spawnProj({ owner: 'player', x: P.pos.x, z: P.pos.z, y: P.y + 1.4, dx, dz, speed: A.speed || 44, range: 36, mult: A.dmg, kind: 'ability', pierce: !!A.pierce, poison: !!A.dot, opts: A.dot ? { dot: A.dot, dotDur: A.dotDur } : {} });
      sfx('bow');
      break;
    }
    case 'aoe': {
      let cx = P.pos.x, cz = P.pos.z;
      if (A.at === 'cursor') { const d = Math.min(A.max, dl); cx += dx * d; cz += dz * d; }
      if (A.at === 'front') { cx += dx * A.fwd; cz += dz * A.fwd; }
      P.state = 'ability';
      P.ability = { id, A, t: 0, dur: Math.max(0.35, A.at === 'cursor' ? 0.35 : A.delay + 0.1), pose: A.at === 'cursor' ? 'cast' : 'slam' };
      telegraph({ shape: 'circle', x: cx, z: cz, r: A.radius, dur: A.delay, color: 0x4ab0ff });
      later(A.delay, () => {
        shockRing(cx, cz, A.radius, id === 'gravity' ? 0xa070ff : 0xffe0a0, 0.4);
        burst(cx, heightAt(cx, cz) + 0.4, cz, id === 'gravity' ? 0x8050ff : id === 'rain' ? 0xe8dcc0 : 0xaa9a80, 16, 6, 0.6);
        sfx(id === 'rain' ? 'bow' : 'boom', 0.7); shake(0.25);
        for (const e of enemiesNear(cx, cz, A.radius + 2)) {
          if (e.dead || Math.hypot(e.pos.x - cx, e.pos.z - cz) > A.radius + e.radius) continue;
          if (A.pull && !e.def.boss) { e.pos.x += (cx - e.pos.x) * 0.7; e.pos.z += (cz - e.pos.z) * 0.7; }
          hitEnemy(e, A.dmg, 'ability', { stun: A.stun, slow: A.slow });
        }
      });
      if (A.pull) later(0.1, () => { for (const e of enemiesNear(cx, cz, A.radius + 2)) if (!e.dead && !e.def.boss) e.slowUntil = G.time + 1; });
      break;
    }
    case 'cone': {
      P.state = 'ability';
      P.ability = { id, A, t: 0, dur: 0.45, pose: 'slash' };
      later(0.18, () => {
        burst(P.pos.x + dx * 3, P.y + 1, P.pos.z + dz * 3, 0x80ff80, 10, 4, 0.4);
        for (const e of enemiesNear(P.pos.x, P.pos.z, A.range + 2)) {
          if (e.dead) continue;
          const ex = e.pos.x - P.pos.x, ez = e.pos.z - P.pos.z, d = Math.hypot(ex, ez);
          if (d > A.range + e.radius || Math.abs(angDiff(P.facing, Math.atan2(ex, ez))) > A.arc / 2 * Math.PI / 180) continue;
          if (A.pullIn && !e.def.boss && d > 2) { e.pos.x = P.pos.x + ex / d * 1.8; e.pos.z = P.pos.z + ez / d * 1.8; }
          hitEnemy(e, A.dmg, 'ability', { heal: A.heal });
        }
      });
      break;
    }
    case 'line': {
      P.state = 'ability';
      P.ability = { id, A, t: 0, dur: 0.6, pose: 'slam' };
      telegraph({ shape: 'rect', x: P.pos.x, z: P.pos.z, width: A.width, len: A.range, angle: P.facing, dur: 0.3, color: 0x4ab0ff });
      const ox = P.pos.x, oz = P.pos.z, f = P.facing;
      later(0.3, () => {
        sfx('boom', 0.7); shake(0.3);
        for (let i = 1; i <= 5; i++) burst(ox + dx * i * 2, heightAt(ox + dx * i * 2, oz + dz * i * 2) + 0.3, oz + dz * i * 2, 0x9a8a70, 5, 4, 0.5);
        for (const e of enemiesNear(ox + dx * A.range / 2, oz + dz * A.range / 2, A.range)) {
          if (e.dead) continue;
          const ex = e.pos.x - ox, ez = e.pos.z - oz;
          const along = ex * Math.sin(f) + ez * Math.cos(f), side = Math.abs(ex * Math.cos(f) - ez * Math.sin(f));
          if (along < -0.5 || along > A.range || side > A.width / 2 + e.radius) continue;
          hitEnemy(e, A.dmg, 'ability', { knock: A.knock, stun: 0.6 });
        }
      });
      break;
    }
    case 'buff': {
      P.state = 'ability';
      P.ability = { id, A, t: 0, dur: 0.35, pose: 'cast' };
      P.buffs = P.buffs.filter(b => b.id !== id);
      P.buffs.push({ id, until: G.time + A.dur, mods: A.buff, icon: A.icon, name: A.name });
      if (A.heal) healPlayer(stats().maxHp * A.heal);
      if (A.cleanse) { P.poison = null; P.slowUntil = 0; }
      burst(P.pos.x, P.y + 1.2, P.pos.z, id === 'berserk' ? 0xff4020 : 0xffe080, 18, 4, 0.7);
      break;
    }
  }
}

function updateAbility(dt) {
  const P = G.player, ab = P.ability;
  ab.t += dt;
  const A = ab.A;
  if (ab.speed) {
    const nx = P.pos.x + ab.dx * ab.speed * dt, nz = P.pos.z + ab.dz * ab.speed * dt;
    if (walkable(nx, nz)) { const [cx, cz] = collide(nx, nz, PLAYER_R); P.pos.x = cx; P.pos.z = cz; }
  }
  if (A.kind === 'dash') {
    for (const e of enemiesNear(P.pos.x, P.pos.z, A.radius + 2)) {
      if (e.dead || ab.hit.has(e) || Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > A.radius + e.radius) continue;
      ab.hit.add(e);
      hitEnemy(e, A.dmg, 'ability', { stun: A.stun, knock: A.knock });
    }
  }
  if (ab.leap) P.jumpY = Math.sin(Math.min(1, ab.t / ab.dur) * Math.PI) * 3;
  if (ab.t >= ab.dur) {
    if (ab.leap) {
      P.jumpY = 0;
      shockRing(P.pos.x, P.pos.z, A.radius, 0xffe0a0, 0.4); shake(0.35); sfx('boom', 0.8);
      burst(P.pos.x, P.y + 0.3, P.pos.z, 0x9a8a70, 16, 6, 0.5);
      for (const e of enemiesNear(P.pos.x, P.pos.z, A.radius + 2)) if (!e.dead && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < A.radius + e.radius) hitEnemy(e, A.dmg, 'ability', { stagger: true });
    }
    P.state = 'idle'; P.ability = null;
  }
}

// ---------- Gathering / interacting ----------
export function startGather(target) {
  const P = G.player;
  if (busy() || P.state === 'attack') return;
  const s = stats();
  if (target.kind === 'node') {
    const def = target.def, lv = G.p.trade[def.skill].lv;
    if (lv < def.req) { toast(`Requires ${def.skill[0].toUpperCase() + def.skill.slice(1)} level ${def.req}`, 'warn'); return; }
    const time = def.time / (1 + lv * 0.015 + s.gather);
    P.gather = { target, t: 0, dur: time, skill: def.skill, pose: def.skill === 'harvesting' ? 'harvest' : 'gather' };
  } else if (target.kind === 'corpse') {
    P.gather = { target, t: 0, dur: 1.6 / (1 + G.p.trade.skinning.lv * 0.015 + s.gather), skill: 'skinning', pose: 'harvest' };
  }
  P.state = 'gather';
  P.facing = Math.atan2(target.x - P.pos.x, target.z - P.pos.z);
  castBar({ logging: 'Chopping', mining: 'Mining', harvesting: 'Harvesting', skinning: 'Skinning' }[P.gather.skill], 0);
}
export function cancelGather(msg) {
  const P = G.player;
  if (!P.gather) return;
  P.gather = null; if (P.state === 'gather') P.state = 'idle';
  castBar(null);
  if (msg) toast(msg);
}
function finishGather() {
  const P = G.player, g = P.gather, tg = g.target;
  P.gather = null; P.state = 'idle'; castBar(null);
  const got = [];
  if (tg.kind === 'node') {
    if (tg.depleted > 0) return;
    for (const [id, a, b] of tg.def.yields) { const n = randi(a, b) + (Math.random() < G.p.trade[g.skill].lv / 80 ? 1 : 0); if (n > 0) { addMat(id, n); got.push([id, n]); questEvent('gather', { id, n }); } }
    gainTrade(g.skill, tg.def.xp);
    gainXp(6 + tg.def.req * 2, true);
    tg.depleted = 80;
    tg.mesh.visible = false; if (tg.stump) tg.stump.visible = true; if (tg.col) tg.col.off = true;
    burst(tg.x, heightAt(tg.x, tg.z) + 1, tg.z, g.skill === 'mining' ? 0x8a8478 : g.skill === 'logging' ? 0x8a6a3a : 0x6ab04a, 14, 4, 0.6);
  } else {
    if (tg.skinned) return;
    tg.skinned = true;
    const lv = G.p.trade.skinning.lv;
    const hide = randi(1, 3), meat = randi(1, 2);
    addMat('rawhide', hide); got.push(['rawhide', hide]);
    addMat('raw_meat', meat); got.push(['raw_meat', meat]);
    if (tg.thick && lv >= 8) { const t = randi(1, 2); addMat('thick_hide', t); got.push(['thick_hide', t]); }
    if (tg.thick && lv < 8) toast('Skinning 8 needed to take Thick Hide', 'warn');
    for (const [id, n] of got) questEvent('gather', { id, n });
    gainTrade('skinning', 16 + (tg.thick ? 14 : 0));
    gainXp(5, true);
    tg.until = Math.min(tg.until, G.time + 1.5);
  }
  G.p.stats.gathered++;
  sfx('pickup');
  for (const [id, n] of got) toast(`+${n} ${MATS[id].icon} ${MATS[id].name}`, 'loot');
}

export function usePotion() {
  const P = G.player;
  if (P.state === 'dead') return;
  if (P.potionCd > 0) { toast(`Potion ready in ${Math.ceil(P.potionCd)}s`); return; }
  const id = matCount('big_potion') > 0 ? 'big_potion' : matCount('potion') > 0 ? 'potion' : null;
  if (!id) { toast('No health potions. Buy them from Ilsa or brew them at the Kitchen.', 'warn'); return; }
  G.p.mats[id]--; if (!G.p.mats[id]) delete G.p.mats[id];
  healPlayer(stats().maxHp * (MATS[id].strength || 0.4));
  P.potionCd = 12;
  sfx('potion');
  burst(P.pos.x, P.y + 1.4, P.pos.z, 0xff4060, 10, 2, 0.6, 0.12, -1);
}
export function eatFood() {
  const P = G.player;
  const id = ['feast', 'stew', 'cooked_meat'].find(f => matCount(f) > 0);
  if (!id) { toast('No food. Cook meat at the Kitchen or buy it from Ilsa.', 'warn'); return; }
  G.p.mats[id]--; if (!G.p.mats[id]) delete G.p.mats[id];
  G.p.food = { id, until: G.p.stats.playTime + MATS[id].dur };
  G.statsDirty = true;
  toast(`${MATS[id].icon} ${MATS[id].name}: ${MATS[id].desc.split('. Key')[0]}`, 'gold');
  sfx('potion');
}
export function startRecall() {
  const P = G.player;
  if (busy()) return;
  if (zoneAt(P.pos.x, P.pos.z) === 'town') { toast('You are already in town'); return; }
  if (P.recallCd > 0) { toast(`Recall ready in ${Math.ceil(P.recallCd)}s`); return; }
  P.recall = { t: 0, dur: 4 };
  castBar('Recalling to Windsward', 0);
}

// ---------- Per-frame ----------
export function updatePlayer(dt) {
  const P = G.player, inp = G.input, s = stats();
  const w = activeWeapon(), wt = w?.wtype;
  P.iframes -= dt; P.potionCd -= dt; P.recallCd -= dt; P.exhausted -= dt; P.comboTimer -= dt; P.inCombat -= dt;
  if (P.hurtFlash > 0) P.hurtFlash -= dt;
  P.buffs = P.buffs.filter(b => b.until > G.time);
  if (P.state === 'dead') { P.deadT = (P.deadT || 0) + dt; animHumanoid(P.h, { pose: 'dead', t: P.deadT }); placeModel(); return; }

  // regen and DoTs
  if (P.inCombat <= 0) P.hp = Math.min(s.maxHp, P.hp + s.maxHp * 0.03 * dt);
  P.hp = Math.min(s.maxHp, P.hp + s.regen * dt);
  if (P.poison) {
    if (P.poison.until < G.time) P.poison = null;
    else { P.hp -= P.poison.dps * dt; P.inCombat = 6; if (P.hp <= 0) { die(); return; } }
  }
  P.stamDelay -= dt;
  if (P.stamDelay <= 0 && !P.blocking) { let r = 28 * (1 + s.stamRegen); for (const b of P.buffs) r *= 1 + (b.mods.stamRegen || 0); P.stam = Math.min(100, P.stam + r * dt); }
  if (P.stunUntil > G.time) { P.state = 'stunned'; } else if (P.state === 'stunned') P.state = 'idle';

  // movement input
  const k = inp.keys;
  let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
  const ml = Math.hypot(mx, mz); if (ml) { mx /= ml; mz /= ml; }
  if (ml && P.gather) cancelGather();
  if (ml && P.recall) { P.recall = null; castBar(null); toast('Recall cancelled'); }

  // aim facing
  const [adx, adz] = aimDir();
  const aimF = Math.atan2(adx, adz);

  if (P.state === 'ability') updateAbility(dt);
  else if (P.state === 'dodge') {
    const d = P.dodge; d.t += dt;
    const sp = d.speed * (1 - d.t / d.dur * 0.6);
    const nx = P.pos.x + d.dx * sp * dt, nz = P.pos.z + d.dz * sp * dt;
    if (walkable(nx, nz)) { const [cx, cz] = collide(nx, nz, PLAYER_R); P.pos.x = cx; P.pos.z = cz; }
    P.facing = Math.atan2(d.dx, d.dz);
    if (d.t >= d.dur) { P.state = 'idle'; P.dodge = null; }
  } else if (P.state !== 'stunned') {
    // attacks
    P.blocking = inp.rmb && wt && wt !== 'bow' && P.state !== 'attack' && P.state !== 'gather' && P.exhausted <= 0;
    if (wt === 'bow') {
      if (inp.lmb && P.state !== 'gather' && !inp.overUI) {
        if (P.state !== 'draw') { P.state = 'draw'; P.draw = 0; }
        P.draw = Math.min(1, P.draw + dt / (WEAPONS.bow.draw / (1 + (s.mods.drawSpeed || 0)) / atkSpeed()));
      } else if (P.state === 'draw') {
        fireArrow(P.draw);
        P.state = 'attack'; P.atk = { pose: 'shoot', t: 0, dur: 0.22, hitDone: true, spec: {} };
        P.draw = 0;
      }
    } else if (P.state !== 'gather') {
      if (inp.lmb && !P.press && !inp.overUI) P.press = { t: 0, used: false };
      if (P.press) {
        P.press.t += dt;
        if (!inp.lmb) {
          if (!P.press.used) { if (P.state === 'attack') P.queued = 'light'; else startAttack('light'); }
          P.press = null;
        } else if (!P.press.used && P.press.t >= HOLD_HEAVY && P.state !== 'attack') { P.press.used = true; startAttack('heavy'); }
      }
    }
    if (P.state === 'attack') {
      const a = P.atk; a.t += dt;
      if (!a.hitDone && a.t >= a.dur * a.spec.hit) {
        a.hitDone = true;
        meleeHit(a);
        P.comboTimer = 1.0;
        if (a.spec.lunge) { const nx = P.pos.x + Math.sin(P.facing) * a.spec.lunge * 0.4, nz = P.pos.z + Math.cos(P.facing) * a.spec.lunge * 0.4; if (walkable(nx, nz)) [P.pos.x, P.pos.z] = collide(nx, nz, PLAYER_R); }
      }
      if (a.t >= a.dur) { P.state = 'idle'; P.atk = null; if (P.queued) { P.queued = null; startAttack('light'); } }
    }
    if (P.state === 'gather') {
      const g = P.gather; g.t += dt;
      castBar(null, g.t / g.dur);
      if (g.t >= g.dur) finishGather();
      else if (Math.floor(g.t / 0.45) !== Math.floor((g.t - dt) / 0.45)) sfx(g.skill === 'mining' ? 'mine' : g.skill === 'logging' ? 'chop' : 'harvest', 0.6);
    }
    if (P.recall) {
      P.recall.t += dt; castBar(null, P.recall.t / P.recall.dur);
      if (P.recall.t >= P.recall.dur) { P.recall = null; castBar(null); P.pos.x = TOWN_SPAWN.x; P.pos.z = TOWN_SPAWN.z; P.recallCd = 90; sfx('magic'); toast('Welcome back to Windsward Outpost'); }
    }
    // move
    let sp = 6.2 * (1 + s.moveSpeed);
    if (P.blocking) sp *= 0.5;
    if (P.state === 'draw') sp *= 0.55;
    if (P.state === 'attack' && P.atk?.wt && P.atk.wt !== 'bow') sp *= 0.3;
    if (P.slowUntil > G.time) sp *= 0.6;
    if (P.exhausted > 0) sp *= 0.75;
    if (P.state === 'gather') sp = 0;
    if (heightAt(P.pos.x, P.pos.z) < 0) sp *= 0.7;
    if (ml && sp > 0) {
      const nx = P.pos.x + mx * sp * dt, nz = P.pos.z + mz * sp * dt;
      if (walkable(nx, nz)) { const [cx, cz] = collide(nx, nz, PLAYER_R); P.pos.x = cx; P.pos.z = cz; }
      else if (walkable(nx, P.pos.z)) { const [cx, cz] = collide(nx, P.pos.z, PLAYER_R); P.pos.x = cx; P.pos.z = cz; }
      else if (walkable(P.pos.x, nz)) { const [cx, cz] = collide(P.pos.x, nz, PLAYER_R); P.pos.x = cx; P.pos.z = cz; }
      P.phase += dt * sp * 1.6;
    }
    P.move += ((ml && sp > 0 ? Math.min(1, sp / 6.2) : 0) - P.move) * Math.min(1, dt * 10);
    if (P.state !== 'gather') {
      const target = (P.state === 'attack' && P.atk?.hitDone && P.atk?.wt !== 'bow') ? P.facing : aimF;
      P.facing += angDiff(P.facing, target) * Math.min(1, dt * (P.state === 'attack' ? 8 : 18));
    }
  }
  // pose
  let pose = null, t = 0;
  if (P.state === 'attack') { pose = P.atk.pose; t = P.atk.t / P.atk.dur; }
  else if (P.state === 'draw') pose = 'draw';
  else if (P.state === 'dodge') { pose = 'dodge'; t = P.dodge.t / P.dodge.dur; }
  else if (P.state === 'ability') { pose = P.ability.pose; t = P.ability.t / P.ability.dur; if (pose === 'shoot' || pose === 'block') t = Math.min(1, t); }
  else if (P.state === 'gather') { pose = P.gather.pose; t = P.gather.t; }
  else if (P.state === 'stunned') pose = 'stun';
  else if (P.blocking) pose = 'block';
  else if (P.recall) pose = 'cast';
  else if (P.press && P.press.t > 0.12 && wt !== 'bow') { pose = 'windup'; t = P.press.t; }
  animHumanoid(P.h, { move: P.move, phase: P.phase, pose, t, twoHand: wt === 'greataxe' || wt === 'hammer', draw: P.draw });
  if (P.wL?.userData.string) P.wL.userData.string.position.z = -0.24 - (P.state === 'draw' ? P.draw * 0.35 : 0);
  placeModel();
  // flash
  const fl = P.hurtFlash > 0 ? 0x661010 : P.iframes > 0 && P.state === 'dodge' ? 0x202838 : 0;
  for (const m of P.h.mats) m.emissive.setHex(fl);
}

function placeModel() {
  const P = G.player;
  P.y = Math.max(heightAt(P.pos.x, P.pos.z), -0.5);
  P.h.root.position.set(P.pos.x, P.y + (P.jumpY || 0), P.pos.z);
  P.h.root.rotation.y = P.facing;
}

export function swapWeapon(i) {
  const P = G.player;
  if (busy() || G.p.activeW === i) return;
  const e = G.p.equip;
  if (!(i === 0 ? e.w1 : e.w2)) { toast('No weapon in that slot. Equip one from your inventory (I).'); return; }
  G.p.activeW = i;
  P.state = P.state === 'gather' ? 'gather' : 'idle'; P.atk = null; P.press = null; P.draw = 0; P.combo = 0;
  refreshLook();
  sfx('ui');
  refreshHud();
}
