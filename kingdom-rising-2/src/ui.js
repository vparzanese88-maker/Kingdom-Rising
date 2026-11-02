// HUD and windows: bars, ability bar, minimap, nameplates & quest markers, toasts, banners,
// inventory/character, crafting, quest log, map, NPC dialog, merchant, pause menu, settings.
import * as THREE from 'three';
import { G } from './state.js';
import { S, A } from './audio.js';
import { settings, saveSettings, DEFAULT_SETTINGS } from './saves.js';
import { RACES, CLASSES, WEAPON_TYPES, ABILITIES, AREA_UNLOCK_LEVEL, ITEMS, TOOLS, TOOL_TIER_NAMES, QUESTS, NPCS, RARITY, STAT_NAMES, STAT_DESC, xpForLevel, LEVEL_CAP, ZONES, STATIONS, RECIPES, GOBLIN_CAMPS, ARMOR_SLOT_LIST, RANK2_LEVEL, CLASS_POOLS, TIERS, FAMILIES, WSKILLS, slotSkills, classFamilies, familyTree, COMBOS, RMB_SPECIAL, SLOT_LABEL, CLASS_TREE, WEAPON_TREE, MASTERY_CAP, masteryXpFor, FOOD_BUFFS } from './data.js';
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

// ---------- left-click combo descriptions ----------
const HIT_NAME = { swing1: 'Slash', swing2: 'Backhand', swing3: 'Heavy Slash', off1: 'Off-hand Strike', smash: 'Overhead Smash', stabR: 'Stab', stabL: 'Stab', spin: 'Spinning Slash', thrust1: 'Thrust', thrust2: 'Thrust', thrust3: 'Lunge' };
export function comboSteps(wt) {
  const W = WEAPON_TYPES[wt]; if (!W) return [];
  if (W.kind === 'bow') return [{ n: 'Arrow', d: 100, tags: ['Ranged'] }];
  if (W.kind === 'staff') return [{ n: W.element === 'fire' ? 'Firebolt' : W.element === 'frost' ? 'Frostbolt' : 'Arcane Bolt', d: 100, tags: [W.element === 'fire' ? '🔥 Burns' : W.element === 'frost' ? '🐌 Slows' : 'Ranged'] }];
  const C = COMBOS[wt]; if (!C) return [];
  return C.chain.map(st => { const t = [];
    if (st.cleave) t.push('Cleave'); if (st.aoe) t.push('Area'); if (st.line) t.push('Pierces line');
    if (st.bleed) t.push('🩸 Bleed'); if (st.stun) t.push('💫 Stun ' + st.stun + 's'); if (st.shock) t.push('Shockwave');
    if (st.blunt || wt === 'mace' || wt === 'maceshield') t.push('Ignores armour'); if (st.knock) t.push('Knockback'); if (st.crit) t.push('+' + Math.round(st.crit * 100) + '% crit');
    return { n: HIT_NAME[st.a] || 'Strike', d: Math.round(st.m * 100), tags: t }; });
}
export function comboText(wt) {
  const C = COMBOS[wt], st = comboSteps(wt); if (!st.length) return '';
  return 'Left click combo:\n' + st.map((x, i) => `${i + 1}. ${x.n} (${x.d}% dmg)${x.tags.length ? ' · ' + x.tags.join(', ') : ''}`).join('\n') + (C ? '\n' + C.trait : '');
}

