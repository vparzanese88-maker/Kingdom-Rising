// Kingdom Rising 3D — sieges. The battering ram (a roofed, wheeled shed of wet hides with an iron-headed log
// swinging on chains, pushed by its crew), the great trebuchets and catapults that stand inside the walls, and
// the city gates: oak doors and an iron portcullis that come down when the alarm bell rings, crack and buckle
// under the ram, and burst apart on the fifth blow. The game rules live in js/warmarch.js (KR.War).
import { THREE, K3, PX, TILE } from './core.js';
import { geo } from './geo.js';
import { MB } from './mb.js';
import { makeHumanoid, animateHumanoid } from './chars.js';
import { fx, rgb } from './fx.js';

const KR = window.KR, G = KR.G, D = KR.D, W = KR.W;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const sm = (a, b, x) => K3.smooth(a, b, x);
const TAU = Math.PI * 2;

function dust(x, y, z, n, o = {}) {
  const c = rgb(o.col || '#8a7a62');
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = (o.speed || 1.6) * (0.4 + Math.random() * 0.9);
    fx.smoke.emit({ x: x + (Math.random() - 0.5) * (o.spread || 0.6), y: y + Math.random() * 0.3, z: z + (Math.random() - 0.5) * (o.spread || 0.6), vx: Math.cos(a) * sp + (o.vx || 0), vy: (o.up || 0.6) * (0.5 + Math.random()), vz: Math.sin(a) * sp + (o.vz || 0),
      drag: 1.4, life: (o.life || 1.6) * (0.7 + Math.random() * 0.6), s0: o.s0 || 0.5, s1: o.s1 || 1.8, r: c[0], g: c[1], b: c[2], a: o.a || 0.45, kind: 2 });
  }
}
// chips of wood or stone that fly and fall
function chips(x, y, z, n, col, o = {}) {
  const c = rgb(col);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = (o.speed || 3) * (0.5 + Math.random());
    fx.smoke.emit({ x, y, z, vx: Math.cos(a) * sp * 0.6 + (o.vx || 0) * sp, vy: 1.5 + Math.random() * (o.up || 3), vz: Math.sin(a) * sp * 0.6 + (o.vz || 0) * sp, grav: 9.8, life: 0.7 + Math.random() * 0.6, s0: o.s || 0.09, s1: (o.s || 0.09) * 0.8, r: c[0], g: c[1], b: c[2], a: 1, fade: 0, kind: 2 });
  }
}

// ---------- the battering ram ----------
function crewLook(e, k) {
  const F = D.FACTIONS[e.faction] || {};
  const skins = ['#e0b896', '#c8966e', '#a8714a', '#f0caa8'], hairs = ['#3a2a1a', '#6a4a2a', '#1e1a16', '#8a6a3a'];
  return { race: 'human', gender: 'm', skin: skins[k % 4], hair: hairs[(k + 1) % 4], hairStyle: k % 3, armor: { kind: k % 2 ? 'leather' : 'chain', col: k % 2 ? '#5a4632' : '#7e8288', trim: F.banner || '#7a1e1e' }, helm: k % 2 ? null : 'chain', hat: null, weapon: null, offhand: null, cape: null, beard: k === 2 };
}
function ramModel(e) {
  const F = D.FACTIONS[e.faction] || {}; const ban = F.banner || '#7a1e1e', trim = F.trim || '#e0c060';
  const holder = new THREE.Group(); const body = new THREE.Group(); holder.add(body);
  const L = 5.2, base = 0.78, eave = 1.75, ridge = 2.95, mb = new MB();
  // chassis, axles, posts, eaves and ridge
  for (const s of [-1, 1]) mb.box('timber', s * 0.98, base, 0, 0.26, 0.3, L, '#5a3e24');
  for (const z of [-2.35, -0.8, 0.8, 2.35]) mb.box('timber', 0, base + 0.02, z, 2.2, 0.22, 0.24, '#4e3520');
  for (const z of [-1.75, 0, 1.75]) mb.cyl('metalv', 0, 0.55, z, 0.06, 2.62, '#3a3a40', 8, null, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) for (const z of [-2.35, -0.8, 0.8, 2.35]) mb.box('timber', s * 0.98, (base + eave) / 2 + 0.1, z, 0.2, eave - base + 0.2, 0.2, '#5a3e24');
  for (const s of [-1, 1]) mb.box('timber', s * 1.05, eave, 0, 0.2, 0.2, L + 0.3, '#4e3520');
  mb.box('timber', 0, ridge, 0, 0.22, 0.22, L + 0.5, '#4e3520');
  for (const z of [-2.35, -0.8, 0.8, 2.35]) for (const s of [-1, 1]) mb.beam('timber', V(s * 1.12, eave - 0.05, z), V(0, ridge + 0.02, z), 0.14, 0.14, '#4e3520');
  // the roof: planks under wet hides, stitched in strips, the kingdom's colours hanging from the eaves
  const ang = Math.atan2(ridge - eave, 1.12), pw = Math.hypot(ridge - eave, 1.12) + 0.28;
  for (const s of [-1, 1]) {
    const cx = s * 0.56, cy = (eave + ridge) / 2 + 0.12;
    mb.box('planks', cx, cy - 0.05, 0, pw, 0.06, L + 0.4, '#6a4a2a', 0, 0, -s * ang);
    mb.box('leather', cx + s * 0.02, cy + 0.03, 0, pw + 0.1, 0.05, L + 0.25, '#4a3020', 0, 0, -s * ang);
    for (const z of [-2.0, -0.7, 0.6, 1.9]) mb.box('leather', cx + s * 0.03, cy + 0.065, z, pw + 0.12, 0.03, 0.07, '#24160e', 0, 0, -s * ang);
    mb.box('cloth2', s * 1.18, eave - 0.42, 0.9, 0.03, 0.78, 1.5, ban); mb.box('cloth2', s * 1.19, eave - 0.06, 0.9, 0.035, 0.1, 1.52, trim);
    mb.box('cloth2', s * 1.18, eave - 0.42, -1.3, 0.03, 0.78, 1.5, ban); mb.box('cloth2', s * 1.19, eave - 0.06, -1.3, 0.035, 0.1, 1.52, trim);
  }
  // the front gable: planks, with iron plates where the arrows land; the log runs out underneath
  for (let k = 0; k < 5; k++) { const y = eave + 0.12 + k * 0.24, w = 2.25 * (1 - (k + 0.5) / 5.2); mb.box('planks', 0, y, L / 2 + 0.06, w, 0.24, 0.08, k % 2 ? '#5e4226' : '#674a2c'); }
  mb.box('metalv', 0, eave + 0.45, L / 2 + 0.12, 1.3, 0.55, 0.035, '#4a4a52');
  for (const x of [-0.5, -0.17, 0.17, 0.5]) mb.sph('metalv', x, eave + 0.45, L / 2 + 0.14, 0.05, 0.05, 0.03, '#2a2a30', 0, 8);
  // a banner on a pole at the back
  mb.cyl('timber', 0.75, ridge + 0.35, -L / 2 + 0.25, 0.04, 2.2, '#3a2818', 6);
  mb.box('cloth2', 0.75 + 0.45, ridge + 1.05, -L / 2 + 0.25, 0.85, 0.6, 0.02, ban); mb.box('cloth2', 0.75 + 0.45, ridge + 0.73, -L / 2 + 0.25, 0.85, 0.06, 0.025, trim);
  body.add(mb.build());
  // six wheels: spoked, iron tyred
  const wheels = [];
  for (const s of [-1, 1]) for (const z of [-1.75, 0, 1.75]) {
    const w = new MB();
    w.cyl('planks', 0, 0, 0, 0.55, 0.2, '#5a3e24', 16, null, 0, 0, Math.PI / 2);
    w.cyl('metalv', 0, 0, 0, 0.585, 0.13, '#34343a', 18, null, 0, 0, Math.PI / 2);
    for (let k = 0; k < 6; k++) w.box('timber', s * 0.115, 0, 0, 0.04, 0.96, 0.08, '#43301c', 0, k * Math.PI / 6 * 2);
    w.cyl('metalv', s * 0.13, 0, 0, 0.12, 0.1, '#2a2a30', 10, null, 0, 0, Math.PI / 2);
    const g = new THREE.Group(); g.add(w.build()); g.position.set(s * 1.24, 0.56, z); body.add(g); wheels.push(g);
  }
  // the log, hung on chains from the ridge so it swings back and forth level (a parallelogram)
  const pivotY = ridge - 0.12, Lc = 1.45; const chains = [];
  for (const z of [-1.3, 1.3]) {
    const cg = new THREE.Group(); cg.position.set(0, pivotY, z); const c = new MB();
    for (let k = 0; k < 7; k++) c.box('metalv', 0, -0.1 - k * (Lc - 0.15) / 6.5, 0, k % 2 ? 0.035 : 0.09, 0.2, k % 2 ? 0.09 : 0.035, '#45454c');
    cg.add(c.build()); body.add(cg); chains.push(cg);
  }
  const log = new THREE.Group(); body.add(log);
  const lm = new MB(); const LL = 5.6, hz = LL / 2 - 0.15;
  lm.cyl('bark', 0, 0, -0.2, 0.25, LL, '#6a4a2e', 14, null, 0, Math.PI / 2, 0);
  for (const z of [-2.5, -1.3, 1.3, 2.2]) lm.cyl('metalv', 0, 0, z, 0.272, 0.1, '#33333a', 14, null, 0, Math.PI / 2, 0);
  for (const z of [-1.3, 1.3]) lm.box('metalv', 0, 0.27, z, 0.1, 0.12, 0.14, '#33333a');
  // the head: a bronze ram with curling horns and coals for eyes
  lm.cyl('metalv', 0, 0, hz + 0.1, 0.3, 0.32, '#6a4e28', 14, 0.27, 0, Math.PI / 2, 0);
  lm.sph('metalv', 0, 0.03, hz + 0.48, 0.3, 0.29, 0.42, '#8a6a38');
  lm.sph('metalv', 0, -0.06, hz + 0.8, 0.19, 0.17, 0.22, '#8a6a38');
  for (const s of [-1, 1]) {
    let prev = null;
    for (let k = 0; k <= 9; k++) { const t = k / 9, a = 0.3 + t * Math.PI * 1.55, rad = 0.26 * (1 - t * 0.55); const pt = V(s * (0.24 + 0.1 * t), 0.1 + Math.sin(a) * rad, hz + 0.32 - Math.cos(a) * rad * 0.9); if (prev) lm.rod('metalv', prev, pt, 0.075 * (1 - t * 0.6), '#5a4424', 8); prev = pt; }
    lm.sph('glow', s * 0.15, 0.12, hz + 0.68, 0.045, 0.04, 0.03, '#ff7a2a', 0, 8);
  }
  const lg = lm.build(); log.add(lg);
  const head = new THREE.Object3D(); head.position.set(0, -0.05, hz + 1.0); log.add(head);
  // the crew: two at the back pushing, two inside on the log
  const crew = [];
  for (const [k, x, z] of [[0, -0.62, 0.05], [1, 0.62, -1.55], [2, -0.45, -2.95], [3, 0.45, -2.95]]) {
    try { const rig = makeHumanoid(crewLook(e, k), 'human'); rig.mesh.position.set(x, 0, z); body.add(rig.mesh); crew.push({ rig, back: z < -2 }); } catch (er) {}
  }
  const P = { holder, body, wheels, chains, log, head, crew, pivotY, Lc };
  P.anim = (av, ent, dt) => ramAnim(P, av, ent, dt);
  return { obj: holder, parts: P, height: 3.4 };
}
function ramAnim(P, av, e, dt) {
  av.obj.rotation.x = 0; av.obj.rotation.z = 0; // a wreck burns where it stands, it does not keel over like a soldier
  let want = 0; if (e.ramAim && !e.dead) want = K3.dampAngle(0, Math.atan2(e.ramAim.x - e.x, e.ramAim.y - e.y) - av.yaw, 1);
  P.holder.rotation.y = K3.dampAngle(P.holder.rotation.y, want, Math.min(1, dt * 2.5));
  const dx = e.x - (P.lx == null ? e.x : P.lx), dy = e.y - (P.ly == null ? e.y : P.ly); P.lx = e.x; P.ly = e.y;
  const dist = Math.hypot(dx, dy) * PX; const moving = dist > 0.0004 && !e.dead;
  for (const w of P.wheels) w.rotation.x += dist / 0.56;
  // the swing: pulled back on the chains, let go, the head slams forward, it rocks back
  const ph = e.dead ? 0 : e.ramPh || 0; let th;
  if (ph <= 0) th = Math.sin(K3.time * 2.1) * (moving ? 0.05 : 0.012);
  else if (ph < 0.62) th = 0.68 * sm(0, 0.62, ph);
  else if (ph < 0.75) { const u = (ph - 0.62) / 0.13; th = 0.68 - 1.12 * u * u; }
  else { const u = (ph - 0.75) / 0.25; th = -0.44 * (1 - u) * Math.cos(u * 3.4); }
  P.th = (P.th == null ? th : P.th + (th - P.th) * Math.min(1, dt * 30));
  for (const c of P.chains) c.rotation.x = P.th;
  P.log.position.set(0, P.pivotY - P.Lc * Math.cos(P.th), -P.Lc * Math.sin(P.th)); // the log hangs at the chain ends
  if (P.lastPh != null && P.lastPh < 0.75 && ph >= 0.75) {
    P.head.getWorldPosition(_v);
    fx.burst(_v.x, _v.y, _v.z, 26, '#ffc070', { speed: 4.5, life: 0.5 });
    dust(_v.x, _v.y - 0.6, _v.z, 10, { speed: 1.8, up: 0.8, col: '#9a8a70' });
  }
  P.lastPh = ph;
  // the crew push (leaning in), heave back on the windup and throw their weight forward with the swing
  for (const c of P.crew) {
    const lean = e.dead ? 0 : ph > 0 ? (ph < 0.62 ? -0.28 * sm(0, 0.62, ph) : ph < 0.82 ? 0.3 : 0.3 * (1 - sm(0.82, 1, ph))) : moving ? (c.back ? 0.34 : 0.18) : 0;
    c.rig.mesh.visible = !e.dead;
    if (!c.rig.mesh.visible) continue;
    try { animateHumanoid(c.rig, { move: moving ? 1 : 0, dist: moving ? dist : 0, dir: [0, 1], combat: false }, dt); } catch (er) {}
    c.rig.mesh.rotation.x = lean;
    if (c.rig.setLod) c.rig.setLod(av.obj.position.distanceTo(K3.camera.position));
  }
  // dust thrown up by the wheels
  if (moving && Math.random() < dt * 6) { av.obj.getWorldPosition(_v); dust(_v.x + (Math.random() - 0.5) * 2, _v.y + 0.1, _v.z + (Math.random() - 0.5) * 3, 1, { speed: 0.4, up: 0.3, s0: 0.4, s1: 1.4, a: 0.25 }); }
  // destroyed: it slumps and burns
  if (e.dead) {
    if (!P.wreck) { P.wreck = K3.time; P.body.rotation.z = 0.14; P.body.position.y = -0.28; P.body.rotation.x = 0.05; av.obj.getWorldPosition(_v); fx.burst(_v.x, _v.y + 1.5, _v.z, 40, '#ff9a3a', { speed: 4, life: 0.8 }); dust(_v.x, _v.y + 0.5, _v.z, 24, { speed: 2.5, col: '#5a5048', up: 1.5 }); }
    const age = K3.time - P.wreck;
    if (age < 40 && Math.random() < dt * 14) {
      av.obj.getWorldPosition(_v); const x = _v.x + (Math.random() - 0.5) * 2, z = _v.z + (Math.random() - 0.5) * 4;
      fx.add.emit({ x, y: _v.y + 1.2 + Math.random(), z, vy: 1.4 + Math.random(), life: 0.7, s0: 0.7, s1: 0.2, r: 3, g: 1.3, b: 0.4, kind: 0 });
      if (Math.random() < 0.5) fx.smoke.emit({ x, y: _v.y + 2.4, z, vx: 0.3, vy: 1.2, life: 3, s0: 0.8, s1: 2.6, r: 0.18, g: 0.16, b: 0.15, a: 0.5, kind: 2 });
    }
  } else if (P.wreck) { P.wreck = 0; P.body.rotation.set(0, 0, 0); P.body.position.y = 0; }
}

