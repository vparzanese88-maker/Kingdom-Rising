import * as THREE from 'three';
import { G, SAVE_KEY } from './state.js';
import { CLASSES } from './classes.js';
import { classDef, ensureSkills, rankOf, spentInTree, canLearn, learn, resetSkills, skillNode, SKILL_LABELS, TIER_REQ } from './skills.js';
import { LOADS, ARMOR_CLASS, RARITY, PERKS, WEAPONS, ABILITIES, MASTERY, ATTRS, ATTR_INFO, MATS, TRADES, RECIPES, STATIONS, SLOT_NAMES, SLOT_ICONS, ZONES, ENEMIES, NPCS, STORY, xpForLevel, xpForMastery, xpForTrade, MAX_LEVEL, MAX_MASTERY, ARMOR_SLOTS } from './data.js';
import { stats, activeWeapon, activeWType, pointsFree, pointsSpent, canUnlock, unlockNode, resetTree, masteryNode, gainTrade, gainXp, masteryPoints } from './stats.js';
import { armorName, equipLoad, loadPoints, itemIcon, armorOf, weaponDmg, sellValue, addItem, addMat, matCount, hasMats, takeMats, gearScore, equipSlotFor, makeGear, rollRarity, randomDrop, BAG_MAX } from './items.js';
import { refreshLook, respawn, ARROW_G } from './player.js';
import { thorneDialog, currentStory, objProgress, fillBounties, turnInBounty, abandonBounty, questEvent } from './quests.js';
import { buildMapImage, zoneAt, levelAt, POI, ISLAND_R } from './world.js';
import { sfx, setVolume, volume } from './audio.js';
import { esc, fmt, clamp, rand } from './util.js';

const $ = id => document.getElementById(id);
const v3 = new THREE.Vector3();
let mapImg = null;

function project(x, y, z) {
  v3.set(x, y, z).project(G.camera);
  if (v3.z > 1) return null;
  return [(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight];
}

// ---------- Floating text ----------
const floaters = [];
export function floatText(pos, text, cls = 'dmg') {
  const el = document.createElement('div');
  el.className = 'ft ' + cls;
  el.textContent = text;
  $('floaters').appendChild(el);
  floaters.push({ el, x: pos.x + rand(-0.3, 0.3), y: pos.y ?? 2, z: pos.z, t: 0, life: cls === 'xp' ? 1.4 : 0.9 });
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    if (f.t > f.life) { f.el.remove(); floaters.splice(i, 1); continue; }
    const s = project(f.x, f.y + f.t * 1.2, f.z);
    if (!s) { f.el.style.display = 'none'; continue; }
    f.el.style.display = '';
    f.el.style.transform = `translate(${s[0]}px,${s[1]}px) translate(-50%,-50%) scale(${f.t < 0.1 ? 1.4 - f.t * 4 : 1})`;
    f.el.style.opacity = f.t > f.life * 0.6 ? 1 - (f.t - f.life * 0.6) / (f.life * 0.4) : 1;
  }
}

// text about the player itself, shown just under the crosshair
export function selfText(text, cls = 'info') {
  const el = document.createElement('div');
  el.className = 'st ' + cls;
  el.textContent = text;
  const box = $('selftext');
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), 1100);
  if (cls === 'hurt') { const v = $('vignette'); v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit'); }
}

