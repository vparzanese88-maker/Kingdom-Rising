// The five reworked ultimates (R) of the Shadow Knight, monk, druid, shaman and cleric, shared by players and computer fighters.
// Each is the class's big moment, built on its own kit, and the player keeps control (no camera takeover):
//  Shadow Knight  Hand of the Abyss: he drives his sword into the ground, a crack races to where he aims and a giant skeletal hand
//                 bursts out under the enemies there, scoops them up, crushes them (their souls stream back into him) and slams them
//                 down into the ground. Abyssal Armor: for 6 s he takes 40% less damage.
//  Monk           Palm of Heaven: a fan of golden chi arms opens behind him and punches a storm of fists down a lane in front of him,
//                 then a giant palm of light falls out of the sky on the end of it and stamps the enemies into the ground.
//  Druid          Wrath of the Elder Tree: a great tree tears up out of the ground in front of him; its roots whip out across the ground
//                 to every fighter near it, coiling round enemies' legs and blooming on allies; leaves of light fall from it for 6 s.
//  Shaman         Call of Lightning: he raises his spear, a bolt from the sky charges it, and a storm follows him for 4 s, forked
//                 bolts striking the enemies round him and leaping between them, rain healing his allies; then the storm's heart breaks.
//  Cleric         Wings of Salvation: great wings of light open from her back and lift her off the ground; a wing beat hurls nearby
//                 enemies away and lances of light strike every ally within 30 m: a big heal, cleansing, more healing over 4 s, and
//                 anyone close to death is made untouchable for 2 s.
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { ultFoes, ultFriends, ultHurt, ultHeal, ultSlow, ultGround } from './arena.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const glowM = (c, o = 0.8) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const timer = (fn) => { let t = 0; G.timers.push({ update: (dt) => { t += dt; return fn(t, dt); } }); };
const later = (s, fn) => timer((t) => { if (t >= s) { fn(); return true; } return false; });
const isMe = (c) => c === G.player;
const hgt = (u) => u === G.player ? (u.eye || 1.6) / 0.9 : (u.height || 1.8);
const lift = (u) => u === G.player ? 0 : (u.hoverH || 0);
const chest = (u) => u.pos.clone().setY(u.pos.y + lift(u) + hgt(u) * 0.58);
const fwdOf = (u) => V3(Math.sin(u.yaw || 0), 0, Math.cos(u.yaw || 0));
const gy = (p) => { try { return ultGround(p); } catch (e) { return p.y; } };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const near = (list, p, r) => list.filter(u => u && !u.dead && flat(u.pos, p) < r);
const foesOf = (c) => ultFoes(c).filter(u => u !== c);
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const backOut = (x) => { x = Math.max(0, Math.min(1, x)); const s = 1.70158; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const kill = (...ms) => { for (const m of ms) { if (!m) continue; G.scene.remove(m); m.traverse && m.traverse(o => { if (o.isMesh || o.isSprite) { o.geometry && o.geometry.dispose(); if (o.material && !o.material.userData.keep) o.material.dispose(); } }); } };
const shakeAt = (p, a) => { const P = G.player; if (!P || !P.pos) return; V.addShake(a * Math.max(0, 1 - flat(P.pos, p) / 40)); };
const stopFor = (c, s) => { if (isMe(c) || (G.player && flat(G.player.pos, c.pos) < 25)) G.hitstop = Math.max(G.hitstop || 0, s); };
const snd = (pos, fn, wet = 0.25, k = 1) => { try { S.synth && S.synth(pos, fn, wet, k); } catch (e) { /* no audio */ } };
const stun = (u, s) => { if (u === G.player) u.debuff && u.debuff('stun', s); else if (u.status) { u.status.stun = Math.max(u.status.stun || 0, s); u.cast = null; } };
const rootU = (u, s) => { if (u === G.player) u.debuff && u.debuff('root', s); else if (u.status) { u.status.root = Math.max(u.status.root || 0, s); u.rootAt = u.pos.clone(); } };
const holdU = (u, s) => { u.held = true; if (u === G.player) u.debuff && u.debuff('freeze', s); else if (u.status) { u.status.stun = Math.max(u.status.stun || 0, s); u.cast = null; } };
const setPosU = (u, p) => { u.pos.copy(p); if (u === G.player) { if (u.vel) u.vel.set(0, 0, 0); } else if (u.root && u.root.position) u.root.position.copy(p); };
const fling = (u, v) => { if (u === G.player) { if (u.vel) { u.vel.x += v.x; u.vel.z += v.z; u.vel.y = Math.max(u.vel.y || 0, v.y); u.onGround = false; } } else { if (u.status && u.status.knock) u.status.knock.add(V3(v.x, 0, v.z)); if (u.knockUp && v.y > 3) u.knockUp(Math.min(1.1, v.y / 8)); } };
const cleanse = (u) => { if (u === G.player) { if (u.db) for (const k of ['stun', 'root', 'slow', 'freeze', 'poison', 'bleed', 'burn']) if (u.db[k]) u.db[k].t = 0; u.ultSlowT = 0; } else if (u.status) { u.status.stun = 0; u.status.root = 0; u.status.slow = 0; u.status.poison = 0; u.status.bleed = 0; u.status.burn = 0; u.ultSlowT = 0; } };
const untouchable = (u, s) => { if (u === G.player) u.ultImmT = Math.max(u.ultImmT || 0, s); else u.invulnT = Math.max(u.invulnT || 0, G.time + s); };
// the hero model plays the ultimate's recording; the generic cast pose and the forced third-person time are set after the hook returns
const afterCast = (c, tp) => { if (!isMe(c)) return; later(0, () => { c.ultPoseT = 0; if (tp != null) c.tpT = tp; }); };
const texCache = {};
function canvasTex(key, w, h, draw) { if (texCache[key]) return texCache[key]; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texCache[key] = t; return t; }
const radial = (key, stops) => canvasTex(key, 64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const sprite = (tex, s, add = true, op = 1) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })); sp.scale.setScalar(s); return sp; };
const ann = (c, txt) => { try { G.hooks.arenaFeed && G.hooks.arenaFeed(txt); } catch (e) { /* (no feed) */ } };
// a jagged crack torn across the ground from a to b over dur seconds: black scorched edge, a glowing core
function groundCrack(a, b, o = {}) { const dir = b.clone().sub(a).setY(0), L = dir.length(); if (L < 0.5) return; dir.normalize(); const side = V3(dir.z, 0, -dir.x), STEP = 0.6, N = Math.max(2, Math.round(L / STEP)), parts = [];
  const seg = (p, q, w, col, op, y) => { const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) + 0.1, m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), col === 'dark' ? new THREE.MeshBasicMaterial({ color: o.dark || '#0c0014', transparent: true, opacity: op, depthWrite: false }) : glowM(col, op)); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, Math.atan2(dx, dz), 0); m.position.set((p.x + q.x) / 2, Math.max(p.y, q.y) + y, (p.z + q.z) / 2); m.renderOrder = 3; G.scene.add(m); parts.push([m, op]); };
  let made = 0, prev = a.clone(), jag = 0, tEnd = -1;
  timer((t) => { const want = Math.min(N, Math.floor(t / (o.dur || 0.2) * N));
    while (made < want) { made++; jag = Math.max(-0.5, Math.min(0.5, jag + (Math.random() - 0.5) * 0.6)); const p = a.clone().addScaledVector(dir, made * L / N).addScaledVector(side, jag * Math.min(1, made / 2, (N - made) / 2 + 0.2)); p.y = gy(p);
      seg(prev, p, o.w || 1.6, 'dark', 0.85, 0.03); seg(prev, p, (o.w || 1.6) * 0.4, o.col || '#8a30ff', 0.8, 0.05); seg(prev, p, 0.14, o.core || '#f0d0ff', 1, 0.07); if (o.fx) V.emit(o.fx, p.clone().setY(p.y + 0.2), { normal: true, speed: 1, vy: 3, size: 0.5, life: 0.6 }); prev = p; }
    if (made >= N && tEnd < 0) tEnd = t; const k = tEnd < 0 ? 1 : Math.max(0, 1 - Math.max(0, t - tEnd - (o.hold || 1.6)) / 0.8);
    for (const [m, op] of parts) m.material.opacity = op * k * (m.material.blending === THREE.AdditiveBlending ? 0.8 + Math.sin(t * 15 + m.position.x * 3) * 0.2 : 1);
    if (tEnd >= 0 && k <= 0) { for (const [m] of parts) kill(m); return true; } return false; }); }

