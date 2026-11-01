// HUD and windows: bars, ability bar, minimap, nameplates & quest markers, toasts, banners,
// inventory/character, crafting, quest log, map, NPC dialog, merchant, pause menu, settings.
import * as THREE from 'three';
import { G } from './state.js';
import { S, A } from './audio.js';
import { settings, saveSettings, DEFAULT_SETTINGS } from './saves.js';
import { RACES, CLASSES, WEAPON_TYPES, ABILITIES, AREA_UNLOCK_LEVEL, ITEMS, TOOLS, TOOL_TIER_NAMES, QUESTS, NPCS, RARITY, STAT_NAMES, STAT_DESC, xpForLevel, LEVEL_CAP, ZONES, STATIONS, ARMOR_SLOT_LIST, RANK2_LEVEL, CLASS_POOLS, TIERS, FAMILIES, WSKILLS, slotSkills, classFamilies, familyTree, COMBOS, SLOT_LABEL, CLASS_TREE, WEAPON_TREE, MASTERY_CAP, masteryXpFor, FOOD_BUFFS } from './data.js';
import * as Game from './game.js';
import * as Icons from './icons.js';
import { HALF, heightAt, zoneAt, biomeMasks, VILLAGE, ROADS, RIVER, CAMPS, LAKE, beachMask } from './terrain.js';
import { world } from './world.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const UI = { open: null };

// ---------- toasts / banners ----------
export function toast(text, icon = '', kind = '') {
  const box = $('toasts'); const t = el('div', 'toast ' + kind, `${icon ? (icon.startsWith('<svg') ? `<span class="ti">${icon}</span>` : icon + ' ') : ''}${esc(text)}`); box.appendChild(t);
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
  ws.append(el('div', 'slot mini', ''), el('div', 'slot mini', ''));
  bar.appendChild(ws);
  const mk = (k, iconHtml, cls = '') => { const s = el('div', 'slot ' + cls, `<span class="ai">${iconHtml}</span><span class="k">${k}</span><div class="cd" style="display:none"></div>`); bar.appendChild(s); return s; };
  const lmb = mk('LMB', '', 'wpn');
  bar.appendChild(el('div', 'sep'));
  const hb = [0, 1, 2, 3, 4, 5].map(i => mk(String(i + 1), '', 'hb'));
  bar.appendChild(el('div', 'sep'));
  const f = mk('RMB', Icons.abilityIcon('shield'), 'small');
  abilEls = { ws, lmb, hb, f };
  refreshAbilityBar();
}
export function refreshAbilityBar() {
  if (!abilEls) return;
  const p = G.player, h = p.h, W = p.W;
  const [w1, w2] = abilEls.ws.children;
  for (const [e, k] of [[w1, 'w1'], [w2, 'w2']]) { const it = h.equip[k]; e.innerHTML = `<span class="ai">${it ? Icons.itemSvg(it) : ''}</span>`; e.classList.toggle('active', h.active === k); e.title = (it ? it.name : 'Empty') + ' (Q swaps)'; }
  abilEls.lmb.querySelector('.ai').innerHTML = W ? Icons.itemSvg(p.weapon) : Icons.abilityIcon('fist');
  abilEls.lmb.title = W ? (W.kind === 'melee' ? 'Left click: attack. ' + (COMBOS[p.weapon.wt] ? COMBOS[p.weapon.wt].trait : '') : W.kind === 'bow' ? 'Left click: shoot' : 'Left click: cast a bolt') : '';
  const sk = p.skills();
  abilEls.f.title = 'Hold right click to block';
  (h.hotbar || []).forEach((sl, i) => {
    const e = abilEls.hb[i], key = sl ? sl.t + ':' + sl.id : '';
    if (e._key !== key) {
      const ai = e.querySelector('.ai');
      e.className = 'slot hb' + (sl && sl.t === 'ab' ? ' cls ' + h.cls : '');
      if (!sl) { ai.innerHTML = ''; e.title = 'Empty'; }
      else if (sl.t === 'ab') { const a = ABILITIES[h.cls].find(x => x.id === sl.id); ai.innerHTML = Icons.abilityIcon(a.id); e.title = `${a.name} (${a.cost} ${CLASS_POOLS[h.cls].uses === 'mana' ? 'mana' : 'endurance'}): ${a.desc}`; }
      else { ai.innerHTML = Icons.itemSvg({ id: sl.id }); e.title = ITEMS[sl.id].name + ': ' + ITEMS[sl.id].desc; }
      if (e._key !== undefined && sl) pop(e);
      e._key = key;
    }
  });
}
function pop(e) { e.classList.add('added'); setTimeout(() => e.classList.remove('added'), 2600); }
function setLock(e, locked, lv) {
  const was = e.classList.contains('locked');
  e.classList.toggle('locked', locked);
  let l = e.querySelector('.lock'); if (locked && !l) { l = el('div', 'lock', `Lv ${lv}`); e.appendChild(l); } if (!locked && l) l.remove();
  if (was && !locked && e._init) { e.classList.add('added'); setTimeout(() => e.classList.remove('added'), 2600); }
  e._init = true;
}
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
    (h.hotbar || []).forEach((sl, i) => {
      const e = abilEls.hb[i];
      if (sl && sl.t === 'ab') { const k = ABILITIES[h.cls].findIndex(a => a.id === sl.id), a = ABILITIES[h.cls][k]; setCd(e, p.cd['a' + (k + 1)], a.cd); const cur = CLASS_POOLS[h.cls].uses === 'mana' ? p.mana : p.end; e.style.opacity = cur < a.cost ? 0.55 : 1; }
      else if (sl && sl.t === 'item') { setCd(e, p.useCd, 1); const n = Game.count(h, sl.id); let ne = e.querySelector('.n'); if (!ne) { ne = el('span', 'n'); e.appendChild(ne); } ne.textContent = n; e.style.opacity = n ? 1 : 0.4; }
      else { setCd(e, 0, 1); e.style.opacity = 1; const ne = e.querySelector('.n'); if (ne) ne.remove(); }
    });
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
    if (p.db) { const L = { bleed: '🩸 Bleeding', poison: '☠ Poisoned', burn: '🔥 Burning', slow: '🐌 Slowed', stun: '💫 Stunned' }; for (const k in p.db) if (p.db[k].t > 0) b.push(`<span style="color:#ff8a7a">${L[k]} ${Math.ceil(p.db[k].t)}s</span>`); }
    if (h.food && h.food.t > 0) { const F = FOOD_BUFFS[h.food.id]; b.push(`🍖 ${F.name} ${Math.ceil(h.food.t / 60)}m`); }
    if (p.buffs.adren > 0) b.push(`⚡ Adrenaline ${Math.ceil(p.buffs.adren)}s`); if (p.buffs.tq > 0) b.push(`✚ Tourniquet ${Math.ceil(p.buffs.tq)}s`); if (p.buffs.surge > 0) b.push(`💧 Mana Surge ${Math.ceil(p.buffs.surge)}s`); if (p.buffs.barrier > 0) b.push(`🛡 Ice Barrier ${Math.round(p.buffs.barrier)}`); if (p.buffs.swind > 0) b.push(`💨 Second Wind ${Math.ceil(p.buffs.swind)}s`);
    $('buffs').innerHTML = b.map(x => `<div class="b">${x}</div>`).join('');
  }
  // interaction prompt
  const it = !G.uiOpen && !p.gathering && !p.dead ? p.findInteract() : null;
  const pr = $('prompt'); if (it) { pr.hidden = false; pr.innerHTML = `<kbd>E</kbd>${esc(it.label)}`; } else pr.hidden = true;
  // target frame
  const t = G.target;
  if (t && !t.dead && t.pos.distanceTo(p.pos) < 45) { $('target').hidden = false; $('target').querySelector('.nm').innerHTML = `<span class="lvb" style="--c:${lvlCol(t.lv, h.level)}">${t.lv}</span> ${t.def.elite ? '★ ' : ''}<span style="color:${lvlCol(t.lv, h.level)}">${esc(t.name)}</span>`; $('target').querySelector('.bar2 i').style.width = (t.hp / t.maxHp * 100) + '%'; $('target').querySelector('.bar2 span').textContent = `${Math.ceil(t.hp)} / ${t.maxHp}`; }
  else { $('target').hidden = true; if (t && (t.dead || t.pos.distanceTo(p.pos) > 45)) G.target = null; }
}
export function lvlCol(ml, pl) { const d = ml - pl; return d >= 3 ? '#ff3a30' : d >= 1 ? '#ffe040' : d === 0 ? '#ffffff' : d >= -2 ? '#4a7aff' : d >= -4 ? '#6ad0ff' : d >= -6 ? '#5ae05a' : '#9a9a9a'; }
export function progress(k, label) { const e = $('progress'); if (k == null) { e.hidden = true; return; } e.hidden = false; e.querySelector('span').textContent = label; e.querySelector('i').style.width = (Math.min(1, k) * 100) + '%'; }

