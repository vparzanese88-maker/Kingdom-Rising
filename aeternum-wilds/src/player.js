import * as THREE from 'three';
import { G } from './state.js';
import { WEAPONS, ABILITIES, MATS, NODES, LOADS, RANGED_WEAPONS, SHIELD_WEAPONS } from './data.js';
import { CLASSES } from './classes.js';
import { meshyReady, makeHero } from './gfx/meshy.js';
import { heroRigReady, makeRiggedHero } from './gfx/herorig.js';
import { makeHumanoid, dressHumanoid, makeWeapon, box, mat, charHeight, sizeWeapon, TIER_LEN } from './models.js';
import { animHumanoid } from './anim.js';
import { heightAt, walkable, collide, zoneAt } from './world.js';
import { telegraph, burst, shockRing, shake, later, puff, spriteMat } from './fx.js';
import { stats, activeWeapon, activeWType, gainXp, gainMastery, gainTrade } from './stats.js';
import { weaponDmg, addMat, matCount } from './items.js';
import { floatText, selfText, toast, showDeath, castBar, refreshHud } from './ui.js';
import { sfx } from './audio.js';
import { enemiesNear, killEnemy, stunEnemy, knockEnemy, interruptEnemy } from './enemies.js';
import { questEvent } from './quests.js';
import { spellPower } from './skills.js';
import { swingFx, swingPeakFx, hitFx, blockFx, hurtFx, dodgeFx } from './combatfx.js';
import { clamp, angDiff, rand, randi } from './util.js';

export const TOWN_SPAWN = { x: 0, z: 16 };
const HOLD_HEAVY = 0.28;
const PLAYER_R = 0.45;