// ======================= SHADOW KNIGHT: Hand of the Abyss =======================
export const ABYSS = { range: 12, r: 4.5, slamAt: 0.42, rise: 0.62, crush: 1.0, lifted: 1.55, slam: 1.78, crushHurt: 0.3, slamHurt: 0.15, drain: 0.12, armor: 6, stun: 1.0 };
let boneM = null;
function giantHand() { if (!boneM) { boneM = new THREE.MeshStandardMaterial({ color: '#d6cab0', roughness: 0.8, emissive: '#3c0c66', emissiveIntensity: 0.55 }); boneM.userData.keep = true; }
  const g = new THREE.Group(), m = boneM, fingers = [];
  const bone = (r0, r1, L) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 7), m); b.position.y = L / 2; return b; };
  const knob = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
  // the palm: five long bones fanned in a plate (+z towards the fingers), the wrist at -z
  const palm = new THREE.Group(); g.add(palm);
  for (let i = 0; i < 4; i++) { const x = -1.05 + i * 0.7, b = bone(0.2, 0.17, 2.6); b.rotation.x = Math.PI / 2; b.position.set(x * 0.85, 0, -1.3); palm.add(b); const k = knob(0.26); k.position.set(x, 0, 1.3); palm.add(k); }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 2.2), new THREE.MeshStandardMaterial({ color: '#1a0a24', roughness: 1, emissive: '#5a14b0', emissiveIntensity: 0.6, transparent: true, opacity: 0.75 })); plate.position.z = 0.1; palm.add(plate);
  const wrist = knob(0.75); wrist.scale.set(1.5, 0.7, 1); wrist.position.z = -1.5; palm.add(wrist);
  const fore = new THREE.Group(); fore.position.z = -1.5; fore.rotation.x = -2.75; palm.add(fore); for (const x of [-0.42, 0.42]) { const b = bone(0.42, 0.34, 7); b.position.x = x; fore.add(b); }
  for (let i = 0; i < 4; i++) { const base = new THREE.Group(); base.position.set(-1.05 + i * 0.7, 0, 1.35); base.rotation.y = (i - 1.5) * -0.08; palm.add(base); const segs = []; let par = base;
    const Ls = i === 0 || i === 3 ? [1.2, 0.95, 0.75] : [1.4, 1.1, 0.85];
    Ls.forEach((L, k) => { const s = new THREE.Group(); if (k) s.position.z = Ls[k - 1]; const b = bone(0.17 - k * 0.03, 0.14 - k * 0.03, L); b.rotation.x = Math.PI / 2; s.add(b); s.add(knob(0.2 - k * 0.03)); if (k === 2) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 6), m); tip.rotation.x = Math.PI / 2; tip.position.z = L + 0.2; s.add(tip); } par.add(s); segs.push(s); par = s; });
    fingers.push(segs); }
  { const base = new THREE.Group(); base.position.set(1.45, 0, -0.5); base.rotation.y = 1.0; palm.add(base); const segs = []; let par = base; [1.1, 0.9].forEach((L, k) => { const s = new THREE.Group(); if (k) s.position.z = 1.1; const b = bone(0.22, 0.18, L); b.rotation.x = Math.PI / 2; s.add(b); s.add(knob(0.25)); par.add(s); segs.push(s); par = s; }); fingers.push(segs); }
  // curl 0 = open (fingers splayed slightly up), 1 = a closed fist over the palm
  g.userData.curl = (k, jit = 0) => { fingers.forEach((segs, fi) => segs.forEach((s, i) => { s.rotation.x = -(0.25 + k * (fi === 4 ? 0.9 : 1.08)) + (Math.random() - 0.5) * jit; })); };
  const eye = sprite(radial('abyss', [[0, 'rgba(240,200,255,0.9)'], [0.3, 'rgba(150,60,255,0.5)'], [1, 'rgba(40,0,80,0)']]), 6); eye.position.y = 0.6; g.add(eye); g.userData.glow = eye;
  return g; }
export function shadowAbyss(c, at) {
  const T = Object.assign({}, ABYSS, G.abyssTune || {}), me = isMe(c); const f0 = fwdOf(c);
  let P = at ? at.clone() : c.pos.clone().addScaledVector(f0, 7); { const d = P.clone().sub(c.pos).setY(0), L = d.length(); if (L > T.range) P = c.pos.clone().addScaledVector(d.normalize(), T.range); if (L < 3.5) P = c.pos.clone().addScaledVector(L > 0.3 ? d.normalize() : f0, 3.5); }
  P.y = gy(P); const dir = P.clone().sub(c.pos).setY(0).normalize(), yaw = Math.atan2(dir.x, dir.z); if (!me) c.yaw = yaw; else { c.yaw = yaw; c.bodyYaw = yaw; }
  afterCast(c, 2.6);
  // Abyssal Armor: 40% less damage taken for 6 s (the War Banner's ward: it also gives +20% damage)
  c.bannerT = Math.max(c.bannerT || 0, G.time + T.armor); V.number(c.pos.clone().setY(c.pos.y + hgt(c) + 0.5), 'Abyssal Armor', 'crit');
  timer((t) => { if (c.dead || t > T.armor) return true; if (Math.random() < 0.7) { const p = c.pos.clone().setY(c.pos.y + lift(c) + 0.3 + Math.random() * hgt(c) * 0.9); p.x += (Math.random() - 0.5) * 0.9; p.z += (Math.random() - 0.5) * 0.9; V.emit(Math.random() < 0.6 ? 'shadow' : 'void', p, { normal: true, speed: 0.3, vy: 1.2, size: 0.5, size1: 0.9, life: 0.7, grav: -0.6, a0: 0.55 }); } return false; });
  // the sound: a deep rising growl as he lifts the blade
  snd(c.pos, (N, Tn) => { Tn(0, 0.5, { type: 'sawtooth', f: 48, f2: 70, gain: 0.18, a: 0.15 }); N(0, 0.45, { type: 'lowpass', f: 300, f2: 900, gain: 0.35, a: 0.2 }); N(0.05, 0.4, { type: 'bandpass', f: 1800, f2: 600, q: 3, gain: 0.12, a: 0.2 }); }, 0.3);
  const hand = giantHand(); hand.scale.setScalar(1.35); hand.rotation.order = 'YXZ'; hand.rotation.y = yaw; hand.visible = false; G.scene.add(hand); hand.userData.curl(0);
  let caught = [], slammed = false, risen = false, crushed = false, landed = false, pos0 = P.clone();
  const palmTop = () => { const p = hand.position.clone(); p.y += 0.45; return p; };
  later(T.slamAt, () => { if (c.dead) return; const tip = c.pos.clone().addScaledVector(dir, 1.6); tip.y = gy(tip);
    V.burst('void', tip.clone().setY(tip.y + 0.3), 40, { normal: true, speed: 5, size: 0.5 }); V.burst('stone', tip.clone().setY(tip.y + 0.2), 18, { speed: 6, grav: 14 }); V.light(tip.clone().setY(tip.y + 1), '#9a40ff', 8, 0.35, 12); shakeAt(c.pos, 0.6); S.graveCrack && S.graveCrack(tip);
    snd(tip, (N, Tn) => { Tn(0, 0.5, { type: 'sine', f: 70, f2: 30, gain: 0.7, a: 0.002 }); N(0, 0.35, { type: 'lowpass', f: 2500, f2: 200, gain: 0.7, a: 0.001 }); N(0.02, 0.9, { type: 'bandpass', f: 500, f2: 120, q: 1.5, gain: 0.35, a: 0.05 }); });
    groundCrack(tip, P, { dur: T.rise - T.slamAt - 0.02, w: 1.7, hold: 2.2, fx: 'void' }); });
  later(T.rise, () => { if (c.dead) return; risen = true; hand.visible = true; hand.position.copy(P).setY(P.y - 6);
    V.burst('stone', P.clone().setY(P.y + 0.4), 50, { speed: 9, grav: 14, size: 0.45 }); V.burst('dust', P.clone().setY(P.y + 0.3), 40, { speed: 6, size: 1.2 }); V.burst('void', P.clone().setY(P.y + 0.5), 70, { normal: true, speed: 7, vy: 5, size: 0.7, life: 1 }); V.light(P.clone().setY(P.y + 2), '#a050ff', 14, 0.6, 20); shakeAt(P, 0.9);
    S.boneClack && S.boneClack(P, 1.4); snd(P, (N, Tn) => { Tn(0, 0.9, { type: 'sine', f: 52, f2: 26, gain: 0.8, a: 0.003 }); N(0, 0.6, { type: 'lowpass', f: 1800, f2: 150, gain: 0.8, a: 0.002 }); for (let i = 0; i < 10; i++) N(0.05 + i * 0.05, 0.05, { type: 'bandpass', f: 1600 + Math.random() * 2400, q: 6, gain: 0.35 }); Tn(0.1, 1.2, { type: 'sawtooth', f: 90, f2: 40, gain: 0.08, a: 0.05 }); }, 0.35);
    caught = near(foesOf(c), P, T.r).map((u, i, all) => { const a = (i / Math.max(1, all.length)) * Math.PI * 2, off = all.length > 1 ? V3(Math.sin(a) * 0.55, 0, Math.cos(a) * 0.55) : V3(); holdU(u, T.slam - T.rise + 0.3); return { u, from: u.pos.clone(), off }; }); });
  later(T.crush, () => { crushed = true; stopFor(c, 0.07); shakeAt(P, 0.8); const cp = palmTop().setY(hand.position.y + 1.2);
    V.burst('void', cp, 50, { normal: true, speed: 6, size: 0.55 }); V.light(cp, '#c070ff', 10, 0.3, 14);
    snd(cp, (N, Tn) => { for (let i = 0; i < 6; i++) N(i * 0.03, 0.06, { type: 'bandpass', f: 900 + Math.random() * 900, q: 4, gain: 0.6, a: 0.001 }); Tn(0, 0.35, { type: 'square', f: 110, f2: 40, gain: 0.25, a: 0.002 }); N(0, 0.4, { type: 'lowpass', f: 1200, f2: 200, gain: 0.6 }); });
    S.soulRip && S.soulRip(c.pos);
    for (const s of caught) { const u = s.u; if (u.dead) continue; ultHurt(u, T.crushHurt, c, 'void'); V.burst('blood', chest(u), 22, { speed: 4 }); soulStream(u, c, () => { ultHeal(c, T.drain); }); } });
  later(T.slam, () => { landed = true; stopFor(c, 0.08); shakeAt(P, 1.2); const gp = P.clone().setY(P.y + 0.3);
    V.burst('stone', gp, 60, { speed: 11, grav: 16, size: 0.5 }); V.burst('dust', gp, 50, { speed: 8, size: 1.4, life: 1.1 }); V.burst('void', gp, 90, { normal: true, speed: 10, vy: 3, size: 0.8, life: 0.9 }); V.light(gp.clone().setY(gp.y + 2), '#a040ff', 16, 0.5, 24);
    S.slam && S.slam(P, 1.6); snd(P, (N, Tn) => { Tn(0, 1.1, { type: 'sine', f: 60, f2: 22, gain: 0.9, a: 0.002 }); N(0, 0.7, { type: 'lowpass', f: 3000, f2: 120, gain: 0.9, a: 0.001 }); N(0.1, 1.4, { type: 'lowpass', f: 400, f2: 60, gain: 0.5, a: 0.1 }); });
    for (let i = 0; i < 6; i++) { const a = yaw + (i / 6) * Math.PI * 2 + Math.random() * 0.4, e = P.clone().add(V3(Math.sin(a) * (4 + Math.random() * 2.5), 0, Math.cos(a) * (4 + Math.random() * 2.5))); e.y = gy(e); groundCrack(P.clone().add(V3(Math.sin(a) * 1.2, 0, Math.cos(a) * 1.2)).setY(P.y), e, { dur: 0.15, w: 0.9, hold: 1.4 }); }
    for (const s of caught) { const u = s.u; u.held = false; if (u.dead) continue; const lp = P.clone().add(s.off); lp.y = gy(lp); setPosU(u, lp); ultHurt(u, T.slamHurt, c, 'void'); stun(u, T.stun); if (u.knockUp) u.knockUp(0.8); else fling(u, V3(0, 5, 0)); V.burst('blood', chest(u), 16, { speed: 5 }); }
    ann(c, 'Hand of the Abyss'); });
  timer((t) => { if (!risen) return false; const rk = backOut((t - T.rise) / 0.32), hy = P.y - 7 + 8.4 * rk; let y = hy, curl = 0.05 + 0.25 * ease((t - T.rise) / 0.3);
    if (t >= T.crush - 0.12) curl = 0.3 + 0.75 * ease((t - (T.crush - 0.12)) / 0.14); if (t >= T.crush) { curl = 1.05; y = P.y + 1.4 + 2.2 * ease((t - T.crush) / (T.lifted - T.crush)); }
    if (t >= T.lifted) y = P.y + 3.6 - 3.9 * Math.pow(Math.min(1, (t - T.lifted) / (T.slam - T.lifted)), 2);
    if (t >= T.slam) { const k = (t - T.slam) / 0.9; y = P.y - 0.3 - 8 * ease(k); curl = 1.05 - 0.6 * ease(k * 2); }
    hand.position.set(P.x, y, P.z); hand.rotation.set(-0.55 + (t >= T.crush && t < T.slam ? Math.sin(t * 40) * 0.02 : 0) + (t >= T.lifted && t < T.slam ? 0.5 * ease((t - T.lifted) / (T.slam - T.lifted)) : 0), yaw, 0); /* (palm tilted up, the forearm standing out of the ground; it tips forward as it slams) */ hand.userData.curl(curl, crushed && !landed ? 0.04 : 0);
    hand.userData.glow.material.opacity = 0.5 + 0.3 * Math.sin(t * 20); if (Math.random() < 0.8) V.emit('void', hand.position.clone().add(V3((Math.random() - 0.5) * 3, 0.5 + Math.random(), (Math.random() - 0.5) * 3)), { normal: true, speed: 0.5, vy: 1.5, size: 0.6, size1: 1.0, life: 0.8, grav: -0.5, a0: 0.6 });
    if (t < T.rise + 0.35 && Math.random() < 0.9) V.emit('stone', P.clone().add(V3((Math.random() - 0.5) * 4, 0.3, (Math.random() - 0.5) * 4)), { speed: 5, vy: 5, grav: 14, size: 0.35 });
    if (!landed) for (const s of caught) { const u = s.u; if (u.dead) continue; const pk = ease((t - T.rise) / 0.3), tgt = palmTop().add(s.off.clone().multiplyScalar(t >= T.crush ? 0.6 : 1)); const p = s.from.clone().lerp(tgt, pk); setPosU(u, p); if (u.root && u.root.rotation) u.root.rotation.z = crushed ? Math.sin(t * 30) * 0.08 : 0; }
    if (t > T.slam + 1.0) { kill(hand); for (const s of caught) { s.u.held = false; if (s.u.root && s.u.root.rotation) s.u.root.rotation.z = 0; } return true; } return false; });
  return true;
}
// a crimson soul torn out of the victim streams along a curve into the knight
function soulStream(from, to, onArrive) { const sp = sprite(radial('u5soul', [[0, 'rgba(255,240,240,1)'], [0.25, 'rgba(255,60,90,0.9)'], [0.6, 'rgba(120,0,60,0.5)'], [1, 'rgba(40,0,30,0)']]), 1.0); G.scene.add(sp);
  const p0 = chest(from), side = V3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4); let done = false;
  timer((t) => { const k = Math.min(1, t / 0.6), e = k * k, b = chest(to), mid = p0.clone().lerp(b, 0.5).add(side).setY(Math.max(p0.y, b.y) + 2.2); const p = p0.clone().multiplyScalar((1 - e) * (1 - e)).add(mid.multiplyScalar(2 * (1 - e) * e)).add(b.multiplyScalar(e * e)); sp.position.copy(p);
    V.emit('blood', p, { speed: 0.3, size: 0.3, life: 0.35, grav: 0 }); if (k >= 1 && !done) { done = true; onArrive(); V.burst('blood', b, 12, { speed: 2 }); V.burst('void', b, 14, { normal: true, speed: 2 }); kill(sp); return true; } return false; }); }
