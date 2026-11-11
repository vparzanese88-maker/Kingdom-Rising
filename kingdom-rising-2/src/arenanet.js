// Kingdom Arena online: one player hosts and shares a 4-letter code, up to 11 friends join.
// The host runs the match (scores, objectives, respawns) and the computer fighters; every player runs their own hero.
// Everyone sends their hero's state ~15 times a second; the host sends the computer fighters and the match state.
// Hits go to whoever owns the target: a player's own machine for a player, the host for a computer fighter.
import { addOutline, arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor } from './arenalooks.js';
import * as THREE from 'three';
import { Net } from './net.js';
import { G } from './state.js';
import { S } from './audio.js';
import { V } from './vfx.js';
import { buildHumanoid, animateHumanoid, equipWeapon, bake } from './character.js';
import { CLASSES, RACES, TIERS } from './data.js';
import { ARENA_KEY } from './battlemap.js';
import { mountHeroSelect, heroClasses } from './heroselect.js';

export const AN = { on: false, host: false, net: null, myId: 0, code: '', players: new Map(), started: false, h: {} };
export const send = (d) => { if (AN.net) AN.net.send(d); };
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const NAME_KEY = 'kr2_mpname';

// ---- a stand-in network for testing two tabs on one computer (add &net=loop to the address) ----
class LoopNet {
  constructor() { this.h = {}; this.role = null; this.id = null; this.code = null; this.ch = null; }
  on(ev, fn) { this.h[ev] = fn; } emit(ev, ...a) { if (this.h[ev]) this.h[ev](...a); }
  open(code) { this.code = code; this.ch = new BroadcastChannel('kr2arena-' + code); this.ch.onmessage = (e) => this.recv(e.data); }
  host() { this.role = 'host'; this.id = 0; this.n = 0; this.open('TEST'); setTimeout(() => this.emit('ready', { code: 'TEST', id: 0 }), 50); }
  join(code) { this.role = 'client'; this.open(code); this.nonce = Math.random(); this.ch.postMessage({ t: 'hello', nonce: this.nonce }); }
  recv(m) {
    if (this.role === 'host') { if (m.t === 'hello') { const id = ++this.n; this.ch.postMessage({ t: 'joined', nonce: m.nonce, id, code: this.code }); this.emit('join', id); } else if (m.t === 'up') this.emit('data', m.from, m.d); }
    else { if (m.t === 'joined' && m.nonce === this.nonce) { this.id = m.id; this.emit('ready', { code: m.code, id: m.id }); } else if (m.t === 'd' && this.id != null) this.emit('data', 0, m.d); else if (m.t === 'up' && this.id != null && m.from !== this.id) this.emit('data', m.from, m.d); }
  }
  send(d) { if (!this.ch) return; if (this.role === 'host') this.ch.postMessage({ t: 'd', d }); else this.ch.postMessage({ t: 'up', from: this.id, d }); }
  close() { if (this.ch) this.ch.close(); }
}

