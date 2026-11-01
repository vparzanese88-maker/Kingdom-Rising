// Game rules: hero stats, inventory, gear, loot, XP/levels, quests, crafting, gathering.
import { RACES, CLASSES, WEAPON_TYPES, TIERS, RARITY, ITEMS, TOOLS, RECIPES, QUESTS, NPCS, MOBS, ABILITIES, LEVEL_CAP, xpForLevel, poolsAt, derived, weaponStat, weaponBaseDmg, armorBase, ARMOR_NAMES, ARMOR_TIER_NAMES, ARMOR_SLOT_LIST, DUAL_MASTERY, dualRank, AREA_UNLOCK_LEVEL, TOOL_TIER_NAMES, MERCHANT_STOCK } from './data.js';
import { G } from './state.js';
import { S } from './audio.js';
import { V } from './vfx.js';

export const INV_SIZE = 36, STACK = 99;
let uid = Date.now() % 1e6;

// ---------- new hero ----------
export function newHero(o) {
  const starter = makeWeapon(o.weapon, 0, 0);
  const h = {
    id: 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: o.name, race: o.race, cls: o.cls, sex: o.sex, app: o.app,
    level: 1, xp: 0, gold: 5, timePlayed: 0, created: Date.now(), lastPlayed: Date.now(), zone: 'Driftwood Coast', introDone: false,
    pos: null, inv: new Array(INV_SIZE).fill(null), equip: { w1: starter, w2: null, head: null, chest: null, legs: null, feet: null },
    active: 'w1', tools: { hatchet: 0, pickaxe: 0, knife: 0 }, quests: { active: {}, done: [] }, dualKills: 0, kills: 0, belt: 'potion_heal',
  };
  return h;
}

// ---------- items ----------
export function makeWeapon(wt, tier, rarity = 0, lvlHint) {
  const W = WEAPON_TYPES[wt], T = TIERS[tier], R = RARITY[rarity];
  const stats = rollStats(tier, rarity, weaponStat(wt));
  const name = (tier === 0 ? (W.kind === 'staff' ? 'Driftwood' : W.kind === 'bow' ? 'Driftwood' : 'Rusty') : T.name) + ' ' + W.name;
  return { uid: ++uid, kind: 'weapon', wt, tier, rarity, name, dmg: Math.round(weaponBaseDmg(tier) * W.dmg * R.mult), stats, lvl: tier === 0 ? 1 : T.lvl };
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
export function itemName(it) { return it.kind ? it.name : (ITEMS[it.id]?.name || it.id); }
export function itemValue(it) { if (it.kind) return Math.round((4 + it.tier * 10) * (1 + it.rarity * 0.8)); return ITEMS[it.id]?.value || 1; }
export function itemIcon(it) {
  if (it.kind === 'weapon') { const W = WEAPON_TYPES[it.wt]; return W.kind === 'bow' ? '🏹' : W.kind === 'staff' ? '🪄' : it.wt === 'daggers' ? '🗡' : it.wt === 'spear' ? '🔱' : it.wt.includes('axe') ? '🪓' : it.wt === 'warhammer' || it.wt === 'maceshield' ? '🔨' : '⚔'; }
  if (it.kind === 'armor') return { head: '⛑', chest: '🥋', legs: '👖', feet: '🥾' }[it.slot];
  return ITEMS[it.id]?.icon || '?';
}
export function randomGear(h, lvl, minRarity = 0) {
  const tier = Math.max(1, Math.min(5, Math.floor((lvl + 3) / 4)));
  let r = Math.random(), rarity = r < 0.55 ? 1 : r < 0.85 ? 2 : r < 0.97 ? 3 : 4; rarity = Math.max(minRarity, rarity);
  if (Math.random() < 0.45) { const ws = CLASSES[h.cls].weapons; return makeWeapon(ws[Math.floor(Math.random() * ws.length)], tier, rarity); }
  return makeArmor(CLASSES[h.cls].armor, ARMOR_SLOT_LIST[Math.floor(Math.random() * 4)], tier, rarity);
}

// ---------- inventory ----------
export function count(h, id) { let n = 0; for (const s of h.inv) if (s && !s.kind && s.id === id) n += s.n; return n; }
export function addItem(h, id, n = 1, quiet) {
  let left = n;
  for (const s of h.inv) if (s && !s.kind && s.id === id && s.n < STACK) { const k = Math.min(left, STACK - s.n); s.n += k; left -= k; if (!left) break; }
  while (left > 0) { const i = h.inv.indexOf(null); if (i < 0) break; const k = Math.min(left, STACK); h.inv[i] = { id, n: k }; left -= k; }
  if (!quiet && n - left > 0) G.hooks.toast && G.hooks.toast(`+${n - left} ${ITEMS[id].name}`, ITEMS[id].icon);
  if (left > 0) G.hooks.toast && G.hooks.toast('Your bag is full!', '⚠', 'bad');
  G.hooks.invChanged && G.hooks.invChanged();
  return n - left;
}
export function addGear(h, it, quiet) {
  const i = h.inv.indexOf(null); if (i < 0) { G.hooks.toast && G.hooks.toast('Your bag is full!', '⚠', 'bad'); return false; }
  h.inv[i] = it; if (!quiet) G.hooks.toast && G.hooks.toast(it.name, itemIcon(it), 'r' + it.rarity);
  G.hooks.invChanged && G.hooks.invChanged(); return true;
}
export function removeItem(h, id, n) {
  for (let i = h.inv.length - 1; i >= 0 && n > 0; i--) { const s = h.inv[i]; if (s && !s.kind && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) h.inv[i] = null; } }
  G.hooks.invChanged && G.hooks.invChanged();
}