export function createPlayer() {
  const h = makeCharacter(G.p);
  G.scene.add(h.root);
  const pos = G.p.pos ? { x: G.p.pos[0], z: G.p.pos[1] } : { ...TOWN_SPAWN };
  G.player = {
    h, pos, y: heightAt(pos.x, pos.z), facing: Math.PI, yaw: G.p.yaw ?? Math.PI, pitch: -0.08, phase: 0, move: 0,
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

// Build a character model from a profile (race, look); also used by the character creator
export function makeCharacter(p) {
  const L = p.look || {};
  if (L.model === 'barbarian' && heroRigReady()) return makeRiggedHero({ height: L.height || 1, build: L.weight || 1, muscle: L.muscle || 1 });
  if (L.model === 'barbarian' && meshyReady()) return makeHero({ height: L.height || 1, build: L.weight || 1 });
  return makeHumanoid({
    sex: L.sex || 'm', skin: L.skin ?? 0xe0ac84, hair: L.hair ?? 0x5a3a1e, hairStyle: L.hairStyle ?? 0, eyeColor: L.eyeColor,
    facialHair: L.facialHair ?? (L.beard ? 4 : 0), paint: L.paint ?? null, scar: !!L.scar,
    shirt: 0x7a6a52, pants: 0x4a3e30, height: L.height || 1, build: L.weight || 1, muscle: L.muscle || 1,
    face: L,
  });
}

// clothes colour by armor weight and tier
const ARMOR_COLS = { light: [0x9a9270, 0x4a5a8a, 0x9a3a2a], medium: [0x6a4a2a, 0x5a4030, 0x3e4a32], heavy: [0x8a8a90, 0x8aa2b8, 0xc89a48] };
const tierColor = (it, k, none) => it ? new THREE.Color(ARMOR_COLS[it.wclass || 'medium'][it.tier - 1]).multiplyScalar(k).getHex() : none;
// put weapon w in the hands and the other weapon on the back; sizes follow the wearer's height and the tier
export function armCharacter(h, w, other) {
  for (const k of ['wR', 'wL', 'wBack']) if (h[k]) { h[k].parent?.remove(h[k]); h[k] = null; }
  const tall = charHeight(h);
  const SHORT = { sword: 0.85, spear: 1.05, club: 0.6, rapier: 0.62, dagger: 0.3, crossbow: 0.5, musket: 0.85, blunderbuss: 0.55 };
  const len = it => tall * (TIER_LEN[it.tier] || TIER_LEN[1]) * (SHORT[it.wtype] ?? 1);
  const shieldLen = it => tall * 0.36 * (0.92 + 0.08 * (it.tier || 1));
  if (w) {
    if (w.wtype === 'bow') { h.wL = sizeWeapon(makeWeapon('bow', w.tier, w.model), h.parts.handL, len(w)); h.parts.handL.add(h.wL); }
    else {
      h.wR = sizeWeapon(makeWeapon(w.wtype, w.tier, w.model), h.parts.handR, len(w)); h.parts.handR.add(h.wR);
      if (WEAPONS[w.wtype]?.dual) { h.wL = sizeWeapon(makeWeapon('dagger', w.tier), h.parts.handL, tall * 0.3 * (TIER_LEN[w.tier] || 1)); h.parts.handL.add(h.wL); }
      if (SHIELD_WEAPONS.has(w.wtype)) { h.wL = makeWeapon('shield', w.tier); h.wL.rotation.y = Math.PI / 2; sizeWeapon(h.wL, h.parts.handL, shieldLen(w)); h.wL.position.set(0.14, 0.05, 0.15); h.parts.handL.add(h.wL); }
    }
  }
  // the weapon not in use is slung diagonally across the back
  if (other) {
    const host = h.parts.back || h.parts.upper;
    const back = new THREE.Group();
    host.add(back);
    if (h.parts.back) back.position.set(0, 0, -0.16); else back.position.set(0, 0.5, -0.26);
    back.rotation.set(0, 0, other.wtype === 'bow' ? -0.5 : 0.75);
    const L = len(other);
    const bw = makeWeapon(other.wtype, other.tier, other.model);
    bw.rotation.set(0, 0, 0);
    sizeWeapon(bw, back, L);
    back.getWorldScale(_ws); const Lb = L / (_ws.y || 1); // weapon length in the back group's units
    if (other.wtype === 'bow') { bw.rotation.y = Math.PI / 2; bw.position.set(0, -0.2 * Lb, 0); }
    else if (other.wtype === 'sword' || other.wtype === 'rapier' || other.wtype === 'dagger') { bw.rotation.z = Math.PI; bw.position.set(0, 0.32 * Lb, 0); } // hilt up over the shoulder
    else if (WEAPONS[other.wtype]?.gun) { bw.rotation.z = Math.PI; bw.position.set(0, 0.25 * Lb, 0); } // stock down, barrel up
    else bw.position.set(0, -0.55 * Lb, 0); // axe, hammer or staff head up
    back.add(bw);
    if (SHIELD_WEAPONS.has(other.wtype)) { const sh = makeWeapon('shield', other.tier); sizeWeapon(sh, back, shieldLen(other)); sh.position.set(0, 0, -0.06); back.add(sh); }
    h.wBack = back;
  }
}
const _ws = new THREE.Vector3();
export function refreshLook() {
  const P = G.player, e = G.p.equip, h = P.h;
  dressHumanoid(h, {
    chest: tierColor(e.chest, 1, 0x7a6a52),
    legs: tierColor(e.legs, 0.75, 0x4a3e30),
    feet: tierColor(e.feet, 0.55, 0x2a2018),
    helm: e.head ? tierColor(e.head, 1) : null,
    helmTier: e.head ? ({ light: 1, medium: 1, heavy: 2 }[e.head.wclass || 'medium'] + (e.head.tier === 3 ? 1 : 0)) : 0,
    trim: e.hands ? tierColor(e.hands, 0.85) : (CLASSES[G.p.cls]?.color ?? 0x5a4a38),
  });
  // weapons
  const w = activeWeapon(), other = G.p.activeW === 0 ? e.w2 : e.w1;
  armCharacter(h, w, other);
  P.wR = h.wR; P.wL = h.wL; P.wBack = h.wBack;
  G.statsDirty = true;
}

// ---------- Damage dealt ----------
export function playerDamage(mult, kind, e, extra = 1, spell = false) {
  const s = stats(), P = G.player, m = s.mods;
  const w = activeWeapon();
  let d = spell ? spellPower() * mult * extra * (1 + (s.loadDmg || 0) * 0.5) : (w ? weaponDmg(w) : 8) * mult * s.attrMult * extra * (1 + (s.loadDmg || 0));
  d *= 1 + (m.dmg || 0);
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
  const { d, crit } = playerDamage(mult, kind, e, opts.extra || 1, !!opts.spell);
  if (e.mezzed) { e.mezzed = false; e.stunned = 0; }
  e.hp -= d;
  e.hitFlash = 0.12;
  e.aggro = true; e.lastHit = G.time;
  G.player.inCombat = 6;
  floatText({ x: e.pos.x, z: e.pos.z, y: e.y + 1.6 * e.size }, crit ? `${d}!` : `${d}`, crit ? 'crit' : 'dmg');
  hitFx(e, d, crit, kind, { x: G.player.pos.x, y: G.player.y + 1.3, z: G.player.pos.z }); // blood/bone/corruption, sound, hit-stop
  const s = stats();
  let ls = s.lifesteal; for (const b of G.player.buffs) ls += b.mods.lifesteal || 0;
  if (ls) healPlayer(d * ls / 100, true);
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
  if (!quiet && P.hp - before >= 1) selfText(`+${Math.round(P.hp - before)}`, 'heal');
}

// ---------- Damage taken ----------
export function hurtPlayer(raw, src, opts = {}) {
  const P = G.player;
  if (P.state === 'dead') return;
  if (P.iframes > 0) { selfText('Dodged', 'info'); return; }
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
        blockFx(P, src);
        if (dmg < 1) { selfText('Blocked', 'info'); return; }
      } else {
        P.stam = 0; P.exhausted = 1.6; P.blocking = false;
        P.stunUntil = G.time + 0.7;
        selfText('Guard broken!', 'warn');
      }
    }
  }
  const lv = src?.lv || 1;
  dmg *= 1 - s.armor / (s.armor + 100 + lv * 12);
  let dr = s.mods.dr || 0;
  for (const b of P.buffs) dr += b.mods.dr || 0;
  dmg *= 1 - Math.min(0.75, dr);
  dmg = Math.max(1, Math.round(dmg));
  if (P.shield) {
    const ab = Math.min(P.shield.amt, dmg);
    P.shield.amt -= ab; dmg -= ab;
    if (P.shield.amt <= 0) P.shield = null;
    if (dmg <= 0) { selfText('Absorbed', 'info'); return; }
  }
  P.hp -= dmg;
  P.hurtFlash = 0.15;
  selfText(`-${dmg}`, 'hurt');
  hurtFx(P, dmg, src);
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
// 3D: (dx, dy, dz) is a unit direction
const arrowGeo = new THREE.BoxGeometry(0.05, 0.05, 0.9);
const tip = new THREE.ConeGeometry(0.05, 0.16, 4); tip.rotateX(Math.PI / 2); tip.translate(0, 0, 0.5);
// gravity on everything that flies: arrows drop like real arrows, fire bolts arc, spells drift down slowly
export const ARROW_G = 9.8;
const isFire = c => { const col = new THREE.Color(c); return col.r > 0.75 && col.g < 0.75 && col.b < 0.35; };
let projLight = null;
function fireBolt(size) {
  const g = new THREE.Group();
  const core = new THREE.Sprite(spriteMat(0xfff2c0)); core.scale.setScalar(size * 2.4); g.add(core);
  const halo = new THREE.Sprite(spriteMat(0xff8a2a)); halo.scale.setScalar(size * 5); g.add(halo);
  g.userData.core = core; g.userData.halo = halo;
  return g;
}
export function spawnProj(o) {
  let mesh;
  const fire = o.fire ?? (o.element === 'fire' || (o.color != null && isFire(o.color)));
  if (fire) mesh = fireBolt(o.size || 0.25);
  else if (o.color) {
    mesh = new THREE.Group();
    const core = new THREE.Sprite(spriteMat(0xffffff)); core.scale.setScalar((o.size || 0.25) * 2); mesh.add(core);
    const halo = new THREE.Sprite(spriteMat(o.color)); halo.scale.setScalar((o.size || 0.25) * 4.5); mesh.add(halo);
    mesh.userData.halo = halo;
  } else {
    mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(arrowGeo, mat(o.owner === 'player' ? (o.poison ? 0x6adf3a : o.pierce ? 0xffe070 : 0xd8c8a0) : 0x5a4a3a)));
    mesh.add(new THREE.Mesh(tip, mat(0x8a8a90)));
    for (const sgn of [1, -1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.14), new THREE.MeshLambertMaterial({ color: 0xe8e0d0, side: THREE.DoubleSide })); f.position.set(0, 0, -0.4); f.rotation.set(0, sgn > 0 ? 0 : Math.PI / 2, 0); mesh.add(f); }
  }
  if (o.dy == null) o.dy = 0;
  const l = Math.hypot(o.dx, o.dy, o.dz) || 1; o.dx /= l; o.dy /= l; o.dz /= l;
  const g = o.grav ?? (o.color ? (fire ? 5 : 2.5) : ARROW_G);
  const v = { x: o.dx * o.speed, y: o.dy * o.speed, z: o.dz * o.speed };
  // enemies lead their shots for the drop so their arrows still find the player
  if (o.owner === 'enemy' && G.player) { const D = Math.hypot(G.player.pos.x - o.x, G.player.pos.z - o.z); v.y += 0.5 * g * (D / o.speed); }
  mesh.position.set(o.x, o.y, o.z);
  mesh.lookAt(o.x + v.x, o.y + v.y, o.z + v.z);
  G.scene.add(mesh);
  G.projectiles.push({ ...o, fire, g, v, mesh, life: (o.range || 30) / o.speed * 1.6, hit: new Set(), age: 0 });
}

