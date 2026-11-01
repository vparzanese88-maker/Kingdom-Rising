// HUD and windows: bars, ability bar, minimap, nameplates & quest markers, toasts, banners,
// inventory/character, crafting, quest log, map, NPC dialog, merchant, pause menu, settings.
import * as THREE from 'three';
import { G } from './state.js';
import { S, A } from './audio.js';
import { settings, saveSettings, DEFAULT_SETTINGS } from './saves.js';
import { RACES, CLASSES, WEAPON_TYPES, ABILITIES, AREA_UNLOCK_LEVEL, ITEMS, TOOLS, TOOL_TIER_NAMES, QUESTS, NPCS, RARITY, STAT_NAMES, STAT_DESC, xpForLevel, LEVEL_CAP, DUAL_MASTERY, dualRank, ZONES, STATIONS, ARMOR_SLOT_LIST, RANK2_LEVEL, CLASS_POOLS, AREA_CD, TIERS } from './data.js';
import * as Game from './game.js';
import { HALF, heightAt, zoneAt, biomeMasks, VILLAGE, ROADS, RIVER, CAMPS, LAKE, beachMask } from './terrain.js';
import { world } from './world.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const UI = { open: null };

// ---------- toasts / banners ----------
export function toast(text, icon = '', kind = '') {
  const box = $('toasts'); const t = el('div', 'toast ' + kind, `${icon ? icon + ' ' : ''}${esc(text)}`); box.appendChild(t);
  while (box.children.length > 7) box.firstChild.remove();
  setTimeout(() => { t.style.transition = 'opacity .6s'; t.style.opacity = 0; setTimeout(() => t.remove(), 700); }, 4200);
}
let bannerT = null;
export function banner(title, sub = '', ms = 3200) {
  const b = $('banner'); b.querySelector('h2').textContent = title; b.querySelector('p').textContent = sub; b.classList.add('on');
  clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), ms);
}
export function hint(text, ms = 6000) { const h = $('hint'); if (!text) { h.hidden = true; return; } h.innerHTML = text; h.hidden = false; clearTimeout(h._t); h._t = setTimeout(() => h.hidden = true, ms); }

// ---------- ability bar ----------
let abilEls = null;
export function buildAbilityBar() {
  const p = G.player, h = p.h, bar = $('abil'); bar.innerHTML = '';
  const ws = el('div', 'wslots');
  ws.append(el('div', 'slot', ''), el('div', 'slot', ''));
  bar.appendChild(ws);
  const mk = (k, icon) => { const s = el('div', 'slot', `<span>${icon}</span><span class="k">${k}</span><div class="cd" style="display:none"></div>`); bar.appendChild(s); return s; };
  const lmb = mk('LMB', '');
  const rmb = mk('RMB', '');
  bar.appendChild(el('div', 'sep'));
  const ab = ABILITIES[h.cls].map(a => mk(a.key, a.icon));
  bar.appendChild(el('div', 'sep'));
  const pot = mk('R', '🧪'); pot.classList.add('small');
  const f = mk('F', '🛡'); f.classList.add('small');
  abilEls = { ws, lmb, rmb, ab, pot, f };
  refreshAbilityBar();
}
export function refreshAbilityBar() {
  if (!abilEls) return;
  const p = G.player, h = p.h, W = p.W;
  const [w1, w2] = abilEls.ws.children;
  for (const [e, k] of [[w1, 'w1'], [w2, 'w2']]) { const it = h.equip[k]; e.innerHTML = `${it ? Game.itemIcon(it) : '·'}<span class="k">${k === 'w1' ? '1st' : '2nd'}</span>`; e.classList.toggle('active', h.active === k); e.title = it ? it.name : 'Empty'; }
  abilEls.ws.title = 'Q swaps weapons';
  abilEls.lmb.querySelector('span').textContent = W ? Game.itemIcon(p.weapon) : '✊';
  abilEls.lmb.title = W ? (W.kind === 'melee' ? 'Click: 3-hit combo. Hold: heavy attack' : W.kind === 'bow' ? 'Click: quick shot. Hold: power shot' : 'Click: bolt. Hold: charged bolt') : '';
  const rIcon = W ? (W.hands === 'dual' ? '⚔' : W.kind === 'bow' ? '🌧' : W.element === 'fire' ? '☄' : W.element === 'frost' ? '❄' : W.element === 'arcane' ? '✺' : '🌀') : '';
  abilEls.rmb.querySelector('span').textContent = rIcon;
  abilEls.rmb.title = W ? W.areaName + (W.hands === 'dual' ? ` (Dual Wield Mastery rank ${dualRank(h.dualKills)})` : '') : '';
  setLock(abilEls.rmb, h.level < AREA_UNLOCK_LEVEL, AREA_UNLOCK_LEVEL);
  ABILITIES[h.cls].forEach((a, i) => { const e = abilEls.ab[i]; e.title = `${a.name} (${a.cost} ${CLASS_POOLS[h.cls].uses === 'mana' ? 'mana' : 'endurance'}): ${a.desc}`; setLock(e, h.level < a.level, a.level); });
}
function setLock(e, locked, lv) { e.classList.toggle('locked', locked); let l = e.querySelector('.lock'); if (locked && !l) { l = el('div', 'lock', `🔒<br>Lv ${lv}`); e.appendChild(l); } if (!locked && l) l.remove(); }
function setCd(e, left, total) { const c = e.querySelector('.cd'); if (left > 0.05) { c.style.display = ''; c.style.setProperty('--p', (left / total * 100) + '%'); c.textContent = left > 1 ? Math.ceil(left) : left.toFixed(1); e.classList.remove('ready'); } else if (c.style.display !== 'none') { c.style.display = 'none'; e.classList.add('flash'); setTimeout(() => e.classList.remove('flash'), 300); } }