// ---------- stats ----------
export function heroStats(h) {
  const base = Object.assign({}, RACES[h.race].stats);
  for (const k of ['w1', 'w2', 'head', 'chest', 'legs', 'feet']) {
    const it = h.equip[k]; if (!it) continue;
    if ((k === 'w1' || k === 'w2') && k !== h.active) continue;
    for (const s in it.stats) base[s] += it.stats[s];
  }
  return base;
}
export function heroDerived(h) {
  const st = heroStats(h), d = derived(st), P = poolsAt(h.cls, h.level);
  let armor = 0; for (const k of ARMOR_SLOT_LIST) if (h.equip[k]) armor += h.equip[k].armor;
  const w = h.equip[h.active];
  if (w && WEAPON_TYPES[w.wt].hands === 'shield') armor += 4 + w.tier * 4;
  return { stats: st, maxHp: Math.round(P.hp + d.hp + RACES[h.race].hp), maxMana: Math.round(P.mana + (P.mana > 0 ? d.mana : 0)), maxEnd: Math.round(P.end + d.end), armor, crit: d.crit, meleeMul: d.meleeMul, rangedMul: d.rangedMul, spellMul: d.spellMul };
}
export function weaponDamage(h, w) {
  const D = heroDerived(h);
  const s = weaponStat(w.wt), mul = s === 'int' ? D.spellMul : s === 'dex' ? D.rangedMul : D.meleeMul;
  return w.dmg * mul * (1 + (h.level - 1) * 0.05);
}
export function spellPower(h) { const D = heroDerived(h); const w = h.equip[h.active]; return (12 + h.level * 5) * (h.cls === 'wizard' ? D.spellMul : Math.max(D.meleeMul, D.rangedMul)) * (w ? 1 + w.tier * 0.1 : 1); }
export function canEquip(h, it) { if (it.kind === 'weapon') return CLASSES[h.cls].weapons.includes(it.wt); return it.kind === 'armor' && it.akind === CLASSES[h.cls].armor; }
export function equipFromInv(h, idx, slot) {
  const it = h.inv[idx]; if (!it || !it.kind) return false;
  if (!canEquip(h, it)) { G.hooks.toast && G.hooks.toast(`${CLASSES[h.cls].name}s can't use that.`, '⚠', 'bad'); S.error(); return false; }
  if (it.lvl > h.level) { G.hooks.toast && G.hooks.toast(`Requires level ${it.lvl}.`, '⚠', 'bad'); S.error(); return false; }
  const target = it.kind === 'weapon' ? (slot || h.active) : it.slot;
  h.inv[idx] = h.equip[target] || null; h.equip[target] = it;
  S.swap(); G.hooks.gearChanged && G.hooks.gearChanged(); G.hooks.invChanged && G.hooks.invChanged();
  checkEquipObjectives(h);
  return true;
}
export function unequip(h, slot) {
  if (!h.equip[slot]) return; if (slot === h.active && WEAPON_TYPES && !h.equip[slot === 'w1' ? 'w2' : 'w1']) { G.hooks.toast && G.hooks.toast('Keep at least one weapon.', '⚠', 'bad'); return; }
  const i = h.inv.indexOf(null); if (i < 0) { G.hooks.toast('Your bag is full!', '⚠', 'bad'); return; }
  h.inv[i] = h.equip[slot]; h.equip[slot] = null; if (slot === h.active) h.active = slot === 'w1' ? 'w2' : 'w1';
  G.hooks.gearChanged && G.hooks.gearChanged(); G.hooks.invChanged && G.hooks.invChanged();
}

