// HUD and windows: bars, ability bar, minimap, nameplates & quest markers, toasts, banners,
// inventory/character, crafting, quest log, map, NPC dialog, merchant, pause menu, settings.
import * as THREE from 'three';
import { G } from './state.js';
import { S, A } from './audio.js';
import { settings, saveSettings, DEFAULT_SETTINGS } from './saves.js';
import { PROCS, procChance, PROC_DEX } from './data.js';
import * as Skills from './skills.js';
import { HOTBAR_KEYS, SUPPORT_SLOTS, RACES, CLASSES, WEAPON_TYPES, ABILITIES, AREA_UNLOCK_LEVEL, ITEMS, TOOLS, TOOL_TIER_NAMES, QUESTS, NPCS, RARITY, STAT_NAMES, STAT_DESC, xpForLevel, LEVEL_CAP, ZONES, STATIONS, RECIPES, GOBLIN_CAMPS, ARMOR_SLOT_LIST, RANK2_LEVEL, CLASS_POOLS, TIERS, FAMILIES, WSKILLS, slotSkills, classFamilies, familyTree, COMBOS, RMB_SPECIAL, SLOT_LABEL, CLASS_TREE, WEAPON_TREE, MASTERY_CAP, masteryXpFor, FOOD_BUFFS } from './data.js';
import * as Game from './game.js';
import { BATTLE } from './battlemap.js';
import * as Icons from './icons.js';
import { HALF, heightAt, zoneAt, biomeMasks, VILLAGE, ROADS, RIVER, CAMPS, LAKE, beachMask, MOUNT, PORT } from './terrain.js';
import { fbm } from './util.js';
import { pois, known, LORE, villagerNews, smallTalk } from './lore.js';
import { isExplored } from './fog.js';
import { world } from './world.js';
import { goFull, exitFull } from './menu.js';

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
export function comboSteps(wt, battle = G.battleFx) {
  const W = WEAPON_TYPES[wt]; if (!W) return [];
  if (W.kind === 'bow') return [{ n: 'Arrow', d: 100, tags: battle ? ['Hold to draw: harder, faster, straighter', 'Headshots x2'] : ['Ranged'] }];
  if (W.kind === 'gun') return [{ n: 'Musket shot', d: 100, tags: ['Hold to aim down the barrel: harder and straighter', 'Headshots x2'] }];
  if (W.kind === 'staff') { const bolt = { n: W.element === 'fire' ? 'Tap: Firebolt' : W.element === 'frost' ? 'Tap: Frostbolt' : 'Tap: Arcane Bolt', d: 100, tags: [W.element === 'fire' ? '🔥 Burns' : W.element === 'frost' ? '🐌 Slows' : 'Ranged'] };
    if (!battle) return [bolt];
    return [bolt, { n: W.element === 'fire' ? 'Hold: Flamethrower' : W.element === 'frost' ? 'Hold: Frost Blast' : 'Hold: Arcane Beam', d: 32, tags: [W.element === 'fire' ? '🔥 Cone, sets enemies burning' : W.element === 'frost' ? '❄ Cone, slows, freezes if held on them' : '⚡ Beam, pierces a whole line', 'Uses mana while held'] }]; }
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
  // one dock at the bottom centre: level badge beside the bars, the hotbar, a thin XP line under it
  if (G.newFx && !document.querySelector('#bottom .barsrow')) { const bt = $('bottom'), row = el('div', 'barsrow'); bt.insertBefore(row, bt.firstChild); row.append($('lvl'), $('bars')); bt.appendChild($('xpbar')); }
  const p = G.player, h = p.h, bar = $('abil'); bar.innerHTML = '';
  const ws = el('div', 'wslots');
  ws.append(el('div', 'slot mini', ''), el('div', 'slot mini', ''));
  if (!G.newFx) bar.appendChild(ws); // campaign: no weapon swapping any more
  const mk = (k, iconHtml, cls = '') => { const s = el('div', 'slot ' + cls, `<span class="ai">${iconHtml}</span><span class="k">${k}</span><div class="cd" style="display:none"></div>`); bar.appendChild(s); return s; };
  const lmb = mk('LMB', '', 'wpn');
  const rmb = G.newFx ? null : mk(G.battleFx ? 'F' : 'RMB', '', 'wab');
  bar.appendChild(el('div', 'sep'));
  // keys 1-5: buffs, songs, heals; then F, C, Q: the damage abilities
  const hb = G.newFx ? HOTBAR_KEYS.map((k, i) => { if (i === SUPPORT_SLOTS) bar.appendChild(el('div', 'sep')); return mk(k, '', 'hb' + (i >= SUPPORT_SLOTS ? ' dmg' : ' sup')); }) : Array.from({ length: G.hotbarSlots ? G.hotbarSlots + (G.itemSlots || 0) : 6 }, (_, i) => mk(String(i + 1), '', 'hb' + (G.hotbarSlots && i >= G.hotbarSlots ? ' item' : '')));
  bar.appendChild(el('div', 'sep'));
  const f = mk(G.battleFx ? 'RMB' : 'F', Icons.abilityIcon('shield'), 'small'); f.title = G.battleFx ? 'Hold right click to block. Raise it just before a hit for a perfect block.' : 'Hold F to block';
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
    cs.innerHTML = st.length ? `<div class="cst">${W.kind === 'melee' ? 'Left-click combo' + (G.newFx ? ' · hold for heavy' : '') : 'Left click'}${G.newFx ? ' · K for abilities' : G.battleFx ? ' · F special · K for details' : ''}</div><div class="crow">` + st.map((x, i) => `<div class="cstep${i === st.length - 1 && st.length > 1 ? ' fin' : ''}"><b>${i + 1}</b><span>${x.n}</span><i>${x.d}%</i>${x.tags.map(t => `<em>${t}</em>`).join('')}</div>`).join('') + '</div>' : '';
    { const sid = W && G.battleFx && !G.newFx ? RMB_SPECIAL[p.weapon.wt] : null, S2 = sid && WSKILLS[sid]; if (S2) cs.innerHTML += `<div class="crow"><div class="cstep fin fsp" title="${S2.desc.replace(/"/g, '')}"><b>F</b><span>${S2.name}</span><i>⟳ ${S2.cd || ''}s</i></div></div>`; }
    cs._n = st.length; cs.classList.toggle('battle', !!G.battleFx); if ((settings.hud || {}).combo?.hide) cs.style.display = 'none'; requestAnimationFrame(() => { const l = abilEls.lmb; cs.style.right = (l.parentNode.offsetWidth - l.offsetLeft - l.offsetWidth) + 'px'; }); }
  const sk = p.skills();
  abilEls.f.title = G.battleFx ? 'Hold right click to block. Raise it just before a hit for a perfect block (no damage).' : 'Hold F to block';
  if (abilEls.rmb) { const id = p.weapon ? RMB_SPECIAL[p.weapon.wt] : null; abilEls.rmb.querySelector('.ai').innerHTML = id ? Icons.abilityIcon(WSKILLS[id].icon) : ''; abilEls.rmb.title = id ? `${G.battleFx ? 'F' : 'Right click'}: ${WSKILLS[id].name}. ${WSKILLS[id].desc}` : ''; }
  (h.hotbar || []).forEach((sl, i) => {
    const e = abilEls.hb[i], key = sl ? sl.t + ':' + sl.id : '';
    if (e._key !== key) {
      const ai = e.querySelector('.ai');
      e.className = 'slot hb' + (G.newFx ? (i >= SUPPORT_SLOTS ? ' dmg' : ' sup') : '') + (sl && sl.t === 'ab' ? ' cls ' + h.cls : '');
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
    if (abilEls.rmb) { const id = p.weapon ? RMB_SPECIAL[p.weapon.wt] : null; if (id) setCd(abilEls.rmb, p.cd.w0, WSKILLS[id].cd); }
    (h.hotbar || []).forEach((sl, i) => {
      const e = abilEls.hb[i]; if (!e) return;
      if (sl && sl.t === 'ab') { const k = ABILITIES[h.cls].findIndex(a => a.id === sl.id), a = ABILITIES[h.cls][k]; if (!a) return; { const own = p.cd['a' + (k + 1)] || 0, ban = 0, gcd = G.hotbarSlots && i < SUPPORT_SLOTS ? (p.gcdT || 0) - G.time : 0, lock = Math.max(ban, gcd); if (lock > own) { setCd(e, lock, 1.5); e.querySelector('.cd').textContent = ''; } /* the shared 1.5 s lock: just the shadow, no number */ else setCd(e, own, a.cd); e.classList.toggle('lock', lock > own && lock > 0); } const cur = CLASS_POOLS[h.cls].uses === 'mana' ? p.mana : p.end; e.style.opacity = cur < a.cost ? 0.55 : 1; }
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
    // your buffs (green rim) and debuffs (red rim) as small icon chips with a countdown, one row each above the bars
    const B = p.buffs, chips = [], add = (on, ic, name, t, col) => { if (on) chips.push([ic, name, t, col]); };
    add(B.cry > 0, '📯', 'Battle Cry · +30% damage', B.cry, '#ffb050'); add(B.fury > 0, '🐺', 'Fury', B.fury, '#ff7050'); add(p.stealth > 0, '☁', 'Unseen', p.stealth, '#b0a0ff');
    add(B.nextCrit, '✦', 'Next hit x2', 0, '#ffd050'); add(!!p.regen, '❤', 'Regenerating', p.regen && p.regen.t, '#7ee07e');
    add(B.adren > 0, '⚡', 'Adrenaline', B.adren, '#ffd050'); add(B.tq > 0, '✚', 'Tourniquet', B.tq, '#ff8080'); add(B.surge > 0, '💧', 'Mana Surge', B.surge, '#8ac8ff');
    add(B.barrier > 0, '❄', 'Barrier ' + Math.round(B.barrier || 0), B.barrierT, '#8ad8ff'); add(B.swind > 0, '💨', 'Second Wind', B.swind, '#c8f0ff');
    add(B.bWar > 0, '⚑', 'War Banner · +20% damage', 0, '#ff7a3a'); add(B.bVigor > 0, '⚑', 'Banner of Vigor · healing', 0, '#60ff90'); add(B.bStone > 0, '⚑', 'Banner of Stone · -30% damage taken', 0, '#8ac8ff');
    add(B.wall > 0, '🛡', 'Shield Wall · -60% damage', B.wall, '#a8c8ff'); add(B.lich > 0, '💀', 'Lich Lord', B.lich, '#5aff6a'); add(B.stand > 0, '♥', 'Last Stand', B.stand, '#ffc060'); add(B.rage > 0, '🩸', 'Bloodrage', B.rage, '#ff4040');
    add(B.rampage > 0, '⚔', 'Rampage', B.rampage, '#ff7050'); add(B.ward > 0, '✧', 'Warded', B.ward, '#a8e0ff'); add(B.flame > 0, '🔥', 'Flame weapon', B.flame, '#ff9a40');
    add(B.clarity > 0, '✺', 'Clarity', B.clarity, '#a0d8ff'); add(B.focus > 0, '◎', 'Focus', B.focus, '#c0ff90'); add(B.undying > 0, '☠', 'Undying', B.undying, '#ff5050');
    if (h.sb) for (const id in h.sb) chips.push(['✦', h.sb[id].name + ' · ' + h.sb[id].text, h.sb[id].t, '#ffd84a']);
    for (const k of ['food', 'drink']) if (h[k] && h[k].t > 0) { const F = FOOD_BUFFS[h[k].id]; chips.push([k === 'food' ? '🍖' : '🍺', F.name, h[k].t, '#e8c87a']); }
    const DB = { bleed: ['🩸', 'Bleeding'], poison: ['☠', 'Poisoned'], burn: ['🔥', 'Burning'], slow: ['🐌', 'Slowed'], stun: ['💫', 'Stunned'] }, bad = [];
    if (p.db) for (const k in p.db) if (p.db[k].t > 0 && DB[k]) bad.push([DB[k][0], DB[k][1], p.db[k].t, '#ff4a3a']);
    const chipHtml = (L, kind) => L.map(([ic, nm, t, col]) => `<div class="aura ${kind}" style="--c:${col}" title="${nm}"><span>${ic}</span>${t > 0 ? `<b>${t >= 60 ? Math.ceil(t / 60) + 'm' : Math.ceil(t)}</b>` : ''}</div>`).join('');
    { const html = chipHtml(chips, 'good'); const e = $('buffs'); if (e._h !== html) { e.innerHTML = html; e._h = html; } }
    { const html = chipHtml(bad, 'bad'); const e = $('debuffs'); if (e._h !== html) { e.innerHTML = html; e._h = html; } }
  }
  // interaction prompt
  const it = !G.uiOpen && !p.gathering && !p.dead ? p.findInteract() : null;
  const pr = $('prompt'); if (it) { pr.hidden = false; pr.innerHTML = `<kbd>E</kbd>${esc(it.label)}`; } else pr.hidden = true;
  // target frame
  const t = G.target;
  if (t && !t.dead && t.pos.distanceTo(p.pos) < 45) { $('target').hidden = false; $('target').querySelector('.nm').innerHTML = `<span class="lvb" style="--c:${lvlCol(t.lv, h.level)}">${t.lv}</span> ${t.def.elite ? '★ ' : ''}<span style="color:${lvlCol(t.lv, h.level)}">${esc(t.name)}</span>`; $('target').querySelector('.bar2 i').style.width = (t.hp / t.maxHp * 100) + '%'; $('target').querySelector('.bar2 span').textContent = `${Math.ceil(t.hp)} / ${t.maxHp}`;
    if (G.newFx) { let dsc = $('target').querySelector('.tdesc2'); if (!dsc) { dsc = document.createElement('div'); dsc.className = 'tdesc2'; $('target').insertBefore(dsc, $('target').querySelector('.bar2')); }
      const dl = t.lv - h.level, con = dl >= 3 ? ['Deadly', 'Looks like it would wipe the floor with you.'] : dl >= 1 ? ['Tough', 'This would be a tough fight.'] : dl === 0 ? ['Even match', 'An even match.'] : dl >= -2 ? ['Easy', 'You could take it.'] : dl >= -5 ? ['Weak', 'It is no real threat.'] : ['Trivial', 'Not worth your time.'];
      const dfn = (mk) => { const d = Math.max(0, t.lv - 1) * 2 * (mk || 1); return Math.round(Math.min(0.75, d / (d + 60 + h.level * 10)) * 100); };
      const html = `<span class="tcon" style="color:${lvlCol(t.lv, h.level)}">Level ${t.lv} · ${con[0]}${t.def.elite ? ' · Elite' : ''}${t.def.boss ? ' · Boss' : ''}</span><span class="tdd">🛡 Blocks ${dfn(t.def.physK)}% of weapon damage · ✨ ${dfn(t.def.magicK)}% of magic</span><span class="tdd">${esc(mobDesc(t))} ${con[1]}</span>`; if (dsc._h !== html) { dsc.innerHTML = html; dsc._h = html; } }
    { const st = t.status || {}, L = []; const a = (on, ic, nm, v, col) => { if (on) L.push([ic, nm, v, col]); };
      a(st.stun > 0, '💫', 'Stunned', st.stun, '#e0c020'); a(st.frozen > 0, '❄', 'Frozen', st.frozen, '#8ad8ff'); a(st.slow > 0, '🐌', 'Slowed', st.slow, '#4a8ad8');
      a(st.bleed > 0, '🩸', 'Bleeding', st.bleed, '#e02020'); a(st.burn > 0, '🔥', 'Burning', st.burn, '#ff7020'); a(st.dot > 0, '☣', st.dotName || 'Disease', st.dot, '#90e040');
      a(t.hexUntil > G.time, '🌀', 'Hexed', t.hexUntil - G.time, '#b070ff'); a(st.fear > 0, '😱', 'Feared', st.fear, '#c060ff');
      let row = $('target').querySelector('.tst'); if (!row) { row = document.createElement('div'); row.className = 'tst'; $('target').appendChild(row); }
      const html = L.map(([ic, nm, v, col]) => `<div class="aura bad" style="--c:${col}" title="${nm}"><span>${ic}</span><b>${Math.ceil(v)}</b></div>`).join(''); if (row._h !== html) { row.innerHTML = html; row._h = html; } } }
  else { $('target').hidden = true; if (t && (t.dead || t.pos.distanceTo(p.pos) > 45)) G.target = null; }
}
// a line about what a creature is, for the target box
const MOB_DESC = { wolf: 'A grey island wolf: quick, and rarely alone.', bear: 'A big brown bear. Slow to anger, hard to stop.', tiger: 'A striped jungle tiger that stalks before it pounces.', boar: 'A wild boar with sharp tusks and a short temper.', goblin: 'One of Gorgrak\'s goblins: sneaky, greedy and armed.', skeleton: 'Old bones held together by dark magic.', spider: 'A huge spider that spits venom.', crab: 'A shore crab with heavy claws.', bandit: 'A cut-throat who preys on travellers.', troll: 'A hulking troll that heals its wounds.', golem: 'Living stone, hard to break.', imp: 'A small fire imp.', rat: 'A big, mangy rat.', deer: 'A shy deer.' };
function mobDesc(m) { const v = (m.def && (m.def.variant || m.def.shape)) || '', id = m.type || ''; for (const k in MOB_DESC) if (id.includes(k) || v === k) return MOB_DESC[k]; return m.hostile ? 'A hostile creature.' : 'A wild creature.'; }
export function lvlCol(ml, pl) { const d = ml - pl; return d >= 3 ? '#ff3a30' : d >= 1 ? '#ffe040' : d === 0 ? '#ffffff' : d >= -2 ? '#4a7aff' : d >= -4 ? '#6ad0ff' : d >= -6 ? '#5ae05a' : '#9a9a9a'; }
export function progress(k, label) { const e = $('progress'); if (k == null) { e.hidden = true; return; } e.hidden = false; e.querySelector('span').textContent = label; e.querySelector('i').style.width = (Math.min(1, k) * 100) + '%'; }

// ---------- nameplates & quest markers ----------
const plates = new Map(); const v3 = new THREE.Vector3();
// line of sight for nameplates and ! ? markers: hidden behind hills, walls and houses (checked a few times a second)
const losCache = new Map(); let wallBoxes = null;
function blocked(from, to) {
  if (!wallBoxes) wallBoxes = world.colliders.filter(c => c.t === 'b' && c.hw * c.hd > 1.5); // houses, walls, big props
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, L = Math.hypot(dx, dz), n = Math.max(6, Math.min(40, Math.ceil(L / 2)));
  const near = wallBoxes.filter(c => { const ex = Math.max(c.hw, c.hd) + 1; return Math.min(from.x, to.x) - ex < c.x && c.x < Math.max(from.x, to.x) + ex && Math.min(from.z, to.z) - ex < c.z && c.z < Math.max(from.z, to.z) + ex; });
  for (let i = 1; i < n; i++) { const k = i / n, x = from.x + dx * k, y = from.y + dy * k, z = from.z + dz * k, g = heightAt(x, z);
    if (y < g - 0.2) return true;
    for (const c of near) { const lx = (x - c.x) * c.cos - (z - c.z) * c.sin, lz = (x - c.x) * c.sin + (z - c.z) * c.cos; if (Math.abs(lx) < c.hw - 0.2 && Math.abs(lz) < c.hd - 0.2 && y < heightAt(c.x, c.z) + 5.5) return true; } }
  return false;
}
function visibleFromCam(key, pos) {
  let e = losCache.get(key); const now = performance.now();
  if (!e || now - e.t > 300) { e = { t: now + Math.random() * 80, v: !blocked(G.camera.position, pos) }; losCache.set(key, e); }
  return e.v;
}
const HOSTILE_SVG = '<svg viewBox="0 0 64 64"><path d="M8 56 L48 16 M16 8 L56 48" stroke="#140c06" stroke-width="11" stroke-linecap="round"/><path d="M8 56 L48 16 M16 8 L56 48" stroke="#ff4a3a" stroke-width="6" stroke-linecap="round"/><path d="M40 10 L54 10 L54 24 M24 10 L10 10 L10 24" stroke="#ffd0c0" stroke-width="4" fill="none"/></svg>';
export function updatePlates() {
  const layer = $('plates'), cam = G.camera, W = innerWidth, H = innerHeight, p = G.player;
  cam.updateMatrixWorld();
  const seen = new Set();
  const show = (key, ent, html, cls, yOff) => {
    seen.add(key);
    let e = plates.get(key); if (!e) { e = el('div', 'plate'); layer.appendChild(e); plates.set(key, e); }
    v3.copy(ent.pos); v3.y += yOff; const wp = v3.clone(); v3.project(cam);
    if (v3.z > 1 || !visibleFromCam(key, wp) || v3.x < -1.2 || v3.x > 1.2 || v3.y < -1.2 || v3.y > 1.2) { e.style.display = 'none'; return; }
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
      const name = (G.newFx || d < 22) ? `<div class="nm">${esc(n.name)}</div><div class="tt">&lt;${esc(n.def.title)}&gt;</div>` : '';
      if (m || name) show('n' + n.id, n, m + name, 'npc', n.height + 0.25);
    }
    for (const m of G.mobs) {
      if (m.dead) continue;
      const d = m.pos.distanceTo(p.pos); if (d > (m.isStruct ? 70 : 32) && m !== G.target) continue;
      const ally = m.team != null && m.team === G.myTeam; if (ally && d > 16 && !m.isStruct && m !== G.target) continue;
      const hostile = !ally && ((m.hostile && !(m.newbieCalm && m.newbieCalm())) || m.provoked);
      const anyDb = m.status.stun > 0 || m.status.frozen > 0 || m.status.slow > 0 || m.status.bleed > 0 || m.status.burn > 0 || m.status.dot > 0;
      if (d > 14 && m.hp >= m.maxHp && m !== G.target && !hostile && !anyDb && !G.newFx) continue;
      // campaign: no plate by default. The name shows for 8 s after your crosshair passes over it; the health bar
      // shows while it is hurt, and for 8 s after it is back to full. Your target always shows both.
      let showName = true, showHp = true;
      if (G.newFx && !m.isStruct && !ally) { const tgt = m === G.target; if (m.hp < m.maxHp) m.hurtSeenT = G.time;
        showName = tgt || G.time - (m.lookT || -99) < 8; showHp = tgt || G.time - (m.hurtSeenT || -99) < 8; if (!showName && !showHp && !anyDb) continue; }
      const cls = ally ? 'ally' : m.def.elite ? 'elite' : hostile ? 'hostile' : 'passive';
      const lc = lvlCol(m.lv, p.level), hpP = (m.hp / m.maxHp * 100).toFixed(0);
      const S2 = m.status; let db = '';
      for (const [k, ic, c] of [['stun', '💫', '#e0c020'], ['frozen', '❄', '#8ad8ff'], ['slow', '🐌', '#4a8ad8'], ['bleed', '🩸', '#c82020'], ['burn', '🔥', '#ff7020'], ['dot', '☠', '#8ae050']]) if (S2[k] > 0) db += `<span style="--c:${c}">${ic}<i>${Math.ceil(S2[k])}</i></span>`;
      if (G.newFx && !m.isStruct && !ally) { show('m' + m.id, m, `${showName ? `<div class="nm" style="color:${lc}">${esc(m.name)}</div>` : ''}${showHp ? `<div class="hpb"><i style="width:${hpP}%"></i></div>` : ''}${db ? `<div class="mdb">${db}</div>` : ''}`, cls + (m === G.target ? ' tgt' : ''), m.height + 0.35); continue; }
      show('m' + m.id, m, `<div class="lvrow">${hostile ? `<span class="hos" title="Hostile: attacks on sight">${HOSTILE_SVG}</span>` : ''}<div class="lvb" style="--c:${lc}">${m.def.elite ? '★' : ''}${m.lv}</div></div><div class="nm" style="color:${lc}">${esc(m.name)}</div><div class="hpb"><i style="width:${hpP}%"></i></div>${db ? `<div class="mdb">${db}</div>` : ''}`, cls + (m === G.target ? ' tgt' : ''), m.height + 0.35);
    }
  }
  for (const [k, e] of plates) if (!seen.has(k)) { e.remove(); plates.delete(k); }
}

// ---------- map rendering ----------
let mapCanvas = null; const MAPN = 1024;
const mapView = { z: 1, cx: 0.5, cy: 0.5 };
export function buildMapImage() {
  mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = MAPN;
  const g = mapCanvas.getContext('2d'), img = g.createImageData(MAPN, MAPN);
  const c = new THREE.Color(), t = new THREE.Color(), step = HALF * 2 / MAPN;
  const COLS = { deep: new THREE.Color('#123a63'), shallow: new THREE.Color('#2f8fa8'), reef: new THREE.Color('#5cc2c0'), sand: new THREE.Color('#e2cf98'), wet: new THREE.Color('#bba774'),
    grass: new THREE.Color('#7aa84e'), grass2: new THREE.Color('#93b65a'), jungle: new THREE.Color('#2f6a2c'), jungle2: new THREE.Color('#3f7d34'), hill: new THREE.Color('#6f8a52'), rock: new THREE.Color('#8b857a'), rock2: new THREE.Color('#a59e90'), road: new THREE.Color('#b89a6a') };
  for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) {
    const x = -HALF + (i + 0.5) * step, z = -HALF + (j + 0.5) * step;
    const h = heightAt(x, z), m = biomeMasks(x, z);
    if (h < 0.2) { // the sea: turquoise over the shallows, darkening with depth, a pale line where the waves break
      const d = Math.min(1, -h / 9); c.copy(COLS.reef).lerp(COLS.shallow, Math.min(1, d * 2.2)).lerp(COLS.deep, Math.max(0, d * 1.4 - 0.4));
      if (h > -0.6) c.lerp(new THREE.Color('#e8f4f0'), 0.35);
    } else {
      // land colours by what grows there and how high it is
      const n = fbm(x * 0.05, z * 0.05, 2) * 0.5 + 0.5;
      c.copy(COLS.grass).lerp(COLS.grass2, n * 0.6);
      const jungle = Math.min(1, m.forest * 1.4); c.lerp(n > 0.5 ? COLS.jungle : COLS.jungle2, jungle * 0.85);
      c.lerp(COLS.hill, Math.min(1, Math.max(0, (h - 25) / 30)) * 0.7);
      c.lerp(COLS.rock, Math.min(1, Math.max(0, (h - 60) / 35)));
      c.lerp(COLS.rock2, Math.min(1, Math.max(0, (h - 100) / 30)));
      if (beachMask(x, z) > 0.35 && h < 3) c.copy(h < 1 ? COLS.wet : COLS.sand);
      // forest canopy texture: little dark tree crowns
      if (jungle > 0.35 && h > 2 && hash(i, j) < jungle * 0.35) c.multiplyScalar(0.78);
      // hill shading, lit from the north-west
      const hx = heightAt(x + step, z) - heightAt(x - step, z), hz = heightAt(x, z + step) - heightAt(x, z - step);
      const sh = (-hx - hz) / (step * 2) * 0.55; c.multiplyScalar(1 + Math.max(-0.45, Math.min(0.4, sh)));
    }
    const k = (j * MAPN + i) * 4; img.data[k] = Math.min(255, c.r * 255); img.data[k + 1] = Math.min(255, c.g * 255); img.data[k + 2] = Math.min(255, c.b * 255); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const toPx = ([x, z]) => [(x + HALF) / (HALF * 2) * MAPN, (z + HALF) / (HALF * 2) * MAPN];
  // the river, then the roads
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = 'rgba(60,140,180,.9)'; g.lineWidth = MAPN / 260;
  if (RIVER.length > 2) { g.beginPath(); let on = false; for (let k = 0; k < RIVER.length - 1; k++) for (let t2 = 0; t2 < 1; t2 += 0.05) { const x = RIVER[k][0] + (RIVER[k + 1][0] - RIVER[k][0]) * t2, z = RIVER[k][1] + (RIVER[k + 1][1] - RIVER[k][1]) * t2; const land = !BATTLE && beachMask(x, z) < 0.9; const [px, pz] = toPx([x, z]); if (land) { on ? g.lineTo(px, pz) : g.moveTo(px, pz); on = true; } else on = false; } g.stroke(); }
  g.strokeStyle = 'rgba(70,50,30,.55)'; g.lineWidth = MAPN / 300 + 1.5;
  for (const r of ROADS) { g.beginPath(); r.forEach((p, i) => { const [px, pz] = toPx(p); i ? g.lineTo(px, pz) : g.moveTo(px, pz); }); g.stroke(); }
  g.strokeStyle = 'rgba(214,186,130,.9)'; g.lineWidth = MAPN / 300;
  for (const r of ROADS) { g.beginPath(); r.forEach((p, i) => { const [px, pz] = toPx(p); i ? g.lineTo(px, pz) : g.moveTo(px, pz); }); g.stroke(); }
}
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
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
  if (G.fog && G.fog.canvas) { g.imageSmoothingEnabled = true; g.drawImage(G.fog.canvas, -mx, -mz, MAPN, MAPN); }
  g.restore();
  // markers (rotate positions)
  const cs = Math.cos(p.yaw + Math.PI), sn = Math.sin(p.yaw + Math.PI);
  const dot = (x, z, fn) => { const dx = (x - p.pos.x) * scale, dz = (z - p.pos.z) * scale; let rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; const d = Math.hypot(rx, rz), max = N / 2 - 14; let edge = false; if (d > max) { rx *= max / d; rz *= max / d; edge = true; } fn(N / 2 + rx, N / 2 + rz, edge); };
  for (const m of G.mobs) if (!m.dead && m.pos.distanceTo(p.pos) < 70 && (!G.fogVis || m.team === G.myTeam || G.fogVis(m.pos.x, m.pos.z))) dot(m.pos.x, m.pos.z, (x, y, e) => { if (e) return; g.fillStyle = m.team != null ? (m.team === G.myTeam ? '#5aa0ff' : '#ff4030') : m.hostile || m.provoked ? '#ff8a40' : '#ffe070'; g.beginPath(); g.arc(x, y, m.isStruct ? 7 : 4, 0, 7); g.fill(); });
  g.font = 'bold 30px Cinzel, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k of markers(p.h)) dot(k.x, k.z, (x, y, e) => { g.fillStyle = '#ffd84a'; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText(k.t, x, y); g.fillText(k.t, x, y); });
  // allied heroes and players: always on the minimap (pinned to the edge when far away)
  if (G.allyHeroes) for (const ah of G.allyHeroes()) dot(ah.pos.x, ah.pos.z, (x, y, e) => { g.fillStyle = '#5aa0ff'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, e ? 6 : 8, 0, 7); g.fill(); g.stroke(); });
  if (G.fog) for (const pg of G.fog.pings) dot(pg.x, pg.z, (x, y) => { const a = (G.time - pg.t) % 1.2 / 1.2; g.strokeStyle = `rgba(255,60,40,${1 - a})`; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 8 + a * 26, 0, 7); g.stroke(); });
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
  const all = Object.keys(h.quests.active), act0 = all.filter(id => !(h.untracked || []).includes(id)).map(id => QUESTS.find(q => q.id === id)).filter(Boolean), mqs = act0.filter(q => q.main), act = h.mainOnly ? mqs : [...mqs, ...act0.filter(q => !q.main).slice(-(6 - mqs.length))];
  // on-screen controls: show only the main quest, or hide a side quest (click when the mouse is free; O also toggles)
  if (all.length) { const hd = el('div', 'qhead', `<button class="${h.mainOnly ? 'on' : ''}" title="Show only the main quest (T)">${h.mainOnly ? '☑' : '☐'} Main quest only</button>${(h.untracked || []).length ? '<button class="sa" title="Show every quest again">Show all</button>' : ''}`); hd.querySelector('button').onclick = () => { toggleMainOnly(); }; const sa = hd.querySelector('.sa'); if (sa) sa.onclick = () => { h.untracked = []; updateTracker(); }; box.appendChild(hd); } // the main quest always stays on top
  if (!act.length) { if (all.length) return;
    const any = QUESTS.find(q => Game.questState(h, q) === 'available');
    if (any) box.innerHTML = `<div class="q"><b>Find someone to help</b><div>Look for a <span style="color:#ffd84a;font-weight:800">!</span> over a villager's head</div></div>`;
    return;
  }
  for (const q of act) {
    const ready = Game.questComplete(h, q);
    const d = el('div', 'q' + (ready ? ' ready' : '') + (q.main ? ' main' : ''), `${q.main ? '<small class="mq">Main quest</small>' : ''}<b>${esc(q.title)}</b>` + q.obj.map((o, i) => { const pr = Game.objProgress(h, q, i), n = o.n || 1; return `<div class="${pr >= n ? 'ok' : ''}">${esc(o.label)}${n > 1 ? ` ${pr}/${n}` : pr >= n ? ' ✓' : ''}</div>`; }).join('') + (ready ? `<div class="ok">Return to ${esc((q.turnin && NPCS[q.turnin] ? NPCS[q.turnin].name : "the story"))}</div>` : ''));
    if (!q.main) { const x = el('span', 'qx', '✕'); x.title = 'Hide this quest from the screen (the Journal, J, can show it again)'; x.onclick = (e) => { e.stopPropagation(); h.untracked = (h.untracked || []).filter(i => i !== q.id); h.untracked.push(q.id); updateTracker(); }; d.appendChild(x); }
    box.appendChild(d);
  }
}
export function toggleMainOnly() { const h = G.player.h; h.mainOnly = !h.mainOnly; S.click(); updateTracker(); toast(h.mainOnly ? 'Quest tracker: main quest only' : 'Quest tracker: all quests', '📜'); }