export function updateProjectiles(dt) {
  const P = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    pr.life -= dt; pr.age += dt;
    pr.v.y -= pr.g * dt;
    pr.x += pr.v.x * dt; pr.y += pr.v.y * dt; pr.z += pr.v.z * dt;
    pr.dx = pr.v.x; pr.dz = pr.v.z;
    pr.mesh.position.set(pr.x, pr.y, pr.z);
    if (!pr.color) pr.mesh.lookAt(pr.x + pr.v.x, pr.y + pr.v.y, pr.z + pr.v.z); // arrows nose down as they fall
    if (pr.fire) {
      // living flame: flickering core, licks of fire peeling off behind it, a little smoke
      const s = pr.size || 0.25, u = pr.mesh.userData;
      u.core.scale.setScalar(s * (2.1 + Math.random() * 0.7));
      u.halo.scale.setScalar(s * (4.2 + Math.random() * 1.6));
      const back = 1 / (Math.hypot(pr.v.x, pr.v.y, pr.v.z) || 1);
      for (let k = 0; k < 3; k++) {
        const c = [0xffe080, 0xffa040, 0xff6a1a, 0xe0401a][Math.floor(Math.random() * 4)];
        puff(pr.x + (Math.random() - 0.5) * s, pr.y + (Math.random() - 0.5) * s, pr.z + (Math.random() - 0.5) * s, c,
          -pr.v.x * back * 1.5 + (Math.random() - 0.5), 0.8 + Math.random() * 1.2, -pr.v.z * back * 1.5 + (Math.random() - 0.5), 0.25 + Math.random() * 0.2, s * (1.6 + Math.random()), 0, 2);
      }
      if (Math.random() < 0.35) puff(pr.x, pr.y, pr.z, 0x2a2420, (Math.random() - 0.5) * 0.4, 1 + Math.random(), (Math.random() - 0.5) * 0.4, 0.8, s * 1.4, 1.6, 1);
      if (Math.random() < 0.5) puff(pr.x, pr.y, pr.z, 0xffd060, (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3, 0.5, 0.05, 0, 0.5);
      if (!projLight) { projLight = new THREE.PointLight(0xff8a30, 0, 12, 1.6); G.scene.add(projLight); }
      projLight.position.set(pr.x, pr.y, pr.z); projLight.intensity = 18 + Math.random() * 8; projLight.userData.t = 0.06;
    } else if (pr.color && Math.random() < 0.7) puff(pr.x, pr.y, pr.z, pr.color, 0, 0.3, 0, 0.35, (pr.size || 0.25) * 1.6, 0, 1);
    let dead = pr.life <= 0 || pr.y < heightAt(pr.x, pr.z) || collide(pr.x, pr.z, 0.05)[0] !== pr.x;
    if (!dead && pr.owner === 'player') {
      for (const e of enemiesNear(pr.x, pr.z, 3)) {
        if (e.dead || pr.hit.has(e)) continue;
        const top = e.y + (e.model.beast ? 1.3 : 2.1) * e.size;
        if (Math.hypot(e.pos.x - pr.x, e.pos.z - pr.z) < e.radius + 0.4 && pr.y > e.y - 0.3 && pr.y < top + 0.3) {
          pr.hit.add(e);
          if (pr.onHit) pr.onHit(e); else hitEnemy(e, pr.mult, pr.kind, pr.opts || {});
          if (!pr.pierce) { dead = true; break; }
        }
      }
    } else if (!dead && pr.owner === 'enemy' && P.state !== 'dead') {
      if (Math.hypot(P.pos.x - pr.x, P.pos.z - pr.z) < 0.65 && pr.y > P.y - 0.3 && pr.y < P.y + 2.2) {
        hurtPlayer(pr.dmg, { x: pr.x - pr.v.x * 0.05, z: pr.z - pr.v.z * 0.05, lv: pr.lv }, { poison: pr.poison });
        if (P.iframes <= 0) dead = true;
      }
    }
    if (dead) {
      if (pr.fire) {
        // fire bursts: flash, flames, embers and a smoke plume
        for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 3; puff(pr.x, pr.y, pr.z, [0xffe080, 0xffa040, 0xff6a1a][k % 3], Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp, 0.35 + Math.random() * 0.25, 0.35 + Math.random() * 0.3, 0, 3); }
        for (let k = 0; k < 6; k++) puff(pr.x, pr.y + 0.2, pr.z, 0x2a2420, (Math.random() - 0.5) * 1.2, 1.2 + Math.random(), (Math.random() - 0.5) * 1.2, 1.1, 0.4, 2.2, 1);
        burst(pr.x, pr.y, pr.z, 0xffd060, 10, 5, 0.6, 0.04, 6);
        sfx('impact_fire', 0.7);
      }
      if (pr.owner === 'player' && pr.explode) {
        shockRing(pr.x, pr.z, pr.explode, pr.color || 0xff8a3a, 0.35);
        burst(pr.x, pr.y, pr.z, pr.color || 0xff8a3a, 16, 5, 0.5);
        sfx('boom', 0.5);
        for (const e of enemiesNear(pr.x, pr.z, pr.explode + 2)) if (!e.dead && !pr.hit.has(e) && Math.hypot(e.pos.x - pr.x, e.pos.z - pr.z) < pr.explode + e.radius) { if (pr.onHit) pr.onHit(e, true); else hitEnemy(e, pr.mult * 0.7, pr.kind, pr.opts || {}); }
      } else if (!pr.color && !pr.hit.size) {
        // arrows that miss stick in the ground for a while
        const stuck = pr.mesh; stuck.position.y = Math.max(stuck.position.y, heightAt(pr.x, pr.z) + 0.25);
        G.projectiles.splice(i, 1);
        setTimeout(() => G.scene.remove(stuck), 8000);
        continue;
      }
      G.scene.remove(pr.mesh);
      G.projectiles.splice(i, 1);
    }
  }
  if (projLight && projLight.userData.t > 0) { projLight.userData.t -= dt; if (projLight.userData.t <= 0) projLight.intensity = 0; }
}

