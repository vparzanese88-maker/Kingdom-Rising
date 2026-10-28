// Kingdom Rising — mercenary interface: trader, mercenary tab, party frames
(function () {
  const KR = window.KR;
  const D = KR.D, U = KR.U, G = KR.G, Sys = KR.Sys, UI = KR.UI, S = KR.S;
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = UI.esc;
  let sel = null;

  UI.buildMercHUD = function () {
    const box = h('div', 'hud-mercs'); box.hidden = true; $('#ui').appendChild(box);
  };
  UI.tickMercs = function () {
    const box = $('.hud-mercs'); if (!box) return; const p = G.player; const ms = p.mercs || [];
    if (!ms.length) { box.hidden = !document.body.classList.contains('layout-edit'); if (!box.hidden && !box.querySelector('.mf')) box.dataset.sig = ''; return; }
    box.hidden = UI.hudClosed && UI.hudClosed('mercs');
    const sig = ms.map((m) => m.id).join(',');
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.querySelectorAll('.mf').forEach((x) => x.remove());
      ms.forEach((m) => { const f = h('button', 'mf', `<span class="mf-n"></span><span class="bar hp"><i></i></span><span class="bar mana"><i></i></span>`); f.dataset.id = m.id; f.title = 'Click to target, double-click to open the Mercenaries tab'; f.onclick = () => { p.target = m; }; f.ondblclick = () => UI.openMerc(m); box.appendChild(f); });
    }
    box.querySelectorAll('.mf').forEach((f) => {
      const m = ms.find((x) => String(x.id) === f.dataset.id); if (!m) return;
      const n = m.dead ? `${m.name} (recovering)` : `${m.name}`; const ne = f.querySelector('.mf-n'); if (ne.textContent !== n) ne.textContent = n;
      f.classList.toggle('dead', !!m.dead); f.classList.toggle('tgt', p.target === m);
      const [hp, mn] = f.querySelectorAll('.bar'); hp.firstChild.style.width = Math.max(0, (m.hp / m.hpMax) * 100) + '%';
      mn.hidden = !m.manaMax; if (m.manaMax) mn.firstChild.style.width = (m.mana / m.manaMax) * 100 + '%';
    });
  };
  UI.openMerc = function (m) { sel = m.c.id; UI.open('mercs'); };

  UI.buildMercWindows = function () {
    UI.win('mercs', 'Mercenaries', { w: 640, h: 600, y: 50, render: renderMercs });
    UI.win('mtrader', 'Mercenary Trader', { w: 620, h: 560, y: 60, render: renderTrader });
    UI.win('petgear', 'Pet Gear', { w: 440, y: 70, render: renderPetGear });
    UI.win('cityup', 'Kingdom Level Up', { w: 440, y: 90, render: renderCityUp });
  };

  const PET_NAMES = { head: 'Helmet', chest: 'Chest', primary: 'Weapon', secondary: 'Shield / Off-hand' };
  function renderPetGear(w) {
    const p = G.player, c = p.c; const b = w.body; b.innerHTML = ''; c.petGear = c.petGear || {};
    const who = { cls: 'warrior', level: p.level };
    const pet = p.pet && !p.pet.dead ? p.pet : null;
    b.appendChild(h('p', 'hint', pet ? `<b>${esc(pet.name)}</b> · Level ${pet.level} · HP ${pet.hpMax} · Hits for ~${pet.dmg} · Armor ${pet.ac}` : 'No pet is summoned. Gear given here stays with your pets and is worn by every pet you summon.'));
    b.appendChild(h('h4', null, 'Equipped <small class="dim">click to take back</small>'));
    const doll = h('div', 'doll'); b.appendChild(doll);
    for (const sl of Sys.PET_SLOTS) { const box = h('div', 'eq'); box.appendChild(h('label', null, PET_NAMES[sl])); box.appendChild(UI.itemCell(c.petGear[sl], () => { Sys.petUnequip(sl); renderPetGear(w); }, 'equip', who)); doll.appendChild(box); }
    b.appendChild(h('h4', null, 'Give from your bag'));
    const give = h('div', 'grid'); b.appendChild(give);
    const usable = c.inv.filter((it) => it && Sys.petSlotFor(it));
    if (!usable.length) b.appendChild(h('p', 'empty-note', 'Nothing in your bag fits a pet. Pets wear helmets and chest armor and use melee weapons and shields.'));
    usable.forEach((it) => give.appendChild(UI.itemCell(it, (x) => { Sys.petEquip(x); renderPetGear(w); }, null, who)));
    // pet weapon skill & abilities (max 3)
    const gear = c.petGear; const wt = gear.primary ? gear.primary.wt : 'H2H'; const ps = c.petSkill || {};
    const sk = ps[wt] || 0;
    b.appendChild(h('h4', null, `Pet skill <small class="dim">your pet trains its weapon by fighting</small>`));
    b.appendChild(h('div', 'sk', `<span>${G.wtName(wt)}</span><span class="dim">${sk} / ${D.weaponSkillCap(pet ? pet.level : G.player.level)}</span>`));
    const all = Sys.petAbilities(G.player); const bar = (c.petBar && c.petBar.length ? c.petBar : all.slice(-Sys.PET_BAR).map((x) => x.key));
    b.appendChild(h('h4', null, `Pet abilities <small class="dim">${Math.min(bar.length, Sys.PET_BAR)} / ${Sys.PET_BAR} on its bar, click to swap</small>`));
    const ab = h('div', 'pet-abs'); b.appendChild(ab);
    const list = D.WEAPON_ABILITIES[wt].map((x, i) => ({ key: wt + ':' + i, x, un: sk >= D.WEAPON_UNLOCKS[i], req: `${G.wtName(wt)} ${D.WEAPON_UNLOCKS[i]}` }));
    if (gear.secondary && gear.secondary.shield) D.WEAPON_ABILITIES.SHIELD.forEach((x, i) => list.push({ key: 'SHIELD:' + i, x, un: (ps.SHIELD != null ? ps.SHIELD : sk) >= D.WEAPON_UNLOCKS[i], req: `skill ${D.WEAPON_UNLOCKS[i]}` }));
    list.filter((r) => !r.x.ranged).forEach((r) => {
      const on = r.un && bar.includes(r.key);
      const el = h('button', 'wab' + (r.un ? '' : ' locked') + (on ? ' on' : ''), `<span class="ic">${esc(r.x.icon)}</span><small>${esc(r.x.name)}</small><small class="dim">${r.un ? (on ? 'On bar' : 'Off') : 'Needs ' + r.req}</small>`);
      UI.bindTip(el, () => UI.actionTip({ k: 'weapon', id: r.key }).replace(/<div class="bad">.*?<\/div>/g, '').replace(/\d+ endurance · /, ''));
      if (r.un) el.onclick = () => { Sys.togglePetAbility(r.key); renderPetGear(w); };
      ab.appendChild(el);
    });
  }
  // ----- kingdom level up summary -----
  let cityUp = null;
  UI.showCityUp = function (f, lvl) { cityUp = { f, lvl }; UI.open('cityup'); };
  function renderCityUp(w) {
    if (!cityUp) return; const F = D.FACTIONS[cityUp.f];
    w.title.textContent = `${F.city} · Kingdom Level ${cityUp.lvl}`;
    w.body.innerHTML = `<p class="hint">Your people celebrate! Here is everything new in ${esc(F.city)}:</p><ul class="cityup">${Sys.cityUpgrades(cityUp.lvl).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${cityUp.lvl < 5 ? `<p class="dim small">Next level: ${esc(Sys.unlockText(cityUp.lvl + 1))}</p>` : ''}<div class="row"><button class="btn gold" id="cu-map">Show on map</button><button class="btn" id="cu-ok">Wonderful</button></div>`;
    $('#cu-ok', w.body).onclick = () => UI.close('cityup'); $('#cu-map', w.body).onclick = () => { UI.close('cityup'); UI.open('map'); };
  }
  function portrait(cv, data, scale = 1) { const look = G.lookFor(Object.assign({}, data, { equip: data.equip || {} })); const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); S.drawHumanoid(g, cv.width / 2, cv.height - 8, Object.assign({}, look, { scale: (cv.height / 70) * (D.RACES[data.race].scale || 1) * scale }), performance.now() / 1000); }

  function renderTrader(w) {
    const p = G.player, c = p.c; const b = w.body;
    const offers = Sys.mercOffers(); const slots = Sys.mercSlots(), have = (c.mercs || []).length;
    const hrs = Sys.hoursToNewMercs();
    b.innerHTML = `${!Sys.mercsOpen(c.faction) ? `<p class="hint warn"><b>Not for hire yet.</b> Mercenaries will not sign until ${esc(D.FACTIONS[c.faction].city)} has a Barracks.</p>` : ''}<p class="hint">Mercenaries always fight at your level. Your kingdom is level ${Sys.cityLevel(c.faction)}: you can lead <b>${slots}</b> and have <b>${have}</b>. Mercenaries hire from kingdom level ${Sys.MERC_MIN_KL}, with one more slot each level after (4 at kingdom level 5), and every mercenary you already lead makes the next contract 50% dearer. New faces arrive in ${Math.floor(hrs)}h ${Math.floor((hrs % 1) * 60)}m of game time (each game day is 24 real minutes). Contract: <span class="gold">${G.fmtCoins(Sys.mercCost(c.level))}</span> · you have ${G.fmtCoins(c.coins)}.</p><div class="mt-list"></div>`;
    const list = $('.mt-list', b);
    if (!offers.length) list.appendChild(h('p', 'empty-note', 'Everyone here has already been hired today. Come back tomorrow.'));
    offers.forEach((o) => {
      const C = D.CLASSES[o.cls], R = D.RACES[o.race], role = Sys.mercRole(o.cls);
      const card = h('div', 'mt-card', `<canvas width="80" height="96"></canvas><div class="mt-i"><b>${esc(o.name)}</b><span>${R.name} ${C.name}</span><span class="tags"><span>${role}</span><span>${C.armor} armor</span>${Sys.MERC_TANKS.includes(o.cls) ? '<span>Taunts</span>' : ''}${['cleric', 'druid', 'shaman', 'paladin', 'ranger', 'beastlord'].includes(o.cls) ? '<span>Heals</span>' : ''}</span><small class="dim">${esc(C.desc)}</small></div>`);
      const data = Object.assign({}, o, { faction: c.faction, level: c.level, equip: {} });
      portrait($('canvas', card), Object.assign(data, { equip: {} }));
      const bt = h('button', 'btn gold small', 'Hire'); bt.disabled = have >= slots || c.coins < Sys.mercCost(c.level); bt.title = !slots ? 'Build a Barracks to hire mercenaries' : have >= slots ? 'All your mercenary slots are full' : c.coins < Sys.mercCost(c.level) ? `The contract costs ${G.fmtCoins(Sys.mercCost(c.level))}` : '';
      bt.onclick = () => { Sys.hireMerc(o); renderTrader(w); };
      card.appendChild(bt); list.appendChild(card);
    });
  }

  function renderMercs(w) {
    const p = G.player, c = p.c; const b = w.body; const ms = p.mercs || [];
    if (!ms.length) { b.innerHTML = `<p class="empty-note">You have no mercenaries. Visit the Mercenary Trader in your kingdom plaza to hire one. You can lead ${Sys.mercSlots()} right now (one per kingdom level).</p>`; return; }
    let m = ms.find((x) => x.c.id === sel) || ms[0]; sel = m.c.id;
    const st = m.c.stance || 'standard';
    b.innerHTML = `<div class="tabs">${ms.map((x) => `<button class="tab ${x === m ? 'on' : ''}" data-id="${x.c.id}">${esc(x.name.split(' ')[0])}</button>`).join('')}<span class="dim small" style="margin-left:auto">${ms.length} / ${Sys.mercSlots()} slots</span></div>
      <div class="mc-head"><canvas width="84" height="100"></canvas><div class="mc-i"><b>${esc(m.name)}</b><span>Level ${m.c.level} ${D.RACES[m.c.race].name} ${D.CLASSES[m.c.cls].name} · ${Sys.mercRole(m.c.cls)}</span>
      <div class="bar hp"><i style="width:${(m.hp / m.hpMax) * 100}%"></i><span>${m.dead ? 'Recovering' : Math.ceil(m.hp) + ' / ' + m.hpMax}</span></div>${m.manaMax ? `<div class="bar mana"><i style="width:${(m.mana / m.manaMax) * 100}%"></i><span>${Math.floor(m.mana)} / ${m.manaMax}</span></div>` : ''}
      <small class="dim">Armor ${m.ac} · Weapon ${G.weaponDmg(m, 'main').dmg} dmg</small></div><div class="col"><button class="btn small" id="mc-call">Call to me</button><button class="btn small danger" id="mc-dis">Dismiss</button></div></div>
      <h4>Stance</h4><div class="stances">${Object.entries(Sys.STANCES).map(([k, s]) => `<button class="stance ${k === st ? 'on' : ''}" data-s="${k}"><b>${s.name}</b><small>${s.desc}</small></button>`).join('')}</div>
      <div class="mc-cols"><div><h4>Abilities <small class="dim">uncheck to stop using</small></h4><div class="mc-ab"></div></div><div><h4>Gear <small class="dim">click to take back</small></h4><div class="doll mc-doll"></div><h4>Give from your bag</h4><div class="grid mc-give"></div><p class="hint">Only gear this mercenary can use is shown. Shift-click a one-handed weapon to give it as an off-hand weapon.</p></div></div>`;
    b.querySelectorAll('.tab[data-id]').forEach((t) => (t.onclick = () => { sel = t.dataset.id; renderMercs(w); }));
    portrait($('.mc-head canvas', b), m.c);
    $('#mc-call', b).onclick = () => { m.x = p.x - 30; m.y = p.y + 20; m.target = null; G.log(`${m.name} returns to your side.`, 'sys', '#9affb8'); };
    $('#mc-dis', b).onclick = () => UI.confirm(`Dismiss ${m.name}? Their gear comes back to you, but the contract fee is not refunded.`, () => { Sys.dismissMerc(m); sel = null; renderMercs(w); });
    b.querySelectorAll('.stance').forEach((x) => (x.onclick = () => { Sys.setStance(m, x.dataset.s); renderMercs(w); }));
    const abBox = $('.mc-ab', b); m.c.off = m.c.off || {};
    const groups = { heal: 'Healing', bigheal: 'Healing', selfheal: 'Healing', buff: 'Buffs', selfbuff: 'Self buffs', taunt: 'Taunts', mana: 'Mana', attack: 'Attacks', pet: 'Pet', petheal: 'Pet', petbuff: 'Pet', cc: 'Crowd control' };
    Sys.mercAbilities(m.c).forEach((x) => {
      const id = 'mab-' + x.key.replace(/[^a-z0-9]/gi, '_');
      const row = h('label', 'mab', `<input type="checkbox" id="${id}" ${m.c.off[x.key] ? '' : 'checked'}><span class="ic">${esc(x.def.icon || '✦')}</span><span><b>${esc(x.def.name)}</b><small class="dim">${groups[x.cat] || ''}${x.def.kind === 'spell' ? ' · L' + x.def.level : ''}</small></span>`);
      row.querySelector('input').onchange = (e) => { if (e.target.checked) delete m.c.off[x.key]; else m.c.off[x.key] = true; };
      UI.bindTip(row, () => UI.actionTip(x.a).replace(/<div class="bad">.*?<\/div>/g, ''));
      abBox.appendChild(row);
    });
    const doll = $('.mc-doll', b);
    for (const sl of D.EQUIP_SLOTS) { const it = m.c.equip[sl]; const box = h('div', 'eq'); box.appendChild(h('label', null, D.SLOT_NAMES[sl])); box.appendChild(UI.itemCell(it, () => { Sys.mercUnequip(m, sl); renderMercs(w); }, 'equip', m.c)); doll.appendChild(box); }
    const give = $('.mc-give', b);
    const usable = c.inv.filter((it) => it && ['weapon', 'armor', 'jewel'].includes(it.kind) && G.canUse(m.c, it).ok);
    if (!usable.length) give.appendChild(h('p', 'empty-note', 'Nothing in your bag fits this mercenary.'));
    usable.forEach((it) => give.appendChild(UI.itemCell(it, (x, e) => { if (e.shiftKey) x._toSecondary = true; Sys.mercEquip(m, x); renderMercs(w); }, null, m.c)));
  }
})();
