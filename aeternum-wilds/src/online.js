// Co-op: friends play the same island together. One player hosts (a 4-letter code / invite link), the others
// join. Everyone sees each other moving and fighting, chats, fights the same enemies (an enemy someone is
// fighting is driven by that player's game and mirrored on everyone else's), and shares experience: when
// an enemy dies, every party member within 60 m gets the kill.
import * as THREE from 'three';
import { G } from './state.js';
import { Net } from './net.js';
import { makeCharacter, armCharacter, spawnProj } from './player.js';
import { dressHumanoid } from './models.js';
import { animHumanoid } from './anim.js';
import { heightAt } from './world.js';
import { CLASSES } from './classes.js';
import { esc } from './util.js';

const $ = id => document.getElementById(id);
const O = { net: null, me: null, code: null, peers: new Map(), sendT: 0, enemyT: 0, status: '', started: false, onStart: null, onLobby: null };
export const gameStarted = () => O.started;
export function setLobbyName(n) { O.name = String(n || 'Castaway').slice(0, 18); hello(); }
export const myLobbyName = () => O.name || 'Castaway';
export const isHost = () => O.me === 0;
export function setLobbyHooks(onLobby, onStart) { O.onLobby = onLobby; O.onStart = onStart; }
// the host starts the adventure: everyone waiting in the lobby goes in together
export function startAdventure() { if (O.me !== 0) return; O.started = true; send({ t: 'go' }); O.onStart?.(); }
export function lobbyPlayers() {
  const me = { id: O.me, me: true, ...myInfo() };
  return [me, ...[...O.peers.values()].filter(P => P.name)].sort((a, b) => a.id - b.id);
}
export const online = () => !!(O.net && O.me != null);
export const onlineCode = () => O.code;
export const partySize = () => O.peers.size + 1;

// ---------- connection ----------
export function hostGame(onState) { start(n => n.host(), onState); }
export function joinGame(code, onState) { start(n => n.join(code), onState); }
function start(go, onState) {
  if (!Net.available()) { onState({ error: 'Online play needs a modern browser (WebRTC).' }); return; }
  if (O.net) O.net.close();
  const n = O.net = new Net();
  n.on('ready', ({ code, id }) => { O.me = id; O.code = code; setupHub(); onState({ ok: true, code, id }); sysMsg(id === 0 ? `You are hosting game ${code}. Friends join with that code.` : `Joined game ${code}.`); hello(); });
  n.on('error', msg => { O.net = null; O.me = null; onState({ error: msg }); });
  n.on('data', (from, d) => onData(from, d));
  n.on('join', () => hello()); // greet the newcomer so they learn who is here
  n.on('leave', id => dropPeer(id));
  n.on('hostleft', () => { sysMsg('The host left the game. You are playing alone now.'); for (const id of [...O.peers.keys()]) dropPeer(id); O.net = null; O.me = null; G.net = null; refreshParty(); });
  go(n);
}
export function leaveOnline() { if (O.net) { send({ t: 'bye' }); O.net.close(); } O.net = null; O.me = null; G.net = null; O.started = false; O.code = null; for (const id of [...O.peers.keys()]) dropPeer(id); }
function send(d) { if (O.net) O.net.send(d); }

// what other players need to draw me
function myInfo() {
  const p = G.mode === 'game' ? G.p : null;
  if (!p) return { name: O.name || 'Castaway', inGame: false, ready: false, started: O.started };
  const w = p.equip[p.activeW === 0 ? 'w1' : 'w2'];
  return { name: p.name || 'Castaway', inGame: G.mode === 'game', ready: true, started: O.started, cls: p.cls, level: p.level, look: p.look, w: w ? { wtype: w.wtype, tier: w.tier, model: w.model, shield: w.shield } : null };
}
export function hello() { if (online()) send({ t: 'hi', ...myInfo() }); }
G.onLook = () => { clearTimeout(O.lookT); O.lookT = setTimeout(hello, 200); };