// where an arrow leaves the player and which way it flies (toward whatever the crosshair is on)
function shotFrom() {
  const P = G.player, a = G.input.aimPoint;
  const ox = P.pos.x + Math.sin(P.yaw) * 0.5, oy = P.y + 1.5 * (P.h.size || 1), oz = P.pos.z + Math.cos(P.yaw) * 0.5;
  if (!a) return { x: ox, y: oy, z: oz, dx: Math.sin(P.yaw), dy: 0, dz: Math.cos(P.yaw) };
  return { x: ox, y: oy, z: oz, dx: a.x - ox, dy: a.y - oy, dz: a.z - oz };
}

// ---------- Actions ----------
const aimDir = () => { const P = G.player; return [Math.sin(P.yaw), Math.cos(P.yaw), G.input.aimDist ?? 8]; };
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
    if (wt === 'club') pose = P.combo % 2 === 0 ? 'slash' : 'overhead';
    if (wt === 'spear') { pose = 'thrust'; if (P.combo === 2) mult *= 1.3; }
    if ((wt === 'rapier' || wt === 'dagger') && P.combo % 2 === 1) pose = 'thrust';
    P.combo = (P.combo + 1) % spec.combo;
  } else pose = spec.kind === 'spin' ? 'spin' : spec.kind === 'slam' ? 'slam' : 'thrust';
  if (wt === 'staff') pose = kind === 'heavy' ? 'cast' : 'thrust';
  const dur = spec.time / atkSpeed();
  P.state = 'attack';
  P.atk = { kind, spec, pose, mult, t: 0, dur, hitDone: false, wt };
  swingFx(P, P.atk); // whoosh and trail
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

