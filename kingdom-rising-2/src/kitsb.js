// kitsb.js: the reworked kits of five Kingdom Arena classes (the owner: "make the other classes unique... no generic bubble or circle crap").
// Each move here is one function run for your own hero (player.js runKit) and for computer fighters (arena.js resolve), so both look,
// sound and hit the same. Damage goes through the usual paths (your dealDamage, the bots' hitUnit), so perks, shields, crowd-control
// caps and ultimate charge all apply as for every other ability.
//   Elementalist: Flame Wave (a rolling wall of fire), Lightning Lash (a whip of lightning cracked across the front), Frostbind (an ice
//     shard that bursts into a crystal prison), Glacier Wall (right click: a wall of ice that blocks shots and walking)
//   Enchanter: Mirror Shards (a thrown mirror that shatters and ricochets), Mind Lock (a padlock of light snaps shut over their head:
//     silenced), Mesmerize (a swinging pocket watch: entranced), Mirror Image (right click: vanish and leave a glass copy of yourself)
//   Beastmaster: Savage Rend (a lunge and two crossing rakes of claw marks), Pounce (lands with claw gouges torn in the ground), Feral
//     Roar (a cone of rushing air that stuns), Primal Hide (right click: quills bristle from his back; he shrugs off damage and heals)
//   Priest: Halo of Dawn (a spiked sun-crown thrown like a boomerang: heals allies and hurts enemies on the way out and back), Word of
//     Shielding (golden letters stream to every ally: a heal and a shield), Chains of Light (chains burst out of the ground and hold them)
//   Bombardier: Tar Bomb (a pot of tar splats into a slowing puddle; the detonator sets it ablaze)
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { solidAt, addBox } from './world.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { ultFoes, ultFriends, ultGround, silenceUnit, A as AR_A } from './arena.js';
import { lobVel } from './bomber.js';

// arena.js links its unit helpers here at start (hitUnit, healUnit, slowUnit are private to it)
export const KB = { hit: null, heal: null, slow: null, tars: [] };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const isP = (c) => c === G.player;
const hgt = (u) => isP(u) ? (u.eye || 1.6) + 0.15 : (u.height || 1.8);
const chest = (u) => u.pos.clone().setY(u.pos.y + hgt(u) * 0.62);
const head = (u) => u.pos.clone().setY(u.pos.y + hgt(u) + 0.25);
const fwdOf = (c) => V3(Math.sin(c.yaw || 0), 0, Math.cos(c.yaw || 0));
const addM = (col, op = 1) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const tick = (fn) => G.timers.push({ update: fn });
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const kill = (o) => { if (!o) return; if (o.parent) o.parent.remove(o); o.traverse && o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach(x => { if (!x.userData.keep) x.dispose(); }); }); };
const flatDir = (v) => { const d = v.clone().setY(0); if (d.lengthSq() < 1e-5) d.set(0, 0, 1); return d.normalize(); };
const stunned = (u) => !!u && ((u.status && u.status.stun > 0) || (u.db && u.db.stun && u.db.stun.t > 0));

// ---------- who, where, how hard ----------
function hurt(c, u, n, o = {}) { if (!u || u.dead || n < 0) return 0; if (isP(c)) { const r = c.dealDamage(u, n, o); return typeof r === 'number' ? r : n; } return KB.hit ? KB.hit(c, u, n, o) || 0 : 0; }
function heal(c, u, frac) { if (!u || u.dead || !KB.heal) return; KB.heal(u, u.maxHp * frac * (isP(c) && c.hk ? c.hk() : 1), c); }
function shield(u, frac, dur) { if (!u || u.dead) return; const n = u.maxHp * frac; if (isP(u)) { u.buffs.barrier = Math.max(u.buffs.barrier || 0, n); u.buffs.barrierT = Math.max(u.buffs.barrierT || 0, dur); } else if (u.addBuff) { u.addBuff('barrier', dur); u.barrier = Math.max(u.barrier || 0, n); } }
const shieldLeft = (u) => isP(u) ? (u.buffs.barrierT > 0 ? u.buffs.barrier || 0 : 0) : (u.buffs && u.buffs.barrier > 0 ? u.barrier || 0 : 0);
function slow(u, t) { if (!u || u.dead) return; if (KB.slow) KB.slow(u, t); else if (u.status) u.status.slow = Math.max(u.status.slow || 0, t); }
const foes = (c) => ultFoes(c).filter(u => u && u.pos && !u.dead);
const friends = (c) => ultFriends(c).filter(u => u && u.pos && !u.dead);
const handOf = (c) => { const ch = isP(c) ? c.ch : c.model; const h = ch && ch.arms && ch.arms.R && ch.arms.R.hand; if (h && !(isP(c) && c.camDist < 0.6)) { ch.root.updateMatrixWorld(true); return h.getWorldPosition(V3()); }
  if (isP(c) && c.spellFrom) return c.spellFrom(); return c.pos.clone().setY(c.pos.y + hgt(c) * 0.7).addScaledVector(fwdOf(c), 0.5); };
const castFrom = (c) => isP(c) ? (c.spellFrom ? c.spellFrom() : handOf(c)) : handOf(c);
function aimDirOf(c, from, T) { if (isP(c)) return c.aimDir(from); if (T && T.pos) { const tv = T.vel || V3(), to = chest(T).addScaledVector(V3(tv.x, 0, tv.z), Math.min(0.5, T.pos.distanceTo(c.pos) / 40)); return to.sub(from).normalize(); } return fwdOf(c); }
function anim(c, name, dur = 0.5) { if (isP(c)) { c.atk = { name, t: 0.15, dur, hit: true, noQueue: true }; } else { c.act = name === 'castRel' || name === 'castBig' ? 'cast' : name; c.actT = 0; } }
function faceDir(c, d) { const y = Math.atan2(d.x, d.z); if (isP(c)) { c.bodyYaw = y; } else { c.yaw = y; if (c.root) c.root.rotation.y = y; } }
const kick = (c, shake, fov = 0, stop = 0) => { if (isP(c)) { V.addShake(shake); if (fov) c.fovKick = Math.max(c.fovKick || 0, fov); if (stop) G.hitstop = Math.max(G.hitstop || 0, stop); } else if (c.pos.distanceTo(G.player.pos) < 14) V.addShake(shake * 0.4); };
const gy = (p) => ultGround(p);

// a projectile flown by hand (for both sides): hits the first enemy near its path, a wall, or the ground
function fly(c, o) { const p = o.from.clone(), v = o.dir.clone().multiplyScalar(o.speed); let d = 0, t = 0; const m = o.mesh; m.position.copy(p); G.scene.add(m); const fs = foes(c);
  tick((dt) => { t += dt; v.y -= (o.grav || 0) * dt; const st = v.clone().multiplyScalar(dt); p.add(st); d += st.length(); m.position.copy(p); o.spin && o.spin(m, dt, t, v); o.trail && o.trail(p, t);
    let hit = null; for (const u of fs) if (!u.dead && chest(u).distanceTo(p) < (o.radius || 0.9) + (u.radius || 0.4) * 0.5) { hit = u; break; }
    const wall = !hit && (solidAt(p.x, p.y, p.z) || p.y < gy(p) + 0.05), far = d > (o.range || 30);
    if (hit || wall || far) { kill(m); o.onEnd && o.onEnd(hit, hit ? chest(hit) : p.clone(), !hit && wall); return true; } return false; }); }

// cached canvas textures (made once)
const TEX = {};
function canvasTex(key, w, h, draw) { if (TEX[key]) return TEX[key]; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return (TEX[key] = t); }
const scorchTex = () => canvasTex('scorch', 64, 256, (x, w, h) => { for (let i = 0; i < 260; i++) { const px = w / 2 + (Math.random() - 0.5) * w * 0.8 * Math.random(), py = Math.random() * h, r = 4 + Math.random() * 12, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(20,10,4,0.55)'); g.addColorStop(1, 'rgba(20,10,4,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } });
const emberTex = () => canvasTex('embers', 64, 256, (x, w, h) => { for (let i = 0; i < 160; i++) { const px = w / 2 + (Math.random() - 0.5) * w * 0.7 * Math.random(), py = Math.random() * h, r = 1.5 + Math.random() * 5, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,170,60,0.9)'); g.addColorStop(0.5, 'rgba(255,80,10,0.5)'); g.addColorStop(1, 'rgba(255,40,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } });
const ICE = () => { const m = new THREE.MeshStandardMaterial({ color: '#d6f4ff', emissive: '#3a9ee0', emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.82, flatShading: true }); return m; };

// ======================================================================= ELEMENTALIST
// Flame Wave: a curved wall of fire tongues rolls 14 m along the ground, scorching a black streak behind it
const FLAME = { len: 14, speed: 17, w0: 2.6, w1: 5.6 };
function flameWave(c, a, ctx) {
  const dir = flatDir(aimDirOf(c, castFrom(c), ctx.T)), side = V3(dir.z, 0, -dir.x), O = c.pos.clone().addScaledVector(dir, 0.9); faceDir(c, dir);
  const g = new THREE.Group(), N = 19, tongues = [], coneG = new THREE.ConeGeometry(0.3, 1, 6, 1, true).translate(0, 0.5, 0);
  for (let i = 0; i < N; i++) { const outer = new THREE.Mesh(coneG, addM(i % 3 ? '#ff4a0a' : '#ff7a1a', 0.5)), inner = new THREE.Mesh(coneG, addM('#ffb347', 0.55)); inner.scale.set(0.45, 0.62, 0.45); outer.add(inner); g.add(outer); tongues.push({ m: outer, u: i / (N - 1) - 0.5 + (Math.random() - 0.5) * 0.03, ph: Math.random() * 9, k: 0.55 + Math.random() * 0.8 }); }
  G.scene.add(g); const n = ctx.P(a.dmg), done = new Set(); let d = 0, t = 0, scT = 0, liT = 0, prev = null; const scorch = [];
  S.kb('flamewave', O, 1.1); S.cast && S.cast('fire', O, 0.7); anim(c, 'castRel', 0.55); kick(c, 0.25, 5);
  tick((dt) => { t += dt; const run = d < FLAME.len; if (run) d = Math.min(FLAME.len, d + FLAME.speed * dt); const k = d / FLAME.len, w = FLAME.w0 + (FLAME.w1 - FLAME.w0) * k, H = 2.3 * ease(t / 0.18) * (1 - ease((k - 0.82) / 0.18));
    const C = O.clone().addScaledVector(dir, d); C.y = gy(C);
    for (const q of tongues) { const lat = q.u * w, bow = (1 - (q.u * 2) * (q.u * 2)) * 0.9, p = C.clone().addScaledVector(side, lat).addScaledVector(dir, bow); p.y = gy(p) - 0.05; q.m.position.copy(p); const fl = 0.75 + 0.35 * Math.sin(t * 22 + q.ph) + 0.15 * Math.sin(t * 37 + q.ph * 2);
      q.m.scale.set(1 + 0.15 * Math.sin(t * 17 + q.ph), Math.max(0.01, H * q.k * fl * (1 - Math.abs(q.u) * 0.5)), 1); q.m.rotation.set(-0.35, Math.atan2(dir.x, dir.z), Math.sin(t * 9 + q.ph) * 0.12); { const dens = 0.45 + 0.55 * (w / FLAME.w1); q.m.material.opacity = 0.42 * dens; q.m.children[0].material.opacity = 0.45 * dens; }
      if (run && Math.random() < 0.35) V.emit('fire', p.clone().setY(p.y + H * q.k * 0.8), { speed: 1.6, size: 0.7, life: 0.45, vy: 2.5 }); if (run && Math.random() < 0.12) V.emit('ember', p.clone().setY(p.y + 0.4), { speed: 3, size: 0.14, life: 0.9, vy: 3 }); }
    if (run) { scT -= dt; if (scT <= 0) { scT = 0.03; const b = C.clone().addScaledVector(dir, -0.8); if (!scorch.length) { const sm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: scorchTex(), color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })), glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: emberTex(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }));
          for (const m of [sm, glow]) { m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, Math.atan2(dir.x, dir.z), 0); G.scene.add(m); } scorch.push({ sm, glow, t }); }
        const s0 = scorch[0], L = Math.max(0.1, b.clone().sub(O).dot(dir)), mid = O.clone().addScaledVector(dir, L / 2); s0.sm.scale.set(w * 0.95, L, 1); s0.glow.scale.set(w * 0.8, L, 1); s0.sm.position.set(mid.x, gy(mid) + 0.04, mid.z); s0.glow.position.set(mid.x, gy(mid) + 0.06, mid.z); s0.t = t; prev = b; }
      liT -= dt; if (liT <= 0) { liT = 0.12; V.light(C.clone().setY(C.y + 1.4), '#ff7a20', 7, 0.2, 12); if (d > 3) V.burst('smoke', C.clone().setY(C.y + 1.8).addScaledVector(dir, -1.0), 2, { speed: 0.8, size: 1.1, life: 1.0, vy: 1.6 }); }
      for (const u of foes(c)) { if (done.has(u)) continue; const dx = u.pos.x - O.x, dz = u.pos.z - O.z, al = dx * dir.x + dz * dir.z, lat = Math.abs(dx * side.x + dz * side.z); if (al < d - 1.6 || al > d + 1.2 || lat > w / 2 + 0.6) continue; done.add(u);
        hurt(c, u, n, { el: 'fire', burn: n * (a.burn || 0.3), ranged: true, knock: isP(c) ? dir.clone().multiplyScalar(5) : undefined }); V.burst('fire', chest(u), 30, { speed: 4, size: 0.6 }); V.burst('ember', chest(u), 14, { speed: 5 }); S.hit && S.hit('flesh', u.pos, 0.7); kick(c, 0.12, 0, 0.03); } }
    for (const s of scorch) { const age = t - s.t; s.glow.material.opacity = Math.max(0, 0.9 * (1 - age / 1.4)) * (0.8 + Math.sin(t * 20) * 0.2); s.sm.material.opacity = 0.85 * (1 - ease((age - 2.0) / 1.2)); if (Math.random() < 0.5 && age < 1.2) { const q = O.clone().addScaledVector(dir, Math.random() * d).addScaledVector(side, (Math.random() - 0.5) * w * 0.7); V.emit('ember', q.setY(gy(q) + 0.1), { speed: 0.6, size: 0.12, life: 0.8, vy: 1.5 }); } }
    if (!run && H <= 0.01 && g.parent) { kill(g); coneG.dispose(); }
    if (!run && t > FLAME.len / FLAME.speed + 3.6) { for (const s of scorch) { kill(s.sm); kill(s.glow); } if (g.parent) { kill(g); coneG.dispose(); } return true; } return false; });
  return true;
}

