import { creatureReady, makeCreature } from './gfx/creatures.js';
import { G } from './state.js';
import { ENEMIES, ATTACKS, killXp, MATS } from './data.js';
import { makeHumanoid, makeBeast, makeWeapon } from './models.js';
import { animHumanoid, animBeast } from './anim.js';
import { heightAt, walkable, collide, levelAt } from './world.js';
import { telegraph, removeTelegraph, burst, shockRing, shake } from './fx.js';
import { hurtPlayer, spawnProj } from './player.js';
import { gainXp, gainMastery, activeWType, stats } from './stats.js';
import { randomDrop, addItem, addMat } from './items.js';
import { toast, lootToast, bossBar, floatText } from './ui.js';
import { questEvent } from './quests.js';
import { hurtPet, setPetDamageHook } from './pets.js';
import { killFx } from './combatfx.js';

// who an enemy is fighting: a summoned pet that hit it (or, in Kingdom Wars, a blue soldier), or the player
function targetOf(e) {
  const pt = e.petTarget;
  if (pt && !pt.dead && Math.hypot(pt.pos.x - e.pos.x, pt.pos.z - e.pos.z) < 30) return { pos: pt.pos, y: pt.y, pet: pt };
  e.petTarget = null;
  return { pos: G.player.pos, y: G.player.y, pet: null };
}
// pets hurt enemies through here
setPetDamageHook((e, dmg, pet) => {
  if (e.dead) return;
  e.hp -= dmg; e.hitFlash = 0.12; e.aggro = true; e.lastHit = G.time;
  G.net?.hit(e, dmg);
  if (e.mezzed) { e.mezzed = false; e.stunned = 0; }
  if (pet && !e.petTarget && Math.random() < 0.6) e.petTarget = pet;
  floatText({ x: e.pos.x, z: e.pos.z, y: e.y + 1.6 * e.size }, `${Math.round(dmg)}`, 'pet');
  if (e.hp <= 0) killEnemy(e);
});
import { sfx } from './audio.js';
import { angDiff, rand, randi, clamp } from './util.js';

export function enemiesNear(x, z, r) {
  const out = [];
  for (const e of G.enemies) if (!e.dead && Math.abs(e.pos.x - x) < r + 3 && Math.abs(e.pos.z - z) < r + 3) out.push(e);
  return out;
}

export function spawnEnemy(type, x, z, lv, camp = null, slot = null) {
  const def = ENEMIES[type];
  const model = def.model === 'humanoid'
    ? makeHumanoid({ skin: def.skin, shirt: def.shirt, pants: def.pants, eyes: def.eyes, size: def.size, hunched: def.hunched, hat: def.hat, horns: def.horns })
    : def.creature && creatureReady(def.creature) ? makeCreature(def.creature, { size: def.size, tint: def.tint })
    : makeBeast(type === 'boar' ? 'boar' : 'wolf', { color: def.color, size: def.size, eyes: def.eyes });
  if (def.weapon) {
    const w = makeWeapon(def.weapon);
    if (def.weapon === 'bow') model.parts.handL.add(w); else model.parts.handR.add(w);
  }
  G.scene.add(model.root);
  // tougher than before: more health, harder hits, and more of both for each party member nearby
  const party = G.net?.nearCount ? G.net.nearCount(x, z) : 0;
  const hpMult = (1.6 + 0.3 * (lv - 1)) * (1 + 0.6 * party), dmgMult = (1.4 + 0.24 * (lv - 1)) * (1 + 0.1 * party);
  const e = {
    type, def, lv, camp, slot, model, root: model.root,
    pos: { x, z }, y: heightAt(x, z), home: { x, z }, facing: Math.random() * 6.28,
    radius: def.radius ?? 0.5 * def.size * (def.model === 'humanoid' ? 1 : 1.1), size: def.size,
    hp: Math.round(def.hp * hpMult), maxHp: Math.round(def.hp * hpMult), dmg: def.dmg * dmgMult,
    state: 'idle', aggro: false, atk: null, cds: {}, phase: Math.random() * 6, move: 0,
    stunned: 0, slowUntil: 0, knock: null, dot: null, hitFlash: 0, dead: false,
    wander: null, wanderT: rand(1, 5), strafe: Math.random() < 0.5 ? 1 : -1, adds: [],
  };
  for (const a of def.attacks) e.cds[a] = G.time + rand(0.5, 2);
  // camp enemies get a key every player's game agrees on (camp, slot, how many times that slot has died)
  if (camp && slot) {
    e.key = `${G.camps.indexOf(camp)}:${camp.slots.indexOf(slot)}:${slot.gen || 0}`;
    (G.enemyByKey ||= new Map()).set(e.key, e);
  }
  G.enemies.push(e);
  return e;
}

