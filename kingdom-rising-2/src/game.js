// Game rules: hero stats, inventory, gear, loot, XP/levels, quests, crafting, gathering.
import { NEW_CLASSES } from './classes2.js';
import { STARTING_PAIR, levelGap, designLv, COMBOS, RMB_SPECIAL, QUEST_DROPS } from './data.js';
import { BATTLE, YARD } from './battlemap.js';
import { HOTBAR_KEYS, slotFits, CLASS_TREES, ULT_PTS, RACES, CLASSES, WEAPON_TYPES, TIERS, RARITY, ITEMS, TOOLS, RECIPES, QUESTS, NPCS, MOBS, ABILITIES, LEVEL_CAP, LEVEL_GROWTH, RANK2_LEVEL, xpForLevel, poolsAt, derived, weaponStat, weaponBaseDmg, armorBase, ARMOR_NAMES, ARMOR_TIER_NAMES, ARMOR_SLOT_LIST, AREA_UNLOCK_LEVEL, TOOL_TIER_NAMES, MERCHANT_STOCK, ACC, CLASS_TREE, WEAPON_TREE, MASTERY_CAP, masteryXpFor, FOOD_BUFFS, FOOD_TIME, DRINK_TIME, familiesOf, FAMILIES, partFamily } from './data.js';
import { G } from './state.js';
import { itemSvg } from './icons.js';
import { S } from './audio.js';
import { V } from './vfx.js';

export const INV_SIZE = 36, STACK = 99;
let uid = Date.now() % 1e6;

// ---------- new hero ----------
// main hand + off hand that fight together (sword + shield, mace + shield, sword + mace)
const ONE = ['sword', 'mace', 'dagger'];
export function pairedWt(h) {
  const a = h.equip.w1, b = h.equip.w2; if (!a || !b || !ONE.includes(a.wt)) return null;
  if (a.wt === 'dagger') return b.wt === 'dagger' ? 'daggers' : null;
  if (b.wt === 'shield') return a.wt === 'sword' ? 'swordshield' : 'maceshield';
  if (ONE.includes(b.wt)) return 'swordmace';
  return null;
}
export function activeWeapon(h) { const p = pairedWt(h); if (p) return Object.assign({}, h.equip.w1, { wt: p, paired: true, offTier: h.equip.w2.tier }); return h.equip[h.active]; }
// ---- two weapon sets ----
// Set 1 (w1 main hand, w2 off hand) is always the set in your hands; Set 2 (w3, w4) hangs on your back. Q trades them over.
export function swapSets(h) { const e = h.equip; [e.w1, e.w2, e.w3, e.w4] = [e.w3, e.w4, e.w1, e.w2]; h.active = 'w1'; h.setNo = h.setNo === 2 ? 1 : 2; }
export const setIsEmpty = (h) => !h.equip.w3 && !h.equip.w4;
// run an equip or unequip against Set 2 by trading the sets around it
function onSet2(h, fn) { swapSets(h); let r; try { r = fn(); } finally { swapSets(h); } G.hooks.gearChanged && G.hooks.gearChanged(); G.hooks.invChanged && G.hooks.invChanged(); return r; }
export function newHero(o) {
  const NC = NEW_CLASSES[o.cls], ncPair = NC && STARTING_PAIR[NC.start];
  const starter = { shaman: makeWeapon('spear', 0, 0), musketeer: makeWeapon('musket', 0, 0), berserker: makeWeapon('greataxe', 0, 0), warrior: makeWeapon('sword', 0, 0), ranger: makeWeapon('bow', 0, 0), wizard: makeWeapon('firestaff', 0, 0) }[o.cls];
  const h = {
    id: 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: o.name, race: o.race, cls: o.cls, sex: o.sex, app: o.app,
    raceV2: true, level: 1, xp: 0, gold: 5, timePlayed: 0, created: Date.now(), lastPlayed: Date.now(), zone: 'Driftwood Coast', introDone: false,
    pos: null, inv: new Array(INV_SIZE).fill(null), equip: Object.assign(emptyEquip(), NC ? { w1: makeWeapon(ncPair ? ncPair[0] : NC.start, 0, 0), w2: ncPair ? makeWeapon(ncPair[1], 0, 0) : null } : { w1: starter, w2: o.cls === 'warrior' ? makeWeapon('shield', 0, 0) : null }), ctree: {}, wm: {}, hotbar: [null, null, null, null, null, null],
    active: 'w1', tools: { hatchet: 0, pickaxe: 0, knife: 0 }, quests: { active: {}, done: [] }, dualKills: 0, kills: 0, belt: 'potion_heal',
  };
  // campaign heroes sail in wearing only a few tattered clothes
  if (!BATTLE) h.wseen = [activeWeapon(h) ? activeWeapon(h).wt : h.equip.w1.wt]; // the campaign: you start with your class's weapon and learn it by using it
  if (!BATTLE) { const rag = (slot, name) => Object.assign(makeArmor('cloth', slot, 0, 0), { name, armor: 1, stats: {}, rags: true }); h.equip.chest = rag('chest', 'Tattered Shirt'); h.equip.legs = rag('legs', 'Tattered Trousers'); }
  return h;
}

export const EQUIP_SLOTS = ['w1', 'w2', 'w3', 'w4', 'ranged', 'head', 'back', 'chest', 'arms', 'hands', 'waist', 'legs', 'feet', 'food', 'drink'];
const RETIRED = ['neck', 'shoulders', 'wrists', 'ring1', 'ring2', 'trinket'];
function emptyEquip() { const e = {}; for (const k of EQUIP_SLOTS) e[k] = null; return e; }
// bring older saves up to date
export function migrateHero(h) { if (h.wm) for (const k of Object.keys(h.wm)) if (WEAPON_TYPES[k]) { const f = familiesOf(k)[0]; if (!h.wm[f]) h.wm[f] = h.wm[k]; delete h.wm[k]; }
  if (h.quests) for (const id of Object.keys(h.quests.active || {})) if (!QUESTS.some(q => q.id === id)) delete h.quests.active[id]; // quests that are no longer in the world
  h.equip = Object.assign(emptyEquip(), h.equip || {}); h.ctree = h.ctree || {}; h.wm = h.wm || {}; h.hotbar = h.hotbar || [null, null, null, null, null, null];
  // talents became single-point passives: refund anything from the old trees
  const valid = new Set((CLASS_TREE[h.cls] || []).map(n => n.id));
  if (Object.entries(h.ctree).some(([k, v]) => v > 1 || !valid.has(k))) h.ctree = {};
  if (h.inv) { retireSlots(h); fixHands(h); }
  return h; }