// Soul Rend also wards him: for 1.5 s after the slash he takes 40% less damage (his block went when Shadow Chains took his right click)
export const SOUL_WARD = 1.5;
function wardSoulRend() { const K5 = G.hooks.k5; if (!K5 || K5._u5ward) return; const f = K5.soulRend; K5._u5ward = true;
  K5.soulRend = (c, ctx) => { c.bannerT = Math.max(c.bannerT || 0, G.time + SOUL_WARD); timer((t) => { if (c.dead || t > SOUL_WARD) return true; if (Math.random() < 0.5) V.emit('void', c.pos.clone().setY(c.pos.y + lift(c) + 0.4 + Math.random() * hgt(c) * 0.8).add(V3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)), { normal: true, speed: 0.3, vy: 0.8, size: 0.35, life: 0.5, a0: 0.5 }); return false; }); return f(c, ctx); }; }

// ======================= MONK: Palm of Heaven =======================
export const PALM = { lane: 12, w: 1.9, thrust: 0.4, flurry: 0.75, hitEvery: 0.1, per: 0.025, push: 0.6, fall: 1.0, land: 1.42, r: 4.2, hurt: 0.32, stun: 1.2 };
const palmTex = () => canvasTex('u5palm', 256, 256, (x) => { x.translate(128, 140); x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 10;
  const rr = (cx, cy, w, h, r) => { x.beginPath(); x.moveTo(cx - w / 2 + r, cy - h / 2); x.arcTo(cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, r); x.arcTo(cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2, r); x.arcTo(cx - w / 2, cy + h / 2, cx - w / 2, cy - h / 2, r); x.arcTo(cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, r); x.fill(); };
  rr(0, 30, 120, 120, 40); [[-45, -60, 26, 90], [-15, -78, 28, 110], [17, -74, 28, 104], [47, -55, 25, 84]].forEach(([cx, cy, w, h]) => rr(cx, cy, w, h, 13)); x.save(); x.translate(-70, 40); x.rotate(-0.7); rr(0, 0, 30, 84, 14); x.restore();
  x.globalCompositeOperation = 'destination-out'; x.shadowBlur = 0; x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.moveTo(-50, 10); x.quadraticCurveTo(0, 30, 55, 0); x.moveTo(-55, 40); x.quadraticCurveTo(-10, 55, 40, 40); x.moveTo(-30, 85); x.quadraticCurveTo(-35, 40, 0, 0); x.stroke(); });