// ---------- HUD per frame ----------
let hudT = 0;
export function updateHUD(dt) {
  const p = G.player, h = p.h;
  $('hpI').style.width = (p.hp / p.maxHp * 100) + '%'; $('hpT').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('manaBar').hidden = p.maxMana <= 0;
  if (p.maxMana > 0) { $('manaI').style.width = (p.mana / p.maxMana * 100) + '%'; $('manaT').textContent = `${Math.floor(p.mana)} / ${p.maxMana} Mana`; }
  $('endI').style.width = (p.end / p.maxEnd * 100) + '%'; $('endT').textContent = `${Math.floor(p.end)} / ${p.maxEnd} Endurance`;
  $('vignette').style.opacity = p.hurtT > 0 ? p.hurtT * 2 : 0;
  $('lowhp').style.opacity = p.hp / p.maxHp < 0.3 ? 0.5 + 0.5 * Math.sin(G.time * 5) : 0;
  if (abilEls) {
    const W = p.W;
    setCd(abilEls.rmb, h.level >= AREA_UNLOCK_LEVEL ? p.cd.area : 0, W ? (W.hands === 'dual' ? AREA_CD.dual : AREA_CD[W.kind]) : 1);
    ABILITIES[h.cls].forEach((a, i) => { setCd(abilEls.ab[i], p.cd['a' + (i + 1)], a.cd); const cost = a.cost, cur = CLASS_POOLS[h.cls].uses === 'mana' ? p.mana : p.end; abilEls.ab[i].style.opacity = h.level >= a.level && cur < cost ? 0.55 : 1; });
    const pc = ['potion_heal2', 'potion_heal', 'crab_cake', 'roast_meat', 'bandage'].reduce((s, k) => s + Game.count(h, k), 0);
    abilEls.pot.querySelector('.n') ? abilEls.pot.querySelector('.n').textContent = pc : abilEls.pot.appendChild(el('span', 'n', pc));
    abilEls.f.classList.toggle('active', p.block);
  }
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.25;
    $('lvlNum').textContent = h.level; $('heroName').textContent = h.name; $('heroCls').textContent = `${RACES[h.race].name} ${CLASSES[h.cls].name}`; $('heroGold').textContent = `🪙 ${h.gold}`;
    const need = xpForLevel(h.level);
    $('xpI').style.width = h.level >= LEVEL_CAP ? '100%' : (h.xp / need * 100) + '%';
    $('xpT').textContent = h.level >= LEVEL_CAP ? `Level ${LEVEL_CAP} (max)` : `Level ${h.level}  ·  ${h.xp} / ${need} XP`;
    const b = []; if (p.buffs.cry > 0) b.push(`📯 Battle Cry ${Math.ceil(p.buffs.cry)}s`); if (p.buffs.fury > 0) b.push(`🐺 Fury ${Math.ceil(p.buffs.fury)}s`); if (p.stealth > 0) b.push(`☁ Unseen ${Math.ceil(p.stealth)}s`); if (p.buffs.nextCrit) b.push('✦ Next hit x2'); if (p.regen) b.push('❤ Regenerating');
    $('buffs').innerHTML = b.map(x => `<div class="b">${x}</div>`).join('');
  }
  // interaction prompt
  const it = !G.uiOpen && !p.gathering && !p.dead ? p.findInteract() : null;
  const pr = $('prompt'); if (it) { pr.hidden = false; pr.innerHTML = `<kbd>E</kbd>${esc(it.label)}`; } else pr.hidden = true;
  // target frame
  const t = G.target;
  if (t && !t.dead && t.pos.distanceTo(p.pos) < 45) { $('target').hidden = false; $('target').querySelector('.nm').innerHTML = `${t.def.elite ? '★ ' : ''}${esc(t.name)} <span style="color:${lvlCol(t.lv, h.level)}">Lv ${t.lv}</span>`; $('target').querySelector('i').style.width = (t.hp / t.maxHp * 100) + '%'; $('target').querySelector('span').textContent = `${Math.ceil(t.hp)} / ${t.maxHp}`; }
  else { $('target').hidden = true; if (t && (t.dead || t.pos.distanceTo(p.pos) > 45)) G.target = null; }
}
function lvlCol(ml, pl) { const d = ml - pl; return d >= 5 ? '#ff4040' : d >= 3 ? '#ff9a40' : d >= -2 ? '#ffe070' : d >= -5 ? '#7ee07a' : '#a0a0a0'; }
export function progress(k, label) { const e = $('progress'); if (k == null) { e.hidden = true; return; } e.hidden = false; e.querySelector('span').textContent = label; e.querySelector('i').style.width = (Math.min(1, k) * 100) + '%'; }

// ---------- nameplates & quest markers ----------
const plates = new Map(); const v3 = new THREE.Vector3();
export function updatePlates() {
  const layer = $('plates'), cam = G.camera, W = innerWidth, H = innerHeight, p = G.player;
  cam.updateMatrixWorld();
  const seen = new Set();
  const show = (key, ent, html, cls, yOff) => {
    seen.add(key);
    let e = plates.get(key); if (!e) { e = el('div', 'plate'); layer.appendChild(e); plates.set(key, e); }
    v3.copy(ent.pos); v3.y += yOff; v3.project(cam);
    if (v3.z > 1 || v3.x < -1.2 || v3.x > 1.2 || v3.y < -1.2 || v3.y > 1.2) { e.style.display = 'none'; return; }
    e.style.display = ''; e.className = 'plate ' + cls;
    if (e._h !== html) { e.innerHTML = html; e._h = html; }
    e.style.left = ((v3.x * 0.5 + 0.5) * W) + 'px'; e.style.top = ((-v3.y * 0.5 + 0.5) * H) + 'px';
  };
  if (!G.uiOpen || UI.open === 'dialog') {
    for (const n of G.npcs) {
      if (!n.def) continue;
      const d = n.pos.distanceTo(p.pos); if (d > 90) continue;
      const mk = Game.npcMarker(p.h, n.id);
      const m = mk === '!' ? '<div class="mk">!</div>' : mk === '?' ? '<div class="mk">?</div>' : mk === 'q' ? '<div class="mk grey">?</div>' : '';
      const name = d < 22 ? `<div class="nm">${esc(n.name)}</div><div class="tt">&lt;${esc(n.def.title)}&gt;</div>` : '';
      if (m || name) show('n' + n.id, n, m + name, 'npc', n.height + 0.25);
    }
    for (const m of G.mobs) {
      if (m.dead) continue;
      const d = m.pos.distanceTo(p.pos); if (d > 32 && m !== G.target) continue;
      if (d > 14 && m.hp >= m.maxHp && m !== G.target) continue;
      const cls = m.def.elite ? 'elite' : m.hostile || m.provoked ? 'hostile' : 'passive';
      show('m' + m.id, m, `<div class="nm">${esc(m.name)} <span style="color:${lvlCol(m.lv, p.level)}">${m.lv}</span></div><div class="hpb"><i style="width:${(m.hp / m.maxHp * 100).toFixed(0)}%"></i></div>`, cls, m.height + 0.35);
    }
  }
  for (const [k, e] of plates) if (!seen.has(k)) { e.remove(); plates.delete(k); }
}

