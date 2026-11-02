// Kingdom Battles: resource bar, command menu (B), respawn countdown and the end-of-match screen.
import { G } from './state.js';
import { S } from './audio.js';
import { CLASSES, ARMOR_SLOT_LIST, ITEMS, ABILITIES, CLASS_POOLS, RARITY, STAT_NAMES, WEAPON_TYPES, SLOT_LABEL } from './data.js';
import { settings, saveSettings } from './saves.js';
import * as Game from './game.js';
import * as UI from './ui.js';
import * as Icons from './icons.js';
import { glyphBadge } from './icons2.js';
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { isExplored } from './fog.js';
import { MP } from './mp.js';
import { V } from './vfx.js';
import { B, myTown, res, canPay, pop, popCap, available, hire, upgradeTown, upgradeTower, repairTower, sendAttack, recall, setFollow, directionOf, bank, peasants, peasantCap, buyForeman, up, peasantCarry } from './battle.js';
import { TEAM_COLORS, TOWN_LEVELS, TOWER_LEVELS, TOWER_REPAIR, ARMORY, ECON, rosterOf, DIFFS, FOREMAN } from './battledata.js';
import { SETUP, SETUP_KEY, LAYOUT } from './battlemap.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// clear icons: a coin for gold, a log for wood, a grey block for stone
export function resIcon(k, size = 20) { const svg = k === 'gold' ? Icons.coin() : Icons.itemSvg({ id: k }); return `<span class="ri ri-${k}" style="width:${size}px;height:${size}px">${svg}</span>`; }
const RES_NAME = { gold: 'Gold', wood: 'Wood', stone: 'Stone' };
const costHtml = (c, t) => Object.entries(c).map(([k, v]) => `<span class="bc ${res(t, k) >= v ? '' : 'no'}" title="${RES_NAME[k]}">${resIcon(k, 18)} ${v}</span>`).join(' ');
export function heroCarryCap() { return ECON.heroCarry + up(myTown(), 'sacks') * 10; }
const ROLE = { melee: '⚔ Melee', ranged: '🏹 Ranged', healer: '✚ Healer', worker: '⛏ Worker' };
let opts = {}, tab = 'report', bar = null, deathT = 0, menuT = 0, xpAcc = 0;

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
    const seen = (x, z) => !G.fog || G.fog.explored && isExplored(x, z), vis = (x, z) => !G.fogVis || G.fogVis(x, z);
    for (const c of LAYOUT.camps) { if (!seen(c.x, c.z)) continue; if (c.tier === 3) { icon(c.x, c.z, '☠', '#ff3030', 24); lbl('Boss', c.x, c.z + 18, 13, '#ff8a7a'); } else icon(c.x, c.z, '⛺', c.tier === 2 ? '#ff8a50' : c.tier ? '#ffc070' : '#9cdc5a', 15); }
    for (const [x, z] of LAYOUT.stone) if (seen(x, z)) icon(x, z, '■', '#c8c0b0', 12);
    for (const u of B.units) if (!u.dead && (u.team === B.myTeam || vis(u.pos.x, u.pos.z))) { const [px, pz] = P(u.pos.x, u.pos.z); g.fillStyle = TEAM_COLORS[u.team]; g.beginPath(); g.arc(px, pz, (u.hero ? 6 : 3.2) * k, 0, 7); g.fill(); if (u.hero) { g.lineWidth = 2 * k; g.strokeStyle = '#fff'; g.stroke(); } }
    for (const t of B.towns) {
      if (!t.isMe && t.team !== B.myTeam && !seen(t.x, t.z)) { icon(t.x, t.z, '?', '#a89a7a', 22); continue; }
      const [px, pz] = P(t.x, t.z); g.globalAlpha = t.dead ? 0.35 : 1;
      g.beginPath(); g.arc(px, pz, 22 * k, 0, 7); g.fillStyle = t.color + '55'; g.fill(); g.lineWidth = 4 * k; g.strokeStyle = t.color; g.stroke();
      icon(t.x, t.z, t.dead ? '✕' : '♜', t.color, 26);
      for (const s of t.towers) icon(s.pos.x, s.pos.z, s.dead ? '✕' : '▲', t.color, 13);
      lbl(`${t.name}${t.isMe ? ' (you)' : ''}`, t.x, t.z + (t.z > 0 ? 38 : -38), 17, '#fff'); g.globalAlpha = 1;
    }
    // allied heroes and players by name
    if (G.allyHeroes) for (const ah of G.allyHeroes()) { const [px, pz] = P(ah.pos.x, ah.pos.z); g.beginPath(); g.arc(px, pz, 8 * k, 0, 7); g.fillStyle = TEAM_COLORS[ah.team]; g.fill(); g.lineWidth = 3 * k; g.strokeStyle = '#fff'; g.stroke(); lbl(ah.name || 'Ally', ah.pos.x, ah.pos.z - 14, 12, '#cfe4ff'); }
    if (G.fog) { for (const s of G.fog.sentries) if (!s.dead) { const [px, pz] = P(s.x, s.z); g.beginPath(); g.arc(px, pz, s.r * k * 1.33, 0, 7); g.strokeStyle = 'rgba(96,208,255,.7)'; g.lineWidth = 2 * k; g.setLineDash([6 * k, 5 * k]); g.stroke(); g.setLineDash([]); icon(s.x, s.z, '👁', '#60d0ff', 14); }
      for (const p of G.fog.pings) { const [px, pz] = P(p.x, p.z), a = (G.time - p.t) % 1.5 / 1.5; g.beginPath(); g.arc(px, pz, (10 + a * 40) * k, 0, 7); g.strokeStyle = `rgba(255,60,40,${1 - a})`; g.lineWidth = 4 * k; g.stroke(); } }
  };
  G.battleMapSide = (side) => {
    side.innerHTML = '<h3>Kingdoms</h3>';
    for (const t of B.towns) side.insertAdjacentHTML('beforeend', `<div class="mq" style="border-color:${t.color}"><div class="mqh"><i style="background:${t.color}"></i><b>${t.name}${t.isMe ? ' (you)' : ''}</b>${t.dead ? '<span class="rdy" style="color:#ff7a6a">Fallen</span>' : ''}</div><div class="mqo">${t.race === 'highelf' ? 'High Elf' : t.race === 'woodelf' ? 'Wood Elf' : t.race[0].toUpperCase() + t.race.slice(1)} · ${TOWN_LEVELS[t.level].name} · Hall ${Math.round(t.hall.hp / t.hall.maxHp * 100)}%</div><div class="mqo">${t.team === B.myTeam ? `${t.units.filter(u => !u.dead && !u.worker && !u.hero).length} troops · ${t.towers.filter(s => !s.dead).length}/2 towers` : isExplored(t.x, t.z) ? `${t.towers.filter(s => !s.dead).length}/2 towers · army unknown` : 'Not yet scouted'}</div></div>`);
    side.insertAdjacentHTML('beforeend', '<h3>Legend</h3><div class="legend"><div><b>♜</b> Town and Hall</div><div><b>▲</b> Archer tower</div><div><b style="color:#9cdc5a">⛺</b> Neutral camp (gold & XP)</div><div><b style="color:#ff3030">☠</b> Boss lair (red beam in the sky)</div><div><b style="color:#c8c0b0">■</b> Stone quarry</div><div><b style="color:#60d0ff">👁</b> Sentry ward · <b style="color:#ff4030">◎</b> Sentry alarm</div><div><b>Dark</b> unexplored · <b>dim</b> not watched</div><div><b>●</b> Troops in team colours</div></div><p class="dim">M or Esc closes.</p>');
  };
}

