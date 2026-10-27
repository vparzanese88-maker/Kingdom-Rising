// Hero class abilities: buffs and curses, the shouts on R, the priest's healing and aiming helpers.
// Everything that changes health or buffs runs on the simulating browser (single player or host).
import * as THREE from 'three';
import { CLASSES } from './config.js';
import { allied } from './teams.js';

// ---------------------------------------------------------------- buffs
// entity.buffs = { [id]: { until, dur, dmg, ranged, guard, armor, haste, steady, weak, vuln } }
// Re-applying the same buff refreshes it; different buffs stack.
export function addBuff(g, ent, id, fx, dur) {
  if (!ent || !ent.alive) return;
  if (!ent.buffs) ent.buffs = {};
  ent.buffs[id] = { ...fx, until: g.time + dur, dur };
  g.buffed.add(ent);
}

export function buffSum(ent, key) {
  const b = ent && ent.buffs;
  if (!b) return 0;
  let s = 0;
  for (const id in b) s += b[id][key] || 0;
  return s;
}

// Damage dealt is scaled by the attacker's buffs and curses.
export function outgoingMult(attacker, info) {
  if (!attacker || !attacker.buffs) return 1;
  const up = buffSum(attacker, 'dmg') + (info.ranged || info.magic ? buffSum(attacker, 'ranged') : 0);
  return (1 + up) * (1 - Math.min(0.8, buffSum(attacker, 'weak')));
}

// Damage taken is scaled by the target's guard and vulnerability.
export function incomingMult(target) {
  if (!target || !target.buffs) return 1;
  return (1 + buffSum(target, 'vuln')) * (1 - Math.min(0.7, buffSum(target, 'guard')));
}

// 1 = empowered by an ally, 2 = cursed or marked. Sent to network clients so they can show it.
export function buffMask(ent) {
  const b = ent.buffs;
  if (!b) return 0;
  let m = 0;
  for (const id in b) {
    const x = b[id];
    if (x.weak || x.vuln) m |= 2;
    else m |= 1;
  }
  return m;
}

const GOOD = new THREE.Color(1.0, 0.78, 0.3);
const CURSED = new THREE.Color(0.7, 0.25, 1.0);
const tmpV = new THREE.Vector3();
const UP = new THREE.Vector3(0, 0.9, 0);

// Expire buffs and give buffed characters a faint glow so you can see who is empowered or cursed.
export function tickBuffs(g, dt) {
  for (const e of g.buffed) {
    if (!e.alive) { e.buffs = null; e.buffMask = 0; g.buffed.delete(e); continue; }
    if (e.buffs) {
      for (const id in e.buffs) if (e.buffs[id].until <= g.time) delete e.buffs[id];
      if (!Object.keys(e.buffs).length) e.buffs = null;
    }
    const mask = g.simulating ? (e.buffs ? buffMask(e) : 0) : e.buffMask || 0;
    if (!mask) { g.buffed.delete(e); continue; }
    if (e === g.player) continue; // your own glow would sit in your face
    if (e.lod !== undefined && e.lod >= 2) continue;
    if (Math.random() < dt * 9) {
      const c = e.chest(tmpV);
      c.x += (Math.random() - 0.5) * 0.7; c.z += (Math.random() - 0.5) * 0.7; c.y += (Math.random() - 0.5) * 1.1;
      g.fx.glow.emit(c, UP, mask & 2 ? CURSED : GOOD, 0.16, 0.7, { alpha: 0.85, grow: -0.1 });
    }
  }
}

// ---------------------------------------------------------------- targeting helpers
function eachNear(g, at, r, fn) {
  g.grid.query(at.x, at.z, r, (u) => {
    if (!u.alive || Math.hypot(u.pos.x - at.x, u.pos.z - at.z) > r) return;
    fn(u);
  });
}

function heal(g, u, amount) {
  if (!u.alive || u.hp >= u.maxHp) return;
  u.hp = Math.min(u.maxHp, u.hp + amount);
  g.fx.glow.burst(u.chest(new THREE.Vector3()), 6, new THREE.Color(0.5, 1.0, 0.55), 1.5, 0.22, 0.7, { grav: -2, alpha: 0.9 });
}

// March along a ray to the first character, wall or patch of ground. Returns { point, target }.
export function traceAim(g, from, dir, team, max = 90) {
  const p = new THREE.Vector3();
  for (let d = 1; d <= max; d += 0.6) {
    p.copy(from).addScaledVector(dir, d);
    const hit = g.projectiles.hitCharacter(p, team, 0.4);
    if (hit) return { point: p.clone(), target: hit };
    if (g.physics.pointHit(p.x, p.y, p.z, team) || p.y <= g.physics.terrainHeight(p.x, p.z)) return { point: p.clone(), target: null };
  }
  return { point: p.clone(), target: null };
}