// Lightning Lash: a crackling whip of lightning swept across 140 degrees in front of him: everyone it crosses is jolted and slowed
const LASH = { reach: 9, arc: 1.25, dur: 0.2 };
function jag(a, b, n, amp) { const pts = [a.clone()]; const d = b.clone().sub(a); for (let i = 1; i < n; i++) { const p = a.clone().addScaledVector(d, i / n); p.x += (Math.random() - 0.5) * amp; p.y += (Math.random() - 0.5) * amp; p.z += (Math.random() - 0.5) * amp; pts.push(p); } pts.push(b.clone()); return pts; }
function boltMesh(pts, w, col, op) { const g = new THREE.Group(); for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = a.distanceTo(b); const m = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.7, w, L, 4, 1, true), addM(col, op)); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m); } return g; }
function flashBolt(a, b, life = 0.14, w = 0.05) { const pts = jag(a, b, Math.max(4, Math.round(a.distanceTo(b) * 1.4)), 0.45), core = boltMesh(pts, w, '#ffffff', 1), glow = boltMesh(pts, w * 2.6, '#4a8aff', 0.3); const g = new THREE.Group(); g.add(core, glow);
  V.temp(g, life, (o, k) => { o.children.forEach((x, i) => x.children.forEach(m => { m.material.opacity = (i ? 0.3 : 1) * (1 - k); })); if (k >= 0.999) kill(o); }); return g; }
function lightningLash(c, a, ctx) {
  const from0 = castFrom(c), aim = flatDir(aimDirOf(c, from0, ctx.T)), y0 = Math.atan2(aim.x, aim.z), n = ctx.P(a.dmg), done = new Set(); faceDir(c, aim); let t = 0, ang = y0 + LASH.arc, last = null;
  S.kb('thunder', c.pos, 1); anim(c, 'castRel', 0.45); kick(c, 0.3, 6);
  V.light(from0, '#bfe0ff', 10, 0.25, 14);
  tick((dt) => { t += dt; const k = Math.min(1, t / LASH.dur), a2 = y0 + LASH.arc - ease(k) * LASH.arc * 2, from = handOf(c);
    const tip = c.pos.clone().add(V3(Math.sin(a2) * LASH.reach, 0, Math.cos(a2) * LASH.reach)); tip.y = Math.max(gy(tip) + 0.5, from.y - 0.35);
    flashBolt(from, tip, 0.12, 0.03); if (Math.random() < 0.5) { const br = tip.clone().add(V3((Math.random() - 0.5) * 2, -0.6 - Math.random(), (Math.random() - 0.5) * 2)); flashBolt(tip, br, 0.1, 0.02); } last = tip;
    V.burst('lightning', tip, 6, { speed: 4, size: 0.18, life: 0.3 }); if (Math.random() < 0.5) V.burst('spark', tip.clone().setY(gy(tip) + 0.1), 4, { speed: 3 });
    for (const u of foes(c)) { if (done.has(u)) continue; const dx = u.pos.x - c.pos.x, dz = u.pos.z - c.pos.z, dist = Math.hypot(dx, dz); if (dist > LASH.reach + 0.6) continue; const ua = Math.atan2(dx, dz), off = Math.atan2(Math.sin(ua - y0), Math.cos(ua - y0)), cur = a2 - y0;
      if (off > LASH.arc + 0.15 || off < cur - 0.05) continue; done.add(u); const cp = chest(u);
      hurt(c, u, n, { el: 'lightning', stun: a.stun || 0.5, slow: a.slow || 1.5, ranged: true }); flashBolt(from, cp, 0.22, 0.06); V.burst('lightning', cp, 26, { speed: 6, size: 0.25 }); V.burst('spark', cp, 16, { speed: 6 }); V.light(cp, '#d8ecff', 9, 0.18, 10); S.kb('zapsmall', cp, 1); kick(c, 0.18, 0, 0.05); }
    return k >= 1; });
  return true;
}

// Frostbind: a spinning shard of ice; where it strikes, jagged crystals burst out of the ground around everyone within 3 m and hold them
const PRISON = [];
function crystalPrison(at, r, dur, small) {
  const g = new THREE.Group(), mat = ICE(), cr = [], n = small ? 5 : 11; g.position.copy(at); G.scene.add(g); mat.opacity = 0.7;
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2 + Math.random() * 0.4, h = (small ? 0.8 : 1.9) + Math.random() * (small ? 0.5 : 0.8), m = new THREE.Mesh(new THREE.ConeGeometry(0.2 + Math.random() * 0.16, h, 4), mat); m.userData.h = h;
    const rr = r * (0.8 + Math.random() * 0.35); m.position.set(Math.cos(a0) * rr, h * 0.42, Math.sin(a0) * rr); m.rotation.set(Math.sin(a0) * -0.22, Math.random() * 3, Math.cos(a0) * 0.22); m.userData.a = a0; m.scale.setScalar(0.01); g.add(m); cr.push(m); }
  for (let i = 0; i < (small ? 3 : 9); i++) { const a0 = Math.random() * Math.PI * 2, h = 0.4 + Math.random() * 0.4, m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + Math.random() * 0.16, 0), mat); m.position.set(Math.cos(a0) * r * 1.3, h * 0.3, Math.sin(a0) * r * 1.3); m.scale.setScalar(0.01); m.userData.h = 1; g.add(m); cr.push(m); }
  const frost = new THREE.Mesh(new THREE.CircleGeometry(r * 1.8, 9), new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); frost.rotation.x = -Math.PI / 2; frost.position.y = 0.03; g.add(frost);
  let t = 0, broke = false; V.burst('frost', at.clone().setY(at.y + 0.6), 40, { speed: 4, size: 0.4 }); V.light(at.clone().setY(at.y + 1), '#9ad8ff', 7, 0.3, 10); S.kb('iceform', at, 1);
  tick((dt) => { t += dt; const grow = Math.min(1, t / 0.14), ov = grow < 1 ? grow : 1 + Math.sin(Math.min(1, (t - 0.14) / 0.12) * Math.PI) * 0.12; frost.material.opacity = 0.55 * Math.min(1, t / 0.2) * (broke ? Math.max(0, 1 - (t - dur) / 0.6) : 1);
    if (!broke) for (const m of cr) m.scale.setScalar(Math.max(0.01, ov)); if (!broke && Math.random() < 0.15) V.emit('frost', at.clone().add(V3((Math.random() - 0.5) * r * 2, Math.random() * 1.6, (Math.random() - 0.5) * r * 2)), { speed: 0.4, size: 0.2, life: 0.6 });
    if (!broke && t >= dur) { broke = true; S.kb('shatter', at, 1); V.burst('frost', at.clone().setY(at.y + 0.8), 50, { speed: 6, size: 0.3 }); for (const m of cr) { m.userData.v = V3(Math.cos(m.userData.a || 0) * (3 + Math.random() * 3), 3 + Math.random() * 3, Math.sin(m.userData.a || 0) * (3 + Math.random() * 3)); m.userData.s = V3(Math.random() * 8, Math.random() * 8, 0); } }
    if (broke) { const k = (t - dur) / 0.7; for (const m of cr) { m.userData.v.y -= 16 * dt; m.position.addScaledVector(m.userData.v, dt); m.rotation.x += m.userData.s.x * dt; m.rotation.y += m.userData.s.y * dt; m.scale.setScalar(Math.max(0.01, 0.6 * (1 - k))); } if (k >= 1) { kill(g); return true; } }
    return false; });
  return g;
}
function frostbind(c, a, ctx) {
  const from = castFrom(c), dir = aimDirOf(c, from, ctx.T), n = ctx.P(a.dmg), mesh = new THREE.Group(); faceDir(c, dir);
  const sh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0).scale(0.75, 0.75, 2.6), ICE()); sh.material.emissiveIntensity = 1.2; mesh.add(sh); const halo = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0).scale(0.8, 0.8, 2.2), addM('#7ad0ff', 0.3)); mesh.add(halo);
  S.kb('glass', from, 0.8); S.cast && S.cast('frost', from, 0.6); anim(c, 'castRel', 0.5);
  fly(c, { from, dir, speed: 42, range: 32, mesh, radius: 0.8, spin: (m, dt, t, v) => { m.lookAt(m.position.clone().add(v)); m.rotateZ(t * 14); }, trail: (p) => { V.emit('frost', p.clone(), { speed: 0.5, size: 0.28, life: 0.4 }); if (Math.random() < 0.4) V.emit('spark', p.clone(), { speed: 0.4, size: 0.08, life: 0.3 }); },
    onEnd: (hit, at) => { const base = hit ? hit.pos.clone() : at.clone(); base.y = gy(base); const caught = foes(c).filter(u => Math.hypot(u.pos.x - base.x, u.pos.z - base.z) < (a.spread || 3) + (u === hit ? 9 : 0));
      if (!caught.length) { crystalPrison(base, 0.5, 0.6, true); V.burst('frost', at, 30, { speed: 5 }); return; }
      for (const u of caught) { hurt(c, u, n * (u === hit ? 1 : 0.7), { el: 'frost', stun: a.stun || 1.5, freeze: true, ranged: true }); const pr = crystalPrison(u.pos.clone().setY(gy(u.pos)), 0.5, Math.min(1.6, a.stun || 1.5), false); PRISON.push(pr); }
      kick(c, 0.2, 0, 0.05); } });
  return true;
}

