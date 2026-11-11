// Class kits with their own physical effects, shared by players and computer fighters: Shadow Knight (Soul Rend, Grasp of
// the Grave, Shadow Chains), druid (Thorn Volley, Strangling Roots), shaman (Healing Wave geysers), cleric (Holy Smite: a
// sword of light falls from the sky), monk (phantom chi fists). The caller passes ctx.hit(u, dmgMul, o) (its own damage
// rules: weapon damage, perks, crits) and ctx.heal(n) / ultHeal for heals, so numbers stay in step with the rest of the kit.
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { heightAt } from './terrain.js';
import { solidAt } from './world.js';
import { ultFoes, ultFriends, ultHeal, ultGround } from './arena.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const glowM = (c, o = 0.8) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const timer = (fn) => { let t = 0; G.timers.push({ update: (dt) => { t += dt; return fn(t, dt); } }); };
const later = (s, fn) => timer((t) => { if (t >= s) { fn(); return true; } return false; });
const hgt = (u) => u === G.player ? (u.eye || 1.6) / 0.9 : (u.height || 1.8);
const chest = (u) => u.pos.clone().setY(u.pos.y + hgt(u) * 0.58);
const fwdOf = (u) => V3(Math.sin(u.yaw || 0), 0, Math.cos(u.yaw || 0));
const gy = (p) => { try { return ultGround(p); } catch (e) { return heightAt(p.x, p.z); } };
const kill = (...ms) => { for (const m of ms) { if (!m) continue; G.scene.remove(m); m.traverse && m.traverse(o => { if (o.isMesh || o.isSprite) { o.geometry && o.geometry.dispose(); if (o.material && !o.material.userData.keep) o.material.dispose(); } }); } };
const foes = (c) => ultFoes(c).filter(u => u !== c);
const friends = (c) => ultFriends(c);
let texCache = {};
function radTex(key, stops) { if (texCache[key]) return texCache[key]; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (texCache[key] = t); }
const glowSprite = (key, stops, s, add = true) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radTex(key, stops), transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })); sp.scale.setScalar(s); return sp; };

// ======================= SHADOW KNIGHT =======================
// Soul Rend (F): his recorded charged slash; a smoking black-violet wake follows the blade, and every enemy it cuts has
// a crimson soul torn out of their chest that streaks back into his and heals him
export const SOULREND = { r: 5.2, ang: 1.1, hitAt: 0.4, drain: 0.6 };
export function soulRend(c, ctx) {
  const T = SOULREND, me = c === G.player; S.heavyWhoosh && S.heavyWhoosh(c.pos); S.cast && S.cast('shadow', c.pos, 0.5);
  // the wake of the blade: a crescent of shadow swept right to left as the blow comes across, in black smoke with a violet edge
  later(T.hitAt - 0.12, () => { if (c.dead) return; const y0 = c.pos.y + hgt(c) * 0.5, yaw = c.yaw || 0, seg = 16, g = new THREE.Group(); G.scene.add(g);
    const dark = new THREE.MeshBasicMaterial({ color: '#12001e', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }), edge = glowM('#b45aff', 0.95), core = glowM('#e8b0ff', 0.9); const parts = [];
    for (let i = 0; i < seg; i++) { const a0 = T.ang - (i / seg) * T.ang * 2, a1 = T.ang - ((i + 1) / seg) * T.ang * 2;
      for (const [r0, r1, m, dy] of [[2.4, T.r, dark, 0], [T.r - 0.45, T.r, edge, 0.01], [T.r - 0.12, T.r + 0.05, core, 0.02]]) { const geo = new THREE.RingGeometry(r0, r1, 3, 1, a1 - Math.PI / 2, a0 - a1 + 0.02); const mm = new THREE.Mesh(geo, m); mm.rotation.x = -Math.PI / 2; mm.position.y = dy - i * 0.035; mm.visible = false; g.add(mm); parts.push([mm, i]); } }
    g.position.set(c.pos.x, y0, c.pos.z); g.rotation.y = yaw; g.rotation.z = 0.12;
    timer((t) => { const show = Math.min(seg, Math.floor(t / 0.11 * seg)); for (const [m, i] of parts) { m.visible = i < show; const age = t - i / seg * 0.11; m.scale.setScalar(1 + Math.max(0, age) * 0.25); }
      const k = Math.max(0, 1 - Math.max(0, t - 0.12) / 0.38); dark.opacity = 0.4 * k; edge.opacity = 0.95 * k; core.opacity = 0.9 * k;
      if (t < 0.15) for (let j = 0; j < 2; j++) { const a = yaw + T.ang - Math.random() * T.ang * 2 * Math.min(1, t / 0.11), r = 2 + Math.random() * (T.r - 2); const p = V3(c.pos.x + Math.sin(a) * r, y0 - 0.2 + Math.random() * 0.4, c.pos.z + Math.cos(a) * r); V.emit('shadow', p, { speed: 0.8, vy: 0.6, size: 0.45, size1: 0.9, life: 0.6, grav: -0.5, a0: 0.45 }); if (Math.random() < 0.5) V.emit('void', p, { speed: 2, size: 0.25, life: 0.4, normal: true }); }
      if (t > 0.55) { kill(g); return true; } return false; }); });
  later(T.hitAt, () => { if (c.dead) return; const f = fwdOf(c); let n = 0;
    for (const u of foes(c)) { const dx = u.pos.x - c.pos.x, dz = u.pos.z - c.pos.z, d = Math.hypot(dx, dz); if (d > T.r + 0.6) continue; const da = Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / (d || 1)))); if (d > 1.2 && da > T.ang + 0.15) continue;
      const dealt = ctx.hit(u, ctx.dmg, { melee: true }) || 0; n++; const cp = chest(u); V.burst('blood', cp, 18, { speed: 5 }); V.burst('void', cp, 14, { normal: true, speed: 3, size: 0.4 }); S.hit && S.hit('flesh', cp, 1.1);
      soulWisp(u, c, () => { const amt = dealt * T.drain; if (amt > 0) ctx.heal(amt); }); }
    if (n) { V.addShake(me ? 0.35 : 0.15); if (me) G.hitstop = Math.max(G.hitstop || 0, 0.08); S.soulRip && S.soulRip(c.pos); } });
}
// a ghostly crimson soul: pulled up out of the victim, it hangs a moment, then streaks along a curve into the caster
function soulWisp(from, to, onArrive) { const sp = glowSprite('soul', [[0, 'rgba(255,240,240,1)'], [0.25, 'rgba(255,60,90,0.9)'], [0.6, 'rgba(120,0,60,0.5)'], [1, 'rgba(40,0,30,0)']], 0.9); const halo = glowSprite('soulh', [[0, 'rgba(200,80,255,0.5)'], [1, 'rgba(60,0,90,0)']], 2.2); G.scene.add(sp, halo);
  const p0 = chest(from), side = V3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3); let arrived = false;
  timer((t) => { let p; if (t < 0.28) { const k = t / 0.28; p = p0.clone().setY(p0.y + k * 0.9); p.x += Math.sin(t * 40) * 0.08 * (1 - k); sp.scale.setScalar(0.4 + k * 0.6); }
    else { const k = Math.min(1, (t - 0.28) / 0.42), e = k * k, a = p0.clone().setY(p0.y + 0.9), b = chest(to), mid = a.clone().lerp(b, 0.5).add(side).setY(Math.max(a.y, b.y) + 1.4); p = a.clone().multiplyScalar((1 - e) * (1 - e)).add(mid.multiplyScalar(2 * (1 - e) * e)).add(b.multiplyScalar(e * e)); if (k >= 1 && !arrived) { arrived = true; onArrive(); V.burst('blood', b, 12, { speed: 2 }); V.burst('void', b, 20, { normal: true, speed: 2.5, size: 0.35 }); V.light(b, '#ff3060', 4, 0.3, 8); } }
    sp.position.copy(p); halo.position.copy(p); halo.material.opacity = 0.6 + Math.sin(t * 30) * 0.2; V.emit('blood', p, { speed: 0.3, size: 0.28, life: 0.35, grav: 0 }); if (Math.random() < 0.6) V.emit('void', p, { normal: true, speed: 0.3, size: 0.35, size1: 0.05, life: 0.5, grav: -0.3 });
    if (arrived || from.dead && t < 0.28) { kill(sp, halo); return true; } return false; }); }