// ---------- nameplates & quest markers ----------
const plates = new Map(); const v3 = new THREE.Vector3();
const HOSTILE_SVG = '<svg viewBox="0 0 64 64"><path d="M8 56 L48 16 M16 8 L56 48" stroke="#140c06" stroke-width="11" stroke-linecap="round"/><path d="M8 56 L48 16 M16 8 L56 48" stroke="#ff4a3a" stroke-width="6" stroke-linecap="round"/><path d="M40 10 L54 10 L54 24 M24 10 L10 10 L10 24" stroke="#ffd0c0" stroke-width="4" fill="none"/></svg>';
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
      const hostile = m.hostile || m.provoked;
      if (d > 14 && m.hp >= m.maxHp && m !== G.target && !hostile) continue;
      const cls = m.def.elite ? 'elite' : m.hostile || m.provoked ? 'hostile' : 'passive';
      const lc = lvlCol(m.lv, p.level), hpP = (m.hp / m.maxHp * 100).toFixed(0);
      show('m' + m.id, m, `<div class="lvrow">${hostile ? `<span class="hos" title="Hostile: attacks on sight">${HOSTILE_SVG}</span>` : ''}<div class="lvb" style="--c:${lc}">${m.def.elite ? '★' : ''}${m.lv}</div></div><div class="nm" style="color:${lc}">${esc(m.name)}</div><div class="hpb"><i style="width:${hpP}%"></i></div>`, cls + (m === G.target ? ' tgt' : ''), m.height + 0.35);
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
  UI.open = id; G.uiOpen = true; G.uiClosedAt = performance.now(); if (document.pointerLockElement) document.exitPointerLock();
  return c;
}
export function toggleWin(id) { if (UI.open === id || (UI.open === 'skills' && (id === 'talents' || id === 'skills') && skTab === (id === 'talents' ? 'class' : 'weapon'))) { closeWin(); return; } ({ inv: openInventory, quests: openQuestLog, map: openMap, pause: openPause, skills: () => openSkills('weapon'), talents: () => openSkills('class'), craft: () => openCrafting(null) })[id]?.(); }

