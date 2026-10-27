// Kingdom Rising — neutral towns, travel (ferry, dragon, balloon), zones, city bans, bag space, hub quests
(function () {
  const KR = window.KR;
  const D = KR.D, U = KR.U, G = KR.G, W = KR.W, Sys = KR.Sys, UI = KR.UI;
  const TS = D.TS;
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = UI.esc;
  const px = (t) => t * TS + 16;

  // ---------------- neutral NPCs ----------------
  const garb = (col, trim, kind = 'none') => ({ kind, col, trim });
  const HUB_NPCS = {
    tidesong: [
      { role: 'innkeeper', dx: -1, dy: -7, name: 'Marla Saltwhistle', title: 'Innkeeper', services: ['vendor:inn', 'bind'], race: 'halfling', g: 'f', look: { armor: garb('#e8e0d0', '#3a6a8a'), sash: '#3a6a8a' }, lines: ['Fresh fish stew tonight. Caught this morning, mostly.', 'Rooms are cheap, the sea air is free.', 'Pirates? Aye, Blackfin\'s crew raid the north shore. Keep your coin close.'] },
      { role: 'trader', dx: 7, dy: -6, name: 'Osric Brine', title: 'Island Trader', services: ['vendor:island'], race: 'human', g: 'm', look: { armor: garb('#6a8aa0', '#e0c060'), hat: 'feather', hatCol: '#3a5a7a' }, lines: ['Coral, pearls, rope and rum. What do you need?', 'Everything costs a little more on an island. Shipping, you see.'] },
      { role: 'smith', dx: 7, dy: 5, name: 'Torvald Anchorhand', title: 'Blacksmith', services: ['craft:smithing', 'vendor:metal'], race: 'dwarf', g: 'm', look: { armor: garb('#5a3e28', '#3a2618', 'leather'), weapon: '1HB', bare: true }, work: 'smith', lines: ['Salt eats steel. I spend half my days fighting rust.'] },
      { role: 'harbormaster', dx: 2, dy: 3, name: 'Harbormaster Quell', title: 'Harbormaster', services: [], race: 'human', g: 'm', look: { armor: garb('#2a3a5a', '#e0c060', 'cloth'), hat: 'feather', hatCol: '#2a3a5a', weapon: '1HS' }, lines: ['Every ship that docks here pays me a coin. Every pirate that sinks one costs me ten.'] },
      { role: 'tidepriest', dx: 0, dy: -3, name: 'Sister Coralie', title: 'Tide Priestess', services: ['vendor:healer'], race: 'erudite', g: 'f', look: { armor: garb('#3a7a9a', '#e8f0ff', 'cloth'), robe: true, hat: 'mitre', hatCol: '#3a7a9a', hatTrim: '#e8f0ff' }, lines: ['The old temple sank beneath the waves three hundred years ago. Its priests did not all drown.'] },
      { role: 'islander', dx: 4, dy: 7, name: 'Kaia Reedwind', title: 'Island Hunter', services: [], race: 'woodelf', g: 'f', look: { armor: garb('#4a7a3a', '#c8a060', 'leather'), back: 'bow' }, lines: ['The tigers here are bigger than any on the mainland. Something in the water.'] },
      { role: 'ferry', dx: -6, dy: 1, name: 'Captain Bram Gale', title: 'Ferry Captain', services: ['travel:docks'], race: 'human', g: 'm', look: { armor: garb('#3a4a6a', '#e0c060'), hat: 'feather', hatCol: '#1a2a4a', cape: '#1a2a4a' }, lines: ['The Gull sails for the Sunscour Docks whenever you are ready.'] },
      { role: 'watch', dx: -3, dy: 4, name: 'Port Watchman', title: 'Port Watch', services: [], race: 'human', g: 'm', look: { armor: garb('#8e9298', '#3a6a8a', 'chain'), helm: 'chain', weapon: 'spear' }, lines: ['Keep the peace in Port Tidesong. Every banner is welcome here.'] },
    ],
    docks: [
      { role: 'ferry', dx: 3, dy: 1, name: 'Captain Ysa Morrow', title: 'Ferry Captain', services: ['travel:tidesong'], race: 'halfelf', g: 'f', look: { armor: garb('#3a4a6a', '#e0c060'), hat: 'feather', hatCol: '#7a2a2a', cape: '#7a2a2a' }, lines: ['The crossing to the Isle of Tidesong takes a day by sail. For you, about a minute.'] },
      { role: 'nomad', dx: -3, dy: -1, name: 'Zahir of the Dunes', title: 'Desert Guide', services: ['vendor:nomad'], race: 'human', g: 'm', look: { armor: garb('#e8dcc0', '#b84a3a', 'cloth'), robe: true, hat: 'hood', hatCol: '#e8dcc0', weapon: '1HS' }, lines: ['The Sunscour gives nothing for free. Water, shade, life: all are bargained for.'] },
    ],
    eyrie: [
      { role: 'skywarden', dx: -3, dy: 2, name: 'Skywarden Aeris', title: 'Skywarden', services: [], race: 'highelf', g: 'f', look: { armor: garb('#d8d4c8', '#4a6aaa', 'plate'), helm: 'plate', helmPlume: '#4a6aaa', weapon: 'spear', cape: '#4a6aaa' }, lines: ['Few reach the summit. Fewer leave it. The storm giants see to that.'] },
      { role: 'stormseer', dx: 3, dy: 2, name: 'Stormseer Valdris', title: 'Stormseer', services: ['vendor:eyrie'], race: 'erudite', g: 'm', look: { armor: garb('#3a3a6a', '#c8d8ff', 'cloth'), robe: true, hat: 'wizard', hatCol: '#3a3a6a', weapon: '2HB', staff: true, orb: '#9ad8ff' }, lines: ['Lightning writes on the clouds up here. I am learning to read it.'] },
      { role: 'balloon', dx: 5, dy: 5, name: 'Pip Windwhistle', title: 'Balloon Pilot', services: ['balloon'], race: 'gnome', g: 'm', look: { armor: garb('#8a5a2a', '#e8c040', 'leather'), hat: 'hood', hatCol: '#5a3a1a' }, lines: ['She is patched in only eleven places! Perfectly safe. Mostly.'] },
      { role: 'eyrieheal', dx: -5, dy: -1, name: 'Mother Solenne', title: 'Mountain Healer', services: ['vendor:healer', 'bind'], race: 'human', g: 'f', look: { armor: garb('#f1efe6', '#4f7cc4', 'cloth'), robe: true, hat: 'mitre', hatCol: '#f1efe6', hatTrim: '#4f7cc4' }, lines: ['Rest by the fire. The wind up here steals warmth faster than any wound steals blood.'] },
    ],
    lair: [
      { role: 'emberwing', dx: 0, dy: 0, name: 'Emberwing', title: 'Bound Wyrm', services: ['flight'], creature: { kind: 'dragon', col: '#d0702a', scale: 1.15 }, lines: ['Ignaroth held my chains. Free me from his shadow and I will carry you to the roof of the world.'] },
    ],
  };
  Sys.spawnHubs = function () {
    G.ents.filter((e) => e.hub).forEach((e) => G.remove(e));
    for (const hub in HUB_NPCS) {
      if ((D.HUBS[hub].realm || 'main') !== W.realm) continue;
      const [hx, hy] = D.HUBS[hub].at;
      for (const n of HUB_NPCS[hub]) {
        const e = G.makeEnt({ type: 'npc', role: n.role, hub, city: null, faction: null, name: n.name, title: n.title, x: px(hx + n.dx), y: px(hy + n.dy), homeX: px(hx + n.dx), homeY: px(hy + n.dy), level: 40, gender: n.g || 'm', race: n.race || 'human', skin: KR.S.SKINS[n.race === 'darkelf' ? 1 : 1], hair: KR.S.HAIRS[2], hairStyle: 1, speed: 60, services: n.services, hostile: false, seed: Math.random() });
        e.hpMax = e.hp = 500; e.static = true; e.lines = n.lines; e.qkey = n.role; if (n.work) e.work = n.work;
        if (n.creature) { e.kind = n.creature.kind; e.col = n.creature.col; e.scale = n.creature.scale; e.look = null; e.r = 26; e.h = 80; }
        else e.look = Object.assign({ race: e.race, gender: e.gender, skin: e.skin, hair: e.hair, hairStyle: e.hairStyle }, n.look);
      }
    }
  };
  // hub NPCs talk with their own lines
  const npcLine0 = Sys.npcLine;
  Sys.npcLine = function (e, solo) { if (e.lines && e.lines.length && (Math.random() < 0.75 || !e.city)) return U.pick(e.lines); return npcLine0(e, solo); };
  // neutral NPCs are never hostile
  const hostile0 = G.isHostile;
  G.isHostile = function (a, b) { if ((a && a.hub) || (b && b.hub)) return false; return hostile0(a, b); };

  // ---------------- vendors in the hubs ----------------
  const stock0 = Sys.vendorStock;
  Sys.vendorStock = function (kind, npc) {
    const c = G.player.c;
    if (kind === 'island') { const out = []; for (let t = 2; t <= 3; t++) { out.push(G.makePotion('food', t), G.makePotion('drink', t)); } for (const m of ['metal', 'hide', 'cloth', 'arcane']) out.push(G.makeMat(m, 3)); out.push(G.makeShield(3, { q: 0.95 })); for (const wt of D.CLASSES[c.cls].weapons.slice(0, 2)) out.push(G.makeWeapon(wt, 3, { q: 0.95 })); out.forEach((it) => (it.uid = U.uid())); return out; }
    if (kind === 'nomad') { const out = [G.makePotion('food', 2), G.makePotion('drink', 2), G.makePotion('drink', 3)]; for (const m of ['hide', 'cloth']) out.push(G.makeMat(m, 2)); out.forEach((it) => (it.uid = U.uid())); return out; }
    if (kind === 'eyrie') { const out = [G.makePotion('food', 4), G.makePotion('drink', 4)]; for (const m of ['metal', 'hide', 'cloth', 'arcane']) out.push(G.makeMat(m, 5)); out.forEach((it) => (it.uid = U.uid())); return out; }
    return stock0(kind, npc);
  };

  // ---------------- travel ----------------
  Sys.travel = function (tx, ty, text, sfx) {
    const p = G.player; if (!p || p.dead) return;
    if (G.inCombat(p)) { G.log('You cannot travel while in combat!', 'sys', '#ffb24a'); KR.A.sfx('fail', 0.5); return; }
    UI.close('npc');
    UI.fadeTravel(text, () => {
      p.x = px(tx); p.y = px(ty); p.target = null; p.autoAttack = false; p.moving = false;
      if (p.pet && !p.pet.dead) { p.pet.x = p.x + 30; p.pet.y = p.y + 10; p.pet.target = null; }
      Sys.mercsHome(); KR.Main.snapCamera(); Sys.save();
    }, sfx);
  };
  UI.fadeTravel = function (text, mid, sfx) {
    let ov = $('.travel-ov'); if (!ov) { ov = h('div', 'travel-ov'); document.body.appendChild(ov); }
    ov.innerHTML = `<div class="tv-t">${esc(text)}</div>`; ov.classList.remove('out'); ov.classList.add('in');
    KR.A.sfx(sfx || 'whoosh', 0.8);
    setTimeout(() => { try { mid(); } catch (e) { console.error(e); } }, 1100);
    setTimeout(() => { ov.classList.remove('in'); ov.classList.add('out'); }, 2300);
  };
  const FERRY_COST = 500;
  Sys.ferry = function (to) {
    const c = G.player.c; if (G.inCombat(G.player)) { G.log('You cannot board while in combat!', 'sys', '#ffb24a'); return; }
    if (c.coins < FERRY_COST) { G.log(`The fare is ${G.fmtCoins(FERRY_COST)}.`, 'sys', '#ffb24a'); KR.A.sfx('fail', 0.5); return; }
    c.coins -= FERRY_COST; KR.A.sfx('coin', 0.5); UI.close('npc');
    if (to === 'tidesong') { const [x, y] = D.HUBS.tidesong.at; Sys.enterRealm('tidesong', x - 4, y, { text: 'The ferry sails across the Shimmering Sea...' }); }
    else { const [x, y] = D.HUBS.docks.at; Sys.enterRealm('main', x, y, { text: 'The ferry carries you back to the Sunscour Docks...' }); }
  };
  Sys.flySummit = function () {
    const c = G.player.c;
    if (!(c.bossKills && c.bossKills.ignaroth)) { G.log('Emberwing growls: "Ignaroth still lives. Break his power first, and I will carry you."', 'say', '#ffb070'); return; }
    if (G.inCombat(G.player)) { G.log('You cannot fly while in combat!', 'sys', '#ffb24a'); return; }
    UI.close('npc'); const [x, y] = D.HUBS.eyrie.at; KR.A.sfx('roar', 0.8); Sys.enterRealm('summit', x, y + 4, { text: 'Emberwing spreads her wings and carries you high above the clouds...' });
  };
  Sys.balloon = function (dest) {
    const p = G.player; UI.close('npc');
    if (dest === 'roost') { const [x, y] = D.HUBS.lair.at; Sys.enterRealm('main', x + 3, y + 3, { text: 'The balloon drifts down through the clouds to Dragonfall Crags...' }); }
    else { const [cx, cy] = D.CITY_CENTER[p.c.faction]; const R2 = D.cityRadius(Sys.cityLevel(p.c.faction)); Sys.enterRealm('main', cx, cy + R2 + 4, { text: `The balloon sails over the mountains toward ${D.FACTIONS[p.c.faction].city}...` }); }
  };
  // ---------------- realms (zone in, zone out) ----------------
  Sys.enterRealm = function (id, tx, ty, opt = {}) {
    const p = G.player; if (!p) return; const c = p.c;
    const go = () => {
      if (W.realm !== id) {
        W.realms[W.realm] = W.snapshot();
        if (W.realms[id]) W.restore(W.realms[id]); else { W.genRealm(id); W.realms[id] = W.snapshot(); }
        KR.R.clear(); KR.R.reindex();
      }
      const keep = new Set([p, p.pet, ...(p.mercs || []), ...(p.mercs || []).map((m) => m.pet)].filter(Boolean));
      G.ents = G.ents.filter((e) => keep.has(e)); G.proj = []; G.fx = []; G.corpses = [];
      for (const e of G.ents) { if (e.hate) e.hate.clear(); e.target = null; e.cast = null; }
      for (const sp of W.spawns) { sp.ent = null; sp.timer = Math.min(sp.timer || 0, 2); }
      if (id === 'main') for (const f of D.FACTION_IDS) { const lv = Sys.cityLevel(f); if (W.cityData[f] && W.cityData[f].level !== lv) W.stampCity(f, lv); Sys.spawnCity(f); }
      Sys.spawnHubs();
      if (tx == null) { const dd = W.dungeons[id]; const a = dd && dd.arrive; tx = a ? a[0] : W.W / 2; ty = a ? a[1] : W.H / 2; }
      p.x = tx * TS + 16; p.y = ty * TS + 16; p.target = null; p.autoAttack = false; p.moving = false; p.zoneRi = -1; p.portalCd = G.now + 2500;
      if (p.pet && !p.pet.dead) { p.pet.x = p.x + 28; p.pet.y = p.y + 8; }
      for (const m of p.mercs || []) { m.x = p.x - 30; m.y = p.y + 20; if (m.pet) { m.pet.x = m.x; m.pet.y = m.y + 10; } }
      c.realm = id; KR.Main.snapCamera(); KR.UI.refresh(); Sys.save();
    };
    if (opt.instant) { go(); return; }
    UI.loadScreen(id, opt.text, go);
  };
  UI.loadScreen = function (id, text, work) {
    const info = W.REALMS[id] || W.REALMS.main;
    let ov = $('.realm-load'); if (!ov) { ov = h('div', 'realm-load'); document.body.appendChild(ov); }
    const tip = U.pick(D.TALK.tips);
    ov.style.background = `radial-gradient(ellipse at 50% 40%, ${info.col[1]}, ${info.col[0]} 70%)`;
    ov.innerHTML = `<div class="rl-box"><div class="rl-sub">${esc(text || 'Travelling...')}</div><div class="rl-t">${esc(info.name)}</div><div class="rl-s">${esc(info.sub)}</div><div class="rl-bar"><i></i></div><div class="rl-tip">Tip: ${esc(tip)}</div></div>`;
    ov.classList.remove('out'); ov.classList.add('in'); KR.A.sfx('door', 0.5);
    const t0 = performance.now();
    setTimeout(() => { try { work(); } catch (e) { console.error(e); } const left = Math.max(0, 1500 - (performance.now() - t0)); setTimeout(() => { ov.classList.remove('in'); ov.classList.add('out'); }, left); }, 120);
  };
  Sys.nearGrate = function (p, r = 1.8) { if (!p || !W.portals || (W.realm && W.realm !== 'main')) return null; return W.portals.find((pt) => pt.cityGrate && !pt.back && Math.hypot(p.x / TS - (pt.x + 0.5), p.y / TS - (pt.y + 0.5)) <= r) || null; };
  Sys.useGrate = function (pt) { const p = G.player; if (!p || p.dead || !pt) return false; p._grate = { realm: pt.to, out: pt.out }; Sys.enterRealm(pt.to, null, null, { text: `You lift the grate and climb down into ${pt.label}...` }); p.portalCd = G.now + 4000; return true; };
  Sys.portalTick = function () {
    const p = G.player; if (!p || p.dead || !W.portals || (p.portalCd || 0) > G.now) return;
    for (const pt of W.portals) {
      if (Math.hypot(p.x / TS - (pt.x + 0.5), p.y / TS - (pt.y + 0.5)) > 1.1) continue;
      if (pt.cityGrate && !pt.back) continue; // a street grate is only entered on purpose (E or click), never by walking over it
      if (pt.back && p._grate && p._grate.realm === W.realm) { const g = p._grate; p._grate = null; Sys.enterRealm('main', g.out[0], g.out[1], { text: 'You climb up out of the sewer grate...' }); p.portalCd = G.now + 4000; return; }
      if (pt.back) { const dg = D.DUNGEONS.find((d) => d.id === W.realm); const ins = dg.entry === 'n' ? [0, 1] : dg.entry === 's' ? [0, -1] : dg.entry === 'w' ? [1, 0] : [-1, 0]; Sys.enterRealm(dg.parent || 'main', dg.at[0] - ins[0] * 3, dg.at[1] - ins[1] * 3, { text: `You climb out of ${W.REALMS[dg.id].name}...` }); }
      else { p._grate = pt.cityGrate ? { realm: pt.to, out: pt.out } : null; Sys.enterRealm(pt.to, null, null, { text: pt.cityGrate ? `You lift the grate and climb down into ${pt.label}...` : `You enter ${pt.label}...` }); }
      p.portalCd = G.now + 4000; return;
    }
  };
  // gate, death and bind remember which realm you were in
  const gate0 = Sys.gate, respawn0 = Sys.respawn;
  Sys.gate = function (e) { if (e !== G.player) return; const b = e.c.bind; if (b && (b.realm || 'main') !== W.realm) { G.log('You feel yourself pulled home.', 'spell', '#9ad8ff'); Sys.enterRealm(b.realm || 'main', Math.floor(b.x / TS), Math.floor(b.y / TS), { text: 'The world folds around you...' }); return; } gate0(e); };
  Sys.respawn = function () { const p = G.player, b = p.c.bind; respawn0(); if (b && (b.realm || 'main') !== W.realm) Sys.enterRealm(b.realm || 'main', Math.floor(b.x / TS), Math.floor(b.y / TS), { text: 'You awaken at your bind point...' }); };
  const bind0 = Sys.bind; Sys.bind = function () { bind0(); G.player.c.bind.realm = W.realm; };
  UI.extraService = function (e, s, add) {
    if (s === 'travel:docks') add(`Sail to Sunscour Docks (${G.fmtCoins(FERRY_COST)})`, () => Sys.ferry('docks'));
    if (s === 'travel:tidesong') add(`Sail to Port Tidesong (${G.fmtCoins(FERRY_COST)})`, () => Sys.ferry('tidesong'));
    if (s === 'flight') add(G.player.c.bossKills && G.player.c.bossKills.ignaroth ? 'Fly to Skyreach Summit' : 'Fly to Skyreach Summit (slay Ignaroth first)', () => Sys.flySummit());
    if (s === 'balloon') { add('Fly down to Dragonfall Crags', () => Sys.balloon('roost')); add(`Fly home to ${D.FACTIONS[G.player.c.faction].city}`, () => Sys.balloon('home')); }
    if (s === 'bags') { const b = Sys.bagInfo(); add(b.canBuy ? `Buy 8 bag slots (${G.fmtCoins(b.price)})` : b.full ? 'Bags fully expanded' : `More bag space at kingdom level ${b.nextLevel}`, () => Sys.buyBags()); }
  };

  // ---------------- bag space ----------------
  Sys.BAG_PRICES = [3000, 20000, 80000, 250000, 600000];
  Sys.bagInfo = function () {
    const c = G.player.c; const lvl = Sys.cityLevel(c.faction); const bought = c.bagsBought || 0;
    const max = 5; const allowed = lvl; // 8 slots per kingdom level
    return { bought, allowed, full: bought >= max, canBuy: bought < allowed && bought < max, price: Sys.BAG_PRICES[Math.min(bought, max - 1)], nextLevel: bought + 1, slots: c.inv.length };
  };
  Sys.buyBags = function () {
    const c = G.player.c; const b = Sys.bagInfo();
    if (b.full) { G.log('Your bags cannot hold any more.', 'sys', '#ffb24a'); return; }
    if (!b.canBuy) { G.log(`Your kingdom must reach level ${b.nextLevel} before larger bags are sold.`, 'sys', '#ffb24a'); return; }
    if (c.coins < b.price) { G.log(`You need ${G.fmtCoins(b.price)}.`, 'sys', '#ff8a6a'); KR.A.sfx('fail', 0.5); return; }
    c.coins -= b.price; c.bagsBought = b.bought + 1; c.invMax = 16 + c.bagsBought * 8; while (c.inv.length < c.invMax) c.inv.push(null);
    KR.A.sfx('coin'); KR.A.sfx('equip', 0.7); G.log(`You now have ${c.inv.length} bag slots.`, 'loot', '#bfe8a0'); UI.toast('Bags expanded', `${c.inv.length} slots`);
    UI.refresh(); if (UI.isOpen('npc')) UI.open('npc'); Sys.save();
  };

  // ---------------- zones & city bans ----------------
  const zoneName = (ri) => D.REGIONS[ri].name;
  Sys.zoneTick = function () {
    const p = G.player; if (!p || p.dead) return; const c = p.c;
    const ri = W.regionAtPx(p.x, p.y); const reg = D.REGIONS[ri];
    let hub = null; for (const k in D.HUBS) { if ((D.HUBS[k].realm || 'main') !== W.realm) continue; const [hx, hy] = D.HUBS[k].at; if (Math.hypot(p.x / TS - hx, p.y / TS - hy) < 12 && k !== 'lair') hub = k; }
    if (ri !== p.zoneRi || hub !== p.zoneHub) {
      const first = p.zoneRi === -1;
      const prevHub = p.zoneHub; p.zoneRi = ri; p.zoneHub = hub;
      // exploration experience: the first time you set foot in an area
      if (reg && !reg.city) { c.visited = c.visited || {}; const vk = (W.realm || 'main') + ':' + reg.id; if (!c.visited[vk]) { c.visited[vk] = 1; setTimeout(() => Sys.addStatus(c.faction, reg.dungeon ? 8 : 5, `exploring ${reg.name}`), 1500); if (c.level < D.MAX_LEVEL) { const xp = Math.max(10, Math.round(D.xpNeeded(c.level) * (reg.dungeon ? 0.12 : 0.08))); setTimeout(() => { G.giveXp(xp, `for discovering ${reg.name}`); KR.UI && KR.UI.toast(`Discovered ${reg.name}`, `+${xp} experience`); KR.A.sfx('quest', 0.5); }, 1200); } } }
      if (hub && hub !== prevHub) { UI.zoneBanner(D.HUBS[hub].name, 'A neutral town. All are welcome.'); G.log(`You have entered ${D.HUBS[hub].name}.`, 'sys', '#cfe8ff'); }
      else if (!hub) {
        let sub = '';
        if (reg.city) sub = reg.city === c.faction ? `${D.FACTIONS[reg.city].name} · your home` : `${D.FACTIONS[reg.city].name} · rival kingdom, guards attack on sight`;
        else if (reg.id === 'ocean') sub = 'Open sea';
        else if (reg.id === 'summit') sub = `Levels ${reg.lv[0]}–${reg.lv[1]} · far above the world`;
        else if (reg.dungeon) sub = `Dungeon · levels ${reg.lv[0]}–${reg.lv[1]}`;
        else sub = `Levels ${reg.lv[0]}–${reg.lv[1]}`;
        { const bn = document.querySelector('.banner'); if (!(first && bn && !bn.hidden)) UI.zoneBanner(zoneName(ri), sub); G.log(`You have entered ${zoneName(ri)}.`, 'sys', '#cfe8ff'); }
      }
      if (reg.dungeon) KR.A.sfx('door', 0.4);
    }
    // a slain king's city stays barred for 8 real hours
    if (c.bans) for (const f in c.bans) {
      const until = c.bans[f]; if (!until) continue; if (Date.now() > until) { delete c.bans[f]; G.log(`The gates of ${D.FACTIONS[f] ? D.FACTIONS[f].city : f} are open to you once more.`, 'status', '#bfe8a0'); continue; }
      const cd = W.cityData[f]; if (!cd) continue;
      const dx = Math.abs(p.x / TS - cd.cx), dy = Math.abs(p.y / TS - cd.cy);
      if (dx <= cd.R + 1 && dy <= cd.R + 1) {
        const left = until - Date.now(); const hh = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000);
        p.x = px(cd.cx); p.y = px(cd.cy + cd.R + 6); p.target = null; KR.Main.snapCamera(); Sys.mercsHome();
        UI.zoneBanner('The gates are barred', `${D.FACTIONS[f].city} mourns its king. You may return in ${hh}h ${mm}m.`);
        G.log(`Guards throw you out of ${D.FACTIONS[f].city}! You are banned for another ${hh}h ${mm}m.`, 'status', '#ff6a5a'); KR.A.sfx('fail', 0.6);
      }
    }
  };
  UI.zoneBanner = function (title, sub) {
    let z = $('.zone-bn'); if (!z) { z = h('div', 'zone-bn'); ($('#ui') || document.body).appendChild(z); }
    z.innerHTML = `<div class="zb-t">${esc(title)}</div>${sub ? `<div class="zb-s">${esc(sub)}</div>` : ''}`;
    z.classList.remove('show'); void z.offsetWidth; z.classList.add('show');
  };
  UI.kingFall = function (k, p) {
    let ov = $('.kingfall'); if (!ov) { ov = h('div', 'kingfall'); document.body.appendChild(ov); }
    const F = D.FACTIONS[k.faction];
    ov.innerHTML = `<div class="kf-crown">♛</div><div class="kf-t">The King is Dead</div><div class="kf-s">${esc(k.name)} has fallen to ${esc(p ? p.name : 'an unknown hand')}.</div><div class="kf-s2">${esc(F.city)} falls one Kingdom Level. Its gates are barred to you for 8 hours.</div>`;
    ov.classList.remove('show'); void ov.offsetWidth; ov.classList.add('show');
    setTimeout(() => ov.classList.remove('show'), 7000);
  };

  // ---------------- quests for hubs, dungeons and the new lands ----------------
  const build0 = Sys.buildQuests;
  Sys.buildQuests = function () {
    build0();
    const Q = Sys.QUESTS; const add = (q) => { Q[q.id] = q; };
    const T = (lv, it) => ({ coin: Math.round(lv * lv * 9), status: Math.round(lv / 2), item: it || null });
    const W2 = (lv) => ({ k: 'weapon', tier: G.tierOfLevel(lv), q: 1.3 });
    // Port Tidesong
    add({ id: 'ts_crabs', hub: 'tidesong', giver: 'harbormaster', lv: 21, type: 'collect', item: 'Crab Shell', mobs: ['shore_crab'], n: 6, title: 'Shells for the Seawall', text: 'We patch the seawall with crab shell mortar. Bring me 6 Crab Shells from the beaches.', reward: T(21) });
    add({ id: 'ts_tigers', hub: 'tidesong', giver: 'islander', lv: 26, type: 'kill', mobs: ['island_tiger'], n: 8, title: 'Striped Death', text: 'The island tigers have been stalking our fishermen. Kill 8 of them.', reward: T(26) });
    add({ id: 'ts_pirates', hub: 'tidesong', giver: 'harbormaster', lv: 27, type: 'kill', mobs: ['pirate', 'pirate_mage'], n: 10, title: 'Blackfin\'s Crew', text: 'Captain Blackfin\'s pirates camp on the north shore. Sink 10 of them for me.', reward: T(27) });
    add({ id: 'ts_blackfin', hub: 'tidesong', giver: 'harbormaster', lv: 31, type: 'boss', boss: 'blackfin', req: 'ts_pirates', title: 'Captain Blackfin', text: 'Now the captain himself. Blackfin hides at his camp in the island\'s heart. End him and the seas are ours again.', reward: T(32, W2(32)) });
    add({ id: 'ts_coral', hub: 'tidesong', giver: 'tidepriest', lv: 33, type: 'collect', item: 'Living Coral', mobs: ['coral_golem'], n: 5, title: 'Living Coral', text: 'The coral golems carry living coral in their hearts. Bring me 5 pieces for the temple rites.', reward: T(33) });
    add({ id: 'ts_temple', hub: 'tidesong', giver: 'tidepriest', lv: 34, type: 'kill', region: 'sunken', n: 12, title: 'The Sunken Temple', text: 'The Sunken Temple lies on the island\'s east shore. Its lizardman priests rise again. Slay 12 of its creatures.', reward: T(35) });
    add({ id: 'ts_sssarith', hub: 'tidesong', giver: 'tidepriest', lv: 37, type: 'boss', boss: 'sssarith', req: 'ts_temple', title: 'The Tide Tyrant', text: 'Sssarith the Tide Tyrant rules the temple\'s lower halls. Destroy it.', reward: T(38, W2(38)) });
    add({ id: 'ts_nalthrae', hub: 'tidesong', giver: 'tidepriest', lv: 40, type: 'boss', boss: 'nalthrae', req: 'ts_sssarith', title: 'The High Priestess', text: "Nal'thrae, the temple's High Priestess, waits at the very bottom. Put her to rest.", reward: T(41, W2(41)) });
    add({ id: 'ts_tidecrusher', hub: 'tidesong', giver: 'islander', lv: 35, type: 'boss', boss: 'tidecrusher', title: 'Tidecrusher', text: 'A crocodile as long as a ship hunts the south shore. They call it Tidecrusher. Bring it down.', reward: T(36) });
    // Sunscour Docks
    add({ id: 'dk_raiders', hub: 'docks', giver: 'nomad', lv: 23, type: 'kill', mobs: ['nomad_raider'], n: 10, title: 'Raiders of the Dunes', text: 'Raiders rob every caravan that crosses the Sunscour. Kill 10 of them.', reward: T(23) });
    add({ id: 'dk_scarab', hub: 'docks', giver: 'nomad', lv: 25, type: 'boss', boss: 'scarabking', title: 'The Great Scarab', text: 'A scarab as big as a house rolls the dunes near the coast. Its shell is worth a fortune.', reward: T(26) });
    add({ id: 'dk_wraps', hub: 'docks', giver: 'nomad', lv: 26, type: 'collect', item: 'Ancient Wrappings', mobs: ['mummy'], n: 6, title: 'Ancient Wrappings', text: 'The mummies of the old tombs wear wrappings soaked in preserving oils. Bring me 6.', reward: T(27) });
    add({ id: 'dk_sultan', hub: 'docks', giver: 'nomad', lv: 28, type: 'boss', boss: 'sultan', req: 'dk_raiders', title: 'The Sand Sultan', text: 'Ashkar the Sand Sultan leads the raiders from a ruined palace in the deep desert. Topple him.', reward: T(29, W2(29)) });
    // Eyrie Camp (Skyreach Summit)
    add({ id: 'ey_giants', hub: 'eyrie', giver: 'skywarden', lv: 53, type: 'kill', mobs: ['storm_giant'], n: 10, title: 'Giants of the Storm', text: 'The storm giants hurl lightning at our camp. Kill 10 of them.', reward: T(54) });
    add({ id: 'ey_crystals', hub: 'eyrie', giver: 'stormseer', lv: 54, type: 'collect', item: 'Storm Crystal', mobs: ['cloud_elemental', 'storm_giant'], n: 6, title: 'Storm Crystals', text: 'Bring me 6 Storm Crystals. I will use them to read the storm.', reward: T(55) });
    add({ id: 'ey_drakes', hub: 'eyrie', giver: 'skywarden', lv: 56, type: 'kill', mobs: ['thunder_drake'], n: 8, title: 'Thunder Drakes', text: 'Thunder drakes nest on the eastern spires. Kill 8.', reward: T(56) });
    add({ id: 'ey_seraxa', hub: 'eyrie', giver: 'stormseer', lv: 56, type: 'boss', boss: 'seraxa', title: 'The Griffon Queen', text: 'Queen Seraxa rules the griffons of the western cliffs. While she lives, no traveler is safe.', reward: T(57, W2(57)) });
    add({ id: 'ey_aerathos', hub: 'eyrie', giver: 'skywarden', lv: 58, type: 'boss', boss: 'aerathos', req: 'ey_seraxa', title: 'The Storm Titan', text: 'Aerathos the Storm Titan commands every giant on this mountain. Climb to his throne and end his reign.', reward: T(60, W2(60)) });
    add({ id: 'ey_vorgath', hub: 'eyrie', giver: 'stormseer', lv: 56, type: 'boss', boss: 'vorgath', title: 'The Unmaker', text: 'From up here I can see a darkness in the Blackscar Wastes. The Abyssal Depths. Vorgath the Unmaker guards its halls.', reward: T(58, W2(58)) });
    add({ id: 'ey_hollow', hub: 'eyrie', giver: 'stormseer', lv: 59, type: 'boss', boss: 'hollowking', req: 'ey_vorgath', title: 'The Hollow King', text: 'Below Vorgath sits the Hollow King, the oldest evil in the world. Only the greatest heroes may face him.', reward: T(62, W2(60)) });
    // kingdom quests for the new dungeons and lands (both kingdoms)
    for (const f of D.FACTION_IDS) {
      add({ id: f + '_snikkit', f, giver: 'bounty', lv: 11, type: 'boss', boss: 'snikkit', title: 'Goldtooth\'s Hoard', text: 'Snikkit Goldtooth hoards stolen gold deep in Gnollrock Warren, in the Copperdeep Crags. Take it back.', reward: T(13) });
      add({ id: f + '_grubnak', f, giver: 'captain', lv: 14, type: 'boss', boss: 'grubnak', req: f + '_snikkit', title: 'The Tunnel King', text: 'Grubnak the Tunnel King rules Gnollrock Warren. Kill him and the goblin raids end.', reward: T(16, W2(16)) });
      add({ id: f + '_desert', f, giver: 'bounty', lv: 22, type: 'kill', region: 'desert', n: 12, title: 'The Sunscour', text: 'Caravans from the southern coast vanish in the Sunscour Desert. Clear 12 of its creatures.', reward: T(22) });
      add({ id: f + '_vharr', f, giver: 'healer', lv: 31, type: 'boss', boss: 'vharr', title: 'The Bonelord', text: 'Beneath the Ashen Barrows lies the Crypt of the Forsaken. Bonelord Vharr raises the dead there. Destroy him.', reward: T(33, W2(33)) });
      add({ id: f + '_cereth', f, giver: 'healer', lv: 35, type: 'boss', boss: 'cereth', req: f + '_vharr', title: 'The Hollow Lady', text: 'Lady Cereth the Hollow rules the deepest crypt. Free the souls she keeps.', reward: T(37, W2(37)) });
      add({ id: f + '_korthak', f, giver: 'captain', lv: 42, type: 'boss', boss: 'korthak', title: 'Stoneheart', text: 'Korthak Stoneheart has made the Frostfang Caverns in Ironspine his own. Shatter him.', reward: T(43, W2(43)) });
      add({ id: f + '_rimeclaw', f, giver: 'bounty', lv: 45, type: 'boss', boss: 'rimeclaw', req: f + '_korthak', title: 'The Ice Wyrm', text: 'Rimeclaw the Ice Wyrm sleeps at the bottom of the Frostfang Caverns. Wake it, then kill it.', reward: T(47, W2(47)) });
      add({ id: f + '_ignaroth', f, giver: 'bounty', lv: 50, type: 'boss', boss: 'ignaroth', title: 'The Ember Wyrm', text: 'Ignaroth the Ember Wyrm rules Dragonfall Crags. They say a captive dragon there will carry anyone who breaks his power to the roof of the world.', reward: T(52, W2(52)) });
      add({ id: f + '_scar', f, giver: 'captain', lv: 51, type: 'kill', region: 'blackscar', n: 15, title: 'The Blackscar', text: 'Something has torn the land open in the east. Kill 15 creatures in the Blackscar Wastes.', reward: T(52) });
      add({ id: f + '_ravager', f, giver: 'bounty', lv: 54, type: 'boss', boss: 'ravagerprime', req: f + '_scar', title: 'Ravager Prime', text: 'The ravagers of the Blackscar follow a single monstrous leader. Kill Ravager Prime.', reward: T(55, W2(55)) });
    }
  };
  // quests from hub NPCs
  const qfor0 = Sys.questsFor;
  Sys.questsFor = function (npc) {
    if (!npc.hub) return qfor0(npc);
    const c = G.player.c; const out = { avail: [], active: [], ready: [] };
    for (const id in Sys.QUESTS) {
      const q = Sys.QUESTS[id]; if (q.hub !== npc.hub) continue;
      const turn = q.turnin || q.giver;
      if (c.quests.active[id]) { if (turn === npc.role && Sys.questComplete(q)) out.ready.push(q); else if (q.giver === npc.role) out.active.push(q); continue; }
      if (q.giver !== npc.role || c.quests.done[id]) continue;
      if (q.req && !c.quests.done[q.req]) continue;
      if (c.level >= q.lv - 2) out.avail.push(q);
    }
    return out;
  };
  // map markers for quests in places without voronoi seeds
  const qt0 = Sys.questTarget;
  const routeTo = (realm) => { // where to go in this realm to reach another realm
    if (realm === W.realm) return null;
    if (W.realm !== 'main') { const pt = W.portals.find((x) => x.back); if (pt) return [{ x: pt.x, y: pt.y, r: 2, npc: true }]; if (W.realm === 'tidesong') { const n = G.ents.find((e) => e.hub === 'tidesong' && e.role === 'ferry'); return n ? [{ x: n.x / TS, y: n.y / TS, r: 2, npc: true }] : []; } return []; }
    const dg = D.DUNGEONS.find((d) => d.id === realm);
    if (dg && dg.parent === 'main') return [{ x: dg.at[0], y: dg.at[1], r: 3, boss: true }];
    if (realm === 'tidesong' || (dg && dg.parent === 'tidesong')) return [{ x: D.HUBS.docks.at[0], y: D.HUBS.docks.at[1], r: 3, npc: true }];
    if (realm === 'summit') return [{ x: D.HUBS.lair.at[0], y: D.HUBS.lair.at[1], r: 3, npc: true }];
    return [];
  };
  Sys.questTarget = function (q) {
    const c = G.player.c;
    if (q.type === 'boss') { const b = D.BOSS_BY_ID[q.boss]; const rt = routeTo(b.realm || 'main'); if (rt) return rt; }
    if (q.region) { const rr = D.REGIONS[D.REGION_BY_ID[q.region]]; const realmOf = rr.dungeon ? rr.id : rr.id === 'island' ? 'tidesong' : rr.id === 'summit' ? 'summit' : 'main'; const rt = routeTo(realmOf); if (rt) return rt; }
    if (q.hub && (D.HUBS[q.hub].realm || 'main') !== W.realm) { const rt = routeTo(D.HUBS[q.hub].realm); if (rt) return rt; }
    if (q.hub && (Sys.questComplete(q) || q.type === 'deliver')) { const n = G.ents.find((e) => e.hub === q.hub && e.role === (q.turnin || q.giver)); return n ? [{ x: n.x / TS, y: n.y / TS, r: 2, npc: true }] : []; }
    if (q.region) { const r = D.REGIONS[D.REGION_BY_ID[q.region]]; if (!r.seeds.length) { const dd = W.dungeons && W.dungeons[r.id]; if (dd) return dd.rooms.slice(1, 4).map((o) => ({ x: o.x, y: o.y, r: 6 })); if (r.id === 'island') return [{ x: D.ISLAND.cx, y: D.ISLAND.cy, r: 40 }]; if (r.id === 'summit') return [{ x: D.SUMMIT.cx, y: D.SUMMIT.cy, r: 30 }]; } }
    return qt0(q);
  };
  // remember which bosses each hero has slain (the dragon unlocks flight)
  const kill0 = Sys.onKill;
  Sys.onKill = function (e) {
    kill0(e);
    if (e.boss) {
      const c = G.player.c; c.bossKills = c.bossKills || {}; c.bossKills[e.boss] = (c.bossKills[e.boss] || 0) + 1;
      if (e.boss === 'ignaroth') { UI.banner('Ignaroth is defeated!', 'Emberwing, the captive dragon nearby, is free. She will fly you to Skyreach Summit.'); G.log('Emberwing roars in triumph! Speak with her near the lair to fly to Skyreach Summit.', 'quest', '#ffb070'); }
    }
  };
})();
