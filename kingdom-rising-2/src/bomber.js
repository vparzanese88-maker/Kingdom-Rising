// The Goblin Bombardier's kit (Kingdom Arena and the Training Yard):
//  LMB  thrown bombs: his own hand bomb, lobbed in an arc; it bounces two or three times off the ground and walls (each hop
//       lower) and goes off 0.45 s after it settles (at once if it hits an enemy)
//  Q    sticky bombs: 5 charges (one back every 0.5 s); they stick to whatever they hit (ground, walls, an enemy, and ride
//       along on them); 5 out at most (a sixth makes the oldest fall away); they wait for the detonator (20 s at most)
//  RMB  the detonator: every thrown and sticky bomb he has out goes off at once; sticky bombs in a much bigger blast
//  R    Big Bertha, planted at his feet: it beeps faster and faster for 9 s, then a 16 m blast; enemies can run, or
//       defuse it by standing on it for 3 s. The detonator never touches it.
// Online: whoever owns the bomb (a player's own machine, the host for a computer fighter) runs it and deals the damage;
// everyone else draws a copy from 'bomb' messages (thrown, stuck, gone off, removed) and hears the same beeps.
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { makeBomb } from './arenalooks.js';
import { kitize } from './character.js';
import { groundAt, collide, lineClear } from './world.js';
import { foe } from './combat.js';
import { A, gy, ultFoes, ultHurt } from './arena.js';
import { AR, PILLARS } from './arenamap.js';
import { AN, send } from './arenanet.js';
import { ABILITIES } from './data.js';

export const BOMB = {
  throw: { fuse: 0.45, max: 3.2, bounceV: 1.0, rest: 0.45, r: 3.2, k: 1.1, speed: 20, up: 4 }, // (k: of the thrower's weapon damage, at the centre; half that at the edge; fuse: it goes off this long after it settles (its third bounce, or rolling), max s after the throw at most)
  sticky: { max: 5, charges: 5, per: 0.5, r: 3.2, bigR: 4.5, k: 0.55, smallK: 0.6, life: 20, speed: 25, up: 2.5, gap: 0.25 }, // (k: of the ability damage per sticky when detonated; smallK: share of that when one goes off by itself after life s)
  ult: { plant: 0.8, fuse: 9, r: 16, core: 5, coreK: 0.9, edgeK: 0.25, defuse: 3, defuseR: 1.7 },
};
const GRAV = 16, BR = 0.16, UP = new THREE.Vector3(0, 1, 0);
export const BX = { list: [], seq: 0, bot: null }; // (bot: { hit, foes } from arena.js, for computer fighters' bombs)
const inArena = () => !!(A.F && A.F.length);
const ground = (x, z, y) => inArena() ? gy(x, z, y) : groundAt(x, z, y + 0.6).h;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---------- looks ----------
// the bomb he holds (the same model: makeBomb, swapped for the detailed grenade once it has loaded), centred so it tumbles round its middle
function bombModel(s = 1) { const g = new THREE.Group(), b = makeBomb(1); b.position.y = -0.1; kitize(b, 'bomb_grenade'); g.add(b); g.scale.setScalar(s); g.userData.inner = b; return g; }
const LED = new THREE.MeshBasicMaterial({ color: '#ff2a10' }), LED_OFF = new THREE.MeshBasicMaterial({ color: '#4a0a04' });
function stickyModel() { const g = bombModel(1.15); // (the same bomb, wrapped in a blob of goblin glue, with a blinking red light)
  const goo = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 9), new THREE.MeshStandardMaterial({ color: '#b8d020', emissive: '#4a6a00', emissiveIntensity: 0.5, roughness: 0.15, transparent: true, opacity: 0.72 })); goo.scale.set(1.25, 0.8, 1.25); goo.position.y = -0.04; g.add(goo);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), LED); led.position.set(0.09, 0.06, 0.06); g.add(led); g.userData.led = led; return g; }