// hotbar (keys 1-6): slots 1-3 hold class abilities (you choose which 3), slots 4-6 hold potions and food (filled as you find them)
export const HOTBAR_ITEMS = ['potion_heal', 'potion_heal2', 'bandage', 'crab_cake', 'roast_meat', 'herb_roast', 'hunter_stew', 'ember_skewer'];
export function autoFillHotbar(h) {
  // Kingdom Battles: 4 ability slots only (keys 1-4), chosen in the ability book (unchanged)
  if (G.hotbarSlots && BATTLE) {    const N = G.hotbarSlots, NI = G.itemSlots || 0, T = N + NI; if (!h.hotbar || h.hotbar.length !== T) h.hotbar = Array.from({ length: T }, (_, i) => (h.hotbar && h.hotbar[i] && (i < N) === (h.hotbar[i].t === 'ab')) ? h.hotbar[i] : null);
    const hb = h.hotbar; for (let i = 0; i < N; i++) if (hb[i] && (hb[i].t !== 'ab' || !ABILITIES[h.cls].some(a => a.id === hb[i].id && a.level <= h.level))) hb[i] = null;
    const added = [];
    for (const a of ABILITIES[h.cls].slice().sort((x, y) => x.level - y.level)) { if (h.level < a.level || hb.some(s => s && s.id === a.id)) continue; const i = hb.findIndex((s, k) => !s && k < N); if (i < 0) break; hb[i] = { t: 'ab', id: a.id }; added.push({ slot: i, t: 'ab', id: a.id }); }
    // campaign: the last slots hold potions and food, filled as you find them
    for (let i = N; i < T; i++) if (hb[i] && (hb[i].t !== 'item' || count(h, hb[i].id) <= 0)) hb[i] = null;
    for (const id of HOTBAR_ITEMS) { if (!NI || hb.some(s => s && s.t === 'item' && s.id === id) || count(h, id) <= 0) continue; const i = hb.findIndex((s, k) => !s && k >= N); if (i < 0) break; hb[i] = { t: 'item', id }; added.push({ slot: i, t: 'item', id }); }
    if (added.length) G.hooks.hotbarAdded && G.hooks.hotbarAdded(added);
    return;
  }
  // keys 1-5: buffs, songs and heals; F, C, Q: damage abilities (no food or drink slots for now)
  if (G.hotbarSlots) {
    const T = HOTBAR_KEYS.length, A = ABILITIES[h.cls];
    const old = (h.hotbar || []).filter(s => s && s.t === 'ab'); if (!h.hotbar || h.hotbar.length !== T) { h.hotbar = Array(T).fill(null); }
    const hb = h.hotbar;
    for (let i = 0; i < T; i++) { const sl = hb[i], a = sl && sl.t === 'ab' && A.find(x => x.id === sl.id); if (sl && (!a || !abilityKnown(h, a) || !slotFits(i, a))) hb[i] = null; }
    const added = [];
    const place = (a) => { if (!abilityKnown(h, a) || hb.some(s => s && s.id === a.id)) return; const i = hb.findIndex((s, k) => !s && slotFits(k, a)); if (i < 0) return; hb[i] = { t: 'ab', id: a.id }; added.push({ slot: i, t: 'ab', id: a.id }); };
    for (const s0 of old) { const a = A.find(x => x.id === s0.id); if (a) place(a); }
    for (const a of A.slice().sort((x, y) => x.level - y.level)) place(a);
    if (added.length) G.hooks.hotbarAdded && G.hooks.hotbarAdded(added);
    return;
  }
  if (!h.hotbar) h.hotbar = [null, null, null, null, null, null];
  const hb = h.hotbar;
  // keep abilities only in 1-3 and items only in 4-6
  for (let i = 0; i < 6; i++) if (hb[i] && ((i < 3) !== (hb[i].t === 'ab'))) hb[i] = null;
  for (let i = 0; i < 3; i++) if (hb[i] && hb[i].t === 'ab') { const A = ABILITIES[h.cls].find(x => x.id === hb[i].id); if (!A || !abilityKnown(h, A)) hb[i] = null; }
  const has = (t, id) => hb.some(s => s && s.t === t && s.id === id);
  const added = [];
  for (const a of ABILITIES[h.cls]) { if (has('ab', a.id) || !abilityKnown(h, a)) continue; const i = [0, 1, 2].find(k => !hb[k]); if (i == null) break; hb[i] = { t: 'ab', id: a.id }; added.push({ slot: i, t: 'ab', id: a.id }); }
  for (const id of HOTBAR_ITEMS) { if (has('item', id) || count(h, id) <= 0) continue; const i = [3, 4, 5].find(k => !hb[k]); if (i == null) break; hb[i] = { t: 'item', id }; added.push({ slot: i, t: 'item', id }); }
  if (added.length) G.hooks.hotbarAdded && G.hooks.hotbarAdded(added);
  return added;
}
export function setAbilitySlot(h, slot, id) {
  const hb = h.hotbar; const cur = hb.findIndex(s => s && s.t === 'ab' && s.id === id);
  if (cur >= 0) hb[cur] = hb[slot] && hb[slot].t === 'ab' ? hb[slot] : null;
  hb[slot] = { t: 'ab', id };
  G.hooks.gearChanged && G.hooks.gearChanged();
}