// ---------- top bar ----------
function drawBar() {
  const t = myTown(); if (!t || !bar) return;
  const L = TOWN_LEVELS[t.level];
  const c = G.save && G.save.carry || { wood: 0, stone: 0 }, cap = heroCarryCap();
  bar.innerHTML = ['gold', 'wood', 'stone'].map(k => `<div title="${RES_NAME[k]} in town">${resIcon(k)}<span class="rn">${RES_NAME[k]}</span>${Math.floor(res(t, k))}</div>`).join('')
    + `<div title="Peasants"><b>⛏</b>${peasants(t)}/${peasantCap(t)}</div><div title="Army size"><b>⚔</b>${pop(t)}/${popCap(t)}</div>`
    + (c.wood || c.stone ? `<div class="bcarry ${c.wood >= cap || c.stone >= cap ? 'full' : ''}" title="What you are carrying: unload at the Storehouse">🎒 ${resIcon('wood', 16)}${c.wood}/${cap} ${resIcon('stone', 16)}${c.stone}/${cap}</div>` : '')
    + `<div title="Match time"><b>⏱</b>${fmtT(B.time)}</div>`
    + `<div class="bhall" title="Your town hall"><i style="width:${(t.hall.hp / t.hall.maxHp * 100).toFixed(0)}%"></i><span>${t.name} · ${L.name}${t.building ? ' · building ' + Math.ceil(t.building.dur - t.building.t) + 's' : ''}</span></div>`
    + `<div class="bkey">B · War Report</div>`;
}
export function update(dt) {
  if (!B.over && G.save && G.player && !G.player.dead) { xpAcc += ECON.passiveXp * dt; if (xpAcc >= 15) { Game.gainXp(G.save, Math.floor(xpAcc)); xpAcc -= Math.floor(xpAcc); } }
  menuT -= dt; if (menuT <= 0) { menuT = 0.25; drawBar(); zoneLabel(); if (UI.UI.open === 'battle') render(); }
  storeTick(dt);
  // online: the gates stay shut for the first minute
  { let g = $('gatecd'); if (MP.on && B.time < 60 && !B.over) { if (!g) { g = el('div', ''); g.id = 'gatecd'; $('hud').appendChild(g); } g.innerHTML = `<b>The gates open in ${Math.ceil(60 - B.time)} s</b><span>Ready your town, Commander</span>`; } else if (g) { g.remove(); if (MP.on && !B.gatesSaid) { B.gatesSaid = true; report('captain', 'the gates are open! To battle!', 'war'); } } }
  if (deathT > 0) { deathT -= dt; const d = $('bdeath'); d.innerHTML = `<div><h2>You have fallen</h2><p>Your troops fight on. Back in <b>${Math.ceil(deathT)}</b>…</p></div>`; if (deathT <= 0) { d.hidden = true; opts.respawn && opts.respawn(); } }
}
function zoneLabel() {
  const p = G.player; if (!p) return; let best = null, bd = 1e9;
  for (const t of B.towns) { const d = Math.hypot(p.pos.x - t.x, p.pos.z - t.z); if (d < bd) { bd = d; best = t; } }
  const where = bd < 50 ? best.name : bd < 140 ? `Near ${best.name}` : 'The Wilds';
  G.zoneLabel = `${where}<small style="color:${best && bd < 140 ? best.color : '#d8d0b8'}">${best && bd < 140 ? (best.team === B.myTeam ? (best.isMe ? 'Your town' : 'Ally') : 'Enemy') : 'Kingdom Battles'}</small>`;
}
// ---------- storehouse: a glowing ring and sign where you unload ----------
let mark = null;
function makeMarker(t) {
  const [x, z] = t.store, g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.8, depthWrite: false }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.12, depthWrite: false }));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe080', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.y = 7;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const c = cv.getContext('2d');
  c.fillStyle = 'rgba(20,14,8,.85)'; c.strokeStyle = '#ffd84a'; c.lineWidth = 8; c.beginPath(); c.roundRect(6, 6, 500, 148, 24); c.fill(); c.stroke();
  c.fillStyle = '#ffe2a0'; c.font = 'bold 54px Georgia, serif'; c.textAlign = 'center'; c.fillText('STOREHOUSE', 256, 70); c.font = '34px Georgia, serif'; c.fillStyle = '#f0e4c8'; c.fillText('Unload wood & stone here', 256, 122);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); sp.scale.set(3.4, 1.05, 1); sp.position.y = 6; sp.renderOrder = 9;
  g.add(ring, disc, beam, sp); g.position.set(x, heightAt(x, z) + 0.12, z); G.scene.add(g);
  return { g, ring, sp };
}
// red beams over living bosses so they can be found from far away
const beacons = new Map();
function bossBeacons() {
  for (const m of G.mobs) {
    if (!m.bossy) continue;
    let b = beacons.get(m);
    if (!b) { b = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 90, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })); G.scene.add(b); beacons.set(m, b); }
    b.visible = !m.dead; b.position.set(m.pos.x, m.pos.y + 45, m.pos.z); b.material.opacity = 0.16 + Math.sin(B.time * 2 + m.id) * 0.06;
  }
}
function storeTick(dt) {
  bossBeacons();
  if (G.noHarvest) return;
  const t = myTown(), p = G.player; if (!t || !p) return;
  if (!mark) mark = makeMarker(t);
  mark.ring.scale.setScalar(1 + Math.sin(B.time * 3) * 0.05); mark.sp.position.y = 6 + Math.sin(B.time * 2) * 0.2;
  const c = G.save && G.save.carry; if (!c || p.dead) return;
  if ((c.wood || c.stone) && Math.hypot(p.pos.x - t.store[0], p.pos.z - t.store[1]) < 3.8) {
    const w = c.wood, s = c.stone; if (w) bank(t, 'wood', w); if (s) bank(t, 'stone', s); c.wood = 0; c.stone = 0;
    UI.toast(`Unloaded ${w ? w + ' wood' : ''}${w && s ? ' and ' : ''}${s ? s + ' stone' : ''}`, resIcon(w ? 'wood' : 'stone'), 'gold'); S.coins();
    V.burst('gold', p.pos.clone().setY(p.pos.y + 1.2), 30, { speed: 3, vy: 2 });
  }
}
export function died() { deathT = ECON.respawn(G.save.level); $('bdeath').hidden = false; if (document.pointerLockElement) document.exitPointerLock(); }

