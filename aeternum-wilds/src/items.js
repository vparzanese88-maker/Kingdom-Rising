import { G } from './state.js';
import { RARITY, PERKS, WEAPONS, WEAPON_TYPES, ARMOR_SLOTS, ARMOR_NAMES, ARMOR_WEIGHT, ARMOR_CLASS, LOADS, MATS, SLOT_ICONS } from './data.js';
import { clamp, rand, randi, pick } from './util.js';

export const BAG_MAX = 36;

export const tierForGs = gs => gs < 220 ? 1 : gs < 380 ? 2 : 3;

export function rollRarity(bonus = 0) {
  const w = [50, 30, 14, 5, 1].map((v, i) => Math.max(0.2, v + bonus * [-10, -2, 5, 4, 1.2][i]));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}

function perkPool(item) {
  return Object.keys(PERKS).filter(id => {
    const p = PERKS[id];
    if (p.any) return true;
    if (item.kind === 'weapon') return !!p.weapon;
    if (item.slot === 'amulet') return !!p.amulet;
    return p.armor || p[item.slot];
  });
}

export function makeGear({ kind, wtype, slot, gs, rarity = 0, wclass }) {
  gs = Math.round(clamp(gs + RARITY[rarity].gs, 100, 600));
  const tier = tierForGs(gs);
  const item = { uid: G.p.nextId++, kind, gs, rarity, tier, perks: [] };
  if (kind === 'weapon') { item.wtype = wtype; item.slot = 'weapon'; }
  else { item.slot = slot; if (slot !== 'amulet') item.wclass = wclass || pick(['light', 'medium', 'heavy']); }
  const pool = perkPool(item);
  for (let i = 0; i < RARITY[rarity].perks && pool.length; i++) {
    const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    item.perks.push({ id, v: PERKS[id].v(gs) });
  }
  const base = kind === 'weapon' ? WEAPONS[wtype].tiers[tier - 1] : item.wclass ? armorName(item.wclass, slot, tier) : ARMOR_NAMES[slot][tier - 1];
  item.name = rarity === 4 ? `${PERKS[item.perks[0].id].prefix} ${base} of Aeternum` : rarity > 0 ? `${PERKS[item.perks[0].id].prefix} ${base}` : base;
  return item;
}

export function lootGs(level) { return clamp(Math.round(85 + level * 15 + rand(-25, 25)), 100, 590); }

export function randomDrop(level, rarityBonus = 0, minRarity = 0) {
  const rarity = Math.max(minRarity, rollRarity(rarityBonus));
  const gs = lootGs(level);
  if (Math.random() < 0.4) return makeGear({ kind: 'weapon', wtype: pick(WEAPON_TYPES), gs, rarity });
  return makeGear({ kind: 'armor', slot: pick([...ARMOR_SLOTS, 'amulet']), gs, rarity });
}

export function itemIcon(it) {
  if (it.kind === 'weapon') return WEAPONS[it.wtype].icon;
  return SLOT_ICONS[it.slot] || '❔';
}
export const armorName = (wc, slot, tier) => `${ARMOR_CLASS[wc].mats[tier - 1]} ${ARMOR_CLASS[wc].nouns[slot]}`;
export const armorOf = it => it && it.kind === 'armor' && it.slot !== 'amulet' ? Math.round(ARMOR_WEIGHT[it.slot] * it.gs * 0.5 * ARMOR_CLASS[it.wclass || 'medium'].armor) : 0;
// total equip load from worn armor
export function equipLoad() {
  let n = 0;
  for (const k of ARMOR_SLOTS) { const it = G.p.equip[k]; if (it) n += ARMOR_CLASS[it.wclass || 'medium'].load; }
  return n <= LOADS.light.max ? 'light' : n <= LOADS.medium.max ? 'medium' : 'heavy';
}
export function loadPoints() { let n = 0; for (const k of ARMOR_SLOTS) { const it = G.p.equip[k]; if (it) n += ARMOR_CLASS[it.wclass || 'medium'].load; } return n; }
export const weaponDmg = it => it ? Math.round(WEAPONS[it.wtype].dmg * it.gs / 100) : 0;
export const sellValue = it => Math.round(it.gs / 12 * (1 + it.rarity * 0.8));

export function addItem(it) {
  if (G.p.bag.length >= BAG_MAX) return false;
  G.p.bag.push(it);
  return true;
}
export function addMat(id, n) { if (n > 0) G.p.mats[id] = (G.p.mats[id] || 0) + n; }
export function matCount(id) { return G.p.mats[id] || 0; }
export function hasMats(req, times = 1) { for (const k in req) if (matCount(k) < req[k] * times) return false; return true; }
export function takeMats(req, times = 1) { for (const k in req) { G.p.mats[k] -= req[k] * times; if (G.p.mats[k] <= 0) delete G.p.mats[k]; } }

export function gearScore() {
  const e = G.p.equip;
  const list = ['w1', 'w2', 'head', 'chest', 'hands', 'legs', 'feet', 'amulet'].map(k => e[k] ? e[k].gs : 100);
  return Math.round(list.reduce((a, b) => a + b, 0) / list.length);
}

export function equipSlotFor(it) {
  if (it.kind === 'weapon') {
    const e = G.p.equip;
    if (!e.w1) return 'w1';
    if (!e.w2) return 'w2';
    return G.p.activeW === 0 ? 'w1' : 'w2';
  }
  return it.slot;
}

export function matName(id) { return MATS[id]?.name || id; }