// ---------- Toasts & banners ----------
export function toast(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.innerHTML = text;
  const box = $('toasts');
  box.appendChild(el);
  while (box.children.length > 6) box.firstChild.remove();
  setTimeout(() => el.classList.add('fade'), 3800);
  setTimeout(() => el.remove(), 4600);
}
export function lootToast(it) {
  if (typeof it === 'string') return toast(it, 'loot');
  toast(`<span style="color:${RARITY[it.rarity].color}">${itemIcon(it)} ${esc(it.name)}</span> <small>GS ${it.gs}</small>`, 'loot');
}
export function banner(title, sub) {
  const b = $('banner');
  b.innerHTML = `<h2>${title}</h2><p>${sub || ''}</p>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
export function castBar(label, prog) {
  const c = $('castbar');
  if (label === null && prog === undefined) { c.style.display = 'none'; return; }
  c.style.display = 'block';
  if (label) c.querySelector('span').textContent = label;
  c.querySelector('.fill').style.width = `${clamp(prog || 0, 0, 1) * 100}%`;
}
export function bossBar(e) {
  const b = $('bossbar');
  if (!e) { b.style.display = 'none'; return; }
  b.style.display = 'block';
  b.querySelector('.name').textContent = `${e.def.name} · Level ${e.lv}`;
  b.querySelector('.title').textContent = e.def.title || '';
  b.querySelector('.fill').style.width = `${Math.max(0, e.hp / e.maxHp) * 100}%`;
}
export function showDeath() {
  G.unlock?.();
  $('death').style.display = 'flex';
}
export function showVictory() {
  const s = G.p.stats;
  $('victory').innerHTML = `<div class="scroll"><h1>Aeternum Is Free</h1><p>The Corrupted Warden is destroyed and the red glow over the shrine fades. The island will heal.</p>
  <p class="vstats">Level ${G.p.level} · Gear score ${gearScore()} · ${s.kills} kills · ${s.bosses} bosses · ${s.deaths} deaths · ${Math.round(s.playTime / 60)} minutes</p>
  <p>You can keep playing: hunt, gather, craft better gear and take bounties.</p><button id="vclose">Continue</button></div>`;
  $('victory').style.display = 'flex';
  G.unlock?.(); G.noLockNeeded = true;
  $('vclose').onclick = () => { $('victory').style.display = 'none'; G.noLockNeeded = false; G.relock(); };
  sfx('level');
}

// ---------- HUD ----------
export function initUI() {
  const img = buildMapImage(512);
  mapImg = img;
  $('death').querySelector('button').onclick = () => { $('death').style.display = 'none'; respawn(); G.relock(); };
  document.addEventListener('mousemove', e => {
    const tip = $('tooltip');
    if (tip.style.display === 'block') { tip.style.left = Math.min(innerWidth - tip.offsetWidth - 10, e.clientX + 16) + 'px'; tip.style.top = Math.min(innerHeight - tip.offsetHeight - 10, e.clientY + 12) + 'px'; }
  });
  refreshHud(); refreshTracker();
}

export function refreshHud() {
  const p = G.p, e = p.equip;
  const wsl = $('wslots');
  // New World style: the weapon in hand is big, the one on your back small beside it
  const aw = p.activeW === 0 ? e.w1 : e.w2, ow = p.activeW === 0 ? e.w2 : e.w1;
  wsl.innerHTML = `<div class="wname" style="color:${aw ? RARITY[aw.rarity].color : '#aaa'}">${aw ? esc(aw.name) : 'Unarmed'}</div>
    <div class="slot wbig on" title="${aw ? esc(aw.name) : 'Empty'}"><b>${p.activeW + 1}</b>${aw ? WEAPONS[aw.wtype].icon : '✊'}</div>
    <div class="slot wsmall" title="${ow ? esc(ow.name) : 'Empty'}"><b>${2 - p.activeW}</b>${ow ? WEAPONS[ow.wtype].icon : ''}</div>`;
  const wt = activeWType();
  const slots = wt ? p.mastery[wt].slots : [null, null, null];
  $('abils').innerHTML = ['Q', 'R', 'F'].map((k, i) => {
    const A = slots[i] ? ABILITIES[slots[i]] : null;
    return `<div class="slot ab ${A ? '' : 'empty'}" data-ab="${slots[i] || ''}" title="${A ? A.name + ': ' + A.desc : 'Empty: unlock abilities in the Mastery tree (K)'}"><b>${k}</b>${A ? A.icon : ''}<i class="cd"></i><em></em></div>`;
  }).join('');
  // class skills on Z X C V
  const sk = ensureSkills();
  $('cskills').innerHTML = sk.bar.map((id, i) => {
    const n = id ? skillNode(id) : null;
    return `<div class="slot cs ${n ? '' : 'empty'}" data-cs="${id || ''}" title="${n ? `${n.name} (${n.cost} mana): ${n.desc}` : 'Empty: learn class skills with T'}"><b>${SKILL_LABELS[i]}</b>${n ? n.icon : ''}<i class="cd"></i><em></em><u></u></div>`;
  }).join('');
}

let hudT = 0;
export function updateHud(dt) {
  const P = G.player, s = stats(), p = G.p;
  updateFloaters(dt);
  $('hpfill').style.width = `${P.hp / s.maxHp * 100}%`;
  $('hptext').textContent = `${Math.ceil(P.hp)} / ${s.maxHp}`;
  $('hpbar').classList.toggle('poison', !!P.poison);
  $('stfill').style.width = `${P.stam}%`;
  $('stbar').classList.toggle('ex', P.exhausted > 0);
  $('xpfill').style.width = p.level >= MAX_LEVEL ? '100%' : `${p.xp / xpForLevel(p.level) * 100}%`;
  $('lvl').textContent = p.level;
  $('loadtag').textContent = { light: 'Light', medium: 'Medium', heavy: 'Heavy' }[s.load] + ' load';
  $('loadtag').className = s.load;
  // crosshair: red over enemies, spreads while drawing a bow
  const xh = $('xhair');
  xh.classList.toggle('foe', !!G.input.aimEnemy);
  xh.style.setProperty('--gap', `${P.state === 'draw' ? 14 - P.draw * 10 : 6}px`);
  // range-finder while zoomed: distance to the target and where a full-draw arrow drops at 20-50 m
  const zk = G.zoomK || 0, scope = $('scope');
  if (zk > 0.35) {
    scope.style.display = 'block'; scope.style.opacity = Math.min(1, (zk - 0.35) * 3);
    const a = G.input.aimPoint, cam = G.camera;
    const dist = a ? Math.hypot(a.x - P.pos.x, a.y - P.y - 1.5, a.z - P.pos.z) : 0;
    $('scopeDist').textContent = a && dist < 78 ? `${Math.round(dist)} m` : '—';
    const pxPerTan = (innerHeight / 2) / Math.tan(cam.fov * Math.PI / 360), sp = WEAPONS.bow.speed;
    for (const el of scope.querySelectorAll('.tick')) {
      const D = +el.dataset.d, tt = D / sp, drop = 0.5 * ARROW_G * tt * tt;
      el.style.transform = `translateY(${(drop / D) * pxPerTan}px)`;
    }
  } else scope.style.display = 'none';
  $('vignette').classList.toggle('low', P.hp / s.maxHp < 0.3 && P.state !== 'dead');
  drawCompass();
  // cooldowns
  for (const el of $('cskills').children) {
    const id = el.dataset.cs;
    const cd = id ? (P.cds['cls_' + id] || 0) - G.time : 0;
    const max = P.cdMax?.['cls_' + id] || 1;
    el.querySelector('.cd').style.background = cd > 0 ? `conic-gradient(rgba(0,0,0,.72) ${cd / max * 360}deg, transparent 0)` : 'none';
    el.querySelector('em').textContent = cd > 0 ? Math.ceil(cd) : '';
    const n = id ? skillNode(id) : null;
    el.classList.toggle('nomana', !!n && P.mana < n.cost);
  }
  $('mpfill').style.width = `${(P.mana || 0) / (P.maxMana || 1) * 100}%`;
  $('mptext').textContent = `${Math.floor(P.mana || 0)} / ${P.maxMana || 0}`;
  $('shieldfill').style.width = P.shield ? `${Math.min(100, P.shield.amt / s.maxHp * 100)}%` : '0%';
  for (const el of $('abils').children) {
    const id = el.dataset.ab;
    const cd = id ? (P.cds[id] || 0) - G.time : 0;
    const max = P.cdMax?.[id] || 1;
    el.querySelector('.cd').style.background = cd > 0 ? `conic-gradient(rgba(0,0,0,.72) ${cd / max * 360}deg, transparent 0)` : 'none';
    el.querySelector('em').textContent = cd > 0 ? Math.ceil(cd) : '';
  }
  $('q3').innerHTML = `<b>3</b>🧪<em>${matCount('potion') + matCount('big_potion')}</em><i class="cd" style="background:${P.potionCd > 0 ? `conic-gradient(rgba(0,0,0,.72) ${P.potionCd / 12 * 360}deg, transparent 0)` : 'none'}"></i>`;
  const food = p.food && p.food.until > p.stats.playTime;
  $('q4').innerHTML = `<b>4</b>🍗<em>${matCount('cooked_meat') + matCount('stew') + matCount('feast')}</em>`;
  $('q4').classList.toggle('active', !!food);
  // buffs
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.25;
    const buffs = P.buffs.map(b => `<span title="${b.name}">${b.icon}<small>${Math.ceil(b.until - G.time)}</small></span>`);
    if (food) buffs.push(`<span title="${MATS[p.food.id].name}">${MATS[p.food.id].icon}<small>${Math.ceil((p.food.until - p.stats.playTime) / 60)}m</small></span>`);
    if (P.poison) buffs.push(`<span title="Poisoned">🤢</span>`);
    if (P.exhausted > 0) buffs.push(`<span title="Exhausted: no stamina">😮‍💨</span>`);
    $('buffs').innerHTML = buffs.join('');
    const zn = zoneAt(P.pos.x, P.pos.z), Z = ZONES[zn];
    $('zone').innerHTML = `${Z.name}<small>${Z.safe ? 'Safe' : `Level ${Z.lv[0]}-${Z.lv[1]}`}</small>`;
    $('coins').textContent = `🪙 ${fmt(p.coins)}  ·  GS ${gearScore()}`;
    drawMinimap();
    updateMarkers();
  }
  updatePlates();
}

// enemy nameplates
const plates = new Map();
function updatePlates() {
  const P = G.player;
  const seen = new Set();
  for (const e of G.enemies) {
    if (e.dead || e.isAdd && !e.aggro) continue;
    const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
    if (d > 26 || e === G.boss) continue;
    const s = project(e.pos.x, e.y + 2.3 * e.size + 0.2, e.pos.z);
    if (!s) continue;
    seen.add(e);
    let el = plates.get(e);
    if (!el) {
      el = document.createElement('div'); el.className = 'plate';
      const diff = e.lv - G.p.level;
      const col = diff >= 3 ? '#ff5a4a' : diff <= -5 ? '#9a9a9a' : diff >= 1 ? '#ffb04a' : '#e8e0c8';
      el.innerHTML = `<div class="pn"><span style="color:${col}">${e.lv}</span> ${e.def.name}</div><div class="pb"><div></div></div>`;
      $('floaters').appendChild(el); plates.set(e, el);
    }
    el.style.transform = `translate(${s[0]}px,${s[1]}px) translate(-50%,-100%)`;
    el.querySelector('.pb div').style.width = `${Math.max(0, e.hp / e.maxHp) * 100}%`;
    el.classList.toggle('hostile', !!e.aggro);
    el.classList.toggle('winding', e.state === 'windup');
  }
  for (const [e, el] of plates) if (!seen.has(e)) { el.remove(); plates.delete(e); }
}

function updateMarkers() {
  const P = G.player, s = G.p.story;
  for (const n of G.npcs) {
    const m = n.marker;
    const d = Math.hypot(n.x - P.pos.x, n.z - P.pos.z);
    const sc = d < 40 ? project(n.x, m.parent.position.y + m.y, n.z) : null;
    if (!sc) { m.el.style.display = 'none'; continue; }
    let mark = '';
    if (n.id === 'thorne') mark = currentStory() && (s.state === 'complete' || currentStory().obj.kind === 'talk') ? '<b class="q">!</b>' : currentStory() ? '<b class="q dim">…</b>' : '';
    if (n.id === 'board') mark = G.p.bounties.some(b => b.state === 'complete') ? '<b class="q">!</b>' : '';
    m.el.style.display = '';
    m.el.innerHTML = `${mark}<span>${NPCS[n.id].name}</span><small>${NPCS[n.id].role}</small>`;
    m.el.style.transform = `translate(${sc[0]}px,${sc[1]}px) translate(-50%,-100%)`;
  }
  for (const st of G.stations) {
    if (!st.marker) { st.marker = document.createElement('div'); st.marker.className = 'npcmark'; $('floaters').appendChild(st.marker); }
    const d = Math.hypot(st.x - P.pos.x, st.z - P.pos.z);
    const sc = d < 30 ? project(st.x, st.root.position.y + 3.6, st.z) : null;
    if (!sc) { st.marker.style.display = 'none'; continue; }
    st.marker.style.display = '';
    st.marker.innerHTML = `<span>${STATIONS[st.id].name}</span>`;
    st.marker.style.transform = `translate(${sc[0]}px,${sc[1]}px) translate(-50%,-100%)`;
  }
}

export function setPrompt(html) {
  const el = $('prompt');
  if (!html) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  if (el.innerHTML !== html) el.innerHTML = html;
}

// ---------- Quest tracker ----------
export function questTarget() {
  const s = G.p.story, q = currentStory();
  if (!q) return null;
  if (s.state === 'complete' || q.obj.kind === 'talk') return { x: 0, z: -9, label: 'Captain Thorne' };
  const o = q.obj;
  if (o.kind === 'craft') return { x: -14, z: -12, label: 'Forge' };
  if (o.kind === 'boss') return { grimsby: POI.wreck, hag: POI.hut, warden: POI.shrine }[o.enemy];
  if (o.kind === 'kill') {
    if (o.zone === 'ruins') return { x: -175, z: 10, label: 'Ashen Ruins' };
    return { wolf: { x: 45, z: 55, label: 'Greenmeadow' }, lost: { x: 10, z: 175, label: 'Wreckers\' Coast' }, direwolf: { x: 185, z: -20, label: 'Thornwood' } }[o.enemy] || null;
  }
  return null;
}
export function refreshTracker() {
  const s = G.p.story, q = currentStory();
  let h = '';
  if (q) {
    const pr = objProgress(q.obj, s.prog);
    h += `<div class="tq main"><h4>${q.title}</h4><p class="${s.state === 'complete' ? 'done' : ''}">${s.state === 'complete' ? '✔ Return to Captain Thorne' : pr.text}</p></div>`;
  }
  for (const b of G.p.bounties) {
    const pr = objProgress(b.obj, b.prog);
    h += `<div class="tq"><h4>${b.title}</h4><p class="${b.state === 'complete' ? 'done' : ''}">${b.state === 'complete' ? '✔ Turn in at the Bounty Board' : pr.text + (b.obj.where ? ` <small>(${b.obj.where})</small>` : '')}</p></div>`;
  }
  $('tracker').innerHTML = h;
}

// ---------- Compass (top of the screen) ----------
const bearing = (dx, dz) => Math.atan2(dx, -dz); // 0 = north (-z), clockwise
function drawCompass() {
  const cv = $('compass'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, P = G.player;
  const pb = bearing(Math.sin(P.yaw), Math.cos(P.yaw)), span = Math.PI * 0.9;
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(10,8,5,0)'); g.addColorStop(0.15, 'rgba(10,8,5,.6)'); g.addColorStop(0.85, 'rgba(10,8,5,.6)'); g.addColorStop(1, 'rgba(10,8,5,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 4, W, H - 8);
  const xOf = b => { let d = b - pb; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d) > span / 2 ? null : W / 2 + d / span * W; };
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 24; i++) {
    const b = i / 24 * Math.PI * 2, x = xOf(b);
    if (x == null) continue;
    const card = i % 6 === 0;
    ctx.fillStyle = card ? '#f1d58a' : 'rgba(240,230,210,.6)';
    if (card) { ctx.font = 'bold 15px Cinzel, serif'; ctx.fillText('NESW'[i / 6], x, H / 2); }
    else if (i % 3 === 0) { ctx.font = '11px serif'; ctx.fillText(['NE', 'SE', 'SW', 'NW'][(i - 3) / 6], x, H / 2); }
    else ctx.fillRect(x - 0.5, H / 2 - 3, 1, 6);
  }
  const mark = (x, z, col, label) => {
    const px = xOf(bearing(x - P.pos.x, z - P.pos.z)); if (px == null) return;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px, H - 4); ctx.lineTo(px + 5, H - 11); ctx.lineTo(px, H - 18); ctx.lineTo(px - 5, H - 11); ctx.closePath(); ctx.fill();
    if (label) { ctx.font = '10px serif'; ctx.fillStyle = '#e8dcc0'; ctx.fillText(label, px, 6); }
  };
  const t = questTarget();
  if (t) mark(t.x, t.z, '#ffcc33', `${Math.round(Math.hypot(t.x - P.pos.x, t.z - P.pos.z))}m`);
  if (Math.hypot(P.pos.x, P.pos.z) > 45) mark(0, 0, '#9ad0ff');
  ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 1, 2, 2, 8);
}

// ---------- Minimap (turns with you; up is the way you face) ----------
function drawMinimap() {
  const cv = $('minimap'), ctx = cv.getContext('2d');
  const W = cv.width, P = G.player;
  const span = mapImg.span, ppm = mapImg.canvas.width / span; // image pixels per meter
  const view = 130; // meters across
  const k = W / view;
  const rot = -Math.PI / 2 - Math.atan2(Math.cos(P.yaw), Math.sin(P.yaw));
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const toS = (x, z) => { const dx = (x - P.pos.x) * k, dz = (z - P.pos.z) * k; return [W / 2 + dx * cr - dz * sr, W / 2 + dx * sr + dz * cr]; };
  ctx.save();
  ctx.clearRect(0, 0, W, W);
  ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2, 0, 6.28); ctx.clip();
  ctx.fillStyle = '#225c76'; ctx.fillRect(0, 0, W, W);
  ctx.save();
  ctx.translate(W / 2, W / 2); ctx.rotate(rot);
  const big = view * 1.5;
  ctx.drawImage(mapImg.canvas, (P.pos.x + span / 2 - big / 2) * ppm, (P.pos.z + span / 2 - big / 2) * ppm, big * ppm, big * ppm, -big * k / 2, -big * k / 2, big * k, big * k);
  ctx.restore();
  for (const n of G.nodes) {
    if (n.depleted > 0) continue;
    if (Math.abs(n.x - P.pos.x) > view / 1.4 || Math.abs(n.z - P.pos.z) > view / 1.4) continue;
    const [x, y] = toS(n.x, n.z);
    ctx.fillStyle = n.def.skill === 'logging' ? '#c08a4a' : n.def.skill === 'mining' ? (n.type === 'iron' ? '#d0c0b0' : n.type === 'starmetal' ? '#7ac0ff' : '#ffa830') : '#b0ff70';
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  for (const e of G.enemies) {
    if (e.dead) continue;
    const [x, y] = toS(e.pos.x, e.pos.z);
    ctx.fillStyle = e.def.boss ? '#ff2a1a' : e.aggro ? '#ff5040' : '#c04030';
    ctx.beginPath(); ctx.arc(x, y, e.def.boss ? 4 : 2.2, 0, 6.28); ctx.fill();
  }
  for (const n of [...G.npcs, ...G.stations]) { const [x, y] = toS(n.x, n.z); ctx.fillStyle = '#ffe080'; ctx.fillRect(x - 2, y - 2, 4, 4); }
  const t = questTarget();
  if (t) {
    let [x, y] = toS(t.x, t.z);
    const dx = x - W / 2, dy = y - W / 2, d = Math.hypot(dx, dy);
    if (d > W / 2 - 8) { x = W / 2 + dx / d * (W / 2 - 8); y = W / 2 + dy / d * (W / 2 - 8); }
    ctx.fillStyle = '#ffcc33'; ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // north marker on the rim
  const [nx, ny] = (() => { const v = toS(P.pos.x, P.pos.z - 1000); const dx = v[0] - W / 2, dy = v[1] - W / 2, d = Math.hypot(dx, dy); return [W / 2 + dx / d * (W / 2 - 9), W / 2 + dy / d * (W / 2 - 9)]; })();
  ctx.font = 'bold 13px Cinzel, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText('N', nx + 1, ny + 1); ctx.fillStyle = '#f1d58a'; ctx.fillText('N', nx, ny);
  ctx.translate(W / 2, W / 2);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// ---------- Panels ----------
export function closePanel() {
  $('panel').style.display = 'none';
  $('tooltip').style.display = 'none';
  G.ui.open = null;
  G.input.overUI = false;
  if (G.mode === 'game') G.relock();
}
function panel(name, title, html, wide) {
  const el = $('panel');
  el.className = wide ? 'wide' : '';
  el.style.display = 'block';
  el.innerHTML = `<header><h2>${title}</h2><button class="x" id="pclose">✕</button></header><div class="pbody">${html}</div>`;
  $('pclose').onclick = () => { sfx('ui'); closePanel(); };
  G.ui.open = name;
  G.input.lmb = false; G.input.rmb = false;
  G.unlock?.();
  return el;
}
export function togglePanel(name, arg) {
  if (G.ui.open === name) { closePanel(); return; }
  openPanel(name, arg);
}
export function openPanel(name, arg) {
  sfx('ui');
  $('tooltip').style.display = 'none';
  ({ inventory: openInventory, character: openCharacter, skills: openSkills, mastery: openMastery, quests: openQuests, map: openMap, menu: openMenu, station: openStation, merchant: openMerchant, board: openBoard, dialog: openDialog })[name]?.(arg);
}
export function refreshPanel() { if (G.ui.open) openPanel(G.ui.open, G.ui.arg); }

// ---- tooltips ----
function itemTip(it, compare) {
  const R = RARITY[it.rarity];
  let h = `<h3 style="color:${R.color}">${esc(it.name)}</h3><div class="tsub">${R.name} ${it.kind === 'weapon' ? WEAPONS[it.wtype].name : SLOT_NAMES[it.slot]} · Tier ${it.tier}</div>`;
  h += `<div class="gs">Gear Score <b>${it.gs}</b>`;
  if (compare) { const d = it.gs - compare.gs; h += ` <span class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">(${d > 0 ? '+' : ''}${d})</span>`; }
  h += '</div>';
  if (it.kind === 'weapon') {
    const W = WEAPONS[it.wtype];
    h += `<div>Damage <b>${weaponDmg(it)}</b></div><div class="dim">Scales with ${Object.keys(W.scale).map(k => ATTR_INFO[k].name).join(' & ')}</div>`;
  } else if (it.slot !== 'amulet') h += `<div>Armor <b>${armorOf(it)}</b> · <span class="wc ${it.wclass || 'medium'}">${ARMOR_CLASS[it.wclass || 'medium'].name}</span></div>`;
  for (const pk of it.perks) h += `<div class="perk">◆ ${PERKS[pk.id].text(pk.v)}</div>`;
  if (compare) h += `<div class="dim cmp">Equipped: ${esc(compare.name)} (GS ${compare.gs})</div>`;
  return h;
}
function bindTips(root) {
  const tip = $('tooltip');
  root.querySelectorAll('[data-tip]').forEach(el => {
    el.onmouseenter = () => { const f = tipSources[el.dataset.tip]; if (!f) return; tip.innerHTML = f(); tip.style.display = 'block'; };
    el.onmouseleave = () => { tip.style.display = 'none'; };
  });
}
let tipSources = {};