export function removeEnemy(e) {
  G.scene.remove(e.root);
  if (e.key && G.enemyByKey?.get(e.key) === e) G.enemyByKey.delete(e.key);
  if (e.atk?.tel) removeTelegraph(e.atk.tel);
  const i = G.enemies.indexOf(e); if (i >= 0) G.enemies.splice(i, 1);
  if (G.boss === e) { G.boss = null; bossBar(null); }
}

export function stunEnemy(e, dur) {
  if (e.dead) return;
  if (e.def.boss) dur *= 0.3;
  interruptEnemy(e, dur);
  floatText({ x: e.pos.x, z: e.pos.z, y: e.y + 2 * e.size }, 'Stunned', 'info');
}
export function interruptEnemy(e, dur) {
  if (e.dead) return;
  if (e.atk && e.state !== 'charging') { if (e.atk.tel) removeTelegraph(e.atk.tel); for (const t of e.atk.tels || []) removeTelegraph(t); e.atk = null; }
  if (e.state === 'charging') return;
  e.state = 'stunned'; e.stunned = Math.max(e.stunned, dur);
}
export function knockEnemy(e, dx, dz, force) {
  if (e.def.boss) force *= 0.2;
  e.knock = { vx: dx * force * 3, vz: dz * force * 3, t: 0.25 };
}

// remote: the enemy died in a party member's game (near: I was close enough to share the kill)
export function killEnemy(e, remote = false, near = true) {
  if (e.dead) return;
  e.dead = true; e.deadT = 0; e.state = 'dead';
  if (e.atk) { if (e.atk.tel) removeTelegraph(e.atk.tel); for (const t of e.atk.tels || []) removeTelegraph(t); e.atk = null; }
  if (!remote) G.net?.kill(e);
  if (e.slot) e.slot.gen = (e.slot.gen || 0) + 1;
  const P = G.player, p = G.p;
  if (remote && !near) { if (e.camp) { e.slot.ent = null; e.slot.respawnAt = G.time + 50; } e.removeAt = G.time + 4; killFx(e); return; }
  // rewards
  let xp = killXp(e.lv) * (e.def.xpMult || 1) * 1.3; // tougher enemies are worth more
  const diff = p.level - e.lv;
  if (diff > 4) xp *= Math.max(0.15, 1 - (diff - 4) * 0.2);
  if (e.isAdd) xp *= 0.3;
  gainXp(xp);
  gainMastery(activeWType(), xp * 0.9);
  p.stats.kills++;
  G.onPlayerKill?.(e);
  if (!e.isAdd && !e.def.minion) {
    const coins = randi(1, 3) * Math.ceil(e.lv / 2) * (e.def.boss ? 15 : 1);
    p.coins += coins;
    for (const m of e.def.drops || []) if (Math.random() < (e.def.boss ? 1 : 0.45)) { addMat(m, 1); lootToast(`+1 ${MATS[m].icon} ${MATS[m].name}`); }
    const chance = e.def.boss ? 1 : e.def.xpMult ? 0.35 : 0.16;
    if (Math.random() < chance) dropGear(e.lv, e.def.boss ? 2 : 0, e.def.boss ? 2 : 0);
    if (e.def.boss) dropGear(e.lv + 1, 1.5, 1);
  }
  questEvent('kill', { type: e.type, family: e.def.family, zone: e.camp?.zone, boss: e.def.boss });
  if (e.def.boss) {
    p.stats.bosses++;
    sfx('roar');
    shake(0.6);
    toast(`${e.def.name} has fallen!`, 'gold');
    for (const a of e.adds) if (!a.dead) killEnemyQuiet(a);
  }
  if (e.camp) { e.slot.ent = null; e.slot.respawnAt = G.time + (e.def.boss ? 150 : 50 + rand(0, 20)); }
  if (G.boss === e) setTimeout(() => { if (G.boss === e) { G.boss = null; bossBar(null); } }, 1500);
  // skinnable corpse
  if (e.def.skin) G.corpses.push({ kind: 'corpse', ent: e, x: e.pos.x, z: e.pos.z, thick: !!e.def.thick, skinned: false, until: G.time + 40, name: e.def.name });
  else e.removeAt = G.time + 4;
  killFx(e); // death burst and sound
}
G.killEnemyRemote = (e, near) => killEnemy(e, true, near);
// killed by someone other than the player (Kingdom Wars soldiers): no rewards, just the death
export function slayEnemy(e) {
  if (e.dead) return;
  e.dead = true; e.deadT = 0; e.state = 'dead'; e.removeAt = G.time + 4;
  if (e.atk) { if (e.atk.tel) removeTelegraph(e.atk.tel); for (const t of e.atk.tels || []) removeTelegraph(t); e.atk = null; }
  if (G.boss === e) { G.boss = null; bossBar(null); }
  killFx(e);
}
function killEnemyQuiet(e) { e.dead = true; e.deadT = 0; e.state = 'dead'; e.removeAt = G.time + 2; if (e.atk?.tel) removeTelegraph(e.atk.tel); }