// Shadow Chains (right click): he flings a real chain of black iron from his off hand. Its hook bites the first enemy in its
// path: they are yanked toward him, slowed, and stay chained to him for 3 s (a little of their life runs back along it)
// unless they get more than 16 m away and it snaps
export const CHAINS = { range: 21, speed: 46, tether: 3, snap: 16, yank: 7, tick: 0.12, every: 1 };
const linkGeo = new THREE.TorusGeometry(0.17, 0.05, 6, 12);
let linkMat = null, hookMat = null;
export function shadowChains(c, ctx) {
  const T = CHAINS; if (!linkMat) { linkMat = new THREE.MeshStandardMaterial({ color: '#2c2734', metalness: 0.9, roughness: 0.35, emissive: '#5a14b0', emissiveIntensity: 0.7 }); linkMat.userData.keep = true; hookMat = new THREE.MeshStandardMaterial({ color: '#3a3044', metalness: 0.9, roughness: 0.3, emissive: '#8a30ff', emissiveIntensity: 1.1 }); hookMat.userData.keep = true; }
  const N = 46, g = new THREE.Group(), links = []; for (let i = 0; i < N; i++) { const m = new THREE.Mesh(linkGeo, linkMat); g.add(m); links.push(m); }
  const hook = new THREE.Group(); const sh = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 6), hookMat); sh.rotation.x = Math.PI / 2; hook.add(sh); for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 5, 10, Math.PI * 0.9), hookMat); b.position.set(s * 0.12, 0, -0.12); b.rotation.set(0, s * Math.PI / 2, 0); hook.add(b); }
  const glow = glowSprite('chainglow', [[0, 'rgba(230,180,255,0.9)'], [0.4, 'rgba(140,50,255,0.45)'], [1, 'rgba(40,0,90,0)']], 1.2); hook.add(glow); g.add(hook); G.scene.add(g);
  const dir = ctx.dir.clone(); dir.y = Math.max(-0.3, Math.min(0.3, dir.y)); dir.normalize(); const head = ctx.from().clone(); let d = 0, state = 'out', victim = null, tt = 0, tick = 0, back = 0, sagK = 1, snapT = 0, lastHead = head.clone();
  S.chainThrow && S.chainThrow(c.pos);
  const lay = (a, b, sag, jit) => { const L = a.distanceTo(b), n = Math.max(2, Math.min(N, Math.round(L / 0.26))); const q = new THREE.Quaternion(), up = V3(0, 1, 0); const dirv = b.clone().sub(a).normalize();
    for (let i = 0; i < N; i++) { const m = links[i]; if (i >= n) { m.visible = false; continue; } m.visible = true; const s = i / (n - 1); const p = a.clone().lerp(b, s); p.y -= Math.sin(s * Math.PI) * sag * L * 0.06; if (jit) { p.x += (Math.random() - 0.5) * jit; p.y += (Math.random() - 0.5) * jit; p.z += (Math.random() - 0.5) * jit; } m.position.copy(p); q.setFromUnitVectors(up, dirv); m.quaternion.copy(q); m.rotateY(i % 2 ? Math.PI / 2 : 0); m.rotateX(Math.PI / 2); } };
  timer((t, dt) => { const hand = ctx.from(); if (c.dead) state = 'done';
    if (state === 'out') { const step = T.speed * dt; head.addScaledVector(dir, step); d += step; hook.position.copy(head); hook.lookAt(head.clone().add(dir)); lay(hand, head, 0.4 * Math.min(1, d / 6), 0); if (Math.random() < 0.7) V.emit('void', head, { normal: true, speed: 0.4, size: 0.3, life: 0.35 });
      for (const u of foes(c)) { const cp = u.pos; const hh = hgt(u); if (Math.hypot(cp.x - head.x, cp.z - head.z) < 0.85 + (u.radius || 0.4) * 0.5 && head.y > cp.y - 0.3 && head.y < cp.y + hh + 0.3) { victim = u; break; } }
      if (victim) { state = 'tether'; tt = 0; const cp = chest(victim); ctx.hit(victim, ctx.dmg, { slow: ctx.slow || 3, knock: c.pos.clone().sub(victim.pos).setY(0).normalize().multiplyScalar(T.yank) }); S.chainLatch && S.chainLatch(cp); V.burst('spark', cp, 18, { speed: 6 }); V.burst('void', cp, 26, { normal: true, speed: 4, size: 0.45 }); V.light(cp, '#9a40ff', 6, 0.3, 10); V.addShake(c === G.player ? 0.3 : 0.1); if (c === G.player) G.hitstop = Math.max(G.hitstop || 0, 0.06); }
      else if (d > T.range || solidAt(head.x, head.y, head.z) || head.y < gy(head) - 0.1) { state = 'back'; back = 0; lastHead = head.clone(); if (d <= T.range) { V.burst('spark', head, 14, { speed: 4 }); S.hit && S.hit('stone', head, 0.6); } } }
    else if (state === 'tether') { tt += dt; tick += dt; const cp = chest(victim); hook.position.copy(cp); hook.lookAt(cp.clone().add(cp.clone().sub(hand).normalize())); const L = hand.distanceTo(cp); sagK = Math.max(0.05, 0.6 - tt * 0.6);
      lay(hand, cp, L > 8 ? 0.05 : sagK, 0.015); if (Math.random() < 0.5) { const s = Math.random(); V.emit('void', hand.clone().lerp(cp, s), { normal: true, speed: 0.4, size: 0.22, life: 0.4 }); }
      if (tick >= T.every) { tick = 0; const dealt = ctx.hit(victim, T.tick, { slow: 1.1, silent: true }) || 0; if (dealt > 0) ctx.heal(dealt); soulWisp(victim, c, () => {}); }
      if (victim.dead || tt > T.tether || Math.hypot(victim.pos.x - c.pos.x, victim.pos.z - c.pos.z) > T.snap) { state = 'snap'; snapT = 0; S.chainSnap && S.chainSnap(cp); V.burst('spark', cp, 10, { speed: 3 }); for (const m of links) m.userData.v = V3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2); } }
    else if (state === 'back') { back += dt / 0.22; const p = lastHead.clone().lerp(hand, Math.min(1, back)); hook.position.copy(p); lay(hand, p, 0.6, 0); if (back >= 1) state = 'done'; }
    else if (state === 'snap') { snapT += dt; for (const m of links) { if (!m.visible) continue; m.userData.v.y -= 14 * dt; m.position.addScaledVector(m.userData.v, dt); m.rotation.x += dt * 6; } hook.position.y -= dt * 4; linkMat.emissiveIntensity = 0.7; g.traverse(o => { if (o.isMesh) o.scale.setScalar(Math.max(0.01, 1 - snapT / 0.5)); }); if (snapT > 0.5) state = 'done'; }
    if (state === 'done') { G.scene.remove(g); hook.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); glow.material.dispose(); return true; } return false; });
}