// ---- Inventory ----
let invTab = 'gear';
function openInventory(mode) {
  G.ui.arg = mode;
  const p = G.p, e = p.equip;
  tipSources = {};
  const merchant = mode === 'sell';
  const eqHtml = ['w1', 'w2', 'head', 'chest', 'hands', 'legs', 'feet', 'amulet'].map(k => {
    const it = e[k];
    if (it) tipSources['e' + k] = () => itemTip(it);
    return `<div class="eq ${it ? 'r' + it.rarity : ''}" data-eq="${k}" ${it ? `data-tip="e${k}"` : ''}><div class="ic">${it ? itemIcon(it) : (SLOT_ICONS[k] || (k[0] === 'w' ? '⚔️' : ''))}</div><div><small>${SLOT_NAMES[k]}${k === (p.activeW ? 'w2' : 'w1') ? ' · in hand' : ''}</small><span style="color:${it ? RARITY[it.rarity].color : '#777'}">${it ? esc(it.name) : 'Empty'}</span>${it ? `<small>GS ${it.gs}</small>` : ''}</div></div>`;
  }).join('');
  const bag = p.bag.map((it, i) => {
    const slot = equipSlotFor(it);
    const cmp = it.kind === 'weapon' ? (activeWeapon()) : e[it.slot];
    tipSources['b' + i] = () => itemTip(it, cmp) + `<div class="hint">${merchant ? `Click to sell for ${sellValue(it)} coins` : 'Click to equip · Right-click to salvage'}</div>`;
    const better = cmp ? it.gs > cmp.gs : true;
    return `<div class="bi r${it.rarity}" data-bag="${i}" data-tip="b${i}">${itemIcon(it)}<small>${it.gs}</small>${better && !merchant ? '<i class="up">▲</i>' : ''}</div>`;
  }).join('') + Array(Math.max(0, BAG_MAX - p.bag.length)).fill('<div class="bi empty"></div>').join('');
  const mats = Object.keys(p.mats).filter(k => p.mats[k] > 0).sort((a, b) => (MATS[a].use ? 0 : 1) - (MATS[b].use ? 0 : 1) || (MATS[a].tier || 0) - (MATS[b].tier || 0)).map(k => {
    tipSources['m' + k] = () => `<h3>${MATS[k].icon} ${MATS[k].name}</h3>${MATS[k].desc ? `<div>${MATS[k].desc}</div>` : `<div class="dim">${MATS[k].refined ? 'Refined material' : 'Raw material'}, tier ${MATS[k].tier}</div>`}${merchant ? `<div class="hint">Click to sell one for ${matPrice(k)} coins (shift: all)</div>` : ''}`;
    return `<div class="mi" data-mat="${k}" data-tip="m${k}"><span>${MATS[k].icon}</span>${MATS[k].name}<b>${p.mats[k]}</b></div>`;
  }).join('') || '<p class="dim">No materials yet. Chop trees, mine rocks, harvest plants and skin animals.</p>';
  const s = stats();
  const html = `<div class="inv">
    <div class="eqcol"><div class="gsbig">Gear Score <b>${gearScore()}</b></div>${eqHtml}
      <div class="load ${equipLoad()}"><b>${LOADS[equipLoad()].name}</b> (${loadPoints()} / light up to ${LOADS.light.max}, medium up to ${LOADS.medium.max})<br><small>${LOADS[equipLoad()].desc}</small></div>
      <div class="dim small">HP ${s.maxHp} · Armor ${s.armor} · Crit ${s.crit.toFixed(1)}%</div></div>
    <div class="bagcol">
      <div class="tabs"><button class="${invTab === 'gear' ? 'on' : ''}" data-tab="gear">Gear ${p.bag.length}/${BAG_MAX}</button><button class="${invTab === 'mats' ? 'on' : ''}" data-tab="mats">Materials & Food</button>
      ${invTab === 'gear' ? `<button class="right" id="sortb">Sort</button>${merchant ? '<button id="sellcommon">Sell all Common</button>' : '<button id="salvcommon">Salvage all Common</button>'}` : ''}</div>
      ${invTab === 'gear' ? `<div class="bag">${bag}</div>` : `<div class="mats">${mats}</div>`}
      <p class="dim small">${merchant ? 'Selling to Ilsa. ' : ''}Coins: 🪙 ${p.coins}</p>
    </div></div>`;
  const el = panel('inventory', merchant ? 'Sell to Ilsa' : 'Inventory', html, true);
  G.ui.open = merchant ? 'merchant' : 'inventory';
  G.ui.arg = merchant ? 'sell' : undefined;
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { invTab = b.dataset.tab; refresh(); });
  const refresh = () => merchant ? openInventory('sell') : openInventory();
  el.querySelectorAll('[data-eq]').forEach(d => d.onclick = () => {
    const k = d.dataset.eq;
    if (!e[k]) return;
    if (p.bag.length >= BAG_MAX) { toast('Bag full', 'warn'); return; }
    p.bag.push(e[k]); e[k] = null;
    if (k === 'w1' && p.activeW === 0 && e.w2) p.activeW = 1;
    if (k === 'w2' && p.activeW === 1 && e.w1) p.activeW = 0;
    afterEquip(); refresh();
  });
  el.querySelectorAll('[data-bag]').forEach(d => {
    const i = +d.dataset.bag;
    d.onclick = ev => {
      const it = p.bag[i];
      if (merchant) { p.bag.splice(i, 1); p.coins += sellValue(it); sfx('coins'); refresh(); return; }
      let slot = equipSlotFor(it);
      if (ev.shiftKey && it.kind === 'weapon') slot = slot === 'w1' ? 'w2' : 'w1';
      const old = e[slot];
      e[slot] = it; p.bag.splice(i, 1);
      if (old) p.bag.push(old);
      afterEquip(); sfx('pickup'); refresh();
    };
    d.oncontextmenu = ev => { ev.preventDefault(); if (!merchant) { salvage(i); refresh(); } };
  });
  el.querySelectorAll('[data-mat]').forEach(d => d.onclick = ev => {
    const k = d.dataset.mat;
    if (merchant) { const n = ev.shiftKey ? p.mats[k] : 1; p.mats[k] -= n; p.coins += matPrice(k) * n; if (!p.mats[k]) delete p.mats[k]; sfx('coins'); refresh(); }
  });
  $('sortb')?.addEventListener('click', () => { p.bag.sort((a, b) => b.rarity - a.rarity || b.gs - a.gs); refresh(); });
  $('sellcommon')?.addEventListener('click', () => { let c = 0; p.bag = p.bag.filter(it => { if (it.rarity === 0) { c += sellValue(it); return false; } return true; }); p.coins += c; if (c) sfx('coins'); refresh(); });
  $('salvcommon')?.addEventListener('click', () => { for (let i = p.bag.length - 1; i >= 0; i--) if (p.bag[i].rarity === 0) salvage(i, true); refresh(); });
  bindTips(el);
}
const matPrice = k => MATS[k].price ? Math.max(1, Math.round(MATS[k].price / 4)) : (MATS[k].tier || 1) * (MATS[k].refined ? 3 : 1);
function afterEquip() { refreshLook(); G.statsDirty = true; refreshHud(); const s = stats(); G.player.hp = Math.min(G.player.hp, s.maxHp); }
function salvage(i, quiet) {
  const p = G.p, it = p.bag[i];
  p.bag.splice(i, 1);
  const t = it.tier;
  const out = it.kind === 'weapon' ? [['iron_ingot', 'starmetal_ingot', 'orichalcum_ingot'][t - 1], 1 + it.rarity] : [['leather', 'layered_leather', 'layered_leather'][t - 1], 1 + it.rarity];
  addMat(out[0], out[1]);
  const c = Math.round(sellValue(it) / 3); p.coins += c;
  if (!quiet) toast(`Salvaged ${esc(it.name)}: +${out[1]} ${MATS[out[0]].name}, +${c} coins`, 'loot');
  sfx('craft');
}