function dropGear(lv, bonus, minR) {
  const it = randomDrop(lv, bonus, minR);
  if (addItem(it)) { lootToast(it); sfx(it.rarity >= 2 ? 'loot' : 'pickup'); }
  else toast('Your bag is full! Sell or salvage gear.', 'warn');
}

// ---------- Camps ----------
let campTimer = 0;
export function updateCamps(dt) {
  campTimer -= dt;
  if (campTimer > 0) return;
  campTimer = 0.5;
  const P = G.player;
  for (const c of G.camps) {
    const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
    if (d < 85) {
      for (const s of c.slots) {
        if (s.ent) continue;
        if (s.respawnAt && G.time < s.respawnAt) continue;
        if (c.active && d < 40 && !c.boss) continue; // don't pop in right beside the player
        const a = Math.random() * 6.28, r = Math.random() * c.radius;
        let x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (!walkable(x, z)) { x = c.x; z = c.z; }
        const lv = c.lv || clamp(levelAt(c.x, c.z) + (Math.random() < 0.3 ? 1 : 0), 1, 30);
        s.ent = spawnEnemy(s.type, x, z, lv, c, s);
        s.respawnAt = 0;
      }
      c.active = true;
    } else if (c.active && d > 115) {
      if (c.slots.some(s => s.ent && s.ent.aggro && !s.ent.dead)) continue;
      for (const s of c.slots) if (s.ent) { if (!s.ent.dead) removeEnemy(s.ent); s.ent = null; }
      c.active = false;
    }
  }
}

// ---------- AI ----------
function pickAttack(e, d) {
  const P = G.player;
  const list = e.def.attacks;
  const opts = [];
  for (const id of list) {
    if ((e.cds[id] || 0) > G.time) continue;
    const A = ATTACKS[id];
    let ok = false;
    switch (A.kind) {
      case 'melee': case 'cone': ok = d < A.range + e.radius + 0.3; break;
      case 'charge': ok = d > A.min && d < A.dist; break;
      case 'proj': ok = d < A.range; break;
      case 'aoe': ok = A.at === 'self' ? d < A.radius * 0.85 : d < 20; break;
      case 'summon': ok = e.adds.filter(a => !a.dead).length < 4 && e.hp < e.maxHp * 0.9; break;
    }
    if (ok) opts.push(id);
  }
  if (!opts.length) return null;
  // bosses prefer special moves when available
  const special = opts.filter(id => ['aoe', 'summon', 'charge'].includes(ATTACKS[id].kind));
  if (special.length && Math.random() < 0.6) return special[Math.floor(Math.random() * special.length)];
  return opts[Math.floor(Math.random() * opts.length)];
}

