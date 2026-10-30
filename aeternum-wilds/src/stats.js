import { G } from './state.js';
import { CLASSES } from './classes.js';
import { classMods } from './skills.js';
import { LOADS, WEAPONS, MASTERY, ABILITIES, MATS, MAX_LEVEL, MAX_MASTERY, MAX_TRADE, xpForLevel, xpForMastery, xpForTrade, TRADES } from './data.js';
import { armorOf, equipLoad } from './items.js';
import { toast, banner, selfText, levelUpCelebration, abilityCelebration } from './ui.js';
import { kitUnlocksAt } from './skills.js';
import { burst } from './fx.js';
import { pillar } from './spellfx.js';
import { sfx } from './audio.js';

export function activeWeapon() {
  const e = G.p.equip;
  return G.p.activeW === 0 ? e.w1 : e.w2;
}
export function activeWType() { return activeWeapon()?.wtype || null; }

export function masteryNode(wtype, id) { return MASTERY[wtype].find(n => n.id === id); }
export function pointsSpent(wtype) { return G.p.mastery[wtype].nodes.length; }
export const masteryPoints = lv => lv - 1; // weapon points come only from weapon mastery levels
export function pointsFree(wtype) { const m = G.p.mastery[wtype]; return masteryPoints(m.lv) - m.nodes.length; }
export function canUnlock(wtype, id) {
  const m = G.p.mastery[wtype], n = masteryNode(wtype, id);
  if (m.nodes.includes(id)) return false;
  if (pointsFree(wtype) <= 0) return false;
  return pointsSpent(wtype) >= n.row * 3;
}
export function unlockNode(wtype, id) {
  if (!canUnlock(wtype, id)) return false;
  const m = G.p.mastery[wtype];
  m.nodes.push(id);
  if (ABILITIES[id]) { const i = m.slots.indexOf(null); if (i >= 0) m.slots[i] = id; abilityCelebration('New weapon ability', { id, kind: ABILITIES[id].kind }, ABILITIES[id].name, i >= 0 ? `On key <kbd>${i + 1}</kbd>` : ''); }
  G.statsDirty = true;
  return true;
}
export function resetTree(wtype) {
  const m = G.p.mastery[wtype];
  m.nodes = []; m.slots = [null, null, null];
  G.statsDirty = true;
}

// Final player stats, cached until something changes
export function computeStats() {
  const p = G.p;
  const a = { ...p.attrs };
  const s = {
    attrs: a, crit: 5, critDmg: 0.5, lifesteal: 0, cdr: 0, stamRegen: 0, moveSpeed: 0, gather: 0, corrupt: 0, beast: 0,
    heavy: 0, xp: 0, regen: 0, armorPct: 0, mods: {},
  };
  const all = Object.values(p.equip).filter(Boolean);
  const wActive = activeWeapon();
  for (const it of all) {
    if (it.kind === 'weapon' && it !== wActive) { for (const pk of it.perks) if (['str', 'dex', 'int', 'con'].includes(pk.id)) a[pk.id] += pk.v; continue; }
    for (const pk of it.perks) {
      const v = pk.v;
      switch (pk.id) {
        case 'str': case 'dex': case 'int': case 'con': a[pk.id] += v; break;
        case 'crit': s.crit += v; break;
        case 'lifesteal': s.lifesteal += v; break;
        case 'heavy': s.heavy += v / 100; break;
        case 'corrupt': s.corrupt += v / 100; break;
        case 'beast': s.beast += v / 100; break;
        case 'stamregen': s.stamRegen += v / 100; break;
        case 'speed': s.moveSpeed += v / 100; break;
        case 'armor': s.armorPct += v / 100; break;
        case 'gather': s.gather += v / 100; break;
        case 'cdr': s.cdr += v / 100; break;
        case 'xp': s.xp += v / 100; break;
        case 'regen': s.regen += v; break;
      }
    }
  }
  const food = p.food && p.food.until > p.stats.playTime ? MATS[p.food.id] : null;
  if (food) { a.con += food.con || 0; a.str += food.str || 0; a.dex += food.dex || 0; s.regen += food.regen || 0; }
  // mastery passives of the weapon in hand
  const wt = wActive?.wtype;
  if (wt) for (const id of p.mastery[wt].nodes) {
    const n = masteryNode(wt, id);
    if (n?.mods) for (const k in n.mods) s.mods[k] = (s.mods[k] || 0) + n.mods[k];
  }
  // class: starting attribute bonus plus skill tree passives
  const C = CLASSES[p.cls];
  if (C) for (const k in C.attrs) a[k] += C.attrs[k];
  const cm = classMods();
  for (const k in cm) s.mods[k] = (s.mods[k] || 0) + cm[k];
  s.load = G.p.equip ? equipLoad() : 'light';
  s.loadDmg = LOADS[s.load].dmg;
  if (LOADS[s.load].dr) s.mods.dr = (s.mods.dr || 0) + LOADS[s.load].dr;
  const m = s.mods;
  s.xp += m.xp || 0; s.stamRegen += m.stamRegen || 0; s.gather += m.gather || 0; s.armorPct += m.armorPct || 0; s.tradeXp = m.tradeXp || 0;
  s.crit += (a.dex - 5) * 0.15 + (m.crit || 0);
  s.critDmg += m.critDmg || 0;
  s.lifesteal += m.lifesteal || 0;
  s.cdr = Math.min(0.45, s.cdr + (a.int - 5) * 0.004 + (m.cdr || 0));
  s.moveSpeed += m.moveSpeed || 0;
  s.maxHp = Math.round((150 + p.level * 12 + a.con * 10) * (1 + (m.maxHpPct || 0)));
  s.regen += m.regen || 0;
  let armor = 0;
  for (const k of ['head', 'chest', 'hands', 'legs', 'feet']) armor += armorOf(p.equip[k]);
  s.armor = Math.round(armor * (1 + s.armorPct) + a.con * 2);
  // weapon damage multiplier from attributes
  s.attrMult = 1;
  if (wt) { const sc = WEAPONS[wt].scale; for (const k in sc) s.attrMult += sc[k] * (a[k] - 5) * 0.028; }
  s.abilityMult = 1 + (a.int - 5) * 0.012 + (m.abilityDmg || 0);
  G.stats = s;
  G.statsDirty = false;
  return s;
}
export function stats() { if (!G.stats || G.statsDirty) computeStats(); return G.stats; }

