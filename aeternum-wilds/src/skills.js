// Class skill trees: points, passives, mana and casting class abilities.
import * as THREE from 'three';
import { G } from './state.js';
import { CLASSES } from './classes.js';
import { gearScore } from './items.js';
import { hitEnemy, healPlayer, spawnProj } from './player.js';
import { enemiesNear, stunEnemy, interruptEnemy, knockEnemy } from './enemies.js';
import { impact, lightning, meteor, dome, totemMesh, elColor } from './spellfx.js';
import { castFx } from './combatfx.js';
import { walkable, collide } from './world.js';
import { stats, activeWeapon } from './stats.js';
import { spawnPet, petCount } from './pets.js';
import { telegraph, burst, shockRing, shake, later } from './fx.js';
import { heightAt } from './world.js';
import { toast, selfText, refreshHud } from './ui.js';
import { sfx } from './audio.js';
import { angDiff } from './util.js';

// ---- Class kit: one class ability on F. A signature ability from the start, a new one at levels 3, 5, 7 and 9;
// the player picks which one is equipped. (The older three-tree data in classes.js is still where abilities live.)
export const KIT_LEVELS = [1, 3, 5, 7, 9];
export const KITS = {
  warrior: ['war_quake', 'war_charge', 'war_whirl', 'war_shieldwall', 'war_execute'],
  cleric: ['clr_hammer', 'clr_mend', 'clr_consecrate', 'clr_miracle', 'clr_wrath'],
  paladin: ['pal_heavensfall', 'pal_divinestorm', 'pal_divineshield', 'pal_holychain', 'pal_layhands'],
  ranger: ['rng_volley', 'rng_multishot', 'rng_firetrap', 'rng_wolf', 'rng_hawkeye'],
  shadowknight: ['sk_lifetap', 'sk_horror', 'sk_crimsonleap', 'sk_raise', 'sk_harvest'],
  druid: ['dru_skystrike', 'dru_entangle', 'dru_treant', 'dru_bearform', 'dru_tempest'],
  monk: ['mnk_dragon', 'mnk_flykick', 'mnk_shadowless', 'mnk_quake', 'mnk_hundred'],
  bard: ['brd_sonicboom', 'brd_warsong', 'brd_lull', 'brd_echo', 'brd_cacophony'],
  rogue: ['rog_ambush', 'rog_flurry', 'rog_knives', 'rog_shadowdance', 'rog_deathmark'],
  shaman: ['sha_chain', 'sha_wolf', 'sha_healtotem', 'sha_stormtotem', 'sha_earthquake'],
  necromancer: ['nec_flameskel', 'nec_siphonlife', 'nec_skeleton', 'nec_plaguecomet', 'nec_legion'],
  wizard: ['wiz_meteor', 'wiz_chain', 'wiz_frostnova', 'wiz_blink', 'wiz_firestorm'],
  magician: ['mag_fireelem', 'mag_boulder', 'mag_imp', 'mag_impswarm', 'mag_golem'],
  enchanter: ['enc_hypnochain', 'enc_ghosts', 'enc_massmez', 'enc_prismvolley', 'enc_shatter'],
  beastlord: ['bst_bear', 'bst_frenzy', 'bst_ravens', 'bst_frostfang', 'bst_rampage'],
  berserker: ['ber_bloodwhirl', 'ber_skullsplit', 'ber_hurlaxes', 'ber_berserk', 'ber_carnage'],
  musketeer: ['msk_deadeye', 'msk_volley', 'msk_grenade', 'msk_powderkeg', 'msk_cannonade'],
  blunderbuss: ['blb_dragonbreath', 'blb_bootkick', 'blb_rocket', 'blb_chainshot', 'blb_bigboom'],
};
const KIT_CD_CAP = 22; // the one class ability should come around often

export function classDef(p = G.p) { return CLASSES[p.cls] || CLASSES.warrior; }
export function skillNode(id, p = G.p) { for (const t of classDef(p).trees) for (const n of t.nodes) if (n.id === id) return { ...n, tree: t.id, cd: Math.min(n.cd, KIT_CD_CAP) }; return null; }
export function kit(p = G.p) { return (KITS[p.cls] || KITS.warrior).map((id, i) => ({ id, level: KIT_LEVELS[i], node: skillNode(id, p) })); }
export function kitUnlocked(p = G.p) { return kit(p).filter(k => p.level >= k.level).map(k => k.id); }
export function ensureSkills(p = G.p) {
  if (!p.skills) p.skills = {};
  const sk = p.skills;
  const have = kitUnlocked(p);
  if (!have.includes(sk.equipped)) sk.equipped = have[0];
  sk.points = 0;
  return sk;
}
export function equipClassAbility(id) { if (kitUnlocked().includes(id)) { G.p.skills.equipped = id; return true; } return false; }
// abilities unlocked by reaching exactly this level (for the "new ability" celebration)
export function kitUnlocksAt(level, p = G.p) { return kit(p).filter(k => k.level === level); }
export const rankOf = id => (kitUnlocked().includes(id) ? 1 : 0);
export function resetSkills() { ensureSkills(); }
// class passives were retired with the trees
export function classMods() { return {}; }

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