// staff: light = bolt, heavy = charged blast that bursts on impact
function fireStaff(a) {
  const w = activeWeapon(), W = WEAPONS.staff;
  const gemC = [0xff7a2a, 0x6ac8ff, 0xc66dff][(w?.tier || 1) - 1];
  const heavy = a.kind === 'heavy';
  spawnProj({ owner: 'player', ...shotFrom(), speed: heavy ? W.speed * 0.8 : W.speed, range: W.range, mult: a.mult, kind: a.kind, color: gemC, size: heavy ? 0.38 : 0.2, explode: heavy ? W.heavy.explode : 0 });
  sfx('magic', heavy ? 0.8 : 0.45);
}

// guns: one heavy ball (musket) or a spread of shot (blunderbuss), then a reload
function fireGun(wt, power) {
  const P = G.player, W = WEAPONS[wt], from = shotFrom();
  const steady = 0.6 + power * 0.4;
  const n = W.pellets || 1;
  const l = Math.hypot(from.dx, from.dy, from.dz) || 1;
  for (let i = 0; i < n; i++) {
    const sp = n > 1 ? W.spread : 0.012 * (1 - power);
    const dx = from.dx / l + (Math.random() - 0.5) * sp * 2, dy = from.dy / l + (Math.random() - 0.5) * sp, dz = from.dz / l + (Math.random() - 0.5) * sp * 2;
    if (W.bolt) spawnProj({ owner: 'player', x: from.x, y: from.y, z: from.z, dx, dy, dz, speed: W.speed, range: W.range, mult: steady, kind: power >= 0.99 ? 'heavy' : 'light' });
    else spawnProj({ owner: 'player', x: from.x, y: from.y, z: from.z, dx, dy, dz, speed: W.speed * (0.9 + Math.random() * 0.1), range: W.range, mult: steady, kind: power >= 0.99 ? 'heavy' : 'light', color: 0xffe0a0, size: n > 1 ? 0.07 : 0.1, element: 'physical' });
  }
  if (W.bolt) { sfx('bow'); P.reload = W.reload / atkSpeed(); return; }
  // muzzle flash and smoke
  const mx = from.x + from.dx / l * 1.2, my = from.y + from.dy / l * 1.2, mz = from.z + from.dz / l * 1.2;
  burst(mx, my, mz, 0xffc060, n > 1 ? 14 : 8, 7, 0.18, 0.14, 0);
  for (let i = 0; i < (n > 1 ? 8 : 5); i++) puff(mx, my, mz, 0xb8b0a8, from.dx / l * 2 + (Math.random() - 0.5), 0.6 + Math.random() * 0.6, from.dz / l * 2 + (Math.random() - 0.5), 1.4 + Math.random(), 0.35, 1.4);
  sfx('boom', n > 1 ? 0.9 : 0.7); shake(n > 1 ? 0.22 : 0.14);
  P.reload = W.reload / atkSpeed();
}