// ---------- items ----------
export function makeWeapon(wt, tier, rarity = 0, lvlHint) {
  const W = WEAPON_TYPES[wt], T = TIERS[tier], R = RARITY[rarity];
  const stats = rollStats(tier, rarity, weaponStat(wt));
  const name = (tier === 0 ? (W.kind === 'staff' ? 'Driftwood' : W.kind === 'bow' ? 'Driftwood' : 'Rusty') : T.name) + ' ' + W.name;
  const sz = W.kind === 'melee' && wt !== 'shield' && tier > 0 ? [0.88, 1, 1, 1.14][Math.floor(Math.random() * 4)] : 1;
  const szName = sz < 1 ? (wt.includes('dagger') ? 'Short ' : 'Light ') : sz > 1 ? (wt.includes('dagger') ? 'Long ' : 'Heavy ') : '';
  const it = { uid: ++uid, kind: 'weapon', wt, tier, rarity, name: szName + name, size: sz, dmg: Math.round(weaponBaseDmg(tier) * W.dmg * R.mult * Math.pow(sz, 0.9)), stats, lvl: tier === 0 ? 1 : T.lvl };
  ensureProc(it); return it;
}
const PROC_BY_KIND = { staff: ['flame', 'frost', 'storm', 'shadow'], bow: ['flame', 'frost', 'storm', 'venom'], gun: ['flame', 'storm', 'crush'], melee: ['flame', 'frost', 'storm', 'venom', 'crush', 'shadow'] };
export function ensureProc(it) {
  if (!it || it.kind !== 'weapon' || it.rarity < 2 || it.proc) return it;
  const W = WEAPON_TYPES[it.wt]; let pool = PROC_BY_KIND[W.kind] || PROC_BY_KIND.melee;
  if (W.kind === 'staff') pool = [it.wt === 'firestaff' ? 'flame' : it.wt === 'froststaff' ? 'frost' : it.wt === 'stormstaff' ? 'storm' : pool[Math.floor(Math.random() * pool.length)]];
  it.proc = pool[Math.floor(Math.random() * pool.length)]; return it;
}
export function makeArmor(akind, slot, tier, rarity = 0) {
  const R = RARITY[rarity];
  const main = akind === 'cloth' ? 'int' : akind === 'leather' ? 'dex' : 'str';
  const stats = rollStats(tier, rarity, main); stats.sta = (stats.sta || 0) + Math.max(1, Math.round(tier * 1.2 * (slot === 'chest' ? 1.3 : 1)));
  const name = ARMOR_TIER_NAMES[akind][tier] + ' ' + ARMOR_NAMES[akind][slot];
  return { uid: ++uid, kind: 'armor', akind, slot, tier, rarity, name, armor: Math.round(armorBase(tier, slot) * (akind === 'mail' ? 1.35 : akind === 'leather' ? 1.0 : 0.7) * R.mult), stats, lvl: TIERS[tier].lvl };
}
function rollStats(tier, rarity, main) {
  const st = {}; const keys = ['str', 'dex', 'int', 'sta'];
  if (tier > 0) st[main] = Math.round(1 + tier * 1.5);
  for (let i = 0; i < rarity; i++) { const k = Math.random() < 0.5 ? main : keys[Math.floor(Math.random() * 4)]; st[k] = (st[k] || 0) + Math.round(1 + tier * (0.8 + Math.random() * 0.8)); }
  return st;
}
export function makeAcc(slot, tier, rarity = 0) {
  const R = RARITY[rarity];
  const keys = ['str', 'dex', 'int', 'sta'];
  const st = {}; const n = 1 + rarity;
  for (let i = 0; i < n; i++) { const k = keys[Math.floor(Math.random() * 4)]; st[k] = (st[k] || 0) + Math.round(1 + tier * (0.9 + Math.random() * 0.7)); }
  const s2 = slot === 'ring1' || slot === 'ring2' ? 'ring' : slot;
  return { uid: ++uid, kind: 'acc', slot: s2, tier, rarity, name: ACC[s2].names[tier], stats: st, armor: s2 === 'back' ? Math.round((2 + tier * 2) * R.mult) : 0, lvl: TIERS[tier].lvl };
}
export function itemName(it) { return it.kind ? it.name : (ITEMS[it.id]?.name || it.id); }
export function itemValue(it) { if (it.kind) return Math.round((4 + it.tier * 10) * (1 + it.rarity * 0.8)); return ITEMS[it.id]?.value || 1; }
export function itemIcon(it) {
  if (it.kind === 'weapon') { const W = WEAPON_TYPES[it.wt]; return W.kind === 'bow' ? '🏹' : W.kind === 'staff' ? '🪄' : it.wt === 'daggers' || it.wt === 'dagger' ? '🗡' : it.wt === 'spear' ? '🔱' : it.wt.includes('axe') ? '🪓' : it.wt === 'warhammer' || it.wt === 'maceshield' ? '🔨' : '⚔'; }
  if (it.kind === 'armor') return { head: '⛑', shoulders: '🎽', chest: '🥋', wrists: '⌚', arms: '🦾', hands: '🧤', waist: '🎗', legs: '👖', feet: '🥾' }[it.slot];
  if (it.kind === 'acc') return { neck: '📿', back: '🧣', ring: '💍', trinket: '🔮' }[it.slot];
  return ITEMS[it.id]?.icon || '?';
}
export function randomGear(h, lvl, minRarity = 0) {
  const tier = Math.max(1, Math.min(5, Math.floor((lvl * LEVEL_GROWTH + 3) / 4)));
  const dl = designLv(lvl), r = Math.random();
  let rarity = dl < 5 ? (r < 0.85 ? 0 : 1) : dl < 10 ? (r < 0.55 ? 0 : r < 0.95 ? 1 : 2) : dl < 15 ? (r < 0.35 ? 0 : r < 0.85 ? 1 : 2) : (r < 0.2 ? 0 : r < 0.7 ? 1 : r < 0.95 ? 2 : 3);
  rarity = Math.min(4, Math.max(minRarity, rarity));
  const r2 = Math.random();
  if (r2 < 0.35) { const ws = CLASSES[h.cls].weapons; return makeWeapon(ws[Math.floor(Math.random() * ws.length)], tier, rarity); }
  if (r2 < 0.45) return makeAcc('back', tier, Math.max(1, rarity));
  return makeArmor(CLASSES[h.cls].armor, ARMOR_SLOT_LIST[Math.floor(Math.random() * ARMOR_SLOT_LIST.length)], tier, rarity);
}

// ---------- inventory ----------
export function count(h, id) { let n = 0; for (const s of h.inv) if (s && !s.kind && s.id === id) n += s.n; return n; }
export function addItem(h, id, n = 1, quiet) {
  let left = n;
  for (const s of h.inv) if (s && !s.kind && s.id === id && s.n < STACK) { const k = Math.min(left, STACK - s.n); s.n += k; left -= k; if (!left) break; }
  while (left > 0) { const i = h.inv.indexOf(null); if (i < 0) break; const k = Math.min(left, STACK); h.inv[i] = { id, n: k }; left -= k; }
  if (!quiet && n - left > 0) G.hooks.toast && G.hooks.toast(`+${n - left} ${ITEMS[id].name}`, itemSvg({ id }));
  if (left > 0) G.hooks.toast && G.hooks.toast('Your bag is full!', '⚠', 'bad');
  if (HOTBAR_ITEMS.includes(id)) autoFillHotbar(h);
  G.hooks.invChanged && G.hooks.invChanged();
  return n - left;
}
export function addGear(h, it, quiet) {
  const i = h.inv.indexOf(null); if (i < 0) { G.hooks.toast && G.hooks.toast('Your bag is full!', '⚠', 'bad'); return false; }
  h.inv[i] = it; if (!quiet && !BATTLE) G.hooks.toast && G.hooks.toast(it.name, itemSvg(it), 'r' + it.rarity);
  G.hooks.invChanged && G.hooks.invChanged(); return true;
}
export function removeItem(h, id, n) {
  for (let i = h.inv.length - 1; i >= 0 && n > 0; i--) { const s = h.inv[i]; if (s && !s.kind && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) h.inv[i] = null; } }
  G.hooks.invChanged && G.hooks.invChanged();
}

