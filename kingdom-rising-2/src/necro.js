// The Necromancer's arena kit (Kingdom Arena and the Training Yard):
//  LMB  the scythe: a wide reaping sweep in front of him (player.js reap(); computer fighters in arena.js)
//  RMB  Bone Armor (unchanged)
//  F    Life Siphon, on and off: press F to start it, press again to stop (it stops by itself after 5 s). While it is on,
//       every 0.2 s the aim ray (20 m) looks for an enemy (a player, a computer fighter or a mob) under the crosshair:
//       if there is one, a purple beam drains its life and a green orb of it flows back into him and heals him; with no
//       one under the crosshair nothing happens. The cooldown (9 s) starts when it stops.
// Online: the machine that owns the necromancer (a player's own, the host for a computer fighter) runs the siphon and
// deals the damage the usual way; the others draw the beam from short 'siph' messages.
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { lineClear } from './world.js';
import * as Game from './game.js';
import { A } from './arena.js';
import { AN, send } from './arenanet.js';
import { ABILITIES } from './data.js';

export const SIPHON = { dur: 5, cd: 9, tick: 0.2, range: 20, k: 0.45, heal: 0.55, slow: 0.6 }; // (k: of weapon damage per second while on a target; heal: share of it that comes back)
export const REAP = { k: 0.62, dur: 0.66, half: 1.15, reachK: 1.35 }; // (the scythe: k of weapon damage to everyone in the sweep; half: radians either side; reach: his eye height x reachK)
export const NX = { bot: null };
G.hooks.reap = REAP; // (player.js reads the scythe's numbers from here) // (bot: { hit, heal } from arena.js, for computer fighters)
const UP = new THREE.Vector3(0, 1, 0);
const inArena = () => !!(A.F && A.F.length);
const chest = (u) => u.pos.clone().setY(u.pos.y + (u.height || 1.7) * 0.6);
const idxOf = (u) => u === G.player ? (A.me && inArena() ? A.me.i : -1) : u && u.arenaF ? u.arenaF.i : -1;
// where the drained life pours in: the shrunken head's mouth in his left hand (the chest if there is none)
function mouthOf(u) { if (u === G.player && u.headMouth) return u.headMouth(); const ch = u.model || u.ch, m = ch && ch.headMouthObj; if (m) { ch.root.updateMatrixWorld(true); return m.getWorldPosition(new THREE.Vector3()); } return chest(u); }

// ---------- the look: a purple drain beam from the victim, green orbs of life running back along it, a green glow at his hand ----------
const MAT = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
function makeFx() { const g = new THREE.Group(), cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const beam = new THREE.Mesh(cyl, MAT('#a040ff', 0.7)), core = new THREE.Mesh(cyl, MAT('#f0d0ff', 0.8)); beam.frustumCulled = core.frustumCulled = false; g.add(beam, core);
  const orbs = []; for (let i = 0; i < 4; i++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), MAT('#5aff6a', 0.95)); o.frustumCulled = false; g.add(o); orbs.push(o); }
  const heal = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), MAT('#40ff60', 0.6)); heal.frustumCulled = false; g.add(heal);
  g.visible = false; G.scene.add(g); return { g, beam, core, orbs, heal, ph: 0 }; }
function drawFx(fx, from, to, dt) { // from: the victim's chest; to: his hand
  fx.g.visible = true; fx.ph = (fx.ph + dt * 1.5) % 1; const d = to.clone().sub(from), L = Math.max(0.01, d.length()), mid = from.clone().lerp(to, 0.5), q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().divideScalar(L));
  const w = 0.16 + Math.sin(G.time * 30) * 0.03; fx.beam.position.copy(mid); fx.beam.quaternion.copy(q); fx.beam.scale.set(w, L, w); fx.core.position.copy(mid); fx.core.quaternion.copy(q); fx.core.scale.set(0.05, L, 0.05); if (Math.random() < dt * 45) V.emit('arcane', from.clone().addScaledVector(d, Math.random()), { speed: 0.3, size: 0.32, life: 0.25 }); /* (purple motes along the beam) */
  fx.orbs.forEach((o, i) => { const u = (fx.ph + i / fx.orbs.length) % 1; o.position.copy(from).addScaledVector(d, u); o.position.y += Math.sin(u * Math.PI) * 0.25; o.scale.setScalar(0.7 + u * 0.6); }); // (life running from them into him)
  fx.heal.position.copy(to); fx.heal.scale.setScalar(0.85 + Math.sin(G.time * 12) * 0.18);
  if (Math.random() < dt * 25) V.emit('shadow', from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.5)), { speed: 0.6, size: 0.35, life: 0.4 });
  if (Math.random() < dt * 20) V.emit('heal', to.clone(), { speed: 0.8, vy: 1.2, size: 0.22, life: 0.5 }); }