// ---------- command menu ----------
let menu = 'command';
const MENUS = { command: { title: 'War Report', tabs: [['report', 'Report'], ['orders', 'Orders'], ['armory', 'Supplies']] }, foreman: { title: 'Foreman', tabs: [['foreman', 'Peasants & Tools']] }, builder: { title: 'Master Builder', tabs: [['town', 'Town'], ['def', 'Defences']] } };
export function openNpc(role) { menu = role; tab = MENUS[role].tabs[0][0]; openMenu(true); }
function openMenu(keep) {
  if (!keep) { menu = 'command'; if (!MENUS.command.tabs.some(x => x[0] === tab)) tab = 'report'; }
  const w = $('windows'); w.innerHTML = '';
  const win = el('div', 'win big bwin'); const hd = el('header', '', `<h2>${MENUS[menu].title}</h2>`); const x = el('button', 'x', '✕'); x.onclick = () => { S.click(); UI.closeWin(); }; hd.appendChild(x);
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
  for (const [k, n] of MENUS[menu].tabs) { const b = el('button', tab === k ? 'on' : '', n); b.onclick = () => { S.click(); tab = k; render(); }; tabs.appendChild(b); }
  c.appendChild(tabs);
  c.appendChild(el('div', 'bresline', ['gold', 'wood', 'stone'].map(k => `<span>${resIcon(k)} ${RES_NAME[k]} <b>${Math.floor(res(t, k))}</b></span>`).join('') + `<span>⛏ <b>${peasants(t)}/${peasantCap(t)}</b> peasants</span><span>⚔ <b>${pop(t)}/${popCap(t)}</b> army</span>`));
  const body = el('div', 'bbody'); c.appendChild(body);
  ({ report: tabReport, army: tabArmy, town: tabTown, def: tabDef, orders: tabOrders, armory: tabArmory, foreman: tabForeman })[tab](body, t);
  body.scrollTop = sc;
}
const say = (err) => { if (err) { UI.toast(err, '⚠', 'bad'); S.error(); } else S.coins(); render(); };
function tabArmy(body, t) {
  const grid = el('div', 'bgrid');
  const all = rosterOf(t.race);
  for (const d of all) {
    const locked = (d.lvl || 0) > t.level, n = t.units.filter(u => !u.dead && u.udef.id === d.id).length, q = t.queue.filter(x => x.def.id === d.id).length;
    const card = el('div', 'bcard' + (locked ? ' locked' : '') + (d.merc ? ' merc' : ''), `<div class="bport">${unitBadge(d)}</div><div class="bh"><b>${d.name}</b><span>${ROLE[d.role] || ''}${d.merc ? ' · Mercenary' : ''}</span></div>
      <div class="bst"><span>❤ ${Math.round(d.hp * (1 + t.level * 0.12))}</span><span>⚔ ${Math.round(d.dmg * (1 + t.level * 0.12))}</span>${d.range ? `<span>➶ ${d.range} m</span>` : ''}${d.heal ? `<span>✚ ${d.heal}</span>` : ''}${d.pop > 1 ? `<span>👥 ${d.pop}</span>` : ''}</div>
      <div class="bcost">${costHtml(d.cost, t)}</div><div class="bown">${n} in army${q ? ` · ${q} training` : ''}</div>`);
    const b = el('button', 'btn gold', locked ? `Needs ${TOWN_LEVELS[d.lvl].name}` : 'Hire'); b.disabled = locked;
    b.onclick = () => say(hire(t, d.id)); card.appendChild(b); grid.appendChild(card);
  }
  body.appendChild(grid);
  // training queue
  if (t.queue.length) body.appendChild(el('div', 'bqueue', '<b>Training:</b> ' + t.queue.map((q, i) => `<span>${q.def.name}${i === 0 ? ` <i style="--p:${(1 - q.t / q.total) * 100}%"></i>` : ''}</span>`).join('')));
}
function unitBadge(d) {
  const g = d.role === 'worker' ? (d.tool === 'pickaxe' ? 'hammer' : 'axe') : d.role === 'healer' ? 'heart' : d.role === 'ranged' ? (d.proj === 'bullet' ? 'burst' : d.proj === 'fire' ? 'fireball' : d.proj === 'arcane' ? 'spiral' : d.proj === 'frost' ? 'snow' : 'arrow') : d.kind === 'troll' ? 'hammer' : d.wt && d.wt.includes('axe') ? 'axe' : d.wt === 'spear' ? 'sword' : d.wt === 'warhammer' ? 'hammer' : d.pop >= 2 ? 'swords' : 'shield';
  const th = d.role === 'healer' ? 'gold' : d.role === 'ranged' ? (d.proj === 'fire' ? 'fire' : d.proj === 'arcane' ? 'arcane' : d.proj === 'frost' ? 'frost' : 'nature') : d.merc ? 'shadow' : d.role === 'worker' ? 'gold' : d.pop >= 2 ? 'red' : 'steel';
  return glyphBadge(g, th);
}
// the town runs itself: this is what the Commander sees
function tabReport(body, t) {
  const L = TOWN_LEVELS[t.level], army = t.units.filter(u => !u.dead && !u.worker && !u.hero && !u.pet);
  const kinds = {}; for (const u of army) kinds[u.udef.name] = (kinds[u.udef.name] || 0) + 1;
  body.appendChild(el('div', 'bstages', TOWN_LEVELS.map((x, i) => `<div class="bstage ${i < t.level ? 'done' : i === t.level ? 'cur' : ''}"><div class="bsn">${i < t.level ? '✓' : i + 1}</div><b>${x.name}</b><span>Army ${x.cap} · Peasants ${x.peasants}</span></div>`).join('<i class="bsline"></i>')));
  const ups = FOREMAN.map(F => `${F.icon} ${F.name} ${'●'.repeat(up(t, F.id))}${'○'.repeat(F.costs.length - up(t, F.id))}`).join(' &nbsp; ');
  body.appendChild(el('div', 'bpanel', `<h3>${t.name}, ${L.name}</h3><p>${t.building ? `The builders are raising a <b>${TOWN_LEVELS[t.level + 1].name}</b>: ${Math.ceil(t.building.dur - t.building.t)} s to go.` : TOWN_LEVELS[t.level + 1] ? `Your steward is saving up to build a <b>${TOWN_LEVELS[t.level + 1].name}</b>.` : 'The Citadel is complete.'}</p><div class="bprog hp"><i style="width:${(t.hall.hp / t.hall.maxHp * 100).toFixed(0)}%"></i><span>Town Hall ${Math.ceil(t.hall.hp)}/${t.hall.maxHp}</span></div><p class="dim" style="margin-top:6px">${ups}</p>`));
  const tw = t.towers.map((s, i) => `<div class="brep"><b>${i ? 'Left' : 'Right'} ${TOWER_LEVELS[s.level].name}</b>${s.dead ? '<span class="bad">destroyed</span>' : `<div class="bprog hp"><i style="width:${(s.hp / s.maxHp * 100).toFixed(0)}%"></i><span>${Math.ceil(s.hp)}/${s.maxHp}</span></div>`}</div>`).join('');
  body.appendChild(el('div', 'bpanel', `<h3>Defences</h3><div class="brepgrid">${tw}</div>`));
  body.appendChild(el('div', 'bpanel', `<h3>Army: ${pop(t)}/${popCap(t)}</h3><p>${army.length ? Object.entries(kinds).map(([k, v]) => `<span class="bchip">${v} × ${k}</span>`).join(' ') : 'No soldiers yet: the steward will hire them as gold comes in.'}</p><p class="dim">${army.filter(u => u.order === 'attack').length} marching · ${army.filter(u => u.order !== 'attack').length} guarding the town · ${peasants(t)}/${peasantCap(t)} peasants at work${t.queue.length ? ` · ${t.queue.length} in training` : ''}</p>`));
  const log = el('div', 'bpanel', '<h3>Recent reports</h3>'); for (const m of reportLog.slice(-8).reverse()) log.appendChild(el('div', 'blog', `<span class="bt">${fmtT(m.t)}</span> <b>${m.who}:</b> ${m.text}`)); body.appendChild(log);
}
function tabForeman(body, t) {
  const W = t.roster.worker, n = peasants(t), cap = peasantCap(t);
  const p = el('div', 'bpanel', `<h3>${W.name}s</h3><p>They chop wood and mine stone, then haul it to the Storehouse. <b>${n}/${cap}</b> peasants (the limit grows with your town and with Peasant Housing). Each carries <b>${peasantCarry(t)}</b>.</p><div class="bcost">${costHtml(W.cost, t)}</div>`);
  const b = el('button', 'btn gold', `Hire a ${W.name}`); b.disabled = n >= cap; b.onclick = () => say(hire(t, 'worker')); p.appendChild(b);
  const q = t.queue.filter(x => x.def.role === 'worker').length; if (q) p.appendChild(el('p', 'dim', `${q} on the way…`));
  body.appendChild(p);
  const jobs = el('div', 'bpanel', '<h3>What they gather</h3>'); const row = el('div', 'brow');
  const J = { Balanced: { wood: 0.55, stone: 0.45 }, 'Mostly wood': { wood: 0.85, stone: 0.15 }, 'Mostly stone': { wood: 0.15, stone: 0.85 } };
  const cur = Object.keys(J).find(k => JSON.stringify(J[k]) === JSON.stringify(t.jobs || J.Balanced)) || 'Balanced';
  for (const k in J) { const bb = el('button', 'btn' + (k === cur ? ' gold' : ''), k); bb.onclick = () => { S.click(); t.jobs = J[k]; for (const u of t.units) if (u.worker && !u.carry) { u.job = null; u.node = null; } render(); }; row.appendChild(bb); }
  jobs.appendChild(row); body.appendChild(jobs);
  const grid = el('div', 'bgrid');
  for (const F of FOREMAN) {
    const r = up(t, F.id), next = F.costs[r];
    const card = el('div', 'bcard', `<div class="bh"><b>${F.icon} ${F.name}</b><span>${F.desc}</span></div><div class="branks">${F.costs.map((_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div>${next ? `<div class="bcost">${costHtml(next, t)}</div>` : '<div class="bown">Fully upgraded</div>'}`);
    if (next) { const bb = el('button', 'btn gold', `Rank ${r + 1}`); bb.onclick = () => say(buyForeman(t, F.id)); card.appendChild(bb); }
    grid.appendChild(card);
  }
  body.appendChild(grid);
}
function tabTown(body, t) {
  const L = TOWN_LEVELS[t.level], N = TOWN_LEVELS[t.level + 1];
  body.appendChild(el('div', 'bstages', TOWN_LEVELS.map((x, i) => `<div class="bstage ${i < t.level ? 'done' : i === t.level ? 'cur' : ''}"><div class="bsn">${i < t.level ? '✓' : i + 1}</div><b>${x.name}</b><span>Army ${x.cap} · Peasants ${x.peasants}</span></div>`).join('<i class="bsline"></i>')));
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
  const h = G.save;
  const ae = el('div', 'bpanel', `<h3>Loot</h3><label class="bsteams"><input type="checkbox" ${settings.autoEquip !== false ? 'checked' : ''}> <span>Auto-equip better armour you loot (weapons never auto-equip)</span></label>`); ae.querySelector('input').onchange = (e) => { settings.autoEquip = e.target.checked; saveSettings(); S.click(); }; body.appendChild(ae);
  const s = el('div', 'bpanel', '<h3>Supplies</h3>'); const row = el('div', 'brow');
  for (const [id, g] of [['potion_heal', 30], ['potion_heal2', 70], ['honey_mead', 25], ['hunter_stew', 25]]) { const b = el('button', 'btn', `${ITEMS[id].name} · 🪙 ${g}`); b.onclick = () => { if (res(t, 'gold') < g) return say('Not enough gold'); bank(t, 'gold', -g); Game.addItem(h, id, 1); Game.autoFillHotbar(h); G.hooks.hotbarAdded && G.hooks.hotbarAdded(); say(null); }; row.appendChild(b); }
  s.appendChild(row); body.appendChild(s);
}