// ---- Character ----
function openCharacter() {
  const p = G.p, s = stats();
  const attrs = ATTRS.map(k => `<div class="attr"><div><b>${ATTR_INFO[k].name}</b><small>${ATTR_INFO[k].desc}</small></div><span class="av">${s.attrs[k]}${s.attrs[k] !== p.attrs[k] ? `<small> (${p.attrs[k]})</small>` : ''}</span>${p.attrPts > 0 ? `<button data-attr="${k}">+</button><button data-attr5="${k}">+5</button>` : ''}</div>`).join('');
  const trades = Object.keys(TRADES).map(k => { const t = p.trade[k]; return `<div class="trade"><span>${TRADES[k].icon} ${TRADES[k].name}</span><b>${t.lv}</b><div class="bar"><div style="width:${t.xp / xpForTrade(t.lv) * 100}%"></div></div></div>`; }).join('');
  const w = activeWeapon();
  const C = CLASSES[p.cls];
  const html = `<div class="char">
    <div><h3 class="who">${esc(p.name || 'Castaway')} <small>${C ? `${C.icon} ${C.name} · ${C.role}` : ''}</small></h3>
    <p class="small dim">${C ? C.desc : ''} Skill trees: press T.</p>
    <h3>Level ${p.level}</h3><div class="bar xp"><div style="width:${p.level >= MAX_LEVEL ? 100 : p.xp / xpForLevel(p.level) * 100}%"></div></div><p class="small dim">${p.level >= MAX_LEVEL ? 'Max level' : `${p.xp} / ${xpForLevel(p.level)} XP`}</p>
    <h3>Attributes ${p.attrPts ? `<span class="pts">${p.attrPts} points to spend</span>` : ''}</h3>${attrs}
    <button id="respec" class="small">Reset attribute points</button></div>
    <div><h3>Stats</h3><table class="st">
      <tr><td>Health</td><td>${s.maxHp}</td></tr><tr><td>Armor</td><td>${s.armor} <small>(${Math.round(s.armor / (s.armor + 100 + p.level * 12) * 100)}% vs your level)</small></td></tr>
      <tr><td>Weapon damage</td><td>${w ? Math.round(weaponDmg(w) * s.attrMult) : 8}</td></tr><tr><td>Critical chance</td><td>${s.crit.toFixed(1)}%</td></tr>
      <tr><td>Ability damage</td><td>+${Math.round((s.abilityMult - 1) * 100)}%</td></tr><tr><td>Cooldown reduction</td><td>${Math.round(s.cdr * 100)}%</td></tr>
      ${s.lifesteal ? `<tr><td>Lifesteal</td><td>${s.lifesteal}%</td></tr>` : ''}${s.regen ? `<tr><td>Health regen</td><td>${s.regen}/s</td></tr>` : ''}
      ${s.moveSpeed ? `<tr><td>Move speed</td><td>+${Math.round(s.moveSpeed * 100)}%</td></tr>` : ''}<tr><td>Gear score</td><td>${gearScore()}</td></tr>
      <tr><td>Kills · Deaths</td><td>${p.stats.kills} · ${p.stats.deaths}</td></tr></table>
    <h3>Trade skills</h3>${trades}</div></div>`;
  const el = panel('character', 'Character', html, true);
  el.querySelectorAll('[data-attr]').forEach(b => b.onclick = () => { p.attrs[b.dataset.attr]++; p.attrPts--; G.statsDirty = true; sfx('ui'); openCharacter(); });
  el.querySelectorAll('[data-attr5]').forEach(b => b.onclick = () => { const n = Math.min(5, p.attrPts); p.attrs[b.dataset.attr5] += n; p.attrPts -= n; G.statsDirty = true; sfx('ui'); openCharacter(); });
  $('respec').onclick = () => { let n = 0; for (const k of ATTRS) { n += p.attrs[k] - 5; p.attrs[k] = 5; } p.attrPts += n; G.statsDirty = true; openCharacter(); };
}