// Glacier Wall (right click): a wall of jagged ice pillars bursts out of the ground in front of him for 4 s. It is solid: no one walks
// through it, and shots that hit it shatter. Enemies caught where it rises are thrown clear and slowed. Then it cracks and falls apart.
const WALL = { dist: 3.4, hw: 3.4, hd: 0.5, h: 2.8, dur: 4 };
function glacierWall(c, a, ctx) {
  const dir = flatDir(aimDirOf(c, castFrom(c), ctx.T)), side = V3(dir.z, 0, -dir.x), C = c.pos.clone().addScaledVector(dir, WALL.dist); C.y = gy(C); faceDir(c, dir);
  const g = new THREE.Group(), mat = ICE(), pil = []; g.position.copy(C); g.rotation.y = Math.atan2(dir.x, dir.z); G.scene.add(g);
  for (let i = 0; i < 11; i++) { const u = i / 10 - 0.5, h = WALL.h * (0.8 + Math.random() * 0.35) * (1 - Math.abs(u) * 0.45), m = new THREE.Mesh(new THREE.CylinderGeometry(0.14 + Math.random() * 0.1, 0.42 + Math.random() * 0.18, h, 5), mat);
    m.position.set(u * WALL.hw * 2, -h, (Math.random() - 0.5) * 0.3); m.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * 3, (Math.random() - 0.5) * 0.25); m.userData = { h, d: Math.abs(u) * 0.12 }; g.add(m); pil.push(m); }
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.25 + Math.random() * 0.2, 0), mat); m.position.set((Math.random() - 0.5) * WALL.hw * 2, -1, (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.3)); m.userData = { h: 0.3, d: 0.1 + Math.random() * 0.1 }; g.add(m); pil.push(m); }
  const yaw = Math.atan2(dir.x, dir.z); let col = addBox(C.x, C.z, WALL.hw, WALL.hd, -yaw, 'kbicewall', C.y - 1, C.y + WALL.h);
  // throw clear anyone standing in it, and slow enemies near it
  for (const u of foes(c).concat(friends(c))) { const dx = u.pos.x - C.x, dz = u.pos.z - C.z, lx = dx * side.x + dz * side.z, lz = dx * dir.x + dz * dir.z; if (Math.abs(lx) > WALL.hw + 0.5 || Math.abs(lz) > 2.2) continue;
    if (Math.abs(lz) < WALL.hd + 0.6) { const push = (lz >= 0 ? 1 : -1) * (WALL.hd + 0.8) - lz; u.pos.addScaledVector(dir, push); if (!isP(u) && u.root) u.root.position.copy(u.pos); }
    if (foes(c).includes(u)) { slow(u, 2.5); hurt(c, u, ctx.P(a.chip || 0.4), { el: 'frost', ranged: true }); V.burst('frost', chest(u), 16, { speed: 3 }); } }
  S.kb('icewall', C, 1.1); V.burst('stone', C.clone().setY(C.y + 0.2), 40, { speed: 6, grav: 14, radius: 4 }); V.burst('frost', C.clone().setY(C.y + 1), 60, { speed: 5, radius: 5 }); V.burst('dust', C.clone().setY(C.y + 0.2), 30, { speed: 4, size: 1.2, radius: 5 }); V.light(C.clone().setY(C.y + 1.5), '#a8e0ff', 8, 0.4, 14); kick(c, 0.45, 4); anim(c, 'castRel', 0.5);
  let t = 0, broke = false;
  tick((dt) => { t += dt;
    if (!broke) { for (const m of pil) { const k = ease((t - m.userData.d) / 0.18); m.position.y = -m.userData.h * (1 - k) + (m.userData.h * 0.45) * k + (k < 1 ? 0 : Math.sin(Math.min(1, (t - m.userData.d - 0.18) / 0.15) * Math.PI) * 0.06); }
      // shots that run into it shatter (the computer fighters' shots, and anyone's projectiles)
      const inWall = (p) => { const dx = p.x - C.x, dz = p.z - C.z, lx = dx * side.x + dz * side.z, lz = dx * dir.x + dz * dir.z; return Math.abs(lx) < WALL.hw && Math.abs(lz) < WALL.hd + 0.35 && p.y < C.y + WALL.h + 0.2; };
      for (let i = (AR_A.shots || []).length - 1; i >= 0; i--) { const s2 = AR_A.shots[i]; if (s2.m && inWall(s2.m.position)) { G.scene.remove(s2.m); AR_A.shots.splice(i, 1); V.burst('frost', s2.m.position.clone(), 14, { speed: 3 }); S.kb('zapsmall', s2.m.position, 0.4); } }
      for (const pr of G.projectiles || []) if (!pr.dead && pr.pos && inWall(pr.pos)) { pr.life = 0; pr.dead = true; V.burst('frost', pr.pos.clone(), 12, { speed: 3 }); }
      if (Math.random() < 0.2) V.emit('frost', C.clone().addScaledVector(side, (Math.random() - 0.5) * WALL.hw * 2).setY(C.y + Math.random() * WALL.h), { speed: 0.3, size: 0.25, life: 0.8 });
      if (t >= WALL.dur) { broke = true; col.on = false; S.kb('shatter', C, 1.2); S.kb('icewall', C, 0.6); V.burst('frost', C.clone().setY(C.y + 1.2), 80, { speed: 6, radius: 5 }); for (const m of pil) { m.userData.v = V3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 4); m.userData.s = Math.random() * 6; } } }
    else { const k = (t - WALL.dur) / 0.8; for (const m of pil) { m.userData.v.y -= 14 * dt; m.position.addScaledVector(m.userData.v, dt); m.rotation.x += m.userData.s * dt; m.scale.setScalar(Math.max(0.01, 1 - k)); } if (k >= 1) { kill(g); return true; } }
    return false; });
  return true;
}

// ======================================================================= ENCHANTER
const mirrorTex = () => canvasTex('mirror', 128, 160, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f6eaff'); g.addColorStop(0.35, '#b9a6e8'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.62, '#a890e0'); g.addColorStop(1, '#5a3a9a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-20 + i * 40, h); x.lineTo(60 + i * 40, 0); x.stroke(); } x.strokeStyle = '#ff9af0'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8); });
// Mirror Shards: a spinning pane of enchanted glass; it shatters on the first enemy and its shards ricochet into up to 3 more nearby
function mirrorShards(c, a, ctx) {
  const from = castFrom(c), dir = aimDirOf(c, from, ctx.T), n = ctx.P(a.dmg), tex = mirrorTex(), mesh = new THREE.Group(); faceDir(c, dir);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })), glow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2), addM('#d070ff', 0.35)); glow.position.z = -0.01; mesh.add(pane, glow);
  S.kb('glass', from, 1); anim(c, 'castRel', 0.5);
  fly(c, { from, dir, speed: 34, range: 30, mesh, radius: 0.85, spin: (m, dt, t, v) => { m.lookAt(m.position.clone().add(v)); m.rotateZ(t * 16); },
    trail: (p) => { V.emit('arcane', p.clone(), { speed: 0.5, size: 0.22, life: 0.35 }); if (Math.random() < 0.5) V.emit('spark', p.clone(), { speed: 0.6, size: 0.07, life: 0.3 }); },
    onEnd: (hit, at) => { S.kb('shatter', at, 1.1); V.burst('arcane', at, 30, { speed: 5, size: 0.25 }); V.light(at, '#e0a0ff', 6, 0.2, 9); shardBurst(at, tex);
      if (!hit) return; hurt(c, hit, n, { el: 'arcane', ranged: true }); kick(c, 0.15, 0, 0.04);
      const near = foes(c).filter(u => u !== hit && u.pos.distanceTo(hit.pos) < 9).sort((x, y) => x.pos.distanceTo(hit.pos) - y.pos.distanceTo(hit.pos)).slice(0, 2);
      for (const u of near) ricochet(c, at, u, tex, () => { hurt(c, u, n * 0.35, { el: 'arcane', ranged: true }); S.kb('zapsmall', u.pos, 0.5); }); } });
  return true;
}
function shardGeo() { const s = new THREE.Shape(); s.moveTo(0, 0.16); s.lineTo(0.09, -0.1); s.lineTo(-0.07, -0.08); s.lineTo(0, 0.16); return new THREE.ShapeGeometry(s); }
function shardBurst(at, tex) { const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }); for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(shardGeo(), mat), v = V3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 4), sp = V3(Math.random() * 12, Math.random() * 12, 0);
    m.position.copy(at); V.temp(m, 0.7, (o, k, dt) => { v.y -= 12 * (dt || 0.016); o.position.addScaledVector(v, dt || 0.016); o.rotation.x += sp.x * (dt || 0.016); o.rotation.y += sp.y * (dt || 0.016); o.scale.setScalar(Math.max(0.01, 1 - k)); if (k >= 0.999) o.geometry.dispose(); }); } }
function ricochet(c, from, u, tex, onHit) { const m = new THREE.Mesh(shardGeo(), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true })); m.scale.setScalar(1.8); m.position.copy(from); G.scene.add(m); let t = 0; const p0 = from.clone(), dur = 0.22 + Math.random() * 0.08, lift = 1 + Math.random();
  tick((dt) => { t += dt; const k = Math.min(1, t / dur), to = chest(u), p = p0.clone().lerp(to, k); p.y += Math.sin(k * Math.PI) * lift; m.position.copy(p); m.rotation.z += dt * 20; m.lookAt(to); V.emit('arcane', p.clone(), { speed: 0.3, size: 0.16, life: 0.3 });
    if (k >= 1) { kill(m); if (!u.dead) { onHit(); V.burst('arcane', to, 16, { speed: 4 }); V.burst('spark', to, 8, { speed: 4 }); } return true; } return false; }); }

