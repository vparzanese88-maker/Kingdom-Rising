// Kingdom Rising — interface: HUD, movable/resizable windows, inventory, spellbook, abilities, journal, map, vendors, bank, crafting, macros
(function () {
  const KR = (window.KR = window.KR || {});
  const D = KR.D, U = KR.U, W = KR.W, G = KR.G, Sys = KR.Sys;
  const UI = (KR.UI = {});
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  UI.esc = esc;
  const LSget = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const LAYOUT_KEYS = ['kr_ui_geo', 'kr_hud_locks', 'kr_hud_closed', 'kr_hb_layout', 'kr_hb_size', 'kr_mm_hidden'];
  const LSset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} if (LAYOUT_KEYS.includes(k) && G.player && G.player.c) { const c = G.player.c; c.ui = c.ui || {}; c.ui[k] = JSON.parse(JSON.stringify(v)); UI.saveSoon(); } };
  // hotbar and panel positions travel with the character (saved to the cloud too), so they come back next time you play
  let saveT = 0;
  UI.saveSoon = function () { clearTimeout(saveT); saveT = setTimeout(() => { try { if (G.player && G.player.c) KR.Sys.save(true); } catch (e) {} }, 1500); };
  UI.restoreLayout = function () {
    const c = G.player && G.player.c; if (!c) return;
    if (c.ui) { for (const k of LAYOUT_KEYS) if (c.ui[k] !== undefined) { try { localStorage.setItem(k, JSON.stringify(c.ui[k])); } catch (e) {} } }
    else { c.ui = {}; for (const k of LAYOUT_KEYS) { const v = LSget(k, undefined); if (v !== undefined) c.ui[k] = v; } }
    geo = LSget('kr_ui_geo', {}); hudLocks = LSget('kr_hud_locks', {}); hudClosed = LSget('kr_hud_closed', {});
  };
  let geo = LSget('kr_ui_geo', {});
  UI.wins = {};

  // ---------------- windows ----------------
  UI.win = function (id, title, opt = {}) {
    if (UI.wins[id]) return UI.wins[id];
    const el = h('section', 'win', `<header class="win-h"><span class="win-t">${esc(title)}</span><span class="win-btns"><button class="win-l" aria-label="Lock window" title="Lock this window in place">🔓</button><button class="win-m" aria-label="Shrink" title="Shrink / expand">–</button><button class="win-x" aria-label="Close" title="Close">✕</button></span></header><div class="win-b"></div>`);
    el.id = 'w-' + id; el.hidden = true;
    const g = geo[id] || {};
    const vw = innerWidth, vh = innerHeight;
    el.style.width = Math.min(vw - 16, g.w || opt.w || 360) + 'px';
    if (opt.h || g.h) el.style.height = Math.min(vh - 16, g.h || opt.h) + 'px';
    el.style.left = U.clamp(g.x != null ? g.x : opt.x != null ? (opt.x < 0 ? vw + opt.x - (opt.w || 360) : opt.x) : (vw - (opt.w || 360)) / 2, 0, Math.max(0, vw - 120)) + 'px';
    el.style.top = U.clamp(g.y != null ? g.y : opt.y != null ? opt.y : 80, 0, Math.max(0, vh - 60)) + 'px';
    if (opt.min) { el.style.minWidth = opt.min[0] + 'px'; el.style.minHeight = opt.min[1] + 'px'; }
    $('#ui').appendChild(el);
    const w = { id, el, body: $('.win-b', el), title: $('.win-t', el), render: opt.render, onClose: opt.onClose };
    $('.win-x', el).onclick = () => UI.close(id);
    const setLock = (v) => { el.classList.toggle('locked', v); $('.win-l', el).textContent = v ? '🔒' : '🔓'; };
    setLock(!!(geo[id] && geo[id].locked));
    $('.win-l', el).onclick = () => { const v = !el.classList.contains('locked'); setLock(v); geo[id] = Object.assign(geo[id] || {}, { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, locked: v }); LSset('kr_ui_geo', geo); };
    $('.win-m', el).onclick = () => { const min = el.classList.toggle('min'); if (min) { el.dataset.h = el.style.height; el.style.height = ''; } else if (el.dataset.h) el.style.height = el.dataset.h; $('.win-m', el).textContent = min ? '□' : '–'; };
    $('.win-h', el).addEventListener('dblclick', (e) => { if (!e.target.closest('button')) $('.win-m', el).click(); });
    // drag
    const hd = $('.win-h', el);
    hd.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('button') || el.classList.contains('locked')) return;
      UI.front(el);
      const sx = ev.clientX, sy = ev.clientY, ox = el.offsetLeft, oy = el.offsetTop;
      const mv = (e) => { el.style.left = U.clamp(ox + e.clientX - sx, -el.offsetWidth + 80, innerWidth - 60) + 'px'; el.style.top = U.clamp(oy + e.clientY - sy, 0, innerHeight - 40) + 'px'; };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); saveGeo(id, el); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    el.addEventListener('pointerdown', (ev) => {
      UI.front(el);
      if (ev.button !== 0 || el.classList.contains('locked') || ev.target.closest('.win-h, button, input, select, textarea, a, canvas, label, .cell, .vrow, .row-item, .dragme, .wab, .mab, .tab, [contenteditable]')) return;
      const r = el.getBoundingClientRect(); if (ev.clientX > r.right - 18 && ev.clientY > r.bottom - 18) return; // resize corner
      const tg = ev.target; if (tg.scrollHeight > tg.clientHeight && ev.offsetX > tg.clientWidth) return; // scrollbar
      const sx = ev.clientX, sy = ev.clientY, ox = el.offsetLeft, oy = el.offsetTop; let moving = false;
      const mv = (e) => { if (!moving && Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return; moving = true; document.body.classList.add('dragging'); el.style.left = U.clamp(ox + e.clientX - sx, -el.offsetWidth + 80, innerWidth - 60) + 'px'; el.style.top = U.clamp(oy + e.clientY - sy, 0, innerHeight - 40) + 'px'; };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); document.body.classList.remove('dragging'); if (moving) saveGeo(id, el); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    new ResizeObserver(() => { if (!el.hidden) { saveGeo(id, el); if (w.onResize) w.onResize(); } }).observe(el);
    UI.wins[id] = w;
    return w;
  };
  function saveGeo(id, el) { geo[id] = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, locked: el.classList.contains('locked') }; LSset('kr_ui_geo', geo); }
  let zTop = 20;
  UI.front = (el) => { el.style.zIndex = ++zTop; };
  UI.open = function (id) { const w = UI.wins[id]; if (!w) return; w.el.hidden = false; UI.front(w.el); if (w.render) w.render(w); KR.A.sfx('open', 0.3); };
  UI.close = function (id) { const w = UI.wins[id]; if (!w || w.el.hidden) return; w.el.hidden = true; if (w.onClose) w.onClose(); };
  UI.toggle = function (id) { const w = UI.wins[id]; if (!w) return; if (w.el.hidden) UI.open(id); else UI.close(id); };
  UI.isOpen = (id) => UI.wins[id] && !UI.wins[id].el.hidden;
  UI.closeAll = function () { let n = 0; for (const id in UI.wins) { const w = UI.wins[id]; if (!w.el.hidden) { UI.close(id); n++; } } document.querySelectorAll('.ctx, .modal').forEach((x) => { x.remove(); n++; }); UI.hideTip && UI.hideTip(); return n > 0; };
  UI.closeTop = function () { let best = null, bz = -1; for (const id in UI.wins) { const w = UI.wins[id]; if (!w.el.hidden && +w.el.style.zIndex > bz) { bz = +w.el.style.zIndex; best = id; } } if (best) { UI.close(best); return true; } return false; };
  let refreshQ = false;
  UI.refresh = function () { if (refreshQ) return; refreshQ = true; requestAnimationFrame(() => { refreshQ = false; for (const id in UI.wins) { const w = UI.wins[id]; if (!w.el.hidden && w.render) w.render(w); } UI.renderBar(); UI.renderTracker(); }); };

  // ---------------- tooltip ----------------
  const tip = () => $('#tip');
  UI.showTip = function (html, ev) { const t = tip(); t.innerHTML = html; t.hidden = false; UI.moveTip(ev); };
  UI.moveTip = function (ev) { const t = tip(); if (t.hidden) return; const x = Math.min(ev.clientX + 16, innerWidth - t.offsetWidth - 8), y = Math.min(ev.clientY + 16, innerHeight - t.offsetHeight - 8); t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px'; };
  UI.hideTip = () => { tip().hidden = true; };
  UI.bindTip = function (el, fn) { el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') UI.showTip(fn(), e); }); el.addEventListener('pointermove', UI.moveTip); el.addEventListener('pointerleave', UI.hideTip); };

  UI.itemTip = function (it, ctx, who) {
    if (!it) return '';
    const c = who || G.player.c; const can = G.canUse(c, it);
    const qcol = it.sig ? '#ffb84a' : it.crafted ? '#7affc8' : it.name.startsWith('Mythic') || it.q > 1.15 ? '#ffb84a' : it.up ? '#9ad8ff' : '#efe3c8';
    const qc = it.unique ? '#d08aff' : qcol;
    let s = `<div class="tt-n" style="color:${qc}">${UI.icHTML(it, true)} ${esc(it.name)}${it.qty > 1 ? ' ×' + it.qty : ''}</div>`;
    if (it.unique) s += `<div style="color:#d08aff">Unique${it.classes && it.classes.length ? ' · ' + it.classes.map((k) => (D.CLASSES[k] ? D.CLASSES[k].name : k)).join(', ') + ' only' : ' · any class'}</div>`;
    if (it.kind === 'weapon') s += `<div>${D.WEAPON_TYPES[it.wt].name}${it.twoHand ? ' (two-handed)' : ''}</div><div>Damage <b>${Math.round(it.dmg * G.upMul(it))}</b> · Delay ${it.delay.toFixed(1)}s · <span class="dim">${(it.dmg * G.upMul(it) / it.delay).toFixed(1)} dps</span></div>`;
    if (it.kind === 'armor') s += `<div>${it.shield ? 'Shield' : it.ak === 'misc' ? D.SLOT_NAMES[it.slot] + ' · any class' : esc(it.ak[0].toUpperCase() + it.ak.slice(1)) + ' · ' + D.SLOT_NAMES[it.slot]}</div><div>Armor <b>${Math.round(it.ac * G.upMul(it))}</b></div>`;
    if (it.kind === 'jewel') s += `<div>${D.SLOT_NAMES[it.slot]}</div>`;
    const st = Object.entries(it.stats || {}).map(([k, v]) => `+${Math.round(v * G.upMul(it))} ${k}`);
    if (it.hp) st.push(`+${Math.round(it.hp * G.upMul(it))} HP`); if (it.mana) st.push(`+${Math.round(it.mana * G.upMul(it))} Mana`);
    if (it.haste) st.push(`<span style="color:#ffd84a">${Math.round(it.haste * 100)}% Haste</span>`);
    if (it.regen) st.push(`<span style="color:#7fe08a">+${it.regen} HP Regen/s</span>`);
    if (it.manaRegen) st.push(`<span style="color:#7fb8ff">+${it.manaRegen} Mana Regen/s</span>`);
    if (it.endRegen) st.push(`<span style="color:#ffd07a">+${it.endRegen} Endurance Regen/s</span>`);
    if (st.length) s += `<div class="tt-st">${st.join(' &nbsp;')}</div>`;
    if (it.haste) s += `<div class="dim small">Worn haste: improves attack speed. Only your best haste item counts.</div>`;
    if (it.proc) { const P = D.PROCS[it.proc]; const who = G.player; const ch = G.procChance(who, it); s += `<div class="tt-proc">${P.icon} <b>Effect: ${esc(P.name)}</b> · ${esc(P.desc)}<br>${UI.effText(P.effects, who.level)}<br><span class="dim">Proc chance ${(ch * 100).toFixed(1)}% per hit (rises with Dexterity ${who.stats.DEX}${it.delay > 2.6 ? ', and slow weapons proc more often' : ''})</span></div>`; }
    if (it.fx && !it.proc) s += `<div class="tt-proc">${esc(D.FX_NAMES[it.fx] || it.fx)}</div>`;
    if (it.lore) s += `<div class="tt-lore">“${esc(it.lore)}”</div>`;
    if (it.kind === 'mat') { s += `<div>Crafting material · tier ${it.tier + 1}</div>`; s += UI.matSourceHTML(it.mat, it.tier); }
    if (it.kind === 'consumable') s += `<div>${it.ctype === 'food' ? `Food, quality ${it.tier + 1} of 5. +${G.foodRegen(it.tier, G.player.c.level)} health per second for 20 min.` : it.ctype === 'drink' ? `Drink, quality ${it.tier + 1} of 5. +${G.drinkRegen(it.tier, G.player.c.level)} mana per second for 20 min.` : 'Liquid courage. Careful.'}</div>${it.ctype === 'food' || it.ctype === 'drink' ? '<div class="dim">Eaten automatically when the last one wears off.</div>' : ''}`;
    if (it.kind === 'trophy') s += `<div class="dim">Trophy. Some quests need these, merchants buy them.</div>`;
    if (it.kind === 'key') s += `<div class="dim">Opens a sealed boss lair.</div>`;
    if (it.crafted) s += `<div style="color:${it.sig ? '#ffb84a' : '#7affc8'}">${it.sig ? 'Signature piece · ' : ''}Crafted in ${D.FACTIONS[it.crafted].city}</div>`;
    if (['weapon', 'armor', 'jewel'].includes(it.kind) && !can.ok && !/^Requires level/.test(can.why)) s += `<div class="bad">${esc(can.why)}</div>`;
    if (['weapon', 'armor', 'jewel'].includes(it.kind) && can.ok && ctx !== 'equip') { const cur = c.equip[G.itemSlot(it, c)]; if (cur) { const d = it.kind === 'weapon' ? (it.dmg / it.delay - cur.dmg / cur.delay).toFixed(1) + ' dps' : (it.ac - (cur.ac || 0)) + ' AC'; s += `<div class="dim">vs equipped: ${d.startsWith('-') ? '<span class="bad">' + d + '</span>' : '<span class="good">+' + d + '</span>'}</div>`; } }
    if (ctx === 'buy') s += `<div class="tt-p">Price: ${G.fmtCoins(G.itemPrice(it))}</div>`;
    else if (it.value) s += `<div class="tt-p dim">Sells for ${G.fmtCoins(G.itemPrice(it, true) * (it.qty || 1))}</div>`;
    return s;
  };
  UI.actionTip = function (a) {
    const d = G.actionDef(a); if (!d) return '';
    let s = `<div class="tt-n">${esc(d.icon || '')} ${esc(d.name)}</div>`;
    const lvl = G.player.level; const tgtTxt = { enemy: 'Single enemy', self: 'Yourself', ally: 'Friendly target', pet: 'Your pet', pbae: `All enemies around you (${d.radius || 110} range)`, tae: 'Enemies around the target', group: 'Your group' }[d.target || 'enemy'] || '';
    const healTo = (d.target === 'ally' || d.target === 'self') && G.isHealDef(d) ? 'Your friendly target, or yourself on a monster or no target' : null;
    if (d.kind === 'spell') s += `<div>${d.hymn ? 'Hymn · auto-casts from your hotbar' : d.school === 'Song' ? 'Song' : esc(d.school)} · Level ${d.level} · ${d.hymn ? 'no mana' : d.mana + ' mana'} · ${d.hymn ? 'every 16s' : d.cast ? d.cast.toFixed(1) + 's cast' : 'instant'}${d.cd ? ' · ' + d.cd + 's cooldown' : ''}</div><div class="tt-desc">${esc(d.desc)}</div>`
    if (d.kind === 'spell') { const tg = { group: 'Group (you and nearby group members)', ally: 'Single friendly target', self: 'Self only', enemy: 'Enemy', pbae: 'All enemies around you', tae: 'All enemies around your target', pet: 'Your pet' }[d.target || 'enemy']; s += `<div class="dim small">Target: ${healTo || tg}</div>`; const ln = d.effects.find((e) => e.line); if (ln) s += `<div class="dim small">Does not stack with other ${ln.line.replace('buff_', '').replace('dmgbuff', 'damage').replace('sow', 'movement').replace('ds', 'damage shield')} buffs. The strongest one wins.</div>`; if (G.isToggleSong(d)) s += `<div class="dim small">Sings itself every ${D.SONG_PULSE}s while on your hotbar. Click it there to pause.</div>`; if (G.player && !G.player.c.spells.includes(d.id)) s += `<div style="color:#e8d48a">Costs ${G.fmtCoins(d.price)} to learn from your guildmaster.</div>`; }
    else if (d.kind === 'skill') s += `<div>${d.passive ? 'Passive' : 'Class ability · ' + G.endCost(G.player, d) + ' endurance · ' + (d.cd || 0) + 's cooldown'}</div><div>${esc(d.desc)}</div>`;
    else if (d.kind === 'weapon') s += `<div>${G.wtName(d.wt)} technique · skill ${D.WEAPON_UNLOCKS[d.idx]} · ${G.endCost(G.player, d)} endurance · ${d.cd}s cooldown</div><div>${esc(d.desc || weaponAbDesc(d))}</div>`;
    if (d.effects && d.effects.length) s += `<div class="tt-sec"><b>Effects</b> <span class="dim">(at your level ${lvl})</span>${UI.effText(d.effects, lvl, d)}</div>${tgtTxt && !d.passive ? `<div class="dim">Target: ${healTo || tgtTxt}${d.range && d.range !== 'melee' ? ' · range ' + d.range : d.range === 'melee' || (!d.range && d.kind !== 'spell') ? ' · melee range' : ''}</div>` : ''}`;
    else if (d.kind === 'macro') s += `<div class="dim">Macro</div><pre class="mac">${esc((G.player.c.macros.find((m) => m.id === d.id) || {}).lines || '')}</pre>`;
    const u = G.actionUsable(G.player, a); if (!u.ok && !u.cd) s += `<div class="bad">${esc(u.why)}</div>`; else if (u.weak) s += `<div class="bad" style="color:#ffb24a">${esc(u.why)}</div>`;
    return s;
  };
  // ----- readable descriptions of every effect, buff and debuff -----
  const MOD_NAMES = { ac: ['Armor', ''], acMul: ['Armor', '%'], haste: ['Attack speed', '%'], dmgMul: ['Damage', '%'], hp: ['Max health', ''], mana: ['Max mana', ''], regen: ['Health regen', '/s'], manaRegen: ['Mana regen', '/s'], ds: ['Damage shield', ' dmg to attackers'], dmgTaken: ['Damage taken', '%'], resist: ['All resists', ''], speed: ['Movement speed', '%'], spellMul: ['Spell damage', '%'], rangedMul: ['Ranged damage', '%'], invuln: ['Invulnerable', ''], crit: ['Critical chance', '%'], hit: ['Accuracy', '%'], STR: ['Strength', ''], STA: ['Stamina', ''], AGI: ['Agility', ''], DEX: ['Dexterity', ''], WIS: ['Wisdom', ''], INT: ['Intelligence', ''], CHA: ['Charisma', ''], fire: ['Fire resist', ''], cold: ['Cold resist', ''], magic: ['Magic resist', ''], poison: ['Poison resist', ''], disease: ['Disease resist', ''], hpPct: ['Max health', '%'], manaPct: ['Max mana', '%'], endPct: ['Max endurance', '%'], endRegen: ['Endurance regen', '/s'], threat: ['Hate generated', '%'], healMul: ['Healing done', '%'], slow: ['Attack speed', '%', -1] };
  const MOD_EXPLAIN = { ac: 'Higher armor means enemies hit you for less.', acMul: 'Higher armor means enemies hit you for less.', haste: 'You swing your weapons more often.', dmgMul: 'Your weapon hits and abilities deal more damage.', hp: 'Raises your maximum health.', hpPct: 'Raises your maximum health.', mana: 'Raises your maximum mana.', manaPct: 'Raises your maximum mana.',
    regen: 'Health returns faster, in and out of combat.', manaRegen: 'Mana returns faster.', endRegen: 'Endurance returns faster.', ds: 'Every enemy that hits you in melee takes this much damage back.', dmgTaken: 'Changes how much damage you take from every source.', speed: 'You run faster.', spellMul: 'Damage spells hit harder and heals heal more.', healMul: 'Your heals restore more health.', rangedMul: 'Arrows and thrown weapons hit harder.',
    threat: 'Enemies focus on you more, which keeps them off your allies.', invuln: 'Nothing can hurt you while this lasts.', slow: 'The target attacks less often.', resist: 'Changes the chance to resist spells.', STR: 'Strength raises melee and ranged damage.', STA: 'Stamina raises health and endurance.', AGI: 'Agility raises armor and avoidance.', DEX: 'Dexterity raises your chance to hit, proc chance and skill-ups.', WIS: 'Wisdom raises spell damage and healing, and mana for priests and hybrids.', INT: 'Intelligence raises spell damage and healing, and mana for arcane casters.', CHA: 'Charisma improves charm, mez and merchant prices.' };
  UI.buffTip = function (b, who) {
    const left = Math.max(0, (b.until - G.now) / 1000); const fmt = (x) => (x >= 3600 ? Math.floor(x / 3600) + 'h ' + Math.floor((x % 3600) / 60) + 'm' : x >= 60 ? Math.floor(x / 60) + 'm ' + Math.floor(x % 60) + 's' : Math.ceil(x) + 's');
    const sp = Object.values(D.SPELLS).find((x) => x.name === b.name || (x.effects[0] && x.effects[0].name === b.name));
    const kind = b.debuff ? '<span class="deb">Debuff</span>' : b.food != null ? 'Food' : b.drink != null ? 'Drink' : sp && sp.school === 'Song' ? 'Song' : sp ? 'Spell buff' : 'Buff';
    let s = `<div class="tt-n">${esc(b.icon || '✦')} ${esc(b.name)}</div><div class="dim">${kind}${b.src && b.src.name && b.src !== who ? ' · from ' + esc(b.src.name) : ''} · ${left > 0 ? fmt(left) + ' left' : 'ending'}</div>`;
    const rows = [];
    for (const [k, v] of Object.entries(b.mods || {})) { const [n, u, sign] = MOD_NAMES[k] || [k, '']; const val = u === '%' ? Math.round(v * 100) * (sign || 1) : +(+v).toFixed(2); rows.push(k === 'invuln' ? '<b>Invulnerable</b>' : `<b>${val > 0 ? '+' : ''}${val}${u === '%' ? '%' : ''}</b> ${n}${u && u !== '%' ? u : ''}<div class="dim small">${MOD_EXPLAIN[k] || ''}</div>`); }
    if (b.dot) rows.push(`Takes <b>${b.dot}</b>${b.res ? ' ' + b.res : ''} damage every 3 seconds (about <b>${Math.round(b.dot * left / 3)}</b> more)`);
    if (b.hot) rows.push(`Heals <b>${b.hot}</b> every 3 seconds (about <b>${Math.round(b.hot * left / 3)}</b> more)`);
    if (b.rune) rows.push(`Absorbs the next <b>${b.rune}</b> damage`);
    if (b.snare) rows.push(`Movement slowed by <b>${Math.round(b.snare * 100)}%</b>`);
    if (rows.length) s += `<ul class="tt-buff">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>`;
    if (sp && sp.desc) s += `<div class="dim small">${esc(sp.desc)}</div>`;
    if (who === G.player && !b.debuff) s += `<div class="dim small">Right-click to remove.</div>`;
    return s;
  };
  UI.modsText = function (mods) {
    return Object.entries(mods || {}).map(([k, v]) => { const [n, u] = MOD_NAMES[k] || [k, '']; if (k === 'invuln') return 'Invulnerable'; const val = u === '%' ? Math.round(v * 100) : v; return `${val > 0 ? '+' : ''}${val}${u === '%' ? '%' : ''} ${n}${u && u !== '%' ? u : ''}`; }).join(', ');
  };
  UI.effText = function (effects, lv, def) {
    const A = (amt) => G.scaleAmt(amt, lv); const R = (r) => (r ? ` ${r}` : '');
    const li = effects.map((e) => {
      switch (e.t) {
        case 'hit': return `Strikes for about <b>${A(e.amt)}</b> damage`;
        case 'wdmg': case 'rdmg': return `Weapon strike for <b>${Math.round(e.mult * 100)}%</b> weapon damage${e.backMult ? ` (×${e.backMult} from behind)` : ''}${e.crit ? ', always a critical hit' : ''}`;
        case 'multi': case 'rmulti': return `<b>${e.n}</b> ${e.t === 'rmulti' ? 'shots' : 'strikes'} of ${Math.round(e.mult * 100)}% weapon damage`;
        case 'execute': return `Strike for ${Math.round(e.mult * 100)}% weapon damage, <b>×${e.bonus}</b> if the target is below ${Math.round(e.below * 100)}% health`;
        case 'dmg': return `<b>${A(e.amt)}</b>${R(e.res)} damage${e.undead ? ` (×${e.undead} against undead)` : ''}`;
        case 'tap': return `Drains <b>${A(e.amt)}</b> health from the target and heals you`;
        case 'dot': { const a = A(e.amt); return `<span class="deb">Debuff:</span> <b>${a}</b>${R(e.res)} damage every 3s for ${e.dur}s (<b>${Math.round(a * e.dur / 3)}</b> total)`; }
        case 'heal': return `Heals <b>${A(e.amt)}</b> health`;
        case 'healpct': return `Heals <b>${Math.round(e.pct * 100)}%</b> of the target's health`;
        case 'selfhealpct': return `Heals you for <b>${Math.round(e.pct * 100)}%</b> of your health`;
        case 'hot': { const a = A(e.amt); return `<span class="buf">Buff:</span> heals <b>${a}</b> every 3s for ${e.dur}s (${Math.round(a * e.dur / 3)} total)`; }
        case 'buff': return `<span class="buf">Buff${e.name ? ' “' + esc(e.name) + '”' : ''}:</span> ${UI.modsText(e.mods)} for ${e.dur >= 60 ? Math.round(e.dur / 60) + ' min' : e.dur + 's'}`;
        case 'selfbuff': return `<span class="buf">Buff on you${e.name ? ' “' + esc(e.name) + '”' : ''}:</span> ${UI.modsText(e.mods)} for ${e.dur}s`;
        case 'debuff': return `<span class="deb">Debuff${e.name ? ' “' + esc(e.name) + '”' : ''}:</span> ${UI.modsText(e.mods)} on the target for ${e.dur}s${e.res ? ' (' + e.res + ' resist check)' : ''}`;
        case 'stun': return `<span class="deb">Stuns</span> for ${e.dur}s (not bosses)`;
        case 'root': return `<span class="deb">Roots</span> in place for ${e.dur}s`;
        case 'snare': return `<span class="deb">Snare:</span> movement −${Math.round((e.pct || 0.4) * 100)}% for ${e.dur}s`;
        case 'mez': return `<span class="deb">Mesmerizes</span> for ${e.dur}s (breaks on damage; Charisma helps it land)`;
        case 'fear': return `<span class="deb">Fear:</span> target flees for ${e.dur}s`;
        case 'rune': return `<span class="buf">Rune:</span> absorbs <b>${A(e.amt)}</b> damage for ${e.dur}s`;
        case 'taunt': return 'Taunts: you become the target\'s top threat';
        case 'dropaggro': return e.pct >= 1 ? 'Wipes all enemy threat on you' : `Reduces threat by ${Math.round(e.pct * 100)}%`;
        case 'fd': return 'Feign death: enemies forget you';
        case 'mana': return `Restores ${Math.round(e.pct * 100)}% of your mana`;
        case 'cannibal': return 'Converts health into mana';
        case 'pet': return `Summons a level ${Math.min(lv + 1, e.lv || lv)} ${esc(e.petKind || 'pet')}`;
        case 'gate': return 'Teleports you to your bind point';
        case 'bind': return 'Binds your soul to this spot (not in dungeons or rival kingdoms)';
        case 'lunge': return 'Leaps to the target';
      }
      return e.name ? esc(e.name) : '';
    }).filter(Boolean);
    return li.length ? '<ul class="tt-eff">' + li.map((x) => '<li>' + x + '</li>').join('') + '</ul>' : '';
  };
  UI.matSourceHTML = function (type, tier) {
    const s = Sys.matSources(type, tier);
    let o = '<div class="tt-src"><b>Where to find it</b>';
    if (s.mobs.length) o += '<div>Dropped by (about 1 in 5 kills):</div><ul>' + s.mobs.slice(0, 6).map((m) => `<li>${esc(m)}</li>`).join('') + (s.mobs.length > 6 ? `<li class="dim">…and ${s.mobs.length - 6} more</li>` : '') + '</ul>';
    if (s.bosses.length) o += `<div>Bosses (always drop several): ${s.bosses.map(esc).join(', ')}</div>`;
    o += `<div>Sold by: ${s.sellers.join(', ')} once your kingdom reaches level ${s.cityLevel}.</div></div>`;
    return o;
  };
  UI.icHTML = function (it, small) {
    if (!it) return '';
    if (['weapon', 'armor', 'jewel'].includes(it.kind) && KR.S.itemIcon) { const src = KR.S.itemIcon(it.kind === 'armor' && ['neck', 'ring', 'ear', 'finger'].includes(it.slot) ? Object.assign({}, it, { kind: 'jewel', uid: (it.uid || '') + 'j' }) : it); if (src) return `<img class="iimg${small ? ' sm' : ''}${it.unique ? ' uq' : it.proc ? ' pr' : ''}" src="${src}" alt="">`; }
    if (it.kind === 'trophy' && it.icon === '🦴' && G.trophyIcon) it.icon = G.trophyIcon(it.name); // older saves gave every trophy a bone
    return esc(it.icon || '?');
  };
  function weaponAbDesc(d) {
    return d.effects.map((e) => {
      switch (e.t) { case 'wdmg': case 'rdmg': return `${Math.round(e.mult * 100)}% weapon damage`; case 'multi': case 'rmulti': return `${e.n} strikes of ${Math.round(e.mult * 100)}%`; case 'dot': return 'bleeds over time'; case 'stun': return `stuns ${e.dur}s`; case 'snare': return 'slows movement'; case 'root': return `roots ${e.dur}s`; case 'debuff': return e.name; case 'execute': return `${Math.round(e.mult * 100)}%, much more below ${Math.round(e.below * 100)}% health`; case 'lunge': return 'leaps to the target'; case 'mana': return 'restores mana'; case 'rune': return 'absorbs damage'; case 'selfhealpct': return `heals you ${Math.round(e.pct * 100)}%`; }
      return '';
    }).filter(Boolean).join(', ') + (d.target === 'pbae' ? ' to all nearby enemies' : d.target === 'tae' ? ' around the target' : '') + '.';
  }

  // ---------------- drag & drop for actions ----------------
  let drag = null;
  UI.startDrag = function (ev, payload, icon) {
    ev.preventDefault();
    const ghost = h('div', 'drag-ghost', esc(icon || '✦')); document.body.appendChild(ghost); document.body.classList.add('dragging'); try { getSelection().removeAllRanges(); } catch (e) {}
    const mv = (e) => { ghost.style.left = e.clientX - 18 + 'px'; ghost.style.top = e.clientY - 18 + 'px'; };
    mv(ev);
    drag = payload;
    const up = (e) => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up); ghost.remove(); document.body.classList.remove('dragging');
      const t = document.elementFromPoint(e.clientX, e.clientY); const slot = t && t.closest('.hb-slot');
      if (slot && !slot.classList.contains('locked')) {
        const i = +slot.dataset.i; const bar = Sys.bar();
        if (payload.from != null) { const tmp = bar[i]; bar[i] = bar[payload.from]; bar[payload.from] = tmp; }
        else bar[i] = payload.a;
        KR.A.sfx('click'); UI.renderBar(); UI.saveSoon();
      } else if (payload.from != null && !(t && t.closest('#hotbar'))) { Sys.bar()[payload.from] = null; UI.renderBar(); UI.saveSoon(); }
      drag = null;
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  UI.draggable = function (el, a, icon) { el.classList.add('dragme'); el.addEventListener('pointerdown', (ev) => { if (ev.button !== 0) return; ev.preventDefault(); const sx = ev.clientX, sy = ev.clientY; const mv = (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 6) { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); UI.hideTip(); UI.startDrag(e, { a }, icon); } }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }); };

  // ---------------- HUD ----------------
  UI.buildHUD = function () {
    UI.restoreLayout();
    const ui = $('#ui'); ui.innerHTML = '';
    ui.appendChild(h('div', 'hud-player', `<div class="pf-name"><span id="pf-name"></span><span id="pf-lv" class="pf-lv"></span></div>
      <div class="bar hp" title="Health and health regeneration per second"><i id="pf-hp"></i><span id="pf-hpt"></span><b class="rg" id="pf-hprg"></b></div><div class="bar mana" id="pf-manawrap" title="Mana and mana regeneration per second"><i id="pf-mana"></i><span id="pf-manat"></span><b class="rg" id="pf-manarg"></b></div><div class="bar endur" title="Endurance (used by abilities and weapon techniques) and its regeneration per second"><i id="pf-end"></i><span id="pf-endt"></span><b class="rg" id="pf-endrg"></b></div>
      <div class="bar xp"><i id="pf-xp"></i><span id="pf-xpt"></span></div><div id="buffs" class="buffs"></div>`));
    ui.appendChild(h('div', 'hud-target', `<div class="tf-name" id="tf-name"></div><div class="bar hp"><i id="tf-hp"></i><span id="tf-hpt"></span></div><div class="tf-sub" id="tf-sub"></div><div id="tbuffs" class="buffs small"></div>`));
    $('.hud-target').hidden = true;
    ui.appendChild(h('div', 'hud-pet', `<div class="pt-name" id="pt-name"></div><div class="bar hp"><i id="pt-hp"></i></div><div class="pt-btns"><button data-c="attack" title="Pet attack">Attack</button><button data-c="back" title="Pet back off">Back</button><button data-c="taunt" id="pt-taunt" title="Toggle pet taunt">Taunt</button><button data-c="gear" title="Pet gear: helmet, chest, weapon, shield">Gear</button></div>`));
    $('.hud-pet').hidden = true; $('.hud-pet').querySelectorAll('button').forEach((b) => (b.onclick = () => b.dataset.c === 'gear' ? UI.toggle('petgear') : Sys.petCommand(b.dataset.c)));
    ui.appendChild(h('div', 'hud-mini', `<div class="mm-top"><span id="mm-zone"></span><span id="mm-time"></span><button class="mm-x" id="mm-hide" title="Put away the minimap (Z)" aria-label="Hide minimap">✕</button></div><canvas id="minimap" width="180" height="180" title="Click to open the map (M)"></canvas><div class="mm-btns"><button id="mm-zoomout" title="Zoom out">−</button><span id="mm-coord"></span><button id="mm-zoomin" title="Zoom in">+</button></div>`));
    $('#minimap').onclick = () => UI.toggle('map');
    $('#mm-hide').onclick = () => UI.toggleMinimap(false);
    $('#mm-zoomin').onclick = () => (UI.mmScale = Math.min(6, (UI.mmScale || 3) + 1)); $('#mm-zoomout').onclick = () => (UI.mmScale = Math.max(1, (UI.mmScale || 3) - 1));
    ui.appendChild(h('div', 'hud-tracker', ''));
    ui.appendChild(h('div', 'hud-cast', `<div class="bar cast"><i id="cb-i"></i><span id="cb-t"></span></div>`)); $('.hud-cast').hidden = true;
    ui.appendChild(h('div', 'hud-bottom', `<div id="hotbar"></div><div class="hb-side"><div class="hb-stances">${Object.entries(D.PSTANCES).map(([k, s]) => `<button data-st="${k}" aria-label="${s.name}">${s.icon}<small>${s.name.split(' ')[0]}</small></button>`).join('')}</div><div class="hb-extra"><button id="hb-auto" title="Auto attack (Q)">⚔<small>Q</small></button><button id="hb-range" title="Combat mode (R)">↔<small>R</small></button><button id="hb-sit" title="Sit / stand (X)">🧘<small>X</small></button></div></div>`));
    document.querySelectorAll('.hb-stances [data-st]').forEach((b) => { b.onclick = () => Sys.setPlayerStance(b.dataset.st); UI.bindTip(b, () => { const S = D.PSTANCES[b.dataset.st]; const on = G.player.c.pstance === b.dataset.st; const cd = Math.max(0, ((G.player.stanceCd || 0) - G.now) / 1000);
      return `<div class="tt-n">${esc(S.icon)} ${esc(S.name)}</div><div>Stance · ${on ? '<span class="good">Active</span>' : 'Click to switch'} · 5s cooldown between stances${cd > 0 ? ` (${cd.toFixed(1)}s)` : ''}</div><div>${esc(S.desc)}</div><div class="tt-sec"><b>Effects</b><ul class="tt-buff">${Object.entries(S.mods).map(([k, v]) => { const [n, u] = MOD_NAMES[k] || [k, '']; const val = u === '%' ? Math.round(v * 100) : v; return `<li><b class="${(k === 'dmgTaken' ? -val : val) >= 0 ? 'good' : 'bad'}">${val > 0 ? '+' : ''}${val}${u === '%' ? '%' : ''}</b> ${n}${u && u !== '%' ? u : ''}</li>`; }).join('')}</ul></div><div class="dim small">Only one stance can be active at a time.</div>`; }); });
    [['#hb-auto', 'Auto attack', 'Q', 'Start or stop attacking your target with your weapons.'], ['#hb-range', 'Combat mode', 'R', 'Switch between melee, ranged, or both.'], ['#hb-sit', 'Sit / stand', 'X', 'Sitting triples health, mana and endurance regeneration, but you stand up if attacked.']].forEach(([sel, n, k, d]) => { const el = $(sel); if (el) { el.removeAttribute('title'); UI.bindTip(el, () => `<div class="tt-n">${n} <kbd>${k}</kbd></div><div>${d}</div>`); } });
    $('#hb-auto').onclick = () => KR.Main.toggleAuto(); $('#hb-range').onclick = () => KR.Main.cycleRange(); $('#hb-sit').onclick = () => KR.Main.toggleSit();
    ui.appendChild(h('div', 'hud-chat', `<div id="chatlog" class="chatlog" aria-live="polite"></div><form id="chatform"><input id="chatin" autocomplete="off" maxlength="200" placeholder="Press Enter to chat. /help for commands"></form>`));
    $('#chatform').onsubmit = (e) => { e.preventDefault(); const v = $('#chatin').value.trim(); $('#chatin').value = ''; $('#chatin').blur(); if (v) Sys.command(v); };
    ui.appendChild(h('nav', 'hud-menu', [
      ['inv', '🎒', 'Inventory (I)'], ['char', '🧍', 'Character (C)'], ['spells', '📖', 'Spellbook (P)'], ['abil', '⚔', 'Abilities & Skills (K)'], ['journal', '📜', 'Journal (J)'], ['map', '🗺', 'Map (M)'], ['kingdom', '👑', 'Kingdom (N)'], ['macros', '⌨', 'Macros (U)'], ['mercs', '🤝', 'Mercenaries (Y)'], ['group', '👥', 'Group: invite players and find others online (G)'], ['minimap', '🧭', 'Show / hide minimap (Z)'], ['fullscreen', '⛶', 'Full screen (F)'], ['menu', '⚙', 'Settings, Save & Exit (Esc)'],
    ].map(([id, ic, t]) => `<button data-w="${id}" title="${t}" aria-label="${t}">${ic}</button>`).join('')));
    $('.hud-menu').querySelectorAll('button').forEach((b) => (b.onclick = () => (b.dataset.w === 'minimap' ? UI.toggleMinimap() : b.dataset.w === 'layout' ? UI.toggleLayout() : b.dataset.w === 'fullscreen' ? UI.toggleFullscreen() : UI.toggle(b.dataset.w))));
    ui.appendChild(h('div', 'toasts', '')); ui.appendChild(h('div', 'banner', '')); $('.banner').hidden = true;
    const tipEl = h('div', 'tip'); tipEl.id = 'tip'; tipEl.hidden = true; ui.appendChild(tipEl);
    UI.buildMercHUD && UI.buildMercHUD(); UI.buildGroupHUD && UI.buildGroupHUD();
    const buffTips = (el, who) => { el.addEventListener('pointermove', (e) => { const sp = e.target.closest('.bf'); if (!sp || e.pointerType !== 'mouse') { UI.hideTip(); return; } const ent = who(); const b = ent && ent.buffs[+sp.dataset.i]; if (b) { UI.showTip(UI.buffTip(b, ent), e); } }); el.addEventListener('pointerleave', UI.hideTip);
      el.addEventListener('contextmenu', (e) => { const sp = e.target.closest('.bf'); const ent = who(); if (!sp || ent !== G.player) return; e.preventDefault(); const b = ent.buffs[+sp.dataset.i]; if (b && !b.debuff) { ent.buffs.splice(ent.buffs.indexOf(b), 1); G.recalc(ent); UI.hideTip(); G.log(`You remove ${b.name}.`, 'sys', '#ccc'); } }); };
    buffTips($('#buffs'), () => G.player); buffTips($('#tbuffs'), () => G.player && G.player.target);
    for (const [sel, id] of [['.hud-menu', 'menu'], ['.hud-cast', 'cast'], ['.hud-mercs', 'mercs'], ['.hud-group', 'group'], ['.hud-player', 'player'], ['.hud-target', 'target'], ['.hud-mini', 'mini'], ['.hud-chat', 'chat'], ['.hud-tracker', 'tracker'], ['.hud-pet', 'pet'], ['.hud-bottom', 'bar']]) hudDrag($(sel), id);
    UI.buildWindows();
    UI.toggleMinimap(!LSget('kr_mm_hidden', false), true); UI.applyHotbarSize();
    UI.renderBar(); UI.renderTracker();
    G.msgs.slice(-40).forEach(UI.onLog);
  };
  const CORE = ['menu', 'bar', 'player', 'chat', 'cast'];
  let hudLocks = LSget('kr_hud_locks', {}); let hudClosed = LSget('kr_hud_closed', {});
  UI.hudClosed = (id) => !!hudClosed[id];
  UI.setHudClosed = (id, v) => { if (v) hudClosed[id] = 1; else delete hudClosed[id]; LSset('kr_hud_closed', hudClosed); const map = { tracker: '.hud-tracker', target: '.hud-target', pet: '.hud-pet', mercs: '.hud-mercs', group: '.hud-group', mini: '.hud-mini' }; const el = $(map[id]); if (el && v) el.hidden = true; if (id === 'mini') UI.toggleMinimap(!v, true); if (id === 'tracker') UI.renderTracker(); };
  function hudDrag(el, id) {
    const ctl = h('span', 'hud-ctl'); const grip = h('span', 'grip', '⠿'); grip.title = 'Drag to move · double-click to reset its position'; ctl.appendChild(grip);
    const lock = h('button', 'hud-lock', hudLocks[id] ? '🔒' : '🔓'); lock.title = 'Lock or unlock this panel in place'; lock.setAttribute('aria-label', 'Lock panel'); ctl.appendChild(lock);
    lock.onclick = (e) => { e.stopPropagation(); if (hudLocks[id]) delete hudLocks[id]; else hudLocks[id] = 1; LSset('kr_hud_locks', hudLocks); lock.textContent = hudLocks[id] ? '🔒' : '🔓'; el.classList.toggle('locked', !!hudLocks[id]); };
    if (!CORE.includes(id)) { const x = h('button', 'hud-close', '✕'); x.title = 'Close this panel (bring it back from Settings)'; x.setAttribute('aria-label', 'Close panel'); x.onclick = (e) => { e.stopPropagation(); UI.setHudClosed(id, true); G.log(`${el.dataset.label} panel closed. Turn it back on in Settings (Esc).`, 'sys', '#ccc'); }; ctl.appendChild(x); }
    el.appendChild(ctl); el.classList.toggle('locked', !!hudLocks[id]);
    const apply = (g) => { if (!g) return; el.style.left = U.clamp(g.x, 0, innerWidth - 60) + 'px'; el.style.top = U.clamp(g.y, 0, innerHeight - 30) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none'; if (g.w) el.style.width = g.w + 'px'; if (g.h) el.style.height = g.h + 'px'; };
    apply(geo['hud-' + id]);
    el.dataset.label = { player: 'Character', target: 'Target', mini: 'Minimap', chat: 'Chat', tracker: 'Quest tracker', pet: 'Pet', bar: 'Hotbar', mercs: 'Mercenaries', menu: 'Menu buttons', cast: 'Cast bar', group: 'Group' }[id] || id;
    el.addEventListener('pointerdown', (ev) => { if (!document.body.classList.contains('layout-edit') || ev.target.closest('.grip')) return; ev.preventDefault(); ev.stopPropagation(); start(ev); }, true);
    el.addEventListener('click', (ev) => { if (document.body.classList.contains('layout-edit')) { ev.preventDefault(); ev.stopPropagation(); } }, true);
    const start = (ev) => { const r = el.getBoundingClientRect(); const ox = ev.clientX - r.left, oy = ev.clientY - r.top; const mv = (e) => apply({ x: e.clientX - ox, y: e.clientY - oy }); const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); document.body.classList.remove('dragging'); const r2 = el.getBoundingClientRect(); geo['hud-' + id] = { x: r2.left, y: r2.top, w: el.style.width ? r2.width : null, h: el.style.height ? r2.height : null }; LSset('kr_ui_geo', geo); }; document.body.classList.add('dragging'); addEventListener('pointermove', mv); addEventListener('pointerup', up); };
    grip.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (hudLocks[id]) { G.log('That panel is locked. Click the lock to move it.', 'sys', '#ccc'); return; } start(ev); });
    grip.addEventListener('dblclick', () => { delete geo['hud-' + id]; LSset('kr_ui_geo', geo); el.removeAttribute('style'); });
    if (id === 'chat' || id === 'target' || id === 'tracker') new ResizeObserver(() => { const g = geo['hud-' + id]; if (el.style.width || el.style.height) { const r2 = el.getBoundingClientRect(); geo['hud-' + id] = Object.assign(g || { x: r2.left, y: r2.top }, { w: r2.width, h: r2.height }); LSset('kr_ui_geo', geo); } }).observe(el);
  }
  UI.toggleMinimap = function (show, quiet) {
    const el = $('.hud-mini'); if (!el) return; if (show == null) show = el.hidden; el.hidden = !show; LSset('kr_mm_hidden', !show);
    const tr = $('.hud-tracker'); if (tr && !geo['hud-tracker']) tr.style.top = show ? '' : 'calc(12px + env(safe-area-inset-top, 0px))';
    if (!quiet) G.log(show ? 'Minimap shown. Press Z to put it away.' : 'Minimap put away. Press Z or the compass button to bring it back.', 'sys', '#ccc');
  };
  UI.isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  UI.toggleFullscreen = function (want) {
    if (want == null) want = !UI.isFullscreen();
    const d = document.documentElement;
    try {
      const pr = want ? (d.requestFullscreen ? d.requestFullscreen() : d.webkitRequestFullscreen && d.webkitRequestFullscreen()) : (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen && document.webkitExitFullscreen());
      if (pr && pr.catch) pr.catch(() => G.log('Full screen is not available in this view. Try opening the game in its own browser tab.', 'sys', '#ffb24a'));
    } catch (e) { G.log('Full screen is not available in this view.', 'sys', '#ffb24a'); }
  };
  UI.applyHotbarSize = function () { const sz = LSget('kr_hb_size', 46); const hb = $('#hotbar'); if (hb) { hb.style.setProperty('--slot', sz + 'px'); const lay = LSget('kr_hb_layout', 'row'); hb.classList.toggle('vert', lay === 'col'); hb.classList.toggle('two', lay === 'grid'); const hbb = $('.hud-bottom'); if (hbb) hbb.classList.toggle('vert', lay === 'col'); } };
  UI.toggleLayout = function (on) {
    if (on == null) on = !document.body.classList.contains('layout-edit');
    document.body.classList.toggle('layout-edit', on); setTimeout(() => UI.renderTracker(), 0);
    let bar = document.getElementById('layout-bar');
    if (on && !bar) { bar = h('div', 'layout-bar', '<b>Customize layout</b><span>Drag any panel to move it. Drag a panel\'s corner to resize it where it shows a corner handle.</span><button class="btn small" id="lb-row">Hotbar: row</button><button class="btn small" id="lb-col">Hotbar: column</button><button class="btn small" id="lb-grid">Hotbar: 2 rows</button><button class="btn small" id="lb-reset">Reset layout</button><button class="btn gold small" id="lb-done">Done</button>'); bar.id = 'layout-bar'; $('#ui').appendChild(bar);
      $('#lb-done', bar).onclick = () => UI.toggleLayout(false);
      for (const [b, v] of [['row', 'row'], ['col', 'col'], ['grid', 'grid']]) $('#lb-' + b, bar).onclick = () => { LSset('kr_hb_layout', v); UI.applyHotbarSize(); };
      $('#lb-reset', bar).onclick = () => UI.resetLayout(); }
    if (!on && bar) bar.remove();
    // show hidden frames while editing so they can be placed
    for (const sel of ['.hud-target', '.hud-pet', '.hud-cast', '.hud-mercs', '.hud-tracker']) { const el = $(sel); if (!el) continue; if (on) { if (el.hidden) { el.hidden = false; el.dataset.wasHidden = '1'; } } else if (el.dataset.wasHidden) { delete el.dataset.wasHidden; } }
    if (on) G.log('Layout mode: drag panels where you want them, then press Done.', 'sys', '#ccc');
  };
  UI.resetLayout = function () { geo = {}; LSset('kr_ui_geo', geo); LSset('kr_hb_layout', 'row'); document.querySelectorAll('#ui > div, #ui > nav').forEach((el) => { if (el.classList.contains('banner') || el.classList.contains('toasts') || el.classList.contains('tip') || el.id === 'layout-bar') return; const hid = el.hidden; el.removeAttribute('style'); el.hidden = hid; }); UI.applyHotbarSize(); UI.toast('Layout reset'); };
  UI.onLog = function (m) {
    const log = $('#chatlog'); if (!log) return;
    const ln = h('div', 'ln ch-' + m.ch); ln.textContent = m.text; if (m.color) ln.style.color = m.color;
    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
    log.appendChild(ln); while (log.children.length > 200) log.firstChild.remove();
    if (atBottom) log.scrollTop = log.scrollHeight;
  };
  UI.toast = function (title, sub) { const box = $('.toasts'); if (!box) return; const t = h('div', 'toast', `<b>${esc(title)}</b>${sub ? '<span>' + esc(sub) + '</span>' : ''}`); box.appendChild(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3800); };
  UI.banner = function (title, sub) { const b = $('.banner'); b.innerHTML = `<div class="bn-t">${esc(title)}</div><div class="bn-s">${esc(sub || '')}</div>`; b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); clearTimeout(UI._bt); UI._bt = setTimeout(() => (b.hidden = true), 6500); };

  // per-frame HUD update
  UI.tick = function () {
    const p = G.player; if (!p) return; const c = p.c;
    const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
    const wid = (id, f) => { const e = document.getElementById(id); if (e) e.style.width = U.clamp(f * 100, 0, 100) + '%'; };
    set('pf-name', c.name); set('pf-lv', `${c.level} ${D.CLASSES[c.cls].name}`);
    wid('pf-hp', p.hp / p.hpMax); set('pf-hpt', `${Math.ceil(p.hp)} / ${p.hpMax}`);
    if (p.endurMax) { wid('pf-end', p.endur / p.endurMax); set('pf-endt', `${Math.floor(p.endur)} / ${p.endurMax}`); }
    $('#pf-manawrap').hidden = !p.manaMax; if (p.manaMax) { wid('pf-mana', p.mana / p.manaMax); set('pf-manat', `${Math.floor(p.mana)} / ${p.manaMax}`); }
    const rr = p.regenRates || { hp: 0, mana: 0, end: 0 }; const fr = (v) => '+' + (v >= 10 ? Math.round(v) : v.toFixed(1)) + '/s';
    set('pf-hprg', p.hp >= p.hpMax ? '' : fr(rr.hp)); set('pf-manarg', !p.manaMax || p.mana >= p.manaMax ? '' : fr(rr.mana)); set('pf-endrg', p.endur >= p.endurMax ? '' : fr(rr.end));
    const need = D.xpNeeded(c.level); wid('pf-xp', c.level >= D.MAX_LEVEL ? 1 : c.xp / need); set('pf-xpt', c.level >= D.MAX_LEVEL ? 'Max level' : `${Math.floor((c.xp / need) * 100)}% to ${c.level + 1}`);
    // buffs
    const bEl = $('#buffs'); const bSig = p.buffs.map((b) => b.name + Math.ceil((b.until - G.now) / 1000)).join('|');
    if (bEl.dataset.sig !== bSig) { bEl.dataset.sig = bSig; bEl.innerHTML = p.buffs.map((b, i) => `<span class="bf ${b.debuff ? 'deb' : ''}" data-i="${i}">${esc(b.icon || '✦')}<small>${fmtT((b.until - G.now) / 1000)}</small></span>`).join(''); }
    // target
    const t = p.target; const tf = $('.hud-target');
    if (t && !t.removed) {
      tf.hidden = UI.hudClosed('target');
      const hostile = G.isHostile(p, t);
      const con = t.type === 'mob' ? D.conOf(p.level, t.level) : null;
      const nm = $('#tf-name'); nm.textContent = t.name + (t.dead ? ' (dead)' : ''); nm.style.color = con ? D.CON_COLORS[con] : hostile ? '#ff6a5a' : '#a8e0ff';
      wid('tf-hp', t.hp / t.hpMax); set('tf-hpt', `${Math.max(0, Math.round((t.hp / t.hpMax) * 100))}%`);
      const conTxt = { gray: 'Too weak to matter', green: 'An easy fight', lblue: 'Should be easy', blue: 'A fair fight, slightly in your favor', white: 'An even match', yellow: 'A tough fight', red: 'Very dangerous' };
      set('tf-sub', t.type === 'mob' ? `Level ${t.level}${t.mclass && !t.boss ? ' ' + t.mclass : ''}${t.boss ? ' · Boss' : t.named ? ' · Named' : ''} · ${conTxt[con]}` : t.type === 'npc' ? t.title || 'Citizen' : t.type === 'pet' ? `Level ${t.level} pet` : t.type === 'player' ? `Level ${t.level}` : `Level ${t.level} ${t.title || ''}`);
      const tb = $('#tbuffs'); const ts = (t.buffs || []).map((b) => b.name).join('|'); if (tb.dataset.sig !== ts) { tb.dataset.sig = ts; tb.innerHTML = (t.buffs || []).slice(0, 8).map((b, i) => `<span class="bf ${b.debuff ? 'deb' : ''}" data-i="${i}">${esc(b.icon || '✦')}</span>`).join(''); }
    } else tf.hidden = !document.body.classList.contains('layout-edit');
    // pet
    const pf = $('.hud-pet'); if (p.pet && !p.pet.dead) { pf.hidden = UI.hudClosed('pet'); set('pt-name', p.pet.isCharm ? `${p.pet.name} · charmed ${Math.max(0, Math.ceil((p.pet.charmUntil - G.now) / 1000))}s` : p.pet.name); wid('pt-hp', p.pet.hp / p.pet.hpMax); const tb = $('#pt-taunt'); const on = p.c.petTaunt !== false; if (tb.dataset.on !== String(on)) { tb.dataset.on = on; tb.textContent = 'Taunt: ' + (on ? 'On' : 'Off'); tb.classList.toggle('on', on); } } else pf.hidden = !document.body.classList.contains('layout-edit');
    UI.tickMercs && UI.tickMercs(); UI.tickGroup && UI.tickGroup();
    // cast bar
    const cb = $('.hud-cast'); const intr = p.interrupted && G.now - p.interrupted.at < 1400;
    if (p.cast) { cb.hidden = false; cb.classList.remove('interrupted'); wid('cb-i', p.cast.t / p.cast.dur); set('cb-t', p.cast.spell.name); }
    else if (intr) { cb.hidden = false; cb.classList.add('interrupted'); wid('cb-i', 1); set('cb-t', 'Interrupted'); }
    else { cb.classList.remove('interrupted'); cb.hidden = !document.body.classList.contains('layout-edit'); if (!cb.hidden) set('cb-t', 'Cast bar'); }
    // minimap
    const mm = $('#minimap'); if (mm) { const reg = D.REGIONS[W.regionAtPx(p.x, p.y)]; const inB = W.buildingAt(p.x, p.y); set('mm-zone', inB ? inB.name : reg.name + (reg.lv[1] ? ` (${reg.lv[0]}–${reg.lv[1]})` : '')); const hr = Math.floor(G.clock / 60), mn = Math.floor(G.clock % 60); set('mm-time', `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')} ${hr >= 6 && hr < 19 ? '☀' : '☾'}`); set('mm-coord', `${Math.floor(p.x / 32)}, ${Math.floor(p.y / 32)}`); const want = Math.round(U.clamp(mm.parentElement.clientWidth - 14, 90, 380)); if (mm.width !== want) { mm.width = mm.height = want; mm.style.width = mm.style.height = want + 'px'; } KR.R.drawMinimap(mm, UI.mmScale || 3); }
    // hotbar cooldowns
    const bar = Sys.bar(); const slots = D.slotsForLevel(c.level);
    document.querySelectorAll('#hotbar .hb-slot').forEach((el, i) => {
      if (i >= slots) return; const a = bar[i]; const cdEl = el.querySelector('.cd'); if (!cdEl) return;
      if (!a) { cdEl.style.background = ''; el.classList.remove('dis'); return; }
      const def = G.actionDef(a); let frac = 0;
      const until = p.cds[a.k + ':' + a.id] || 0; if (until > G.now && def && def.cd) frac = (until - G.now) / (def.cd * 1000);
      if (a.k === 'spell' && p.gcd > G.now) frac = Math.max(frac, (p.gcd - G.now) / 1500);
      if (a.k === 'weapon' && p.relearn > 0) frac = Math.max(frac, p.relearn / 5);
      cdEl.style.background = frac > 0 ? `conic-gradient(rgba(0,0,0,0.65) ${frac * 360}deg, transparent 0)` : '';
      const u = G.actionUsable(p, a); el.classList.toggle('dis', !u.ok && !u.cd); el.classList.toggle('weak', !!u.weak);
      el.classList.toggle('casting', !!(p.cast && p.cast.a === a));
      el.classList.toggle('song-on', !!(a.k === 'spell' && c.songsOn && c.songsOn[a.id]));
    });
    $('#hb-auto').classList.toggle('on', !!p.autoAttack); $('#hb-sit').classList.toggle('on', !!p.sit);
    document.querySelectorAll('.hb-stances [data-st]').forEach((b) => { b.classList.toggle('on', c.pstance === b.dataset.st); b.classList.toggle('cd', (p.stanceCd || 0) > G.now); });
    const rm = c.rangeMode || 'both'; const rb = $('#hb-range'); const rl = { melee: '⚔', ranged: '🏹', both: '↔' }[rm]; if (rb.dataset.m !== rm) { rb.dataset.m = rm; rb.innerHTML = `${rl}<small>R</small>`; rb.title = `Combat mode: ${rm} (R)`; }
    rb.hidden = !c.equip.range;
    UI.tickTracker = (UI.tickTracker || 0) + 1; if (UI.tickTracker % 30 === 0) { UI.renderTracker(); if (UI.isOpen('map')) { const mc = $('#w-map canvas'); if (mc) UI.drawWorldMap(mc); } }
  };
  const fmtT = (s) => (s > 3600 ? Math.floor(s / 3600) + 'h' : s > 60 ? Math.floor(s / 60) + 'm' : Math.max(0, Math.floor(s)) + 's');

  UI.renderBar = function () {
    const hb = $('#hotbar'); if (!hb || !G.player) return; const c = G.player.c; const bar = Sys.bar(); const slots = D.slotsForLevel(c.level);
    hb.innerHTML = '';
    for (let i = 0; i < D.HOTBAR; i++) {
      const a = bar[i]; const def = a && G.actionDef(a);
      const locked = i >= slots;
      const el = h('button', 'hb-slot' + (locked ? ' locked' : ''), locked ? `<span class="ic">🔒</span><small class="k">Lv ${D.SLOT_UNLOCK[i]}</small>` : `<span class="ic">${def ? esc(def.icon || '✦') : ''}</span><small class="k">${(i + 1) % 10}</small><span class="cd"></span>`);
      el.dataset.i = i; el.setAttribute('aria-label', locked ? `Slot locked until level ${D.SLOT_UNLOCK[i]}` : def ? `${def.name} (key ${i + 1})` : `Empty slot ${i + 1}`);
      if (!locked) {
        el.onclick = () => { if (a) G.useAction(a); };
        el.oncontextmenu = (e) => { e.preventDefault(); if (!a) return; if (e.shiftKey) { bar[i] = null; UI.renderBar(); UI.saveSoon(); return; } UI.toggleAutoUse(a); };
        if (a && G.autoUsable(a)) el.classList.toggle('auto-on', !!(c.autoUse && c.autoUse[a.k + ':' + a.id]));
        if (a) { UI.bindTip(el, () => UI.actionTip(a) + `<div class="dim">${G.autoUsable(a) ? (c.autoUse && c.autoUse[a.k + ':' + a.id] ? '<b style="color:#7fe08a">Auto use ON</b> · ' : '') + 'Right-click: auto use in combat · ' : ''}Drag off the bar or shift+right-click to remove</div>`); el.addEventListener('pointerdown', (ev) => { if (ev.button !== 0) return; const sx = ev.clientX, sy = ev.clientY; const mv = (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); UI.hideTip(); UI.startDrag(e, { from: i }, def.icon); } }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }); }
        else UI.bindTip(el, () => '<div class="dim">Empty slot. Drag abilities here from Abilities (K), Spellbook (P) or Macros (U).</div>');
      }
      hb.appendChild(el);
    }
  };
  UI.toggleAutoUse = function (a) {
    const c = G.player.c; if (!G.autoUsable(a)) { G.log('That cannot be used automatically.', 'sys', '#ccc'); return; }
    c.autoUse = c.autoUse || {}; const k = a.k + ':' + a.id; const def = G.actionDef(a);
    if (c.autoUse[k]) delete c.autoUse[k]; else c.autoUse[k] = 1;
    G.log(`${def.name}: auto use ${c.autoUse[k] ? 'ON. It fires by itself whenever it is ready in combat.' : 'off.'}`, 'sys', c.autoUse[k] ? '#7fe08a' : '#cccccc');
    KR.A.sfx('click'); UI.renderBar(); UI.saveSoon();
  };
  UI.renderTracker = function () {
    const el = $('.hud-tracker'); if (!el || !G.player) return; const c = G.player.c;
    if (UI.hudClosed('tracker')) { el.hidden = true; return; }
    const act = Object.keys(c.quests.active).map((id) => Sys.QUESTS[id]).filter(Boolean);
    let body = el.querySelector('.tr-body'); if (!body) { body = h('div', 'tr-body'); el.prepend(body); }
    if (!act.length) { body.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    body.innerHTML = `<div class="tr-h">Quests</div>` + act.slice(0, 5).map((q) => { const st = c.quests.active[q.id]; const done = Sys.questComplete(q); return `<div class="tr-q ${st.tracked ? 'trk' : ''} ${done ? 'done' : ''}" data-id="${q.id}"><b>${esc(q.title)}</b><span>${done ? 'Return to ' + esc(giverName(q)) : questProgText(q)}</span></div>`; }).join('');
    el.querySelectorAll('.tr-q').forEach((d) => (d.onclick = () => { for (const id in c.quests.active) c.quests.active[id].tracked = id === d.dataset.id; UI.refresh(); }));
  };
  function giverName(q) { const role = q.turnin || q.giver; const n = G.ents.find((e) => e.city === G.player.c.faction && e.role === role); return n ? n.name : role; }
  function questProgText(q) { if (q.type === 'build' && KR.Kingdom) return KR.Kingdom.progText(q); if (q.type === 'deliver') return `Deliver to ${giverName(q)}`; if (q.type === 'boss') return `Slay ${D.BOSS_BY_ID[q.boss].name}`; return `${Sys.questProgress(q)} / ${q.n} ${q.type === 'collect' ? q.item : q.region ? 'in ' + D.REGIONS[D.REGION_BY_ID[q.region]].name : (q.mobs || []).map((m) => D.MOBS[m].name).join(', ')}`; }
  UI.questProgText = questProgText;

  // ---------------- windows ----------------
  UI.buildWindows = function () {
    UI.wins = {};
    const vw = innerWidth;
    UI.win('inv', 'Inventory', { w: 440, x: -12, y: 60, render: renderInv });
    UI.win('char', 'Character', { w: 380, x: 12, y: 120, render: renderChar });
    UI.win('spells', 'Spellbook', { w: 460, h: 520, x: 60, y: 80, render: renderSpells });
    UI.win('abil', 'Abilities & Skills', { w: 520, h: 560, x: 80, y: 70, render: renderAbil });
    UI.win('journal', 'Journal', { w: 560, h: 460, x: 100, y: 90, render: renderJournal });
    const mw = UI.win('map', 'World Map', { w: Math.min(640, vw - 20), h: Math.min(640, innerHeight - 40), y: 40, render: renderMap, min: [240, 240] }); mw.onResize = () => renderMap(mw);
    UI.win('kingdom', 'Kingdoms', { w: 520, h: 520, y: 70, render: renderKingdom });
    UI.win('macros', 'Macros', { w: 440, h: 420, y: 100, render: renderMacros });
    UI.win('menu', 'Settings', { w: 340, y: 100, render: renderMenu });
    UI.win('npc', 'Conversation', { w: 420, y: 90, render: renderNPC });
    UI.win('vendor', 'Merchant', { w: 640, h: 520, y: 60, render: renderVendor, onClose: () => KR.Main.setMusicOverride(null) });
    UI.win('trainer', 'Guildmaster', { w: 520, h: 520, y: 60, render: renderTrainer });
    UI.win('bank', 'Shared Bank', { w: 640, h: 520, y: 60, render: renderBank });
    UI.win('craft', 'Crafting', { w: 640, h: 560, y: 60, render: renderCraft, onClose: () => KR.Main.setMusicOverride(null) });
    UI.win('loot', 'Loot', { w: 300, y: 160, render: renderLoot });
    UI.buildMercWindows && UI.buildMercWindows(); UI.buildGroupUI && UI.buildGroupUI();
    UI.win('help', 'How to Play', { w: 520, h: 520, y: 60, render: renderHelp });
  };

  // ----- inventory -----
  function itemCell(it, onClick, ctx, who) {
    const el = h('button', 'cell' + (it ? '' : ' empty'), it ? `<span class="ic">${UI.icHTML(it)}</span>${it.qty > 1 ? `<small class="q">${it.qty}</small>` : ''}${it.up ? `<small class="up">+${it.up}</small>` : ''}` : '');
    if (it) {
      if (it.sig) el.classList.add('rare'); else if (it.crafted) el.classList.add('crafted'); else if (it.q > 1.15 || /^(Mythic|Gleaming|Ancient|Runed|Blessed|Shadowed|Fabled)/.test(it.name)) el.classList.add('rare');
      const can = G.canUse(who || G.player.c, it); if (['weapon', 'armor', 'jewel'].includes(it.kind) && !can.ok) el.classList.add('nouse');
      UI.bindTip(el, () => UI.itemTip(it, ctx, who)); el.setAttribute('aria-label', it.name);
      el.onclick = (e) => { UI.hideTip(); onClick && onClick(it, e); };
      el.oncontextmenu = (e) => { e.preventDefault(); UI.hideTip(); onClick && onClick(it, e, true); };
    }
    return el;
  }
  UI.itemCell = itemCell;
  function renderInv(w) {
    const p = G.player, c = p.c; const b = w.body; b.innerHTML = '';
    const doll = h('div', 'eqdoll');
    const POS = { head: [1, 1], back: [1, 2], chest: [1, 3], hands: [1, 4], neck: [4, 1], ring: [4, 2], waist: [4, 3], legs: [4, 4], primary: [1, 5], secondary: [2, 5], range: [3, 5], feet: [4, 5] };
    for (const sl of D.EQUIP_SLOTS) {
      const it = c.equip[sl]; const [gx, gy] = POS[sl] || [1, 1];
      const box = h('div', 'eq'); box.dataset.slot = sl; box.style.gridColumn = gx; box.style.gridRow = gy; box.appendChild(h('label', null, D.SLOT_NAMES[sl]));
      const cell = itemCell(it, () => Sys.unequip(sl), 'equip'); if (!it) cell.title = D.SLOT_NAMES[sl]; if (it) dragSrc(cell, it, { slot: sl });
      box.appendChild(cell); doll.appendChild(box);
    }
    const pv = h('div', 'eq-pv'); pv.style.gridColumn = '2 / 4'; pv.style.gridRow = '1 / 5';
    pv.innerHTML = `<canvas width="180" height="230"></canvas><div class="eq-st"><span title="Armor class">🛡 ${p.ac}</span><span title="Health">❤ ${p.hpMax}</span>${p.manaMax ? `<span title="Mana">✦ ${p.manaMax}</span>` : ''}${p.haste ? `<span title="Haste">⚡ ${Math.round(p.haste * 100)}%</span>` : ''}</div><div class="eq-rot"><button class="mini" data-r="-1" aria-label="Turn left">⟲</button><button class="mini" data-r="1" aria-label="Turn right">⟳</button></div>`;
    doll.appendChild(pv); b.appendChild(doll);
    const cv = $('canvas', pv); const dirs = [0, 1, 3, 2];
    pv.querySelectorAll('[data-r]').forEach((bt) => (bt.onclick = () => { UI._invDir = ((UI._invDir || 0) + +bt.dataset.r + 4) % 4; }));
    const draw = () => { if (!cv.isConnected || w.el.hidden) return; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); const gr = g.createRadialGradient(90, 150, 10, 90, 150, 120); gr.addColorStop(0, 'rgba(255,220,150,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 180, 230); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(90, 214, 46, 10, 0, 0, 6.28); g.fill(); const lk = G.player.look; KR.S.drawHumanoid(g, 90, 212, Object.assign({}, lk, { dir: dirs[UI._invDir || 0], scale: 2.6 * (D.RACES[c.race].scale || 1), moving: false }), performance.now() / 1000); requestAnimationFrame(draw); };
    draw();
    b.appendChild(h('div', 'inv-h', `<span>Bag</span><span class="coins">${G.fmtCoins(c.coins)}</span>`));
    const grid = h('div', 'grid');
    c.inv.forEach((it, i) => { const cell = itemCell(it, (x, e, rc) => invClick(x, e, rc)); cell.dataset.bag = i; if (it) dragSrc(cell, it, { bag: i }); grid.appendChild(cell); });
    b.appendChild(grid);
    b.appendChild(h('p', 'hint', 'Click to equip or use, or drag an item onto a gear slot. Drag gear back into your bag to take it off. Shift-click a one-handed weapon for your secondary hand. Right-click for more options.'));
  }
  // ----- drag and drop equipping -----
  UI.slotOk = function (it, sl, c) {
    if (!it || !['weapon', 'armor', 'jewel'].includes(it.kind)) return false;
    if (!G.canUse(c, it).ok) return false;
    if (G.itemSlot(it, c) === sl) return true;
    return sl === 'secondary' && it.kind === 'weapon' && !it.twoHand && !D.WEAPON_TYPES[it.wt].ranged && G.hasSkill(c, 'dualwield');
  };
  let dndBlockClick = false;
  addEventListener('click', (e) => { if (dndBlockClick) { e.stopPropagation(); e.preventDefault(); dndBlockClick = false; } }, true);
  function dragSrc(cell, it, from) {
    cell.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const sx = ev.clientX, sy = ev.clientY; let ghost = null; const c = G.player.c;
      const mv = (e) => {
        if (!ghost) {
          if (Math.hypot(e.clientX - sx, e.clientY - sy) < 7) return;
          UI.hideTip(); ghost = h('div', 'dnd-ghost', `<span class="ic">${UI.icHTML(it)}</span>`); document.body.appendChild(ghost); document.body.classList.add('dnd');
          document.querySelectorAll('#w-inv .eq[data-slot]').forEach((b) => b.classList.toggle('dnd-ok', from.bag != null && UI.slotOk(it, b.dataset.slot, c)));
          if (from.slot) document.querySelectorAll('#w-inv .grid').forEach((g) => g.classList.add('dnd-ok'));
        }
        ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
        const t = document.elementFromPoint(e.clientX, e.clientY); document.querySelectorAll('.dnd-hover').forEach((x) => x.classList.remove('dnd-hover'));
        const tgt = t && (t.closest('#w-inv .eq[data-slot]') || t.closest('#w-inv .cell[data-bag]')); if (tgt) tgt.classList.add('dnd-hover');
      };
      const up = (e) => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
        if (!ghost) return;
        ghost.remove(); document.body.classList.remove('dnd'); dndBlockClick = true; setTimeout(() => (dndBlockClick = false), 50);
        document.querySelectorAll('.dnd-ok, .dnd-hover').forEach((x) => x.classList.remove('dnd-ok', 'dnd-hover'));
        const t = document.elementFromPoint(e.clientX, e.clientY); if (!t) return;
        const eq = t.closest('#w-inv .eq[data-slot]'), bagCell = t.closest('#w-inv .cell[data-bag]'), grid = t.closest('#w-inv .grid'), pv = t.closest('#w-inv .eq-pv');
        if (from.bag != null) {
          if (eq) { const sl = eq.dataset.slot; if (!UI.slotOk(it, sl, c)) { const why = G.canUse(c, it); G.log(why.ok ? `${it.name} does not go in the ${D.SLOT_NAMES[sl]} slot.` : why.why, 'sys', '#ff8a6a'); KR.A.sfx('fail', 0.5); return; } if (sl === 'secondary' && it.kind === 'weapon') it._toSecondary = true; if (sl === 'primary') it._toPrimary = true; Sys.equip(it); return; }
          if (pv) { if (['weapon', 'armor', 'jewel'].includes(it.kind)) Sys.equip(it); else Sys.useItem(it); return; }
          if (bagCell) { const j = +bagCell.dataset.bag, i = from.bag; if (i !== j) { const tmp = c.inv[j]; c.inv[j] = c.inv[i]; c.inv[i] = tmp; KR.A.sfx('click', 0.4); UI.refresh(); } return; }
        } else if (from.slot) {
          if (bagCell) { const j = +bagCell.dataset.bag; if (!c.inv[j]) { c.equip[from.slot] = null; c.inv[j] = it; G.recalc(G.player); KR.A.sfx('equip', 0.6); if (from.slot === 'primary') Sys.onWeaponChange(); UI.refresh(); } else if (UI.slotOk(c.inv[j], from.slot, c)) { const other = c.inv[j]; if (from.slot === 'secondary' && other.kind === 'weapon') other._toSecondary = true; if (from.slot === 'primary') other._toPrimary = true; Sys.equip(other); } else Sys.unequip(from.slot); return; }
          if (grid) { Sys.unequip(from.slot); return; }
          if (eq && eq.dataset.slot !== from.slot && UI.slotOk(it, eq.dataset.slot, c)) { const to = eq.dataset.slot; const other = c.equip[to]; c.equip[to] = it; c.equip[from.slot] = other && UI.slotOk(other, from.slot, c) ? other : null; if (other && c.equip[from.slot] !== other) Sys.addItem(other, true); G.recalc(G.player); KR.A.sfx('equip', 0.8); Sys.onWeaponChange(); UI.refresh(); }
        }
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
  }
  function invClick(it, e, rc) {
    const p = G.player;
    if ((UI.isOpen('vendor') || UI.craftShopOpen()) && !rc) { UI.sellItem(it); return; }
    if (UI.isOpen('bank') && !rc) { Sys.deposit(it); return; }
    if (rc) { UI.menu(e, [['Use / Equip', () => Sys.useItem(it)], it.kind === 'weapon' && !it.twoHand && !D.WEAPON_TYPES[it.wt].ranged ? ['Equip in secondary hand', () => { it._toSecondary = true; Sys.equip(it); }] : null, ['Put on hotbar', () => { const bar = Sys.bar(); const i = bar.findIndex((x, k) => !x && k < D.slotsForLevel(p.c.level)); if (i >= 0 && it.kind === 'consumable') { bar[i] = { k: 'item', id: it.name, icon: it.icon, name: it.name }; UI.renderBar(); } }], ['Destroy', () => UI.confirm(`Destroy ${it.name}?`, () => { p.c.inv[p.c.inv.indexOf(it)] = null; UI.refresh(); })]].filter(Boolean)); return; }
    if (e.shiftKey && it.kind === 'weapon' && !it.twoHand) it._toSecondary = true;
    Sys.useItem(it);
  }
  UI.menu = function (e, items) {
    document.querySelectorAll('.ctx').forEach((x) => x.remove());
    const m = h('div', 'ctx'); items.forEach(([t, fn]) => { const b = h('button', null, esc(t)); b.onclick = () => { m.remove(); fn(); }; m.appendChild(b); });
    document.body.appendChild(m); m.style.left = Math.min(e.clientX, innerWidth - 200) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - items.length * 34 - 10) + 'px';
    setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off); } }), 0);
  };
  UI.confirm = function (text, yes) {
    const ov = h('div', 'modal', `<div class="modal-b"><p>${esc(text)}</p><div class="row"><button class="btn danger" id="cf-y">Yes</button><button class="btn" id="cf-n">Cancel</button></div></div>`);
    document.body.appendChild(ov); $('#cf-y', ov).onclick = () => { ov.remove(); yes(); }; $('#cf-n', ov).onclick = () => ov.remove(); $('#cf-n', ov).focus();
  };

  // ----- character -----
  function renderChar(w) {
    const p = G.player, c = p.c, b = w.body; const R = D.RACES[c.race], C = D.CLASSES[c.cls];
    const wd = G.weaponDmg(p, 'main');
    b.innerHTML = `<div class="ch-head"><canvas id="ch-portrait" width="96" height="110"></canvas><div><div class="ch-name">${esc(c.name)}</div><div>Level ${c.level} ${R.name} ${C.name}</div><div class="dim">${D.FACTIONS[c.faction].name} · ${D.FACTIONS[c.faction].city}</div><div class="dim">Played ${Math.floor((c.playTime || 0) / 3600)}h ${Math.floor(((c.playTime || 0) % 3600) / 60)}m · ${c.kills || 0} kills</div></div></div>
      <div class="stat-pts">Stats come from your race and your gear. Better gear is the only way to raise them (max ${D.STAT_CAP}).</div>
      <table class="stats">${D.STATS.map((s) => { const base = R.stats[s]; const gear = p.stats[s] - base; return `<tr><th title="${esc(D.STAT_HELP[s])}">${D.STAT_NAMES[s]}</th><td>${p.stats[s]}</td><td class="dim">${base} race${gear ? ` <span class="${gear > 0 ? 'good' : 'bad'}">${gear > 0 ? '+' : ''}${gear} gear</span>` : ''}</td><td class="dim small">${esc(D.STAT_HELP[s].split('.')[0])}</td></tr>`; }).join('')}</table>
      <table class="stats derived"><tr><th>Health</th><td>${Math.ceil(p.hp)} / ${p.hpMax}</td></tr>${p.manaMax ? `<tr><th>Mana</th><td>${Math.floor(p.mana)} / ${p.manaMax}</td></tr>` : ''}<tr><th>Armor</th><td>${p.ac}</td></tr><tr><th>Weapon</th><td>${wd.dmg} dmg / ${wd.delay.toFixed(1)}s</td></tr><tr><th>Endurance</th><td>${Math.floor(p.endur)} / ${p.endurMax}</td></tr><tr><th>Regen /s</th><td>${(p.regenRates ? [`<span style="color:#7fe08a">${p.regenRates.hp.toFixed(1)} HP</span>`, p.manaMax ? `<span style="color:#7fb8ff">${p.regenRates.mana.toFixed(1)} mana</span>` : '', `<span style="color:#ffd07a">${p.regenRates.end.toFixed(1)} end</span>`].filter(Boolean).join(' · ') : '')}${p.gearRegen && (p.gearRegen.hp || p.gearRegen.mana || p.gearRegen.end) ? ' <span class="dim">(gear adds some)</span>' : ''}<div class="dim small">Sit to regenerate 3× faster. Combat slows it.</div></td></tr><tr><th>Haste</th><td>${Math.round(p.haste * 100)}%${p.wornHaste ? ` <span class="dim">(${Math.round(p.wornHaste * 100)}% from gear)</span>` : ''}</td></tr><tr><th>Run speed</th><td>${Math.round(p.speed / 1.28)}%</td></tr><tr><th>Bag slots</th><td>${c.inv.length}</td></tr></table>`;
    b.querySelectorAll('button[data-s]').forEach((bt) => (bt.onclick = () => { if (c.statPoints <= 0) return; c.statPoints--; c.alloc[bt.dataset.s]++; G.recalc(p); KR.A.sfx('click'); UI.refresh(); }));
    UI.drawPortrait($('#ch-portrait', b), p.look);
  }
  UI.drawPortrait = function (cv, look, dir = 0, ent) { const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); if (!look) { if (ent) { const e2 = Object.assign({}, ent, { x: cv.width / 2, y: cv.height - 8, scale: 0.55, face: 1, moving: false, atk: 0, dead: false }); KR.S.drawCreature(g, e2, performance.now() / 1000); } return; } KR.S.drawHumanoid(g, cv.width / 2, cv.height - 10, Object.assign({}, look, { dir, scale: (cv.height / 70) * (look.scale || 1) }), performance.now() / 1000); };

  // ----- spellbook -----
  let spSchool = 'All';
  function renderSpells(w) {
    const p = G.player, c = p.c, b = w.body;
    if (!D.CLASS_SPELLS[c.cls]) { b.innerHTML = `<p class="empty-note">${D.CLASSES[c.cls].name}s do not cast spells. Your strength comes from class abilities and weapon techniques. Open Abilities & Skills (K).</p>`; return; }
    const known = c.spells.map((id) => D.SPELLS[id]).sort((a, b2) => a.level - b2.level);
    if (c.cls === 'bard') return renderSongbook(w, known);
    const schools = ['All', ...new Set(known.map((s) => s.school))];
    b.innerHTML = `<div class="tabs">${schools.map((s) => `<button class="tab ${s === spSchool ? 'on' : ''}" data-s="${s}">${s}</button>`).join('')}</div><p class="hint">Drag a spell to your hotbar. You know ${known.length} of ${D.CLASS_SPELLS[c.cls].length} ${D.CLASSES[c.cls].name} spells. Buy more from your guildmaster.</p><div class="list"></div>`;
    b.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { spSchool = t.dataset.s; renderSpells(w); }));
    const list = $('.list', b);
    known.filter((s) => spSchool === 'All' || s.school === spSchool).forEach((sp) => {
      const row = h('div', 'row-item', `<span class="ic">${esc(sp.icon)}</span><div class="ri-m"><b>${esc(sp.name)}</b><small>${esc(sp.school)} · L${sp.level} · ${sp.mana} mana · ${sp.cast ? sp.cast.toFixed(1) + 's' : 'instant'}</small><small class="dim">${esc(sp.desc)}</small></div>`);
      UI.draggable(row, { k: 'spell', id: sp.id }, sp.icon); UI.bindTip(row, () => UI.actionTip({ k: 'spell', id: sp.id }));
      row.ondblclick = () => G.useAction({ k: 'spell', id: sp.id });
      list.appendChild(row);
    });
    const sk = h('div', 'schools', `<h4>Spell schools</h4>` + D.SCHOOLS.filter((s) => known.some((k) => k.school === s)).map((s) => `<div class="sk"><span title="${esc(D.SCHOOL_HELP[s])}">${s}</span>${skillBar(c.school[s] || 0, D.schoolSkillCap(c.level))}</div>`).join('') + `<p class="hint">Casting a spell trains its school. Higher skill means enemies resist your spells less often and less heavily.</p>`);
    b.appendChild(sk);
  }
  let bardTab = 'hymns';
  function renderSongbook(w, known) {
    const c = G.player.c, b = w.body; w.title.textContent = 'Songbook';
    const hymns = known.filter((s) => s.hymn), songs = known.filter((s) => !s.hymn);
    b.innerHTML = `<div class="tabs"><button class="tab ${bardTab === 'hymns' ? 'on' : ''}" data-t="hymns">Hymns <small>${hymns.length}</small></button><button class="tab ${bardTab === 'songs' ? 'on' : ''}" data-t="songs">Songs <small>${songs.length}</small></button></div>
      <div class="hint big">${bardTab === 'hymns' ? '<b>Hymns auto-cast from your hotbar.</b> Drag a hymn onto your hotbar and you sing it automatically every 16 seconds, for free, without stopping anything else. It lifts your whole group. Click it on the hotbar to pause or resume. Hymns of the same kind do not stack; the strongest wins.' : '<b>Songs are played when you click them.</b> They cost mana and include damage chants, area discords, lullabies, slows, snares and charms.'}</div><div class="list"></div>`;
    b.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { bardTab = t.dataset.t; renderSpells(w); }));
    const list = $('.list', b); const onBar = new Set(Sys.bar().filter((a) => a && a.k === 'spell').map((a) => a.id));
    (bardTab === 'hymns' ? hymns : songs).forEach((sp) => {
      const st = sp.hymn ? (onBar.has(sp.id) ? (c.hymnOff && c.hymnOff[sp.id] ? '<span class="pill">Paused</span>' : '<span class="pill on">Singing</span>') : '<span class="pill dim">Not on hotbar</span>') : '';
      const row = h('div', 'row-item', `<span class="ic">${esc(sp.icon)}</span><div class="ri-m"><span class="ri-top"><b>${esc(sp.name)}</b>${st}</span><small>Level ${sp.level}${sp.hymn ? ' · free · whole group' : ' · ' + sp.mana + ' mana'}</small><span class="ri-eff">${esc(sp.desc)}</span></div>`);
      UI.draggable(row, { k: 'spell', id: sp.id }, sp.icon); UI.bindTip(row, () => UI.actionTip({ k: 'spell', id: sp.id }));
      row.ondblclick = () => G.useAction({ k: 'spell', id: sp.id });
      list.appendChild(row);
    });
    b.appendChild(h('div', 'schools', `<h4>Singing</h4><div class="sk"><span>Singing</span>${skillBar(c.school.Song || 0, D.schoolSkillCap(c.level))}</div><p class="hint">Singing rises one point at a time as you play songs and hymns. Higher skill makes songs harder to resist.</p>`));
  }
  function skillBar(v, cap) { return `<span class="sbar"><i style="width:${(v / 250) * 100}%"></i><em style="left:${(cap / 250) * 100}%"></em></span><span class="sv">${v}<small>/${cap}</small></span>`; }

  // ----- abilities -----
  let abTab = 'class';
  function renderAbil(w) {
    const p = G.player, c = p.c, b = w.body; const C = D.CLASSES[c.cls];
    b.innerHTML = `<div class="tabs"><button class="tab ${abTab === 'class' ? 'on' : ''}" data-t="class">Class abilities</button><button class="tab ${abTab === 'passive' ? 'on' : ''}" data-t="passive">Class passives</button><button class="tab ${abTab === 'weapon' ? 'on' : ''}" data-t="weapon">Weapon skills</button><button class="tab ${abTab === 'craft' ? 'on' : ''}" data-t="craft">Crafting</button></div><div class="pane"></div>`;
    b.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { abTab = t.dataset.t; renderAbil(w); }));
    const pane = $('.pane', b);
    if (abTab === 'passive') {
      pane.appendChild(h('h4', 'abh', `Class passives <small class="dim">${D.classPassives(c.cls).filter((P) => P.level <= c.level).length} of 10 · always active, unlock as you level</small>`));
      for (const P of D.classPassives(c.cls)) {
        const has = c.level >= P.level;
        const row = h('div', 'row-item passive' + (has ? '' : ' locked'), `<span class="ic">${esc(P.icon)}</span><div class="ri-m"><b>${esc(P.name)}</b><small>Passive · ${has ? 'Active' : 'Unlocks at level ' + P.level}</small><small class="dim">${esc(P.desc)}</small></div>`);
        pane.appendChild(row);
      }
    } else if (abTab === 'class') {
      pane.appendChild(h('p', 'hint', 'New abilities go onto your hotbar by themselves while it has a free slot. Drag them to rearrange. Right-click one on the hotbar to have it used automatically in combat.'));
      pane.appendChild(h('h4', 'abh', `Class abilities <small class="dim">${C.skills.filter(([sid]) => !D.SKILLS[sid].passive && c.level >= C.skills.find((x) => x[0] === sid)[1]).length} of ${C.skills.filter(([sid]) => !D.SKILLS[sid].passive).length} learned · drag them to your hotbar</small>`));
      for (const [id, lv] of C.skills.filter(([sid]) => !D.SKILLS[sid].passive)) {
        const s = D.SKILLS[id]; const has = c.level >= lv;
        const row = h('div', 'row-item' + (has ? '' : ' locked'), `<span class="ic">${esc(s.icon)}</span><div class="ri-m"><b>${esc(s.name)}</b><small>${s.passive ? 'Passive' : 'Active · ' + s.cd + 's cooldown'} · ${has ? 'Learned' : 'Unlocks at level ' + lv}</small><small class="dim">${esc(s.desc)}</small></div>`);
        if (has && !s.passive) { UI.draggable(row, { k: 'skill', id }, s.icon); row.ondblclick = () => G.useAction({ k: 'skill', id }); }
        pane.appendChild(row);
      }
    } else if (abTab === 'weapon') {
      pane.appendChild(h('p', 'hint', 'Fighting with a weapon type trains its skill by one point at a time. Each type unlocks 10 techniques. Your hotbar is remembered for each weapon type, and you need 5 seconds to readjust after swapping.'));
      const types = C.weapons.concat(C.ranged).concat(C.weapons.includes('H2H') ? [] : ['H2H']).concat(C.shield ? ['SHIELD'] : []);
      for (const wt of types) {
        const v = c.wskill[wt] || 0; const cur = G.weaponType(c) === wt || G.rangedType(c) === wt || (wt === 'SHIELD' && c.equip.secondary && c.equip.secondary.shield);
        const sec = h('div', 'wsk' + (cur ? ' cur' : ''), `<div class="wsk-h"><b>${wt === 'SHIELD' ? 'Block (shield)' : D.WEAPON_TYPES[wt].name}</b>${cur ? '<span class="pill">Equipped</span>' : ''}${skillBar(v, D.weaponSkillCap(c.level))}</div><div class="wsk-abs"></div>`);
        const abs = $('.wsk-abs', sec);
        D.WEAPON_ABILITIES[wt].forEach((ab, i) => {
          const un = v >= D.WEAPON_UNLOCKS[i];
          const a = { k: 'weapon', id: wt + ':' + i };
          const el = h('div', 'wab' + (un ? '' : ' locked'), `<span class="ic">${esc(ab.icon)}</span><small>${esc(ab.name)}</small><small class="dim">${un ? 'Ready' : 'Skill ' + D.WEAPON_UNLOCKS[i]}</small>`);
          if (un) UI.draggable(el, a, ab.icon);
          UI.bindTip(el, () => UI.actionTip(a));
          abs.appendChild(el);
        });
        pane.appendChild(sec);
      }
    } else {
      pane.appendChild(h('p', 'hint', 'Craft at an anvil (Smithing), loom (Tailoring) or with the Arcane Scribe (Arcane Binding). Crafting also upgrades gear up to +5. Each kingdom crafts its own unique line of gear.'));
      for (const k in D.CRAFTS) pane.appendChild(h('div', 'sk', `<span title="${esc(D.CRAFTS[k].makes)}">${D.CRAFTS[k].name}</span>${skillBar(c.craft[k] || 0, 250)}`));
    }
  }

  // ----- journal -----
  let jSel = null;
  function renderJournal(w) {
    const c = G.player.c, b = w.body;
    const act = Object.keys(c.quests.active).map((id) => Sys.QUESTS[id]).filter(Boolean);
    if (!jSel || !c.quests.active[jSel]) jSel = act[0] ? act[0].id : null;
    b.innerHTML = `<div class="jr"><div class="jr-list"></div><div class="jr-d"></div></div>`;
    const list = $('.jr-list', b);
    if (!act.length) list.appendChild(h('p', 'empty-note', 'No active quests. Look for ! above townsfolk, and visit your king.'));
    act.forEach((q) => {
      const st = c.quests.active[q.id]; const done = Sys.questComplete(q);
      const el = h('button', 'jq' + (q.id === jSel ? ' sel' : '') + (done ? ' done' : ''), `<span class="trk" title="Tracked on map">${st.tracked ? '◉' : '○'}</span><span><b>${esc(q.title)}</b><small>${done ? 'Complete' : questProgText(q)}</small></span>`);
      el.onclick = () => { jSel = q.id; for (const id in c.quests.active) c.quests.active[id].tracked = id === q.id; UI.refresh(); };
      list.appendChild(el);
    });
    list.appendChild(h('div', 'dim small', `${Object.keys(c.quests.done).length} quests completed`));
    const q = jSel && Sys.QUESTS[jSel]; const d = $('.jr-d', b);
    if (q) {
      const r = q.reward;
      d.innerHTML = `<h3>${esc(q.title)}</h3><p class="giver">From ${esc(roleName(q.giver))}${q.turnin ? ' · Deliver to ' + esc(roleName(q.turnin)) : ''} · Level ${q.bossLv || q.lv}</p><p>${esc(q.text)}</p><p><b>Progress:</b> ${Sys.questComplete(q) ? 'Complete. Return to ' + esc(giverName(q)) + '.' : questProgText(q)}</p><p><b>Rewards:</b> ${G.fmtCoins(r.coin || 0)}${r.status ? ` · <span class="gold">+${r.status} kingdom status</span>` : ''}${r.item ? ' · an item' : ''} · experience</p><div class="row"><button class="btn" id="jq-map">Show on map</button><button class="btn danger" id="jq-ab">Abandon</button></div>`;
      $('#jq-map', d).onclick = () => { for (const id in c.quests.active) c.quests.active[id].tracked = id === q.id; UI.open('map'); };
      $('#jq-ab', d).onclick = () => UI.confirm(`Abandon ${q.title}?`, () => { delete c.quests.active[q.id]; if (q.type === 'deliver') Sys.takeItem(q.item, 1); UI.refresh(); });
    }
  }
  function roleName(role) { const n = G.ents.find((e) => e.city === G.player.c.faction && e.role === role); return n ? `${n.name}${n.title ? ' (' + n.title + ')' : ''}` : role; }

  // ----- map -----
  const mv = { z: 1, cx: 192, cy: 192 };
  function renderMap(w) {
    const b = w.body; let cv = $('canvas', b);
    if (!cv) {
      b.innerHTML = '<div class="map-tools"><button class="btn small" id="mp-out" title="Zoom out">−</button><button class="btn small" id="mp-in" title="Zoom in">+</button><button class="btn small" id="mp-me" title="Center on me">⌖ Me</button><span class="dim small" id="mp-z"></span><span class="dim small">Scroll to zoom · drag to pan</span></div><canvas class="mapcv"></canvas><div class="map-legend"><span>● You</span><span class="gold">◯ Tracked quest</span><span>🏰 Kingdoms</span><span class="dim">Unexplored areas are dark</span></div>';
      cv = $('canvas', b);
      const zoomAt = (f, mx, my) => { const r = cv.getBoundingClientRect(); const s = (cv.width / (W.W / mv.z)); const px = mx == null ? cv.width / 2 : (mx - r.left) * (cv.width / r.width), py = my == null ? cv.height / 2 : (my - r.top) * (cv.height / r.height); const tx = mv.cx + (px - cv.width / 2) / s, ty = mv.cy + (py - cv.height / 2) / s; mv.z = U.clamp(mv.z * f, 1, 10); const s2 = cv.width / (W.W / mv.z); mv.cx = tx - (px - cv.width / 2) / s2; mv.cy = ty - (py - cv.height / 2) / s2; UI.drawWorldMap(cv); };
      cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1 / 1.2 : 1.2, e.clientX, e.clientY); }, { passive: false });
      cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); const sx = e.clientX, sy = e.clientY, ocx = mv.cx, ocy = mv.cy; const r = cv.getBoundingClientRect(); const k = (cv.width / r.width) / (cv.width / (W.W / mv.z)); const m = (ev) => { mv.cx = ocx - (ev.clientX - sx) * k; mv.cy = ocy - (ev.clientY - sy) * k; UI.drawWorldMap(cv); }; const u = () => { cv.removeEventListener('pointermove', m); cv.removeEventListener('pointerup', u); }; cv.addEventListener('pointermove', m); cv.addEventListener('pointerup', u); });
      cv.addEventListener('dblclick', (e) => zoomAt(1.6, e.clientX, e.clientY));
      $('#mp-in', b).onclick = () => zoomAt(1.4); $('#mp-out', b).onclick = () => zoomAt(1 / 1.4);
      $('#mp-me', b).onclick = () => { mv.cx = G.player.x / 32; mv.cy = G.player.y / 32; if (mv.z < 2.5) mv.z = 3; UI.drawWorldMap(cv); };
    }
    const size = Math.max(200, Math.min(b.clientWidth - 4, b.clientHeight - 64));
    if (cv.width !== size) { cv.width = size; cv.height = size; cv.style.width = size + 'px'; cv.style.height = size + 'px'; }
    UI.drawWorldMap(cv);
  }
  UI.drawWorldMap = function (cv) {
    const g = cv.getContext('2d'); const p = G.player;
    const span = W.W / mv.z; mv.cx = U.clamp(mv.cx, span / 2, W.W - span / 2); mv.cy = U.clamp(mv.cy, span / 2, W.H - span / 2);
    const s = cv.width / span, x0 = mv.cx - span / 2, y0 = mv.cy - span / 2;
    const T2 = (x, y) => [(x - x0) * s, (y - y0) * s];
    const zl = document.getElementById('mp-z'); if (zl) zl.textContent = `${mv.z.toFixed(1)}×`;
    g.fillStyle = '#0a0810'; g.fillRect(0, 0, cv.width, cv.height);
    g.imageSmoothingEnabled = false; g.drawImage(W.mapCanvas, x0, y0, span, span, 0, 0, cv.width, cv.height);
    const EW = W.W >> 2; g.fillStyle = 'rgba(10,8,16,0.86)';
    for (let y = Math.max(0, Math.floor(y0 / 4)); y <= Math.min(EW - 1, Math.ceil((y0 + span) / 4)); y++) for (let x = Math.max(0, Math.floor(x0 / 4)); x <= Math.min(EW - 1, Math.ceil((x0 + span) / 4)); x++) if (!W.explored[y * EW + x]) { const [a, b2] = T2(x * 4, y * 4); g.fillRect(a, b2, 4 * s + 1, 4 * s + 1); }
    g.font = `600 ${U.clamp(Math.round(10 + mv.z * 1.2), 11, 18)}px "Alegreya Sans", sans-serif`; g.textAlign = 'center';
    for (const [ri, r] of D.REGIONS.entries()) { if (W.present && !W.present.has(ri)) continue; const lp = r.label || r.seeds[0]; if (!lp) continue; const [x, y] = lp; const ex = W.explored[(y >> 2) * EW + (x >> 2)]; if (!ex && !r.city) continue; const [lx, ly] = T2(x, y); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; const label = r.city ? '🏰 ' + r.name : !r.lv[1] ? r.name : `${r.dungeon ? '⛏ ' : ''}${r.name} ${r.lv[0]}–${r.lv[1]}`; g.strokeText(label, lx, ly); g.fillStyle = r.city ? '#ffe9a8' : '#e8e0c8'; g.fillText(label, lx, ly); }
    if (mv.z >= 3) { g.font = `500 ${U.clamp(Math.round(8 + mv.z), 10, 15)}px "Alegreya Sans", sans-serif`; for (const bd of W.buildings) { if (!bd.name || bd.type === 'house') continue; const [bx, by] = T2(bd.x + bd.w / 2, bd.y + bd.h / 2); if (bx < -40 || by < -20 || bx > cv.width + 40 || by > cv.height + 20) continue; g.strokeText(bd.name, bx, by); g.fillStyle = '#f4e6c0'; g.fillText(bd.name, bx, by); } }
    g.font = `600 ${U.clamp(Math.round(9 + mv.z), 10, 15)}px "Alegreya Sans", sans-serif`;
    for (const pt of W.portals || []) { const [a, b2] = T2(pt.x, pt.y); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; const t = (pt.back ? '⇧ ' : pt.sewer ? '🕳 ' : '⛏ ') + (pt.label || ''); g.strokeText(t, a, b2 - 8); g.fillStyle = pt.back ? '#ffe9a8' : '#e0c090'; g.fillText(t, a, b2 - 8); g.beginPath(); g.arc(a, b2, 4, 0, 6.28); g.fill(); }
    for (const k in D.HUBS) { const hb = D.HUBS[k]; if ((hb.realm || 'main') !== W.realm) continue; const [hx, hy] = hb.at; if (!W.explored[(hy >> 2) * EW + (hx >> 2)]) continue; const [a, b2] = T2(hx, hy); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; const t = (k === 'lair' ? '🐉 ' : k === 'eyrie' ? '🎈 ' : '⚓ ') + hb.name; g.strokeText(t, a, b2 - 8); g.fillStyle = '#9ad8ff'; g.fillText(t, a, b2 - 8); }
    KR.R.drawQuestMarks(g, T2, s);
    for (const pp of Sys.Net.peers) {
      if ((pp.rm || 'main') !== (W.realm || 'main')) continue; const [a, b2] = T2(pp.x / 32, pp.y / 32);
      if (Sys.isMate && Sys.isMate(pp)) { g.fillStyle = Sys.GROUP_COL; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(a, b2, 5, 0, 6.28); g.fill(); g.stroke(); g.font = '700 12px "Alegreya Sans", sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeText(String(pp.n || '').slice(0, 16), a, b2 - 9); g.fillText(String(pp.n || '').slice(0, 16), a, b2 - 9); }
      else { g.fillStyle = '#fff'; g.beginPath(); g.arc(a, b2, 3, 0, 6.28); g.fill(); }
    }
    for (const m of p.mercs || []) { const [a, b2] = T2(m.x / 32, m.y / 32); g.fillStyle = '#9affb8'; g.beginPath(); g.arc(a, b2, 2.5, 0, 6.28); g.fill(); }
    const [px, py] = T2(p.x / 32, p.y / 32); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 5, 0, 6.28); g.fill(); g.stroke();
    g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(px, py, 2, 0, 6.28); g.fill();
    g.textAlign = 'left';
  };

  // ----- kingdom -----
  function renderKingdom(w) {
    const c = G.player.c, a = G.account, b = w.body;
    const K = KR.Kingdom; const myCt = a.cities[c.faction]; const need = K && K.needFor(c.faction);
    const works = K ? `<h4>The King's Works</h4><ol class="kq">${[1, 2, 3, 4].map((i) => { const B = K.BUILD[i]; const q = Sys.QUESTS[c.faction + '_build' + i]; const done = (myCt.built || 0) >= i || (q && c.quests.done[q.id]); const act = q && c.quests.active[q.id]; return `<li class="${done ? 'done' : act ? 'act' : ''}"><b>Level ${i + 1}: ${esc(B.name[c.faction])}</b> <span class="dim">${B.n} ${K.MATS[B.wood].pl} · ${B.n} ${K.MATS[B.stone].pl}</span> ${done ? '<span class="good">Built</span>' : act ? `<span class="gold">${esc(K.progText(q))}</span>` : ''}</li>`; }).join('')}</ol>` : '';
    b.innerHTML = `<p class="hint">A kingdom rises when it has <b>both</b> enough status and the timber and stone its king asked for. Earn status from bosses, named monsters and quests; gather wood and stone with your axe and pick. Slaying a rival king drops their kingdom a level.</p>${need ? `<p class="hint gold">Next: ${need.n} ${K.MATS[need.wood].pl} (you have ${K.have(c, need.wood)}) and ${need.n} ${K.MATS[need.stone].pl} (you have ${K.have(c, need.stone)}).</p>` : ''}${K ? `<p class="hint">Your materials: ${Object.keys(K.MATS).filter((m) => K.have(c, m) > 0).map((m) => `${K.have(c, m)} ${K.MATS[m].pl}`).join(', ') || 'none yet'}. Tools: ${K.TOOLS[K.tools(c).axe].name} axe, ${K.TOOLS[K.tools(c).pick].name} pick.</p>` : ''}` + D.FACTION_IDS.map((f) => {
      const F = D.FACTIONS[f], ct = a.cities[f]; const next = ct.level < 5 ? D.CITY_THRESHOLDS[ct.level] : null; const prev = D.CITY_THRESHOLDS[ct.level - 1] || 0;
      const frac = next ? (ct.status - prev) / (next - prev) : 1;
      return `<div class="kd ${f === c.faction ? 'mine' : ''}" style="--fc:${F.color}"><div class="kd-h"><b>${F.city}</b><span>${F.name}${f === c.faction ? ' · your kingdom' : ''}</span></div><div class="kd-lv">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= ct.level ? 'on' : ''}">${i}</i>`).join('')}</div><div class="bar st"><i style="width:${Math.min(100, frac * 100)}%"></i><span>${next ? `${ct.status} / ${next} status` : `${ct.status} status · max level`}</span></div>${f === c.faction && ct.level < 5 ? `<details class="kd-next"><summary>Next level brings…</summary><ul>${Sys.cityUpgrades(ct.level + 1).map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}${f === c.faction && ct.level > 1 ? `<details class="kd-next"><summary>What your kingdom has now</summary><ul>${[2, 3, 4, 5].filter((i) => i <= ct.level).flatMap((i) => Sys.cityUpgrades(i)).map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}</div>`;
    }).join('') + `${works}<h4>The Captain's Charges</h4><ol class="kq">${[0, 1, 2, 3, 4].map((i) => { const q = Sys.QUESTS[c.faction + '_king' + i]; const b2 = D.BOSS_BY_ID[q.boss]; const st = c.quests.done[q.id] ? 'done' : c.quests.active[q.id] ? 'act' : ''; return `<li class="${st}"><b>${esc(b2.name)}</b> <span class="dim">level ${b2.lv} · ${D.REGIONS[D.REGION_BY_ID[b2.region]].name}${b2.chamber ? ' · sealed lair' : ''}</span> ${st === 'done' ? '<span class="good">Slain</span>' : st === 'act' ? '<span class="gold">Active</span>' : ''}</li>`; }).join('')}</ol>`;
  }

  // ----- macros -----
  let macSel = null;
  function renderMacros(w) {
    const c = G.player.c, b = w.body; c.macros = c.macros || [];
    if (!macSel || !c.macros.find((m) => m.id === macSel)) macSel = c.macros[0] ? c.macros[0].id : null;
    b.innerHTML = `<div class="mac-list"></div><div class="mac-ed"></div>`;
    const list = $('.mac-list', b);
    c.macros.forEach((m) => { const el = h('button', 'mac-b' + (m.id === macSel ? ' sel' : ''), `<span class="ic">${esc(m.icon || '📜')}</span><small>${esc(m.name)}</small>`); el.onclick = () => { macSel = m.id; renderMacros(w); }; UI.draggable(el, { k: 'macro', id: m.id }, m.icon || '📜'); list.appendChild(el); });
    const nb = h('button', 'mac-b new', '<span class="ic">＋</span><small>New</small>'); nb.onclick = () => { if (c.macros.length >= 12) return; const id = 'm' + U.uid(); c.macros.push({ id, name: 'Macro', icon: '📜', lines: '/attack on' }); macSel = id; renderMacros(w); }; list.appendChild(nb);
    const m = c.macros.find((x) => x.id === macSel); const ed = $('.mac-ed', b);
    if (m) {
      ed.innerHTML = `<label>Name <input id="mac-n" maxlength="16" value="${esc(m.name)}"></label><label>Icon <input id="mac-i" maxlength="2" value="${esc(m.icon || '')}"></label><label>Commands, one per line<textarea id="mac-l" rows="6">${esc(m.lines)}</textarea></label><p class="hint">Drag the macro onto your hotbar. Examples: /attack on, /cast Fire Bolt, /use Kick, /pet attack, /target nearest, /pause 1, /say For the King!</p><div class="row"><button class="btn danger" id="mac-del">Delete</button></div>`;
      $('#mac-n', ed).oninput = (e) => { m.name = e.target.value; UI.renderBar(); }; $('#mac-i', ed).oninput = (e) => { m.icon = e.target.value; UI.renderBar(); }; $('#mac-l', ed).oninput = (e) => { m.lines = e.target.value; };
      $('#mac-del', ed).onclick = () => { c.macros = c.macros.filter((x) => x !== m); for (const k in c.bars) c.bars[k] = c.bars[k].map((a) => (a && a.k === 'macro' && a.id === m.id ? null : a)); renderMacros(w); UI.renderBar(); };
    }
  }

  // ----- menu -----
  function renderMenu(w) {
    const b = w.body; const a = G.account; const s = a.settings;
    b.innerHTML = `<div class="col"><button class="btn" id="mn-res">Resume</button><button class="btn" id="mn-save">Save game</button><button class="btn gold mn-exit" id="mn-exit" title="Saves your character and returns to character select">💾 Save &amp; Exit</button><button class="btn" id="mn-new">🏰 Main menu</button><button class="btn" id="mn-help">How to play</button>
      <div class="row"><span class="dim">Display</span><button class="btn small ${UI.isFullscreen() ? '' : 'gold'}" id="mn-win">Window mode</button><button class="btn small ${UI.isFullscreen() ? 'gold' : ''}" id="mn-fs">Full screen</button></div>
      <label class="slider">Hotbar size <input type="range" id="mn-hb" min="36" max="76" step="2" value="${LSget('kr_hb_size', 46)}"></label>
      <label class="check"><input type="checkbox" id="mn-afs" ${(() => { try { return localStorage.getItem('kr_auto_fs') !== '0'; } catch (e) { return true; } })() ? 'checked' : ''}> Go full screen when entering the world</label>
      <label class="check"><input type="checkbox" id="mn-mm" ${$('.hud-mini') && !$('.hud-mini').hidden ? 'checked' : ''}> Show minimap (Z)</label>
      <label class="slider">Hotbar layout <select id="mn-hbl"><option value="row">One row</option><option value="col">Column</option><option value="grid">Two rows</option></select></label>
      <div class="mn-panels"><span class="dim">Panels on screen</span>${[['tracker', 'Quest tracker'], ['target', 'Target'], ['pet', 'Pet'], ['mercs', 'Mercenaries'], ['group', 'Group']].map(([k, n]) => `<label class="check"><input type="checkbox" data-hud="${k}" ${UI.hudClosed(k) ? '' : 'checked'}> ${n}</label>`).join('')}<p class="dim small">Drag any panel by its ⠿ handle and lock it with 🔒. Windows lock from their title bar.</p></div>
      <button class="btn small" id="mn-reset">Reset all window and frame positions</button>
      <label class="slider">Music <input type="range" id="mn-mus" min="0" max="1" step="0.05" value="${s.music}"></label><label class="slider">Sound effects <input type="range" id="mn-sfx" min="0" max="1" step="0.05" value="${s.sfx}"></label>
      <label class="slider">Zoom <input type="range" id="mn-zoom" min="0.7" max="1.6" step="0.05" value="${KR.R.cam.zoom}"></label>
      <label class="check"><input type="checkbox" id="mn-al" ${G.ui_autoloot ? 'checked' : ''}> Auto-loot items from corpses</label>
      <label class="check"><input type="checkbox" id="mn-tips" ${G.player && G.player.c.tipsOn !== false ? 'checked' : ''}> Show tips</label> <button class="btn small" id="mn-tipsre">Show all tips again</button>
      <p class="dim small">${Sys.Store.db ? 'Saves follow your Claude account.' : 'Saves are kept in this browser.'} ${Sys.Net.ok ? `Multiplayer: ${Sys.Net.peers.length} other player${Sys.Net.peers.length === 1 ? '' : 's'} here.` : ''} Last saved ${G.lastSave ? new Date(G.lastSave).toLocaleTimeString() : 'never'}.</p><button class="btn gold mn-exit" id="mn-exit2">💾 Save &amp; Exit</button></div>`;
    $('#mn-res', b).onclick = () => UI.close('menu');
    $('#mn-save', b).onclick = () => { Sys.save(true); UI.toast('Game saved'); renderMenu(w); };
    $('#mn-exit', b).onclick = () => KR.Main.exitToMenu(); $('#mn-exit2', b).onclick = () => KR.Main.exitToMenu();
    $('#mn-help', b).onclick = () => UI.open('help');
    $('#mn-new', b).onclick = () => KR.Main.exitToMenu();
    $('#mn-win', b).onclick = () => { UI.toggleFullscreen(false); setTimeout(() => renderMenu(w), 300); };
    $('#mn-fs', b).onclick = () => { UI.toggleFullscreen(true); setTimeout(() => renderMenu(w), 300); };
    $('#mn-hb', b).oninput = (e) => { LSset('kr_hb_size', +e.target.value); UI.applyHotbarSize(); };
    $('#mn-mm', b).onchange = (e) => UI.toggleMinimap(e.target.checked);
    $('#mn-afs', b).onchange = (e) => { try { localStorage.setItem('kr_auto_fs', e.target.checked ? '1' : '0'); } catch (er) {} };
    $('#mn-reset', b).onclick = () => UI.resetLayout();
    const hbl = $('#mn-hbl', b); hbl.value = LSget('kr_hb_layout', 'row'); hbl.onchange = () => { LSset('kr_hb_layout', hbl.value); UI.applyHotbarSize(); };
    b.querySelectorAll('[data-hud]').forEach((cb) => (cb.onchange = () => UI.setHudClosed(cb.dataset.hud, !cb.checked)));
    $('#mn-mus', b).oninput = (e) => { s.music = +e.target.value; KR.A.setVolumes(s.music, s.sfx); };
    $('#mn-sfx', b).oninput = (e) => { s.sfx = +e.target.value; KR.A.setVolumes(s.music, s.sfx); };
    $('#mn-zoom', b).oninput = (e) => { KR.R.cam.zoom = +e.target.value; LSset('kr_zoom', KR.R.cam.zoom); };
    $('#mn-al', b).onchange = (e) => { G.ui_autoloot = e.target.checked; LSset('kr_autoloot', G.ui_autoloot); };
    $('#mn-tips', b).onchange = (e) => KR.Tips && KR.Tips.setOn(e.target.checked);
    $('#mn-tipsre', b).onclick = () => { if (KR.Tips) { KR.Tips.resetSeen(); UI.toast && UI.toast('Tips reset', 'You will see every tip again as it becomes useful.'); renderMenu(w); } };
  }
  function renderHelp(w) {
    w.body.innerHTML = `<div class="help"><h4>Moving and fighting</h4><ul><li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move. Click the ground to walk there.</li><li><kbd>Tab</kbd> targets the nearest enemy. Click anything to target it.</li><li><kbd>Q</kbd> toggles auto attack. Combat is real time, like the old classics.</li><li><kbd>1</kbd>–<kbd>8</kbd> use hotbar slots. You start with 3; more open at 10, 20, 30, 40 and 50.</li><li><kbd>R</kbd> cycles melee, ranged or both when you carry a bow, thrown weapon or tome.</li><li><kbd>X</kbd> sits to regain health and mana faster. <kbd>E</kbd> talks, loots and opens doors.</li></ul>
      <h4>Windows</h4><ul><li><kbd>I</kbd> inventory · <kbd>C</kbd> character · <kbd>P</kbd> spellbook · <kbd>K</kbd> abilities · <kbd>J</kbd> journal · <kbd>M</kbd> map · <kbd>N</kbd> kingdoms · <kbd>U</kbd> macros · <kbd>Y</kbd> mercenaries · <kbd>G</kbd> group · <kbd>Z</kbd> minimap · <kbd>F</kbd> full screen · <kbd>Esc</kbd> settings, Save &amp; Exit</li><li>Drag items from your bag onto a gear slot to equip them, and drag gear back to your bag to take it off.</li><li>Drag a window by its title, drag its corner to resize, and use – to shrink it. Frames on the screen move with their ⠿ handle. Positions are remembered.</li></ul><h4>Mercenaries</h4><ul><li>Hire them from the Mercenary Trader in your kingdom plaza. You can lead one mercenary per kingdom level (five at kingdom level 5). They always match your level.</li><li>Open Mercenaries (Y) to change their stance, gear and which abilities they use.</li></ul>
      <h4>Grouping</h4><ul><li>Open Group (G) to see everyone online: their level, class, kingdom and zone. Filter by Looking for Group, near your level, or your zone, then click Invite.</li><li>Groups hold up to 6. Members nearby split experience from kills with a 20% bonus per extra member.</li><li>Group spells and bard songs reach everyone in your group within range. Type /g to talk to your group.</li></ul><h4>Growing</h4><ul><li>Stats come only from gear: weapons, armor, jewelry, capes and belts. Levels raise health, mana and endurance.</li><li>Buy more bag space from the Outfitter in your kingdom plaza: 8 slots per kingdom level.</li><li>The Isle of Tidesong, Skyreach Summit and every cave and dungeon are separate zones. Ferries sail from the Sunscour Docks; slay Ignaroth in Dragonfall Crags and his captive dragon flies you to the Summit. Walk into a cave mouth to zone in.</li><li>Weapon skills rise one point at a time as you fight and unlock 10 techniques per weapon type. Every class also earns 10 passive abilities by level 45.</li><li>Spells and songs cost coin to learn from your guildmaster. Buffs of the same kind do not stack: the strongest one wins. Each school of magic trains with use.</li><li>Health, mana and endurance regenerate slowly; the rate per second shows on each bar. Sit, eat, drink, or wear gear with regeneration to recover faster.</li><li>Con colors: gray and green are trivial, blue is fair, white even, yellow tough, red deadly.</li></ul>
      <h4>Your kingdom</h4><ul><li>Your king asks for timber and stone for each new kingdom level. Bosses, named monsters and quests earn status. A kingdom rises when it has both.</li><li>Status raises your kingdom from level 1 to 5. New merchants bring better gear and materials.</li><li>Other kingdoms' guards attack you on sight. Killing their king drops their kingdom a level.</li><li>The bank is shared by all your characters.</li></ul></div>`;
  }

  // ----- NPC dialog -----
  let curNPC = null;
  UI.openNPC = function (e) { curNPC = e; UI.open('npc'); };
  function renderNPC(w) {
    const e = curNPC; if (!e) return; const c = G.player.c; const b = w.body;
    w.title.textContent = e.name;
    const qs = Sys.questsFor(e);
    const greet = e.greetFn ? e.greetFn() : e.role === 'king' ? `Welcome, ${c.name}. ${D.FACTIONS[c.faction].city} stands at Kingdom Level ${Sys.cityLevel(c.faction)}. Bring glory to our people.` : e.role === 'outpost' ? 'Welcome to the Wayfarer\'s Rest. All are welcome here, whatever banner they serve.' : Sys.npcLine(e) || 'Hello.';
    b.innerHTML = `<div class="npc-h"><canvas width="70" height="84"></canvas><div><b>${esc(e.name)}</b>${e.title ? `<div class="dim">${esc(e.title)}</div>` : ''}<p class="say">"${esc(greet)}"</p></div></div><div class="npc-q"></div><div class="npc-s row"></div>`;
    UI.drawPortrait($('canvas', b), e.look, 0, e);
    if (e.city === c.faction && (e.type === 'npc' || e.type === 'king') && Sys.advice) {
      const adv = h('div', 'npc-advice'); b.insertBefore(adv, $('.npc-q', b));
      const ab = h('button', 'btn small', '💬 What should I do next?'); ab.onclick = () => { const tips = Sys.advice().slice(0, 4); adv.innerHTML = `<b>${esc(e.name)}'s advice</b><ul>${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`; KR.A.sfx('click'); }; adv.appendChild(ab);
    }
    const qd = $('.npc-q', b);
    qs.ready.forEach((q) => { const d = h('div', 'qbox ready', `<b>? ${esc(q.title)}</b><p>${q.type === 'deliver' ? 'Ah, the delivery! Thank you.' : 'You have done it! Here is your reward.'}</p>`); const bt = h('button', 'btn gold', 'Complete quest'); bt.onclick = () => { Sys.turnIn(q); renderNPC(w); }; d.appendChild(bt); qd.appendChild(d); });
    qs.avail.forEach((q) => { const d = h('div', 'qbox', `<b>! ${esc(q.title)}</b> <span class="dim">level ${q.bossLv || q.lv}</span><p>${esc(q.text)}</p><p class="dim small">Reward: ${G.fmtCoins(q.reward.coin)}${q.reward.status ? ` · <span class="gold">+${q.reward.status} status</span>` : ''}${q.reward.item ? ' · an item' : ''}</p>`); const bt = h('button', 'btn', 'Accept'); bt.onclick = () => { Sys.acceptQuest(q); renderNPC(w); }; d.appendChild(bt); qd.appendChild(d); });
    qs.active.forEach((q) => qd.appendChild(h('div', 'qbox act', `<b>${esc(q.title)}</b><p class="dim">${questProgText(q)}</p>`)));
    const sv = $('.npc-s', b);
    const add = (label, fn) => { const bt = h('button', 'btn', label); bt.onclick = fn; sv.appendChild(bt); };
    for (const s of e.services || []) {
      const crS = (e.services || []).find((x) => x.startsWith('craft:'));
      if (s.startsWith('vendor:') && crS) continue; // crafters trade from their crafting window
      if (s.startsWith('vendor:')) add('Browse wares', () => { UI.openVendor(e, s.split(':')[1]); });
      if (s === 'bank') add('Open bank', () => { UI.close('npc'); UI.open('bank'); UI.open('inv'); });
      if (s === 'train') add('Learn spells', () => { UI.close('npc'); UI.open('trainer'); });
      if (s.startsWith('craft:')) { const vs = (e.services || []).find((x) => x.startsWith('vendor:')); add(vs ? `${D.CRAFTS[s.split(':')[1]].name} & trade` : D.CRAFTS[s.split(':')[1]].name, () => { UI.openCraft(s.split(':')[1], vs ? e : null, vs ? vs.split(':')[1] : null); }); if (vs) add('Buy & sell', () => { UI.openCraft(s.split(':')[1], e, vs.split(':')[1], 'shop'); }); }
      if (s === 'bind') add('Rent a room (bind here)', () => { Sys.bind(); });
      if (s === 'kingdom') add('Kingdom report', () => UI.open('kingdom'));
      if (s === 'mercs') add('Hire mercenaries', () => { UI.close('npc'); UI.open('mtrader'); });
      if (UI.extraService) UI.extraService(e, s, add);
    }
    if (UI.extraButtons) UI.extraButtons(e, add, w);
    add('Goodbye', () => UI.close('npc'));
  }

  // ----- vendor -----
  let vend = { npc: null, kind: null, stock: [] };
  UI.openVendor = function (npc, kind) { vend = { npc, kind, stock: Sys.vendorStock(kind, npc) }; UI.close('npc'); UI.open('vendor'); KR.Main.setMusicOverride(kind === 'inn' || kind === 'outpost' ? 'inn' : 'shop'); };
  // ----- quantity picker for stackable goods -----
  UI.sellItem = (it) => { if ((it.qty || 1) > 1) UI.qtyPicker(it, 'sell'); else Sys.sell(it); };
  UI.qtyPicker = function (it, mode) {
    document.querySelectorAll('.qty-modal').forEach((x) => x.remove());
    const c = G.player.c; const unit = G.itemPrice(it, mode === 'sell');
    const free = c.inv.filter((x) => !x).length + (c.inv.some((x) => x && x.stack && x.name === it.name && (x.qty || 1) < 99) ? 1 : 0);
    const max = mode === 'sell' ? (it.qty || 1) : Math.max(0, Math.min(99 * Math.max(1, free), Math.floor(c.coins / unit), 99));
    if (max < 1) { G.log(mode === 'buy' ? (c.coins < unit ? "You can't afford that." : 'Your bags are full!') : 'Nothing to sell.', 'sys', '#ff8a6a'); KR.A.sfx('fail', 0.5); return; }
    let n = mode === 'sell' ? max : 1;
    const ov = h('div', 'modal qty-modal', `<div class="modal-b qty"><div class="qty-h"><span class="ic">${UI.icHTML(it)}</span><b>${esc(it.name)}</b></div>
      <p class="dim">${mode === 'buy' ? 'How many do you want to buy?' : `You have ${it.qty}. How many do you want to sell?`}</p>
      <div class="qty-row"><button class="btn small" data-d="-1">−</button><input type="range" min="1" max="${max}" value="${n}"><button class="btn small" data-d="1">+</button><input type="number" min="1" max="${max}" value="${n}"></div>
      <div class="qty-row q2"><button class="btn tiny" data-s="1">1</button><button class="btn tiny" data-s="5">5</button><button class="btn tiny" data-s="10">10</button><button class="btn tiny" data-s="20">20</button><button class="btn tiny" data-s="${max}">Max (${max})</button></div>
      <p class="qty-total">${G.fmtCoins(unit)} each · <b class="tot"></b></p>
      <div class="row"><button class="btn gold" id="qty-ok">${mode === 'buy' ? 'Buy' : 'Sell'}</button><button class="btn" id="qty-no">Cancel</button></div></div>`);
    document.body.appendChild(ov);
    const rng = ov.querySelector('input[type=range]'), num = ov.querySelector('input[type=number]'), tot = ov.querySelector('.tot');
    const set = (v) => { n = U.clamp(Math.round(+v || 1), 1, max); rng.value = n; num.value = n; tot.textContent = `${mode === 'buy' ? 'Total' : 'You get'} ${G.fmtCoins(unit * n)}`; };
    set(n);
    rng.oninput = () => set(rng.value); num.oninput = () => set(num.value);
    ov.querySelectorAll('[data-d]').forEach((b2) => (b2.onclick = () => set(n + +b2.dataset.d)));
    ov.querySelectorAll('[data-s]').forEach((b2) => (b2.onclick = () => set(+b2.dataset.s)));
    const done = () => ov.remove();
    ov.querySelector('#qty-ok').onclick = () => { if (mode === 'buy') Sys.buy(it, n); else Sys.sell(it, n); done(); };
    ov.querySelector('#qty-no').onclick = done; ov.onclick = (e) => { if (e.target === ov) done(); };
    num.onkeydown = (e) => { if (e.key === 'Enter') ov.querySelector('#qty-ok').click(); if (e.key === 'Escape') done(); };
    rng.focus();
  };
  function renderVendor(w) {
    const c = G.player.c, b = w.body; if (!vend.npc) return;
    w.title.textContent = `${vend.npc.name} · ${vend.npc.title || 'Merchant'}`;
    const lvl = vend.npc.city ? Sys.cityLevel(vend.npc.city) : 1;
    b.innerHTML = `<div class="vd"><div class="vd-l"><h4>For sale <small class="dim">${vend.npc.city ? `Kingdom level ${lvl} stock` : ''}</small></h4><div class="vlist"></div></div><div class="vd-r"><h4>Your bag <span class="coins">${G.fmtCoins(c.coins)}</span></h4><div class="grid"></div><p class="hint">Click an item in your bag to sell it.</p>${Sys.buyback && Sys.buyback.length ? '<h4>Buy back</h4><div class="grid bb"></div>' : ''}</div></div>`;
    const list = $('.vlist', b);
    vend.stock.forEach((it) => {
      const can = ['weapon', 'armor', 'jewel'].includes(it.kind) ? G.canUse(c, it) : { ok: true };
      const row = h('button', 'vrow' + (can.ok ? '' : ' nouse'), `<span class="ic">${UI.icHTML(it)}</span><span class="vn">${esc(it.name)}<small class="dim">${it.kind === 'weapon' ? D.WEAPON_TYPES[it.wt].name + ' · ' + it.dmg + '/' + it.delay.toFixed(1) : it.kind === 'armor' ? (it.shield ? 'Shield' : it.ak + ' ' + it.slot) + ' · AC ' + it.ac : it.kind === 'mat' ? 'Material tier ' + (it.tier + 1) : it.kind === 'jewel' ? D.SLOT_NAMES[it.slot] : ''}${it.req > 1 ? ' · L' + it.req : ''}</small></span><span class="vp">${G.fmtCoins(G.itemPrice(it))}</span>`);
      UI.bindTip(row, () => UI.itemTip(it, 'buy') + (it.stack ? '<div class="dim">Click to choose how many</div>' : ''));
      row.onclick = () => { if (it.stack) UI.qtyPicker(it, 'buy'); else Sys.buy(it, 1); };
      list.appendChild(row);
    });
    const grid = $('.vd-r .grid', b); c.inv.forEach((it) => grid.appendChild(itemCell(it, (x) => { UI.sellItem(x); })));
    const bb = $('.bb', b); if (bb) Sys.buyback.forEach((it) => bb.appendChild(itemCell(it, (x) => { const price = G.itemPrice(x, true) * (x.qty || 1); if (c.coins < price) return; if (Sys.addItem(x, true)) { c.coins -= price; Sys.buyback.splice(Sys.buyback.indexOf(x), 1); UI.refresh(); } })));
  }

  // ----- trainer -----
  function renderTrainer(w) {
    const c = G.player.c, b = w.body; const sp = Sys.trainable();
    if (!sp.length) { b.innerHTML = `<p class="empty-note">"Your path is the blade, not the book. Train your weapons in battle and your class skills will come with experience."</p>`; return; }
    b.innerHTML = `<p class="hint">You have <b>${G.fmtCoins(c.coins)}</b>. Every ${D.CLASSES[c.cls].name === 'Bard' ? 'song' : 'spell'} costs coin to learn, and higher ranks cost more. ${sp.filter((s) => s.target === 'group').length ? '<span style="color:#9affb8">Group</span> spells affect everyone in your group nearby.' : ''}</p><div class="list"></div>`;
    const list = $('.list', b);
    sp.forEach((s) => {
      const known = c.spells.includes(s.id); const can = s.level <= c.level;
      const row = h('div', 'row-item' + (known ? ' known' : can ? '' : ' locked'), `<span class="ic">${esc(s.icon)}</span><div class="ri-m"><b>${esc(s.name)}</b><small>Level ${s.level} · ${esc(s.school)} · ${s.mana} mana${s.target === 'group' ? ' · <span style="color:#9affb8">Group</span>' : ''}${!known ? ` · <span style="color:${c.coins >= s.price ? '#e8d48a' : '#ff8a6a'}">${G.fmtCoins(s.price)}</span>` : ''}</small><small class="dim">${esc(s.desc)}</small></div>`);
      if (!known && can) { const bt = h('button', 'btn small', `Learn · ${G.fmtCoins(s.price)}`); if (c.coins < s.price) { bt.disabled = true; bt.title = 'Not enough coin'; } bt.onclick = () => { Sys.learnSpell(s); }; row.appendChild(bt); }
      else if (known) row.appendChild(h('span', 'pill', 'Known'));
      list.appendChild(row);
    });
  }

  // ----- bank -----
  function renderBank(w) {
    const c = G.player.c, a = G.account, b = w.body;
    b.innerHTML = `<div class="vd"><div class="vd-l"><h4>Shared bank <span class="coins">${G.fmtCoins(a.bank.coins)}</span></h4><div class="grid bank"></div><div class="row"><button class="btn small" id="bk-d">Deposit all coins</button><button class="btn small" id="bk-w">Withdraw all coins</button></div><p class="hint">Every character you create shares this bank.</p></div><div class="vd-r"><h4>Your bag <span class="coins">${G.fmtCoins(c.coins)}</span></h4><div class="grid inv"></div><p class="hint">Click to deposit.</p></div></div>`;
    const bg = $('.grid.bank', b); a.bank.items.forEach((it) => bg.appendChild(itemCell(it, (x) => Sys.withdraw(x))));
    const ig = $('.grid.inv', b); c.inv.forEach((it) => ig.appendChild(itemCell(it, (x) => Sys.deposit(x))));
    $('#bk-d', b).onclick = () => Sys.depositCoins(c.coins); $('#bk-w', b).onclick = () => Sys.withdrawCoins(a.bank.coins);
  }

  // ----- crafting -----
  let cr = { craft: 'smithing', tier: 0, tab: 'craft', npc: null, vk: null };
  UI.openCraft = function (craft, npc, vk, tab) { cr.craft = craft; cr.npc = npc || null; cr.vk = vk || null; if (tab) cr.tab = tab; else if (cr.tab === 'shop' && !cr.vk) cr.tab = 'craft'; if (cr.vk) vend = { npc, kind: vk, stock: Sys.vendorStock(vk, npc) }; UI.close('npc'); UI.close('vendor'); UI.open('craft'); if (cr.tab === 'shop') { UI.open('inv'); KR.Main.setMusicOverride('shop'); } };
  UI.craftShopOpen = () => UI.isOpen('craft') && cr.tab === 'shop' && !!cr.vk;
  function renderCraft(w) {
    const c = G.player.c, b = w.body; const sk = c.craft[cr.craft] || 0; const C = D.CRAFTS[cr.craft];
    w.title.textContent = C.name;
    if (cr.tab === 'shop' && !cr.vk) cr.tab = 'craft';
    b.innerHTML = `<div class="tabs"><button class="tab ${cr.tab === 'craft' ? 'on' : ''}" data-t="craft">Craft</button><button class="tab ${cr.tab === 'up' ? 'on' : ''}" data-t="up">Upgrade</button>${cr.vk ? `<button class="tab ${cr.tab === 'shop' ? 'on' : ''}" data-t="shop">Buy & sell</button>` : ''}<span class="sk inline">${C.name} ${skillBar(sk, 250)}</span></div><div class="pane"></div>`;
    b.querySelectorAll('.tabs > .tab').forEach((t) => (t.onclick = () => { cr.tab = t.dataset.t; if (cr.tab === 'shop') { UI.open('inv'); KR.Main.setMusicOverride('shop'); } else KR.Main.setMusicOverride(null); renderCraft(w); }));
    const pane = $('.pane', b);
    if (cr.tab === 'shop') { w.title.textContent = `${C.name} · ${cr.npc ? cr.npc.name : ''}`; renderVendor({ body: pane, title: { set textContent(v) {} } }); return; }
    if (cr.tab === 'craft') {
      pane.appendChild(h('div', 'tiers', [0, 1, 2, 3, 4, 5].map((t) => `<button class="tab ${t === cr.tier ? 'on' : ''}" data-t="${t}">Tier ${t + 1}</button>`).join('')));
      pane.querySelectorAll('.tiers .tab').forEach((t) => (t.onclick = () => { cr.tier = +t.dataset.t; renderCraft(w); }));
      pane.appendChild(h('p', 'hint', `${D.FACTIONS[c.faction].craftPrefix} gear is unique to ${D.FACTIONS[c.faction].city}: stronger than shop gear, with ${D.FACTIONS[c.faction].craftBias.join(' and ')} bonuses. Tier ${cr.tier + 1} needs skill ${cr.tier * 45}. Materials drop from monsters and are sold by merchants as your kingdom grows.`));
      const list = h('div', 'list'); pane.appendChild(list);
      const recs = Sys.recipes(cr.craft, cr.tier);
      const groups = [['Signature pieces', recs.filter((r) => r.sig)], ['Armor', recs.filter((r) => !r.sig && (r.kind === 'armor' || r.kind === 'shield'))], ['Weapons', recs.filter((r) => !r.sig && r.kind === 'weapon')], ['Jewelry', recs.filter((r) => !r.sig && r.kind === 'jewel')]];
      for (const [gname, rs] of groups) {
        if (!rs.length) continue;
        list.appendChild(h('h4', null, gname + (gname === 'Signature pieces' ? ' <small class="dim">rare, much stronger</small>' : '')));
        rs.forEach((r) => {
          const has = Sys.hasMats(r.mats); const pv = Sys.craftPreview(r);
          const mats = r.mats.map(([m, t, q]) => { const n = Sys.countItem(D.MATERIALS[m][t]); return `<span class="${n >= q ? 'good' : 'bad'}">${D.MAT_ICON[m]} ${D.MATERIALS[m][t]} ${n}/${q}</span>`; }).join(' ');
          const label = r.kind === 'armor' ? `${r.ak[0].toUpperCase() + r.ak.slice(1)} ${D.SLOT_NAMES[r.slot]}` : r.kind === 'weapon' ? D.WEAPON_TYPES[r.wt].name : r.kind === 'shield' ? 'Shield' : D.SLOT_NAMES[r.slot];
          const key = pv.kind === 'weapon' ? `${Math.round(pv.dmg)} dmg / ${pv.delay.toFixed(1)}s` : pv.ac ? `${pv.ac} AC` : '';
          const st = Object.entries(pv.stats).map(([k, v]) => `+${v} ${k}`).concat(pv.hp ? [`+${pv.hp} HP`] : [], pv.mana ? [`+${pv.mana} Mana`] : []).join(' ');
          const can = G.canUse(c, pv).ok;
          const row = h('div', 'row-item craft-r' + (r.sig ? ' sig' : '') + (sk + 20 < r.req ? ' locked' : ''), `<span class="ic">${UI.icHTML(pv)}</span><div class="ri-m"><b>${esc(r.name)}</b><small>${esc(label)} · <span class="tt-st">${key}</span> ${st ? '· ' + st : ''}${can ? '' : ' · <span class="bad">not for your class</span>'}</small><small>${mats} · fee ${G.fmtCoins(r.cost)} · skill ${r.req}</small></div>`);
          UI.bindTip(row, () => UI.itemTip(pv, 'craft') + '<div class="dim">Preview of a typical result. Higher skill makes slightly better pieces.</div>' + r.mats.map(([m, t, q]) => `<div class="tt-sec"><b>${D.MAT_ICON[m]} ${D.MATERIALS[m][t]} ×${q}</b> (you have ${Sys.countItem(D.MATERIALS[m][t])})</div>` + UI.matSourceHTML(m, t)).join(''));
          const bt = h('button', 'btn small', 'Craft'); bt.disabled = !has || sk + 20 < r.req; bt.onclick = () => { Sys.craft(r); renderCraft(w); };
          row.appendChild(bt); list.appendChild(row);
        });
      }
    } else {
      pane.appendChild(h('p', 'hint', 'Upgrade gear up to +5. Each level adds 10% to all of its stats. Failure only loses the materials.'));
      const list = h('div', 'list'); pane.appendChild(list);
      const items = D.EQUIP_SLOTS.map((s) => c.equip[s]).concat(c.inv).filter((it) => it && Sys.craftOf(it) === cr.craft);
      if (!items.length) list.appendChild(h('p', 'empty-note', `You have nothing that ${C.name} can improve.`));
      items.forEach((it) => {
        const u = Sys.upgradeInfo(it);
        const row = h('div', 'row-item', `<span class="ic">${UI.icHTML(it)}</span><div class="ri-m"><b>${esc(it.name)}</b>${u.max ? '<small class="good">Fully upgraded</small>' : `<small>To +${(it.up || 0) + 1}: skill ${u.req} · ${Math.round(u.chance * 100)}% chance · fee ${G.fmtCoins(u.cost)}</small><small>${u.mats.map(([m, t, q]) => { const n = Sys.countItem(D.MATERIALS[m][t]); return `<span class="${n >= q ? 'good' : 'bad'}">${D.MAT_ICON[m]} ${D.MATERIALS[m][t]} ${n}/${q}</span>`; }).join(' ')}</small>`}</div>`);
        UI.bindTip(row, () => UI.itemTip(it, 'equip'));
        if (!u.max) { const bt = h('button', 'btn small', 'Upgrade'); bt.disabled = !Sys.hasMats(u.mats); bt.onclick = () => { Sys.upgrade(it); renderCraft(w); }; row.appendChild(bt); }
        list.appendChild(row);
      });
    }
  }

  // ----- loot -----
  let lootE = null;
  UI.openLoot = function (e) { lootE = e; UI.open('loot'); };
  function renderLoot(w) {
    const e = lootE; const b = w.body; if (!e || !e.loot) { UI.close('loot'); return; }
    w.title.textContent = `${e.name}'s corpse`;
    if (!e.loot.items.length) { b.innerHTML = '<p class="empty-note">Nothing left.</p>'; setTimeout(() => UI.close('loot'), 600); return; }
    b.innerHTML = '<div class="list"></div><div class="row"><button class="btn" id="lt-all">Take all</button></div>';
    const list = $('.list', b);
    e.loot.items.forEach((it) => { const row = h('button', 'vrow', `<span class="ic">${UI.icHTML(it)}</span><span class="vn">${esc(it.name)}${it.qty > 1 ? ' ×' + it.qty : ''}</span>`); UI.bindTip(row, () => UI.itemTip(it)); row.onclick = () => { if (Sys.addItem(it)) { e.loot.items.splice(e.loot.items.indexOf(it), 1); renderLoot(w); } }; list.appendChild(row); });
    $('#lt-all', b).onclick = () => { Sys.lootAll(e); renderLoot(w); };
  }

  // ----- death -----
  UI.showDeath = function (loss) {
    const ov = h('div', 'modal death', `<div class="modal-b"><h2>You have died</h2><p>${loss ? `You lost ${loss} experience. ` : ''}Your spirit can return to your bind point.</p><button class="btn gold" id="dt-r">Return to bind point</button></div>`);
    document.body.appendChild(ov); $('#dt-r', ov).onclick = () => { ov.remove(); Sys.respawn(); }; $('#dt-r', ov).focus();
  };
})();