// ---------- stats ----------
export function heroStats(h) {
  const base = Object.assign({}, RACES[h.race].stats);
  for (const k of EQUIP_SLOTS) {
    const it = h.equip[k]; if (!it) continue;
    if (k === 'w3' || k === 'w4' || k === 'ranged') continue;
    if ((k === 'w1' || k === 'w2') && k !== h.active && !pairedWt(h)) continue;
    for (const s in it.stats) base[s] += it.stats[s];
  }
  return base;
}
export function heroDerived(h) {
  const st = heroStats(h), d = derived(st), P = poolsAt(h.cls, h.level);
  let armor = 0; for (const k of [...ARMOR_SLOT_LIST, 'back']) if (h.equip[k]) armor += h.equip[k].armor || 0;
  const w = activeWeapon(h);
  if (w && WEAPON_TYPES[w.wt].hands === 'shield') armor += 4 + w.tier * 4;
  armor = Math.round(armor * (1 + perk(h, 'armor') * 0.15));
  const res = 1 + perk(h, 'res') * 0.2;
  const F = consumBuff(h);
  return { stats: st, maxHp: Math.round((P.hp + d.hp + RACES[h.race].hp) * (1 + perk(h, 'hp') * 0.1 + (F.hp || 0))), maxMana: Math.round((P.mana + (P.mana > 0 ? d.mana : 0)) * (h.cls === 'wizard' ? res : 1)), maxEnd: Math.round((P.end + d.end) * (h.cls !== 'wizard' ? res : 1)), armor, crit: d.crit + (F.crit || 0) + perk(h, 'crit') * 0.06 + (w ? wperk(h, familiesOf(w.wt)[0], 'crit') * 0.03 : 0), meleeMul: d.meleeMul, rangedMul: d.rangedMul, spellMul: d.spellMul };
}
export function weaponDamage(h, w) {
  const D = heroDerived(h);
  const s = weaponStat(w.wt), mul = s === 'int' ? D.spellMul : s === 'dex' ? D.rangedMul : D.meleeMul;
  const mast = 1; // weapons no longer level up
  return mast * w.dmg * mul * (1 + (h.level - 1) * 0.05 * LEVEL_GROWTH) * (1 + perk(h, 'dmg') * 0.08 + (consumBuff(h).dmg || 0)) * (1 + wperk(h, familiesOf(w.wt)[0], 'wdmg') * 0.06) * (h.cls === 'wizard' && perk(h, 'cap') ? 1.15 : 1);
}

// ---------- skill trees ----------
export function perk(h, id) { if (h.yard && CLASS_TREES[h.cls] && CLASS_TREE[h.cls].some(n => n.id === id)) return 1; return (h.ctree && h.ctree[id]) || 0; }
export function wkind(fam) { return FAMILIES[fam] ? FAMILIES[fam].kind : 'melee'; }
export function wm(h, wt) { h.wm = h.wm || {}; return h.wm[wt] || (h.wm[wt] = { lv: 1, xp: 0, pts: {} }); }
export function wperk(h, wt, id) { return (h.wm && h.wm[wt] && h.wm[wt].pts[id]) || 0; }
const spent = (o) => Object.values(o).reduce((a, b) => a + b, 0);
export function classPoints(h) { if (CLASS_TREES[h.cls]) return Math.max(0, h.level) - spent(h.ctree || {}); return Math.max(0, h.level - 1) - spent(h.ctree || {}); }
// ---- skill trees (classes that have them unlock their abilities inside the trees) ----
export const hasTrees = (cls) => !BATTLE && !!CLASS_TREES[cls];
export const nodeOwned = (h, n) => !!(n.free || (h.ctree && h.ctree[n.id]) || h.yard);
export function treeSpent(h, tid) { const T = (CLASS_TREES[h.cls] || []).find(t => t.id === tid); return T ? T.nodes.filter(n => !n.free && h.ctree && h.ctree[n.id]).length : 0; }
export function nodeState(h, n) { // 'owned' | 'open' (can buy now) | 'ready' (next in line, need a point) | 'locked'
  if (nodeOwned(h, n)) return 'owned';
  const T = CLASS_TREES[h.cls].find(t => t.id === n.tree), reqOk = n.t === 'ult' ? treeSpent(h, T.id) >= ULT_PTS : !n.req || nodeOwned(h, T.nodes.find(x => x.id === n.req));
  if (!reqOk) return 'locked'; return classPoints(h) > 0 ? 'open' : 'ready'; }
export function abilityKnown(h, a) {
  if (h.yard) return true;
  if (!BATTLE && CLASS_TREES[h.cls]) { const n = CLASS_TREE[h.cls].find(x => x.t === 'ab' && x.ab === a.id); return !!n && nodeOwned(h, n); }
  return h.level >= a.level; }