function fireArrow(power) {
  const P = G.player, s = stats();
  const W = WEAPONS.bow;
  let mult = 0.3 + power * 0.7;
  if (power >= 0.99) mult *= 1 + (s.mods.fullDraw || 0);
  spawnProj({ owner: 'player', ...shotFrom(), speed: W.speed * (0.7 + power * 0.3), range: W.range, mult, kind: power >= 0.99 ? 'heavy' : 'light' });
  sfx('bow');
}

export function startDodge() {
  const P = G.player, s = stats();
  if (P.state === 'ability' || P.state === 'dodge' || P.state === 'dead' || P.state === 'stunned') return;
  if (P.gather) cancelGather();
  if (P.recall) { P.recall = null; castBar(null); }
  const L = LOADS[s.load || 'medium'].dodge;
  const cost = L.cost * (1 + (s.mods.dodgeCost || 0));
  if (P.stam < cost || P.exhausted > 0) { if (P.exhausted > 0) selfText('Exhausted', 'warn'); return; }
  const k = G.input.keys;
  let [mx, mz] = moveDir(k);
  if (!mx && !mz) { mx = -Math.sin(P.yaw); mz = -Math.cos(P.yaw); }
  const l = Math.hypot(mx, mz);
  P.stam -= cost; P.stamDelay = 0.7;
  if (P.stam <= 0) { P.stam = 0; P.exhausted = 1.6; }
  P.state = 'dodge'; P.atk = null; P.press = null; P.draw = 0;
  P.dodge = { t: 0, dur: L.dur, dx: mx / l, dz: mz / l, speed: L.dist / (L.dur * 0.7), roll: L.roll };
  P.iframes = L.dur * 0.8;
  dodgeFx(P);
}