// ---------- the hub other modules call through (G.net) ----------
function setupHub() {
  G.net = {
    me: O.me,
    // an enemy another player is fighting: their game drives it, ours just mirrors it
    remote: e => e.netOwner != null && e.netOwner !== O.me && G.time - (e.netSeen || 0) < 1.5,
    hit: (e, dmg) => { if (e.key) send({ t: 'eh', k: e.key, d: Math.round(dmg) }); },
    kill: e => { if (e.key) send({ t: 'ek', k: e.key, x: Math.round(e.pos.x), z: Math.round(e.pos.z) }); },
    proj: o => send({ t: 'pj', x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), dx: +o.dx.toFixed(3), dy: +(o.dy || 0).toFixed(3), dz: +o.dz.toFixed(3), s: o.speed, r: o.range, c: o.color ?? null, f: !!o.fire, z2: o.size || 0, e: o.explode || 0 }),
  };
}

// ---------- messages ----------
function onData(from, d) {
  if (!d || typeof d !== 'object') return;
  switch (d.t) {
    case 'hi': {
      const known = O.peers.has(from);
      const P = peer(from);
      const first = !P.name;
      Object.assign(P, { name: String(d.name || 'Castaway').slice(0, 18), inGame: !!d.inGame, ready: !!d.ready, cls: d.cls, level: d.level, look: d.look, w: d.w });
      if (from === 0 && d.started && !O.started) { O.started = true; O.onLobby?.(); }
      if (first) { sysMsg(`${P.name} joined.`); hello(); }
      else if (!known) hello();
      rebuildAvatar(P);
      refreshParty();
      O.onLobby?.();
      break;
    }
    case 'go': if (from === 0 && !O.started) { O.started = true; O.onStart?.(); } break;
    case 'st': { const P = peer(from); P.st = d; P.seen = performance.now(); if (P.level !== d.lv) { P.level = d.lv; refreshParty(); } P.hp = d.hp; P.mhp = d.mhp; break; }
    case 'chat': { const P = peer(from); chatMsg(P.name || 'Someone', String(d.m || '').slice(0, 200)); break; }
    case 'bye': dropPeer(from); break;
    case 'es': for (const s of d.l || []) mirrorEnemy(from, s); break;
    case 'eh': { const e = G.enemyByKey?.get(d.k); if (e && !e.dead) { e.hp -= d.d; e.hitFlash = 0.1; e.aggro = true; if (e.hp <= 0) e.hp = 1; } break; } // the killer announces the kill
    case 'ek': remoteKill(from, d); break;
    case 'pj': if (G.mode === 'game') spawnProj({ owner: 'remote', x: d.x, y: d.y, z: d.z, dx: d.dx, dy: d.dy, dz: d.dz, speed: d.s, range: d.r, color: d.c ?? undefined, fire: d.f || undefined, size: d.z2 || undefined, explode: d.e }); break;
  }
}
function peer(id) { let P = O.peers.get(id); if (!P) { P = { id }; O.peers.set(id, P); } return P; }
function dropPeer(id) {
  const P = O.peers.get(id);
  if (!P) return;
  if (P.h) G.scene?.remove(P.h.root);
  P.label?.remove();
  O.peers.delete(id);
  if (P.name) sysMsg(`${P.name} left.`);
  O.onLobby?.();
  for (const e of G.enemies || []) if (e.netOwner === id) e.netOwner = null;
  refreshParty();
}