function targetEnemy(range = 28, from = null) {
  const P = G.player;
  if (!from && G.input.aimEnemy && !G.input.aimEnemy.dead) return G.input.aimEnemy;
  let best = null, bs = 1e9;
  for (const e of enemiesNear(P.pos.x, P.pos.z, range)) {
    if (e.dead) continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    const off = Math.abs(angDiff(P.yaw, Math.atan2(dx, dz)));
    if (d > range || off > 0.7) continue;
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
// burning, freezing, bleeding and poison from any damaging ability
export function applyStatuses(e, n) {
  if (e.dead) return;
  const sp = spellPower(), dm = 1 + (stats().mods.dotDmg || 0);
  const add = (type, total, dur) => { e.st = (e.st || []).filter(x => x.type !== type); e.st.push({ type, dps: total * sp * dm / dur, until: G.time + dur, tick: 0 }); };
  if (n.burn) add('burn', n.burn, 4);
  if (n.bleed) add('bleed', n.bleed, 6);
  if (n.poison) add('poison', n.poison, 6);
  if (n.freeze) { e.freezeUntil = G.time + (e.def.boss ? n.freeze * 0.4 : n.freeze); }
}
// weapon-style damage for melee kinds when holding a melee weapon, spell damage otherwise
function abilityHit(e, mult, n, extra = {}) {
  const w = activeWeapon(), melee = w && w.wtype !== 'staff' && w.wtype !== 'bow';
  const d = (n.weaponBased ?? melee) ? hitEnemy(e, mult, 'ability', { stun: n.stun, slow: n.slow, knock: n.knock, ...extra }) : spellHit(e, mult, { stun: n.stun, slow: n.slow, knock: n.knock, ...extra });
  applyStatuses(e, n);
  return d;
}
function inRadius(x, z, r) { return enemiesNear(x, z, r + 2).filter(e => !e.dead && Math.hypot(e.pos.x - x, e.pos.z - z) < r + e.radius); }

export function castSkill() {
  const P = G.player;
  const id = ensureSkills().equipped;
  if (!id) return;
  const n = skillNode(id);
  if (!n || !rankOf(id)) return;
  const s = stats();
  if (['dodge', 'ability', 'dead', 'stunned', 'gather'].includes(P.state)) return;
  const ready = (P.cds['cls_' + id] || 0) - G.time;
  if (ready > 0) { selfText(`${Math.ceil(ready)}s`, 'warn'); return; }
  if (P.mana < n.cost) { selfText('Not enough mana', 'warn'); return; }
  const el = n.element || 'arcane';
  const col = n.color ?? elColor(el);
  // target checks before spending mana
  if (n.kind === 'dot' || n.kind === 'chain') { if (!targetEnemy()) { selfText('No target', 'warn'); return; } }
  P.mana -= n.cost;
  const cd = n.cd * (1 - s.cdr);
  P.cds['cls_' + id] = G.time + cd;
  P.cdMax = P.cdMax || {}; P.cdMax['cls_' + id] = cd;
  P.atk = null; P.press = null; P.draw = 0;
  const hx = P.pos.x + Math.sin(P.yaw) * 0.6, hy = P.y + 1.4 * (P.h.size || 1), hz = P.pos.z + Math.cos(P.yaw) * 0.6;
  const cast = (dur = 0.35, pose = 'cast') => { P.state = 'ability'; P.ability = { id, A: { kind: 'cast' }, t: 0, dur, pose }; };
  castFx(P, el); // hand glow, magic circle, element motes and the cast sound
  const shot = (dx, dy, dz, extra = {}) => spawnProj({ owner: 'player', element: el, x: hx, y: hy, z: hz, dx, dy, dz, speed: n.speed || 36, range: 40, color: col, el, size: 0.32, pierce: !!n.pierce, explode: n.explode || 0,
    onHit: (e, splash) => { abilityHit(e, n.dmg * (splash ? 0.7 : 1), n); if (!splash) { impact(el, e.pos.x, e.y + 1, e.pos.z, n.explode || 1); sfx('impact_' + el, 0.7); } }, ...extra });
  const aimVec = () => { const a = G.input.aimPoint; return a ? [a.x - hx, a.y - hy, a.z - hz] : [Math.sin(P.yaw), 0, Math.cos(P.yaw)]; };
  switch (n.kind) {
    case 'bolt': {
      cast(0.3, 'thrust');
      shot(...aimVec());
      break;
    }
    case 'volley': {
      cast(0.35, 'thrust');
      const [vx, vy, vz] = aimVec(), base = Math.atan2(vx, vz), l = Math.hypot(vx, vz) || 1;
      const cnt = n.count || 5, spread = (n.spread || 30) * Math.PI / 180;
      for (let i = 0; i < cnt; i++) { const a2 = base + (cnt === 1 ? 0 : (i / (cnt - 1) - 0.5) * spread); shot(Math.sin(a2), vy / l, Math.cos(a2), { size: 0.22 }); }
      break;
    }
    case 'chain': {
      cast(0.35, 'thrust');
      let cur = targetEnemy(), from = { x: hx, y: hy, z: hz }, mult = n.dmg;
      const hit = new Set();
      for (let i = 0; i <= (n.bounces || 3) && cur; i++) {
        hit.add(cur);
        const to = { x: cur.pos.x, y: cur.y + 1.1 * cur.size, z: cur.pos.z };
        lightning(from, to, col);
        abilityHit(cur, mult, n);
        impact(el === 'lightning' ? 'arcane' : el, to.x, to.y, to.z, 0.8);
        from = to; mult *= 0.85;
        let nxt = null, bd = n.range || 8;
        for (const e of enemiesNear(cur.pos.x, cur.pos.z, bd + 2)) { if (e.dead || hit.has(e)) continue; const d = Math.hypot(e.pos.x - cur.pos.x, e.pos.z - cur.pos.z); if (d < bd) { bd = d; nxt = e; } }
        cur = nxt;
      }
      sfx('thunder', 0.7);
      break;
    }
    case 'nova': {
      cast(0.4, 'slam');
      impact(el, P.pos.x, P.y + 1, P.pos.z, n.radius);
      shockRing(P.pos.x, P.pos.z, n.radius, col, 0.45); shake(0.25); sfx('impact_' + el); sfx('boom', 0.5);
      for (const e of inRadius(P.pos.x, P.pos.z, n.radius)) abilityHit(e, n.dmg, n);
      break;
    }
    case 'rain': case 'meteor': {
      cast(0.4);
      const [x, z] = aimPoint(n.range || 20);
      const delay = n.delay || (n.kind === 'meteor' ? 1.2 : 0.8);
      telegraph({ shape: 'circle', x, z, r: n.radius, dur: delay, color: 0x4ab0ff });
      const land = () => {
        impact(el, x, heightAt(x, z) + 0.5, z, n.radius);
        shockRing(x, z, n.radius, col, 0.45); sfx(n.kind === 'meteor' ? 'explosion' : 'impact_' + el); shake(n.kind === 'meteor' ? 0.5 : 0.2);
        for (const e of inRadius(x, z, n.radius)) abilityHit(e, n.dmg, n);
      };
      if (n.kind === 'meteor') { meteor(x, z, delay, col, land); sfx('meteor', 0.8); }
      else later(delay, land);
      break;
    }
    case 'drain': {
      cast(0.5);
      shockRing(P.pos.x, P.pos.z, n.radius, col, 0.6);
      dome(P.pos.x, P.y + 1, P.pos.z, n.radius, col, 0.6);
      let total = 0;
      for (const e of inRadius(P.pos.x, P.pos.z, n.radius)) {
        total += abilityHit(e, n.dmg, { ...n, weaponBased: false }) || 0;
        for (let i = 0; i < 6; i++) later(i * 0.05, () => burst(e.pos.x + (P.pos.x - e.pos.x) * i / 6, e.y + 1.2, e.pos.z + (P.pos.z - e.pos.z) * i / 6, col, 3, 0.8, 0.4, 0.15, 0));
      }
      if (total) later(0.3, () => healPlayer(total * (n.heal || 0.5) * (1 + (s.mods.healPower || 0))));
      break;
    }
    case 'dot': {
      cast(0.35);
      const t = targetEnemy();
      const list = [t];
      if (n.spread) for (const e of inRadius(t.pos.x, t.pos.z, 5)) if (e !== t) list.push(e);
      for (const e of list) { applyDot(e, n.dmg, n.dur || 8, col); applyStatuses(e, n); impact(el, e.pos.x, e.y + 1.2, e.pos.z, 0.8); }
      sfx('impact_' + el, 0.6);
      break;
    }
    case 'heal': {
      cast(0.45);
      healPlayer(stats().maxHp * n.heal * (1 + (s.mods.healPower || 0)));
      impact(el === 'holy' || el === 'nature' ? el : 'holy', P.pos.x, P.y + 0.2, P.pos.z, 1.2);
      sfx('heal');
      break;
    }
    case 'hot': {
      cast(0.35);
      P.hot = { perSec: stats().maxHp * n.heal * (1 + (s.mods.healPower || 0)) / (n.dur || 10), until: G.time + (n.dur || 10), color: col };
      burst(P.pos.x, P.y + 1.2, P.pos.z, col, 14, 2, 0.8, 0.1, -2);
      sfx('heal', 0.6);
      break;
    }
    case 'buff': case 'taunt': {
      cast(0.35);
      P.buffs = P.buffs.filter(b => b.id !== id);
      P.buffs.push({ id, until: G.time + (n.dur || 8), mods: n.buff || {}, icon: n.icon, name: n.name, color: col });
      dome(P.pos.x, P.y + 1, P.pos.z, 2.5, col, 0.5);
      burst(P.pos.x, P.y + 1.2, P.pos.z, col, 18, 4, 0.7);
      if (n.kind === 'taunt') {
        shockRing(P.pos.x, P.pos.z, n.radius || 8, 0xff6040, 0.4);
        for (const e of inRadius(P.pos.x, P.pos.z, n.radius || 8)) { e.aggro = true; e.petTarget = null; }
        sfx('roar', 0.5);
      } else sfx('shield', 0.6);
      G.statsDirty = true;
      break;
    }
    case 'shield': {
      cast(0.35);
      P.shield = { amt: stats().maxHp * n.heal * (1 + (s.mods.healPower || 0)), until: G.time + (n.dur || 10), color: col };
      dome(P.pos.x, P.y + 1, P.pos.z, 1.6, col, 0.6);
      sfx('shield');
      break;
    }
    case 'pet': {
      cast(0.6);
      const pd = n.pet;
      for (let i = 0; i < (pd.count || 1); i++) spawnPet(pd.type, { hp: pd.hp, dmg: pd.dmg, dur: pd.dur, ranged: pd.ranged, bomber: pd.bomber, explode: pd.explode, burn: pd.burn, id });
      impact(el, P.pos.x + Math.sin(P.yaw) * 2, P.y + 0.5, P.pos.z + Math.cos(P.yaw) * 2, 1.2);
      sfx('summon');
      break;
    }
    case 'stun': {
      cast(0.4, 'slam');
      const arc = (n.arc || 90) * Math.PI / 180;
      for (const e of inRadius(P.pos.x, P.pos.z, n.range)) {
        if (Math.abs(angDiff(P.yaw, Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z))) > arc / 2) continue;
        abilityHit(e, n.dmg || 0.5, { ...n, stun: n.stun || 1.5 });
      }
      impact(el, P.pos.x + Math.sin(P.yaw) * 2.5, P.y + 1, P.pos.z + Math.cos(P.yaw) * 2.5, 2);
      sfx('impact_' + el);
      break;
    }
    case 'mez': case 'root': {
      cast(0.4);
      const [x, z] = aimPoint(n.range || 20);
      impact(el, x, heightAt(x, z) + 1, z, n.radius || 4);
      shockRing(x, z, n.radius || 4, col, 0.6);
      for (const e of inRadius(x, z, n.radius || 4)) {
        if (n.kind === 'mez') { interruptEnemy(e, e.def.boss ? 1 : n.dur); e.mezzed = true; }
        else { if (n.dmg) abilityHit(e, n.dmg, n); e.rootUntil = G.time + (e.def.boss ? n.dur * 0.3 : n.dur); }
      }
      sfx('impact_' + el);
      break;
    }
    case 'fear': {
      cast(0.4, 'cast');
      impact(el, P.pos.x, P.y + 1, P.pos.z, n.radius || 7);
      shockRing(P.pos.x, P.pos.z, n.radius || 7, col, 0.6);
      for (const e of inRadius(P.pos.x, P.pos.z, n.radius || 7)) { if (n.dmg) abilityHit(e, n.dmg, n); if (!e.def.boss) { interruptEnemy(e, 0.05); e.fearUntil = G.time + (n.dur || 3); } }
      sfx('fear');
      break;
    }
    case 'dash': case 'leap': {
      const A = n.kind === 'dash'
        ? { kind: 'dash', dist: n.dist || 8, radius: 2.2, dmg: n.dmg || 1, stun: n.stun, knock: n.knock }
        : { kind: 'leap', max: n.range || 12, radius: n.radius || 3.5, dmg: n.dmg || 1.5 };
      const dx = Math.sin(P.yaw), dz = Math.cos(P.yaw);
      const onHit = e => { applyStatuses(e, n); impact(el, e.pos.x, e.y + 1, e.pos.z, 0.8); };
      const onLand = () => impact(el, P.pos.x, P.y + 0.3, P.pos.z, A.radius);
      if (A.kind === 'dash') { P.state = 'ability'; P.ability = { id, A, t: 0, dur: 0.38, dx, dz, speed: A.dist / 0.38, hit: new Set(), pose: 'thrust', onHit }; sfx('blink', 0.6); }
      else { const d = Math.min(A.max, G.input.aimDist ?? 8); P.state = 'ability'; P.ability = { id, A, t: 0, dur: 0.55, dx, dz, speed: d / 0.55, leap: true, pose: 'overhead', onHit, onLand }; sfx('jump'); }
      burst(P.pos.x, P.y + 1, P.pos.z, col, 10, 3, 0.4);
      break;
    }
    case 'blink': {
      const [tx, tz] = aimPoint(n.dist || 10);
      impact(el, P.pos.x, P.y + 1, P.pos.z, 1);
      // walk the path so we never land in the sea or inside a wall
      let bx = P.pos.x, bz = P.pos.z;
      const steps = 20;
      for (let i = 1; i <= steps; i++) {
        const x = P.pos.x + (tx - P.pos.x) * i / steps, z = P.pos.z + (tz - P.pos.z) * i / steps;
        if (!walkable(x, z)) break;
        const [cx, cz] = collide(x, z, 0.45);
        if (Math.hypot(cx - x, cz - z) > 0.3) break;
        bx = x; bz = z;
      }
      P.pos.x = bx; P.pos.z = bz;
      P.iframes = Math.max(P.iframes, 0.25);
      impact(el, bx, heightAt(bx, bz) + 1, bz, n.radius || 1.5);
      if (n.dmg) for (const e of inRadius(bx, bz, n.radius || 3)) abilityHit(e, n.dmg, n);
      sfx('blink');
      break;
    }
    case 'whirlwind': {
      P.whirl = { until: G.time + (n.dur || 2.5), next: G.time, gap: (n.dur || 2.5) / (n.ticks || 6), n, el, col };
      sfx('whirl');
      break;
    }
    case 'totem': {
      cast(0.4, 'slam');
      const [x, z] = aimPoint(4);
      const m = totemMesh(col);
      m.position.set(x, heightAt(x, z), z);
      G.scene.add(m);
      G.totems.push({ x, z, mesh: m, n, el, col, until: G.time + (n.dur || 12), next: G.time + 0.3 });
      impact(el, x, heightAt(x, z) + 0.5, z, 1.5);
      sfx('summon', 0.6);
      break;
    }
    case 'trap': {
      cast(0.3, 'slam');
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.1, 6, 16), new THREE.MeshBasicMaterial({ color: col }));
      m.rotation.x = -Math.PI / 2; m.position.set(P.pos.x, heightAt(P.pos.x, P.pos.z) + 0.15, P.pos.z);
      G.scene.add(m);
      G.traps.push({ x: P.pos.x, z: P.pos.z, mesh: m, n, el, col, until: G.time + 30 });
      break;
    }
    case 'cleanse': {
      cast(0.35);
      P.poison = null; P.slowUntil = 0;
      healPlayer(stats().maxHp * (n.heal || 0.1) * (1 + (s.mods.healPower || 0)));
      impact(el, P.pos.x, P.y + 1, P.pos.z, 1.2);
      sfx('heal', 0.6);
      break;
    }
    case 'strike': {
      P.state = 'ability'; P.ability = { id, A: { kind: 'cast' }, t: 0, dur: 0.45, pose: 'thrust' };
      later(0.15, () => {
        let hitAny = false;
        for (const e of inRadius(P.pos.x, P.pos.z, n.range || 3.5)) {
          if (Math.abs(angDiff(P.yaw, Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z))) > 0.75) continue;
          abilityHit(e, n.dmg || 2, { ...n, weaponBased: true });
          impact(el, e.pos.x, e.y + 1.1, e.pos.z, 1);
          hitAny = true;
        }
        if (hitAny) { shake(0.25); sfx('impact_' + el); G.hitstop = 0.06; }
      });
      sfx('heavy');
      break;
    }
    default: cast(0.3);
  }
  refreshHud();
}