// ---------- trebuchets and catapults ----------
// arm angle phi: 0 points the long end forward (toward the target), it turns over the top as phi grows
function engineArm(P, e, dt) {
  const def = D.SIEGE[e.siege] || {}; const delay = e.delay || def.delay || 6; const since = (G.now - (e.fireAt || -1e9)) / 1000;
  const thr = P.throwT, set = P.settleT; let phi, k = 1, loaded = false;
  if (since < thr) { const u = since / thr; phi = P.load + (P.rel - P.load) * u * u; k = sm(0.2, 0.7, u); }
  else if (since < thr + set) { const u = (since - thr) / set; phi = P.after + (P.rel - P.after) * Math.exp(-u * 4) * Math.cos(u * 9); }
  else { const w = K3.clamp((since - thr - set) / Math.max(0.5, delay * 0.85 - thr - set), 0, 1); phi = P.after + (P.load - P.after) * sm(0, 1, w); if (w > 0 && w < 1) { P.winch.forEach((g) => (g.rotation.x -= dt * 3)); } loaded = w >= 1; k = loaded ? 0 : 1; }
  if (since > 1e6) { phi = P.load; loaded = true; k = 0; }
  P.arm.rotation.x = phi;
  if (P.cw) P.cw.rotation.x = -phi;
  if (P.sling) { const lag = (P.lastPhi == null ? 0 : (phi - P.lastPhi) / Math.max(dt, 1e-3)) * 0.12; P.sling.rotation.x = -phi + (1 - k) * (-Math.PI / 2) - K3.clamp(lag, -1.2, 1.2) * k; }
  P.lastPhi = phi;
  if (P.stone) P.stone.visible = loaded || since < thr * 0.92;
  // the arm slamming to a stop throws up dust
  if (P.lastSince != null && P.lastSince < thr && since >= thr) { P.holder.getWorldPosition(_v); dust(_v.x, _v.y + 0.2, _v.z, 12, { speed: 2, spread: 3, up: 0.6 }); }
  P.lastSince = since;
}
function engineTurn(P, av, e, dt) {
  av.obj.rotation.x = 0; av.obj.rotation.z = 0;
  P.turret.rotation.y = Math.PI / 2 - (e.aimAng || 0) - av.yaw;
  if (e.turning && Math.random() < dt * 5) { P.holder.getWorldPosition(_v); const a = Math.random() * TAU; dust(_v.x + Math.cos(a) * P.foot, _v.y + 0.1, _v.z + Math.sin(a) * P.foot, 1, { speed: 0.3, up: 0.2, s0: 0.3, s1: 1, a: 0.3 }); }
  if (e.dead) { if (!P.wreck) { P.wreck = 1; P.turret.rotation.z = 0.12; P.turret.position.y -= 0.4; P.arm.rotation.x = P.load + 0.4; P.holder.getWorldPosition(_v); dust(_v.x, _v.y + 2, _v.z, 30, { speed: 3, spread: 3, col: '#5a5048', up: 1.6 }); } if (Math.random() < dt * 4) { P.holder.getWorldPosition(_v); fx.smoke.emit({ x: _v.x + (Math.random() - 0.5) * 3, y: _v.y + 1.5, z: _v.z + (Math.random() - 0.5) * 3, vy: 1, life: 3, s0: 0.8, s1: 2.4, r: 0.2, g: 0.18, b: 0.17, a: 0.45, kind: 2 }); } return false; }
  if (P.wreck) { P.wreck = 0; P.turret.rotation.z = 0; P.turret.position.y += 0.4; }
  return true;
}
function trebModel(e) {
  const F = D.FACTIONS[e.faction] || {}; const ban = F.banner || '#7a1e1e', trim = F.trim || '#e0c060';
  const holder = new THREE.Group(); const turret = new THREE.Group(); holder.add(turret);
  // a round stone base with a timber turntable
  const b = new MB(); b.cylB('stone', 0, -0.3, 0, 2.9, 0.62, '#8a8274', 20); b.cylB('planks', 0, 0.3, 0, 2.6, 0.14, '#6a4a2c', 20); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; b.box('metalv', Math.cos(a) * 2.62, 0.38, Math.sin(a) * 2.62, 0.3, 0.06, 0.12, '#3a3a40', -a); }
  holder.add(b.build());
  const m = new MB(); const AX = 6.2;
  for (const s of [-1, 1]) {
    m.box('timber', s * 1.25, 0.62, 0, 0.42, 0.42, 6.4, '#5a3e24'); // sills
    m.beam('timber', V(s * 1.25, 0.8, -2.8), V(s * 1.05, AX, 0), 0.32, 0.32, '#5e4228');
    m.beam('timber', V(s * 1.25, 0.8, 2.8), V(s * 1.05, AX, 0), 0.32, 0.32, '#5e4228');
    m.box('timber', s * 1.12, AX / 2 + 0.4, 0, 0.3, AX - 0.4, 0.3, '#5a3e24');
    m.box('timber', s * 1.2, 3.0, 0, 0.18, 0.2, 3.4, '#4e3520'); m.box('timber', s * 1.15, 4.7, 0, 0.16, 0.18, 1.7, '#4e3520');
    for (const z of [-1.4, 1.4]) m.beam('timber', V(s * 1.25, 0.8, z * 1.6), V(s * 1.2, 3.0, z * 0.6), 0.16, 0.16, '#4a3220');
    m.box('metalv', s * 1.05, AX, 0, 0.4, 0.5, 0.5, '#3a3a40');
  }
  for (const z of [-2.9, -1, 1, 2.9]) m.box('timber', 0, 0.62, z, 2.9, 0.34, 0.34, '#4e3520');
  m.cyl('metalv', 0, AX, 0, 0.14, 2.9, '#2e2e34', 12, null, 0, 0, Math.PI / 2);
  // the sling trough under the frame
  m.box('planks', 0, 0.86, 1.2, 0.7, 0.1, 3.6, '#6a4a2c'); for (const s of [-1, 1]) m.box('planks', s * 0.36, 0.98, 1.2, 0.06, 0.22, 3.6, '#5e4226');
  // pennants on the frame tops
  for (const s of [-1, 1]) { m.cyl('timber', s * 1.05, AX + 1.1, 0, 0.035, 1.8, '#3a2818', 6); m.box('cloth2', s * 1.05, AX + 1.55, 0.45, 0.02, 0.5, 0.85, ban); m.box('cloth2', s * 1.05, AX + 1.27, 0.45, 0.025, 0.06, 0.85, trim); }
  turret.add(m.build());
  // the winch wheels at the back (they turn while the arm is hauled down)
  const winch = [];
  for (const s of [-1, 1]) { const w = new MB(); w.cyl('planks', 0, 0, 0, 0.75, 0.16, '#5a3e24', 14, null, 0, 0, Math.PI / 2); for (let k = 0; k < 4; k++) w.box('timber', 0, 0, 0, 0.12, 1.9, 0.1, '#43301c', 0, k * Math.PI / 4); w.cyl('timber', -s * 0.5, 0, 0, 0.12, 1.1, '#4a3220', 8, null, 0, 0, Math.PI / 2); const g = new THREE.Group(); g.add(w.build()); g.position.set(s * 1.65, 1.15, -2.3); turret.add(g); winch.push(g); }
  // the throwing arm, the hinged counterweight box and the sling
  const LL = 6.6, LS = 1.9;
  const arm = new THREE.Group(); arm.position.set(0, AX, 0); turret.add(arm);
  const am = new MB(); am.box('timber', 0, 0, (LL - LS) / 2, 0.36, 0.42, LL + LS, '#6a4a2c'); for (const z of [-1.2, 0.8, 2.6, 4.4]) am.box('metalv', 0, 0, z, 0.4, 0.46, 0.12, '#33333a'); am.box('metalv', 0, 0, LL - 0.1, 0.3, 0.3, 0.25, '#33333a');
  arm.add(am.build());
  const cw = new THREE.Group(); cw.position.set(0, 0, -LS); arm.add(cw);
  const cm = new MB(); for (const s of [-1, 1]) cm.beam('metalv', V(s * 0.2, 0, 0), V(s * 0.75, -0.9, 0), 0.08, 0.08, '#3a3a40');
  cm.box('planks', 0, -1.7, 0, 1.7, 1.6, 1.6, '#5e4226'); for (const y of [-1.1, -2.3]) cm.box('metalv', 0, y, 0, 1.76, 0.1, 1.66, '#2e2e34'); for (let k = 0; k < 6; k++) cm.sph('rock', -0.5 + (k % 3) * 0.5, -0.85, -0.35 + Math.floor(k / 3) * 0.7, 0.32, 0.22, 0.3, '#8a8478');
  cw.add(cm.build());
  const sling = new THREE.Group(); sling.position.set(0, 0, LL); arm.add(sling);
  const sl = new MB(); for (const s of [-1, 1]) sl.rod('timber', V(0, 0, 0), V(s * 0.16, -2.1, 0), 0.025, '#8a7a5a'); sl.sph('leather', 0, -2.15, 0, 0.36, 0.2, 0.36, '#4a3020');
  sling.add(sl.build());
  const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), K3.mats ? K3.mats.get('rock') : new THREE.MeshStandardMaterial({ color: 0x8a8070 })); stone.position.set(0, -2.0, 0); stone.castShadow = true; sling.add(stone);
  const P = { holder, turret, arm, cw, sling, stone, winch, foot: 2.6, throwT: 0.75, settleT: 1.6, load: Math.PI - 0.95, rel: TAU - 0.75, after: Math.PI * 1.5 };
  P.anim = (av, ent, dt) => { if (engineTurn(P, av, ent, dt)) engineArm(P, ent, dt); };
  return { obj: holder, parts: P, height: 9.5 };
}
function catModel(e) {
  const F = D.FACTIONS[e.faction] || {}; const ban = F.banner || '#7a1e1e';
  const holder = new THREE.Group(); const turret = new THREE.Group(); holder.add(turret); holder.scale.setScalar(1.2);
  const m = new MB();
  for (const s of [-1, 1]) m.box('timber', s * 0.95, 0.75, 0, 0.36, 0.38, 4.6, '#5a3e24');
  for (const z of [-2.0, -0.4, 1.0, 2.1]) m.box('timber', 0, 0.75, z, 2.2, 0.3, 0.3, '#4e3520');
  // uprights and the padded crossbar the arm slams into
  for (const s of [-1, 1]) { m.box('timber', s * 0.95, 1.75, 0.05, 0.3, 2.0, 0.3, '#5a3e24'); m.beam('timber', V(s * 0.95, 0.9, 1.6), V(s * 0.95, 2.5, 0.2), 0.22, 0.22, '#4e3520'); m.beam('timber', V(s * 0.95, 0.9, -1.2), V(s * 0.95, 2.3, -0.05), 0.2, 0.2, '#4e3520'); }
  m.box('timber', 0, 2.7, 0.05, 2.2, 0.32, 0.34, '#5a3e24'); m.box('leather', 0, 2.7, -0.13, 0.8, 0.42, 0.14, '#6a4028');
  // the torsion skein of twisted rope and its iron frame
  m.cyl('cloth', 0, 0.98, -0.45, 0.24, 1.7, '#b8a07a', 12, null, 0, 0, Math.PI / 2); for (const s of [-1, 1]) m.cyl('metalv', s * 0.88, 0.98, -0.45, 0.3, 0.12, '#3a3a40', 12, null, 0, 0, Math.PI / 2);
  // wheels
  for (const s of [-1, 1]) for (const z of [-1.5, 1.5]) { m.cyl('planks', s * 1.2, 0.5, z, 0.5, 0.18, '#5a3e24', 14, null, 0, 0, Math.PI / 2); m.cyl('metalv', s * 1.2, 0.5, z, 0.53, 0.1, '#34343a', 16, null, 0, 0, Math.PI / 2); m.cyl('metalv', s * 1.3, 0.5, z, 0.1, 0.08, '#2a2a30', 8, null, 0, 0, Math.PI / 2); }
  m.box('cloth2', 1.13, 0.95, 0.5, 0.02, 0.4, 1.1, ban); m.box('cloth2', -1.13, 0.95, 0.5, 0.02, 0.4, 1.1, ban);
  turret.add(m.build());
  const winch = []; { const w = new MB(); w.cyl('timber', 0, 0, 0, 0.18, 1.7, '#4a3220', 10, null, 0, 0, Math.PI / 2); for (const s of [-1, 1]) for (let k = 0; k < 2; k++) w.box('timber', s * 0.9, 0, 0, 0.08, 0.95, 0.08, '#43301c', 0, k * Math.PI / 2); const g = new THREE.Group(); g.add(w.build()); g.position.set(0, 1.0, -2.05); turret.add(g); winch.push(g); }
  const arm = new THREE.Group(); arm.position.set(0, 0.98, -0.45); turret.add(arm);
  const LL = 3.5; const am = new MB(); am.box('timber', 0, 0, LL / 2 - 0.1, 0.26, 0.3, LL + 0.2, '#6a4a2c'); for (const z of [0.6, 1.6, 2.6]) am.box('metalv', 0, 0, z, 0.3, 0.34, 0.1, '#33333a');
  am.sph('planks', 0, 0.16, LL + 0.05, 0.42, 0.18, 0.42, '#5e4226'); am.cyl('metalv', 0, 0.2, LL + 0.05, 0.43, 0.08, '#33333a', 12); arm.add(am.build());
  const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), K3.mats ? K3.mats.get('rock') : new THREE.MeshStandardMaterial({ color: 0x8a8070 })); stone.position.set(0, 0.4, LL + 0.05); stone.castShadow = true; arm.add(stone);
  const P = { holder, turret, arm, stone, winch, foot: 2.2, throwT: 0.32, settleT: 0.9, load: Math.PI - 0.16, rel: Math.PI * 1.5 + 0.34, after: Math.PI * 1.5 + 0.26 };
  P.anim = (av, ent, dt) => { if (engineTurn(P, av, ent, dt)) engineArm(P, ent, dt); };
  return { obj: holder, parts: P, height: 5.6 };
}
// ---------- faction armies (warmarch.js): Aelindor's troll giants, Valenmoor's cannons and bombards, the elven ballistas ----------
// a giant troll, three times a man's height: grey-green hide, tusks, a tree-trunk club. At a shut gate it pounds in
// time with the ram rules (wind-up, then the blow on the beat); once the gate is down it fights like any soldier.
const TROLL_S = 2.3;
// Built on the hunched troll body (human.js) with its own sculpted parts: the human head, hands and feet are folded
// away (their bones scaled to nothing) and replaced by a troll head (underbite jaw, tusks, hooked nose, deep-set
// glowing eyes, long ears, a scraggly mane), three-fingered hands and big flat feet. Stone-grey hide with moss,
// mushrooms and bark plates; a loincloth on a belt of bones; an uprooted tree for a club.
// a tapered cone from a (base, radius r) to b (the point), for ears, locks of hair, tusks and claws
const _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _sc = new THREE.Vector3(1, 1, 1);
function taper(mb, key, a, b, r, color, seg = 7) {
  const d = new THREE.Vector3().subVectors(b, a); const L = d.length(); if (L < 1e-5) return;
  const g = new THREE.ConeGeometry(r, L, seg, 1); _q.setFromUnitVectors(_up, d.normalize()); _m4.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, _sc);
  mb.add(key, g, _m4, color); g.dispose();
}
// an irregular, flattened shard (bark, stone): a jittered dodecahedron
function shard(mb, key, pos, scl, rot, color, seed) {
  const g = new THREE.DodecahedronGeometry(1, 0); const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) { const h = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453; const j = 0.75 + (h - Math.floor(h)) * 0.5; pa.setXYZ(i, pa.getX(i) * j, pa.getY(i) * j, pa.getZ(i) * j); }
  g.computeVertexNormals(); _m4.compose(pos, _q.setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])), new THREE.Vector3(scl[0], scl[1], scl[2])); mb.add(key, g, _m4, color); g.dispose();
}
// the troll's hide: grey-green stone mottled with moss, from a procedural noise in the skin shader
function trollSkin(m0) {
  const m = m0.clone(); m.color = new THREE.Color('#ffffff'); if ('sheen' in m) m.sheen = 0; m.roughness = 0.92;
  m.onBeforeCompile = (sh, r) => {
    if (m0.onBeforeCompile) m0.onBeforeCompile(sh, r);
    if (!/#include <color_fragment>/.test(sh.fragmentShader) || !/#include <begin_vertex>/.test(sh.vertexShader)) return;
    sh.vertexShader = 'varying vec3 vTrollP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTrollP = position;');
    sh.fragmentShader = 'varying vec3 vTrollP;\nfloat trH(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }\n'
      + 'float trN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(mix(trH(i), trH(i + vec3(1, 0, 0)), f.x), mix(trH(i + vec3(0, 1, 0)), trH(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(trH(i + vec3(0, 0, 1)), trH(i + vec3(1, 0, 1)), f.x), mix(trH(i + vec3(0, 1, 1)), trH(i + vec3(1, 1, 1)), f.x), f.y), f.z); }\n'
      + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { float n1 = trN(vTrollP * 9.0) * 0.6 + trN(vTrollP * 23.0) * 0.4, n2 = trN(vTrollP * 70.0);
    vec3 stone = mix(vec3(0.2, 0.23, 0.18), vec3(0.13, 0.15, 0.12), n2);
    float moss = smoothstep(0.5, 0.68, n1);
    vec3 hide = mix(stone, vec3(0.12, 0.2, 0.05), moss) * (0.8 + 0.4 * n2);
    diffuseColor.rgb = hide; }`); // (the skin shader lifts what it is given, so the base tones are kept dark)
  };
  const k0 = m0.customProgramCacheKey ? m0.customProgramCacheKey.bind(m0) : null; m.customProgramCacheKey = () => 'trollhide|' + (k0 ? k0() : '');
  return m;
}
function trollModel(e) {
  const holder = new THREE.Group(); const k = Math.floor((e.seed || 0.5) * 3);
  const skin = ['#6f7a5e', '#767c66', '#626e58'][k], moss = '#4e6a2a', hairC = '#2a2c22', bone = '#d8ccb0';
  const look = { kind: 'troll', race: 'human', gender: 'm', skin, hair: hairC, hairStyle: 3, bare: true, barefoot: true, width: 1.6, weapon: null, helm: null, hat: null, cape: null };
  let rig = null; try { rig = makeHumanoid(look, 'troll'); } catch (er) { rig = null; }
  const P = { holder, rig, lx: null, ly: null };
  P.anim = (av, ent, dt) => trollAnim(P, av, ent, dt);
  if (!rig) return { obj: holder, parts: P, height: 2 * TROLL_S };
  rig.mesh.scale.setScalar(TROLL_S); holder.add(rig.mesh); if (rig.setLod) rig.setLod(0);
  const B = rig.bones;
  // the body keeps its own skin shader, tinted a mossy grey-green (a copy of the material, so other people keep their skin);
  // warts, moss and bark plates give it the texture of stone and forest
  rig.mesh.traverse((o) => { if (o.isSkinnedMesh && o.geometry.attributes.position.count >= 5000) o.material = trollSkin(o.material); });
  // the troll's proportions: massive shoulders and arms, short thick legs (the hips come down to meet them)
  B.chest.scale.setScalar(1.2); for (const S of ['L', 'R']) { B['sh' + S].scale.setScalar(1.22); B['thigh' + S].scale.setScalar(0.8); }
  // fold away the human head, hands and feet
  for (const n of ['head', 'handL', 'handR', 'footL', 'footR']) B[n].scale.setScalar(0.001);
  P.hipDrop = rig.rest.hips[1] * 0.2 + 0.04;
  const at = (parent, child, from) => { const g = new THREE.Group(); g.position.copy(child.position); parent.add(g); return g; };
  // ---- the head ----
  const hm = new MB();
  hm.sph('rock', 0, 0.075, -0.01, 0.13, 0.11, 0.14, skin, 0, 16); // a low, wide skull
  for (const sx of [-1, 1]) hm.sph('rock', sx * 0.05, 0.108, 0.1, 0.065, 0.034, 0.05, K3.shade(skin, -0.06), 0, 12); // a heavy, rounded brow over each eye
  for (const sx of [-1, 1]) hm.sph('rock', sx * 0.075, 0.03, 0.085, 0.075, 0.065, 0.075, skin, 0, 12); // fat cheeks
  hm.sph('rock', 0, 0.015, 0.1, 0.1, 0.06, 0.09, skin, 0, 14); // the muzzle
  hm.sph('rock', 0, -0.04, 0.11, 0.11, 0.052, 0.09, K3.shade(skin, -0.04), 0, 14); // the jutting lower jaw
  hm.sph('dark', 0, -0.01, 0.17, 0.075, 0.009, 0.02, '#1a1410', 0, 10); // the mouth
  for (const sx of [-1, 1]) { hm.cone('gloss', sx * 0.055, -0.03, 0.16, 0.017, 0.1, bone, 8); hm.cone('gloss', sx * 0.025, -0.005, 0.17, 0.007, 0.03, bone, 6); } // tusks and teeth jutting up from the underbite
  hm.sph('rock', 0, 0.065, 0.165, 0.04, 0.05, 0.045, K3.shade(skin, 0.05), 0, 12); hm.sph('rock', 0, 0.045, 0.2, 0.03, 0.035, 0.035, K3.shade(skin, 0.05), 0, 10); taper(hm, 'rock', V(0, 0.04, 0.215), V(0, 0.0, 0.232), 0.022, K3.shade(skin, 0.05), 8); // a big hooked nose
  for (const sx of [-1, 1]) {
    hm.sph('dark', sx * 0.045, 0.085, 0.125, 0.03, 0.022, 0.02, '#120c08', 0, 8); hm.sph('glow', sx * 0.045, 0.085, 0.133, 0.011, 0.011, 0.008, '#ffc030', 0, 8); // deep-set, glowing
    taper(hm, 'rock', V(sx * 0.11, 0.085, -0.005), V(sx * 0.2, 0.09, -0.06), 0.032, skin, 9); taper(hm, 'rock', V(sx * 0.19, 0.09, -0.055), V(sx * 0.3, 0.05, -0.12), 0.019, skin, 8); taper(hm, 'rock', V(sx * 0.29, 0.054, -0.115), V(sx * 0.36, 0.0, -0.16), 0.01, skin, 6); // long ears, tapering and drooping
    for (let w = 0; w < 4; w++) hm.sph('rock', sx * (0.06 + w * 0.025), 0.03 + (w % 2) * 0.05, 0.09 - w * 0.02, 0.012, 0.012, 0.012, K3.shade(skin, -0.12), 0, 6); // warts
  }
  for (let j = 0; j < 22; j++) { // a mane of matted locks hanging from the crown over the neck and shoulders
    const a = (j / 21 - 0.5) * 3.0 + Math.sin(j * 5.3) * 0.08, ring = j % 2 ? 0.12 : 0.1, r0 = V(Math.sin(a) * ring, 0.15 - (j % 3) * 0.02, -0.03 - Math.cos(a) * 0.08);
    const len = 0.26 + ((j * 37) % 11) / 11 * 0.2, out = 1.25 + (j % 4) * 0.08; const mid = V(r0.x * out, r0.y - len * 0.45, r0.z - 0.07); const tip = V(r0.x * (out + 0.15), r0.y - len, r0.z - 0.1 + Math.sin(j) * 0.03);
    hm.rod('cloth', r0, mid, 0.017, hairC, 5); taper(hm, 'cloth', mid, tip, 0.016, K3.shade(hairC, (j % 3) * 0.05), 5); }
  const head = at(B.neck, B.head); head.add(hm.build()); P.head = head;
  // ---- three-fingered hands with claws, big flat feet ----
  for (const S of ['L', 'R']) {
    const sx = S === 'L' ? 1 : -1; const h = at(B['fore' + S], B['hand' + S]); const m = new MB();
    m.sph('rock', 0, -0.05, 0, 0.065, 0.075, 0.05, skin, 0, 10);
    for (let f = 0; f < 3; f++) { const z = -0.03 + f * 0.03; m.beam('rock', V(sx * 0.0, -0.1, z), V(sx * 0.01, -0.17, z + 0.01), 0.024, 0.024, skin); m.sph('gloss', sx * 0.012, -0.19, z + 0.02, 0.012, 0.022, 0.012, '#2a2418', 0, 6); }
    m.beam('rock', V(-sx * 0.04, -0.06, 0.02), V(-sx * 0.07, -0.12, 0.05), 0.022, 0.022, skin); // thumb
    h.add(m.build()); P['hand' + S] = h;
    const ft = at(B['shin' + S], B['foot' + S]); const fm = new MB();
    fm.box('rock', 0, -0.03, 0.06, 0.13, 0.07, 0.27, skin); for (let t = 0; t < 3; t++) { fm.sph('rock', (t - 1) * 0.04, -0.035, 0.2, 0.025, 0.03, 0.04, skin, 0, 8); fm.sph('gloss', (t - 1) * 0.04, -0.045, 0.245, 0.012, 0.01, 0.022, '#2a2418', 0, 6); }
    fm.sph('rock', 0, -0.01, -0.05, 0.06, 0.05, 0.06, skin, 0, 8); ft.add(fm.build());
  }
  // ---- belly, bark plates, moss and mushrooms, a loincloth on a belt of bones ----
  const bm = new MB(); bm.sph('rock', 0, -0.02, 0.1, 0.17, 0.16, 0.14, skin, 0, 12); const belly = bm.build(); B.spine.add(belly);
  const cm = new MB();
  for (const sx of [-1, 1]) { for (let b2 = 0; b2 < 6; b2++) { const ang = -0.6 + b2 * 0.28; shard(cm, 'bark', V(sx * (0.15 + Math.cos(ang) * 0.07), 0.2 + Math.sin(ang + 0.6) * 0.04, -0.1 + b2 * 0.04), [0.055, 0.016, 0.045 + (b2 % 2) * 0.012], [0.3 * (b2 % 3 - 1), b2 * 0.7, sx * (0.55 + b2 * 0.06)], b2 % 2 ? '#5a4a30' : '#4a3c26', b2 + (sx > 0 ? 10 : 0)); } // shards of bark hugging each shoulder
    shard(cm, 'bark', V(sx * 0.09, 0.12, 0.12), [0.05, 0.07, 0.014], [-0.2, sx * 0.25, 0.1 * sx], '#54442c', sx > 0 ? 3 : 4); // and one over the heart
    cm.sph('cloth', sx * 0.19, 0.26, -0.02, 0.09, 0.03, 0.11, moss, 0, 8); cm.sph('cloth', sx * 0.08, 0.2, -0.13, 0.08, 0.06, 0.03, moss, 0, 8); // moss
    for (let m2 = 0; m2 < 2; m2++) { const x = sx * (0.16 + m2 * 0.05), z = -0.04 + m2 * 0.05; cm.cyl('cloth', x, 0.285, z, 0.008, 0.035, '#e8dcc0', 6); cm.sph('cloth', x, 0.305, z, 0.026, 0.014, 0.026, m2 ? '#b8402a' : '#c8a060', 0, 8); } } // mushrooms
  for (let v = 0; v < 3; v++) cm.rod('cloth', V(-0.15 + v * 0.13, 0.25, -0.1), V(-0.1 + v * 0.1, 0.0, 0.13), 0.006, '#3e5a22', 4); // vines
  for (let w = 0; w < 14; w++) { const a = w * 2.39, y = 0.02 + (w % 5) * 0.05; cm.sph('rock', Math.cos(a) * 0.17, y, Math.sin(a) * 0.12, 0.016, 0.016, 0.014, K3.shade(skin, -0.14), 0, 6); } // warts
  const chestG = cm.build(); B.chest.add(chestG);
  for (const S of ['L', 'R']) { const am = new MB(); for (let w = 0; w < 6; w++) am.sph(w % 3 ? 'rock' : 'cloth', (w % 2 ? 0.03 : -0.03), -0.05 - w * 0.045, (w % 3 - 1) * 0.03, 0.02, 0.025, 0.02, w % 3 ? K3.shade(skin, -0.14) : moss, 0, 6); B['arm' + S].add(am.build()); } // warts and moss down the arms
  const lm = new MB(); lm.cyl('leather', 0, 0.02, 0, 0.18, 0.04, '#3a2a1a', 14); lm.box('leather', 0, -0.13, 0.13, 0.2, 0.26, 0.02, '#5a4028', 0, 0.1); lm.box('leather', 0, -0.12, -0.13, 0.22, 0.24, 0.02, '#4e3822', 0, -0.1);
  for (let j = 0; j < 9; j++) { const a = j / 9 * TAU; lm.cyl('gloss', Math.cos(a) * 0.185, 0.0, Math.sin(a) * 0.185, 0.012, 0.07, bone, 6); } lm.sph('gloss', 0.12, -0.02, 0.13, 0.04, 0.045, 0.04, bone, 0, 8); // bones, and a skull
  B.hips.add(lm.build());
  // ---- the club: a young tree torn up by the roots ----
  const club = new THREE.Group(); const tm = new MB();
  tm.cyl('bark', 0, 0.55, 0, 0.06, 1.3, '#5a4630', 10, 0.035);
  for (let r = 0; r < 7; r++) { const a = r / 7 * TAU; tm.rod('bark', V(0, 1.15, 0), V(Math.cos(a) * 0.2, 1.32 + (r % 3) * 0.06, Math.sin(a) * 0.2), 0.03, '#4e3c26', 5); tm.rod('bark', V(Math.cos(a) * 0.2, 1.32 + (r % 3) * 0.06, Math.sin(a) * 0.2), V(Math.cos(a) * 0.3, 1.28, Math.sin(a) * 0.3), 0.015, '#4e3c26', 4); }
  tm.sph('rock', 0, 1.22, 0, 0.13, 0.1, 0.13, '#5e5038', 0, 8); // a clod of earth caught in the roots
  for (const y of [0.4, 0.8]) tm.rod('bark', V(0, y, 0), V(0.12, y + 0.1, 0.02), 0.02, '#5a4630', 4);
  club.add(tm.build()); P.handR.add(club); club.position.set(0, -0.11, 0); club.rotation.set(Math.PI / 2, 0, 0); P.club = club;
  return { obj: holder, parts: P, height: 1.75 * TROLL_S };
}
function trollAnim(P, av, e, dt) {
  av.obj.rotation.x = 0; av.obj.rotation.z = 0;
  const dx = e.x - (P.lx == null ? e.x : P.lx), dy = e.y - (P.ly == null ? e.y : P.ly); P.lx = e.x; P.ly = e.y;
  const dist = Math.hypot(dx, dy) * PX; const moving = dist > 0.0004 && !e.dead;
  let want = 0; if (e.ramAim && !e.dead) want = K3.dampAngle(0, Math.atan2(e.ramAim.x - e.x, e.ramAim.y - e.y) - av.yaw, 1);
  P.holder.rotation.y = K3.dampAngle(P.holder.rotation.y, want, Math.min(1, dt * 3));
  const R = P.rig; if (!R) return; const B = R.bones;
  // the blow: from the gate rules (ramPh) at a gate, from the attack timer once it fights inside
  let wind = 0, strike = 0; const ph = e.dead || e.trollFree ? 0 : e.ramPh || 0;
  if (ph > 0) { if (ph < 0.62) wind = sm(0, 0.62, ph); else if (ph < 0.75) wind = 1; else strike = Math.min(1, (ph - 0.75) / 0.12); }
  else if (e.trollFree && e.atk > 0) { const a = e.atk; strike = a < 0.35 ? 0 : Math.min(1, (a - 0.35) / 0.15); wind = a < 0.35 ? sm(0, 0.35, a) : 0; }
  try { animateHumanoid(R, { move: moving ? 1 : 0, dist: moving ? dist / TROLL_S * 0.8 : 0, dir: [0, 1], combat: !!(wind || strike || e.inCombat) }, dt); } catch (er) {}
  // a hunched, heavy body: head forward and low, knees bent and bowed, the weight rolling from foot to foot
  const ph2 = R.phase || 0; const mv = R.mv || 0;
  B.hips.position.y -= P.hipDrop + Math.abs(Math.sin(ph2)) * 0.03 * mv; B.hips.position.x += Math.sin(ph2) * 0.05 * mv;
  B.hips.rotation.z += Math.sin(ph2) * 0.1 * mv; B.chest.rotation.z -= Math.sin(ph2) * 0.08 * mv;
  B.spine.rotation.x += 0.24; B.chest.rotation.x += 0.12; B.neck.rotation.x -= 0.12; P.head.rotation.x = -0.25;
  for (const [S, sx] of [['L', 1], ['R', -1]]) { B['thigh' + S].rotation.x -= 0.32; B['thigh' + S].rotation.z += sx * 0.16; B['shin' + S].rotation.x += 0.48; B['shin' + S].rotation.z -= sx * 0.12; }
  // two hands on the trunk, raised high, then brought down on the gate
  const up = wind * (1 - strike);
  if (up > 0 || strike > 0) {
    const lift = up ? -2.75 * up : -2.75 + 2.45 * strike, lean = up ? -0.32 * up : -0.32 + 0.82 * strike;
    for (const S of ['L', 'R']) { B['arm' + S].rotation.set(lift, 0, (S === 'L' ? -1 : 1) * 0.25); B['fore' + S].rotation.set(-0.45 * (1 - strike), 0, 0); }
    B.spine.rotation.x += lean; P.club.rotation.x = Math.PI / 2 - 0.4 * up;
  } else P.club.rotation.x = Math.PI / 2;
  if (P.lastStrike != null && P.lastStrike < 1 && strike >= 1) { // the blow lands: splinters, dust and a thud you can feel
    av.obj.getWorldPosition(_v); const a = av.yaw + P.holder.rotation.y; const fx3 = _v.x + Math.sin(a) * 3.2, fz3 = _v.z + Math.cos(a) * 3.2;
    dust(fx3, _v.y + 0.4, fz3, 20, { speed: 2.6, up: 1, col: '#8a7a62' }); chips(fx3, _v.y + 1.6, fz3, 18, '#6a4a2c', { speed: 3.5, up: 3, s: 0.1 });
    fx.burst(fx3, _v.y + 1.6, fz3, 12, '#ffd090', { speed: 3, life: 0.3 });
  }
  P.lastStrike = strike;
  if (moving && Math.random() < dt * 3) { av.obj.getWorldPosition(_v); dust(_v.x, _v.y + 0.05, _v.z, 2, { speed: 0.5, up: 0.2, s0: 0.5, s1: 1.6, a: 0.25 }); }
  if (R.setLod && K3.camera) R.setLod(av.obj.position.distanceTo(K3.camera.position) / TROLL_S);
  if (e.dead) { P.dk = Math.min(1, (P.dk || 0) + dt * 0.8); R.mesh.rotation.x = -Math.PI / 2 * sm(0, 1, P.dk); R.mesh.position.y = 0.3 * P.dk; }
  else if (P.dk) { P.dk = 0; R.mesh.rotation.x = 0; R.mesh.position.y = 0; }
}
// turn the turret onto the aim, recoil after a shot, slump when destroyed
function gunTurn(P, av, e, dt) {
  av.obj.rotation.x = 0; av.obj.rotation.z = 0;
  P.turret.rotation.y = Math.PI / 2 - (e.aimAng || 0) - av.yaw;
  if (e.turning && Math.random() < dt * 5) { P.holder.getWorldPosition(_v); const a = Math.random() * TAU; dust(_v.x + Math.cos(a) * P.foot, _v.y + 0.1, _v.z + Math.sin(a) * P.foot, 1, { speed: 0.3, up: 0.2, s0: 0.3, s1: 1, a: 0.3 }); }
  const since = (G.now - (e.fireAt || -1e9)) / 1000; const def = D.SIEGE[e.siege] || {}; const delay = e.delay || def.delay || 6;
  if (P.barrel) { const rc = since < 0.08 ? since / 0.08 : since < 1.6 ? Math.exp(-(since - 0.08) * 3.2) : 0; P.barrel.position.z = P.bz - P.kick * rc; }
  if (P.string) { // ballista: the cord snaps forward on the shot, then is winched back as it reloads
    const back = since < 0.12 ? 1 - since / 0.12 : K3.clamp((since - 0.6) / Math.max(0.5, delay * 0.7), 0, 1);
    P.string.forEach((g) => (g.position.z = P.sz - P.pull * back)); if (P.bolt) P.bolt.visible = back > 0.95; P.arms.forEach((a) => (a.rotation.y = a.userData.s * 0.28 * back));
    if (back > 0.02 && back < 0.98 && P.winch) P.winch.rotation.x -= dt * 4;
  }
  if (e.dead) { if (!P.wreck) { P.wreck = 1; P.turret.rotation.z = 0.14; P.turret.position.y -= 0.3; P.holder.getWorldPosition(_v); dust(_v.x, _v.y + 1.5, _v.z, 26, { speed: 3, spread: 2.5, col: '#5a5048', up: 1.4 }); } }
  else if (P.wreck) { P.wreck = 0; P.turret.rotation.z = 0; P.turret.position.y += 0.3; }
}
// Valenmoor's cannon: a bronze barrel on a red-painted, iron-bound wheeled carriage. The bombard: a monstrous
// hooped iron gun on a timber bed, chocked with wedges, its mouth a yard across.
function gunModel(e, big) {
  const F = D.FACTIONS[e.faction] || {}; const ban = F.banner || '#7a1e1e';
  const holder = new THREE.Group(); const turret = new THREE.Group(); holder.add(turret); holder.scale.setScalar(big ? 1.35 : 1.15);
  const base = new MB(); base.cylB('stone', 0, -0.2, 0, big ? 3.0 : 2.4, 0.32, '#857e72', 18); base.cylB('planks', 0, 0.1, 0, big ? 2.7 : 2.1, 0.08, '#6a4a2c', 18); holder.add(base.build());
  const m = new MB(); const L = big ? 3.9 : 3.2, R0 = big ? 0.55 : 0.3;
  if (big) { // the bed: two great beams, cross ties, wedges, a shot pile
    for (const sx of [-1, 1]) m.box('timber', sx * 0.85, 0.5, 0, 0.42, 0.5, 5.2, '#4e3520');
    for (const z of [-2.2, -0.8, 0.8, 2.2]) m.box('timber', 0, 0.42, z, 2.1, 0.3, 0.32, '#43301c');
    for (const sx of [-1, 1]) { m.box('timber', sx * 0.55, 0.95, -0.4, 0.3, 0.4, 0.5, '#5a3e24'); m.box('metalv', sx * 1.1, 0.9, 2.4, 0.12, 0.8, 0.12, '#3a3a40'); }
    for (let i = 0; i < 6; i++) m.sph('metalv', -1.6 + (i % 3) * 0.36, 0.3 + Math.floor(i / 3) * 0.3, -2.4 + (i % 2) * 0.1, 0.17, 0.17, 0.17, '#2a2a2e', 0, 8);
  } else { // the carriage: cheeks, axle, two big spoked wheels, trail and handspike
    for (const sx of [-1, 1]) { m.box('paint', sx * 0.36, 0.72, -0.3, 0.12, 0.62, 2.2, '#7a2a1e'); m.box('metalv', sx * 0.43, 0.98, -0.2, 0.02, 0.06, 2.0, '#2e2e34'); }
    m.cyl('metalv', 0, 0.62, 0.2, 0.06, 1.5, '#2e2e34', 8, null, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) { m.cyl('planks', sx * 0.68, 0.62, 0.2, 0.62, 0.12, '#5a3e24', 16, null, 0, 0, Math.PI / 2); m.cyl('metalv', sx * 0.68, 0.62, 0.2, 0.64, 0.06, '#2e2e34', 18, null, 0, 0, Math.PI / 2); for (let k = 0; k < 6; k++) m.box('timber', sx * 0.68, 0.62, 0.2, 0.05, 1.18, 0.07, '#43301c', 0, k * Math.PI / 6 * 2); }
    m.beam('paint', V(0, 0.55, -1.2), V(0, 0.08, -2.4), 0.3, 0.16, '#7a2a1e'); m.cyl('timber', 0.25, 0.4, -2.2, 0.03, 1.2, '#5a3a20', 6, null, 0, 0.5);
    for (let i = 0; i < 5; i++) m.sph('metalv', 1.0 + (i % 2) * 0.22, 0.12 + (i > 2 ? 0.2 : 0), -1.1 + (i % 3) * 0.22, 0.11, 0.11, 0.11, '#2a2a2e', 0, 8);
  }
  m.box('cloth2', 0, big ? 0.55 : 0.4, big ? 2.7 : 1.0, 0.8, 0.5, 0.02, ban);
  turret.add(m.build());
  // the barrel (recoils along -z)
  const barrel = new THREE.Group(); const by = big ? 1.4 : 1.02, bz = big ? 0.4 : 0.2; barrel.position.set(0, by, bz); turret.add(barrel);
  const bm = new MB(); const metal = big ? '#7a7c84' : '#9a6a32';
  bm.cyl('metalv', 0, 0, L * 0.4, R0, L, metal, 18, R0 * 0.82, 0, Math.PI / 2, 0);
  bm.cyl('metalv', 0, 0, L * 0.9, R0 * 1.12, 0.22, metal, 18, null, 0, Math.PI / 2, 0); bm.cyl('dark', 0, 0, L * 0.9 + 0.12, R0 * 0.62, 0.02, '#050505', 16, null, 0, Math.PI / 2, 0);
  bm.sph('metalv', 0, 0, -L * 0.1, R0 * 1.05, R0 * 1.05, R0 * 0.9, metal, 0, 12); bm.sph('metalv', 0, 0, -L * 0.1 - R0, R0 * 0.32, R0 * 0.32, R0 * 0.32, metal, 0, 8);
  for (const k of (big ? [0, 0.18, 0.36, 0.54, 0.72] : [0.1, 0.45])) bm.cyl('metalv', 0, 0, -L * 0.05 + L * k, R0 * 1.08, 0.12, big ? '#55575e' : '#7a5228', 18, null, 0, Math.PI / 2, 0);
  if (!big) for (const sx of [-1, 1]) bm.cyl('metalv', sx * R0, 0, 0.15, 0.07, 0.18, metal, 8, null, 0, 0, Math.PI / 2); // trunnions
  barrel.add(bm.build());
  const P = { holder, turret, barrel, bz, kick: big ? 0.55 : 0.45, foot: big ? 2.8 : 2.2, muzzle: (L * 0.9 + 0.2) * (big ? 1.35 : 1.15), mh: by * (big ? 1.35 : 1.15) };
  P.anim = (av, ent, dt) => gunTurn(P, av, ent, dt);
  return { obj: holder, parts: P, height: big ? 3.2 : 2.4 };
}
// Aelindor's ballistas: a giant elven war bow on a carved turntable; the great ballista has two bows, one above the other
function ballistaModel(e, big) {
  const F = D.FACTIONS[e.faction] || {}; const ban = F.banner || '#2e6a3c', trim = F.trim || '#e7d48a';
  const holder = new THREE.Group(); const turret = new THREE.Group(); holder.add(turret); holder.scale.setScalar(big ? 1.45 : 1.2);
  const base = new MB(); base.cylB('stone', 0, -0.2, 0, big ? 2.6 : 2.1, 0.3, '#8a8a7a', 16); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; base.box('gold', Math.cos(a) * (big ? 2.45 : 1.95), 0.12, Math.sin(a) * (big ? 2.45 : 1.95), 0.3, 0.06, 0.12, '#c8a040', -a); } holder.add(base.build());
  const m = new MB(); const L = big ? 4.6 : 3.6, H = 1.25;
  // a carved pedestal like a tree trunk, roots spreading, and the long stock on top
  m.cyl('bark', 0, 0.55, 0, 0.32, 1.1, '#6a5a3a', 10, 0.24); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; m.beam('bark', V(Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2), V(Math.cos(a) * 0.9, 0.05, Math.sin(a) * 0.9), 0.14, 0.12, '#5e4e32'); }
  m.box('timber', 0, H, 0.2, 0.34, 0.26, L, '#8a6a3a'); m.box('gold', 0, H + 0.14, 0.2, 0.08, 0.03, L * 0.9, '#c8a040');
  m.box('cloth2', 0, H - 0.3, -L * 0.3, 0.02, 0.5, 0.9, ban); m.box('cloth2', 0, H - 0.05, -L * 0.3, 0.025, 0.06, 0.9, trim);
  turret.add(m.build());
  const winch = new THREE.Group(); { const w = new MB(); w.cyl('timber', 0, 0, 0, 0.12, 0.9, '#5a3e24', 10, null, 0, 0, Math.PI / 2); for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) w.box('timber', sx * 0.45, 0, 0, 0.05, 0.6, 0.05, '#43301c', 0, k * Math.PI / 2); winch.add(w.build()); } winch.position.set(0, H, -L / 2 + 0.3); turret.add(winch);
  // the bow arms (they flex back as the cord is drawn) and the cord
  const arms = [], strings = []; const span = big ? 2.6 : 2.0; const rows = big ? [H + 0.05, H + 0.5] : [H + 0.05];
  for (const y of rows) for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 0.16, y, L / 2 - 0.1); a.userData.s = -sx; const am = new MB();
    const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(V(sx * t * span, 0, -0.35 * t * t + 0.08 * Math.sin(t * Math.PI))); }
    for (let k = 0; k < 8; k++) am.rod('haft', pts[k], pts[k + 1], 0.09 - k * 0.008, '#a88a58', 6);
    am.sph('gold', sx * span, 0, -0.35, 0.07, 0.07, 0.07, '#c8a040', 0, 8); a.add(am.build()); turret.add(a); arms.push(a);
    const sg = new THREE.Group(); sg.position.set(0, y, L / 2 - 0.45); const sm3 = new MB(); for (const s2 of [-1, 1]) sm3.rod('paint', V(s2 * span, 0, 0), V(0, 0, 0), 0.012, '#e8e0d0', 3); sg.add(sm3.build()); turret.add(sg); strings.push(sg);
  }
  const bolt = new THREE.Group(); { const b2 = new MB(); b2.cyl('timber', 0, 0, 0, 0.06, L * 0.85, '#6a4a2a', 8, null, 0, Math.PI / 2, 0); b2.sph('metalv', 0, 0, L * 0.43, 0.1, 0.1, 0.26, '#8e9a90', 0, 8); bolt.add(b2.build()); } bolt.position.set(0, H + 0.2, 0.2); turret.add(bolt);
  const P = { holder, turret, arms, string: strings, sz: L / 2 - 0.45, pull: big ? 1.4 : 1.1, bolt, winch, foot: big ? 2.4 : 2.0 };
  P.anim = (av, ent, dt) => gunTurn(P, av, ent, dt);
  return { obj: holder, parts: P, height: big ? 3.4 : 2.6 };
}
// the ram, and the catapults and trebuchets inside the walls; anything else keeps the older engine models (actors.js)
export function siegeModel(e) {
  if (e.troll) return trollModel(e);
  if (e.big && (e.siege === 'bigcannon' || e.siege === 'bombard')) return gunModel(e, e.siege === 'bombard');
  if (e.big && (e.siege === 'bigballista' || e.siege === 'greatballista')) return ballistaModel(e, e.siege === 'greatballista');
  if (e.ram) return ramModel(e);
  if (e.big && e.siege === 'trebuchet') return trebModel(e);
  if (e.big && e.siege === 'catapult') return catModel(e);
  return null;
}

// ---------- the city gates ----------
const gateRoot = new THREE.Group(); gateRoot.name = 'gates'; K3.scene.add(gateRoot);
const gviz = new Map();
const PORT_UP = 4.6;
function buildGate(g, cd) {
  const n = g.tiles.length || 3, Wg = n * TILE, H = 4.35;
  const grp = new THREE.Group(); const y0 = cd._y3 != null ? cd._y3 : geo.floorAt(g.x, g.y);
  grp.position.set(g.x * PX, y0, g.y * PX); grp.rotation.y = Math.atan2(g.out[0], g.out[1]);
  const shake = new THREE.Group(); grp.add(shake);
  const leaves = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(s * Wg / 2, 0, -0.32); shake.add(hinge);
    const mb = new MB(); const w = Wg / 2; const np = Math.max(4, Math.round(w / 0.3));
    for (let k = 0; k < np; k++) { const x = -s * (k + 0.5) * (w / np); mb.box('planks', x, H / 2, 0, w / np - 0.015, H, 0.16, K3.shade('#6a4a2c', (K3.hash(k, s + 3, 3) - 0.5) * 0.25)); }
    for (const y of [0.55, 2.2, 3.85]) { mb.box('metalv', -s * w / 2, y, 0.09, w - 0.02, 0.14, 0.03, '#26262a'); for (let k = 0; k < 5; k++) mb.sph('metalv', -s * (0.22 + k * (w - 0.44) / 4), y, 0.11, 0.05, 0.05, 0.03, '#3a3a40', 0, 8); }
    mb.beam('timber', V(-s * 0.2, 0.7, -0.12), V(-s * (w - 0.2), 3.7, -0.12), 0.18, 0.08, '#4e3520');
    mb.box('timber', -s * w / 2, 1.45, -0.12, w - 0.1, 0.18, 0.08, '#4e3520'); mb.box('timber', -s * w / 2, 3.0, -0.12, w - 0.1, 0.18, 0.08, '#4e3520');
    mb.cyl('metalv', -s * 0.2, 1.6, 0.12, 0.12, 0.03, '#2e2e34', 12, null, 0, Math.PI / 2, 0);
    hinge.add(mb.build());
    leaves.push({ s, hinge, extra: [] });
  }
  const pc = new MB(); const nb = Math.max(6, Math.round(Wg / 0.42));
  for (let k = 0; k <= nb; k++) { const x = -Wg / 2 + 0.14 + k * ((Wg - 0.28) / nb); pc.cyl('metalv', x, 2.45, 0, 0.045, 4.5, '#2a2a2e', 6); pc.cyl('metalv', x, 0.06, 0, 0.055, 0.3, '#2a2a2e', 6, 0.004, 0, Math.PI, 0); }
  for (let y = 0.6; y < 4.7; y += 0.72) pc.box('metalv', 0, y, 0, Wg - 0.12, 0.1, 0.07, '#2e2e33');
  const port = new THREE.Group(); port.add(pc.build()); port.position.set(0, PORT_UP, 0.16); shake.add(port);
  grp.visible = false; gateRoot.add(grp);
  return { g, cd, grp, shake, leaves, port, Wg, H, y0, doorK: 0, portK: 0, hits: 0, broken: false, imp: 0, debris: [] };
}
function disposeGate(v) { gateRoot.remove(v.grp); for (const d of v.debris) gateRoot.remove(d.o); v.debris.length = 0; }
function crack(v, h) {
  for (const L of v.leaves) {
    const mb = new MB(); const w = v.Wg / 2;
    for (let k = 0; k < 3 + h; k++) {
      const x = -L.s * (0.15 + Math.random() * Math.min(w - 0.3, 0.4 + h * 0.18)), y = 0.8 + Math.random() * (1.2 + h * 0.3), len = 0.35 + Math.random() * (0.3 + h * 0.18);
      mb.box('dark', x, y, 0.085, 0.025, len, 0.02, '#000000', 0, 0, (Math.random() - 0.5) * 2.4);
    }
    if (h >= 2) for (let k = 0; k < h; k++) { const x = -L.s * (0.12 + Math.random() * 0.6), y = 1.0 + Math.random() * 1.4; mb.box('planks', x, y, 0.14, 0.05, 0.3 + Math.random() * 0.4, 0.05, '#c8a070', 0, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2); }
    const o = mb.build(); L.hinge.add(o); L.extra.push(o);
  }
}
function hitFx(v, big) {
  v.grp.localToWorld(_v.set(0, 1.3, 0.45));
  v.grp.localToWorld(_v2.set(0, 0, 1)).sub(v.grp.position).normalize();
  dust(_v.x, _v.y - 1.0, _v.z, big ? 50 : 18, { speed: big ? 3.2 : 1.8, spread: big ? 3 : 1.4, up: big ? 1.6 : 0.8, vx: _v2.x * 0.6, vz: _v2.z * 0.6 });
  chips(_v.x, _v.y, _v.z, big ? 46 : 18, '#a07848', { speed: big ? 5 : 3.2, vx: _v2.x * (big ? -0.6 : 0.5), vz: _v2.z * (big ? -0.6 : 0.5), s: 0.08 });
  fx.burst(_v.x, _v.y + 0.3, _v.z, big ? 40 : 16, '#ffc070', { speed: 4, life: 0.45 });
}
const tmpl = {};
function debrisPiece(kind) {
  if (!tmpl[kind]) {
    const mb = new MB();
    if (kind === 'plank') mb.box('planks', 0, 0, 0, 0.3, 1.6, 0.16, '#6a4a2c');
    else if (kind === 'plank2') { mb.box('planks', 0, 0, 0, 0.6, 0.9, 0.16, '#5e4226'); mb.box('metalv', 0, 0.2, 0.09, 0.6, 0.14, 0.03, '#26262a'); }
    else if (kind === 'beam') mb.box('timber', 0, 0, 0, 0.18, 1.9, 0.1, '#4e3520');
    else { for (let k = 0; k < 3; k++) mb.cyl('metalv', -0.4 + k * 0.4, 0, 0, 0.045, 1.6, '#2a2a2e', 6); mb.box('metalv', 0, 0.3, 0, 1.0, 0.1, 0.07, '#2e2e33'); }
    tmpl[kind] = mb.build();
  }
  return tmpl[kind].clone();
}
function breakGate(v) {
  v.broken = true; v.shake.visible = false; hitFx(v, true);
  const inward = new THREE.Vector3(); v.grp.localToWorld(inward.set(0, 0, -1)).sub(v.grp.position).normalize();
  const side = new THREE.Vector3(inward.z, 0, -inward.x);
  for (let k = 0; k < 16; k++) {
    const kind = k < 8 ? 'plank' : k < 12 ? 'plank2' : k < 14 ? 'beam' : 'bars';
    const o = debrisPiece(kind); const lx = (Math.random() - 0.5) * v.Wg * 0.9, ly = 0.6 + Math.random() * 3;
    v.grp.localToWorld(o.position.set(lx, ly, -0.2)); o.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); gateRoot.add(o);
    const sp = kind === 'bars' ? 2 + Math.random() * 2 : 4 + Math.random() * 6;
    v.debris.push({ o, vx: inward.x * sp + side.x * (Math.random() - 0.5) * 4, vy: 1.5 + Math.random() * 4, vz: inward.z * sp + side.z * (Math.random() - 0.5) * 4, wx: (Math.random() - 0.5) * 9, wy: (Math.random() - 0.5) * 6, wz: (Math.random() - 0.5) * 9, rest: false, flat: kind !== 'bars' });
  }
}
function unbreak(v) {
  v.broken = false; v.shake.visible = true; v.hits = 0;
  for (const d of v.debris) gateRoot.remove(d.o); v.debris.length = 0;
  for (const L of v.leaves) { for (const o of L.extra) L.hinge.remove(o); L.extra.length = 0; }
}
function updDebris(v, dt) {
  for (const d of v.debris) {
    if (d.rest) continue; const o = d.o;
    d.vy -= 9.8 * dt; o.position.x += d.vx * dt; o.position.y += d.vy * dt; o.position.z += d.vz * dt;
    o.rotation.x += d.wx * dt; o.rotation.y += d.wy * dt; o.rotation.z += d.wz * dt;
    const gy = geo.floorAt(o.position.x / PX, o.position.z / PX) + 0.08;
    if (o.position.y < gy) {
      o.position.y = gy;
      if (Math.abs(d.vy) < 2.2) { d.rest = true; if (d.flat) { o.rotation.x = Math.PI / 2; o.rotation.z = 0; } }
      else { d.vy = -d.vy * 0.3; d.vx *= 0.45; d.vz *= 0.45; d.wx *= 0.5; d.wz *= 0.5; }
    }
  }
}
function updGate(v, dt) {
  const g = v.g;
  if (g.broken && !v.broken) { if (v.hits < g.hits) v.hits = g.hits; breakGate(v); }
  if (!g.closed && v.broken) unbreak(v);
  if (g.closed && !g.broken) {
    v.doorK = Math.min(1, v.doorK + dt / 1.1);
    if (v.doorK >= 1) { const was = v.portK; v.portK = Math.min(1, v.portK + dt / 0.45); if (was < 1 && v.portK >= 1) { v.imp = 0.6; for (let k = -2; k <= 2; k++) { v.grp.localToWorld(_v.set(k * v.Wg / 5, 0.1, 0.3)); dust(_v.x, _v.y, _v.z, 4, { speed: 1.2, up: 0.4 }); } } }
  } else if (!g.closed) { v.portK = Math.max(0, v.portK - dt / 2.2); if (v.portK <= 0) v.doorK = Math.max(0, v.doorK - dt / 1.6); }
  if (g.hits > v.hits && !g.broken) { for (let h = v.hits + 1; h <= g.hits; h++) crack(v, h); v.hits = g.hits; v.imp = 1; hitFx(v, false); }
  v.imp = Math.max(0, v.imp - dt * 3.2);
  const bow = Math.min(0.2, v.hits * 0.038) + v.imp * 0.07 * Math.cos(v.imp * 14);
  const dk = sm(0, 1, v.doorK);
  for (const L of v.leaves) L.hinge.rotation.y = -L.s * ((1 - dk) * Math.PI / 2 + (v.doorK >= 1 ? bow : 0));
  const u = v.portK; v.port.position.y = PORT_UP * (1 - u * u);
  v.port.rotation.x = -Math.min(0.12, v.hits * 0.022) - (u >= 1 ? v.imp * 0.03 : 0);
  v.shake.position.z = -v.imp * 0.12;
  v.port.visible = v.portK > 0.001;
  v.grp.visible = !v.broken && (v.doorK > 0.001 || v.portK > 0.001);
  updDebris(v, dt);
}
function updGates(dt) {
  const War = KR.War; if (!War || !War.gateList) return;
  const main = !W.realm || W.realm === 'main';
  gateRoot.visible = main; if (!main) return;
  if (!gateRoot.parent) K3.scene.add(gateRoot);
  const cam = K3.camera.position;
  for (const f of D.FACTION_IDS) {
    const cd = W.cityData && W.cityData[f]; if (!cd) continue;
    for (const g of War.gateList(f)) {
      const key = f + ':' + g.i; let v = gviz.get(key);
      if (v && (v.g !== g || v.cd !== cd)) { disposeGate(v); gviz.delete(key); v = null; }
      if (!v) { if (!g.closed) continue; v = buildGate(g, cd); gviz.set(key, v); }
      updGate(v, dt);
      if (Math.hypot(v.grp.position.x - cam.x, v.grp.position.z - cam.z) > 320) v.grp.visible = false;
    }
  }
}
// boulders landing, a ram going up in flames
function drainEvents() {
  const War = KR.War; if (!War || !War.events || !War.events.length) return;
  const evs = War.events.splice(0, War.events.length);
  for (const e of evs) {
    if (e.k === 'impact') {
      const x = e.x * PX, z = e.y * PX, y = geo.floorAt(e.x, e.y);
      dust(x, y + 0.2, z, e.big ? 40 : 26, { speed: e.big ? 4 : 3, spread: 1.5, up: 1.2, col: '#8a7a66', life: 2 });
      chips(x, y + 0.3, z, e.big ? 30 : 18, '#7a7268', { speed: 4.5, up: 4, s: 0.12 });
      fx.burst(x, y + 0.4, z, 14, '#ffd090', { speed: 3, life: 0.35 });
    } else if (e.k === 'fire' && (e.kind === 'bigcannon' || e.kind === 'bombard')) {
      // flame and a great bank of smoke from the muzzle, rolling forward and up
      const big = e.kind === 'bombard'; const L = big ? 5.6 : 3.9, h = big ? 1.9 : 1.2; const ca = Math.cos(e.ang || 0), sa = Math.sin(e.ang || 0);
      const x = e.x * PX + ca * L, z = e.y * PX + sa * L, y = geo.floorAt(e.x, e.y) + h;
      fx.burst(x, y, z, big ? 40 : 24, '#ffb040', { speed: big ? 6 : 4.5, life: 0.25 });
      for (let i = 0; i < (big ? 34 : 20); i++) fx.smoke.emit({ x: x + (Math.random() - 0.5) * 0.4, y: y + (Math.random() - 0.5) * 0.4, z: z + (Math.random() - 0.5) * 0.4, vx: ca * (2 + Math.random() * 4) + (Math.random() - 0.5), vy: 0.4 + Math.random() * 0.8, vz: sa * (2 + Math.random() * 4) + (Math.random() - 0.5), drag: 1.3, life: 2.5 + Math.random() * 2, s0: big ? 0.9 : 0.6, s1: big ? 4 : 2.6, r: 0.78, g: 0.76, b: 0.72, a: 0.5, kind: 2 });
      dust(e.x * PX, geo.floorAt(e.x, e.y) + 0.1, e.y * PX, big ? 16 : 8, { speed: 2, spread: 2, up: 0.4, a: 0.3 });
    } else if (e.k === 'fire' && (e.kind === 'bigballista' || e.kind === 'greatballista')) {
      const x = e.x * PX, z = e.y * PX, y = geo.floorAt(e.x, e.y); dust(x, y + 0.1, z, 6, { speed: 1, spread: 1.5, up: 0.3, a: 0.25 });
    } else if (e.k === 'ramdie') {
      const x = e.x * PX, z = e.y * PX, y = geo.floorAt(e.x, e.y);
      for (let i = 0; i < 30; i++) fx.add.emit({ x: x + (Math.random() - 0.5) * 2, y: y + 0.8 + Math.random() * 1.5, z: z + (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2, life: 0.9, s0: 0.9, s1: 0.2, r: 3, g: 1.4, b: 0.4, kind: 0 });
    }
  }
}
K3.updaters.push((dt) => { try { drainEvents(); updGates(dt); } catch (er) { if (!updGates._warned) { updGates._warned = true; console.warn('siege3d', er); } } });
export const _siegeTest = { buildGate, updGate }; // used by the render checks