// ---------- map rendering ----------
let mapCanvas = null; const MAPN = 600;
export function buildMapImage() {
  mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = MAPN;
  const g = mapCanvas.getContext('2d'), img = g.createImageData(MAPN, MAPN);
  const c = new THREE.Color();
  for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) {
    const x = -HALF + (i + 0.5) / MAPN * HALF * 2, z = -HALF + (j + 0.5) / MAPN * HALF * 2;
    const h = heightAt(x, z), m = biomeMasks(x, z);
    if (h < 0) c.setRGB(0.12, 0.3 + h * 0.01, 0.48);
    else {
      c.set('#6aa443'); c.lerp(new THREE.Color('#3c7330'), Math.min(1, m.forest)); c.lerp(new THREE.Color('#a08c48'), Math.min(1, m.dry * (1 - m.hl)) * 0.8); c.lerp(new THREE.Color('#7a8a74'), Math.min(1, m.hl)); c.lerp(new THREE.Color('#3a302c'), Math.min(1, m.ash * 1.4));
      if (h < 2.4 && beachMask(x, z) > 0.3) c.set('#dcc68e');
      if (h > 55 && m.ash < 0.3) c.lerp(new THREE.Color('#eef2f6'), Math.min(1, (h - 55) / 20));
      const hx = heightAt(x + 2, z) - h; c.multiplyScalar(1 + Math.max(-0.35, Math.min(0.35, hx * 0.12)));
    }
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r && h < LAKE.y) c.setRGB(0.15, 0.35, 0.55);
    const k = (j * MAPN + i) * 4; img.data[k] = c.r * 255; img.data[k + 1] = c.g * 255; img.data[k + 2] = c.b * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // roads
  g.strokeStyle = 'rgba(120,90,50,.85)'; g.lineWidth = 2;
  for (const r of ROADS) { g.beginPath(); r.forEach(([x, z], i) => { const px = (x + HALF) / (HALF * 2) * MAPN, pz = (z + HALF) / (HALF * 2) * MAPN; i ? g.lineTo(px, pz) : g.moveTo(px, pz); }); g.stroke(); }
}
const toMap = (x, z, N) => [(x + HALF) / (HALF * 2) * N, (z + HALF) / (HALF * 2) * N];
function markers(h) {
  const out = [];
  for (const n of G.npcs) if (n.def) { const mk = Game.npcMarker(h, n.id); if (mk === '!' || mk === '?') out.push({ x: n.pos.x, z: n.pos.z, t: mk }); }
  return out;
}
export function drawMinimap() {
  const cv = $('mini'), g = cv.getContext('2d'), N = cv.width, p = G.player;
  const scale = 2.6; // px per metre on the minimap canvas (canvas is 2x css)
  g.save(); g.clearRect(0, 0, N, N);
  g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#123'; g.fillRect(0, 0, N, N);
  g.translate(N / 2, N / 2); g.rotate(p.yaw + Math.PI);
  const mpp = MAPN / (HALF * 2); // map px per metre
  const [mx, mz] = toMap(p.pos.x, p.pos.z, MAPN);
  g.scale(scale / mpp, scale / mpp);
  g.drawImage(mapCanvas, -mx, -mz);
  g.restore();
  // markers (rotate positions)
  const cs = Math.cos(p.yaw + Math.PI), sn = Math.sin(p.yaw + Math.PI);
  const dot = (x, z, fn) => { const dx = (x - p.pos.x) * scale, dz = (z - p.pos.z) * scale; let rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; const d = Math.hypot(rx, rz), max = N / 2 - 14; let edge = false; if (d > max) { rx *= max / d; rz *= max / d; edge = true; } fn(N / 2 + rx, N / 2 + rz, edge); };
  for (const m of G.mobs) if (!m.dead && m.pos.distanceTo(p.pos) < 70) dot(m.pos.x, m.pos.z, (x, y, e) => { if (e) return; g.fillStyle = m.hostile || m.provoked ? '#ff5040' : '#ffe070'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); });
  g.font = 'bold 30px Cinzel, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k of markers(p.h)) dot(k.x, k.z, (x, y, e) => { g.fillStyle = '#ffd84a'; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText(k.t, x, y); g.fillText(k.t, x, y); });
  // player arrow (always up)
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.moveTo(N / 2, N / 2 - 14); g.lineTo(N / 2 + 9, N / 2 + 10); g.lineTo(N / 2, N / 2 + 5); g.lineTo(N / 2 - 9, N / 2 + 10); g.closePath(); g.stroke(); g.fill();
  // N marker
  dot(p.pos.x, p.pos.z - 1000, (x, y) => { g.font = 'bold 26px Cinzel'; g.fillStyle = '#ffe2a0'; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText('N', x, y); g.fillText('N', x, y); });
  const zn = ZONES.find(z => z.id === G.zone);
  const zl = $('zoneLbl'); const html = `${zn ? zn.name : ''}<small>Level ${zn ? zn.lv : ''}</small>`; if (zl._h !== html) { zl.innerHTML = html; zl._h = html; }
}

// ---------- tracker ----------
export function updateTracker() {
  const h = G.player.h, box = $('tracker'); box.innerHTML = '';
  const act = Object.keys(h.quests.active).map(id => QUESTS.find(q => q.id === id)).slice(-4);
  if (!act.length) {
    const any = QUESTS.find(q => Game.questState(h, q) === 'available');
    if (any) box.innerHTML = `<div class="q"><b>Find someone to help</b><div>Look for a <span style="color:#ffd84a;font-weight:800">!</span> over a villager's head</div></div>`;
    return;
  }
  for (const q of act) {
    const ready = Game.questComplete(h, q);
    const d = el('div', 'q' + (ready ? ' ready' : ''), `<b>${esc(q.title)}</b>` + q.obj.map((o, i) => { const pr = Game.objProgress(h, q, i), n = o.n || 1; return `<div class="${pr >= n ? 'ok' : ''}">${esc(o.label)}${n > 1 ? ` ${pr}/${n}` : pr >= n ? ' ✓' : ''}</div>`; }).join('') + (ready ? `<div class="ok">Return to ${esc(NPCS[q.turnin].name)}</div>` : ''));
    box.appendChild(d);
  }
}

