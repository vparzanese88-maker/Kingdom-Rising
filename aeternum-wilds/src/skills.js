// Class skill trees: points, passives, mana and casting class abilities.
import * as THREE from 'three';
import { G } from './state.js';
import { CLASSES } from './classes.js';
import { stats } from './stats.js';
import { gearScore } from './items.js';
import { hitEnemy, healPlayer, spawnProj } from './player.js';
import { enemiesNear, stunEnemy, interruptEnemy, knockEnemy } from './enemies.js';
import { spawnPet, petCount } from './pets.js';
import { telegraph, burst, shockRing, shake, later } from './fx.js';
import { heightAt } from './world.js';
import { toast, selfText, refreshHud } from './ui.js';
import { sfx } from './audio.js';
import { angDiff } from './util.js';

export const SKILL_KEYS = ['KeyZ', 'KeyX', 'KeyC', 'KeyV'];
export const SKILL_LABELS = ['Z', 'X', 'C', 'V'];
export const TIER_REQ = [0, 1, 3, 5, 7]; // points spent in a tree to open each tier

export function classDef(p = G.p) { return CLASSES[p.cls] || CLASSES.warrior; }
export function allNodes(p = G.p) { return classDef(p).trees.flatMap(t => t.nodes.map(n => ({ ...n, tree: t.id }))); }
export function skillNode(id, p = G.p) { for (const t of classDef(p).trees) for (const n of t.nodes) if (n.id === id) return { ...n, tree: t.id }; return null; }
export function ensureSkills(p = G.p) {
  if (!p.skills) p.skills = { nodes: {}, bar: [null, null, null, null] };
  const spent = Object.values(p.skills.nodes).reduce((a, b) => a + b, 0);
  p.skills.points = Math.max(0, p.level - spent); // one point per level
  return p.skills;
}
export const rankOf = id => G.p.skills?.nodes[id] || 0;
export function spentInTree(treeId) {
  const t = classDef().trees.find(t => t.id === treeId);
  return t ? t.nodes.reduce((a, n) => a + rankOf(n.id), 0) : 0;
}
export function canLearn(id) {
  const n = skillNode(id); if (!n) return false;
  const sk = ensureSkills();
  if (sk.points <= 0) return false;
  if (rankOf(id) >= (n.type === 'active' ? 1 : n.max || 3)) return false;
  return spentInTree(n.tree) >= TIER_REQ[n.tier];
}
export function learn(id) {
  if (!canLearn(id)) return false;
  const sk = G.p.skills, n = skillNode(id);
  sk.nodes[id] = rankOf(id) + 1;
  if (n.type === 'active' && !sk.bar.includes(id)) { const i = sk.bar.indexOf(null); if (i >= 0) sk.bar[i] = id; }
  ensureSkills();
  G.statsDirty = true;
  return true;
}
export function resetSkills() { G.p.skills = { nodes: {}, bar: [null, null, null, null] }; ensureSkills(); G.statsDirty = true; }

// passive mods from the class tree (summed per rank)
export function classMods() {
  const out = {};
  const p = G.p; if (!p?.skills) return out;
  for (const t of classDef().trees) for (const n of t.nodes) {
    const r = rankOf(n.id);
    if (r && n.type === 'passive') for (const k in n.mods) out[k] = (out[k] || 0) + n.mods[k] * r;
  }
  return out;
}

// spell power: grows with level, gear score and your best attribute
export function spellPower() {
  const s = stats(), a = s.attrs;
  const best = Math.max(a.int, a.str * 0.85, a.dex * 0.85);
  return (12 + G.p.level * 3) * (0.5 + 0.5 * gearScore() / 100) * (1 + (best - 5) * 0.025) * (1 + (s.mods.spellDmg || 0));
}
export function maxMana() { const s = stats(); return Math.round((100 + s.attrs.int * 4 + G.p.level * 3) * (classDef().mana || 1) * (1 + (s.mods.maxManaPct || 0))); }
export function manaRegen() { const s = stats(); return 4 + s.attrs.int * 0.15 + (s.mods.manaRegen || 0); }

// damage an enemy with a spell
export function spellHit(e, mult, opts = {}) {
  return hitEnemy(e, mult, 'spell', { ...opts, spell: true });
}