const hideFx = (fx) => { if (fx) fx.g.visible = false; };
const dropFx = (fx) => { if (!fx) return; G.scene.remove(fx.g); fx.g.traverse(o => { if (o.material) o.material.dispose(); if (o.geometry) o.geometry.dispose(); }); };

// ---------- who is under the crosshair (a player) or in front of the barrel of his gaze (a computer fighter) ----------
function aimTarget(u) { const R = SIPHON.range;
  if (u === G.player) { const t = u.aimFoe ? u.aimFoe(R) : null; if (!t || t.dead || !t.pos) return null; const e = G.camera.getWorldPosition(new THREE.Vector3()); if (e.distanceTo(chest(t)) > R + 1.5) return null; return lineClear(e, chest(t)) ? t : null; } // (the aim ray each tick: walls block it)
  const T = u.target; if (!T || T.dead || !T.pos || (T.stealth > 0 && T.team !== u.team)) return null; const dx = T.pos.x - u.pos.x, dz = T.pos.z - u.pos.z, d = Math.hypot(dx, dz); if (d > R) return null;
  const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - u.yaw), Math.cos(Math.atan2(dx, dz) - u.yaw)); if (Math.abs(off) > 0.3) return null; // (a computer fighter drains only who it is facing)
  return lineClear(chest(u), chest(T)) ? T : null; }

// ---------- on and off ----------
const keyOf = (u) => { const i = (ABILITIES[u.h.cls] || []).findIndex(a => a.id === 'drainlife'); return i >= 0 ? 'a' + (i + 1) : null; };
export const siphonOn = (u) => !!(u && u.siphon);
// F for your own hero: on if it is ready, off if it is on
export function siphonKey(p, a, i) { const key = 'a' + (i + 1);
  if (p.siphon) { stopSiphon(p); return; }
  if (p.dead || p.swim || p.held || G.uiOpen) return; if ((p.cd[key] || 0) > 0) { S.error && S.error(); return; }
  const h = p.h, up = (G.abilScale ? G.abilScale(h.level) : 1) * Game.perkPow(Game.perkLvl(h, a.id)), base = Game.weaponDamage(h, p.weapon) * up;
  startSiphon(p, a, base); }
// a computer fighter starts one (arena.js decides when)
export function botSiphon(b, a) { if (b.siphon) return; startSiphon(b, a, b.base * Game.perkPow(Game.perkLvl(b.h, a.id)) * (b.up || 1) * (b.dmgMul ? b.dmgMul() : 1)); }
function startSiphon(u, a, base) {
  const s = u.siphon = { a, base, t: 0, tick: 0, tgt: null, fx: makeFx(), snd: null, lost: 0, drained: 0, healed: 0 }; if (u === G.player) u.cd[keyOf(u)] = 0;
  S.cast && S.cast('shadow', u.pos, 0.7); V.burst('shadow', mouthOf(u), 14, { speed: 2 });
  G.timers.push({ update: (dt) => siphonTick(u, s, dt) }); }