// Grasp of the Grave (Q): he drives his greatsword point-first into the ground. A crack of shadow tears out 10 m ahead and
// skeletal hands claw up out of it; whoever stands on the crack is seized by the ankles, hurt and held fast
export const GRAVE = { len: 10, w: 1.6, at: 0.3, dur: 0.45, hold: 1.2 };
const boneMat = () => new THREE.MeshStandardMaterial({ color: '#ddd2b4', roughness: 0.75, emissive: '#2a0a40', emissiveIntensity: 0.4 });
function boneHand(s = 1) { const g = new THREE.Group(), m = boneMat(), fingers = []; const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6), m); arm.position.y = -0.55; g.add(arm); const arm2 = arm.clone(); arm2.position.x = 0.07; arm2.scale.set(0.7, 1, 0.7); g.add(arm2);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.32), m); palm.position.y = 0.05; g.add(palm);
  for (let i = 0; i < 5; i++) { const thumb = i === 4, f0 = new THREE.Group(); f0.position.set(thumb ? 0.2 : -0.13 + i * 0.087, 0.08, thumb ? -0.05 : 0.15); if (thumb) f0.rotation.y = -1.2; g.add(f0); const segs = []; let par = f0;
    for (let k = 0; k < (thumb ? 2 : 3); k++) { const L = (thumb ? 0.16 : 0.17 - k * 0.03); const sg = new THREE.Group(); const bn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, L, 5), m); bn.position.y = L / 2; bn.rotation.x = 0; sg.add(bn); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 4), m); sg.add(kn); par.add(sg); if (k) sg.position.y = (thumb ? 0.16 : 0.17 - (k - 1) * 0.03); segs.push(sg); par = sg; }
    fingers.push(segs); }
  g.userData.curl = (k) => { for (const segs of fingers) segs.forEach((sg, i) => { sg.rotation.x = 0.35 - k * (i ? 1.25 : 1.0); }); g.children[2].rotation.x = 0; }; g.userData.mat = m; g.scale.setScalar(s); return g; }