// ---------- windows ----------
const winRoot = () => $('windows');
export function closeWin() {
  winRoot().innerHTML = ''; UI.open = null; G.uiOpen = false;
  if (G.onUiClosed) G.onUiClosed();
}
function openWin(id, title, content, cls = '') {
  winRoot().innerHTML = '';
  const w = el('div', 'win ' + cls); const hd = el('header', '', `<h2>${title}</h2>`); const x = el('button', 'x', '✕'); x.onclick = () => { S.click(); closeWin(); }; hd.appendChild(x);
  const c = el('div', 'content'); if (typeof content === 'string') c.innerHTML = content; else c.appendChild(content);
  w.append(hd, c); winRoot().appendChild(w);
  UI.open = id; G.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock();
  return c;
}
export function toggleWin(id) { if (UI.open === id) { closeWin(); return; } ({ inv: openInventory, quests: openQuestLog, map: openMap, pause: openPause, craft: () => openCrafting(null) })[id]?.(); }

// --- inventory & character ---
let selInv = null;
export function openInventory() {
  const c = openWin('inv', 'Hero', '');
  renderInventory(c);
}
function renderInventory(c) {
  const h = G.player.h, p = G.player, D = Game.heroDerived(h);
  c.innerHTML = '';
  const lay = el('div', 'charlay');
  // equipment
  const left = el('div');
  left.innerHTML = `<h3 style="font-size:20px">${esc(h.name)}</h3><div style="color:var(--dim);margin-bottom:8px">Level ${h.level} ${RACES[h.race].name} ${CLASSES[h.cls].name}</div>`;
  const eg = el('div', 'eqgrid');
  const slotNames = { w1: 'Weapon 1', w2: 'Weapon 2', head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Feet' };
  for (const k of ['w1', 'w2', 'head', 'chest', 'legs', 'feet']) {
    const it = h.equip[k];
    const s = el('div', 'eqslot', `<span class="i">${it ? Game.itemIcon(it) : '·'}</span><div><small>${slotNames[k]}${k === h.active ? ' (in hand)' : ''}</small><span style="color:${it ? RARITY[it.rarity].col : 'var(--dim)'}">${it ? esc(it.name) : 'Empty'}</span></div>`);
    s.style.cursor = it ? 'pointer' : 'default';
    s.onclick = () => { if (it) { selInv = { eq: k }; showTip(tip, it, null, k); } };
    eg.appendChild(s);
  }
  left.appendChild(eg);
  const st = el('div', 'stats');
  const statsHtml = Object.keys(STAT_NAMES).map(k => `<div class="s" title="${STAT_DESC[k]}">${STAT_NAMES[k]}</div><div>${D.stats[k]}</div>`).join('');
  const w = p.weapon;
  st.innerHTML = statsHtml + `<div class="s">Health</div><div>${D.maxHp}</div>` + (D.maxMana ? `<div class="s">Mana</div><div>${D.maxMana}</div>` : '') + `<div class="s">Endurance</div><div>${D.maxEnd}</div><div class="s">Armour</div><div>${D.armor}</div><div class="s">Weapon damage</div><div>${w ? Math.round(Game.weaponDamage(h, w)) : 0}</div><div class="s">Critical chance</div><div>${(D.crit * 100).toFixed(1)}%</div>`;
  left.appendChild(st);
  left.appendChild(el('div', '', `<div style="margin-top:10px;color:var(--dim);font-size:13px">Stats come from your race and your gear. Health, Mana and Endurance also grow with level.</div>`));
  // tools
  const tl = el('div', '', `<div style="margin-top:10px;font-size:14px"><b style="color:var(--gold)">Tools:</b> ${Object.keys(TOOLS).map(t => h.tools[t] ? `${TOOLS[t].icon} ${TOOL_TIER_NAMES[h.tools[t]] || ''} ${TOOLS[t].name}` : `<span style="color:var(--dim)">no ${TOOLS[t].name}</span>`).join(' · ')}</div>`);
  left.appendChild(tl);
  // dual mastery
  if (CLASSES[h.cls].weapons.some(x => WEAPON_TYPES[x].hands === 'dual')) {
    const r = dualRank(h.dualKills), next = DUAL_MASTERY[r];
    const dm = el('div', '', `<div style="margin-top:12px;padding:10px;border:1px solid var(--line);border-radius:8px"><b style="color:var(--gold2);font-family:var(--f-t)">Dual Wield Mastery: Rank ${r}</b><div style="font-size:13px;color:var(--dim)">Kills while dual wielding: ${h.dualKills}${next ? ` · next rank at ${next.kills}` : ' · mastered!'}</div>${DUAL_MASTERY.map(m => `<div style="font-size:13px;${m.rank <= r ? 'color:var(--good)' : 'color:var(--dim)'}">${m.rank <= r ? '✓' : '🔒'} ${m.rank}. <b>${m.name}</b>: ${m.desc}</div>`).join('')}</div>`);
    left.appendChild(dm);
  }
  // bag
  const right = el('div');
  right.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="font-size:18px">Bag</h3><span style="color:#ffd84a">🪙 ${h.gold} gold</span></div>`;
  const grid = el('div', 'grid'); grid.style.marginTop = '8px';
  h.inv.forEach((it, i) => {
    const cell = el('div', 'cell' + (it && it.kind ? ' r' + it.rarity : '') + (selInv && selInv.i === i ? ' sel' : ''), it ? `${Game.itemIcon(it)}${!it.kind ? `<span class="n">${it.n}</span>` : ''}` : '');
    if (it) { cell.title = Game.itemName(it); cell.onclick = () => { selInv = { i }; renderInventory(c); }; cell.ondblclick = () => { quickUse(i); renderInventory(c); }; }
    grid.appendChild(cell);
  });
  right.appendChild(grid);
  const tip = el('div', 'tip', '<span style="color:var(--dim)">Click an item to see it. Double-click to equip or use.</span>');
  right.appendChild(tip);
  lay.append(left, right); c.appendChild(lay);
  if (selInv && selInv.i != null && h.inv[selInv.i]) showTip(tip, h.inv[selInv.i], selInv.i);
  else if (selInv && selInv.eq && h.equip[selInv.eq]) showTip(tip, h.equip[selInv.eq], null, selInv.eq);
  function showTip(tipEl, it, idx, eqSlot) {
    const hh = G.player.h;
    let html = '';
    if (it.kind) {
      html = `<b style="color:${RARITY[it.rarity].col}">${esc(it.name)}</b> <span style="color:var(--dim)">${RARITY[it.rarity].name} · requires level ${it.lvl}</span>`;
      if (it.kind === 'weapon') { const W = WEAPON_TYPES[it.wt]; html += `<div>${W.name} · ${it.dmg} damage · ${W.hands === 'two' ? 'Two-handed' : W.hands === 'dual' ? 'Dual wield' : W.hands === 'shield' ? 'With shield' : W.kind === 'bow' ? 'Ranged' : 'Staff'}</div><div style="color:var(--dim)">Right click: ${W.areaName}</div>`; }
      else html += `<div>${it.armor} armour · ${it.akind} ${it.slot}</div>`;
      html += `<div style="color:var(--good)">${Object.entries(it.stats).map(([k, v]) => `+${v} ${STAT_NAMES[k]}`).join(' · ')}</div>`;
      if (!Game.canEquip(hh, it)) html += `<div style="color:var(--bad)">${CLASSES[hh.cls].name}s can't use this.</div>`;
      // compare
      const cur = it.kind === 'weapon' ? hh.equip[hh.active] : hh.equip[it.slot];
      if (cur && idx != null) html += `<div style="color:var(--dim);font-size:13px">Equipped: ${esc(cur.name)} (${cur.dmg ? cur.dmg + ' dmg' : cur.armor + ' armour'})</div>`;
      html += `<div style="color:#ffd84a;font-size:13px">Sells for ${Game.itemValue(it)} gold</div>`;
    } else { const I = ITEMS[it.id]; html = `<b>${I.icon} ${esc(I.name)}</b> ×${it.n}<div>${esc(I.desc)}</div><div style="color:#ffd84a;font-size:13px">Sells for ${I.value} gold each</div>`; }
    tipEl.innerHTML = html;
    const row = el('div', 'row');
    const b = (t, fn, cls = 'btn') => { const x = el('button', cls, t); x.onclick = () => { S.click(); fn(); renderInventory(c); }; row.appendChild(x); };
    if (idx != null && it.kind === 'weapon') { b('Equip as Weapon 1', () => Game.equipFromInv(hh, idx, 'w1')); b('Equip as Weapon 2', () => Game.equipFromInv(hh, idx, 'w2')); }
    else if (idx != null && it.kind === 'armor') b('Equip', () => Game.equipFromInv(hh, idx));
    else if (idx != null && ITEMS[it.id]?.use) b('Use', () => quickUse(idx));
    if (eqSlot) b('Unequip', () => Game.unequip(hh, eqSlot));
    if (idx != null) b('Destroy', () => { hh.inv[idx] = null; selInv = null; G.hooks.invChanged && G.hooks.invChanged(); }, 'btn red');
    tipEl.appendChild(row);
  }
}
function quickUse(i) { const h = G.player.h, it = h.inv[i]; if (!it) return; if (it.kind) Game.equipFromInv(h, i, it.kind === 'weapon' ? h.active : undefined); else if (ITEMS[it.id]?.use) Game.useItem(h, it.id, G.player); }
export function refreshOpen() { if (UI.open === 'inv') renderInventory(winRoot().querySelector('.content')); if (UI.open === 'craft' && craftState) renderCraft(); }