export function weaponPoints(h, wt) { const m = wm(h, wt); return Math.max(0, m.lv - 1) - spent(m.pts); }
export function canSpend(tree, ptsObj, avail, node) { if (avail <= 0) return false; if ((ptsObj[node.id] || 0) >= node.max) return false; return spent(ptsObj) >= node.row * (tree === 'w' ? 3 : 2); }
export function spendClass(h, node) { if (CLASS_TREES[h.cls]) { if (nodeState(h, node) !== 'open') return false; h.ctree[node.id] = 1; G.hooks.gearChanged && G.hooks.gearChanged(); autoFillHotbar(h); return true; } if (!canSpend('c', h.ctree, classPoints(h), node)) return false; h.ctree[node.id] = (h.ctree[node.id] || 0) + 1; G.hooks.gearChanged && G.hooks.gearChanged(); return true; }
export function spendWeapon(h, wt, node) { const m = wm(h, wt); if (!canSpend('w', m.pts, weaponPoints(h, wt), node)) return false; m.pts[node.id] = (m.pts[node.id] || 0) + 1; G.hooks.gearChanged && G.hooks.gearChanged(); return true; }
export function resetClass(h) { h.ctree = {}; if (CLASS_TREES[h.cls] && h.hotbar) for (let i = 0; i < h.hotbar.length; i++) { const sl = h.hotbar[i]; if (sl && sl.t === 'ab' && !abilityKnown(h, { id: sl.id })) h.hotbar[i] = null; } G.hooks.gearChanged && G.hooks.gearChanged(); }
export function resetWeapon(h, wt) { wm(h, wt).pts = {}; G.hooks.gearChanged && G.hooks.gearChanged(); }
// ---------- weapon skills: what a weapon lets you do grows with its mastery (campaign) ----------
// melee: one strike to start, 2nd at mastery 2, 3rd and the hold attack at 3, 4th at 4, F special at 5, the finisher at 6
// bows and muskets shoot and draw from the start, F at 5; staffs tap-cast from the start, hold stream at 3, F at 5
export const WM_HOLD = 3, WM_F = 5;
export function stepReq(len, i) { if (i === len - 1 && len >= 3) return len >= 4 ? 6 : 4; return [1, 2, 3, 4, 6][i] || 6; }
export function masteryOf(h, wt) { return BATTLE || YARD ? 99 : Math.max(1, h.level || 1); } // no more weapon levels: weapons grow with your character level
export function comboLen(h, wt) { const C = COMBOS[wt]; return C ? C.chain.length : 0; } // the full light-attack chain from the start
export function canHold(h, wt) { return true; } // hold for a heavy attack from the start
export function speedOf(h, wt) { const lv = masteryOf(h, wt); return BATTLE || YARD ? 1 : 0.75 + 0.25 * Math.min(1, (lv - 1) / 19); } // a little slower at level 1 (75%), full speed at level 20
export function canSpecial(h, wt) { return masteryOf(h, wt) >= WM_F; }
// the unlock list for one weapon type, for the Weapons tab and level-up messages
export function weaponUnlocks(wt) {
  const W = WEAPON_TYPES[wt], C = COMBOS[wt], out = [];
  if (wt === 'dagger' || wt === 'daggers') { out.push({ lv: 1, what: wt === 'daggers' ? 'Left and right stabs' : 'Stab', key: 'Left click' }, { lv: 2, what: 'Chance of a lightning-fast double attack', key: 'Left click' }, { lv: 5, what: 'Chance of a triple attack', key: 'Left click' }, { lv: 9, what: 'Chance of a quadruple attack', key: 'Left click' }); }
  else out.push({ lv: 1, what: W.kind === 'melee' ? 'Light attacks and heavy attack' : W.kind === 'staff' ? 'Bolt and channel' : W.kind === 'gun' ? 'Shot, hold to aim' : 'Arrow, hold to draw', key: 'Left click' });
  if (RMB_SPECIAL[wt]) out.push({ lv: WM_F, what: 'Weapon special', key: 'F' });
  return out.sort((a, b) => a.lv - b.lv);
}
// a weapon held for the first time joins the Weapons tab
export function seeWeapon(h, wt) { if (!wt || BATTLE) return false; h.wseen = h.wseen || []; if (h.wseen.includes(wt)) return false; h.wseen.push(wt); return true; }
export function gainMastery(h, wt, n) {
  const m = wm(h, wt); if (m.lv >= MASTERY_CAP) return;
  const q0 = Math.floor(m.xp / masteryXpFor(m.lv) * 4); m.xp += n;
  { const q1 = Math.floor(Math.min(m.xp, masteryXpFor(m.lv) - 1) / masteryXpFor(m.lv) * 4); if (q1 > q0 && G.hooks.masteryTick) G.hooks.masteryTick(wt, m.lv, q1 * 25); }
  while (m.lv < MASTERY_CAP && m.xp >= masteryXpFor(m.lv)) { m.xp -= masteryXpFor(m.lv); m.lv++; G.hooks.masteryUp && G.hooks.masteryUp(wt, m.lv); }
}
export function spellPower(h) { const D = heroDerived(h); const w = activeWeapon(h); return (12 + (h.level - 1) * LEVEL_GROWTH * 5 + 5) * (h.cls === 'wizard' ? D.spellMul : Math.max(D.meleeMul, D.rangedMul)) * (w ? 1 + w.tier * 0.1 : 1); }
export function canEquip(h, it, slot) { if (it.kind === 'weapon' && it.wt === 'bow' && (slot === 'ranged' || slot === 'w3' || h.bowOk)) return true; if (it.kind === 'acc' && it.slot !== 'back') return false; return canEquip0(h, it); }
function canEquip0(h, it) { if (YARD) return it.kind !== 'acc' || it.slot === 'back'; if (it.kind === 'weapon') return CLASSES[h.cls].weapons.includes(it.wt) || (!BATTLE && (it.wt === 'daggers' || it.wt === 'dagger')); if (it.kind === 'acc') return true; return it.kind === 'armor' && it.akind === CLASSES[h.cls].armor; }
// hands: sword and mace are one-handed, a shield is off-hand only, everything else needs both hands
export function handsOf(wt) { return ONE.includes(wt) ? 'one' : wt === 'shield' ? 'off' : 'two'; }
export function isTwoHanded(it) { return !!it && it.kind === 'weapon' && handsOf(it.wt) === 'two'; }
const warn = (t) => { G.hooks.toast && G.hooks.toast(t, '⚠', 'bad'); S.error(); };
export function equipFromInv(h, idx, slot) {
  const it = h.inv[idx]; if (!it || !it.kind) return false;
  if (!canEquip(h, it, slot)) { warn(it.kind === 'acc' && it.slot !== 'back' ? 'That is no longer worn. Sell it to a merchant.' : `${CLASSES[h.cls].name}s can't use that.`); return false; }
  // (no level requirement: any gear can be worn at any level)
  let target = it.kind === 'weapon' ? 'w1' : it.slot;
  if (it.kind === 'acc' && it.slot === 'ring') target = slot === 'ring1' || slot === 'ring2' ? slot : (!h.equip.ring1 ? 'ring1' : !h.equip.ring2 ? 'ring2' : 'ring1');
  if (slot === 'ranged') slot = 'w3';
  if (slot === 'w3' || slot === 'w4') { if (it.kind !== 'weapon') { warn('Only weapons go in a weapon set.'); return false; } const bow = it.wt === 'bow'; return onSet2(h, () => { h.bowOk = bow; try { return equipFromInv(h, idx, slot === 'w4' ? 'w2' : 'w1'); } finally { h.bowOk = false; } }); }
  if (it.kind === 'weapon' && slot === 'ranged') { if (it.wt !== 'bow') { warn('Only bows go in the ranged slot.'); return false; } h.inv[idx] = h.equip.ranged || null; h.equip.ranged = it; S.swap(); G.hooks.gearChanged && G.hooks.gearChanged(); G.hooks.invChanged && G.hooks.invChanged(); return true; }
  if (it.kind === 'weapon') {
    const hd = handsOf(it.wt), main = h.equip.w1;
    if (hd === 'off' || (hd === 'one' && slot === 'w2')) {
      if (!main && hd === 'one') target = 'w1';
      else if (isTwoHanded(main)) { warn(`Your ${main.name} needs both hands. Hold a sword or mace in your main hand to use an off hand.`); return false; }
      else if (!main) { warn('Hold a sword or mace in your main hand before equipping a shield.'); return false; }
      else target = 'w2';
    } else if (hd === 'two' && h.equip.w2) {
      // the off-hand item goes back into the bag
      const free = h.inv.findIndex((x, i) => !x && i !== idx);
      const off = h.equip.w2;
      if (!main) { h.inv[idx] = off; h.equip.w2 = null; }
      else if (free < 0) { warn('Your bag is too full to put away your off-hand item.'); return false; }
      else { h.inv[free] = off; h.equip.w2 = null; }
      if (!main) { h.equip.w1 = it; h.active = 'w1'; S.swap(); G.hooks.gearChanged && G.hooks.gearChanged(); G.hooks.invChanged && G.hooks.invChanged(); checkEquipObjectives(h); return true; }
    }
  }
  if (slot && slot !== target && it.kind !== 'weapon') { warn(`That doesn't go in that slot.`); return false; }
  h.inv[idx] = h.equip[target] || null; h.equip[target] = it; if (target === 'w1' || target === 'w2') h.active = 'w1';
  S.swap(); G.hooks.gearChanged && G.hooks.gearChanged(); G.hooks.invChanged && G.hooks.invChanged();
  checkEquipObjectives(h);
  return true;
}
export function unequip(h, slot, toIdx) {
  if (!h.equip[slot]) return false;
  if (slot === 'w3' || slot === 'w4') return onSet2(h, () => { h.allowEmpty = true; try { return unequip(h, slot === 'w4' ? 'w2' : 'w1', toIdx); } finally { h.allowEmpty = false; } });
  if (slot === 'w1' && !h.allowEmpty && (!h.equip.w2 || h.equip.w2.wt === 'shield')) { warn('Keep at least one weapon in your main hand.'); return false; }
  const i = toIdx != null && !h.inv[toIdx] ? toIdx : h.inv.indexOf(null); if (i < 0) { warn('Your bag is full!'); return false; }
  const it = h.equip[slot];
  if (!it.kind) { h.equip[slot] = null; if (toIdx != null && !h.inv[toIdx]) h.inv[toIdx] = it; else addItem(h, it.id, it.n, true); }
  else { h.inv[i] = it; h.equip[slot] = null; }
  if (slot === 'w1') { if (h.equip.w2 && h.equip.w2.wt !== 'shield') { h.equip.w1 = h.equip.w2; h.equip.w2 = null; } }
  if (slot !== 'ranged' || h.active === 'ranged') h.active = 'w1';
  G.hooks.gearChanged && G.hooks.gearChanged(); G.hooks.invChanged && G.hooks.invChanged();
  return true;
}
// food and drink slots hold a stack that is used up one at a time as the buff runs out
export function equipConsumable(h, idx, slot) {
  const it = h.inv[idx]; if (!it || it.kind) return false;
  const F = FOOD_BUFFS[it.id]; if (!F) { warn("That isn't food or drink."); return false; }
  const want = F.drink ? 'drink' : 'food'; if (slot && slot !== want) { warn(F.drink ? 'That goes in the drink slot.' : 'That goes in the food slot.'); return false; }
  const cur = h.equip[want];
  if (cur && cur.id === it.id) { cur.n += it.n; h.inv[idx] = null; }
  else { h.inv[idx] = cur || null; h.equip[want] = it; }
  S.swap(); G.hooks.invChanged && G.hooks.invChanged(); G.hooks.gearChanged && G.hooks.gearChanged();
  return true;
}
// combined food + drink buff
export function consumBuff(h) {
  const out = {};
  for (const b of [h.food, h.drink]) if (b && b.t > 0 && FOOD_BUFFS[b.id]) for (const [k, v] of Object.entries(FOOD_BUFFS[b.id])) if (typeof v === 'number') out[k] = (out[k] || 0) + v;
  return out;
}
export function applyConsumable(h, id, quiet) {
  const F = FOOD_BUFFS[id]; if (!F) return;
  const k = F.drink ? 'drink' : 'food', time = F.drink ? DRINK_TIME : FOOD_TIME;
  const prev = h[k] && h[k].t > 0 && h[k].id !== id ? FOOD_BUFFS[h[k].id].name : null;
  h[k] = { id, t: time };
  if (!quiet) G.hooks.toast && G.hooks.toast(`${F.name}: ${F.desc} for ${Math.round(time / 60)} min${prev ? ` (replaces ${prev})` : ''}`, itemSvg({ id }), 'gold');
  G.hooks.gearChanged && G.hooks.gearChanged();
}
// gear slots that were removed: their items go back to the bag
function retireSlots(h) {
  const e = h.equip;
  for (const it of h.inv) if (it && it.kind === 'armor' && (it.slot === 'wrists' || it.slot === 'shoulders')) it.slot = 'arms';
  for (const k of RETIRED) { const it = h.equip[k]; delete h.equip[k]; if (!it) continue;
    if (it.kind === 'armor') { it.slot = 'arms'; if (!e.arms) { e.arms = it; continue; } }
    const i = h.inv.indexOf(null); if (i >= 0) h.inv[i] = it; }
  if (h.active === 'ranged' && h.equip.ranged) { const e = h.equip; if (!e.w3 && !e.w4) { [e.w3, e.w4] = [e.w1, e.w2]; e.w1 = e.ranged; e.w2 = null; e.ranged = null; h.setNo = 2; } }
  if (h.equip.ranged) { const e = h.equip; if (!e.w3) { e.w3 = e.ranged; e.ranged = null; } else { const i = h.inv.indexOf(null); if (i >= 0) { h.inv[i] = e.ranged; e.ranged = null; } } }
  h.active = 'w1';
}
// fix gear from older saves: two-handers never share the hands with anything
function fixHands(h) {
  const e = h.equip;
  if (!e.w1 && e.w2 && e.w2.wt !== 'shield') { e.w1 = e.w2; e.w2 = null; }
  if (e.w2 && (isTwoHanded(e.w1) || isTwoHanded(e.w2) || !e.w1)) { const k = h.inv.indexOf(null); if (k >= 0) { h.inv[k] = e.w2; e.w2 = null; } }
  if (!e.w3 && e.w4 && e.w4.wt !== 'shield') { e.w3 = e.w4; e.w4 = null; }
  h.active = 'w1';
}