// ---------- XP & levels ----------
export function gainXp(h, n, why) {
  if (h.level >= LEVEL_CAP) return;
  h.xp += Math.round(n);
  G.hooks.xpGained && G.hooks.xpGained(Math.round(n), why);
  while (h.level < LEVEL_CAP && h.xp >= xpForLevel(h.level)) {
    h.xp -= xpForLevel(h.level); h.level++;
    const unlocked = [];
    if (h.level === AREA_UNLOCK_LEVEL) { const w = h.equip[h.active]; unlocked.push(`Right click: ${w ? WEAPON_TYPES[w.wt].areaName : 'weapon ability'}`); }
    for (const a of ABILITIES[h.cls]) if (a.level === h.level) unlocked.push(`[${a.key}] ${a.name}`);
    if (h.level === 15) unlocked.push('Class abilities upgraded to Rank II');
    G.hooks.levelUp && G.hooks.levelUp(h.level, unlocked);
  }
  if (h.level >= LEVEL_CAP) h.xp = 0;
}

// ---------- kills & loot ----------
export function onKill(h, mob) {
  h.kills = (h.kills || 0) + 1;
  const diff = mob.lv - h.level;
  const xpMul = diff <= -6 ? 0.1 : diff <= -3 ? 0.5 : diff >= 3 ? 1.25 : 1;
  gainXp(h, mob.xp * xpMul, mob.name);
  // quest kill objectives
  for (const qid in h.quests.active) {
    const q = QUESTS.find(x => x.id === qid), a = h.quests.active[qid];
    q.obj.forEach((o, i) => { if (o.t === 'kill' && o.mob === mob.type && a.p[i] < o.n) { a.p[i]++; G.hooks.objective && G.hooks.objective(q, o, a.p[i]); } });
  }
  // dual wield mastery
  const w = h.equip[h.active];
  if (w && WEAPON_TYPES[w.wt].hands === 'dual') {
    const before = dualRank(h.dualKills); h.dualKills++; const after = dualRank(h.dualKills);
    if (after > before) G.hooks.mastery && G.hooks.mastery(DUAL_MASTERY[after - 1]);
  }
  // loot table
  const D = mob.def, loot = [];
  for (const id in D.loot || {}) { const [a, b, c] = D.loot[id]; if (Math.random() < c) loot.push({ id, n: a + Math.floor(Math.random() * (b - a + 1)) }); }
  let gold = 0; if (D.gold) gold = D.gold[0] + Math.floor(Math.random() * (D.gold[1] - D.gold[0] + 1)); else if (Math.random() < 0.4) gold = 1 + Math.floor(mob.lv * Math.random());
  const gear = [];
  if (Math.random() < (D.gearChance ?? (mob.lv >= 4 ? 0.07 : 0.03))) gear.push(randomGear(h, mob.lv, D.gearRarity || (D.elite ? 2 : 0)));
  if (D.boss) gear.push(randomGear(h, mob.lv, 4));
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
  addItem(h, N.item, n);
  if (N.extra && Math.random() < 0.6) addItem(h, N.extra, 1);
  gainXp(h, 4 + (N.tier || 1) * 3, N.name);
}
export function toolProblem(h, node) {
  const N = node.def;
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
}
export function recipeIcon(r) { if (r.out) return ITEMS[r.out].icon; if (r.tool) return TOOLS[r.tool].icon; if (r.weapon) return itemIcon({ kind: 'weapon', wt: r.weapon }); if (r.armor) return itemIcon({ kind: 'armor', slot: r.slot }); }
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
    const it = r.weapon ? makeWeapon(r.weapon, r.tier, rar) : makeArmor(r.armor, r.slot, r.tier, rar);
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
  if (it.use.regen) { player.regen = { per: player.maxHp * it.use.regen / (it.use.time || 10), t: it.use.time || 10 }; S.eat(); G.hooks.toast && G.hooks.toast(`${it.name}: healing over time`, it.icon); }
  return true;
}

// ---------- quests ----------
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
export function buyPrice(id) { return Math.max(2, ITEMS[id].value * 3); }