function bigModel() { // Big Bertha: three of his bombs strapped round a brass-banded keg with a ticking clock face and a red light
  const g = new THREE.Group(), iron = new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: 0.7, roughness: 0.45 }), brass = new THREE.MeshStandardMaterial({ color: '#b08a3a', metalness: 0.8, roughness: 0.4 });
  const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.5, 16), iron); keg.position.y = 0.25; g.add(keg);
  for (const y of [0.08, 0.42]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.025, 6, 20), brass); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5, m = bombModel(2.0); m.position.set(Math.cos(a) * 0.42, 0.3, Math.sin(a) * 0.42); m.rotation.set(0.25 * Math.sin(a), a, 0.25 * Math.cos(a)); g.add(m); }
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 18), new THREE.MeshStandardMaterial({ color: '#efe2c0', roughness: 0.6 })); face.position.y = 0.52; g.add(face);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.012, 0.13), new THREE.MeshBasicMaterial({ color: '#1a1008' })); hand.position.set(0, 0.545, 0); hand.geometry.translate(0, 0, 0.06); g.add(hand); g.userData.hand = hand;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), LED); led.position.set(0, 0.6, 0.2); g.add(led); g.userData.led = led;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 9), new THREE.MeshBasicMaterial({ color: '#ff3010', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.copy(led.position); g.add(glow); g.userData.glow = glow;
  return g; }
function ultRings(R, core) { const mk = (geo, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; return m; };
  return [mk(new THREE.RingGeometry(R - 0.35, R, 96), 0.5), mk(new THREE.CircleGeometry(core, 48), 0.12), mk(new THREE.RingGeometry(0.2, BOMB.ult.defuseR, 32), 0)]; }

// ---------- who is who ----------
const oiOf = (u) => u === G.player ? (A.me && inArena() ? A.me.i : -1) : u && u.arenaF ? u.arenaF.i : -1;
const mine = (u) => !!u && (u === G.player || (!!u.arenaBot && !u.remote)); // (bombs run on the machine that owns them)
function foesOf(o) { if (!o) return []; if (o === G.player) return G.mobs.filter(m => m && !m.dead && m.pos && foe(m)); return BX.bot && o.arenaBot ? BX.bot.foes(o) : []; }
function hurt(o, u, n) { if (!u || u.dead || !(n > 0)) return; if (o === G.player) o.dealDamage(u, n, { el: 'fire', ranged: true }); else if (BX.bot && o && o.arenaBot) BX.bot.hit(o, u, n, { ranged: true, el: 'fire' }); }
const netOn = () => AN.on && AN.net;
function net(d) { if (netOn()) send(Object.assign({ t: 'bomb' }, d)); }
const r2 = (v) => Math.round(v * 100) / 100, P3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];

// ---------- making bombs ----------
let ticking = false;
function ensureTick() { if (ticking) return; ticking = true; G.timers.push({ update: (dt) => { tick(dt); const keep = BX.list.length || (G.player && G.player.h && G.player.h.cls === 'bombardier'); if (!keep) ticking = false; return !keep; } }); }
function add(b) { b.t = 0; b.born = G.time; if (!b.mesh) b.mesh = b.kind === 'u' ? bigModel() : b.kind === 's' ? stickyModel() : bombModel(1.3); b.mesh.position.copy(b.pos); G.scene.add(b.mesh); BX.list.push(b); ensureTick(); return b; }
function remove(b) { const i = BX.list.indexOf(b); if (i >= 0) BX.list.splice(i, 1); if (b.mesh) G.scene.remove(b.mesh); for (const m of b.rings || []) G.scene.remove(m); if (b.defusing && G.hooks.castBar) G.hooks.castBar(null); }
// a thrown bomb (LMB). dmg: its full damage at the centre of the blast
export function throwBomb(owner, from, vel, dmg) { const b = add({ id: ++BX.seq, kind: 'b', owner, oi: oiOf(owner), pos: from.clone(), vel: vel.clone(), dmg, fuse: BOMB.throw.max, spin: new THREE.Vector3(8 + Math.random() * 4, Math.random() * 3, 2) });
  net({ e: 'n', o: b.oi, id: b.id, k: 'b', p: P3(from), v: P3(vel) }); return b; }