// ---------- windows ----------
const winRoot = () => $('windows');
export function closeWin() {
  hideFtip(); { const st = document.getElementById('shoptip'); if (st) st.hidden = true; } { const bt = document.getElementById('booktip'); if (bt) bt.hidden = true; }
  if (G.hudEdit) { exitHudEdit(); return; }
  winRoot().innerHTML = ''; UI.open = null; G.uiOpen = false;
  if (G.onUiClosed) G.onUiClosed();
}
export function openWin(id, title, content, cls = '') {
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
const SET1 = ['w1', 'w2'], SET2 = ['w3', 'w4'];
const SLOT_HINT = { ranged: 'bow', food: 'food', drink: 'drink', arms: 'wrists', head: 'helm', neck: 'amulet', shoulders: 'shoulders', back: 'cloak', chest: 'chest', wrists: 'wrists', hands: 'hands', waist: 'waist', legs: 'legs', feet: 'boots', ring1: 'ring', ring2: 'ring', trinket: 'charm', w1: 'sword', w2: 'sword', w3: 'bow', w4: 'sword' };
export function openInventory() {
  const c = openWin('inv', 'Hero', '', 'big invwin');
  renderInventory(c);
}
let ftipT = 0, ftipEl = null, ftipXY = [0, 0];
function hoverTip(node, it, idx, eqSlot, c) {
  node.addEventListener('mouseenter', (e) => { ftipXY = [e.clientX, e.clientY]; clearTimeout(ftipT); ftipT = setTimeout(() => {
    if (!node.isConnected) return; if (!ftipEl) { ftipEl = el('div', 'tip big ftip'); document.body.appendChild(ftipEl); }
    showTip(ftipEl, it, idx, eqSlot, c, false); ftipEl.hidden = false; placeFtip(); }, 1000); });
  node.addEventListener('mousemove', (e) => { ftipXY = [e.clientX, e.clientY]; if (ftipEl && !ftipEl.hidden) placeFtip(); });
  node.addEventListener('mouseleave', hideFtip); node.addEventListener('pointerdown', hideFtip);
}
function placeFtip() { const r = ftipEl.getBoundingClientRect(); let x = ftipXY[0] + 18, y = ftipXY[1] + 14; if (x + r.width > innerWidth - 8) x = ftipXY[0] - r.width - 18; if (y + r.height > innerHeight - 8) y = innerHeight - r.height - 8; ftipEl.style.left = Math.max(8, x) + 'px'; ftipEl.style.top = Math.max(8, y) + 'px'; }
export function hideFtip() { clearTimeout(ftipT); if (ftipEl) ftipEl.hidden = true; }
function slotEl(h, k, tipEl, c) {
  const it = h.equip[k];
  const d = el('div', 'eq' + (it ? ' r' + (it.rarity || 0) : ' empty') + (k === h.active ? ' active' : ''));
  d.innerHTML = `<div class="ic">${it ? Icons.itemSvg(it) : Icons.itemSvg(ghost(SLOT_HINT[k]))}</div>${it && !it.kind ? `<span class="n">${it.n}</span>` : ''}<div class="lb">${SLOT_LABEL[k]}${k === h.active ? ' ✦' : ''}</div>`;
  if (!it && (k === 'food' || k === 'drink')) d.title = k === 'food' ? 'Drag food here: you eat one each time the buff runs out (long, small buffs)' : 'Drag a drink here: you drink one each time the buff runs out (shorter, stronger buffs)';
  if (!it && (k === 'w3' || k === 'w4')) d.title = 'Weapon Set 2 hangs on your back. Drag weapons here, then Q swaps sets.';
  d.onmouseenter = () => { if (it) showTip(tipEl, it, null, k, c); };
  if (it) hoverTip(d, it, null, k, c);
  d.onclick = () => { if (it) { S.click(); selInv = { eq: k }; showTip(tipEl, it, null, k, c, true); } };
  d.ondblclick = () => { if (it) { Game.unequip(h, k); renderInventory(c); } };
  d.dataset.eq = k; if (it) dragable(d, { eq: k }, it, c);
  if (k === 'w4' && Game.isTwoHanded(h.equip.w3)) { d.classList.add('twoh'); d.innerHTML = `<div class="ic" style="opacity:.35">${Icons.itemSvg(h.equip.w3)}</div><div class="lb">Both hands</div>`; d.title = h.equip.w3.name + ' needs both hands'; }
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
    const tgt = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); return t && (t.closest('[data-inv],[data-eq],[data-give],[data-sell]') || (t.id === 'portrait' ? t : null)); };
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
  if (src.i != null && t.dataset.sell != null && G.hooks.sellItem) { G.hooks.sellItem(src.i); return; }
  if (src.i != null && t.dataset.give != null && G.hooks.giveItem) { G.hooks.giveItem(src.i, +t.dataset.give); return; }
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
    if (toE) { if (!a.kind) { S.error(); return; } if (a.kind === 'weapon' && !['w1', 'w2', 'w3', 'w4'].includes(toE)) { toast("Weapons go in your hands.", '⚠', 'bad'); S.error(); return; } Game.equipFromInv(h, src.i, toE); }
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
  const bot = el('div', 'botrow wsets');
  const setBox = (keys, n, on) => { const g = el('div', 'wset' + (on ? ' on' : ''), `<div class="wsh">Set ${n}${on ? ' · in your hands' : ' · on your back'}</div>`); const r = el('div', 'wsr'); keys.forEach(k => r.appendChild(slotEl(h, k, tip, c))); g.appendChild(r); return g; };
  const n1 = h.setNo === 2 ? 2 : 1; bot.append(setBox(SET1, n1, true), el('div', 'wsq', '<b>Q</b><span>swap</span>'), setBox(SET2, n1 === 1 ? 2 : 1, false));
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
  if (G.newFx) { // EverQuest-style skills: what you have used, out of what your level allows
    const cap = Skills.skillCap(h), cur = Skills.skillOf(w && w.wt), has = Object.keys(Skills.SKILLS).filter(k => (h.skills && h.skills[k]) || k === cur || (k === 'dual' && Skills.DUAL_CLASSES.has(h.cls)) || (k === 'double' && Skills.DOUBLE_CLASSES.has(h.cls)) || (k === 'triple' && Skills.TRIPLE_CLASSES.has(h.cls)) || (k === 'casting' && (Skills.CASTER_CLASSES.has(h.cls) || Skills.HYBRID_CLASSES.has(h.cls))));
    st.insertAdjacentHTML('beforeend', `<div class="skl"><h5>Skills <small>max ${cap} at level ${h.level}</small></h5>${has.map(k => { const v = Skills.skill(h, k), kc = Skills.skillCapOf(h, k); if (kc <= 0) return `<div class="off" title="Learned at level ${k === 'double' ? 10 : 15}"><span>${Skills.SKILLS[k]}</span><i></i><b>🔒 ${k === 'double' ? 10 : 15}</b></div>`; return `<div class="${k === cur ? 'on' : ''}" title="${k === 'dual' ? 'How often the off hand swings too (with Dexterity)' : k === 'double' ? 'Chance of a second main-hand swing' : k === 'triple' ? 'After a double attack, a chance of a third swing' : k === 'casting' ? (Skills.CASTER_CLASSES.has(h.cls) ? 'Spells cast faster (up to 50% at skill 105) and magical staffs hit harder (+0.2% a point). Rises by casting spells.' : 'Spells cast faster (up to 25% at skill 105, hybrid) and magical staffs hit harder. Rises by casting spells.') : 'Each point: +0.2% damage with this kind of weapon'}"><span>${Skills.SKILLS[k]}</span><i><u style="width:${Math.round(v / kc * 100)}%"></u></i><b>${v}<small>/${kc}</small></b></div>`; }).join('')}</div>`);
  }
  const left = el('div', 'invleft'); left.append(doll, st);
  // bag
  const right = el('div', 'invright');
  right.innerHTML = `<div class="bagh"><h3>Backpack</h3><span class="goldc">${Icons.coin()} ${h.gold}</span></div>`;
  const grid = el('div', 'grid');
  h.inv.forEach((it, i) => {
    const cell = el('div', 'cell' + (it && it.kind ? ' r' + it.rarity : '') + (selInv && selInv.i === i ? ' sel' : ''), it ? `${Icons.itemSvg(it)}${!it.kind ? `<span class="n">${it.n}</span>` : ''}` : '');
    if (it) { hoverTip(cell, it, i, null, c); cell.onmouseenter = () => showTip(tip, it, i, null, c); cell.onclick = () => { S.click(); selInv = { i }; renderInventory(c); }; cell.ondblclick = () => { quickUse(i); renderInventory(c); }; cell.oncontextmenu = (e) => { e.preventDefault(); S.click(); hideFtip(); quickUse(i); renderInventory(c); }; /* right click or double click: equip it (swaps with what you wear) or use it */ dragable(cell, { i }, it, c); }
    cell.dataset.inv = i;
    grid.appendChild(cell);
  });
  right.appendChild(grid);
  // Kingdom Battles: sell what you don't use to help the town, or hand it to another player
  if (G.battleFx && G.hooks.tradeTargets) { const pl = G.hooks.tradeTargets(); right.appendChild(el('div', 'givebar', `<div class="gdrop sell" data-sell="1">💰 <b>Sell to the town</b><small>drop an item here: its gold goes to your town</small></div>${pl.length ? pl.map(p => `<div class="gdrop give" data-give="${p.id}" style="--tc:${p.col}">🎁 <b>${esc(p.name)}</b><small>drop to give</small></div>`).join('') : '<div class="gdrop none"><small>Online friends show here: drop an item on a name to give it to them</small></div>'}`)); }
  right.appendChild(tip);
  lay.append(left, right); c.appendChild(lay);
  if (selInv && selInv.i != null && h.inv[selInv.i]) showTip(tip, h.inv[selInv.i], selInv.i, null, c, true);
  else if (selInv && selInv.eq && h.equip[selInv.eq]) showTip(tip, h.equip[selInv.eq], null, selInv.eq, c, true);
}
function showTip(tipEl, it, idx, eqSlot, c, withButtons) {
  const hh = G.player.h;
  let html = `<div class="tiphead"><div class="tic r${it.rarity || 0}">${Icons.itemSvg(it)}</div><div>`;
  if (it.kind) {
    html += `<b style="color:${RARITY[it.rarity].col}">${esc(it.name)}</b><div class="dim">${RARITY[it.rarity].name} · ${it.kind === 'weapon' ? WEAPON_TYPES[it.wt].name : SLOT_LABEL[it.slot === 'ring' ? 'ring1' : it.slot]}</div></div></div>`;
    if (it.kind === 'weapon' && G.battleFx) { const W = WEAPON_TYPES[it.wt]; Game.ensureProc(it); const sp = Math.round((Math.pow(1 / (it.size || 1), 0.95) - 1) * 100); html += `<div class="big">${it.dmg} damage${sp ? ` <span style="font-size:13px;color:${sp > 0 ? '#7ee07e' : '#ff9a6a'}">${sp > 0 ? '+' : ''}${sp}% speed</span>` : ''}</div><div class="dim">${W.hands === 'two' ? 'Two-handed' : W.hands === 'dual' ? 'A pair: fills both hands' : W.hands === 'shield' ? 'With shield' : W.kind === 'bow' ? 'Ranged' : W.kind === 'gun' ? 'Firearm' : W.kind === 'staff' ? 'Staff' : 'One-handed'}</div>`; if (it.proc && PROCS[it.proc]) { const P = PROCS[it.proc]; html += `<div style="color:${P.col}"><b>Proc · ${P.name}:</b> ${P.desc}. ${Math.round(procChance(it.rarity, 0) * 100)}% chance on hit, +${PROC_DEX(it.rarity)}% per Dexterity (you: ${Math.round(procChance(it.rarity, (G.player.D && G.player.D.stats.dex) || 0) * 100)}%)</div>`; } }
    else if (it.kind === 'weapon') { const W = WEAPON_TYPES[it.wt]; html += `<div class="big">${it.dmg} damage</div><div class="dim">${W.hands === 'two' ? 'Two-handed' : W.hands === 'dual' ? 'Dual wield' : W.hands === 'shield' ? 'With shield' : W.kind === 'bow' ? 'Ranged' : 'Staff'} · ${G.battleFx ? 'F' : 'Right click'}: ${W.areaName}</div>${G.battleFx && RMB_SPECIAL[it.wt] && WSKILLS[RMB_SPECIAL[it.wt]] ? `<div class="dim" style="font-size:12px"><b>F · ${WSKILLS[RMB_SPECIAL[it.wt]].name}:</b> ${WSKILLS[RMB_SPECIAL[it.wt]].desc}</div>` : ''}`; const cs = comboSteps(it.wt); if (cs.length) html += `<div class="tipcombo"><div class="dim">Left click${COMBOS[it.wt] ? ' combo' : ''}</div>${cs.map((x, i) => `<div><b>${i + 1}. ${x.n}</b> <span class="dim">${x.d}% dmg</span>${x.tags.length ? ' · <span style="color:#ffcf70">' + x.tags.join(', ') + '</span>' : ''}</div>`).join('')}${COMBOS[it.wt] ? `<div style="color:#9fd0ff">${COMBOS[it.wt].trait}</div>` : ''}</div>`; }
    else if (it.armor) html += `<div class="big">${it.armor} armour</div>`;
    html += `<div style="color:var(--good)">${Object.entries(it.stats).map(([k, v]) => `+${v} ${STAT_NAMES[k]}`).join(' · ')}</div>`;
    if (it.kind === 'acc' && it.slot !== 'back') html += `<div style="color:var(--bad)">No longer worn. Sell it to a merchant.</div>`;
    else if (it.kind === 'weapon' && it.wt === 'bow' && !Game.canEquip(hh, it)) html += `<div style="color:#9fd0ff">Goes in Weapon Set 2 (Q swaps sets).</div>`;
    else if (!Game.canEquip(hh, it)) html += `<div style="color:var(--bad)">${CLASSES[hh.cls].name}s can't use this.</div>`;
    const cur = it.kind === 'weapon' ? hh.equip[hh.active] : hh.equip[it.slot === 'ring' ? 'ring1' : it.slot];
    if (cur && idx != null) html += `<div class="dim">Currently worn: ${esc(cur.name)} (${cur.dmg ? cur.dmg + ' damage' : (cur.armor || 0) + ' armour'})</div>`;
    html += `<div style="color:#ffd84a">Sells for ${Game.itemValue(it)} gold</div>`;
  } else { const I = ITEMS[it.id], FB = FOOD_BUFFS[it.id]; html += `<b>${esc(I.name)}</b> <span class="dim">×${it.n}</span></div></div><div>${esc(I.desc)}</div>${FB ? `<div style="color:${RARITY[FB.rarity || 0].col};font-weight:700">${RARITY[FB.rarity || 0].name} ${FB.drink ? 'drink' : 'food'}</div><div style="color:#ffcf70">${FB.drink ? 'Drink' : 'Food'} buff <b>${FB.name}</b>: ${FB.desc} for 24 min each. Put a stack in your ${FB.drink ? 'drink' : 'food'} slot (Hero page) and you eat one whenever the last wears off: a stack of 20 lasts 8 hours. Put a stack in the ${FB.drink ? 'Drink' : 'Food'} slot to keep it up automatically.</div>` : ''}<div style="color:#ffd84a">Sells for ${I.value} gold each</div>`; }
  tipEl.innerHTML = html;
  if (!withButtons) return;
  const row = el('div', 'row');
  const b = (t, fn, cls = 'btn') => { const x = el('button', cls, t); x.onclick = () => { S.click(); fn(); renderInventory(c); }; row.appendChild(x); };
  if (idx != null && it.kind === 'weapon') { b('Put in Set 2', () => Game.equipFromInv(hh, idx, Game.handsOf(it.wt) === 'off' ? 'w4' : 'w3')); if (it.wt === 'bow' && !Game.canEquip(hh, it)) {} else if (Game.handsOf(it.wt) === 'off') b('Equip in Off Hand', () => Game.equipFromInv(hh, idx, 'w2')); else if (Game.handsOf(it.wt) === 'two') b('Equip (both hands)', () => Game.equipFromInv(hh, idx, 'w1')); else { b('Equip in Main Hand', () => Game.equipFromInv(hh, idx, 'w1')); if (hh.equip.w1 && !Game.isTwoHanded(hh.equip.w1)) b('Equip in Off Hand', () => Game.equipFromInv(hh, idx, 'w2')); } }
  else if (idx != null && !it.kind && FOOD_BUFFS[it.id]) { b(FOOD_BUFFS[it.id].drink ? 'Put in Drink slot' : 'Put in Food slot', () => Game.equipConsumable(hh, idx)); }
  else if (idx != null && it.kind) b('Equip', () => Game.equipFromInv(hh, idx));
  else if (idx != null && ITEMS[it.id]?.use) b('Use', () => quickUse(idx));
  if (eqSlot) b('Take off', () => Game.unequip(hh, eqSlot));
  if (idx != null && G.battleFx && it.kind && G.hooks.sellItem) { b(`Sell to the town (+${Game.itemValue(it)} gold)`, () => G.hooks.sellItem(idx), 'btn gold'); if (G.hooks.tradeTargets) for (const p of G.hooks.tradeTargets()) b(`Give to ${p.name}`, () => G.hooks.giveItem(idx, p.id)); }
  if (idx != null) b('Destroy', () => { hh.inv[idx] = null; selInv = null; G.hooks.invChanged && G.hooks.invChanged(); }, 'btn red');
  tipEl.appendChild(row);
}
export function portraitRect() { if (UI.open !== 'inv') return null; const e = document.getElementById('portrait'); return e ? e.getBoundingClientRect() : null; }
function quickUse(i) { const h = G.player.h, it = h.inv[i]; if (!it) return; if (it.kind) Game.equipFromInv(h, i, it.kind === 'weapon' && it.wt === 'bow' && !Game.canEquip(h, it) ? 'w3' : undefined); else if (ITEMS[it.id]?.use) Game.useItem(h, it.id, G.player); }
// EverQuest-style skills window (U): every skill you have, highest first, what it does and what it gives you now
export function openSkillsWin() {
  const c = openWin('skillwin', 'Skills', '', 'skillwin'), h = G.player.h, cap = Skills.skillCap(h), cur = Skills.skillOf(G.player.weapon && G.player.weapon.wt);
  const ids = Object.keys(Skills.SKILLS).filter(k => Skills.skillCapOf(h, k) > 0 || k === 'double' && Skills.DOUBLE_CLASSES.has(h.cls) || k === 'triple' && Skills.TRIPLE_CLASSES.has(h.cls) || k === 'dual' && Skills.DUAL_CLASSES.has(h.cls))
    .filter(k => Skills.WEAPON_SKILLS.includes(k) ? (Skills.skill(h, k) > 1 || k === cur) : true).sort((a, b) => Skills.skill(h, b) - Skills.skill(h, a));
  c.innerHTML = `<p class="dim" style="margin:0 0 8px">Skills rise as you use them, up to <b>${cap}</b> at level ${h.level}. Weapon skills make that kind of weapon hit harder and swing faster.</p>` + ids.map(k => { const v = Skills.skill(h, k), kc = Skills.skillCapOf(h, k);
    return `<div class="swrow${k === cur ? ' on' : ''}${kc <= 0 ? ' off' : ''}"><div class="swn"><b>${Skills.SKILLS[k]}</b><small>${Skills.SKILL_INFO[k] || ''}</small></div><div class="swb"><i><u style="width:${kc > 0 ? Math.round(v / kc * 100) : 0}%"></u></i><span>${kc > 0 ? `${v} / ${kc}` : '🔒'}</span></div><div class="swe">${Skills.effectOf(h, k)}</div></div>`; }).join('');
}
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
const STATION_ICON = { workbench: '🪚', forge: '⚒', loom: '🧵', tanning: '🦬', campfire: '🔥', alchemy: '⚗' };
const STATION_LINE = { workbench: 'Saw timber, carve bows and staves, shape tools.', forge: 'Smelt ore into ingots and hammer out weapons and mail.', loom: 'Spin cotton and weave cloth for robes and bandages.', tanning: 'Cure hides into leather for armour and straps.', campfire: 'Cook meat and fish into food that keeps you going.', alchemy: 'Brew potions from herbs and roots.' };
export function openCrafting(station) {
  craftState = { station, cat: 'All', sel: null };
  openWin('craft', station ? STATIONS[station] : 'Recipes', '', 'big craftwin');
  renderCraft();
}
function renderCraft() {
  const c = winRoot().querySelector('.content'); if (!c) return;
  const h = G.player.h, st = craftState;
  const all = Game.recipesFor(h).filter(r => !st.station || r.station === st.station);
  const cats = ['All', ...new Set(all.map(r => r.cat))];
  c.innerHTML = '';
  c.appendChild(el('div', 'crhead', `<div class="cri">${STATION_ICON[st.station] || '📜'}</div><div><b>${st.station ? STATIONS[st.station] : 'Every recipe you know'}</b><span>${st.station ? STATION_LINE[st.station] || '' : 'Walk up to a crafting station and press E to craft there.'}</span></div>`));
  if (cats.length > 2) { const ce = el('div', 'crcats'); for (const k of cats) { const b = el('button', st.cat === k ? 'on' : '', k); b.onclick = () => { S.click(); st.cat = k; st.sel = null; renderCraft(); }; ce.appendChild(b); } c.appendChild(ce); }
  const lay = el('div', 'crlay'); c.appendChild(lay);
  const rs = all.filter(r => st.cat === 'All' || r.cat === st.cat).sort((a, b) => (Game.canCraft(h, b) - Game.canCraft(h, a)) || a.lvl - b.lvl);
  if (!st.sel || !rs.includes(st.sel)) st.sel = rs[0] || null;
  const grid = el('div', 'crgrid');
  for (const r of rs) {
    const can = Game.canCraft(h, r), low = h.level < r.lvl;
    const t = el('button', 'crtile' + (st.sel === r ? ' sel' : '') + (can ? ' can' : low ? ' low' : ''), `<div class="ti">${Icons.itemSvg(Game.recipeItem(r))}</div><b>${esc(Game.recipeOutputName(r))}</b><small>${low ? '🔒 Level ' + r.lvl : can ? 'Ready to craft' : 'Missing materials'}</small>`);
    t.onclick = () => { S.click(); st.sel = r; renderCraft(); }; grid.appendChild(t);
  }
  if (!rs.length) grid.appendChild(el('p', 'dim', 'Nothing you can make here yet.'));
  lay.appendChild(grid);
  const det = el('div', 'crdet');
  if (st.sel) {
    const r = st.sel, it = Game.recipeItem(r), can = Game.canCraft(h, r);
    let statHtml = ''; if (it && it.kind) { const d = el('div'); showTip(d, it, null, null, null, false); statHtml = d.innerHTML; }
    else if (it && ITEMS[it.id]) statHtml = `<div class="dim">${esc(ITEMS[it.id].desc || '')}</div>`;
    const mats = Object.entries(r.need).map(([id, n]) => { const have = Game.count(h, id), ok = have >= n; return `<div class="crmat${ok ? ' ok' : ''}"><span class="mi">${Icons.itemSvg({ id })}</span><b>${esc(ITEMS[id] ? ITEMS[id].name : id)}</b><em>${have}/${n}</em></div>`; }).join('');
    det.innerHTML = `<div class="crbig"><div class="ti">${Icons.itemSvg(it)}</div><div><b>${esc(Game.recipeOutputName(r))}</b>${r.n > 1 ? ` <span class="dim">×${r.n}</span>` : ''}<div class="dim">${STATIONS[r.station]} · level ${r.lvl}</div></div></div>
      <div class="crstats">${statHtml}</div><h4>Materials</h4><div class="crmats">${mats}</div>${r.weapon || r.armor ? '<div class="dim crnote">Crafted gear sometimes comes out Uncommon, or better.</div>' : ''}`;
    const row = el('div', 'crbtns'), here = !!st.station;
    const mk = (label, n, cls) => { const b = el('button', 'btn ' + cls, label); b.disabled = !can || !here; b.onclick = () => { let k = 0; while (k < n && Game.canCraft(h, r)) { Game.craft(h, r); k++; } if (k) toast(`Made ${esc(Game.recipeOutputName(r))}${k > 1 ? ' ×' + k : ''}`, Icons.itemSvg(it), 'gold'); renderCraft(); }; row.appendChild(b); };
    mk('Craft', 1, 'gold big'); if (!(r.weapon || r.armor || r.tool)) { mk('×5', 5, ''); mk('All', 99, ''); }
    det.appendChild(row);
    if (!here) det.appendChild(el('div', 'crwarn', `Go to a ${STATIONS[r.station]} to make this.`));
    else if (h.level < r.lvl) det.appendChild(el('div', 'crwarn', `You need to be level ${r.lvl}.`));
  }
  lay.appendChild(det);
}