// ---------- XP & levels ----------
export function gainXp(h, n, why) {
  if (h.level >= LEVEL_CAP) return;
  h.xp += Math.round(n);
  G.hooks.xpGained && G.hooks.xpGained(Math.round(n), why);
  const need = G.xpReq || xpForLevel;
  while (h.level < LEVEL_CAP && h.xp >= need(h.level)) {
    h.xp -= need(h.level); h.level++;
    const unlocked = [];
    if (h.level === AREA_UNLOCK_LEVEL) { const w = h.equip[h.active]; unlocked.push(`Right click: ${w ? WEAPON_TYPES[w.wt].areaName : 'weapon ability'}`); }
    for (const a of ABILITIES[h.cls]) if (a.level === h.level) unlocked.push(`${a.key ? "[" + a.key + "] " : ""}${a.name}`);
    if (h.level === RANK2_LEVEL) unlocked.push('Class abilities upgraded to Rank II');
    G.hooks.levelUp && G.hooks.levelUp(h.level, unlocked);
  }
  if (h.level >= LEVEL_CAP) h.xp = 0;
}

// ---------- kills & loot ----------
export function onKill(h, mob, shared = false) {
  if (!shared) h.kills = (h.kills || 0) + 1;
  const diff = levelGap(mob.lv, h.level);
  const xpMul = diff <= -6 ? 0.1 : diff <= -3 ? 0.5 : diff >= 3 ? 1.25 : 1;
  if (!shared) gainXp(h, mob.xp * xpMul, mob.name);
  // trophies for gathering quests drop only while a quest still wants them
  { const tro = QUEST_DROPS[mob.type]; if (tro) for (const qid in h.quests.active) { const q = QUESTS.find(x => x.id === qid); if (q && q.obj.some(o => o.t === 'collect' && o.item === tro && count(h, tro) < o.n)) { addItem(h, tro, 1); break; } } }
  // quest kill objectives
  for (const qid in h.quests.active) {
    const q = QUESTS.find(x => x.id === qid), a = h.quests.active[qid];
    q.obj.forEach((o, i) => { if (o.t === 'kill' && o.mob === mob.type && a.p[i] < o.n) { a.p[i]++; G.hooks.objective && G.hooks.objective(q, o, a.p[i]); } });
  }
  // weapon mastery: the weapon in your hands learns from every kill
  { const w = activeWeapon(h); if (w && !shared) gainMastery(h, familiesOf(w.wt)[0], 6 + Math.round(designLv(mob.lv) * 2)); }

  // loot table
  const D = mob.def, loot = [];
  for (const id in D.loot || {}) { const [a, b, c] = D.loot[id]; if (Math.random() < c) loot.push({ id, n: a + Math.floor(Math.random() * (b - a + 1)) }); }
  let gold = 0; if (D.gold) gold = D.gold[0] + Math.floor(Math.random() * (D.gold[1] - D.gold[0] + 1)); else if (Math.random() < 0.4) gold = 1 + Math.floor(designLv(mob.lv) * Math.random());
  const gear = [];
  const named = D.elite || D.boss || mob.bossy, dl = designLv(mob.lv), step = named ? (dl < 8 ? 1 : dl < 15 ? 2 : 3) : 0;
  if (Math.random() < (D.gearChance ?? (dl >= 4 ? 0.07 : 0.03))) gear.push(randomGear(h, mob.lv, step));
  if (D.boss) gear.push(randomGear(h, mob.lv, Math.min(4, step + 1)));
  mob.loot = { items: loot, gold, gear };
  G.hooks.questsChanged && G.hooks.questsChanged();
}
export function lootCorpse(h, mob) {
  if (!mob.loot || mob.looted) return;
  const L = mob.loot;
  for (const it of L.items) addItem(h, it.id, it.n);
  for (const g of L.gear) addGear(h, g);
  if (L.gold) { h.gold += L.gold; G.hooks.toast && G.hooks.toast(`+${L.gold} gold`, '🪙', 'gold'); S.coins(); }
  if (!L.items.length && !L.gear.length && !L.gold) G.hooks.toast && G.hooks.toast('Nothing of value.', '·');
  else S.loot();
  mob.looted = true;
}
export function hasLoot(mob) { return mob.loot && !mob.looted && (mob.loot.items.length || mob.loot.gear.length || mob.loot.gold); }