// a sticky bomb (Q): uses a charge; the oldest of the five out falls away
export function stickyCharges(h) { const s = h.stk || (h.stk = { n: BOMB.sticky.charges, at: 0, last: -9 }), per = BOMB.sticky.per * (h.stkK || 1);
  while (s.n < BOMB.sticky.charges && G.time - s.at >= per) { s.n++; s.at += per; } if (s.n >= BOMB.sticky.charges) s.at = G.time; s.next = s.n < BOMB.sticky.charges ? Math.max(0, per - (G.time - s.at)) : 0; return s; }
export function throwSticky(owner, from, vel, dmg) { const h = owner.h; const s = stickyCharges(h); if (s.n <= 0 || G.time - s.last < BOMB.sticky.gap) return null;
  if (s.n >= BOMB.sticky.charges) s.at = G.time; s.n--; s.last = G.time;
  const out = BX.list.filter(b => b.owner === owner && b.kind === 's' && !b.ghost).sort((x, y) => x.born - y.born);
  while (out.length >= BOMB.sticky.max) { const old = out.shift(); fizzle(old); net({ e: 'r', o: old.oi, id: old.id }); }
  const b = add({ id: ++BX.seq, kind: 's', owner, oi: oiOf(owner), pos: from.clone(), vel: vel.clone(), dmg, fuse: BOMB.sticky.life, spin: new THREE.Vector3(6, 2, 3) });
  net({ e: 'n', o: b.oi, id: b.id, k: 's', p: P3(from), v: P3(vel) }); return b; }
// the detonator (RMB): every thrown and sticky bomb this goblin has out goes off at once (never the planted one)
export function detonate(owner) { let n = 0; for (const b of BX.list.slice()) if (b.owner === owner && !b.ghost && (b.kind === 'b' || b.kind === 's')) { boom(b, b.kind === 's' ? 'big' : 'norm'); n++; } return n; }
export const liveBombs = (owner, kind) => BX.list.filter(b => b.owner === owner && !b.ghost && (!kind || b.kind === kind));
// Big Bertha, planted at the feet
export function plantBomb(owner, at) { const p = at.clone(); p.y = ground(p.x, p.z, p.y + 0.5); const b = add({ id: ++BX.seq, kind: 'u', owner, oi: oiOf(owner), pos: p, vel: new THREE.Vector3(), fuse: BOMB.ult.fuse, stuck: { u: null, n: UP.clone() }, beepT: 0, defuse: 0, team: owner && owner.team });
  b.mesh.rotation.y = Math.random() * 6; b.rings = ultRings(BOMB.ult.r, BOMB.ult.core); for (const m of b.rings) { m.position.set(p.x, p.y + 0.07, p.z); G.scene.add(m); }
  V.burst('dust', p.clone().setY(p.y + 0.2), 26, { speed: 3 }); S.bombStick(p); S.blunt && S.blunt(p);
  net({ e: 'n', o: b.oi, id: b.id, k: 'u', p: P3(p), v: [0, 0, 0] }); return b; }

// ---------- flight: arcs, bounces, sticking ----------
function wallNormal(p, r) { // pushed out of a wall, building, tree, rock or pillar: which way the surface faces (null if clear)
  const q = p.clone(); let hit = collide(q, r);
  if (inArena() && AR.map !== 'ruins') { const d = Math.hypot(q.x, q.z), R = AR.R - 0.2; if (d > R) { q.x *= R / d; q.z *= R / d; hit = true; } for (const P of PILLARS) { const dx = q.x - P.x, dz = q.z - P.z, dd = Math.hypot(dx, dz), m = P.r + r; if (dd < m && dd > 1e-3) { q.x = P.x + dx / dd * m; q.z = P.z + dz / dd * m; hit = true; } } }
  if (!hit) return null; const n = new THREE.Vector3(q.x - p.x, 0, q.z - p.z); if (n.lengthSq() < 1e-8) return null; return n.normalize(); }