// --- quest log ---
let qSel = null;
export function openQuestLog() {
  const c = openWin('quests', 'Journal', '', 'big');
  const h = G.player.h;
  const act = Object.keys(h.quests.active).map(id => QUESTS.find(q => q.id === id)).filter(Boolean).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0)); // the main quest first, then side quests
  const lay = el('div', 'qlog'), list = el('div', 'qlist'), det = el('div', 'tip');
  if (!act.length) list.innerHTML = '<p style="color:var(--dim)">No active quests. Look for villagers with a gold ! over their heads.</p>';
  if (!qSel || !act.includes(qSel)) qSel = act[0];
  const isT = (q) => !(h.untracked || []).includes(q.id);
  const setT = (q, on) => { h.untracked = (h.untracked || []).filter(x => x !== q.id); if (!on) h.untracked.push(q.id); updateTracker(); openQuestLog(); };
  if (act.length) { const bar = el('div', 'qtrackall'); const a = el('button', 'btn', 'Show all'); a.onclick = () => { h.untracked = []; updateTracker(); openQuestLog(); }; const n = el('button', 'btn', 'Hide all'); n.onclick = () => { h.untracked = act.map(q => q.id); updateTracker(); openQuestLog(); }; bar.append(el('span', 'dim', 'On screen:'), a, n); list.appendChild(bar); }
  let lastSec = null;
  for (const q of act) { const sec = q.main ? 'Main quest' : 'Side quests'; if (sec !== lastSec) { list.appendChild(el('div', 'qsec' + (q.main ? ' main' : ''), sec)); lastSec = sec; } const row = el('div', 'qrow'); const tg = el('label', 'qtrack' + (isT(q) ? ' on' : ''), `<input type="checkbox" ${isT(q) ? 'checked' : ''}><span>${isT(q) ? 'Shown' : 'Hidden'}</span>`); tg.title = 'Show this quest on screen'; tg.querySelector('input').onchange = (e) => { S.click(); setT(q, e.target.checked); }; const b = el('button', q === qSel ? 'on' : '', `<b>${esc(q.title)}</b>${Game.questComplete(h, q) ? ' <span style="color:var(--good)">✓</span>' : ''}<div style="font-size:12px;color:var(--dim)">Level ${q.lvl} · ${(q.giver && NPCS[q.giver] ? NPCS[q.giver].name : "Main quest")}</div>`); b.onclick = () => { qSel = q; openQuestLog(); }; row.append(b, tg); list.appendChild(row); }
  list.appendChild(el('div', '', `<p style="color:var(--dim);font-size:13px;margin-top:10px">Completed: ${h.quests.done.length} / ${QUESTS.length}</p>`));
  if (qSel) {
    const q = qSel;
    det.innerHTML = `<h3>${esc(q.title)}</h3><p>${esc(q.text)}</p>` + q.obj.map((o, i) => { const pr = Game.objProgress(h, q, i), n = o.n || 1; return `<div class="obj" style="${pr >= n ? 'color:var(--good)' : ''}">${pr >= n ? '✓' : '•'} ${esc(o.label)} ${n > 1 ? `(${pr}/${n})` : ''}</div>`; }).join('') + `<p style="color:var(--dim)">Turn in to: <b>${esc((q.turnin && NPCS[q.turnin] ? NPCS[q.turnin].name : "the story"))}</b></p><div class="reward">Rewards: ${q.xp} XP · ${q.gold || 0} gold${q.gear ? ' · a piece of gear' : ''}${q.items ? ' · ' + Object.entries(q.items).map(([k, n]) => n + ' ' + ITEMS[k].name).join(', ') : ''}</div>`;
    const ab = el('button', 'btn red', 'Abandon quest'); ab.style.marginTop = '10px'; ab.onclick = () => { delete h.quests.active[q.id]; qSel = null; G.hooks.questsChanged(); openQuestLog(); }; det.appendChild(ab);
  }
  { const lb = el('button', 'lorebtn', '📖 <b>The Island of Kelda</b><small>How the goblins took the island</small>'); lb.onclick = () => { S.click(); det.innerHTML = `<h3>${LORE.title}</h3>` + LORE.text.map(t => `<p>${esc(t)}</p>`).join(''); }; list.insertBefore(lb, list.firstChild); }
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
  const c = openWin('map', G.battleMapDraw ? 'Map of the Realm' : 'Map of Kelda', '', 'mapfull');
  const h = G.player.h, p = G.player, areas = questAreas(h);
  const wrap = el('div', 'maplay'); c.appendChild(wrap);
  const holder = el('div', 'mapcv'); wrap.appendChild(holder);
  const side = el('div', 'mapside'); wrap.appendChild(side);
  const draw = () => {
    const N = Math.floor(Math.min(holder.clientWidth, holder.clientHeight)) || 600;
    holder.innerHTML = ''; const cv = el('canvas'); cv.width = cv.height = N * 2; cv.style.width = cv.style.height = N + 'px'; holder.appendChild(cv);
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = true;
    // zoom and pan (mouse wheel to zoom towards the cursor, drag to move)
    const Z = mapView.z, W2 = N * 2; mapView.cx = Math.min(1 - 0.5 / Z, Math.max(0.5 / Z, mapView.cx)); mapView.cy = Math.min(1 - 0.5 / Z, Math.max(0.5 / Z, mapView.cy));
    g.fillStyle = '#123a63'; g.fillRect(0, 0, W2, W2); g.setTransform(Z, 0, 0, Z, W2 / 2 - mapView.cx * W2 * Z, W2 / 2 - mapView.cy * W2 * Z);
    g.drawImage(mapCanvas, 0, 0, W2, W2);
    if (G.fog && G.fog.canvas) g.drawImage(G.fog.canvas, 0, 0, W2, W2);
    const s = N * 2 / (HALF * 2), P = (x, z) => [(x + HALF) * s, (z + HALF) * s], k = N / 380 / Math.sqrt(Z);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lbl = (t, x, z, size = 30, col = '#ffe2a0') => { const [px, pz] = P(x, z); size *= k; g.font = `700 ${size}px Cinzel, serif`; g.lineWidth = size / 5; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(t, px, pz); g.fillStyle = col; g.fillText(t, px, pz); };
    const icon = (x, z, ch, col, size = 22) => { const [px, pz] = P(x, z); size *= k; g.beginPath(); g.arc(px, pz, size * 0.62, 0, 7); g.fillStyle = 'rgba(0,0,0,.65)'; g.fill(); g.lineWidth = 2 * k; g.strokeStyle = col; g.stroke(); g.font = `900 ${size * 0.8}px sans-serif`; g.fillStyle = col; g.fillText(ch, px, pz + 1); };
    if (G.battleMapDraw) G.battleMapDraw(g, P, k, lbl, icon, s); else {
    // the island: region names over what you have explored, and the places you have found or been told about
    const ZP = { coast: [0, 455], meadow: [0, 240], wood: [-350, 110], highlands: [MOUNT.x, MOUNT.z + 40], north: [-150, -300] };
    for (const zn of ZONES) { const q = ZP[zn.id]; if (!q || !isExplored(q[0], q[1])) continue; lbl(zn.name, q[0], q[1], 24, zn.id === 'highlands' ? '#f0f0e0' : '#ffe2a0'); lbl(`Levels ${zn.lv}`, q[0], q[1] + 18, 12, '#e8dcc0'); }
    if (isExplored(360, 60)) lbl('Tanglewood Jungle', 360, 60, 24);
    const H0 = G.player.h;
    for (const q of pois()) { if (!known(H0, q.id) && !isExplored(q.x, q.z)) continue; icon(q.x, q.z, q.icon, q.col, q.big ? 30 : q.camp ? 16 : 20); if (!q.camp || Z > 1.6) lbl(q.name, q.x, q.z - (q.big ? 26 : 18), q.big ? 20 : q.camp ? 11 : 15, q.col === '#ff6060' || q.col === '#ff8a7a' ? '#ffb0a0' : '#fff'); } }
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
    side.insertAdjacentHTML('beforeend', `<h3>Legend</h3><div class="legend"><div><b style="color:#ffd84a">!</b> Quest to pick up</div><div><b style="color:#ffd84a">?</b> Quest to hand in</div><div><b>◆</b> Quest objective (circle = area)</div><div><b>⌂</b> Town or outpost</div><div><b style="color:#9cdc5a">⛺</b> Goblin camp (levels)</div><div><b style="color:#ff8a7a">⚔</b> Goblin fort · <b style="color:#ff6060">☠</b> Boss</div><div><b>➤</b> You</div></div><p class="dim">Click a quest to highlight it. M or Esc closes.</p>`);
  };
  holder.onwheel = (e) => { e.preventDefault(); const r = holder.getBoundingClientRect(), N = Math.min(r.width, r.height), fx = (e.clientX - r.left) / N, fy = (e.clientY - r.top) / N;
    const wx = mapView.cx + (fx - 0.5) / mapView.z, wy = mapView.cy + (fy - 0.5) / mapView.z; mapView.z = Math.max(1, Math.min(6, mapView.z * (e.deltaY < 0 ? 1.25 : 0.8)));
    mapView.cx = wx - (fx - 0.5) / mapView.z; mapView.cy = wy - (fy - 0.5) / mapView.z; draw(); };
  holder.onmousedown = (e) => { const r = holder.getBoundingClientRect(), N = Math.min(r.width, r.height), x0 = e.clientX, y0 = e.clientY, c0 = [mapView.cx, mapView.cy];
    const mv = (ev) => { mapView.cx = c0[0] - (ev.clientX - x0) / N / mapView.z; mapView.cy = c0[1] - (ev.clientY - y0) / N / mapView.z; draw(); };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); };
  if (!G.battleMapDraw && mapView.z === 1) { mapView.cx = (p.pos.x + HALF) / (HALF * 2); mapView.cy = (p.pos.z + HALF) / (HALF * 2); }
  holder.title = 'Mouse wheel to zoom, drag to move';
  renderSide(); requestAnimationFrame(draw);
  // live map in Kingdom Battles: redraw while it is open
  if (G.fog) { const iv = setInterval(() => { if (UI.open !== 'map') { clearInterval(iv); return; } draw(); renderSide(); }, 500); }
}

