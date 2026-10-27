// Kingdom Rising — the brothers' war: lore lines for the kings, timber and stone gathering, the king's building works,
// town games, Vinny's cremation, a full reset, and the cover page
(function () {
  const KR = window.KR; const { D, G, W, U } = KR; const Sys = KR.Sys, UI = KR.UI, S = KR.S;
  const TS = 32; const T = KR.T;
  const K = (KR.Kingdom = {});
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // =====================================================================
  // the two kings speak about each other
  // =====================================================================
  K.KING_LINES = {
    crown: ['I am the firstborn. The crown was mine the moment Father drew his last breath.', 'My brother hides among the trees and calls himself a king. A boy in a borrowed crown.',
      'Theron is a tyrant who smiles. He taxes the elves to the bone and calls it friendship.', 'Father said "rule it together." Father was dying. Dying men say foolish things.',
      'Bring me timber and stone. I will build walls my brother will break his teeth on.', 'Theron sat beside Father at the feast. Theron poured the wine. I will prove it.', 'Every tree in Aelindor will bow to Valenmoor before I am done.'],
    sylvan: ['Aldric was born an hour before me. He has spent every hour since reminding me.', 'My brother rules with a whip and calls it order. A tyrant, through and through.',
      'Father loved the forests. He would never have let Aldric burn them for his walls.', 'The crown belongs to whoever deserves it, not whoever cried first.',
      'Bring me wood and stone, and Aelindor will outshine anything my brother can build.', 'Aldric burned the feast-hall records the week Father died. Innocent men do not burn records.', 'Aldric thinks a birthday makes a king. The people decide who is king.'],
  };
  K.ENEMY_KING = { crown: ['Did my brother send you? Guards!', 'One of Theron\'s little rebels. Seize them!'], sylvan: ['Aldric\'s dog, in my hall? Guards!', 'Go home and tell my brother he will never have this crown. Guards!'] };

  // =====================================================================
  // timber and stone
  // =====================================================================
  K.MATS = {
    oak: { name: 'Oak Log', pl: 'Oak Logs', kind: 'wood', tier: 1, col: '#c8955a', where: 'oak, elm and birch trees all around both kingdoms' },
    darkoak: { name: 'Darkoak Log', pl: 'Darkoak Logs', kind: 'wood', tier: 2, col: '#7a5a3a', where: 'the dark oaks of the Greywood' },
    willow: { name: 'Willow Log', pl: 'Willow Logs', kind: 'wood', tier: 3, col: '#a8b070', where: 'the willows of the Dreadmire Swamp' },
    frostpine: { name: 'Frostpine Log', pl: 'Frostpine Logs', kind: 'wood', tier: 4, col: '#b8d8e8', where: 'the snow pines of the Ironspine Peaks' },
    fieldstone: { name: 'Fieldstone', pl: 'Fieldstone', kind: 'stone', tier: 1, col: '#b0aaa0', where: 'the boulders of Meadowrun Fields and Sunleaf Glade' },
    granite: { name: 'Granite', pl: 'Granite', kind: 'stone', tier: 2, col: '#c89a8a', where: 'the boulders of Copperdeep Crags and the Kingsroad Wilds' },
    sandstone: { name: 'Sandstone', pl: 'Sandstone', kind: 'stone', tier: 3, col: '#e8c890', where: 'the rocks of the Sunscour Desert' },
    marble: { name: 'Marble', pl: 'Marble', kind: 'stone', tier: 4, col: '#f0f0f4', where: 'the boulders of the Ironspine Peaks' },
  };
  // ore veins: one metal per tier, found in lands of the matching level, and only a good enough pick breaks them
  const ORE_COL = ['#c87a4a', '#8a8e96', '#d8dce4', '#8ad0ff', '#7affa8', '#ffd86a'];
  const ORE_WHERE = ['the rocky ground of the starter lands', 'the hills and crags beyond the farms', 'the deep woods and rocky marsh banks', 'the mountain passes and desert cliffs', 'the high peaks', 'the summit and the old dragon lands'];
  D.MATERIALS.metal.forEach((nm, t) => { K.MATS['ore' + t] = { name: nm, pl: nm, kind: 'ore', ore: t, tier: [1, 1, 2, 3, 4, 5][t], col: ORE_COL[t], where: ORE_WHERE[t], vein: nm.replace(/ Ore$/, '') + ' Vein' }; });
  // logs you chop count as the 'wood' crafting material (they are not carried as items)
  const WOOD_BY_NAME = {}; for (const k in K.MATS) if (K.MATS[k].kind === 'wood') WOOD_BY_NAME[K.MATS[k].name] = k;
  { const count0 = Sys.countItem, take0 = Sys.takeItem;
    Sys.countItem = (name) => (WOOD_BY_NAME[name] && G.player ? K.have(G.player.c, WOOD_BY_NAME[name]) : count0(name));
    Sys.takeItem = function (name, n) { const k = WOOD_BY_NAME[name]; if (k && G.player) { const c = G.player.c; K.gather(c)[k] = Math.max(0, K.have(c, k) - n); return true; } return take0.apply(this, arguments); }; }
  const TREE_MAT = { oak: 'oak', elmwood: 'oak', birch: 'oak', darkoak: 'darkoak', willow: 'willow', snowpine: 'frostpine' };
  const STONE_MAT = { plains: 'fieldstone', forest: 'fieldstone', cityplains: 'fieldstone', cityforest: 'fieldstone', mountain: 'granite', grass: 'granite', hills: 'granite', plains2: 'granite', desert: 'sandstone', island: 'sandstone', snow: 'marble', summit: 'marble' };
  // what each kingdom level needs (index = the level you are leaving)
  K.BUILD = [null,
    { wood: 'oak', stone: 'fieldstone', n: 30, lv: 1, status: 40, coin: 400, name: { crown: 'Timber for the Village', sylvan: 'A Village Among the Trees' } },
    { wood: 'darkoak', stone: 'granite', n: 40, lv: 9, status: 120, coin: 3000, name: { crown: 'Walls of Darkoak and Granite', sylvan: 'The Granite Gates' } },
    { wood: 'willow', stone: 'sandstone', n: 50, lv: 18, status: 300, coin: 12000, name: { crown: 'The Sandstone Halls', sylvan: 'Halls of Willow and Sandstone' } },
    { wood: 'frostpine', stone: 'marble', n: 60, lv: 30, status: 600, coin: 40000, name: { crown: 'A Capital of Marble', sylvan: 'The Marble Crown' } },
  ];
  K.TOOLS = [null, { name: 'Copper', lv: 1, cost: 0 }, { name: 'Iron', lv: 9, cost: 600 }, { name: 'Steel', lv: 18, cost: 5000 }, { name: 'Mithril', lv: 30, cost: 30000 }];
  const TOOL_NAME = { axe: "Woodcutter's Axe", pick: "Miner's Pick" };
  K.tools = (c) => (c.tools = c.tools || { axe: 1, pick: 1 });
  K.gather = (c) => (c.gather = c.gather || {});
  K.have = (c, m) => K.gather(c)[m] || 0;
  K.harvestOf = function (d) {
    if (!d || !d.kind || d.garden) return null; // the trees planted in the city are not for chopping
    if (TREE_MAT[d.kind]) return { mat: TREE_MAT[d.kind], tool: 'axe' };
    if (d.kind === 'orevein') return { mat: 'ore' + (d.ore || 0), tool: 'pick' };
    if (d.kind === 'boulder') { const reg = D.REGIONS[W.regionAt(d.tx, d.ty)]; const m = reg && STONE_MAT[reg.biome]; return m ? { mat: m, tool: 'pick' } : null; }
    return null;
  };
  // fieldstone boulders scattered in the starter lands, so a new hero can gather from day one
  const gen0 = W.generate;
  W.generate = function (seed) {
    const r = gen0.apply(this, arguments);
    try {
      const rnd = U.mulberry((seed || 1) * 13 + 7); const want = { meadowrun: 70, sunleaf: 55, thornfield: 30, greywood: 20 };
      // ore veins in every outdoor land: the metal matches the level of the land
      { const veins = new Map(); const rv = U.mulberry((seed || 1) * 29 + 3);
        for (let k = 0; k < 40000; k++) {
          const x = 4 + Math.floor(rv() * (W.W - 8)), y = 4 + Math.floor(rv() * (W.H - 8)); const i = y * W.W + x; const reg = D.REGIONS[W.region[i]];
          if (!reg || reg.city || reg.dungeon || !reg.lv || W.block[i] || KR.SOLID[W.tiles[i]] || [T.WATER, T.DEEP, T.ROAD, T.BRIDGE, T.COBBLE, T.STONE, T.WOOD, T.CWALL, T.WALL].includes(W.tiles[i])) continue;
          const n = veins.get(reg.id) || 0; const rocky = /mountain|hills|snow|summit|desert|crag|grass/.test(reg.biome) ? 26 : 14; if (n >= rocky) continue;
          let near = false; for (const f of D.FACTION_IDS) { const [cx, cy] = D.CITY_CENTER[f]; if (Math.abs(x - cx) < 48 && Math.abs(y - cy) < 48) near = true; } if (near) continue;
          let crowd = false; for (let dy = -1; dy <= 1 && !crowd; dy++) for (let dx = -1; dx <= 1; dx++) if (W.block[(y + dy) * W.W + x + dx]) { crowd = true; break; } if (crowd) continue;
          const ore = U.clamp(G.tierOfLevel(Math.round((reg.lv[0] + reg.lv[1]) / 2)) + (rv() < 0.12 ? 1 : 0), 0, 5);
          W.decor.push({ kind: 'orevein', ore, tx: x, ty: y, x: x * TS + 16, y: y * TS + 24, v: U.hash(x, y, 9) }); W.block[i] = 1; veins.set(reg.id, n + 1);
        } }
      for (const id in want) {
        const ri = D.REGION_BY_ID[id]; let placed = 0;
        for (let k = 0; k < 6000 && placed < want[id]; k++) {
          const x = 4 + Math.floor(rnd() * (W.W - 8)), y = 4 + Math.floor(rnd() * (W.H - 8)); const i = y * W.W + x;
          if (W.region[i] !== ri || W.block[i] || KR.SOLID[W.tiles[i]] || [T.WATER, T.DEEP, T.ROAD, T.BRIDGE, T.COBBLE, T.STONE, T.WOOD, T.CWALL, T.WALL].includes(W.tiles[i])) continue;
          let near = false; for (const f of D.FACTION_IDS) { const [cx, cy] = D.CITY_CENTER[f]; if (Math.abs(x - cx) < 62 && Math.abs(y - cy) < 62) near = true; } if (near) continue;
          let crowd = false; for (let dy = -1; dy <= 1 && !crowd; dy++) for (let dx = -1; dx <= 1; dx++) if (W.block[(y + dy) * W.W + x + dx]) { crowd = true; break; } if (crowd) continue;
          W.decor.push({ kind: 'boulder', tx: x, ty: y, x: x * TS + 16, y: y * TS + 24, v: U.hash(x, y, 9) }); W.block[i] = 1; placed++;
        }
      }
    } catch (e) { console.warn(e); }
    return r;
  };
  // a felled tree leaves a stump, a quarried boulder leaves rubble, and both come back after a while
  const drawDecor0 = S.drawDecor;
  S.drawDecor = function (g, d, t, wind) {
    if (d.cutUntil && d.cutUntil > G.now) {
      const x = d.x, y = d.y;
      if (TREE_MAT[d.kind]) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x + 2, y + 2, 11, 4, 0, 0, 6.28); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(x - 7, y - 9, 14, 10); g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(x, y - 9, 7, 3, 0, 0, 6.28); g.fill(); g.strokeStyle = '#9a7048'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y - 9, 4, 1.6, 0, 0, 6.28); g.stroke(); }
      else { g.fillStyle = '#8a8478'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x - 8 + k * 4, y - 2 + (k % 2) * 3, 3 + (k % 3), 0, 6.28); g.fill(); } }
      return;
    }
    return drawDecor0.apply(this, arguments);
  };
  K.nearestHarvest = function (x, y, r) {
    let best = null, bd = r;
    for (const d of W.decor) { if (Math.abs(d.x - x) > r || Math.abs(d.y - y) > r + 20) continue; const h = K.harvestOf(d); if (!h) continue; const dd = Math.hypot(d.x - x, d.y - 8 - y); if (dd < bd) { bd = dd; best = d; } }
    return best;
  };
  let hvBar = null;
  const showBar = (txt, frac) => {
    if (!hvBar) { hvBar = document.createElement('div'); hvBar.className = 'hv-bar'; hvBar.innerHTML = '<span></span><i><b></b></i>'; document.body.appendChild(hvBar); }
    hvBar.hidden = !txt; if (!txt) return; hvBar.querySelector('span').textContent = txt; hvBar.querySelector('b').style.width = Math.round(frac * 100) + '%';
  };
  // ---------- gathering: you need the right tool in the right slot, and practice makes you faster ----------
  const TREE_NAME = { oak: 'Oak Tree', elmwood: 'Elm Tree', birch: 'Birch Tree', darkoak: 'Darkoak Tree', willow: 'Willow Tree', snowpine: 'Frost Pine' };
  const GS = { axe: 'woodcutting', pick: 'mining', knife: 'skinning' };
  const GS_NAME = { woodcutting: 'Woodcutting', mining: 'Mining', skinning: 'Skinning' };
  K.gskill = (c, sk) => ((c.gskill = c.gskill || { woodcutting: 0, mining: 0, skinning: 0 })[sk] || 0);
  K.gskillCap = (c) => Math.min(300, 20 + c.level * 6);
  const toolTier = (c, k) => (KR.Gear ? KR.Gear.toolTier(c, k) : 0);
  const toolName = (k) => (KR.Gear ? KR.Gear.TOOL_KINDS[k].name : k);
  // animals that can be skinned for hides (not people, undead, spirits, insects or stone)
  K.BEASTS = new Set(['wolf', 'spiritwolf', 'bear', 'tiger', 'boar', 'croc', 'lizard', 'snake', 'rat', 'bat', 'drake', 'griffon', 'dragon']);
  K.skinnable = (e) => !!(e && e.dead && e.type === 'mob' && !e.skinned && !e.boss && (K.BEASTS.has(e.kind) || e.mat === 'hide'));
  K.targetName = function (d) {
    if (d.dead) return d.name;
    const h = K.harvestOf(d); if (!h) return '';
    return h.tool === 'axe' ? TREE_NAME[d.kind] || 'Tree' : K.MATS[h.mat].vein || `${K.MATS[h.mat].name} Boulder`;
  };
  // how long one gathering takes: better tools and more skill are faster, harder material slower
  const gatherTime = (c, tool, matTier) => { const tt = toolTier(c, tool); const T = KR.Gear.TOOL_TIERS[tt]; const sk = K.gskill(c, GS[tool]); return U.clamp((4.4 / (T.speed * (1 + sk / 180))) * (1 + (matTier - 1) * 0.15), 1.1, 7); };
  // can this hero gather this thing right now? returns null when yes, else the reason
  K.whyNot = function (c, d) {
    if (d.dead) { const need = Math.max(1, G.tierOfLevel(d.level)); const tt = toolTier(c, 'knife'); if (!tt) return `You need a ${toolName('knife')} in your Skinning slot.`; if (tt < need) return `You need a better skinning knife (tier ${need}) for this hide.`; return null; }
    const h = K.harvestOf(d); if (!h) return 'Nothing to gather.'; const M = K.MATS[h.mat]; const tt = toolTier(c, h.tool);
    if (!tt) return `You need a ${toolName(h.tool)} in your ${h.tool === 'axe' ? 'Woodcutting' : 'Mining'} slot. General goods merchants sell copper ones.`;
    if (tt < M.tier) return `You need a tier ${M.tier} ${h.tool === 'axe' ? 'axe' : 'pick'} for ${M.name}. Your kingdom's smith can make you one.`;
    return null;
  };
  const begin = function (p, target, tool, matTier, extra) {
    p.moveTo = null; p.harvestGoal = null; G.faceTo(p, target);
    p.harvest = Object.assign({ t: 0, dur: gatherTime(p.c, tool, matTier), tool, swing: 0.25 }, extra);
    p.sit = false; p.autoAttack = false;
  };
  K.startHarvest = function (d) {
    const p = G.player; if (!p || p.dead) return false; const c = p.c; const h = K.harvestOf(d); if (!h) return false; const M = K.MATS[h.mat];
    if (d.cutUntil && d.cutUntil > G.now) { G.log(h.tool === 'axe' ? 'Only a stump is left. It will grow back in a while.' : 'This rock has been quarried. Try another.', 'sys', '#aaa'); return true; }
    const why = K.whyNot(c, d); if (why) { G.log(why, 'sys', '#ffb24a'); KR.A.sfx('fail', 0.4); return true; }
    if (Math.hypot(d.x - p.x, d.y - 8 - p.y) > 70) { G.log(`Walk up to the ${K.targetName(d).toLowerCase()} first.`, 'sys', '#aaa'); return true; }
    begin(p, { x: d.x, y: d.y - 8 }, h.tool, M.tier, { d, mat: h.mat });
    return true;
  };
  K.startSkin = function (e) {
    const p = G.player; if (!p || p.dead || !K.skinnable(e)) return false;
    const why = K.whyNot(p.c, e); if (why) { G.log(why, 'sys', '#ffb24a'); KR.A.sfx('fail', 0.4); return true; }
    if (Math.hypot(e.x - p.x, e.y - p.y) > 80) { G.log(`Walk up to the ${e.name} first.`, 'sys', '#aaa'); return true; }
    begin(p, e, 'knife', Math.max(1, G.tierOfLevel(e.level)), { corpse: e });
    return true;
  };
  const SWING = { axe: 0.95, pick: 1.05, knife: 0.8 };
  K.harvestTick = function (dt) {
    const p = G.player; if (!p) return;
    promptTick(p);
    const H = p.harvest; if (!H) return;
    if (p.dead || p.moving || (p.cast && p.cast.spell) || (H.corpse && (H.corpse.removed || H.corpse.skinned))) { p.harvest = null; showBar(null); if (!p.dead) G.log('You stop gathering.', 'sys', '#aaa'); return; }
    H.t += dt; H.swing -= dt;
    const c = p.c; const verb = H.tool === 'axe' ? 'Chopping' : H.tool === 'pick' ? 'Mining' : 'Skinning';
    const what = H.corpse ? H.corpse.name : K.targetName(H.d);
    if (H.swing <= 0) {
      H.swing = SWING[H.tool];
      // the swing itself (the 3D body plays it from animK)
      p.animK = H.tool === 'axe' ? 'chop' : H.tool === 'pick' ? 'mine' : 'skin'; p.animT = G.now + SWING[H.tool] * 1000; p.animDur = SWING[H.tool] * 1000;
      const at = H.corpse || H.d; const hitIn = H.tool === 'knife' ? 380 : 520;
      setTimeout(() => {
        if (p.harvest !== H) return;
        if (H.tool === 'axe') { KR.A.sfx('chop', 0.55); for (let k = 0; k < 5; k++) G.fxAdd({ k: 'ring', x: at.x + (Math.random() - 0.5) * 12, y: at.y - 10, r: 5, col: '#e8c08a', life: 0.35 }); }
        else if (H.tool === 'pick') { KR.A.sfx('pickaxe', 0.5); G.fxAdd({ k: 'sparks', x: at.x, y: at.y - 12, life: 0.4 }); }
        else KR.A.sfx('skin', 0.5);
      }, hitIn * 0.9);
    }
    showBar(`${verb} ${what}...`, Math.min(1, H.t / H.dur));
    if (H.t < H.dur) return;
    p.harvest = null; showBar(null);
    // skill: practice makes you faster, quickly at first, slowly later
    const sk = GS[H.tool]; const cur = K.gskill(c, sk); const cap = K.gskillCap(c);
    if (cur < cap && Math.random() < 0.08 + 0.75 * (1 - cur / Math.max(cap, 1))) { c.gskill[sk] = cur + 1; if ((cur + 1) % 5 === 0 || cur < 10) G.log(`You have become better at ${GS_NAME[sk]}! (${cur + 1})`, 'skill', '#9ad8ff'); }
    const tt = toolTier(c, H.tool);
    // how much you take: practice (skill against what you could have) and the tool (each tier above the material helps)
    const yieldOf = (mt) => { const sf = (c.gskill[sk] || 0) / Math.max(1, cap); return 1 + (sf >= 0.4 ? 1 : 0) + (sf >= 0.85 ? 1 : 0) + Math.min(2, Math.max(0, tt - mt)) + (Math.random() < 0.15 + sf * 0.2 ? 1 : 0); };
    if (H.corpse) {
      const e = H.corpse; e.skinned = true; const ht = G.tierOfLevel(e.level); const n = yieldOf(Math.max(1, ht));
      const hide = G.makeMat('hide', ht, n); Sys.addItem(hide);
      G.log(`You skin the ${e.name} and take ${n > 1 ? n + ' ' : ''}${hide.name}${n > 1 ? 's' : ''}.`, 'loot', '#d8b07a'); G.float(p, `+${n} ${hide.name}`, '#d8b07a');
      try { if (e.loot && !e.loot.items.length) e.lootT = Math.min(e.lootT || 1e9, G.now + 1500); } catch (er) {}
      KR.A.sfx('skin', 0.6);
    } else {
      const M = K.MATS[H.mat];
      const n = yieldOf(M.tier);
      if (M.kind === 'ore') {
        // ore goes in your bags, for the smith, the fletcher and the jeweler
        const it = G.makeMat('metal', M.ore, n); Sys.addItem(it); H.d.cutUntil = G.now + 240000;
        G.float(p, `+${n} ${M.name}`, M.col); G.log(`You mine ${n} ${M.name}.`, 'loot', M.col); KR.A.sfx('rockbreak', 0.5);
        try { G.giveXp(Math.max(1, Math.round(D.mobXp(Math.max(1, Math.min(c.level, 10))) * 0.06)), ''); } catch (e) {}
        UI.refresh && UI.refresh(); Sys.save && Sys.save(); return;
      }
      K.gather(c)[H.mat] = K.have(c, H.mat) + n;
      H.d.cutUntil = G.now + (H.tool === 'axe' ? 150000 : 180000); H.d.cutAt = G.now;
      G.float(p, `+${n} ${n > 1 ? M.pl : M.name}`, M.col);
      const need = K.needFor(c.faction); const goal = need && (need.wood === H.mat || need.stone === H.mat) ? ` (${K.have(c, H.mat)} / ${need.n} for the king)` : ` (${K.have(c, H.mat)})`;
      G.log(`You gather ${n} ${n > 1 ? M.pl : M.name}${goal}.`, 'loot', M.col);
      KR.A.sfx(H.tool === 'axe' ? 'treefall' : 'rockbreak', 0.5);
    }
    // a little experience for honest work
    try { G.giveXp(Math.max(1, Math.round(D.mobXp(Math.max(1, Math.min(c.level, 10))) * 0.06)), ''); } catch (e) {}
    UI.refresh && UI.refresh(); Sys.save && Sys.save();
  };
  // "Press E to chop Birch Tree": what is in reach, and whether you have the tool for it
  let prompt = null, promptT = 0, promptFor = null;
  function promptTick(p) {
    const now = performance.now(); if (now - promptT < 150) return; promptT = now;
    if (!prompt) { prompt = document.createElement('div'); prompt.className = 'hv-prompt'; prompt.hidden = true; document.body.appendChild(prompt); }
    let tgt = null;
    if (!p.dead && !p.harvest && !p.moving) {
      const corpse = G.ents.filter((e) => K.skinnable(e) && (!e.loot || !e.loot.items.length) && Math.hypot(e.x - p.x, e.y - p.y) < 80).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      const d = K.nearestHarvest(p.x, p.y, 70);
      tgt = corpse || (d && !(d.cutUntil && d.cutUntil > G.now) ? d : null);
    }
    if (!tgt) {
      const gr = Sys.nearGrate && Sys.nearGrate(p);
      if (gr && !p.dead) { const k2 = window.K3 && window.K3.keys ? window.K3.keys.keyName(window.K3.keys.bindingsOf('interact')[0]) : 'E'; const html = `<span><kbd>${k2}</kbd> or click to climb down into <b>${esc(gr.label)}</b></span><small>A rusted iron grate in the street</small>`; if (promptFor !== html) { prompt.innerHTML = html; promptFor = html; } prompt.hidden = false; prompt.classList.remove('cant'); return; }
      prompt.hidden = true; promptFor = null; return;
    }
    const key = window.K3 && window.K3.keys ? window.K3.keys.keyName(window.K3.keys.bindingsOf('interact')[0]) : 'E';
    const tool = tgt.dead ? 'knife' : K.harvestOf(tgt).tool; const verb = KR.Gear.TOOL_KINDS[tool].verb;
    const why = K.whyNot(p.c, tgt);
    const yieldTxt = tgt.dead ? D.MATERIALS.hide[G.tierOfLevel(tgt.level)] : K.MATS[K.harvestOf(tgt).mat].name;
    const html = `<span><kbd>${key}</kbd> to ${verb} <b>${esc(K.targetName(tgt))}</b></span><small>${why ? `<span class="bad">${esc(why)}</span>` : `${esc(yieldTxt)} · ${GS_NAME[GS[tool]]} ${K.gskill(p.c, GS[tool])}`}</small>`;
    if (promptFor !== html) { prompt.innerHTML = html; promptFor = html; }
    prompt.hidden = false; prompt.classList.toggle('cant', !!why);
  }
  // the next building project the player's kingdom needs, if any
  K.needFor = function (f) { const ct = G.account && G.account.cities[f]; if (!ct || ct.level >= 5) return null; const lv = ct.level; if ((ct.built || 0) >= lv) return null; return K.BUILD[lv]; };

  // E and click both gather when there is a tree or rock at hand and nobody to talk to
  const whenMain = (fn) => { if (KR.Main && KR.Main.interact) fn(); else setTimeout(() => whenMain(fn), 15); };
  whenMain(() => { const interact0 = KR.Main.interact;
  KR.Main.interact = function (target) {
    const p = G.player;
    if (!target && p && !p.dead) {
      const near = G.ents.filter((x) => x !== p && !x.removed && !x.noPick && Math.hypot(x.x - p.x, x.y - p.y) < 90 && ((x.dead && x.loot && x.loot.items.length) || (!x.dead && (x.type === 'npc' || x.type === 'king' || (x.type === 'guard' && x.faction === p.c.faction)))));
      const corpse = G.ents.filter((e) => K.skinnable(e) && (!e.loot || !e.loot.items.length) && Math.hypot(e.x - p.x, e.y - p.y) < 80).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      const d = K.nearestHarvest(p.x, p.y, 70);
      const nearD = near.length ? Math.min(...near.map((x) => Math.hypot(x.x - p.x, x.y - p.y))) : 1e9;
      const gr = Sys.nearGrate && Sys.nearGrate(p); if (gr && nearD > 50 && !corpse) { Sys.useGrate(gr); return; }
      if (corpse && Math.hypot(corpse.x - p.x, corpse.y - p.y) < nearD) { K.startSkin(corpse); return; }
      // your own camp: sleep, or pack it up
      if (KR.Gear && KR.Gear.nearCamp(p) && nearD > 50 && !(d && Math.hypot(d.x - p.x, d.y - p.y) < 40)) { UI.choice('Your camp. The fire crackles and the bedroll looks inviting.', [['Sleep a while (wake Well Rested: +10% XP for 1 hour)', () => KR.Gear.nap()], ['Pack up camp (your soul returns to the city healer)', () => KR.Gear.breakCamp()], ['Leave it be']]); return; }
      if (d && Math.hypot(d.x - p.x, d.y - p.y) < nearD) { K.startHarvest(d); return; }
    }
    return interact0.apply(this, arguments);
  }; });
  K.clickWorld = function (wx, wy) {
    let best = null, bd = 26;
    for (const d of W.decor) { if (Math.abs(d.x - wx) > 40 || Math.abs(d.y - wy) > 70) continue; if (!K.harvestOf(d)) continue; const big = TREE_MAT[d.kind] ? 34 : 14; const dd = Math.hypot(d.x - wx, (d.y - big) - wy) * (TREE_MAT[d.kind] ? 0.7 : 1); if (dd < bd) { bd = dd; best = d; } }
    if (!best) return false; K.startHarvest(best); return true;
  };

  // tools from the Outfitter, materials for the king
  const extra0 = UI.extraButtons;
  UI.extraButtons = function (e, add, w) {
    if (extra0) extra0(e, add, w);
    const p = G.player, c = p.c;
    // gathering tools are items now: copper ones are sold by general goods merchants and outfitters,
    // better ones come from the smith (axes and picks) and the tailor (skinning knives) as quests
  };

  // =====================================================================
  // the king's building works: quests, and the rule that a kingdom needs timber and stone to rise
  // =====================================================================
  const bq0 = Sys.buildQuests;
  Sys.buildQuests = function () {
    bq0.apply(this, arguments);
    const Q = Sys.QUESTS;
    for (const f of D.FACTION_IDS) {
      const F = D.FACTIONS[f], bro = F.brother;
      for (let i = 1; i <= 4; i++) {
        const B = K.BUILD[i], W1 = K.MATS[B.wood], S1 = K.MATS[B.stone];
        const lead = { crown: [`Valenmoor is barely a hamlet, and my brother laughs at it. That ends now.`, `${bro}'s rebels grow bolder. I want walls.`, `A real king needs real halls.`, `One last work, and Valenmoor will be the capital Father always meant it to be.`],
          sylvan: [`Aelindor shelters more people every day, all of them fleeing my brother.`, `${bro} is raising walls. So shall we, and higher.`, `Our people deserve halls, not tents.`, `One last work, and Aelindor will be the jewel of the realm. Let ${bro} weep.`] }[f][i - 1];
        Q[f + '_build' + i] = { id: f + '_build' + i, f, giver: 'king', lv: B.lv, type: 'build', tier: i, wood: B.wood, stone: B.stone, n: B.n, title: `The King's Works: ${B.name[f]}`,
          text: `${lead} Bring me ${B.n} ${W1.pl} and ${B.n} ${S1.pl}. ${W1.pl} come from ${W1.where}; ${S1.pl.toLowerCase()} from ${S1.where}. Cut wood with your axe and break stone with your pick: walk up and press E. With the materials and enough status, ${F.city} will rise to Kingdom Level ${i + 1}.`,
          reward: { coin: B.coin, status: B.status }, req: i > 1 ? f + '_build' + (i - 1) : null };
      }
    }
  };
  // better gathering tools are earned from the crafters: bring the smith timber and stone of the tier
  // below and he forges an axe and a pick; bring the tailor hides and she makes a skinning knife
  const tq0 = Sys.buildQuests;
  Sys.buildQuests = function () {
    tq0.apply(this, arguments);
    if (!KR.Gear) return;
    const Q = Sys.QUESTS; const TT = KR.Gear.TOOL_TIERS;
    const WOOD = [null, 'oak', 'darkoak', 'willow', 'frostpine'], STONE = [null, 'fieldstone', 'granite', 'sandstone', 'marble'];
    for (const f of D.FACTION_IDS) for (let t = 2; t <= 5; t++) {
      const T = TT[t], wm = WOOD[Math.min(4, t - 1)], sm = STONE[Math.min(4, t - 1)], n = 6 + t * 3;
      Q[f + '_tools' + t] = { id: f + '_tools' + t, f, giver: 'smith', lv: T.lv, type: 'gather', wood: wm, stone: sm, n, title: `${T.adj} Tools`,
        text: `Bring me ${n} ${K.MATS[wm].pl} and ${n} ${K.MATS[sm].pl} and I will forge you a ${T.adj.toLowerCase()} axe and pick from them. Better tools bite deeper and cut faster, and only the best can work the hard woods and stones of the far lands.`,
        reward: { coin: 0, item: { k: 'tool', tier: t, kinds: ['axe', 'pick'] } }, req: t > 2 ? f + '_tools' + (t - 1) : null };
      const ht = t - 2, hide = D.MATERIALS.hide[ht], hn = 4 + t;
      Q[f + '_knife' + t] = { id: f + '_knife' + t, f, giver: 'tailor', lv: T.lv, type: 'collect', item: hide, n: hn, title: `A ${T.adj} Skinning Knife`,
        text: `A hunter's knife is only as good as the hides it has opened. Bring me ${hn} ${hide}s and I will give you a ${T.adj.toLowerCase()} skinning knife, keen enough for tougher beasts.`,
        reward: { coin: 0, item: { k: 'tool', tier: t, kinds: ['knife'] } }, req: t > 2 ? f + '_knife' + (t - 1) : null };
    }
  };
  const qp1 = Sys.questProgress, qg1 = Sys.questGoal, ti1 = Sys.turnIn;
  Sys.questProgress = function (q) { if (q.type === 'gather') { const c = G.player.c; return Math.min(K.have(c, q.wood), q.n) + Math.min(K.have(c, q.stone), q.n); } return qp1.apply(this, arguments); };
  Sys.questGoal = function (q) { return q.type === 'gather' ? q.n * 2 : qg1.apply(this, arguments); };
  Sys.turnIn = function (q) {
    if (q.type !== 'gather') return ti1.apply(this, arguments);
    if (!Sys.questComplete(q)) return;
    const c = G.player.c; ti1.apply(this, arguments); K.gather(c)[q.wood] -= q.n; K.gather(c)[q.stone] -= q.n;
  };
  Sys.kingQuestFor = function (c) { for (let i = 1; i <= 4; i++) { const q = Sys.QUESTS[c.faction + '_build' + i]; if (q && !c.quests.done[q.id]) return q; } return null; };
  const qp0 = Sys.questProgress, qg0 = Sys.questGoal, ti0 = Sys.turnIn;
  Sys.questProgress = function (q) { if (q.type === 'build') { const c = G.player.c; return Math.min(K.have(c, q.wood), q.n) + Math.min(K.have(c, q.stone), q.n); } return qp0.apply(this, arguments); };
  Sys.questGoal = function (q) { return q.type === 'build' ? q.n * 2 : qg0.apply(this, arguments); };
  Sys.turnIn = function (q) {
    if (q.type !== 'build') return ti0.apply(this, arguments);
    if (!Sys.questComplete(q)) return;
    const c = G.player.c, ct = G.account.cities[c.faction]; ct.built = Math.max(ct.built || 0, q.tier);
    ti0.apply(this, arguments);
    K.gather(c)[q.wood] -= q.n; K.gather(c)[q.stone] -= q.n;
    G.log(`${D.FACTIONS[c.faction].king} takes your ${K.MATS[q.wood].pl} and ${K.MATS[q.stone].pl}. The masons get to work.`, 'status', '#ffd84a');
    K.checkRise(c.faction); UI.refresh(); Sys.save();
  };
  K.progText = function (q) { const c = G.player.c; return `${Math.min(K.have(c, q.wood), q.n)} / ${q.n} ${K.MATS[q.wood].pl} · ${Math.min(K.have(c, q.stone), q.n)} / ${q.n} ${K.MATS[q.stone].pl}`; };
  // a kingdom rises only with both status and the king's building work done
  K.checkRise = function (f) {
    const city = G.account.cities[f]; if (city.built == null || city.built < city.level - 1) city.built = city.level - 1;
    const mine = G.player && G.player.c.faction === f;
    while (city.level < 5 && city.status >= D.CITY_THRESHOLDS[city.level]) {
      if ((city.built || 0) < city.level) {
        if (!mine) { city.built = city.level; } // the rival's people gather their own timber and stone
        else { city.waitMsg = city.waitMsg || {}; if (!city.waitMsg[city.level]) { city.waitMsg[city.level] = 1; const B = K.BUILD[city.level]; G.log(`${D.FACTIONS[f].city} has the status to rise, but ${D.FACTIONS[f].king} still needs ${B.n} ${K.MATS[B.wood].pl} and ${B.n} ${K.MATS[B.stone].pl}. Bring them to the great hall.`, 'status', '#ffd84a'); KR.UI && KR.UI.toast && KR.UI.toast('Your king needs materials', `${B.n} ${K.MATS[B.wood].pl} and ${B.n} ${K.MATS[B.stone].pl}`); } break; }
      }
      city.level++; Sys.cityChanged(f, true);
    }
  };
  Sys.addStatus = function (f, n, why) {
    const city = G.account.cities[f]; city.status += n;
    if (n && G.player && G.player.c.faction === f) G.log(`+${n} status for ${D.FACTIONS[f].city}${why ? ' for ' + why : ''}.`, 'status', '#f0c75e');
    K.checkRise(f); KR.UI && KR.UI.refresh();
  };
  // named monsters already give status; make it count a little more, bosses are the big prize
  const ladv0 = Sys.advice;
  Sys.advice = function () {
    const out = ladv0 ? ladv0.apply(this, arguments) : []; const p = G.player; if (!p) return out; const c = p.c; const f = c.faction;
    const need = K.needFor(f); const ct = G.account.cities[f];
    if (need) { const hw = K.have(c, need.wood), hs = K.have(c, need.stone); const q = Sys.QUESTS[f + '_build' + ct.level];
      const line = !c.quests.active[q.id] && !c.quests.done[q.id] ? `${D.FACTIONS[f].king} wants timber and stone to build. Speak to him up in the King's Tower.` : `The king still needs ${Math.max(0, need.n - hw)} more ${K.MATS[need.wood].pl} and ${Math.max(0, need.n - hs)} more ${K.MATS[need.stone].pl}. ${K.MATS[need.wood].pl} come from ${K.MATS[need.wood].where}.`;
      out.splice(1, 0, line); }
    return out;
  };

  // =====================================================================
  // town life: games, spread-out townsfolk, and the kings' grudges
  // =====================================================================
  const okTile = (x, y) => W.inb(x, y) && !W.isBlockedTile(x, y) && ![T.WATER, T.DEEP].includes(W.tile(x, y)) && !W.buildingAt(x * TS + 16, y * TS + 16);
  K.townSpot = function (f, rmin, rmax) {
    const cd = W.cityData[f]; if (!cd) return null;
    for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, r = rmin + Math.random() * (rmax - rmin); const x = Math.round(cd.cx + Math.cos(a) * r), y = Math.round(cd.cy + Math.sin(a) * r); if (okTile(x, y) && okTile(x + 1, y) && okTile(x, y + 1)) return [x * TS + 16, y * TS + 16]; }
    return null;
  };
  // find an open patch of ground for a game, away from the plaza and other games
  function findOpen(f, w, h, taken, outside) {
    const cd = W.cityData[f]; const { cx, cy, R } = cd; let best = null, bs = -1e9;
    const lo = outside ? R + 16 : R - 3;
    for (let y = cy - lo; y <= cy + lo - h; y++) for (let x = cx - lo; x <= cx + lo - w; x++) {
      const mx = x + w / 2, my = y + h / 2; const dc = Math.hypot(mx - cx, my - cy); if (dc < 7) continue;
      if (outside) { const inside = (xx, yy) => Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) <= R + 2; if (inside(x, y) || inside(x + w, y) || inside(x, y + h) || inside(x + w, y + h) || (Math.abs(mx - cx) < R + 2 && Math.abs(my - cy) < R + 2)) continue; }
      if (taken.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
      let ok = true, road = 0;
      for (let j = -1; j <= h && ok; j++) for (let i = -1; i <= w; i++) { const tx = x + i, ty = y + j; const free = outside ? W.inb(tx, ty) && !KR.SOLID[W.tile(tx, ty)] && ![T.WATER, T.DEEP, T.CWALL, T.WALL].includes(W.tile(tx, ty)) && !W.buildingAt(tx * TS + 16, ty * TS + 16) && !D.REGIONS[W.region[ty * W.W + tx]].dungeon : okTile(tx, ty) && !W.block[ty * W.W + tx]; if (!free) { ok = false; break; } const tt = W.tile(tx, ty); if (tt === T.FARM) { ok = false; break; } if (tt === T.ROAD || tt === T.COBBLE) road++; }
      if (!ok) continue;
      const sc = outside ? -dc - road * 2 + Math.random() * 3 : -Math.abs(dc - R * 0.55) - road * 0.6 + Math.random() * 2;
      if (sc > bs) { bs = sc; best = { x, y, w, h }; }
    }
    if (best) { taken.push(best);
      if (outside) { // clear a village green: fell the trees, move the rocks
        const r = best; W.decor = W.decor.filter((d) => !(d.tx >= r.x - 1 && d.tx <= r.x + r.w && d.ty >= r.y - 1 && d.ty <= r.y + r.h));
        for (let j = -1; j <= r.h; j++) for (let i = -1; i <= r.w; i++) { const k = (r.y + j) * W.W + r.x + i; W.block[k] = 0; if ([T.FOREST, T.SAND, T.GRAVEL, T.MUD].includes(W.tiles[k])) W.tiles[k] = T.GRASS; }
        KR.R.reindex(); KR.R.clear(); }
    }
    return best;
  }
  const findSpot = (f, w, h, taken) => findOpen(f, w, h, taken, true) || findOpen(f, w, h, taken, false);
  const NM = (f) => D.NAMES[f] || D.NAMES.crown;
  function mkFolk(f, x, y, role, opt = {}) {
    const F = D.FACTIONS[f]; const gender = opt.gender || (Math.random() < 0.5 ? 'm' : 'f'); const race = opt.race || U.pick(F.races);
    const name = opt.name || U.pick(NM(f)[gender]);
    const e = G.makeEnt({ type: 'npc', role, city: f, faction: f, name, title: opt.title || '', x, y, homeX: x, homeY: y, level: 20, gender, race, skin: S.skinOf(race, Math.floor(Math.random() * 4)), hair: race === 'darkelf' ? S.HAIRS[4] : S.HAIRS[Math.floor(Math.random() * 7)], hairStyle: Math.floor(Math.random() * 4), speed: 80, services: [], seed: Math.random() });
    e.hpMax = e.hp = 500; e.static = true; e.kgame = true; e.look = Sys.npcLook(e, {}); if (opt.scale) { e.scale = opt.scale; }
    return e;
  }
  function mkProp(f, x, y, draw, opt = {}) {
    const e = G.makeEnt({ type: 'prop', city: f, faction: f, name: opt.name || '', x, y, homeX: x, homeY: y, level: 1, hostile: false, services: [] });
    e.customDraw = draw; e.static = true; e.invuln = true; e.noPick = true; e.noLabel = true; e.kgame = true; e.look = null; return e;
  }
  K.games = {};
  K.spawnGames = function (f) {
    G.ents.filter((e) => e.kgame && e.city === f).forEach((e) => G.remove(e));
    const cd = W.cityData[f]; if (!cd) return; const lvl = cd.level || Sys.cityLevel(f); const taken = [];
    const games = (K.games[f] = []);
    // kickball: children (and a grown-up or two) on a chalked pitch
    const kb = findSpot(f, 12, 7, taken);
    if (kb) {
      const g = { kind: 'kickball', r: kb, score: [0, 0] }; games.push(g);
      const x0 = kb.x * TS, y0 = kb.y * TS, w = kb.w * TS, h = kb.h * TS; g.box = { x0, y0, x1: x0 + w, y1: y0 + h };
      g.ball = { x: x0 + w / 2, y: y0 + h / 2, vx: 0, vy: 0, z: 0, vz: 0 };
      g.prop = mkProp(f, x0 + w / 2, y0 - 2, (gg, e, t) => drawPitch(gg, g, t));
      g.ballEnt = mkProp(f, g.ball.x, g.ball.y, (gg, e, t) => drawBall(gg, g, t));
      const n = 4 + Math.min(2, lvl - 1);
      g.players = []; for (let k = 0; k < n; k++) { const team = k % 2; const kid = k < n - 1 || lvl < 3; const p = mkFolk(f, x0 + (team ? w * 0.7 : w * 0.3), y0 + h * (0.25 + 0.5 * ((k >> 1) % 2)), kid ? 'child' : 'gamer', { scale: kid ? 0.72 : 1 }); p.team = team; if (kid) p.look = Sys.npcLook(p, {}); p.speed = 95 + Math.random() * 25; g.players.push(p); }
    }
    // archery range: two straw targets and two archers
    const ar = findSpot(f, 9, 3, taken);
    if (ar) {
      const g = { kind: 'archery', r: ar, shots: [], stuck: [] }; games.push(g);
      const ty = (ar.y + 1) * TS + 16;
      g.targets = [0, 1].map((k) => ({ x: (ar.x + ar.w - 1) * TS + 16, y: ty - 18 + k * 36 }));
      g.prop = mkProp(f, g.targets[0].x, ar.y * TS + 4, (gg, e, t) => drawArchery(gg, g, t));
      g.players = [0, 1].map((k) => { const p = mkFolk(f, (ar.x + 1) * TS + 16, g.targets[k].y + 10, 'gamer'); p.look.weapon = 'ARC'; p.dir = 2; p.face = 1; p.gameT = 1 + k * 1.7; return p; });
    }
    // axe throwing: a big wooden round on a stand
    const ax = findSpot(f, 6, 3, taken);
    if (ax) {
      const g = { kind: 'axes', r: ax, shots: [], stuck: [] }; games.push(g);
      g.targets = [{ x: (ax.x + ax.w - 1) * TS + 16, y: (ax.y + 1) * TS + 16 }];
      g.prop = mkProp(f, g.targets[0].x, ax.y * TS + 4, (gg, e, t) => drawAxes(gg, g, t));
      g.players = [0, 1].map((k) => { const p = mkFolk(f, (ax.x + 1 - k) * TS + 16, (ax.y + 1 + (k ? 1 : 0)) * TS + 16 + 8, 'gamer'); p.dir = 2; p.face = 1; p.gameT = 2 + k * 2.5; p.waiting = k === 1; return p; });
    }
    // spectators drift over to the games now and then
  };
  // ----- drawing -----
  function drawTargetButt(g, x, y, t) { g.save(); g.translate(x, y); g.scale(1.35, 1.35); g.translate(-x, -y); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + 8, 12, 4, 0, 0, 6.28); g.fill(); g.strokeStyle = '#6a4a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 7, y + 8); g.lineTo(x - 3, y - 8); g.moveTo(x + 7, y + 8); g.lineTo(x + 3, y - 8); g.stroke(); g.fillStyle = '#d8c070'; g.beginPath(); g.arc(x, y - 18, 13, 0, 6.28); g.fill(); const rings = ['#f4f0e0', '#3a3a3a', '#3a8ad8', '#d83a3a', '#f0d040']; rings.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(x, y - 18, 11 - i * 2.2, 0, 6.28); g.fill(); }); g.restore(); }
  function drawArchery(g, G2, t) {
    const r = G2.r; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo((r.x + 2) * TS, r.y * TS + 8); g.lineTo((r.x + 2) * TS, (r.y + r.h) * TS - 4); g.stroke(); g.setLineDash([]);
    for (const tg of G2.targets) drawTargetButt(g, tg.x, tg.y, t);
    for (const s of G2.stuck) { g.strokeStyle = '#5a3a20'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - 10, s.y + 1); g.stroke(); g.fillStyle = '#e8e0d0'; g.fillRect(s.x - 12, s.y - 1, 3, 3); }
    for (const s of G2.shots) { const k = Math.min(1, s.t / s.dur); const x = s.x0 + (s.x1 - s.x0) * k, y = s.y0 + (s.y1 - s.y0) * k - Math.sin(k * Math.PI) * 14; g.strokeStyle = '#5a3a20'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 12, y + 1); g.stroke(); }
  }
  function drawAxes(g, G2, t) {
    const tg = G2.targets[0]; const x = tg.x, y = tg.y; g.save(); g.translate(x, y); g.scale(1.3, 1.3); g.translate(-x, -y);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + 8, 14, 4, 0, 0, 6.28); g.fill(); g.strokeStyle = '#5a3a20'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 9, y + 8); g.lineTo(x - 4, y - 10); g.moveTo(x + 9, y + 8); g.lineTo(x + 4, y - 10); g.stroke();
    g.fillStyle = '#a8784a'; g.beginPath(); g.arc(x, y - 22, 16, 0, 6.28); g.fill(); g.strokeStyle = '#7a5030'; g.lineWidth = 1.2; for (let k = 4; k < 16; k += 4) { g.beginPath(); g.arc(x, y - 22, k, 0, 6.28); g.stroke(); } g.fillStyle = '#c83a2a'; g.beginPath(); g.arc(x, y - 22, 3, 0, 6.28); g.fill();
    const axe = (ax, ay, rot) => { g.save(); g.translate(ax, ay); g.rotate(rot); g.fillStyle = '#6a4424'; g.fillRect(-1.5, -2, 3, 14); g.fillStyle = '#c8ccd2'; g.beginPath(); g.moveTo(1, -2); g.quadraticCurveTo(9, -4, 8, 4); g.lineTo(1, 3); g.closePath(); g.fill(); g.restore(); };
    g.restore();
    for (const s of G2.stuck) axe(s.x, s.y, -0.4);
    for (const s of G2.shots) { const k = Math.min(1, s.t / s.dur); axe(s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k - Math.sin(k * Math.PI) * 18, k * 12); }
  }
  function drawPitch(g, G2, t) {
    const b = G2.box; g.save(); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2; g.strokeRect(b.x0 + 4, b.y0 + 4, b.x1 - b.x0 - 8, b.y1 - b.y0 - 8);
    const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2; g.beginPath(); g.moveTo(mx, b.y0 + 4); g.lineTo(mx, b.y1 - 4); g.stroke(); g.beginPath(); g.arc(mx, my, 22, 0, 6.28); g.stroke();
    for (const s of [0, 1]) { const gx = s ? b.x1 - 4 : b.x0 + 4; g.strokeStyle = '#e8e0d0'; g.lineWidth = 3; g.beginPath(); g.moveTo(gx, my - 26); g.lineTo(gx, my - 50); g.moveTo(gx, my + 26); g.lineTo(gx, my + 2); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(gx, my - 50); g.lineTo(gx, my + 2); g.stroke(); }
    g.restore();
  }
  function drawBall(g, G2, t) { const B = G2.ball; g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(B.x, B.y + 2, 6, 2.5, 0, 0, 6.28); g.fill(); g.fillStyle = '#c8462e'; g.beginPath(); g.arc(B.x, B.y - 4 - B.z, 5.5, 0, 6.28); g.fill(); g.strokeStyle = '#f0e0c0'; g.lineWidth = 1.2; g.beginPath(); g.arc(B.x, B.y - 4 - B.z, 5.5, -0.6 + B.x * 0.05, 1.2 + B.x * 0.05); g.stroke(); }
  // ----- behaviour -----
  const near = (e, d) => G.player && Math.hypot(G.player.x - e.x, G.player.y - e.y) < d;
  const isNight = () => { const h = Math.floor(G.clock / 60); return h >= 22 || h < 6; };
  const shout = (e, lines, ch) => { if (Math.random() < ch && near(e, 420) && !e.bubble && G.now > (K._shoutGate || 0)) { K._shoutGate = G.now + 9000; G.say(e, U.pick(lines), 2.5); } };
  K.gameTick = function (dt) {
    for (const f in K.games) for (const g of K.games[f]) {
      if (!g.players || !g.players.length || g.players[0].removed) continue;
      const night = isNight();
      if (g.kind === 'archery' || g.kind === 'axes') {
        g.shots.forEach((s) => (s.t += dt));
        for (const s of g.shots.filter((s) => s.t >= s.dur)) { g.stuck.push({ x: s.x1, y: s.y1, until: G.now + 9000 }); if (near(g.prop, 300)) KR.A.sfx(g.kind === 'axes' ? 'block' : 'arrowhit', 0.18); if (s.bull) shout(s.by, g.kind === 'axes' ? ['Ha! Dead center!', 'Right in the eye!', 'Beat that!'] : ['Bullseye!', 'Did you see that?', 'Right in the gold!'], 0.6); else shout(s.by, ['Bah, the wind.', 'Close enough!', 'That one counts.'], 0.15); }
        g.shots = g.shots.filter((s) => s.t < s.dur); g.stuck = g.stuck.filter((s) => s.until > G.now).slice(-8);
        if (night) continue;
        for (const p of g.players) {
          if (p.removed || p.dead || p.fleeing) continue; p.gameT -= dt; if (p.atk > 0) { p.atk += dt * 3; if (p.atk > 1) p.atk = 0; }
          if (p.gameT > 0) continue;
          if (g.kind === 'axes') { // take turns: the thrower steps up, the other waits
            if (p.waiting) { p.gameT = 1; continue; }
          }
          p.gameT = g.kind === 'axes' ? 3.2 + Math.random() * 1.5 : 2.4 + Math.random() * 2;
          const tg = g.targets[g.kind === 'axes' ? 0 : g.players.indexOf(p)] || g.targets[0];
          const bull = Math.random() < 0.3; const off = bull ? 1.5 : 7;
          p.atk = 0.01; G.faceTo(p, tg);
          const x1 = tg.x + (Math.random() - 0.5) * off * 2, y1 = tg.y - (g.kind === 'axes' ? 29 : 24) + (Math.random() - 0.5) * off * 2;
          g.shots.push({ x0: p.x + 12, y0: p.y - 26, x1, y1, t: 0, dur: g.kind === 'axes' ? 0.55 : 0.35, by: p, bull });
          if (near(p, 300)) KR.A.sfx(g.kind === 'axes' ? 'whoosh' : 'bow', 0.15);
          if (g.kind === 'axes') g.players.forEach((q) => { q.waiting = q === p; });
        }
      } else if (g.kind === 'kickball') {
        const B = g.ball, bx = g.box; const mx = (bx.x0 + bx.x1) / 2, my = (bx.y0 + bx.y1) / 2;
        // the ball rolls and bounces off the touchlines
        B.x += B.vx * dt; B.y += B.vy * dt; B.vx *= Math.pow(0.45, dt); B.vy *= Math.pow(0.45, dt); B.vz -= 420 * dt; B.z = Math.max(0, B.z + B.vz * dt); if (B.z === 0) B.vz = Math.abs(B.vz) > 60 ? -B.vz * 0.4 : 0;
        if (B.y < bx.y0 + 8) { B.y = bx.y0 + 8; B.vy = Math.abs(B.vy); } if (B.y > bx.y1 - 6) { B.y = bx.y1 - 6; B.vy = -Math.abs(B.vy); }
        const goal = B.x < bx.x0 + 6 ? 1 : B.x > bx.x1 - 6 ? 0 : -1;
        if (goal >= 0) {
          if (Math.abs(B.y - my) < 24) { g.score[goal]++; const sc = g.players.find((q) => q.team === goal); if (sc) shout(sc, ['GOAL!', 'Goooal!', 'Did you see that?!', `${g.score[0]} to ${g.score[1]}!`], 1); if (near(g.prop, 380)) KR.A.sfx('chime', 0.18); B.x = mx; B.y = my; B.vx = B.vy = 0; }
          else { B.x = goal ? bx.x0 + 8 : bx.x1 - 8; B.vx = -B.vx * 0.5; }
        }
        g.ballEnt.x = B.x; g.ballEnt.y = B.y + 1;
        if (night) { for (const p of g.players) p.moving = false; continue; }
        // the closest player of each team chases the ball; the rest hold their spot
        const chasers = [0, 1].map((tm) => g.players.filter((q) => q.team === tm && !q.removed).sort((a, b) => Math.hypot(a.x - B.x, a.y - B.y) - Math.hypot(b.x - B.x, b.y - B.y))[0]);
        g.players.forEach((p, k) => {
          if (p.removed || p.fleeing) return; if (p.atk > 0) { p.atk += dt * 4; if (p.atk > 1) p.atk = 0; }
          let tx, ty; if (chasers.includes(p)) { tx = B.x + (p.team ? 10 : -10); ty = B.y; } else { const lane = ((k >> 1) % 2) ? 0.72 : 0.28; tx = mx + (p.team ? 1 : -1) * (bx.x1 - bx.x0) * 0.18 + (B.x - mx) * 0.4; ty = bx.y0 + (bx.y1 - bx.y0) * lane; }
          const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
          if (d > 6) { const sp = Math.min(d, p.speed * dt); p.x += dx / d * sp; p.y += dy / d * sp; p.moving = true; p.walk += dt * 11; if (Math.abs(dx) > Math.abs(dy)) { p.dir = dx < 0 ? 1 : 2; p.face = dx < 0 ? -1 : 1; } else p.dir = dy < 0 ? 3 : 0; } else p.moving = false;
          p.x = U.clamp(p.x, bx.x0 + 4, bx.x1 - 4); p.y = U.clamp(p.y, bx.y0 + 8, bx.y1 - 4);
          if (chasers.includes(p) && Math.hypot(p.x - B.x, p.y - B.y) < 16 && B.z < 6 && (p.kickT || 0) < G.now) {
            p.kickT = G.now + 700; p.atk = 0.01;
            const aimX = p.team ? bx.x0 : bx.x1, aimY = my + (Math.random() - 0.5) * 70; const a = Math.atan2(aimY - B.y, aimX - B.x) + (Math.random() - 0.5) * 0.9; const pw = 120 + Math.random() * 160;
            B.vx = Math.cos(a) * pw; B.vy = Math.sin(a) * pw; B.vz = Math.random() < 0.4 ? 160 : 60;
            if (near(p, 280)) KR.A.sfx('kick', 0.12); shout(p, ['Mine!', 'Pass it!', 'Over here!', 'Kick it!', 'Ha!'], 0.06);
          }
        });
      }
    }
  };
  // townsfolk wander the whole town, not just the plaza, and sometimes go and watch a game
  const choose0 = Sys.npcChooseTask;
  Sys.npcChooseTask = function (e, h) {
    if (e.kgame) { e.idleT = 99; return; }
    if ((e.role === 'townsfolk' || e.role === 'child') && !e.fleeing) {
      const night = h >= 22 || h < 6, evening = h >= 18 && h < 22;
      if (!night && !(evening && e.role === 'townsfolk')) {
        const cd = W.cityData[e.city]; if (!cd) return choose0.apply(this, arguments);
        let goal = null; const gs = K.games[e.city] || [];
        if (gs.length && Math.random() < (e.role === 'child' ? 0.45 : 0.3)) { const g = U.pick(gs); const r = g.r; const side = Math.random() < 0.5 ? -1 : r.h + 1; goal = [(r.x + Math.floor(Math.random() * r.w)) * TS + 16, (r.y + side) * TS + 16]; if (!okTile(Math.floor(goal[0] / TS), Math.floor(goal[1] / TS))) goal = null; }
        if (!goal) goal = K.townSpot(e.city, 5, Math.max(8, cd.R - 4));
        if (goal) {
          const path = W.findPath(Math.floor(e.x / TS), Math.floor(e.y / TS), Math.floor(goal[0] / TS), Math.floor(goal[1] / TS), 3500, { door: 'pass' });
          if (path) { e.path = path; e.task = e.role === 'child' ? 'play' : 'wander'; e.taskDur = e.role === 'child' ? 3 + Math.random() * 5 : 8 + Math.random() * 16; e.doing = null; return; }
        }
      }
    }
    return choose0.apply(this, arguments);
  };
  // spread the plaza traders around the town square instead of piling them in the middle
  function spreadPlaza(f) {
    const cd = W.cityData[f]; if (!cd) return; const { cx, cy } = cd;
    const roles = ['captain', 'mercmaster', 'outfitter', 'bounty', 'healer', 'grocer', 'tinker'];
    const ents = G.ents.filter((e) => e.city === f && roles.includes(e.role) && !e.removed);
    const r0 = Math.min(cd.R - 6, 9 + (cd.level || 1));
    ents.forEach((e, k) => {
      for (let tries = 0; tries < 24; tries++) {
        const a = (k / ents.length) * 6.28 + 0.4 + tries * 0.26, r = r0 - (tries % 4); const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.8);
        if (okTile(x, y) && okTile(x, y + 1) && okTile(x - 1, y) && okTile(x + 1, y)) { e.x = e.homeX = x * TS + 16; e.y = e.homeY = y * TS + 16; break; }
      }
    });
  }
  // after every rebuild of a town: kings' voices, games, spread-out traders
  const spawnCity0 = Sys.spawnCity;
  Sys.spawnCity = function (f) {
    const r = spawnCity0.apply(this, arguments);
    try {
      const king = G.ents.find((e) => e.type === 'king' && e.faction === f && !e.removed);
      if (king) king.greetFn = () => (G.player && G.player.c.faction === f ? U.pick(K.KING_LINES[f]) : U.pick(K.ENEMY_KING[f]));
      spreadPlaza(f); K.spawnGames(f);
    } catch (e) { console.warn(e); }
    return r;
  };
  const hail0 = Sys.hail;
  Sys.hail = function (e) { if (e.type === 'king' && G.player && e.faction !== G.player.c.faction) { G.say(e, U.pick(K.ENEMY_KING[e.faction] || ['Guards!']), 3); return; } return hail0.apply(this, arguments); };
  // the king grumbles about his brother when you are in the hall
  let kingT = 20;
  function kingTick(dt) {
    kingT -= dt; if (kingT > 0) return; kingT = 45 + Math.random() * 40;
    const p = G.player; if (!p) return; const k = G.ents.find((e) => e.type === 'king' && e.faction === p.c.faction && !e.dead && !e.removed);
    if (k && Math.hypot(k.x - p.x, k.y - p.y) < 360 && !k.bubble) G.say(k, U.pick(K.KING_LINES[p.c.faction]), 5);
  }

  // =====================================================================
  // Vinny's last rites: a priest burns the body and leaves an urn
  // =====================================================================
  const egg = () => { const c = G.player.c; c.eggs = c.eggs || {}; return c.eggs; };
  function drawUrn(g, x, y, t, glow) {
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 2, 9, 3.5, 0, 0, 6.28); g.fill();
    g.fillStyle = '#7a4a2e'; g.beginPath(); g.moveTo(x - 5, y + 1); g.quadraticCurveTo(x - 11, y - 9, x - 5, y - 17); g.lineTo(x + 5, y - 17); g.quadraticCurveTo(x + 11, y - 9, x + 5, y + 1); g.closePath(); g.fill();
    g.fillStyle = '#5a3420'; g.fillRect(x - 6, y - 20, 12, 4); g.fillStyle = '#c8a04a'; g.fillRect(x - 7, y - 11, 14, 2); g.beginPath(); g.arc(x, y - 22, 2.2, 0, 6.28); g.fill();
    g.fillStyle = '#e8c870'; g.font = 'bold 7px serif'; g.textAlign = 'center'; g.fillText('V', x, y - 3);
    if (glow > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y - 10, 1, x, y - 10, 30); gr.addColorStop(0, `rgba(255,220,140,${0.6 * glow})`); gr.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = gr; g.fillRect(x - 30, y - 40, 60, 60); g.restore(); }
  }
  K.spawnUrn = function (x, y) {
    G.ents.filter((e) => e.vinnyUrn).forEach((e) => G.remove(e));
    const p = G.player; const f = p.c.faction;
    const e = G.makeEnt({ type: 'npc', role: 'urn', city: null, faction: null, name: 'Vinny\'s Urn', title: '', x, y, homeX: x, homeY: y, level: 1, hostile: false, services: [] });
    e.vinnyUrn = true; e.static = true; e.invuln = true; e.mute = true; e.look = null; e.r = 10; e.h = 26; e.born = G.now;
    e.customDraw = (g, e2, t) => drawUrn(g, e2.x, e2.y, t, Math.max(0, 1 - (G.now - e2.born) / 2500));
    e.greetFn = () => U.pick(['Here rests Vinny. Annoying in life. Quiet at last.', 'A small clay urn. Someone has scratched "V" into it, and under that, smaller: "finally".', 'The urn is silent. It is the nicest thing Vinny has ever been.']);
    return e;
  };
  K.cremate = function (corpse) {
    const p = G.player; const f = p.c.faction; const V = egg().vinny || {};
    const healer = G.ents.find((e) => e.city === f && e.role === 'healer' && !e.removed);
    let sx = healer ? healer.x + 30 : corpse.x + 300, sy = healer ? healer.y + 10 : corpse.y;
    const name = f === 'sylvan' ? 'Sister Elowen' : 'Father Osric';
    const pr = G.makeEnt({ type: 'npc', role: 'healer', city: f, faction: f, name, title: 'Priest', x: sx, y: sy, homeX: sx, homeY: sy, level: 30, gender: f === 'sylvan' ? 'f' : 'm', race: f === 'sylvan' ? 'halfelf' : 'human', skin: S.skinOf('human', 1), hair: S.HAIRS[f === 'sylvan' ? 3 : 4], hairStyle: 1, speed: 80, services: [], seed: 0.4 });
    pr.hpMax = pr.hp = 500; pr.static = true; pr.mute = true; pr.invuln = true; pr.kpriest = true; pr.look = Sys.npcLook(pr, {}); pr.greetFn = () => 'Not now, child. I have a body to see to.';
    const side = p.x > corpse.x ? -1 : 1; const tx = Math.floor((corpse.x + side * 40) / TS), ty = Math.floor(corpse.y / TS);
    pr.path = W.findPath(Math.floor(sx / TS), Math.floor(sy / TS), tx, ty, 4000, { door: 'pass' }) || [[tx, ty]];
    K.rite = { pr, corpse, phase: 'walk', t: 0, f, x: corpse.x, y: corpse.y, start: [sx, sy], side };
    G.log(`${name} hurries over from the temple.`, 'sys', '#e8e0c8');
  };
  function riteTick(dt) {
    const R = K.rite; if (!R) return; const pr = R.pr; if (pr.removed) { K.rite = null; return; }
    R.t += dt;
    const walk = (path, done) => {
      if (!path || !path.length) { pr.moving = false; done(); return; }
      const [tx, ty] = path[0]; const gx = tx * TS + 16, gy = ty * TS + 16; const dx = gx - pr.x, dy = gy - pr.y, d = Math.hypot(dx, dy);
      if (d < 5) { path.shift(); return; } const sp = Math.min(d, pr.speed * dt); pr.x += dx / d * sp; pr.y += dy / d * sp; pr.moving = true; pr.walk += dt * 9; G.faceTo(pr, { x: gx, y: gy });
    };
    if (R.phase === 'walk') { walk(pr.path, () => { R.phase = 'look'; R.t = 0; G.faceTo(pr, R.corpse); G.say(pr, 'Let\'s see who we have here... Oh. Vinny.', 3); }); if (R.t > 25) { pr.x = R.x + R.side * 40; pr.y = R.y; pr.path = []; } }
    else if (R.phase === 'look' && R.t > 3) { R.phase = 'pray'; R.t = 0; pr.casting = true; G.say(pr, 'By the holy flame, I commit this... this... person... to the ashes.', 4); KR.A.sfx('cast', 0.5); }
    else if (R.phase === 'pray' && R.t > 2.2) { R.phase = 'burn'; R.t = 0; KR.A.sfx('fire', 0.8); KR.A.sfx('crackle', 0.6);
      R.light = { x: R.x, y: R.y - 10, r: 220, col: '255,150,60', fl: 0.3, k: 'fire' }; W.lights.push(R.light);
      R.fire = mkProp(R.f, R.x, R.y + 2, (g, e, t) => drawPyre(g, R, t)); R.fire.kgame = false; R.fire.riteFx = true; }
    else if (R.phase === 'burn') {
      if (R.t > 1.6 && !R.corpse.hidden) { R.corpse.hidden = true; }
      if (Math.random() < dt * 6) KR.A.sfx('crackle', 0.25);
      if (R.t > 3.6) { R.phase = 'urn'; R.t = 0; pr.casting = false; if (R.fire) G.remove(R.fire); const li = W.lights.indexOf(R.light); if (li >= 0) W.lights.splice(li, 1); if (!R.corpse.removed) G.remove(R.corpse);
        K.spawnUrn(R.x, R.y); G.fxAdd({ k: 'ring', x: R.x, y: R.y, r: 40, col: '#ffe08a', life: 0.9 }); KR.A.sfx('chime', 0.7);
        const V = egg().vinny || {}; V.urn = { x: R.x, y: R.y }; Sys.save && Sys.save(); }
    } else if (R.phase === 'urn' && R.t > 1.6) { R.phase = 'quip'; R.t = 0; G.say(pr, 'Man, that guy was annoying.', 5); }
    else if (R.phase === 'quip' && R.t > 4.5) { R.phase = 'leave'; R.t = 0; pr.path = W.findPath(Math.floor(pr.x / TS), Math.floor(pr.y / TS), Math.floor(R.start[0] / TS), Math.floor(R.start[1] / TS), 4000, { door: 'pass' }) || []; }
    else if (R.phase === 'leave') { walk(pr.path, () => { G.remove(pr); K.rite = null; }); if (R.t > 25) { G.remove(pr); K.rite = null; } }
  }
  function drawPyre(g, R, t) {
    const x = R.x, y = R.y; const k = R.phase === 'burn' ? Math.min(1, R.t / 0.5) * Math.min(1, (3.6 - R.t) / 0.6 + 0.2) : 0;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) { const ph = (t * 1.5 + i * 0.0833) % 1; const fx = x + Math.sin(i * 7.3 + t * 3) * 22 * (1 - ph); const fy = y - 4 - ph * 95 * k; const r = (18 - ph * 12) * k; if (r <= 0) continue; const gr = g.createRadialGradient(fx, fy, 0, fx, fy, r); gr.addColorStop(0, `rgba(255,240,170,${0.9 * (1 - ph)})`); gr.addColorStop(0.5, `rgba(255,140,40,${0.6 * (1 - ph)})`); gr.addColorStop(1, 'rgba(200,40,10,0)'); g.fillStyle = gr; g.beginPath(); g.arc(fx, fy, r, 0, 6.28); g.fill(); }
    g.restore();
    if (R.t > 1.5) { g.fillStyle = `rgba(60,50,45,${Math.min(0.8, (R.t - 1.5) / 2)})`; g.beginPath(); g.ellipse(x, y, 18, 6, 0, 0, 6.28); g.fill(); }
  }
  // the urn stays where Vinny fell
  const eggs0 = KR.War && KR.War.spawnEggs;
  if (KR.War) KR.War.spawnEggs = function () { if (eggs0) eggs0.apply(this, arguments); try { const V = G.player && egg().vinny; if (V && V.state === 'dead' && V.urn && (!W.realm || W.realm === 'main')) K.spawnUrn(V.urn.x, V.urn.y); } catch (e) {} };

  // =====================================================================
  // the whole thing again from scratch
  // =====================================================================
  Sys.fullReset = async function () {
    const a = G.account;
    for (const ch of a.chars.slice()) { try { await Sys.deleteChar(ch.id); } catch (e) {} }
    const def = Sys.defaultAccount();
    a.chars = []; delete a.faction; a.cities = def.cities; for (const f of D.FACTION_IDS) a.cities[f].built = 0; a.bank = def.bank; delete a.war; a.rivalT = 0; a.clock = 0;
    try { ['kr_sel_hero', 'kr_intro_seen'].forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    Sys.saveAccount(true);
    KR.UI.toast && KR.UI.toast('The realm is reborn', 'Every hero is gone and both kingdoms are back at level 1.');
  };

  // =====================================================================
  // the cover page: two brothers, one crown, a kingdom on fire
  // =====================================================================
  K.cover = function (gate, onGo) {
    gate.classList.add('cover-on'); gate.innerHTML = `<canvas class="cv-bg"></canvas><canvas class="cv-title"></canvas><div class="cv-sub">Two brothers. One crown.</div><div class="cv-click" id="gate-go">Click anywhere to continue to the main menu</div><button class="cv-snd" title="Sound">🔊</button>`;
    const bg = gate.querySelector('.cv-bg'), g = bg.getContext('2d'); const tc = gate.querySelector('.cv-title'), tg = tc.getContext('2d');
    // the real kings of the game, drawn in over the painting when the renderer is there (else the painted silhouettes)
    let kings3 = null; if (KR.coverKings) { const kc = document.createElement('canvas'); kc.className = 'cv-kings'; kc.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; bg.after(kc); try { kings3 = KR.coverKings(kc); } catch (e) { console.warn('cover kings', e); kings3 = null; } if (!kings3) kc.remove(); }
    const t0 = performance.now(); let alive = true;
    const startMusic = () => { try { KR.A.init(); KR.A.play('cover'); K.coverMusicUntil = performance.now() + 30000; } catch (e) {} };
    startMusic();
    gate.querySelector('.cv-snd').onclick = (ev) => { ev.stopPropagation(); startMusic(); gate.querySelector('.cv-snd').classList.add('on'); };
    const go = () => { if (!alive) return; alive = false; startMusic(); if (kings3) setTimeout(() => kings3.stop(), 500); gate.classList.add('out'); setTimeout(() => { gate.hidden = true; gate.classList.remove('out'); onGo(); }, 450); };
    // the first click (or key) takes the cover full screen and starts the music; the next one continues.
    // Browsers only allow full screen after the player does something, so it cannot happen on its own.
    let fsTried = false; const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const wantFs = () => { let on = true; try { on = localStorage.getItem('kr_auto_fs') !== '0'; } catch (e) {} return on && (document.fullscreenEnabled || document.webkitFullscreenEnabled); };
    const tryFs = () => { fsTried = true; startMusic(); const d = document.documentElement; try { const pr = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen && d.webkitRequestFullscreen(); if (pr && pr.then) pr.then(() => {}, () => go()); else if (!pr) go(); } catch (e) { go(); } };
    gate.onclick = () => { if (!alive) return; if (!fsTried && !fsOn() && wantFs()) tryFs(); else go(); };
    const keyFs = (e) => { if (!alive || gate.hidden) { removeEventListener('keydown', keyFs); return; } if (!fsTried && !fsOn() && wantFs()) tryFs(); else if (e.key === 'Enter' || e.key === ' ') go(); };
    addEventListener('keydown', keyFs);
    // the city skyline, built once
    const rnd = U.mulberry(77); const sky = []; let x = 0; while (x < 1) { const w = 0.02 + rnd() * 0.05; const kind = rnd() < 0.18 ? 'tower' : rnd() < 0.5 ? 'roof' : 'flat'; sky.push({ x, w, h: kind === 'tower' ? 0.18 + rnd() * 0.14 : 0.06 + rnd() * 0.08, kind, fire: rnd() < 0.55, ph: rnd() * 10 }); x += w + rnd() * 0.004; }
    const embers = [];
    // title mask: burn the letters in with a noise front
    let tmask = null, tW = 0, tH = 0, noise = null;
    const buildTitle = () => {
      tW = tc.width = Math.min(1100, innerWidth * 0.92) | 0; tH = tc.height = Math.round(tW * 0.2);
      const o = document.createElement('canvas'); o.width = tW; o.height = tH; const og = o.getContext('2d');
      let fs = Math.round(tH * 0.66); og.font = `700 ${fs}px "IM Fell English SC", Georgia, serif`; const mw = og.measureText('KINGDOM RISING').width; if (mw > tW * 0.94) { fs = Math.floor(fs * tW * 0.94 / mw); og.font = `700 ${fs}px "IM Fell English SC", Georgia, serif`; } og.textAlign = 'center'; og.textBaseline = 'middle';
      const gr = og.createLinearGradient(0, tH * 0.2, 0, tH * 0.8); gr.addColorStop(0, '#fff2c0'); gr.addColorStop(0.5, '#f0b84a'); gr.addColorStop(1, '#a8501a'); og.fillStyle = gr; og.fillText('KINGDOM RISING', tW / 2, tH * 0.54);
      tmask = og.getImageData(0, 0, tW, tH); noise = new Float32Array(tW * tH);
      for (let y = 0; y < tH; y++) for (let x2 = 0; x2 < tW; x2++) noise[y * tW + x2] = 0.55 * (x2 / tW) + 0.45 * U.fbm(x2 * 0.02, y * 0.05, 5, 3);
    };
    buildTitle();
    let out = null, lastProg = -1;
    try { document.fonts && document.fonts.ready.then(() => { buildTitle(); out = null; lastProg = -1; }); } catch (e) {}
    const frame = (now) => {
      if (!alive && gate.hidden) return; const t = (now - t0) / 1000;
      const W2 = (bg.width = innerWidth), H2 = (bg.height = innerHeight); {
      // sky: smoke-red night
      const sk = g.createLinearGradient(0, 0, 0, H2); sk.addColorStop(0, '#0a0406'); sk.addColorStop(0.55, '#3a0c08'); sk.addColorStop(0.8, '#8a2a0c'); sk.addColorStop(1, '#1a0604'); g.fillStyle = sk; g.fillRect(0, 0, W2, H2);
      // smoke plumes
      for (let i = 0; i < 7; i++) { const sx = W2 * (0.08 + i * 0.14) + Math.sin(t * 0.2 + i) * 30; for (let k = 0; k < 6; k++) { const ph = ((t * 0.05 + k / 6 + i * 0.13) % 1); g.fillStyle = `rgba(20,10,10,${0.22 * (1 - ph)})`; g.beginPath(); g.arc(sx + ph * 120 * Math.sin(i), H2 * (0.62 - ph * 0.6), 40 + ph * 140, 0, 6.28); g.fill(); } }
      // glow on the horizon
      const hz = g.createRadialGradient(W2 / 2, H2 * 0.78, 10, W2 / 2, H2 * 0.78, W2 * 0.7); hz.addColorStop(0, `rgba(255,120,30,${0.45 + Math.sin(t * 3) * 0.05})`); hz.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = hz; g.fillRect(0, 0, W2, H2);
      // the burning city
      const base = H2 * 0.8;
      g.fillStyle = '#0c0606';
      for (const b of sky) { const bx = b.x * W2, bw = b.w * W2, bh = b.h * H2; g.fillRect(bx, base - bh, bw, bh + 4); if (b.kind === 'roof') { g.beginPath(); g.moveTo(bx - 2, base - bh); g.lineTo(bx + bw / 2, base - bh - bw * 0.5); g.lineTo(bx + bw + 2, base - bh); g.fill(); } if (b.kind === 'tower') { g.beginPath(); g.moveTo(bx - 3, base - bh); g.lineTo(bx + bw / 2, base - bh - bw * 1.2); g.lineTo(bx + bw + 3, base - bh); g.fill(); for (let k = 0; k < 3; k++) g.fillRect(bx + k * bw / 3, base - bh - 4, bw / 5, 5); } }
      g.fillRect(0, base, W2, H2 - base);
      // windows glowing
      for (const b of sky) { const bx = b.x * W2, bw = b.w * W2, bh = b.h * H2; for (let k = 0; k < 3; k++) { const fl = 0.5 + 0.5 * Math.sin(t * 7 + b.ph + k); g.fillStyle = `rgba(255,${140 + fl * 60},40,${0.5 + fl * 0.4})`; g.fillRect(bx + bw * (0.2 + k * 0.25), base - bh * (0.35 + (k % 2) * 0.3), Math.max(2, bw * 0.12), Math.max(3, bh * 0.08)); } }
      // flames on the roofs
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const b of sky) { if (!b.fire) continue; const bx = (b.x + b.w / 2) * W2, top = base - b.h * H2 - (b.kind === 'tower' ? b.w * W2 * 1.2 : b.kind === 'roof' ? b.w * W2 * 0.5 : 0); for (let k = 0; k < 7; k++) { const ph = (t * 1.3 + k / 7 + b.ph) % 1; const fx = bx + Math.sin(k * 3.1 + t * 4 + b.ph) * b.w * W2 * 0.35 * (1 - ph); const fy = top + 6 - ph * (40 + b.w * W2 * 0.8); const r = (b.w * W2 * 0.45 + 8) * (1 - ph); const gr = g.createRadialGradient(fx, fy, 0, fx, fy, r); gr.addColorStop(0, `rgba(255,230,150,${0.8 * (1 - ph)})`); gr.addColorStop(0.45, `rgba(255,120,30,${0.55 * (1 - ph)})`); gr.addColorStop(1, 'rgba(160,20,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(fx, fy, r, 0, 6.28); g.fill(); }
        if (Math.random() < 0.25) embers.push({ x: bx, y: top, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 80, life: 2 + Math.random() * 3, t: 0 }); }
      for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.t += 1 / 60; if (e.t > e.life) { embers.splice(i, 1); continue; } e.x += (e.vx + Math.sin(e.t * 3 + i) * 20) / 60; e.y += e.vy / 60; g.fillStyle = `rgba(255,${150 + Math.random() * 80},60,${1 - e.t / e.life})`; g.fillRect(e.x, e.y, 2, 2); }
      g.restore();
      // the brothers, both hands on the crown
      if (!kings3) drawBrothers(g, W2, H2, t);
      // vignette
      const vg = g.createRadialGradient(W2 / 2, H2 / 2, H2 * 0.3, W2 / 2, H2 / 2, H2 * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)'); g.fillStyle = vg; g.fillRect(0, 0, W2, H2);
      }
      // the title burns into view
      const wantW = Math.min(1100, innerWidth * 0.92) | 0; if (tc.width !== wantW) { buildTitle(); lastProg = -1; }
      const prog = Math.min(1.15, Math.max(0, (t - 0.8) / 3.2) * 1.15);
      if (!out || out.width !== tW) out = tg.createImageData(tW, tH);
      if (prog !== lastProg) { lastProg = prog;
      const src = tmask.data, dst = out.data;
      for (let i = 0, n = tW * tH; i < n; i++) { const a = src[i * 4 + 3]; const j = i * 4; if (!a) { dst[j + 3] = 0; continue; } const nz = noise[i]; const edge = prog - nz;
        if (edge < 0) { dst[j + 3] = 0; continue; }
        if (edge < 0.07) { const k = edge / 0.07; dst[j] = 255; dst[j + 1] = 120 + 120 * k; dst[j + 2] = 40 * k; dst[j + 3] = a * (0.5 + 0.5 * k); }
        else { const fl = prog >= 1.1 ? 1 : 1; dst[j] = src[j] * fl; dst[j + 1] = src[j + 1] * fl; dst[j + 2] = src[j + 2] * fl; dst[j + 3] = a; } }
      tg.putImageData(out, 0, 0); }
      // flicker glow over the finished title
      tc.style.filter = `drop-shadow(0 0 ${14 + Math.sin(t * 5) * 6}px rgba(255,120,30,0.85)) drop-shadow(0 4px 0 #3a1000)`;
      gate.classList.toggle('t-done', t > 4.4);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  function drawBrothers(g, W2, H2, t) {
    const s = Math.min(W2 / 1000, H2 / 640) * 0.95; const cx = W2 / 2, by = H2 * 1.02;
    const tug = Math.sin(t * 1.3) * 3 * s; // they wrench the crown back and forth
    const fig = (side, col) => {
      g.save(); g.translate(cx + side * 230 * s + tug, by); g.scale(-side * s, s); // side -1 = left brother, facing right toward the crown
      // rim light from the fire
      g.shadowColor = 'rgba(255,110,30,0.9)'; g.shadowBlur = 22;
      g.fillStyle = '#080404';
      // cape
      g.beginPath(); g.moveTo(-20, -330); g.quadraticCurveTo(-120 - Math.sin(t * 1.7 + side) * 10, -160, -100, 0); g.lineTo(60, 0); g.lineTo(40, -300); g.closePath(); g.fill();
      // body
      g.beginPath(); g.moveTo(-50, 0); g.lineTo(-40, -250); g.quadraticCurveTo(-30, -330, 20, -335); g.quadraticCurveTo(70, -330, 70, -250); g.lineTo(80, 0); g.closePath(); g.fill();
      // head in profile, facing the crown (towards +x)
      g.beginPath(); g.moveTo(-5, -335); g.quadraticCurveTo(-30, -390, 5, -430); g.quadraticCurveTo(45, -450, 70, -420); g.lineTo(74, -400); g.lineTo(90, -385); g.lineTo(78, -378); g.lineTo(82, -365); // brow, nose
      g.lineTo(76, -360); g.lineTo(80, -350); g.quadraticCurveTo(70, -325, 40, -322); g.lineTo(20, -335); g.closePath(); g.fill();
      // beard
      g.beginPath(); g.moveTo(40, -350); g.quadraticCurveTo(70, -330, 66, -310); g.quadraticCurveTo(40, -300, 20, -330); g.fill();
      // arms reaching to the crown, both hands
      g.lineCap = 'round'; g.strokeStyle = '#080404'; g.lineWidth = 34; g.beginPath(); g.moveTo(40, -280); g.quadraticCurveTo(120, -300, 200, -330); g.stroke(); g.lineWidth = 30; g.beginPath(); g.moveTo(20, -250); g.quadraticCurveTo(110, -250, 200, -298); g.stroke();
      g.fillStyle = '#080404'; g.beginPath(); g.arc(205, -333, 17, 0, 6.28); g.fill(); g.beginPath(); g.arc(205, -297, 16, 0, 6.28); g.fill();
      g.shadowBlur = 0;
      // the angry eye
      g.fillStyle = `rgba(255,${80 + Math.sin(t * 6) * 30},40,0.95)`; g.beginPath(); g.ellipse(58, -392, 5, 2.2, -0.25, 0, 6.28); g.fill();
      g.strokeStyle = 'rgba(255,120,40,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(44, -404); g.lineTo(70, -396); g.stroke(); // furrowed brow
      // each wears his own crown: a dark circlet edged with gold by the firelight
      g.save(); g.translate(30, -428); g.rotate(-0.12); g.fillStyle = '#120806'; g.shadowColor = 'rgba(255,150,40,0.9)'; g.shadowBlur = 14;
      g.beginPath(); g.moveTo(-34, 0); g.lineTo(-34, -22); g.lineTo(-22, -10); g.lineTo(-12, -32); g.lineTo(0, -12); g.lineTo(12, -36); g.lineTo(22, -12); g.lineTo(32, -28); g.lineTo(34, 0); g.closePath(); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = `rgba(255,${190 + Math.sin(t * 4 + side) * 30},90,0.95)`; g.lineWidth = 3; g.stroke();
      g.fillStyle = col; g.beginPath(); g.arc(0, -6, 4.5, 0, 6.28); g.fill(); g.restore();
      // cloak trim in their colours
      g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(-40, -250); g.quadraticCurveTo(-30, -330, 20, -335); g.stroke();
      g.restore();
    };
    fig(-1, 'rgba(40,69,122,0.9)'); fig(1, 'rgba(46,106,60,0.9)');
    // the crown between them
    const kx = cx + tug, ky = by - 318 * s; g.save(); g.translate(kx, ky); g.scale(s, s);
    const gl = g.createRadialGradient(0, -10, 4, 0, -10, 120); gl.addColorStop(0, 'rgba(255,220,120,0.55)'); gl.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = gl; g.fillRect(-130, -130, 260, 240);
    const cg = g.createLinearGradient(0, -60, 0, 20); cg.addColorStop(0, '#fff0b0'); cg.addColorStop(0.5, '#e8b040'); cg.addColorStop(1, '#8a5a10'); g.fillStyle = cg;
    g.beginPath(); g.moveTo(-50, 14); g.lineTo(-56, -40); g.lineTo(-30, -14); g.lineTo(-15, -52); g.lineTo(0, -18); g.lineTo(15, -52); g.lineTo(30, -14); g.lineTo(56, -40); g.lineTo(50, 14); g.closePath(); g.fill();
    g.fillStyle = '#b8862a'; g.fillRect(-50, 4, 100, 12);
    [['#d83a3a', -30], ['#3a8ad8', 0], ['#3ad86a', 30]].forEach(([c, x]) => { g.fillStyle = c; g.beginPath(); g.arc(x, 10, 5, 0, 6.28); g.fill(); });
    for (const [x, y] of [[-56, -40], [-15, -52], [15, -52], [56, -40]]) { g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(x, y, 4, 0, 6.28); g.fill(); }
    // glint
    const gx = ((t * 0.4) % 1.6 - 0.3) * 120 - 60; g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(gx, -54); g.lineTo(gx + 10, -54); g.lineTo(gx - 10, 18); g.lineTo(gx - 20, 18); g.fill();
    g.restore();
  }
  // keep the cover's music going into the menu for a little while
  const play0 = KR.A.play;
  KR.A.play = function (name) {
    if (name === 'menu' && K.coverMusicUntil && performance.now() < K.coverMusicUntil) { setTimeout(() => { const scr = document.getElementById('screen'); if (scr && !scr.hidden && KR.A.curName === 'cover') play0.call(KR.A, 'menu'); }, K.coverMusicUntil - performance.now()); return play0.call(this, 'cover'); }
    return play0.apply(this, arguments);
  };

  // =====================================================================
  // ticking
  // =====================================================================
  if (KR.War) { const tick0 = KR.War.tick; KR.War.tick = function (dt) { tick0.apply(this, arguments); try { K.harvestTick(dt); } catch (e) { console.warn(e); } try { K.gameTick(dt); } catch (e) { console.warn(e); } try { riteTick(dt); } catch (e) { console.warn(e); } try { kingTick(dt); } catch (e) {} }; }

  // ---------- the king's court, up in his tower ----------
  // The world puts the king's and royal guards' places on the tower's upper floor (and its balcony). Anyone standing
  // inside that floor's rectangle is upstairs: the 3D view draws them at the floor's height. Whoever steps off it
  // (to chase an intruder, or to meet a war party at the door) comes down, and goes back up on returning.
  const inLoft = (e, b) => { const L = b.loft, tx = Math.floor(e.x / TS), ty = Math.floor(e.y / TS); return tx >= L.x0 && tx <= L.x1 && ty >= L.y0 && ty <= L.y1; };
  const courtOf = (f) => W.buildings.find((b) => b.city === f && b.type === 'kingtower' && b.court && b.loft);
  const spawnCourt0 = Sys.spawnCity;
  Sys.spawnCity = function (f) {
    const r = spawnCourt0.apply(this, arguments);
    try { const tw = courtOf(f); if (tw) for (const e of G.ents) if (e.faction === f && !e.removed && (e.type === 'king' || e.role === 'royalguard') && inLoft(e, tw)) { e.upB = tw; e.loftHome = tw; } } catch (err) { console.warn(err); }
    return r;
  };
  const moveCourt0 = G.moveEnt;
  G.moveEnt = function (e) {
    const r = moveCourt0.apply(this, arguments);
    if (e !== G.player && e.loftHome) { const up = inLoft(e, e.loftHome); if (up && !e.upB) e.upB = e.loftHome; else if (!up && e.upB === e.loftHome) e.upB = null; }
    return r;
  };
})();