// ---------- ability bar ----------
let abilEls = null;
export function buildAbilityBar() {
  const p = G.player, h = p.h, bar = $('abil'); bar.innerHTML = '';
  const ws = el('div', 'wslots');
  ws.append(el('div', 'slot mini', ''), el('div', 'slot mini', ''));
  bar.appendChild(ws);
  const mk = (k, iconHtml, cls = '') => { const s = el('div', 'slot ' + cls, `<span class="ai">${iconHtml}</span><span class="k">${k}</span><div class="cd" style="display:none"></div>`); bar.appendChild(s); return s; };
  const lmb = mk('LMB', '', 'wpn');
  const rmb = mk('RMB', '', 'wab');
  bar.appendChild(el('div', 'sep'));
  const hb = Array.from({ length: G.hotbarSlots || 6 }, (_, i) => mk(String(i + 1), '', 'hb'));
  bar.appendChild(el('div', 'sep'));
  const f = mk('F', Icons.abilityIcon('shield'), 'small');
  const combo = el('div', 'combostrip'); bar.appendChild(combo);
  abilEls = { ws, lmb, rmb, hb, f, combo };
  refreshAbilityBar();
}
export function refreshAbilityBar() {
  if (!abilEls) return;
  const p = G.player, h = p.h, W = p.W;
  const [w1, w2] = abilEls.ws.children;
  for (const [e, k] of [[w1, 'w1'], [w2, 'w2']]) { const it = h.equip[k]; e.innerHTML = `<span class="ai">${it ? Icons.itemSvg(it) : ''}</span>`; e.classList.toggle('active', h.active === k); e.title = (it ? it.name : 'Empty') + (k === 'w1' ? ' (main hand)' : ' (off hand)'); }
  abilEls.lmb.querySelector('.ai').innerHTML = W ? Icons.itemSvg(p.weapon) : Icons.abilityIcon('fist');
  abilEls.lmb.title = W ? comboText(p.weapon.wt) : 'Left click: punch';
  { const st = W ? comboSteps(p.weapon.wt) : [], cs = abilEls.combo;
    cs.innerHTML = st.length ? `<div class="cst">${W.kind === 'melee' ? 'Left-click combo' : 'Left click'}</div><div class="crow">` + st.map((x, i) => `<div class="cstep${i === st.length - 1 && st.length > 1 ? ' fin' : ''}"><b>${i + 1}</b><span>${x.n}</span><i>${x.d}%</i>${x.tags.map(t => `<em>${t}</em>`).join('')}</div>`).join('') + '</div>' : '';
    cs._n = st.length; cs.classList.toggle('battle', !!G.battleFx); if ((settings.hud || {}).combo?.hide) cs.style.display = 'none'; requestAnimationFrame(() => { const l = abilEls.lmb; cs.style.right = (l.parentNode.offsetWidth - l.offsetLeft - l.offsetWidth) + 'px'; }); }
  const sk = p.skills();
  abilEls.f.title = 'Hold F to block';
  { const id = p.weapon ? RMB_SPECIAL[p.weapon.wt] : null; abilEls.rmb.querySelector('.ai').innerHTML = id ? Icons.abilityIcon(WSKILLS[id].icon) : ''; abilEls.rmb.title = id ? `Right click: ${WSKILLS[id].name}. ${WSKILLS[id].desc}` : ''; }
  (h.hotbar || []).forEach((sl, i) => {
    const e = abilEls.hb[i], key = sl ? sl.t + ':' + sl.id : '';
    if (e._key !== key) {
      const ai = e.querySelector('.ai');
      e.className = 'slot hb' + (sl && sl.t === 'ab' ? ' cls ' + h.cls : '');
      if (!sl) { ai.innerHTML = ''; e.title = 'Empty'; }
      else if (sl.t === 'ab') { const a = ABILITIES[h.cls].find(x => x.id === sl.id); ai.innerHTML = Icons.abilityIcon(a.id); e.title = `${a.name} (${a.cost} ${CLASS_POOLS[h.cls].uses === 'mana' ? 'mana' : 'endurance'}): ${a.desc}`; if (G.hotbarSlots) { let n = e.querySelector('.an'); if (!n) { n = el('span', 'an'); e.appendChild(n); } n.textContent = a.name; } }
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
  if (abilEls && abilEls.combo._n > 1) { const p0 = G.player, n = abilEls.combo._n, cur = p0.atk && p0.combo ? (p0.combo - 1) % n : (p0.comboT > 0 ? p0.combo % n : -1);
    if (abilEls.combo._c !== cur) { abilEls.combo._c = cur; abilEls.combo.querySelectorAll('.cstep').forEach((e, i) => e.classList.toggle('on', i === cur)); } }
  const p = G.player, h = p.h;
  $('hpI').style.width = (p.hp / p.maxHp * 100) + '%'; $('hpT').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('manaBar').hidden = p.maxMana <= 0;
  if (p.maxMana > 0) { $('manaI').style.width = (p.mana / p.maxMana * 100) + '%'; $('manaT').textContent = `${Math.floor(p.mana)} / ${p.maxMana} Mana`; }
  $('endI').style.width = (p.end / p.maxEnd * 100) + '%'; $('endT').textContent = `${Math.floor(p.end)} / ${p.maxEnd} Endurance`;
  $('vignette').style.opacity = p.hurtT > 0 ? p.hurtT * 2 : 0;
  $('lowhp').style.opacity = p.hp / p.maxHp < 0.3 ? 0.5 + 0.5 * Math.sin(G.time * 5) : 0;
  if (abilEls) {
    const W = p.W;
    { const id = p.weapon ? RMB_SPECIAL[p.weapon.wt] : null; if (id) setCd(abilEls.rmb, p.cd.w0, WSKILLS[id].cd); }
    (h.hotbar || []).forEach((sl, i) => {
      const e = abilEls.hb[i]; if (!e) return;
      if (sl && sl.t === 'ab') { const k = ABILITIES[h.cls].findIndex(a => a.id === sl.id), a = ABILITIES[h.cls][k]; if (!a) return; setCd(e, p.cd['a' + (k + 1)], a.cd); const cur = CLASS_POOLS[h.cls].uses === 'mana' ? p.mana : p.end; e.style.opacity = cur < a.cost ? 0.55 : 1; }
      else if (sl && sl.t === 'item') { setCd(e, p.useCd, 1); const n = Game.count(h, sl.id); let ne = e.querySelector('.n'); if (!ne) { ne = el('span', 'n'); e.appendChild(ne); } ne.textContent = n; e.style.opacity = n ? 1 : 0.4; }
      else { setCd(e, 0, 1); e.style.opacity = 1; const ne = e.querySelector('.n'); if (ne) ne.remove(); }
    });
    abilEls.f.classList.toggle('active', p.block);
  }
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.25;
    $('lvlNum').textContent = h.level; $('heroName').textContent = h.name; $('heroCls').textContent = `${RACES[h.race].name} ${CLASSES[h.cls].name}`; $('heroGold').textContent = `🪙 ${h.gold}`;
    const need = (G.xpReq || xpForLevel)(h.level);
    $('xpI').style.width = h.level >= LEVEL_CAP ? '100%' : (h.xp / need * 100) + '%';
    $('xpT').textContent = h.level >= LEVEL_CAP ? `Level ${LEVEL_CAP} (max)` : `Level ${h.level}  ·  ${h.xp} / ${need} XP`;
    const b = []; if (p.buffs.cry > 0) b.push(`📯 Battle Cry ${Math.ceil(p.buffs.cry)}s`); if (p.buffs.fury > 0) b.push(`🐺 Fury ${Math.ceil(p.buffs.fury)}s`); if (p.stealth > 0) b.push(`☁ Unseen ${Math.ceil(p.stealth)}s`); if (p.buffs.nextCrit) b.push('✦ Next hit x2'); if (p.regen) b.push('❤ Regenerating');
    { const box = $('debuffs'); const L = { bleed: ['🩸', 'Bleeding', '#c82020'], poison: ['☠', 'Poisoned', '#5ab030'], burn: ['🔥', 'Burning', '#ff7020'], slow: ['🐌', 'Slowed', '#4a8ad8'], stun: ['💫', 'Stunned', '#e0c020'] }; let html = '';
      if (p.db) for (const k in p.db) if (p.db[k].t > 0 && L[k]) html += `<div class="dbx" style="--c:${L[k][2]}" title="${L[k][1]}"><span>${L[k][0]}</span><b>${Math.ceil(p.db[k].t)}</b><small>${L[k][1]}</small></div>`;
      if (box._h !== html) { box.innerHTML = html; box._h = html; } }
    for (const k of ['food', 'drink']) if (h[k] && h[k].t > 0) { const F = FOOD_BUFFS[h[k].id]; b.push(`${k === 'food' ? '🍖' : '🍺'} ${F.name} ${Math.ceil(h[k].t / 60)}m`); }
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
      const d = m.pos.distanceTo(p.pos); if (d > (m.isStruct ? 70 : 32) && m !== G.target) continue;
      const ally = m.team != null && m.team === G.myTeam; if (ally && d > 16 && !m.isStruct && m !== G.target) continue;
      const hostile = !ally && (m.hostile || m.provoked);
      const anyDb = m.status.stun > 0 || m.status.frozen > 0 || m.status.slow > 0 || m.status.bleed > 0 || m.status.burn > 0;
      if (d > 14 && m.hp >= m.maxHp && m !== G.target && !hostile && !anyDb) continue;
      const cls = ally ? 'ally' : m.def.elite ? 'elite' : hostile ? 'hostile' : 'passive';
      const lc = lvlCol(m.lv, p.level), hpP = (m.hp / m.maxHp * 100).toFixed(0);
      const S2 = m.status; let db = '';
      for (const [k, ic, c] of [['stun', '💫', '#e0c020'], ['frozen', '❄', '#8ad8ff'], ['slow', '🐌', '#4a8ad8'], ['bleed', '🩸', '#c82020'], ['burn', '🔥', '#ff7020']]) if (S2[k] > 0) db += `<span style="--c:${c}">${ic}<i>${Math.ceil(S2[k])}</i></span>`;
      show('m' + m.id, m, `<div class="lvrow">${hostile ? `<span class="hos" title="Hostile: attacks on sight">${HOSTILE_SVG}</span>` : ''}<div class="lvb" style="--c:${lc}">${m.def.elite ? '★' : ''}${m.lv}</div></div><div class="nm" style="color:${lc}">${esc(m.name)}</div><div class="hpb"><i style="width:${hpP}%"></i></div>${db ? `<div class="mdb">${db}</div>` : ''}`, cls + (m === G.target ? ' tgt' : ''), m.height + 0.35);
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
  for (const m of G.mobs) if (!m.dead && m.pos.distanceTo(p.pos) < 70) dot(m.pos.x, m.pos.z, (x, y, e) => { if (e) return; g.fillStyle = m.team != null ? (m.team === G.myTeam ? '#5aa0ff' : '#ff4030') : m.hostile || m.provoked ? '#ff8a40' : '#ffe070'; g.beginPath(); g.arc(x, y, m.isStruct ? 7 : 4, 0, 7); g.fill(); });
  g.font = 'bold 30px Cinzel, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k of markers(p.h)) dot(k.x, k.z, (x, y, e) => { g.fillStyle = '#ffd84a'; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText(k.t, x, y); g.fillText(k.t, x, y); });
  // player arrow (always up)
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.moveTo(N / 2, N / 2 - 14); g.lineTo(N / 2 + 9, N / 2 + 10); g.lineTo(N / 2, N / 2 + 5); g.lineTo(N / 2 - 9, N / 2 + 10); g.closePath(); g.stroke(); g.fill();
  // N marker
  dot(p.pos.x, p.pos.z - 1000, (x, y) => { g.font = 'bold 26px Cinzel'; g.fillStyle = '#ffe2a0'; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText('N', x, y); g.fillText('N', x, y); });
  const zn = ZONES.find(z => z.id === G.zone);
  const zl = $('zoneLbl'); const html = G.zoneLabel ? G.zoneLabel : `${zn ? zn.name : ''}<small>Level ${zn ? zn.lv : ''}</small>`; if (zl._h !== html) { zl.innerHTML = html; zl._h = html; }
}

// ---------- tracker ----------
export function updateTracker() {
  const h = G.player.h, box = $('tracker'); box.innerHTML = '';
  const all = Object.keys(h.quests.active), act = all.filter(id => !(h.untracked || []).includes(id)).map(id => QUESTS.find(q => q.id === id)).filter(Boolean).slice(-6);
  if (!act.length) { if (all.length) return;
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
  if (G.hudEdit) { exitHudEdit(); return; }
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
const LEFT_SLOTS = ['head', 'back', 'chest', 'arms', 'food'];
const RIGHT_SLOTS = ['hands', 'waist', 'legs', 'feet', 'drink'];
const BOTTOM_SLOTS = ['w1', 'w2', 'ranged'];
const SLOT_HINT = { ranged: 'bow', food: 'food', drink: 'drink', arms: 'wrists', head: 'helm', neck: 'amulet', shoulders: 'shoulders', back: 'cloak', chest: 'chest', wrists: 'wrists', hands: 'hands', waist: 'waist', legs: 'legs', feet: 'boots', ring1: 'ring', ring2: 'ring', trinket: 'charm', w1: 'sword', w2: 'sword' };
export function openInventory() {
  const c = openWin('inv', 'Hero', '', 'big invwin');
  renderInventory(c);
}
function slotEl(h, k, tipEl, c) {
  const it = h.equip[k];
  const d = el('div', 'eq' + (it ? ' r' + (it.rarity || 0) : ' empty') + (k === h.active ? ' active' : ''));
  d.innerHTML = `<div class="ic">${it ? Icons.itemSvg(it) : Icons.itemSvg(ghost(SLOT_HINT[k]))}</div>${it && !it.kind ? `<span class="n">${it.n}</span>` : ''}<div class="lb">${SLOT_LABEL[k]}${k === h.active ? ' ✦' : ''}</div>`;
  if (!it && (k === 'food' || k === 'drink')) d.title = k === 'food' ? 'Drag food here: you eat one each time the buff runs out (long, small buffs)' : 'Drag a drink here: you drink one each time the buff runs out (shorter, stronger buffs)';
  if (!it && k === 'ranged') d.title = 'Drag a bow here. Q switches to it and back.';
  d.onmouseenter = () => { if (it) showTip(tipEl, it, null, k, c); };
  d.onclick = () => { if (it) { S.click(); selInv = { eq: k }; showTip(tipEl, it, null, k, c, true); } };
  d.ondblclick = () => { if (it) { Game.unequip(h, k); renderInventory(c); } };
  d.dataset.eq = k; if (it) dragable(d, { eq: k }, it, c);
  if (k === 'w2' && Game.isTwoHanded(h.equip.w1)) { d.classList.add('twoh'); d.innerHTML = `<div class="ic" style="opacity:.35">${Icons.itemSvg(h.equip.w1)}</div><div class="lb">Both hands</div>`; d.title = h.equip.w1.name + ' needs both hands'; }
  return d;
}
// ---- click and drag items between the bag and the gear slots ----
let dragEnd = 0;
function dragable(node, src, it, c) {
  node.addEventListener('click', e => { if (performance.now() - dragEnd < 200) e.stopImmediatePropagation(); }, true);
  node.addEventListener('dblclick', e => { if (performance.now() - dragEnd < 300) e.stopImmediatePropagation(); }, true);
  node.onpointerdown = (e) => {
    if (e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY; let gh = null, over = null;
    const tgt = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); return t && (t.closest('[data-inv],[data-eq]') || (t.id === 'portrait' ? t : null)); };
    const mv = (ev) => {
      if (!gh) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; gh = el('div', 'dragghost', Icons.itemSvg(it)); document.body.appendChild(gh); node.classList.add('dragsrc'); }
      gh.style.left = ev.clientX + 'px'; gh.style.top = ev.clientY + 'px';
      const t = tgt(ev); if (t !== over) { over && over.classList.remove('dropover'); over = t; over && over.classList.add('dropover'); }
    };
    const up = (ev) => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (!gh) return; gh.remove(); over && over.classList.remove('dropover'); node.classList.remove('dragsrc'); dragEnd = performance.now();
      const t = tgt(ev); if (t) { dropItem(src, t); selInv = null; renderInventory(c); }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
}
function dropItem(src, t) {
  const h = G.player.h, inv = h.inv;
  const toI = t.dataset.inv != null ? +t.dataset.inv : null, toE = t.dataset.eq || null, portrait = t.id === 'portrait';
  if (src.i != null) {
    const a = inv[src.i]; if (!a) return;
    if (toI != null) {
      if (toI === src.i) return;
      const b = inv[toI];
      if (b && !a.kind && !b.kind && a.id === b.id) { const mv = Math.min(a.n, Game.STACK - b.n); b.n += mv; a.n -= mv; if (a.n <= 0) inv[src.i] = null; }
      else { inv[src.i] = b; inv[toI] = a; }
      S.click(); G.hooks.invChanged && G.hooks.invChanged(); return;
    }
    if (portrait) { if (a.kind) Game.equipFromInv(h, src.i); else if (FOOD_BUFFS[a.id]) Game.equipConsumable(h, src.i); else quickUse(src.i); return; }
    if (toE === 'food' || toE === 'drink') { Game.equipConsumable(h, src.i, toE); return; }
    if (toE === 'ranged') { Game.equipFromInv(h, src.i, 'ranged'); return; }
    if (toE) { if (!a.kind) { S.error(); return; } if (a.kind === 'weapon' && toE !== 'w1' && toE !== 'w2' && toE !== 'ranged') { toast("Weapons go in your hands.", '⚠', 'bad'); S.error(); return; } Game.equipFromInv(h, src.i, toE); }
    return;
  }
  const k = src.eq, it = h.equip[k]; if (!it) return;
  if (toI != null) { const b = inv[toI]; if (!b) Game.unequip(h, k, toI); else if ((k === 'food' || k === 'drink') && !b.kind) Game.equipConsumable(h, toI, k); else if (b.kind) Game.equipFromInv(h, toI, k); else Game.unequip(h, k); return; }
  if (toE && toE !== k) {
    const pair = (k === 'ring1' && toE === 'ring2') || (k === 'ring2' && toE === 'ring1') || ((k === 'w1' || k === 'w2') && (toE === 'w1' || toE === 'w2') && h.equip.w1 && h.equip.w2 && Game.handsOf(h.equip.w1.wt) === 'one' && Game.handsOf(h.equip.w2.wt) === 'one');
    if (pair) { [h.equip[k], h.equip[toE]] = [h.equip[toE], h.equip[k]]; S.swap(); G.hooks.gearChanged && G.hooks.gearChanged(); G.hooks.invChanged && G.hooks.invChanged(); }
    else S.error();
  }
}
function ghost(kind) {
  const m = { helm: { kind: 'armor', akind: 'mail', slot: 'head', tier: 0 }, amulet: { kind: 'acc', slot: 'neck', tier: 1 }, shoulders: { kind: 'armor', akind: 'mail', slot: 'shoulders', tier: 0 }, cloak: { kind: 'acc', slot: 'back', tier: 1 }, chest: { kind: 'armor', akind: 'mail', slot: 'chest', tier: 0 }, wrists: { kind: 'armor', akind: 'leather', slot: 'wrists', tier: 0 }, bow: { kind: 'weapon', wt: 'bow', tier: 0 }, food: { id: 'roast_meat' }, drink: { id: 'honey_mead' }, hands: { kind: 'armor', akind: 'leather', slot: 'hands', tier: 0 }, waist: { kind: 'armor', akind: 'leather', slot: 'waist', tier: 0 }, boots: { kind: 'armor', akind: 'leather', slot: 'feet', tier: 0 }, ring: { kind: 'acc', slot: 'ring', tier: 1 }, charm: { kind: 'acc', slot: 'trinket', tier: 1 }, sword: { kind: 'weapon', wt: 'greatsword', tier: 0 } };
  return Object.assign({ rarity: 0 }, m[kind]);
}
function renderInventory(c) {
  const h = G.player.h, p = G.player, D = Game.heroDerived(h);
  c.innerHTML = '';
  const lay = el('div', 'invlay');
  const tip = el('div', 'tip big', '<span style="color:var(--dim)">Hover over an item to inspect it. Drag items between your bag and gear slots. Click to select, double-click to equip, use or take off.</span>');
  // paper doll
  const doll = el('div', 'doll');
  const L = el('div', 'col'), R = el('div', 'col');
  LEFT_SLOTS.forEach(k => L.appendChild(slotEl(h, k, tip, c)));
  RIGHT_SLOTS.forEach(k => R.appendChild(slotEl(h, k, tip, c)));
  const mid = el('div', 'mid');
  mid.innerHTML = `<div class="who"><b>${esc(h.name)}</b><span>Level ${h.level} ${RACES[h.race].name} ${CLASSES[h.cls].name}</span></div><canvas id="portrait" width="560" height="680"></canvas>`;
  const bot = el('div', 'botrow'); BOTTOM_SLOTS.forEach(k => bot.appendChild(slotEl(h, k, tip, c)));
  requestAnimationFrame(() => { const pc = document.getElementById('portrait'); if (!pc) return; const r = pc.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); pc.width = Math.round(r.width * dpr); pc.height = Math.round(r.height * dpr);
    pc.title = 'Drag to turn your hero'; pc.onpointerdown = (e) => { if (e.button !== 0) return; let x = e.clientX; pc.style.cursor = 'grabbing';
      const mv = (ev) => { G.portraitYaw = (G.portraitYaw ?? 0) + (ev.clientX - x) * 0.012; x = ev.clientX; };
      const up = () => { pc.style.cursor = ''; removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); }; });
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
    if (it) { cell.onmouseenter = () => showTip(tip, it, i, null, c); cell.onclick = () => { S.click(); selInv = { i }; renderInventory(c); }; cell.ondblclick = () => { quickUse(i); renderInventory(c); }; dragable(cell, { i }, it, c); }
    cell.dataset.inv = i;
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
    if (it.kind === 'weapon') { const W = WEAPON_TYPES[it.wt]; html += `<div class="big">${it.dmg} damage</div><div class="dim">${W.hands === 'two' ? 'Two-handed' : W.hands === 'dual' ? 'Dual wield' : W.hands === 'shield' ? 'With shield' : W.kind === 'bow' ? 'Ranged' : 'Staff'} · Right click: ${W.areaName}</div>`; const cs = comboSteps(it.wt); if (cs.length) html += `<div class="tipcombo"><div class="dim">Left click${COMBOS[it.wt] ? ' combo' : ''}</div>${cs.map((x, i) => `<div><b>${i + 1}. ${x.n}</b> <span class="dim">${x.d}% dmg</span>${x.tags.length ? ' · <span style="color:#ffcf70">' + x.tags.join(', ') + '</span>' : ''}</div>`).join('')}${COMBOS[it.wt] ? `<div style="color:#9fd0ff">${COMBOS[it.wt].trait}</div>` : ''}</div>`; }
    else if (it.armor) html += `<div class="big">${it.armor} armour</div>`;
    html += `<div style="color:var(--good)">${Object.entries(it.stats).map(([k, v]) => `+${v} ${STAT_NAMES[k]}`).join(' · ')}</div>`;
    if (it.kind === 'acc' && it.slot !== 'back') html += `<div style="color:var(--bad)">No longer worn. Sell it to a merchant.</div>`;
    else if (it.kind === 'weapon' && it.wt === 'bow' && !Game.canEquip(hh, it)) html += `<div style="color:#9fd0ff">Goes in your Ranged slot (Q switches to it).</div>`;
    else if (!Game.canEquip(hh, it)) html += `<div style="color:var(--bad)">${CLASSES[hh.cls].name}s can't use this.</div>`;
    const cur = it.kind === 'weapon' ? hh.equip[hh.active] : hh.equip[it.slot === 'ring' ? 'ring1' : it.slot];
    if (cur && idx != null) html += `<div class="dim">Currently worn: ${esc(cur.name)} (${cur.dmg ? cur.dmg + ' damage' : (cur.armor || 0) + ' armour'})</div>`;
    html += `<div style="color:#ffd84a">Sells for ${Game.itemValue(it)} gold</div>`;
  } else { const I = ITEMS[it.id], FB = FOOD_BUFFS[it.id]; html += `<b>${esc(I.name)}</b> <span class="dim">×${it.n}</span></div></div><div>${esc(I.desc)}</div>${FB ? `<div style="color:#ffcf70">${FB.drink ? 'Drink' : 'Food'} buff <b>${FB.name}</b>: ${FB.desc} for ${FB.drink ? 6 : 15} min. ${FB.drink ? 'Drinks are stronger but shorter than food.' : 'Food lasts long.'} Put a stack in the ${FB.drink ? 'Drink' : 'Food'} slot to keep it up automatically.</div>` : ''}<div style="color:#ffd84a">Sells for ${I.value} gold each</div>`; }
  tipEl.innerHTML = html;
  if (!withButtons) return;
  const row = el('div', 'row');
  const b = (t, fn, cls = 'btn') => { const x = el('button', cls, t); x.onclick = () => { S.click(); fn(); renderInventory(c); }; row.appendChild(x); };
  if (idx != null && it.kind === 'weapon') { if (it.wt === 'bow') b('Put in Ranged slot', () => Game.equipFromInv(hh, idx, 'ranged')); if (it.wt === 'bow' && !Game.canEquip(hh, it)) {} else if (Game.handsOf(it.wt) === 'off') b('Equip in Off Hand', () => Game.equipFromInv(hh, idx, 'w2')); else if (Game.handsOf(it.wt) === 'two') b('Equip (both hands)', () => Game.equipFromInv(hh, idx, 'w1')); else { b('Equip in Main Hand', () => Game.equipFromInv(hh, idx, 'w1')); if (hh.equip.w1 && !Game.isTwoHanded(hh.equip.w1)) b('Equip in Off Hand', () => Game.equipFromInv(hh, idx, 'w2')); } }
  else if (idx != null && !it.kind && FOOD_BUFFS[it.id]) { b(FOOD_BUFFS[it.id].drink ? 'Put in Drink slot' : 'Put in Food slot', () => Game.equipConsumable(hh, idx)); b(FOOD_BUFFS[it.id].drink ? 'Drink one now' : 'Eat one now', () => quickUse(idx)); }
  else if (idx != null && it.kind) b('Equip', () => Game.equipFromInv(hh, idx));
  else if (idx != null && ITEMS[it.id]?.use) b('Use', () => quickUse(idx));
  if (eqSlot) b('Take off', () => Game.unequip(hh, eqSlot));
  if (idx != null) b('Destroy', () => { hh.inv[idx] = null; selInv = null; G.hooks.invChanged && G.hooks.invChanged(); }, 'btn red');
  tipEl.appendChild(row);
}
export function portraitRect() { if (UI.open !== 'inv') return null; const e = document.getElementById('portrait'); return e ? e.getBoundingClientRect() : null; }
function quickUse(i) { const h = G.player.h, it = h.inv[i]; if (!it) return; if (it.kind) Game.equipFromInv(h, i, it.kind === 'weapon' && it.wt === 'bow' && !Game.canEquip(h, it) ? 'ranged' : undefined); else if (ITEMS[it.id]?.use) Game.useItem(h, it.id, G.player); }
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
      const lockedA = h.level < (ABILITIES[h.cls].find(x => x.id === a.icon) || {}).level;
      const row = el('div', 'abil' + (slot >= 0 ? ' onbar' : '') + (lockedA ? ' locked' : ''), `<div class="aic">${Icons.abilityIcon(a.icon)}${slot >= 0 ? `<span class="k">${slot + 1}</span>` : ''}</div><div style="flex:1"><b>${esc(a.name)}</b>${lockedA ? ` <span class="dim">learned at level ${a.lv}</span>` : ''}<div class="dim">${esc(a.d)}</div></div>`);
      const bs = el('div', 'slotbtns'); if (lockedA) { row.appendChild(bs); ab.appendChild(row); continue; }
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
  const c = openWin('quests', 'Journal', '', 'big');
  const h = G.player.h;
  const act = Object.keys(h.quests.active).map(id => QUESTS.find(q => q.id === id));
  const lay = el('div', 'qlog'), list = el('div', 'qlist'), det = el('div', 'tip');
  if (!act.length) list.innerHTML = '<p style="color:var(--dim)">No active quests. Look for villagers with a gold ! over their heads.</p>';
  if (!qSel || !act.includes(qSel)) qSel = act[0];
  const isT = (q) => !(h.untracked || []).includes(q.id);
  const setT = (q, on) => { h.untracked = (h.untracked || []).filter(x => x !== q.id); if (!on) h.untracked.push(q.id); updateTracker(); openQuestLog(); };
  if (act.length) { const bar = el('div', 'qtrackall'); const a = el('button', 'btn', 'Show all'); a.onclick = () => { h.untracked = []; updateTracker(); openQuestLog(); }; const n = el('button', 'btn', 'Hide all'); n.onclick = () => { h.untracked = act.map(q => q.id); updateTracker(); openQuestLog(); }; bar.append(el('span', 'dim', 'On screen:'), a, n); list.appendChild(bar); }
  for (const q of act) { const row = el('div', 'qrow'); const tg = el('label', 'qtrack' + (isT(q) ? ' on' : ''), `<input type="checkbox" ${isT(q) ? 'checked' : ''}><span>${isT(q) ? 'Shown' : 'Hidden'}</span>`); tg.title = 'Show this quest on screen'; tg.querySelector('input').onchange = (e) => { S.click(); setT(q, e.target.checked); }; const b = el('button', q === qSel ? 'on' : '', `<b>${esc(q.title)}</b>${Game.questComplete(h, q) ? ' <span style="color:var(--good)">✓</span>' : ''}<div style="font-size:12px;color:var(--dim)">Level ${q.lvl} · ${NPCS[q.giver].name}</div>`); b.onclick = () => { qSel = q; openQuestLog(); }; row.append(b, tg); list.appendChild(row); }
  list.appendChild(el('div', '', `<p style="color:var(--dim);font-size:13px;margin-top:10px">Completed: ${h.quests.done.length} / ${QUESTS.length}</p>`));
  if (qSel) {
    const q = qSel;
    det.innerHTML = `<h3>${esc(q.title)}</h3><p>${esc(q.text)}</p>` + q.obj.map((o, i) => { const pr = Game.objProgress(h, q, i), n = o.n || 1; return `<div class="obj" style="${pr >= n ? 'color:var(--good)' : ''}">${pr >= n ? '✓' : '•'} ${esc(o.label)} ${n > 1 ? `(${pr}/${n})` : ''}</div>`; }).join('') + `<p style="color:var(--dim)">Turn in to: <b>${esc(NPCS[q.turnin].name)}</b></p><div class="reward">Rewards: ${q.xp} XP · ${q.gold || 0} gold${q.gear ? ' · a piece of gear' : ''}${q.items ? ' · ' + Object.entries(q.items).map(([k, n]) => n + ' ' + ITEMS[k].name).join(', ') : ''}</div>`;
    const ab = el('button', 'btn red', 'Abandon quest'); ab.style.marginTop = '10px'; ab.onclick = () => { delete h.quests.active[q.id]; qSel = null; G.hooks.questsChanged(); openQuestLog(); }; det.appendChild(ab);
  }
  lay.append(list, det); c.appendChild(lay);
}

// --- map ---
// where each active quest objective can be done, found from the live world
const QCOL = ['#ffd84a', '#6fe0ff', '#ff7ad0', '#9cff6a', '#ffa04a', '#c8a0ff'];
export function questAreas(h) {
  const p = G.player, out = [];
  const near = (arr, n) => arr.map(o => [o, (o.x - p.pos.x) ** 2 + (o.z - p.pos.z) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, n).map(a => a[0]);
  const area = (pts) => { if (!pts.length) return null; const cx = pts.reduce((a, o) => a + o.x, 0) / pts.length, cz = pts.reduce((a, o) => a + o.z, 0) / pts.length; const r = Math.max(14, ...pts.map(o => Math.hypot(o.x - cx, o.z - cz) + 6)); return { x: cx, z: cz, r: Math.min(r, 70) }; };
  let qi = 0;
  for (const qid of Object.keys(h.quests.active)) {
    const q = QUESTS.find(x => x.id === qid); if (!q) continue; const col = QCOL[qi++ % QCOL.length];
    const tracked = !(h.untracked && h.untracked.includes(qid)), ready = Game.questComplete ? Game.questComplete(h, q) : false;
    const objs = [];
    if (ready) { const n = G.npcs.find(n => n.id === (q.turnin || q.giver)); if (n) objs.push({ label: 'Hand in to ' + n.name, x: n.pos.x, z: n.pos.z, r: 0, done: false, turnin: true }); }
    else q.obj.forEach((o, k) => {
      const pr = Game.objProgress(h, q, k) || 0, n = o.n || 1; if (pr >= n) return;
      let a = null;
      if (o.t === 'talk') { const np = G.npcs.find(x => x.id === o.npc); if (np) a = { x: np.pos.x, z: np.pos.z, r: 0 }; }
      else if (o.t === 'kill') a = area(near(G.mobs.filter(m => m.type === o.mob && m.hp > 0).map(m => ({ x: m.pos.x, z: m.pos.z })), 5));
      else if (o.t === 'collect') { const nodes = world.nodes.filter(nd => nd.alive && nd.def && nd.def.item === o.item); a = nodes.length ? area(near(nodes, 6)) : area(near(G.mobs.filter(m => m.hp > 0 && m.def.loot && m.def.loot[o.item]).map(m => ({ x: m.pos.x, z: m.pos.z })), 5)); }
      else if (o.t === 'craft') { const R = RECIPES.find(r => r.out === o.item); const st = R && world.stations.filter(s => s.type === R.station); if (st && st.length) { const s0 = near(st, 1)[0]; a = { x: s0.x, z: s0.z, r: 0 }; } }
      objs.push(Object.assign({ label: `${o.label} ${pr}/${n}` }, a || {}));
    });
    out.push({ q, col, tracked, ready, objs });
  }
  return out;
}
let mapSel = null;
export function openMap() {
  const c = openWin('map', 'Map of the Realm', '', 'mapfull');
  const h = G.player.h, p = G.player, areas = questAreas(h);
  const wrap = el('div', 'maplay'); c.appendChild(wrap);
  const holder = el('div', 'mapcv'); wrap.appendChild(holder);
  const side = el('div', 'mapside'); wrap.appendChild(side);
  const draw = () => {
    const N = Math.floor(Math.min(holder.clientWidth, holder.clientHeight)) || 600;
    holder.innerHTML = ''; const cv = el('canvas'); cv.width = cv.height = N * 2; cv.style.width = cv.style.height = N + 'px'; holder.appendChild(cv);
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(mapCanvas, 0, 0, N * 2, N * 2);
    const s = N * 2 / (HALF * 2), P = (x, z) => [(x + HALF) * s, (z + HALF) * s], k = N / 380;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lbl = (t, x, z, size = 30, col = '#ffe2a0') => { const [px, pz] = P(x, z); size *= k; g.font = `700 ${size}px Cinzel, serif`; g.lineWidth = size / 5; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(t, px, pz); g.fillStyle = col; g.fillText(t, px, pz); };
    const icon = (x, z, ch, col, size = 22) => { const [px, pz] = P(x, z); size *= k; g.beginPath(); g.arc(px, pz, size * 0.62, 0, 7); g.fillStyle = 'rgba(0,0,0,.65)'; g.fill(); g.lineWidth = 2 * k; g.strokeStyle = col; g.stroke(); g.font = `900 ${size * 0.8}px sans-serif`; g.fillStyle = col; g.fillText(ch, px, pz + 1); };
    if (G.battleMapDraw) G.battleMapDraw(g, P, k, lbl, icon, s); else {
    lbl('Driftwood Coast', 0, 470, 26); lbl('Sunmeadow', 0, 250, 26); lbl('Whisperwood', -80, 60, 26); lbl('Frostpeak Highlands', -300, -330, 26, '#e8f2ff'); lbl('The Ashlands', 290, -380, 26, '#ffb090');
    // zone level ranges
    const ZP = { coast: [0, 470], meadow: [0, 250], wood: [-80, 60], highlands: [-300, -330], ashlands: [290, -380] };
    for (const zn of ZONES) if (ZP[zn.id]) lbl(`Levels ${zn.lv}`, ZP[zn.id][0], ZP[zn.id][1] + 20, 13, '#e8dcc0');
    icon(VILLAGE.x, VILLAGE.z, '⌂', '#fff', 26); lbl('Seabreak Village', VILLAGE.x, VILLAGE.z - 22, 18, '#fff');
    for (const [x, z, t] of [[-40, 44, 'Ranger Outpost'], [-225, -318, 'Stonewatch'], [238, -346, 'Emberwatch']]) { icon(x, z + 20, '⌂', '#fff', 20); lbl(t, x, z, 16, '#fff'); }
    lbl('Bandit Camp', 200, -80, 15, '#ffb0a0'); icon(200, -62, '⚔', '#ff8a7a', 18); lbl('Old Ruins', -330, -440, 15, '#ffb0a0'); lbl("Troll King's Throne", -150, -500, 15, '#ffb0a0'); icon(-150, -485, '☠', '#ff6060', 20); lbl('Volcano', 400, -500, 17, '#ff8060'); lbl('Waterfall', -366, -120, 14, '#bfe8ff');
    for (const gc of GOBLIN_CAMPS) { icon(gc[0], gc[1], '⛺', '#9cdc5a', 16); lbl(`Goblin Camp ${gc[2]}-${gc[3]}`, gc[0], gc[1] + 16, 11, '#c8f0a0'); } }
    // quest areas
    for (const A of areas) { if (!A.tracked && mapSel !== A.q.id) continue; const hi = !mapSel || mapSel === A.q.id;
      for (const o of A.objs) { if (o.x == null) continue; const [px, pz] = P(o.x, o.z);
        g.globalAlpha = hi ? 1 : 0.35;
        if (o.r > 0) { g.beginPath(); g.arc(px, pz, o.r * s, 0, 7); g.fillStyle = A.col + '33'; g.fill(); g.setLineDash([8 * k, 6 * k]); g.lineWidth = 3 * k; g.strokeStyle = A.col; g.stroke(); g.setLineDash([]); }
        icon(o.x, o.z, o.turnin ? '?' : '◆', A.col, o.turnin ? 24 : 16); g.globalAlpha = 1; } }
    for (const m of markers(h)) icon(m.x, m.z, m.t, '#ffd84a', 24);
    const [px, pz] = P(p.pos.x, p.pos.z);
    g.save(); g.translate(px, pz); g.scale(k * 0.95, k * 0.95); g.rotate(-p.yaw + Math.PI); g.shadowColor = '#000'; g.shadowBlur = 8; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -18); g.lineTo(12, 14); g.lineTo(0, 7); g.lineTo(-12, 14); g.closePath(); g.stroke(); g.fill(); g.restore();
  };
  const renderSide = () => {
    if (G.battleMapSide) { G.battleMapSide(side); return; }
    side.innerHTML = `<h3>Quests</h3>` + (areas.length ? '' : '<p class="dim">No active quests. Look for a gold ! over a villager.</p>');
    for (const A of areas) {
      const d = el('div', 'mq' + (mapSel === A.q.id ? ' sel' : '') + (A.tracked ? '' : ' off'), `<div class="mqh"><i style="background:${A.col}"></i><b>${esc(A.q.title)}</b>${A.ready ? '<span class="rdy">Ready</span>' : ''}</div>` + A.objs.map(o => `<div class="mqo">${o.turnin ? '?' : '◆'} ${esc(o.label)}${o.x == null ? ' <span class="dim">(anywhere)</span>' : ''}</div>`).join(''));
      d.onclick = () => { S.click(); mapSel = mapSel === A.q.id ? null : A.q.id; renderSide(); draw(); }; side.appendChild(d);
    }
    side.insertAdjacentHTML('beforeend', `<h3>Legend</h3><div class="legend"><div><b style="color:#ffd84a">!</b> Quest to pick up</div><div><b style="color:#ffd84a">?</b> Quest to hand in</div><div><b>◆</b> Quest objective (circle = area)</div><div><b>⌂</b> Town or outpost</div><div><b style="color:#9cdc5a">⛺</b> Goblin camp (levels)</div><div><b style="color:#ff8a7a">⚔</b> Bandits · <b style="color:#ff6060">☠</b> Boss</div><div><b>➤</b> You</div></div><p class="dim">Click a quest to highlight it. M or Esc closes.</p>`);
  };
  renderSide(); requestAnimationFrame(draw);
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
    // keyboard: E does the obvious thing, 1-9 pick an option
    const btns = [...c.querySelectorAll('.opts button')];
    const primary = view ? btns[0] : (ready.length || offer.length ? btns[0] : btns[btns.length - 1]);
    btns.forEach((b, i) => { b.insertAdjacentHTML('afterbegin', `<kbd>${b === primary ? 'E' : i + 1}</kbd>`); });
    dialogKeys = { primary, btns };
  };
  render(null);
}
let dialogKeys = null;
export function dialogKey(code) {
  if (UI.open !== 'dialog' || !dialogKeys) return false;
  if (code === 'KeyE' || code === 'Space' || code === 'Enter') { dialogKeys.primary?.click(); return true; }
  const m = /^(Digit|Numpad)([1-9])$/.exec(code); if (m) { dialogKeys.btns[+m[2] - 1]?.click(); return true; }
  return false;
}