// --- talking to ordinary villagers: a short conversation; each one only knows a thing or two ---
const GREET = ['Afternoon, stranger.', 'Oh! You gave me a start.', 'Well met. Not many new faces these days.', 'Mind the goblins out there.', 'Can I help you with something?'];
export function openChatter(v) {
  const c = openWin('chatter', esc(v.vname), '', 'chatwin'); const h = G.player.h;
  const say = (t) => { const p = c.querySelector('.cline'); p.innerHTML = `“${esc(t)}”`; p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); };
  const home = Math.hypot(v.home.x - VILLAGE.x, v.home.z - VILLAGE.z) < 90; // Seabreak folk call you the newcomer, or the sailor
  const greet = home ? HOME_GREET : GREET;
  c.innerHTML = `<div class="cline">“${greet[Math.floor(Math.random() * greet.length)]}”</div><div class="copts"></div>`;
  const opts = c.querySelector('.copts');
  const opt = (label, fn) => { const b = el('button', 'btn copt', label); b.onclick = () => { S.click(); fn(); }; opts.appendChild(b); };
  // the first time, some of them ask where you came from: you never really answer
  if (!v.askedHome && Math.random() < 0.6) { v.askedHome = true; say(home ? 'So where did you sail in from, newcomer?' : 'You are not from Saltmere. Where did you come from, sailor?');
    const reacts = ['Hm. Fair enough.', 'Keep your secrets, then. Everyone on Kelda has a few.', 'Ha! That is what everybody says.', 'Right. Not my business.'];
    for (const ans of ['Here and there.', 'Somewhere that doesn\'t need me any more.', 'Does it matter?']) opt(`“${ans}”`, () => { opts.innerHTML = ''; say(reacts[Math.floor(Math.random() * reacts.length)]); addMain(); });
    return; }
  const addMain = () => {
  opt('Heard any news around here?', () => { const r = villagerNews(h, v); say(r.text); if (r.found) { toast(`Map updated: ${r.found.name}`, '🗺', 'gold'); G.hooks.mapLearned && G.hooks.mapLearned(r.found, v); } });
  opt('What\'s it like living here?', () => say(smallTalk()));
  opt('Goodbye', () => closeWin());
  };
  addMain();
}
const HOME_GREET = ['Ah, the newcomer.', 'Morning, sailor.', 'The sailor! Everyone\'s talking about that boat of yours.', 'Oh, it\'s the newcomer. Mind the goblins.', 'Welcome to Seabreak, sailor. What there is of it.'];
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
      const MAREN = 'Your boat? I know someone who can help. But I must ask something of you first. Please, help our people in need, and help our village grow strong enough to defend ourselves from the goblin attacks. Do that, and I will lead you to someone who knows where to find repairs and supplies for your boat.';
      c.appendChild(el('div', 'text', esc(npc.id === 'maren' && h.quests.active.mq_boat ? MAREN : npc.def.hello)));
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
      c.appendChild(el('div', 'reward', `Rewards: ${rewardText(q)}${q.give && q.give.tool ? ' · you receive a ' + TOOLS[q.give.tool[0]].name : ''}`));
      const opts = el('div', 'opts'); opts.style.marginTop = '12px';
      const a = el('button', '', '✔ Accept'); a.style.color = 'var(--good)'; a.onclick = () => { Game.acceptQuest(h, q); toast('Quest accepted: ' + q.title, '📜', 'gold'); render(null); };
      const d = el('button', '', 'Not now.'); d.onclick = () => { S.click(); render(null); };
      opts.append(a, d); c.appendChild(opts);
    } else if (view.turnin) {
      const q = view.turnin;
      c.appendChild(el('div', 'text', `<h3>${esc(q.title)}</h3>${esc(q.done)}`));
      c.appendChild(el('div', 'reward', `Rewards: ${rewardText(q)}`));
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

// what a quest pays, in words
function rewardText(q) { const r = [`${q.xp} XP`, `${q.gold || 0} gold`]; if (q.gear) r.push((q.gearRarity || 1) >= 3 ? 'a fine weapon or armour piece' : 'a weapon or armour piece for you'); for (const k in q.items || {}) if (ITEMS[k]) r.push(`${q.items[k]}× ${ITEMS[k].name}`); return r.join(' · '); }
// --- merchant ---
const TOOL_SHOP = [[1, 3, 1], [2, 30, 4], [3, 110, 9], [4, 320, 14]]; // tier, price, level
export function openMerchant(npc) {
  const c = openWin('merchant', esc(npc.name), '', 'big shopwin2');
  let tab = 'gear', last = '';
  const tipEl = () => { let t = document.getElementById('shoptip'); if (!t) { t = el('div', 'tip big ftip'); t.id = 'shoptip'; document.body.appendChild(t); } return t; };
  const showAt = (html, e) => { const t = tipEl(); t.innerHTML = html; t.hidden = false; const r = t.getBoundingClientRect(); let x = e.clientX + 18, y = e.clientY + 12; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 18; if (y + r.height > innerHeight - 8) y = innerHeight - r.height - 8; t.style.left = Math.max(8, x) + 'px'; t.style.top = Math.max(8, y) + 'px'; };
  const hide = () => { const t = document.getElementById('shoptip'); if (t) t.hidden = true; };
  const itemTip = (it, extra) => { const d = el('div'); showTip(d, it, null, null, null, false); return d.innerHTML + (extra || ''); };
  const slot = (icon, cls, price, tipHtml, onClick, lock) => {
    const d = el('div', 'sslot ' + cls + (lock ? ' lock' : ''), `<div class="si">${icon}</div>${price != null ? `<span class="sp">${Icons.coin()}${price}</span>` : ''}${lock ? `<span class="sl">${lock}</span>` : ''}`);
    d.onmousemove = (e) => showAt(tipHtml(), e); d.onmouseleave = hide;
    d.onclick = (e) => { if (lock) { S.error(); return; } onClick(e); hide(); S.coins(); render(); };
    return d;
  };
  const render = () => {
    const h = G.player.h; c.innerHTML = '';
    c.appendChild(el('div', 'shophead', `<div><b>${esc(npc.name)}</b><span>${esc(npc.def.title || 'Merchant')}</span></div><div class="shopgold">${Icons.coin()} <b>${h.gold}</b></div>`));
    const lay = el('div', 'shopcols'); c.appendChild(lay);
    // ---- buy ----
    const buy = el('div', 'shoppane'); buy.appendChild(el('h3', '', 'For sale'));
    const tabs = el('div', 'shoptabs2'); for (const [k, t] of [['gear', 'Arms & Armour'], ['supplies', 'Supplies'], ['tools', 'Tools']]) { const b = el('button', tab === k ? 'on' : '', t); b.onclick = () => { S.click(); tab = k; render(); }; tabs.appendChild(b); } buy.appendChild(tabs);
    const grid = el('div', 'sgrid');
    if (tab === 'gear') for (const it of Game.gearStock(h)) { const pr = Game.itemValue(it) * 4, lock = '';
      grid.appendChild(slot(Icons.itemSvg(it), 'r' + it.rarity + (h.gold < pr ? ' poor' : ''), pr, () => itemTip(it, `<div class="tbuy">${lock ? `Requires level ${it.lvl}` : h.gold < pr ? `Costs ${pr} gold: you have ${h.gold}` : `Click to buy for ${pr} gold`}</div>`), () => { if (h.gold < pr) { S.error(); return; } h.gold -= pr; Game.addGear(h, Game.copyGear(it)); last = `Bought ${esc(it.name)}`; }, lock)); }
    else if (tab === 'supplies') for (const id of Game.merchantStock()) { const pr = Game.buyPrice(id), I = ITEMS[id];
      grid.appendChild(slot(Icons.itemSvg({ id }), h.gold < pr ? 'poor' : '', pr, () => `<b>${esc(I.name)}</b><div>${esc(I.desc || '')}</div><div class="tbuy">${h.gold < pr ? `Costs ${pr} gold` : `Click to buy one for ${pr} gold · Shift+click buys 5`}</div>`, (e) => { const n = e.shiftKey ? 5 : 1; const k = Math.min(n, Math.floor(h.gold / pr)); if (!k) { S.error(); return; } h.gold -= pr * k; Game.addItem(h, id, k); last = `Bought ${esc(I.name)}${k > 1 ? ' ×' + k : ''}`; })); }
    else for (const t of Object.keys(TOOLS)) { const have = h.tools[t] || 0, next = TOOL_SHOP.find(x => x[0] > have);
      if (!next) { grid.appendChild(slot(Icons.toolSvg(t, have), 'owned', null, () => `<b>${TOOL_TIER_NAMES[have]} ${TOOLS[t].name}</b><div>${TOOLS[t].desc}</div><div class="tbuy">You have the best one.</div>`, () => {}, 'Owned')); continue; }
      const [tier, price, lvl] = next, lock = h.level < lvl ? `Lv ${lvl}` : '';
      grid.appendChild(slot(Icons.toolSvg(t, tier), h.gold < price ? 'poor' : '', price, () => `<b>${TOOL_TIER_NAMES[tier]} ${TOOLS[t].name}</b><div>${TOOLS[t].desc}</div>${have ? `<div class="dim">Replaces your ${TOOL_TIER_NAMES[have]} one: faster, and works on tougher ${t === 'pickaxe' ? 'ore' : t === 'hatchet' ? 'trees' : 'beasts'}.</div>` : ''}<div class="tbuy">${lock ? `Requires level ${lvl}` : `Click to buy for ${price} gold`}</div>`, () => { if (h.gold < price) { S.error(); return; } h.gold -= price; h.tools[t] = tier; last = `Bought ${TOOL_TIER_NAMES[tier]} ${TOOLS[t].name}`; }, lock)); }
    buy.appendChild(grid); lay.appendChild(buy);
    // ---- sell ----
    const sell = el('div', 'shoppane'); sell.appendChild(el('h3', '', 'Your bag'));
    sell.appendChild(el('div', 'shopnote', 'Click an item to sell it · Shift+click sells the whole stack'));
    const bag = el('div', 'sgrid bag');
    h.inv.forEach((it, i) => {
      if (!it) { bag.appendChild(el('div', 'sslot empty')); return; }
      const v = Game.itemValue(it), stack = !it.kind && it.n > 1;
      const d = slot(Icons.itemSvg(it), it.kind ? 'r' + it.rarity : '', v, () => (it.kind ? itemTip(it) : `<b>${esc(Game.itemName(it))}</b>${stack ? ` ×${it.n}` : ''}<div>${esc((ITEMS[it.id] || {}).desc || '')}</div>`) + `<div class="tbuy">Sells for ${v} gold${stack ? ` each · ${v * it.n} for all` : ''}</div>`,
        (e) => { const n = !it.kind && e.shiftKey ? it.n : 1; h.gold += v * n; if (it.kind || it.n <= n) h.inv[i] = null; else it.n -= n; last = `Sold ${esc(Game.itemName(it))}${n > 1 ? ' ×' + n : ''} for ${v * n} gold`; G.hooks.invChanged && G.hooks.invChanged(); });
      if (stack) d.insertAdjacentHTML('beforeend', `<span class="sn">${it.n}</span>`);
      bag.appendChild(d);
    });
    sell.appendChild(bag); lay.appendChild(sell);
    c.appendChild(el('div', 'shopfoot', last ? `✓ ${last}` : 'Hover anything to see what it is and what it costs.'));
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
  b(document.fullscreenElement ? 'Exit Full Screen' : 'Full Screen', () => { if (document.fullscreenElement) exitFull(); else goFull(); });
  if (BATTLE) { b('Leave battle (main screen)', () => confirmBox('Leave this battle and go back to the main screen?', () => { location.href = location.pathname; }, 'Stay', 'Leave'), 'btn red'); b('Exit game', () => window.KR2exit && window.KR2exit(), 'btn red'); }
  else b('Save & Quit to Title', () => G.hooks.saveQuit && G.hooks.saveQuit(), 'btn red');
  if (!BATTLE) b('Exit game', () => window.KR2exit && window.KR2exit(), 'btn red');
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
  fs.onclick = () => { S.click(); if (document.fullscreenElement) exitFull(); else goFull(); setTimeout(() => { fs.textContent = document.fullscreenElement ? '⛶ Exit full screen' : '⛶ Go full screen'; }, 300); };
  row('Full screen', fs);
  row('Auto-loot<small>Whatever a beast or goblin drops goes straight into your bag when it dies. Turn off to loot bodies yourself with E.</small>', check('autoLoot'));
  row('Auto-equip gear<small>Campaign: a better item of the exact same kind replaces what you wear (same weapon type, same armour type in the same slot). Kingdom Battles: better armour goes on straight away.</small>', check('autoEquip'));
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
  grp('Fighting', [['Left click', 'Attack. Every weapon has its own combo: swords 3 swings, maces a swing then a crushing blow, daggers 5 fast stabs, spears 4 thrusts. Bigger weapons swing slower but harder.'], ...(G.battleFx ? [['F', 'Weapon special attack (Wheel Strike, Skull Crack, Twin Fury, Meteor...), on a cooldown'], ['Right click (hold)', 'Block. Raise it just before a hit for a perfect block: no damage at all.'], ['Q', 'Swap weapon sets'], ['Double-tap W A S D', 'Roll that way'], ['Tab (hold)', 'Every player in the game'], ['J', 'Town jobs'], ['B', 'War Report and orders'], ['K', 'Ability book']] : [['Right click', 'Weapon special attack (Wheel Strike, Skull Crack, Twin Fury, Meteor...), on a cooldown'], ['F (hold)', 'Block. Shields stop the most damage.']]), ['1 2 3', 'Class abilities (choose which three in Class Talents)'], ['4 5 6', 'Potions and food'], ['R', 'Use your best healing item'], ['Q', 'Switch to the bow in your Ranged slot and back']]);
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