export function jump() {
  const P = G.player;
  if (busy() || P.state === 'gather' || (P.jumpY || 0) > 0 || P.jv) return;
  P.jv = 10.5; // about 2.3 m high
  if (P.recall) { P.recall = null; castBar(null); }
  sfx('step', 1.2);
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
      spawnProj({ owner: 'player', ...shotFrom(), speed: 44, range: 32, mult: A.dmg, kind: 'ability' });
      sfx('bow');
      break;
    }
    case 'proj': {
      P.state = 'ability';
      P.ability = { id, A, t: 0, dur: 0.3, pose: 'shoot' };
      spawnProj({ owner: 'player', ...shotFrom(), speed: A.speed || 44, range: 36, mult: A.dmg, kind: 'ability', pierce: !!A.pierce, poison: !!A.dot, color: A.color, size: A.color ? 0.35 : 0, explode: A.explode || 0, opts: A.dot ? { dot: A.dot, dotDur: A.dotDur } : {} });
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
          hitEnemy(e, A.dmg, 'ability', { stun: A.stun, slow: A.slow, knock: A.knock });
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
  } else if (!ab.leap) {
    // casting and striking don't root you: keep moving at full speed
    const [mx, mz] = moveDir(G.input.keys), ml = Math.hypot(mx, mz);
    if (ml) {
      const sp = 6.2 * (1 + stats().moveSpeed) / ml;
      const nx = P.pos.x + mx * sp * dt, nz = P.pos.z + mz * sp * dt;
      if (walkable(nx, nz)) { const [cx, cz] = collide(nx, nz, PLAYER_R); P.pos.x = cx; P.pos.z = cz; }
      P.phase += dt * 6.2 * 1.6; P.move = Math.min(1, P.move + dt * 10);
    }
  }
  if (A.kind === 'dash') {
    for (const e of enemiesNear(P.pos.x, P.pos.z, A.radius + 2)) {
      if (e.dead || ab.hit.has(e) || Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > A.radius + e.radius) continue;
      ab.hit.add(e);
      hitEnemy(e, A.dmg, 'ability', { stun: A.stun, knock: A.knock });
      ab.onHit?.(e);
    }
  }
  if (ab.leap) P.jumpY = Math.sin(Math.min(1, ab.t / ab.dur) * Math.PI) * 3;
  if (ab.t >= ab.dur) {
    if (ab.leap) {
      P.jumpY = 0;
      shockRing(P.pos.x, P.pos.z, A.radius, 0xffe0a0, 0.4); shake(0.35); sfx('boom', 0.8);
      burst(P.pos.x, P.y + 0.3, P.pos.z, 0x9a8a70, 16, 6, 0.5);
      for (const e of enemiesNear(P.pos.x, P.pos.z, A.radius + 2)) if (!e.dead && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < A.radius + e.radius) { hitEnemy(e, A.dmg, 'ability', { stagger: true }); ab.onHit?.(e); }
      ab.onLand?.();
      sfx('land');
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
  P.iframes -= dt; P.swapT -= dt; P.potionCd -= dt;
  // jumping (leaps use jumpY themselves)
  if (!(P.ability && P.ability.leap)) {
    if (P.jv || P.jumpY > 0) {
      P.jv = (P.jv || 0) - 24 * dt; P.jumpY = Math.max(0, (P.jumpY || 0) + P.jv * dt);
      if (P.jumpY <= 0) { if (P.jv < -6) { sfx('land'); burst(P.pos.x, P.y + 0.1, P.pos.z, 0xb8a888, 10, 3, 0.5, 0.18, 4); shake(0.12); } P.jv = 0; P.jumpY = 0; }
    }
  } P.recallCd -= dt; P.exhausted -= dt; P.comboTimer -= dt; P.inCombat -= dt;
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
  let [mx, mz] = moveDir(k);
  const ml = Math.hypot(mx, mz); if (ml) { mx /= ml; mz /= ml; }
  if (ml && P.gather) cancelGather();
  if (ml && P.recall) { P.recall = null; castBar(null); toast('Recall cancelled'); }

  P.facing = P.yaw;

  if (P.state === 'ability') updateAbility(dt);
  else if (P.state === 'dodge') {
    const d = P.dodge; d.t += dt;
    const sp = d.speed * (1 - d.t / d.dur * 0.6);
    const nx = P.pos.x + d.dx * sp * dt, nz = P.pos.z + d.dz * sp * dt;
    if (walkable(nx, nz)) { const [cx, cz] = collide(nx, nz, PLAYER_R); P.pos.x = cx; P.pos.z = cz; }
    if (d.t >= d.dur) { P.state = 'idle'; P.dodge = null; }
  } else if (P.state !== 'stunned') {
    // attacks
    P.blocking = inp.rmb && wt && WEAPONS[wt].block > 0 && P.state !== 'attack' && P.state !== 'gather' && P.exhausted <= 0;
    if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { P.reload = 0; sfx('craft', 0.35); } }
    if (RANGED_WEAPONS.has(wt)) {
      const gun = WEAPONS[wt].gun;
      if (inp.lmb && P.state !== 'gather' && !inp.overUI && !(gun && P.reload > 0)) {
        if (P.state !== 'draw') { P.state = 'draw'; P.draw = 0; }
        P.draw = Math.min(1, P.draw + dt / (WEAPONS[wt].draw / (1 + (s.mods.drawSpeed || 0)) / atkSpeed()));
      } else if (P.state === 'draw') {
        if (gun) { fireGun(wt, P.draw); P.state = 'attack'; P.atk = { pose: 'recoil', t: 0, dur: 0.3, hitDone: true, spec: {} }; }
        else { fireArrow(P.draw); P.state = 'attack'; P.atk = { pose: 'shoot', t: 0, dur: 0.22, hitDone: true, spec: {} }; }
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
        if (a.wt === 'staff') fireStaff(a); else { swingPeakFx(P, a); meleeHit(a); }
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
    for (const b of P.buffs) sp *= 1 + (b.mods.moveSpeed || 0);
    if (P.blocking) sp *= 0.5;
    // full speed while attacking, drawing and shooting
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
      // stride sounds
      if (Math.floor(P.phase / Math.PI) !== P.lastStep) { P.lastStep = Math.floor(P.phase / Math.PI); sfx('step', 0.5); }
    }
    P.move += ((ml && sp > 0 ? Math.min(1, sp / 6.2) : 0) - P.move) * Math.min(1, dt * 10);
  }
  // pose
  let pose = null, t = 0;
  if (P.state === 'attack') { pose = P.atk.pose; t = P.atk.t / P.atk.dur; }
  else if (P.state === 'draw') pose = WEAPONS[wt]?.gun ? 'rifle' : 'draw';
  else if (P.state === 'dodge') { pose = P.dodge.roll ? 'dodge' : 'hop'; t = P.dodge.t / P.dodge.dur; }
  else if (P.swapT > 0) { pose = 'swap'; t = 1 - P.swapT / 0.25; }
  else if ((P.jumpY || 0) > 0.05 && !(P.ability && P.ability.leap)) { pose = 'jump'; t = Math.min(1, Math.max(0, 0.5 - (P.jv || 0) / 21)); }
  else if (P.state === 'ability') { pose = P.ability.pose; t = P.ability.t / P.ability.dur; if (pose === 'shoot' || pose === 'block') t = Math.min(1, t); }
  else if (P.state === 'gather') { pose = P.gather.pose; t = P.gather.t; }
  else if (P.state === 'stunned') pose = 'stun';
  else if (P.whirl) { pose = 'spin'; t = (G.time * 2.5) % 1; }
  else if (P.blocking) pose = 'block';
  else if (P.recall) pose = 'cast';
  else if (P.reload > 0 && WEAPONS[wt]?.gun) { pose = 'reload'; t = 1 - P.reload / (WEAPONS[wt].reload || 1); }
  else if (P.press && P.press.t > 0.12 && !RANGED_WEAPONS.has(wt)) { pose = 'windup'; t = P.press.t; }
  animHumanoid(P.h, { move: P.move, phase: P.phase, pose, t, twoHand: wt === 'greataxe' || wt === 'hammer', draw: P.draw });
  if (P.wL?.userData.string) P.wL.userData.string.position.z = -0.24 - (P.state === 'draw' ? P.draw * 0.35 : 0);
  placeModel();
  // flash
  const fl = P.hurtFlash > 0 ? 0x661010 : P.iframes > 0 && P.state === 'dodge' ? 0x202838 : 0;
  for (const m of P.h.mats) m.emissive.setHex(fl);
}

// WASD relative to where the player looks. Forward = (sin yaw, cos yaw), right = (-cos yaw, sin yaw)
function moveDir(k) {
  const P = G.player;
  const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  return [Math.sin(P.yaw) * f - Math.cos(P.yaw) * r, Math.cos(P.yaw) * f + Math.sin(P.yaw) * r];
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
  P.swapT = 0.25;
  refreshLook();
  sfx('swap');
  refreshHud();
}
