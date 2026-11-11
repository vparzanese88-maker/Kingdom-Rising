// Kingdom Arena champion select, after Paladins and Smite: a big portrait grid with role tabs, your team down the left
// and the enemy down the right (every player's and computer player's pick, live), a preview of the hero under the cursor
// with every ability, a pick timer and a Lock In button. A class a team mate (a person) has picked is greyed out with their
// name on it and nobody else on that team can take it; the enemy may pick it too. A computer team mate with the class
// you want simply switches to another one. Used by the online lobby (arenanet.js) and the K picker in the match (arena.js).
import { CLASSES, ABILITIES } from './data.js';
import { classPortrait } from './portraits.js';
import * as Icons from './icons.js';
import { KIT } from './kitinfo.js';
import { arenaLore } from './classlore.js';
import { kitOf, rmbOf, ultOf, roleOf } from './arena.js';
import { S } from './audio.js';

export const SUPPORT = new Set(['cleric', 'druid', 'shaman', 'paladin', 'bard', 'enchanter', 'priest']); // (arena.js SUPPORT_CLS_K: a bit of everything, including help for the team)
export const ROLE_COL = { Tank: '#7ab8ff', Healer: '#8ee07a', Damage: '#ff8a5a', Support: '#e9c45a' };
const ROLE_SVG = {
  Tank: '<path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill="currentColor"/><path d="M12 6v12" stroke="#0008" stroke-width="1.6"/>',
  Healer: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor"/>',
  Damage: '<path d="M4 3l9 9-2 2-9-9V3zM20 3v2l-9 9-2-2 9-9z" fill="currentColor"/><path d="M5 16l3 3-2 2-3-3zM19 16l-3 3 2 2 3-3zM8 14l2 2M16 14l-2 2" stroke="currentColor" stroke-width="2.2"/>',
  Support: '<path d="M12 2.5l2.8 6 6.4.7-4.8 4.4 1.4 6.4L12 16.8 6.2 20l1.4-6.4L2.8 9.2l6.4-.7z" fill="currentColor"/>',
};
export const roleIcon = (r) => `<svg class="chs-ri" viewBox="0 0 24 24" aria-hidden="true">${ROLE_SVG[r] || ROLE_SVG.Damage}</svg>`;
export const heroClasses = () => Object.keys(CLASSES).filter(k => ABILITIES[k] && ABILITIES[k].length);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const cname = (k) => (CLASSES[k] || {}).name || k;

// the person (not a computer player) on my team who holds this class, if any
export function takenBy(st, cls, meKey) { if (!st.teams || !cls) return null; return st.roster.find(r => r.team === st.myTeam && !r.bot && !r.me && r.key !== meKey && r.cls === cls) || null; }

// the hero's keys: right click, F, C, Q, then the ultimate on R
function kitRows(cls) {
  const A = ABILITIES[cls] || [], ab = (id) => A.find(a => a.id === id), out = [];
  const txt = (id, a) => (KIT[id] && KIT[id][2]) || (a && a.desc) || '';
  const r = rmbOf(cls); if (r === 'aim') out.push({ key: 'RMB', id: 'aim', name: 'Aim', desc: txt('aim') }); else if (r && ab(r)) out.push({ key: 'RMB', id: r, name: ab(r).name, desc: txt(r, ab(r)) });
  kitOf(cls).forEach((id, i) => { const a = ab(id); if (a) out.push({ key: 'FCQ'[i], id, name: a.name, desc: txt(id, a) }); });
  const u = ultOf(cls); if (u && ab(u)) out.push({ key: 'R', id: u, name: ab(u).name, desc: txt(u, ab(u)), ult: true });
  return out;
}
const icon = (id) => { try { return Icons.abilityIcon(id === 'aim' ? 'aim' : id); } catch (e) { return ''; } };