function settle(b) { if (b.kind !== 'b' || b.settled) return; b.settled = true; b.fuse = Math.min(b.fuse, b.t + BOMB.throw.fuse); } // (a thrown bomb's short fuse runs once it has done its bouncing)
function bounced(b, sp) { b.bounces = (b.bounces || 0) + 1; if (b.bounces >= 3) settle(b); if (sp > 2.5) { S.bombBounce(b.pos, sp / 10); if (sp > 5) V.burst('dust', b.pos.clone(), 5, { speed: 1.5, size: 0.25 }); } }
function fly(b, dt) {
  b.vel.y -= GRAV * dt; const steps = Math.max(1, Math.ceil(b.vel.length() * dt / 0.2)), h = dt / steps;
  for (let i = 0; i < steps; i++) { const np = b.pos.clone().addScaledVector(b.vel, h);
    const wn = wallNormal(np, BR);
    if (wn) { if (b.kind === 's') { stickWorld(b, wn); return; } const vn = b.vel.dot(wn); if (vn < 0) { const sp = b.vel.length(); b.vel.addScaledVector(wn, -1.55 * vn); b.vel.x *= 0.85; b.vel.z *= 0.85; bounced(b, sp); } np.copy(b.pos).addScaledVector(b.vel, h); if (wallNormal(np, BR)) np.copy(b.pos); }
    const gh = ground(np.x, np.z, b.pos.y);
    if (np.y - BR < gh) { np.y = gh + BR; if (b.kind === 's') { b.pos.copy(np); stickWorld(b, UP); return; }
      if (b.vel.y < -BOMB.throw.bounceV) { const sp = -b.vel.y; b.vel.y = sp * BOMB.throw.rest; b.vel.x *= 0.72; b.vel.z *= 0.72; bounced(b, sp); }
      else { b.vel.y = 0; const f = Math.max(0, 1 - 5 * h); b.vel.x *= f; b.vel.z *= f; b.rolling = true; settle(b); } }
    b.pos.copy(np); }
}
function stickWorld(b, n) { b.stuck = { u: null, n: n.clone() }; b.vel.set(0, 0, 0); S.bombStick(b.pos); V.burst('poison', b.pos.clone(), 6, { speed: 1, size: 0.12 }); if (!b.ghost) net({ e: 's', o: b.oi, id: b.id, p: P3(b.pos), u: -1, n: P3(n) }); }
const yawOf = (u) => u === G.player ? (u.bodyYaw != null ? u.bodyYaw : u.yaw || 0) : u.yaw || 0;
function stickUnit(b, u, at) { // glued to a body: the bomb keeps its place on them (turning with them) wherever they go
  const hgt = u.height || 1.8, y = Math.max(0.35, Math.min(hgt * 0.85, (at ? at.y : b.pos.y) - u.pos.y)); const d = new THREE.Vector3(b.pos.x - u.pos.x, 0, b.pos.z - u.pos.z); if (d.lengthSq() < 1e-4) d.set(Math.sin(yawOf(u)), 0, Math.cos(yawOf(u))); d.normalize();
  const rr = Math.max(0.28, (u.radius || 0.5) * 0.62), off = new THREE.Vector3(d.x * rr, y, d.z * rr).applyAxisAngle(UP, -yawOf(u)); b.stuck = { u, off, n: d.clone() }; b.vel.set(0, 0, 0); follow(b);
  S.bombStick(b.pos); V.burst('poison', b.pos.clone(), 8, { speed: 1.2, size: 0.12 }); if (u === G.player) G.hooks.toast && G.hooks.toast('A sticky bomb is stuck to you!', '💣', 'bad');
  if (!b.ghost) net({ e: 's', o: b.oi, id: b.id, p: P3(b.pos), u: u.arenaF ? u.arenaF.i : u === G.player && A.me ? A.me.i : -1 }); }
function follow(b) { const s = b.stuck; if (!s || !s.u) return; const u = s.u; if (!u.pos) return; const o = s.off.clone().applyAxisAngle(UP, yawOf(u)); b.pos.set(u.pos.x + o.x, u.pos.y + o.y, u.pos.z + o.z); s.n.set(o.x, 0, o.z).normalize(); }
// did it fly into an enemy? (the machine that owns it decides)
function touching(b) { for (const u of foesOf(b.owner)) { if (!u || u.dead || !u.pos || u.dummy && u.held) continue; const hgt = u.height || 1.8, r = Math.max(u.radius || 0.5, 0.42) + BR + 0.08;
    if (b.pos.y < u.pos.y - 0.1 || b.pos.y > u.pos.y + hgt + 0.15) continue; if (Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z) < r) return u; } return null; }