// --- merchant ---
const TOOL_SHOP = [[1, 3, 1], [2, 30, 4], [3, 110, 9], [4, 320, 14]]; // tier, price, level
export function openMerchant(npc) {
  const c = openWin('merchant', esc(npc.name) + "'s Wares", '', 'big shopwin');
  let tab = 'tools', last = '';
  const render = () => {
    const h = G.player.h; c.innerHTML = '';
    const top = el('div', 'shoptop', `<div class="shopwho"><b>${esc(npc.name)}</b><span>${esc(npc.def.title || 'Merchant')}</span></div><div class="shopgold">${Icons.coin()} <b>${h.gold}</b> gold</div>`);
    c.appendChild(top);
    const lay = el('div', 'shoplay'); c.appendChild(lay);
    // buy side
    const buy = el('div', 'shopbuy');
    const tabs = el('div', 'shoptabs'); for (const [k, t] of [['tools', 'Tools'], ['supplies', 'Supplies']]) { const b = el('button', tab === k ? 'on' : '', t); b.onclick = () => { S.click(); tab = k; render(); }; tabs.appendChild(b); }
    buy.appendChild(tabs);
    const list = el('div', 'shoplist');
    const card = (icon, name, desc, price, state, onBuy) => {
      const d = el('div', 'scard' + (state ? ' dis' : ''), `<div class="sic">${icon}</div><div class="sinf"><b>${name}</b><span>${desc}</span></div><button class="sbuy" ${state ? 'disabled' : ''}>${state || `${Icons.coin()} ${price}`}</button>`);
      if (!state) d.querySelector('.sbuy').onclick = () => { onBuy(); S.coins(); render(); };
      list.appendChild(d);
    };
    if (tab === 'tools') {
      for (const t of Object.keys(TOOLS)) {
        const have = h.tools[t] || 0, next = TOOL_SHOP.find(x => x[0] > have);
        if (!next) { card(Icons.toolSvg(t, have), `${TOOL_TIER_NAMES[have]} ${TOOLS[t].name}`, `${TOOLS[t].desc} You have the best one.`, 0, 'Owned', null); continue; }
        const [tier, price, lvl] = next;
        const state = h.level < lvl ? `Level ${lvl}` : h.gold < price ? `${Icons.coin()} ${price}` : '';
        card(Icons.toolSvg(t, tier), `${TOOL_TIER_NAMES[tier]} ${TOOLS[t].name}`, `${TOOLS[t].desc}${have ? ` Upgrades your ${TOOL_TIER_NAMES[have]} one: works faster and on tougher ${t === 'pickaxe' ? 'ore' : t === 'hatchet' ? 'trees' : 'beasts'}.` : ''}`, price, state, () => { h.gold -= price; h.tools[t] = tier; toast(`Bought: ${TOOL_TIER_NAMES[tier]} ${TOOLS[t].name}`, TOOLS[t].icon, 'gold'); G.hooks.invChanged && G.hooks.invChanged(); });
      }
    } else for (const id of Game.merchantStock()) {
      const pr = Game.buyPrice(id), I = ITEMS[id];
      card(Icons.itemSvg({ id }), I.name, esc(I.desc || ''), pr, h.gold < pr ? `${Icons.coin()} ${pr}` : '', () => { h.gold -= pr; Game.addItem(h, id, 1); });
    }
    buy.appendChild(list); lay.appendChild(buy);
    // sell side
    const sell = el('div', 'shopsell', `<div class="shoph"><h3>Your Bag</h3><span class="dim">Click to sell one · Shift+click sells the stack</span></div>`);
    const grid = el('div', 'grid');
    const info = el('div', 'shopinfo', last || '<span class="dim">Hover an item to see what it sells for.</span>');
    h.inv.forEach((it, i) => {
      const cell = el('div', 'cell' + (it && it.kind ? ' r' + it.rarity : ''), it ? `${Icons.itemSvg(it)}${!it.kind ? `<span class="n">${it.n}</span>` : ''}` : '');
      if (it) {
        const v = Game.itemValue(it);
        cell.onmouseenter = () => { info.innerHTML = `<b>${esc(Game.itemName(it))}</b>${!it.kind && it.n > 1 ? ` ×${it.n}` : ''} <span class="sv">${Icons.coin()} ${v}${!it.kind && it.n > 1 ? ` each · ${v * it.n} for all` : ''}</span>`; };
        cell.onclick = (e) => { const n = !it.kind && e.shiftKey ? it.n : 1; h.gold += v * n; if (it.kind || it.n <= n) h.inv[i] = null; else it.n -= n; S.coins(); last = `Sold ${esc(Game.itemName(it))}${n > 1 ? ' ×' + n : ''} for <span class="sv">${Icons.coin()} ${v * n}</span>`; G.hooks.invChanged && G.hooks.invChanged(); render(); };
      }
      grid.appendChild(cell);
    });
    sell.append(grid, info); lay.appendChild(sell);
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
  row('Auto-equip better armour<small>Kingdom Battles: looted armour you can wear goes on straight away if it is better. Weapons never auto-equip.</small>', check('autoEquip'));
  const he = el('button', 'btn', '✥ Edit HUD layout'); he.onclick = () => { S.click(); enterHudEdit(); }; row('HUD layout<small>Move, resize or hide any part of the screen</small>', he);
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
  grp('Fighting', [['Left click', 'Attack. Every weapon has its own combo: swords 3 swings, maces a swing then a crushing blow, daggers 5 fast stabs, spears 4 thrusts. Bigger weapons swing slower but harder.'], ['Right click', 'Weapon special attack (Wheel Strike, Skull Crack, Twin Fury, Meteor...), on a cooldown'], ['F (hold)', 'Block. Shields stop the most damage.'], ['1 2 3', 'Class abilities (choose which three in Class Talents)'], ['4 5 6', 'Potions and food'], ['R', 'Use your best healing item'], ['Q', 'Switch to the bow in your Ranged slot and back']]);
  grp('World', [['E', 'Talk, loot, skin, chop, mine, gather and use crafting stations'], ['Red swords', 'Above a name: this enemy attacks on sight'], ['Ring colour', 'Under an enemy: grey/green easy, blue fair, white even, yellow hard, red dangerous']]);
  grp('Windows', [['I', 'Character, gear and bags'], ['N', 'Class talents and abilities'], ['J', 'Journal (quest log)'], ['M', 'World map'], ['P', 'Recipes'], ['Esc', 'Pause menu (press once to free the mouse, again for the menu)']]);
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

// ---------- HUD layout editor: move, resize and hide parts of the screen ----------
const HUD_PARTS = [['mapbox', 'Minimap'], ['tracker', 'Quest tracker'], ['bottom', 'Health bars & hotbar'], ['lvl', 'Hero badge & gold'], ['buffs', 'Buffs'], ['debuffs', 'Debuffs'], ['target', 'Target frame'], ['toasts', 'Messages'], ['xpbar', 'Experience bar'], ['combo', 'Left-click combo guide']];
const hudCfg = () => (settings.hud = settings.hud || {});
export function applyHud() {
  const cfg = hudCfg(), edit = !!G.hudEdit;
  for (const [id] of HUD_PARTS) {
    const e = id === 'combo' ? document.querySelector('.combostrip') : $(id); if (!e) continue;
    const c = cfg[id] || {};
    e.classList.toggle('hudhidden', !!c.hide);
    e.style.display = c.hide && !edit ? 'none' : '';
    if (id === 'combo') continue;
    if (c.x != null) { e.style.left = (c.x * innerWidth) + 'px'; e.style.top = (c.y * innerHeight) + 'px'; e.style.right = 'auto'; e.style.bottom = 'auto'; e.style.transform = `scale(${c.s || 1})`; e.style.transformOrigin = 'top left'; if (c.w) e.style.width = c.w + 'px'; }
    else { e.style.left = e.style.top = e.style.right = e.style.bottom = e.style.transform = e.style.transformOrigin = e.style.width = ''; }
  }
}
function capture(id) { const c = hudCfg()[id] = hudCfg()[id] || {}; if (c.x == null) { const r = $(id).getBoundingClientRect(); c.x = r.left / innerWidth; c.y = r.top / innerHeight; c.s = c.s || 1; if (id === 'xpbar') c.w = r.width; } return c; }
let hudPanel = null;
export function enterHudEdit() {
  winRoot().innerHTML = ''; UI.open = null; G.uiOpen = true; G.hudEdit = true; if (document.pointerLockElement) document.exitPointerLock();
  $('clickToPlay').hidden = true;
  const hud = $('hud'); hud.classList.add('hudedit');
  for (const [id, name] of HUD_PARTS) { if (id === 'combo') continue; const e = $(id); e.dataset.hudname = name; e.onpointerdown = (ev) => hudDrag(ev, id); e.onwheel = (ev) => { ev.preventDefault(); const c = capture(id); c.s = Math.max(0.5, Math.min(2.2, (c.s || 1) - Math.sign(ev.deltaY) * 0.05)); saveSettings(); applyHud(); renderHudPanel(); }; }
  if (!$('target').textContent.trim()) $('target').hidden = false;
  hudPanel = el('div', 'hudpanel'); document.body.appendChild(hudPanel); renderHudPanel(); applyHud();
}
function renderHudPanel() {
  const cfg = hudCfg();
  hudPanel.innerHTML = `<h3 title="Drag to move this panel">✥ Edit HUD</h3><p>Drag a highlighted box to move it. Mouse wheel over it, or the slider, to resize. Drag this panel by its title.</p>`;
  hudPanel.querySelector('h3').onpointerdown = (ev) => { const r = hudPanel.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top; const mv = (m) => { hudPanel.style.transform = 'none'; hudPanel.style.left = (m.clientX - dx) + 'px'; hudPanel.style.top = (m.clientY - dy) + 'px'; }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
  for (const [id, name] of HUD_PARTS) {
    const c = cfg[id] || {}, r = el('div', 'hprow');
    r.innerHTML = `<label><input type="checkbox" ${c.hide ? '' : 'checked'}> ${name}</label>` + (id === 'combo' ? '<span></span>' : `<input type="range" min="0.5" max="2.2" step="0.05" value="${c.s || 1}"><b>${Math.round((c.s || 1) * 100)}%</b>`);
    r.querySelector('input[type=checkbox]').onchange = (e) => { (cfg[id] = cfg[id] || {}).hide = !e.target.checked; saveSettings(); applyHud(); };
    const sl = r.querySelector('input[type=range]'); if (sl) sl.oninput = () => { const k = capture(id); k.s = +sl.value; r.querySelector('b').textContent = Math.round(k.s * 100) + '%'; saveSettings(); applyHud(); };
    hudPanel.appendChild(r);
  }
  const row = el('div', 'hpbtns'); const rs = el('button', 'btn', 'Reset layout'); rs.onclick = () => { S.click(); settings.hud = {}; saveSettings(); applyHud(); renderHudPanel(); };
  const done = el('button', 'btn gold', 'Done'); done.onclick = () => { S.click(); exitHudEdit(); }; row.append(rs, done); hudPanel.appendChild(row);
}
function hudDrag(ev, id) {
  if (!G.hudEdit || ev.button !== 0) return; ev.preventDefault();
  const c = capture(id); applyHud(); const e = $(id), x0 = ev.clientX, y0 = ev.clientY, cx = c.x * innerWidth, cy = c.y * innerHeight;
  const mv = (m) => { const r = e.getBoundingClientRect(); c.x = Math.max(0, Math.min(innerWidth - Math.min(r.width, 60), cx + m.clientX - x0)) / innerWidth; c.y = Math.max(0, Math.min(innerHeight - 20, cy + m.clientY - y0)) / innerHeight; applyHud(); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); saveSettings(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
export function exitHudEdit() {
  G.hudEdit = false; G.uiOpen = false; $('hud').classList.remove('hudedit');
  for (const [id] of HUD_PARTS) { const e = id === 'combo' ? null : $(id); if (e) { e.onpointerdown = null; e.onwheel = null; } }
  if (hudPanel) { hudPanel.remove(); hudPanel = null; }
  if (!G.target) $('target').hidden = true;
  applyHud(); $('clickToPlay').hidden = false; if (G.onUiClosed) G.onUiClosed();
}
addEventListener('resize', () => { if (G.player) applyHud(); });
