// Kingdom Battles: resource bar, command menu (B), respawn countdown and the end-of-match screen.
import { G } from './state.js';
import { S } from './audio.js';
import { CLASSES, ARMOR_SLOT_LIST, ITEMS } from './data.js';
import * as Game from './game.js';
import * as UI from './ui.js';
import { B, myTown, res, canPay, pop, popCap, available, hire, upgradeTown, upgradeTower, repairTower, sendAttack, recall, setFollow, directionOf, bank } from './battle.js';
import { TEAM_COLORS, TOWN_LEVELS, TOWER_LEVELS, TOWER_REPAIR, ARMORY, ECON, rosterOf, DIFFS } from './battledata.js';
import { SETUP, SETUP_KEY, LAYOUT } from './battlemap.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const RES_ICON = { gold: '🪙', wood: '🪵', stone: '🪨' };
const costHtml = (c, t) => Object.entries(c).map(([k, v]) => `<span class="bc ${res(t, k) >= v ? '' : 'no'}">${RES_ICON[k]} ${v}</span>`).join(' ');
const ROLE = { melee: '⚔ Melee', ranged: '🏹 Ranged', healer: '✚ Healer', worker: '⛏ Worker' };
let opts = {}, tab = 'army', bar = null, deathT = 0, menuT = 0;

export function init(o) {
  opts = o;
  bar = el('div', 'bres'); $('hud').appendChild(bar);
  const d = el('div', 'bdeath'); d.id = 'bdeath'; d.hidden = true; document.body.appendChild(d);
  addEventListener('keydown', (e) => {
    if (e.repeat || e.target.tagName === 'INPUT' || B.over) return;
    if (e.code === 'KeyB') { if (UI.UI.open === 'battle') UI.closeWin(); else if (!G.uiOpen || UI.UI.open) openMenu(); }
  });
  $('death').style.display = 'none'; $('tracker').style.display = 'none';
  // the world map (M) shows towns, towers, camps, resources and every army
  G.battleMapDraw = (g, P, k, lbl, icon) => {
    for (const c of LAYOUT.camps) icon(c.x, c.z, c.tier === 2 ? '☠' : '⛺', c.tier === 2 ? '#ff6060' : c.tier ? '#ffb070' : '#9cdc5a', c.tier === 2 ? 20 : 15);
    for (const [x, z] of LAYOUT.gold) icon(x, z, '◆', '#ffd84a', 13);
    for (const [x, z] of LAYOUT.stone) icon(x, z, '■', '#c8c0b0', 12);
    for (const u of B.units) if (!u.dead) { const [px, pz] = P(u.pos.x, u.pos.z); g.fillStyle = TEAM_COLORS[u.team]; g.beginPath(); g.arc(px, pz, (u.hero ? 6 : 3.2) * k, 0, 7); g.fill(); if (u.hero) { g.lineWidth = 2 * k; g.strokeStyle = '#fff'; g.stroke(); } }
    for (const t of B.towns) {
      const [px, pz] = P(t.x, t.z); g.globalAlpha = t.dead ? 0.35 : 1;
      g.beginPath(); g.arc(px, pz, 22 * k, 0, 7); g.fillStyle = t.color + '55'; g.fill(); g.lineWidth = 4 * k; g.strokeStyle = t.color; g.stroke();
      icon(t.x, t.z, t.dead ? '✕' : '♜', t.color, 26);
      for (const s of t.towers) icon(s.pos.x, s.pos.z, s.dead ? '✕' : '▲', t.color, 13);
      lbl(`${t.name}${t.isMe ? ' (you)' : ''}`, t.x, t.z + (t.z > 0 ? 38 : -38), 17, '#fff'); g.globalAlpha = 1;
    }
  };
  G.battleMapSide = (side) => {
    side.innerHTML = '<h3>Kingdoms</h3>';
    for (const t of B.towns) side.insertAdjacentHTML('beforeend', `<div class="mq" style="border-color:${t.color}"><div class="mqh"><i style="background:${t.color}"></i><b>${t.name}${t.isMe ? ' (you)' : ''}</b>${t.dead ? '<span class="rdy" style="color:#ff7a6a">Fallen</span>' : ''}</div><div class="mqo">${t.race === 'highelf' ? 'High Elf' : t.race === 'woodelf' ? 'Wood Elf' : t.race[0].toUpperCase() + t.race.slice(1)} · ${TOWN_LEVELS[t.level].name} · Hall ${Math.round(t.hall.hp / t.hall.maxHp * 100)}%</div><div class="mqo">${t.units.filter(u => !u.dead && !u.worker && !u.hero).length} troops · ${t.towers.filter(s => !s.dead).length}/2 towers</div></div>`);
    side.insertAdjacentHTML('beforeend', '<h3>Legend</h3><div class="legend"><div><b>♜</b> Town and Hall</div><div><b>▲</b> Archer tower</div><div><b style="color:#9cdc5a">⛺</b> Neutral camp (gold & XP)</div><div><b style="color:#ff6060">☠</b> Dangerous camp</div><div><b style="color:#ffd84a">◆</b> Gold vein · <b style="color:#c8c0b0">■</b> Stone quarry</div><div><b>●</b> Troops in team colours</div></div><p class="dim">M or Esc closes.</p>');
  };
}