// ---------- going off ----------
function fizzle(b) { V.burst('smoke', b.pos.clone(), 8, { speed: 1, size: 0.4, life: 0.8 }); V.burst('spark', b.pos.clone(), 5, { speed: 1.5 }); remove(b); }
export function boomFx(pos, big) { // big: 0 a thrown bomb, 1 a detonated sticky, 2 Big Bertha
  const k = big === 2 ? 5 : big === 1 ? 1.45 : 1, r = big === 2 ? BOMB.ult.r : big === 1 ? BOMB.sticky.bigR : BOMB.throw.r, cam = G.camera ? G.camera.position.distanceTo(pos) : 10;
  V.burst('fire', pos, Math.round(46 * k), { speed: 6 * Math.sqrt(k) }); V.burst('smoke', pos, Math.round(16 * k), { speed: 2.5 * Math.sqrt(k), size: 0.8 * Math.sqrt(k), life: 1.1, vy: 1.5 }); V.burst('spark', pos, Math.round(14 * k), { speed: 9 * Math.sqrt(k) });
  V.sphereFlash(pos, (big === 2 ? 7 : 1.6) * (big === 1 ? 1.5 : 1), '#ffb040', big === 2 ? 0.6 : 0.22); V.ring(pos.clone().setY(pos.y - BR + 0.08), r, '#ff9030', big === 2 ? 0.8 : 0.35); V.light(pos, '#ff8030', 5 * k, big === 2 ? 0.9 : 0.25, 9 * Math.sqrt(k) + 4);
  if (big === 2) { V.burst('lava', pos, 50, { speed: 12 }); V.ring(pos, r * 0.6, '#fff0a0', 0.5); S.explode(pos, 1.7); }
  S.explode(pos, big === 1 ? 0.7 : big === 2 ? 1.6 : 0.45); V.addShake((big === 2 ? 1.6 : big === 1 ? 0.35 : 0.18) * Math.max(0.15, 1 - cam / (big === 2 ? 60 : 30))); }
function boom(b, mode) { // mode: 'norm' (a thrown bomb's fuse or contact, a sticky going off by itself), 'big' (a sticky set off by the detonator)
  const pos = b.pos.clone(), big = mode === 'big', S2 = BOMB.sticky, r = big ? S2.bigR : b.kind === 's' ? S2.r : BOMB.throw.r, dmg = b.dmg * (b.kind === 's' && !big ? S2.smallK : 1);
  remove(b); boomFx(pos, big ? 1 : 0); net({ e: 'x', o: b.oi, id: b.id, p: P3(pos), b: big ? 1 : 0 });
  if (inArena() && A.state !== 'fight') return; const on = b.stuck && b.stuck.u;
  for (const u of foesOf(b.owner)) { if (!u || u.dead || !u.pos) continue; const d = Math.max(0, Math.hypot(u.pos.x - pos.x, u.pos.z - pos.z) - (u.radius || 0.5) * 0.5), dy = pos.y - (u.pos.y + (u.height || 1.8) * 0.5); if (d > r || Math.abs(dy) > r * 0.8 + 1) continue;
    if (u !== on && !lineClear(pos.clone().setY(pos.y + 0.3), u.pos.clone().setY(u.pos.y + 1))) continue; // (walls stop the blast)
    hurt(b.owner, u, dmg * (u === on ? 1.15 : 1 - 0.5 * clamp01(d / r))); }
}
function bigBoom(b) { // Big Bertha goes up
  const pos = b.pos.clone().setY(b.pos.y + 0.4), U = BOMB.ult; remove(b); boomFx(pos, 2); net({ e: 'x', o: b.oi, id: b.id, p: P3(pos), b: 2 });
  const sc = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshBasicMaterial({ color: '#120804', transparent: true, opacity: 0.85, depthWrite: false })); sc.rotation.x = -Math.PI / 2; sc.position.set(pos.x, b.pos.y + 0.05, pos.z); G.scene.add(sc);
  let t2 = 0; G.timers.push({ update: (dt) => { t2 += dt; sc.material.opacity = 0.85 * Math.max(0, 1 - t2 / 8); if (Math.random() < 0.4) V.emit('ember', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, -0.3, (Math.random() - 0.5) * 8)), { speed: 0.4, vy: 1.5, size: 0.3 }); if (t2 > 8) { G.scene.remove(sc); return true; } return false; } });
  if (b.ghost || (inArena() && A.state !== 'fight')) return;
  for (const u of ultFoes(b.owner)) { if (!u || u.dead || !u.pos) continue; const d = Math.hypot(u.pos.x - pos.x, u.pos.z - pos.z); if (d > U.r) continue;
    const frac = d < U.core ? U.coreK : 0.6 - (0.6 - U.edgeK) * clamp01((d - U.core) / (U.r - U.core));
    if (u.remote) { if (u.takeHit) u.takeHit((u.maxHp || 1000) * frac / Math.max(1e-3, AN.k ? AN.k() : 1), b.owner, { el: 'fire' }); } else ultHurt(u, frac, b.owner, 'fire'); // (another player: their own machine takes it)
    const n = new THREE.Vector3(u.pos.x - pos.x, 0, u.pos.z - pos.z); if (n.lengthSq() < 1e-4) n.set(1, 0, 0); n.normalize(); const kk = 6 + 10 * (1 - clamp01(d / U.r));
    if (u === G.player) { if (u.vel) u.vel.set(n.x * kk, 8, n.z * kk); } else if (u.status && !u.remote) { u.status.stun = Math.max(u.status.stun || 0, d < U.core ? 0.9 : 0.4); if (u.status.knock) u.status.knock.set(n.x * kk, 0, n.z * kk); if (u.arenaBot) u.status.burn = Math.max(u.status.burn || 0, 3); } }
}
function defused(b, who) { const p = b.pos.clone().setY(b.pos.y + 1); V.number(p, 'DEFUSED', 'crit'); V.burst('spark', p, 30, { speed: 3 }); V.burst('smoke', b.pos.clone().setY(b.pos.y + 0.5), 20, { speed: 1, size: 0.6 }); S.detonator(); remove(b);
  if (who === G.player) G.hooks.toast && G.hooks.toast('You defused Big Bertha!', '✂', 'gold'); else if (b.owner === G.player) G.hooks.toast && G.hooks.toast('Your Big Bertha was defused!', '💣', 'bad'); }