// Mind Lock: a bolt of binding thought; everyone within 3 m of where it lands is silenced, and a padlock of light snaps shut over their heads
function padlock(u, dur) { const g = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: '#e8b8ff', emissive: '#9a40ff', emissiveIntensity: 1.1, metalness: 0.7, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.12), gold); g.add(body); const hole = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: '#1a0630' })); hole.position.set(0, 0.02, 0.062); g.add(hole); const hole2 = hole.clone(); hole2.position.z = -0.062; hole2.rotation.y = Math.PI; g.add(hole2);
  const sh = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 16, Math.PI), gold); sh.position.set(0, 0.2, 0); g.add(sh); const aura = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), addM('#c060ff', 0.25)); g.add(aura);
  const links = []; for (let i = 0; i < 10; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10), gold); g.add(l); links.push(l); }
  G.scene.add(g); let t = 0, snapped = false;
  tick((dt) => { t += dt; if (u.dead && t < dur) t = dur; const hp = head(u), k = Math.min(1, t / 0.12), out = Math.max(0, (t - dur) / 0.3); g.position.copy(hp).setY(hp.y + 0.15 + Math.sin(t * 4) * 0.04); g.lookAt(G.camera.position.x, g.position.y, G.camera.position.z); g.scale.setScalar(1.5 * Math.max(0.01, (0.4 + 0.6 * k) * (1 + (snapped && t < 0.4 ? Math.sin((t - 0.18) / 0.22 * Math.PI) * 0.18 : 0)) * (1 - out)));
    sh.position.y = t < 0.18 ? 0.32 : 0.2; if (!snapped && t >= 0.18) { snapped = true; S.kb('lock', hp, 1); V.burst('arcane', hp, 18, { speed: 3, size: 0.2 }); V.light(hp, '#c080ff', 4, 0.15, 6); }
    aura.material.opacity = 0.22 + Math.sin(t * 8) * 0.08; links.forEach((l, i) => { const a0 = i / links.length * Math.PI * 2 + t * 2.2; l.position.set(Math.cos(a0) * 0.42, -0.42 + Math.sin(a0 * 2 + t) * 0.05, Math.sin(a0) * 0.42); l.rotation.set(a0, i % 2 ? Math.PI / 2 : 0, 0); l.visible = snapped; });
    if (out >= 1) { V.burst('arcane', g.position.clone(), 14, { speed: 2 }); kill(g); return true; } return false; }); }
function mindLock(c, a, ctx) {
  const from = castFrom(c), dir = aimDirOf(c, from, ctx.T), n = ctx.P(a.dmg), sil = a.silence || 2, mesh = new THREE.Group(); faceDir(c, dir);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), addM('#ffffff', 1)), h1 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 20), addM('#c070ff', 0.8)), h2 = h1.clone(); h2.rotation.x = Math.PI / 2; mesh.add(core, h1, h2);
  S.cast && S.cast('arcane', from, 0.6); S.kb('glass', from, 0.5); anim(c, 'castRel', 0.5);
  fly(c, { from, dir, speed: 48, range: 30, mesh, radius: 0.85, spin: (m, dt, t) => { h1.rotation.y += dt * 12; h2.rotation.z += dt * 15; }, trail: (p) => V.emit('void', p.clone(), { normal: true, speed: 0.4, size: 0.25, life: 0.4 }),
    onEnd: (hit, at) => { V.burst('void', at, 30, { normal: true, speed: 4, size: 0.35 }); V.burst('arcane', at, 20, { speed: 5 }); S.cast && S.cast('arcane', at, 0.8);
      for (const u of foes(c)) { const d = u.pos.distanceTo(at.clone().setY(u.pos.y)); if (d > (a.aoe || 3) && u !== hit) continue; hurt(c, u, n * (u === hit ? 1 : 0.8), { el: 'arcane', silence: sil, ranged: true }); silenceUnit(u, sil, c); padlock(u, sil); } } });
  return true;
}

// Mesmerize: a golden pocket watch appears in front of the enemy's eyes and swings on its chain; they stand entranced (up to 3 s;
// damage after the first moment wakes them, and the watch snaps away)
const watchTex = () => canvasTex('watch', 128, 128, (x, w) => { const m = w / 2; x.fillStyle = '#fff6e0'; x.beginPath(); x.arc(m, m, m - 2, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#6a4a10'; x.lineWidth = 4; x.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.lineWidth = i % 3 ? 2 : 5; x.beginPath(); x.moveTo(m + Math.sin(a) * (m - 8), m - Math.cos(a) * (m - 8)); x.lineTo(m + Math.sin(a) * (m - 20), m - Math.cos(a) * (m - 20)); x.stroke(); }
  x.strokeStyle = '#b040ff'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i < 80; i++) { const a = i * 0.32, r = i * 0.5; i ? x.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r) : x.moveTo(m, m); } x.stroke();
  x.strokeStyle = '#2a1a04'; x.lineWidth = 5; x.beginPath(); x.moveTo(m, m); x.lineTo(m, m - 34); x.moveTo(m, m); x.lineTo(m + 24, m + 8); x.stroke(); });
function pocketWatch(u, dur) { const g = new THREE.Group(), pivot = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: '#e0b040', emissive: '#6a4400', emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.25 }); g.add(pivot);
  const watch = new THREE.Group(); watch.position.y = -0.62; pivot.add(watch); const caseM = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 28), gold); caseM.rotation.x = Math.PI / 2; watch.add(caseM);
  for (const s of [1, -1]) { const face = new THREE.Mesh(new THREE.CircleGeometry(0.13, 28), new THREE.MeshBasicMaterial({ map: watchTex() })); face.position.z = 0.027 * s; if (s < 0) face.rotation.y = Math.PI; watch.add(face); }
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12), gold); crown.position.y = 0.18; watch.add(crown); const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), addM('#ffb0f0', 0.3)); watch.add(glow);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 4, 8), gold); l.position.y = -i * 0.05 - 0.04; l.rotation.y = i % 2 ? Math.PI / 2 : 0; pivot.add(l); }
  G.scene.add(g); let t = 0; S.kb('tick', u.pos, 0.9);
  tick((dt) => { t += dt; const awake = t > 0.6 && !stunned(u) && !u.dummy, end = t >= dur || u.dead || awake; if (end && !g.userData.endT) { g.userData.endT = t; S.kb('chime', u.pos, 0.6); V.burst('gold', watch.getWorldPosition(V3()), 20, { speed: 3 }); }
    const out = g.userData.endT ? (t - g.userData.endT) / 0.25 : 0, hp = head(u), toCam = V3(G.camera.position.x - u.pos.x, 0, G.camera.position.z - u.pos.z).normalize(), f = V3(Math.sin(u.yaw || 0), 0, Math.cos(u.yaw || 0)); const fr = f.clone().lerp(toCam, 0.5).normalize();
    g.position.copy(hp).addScaledVector(fr, 0.55).setY(hp.y + 0.15); g.lookAt(g.position.clone().add(fr)); pivot.rotation.z = Math.sin(t * 3.4) * 0.75; g.scale.setScalar(1.4 * Math.max(0.01, Math.min(1, t / 0.15) * (1 - out))); glow.material.opacity = 0.25 + Math.sin(t * 6.8) * 0.1;
    if (Math.random() < 0.4) V.emit('gold', watch.getWorldPosition(V3()), { speed: 0.3, size: 0.12, life: 0.5 }); if (Math.random() < 0.15) V.emit('arcane', hp.clone().add(V3((Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5)), { speed: 0.4, size: 0.18, life: 0.8, vy: 0.6 });
    if (out >= 1) { kill(g); return true; } return false; }); }
function mesmerize(c, a, ctx) {
  const from = castFrom(c), dir = aimDirOf(c, from, ctx.T), mesh = new THREE.Group(); faceDir(c, dir); const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), addM('#fff0c0', 1)), h = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 16), addM('#ffb040', 0.9)); mesh.add(core, h);
  S.kb('glass', from, 0.6); anim(c, 'castRel', 0.5);
  fly(c, { from, dir, speed: 46, range: 30, mesh, radius: 0.9, spin: (m, dt) => { h.rotation.x += dt * 10; h.rotation.y += dt * 7; }, trail: (p) => V.emit('gold', p.clone(), { speed: 0.3, size: 0.18, life: 0.35 }),
    onEnd: (hit, at) => { V.burst('gold', at, 16, { speed: 3 }); if (!hit) return; const d = Math.min(3, a.stun || 3); hurt(c, hit, ctx.P(a.dmg || 0.1), { stun: d, mez: true, ranged: true, el: 'arcane' }); pocketWatch(hit, d); } });
  return true;
}

// Mirror Image (right click): you burst into glitter and vanish for 3 s; a glass copy of you is left standing where you were. Enemy
// fighters chasing you turn on the copy. Hit it (or after 4 s) and it shatters, slowing every enemy within 4 m.
export const DECOYS = [];
function bodyRoot(c) { return isP(c) ? c.ch && c.ch.root : c.root || (c.model && c.model.root); }
function mirrorImage(c, a, ctx) {
  const src = bodyRoot(c), dur = a.dur || 4, inv = a.stealth || 3; let copy = null; const mats = [];
  if (src) { try { src.updateMatrixWorld(true); copy = skClone(src); copy.visible = true; copy.position.copy(src.position); copy.quaternion.copy(src.quaternion); copy.scale.copy(src.scale);
      copy.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.material = [].concat(o.material).map(m0 => { const m = m0.clone(); m.transparent = true; m.opacity = 0.85; m.depthWrite = true; if (m.emissive) { m.emissive = new THREE.Color('#9040ff'); m.emissiveIntensity = 0.7; } if (m.color) m.color.lerp(new THREE.Color('#c8b0ff'), 0.35); mats.push(m); return m; }); if (o.material.length === 1) o.material = o.material[0]; o.frustumCulled = false; o.castShadow = false; } });
      G.scene.add(copy); } catch (e) { copy = null; } }
  const at = c.pos.clone(), D = { decoy: true, pos: at.clone(), yaw: c.yaw || 0, team: isP(c) ? G.myTeam : c.team, hp: 1, maxHp: c.maxHp || 1000, height: hgt(c), radius: 0.5, status: {}, buffs: {}, dead: false, owner: c, heroName: c.heroName || 'You', name: c.heroName || 'You', vel: V3(), cast: null, stealth: 0, hurtT: 0,
    takeHit() { shatter(); return 0; }, takeDamage() { shatter(); return 0; }, debuff() {}, knock() {}, flash() {}, healSelf() {}, addBuff() {} };
  let t = 0, gone = false;
  const shatter = () => { if (gone) return; gone = true; D.dead = true; const p = at.clone().setY(at.y + 1.1); S.kb('shatter', p, 1.3); V.burst('arcane', p, 60, { speed: 6, size: 0.3, radius: 1 }); V.burst('spark', p, 30, { speed: 6 }); V.light(p, '#e0a0ff', 8, 0.25, 10); shardBurst(p, mirrorTex()); shardBurst(p.clone().setY(p.y + 0.6), mirrorTex());
    for (const u of foes(c)) if (u.pos.distanceTo(at) < 4) { slow(u, 2); V.burst('arcane', chest(u), 12, { speed: 3 }); } if (copy) { kill(copy); mats.forEach(m => m.dispose()); copy = null; } const i = DECOYS.indexOf(D); if (i >= 0) DECOYS.splice(i, 1); };
  DECOYS.push(D);
  // the vanish: glitter and a falling shimmer
  V.burst('arcane', c.pos.clone().setY(c.pos.y + 1), 50, { speed: 4, size: 0.25, radius: 0.8 }); V.burst('spark', c.pos.clone().setY(c.pos.y + 1.2), 30, { speed: 3, size: 0.1 }); S.kb('vanish', c.pos, 1);
  if (isP(c)) { c.stealth = Math.max(c.stealth || 0, inv); c.phaseInvis = true; c.buffs.swind = Math.max(c.buffs.swind || 0, inv); for (const m of G.mobs) if (!m.dead && m.target === c) m.target = null; }
  else { c.stealth = Math.max(c.stealth || 0, inv); c.phaseInvis = true; c.target = null; }
  anim(c, 'castRel', 0.35);
  tick((dt) => { t += dt; if (gone) return true; if (t >= dur) { shatter(); return true; }
    if (copy) { const fl = 0.82 + Math.sin(t * 13) * 0.06 + (Math.random() < 0.04 ? -0.35 : 0); mats.forEach(m => { m.opacity = fl; }); if (Math.random() < 0.3) V.emit('arcane', at.clone().add(V3((Math.random() - 0.5) * 0.8, Math.random() * 1.9, (Math.random() - 0.5) * 0.8)), { speed: 0.3, size: 0.12, life: 0.6, vy: 0.5 }); }
    // enemy fighters that lost you go for the copy
    for (const u of foes(c)) if (u.arenaBot && !u.dead && (u.target === c || !u.target || u.target === D) && u.pos.distanceTo(at) < 30) u.target = D;
    // the player's own shots and swings (when a computer enchanter left it) break it
    if (!isP(c)) { for (const pr of G.projectiles || []) if (!pr.dead && pr.owner === 'player' && pr.pos && pr.pos.distanceTo(at.clone().setY(at.y + 1)) < 1.0) { pr.dead = true; pr.life = 0; shatter(); return true; }
      const P = G.player; if (P && P.atk && P.atk.hit && P.pos.distanceTo(at) < 3.2) { shatter(); return true; } }
    return false; });
  return true;
}

