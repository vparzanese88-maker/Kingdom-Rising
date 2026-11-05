// Kingdom Battles: resource bar, command menu (B), respawn countdown and the end-of-match screen.
import { G } from './state.js';
import { S } from './audio.js';
import { HOTBAR_KEYS, SUPPORT_SLOTS, slotFits, isSupport, CLASS_TREES, CLASS_TREE, ULT_PTS, CLASSES, ARMOR_SLOT_LIST, ITEMS, ABILITIES, CLASS_POOLS, RARITY, STAT_NAMES, WEAPON_TYPES, SLOT_LABEL, RMB_SPECIAL, WSKILLS, familiesOf, MASTERY_CAP, masteryXpFor, LEVEL_CAP } from './data.js';
import { settings, saveSettings } from './saves.js';
import * as Game from './game.js';
import * as UI from './ui.js';
import * as Icons from './icons.js';
import { glyphBadge } from './icons2.js';
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { isExplored } from './fog.js';
import { MP } from './mp.js';
import * as BQ from './battlequests.js';
import { V } from './vfx.js';
import { B, myTown, res, canPay, pop, popCap, available, hire, upgradeTown, upgradeTower, repairTower, sendAttack, recall, setFollow, directionOf, bank, peasants, peasantCap, townPlan, buyForeman, up, peasantCarry } from './battle.js';
import { TEAM_COLORS, TOWN_LEVELS, TOWER_LEVELS, TOWER_REPAIR, ARMORY, ECON, rosterOf, DIFFS, FOREMAN } from './battledata.js';
import { SETUP, SETUP_KEY, LAYOUT, BATTLE } from './battlemap.js';

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
// the right-hand column under the minimap: Coming up, Town jobs, then loot cards, stacked without overlapping
function stackRight() {
  let y = 262; const put = (id, gap = 8) => { const e = $(id); if (!e || e.hidden) return; e.style.top = y + 'px'; y += e.offsetHeight + gap; };
  const mb = document.getElementById('mapbox'); if (mb) { const r = mb.getBoundingClientRect(); if (r.height) y = Math.max(y, Math.round(r.bottom + 34)); }
  put('bnext'); put('bqtrack'); const ls = $('lootstack'); if (ls) ls.style.top = y + 'px';
}
// the army head count at the bottom right: it glows when someone joins the ranks
let lastHeads = null, lastPeas = null;
function headCount() {
  const t = myTown(); let d = $('bheads'); if (!t || !G.player) { if (d) d.hidden = true; return; }
  if (!d) { d = el('div', ''); d.id = 'bheads'; $('hud').appendChild(d); }
  const n = pop(t), cap = popCap(t), pe = peasants(t), pc = peasantCap(t);
  d.hidden = false; d.innerHTML = `<div class="bhr" title="Soldiers"><span>⚔</span><b>${n}</b><small>/${cap}</small></div><div class="bhr pe" title="Peasants"><span>⛏</span><b>${pe}</b><small>/${pc}</small></div>`;
  if (lastHeads != null && n > lastHeads) { d.classList.remove('glow'); void d.offsetWidth; d.classList.add('glow'); S.click && 0; }
  if (lastPeas != null && pe > lastPeas) { d.classList.remove('glowp'); void d.offsetWidth; d.classList.add('glowp'); }
  lastHeads = n; lastPeas = pe;
}
// "Coming up": live countdowns under the minimap, in plain words
let nextT = 0;
function comingUp() {
  let d = $('bnext'); const t = myTown(); if (!t || B.over || !G.player) { if (d) d.hidden = true; return; }
  if (!d) { d = el('div', ''); d.id = 'bnext'; $('hud').appendChild(d); }
  const P = townPlan(t), A = P.attack, U = P.upgrade, rows = [];
  const mm = (s) => !isFinite(s) ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const row = (cls, ic, txt, tm, prog) => rows.push(`<div class="bnr ${cls}"><span class="bni">${ic}</span><span class="bnt">${txt}${prog != null ? `<i class="bnb"><b style="width:${Math.max(0, Math.min(1, prog)) * 100}%"></b></i>` : ''}</span>${tm ? `<span class="bnm">${tm}</span>` : ''}</div>`);
  if (P.threat) row('bad', '⚠', `<b>${P.threat} enemies at our walls!</b>`, 'NOW');
  if (MP.on && B.time < 60) row('', '🚪', 'Gates open', mm(60 - B.time), B.time / 60);
  if (A.out) row('war', '📯', `Our army is attacking ${A.target || ''}`, `${A.out} ⚔`);
  else if (A.graceLeft > 0) row('', '⚔', `First attack (${A.home}/${A.need} soldiers)`, mm(A.graceLeft), 1 - A.graceLeft / Math.max(1, A.graceLeft + B.time));
  else row('', '⚔', A.home >= A.need ? 'Army marches any moment' : `Next attack at ${A.need} soldiers`, `${A.home}/${A.need}`, A.home / A.need);
  if (U && U.state === 'building') row('build', '🏗', `Building the ${U.name}`, mm(U.secs), 1 - U.secs / ((t.building && t.building.dur) || 60));
  else if (U) { const need = Object.entries(U.short).map(([k, v]) => `${v} ${k}`).join(', '); row('', '🏗', need ? `${U.name}: need ${need}` : `${U.name}: ready to build`, B.client ? '' : need ? (isFinite(U.secs) ? '~' + mm(U.secs) : '') : U.gate > 0 ? mm(U.gate) : 'Soon'); }
  const tr = P.training.find(x => !x.worker); if (tr) row('', '🪖', `Training ${tr.name}`, mm(tr.secs));
  for (const j of BQ.activeList()) if (j.ready) row('job', '❓', `Hand in "${j.name}" in town`, '');
  d.hidden = false; d.innerHTML = `<div class="bnh">Coming up</div>${rows.join('')}`;
  stackRight();
}
export function update(dt) {
  if (!B.over && G.save && G.player && !G.player.dead) { xpAcc += ECON.passiveXp * dt; if (xpAcc >= 15) { Game.gainXp(G.save, Math.floor(xpAcc)); xpAcc -= Math.floor(xpAcc); } }
  menuT -= dt; if (menuT <= 0) { menuT = 0.25; drawBar(); zoneLabel(); if (UI.UI.open === 'battle') render(); }
  nextT -= dt; if (nextT <= 0) { nextT = 0.5; comingUp(); headCount(); }
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
const MENUS = { command: { title: 'War Report', tabs: [['report', 'Report'], ['orders', 'Orders'], ['armory', 'Supplies']] }, foreman: { title: 'Foreman', tabs: [['foreman', 'Peasants & Tools']] }, builder: { title: 'Master Builder', tabs: [['town', 'Town'], ['def', 'Defences']] }, hunt: { title: 'Huntmaster', tabs: [['hunt', 'Hunting jobs']] }, quarter: { title: 'Quartermaster', tabs: [['quarter', 'Supply jobs']] }, jobs: { title: 'Town Jobs', tabs: [['jobs', 'All jobs']] } };
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
  ({ hunt: (b2, t2) => tabJobs(b2, t2, 'hunt'), quarter: (b2, t2) => tabJobs(b2, t2, 'quarter'), jobs: (b2, t2) => { tabJobs(b2, t2, 'hunt'); tabJobs(b2, t2, 'quarter'); }, report: tabReport, army: tabArmy, town: tabTown, def: tabDef, orders: tabOrders, armory: tabArmory, foreman: tabForeman })[tab](body, t);
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
// the town runs itself: this is what the Commander sees. Plain answers: what is happening, what comes next and when, how many of everything
function tabReport(body, t) {
  const P = townPlan(t), L = TOWN_LEVELS[t.level], A = P.attack, U = P.upgrade, cl = B.client;
  const mmss = (s) => !isFinite(s) ? '—' : s >= 3600 ? '60:00+' : fmtT(s);
  const soon = (s) => !isFinite(s) ? 'when the resources come in' : s < 15 ? 'any moment now' : `in about ${s < 90 ? Math.ceil(s / 5) * 5 + ' s' : Math.round(s / 60) + ' min'}`;
  const bar = (k) => `<div class="wr-bar"><i style="width:${Math.max(0, Math.min(100, k * 100)).toFixed(0)}%"></i></div>`;
  const RN = { gold: 'gold', wood: 'wood', stone: 'stone' };
  // ---- at a glance ----
  const card = (icon, big, label, sub) => `<div class="wr-card"><div class="wr-ic">${icon}</div><div><div class="wr-big">${big}</div><div class="wr-lab">${label}</div>${sub ? `<div class="wr-sub">${sub}</div>` : ''}</div></div>`;
  const trainN = P.training.filter(x => !x.worker).length, trainW = P.training.length - trainN;
  body.appendChild(el('div', 'wr-cards',
    card('⚔', `${P.army}<small>/${P.cap}</small>`, 'Soldiers', `${A.out ? `<b>${A.out}</b> marching · ` : ''}${A.home} at home${trainN ? ` · ${trainN} training` : ''}`) +
    card('⛏', `${P.peasants}<small>/${P.peasantCap}</small>`, 'Peasants', `${P.wood} on wood · ${P.stone} on stone${trainW ? ` · ${trainW} coming` : ''}`) +
    card(resIcon('gold', 26), cl ? Math.floor(res(t, 'gold')) : `+${Math.round(P.rate.gold)}`, cl ? 'Gold' : 'Gold a minute', cl ? '' : `+${Math.round(P.rate.wood)} wood · +${Math.round(P.rate.stone)} stone a minute`) +
    card('🏰', `${Math.round(t.hall.hp / t.hall.maxHp * 100)}%`, `${L.name} hall`, `${Math.ceil(t.hall.hp)}/${t.hall.maxHp} health`)));
  // ---- what is happening and what comes next ----
  const rows = [];
  const row = (cls, icon, title, text, right, prog) => rows.push(`<div class="wr-row ${cls}"><div class="wr-ri">${icon}</div><div class="wr-rt"><b>${title}</b><span>${text}</span>${prog != null ? bar(prog) : ''}</div>${right ? `<div class="wr-tm">${right}</div>` : ''}</div>`);
  if (P.threat) row('bad', '⚠', 'Under attack!', `${P.threat} enemy soldiers are at the walls. Every soldier at home is defending.`, 'NOW');
  if (A.out) row('war', '📯', `Attacking ${A.target || 'the enemy'}`, `${A.out} of our soldiers are on the march. ${A.home} stay behind to guard the town.`, 'Under way');
  else if (A.graceLeft > 0) row('', '⚔', 'Next attack', `The army gathers for the first march. The captain wants <b>${A.need}</b> soldiers: we have <b>${A.home}</b>.`, mmss(A.graceLeft), Math.min(1, A.home / A.need));
  else row('', '⚔', 'Next attack', A.home >= A.need ? 'The army is ready and marches any moment now.' : `We march when <b>${A.need}</b> soldiers are ready: <b>${A.home}</b> are here, <b>${A.need - A.home}</b> to go.`, A.home >= A.need ? 'Soon' : `${A.home}/${A.need}`, Math.min(1, A.home / A.need));
  if (A.last != null && !A.out) rows.push(`<div class="wr-note">Last attack ${fmtT(Math.max(0, B.time - A.last))} ago.</div>`);
  if (U && U.state === 'building') { const tot = (t.building && t.building.dur) || 60; row('build', '🏗', `Building the ${U.name}`, `Builders and scaffolding are up. When it is done: army limit ${TOWN_LEVELS[t.level + 1].cap}, ${TOWN_LEVELS[t.level + 1].peasants} peasants, bigger walls.`, mmss(U.secs), 1 - U.secs / tot); }
  else if (U) {
    const need = Object.entries(U.short).map(([k, v]) => `${v} ${RN[k]}`).join(', ');
    const txt = need ? `Saving up: still need <b>${need}</b>.` : U.gate > 0 ? 'We can afford it: the steward starts once the town is settled.' : 'We can afford it: building starts any moment.';
    const cost = Object.entries(U.cost).map(([k, v]) => `${v} ${RN[k]}`).join(' · ');
    row('', '🏗', `Next upgrade: ${U.name}`, `${txt} <span class="dim">(costs ${cost})</span>`, cl ? '' : need ? soon(U.secs) : U.gate > 0 ? mmss(U.gate) : 'Soon');
  } else row('', '🏰', 'The town is complete', 'Every upgrade is built.', '');
  if (P.training.length) row('', '🪖', 'Training now', P.training.slice(0, 4).map((q, i) => `${q.name}${i === 0 ? ` (${Math.ceil(q.secs)} s)` : ''}`).join(', ') + (P.training.length > 4 ? ` and ${P.training.length - 4} more` : ''), '');
  else if (P.army >= P.cap) row('', '🪖', 'Army full', `We have the most soldiers this town can hold (${P.cap}). Upgrading the town raises the limit.`, '');
  body.appendChild(el('div', 'bpanel', `<h3>What is happening</h3>${rows.join('')}`));
  // ---- the army and the defences ----
  const chips = Object.entries(P.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="bchip"><b>${v}</b> ${k}${v > 1 ? 's' : ''}</span>`).join(' ');
  const tw = t.towers.map((s, i) => `<div class="brep"><b>${i ? 'Left' : 'Right'} tower · ${TOWER_LEVELS[s.level].name}</b>${s.dead ? '<span class="bad">destroyed</span>' : `<div class="bprog hp"><i style="width:${(s.hp / s.maxHp * 100).toFixed(0)}%"></i><span>${Math.ceil(s.hp)}/${s.maxHp}</span></div>`}</div>`).join('');
  body.appendChild(el('div', 'bpanel', `<h3>Our army</h3><p>${chips || 'No soldiers yet: the steward hires them as gold comes in.'}</p><div class="brepgrid" style="margin-top:8px">${tw}</div>`));
  // ---- the enemy ----
  const foes = B.towns.filter(o => o.team !== t.team);
  body.appendChild(el('div', 'bpanel', `<h3>Enemy towns</h3>${foes.map(o => `<div class="wr-foe ${o.dead ? 'dead' : ''}"><i style="background:${TEAM_COLORS[o.team]}"></i><b>${o.name}</b><span>${o.dead ? 'Destroyed' : `${TOWN_LEVELS[o.level].name} · ${directionOf(t, o)}`}</span>${o.dead ? '' : `<div class="bprog hp"><i style="width:${(o.hall.hp / o.hall.maxHp * 100).toFixed(0)}%"></i><span>Hall ${Math.round(o.hall.hp / o.hall.maxHp * 100)}%</span></div>`}</div>`).join('')}`));
  const log = el('div', 'bpanel', '<h3>Recent reports</h3>'); for (const m of reportLog.slice(-8).reverse()) log.appendChild(el('div', 'blog', `<span class="bt">${fmtT(m.t)}</span> <b>${m.who}:</b> ${m.text}`)); body.appendChild(log);
}
// the war horn: when our side marches it is a big moment; when the enemy marches on us, a warning
export function warHorn(d) {
  const from = B.towns[d.from], tg = B.towns[d.target]; if (!from || !tg) return;
  const ours = from.team === B.myTeam, onUs = tg.team === B.myTeam;
  if (!ours && !onUs) return;
  S.warHorn && S.warHorn(!ours);
  const mine = from === myTown();
  const title = ours ? 'To war!' : 'Enemy attack!';
  const sub = ours ? `${mine ? 'Our' : from.name + "'s"} army of ${d.n} marches ${String(d.dir || '').toLowerCase()} on ${tg.name}` : `${from.name} sends ${d.n} soldiers against ${tg === myTown() ? 'our town' : tg.name}`;
  document.querySelectorAll('.warhorn').forEach(x => x.remove());
  const w = el('div', 'warhorn ' + (ours ? 'ours' : 'theirs'), `<div class="whv"></div><div class="whc"><div class="whi">📯</div><div class="wht">${title}</div><div class="whs">${sub}</div></div>`);
  document.body.appendChild(w); setTimeout(() => w.classList.add('out'), 4200); setTimeout(() => w.remove(), 5000);
  V.addShake(ours ? 0.35 : 0.25);
  if (ours && G.player) { S.battleCry(); V.ring(G.player.pos, 10, '#ffcf60', 1.2); }
  // soldiers marching out raise a cheer of dust at the gate
  if (ours) { const gp = from.gateOut || from.gateIn; if (gp) V.burst('dust', new THREE.Vector3(gp[0], heightAt(gp[0], gp[1]) + 0.5, gp[1]), 60, { speed: 4, size: 1.4, life: 2 }); }
}
// town jobs: the Huntmaster (kill jobs) and the Quartermaster (loot jobs). Each one finished makes the town stronger
function tabJobs(body, t, giver) {
  const Gv = BQ.GIVERS[giver], a = BQ.Q.active[giver], j = BQ.nextFor(giver);
  const done = BQ.JOBS.filter(x => x.giver === giver && BQ.Q.done.includes(x.id));
  const p = el('div', 'bpanel jobp', `<h3>${Gv.title} · ${Gv.role}</h3>`);
  if (!j) p.appendChild(el('p', '', 'Every job is done. The town is as strong as I can make it, Commander.'));
  else {
    const goal = j.kind === 'kill' ? `Kill <b>${j.n}</b>: ${j.where}` : `Bring <b>${j.n} ${j.item}</b> ${j.icon}: ${j.where}`;
    const prog = a ? Math.min(a.have, j.n) : 0;
    p.appendChild(el('div', 'job' + (a ? ' on' : ''), `<div class="jh"><b>${j.name}</b>${a ? (a.ready ? '<span class="jtag">Done: talk to me</span>' : '<span class="jtag">Active</span>') : '<span class="jtag new">New job</span>'}</div><p class="jt">“${j.text}”</p><div class="jg">🎯 ${goal}</div><div class="jr">🏆 <b>${j.reward}</b>${j.gold ? ` · +${j.gold} gold` : ''}</div>${a ? `<div class="wr-bar"><i style="width:${prog / j.n * 100}%"></i></div><div class="jp">${prog} / ${j.n}</div>` : ''}`));
    const row = el('div', 'brow');
    if (!a) { const b = el('button', 'btn gold big', 'Take the job (E)'); b.onclick = () => { BQ.accept(giver); render(); questTrack(); }; row.appendChild(b); }
    else { const b = el('button', 'btn', 'Drop this job'); b.onclick = () => { S.click(); BQ.abandon(giver); render(); questTrack(); }; row.appendChild(b); }
    p.appendChild(row);
  }
  if (done.length) p.appendChild(el('div', 'jdone', 'Done: ' + done.map(x => `<span class="bchip">✓ ${x.name}: ${x.reward}</span>`).join(' ')));
  body.appendChild(p);
}
// quick accept with E straight from the job window
export function jobKey() { if (!G.uiOpen) return false; const g = menu === 'hunt' || menu === 'quarter' ? menu : null; if (!g || BQ.Q.active[g] || !BQ.nextFor(g)) return false; BQ.accept(g); render(); questTrack(); return true; }
// hold Tab: everyone in the game, players first, with their class, level, town and how the fight is going
export function scoreboard(on) {
  let d = document.getElementById('scoreb');
  if (!on) { if (d) d.remove(); clearInterval(scoreboard.iv); return; }
  if (!d) { d = el('div', ''); d.id = 'scoreb'; document.body.appendChild(d); }
  const RN2 = { human: 'Human', orc: 'Orc', highelf: 'High Elf', woodelf: 'Wood Elf', dwarf: 'Dwarf' };
  const fill = () => {
    const rows = [], p = G.player, h = G.save, my = myTown();
    if (p && h) rows.push({ me: true, name: h.name, cls: CLASSES[h.cls].name, race: RN2[h.race] || h.race, lv: h.level, town: my, hp: p.hp, mhp: p.maxHp, dead: p.dead, k: h.kills || 0, de: h.deaths || 0, gear: gearScore(h), who: 'Player' });
    for (const r of MP.remotes.values()) { const t = r.town, info = r.info || {}; rows.push({ name: r.heroName, cls: CLASSES[info.cls] ? CLASSES[info.cls].name : '', race: RN2[info.race] || '', lv: r.lv || 1, town: t, hp: r.hp, mhp: r.maxHp, dead: r.dead, k: r.kills || 0, de: r.deaths || 0, who: 'Player' }); }
    for (const t of B.towns) if (t.hero && t.ai) { const u = t.hero; rows.push({ name: u.heroName || u.udef.name, cls: CLASSES[u.cls] ? CLASSES[u.cls].name : 'Hero', race: RN2[t.race], lv: u.heroLv || 1, town: t, hp: u.hp, mhp: u.maxHp, dead: u.dead, k: u.kills || 0, de: u.deaths || 0, who: 'Computer' }); }
    rows.sort((a, b) => (a.town.team - b.town.team) || (a.who === 'Player' ? -1 : 1) || b.lv - a.lv);
    d.innerHTML = `<div class="sbh"><b>Kingdom Battles</b><span>${fmtT(B.time)} · ${B.towns.filter(t => !t.dead).length} kingdoms standing</span></div>
      <div class="sbr sbk"><span></span><span>Hero</span><span>Class</span><span>Lv</span><span>Town</span><span>Health</span><span>Kills</span><span>Deaths</span></div>` +
      rows.map(r => `<div class="sbr${r.me ? ' me' : ''}${r.town.team === B.myTeam ? ' ally' : ' foe'}"><i style="background:${TEAM_COLORS[r.town.team]}"></i><span><b>${r.name}</b>${r.me ? ' (you)' : ''}<small>${r.who}${r.town.team === B.myTeam ? ' · ally' : ' · enemy'}</small></span><span>${r.cls}<small>${r.race}</small></span><span class="sblv">${r.lv}</span><span>${r.town.name}<small>${TOWN_LEVELS[r.town.level].name}${r.town.dead ? ' · fallen' : ''}</small></span><span>${r.dead ? '<em>Respawning</em>' : `<div class="bprog hp"><i style="width:${Math.max(0, Math.min(100, r.hp / r.mhp * 100)).toFixed(0)}%"></i><span>${Math.ceil(r.hp)}/${Math.round(r.mhp)}</span></div>`}</span><span>${r.k}</span><span>${r.de}</span></div>`).join('') +
      `<div class="sbf">Hold Tab · allies on your team colour, enemies below</div>`;
  };
  fill(); clearInterval(scoreboard.iv); scoreboard.iv = setInterval(fill, 500);
}
const gearScore = (h) => Object.values(h.equip || {}).reduce((a, it) => a + (it && it.kind ? (it.armor || 0) + (it.dmg || 0) : 0), 0);
// the job tracker on the left of the screen
export function questTrack() {
  let d = document.getElementById('bqtrack'); const list = BQ.activeList();
  if (!d) { d = el('div', ''); d.id = 'bqtrack'; document.body.appendChild(d); }
  d.hidden = !list.length;
  d.innerHTML = `<div class="bqh">Town jobs <span>J</span></div>` + list.map(j => `<div class="bqj"><b>${j.name}</b><span>${j.ready ? `✔ Done: hand it in to the ${BQ.GIVERS[j.giver].title} (?)` : `${j.kind === 'kill' ? '☠ Kill' : j.icon + ' ' + j.item}: ${Math.min(j.have, j.n)}/${j.n}`}</span><div class="wr-bar"><i style="width:${Math.min(1, j.have / j.n) * 100}%"></i></div></div>`).join('');
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
// the ability book (K)
let bookTab = 'abil';
export function openBook(tab = 'abil') {
  tab = 'abil';
  const w = $('windows'); if (UI.UI.open === 'book' && bookTab === tab) { UI.closeWin(); return; } w.innerHTML = '';
  bookTab = tab;
  const win = el('div', 'win big bwin book'); const hd = el('header', '', '<div class="booktabs"><button data-t="abil">Abilities <small>K</small></button></div>'); const x = el('button', 'x', '✕'); x.onclick = () => { S.click(); UI.closeWin(); }; hd.appendChild(x);
  hd.querySelectorAll('.booktabs button').forEach(b => { b.onclick = () => { S.click(); bookTab = b.dataset.t; renderBook(); }; });
  const c = el('div', 'content'); win.append(hd, c); w.appendChild(win);
  UI.UI.open = 'book'; G.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock();
  renderBook();
}
// how an ability grows: power by level, from the level it unlocks up to level 10
const GROW_WHAT = { heal: 'healing', mending: 'healing', fielddress: 'healing', barkskin: 'shield', icebarrier: 'shield', shieldwall: 'duration', fortify: 'duration', quickreload: 'duration', eagleeye: 'duration', focus: 'duration', vanish: 'duration', smokebomb: 'duration', rampage: 'duration', bloodrage: 'duration', undying: 'duration', laststand: 'healing', sentry: 'reach', wolves: 'wolves', rally: 'heal and buff', battlecry: 'heal and stun' };
function growLine(a, lv) {
  const sc = (L) => (G.abilScale ? G.abilScale(L) : 1), from = Math.max(1, a.level), now = Math.max(from, lv), what = GROW_WHAT[a.id] || 'damage, area and duration';
  const CAP = LEVEL_CAP, step = CAP / 10, pips = Array.from({ length: 10 }, (_, i) => { const L = Math.round((i + 1) * step); return `<i class="${L < from ? 'off' : L <= now ? 'on' : ''}" title="Level ${L}: ${Math.round(sc(L) * 100)}%"></i>`; }).join('');
  return `<div class="bgrow"><div class="bgp">${pips}</div><span>Power (${what}): <b>${Math.round(sc(from) * 100)}%</b> at level ${from} → <b class="nowv">${Math.round(sc(now) * 100)}% now</b> → <b>${Math.round(sc(LEVEL_CAP) * 100)}%</b> at level ${LEVEL_CAP}</span></div>`;
}
// what holding left click does with a weapon
function holdText(wt) {
  const W = WEAPON_TYPES[wt]; if (!W) return '';
  if (W.kind === 'bow') return 'Draw the bow: the longer you hold, the harder, faster and straighter the arrow (zooms in).';
  if (W.kind === 'gun') return 'Raise the musket and aim down the barrel: a harder, straighter shot (zooms in further).';
  if (W.kind === 'staff') return W.element === 'fire' ? 'Flamethrower: a cone of fire that sets enemies burning, using mana while held.' : W.element === 'frost' ? 'Frost Blast: an icy cone that slows and then freezes, using mana while held.' : 'Arcane Beam: a beam that pierces a whole line, using mana while held.';
  if (['sword', 'swordshield', 'swordmace', 'greatsword'].includes(wt)) return 'Overhead strike: raise the blade and bring it straight down on one enemy for huge damage and a short stun.';
  return 'Heavy blow: wind up and swing through everything in front of you. The longer you hold (up to 1 s), the harder it hits.';
}
function renderBook() {
  const c = document.querySelector('.book .content'); if (!c) return;
  document.querySelectorAll('.booktabs button').forEach(b => b.classList.toggle('on', b.dataset.t === bookTab));
  const t0 = document.getElementById('booktip'); if (t0) t0.hidden = true;
  const h = G.save, cls = h.cls, list = ABILITIES[cls].slice().sort((a, b) => a.level - b.level), res = CLASS_POOLS[cls].uses === 'mana' ? 'mana' : 'endurance';
  const k = G.abilScale ? G.abilScale(h.level) : 1;
  c.innerHTML = '';
  if (Game.hasTrees(cls)) return treesTab(c, h, cls, res);
  abilityTab(c, h, cls, list, res, k);
}
// ---- Weapons tab: your weapons down the left; the chosen one's stats, moves and mastery path on the right ----
let wView = null;
function renderWeapons(c) {
  const h = G.save; c.innerHTML = '';
  const act = Game.activeWeapon(h);
  if (!act) { c.appendChild(el('p', 'dim', 'No weapon in your hands.')); return; }
  const known = [act.wt, ...((BATTLE ? [] : h.wseen) || []).filter(x => WEAPON_TYPES[x] && x !== act.wt && WEAPON_TYPES[x].kind !== 'shield')];
  if (!wView || !known.includes(wView)) wView = act.wt;
  const wt = wView, W = WEAPON_TYPES[wt], fam = familiesOf(wt)[0], m = Game.wm(h, fam), need = masteryXpFor(m.lv), held = wt === act.wt;
  const item = held ? act : { kind: 'weapon', wt, tier: 2, rarity: 0, name: W.name };
  const R = RARITY[item.rarity || 0] || RARITY[0];
  const lay = el('div', 'wm-lay');
  // left: every weapon you know
  const list = el('div', 'wm-list'); list.appendChild(el('h4', '', 'Your weapons'));
  for (const x of known) { const f = familiesOf(x)[0], mm = Game.wm(h, f), nd = masteryXpFor(mm.lv);
    const b = el('button', 'wm-w' + (x === wt ? ' on' : ''), `<div class="bi">${Icons.itemSvg(x === act.wt ? act : { kind: 'weapon', wt: x, tier: 2, rarity: 0 })}</div><div><b>${WEAPON_TYPES[x].name}</b><small>${x === act.wt ? 'In your hands · ' : ''}Skill ${mm.lv}</small><i><u style="width:${Math.round(mm.xp / nd * 100)}%"></u></i></div>`);
    b.onclick = () => { S.click(); wView = x; renderWeapons(c); }; list.appendChild(b); }
  lay.appendChild(list);
  // right: the weapon itself
  const main = el('div', 'wm-main');
  const dmg = held ? Math.round(Game.weaponDamage ? Game.weaponDamage(h, act) : act.dmg || 0) : null, spd = Math.round(Game.speedOf(h, wt) * 100), size = item.size > 1.05 ? 'Heavy' : item.size && item.size < 0.95 ? 'Light' : 'Standard';
  const ring = Math.round(m.xp / need * 100);
  main.appendChild(el('div', 'wm-hero', `<div class="wm-art" style="--rc:${R.col}">${Icons.itemSvg(item)}</div>
    <div class="wm-id"><small style="color:${R.col}">${held ? R.name + ' ' : ''}${W.name}</small><b>${held ? act.name : W.name}</b>
      <div class="wm-chips">${dmg != null ? `<span><i>⚔</i>${dmg}<small>damage</small></span>` : ''}<span><i>⏱</i>${spd}%<small>speed</small></span><span><i>↔</i>${(W.reach || 2.5).toFixed(1)} m<small>reach</small></span><span><i>⚖</i>${size}<small>size</small></span><span><i>✦</i>+${m.lv - 1}%<small>skill damage</small></span></div></div>
    <div class="wm-ring" style="--p:${ring}"><b>${m.lv}</b><small>skill</small><em>${ring}%</em></div>`));
  // moves
  const st = UI.comboSteps(wt).filter(x => !/^Hold/.test(x.n)), L = Game.comboLen(h, wt), sid = RMB_SPECIAL[wt], S2 = sid && WSKILLS[sid];
  const holdName = W.kind === 'bow' ? 'Draw and shoot' : W.kind === 'gun' ? 'Aim down the barrel' : W.kind === 'staff' ? 'Pour out the staff\'s element' : ['sword', 'swordshield', 'swordmace', 'greatsword'].includes(wt) ? 'Overhead strike' : 'Heavy blow';
  const combo = W.kind === 'melee' ? st.map((x, i) => `<i class="${i < L ? 'on' : ''}" title="${x.n}">${i + 1}</i>`).join('') : '';
  const moves = [
    ['LMB', 'Attack', W.kind === 'melee' ? (L === 1 ? st[0].n : `${L}-hit combo`) : st.map(x => x.n.replace('Tap: ', '')).join(', '), 0, W.kind === 'melee' ? st.slice(0, L).map(x => x.n).join(' → ') : '', combo],
    ['HOLD', 'Hold attack', holdName, Game.canHold(h, wt) ? 0 : Game.WM_HOLD, holdText(wt)],
    S2 && ['F', 'Special', S2.name, Game.canSpecial(h, wt) ? 0 : Game.WM_F, S2.desc],
    ['RMB', 'Guard', 'Block', 0, 'Hold to block. Raise it just before a hit to block it completely and stagger the attacker.'],
  ].filter(Boolean);
  main.appendChild(el('div', 'wm-moves', moves.map(([k, lab, name, lock, tip, cmb]) => `<div class="wm-mv${lock ? ' off' : ''}"><kbd>${k}</kbd><div><small>${lab}</small><b>${name}</b>${cmb ? `<div class="wm-cmb">${cmb}</div>` : ''}<p>${tip || ''}</p></div>${lock ? `<em>🔒 Skill ${lock}</em>` : ''}</div>`).join('')));
  // mastery path: what each skill level brings
  if (!BATTLE) {
    const un = Game.weaponUnlocks(wt), top = Math.max(10, ...un.map(u => u.lv), m.lv + 2), steps = [];
    for (let lv = 1; lv <= top; lv++) { const here = un.filter(u => u.lv === lv); steps.push({ lv, txt: here.map(u => u.what).join(' · ') || (lv % 5 === 0 ? 'Faster swings' : ''), big: here.length > 0 }); }
    main.appendChild(el('div', 'wm-path', `<h4>Mastery path <small>hit things with it to raise its skill · speed keeps rising to skill 20 · no cap</small></h4><div class="wm-track">${steps.map(x => `<div class="wm-st${x.lv <= m.lv ? ' got' : ''}${x.lv === m.lv ? ' now' : ''}${x.big ? ' big' : ''}" title="${x.txt}"><i>${x.lv}</i><span>${x.txt}</span></div>`).join('')}</div>`));
  }
  if (!held) main.appendChild(el('p', 'dim wm-note', 'Not in your hands right now. Equip one to train it.'));
  lay.appendChild(main); c.appendChild(lay);
}
// put an ability on the hotbar: in the chosen slot if it fits there (1-5 support, F C Q damage), otherwise the first free slot of its kind
function assignAbility(h, a) {
  const T = HOTBAR_KEYS.length; let i = bookSel;
  if (!slotFits(i, a)) { i = [...Array(T).keys()].find(k => slotFits(k, a) && !h.hotbar[k]); if (i == null) i = [...Array(T).keys()].find(k => slotFits(k, a)); }
  const cur = h.hotbar.findIndex(x => x && x.id === a.id), prev = h.hotbar[i];
  if (cur >= 0) h.hotbar[cur] = prev && slotFits(cur, ABILITIES[h.cls].find(x => x.id === prev.id)) ? prev : null;
  h.hotbar[i] = { t: 'ab', id: a.id }; bookSel = i; G.hooks.hotbarAdded && G.hooks.hotbarAdded([]);
}
function slotBar(h, cls) {
  const bar = el('div', 'st-bar');
  HOTBAR_KEYS.forEach((k, i) => { if (i === SUPPORT_SLOTS) bar.appendChild(el('div', 'st-gap')); const sl = h.hotbar[i], a = sl && ABILITIES[cls].find(x => x.id === sl.id);
    const d = el('button', 'st-slot ' + (i < SUPPORT_SLOTS ? 'sup' : 'dmg') + (i === bookSel ? ' sel' : ''), `<span class="k">${k}</span>${a ? Icons.abilityIcon(a.id) : '<i>+</i>'}`); d.title = (a ? a.name : 'Empty') + (i < SUPPORT_SLOTS ? ' · buffs, songs and heals' : ' · damage abilities');
    d.onclick = () => { S.click(); bookSel = i; renderBook(); }; bar.appendChild(d); });
  return bar;
}
// ---- skill trees: three columns of nodes joined by lines; spend a point on a glowing node to unlock it ----
function bookTipAt(tip, d, html) { tip.innerHTML = html; tip.hidden = false; const r = d.getBoundingClientRect(), tr = tip.getBoundingClientRect(); let x = r.right + 12, y = r.top - 6; if (x + tr.width > innerWidth - 8) x = r.left - tr.width - 12; if (y + tr.height > innerHeight - 8) y = innerHeight - tr.height - 8; tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px'; }
function treesTab(c, h, cls, res) {
  const trees = CLASS_TREES[cls], pts = Game.classPoints(h);
  let tip = document.getElementById('booktip'); if (!tip) { tip = el('div', 'tip big ftip'); tip.id = 'booktip'; document.body.appendChild(tip); } tip.hidden = true;
  // header: class, points, hotbar, reset
  const top = el('div', 'st-top');
  top.appendChild(el('div', 'st-cls', `<div class="st-crest">${Icons.abilityIcon(trees[0].nodes[0].ab || 'charge')}</div><div><b>${CLASSES[cls].name}</b><small>Level ${h.level} · one skill point every level</small></div>`));
  top.appendChild(el('div', 'st-pts' + (pts ? ' have' : ''), `<b>${pts}</b><small>skill point${pts === 1 ? '' : 's'}</small>`));
  top.appendChild(el('div', 'st-barwrap', '<small>Keys 1-5: buffs, songs, heals · F C Q: damage · pick a slot, then click an ability</small>')).appendChild(slotBar(h, cls));
  const rs = el('button', 'btn st-reset', 'Reset points'); rs.onclick = () => { S.click(); Game.resetClass(h); G.hooks.hotbarAdded && G.hooks.hotbarAdded([]); renderBook(); }; top.appendChild(rs);
  c.appendChild(top);
  const wrap = el('div', 'st-trees');
  for (const T of trees) {
    const spent = Game.treeSpent(h, T.id), col = el('div', 'st-tree'); col.style.setProperty('--tc', T.col);
    col.appendChild(el('div', 'st-th', `<div class="st-ti">${Icons.abilityIcon(T.icon)}</div><div><b>${T.name}</b><small>${T.tag}</small></div><span class="st-sp">${spent}</span>`));
    const grid = el('div', 'st-grid'); const rows = Math.max(...T.nodes.map(n => n.row)) + 1; grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'st-lines'); svg.setAttribute('viewBox', `0 0 300 ${rows * 100}`); svg.setAttribute('preserveAspectRatio', 'none');
    const cx = (n) => 50 + n.col * 100, cy = (n) => 50 + n.row * 100;
    for (const n of T.nodes) { const par = n.t === 'ult' ? null : n.req && T.nodes.find(x => x.id === n.req); const own = Game.nodeOwned(h, n);
      if (par) { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('x1', cx(par)); l.setAttribute('y1', cy(par)); l.setAttribute('x2', cx(n)); l.setAttribute('y2', cy(n)); l.setAttribute('class', own ? 'on' : Game.nodeOwned(h, par) ? 'next' : ''); svg.appendChild(l); } }
    grid.appendChild(svg);
    for (const n of T.nodes) {
      const st = Game.nodeState(h, n), a = n.t === 'ab' && ABILITIES[cls].find(x => x.id === n.ab), slot = a ? h.hotbar.findIndex(x => x && x.id === a.id) : -1;
      const d = el('button', `st-node ${n.t} ${st}`, `<div class="st-ic">${Icons.abilityIcon(n.icon)}</div>${slot >= 0 ? `<span class="st-k">${HOTBAR_KEYS[slot]}</span>` : ''}${n.t === 'ult' ? `<span class="st-u">${Math.min(spent, ULT_PTS)}/${ULT_PTS}</span>` : ''}`);
      d.style.gridRow = n.row + 1; d.style.gridColumn = n.col + 1;
      const kind = n.t === 'ab' ? 'Ability' : n.t === 'ult' ? 'Capstone' : 'Passive';
      const how = st === 'owned' ? (a ? (slot >= 0 ? `<em class="ok">On hotbar key ${HOTBAR_KEYS[slot]}</em>` : `<em class="ok">Unlocked: click to put it on your hotbar (${isSupport(a) ? 'keys 1-5' : 'F, C or Q'})</em>`) : '<em class="ok">Unlocked</em>')
        : st === 'open' ? '<em class="go">Click to unlock (1 point)</em>' : st === 'ready' ? '<em class="wait">Next in line: earn a point by levelling up</em>'
        : n.t === 'ult' ? `<em class="no">Spend ${ULT_PTS} points in ${T.name} to open</em>` : `<em class="no">Unlock ${(T.nodes.find(x => x.id === n.req) || {}).name} first</em>`;
      d.onmouseenter = () => bookTipAt(tip, d, `<div class="st-tt" style="--tc:${T.col}"><small>${T.name} · ${kind}</small><b>${n.name}</b>${a ? `<div class="dim">${a.cost} ${res} · every ${a.cd} s</div>` : ''}<p>${n.desc}</p>${how}</div>`);
      d.onmouseleave = () => { tip.hidden = true; };
      d.onclick = () => {
        if (st === 'open') { if (Game.spendClass(h, n)) { S.objective(); d.classList.add('pop'); G.hooks.hotbarAdded && G.hooks.hotbarAdded([]); setTimeout(renderBook, 160); } return; }
        if (st === 'owned' && a) { S.click(); assignAbility(h, a); tip.hidden = true; renderBook(); return; }
        S.error();
      };
      grid.appendChild(d);
    }
    col.appendChild(grid); wrap.appendChild(col);
  }
  c.appendChild(wrap);
}
const FAMILIESN = (f) => ({ dagger: 'Dagger', sword: 'Sword', mace: 'Mace', axe: 'Axe' }[f] || (f.charAt(0).toUpperCase() + f.slice(1)));
function abilityTab(c, h, cls, list, res, k) {
  // ---- hotbar slots ----
  c.appendChild(el('p', 'bookintro', `Keys <b>1-5</b> hold buffs, songs and heals; <b>F C Q</b> hold the abilities that deal damage. Click a slot, then an ability. Every level makes them stronger (now <b>${Math.round(k * 100)}%</b>).`));
  c.appendChild(slotBar(h, cls));
  // ---- abilities: just the names; hover for the details ----
  const grid = el('div', 'bookgrid compact');
  let tip = document.getElementById('booktip'); if (!tip) { tip = el('div', 'tip big ftip'); tip.id = 'booktip'; document.body.appendChild(tip); } tip.hidden = true;
  for (const a of list) {
    const locked = a.level > h.level, slot = h.hotbar.findIndex(s => s && s.id === a.id);
    const d = el('button', 'bookab mini' + (locked ? ' locked' : '') + (slot >= 0 ? ' on' : ''), `<div class="bi">${Icons.abilityIcon(a.id)}</div><div class="bt"><b>${a.name}</b><small>${locked ? '🔒 Level ' + a.level : a.song ? '♪ Song' : 'Level ' + a.level}</small></div>${slot >= 0 ? `<span class="inslot">${HOTBAR_KEYS[slot]}</span>` : ''}`);
    d.onmouseenter = (e) => { tip.innerHTML = `<b style="font-size:16px;color:#fff2c8">${a.name}</b><div class="dim" style="margin:3px 0">${a.song ? 'Song · plays by itself on your hotbar' : `Level ${a.level} · ${a.cost} ${res} · every ${a.cd} s`}</div><div>${a.desc}</div>${growLine(a, h.level)}`; tip.hidden = false; const r = d.getBoundingClientRect(); const tr = tip.getBoundingClientRect(); let x = r.right + 10, y = r.top; if (x + tr.width > innerWidth - 8) x = r.left - tr.width - 10; if (y + tr.height > innerHeight - 8) y = innerHeight - tr.height - 8; tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px'; };
    d.onmouseleave = () => { tip.hidden = true; };
    d.onclick = () => {
      if (locked) { S.error(); UI.toast(`${a.name} unlocks at level ${a.level}`, '🔒', 'bad'); return; }
      S.click(); assignAbility(h, a); tip.hidden = true; renderBook();
    };
    grid.appendChild(d);
  }
  c.appendChild(grid);
}

// ---------- reports to the Commander ----------
const SPEAKERS = { steward: ['Steward', '📜', '#e8c87a'], captain: ['Captain', '⚔', '#ff9a7a'], scout: ['Scout', '🦅', '#9fd0ff'], huntmaster: ['Huntmaster', '🏹', '#a8e070'], quartermaster: ['Quartermaster', '📦', '#ffcf70'] };
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
// loot: a small card that slides in on the right under the map, so the fight stays in view
export function lootPopup(it, equipped) {
  let st = document.getElementById('lootstack'); if (!st) { st = el('div', ''); st.id = 'lootstack'; document.body.appendChild(st); }
  const r = it.rarity || 0, R = RARITY[r];
  const type = it.kind === 'weapon' ? WEAPON_TYPES[it.wt].name : SLOT_LABEL[it.slot] || 'Gear';
  const stat = (it.dmg ? `${it.dmg} damage` : it.armor ? `${it.armor} armour` : '') + Object.entries(it.stats || {}).map(([k, v]) => ` · +${v} ${STAT_NAMES[k]}`).join('');
  const words = ['Loot', 'Nice find', 'Great find!', 'Epic loot!', 'Legendary!'][r];
  const note = equipped ? '<span class="leq">✔ Equipped</span>' : it.lvl > G.save.level ? `<span class="lneed">Needs level ${it.lvl}</span>` : 'In your bag (I)';
  const d = el('div', `lootpop r${r}`, `<div class="lcard" style="--rc:${R.col}"><div class="lic">${Icons.itemSvg(it)}</div><div class="lhead">${words} · ${R.name} ${type}</div><div class="lname">${it.name}</div><div class="lsub">${stat ? `<span class="lstat">${stat}</span> · ` : ''}${note}</div></div>`);
  st.prepend(d); while (st.children.length > 4) st.lastChild.remove();
  const p = G.player;
  if (r >= 1) S.coins(); if (r >= 2) S.loot && S.loot(); if (r >= 3) S.levelUp();
  if (p) { V.burst('gold', p.pos.clone().setY(p.pos.y + 1.4), 12 + r * 14, { speed: 2 + r * 0.6, vy: 2 + r * 0.6, life: 0.9 + r * 0.2 }); if (r >= 3) V.ring(p.pos, 3 + r, R.col, 0.6); }
  const dur = [3000, 3500, 4200, 5000, 6000][r];
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 330); }, dur);
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