// ---------- every frame ----------
function tick(dt) {
  const fighting = !inArena() || A.state === 'fight';
  if (!fighting) { for (const b of BX.list.slice()) remove(b); return; } // (between rounds the sand is swept clean)
  bomberHud();
  for (const b of BX.list.slice()) { b.t += dt;
    if (b.kind === 'u') { ultTick(b, dt); continue; }
    if (b.stuck) follow(b); else fly(b, dt);
    if (!b.ghost) {
      if (b.kind === 's' && b.owner && b.owner.dead) { fizzle(b); net({ e: 'r', o: b.oi, id: b.id }); continue; } // (a dead goblin's sticky bombs drop off and fizzle)
      if (!b.stuck || b.kind === 'b') { const u = touching(b); if (u) { if (b.kind === 'b') { boom(b, 'norm'); continue; } if (!b.stuck || !b.stuck.u) stickUnit(b, u, b.pos); } }
      if (b.t >= b.fuse) { boom(b, 'norm'); continue; }
    } else if (b.t > b.fuse + 3) { remove(b); continue; } // (a copy whose owner never said: let it go)
    const m = b.mesh; m.position.copy(b.pos);
    if (b.stuck) { if (b.stuck.n) m.quaternion.setFromUnitVectors(UP, b.stuck.n.lengthSq() > 0.5 ? b.stuck.n : UP); if (m.userData.led) { const on = Math.sin(b.t * 12) > 0; m.userData.led.material = on ? LED : LED_OFF; } }
    else if (!b.rolling) { m.rotation.x += b.spin.x * dt; m.rotation.y += b.spin.y * dt; m.rotation.z += b.spin.z * dt; }
    else { const sp = Math.hypot(b.vel.x, b.vel.z); m.rotation.x += sp / 0.18 * dt; }
    if (b.kind === 'b' && Math.random() < dt * 30) V.emit('spark', m.localToWorld(new THREE.Vector3(0, 0.22, 0)), { speed: 1.5, size: 0.12 }); // (the fuse fizzes)
    if (b.kind === 'b' && b.fuse - b.t < 0.4 && m.userData.inner) m.userData.inner.scale.setScalar(1 + Math.sin(b.t * 60) * 0.08); }
}
function ultTick(b, dt) { const U = BOMB.ult, k = clamp01(b.t / b.fuse), m = b.mesh;
  // the beep: every second at first, faster and faster, a frantic chirp at the end; everyone hears it, louder the closer they are
  b.beepT -= dt; if (b.beepT <= 0) { b.beepT = 0.95 * Math.pow(1 - k, 1.4) + 0.085; S.bombBeep(b.pos, k); b.flash = 0.09; V.light(b.pos.clone().setY(b.pos.y + 0.7), '#ff2010', 2 + k * 3, 0.08, 8); }
  b.flash = Math.max(0, (b.flash || 0) - dt); m.userData.led.material = b.flash > 0 ? LED : LED_OFF; m.userData.glow.material.opacity = b.flash > 0 ? 0.8 : 0; m.userData.hand.rotation.y = -k * Math.PI * 2;
  const [ring, core, dz] = b.rings; ring.material.opacity = 0.35 + (b.flash > 0 ? 0.45 : 0) + k * 0.2; ring.scale.setScalar(Math.min(1, 0.1 + b.t * 2)); core.material.opacity = 0.08 + k * 0.14 + (b.flash > 0 ? 0.1 : 0);
  m.scale.setScalar(1 + (b.flash > 0 ? 0.04 : 0)); if (Math.random() < dt * 8) V.emit('spark', b.pos.clone().setY(b.pos.y + 0.62), { speed: 1.2, size: 0.1 });
  // defusing: an enemy standing on it for 3 s (counted on every machine for the bar; only the owner's machine decides)
  const on = ultFoes(b.owner).filter(u => u && !u.dead && u.pos && Math.hypot(u.pos.x - b.pos.x, u.pos.z - b.pos.z) < U.defuseR && Math.abs(u.pos.y - b.pos.y) < 2);
  if (on.length) b.defuse += dt; else b.defuse = Math.max(0, b.defuse - dt * 2);
  dz.material.opacity = b.defuse > 0 ? 0.5 : 0; dz.material.color.set(b.defuse > 0 ? '#60d0ff' : '#ff3020');
  const meOn = on.includes(G.player); if (meOn && G.hooks.castBar) { G.hooks.castBar('Defusing Big Bertha', b.defuse / U.defuse); b.defusing = true; } else if (b.defusing) { b.defusing = false; G.hooks.castBar && G.hooks.castBar(null); }
  if (b.ghost) { if (b.t > b.fuse + 3) remove(b); return; }
  if (b.defuse >= U.defuse) { defused(b, on[0]); net({ e: 'd', o: b.oi, id: b.id }); return; }
  if (b.t >= b.fuse) bigBoom(b);
}
// the Q slot shows how many sticky bombs are in hand
function bomberHud() { const P = G.player; if (!P || !P.h || P.h.cls !== 'bombardier' || !P.h.arena) return; const s = stickyCharges(P.h);
  { const k = (ABILITIES[P.h.cls] || []).findIndex(a => a.id === 'bo_stickies'); if (k >= 0 && P.cd) P.cd['a' + (k + 1)] = s.n <= 0 ? s.next : 0; } // (the slot's cooldown shows the wait for the next sticky bomb when none are left)
  const slot = [...document.querySelectorAll('#abil .slot.hb')].find(e => (e.title || '').startsWith('Sticky Bombs')); if (slot) { let c = slot.querySelector('.bchg'); if (!c) { c = document.createElement('b'); c.className = 'bchg'; c.style.cssText = 'position:absolute;top:2px;right:4px;font:700 14px Georgia,serif;color:#ffd060;text-shadow:0 1px 2px #000,0 0 4px #000;pointer-events:none;z-index:3'; slot.appendChild(c); } const t = String(s.n); if (c.textContent !== t) c.textContent = t; slot.classList.toggle('empty', s.n <= 0); } }

