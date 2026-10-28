// Kingdom Rising — game systems: characters, NPC life, quests, cities, vendors, bank, macros, saves, multiplayer
(function () {
  const KR = (window.KR = window.KR || {});
  const D = KR.D, U = KR.U, W = KR.W, T = KR.T, G = KR.G;
  const Sys = (KR.Sys = {});
  const TS = D.TS;

  // =============== CHARACTER CREATION ===============
  // every class comes home in its own clothes. The names shape the 3D model: hood, mitre, circlet, headband,
  // pointed hat and feathered cap become those hats; robe, vestment and gown become robes; jerkins are leather.
  // [name, colour, icon] for head and feet, [name, colour, leather?, icon] for the chest, [name, colour] for legs
  Sys.CLASS_OUTFITS = {
    warrior: { chest: ['Studded Brigandine', '#7a2a22', 'leather', '🦺'], legs: ['Wool Breeches', '#4a3a2a'], feet: ['Hobnailed Boots', '#2a1e16'] },
    paladin: { head: ["Squire's Circlet", '#e0c060', '👑'], chest: ['White Templar Tabard', '#ece6d2'], legs: ['Grey Hose', '#8a8c9a'], feet: ['Riding Boots', '#5a4a3a'] },
    shadowknight: { head: ['Dark Iron Circlet', '#8a8e9a', '👑'], chest: ['Black Leather Jerkin', '#2a1e30', 'leather', '🦺'], legs: ['Black Breeches', '#1a1420'], feet: ['Spurred Boots', '#141018'] },
    ranger: { head: ['Forest Hood', '#3f6b35'], chest: ['Green Leather Jerkin', '#3f6b35', 'leather', '🦺'], legs: ['Buckskin Leggings', '#6a5236'], feet: ['Soft Hunting Boots', '#3a2a1e'] },
    bard: { head: ['Feathered Cap', '#b8462e'], chest: ["Minstrel's Doublet", '#b8462e'], legs: ['Striped Hose', '#3a2a5a'], feet: ['Pointed Shoes', '#5a3a1e', '👞'] },
    beastlord: { head: ['Wolfskin Hood', '#8a6a3a'], chest: ['Hide Jerkin', '#8a6a3a', 'leather', '🦺'], legs: ['Fur Leggings', '#5a4028'], feet: ['Fur Boots', '#6a5038'] },
    rogue: { head: ['Shadow Hood', '#4a5058'], chest: ['Charcoal Jerkin', '#2a2e30', 'leather', '🦺'], legs: ['Dark Leggings', '#1e2224'], feet: ['Soft Boots', '#1a1a1a'] },
    monk: { head: ['Red Headband', '#c8302a'], chest: ["Monk's Tunic", '#d9822b'], legs: ['Saffron Trousers', '#c87020'], feet: ['Straw Sandals', '#c8a060', '🩴'] },
    berserker: { chest: ['Bearskin Jerkin', '#6a4a2e', 'leather', '🦺'], legs: ['Fur Breeches', '#4a3424'], feet: ['Fur Boots', '#3a2a1e'] },
    cleric: { head: ['Linen Mitre', '#f1efe6', '⛪'], chest: ['White Acolyte Vestment', '#efe9d8'], legs: ['Linen Trousers', '#c8c0a8'], feet: ['Temple Sandals', '#8a6a4a', '🩴'] },
    druid: { head: ['Leaf Circlet', '#6a9a3a', '🌿'], chest: ['Moss Green Robe', '#4e7d2f'], legs: ['Bark Brown Trousers', '#5a4a30'], feet: ['Bark Sandals', '#6a4a2a', '🩴'] },
    shaman: { head: ['Spirit Hood', '#2d7b78'], chest: ['Painted Hide Vestment', '#2d7b78'], legs: ['Hide Leggings', '#4a3a2a'], feet: ['Hide Boots', '#3a2a1e'] },
    necromancer: { head: ['Bone Circlet', '#e8e0cc', '💀'], chest: ['Black Funeral Robe', '#1d1a22'], legs: ['Grave Black Trousers', '#2a2430'], feet: ['Grave Boots', '#141018'] },
    wizard: { head: ['Pointed Hat', '#2b4fa3', '🎩'], chest: ['Blue Apprentice Robe', '#2b4fa3'], legs: ['Midnight Trousers', '#1e2a4a'], feet: ['Velvet Slippers', '#2a2a4a', '🥿'] },
    magician: { head: ['Crimson Hood', '#b03a2e'], chest: ['Crimson Summoner Robe', '#b03a2e'], legs: ['Ash Grey Trousers', '#4a4448'], feet: ['Ember Boots', '#3a1e16'] },
    enchanter: { head: ['Silver Circlet', '#c8c8e0', '👑'], chest: ['Violet Silk Gown', '#6a3fa0'], legs: ['Lilac Trousers', '#8a6ab0'], feet: ['Velvet Slippers', '#3a2a4a', '🥿'] },
    arquebusier: { head: ["Arquebusier's Feathered Cap", '#5a3a24'], chest: ['Buff Leather Coat', '#8a6a3a', 'leather', '🦺'], legs: ['Slashed Breeches', '#6a2a22'], feet: ['Bucket-Top Boots', '#2a1e16'] },
    trollcaller: { head: ['Moss Hood', '#4a6a2a'], chest: ['Troll-Hide Jerkin', '#5a6a3a', 'leather', '🦺'], legs: ['Bark Leggings', '#4a3a24'], feet: ['Root-Bound Boots', '#3a2a1a'] },
  };
  Sys.newChar = function (o) {
    const R = D.RACES[o.race], C = D.CLASSES[o.cls];
    if (C.only) o = Object.assign({}, o, { faction: C.only }); // a kingdom's own class belongs to that kingdom
    const c = { id: U.uid() + U.uid(), name: o.name, race: o.race, cls: o.cls, gender: o.gender, skin: o.skin, hair: o.hair, hairStyle: o.hairStyle, app: o.app || null, faction: (o.faction && (R.factions || [R.faction]).includes(o.faction)) ? o.faction : R.faction,
      level: 1, xp: 0, statPoints: 0, alloc: {}, bonus: {}, coins: 200, inv: new Array(16).fill(null), worldV: 3, heroV: 20, equip: {}, spells: [], bars: {}, wskill: {}, school: {},
      quests: { active: {}, done: {} }, rangeMode: 'both', macros: [{ id: 'm1', name: 'Attack', icon: '⚔', lines: '/attack on' }], playTime: 0, created: Date.now(), updated: Date.now(), pos: null, bind: null, explored: null, kills: 0 };
    D.STATS.forEach((s) => (c.alloc[s] = 0));
    // starting weapon: chosen by class (EverQuest style), not race
    const kit = D.CLASS_KITS[o.cls] || { wt: C.weapons[0], name: D.WEAPON_BASES[C.weapons[0]][0] };
    const wt = C.weapons.includes(kit.wt) ? kit.wt : C.weapons[0];
    const w = G.makeWeapon(wt, 0, { ilvl: 2, q: 0.85 }); w.name = kit.name; w.req = 1; w.stats = {}; if (kit.axe) w.axe = true; if (kit.club) w.club = true;
    c.equip.primary = w;
    c.wskill[wt] = 1;
    if (C.shield) c.wskill.SHIELD = 1;
    if (C.ranged.length) { const rt = kit.range && C.ranged.includes(kit.range) ? kit.range : C.ranged[0]; c.wskill[rt] = 1; if (o.cls === 'warrior' || o.cls === 'paladin') c.rangeMode = 'melee'; }
    if (kit.rangeItem) { const g = G.makeWeapon(kit.range, 0, { ilvl: 2, q: 0.85 }); g.name = kit.rangeItem; g.req = 1; g.stats = {}; c.equip.range = g; c.rangeMode = 'both'; } // the arquebusier's matchlock
    // everyone starts with nothing but the clothes on their back and the weapon of their calling
    // home from the sea in the plain clothes of your calling: no armour and no stats (everything else is earned)
    const plain = (slot, name, col, icon, ak) => { const it = G.makeArmor('cloth', slot, 0, { ilvl: 1, q: 0.6 }); Object.assign(it, { name, stats: {}, mana: 0, ac: 0, req: 1, value: 2, col, plainClothes: true }); if (ak && C.armor !== 'cloth') it.ak = ak; if (icon) it.icon = icon; c.equip[slot] = it; };
    const fit = Sys.CLASS_OUTFITS[c.cls] || Sys.CLASS_OUTFITS.warrior;
    if (fit.head) plain('head', fit.head[0], fit.head[1], fit.head[2] || '🧢');
    plain('chest', fit.chest[0], fit.chest[1], fit.chest[3] || '👕', fit.chest[2]); plain('legs', fit.legs[0], fit.legs[1], '👖'); plain('feet', fit.feet[0], fit.feet[1], fit.feet[2] || '🥾');
    if (G.makeLight) c.equip.light = G.makeLight('tallow'); // a tallow candle for the dark
    // spells known at level 1
    c.trained = [];
    if (D.CLASS_SPELLS[o.cls]) c.spells = D.CLASS_SPELLS[o.cls].filter((id) => D.SPELLS[id].level <= 1); // only first-circle spells; the rest are bought and scribed
    // starting hotbar (3 slots)
    const bar = new Array(10).fill(null);
    const startSkills = C.skills.filter((s) => s[1] <= 1 && !D.SKILLS[s[0]].passive).map((s) => ({ k: 'skill', id: s[0] }));
    const wAb = { k: 'weapon', id: (C.role === 'caster' && c.equip.range ? c.equip.range.wt : wt) + ':0' };
    const spells = c.spells.slice().sort((a, b2) => { const pa = /nuke|tap|dot|pet/.test(D.SPELLS[a].type) ? 0 : 1, pb = /nuke|tap|dot|pet/.test(D.SPELLS[b2].type) ? 0 : 1; return pa - pb; }).map((id) => ({ k: 'spell', id }));
    let pick;
    if (C.role === 'melee') pick = [...startSkills.slice(0, 2), { k: 'weapon', id: (kit.rangeItem ? kit.range : wt) + ':0' }];
    else if (C.role === 'hybrid') pick = spells[0] && D.SPELLS[spells[0].id].type === 'pet' && C.only ? [spells[0], startSkills[0] || wAb, { k: 'weapon', id: wt + ':0' }] : [startSkills[0] || wAb, { k: 'weapon', id: wt + ':0' }, spells[0]]; // the Trollcaller calls the troll first
    else pick = [spells[0], spells[1] || wAb, spells[2] || wAb];
    const seenA = new Set(); pick = pick.filter((a) => a && !seenA.has(a.k + a.id) && seenA.add(a.k + a.id));
    for (const a of [...spells, wAb, ...startSkills]) if (pick.length < 3 && !seenA.has(a.k + a.id)) { seenA.add(a.k + a.id); pick.push(a); }
    pick.slice(0, 3).forEach((a, i) => (bar[i] = a));
    c.bars[wt] = bar;
    // provisions for the road: 20 bread and 20 water to start with
    { const food = G.makePotion('food', 0), drink = G.makePotion('drink', 0); food.qty = 20; drink.qty = 20; const free = () => c.inv.findIndex((x) => !x); c.inv[free()] = food; c.inv[free()] = drink; }
    return c;
  };

  // =============== PLAYER SETUP ===============
  // bring old saves up to date with the two-kingdom world
  Sys.migrateChar = function (c) {
    if (c.faction === 'iron' || !D.FACTION_IDS.includes(c.faction)) { c.faction = 'crown'; for (const k of ['active', 'done']) for (const id in c.quests[k]) if (/^iron_/.test(id)) delete c.quests[k][id]; }
    if (c.worldV !== 4) { c.pos = null; c.bind = null; c.explored = null; c.realm = 'main'; c.worldV = 4; for (const id in c.quests.active) if (!Sys.QUESTS[id]) delete c.quests.active[id]; }
    if (c.statPoints || Object.values(c.alloc || {}).some((v) => v)) { c.statPoints = 0; D.STATS.forEach((s2) => (c.alloc[s2] = 0)); }
    c.bonus = {};
    if (c.invMax == null) { c.invMax = Math.max(16, c.inv.length); c.bagsBought = Math.max(0, Math.ceil((c.inv.length - 16) / 8)); }
    while (c.inv.length < c.invMax) c.inv.push(null);
    c.bossKills = c.bossKills || {}; c.bans = c.bans || {};
    if (c.level > D.MAX_LEVEL) { c.level = D.MAX_LEVEL; c.xp = 0; } // the cap (shown as level 20)
    if (c.heroV !== 20) Sys.migrateKit(c);
  };
  // heroes from before the level-20 kits: level onto a step, spells and hotbars onto the new class kit, no crafting
  Sys.migrateKit = function (c) {
    c.heroV = 20;
    const snapped = D.snapLv(c.level); if (snapped !== c.level) { c.level = snapped; c.xp = 0; }
    c.xp = Math.min(c.xp || 0, Math.max(0, D.xpNeeded(c.level) - 1));
    const kept = D.CLASS_SPELLS[c.cls] || [];
    const lineOf = (id) => String(id).split('_')[1];
    const hadLine = new Set((c.spells || []).map(lineOf));
    // any rank of a line the hero knew becomes every kept rank of it up to their level
    c.spells = kept.filter((id) => hadLine.has(lineOf(id)) && D.SPELLS[id].level <= c.level);
    const best = (line) => kept.filter((id) => lineOf(id) === line && c.spells.includes(id)).sort((x, y) => D.SPELLS[y].level - D.SPELLS[x].level)[0];
    const skills = new Set(D.CLASSES[c.cls].skills.map((x) => x[0]));
    for (const wt in c.bars || {}) {
      c.bars[wt] = (c.bars[wt] || []).map((a) => {
        if (!a) return null;
        if (a.k === 'skill') return skills.has(a.id) ? a : null;
        if (a.k === 'spell') { if (kept.includes(a.id) && c.spells.includes(a.id)) return a; const b2 = best(lineOf(a.id)); return b2 ? { k: 'spell', id: b2 } : null; }
        if (a.k === 'weapon') { const [w, i] = String(a.id).split(':'); const ni = D.WEAPON_KEEP.indexOf(+i); return ni >= 0 ? { k: 'weapon', id: w + ':' + ni } : null; }
        return a;
      });
    }
    delete c.craft; delete c.trained;
    for (const id in c.quests.active) if (/_(tools|knife)\d$/.test(id)) delete c.quests.active[id]; // the old tool quests
  };
  Sys.startPlayer = function (c) {
    Sys.migrateChar(c);
    const [cx, cy] = D.CITY_CENTER[c.faction];
    G.ents = []; G.proj = []; G.fx = []; G.floaters = []; G.corpses = [];
    const p = G.makeEnt({ type: 'player', c, name: c.name, r: 11, faction: c.faction });
    G.player = p;
    if (!c.bind) c.bind = { x: cx * TS + 16, y: (cy + 3) * TS + 16 };
    const savedRealm = c.realm || 'main'; const savedPos = c.pos;
    if (c.pos && savedRealm === 'main') { p.x = c.pos.x; p.y = c.pos.y; } else { p.x = c.bind.x; p.y = c.bind.y; }
    if (W.isBlockedTile(Math.floor(p.x / TS), Math.floor(p.y / TS))) { p.x = c.bind.x; p.y = c.bind.y; }
    p._resumeRealm = savedRealm !== 'main' && savedPos ? [savedRealm, Math.floor(savedPos.x / TS), Math.floor(savedPos.y / TS)] : null;
    p.buffs = [];
    p.hp = null; p.mana = null; G.recalc(p);
    if (c.hpSaved != null) p.hp = Math.min(p.hpMax, c.hpSaved); if (c.manaSaved != null) p.mana = Math.min(p.manaMax, c.manaSaved);
    p.autoAttack = false; p.relearn = 0; p.atkT = 0.5;
    p.curW = G.weaponType(c);
    if (!c.bars[p.curW]) c.bars[p.curW] = new Array(10).fill(null);
    Sys.migrateItems(c.inv); if (G.account) Sys.migrateItems(G.account.bank.items);
    if (c.explored) try { const bin = atob(c.explored); for (let i = 0; i < bin.length && i < W.explored.length; i++) W.explored[i] = bin.charCodeAt(i); } catch (e) {}
    for (const f of D.FACTION_IDS) Sys.spawnCity(f);
    Sys.spawnHubs();
    p.zoneRi = -1; p.zoneHub = null;
    c.mercs = c.mercs || []; if (c.petTaunt == null) c.petTaunt = true;
    Sys.spawnAllMercs();
    if (c.petSaved) {}
    G.log(`Welcome to ${D.FACTIONS[c.faction].city}, ${c.name}.`, 'sys', '#e8d48a');
    return p;
  };
  // put a newly learned ability on the hotbar if there is a free slot (never pushes anything off)
  Sys.autoBar = function (a, wt) {
    const p = G.player; if (!p || !p.c) return false; const c = p.c;
    if (wt && !c.bars[wt]) return false; // that weapon's hotbar is made when you first wield it
    const keys = wt ? [wt] : Object.keys(c.bars).length ? Object.keys(c.bars) : [p.curW || G.weaponType(c)];
    let placed = false;
    for (const k of keys) {
      const b = c.bars[k] || (c.bars[k] = new Array(10).fill(null)); while (b.length < 10) b.push(null);
      if (b.some((x) => x && x.k === a.k && x.id === a.id)) { placed = true; continue; }
      const i = b.findIndex((x) => !x); if (i >= 0) { b[i] = Object.assign({}, a); placed = true; }
    }
    if (placed) { KR.UI && KR.UI.renderBar && KR.UI.renderBar(); KR.UI && KR.UI.saveSoon && KR.UI.saveSoon(); }
    return placed;
  };
  Sys.bar = function () { const p = G.player; const c = p.c; const w = p.curW || G.weaponType(c); if (!c.bars[w]) c.bars[w] = new Array(10).fill(null); const b = c.bars[w]; while (b.length < 10) b.push(null); return b; };

  Sys.onWeaponChange = function () {
    const p = G.player, c = p.c;
    const nw = G.weaponType(c);
    if (nw === p.curW) return;
    const old = c.bars[p.curW] || new Array(10).fill(null);
    if (!c.bars[nw]) c.bars[nw] = old.map((a) => (a && a.k === 'weapon' && !G.actionDef(a).ranged ? { k: 'weapon', id: nw + ':' + a.id.split(':')[1] } : a));
    p.curW = nw; p.relearn = 5;
    if (!c.wskill[nw]) c.wskill[nw] = 0;
    G.log(`You begin adjusting to your ${D.WEAPON_TYPES[nw].name} weapon...`, 'skill', '#9ad8ff');
    KR.UI && KR.UI.refresh();
  };

  // =============== EQUIPMENT & ITEMS ===============
  // tell the player their bags are full and how to get more room (throttled)
  Sys.bagsFull = function (it) {
    const c = G.player.c; const now = Date.now();
    G.log(`Your bags are full!${it ? ' ' + it.name + ' could not be picked up.' : ''}`, 'sys', '#ff8a6a');
    if (now - (Sys._bagWarn || 0) > 20000) {
      Sys._bagWarn = now; const b = Sys.bagInfo ? Sys.bagInfo() : null;
      const tip = b && b.full ? 'Sell or destroy items to make room.' : b && b.canBuy ? `The Outfitter in your kingdom will sell you 8 more bag slots for ${G.fmtCoins(b.price)}.` : `Raise your kingdom to level ${b ? b.nextLevel : Sys.cityLevel(c.faction) + 1} to buy 8 more bag slots from the Outfitter. Sell or destroy items to make room now.`;
      G.log(tip, 'sys', '#ffd08a'); KR.UI && KR.UI.toast('Bags full', tip); KR.A.sfx('bagfull', 0.6);
    }
  };
  Sys.addItem = function (it, silent) {
    const c = G.player.c;
    if (it.stack) { const ex = c.inv.find((x) => x && x.stack && x.name === it.name && (x.qty || 1) < 99); if (ex) { ex.qty = (ex.qty || 1) + (it.qty || 1); if (!silent) G.log(`You receive ${it.qty > 1 ? it.qty + ' ' : ''}${it.name}.`, 'loot', '#bfe8a0'); return true; } }
    const i = c.inv.indexOf(null);
    if (i < 0) { Sys.bagsFull(it); return false; }
    c.inv[i] = it; if (!silent) G.log(`You receive ${it.qty > 1 ? it.qty + ' ' : ''}${it.name}.`, 'loot', '#bfe8a0');
    KR.UI && KR.UI.refresh();
    return true;
  };
  Sys.countItem = (name) => G.player.c.inv.reduce((a, x) => a + (x && x.name === name ? x.qty || 1 : 0), 0);
  Sys.takeItem = function (name, n) { const c = G.player.c; for (let i = 0; i < c.inv.length && n > 0; i++) { const x = c.inv[i]; if (!x || x.name !== name) continue; const q = x.qty || 1; if (q > n) { x.qty -= n; n = 0; } else { c.inv[i] = null; n -= q; } } KR.UI && KR.UI.refresh(); };
  Sys.equip = function (it) {
    const p = G.player, c = p.c;
    const u = G.canUse(c, it); if (!u.ok) { G.log(u.why, 'sys', '#ff8a6a'); KR.A.sfx('fail', 0.5); return false; }
    // with Dual Wield, a second one-handed weapon goes to the off hand automatically
    const toPri = it._toPrimary; delete it._toPrimary;
    if (!toPri && it.kind === 'weapon' && !it.twoHand && !D.WEAPON_TYPES[it.wt].ranged && G.hasSkill(c, 'dualwield') && c.equip.primary && !c.equip.primary.twoHand && !c.equip.secondary) it._toSecondary = true;
    let slot = G.itemSlot(it, c);
    const idx = c.inv.indexOf(it);
    // one-hand weapon into secondary if dual wield and primary filled & user prefers? (shift-equip handled by UI)
    if (it._toSecondary) { slot = 'secondary'; delete it._toSecondary; if (!G.hasSkill(c, 'dualwield') && it.kind === 'weapon') { G.log('You need the Dual Wield skill.', 'sys', '#ff8a6a'); return false; } if (it.twoHand) return false; }
    const old = c.equip[slot];
    if (idx >= 0) c.inv[idx] = null;
    c.equip[slot] = it;
    if (old) Sys.addItem(old, true);
    if (slot === 'primary' && it.twoHand && c.equip.secondary) { Sys.addItem(c.equip.secondary, true); c.equip.secondary = null; }
    if (slot === 'secondary' && c.equip.primary && c.equip.primary.twoHand) { Sys.addItem(c.equip.primary, true); c.equip.primary = null; }
    KR.A.sfx('equip', 0.9);
    G.recalc(p);
    if (slot === 'primary') Sys.onWeaponChange();
    if (slot === 'range' && !c.wskill[it.wt]) c.wskill[it.wt] = 0;
    KR.UI && KR.UI.refresh();
    return true;
  };
  Sys.unequip = function (slot) {
    const p = G.player, c = p.c; const it = c.equip[slot]; if (!it) return;
    if (c.inv.indexOf(null) < 0) { Sys.bagsFull(); return; }
    c.equip[slot] = null; Sys.addItem(it, true); G.recalc(p); KR.A.sfx('equip', 0.6);
    if (slot === 'primary') Sys.onWeaponChange();
    KR.UI && KR.UI.refresh();
  };
  Sys.useItem = function (it) {
    const p = G.player, c = p.c;
    if (it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'jewel') return Sys.equip(it);
    if (it.kind !== 'consumable') { G.log(`You can't use ${it.name}.`, 'sys', '#aaa'); return; }
    const key = 'item:' + it.ctype;
    if ((p.cds[key] || 0) > G.now) { G.log('You must wait before using that again.', 'sys', '#ffb24a'); return; }
    if (it.ctype === 'food' || it.ctype === 'drink') { Sys.consume(it); return; }
    if (it.ctype === 'ale') { const n = (p.drinks || 0) + 1; p.drinks = n; G.addBuff(p, { name: 'Tipsy', icon: '🍺', dur: 180, mods: { STR: 5 * n, CHA: -4 * n, AGI: -3 * n } }); p.drunkUntil = G.now + 60000 * n; G.recalc(p); KR.A.sfx('drink', 0.8); G.log(n > 2 ? 'The room is spinning...' : 'You down the ale. Warm and lovely.', 'sys', '#e8d48a'); p.cds[key] = G.now + 2000; }
    it.qty = (it.qty || 1) - 1; if (it.qty <= 0) c.inv[c.inv.indexOf(it)] = null;
    KR.UI && KR.UI.refresh();
  };

  Sys.consume = function (it, auto) {
    const p = G.player, c = p.c;
    if (it.ctype === 'food') { G.addBuff(p, { name: 'Well Fed', icon: it.icon, dur: 1200, mods: { regen: G.foodRegen(it.tier, c.level) }, food: it.tier }); G.log(`You ${auto ? 'are hungry and ' : ''}eat ${it.name}. Health regenerates faster.`, 'sys', '#e8d48a'); KR.A.sfx('click'); }
    else { G.addBuff(p, { name: 'Refreshed', icon: it.icon, dur: 1200, mods: { manaRegen: G.drinkRegen(it.tier, c.level), regen: G.foodRegen(it.tier, c.level) * 0.25 }, drink: it.tier }); G.log(`You ${auto ? 'are thirsty and ' : ''}drink ${it.name}. ${p.manaMax ? 'Mana' : 'Health'} regenerates faster.`, 'sys', '#e8d48a'); KR.A.sfx('drink', 0.6); }
    G.recalc(p);
    it.qty = (it.qty || 1) - 1; if (it.qty <= 0) c.inv[c.inv.indexOf(it)] = null;
    KR.UI && KR.UI.refresh();
  };
  Sys.autoEat = function () {
    const p = G.player; if (!p || p.dead) return; const c = p.c;
    for (const [ct, bn] of [['food', 'Well Fed'], ['drink', 'Refreshed']]) {
      if (p.buffs.some((b) => b.name === bn)) continue;
      const best = c.inv.filter((x) => x && x.kind === 'consumable' && x.ctype === ct).sort((a, b) => b.tier - a.tier)[0];
      if (best) Sys.consume(best, true);
    }
  };
  Sys.migrateItems = function (arr) {
    for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (!x || x.kind !== 'consumable' || !['heal', 'mana', 'bread'].includes(x.ctype)) continue; const n = G.makePotion(x.ctype, x.ctype === 'bread' ? 0 : x.tier); n.qty = x.qty || 1; arr[i] = n; }
  };

  // =============== LEVELING ===============
  Sys.levelUp = function () {
    const p = G.player, c = p.c;
    c.level = Math.min(D.MAX_LEVEL, D.LV(D.shown(c.level) + 1)); // one shown level (2-3 internal ones)
    G.recalc(p); p.hp = p.hpMax; p.mana = p.manaMax; p.endur = p.endurMax; p.glowUntil = G.now + 5000;
    KR.A.sfx('ding', 0.35); setTimeout(() => KR.A.sfx('levelup', 0.5), 350); G.fxAdd({ k: 'levelup', x: p.x, y: p.y, life: 2.2, ent: p });
    G.log(`You have reached level ${D.shown(c.level)}! Your health, mana and endurance grow.`, 'xp', '#ffd84a');
    KR.UI && KR.UI.toast(`Level ${D.shown(c.level)}!`, D.shown(c.level) >= D.MAX_SHOWN ? 'The highest level there is.' : 'Better gear is the way to raise your stats.');
    const C = D.CLASSES[c.cls];
    for (const [sk, lv] of C.skills) if (lv === c.level) { const S = D.SKILLS[sk]; const onBar = !S.passive && Sys.autoBar && Sys.autoBar({ k: 'skill', id: sk }); G.log(`You have learned ${S.name}!${S.passive ? ' It works on its own.' : onBar ? ' It is on your hotbar.' : ' Find it in your abilities (K).'}`, 'skill', '#ffd84a'); KR.UI && KR.UI.toast(`New ability: ${S.name}`, S.desc || ''); }
    for (const P of D.classPassives(c.cls)) if (P.level === c.level) { G.log(`New passive ability: ${P.name}. ${P.desc}`, 'skill', '#ffd84a'); KR.UI && KR.UI.toast(`Passive: ${P.name}`, P.desc); }
    if (D.CLASS_SPELLS[c.cls]) { const n = D.CLASS_SPELLS[c.cls].filter((id) => D.SPELLS[id].level === c.level).length; if (n) G.log(`${n} new spell${n > 1 ? 's are' : ' is'} available to learn from your guildmaster (spells cost coin).`, 'skill', '#c8a8ff'); }
    Sys.syncMercLevels();
    const kq = Sys.kingQuestFor(c);
    if (kq && D.shown(c.level) >= D.shown(kq.lv) - 1) G.log(`${D.FACTIONS[c.faction].king} may have a task worthy of you now.`, 'sys', '#e8d48a');
    KR.UI && KR.UI.refresh();
    Sys.save();
  };

  // =============== KILLS ===============
  Sys.onKill = function (e) {
    const p = G.player, c = p.c;
    if (e.summoned) { e.loot = { coins: 0, items: [] }; return; }
    const con = D.conOf(c.level, e.level);
    let xp = D.mobXp(e.level) * D.conXpMul[con] * (e.boss ? 10 : e.named ? 2.5 : 1);
    if (e.type === 'guard') xp = D.mobXp(e.level) * 0.5;
    if (Sys.groupXp) Sys.groupXp(Math.max(1, xp), e); else G.giveXp(Math.max(1, xp));
    c.kills = (c.kills || 0) + 1;
    e.loot = G.genLoot(e);
    if (e.loot.coins && Sys.groupCoins && Sys.groupCoins(e.loot.coins, e)) e.loot.coins = 0;
    if (e.loot.coins) { c.coins += e.loot.coins; G.log(`You loot ${G.fmtCoins(e.loot.coins)} from ${e.name}.`, 'loot', '#f0d070'); KR.A.sfx('coin', 0.8); e.loot.coins = 0; }
    // quest items auto loot
    for (let i = e.loot.items.length - 1; i >= 0; i--) { const it = e.loot.items[i]; if (it.kind === 'trophy' && Sys.questNeeds(it.name)) { if (Sys.addItem(it)) e.loot.items.splice(i, 1); } }
    if (e.loot.items.length && Sys.groupLoot && Sys.groupLoot(e)) { /* in a group: shared out automatically */ }
    else if (e.loot.items.length && G.ui_autoloot) Sys.lootAll(e);
    Sys.questKill(e);
    if (e.boss) {
      const B = D.BOSS_BY_ID[e.boss];
      { const st = Math.round(e.level * (B.king ? 4 : 3)); Sys.addStatus(c.faction, st, `slaying ${e.name}`); }
      KR.UI && KR.UI.toast(`${e.name} has been slain!`);
      G.log(`${e.name} has been slain by ${c.name}!`, 'sys', '#ffd84a');
    } else if (e.named) Sys.addStatus(c.faction, Math.max(4, Math.round(e.level * 0.8)), `defeating ${e.name}`);
    KR.UI && KR.UI.refresh();
  };
  Sys.lootAll = function (e) { if (!e.loot) return; for (let i = e.loot.items.length - 1; i >= 0; i--) if (Sys.addItem(e.loot.items[i])) e.loot.items.splice(i, 1); KR.UI && KR.UI.refresh(); };

  Sys.playerDied = function (src) {
    const p = G.player, c = p.c;
    KR.A.sfx('death');
    G.log(`You have been slain by ${src ? src.name : 'something'}!`, 'combat', '#ff4a3a');
    const loss = 0; // dying never costs experience
    for (const m of G.ents) if (m.hate) { m.hate.delete(p); if (!m.hate.size) m.inCombat = false; }
    p.autoAttack = false; p.target = null; p.cast = null;
    KR.UI && KR.UI.showDeath(loss);
  };
  Sys.respawn = function () {
    const p = G.player, c = p.c;
    // never wake up inside a rival kingdom: a bind point in an enemy kingdom is reset to home
    { const reg = c.bind && (!c.bind.realm || c.bind.realm === 'main') && (!W.realm || W.realm === 'main') ? D.REGIONS[W.regionAtPx(c.bind.x, c.bind.y)] : null; const enemyCity = reg && reg.city && reg.city !== c.faction;
      const nearEnemy = D.FACTION_IDS.some((f) => f !== c.faction && c.bind && Math.hypot(c.bind.x / TS - D.CITY_CENTER[f][0], c.bind.y / TS - D.CITY_CENTER[f][1]) < 50);
      if (!c.bind || enemyCity || nearEnemy) { c.bind = KR.Gear ? KR.Gear.healerBind(c) : { x: D.CITY_CENTER[c.faction][0] * TS + 16, y: (D.CITY_CENTER[c.faction][1] + 3) * TS + 16, realm: 'main' }; G.log('Your bind point was in enemy lands. You are returned to your own kingdom.', 'sys', '#e8d48a'); } }
    p.dead = false; p.x = c.bind.x; p.y = c.bind.y; p.hp = Math.round(p.hpMax * 0.5); p.mana = Math.round(p.manaMax * 0.5); p.buffs = []; p.stun = p.root = p.mez = p.fear = 0;
    G.addBuff(p, { name: 'Resurrection Sickness', icon: '💀', dur: 60, mods: { STR: -10, STA: -10, dmgMul: -0.2 }, debuff: true });
    G.recalc(p); Sys.mercsHome(); KR.Main && KR.Main.snapCamera && KR.Main.snapCamera();
    G.log('You awaken at your bind point.', 'sys', '#e8d48a');
  };
  Sys.gate = function (e) { if (e !== G.player) return; G.fxAdd({ k: 'ring', x: e.x, y: e.y, r: 60, col: '#9ad8ff', life: 0.8 }); e.x = e.c.bind.x; e.y = e.c.bind.y; if (e.pet) { e.pet.x = e.x + 20; e.pet.y = e.y; } Sys.mercsHome(); KR.Main.snapCamera(); G.log('You feel yourself pulled home.', 'spell', '#9ad8ff'); };

  // =============== PETS ===============
  const PET_SYL = ['Gab', 'Ver', 'Zon', 'Kel', 'Tar', 'Jo', 'Bek', 'Lan', 'Ob', 'Ret'];
  Sys.summonPet = function (owner, e, def) {
    if (owner.pet && !owner.pet.dead) { if (owner.pet.isCharm) Sys.breakCharm(owner.pet); else G.remove(owner.pet); }
    const lv = Math.min(owner.level + 1, e.lv);
    const name = U.pick(PET_SYL) + U.pick(PET_SYL).toLowerCase() + U.pick(['n', 'er', 'ab', 'ober', 'ekn', 'tik']);
    const kind = e.petKind;
    const pet = G.makeEnt({ type: 'pet', owner, name, level: lv, kind: kind === 'skeleton' ? 'skeleton' : kind, col: { skeleton: '#e6dfc8', spiritwolf: '#9ad8ff', wolf: '#8a8a88', bear: '#5a4232', tiger: '#d88a3a', drake: '#5a7a8a', animsword: '#c8a8ff', fire_elemental: '#ff7a2a', water_elemental: '#3a8ad8', earth_elemental: '#7a6a4a', air_elemental: '#c8d8e8', troll: '#5a7a46' }[kind] || '#aaa',
      x: owner.x + 30, y: owner.y + 10, r: 12, hostile: false });
    pet.baseHp = Math.round(G.mobHp(lv) * (owner.c.cls === 'magician' ? 1.45 : owner.c.cls === 'necromancer' ? 1.25 : owner.c.cls === 'beastlord' ? 1.7 : 1.45));
    pet.baseDmg = Math.round((4 + lv * 2.3) * (owner.c.cls === 'beastlord' || owner.c.cls === 'magician' ? 1.15 : 1.0)); pet.delay = 2.1; pet.speed = 165; pet.baseAc = lv * 10;
    if (owner.c.cls === 'beastlord') pet.name = owner.name.split(' ')[0] + "'s warder";
    if (owner.c.cls === 'trollcaller') {
      // the bound troll: the tank of the pair; it grows with its caller (Troll Bond: tougher and harder hitting)
      const bond = (G.passiveMods(owner.c).petBond || 0) > 0;
      pet.name = U.pick(['Mossback', 'Grumblestone', 'Barkjaw', 'Old Thud', 'Rootknuckle', 'Bramblehide']); pet.troll = true;
      pet.baseHp = Math.round(G.mobHp(lv) * 2.1 * (bond ? 1.3 : 1)); pet.baseDmg = Math.round((4 + lv * 2.3) * 1.05 * (bond ? 1.15 : 1)); pet.baseAc = lv * 14; pet.delay = 2.6; pet.speed = 150;
      pet.scale = 0.78 + Math.min(0.5, lv * 0.011); pet.r = 14; pet.regen = true;
    }
    owner.pet = pet;
    Sys.applyPetGear(pet); pet.hp = pet.hpMax;
    if (owner === G.player) G.log(`${pet.name} answers your call.`, 'spell', '#c8ffc8');
    G.fxAdd({ k: 'ring', x: pet.x, y: pet.y, r: 40, col: '#c8a8ff', life: 0.8 });
  };
  Sys.PET_SLOTS = ['head', 'chest', 'primary', 'secondary'];
  Sys.applyPetGear = function (pet) {
    const o = pet.owner; if (!o || !o.c) return; const gear = o.c.petGear || {};
    let ac = 0, hp = 0, dmg = 0, str = 0, sta = 0;
    for (const sl of Sys.PET_SLOTS) { const it = gear[sl]; if (!it) continue; const m = G.upMul(it); ac += Math.round((it.ac || 0) * m); hp += Math.round((it.hp || 0) * m); str += Math.round(((it.stats || {}).STR || 0) * m); sta += Math.round(((it.stats || {}).STA || 0) * m); if (sl === 'primary' && it.kind === 'weapon') dmg += it.dmg * m * (2.1 / it.delay) * 0.75; }
    const frac = pet.hpMax ? pet.hp / pet.hpMax : 1;
    pet.hpMax = pet.baseHp + hp + sta * 4; pet.hp = Math.round(pet.hpMax * frac);
    pet.dmg = Math.round(pet.baseDmg + dmg + str * 0.4); pet.ac = pet.baseAc + ac;
    pet.wt = gear.primary ? gear.primary.wt : 'H2H'; pet.delay = gear.primary ? Math.max(1.6, Math.min(3.2, gear.primary.delay)) : 2.1;
    pet.stats = { STR: 75 + pet.level * 2 + str, STA: 75 + pet.level * 2 + sta, AGI: 75 + pet.level, DEX: 75 + pet.level, WIS: 60, INT: 60, CHA: 50 };
    pet._ab = null;
    if (pet.kind === 'skeleton') {
      const look = KR.S.mobLook(pet) || {}; const F = D.FACTIONS[o.c.faction];
      if (gear.head) { look.helm = gear.head.ak === 'cloth' || gear.head.ak === 'leather' ? null : gear.head.ak; if (!look.helm) { look.hat = 'hood'; look.hatCol = '#4a3a2a'; } look.helmCol = '#9ea2aa'; }
      if (gear.chest) look.armor = { kind: gear.chest.ak, col: gear.chest.ak === 'plate' ? '#a8acb4' : gear.chest.ak === 'chain' ? '#8e9298' : gear.chest.ak === 'leather' ? '#7a5532' : '#4a3a6a', trim: F.banner };
      if (gear.primary) look.weapon = gear.primary.wt;
      look.offhand = gear.secondary ? (gear.secondary.shield ? 'shield' : gear.secondary.wt) : null; look.shieldCol = F.banner; look.wfx = gear.primary && gear.primary.fx || null;
      pet.look = look;
    }
  };
  Sys.petGearOk = function (it, slot) {
    if (!it) return false;
    if (slot === 'head' || slot === 'chest') return it.kind === 'armor' && it.slot === slot;
    if (slot === 'primary') return it.kind === 'weapon' && !D.WEAPON_TYPES[it.wt].ranged;
    if (slot === 'secondary') return (it.kind === 'armor' && it.shield) || (it.kind === 'weapon' && !it.twoHand && !D.WEAPON_TYPES[it.wt].ranged);
    return false;
  };
  Sys.petSlotFor = (it) => Sys.PET_SLOTS.find((sl) => Sys.petGearOk(it, sl) && (sl !== 'secondary' || it.shield));
  // ---------- pet weapon skills ----------
  Sys.petSkillUp = function (pet, hit) {
    if (pet.isCharm) return;
    const o = pet.owner; if (!o || !o.c) return; const c = o.c; c.petSkill = c.petSkill || {};
    const wt = pet.wt || 'H2H', cap = D.weaponSkillCap(pet.level), cur = c.petSkill[wt] || 0; if (cur >= cap) return;
    if (Math.random() < U.clamp(((cap - cur) / cap) * 0.3 + 0.03, 0.03, 0.4) * (hit ? 1 : 0.6)) {
      c.petSkill[wt] = cur + 1; pet._ab = null;
      const i = D.WEAPON_UNLOCKS.indexOf(cur + 1);
      if (o === G.player && i >= 0) { const ab = D.WEAPON_ABILITIES[wt][i]; G.log(`${pet.name} learned a new ${G.wtName(wt)} technique: ${ab.name}!`, 'skill', '#ffd84a'); KR.A.sfx('skillup', 0.6); }
      else if (o === G.player && (cur + 1) % 10 === 0) G.log(`${pet.name} has become better at ${G.wtName(wt)}! (${cur + 1})`, 'skill', '#9ad8ff');
    }
  };
  Sys.petAbilities = function (owner) {
    const c = owner.c; const gear = c.petGear || {}; const wt = gear.primary ? gear.primary.wt : 'H2H'; const sk = (c.petSkill || {})[wt] || 0; const out = [];
    D.WEAPON_ABILITIES[wt].forEach((ab, i) => { if (sk >= D.WEAPON_UNLOCKS[i] && !ab.ranged) out.push({ key: wt + ':' + i, def: G.actionDef({ k: 'weapon', id: wt + ':' + i }) }); });
    if (gear.secondary && gear.secondary.shield) { const ss = (c.petSkill || {}).SHIELD != null ? c.petSkill.SHIELD : sk; D.WEAPON_ABILITIES.SHIELD.forEach((ab, i) => { if (ss >= D.WEAPON_UNLOCKS[i]) out.push({ key: 'SHIELD:' + i, def: G.actionDef({ k: 'weapon', id: 'SHIELD:' + i }) }); }); }
    return out;
  };
  Sys.PET_BAR = 3;
  Sys.petBarAbilities = function (pet) {
    if (pet.isCharm) return [];
    if (pet._ab) return pet._ab; const o = pet.owner; if (!o || !o.c) return [];
    const all = Sys.petAbilities(o); const chosen = o.c.petBar;
    pet._ab = (chosen && chosen.length ? all.filter((x) => chosen.includes(x.key)) : all.slice(-Sys.PET_BAR)).slice(0, Sys.PET_BAR);
    return pet._ab;
  };
  Sys.togglePetAbility = function (key) {
    const c = G.player.c; const all = Sys.petAbilities(G.player).map((x) => x.key);
    let bar = (c.petBar && c.petBar.length ? c.petBar : all.slice(-Sys.PET_BAR)).filter((k) => all.includes(k));
    if (bar.includes(key)) bar = bar.filter((k) => k !== key); else { if (bar.length >= Sys.PET_BAR) { G.log(`Your pet can use only ${Sys.PET_BAR} abilities. Remove one first.`, 'sys', '#ffb24a'); return; } bar.push(key); }
    c.petBar = bar; if (G.player.pet) G.player.pet._ab = null;
  };
  // ---------- where materials come from ----------
  Sys.petEquip = function (it, owner) {
    owner = owner || G.player; const c = G.player.c; const oc = owner.c; oc.petGear = oc.petGear || {};
    const slot = Sys.petSlotFor(it); if (!slot) { G.log('Pets can wear a helmet and chest armor, and use a melee weapon and a shield.', 'sys', '#ffb24a'); return; }
    const old = oc.petGear[slot]; c.inv[c.inv.indexOf(it)] = null; oc.petGear[slot] = it; if (old) Sys.addItem(old, true);
    if (slot === 'primary' && it.twoHand && oc.petGear.secondary) { Sys.addItem(oc.petGear.secondary, true); oc.petGear.secondary = null; }
    if (owner.pet) Sys.applyPetGear(owner.pet); KR.A.sfx('equip', 0.9); KR.UI && KR.UI.refresh();
  };
  Sys.petUnequip = function (slot, owner) {
    owner = owner || G.player; const oc = owner.c; const it = oc.petGear && oc.petGear[slot]; if (!it) return;
    if (G.player.c.inv.indexOf(null) < 0) { Sys.bagsFull(); return; }
    oc.petGear[slot] = null; Sys.addItem(it, true); if (owner.pet) Sys.applyPetGear(owner.pet); KR.UI && KR.UI.refresh();
  };
  // ---------- charm: a bard (or enchanter) song turns a creature into a temporary pet ----------
  Sys.charm = function (src, m, dur) {
    if (src.pet && !src.pet.dead && !src.pet.isCharm) { if (src === G.player) G.log('You already have a pet. Dismiss it before charming another.', 'sys', '#ffb24a'); return false; }
    if (src.pet && src.pet.isCharm && !src.pet.dead) Sys.breakCharm(src.pet, true);
    m.charmed = { type: m.type, hostile: m.hostile }; m.type = 'pet'; m.owner = src; m.hostile = false; m.isCharm = true;
    for (const o of G.ents) if (o.hate && o.hate.has(m)) { o.hate.delete(m); if (!o.hate.size) o.inCombat = false; }
    m.hate.clear(); m.inCombat = false; m.target = null; m.backOff = false; m.mez = 0; m.fear = 0; m.atkT = 1; m.cds = {};
    m.charmUntil = G.now + dur * 1000; m.charmDur = dur; src.pet = m;
    if (src === G.player) { if (src.target === m) { src.autoAttack = false; } G.log(`${m.name} is charmed and fights for you for about ${Math.round(dur)} seconds.`, 'spell', '#ffb0ff'); KR.A.sfx('charm', 0.7); }
    G.fxAdd({ k: 'spiral', ent: m, rgb: '255,150,230', life: 1.4 });
    return true;
  };
  Sys.breakCharm = function (m, quiet) {
    if (!m.isCharm) return; const o = m.owner;
    m.type = m.charmed.type || 'mob'; m.hostile = m.charmed.hostile; m.owner = null; m.isCharm = false; m.charmed = null; m.target = null; m.charmUntil = 0;
    if (o && o.pet === m) o.pet = null;
    if (!m.dead && o && !o.dead) { m.hate.set(o, 200); m.inCombat = true; G.mobVoice && G.mobVoice(m, 'aggro'); }
    if (o === G.player && !quiet) { G.log(`Your charm wears off! ${m.name} turns on you!`, 'spell', '#ff8a6a'); KR.UI && KR.UI.toast('Charm broke', m.name + ' is hostile again'); }
  };
  Sys.updatePet = function (pet, dt) {
    G.statusTick(pet, dt); if (pet.dead) return;
    if (pet.isCharm && G.now > pet.charmUntil) { Sys.breakCharm(pet); return; }
    const o = pet.owner; if (!o || o.dead) { pet.target = null; }
    if (pet.atk > 0) { pet.atk += dt * 4; if (pet.atk > 1) pet.atk = 0; }
    if (pet.stun > 0) return;
    // pick target: owner's target if owner fighting, or whoever attacks owner
    if (pet.target && pet.target.mez > 0) pet.target = null;
    if (o && (!pet.target || pet.target.dead) && !pet.backOff) {
      if (o.target && !o.target.dead && !(o.target.mez > 0) && G.isHostile(o, o.target) && (o.type === 'merc' || (o.target._hurtBy && o.target._hurtBy.has(o)))) pet.target = o.target;
      else { const att = G.ents.find((m) => m.type === 'mob' && !m.dead && !(m.mez > 0) && m.target === o && m.inCombat && m.hate.has(o) && Math.hypot(m.x - o.x, m.y - o.y) < 400); if (att) pet.target = att; } // or defends its owner from whatever is attacking them
    }
    const t = pet.target;
    if (t && !t.dead && !pet.backOff) {
      const d = Math.hypot(t.x - pet.x, t.y - pet.y), reach = G.meleeRange(pet, t);
      if (Math.hypot(pet.x - o.x, pet.y - o.y) > 900) { pet.target = null; return; }
      if (d > reach) { G.chase(pet, t, dt, 1); return; }
      pet.moving = false; G.faceTo(pet, t);
      Sys.petTauntTick(pet, t);
      pet.atkT -= dt * (1 + (G.buffMods(pet).haste || 0));
      if (pet.atkT <= 0) {
        pet.atkT = pet.delay; pet.atk = 0.01;
        const hitP = Math.random() < G.hitChance(pet, t);
        if (hitP) { const dmg = Math.round(G.mitigate(pet, t, pet.dmg * (0.4 + Math.random() * 0.6) * (1 + (G.buffMods(pet).dmgMul || 0)))); G.damage(pet, t, dmg, {}); const gp = o && o.c && o.c.petGear; if (gp && gp.primary) G.tryProc(pet, t, gp.primary); } else G.float(t, 'miss', '#aaa');
        Sys.petSkillUp(pet, hitP);
      }
      // weapon techniques (up to 3 on the pet's bar)
      pet.abT = (pet.abT || 0) - dt;
      if (pet.abT <= 0 && !t.dead) {
        pet.abT = 0.6; pet.cds = pet.cds || {};
        for (const x of Sys.petBarAbilities(pet)) {
          if ((pet.cds[x.key] || 0) > G.now) continue;
          const self = x.def.target === 'self'; if (self && pet.buffs.some((b) => b.name === (x.def.effects[0].name || x.def.name))) continue;
          pet.cds[x.key] = G.now + (x.def.cd || 10) * 1000;
          G.applyAll(pet, self ? pet : t, x.def); pet.atk = 0.01;
          if (o === G.player && Math.random() < 0.5) G.float(pet, x.def.name, '#ffd8a0');
          break;
        }
      }
      return;
    }
    if (t && t.dead) pet.target = null;
    // follow
    const dx = o.x - pet.x - 26 * (o.face || 1), dy = o.y - pet.y + 14, d = Math.hypot(dx, dy);
    if (d > 2000) { pet.x = o.x - 20; pet.y = o.y + 10; }
    if (d > 40) { G.moveEnt(pet, dx / d * Math.min(pet.speed * (d > 200 ? 1.4 : 1), d * 4) * dt, dy / d * Math.min(pet.speed * (d > 200 ? 1.4 : 1), d * 4) * dt); pet.moving = true; pet.walk += dt * 10; G.faceTo(pet, { x: o.x, y: o.y }); }
    else pet.moving = false;
    pet.hp = Math.min(pet.hpMax, pet.hp + (0.5 + pet.level * 0.2) * dt);
  };
  Sys.petTauntTick = function (pet, t) { const o = pet.owner; if (!o || !o.c || o.c.petTaunt === false || G.now < (pet.tauntT || 0)) return; const top = G.topHate(t); if (o.type === 'merc' && top && top.type === 'merc' && ['warrior', 'paladin', 'shadowknight'].includes(top.c.cls)) return; if (top && top !== pet) { pet.tauntT = G.now + 6000; const mx = Math.max(0, ...t.hate.values()); t.hate.set(pet, mx + 50 + pet.level * 5); G.float(t, 'Taunted', '#ffb24a'); } };
  Sys.petCommand = function (cmd) { const p = G.player, pet = p.pet; if (cmd === 'taunt') { p.c.petTaunt = p.c.petTaunt === false; G.log(`Pet taunt is now ${p.c.petTaunt ? 'ON. Your pet will pull enemies off you.' : 'OFF.'}`, 'sys', '#c8ffc8'); KR.A.sfx('click'); return; } if (!pet) { G.log('You have no pet.', 'sys', '#aaa'); return; } if (cmd === 'attack') { if (p.target && G.isHostile(p, p.target)) { pet.target = p.target; pet.backOff = false; G.say(pet, 'Attacking ' + p.target.name + ', Master.', 2); } } else { pet.target = null; pet.backOff = true; setTimeout(() => (pet.backOff = false), 3000); G.say(pet, 'Following you, Master.', 2); } };

  // =============== CITIES & NPCs ===============
  G.account = null;
  Sys.cityLevel = (f) => (G.account ? G.account.cities[f].level : 1);
  Sys.addStatus = function (f, n, why) {
    const city = G.account.cities[f];
    city.status += n;
    if (G.player && G.player.c.faction === f) { G.log(`+${n} status for ${D.FACTIONS[f].city}${why ? ' for ' + why : ''}.`, 'status', '#f0c75e'); }
    while (city.level < 5 && city.status >= D.CITY_THRESHOLDS[city.level]) {
      city.level++;
      Sys.cityChanged(f, true);
    }
    KR.UI && KR.UI.refresh();
  };
  Sys.cityChanged = function (f, up) {
    const lvl = G.account.cities[f].level;
    if (W.realm === 'main') { W.stampCity(f, lvl); Sys.spawnCity(f); }
    const mine = G.player && G.player.c.faction === f;
    if (up) {
      G.log(`${D.FACTIONS[f].city} has risen to Kingdom Level ${lvl}!`, 'status', '#ffd84a');
      if (mine) { KR.A.sfx('levelup', 0.6); KR.UI && KR.UI.banner(`${D.FACTIONS[f].city} rises!`, `Kingdom Level ${lvl}. ${Sys.unlockText(lvl)}`); for (const line of Sys.cityUpgrades(lvl)) G.log('  ' + line, 'status', '#f0d48a'); KR.UI && KR.UI.showCityUp && KR.UI.showCityUp(f, lvl); }
      else G.log(`New in ${D.FACTIONS[f].city}: ${Sys.unlockText(lvl)}`, 'status', '#c8b890');
    } else G.log(`${D.FACTIONS[f].city} has fallen to Kingdom Level ${lvl}.`, 'status', '#ff8a6a');
    // unstick player
    const p = G.player; if (p && (!W.realm || W.realm === 'main') && W.isBlockedTile(Math.floor(p.x / TS), Math.floor(p.y / TS))) { const [cx, cy] = D.CITY_CENTER[p.c.faction]; p.x = cx * TS + 16; p.y = (cy + 3) * TS + 16; KR.Main.snapCamera(); }
    if (p && f === p.c.faction && (!W.realm || W.realm === 'main') && p.c.bind && W.isBlockedTile(Math.floor(p.c.bind.x / TS), Math.floor(p.c.bind.y / TS))) { const [cx, cy] = D.CITY_CENTER[f]; p.c.bind = { x: cx * TS + 16, y: (cy + 3) * TS + 16, realm: 'main' }; }
    Sys.save();
  };
  Sys.unlockText = function (lvl) {
    return ['', 'The basics: inn, bank, smithy, tailor, guild and general store.', 'Armorer, Weaponsmith and Jeweler open. A grocer sets up in the plaza.', 'The Scribe and Fletcher open. Wall sentries take their posts.', 'Master Forge, Royal Armory, Master Jeweler and Master Bowyer.', 'The Grand Exchange, Hall of Heroes and a Curio Merchant. A monument rises.'][lvl];
  };
  // detailed list of what a kingdom level adds
  Sys.cityUpgrades = function (lvl) {
    const L = {
      2: ['🗡 Mercenary Trader opens: hire your first mercenary (1 slot)', '🏠 Kingdom walls expand and 8 new homes are built', '🎒 Outfitter sells 8 more bag slots', '🛡 Armorer: tier 2 armor and shields', '⚔ Weaponsmith: tier 2 weapons', '💍 Jeweler: rings and necklaces, and teaches Jewelcrafting', '🍞 Grocer stall in the plaza: better food and drink', '⛺ Market stalls open', '💂 2 more kingdom guards on patrol (4 total)', '⛏ Smiths and tailors now sell tier 2 materials'],
      3: ['🗡 Mercenary Trader: a mercenary slot opens (2 total)', '🏠 Kingdom walls expand and 6 new homes are built', '🎒 Outfitter sells 8 more bag slots', '📜 Arcane Scribe: tomes, arcane materials, teaches Arcane Binding', '🏹 Fletcher: bows and throwing weapons, teaches Fletching', '🗡 Arms Dealer stall in the plaza', '🗿 Statues raised in the plaza', '🏹 4 Wall Sentries on the corner towers', '💂 2 more kingdom guards on patrol (6 total)', '⛏ Tier 3 materials and gear for sale'],
      4: ['🗡 Mercenary Trader: a mercenary slot opens (3 total)', '🏠 Kingdom walls expand and 4 new homes are built', '🎒 Outfitter sells 8 more bag slots', '🔥 Master Forge: all materials, Master Smith', '🛡 Royal Armory: tier 4 armor and jewelry', '💎 Master Jeweler (Lapidary): fine jewelry, Jewelcrafting', '🏹 Master Bowyer: fine bows, Fletching', '💂 2 Plaza Guards and 2 more patrols (8 total)', '⛏ Tier 4 materials and gear for sale'],
      5: ['🗡 Mercenary Trader: a mercenary slot opens (4 total)', '🏰 The kingdom reaches its greatest size', '🎒 Outfitter sells the last 8 bag slots', '💰 Grand Exchange: good tier 5 gear for your class (the best still comes from crafting and bosses)', '🏆 Hall of Heroes with the Royal Herald', '🗝 Curio Merchant: capes, belts and rings', '🌟 A monument replaces the fountain', '👑 Royal Patrols walk the streets (10 patrols total)', '⛏ Tier 5 materials for sale'],
    };
    const war = { 2: '🏹 Ballistas replace the archer towers at every gate; guards and engines rise to level 30. 2 war parties march every 24 minutes', 3: '🏹 Heavy ballistas guard every gate; guards and engines rise to level 40. 3 war parties march every 24 minutes', 4: '🪨 Catapults guard every gate; guards and engines rise to level 55. 4 war parties march every 24 minutes', 5: '💣 Trebuchets and cannons defend the walls; guards and engines rise to level 70. 5 war parties march every 24 minutes' };
    return (L[lvl] || []).concat(war[lvl] ? [war[lvl]] : []);
  };

  const roleDefs = {
    king: { services: ['quest'], title: 'King' },
    innkeeper: { services: ['vendor:inn', 'bind'], title: 'Innkeeper' },
    banker: { services: ['bank'], title: 'Banker' },
    merchant: { services: ['vendor:general'], title: 'Merchant' },
    armsdealer: { services: ['vendor:arms'], title: 'Arms Merchant' },
    alchemist: { services: ['vendor:alchemist'], title: 'Alchemist' },
    mercpatron: { services: [], title: 'Sellsword' },
    smith: { services: ['vendor:metal'], title: 'Blacksmith' },
    tailor: { services: ['vendor:cloth'], title: 'Tailor' },
    guildmaster: { services: ['train'], title: 'Guildmaster' },
    armorer: { services: ['vendor:armorer'], title: 'Armorer' },
    weaponsmith: { services: ['vendor:weaponsmith'], title: 'Weaponsmith' },
    scribe: { services: ['vendor:scribe'], title: 'Arcane Scribe' },
    fletcher: { services: ['vendor:fletcher'], title: 'Fletcher' },
    jeweler: { services: ['vendor:jeweler'], title: 'Jeweler' },
    gemcutter: { services: ['vendor:gems'], title: 'Master Jeweler' },
    bowyer: { services: ['vendor:bowyer'], title: 'Master Bowyer' },
    grocer: { services: ['vendor:grocer'], title: 'Grocer' },
    tinker: { services: ['vendor:tinker'], title: 'Arms Dealer' },
    relics: { services: ['vendor:relics'], title: 'Curio Merchant' },
    mastersmith: { services: ['vendor:mats'], title: 'Master Smith' },
    quartermaster: { services: ['vendor:armory'], title: 'Quartermaster' },
    exchange: { services: ['vendor:exchange'], title: 'Exchange Broker' },
    herald: { services: ['kingdom'], title: 'Royal Herald' },
    healer: { services: ['quest', 'vendor:healer'], title: 'Healer' },
    captain: { services: ['quest'], title: 'Guard Captain' },
    mercmaster: { services: ['mercs'], title: 'Mercenary Trader' },
    outfitter: { services: ['bags', 'vendor:outfitter'], title: 'Outfitter' },
    bounty: { services: ['quest'], title: 'Bounty Master' },
    scholar: { services: ['quest'], title: 'Scholar' },
    cook: { services: ['quest'], title: 'Cook' },
    farmer: { services: ['quest'], title: 'Farmer' },
    bard: { services: [], title: 'Bard' },
    townsfolk: { services: [], title: '' },
    drunk: { services: [], title: '' },
    child: { services: [], title: '' },
    outpost: { services: ['vendor:outpost'], title: 'Innkeeper' },
  };
  Sys.roleDefs = roleDefs;

  Sys.spawnCity = function (f) {
    if (W.realm && W.realm !== 'main') return;
    G.ents.filter((e) => e.city === f && (e.type === 'npc' || e.type === 'guard' || e.type === 'king')).forEach((e) => G.remove(e));
    const F = D.FACTIONS[f], lvl = Sys.cityLevel(f), cd = W.cityData[f], cx = cd.cx, cy = cd.cy, R = cd.R;
    const rnd = U.mulberry(f.length * 777 + lvl);
    const NM = D.NAMES[f];
    const bs = W.buildings.filter((b) => b.city === f);
    const bOf = (type) => bs.find((b) => b.type === type);
    const sp = (b, key, i = 0) => (b && b.spots[key] ? b.spots[key][i % b.spots[key].length] : [cx * TS, cy * TS]);
    const races = F.races;
    const mk = (role, x, y, opt = {}) => {
      const gender = opt.gender || (rnd() < 0.5 ? 'm' : 'f');
      const race = opt.race || 'human'; // both kingdoms are ruled and peopled by men: the brothers' realm is human (lore)
      const nm = opt.name || `${NM[gender][Math.floor(rnd() * NM[gender].length)]}${role === 'townsfolk' || role === 'drunk' || role === 'child' ? '' : ' ' + NM.last[Math.floor(rnd() * NM.last.length)]}`;
      const e = G.makeEnt({ type: opt.type || 'npc', role, city: f, faction: f, name: nm, title: opt.title != null ? opt.title : roleDefs[role] ? roleDefs[role].title : '', x, y, homeX: x, homeY: y, level: opt.level || 30, gender, race,
        skin: KR.S.skinOf(race, Math.floor(rnd() * 4)), hair: race === 'darkelf' ? KR.S.HAIRS[4] : KR.S.HAIRS[Math.floor(rnd() * 7)], hairStyle: Math.floor(rnd() * 4), speed: role === 'child' ? 120 : 70 + rnd() * 20, services: (roleDefs[role] || {}).services || [], hostile: false, seed: rnd() });
      e.hpMax = e.hp = 500;
      e.look = Sys.npcLook(e, opt);
      return e;
    };
    const P = (b, k, i) => sp(b, k, i);
    // King and royal guards
    const hall = bOf('hall');
    const [kx, ky] = P(hall, 'king');
    // town guards are level 20, royal guards 22 and the king 24 (shown levels; stored as internal levels, see D.LV)
    const TL = D.LV(20);
    const dress = (g, cls) => KR.War && KR.War.dress(g, cls);
    const patrolPool = ['manatarms', 'pikeman']; // the streets are walked by city guards only; soldiers wait in the barracks
    const king = mk('king', kx, ky, { type: 'king', name: F.king, title: `King of ${F.city}`, level: D.LV((D.KING_STATS && D.KING_STATS.lvl) || 24), gender: 'm', race: 'human' });
    const KS = D.KING_STATS || { hp: 60000, dmg: 420, delay: 1.8 }; king.hpMax = king.hp = KS.hp; king.dmg = KS.dmg; king.delay = KS.delay; king.ac = 2000; king.static = true; king.r = 14; king.speed = 120; king.leash = 500; king.passive = true; king.aggroR = 0; king.scale = 1.2; king.res = { fire: 80, cold: 80, magic: 80, poison: 80, disease: 80 };
    for (let i = 0; i < 4; i++) { const [gx, gy] = P(hall, 'guard', i); const g = mk('royalguard', gx, gy, { type: 'guard', title: 'Royal Guard', level: D.LV(22), gender: 'm' }); Sys.makeGuard(g, true); dress(g, 'knight'); }
    // City guards at gates
    const gates = cd.gates;
    gates.forEach(([gx, gy], gi) => {
      for (const s of [-1, 1]) for (const row of [1]) {
        const ox = gi === 0 ? s * 2 : -Math.sign(gx - cx) * row, oy = gi === 0 ? -row : s * 2;
        const g = mk('guard', (gx + ox) * TS + 16, (gy + oy) * TS + 16, { type: 'guard', title: 'Gate Guard', level: TL }); Sys.makeGuard(g, true); dress(g, row === 1 ? 'manatarms' : 'pikeman');
      }
    });
    for (let i = 0; i < 6 + lvl * 2; i++) { const a = rnd() * 6.28; const g = mk('guard', (cx + Math.cos(a) * 10) * TS, (cy + Math.sin(a) * 8) * TS, { type: 'guard', title: 'Patrol', level: TL }); Sys.makeGuard(g, false); dress(g, patrolPool[i % patrolPool.length]); if (KR.War) { KR.War.makePatrol(g, i); const [px, py] = g.patrolRoute[g.pIdx]; g.x = g.homeX = px * TS + 16; g.y = g.homeY = py * TS + 16; } }
    // towers and siege engines at every entrance, each with its own guard
    if (KR.War) KR.War.spawnDefenses(f, mk);
    // Service NPCs
    const inn = bOf('inn'); const [ix, iy] = P(inn, 'keeper'); mk('innkeeper', ix, iy).static = true;
    const [ckx, cky] = P(inn, 'cook'); const cook = mk('cook', ckx, cky); cook.static = true; cook.work = 'cook';
    const [bx, by] = P(inn, 'stage'); const bard = mk('bard', bx, by); bard.static = true; bard.work = 'lute';
    const bank = bOf('bank'); const [bkx, bky] = P(bank, 'banker'); mk('banker', bkx, bky).static = true;
    const store = bOf('store'); const [sx, sy] = P(store, 'vendor'); mk('merchant', sx, sy).static = true;
    // the smiths and crafters are gone: an arms merchant (armour, weapons, shields) and an alchemist keep shop
    const ab = bOf('arms'); if (ab) { const [ax, ay] = P(ab, 'vendor'); mk('armsdealer', ax, ay).static = true; }
    const alb = bOf('alchemist'); if (alb) { const [ax, ay] = P(alb, 'vendor'); mk('alchemist', ax, ay).static = true; }
    const gd = bOf('guild'); const [gmx, gmy] = P(gd, 'trainer'); mk('guildmaster', gmx, gmy).static = true;
    const sch = mk('scholar', gmx - 64, gmy + 20); sch.static = true; sch.work = 'read';
    // plaza quest givers
    mk('captain', (cx + 3) * TS + 16, (cy - 6) * TS + 16, { gender: 'm' }).static = true;
    // the Mercenary Trader keeps the pub, once it is built (the sellswords he has for hire drink there: Sys.pubPatrons)
    const pub = bOf('pub'); if (pub) { const [mx2, my2] = P(pub, 'keeper'); const mm = mk('mercmaster', mx2, my2); mm.static = true; mm.work = 'pour'; }
    mk('outfitter', (cx + 6) * TS + 16, (cy + 1) * TS + 16).static = true;
    mk('bounty', (cx - 4) * TS + 16, (cy + 1) * TS + 16).static = true;
    mk('healer', (cx + 4) * TS + 16, (cy + 1) * TS + 16).static = true;
    // more guards as the kingdom grows
    if (lvl >= 3) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = mk('guard', (cx + sx * (R - 2)) * TS + 16, (cy + sy * (R - 2)) * TS + 16, { type: 'guard', title: 'Wall Sentry', level: TL }); Sys.makeGuard(g, true); dress(g, lvl >= 3 && sx > 0 ? 'musketeer' : 'longbowman'); }
    if (lvl >= 4) for (const s of [-1, 1]) { const g = mk('guard', (cx + s * 7) * TS + 16, (cy - 3) * TS + 16, { type: 'guard', title: 'Plaza Guard', level: TL }); Sys.makeGuard(g, true); dress(g, s < 0 ? 'priest' : 'knight'); }
    if (lvl >= 5) for (let i = 0; i < 2; i++) { const g = mk('royalguard', (cx + (i ? 5 : -5)) * TS, (cy + 6) * TS, { type: 'guard', title: 'Royal Patrol', level: TL + 10, gender: 'm' }); Sys.makeGuard(g, false); dress(g, 'cavalry'); }
    // market stall vendors
    if (lvl >= 2) { mk('grocer', (cx - 4) * TS + 16, (cy - 3) * TS + 16).static = true; }
    if (lvl >= 3) { mk('tinker', (cx + 4) * TS + 16, (cy - 3) * TS + 16).static = true; }
    // Life: farmers, townsfolk, drunks, children
    const fields = cd.fields;
    for (let i = 0; i < 2; i++) { const fl = fields[i % 2]; const fm = mk('farmer', (fl[0] + 2) * TS, (fl[1] + 2) * TS); fm.work = 'farm'; fm.field = fl; fm.home = U.pick(bs.filter((b) => b.type === 'house'), rnd); }
    const houses = bs.filter((b) => b.type === 'house');
    // no idle townsfolk, drunks or children wandering about: everyone in town has a job (vendors, the inn, the farms,
    // the court, the workers and mill hands, the guards); the town shows its work instead
    void houses; void inn;
    // daily life with work to do, more of it as the kingdom grows (KR.Realm stages): water carriers between the well
    // (later the fountains) and the houses, porters carrying goods between the market and the shops and the inn, and,
    // once the village is a town, children who play by day; they eat at the inn at midday and go home at night
    { const nW = 1 + (lvl >= 3 ? 1 : 0), nP = Math.max(0, lvl - 1), nC = lvl >= 3 ? lvl - 2 : 0;
      for (let i = 0; i < nW + nP + nC; i++) {
        const job = i < nW ? 'water' : i < nW + nP ? 'porter' : null; const hb = houses.length ? houses[i % houses.length] : null;
        const sx = hb && hb.door ? hb.door.tx : cx + 2, sy = hb && hb.door ? hb.door.ty + (hb.door.ty >= hb.y + hb.h - 1 ? 1 : -1) : cy + 3;
        const e = mk(job ? 'townsfolk' : 'child', sx * TS + 16, sy * TS + 16, { title: job === 'water' ? 'Water Carrier' : job === 'porter' ? 'Porter' : '' });
        e.job = job; e.home = hb; e.idleT = 1 + rnd() * 6;
      } }
    // Outpost (neutral) is spawned once with Iron (any)
    if (f === 'crown' && !G.ents.some((e) => e.role === 'outpost')) {
      const ob = W.buildings.find((b) => b.type === 'outpost');
      if (ob) { const [ox, oy] = ob.spots.keeper[0]; const o = mk('outpost', ox, oy, { name: 'Hobb Wayfarer', race: 'halfling', gender: 'm' }); o.city = null; o.static = true; o.faction = null; }
    }
    // assign quest giver keys
    G.ents.filter((e) => e.city === f).forEach((e) => (e.qkey = e.role));
  };
  Sys.makeGuard = function (g, post) {
    const F = D.FACTIONS[g.faction];
    g.hpMax = g.hp = Math.round(G.mobHp(g.level) * (D.GUARD_HP || 3)); g.dmg = Math.round(3 + g.level * (D.GUARD_DMG || 3.2)); g.delay = 2.0; g.speed = 135; g.ac = 900; g.r = 12; g.static = post; g.passive = true; g.aggroR = 260; g.leash = 900;
    g.res = { fire: 40, cold: 40, magic: 40, poison: 40, disease: 40 };
    g.look = Object.assign(g.look || {}, { armor: { kind: 'plate', col: g.role === 'royalguard' ? '#d8c890' : '#9ea2aa', trim: F.banner }, helm: 'plate', helmPlume: F.banner, weapon: g.faction === 'iron' ? 'axe' : g.faction === 'sylvan' ? 'spear' : '1HS', offhand: g.faction === 'sylvan' ? null : 'shield', shieldCol: F.banner, shieldEmb: F.trim, cape: g.role === 'royalguard' ? F.banner : null, hat: null });
  };
  Sys.npcLook = function (e, opt) {
    const F = D.FACTIONS[e.faction];
    const L = { race: e.race, gender: e.gender, skin: e.skin, hair: e.hair, hairStyle: e.hairStyle };
    const garb = (col, trim, kind = 'none') => ({ kind, col, trim });
    switch (e.role) {
      case 'king': { const sy = e.faction === 'sylvan'; const hc = sy ? '#a83a22' : '#3a2a1c'; return Object.assign(L, { armor: garb(sy ? '#2e5a3a' : '#28457a', '#e0b84a', 'plate'), crown: true, cape: sy ? '#1e4a2c' : '#7a1e1e', weapon: '1HS', hair: hc, hairStyle: sy ? 2 : 1, beard: hc }); }
      case 'innkeeper': case 'outpost': return Object.assign(L, { armor: garb('#e8e0d0', '#7a5a3a'), sash: '#8a3a2a' });
      case 'cook': return Object.assign(L, { armor: garb('#f2efe6', '#c8c0b0'), hat: 'chef' });
      case 'bard': return Object.assign(L, { armor: garb('#b8462e', '#e3c04a'), hat: 'feather', hatCol: '#3a6ab8', weapon: 'H2H' });
      case 'banker': return Object.assign(L, { armor: garb('#2a3a5a', '#e0c060', 'cloth'), robe: true });
      case 'smith': case 'mastersmith': return Object.assign(L, { armor: garb('#5a3e28', '#3a2618', 'leather'), weapon: '1HB', bare: true });
      case 'tailor': return Object.assign(L, { armor: garb('#8a3a6a', '#e0c060'), hat: null });
      case 'guildmaster': case 'scholar': case 'scribe': return Object.assign(L, { armor: garb(e.role === 'scholar' ? '#4a5a3a' : '#3a2a5a', '#e0c060', 'cloth'), robe: true, hat: e.role === 'guildmaster' ? 'wizard' : null, hatCol: '#3a2a5a', weapon: '2HB', staff: true, orb: '#c8a8ff' });
      case 'healer': return Object.assign(L, { armor: garb('#f1efe6', '#4f7cc4', 'cloth'), robe: true, hat: 'mitre', hatCol: '#f1efe6', hatTrim: '#4f7cc4' });
      case 'mercmaster': return Object.assign(L, { armor: garb('#8e9298', '#7a2a1a', 'chain'), cape: '#5a3a2a', weapon: '2HS', helm: 'chain' });
      case 'captain': return Object.assign(L, { armor: garb('#b8bcc4', F.banner, 'plate'), helm: 'plate', helmPlume: '#e8d070', cape: F.banner, weapon: '1HS', offhand: 'shield', shieldCol: F.banner, shieldEmb: F.trim });
      case 'bounty': return Object.assign(L, { armor: garb('#5a4a3a', '#2a1a10', 'leather'), hat: 'hood', hatCol: '#3a2a1a', weapon: '1HP' });
      case 'farmer': return Object.assign(L, { armor: garb('#8a7a4a', '#5a3e24'), hat: 'strawhat', weapon: '2HB' });
      case 'armorer': case 'weaponsmith': case 'quartermaster': return Object.assign(L, { armor: garb('#8e9298', '#5a3e24', 'chain'), weapon: e.role === 'weaponsmith' ? '1HS' : null });
      case 'fletcher': return Object.assign(L, { armor: garb('#3f6b35', '#8a6a3a', 'leather'), back: 'bow' });
      case 'bowyer': return Object.assign(L, { armor: garb('#4a6b35', '#c8a060', 'leather'), back: 'bow', hat: 'feather', hatCol: '#4a6b35' });
      case 'jeweler': case 'gemcutter': return Object.assign(L, { armor: garb(e.role === 'gemcutter' ? '#3a2a6a' : '#5a2a4a', '#e0c060', 'cloth'), robe: true, sash: '#e0c060' });
      case 'relics': return Object.assign(L, { armor: garb('#2a2030', '#b08a3a', 'cloth'), robe: true, hat: 'hood', hatCol: '#2a2030' });
      case 'grocer': return Object.assign(L, { armor: garb('#e8dcc0', '#6a8a3a'), sash: '#6a8a3a', hat: 'strawhat' });
      case 'tinker': return Object.assign(L, { armor: garb('#8e9298', '#6a4a2a', 'chain'), weapon: '1HS' });
      case 'outfitter': return Object.assign(L, { armor: garb('#7a5a3a', '#e0c060', 'leather'), cape: '#6a2a2a', back: null });
      case 'exchange': case 'herald': return Object.assign(L, { armor: garb('#5a1e5a', '#e0b84a', 'cloth'), robe: true, cape: F.banner });
      case 'child': return Object.assign(L, { armor: garb(U.pick(['#c84a3a', '#3a6ab8', '#6aa84a', '#e0b040']), '#5a3e24') });
      default: return Object.assign(L, { armor: garb(U.pick(['#7a5a3a', '#5a6a3a', '#3a5a7a', '#7a3a3a', '#6a5a7a', '#8a7a5a']), '#3a2a1a', e.seed > 0.5 ? 'cloth' : 'none'), robe: e.seed > 0.7 });
    }
  };

  // Guard / king behavior
  Sys.updateGuard = function (g, dt) {
    if (g.siege) return KR.War.updateSiege(g, dt);
    if (g.raider) return KR.War.updateRaider(g, dt);
    if (g.priest && !g.dead && KR.War.priestTick(g, dt)) return;
    // the guard sent to the alarm bell runs there without stopping to fight
    if (g.alarmRun && !g.dead && KR.War && KR.War.guardMove(g, dt)) { G.statusTick(g, dt); return; }
    if (g.dead) { if (g.respawnAt && G.now > g.respawnAt) { g.dead = false; g.hp = g.hpMax; g.x = g.homeX; g.y = g.homeY; g.hate.clear(); g.inCombat = false; g.respawnAt = null; const i = G.corpses.indexOf(g); if (i >= 0) G.corpses.splice(i, 1); } return; }
    const p = G.player;
    g.scanT = (g.scanT || 0) - dt;
    if (g.scanT <= 0 && !g.inCombat) {
      g.scanT = 0.5;
      if (p && !p.dead && !p.fd && p.c.faction !== g.faction && Math.hypot(p.x - g.x, p.y - g.y) < (g.type === 'king' ? 180 : g.aggroR)) {
        G.addHate(g, p, 1);
        if (!p.warnedBy || G.now - p.warnedBy > 8000) { p.warnedBy = G.now; G.say(g, U.pick([`An intruder! Kill the ${D.RACES[p.c.race].name}!`, 'For the King! Cut them down!', `No ${D.FACTIONS[p.c.faction].name} filth in our kingdom!`]), 3); }
        for (const o of G.ents) if (o.type === 'guard' && o.faction === g.faction && !o.dead && Math.hypot(o.x - g.x, o.y - g.y) < 500) G.addHate(o, p, 1);
      } else if (g.type === 'guard') {
        const rd = KR.War && KR.War.active && !g.alarmRun && G.ents.find((o) => o.raider && !o.dead && o.faction !== g.faction && Math.hypot(o.x - g.x, o.y - g.y) < g.aggroR);
        if (rd) { G.addHate(g, rd, 5); if (!g.warnT || G.now > g.warnT) { g.warnT = G.now + 15000; G.say(g, U.pick(['To arms! We are under attack!', 'Defend the walls!', 'Hold the gate!']), 3); } }
        const m = !rd && G.ents.find((o) => o.type === 'mob' && !o.dead && o.inCombat && Math.hypot(o.x - g.x, o.y - g.y) < 380);
        if (m) G.addHate(g, m, 1);
      }
    }
    if (g.inCombat) { const t = G.topHate(g); if (t && t.type === 'mob' && !t.hate.has(g)) G.addHate(t, g, 1); }
    else if (g.type === 'guard' && KR.War && KR.War.guardMove(g, dt)) { G.statusTick(g, dt); return; }
    G.updateMob(g, dt);
    if (g.type === 'king' && g.hp < g.hpMax && !g.inCombat) g.hp = Math.min(g.hpMax, g.hp + g.hpMax * 0.05 * dt);
  };
  Sys.BAN_MS = 8 * 60 * 60 * 1000;
  // a war party reached the throne room and killed the king
  Sys.kingSlainByWar = function (k, killer) {
    const f = k.faction, ef = killer.faction;
    G.log(`${k.name} of ${D.FACTIONS[f].city} has been slain by a war party from ${D.FACTIONS[ef].city}!`, 'status', '#ff9a6a');
    KR.UI && KR.UI.kingFall && KR.UI.kingFall(k, killer);
    KR.A.sfx('roar', 1); G.shake = 2;
    const city = G.account.cities[f];
    if (city.level > 1) { city.level--; city.status = Math.min(city.status, D.CITY_THRESHOLDS[city.level - 1] || 0); Sys.cityChanged(f, false); }
    Sys.addStatus(ef, 250, `the fall of ${k.name}`);
    k.respawnAt = G.now + 30 * 60 * 1000;
  };
  Sys.kingSlain = function (k, killer) {
    // the hero's side brings down the enemy king: the war is won
    const pf = G.player && G.player.c.faction; const kf = killer && (killer.c ? killer.c.faction : killer.owner && killer.owner.c ? killer.owner.c.faction : killer.faction);
    if (pf && k.faction !== pf && kf === pf && KR.War) { k.respawnAt = G.now + 30 * 60 * 1000; KR.UI && KR.UI.kingFall && KR.UI.kingFall(k, killer); return KR.War.victory(k, killer); }
    if (killer && killer.raider) return Sys.kingSlainByWar(k, killer);
    const p = G.player, f = k.faction;
    G.log(`${k.name} of ${D.FACTIONS[f].city} has fallen!`, 'status', '#ffd84a');
    // drama: the hall shakes, bells toll, fire and smoke, the whole realm hears of it
    KR.UI && KR.UI.kingFall && KR.UI.kingFall(k, p);
    KR.A.sfx('roar', 1); setTimeout(() => KR.A.sfx('death', 1), 400); for (let i = 0; i < 6; i++) setTimeout(() => KR.A.sfx('anvil', 0.45), 900 + i * 900);
    for (let i = 0; i < 16; i++) setTimeout(() => G.fxAdd({ k: 'ring', x: k.x + (Math.random() - 0.5) * 180, y: k.y + (Math.random() - 0.5) * 140, r: 40 + Math.random() * 70, col: i % 2 ? '#ff7a2a' : '#ffd84a', life: 1.3 }), i * 120);
    G.shake = 2.5;
    G.log(`The bells of ${D.FACTIONS[f].city} toll in mourning. ${k.name} has been slain by ${p ? p.name : 'an unknown hand'}!`, 'status', '#ff9a6a');
    if (p && p.c.faction !== f) { p.c.bans = p.c.bans || {}; p.c.bans[f] = Date.now() + Sys.BAN_MS; G.log(`${D.FACTIONS[f].city} seals its gates against you for 8 hours. Its guards will throw you out on sight.`, 'status', '#ff6a5a'); }
    const city = G.account.cities[f];
    if (city.level > 1) { city.level--; city.status = Math.min(city.status, D.CITY_THRESHOLDS[city.level - 1] || 0); Sys.cityChanged(f, false); }
    if (p && p.c.faction !== f) Sys.addStatus(p.c.faction, 250, `slaying ${k.name}`);
    k.respawnAt = G.now + 30 * 60 * 1000;
  };

  // NPC daily life
  const hour = () => Math.floor(G.clock / 60);
  Sys.updateNPC = function (e, dt) {
    if (e.bell || e.raidBoard) return;
    if (e.dead) { if (e.respawnAt && G.now > e.respawnAt) { e.dead = false; e.hp = e.hpMax; e.x = e.homeX; e.y = e.homeY; e.path = null; e.respawnAt = null; } return; }
    // the alarm bell sends townsfolk and merchants running indoors until the attack is over
    Sys.townWatch();
    if (e.bellRun) { if (!e.path || !e.path.length) Sys.bellReached(e); }
    else if (KR.War && e.city && !e.recruiter && !e.barracks) { const st = KR.War.alarm[e.city]; const on = !!(st && st.state); if (on && !e.fleeing) KR.War.npcFlee(e); else if (!on && e.fleeing) KR.War.npcReturn(e); }
    e.panic = !!(e.bellRun || (e.fleeing && e.path && e.path.length)); // arms up, looking back: running in terror (chars.js)
    const p = G.player;
    if (e.atk > 0) { e.atk += dt * 3; if (e.atk > 1) e.atk = 0; }
    const h = hour();
    // work animations
    if (e.work && e.static) {
      e.workT = (e.workT || 0) - dt;
      if (e.workT <= 0) {
        // smiths strike a few times, then rest for a while
        if (e.work === 'smith') { e.smithN = (e.smithN || 0) + 1; e.workT = e.smithN % 3 === 0 ? 12 + Math.random() * 10 : 1.4; }
        else e.workT = 2 + Math.random() * 2;
        if (e.work === 'smith') { e.atk = 0.01; G.fxAdd({ k: 'sparks', x: e.x + 40, y: e.y - 10, life: 0.5 }); const dd = Math.hypot(p.x - e.x, p.y - e.y); if (dd < 260) KR.A.sfx('anvil', 0.12 * (1 - dd / 260)); }
        if (e.work === 'cook') { e.atk = 0.01; }
        // the pub: sellswords raise a mug or talk with their hands now and then; the trader pours behind the bar
        if (e.work === 'drink') { e.workT = 3 + Math.random() * 6; G.anim(e, Math.random() < 0.6 ? 'drink' : 'chat', 1700); }
        if (e.work === 'pour') { e.workT = 5 + Math.random() * 6; G.anim(e, 'pour', 1500); }
        if (e.work === 'loom') { e.atk = 0.01; }
        if (e.work === 'lute') { e.atk = 0.01; G.fxAdd({ k: 'note', x: e.x + 8, y: e.y - 40, vx: 10 - Math.random() * 20, vy: -25, life: 1.6 }); }
      }
    }
    // pathing for mobile NPCs
    if (!e.static) {
      if (!e.path || !e.path.length) {
        e.idleT = (e.idleT || 0) - dt;
        if (e.idleT <= 0) Sys.npcChooseTask(e, h);
      } else {
        const [tx, ty] = e.path[0]; const gx = tx * TS + 16, gy = ty * TS + 16;
        const dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy);
        if (d < 6) { e.path.shift(); e.stuckT = 0; if (!e.path.length) { e.moving = false; e.idleT = e.taskDur || 6; e.doing = e.task; } }
        else {
          const sp = e.speed * (e.drunk ? 0.6 : 1) * dt;
          const ox = e.x, oy = e.y;
          G.moveEnt(e, dx / d * sp + (e.drunk ? Math.sin(G.now / 300) * 0.8 : 0), dy / d * sp, { door: 'npc' });
          if (Math.abs(e.x - ox) + Math.abs(e.y - oy) < sp * 0.2) { e.stuckT = (e.stuckT || 0) + dt; if (e.stuckT > 1.5) { e.stuckT = 0; if (d < 20 && !W.isBlockedTile(tx, ty)) { e.x = gx; e.y = gy; } else { e.path = null; e.idleT = 0.3 + Math.random(); e.moving = false; } } } // never through a wall or a shut gate: give up and choose again
          e.moving = true; e.walk += dt * 9; G.faceTo(e, { x: gx, y: gy });
        }
      }
    }
    e.drunk = e.role === 'drunk' && h >= 18 || e.drunkLvl > 2;
    // chatter
    if (!e.mute && e.look && Math.hypot(p.x - e.x, p.y - e.y) < 480 && !e.bubble && !e.moving) {
      e.talkT = (e.talkT == null ? 15 + Math.random() * 60 : e.talkT) - dt;
      if (e.talkT <= 0 && G.now < (Sys._chatGate || 0)) e.talkT = 4 + Math.random() * 8; // someone else is already talking nearby
      else if (e.talkT <= 0) {
        e.talkT = 50 + Math.random() * 70; Sys._chatGate = G.now + 9000;
        const partner = G.ents.find((o) => o !== e && o.type === 'npc' && !o.bubble && !o.moving && Math.hypot(o.x - e.x, o.y - e.y) < 110);
        if (partner && Math.random() < 0.75) Sys.converse(e, partner);
        else { const l = Sys.npcLine(e, true); if (l) G.say(e, l); }
      }
    }
  };
  // ---------- the town keeps watch: whoever sees the enemy runs for the alarm bell ----------
  // a townsperson or merchant who sees enemy raiders or an enemy hero (a hero of the other kingdom, you included) in
  // or by the town shouts and runs for the bell; it rings when they get there (the gates shut if the town has walls),
  // the guards rally to where the enemy was seen and everyone else runs in terror for home until the danger is past
  let watchT = 0;
  Sys.townWatch = function () {
    if (G.now - watchT < 700 || !KR.War || !KR.War.alarm || !KR.War.ringBell) return; watchT = G.now;
    if (W.realm && W.realm !== 'main') return;
    const p = G.player;
    for (const f of D.FACTION_IDS) {
      const cd = W.cityData[f]; if (!cd || !cd.R) continue;
      const near = (e, m) => Math.max(Math.abs(e.x / TS - cd.cx), Math.abs(e.y / TS - cd.cy)) < cd.R + m;
      const foes = [];
      for (const e of G.ents) if (!e.dead && !e.removed && e.faction && e.faction !== f && D.FACTIONS[e.faction] && (e.raider || e.rivalHero) && near(e, 6)) foes.push(e);
      if (p && !p.dead && p.c && p.c.faction !== f && !p.invis && !p.sneak && near(p, 4)) foes.push(p);
      if (!foes.length) continue;
      let spot = null, foe = null, bd = 14 * TS;
      for (const e of G.ents) {
        if (e.city !== f || e.type !== 'npc' || e.dead || e.removed || e.bell || e.raidBoard || e.pubPatron || !e.look) continue;
        for (const o of foes) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd && (!W.lineClear || W.lineClear(e.x, e.y, o.x, o.y))) { bd = d; spot = e; foe = o; } }
      }
      if (!spot) continue;
      const st = KR.War.alarm[f] || (KR.War.alarm[f] = {}); st.lastSeen = G.now; st.where = { x: foe.x, y: foe.y };
      if (st.state) continue; // the bell is already ringing, or someone is already running for it
      const F = D.FACTIONS[foe.faction] || {};
      G.say(spot, foe.raider ? U.pick(['Raiders! To your homes!', 'Raiders! Ring the bell!', 'They are coming! Run!']) : U.pick([`A ${F.city || 'foreign'} spy! Ring the bell!`, 'An enemy in the streets! Guards!', 'Enemy! Sound the alarm!']), 3);
      if (p && p.c && p.c.faction === f) G.log(`${spot.name} sees ${foe.raider ? 'enemy raiders' : foe.name || 'an enemy'} and runs for the alarm bell!`, 'status', '#ffb24a');
      st.state = 'running'; st.since = G.now; st.runner = spot;
      const bell = KR.War.bellOf && KR.War.bellOf(f);
      const path = bell && W.findPathLong(Math.floor(spot.x / TS), Math.floor(spot.y / TS), Math.floor((bell.x + 26) / TS), Math.floor(bell.y / TS), 20000);
      if (!path) { KR.War.ringBell(f, spot); continue; }
      if (spot.static) { spot.wasStatic = true; spot.static = false; }
      if (!spot.fleeSpeed) spot.fleeSpeed = spot.speed; spot.speed = Math.max(spot.speed || 100, 110) * 1.5;
      spot.bellRun = true; spot.path = path; spot.task = 'bell'; spot.taskDur = 9999; spot.doing = null; spot.idleT = 0;
    }
  };
  // the runner reaches the bell: it rings (the old alarm: gates, guards rallying, everyone indoors), then they run home too
  Sys.bellReached = function (e) {
    e.bellRun = false; const st = KR.War.alarm[e.city]; if (st && st.runner === e) st.runner = null;
    const bell = KR.War.bellOf && KR.War.bellOf(e.city); if (bell) G.faceTo(e, bell);
    if (!st || st.state !== 'ringing') KR.War.ringBell(e.city, e);
    G.anim && G.anim(e, 'pour', 1400);
    if (e.fleeSpeed) { e.speed = e.fleeSpeed; e.fleeSpeed = null; } // npcFlee sets its own run speed from the normal one
    e.fleeing = false; KR.War.npcFlee(e);
  };
  Sys.npcChooseTask = function (e, h) {
    if (e.fleeing) { e.idleT = 4; e.moving = false; return; }
    const cd = W.cityData[e.city]; if (!cd) return;
    const cx = cd.cx, cy = cd.cy;
    let goal = null, dur = 8, task = 'idle';
    const night = h >= 22 || h < 6, evening = h >= 18 && h < 22;
    const homeSpot = e.home && e.home.spots.home ? e.home.spots.home[0] : null;
    if (e.role === 'farmer') {
      if (night && homeSpot) { goal = homeSpot; task = 'sleep'; dur = 60; }
      else if (evening && e.inn !== undefined) { goal = Sys.seatIn(e); task = 'drink'; dur = 30; }
      else { const f = e.field; goal = [(f[0] + 1 + Math.floor(Math.random() * (f[2] - 2))) * TS + 16, (f[1] + 1 + Math.floor(Math.random() * (f[3] - 2))) * TS + 16]; task = 'farm'; dur = 6 + Math.random() * 6; }
    } else if (e.job && e.role === 'townsfolk') {
      // a job: back and forth all day, a meal at the inn at midday, home at night
      const noon = h >= 12 && h < 13;
      const doorOf = (b) => (b && b.door ? [b.door.tx * TS + 16, b.door.ty * TS + 16] : null);
      if (night && homeSpot) { goal = homeSpot; task = 'sleep'; dur = 60; }
      else if (noon || evening) { goal = Sys.seatIn(e); task = 'eat'; dur = 30 + Math.random() * 20; }
      else {
        const shops = W.buildings.filter((b) => b.city === e.city && ['inn', 'store', 'arms', 'alchemist', 'pub', 'house'].includes(b.type) && b.door);
        e.leg = !e.leg;
        if (e.job === 'water') goal = e.leg ? [(cx + 6) * TS + 16, (cy - 1) * TS + 16] : doorOf(U.pick(shops.filter((b) => b.type === 'house').concat(shops.filter((b) => b.type === 'inn'))));
        else goal = e.leg ? [(cx + (Math.random() < 0.5 ? -6 : 6)) * TS + 16, (cy - 3) * TS + 16] : doorOf(U.pick(shops.filter((b) => b.type !== 'house')));
        task = e.job; dur = 4 + Math.random() * 6;
      }
    } else if (e.role === 'townsfolk' || e.role === 'drunk') {
      if (night && homeSpot && e.role !== 'drunk') { goal = homeSpot; task = 'sleep'; dur = 60; }
      else if (evening || e.role === 'drunk' && h >= 16) { goal = Sys.seatIn(e); task = 'drink'; dur = 25 + Math.random() * 20; }
      else { const a = Math.random() * 6.28, r = 3 + Math.random() * 7; goal = [(cx + Math.cos(a) * r) * TS + 16, (cy - 2 + Math.sin(a) * r * 0.6) * TS + 16]; task = 'wander'; dur = 5 + Math.random() * 10; }
    } else if (e.role === 'child') {
      if (night && homeSpot) { goal = homeSpot; task = 'sleep'; dur = 60; }
      else { const a = Math.random() * 6.28, r = 2 + Math.random() * 6; goal = [(cx + Math.cos(a) * r) * TS + 16, (cy - 2 + Math.sin(a) * r * 0.6) * TS + 16]; task = 'play'; dur = 1 + Math.random() * 3; }
    } else { e.static = true; return; }
    if (!goal) { e.idleT = 5; return; }
    const sx = Math.floor(e.x / TS), sy = Math.floor(e.y / TS), gx = Math.floor(goal[0] / TS), gy = Math.floor(goal[1] / TS);
    const path = W.findPath(sx, sy, gx, gy, 3500, { door: 'pass' });
    if (path) { e.path = path; e.task = task; e.taskDur = dur; e.doing = null; if (task === 'drink' && e.role === 'drunk') e.drunkLvl = (e.drunkLvl || 0) + 1; }
    else e.idleT = 3;
  };
  Sys.seatIn = function (e) { const inn = W.buildings.find((b) => b.city === e.city && b.type === 'inn'); if (!inn || !inn.spots.seat) return null; return U.pick(inn.spots.seat); };
  Sys.npcLine = function (e, solo) {
    const F = D.FACTIONS[e.city] || D.FACTIONS.crown;
    const T_ = D.TALK;
    const fill = (s) => s.replace('{drink}', F.drink).replace('{crop}', F.crop).replace('{boss}', U.pick(D.BOSSES).name).replace('{region}', U.pick(D.REGIONS.filter((r) => r.mobs)).name);
    if (e.drunk && Math.random() < 0.6) return U.pick(T_.drunk);
    if (e.role === 'child') return U.pick(T_.child);
    // townsfolk of your own kingdom often have useful advice
    if (G.player && e.city === G.player.c.faction && Sys.advice && Math.random() < (solo ? 0.3 : 0.5)) { const a = Sys.advice(); if (a.length) return U.pick(a.slice(0, 5)); }
    if (solo && e.work && Math.random() < 0.6) return U.pick(T_.work);
    const topics = ['weather', 'drink', 'crops', 'tips', 'lore', 'monsters'];
    const t = U.pick(topics);
    if (t === 'weather') return U.pick(T_.weather[G.weather.type]);
    if (t === 'lore') return U.pick(T_.lore[e.city || 'crown']);
    if (t === 'tips') return U.pick(T_.tips);
    if (t === 'monsters') return fill(U.pick(T_.monsters));
    if (t === 'crops') return fill(U.pick(T_.crops));
    return fill(U.pick(T_.drink));
  };
  Sys.converse = function (a, b) {
    const n = 2 + Math.floor(Math.random() * 2); Sys._chatGate = G.now + n * 4600 + 6000;
    let k = 0;
    const step = () => { if (k >= n || a.removed || b.removed) return; const s = k % 2 ? b : a; const l = Sys.npcLine(s); if (l) G.say(s, l, 4); G.faceTo(a, b); G.faceTo(b, a); k++; setTimeout(step, 4200); };
    step();
  };
  Sys.hail = function (e) {
    const c = G.player.c;
    if (e.type === 'king' && e.faction !== c.faction) { G.say(e, 'You dare stand before me? Guards!', 3); return; }
    if (e.type === 'guard') { G.say(e, e.faction === c.faction ? U.pick(['Move along, citizen.', 'All quiet. Stay out of trouble.', `Glory to ${D.FACTIONS[e.faction].city}.`]) : 'Halt!', 3); return; }
    if (e.city && e.city !== c.faction && e.type === 'npc') { G.say(e, U.pick(['I do not deal with your kind.', 'Guards! A spy!', 'Begone before the guards see you.']), 3); return; }
    G.faceTo(e, G.player);
    KR.UI.openNPC(e);
  };

  // =============== QUESTS ===============
  Sys.QUESTS = {};
  Sys.buildQuests = function () {
    const Q = Sys.QUESTS;
    const add = (q) => { Q[q.id] = q; };
    const ZONES = { sylvan: ['sunleaf', 'greywood'], iron: ['pebblebrook', 'copperdeep'], crown: ['meadowrun', 'thornfield'] };
    const ENEMY1 = { sylvan: 'orc_pawn', iron: 'gob_whelp', crown: 'cutpurse' };
    const ENEMY2 = { sylvan: ['orc_grunt', 'orc_shaman', 'orc_archer', 'orc_centurion'], iron: ['gob_warrior', 'gob_shaman', 'gob_archer'], crown: ['thug', 'bandit_archer', 'bandit_mage', 'highwayman'] };
    const DROP2 = { sylvan: 'Orc Warband Badge', iron: 'Goblin Totem', crown: 'Bandit Bandana' };
    const BEAST2 = { sylvan: ['treant'], iron: ['cave_bear', 'giant_spider'], crown: ['highwayman'] };
    const CRIT = { sylvan: ['wisp', 'Wisp Essence', 'scholar', 'Glade Wisps', 'I study the wisps of the glade. Bring me 5 Wisp Essences and I will pay you well.'], iron: ['beetle', 'Glowing Gland', 'smith', 'Lamp Oil', 'My forge lamps burn beetle oil. Bring me 5 Glowing Glands from the fire beetles in the hills.'], crown: ['boar', 'Boar Meat', 'cook', 'Boar Stew', 'The tavern is out of meat! Bring me 5 Boar Meat from the fields.'] };
    for (const f of D.FACTION_IDS) {
      const F = D.FACTIONS[f], [z1, z2] = ZONES[f];
      const zn = (z) => D.REGIONS[D.REGION_BY_ID[z]].name;
      add({ id: f + '_rats', f, giver: 'farmer', lv: 1, type: 'kill', mobs: ['rat'], n: 6, title: 'Rats in the Grain', text: `The giant rats are eating our seed grain. Kill 6 of them in ${zn(z1)}.`, reward: { coin: 40, status: 2 } });
      add({ id: f + '_crate', f, giver: 'merchant', turnin: 'armsdealer', lv: 1, type: 'deliver', item: 'Sealed Crate of Nails', title: 'A Crate of Nails', text: 'Take this crate of nails to the arms merchant, would you? My legs are not what they were.', reward: { coin: 25, status: 1 } });
      add({ id: f + '_pelts', f, giver: 'alchemist', lv: 3, type: 'collect', item: 'Wolf Pelt', mobs: ['wolf'], n: 4, title: 'Fine Pelts', text: 'My salves need wolf fat and the pelts sell well. Bring me 4 Wolf Pelts.', reward: { coin: 90, status: 3, item: { k: 'armor', slot: 'hands', tier: 0 } } });
      add({ id: f + '_crit', f, giver: CRIT[f][2], lv: 3, type: 'collect', item: CRIT[f][1], mobs: [CRIT[f][0]], n: 5, title: CRIT[f][3], text: CRIT[f][4], reward: { coin: 80, status: 3 } });
      add({ id: f + '_scouts', f, giver: 'captain', lv: 4, type: 'kill', mobs: [ENEMY1[f]], n: 8, title: `${D.MOBS[ENEMY1[f]].name}s`, text: `${F.enemyMobs} send their young to scout our walls. Kill 8 ${D.MOBS[ENEMY1[f]].name}s in ${zn(z1)}.`, reward: { coin: 120, status: 5, item: { k: 'weapon', tier: 0 } } });
      if (D.REGION_BY_ID['sewer_' + f] != null) {
        const gang = f === 'crown' ? ['The Rat Tail Gang', 'Those cutpurses lurking in Meadowrun are the Rat Tail Gang, and they have made a den in the sewers beneath our streets. Their way in is the big brick outflow pipe at the foot of our walls, where the drains spill out into a ditch. Follow the stink. Go down and kill 8 of them.', 'rattigan', 'The Gutter King', 'Rattigan, the Gutter King, runs the Rat Tail Gang from the deepest tunnel of the sewers. Every purse cut outside our walls ends up in his pocket. End his little kingdom.']
          : ['Orcs in the Drains', 'The orc pawns in Sunleaf Glade keep turning up inside our walls. They are crawling in through the old sewers. Their way in is the big brick outflow pipe at the foot of our walls, where the drains spill out into a ditch. Follow the stink. Go down and kill 8 of them.', 'drainjaw', 'Drainjaw', 'An orc called Gorruk Drainjaw leads the pawns that crawl through our sewers. Find him in the deepest tunnel and put an end to the sneaking.'];
        add({ id: f + '_sewer', f, giver: 'captain', lv: 3, type: 'kill', region: 'sewer_' + f, n: 8, title: gang[0], text: gang[1], reward: { coin: 160, status: 6 } });
        add({ id: f + '_sewerboss', f, giver: 'bounty', lv: 8, type: 'boss', boss: gang[2], title: gang[3], text: gang[4], reward: { coin: 650, status: 15, item: { k: 'weapon', tier: 0, q: 1.2 } } });
      }
      add({ id: f + '_z2', f, giver: 'bounty', lv: 11, type: 'kill', region: z2, n: 10, title: `Trouble in ${zn(z2)}`, text: `${zn(z2)} grows more dangerous every day. Thin out whatever lives there. Kill 10 creatures.`, reward: { coin: 500, status: 8 } });
      add({ id: f + '_trophies', f, giver: 'captain', lv: 13, type: 'collect', item: DROP2[f], mobs: ENEMY2[f], n: 8, title: 'Proof of Victory', text: `Bring me 8 ${DROP2[f]}s. I want proof that ${F.enemyMobs} are paying for every raid.`, reward: { coin: 700, status: 12, item: { k: 'armor', slot: 'chest', tier: 1 } } });
      add({ id: f + '_beasts', f, giver: 'scholar', lv: 15, type: 'kill', mobs: BEAST2[f], n: 6, title: 'Beasts of the Deep Wood', text: `Something has twisted the creatures of ${zn(z2)}. Destroy 6 ${D.MOBS[BEAST2[f][0]].name}s so I can study what remains.`, reward: { coin: 800, status: 10 } });
      add({ id: f + '_wilds', f, giver: 'bounty', lv: 18, type: 'kill', region: 'crossroads', n: 12, title: 'Kingsroad Wilds', text: 'The Kingsroad is the lifeblood of trade. Clear 12 beasts from the Kingsroad Wilds.', reward: { coin: 1400, status: 14 } });
      add({ id: f + '_grimmaw', f, giver: 'bounty', lv: 16, type: 'boss', boss: 'grimmaw', title: 'Old Grimmaw', text: 'An enormous old bear called Grimmaw has killed three caravans near the crossroads. End it.', reward: { coin: 1600, status: 20, item: { k: 'jewel', slot: 'neck', tier: 1 } } });
      add({ id: f + '_lily', f, giver: 'healer', lv: 21, type: 'collect', item: 'Swamp Lily', mobs: ['lizard_shaman'], n: 6, title: 'The Swamp Lily', text: 'The lizardman shamans of Dreadmire carry Swamp Lilies. I need 6 for a cure.', reward: { coin: 2200, status: 14, item: { k: 'potion', tier: 2, n: 5 } } });
      add({ id: f + '_mire', f, giver: 'captain', lv: 23, type: 'kill', region: 'dreadmire', n: 12, title: 'Dreadmire Menace', text: 'Patrols vanish in the Dreadmire. Kill 12 of its creatures.', reward: { coin: 2600, status: 18 } });
      add({ id: f + '_brood', f, giver: 'scholar', lv: 24, type: 'boss', boss: 'broodmother', title: 'The Brood Mother', text: 'A monstrous spider queen nests in the Dreadmire. Slay Brood Mother Ixa.', reward: { coin: 3200, status: 30, item: { k: 'weapon', tier: 2, q: 1.2 } } });
      add({ id: f + '_sky', f, giver: 'bounty', lv: 25, type: 'boss', boss: 'skyrender', title: 'Skyrender', text: 'A golden griffon named Skyrender hunts north of the crossroads. Bring it down.', reward: { coin: 3400, status: 30 } });
      add({ id: f + '_barrows', f, giver: 'healer', lv: 28, type: 'kill', region: 'ashen', n: 15, title: 'Laying the Dead to Rest', text: 'The dead do not sleep in the Ashen Barrows. Put 15 of them to rest.', reward: { coin: 4500, status: 25 } });
      add({ id: f + '_shepherd', f, giver: 'scholar', lv: 34, type: 'boss', boss: 'shepherd', title: 'The Pale Shepherd', text: 'Something herds the dead of the barrows like sheep. Find the Pale Shepherd and destroy it.', reward: { coin: 7000, status: 45, item: { k: 'armor', slot: 'head', tier: 3, q: 1.2 } } });
      add({ id: f + '_peaks', f, giver: 'captain', lv: 34, type: 'kill', region: 'ironspine', n: 12, title: 'Giants of Ironspine', text: 'Trolls and giants come down from Ironspine Peaks. Kill 12.', reward: { coin: 7000, status: 30 } });
      add({ id: f + '_toes', f, giver: 'bounty', lv: 36, type: 'collect', item: 'Giant Toe', mobs: ['hill_giant'], n: 6, title: 'A Grisly Bounty', text: 'The crown pays for giant toes. Do not ask why. Bring me 6.', reward: { coin: 8000, status: 30 } });
      add({ id: f + '_frost', f, giver: 'bounty', lv: 38, type: 'boss', boss: 'frostmane', title: 'Hrothgar Frostmane', text: 'The frost giant Hrothgar leads the giants of Ironspine. Cut off the head and the body will fall.', reward: { coin: 11000, status: 60, item: { k: 'weapon', tier: 4, q: 1.2 } } });
      add({ id: f + '_gloam', f, giver: 'captain', lv: 44, type: 'kill', region: 'gloamreach', n: 15, title: 'Gloam Vigil', text: 'The Gloamreach is the darkest place in the world. Kill 15 of its horrors.', reward: { coin: 15000, status: 45 } });
      add({ id: f + '_embers', f, giver: 'scholar', lv: 45, type: 'collect', item: 'Ember Essence', mobs: ['fire_elem', 'salamander'], n: 8, title: 'Ember Essences', text: 'Bring me 8 Ember Essences from the creatures of Dragonfall Crags.', reward: { coin: 16000, status: 45, item: { k: 'jewel', slot: 'ring', tier: 5, q: 1.15 } } });
      add({ id: f + '_cinder', f, giver: 'bounty', lv: 46, type: 'boss', boss: 'cinderjaw', title: 'Cinderjaw', text: 'The drake Cinderjaw burned an entire village. Slay it.', reward: { coin: 18000, status: 80 } });
      add({ id: f + '_shards', f, giver: 'healer', lv: 47, type: 'collect', item: 'Phylactery Shard', mobs: ['lich_acolyte'], n: 6, title: 'Shattered Souls', text: 'The lich acolytes carry fragments of stolen souls. Bring me 6 Phylactery Shards so I can free them.', reward: { coin: 20000, status: 50 } });
      // King quests
      const kb = D.BOSSES.filter((b) => b.king && b.king[0] === f).sort((a, b) => a.king[1] - b.king[1]);
      kb.forEach((b, i) => {
        const where = D.REGIONS[D.REGION_BY_ID[b.region]].name;
        add({ id: f + '_king' + i, f, giver: 'captain', lv: [1, 14, 24, 34, 44][i], bossLv: b.lv, type: 'boss', boss: b.id, king: i, key: b.chamber ? 'key_' + b.id : null, title: `The Captain's Charge: ${b.name}`,
          text: `${['A threat grows on our doorstep.', 'You have proven yourself. Now prove yourself again.', 'Our enemies whisper of a power in the dark places.', 'Few heroes have ever stood where you stand now.', 'This is the last and greatest charge I will ever give.'][i]} ${b.name} (level ${b.lv}) lurks in ${where}. ${b.chamber ? 'It is sealed in its lair. Take this key to open the door.' : 'It roams in the open.'} Slay it and ${F.city} will rise.`,
          reward: { coin: Math.round(b.lv * b.lv * 25), status: D.KING_STATUS[i], item: { k: 'weapon', tier: G.tierOfLevel(b.lv), q: 1.3 } }, req: i ? f + '_king' + (i - 1) : null });
      });
    }
  };
  Sys.kingQuestFor = function (c) { for (let i = 0; i < 5; i++) { const q = Sys.QUESTS[c.faction + '_king' + i]; if (!c.quests.done[q.id]) return q; } return null; };
  Sys.questsFor = function (npc) {
    const c = G.player.c; const out = { avail: [], active: [], ready: [] };
    if (!npc.city || npc.city !== c.faction) return out;
    for (const id in Sys.QUESTS) {
      const q = Sys.QUESTS[id]; if (q.f !== c.faction) continue;
      const turn = q.turnin || q.giver;
      if (c.quests.active[id]) { if (turn === npc.role && Sys.questComplete(q)) out.ready.push(q); else if (q.giver === npc.role) out.active.push(q); continue; }
      if (q.giver !== npc.role || c.quests.done[id]) continue;
      if (q.req && !c.quests.done[q.req]) continue;
      if (D.shown(c.level) >= D.shown(q.lv) - 1) out.avail.push(q);
    }
    return out;
  };
  Sys.npcMarker = function (npc) {
    if (!G.player || npc.type === 'guard') return null;
    const r = Sys.questsFor(npc); if (r.ready.length) return '?'; if (r.avail.length) return '!'; return null;
  };
  Sys.questProgress = function (q) {
    const c = G.player.c, st = c.quests.active[q.id]; if (!st) return 0;
    if (q.type === 'collect') return Math.min(q.n, Sys.countItem(q.item));
    if (q.type === 'deliver') return Sys.countItem(q.item) ? 0 : 0;
    if (q.type === 'boss') return st.n >= 1 ? 1 : 0;
    return st.n || 0;
  };
  Sys.questGoal = (q) => (q.type === 'boss' || q.type === 'deliver' ? 1 : q.n);
  Sys.questComplete = function (q) { if (q.type === 'deliver') return Sys.countItem(q.item) > 0; return Sys.questProgress(q) >= Sys.questGoal(q); };
  Sys.questNeeds = function (itemName) { const c = G.player.c; for (const id in c.quests.active) { const q = Sys.QUESTS[id]; if (q && q.type === 'collect' && q.item === itemName && Sys.countItem(itemName) < q.n) return true; } return false; };
  Sys.acceptQuest = function (q) {
    const c = G.player.c;
    c.quests.active[q.id] = { n: 0, tracked: true };
    // several quests can be tracked at once; the oldest tracked one drops off past five
    { const tr = Object.keys(c.quests.active).filter((id) => id !== q.id && c.quests.active[id].tracked); while (tr.length > 4) c.quests.active[tr.shift()].tracked = false; }
    if (q.type === 'deliver') Sys.addItem({ uid: U.uid(), kind: 'quest', name: q.item, icon: '📦', value: 0 });
    if (q.key) Sys.addItem({ uid: U.uid(), kind: 'key', key: q.key, name: `Key to ${D.BOSS_BY_ID[q.boss].name}'s Lair`, icon: '🗝', value: 0 });
    G.log(`Quest accepted: ${q.title}`, 'quest', '#ffd84a'); KR.A.sfx('quest', 0.6);
    KR.UI && KR.UI.refresh(); Sys.save();
  };
  Sys.turnIn = function (q) {
    const c = G.player.c;
    if (!Sys.questComplete(q)) return;
    if (q.type === 'collect') Sys.takeItem(q.item, q.n);
    if (q.type === 'deliver') Sys.takeItem(q.item, 1);
    if (q.key) { const k = c.inv.findIndex((x) => x && x.key === q.key); if (k >= 0) c.inv[k] = null; }
    delete c.quests.active[q.id]; c.quests.done[q.id] = 1;
    const r = q.reward; const qlv = q.bossLv || q.lv;
    const xp = D.xpNeeded(Math.max(1, Math.min(qlv, c.level))) * (q.king != null ? 0.9 : q.type === 'boss' ? 0.5 : 0.3);
    KR.A.sfx('quest');
    G.log(`Quest complete: ${q.title}!`, 'quest', '#ffd84a');
    KR.UI && KR.UI.toast('Quest complete', q.title);
    if (r.coin) { c.coins += r.coin; G.log(`You receive ${G.fmtCoins(r.coin)}.`, 'loot', '#f0d070'); KR.A.sfx('coin', 0.8); }
    if (r.item) { const it = Sys.rewardItem(r.item, qlv); if (Array.isArray(it)) it.forEach((x) => Sys.addItem(x)); else Sys.addItem(it); }
    // the king's, the bosses' and the main story's quests always pay in gear for your class when they name none
    else if (q.king != null || q.type === 'boss' || (q.main && !q.noGear)) { const k = Math.random() < 0.3 ? 'weapon' : 'armor'; Sys.addItem(Sys.rewardItem({ k, slot: U.pick(D.ARMOR_SLOTS), tier: G.tierOfLevel(Math.min(qlv, c.level)), q: 1.12 }, qlv)); }
    G.giveXp(xp, 'for completing the quest');
    if (r.status) Sys.addStatus(c.faction, r.status, q.title);
    KR.UI && KR.UI.refresh(); Sys.save();
  };
  Sys.rewardItem = function (spec, lv) {
    const c = G.player.c, C = D.CLASSES[c.cls]; const q = spec.q || 1.1; const tier = spec.tier;
    const ilvl = Math.max(2, Math.min(52, tier * 9 + 6));
    if (spec.k === 'weapon') { const wt = G.weaponType(c) !== 'H2H' || c.cls === 'monk' ? G.weaponType(c) : C.weapons[0]; return G.makeWeapon(wt, tier, { ilvl, q }); }
    if (spec.k === 'armor') return G.makeArmor(C.armor, spec.slot, tier, { ilvl, q });
    if (spec.k === 'jewel') return G.makeJewel(spec.slot, tier, { ilvl, q });
    if (spec.k === 'tool' && G.makeTool) return spec.kinds.map((k) => G.makeTool(k, spec.tier));
    if (spec.k === 'potion') { const a = G.makePotion('food', Math.min(4, tier)), b = G.makePotion('drink', Math.min(4, tier)); a.qty = b.qty = (spec.n || 3) * 2; return [a, b]; }
    return null;
  };
  Sys.questKill = function (e) {
    const c = G.player.c; const regId = D.REGIONS[W.regionAtPx(e.homeX, e.homeY)].id;
    for (const id in c.quests.active) {
      const q = Sys.QUESTS[id]; if (!q) continue; const st = c.quests.active[id];
      let hit = false;
      if (q.type === 'kill' && q.mobs && q.mobs.includes(e.mob)) hit = true;
      if (q.type === 'kill' && q.region && q.region === regId && !e.summoned && e.type === 'mob') hit = true;
      if (q.type === 'boss' && e.boss === q.boss) hit = true;
      if (hit && (st.n || 0) < Sys.questGoal(q)) { st.n = (st.n || 0) + 1; G.log(`${q.title}: ${st.n}/${Sys.questGoal(q)}`, 'quest', '#ffe89a'); if (st.n >= Sys.questGoal(q)) { G.log(`${q.title} is ready to turn in!`, 'quest', '#ffd84a'); KR.A.sfx('quest', 0.5); } }
    }
  };
  Sys.questTarget = function (q) {
    // returns [{x,y,r}] in tiles for map markers
    const c = G.player.c;
    if (Sys.questComplete(q) || q.type === 'deliver') { const role = q.turnin || q.giver; const n = G.ents.find((e) => e.city === c.faction && e.role === role); return n ? [{ x: n.x / TS, y: n.y / TS, r: 2, npc: true }] : []; }
    if (q.type === 'boss') { const b = D.BOSS_BY_ID[q.boss]; const ch = W.chambers[b.id]; return [{ x: ch ? ch.x + ch.w / 2 : b.at[0], y: ch ? ch.y + ch.h / 2 : b.at[1], r: 3, boss: true }]; }
    if (q.region) { const r = D.REGIONS[D.REGION_BY_ID[q.region]]; return r.seeds.map((s) => ({ x: s[0], y: s[1], r: 18 })); }
    if (q.mobs) {
      const pts = W.spawns.filter((s) => q.mobs.includes(s.mob)); if (!pts.length) return [];
      // cluster near player faction home: pick spawns closest to city
      const [cx, cy] = D.CITY_CENTER[c.faction];
      pts.sort((a, b) => Math.hypot(a.tx - cx, a.ty - cy) - Math.hypot(b.tx - cx, b.ty - cy));
      const near = pts.slice(0, 12); const mx = near.reduce((a, s) => a + s.tx, 0) / near.length, my = near.reduce((a, s) => a + s.ty, 0) / near.length;
      return [{ x: mx, y: my, r: 14 }];
    }
    return [];
  };

  // =============== VENDORS ===============
  // shops sell basic gear for your level band (1-5, 6-10, 11-15, 16-20); the best gear drops from named monsters,
  // mini-bosses and dungeon bosses, or comes from quests
  Sys.levelBand = (c) => Math.min(3, Math.floor((D.shown(c.level) - 1) / 5));
  Sys.bandTiers = (band) => { const lo = G.tierOfLevel(D.LV(band * 5 + 1)), hi = Math.min(4, G.tierOfLevel(D.LV(band * 5 + 5))); const t = []; for (let x = lo; x <= hi; x++) t.push(x); return t; };
  Sys.vendorStock = function (kind, npc) {
    const c = G.player.c, C = D.CLASSES[c.cls]; const band = Sys.levelBand(c);
    const tiers = Sys.bandTiers(band); const maxT = tiers[tiers.length - 1], top = [maxT];
    const out = [];
    const seed = U.mulberry((kind.length * 9973 + band * 31 + (npc ? npc.id : 0)) | 0);
    const oldR = Math.random; Math.random = seed;
    const F = npc && npc.city ? D.FACTIONS[npc.city] : null;
    const kinds = (list) => { const ok = list.filter((ak) => D.ARMOR_ALLOWED(c.cls).includes(ak)); return ok.length ? ok : list; };
    const armor = (aks, ts, q) => { for (const t of ts) for (const ak of kinds(aks)) for (const sl of D.ARMOR_SLOTS) out.push(G.makeArmor(ak, sl, t, { q })); };
    try {
      switch (kind) {
        case 'general': for (const wt of Object.keys(D.WEAPON_TYPES)) out.push(G.makeWeapon(wt, 0, { ilvl: 3 })); for (const ak of D.ARMOR_KINDS) for (const sl of ['chest', 'legs', 'head']) out.push(G.makeArmor(ak, sl, 0, { ilvl: 3 })); out.push(G.makeShield(0, { ilvl: 3 })); out.push(G.makePotion('food', 0), G.makePotion('drink', 0)); break;
        case 'inn': case 'outpost': for (let t = 0; t <= maxT; t++) out.push(G.makePotion('food', t), G.makePotion('drink', t)); out.push(G.makeAle((npc && npc.city) || 'crown')); break;
        case 'healer': for (let t = 0; t <= maxT; t++) out.push(G.makePotion('food', t), G.makePotion('drink', t)); break;
        // the blacksmith: plate, mail, shields and melee weapons; the tailor: cloth and leather
        case 'metal': armor(['plate', 'chain'], tiers, 0.88); for (const t of tiers) { for (const wt of C.weapons) out.push(G.makeWeapon(wt, t, { q: 0.88 })); out.push(G.makeShield(t, { q: 0.88 })); } break;
        case 'cloth': armor(['cloth', 'leather'], tiers, 0.88); break;
        // the arms merchant: armour your class can wear, your weapons (and ranged ones) and a shield if you carry one
        case 'arms': armor(D.ARMOR_ALLOWED(c.cls), tiers, 0.88); for (const t of tiers) { for (const wt of C.weapons.concat(C.ranged || [])) out.push(G.makeWeapon(wt, t, { q: 0.88 })); if (C.shield) out.push(G.makeShield(t, { q: 0.88 })); } break;
        // the alchemist: food and drink of every grade you can use, a grade beyond, and a few charms
        case 'alchemist': for (let t = 0; t <= Math.min(4, maxT + 1); t++) out.push(G.makePotion('food', t), G.makePotion('drink', t)); for (const t of tiers) out.push(G.makeJewel('neck', t, { q: 0.85 })); break;
        case 'mats': armor(['plate', 'chain'], top, 0.95); for (const wt of C.weapons) out.push(G.makeWeapon(wt, maxT, { q: 0.95 })); break;
        case 'scribe': for (const t of tiers) { out.push(G.makeWeapon('TOME', t)); out.push(G.makeWeapon('2HB', t, { q: 0.88 })); } break;
        case 'armorer': armor(D.ARMOR_ALLOWED(c.cls), tiers, 0.88); if (C.shield) for (const t of tiers) out.push(G.makeShield(t, { q: 0.88 })); break;
        case 'weaponsmith': for (const t of tiers) for (const wt of C.weapons) out.push(G.makeWeapon(wt, t, { q: 0.88 })); break;
        case 'outfitter': for (const t of tiers) { out.push(G.makeWorn('back', t, { q: 0.85 })); out.push(G.makeWorn('waist', t, { q: 0.85 })); } break;
        case 'fletcher': for (const t of tiers) for (const wt of ['ARC', 'THR']) out.push(G.makeWeapon(wt, t)); break;
        case 'bowyer': for (const wt of ['ARC', 'THR']) out.push(G.makeWeapon(wt, maxT, { q: 0.95 })); break;
        case 'jeweler': for (const t of tiers) { out.push(G.makeJewel('ring', t)); out.push(G.makeJewel('neck', t)); } break;
        case 'gems': for (const sl of ['ring', 'neck']) out.push(G.makeJewel(sl, maxT, { q: 0.95, bias: C.manaStat ? [C.manaStat, 'STA'] : ['STR', 'STA'] })); break;
        case 'grocer': for (let t = 0; t <= Math.min(4, maxT + 1); t++) out.push(G.makePotion('food', t), G.makePotion('drink', t)); break;
        case 'tinker': for (const t of tiers) { out.push(G.makeWeapon('THR', t)); if (C.shield) out.push(G.makeShield(t)); } break;
        case 'relics': for (const t of top) { out.push(G.makeWorn('back', t, { q: 0.95 })); out.push(G.makeWorn('waist', t, { q: 0.95 })); out.push(G.makeJewel('ring', t, { q: 0.95 })); } break;
        case 'armory': armor(D.ARMOR_ALLOWED(c.cls), top, 0.95); for (const t of tiers) { out.push(G.makeJewel('ring', t)); out.push(G.makeJewel('neck', t)); } break;
        case 'exchange': for (const wt of C.weapons.concat(C.ranged)) out.push(G.makeWeapon(wt, maxT, { q: 1.0 })); armor(D.ARMOR_ALLOWED(c.cls), top, 1.0); out.push(G.makeJewel('ring', maxT, { q: 1.0 }), G.makeJewel('neck', maxT, { q: 1.0 })); break;
      }
    } finally { Math.random = oldR; }
    out.forEach((it) => (it.uid = U.uid()));
    if (F && ['armorer', 'weaponsmith', 'armory', 'exchange', 'metal', 'cloth', 'mats', 'arms'].includes(kind)) out.forEach((it) => { if (it.kind !== 'consumable') it.fmark = F.id; });
    return out;
  };
  Sys.buy = function (it, qty = 1) {
    const c = G.player.c; const price = G.itemPrice(it) * qty;
    if (c.coins < price) { G.log("You can't afford that.", 'sys', '#ff8a6a'); KR.A.sfx('fail', 0.5); return false; }
    const copy = JSON.parse(JSON.stringify(it)); copy.uid = U.uid(); if (copy.stack) copy.qty = qty;
    if (!Sys.addItem(copy, true)) return false;
    c.coins -= price; KR.A.sfx('coin', 0.6); G.log(`You buy ${qty > 1 ? qty + ' ' : ''}${it.name} for ${G.fmtCoins(price)}.`, 'loot', '#f0d070');
    KR.UI && KR.UI.refresh(); return true;
  };
  Sys.sell = function (it, n) {
    const c = G.player.c; if (it.kind === 'quest' || it.kind === 'key') { G.log('You cannot sell that.', 'sys', '#aaa'); return; }
    const idx = c.inv.indexOf(it); if (idx < 0) return; // already sold (a second click on a stale slot while the game was busy)
    const have = it.qty || 1; const q = Math.max(1, Math.min(have, n || have)); const price = G.itemPrice(it, true) * q;
    let sold = it;
    if (q < have) { it.qty = have - q; sold = JSON.parse(JSON.stringify(it)); sold.uid = U.uid(); sold.qty = q; } else c.inv[idx] = null;
    c.coins += price; KR.A.sfx('coin', 0.6);
    G.log(`You sell ${q > 1 ? q + ' ' : ''}${it.name} for ${G.fmtCoins(price)}.`, 'loot', '#f0d070');
    (Sys.buyback = Sys.buyback || []).unshift(sold); Sys.buyback.length = Math.min(8, Sys.buyback.length);
    KR.UI && KR.UI.refresh();
  };
  // ---------- bard songs: toggled on, sung automatically every 16s, last 20s, no mana, no cast ----------
  // Hymns (buff songs) sing themselves while they sit on your hotbar. Clicking one pauses or resumes it.
  Sys.toggleSong = function (def) {
    const p = G.player, c = p.c; c.hymnOff = c.hymnOff || {};
    const onBar = Sys.bar().some((a) => a && a.k === 'spell' && a.id === def.id);
    if (!onBar) { G.log(`Put ${def.name} on your hotbar and it will sing itself automatically.`, 'spell', '#c8a8ff'); Sys.singSong(def, true); return; }
    if (c.hymnOff[def.id]) { delete c.hymnOff[def.id]; G.log(`You resume ${def.name}.`, 'spell', '#c8a8ff'); Sys.songTick(); }
    else { c.hymnOff[def.id] = true; delete (c.songsOn || {})[def.id]; G.log(`You pause ${def.name}. Click it again to resume.`, 'spell', '#c8a8ff'); KR.A.sfx('click'); }
    KR.UI && KR.UI.renderBar();
  };
  Sys.singSong = function (def, loud) {
    const p = G.player; p.songNext = p.songNext || {}; p.songNext[def.id] = G.now + D.SONG_PULSE * 1000;
    const d2 = Object.assign({}, def, { mana: 0, cast: 0, quiet: !loud, effects: def.effects.map((e) => Object.assign({}, e, { dur: D.SONG_DUR })) });
    const who = def.target === 'self' ? [p] : G.party(p).filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 450);
    if (loud && G.buffBlocked(p, def)) G.log(`${def.name} will not stack: a stronger effect of the same kind is already on you.`, 'spell', '#ffb24a');
    for (const e of who) G.applyEffects(p, e, d2);
    if (def.target !== 'self' && Sys.groupBuff) Sys.groupBuff(d2, p);
    G.schoolUp && G.schoolUp(p, 'Song'); if (loud) KR.A.sfx('song', 0.35);
    G.noteFx(p, def, loud ? 5 : 3);
  };
  Sys.songTick = function () {
    const p = G.player; if (!p || p.dead) return; const c = p.c; if (!D.CLASS_SPELLS[c.cls]) return;
    c.hymnOff = c.hymnOff || {}; const prev = c.songsOn || {}; const now = {};
    for (const a of Sys.bar()) { if (!a || a.k !== 'spell') continue; const def = D.SPELLS[a.id]; if (!def || !G.isToggleSong(def) || !c.spells.includes(a.id) || c.hymnOff[a.id]) continue; now[a.id] = true; }
    c.songsOn = now; let changed = Object.keys(prev).length !== Object.keys(now).length;
    for (const id in now) { const def = D.SPELLS[id]; if (!prev[id]) { changed = true; G.log(`You begin singing ${def.name}.`, 'spell', '#c8a8ff'); Sys.singSong(def, true); } else if (!p.songNext || (p.songNext[id] || 0) <= G.now) Sys.singSong(def); }
    if (changed) KR.UI && KR.UI.renderBar();
  };

  // ---------- player stances ----------
  Sys.setPlayerStance = function (id) {
    const p = G.player, c = p.c;
    if (c.pstance === id) return;
    if ((p.stanceCd || 0) > G.now) { G.log(`You can change stance again in ${Math.ceil((p.stanceCd - G.now) / 1000)}s.`, 'sys', '#ffb24a'); KR.A.sfx('fail', 0.4); return; }
    c.pstance = id; p.stanceCd = G.now + 5000; G.recalc(p);
    G.log(`You take up ${D.PSTANCES[id].name}. ${D.PSTANCES[id].desc}`, 'skill', '#ffd84a'); KR.A.sfx('equip', 0.7);
    G.fxAdd({ k: 'ring', x: p.x, y: p.y - 10, r: 40, col: '#ffd84a', life: 0.6 }); KR.UI && KR.UI.refresh();
  };
  Sys.canBindHere = function (p) { const reg = D.REGIONS[W.regionAtPx(p.x, p.y)]; if (reg.dungeon) return 'You cannot bind inside a dungeon.'; if (reg.city && reg.city !== p.c.faction) return 'You cannot bind in a rival city.'; if (reg.id === 'ocean') return 'You cannot bind at sea.'; return null; };
  Sys.bind = function () { const p = G.player; p.c.bind = { x: p.x, y: p.y }; G.log('You feel yourself bind to this place. You will return here when you fall or Gate.', 'sys', '#9ad8ff'); KR.A.sfx('gate'); Sys.save(); };

  // =============== TRAINING ===============
  Sys.trainable = function () { const c = G.player.c; return (D.CLASS_SPELLS[c.cls] || []).map((id) => D.SPELLS[id]); };
  Sys.trainSkill = function (id) {
    const c = G.player.c; const s = D.CLASSES[c.cls].skills.find((x) => x[0] === id); if (!s || G.hasSkill(c, id)) return; if (s[1] > c.level) { G.log('You are not ready to learn that.', 'sys', '#ff8a6a'); return; }
    const price = G.skillPrice(s[1]); if (c.coins < price) { G.log("You can't afford that.", 'sys', '#ff8a6a'); KR.A.sfx('fail', 0.5); return; }
    c.coins -= price; G.trainedSkills(c).push(id); KR.A.sfx('skillup'); const sk = D.SKILLS[id];
    G.log(`Your trainer teaches you ${sk ? sk.name : id}.${sk && !sk.passive && Sys.autoBar({ k: 'skill', id }) ? ' It is on your hotbar.' : ''}`, 'skill', '#9affb8'); KR.UI && KR.UI.refresh();
  };
  Sys.learnSpell = function (sp) {
    const c = G.player.c; if (c.spells.includes(sp.id)) return; if (sp.level > c.level) { G.log('You are not ready for that spell.', 'sys', '#ff8a6a'); return; }
    if (c.coins < sp.price) { G.log("You can't afford that.", 'sys', '#ff8a6a'); KR.A.sfx('fail', 0.5); return; }
    c.coins -= sp.price; c.spells.push(sp.id); KR.A.sfx('skillup'); G.log(`You scribe ${sp.name} into your spellbook.${Sys.autoBar({ k: 'spell', id: sp.id }) ? ' It is on your hotbar.' : ''}`, 'skill', '#c8a8ff');
    KR.UI && KR.UI.refresh();
  };

  // (crafting, refining and item upgrades are gone: gear comes from drops, shops and quests)
  Sys.hasMats = (mats) => mats.every(([m, t, q]) => Sys.countItem(D.MATERIALS[m][t]) >= q);

  // =============== BANK ===============
  Sys.deposit = function (it) { const b = G.account.bank; const i = b.items.indexOf(null); if (i < 0) { G.log('The bank is full.', 'sys', '#ff8a6a'); return; } const c = G.player.c; c.inv[c.inv.indexOf(it)] = null; b.items[i] = it; KR.A.sfx('open', 0.4); KR.UI.refresh(); Sys.saveAccount(); };
  Sys.withdraw = function (it) { const b = G.account.bank; if (!Sys.addItem(it, true)) return; b.items[b.items.indexOf(it)] = null; KR.A.sfx('open', 0.4); KR.UI.refresh(); Sys.saveAccount(); };
  Sys.depositCoins = function (n) { const c = G.player.c; n = Math.min(n, c.coins); c.coins -= n; G.account.bank.coins += n; KR.A.sfx('coin', 0.5); KR.UI.refresh(); Sys.saveAccount(); };
  Sys.withdrawCoins = function (n) { const b = G.account.bank; n = Math.min(n, b.coins); b.coins -= n; G.player.c.coins += n; KR.A.sfx('coin', 0.5); KR.UI.refresh(); Sys.saveAccount(); };

  // =============== MACROS ===============
  Sys.runMacro = function (id) {
    const m = (G.player.c.macros || []).find((x) => x.id === id); if (!m) return;
    const lines = m.lines.split('\n').map((s) => s.trim()).filter(Boolean);
    let delay = 0;
    for (const ln of lines) {
      const pm = ln.match(/^\/pause\s+([\d.]+)/i); if (pm) { delay += parseFloat(pm[1]) * 1000; continue; }
      setTimeout(() => Sys.command(ln), delay);
    }
  };
  // /stuck: step out of a wall, a rock or a snag to the nearest open ground close by. It only searches ground you could
  // walk to from where you last stood freely (never through a wall, a closed gate or into another building), and
  // when a city has shut its gates you stay on the side of the walls you were on.
  Sys.STUCK_CD = 60;
  Sys.unstick = function () {
    const p = G.player; if (!p || p.dead) return false;
    if (G.inCombat(p)) { G.log('You cannot use /stuck in combat.', 'sys', '#ffb24a'); return false; }
    const left = (p.stuckCd || 0) - G.now / 1000; if (left > 0) { G.log(`You can use /stuck again in ${Math.ceil(left)} seconds.`, 'sys', '#ffb24a'); return false; }
    const from = p.onWall || p.upB ? p : p.lastGood && Math.hypot(p.lastGood.x - p.x, p.lastGood.y - p.y) < TS * 6 ? p.lastGood : p;
    const sx = Math.floor(from.x / TS), sy = Math.floor(from.y / TS);
    const home = W.buildingAt(from.x, from.y);
    const WT = W.wallTop && (!W.realm || W.realm === 'main') ? W.wallTop : null;
    const loft = p.upB && p.upB.loft ? p.upB.loft : null;
    const inLoft = (x, y) => loft && x >= loft.x0 && x <= loft.x1 && y >= loft.y0 && y <= loft.y1;
    // which side of each city's walls you are on, for cities whose gates are shut
    const shut = KR.War && KR.War.gatesClosed ? D.FACTION_IDS.filter((f) => { try { return KR.War.gatesClosed(f); } catch (e) { return false; } }) : [];
    const inside = (f, x, y) => { const cd = W.cityData && W.cityData[f]; return !!cd && Math.abs(x - cd.cx) < cd.R && Math.abs(y - cd.cy) < cd.R; };
    const side0 = shut.map((f) => inside(f, sx, sy));
    const opts = { door: 'pass', swim: true, key: (k) => p.c.inv.some((it) => it && it.key === k) };
    const free = (x, y) => {
      if (!W.inb(x, y)) return false;
      if (p.onWall) return !!(WT && WT[y * W.W + x]);
      if (loft) return inLoft(x, y);
      if (WT && WT[y * W.W + x]) return false;
      if (W.isBlockedTile(x, y, opts) || W.buildingAt(x * TS + TS / 2, y * TS + TS / 2) !== home) return false;
      for (let k = 0; k < shut.length; k++) if (inside(shut[k], x, y) !== side0[k]) return false;
      return true;
    };
    // a spot with room around it: free itself, and no wall or rock in the eight tiles around
    const roomy = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!free(x + i, y + j)) return false; return true; };
    const R = 12, seen = new Set([sy * W.W + sx]); let q = free(sx, sy) ? [[sx, sy]] : []; let best = null, fallback = null;
    if (!q.length) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (free(sx + i, sy + j)) { q.push([sx + i, sy + j]); seen.add((sy + j) * W.W + sx + i); }
    while (q.length && !best) {
      const nq = [];
      for (const [x, y] of q) {
        if (roomy(x, y)) { best = [x, y]; break; }
        if (!fallback) fallback = [x, y];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = ny * W.W + nx; if (seen.has(k) || Math.abs(nx - sx) > R || Math.abs(ny - sy) > R) continue;
          seen.add(k); if (free(nx, ny) && !(W.edgeBlk && W.edgeBlk(x, y, dx, dy))) nq.push([nx, ny]);
        }
      }
      q = nq;
    }
    const to = best || fallback;
    if (!to) { G.log('There is no safe ground near you. Try walking back the way you came, or use a Gate spell or a teleport stone.', 'sys', '#ffb24a'); return false; }
    p.x = (to[0] + 0.5) * TS; p.y = (to[1] + 0.5) * TS; p.moveTo = null; p.chase = null; p.harvest = null; p.sit = false;
    p.lastGood = { x: p.x, y: p.y }; p.stuckCd = G.now / 1000 + Sys.STUCK_CD;
    G.log('You work yourself free and find your footing.', 'sys', '#9ad8ff');
    return true;
  };
  Sys.command = function (ln) {
    const p = G.player; if (!p) return;
    const [cmd, ...rest] = ln.trim().split(/\s+/); const arg = rest.join(' ');
    const lc = cmd.toLowerCase();
    const findSpell = (n) => p.c.spells.map((id) => D.SPELLS[id]).find((s) => s.name.toLowerCase() === n.toLowerCase());
    switch (lc) {
      case '/attack': if (arg === 'off') p.autoAttack = false; else if (arg === 'on') p.autoAttack = true; else p.autoAttack = !p.autoAttack; if (p.autoAttack && !p.target) KR.Main.targetNearest(); G.log(`Auto attack ${p.autoAttack ? 'on' : 'off'}.`, 'sys', '#ccc'); break;
      case '/cast': { const s = findSpell(arg); if (s) G.useAction({ k: 'spell', id: s.id }); else G.log(`You don't know a spell called "${arg}".`, 'sys', '#ffb24a'); break; }
      case '/use': case '/ability': { const n = arg.toLowerCase(); const sk = Object.keys(D.SKILLS).find((k) => D.SKILLS[k].name.toLowerCase() === n); if (sk) { G.useAction({ k: 'skill', id: sk }); break; } for (const wt in D.WEAPON_ABILITIES) { const i = D.WEAPON_ABILITIES[wt].findIndex((a) => a.name.toLowerCase() === n); if (i >= 0) { G.useAction({ k: 'weapon', id: wt + ':' + i }); return; } } const it = p.c.inv.find((x) => x && x.name.toLowerCase() === n); if (it) Sys.useItem(it); else G.log(`Unknown ability "${arg}".`, 'sys', '#ffb24a'); break; }
      case '/target': if (arg === 'nearest' || !arg) KR.Main.targetNearest(); else { const e = G.ents.filter((x) => !x.dead && x.name && x.name.toLowerCase().includes(arg.toLowerCase())).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; if (e) p.target = e; } break;
      case '/pet': Sys.petCommand(arg === 'attack' ? 'attack' : 'back'); break;
      case '/sit': p.sit = !p.sit; break;
      case '/range': if (['melee', 'ranged', 'both'].includes(arg)) { p.c.rangeMode = arg; G.log(`Combat mode: ${arg}.`, 'sys', '#ccc'); KR.UI.refresh(); } break;
      case '/say': G.say(p, arg, 4); Net.chat(arg); break;
      case '/ooc': case '/world': Net.chat(arg); G.log(`[World] ${p.name}: ${arg}`, 'world', '#9ad8ff'); break;
      case '/stuck': case '/unstuck': Sys.unstick(); break;
      case '/loc': G.log(`Your location is ${Math.floor(p.x / TS)}, ${Math.floor(p.y / TS)}.`, 'sys', '#ccc'); break;
      case '/who': G.log(`Players online here: ${Net.peers.length + 1}.`, 'sys', '#ccc'); Net.peers.forEach((pp) => G.log(` ${pp.n} — level ${pp.l} ${D.RACES[pp.r] ? D.RACES[pp.r].name : ''} ${D.CLASSES[pp.c] ? D.CLASSES[pp.c].name : ''}`, 'sys', '#ccc')); break;
      case '/help': G.log('Commands: /attack [on|off], /cast <spell>, /use <ability>, /target [name|nearest], /pet attack|back, /sit, /range melee|ranged|both, /say <text>, /world <text>, /loc, /stuck, /who, /pause <sec> (macros only)', 'sys', '#ccc'); break;
      default: if (!ln.startsWith('/')) { G.say(p, ln, 4); Net.chat(ln); } else G.log(`Unknown command ${cmd}. Type /help.`, 'sys', '#ffb24a');
    }
  };

  // =============== RIVALS / WORLD ===============
  Sys.worldTick = function (dt) {
    const a = G.account; if (!a) return;
    a.rivalT = (a.rivalT || 0) + dt;
    if (a.rivalT > 600) {
      a.rivalT = 0;
      const myLvl = a.cities[G.player.c.faction].level;
      for (const f of D.FACTION_IDS) { if (f === G.player.c.faction) continue; const city = a.cities[f]; if (city.level >= Math.min(5, myLvl + 1) && city.status >= (D.CITY_THRESHOLDS[city.level] || 0) - 1) continue; city.status = Math.min(city.status + 1 + Math.floor(Math.random() * 3), city.level >= myLvl + 1 ? (D.CITY_THRESHOLDS[city.level] || 1e9) - 1 : 1e9); while (city.level < 5 && city.status >= D.CITY_THRESHOLDS[city.level]) { city.level++; Sys.cityChanged(f, true); } }
    }
    Sys._eatT = (Sys._eatT || 0) + dt; if (Sys._eatT > 2) { Sys._eatT = 0; Sys.autoEat(); }
    Sys._zoneT = (Sys._zoneT || 0) + dt; if (Sys._zoneT > 0.2) { Sys._zoneT = 0; Sys.zoneTick && Sys.zoneTick(); Sys.songTick(); Sys.portalTick && Sys.portalTick(); }
    // weather
    G.weather.t -= dt;
    if (G.weather.t <= 0) { G.weather.type = U.pick(['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'rain', 'fog']); G.weather.t = 120 + Math.random() * 240; }
    // clock: 24 hours = 24 minutes real
    const prevClock = G.clock; G.clock = (G.clock + dt) % 1440; if (G.clock < prevClock) { a.day = (a.day || 0) + 1; G.log('A new day dawns. The mercenary traders have new faces for hire.', 'sys', '#e8d48a'); } a.clock = G.clock;
    // spawns
    const p = G.player;
    for (const sp of W.spawns) {
      const sx = sp.tx * TS, sy = sp.ty * TS;
      const d = Math.abs(sx - p.x) + Math.abs(sy - p.y);
      if (sp.ent) {
        if (d > 2400 && !sp.ent.inCombat && !sp.ent.dead) { G.remove(sp.ent); sp.ent = null; sp.timer = 0; }
        continue;
      }
      if (sp.timer > 0) { sp.timer -= dt; continue; }
      if (sp.city) { const cd = W.cityData[sp.city]; if (cd && Math.max(Math.abs(sp.tx - cd.cx), Math.abs(sp.ty - cd.cy)) <= cd.R + 3) { sp.timer = 30; continue; } }
      if (d < 1700 && d > 380) {
        if (sp.boss) { const b = D.BOSS_BY_ID[sp.boss]; sp.ent = G.spawnBoss(sp, b); continue; }
        const reg = D.REGIONS[sp.ri]; const M = D.MOBS[sp.mob];
        const lo = Math.max(reg.lv[0], M.lv[0]), hi = Math.min(reg.lv[1], M.lv[1]);
        const lv = Math.max(1, Math.round(lo + (Math.max(lo, hi) - lo) * sp.lvR));
        sp.ent = G.spawnMob(sp, sp.mob, lv, { named: sp.named || Math.random() < 0.025 });
      }
    }
    // explore
    const ex = Math.floor(p.x / TS / 4), ey = Math.floor(p.y / TS / 4), EW = W.W >> 2;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const x = ex + i, y = ey + j; if (x >= 0 && y >= 0 && x < EW && y < EW) W.explored[y * EW + x] = 1; }
    // kings & guards respawn handled in updateGuard
  };

  // =============== SAVE / LOAD ===============
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const Store = (Sys.Store = { db: null, uid: null, ready: false });
  Store.init = async function () {
    try {
      if (!window.claude || !window.claude.use) return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (db && user) { const id = await user.id(); if (id) { Store.db = db; Store.uid = id; } }
    } catch (e) {}
    Store.ready = true;
  };
  Store.col = () => Store.db.collection('data/users/' + Store.uid);
  Sys.defaultAccount = () => ({ bank: { coins: 0, items: new Array(48).fill(null) }, cities: { sylvan: { level: 1, status: 0 }, crown: { level: 1, status: 0 } }, chars: [], seed: 20261024, settings: { music: 0.5, sfx: 0.7 }, updated: 0 });
  Sys.withTimeout = (pr, ms) => Promise.race([pr, new Promise((r) => setTimeout(() => r(null), ms))]);
  Sys.loadAccount = async function () {
    let local = null; try { local = JSON.parse(LS.get('kr_account') || 'null'); } catch (e) {}
    let remote = null;
    if (Store.db) { try { const s = await Sys.withTimeout(Store.col().doc('account').get(), 4000); if (s && s.exists) remote = JSON.parse(JSON.stringify(s.data())); } catch (e) {} }
    let acc = remote && (!local || (remote.updated || 0) >= (local.updated || 0)) ? remote : local;
    if (!acc) acc = Sys.defaultAccount();
    const def = Sys.defaultAccount(); for (const k in def) if (acc[k] == null) acc[k] = def[k];
    while (acc.bank.items.length < 48) acc.bank.items.push(null);
    for (const f of D.FACTION_IDS) if (!acc.cities[f]) acc.cities[f] = { level: 1, status: 0 };
    if (acc.worldV !== 4) { for (const f of D.FACTION_IDS) acc.cities[f] = { level: 1, status: 0 }; acc.worldV = 4; acc.rivalT = 0; }
    for (const f in acc.cities) if (!D.FACTION_IDS.includes(f)) delete acc.cities[f];
    for (const ch of acc.chars) if (!D.FACTION_IDS.includes(ch.faction)) ch.faction = 'crown';
    acc.deleted = [...new Set([...(acc.deleted || []), ...((local && local.deleted) || []), ...((remote && remote.deleted) || [])])];
    if (acc.deleted) acc.chars = acc.chars.filter((x) => !acc.deleted.includes(x.id));
    G.account = acc;
    return acc;
  };
  Sys.loadChar = async function (id) {
    let local = null; try { local = JSON.parse(LS.get('kr_char_' + id) || 'null'); } catch (e) {}
    let remote = null;
    if (Store.db && !(local && Sys._remoteChecked && Sys._remoteChecked[id])) { try { const s = await Sys.withTimeout(Store.col().doc('char_' + id).get(), 3000); if (s && s.exists) remote = JSON.parse(JSON.stringify(s.data())); (Sys._remoteChecked = Sys._remoteChecked || {})[id] = 1; } catch (e) {} }
    const c = remote && (!local || (remote.updated || 0) >= (local.updated || 0)) ? remote : local;
    // starting hoods that read as a black blob were replaced: swap them on heroes made before
    const hd = c && c.equip && c.equip.head; const swap = hd && hd.plainClothes && { 'Bone Hood': 'necromancer', 'Black Hood': 'shadowknight' }[hd.name];
    if (swap && Sys.CLASS_OUTFITS[swap] && Sys.CLASS_OUTFITS[swap].head) { const [n2, col, icon] = Sys.CLASS_OUTFITS[swap].head; Object.assign(hd, { name: n2, col, icon: icon || hd.icon }); }
    return c;
  };
  let saveTimer = null, lastRemote = 0;
  Sys.charSummary = (c) => ({ id: c.id, name: c.name, race: c.race, cls: c.cls, level: c.level, faction: c.faction, gender: c.gender, skin: c.skin, hair: c.hair, hairStyle: c.hairStyle, app: c.app || null, updated: c.updated, zone: c.zone || '', look: c.lookSaved || null });
  Sys.saveAccount = function (force) {
    const a = G.account; if (!a) return;
    a.updated = Date.now();
    // in a hosted game the account holds the host's world; only the player's own world is saved here
    const out = Sys.persistable ? Sys.persistable(a) : a;
    LS.set('kr_account', JSON.stringify(out));
    if (Store.db && (force || Date.now() - lastRemote > 15000)) { lastRemote = Date.now(); Store.col().doc('account').set(JSON.parse(JSON.stringify(out))).catch(() => {}); }
  };
  Sys.save = function (force) {
    const p = G.player; if (!p || !G.account) return;
    const c = p.c; c.updated = Date.now(); c.pos = { x: p.x, y: p.y }; c.realm = W.realm || 'main'; c.hpSaved = p.hp; c.manaSaved = p.mana;
    try { const reg = D.REGIONS[W.regionAtPx(p.x, p.y)]; c.zone = W.realm && W.realm !== 'main' && W.REALMS[W.realm] ? W.REALMS[W.realm].name : reg ? reg.name : ''; c.lookSaved = JSON.parse(JSON.stringify(p.look || null)); } catch (e) {}
    const ex = W.realm === 'main' || !W.realms.main ? W.explored : W.realms.main.explored; let s = ''; for (let i = 0; i < ex.length; i++) s += String.fromCharCode(ex[i]); c.explored = btoa(s);
    const a = G.account; if (a.deleted && a.deleted.includes(c.id)) return;
    const idx = a.chars.findIndex((x) => x.id === c.id); const sum = Sys.charSummary(c); if (idx >= 0) a.chars[idx] = sum; else a.chars.push(sum);
    const json = JSON.stringify(c);
    LS.set('kr_char_' + c.id, json);
    Sys.saveAccount(force);
    if (Store.db && (force || Date.now() - (c._lastRemote || 0) > 20000)) { c._lastRemote = Date.now(); Store.col().doc('char_' + c.id).set(JSON.parse(json)).catch(() => {}); }
    G.lastSave = Date.now();
  };
  Sys.deleteChar = async function (id) {
    const a = G.account; a.chars = a.chars.filter((x) => x.id !== id); a.deleted = (a.deleted || []).concat(id).slice(-50); LS.del('kr_char_' + id); Sys.saveAccount(true);
    // remote delete runs in the background so the menu never waits on it
    if (Store.db) { try { Promise.resolve(Store.col().doc('char_' + id).delete()).catch(() => {}); } catch (e) {} }
  };

  // =============== MULTIPLAYER (presence in the hosted game's room, see online.js) ===============
  const Net = (Sys.Net = { room: null, peers: [], ok: false });
  // subscribe safely: a refused topic must never break the game
  Net.on = function (topic, fn) { try { const r = Net.room.on(topic, (m) => { try { fn(m); } catch (e) { console.warn(e); } }); if (r && r.catch) r.catch((e) => console.warn('room topic', topic, e)); } catch (e) { console.warn('room topic', topic, e); } };
  Net.init = async function () {
    try { const room = KR.Online && KR.Online.room; Net.peers = []; if (!room) { Net.room = null; Net.ok = false; return; } Net.room = room; Net.ok = true;
      if (Net.bound === room) return; Net.bound = room;
      room.onPeers((ch) => { if (Net.room !== room) return; const me = ch.peers.find((p) => p.isMe); if (me) Net.me = me.peer; Net.peers = ch.peers.filter((p) => !p.isMe && p.presence && p.presence.n).map((p) => Object.assign({ peer: p.peer, updatedAt: p.updatedAt }, p.presence)); Sys.onPeersChanged && Sys.onPeersChanged(); });
      Net.on('chat', (m) => { if (m.isMe || !m.data) return; const d = m.data; G.log(`[World] ${String(d.n || 'Someone').slice(0, 24)}: ${String(d.t || '').slice(0, 200)}`, 'world', '#9ad8ff'); const pp = Net.peers.find((x) => x.peer === m.peer); if (pp) pp.bubble = { text: String(d.t || '').slice(0, 120), until: Date.now() + 5000 }; });
      try { Sys.onNetReady && Sys.onNetReady(room); } catch (e) { console.warn(e); }
    } catch (e) { Net.ok = false; }
  };
  let lastPres = 0;
  Net.tick = function () {
    if (!Net.room || !G.player) return; KR.Online && KR.Online.tick(); const now = Date.now(); if (now - lastPres < 150) return; lastPres = now;
    const p = G.player, c = p.c, L = p.look || {};
    Net.room.presence({ n: c.name, r: c.race, c: c.cls, f: c.faction, g: c.gender, l: c.level, x: Math.round(p.x), y: Math.round(p.y), d: p.dir, m: p.moving ? 1 : 0, rm: W.realm || 'main', s: c.skin, h: c.hair, hs: c.hairStyle, w: L.weapon || null, a: L.armor ? L.armor.kind : 'none', dead: p.dead ? 1 : 0, ...(Sys.presenceExtra ? Sys.presenceExtra() : {}) }).catch(() => {});
  };
  Net.chat = function (t) { if (!Net.room) return; Net.room.emit('chat', { n: G.player.c.name, t: String(t).slice(0, 200) }).catch(() => {}); };
  Net.leave = function () { if (Net.room) Net.room.presence({ n: null, x: null, y: null }).catch(() => {}); };
})();