// --- crafting ---
let craftState = null;
export function openCrafting(station) {
  craftState = { station, cat: 'All', sel: null };
  openWin('craft', station ? STATIONS[station] : 'Recipes', '');
  renderCraft();
}
function renderCraft() {
  const c = winRoot().querySelector('.content'); if (!c) return;
  const h = G.player.h, st = craftState;
  const all = Game.recipesFor(h).filter(r => !st.station || r.station === st.station);
  const cats = ['All', ...new Set(all.map(r => r.cat))];
  c.innerHTML = '';
  const lay = el('div', 'craft');
  const catEl = el('div', 'cats');
  for (const k of cats) { const b = el('button', st.cat === k ? 'on' : '', k); b.onclick = () => { st.cat = k; st.sel = null; renderCraft(); }; catEl.appendChild(b); }
  if (!st.station) catEl.appendChild(el('div', '', '<p style="color:var(--dim);font-size:13px">Walk up to a crafting station and press E to craft there. This list shows every recipe you know.</p>'));
  else catEl.appendChild(el('div', '', `<p style="color:var(--dim);font-size:13px">Showing ${STATIONS[st.station]} recipes. Other stations: workbench, forge, loom, tanning rack, campfire, alchemy table.</p>`));
  const list = el('div', 'rlist');
  const rs = all.filter(r => st.cat === 'All' || r.cat === st.cat).sort((a, b) => (Game.canCraft(h, b) - Game.canCraft(h, a)) || a.lvl - b.lvl);
  for (const r of rs) {
    const can = Game.canCraft(h, r);
    const b = el('button', (st.sel === r ? 'on ' : '') + (can ? 'can' : h.level < r.lvl ? 'no' : ''), `<span class="i">${Game.recipeIcon(r)}</span><div><b>${esc(Game.recipeOutputName(r))}</b><div style="font-size:12px;color:var(--dim)">${STATIONS[r.station]}${h.level < r.lvl ? ` · needs level ${r.lvl}` : ''}</div></div>`);
    b.onclick = () => { st.sel = r; S.click(); renderCraft(); };
    list.appendChild(b);
  }
  if (!st.sel && rs.length) st.sel = rs[0];
  const det = el('div', 'tip');
  if (st.sel) {
    const r = st.sel;
    det.innerHTML = `<b style="font-size:18px">${Game.recipeIcon(r)} ${esc(Game.recipeOutputName(r))}</b><div style="color:var(--dim)">${STATIONS[r.station]} · level ${r.lvl}</div><div style="margin:8px 0">` + Object.entries(r.need).map(([k, n]) => { const have = Game.count(h, k); return `<div class="need"><span>${ITEMS[k].icon} ${ITEMS[k].name}</span><span class="${have >= n ? 'ok' : 'no'}">${have} / ${n}</span></div>`; }).join('') + '</div>';
    if (r.weapon || r.armor) det.innerHTML += `<div style="color:var(--dim);font-size:13px">Crafted gear has a chance to come out Uncommon, Rare or even Epic.</div>`;
    const row = el('div', 'row');
    const atStation = !st.station ? false : true;
    const cb = el('button', 'btn gold', 'Craft'); cb.disabled = !Game.canCraft(h, r) || !atStation;
    cb.onclick = () => { if (Game.craft(h, r)) { renderCraft(); } };
    const cb5 = el('button', 'btn', 'Craft ×5'); cb5.disabled = cb.disabled || !!(r.weapon || r.armor || r.tool);
    cb5.onclick = () => { for (let i = 0; i < 5 && Game.canCraft(h, r); i++) Game.craft(h, r); renderCraft(); };
    row.append(cb, cb5); det.appendChild(row);
    if (!atStation) det.appendChild(el('div', '', `<div style="color:var(--bad);margin-top:6px">Go to a ${STATIONS[r.station]} to craft this.</div>`));
  }
  lay.append(catEl, list, det); c.appendChild(lay);
}