// ======================================================================= BEASTMASTER
// claw marks: a set of three parallel curved strips torn through the air (hot red core, dark rim), drawn out along the swipe then fading
function clawRibbon(curve, w, col, op) { const N = 18, pos = [], idx = []; for (let i = 0; i <= N; i++) { const u = i / N, p = curve(u), q = curve(Math.min(1, u + 0.01)), d = q.clone().sub(curve(Math.max(0, u - 0.01))).normalize(), n = V3(0, 0, 1).cross(d).normalize(), hw = w * Math.sin(u * Math.PI) ** 0.6;
    pos.push(p.x + n.x * hw, p.y + n.y * hw, p.z + n.z * hw, p.x - n.x * hw, p.y - n.y * hw, p.z - n.z * hw); if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.setDrawRange(0, 0); return new THREE.Mesh(g, addM(col, op)); }
function clawMarks(c, at, dir, flip, scale = 1) { const g = new THREE.Group(); g.position.copy(at); g.lookAt(at.clone().add(dir)); g.rotateY(Math.PI); G.scene.add(g); const strips = [];
  for (let i = -1; i <= 1; i++) { const off = i * 0.22 * scale, curve = (u) => V3((flip ? -1 : 1) * (0.75 - u * 1.5) * scale + off * 0.4, (0.75 - u * 1.5) * scale + off, -Math.sin(u * Math.PI) * 0.35 * scale); for (const [w, col, op] of [[0.07 * scale, '#fff0d0', 1], [0.16 * scale, '#ff3a1a', 0.75], [0.3 * scale, '#8a0a00', 0.35]]) { const m = clawRibbon(curve, w, col, op); g.add(m); strips.push(m); } }
  let t = 0; tick((dt) => { t += dt; const k = Math.min(1, t / 0.08), N = 18 * 6; for (const m of strips) { m.geometry.setDrawRange(0, Math.floor(N * k)); m.material.opacity = m.userData.op0 == null ? (m.userData.op0 = m.material.opacity) : m.userData.op0 * (1 - ease((t - 0.12) / 0.3)); } if (t > 0.45) { kill(g); return true; } return false; }); }
function savageRend(c, a, ctx) {
  const T = ctx.T, dir = isP(c) ? flatDir(c.fwd ? c.fwd() : fwdOf(c)) : flatDir(T ? T.pos.clone().sub(c.pos) : fwdOf(c)), n = ctx.P(a.dmg); faceDir(c, dir);
  if (isP(c)) { c.lungeT = 0.18; c.lungeDir = dir.clone(); } else { const go = T ? Math.max(0, Math.min(3, T.pos.distanceTo(c.pos) - 1.6)) : 2; let mv = 0; tick((dt) => { const s = Math.min(go - mv, 22 * dt); mv += s; c.pos.addScaledVector(dir, s); if (c.root) c.root.position.copy(c.pos); return mv >= go - 0.01; }); }
  anim(c, isP(c) ? 'swing2' : 'swing2', 0.55);
  const rake = (flip, k2, last) => { if (c.dead) return; const at = c.pos.clone().setY(c.pos.y + hgt(c) * 0.6).addScaledVector(dir, 1.5); clawMarks(c, at, dir, flip, 1.15); S.kb('rake', at, 1); S.swingW && S.swingW('fist', 1.2, c.pos);
    let hits = 0; for (const u of foes(c)) { const dx = u.pos.x - c.pos.x, dz = u.pos.z - c.pos.z, d = Math.hypot(dx, dz); if (d > 3.8 + (u.radius || 0.4)) continue; const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - Math.atan2(dir.x, dir.z)), Math.cos(Math.atan2(dx, dz) - Math.atan2(dir.x, dir.z))); if (Math.abs(off) > 0.9 && d > 1.2) continue;
      hits++; hurt(c, u, n * k2, { melee: true, bleed: last ? n * 0.25 : 0 }); V.burst('blood', chest(u), 24, { speed: 5 }); V.burst('spark', chest(u), 6, { speed: 4 }); S.hit && S.hit('flesh', u.pos, 1); }
    if (hits) kick(c, last ? 0.35 : 0.2, last ? 6 : 3, last ? 0.08 : 0.05); };
  rake(false, 0.45, false); setTimeout(() => rake(true, 0.55, true), 170);
  return true;
}
// Pounce: a leap onto the enemy you aim at; where he lands, three deep claw gouges are torn into the ground and everyone within 3 m is
// knocked down
function gouges(at, dir) { const side = V3(dir.z, 0, -dir.x); for (let i = -1; i <= 1; i++) { const p0 = at.clone().addScaledVector(side, i * 0.42).addScaledVector(dir, -0.4), L = 2.6 - Math.abs(i) * 0.5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, L), new THREE.MeshBasicMaterial({ color: '#1c1208', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, Math.atan2(dir.x, dir.z), 0); const mid = p0.clone().addScaledVector(dir, L / 2); m.position.set(mid.x, gy(mid) + 0.04, mid.z); G.scene.add(m);
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, L * 1.04), new THREE.MeshBasicMaterial({ color: '#6a5034', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })); lip.rotation.copy(m.rotation); lip.position.copy(m.position).setY(m.position.y - 0.005); G.scene.add(lip);
    for (let k = 0; k < 5; k++) { const q = p0.clone().addScaledVector(dir, L * k / 4); q.y = gy(q) + 0.1; V.burst('stone', q, 3, { speed: 3.5, grav: 16, size: 0.3 }); V.burst('dust', q, 2, { speed: 2, size: 0.9, life: 1.2 }); }
    let t = 0; tick((dt) => { t += dt; const o = 1 - ease((t - 3) / 1.2); m.material.opacity = 0.85 * o; lip.material.opacity = 0.6 * o; if (t > 4.2) { kill(m); kill(lip); return true; } return false; }); } }
function pounceLand(c, a, n, dir) { const p = c.pos.clone(); p.y = gy(p); gouges(p.clone().addScaledVector(dir, 0.6), dir); S.kb('land', p, 1.2); S.growl && S.growl('bear', p, 1);
  V.burst('dust', p.clone().setY(p.y + 0.2), 50, { speed: 6, size: 1.4, life: 1.4, radius: 1.5 }); V.burst('stone', p.clone().setY(p.y + 0.3), 30, { speed: 8, grav: 16 }); V.light(p.clone().setY(p.y + 1), '#ffb070', 6, 0.25, 10);
  let hits = 0; for (const u of foes(c)) { if (Math.hypot(u.pos.x - p.x, u.pos.z - p.z) > (a.r || 3.2)) continue; hits++; hurt(c, u, n, { melee: true, stun: a.stun || 1, big: true, knock: isP(c) ? u.pos.clone().sub(p).setY(0).normalize().multiplyScalar(6) : undefined }); V.burst('blood', chest(u), 26, { speed: 5 }); }
  kick(c, hits ? 0.7 : 0.45, 10, hits ? 0.1 : 0.04); }