// --- inventory & character (EverQuest style: your hero in the middle, gear slots all around) ---
let selInv = null;
const LEFT_SLOTS = ['head', 'neck', 'shoulders', 'back', 'chest', 'wrists'];
const RIGHT_SLOTS = ['hands', 'waist', 'legs', 'feet', 'ring1', 'ring2'];
const BOTTOM_SLOTS = ['w1', 'w2', 'trinket'];
const SLOT_HINT = { head: 'helm', neck: 'amulet', shoulders: 'shoulders', back: 'cloak', chest: 'chest', wrists: 'wrists', hands: 'hands', waist: 'waist', legs: 'legs', feet: 'boots', ring1: 'ring', ring2: 'ring', trinket: 'charm', w1: 'sword', w2: 'sword' };
export function openInventory() {
  const c = openWin('inv', 'Hero', '', 'big');
  renderInventory(c);
}
function slotEl(h, k, tipEl, c) {
  const it = h.equip[k];
  const d = el('div', 'eq' + (it ? ' r' + (it.rarity || 0) : ' empty') + (k === h.active ? ' active' : ''));
  d.innerHTML = `<div class="ic">${it ? Icons.itemSvg(it) : Icons.itemSvg(ghost(SLOT_HINT[k]))}</div><div class="lb">${SLOT_LABEL[k]}${k === h.active ? ' ✦' : ''}</div>`;
  d.onmouseenter = () => { if (it) showTip(tipEl, it, null, k, c); };
  d.onclick = () => { if (it) { S.click(); selInv = { eq: k }; showTip(tipEl, it, null, k, c, true); } };
  d.ondblclick = () => { if (it) { Game.unequip(h, k); renderInventory(c); } };
  return d;
}
function ghost(kind) {
  const m = { helm: { kind: 'armor', akind: 'mail', slot: 'head', tier: 0 }, amulet: { kind: 'acc', slot: 'neck', tier: 1 }, shoulders: { kind: 'armor', akind: 'mail', slot: 'shoulders', tier: 0 }, cloak: { kind: 'acc', slot: 'back', tier: 1 }, chest: { kind: 'armor', akind: 'mail', slot: 'chest', tier: 0 }, wrists: { kind: 'armor', akind: 'leather', slot: 'wrists', tier: 0 }, hands: { kind: 'armor', akind: 'leather', slot: 'hands', tier: 0 }, waist: { kind: 'armor', akind: 'leather', slot: 'waist', tier: 0 }, boots: { kind: 'armor', akind: 'leather', slot: 'feet', tier: 0 }, ring: { kind: 'acc', slot: 'ring', tier: 1 }, charm: { kind: 'acc', slot: 'trinket', tier: 1 }, sword: { kind: 'weapon', wt: 'greatsword', tier: 0 } };
  return Object.assign({ rarity: 0 }, m[kind]);
}
function renderInventory(c) {
  const h = G.player.h, p = G.player, D = Game.heroDerived(h);
  c.innerHTML = '';
  const lay = el('div', 'invlay');
  const tip = el('div', 'tip big', '<span style="color:var(--dim)">Hover over an item to inspect it. Click to select, double-click to equip, use or take off.</span>');
  // paper doll
  const doll = el('div', 'doll');
  const L = el('div', 'col'), R = el('div', 'col');
  LEFT_SLOTS.forEach(k => L.appendChild(slotEl(h, k, tip, c)));
  RIGHT_SLOTS.forEach(k => R.appendChild(slotEl(h, k, tip, c)));
  const mid = el('div', 'mid');
  mid.innerHTML = `<div class="who"><b>${esc(h.name)}</b><span>Level ${h.level} ${RACES[h.race].name} ${CLASSES[h.cls].name}</span></div><canvas id="portrait" width="560" height="680"></canvas>`;
  const bot = el('div', 'botrow'); BOTTOM_SLOTS.forEach(k => bot.appendChild(slotEl(h, k, tip, c)));
  mid.appendChild(bot);
  doll.append(L, mid, R);
  // stats
  const st = el('div', 'statbox');
  const w = p.weapon;
  st.innerHTML = `<div class="sg">${Object.keys(STAT_NAMES).map(k => `<div title="${STAT_DESC[k]}"><span>${STAT_NAMES[k]}</span><b>${D.stats[k]}</b></div>`).join('')}</div>
    <div class="sg">
      <div><span>Health</span><b style="color:#ff8a7a">${D.maxHp}</b></div>${D.maxMana ? `<div><span>Mana</span><b style="color:#8ac0ff">${D.maxMana}</b></div>` : ''}<div><span>Endurance</span><b style="color:#f2cc50">${D.maxEnd}</b></div>
      <div><span>Armour</span><b>${D.armor}</b></div><div><span>Damage</span><b>${w ? Math.round(Game.weaponDamage(h, w)) : 0}</b></div><div><span>Critical</span><b>${(D.crit * 100).toFixed(1)}%</b></div>
    </div>
    <div class="tools">${Object.keys(TOOLS).map(t => `<div class="tl ${h.tools[t] ? '' : 'none'}" title="${h.tools[t] ? (TOOL_TIER_NAMES[h.tools[t]] + ' ' + TOOLS[t].name) : 'No ' + TOOLS[t].name}">${Icons.toolSvg(t, h.tools[t] || 1)}<span>${h.tools[t] ? TOOL_TIER_NAMES[h.tools[t]] : '—'}</span></div>`).join('')}</div>`;
  const left = el('div', 'invleft'); left.append(doll, st);
  // bag
  const right = el('div', 'invright');
  right.innerHTML = `<div class="bagh"><h3>Backpack</h3><span class="goldc">${Icons.coin()} ${h.gold}</span></div>`;
  const grid = el('div', 'grid');
  h.inv.forEach((it, i) => {
    const cell = el('div', 'cell' + (it && it.kind ? ' r' + it.rarity : '') + (selInv && selInv.i === i ? ' sel' : ''), it ? `${Icons.itemSvg(it)}${!it.kind ? `<span class="n">${it.n}</span>` : ''}` : '');
    if (it) { cell.onmouseenter = () => showTip(tip, it, i, null, c); cell.onclick = () => { S.click(); selInv = { i }; renderInventory(c); }; cell.ondblclick = () => { quickUse(i); renderInventory(c); }; }
    grid.appendChild(cell);
  });
  right.appendChild(grid); right.appendChild(tip);
  lay.append(left, right); c.appendChild(lay);
  if (selInv && selInv.i != null && h.inv[selInv.i]) showTip(tip, h.inv[selInv.i], selInv.i, null, c, true);
  else if (selInv && selInv.eq && h.equip[selInv.eq]) showTip(tip, h.equip[selInv.eq], null, selInv.eq, c, true);
}
function showTip(tipEl, it, idx, eqSlot, c, withButtons) {
  const hh = G.player.h;
  let html = `<div class="tiphead"><div class="tic r${it.rarity || 0}">${Icons.itemSvg(it)}</div><div>`;
  if (it.kind) {
    html += `<b style="color:${RARITY[it.rarity].col}">${esc(it.name)}</b><div class="dim">${RARITY[it.rarity].name} · ${it.kind === 'weapon' ? WEAPON_TYPES[it.wt].name : SLOT_LABEL[it.slot === 'ring' ? 'ring1' : it.slot]} · level ${it.lvl}</div></div></div>`;
    if (it.kind === 'weapon') { const W = WEAPON_TYPES[it.wt]; html += `<div class="big">${it.dmg} damage</div><div class="dim">${W.hands === 'two' ? 'Two-handed' : W.hands === 'dual' ? 'Dual wield' : W.hands === 'shield' ? 'With shield' : W.kind === 'bow' ? 'Ranged' : 'Staff'} · Right click: ${W.areaName}</div>`; }
    else if (it.armor) html += `<div class="big">${it.armor} armour</div>`;
    html += `<div style="color:var(--good)">${Object.entries(it.stats).map(([k, v]) => `+${v} ${STAT_NAMES[k]}`).join(' · ')}</div>`;
    if (!Game.canEquip(hh, it)) html += `<div style="color:var(--bad)">${CLASSES[hh.cls].name}s can't use this.</div>`;
    const cur = it.kind === 'weapon' ? hh.equip[hh.active] : hh.equip[it.slot === 'ring' ? 'ring1' : it.slot];
    if (cur && idx != null) html += `<div class="dim">Currently worn: ${esc(cur.name)} (${cur.dmg ? cur.dmg + ' damage' : (cur.armor || 0) + ' armour'})</div>`;
    html += `<div style="color:#ffd84a">Sells for ${Game.itemValue(it)} gold</div>`;
  } else { const I = ITEMS[it.id]; html += `<b>${esc(I.name)}</b> <span class="dim">×${it.n}</span></div></div><div>${esc(I.desc)}</div><div style="color:#ffd84a">Sells for ${I.value} gold each</div>`; }
  tipEl.innerHTML = html;
  if (!withButtons) return;
  const row = el('div', 'row');
  const b = (t, fn, cls = 'btn') => { const x = el('button', cls, t); x.onclick = () => { S.click(); fn(); renderInventory(c); }; row.appendChild(x); };
  if (idx != null && it.kind === 'weapon') { b('Equip as Main Weapon', () => Game.equipFromInv(hh, idx, 'w1')); b('Equip as Second Weapon', () => Game.equipFromInv(hh, idx, 'w2')); }
  else if (idx != null && it.kind === 'acc' && it.slot === 'ring') { b('Wear on left hand', () => Game.equipFromInv(hh, idx, 'ring1')); b('Wear on right hand', () => Game.equipFromInv(hh, idx, 'ring2')); }
  else if (idx != null && it.kind) b('Equip', () => Game.equipFromInv(hh, idx));
  else if (idx != null && ITEMS[it.id]?.use) b('Use', () => quickUse(idx));
  if (eqSlot) b('Take off', () => Game.unequip(hh, eqSlot));
  if (idx != null) b('Destroy', () => { hh.inv[idx] = null; selInv = null; G.hooks.invChanged && G.hooks.invChanged(); }, 'btn red');
  tipEl.appendChild(row);
}
export function portraitRect() { if (UI.open !== 'inv') return null; const e = document.getElementById('portrait'); return e ? e.getBoundingClientRect() : null; }
function quickUse(i) { const h = G.player.h, it = h.inv[i]; if (!it) return; if (it.kind) Game.equipFromInv(h, i, it.kind === 'weapon' ? h.active : undefined); else if (ITEMS[it.id]?.use) Game.useItem(h, it.id, G.player); }
export function refreshOpen() { if (UI.open === 'inv') renderInventory(winRoot().querySelector('.content')); if (UI.open === 'craft' && craftState) renderCraft(); if (UI.open === 'skills') renderSkills(); }