function targetEnemy(range = 28) {
  const P = G.player;
  if (G.input.aimEnemy && !G.input.aimEnemy.dead) return G.input.aimEnemy;
  let best = null, bs = 1e9;
  for (const e of enemiesNear(P.pos.x, P.pos.z, range)) {
    if (e.dead) continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    const off = Math.abs(angDiff(P.yaw, Math.atan2(dx, dz)));
    if (d > range || off > 0.6) continue;
    const sc = d + off * 20;
    if (sc < bs) { bs = sc; best = e; }
  }
  return best;
}
function aimPoint(max) {
  const P = G.player, a = G.input.aimPoint;
  let x = a ? a.x : P.pos.x + Math.sin(P.yaw) * max, z = a ? a.z : P.pos.z + Math.cos(P.yaw) * max;
  const d = Math.hypot(x - P.pos.x, z - P.pos.z);
  if (d > max) { x = P.pos.x + (x - P.pos.x) / d * max; z = P.pos.z + (z - P.pos.z) / d * max; }
  return [x, z];
}
function applyDot(e, total, dur, color) {
  const s = stats();
  const dmg = total * spellPower() * (1 + (s.mods.dotDmg || 0));
  e.dot = { dps: dmg / dur, until: G.time + dur, tick: 0, color };
  e.aggro = true;
}