export function stopSiphon(u) { const s = u && u.siphon; if (!s) return; u.siphon = null; endFx(u, s); }
function endFx(u, s) { dropFx(s.fx); s.fx = null; if (s.snd) { s.snd.stop(); s.snd = null; } if (u.rendLook !== undefined) u.rendLook = null; const dg = (u.ch || u.model) && (u.ch || u.model).dangle; if (dg) dg.userData.lookAt = null;
  const cd = SIPHON.cd * Game.perkCd(Game.perkLvl(u.h, s.a.id, 'cd')) * Game.arenaCdAll(u.h); if (u === G.player) { const k = keyOf(u); if (k) u.cd[k] = cd; } else if (u.cd) u.cd[s.a.id] = cd;
  hud(u, false); }
const stunned = (u) => u === G.player ? !!(u.db && ((u.db.stun && u.db.stun.t > 0) || (u.db.silence && u.db.silence.t > 0))) || (u.isFrozen && u.isFrozen()) || u.fearT > 0 : !!(u.status && (u.status.stun > 0 || u.status.silence > 0 || u.status.frozen > 0));
function siphonTick(u, s, dt) {
  if (u.siphon !== s) return true; // (switched off)
  s.t += dt; if (u.dead || stunned(u) || s.t >= SIPHON.dur || (inArena() && A.state !== 'fight')) { u.siphon = null; endFx(u, s); return true; }
  hud(u, true);
  const t = aimTarget(u); s.tgt = t;
  if (!t) { hideFx(s.fx); if (s.snd) { s.snd.stop(); s.snd = null; } s.tick = Math.min(s.tick, 0); s.lost += dt; if (u !== G.player && s.lost > 1.2) { u.siphon = null; endFx(u, s); return true; } return false; } // (nothing under the crosshair: nothing happens)
  s.lost = 0; const from = chest(t), to = mouthOf(u); drawFx(s.fx, from, to, dt); if (!s.snd && S.spellLoop) s.snd = S.spellLoop('arcane');
  if (u === G.player) { u.headUpT = Math.max(u.headUpT || 0, 0.3); u.rendLook = () => chest(t); } const dg = (u.ch || u.model) && (u.ch || u.model).dangle; if (dg) dg.userData.lookAt = from; // (the shrunken head turns to drink from them)
  if ((s.tick -= dt) > 0) return false; s.tick += SIPHON.tick;
  const n = s.base * SIPHON.k * SIPHON.tick;
  if (u === G.player) { u.dealDamage(t, n, { el: 'arcane', slow: SIPHON.slow, silent: true }); const hv = n * SIPHON.heal * (u.hk ? u.hk() : 1); u.heal(hv, true); s.drained += n; s.healed += hv; }
  else if (NX.bot) { const dealt = NX.bot.hit(u, t, n, { el: 'arcane', slow: SIPHON.slow }); if (dealt > 0) NX.bot.heal(u, dealt * SIPHON.heal * 6); s.drained += dealt; } // (hits are scaled down for PvP, so the drink is scaled back up, like every drain)
  if (Math.random() < 0.5) V.burst('heal', to, 4, { speed: 1.2, vy: 1 });
  if (AN.on && AN.net) send({ t: 'siph', i: idxOf(u), to: idxOf(t) });
  return false; }
// the hotbar slot glows while it is on
function hud(u, on) { if (u !== G.player) return; const slot = [...document.querySelectorAll('#abil .slot.hb')].find(e => (e.title || '').startsWith('Life Siphon')); if (!slot) return; const v = on ? '0 0 12px 4px #b050ff, inset 0 0 10px #60ff70' : ''; if (slot.style.boxShadow !== v) slot.style.boxShadow = v; }

// ---------- online: another machine's necromancer is siphoning someone ----------
const GH = new Map(); // (fighter index -> { fx, until, to })
export function siphNet(d, U) { const u = U(d.i), t = U(d.to); if (!u || !t) return; let g = GH.get(d.i);
  if (!g) { g = { fx: makeFx(), until: 0, u, t }; GH.set(d.i, g); G.timers.push({ update: (dt) => { if (G.time > g.until || g.u.dead || g.t.dead) { dropFx(g.fx); GH.delete(d.i); return true; } drawFx(g.fx, chest(g.t), mouthOf(g.u), dt); return false; } }); }
  g.u = u; g.t = t; g.until = G.time + SIPHON.tick * 2.5; }