export function graveGrasp(c, ctx) {
  const T = GRAVE, f = fwdOf(c), side = V3(f.z, 0, -f.x), O = c.pos.clone().addScaledVector(f, 1.6); O.y = gy(O);
  later(T.at, () => { if (c.dead) return; S.graveCrack && S.graveCrack(O); V.burst('stone', O.clone().setY(O.y + 0.3), 24, { speed: 6, grav: 14 }); V.burst('void', O.clone().setY(O.y + 0.4), 30, { normal: true, speed: 4, size: 0.5 }); V.light(O.clone().setY(O.y + 1), '#8a30ff', 7, 0.4, 12); V.addShake(c === G.player ? 0.45 : 0.15);
    const parts = [], hands = [], done = new Set(); let made = 0, prev = O.clone(), t0 = 0;
    const crackM = (col, op) => col === 'dark' ? new THREE.MeshBasicMaterial({ color: '#0c0014', transparent: true, opacity: op, depthWrite: false }) : glowM(col, op);
    const seg = (a, b, w, col, op, y) => { const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) + 0.1, m = new THREE.Mesh(new THREE.PlaneGeometry(w, L), crackM(col, op)); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, Math.atan2(dx, dz), 0); m.position.set((a.x + b.x) / 2, Math.max(a.y, b.y) + y, (a.z + b.z) / 2); m.renderOrder = 3; G.scene.add(m); parts.push([m, op]); };
    const rise = (p, s, grab) => { const h = boneHand(s); h.position.copy(p).setY(p.y - 1.4 * s); h.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 6.28, (Math.random() - 0.5) * 0.4); h.userData.curl(0); G.scene.add(h); hands.push({ h, born: t0, p: p.clone(), s, grab }); S.boneClack && S.boneClack(p, grab ? 1 : 0.5); V.burst('dust', p.clone().setY(p.y + 0.2), 10, { speed: 3 }); V.burst('bone', p.clone().setY(p.y + 0.3), 6, { speed: 3 }); };
    const N = Math.round(T.len / 0.9); let jag = 0, tEnd = -1;
    timer((t, dt) => { t0 = t; const want = Math.min(N, Math.floor(t / T.dur * N));
      while (made < want) { made++; jag = Math.max(-0.4, Math.min(0.4, jag + (Math.random() - 0.5) * 0.5)); const p = O.clone().addScaledVector(f, made * 0.9).addScaledVector(side, jag); p.y = gy(p); seg(prev, p, 2.0, 'dark', 0.85, 0.03); seg(prev, p, 0.7, '#8a30ff', 0.8, 0.05); seg(prev, p, 0.16, '#f0c8ff', 1, 0.07);
        if (made % 2 === 0) rise(p.clone().addScaledVector(side, (Math.random() - 0.5) * 1.4), 2.2 + Math.random() * 0.6, false); if (made % 3 === 1) V.burst('void', p.clone().setY(p.y + 0.3), 10, { normal: true, speed: 0.6, vy: 4, size: 0.6, size1: 0.1, life: 0.7, grav: -1 }); V.emit('void', p.clone().setY(p.y + 0.2), { normal: true, speed: 1, vy: 3, size: 0.5, life: 0.6 }); prev = p;
        for (const u of foes(c)) { if (done.has(u)) continue; const dx = u.pos.x - O.x, dz = u.pos.z - O.z, along = dx * f.x + dz * f.z, lat = Math.abs(dx * side.x + dz * side.z); if (along < -0.8 || along > made * 0.9 + 0.5 || lat > T.w) continue; done.add(u);
          ctx.hit(u, ctx.dmg, { root: ctx.root || T.hold, slow: 0 }); rise(u.pos.clone().setY(gy(u.pos)), 3.4, u); V.burst('blood', chest(u), 10, { speed: 3 }); V.light(u.pos.clone().setY(u.pos.y + 1), '#a040ff', 5, 0.3, 9); } }
      if (made >= N && tEnd < 0) tEnd = t;
      for (const H of hands) { const a = t - H.born, life = H.grab ? T.hold + 0.5 : 1.0, up = Math.min(1, a / 0.16), down = Math.max(0, (a - life) / 0.3);
        H.h.position.y = H.p.y - 1.4 * H.s * (1 - up) - 1.6 * H.s * down + (H.grab ? 0.15 * H.s : 0); H.h.userData.curl(Math.min(1, Math.max(0, (a - 0.14) / 0.18)) * (H.grab ? 1 : 0.85)); if (H.grab && !H.grab.dead && down === 0) { H.h.position.x = H.grab.pos.x; H.h.position.z = H.grab.pos.z; } }
      const k = tEnd < 0 ? 1 : Math.max(0, 1 - Math.max(0, t - tEnd - 0.9) / 0.6); for (const [m, op] of parts) m.material.opacity = op * k * (m.material.blending === THREE.AdditiveBlending ? 0.8 + Math.sin(t * 16 + m.position.x) * 0.2 : 1);
      if (tEnd >= 0 && t > tEnd + T.hold + 1.0) { for (const [m] of parts) kill(m); for (const H of hands) { H.h.userData.mat.dispose(); kill(H.h); } return true; } return false; }); });
}