// ---- Class skill trees ----
function openSkills() {
  const p = G.p, C = classDef(), sk = ensureSkills();
  tipSources = {};
  const trees = C.trees.map(tr => {
    const spent = spentInTree(tr.id);
    const nodes = tr.nodes.map(n => {
      const r = rankOf(n.id), max = n.type === 'active' ? 1 : n.max || 3;
      const open = spent >= TIER_REQ[n.tier], can = canLearn(n.id);
      const extra = n.type === 'active' ? `${n.cost} mana · ${n.cd}s cooldown` : `Passive · rank ${r}/${max}`;
      tipSources['s' + n.id] = () => `<h3>${n.icon} ${n.name}</h3><div class="tsub">${extra}</div><div>${n.desc}</div>${open ? '' : `<div class="hint">Needs ${TIER_REQ[n.tier]} points in ${tr.name}</div>`}`;
      const slotBtns = n.type === 'active' && r ? `<div class="sb">${SKILL_LABELS.map((k, i) => `<button class="${sk.bar[i] === n.id ? 'on' : ''}" data-cslot="${i}" data-id="${n.id}">${k}</button>`).join('')}</div>` : '';
      return `<div class="node ${n.type} ${r >= max ? 'has' : r ? 'part' : can ? 'can' : ''} ${open ? '' : 'locked'}" data-skill="${n.id}" data-tip="s${n.id}">
        <div class="ni">${n.icon}</div><div class="nn">${n.name}</div>${n.type === 'passive' ? `<div class="rk">${r}/${max}</div>` : ''}${slotBtns}</div>`;
    }).join('<div class="link"></div>');
    return `<div class="stree"><h3>${tr.icon} ${tr.name} <small>${spent} pts</small></h3><p class="dim small">${tr.desc}</p>${nodes}</div>`;
  }).join('');
  const html = `<div class="mhead"><b>${C.icon} ${C.name}</b><span class="pts">${sk.points} skill point${sk.points === 1 ? '' : 's'} to spend</span><span class="dim small">You get one point every level. Round icons are abilities: learn one, then put it on Z, X, C or V.</span><button id="sreset" class="small">Reset trees</button></div>
    <div class="strees">${trees}</div>`;
  const el = panel('skills', `${C.name} Skills`, html, true);
  el.querySelectorAll('[data-skill]').forEach(d => d.onclick = ev => {
    if (ev.target.dataset.cslot) return;
    if (learn(d.dataset.skill)) { sfx('mastery'); refreshHud(); openSkills(); }
  });
  el.querySelectorAll('[data-cslot]').forEach(b => b.onclick = () => {
    const i = +b.dataset.cslot, id = b.dataset.id, bar = sk.bar;
    const j = bar.indexOf(id);
    if (j >= 0) bar[j] = bar[i];
    bar[i] = id;
    sfx('ui'); refreshHud(); openSkills();
  });
  $('sreset').onclick = () => { resetSkills(); refreshHud(); openSkills(); };
  bindTips(el);
}