function startAttack(e, id) {
  const A = ATTACKS[id], P = targetOf(e);
  const enrage = e.def.boss && e.hp < e.maxHp * 0.3 ? 0.75 : 1;
  const wind = A.windup * enrage;
  e.facing = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  e.atk = { id, A, t: 0, wind };
  e.state = 'windup';
  const col = A.color ?? 0xff2a1a;
  if (A.kind === 'melee' || A.kind === 'cone') e.atk.tel = telegraph({ shape: 'sector', x: e.pos.x, z: e.pos.z, r: A.range + e.radius, arc: A.arc, angle: e.facing, dur: wind, color: col });
  else if (A.kind === 'charge') e.atk.tel = telegraph({ shape: 'rect', x: e.pos.x, z: e.pos.z, width: A.width, len: A.dist, angle: e.facing, dur: wind, color: col });
  else if (A.kind === 'aoe') {
    if (A.at === 'self') e.atk.tel = telegraph({ shape: 'circle', x: e.pos.x, z: e.pos.z, r: A.radius, dur: wind, color: col });
    else {
      e.atk.spots = [];
      e.atk.tels = [];
      const n = A.count || 1;
      for (let i = 0; i < n; i++) {
        const ox = i === 0 ? 0 : rand(-A.spread, A.spread), oz = i === 0 ? 0 : rand(-A.spread, A.spread);
        const x = P.pos.x + ox, z = P.pos.z + oz;
        e.atk.spots.push([x, z]);
        e.atk.tels.push(telegraph({ shape: 'circle', x, z, r: A.radius, dur: wind, color: col }));
      }
    }
  }
  if (A.kind === 'summon') { sfx('roar', 0.5); }
}

function resolveAttack(e) {
  const a = e.atk, A = a.A, T = targetOf(e), P = T;
  const dmg = e.dmg * A.dmg;
  const src = { x: e.pos.x, z: e.pos.z, lv: e.lv };
  e.cds[a.id] = G.time + A.cd * 0.8 * (e.def.boss && e.hp < e.maxHp * 0.3 ? 0.7 : 1);
  switch (A.kind) {
    case 'melee': case 'cone': {
      const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d < A.range + e.radius + 0.45 && Math.abs(angDiff(e.facing, Math.atan2(dx, dz))) < A.arc / 2 * Math.PI / 180 + 0.2) { if (T.pet) hurtPet(T.pet, dmg); else hurtPlayer(dmg, src); }
      e.strikeT = 0.25;
      sfx('swing', 0.5);
      e.atk = null; e.state = 'recover'; e.recover = 0.35;
      return;
    }
    case 'charge': {
      e.state = 'charging';
      e.atk.charge = { t: 0, dur: A.dist / 22, dx: Math.sin(e.facing), dz: Math.cos(e.facing), hit: false, dmg };
      sfx('heavy', 0.6);
      return;
    }
    case 'proj': {
      const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, l = Math.hypot(dx, dz) || 1;
      const sy = e.y + 1.3 * e.size, ty = P.y + 1.2;
      if (T.pet) { const pet = T.pet; setTimeout(() => hurtPet(pet, dmg), l / A.speed * 1000); }
      spawnProj({ owner: 'enemy', x: e.pos.x + dx / l * 0.6, z: e.pos.z + dz / l * 0.6, y: sy, dx: dx / l, dy: (ty - sy) / l, dz: dz / l, speed: A.speed, range: A.range + 6, dmg, lv: e.lv, poison: A.poison, color: A.color });
      if (!A.color) sfx('bow', 0.5); else sfx('magic', 0.4);
      break;
    }
    case 'aoe': {
      const spots = A.at === 'self' ? [[e.pos.x, e.pos.z]] : a.spots;
      for (const [x, z] of spots) {
        shockRing(x, z, A.radius, A.color ?? 0xff5030, 0.4);
        burst(x, heightAt(x, z) + 0.3, z, A.color ?? 0xa08060, 14, 6, 0.6);
        const pl = G.player;
        if (Math.hypot(pl.pos.x - x, pl.pos.z - z) < A.radius + 0.4) hurtPlayer(dmg, { x, z, lv: e.lv }, { poison: A.poison, unblockable: A.at !== 'self' });
        for (const pet of G.pets) if (!pet.dead && Math.hypot(pet.pos.x - x, pet.pos.z - z) < A.radius + pet.radius) hurtPet(pet, dmg);
      }
      sfx('boom', 0.6); shake(e.def.boss ? 0.4 : 0.2);
      break;
    }
    case 'summon': {
      for (let i = 0; i < A.n; i++) {
        const ang = Math.random() * 6.28;
        const x = e.pos.x + Math.cos(ang) * 4, z = e.pos.z + Math.sin(ang) * 4;
        if (!walkable(x, z)) continue;
        const add = spawnEnemy(A.what, x, z, Math.max(1, e.lv - 3));
        add.isAdd = true; add.aggro = true; add.removeIfFar = true;
        e.adds.push(add);
        burst(x, heightAt(x, z) + 0.5, z, 0x602020, 12, 3, 0.6);
      }
      floatText({ x: e.pos.x, z: e.pos.z, y: e.y + 2.5 * e.size }, 'calls for aid!', 'warn');
      break;
    }
  }
  e.atk = null; e.state = 'recover'; e.recover = 0.5;
}