// ======================= DRUID =======================
// Thorn Volley (C): a fan of five real thorns, each as long as a forearm, flies out of the staff. They stick in whoever they
// hit (and stay there a moment) or in the ground; every thorn hurts and slows
export const THORNS = { n: 5, spread: 0.075, speed: 34, range: 17, per: 0.5 };
let thornM = null;
function thornMesh() { if (!thornM) { thornM = [new THREE.MeshStandardMaterial({ color: '#6a4424', roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: '#5aa83a', roughness: 0.7, side: THREE.DoubleSide, emissive: '#1a4a08', emissiveIntensity: 0.4 })]; thornM.forEach(m => { m.userData.keep = true; }); }
  const g = new THREE.Group(); const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.95, 6), thornM[0]); sp.rotation.x = Math.PI / 2; g.add(sp); for (const r of [0, Math.PI / 2]) { const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.3), thornM[1]); lf.position.z = -0.42; lf.rotation.z = r; g.add(lf); } return g; }
export function thornVolley(c, ctx) {
  const T = THORNS, from = ctx.from().clone(), dir0 = ctx.dir.clone(); dir0.y = Math.max(-0.25, Math.min(0.25, dir0.y)); dir0.normalize(); const per = new Map(); S.thornVolley && S.thornVolley(c.pos); V.burst('leaf', from, 16, { speed: 4 });
  for (let i = 0; i < T.n; i++) { const dir = dir0.clone().applyAxisAngle(V3(0, 1, 0), (i - (T.n - 1) / 2) * T.spread); dir.y += (Math.random() - 0.5) * 0.04; const m = thornMesh(); m.scale.setScalar(1.9); m.position.copy(from); G.scene.add(m); let d = 0, stuck = null, st = 0, off = null, vy = 0;
    later(i * 0.025, () => timer((t, dt) => { if (!stuck) { const step = T.speed * dt; vy -= 2.5 * dt; const v = dir.clone().multiplyScalar(T.speed).setY(dir.y * T.speed + vy); m.position.addScaledVector(v, dt); d += step; m.lookAt(m.position.clone().add(v)); if (Math.random() < 0.5) V.emit('leaf', m.position, { speed: 0.3, size: 0.18, life: 0.4 });
        for (const u of foes(c)) { const hh = hgt(u); if (Math.hypot(u.pos.x - m.position.x, u.pos.z - m.position.z) < 0.7 + (u.radius || 0.4) * 0.5 && m.position.y > u.pos.y - 0.2 && m.position.y < u.pos.y + hh + 0.2) { const k = per.get(u) || 0; per.set(u, k + 1); ctx.hit(u, ctx.dmg * T.per * (k ? 0.55 : 1), { slow: ctx.slow || 2.5, ranged: true, silent: k > 0 }); stuck = u; off = m.position.clone().sub(u.pos); off.y = Math.min(off.y, hh * 0.8); S.thornThunk && S.thornThunk(m.position); V.burst('blood', m.position, 6, { speed: 2 }); V.burst('leaf', m.position, 6, { speed: 2 }); break; } }
        if (!stuck && (m.position.y < gy(m.position) + 0.05 || solidAt(m.position.x, m.position.y, m.position.z))) { stuck = 'ground'; m.position.addScaledVector(v.clone().normalize(), 0.3); V.burst('dust', m.position, 6, { speed: 2 }); S.thornThunk && S.thornThunk(m.position); }
        if (!stuck && d > T.range) { kill(m); return true; } return false; }
      st += dt; if (stuck !== 'ground' && stuck && !stuck.dead) m.position.copy(stuck.pos).add(off); if (st > 1.4) m.scale.setScalar(1.9 * Math.max(0.01, 1 - (st - 1.4) / 0.3)); if (st > 1.7) { m.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); G.scene.remove(m); return true; } return false; })); }
}