// ---------- online: copies of other machines' bombs ----------
const gk = (o, id) => o + ':' + id;
export function bombNet(d, U) {
  const key = gk(d.o, d.id), b = BX.list.find(x => x.ghost && x.key === key), p = d.p ? new THREE.Vector3(d.p[0], d.p[1], d.p[2]) : null;
  switch (d.e) {
    case 'n': { if (b) return; const owner = U(d.o) || { pos: p ? p.clone() : new THREE.Vector3(), team: -1 }; const nb = { id: d.id, key, ghost: true, kind: d.k, owner, oi: d.o, pos: p, vel: new THREE.Vector3(d.v[0], d.v[1], d.v[2]), dmg: 0, fuse: d.k === 'u' ? BOMB.ult.fuse : d.k === 's' ? BOMB.sticky.life : BOMB.throw.max, spin: new THREE.Vector3(8, 1, 2) };
      if (d.k === 'u') { nb.stuck = { u: null, n: UP.clone() }; nb.beepT = 0; nb.defuse = 0; add(nb); nb.rings = ultRings(BOMB.ult.r, BOMB.ult.core); for (const m of nb.rings) { m.position.set(p.x, p.y + 0.07, p.z); G.scene.add(m); } S.bombStick(p); } else add(nb); break; }
    case 's': { if (!b) return; if (p) b.pos.copy(p); const u = d.u >= 0 ? U(d.u) : null; if (u) { stickUnit(b, u, p); } else { b.stuck = { u: null, n: d.n ? new THREE.Vector3(d.n[0], d.n[1], d.n[2]) : UP.clone() }; b.vel.set(0, 0, 0); S.bombStick(b.pos); } break; }
    case 'x': { if (b) remove(b); if (p) { boomFx(p, d.b || 0); if (d.b === 2) bigBoomGhostMark(p); } break; }
    case 'r': if (b) fizzle(b); break;
    case 'd': if (b) defused(b, null); break;
  }
}
function bigBoomGhostMark(p) { const sc = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshBasicMaterial({ color: '#120804', transparent: true, opacity: 0.85, depthWrite: false })); sc.rotation.x = -Math.PI / 2; sc.position.set(p.x, p.y - 0.35, p.z); G.scene.add(sc); let t = 0; G.timers.push({ update: (dt) => { t += dt; sc.material.opacity = 0.85 * Math.max(0, 1 - t / 8); if (t > 8) { G.scene.remove(sc); return true; } return false; } }); }