function pounce(c, a, ctx) {
  const n = ctx.P(a.dmg);
  if (isP(c)) { const tg = c.aimFoe ? c.aimFoe(15) : null, f = flatDir(c.fwd ? c.fwd() : fwdOf(c)); let to, dir; if (tg) { const d = tg.pos.clone().sub(c.pos).setY(0), L = d.length(); dir = d.normalize(); to = c.pos.clone().addScaledVector(dir, Math.max(0, L - 1.0)); } else { dir = f; to = c.pos.clone().addScaledVector(f, 10); }
    for (let k = 1; k <= 10; k++) { const q = c.pos.clone().lerp(to, k / 10); if (solidAt(q.x, gy(q) + 1, q.z)) { to = c.pos.clone().lerp(to, Math.max(0, (k - 1.5) / 10)); break; } } to.y = gy(to);
    c.leap = { t: 0, dur: 0.55, from: c.pos.clone(), to, dmg: 0, r: 0.01, hgt: 2.4, onLand: () => pounceLand(c, a, n, dir) }; faceDir(c, dir); anim(c, 'leap', 0.6); }
  else { const T = ctx.T; if (!T) return true; const d = V3(T.pos.x - c.pos.x, 0, T.pos.z - c.pos.z), L = d.length(); const dir = d.normalize(); faceDir(c, dir); c.dashing = { dir, left: Math.max(0, L - 1.3), t: 0, onEnd: () => { c.act = 'swing1'; c.actT = 0; pounceLand(c, a, n, dir); } }; }
  S.growl && S.growl('bear', c.pos, 0.8); V.burst('dust', c.pos.clone().setY(c.pos.y + 0.2), 20, { speed: 3, size: 0.9 }); kick(c, 0.15, 6);
  return true;
}
// Feral Roar: a cone of rushing air and dust bursts from his jaws: everyone in it (9 m ahead) is stunned for a moment, then slowed
const ROAR = { r: 9, half: 0.62 };
function feralRoar(c, a, ctx) {
  const dir = isP(c) ? flatDir(c.fwd ? c.fwd() : fwdOf(c)) : flatDir(ctx.T ? ctx.T.pos.clone().sub(c.pos) : fwdOf(c)), yaw = Math.atan2(dir.x, dir.z), mouth = c.pos.clone().setY(c.pos.y + hgt(c) * 0.82).addScaledVector(dir, 0.5); faceDir(c, dir);
  S.kb('roar', c.pos, 1.2); anim(c, 'castBig', 0.7); kick(c, 0.5, 8); const fronts = [];
  for (let i = 0; i < 5; i++) { const geo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true, Math.PI - ROAR.half * 0.9 + yaw - Math.PI, ROAR.half * 1.8); const m = new THREE.Mesh(geo, addM(i % 2 ? '#ffe8c0' : '#ffffff', 0.0)); m.position.copy(mouth).setY(mouth.y - 0.5); G.scene.add(m); fronts.push({ m, d: i * 0.07 }); }
  let t = 0; const done = new Set(), n = ctx.P(a.dmg || 0.4);
  tick((dt) => { t += dt; for (const f of fronts) { const k = (t - f.d) / 0.5; if (k < 0) continue; const r = 0.5 + ease(k) * ROAR.r; f.m.scale.set(r, 0.6 + k * 2.4, r); f.m.material.opacity = Math.max(0, 0.16 * (1 - k)) * Math.min(1, k * 6); f.m.position.y = mouth.y - 0.5 - k * 0.6; }
    const R = 0.5 + ease(t / 0.5) * ROAR.r; if (t < 0.55) { for (let i = 0; i < 7; i++) { const ang = yaw + (Math.random() - 0.5) * ROAR.half * 2, q = c.pos.clone().add(V3(Math.sin(ang) * R, 0, Math.cos(ang) * R)); q.y = gy(q) + 0.15; V.burst('dust', q, 1, { speed: 2.5, size: 1.1, life: 0.9, dir: V3(Math.sin(ang), 0.25, Math.cos(ang)) }); if (Math.random() < 0.3) V.burst('leaf', q, 1, { speed: 4, dir: V3(Math.sin(ang), 0.6, Math.cos(ang)) }); }
      for (const u of foes(c)) { if (done.has(u)) continue; const dx = u.pos.x - c.pos.x, dz = u.pos.z - c.pos.z, d = Math.hypot(dx, dz); if (d > R + 0.4 || d > ROAR.r + 0.5) continue; const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw)); if (Math.abs(off) > ROAR.half + 0.12 && d > 1.5) continue;
        done.add(u); hurt(c, u, n, { stun: a.stun || 1, slow: a.slow || 2.5, ranged: true, knock: isP(c) ? dir.clone().multiplyScalar(4) : undefined }); V.burst('dust', chest(u), 14, { speed: 4, dir }); } }
    if (t > 0.9) { for (const f of fronts) kill(f.m); return true; } return false; });
  return true;
}
// Primal Hide (right click): bone-tipped quills burst out of his back and shoulders: for 4 s he takes 40% less damage and heals 20%
function primalHide(c, a, ctx) {
  const dur = a.dur || 4, g = new THREE.Group(), H = hgt(c), qm = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.7 }), tip = new THREE.MeshStandardMaterial({ color: '#efe6d0', roughness: 0.5 }), qs = [];
  for (let i = 0; i < 26; i++) { const u = Math.random(), ang = Math.PI + (Math.random() - 0.5) * 2.6, y = H * (0.58 + u * 0.28), L = 0.5 + Math.random() * 0.45; const q = new THREE.Group(), sh = new THREE.Mesh(new THREE.ConeGeometry(0.045, L, 5).translate(0, L / 2, 0), qm), tp = new THREE.Mesh(new THREE.ConeGeometry(0.02, L * 0.35, 5).translate(0, L * 1.0, 0), tip); q.add(sh, tp);
    const r = H * 0.19; q.position.set(Math.sin(ang) * r, y, Math.cos(ang) * r); q.lookAt(V3(Math.sin(ang) * 3, y + 1.6 + Math.random(), Math.cos(ang) * 3)); q.rotateX(Math.PI / 2); q.scale.setScalar(0.01); q.userData.d = Math.random() * 0.12; g.add(q); qs.push(q); }
  G.scene.add(g); S.kb('quills', c.pos, 1); S.growl && S.growl('bear', c.pos, 0.9); kick(c, 0.3, 4); anim(c, 'castBig', 0.5);
  V.burst('dust', c.pos.clone().setY(c.pos.y + H * 0.7), 30, { speed: 3, size: 0.8 }); V.burst('blood', c.pos.clone().setY(c.pos.y + H * 0.7), 10, { speed: 2, size: 0.25 });
  if (isP(c)) { const B2 = c.buffs; B2.avatar = dur; c.avatar = { name: a.name, taken: a.taken || 0.6, regen: (a.heal || 0.2) / dur, col: '#a06030', mote: 'dust' }; c.formOn = 'avatar'; } /* (formOn set: no form flash or toast; the quills are the look) */
  else { c.av = { taken: a.taken || 0.6 }; c.addBuff && c.addBuff('avatar', dur); c.hots && c.hots.push({ ps: (a.heal || 0.2) * c.maxHp / dur, t: dur }); }
  let t = 0; tick((dt) => { t += dt; g.position.copy(c.pos); g.rotation.y = isP(c) ? (c.bodyYaw != null ? c.bodyYaw : c.yaw) : c.yaw || 0; const out = ease((t - dur) / 0.25);
    for (const q of qs) { const k = (t - q.userData.d) / 0.12, s = k < 0 ? 0.01 : k < 1 ? k * 1.25 : 1 + Math.sin(t * 30 + q.userData.d * 50) * 0.04 * (1 - out); q.scale.setScalar(Math.max(0.01, s * (1 - out))); }
    if (Math.random() < 0.08) V.emit('dust', c.pos.clone().setY(c.pos.y + H * 0.75), { speed: 0.6, size: 0.6, life: 1 }); if (c.dead || out >= 1) { kill(g); return true; } return false; });
  return true;
}

// ======================================================================= PRIEST
// Halo of Dawn: a spiked golden sun-crown thrown like a boomerang: out 16 m and back to his hand. Allies it passes through heal 12%
// (on the way out and again on the way back); enemies it cuts are hurt and dazzled (slowed)
const HALO = { out: 16, tOut: 0.55, tBack: 0.5, heal: 0.12 };
function sunCrown() { const g = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffb020', emissiveIntensity: 1.3, metalness: 0.8, roughness: 0.25 }); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.055, 8, 40), gold); ring.rotation.x = Math.PI / 2; g.add(ring);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, i % 2 ? 0.22 : 0.36, 4), gold); sp.position.set(Math.cos(a) * (0.5 + (i % 2 ? 0.11 : 0.18)), 0, Math.sin(a) * (0.5 + (i % 2 ? 0.11 : 0.18))); sp.rotation.set(0, -a, -Math.PI / 2); g.add(sp); }
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.2, 6, 30), addM('#fff0b0', 0.25)); glow.rotation.x = Math.PI / 2; g.add(glow); return g; }
function haloDawn(c, a, ctx) {
  const from = castFrom(c), dir = aimDirOf(c, from, ctx.T); dir.y = Math.max(-0.2, Math.min(0.2, dir.y)); dir.normalize(); faceDir(c, dir); const g = sunCrown(); g.scale.setScalar(1.6); g.position.copy(from); G.scene.add(g); const n = ctx.P(a.dmg);
  const far = from.clone().addScaledVector(dir, HALO.out); for (let k = 1; k <= 16; k++) { const q = from.clone().addScaledVector(dir, HALO.out * k / 16); if (solidAt(q.x, q.y, q.z) || q.y < gy(q) + 0.2) { far.copy(from).addScaledVector(dir, Math.max(1, HALO.out * (k - 1) / 16)); break; } }
  const passed = [new Set(), new Set()]; let t = 0, snd = 0; S.kb('halo', from, 1); anim(c, 'castRel', 0.5);
  tick((dt) => { t += dt; let p, leg; if (t < HALO.tOut) { leg = 0; const k = t / HALO.tOut; p = from.clone().lerp(far, 1 - (1 - k) * (1 - k)); } else { leg = 1; const k = Math.min(1, (t - HALO.tOut) / HALO.tBack), hand = handOf(c); p = far.clone().lerp(hand, k * k); if (k >= 1) { kill(g); S.kb('chime', hand, 0.5); V.burst('gold', hand, 16, { speed: 2 }); return true; } }
    g.position.copy(p); g.rotation.y += dt * 22; g.rotation.z = Math.sin(t * 3) * 0.12; V.emit('gold', p.clone().add(V3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)), { speed: 0.4, size: 0.3, life: 0.5 }); if ((snd -= dt) <= 0) { snd = 0.4; S.kb('halo', p, 0.5); }
    for (const u of friends(c)) { if (passed[leg].has(u) || (u === c && leg === 0)) continue; if (chest(u).distanceTo(p) > 1.7) continue; passed[leg].add(u); if (u === c) continue; heal(c, u, a.heal || HALO.heal); S.kb('chime', u.pos, 0.6); V.burst('gold', chest(u), 22, { speed: 2.5, vy: 2 }); }
    for (const u of foes(c)) { if (passed[leg].has(u)) continue; if (chest(u).distanceTo(p) > 1.5) continue; passed[leg].add(u); hurt(c, u, n, { el: 'holy', slow: a.slow || 1.5, ranged: true }); V.burst('gold', chest(u), 20, { speed: 4 }); V.light(chest(u), '#ffd870', 4, 0.15, 7); S.hit && S.hit('blunt', u.pos, 0.6); }
    return false; });
  return true;
}
// Word of Shielding: he speaks a word of light: golden letters pour out of him and stream to every ally within 14 m (and himself):
// each heals 15% and is wrapped in a ring of slowly turning letters that soaks 15% of their health for 5 s
const RUNES = 'ᚨᛒᛞᛖᚷᚹᛗᛟᛉᛊᛏᚱ';
const runeTex = (i) => canvasTex('rune' + i, 64, 64, (x, w) => { x.shadowColor = '#ffb020'; x.shadowBlur = 12; x.fillStyle = '#fff4c0'; x.font = 'bold 46px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(RUNES[i % RUNES.length], w / 2, w / 2 + 2); });
function runeSprite(i, s = 0.32) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: runeTex(i), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(s); return sp; }
function wordWard(u, dur) { const g = new THREE.Group(), sp = []; for (let i = 0; i < 6; i++) { const s = runeSprite(i * 2 + 1, 0.3); g.add(s); sp.push(s); } G.scene.add(g); let t = 0;
  tick((dt) => { t += dt; const left = shieldLeft(u), end = u.dead || t > dur || (t > 0.3 && left <= 1); if (end && !g.userData.e) { g.userData.e = t; V.burst('gold', chest(u), 14, { speed: 2 }); } const out = g.userData.e ? (t - g.userData.e) / 0.3 : 0;
    g.position.copy(u.pos).setY(u.pos.y + hgt(u) * 0.55); sp.forEach((s, i) => { const a0 = i / sp.length * Math.PI * 2 + t * 1.4; s.position.set(Math.cos(a0) * 0.75, Math.sin(t * 2 + i) * 0.15 + (i % 2 ? 0.25 : -0.2), Math.sin(a0) * 0.75); s.material.opacity = Math.min(1, t / 0.2) * (1 - out) * (0.75 + Math.sin(t * 5 + i) * 0.25); });
    if (out >= 1) { sp.forEach(s => s.material.dispose()); G.scene.remove(g); return true; } return false; }); }
function wordShielding(c, a, ctx) {
  const R = a.r || 14, who = friends(c).filter(u => u.pos.distanceTo(c.pos) < R); if (!who.includes(c)) who.push(c); const src = c.pos.clone().setY(c.pos.y + hgt(c) * 0.9);
  S.kb('word', c.pos, 1); anim(c, 'castBig', 0.6); V.light(src, '#ffe090', 6, 0.4, 12); V.burst('gold', src, 40, { speed: 3, vy: 3 });
  who.forEach((u, j) => { for (let i = 0; i < 3; i++) { const s = runeSprite(j * 3 + i, 0.36); s.position.copy(src); G.scene.add(s); const up = V3((Math.random() - 0.5) * 2, 2 + Math.random(), (Math.random() - 0.5) * 2); let t = 0; const dl = i * 0.06 + j * 0.04;
      tick((dt) => { t += dt; if (t < dl) return false; const k = Math.min(1, (t - dl) / 0.5), to = chest(u), mid = src.clone().add(up), p = src.clone().multiplyScalar((1 - k) * (1 - k)).addScaledVector(mid, 2 * k * (1 - k)).addScaledVector(to, k * k); s.position.copy(p); V.emit('gold', p.clone(), { speed: 0.2, size: 0.15, life: 0.3 });
        if (k >= 1) { s.material.dispose(); G.scene.remove(s); if (i === 2) { heal(c, u, a.heal || 0.15); shield(u, a.amount || 0.15, a.dur || 5); wordWard(u, a.dur || 5); S.kb('chime', u.pos, 0.5); } return true; } return false; }); } });
  return true;
}
// Chains of Light: a bolt of dawn; where it strikes an enemy, four golden chains burst out of the ground around them and pull taut
function chainsOn(u, dur) { const g = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffa818', emissiveIntensity: 0.9, metalness: 0.85, roughness: 0.3 }), linkG = new THREE.TorusGeometry(0.085, 0.022, 6, 12), chains = []; G.scene.add(g); const base = u.pos.clone(); base.y = gy(base);
  for (let i = 0; i < 4; i++) { const a0 = i / 4 * Math.PI * 2 + 0.5, anc = base.clone().add(V3(Math.cos(a0) * 1.5, 0, Math.sin(a0) * 1.5)); anc.y = gy(anc); const links = []; for (let k = 0; k < 12; k++) { const l = new THREE.Mesh(linkG, gold); l.visible = false; g.add(l); links.push(l); } chains.push({ anc, links });
    const glyph = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.3, 6), addM('#ffd860', 0.8)); glyph.rotation.x = -Math.PI / 2; glyph.position.copy(anc).setY(anc.y + 0.05); g.add(glyph); V.burst('gold', anc.clone().setY(anc.y + 0.2), 14, { speed: 3, vy: 3 }); V.burst('stone', anc.clone().setY(anc.y + 0.1), 5, { speed: 3, grav: 14 }); }
  S.kb('chains', base, 1); let t = 0;
  tick((dt) => { t += dt; const w = u.pos.clone().setY(u.pos.y + hgt(u) * 0.45), end = t > dur || u.dead, out = end ? Math.min(1, (t - dur) / 0.4) : 0;
    for (const ch of chains) { const d = w.clone().sub(ch.anc), L = d.length(), dn = d.clone().normalize(), shown = Math.min(ch.links.length, Math.floor(t / 0.012)); ch.links.forEach((l, k) => { const kk = (k + 0.5) / ch.links.length; l.visible = k < shown && kk > out; const sag = Math.sin(kk * Math.PI) * 0.12 * (1 + Math.sin(t * 30) * 0.2); l.position.copy(ch.anc).addScaledVector(dn, L * kk).setY(ch.anc.y + d.y * kk - sag);
        l.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, 1, 0)); l.lookAt(l.position.clone().add(dn)); l.rotateZ(k % 2 ? Math.PI / 2 : 0); }); if (out > 0 && Math.random() < 0.3) V.emit('gold', ch.anc.clone().addScaledVector(dn, L * out), { speed: 0.6, size: 0.2, life: 0.5 }); }
    if (out >= 1) { linkG.dispose(); kill(g); return true; } return false; }); }