// Strangling Roots (Q): a root burrows under the ground toward where he aims, throwing up a furrow of earth, and bursts up at
// the end: thick thorned vines coil up round every enemy within 3.5 m, rooting them in place, then slowing them as they wither
export const ROOTS = { range: 16, r: 3.5, speed: 30 };
class Helix extends THREE.Curve { constructor(r, h, turns, a0) { super(); this.r = r; this.h = h; this.turns = turns; this.a0 = a0; } getPoint(t, o = new THREE.Vector3()) { const a = this.a0 + t * this.turns * Math.PI * 2, r = this.r * (1.25 - 0.55 * t); return o.set(Math.cos(a) * r, t * this.h - 0.2, Math.sin(a) * r); } }
let vineM = null;
export function strangleRoots(c, ctx) {
  const T = ROOTS, A0 = c.pos.clone(), at = ctx.at.clone(), dd = V3(at.x - A0.x, 0, at.z - A0.z); if (dd.length() > T.range) at.copy(A0).addScaledVector(dd.normalize(), T.range); else if (dd.length() < 2) at.copy(A0).addScaledVector(fwdOf(c), 6); at.y = gy(at);
  if (!vineM) { vineM = new THREE.MeshStandardMaterial({ color: '#4a5a22', roughness: 0.85, emissive: '#1a3008', emissiveIntensity: 0.35 }); vineM.userData.keep = true; }
  A0.addScaledVector(V3(at.x - A0.x, 0, at.z - A0.z).normalize(), 1.4); const L = Math.hypot(at.x - A0.x, at.z - A0.z), dur = Math.max(0.2, L / T.speed), mounds = []; S.rootBurrow && S.rootBurrow(c.pos, dur); let em = 0, erupted = false;
  timer((t, dt) => { const k = Math.min(1, t / dur), p = A0.clone().lerp(at, k); p.y = gy(p); em -= dt;
    if (k < 1 && em <= 0) { em = 0.018; V.burst('dust', p.clone().setY(p.y + 0.15), 4, { speed: 2.5, vy: 2 }); V.burst('wood', p.clone().setY(p.y + 0.1), 2, { speed: 2.5, vy: 3 }); const mo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a3a24', roughness: 1 })); mo.scale.set(0.9, 0.5, 2.0); mo.rotation.y = Math.atan2(at.x - A0.x, at.z - A0.z); mo.position.copy(p); G.scene.add(mo); mounds.push([mo, t]); }
    for (const [mo, b] of mounds) { const a = t - b; mo.scale.y = 0.5 * Math.max(0.01, 1 - Math.max(0, a - 0.3) / 0.5); }
    if (k >= 1 && !erupted) { erupted = true; rootsErupt(c, ctx, at); }
    if (t > dur + 1.2) { for (const [mo] of mounds) kill(mo); return true; } return false; });
}
function rootsErupt(c, ctx, at) {
  const T = ROOTS; S.rootSnare && S.rootSnare(at); V.burst('dust', at.clone().setY(at.y + 0.3), 30, { speed: 5 }); V.burst('leaf', at.clone().setY(at.y + 0.6), 30, { speed: 5, vy: 2 }); V.burst('wood', at.clone().setY(at.y + 0.4), 16, { speed: 5, grav: 12 }); V.light(at.clone().setY(at.y + 1), '#9ae060', 5, 0.35, 10); V.addShake(c === G.player ? 0.25 : 0.1);
  const caught = foes(c).filter(u => Math.hypot(u.pos.x - at.x, u.pos.z - at.z) < T.r), spots = caught.length ? caught : [null];
  const hold = ctx.root || 1.5;
  for (const u of spots) { if (u) ctx.hit(u, ctx.dmg, { root: hold, slow: ctx.slow || 3.5 }); const base = u ? u.pos.clone() : at.clone(), hh = u ? hgt(u) : 2.2, vines = [];
    for (let i = 0; i < 4; i++) { const cur = new Helix(u ? 0.55 + (u.radius || 0.3) * 0.5 : 0.4 + i * 0.15, hh * (u ? 0.85 : 0.9), 1.6 + i * 0.25, i * Math.PI / 2), geo = new THREE.TubeGeometry(cur, 48, 0.13 - i * 0.012, 6, false), m = new THREE.Mesh(geo, vineM); geo.setDrawRange(0, 0); G.scene.add(m);
      for (let j = 0; j < 6; j++) { const th = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 4), vineM), q = cur.getPoint(0.15 + j * 0.13); th.position.copy(q).multiplyScalar(1.12); th.lookAt(q.clone().multiplyScalar(3)); th.rotateX(Math.PI / 2); th.visible = false; th.userData.s = 0.15 + j * 0.13; m.add(th); }
      vines.push(m); }
    const total = vines[0].geometry.index.count; const life = u ? hold + 0.4 : 0.9;
    timer((t) => { const grow = Math.min(1, t / 0.28), wither = Math.max(0, (t - life) / 0.45); const p = u && !u.dead && wither === 0 ? u.pos : base;
      for (const m of vines) { m.position.set(p.x, gy(p), p.z); m.geometry.setDrawRange(0, Math.floor(grow * m.geometry.index.count)); m.children.forEach(th => { th.visible = th.userData.s < grow; }); m.scale.set(1 + wither * 0.4, Math.max(0.01, 1 - wither), 1 + wither * 0.4); m.rotation.y = Math.sin(t * 3) * 0.05 * (1 - grow); }
      if (wither > 0 && Math.random() < 0.4) V.emit('leaf', p.clone().setY(p.y + 0.5 + Math.random()), { speed: 0.8, size: 0.25, life: 0.8 });
      if (wither >= 1) { for (const m of vines) { m.geometry.dispose(); m.children.forEach(th => th.geometry.dispose()); G.scene.remove(m); } return true; } return false; }); void total; }
}

// ======================= SHAMAN =======================
// Healing Wave: a column of water bursts up out of the ground under the shaman and under every ally it heals
let waterTex = null;
function waterStreaks() { if (waterTex) return waterTex; const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 26; i++) { const px = Math.random() * 64, w = 2 + Math.random() * 5, y0 = Math.random() * 128, h = 20 + Math.random() * 60, g = x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, 'rgba(180,235,255,0)'); g.addColorStop(0.5, `rgba(${200 + (Math.random() * 55) | 0},245,255,${0.5 + Math.random() * 0.5})`); g.addColorStop(1, 'rgba(180,235,255,0)'); x.fillStyle = g; x.fillRect(px, y0, w, h); x.fillRect(px, y0 - 128, w, h); }
  waterTex = new THREE.CanvasTexture(c); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; return waterTex; }