// --- skills: class tree, weapon trees, dual wield mastery ---
let skTab = 'class', skWeapon = null;
export function openSkills(tab) { skTab = 'class'; const h = G.player.h; openWin('skills', skTab === 'class' ? `${CLASSES[h.cls].name} Talents & Abilities` : 'Weapon Skills & Abilities', '', 'big'); renderSkills(); }
function treeHtml(nodes, pts, avail, onSpend) {
  const box = el('div', 'tree');
  const spentN = Object.values(pts).reduce((a, b) => a + b, 0);
  const rows = Math.max(...nodes.map(n => n.row)) + 1;
  for (let r = 0; r < rows; r++) {
    const rp = nodes === CLASS_TREE[G.player.h.cls] ? 2 : 3;
    const row = el('div', 'trow' + (spentN >= r * rp ? '' : ' locked'));
    row.appendChild(el('div', 'treq', r ? `${r * rp} pts` : ''));
    for (const n of nodes.filter(x => x.row === r)) {
      const rank = pts[n.id] || 0, can = Game.canSpend(nodes === CLASS_TREE[G.player.h.cls] ? 'c' : 'w', pts, avail, n);
      const b = el('button', 'node' + (rank ? ' has' : '') + (rank >= n.max ? ' max' : '') + (can ? ' can' : ''), `<div class="nic">${Icons.abilityIcon(n.icon)}</div><div class="nr">${rank}/${n.max}</div><div class="nn">${esc(n.name)}</div>`);
      b.title = n.desc;
      b.onmouseenter = () => { const d = box.parentElement.querySelector('.tdesc'); if (d) d.innerHTML = `<b>${esc(n.name)}</b> <span class="dim">(rank ${rank}/${n.max})</span><br>${esc(n.desc)}`; };
      b.onclick = () => { if (onSpend(n)) { S.objective(); renderSkills(); } else S.error(); };
      row.appendChild(b);
    }
    box.appendChild(row);
  }
  return box;
}
function renderSkills() {
  const c = winRoot().querySelector('.content'); if (!c) return;
  const h = G.player.h; c.innerHTML = '';
  const tabs = el('div', 'tabsrow big');
  for (const [k, t] of [['class', `${CLASSES[h.cls].name} Talents (N)`]]) { const b = el('button', skTab === k ? 'on' : '', t); b.onclick = () => { S.click(); openSkills(k); }; tabs.appendChild(b); }
  c.appendChild(tabs);
  if (skTab === 'class') {
    const ab = el('div', 'abilrow');
    const W = G.player.W;
    const items = [...ABILITIES[h.cls].map(a => ({ k: '', icon: a.id, name: a.name, d: `${a.desc} Costs ${a.cost} ${CLASS_POOLS[h.cls].uses === 'mana' ? 'mana' : 'endurance'}.${h.level >= RANK2_LEVEL ? ' Rank II.' : ''}`, lv: a.level }))];
    c.appendChild(el('p', 'dim', 'Your hotbar holds 3 class abilities (keys 1, 2, 3). Choose which ones with the slot buttons.'));
    for (const a of items) {
      const slot = h.hotbar.findIndex(s => s && s.t === 'ab' && s.id === a.icon);
      const row = el('div', 'abil' + (slot >= 0 ? ' onbar' : ''), `<div class="aic">${Icons.abilityIcon(a.icon)}${slot >= 0 ? `<span class="k">${slot + 1}</span>` : ''}</div><div style="flex:1"><b>${esc(a.name)}</b><div class="dim">${esc(a.d)}</div></div>`);
      const bs = el('div', 'slotbtns');
      for (let i = 0; i < 3; i++) { const b = el('button', 'btn' + (slot === i ? ' gold' : ''), String(i + 1)); b.title = 'Put on hotbar slot ' + (i + 1); b.onclick = () => { S.click(); Game.setAbilitySlot(h, i, a.icon); renderSkills(); }; bs.appendChild(b); }
      row.appendChild(bs); ab.appendChild(row);
    }
    c.appendChild(ab);
    const avail = Game.classPoints(h);
    const head = el('div', 'treehead', `<div><b>${avail}</b> point${avail === 1 ? '' : 's'} to spend <span class="dim">(1 per level)</span></div>`);
    const rs = el('button', 'btn', 'Reset tree'); rs.onclick = () => { Game.resetClass(h); renderSkills(); }; head.appendChild(rs);
    c.appendChild(head);
    const wrap = el('div', 'treewrap'); wrap.appendChild(treeHtml(CLASS_TREE[h.cls], h.ctree, avail, (n) => Game.spendClass(h, n))); wrap.appendChild(el('div', 'tdesc', '<span class="dim">Hover over a skill to read it. Each talent is a single point. Each row opens after you spend 2 more points in this tree.</span>')); c.appendChild(wrap);
  } else {
    const fams = classFamilies(h.cls); const cur = G.player.weapon ? slotSkills(G.player.weapon.wt, h.wsel || {}) : [];
    if (!skWeapon || !fams.includes(skWeapon)) skWeapon = cur[0] ? cur[0].fam : fams[0];
    const pick = el('div', 'wpick');
    const famItem = (f) => f === 'shield' ? { kind: 'weapon', wt: 'swordshield', tier: 2 } : f.endsWith('staff') ? { kind: 'weapon', wt: f, tier: 2 } : { kind: 'weapon', wt: { sword: 'greatsword', mace: 'maceshield', axe: 'handaxes', dagger: 'daggers', greatsword: 'greatsword', greataxe: 'greataxe', warhammer: 'warhammer', spear: 'spear', bow: 'bow' }[f], tier: 2 };
    for (const f of fams) { const m = Game.wm(h, f); const b = el('button', 'wp' + (f === skWeapon ? ' on' : ''), `<div class="nic">${f === 'shield' || f === 'mace' || f === 'axe' || f === 'dagger' || f === 'sword' ? Icons.abilityIcon(f) : Icons.itemSvg(Object.assign({ rarity: 0 }, famItem(f)))}</div><div><b>${FAMILIES[f].name}</b><div class="dim">Mastery ${m.lv}</div></div>`); b.onclick = () => { S.click(); skWeapon = f; renderSkills(); }; pick.appendChild(b); }
    c.appendChild(pick);
    const F = FAMILIES[skWeapon];
    c.appendChild(el('p', 'dim', 'Left click is a normal attack' + (F.kind === 'melee' ? ' (a 3-hit combo)' : '') + '. Hold right click to block. Each weapon has two abilities: a two-handed weapon, bow or staff puts both on F and C; with a pair (like sword and shield) F uses the main weapon\'s chosen ability and C the off-hand\'s. Both weapons of a pair level up as you fight.'));
    const wab = el('div', 'abilrow');
    h.wsel = h.wsel || {};
    F.skills.forEach((id, i) => {
      const k = WSKILLS[id];
      const onBar = cur.findIndex(x => x.fam === skWeapon && x.id === id);
      const row = el('div', 'abil' + (onBar >= 0 ? ' onbar' : ''), `<div class="aic">${Icons.abilityIcon(k.icon)}${onBar >= 0 ? `<span class="k">${onBar ? 'C' : 'F'}</span>` : ''}</div><div style="flex:1"><b>${esc(k.name)}</b> <span class="dim">${k.cd} s cooldown</span><div class="dim">${esc(k.desc)}</div></div>`);
      const btn = el('button', 'btn' + ((h.wsel[skWeapon] || 0) === i ? ' gold' : ''), (h.wsel[skWeapon] || 0) === i ? 'Chosen for pairs' : 'Use with pairs');
      btn.title = 'When this weapon is part of a pair, use this ability on its key'; btn.onclick = () => { S.click(); h.wsel[skWeapon] = i; G.hooks.gearChanged && G.hooks.gearChanged(); renderSkills(); };
      row.appendChild(btn); wab.appendChild(row);
    });
    c.appendChild(wab);
    const m = Game.wm(h, skWeapon), avail = Game.weaponPoints(h, skWeapon), need = masteryXpFor(m.lv);
    const head = el('div', 'treehead', `<div><b>${F.name}</b> mastery <b>${m.lv}</b>/${MASTERY_CAP} · <b>${avail}</b> point${avail === 1 ? '' : 's'} to spend<div class="xpb"><i style="width:${m.lv >= MASTERY_CAP ? 100 : m.xp / need * 100}%"></i></div><div class="dim">Kill enemies while wielding this weapon to raise its mastery.</div></div>`);
    const rs = el('button', 'btn', 'Reset tree'); rs.onclick = () => { Game.resetWeapon(h, skWeapon); renderSkills(); }; head.appendChild(rs);
    c.appendChild(head);
    const wrap = el('div', 'treewrap'); wrap.appendChild(treeHtml(familyTree(skWeapon), m.pts, avail, (n) => Game.spendWeapon(h, skWeapon, n))); wrap.appendChild(el('div', 'tdesc', '<span class="dim">Hover over a skill to read it.</span>')); c.appendChild(wrap);
  }
}
function rmbIcon(W) { return W ? (W.hands === 'dual' ? 'twinfury' : W.kind === 'bow' ? 'rain' : W.element === 'fire' ? 'meteor' : W.element === 'frost' ? 'blizzard' : W.element === 'arcane' ? 'nova' : 'area') : 'area'; }