// ---- Mastery ----
let masTab = null;
function openMastery() {
  const p = G.p;
  masTab = masTab || activeWType() || p.startWeapon || 'sword';
  const wt = masTab, m = p.mastery[wt];
  const tabs = Object.keys(WEAPONS).map(k => `<button class="${k === wt ? 'on' : ''}" data-wt="${k}">${WEAPONS[k].icon} ${WEAPONS[k].name} <small>${p.mastery[k].lv}</small></button>`).join('');
  tipSources = {};
  const rows = [0, 1, 2, 3].map(r => {
    const locked = pointsSpent(wt) < r * 3;
    return `<div class="mrow ${locked ? 'locked' : ''}"><div class="mreq">${r === 0 ? '' : `${r * 3} pts`}</div>${MASTERY[wt].filter(n => n.row === r).map(n => {
      const A = ABILITIES[n.id];
      const has = m.nodes.includes(n.id), can = canUnlock(wt, n.id);
      tipSources['n' + n.id] = () => A ? `<h3>${A.icon} ${A.name}</h3><div class="tsub">Active ability · ${A.cd}s cooldown</div><div>${A.desc}</div>` : `<h3>${n.icon} ${n.name}</h3><div class="tsub">Passive</div><div>${n.desc}</div>`;
      const slotBtns = A && has ? `<div class="sb">${['Q', 'R', 'F'].map((k, i) => `<button class="${m.slots[i] === n.id ? 'on' : ''}" data-slot="${i}" data-id="${n.id}">${k}</button>`).join('')}</div>` : '';
      return `<div class="node ${A ? 'active' : 'passive'} ${has ? 'has' : can ? 'can' : ''}" data-node="${n.id}" data-tip="n${n.id}"><div class="ni">${A ? A.icon : n.icon}</div><div class="nn">${A ? A.name : n.name}</div>${slotBtns}</div>`;
    }).join('')}</div>`;
  }).join('');
  const html = `<div class="tabs mtabs">${tabs}</div>
    <div class="mhead"><b>Mastery ${m.lv}${m.lv >= MAX_MASTERY ? ' (max)' : ''}</b><div class="bar"><div style="width:${m.lv >= MAX_MASTERY ? 100 : m.xp / xpForMastery(m.lv) * 100}%"></div></div><span class="pts">${pointsFree(wt)} point${pointsFree(wt) === 1 ? '' : 's'} free</span><button id="mreset" class="small">Reset tree</button></div>
    <p class="dim small">Earn mastery by fighting with the ${WEAPONS[wt].name}. Round icons are active abilities: unlock one, then put it on Q, R or F. Each row needs points spent in the rows above.</p>
    <div class="tree">${rows}</div>`;
  const el = panel('mastery', 'Weapon Mastery', html, true);
  el.querySelectorAll('[data-wt]').forEach(b => b.onclick = () => { masTab = b.dataset.wt; sfx('ui'); openMastery(); });
  el.querySelectorAll('[data-node]').forEach(d => d.onclick = ev => {
    if (ev.target.dataset.slot) return;
    if (unlockNode(wt, d.dataset.node)) { sfx('mastery'); refreshHud(); openMastery(); }
  });
  el.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
    const i = +b.dataset.slot, id = b.dataset.id;
    const j = m.slots.indexOf(id);
    if (j >= 0) m.slots[j] = m.slots[i];
    m.slots[i] = id;
    sfx('ui'); refreshHud(); openMastery();
  });
  $('mreset').onclick = () => { resetTree(wt); refreshHud(); openMastery(); };
  bindTips(el);
}