// ---------- top bar ----------
function drawBar() {
  const t = myTown(); if (!t || !bar) return;
  const L = TOWN_LEVELS[t.level];
  bar.innerHTML = `<div><b>🪙</b>${Math.floor(res(t, 'gold'))}</div><div><b>🪵</b>${Math.floor(res(t, 'wood'))}</div><div><b>🪨</b>${Math.floor(res(t, 'stone'))}</div>`
    + `<div title="Army size"><b>⚔</b>${pop(t)}/${popCap(t)}</div><div title="Match time"><b>⏱</b>${fmtT(B.time)}</div>`
    + `<div class="bhall" title="Your town hall"><i style="width:${(t.hall.hp / t.hall.maxHp * 100).toFixed(0)}%"></i><span>${t.name} · ${L.name}${t.building ? ' · building ' + Math.ceil(t.building.dur - t.building.t) + 's' : ''}</span></div>`
    + `<div class="bkey">B · Command</div>`;
}
export function update(dt) {
  menuT -= dt; if (menuT <= 0) { menuT = 0.25; drawBar(); zoneLabel(); if (UI.UI.open === 'battle') render(); }
  if (deathT > 0) { deathT -= dt; const d = $('bdeath'); d.innerHTML = `<div><h2>You have fallen</h2><p>Your troops fight on. Back in <b>${Math.ceil(deathT)}</b>…</p></div>`; if (deathT <= 0) { d.hidden = true; opts.respawn && opts.respawn(); } }
}
function zoneLabel() {
  const p = G.player; if (!p) return; let best = null, bd = 1e9;
  for (const t of B.towns) { const d = Math.hypot(p.pos.x - t.x, p.pos.z - t.z); if (d < bd) { bd = d; best = t; } }
  const where = bd < 50 ? best.name : bd < 140 ? `Near ${best.name}` : 'The Wilds';
  G.zoneLabel = `${where}<small style="color:${best && bd < 140 ? best.color : '#d8d0b8'}">${best && bd < 140 ? (best.team === B.myTeam ? (best.isMe ? 'Your town' : 'Ally') : 'Enemy') : 'Kingdom Battles'}</small>`;
}
export function died() { deathT = ECON.respawn(G.save.level); $('bdeath').hidden = false; if (document.pointerLockElement) document.exitPointerLock(); }