export function castSkill(slot) {
  const P = G.player;
  const id = G.p.skills?.bar[slot];
  if (!id) { toast('No class skill in that slot. Open your skills with T.'); return; }
  const n = skillNode(id);
  if (!n || !rankOf(id)) return;
  const s = stats();
  if (['dodge', 'ability', 'dead', 'stunned', 'gather'].includes(P.state)) return;
  const ready = (P.cds['cls_' + id] || 0) - G.time;
  if (ready > 0) { selfText(`${Math.ceil(ready)}s`, 'warn'); return; }
  if (P.mana < n.cost) { selfText('Not enough mana', 'warn'); return; }
  P.mana -= n.cost;
  const cd = n.cd * (1 - s.cdr);
  P.cds['cls_' + id] = G.time + cd;
  P.cdMax = P.cdMax || {}; P.cdMax['cls_' + id] = cd;
  P.atk = null; P.press = null; P.draw = 0;
  const col = n.color ?? 0x9ad0ff;
  const sp = spellPower();
  const cast = (dur = 0.35, pose = 'cast') => { P.state = 'ability'; P.ability = { id, A: { kind: 'cast' }, t: 0, dur, pose }; };
  sfx('magic', 0.7);
  switch (n.kind) {
    case 'bolt': {
      cast(0.3, 'thrust');
      const P2 = G.player, a = G.input.aimPoint;
      const ox = P2.pos.x + Math.sin(P2.yaw) * 0.6, oy = P2.y + 1.5 * (P2.h.size || 1), oz = P2.pos.z + Math.cos(P2.yaw) * 0.6;
      spawnProj({ owner: 'player', x: ox, y: oy, z: oz, dx: a ? a.x - ox : Math.sin(P2.yaw), dy: a ? a.y - oy : 0, dz: a ? a.z - oz : Math.cos(P2.yaw), speed: n.speed || 36, range: 40, color: col, size: 0.32, pierce: !!n.pierce, explode: n.explode || 0,
        onHit: (e, splash) => spellHit(e, n.dmg * (splash ? 0.7 : 1), { slow: n.slow, stun: n.stun }) });
      break;
    }
    case 'nova': {
      cast(0.4, 'slam');
      shockRing(P.pos.x, P.pos.z, n.radius, col, 0.45); burst(P.pos.x, P.y + 1, P.pos.z, col, 24, 7, 0.6); shake(0.25); sfx('boom', 0.6);
      for (const e of enemiesNear(P.pos.x, P.pos.z, n.radius + 2)) if (!e.dead && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < n.radius + e.radius) spellHit(e, n.dmg, { stun: n.stun, slow: n.slow, knock: n.knock });
      break;
    }
    case 'rain': {
      cast(0.4);
      const [x, z] = aimPoint(n.range || 20);
      telegraph({ shape: 'circle', x, z, r: n.radius, dur: n.delay || 0.8, color: 0x4ab0ff });
      later(n.delay || 0.8, () => {
        shockRing(x, z, n.radius, col, 0.45); burst(x, heightAt(x, z) + 0.5, z, col, 26, 7, 0.7); sfx('boom', 0.6); shake(0.2);
        for (const e of enemiesNear(x, z, n.radius + 2)) if (!e.dead && Math.hypot(e.pos.x - x, e.pos.z - z) < n.radius + e.radius) spellHit(e, n.dmg, { stun: n.stun, slow: n.slow });
      });
      break;
    }
    case 'drain': {
      cast(0.5);
      shockRing(P.pos.x, P.pos.z, n.radius, col, 0.6);
      let total = 0;
      for (const e of enemiesNear(P.pos.x, P.pos.z, n.radius + 2)) {
        if (e.dead || Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > n.radius + e.radius) continue;
        total += spellHit(e, n.dmg) || 0;
        // a stream of life flowing back to the caster
        for (let i = 0; i < 4; i++) later(i * 0.06, () => burst(e.pos.x + (P.pos.x - e.pos.x) * i / 4, e.y + 1.2, e.pos.z + (P.pos.z - e.pos.z) * i / 4, col, 3, 1, 0.4));
      }
      if (total) healPlayer(total * (n.heal || 0.5) * (1 + (s.mods.healPower || 0)));
      break;
    }
    case 'dot': {
      cast(0.35);
      const t = targetEnemy();
      if (!t) { toast('No target in front of you'); P.mana += n.cost; P.cds['cls_' + id] = 0; return; }
      const list = [t];
      if (n.spread) for (const e of enemiesNear(t.pos.x, t.pos.z, 6)) if (!e.dead && e !== t && Math.hypot(e.pos.x - t.pos.x, e.pos.z - t.pos.z) < 5) list.push(e);
      for (const e of list) { applyDot(e, n.dmg, n.dur || 8, col); burst(e.pos.x, e.y + 1.4, e.pos.z, col, 10, 2, 0.6); }
      break;
    }
    case 'heal': {
      cast(0.45);
      healPlayer(stats().maxHp * n.heal * (1 + (s.mods.healPower || 0)));
      burst(P.pos.x, P.y + 1.2, P.pos.z, col, 20, 3, 0.8, 0.12, -2);
      break;
    }
    case 'hot': {
      cast(0.35);
      P.hot = { perSec: stats().maxHp * n.heal * (1 + (s.mods.healPower || 0)) / (n.dur || 10), until: G.time + (n.dur || 10) };
      burst(P.pos.x, P.y + 1.2, P.pos.z, col, 14, 2, 0.8, 0.1, -2);
      break;
    }
    case 'buff': case 'taunt': {
      cast(0.35);
      P.buffs = P.buffs.filter(b => b.id !== id);
      P.buffs.push({ id, until: G.time + (n.dur || 8), mods: n.buff || {}, icon: n.icon, name: n.name });
      burst(P.pos.x, P.y + 1.2, P.pos.z, col, 18, 4, 0.7);
      if (n.kind === 'taunt') {
        shockRing(P.pos.x, P.pos.z, n.radius || 8, 0xff6040, 0.4);
        for (const e of enemiesNear(P.pos.x, P.pos.z, (n.radius || 8) + 2)) if (!e.dead) { e.aggro = true; e.petTarget = null; }
        sfx('roar', 0.5);
      }
      G.statsDirty = true;
      break;
    }
    case 'shield': {
      cast(0.35);
      P.shield = { amt: stats().maxHp * n.heal * (1 + (s.mods.healPower || 0)), until: G.time + (n.dur || 10) };
      burst(P.pos.x, P.y + 1.2, P.pos.z, col, 18, 3, 0.7);
      break;
    }
    case 'pet': {
      cast(0.6);
      const pd = n.pet;
      for (let i = 0; i < (pd.count || 1); i++) spawnPet(pd.type, { hp: pd.hp, dmg: pd.dmg, dur: pd.dur, ranged: pd.ranged, id });
      break;
    }
    case 'stun': {
      cast(0.4, 'slam');
      const arc = (n.arc || 90) * Math.PI / 180;
      for (const e of enemiesNear(P.pos.x, P.pos.z, n.range + 2)) {
        if (e.dead) continue;
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
        if (Math.hypot(dx, dz) > n.range + e.radius || Math.abs(angDiff(P.yaw, Math.atan2(dx, dz))) > arc / 2) continue;
        spellHit(e, n.dmg || 0.5, { stun: n.stun || 1.5 });
      }
      burst(P.pos.x + Math.sin(P.yaw) * 2, P.y + 1, P.pos.z + Math.cos(P.yaw) * 2, col, 16, 5, 0.5);
      break;
    }
    case 'mez': case 'root': {
      cast(0.4);
      const [x, z] = aimPoint(n.range || 20);
      shockRing(x, z, n.radius || 4, col, 0.6);
      burst(x, heightAt(x, z) + 1, z, col, 18, 2, 0.8);
      for (const e of enemiesNear(x, z, (n.radius || 4) + 2)) {
        if (e.dead || Math.hypot(e.pos.x - x, e.pos.z - z) > (n.radius || 4) + e.radius) continue;
        if (n.kind === 'mez') { interruptEnemy(e, e.def.boss ? 1 : n.dur); e.mezzed = true; }
        else { if (n.dmg) spellHit(e, n.dmg); e.rootUntil = G.time + (e.def.boss ? n.dur * 0.3 : n.dur); }
      }
      break;
    }
    case 'dash': case 'leap': {
      const A = n.kind === 'dash'
        ? { kind: 'dash', dist: n.dist || 8, radius: 2.2, dmg: n.dmg || 1, stun: n.stun, knock: n.knock }
        : { kind: 'leap', max: n.range || 12, radius: n.radius || 3.5, dmg: n.dmg || 1.5 };
      const dx = Math.sin(P.yaw), dz = Math.cos(P.yaw);
      if (A.kind === 'dash') { P.state = 'ability'; P.ability = { id, A, t: 0, dur: 0.38, dx, dz, speed: A.dist / 0.38, hit: new Set(), pose: 'thrust' }; }
      else { const d = Math.min(A.max, G.input.aimDist ?? 8); P.state = 'ability'; P.ability = { id, A, t: 0, dur: 0.55, dx, dz, speed: d / 0.55, leap: true, pose: 'overhead' }; }
      burst(P.pos.x, P.y + 1, P.pos.z, col, 10, 3, 0.4);
      break;
    }
    case 'cleanse': {
      cast(0.35);
      P.poison = null; P.slowUntil = 0;
      healPlayer(stats().maxHp * (n.heal || 0.1) * (1 + (s.mods.healPower || 0)));
      burst(P.pos.x, P.y + 1.2, P.pos.z, col, 16, 3, 0.7);
      break;
    }
    case 'strike': {
      P.state = 'ability'; P.ability = { id, A: { kind: 'cast' }, t: 0, dur: 0.45, pose: 'thrust' };
      later(0.15, () => {
        let hitAny = false;
        for (const e of enemiesNear(P.pos.x, P.pos.z, (n.range || 3.5) + 2)) {
          if (e.dead) continue;
          const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
          if (Math.hypot(dx, dz) > (n.range || 3.5) + e.radius || Math.abs(angDiff(P.yaw, Math.atan2(dx, dz))) > 0.7) continue;
          hitEnemy(e, n.dmg || 2, 'ability', { stun: n.stun });
          if (n.bleed) applyDot(e, n.bleed, 6, 0xb02020);
          hitAny = true;
        }
        burst(P.pos.x + Math.sin(P.yaw) * 2, P.y + 1.2, P.pos.z + Math.cos(P.yaw) * 2, col, hitAny ? 16 : 6, 4, 0.4);
        if (hitAny) shake(0.2);
      });
      sfx('heavy');
      break;
    }
    default: cast(0.3);
  }
  refreshHud();
}

// per-frame: mana, heal over time, shields
export function updateSkills(dt) {
  const P = G.player;
  const mm = maxMana();
  if (P.mana == null) P.mana = mm;
  P.mana = Math.min(mm, P.mana + manaRegen() * dt);
  P.maxMana = mm;
  if (P.hot) { if (P.hot.until < G.time) P.hot = null; else healPlayer(P.hot.perSec * dt, true); }
  if (P.shield && P.shield.until < G.time) P.shield = null;
}