export function monkPalm(c) {
  const T = Object.assign({}, PALM, G.palmTune || {}), me = isMe(c); let dir = fwdOf(c);
  if (me && c.aimDir) { const fw = c.aimDir(c.pos.clone().setY(c.pos.y + 1.5)); if (fw && Math.hypot(fw.x, fw.z) > 0.05) { dir = V3(fw.x, 0, fw.z).normalize(); c.yaw = c.bodyYaw = Math.atan2(dir.x, dir.z); } } else if (!me && c.target && c.target.pos) { dir = c.target.pos.clone().sub(c.pos).setY(0).normalize(); c.yaw = Math.atan2(dir.x, dir.z); }
  const side = V3(dir.z, 0, -dir.x), O = c.pos.clone(); O.y = gy(O); afterCast(c, 2.0); ultSlow(c, 0.45, 1.5); if (!me) c.invulnT = Math.max(c.invulnT || 0, G.time + 1.0);
  // a fan of golden chi arms opens behind him (a thousand-armed silhouette), each one a phantom fist
  const fan = new THREE.Group(), arms = [], armM = glowM('#ff9a20', 0.32), fistM = glowM('#ffc860', 0.6); G.scene.add(fan); const NA = 14;
  for (let i = 0; i < NA; i++) { const a = -1.75 + (i / (NA - 1)) * 3.5, g = new THREE.Group(); const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.3, 7), armM); arm.position.y = 0.65; g.add(arm); const fist = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), fistM); fist.scale.set(0.8, 0.7, 0.9); fist.position.y = 1.4; g.add(fist); g.rotation.z = a; g.userData.a = a; fan.add(g); arms.push(g); }
  const halo = sprite(radial('u5chi', [[0, 'rgba(255,250,220,0.9)'], [0.35, 'rgba(255,200,80,0.45)'], [1, 'rgba(255,140,0,0)']]), 2.6); fan.add(halo);
  S.chiHum && S.chiHum(c.pos); snd(c.pos, (N, Tn) => { [220, 277, 330, 440].forEach((f, i) => Tn(i * 0.05, 0.6, { type: 'triangle', f, f2: f * 1.5, gain: 0.05, a: 0.2 })); N(0, 0.45, { type: 'bandpass', f: 600, f2: 3000, q: 2, gain: 0.25, a: 0.3 }); }, 0.3);
  const done = new Set(), hitT = new Map(); let fistT = 0, lane = 0, farthest = null, palmMade = false, plate = null, glowP = null, at = null;
  timer((t, dt) => { if (c.dead && t < T.land) { kill(fan); if (plate) kill(plate, glowP); return true; }
    const back = c.pos.clone().addScaledVector(dir, -0.55).setY(c.pos.y + lift(c) + hgt(c) * 0.62); fan.position.copy(back); fan.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
    const open = ease(t / 0.3), gone = ease((t - T.thrust - T.flurry) / 0.3); halo.material.opacity = 0.45 * open * (1 - gone);
    arms.forEach((g, i) => { const k = open * (1 - gone); g.scale.setScalar(Math.max(0.01, k * (1 + 0.15 * Math.sin(t * 9 + i)))); g.rotation.z = g.userData.a * (0.35 + 0.65 * k); if (t > T.thrust) { const ph = ((t - T.thrust) * 9 + i * 0.37) % 1; g.children[1].position.y = 1.4 + Math.sin(ph * Math.PI) * 0.6; } });
    armM.opacity = 0.32 * (1 - gone); fistM.opacity = 0.6 * (1 - gone);
    // the barrage: phantom fists fly down the lane, every enemy in it is pummelled and driven back
    if (t >= T.thrust && t < T.thrust + T.flurry) { lane = Math.min(T.lane, (t - T.thrust) / 0.25 * T.lane); fistT -= dt;
      if (fistT <= 0) { fistT = 0.025; const g = arms[Math.floor(Math.random() * NA)]; const from = g.children[1].getWorldPosition(V3()); shootFist(from, O.clone().addScaledVector(dir, 2 + Math.random() * lane).addScaledVector(side, (Math.random() - 0.5) * T.w * 1.6).setY(c.pos.y + 0.8 + Math.random() * 1.0)); }
      for (const u of foesOf(c)) { const dx = u.pos.x - c.pos.x, dz = u.pos.z - c.pos.z, al = dx * dir.x + dz * dir.z, lat = Math.abs(dx * side.x + dz * side.z); if (al < -0.5 || al > lane + 0.5 || lat > T.w + (u.radius || 0.4)) continue;
        const nt = hitT.get(u) || 0; if (t < nt) continue; hitT.set(u, t + T.hitEvery); done.add(u); ultHurt(u, T.per, c, 'spark', true); const hp = chest(u); V.burst('spark', hp, 10, { speed: 5 }); V.sphereFlash(hp, 0.5, '#fff4c8', 0.08); S.punch ? S.punch(hp, true) : null; fling(u, dir.clone().multiplyScalar(T.push).setY(0)); if (u !== G.player && u.pos) { u.pos.addScaledVector(dir, 0.12); } if (!farthest || al > farthest.al) farthest = { u, al }; }
      if (me) V.addShake(dt * 0.6); }
    // the palm forms high over the end of the barrage and falls
    if (t >= T.fall && !palmMade) { palmMade = true; at = farthest && !farthest.u.dead ? farthest.u.pos.clone() : O.clone().addScaledVector(dir, Math.min(9, T.lane * 0.75)); at.y = gy(at);
      plate = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), new THREE.MeshBasicMaterial({ map: palmTex(), color: '#fff0b8', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })); glowP = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: palmTex(), color: '#ffa020', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      for (const m of [plate, glowP]) { m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, Math.atan2(dir.x, dir.z) + Math.PI, 0); G.scene.add(m); }
      snd(at, (N, Tn) => { N(0, T.land - T.fall, { type: 'bandpass', f: 300, f2: 2200, q: 1.2, gain: 0.45, a: 0.2 }); Tn(0, T.land - T.fall, { type: 'triangle', f: 220, f2: 660, gain: 0.06, a: 0.2 }); }, 0.3); }
    if (plate && t < T.land + 0.05) { const k = Math.min(1, (t - T.fall) / (T.land - T.fall)), y = at.y + 0.08 + 16 * (1 - k * k); plate.position.set(at.x, y, at.z); glowP.position.set(at.x, y + 0.02, at.z); const s = 0.75 + 0.25 * k; plate.scale.setScalar(s); glowP.scale.setScalar(s * (1 + 0.1 * Math.sin(t * 30)));
      if (Math.random() < 0.9) V.emit('gold', V3(at.x + (Math.random() - 0.5) * 6, y + 0.2, at.z + (Math.random() - 0.5) * 6), { speed: 0.5, vy: 4, size: 0.5, life: 0.4 }); }
    if (plate && t >= T.land && !plate.userData.hit) { plate.userData.hit = true; plate.position.y = at.y + 0.06; glowP.position.y = at.y + 0.08; plate.material.color.set('#3a2408'); plate.material.opacity = 0.85; plate.scale.setScalar(1); glowP.scale.setScalar(1);
      stopFor(c, 0.09); shakeAt(at, 1.3); const gp = at.clone().setY(at.y + 0.4); V.burst('gold', gp, 140, { speed: 12, vy: 3, size: 0.5 }); V.burst('dust', gp, 60, { speed: 9, size: 1.5, life: 1.2 }); V.burst('stone', gp, 50, { speed: 10, grav: 16, size: 0.45 }); V.light(gp.clone().setY(gp.y + 2.5), '#ffd060', 18, 0.6, 26);
      S.chiPalm && S.chiPalm(at); S.slam && S.slam(at, 1.8); snd(at, (N, Tn) => { Tn(0, 1.2, { type: 'sine', f: 64, f2: 24, gain: 1.0, a: 0.002 }); N(0, 0.8, { type: 'lowpass', f: 4000, f2: 120, gain: 1.0, a: 0.001 }); N(0.02, 1.8, { type: 'lowpass', f: 500, f2: 50, gain: 0.55, a: 0.1 }); [523, 659, 784].forEach((f, i) => Tn(0.02, 1.4, { type: 'sine', f, gain: 0.05, a: 0.01 })); }, 0.35);
      for (const u of near(foesOf(c), at, T.r)) { ultHurt(u, T.hurt, c, 'gold'); stun(u, T.stun); const pu = u.pos.clone().sub(at).setY(0); if (pu.lengthSq() < 0.01) pu.copy(dir); pu.normalize(); if (u === G.player && u.knock) u.knock(pu.multiplyScalar(4), T.stun); else { fling(u, pu.multiplyScalar(4).setY(4)); if (u.knockUp) u.knockUp(0.9); } V.burst('gold', chest(u), 30, { speed: 6 }); }
      ann(c, 'Palm of Heaven'); }
    if (plate && plate.userData.hit) { const k = Math.max(0, 1 - (t - T.land - 1.6) / 1.0); plate.material.opacity = 0.85 * k; glowP.material.opacity = 0.9 * Math.max(0, 1 - (t - T.land) / 0.9) + 0.35 * k * (0.7 + 0.3 * Math.sin(t * 12)); }
    if (t > T.land + 2.7) { kill(fan, plate, glowP); return true; } return false; });
  return true;
}
const fistGeo = new THREE.SphereGeometry(0.26, 10, 8);
function shootFist(from, to) { const m = new THREE.Mesh(fistGeo, glowM('#ffe8a0', 0.9)); m.material.userData.keep = false; m.scale.set(1, 0.85, 1.4); m.position.copy(from); m.lookAt(to); G.scene.add(m); const d = from.distanceTo(to), dur = Math.max(0.06, d / 55);
  timer((t) => { const k = Math.min(1, t / dur); m.position.lerpVectors(from, to, k); V.emit('gold', m.position, { speed: 0.2, size: 0.3, life: 0.15 }); if (k >= 1) { V.burst('spark', to, 4, { speed: 3 }); m.parent && G.scene.remove(m); m.material.dispose(); return true; } return false; }); }