// ---------- computer fighters ----------
// a launch velocity that lands on (or flies through) a point after a flight of T seconds
export function lobVel(from, to, T) { return new THREE.Vector3((to.x - from.x) / T, (to.y - from.y) / T + 0.5 * GRAV * T, (to.z - from.z) / T); }
export function nearestDanger(u) { // the closest enemy Big Bertha this fighter is inside of (for running away, or going to defuse it)
  let best = null, bd = 1e9; for (const b of BX.list) { if (b.kind !== 'u' || !b.owner || b.owner === u || (b.owner.team != null && b.owner.team === u.team)) continue; const d = Math.hypot(u.pos.x - b.pos.x, u.pos.z - b.pos.z); if (d < BOMB.ult.r + 2 && d < bd) { bd = d; best = { x: b.pos.x, z: b.pos.z, d, left: b.fuse - b.t, r: BOMB.ult.r }; } } return best; }
export function bombsNear(owner, foes) { // how many of this goblin's bombs would catch an enemy if they went off now
  let n = 0, st = 0; for (const b of BX.list) { if (b.owner !== owner || b.ghost || b.kind === 'u') continue; const r = b.kind === 's' ? BOMB.sticky.bigR : BOMB.throw.r; if (foes.some(u => u && !u.dead && Math.hypot(u.pos.x - b.pos.x, u.pos.z - b.pos.z) < r * 0.85)) { n++; if (b.kind === 's') st++; } } return { n, st }; }
// your own hero's left click (player.js calls this from the staff attack): the bomb leaves your fist in an arc
G.hooks.bombThrow = (p, from, dir, base) => { const T = BOMB.throw, v = dir.clone().multiplyScalar(T.speed); v.y += T.up; if (p.vel) v.addScaledVector(new THREE.Vector3(p.vel.x, 0, p.vel.z), 0.5); /* (a little of your run carries into the throw) */ return throwBomb(p, from, v, base * T.k); };