// ---------- ability book (K): read every ability and choose the 4 on your hotbar ----------
let bookSel = 0;
export function openBook() {
  const w = $('windows'); if (UI.UI.open === 'book') { UI.closeWin(); return; } w.innerHTML = '';
  const win = el('div', 'win big bwin book'); const hd = el('header', '', '<h2>Abilities</h2>'); const x = el('button', 'x', '✕'); x.onclick = () => { S.click(); UI.closeWin(); }; hd.appendChild(x);
  const c = el('div', 'content'); win.append(hd, c); w.appendChild(win);
  UI.UI.open = 'book'; G.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock();
  renderBook();
}
function renderBook() {
  const c = document.querySelector('.book .content'); if (!c) return;
  const h = G.save, cls = h.cls, list = ABILITIES[cls].slice().sort((a, b) => a.level - b.level), res = CLASS_POOLS[cls].uses === 'mana' ? 'mana' : 'endurance';
  const k = G.abilScale ? G.abilScale(h.level) : 1;
  c.innerHTML = '';
  c.appendChild(el('p', 'bookintro', `Your hotbar holds <b>4 abilities</b> on keys <b>1 2 3 4</b>. Click a slot, then click an ability to put it there. Every level makes all your abilities stronger: right now they hit <b>${Math.round(k * 100)}%</b> as hard, last as long and reach as far as at level 1.`));
  const bar = el('div', 'bookbar');
  for (let i = 0; i < 4; i++) {
    const sl = h.hotbar[i], a = sl && ABILITIES[cls].find(x => x.id === sl.id);
    const d = el('button', 'bookslot' + (i === bookSel ? ' sel' : ''), `<span class="k">${i + 1}</span><div class="bi">${a ? Icons.abilityIcon(a.id) : ''}</div><b>${a ? a.name : 'Empty'}</b>`);
    d.onclick = () => { S.click(); bookSel = i; renderBook(); }; bar.appendChild(d);
  }
  c.appendChild(bar);
  const grid = el('div', 'bookgrid');
  for (const a of list) {
    const locked = a.level > h.level, slot = h.hotbar.findIndex(s => s && s.id === a.id);
    const d = el('button', 'bookab' + (locked ? ' locked' : '') + (slot >= 0 ? ' on' : ''), `<div class="bi">${Icons.abilityIcon(a.id)}</div><div class="bt"><b>${a.name}</b><div class="bm"><span>${locked ? '🔒 Level ' + a.level : 'Level ' + a.level}</span><span>${a.cost} ${res}</span><span>⟳ ${a.cd}s</span>${a.battle ? '<span class="new">Battle</span>' : ''}</div><p>${a.desc}</p></div>${slot >= 0 ? `<span class="inslot">${slot + 1}</span>` : ''}`);
    d.onclick = () => {
      if (locked) { S.error(); UI.toast(`${a.name} unlocks at level ${a.level}`, '🔒', 'bad'); return; }
      S.click(); const prev = h.hotbar[bookSel]; if (slot >= 0) h.hotbar[slot] = prev; h.hotbar[bookSel] = { t: 'ab', id: a.id }; bookSel = (bookSel + 1) % 4;
      G.hooks.hotbarAdded && G.hooks.hotbarAdded([]); renderBook();
    };
    grid.appendChild(d);
  }
  c.appendChild(grid);
}

