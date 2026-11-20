// Everything drawn over the 3D view: HUD, speech boxes, the map, the shop and the menus.
import * as THREE from 'three';
import { TAU } from './util.js';
import { LEVELS, ORDER, SHOP } from './levels.js';

const $ = id => document.getElementById(id);
const SEC_COL = { path: '#c9a25a', ramp: '#b5652a', camp: '#e2b33a', climb: '#3f8a3a', cliff: '#54a6d6', gap: '#d8762c', beam: '#8a6238', swing: '#e2b33a', crawl: '#777', chasm: '#54a6d6', glide: '#9ad0f0', river: '#3f9bd8', traps: '#c0392b', goal: '#fff', arena: '#c0392b' };

export class UI {
  constructor(G) {
    this.G = G; this.toastT = 0; this.barkT = 0; this.areaT = 0; this.dlg = null; this.mapOpen = false; this.shopOpen = false; this.last = {}; this.barkQ = [];
    $('dialog').addEventListener('click', () => this.advance());
  }
  set(id, v) { if (this.last[id] !== v) { this.last[id] = v; $(id).textContent = v; } }
  show(id, on) { const k = 's_' + id; if (this.last[k] !== on) { this.last[k] = on; $(id).hidden = !on; } }
  toast(text, secs = 5) { secs = Math.min(secs, 6); $('toast').textContent = text; this.toastT = secs; this.show('toast', true); }
  area(name) { $('area').textContent = name; this.areaT = 2.5; this.show('area', true); }
  bark(who, text) { this.barkQ.push([who, text]); }
  prompt(text) { this.show('prompt', !!text); if (text) this.set('promptText', text); }
  dialog(lines, cb) { if (!lines || !lines.length) { if (cb) cb(); return; } this.dlg = { lines, i: 0, n: 0, cb }; this.G.locked = true; this.show('dialog', true); this.line(); }
  line() { const d = this.dlg, l = d.lines[d.i]; d.n = 0; $('dlgWho').textContent = l.who; $('dlgText').textContent = ''; }
  advance() {
    const d = this.dlg; if (!d) return; const l = d.lines[d.i];
    if (d.n < l.text.length) { d.n = l.text.length; $('dlgText').textContent = l.text; return; }
    if (++d.i < d.lines.length) this.line(); else { this.dlg = null; this.show('dialog', false); this.G.locked = false; this.G.input.clear(); if (d.cb) d.cb(); }
  }
  shop() { this.shopOpen = true; this.G.locked = true; this.show('shop', true); this.drawShop(); this.G.save.seen.nib = 1; }
  drawShop() {
    const S = this.G.save; let h = '';
    SHOP.forEach((it, i) => { const lv = it.stock ? 0 : S.upg[it.id] || 0, max = lv >= it.cost.length, lock = it.needs && !S.items[it.needs], c = it.cost[lv]; h += `<div class="row ${max || lock || S.coins < c ? 'dim' : ''}"><b>${(i + 1) % 10}</b><div><strong>${it.name}</strong> <i>${it.stock ? 'you have ' + (S.bombs || 0) : '★'.repeat(lv) + '☆'.repeat(it.cost.length - lv)}</i><br>${lock ? 'You do not have anything to fit this to yet.' : it.text}</div><span>${max ? 'Sold out' : lock ? '-' : c + ' coins'}</span></div>`; });
    $('shopList').innerHTML = h; $('shopCoins').textContent = S.coins;
  }
  buy(i) { const S = this.G.save, it = SHOP[i]; if (!it) return; const lv = it.stock ? 0 : S.upg[it.id] || 0, c = it.cost[lv]; if (lv >= it.cost.length || (it.needs && !S.items[it.needs]) || S.coins < c) { this.G.audio.sfx('nope'); return; } S.coins -= c; if (it.stock) S.bombs = (S.bombs || 0) + 3; else S.upg[it.id] = lv + 1; this.G.audio.sfx('buy'); this.G.saveNow(); this.drawShop(); }
  closeShop() { this.shopOpen = false; this.show('shop', false); this.G.locked = false; this.G.input.clear(); }
  toggleMap(force) { this.mapOpen = force === undefined ? !this.mapOpen : force; this.show('map', this.mapOpen); if (this.mapOpen) this.drawMap(); }
  drawMap() {
    const G = this.G, W = G.world, cv = $('mapCv'), x = cv.getContext('2d'), S = G.save, w = cv.width, h = cv.height; x.clearRect(0, 0, w, h); x.fillStyle = '#f1e2bd'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(120,90,50,.25)'; for (let i = 0; i < 40; i++) { x.beginPath(); x.moveTo(0, i * 18 + (i % 3) * 3); x.lineTo(w, i * 18 + (i % 5) * 2); x.stroke(); }
    const sp = W.spiral; let obj = '';
    const tick = (ok, text) => `<li class="${ok ? 'ok' : ''}">${ok ? '✔' : '○'} ${text}</li>`;
    if (!sp) {
      // overview of the whole peak
      $('mapTitle').textContent = 'Goblin Peak';
      x.fillStyle = '#7fb069'; x.beginPath(); x.moveTo(40, 560); x.lineTo(300, 60); x.lineTo(560, 560); x.fill();
      x.fillStyle = '#c98a55'; x.beginPath(); x.moveTo(126, 395); x.lineTo(300, 60); x.lineTo(474, 395); x.fill();
      x.fillStyle = '#eef4fa'; x.beginPath(); x.moveTo(204, 245); x.lineTo(300, 60); x.lineTo(396, 245); x.fill();
      x.strokeStyle = '#5a3c1c'; x.lineWidth = 3; x.setLineDash([8, 7]); x.beginPath(); x.moveTo(110, 545); for (let i = 0; i <= 60; i++) { const q = i / 60, yy = 545 - q * 470, half = (560 - yy) / 500 * 250 * 0.8; x.lineTo(300 + Math.sin(q * 26) * half, yy); } x.stroke(); x.setLineDash([]);
      x.font = 'bold 20px Fredoka, sans-serif'; x.textAlign = 'center';
      ORDER.forEach((id, i) => { const L = LEVELS[id], yy = [480, 320, 165][i], open = i === 0 || S.done[ORDER[i - 1]]; x.fillStyle = 'rgba(40,25,10,.78)'; x.fillRect(180, yy - 24, 240, 54); x.fillStyle = open ? '#ffe9a8' : '#998'; x.fillText(`${i + 1}. ${L.name}`, 300, yy); x.font = '15px Fredoka, sans-serif'; x.fillText(S.done[id] ? `Cleared ✔   Relics ${(S.jewels[id] || []).filter(Boolean).length}/3` : open ? 'Open' : 'Locked', 300, yy + 21); x.font = 'bold 20px Fredoka, sans-serif'; });
      x.fillStyle = '#b5332a'; x.fillText('▲ Princess Wrenna', 300, 46); x.fillStyle = '#3a2a1c'; x.fillText('● Bramblewick (you are here)', 300, 590);
      obj += tick(S.done.l1, 'Climb Greenfoot Slopes (west gate)') + tick(S.done.l2, 'Cross Thunder Gorge (north gate)') + tick(S.won, 'Climb the Frostfang Stair and free the Princess (east gate)');
      const jw = ORDER.reduce((a, id) => a + (S.jewels[id] || []).filter(Boolean).length, 0); obj += tick(jw >= 9, `Find the nine hidden relics: each unlocks an upgrade (${jw}/9)`);
      obj += `<li>○ Visit Nib's stall to spend coins (${S.coins})</li>`;
    } else {
      $('mapTitle').textContent = W.def.name; const sc = (w / 2 - 22) / (sp.R0 + 40), X = v => w / 2 + v * sc, Z = v => h / 2 + v * sc, rv = sp.river;
      x.fillStyle = '#d9c897'; x.beginPath(); x.arc(w / 2, h / 2, (sp.R0 + 12) * sc, 0, 7); x.fill();
      if (rv) { x.strokeStyle = '#3f9bd8'; x.lineWidth = 7; x.beginPath(); x.moveTo(X(Math.cos(rv.th) * rv.rSrc), Z(Math.sin(rv.th) * rv.rSrc)); x.lineTo(X(Math.cos(rv.th) * rv.lakeR), Z(Math.sin(rv.th) * rv.lakeR)); x.stroke(); x.fillStyle = '#3f9bd8'; x.beginPath(); x.arc(X(Math.cos(rv.th) * rv.lakeR), Z(Math.sin(rv.th) * rv.lakeR), 26 * sc, 0, 7); x.fill(); }
      x.lineCap = 'round';
      for (const s of W.secs) { x.strokeStyle = SEC_COL[s.t] || '#c9a25a'; x.lineWidth = s.t === 'path' || s.t === 'ramp' ? 5 : 7; x.beginPath(); for (let i = 0; i <= 8; i++) { const p = s.p0 + (s.p1 - s.p0) * i / 8, r = sp.R(p); i ? x.lineTo(X(Math.cos(p) * r), Z(Math.sin(p) * r)) : x.moveTo(X(Math.cos(p) * r), Z(Math.sin(p) * r)); } x.stroke(); }
      x.font = 'bold 15px Fredoka, sans-serif'; x.textAlign = 'center';
      for (const c of W.camps) { x.fillStyle = c.lit ? '#d8362c' : '#777'; x.beginPath(); x.arc(X(c.x), Z(c.z), 7, 0, 7); x.fill(); x.fillStyle = '#3a2a1c'; x.fillText(c.sec.name || 'Camp', X(c.x), Z(c.z) - 11); }
      for (const j of W.jewels) { x.fillStyle = j.got ? '#ff4fa0' : 'rgba(255,79,160,.45)'; x.fillText(j.got ? '◆' : '?', X(j.x), Z(j.z) + 5); }
      x.fillStyle = '#3a2a1c'; x.fillText('START', X(W.start.x), Z(W.start.z) + 20); x.fillStyle = '#b5332a'; x.fillText(W.boss ? '♛ Chieftain' : '⚑ Gate', X(0), Z(0) + 5);
      const p = G.player; x.save(); x.translate(X(p.pos.x), Z(p.pos.z)); x.rotate(-p.yaw); x.fillStyle = '#1a6fd8'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -11); x.lineTo(7, 8); x.lineTo(0, 4); x.lineTo(-7, 8); x.closePath(); x.fill(); x.stroke(); x.restore();
      const id = W.def.id, jn = (S.jewels[id] || []).filter(Boolean).length, lit = W.camps.filter(c => c.lit).length;
      obj += tick(S.done[id] || S.won && id === 'l3', W.def.goal) + tick(lit >= W.camps.length, `Light the campfires (${lit}/${W.camps.length})`) + tick(jn >= 3, `Find the hidden relics (${jn}/3)`);
      obj += `<li>○ Height: ${Math.max(0, Math.round(p.pos.y))} m of ${Math.round(sp.Ytop)} m</li><li class="key"><span style="color:#3f8a3a">■</span> vines <span style="color:#d8762c">■</span> jumps <span style="color:#e2b33a">■</span> whip <span style="color:#54a6d6">■</span> hook <span style="color:#c0392b">■</span> traps <span style="color:#9ad0f0">■</span> glide</li>`;
    }
    $('mapObj').innerHTML = obj;
  }
  levelDone(d, cb) { $('doneTitle').textContent = d.title; $('doneBody').innerHTML = d.body; this.show('done', true); this.G.locked = true; this.doneCb = cb; }
  closeDone() { this.show('done', false); this.G.locked = false; const cb = this.doneCb; this.doneCb = null; if (cb) cb(); }
  update(dt) {
    const G = this.G, S = G.save, I = G.input, P = G.player, W = G.world;
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) this.show('toast', false);
    if (this.areaT > 0 && (this.areaT -= dt) <= 0) this.show('area', false);
    if (this.barkT > 0) { if ((this.barkT -= dt) <= 0) this.show('bark', false); } else if (this.barkQ.length && !this.dlg) { const [who, text] = this.barkQ.shift(); $('barkWho').textContent = who; $('barkText').textContent = text; this.barkT = 2.5 + text.length * 0.045; this.show('bark', true); G.audio.sfx('talk'); }
    if (this.dlg) { const d = this.dlg, l = d.lines[d.i]; if (d.n < l.text.length) { const n0 = Math.floor(d.n); d.n = Math.min(l.text.length, d.n + dt * 55); if (Math.floor(d.n) !== n0) { $('dlgText').textContent = l.text.slice(0, Math.floor(d.n)); if (Math.floor(d.n) % 3 === 0) G.audio.sfx('talk'); } } if (I.hit('KeyE') || I.hit('Space') || I.hit('Enter')) this.advance(); }
    else if (this.shopOpen) { for (let i = 0; i < 10; i++) if (I.hit('Digit' + ((i + 1) % 10))) this.buy(i); if (I.hit('KeyE') || I.hit('Escape') || I.hit('Enter')) this.closeShop(); }
    else if (this.doneCb) { if (I.hit('KeyE') || I.hit('Enter') || I.hit('Space')) this.closeDone(); }
    else if (I.hit('KeyM')) this.toggleMap();
    if (this.mapOpen && (G.frame & 15) === 0) this.drawMap();
    // objective line and the gold marker that points the way
    const gd = G.locked || this.mapOpen ? null : W.guide(); this.show('objective', !!gd); this.show('guide', !!gd);
    if (gd) {
      this.set('objective', gd.text); const v = (this.gv = this.gv || new THREE.Vector3()).set(gd.x, gd.y, gd.z).project(G.camera), d = Math.hypot(gd.x - P.pos.x, gd.z - P.pos.z);
      let x = v.x, y = v.y; const behind = v.z > 1; if (behind) { x = -x; y = -y; }
      const offs = behind || Math.abs(x) > 0.9 || Math.abs(y) > 0.8; if (behind) { const m = Math.max(Math.abs(x), 0.001); x = x / m * 0.9; y = -0.6; }
      x = Math.max(-0.9, Math.min(0.9, x)); y = Math.max(-0.7, Math.min(0.72, y));
      const el = $('guide'); el.style.left = ((x * 0.5 + 0.5) * 100).toFixed(1) + '%'; el.style.top = ((-y * 0.5 + 0.5) * 100).toFixed(1) + '%';
      this.set('guideArrow', !offs ? '▼' : behind ? (x < 0 ? '◀ turn round' : 'turn round ▶') : x < -0.85 ? '◀' : x > 0.85 ? '▶' : y > 0 ? '▲' : '▼'); this.set('guideText', Math.round(d) + ' m');
    }
    this.set('coins', S.coins); const id = W.def.id;
    this.show('jewelBox', !W.def.hub); if (!W.def.hub) { this.set('jewels', (S.jewels[id] || []).filter(Boolean).length + '/3'); this.set('height', Math.max(0, Math.round(P.pos.y)) + ' m / ' + Math.round(W.spiral.Ytop) + ' m'); }
    this.show('heightBox', !W.def.hub);
    const tools = (S.items.whip ? '<span><b>LMB</b> Whip</span>' : '') + (S.items.hook ? `<span><b>RMB</b> ${S.items.cannon ? 'Hand cannon' : 'Hook'}</span>` : '') + (S.items.glider ? '<span><b>Hold SPACE</b> Glide</span>' : '') + (S.bombs > 0 ? `<span><b>G</b> Squibs ×${S.bombs}</span>` : '') + (S.relics.dash ? '<span><b>X</b> Air dash</span>' : '') + `<span><b>SPACE</b> Jump ×${(S.items.boots ? 3 : 2) + (S.relics.fourth ? 1 : 0)}</span><span><b>M</b> Map</span>`;
    if (this.last.tools !== tools) { this.last.tools = tools; $('tools').innerHTML = tools; }
    const bal = !!P.onBeam; this.show('balance', bal); if (bal) $('balDot').style.left = (50 + P.lean * 46) + '%';
    const st = P.swim ? 'Swimming: head for the bank!' : P.climb ? 'Climbing  ·  W/S up and down  ·  SPACE jump off' : P.swing ? 'Swinging  ·  SPACE let go' : P.glide ? 'Gliding' : P.steep ? 'Sliding!' : '';
    this.show('state', !!st); if (st) this.set('state', st);
    const j = P.grounded ? 0 : P.jumps, mx = (S.items.boots ? 3 : 2) + (S.relics.fourth ? 1 : 0); let pips = ''; for (let i = 0; i < mx; i++) pips += i < j ? '○' : '●'; this.set('pips', P.grounded || P.swim ? '' : pips);
  }
}