function chainsLight(c, a, ctx) {
  const from = castFrom(c), dir = aimDirOf(c, from, ctx.T), mesh = new THREE.Group(); faceDir(c, dir); const spear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.8, 6).rotateX(Math.PI / 2), addM('#fff4c0', 1)), glow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 6).rotateX(Math.PI / 2), addM('#ffc040', 0.4)); mesh.add(spear, glow);
  S.cast && S.cast('holy', from, 0.7); anim(c, 'castRel', 0.5);
  fly(c, { from, dir, speed: 55, range: 30, mesh, radius: 0.9, spin: (m, dt, t, v) => m.lookAt(m.position.clone().add(v)), trail: (p) => V.emit('gold', p.clone(), { speed: 0.3, size: 0.22, life: 0.35 }),
    onEnd: (hit, at) => { V.burst('gold', at, 22, { speed: 4 }); if (!hit) return; hurt(c, hit, ctx.P(a.dmg), { el: 'holy', root: a.root || 2, ranged: true }); chainsOn(hit, a.root || 2); kick(c, 0.12, 0, 0.04); } });
  return true;
}

// (the owner) the priest's Blinding Light: a blast of light bursts out of her; every enemy within 8 m is blinded and runs off
// in a random direction for 2 s
function blindingLight(c, a, ctx) { const C = c.pos.clone(), R = a.r || 8, dur = a.blind || 2; anim(c, 'castBig', 0.5); S.cast && S.cast('holy', C, 1.4);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), addM('#fffbe8', 0.9)); ball.position.copy(C).setY(C.y + hgt(c) * 0.6); G.scene.add(ball); V.light(ball.position.clone(), '#fff6d0', 22, 0.5, 30); V.burst('gold', ball.position.clone(), 90, { speed: 12 }); kick(c, 0.35, 0, 0.04);
  tick((dt) => { const k = Math.min(1, (ball.userData.t = (ball.userData.t || 0) + dt) / 0.35); ball.scale.setScalar(0.5 + R * k); ball.material.opacity = 0.9 * (1 - k); if (k >= 1) { kill(ball); return true; } return false; });
  for (const u of foes(c)) { if (u.pos.distanceTo(C) > R) continue; const away = u.pos.clone().add(V3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)); /* (a random point: they flee from it) */
    hurt(c, u, ctx.P(a.dmg || 0.3), { el: 'holy', ranged: true });
    if (isP(u)) { u.fearT = Math.max(u.fearT || 0, dur); u.fearFrom = away; u.blindT = G.time + dur; G.hooks.toast && G.hooks.toast('Blinded!', '☀', 'bad'); if (u === G.player && typeof document !== 'undefined') { const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;background:#fffbe8;pointer-events:none;z-index:50;opacity:0.95'; document.body.appendChild(ov); let bt = 0; tick((dt) => { bt += dt; ov.style.opacity = String(0.95 * Math.max(0, 1 - Math.max(0, bt - dur * 0.4) / (dur * 0.6))); if (bt > dur) { ov.remove(); return true; } return false; }); } }
    else if (u.status) { u.status.fear = Math.max(u.status.fear || 0, dur); u.fearFrom = away; }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), addM('#ffffff', 0.85)); G.scene.add(glow); tick((dt) => { glow.userData.t = (glow.userData.t || 0) + dt; glow.position.copy(u.pos).setY(u.pos.y + hgt(u) * 0.92); glow.material.opacity = 0.85 * (1 - glow.userData.t / dur) * (0.7 + 0.3 * Math.sin(glow.userData.t * 20)); if (glow.userData.t > dur || u.dead) { kill(glow); return true; } return false; }); /* (a white glare over their eyes) */
    V.burst('gold', chest(u), 20, { speed: 4 }); }
  return true; }

// ======================================================================= BOMBARDIER
// Tar Bomb: a clay pot of tar lobbed where you aim splats into a black, bubbling puddle 5 m across for 6 s: enemies wading in it are
// slowed hard. The detonator (right click) sets every puddle you have out ablaze: it roars up in flame for 3 s, burning whoever is in it.
const TAR = { r: 2.6, dur: 6, burn: 3, slowT: 0.6, fireK: 0.18 };
function blobGeo(r) { const s = new THREE.Shape(), N = 22; for (let i = 0; i <= N; i++) { const a0 = i / N * Math.PI * 2, rr = r * (0.82 + Math.random() * 0.3 + (i % 5 === 0 ? 0.16 : 0)); const x = Math.cos(a0) * rr, y = Math.sin(a0) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); } return new THREE.ShapeGeometry(s); }
function tarPool(c, at, ctx, a) {
  const g = new THREE.Group(); g.position.copy(at); G.scene.add(g); const mat = new THREE.MeshStandardMaterial({ color: '#0d0907', roughness: 0.12, metalness: 0.35, emissive: '#000000', transparent: true, opacity: 0.96, polygonOffset: true, polygonOffsetFactor: -3 });
  const pool = new THREE.Mesh(blobGeo(TAR.r), mat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.05; pool.scale.setScalar(0.1); g.add(pool);
  const drops = []; for (let i = 0; i < 9; i++) { const d = new THREE.Mesh(blobGeo(0.18 + Math.random() * 0.22), mat); d.rotation.x = -Math.PI / 2; const a0 = Math.random() * Math.PI * 2, rr = TAR.r * (1.05 + Math.random() * 0.45); d.position.set(Math.cos(a0) * rr, 0.045, Math.sin(a0) * rr); g.add(d); drops.push(d); }
  const bub = []; const bubG = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(bubG, mat); b.userData = { t: Math.random() * 1.5, p: Math.random() * 1.2 + 0.6 }; b.scale.setScalar(0.01); g.add(b); bub.push(b); }
  const flames = []; const coneG = new THREE.ConeGeometry(0.35, 1, 6, 1, true).translate(0, 0.5, 0);
  const T = { g, at: at.clone(), owner: c, lit: false, t: 0, dead: false, ignite: null }; KB.tars.push(T); let slT = 0, burnT = 0, litAt = 0; const fireN = ctx.P(TAR.fireK);
  T.ignite = () => { if (T.lit || T.dead) return false; T.lit = true; litAt = T.t; mat.emissive.set('#ff3a00'); mat.emissiveIntensity = 0; S.kb('ignite', at, 1.2); S.explode && S.explode(at, 0.8, 'fire'); V.light(at.clone().setY(at.y + 1.5), '#ff7a20', 12, 0.5, 16); V.burst('fire', at.clone().setY(at.y + 0.5), 80, { speed: 6, radius: TAR.r * 1.5, vy: 4 }); kick(c, 0.3, 4);
    for (let i = 0; i < 16; i++) { const a0 = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * TAR.r * 0.9, o = new THREE.Mesh(coneG, addM(i % 3 ? '#ff6a18' : '#ffd060', 0.75)); o.position.set(Math.cos(a0) * rr, 0, Math.sin(a0) * rr); o.userData = { ph: Math.random() * 9, k: 0.8 + Math.random() * 1.2 }; o.scale.setScalar(0.01); g.add(o); flames.push(o); } return true; };
  tick((dt) => { T.t += dt; const t = T.t, sp = ease(t / 0.22), endAt = T.lit ? litAt + TAR.burn : TAR.dur, out = ease((t - endAt) / 0.6); pool.scale.setScalar(Math.max(0.01, (0.1 + 0.9 * sp) * (1 - out * 0.3))); mat.opacity = 0.96 * (1 - out); drops.forEach(d => d.scale.setScalar(Math.max(0.01, sp)));
    for (const b of bub) { b.userData.t += dt; const k = (b.userData.t % b.userData.p) / b.userData.p; if (k < dt / b.userData.p) { const a0 = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * TAR.r * 0.75; b.position.set(Math.cos(a0) * rr, 0.05, Math.sin(a0) * rr); if (Math.random() < 0.25 && !T.lit) S.kb('bubble', at, 0.4); if (k > 0) V.burst(T.lit ? 'ember' : 'smoke', at.clone().add(b.position).setY(at.y + 0.15), 3, { speed: 0.8, size: T.lit ? 0.12 : 0.25, life: 0.6, vy: 1 }); } b.scale.set(0.05 + k * 0.22, (0.05 + k * 0.2) * (1 - out), 0.05 + k * 0.22); b.visible = sp > 0.9 && out < 1; }
    if (T.lit) { const lk = t - litAt; mat.emissiveIntensity = Math.min(1.2, lk * 4) * (1 - out) * (0.8 + Math.sin(t * 17) * 0.2); for (const o of flames) { const fl = 0.7 + 0.3 * Math.sin(t * 20 + o.userData.ph); o.scale.set(1, Math.max(0.01, Math.min(1, lk / 0.15) * o.userData.k * fl * 1.6 * (1 - out)), 1); }
      if (Math.random() < 0.7) V.emit('fire', at.clone().add(V3((Math.random() - 0.5) * TAR.r * 1.6, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * TAR.r * 1.6)), { speed: 1.2, size: 0.8, life: 0.5, vy: 3 }); if (Math.random() < 0.15) V.emit('smoke', at.clone().setY(at.y + 2.2), { speed: 1, size: 2, life: 1.6, vy: 1.5 }); if (Math.random() < 0.06) V.light(at.clone().setY(at.y + 1.2), '#ff7a20', 6, 0.25, 12); }
    const live = !T.dead && out <= 0; if (live && (slT -= dt) <= 0) { slT = 0.25; for (const u of foes(c)) if (Math.hypot(u.pos.x - at.x, u.pos.z - at.z) < TAR.r + 0.2 && u.pos.y < at.y + 1.2) { slow(u, TAR.slowT); if (Math.random() < 0.4) V.burst('smoke', u.pos.clone().setY(u.pos.y + 0.1), 2, { speed: 0.6, size: 0.4 }); } }
    if (live && T.lit && (burnT -= dt) <= 0) { burnT = 0.5; for (const u of foes(c)) if (Math.hypot(u.pos.x - at.x, u.pos.z - at.z) < TAR.r + 0.3 && u.pos.y < at.y + 2) { hurt(c, u, fireN, { el: 'fire', ranged: true }); V.burst('fire', chest(u), 10, { speed: 2 }); } }
    if (out >= 1) { T.dead = true; const i = KB.tars.indexOf(T); if (i >= 0) KB.tars.splice(i, 1); kill(g); bubG.dispose(); coneG.dispose(); return true; } return false; });
}
function tarBomb(c, a, ctx) {
  const from = castFrom(c); let v; if (isP(c)) { const d = c.aimDir(from); v = d.multiplyScalar(19); v.y += 4.5; } else { const T = ctx.T; const to = T ? T.pos.clone() : c.pos.clone().addScaledVector(fwdOf(c), 10); const dist = Math.hypot(to.x - from.x, to.z - from.z); v = lobVel(from, to, Math.max(0.45, Math.min(1.1, dist / 17))); v.y += 0; }
  const pot = new THREE.Group(), clay = new THREE.MeshStandardMaterial({ color: '#9a5a32', roughness: 0.85 }), body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 9).scale(1, 0.9, 1), clay), neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.1, 10), clay), tarTop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: '#0a0806', roughness: 0.1, metalness: 0.4 }));
  neck.position.y = 0.2; tarTop.position.y = 0.25; tarTop.scale.y = 0.6; pot.add(body, neck, tarTop); faceDir(c, flatDir(v)); S.kb('tarthrow', from, 1); anim(c, 'castRel', 0.45);
  fly(c, { from, dir: v.clone().normalize(), speed: v.length(), grav: isP(c) ? 16 : 16, range: 60, mesh: pot, radius: 0.6, spin: (m, dt) => { m.rotation.x += dt * 9; m.rotation.z += dt * 4; }, trail: (p) => { if (Math.random() < 0.4) V.emit('smoke', p.clone(), { speed: 0.2, size: 0.25, life: 0.4 }); },
    onEnd: (hit, at) => { const p = (hit ? hit.pos.clone() : at.clone()); p.y = gy(p); S.kb('tarsplat', p, 1.1); V.burst('shadow', p.clone().setY(p.y + 0.3), 40, { speed: 5, size: 0.3, grav: 14, vy: 2 }); V.burst('wood', p.clone().setY(p.y + 0.3), 12, { speed: 4, grav: 14, size: 0.2 }); tarPool(c, p, ctx, a); if (hit) hurt(c, hit, ctx.P(a.dmg || 0.3), { ranged: true, slow: 1 }); } });
  return true;
}
// the detonator lights every tar puddle its owner has out (returns how many caught)
export function igniteTar(owner) { let n = 0; for (const T of KB.tars.slice()) if (T.owner === owner && T.ignite && T.ignite()) n++; return n; }