// --- quest log ---
let qSel = null;
export function openQuestLog() {
  const c = openWin('quests', 'Quest Log', '');
  const h = G.player.h;
  const act = Object.keys(h.quests.active).map(id => QUESTS.find(q => q.id === id));
  const lay = el('div', 'qlog'), list = el('div', 'qlist'), det = el('div', 'tip');
  if (!act.length) list.innerHTML = '<p style="color:var(--dim)">No active quests. Look for villagers with a gold ! over their heads.</p>';
  if (!qSel || !act.includes(qSel)) qSel = act[0];
  for (const q of act) { const b = el('button', q === qSel ? 'on' : '', `<b>${esc(q.title)}</b>${Game.questComplete(h, q) ? ' <span style="color:var(--good)">✓</span>' : ''}<div style="font-size:12px;color:var(--dim)">Level ${q.lvl} · ${NPCS[q.giver].name}</div>`); b.onclick = () => { qSel = q; openQuestLog(); }; list.appendChild(b); }
  list.appendChild(el('div', '', `<p style="color:var(--dim);font-size:13px;margin-top:10px">Completed: ${h.quests.done.length} / ${QUESTS.length}</p>`));
  if (qSel) {
    const q = qSel;
    det.innerHTML = `<h3>${esc(q.title)}</h3><p>${esc(q.text)}</p>` + q.obj.map((o, i) => { const pr = Game.objProgress(h, q, i), n = o.n || 1; return `<div class="obj" style="${pr >= n ? 'color:var(--good)' : ''}">${pr >= n ? '✓' : '•'} ${esc(o.label)} ${n > 1 ? `(${pr}/${n})` : ''}</div>`; }).join('') + `<p style="color:var(--dim)">Turn in to: <b>${esc(NPCS[q.turnin].name)}</b></p><div class="reward">Rewards: ${q.xp} XP · ${q.gold || 0} gold${q.gear ? ' · a piece of gear' : ''}${q.items ? ' · ' + Object.entries(q.items).map(([k, n]) => n + ' ' + ITEMS[k].name).join(', ') : ''}</div>`;
    const ab = el('button', 'btn red', 'Abandon quest'); ab.style.marginTop = '10px'; ab.onclick = () => { delete h.quests.active[q.id]; qSel = null; G.hooks.questsChanged(); openQuestLog(); }; det.appendChild(ab);
  }
  lay.append(list, det); c.appendChild(lay);
}

// --- map ---
export function openMap() {
  const c = openWin('map', 'Map of the Realm', '', 'mapwin');
  const N = Math.min(760, Math.floor(Math.min(innerWidth * 0.84, innerHeight * 0.76)));
  const cv = el('canvas'); cv.width = cv.height = N * 2; cv.style.width = cv.style.height = N + 'px'; c.appendChild(cv);
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(mapCanvas, 0, 0, N * 2, N * 2);
  const s = N * 2 / (HALF * 2), P = (x, z) => [(x + HALF) * s, (z + HALF) * s];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lbl = (t, x, z, size = 30, col = '#ffe2a0') => { const [px, pz] = P(x, z); g.font = `700 ${size}px Cinzel, serif`; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(t, px, pz); g.fillStyle = col; g.fillText(t, px, pz); };
  lbl('Driftwood Coast', 0, 470, 30); lbl('Sunmeadow', 0, 250, 30); lbl('Whisperwood', -80, 60, 30); lbl('Frostpeak Highlands', -300, -330, 30, '#e8f2ff'); lbl('The Ashlands', 290, -380, 30, '#ffb090');
  lbl('Seabreak Village', VILLAGE.x, VILLAGE.z - 16, 22, '#fff'); lbl('Ranger Outpost', -40, 44, 20, '#fff'); lbl('Stonewatch', -225, -318, 20, '#fff'); lbl('Emberwatch', 238, -346, 20, '#fff');
  lbl('Bandit Camp', 200, -80, 18, '#ffb0a0'); lbl('Old Ruins', -330, -440, 18, '#ffb0a0'); lbl("Troll King's Throne", -150, -500, 18, '#ffb0a0'); lbl('Volcano', 400, -500, 20, '#ff8060'); lbl('Waterfall', -366, -120, 16, '#bfe8ff');
  for (const k of markers(G.player.h)) { const [px, pz] = P(k.x, k.z); g.font = '900 34px Cinzel'; g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeText(k.t, px, pz - 14); g.fillStyle = '#ffd84a'; g.fillText(k.t, px, pz - 14); }
  const p = G.player; const [px, pz] = P(p.pos.x, p.pos.z);
  g.save(); g.translate(px, pz); g.rotate(-p.yaw + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -18); g.lineTo(12, 14); g.lineTo(0, 7); g.lineTo(-12, 14); g.closePath(); g.stroke(); g.fill(); g.restore();
  c.appendChild(el('p', '', '<span style="color:var(--dim)">Gold ! = quest to pick up · Gold ? = quest to hand in · Press M to close</span>'));
}