// ---------- XP ----------
export function gainXp(n, quiet) {
  const p = G.p;
  n = Math.round(n * (1 + stats().xp));
  if (p.level >= MAX_LEVEL) return;
  p.xp += n;
  if (!quiet) selfText(`+${n} XP`, 'xp');
  while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    p.attrPts += 3;
    if (p.skills) p.skills.points = (p.skills.points || 0) + 1; // level points go to the class trees
    G.statsDirty = true;
    const s = stats();
    G.player.hp = s.maxHp;
    levelUpCelebration(p.level, ['+3 attribute points (C)', 'Health restored']);
    for (const k of kitUnlocksAt(p.level)) abilityCelebration('New class ability', k.node, k.node.name, 'Equip it on <kbd>F</kbd> from the Abilities screen (<kbd>K</kbd>)');
    if (G.player) { burst(G.player.pos.x, G.player.y + 1, G.player.pos.z, 0xffe080, 40, 6, 1.2, 0.2, -3); pillar(G.player.pos.x, G.player.pos.z, 1.4, 0xffe27a, 14); }
    sfx('levelup');
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
}

export function gainMastery(wtype, n) {
  if (!wtype) return;
  const m = G.p.mastery[wtype];
  if (m.lv >= MAX_MASTERY) return;
  m.xp += Math.round(n);
  while (m.lv < MAX_MASTERY && m.xp >= xpForMastery(m.lv)) {
    m.xp -= xpForMastery(m.lv);
    m.lv++;
    abilityCelebration(`${WEAPONS[wtype].name} mastery ${m.lv}`, { id: wtype + '_pt', kind: 'buff', element: ({ sword: 'physical', greataxe: 'blood', hammer: 'physical', bow: 'nature', staff: 'fire', spear: 'physical', club: 'nature', rapier: 'physical', dagger: 'shadow', crossbow: 'nature', musket: 'fire', blunderbuss: 'fire' }[wtype] || 'physical') }, 'Weapon point earned', 'Unlock a weapon ability or bonus in <kbd>K</kbd> → Weapon Mastery');
    sfx('mastery');
  }
}

export function gainTrade(skill, n) {
  const t = G.p.trade[skill];
  if (t.lv >= MAX_TRADE) return;
  t.xp += Math.round(n * (1 + (stats().tradeXp || 0)));
  while (t.lv < MAX_TRADE && t.xp >= xpForTrade(t.lv)) {
    t.xp -= xpForTrade(t.lv);
    t.lv++;
    toast(`${TRADES[skill].icon} ${TRADES[skill].name} is now level ${t.lv}`, 'gold');
    sfx('mastery');
  }
}