// ---- Quests ----
function openQuests() {
  const s = G.p.story, q = currentStory();
  let h = '<h3>Story</h3>';
  STORY.forEach((st, i) => {
    if (i < s.step) h += `<div class="ql done">✔ ${st.title}</div>`;
    else if (i === s.step) h += `<div class="ql cur"><b>${st.title}</b><p>${st.text}</p><p class="obj">${s.state === 'complete' ? '✔ Return to Captain Thorne' : objProgress(st.obj, s.prog).text}</p></div>`;
  });
  if (!q) h += '<div class="ql cur"><b>The End… for now</b><p>You freed Aeternum from the Corruption.</p></div>';
  h += '<h3>Bounties</h3>' + G.p.bounties.map(b => `<div class="ql"><b>${b.title}</b><p class="obj">${b.state === 'complete' ? '✔ Turn in at the Bounty Board' : objProgress(b.obj, b.prog).text}${b.obj.where ? ` · ${b.obj.where}` : ''}</p></div>`).join('');
  panel('quests', 'Journal', h);
}

// ---- Map ----
function openMap() {
  const el = panel('map', 'Map of Aeternum', `<canvas id="bigmap" width="640" height="640"></canvas><p class="dim small">Diamond: current quest. Gold squares: town. Red: bosses. Recall to town with H.</p>`, true);
  const cv = $('bigmap'), ctx = cv.getContext('2d'), W = cv.width;
  ctx.drawImage(mapImg.canvas, 0, 0, W, W);
  const span = mapImg.span, toS = (x, z) => [(x / span + 0.5) * W, (z / span + 0.5) * W];
  ctx.font = 'bold 15px Cinzel, serif'; ctx.textAlign = 'center';
  const labels = [['meadow', 0, 75], ['coast', 0, 190], ['thorn', 195, 0], ['mire', 0, -195], ['ruins', -195, 0]];
  for (const [z, x, y] of labels) {
    const [sx, sy] = toS(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(ZONES[z].name, sx + 1, sy + 1);
    ctx.fillStyle = '#f4e6c0'; ctx.fillText(ZONES[z].name, sx, sy);
    ctx.font = '12px serif'; ctx.fillText(`Level ${ZONES[z].lv[0]}-${ZONES[z].lv[1]}`, sx, sy + 15); ctx.font = 'bold 15px Cinzel, serif';
  }
  const [tx, ty] = toS(0, 0); ctx.fillStyle = '#ffe080'; ctx.fillRect(tx - 5, ty - 5, 10, 10);
  ctx.fillStyle = '#fff'; ctx.font = '12px serif'; ctx.fillText('Windsward', tx, ty - 9);
  for (const [k, poi] of Object.entries(POI)) {
    const [x, y] = toS(poi.x, poi.z);
    ctx.fillStyle = k === 'lostcamp' ? '#d08040' : '#ff3a2a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(poi.name, x, y - 9);
  }
  const t = questTarget();
  if (t) { const [x, y] = toS(t.x, t.z); ctx.fillStyle = '#ffcc33'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  const P = G.player, [px, py] = toS(P.pos.x, P.pos.z);
  ctx.save(); ctx.translate(px, py); ctx.rotate(-P.facing + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

// ---- Menu ----
function openMenu() {
  const html = `<div class="menu">
    <div class="row"><button id="mresume" class="primary">Resume</button><button id="mfs">${document.fullscreenElement ? 'Exit full screen' : 'Full screen'}</button><button id="mview">${G.settings.view === 'first' ? 'Over the shoulder view' : 'First person view'}</button></div>
    ${G.settingsHtml()}
    <div class="card">${G.controlsHtml()}</div>
    <div class="row"><button id="msave">Save now</button><button id="mtitle">Save & quit to title</button><button id="mdel" class="danger">Delete character</button></div>
    <p class="dim small">The game saves itself every 20 seconds in this browser.</p></div>`;
  const el = panel('menu', 'Paused', html, true);
  G.bindSettings(el);
  $('mresume').onclick = closePanel;
  $('mfs').onclick = () => { G.toggleFullscreen(); setTimeout(openMenu, 250); };
  $('mview').onclick = () => { G.setView(G.settings.view === 'first' ? 'third' : 'first'); openMenu(); };
  $('msave').onclick = () => { window.saveGame(); toast('Game saved'); };
  $('mtitle').onclick = () => { window.saveGame(); window.skipSave = true; location.reload(); };
  $('mdel').onclick = () => { if (confirm('Delete your character and start over?')) { localStorage.removeItem(SAVE_KEY); window.skipSave = true; location.reload(); } };
}

// ---- Crafting stations ----
const stationTab = {};
function openStation(id) {
  G.ui.arg = id;
  const p = G.p;
  const list = RECIPES.filter(r => r.station === id);
  let filter = stationTab[id] || 'all';
  const cats = id === 'forge' ? [['weapon', 'Weapons'], ['light', 'Light armor'], ['medium', 'Medium armor'], ['heavy', 'Heavy armor'], ['amulet', 'Amulets']] : [];
  if (id === 'forge' && filter === 'all') filter = 'weapon';
  const skill = id === 'kitchen' ? 'cooking' : 'smithing';
  const sk = p.trade[skill];
  const rows = list.filter(r => filter === 'all' || (filter === 'weapon' ? r.gear === 'weapon' : filter === 'amulet' ? r.slot === 'amulet' : r.wclass === filter)).map(r => {
    const can = hasMats(r.in) && sk.lv >= r.req;
    const name = r.gear ? (r.gear === 'weapon' ? WEAPONS[r.wtype].tiers[r.tier - 1] : (r.slot === 'amulet' ? ['Copper Amulet', 'Silver Amulet', 'Gold Amulet'][r.tier - 1] : armorName(r.wclass, r.slot, r.tier))) : MATS[r.out].name;
    const icon = r.gear ? (r.gear === 'weapon' ? WEAPONS[r.wtype].icon : SLOT_ICONS[r.slot]) : MATS[r.out].icon;
    const ins = Object.entries(r.in).map(([k, n]) => `<span class="${matCount(k) >= n ? 'ok' : 'no'}">${MATS[k].icon} ${MATS[k].name} ${matCount(k)}/${n}</span>`).join('');
    const gsr = r.gear ? craftGsRange(r) : null;
    const maxN = r.gear ? 1 : Math.floor(Math.min(...Object.entries(r.in).map(([k, n]) => matCount(k) / n)));
    return `<div class="rec ${can ? '' : 'cant'}"><div class="ri">${icon}</div><div class="rn"><b>${name}${r.n > 1 ? ` ×${r.n}` : ''}</b>${gsr ? `<small>Gear score ${gsr[0]}-${gsr[1]} · tier ${r.tier}</small>` : MATS[r.out].desc ? `<small>${MATS[r.out].desc}</small>` : ''}<div class="ins">${ins}</div>${sk.lv < r.req ? `<small class="no">Needs ${TRADES[skill].name} ${r.req}</small>` : ''}</div>
      <div class="rb"><button data-craft="${r.id}" ${can ? '' : 'disabled'}>Craft</button>${!r.gear && maxN > 1 && sk.lv >= r.req ? `<button data-craftall="${r.id}">×${Math.min(maxN, 20)}</button>` : ''}</div></div>`;
  }).join('');
  const html = `<p class="dim">${STATIONS[id].desc} ${TRADES[skill].icon} ${TRADES[skill].name} level <b>${sk.lv}</b>${id === 'forge' ? ' raises gear score and the chance of better rarity.' : '.'}</p>
    ${cats.length ? `<div class="tabs">${cats.map(([k, n]) => `<button class="${filter === k ? 'on' : ''}" data-cat="${k}">${n}</button>`).join('')}</div>` : ''}<div class="recs">${rows}</div>`;
  const el = panel('station', STATIONS[id].name, html, true);
  el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { stationTab[id] = b.dataset.cat; openStation(id); });
  el.querySelectorAll('[data-craft]').forEach(b => b.onclick = () => { craft(RECIPES.find(r => r.id === b.dataset.craft), 1); openStation(id); });
  el.querySelectorAll('[data-craftall]').forEach(b => b.onclick = () => { const r = RECIPES.find(x => x.id === b.dataset.craftall); craft(r, Math.min(20, Math.floor(Math.min(...Object.entries(r.in).map(([k, n]) => matCount(k) / n))))); openStation(id); });
}
function nameForArmor(r) { return ({ head: ['Hide Hood', 'Starmetal Helm', 'Orichalcum Helm'], chest: ['Hide Jerkin', 'Starmetal Breastplate', 'Orichalcum Breastplate'], hands: ['Hide Gloves', 'Starmetal Gauntlets', 'Orichalcum Gauntlets'], legs: ['Hide Leggings', 'Starmetal Greaves', 'Orichalcum Greaves'], feet: ['Hide Boots', 'Starmetal Sabatons', 'Orichalcum Sabatons'] })[r.slot][r.tier - 1]; }
function craftGsRange(r) {
  const lv = G.p.trade.smithing.lv;
  const base = [105, 225, 385][r.tier - 1], cap = [215, 375, 560][r.tier - 1];
  return [Math.min(cap, base + lv * 3), Math.min(cap, base + lv * 3 + 45)];
}
function craft(r, n) {
  if (!r || n < 1) return;
  const p = G.p, skill = r.station === 'kitchen' ? 'cooking' : 'smithing';
  if (p.trade[skill].lv < r.req || !hasMats(r.in, n)) return;
  if (r.gear && p.bag.length >= BAG_MAX) { toast('Bag full', 'warn'); return; }
  takeMats(r.in, n);
  if (r.gear) {
    const [a, b] = craftGsRange(r);
    const rar = rollRarity(1 + p.trade.smithing.lv / 10);
    const it = makeGear({ kind: r.gear === 'weapon' ? 'weapon' : 'armor', wtype: r.wtype, slot: r.slot, wclass: r.wclass, gs: Math.round(rand(a, b)), rarity: rar });
    // crafted gear stays inside its tier
    it.gs = Math.min(it.gs, [219, 379, 600][r.tier - 1]);
    addItem(it); lootToast(it);
    p.stats.crafted++;
    questEvent('craft', {});
  } else {
    addMat(r.out, r.n * n);
    toast(`+${r.n * n} ${MATS[r.out].icon} ${MATS[r.out].name}`, 'loot');
  }
  gainTrade(skill, r.xp * n);
  gainXp(r.xp * n * 0.6, true);
  sfx('craft');
}

// ---- Merchant ----
function openMerchant(tab) {
  if (tab === 'sell') return openInventory('sell');
  const p = G.p;
  const goods = ['potion', 'cooked_meat', 'big_potion', 'stew'];
  const extra = [{ id: 'gear', name: 'Mystery Crate', icon: '📦', desc: 'A random piece of gear near your level. Usually common, sometimes better.', price: 40 + p.level * 12 }];
  const rows = goods.map(k => `<div class="rec"><div class="ri">${MATS[k].icon}</div><div class="rn"><b>${MATS[k].name}</b><small>${MATS[k].desc}</small></div><div class="rb"><span class="price">🪙 ${MATS[k].price}</span><button data-buy="${k}" ${p.coins >= MATS[k].price ? '' : 'disabled'}>Buy</button><button data-buy5="${k}" ${p.coins >= MATS[k].price * 5 ? '' : 'disabled'}>×5</button></div></div>`).join('')
    + extra.map(x => `<div class="rec"><div class="ri">${x.icon}</div><div class="rn"><b>${x.name}</b><small>${x.desc}</small></div><div class="rb"><span class="price">🪙 ${x.price}</span><button data-crate="${x.price}" ${p.coins >= x.price ? '' : 'disabled'}>Buy</button></div></div>`).join('');
  const html = `<p>"Fresh from the mainland, or near enough. What do you need?"</p><div class="tabs"><button class="on">Buy</button><button id="tosell">Sell</button></div><div class="recs">${rows}</div><p class="dim">Coins: 🪙 ${p.coins}</p>`;
  const el = panel('merchant', 'Ilsa the Merchant', html, true);
  G.ui.arg = 'buy';
  $('tosell').onclick = () => openInventory('sell');
  el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const k = b.dataset.buy; if (p.coins >= MATS[k].price) { p.coins -= MATS[k].price; addMat(k, 1); sfx('coins'); openMerchant(); } });
  el.querySelectorAll('[data-buy5]').forEach(b => b.onclick = () => { const k = b.dataset.buy5; if (p.coins >= MATS[k].price * 5) { p.coins -= MATS[k].price * 5; addMat(k, 5); sfx('coins'); openMerchant(); } });
  el.querySelectorAll('[data-crate]').forEach(b => b.onclick = () => {
    const price = +b.dataset.crate;
    if (p.coins < price) return;
    if (p.bag.length >= BAG_MAX) { toast('Bag full', 'warn'); return; }
    p.coins -= price;
    const it = randomDrop(p.level, 0.3); addItem(it); lootToast(it); sfx('loot'); openMerchant();
  });
}

// ---- Bounty board ----
function openBoard() {
  fillBounties();
  const rows = G.p.bounties.map((b, i) => `<div class="rec"><div class="ri">${b.obj.kind === 'kill' ? '⚔️' : '📦'}</div><div class="rn"><b>${b.title}</b><small>${objProgress(b.obj, b.prog).text}${b.obj.where ? ` · ${b.obj.where}` : ''}</small><small>Reward: ${b.reward.xp} XP · 🪙 ${b.reward.coins}${b.reward.gear ? ' · gear' : ''}</small></div><div class="rb">${b.state === 'complete' ? `<button data-turn="${i}">Turn in</button>` : `<button data-ab="${i}" class="small">Swap</button>`}</div></div>`).join('');
  const el = panel('board', 'Bounty Board', `<p class="dim">Bounties are always active. Finish one and turn it in here for a reward and a fresh bounty.</p><div class="recs">${rows}</div>`, true);
  el.querySelectorAll('[data-turn]').forEach(b => b.onclick = () => { turnInBounty(+b.dataset.turn); openBoard(); });
  el.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => { abandonBounty(+b.dataset.ab); openBoard(); });
}

// ---- Dialog ----
function openDialog(content) {
  if (!content) { closePanel(); return; }
  const el = panel('dialog', content.title, `<div class="dlg"><p>${content.text}</p><div class="row">${content.buttons.map((b, i) => `<button data-b="${i}">${b.label}</button>`).join('')}<button data-close>Farewell</button></div></div>`);
  el.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const next = content.buttons[+b.dataset.b].fn(); if (next) openDialog(next); else if (G.ui.open === 'dialog') closePanel(); });
  el.querySelector('[data-close]').onclick = closePanel;
}
export function talkTo(npc) {
  if (npc.id === 'thorne') openPanel('dialog', thorneDialog());
  else if (npc.id === 'ilsa') openPanel('merchant');
  else if (npc.id === 'board') openPanel('board');
}