// --- NPC dialog ---
export function openDialog(npc) {
  const h = G.player.h; Game.talkTo(h, npc.id);
  const c = openWin('dialog', '', '', 'dialog');
  const render = (view) => {
    c.innerHTML = '';
    const who = el('div', 'who', `<div class="p">${npc.def.race === 'dwarf' ? '🧔' : npc.def.race.includes('elf') ? '🧝' : '🧑'}</div><div><h2 style="font-size:24px">${esc(npc.name)}</h2><div style="color:var(--dim)">${esc(npc.def.title)}</div></div>`);
    c.appendChild(who);
    const { offer, ready, active } = Game.npcQuests(h, npc.id);
    if (!view) {
      c.appendChild(el('div', 'text', esc(npc.def.hello)));
      const opts = el('div', 'opts');
      for (const q of ready) { const b = el('button', '', `<span style="color:#ffd84a;font-weight:900">?</span> ${esc(q.title)} <span style="color:var(--good)">(complete)</span>`); b.onclick = () => { S.click(); render({ turnin: q }); }; opts.appendChild(b); }
      for (const q of offer) { const b = el('button', '', `<span style="color:#ffd84a;font-weight:900">!</span> ${esc(q.title)}`); b.onclick = () => { S.click(); render({ offer: q }); }; opts.appendChild(b); }
      for (const q of active) { const b = el('button', '', `<span style="color:#aaa;font-weight:900">?</span> ${esc(q.title)} <span style="color:var(--dim)">(in progress)</span>`); b.onclick = () => { S.click(); render({ progress: q }); }; opts.appendChild(b); }
      if (npc.def.merchant) { const b = el('button', '', '🪙 Let me see your wares.'); b.onclick = () => { S.click(); openMerchant(npc); }; opts.appendChild(b); }
      const bye = el('button', '', 'Farewell.'); bye.onclick = () => { S.click(); closeWin(); }; opts.appendChild(bye);
      c.appendChild(opts);
    } else if (view.offer) {
      const q = view.offer;
      c.appendChild(el('div', 'text', `<h3>${esc(q.title)}</h3>${esc(q.text)}`));
      c.appendChild(el('div', '', q.obj.map(o => `<div class="obj">• ${esc(o.label)} ${o.n > 1 ? '(' + o.n + ')' : ''}</div>`).join('')));
      c.appendChild(el('div', 'reward', `Rewards: ${q.xp} XP · ${q.gold || 0} gold${q.gear ? ' · gear' : ''}${q.give && q.give.tool ? ' · you receive a ' + TOOLS[q.give.tool[0]].name : ''}`));
      const opts = el('div', 'opts'); opts.style.marginTop = '12px';
      const a = el('button', '', '✔ Accept'); a.style.color = 'var(--good)'; a.onclick = () => { Game.acceptQuest(h, q); toast('Quest accepted: ' + q.title, '📜', 'gold'); render(null); };
      const d = el('button', '', 'Not now.'); d.onclick = () => { S.click(); render(null); };
      opts.append(a, d); c.appendChild(opts);
    } else if (view.turnin) {
      const q = view.turnin;
      c.appendChild(el('div', 'text', `<h3>${esc(q.title)}</h3>${esc(q.done)}`));
      c.appendChild(el('div', 'reward', `Rewards: ${q.xp} XP · ${q.gold || 0} gold${q.gear ? ' · gear' : ''}`));
      const opts = el('div', 'opts'); opts.style.marginTop = '12px';
      const a = el('button', '', '✔ Complete quest'); a.style.color = 'var(--good)'; a.onclick = () => { Game.turnIn(h, q); render(null); }; opts.appendChild(a); c.appendChild(opts);
    } else if (view.progress) {
      const q = view.progress;
      c.appendChild(el('div', 'text', `<h3>${esc(q.title)}</h3>How goes it?`));
      c.appendChild(el('div', '', q.obj.map((o, i) => { const pr = Game.objProgress(h, q, i), n = o.n || 1; return `<div class="obj" style="${pr >= n ? 'color:var(--good)' : ''}">${esc(o.label)} ${pr}/${n}</div>`; }).join('')));
      const opts = el('div', 'opts'); opts.style.marginTop = '12px'; const b = el('button', '', 'I\'ll keep at it.'); b.onclick = () => render(null); opts.appendChild(b); c.appendChild(opts);
    }
  };
  render(null);
}