// per-frame: mana, heal over time, shields, whirlwinds, totems, traps and status effects on enemies
export function updateSkills(dt) {
  const P = G.player;
  const mm = maxMana();
  if (P.mana == null) P.mana = mm;
  P.mana = Math.min(mm, P.mana + manaRegen() * dt);
  P.maxMana = mm;
  if (P.hot) { if (P.hot.until < G.time) P.hot = null; else { healPlayer(P.hot.perSec * dt, true); if (Math.random() < dt * 6) burst(P.pos.x, P.y + 0.5, P.pos.z, P.hot.color || 0x7aff7a, 2, 0.5, 0.9, 0.1, -2); } }
  if (P.shield && P.shield.until < G.time) P.shield = null;
  if (P.shield && Math.random() < dt * 8) burst(P.pos.x + (Math.random() - 0.5) * 1.4, P.y + 0.3 + Math.random() * 1.8, P.pos.z + (Math.random() - 0.5) * 1.4, P.shield.color || 0xe0e0ff, 1, 0.3, 0.5, 0.08, 0);
  for (const b of P.buffs) if (b.color && Math.random() < dt * 5) burst(P.pos.x, P.y + 0.2, P.pos.z, b.color, 1, 1, 0.8, 0.08, -2);
  // whirlwind: spin and hit everything around, you can still move
  if (P.whirl) {
    const w = P.whirl;
    if (G.time > w.until || P.state === 'dead') P.whirl = null;
    else if (G.time >= w.next) {
      w.next += w.gap;
      for (const e of inRadius(P.pos.x, P.pos.z, w.n.radius || 3)) abilityHit(e, w.n.dmg || 0.5, w.n);
      burst(P.pos.x, P.y + 1, P.pos.z, w.col, 8, 5, 0.3, 0.12, 0);
      sfx('whoosh_heavy', 0.5);
    }
  }
  for (let i = G.totems.length - 1; i >= 0; i--) {
    const t = G.totems[i];
    t.mesh.userData.orb.rotation.y += dt * 3;
    if (G.time > t.until) { impact(t.el, t.x, heightAt(t.x, t.z) + 1, t.z, 1); G.scene.remove(t.mesh); G.totems.splice(i, 1); continue; }
    if (G.time >= t.next) {
      t.next += t.n.interval || 1.2;
      shockRing(t.x, t.z, t.n.radius || 6, t.col, 0.6);
      burst(t.x, heightAt(t.x, t.z) + 2.3, t.z, t.col, 8, 2, 0.6, 0.12, 0);
      if (t.n.dmg) for (const e of inRadius(t.x, t.z, t.n.radius || 6)) abilityHit(e, t.n.dmg, { ...t.n, weaponBased: false });
      if (t.n.heal && Math.hypot(P.pos.x - t.x, P.pos.z - t.z) < (t.n.radius || 6)) healPlayer(stats().maxHp * t.n.heal * (1 + (stats().mods.healPower || 0)), true);
      if (t.n.slow) for (const e of inRadius(t.x, t.z, t.n.radius || 6)) e.slowUntil = G.time + t.n.slow;
    }
  }
  for (let i = G.traps.length - 1; i >= 0; i--) {
    const t = G.traps[i];
    t.mesh.rotation.z += dt * 2;
    const hits = inRadius(t.x, t.z, 1.2);
    if (G.time > t.until || hits.length) {
      G.scene.remove(t.mesh); G.traps.splice(i, 1);
      if (hits.length) {
        impact(t.el, t.x, heightAt(t.x, t.z) + 0.5, t.z, t.n.radius || 3);
        sfx('impact_' + t.el); sfx('boom', 0.5);
        for (const e of inRadius(t.x, t.z, t.n.radius || 3)) { abilityHit(e, t.n.dmg || 1, { ...t.n, weaponBased: false }); if (t.n.root) e.rootUntil = G.time + t.n.root; }
      }
    }
  }
}