// ======================= DRUID: Wrath of the Elder Tree =======================
export const ELDER = { grow: 0.38, r: 15, rootDur: 0.45, hurt: 0.2, root: 1.6, slow: 2.5, heal: 0.25, pulse: 0.05, life: 6.5, hr: 12 };
let barkM = null, leafM = null, rootM = null;
function elderTree() { if (!barkM) { barkM = new THREE.MeshStandardMaterial({ color: '#5b3d24', roughness: 0.95, emissive: '#0f2a06', emissiveIntensity: 0.6, flatShading: true }); leafM = new THREE.MeshStandardMaterial({ color: '#4a9a2e', roughness: 0.8, emissive: '#2a6a12', emissiveIntensity: 0.55, flatShading: true }); for (const m of [barkM, leafM]) m.userData.keep = true; }
  const g = new THREE.Group(), trunk = new THREE.Group(); g.add(trunk); let y = 0, x = 0, z = 0; const segs = [];
  for (let i = 0; i < 6; i++) { const L = 1.5, r0 = 1.05 - i * 0.14, r1 = r0 - 0.14, m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 9), barkM); const dx = Math.sin(i * 1.3) * 0.18, dz = Math.cos(i * 1.7) * 0.18; m.position.set(x + dx / 2, y + L / 2, z + dz / 2); m.rotation.set(dz * 0.6, 0, -dx * 0.6); trunk.add(m); segs.push(m); x += dx; z += dz; y += L * 0.97; }
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.4, b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 3.4, 6), barkM); b.position.set(x + Math.sin(a) * 1.2, y - 1.8 + i * 0.25, z + Math.cos(a) * 1.2); b.rotation.set(Math.cos(a) * 0.95, 0, -Math.sin(a) * 0.95); trunk.add(b); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2, b = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 6), barkM); b.position.set(Math.sin(a) * 0.9, 0.5, Math.cos(a) * 0.9); b.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1); trunk.add(b); } /* (buttress roots flaring at the foot) */
  const crown = new THREE.Group(); crown.position.set(x, y, z); g.add(crown); const blobs = [];
  for (let i = 0; i < 13; i++) { const a = i / 13 * Math.PI * 2 * 2.3, r = i === 0 ? 0 : 1.6 + (i % 3) * 1.0, m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + (i % 4) * 0.45, 0), leafM); m.position.set(Math.sin(a) * r, 0.4 + (i % 4) * 0.55 - r * 0.25, Math.cos(a) * r); m.rotation.set(i, i * 2, 0); crown.add(m); blobs.push(m); }
  const blooms = []; for (let i = 0; i < 16; i++) { const sp = sprite(radial('u5bloom', [[0, 'rgba(255,255,240,1)'], [0.3, 'rgba(190,255,140,0.7)'], [1, 'rgba(60,200,40,0)']]), 0.9); const a = Math.random() * 6.28, r = 1 + Math.random() * 3.6; sp.position.set(Math.sin(a) * r, Math.random() * 2.4 - 0.4, Math.cos(a) * r); crown.add(sp); blooms.push(sp); }
  g.userData = { trunk, crown, blobs, blooms, top: y }; return g; }
// a root whips out of the ground from a to b, arching in and out of the earth like a serpent; onReach when its tip gets there
function whipRoot(a, b, dur, onReach) { if (!rootM) { rootM = new THREE.MeshStandardMaterial({ color: '#4e331e', roughness: 0.95, emissive: '#143a08', emissiveIntensity: 0.5, flatShading: true }); rootM.userData.keep = true; }
  const L = flat(a, b), N = Math.max(6, Math.round(L / 0.55)), pts = [], hump = 0.5 + Math.random() * 0.4, ph = Math.random() * 6.28, side = V3(b.z - a.z, 0, -(b.x - a.x)).normalize(), wig = (Math.random() - 0.5) * 1.6;
  for (let i = 0; i <= N; i++) { const s = i / N, p = a.clone().lerp(b, s).addScaledVector(side, Math.sin(s * Math.PI) * wig); p.y = gy(p) + Math.max(-0.15, Math.sin(s * Math.PI * 3 + ph) * hump * (1 - s * 0.5)) + 0.1; pts.push(p); }
  const g = new THREE.Group(), segs = []; G.scene.add(g);
  for (let i = 0; i < N; i++) { const p = pts[i], q = pts[i + 1], r = 0.36 * (1 - i / N) + 0.08, m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, p.distanceTo(q) + 0.12, 6), rootM); m.position.copy(p).lerp(q, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), q.clone().sub(p).normalize()); m.visible = false; g.add(m); segs.push(m); }
  let reached = false; timer((t) => { const k = Math.min(1, t / dur), n = Math.floor(k * N); for (let i = 0; i < N; i++) segs[i].visible = i < n || reached; const tip = pts[Math.min(N, n)];
    if (!reached && Math.random() < 0.9) { V.emit('dust', tip.clone().setY(tip.y + 0.1), { speed: 2, vy: 2.5, size: 0.6, life: 0.5 }); V.emit('stone', tip, { speed: 3, vy: 3, grav: 14, size: 0.2 }); }
    if (k >= 1 && !reached) { reached = true; onReach && onReach(b); } return reached; });
  return g; }
// a living vine coils round a victim's legs and holds them
function coil(u, life) { const pts = [], R = 0.55, H = 1.4; for (let i = 0; i <= 40; i++) { const s = i / 40, a = s * Math.PI * 2 * 3.2; pts.push(V3(Math.sin(a) * R * (1 - s * 0.3), s * H, Math.cos(a) * R * (1 - s * 0.3))); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.09, 6), rootM); const thorns = []; for (let i = 0; i < 10; i++) { const th = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 4), rootM); const p = pts[4 + i * 3]; th.position.copy(p).multiplyScalar(1.15).setY(p.y); th.lookAt(V3(p.x * 3, p.y, p.z * 3)); th.rotateX(Math.PI / 2); m.add(th); thorns.push(th); }
  G.scene.add(m); timer((t) => { if (!u.dead) m.position.copy(u.pos).setY(u.pos.y + lift(u)); const k = Math.min(1, t / 0.2), out = Math.max(0, (t - life) / 0.35); m.scale.set(1, Math.max(0.01, k * (1 - out)), 1); if (t > life + 0.35 || u.dead) { kill(m); return true; } return false; }); }
export function druidElder(c) {
  const T = Object.assign({}, ELDER, G.elderTune || {}), me = isMe(c), dir = fwdOf(c), P = c.pos.clone().addScaledVector(dir, -1.2).addScaledVector(V3(dir.z, 0, -dir.x), 3.2); P.y = gy(P); /* (at his left shoulder, a little behind him: it stands over him like a guardian and never blocks his view) */ afterCast(c, 2.2);
  snd(c.pos, (N, Tn) => { N(0, 0.6, { type: 'lowpass', f: 300, f2: 800, gain: 0.4, a: 0.3 }); Tn(0, 0.5, { type: 'sine', f: 50, f2: 80, gain: 0.3, a: 0.3 }); [392, 494, 587].forEach((f, i) => Tn(0.1 + i * 0.08, 0.6, { type: 'sine', f, gain: 0.04, a: 0.1 })); }, 0.3);
  const tree = elderTree(), U = tree.userData; tree.position.copy(P); tree.rotation.y = Math.random() * 6.28; tree.visible = false; G.scene.add(tree); let grown = false, roots = [], pulseT = 1, gone = false;
  later(T.grow, () => { if (c.dead) return; grown = true; tree.visible = true; const gp = P.clone().setY(P.y + 0.4);
    V.burst('stone', gp, 60, { speed: 9, grav: 14, size: 0.45 }); V.burst('dust', gp, 50, { speed: 7, size: 1.4, life: 1.1 }); V.burst('leaf', gp.clone().setY(gp.y + 2), 60, { speed: 7, vy: 5, size: 0.4, life: 1.6 }); V.light(gp.clone().setY(gp.y + 3), '#a0ff70', 14, 0.6, 22); shakeAt(P, 1.0);
    S.treeFall && S.treeFall(P); S.rootBurrow && S.rootBurrow(P, 0.9); snd(P, (N, Tn) => { Tn(0, 1.0, { type: 'sine', f: 55, f2: 28, gain: 0.8, a: 0.003 }); N(0, 0.9, { type: 'lowpass', f: 1500, f2: 150, gain: 0.8, a: 0.002 }); for (let i = 0; i < 12; i++) N(0.05 + i * 0.06, 0.07, { type: 'bandpass', f: 500 + Math.random() * 900, q: 5, gain: 0.45 }); }, 0.35);
    // a root to every fighter near the tree (enemies are seized; allies bloom), and a few more clawing at the ground
    const foes = near(foesOf(c), P, T.r), pals = near(ultFriends(c), P, T.r); const tg = foes.map(u => [u, 1]).concat(pals.map(u => [u, 0]));
    tg.forEach(([u, bad], i) => { later(i * 0.04, () => { if (u.dead) return; const a = u.pos.clone(); a.y = gy(a); const from = P.clone().add(a.clone().sub(P).setY(0).normalize().multiplyScalar(0.9)); from.y = P.y;
      roots.push(whipRoot(from, a, T.rootDur * Math.max(0.5, flat(P, a) / 10), () => { if (u.dead) return; const cp = chest(u);
        if (bad) { ultHurt(u, T.hurt, c, 'leaf'); rootU(u, T.root); ultSlow(u, 0.5, T.root + T.slow); coil(u, T.root); V.burst('wood', cp, 16, { speed: 4 }); V.burst('blood', cp, 10, { speed: 3 }); S.rootSnare && S.rootSnare(u.pos); }
        else { ultHeal(u, T.heal); V.burst('heal', cp, 30, { speed: 3, vy: 3 }); V.burst('leaf', cp, 20, { speed: 3, vy: 3 }); V.burst('green', u.pos.clone().setY(u.pos.y + 0.3), 24, { speed: 2, vy: 4 }); } })); }); });
    for (let i = 0; i < Math.max(3, 7 - tg.length); i++) { const a = Math.random() * 6.28, e = P.clone().add(V3(Math.sin(a) * (5 + Math.random() * 4), 0, Math.cos(a) * (5 + Math.random() * 4))); e.y = gy(e); roots.push(whipRoot(P.clone().add(V3(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9)), e, T.rootDur * 0.9, null)); }
    ann(c, 'Wrath of the Elder Tree'); });
  timer((t, dt) => { if (!grown) return false; const a = t - T.grow, gk = backOut(a / 0.75), wither = Math.max(0, (a - T.life) / 1.1);
    U.trunk.scale.set(0.6 + 0.4 * gk, Math.max(0.01, gk), 0.6 + 0.4 * gk); U.crown.position.y = U.top * Math.max(0.01, gk); U.trunk.rotation.y = (1 - gk) * 1.2;
    U.blobs.forEach((b, i) => { const k = backOut((a - 0.35 - i * 0.03) / 0.45); b.scale.setScalar(Math.max(0.01, k * (1 - wither))); b.position.y += Math.sin(t * 1.5 + i) * dt * 0.05; });
    U.blooms.forEach((b, i) => { b.material.opacity = Math.max(0, Math.min(1, (a - 0.8) / 0.4)) * (0.6 + 0.4 * Math.sin(t * 4 + i)) * (1 - wither); });
    tree.position.y = P.y - wither * 9; if (wither > 0) leafM.color.setRGB(0.29 + wither * 0.3, 0.6 - wither * 0.25, 0.18);
    if (a > 0.9 && a < T.life) { if (Math.random() < 0.8) V.emit('leaf', P.clone().add(V3((Math.random() - 0.5) * 9, U.top + Math.random() * 2, (Math.random() - 0.5) * 9)), { speed: 0.6, vy: -0.5, size: 0.35, life: 2.4, grav: 1.2, normal: true }); if (Math.random() < 0.5) V.emit('heal', P.clone().add(V3((Math.random() - 0.5) * 10, U.top - 1 + Math.random() * 3, (Math.random() - 0.5) * 10)), { speed: 0.3, vy: -1.2, size: 0.25, life: 1.6 });
      pulseT -= dt; if (pulseT <= 0) { pulseT = 1; for (const u of near(ultFriends(c), P, T.hr)) { ultHeal(u, T.pulse); V.burst('leaf', chest(u), 6, { speed: 1.5 }); } } }
    if (wither > 0 && !gone) { gone = true; S.treeFall && S.treeFall(P); V.burst('leaf', P.clone().setY(P.y + U.top), 80, { speed: 4, size: 0.4, life: 2, normal: true }); for (const r of roots) timer((tt) => { r.position.y = -tt * 1.6; if (tt > 1) { kill(r); return true; } return false; }); }
    if (wither >= 1) { kill(tree); leafM.color.set('#4a9a2e'); return true; } return false; });
  return true;
}