// what the team still lacks, from everyone's picks (the computer players' included)
function compHint(st) {
  if (!st.teams) return { ok: true, text: 'Free for all: every fighter for themselves.' };
  const mine = st.roster.filter(r => r.team === st.myTeam && r.cls), n = st.roster.filter(r => r.team === st.myTeam).length;
  const c = { Tank: 0, Healer: 0, Damage: 0 }; for (const r of mine) c[roleOf(r.cls)]++;
  const tips = [];
  if (!c.Healer) tips.push(['bad', 'Your team has no healer']);
  if (!c.Tank) tips.push(['bad', 'Your team has no tank to hold the hill']);
  if (n >= 4 && c.Damage >= n - 1) tips.push(['warn', 'Almost all damage: someone should heal or tank']);
  if (n >= 4 && c.Healer >= 3) tips.push(['warn', 'Lots of healers: you may lack damage']);
  if (!tips.length) tips.push(['ok', 'Balanced team: ' + c.Tank + ' tank, ' + c.Healer + ' healer, ' + c.Damage + ' damage']);
  return tips;
}

// mount into `root`. cfg: { title, sub, eyebrow, state(), onPick(cls), onLock(), teamName(t), teamCol(t), top: Element, bar: Element, lockText }
// state() => { teams: [ids] | null, myTeam, roster: [{ key, name, cls, team, me, bot, host, locked }], mine: { cls, locked }, timer: { t, max, label } | { label } | null, canLock, note }
export function mountHeroSelect(root, cfg) {
  const W = el('div', 'chs'); root.appendChild(W);
  W.innerHTML = `<div class="chs-bg"></div>
    <div class="chs-top"><div class="chs-tl"><div class="eyebrow">${esc(cfg.eyebrow || 'Kingdom Arena · Champion select')}</div><h1>${esc(cfg.title || 'Choose your champion')}</h1><small>${cfg.sub || ''}</small></div>
      <div class="chs-timer"><div class="chs-ring"><b>–</b></div><span></span></div><div class="chs-tr"></div></div>
    <div class="chs-main"><aside class="chs-col chs-left"></aside>
      <section class="chs-mid"><div class="chs-tabs"></div><div class="chs-grid"></div><div class="chs-prev"></div></section>
      <aside class="chs-col chs-right"></aside></div>
    <div class="chs-bar"></div><div class="chs-flash" hidden></div>`;
  const q = (s) => W.querySelector(s), grid = q('.chs-grid'), prev = q('.chs-prev'), left = q('.chs-left'), right = q('.chs-right'), tabs = q('.chs-tabs');
  if (cfg.top) q('.chs-tr').appendChild(cfg.top); if (cfg.bar) q('.chs-bar').appendChild(cfg.bar);
  const all = heroClasses(); let filter = 'All', hover = null, shown = null, st = cfg.state(), alive = true;
  // role tabs
  for (const r of ['All', 'Tank', 'Healer', 'Damage', 'Support']) { const n = r === 'All' ? all.length : all.filter(k => r === 'Support' ? SUPPORT.has(k) : roleOf(k) === r).length;
    const b = el('button', 'chs-tab' + (r === filter ? ' on' : ''), `${r === 'All' ? '<svg class="chs-ri" viewBox="0 0 24 24"><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" fill="currentColor"/></svg>' : roleIcon(r)}<span>${r}</span><small>${n}</small>`); b.style.setProperty('--rc', ROLE_COL[r] || '#e2bd6a');
    b.onclick = () => { filter = r; S.click(); tabs.querySelectorAll('.chs-tab').forEach(x => x.classList.toggle('on', x === b)); paintGrid(); }; tabs.appendChild(b); }
  // the portrait grid
  const tiles = {};
  for (const k of all) { const r = roleOf(k), t = el('button', 'chs-tile', `<span class="chs-tim"><img src="${classPortrait(k)}" alt="" draggable="false"></span><i class="chs-trole">${roleIcon(r)}</i><b>${cname(k)}</b><em class="chs-tby"></em><span class="chs-tlock">✓</span>`);
    t.style.setProperty('--rc', ROLE_COL[r]); t.dataset.cls = k;
    t.onmouseenter = () => { hover = k; S.hover && S.hover(); showPrev(k); };
    t.onmouseleave = () => { if (hover === k) { hover = null; showPrev(); } };
    t.onclick = () => pick(k);
    t.ondblclick = () => { pick(k); lock(); };
    tiles[k] = t; grid.appendChild(t); }
  const flash = (msg) => { const f = q('.chs-flash'); f.textContent = msg; f.hidden = false; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); clearTimeout(flash.t); flash.t = setTimeout(() => { f.hidden = true; }, 2600); };
  function pick(k) {
    st = cfg.state(); if (st.mine.locked) { S.error && S.error(); flash('You are locked in'); return; }
    const by = takenBy(st, k); if (by) { S.error && S.error(); const t = tiles[k]; t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); flash(`${by.name} has already picked ${cname(k)}`); return; }
    S.click(); cfg.onPick(k); update();
  }
  function lock() { st = cfg.state(); if (!st.mine.cls || st.mine.locked || st.canLock === false) return; if (takenBy(st, st.mine.cls)) return; S.questAccept ? S.questAccept() : S.click(); cfg.onLock(); update(); const t = tiles[st.mine.cls]; if (t) { t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); } }
  // the preview: the hero under the cursor, else your pick
  function showPrev(k) {
    k = k || st.mine.cls || cfg.initial || null; if (k === shown && prev.firstChild) { paintLock(); return; } shown = k;
    if (!k) { prev.innerHTML = `<div class="chs-pempty"><b>Choose a champion</b><span>Hover a portrait to see the hero, click to pick, then Lock In.</span></div>`; return; }
    const r = roleOf(k), L = arenaLore(k), rows = kitRows(k);
    prev.innerHTML = `<div class="chs-pl"><div class="chs-pimg" style="--rc:${ROLE_COL[r]}"><img src="${classPortrait(k)}" alt=""><i></i></div><button class="chs-lock"></button></div>
      <div class="chs-pinfo"><div class="chs-pname"><h2>${cname(k)}</h2><span class="chs-role" style="--rc:${ROLE_COL[r]}">${roleIcon(r)}${r}</span>${SUPPORT.has(k) ? `<span class="chs-role" style="--rc:${ROLE_COL.Support}">${roleIcon('Support')}Support</span>` : ''}</div>
        <div class="chs-epi"${L.quote ? ` title="“${esc(L.quote)}”"` : ''}>${esc(L.epithet)}<span class="chs-diff" title="How hard to play well">${[1, 2, 3].map(i => `<i class="${i <= L.diff ? 'on' : ''}"></i>`).join('')}</span></div>
        <div class="chs-abs">${rows.map(a => `<div class="chs-ab${a.ult ? ' ult' : ''}"><div class="chs-abi">${icon(a.id)}<kbd>${a.key}</kbd></div><div class="chs-abt"><b>${esc(a.name)}${a.ult ? ' <small>ULTIMATE</small>' : ''}</b><span>${esc(a.desc)}</span></div></div>`).join('')}</div></div>`;
    prev.classList.remove('in'); void prev.offsetWidth; prev.classList.add('in');
    prev.querySelector('.chs-lock').onclick = () => { if (shown !== st.mine.cls && !st.mine.locked) pick(shown); lock(); };
    paintLock();
  }
  function paintLock() { const b = prev.querySelector('.chs-lock'); if (!b) return; const mine = st.mine, by = takenBy(st, shown), same = shown === mine.cls;
    b.className = 'chs-lock'; let t;
    if (mine.locked) { t = 'Locked in ✓' + (same ? '' : `<small>as ${esc(cname(mine.cls))}</small>`); b.classList.add('done'); b.disabled = true; }
    else if (by) { t = 'Taken' + `<small>by ${esc(by.name)}</small>`; b.classList.add('no'); b.disabled = true; }
    else if (st.canLock === false) { t = 'Waiting…'; b.disabled = true; }
    else { t = (cfg.lockText || 'Lock in') + `<small>${esc(cname(shown))}</small>`; b.disabled = false; if (same) b.classList.add('ready'); }
    b.innerHTML = t; }
  function paintGrid() {
    for (const k of all) { const t = tiles[k], by = takenBy(st, k), mate = st.teams && st.roster.find(r => r.team === st.myTeam && r.bot && r.cls === k), on = st.mine.cls === k;
      const vis = filter === 'All' || (filter === 'Support' ? SUPPORT.has(k) : roleOf(k) === filter);
      t.classList.toggle('hide', !vis); t.classList.toggle('on', on); t.classList.toggle('locked', on && !!st.mine.locked); t.classList.toggle('taken', !!by); t.classList.toggle('mate', !by && !!mate && !on);
      t.querySelector('.chs-tby').textContent = by ? by.name + (by.locked ? '' : '…') : mate ? 'CPU' : '';
      t.title = by ? `${by.name} on your team ${by.locked ? 'has locked in' : 'is picking'} ${cname(k)}` : mate ? `A computer team mate plays ${cname(k)}: pick it and they switch to another class` : cname(k); }
  }
  const card = (r) => { const role = r.cls ? roleOf(r.cls) : null, state = r.bot ? '<i class="chs-st cpu">Computer</i>' : r.locked ? '<i class="chs-st lk">Locked</i>' : r.cls ? '<i class="chs-st sel">Picking</i>' : '<i class="chs-st wait">Choosing…</i>';
    return `<div class="chs-pc${r.bot ? ' bot' : ' alp'}${r.me ? ' me' : ''}${r.locked ? ' lk' : ''}"${role ? ` style="--rc:${ROLE_COL[role]}"` : ''}><div class="chs-pci">${r.cls ? `<img src="${classPortrait(r.cls)}" alt="">` : '<span>?</span>'}</div>
      <div class="chs-pct"><b>${esc(r.name)}${r.host ? ' <em>host</em>' : ''}${r.me ? ' <em class="you">you</em>' : ''}</b><span>${r.cls ? `${roleIcon(role)}${cname(r.cls)}` : '<small>no pick yet</small>'}</span></div>${state}</div>`; };
  function paintCols() {
    const T = st.teams, sortR = (a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0) || (a.bot ? 1 : 0) - (b.bot ? 1 : 0);
    const block = (t, mine) => { const list = st.roster.filter(r => r.team === t).sort(sortR); const col = cfg.teamCol ? cfg.teamCol(t) : '#e2bd6a';
      return `<div class="chs-team${mine ? ' mine' : ''}" style="--tc:${col}"><h3><i></i>${mine ? 'Your team' : 'Enemy'} <small>${esc(cfg.teamName ? cfg.teamName(t) : '')}</small><span>${list.filter(r => r.locked && !r.bot).length}/${list.filter(r => !r.bot).length} locked</span></h3>${list.map(card).join('')}</div>`; };
    const key0 = JSON.stringify([T, st.myTeam, st.roster]); if (key0 === paintCols.k) return; paintCols.k = key0;
    if (!T) { left.innerHTML = `<div class="chs-team mine" style="--tc:#e2bd6a"><h3><i></i>Fighters</h3>${st.roster.map(card).join('')}</div>`; right.innerHTML = ''; right.hidden = true; }
    else { right.hidden = false; const tips = compHint(st);
      left.innerHTML = block(st.myTeam, true) + `<div class="chs-comp">${tips.map(([k, s]) => `<div class="${k}">${k === 'ok' ? '✔' : '⚠'} ${esc(s)}</div>`).join('')}</div>`;
      right.innerHTML = T.filter(t => t !== st.myTeam).map(t => block(t, false)).join(''); }
  }
  function paintTimer() { const T = st.timer, ring = q('.chs-ring'), lab = q('.chs-timer span');
    if (T && T.t != null) { const s = Math.max(0, Math.ceil(T.t)); ring.querySelector('b').textContent = s; ring.style.setProperty('--p', Math.max(0, Math.min(1, T.t / (T.max || 60)))); ring.classList.toggle('hurry', s <= 10); ring.classList.add('on'); }
    else { ring.querySelector('b').textContent = '∞'; ring.classList.remove('on', 'hurry'); ring.style.setProperty('--p', 1); }
    lab.textContent = (T && T.label) || ''; }
  function update() { if (!alive) return; st = cfg.state(); paintGrid(); paintCols(); paintTimer(); showPrev(hover); }
  const key = (e) => { if (!W.isConnected) return; if (e.key === 'Enter' && !(e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) { lock(); e.preventDefault(); } };
  window.addEventListener('keydown', key);
  const iv = setInterval(() => { if (!W.isConnected) { destroy(); return; } st = cfg.state(); paintTimer(); if (cfg.live) update(); }, 250);
  function destroy() { alive = false; clearInterval(iv); window.removeEventListener('keydown', key); }
  update();
  return { el: W, update, destroy, flash };
}