export function geyser(u, delay = 0) { later(delay, () => { if (u.dead) return; const p = u.pos.clone(); p.y = gy(p); const hh = hgt(u) * 1.35, tex = waterStreaks().clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 1, 16, 1, true), new THREE.MeshBasicMaterial({ map: tex, color: '#4aa8e8', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 1, 12, 1, true), new THREE.MeshBasicMaterial({ map: tex, color: '#9ad8ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  G.scene.add(col, inner); S.geyser && S.geyser(p, u === G.player ? 1 : 0.7); V.light(p.clone().setY(p.y + 1.5), '#60c8ff', 5, 0.5, 10);
  timer((t, dt) => { const up = Math.min(1, t / 0.18), fall = Math.max(0, (t - 0.55) / 0.4), h = hh * up * (1 - fall * 0.85); const q = u.dead ? p : u.pos; for (const m of [col, inner]) { m.scale.set(1 + fall * 0.6, Math.max(0.01, h), 1 + fall * 0.6); m.position.set(q.x, gy(q) + h / 2, q.z); m.material.opacity = (m === col ? 0.85 : 0.55) * (1 - fall); m.material.map.offset.y -= dt * 3.2; } inner.rotation.y += dt * 4;
    if (t < 0.7) { V.emit('water', V3(q.x, gy(q) + h, q.z), { n: 2, speed: 3.2, vy: 2.5, size: 0.22, life: 0.8, grav: 12, normal: true }); if (Math.random() < 0.6) V.emit('water', V3(q.x + (Math.random() - 0.5) * 1.4, gy(q) + 0.1, q.z + (Math.random() - 0.5) * 1.4), { speed: 2, vy: 1.5, size: 0.25, life: 0.5, grav: 9 }); }
    if (t > 0.98) { kill(col, inner); tex.dispose(); return true; } return false; }); }); }
export function healGeysers(c, r = 12) { geyser(c, 0); let i = 0; for (const u of friends(c)) if (u !== c && Math.hypot(u.pos.x - c.pos.x, u.pos.z - c.pos.z) < r) geyser(u, 0.08 + 0.06 * i++); }

// ======================= CLERIC =======================
// Holy Smite (Q): a great sword of light forms in the sky over the enemy (a burning sigil on the ground beneath warns them),
// then drives point-first into the ground: everyone within 2.4 m is hurt and briefly stunned; the blade stands there and burns away
export const SMITE = { warn: 0.38, r: 2.4, h: 9 };
let sigilTex = null;
function sigil() { if (sigilTex) return sigilTex; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), m = 64; x.translate(m, m); x.strokeStyle = 'rgba(255,230,150,1)'; x.lineWidth = 4; x.shadowColor = 'rgba(255,200,80,1)'; x.shadowBlur = 8;
  for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * Math.PI / 4); x.beginPath(); x.moveTo(0, 10); x.lineTo(i % 2 ? 0 : 0, i % 2 ? 40 : 58); x.stroke(); x.restore(); } x.lineWidth = 6; x.beginPath(); x.moveTo(-6, -34); x.lineTo(6, -34); x.lineTo(6, -6); x.lineTo(30, -6); x.lineTo(30, 6); x.lineTo(6, 6); x.lineTo(6, 40); x.lineTo(-6, 40); x.lineTo(-6, 6); x.lineTo(-30, 6); x.lineTo(-30, -6); x.lineTo(-6, -6); x.closePath(); x.stroke();
  sigilTex = new THREE.CanvasTexture(c); sigilTex.colorSpace = THREE.SRGBColorSpace; return sigilTex; }
function lightSword() { const g = new THREE.Group(), core = glowM('#fffbe8', 0.95), aura = glowM('#ffc840', 0.45); const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.32, 3.4, 4), core); blade.scale.z = 0.25; blade.position.y = -1.7; blade.rotation.y = Math.PI / 4; g.add(blade); const bl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.55, 3.6, 4), aura); bl2.scale.z = 0.35; bl2.position.y = -1.75; bl2.rotation.y = Math.PI / 4; g.add(bl2);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.18), core); g.add(guard); const gd2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 0.3), aura); g.add(gd2); const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6), core); grip.position.y = 0.42; g.add(grip); const pom = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), core); pom.position.y = 0.85; g.add(pom); return g; }
export function holySmite(c, ctx) {
  const T = SMITE, at = ctx.at.clone(); at.y = gy(at); const base = at.y; const sig = new THREE.Mesh(new THREE.PlaneGeometry(T.r * 2.2, T.r * 2.2), new THREE.MeshBasicMaterial({ map: sigil(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe8a0' })); sig.rotation.x = -Math.PI / 2; sig.position.set(at.x, base + 0.06, at.z); G.scene.add(sig);
  const sw = lightSword(); sw.position.set(at.x, base + T.h, at.z); sw.rotation.y = c.yaw || 0; sw.scale.setScalar(0.01); G.scene.add(sw); const halo = glowSprite('smite', [[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,210,100,0.6)'], [1, 'rgba(255,160,40,0)']], 4); halo.position.copy(sw.position); G.scene.add(halo);
  S.smiteFall && S.smiteFall(at); let hit = false, cracks = [];
  timer((t, dt) => { const form = Math.min(1, t / 0.2); sig.material.opacity = Math.min(1, t / 0.15) * (hit ? Math.max(0, 1 - (t - T.warn) / 1.1) : 0.9); sig.rotation.z += dt * (hit ? 0.5 : 2.5);
    if (!hit) { sw.scale.setScalar(form * 1.35); const fall = Math.max(0, (t - T.warn + 0.12) / 0.12), y = base + 3.4 * 1.35 * 0.95 + (T.h - 3.3) * (1 - Math.min(1, fall * fall)); sw.position.y = fall > 0 ? y : base + T.h + Math.sin(t * 20) * 0.05; halo.position.copy(sw.position); if (Math.random() < 0.8) V.emit('gold', sw.position.clone().setY(sw.position.y - Math.random() * 4), { speed: 0.6, size: 0.3, life: 0.4 }); }
    if (!hit && t >= T.warn) { hit = true; sw.position.y = base + 3.4 * 1.35 * 0.8; const P2 = at.clone().setY(base + 0.3); V.burst('gold', P2, 70, { speed: 9, vy: 3 }); V.burst('spark', P2, 40, { speed: 11 }); V.burst('stone', P2, 24, { speed: 6, grav: 14 }); V.burst('dust', P2, 20, { speed: 5 }); V.light(at.clone().setY(base + 2), '#ffe090', 12, 0.5, 18); V.sphereFlash(P2, 1.2, '#fff4c0', 0.18); V.addShake(c === G.player ? 0.5 : 0.25); S.smiteHit && S.smiteHit(at);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + Math.random() * 0.4, L = 1.4 + Math.random() * 1.6, m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, L), glowM('#ffe8a0', 0.95)); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, a, 0); m.position.set(at.x + Math.sin(a) * L / 2, base + 0.07, at.z + Math.cos(a) * L / 2); G.scene.add(m); cracks.push(m); }
      let n = 0; for (const u of foes(c)) if (Math.hypot(u.pos.x - at.x, u.pos.z - at.z) < T.r + (u.radius || 0.3) * 0.5) { n++; ctx.hit(u, ctx.dmg, { stun: ctx.stun || 0.6, el: 'holy' }); V.burst('gold', chest(u), 20, { speed: 4 }); }
      if (n && c === G.player) G.hitstop = Math.max(G.hitstop || 0, 0.07); }
    if (hit) { const k = Math.max(0, 1 - (t - T.warn - 0.5) / 0.6); sw.traverse(o => { if (o.isMesh) o.material.opacity = (o.material.color.getHexString() === 'fffbe8' ? 0.95 : 0.45) * k; }); halo.material.opacity = Math.max(0, 1 - (t - T.warn) / 0.3); for (const m of cracks) m.material.opacity = 0.95 * Math.max(0, 1 - (t - T.warn) / 0.9); if (Math.random() < 0.7 * k) V.emit('gold', sw.position.clone().add(V3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 0.4)), { speed: 0.4, vy: 2.5, size: 0.25, life: 0.7 }); }
    if (t > T.warn + 1.2) { kill(sig, sw, halo, ...cracks); return true; } return false; });
}

// ======================= MONK =======================
// Hundred Fists look: phantom fists of golden chi stream off his hands into the target, his hands burn with chi, and the
// flurry ends in a huge open palm of light that bursts out in front of him
let palmTex = null;
function palm() { if (palmTex) return palmTex; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,240,190,1)'; x.shadowColor = 'rgba(255,190,60,1)'; x.shadowBlur = 10;
  x.beginPath(); x.ellipse(64, 80, 30, 34, 0, 0, Math.PI * 2); x.fill(); for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(40 + i * 16, 36 - (i === 1 || i === 2 ? 8 : 0), 7, 22, 0, 0, Math.PI * 2); x.fill(); } x.beginPath(); x.ellipse(28, 78, 8, 20, -0.9, 0, Math.PI * 2); x.fill();
  palmTex = new THREE.CanvasTexture(c); palmTex.colorSpace = THREE.SRGBColorSpace; return palmTex; }