// ======================= SHAMAN: Call of Lightning =======================
export const STORM = { charge: 0.65, dur: 4.0, every: 0.28, healR: 18, healBolt: 0.035, r: 14, hop: 8, hops: 3, strike: 0.045, jump: 0.035, rain: 0.03, finale: 0.1, finStun: 0.8, slow: 0.8 };
const boltCore = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), up = V3(0, 1, 0);
// a forked bolt from a to b: a white-hot core in a blue glow, flickering out in a fifth of a second
function bolt(a, b, o = {}) { const g = new THREE.Group(), L = a.distanceTo(b), N = Math.max(3, Math.round(L / (o.step || 1.1))), d = b.clone().sub(a), ax = d.clone().normalize(), s1 = V3(ax.z, 0, -ax.x); if (s1.lengthSq() < 0.01) s1.set(1, 0, 0); s1.normalize(); const s2 = ax.clone().cross(s1).normalize();
  const core = glowM('#ffffff', 1), glow = glowM(o.col || '#4a90ff', 0.4), mats = [core, glow]; const jag = o.jag || Math.min(1.4, L * 0.08);
  const path = (p0, p1, n, j, w) => { const pts = [p0]; for (let i = 1; i < n; i++) { const s = i / n, p = p0.clone().lerp(p1, s).addScaledVector(s1, (Math.random() - 0.5) * 2 * j).addScaledVector(s2, (Math.random() - 0.5) * 2 * j); pts.push(p); } pts.push(p1);
    for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], l = p.distanceTo(q), mid = p.clone().lerp(q, 0.5), qu = new THREE.Quaternion().setFromUnitVectors(up, q.clone().sub(p).normalize());
      for (const [m, r] of [[core, w], [glow, w * 3.2]]) { const c = new THREE.Mesh(boltCore, m); c.scale.set(r, l + r, r); c.position.copy(mid); c.quaternion.copy(qu); g.add(c); } } return pts; };
  const pts = path(a, b, N, jag, o.w || 0.06);
  for (let f = 0; f < (o.forks ?? 2); f++) { const i = 1 + Math.floor(Math.random() * (pts.length - 2)), p = pts[i], e = p.clone().addScaledVector(ax, L * 0.15).addScaledVector(s1, (Math.random() - 0.5) * L * 0.4).addScaledVector(s2, (Math.random() - 0.5) * L * 0.3); path(p, e, 3, jag * 0.6, (o.w || 0.06) * 0.6); }
  G.scene.add(g); const life = o.life || 0.22; timer((t) => { const k = 1 - t / life, fl = Math.random() < 0.3 ? 0.3 : 1; core.opacity = Math.max(0, k) * fl; glow.opacity = 0.4 * Math.max(0, k) * fl; if (t >= life) { G.scene.remove(g); mats.forEach(m => m.dispose()); return true; } return false; }); }