// --- crafting ---
let craftState = null;
export function openCrafting(station) {
  craftState = { station, cat: 'All', sel: null };
  openWin('craft', station ? STATIONS[station] : 'Recipes', '', 'big');
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
    const b = el('button', (st.sel === r ? 'on ' : '') + (can ? 'can' : h.level < r.lvl ? 'no' : ''), `<span class="i">${Icons.itemSvg(Game.recipeItem(r))}</span><div><b>${esc(Game.recipeOutputName(r))}</b><div style="font-size:12px;color:var(--dim)">${STATIONS[r.station]}${h.level < r.lvl ? ` · needs level ${r.lvl}` : ''}</div></div>`);
    b.onclick = () => { st.sel = r; S.click(); renderCraft(); };
    list.appendChild(b);
  }
  if (!st.sel && rs.length) st.sel = rs[0];
  const det = el('div', 'tip');
  if (st.sel) {
    const r = st.sel;
    det.innerHTML = `<div class="tiphead"><div class="tic">${Icons.itemSvg(Game.recipeItem(r))}</div><b style="font-size:20px">${esc(Game.recipeOutputName(r))}</b></div><div style="color:var(--dim)">${STATIONS[r.station]} · level ${r.lvl}</div><div style="margin:8px 0">` + Object.entries(r.need).map(([k, n]) => { const have = Game.count(h, k); return `<div class="need"><span><span class="ni">${Icons.itemSvg({ id: k })}</span> ${ITEMS[k].name}</span><span class="${have >= n ? 'ok' : 'no'}">${have} / ${n}</span></div>`; }).join('') + '</div>';
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
  const c = openWin('quests', 'Quest Log', '', 'big');
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
  const c = openWin('merchant', esc(npc.name) + "'s Wares", '', 'big');
  const render = () => {
    const h = G.player.h; c.innerHTML = `<div style="margin-bottom:8px;color:#ffd84a">🪙 ${h.gold} gold</div>`;
    const lay = el('div', 'charlay');
    const buy = el('div', '', '<h3 style="font-size:18px">Buy</h3>');
    for (const id of Game.merchantStock()) { const pr = Game.buyPrice(id); const b = el('button', 'btn buyb', `<span class="ni">${Icons.itemSvg({ id })}</span> ${ITEMS[id].name} <span style="margin-left:auto;color:#ffd84a">${pr}g</span>`); b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0'; b.disabled = h.gold < pr; b.onclick = () => { h.gold -= pr; Game.addItem(h, id, 1); S.coins(); render(); }; buy.appendChild(b); }
    const sell = el('div', '', '<h3 style="font-size:18px">Sell (click an item)</h3>');
    const grid = el('div', 'grid'); grid.style.marginTop = '8px';
    h.inv.forEach((it, i) => { const cell = el('div', 'cell' + (it && it.kind ? ' r' + it.rarity : ''), it ? `${Icons.itemSvg(it)}${!it.kind ? `<span class="n">${it.n}</span>` : ''}` : ''); if (it) { cell.title = `${Game.itemName(it)}: ${Game.itemValue(it)}g`; cell.onclick = () => { h.gold += Game.itemValue(it); if (it.kind || it.n <= 1) h.inv[i] = null; else it.n--; S.coins(); G.hooks.invChanged(); render(); }; } grid.appendChild(cell); });
    sell.appendChild(grid);
    lay.style.gridTemplateColumns = '260px auto'; lay.append(buy, sell); c.appendChild(lay);
  };
  render();
}

// --- pause, settings, controls ---
export function openPause(onSaveQuit) {
  const c = openWin('pause', 'Paused', '');
  const h = G.player.h, zn = ZONES.find(z => z.id === G.zone);
  const wrap = el('div', 'pausewrap');
  const m = el('div', 'pausemenu'); m.style.display = 'flex'; m.style.flexDirection = 'column'; m.style.gap = '7px';
  const b = (t, fn, cls = 'btn') => { const x = el('button', cls, t); x.onclick = () => { S.click(); fn(); }; m.appendChild(x); };
  b('Resume', () => closeWin(), 'btn big gold');
  b('Character & Bags  ·  I', () => openInventory()); b('Class Talents  ·  N', () => openSkills('class')); b('Quest Log  ·  L', () => openQuestLog()); b('World Map  ·  M', () => openMap()); b('Recipes  ·  P', () => openCrafting(null));
  b('Settings', () => openSettings(true)); b('How to Play', () => openControls(true));
  b(document.fullscreenElement ? 'Exit Full Screen' : 'Full Screen', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); });
  b('Save & Quit to Title', () => G.hooks.saveQuit && G.hooks.saveQuit(), 'btn red');
  const act = Object.keys(h.quests.active).length;
  const info = el('div', 'phero', `<div class="eyebrow">Your hero</div><h3>${esc(h.name)}</h3>Level <b>${h.level}</b> ${RACES[h.race].name} ${CLASSES[h.cls].name}<br>Location: <b>${zn ? zn.name : ''}</b> <span style="color:var(--mut)">(level ${zn ? zn.lv : ''})</span><br>Active quests: <b>${act}</b> · Completed: <b>${h.quests.done.length}</b><br>Gold: <b>${h.gold}</b><br>Played: <b>${Math.floor((h.timePlayed || 0) / 60)} min</b><p style="color:var(--mut);margin:10px 0 0;font-size:13px">The game saves automatically every 30 seconds and when you quit. The world is paused while this menu is open.</p>`);
  wrap.append(m, info); c.appendChild(wrap);
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
  row('Master volume<small>Everything at once</small>', range('master', 0, 1, 0.05)); row('Music', range('music', 0, 1, 0.05)); row('Sound effects', range('sfx', 0, 1, 0.05)); row('Ambience', range('ambient', 0, 1, 0.05));
  g.appendChild(el('h3', '', 'Controls')); g.appendChild(el('div'));
  row('Mouse sensitivity<small>How fast the view turns</small>', range('sens', 0.2, 4, 0.05)); row('Invert mouse Y', check('invertY')); row('Field of view<small>Wider shows more but looks smaller</small>', range('fov', 60, 100, 1));
  g.appendChild(el('h3', '', 'Graphics')); g.appendChild(el('div'));
  const q = el('select'); for (const o of ['low', 'medium', 'high']) { const op = el('option', '', o[0].toUpperCase() + o.slice(1)); op.value = o; q.appendChild(op); } q.value = settings.quality; q.style.cssText = 'padding:6px;background:#1a140e;color:var(--text);border:1px solid var(--line);border-radius:6px;font:inherit';
  q.onchange = () => { settings.quality = q.value; saveSettings(); G.hooks.applyGraphics && G.hooks.applyGraphics(); };
  row('Quality<small>Lower this if the game stutters</small>', q);
  row('Shadows', check('shadows', () => G.hooks.applyGraphics && G.hooks.applyGraphics())); row('Bloom glow', check('bloom', () => G.hooks.applyGraphics && G.hooks.applyGraphics())); row('Grass', check('grass'));
  row('View distance<small>How far you can see</small>', range('viewDist', 0.5, 1.5, 0.05, () => G.hooks.applyGraphics && G.hooks.applyGraphics()));
  row('Damage numbers', check('dmgNumbers')); row('Head bob', check('headBob'));
  c.appendChild(g);
  c.appendChild(el('p', 'dim', 'Music: "The Fall of Arcana", "Pleasant Creek", "Woodland Fantasy" and "Snowland" by Matthew Pablo (matthewpablo.com, CC-BY 3.0); "The Secret Within the Silent Woods" by Hitctrl (CC-BY 3.0); "Minstrel Dance", "The Old Tower Inn" and "The Bard\'s Tale" by RandomMind, "Town Theme", "Crystal Cave", "Mysterious Ambience" and "Battle Theme A" by cynicmusic, "Epic Boss Battle" by SubspaceAudio (CC0). Via OpenGameArt.org.'));
  const r = el('div', '', ''); r.style.cssText = 'display:flex;gap:10px;margin-top:14px';
  const reset = el('button', 'btn', 'Reset to defaults'); reset.onclick = () => { Object.assign(settings, DEFAULT_SETTINGS); saveSettings(); A.applyVolumes(); G.hooks.applyGraphics && G.hooks.applyGraphics(); openSettings(fromPause); };
  const back = el('button', 'btn gold', fromPause ? 'Back' : 'Done'); back.onclick = () => { S.click(); fromPause && G.player ? openPause() : closeWin(); };
  r.append(reset, back); c.appendChild(r);
}
export function openControls(fromPause) {
  const c = openWin('controls', 'How to Play', '');
  const g = el('div', 'helpgrid');
  const grp = (title, rows) => { const d = el('div'); d.appendChild(el('h4', '', title)); for (const [k, t] of rows) d.appendChild(el('div', 'krow', `<span class="kbd">${k}</span><span>${t}</span>`)); g.appendChild(d); };
  g.appendChild(el('div', 'helpnote', '<b>Your goal:</b> follow the quests from Seabreak Village. They teach you to gather and craft, then lead you north through Whisperwood, the Frostpeak Highlands and finally the Ashlands. Gold <b style="color:#ffd84a">!</b> means a quest to pick up, gold <b style="color:#ffd84a">?</b> means a quest to hand in.'));
  grp('Moving', [['W A S D', 'Walk. Moving backwards is slower.'], ['Shift (hold)', 'Sprint. Uses endurance.'], ['Shift (tap)', 'Dodge roll: you can\'t be hit mid-roll.'], ['Space', 'Jump'], ['Mouse', 'Look around'], ['Wheel / V', 'Switch between first and third person']]);
  grp('Fighting', [['Left click', 'Attack. Every weapon has its own combo: swords 3 swings, maces a swing then a crushing blow, daggers 5 fast stabs, spears 4 thrusts. Bigger weapons swing slower but harder.'], ['Right click', 'Hold to block. Shields stop the most damage.'], ['1 2 3', 'Class abilities (choose which three in Class Talents)'], ['4 5 6', 'Potions and food'], ['R', 'Use your best healing item'], ['Q', 'Swap weapon sets']]);
  grp('World', [['E', 'Talk, loot, skin, chop, mine, gather and use crafting stations'], ['Red swords', 'Above a name: this enemy attacks on sight'], ['Ring colour', 'Under an enemy: grey/green easy, blue fair, white even, yellow hard, red dangerous']]);
  grp('Windows', [['I or B', 'Character, gear and bags'], ['N', 'Class talents and abilities'], ['L', 'Quest log'], ['M', 'World map'], ['P', 'Recipes'], ['Esc', 'Pause menu (press once to free the mouse, again for the menu)']]);
  c.appendChild(g);
  const back = el('button', 'btn gold', 'Back'); back.style.marginTop = '18px'; back.onclick = () => { S.click(); fromPause && G.player ? openPause() : closeWin(); }; c.appendChild(back);
}
export function confirmBox(text, yes, no = 'Cancel', yesText = 'Yes') {
  const d = el('div', 'confirm', `<div class="panel"><div style="font-size:18px">${text}</div><div class="row"></div></div>`);
  const r = d.querySelector('.row');
  const y = el('button', 'btn red', yesText); y.onclick = () => { d.remove(); yes(); };
  const n = el('button', 'btn', no); n.onclick = () => d.remove();
  r.append(n, y); document.body.appendChild(d);
}