// ---------------- the lobby: a champion select (heroselect.js), after Paladins and Smite ----------------
// The host's match settings come from the setup screen. Everyone picks a name, a race, (in team formats) a side, and a
// class on the champion select: click a portrait to pick it, Lock In to keep it. A class a person on your team has
// picked (locked or not) is taken for the rest of that team; the enemy may pick it too. Computer players fill the empty
// places and switch class when a person wants theirs. The host decides every pick (first come, first served) and tells
// everyone; its Start gives the stragglers 15 s to lock in. Resolves with the final setup.
const LOCK_S = 15;
export function lobby(setup, F, O, kitName) {
  return new Promise((resolve) => {
    AN.on = true; AN.host = setup.mp === 'host';
    const loop = /[?&]net=loop/.test(location.search);
    const net = AN.net = loop ? new LoopNet() : new Net(11);
    let nm = ''; try { nm = localStorage.getItem(NAME_KEY) || ''; } catch (e) { /* no storage */ }
    let pref = null; try { pref = localStorage.getItem('kr2_mpcls'); } catch (e) { /* no storage */ } if (!CLASSES[pref]) pref = (setup.slots[0] || {}).cls || 'warrior';
    let fmt, teams, cap; const refmt = () => { fmt = F[setup.fmt] || F.t3; teams = fmt.ffa ? null : Array.from({ length: fmt.teams }, (_, i) => i); cap = fmt.ffa ? 12 : fmt.teams * fmt.size; }; refmt(); // (a joiner learns the host's format from the lobby)
    const mine = () => AN.players.get(AN.myId);
    const ov = el('div', ''); ov.id = 'arlobby'; document.body.appendChild(ov);
    const teamCount = (t) => [...AN.players.values()].filter(p => p.team === t).length;
    AN.bots = []; AN.lockEnd = 0; let botCls = {}, HS = null, deny = null;
    // ---- the host's rules ----
    const holder = (t, cls, except) => teams && cls ? [...AN.players.entries()].find(([id, p]) => id !== except && p.team === t && p.cls === cls) : null; // (a person on team t with this class)
    const freeFor = (t, want, except) => { if (want && !holder(t, want, except)) return want; const left = heroClasses().filter(c => !holder(t, c, except)); return left[(Math.random() * left.length) | 0] || 'warrior'; };
    // the computer players on each side: the setup's classes, kept as they are until a person takes one, then that one switches to a class nobody on the side has
    const refreshBots = () => { if (!teams) { AN.bots = []; return; } const out = [];
      for (const t of teams) { const n = Math.max(0, fmt.size - teamCount(t)), people = new Set([...AN.players.values()].filter(p => p.team === t && p.cls).map(p => p.cls));
        let arr = (botCls[t] || setup.slots.filter(s => s.team === t).map(s => s.cls)).slice(0, n); const pool = setup.slots.filter(s => s.team === t).map(s => s.cls).concat(heroClasses().sort(() => Math.random() - 0.5));
        while (arr.length < n) arr.push(null);
        const used = new Set(people); arr = arr.map(c => { if (c && !used.has(c)) { used.add(c); return c; } return null; }); arr = arr.map(c => { if (c) return c; const nc = pool.find(x => !used.has(x)) || heroClasses()[0]; used.add(nc); return nc; });
        botCls[t] = arr; arr.forEach(c => out.push({ team: t, cls: c })); }
      AN.bots = out; };
    const accept = (id, p0) => { const prev = AN.players.get(id), p = Object.assign({}, p0); deny = null;
      if (prev && prev.locked) { p.cls = prev.cls; p.locked = true; p.team = prev.team; } // (locked in: the pick and the side stay)
      if (teams && !prev && teamCount(p.team) >= fmt.size) p.team = teams.find(t => teamCount(t) < fmt.size) ?? 0;
      if (teams && prev && p.team !== prev.team && teamCount(p.team) >= fmt.size) p.team = prev.team;
      const h = holder(p.team, p.cls, id); if (h) { deny = { id, msg: `${h[1].name} has already picked ${(CLASSES[p.cls] || {}).name || p.cls}` }; p.cls = prev && prev.team === p.team ? prev.cls : null; p.locked = false; if (holder(p.team, p.cls, id)) p.cls = null; }
      if (!p.cls) p.locked = false;
      AN.players.set(id, p); broadcastPlayers(); };
    const broadcastPlayers = () => { refreshBots(); send({ t: 'players', list: [...AN.players.entries()], bots: AN.bots, lockLeft: AN.lockEnd ? Math.max(1, AN.lockEnd - Date.now()) : 0, deny, fmt: setup.fmt, objective: setup.objective, ffaN: setup.ffaN, lives: setup.lives }); if (deny && deny.id === AN.myId && HS) HS.flash(deny.msg); deny = null; };
    const upd = (o) => { const p = Object.assign({}, mine(), o); try { if (o.name) localStorage.setItem(NAME_KEY, o.name); if (o.locked && p.cls) localStorage.setItem('kr2_mpcls', p.cls); } catch (e) { /* no storage */ }
      if (AN.host) accept(AN.myId, p); else { AN.players.set(AN.myId, p); send({ t: 'me', p }); } render(); };
    // ---- the screen ----
    let barFmt = null;
    const render = () => {
      if (!AN.code || !mine()) { if (HS) { HS.destroy(); HS = null; } ov.classList.remove('chsmode');
        ov.innerHTML = `<div class="arlp"><div class="eyebrow">Kingdom Arena · Online</div>` + (!AN.code ? `<h1>Connecting…</h1><p>${AN.err || 'Reaching the matchmaking service…'}</p>${AN.err ? '<button class="btn" id="alBack">← Back</button>' : ''}</div>` : '<h1>Joining…</h1></div>'); const b = $('alBack'); if (b) b.onclick = () => { location.href = location.pathname; }; return; }
      if (!HS || barFmt !== setup.fmt) build();
      paintBar(); HS.update();
    };
    const roster = () => { const out = [...AN.players.entries()].sort((a, b) => a[0] - b[0]).map(([id, p]) => ({ key: 'p' + id, name: p.name, cls: p.cls, team: teams ? p.team : 0, me: id === AN.myId, host: id === 0, locked: !!p.locked }));
      if (teams) AN.bots.forEach((b, i) => out.push({ key: 'b' + i, name: 'Computer', cls: b.cls, team: b.team, bot: true, locked: true })); return out; };
    const build = () => {
      if (HS) HS.destroy(); ov.innerHTML = ''; ov.classList.add('chsmode'); barFmt = setup.fmt;
      const top = el('div', 'chs-inv', `<span>Invite code</span><b>${AN.code}</b><input id="alLink" readonly value="${location.origin + location.pathname}?mode=arena&amp;join=${AN.code}"><button class="btn gold" id="alCopy">Copy invite link</button>`);
      top.title = 'Send the link to your friends: opening it puts them straight in this lobby. Or they press Play Online on the title screen and type the code.';
      const bar = el('div', 'chs-barin', ''); bar.style.cssText = 'display:contents';
      bar.innerHTML = `<button class="btn" id="alLeave">← Leave</button><label>Name <input id="alName" maxlength="16"></label><label>Race <select id="alRace">${Object.keys(RACES).filter(r => RACES[r].playable).map(r => `<option value="${r}">${RACES[r].name}</option>`).join('')}</select></label>${teams ? `<div class="alteams">${teams.map(t => `<button class="seg" data-team="${t}" style="--tc:${TEAMC[t]}"><i></i>${TEAMN[t]} <small></small></button>`).join('')}</div>` : ''}<span class="sp"></span><span class="alwait" id="alInfo"></span>${AN.host ? '<button class="btn gold big" id="alStart" style="font-size:18px;padding:11px 22px">Start the match →</button>' : ''}`;
      HS = mountHeroSelect(ov, { eyebrow: 'Kingdom Arena · Online · Champion select', title: 'Choose your champion', sub: `${fmt.name} · ${O[setup.objective].name} · empty places are computer players`, top, bar, initial: pref,
        teamName: (t) => TEAMN[t] || '', teamCol: (t) => TEAMC[t] || '#e2bd6a',
        state: () => { const me = mine() || {}; return { teams, myTeam: teams ? me.team : 0, roster: roster(), mine: { cls: me.cls, locked: !!me.locked }, timer: AN.lockEnd ? { t: (AN.lockEnd - Date.now()) / 1000, max: LOCK_S, label: 'Lock in now!' } : { label: AN.host ? 'Start when ready' : 'Waiting for the host' } }; },
        onPick: (cls) => upd({ cls }), onLock: () => upd({ locked: true }) });
      const me = mine(), nameI = $('alName'); nameI.value = me.name || ''; nameI.onkeydown = (e) => e.stopPropagation(); nameI.onchange = nameI.oninput = () => { const v = nameI.value.trim().slice(0, 16) || 'Fighter'; const p = Object.assign({}, mine(), { name: v }); try { localStorage.setItem(NAME_KEY, v); } catch (e) { /* no storage */ } if (AN.host) accept(AN.myId, p); else { AN.players.set(AN.myId, p); send({ t: 'me', p }); } HS.update(); };
      const rs = $('alRace'); rs.value = me.race; rs.onchange = (e) => upd({ race: e.target.value });
      ov.querySelectorAll('[data-team]').forEach(b => b.onclick = () => { const t = +b.dataset.team, m = mine(); if (m.locked || m.team === t) { S.error(); return; } if (teamCount(t) >= fmt.size) { S.error(); HS.flash('That side is full'); return; } S.click(); upd({ team: t }); });
      $('alCopy').onclick = () => { const li = $('alLink'), url = li ? li.value : AN.code; try { navigator.clipboard.writeText(url); } catch (e) { /* no clipboard */ } S.click(); const b = $('alCopy'); if (b) { b.textContent = 'Copied ✓'; setTimeout(() => { if ($('alCopy')) $('alCopy').textContent = 'Copy invite link'; }, 1600); } };
      $('alLeave').onclick = () => { location.href = location.pathname; };
      const st = $('alStart'); if (st) st.onclick = () => { S.click(); const ppl = [...AN.players.values()]; if (AN.lockEnd || ppl.every(p => p.locked)) start(); else { AN.lockEnd = Date.now() + LOCK_S * 1000; broadcastPlayers(); render(); } };
    };
    const paintBar = () => { const me = mine(); ov.querySelectorAll('[data-team]').forEach(b => { const t = +b.dataset.team; b.classList.toggle('on', me.team === t); b.disabled = !!me.locked && me.team !== t; b.querySelector('small').textContent = `${teamCount(t)}/${fmt.size}`; });
      const ppl = [...AN.players.values()], nL = ppl.filter(p => p.locked).length, info = $('alInfo'); if (info) info.textContent = `${ppl.length} of ${cap} players · ${nL} locked in${AN.host ? '' : ' · the host starts the match'}`;
      const st = $('alStart'); if (st) st.textContent = AN.lockEnd ? 'Start now →' : nL === ppl.length ? 'Start the match →' : 'Start · 15 s to lock in →'; };
    // the host builds the final fighter list: every player in a place on their side, computer fighters in the rest
    const start = () => { if (AN.started) return;
      for (const [id, p] of AN.players) if (!p.cls) p.cls = freeFor(p.team, null, id); refreshBots();
      const slots = []; const people = [...AN.players.entries()].sort((a, b) => a[0] - b[0]);
      if (fmt.ffa) { const n = Math.max(setup.ffaN || 6, people.length); for (let i = 0; i < n; i++) { const pe = people[i]; slots.push(pe ? { owner: pe[0], name: pe[1].name, cls: pe[1].cls, race: pe[1].race, team: i } : { cls: (setup.slots[i] || {}).cls || pick(), race: (setup.slots[i] || {}).race || 'human', team: i }); } }
      else for (const t of teams) { const mine2 = people.filter(([, p]) => p.team === t), bots = botCls[t] || []; let bi = 0; for (let k = 0; k < fmt.size; k++) { const pe = mine2[k]; const def = setup.slots.filter(s => s.team === t)[k] || {}; slots.push(pe ? { owner: pe[0], name: pe[1].name, cls: pe[1].cls, race: pe[1].race, team: t } : { cls: bots[bi++] || def.cls || pick(), race: def.race || 'human', team: t }); } }
      const final = Object.assign({}, setup, { slots, mp: undefined }); send({ t: 'start', setup: final }); go(final);
    };
    const pick = () => { const k = heroClasses(); return k[(Math.random() * k.length) | 0]; };
    const go = (final) => { AN.started = true; clearInterval(tick); if (HS) HS.destroy(); ov.remove(); resolve(final); };
    // the host's lock-in countdown: at zero (or once everyone has locked in) the match starts, unpicked players get a free class
    const tick = setInterval(() => { if (!AN.host || !AN.lockEnd || AN.started) return; if (Date.now() >= AN.lockEnd || [...AN.players.values()].every(p => p.locked)) start(); }, 250);
    net.on('ready', ({ code, id }) => { AN.code = code; AN.myId = id; const p = { name: nm || (AN.host ? 'Host' : 'Fighter ' + id), cls: null, locked: false, race: (setup.slots[0] || {}).race || 'human', team: teams ? (id % teams.length) : 0 };
      AN.players.set(id, p); if (AN.host) refreshBots(); else send({ t: 'me', p }); render(); });
    net.on('error', (msg) => { AN.err = msg; render(); });
    net.on('join', () => { if (AN.host) broadcastPlayers(); });
    net.on('leave', (id) => { AN.players.delete(id); if (AN.started) AN.h.left && AN.h.left(id); else { if (AN.host) broadcastPlayers(); render(); } });
    net.on('hostleft', () => { if (AN.h.hostLeft) AN.h.hostLeft(); else { AN.err = 'The host left the game.'; AN.code = ''; render(); } });
    net.on('data', (from, d) => {
      if (!AN.started) {
        if (d.t === 'me' && AN.host) { accept(from, d.p); render(); }
        else if (d.t === 'players' && !AN.host) { const myP = AN.players.get(AN.myId); AN.players = new Map(d.list); if (myP && !AN.players.has(AN.myId)) AN.players.set(AN.myId, myP); AN.bots = d.bots || []; AN.lockEnd = d.lockLeft ? Date.now() + d.lockLeft : 0; Object.assign(setup, { fmt: d.fmt, objective: d.objective, ffaN: d.ffaN, lives: d.lives }); refmt(); render(); if (d.deny && d.deny.id === AN.myId && HS) HS.flash(d.deny.msg); }
        else if (d.t === 'start' && !AN.host) go(d.setup);
        return;
      }
      AN.h.data && AN.h.data(from, d);
    });
    if (AN.host) net.host(); else net.join((setup.code || '').toUpperCase());
    render();
  });
}
const TEAMC = ['#3a7ae0', '#e04a3a', '#3ac060', '#e0b030'], TEAMN = ['Blue', 'Red', 'Green', 'Gold'];