const UPDATE_R = 70;
export function updateEnemies(dt) {
  const P = G.player;
  const pdead = P.state === 'dead';
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz);
    if (e.dead) {
      e.deadT += dt;
      animate(e, 'dead', e.deadT);
      if (e.deadT > 1.5 && e.removeAt) e.root.position.y -= dt * 0.8;
      if (e.removeAt && G.time > e.removeAt) removeEnemy(e);
      continue;
    }
    if (e.removeIfFar && d > 90) { removeEnemy(e); continue; }
    if (G.net?.remote(e)) {
      // a party member is fighting this one: follow their game
      const k = Math.min(1, dt * 10);
      e.pos.x += (e.netPos.x - e.pos.x) * k; e.pos.z += (e.netPos.z - e.pos.z) * k;
      let df = e.netF - e.facing; df = Math.atan2(Math.sin(df), Math.cos(df)); e.facing += df * k;
      e.phase += dt * e.move * 8;
      e.root.visible = d < 100;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      animate(e, e.netPose, e.netT);
      continue;
    }
    if (d > UPDATE_R && !e.aggro && !e.march) { e.root.visible = d < 100; continue; }
    e.root.visible = true;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    // dot
    if (e.dot) {
      if (e.dot.until < G.time) e.dot = null;
      else {
        e.dot.tick -= dt;
        if (e.dot.tick <= 0) {
          e.dot.tick = 1;
          const n = Math.round(e.dot.dps); e.hp -= n; e.hitFlash = 0.1; G.net?.hit(e, n);
          floatText({ x: e.pos.x, z: e.pos.z, y: e.y + 1.6 * e.size }, `${n}`, 'dot');
          if (e.hp <= 0) { killEnemy(e); continue; }
        }
      }
    }
    // knockback
    if (e.knock) {
      e.knock.t -= dt;
      const nx = e.pos.x + e.knock.vx * dt, nz = e.pos.z + e.knock.vz * dt;
      if (walkable(nx, nz)) [e.pos.x, e.pos.z] = collide(nx, nz, e.radius);
      if (e.knock.t <= 0) e.knock = null;
    }
    // aggro / leash
    const aggroR = e.def.boss ? 20 : e.def.passive ? 0 : 17;
    if (!e.aggro && !pdead && d < aggroR && e.state !== 'return') {
      e.aggro = true;
      if (e.camp) for (const s of e.camp.slots) if (s.ent && !s.ent.dead && s.ent.state !== 'return') s.ent.aggro = true;
    }
    if (e.aggro && e.def.boss && !e.isAdd && G.boss !== e) { G.boss = e; sfx('roar'); }
    const homeD = Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z);
    if (e.march) {
      // marching soldiers never go home: they drop a player who got away and carry on down the road
      if (e.aggro && !targetOf(e).pet && (pdead || d > 26)) { e.aggro = false; if (e.atk) { if (e.atk.tel) removeTelegraph(e.atk.tel); e.atk = null; e.state = 'idle'; } }
    } else if (e.aggro && (pdead || d > 55 || (!e.isAdd && homeD > (e.def.boss ? 34 : 42)))) {
      e.aggro = false; e.state = 'return';
      if (e.atk) { if (e.atk.tel) removeTelegraph(e.atk.tel); for (const t of e.atk.tels || []) removeTelegraph(t); e.atk = null; }
      if (G.boss === e) { G.boss = null; bossBar(null); }
    }
    // burning, bleeding and poison tick once a second; flames and frost show on the body
    if (e.st && e.st.length) {
      let died = false;
      for (const st of e.st) {
        st.tick -= dt;
        if (st.tick <= 0) {
          st.tick = 1;
          const n = Math.max(1, Math.round(st.dps)); e.hp -= n; e.hitFlash = 0.08; G.net?.hit(e, n);
          floatText({ x: e.pos.x, z: e.pos.z, y: e.y + 1.7 * e.size }, `${n}`, st.type);
          if (e.hp <= 0) { killEnemy(e); died = true; break; }
        }
      }
      if (died) continue;
      e.st = e.st.filter(st => st.until > G.time);
      const top = e.y + (e.model.beast ? 1.1 : 1.8) * e.size;
      for (const st of e.st) {
        if (st.type === 'burn' && Math.random() < dt * 30) burst(e.pos.x + (Math.random() - 0.5) * 0.6 * e.size, e.y + Math.random() * (top - e.y), e.pos.z + (Math.random() - 0.5) * 0.6 * e.size, Math.random() < 0.5 ? 0xff7a2a : 0xffd060, 1, 0.8, 0.5, 0.16, -3);
        if (st.type === 'poison' && Math.random() < dt * 8) burst(e.pos.x, top, e.pos.z, 0x9ae03a, 1, 0.6, 0.8, 0.12, -1);
        if (st.type === 'bleed' && Math.random() < dt * 8) burst(e.pos.x, e.y + 1, e.pos.z, 0xa0101a, 1, 1, 0.5, 0.08, 8);
      }
    }
    const frozen = e.freezeUntil > G.time;
    if (frozen && Math.random() < dt * 6) burst(e.pos.x, e.y + 1, e.pos.z, 0xd8f4ff, 1, 0.5, 0.6, 0.1, 1);
    let speed = e.def.speed * 1.12 * (e.slowUntil > G.time ? 0.5 : 1) * (frozen ? 0.25 : 1);
    let mvx = 0, mvz = 0, pose = null, pt = 0;
    if (e.state === 'stunned') {
      e.stunned -= dt; pose = 'stun';
      if (e.stunned <= 0) e.state = e.aggro ? 'chase' : 'idle';
    } else if (e.state === 'windup') {
      e.atk.t += dt; pose = 'windup'; pt = e.atk.t / e.atk.wind;
      if (e.atk.t >= e.atk.wind) resolveAttack(e);
    } else if (e.state === 'charging') {
      const c = e.atk.charge; c.t += dt;
      const nx = e.pos.x + c.dx * 22 * dt, nz = e.pos.z + c.dz * 22 * dt;
      if (walkable(nx, nz)) { const [cx, cz] = collide(nx, nz, e.radius); e.pos.x = cx; e.pos.z = cz; }
      else c.t = c.dur;
      if (!c.hit && Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) < e.radius + 0.8) { c.hit = true; hurtPlayer(c.dmg, { x: e.pos.x, z: e.pos.z, lv: e.lv }); }
      for (const pet of G.pets) if (!pet.dead && !c.hitPets?.has(pet) && Math.hypot(pet.pos.x - e.pos.x, pet.pos.z - e.pos.z) < e.radius + pet.radius + 0.5) { (c.hitPets ||= new Set()).add(pet); hurtPet(pet, c.dmg); }
      pose = 'strike'; pt = 0.5; e.phase += dt * 20; e.move = 1;
      if (c.t >= c.dur) { e.atk = null; e.state = 'recover'; e.recover = 0.6; }
    } else if (e.state === 'recover') {
      e.recover -= dt; pose = e.strikeT > 0 ? 'strike' : null; pt = 1 - (e.strikeT || 0) / 0.25;
      e.strikeT -= dt;
      if (e.recover <= 0) e.state = e.aggro ? 'chase' : 'idle';
    } else if (e.state === 'return') {
      const hx = e.home.x - e.pos.x, hz = e.home.z - e.pos.z, hl = Math.hypot(hx, hz);
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * dt * 0.5);
      if (hl < 1.5) { e.state = 'idle'; e.hp = e.maxHp; }
      else { mvx = hx / hl; mvz = hz / hl; speed *= 1.3; }
    } else if (e.fearUntil > G.time) {
      // feared: run away from the player
      const fx = e.pos.x - P.pos.x, fz = e.pos.z - P.pos.z, fl = Math.hypot(fx, fz) || 1;
      mvx = fx / fl; mvz = fz / fl; speed *= 1.1;
      if (Math.random() < dt * 2) floatText({ x: e.pos.x, z: e.pos.z, y: e.y + 2 * e.size }, '!', 'warn');
    } else if (e.aggro) {
      e.state = 'chase';
      const T = targetOf(e);
      const dx = T.pos.x - e.pos.x, dz = T.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 0.01;
      const A = pickAttack(e, d);
      if (A) startAttack(e, A);
      else {
        const pref = e.def.ranged || 0;
        if (pref) {
          if (d > pref + 2) { mvx = dx / d; mvz = dz / d; }
          else if (d < pref - 4) { mvx = -dx / d; mvz = -dz / d; }
          else { mvx = -dz / d * e.strafe * 0.5; mvz = dx / d * e.strafe * 0.5; if (Math.random() < dt * 0.4) e.strafe *= -1; }
        } else if (d > 1.6 + e.radius) { mvx = dx / d; mvz = dz / d; }
        e.facing += angDiff(e.facing, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
      }
    } else if (e.march) {
      const m = G.warsMarch?.(e);
      if (m) { mvx = m[0]; mvz = m[1]; }
    } else {
      // wander
      e.wanderT -= dt;
      if (e.wanderT <= 0) { e.wanderT = rand(3, 7); const a = Math.random() * 6.28, r = Math.random() * 6; e.wander = Math.random() < 0.6 ? { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r } : null; }
      if (e.wander) {
        const wx = e.wander.x - e.pos.x, wz = e.wander.z - e.pos.z, wl = Math.hypot(wx, wz);
        if (wl < 0.6) e.wander = null; else { mvx = wx / wl; mvz = wz / wl; speed *= 0.3; }
      }
    }
    if (e.rootUntil > G.time && e.state !== 'return') { mvx = 0; mvz = 0; }
    if (mvx || mvz) {
      // separation
      for (const o of G.enemies) {
        if (o === e || o.dead) continue;
        const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, od = Math.hypot(ox, oz), m = e.radius + o.radius + 0.3;
        if (od < m && od > 0.01) { mvx += ox / od * 0.8; mvz += oz / od * 0.8; }
      }
      const ml = Math.hypot(mvx, mvz) || 1;
      const nx = e.pos.x + mvx / ml * speed * dt, nz = e.pos.z + mvz / ml * speed * dt;
      if (walkable(nx, nz)) { const [cx, cz] = collide(nx, nz, e.radius); e.pos.x = cx; e.pos.z = cz; }
      else e.wander = null;
      if (e.state !== 'chase' || !e.aggro) e.facing += angDiff(e.facing, Math.atan2(mvx, mvz)) * Math.min(1, dt * 8);
      e.phase += dt * speed * (e.model.beast ? 2.2 : 1.6) / Math.sqrt(e.size);
      e.move += (1 - e.move) * Math.min(1, dt * 8);
    } else if (e.state !== 'charging') e.move += (0 - e.move) * Math.min(1, dt * 8);
    animate(e, pose, pt);
    // boss bar
    if (G.boss === e) bossBar(e);
  }
}