// ======================================================================= dispatch
const CAST = { kbflamewave: flameWave, kblash: lightningLash, kbfrost: frostbind, kbicewall: glacierWall, kbshards: mirrorShards, kblock: mindLock, kbmez: mesmerize, kbdecoy: mirrorImage,
  kbrend: savageRend, kbpounce: pounce, kbroar: feralRoar, kbhide: primalHide, kbhalo: haloDawn, kbword: wordShielding, kbchains: chainsLight, kbblind: blindingLight, kbtar: tarBomb };
KB.has = (t) => !!CAST[t];
KB.cast = (c, a, ctx = {}) => { try { return CAST[a.t](c, a, Object.assign({ P: (n) => n || 0 }, ctx)); } catch (e) { console.error('kitsb', a.t, e); return true; } };
// when a computer fighter uses each move (returns who to use it on, or null)
KB.want = (b, a, T, dT, hp) => {
  const recent = G.time - (b.hurtT || 0) < 2.5, st = T && stunned(T), me = b.pos;
  switch (a.t) {
    case 'kbflamewave': return T && dT < 12 ? T : null;
    case 'kblash': return T && dT < 8.5 ? T : null;
    case 'kbfrost': return T && dT < 24 && !st && (T.cast || Math.random() < 0.5) ? T : null;
    case 'kbicewall': return T && hp < 0.65 && recent && dT > 3 && dT < 24 ? T : null;
    case 'kbshards': return T && dT < 26 ? T : null;
    case 'kblock': return T && dT < 24 && (T.cast || Math.random() < 0.45) ? T : null;
    case 'kbmez': return T && dT < 24 && !st && (T.cast || dT < 6 || Math.random() < 0.35) ? T : null;
    case 'kbdecoy': return hp < 0.5 && recent ? b : null;
    case 'kbrend': return T && dT < 4.6 ? T : null;
    case 'kbpounce': return T && dT > 4 && dT < 13 ? T : null;
    case 'kbroar': return T && dT < 7 && !st ? T : null;
    case 'kbhide': return hp < 0.65 && recent ? b : null;
    case 'kbhalo': { const al = friends(b).filter(u => u !== b && u.hp / u.maxHp < 0.75 && u.pos.distanceTo(me) < 15).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]; return al || (T && dT < 15 ? T : null); }
    case 'kbword': { const n = friends(b).filter(u => u.hp / u.maxHp < 0.75 && u.pos.distanceTo(me) < (a.r || 14)).length; return n >= 2 || hp < 0.6 || (n >= 1 && recent) ? b : null; }
    case 'kbchains': return T && dT < 24 && !st ? T : null;
    case 'kbblind': return foes(b).filter(u => u.pos.distanceTo(me) < 7.5).length >= 1 ? b : null;
    case 'kbtar': return T && dT < 20 ? T : null;
  } return null; };
G.hooks.kb = KB;
// the moves themselves (pushed into ABILITIES by arena.js kitRules0; the short texts live in kitinfo.js)
export const KB_AB = {
  elementalist: [{ id: 'el_flamewave', name: 'Flame Wave', t: 'kbflamewave', kit: true, level: 1, cd: 9, cost: 0, fx: 'fire', dmg: 1.5, burn: 0.3, desc: '' },
    { id: 'el_lash', name: 'Lightning Lash', t: 'kblash', kit: true, level: 1, cd: 7, cost: 0, fx: 'arcane', dmg: 1.3, stun: 0.5, slow: 1.5, desc: '' },
    { id: 'el_frostbind', name: 'Frostbind', t: 'kbfrost', kit: true, level: 1, cd: 13, cost: 0, fx: 'frost', dmg: 0.9, stun: 1.5, spread: 3, freeze: true, desc: '' },
    { id: 'el_icewall', name: 'Glacier Wall', t: 'kbicewall', kit: true, level: 1, cd: 20, cost: 0, fx: 'frost', chip: 0.4, dur: 4, desc: '' }],
  enchanter: [{ id: 'en_shards', name: 'Mirror Shards', t: 'kbshards', kit: true, level: 1, cd: 8, cost: 0, fx: 'arcane', dmg: 1.4, desc: '' },
    { id: 'en_mindlock', name: 'Mind Lock', t: 'kblock', kit: true, level: 1, cd: 14, cost: 0, fx: 'arcane', dmg: 0.8, aoe: 3, silence: 2, desc: '' },
    { id: 'en_mesmer', name: 'Mesmerize', t: 'kbmez', kit: true, level: 1, cd: 14, cost: 0, fx: 'arcane', dmg: 0.1, stun: 3, mez: true, desc: '' },
    { id: 'en_decoy', name: 'Mirror Image', t: 'kbdecoy', kit: true, level: 1, cd: 20, cost: 0, fx: 'arcane', dur: 4, stealth: 3, desc: '' }],
  beastmaster: [{ id: 'bm_rend', name: 'Savage Rend', t: 'kbrend', kit: true, level: 1, cd: 8, cost: 0, fx: 'blood', dmg: 1.7, desc: '' },
    { id: 'bm_pounce', name: 'Pounce', t: 'kbpounce', kit: true, level: 1, cd: 10, cost: 0, fx: 'blood', dmg: 1.4, stun: 1, r: 3.2, desc: '' },
    { id: 'bm_roar', name: 'Feral Roar', t: 'kbroar', kit: true, level: 1, cd: 13, cost: 0, fx: 'dust', dmg: 0.4, stun: 1, slow: 2.5, desc: '' },
    { id: 'bm_hide', name: 'Primal Hide', t: 'kbhide', kit: true, level: 1, cd: 20, cost: 0, fx: 'dust', dur: 4, taken: 0.6, heal: 0.2, desc: '' }],
  priest: [{ id: 'pr_sunhalo', name: 'Halo of Dawn', t: 'kbhalo', kit: true, level: 1, cd: 10, cost: 0, fx: 'gold', dmg: 0.9, heal: 0.12, slow: 1.5, desc: '' },
    { id: 'pr_word2', name: 'Word of Shielding', t: 'kbword', kit: true, level: 1, cd: 16, cost: 0, fx: 'gold', heal: 0.15, amount: 0.15, dur: 5, r: 14, desc: '' },
    { id: 'pr_chains2', name: 'Chains of Light', t: 'kbchains', kit: true, level: 1, cd: 13, cost: 0, fx: 'gold', dmg: 0.6, root: 2, desc: '' },
    { id: 'pr_blind', name: 'Blinding Light', t: 'kbblind', kit: true, level: 1, cd: 14, cost: 0, fx: 'gold', dmg: 0.3, r: 8, blind: 2, desc: '' }],
  bombardier: [{ id: 'bo_tar', name: 'Tar Bomb', t: 'kbtar', kit: true, level: 1, cd: 12, cost: 0, fx: 'fire', dmg: 0.3, desc: '' }],
};
export const KB_KITS = { elementalist: ['el_flamewave', 'el_lash', 'el_frostbind'], enchanter: ['en_shards', 'en_mindlock', 'en_mesmer'], beastmaster: ['bm_rend', 'bm_pounce', 'bm_roar'], priest: ['pr_sunhalo', 'pr_word2', 'pr_blind'], bombardier: ['bo_rocket', 'bo_tar', 'bo_stickies'] };
export const KB_RMB = { elementalist: 'el_icewall', enchanter: 'en_decoy', beastmaster: 'bm_hide' };