// ---------- other players on the map ----------
function rebuildAvatar(P) {
  if (!G.scene || G.mode !== 'game') return;
  if (P.h) { G.scene.remove(P.h.root); P.h = null; }
  if (!P.inGame || !P.look) return;
  const h = P.h = makeCharacter({ look: P.look });
  const C = CLASSES[P.cls];
  dressHumanoid(h, { chest: 0x7a6a52, legs: 0x4a3e30, feet: 0x2a2018, helm: null, trim: C?.color ?? 0x5a4a38 });
  if (P.w) armCharacter(h, P.w, null);
  h.phase = 0;
  G.scene.add(h.root);
  if (!P.label) { P.label = document.createElement('div'); P.label.className = 'netname'; $('netlabels')?.appendChild(P.label); }
  P.label.innerHTML = `${esc(P.name)} <small>${C ? C.name : ''} ${P.level || 1}</small><i><b></b></i>`;
}
const _v = new THREE.Vector3();
function updateAvatars(dt) {
  for (const P of O.peers.values()) {
    if (!P.h && P.inGame && P.look && G.mode === 'game') rebuildAvatar(P);
    const h = P.h, s = P.st;
    if (!h || !s) { if (P.label) P.label.style.display = 'none'; continue; }
    const r = h.root, k = Math.min(1, dt * 12);
    if (!P.placed || Math.hypot(r.position.x - s.x, r.position.z - s.z) > 12) { r.position.set(s.x, s.y, s.z); P.placed = true; }
    r.position.x += (s.x - r.position.x) * k; r.position.z += (s.z - r.position.z) * k; r.position.y += (s.y - r.position.y) * k;
    let df = s.f - r.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); r.rotation.y += df * k;
    h.phase = (h.phase || 0) + dt * (s.mv || 0) * 9;
    animHumanoid(h, { move: s.mv || 0, phase: h.phase, pose: s.p || null, t: s.pt || 0, draw: s.dr || 0, twoHand: P.w && (P.w.wtype === 'greataxe' || P.w.wtype === 'hammer') });
    // name tag above the head
    if (P.label) {
      _v.set(r.position.x, r.position.y + (h.tallW || 2.4) + 0.35, r.position.z).project(G.camera);
      const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      P.label.style.display = vis ? 'block' : 'none';
      if (vis) {
        P.label.style.transform = `translate(${(_v.x * 0.5 + 0.5) * innerWidth}px, ${(-_v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
        const b = P.label.querySelector('b'); if (b) b.style.width = `${Math.max(0, Math.min(100, (P.hp || 1) / (P.mhp || 1) * 100))}%`;
      }
    }
  }
}

// ---------- shared enemies ----------
// enemies my player is fighting are mine to drive: I send their state; everyone else mirrors them
function sendEnemies() {
  const l = [];
  for (const e of G.enemies) {
    if (!e.key || e.dead || !e.aggro || G.net.remote(e)) continue;
    if (e.netOwner != null && e.netOwner < O.me && G.time - (e.netSeen || 0) < 1.5) continue;
    l.push({ k: e.key, x: +e.pos.x.toFixed(2), z: +e.pos.z.toFixed(2), f: +e.facing.toFixed(2), p: e.lastPose || null, pt: +(e.lastT || 0).toFixed(2), hp: Math.round(e.hp), m: +(e.move || 0).toFixed(2) });
    if (l.length >= 24) break;
  }
  if (l.length) send({ t: 'es', l });
}
function mirrorEnemy(from, s) {
  const e = G.enemyByKey?.get(s.k);
  if (!e || e.dead) return;
  // two players claimed the same enemy at once: the lower id keeps it
  if (e.aggro && (e.netOwner == null || e.netOwner === O.me) && O.me < from && !G.net.remote(e)) return;
  e.netOwner = from; e.netSeen = G.time;
  e.netPos = { x: s.x, z: s.z }; e.netF = s.f; e.netPose = s.p; e.netT = s.pt; e.move = s.m || 0;
  e.hp = Math.min(e.hp, s.hp); e.aggro = true;
}
// the enemy died in someone else's game: it dies here too, and I get the kill if I was close enough
function remoteKill(from, d) {
  const e = G.enemyByKey?.get(d.k);
  const P = G.player;
  const near = P && Math.hypot(P.pos.x - d.x, P.pos.z - d.z) < 60;
  if (e && !e.dead) { e.hp = 0; G.killEnemyRemote?.(e, near); return; }
  // not spawned here (too far): keep the camp's spawn count in step
  const [ci, si, gen] = String(d.k).split(':').map(Number);
  const slot = G.camps?.[ci]?.slots?.[si];
  if (slot && (slot.gen || 0) === gen) { slot.gen = gen + 1; slot.respawnAt = G.time + 50; }
}

// ---------- per frame ----------
export function tickOnline(dt) {
  if (!online()) return;
  const P = G.player;
  O.sendT -= dt;
  if (G.mode === 'game' && P && O.sendT <= 0) {
    O.sendT = 1 / 12;
    send({ t: 'st', x: +P.pos.x.toFixed(2), y: +P.y.toFixed(2), z: +P.pos.z.toFixed(2), f: +P.facing.toFixed(2), mv: +(P.move || 0).toFixed(2), p: P.netPose || null, pt: +(P.netPoseT || 0).toFixed(2), dr: +(P.draw || 0).toFixed(2), hp: Math.round(P.hp), mhp: Math.round(P.netMaxHp || P.hp), lv: G.p.level });
  }
  O.enemyT -= dt;
  if (G.mode === 'game' && O.enemyT <= 0) { O.enemyT = 0.1; sendEnemies(); }
  updateAvatars(dt);
  O.partyT = (O.partyT || 0) - dt;
  if (O.partyT <= 0) { O.partyT = 0.5; refreshPartyBars(); }
}
// my look or weapon changed (equip, swap): tell everyone
export function announceLook() { hello(); }

// ---------- party frame and chat ----------
function refreshParty() {
  const el = $('party');
  if (!el) return;
  if (!online()) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'block';
  const rows = [...O.peers.values()].filter(P => P.name).map(P => `<div class="pm" data-id="${P.id}"><span>${esc(P.name)}</span><small>${CLASSES[P.cls]?.name || ''} ${P.level || 1}</small><i><b></b></i></div>`).join('');
  el.innerHTML = `<div class="ph">Party · ${O.code} <small>${O.peers.size + 1} player${O.peers.size ? 's' : ''}</small></div>${rows || '<div class="pm none">Waiting for friends…</div>'}`;
  refreshPartyBars();
}
function refreshPartyBars() {
  for (const P of O.peers.values()) {
    const b = document.querySelector(`#party .pm[data-id="${P.id}"] b`);
    if (b) b.style.width = `${Math.max(0, Math.min(100, (P.hp ?? 1) / (P.mhp || 1) * 100))}%`;
  }
}
function line(html) {
  const ll = $('lobbylog');
  if (ll) { const d = document.createElement('div'); d.innerHTML = html; ll.appendChild(d); ll.scrollTop = ll.scrollHeight; }
  const log = $('chatlog');
  if (!log) return;
  const d = document.createElement('div'); d.innerHTML = html; log.appendChild(d);
  while (log.children.length > 60) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
  $('chat')?.classList.add('show');
  clearTimeout(O.fade); O.fade = setTimeout(() => { if (document.activeElement !== $('chatin')) $('chat')?.classList.remove('show'); }, 9000);
}
function chatMsg(name, m) { line(`<b>${esc(name)}:</b> ${esc(m)}`); }
function sysMsg(m) { line(`<i>${esc(m)}</i>`); }
export function sendChat(m) {
  m = String(m || '').trim().slice(0, 200);
  if (!m) return;
  if (!online()) { sysMsg('You are not in an online game. Host or join one from the home screen.'); return; }
  send({ t: 'chat', m });
  chatMsg((G.mode === 'game' ? G.p?.name : O.name) || 'You', m);
}
export function initChat() {
  const inp = $('chatin');
  if (!inp || inp.dataset.bound) return;
  inp.dataset.bound = '1';
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { sendChat(inp.value); inp.value = ''; inp.blur(); }
    else if (e.key === 'Escape') { inp.value = ''; inp.blur(); }
  });
  inp.addEventListener('focus', () => $('chat').classList.add('show', 'typing'));
  inp.addEventListener('blur', () => { $('chat').classList.remove('typing'); clearTimeout(O.fade); O.fade = setTimeout(() => $('chat').classList.remove('show'), 4000); });
  refreshParty();
}
export function focusChat() { const inp = $('chatin'); if (inp) { inp.focus(); return true; } return false; }