// --- merchant ---
export function openMerchant(npc) {
  const c = openWin('merchant', esc(npc.name) + "'s Wares", '');
  const render = () => {
    const h = G.player.h; c.innerHTML = `<div style="margin-bottom:8px;color:#ffd84a">🪙 ${h.gold} gold</div>`;
    const lay = el('div', 'charlay');
    const buy = el('div', '', '<h3 style="font-size:18px">Buy</h3>');
    for (const id of Game.merchantStock()) { const pr = Game.buyPrice(id); const b = el('button', 'btn', `${ITEMS[id].icon} ${ITEMS[id].name} · ${pr}g`); b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0'; b.disabled = h.gold < pr; b.onclick = () => { h.gold -= pr; Game.addItem(h, id, 1); S.coins(); render(); }; buy.appendChild(b); }
    const sell = el('div', '', '<h3 style="font-size:18px">Sell (click an item)</h3>');
    const grid = el('div', 'grid'); grid.style.marginTop = '8px';
    h.inv.forEach((it, i) => { const cell = el('div', 'cell' + (it && it.kind ? ' r' + it.rarity : ''), it ? `${Game.itemIcon(it)}${!it.kind ? `<span class="n">${it.n}</span>` : ''}` : ''); if (it) { cell.title = `${Game.itemName(it)}: ${Game.itemValue(it)}g`; cell.onclick = () => { h.gold += Game.itemValue(it); if (it.kind || it.n <= 1) h.inv[i] = null; else it.n--; S.coins(); G.hooks.invChanged(); render(); }; } grid.appendChild(cell); });
    sell.appendChild(grid);
    lay.style.gridTemplateColumns = '260px auto'; lay.append(buy, sell); c.appendChild(lay);
  };
  render();
}

// --- pause, settings, controls ---
export function openPause(onSaveQuit) {
  const c = openWin('pause', 'Paused', '');
  const m = el('div', 'pausemenu');
  const b = (t, fn, cls = 'btn big') => { const x = el('button', cls, t); x.onclick = () => { S.click(); fn(); }; m.appendChild(x); };
  b('Resume', () => closeWin(), 'btn big gold');
  b('Hero & Bag (I)', () => openInventory()); b('Quest Log (L)', () => openQuestLog()); b('Map (M)', () => openMap()); b('Recipes (K)', () => openCrafting(null));
  b('⛶ Full Screen', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); });
  b('Settings', () => openSettings(true)); b('Controls', () => openControls(true));
  b('Save & Quit to Title', () => G.hooks.saveQuit && G.hooks.saveQuit(), 'btn big red');
  c.appendChild(m);
}
export function openSettings(fromPause) {
  const c = openWin('settings', 'Settings', '');
  const g = el('div', 'setgrid');
  const row = (label, input) => { g.appendChild(el('label', '', label)); g.appendChild(input); };
  const range = (k, min, max, step, after) => { const i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = settings[k]; i.oninput = () => { settings[k] = +i.value; saveSettings(); A.applyVolumes(); after && after(); }; return i; };
  const check = (k, after) => { const i = el('input'); i.type = 'checkbox'; i.checked = settings[k]; i.style.width = '22px'; i.style.height = '22px'; i.onchange = () => { settings[k] = i.checked; saveSettings(); after && after(); }; return i; };
  g.appendChild(el('h3', '', 'Display')); g.appendChild(el('div'));
  const fs = el('button', 'btn', document.fullscreenElement ? '⛶ Exit full screen' : '⛶ Go full screen');
  fs.onclick = () => { S.click(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); setTimeout(() => { fs.textContent = document.fullscreenElement ? '⛶ Exit full screen' : '⛶ Go full screen'; }, 300); };
  row('Full screen', fs);
  g.appendChild(el('h3', '', 'Sound')); g.appendChild(el('div'));
  row('Master volume', range('master', 0, 1, 0.05)); row('Music', range('music', 0, 1, 0.05)); row('Sound effects', range('sfx', 0, 1, 0.05)); row('Ambience', range('ambient', 0, 1, 0.05));
  g.appendChild(el('h3', '', 'Controls')); g.appendChild(el('div'));
  row('Mouse sensitivity', range('sens', 0.2, 3, 0.05)); row('Invert mouse Y', check('invertY')); row('Field of view', range('fov', 60, 100, 1));
  g.appendChild(el('h3', '', 'Graphics')); g.appendChild(el('div'));
  const q = el('select'); for (const o of ['low', 'medium', 'high']) { const op = el('option', '', o[0].toUpperCase() + o.slice(1)); op.value = o; q.appendChild(op); } q.value = settings.quality; q.style.cssText = 'padding:6px;background:#1a140e;color:var(--text);border:1px solid var(--line);border-radius:6px;font:inherit';
  q.onchange = () => { settings.quality = q.value; saveSettings(); G.hooks.applyGraphics && G.hooks.applyGraphics(); };
  row('Quality (resolution)', q);
  row('Shadows', check('shadows', () => G.hooks.applyGraphics && G.hooks.applyGraphics())); row('Bloom glow', check('bloom', () => G.hooks.applyGraphics && G.hooks.applyGraphics())); row('Grass', check('grass'));
  row('View distance', range('viewDist', 0.5, 1.5, 0.05, () => G.hooks.applyGraphics && G.hooks.applyGraphics()));
  row('Damage numbers', check('dmgNumbers')); row('Head bob', check('headBob'));
  c.appendChild(g);
  const r = el('div', '', ''); r.style.cssText = 'display:flex;gap:10px;margin-top:14px';
  const reset = el('button', 'btn', 'Reset to defaults'); reset.onclick = () => { Object.assign(settings, DEFAULT_SETTINGS); saveSettings(); A.applyVolumes(); G.hooks.applyGraphics && G.hooks.applyGraphics(); openSettings(fromPause); };
  const back = el('button', 'btn gold', fromPause ? 'Back' : 'Done'); back.onclick = () => { S.click(); fromPause && G.player ? openPause() : closeWin(); };
  r.append(reset, back); c.appendChild(r);
}
export function openControls(fromPause) {
  const c = openWin('controls', 'Controls', '');
  const K = [['W A S D', 'Move'], ['Mouse', 'Look around'], ['Mouse wheel / V', 'Zoom out to third person, or back to first person'], ['Left click', 'Attack. Click again in rhythm for a 3-hit combo'], ['Hold left click', 'Heavy attack (bows: power shot, staffs: charged spell)'], ['Right click', 'Weapon ability (unlocks at level 2): area attack, Meteor, Rain of Arrows, Twin Fury...'], ['1  2  3', 'Class abilities (unlock at levels 3, 6 and 10)'], ['F (hold)', 'Block. Shields block the most'], ['Space', 'Jump'], ['Shift', 'Dodge roll (hold Shift while running forward to sprint)'], ['Q', 'Swap between your two weapons'], ['E', 'Talk, gather, chop, mine, loot, skin, use crafting stations'], ['R', 'Drink a potion or eat food'], ['I or B', 'Hero & bag'], ['L or J', 'Quest log'], ['M', 'Map'], ['K', 'Recipes'], ['Esc', 'Pause menu']];
  const g = el('div', 'keys'); for (const [k, d] of K) { g.appendChild(el('div', '', `<span class="kbd">${k}</span>`)); g.appendChild(el('div', '', d)); }
  c.appendChild(g);
  const back = el('button', 'btn gold', 'Back'); back.style.marginTop = '14px'; back.onclick = () => { S.click(); fromPause && G.player ? openPause() : closeWin(); }; c.appendChild(back);
}
export function confirmBox(text, yes, no = 'Cancel', yesText = 'Yes') {
  const d = el('div', 'confirm', `<div class="panel"><div style="font-size:18px">${text}</div><div class="row"></div></div>`);
  const r = d.querySelector('.row');
  const y = el('button', 'btn red', yesText); y.onclick = () => { d.remove(); yes(); };
  const n = el('button', 'btn', no); n.onclick = () => d.remove();
  r.append(n, y); document.body.appendChild(d);
}