// ---------------------------------------------------------------- shouts
// caster: a Player or an AI hero Unit with .cls. aim: the point they are aiming at (or null).
// Returns true when the shout went off.
export function useShout(g, caster, aim = null) {
  const c = CLASSES[caster.cls];
  if (!c || !caster.alive) return false;
  const s = c.shout;
  if (g.time < (caster.shoutReady || 0)) return false;
  const at = caster.pos;
  const team = caster.team;
  const friends = (fn) => eachNear(g, at, s.radius, (u) => { if (allied(u.team, team)) fn(u); });
  let count = 0;
  switch (s.id) {
    case 'rally': friends((u) => { addBuff(g, u, 'rally', { dmg: 0.3 }, s.dur); count++; }); break;
    case 'shieldwall': friends((u) => { addBuff(g, u, 'shieldwall', { guard: 0.35 }, s.dur); count++; }); break;
    case 'brace': friends((u) => { addBuff(g, u, 'brace', { armor: 5, steady: 1 }, s.dur); count++; }); break;
    case 'charge': friends((u) => { addBuff(g, u, 'charge', { haste: 0.35, dmg: 0.15 }, s.dur); count++; }); break;
    case 'volley': friends((u) => { addBuff(g, u, 'volley', { ranged: 0.4 }, s.dur); count++; }); break;
    case 'bless': friends((u) => { heal(g, u, 60); addBuff(g, u, 'bless', { dmg: 0.2 }, s.dur); count++; }); break;
    case 'curse':
      eachNear(g, at, s.radius, (u) => { if (!allied(u.team, team)) { addBuff(g, u, 'curse', { weak: 0.4, vuln: 0.15 }, s.dur); count++; } });
      break;
    case 'mark': {
      let target = null, bd = Infinity;
      const from = aim || at;
      eachNear(g, from, aim ? 5 : s.radius, (u) => {
        if (allied(u.team, team)) return;
        const d = Math.hypot(u.pos.x - from.x, u.pos.z - from.z) + (u.isHero ? -2 : 0);
        if (d < bd) { bd = d; target = u; }
      });
      if (!target && aim) eachNear(g, at, s.radius, (u) => {
        if (allied(u.team, team)) return;
        const d = Math.hypot(u.pos.x - at.x, u.pos.z - at.z);
        if (d < bd) { bd = d; target = u; }
      });
      if (!target) { if (caster.notify) caster.notify('Nobody to mark. Aim at an enemy.'); return false; }
      addBuff(g, target, 'mark', { vuln: 0.4 }, s.dur);
      g.fx.ring(target.pos, 2.2, s.color);
      count = 1;
      break;
    }
    case 'meteor': {
      const to = aim ? aim.clone() : at.clone();
      const dx = to.x - at.x, dz = to.z - at.z, dl = Math.hypot(dx, dz);
      if (dl > 80) { to.x = at.x + (dx / dl) * 80; to.z = at.z + (dz / dl) * 80; }
      to.y = g.physics.groundHeight(to.x, to.z, to.y + 2);
      const from = to.clone().add(new THREE.Vector3(-12, 46, 8));
      const vel = to.clone().sub(from).normalize().multiplyScalar(52);
      const mult = caster.dmgMult || 1;
      g.projectiles.fireSpell('fireball', from, vel, team, s.dmg * mult, caster, s.radius);
      g.fx.ring(to, s.radius, s.color);
      count = 1;
      break;
    }
    default: return false;
  }
  caster.shoutReady = g.time + s.cd;
  if (s.id !== 'mark' && s.id !== 'meteor') g.fx.ring(at, s.radius, s.color);
  g.audio.play('shout', at);
  if (caster.notify) {
    const who = s.id === 'curse' ? `${count} ${count === 1 ? 'enemy' : 'enemies'} cursed` : s.id === 'mark' || s.id === 'meteor' ? '' : `${count} ${count === 1 ? 'ally' : 'allies'} empowered`;
    caster.notify(`${s.name}!${who ? ' ' + who + '.' : ''}`);
  }
  return true;
}

// The priest's right-click: heal yourself and everyone on your side close by.
export function healPulse(g, caster) {
  const h = CLASSES[caster.cls] && CLASSES[caster.cls].heal;
  if (!h || !caster.alive) return false;
  let self = false;
  eachNear(g, caster.pos, h.radius, (u) => { if (allied(u.team, caster.team)) { heal(g, u, h.amount); if (u === caster) self = true; } });
  if (!self) heal(g, caster, h.amount);
  g.fx.ring(caster.pos, h.radius, 0x7dffa0);
  g.audio.play('heal', caster.pos);
  return true;
}