// ---------------- telling sides apart: a glowing rim of light around every fighter, red for enemies, blue for your side ----------------
export function teamRim(mats, foe) {
  const col = new THREE.Color(foe ? '#ff3020' : '#3a90ff'), k = foe ? 0.75 : 0.45;
  for (const m of mats) { if (!m) continue; if (m.userData.rim) { m.userData.rim.value.copy(col); if (m.userData.rimK) m.userData.rimK.value = k; continue; } /* (called again after a team swap: recolour) */ m.userData.rim = { value: col }; const rk = m.userData.rimK = { value: k };
    m.onBeforeCompile = (sh) => { sh.uniforms.rimCol = m.userData.rim; sh.uniforms.rimK = rk;
      sh.fragmentShader = 'uniform vec3 rimCol; uniform float rimK;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  { float rim = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0); totalEmissiveRadiance += rimCol * pow(rim, 2.6) * rimK; }'); };
    m.needsUpdate = true; }
}
// ---------------- other players' fighters, as seen on this machine ----------------
let rid = 80000;
export class RemoteFighter {
  constructor(f) {
    this.remote = true; this.arenaBot = true; this.arenaF = f; this.owner = f.owner; this.id = rid++; this.team = f.team; this.heroName = f.name; this.hostile = f.team !== G.myTeam;
    this.pos = new THREE.Vector3(0, 3, 0); this.tgt = this.pos.clone(); this.yaw = 0; this.tyaw = 0; this.radius = 0.65; this.hp = 100; this.maxHp = 100; this.lv = this.level = 20; this.stealth = 0; this.iframes = 0;
    this.status = { frozen: 0, stun: 0, slow: 0, root: 0, knock: new THREE.Vector3() };
    this.def = { name: f.name, aggro: 1, boss: false, elite: false, skin: false, loot: null, size: 1, shape: 'human', armor: 0 };
    this.h = { race: f.race, cls: f.cls }; this.abs = []; this.act = ''; this.actT = 0; this.spd = 0;
    this.build(f.cls, f.race); G.mobs.push(this);
  }
  get name() { return this.heroName; }
  build(cls, race) {
    if (this.root) G.scene.remove(this.root); this.cls = cls; this.h = { race, cls };
    const ch = buildHumanoid({ race, sex: 'm', cls, outfit: cls, spec: arenaSpec(cls), body: arenaBody(cls) }); this.model = ch; this.root = ch.root; this.height = ch.height || 1.8; arenaDecor(ch, cls);
    try { equipWeapon(ch, CLASSES[cls].weapons[0], 3, 0); arenaWeaponDecor(ch, cls); } catch (e) { /* unknown weapon */ }
    try { bake(ch.root); this.flashMats = Object.values(ch.bakedMats || {}); } catch (e) { this.flashMats = []; } addOutline(ch.root);
    teamRim(this.flashMats, this.team !== G.myTeam);
    G.scene.add(this.root);
  }
  dist2(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z; return dx * dx + dz * dz; }
  // a state update from its owner
  net(s) { if (s.c && s.c !== this.cls) this.build(s.c, this.h.race); this.tgt.set(s.x, s.y, s.z); this.tyaw = s.yaw; this.hp = s.hp; this.maxHp = s.mh; this.act = s.a || ''; this.actT = s.at || 0; this.spd = s.sp || 0; this.roll = s.r; this.castUp = s.cu; this.stealth = s.st ? 1 : 0;
    if (s.d && !this.dead) { this.dead = true; this.deadT = 0; } else if (!s.d && this.dead) { this.dead = false; this.root.visible = true; this.root.rotation.set(0, 0, 0); this.pos.copy(this.tgt); } }
  update(dt) {
    if (this.dead) { this.deadT = (this.deadT || 0) + dt; const k = Math.min(1, this.deadT / 0.6); this.root.rotation.x = -k * k * Math.PI / 2; this.root.position.y = this.pos.y + 0.12 * k; return; }
    if (this.pos.distanceTo(this.tgt) > 6) this.pos.copy(this.tgt); else this.pos.lerp(this.tgt, Math.min(1, dt * 12));
    this.yaw += Math.atan2(Math.sin(this.tyaw - this.yaw), Math.cos(this.tyaw - this.yaw)) * Math.min(1, dt * 14);
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    if (this.hitT > 0) { this.hitT = Math.max(0, this.hitT - dt); const f = this.hitT / 0.32; for (const m of this.flashMats) if (m.emissive) m.emissiveIntensity = 0.65 * f * f; }
    this.root.visible = !(this.stealth && this.team !== G.myTeam) && !(G.camera && G.camera.position.distanceTo(this.pos.clone().setY(this.pos.y + 1)) < 1.15);
    animateHumanoid(this.model, dt, { speed: this.spd, action: this.castUp ? 'castUp' : this.act || null, actionT: this.castUp ? Math.min(1, this.actT) : this.actT, roll: this.roll != null ? this.roll : null, armed: true });
  }
  // hit by something running on this machine: the owner applies it
  takeHit(dmg, src, o = {}) { if (this.dead) return 0; if (src && src.team === this.team && src !== G.player) return 0; const d = dmg * AN.k(); send({ t: 'hit', to: this.owner, d: Math.round(d), o: slim(o, src), from: srcIndex(src) }); this.hitT = 0.32; for (const m of this.flashMats) if (m.emissive) { m.emissive.setRGB(1, 0.92, 0.85); m.emissiveIntensity = 0.65; } return Math.round(d); }
  takeDamage(dmg, src, o) { return this.takeHit(dmg / AN.k0(), src, o); }
  healSelf(n) { send({ t: 'heal', to: this.owner, n: Math.round(n) }); }
  heal(n) { this.healSelf(n); }
  addBuff(kind, dur) { send({ t: 'buff', to: this.owner, kind, dur }); }
  debuff(type, t) { send({ t: 'hit', to: this.owner, d: 0, o: { stun: type === 'stun' ? t : 0, slow: type === 'slow' ? t : 0 }, from: -1 }); }
  knock() {} respawn() {} remove() { G.scene.remove(this.root); }
}
// ---------------- the host's computer fighters, as seen by everyone else ----------------
export class BotProxy extends RemoteFighter {
  constructor(f) { super(f); this.proxy = true; this.owner = 0; }
  netBot(s) { // [x, z, yaw, hp, maxHp, action, actionT, cast(0 none 1 strike 2 spell), speed, dead, stunned, class]
    if (s[11] && s[11] !== this.cls) this.build(s[11], this.h.race);
    this.tgt.set(s[0], 3, s[1]); this.tyaw = s[2]; this.hp = s[3]; this.maxHp = s[4]; this.act = s[5] || ''; this.actT = s[6] || 0; this.castUp = s[7] === 2; if (s[7] === 1) { this.act = 'swing2'; this.actT = 0.3; } this.spd = s[8]; this.status.stun = s[10] ? 1 : 0;
    if (s[9] && !this.dead) { this.dead = true; this.deadT = 0; } else if (!s[9] && this.dead) { this.dead = false; this.root.visible = true; this.root.rotation.set(0, 0, 0); this.pos.copy(this.tgt); } }
  takeHit(dmg, src, o = {}) { if (this.dead) return 0; if (src && src.team === this.team && src !== G.player) return 0; send({ t: 'bhit', i: this.arenaF.i, dmg: Math.round(dmg), o: slim(o, src), from: srcIndex(src) }); this.hitT = 0.32; for (const m of this.flashMats) if (m.emissive) { m.emissive.setRGB(1, 0.92, 0.85); m.emissiveIntensity = 0.65; } V.burst(o.el ? 'arcane' : 'blood', this.pos.clone().setY(this.pos.y + 1.15), 8, { speed: 3 }); return Math.round(dmg * AN.k() * 0.7); }
  healSelf(n) { send({ t: 'bheal', i: this.arenaF.i, n: Math.round(n) }); }
  addBuff(kind, dur) { send({ t: 'bbuff', i: this.arenaF.i, kind, dur }); }
}
const slim = (o, src) => { o = AN.shape ? AN.shape(src, o) : o; return { stun: o.stun || 0, slow: o.slow || 0, root: o.root || 0, freeze: typeof o.freeze === 'number' ? o.freeze : 0, bleed: o.bleed || 0, burn: o.burn || 0, el: o.el || 0, melee: !!o.melee, mez: !!o.mez, silence: o.silence || 0, weaken: o.weaken || 0 }; }; // (AN.shape: arena.js caps the control a hit from this machine carries)
const srcIndex = (src) => !src ? -1 : src === G.player ? (AN.meIndex ?? -1) : src.arenaF ? src.arenaF.i : src.owner && src.owner.arenaF ? src.owner.arenaF.i : -1;
// (set by arena.js) the damage scales used in the arena
AN.k = () => 0.15 * 0.75; AN.k0 = () => 0.15;
