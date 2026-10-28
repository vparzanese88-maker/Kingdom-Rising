// Kingdom Rising — core simulation: entities, stats, combat, abilities, spells, items, loot, AI
(function () {
  const KR = (window.KR = window.KR || {});
  const D = KR.D, U = KR.U, W = KR.W, T = KR.T;
  const G = (KR.G = {});
  const TS = D.TS;
  let NID = 1;
  G.ents = []; G.proj = []; G.fx = []; G.floaters = []; G.corpses = [];
  G.clock = 9 * 60; // minutes of day
  G.now = 0;
  G.weather = { type: 'clear', t: 120, rain: [] };
  G.msgs = [];

  // ---------- chat / log ----------
  G.log = function (text, ch = 'sys', color) { G.msgs.push({ text, ch, color, t: Date.now() }); if (G.msgs.length > 300) G.msgs.shift(); KR.UI && KR.UI.onLog && KR.UI.onLog({ text, ch, color }); };
  G.float = function (ent, text, col, big) { G.floaters.push({ x: ent.x + (Math.random() - 0.5) * 16, y: ent.y - (ent.h || 46), text: String(text), col: col || '#fff', t: 0, big }); };
  G.fxAdd = function (o) { o.t = 0; G.fx.push(o); return o; };
  G.say = function (ent, text, dur = 4.5) { if (ent && (ent.bell || ent.raidBoard || ent.barracks)) return; ent.bubble = { text, t: dur }; const p = G.player; if (p && Math.hypot(p.x - ent.x, p.y - ent.y) < 260) G.log(`${ent.name} says, "${text}"`, 'say', '#e8e0c8'); };

  // ---------- money ----------
  G.fmtCoins = function (c) { c = Math.max(0, Math.floor(c)); const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cp = c % 100; return (g ? g + 'g ' : '') + (g || s ? s + 's ' : '') + cp + 'c'; };

  // ---------- items ----------
  G.tierOfLevel = (lv) => U.clamp(Math.floor((lv - 1) / 9), 0, 5);
  G.makeWeapon = function (wt, tier, opt = {}) {
    const ilvl = opt.ilvl || tier * 9 + 4;
    const Wt = D.WEAPON_TYPES[wt];
    const q = opt.q || 1;
    const dmg = Math.round((4 + ilvl * 1.25) * (Wt.delay / 2.4) * Wt.mul * q);
    const base = D.WEAPON_BASES[wt][Math.min(5, tier)];
    const it = { uid: U.uid(), kind: 'weapon', wt, slot: Wt.ranged ? 'range' : 'primary', name: opt.name || `${D.TIER_ADJ[Math.min(5, tier)]} ${base}`, tier, ilvl, dmg, delay: Wt.delay, stats: {}, hp: 0, mana: 0, up: 0, icon: wIcon(wt) };
    if (Wt.hands === 2 && !Wt.ranged) it.twoHand = true;
    addStats(it, ilvl, q, opt.bias);
    it.value = Math.round(8 + ilvl * ilvl * 1.6 * q);
    it.req = 1;
    return it;
  };
  G.makeArmor = function (ak, slot, tier, opt = {}) {
    const ilvl = opt.ilvl || tier * 9 + 4;
    const q = opt.q || 1;
    const ac = Math.round(D.KIND_AC[ak] * (3 + ilvl * 0.9) * D.SLOT_AC[slot] * q);
    const it = { uid: U.uid(), kind: 'armor', ak, slot, name: opt.name || `${D.TIER_ADJ[Math.min(5, tier)]} ${D.ARMOR_BASES[ak][slot]}`, tier, ilvl, ac, stats: {}, hp: 0, mana: 0, up: 0, icon: aIcon(slot) };
    addStats(it, ilvl, q, opt.bias);
    if (ak === 'cloth') it.mana += Math.round(ilvl * 1.2 * q);
    it.value = Math.round(6 + ilvl * ilvl * 1.3 * q);
    it.req = 1;
    return it;
  };
  G.makeShield = function (tier, opt = {}) {
    const ilvl = opt.ilvl || tier * 9 + 4, q = opt.q || 1;
    const it = { uid: U.uid(), kind: 'armor', ak: 'shield', slot: 'secondary', shield: true, name: opt.name || `${D.TIER_ADJ[tier]} ${['Buckler', 'Round Shield', 'Kite Shield', 'Heater Shield', 'Tower Shield', 'Aegis'][tier]}`, tier, ilvl, ac: Math.round((4 + ilvl * 1.0) * q), stats: {}, hp: 0, mana: 0, up: 0, icon: '🛡' };
    addStats(it, ilvl, q * 0.6, opt.bias); it.value = Math.round(6 + ilvl * ilvl * 1.2 * q); it.req = 1;
    return it;
  };
  G.makeWorn = function (slot, tier, opt = {}) {
    const ilvl = opt.ilvl || tier * 9 + 4, q = opt.q || 1;
    const names = slot === 'back' ? ['Wool Cloak', 'Traveler\'s Cape', 'Silk Mantle', 'Embroidered Cloak', 'Runed Mantle', 'Starweave Cape'] : ['Rope Belt', 'Leather Belt', 'Studded Girdle', 'Silver Sash', 'Runed Girdle', 'Starmetal Belt'];
    const it = { uid: U.uid(), kind: 'armor', ak: 'misc', slot, name: opt.name || names[Math.min(5, tier)], tier, ilvl, ac: Math.round((2 + ilvl * 0.35) * q), stats: {}, hp: 0, mana: 0, up: 0, icon: slot === 'back' ? '🧣' : '🎗' };
    addStats(it, ilvl, q * 0.9, opt.bias); it.value = Math.round(8 + ilvl * ilvl * 1.3 * q); it.req = 1;
    return it;
  };
  G.uniqueRegen = function (it, u) {
    const b = u.bias || [], L = u.lvl;
    if (u.regen) it.regen = u.regen; else if (b.includes('STA')) it.regen = +(0.3 + L * 0.035).toFixed(1);
    if (u.manaRegen) it.manaRegen = u.manaRegen; else if (b.some((x) => x === 'WIS' || x === 'INT' || x === 'CHA')) it.manaRegen = +(0.2 + L * 0.025).toFixed(1);
    if (u.endRegen) it.endRegen = u.endRegen; else if (b.some((x) => x === 'STR' || x === 'AGI' || x === 'DEX')) it.endRegen = +(0.3 + L * 0.03).toFixed(1);
    return it;
  };
  G.makeUniqueWorn = function (u) { const it = G.makeWorn(u.slot, G.tierOfLevel(u.lvl), { ilvl: u.lvl + 4, q: 1.35, bias: u.bias, name: u.name }); if (u.haste) it.haste = u.haste; it.unique = u.id; it.fx = u.fx; it.lore = u.lore; it.value = Math.round(it.value * 3); if (u.slot === 'neck') it.icon = '📿'; else if (u.slot === 'ring') it.icon = '💍'; G.uniqueRegen(it, u); return it; };
  G.makeJewel = function (slot, tier, opt = {}) {
    const ilvl = opt.ilvl || tier * 9 + 4, q = opt.q || 1;
    const names = slot === 'ring' ? ['Copper Ring', 'Silver Ring', 'Gold Ring', 'Mithril Band', 'Star Ring', 'Ring of Kings'] : ['Bone Charm', 'Silver Amulet', 'Jade Pendant', 'Mithril Torc', 'Star Amulet', 'Crown Medallion'];
    const it = { uid: U.uid(), kind: 'jewel', slot, name: opt.name || names[tier], tier, ilvl, ac: 0, stats: {}, hp: Math.round(ilvl * 1.5 * q), mana: Math.round(ilvl * 1.5 * q), up: 0, icon: slot === 'ring' ? '💍' : '📿' };
    addStats(it, ilvl, q * 1.3, opt.bias); it.value = Math.round(10 + ilvl * ilvl * 1.8 * q); it.req = 1;
    return it;
  };
  function addStats(it, ilvl, q, bias) {
    const n = 1 + Math.floor(ilvl / 18) + (q > 1.05 ? 1 : 0) + (q > 1.25 ? 1 : 0);
    // armour and weapons roll the stats their wearers use (no Intelligence on a warrior's plate); jewels roll anything
    const kp = it.kind === 'armor' && D.KIND_STATS && D.KIND_STATS[it.ak] ? D.KIND_STATS[it.ak] : it.kind === 'weapon' && D.WEAPON_STATS ? D.WEAPON_STATS[it.wt] || ['STR', 'STA', 'AGI', 'DEX'] : null;
    if (kp && !bias) bias = kp.slice().sort(() => Math.random() - 0.5);
    const pool = kp ? bias.concat(kp) : bias ? bias.concat(D.STATS) : D.STATS;
    for (let i = 0; i < n; i++) { const s = bias && i < 2 ? bias[i] : pool[Math.floor(Math.random() * pool.length)]; it.stats[s] = (it.stats[s] || 0) + Math.max(1, Math.round((1 + ilvl / 4.2) * q * (0.75 + Math.random() * 0.4))); }
    // heavy armour carries health; plate, chain and leather sometimes steady breathing (endurance) too
    const heavy = it.kind === 'armor' && (it.ak === 'plate' || it.ak === 'chain');
    if (ilvl > 10 && (heavy || Math.random() < 0.5)) it.hp += Math.round(ilvl * (it.ak === 'plate' ? 1.8 : heavy ? 1.4 : 1.2) * q);
    if (it.kind === 'armor' && ['plate', 'chain', 'leather'].includes(it.ak) && ilvl > 10 && Math.random() < 0.35) it.endRegen = +((it.endRegen || 0) + 0.2 + ilvl * 0.012 * q).toFixed(1);
  }
  function wIcon(wt) { return { '1HS': '🗡', '2HS': '⚔', '1HB': '🔨', '2HB': '🪄', '1HP': '🔪', 'H2H': '🥊', 'ARC': '🏹', 'THR': '🌟', 'TOME': '📕' }[wt]; }
  function aIcon(slot) { return { head: '⛑', chest: '🥋', hands: '🧤', legs: '👖', feet: '🥾' }[slot] || '🛡'; }
  G.makeMat = function (type, tier, qty = 1) { const name = D.MATERIALS[type][tier]; return { uid: U.uid(), kind: 'mat', mat: type, tier, name, icon: D.MAT_ICON[type], stack: true, qty, value: Math.round(6 + tier * tier * 18) }; };
  // each kind of monster part gets its own icon (only real bones look like bones)
  const TROPHY_ICONS = { 'Wolf Pelt': '🐺', 'Dire Wolf Pelt': '🐺', 'Frost Pelt': '🐺', 'Tiger Pelt': '🐯', 'Yeti Fur': '❄️', 'Troll Hide': '🧌', 'Jackal Hide': '🐕', 'Bear Claw': '🐻', 'Ghoul Claw': '🐾', 'Scorpion Stinger': '🦂',
    'Ogre Tusk': '🦷', 'Orc Tooth': '🦷', 'Croc Tooth': '🐊', 'Dragonkin Fang': '🐲', 'Ravager Horn': '🦬', 'Lizard Scale': '🦎', 'Drake Scale': '🐉', 'Wyvern Scale': '🐉', 'Snake Scale': '🐍', 'Harpy Feather': '🪶', 'Griffon Feather': '🪶',
    'Bat Wing': '🦇', 'Spider Silk': '🕸️', 'Venom Sac': '🧪', 'Glowing Gland': '🧪', 'Proboscis': '🦟', 'Ectoplasm': '👻', 'Wailing Essence': '👻', 'Wisp Essence': '✨', 'Void Essence': '🌑', 'Ember Essence': '🔥', 'Fiend Ember': '🔥',
    'Storm Crystal': '💎', 'Golem Core': '🪨', 'Phylactery Shard': '🔮', 'Stolen Coin Purse': '💰', 'Pirate Doubloon': '🪙', 'Pearl': '🦪', 'Orc Warband Badge': '🎖️', 'Cult Sigil': '🕯️', 'Goblin Totem': '🗿', 'Goblin Ear': '👂',
    'Rat Whisker': '🐀', 'Bandit Bandana': '🧣', 'Nomad Scarf': '🧣', 'Ancient Wrappings': '🩹', 'Straw Bundle': '🌾', 'Swamp Lily': '🪷', 'Heartwood': '🪵', 'Living Coral': '🪸', 'Crab Shell': '🦀', 'Scarab Shell': '🪲',
    'Boar Meat': '🍖', 'Giant Toe': '🦶', 'Cursed Plate Shard': '🛡️', 'Bone Chips': '🦴', 'Rotting Bone': '🦴' };
  G.trophyIcon = function (name) {
    const n = String(name || ''); if (TROPHY_ICONS[n]) return TROPHY_ICONS[n];
    const rules = [[/bone|skull/i, '🦴'], [/pelt|fur|hide|wool/i, '🧶'], [/tooth|fang|tusk/i, '🦷'], [/claw|talon/i, '🐾'], [/horn|antler/i, '🦬'], [/scale/i, '🦎'], [/feather|plume/i, '🪶'], [/wing/i, '🦇'], [/silk|web/i, '🕸️'],
      [/venom|gland|sac|ichor|blood/i, '🧪'], [/essence|ember|spirit|soul/i, '✨'], [/crystal|gem|shard|core/i, '💎'], [/coin|purse|doubloon|gold/i, '🪙'], [/shell|carapace/i, '🐚'], [/meat|flesh|haunch/i, '🍖'], [/eye/i, '👁️'],
      [/totem|idol|sigil|badge|emblem/i, '🗿'], [/cloth|bandana|scarf|wrap|rag/i, '🧣'], [/lily|flower|herb|root|leaf|moss/i, '🌿'], [/wood|bark|branch/i, '🪵'], [/stinger/i, '🦂'], [/ear/i, '👂']];
    for (const [re, ic] of rules) if (re.test(n)) return ic;
    return '👜';
  };
  G.makeTrophy = function (name, lv, qty = 1) { return { uid: U.uid(), kind: 'trophy', name, icon: G.trophyIcon(name), stack: true, qty, value: Math.round(2 + lv * 2.5) }; };
  // Food restores health over time, drink restores mana over time. Better quality = faster regeneration.
  G.FOOD = ["Traveler's Bread", 'Cheese Wedge', 'Roast Meat Pie', "Hunter's Stew", 'Royal Feast'];
  G.DRINK = ['Water Flask', 'Spring Water', 'Honeyed Milk', 'Elven Nectar', 'Starwell Tonic'];
  G.foodRegen = (tier, lv) => +((0.3 + tier * 0.6) * (1 + lv / 16)).toFixed(1);
  G.drinkRegen = (tier, lv) => +((0.2 + tier * 0.35) * (1 + lv / 18)).toFixed(1);
  G.makePotion = function (type, tier = 0) {
    if (type === 'heal' || type === 'bread') type = 'food';
    if (type === 'mana' || type === 'water') type = 'drink';
    tier = Math.max(0, Math.min(4, tier | 0));
    const pot = { uid: U.uid(), kind: 'consumable', ctype: type, tier, stack: true, qty: 1 };
    if (type === 'food') { pot.name = G.FOOD[tier]; pot.icon = ['🍞', '🧀', '🥧', '🍲', '🍗'][tier]; pot.value = 4 + tier * tier * 30; }
    if (type === 'drink') { pot.name = G.DRINK[tier]; pot.icon = ['💧', '🫗', '🥛', '🍷', '✨'][tier]; pot.value = 4 + tier * tier * 30; }
    if (type === 'ale') { pot.name = 'Mug of ' + (opts_drink || 'Ale'); pot.icon = '🍺'; pot.value = 8; }
    return pot;
  };
  let opts_drink = 'Ale';
  G.makeAle = function (f) { opts_drink = D.FACTIONS[f] ? D.FACTIONS[f].drink : 'Ale'; const a = G.makePotion('ale'); opts_drink = 'Ale'; return a; };
  G.itemPrice = function (it, sell) { const cha = G.player ? G.player.stats.CHA : 75; const v = (it.value || 1) * (it.up ? 1 + it.up * 0.3 : 1); return Math.max(1, Math.round(sell ? v * (0.25 + (cha - 50) / 800) : v * (1.25 - (cha - 50) / 600))); };

  G.canUse = function (c, it) {
    if (!it) return { ok: false, why: '' };
    if (it.classes && !it.classes.includes(c.cls)) return { ok: false, why: `Only ${it.classes.map((k) => D.CLASSES[k].name + 's').join(', ')} can use this.` };
    const C = D.CLASSES[c.cls];
    if (it.kind === 'weapon') { if (!(C.weapons.includes(it.wt) || C.ranged.includes(it.wt))) return { ok: false, why: `${C.name}s cannot use ${D.WEAPON_TYPES[it.wt].name} weapons.` }; }
    if (it.kind === 'armor') {
      if (it.ak === 'misc') return { ok: true };
      if (it.shield) { if (!C.shield) return { ok: false, why: `${C.name}s cannot use shields.` }; }
      else if (!D.ARMOR_ALLOWED(c.cls).includes(it.ak)) return { ok: false, why: `${C.name}s cannot wear ${it.ak} armor.` };
    }
    return { ok: true };
  };
  G.itemSlot = function (it, c) {
    if (it.kind === 'weapon') {
      if (D.WEAPON_TYPES[it.wt].ranged) return 'range';
      return 'primary';
    }
    return it.slot;
  };
  G.upMul = (it) => 1 + (it.up || 0) * 0.1;

  // ---------- stats ----------
  G.recalc = function (p) {
    const c = p.c, R = D.RACES[c.race], C = D.CLASSES[c.cls];
    const st = {}; D.STATS.forEach((s) => (st[s] = R.stats[s] + (c.alloc[s] || 0) + (c.bonus[s] || 0)));
    let ac = 0, hpB = 0, manaB = 0, gR = 0, gM = 0, gE = 0;
    for (const sl of D.EQUIP_SLOTS) { const it = c.equip[sl]; if (!it) continue; const m = G.upMul(it); gR += it.regen || 0; gM += it.manaRegen || 0; gE += it.endRegen || 0; ac += Math.round((it.ac || 0) * m); hpB += Math.round((it.hp || 0) * m); manaB += Math.round((it.mana || 0) * m); for (const s in it.stats) st[s] += Math.round(it.stats[s] * m); }
    const mods = G.buffMods(p);
    D.STATS.forEach((s) => (st[s] = Math.min(D.STAT_CAP, st[s] + (mods[s] || 0))));
    ac += mods.ac || 0; hpB += mods.hp || 0;
    ac = Math.round((ac + st.AGI / 6 + c.level * 1.2) * (1 + (mods.acMul || 0)));
    p.stats = st; p.ac = ac;
    const oldMax = p.hpMax || 1, oldMana = p.manaMax || 1;
    p.hpMax = Math.round(40 + c.level * (10 + st.STA / 9) * C.hpMul) + hpB;
    const ms = C.manaStat;
    p.manaMax = ms ? Math.round(20 + c.level * (6 + st[ms] / 10) * (C.role === 'caster' ? 1 : 0.6)) + manaB : 0;
    if (mods.hpPct) p.hpMax = Math.round(p.hpMax * (1 + mods.hpPct)); if (mods.manaPct && p.manaMax) p.manaMax = Math.round(p.manaMax * (1 + mods.manaPct));
    if (p.hp == null) p.hp = p.hpMax; else if (p.hpMax !== oldMax) p.hp = Math.min(p.hpMax, p.hp);
    if (p.mana == null) p.mana = p.manaMax; else p.mana = Math.min(p.manaMax, p.mana);
    p.endurMax = Math.round((60 + c.level * 7 + st.STA * 0.35 + st.AGI * 0.2) * (1 + (mods.endPct || 0)));
    if (p.endur == null) p.endur = p.endurMax; else p.endur = Math.min(p.endurMax, p.endur);
    p.level = c.level;
    p.speed = 128 * (1 + Math.max(mods.speed || 0, 0)) * (1 - (p.snare || 0));
    let worn = 0; for (const sl of D.EQUIP_SLOTS) { const it = c.equip[sl]; if (it && it.haste) worn = Math.max(worn, it.haste); }
    p.wornHaste = worn; p.haste = U.clamp(worn + (mods.haste || 0), 0, 1.0);
    p.dmgMul = 1 + (mods.dmgMul || 0);
    p.spellCrit = p.c && p.c.cls === 'wizard' ? 0.12 + Math.min(0.08, p.level / 600) : 0;
    p.spellMul = 1 + (mods.spellMul || 0); p.healMul = 1 + (mods.healMul || 0); p.threatMul = 1 + (mods.threat || 0);
    p.rangedMul = 1 + (mods.rangedMul || 0);
    p.ds = mods.ds || 0; p.gearRegen = { hp: gR, mana: gM, end: gE }; p.regenB = (mods.regen || 0) + gR; p.manaRegenB = (mods.manaRegen || 0) + gM; p.endRegenB = (mods.endRegen || 0) + gE; p.regenPct = mods.regenPct || 0; p.endRegenPct = mods.endRegenPct || 0; p.dmgTaken = 1 + (mods.dmgTaken || 0); p.invuln = !!mods.invuln; // stance regen is a share of your whole regeneration, so it scales with level
    p.look = G.lookFor(c);
    if (p.type === 'merc') KR.Sys.applyStance(p);
  };
  const passCache = new Map();
  G.passiveMods = function (c) { const key = c.cls + '|' + c.level; let m = passCache.get(key); if (!m) { m = {}; for (const P of D.classPassives(c.cls)) if (P.level <= c.level) for (const k in P.mods) m[k] = (m[k] || 0) + P.mods[k]; if (D.classTraining) for (const [pk, lv] of D.classTraining(c.cls)) if (lv <= c.level && D.PASSIVES[pk]) for (const k in D.PASSIVES[pk].mods) m[k] = (m[k] || 0) + D.PASSIVES[pk].mods[k]; passCache.set(key, m); } return m; };
  G.buffMods = function (e) { const m = {}; for (const b of e.buffs) { if (!b.mods) continue; for (const k in b.mods) m[k] = (m[k] || 0) + b.mods[k]; }
    if (e.c && e.c.equip && (e.type === 'player' || e.type === 'merc') && G.setMods) { const sm = G.setMods(e.c); for (const k in sm) m[k] = (m[k] || 0) + sm[k]; }
    if (e.c && e.c.cls && (e.type === 'player' || e.type === 'merc')) { const pm = G.passiveMods(e.c); for (const k in pm) m[k] = (m[k] || 0) + pm[k]; } if (e.c && e.type === 'player' && e.c.pstance && D.PSTANCES[e.c.pstance]) { const sm = D.PSTANCES[e.c.pstance].mods; for (const k in sm) m[k] = (m[k] || 0) + sm[k]; } return m; };
  // class abilities: level-1 ones come with the class; the rest are trained at your guild for coin once you reach their level
  G.skillPrice = (lvl) => Math.round(40 + lvl * lvl * 24);
  G.trainedSkills = (c) => { if (!c.trained) { const C = D.CLASSES[c.cls]; c.trained = C.skills.filter((x) => x[1] > 1 && c.level >= x[1]).map((x) => x[0]); } return c.trained; }; // heroes from before keep what they had
  // class abilities and passives come with your level (only spells are bought from a trainer)
  G.hasSkill = (c, id) => { const C = D.CLASSES[c.cls]; const s = C.skills.find((x) => x[0] === id); return !!s && c.level >= s[1]; };
  G.weaponType = (c) => { const w = c.equip.primary; return w ? w.wt : 'H2H'; };
  G.rangedType = (c) => { const w = c.equip.range; return w ? w.wt : null; };
  G.wtName = (wt) => (wt === 'SHIELD' ? 'Block' : D.WEAPON_TYPES[wt] ? D.WEAPON_TYPES[wt].name : wt);
  // abilities use weapon damage per second (normalized to a 2.6s swing) so slow two-handers don't make every technique hit for huge numbers
  G.abilWeapon = function (p, hand) { const wd = G.weaponDmg(p, hand); if (!wd) return null; return Object.assign({}, wd, { dmg: (wd.dmg / wd.delay) * 2.6 }); };
  G.CLASS_MELEE = { warrior: 1.8, monk: 1.8, rogue: 1.75, berserker: 1.3, paladin: 1.25, shadowknight: 0.85, ranger: 1.35, bard: 1.65, beastlord: 1.55, arquebusier: 1.35, trollcaller: 1.0 };
  G.weaponDmg = function (p, hand) {
    if (!p.c) { if (hand === 'off' || hand === 'range') return null; return { dmg: Math.round(p.dmg || 5), delay: p.delay || 2.2, wt: p.wt || 'H2H' }; }
    const c = p.c; const w = hand === 'range' ? c.equip.range : hand === 'off' ? c.equip.secondary : c.equip.primary;
    if (!w || (hand === 'off' && w.kind !== 'weapon')) { if (hand === 'off') return null; const mk = c.cls === 'monk' || c.cls === 'beastlord'; return { dmg: Math.round((mk ? 4 + c.level * 1.25 : 2 + c.level * 0.5)), delay: mk ? 1.8 : 2.2, wt: 'H2H' }; }
    return { dmg: Math.round(w.dmg * G.upMul(w)), delay: w.delay, wt: w.wt };
  };

  // ---------- look (for rendering) ----------
  G.lookFor = function (c) {
    const chest = c.equip.chest, head = c.equip.head;
    const look = KR.S.classLook(c.cls, chest);
    look.race = c.race; look.gender = c.gender; look.skin = KR.S.skinOf(c.race, c.skin); if (D.RACES[c.race] && D.RACES[c.race].tusk) look.tusk = true; look.hair = KR.S.HAIRS[c.hair] || c.hair; look.hairStyle = c.hairStyle; look.cls = c.cls;
    if (c.app) Object.assign(look, c.app); // height, face, beard, scars and tattoos chosen at creation (3D)
    if (chest) { look.armor.kind = chest.ak; if (chest.ak === 'cloth') look.robe = true; if (chest.ak !== 'cloth' && D.CLASSES[c.cls].armor !== 'cloth') look.robe = false; }
    else if (D.CLASSES[c.cls].armor === 'cloth') look.armor.kind = 'cloth';
    if (look.armor.kind === 'plate') { look.armor.col = c.cls === 'shadowknight' ? '#3a3440' : c.cls === 'paladin' ? '#d8d4c8' : c.cls === 'bard' ? '#c8b070' : '#a8acb4'; look.armor.trim = D.CLASSES[c.cls].trim === '#c9ccd1' ? D.CLASSES[c.cls].color : D.CLASSES[c.cls].trim; }
    if (look.armor.kind === 'chain') { look.armor.col = '#8e9298'; look.armor.trim = D.CLASSES[c.cls].color; }
    if (look.armor.kind === 'leather') { look.armor.col = c.cls === 'monk' ? '#d9822b' : '#7a5532'; }
    if (head && (head.ak === 'plate' || head.ak === 'chain')) { look.helm = head.ak; look.helmCol = look.armor.kind === 'plate' ? look.armor.col : '#9a9ea6'; look.hat = ['ranger', 'rogue'].includes(c.cls) ? look.hat : null; }
    if (head && head.ak === 'leather' && !look.hat) { look.hat = 'hood'; look.hatCol = '#6a4a2a'; }
    if (c.cls === 'berserker' && chest) look.bare = false;
    // starting clothes keep their own colours, and only robes are drawn as robes
    if (chest && chest.plainClothes && !window.KR3D) { look.robe = /robe|vestment|gown|habit/i.test(chest.name || ''); if (chest.col) look.armor.col = chest.col; if (c.equip.legs && c.equip.legs.col) look.pants = c.equip.legs.col; }
    const pw = c.equip.primary;
    look.weapon = pw ? (pw.wt === '2HS' && (pw.axe || /Axe|axe|Executioner|Cleaver/.test(pw.name)) ? 'axe' : pw.wt === '1HB' && (pw.club || /Club|Cudgel/.test(pw.name)) ? 'club' : pw.wt) : (c.cls === 'monk' ? 'H2H' : null);
    look.wfx = pw && pw.fx || null;
    const sec = c.equip.secondary;
    look.offhand = sec ? (sec.shield ? 'shield' : sec.wt) : null; look.offFx = sec && sec.fx || null;
    const bk = c.equip.back; if (bk) look.cape = bk.fx === 'fire' ? '#b8401a' : bk.fx === 'storm' ? '#3a5aa0' : ['#6a5a4a', '#3a4a8a', '#6a3a8a', '#2a4a8a', '#8a2a4a', '#2a2458'][Math.min(5, bk.tier || 0)];
    look.shieldCol = sec && sec.shield && sec.wood ? '#8a5a2e' : D.FACTIONS[c.faction].banner; look.shieldEmb = sec && sec.wood ? '#c8a060' : D.FACTIONS[c.faction].trim;
    const rg = c.equip.range;
    if (rg && rg.wt === 'ARC') look.back = 'bow';
    look.rangeW = rg ? rg.wt : null;
    if (window.KR3D) { look.wItem = pw || null; look.oItem = sec || null; G.strictLook(look, c); } // 3D draws the actual items
    // a firearm is carried in both hands (its bayonet does the close work); the sword stays at the hip
    if (rg && rg.wt === 'GUN') { look.weapon = 'GUN'; look.wfx = rg.fx || null; look.offhand = null; if (window.KR3D) look.wItem = rg; }
    return look;
  };
  // which helmet a head piece is: the style follows its tier (open nasal helms for the crude ones, closed great
  // helms for the best) with some variety from the item itself; northern fighters wear horns or antlers
  G.helmStyleFor = function (head, c) {
    const t = Math.min(5, head.tier || 0); let h = 0; const id = String(head.uid || head.name || ''); for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const pick = (a) => a[h % a.length];
    if (head.ak === 'leather') return { helmStyle: 'cap' };
    if (head.ak === 'chain') return { helmStyle: t >= 2 ? 'coifcap' : 'coif' };
    const style = pick([['nasal', 'skull'], ['nasal', 'barbute'], ['barbute', 'sallet', 'nasal'], ['great', 'sallet', 'barbute'], ['great', 'barbute'], ['great'] ][t]);
    const north = c && (['berserker', 'beastlord', 'shaman'].includes(c.cls) || ['barbarian', 'ogrin'].includes(c.race));
    const crest = north ? ((h >> 3) % 2 ? 'antlers' : 'horns') : t >= 5 ? 'wings' : t >= 4 && (h >> 5) % 2 ? 'horns' : null;
    return { helmStyle: style, helmCrest: crest };
  };
  // 3D: a hero looks exactly like what they wear: no class hats, capes or robes that are not in the gear
  G.strictLook = function (look, c) {
    const E = c.equip, head = E.head, chest = E.chest, legs = E.legs;
    for (const k of ['hat', 'hatCol', 'hatTrim', 'hoodPoint', 'mask', 'horns', 'helmPlume', 'helmSpike', 'helm', 'helmCol', 'helmStyle', 'helmCrest', 'helmTier', 'orb', 'cape', 'sash']) delete look[k];
    if (head) {
      const n = head.name || '';
      if (head.ak === 'plate' || head.ak === 'chain' || (head.ak === 'leather' && !head.plainClothes)) {
        look.helm = head.ak; look.helmTier = head.tier || 0; Object.assign(look, G.helmStyleFor(head, c));
        look.helmCol = head.ak === 'plate' ? (look.armor.col || '#a8acb4') : head.ak === 'leather' ? '#6a4a2e' : '#9a9ea6';
        if (head.ak === 'plate' && !look.helmCrest && head.tier >= 2 && /sallet|barbute/.test(look.helmStyle)) look.helmPlume = D.CLASSES[c.cls].color;
      }
      else if (/sailor/i.test(n)) { look.hat = 'sailor'; look.hatCol = head.col || '#1e2a4a'; }
      else if (/mitre/i.test(n)) { look.hat = 'mitre'; look.hatCol = '#f1efe6'; look.hatTrim = '#c8a040'; }
      else if (/circlet|diadem|crown|tiara/i.test(n)) { look.hat = 'circlet'; look.hatTrim = '#e0c060'; }
      else if (/headband|band/i.test(n)) { look.hat = 'headband'; look.hatCol = D.CLASSES[c.cls].color; }
      else if (/wizard|pointed|conical/i.test(n)) { look.hat = 'wizard'; look.hatCol = D.CLASSES[c.cls].color; look.hatTrim = '#e2c55a'; }
      else if (/feather|cap|beret/i.test(n)) { look.hat = 'feather'; look.hatCol = D.CLASSES[c.cls].color; look.hatTrim = '#e3c04a'; }
      else { look.hat = 'hood'; look.hatCol = head.ak === 'leather' ? '#5a4030' : D.CLASSES[c.cls].color; }
      if (head.plainClothes && head.col && look.hat) { if (look.hat === 'circlet') look.hatTrim = head.col; else if (look.hat !== 'mitre') look.hatCol = head.col; } // starting clothes keep their own colours
    }
    const bk = E.back; if (bk) look.cape = bk.fx === 'fire' ? '#b8401a' : bk.fx === 'storm' ? '#3a5aa0' : ['#6a5a4a', '#3a4a8a', '#6a3a8a', '#2a4a8a', '#8a2a4a', '#2a2458'][Math.min(5, bk.tier || 0)];
    const shirt = chest && !chest.wrap;
    look.armor.kind = shirt ? chest.ak : 'none'; look.armor.tier = shirt ? chest.tier || 0 : 0;
    look.robe = !!(shirt && chest.ak === 'cloth' && /robe|vestment|gown|habit/i.test(chest.name || 'robe'));
    if (shirt && chest.ak === 'cloth' && !look.robe) look.armor.col = D.CLASSES[c.cls].color;
    look.noShirt = !shirt; look.wrap = !!(chest && chest.wrap) || (!shirt && c.gender === 'f');
    look.noPants = !legs || !!legs.loin;
    look.barefoot = !E.feet;
    look.bare = false;
    // plain clothes keep their own colours (a white silk shirt, navy trousers)
    if (shirt && chest.col) look.armor.col = chest.col;
    if (shirt && chest.cset && chest.trim) look.armor.trim = chest.trim; // a class set shows its own colours
    if (legs && !legs.loin && legs.col) look.pants = legs.col;
    if (shirt && /silk shirt/i.test(chest.name || '')) look.sleeves = 'long';
    look.shirtOnly = !!(shirt && chest.ak === 'cloth' && !look.robe && (chest.plainClothes || /shirt|tunic|blouse|doublet|jerkin/i.test(chest.name || '')));
    return look;
  };

  // ---------- entity factory ----------
  G.makeEnt = function (o) {
    const e = Object.assign({ id: NID++, x: 0, y: 0, r: 11, h: 46, dir: 0, face: 1, walk: 0, moving: false, hp: 10, hpMax: 10, mana: 0, manaMax: 0, level: 1, buffs: [], cds: {}, hate: new Map(), target: null, atkT: 1, atk: 0,
      dead: false, stun: 0, root: 0, mez: 0, fear: 0, snare: 0, cast: null, speed: 110, ac: 0, res: {}, dmgMul: 1, haste: 0, bubble: null, hostile: false, type: 'mob' }, o);
    G.ents.push(e);
    return e;
  };
  G.remove = function (e) { const i = G.ents.indexOf(e); if (i >= 0) G.ents.splice(i, 1); e.removed = true; if (G.player && G.player.target === e) G.player.target = null; };

  G.mobHp = (lv) => Math.round(16 + lv * 8 + lv * lv * 0.55);
  G.BOSS_HP = 4.8; G.BOSS_DMG = 2.3;
  G.spawnMob = function (sp, mobId, lv, opt = {}) {
    const M = D.MOBS[mobId];
    const named = opt.named;
    const e = G.makeEnt({ type: 'mob', mob: mobId, kind: M.kind, col: M.col, name: named && !M.named ? `${U.pick(['Fearsome', 'Scarred', 'Old', 'Grizzled', 'Cunning', 'Savage', 'Dread'])} ${M.name}` : M.name, level: lv, x: sp.tx * TS + 16, y: sp.ty * TS + 16,
      hostile: true, passive: ['rat', 'snake', 'beetle', 'spiderling', 'wisp', 'boar', 'bat'].includes(mobId), undead: !!M.undead, social: !!M.social, ranged: M.ranged || null, healer: !!M.heal, fly: !!M.fly,
      res: Object.assign({}, M.res || {}), drop: M.drop, mat: M.mat, coinMul: M.coin || 1, weapon: M.weapon, spawn: sp, homeX: sp.tx * TS + 16, homeY: sp.ty * TS + 16, named, seed: Math.random(), regen: M.regen });
    e.hpMax = Math.round(G.mobHp(lv) * G.MOB_HP_MUL * (named ? 2.2 : 1) * (M.kind === 'troll' || M.kind === 'giant' || M.kind === 'ogre' || M.kind === 'golem' ? 1.25 : 1)); e.hp = e.hpMax;
    e.dmg = Math.round((3 + lv * 2.0) * (named ? 1.3 : 1)); e.delay = 2.2; e.speed = 100 + (['wolf', 'spider', 'drake', 'griffon', 'harpy', 'bat', 'mosquito'].includes(M.kind) ? 25 : 0);
    e.aggroR = 150; e.scale = M.scale || (named ? 1.2 : 1);
    if (['troll', 'giant', 'ogre', 'golem', 'bear', 'treant'].includes(M.kind)) { e.r = 18; e.h = 70; }
    e.manaMax = e.healer ? 60 : e.ranged === 'caster' ? 100 : 0; e.mana = e.manaMax;
    if (D.mobClassOf) { e.mclass = D.mobClassOf(mobId, M); const kit = D.MOB_CLASS_KITS[e.mclass] || []; e.mabil = kit.slice(0, D.mobAbilityCount(lv, named)).filter((k) => !(k === 'mheal' && e.healer)); e.abCd = {}; e.abT = 2 + Math.random() * 3; }
    return e;
  };
  G.spawnBoss = function (sp, b) {
    const e = G.makeEnt({ type: 'mob', boss: b.id, kind: b.kind, col: b.col, name: b.name, level: b.lv, x: sp.tx * TS + 16, y: sp.ty * TS + 16, hostile: true, undead: !!b.undead, spawn: sp, homeX: sp.tx * TS + 16, homeY: sp.ty * TS + 16,
      res: { fire: 20, cold: 20, magic: 20, poison: 20, disease: 20 }, scale: b.scale, abil: b.abil || [], weapon: b.weapon, r: 22, h: 90, coinMul: 6, seed: 0.4, mat: 'arcane' });
    e.hpMax = Math.round(G.mobHp(b.lv) * G.BOSS_HP); e.hp = e.hpMax; e.dmg = Math.round((3 + b.lv * 2.0) * G.BOSS_DMG); e.delay = 2.5; e.speed = 140; e.aggroR = 130; // bosses outrun players so they cannot be kited forever
    e.manaMax = 1000; e.mana = 1000; e.leash = 700; e.bossT = { slam: 8, bolt: 5, aoe: 14, adds: 20, fear: 25, breath: 12 };
    return e;
  };

  // ---------- hate ----------
  G.addHate = function (mob, src, amt) {
    if (!mob || mob.dead || mob.type === 'npc' || !src) return;
    if (src.type === 'pet' && src.owner && !mob.hate.has(src.owner)) mob.hate.set(src.owner, 1);
    mob.hate.set(src, (mob.hate.get(src) || 0) + Math.max(1, amt * (src.threatMul || 1)));
    if (mob.mez) { mob.mez = 0; }
    if (!mob.inCombat) { mob.inCombat = true; G.onAggro(mob, src); }
  };
  G.topHate = function (mob) {
    let best = null, bv = -1;
    let pet = null, pv = -1; // a pet with taunt off is ignored while anyone else is in the fight
    for (const [e, v] of mob.hate) { if (e.dead || e.removed || e.fd) { mob.hate.delete(e); continue; } if (e.type === 'pet' && e.owner && e.owner.c && e.owner.c.petTaunt === false) { if (v > pv) { pv = v; pet = e; } continue; } if (v > bv) { bv = v; best = e; } }
    return best || pet;
  };
  // creature voices: growls, groans, hisses... by creature kind, panned and pitched by size
  const SMALL = { rat: 1.35, bat: 1.4, beetle: 1.3, mosquito: 1.2, spider: 1.1, wisp: 1.2, goblin: 1.15, snake: 1.1 };
  G.mobVoice = function (m, what, chance = 1) {
    const p = G.player; if (!p || !m || Math.random() > chance) return;
    const kind = m.type === 'guard' || m.type === 'king' ? 'guard' : m.kind; if (!kind) return;
    const dx = m.x - p.x, dist = Math.hypot(dx, m.y - p.y); if (dist > 650) return;
    if (what !== 'die' && (m.voiceT || 0) > G.now) return; m.voiceT = G.now + (what === 'aggro' ? 1500 : 2600);
    const pitch = (SMALL[kind] || 1) / Math.pow(m.scale || 1, 0.6) * (0.92 + Math.random() * 0.16) * (m.boss ? 0.8 : 1);
    KR.A.voice && KR.A.voice(kind, what, pitch, (m.boss ? 0.8 : 0.45) * (1 - dist / 900), U.clamp(dx / 500, -0.8, 0.8));
  };
  G.onAggro = function (mob, src) {
    G.mobVoice(mob, 'aggro');
    if (mob.social) for (const o of G.ents) if (o !== mob && o.type === 'mob' && !o.dead && o.mob && D.MOBS[o.mob] && o.social && !o.inCombat && Math.hypot(o.x - mob.x, o.y - mob.y) < 170 && (o.kind === mob.kind)) G.addHate(o, src, 1);
    if (src === G.player || (src.owner === G.player)) KR.Main && KR.Main.onCombat && KR.Main.onCombat();
    if (mob.boss) G.log(`${mob.name} roars in fury!`, 'combat', '#ff8a5a');
  };

  // ---------- damage / healing ----------
  G.cheat = { god: false, oneshot: false }; // test cheats: off unless switched on in the Cheats window (cheats.js, F8)
  // level gap: monsters above you hit harder and shrug off more of your damage; monsters below you are easier.
  G.LVL_UP_DMG = 0.1; G.LVL_UP_DEF = 0.11;
  G.lvlScale = function (src, tgt) {
    if (!src || !tgt || src === tgt) return 1;
    const hero = (e) => (e.type === 'player' ? e : (e.type === 'pet' || e.type === 'merc') && e.owner ? e.owner : null);
    if (src.type === 'mob' && !src.boss && hero(tgt)) { const g = src.level - hero(tgt).level; return g > 0 ? 1 + g * G.LVL_UP_DMG + Math.max(0, g - 3) ** 2 * 0.03 : Math.max(0.6, 1 + g * 0.04); }
    if (tgt.type === 'mob' && !tgt.boss && src.type !== 'mob' && hero(src)) { const g = tgt.level - hero(src).level; return g > 0 ? 1 / (1 + g * G.LVL_UP_DEF + Math.max(0, g - 3) ** 2 * 0.03) : Math.min(1.25, 1 - g * 0.03); }
    return 1;
  };
  G.MOB_HP_MUL = 1.5;
  G.damage = function (src, tgt, amt, opt = {}) {
    if (!tgt || tgt.dead || amt <= 0) return 0;
    if (tgt.invuln || (tgt.type === 'npc' && !(src && src.raider))) { G.float(tgt, 'IMMUNE', '#ccc'); return 0; }
    // every class hits with its balance weight (D.CLASS_POWER), heroes, their pets and class mercenaries alike
    { const ow = src && (src.c ? src : src.owner && src.owner.c ? src.owner : null); if (ow && D.CLASS_POWER && !tgt.c && tgt.type !== 'player') { const P = D.CLASS_POWER[ow.c.cls] || 1; amt *= 1 + (P - 1) * Math.pow(U.clamp(((ow.c.level || 1) - 1) / 49, 0, 1), 0.8); } } // the weight grows in with level: low levels stay as they were
    amt = Math.round(amt * (tgt.dmgTaken || 1) * G.lvlScale(src, tgt));
    // rune
    const rune = tgt.buffs.find((b) => b.rune > 0);
    if (rune) { const ab = Math.min(rune.rune, amt); rune.rune -= ab; amt -= ab; if (rune.rune <= 0) tgt.buffs.splice(tgt.buffs.indexOf(rune), 1); if (ab) G.float(tgt, 'absorbed ' + ab, '#9ad8ff'); }
    if (amt <= 0) return 0;
    tgt.hp -= amt;
    if (src && (src === G.player || src.owner === G.player || (src.owner && src.owner.owner === G.player))) tgt.tagged = true;
    tgt.lastHit = G.now;
    if (tgt.fd) tgt.fd = false;
    if (tgt.cast && tgt.cast.spell && !opt.dot) {
      const chan = (tgt.type === 'player' || tgt.type === 'merc') && G.hasSkill(tgt.c, 'channeling') ? 0.55 : tgt.type === 'merc' ? 0.7 : 0.85;
      let odds = chan * 0.45;
      // players: light hits rarely break a spell, heavy ones more often, and new heroes get extra leeway
      if (tgt.type === 'player') odds = (0.1 + 0.2 * Math.min(1, amt / Math.max(1, tgt.hpMax * 0.25))) * (chan / 0.85) * (tgt.level <= 10 ? 0.6 : tgt.level <= 20 ? 0.8 : 1);
      if (Math.random() < odds) { G.interrupt(tgt, 'Your spell is interrupted!'); }
    }
    if (tgt.sit) { tgt.sit = false; }
    const pcol = tgt === G.player ? '#ff6a5a' : opt.crit ? '#ffd84a' : opt.spell ? '#c8a8ff' : '#ffffff';
    G.float(tgt, (opt.crit ? '★' : '') + amt, pcol, opt.crit);
    if (src && amt > 0) (tgt._hurtBy || (tgt._hurtBy = new Set())).add(src); // pets only join a fight their owner has actually drawn blood in
    if (tgt.type === 'mob' || tgt.type === 'guard' || tgt.type === 'king') { G.addHate(tgt, src, amt * (opt.hateMul || 1)); if (tgt.hp > 0) G.mobVoice(tgt, 'hurt', opt.crit ? 0.8 : 0.25); }
    if (tgt === G.player) { KR.A.sfx('hurt', 0.4); KR.Main && KR.Main.onCombat && KR.Main.onCombat(); if (src && !G.player.target && src.hostile && !src.dead) G.player.target = src; }
    if ((tgt.type === 'pet' || tgt.type === 'merc') && src && src.hostile && !tgt.target) tgt.target = src;
    if (tgt.hp <= 0) G.kill(tgt, src);
    return amt;
  };
  G.heal = function (src, tgt, amt, opt = {}) {
    if (!tgt || tgt.dead) return 0;
    if (src && src.healMul) amt *= src.healMul;
    const real = Math.min(Math.round(amt), tgt.hpMax - tgt.hp);
    tgt.hp += real;
    if (real > 0 || opt.show) G.float(tgt, '+' + Math.round(amt), '#7aff8a');
    if ((src === G.player || (src && src.owner === G.player)) && real > 0) for (const m of G.ents) if (m.type === 'mob' && m.hate.has(tgt)) G.addHate(m, src, real * 0.5);
    return real;
  };
  G.interrupt = function (e, msg) { if (!e.cast) return; e.cast = null; if (e === G.player) { G.log(msg || 'Your spell is interrupted.', 'combat', '#ffb24a'); KR.A.sfx('fizzle', 0.6); } };

  // ---------- melee ----------
  G.meleeRange = (a, b) => a.r + b.r + 18;
  G.hitChance = function (att, def, skill) {
    if (att.type === 'player') { const dex = att.stats ? (att.stats.DEX - 75) / 360 : 0; return U.clamp(0.75 + (skill - def.level * 3) / 650 + (att.level - def.level) * 0.025 + dex, 0.3, 0.97); } // dexterity steadies the aim
    const agi = def.stats ? def.stats.AGI : 75; const evade = def.c ? ({ monk: 0.1, rogue: 0.13, bard: 0.07 }[def.c.cls] || 0) : 0; // monks and rogues are hard to hit
    const adex = att.stats && att.c ? (att.stats.DEX - 75) / 450 : 0; // mercenaries aim with dexterity too
    return U.clamp(0.68 + (att.level - def.level) * 0.03 - (agi - 75) / 600 - evade + adex, 0.3, 0.95);
  };
  G.mitigate = function (att, def, dmg) {
    if (def.type === 'player' || def.type === 'pet') { const m = def.ac / (def.ac + 30 + att.level * 14); return dmg * (1 - Math.min(0.7, m)); }
    const sunder = G.buffMods(def).acMul || 0; return dmg * (1 - Math.min(0.5, def.level * 0.006) * (1 + sunder));
  };
  G.playerSwing = function (p, tgt, hand) {
    const c = p.c; const wd = G.weaponDmg(p, hand); if (!wd) return;
    const ranged = hand === 'range';
    const skill = c.wskill[wd.wt] || 0;
    const hit = Math.random() < G.hitChance(p, tgt, skill);
    G.skillUp(p, wd.wt, hit);
    if (!ranged) p.atk = 0.01;
    if (!hit) { if (!ranged) { G.float(tgt, 'miss', '#aaa'); KR.A.sfx('miss', 0.4); } else G.shoot(p, tgt, wd.wt, 0); return; }
    const str = ranged ? p.stats.DEX : p.stats.STR;
    let dmg = wd.dmg * (0.6 + Math.random() * 0.5) * (1 + (str - 70) / 200) + 3 + p.level * 1.7;
    dmg *= p.dmgMul * (ranged ? p.rangedMul : 1) * (G.CLASS_MELEE[c.cls] || 1);
    let crit = Math.random() < (['warrior', 'berserker'].includes(c.cls) ? 0.09 : ['rogue', 'ranger', 'monk'].includes(c.cls) ? 0.07 : 0.03) + p.level / 2000;
    if (crit) dmg *= 1.8;
    dmg = Math.max(1, Math.round(G.mitigate(p, tgt, dmg)));
    const wItem = ranged ? c.equip.range : hand === 'off' ? c.equip.secondary : c.equip.primary;
    if (ranged) { G.shoot(p, tgt, wd.wt, dmg, { crit }); G.tryProc(p, tgt, wItem); return; }
    G.tryProc(p, tgt, wItem);
    G.damage(p, tgt, dmg, { crit });
    KR.A.sfx(D.WEAPON_TYPES[wd.wt].sfx, 0.55);
    G.fxAdd({ k: 'slash', x: tgt.x, y: tgt.y - 20, ang: Math.random() * 6, col: crit ? '#ffd84a' : '#ffffff', life: 0.18 });
    if (tgt.ds) G.damage(tgt, p, tgt.ds, {});
  };
  G.skillUp = function (p, wt, hit) {
    const c = p.c; const cap = D.weaponSkillCap(c.level); const cur = c.wskill[wt] || 0;
    if (cur >= cap) return;
    const dexM = p.stats ? 1 + (p.stats.DEX - 75) / 300 : 1;
    const ch = U.clamp(((cap - cur) / cap) * 0.3 + 0.03, 0.03, 0.4) * (hit ? 1 : 0.6) * U.clamp(dexM, 0.7, 1.8);
    if (Math.random() < ch) {
      c.wskill[wt] = cur + 1;
      const before = D.WEAPON_UNLOCKS.filter((u) => cur >= u).length, after = D.WEAPON_UNLOCKS.filter((u) => cur + 1 >= u).length;
      if (p !== G.player) return;
      G.log(`You have become better at ${wt === 'SHIELD' ? 'Block' : G.wtName(wt)}! (${cur + 1})`, 'skill', '#9ad8ff');
      if (after > before) { const ab = D.WEAPON_ABILITIES[wt][after - 1]; const onBar = p === G.player && KR.Sys.autoBar({ k: 'weapon', id: wt + ':' + (after - 1) }, wt === 'SHIELD' || D.WEAPON_TYPES[wt].ranged ? null : wt); G.log(`New ${wt === 'SHIELD' ? 'shield' : G.wtName(wt)} technique learned: ${ab.name}!${onBar ? ' It is on your hotbar.' : ''}`, 'skill', '#ffd84a'); KR.A.sfx('skillup'); KR.UI && KR.UI.toast(`New technique: ${ab.name}`); KR.UI && KR.UI.refresh(); }
    }
  };
  G.schoolUp = function (p, school) {
    const c = p.c; const cap = D.schoolSkillCap(c.level); const cur = c.school[school] || 0;
    if (cur >= cap) return;
    if (Math.random() < U.clamp(((cap - cur) / cap) * 0.45 + 0.05, 0.05, 0.5)) { c.school[school] = cur + 1; if (p === G.player) G.log(`You have become better at ${school === 'Song' ? 'Singing' : school}! (${cur + 1})`, 'skill', '#c8a8ff'); }
  };

  // ---------- projectiles ----------
  G.shoot = function (src, tgt, kind, dmg, opt = {}) {
    if (kind === 'GUN') { G.fxAdd({ k: 'burst', x: src.x, y: src.y - 26, col: '#fff2b0', life: 0.18, r: 16 }); G.fxAdd({ k: 'burst', x: src.x, y: src.y - 30, col: '#b8b0a4', life: 0.9, r: 26 }); }
    const vis = { ARC: 'arrow', THR: 'knife', TOME: 'tome', GUN: 'shot', fire: 'fire', cold: 'cold', magic: 'magic', poison: 'poison', disease: 'disease', bolt: 'magic', heal: 'heal' }[kind] || kind;
    G.proj.push({ x: src.x, y: src.y - 24, src, tgt, vis, dmg, opt, speed: vis === 'arrow' ? 720 : vis === 'knife' ? 600 : vis === 'shot' ? 1500 : 460, t: 0 });
    if (src === G.player || (src && Math.hypot(src.x - G.player.x, src.y - G.player.y) < 500)) KR.A.sfx(kind === 'shot' || kind === 'GUN' ? 'heavy' : kind === 'ARC' ? 'bow' : kind === 'THR' ? 'throw' : kind === 'TOME' ? 'magicbolt' : vis === 'arrow' ? 'bow' : 'magicbolt', 0.4);
  };
  function updateProj(dt) {
    for (let i = G.proj.length - 1; i >= 0; i--) {
      const p = G.proj[i]; p.t += dt;
      const t = p.tgt; if (!t || t.removed) { G.proj.splice(i, 1); continue; }
      const dx = t.x - p.x, dy = t.y - 24 - p.y, d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + 4 || p.t > 3) {
        G.proj.splice(i, 1);
        if (t.dead) continue;
        if (p.opt.onHit) p.opt.onHit(); else if (p.dmg > 0) { G.damage(p.src, t, p.dmg, { crit: p.opt.crit, spell: p.opt.spell, dtype: p.opt.dtype }); if (!p.opt.spell) KR.A.sfx('arrowhit', 0.3); }
        else if (p.dmg === 0) G.float(t, 'miss', '#aaa');
        G.fxAdd({ k: 'burst', x: t.x, y: t.y - 24, col: projCol(p.vis), life: 0.35, r: 18 });
        continue;
      }
      p.x += dx / d * step; p.y += dy / d * step; p.ang = Math.atan2(dy, dx);
      if (Math.random() < 0.6) G.fxAdd({ k: 'spark', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, col: projCol(p.vis), life: 0.35, r: p.vis === 'arrow' || p.vis === 'knife' ? 0 : 3 });
    }
  }
  function projCol(v) { return { fire: '#ff8a2a', cold: '#9adfff', magic: '#d0a0ff', poison: '#8aff4a', disease: '#c8d86a', tome: '#c8a8ff', heal: '#8aff9a', arrow: '#e8e0c8', knife: '#e8e8f0', dark: '#9a6aff' }[v] || '#fff'; }
  G.projCol = projCol;

  // ---------- abilities & spells ----------
  G.actionDef = function (a) {
    if (!a) return null;
    if (a.k === 'spell') return D.SPELLS[a.id];
    if (a.k === 'skill') { const s = D.SKILLS[a.id]; return s ? Object.assign({ id: a.id, kind: 'skill' }, s) : null; }
    if (a.k === 'weapon') { const [wt, i] = a.id.split(':'); const ab = D.WEAPON_ABILITIES[wt] && D.WEAPON_ABILITIES[wt][+i]; return ab ? Object.assign({ id: a.id, kind: 'weapon', wt, idx: +i, target: ab.target || 'enemy', range: ab.range || (ab.ranged ? D.WEAPON_TYPES[wt].range || 400 : 'melee') }, ab) : null; }
    if (a.k === 'macro') { const m = (G.player.c.macros || []).find((x) => x.id === a.id); return m ? { id: a.id, kind: 'macro', name: m.name, icon: m.icon || '📜' } : null; }
    if (a.k === 'item') return { id: a.id, kind: 'item', name: a.name, icon: a.icon };
    return null;
  };
  G.endCost = (p, def) => (!def || def.kind === 'spell' || def.passive || (def.kind !== 'skill' && def.kind !== 'weapon')) ? 0 : Math.round(Math.min(5 + (def.cd || 0) * 0.6, 25) * (1 + (p.level || 1) / 90)); // costs grow far slower than the pool and regeneration
  // low on mana or endurance: the action still works at half strength
  G.LOW_MIN = 0.25;
  const WEAK_KEEP = ['pet', 'gate', 'bind', 'fd', 'lunge', 'taunt'];
  G.weakDef = function (def) {
    if (def._weakOf) return def; if (def._weak) return def._weak;
    const half = (v) => (Array.isArray(v) ? v.map((x) => x * 0.5) : typeof v === 'number' ? v * 0.5 : v);
    const effects = def.effects.map((e) => {
      if (WEAK_KEEP.includes(e.t)) return e;
      const o = Object.assign({}, e);
      if (o.amt != null) o.amt = half(o.amt);
      if (o.mult != null) o.mult *= 0.5;
      if (o.pct != null && e.t !== 'dropaggro') o.pct *= 0.5;
      if (o.mods) { o.mods = {}; for (const k in e.mods) o.mods[k] = typeof e.mods[k] === 'number' ? e.mods[k] * 0.5 : e.mods[k]; }
      if (['stun', 'root', 'mez', 'fear', 'snare'].includes(e.t) && o.dur) o.dur *= 0.5;
      if (e.t === 'buff' || e.t === 'selfbuff' || e.t === 'debuff') o.name = (e.name || def.name);
      return o;
    });
    const w = Object.assign({}, def, { effects, _weakOf: def.id || def.name });
    Object.defineProperty(def, '_weak', { value: w, enumerable: false, writable: true });
    return w;
  };
  G.actionUsable = function (p, a) {
    const def = G.actionDef(a); if (!def) return { ok: false, why: 'Empty slot' };
    const c = p.c;
    if (a.k === 'weapon' && def.wt === 'SHIELD') {
      if (!(c.equip.secondary && c.equip.secondary.shield)) return { ok: false, why: 'Requires a shield equipped.' };
      if ((c.wskill.SHIELD || 0) < D.WEAPON_UNLOCKS[def.idx]) return { ok: false, why: `Requires Block skill ${D.WEAPON_UNLOCKS[def.idx]}.` };
    } else if (a.k === 'weapon') {
      const cur = def.ranged ? G.rangedType(c) : G.weaponType(c);
      if (cur !== def.wt) return { ok: false, why: `Requires a ${D.WEAPON_TYPES[def.wt].name} weapon equipped.` };
      if ((c.wskill[def.wt] || 0) < D.WEAPON_UNLOCKS[def.idx]) return { ok: false, why: `Requires ${D.WEAPON_TYPES[def.wt].name} skill ${D.WEAPON_UNLOCKS[def.idx]}.` };
    }
    if (a.k === 'skill' && !G.hasSkill(c, a.id)) return { ok: false, why: 'You have not learned that yet.' };
    if (a.k === 'spell' && !c.spells.includes(a.id)) return { ok: false, why: 'You do not know that spell.' };
    if (p.relearn > 0 && a.k === 'weapon') return { ok: false, why: 'Still adjusting to your new weapon...' };
    const cdKey = a.k + ':' + a.id;
    if ((p.cds[cdKey] || 0) > G.now) return { ok: false, why: 'Not ready yet.', cd: true };
    if (a.k === 'spell' && p.gcd > G.now) return { ok: false, why: 'Not ready yet.', cd: true };
    if (def.mana && p.mana < def.mana * G.LOW_MIN) return { ok: false, why: 'Out of mana.' };
    const ec = G.endCost(p, def); if (ec && p.endurMax && p.endur < ec * G.LOW_MIN) return { ok: false, why: 'Out of endurance.' };
    const weak = (def.mana && p.mana < def.mana) || (ec && p.endurMax && p.endur < ec);
    return { ok: true, def, weak: !!weak, why: weak ? `Low ${def.mana && p.mana < def.mana ? 'mana' : 'endurance'}: works at 50% strength.` : '' };
  };

  G.isToggleSong = (def) => !!def && def.kind === 'spell' && def.school === 'Song' && def.effects.length && def.effects.every((e) => ['buff', 'hot', 'rune'].includes(e.t));
  G.useAction = function (a) {
    const p = G.player; if (!p || p.dead) return;
    if (a.k === 'spell') { const sd = G.actionDef(a); if (G.isToggleSong(sd)) { if (!p.c.spells.includes(a.id)) { G.log('You do not know that song.', 'sys', '#ffb24a'); return; } KR.Sys.toggleSong(sd); return; } }
    if (a.k === 'macro') { KR.Sys.runMacro(a.id); return; }
    if (a.k === 'item') { const it = p.c.inv.find((x) => x && x.name === a.id); if (it) KR.Sys.useItem(it); else G.log(`You have no ${a.id}.`, 'sys', '#aaa'); return; }
    const u = G.actionUsable(p, a); if (!u.ok) { if (!u.cd) G.log(u.why, 'sys', '#ffb24a'); return; }
    const def = u.def;
    if (p.stun > 0 || p.mez > 0) { G.log('You cannot act right now!', 'sys', '#ffb24a'); return; }
    if (p.cast) { G.log('You are already casting.', 'sys', '#ffb24a'); return; }
    if (p.swim) { G.log('You cannot fight or cast while swimming. Get your feet on the ground first.', 'sys', '#ffb24a'); return; }
    // target resolution
    let tgt = null;
    const tt = def.target || 'enemy';
    if (tt === 'enemy' || tt === 'tae') {
      tgt = p.target && G.isHostile(p, p.target) && !p.target.dead ? p.target : null;
      if (!tgt) { G.log('You must first select a hostile target.', 'sys', '#ffb24a'); return; }
      if (!p.autoAttack && !(def.kind === 'spell' && ['mez', 'fear', 'charm', 'lull'].includes(def.type))) { p.autoAttack = true; p.sit = false; }
      const range = def.range === 'melee' || !def.range ? (def.kind === 'spell' ? 420 : G.meleeRange(p, tgt) + 6) : def.range;
      const d = Math.hypot(tgt.x - p.x, tgt.y - p.y);
      if (d > range) { G.log('Your target is too far away.', 'sys', '#ffb24a'); return; }
      if (def.kind === 'spell' && !W.lineClear(p.x, p.y - 20, tgt.x, tgt.y - 20)) { G.log('You cannot see your target.', 'sys', '#ffb24a'); return; }
    } else if (tt === 'ally' || (tt === 'self' && G.isHealDef(def))) {
      // heals and friendly spells land on a friendly target; on a monster or enemy (or with no target) they land on you
      const t = p.target;
      tgt = t && t !== p && !t.dead && !t.removed && t.hp != null && t.type !== 'mob' && !t.bell && !G.isHostile(p, t) ? t : p;
      if (tgt !== p && Math.hypot(tgt.x - p.x, tgt.y - p.y) > (typeof def.range === 'number' ? def.range : 420)) { G.log(`${tgt.name} is too far away.`, 'sys', '#ffb24a'); return; }
    } else if (tt === 'pet') { tgt = p.pet && !p.pet.dead ? p.pet : null; if (!tgt) { G.log('You have no pet.', 'sys', '#ffb24a'); return; } }
    else tgt = p;
    const calm = def.kind === 'spell' && ['mez', 'fear', 'charm', 'lull'].includes(def.type);
    if (!calm && (tt === 'enemy' || tt === 'tae' || (tt === 'pbae' && p.target && G.isHostile(p, p.target))) && !p.autoAttack) { p.autoAttack = true; p.sit = false; }
    if (def.kind === 'spell' && def.cast > 0) {
      if (p.moving) { G.log('You must stand still to cast.', 'sys', '#ffb24a'); return; }
      p.cast = { spell: def, a, t: 0, dur: def.cast * (1 - Math.min(0.3, (p.c.school[def.school] || 0) / 1000)) / (1 + (G.buffMods(p).spellHaste || 0)), tgt };
      p.sit = false;
      KR.A.sfx(def.school === 'Song' ? 'songcast' : D.SCHOOLS.includes(def.school) ? 'cast_' + def.school : 'cast', 0.5);
      return;
    }
    G.execute(p, def, a, tgt);
  };
  G.animFor = (def) => { const n = (def.name || '').toLowerCase(); return /kick|sweep|stomp/.test(n) ? 'kick' : null; };
  G.execute = function (p, def, a, tgt) {
    if (G.animFor(def) === 'kick') p.kickT = 0.01;
    const cdKey = a.k + ':' + a.id;
    const ec = p.endurMax ? G.endCost(p, def) : 0;
    const lowM = def.mana && p.mana < def.mana, lowE = ec && p.endur < ec; const weak = !!(lowM || lowE);
    if (def.mana) p.mana = Math.max(0, p.mana - def.mana);
    if (ec) p.endur = Math.max(0, p.endur - ec);
    if (lowM || lowE) { const nm = def.name; def = G.weakDef(def); if (p === G.player) { G.float(p, 'Weakened', '#ffb24a'); G.log(`Low on ${lowM ? 'mana' : 'endurance'}: ${nm} works at 50% strength.`, 'sys', '#ffb24a'); } }
    if (def.cd) p.cds[cdKey] = G.now + def.cd * 1000;
    if (def.kind === 'spell') { p.gcd = G.now + 1500; G.schoolUp(p, def.school); }
    G.applyAll(p, tgt, def);
    // another player: what you see here is only a picture, so the spell is sent to their game too
    if (tgt && tgt.type === 'peer' && p === G.player && KR.Sys.castOnPeer) KR.Sys.castOnPeer(tgt, a, def, weak);
    if (p.c && def.kind === 'weapon') G.skillUp(p, def.wt, true);
  };
  G.isHostile = function (a, b) {
    if (!a || !b || a === b) return false;
    if (a.raider || a.siege) { if (b.type === 'mob') return !!(b.hate && b.hate.has(a)); if (b.type === 'npc') return a.raider && b.city && b.city !== a.faction; return KR.War.isFoe(a.faction, b); }
    if (b.raider || b.siege) return a.type !== 'npc' && KR.War.isFoe(b.faction, a) && (a.type !== 'mob');
    if (b.type === 'mob') return true;
    if (b.type === 'guard' || b.type === 'king') return a.type === 'player' ? b.faction !== a.c.faction : (a.type === 'pet' || a.type === 'merc') && a.owner ? b.faction !== a.owner.c.faction : false;
    if (b.type === 'player' && (a.type === 'guard' || a.type === 'king')) return a.faction !== b.c.faction;
    return false;
  };
  G.scaleAmt = (amt, lv) => (Array.isArray(amt) ? Math.round(amt[0] + amt[1] * lv) : amt);

  G.applyAll = function (src, tgt, def) {
    const tt = def.target || 'enemy';
    const isSpell = def.kind === 'spell';
    if (isSpell && !def.quiet) G.spellVfx(src, tgt, def);
    if (isSpell && def.school === 'Song') G.noteFx(src, def, def.quiet ? 2 : 4);
    if (!isSpell && def.effects && (def.kind === 'skill' || def.kind === 'weapon')) G.abilityFx(src, tgt, def);
    if (tt === 'group') {
      const lead = src.owner && src.type !== 'player' ? src.owner : src;
      const who = G.party(lead).filter((e) => Math.hypot(e.x - src.x, e.y - src.y) < 450);
      if (!def.quiet) G.fxAdd({ k: 'ring', x: src.x, y: src.y, r: 90, col: '#9affb8', life: 0.6 });
      for (const e of who) G.applyEffects(src, e, def);
      if (lead === G.player && KR.Sys.groupBuff) KR.Sys.groupBuff(def, src);
      if (def.sfx && !def.quiet) KR.A.sfx(def.sfx, 0.7);
      return;
    }
    if (tt === 'pbae' || tt === 'tae') {
      const cx = tt === 'pbae' ? src.x : tgt.x, cy = tt === 'pbae' ? src.y : tgt.y;
      const rad = def.radius || 110;
      G.fxAdd({ k: 'ring', x: cx, y: cy, r: rad, col: isSpell ? G.projCol(def.res || 'magic') : '#ffffff', life: 0.5 });
      let n = 0;
      const foe = src.type === 'mob' ? (o) => o.type === 'player' || o.type === 'merc' || o.type === 'pet' : (o) => G.isHostile(src, o);
      for (const m of G.ents.slice()) { if (m.dead || !foe(m)) continue; if (Math.hypot(m.x - cx, m.y - cy) > rad + m.r) continue; G.applyEffects(src, m, def); if (++n >= 8) break; }
      if (!n && src === G.player) G.log('No enemies in range.', 'sys', '#aaa');
      if (def.sfx) KR.A.sfx(def.sfx, 0.7);
      return;
    }
    if (isSpell && (def.type === 'nuke' || def.type === 'lure' || def.type === 'undead' || def.type === 'tap' || def.type === 'stun') && tgt !== src) {
      G.shoot(src, tgt, def.res || 'magic', -1, { onHit: () => G.applyEffects(src, tgt, def), spell: true });
      return;
    }
    G.applyEffects(src, tgt, def);
    if (def.sfx) KR.A.sfx(def.sfx, 0.7);
  };
  G.spellVfx = function (src, tgt, def) {
    const col = G.projCol(def.res || (def.target === 'ally' || def.target === 'self' ? 'heal' : 'magic'));
    const snd = def.school === 'Song' ? 'song' : def.type === 'heal' || def.type === 'hot' || def.type === 'pethl' ? 'heal' : ['buff_ac', 'buff_hp', 'buff_stat', 'haste', 'regen', 'clarity', 'sow', 'ds', 'rune', 'dmgbuff', 'pethaste'].includes(def.type) ? 'buff' : def.type === 'gate' ? 'gate' : def.res || 'magic';
    KR.A.sfx(snd, 0.65);
    const rgb = G.rgbOf(col); const T2 = tgt || src;
    G.anim(src, 'raise', 380, rgb);
    G.fxAdd({ k: 'burst', x: src.x, y: src.y - 40, col, life: 0.3, r: 14 });
    if (def.target !== 'enemy') G.fxAdd({ k: 'aura', x: T2.x, y: T2.y, col, life: 0.9, ent: T2 });
    switch (def.type) {
      case 'heal': case 'hot': case 'pethl': G.fxAdd({ k: 'pillar', ent: T2, rgb: '170,255,170', life: 1.0 }); break;
      case 'buff_ac': case 'buff_hp': case 'buff_stat': case 'haste': case 'regen': case 'clarity': case 'ds': case 'dmgbuff': case 'pethaste': case 'bind': G.fxAdd({ k: 'runes', ent: T2, rgb: def.type === 'clarity' ? '120,180,255' : def.type === 'haste' ? '255,220,90' : def.type === 'ds' ? '255,150,60' : '200,230,255', life: 1.1 }); break;
      case 'sow': G.fxAdd({ k: 'runes', ent: T2, rgb: '120,240,255', life: 1.1 }); G.fxAdd({ k: 'dash', x0: T2.x - 30, y0: T2.y, x1: T2.x + 30, y1: T2.y, life: 0.4 }); break;
      case 'rune': G.fxAdd({ k: 'shield', ent: T2, rgb: '140,200,255', life: 1.2 }); break;
      case 'dot': case 'resistdebuff': case 'slow': case 'tap': if (tgt && tgt !== src) G.fxAdd({ k: 'swirl', ent: tgt, rgb: def.type === 'slow' ? '170,170,190' : G.rgbOf(G.projCol(def.res || 'poison')), life: 1.1 }); break;
      case 'mez': if (tgt) G.fxAdd({ k: 'spiral', ent: tgt, rgb: '255,150,230', life: 1.6, zzz: true }); break;
      case 'fear': if (tgt) G.fxAdd({ k: 'spiral', ent: tgt, rgb: '190,120,255', life: 1.2 }); break;
      case 'stun': if (tgt) G.fxAdd({ k: 'stars', ent: tgt, life: 1.6 }); break;
      case 'root': case 'snare': if (tgt) G.fxAdd({ k: 'roots', ent: tgt, life: 1.6 }); break;
      case 'pet': case 'gate': G.fxAdd({ k: 'portal', ent: src, rgb: def.type === 'gate' ? '200,160,255' : rgb, life: 1.2 }); break;
      case 'pbae': G.fxAdd({ k: 'nova', x: src.x, y: src.y, r: def.radius || 130, rgb, life: 0.6 }); break;
      case 'tae': if (tgt) G.fxAdd({ k: 'nova', x: tgt.x, y: tgt.y, r: def.radius || 125, rgb, life: 0.6 }); break;
    }
  };
  G.rgbOf = (hex) => { if (!hex || hex[0] !== '#') return '255,255,255'; const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1); const n = parseInt(h, 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
  G.anim = (e, k, ms = 400, col) => { if (!e) return; e.animK = k; e.animT = G.now + ms; e.animDur = ms; e.animCol = col; };
  // abilities: body animation, impact visuals and their own sound
  G.abilityFx = function (src, tgt, def) {
    const p = G.player; if (!p || !src || Math.hypot(src.x - p.x, src.y - p.y) > 750) return;
    const E = def.effects.map((e) => e.t); const n = (def.name || '').toLowerCase(); const T2 = tgt && tgt !== src ? tgt : null; let snd = null;
    const bf = def.effects.find((e) => e.t === 'buff' || e.t === 'selfbuff'); const mods = bf && bf.mods ? bf.mods : {};
    if (E.includes('taunt')) { G.fxAdd({ k: 'shout', ent: src, rgb: '255,90,60', life: 0.7 }); G.anim(src, 'raise', 350, '255,90,60'); }
    else if (def.target === 'pbae' && !def.ranged) { G.fxAdd({ k: 'whirlfx', ent: src, r: Math.min(70, (def.radius || 110) * 0.45), life: 0.45 }); G.anim(src, 'spin', 450); snd = 'whirl'; }
    else if (E.includes('lunge')) { G.anim(src, 'thrust', 300); snd = 'charge'; }
    else if (E.includes('execute')) { if (T2) G.fxAdd({ k: 'cross', x: T2.x, y: T2.y - 26, col: '#ff4a3a', life: 0.4 }); G.anim(src, 'slam', 420); snd = 'heavy'; }
    else if (E.includes('stun') && !def.ranged) { if (T2) G.fxAdd({ k: 'stars', ent: T2, life: 1.4 }); G.anim(src, 'slam', 380); snd = /bash|shield|slam|bulwark/.test(n) ? 'bash' : 'stun'; }
    else if (E.includes('multi')) { G.anim(src, 'thrust', 500); snd = 'flurry'; }
    else if (E.includes('rmulti') || (def.ranged && (def.target === 'tae' || def.target === 'pbae'))) { snd = 'volley'; G.anim(src, 'raise', 300, '255,240,200'); }
    else if (E.includes('dropaggro') || E.includes('fd')) { G.fxAdd({ k: 'smoke', x: src.x, y: src.y, life: 0.9 }); snd = 'stealth'; }
    else if (E.includes('healpct') || E.includes('selfhealpct')) { G.fxAdd({ k: 'pillar', ent: T2 || src, rgb: '170,255,170', life: 1 }); snd = 'heal'; }
    else if (E.includes('mana') || E.includes('cannibal')) { G.fxAdd({ k: 'runes', ent: src, rgb: '120,180,255', life: 1 }); snd = 'buff'; }
    else if (bf) {
      if (mods.acMul || mods.dmgTaken < 0 || mods.invuln || mods.ac) { G.fxAdd({ k: 'shield', ent: src, rgb: mods.invuln ? '255,240,160' : '160,200,255', life: 1.2 }); G.anim(src, 'raise', 380, '160,200,255'); snd = 'block'; }
      else if (mods.dmgMul || mods.haste || mods.rangedMul) { G.fxAdd({ k: 'flames', ent: src, rgb: mods.rangedMul ? '255,230,120' : '255,110,40', life: 1.2 }); G.anim(src, 'raise', 420, '255,140,60'); snd = /cry|shout|roar|howl/.test(n) ? 'warcry' : 'rage'; }
      else { G.fxAdd({ k: 'runes', ent: src, rgb: '220,220,255', life: 1 }); snd = 'buff'; }
    }
    else if (def.effects.some((e) => e.backMult)) { if (T2) G.fxAdd({ k: 'cross', x: T2.x, y: T2.y - 26, col: '#ff6a5a', life: 0.35 }); G.anim(src, 'thrust', 280); snd = 'stab'; }
    else if ((E.includes('wdmg') || E.includes('hit')) && G.animFor(def) !== 'kick') { G.anim(src, def.ranged ? 'raise' : 'thrust', 260, '255,240,200'); if (T2 && !def.ranged) G.fxAdd({ k: 'slash', x: T2.x, y: T2.y - 22, ang: Math.random() * 6, col: '#fff6d0', life: 0.25, big: true }); }
    if (G.animFor(def) === 'kick') snd = 'kick';
    if (E.includes('debuff') && T2) G.fxAdd({ k: 'swirl', ent: T2, rgb: '200,120,255', life: 1 });
    if (E.includes('root') && T2) G.fxAdd({ k: 'roots', ent: T2, life: 1.4 });
    if (snd) KR.A.sfx(snd, src === p ? 0.6 : 0.4);
  };

  G.resistCheck = function (src, tgt, e, def) {
    if (!e.res) return 1;
    if (tgt.type !== 'mob') { // players, mercs and pets shrug off some monster spells, more often against lower monsters
      if (src.type !== 'mob') return 1;
      const full = U.clamp(0.08 + (tgt.level - src.level) * 0.03 + ((tgt.res && tgt.res[e.res]) || 0) / 400, 0.03, 0.5);
      if (Math.random() < full) return 0;
      return Math.random() < full * 1.5 ? 0.6 : 1;
    }
    const sk = src.c ? (src.c.school[def.school] || 0) : src.level * 4;
    const debuff = G.buffMods(tgt).resist || 0;
    const R = (tgt.res[e.res] || 0) + tgt.level * 0.8 + debuff;
    let full = U.clamp((R - sk * 0.25 - (src.level - tgt.level) * 4) / 220, 0.02, 0.75);
    if (e.lure) full *= 0.45;
    if (['mez', 'fear', 'charm', 'lull'].includes(e.t) && src.stats) full = Math.max(0.02, full - (src.stats.CHA - 75) / 900);
    if (Math.random() < full) return 0;
    if (Math.random() < full * 1.6) return 0.5 + Math.random() * 0.4;
    return 1;
  };

  // crowd control from monsters on players, mercs and pets: short durations, then a window of immunity
  // so a pack of monsters can never chain-stun or chain-root anyone.
  G.CC_CAP = { stun: 1.5, root: 3, snare: 6 };
  G.ccGate = function (src, tgt, kind, dur) {
    if (!src || (src.type !== 'mob' && !src.raider) || tgt.type === 'mob') return dur;
    const im = tgt.ccImm || (tgt.ccImm = {});
    const hard = kind !== 'snare';
    if ((im[kind] || 0) > G.now || (hard && (im.hard || 0) > G.now)) { G.float(tgt, 'immune', '#ccc'); return 0; }
    const du = Math.min(dur, G.CC_CAP[kind] || dur);
    im[kind] = G.now + (du + 6) * 1000; if (hard) im.hard = G.now + (du + 4) * 1000;
    return du;
  };
  // both INT and WIS add spell power: the higher one fully, the other partly
  G.spellPower = (src) => (src.spellMul || 1) * (src.stats ? 1 + U.clamp((src.stats.INT - 75) / 300 + (src.stats.WIS - 75) / 300, -0.3, 1.3) : 1);
  G.HEAL_EFFECTS = ['heal', 'healpct', 'hot'];
  G.isHealDef = (def) => !!(def && def.effects && def.effects.length && def.effects.every((e) => G.HEAL_EFFECTS.includes(e.t)));
  G.applyEffects = function (src, tgt, def) {
    if (!tgt || tgt.dead) return;
    const lv = src.level;
    const isSpell = def.kind === 'spell';
    const sm = isSpell ? G.spellPower(src) : 1;
    let resisted = false;
    for (const e of def.effects) {
      if (resisted) break;
      switch (e.t) {
        case 'hit': {
          const dmg = G.scaleAmt(e.amt, lv) * (0.8 + Math.random() * 0.4) * (src.dmgMul || 1);
          if (e.ranged) G.shoot(src, tgt, src.type === 'mob' ? (src.proj || 'ARC') : 'THR', Math.round(dmg)); else { G.damage(src, tgt, Math.round(dmg), {}); KR.A.sfx(def.sfx || (src.kickT > 0 ? 'punch' : 'blunt'), 0.6); G.fxAdd({ k: 'slash', x: tgt.x, y: tgt.y - 20, ang: Math.random() * 6, col: '#ffe0a0', life: 0.2 }); }
          if (!(src.kickT > 0)) src.atk = 0.01;
          break; }
        case 'wdmg': case 'rdmg': {
          const hand = e.t === 'rdmg' || def.ranged ? 'range' : 'main';
          const wd = G.abilWeapon(src, hand === 'range' ? 'range' : 'main');
          if (!wd) break;
          let mult = e.mult;
          if (e.backMult && tgt.type === 'mob' && G.topHate(tgt) !== src) mult *= e.backMult;
          let dmg = wd.dmg * (0.7 + Math.random() * 0.3) * mult * (1 + (src.stats.STR - 70) / 220) * (src.dmgMul || 1) * (hand === 'range' ? src.rangedMul || 1 : 1) + lv * 0.5;
          const crit = e.crit || Math.random() < 0.06; if (crit) dmg *= 1.7;
          dmg = Math.round(G.mitigate(src, tgt, dmg));
          if (hand === 'range' || e.ranged) G.shoot(src, tgt, hand === 'range' ? wd.wt : 'THR', dmg, { crit });
          else { G.damage(src, tgt, dmg, { crit }); KR.A.sfx(D.WEAPON_TYPES[wd.wt].sfx, 0.6); G.fxAdd({ k: 'slash', x: tgt.x, y: tgt.y - 20, ang: Math.random() * 6, col: '#ffe0a0', life: 0.22, big: true }); }
          src.atk = 0.01;
          break; }
        case 'multi': case 'rmulti': {
          const ranged = e.t === 'rmulti';
          const wd = G.abilWeapon(src, ranged ? 'range' : 'main'); if (!wd) break;
          let targets = [tgt];
          if (ranged && !e.same) { targets = G.ents.filter((m) => !m.dead && G.isHostile(src, m) && Math.hypot(m.x - tgt.x, m.y - tgt.y) < 140).slice(0, e.n); }
          for (let k = 0; k < (ranged && !e.same ? targets.length : e.n); k++) {
            const tg = ranged && !e.same ? targets[k] : tgt;
            setTimeout(() => {
              if (tg.dead || src.dead) return;
              const dmg = Math.round(G.mitigate(src, tg, wd.dmg * (0.7 + Math.random() * 0.3) * e.mult * (src.dmgMul || 1) + lv * 0.3));
              if (ranged) G.shoot(src, tg, wd.wt, dmg); else { G.damage(src, tg, dmg, {}); KR.A.sfx(D.WEAPON_TYPES[wd.wt].sfx, 0.4); G.fxAdd({ k: 'slash', x: tg.x, y: tg.y - 20, ang: Math.random() * 6, col: '#fff', life: 0.15 }); src.atk = 0.01; }
            }, k * 140);
          }
          break; }
        case 'execute': {
          const wd = G.abilWeapon(src, 'main');
          const low = tgt.hp / tgt.hpMax < e.below;
          const dmg = Math.round(G.mitigate(src, tgt, wd.dmg * e.mult * (low ? e.bonus : 1) * (src.dmgMul || 1) + lv));
          G.damage(src, tgt, dmg, { crit: low }); KR.A.sfx('slash', 0.7); src.atk = 0.01;
          G.fxAdd({ k: 'slash', x: tgt.x, y: tgt.y - 20, ang: Math.random() * 6, col: low ? '#ff4a3a' : '#fff', life: 0.3, big: true });
          break; }
        case 'dmg': {
          const r = G.resistCheck(src, tgt, e, def);
          if (r === 0) { G.float(tgt, 'RESIST', '#c8c8ff'); if (src === G.player) G.log(`${tgt.name} resisted your ${def.name}!`, 'combat', '#c8c8ff'); resisted = true; G.addHate(tgt, src, 10); break; }
          let dmg = G.scaleAmt(e.amt, lv) * r * sm * (0.9 + Math.random() * 0.2);
          if (e.undead && tgt.undead) dmg *= e.undead;
          const scrit = r >= 1 && Math.random() < 0.05 + (src.spellCrit || 0); if (scrit) dmg *= 1.5 + (src.spellCrit ? 0.2 : 0);
          G.damage(src, tgt, Math.round(dmg), { spell: true, crit: scrit, dtype: e.res });
          break; }
        case 'tap': {
          const r = G.resistCheck(src, tgt, { res: 'magic' }, def); if (r === 0) { G.float(tgt, 'RESIST', '#c8c8ff'); resisted = true; break; }
          const dmg = Math.round(G.scaleAmt(e.amt, lv) * r * sm); G.damage(src, tgt, dmg, { spell: true }); G.heal(src, src, dmg); break; }
        case 'dot': {
          if (e.res) { const r = G.resistCheck(src, tgt, e, def); if (r === 0) { G.float(tgt, 'RESIST', '#c8c8ff'); resisted = true; break; } }
          const amt = Math.round(G.scaleAmt(e.amt, lv) * sm);
          G.addBuff(tgt, { name: def.name, icon: def.icon, dur: e.dur, dot: amt, src, tick: 3, res: e.res, debuff: true }); G.addHate(tgt, src, amt); break; }
        case 'selfbuff': G.addBuff(src, { name: e.name || def.name, icon: def.icon, dur: e.dur, mods: e.mods, src }); if (src.c) G.recalc(src); G.float(src, e.name || def.name, '#ffb24a'); break;
        case 'heal': G.heal(src, tgt, Math.round(G.scaleAmt(e.amt, lv) * sm), { show: true }); break;
        case 'healpct': G.heal(src, tgt, tgt.hpMax * e.pct, { show: true }); break;
        case 'selfhealpct': G.heal(src, src, src.hpMax * e.pct, { show: true }); break;
        case 'hot': G.addBuff(tgt, { name: def.name, icon: def.icon, dur: e.dur, hot: Math.round(G.scaleAmt(e.amt, lv) * sm), src, tick: 3 }); break;
        case 'buff': { const ok = G.addBuff(tgt, { name: e.name || def.name, icon: def.icon, dur: e.dur, mods: e.mods, src, line: e.line, quiet: def.quiet }); if (ok && tgt.c) G.recalc(tgt); if (ok && !def.quiet && (tgt === G.player || tgt.owner === G.player)) G.log(`${tgt === G.player ? 'You feel' : tgt.name + ' feels'} the effect of ${e.name || def.name}.`, 'spell', '#c8ffc8'); break; }
        case 'debuff': {
          if (e.res) { const r = G.resistCheck(src, tgt, e, def); if (r === 0) { G.float(tgt, 'RESIST', '#c8c8ff'); resisted = true; G.addHate(tgt, src, 15); break; } }
          G.addBuff(tgt, { name: e.name || def.name, icon: def.icon, dur: e.dur, mods: e.mods, src, debuff: true }); G.addHate(tgt, src, 20 + lv * 2); G.float(tgt, e.name || def.name, '#ffb0ff'); break; }
        case 'stun': { if (tgt.boss) { G.float(tgt, 'immune', '#ccc'); break; } const du = G.ccGate(src, tgt, 'stun', e.dur); if (!du) break; tgt.stun = Math.max(tgt.stun, du); if (e.terror) { G.interrupt(tgt); G.float(tgt, 'Terrified', '#ffb0ff'); G.addHate(tgt, src, 10); break; } G.interrupt(tgt); G.float(tgt, 'Stunned', '#ffe07a'); G.addHate(tgt, src, 10); break; }
        case 'root': { if (e.res && G.resistCheck(src, tgt, e, def) === 0) { G.float(tgt, 'RESIST', '#c8c8ff'); resisted = true; break; } if (tgt.boss) { G.float(tgt, 'immune', '#ccc'); break; } const du = G.ccGate(src, tgt, 'root', e.dur); if (!du) break; tgt.root = Math.max(tgt.root || 0, du); G.float(tgt, 'Rooted', '#8aff8a'); G.addHate(tgt, src, 10); break; }
        case 'snare': { if (e.res && G.resistCheck(src, tgt, e, def) === 0) { G.float(tgt, 'RESIST', '#c8c8ff'); resisted = true; break; } const du = G.ccGate(src, tgt, 'snare', e.dur); if (!du) break; G.addBuff(tgt, { name: def.name || 'Snared', icon: '🕸', dur: tgt.boss ? du * 0.5 : du, snare: tgt.boss ? e.pct * 0.5 : e.pct, debuff: true, src }); G.float(tgt, 'Snared', '#8aff8a'); G.addHate(tgt, src, 10); break; }
        case 'mez': { if (tgt.boss || tgt.level > lv + 4) { G.float(tgt, 'immune', '#ccc'); break; } if (G.resistCheck(src, tgt, e, def) === 0) { G.float(tgt, 'RESIST', '#c8c8ff'); resisted = true; G.addHate(tgt, src, 30); break; } G.addHate(tgt, src, 5); tgt.mez = e.dur; tgt.moving = false; G.interrupt(tgt); G.float(tgt, 'Mesmerized', '#ffb0ff'); if (src === G.player && G.player.target === tgt) G.player.autoAttack = false; break; }
        case 'fear': { if (tgt.boss) { G.float(tgt, 'immune', '#ccc'); break; } if (G.resistCheck(src, tgt, e, def) === 0) { G.float(tgt, 'RESIST', '#c8c8ff'); resisted = true; break; } tgt.fear = e.dur; tgt.fearFrom = src; G.float(tgt, 'Feared', '#ffb0ff'); G.addHate(tgt, src, 10); break; }
        case 'charm': {
          if (tgt.type !== 'mob' || tgt.boss || tgt.named || tgt.summoned || !src.c || src.type !== 'player') { G.float(tgt, 'immune', '#ccc'); break; }
          if (tgt.level > lv + (e.over || 2)) { G.float(tgt, 'too powerful', '#ccc'); if (src === G.player) G.log(`${tgt.name} is too powerful to charm with this song.`, 'sys', '#ffb24a'); break; }
          if (G.resistCheck(src, tgt, e, def) === 0) { G.float(tgt, 'RESIST', '#c8c8ff'); resisted = true; G.addHate(tgt, src, 40); break; }
          const cha = src.stats ? src.stats.CHA : 75; const dur = U.clamp((e.dur || 18) + (cha - 60) * 0.45, 10, 180);
          KR.Sys.charm(src, tgt, dur); break; }
        case 'rune': if (G.addBuff(tgt, { name: def.name, icon: '🔷', dur: e.dur, rune: Math.round(G.scaleAmt(e.amt, lv) * sm), quiet: def.quiet, src }) && !def.quiet) G.float(tgt, 'Rune', '#9ad8ff'); break;
        case 'taunt': { const top = Math.max(0, ...[...tgt.hate.values()]); tgt.hate.set(src, top + 50 + lv * 5); G.float(tgt, 'Taunted', '#ffb24a'); KR.A.sfx('taunt', 0.6); break; }
        case 'dropaggro': if (e.pct >= 1 && src === G.player && G.player.autoAttack) { G.player.autoAttack = false; G.log('You slip into the shadows. Auto attack is off.', 'sys', '#cccccc'); }
          for (const m of G.ents) if (m.hate && m.hate.has(src)) { if (e.pct >= 1) { m.hate.delete(src); if (!m.hate.size) { m.inCombat = false; } } else m.hate.set(src, m.hate.get(src) * (1 - e.pct)); } G.float(src, e.pct >= 1 ? 'Vanished' : 'Evaded', '#cccccc'); break;
        case 'fd': src.fd = true; src.cast = null; for (const m of G.ents) if (m.hate && m.hate.has(src)) { m.hate.delete(src); if (!m.hate.size) m.inCombat = false; } if (src === G.player) { G.player.autoAttack = false; G.log('You fall to the ground, feigning death.', 'spell', '#cccccc'); } break;
        case 'mana': src.mana = Math.min(src.manaMax, src.mana + src.manaMax * e.pct); G.float(src, '+mana', '#7ab8ff'); break;
        case 'cannibal': { const amt = Math.round(src.hpMax * 0.08); if (src.hp > amt + 5) { src.hp -= amt; src.mana = Math.min(src.manaMax, src.mana + amt * 0.9); G.float(src, '-' + amt + ' hp → mana', '#7ab8ff'); } break; }
        case 'lunge': { const d = Math.hypot(tgt.x - src.x, tgt.y - src.y); if (d > 40) { const nx = tgt.x - (tgt.x - src.x) / d * (tgt.r + src.r + 6), ny = tgt.y - (tgt.y - src.y) / d * (tgt.r + src.r + 6); { // dash along the line in short steps and stop at the first wall: never through one
          const L = Math.hypot(nx - src.x, ny - src.y), n = Math.ceil(L / 6); let x = src.x, y = src.y; const solid = (px, py) => W.solidAtPx(px - 8, py - 4) || W.solidAtPx(px + 8, py - 4) || W.solidAtPx(px - 8, py + 6) || W.solidAtPx(px + 8, py + 6);
          for (let i = 1; i <= n; i++) { const x2 = src.x + (nx - src.x) * i / n, y2 = src.y + (ny - src.y) * i / n; if (solid(x2, y2)) break; x = x2; y = y2; }
          if (x !== src.x || y !== src.y) { G.fxAdd({ k: 'dash', x0: src.x, y0: src.y, x1: x, y1: y, life: 0.3 }); src.x = x; src.y = y; } } } break; }
        case 'pet': KR.Sys.summonPet(src, e, def); break;
        case 'petstrike': { // the troll brings both fists down on your target
          const pet = src.pet; if (!pet || pet.dead) { if (src === G.player) G.log('Your troll is not with you. Call it first.', 'sys', '#ffb24a'); break; }
          pet.target = tgt; pet.backOff = false;
          const dmg = Math.round(G.mitigate(pet, tgt, pet.dmg * e.mult * (1 + (G.buffMods(pet).dmgMul || 0))));
          G.damage(pet, tgt, dmg, { crit: true }); pet.atk = 0.01; KR.A.sfx('heavy', 0.7);
          if (e.stun && !tgt.boss) tgt.stun = Math.max(tgt.stun || 0, e.stun);
          G.fxAdd({ k: 'ring', x: tgt.x, y: tgt.y, r: 55, col: '#9ab86a', life: 0.5 });
          break; }
        case 'pettaunt': { // the troll roars: everything near it turns on the troll
          const pet = src.pet; if (!pet || pet.dead) { if (src === G.player) G.log('Your troll is not with you. Call it first.', 'sys', '#ffb24a'); break; }
          for (const m of G.ents) if (m.type === 'mob' && !m.dead && m.hate && Math.hypot(m.x - pet.x, m.y - pet.y) < (e.radius || 170)) { const top = Math.max(0, ...m.hate.values()); m.hate.set(pet, top + 80 + lv * 6); m.target = pet; m.inCombat = true; }
          G.float(pet, 'ROAR!', '#ffb24a'); KR.A.sfx('roar', 0.8); G.fxAdd({ k: 'ring', x: pet.x, y: pet.y, r: e.radius || 170, col: '#c8a060', life: 0.6 });
          break; }
        case 'gate': KR.Sys.gate(src); break;
        case 'bind': { if (src !== G.player) break; const why = KR.Sys.canBindHere(src); if (why) { G.log(why, 'sys', '#ffb24a'); break; } src.c.bind = { x: src.x, y: src.y, realm: W.realm || 'main' }; G.fxAdd({ k: 'ring', x: src.x, y: src.y, r: 50, col: '#c8a8ff', life: 0.9 }); G.log('You feel yourself bind to the area. You will return here when you Gate or fall.', 'spell', '#c8a8ff'); KR.Sys.save(); break; }
      }
    }
  };
  G.buffPower = (b) => { if (b.rune) return b.rune; let s = 0; for (const k in b.mods || {}) s += Math.abs(b.mods[k]) * (k === 'hp' ? 0.2 : 1); return s; };
  G.buffBlocked = function (e, def) {
    const ef = def.effects && def.effects.find((x) => x.line || x.t === 'rune'); if (!ef) return false;
    const line = ef.line || 'rune', nm = ef.name || def.name;
    const ex = e.buffs.find((x) => x.line === line && x.name !== nm); if (!ex) return false;
    const pw = ef.t === 'rune' ? G.scaleAmt(ef.amt, def.level || 1) : G.buffPower({ mods: ef.mods });
    return G.buffPower(ex) > pw;
  };
  G.NOTE_COL = { haste: '#ffd84a', regen: '#7fe08a', hot: '#7fe08a', clarity: '#6ab8ff', buff_ac: '#e0e6f0', buff_hp: '#e0e6f0', rune: '#c0d8ff', ds: '#ff9a3a', dmgbuff: '#ff6a3a', sow: '#6af0ff', dot: '#ff4a4a', pbae: '#ff4a4a', mez: '#ff9ae0', slow: '#a0a0a8', snare: '#a0a0a8', stun: '#c08aff', fear: '#c08aff' };
  G.noteFx = function (e, def, n = 3) { const col = G.NOTE_COL[def.type] || '#e0b0ff'; for (let i = 0; i < n; i++) G.fxAdd({ k: 'note', ent: e, col, life: 1.5 + Math.random() * 0.5, dx: (Math.random() - 0.5) * 34, ph: Math.random() * 6, ch: Math.random() < 0.5 ? '♪' : '♫', delay: i * 0.18 }); };
  G.addBuff = function (e, b) {
    if (b.rune && !b.line) b.line = 'rune';
    if (b.line) {
      const other = e.buffs.find((x) => x.line === b.line && x.name !== b.name);
      if (other) {
        if (G.buffPower(other) > G.buffPower(b)) {
          if (!b.quiet && (e === G.player || (b.src === G.player))) G.log(`${b.name} did not take hold${e === G.player ? '' : ' on ' + e.name}: ${other.name} is stronger and does not stack.`, 'spell', '#ffb24a');
          return false;
        }
        e.buffs.splice(e.buffs.indexOf(other), 1);
        if (!b.quiet && e === G.player) G.log(`${b.name} replaces ${other.name}.`, 'spell', '#c8ffc8');
      }
    }
    const ex = e.buffs.find((x) => x.name === b.name);
    b.until = G.now + b.dur * 1000; b.nextTick = G.now + (b.tick || 3) * 1000;
    if (ex) Object.assign(ex, b); else e.buffs.push(b);
    if (b.snare) e.snareB = true;
    return true;
  };

  // ---------- player update ----------
  // hotbar abilities the player right-clicked fire by themselves in combat when ready
  const NO_AUTO = ['fd', 'dropaggro', 'gate', 'bind', 'pet', 'charm', 'mez', 'fear', 'lure'];
  G.autoUsable = function (a) {
    if (!a || !['skill', 'weapon', 'spell'].includes(a.k)) return false;
    const def = G.actionDef(a); if (!def || def.passive || def.hymn || def.autoSong || (a.k === 'spell' && G.isToggleSong && G.isToggleSong(def))) return false;
    if (def.kind === 'spell' && ['gate', 'bind', 'pet', 'charm', 'mez', 'fear', 'lure', 'fd', 'sow'].includes(def.type)) return false;
    return !(def.effects || []).some((e) => NO_AUTO.includes(e.t));
  };
  G.autoUseTick = function (p, dt) {
    const c = p.c; if (!c.autoUse) return; let any = false; for (const k in c.autoUse) { any = true; break; } if (!any) return;
    p.autoUseT = (p.autoUseT || 0) - dt; if (p.autoUseT > 0) return; p.autoUseT = 0.3;
    if (p.cast || p.stun > 0 || p.mez > 0 || p.sit || p.fd) return;
    const t = p.target; if (!t || t.dead || !G.isHostile(p, t)) return;
    if (!(p.autoAttack || (t.hate && t.hate.has(p)))) return;
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    for (const a of KR.Sys.bar()) {
      if (!a || !c.autoUse[a.k + ':' + a.id] || !G.autoUsable(a)) continue;
      const u = G.actionUsable(p, a); if (!u.ok || u.weak) continue; const def = u.def; const eff = def.effects || [];
      const self = ['self', 'group', 'ally', 'pet'].includes(def.target);
      if (eff.some((e) => ['heal', 'healpct', 'selfhealpct', 'hot'].includes(e.t)) && p.hp > p.hpMax * 0.6) continue;
      if (self) { const bn = eff.filter((e) => e.t === 'buff' || e.t === 'selfbuff' || e.t === 'rune').map((e) => e.name || def.name); if (bn.length && bn.some((n) => p.buffs.some((b) => b.name === n))) continue; if (G.buffBlocked(p, def)) continue; }
      else {
        const reach = def.target === 'pbae' ? (def.radius || 110) : def.range === 'melee' || (!def.range && def.kind !== 'spell') ? G.meleeRange(p, t) + 6 : (def.range || 420);
        if (d > reach) continue;
        const dn = eff.filter((e) => e.t === 'debuff' || e.t === 'dot' || e.t === 'snare').map((e) => (e.t === 'debuff' ? e.name || def.name : def.name));
        if (dn.length && dn.every((n) => t.buffs.some((b) => b.name === n))) continue;
      }
      G.useAction(a); return;
    }
  };
  // ---------- swimming: deep water is swum, slowly at first; the Swimming skill rises with use ----------
  G.swimSkill = (c) => c.swim || 0;
  G.swimCap = (c) => D.SWIM.cap(c.level);
  G.swimSpeed = (p) => { const k = Math.min(1, G.swimSkill(p.c) / D.SWIM.max); return (D.SWIM.speed0 + (D.SWIM.speed1 - D.SWIM.speed0) * k) * (p.endurMax && p.endur <= 0 ? 0.6 : 1); };
  G.swimTick = function (p, dt) {
    const c = p.c; const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
    // where you last stood freely (/stuck searches from here, so it never takes you through a wall)
    if (!W.solidAtPx(p.x, p.y, { door: 'pass', swim: true })) { const lg = p.lastGood || (p.lastGood = {}); lg.x = p.x; lg.y = p.y; }
    // on a pier, a bridge or a ship's deck you are out of the water, whatever is under it
    const was = !!p.swim; p.swim = !p.upB && !p.onWall && W.tile(tx, ty) === T.DEEP && (!G.deepWaterAt || G.deepWaterAt(p.x, p.y)) && !(W.realm && W.realm !== 'main' && !W.swimmable(tx, ty));
    if (p.swim !== was) {
      if (p.swim) { p.sit = false; p.autoAttack = false; p.chase = null; if (p.cast) G.interrupt(p, 'You plunge into the water and lose your spell.'); G.log('You are swimming.', 'sys', '#9ad8ff'); KR.A && KR.A.sfx && KR.A.sfx('splash', 0.5); }
      else G.log('You wade out of the deep water.', 'sys', '#aaa');
    }
    if (!p.swim) return;
    const cap = G.swimCap(c), cur = G.swimSkill(c), frac = cur / Math.max(1, D.SWIM.max);
    if (p.moving) {
      // tiring: swimming uses up endurance, less as you get better at it
      if (p.endurMax) { const was0 = p.endur > 0; p.endur = Math.max(0, p.endur - (0.9 + c.level * 0.04) * (1 - 0.6 * frac) * dt); if (was0 && p.endur <= 0) G.log('You are exhausted! You can barely keep swimming. Head for the shore.', 'sys', '#ffb24a'); }
      p.swimT = (p.swimT || 0) + dt;
      if (p.swimT >= 1.6) { p.swimT = 0; if (cur < cap && Math.random() < 0.06 + 0.5 * (1 - cur / Math.max(cap, 1))) { c.swim = cur + 1; if ((cur + 1) % 5 === 0 || cur < 10) G.log(`You have become better at Swimming! (${cur + 1})`, 'skill', '#9ad8ff'); } }
    }
  };
  G.updatePlayer = function (p, dt, input) {
    if (p.dead) return;
    const c = p.c;
    if (p === G.player) G.autoUseTick(p, dt);
    // timers
    if (p.relearn > 0) { p.relearn -= dt; if (p.relearn <= 0) { p.relearn = 0; G.log(`You remember how to fight with your ${D.WEAPON_TYPES[G.weaponType(c)].name} weapon.`, 'skill', '#9ad8ff'); KR.UI && KR.UI.refresh(); } }
    G.statusTick(p, dt);
    // movement
    let mx = input.mx, my = input.my;
    if (p.stun > 0 || p.mez > 0 || p.root > 0) { mx = 0; my = 0; }
    // auto follow (right-click a monster as a melee class): walk to it until it dies; moving yourself cancels it
    if (p.chase) {
      const ch = p.chase;
      if (mx || my) { p.chase = null; G.log('Auto follow off. Auto attack stays on.', 'sys', '#cccccc'); }
      else if (ch.dead || ch.removed || p.target !== ch) p.chase = null;
      else if (!(p.stun > 0 || p.mez > 0 || p.root > 0)) { const dx = ch.x - p.x, dy = ch.y - p.y, d = Math.hypot(dx, dy); if (d > G.meleeRange(p, ch) - 6) { mx = dx / d; my = dy / d; } }
    }
    if (p.moveTo && !mx && !my) { const dx = p.moveTo.x - p.x, dy = p.moveTo.y - p.y, d = Math.hypot(dx, dy); if (d < 8) p.moveTo = null; else { mx = dx / d; my = dy / d; } }
    else if (mx || my) p.moveTo = null;
    const len = Math.hypot(mx, my);
    p.moving = len > 0.01;
    if (p.moving) {
      if (p.sit) p.sit = false; if (p.fd) p.fd = false;
      if (p.cast) G.interrupt(p, 'You moved and your spell fizzles.');
      const inWater = W.tile(Math.floor(p.x / TS), Math.floor(p.y / TS)) === T.WATER;
      const sp = p.speed * (p.swim ? G.swimSpeed(p) : inWater ? 0.55 : 1) * dt;
      G.moveEnt(p, mx / len * sp, my / len * sp, { key: (k) => c.inv.some((it) => it && it.key === k), swim: p === G.player });
      p.walk += dt * 11;
      if (Math.abs(mx) > Math.abs(my)) { p.dir = mx < 0 ? 1 : 2; p.face = mx < 0 ? -1 : 1; } else p.dir = my < 0 ? 3 : 0;
    }
    if (p === G.player) G.swimTick(p, dt);
    // auto attack stays on while anything is still fighting you or your party
    if (p.autoAttack && (!p.target || p.target.dead || p.target.removed)) { const nx = G.nextAttacker(p); if (nx) p.target = nx; else { p.autoAttack = false; G.log('Combat is over. Auto attack is off.', 'sys', '#ccc'); } }
    // face target while fighting
    if (p.target && !p.moving && (p.autoAttack || p.cast)) G.faceTo(p, p.target);
    // casting
    if (p.cast) {
      p.cast.t += dt;
      const sp = p.cast.spell, tgt = p.cast.tgt;
      if (tgt && tgt.dead && sp.target === 'enemy') { G.interrupt(p, 'Your target is dead.'); }
      else if (p.cast.t >= p.cast.dur) {
        const a = p.cast.a; p.cast = null;
        if (p.mana < (sp.mana || 0) * G.LOW_MIN) G.log('Out of mana.', 'sys', '#ffb24a');
        else if (sp.target === 'enemy' && Math.hypot(tgt.x - p.x, tgt.y - p.y) > (sp.range || 420) + 40) G.log('Your target moved out of range.', 'sys', '#ffb24a');
        else G.execute(p, sp, a, tgt);
      }
    }
    // auto attack
    const t = p.target;
    if (p.autoAttack && t && !t.dead && t.mez > 0) { p.autoAttack = false; G.log(`${t.name} is mesmerized. Auto attack paused so you don't break it.`, 'sys', '#ffb0ff'); }
    if (p.autoAttack && t && !t.dead && G.isHostile(p, t) && !p.cast && p.stun <= 0 && !p.fd && !p.harvest && !p.swim) {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      const mr = G.meleeRange(p, t);
      const mode = c.rangeMode || 'both';
      const rw = c.equip.range; const rr = rw ? D.WEAPON_TYPES[rw.wt].range : 0;
      const canMelee = mode !== 'ranged', canRange = mode !== 'melee' && rw;
      p.atkT -= dt * (1 + p.haste);
      if (p.atkT <= 0) {
        if (canMelee && d <= mr) {
          const wd = G.weaponDmg(p, 'main'); p.atkT = wd.delay;
          G.playerSwing(p, t, 'main');
          if (G.hasSkill(c, 'doubleattack') && Math.random() < U.clamp(0.15 + (c.level - G.skillLevel(c, 'doubleattack')) * 0.015, 0.15, 0.6)) setTimeout(() => !t.dead && G.playerSwing(p, t, 'main'), 180);
          if (G.hasSkill(c, 'tripleattack') && Math.random() < U.clamp(0.12 + (c.level - G.skillLevel(c, 'tripleattack')) * 0.012, 0.1, 0.35)) setTimeout(() => !t.dead && G.playerSwing(p, t, 'main'), 360);
          const off = c.equip.secondary;
          if (off && off.kind === 'weapon' && G.hasSkill(c, 'dualwield') && Math.random() < 0.6) setTimeout(() => !t.dead && G.playerSwing(p, t, 'off'), 260);
        } else if (canRange && d <= rr && d > (mode === 'both' ? mr : 0) && W.lineClear(p.x, p.y - 20, t.x, t.y - 20)) {
          p.atkT = rw.delay; G.playerSwing(p, t, 'range'); G.faceTo(p, t);
        } else p.atkT = 0.1;
      }
    }
    // regen
    const inCombat = G.inCombat(p);
    const sitM = p.sit ? 3 : 1;
    const med = G.hasSkill(c, 'meditation') ? (p.sit ? 1.6 : 1.15) : 1;
    const rHp = (0.1 + c.level * 0.035 + p.stats.STA / 350 + p.regenB) * sitM * (inCombat ? 0.35 : 1) * (1 + (p.regenPct || 0));
    const rMana = p.manaMax ? (0.15 + c.level * 0.02 + p.manaRegenB) * sitM * med * (inCombat ? 0.4 : 0.8) : 0;
    // a fighter catches their breath between blows: endurance keeps coming back in combat, if more slowly
    const rEnd = p.endurMax ? (0.8 + c.level * 0.07 + p.stats.STA / 250 + (p.endRegenB || 0)) * sitM * (inCombat ? 0.85 : 1.2) * (1 + (p.endRegenPct || 0)) : 0;
    p.regenRates = { hp: rHp, mana: rMana, end: rEnd };
    p.hp = Math.min(p.hpMax, p.hp + rHp * dt);
    if (p.manaMax) p.mana = Math.min(p.manaMax, p.mana + rMana * dt);
    if (p.endurMax && !p.swim) p.endur = Math.min(p.endurMax, p.endur + rEnd * dt);
    if (p.atk > 0) { p.atk += dt * 4; if (p.atk > 1) p.atk = 0; }
  };
  G.party = (p) => { const out = [p, p.pet]; for (const m of p.mercs || []) out.push(m, m.pet); return out.filter((e) => e && !e.dead && !e.removed); };
  G.nextAttacker = function (p) { const party = G.party(p); let best = null, bd = 700; for (const m of G.ents) { if (m.dead || m.removed || !m.hate || !m.inCombat || m.mez > 0 || !G.isHostile(p, m)) continue; if (!party.some((e) => m.hate.has(e))) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; best = m; } } return best; };
  G.skillLevel = (c, id) => { const s = D.CLASSES[c.cls].skills.find((x) => x[0] === id); return s ? s[1] : 99; };
  G.inCombat = (p) => { const party = p.type === 'player' ? G.party(p) : [p]; return G.ents.some((m) => m.hate && !m.dead && m.inCombat && party.some((e) => m.hate.has(e))); };
  G.faceTo = function (e, t) { const dx = t.x - e.x, dy = t.y - e.y; if (Math.abs(dx) > Math.abs(dy)) { e.dir = dx < 0 ? 1 : 2; e.face = dx < 0 ? -1 : 1; } else e.dir = dy < 0 ? 3 : 0; if (Math.abs(dx) > 4) e.face = dx < 0 ? -1 : 1; };

  G.moveEnt = function (e, dx, dy, opts) {
    if (G.moveScale) { const k = G.moveScale(e); dx *= k; dy *= k; } // the 3D view slows everyone to real walking and running speeds
    // walls are solid whatever the speed: a long step (a lag spike, a dash, a far walker's catch-up step) is taken as
    // short ones, each checked against the walls, so nobody can skip through a wall in a single stride
    const len = Math.hypot(dx, dy);
    if (len > 6 && !(e.fly && e.type === 'mob')) { const n = Math.min(64, Math.ceil(len / 6)); for (let i = 0; i < n; i++) moveStep(e, dx / n, dy / n, opts); return; }
    moveStep(e, dx, dy, opts);
  };
  function moveStep(e, dx, dy, opts) {
    let r = Math.min(e.r, 12);
    let blocked = (x, y) => W.solidAtPx(x - r, y - 4, opts) || W.solidAtPx(x + r, y - 4, opts) || W.solidAtPx(x - r, y + 6, opts) || W.solidAtPx(x + r, y + 6, opts);
    // the wall-walk: up the stairs inside a city wall you can step onto the wall and walk along its top;
    // from the top you can only go along the wall or back down the stairs
    const WT = e === G.player && W.wallTop && (!W.realm || W.realm === 'main') ? W.wallTop : null;
    if (WT) {
      const ti = (x, y) => Math.floor(y / TS) * W.W + Math.floor(x / TS);
      const st = (i) => W.stairs && W.stairs.get(i);
      const cur = ti(e.x, e.y); const atTop = !!(st(cur) && st(cur).top);
      if (e.onWall) r = 3;
      // jumping, you can leap off the wall walk onto open ground on either side: out over the battlements or down into town
      const jumpOff = e.onWall && window.K3 && window.K3.jumpT != null;
      const tb = (x, y) => { const i = ti(x, y); if (WT[i]) return !(e.onWall || atTop); if (e.onWall) return !(st(i) && st(i).top) && !(jumpOff && !W.solidAtPx(x, y, opts)); return W.solidAtPx(x, y, opts); };
      if (e.onWall || atTop || WT[ti(e.x + dx * 8, e.y + dy * 8)]) blocked = (x, y) => tb(x - r, y - 4) || tb(x + r, y - 4) || tb(x - r, y + 6) || tb(x + r, y + 6);
    }
    // upper floors: up the stairs you step onto the loft (and the furniture of the room below no longer matters)
    const LS = e === G.player && W.stairs && (!W.realm || W.realm === 'main') ? W.stairs : null;
    const tiL = (x, y) => Math.floor(y / TS) * W.W + Math.floor(x / TS);
    const inLoft = (i, b) => { const L = b.loft; const tx = i % W.W, ty = Math.floor(i / W.W); return tx >= L.x0 && tx <= L.x1 && ty >= L.y0 && ty <= L.y1; };
    const csL = LS ? LS.get(tiL(e.x, e.y)) : null;
    if (LS && (e.upB || (csL && csL.loft && csL.top))) {
      const B = e.upB || csL.loft; if (e.upB) r = 6;
      const tb = (x, y) => { const i = tiL(x, y); if (inLoft(i, B)) return !e.upB && !(csL && csL.top) ? W.solidAtPx(x, y, opts) : false; if (e.upB) { const s2 = LS.get(i); return !(s2 && s2.loft === B && s2.top); } return W.solidAtPx(x, y, opts); };
      blocked = (x, y) => tb(x - r, y - 4) || tb(x + r, y - 4) || tb(x - r, y + 6) || tb(x + r, y + 6);
    }
    if (e.fly && e.type === 'mob') { e.x += dx; e.y += dy; if (blocked(e.x, e.y) && W.tile(Math.floor(e.x / TS), Math.floor(e.y / TS)) !== T.WATER) { e.x -= dx; e.y -= dy; } return; }
    if (!blocked(e.x + dx, e.y)) e.x += dx; else if (Math.abs(dy) < 0.01 && !blocked(e.x + dx, e.y + Math.sign(dx) * 0)) {}
    if (!blocked(e.x, e.y + dy)) e.y += dy;
    if (LS) {
      const ni = tiL(e.x, e.y);
      if (!e.upB && csL && csL.loft && csL.top && inLoft(ni, csL.loft)) { e.upB = csL.loft; if (e === G.player) G.log('You climb up to the upper floor.', 'sys', '#aaa'); }
      else if (e.upB) { const s2 = LS.get(ni); if (s2 && s2.loft === e.upB) { e.upB = null; } else if (!inLoft(ni, e.upB)) e.upB = null; }
    }
    if (WT) {
      const i = Math.floor(e.y / TS) * W.W + Math.floor(e.x / TS); const was = e.onWall; e.onWall = !!WT[i];
      // keep to the middle of the walkway
      if (e.onWall) { const tx = Math.floor(e.x / TS), ty = Math.floor(e.y / TS); const alongX = WT[i - 1] || WT[i + 1]; if (alongX) e.y += ((ty + 0.5) * TS + 2 - e.y) * 0.2; else e.x += ((tx + 0.5) * TS - e.x) * 0.2; }
      if (e.onWall !== was && e === G.player) { const down = was && !(W.stairs && W.stairs.get(i)); G.log(e.onWall ? 'You step out onto the city wall.' : down ? 'You leap down from the wall.' : 'You step back onto the stairs.', 'sys', '#aaa');
        if (down) { e.hp = Math.max(1, e.hp - Math.round((e.hpMax || e.hp) * 0.08)); KR.A && KR.A.sfx && KR.A.sfx('heavy', 0.5); } }
    }
    // door auto open
    const tx = Math.floor(e.x / TS), ty = Math.floor(e.y / TS);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const d = W.doorAt[(ty + j) * W.W + tx + i]; if (d && (!d.locked || (opts && opts.key && opts.key(d.locked)))) { if (d.open < 0.1 && Math.hypot(e.x - G.player.x, e.y - G.player.y) < 600) KR.A.sfx('door', 0.4); d.want = 1; d.last = G.now; } }
  }

  G.statusTick = function (e, dt) {
    if (e.stun > 0) e.stun -= dt; if (e.root > 0) e.root -= dt; if (e.mez > 0) e.mez -= dt; if (e.fear > 0) e.fear -= dt;
    let changed = false; let snare = 0;
    for (let i = e.buffs.length - 1; i >= 0; i--) {
      const b = e.buffs[i];
      if (b.snare) snare = Math.max(snare, b.snare);
      if ((b.dot || b.hot) && G.now >= b.nextTick) {
        b.nextTick += (b.tick || 3) * 1000;
        if (b.dot) { G.damage(b.src, e, b.dot, { dot: true, spell: true, dtype: b.res }); if (e.dead) return; }
        if (b.hot) G.heal(b.src, e, b.hot);
      }
      if (G.now >= b.until) { e.buffs.splice(i, 1); changed = true; if (e === G.player && !b.debuff) G.log(`${b.name} has worn off.`, 'spell', '#aaa'); }
    }
    e.snare = snare;
    if (changed && e.c) G.recalc(e);
    if (e.c && (snare || e.snareWas)) { e.snareWas = !!snare; G.recalc(e); }
  };

  // ---------- AI ----------
  G.updateMob = function (m, dt) {
    if (m.dead) return;
    G.statusTick(m, dt);
    if (m.dead) return;
    if (m.atk > 0) { m.atk += dt * 4; if (m.atk > 1) m.atk = 0; }
    if (m.breath > 0) m.breath -= dt;
    if (m.regen && m.hp < m.hpMax) m.hp = Math.min(m.hpMax, m.hp + m.level * 0.3 * dt);
    if (m.stun > 0 || m.mez > 0) { m.moving = false; return; }
    const p = G.player;
    // fear
    if (m.fear > 0 && m.fearFrom) { const dx = m.x - m.fearFrom.x, dy = m.y - m.fearFrom.y, d = Math.hypot(dx, dy) || 1; G.moveEnt(m, dx / d * m.speed * 0.8 * dt, dy / d * m.speed * 0.8 * dt); m.moving = true; m.walk += dt * 10; m.face = dx < 0 ? -1 : 1; return; }
    // aggro scan
    if (!m.inCombat && m.type === 'mob') {
      m.scanT = (m.scanT || 0) - dt;
      if (m.scanT <= 0) {
        m.scanT = 0.4 + Math.random() * 0.3;
        if (p && !p.dead && !p.fd && !m.passive && !m.returning) {
          const con = D.conOf(p.level, m.level);
          const ar = (m.aggroR + (m.level - p.level) * 8) * (KR.Gear ? KR.Gear.aggroScale(p) : 1); // a burning lantern carries far at night
          if ((con !== 'gray' && con !== 'green') || m.undead || m.boss) {
            if (Math.hypot(p.x - m.x, p.y - m.y) < Math.max(70, ar) && W.lineClear(m.x, m.y - 10, p.x, p.y - 10)) G.addHate(m, p, 1);
          }
        }
      }
    }
    let tgt = m.inCombat ? G.topHate(m) : null;
    if (m.inCombat && !tgt) { m.inCombat = false; m.returning = true; }
    // leash
    if (m.inCombat && Math.hypot(m.x - m.homeX, m.y - m.homeY) > (m.leash || 950)) { m.hate.clear(); m.inCombat = false; m.returning = true; tgt = null; }
    if (m.returning) {
      const dx = m.homeX - m.x, dy = m.homeY - m.y, d = Math.hypot(dx, dy);
      m.hp = Math.min(m.hpMax, m.hp + m.hpMax * 0.2 * dt);
      if (d < 10) { m.returning = false; m.moving = false; m.hp = m.hpMax; m.buffs = []; }
      else { G.moveEnt(m, dx / d * m.speed * 1.2 * dt, dy / d * m.speed * 1.2 * dt); m.moving = true; m.walk += dt * 10; m.face = dx < 0 ? -1 : 1; G.faceTo(m, { x: m.homeX, y: m.homeY }); if (G.now - (m.stuckCheck || 0) > 6000) { m.stuckCheck = G.now; if (m.lastRetD && Math.abs(m.lastRetD - d) < 20) { m.x = m.homeX; m.y = m.homeY; } m.lastRetD = d; } }
      return;
    }
    if (!tgt) {
      // wander
      m.wT = (m.wT || Math.random() * 4) - dt;
      if (m.wT <= 0) { m.wT = 3 + Math.random() * 6; const a = Math.random() * 6.28, rr = Math.random() * 90; m.wx = m.homeX + Math.cos(a) * rr; m.wy = m.homeY + Math.sin(a) * rr; }
      if (m.wx != null && !m.boss && !m.static) {
        const dx = m.wx - m.x, dy = m.wy - m.y, d = Math.hypot(dx, dy);
        if (d > 6) { G.moveEnt(m, dx / d * m.speed * 0.35 * dt, dy / d * m.speed * 0.35 * dt); m.moving = true; m.walk += dt * 6; m.face = dx < 0 ? -1 : 1; G.faceTo(m, { x: m.wx, y: m.wy }); } else { m.moving = false; m.wx = null; }
      } else m.moving = false;
      if (m.hp < m.hpMax) m.hp = Math.min(m.hpMax, m.hp + m.hpMax * 0.02 * dt);
      return;
    }
    m.target = tgt;
    const d = Math.hypot(tgt.x - m.x, tgt.y - m.y);
    const slow = G.buffMods(m).slow || 0;
    const dmgDown = G.buffMods(m).dmgMul || 0;
    const mHaste = G.buffMods(m).haste || 0;
    // healer behavior
    if (m.healer && m.mana > 20) {
      m.healT = (m.healT || 4) - dt;
      if (m.healT <= 0) { const hurt = G.ents.find((o) => o.type === 'mob' && !o.dead && o.inCombat && o.hp < o.hpMax * 0.55 && Math.hypot(o.x - m.x, o.y - m.y) < 300); m.healT = 9; if (hurt) { m.mana -= 20; G.heal(m, hurt, hurt.hpMax * 0.18, { show: true }); G.fxAdd({ k: 'aura', x: hurt.x, y: hurt.y, col: '#8aff9a', life: 0.8, ent: hurt }); if (Math.hypot(m.x - p.x, m.y - p.y) < 500) G.log(`${m.name} heals ${hurt === m ? 'itself' : hurt.name}.`, 'combat', '#ffb0b0'); return; } }
    }
    // monster class abilities
    if (!m.boss && G.mobAbilityTick(m, tgt, d, dt)) return;
    // boss specials
    if (m.boss) G.bossTick(m, tgt, dt);
    // ranged behavior
    const reach = G.meleeRange(m, tgt);
    if (m.ranged && d > reach + 10) {
      const want = 220;
      if (d > 360 || !W.lineClear(m.x, m.y - 10, tgt.x, tgt.y - 10)) { if (m.root <= 0) G.chase(m, tgt, dt, 1); return; }
      // shoot when ready, and keep closing in between shots so they end up toe to toe with you
      m.atkT -= dt * (1 - slow);
      if ((m.shotPause || 0) > 0) { m.shotPause -= dt; m.moving = false; G.faceTo(m, tgt); }
      else if (m.atkT > 0.2 && m.root <= 0) G.chase(m, tgt, dt, 1);
      else { m.moving = false; G.faceTo(m, tgt); }
      if (m.atkT <= 0) {
        m.shotPause = 0.35;
        m.atkT = m.ranged === 'caster' ? 3.2 : m.delay * 1.2;
        if (m.ranged === 'caster') {
          const res = m.kind === 'ghost' ? 'cold' : m.kind === 'lich' ? 'magic' : m.kind === 'goblin' || m.kind === 'orc' ? 'fire' : U.pick(['fire', 'cold', 'magic']);
          const dmg = Math.round((4 + m.level * 1.9) * (1 + dmgDown) * (0.7 + Math.random() * 0.4));
          m.casting = true; setTimeout(() => (m.casting = false), 500);
          G.shoot(m, tgt, res, dmg, { spell: true });
        } else {
          const hit = Math.random() < G.hitChance(m, tgt);
          const dmg = hit ? Math.round(G.mitigate(m, tgt, m.dmg * (0.4 + Math.random() * 0.5) * (1 + dmgDown))) : 0;
          G.shoot(m, tgt, m.proj || 'ARC', dmg);
        }
      }
      return;
    }
    if (d > reach) { if (m.root <= 0) G.chase(m, tgt, dt, 1); else m.moving = false; return; }
    m.moving = false; G.faceTo(m, tgt);
    m.atkT -= dt * (1 - slow + mHaste);
    if (m.atkT <= 0) {
      m.atkT = m.delay;
      m.atk = 0.01;
      const hit = Math.random() < G.hitChance(m, tgt);
      G.mobVoice(m, 'attack', 0.3);
      if (!hit) { G.float(tgt, 'miss', '#aaa'); return; }
      if (G.tryBlock(tgt, m)) { KR.A.sfx('block', 0.4); return; }
      let dmg = m.dmg * (0.35 + Math.random() * 0.65) * (1 + dmgDown) * ((tgt.siege || tgt.mounted) ? m.antiSiege || 1 : 1);
      dmg = Math.max(1, Math.round(G.mitigate(m, tgt, dmg)));
      G.damage(m, tgt, dmg, {});
      if (Math.hypot(tgt.x - p.x, tgt.y - p.y) < 600) KR.A.sfx(m.weapon ? 'slash' : 'punch', 0.35);
      if (tgt.ds && !tgt.dead) G.damage(tgt, m, tgt.ds, {});
    }
  };
  // ---------- monster abilities ----------
  G.MOB_AB_GAP = 1800; // a single target receives at most one monster ability every 1.8 s, however many monsters are on it
  G.mobAbilityTick = function (m, tgt, d, dt) {
    if (m.cast) {
      m.cast.t += dt; m.moving = false; G.faceTo(m, m.cast.tgt);
      if (m.cast.t >= m.cast.dur) { const c = m.cast; m.cast = null; if (!c.tgt.dead) G.mobUse(m, c.spell, c.tgt); }
      return true;
    }
    if (!m.mabil || !m.mabil.length) return false;
    m.abT -= dt; if (m.abT > 0) return false;
    m.abT = 2.5 + Math.random() * 2;
    const reach = G.meleeRange(m, tgt) + 8;
    const ready = [];
    for (const k of m.mabil) {
      const a = D.MOB_ABILITIES[k]; if (!a || (m.abCd[k] || 0) > G.now) continue;
      let who = tgt;
      if (a.target === 'self') { if (a.when === 'hurt' && m.hp > m.hpMax * 0.6) continue; if (m.buffs.some((b) => b.name === (a.effects[0].name || a.name))) continue; who = m; }
      else if (a.target === 'ally') { who = G.ents.find((o) => o.type === 'mob' && !o.dead && o.inCombat && o.hp < o.hpMax * 0.5 && Math.hypot(o.x - m.x, o.y - m.y) < a.range); if (!who) continue; }
      else if (a.target === 'pbae') { if (d > (a.radius || 80)) continue; }
      else { const rg = a.range === 'melee' ? reach : a.range || 300; if (d > rg || !W.lineClear(m.x, m.y - 10, tgt.x, tgt.y - 10)) continue; if (a.effects.some((e) => e.ranged) && d < reach + 24) continue; } // no point-blank bow shots: up close they fight hand to hand
      if (who === tgt && (tgt.lastMobAb || 0) + G.MOB_AB_GAP > G.now) continue;
      if (a.effects.some((e) => e.t === 'debuff') && tgt.buffs.some((b) => b.name === (a.effects.find((e) => e.t === 'debuff').name))) continue;
      if (a.effects.some((e) => e.t === 'dot') && tgt.buffs.some((b) => b.name === a.name)) continue;
      ready.push([k, a, who]);
    }
    if (!ready.length) return false;
    const [k, a, who] = U.pick(ready);
    m.abCd[k] = G.now + a.cd * 1000 * (0.9 + Math.random() * 0.3);
    if (who === tgt) tgt.lastMobAb = G.now + (a.cast || 0) * 1000;
    if (a.cast) { m.cast = { spell: a, t: 0, dur: a.cast, tgt: who }; m.moving = false; if (Math.hypot(m.x - G.player.x, m.y - G.player.y) < 600) G.float(m, a.name, '#ffb0ff'); return true; }
    G.mobUse(m, a, who);
    return false;
  };
  G.mobUse = function (m, a, who) {
    const p = G.player; const near = Math.hypot(m.x - p.x, m.y - p.y) < 600;
    if (a.kind !== 'spell' && near) G.float(m, a.name, '#ffcf8a');
    if (near && who === p) G.log(`${m.name} uses ${a.name} on you!`, 'combat', '#ff9a7a');
    if (near && a.kind !== 'spell') G.fxAdd({ k: 'ring', x: m.x, y: m.y, r: 30, col: '#ffcf8a', life: 0.35 });
    G.mobVoice(m, 'attack', 0.5);
    m.atk = 0.01;
    G.applyAll(m, who, a);
    if (who && who.c) G.recalc(who);
  };
  G.chase = function (m, tgt, dt, mul) {
    let gx = tgt.x, gy = tgt.y;
    // following a detour around whatever blocked the straight line
    if (m.cpath) {
      if (G.now > m.cpathUntil || Math.hypot(m.cpathGoal[0] - tgt.x, m.cpathGoal[1] - tgt.y) > 96) m.cpath = null;
      else { while (m.cpi < m.cpath.length && Math.hypot(m.cpath[m.cpi][0] * TS + 16 - m.x, m.cpath[m.cpi][1] * TS + 16 - m.y) < 14) m.cpi++; if (m.cpi < m.cpath.length) { gx = m.cpath[m.cpi][0] * TS + 16; gy = m.cpath[m.cpi][1] * TS + 16; } else m.cpath = null; }
    }
    const dx = gx - m.x, dy = gy - m.y, d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(m.speed * mul * (1 - (m.snare || 0)) * dt, d);
    const ox = m.x, oy = m.y;
    G.moveEnt(m, dx / d * sp, dy / d * sp);
    if (Math.abs(m.x - ox) + Math.abs(m.y - oy) < sp * 0.3) {
      // blocked: try sidestepping along the perpendicular
      const s = (m.id % 2 ? 1 : -1);
      G.moveEnt(m, -dy / d * sp * s, dx / d * sp * s);
    }
    m.moving = true; m.walk += dt * 10; G.faceTo(m, tgt);
    // still not getting anywhere: find a way around (path), or hop to a free neighbouring tile
    const moved = Math.hypot(m.x - ox, m.y - oy);
    if (sp > 0.05 && moved < sp * 0.4) m.stuckAcc = (m.stuckAcc || 0) + dt; else m.stuckAcc = Math.max(0, (m.stuckAcc || 0) - dt);
    if (m.stuckAcc > 0.7 && m !== G.player && W.findPathLong) {
      m.stuckAcc = 0; m.stuckN = (m.stuckN || 0) + 1;
      const p = W.findPathLong(Math.floor(m.x / TS), Math.floor(m.y / TS), Math.floor(tgt.x / TS), Math.floor(tgt.y / TS), 12000);
      if (p && p.length && m.stuckN < 4) { m.cpath = p; m.cpi = 0; m.cpathUntil = G.now + 6000; m.cpathGoal = [tgt.x, tgt.y]; }
      else {
        const tx = Math.floor(m.x / TS), ty = Math.floor(m.y / TS); let best = null;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if (!i && !j) continue; if (W.isBlockedTile(tx + i, ty + j, { door: 'pass' })) continue; const dd = Math.hypot((tx + i) * TS + 16 - tgt.x, (ty + j) * TS + 16 - tgt.y); if (!best || dd < best[2]) best = [tx + i, ty + j, dd]; }
        if (best) { m.x = best[0] * TS + 16; m.y = best[1] * TS + 16; }
        m.stuckN = 0;
      }
    } else if (moved > sp * 0.8) m.stuckN = 0;
  };
  G.bossTick = function (m, tgt, dt) {
    const bt = m.bossT; const p = G.player;
    for (const k in bt) bt[k] -= dt;
    const has = (a) => m.abil.some((x) => x.startsWith(a));
    const nearP = Math.hypot(p.x - m.x, p.y - m.y) < 700;
    if (has('enrage') && !m.enraged && m.hp < m.hpMax * 0.3) { m.enraged = true; m.dmg = Math.round(m.dmg * 1.5); m.delay *= 0.75; G.log(`${m.name} becomes ENRAGED!`, 'combat', '#ff4a3a'); G.float(m, 'ENRAGED', '#ff4a3a', true); KR.A.sfx('roar'); }
    if (has('slam') && bt.slam <= 0) { bt.slam = 9; G.fxAdd({ k: 'ring', x: m.x, y: m.y, r: 140, col: '#ffcc66', life: 0.6 }); KR.A.sfx('blunt', 1); for (const e of [p, p.pet]) if (e && !e.dead && Math.hypot(e.x - m.x, e.y - m.y) < 140) { G.damage(m, e, Math.round(m.dmg * 0.9), {}); e.stun = Math.max(e.stun, 1); } if (nearP) G.log(`${m.name} slams the ground!`, 'combat', '#ffb24a'); }
    if (has('aoe') && bt.aoe <= 0) { bt.aoe = 15; G.fxAdd({ k: 'ring', x: m.x, y: m.y, r: 220, col: '#c06aff', life: 0.9 }); KR.A.sfx('magic', 1); for (const e of [p, p.pet]) if (e && !e.dead && Math.hypot(e.x - m.x, e.y - m.y) < 220) G.damage(m, e, Math.round(m.dmg * 0.7), { spell: true }); if (nearP) G.log(`${m.name} unleashes a wave of power!`, 'combat', '#ffb24a'); }
    if (has('bolt') && bt.bolt <= 0) { bt.bolt = 6; G.shoot(m, tgt, m.undead ? 'cold' : 'magic', Math.round(m.dmg * 0.8), { spell: true }); }
    if (has('breath') && bt.breath <= 0) { bt.breath = 12; m.breath = 1.2; KR.A.sfx('fire', 1); G.fxAdd({ k: 'ring', x: tgt.x, y: tgt.y, r: 120, col: '#ff6a2a', life: 0.8 }); for (const e of [p, p.pet]) if (e && !e.dead && Math.hypot(e.x - tgt.x, e.y - tgt.y) < 120) G.damage(m, e, Math.round(m.dmg * 1.1), { spell: true }); if (nearP) G.log(`${m.name} breathes fire!`, 'combat', '#ff8a4a'); }
    if (has('fear') && bt.fear <= 0) { bt.fear = 28; if (tgt === p && Math.random() < 0.6) { p.fear = 3; p.fearFrom = m; G.log('You are filled with dread and flee!', 'combat', '#ffb0ff'); } }
    const ad = m.abil.find((x) => x.startsWith('adds:'));
    if (ad && bt.adds <= 0 && m.hp < m.hpMax * 0.7) {
      bt.adds = 30; const mid = ad.split(':')[1];
      for (let i = 0; i < 2; i++) { const a = G.spawnMob({ tx: Math.floor(m.x / TS) + (i ? 2 : -2), ty: Math.floor(m.y / TS) + 1 }, mid, Math.max(1, m.level - 4)); a.summoned = true; a.homeX = m.homeX; a.homeY = m.homeY; G.addHate(a, tgt, 5); }
      if (nearP) G.log(`${m.name} calls for aid!`, 'combat', '#ffb24a');
    }
  };

  // ---------- death, xp, loot ----------
  G.kill = function (e, src) {
    if (e.dead) return;
    e.dead = true; e.hp = 0; e.cast = null; e.moving = false; e.deadAt = G.now;
    const killer = src && src.owner ? src.owner : src;
    if (e === G.player) { KR.Sys.playerDied(src); return; }
    if (e.type === 'merc') { KR.Sys.mercDied(e, src); return; }
    if (e.type === 'pet') { G.log(`${e.name} has been slain.`, 'combat', '#ffb24a'); if (e.owner) e.owner.pet = null; setTimeout(() => G.remove(e), 3000); return; }
    if (e.type === 'npc') { // townsfolk cut down by an invading war party come back after a while
      for (const m of G.ents) if (m.hate && m.hate.has(e)) m.hate.delete(e);
      e.respawnAt = G.now + 5 * 60000; e.path = null; e.bubble = null;
      if (Math.hypot(e.x - G.player.x, e.y - G.player.y) < 700) { KR.A.sfx('mobdie', 0.5); G.log(`${e.name} has been slain by ${src ? src.name : 'invaders'}!`, 'combat', '#ff9a6a'); }
      if (G.player.target === e) G.player.target = null;
      return;
    }
    if (e.kind || e.type === 'guard' || e.type === 'king') G.mobVoice(e, 'die'); else if (Math.hypot(e.x - G.player.x, e.y - G.player.y) < 700) KR.A.sfx('mobdie', 0.5);
    for (const m of G.ents) if (m.hate && m.hate.has(e)) { m.hate.delete(e); }
    if (e.spawn) { e.spawn.ent = null; e.spawn.timer = e.boss ? 600 : e.spawn.named ? 420 + Math.random() * 300 : 90 + Math.random() * 90;
      // dungeons fill back up slowly: monsters take twice as long, named ones three times, the bosses four times
      if (KR.W.realm && KR.W.realm !== 'main' && KR.D.DUNGEONS.some((d) => d.id === KR.W.realm)) e.spawn.timer *= e.boss ? 4 : e.spawn.named ? 3 : 2; }
    if (killer === G.player || e.tagged || (e.hate && e.hate.has(G.player))) KR.Sys.onKill(e);
    if (e.type === 'king') KR.Sys.kingSlain(e, killer);
    if (e.raider) { KR.War.onRaiderKilled(e); }
    else if (e.type === 'guard') { e.respawnAt = G.now + (e.siege ? 10 * 60000 : 120000); if (e.siege && Math.hypot(e.x - G.player.x, e.y - G.player.y) < 900) { G.log(`${e.name} has been destroyed!`, 'combat', '#ffb24a'); KR.A.sfx('heavy', 0.8); G.shake = Math.max(G.shake || 0, 1); } }
    G.corpses.push(e);
    if (G.player.target === e) { G.player.target = null; const nx = G.nextAttacker(G.player); if (nx && G.player.autoAttack) G.player.target = nx; else G.player.autoAttack = false; }
  };
  G.genLoot = function (e) {
    const lv = e.level; const loot = [];
    let coins = Math.round(lv * (3 + Math.random() * 9) * (e.coinMul || 1) * (e.named ? 3 : 1));
    if (['rat', 'snake', 'beetle', 'bat', 'wolf', 'bear', 'boar', 'spider', 'wisp', 'croc', 'mosquito', 'drake', 'griffon', 'elemental', 'golem', 'treant'].includes(e.kind) && !e.boss) coins = Math.round(coins * 0.15);
    if (e.drop && Math.random() < 0.45) loot.push(G.makeTrophy(e.drop, lv));
    // gear drops EverQuest-style (no crafting materials any more): named monsters often, bosses always, dungeon bosses more
    const gearChance = e.boss ? 1 : e.named ? 0.75 : 0.08;
    const n = e.boss ? (W.realm && W.realm !== 'main' ? 3 : 2) : 1;
    for (let i = 0; i < n; i++) if (Math.random() < gearChance) loot.push(G.randomGear(lv + (e.boss ? 3 : 0), e.boss ? 1.3 : e.named ? 1.12 : 0.92));
    const uq = G.rollUnique(lv, e.boss ? 0.4 : e.named ? 0.1 : 0.004); if (uq) loot.push(uq);
    if (e.boss || e.named) { const wn = D.UNIQUE_WORN.filter((u) => Math.abs(u.lvl - lv) <= 8); if (wn.length && Math.random() < (e.boss ? 0.3 : 0.06)) loot.push(G.makeUniqueWorn(e.boss === 'ignaroth' ? D.UNIQUE_WORN.find((u) => u.id === 'w_wyrmmantle') : e.boss === 'aerathos' ? D.UNIQUE_WORN.find((u) => u.id === 'w_titanbelt') : U.pick(wn))); }
    if (Math.random() < 0.05) loot.push(G.makePotion(Math.random() < 0.5 ? 'food' : 'drink', Math.min(4, G.tierOfLevel(lv))));
    // the class sets: about one piece in ten kills of the greatest bosses, a better chance from the enemy king
    if (D.SET_DROP && ((e.boss && lv >= D.SET_DROP.minBossLv) || e.type === 'king')) { const sp = G.rollClassSet(e.type === 'king' ? D.SET_DROP.kingChance : D.SET_DROP.chance); if (sp) loot.push(sp); }
    return { coins, items: loot };
  };
  G.randomGear = function (lv, q) {
    const tier = G.tierOfLevel(lv); const r = Math.random();
    const p = G.player; const C = D.CLASSES[p.c.cls];
    // bias toward usable gear for the player
    const useful = Math.random() < 0.65;
    let it;
    const cb = useful && D.CLASS_STATS ? D.CLASS_STATS[p.c.cls] : null; // gear meant for you leans to your class's stats
    if (r < 0.38) { const wts = useful ? C.weapons.concat(C.ranged) : Object.keys(D.WEAPON_TYPES); it = G.makeWeapon(U.pick(wts), tier, { ilvl: lv, q, bias: cb }); }
    else if (r < 0.85) { const aks = useful ? [C.armor || D.ARMOR_ALLOWED(p.c.cls)[0]].concat(D.ARMOR_ALLOWED(p.c.cls)) : D.ARMOR_KINDS; it = G.makeArmor(U.pick(aks), U.pick(D.ARMOR_SLOTS), tier, { ilvl: lv, q, bias: cb }); }
    else if (r < 0.92 && C.shield) it = G.makeShield(tier, { ilvl: lv, q });
    else if (r < 0.96) it = G.makeWorn(Math.random() < 0.5 ? 'back' : 'waist', tier, { ilvl: lv, q });
    else it = G.makeJewel(Math.random() < 0.5 ? 'ring' : 'neck', tier, { ilvl: lv, q });
    if (q > 1.1) it.name = U.pick(['Gleaming', 'Ancient', 'Runed', 'Blessed', 'Shadowed', 'Fabled']) + ' ' + it.name.split(' ').slice(1).join(' ');
    if (q > 1.1 && it.kind === 'weapon' && Math.random() < 0.55) G.addProc(it);
    else if (q < 1) it.name = U.pick(['Worn', 'Dented', 'Tattered', 'Rusty', 'Patched']) + ' ' + it.name.split(' ').slice(1).join(' ');
    return it;
  };
  // ---------- procs, uniques, blocking ----------
  const FX_PROC = { fire: ['flame', 'rage'], frost: ['frost'], poison: ['venom'], shadow: ['shadow', 'wither'], storm: ['storm', 'stun'], holy: ['holy'], nature: ['nature'] };
  G.addProc = function (it, procId) {
    procId = procId || U.pick(Object.keys(D.PROCS).filter((k) => k !== 'rage'));
    const P = D.PROCS[procId]; it.proc = procId; it.fx = it.fx || P.fx;
    if (!/ of /.test(it.name)) it.name = `${it.name} of ${{ flame: 'Embers', frost: 'Frost', venom: 'Venom', shadow: 'the Leech', storm: 'Storms', holy: 'Light', nature: 'Thorns', stun: 'Thunder', wither: 'Withering', rage: 'Fury' }[procId]}`;
    it.value = Math.round(it.value * 1.6);
    return it;
  };
  G.procChance = function (p, it) {
    if (!it || !it.proc) return 0;
    const dex = p.stats ? p.stats.DEX : 75 + (p.level || 1);
    return U.clamp(0.035 * ((it.delay || 2.5) / 2.5) * (1 + (dex - 75) / 170) * (it.unique ? 1.4 : 1), 0.01, 0.25);
  };
  G.tryProc = function (p, tgt, it) {
    if (!it || !it.proc || !tgt || tgt.dead) return false;
    if (Math.random() >= G.procChance(p, it)) return false;
    const P = D.PROCS[it.proc];
    const def = { name: P.name, icon: P.icon, kind: 'proc', school: 'Evocation', effects: P.effects };
    G.applyEffects(p, tgt, def);
    G.fxAdd({ k: 'ring', x: tgt.x, y: tgt.y - 10, r: 34, col: { fire: '#ff8a3a', frost: '#9ad8ff', poison: '#7aff5a', shadow: '#6aff8a', storm: '#c8d8ff', holy: '#ffe68a', nature: '#8ad85a' }[P.fx] || '#fff', life: 0.5 });
    if (p === G.player || p.owner === G.player) G.log(`${p === G.player ? 'Your' : p.name + "'s"} ${it.name} ${P.desc.toLowerCase()}! (${P.name})`, 'combat', '#ffb84a');
    KR.A.sfx(P.fx === 'fire' ? 'fire' : P.fx === 'frost' ? 'cold' : P.fx === 'storm' ? 'lightning' : P.fx === 'holy' ? 'heal' : 'poison', 0.5);
    return true;
  };
  G.makeUnique = function (u) {
    const tier = G.tierOfLevel(u.lvl);
    const it = G.makeWeapon(u.wt, tier, { ilvl: u.lvl + 3, q: 1.4, bias: u.bias, name: u.name });
    it.unique = u.id; it.classes = u.classes.slice(); it.proc = u.proc; it.fx = u.fx; it.lore = u.lore; it.req = 1; if (u.haste) it.haste = u.haste; if (u.axe) it.axe = true; if (u.wt === '1HB' && /Club|Cudgel/.test(u.name)) it.club = true;
    it.value = Math.round(it.value * 3); G.uniqueRegen(it, u);
    return it;
  };
  G.rollUnique = function (lv, chance) {
    if (Math.random() >= chance) return null;
    const p = G.player; const near = D.UNIQUES.filter((u) => Math.abs(u.lvl - lv) <= 7);
    if (!near.length) return null;
    const mine = near.filter((u) => u.classes.includes(p.c.cls));
    const u = mine.length && Math.random() < 0.7 ? U.pick(mine) : U.pick(near);
    return G.makeUnique(u);
  };
  // ---------- the top-tier class sets (D.CLASS_GEAR_SETS): rare drops from the greatest bosses ----------
  G.makeSetPiece = function (cls, what) {
    const S = D.CLASS_GEAR_SETS && D.CLASS_GEAR_SETS[cls]; const C = D.CLASSES[cls]; if (!S || !C) return null;
    const opt = { ilvl: D.MAX_LEVEL + 2, q: 1.5, bias: D.CLASS_STATS[cls] };
    let it;
    if (D.ARMOR_SLOTS.includes(what)) { const ak = C.armor || 'cloth'; it = G.makeArmor(ak, what, 5, Object.assign({ name: `${S.pre} ${D.SET_SLOT_NAMES[ak][what]}` }, opt)); it.cset = cls; }
    else if (what === 'shield' && S.shield) it = G.makeShield(5, Object.assign({ name: S.shield }, opt));
    else { const w = S.weapons[+what || 0] || S.weapons[0]; it = G.makeWeapon(w[0], 5, Object.assign({ name: w[1] }, opt)); if (Math.random() < 0.6) G.addProc(it); it.name = w[1]; }
    it.set = S.set; it.classes = [cls]; it.lore = S.lore; it.col = S.col; it.trim = S.trim; it.req = D.LV(18); it.unique = it.unique || 'set_' + cls + '_' + what; it.tier = 5;
    it.value = Math.round((it.value || 100) * 3.5);
    return it;
  };
  G.setPieces = (cls) => { const S = D.CLASS_GEAR_SETS[cls]; if (!S) return []; return D.ARMOR_SLOTS.slice().concat(S.weapons.map((w, i) => String(i)), S.shield ? ['shield'] : []); };
  // one piece, for a class picked half the time from the heroes in the fight (you and your mercenaries), else any class
  G.rollClassSet = function (chance) {
    if (!D.CLASS_GEAR_SETS || Math.random() >= chance) return null;
    const p = G.player; const party = [p.c.cls].concat((p.mercs || []).filter((m) => m.c).map((m) => m.c.cls));
    const cls = Math.random() < D.SET_DROP.partyBias ? U.pick(party) : U.pick(Object.keys(D.CLASS_GEAR_SETS));
    return G.makeSetPiece(cls, U.pick(G.setPieces(cls)));
  };
  // set bonuses for the armour pieces worn (2, 4 and all 5)
  G.setMods = function (c) {
    const n = {}; for (const sl of D.ARMOR_SLOTS) { const it = c.equip && c.equip[sl]; if (it && it.cset) n[it.cset] = (n[it.cset] || 0) + 1; }
    const m = {}; for (const cls in n) { const S = D.CLASS_GEAR_SETS[cls]; if (!S) continue; for (const k of [2, 4, 5]) if (n[cls] >= k && S.bonus[k]) for (const key in S.bonus[k]) m[key] = (m[key] || 0) + S.bonus[k][key]; }
    return m;
  };
  G.tryBlock = function (tgt, att) {
    const c = tgt.c; if (!c || !c.equip || !c.equip.secondary || !c.equip.secondary.shield) return false;
    const sk = c.wskill && c.wskill.SHIELD != null ? c.wskill.SHIELD : tgt.type === 'merc' ? D.weaponSkillCap(c.level) * 0.8 : 0;
    const ch = U.clamp(0.04 + sk / 1100 + (tgt.level - att.level) * 0.005, 0.02, 0.3);
    if (tgt === G.player) { c.wskill.SHIELD = c.wskill.SHIELD || 0; G.skillUp(tgt, 'SHIELD', Math.random() < ch); }
    if (Math.random() >= ch) return false;
    G.float(tgt, 'BLOCK', '#c8d8ff'); if (tgt === G.player) KR.A.sfx('blunt', 0.35);
    return true;
  };
  G.giveXp = function (amt, why) {
    const p = G.player, c = p.c;
    if (c.level >= D.MAX_LEVEL) { c.xp = 0; return; }
    amt = Math.round(amt); c.xp += amt;
    G.log(`You gain ${amt} experience${why ? ' ' + why : ''}.`, 'xp', '#e8d48a');
    G.float(p, '+' + amt + ' XP', '#ffe07a');
    while (c.level < D.MAX_LEVEL && c.xp >= D.xpNeeded(c.level)) { c.xp -= D.xpNeeded(c.level); KR.Sys.levelUp(); }
    if (c.level >= D.MAX_LEVEL) c.xp = 0;
  };

  // ---------- update loop ----------
  G.update = function (dt, input) {
    G.now += dt * 1000;
    const p = G.player;
    G.updatePlayer(p, dt, input);
    // one reused list (no copy of every entity each frame); spawns and removals during the loop are still safe
    const list = G._iterEnts || (G._iterEnts = []); list.length = 0; for (let i = 0; i < G.ents.length; i++) list.push(G.ents[i]);
    const warOn = KR.War && KR.War.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.kickT > 0) { e.kickT += dt * 3; if (e.kickT > 1) e.kickT = 0; }
      if (e === p || e.removed) continue;
      const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      e.near = d < 2600;
      const urgent = e.inCombat || e.type === 'merc' || e.raider || (warOn && (e.type === 'guard' || e.type === 'king'));
      if (!e.near && !urgent) continue;
      // far from the player and not fighting: think 10 times a second with the time that has passed (nothing slows down)
      let edt = dt;
      if (d > 1200 && !urgent && e.type !== 'pet' && !(e.hate && e.hate.size)) { e._aiAcc = (e._aiAcc || 0) + dt; if (e._aiAcc < 0.1) continue; edt = Math.min(0.15, e._aiAcc); e._aiAcc = 0; }
      else e._aiAcc = 0;
      if (e.type === 'mob' || e.type === 'guard' || e.type === 'king') { if (e.type === 'mob') G.updateMob(e, edt); else KR.Sys.updateGuard(e, edt); }
      else if (e.type === 'pet') KR.Sys.updatePet(e, edt);
      else if (e.type === 'merc') KR.Sys.updateMerc(e, edt);
      else if (e.type === 'npc') KR.Sys.updateNPC(e, edt);
      if (e.bubble) { e.bubble.t -= edt; if (e.bubble.t <= 0) e.bubble = null; }
    }
    list.length = 0;
    if (p.bubble) { p.bubble.t -= dt; if (p.bubble.t <= 0) p.bubble = null; }
    updateProj(dt);
    for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt; if (f.vx) { f.x += f.vx * dt; f.y += f.vy * dt; } if (f.t > f.life) G.fx.splice(i, 1); }
    for (let i = G.floaters.length - 1; i >= 0; i--) { const f = G.floaters[i]; f.t += dt; f.y -= 34 * dt; if (f.t > 1.3) G.floaters.splice(i, 1); }
    // corpses decay
    for (let i = G.corpses.length - 1; i >= 0; i--) { const c = G.corpses[i]; const life = c.loot && (c.loot.items.length) ? 240000 : 20000; if (G.now - c.deadAt > life) { G.corpses.splice(i, 1); if (c.type === 'mob') G.remove(c); } }
    // doors
    for (const k in W.doorAt) { const d = W.doorAt[k]; if (Math.abs(p.x - d.x) < 44 && Math.abs(p.y - d.y) < 44 && (!d.locked || p.c.inv.some((it) => it && it.key === d.locked))) { if (!d.want && d.open < 0.1) KR.A.sfx('door', 0.4); d.want = 1; d.last = G.now; } if (d.want && G.now - d.last > 1400) d.want = 0; const tgt = d.want ? 1 : 0; if (d.open !== tgt) { d.open += (tgt - d.open) * Math.min(1, dt * 8); if (Math.abs(d.open - tgt) < 0.02) d.open = tgt; } }
  };
})();