// ---------- gathering ----------
export function gatherReward(h, node) {
  const N = node.def;
  const n = N.amt[0] + Math.floor(Math.random() * (N.amt[1] - N.amt[0] + 1));
  if (G.hooks.gatherBank && G.hooks.gatherBank(N.item, n, node)) { gainXp(h, (4 + (N.tier || 1) * 3) * (G.gatherXp || 1), N.name); return; }
  addItem(h, N.item, n);
  if (N.extra && Math.random() < 0.6) addItem(h, N.extra, 1);
  gainXp(h, 4 + (N.tier || 1) * 3, N.name);
}
export function toolProblem(h, node) {
  const N = node.def;
  { const cf = G.hooks.carryFull && G.hooks.carryFull(N); if (cf) return cf; }
  if (!N.tool) return null;
  const t = h.tools[N.tool] || 0;
  if (!t) return `You need a ${TOOLS[N.tool].name}.`;
  if ((N.tier || 1) > t) return `You need a ${TOOL_TIER_NAMES[N.tier] || 'better'} ${TOOLS[N.tool].name} or better.`;
  return null;
}

// ---------- crafting ----------
export function recipeOutputName(r) {
  if (r.out) return (r.n > 1 ? r.n + '× ' : '') + ITEMS[r.out].name;
  if (r.tool) return TOOL_TIER_NAMES[r.tier] + ' ' + TOOLS[r.tool].name;
  if (r.weapon) return TIERS[r.tier].name + ' ' + WEAPON_TYPES[r.weapon].name;
  if (r.armor) return ARMOR_TIER_NAMES[r.armor][r.tier] + ' ' + ARMOR_NAMES[r.armor][r.slot];
  if (r.acc) return ACC[r.acc].names[r.tier];
}
export function recipeItem(r) { if (r.out) return { id: r.out, n: r.n }; if (r.tool) return { tool: r.tool, tier: r.tier }; if (r.weapon) return { kind: 'weapon', wt: r.weapon, tier: r.tier, rarity: 0 }; if (r.armor) return { kind: 'armor', akind: r.armor, slot: r.slot, tier: r.tier, rarity: 0 }; if (r.acc) return { kind: 'acc', slot: r.acc, tier: r.tier, rarity: 0 }; }
export function recipeIcon(r) { if (r.out) return ITEMS[r.out].icon; if (r.tool) return TOOLS[r.tool].icon; if (r.weapon) return itemIcon({ kind: 'weapon', wt: r.weapon }); if (r.armor) return itemIcon({ kind: 'armor', slot: r.slot }); if (r.acc) return itemIcon({ kind: 'acc', slot: r.acc }); }
export function recipesFor(h) {
  return RECIPES.filter(r => {
    if (r.weapon && !CLASSES[h.cls].weapons.includes(r.weapon)) return false;
    if (r.armor && r.armor !== CLASSES[h.cls].armor) return false;
    if (r.tool && (h.tools[r.tool] || 0) >= r.tier) return false;
    return true;
  });
}
export function canCraft(h, r) { if (h.level < r.lvl) return false; for (const k in r.need) if (count(h, k) < r.need[k]) return false; return true; }
export function craft(h, r) {
  if (!canCraft(h, r)) { S.error(); return false; }
  for (const k in r.need) removeItem(h, k, r.need[k]);
  let made;
  if (r.out) { addItem(h, r.out, r.n); made = r.out; }
  else if (r.tool) { h.tools[r.tool] = r.tier; G.hooks.toast && G.hooks.toast(recipeOutputName(r), recipeIcon(r)); }
  else {
    // crafted gear: small chance of better rarity
    const x = Math.random(), rar = x < 0.6 ? 0 : x < 0.88 ? 1 : x < 0.98 ? 2 : 3;
    const it = r.weapon ? makeWeapon(r.weapon, r.tier, rar) : r.acc ? makeAcc(r.acc, r.tier, Math.max(1, rar)) : makeArmor(r.armor, r.slot, r.tier, rar);
    addGear(h, it);
  }
  S.craft(r.station);
  gainXp(h, 3 + r.lvl * 2, 'Crafting');
  for (const qid in h.quests.active) {
    const q = QUESTS.find(x => x.id === qid), a = h.quests.active[qid];
    q.obj.forEach((o, i) => { if (o.t === 'craft' && a.p[i] < o.n && ((o.item && o.item === r.out) || (o.cat && o.cat === r.cat))) { a.p[i] = Math.min(o.n, a.p[i] + (r.out ? r.n : 1)); G.hooks.objective && G.hooks.objective(q, o, a.p[i]); } });
  }
  G.hooks.questsChanged && G.hooks.questsChanged();
  return true;
}