function animate(e, pose, t) {
  e.lastPose = pose; e.lastT = t;
  e.y = heightAt(e.pos.x, e.pos.z);
  if (!e.dead || e.deadT < 1.5) e.root.position.set(e.pos.x, Math.max(e.y, -0.6), e.pos.z);
  e.root.rotation.y = e.facing;
  const two = e.def.weapon === 'club' || e.def.weapon === 'greatsword';
  if (e.model.beast) animBeast(e.model, { move: e.move, phase: e.phase, pose, t });
  else {
    let hp = pose;
    if (pose === 'strike') hp = 'slash';
    if (pose === 'windup' && (e.def.weapon === 'bow')) hp = 'aim';
    if (pose === 'windup' && !e.def.weapon && e.atk && ATTACKS[e.atk.id].kind === 'proj') hp = 'cast';
    if (pose === 'windup' && e.atk && (ATTACKS[e.atk.id].kind === 'summon' || (ATTACKS[e.atk.id].kind === 'aoe' && ATTACKS[e.atk.id].at === 'target'))) hp = 'cast';
    animHumanoid(e.model, { move: e.move, phase: e.phase, pose: hp, t, twoHand: two });
  }
  const f = e.hitFlash > 0 ? 0x552222 : e.freezeUntil > G.time ? 0x2a4a6a : e.st?.some(s => s.type === 'burn') ? 0x3a1400 : e.state === 'windup' ? 0x301000 : 0;
  for (const m of e.model.mats) m.emissive.setHex(f);
}

export function clearEnemies() {
  for (const e of [...G.enemies]) removeEnemy(e);
  for (const c of G.camps) { c.active = false; for (const s of c.slots) s.ent = null; }
}
