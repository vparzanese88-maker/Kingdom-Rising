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

// ---------------- the lobby ----------------
// The host's match settings come from the setup screen. Everyone picks a name, a class, a race and (in team
// formats) a side; empty places are filled with computer fighters. Resolves with the final setup.
export function lobby(setup, F, O, kitName) {
  return new Promise((resolve) => {
    AN.on = true; AN.host = setup.mp === 'host';
    const loop = /[?&]net=loop/.test(location.search);
    const net = AN.net = loop ? new LoopNet() : new Net(11);
    let nm = ''; try { nm = localStorage.getItem(NAME_KEY) || ''; } catch (e) { /* no storage */ }
    let fmt, teams, cap; const refmt = () => { fmt = F[setup.fmt] || F.t3; teams = fmt.ffa ? null : Array.from({ length: fmt.teams }, (_, i) => i); cap = fmt.ffa ? 12 : fmt.teams * fmt.size; }; refmt(); // (a joiner learns the host's format from the lobby)
    const mine = () => AN.players.get(AN.myId);
    const ov = el('div', ''); ov.id = 'arlobby'; document.body.appendChild(ov);
    const teamCount = (t) => [...AN.players.values()].filter(p => p.team === t).length;
    const render = () => {
      const isHost = AN.host; let h = `<div class="arlp"><div class="eyebrow">Kingdom Arena · Online</div>`;
      if (!AN.code) { ov.innerHTML = h + `<h1>Connecting…</h1><p>${AN.err || 'Reaching the matchmaking service…'}</p>${AN.err ? '<button class="btn" id="alBack">← Back</button>' : ''}</div>`; const b = $('alBack'); if (b) b.onclick = () => { location.href = location.pathname; }; return; }
      if (!mine()) { ov.innerHTML = h + '<h1>Joining…</h1></div>'; return; }
      const me = mine(), full = AN.players.size >= cap;
      h += `<h1>${fmt.name} · ${O[setup.objective].name}</h1><div class="alcode"><span>Game code</span><b>${AN.code}</b><button class="btn" id="alCopy">Copy</button><small>Friends open Kingdom Arena on the title screen, type this code next to Join and press it</small></div>`;
      h += `<div class="alcols"><div class="alme"><h3>You</h3><label>Name <input id="alName" maxlength="16" value="${(me.name || '').replace(/"/g, '')}"></label>
        <label>Class <select id="alCls">${Object.keys(CLASSES).map(c => `<option value="${c}"${me.cls === c ? ' selected' : ''}>${CLASSES[c].name}</option>`).join('')}</select></label><small class="alkit">${kitName(me.cls)}</small>
        <label>Race <select id="alRace">${Object.keys(RACES).filter(r => RACES[r].playable).map(r => `<option value="${r}"${me.race === r ? ' selected' : ''}>${RACES[r].name}</option>`).join('')}</select></label>
        ${teams ? `<div class="alteams">${teams.map(t => `<button class="seg${me.team === t ? ' on' : ''}" data-team="${t}" style="--tc:${TEAMC[t]}"><i></i>${TEAMN[t]} <small>${teamCount(t)}/${fmt.size}</small></button>`).join('')}</div>` : ''}</div>`;
      h += `<div class="alplayers"><h3>Players <small>${AN.players.size} of ${cap} · the rest are computer fighters</small></h3>${[...AN.players.entries()].sort((a, b) => a[0] - b[0]).map(([id, p]) => `<div class="alp${id === AN.myId ? ' me' : ''}"><i style="background:${teams ? TEAMC[p.team] : '#d8b04a'}"></i><b>${p.name}${id === 0 ? ' <em>host</em>' : ''}</b><span>${(CLASSES[p.cls] || {}).name || ''} · ${(RACES[p.race] || {}).name || ''}</span></div>`).join('')}</div></div>`;
      h += `<div class="albtns"><button class="btn" id="alLeave">← Leave</button>${isHost ? `<button class="btn gold big" id="alStart">Start the match →</button>` : '<span class="alwait">Waiting for the host to start…</span>'}</div></div>`;
      const focus = document.activeElement && document.activeElement.id === 'alName';
      ov.innerHTML = h;
      const nameI = $('alName'); nameI.onkeydown = (e) => e.stopPropagation(); nameI.onchange = nameI.oninput = () => upd({ name: nameI.value.trim().slice(0, 16) || 'Fighter' }, false); if (focus) { nameI.focus(); nameI.setSelectionRange(nameI.value.length, nameI.value.length); }
      $('alCls').onchange = (e) => upd({ cls: e.target.value }); $('alRace').onchange = (e) => upd({ race: e.target.value });
      ov.querySelectorAll('[data-team]').forEach(b => b.onclick = () => { const t = +b.dataset.team; if (teamCount(t) >= fmt.size && me.team !== t) { S.error(); return; } upd({ team: t }); });
      $('alCopy').onclick = () => { try { navigator.clipboard.writeText(AN.code); } catch (e) { /* no clipboard */ } S.click(); };
      $('alLeave').onclick = () => { location.href = location.pathname; };
      const st = $('alStart'); if (st) st.onclick = () => { S.click(); start(); };
    };
    const upd = (o, rerender = true) => { Object.assign(mine(), o); try { if (o.name) localStorage.setItem(NAME_KEY, o.name); } catch (e) { /* no storage */ } if (AN.host) broadcastPlayers(); else send({ t: 'me', p: mine() }); if (rerender) render(); };
    const broadcastPlayers = () => send({ t: 'players', list: [...AN.players.entries()], fmt: setup.fmt, objective: setup.objective, ffaN: setup.ffaN, lives: setup.lives });
    // the host builds the final fighter list: every player in a place on their side, computer fighters in the rest
    const start = () => {
      const slots = []; const people = [...AN.players.entries()].sort((a, b) => a[0] - b[0]);
      if (fmt.ffa) { const n = Math.max(setup.ffaN || 6, people.length); for (let i = 0; i < n; i++) { const pe = people[i]; slots.push(pe ? { owner: pe[0], name: pe[1].name, cls: pe[1].cls, race: pe[1].race, team: i } : { cls: (setup.slots[i] || {}).cls || pick(), race: (setup.slots[i] || {}).race || 'human', team: i }); } }
      else for (const t of teams) { const mine2 = people.filter(([, p]) => p.team === t); for (let k = 0; k < fmt.size; k++) { const pe = mine2[k]; const def = setup.slots.filter(s => s.team === t)[k] || {}; slots.push(pe ? { owner: pe[0], name: pe[1].name, cls: pe[1].cls, race: pe[1].race, team: t } : { cls: def.cls || pick(), race: def.race || 'human', team: t }); } }
      const final = Object.assign({}, setup, { slots, mp: undefined }); send({ t: 'start', setup: final }); go(final);
    };
    const pick = () => { const k = Object.keys(CLASSES); return k[(Math.random() * k.length) | 0]; };
    const go = (final) => { AN.started = true; ov.remove(); resolve(final); };
    net.on('ready', ({ code, id }) => { AN.code = code; AN.myId = id; AN.players.set(id, { name: nm || (AN.host ? 'Host' : 'Fighter ' + id), cls: (setup.slots[0] || {}).cls || 'warrior', race: (setup.slots[0] || {}).race || 'human', team: teams ? (id % teams.length) : 0 }); if (!AN.host) send({ t: 'me', p: AN.players.get(id) }); render(); });
    net.on('error', (msg) => { AN.err = msg; render(); });
    net.on('join', () => { if (AN.host) broadcastPlayers(); });
    net.on('leave', (id) => { AN.players.delete(id); if (AN.started) AN.h.left && AN.h.left(id); else { if (AN.host) broadcastPlayers(); render(); } });
    net.on('hostleft', () => { if (AN.h.hostLeft) AN.h.hostLeft(); else { AN.err = 'The host left the game.'; AN.code = ''; render(); } });
    net.on('data', (from, d) => {
      if (!AN.started) {
        if (d.t === 'me' && AN.host) { const prev = AN.players.get(from); const p = Object.assign({}, d.p); if (teams && !prev && teamCount(p.team) >= fmt.size) p.team = teams.find(t => teamCount(t) < fmt.size) ?? 0; AN.players.set(from, p); broadcastPlayers(); render(); }
        else if (d.t === 'players' && !AN.host) { const myP = AN.players.get(AN.myId); AN.players = new Map(d.list); if (myP && !AN.players.has(AN.myId)) AN.players.set(AN.myId, myP); Object.assign(setup, { fmt: d.fmt, objective: d.objective, ffaN: d.ffaN, lives: d.lives }); refmt(); render(); }
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
  for (const m of mats) { if (!m || m.userData.rim) continue; m.userData.rim = { value: col }; const rk = { value: k };
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
  takeHit(dmg, src, o = {}) { if (this.dead) return 0; if (src && src.team === this.team && src !== G.player) return 0; const d = dmg * AN.k(); send({ t: 'hit', to: this.owner, d: Math.round(d), o: slim(o), from: srcIndex(src) }); this.hitT = 0.32; for (const m of this.flashMats) if (m.emissive) { m.emissive.setRGB(1, 0.92, 0.85); m.emissiveIntensity = 0.65; } return Math.round(d); }
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
  takeHit(dmg, src, o = {}) { if (this.dead) return 0; if (src && src.team === this.team && src !== G.player) return 0; send({ t: 'bhit', i: this.arenaF.i, dmg: Math.round(dmg), o: slim(o), from: srcIndex(src) }); this.hitT = 0.32; for (const m of this.flashMats) if (m.emissive) { m.emissive.setRGB(1, 0.92, 0.85); m.emissiveIntensity = 0.65; } V.burst(o.el ? 'arcane' : 'blood', this.pos.clone().setY(this.pos.y + 1.15), 8, { speed: 3 }); return Math.round(dmg * AN.k() * 0.7); }
  healSelf(n) { send({ t: 'bheal', i: this.arenaF.i, n: Math.round(n) }); }
  addBuff(kind, dur) { send({ t: 'bbuff', i: this.arenaF.i, kind, dur }); }
}
const slim = (o) => ({ stun: o.stun || 0, slow: o.slow || 0, root: o.root || 0, freeze: o.freeze || 0, bleed: o.bleed || 0, burn: o.burn || 0, el: o.el || 0, melee: !!o.melee });
const srcIndex = (src) => !src ? -1 : src === G.player ? (AN.meIndex ?? -1) : src.arenaF ? src.arenaF.i : src.owner && src.owner.arenaF ? src.owner.arenaF.i : -1;
// (set by arena.js) the damage scales used in the arena
AN.k = () => 0.15 * 0.75; AN.k0 = () => 0.15;