// ---------- consumables ----------
export function useItem(h, id, player) {
  const it = ITEMS[id]; if (!it || !it.use || count(h, id) <= 0) { S.error(); return false; }
  if (player.useCd > 0) return false;
  removeItem(h, id, 1); player.useCd = 1.0;
  if (it.use.heal) { player.heal(player.maxHp * it.use.heal); S.drink(); }
  if (it.use.regen) { player.regen = { per: player.maxHp * it.use.regen / (it.use.time || 10), t: it.use.time || 10 }; S.eat(); }
  if (FOOD_BUFFS[id]) { if (FOOD_BUFFS[id].drink) S.drink(); applyConsumable(h, id); }
  else if (it.use.regen) G.hooks.toast && G.hooks.toast(`${it.name}: healing over time`, itemSvg({ id }));
  return true;
}

// ---------- quests ----------
const SEABREAK = ['maren', 'bram', 'torvin', 'elsa', 'lyra', 'pell', 'odo'];
export function questState(h, q) {
  if (h.quests.done.includes(q.id)) return 'done';
  if (h.quests.active[q.id]) return questComplete(h, q) ? 'ready' : 'active';
  if ((q.req || []).every(r => h.quests.done.includes(r)) && h.level >= q.lvl) return 'available';
  if ((q.req || []).every(r => h.quests.done.includes(r))) return 'low';
  return 'locked';
}
export function objProgress(h, q, i) {
  const o = q.obj[i], a = h.quests.active[q.id];
  if (o.t === 'collect') return Math.min(o.n, count(h, o.item));
  if (o.t === 'equip') return ARMOR_SLOT_LIST.some(s => h.equip[s]) ? 1 : 0;
  if (o.t === 'talk') return a && a.p[i] ? 1 : 0;
  if (o.t === 'gold') return Math.min(o.n, h.gold);
  if (o.t === 'sideq') return Math.min(o.n, h.quests.done.filter(id => { const x = QUESTS.find(q => q.id === id); return x && !x.main && SEABREAK.includes(x.giver); }).length);
  return a ? Math.min(o.n, a.p[i]) : 0;
}
export function questComplete(h, q) { return q.obj.every((o, i) => objProgress(h, q, i) >= (o.n || 1)); }
export function acceptQuest(h, q) {
  h.quests.active[q.id] = { p: q.obj.map(() => 0), t: Date.now() };
  if (q.give && q.give.tool) { const [t, tier] = q.give.tool; if ((h.tools[t] || 0) < tier) { h.tools[t] = tier; G.hooks.toast && G.hooks.toast(`Received: ${TOOL_TIER_NAMES[tier]} ${TOOLS[t].name}`, TOOLS[t].icon, 'gold'); } }
  S.questAccept();
  G.hooks.questsChanged && G.hooks.questsChanged();
}
export function talkTo(h, npcId) {
  // complete talk objectives that target this NPC
  let changed = false;
  for (const qid in h.quests.active) { const q = QUESTS.find(x => x.id === qid); q.obj.forEach((o, i) => { if (o.t === 'talk' && o.npc === npcId && !h.quests.active[qid].p[i]) { h.quests.active[qid].p[i] = 1; changed = true; } }); }
  if (changed) G.hooks.questsChanged && G.hooks.questsChanged();
}
export function turnIn(h, q) {
  if (!questComplete(h, q)) return false;
  if (q.take) for (const k in q.take) if (q.take[k]) removeItem(h, k, q.take[k]);
  if (q.takeGold) h.gold = Math.max(0, h.gold - q.takeGold);
  delete h.quests.active[q.id]; h.quests.done.push(q.id);
  h.gold += q.gold || 0;
  for (const k in q.items || {}) addItem(h, k, q.items[k]);
  if (q.gear) addGear(h, randomGear(h, Math.max(q.lvl + 1, h.level), q.gearRarity || 2));
  S.questDone();
  G.hooks.questDone && G.hooks.questDone(q);
  gainXp(h, q.xp, 'Quest');
  G.hooks.questsChanged && G.hooks.questsChanged();
  return true;
}
export function npcQuests(h, npcId) {
  const offer = [], ready = [], active = [];
  for (const q of QUESTS) {
    const s = questState(h, q);
    if (s === 'available' && q.giver === npcId) offer.push(q);
    if (s === 'ready' && q.turnin === npcId) ready.push(q);
    if (s === 'active' && q.turnin === npcId) active.push(q);
    // talk-type quests complete when talking to the target NPC
    if (s === 'active' && q.turnin === npcId && q.obj.every(o => o.t === 'talk')) { /* handled by talkTo */ }
  }
  return { offer, ready, active };
}
export function npcMarker(h, npcId) {
  if (G.hooks.npcMarker) return G.hooks.npcMarker(npcId);
  const { offer, ready, active } = npcQuests(h, npcId);
  // a talk objective targeting this npc counts as ready
  const talkReady = Object.keys(h.quests.active).some(qid => { const q = QUESTS.find(x => x.id === qid); return q.turnin === npcId && q.obj.every(o => o.t === 'talk'); });
  if (ready.length || talkReady) return '?';
  if (offer.length) return '!';
  if (active.length) return 'q';
  return '';
}
function checkEquipObjectives(h) { G.hooks.questsChanged && G.hooks.questsChanged(); }

export function merchantStock() { return MERCHANT_STOCK; }
// the merchant's arms and armour: plain copper and iron pieces for your class (the same pieces each visit)
const gearCache = {};
export function gearStock(h) {
  const key = h.cls; if (gearCache[key]) return gearCache[key];
  const out = [], wts = [...new Set(['dagger', ...CLASSES[h.cls].weapons.filter(w => WEAPON_TYPES[w] && WEAPON_TYPES[w].kind !== 'staff' || true)])].filter(w => w !== 'shield' || CLASSES[h.cls].weapons.includes('shield')).slice(0, 5);
  for (const tier of [1, 2]) {
    for (const wt of wts) { const it = makeWeapon(wt, tier, 0); it.stats = {}; out.push(it); }
    for (const sl of ARMOR_SLOT_LIST) { const it = makeArmor(CLASSES[h.cls].armor, sl, tier, 0); out.push(it); }
  }
  return (gearCache[key] = out);
}
export function copyGear(it) { return Object.assign(JSON.parse(JSON.stringify(it)), { uid: ++uid }); }
export function buyPrice(id) { return Math.max(2, ITEMS[id].value * 3); }