// ---------- command menu ----------
function openMenu() {
  const w = $('windows'); w.innerHTML = '';
  const win = el('div', 'win big bwin'); const hd = el('header', '', `<h2>Command</h2>`); const x = el('button', 'x', '✕'); x.onclick = () => { S.click(); UI.closeWin(); }; hd.appendChild(x);
  const c = el('div', 'content'); win.append(hd, c); w.appendChild(win);
  UI.UI.open = 'battle'; G.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock();
  render();
}
function render() {
  const c = document.querySelector('.bwin .content'); if (!c) return;
  const sc = c.querySelector('.bbody') ? c.querySelector('.bbody').scrollTop : 0;
  const t = myTown();
  c.innerHTML = '';
  const tabs = el('div', 'btabs');
  for (const [k, n] of [['army', 'Army'], ['town', 'Town'], ['def', 'Defences'], ['orders', 'Orders'], ['armory', 'Armory']]) { const b = el('button', tab === k ? 'on' : '', n); b.onclick = () => { S.click(); tab = k; render(); }; tabs.appendChild(b); }
  c.appendChild(tabs);
  c.appendChild(el('div', 'bresline', ['gold', 'wood', 'stone'].map(k => `<span>${RES_ICON[k]} <b>${Math.floor(res(t, k))}</b></span>`).join('') + `<span>⚔ <b>${pop(t)}/${popCap(t)}</b> army</span>`));
  const body = el('div', 'bbody'); c.appendChild(body);
  ({ army: tabArmy, town: tabTown, def: tabDef, orders: tabOrders, armory: tabArmory })[tab](body, t);
  body.scrollTop = sc;
}
const say = (err) => { if (err) { UI.toast(err, '⚠', 'bad'); S.error(); } else S.coins(); render(); };
function tabArmy(body, t) {
  const grid = el('div', 'bgrid');
  const all = [t.roster.worker, ...rosterOf(t.race)];
  for (const d of all) {
    const locked = (d.lvl || 0) > t.level, n = t.units.filter(u => !u.dead && u.udef.id === d.id).length, q = t.queue.filter(x => x.def.id === d.id).length;
    const card = el('div', 'bcard' + (locked ? ' locked' : '') + (d.merc ? ' merc' : ''), `<div class="bh"><b>${d.name}</b><span>${ROLE[d.role] || ''}${d.merc ? ' · Mercenary' : ''}</span></div>
      <div class="bst"><span>❤ ${Math.round(d.hp * (1 + t.level * 0.12))}</span><span>⚔ ${Math.round(d.dmg * (1 + t.level * 0.12))}</span>${d.range ? `<span>➶ ${d.range} m</span>` : ''}${d.heal ? `<span>✚ ${d.heal}</span>` : ''}${d.pop > 1 ? `<span>👥 ${d.pop}</span>` : ''}</div>
      <div class="bcost">${costHtml(d.cost, t)}</div><div class="bown">${n} in army${q ? ` · ${q} training` : ''}</div>`);
    const b = el('button', 'btn gold', locked ? `Needs ${TOWN_LEVELS[d.lvl].name}` : 'Hire'); b.disabled = locked;
    b.onclick = () => say(hire(t, d.id)); card.appendChild(b); grid.appendChild(card);
  }
  body.appendChild(grid);
  // training queue
  if (t.queue.length) body.appendChild(el('div', 'bqueue', '<b>Training:</b> ' + t.queue.map((q, i) => `<span>${q.def.name}${i === 0 ? ` <i style="--p:${(1 - q.t / q.total) * 100}%"></i>` : ''}</span>`).join('')));
  // what the workers focus on
  const jobs = el('div', 'bjobs', '<b>Workers gather:</b>');
  const J = { Balanced: { wood: 0.45, stone: 0.35, gold: 0.2 }, Wood: { wood: 0.8, stone: 0.1, gold: 0.1 }, Stone: { wood: 0.15, stone: 0.75, gold: 0.1 }, Gold: { wood: 0.15, stone: 0.1, gold: 0.75 } };
  const cur = Object.keys(J).find(k => JSON.stringify(J[k]) === JSON.stringify(t.jobs || J.Balanced)) || 'Balanced';
  for (const k in J) { const b = el('button', 'btn' + (k === cur ? ' gold' : ''), k); b.onclick = () => { S.click(); t.jobs = J[k]; for (const u of t.units) if (u.worker) u.job = null; render(); }; jobs.appendChild(b); }
  body.appendChild(jobs);
}
function tabTown(body, t) {
  const L = TOWN_LEVELS[t.level], N = TOWN_LEVELS[t.level + 1];
  body.appendChild(el('div', 'bpanel', `<h3>${t.name} · ${L.name}</h3><p>Army size <b>${popCap(t)}</b> · Hall <b>${Math.ceil(t.hall.hp)}/${t.hall.maxHp}</b> · Walls ${L.wallH.toFixed(1)} m</p>`));
  if (t.building) { const k = t.building.t / t.building.dur; body.appendChild(el('div', 'bpanel', `<h3>Building: ${TOWN_LEVELS[t.level + 1].name}</h3><div class="bprog"><i style="width:${(k * 100).toFixed(0)}%"></i><span>${Math.ceil(t.building.dur - t.building.t)} s</span></div><p class="dim">Builders are raising the walls and the hall.</p>`)); }
  else if (N) {
    const unlocks = [t.roster.worker, ...rosterOf(t.race)].filter(d => d.lvl === t.level + 1).map(d => d.name);
    const p = el('div', 'bpanel', `<h3>Upgrade to ${N.name}</h3><ul><li>Army size ${L.cap} → <b>${N.cap}</b></li><li>Taller, stronger walls · Hall ${L.hall} → <b>${N.hall}</b> HP</li><li>More houses, the town grows</li>${unlocks.length ? `<li>Unlocks: <b>${unlocks.join(', ')}</b></li>` : ''}<li>Troops trained from now on are 12% stronger</li></ul><div class="bcost">${costHtml(N.cost, t)}</div>`);
    const b = el('button', 'btn gold big', `Build ${N.name} (${N.time} s)`); b.disabled = !canPay(t, N.cost); b.onclick = () => say(upgradeTown(t)); p.appendChild(b); body.appendChild(p);
  } else body.appendChild(el('div', 'bpanel', '<h3>Fully upgraded</h3><p>Your Citadel is complete.</p>'));
}
function tabDef(body, t) {
  for (const s of t.towers) {
    const L = TOWER_LEVELS[s.level], N = TOWER_LEVELS[s.level + 1];
    const side = s === t.towers[0] ? 'Right' : 'Left';
    const p = el('div', 'bpanel' + (s.dead ? ' dead' : ''), `<h3>${side} ${L.name}${s.dead ? ' (destroyed)' : ''}</h3><div class="bprog hp"><i style="width:${(s.hp / s.maxHp * 100).toFixed(0)}%"></i><span>${Math.ceil(s.hp)}/${s.maxHp}</span></div><p>Damage ${L.dmg} · every ${L.cd}s · range ${L.range} m</p>${s.building ? `<p>Upgrading… ${Math.ceil(s.building.dur - s.building.t)} s</p>` : ''}`);
    if (!s.dead) {
      const row = el('div', 'brow');
      if (N && !s.building) { const b = el('button', 'btn gold', `Upgrade to ${N.name}`); b.title = `Damage ${N.dmg}, range ${N.range}, ${N.hp} HP`; b.onclick = () => say(upgradeTower(s)); row.append(b, el('span', 'bcost', costHtml(N.cost, t))); }
      const r = el('button', 'btn', 'Repair 25%'); r.disabled = s.hp >= s.maxHp; r.onclick = () => say(repairTower(s)); row.append(r, el('span', 'bcost', costHtml(TOWER_REPAIR, t)));
      p.appendChild(row);
    }
    body.appendChild(p);
  }
  body.appendChild(el('p', 'dim', 'Towers shoot troops in their circle first. They only shoot a hero who steps inside, and heroes can only damage a tower from inside its circle.'));
}
function tabOrders(body, t) {
  const army = t.units.filter(u => !u.dead && !u.worker && !u.hero), out = army.filter(u => u.order === 'attack').length;
  body.appendChild(el('div', 'bpanel', `<h3>Your army</h3><p><b>${army.length}</b> troops · ${army.length - out} at home · ${out} attacking</p>`));
  const foes = B.towns.filter(o => !o.dead && o.team !== t.team);
  const p = el('div', 'bpanel', '<h3>Attack</h3><p class="dim">Sends your troops down the road to that town. They fight anything on the way and go for its towers and hall.</p>');
  for (const f of foes) {
    const dir = directionOf(t, f);
    const row = el('div', 'brow', `<span class="bdir">${dir === 'Left' ? '⬅' : dir === 'Right' ? '➡' : '⬆'} ${dir}</span><span class="bfoe" style="color:${f.color}">${f.name}</span><span class="dim">${f.race === 'highelf' ? 'High Elf' : f.race === 'woodelf' ? 'Wood Elf' : f.race[0].toUpperCase() + f.race.slice(1)} · ${(DIFFS[f.diff] || DIFFS.normal).name} · Hall ${Math.round(f.hall.hp / f.hall.maxHp * 100)}%</span>`);
    const a = el('button', 'btn red', 'Attack!'); a.onclick = () => { const e = sendAttack(t, f.i, 1); if (!e) { S.battleCry && S.battleCry(); UI.banner('Attack!', `Your army marches ${dir.toLowerCase()} on ${f.name}`); } say(e); };
    const h = el('button', 'btn', 'Send half'); h.onclick = () => say(sendAttack(t, f.i, 0.5));
    row.append(a, h); p.appendChild(row);
  }
  body.appendChild(p);
  const q = el('div', 'bpanel', '<h3>Other orders</h3>'); const row = el('div', 'brow');
  const d = el('button', 'btn', '🛡 Defend the town'); d.onclick = () => { recall(t); say(null); };
  const f = el('button', 'btn', '👣 Follow me'); f.onclick = () => { setFollow(t); say(null); };
  row.append(d, f); q.appendChild(row); body.appendChild(q);
}
function tabArmory(body, t) {
  const h = G.save, w = h.equip.w1, wt = w ? w.tier : 0;
  const arm = ARMOR_SLOT_LIST.map(k => h.equip[k]).filter(Boolean), at = arm.length ? Math.min(...arm.map(a => a.tier)) : 0;
  const p = el('div', 'bpanel', `<h3>Weapons</h3><p>${w ? w.name : 'None'}${h.equip.w2 ? ' & ' + h.equip.w2.name : ''}</p>`);
  if (wt < 5) { const cost = { gold: ARMORY.weapon[wt + 1] }; const b = el('button', 'btn gold', `Forge tier ${wt + 1} weapons`); b.onclick = () => { if (!canPay(t, cost)) return say('Not enough gold'); bank(t, 'gold', -cost.gold); for (const k of ['w1', 'w2', 'ranged']) if (h.equip[k]) h.equip[k] = Game.makeWeapon(h.equip[k].wt, wt + 1, 1); G.hooks.gearChanged && G.hooks.gearChanged(); say(null); }; p.append(b, el('span', 'bcost', costHtml(cost, t))); } else p.appendChild(el('p', '', '<b>Best weapons forged.</b>'));
  body.appendChild(p);
  const q = el('div', 'bpanel', `<h3>Armour</h3><p>${arm.length ? `Tier ${at} ${CLASSES[h.cls].armor}` : 'No armour yet'}</p>`);
  if (at < 5 || arm.length < ARMOR_SLOT_LIST.length) { const nt = Math.min(5, arm.length < ARMOR_SLOT_LIST.length ? Math.max(1, at) : at + 1); const cost = { gold: ARMORY.armor[nt] }; const b = el('button', 'btn gold', `Outfit tier ${nt} armour`); b.onclick = () => { if (!canPay(t, cost)) return say('Not enough gold'); bank(t, 'gold', -cost.gold); for (const k of ARMOR_SLOT_LIST) h.equip[k] = Game.makeArmor(CLASSES[h.cls].armor, k, nt, 1); G.hooks.gearChanged && G.hooks.gearChanged(); say(null); }; q.append(b, el('span', 'bcost', costHtml(cost, t))); }
  body.appendChild(q);
  const s = el('div', 'bpanel', '<h3>Supplies</h3>'); const row = el('div', 'brow');
  for (const [id, g] of [['potion_heal', 30], ['potion_heal2', 70], ['honey_mead', 25], ['hunter_stew', 25]]) { const b = el('button', 'btn', `${ITEMS[id].name} · 🪙 ${g}`); b.onclick = () => { if (res(t, 'gold') < g) return say('Not enough gold'); bank(t, 'gold', -g); Game.addItem(h, id, 1); Game.autoFillHotbar(h); G.hooks.hotbarAdded && G.hooks.hotbarAdded(); say(null); }; row.appendChild(b); }
  s.appendChild(row); body.appendChild(s);
}

// ---------- end of match ----------
export function matchOver(result) {
  const t = myTown();
  setTimeout(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    UI.closeWin();
    const d = el('div', 'bend ' + result, `<div class="bendp"><h1>${result === 'victory' ? 'Victory!' : 'Defeat'}</h1><p>${result === 'victory' ? 'Every enemy hall has fallen.' : `${t.name} has fallen.`}</p>
      <div class="bstats"><div><span>Match time</span><b>${fmtT(B.time)}</b></div><div><span>Hero level</span><b>${G.save.level}</b></div><div><span>Town</span><b>${TOWN_LEVELS[t.level].name}</b></div><div><span>Troops lost</span><b>${t.lost || 0}</b></div></div>
      <div class="brow"><button class="btn gold big" id="bAgain">Play again</button><button class="btn big" id="bTitle">Title screen</button></div></div>`);
    document.body.appendChild(d);
    $('bAgain').onclick = () => location.reload();
    $('bTitle').onclick = () => { location.href = location.pathname; };
    G.uiOpen = true;
  }, 2500);
}