const fistGeo = new THREE.SphereGeometry(0.16, 10, 8);
export function chiFlurry(u, dur = 0.65) { const hands = () => { const ch = u.ch || u.model, o = []; for (const s of ['R', 'L']) { const h = ch && ch.arms && ch.arms[s] && ch.arms[s].hand; if (h) { (ch.root || h).updateMatrixWorld(true); o.push(h.getWorldPosition(V3())); } } if (!o.length) o.push(chest(u)); return o; };
  S.chiHum && S.chiHum(u.pos); let next = 0, n = 0; const live = [];
  timer((t, dt) => { next -= dt; const f = fwdOf(u), hs = hands();
    for (const h of hs) if (Math.random() < 0.8) V.emit('gold', h, { speed: 0.5, size: 0.35, life: 0.25 });
    if (t < dur && next <= 0) { next = 0.045; n++; const h = hs[n % hs.length], m = new THREE.Mesh(fistGeo, glowM(n % 3 ? '#ffd890' : '#fff6e0', 0.85)); m.scale.set(1, 0.85, 1.35); const side = V3(f.z, 0, -f.x); const p0 = h.clone().addScaledVector(side, (Math.random() - 0.5) * 0.5).setY(h.y + (Math.random() - 0.5) * 0.4); m.position.copy(p0); m.lookAt(p0.clone().add(f)); G.scene.add(m);
      const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.1, 1, 6, 1, true), glowM('#ffc860', 0.5)); streak.rotation.x = Math.PI / 2; m.add(streak); streak.position.z = -0.5; live.push({ m, p0, t0: t }); }
    for (let i = live.length - 1; i >= 0; i--) { const L = live[i], a = (t - L.t0) / 0.16; L.m.position.copy(L.p0).addScaledVector(f, a * 2.4); L.m.material.opacity = 0.85 * (1 - a); L.m.children[0].material.opacity = 0.5 * (1 - a); L.m.children[0].scale.y = 0.4 + a * 1.4; L.m.scale.setScalar(1 + a * 0.6); L.m.scale.z *= 1.35; if (a >= 1) { L.m.children[0].material.dispose(); L.m.children[0].geometry.dispose(); L.m.material.dispose(); G.scene.remove(L.m); live.splice(i, 1); } }
    if (t >= dur && !u._chiPalm) { u._chiPalm = true; const p = chest(u).addScaledVector(f, 1.2), pm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: palm(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffd070', side: THREE.DoubleSide })); pm.position.copy(p); pm.lookAt(p.clone().add(f)); G.scene.add(pm); S.chiPalm && S.chiPalm(p); V.burst('gold', p, 40, { speed: 7, dir: f }); V.light(p, '#ffd070', 6, 0.3, 10); V.addShake(u === G.player ? 0.3 : 0.1);
      timer((tt) => { const k = tt / 0.4; pm.position.copy(p).addScaledVector(f, k * 2.6); pm.scale.setScalar(1 + k * 2.2); pm.material.opacity = 1 - k; if (k >= 1) { kill(pm); return true; } return false; }); }
    if (t >= dur && !live.length) { u._chiPalm = false; return true; } return false; });
}

export const K5 = { soulRend, shadowChains, graveGrasp, thornVolley, strangleRoots, healGeysers, geyser, holySmite, chiFlurry, chest };
if (G.hooks) G.hooks.k5 = K5; // (registered here too: the Training Yard sets up its own hooks)