let cloudTex = null;
export function shamanStorm(c) {
  const T = Object.assign({}, STORM, G.stormTune || {}), me = isMe(c); afterCast(c, 1.8); if (!me) c.invulnT = Math.max(c.invulnT || 0, G.time + 1.0);
  if (!cloudTex) cloudTex = radial('u5cloud', [[0, 'rgba(70,74,88,0.95)'], [0.55, 'rgba(40,42,52,0.75)'], [1, 'rgba(20,20,26,0)']]);
  const CH = 12, cloud = new THREE.Group(), puffs = [], flashes = []; G.scene.add(cloud);
  for (let i = 0; i < 26; i++) { const a = i * 2.4, r = i < 4 ? i * 0.9 : 2.5 + (i % 7) * 1.25, sp = sprite(cloudTex, 6 + (i % 5) * 1.6, false, 0); sp.position.set(Math.sin(a) * r, (Math.random() - 0.5) * 1.6 - r * 0.08, Math.cos(a) * r); sp.userData = { a, r, s: sp.scale.x }; cloud.add(sp); puffs.push(sp); }
  for (let i = 0; i < 6; i++) { const fl = sprite(radial('u5flash', [[0, 'rgba(220,240,255,1)'], [0.35, 'rgba(120,180,255,0.5)'], [1, 'rgba(40,80,200,0)']]), 9, true, 0); fl.position.set((Math.random() - 0.5) * 9, -0.6, (Math.random() - 0.5) * 9); cloud.add(fl); flashes.push(fl); }
  const tipOf = () => c.pos.clone().setY(c.pos.y + lift(c) + hgt(c) * 1.12);
  snd(c.pos, (N, Tn) => { N(0, 0.9, { type: 'lowpass', f: 200, f2: 700, gain: 0.5, a: 0.5 }); N(0, 0.9, { type: 'bandpass', f: 400, f2: 1800, q: 0.8, gain: 0.2, a: 0.6 }); Tn(0, 0.9, { type: 'sawtooth', f: 40, f2: 80, gain: 0.08, a: 0.5 }); }, 0.35);
  const thunder = (p, big) => { if (S.kb) S.kb('thunder', p, big ? 1.4 : 0.8); else S.cast && S.cast('lightning', p, big ? 1.4 : 0.7); };
  const struck = new Map(), healed = new Map(); let wave = 0, waveT = 0, charged = false, fin = false, flT = 0;
  const strike = (from, u, frac, sky) => { if (!u || u.dead) return; const to = chest(u); bolt(from, to, { w: sky ? 0.09 : 0.055, forks: sky ? 3 : 1, life: sky ? 0.25 : 0.18 }); if (sky) bolt(from, to, { w: 0.04, forks: 1, col: '#b8a0ff', life: 0.18 });
    V.light(to, '#bfe0ff', sky ? 10 : 6, 0.2, 14); V.burst('lightning', to, sky ? 26 : 14, { speed: 8, size: 0.16 }); V.burst('spark', to, 10, { speed: 6, size: 0.12 }); ultHurt(u, frac, c, 'lightning', !sky); ultSlow(u, 0.6, T.slow); struck.set(u, G.time);
    if (sky) { const gp = u.pos.clone(); gp.y = gy(gp) + 0.2; V.burst('smoke', gp, 14, { speed: 2, vy: 2, size: 0.9, life: 0.9 }); thunder(to, false); } else S.kb ? S.kb('zapsmall', to, 1) : null; };
  timer((t, dt) => { if (c.dead && !fin) { fin = true; } const C = c.pos.clone(), base = gy(C), grow = ease(t / 0.8), fade = ease((t - T.charge - T.dur - 0.3) / 0.9);
    cloud.position.lerp(V3(C.x, base + CH, C.z), t < 0.05 ? 1 : Math.min(1, dt * 3)); cloud.rotation.y += dt * 0.35;
    puffs.forEach((p, i) => { p.material.opacity = 0.92 * grow * (1 - fade); p.scale.setScalar(p.userData.s * (0.4 + 0.6 * grow)); const a = p.userData.a + t * (0.25 + 0.4 / (1 + p.userData.r)); p.position.x = Math.sin(a) * p.userData.r * (0.5 + 0.5 * grow); p.position.z = Math.cos(a) * p.userData.r * (0.5 + 0.5 * grow); });
    flT -= dt; if (flT <= 0 && fade < 1) { flT = 0.08 + Math.random() * 0.25; const f = flashes[Math.floor(Math.random() * flashes.length)]; f.material.opacity = 0.9 * grow; f.position.set((Math.random() - 0.5) * 9, -0.8, (Math.random() - 0.5) * 9); }
    for (const f of flashes) f.material.opacity *= Math.max(0, 1 - dt * 14);
    if (t < T.charge && Math.random() < 0.7) { const tip = tipOf(); bolt(tip, tip.clone().add(V3((Math.random() - 0.5) * 2.4, (Math.random() - 0.3) * 1.6, (Math.random() - 0.5) * 2.4)), { w: 0.025, forks: 0, life: 0.08, step: 0.4, jag: 0.25 }); V.emit('lightning', tip, { speed: 1.5, size: 0.14, life: 0.25 }); }
    if (!charged && t >= T.charge) { charged = true; const tip = tipOf(); bolt(cloud.position.clone().setY(cloud.position.y - 0.5), tip, { w: 0.11, forks: 4, life: 0.32 }); bolt(cloud.position.clone(), tip, { w: 0.07, forks: 2, col: '#c0a8ff', life: 0.3 });
      V.light(tip, '#d8ecff', 18, 0.35, 26); V.burst('lightning', tip, 60, { speed: 10, size: 0.18 }); V.burst('frost', c.pos.clone().setY(c.pos.y + 0.3), 40, { speed: 8, vy: 1 }); shakeAt(c.pos, 0.8); stopFor(c, 0.05); thunder(tip, true);
      for (const u of near(ultFriends(c), c.pos, T.r)) { ultHeal(u, T.rain); V.burst('water', chest(u), 10, { speed: 2 }); } }
    // the storm: a forked bolt every few tenths of a second on an enemy round him, leaping on to the ones beside it
    if (charged && t < T.charge + T.dur) { if (Math.random() < 0.9) { const k = T.r * 0.8; V.emit('water', V3(C.x + (Math.random() - 0.5) * k * 2, base + 7 + Math.random() * 3, C.z + (Math.random() - 0.5) * k * 2), { normal: true, speed: 0.2, vy: -14, size: 0.12, life: 0.55, grav: 0, a0: 0.6 }); }
      if (Math.random() < 0.35) { const tip = tipOf(); bolt(tip, tip.clone().add(V3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.6)), { w: 0.02, forks: 0, life: 0.07, step: 0.35, jag: 0.2 }); }
      waveT -= dt; if (waveT <= 0) { waveT = T.every; wave++; const fs = near(foesOf(c), C, T.r).sort((x, y) => (struck.get(x) || 0) - (struck.get(y) || 0));
        if (fs.length) { const u = fs[0], sky = V3(u.pos.x + (Math.random() - 0.5) * 3, cloud.position.y - 0.5, u.pos.z + (Math.random() - 0.5) * 3); strike(sky, u, T.strike, true); shakeAt(u.pos, 0.25);
          let prev = u; const hit = new Set([u]); for (let h = 0; h < T.hops; h++) { const nx = near(foesOf(c), prev.pos, T.hop).filter(v => !hit.has(v)).sort((x, y) => flat(x.pos, prev.pos) - flat(y.pos, prev.pos))[0]; if (!nx) break; hit.add(nx); const pf = prev; later(0.07 * (h + 1), () => strike(chest(pf), nx, T.jump, false)); prev = nx; } }
        else { const a = Math.random() * 6.28, q = C.clone().add(V3(Math.sin(a) * (4 + Math.random() * 6), 0, Math.cos(a) * (4 + Math.random() * 6))); q.y = gy(q); bolt(V3(q.x, cloud.position.y - 0.5, q.z), q, { w: 0.08, forks: 2 }); V.light(q.clone().setY(q.y + 1), '#cfe8ff', 8, 0.2, 14); V.burst('lightning', q.clone().setY(q.y + 0.2), 16, { speed: 6 }); thunder(q, false); }
        { const pals = near(ultFriends(c).concat(c), C, T.healR).filter((u, i, a) => a.indexOf(u) === i && !u.dead).sort((x, y) => (healed.get(x) || 0) - (healed.get(y) || 0)); const u = pals[0]; /* (the owner: green lightning that heals: every wave a green bolt from the cloud strikes him or an ally, the one struck longest ago, reaching a little further than the storm's damage) */
          if (u) { healed.set(u, G.time); const to = chest(u), sky = V3(u.pos.x + (Math.random() - 0.5) * 2, cloud.position.y - 0.5, u.pos.z + (Math.random() - 0.5) * 2); bolt(sky, to, { w: 0.08, forks: 2, col: '#3aff6a', life: 0.24 }); bolt(sky, to, { w: 0.035, forks: 1, col: '#b0ffb0', life: 0.18 }); V.light(to, '#7aff9a', 8, 0.2, 12); V.burst('heal', to, 18, { speed: 3, vy: 2 }); V.burst('leaf', to, 8, { speed: 3 }); ultHeal(u, T.healBolt); } } } }
    // the finale: the storm's heart breaks over him, a bolt on every enemy round him at once
    if (!fin && t >= T.charge + T.dur) { fin = true; const tip = tipOf(); bolt(cloud.position.clone().setY(cloud.position.y - 0.5), tip, { w: 0.13, forks: 5, life: 0.35 }); V.light(tip, '#e8f4ff', 22, 0.4, 30); shakeAt(c.pos, 1.1); stopFor(c, 0.07); thunder(tip, true);
      snd(c.pos, (N, Tn) => { Tn(0, 1.4, { type: 'sine', f: 58, f2: 24, gain: 0.8, a: 0.002 }); N(0.05, 2.0, { type: 'lowpass', f: 600, f2: 50, gain: 0.7, a: 0.1 }); }, 0.4);
      for (const u of near(foesOf(c), c.pos, T.r)) { strike(V3(u.pos.x, cloud.position.y - 0.5, u.pos.z), u, T.finale, true); later(0.03, () => !u.dead && strike(tip, u, 0, false)); stun(u, T.finStun); }
      ann(c, 'Call of Lightning'); }
    if (t > T.charge + T.dur + 1.3) { kill(cloud); return true; } return false; });
  return true;
}

// ======================= CLERIC: Wings of Salvation =======================
export const WINGS = { open: 0.45, beat: 0.7, dur: 4.4, hover: 1.5, range: 30, heal: 0.35, hot: 0.03, hotEvery: 0.5, hotDur: 4, saveAt: 0.35, save: 2, blast: 7.5, blastHurt: 0.08, push: 9 };
const featherTex = () => canvasTex('u5feather', 64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,244,210,1)'); g.addColorStop(1, 'rgba(255,200,90,1)'); x.fillStyle = g; x.beginPath(); x.moveTo(w / 2, 0); x.bezierCurveTo(w * 1.05, h * 0.25, w * 0.95, h * 0.8, w / 2, h); x.bezierCurveTo(w * 0.05, h * 0.8, -w * 0.05, h * 0.25, w / 2, 0); x.fill(); x.strokeStyle = 'rgba(220,170,80,0.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, 4); x.lineTo(w / 2, h - 4); x.stroke(); });
function wing(sgn) { const g = new THREE.Group(), feathers = [], body = new THREE.MeshBasicMaterial({ map: featherTex(), transparent: true, alphaTest: 0.1, depthWrite: false, side: THREE.DoubleSide, color: '#ffffff' }), glow = new THREE.MeshBasicMaterial({ map: featherTex(), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, color: '#ffc850' });
  const rows = [[11, 3.4, 0.5, 0.0], [9, 2.3, 0.42, 0.06], [7, 1.3, 0.36, 0.12]];
  for (const [n, L, W, dz] of rows) for (let i = 0; i < n; i++) { const s = i / (n - 1), a = 0.25 + s * 1.95, len = L * (0.55 + 0.45 * Math.sin(Math.min(1, s * 1.15) * Math.PI * 0.85)), root = V3(s * 2.0 * (L > 3 ? 1 : L / 3), 0.6 - s * 0.6, 0);
    const piv = new THREE.Group(); piv.position.copy(root); piv.position.z = -dz; for (const [m, k] of [[body, 1], [glow, 1.35]]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(W * k, len * k), m); f.position.y = -len * k / 2; piv.add(f); } piv.rotation.z = a; piv.userData.a = a; g.add(piv); feathers.push(piv); }
  g.scale.x = sgn; g.userData = { feathers, mats: [body, glow] }; return g; }
