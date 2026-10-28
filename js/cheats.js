// Kingdom Rising — cheats for testing (F8, or the Cheats button in Settings): set the level, add gold, wood and
// stone, raise any building at once, an end-game kit, god mode and one-shot kills, teleports, raids and the enemy
// king. Single player only; in an online game only the host may use them (a joining player sees a note).
(function () {
  const KR = window.KR;
  const D = KR.D, U = KR.U, G = KR.G, W = KR.W, Sys = KR.Sys, UI = KR.UI;
  const TS = D.TS;
  const Ch = (KR.Cheats = {});
  const myF = () => G.player && G.player.c && G.player.c.faction;
  const enemyF = () => { const f = myF(); return D.FACTION_IDS.find((x) => x !== f && D.FACTIONS[x] && D.FACTIONS[x].city) || D.FACTION_IDS.find((x) => x !== f); };
  const R = () => KR.Realm;
  const say = (t) => { G.log('[Cheat] ' + t, 'sys', '#ff9ad8'); };
  const allowed = () => { const O = KR.Online; return !(O && O.mode === 'join'); };

  // ---------------- god mode and one-shot kills ----------------
  const dmg0 = G.damage;
  G.damage = function (src, tgt, amt, opt = {}) {
    const p = G.player, C = G.cheat;
    if (C && p && tgt === p && C.god) { G.float(tgt, 'GOD', '#ff9ad8'); return 0; }
    if (C && p && C.oneshot && tgt && tgt !== p && !tgt.dead && (src === p || (src && src.owner === p)) && (G.isHostile ? G.isHostile(p, tgt) : true)) amt = Math.max(amt, (tgt.hp || 0) * 50 + 1e6);
    return dmg0.call(this, src, tgt, amt, opt);
  };

  // ---------------- the hero ----------------
  Ch.setLevel = function (n) {
    const p = G.player; if (!p) return; const c = p.c;
    n = U.clamp(Math.round(n), 1, D.MAX_SHOWN); const lv = Math.min(D.MAX_LEVEL, D.LV(n));
    c.level = lv; c.xp = 0;
    // a hero who got here by playing has trained their weapons and spell schools to the level's cap: so does this one
    { const wc = D.weaponSkillCap(lv); for (const wt in D.WEAPON_TYPES) c.wskill[wt] = Math.max(c.wskill[wt] || 0, wc); c.wskill.SHIELD = Math.max(c.wskill.SHIELD || 0, wc); for (const sc of D.SCHOOLS || []) c.school[sc] = Math.max(c.school[sc] || 0, D.schoolSkillCap(lv)); }
    // spells: every one of the class's spells up to this level is known (as if bought); none above it
    if (D.CLASS_SPELLS[c.cls]) { const all = D.CLASS_SPELLS[c.cls]; c.spells = all.filter((id) => D.SPELLS[id] && D.SPELLS[id].level <= lv); }
    G.recalc(p); p.hp = p.hpMax; p.mana = p.manaMax; p.endur = p.endurMax;
    // abilities are learned by level on their own (G.hasSkill); put the new ones on the hotbar
    const C = D.CLASSES[c.cls];
    if (Sys.autoBar) { for (const [sk, l] of C.skills) if (l <= lv && D.SKILLS[sk] && !D.SKILLS[sk].passive) try { Sys.autoBar({ k: 'skill', id: sk }); } catch (e) {} for (const id of c.spells || []) try { Sys.autoBar({ k: 'spell', id }); } catch (e) {} }
    try { Sys.syncMercLevels && Sys.syncMercLevels(); } catch (e) {}
    try { Sys.autoBarSync && Sys.autoBarSync(); } catch (e) {}
    say(`Level set to ${n}.`); KR.UI.refresh(); Sys.save && Sys.save();
  };
  Ch.addGold = function (g) { const c = G.player && G.player.c; if (!c) return; c.coins += Math.round(g * 10000); say(`+${g} gold.`); KR.A && KR.A.sfx('coin', 0.6); KR.UI.refresh(); };
  Ch.heal = function () { const p = G.player; if (!p) return; p.hp = p.hpMax; p.mana = p.manaMax; p.endur = p.endurMax; if (p.pet && !p.pet.dead) p.pet.hp = p.pet.hpMax || p.pet.hp; say('Fully restored.'); };
  // the best tier of everything the hero's class can wear, at level 20
  Ch.endGameKit = function () {
    const p = G.player; if (!p) return; const c = p.c; const C = D.CLASSES[c.cls]; const T = 5, opt = { ilvl: D.MAX_LEVEL, q: 1.4, bias: D.CLASS_STATS && D.CLASS_STATS[c.cls] };
    if (D.shown(c.level) < D.MAX_SHOWN) Ch.setLevel(D.MAX_SHOWN);
    const put = (it) => { if (!it) return; if (G.canUse && !G.canUse(c, it)) return; it.req = 1; const old = c.equip[it.slot]; c.equip[it.slot] = it; if (old && Sys.addItem) Sys.addItem(old); };
    const ak = C.armor || 'cloth';
    for (const sl of D.ARMOR_SLOTS) try { put(G.makeArmor(ak, sl, T, opt)); } catch (e) { console.warn(e); }
    try { if (G.makeWorn) { put(G.makeWorn('back', T, opt)); put(G.makeWorn('waist', T, opt)); } } catch (e) {}
    const wt = (C.weapons || [])[0]; if (wt) try { put(G.makeWeapon(wt, T, opt)); } catch (e) { console.warn(e); }
    if (C.shield && G.makeShield && !(c.equip.primary && c.equip.primary.twoHand)) try { put(G.makeShield(T, opt)); } catch (e) {}
    const rt = (C.ranged || [])[0]; if (rt && D.WEAPON_TYPES[rt]) try { put(G.makeWeapon(rt, T, opt)); } catch (e) {}
    G.recalc(p); p.hp = p.hpMax; p.mana = p.manaMax; p.endur = p.endurMax;
    say('End-game gear equipped.'); KR.UI.refresh(); Sys.save && Sys.save();
  };

  // ---------------- the kingdom ----------------
  Ch.addRes = function (n) { const f = myF(); if (!R() || !f) return; R().add(f, { wood: n, stone: n }, 'cheat'); say(`+${n} wood and stone.`); };
  Ch.finishAll = function () {
    if (!R()) return; let n = 0;
    for (const f of D.FACTION_IDS) { const st = R().state(f); if (!st || !st.construction) continue; for (const c of st.construction) { c.end = 0; n++; } }
    try { R().tick(0); } catch (e) { console.warn(e); }
    if (n) say(`${n} building job${n > 1 ? 's' : ''} finished.`);
  };
  // raise one building to a level, prerequisites first, all at once and for free
  Ch.ensure = function (f, id, lvl, depth) {
    const Rl = R(); if (!Rl || !Rl.DEFS[id] || (depth || 0) > 8) return;
    const d = Rl.DEFS[id]; lvl = Math.min(lvl, d.max || 1);
    for (let l = (Rl.level(f, id) || 0) + 1; l <= lvl; l++) {
      for (const [nid, nl] of (d.needs ? d.needs(l - 1) || [] : [])) if ((Rl.level(f, nid) || 0) < nl) Ch.ensure(f, nid, nl, (depth || 0) + 1);
      const st = Rl.state(f); if (st.construction.some((c) => c.id === id)) { for (const c of st.construction) if (c.id === id) c.end = 0; Rl.tick(0); }
      if ((Rl.level(f, id) || 0) >= l) continue;
      if (!Rl.build(f, id, { free: true, instant: true, quiet: true })) break;
    }
  };
  Ch.build = function (id, lvl) { const f = myF(); Ch.ensure(f, id, lvl); const Rl = R(); say(`${Rl.levelName ? Rl.levelName(id, Rl.level(f, id)) : id} is standing.`); KR.UI.refresh(); };
  Ch.buildAll = function (f) {
    f = f || myF(); const Rl = R(); if (!Rl) return;
    for (const id of Object.keys(Rl.DEFS)) Ch.ensure(f, id, Rl.DEFS[id].max || 1);
    if (f === myF()) say('Every building raised to its highest level.'); KR.UI.refresh();
  };
  Ch.hireWorkers = function () {
    const f = myF(); const Rl = R(); if (!Rl) return;
    try { Rl.hireLiaison(f); } catch (e) {}
    for (const k of Object.keys(Rl.WORKER || {})) for (let i = 0; i < 6; i++) { let ok = false; try { ok = Rl.hireWorker(f, k); } catch (e) {} if (!ok) break; }
    say('The court liaison and every worker are hired.');
  };

  // ---------------- travel ----------------
  const goMain = (tx, ty) => {
    const p = G.player; if (!p) return;
    if (W.realm && W.realm !== 'main') { Sys.enterRealm('main', tx, ty, { text: 'Cheat: teleport' }); return; }
    p.x = tx * TS + 16; p.y = ty * TS + 16; p.moving = false; p.target = null; p.upB = null; p.onWall = false; p.portalCd = G.now + 2500;
    if (p.pet && !p.pet.dead) { p.pet.x = p.x + 28; p.pet.y = p.y + 8; }
    for (const m of p.mercs || []) { m.x = p.x - 24; m.y = p.y + 12; }
  };
  const mainView = (k) => (W.realm === 'main' || !W.realm ? W[k] : W.realms.main && W.realms.main[k]) || [];
  Ch.toHall = function (f) {
    const hall = mainView('buildings').find((b) => b.type === 'hall' && (b.faction === f || b.city === f));
    if (hall && hall.door) { goMain(hall.door.tx, hall.door.ty + 2); say(`Teleported to ${D.FACTIONS[f].city} Town Hall.`); return; }
    const cd = W.cityData[f]; if (cd) { goMain(cd.cx, cd.cy + 3); say(`Teleported to ${D.FACTIONS[f].city}.`); }
  };
  Ch.toPipe = function () {
    const f = myF(); const dg = D.DUNGEONS.find((d) => d.type === 'sewer' && d.home === f);
    const pt = mainView('portals').find((q) => q.sewer && (!dg || q.to === dg.id)) || mainView('portals').find((q) => q.sewer);
    if (!pt) { say('No sewer pipe found.'); return; }
    const o = pt.out || [pt.x, pt.y + 2]; goMain(o[0], o[1]); say('Teleported to the sewer pipe.');
  };
  Ch.enterDungeon = function (id) { const dg = D.DUNGEONS.find((d) => d.id === id); if (!dg) return; Sys.enterRealm(id, null, null, { text: `Cheat: into ${dg.name || id}` }); };
  Ch.revealMap = function () {
    const ex = W.realm === 'main' || !W.realm ? W.explored : W.realms.main && W.realms.main.explored; if (!ex) return;
    ex.fill(1); say('The whole map is revealed.'); KR.UI.refresh(); Sys.save && Sys.save();
  };

  // ---------------- war ----------------
  Ch.enemyRaid = function () {
    const War = KR.War; const ef = enemyF(); if (!War || !ef) return;
    if (W.realm && W.realm !== 'main') { say('Raids only happen in the kingdom lands.'); return; }
    Ch.ensure(ef, 'barracks', 1);
    const cs = War.cpu && War.cpu(); if (cs && cs.f === ef) cs.gold = (cs.gold || 0) + 1e6;
    const types = (War.recruitTypes ? War.recruitTypes(ef) : []).filter((t) => !t.locked && !t.guard && !t.siege && !/guard/i.test(t.id));
    let hired = 0; for (let i = 0; i < 8 && types.length; i++) hired += War.hire(ef, types[i % types.length].id, 1) || 0;
    const n = War.launchRaid ? War.launchRaid(ef) : 0;
    say(n ? `${D.FACTIONS[ef].city} sends a raid at you (${n} soldiers).` : `Hired ${hired} enemy soldiers, but no raid could set out.`);
  };
  Ch.orderAttack = function () {
    const War = KR.War; if (!War || !War.orderAttack) return; const f = myF();
    Ch.ensure(f, 'barracks', 1);
    if (War.army && (War.soldiersOf ? War.soldiersOf(f).length === 0 : true)) { const c = G.player.c; c.coins += 1e6; const types = (War.recruitTypes(f) || []).filter((t) => !t.locked && !t.guard && !t.siege && !/guard/i.test(t.id)); for (let i = 0; i < 6 && types.length; i++) War.hire(f, types[i % types.length].id, 1); }
    const n = War.orderAttack(f); say(n ? `Your war party marches (${n} soldiers).` : 'No war party could march.');
  };
  Ch.killEnemyKing = function () {
    const ef = enemyF(); const k = G.ents.find((e) => e.type === 'king' && e.faction === ef && !e.dead);
    if (!k) { say(`King of ${D.FACTIONS[ef].city} isn't nearby: teleport to his Town Hall first (he lives on the top floor).`); return; }
    k.invuln = false; G.damage(G.player, k, (k.hp || 1) * 100 + 1e6, {});
    if (!k.dead) { k.hp = 0; G.kill(k, G.player); }
    say(`${k.name} falls.`);
  };

  // ---------------- the window ----------------
  const css = `#w-cheats .ch-sec{margin:6px 0 10px} #w-cheats .ch-sec h4{margin:4px 0;color:#ff9ad8;font-size:13px;letter-spacing:1px;text-transform:uppercase}
    #w-cheats .ch-row{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:3px 0} #w-cheats .ch-row .lb{min-width:110px;color:#d8c8a8;font-size:12px}
    #w-cheats button.on{background:#7a2a5a;color:#fff} #w-cheats .ch-note{color:#c89a7a;font-size:12px} #w-cheats input[type=range]{flex:1;min-width:120px}`;
  const btn = (txt, fn, title) => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = txt; if (title) b.title = title; b.onclick = (e) => { e.stopPropagation(); if (!allowed()) { say('Only the host can use cheats in an online game.'); return; } try { fn(); } catch (er) { console.error(er); say('That cheat failed: ' + er.message); } render(UI.wins.cheats, true); }; return b; };
  const row = (parent, label) => { const r = document.createElement('div'); r.className = 'ch-row'; if (label) { const l = document.createElement('span'); l.className = 'lb'; l.textContent = label; r.appendChild(l); } parent.appendChild(r); return r; };
  const sec = (parent, title) => { const s = document.createElement('div'); s.className = 'ch-sec'; s.innerHTML = `<h4>${title}</h4>`; parent.appendChild(s); return s; };
  function render(w, force) {
    if (!w) return; const b = w.body; if (!G.player) { b.innerHTML = '<p class="ch-note">Enter the world first.</p>'; return; }
    if (b._built && !force) return; b._built = true; b.innerHTML = '';
    if (!document.getElementById('ch-css')) { const st = document.createElement('style'); st.id = 'ch-css'; st.textContent = css; document.head.appendChild(st); }
    const c = G.player.c, f = myF(), ef = enemyF(), Rl = R();
    if (!allowed()) { const n = document.createElement('p'); n.className = 'ch-note'; n.textContent = 'You joined an online game: only the host can use cheats.'; b.appendChild(n); }
    // hero
    let s = sec(b, 'Hero');
    { const r = row(s, `Level ${D.shown(c.level)}`); const sl = document.createElement('input'); sl.type = 'range'; sl.min = 1; sl.max = D.MAX_SHOWN; sl.value = D.shown(c.level);
      const val = document.createElement('b'); val.textContent = sl.value; sl.oninput = () => { val.textContent = sl.value; }; r.appendChild(sl); r.appendChild(val); r.appendChild(btn('Set', () => Ch.setLevel(+sl.value)));
      const r2 = row(s); for (const n of [1, 5, 10, 15, 20]) r2.appendChild(btn('Lv ' + n, () => Ch.setLevel(n))); }
    { const r = row(s, `Gold ${G.fmtCoins(c.coins)}`); for (const g of [1, 10, 100, 1000]) r.appendChild(btn(`+${g}g`, () => Ch.addGold(g))); }
    { const r = row(s); r.appendChild(btn('End-game kit (level 20 + best gear)', Ch.endGameKit)); r.appendChild(btn('Full heal', Ch.heal)); }
    { const r = row(s, 'Toggles'); const tg = (k, n) => { const bt = btn(`${n}: ${G.cheat[k] ? 'ON' : 'off'}`, () => { G.cheat[k] = !G.cheat[k]; say(`${n} ${G.cheat[k] ? 'on' : 'off'}.`); }); if (G.cheat[k]) bt.classList.add('on'); r.appendChild(bt); }; tg('god', 'God mode'); tg('oneshot', 'One-shot kills'); }
    // kingdom
    s = sec(b, 'Kingdom');
    if (Rl && f) {
      const st = Rl.state(f);
      { const r = row(s, `🪵 ${Math.floor(st.wood)} 🪨 ${Math.floor(st.stone)}`); for (const n of [500, 5000]) r.appendChild(btn(`+${n} each`, () => Ch.addRes(n))); }
      { const r = row(s); r.appendChild(btn('Build everything', () => Ch.buildAll(f))); r.appendChild(btn('Finish construction now', Ch.finishAll)); r.appendChild(btn('Hire liaison + workers', Ch.hireWorkers)); }
      const ids = Object.keys(Rl.DEFS).filter((id) => id !== 'townhall');
      for (const id of ids) {
        const d = Rl.DEFS[id]; const have = Rl.level(f, id) || 0; const r = row(s, `${d.name}${(d.max || 1) > 1 ? ` (${have}/${d.max})` : have ? ' ✓' : ''}`);
        for (let l = 1; l <= (d.max || 1); l++) { const bt = btn((d.max || 1) > 1 ? `Lv ${l}` : 'Build', () => Ch.build(id, l), Rl.levelName ? Rl.levelName(id, l) : ''); if (have >= l) bt.classList.add('on'); r.appendChild(bt); }
      }
    } else row(s).appendChild(document.createTextNode('The kingdom module is not loaded.'));
    // travel
    s = sec(b, 'Teleport');
    { const r = row(s); r.appendChild(btn(`${D.FACTIONS[f].city} Town Hall`, () => Ch.toHall(f))); if (ef) r.appendChild(btn(`${D.FACTIONS[ef].city} Town Hall`, () => Ch.toHall(ef))); r.appendChild(btn('Sewer pipe', Ch.toPipe)); r.appendChild(btn('Reveal map', Ch.revealMap)); }
    { const r = row(s, 'Dungeons'); for (const dg of D.DUNGEONS.filter((d) => (d.parent || 'main') === 'main')) r.appendChild(btn(dg.name || dg.id, () => Ch.enterDungeon(dg.id))); }
    // war
    s = sec(b, 'War');
    { const r = row(s); r.appendChild(btn('Enemy raid now', Ch.enemyRaid)); r.appendChild(btn('Order our attack', Ch.orderAttack)); r.appendChild(btn('Kill the enemy king', Ch.killEnemyKing, 'Stand near him (top floor of his Town Hall) to test the victory')); r.appendChild(btn('Build everything (enemy)', () => { Ch.buildAll(ef); say(`${D.FACTIONS[ef].city} is fully built.`); })); }
  }
  Ch.toggle = function () {
    if (!UI.wins.cheats) UI.win('cheats', 'Cheats (F8)', { w: 470, h: 560, x: 20, y: 60, render: (w) => render(w) });
    const w = UI.wins.cheats; const open = UI.isOpen('cheats');
    if (open) UI.close('cheats'); else { if (w.body) w.body._built = false; UI.open('cheats'); render(w, true); }
  };
  addEventListener('keydown', (e) => {
    if (e.key !== 'F8' || e.repeat) return; const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    if (!G.player) return; e.preventDefault(); Ch.toggle();
  }, true);
  // a Cheats button in both settings windows (the 3D settings panel and the game menu)
  setInterval(() => {
    try {
      if (!G.player) return;
      const h3 = document.querySelector('.k3-settings .k3s-head');
      if (h3 && !h3.querySelector('.ch-open')) { const b = document.createElement('button'); b.className = 'mini ch-open'; b.textContent = 'Cheats'; b.title = 'Testing cheats (F8)'; b.style.marginLeft = 'auto'; b.style.marginRight = '6px'; b.onclick = (e) => { e.stopPropagation(); Ch.toggle(); }; h3.insertBefore(b, h3.querySelector('.k3s-x')); }
      const m = document.querySelector('#w-menu .win-b .col');
      if (m && !m.querySelector('.ch-open')) { const b = document.createElement('button'); b.className = 'btn ch-open'; b.textContent = 'Cheats (F8)'; b.onclick = (e) => { e.stopPropagation(); Ch.toggle(); }; m.appendChild(b); }
    } catch (e) {}
  }, 1000);
})();