// ---------- reports to the Commander ----------
const SPEAKERS = { steward: ['Steward', '📜', '#e8c87a'], captain: ['Captain', '⚔', '#ff9a7a'], scout: ['Scout', '🦅', '#9fd0ff'] };
const reportLog = [];
export function report(who, text, kind = '') {
  const [name, icon, col] = SPEAKERS[who] || SPEAKERS.steward; const msg = `Commander, ${text}`;
  reportLog.push({ t: B.time, who: name, text: msg }); if (reportLog.length > 60) reportLog.shift();
  let box = $('cmdfeed'); if (!box) { box = el('div', ''); box.id = 'cmdfeed'; $('hud').appendChild(box); }
  const d = el('div', 'cmdmsg ' + kind, `<div class="ci" style="color:${col}">${icon}</div><div><b style="color:${col}">${name}</b><p>${msg}</p></div>`);
  box.prepend(d); while (box.children.length > 4) box.lastChild.remove();
  if (kind === 'bad') S.error(); else if (kind === 'big') S.levelUp(); else if (kind === 'war') S.battleCry && S.battleCry(); else S.objective && S.objective();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 600); }, kind === 'big' ? 11000 : 8000);
}

// ---------- loot celebration: a card with the item, louder the rarer it is ----------
const lootQ = []; let lootBusy = false;
export function lootPopup(it, equipped) { lootQ.push({ it, equipped }); if (!lootBusy) nextLoot(); }
function nextLoot() {
  const n = lootQ.shift(); if (!n) { lootBusy = false; return; } lootBusy = true;
  const { it, equipped } = n, r = it.rarity || 0, R = RARITY[r];
  const type = it.kind === 'weapon' ? WEAPON_TYPES[it.wt].name : SLOT_LABEL[it.slot] || 'Gear';
  const stat = (it.dmg ? `${it.dmg} damage` : it.armor ? `${it.armor} armour` : '') + Object.entries(it.stats || {}).map(([k, v]) => ` · +${v} ${STAT_NAMES[k]}`).join('');
  const words = ['Loot!', 'Nice find!', 'Great find!', 'Epic loot!', 'LEGENDARY!'][r];
  const d = el('div', `lootpop r${r}`, `<div class="lrays"></div><div class="lcard" style="--rc:${R.col}"><div class="lhead">${words}</div><div class="lic">${Icons.itemSvg(it)}</div><div class="lname">${it.name}</div><div class="lrar">${R.name} ${type}${it.lvl ? ' · level ' + it.lvl : ''}</div><div class="lstat">${stat}</div>${equipped ? '<div class="leq">✔ Equipped</div>' : it.lvl > G.save.level ? `<div class="lneed">Needs level ${it.lvl}</div>` : '<div class="lbag">In your bag (I)</div>'}</div>`);
  document.body.appendChild(d);
  const p = G.player;
  if (r >= 1) S.coins(); if (r >= 2) S.loot && S.loot(); if (r >= 3) S.levelUp();
  if (p) { V.burst('gold', p.pos.clone().setY(p.pos.y + 1.4), 20 + r * 30, { speed: 3 + r, vy: 3 + r, life: 1 + r * 0.3 }); if (r >= 3) { V.ring(p.pos, 4 + r, R.col, 0.8); V.light(p.pos.clone().setY(p.pos.y + 2), R.col, 6 + r * 2, 0.8); V.addShake(0.15 * (r - 2)); } }
  const dur = [1800, 2200, 2800, 3600, 4800][r];
  setTimeout(() => { d.classList.add('out'); setTimeout(() => { d.remove(); nextLoot(); }, 380); }, dur);
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
    $('bAgain').onclick = () => { try { sessionStorage.setItem('kr2_fs', document.fullscreenElement ? '1' : ''); } catch (e) {} location.reload(); };
    $('bTitle').onclick = () => { location.href = location.pathname; };
    G.uiOpen = true;
  }, 2500);
}