export function clericWings(c, aim) {
  const T = Object.assign({}, WINGS, G.wingsTune || {}), me = isMe(c); afterCast(c, T.dur + 0.4); untouchable(c, T.beat + 0.3);
  const rig = new THREE.Group(), L = wing(1), R = wing(-1); rig.add(L, R); L.position.y = R.position.y = 0; const WS = 0.62; /* (a span of about 6 m: big, but never a wall in front of the camera) */ G.scene.add(rig); const halo = sprite(radial('u5halo', [[0, 'rgba(255,255,240,1)'], [0.3, 'rgba(255,220,120,0.6)'], [1, 'rgba(255,170,40,0)']]), 3.5); rig.add(halo);
  S.castRise ? S.castRise(T.beat, 'holy') : null; snd(c.pos, (N, Tn) => { [523, 659, 784, 1047].forEach((f, i) => Tn(i * 0.06, 1.6, { type: 'sine', f, gain: 0.06, a: 0.2 })); [262, 330, 392].forEach(f => Tn(0, 1.8, { type: 'triangle', f, gain: 0.05, a: 0.3 })); N(0, 0.6, { type: 'bandpass', f: 1200, f2: 5000, q: 1, gain: 0.2, a: 0.3 }); }, 0.4);
  const hots = []; let beaten = false, flapT = 0;
  timer((t, dt) => { const open = ease(t / T.open), fold = ease((t - T.dur) / 0.5); if (c.dead && !fold) { kill(rig); c.hoverH = 0; return true; }
    c.hoverH = T.hover * ease(t / 0.6) * (1 - fold); if (!me && (c.model || c.ch) && (c.model || c.ch).root) (c.model || c.ch).root.position.y += c.hoverH;
    const yaw = me ? (c.bodyYaw ?? c.yaw) : (c.yaw || 0), f = V3(Math.sin(yaw), 0, Math.cos(yaw)); const back = c.pos.clone().addScaledVector(f, -0.32).setY(c.pos.y + lift(c) + hgt(c) * 0.68);
    rig.position.copy(back); rig.rotation.set(0, yaw, 0); rig.scale.setScalar(WS); halo.position.set(0, hgt(c) * 0.42 / WS, 0.32 / WS); halo.material.opacity = 0.7 * open * (1 - fold);
    // a deep beat as they open, then slow sweeps
    const beat = t < T.beat ? -0.6 * Math.sin(Math.min(1, t / T.beat) * Math.PI) : 0.25 * Math.sin((t - T.beat) * 3.2);
    const settle = ease((t - T.beat) / 0.5); /* (after the beat they sweep back and turn half see-through: you can see past them) */
    for (const [w, s] of [[L, 1], [R, -1]]) { w.userData.mats[0].opacity = 1 - 0.55 * settle; w.rotation.set(0.25 + beat * 0.3 - 0.25 * settle, s * (0.35 + 0.75 * settle + beat), s * (0.15 - 0.9 * (1 - open) + 1.2 * fold)); w.userData.feathers.forEach((p, i) => { p.rotation.z = p.userData.a * (0.15 + 0.85 * open) * (1 - 0.7 * fold) + Math.sin(t * 6 + i * 0.4) * 0.02; }); w.scale.y = Math.max(0.01, open * (1 - fold)); w.userData.mats[1].opacity = (0.55 - 0.3 * settle) * (0.75 + 0.25 * Math.sin(t * 5)); }
    flapT -= dt; if (flapT <= 0 && open > 0.5 && fold < 0.2) { flapT = 0.05; const side = Math.random() < 0.5 ? 1 : -1, p = back.clone().addScaledVector(V3(f.z, 0, -f.x), side * (1 + Math.random() * 3)).setY(back.y + Math.random() * 1.5 - 0.5); V.emit('cotton', p, { speed: 0.6, vy: -0.4, size: 0.18, life: 1.6, grav: 0.6 }); V.emit('gold', p, { speed: 0.4, size: 0.25, life: 0.6 }); }
    if (!beaten && t >= T.beat) { beaten = true; const cp = chest(c); V.light(cp, '#fff0b0', 16, 0.6, 30); V.burst('gold', cp, 80, { speed: 9, size: 0.4 }); V.burst('cotton', cp, 60, { speed: 7, size: 0.22, life: 1.8, grav: 1 }); shakeAt(c.pos, 0.5); S.cast && S.cast('holy', c.pos, 1.4);
      snd(c.pos, (N, Tn) => { N(0, 0.5, { type: 'lowpass', f: 900, f2: 200, gain: 0.7, a: 0.03 }); Tn(0, 0.5, { type: 'sine', f: 90, f2: 45, gain: 0.5, a: 0.01 }); [1047, 1319, 1568, 2093].forEach((fq, i) => Tn(0.05 + i * 0.05, 1.2, { type: 'sine', f: fq, gain: 0.05, a: 0.01 })); }, 0.4);
      for (const u of near(foesOf(c), c.pos, T.blast)) { ultHurt(u, T.blastHurt, c, 'gold'); const pu = u.pos.clone().sub(c.pos).setY(0).normalize(); if (u === G.player && u.knock) u.knock(pu.multiplyScalar(T.push), 0.5); else fling(u, pu.multiplyScalar(T.push).setY(5)); V.burst('cotton', chest(u), 20, { speed: 5 }); }
      const pals = near(ultFriends(c).concat(c), c.pos, T.range).filter((u, i, a) => a.indexOf(u) === i);
      pals.forEach((u, i) => later(i * 0.05, () => { if (u.dead) return; const from = chest(c).add(V3(0, 1.2, 0)), to = chest(u); if (u !== c) lance(from, to); const low = u.hp / (u.maxHp || 1) < T.saveAt; ultHeal(u, T.heal); cleanse(u); if (low) { untouchable(u, T.save); V.number(to.clone().setY(to.y + 1.2), 'Saved!', 'crit'); }
        V.burst('gold', to, 40, { speed: 4, vy: 3 }); V.burst('heal', to, 20, { speed: 2, vy: 3 }); V.light(to, '#ffe8a0', 8, 0.4, 12); hots.push({ u, left: T.hotDur, tick: T.hotEvery, crown: crown(u, T.hotDur) }); })); }
    for (const h of hots) { if (h.left <= 0) continue; h.left -= dt; h.tick -= dt; if (h.tick <= 0) { h.tick = T.hotEvery; if (!h.u.dead) { ultHeal(h.u, T.hot); V.emit('gold', chest(h.u).add(V3((Math.random() - 0.5) * 0.8, 0.6, (Math.random() - 0.5) * 0.8)), { speed: 0.4, vy: 1.5, size: 0.3, life: 0.8 }); } } }
    if (fold > 0 && !rig.userData.burst) { rig.userData.burst = true; V.burst('cotton', back, 90, { speed: 5, size: 0.22, life: 2.2, grav: 0.8, radius: 3 }); V.burst('gold', back, 50, { speed: 4, size: 0.3 }); }
    if (fold >= 1) { c.hoverH = 0; kill(rig); L.userData.mats.concat(R.userData.mats).forEach(m => m.dispose()); return true; } return false; });
  ann(c, 'Wings of Salvation'); return true;
}
// a lance of light from the cleric to an ally
function lance(a, b) { const d = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 8, 1, true), glowM('#fff6d0', 1)), m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 10, 1, true), glowM('#ffc040', 0.5)); const g = new THREE.Group(); g.add(m, m2); G.scene.add(g);
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); g.quaternion.copy(q);
  timer((t) => { const k = Math.min(1, t / 0.12), L = d * k; g.position.copy(a).lerp(b, k / 2); g.scale.set(1, Math.max(0.01, L), 1); const o = Math.max(0, 1 - Math.max(0, t - 0.15) / 0.45); m.material.opacity = o; m2.material.opacity = 0.5 * o; if (Math.random() < 0.6) V.emit('gold', a.clone().lerp(b, Math.random() * k), { speed: 0.3, size: 0.3, life: 0.4 }); if (t > 0.6) { kill(g); return true; } return false; }); }
// a small golden crown of light over a blessed ally's head while their healing lasts
function crown(u, life) { const sp = sprite(radial('u5crown', [[0, 'rgba(255,250,220,1)'], [0.4, 'rgba(255,210,90,0.6)'], [1, 'rgba(255,160,0,0)']]), 0.9); G.scene.add(sp); timer((t) => { sp.position.copy(u.pos).setY(u.pos.y + lift(u) + hgt(u) + 0.35 + Math.sin(t * 3) * 0.05); sp.material.opacity = Math.min(1, t / 0.2) * Math.max(0, Math.min(1, (life - t) / 0.4)) * (0.7 + 0.3 * Math.sin(t * 8)); if (t > life || u.dead) { kill(sp); return true; } return false; }); return sp; }

// ---------- wiring ----------
// the hook names the player's R already calls (player.js), pointed at the new ultimates; arena.js and yard.js both call install()
export const U5 = { shadowAbyss, monkPalm, druidElder, shamanStorm, clericWings };
export function install() { G.hooks.ult5 = U5; G.hooks.arenaFists = monkPalm; G.hooks.arenaOvergrowth = druidElder; G.hooks.arenaSpirit = (c) => shamanStorm(c); G.hooks.arenaMiracle = (c) => clericWings(c); wardSoulRend(); }
