// Creatures (procedural animals, spiders, crabs, humanoid monsters), mob AI, and village NPCs.
import * as THREE from 'three';
import { MOBS, NPCS, mobHp, mobDmg, mobXp } from './data.js';
import { buildHumanoid, animateHumanoid, equipWeapon, makeWeapon, limbGeo, setDetail, bake } from './character.js';
import { heightAt, isWater, normalAt } from './terrain.js';
import { collide } from './world.js';
import { G } from './state.js';
import { S } from './audio.js';
import { V } from './vfx.js';
import { angDiff, rand } from './util.js';

const mat = (c, r = 0.85, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r }, o));
function mesh(g, m, p, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; }
function piv(p, x = 0, y = 0, z = 0) { const o = new THREE.Object3D(); o.position.set(x, y, z); p.add(o); return o; }

// ---------- quadrupeds ----------
const QV = {
  // len: body length, ch: chest radius, hip: hip radius, legL: leg length, legR: leg thickness, neck, headR, snout (muzzle length), ears, tail, extras
  wolf: { len: 1.05, ch: 0.25, hip: 0.19, waist: 0.15, legL: 0.62, legR: 0.05, neck: 0.3, neckUp: 0.55, headR: 0.13, snout: 0.22, snoutR: 0.07, ears: 'point', earL: 0.13, tail: 0.55, tailR: 0.075, ruff: true, under: 0.45 },
  hound: { len: 1.1, ch: 0.26, hip: 0.19, waist: 0.14, legL: 0.66, legR: 0.05, neck: 0.32, neckUp: 0.5, headR: 0.14, snout: 0.24, snoutR: 0.075, ears: 'point', earL: 0.15, tail: 0.6, tailR: 0.06, ruff: true, under: -0.2, ember: true },
  bear: { len: 1.05, ch: 0.42, hip: 0.38, waist: 0.36, legL: 0.5, legR: 0.11, neck: 0.18, neckUp: 0.25, headR: 0.2, snout: 0.14, snoutR: 0.09, ears: 'round', earL: 0.07, tail: 0.1, tailR: 0.06, hump: true, under: 0.15, plantigrade: true },
  boar: { len: 0.95, ch: 0.33, hip: 0.27, waist: 0.28, legL: 0.34, legR: 0.055, neck: 0.08, neckUp: 0.1, headR: 0.18, snout: 0.24, snoutR: 0.09, ears: 'point', earL: 0.1, tail: 0.2, tailR: 0.02, tusks: true, mane: true, under: 0.1, plantigrade: true },
  deer: { len: 0.95, ch: 0.22, hip: 0.2, waist: 0.17, legL: 0.85, legR: 0.035, neck: 0.5, neckUp: 1.0, headR: 0.11, snout: 0.17, snoutR: 0.055, ears: 'long', earL: 0.15, tail: 0.1, tailR: 0.04, antlers: true, under: 0.5 },
  rabbit: { len: 0.32, ch: 0.15, hip: 0.17, waist: 0.13, legL: 0.12, legR: 0.03, neck: 0.04, neckUp: 0.6, headR: 0.1, snout: 0.05, snoutR: 0.05, ears: 'bunny', earL: 0.2, tail: 0.04, tailR: 0.05, under: 0.5, plantigrade: true },
};
function buildQuad(variant, col, size) {
  const P = QV[variant];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const base = new THREE.Color(col);
  const M = mat(col, 0.92), dark = mat(base.clone().multiplyScalar(0.5), 0.9), light = mat(P.under >= 0 ? base.clone().lerp(new THREE.Color('#f4ece0'), P.under) : base.clone().multiplyScalar(0.6), 0.92);
  const nose = mat('#141010', 0.35), eyeM = P.ember ? new THREE.MeshBasicMaterial({ color: '#ffb020' }) : mat('#1a1208', 0.25);
  const hipY = P.legL + P.hip * 0.35;
  const torso = piv(body, 0, hipY, 0); // origin at the hips, body extends to +z
  // body: hips, waist, ribcage
  const hip = mesh(new THREE.SphereGeometry(P.hip, 16, 12), M, torso, 0, 0.02, 0); hip.scale.set(0.95, 1, 1.15);
  const waist = mesh(limbGeo(P.ch * 0.92, P.waist * 1.05, P.len * 0.7, 14), M, torso, 0, P.ch * 0.18, P.len * 0.75); waist.rotation.x = Math.PI / 2 + 0.08;
  const chest = mesh(new THREE.SphereGeometry(P.ch, 16, 12), M, torso, 0, P.ch * 0.2, P.len * 0.75); chest.scale.set(0.82, 1.05, 1.15);
  const belly = mesh(new THREE.SphereGeometry(P.ch * 0.8, 12, 8), light, torso, 0, -P.ch * 0.25, P.len * 0.62); belly.scale.set(0.75, 0.65, 1.5);
  if (P.hump) { mesh(new THREE.SphereGeometry(P.ch * 0.7, 12, 8), M, torso, 0, P.ch * 0.75, P.len * 0.78); }
  if (P.ruff) { const r = mesh(new THREE.SphereGeometry(P.ch * 0.8, 12, 8), light, torso, 0, P.ch * 0.1, P.len * 1.0); r.scale.set(0.95, 1.15, 0.8); const r2 = mesh(new THREE.SphereGeometry(P.ch * 0.75, 12, 8), M, torso, 0, P.ch * 0.65, P.len * 0.9); r2.scale.set(0.9, 0.8, 1.1); }
  if (P.mane) for (let i = 0; i < 6; i++) { const c = mesh(new THREE.ConeGeometry(0.04, 0.16, 4), dark, torso, 0, P.ch * 0.9, P.len * (0.2 + i * 0.14)); c.rotation.x = -0.4; }
  // neck & head
  const neck = piv(torso, 0, P.ch * 0.45, P.len * 0.95);
  neck.rotation.x = -P.neckUp;
  const nk = mesh(limbGeo(P.ch * 0.55, P.headR * 0.85, P.neck + 0.06, 12), M, neck); nk.rotation.x = -Math.PI / 2;
  const head = piv(neck, 0, 0, P.neck);
  const headRot = piv(head); headRot.rotation.x = P.neckUp * 0.9; // keep the head level
  const skull = mesh(new THREE.SphereGeometry(P.headR, 16, 12), M, headRot); skull.scale.set(0.9, 0.85, 1.05);
  const muz = mesh(limbGeo(P.snoutR * 1.25, P.snoutR * 0.85, P.snout + P.headR * 0.5, 12), variant === 'bear' || variant === 'boar' ? M : light, headRot, 0, -P.headR * 0.25, P.headR * 0.2); muz.rotation.x = -Math.PI / 2 + 0.08;
  const nz = P.headR * 0.2 + P.snout + P.headR * 0.5;
  mesh(new THREE.SphereGeometry(P.snoutR * (variant === 'boar' ? 1.1 : 0.65), 10, 8), variant === 'boar' ? mat('#c89090', 0.5) : nose, headRot, 0, -P.headR * 0.22, nz).scale.z = variant === 'boar' ? 0.4 : 0.8;
  const jaw = mesh(limbGeo(P.snoutR * 0.9, P.snoutR * 0.6, P.snout + P.headR * 0.3, 10), light, headRot, 0, -P.headR * 0.45, P.headR * 0.15); jaw.rotation.x = -Math.PI / 2 + 0.22;
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(P.headR * 0.13, 8, 6), eyeM, headRot, s * P.headR * 0.42, P.headR * 0.2, P.headR * 0.68); e.scale.set(1, 0.75, 0.6);
    if (P.ears === 'point') { const ear = mesh(new THREE.ConeGeometry(P.headR * 0.33, P.earL, 4), M, headRot, s * P.headR * 0.48, P.headR * 0.78, -P.headR * 0.05); ear.rotation.z = -s * 0.25; ear.rotation.x = -0.15; ear.scale.z = 0.45; const inn = mesh(new THREE.ConeGeometry(P.headR * 0.2, P.earL * 0.75, 3), dark, ear, 0, -P.earL * 0.05, 0.02); }
    else if (P.ears === 'round') { const ear = mesh(new THREE.SphereGeometry(P.headR * 0.32, 8, 6), M, headRot, s * P.headR * 0.7, P.headR * 0.72, -P.headR * 0.1); ear.scale.z = 0.5; }
    else if (P.ears === 'long') { const ear = mesh(new THREE.ConeGeometry(P.headR * 0.3, P.earL, 6), M, headRot, s * P.headR * 0.75, P.headR * 0.6, -P.headR * 0.25); ear.rotation.z = -s * 1.1; ear.scale.z = 0.4; }
    else if (P.ears === 'bunny') { const ear = mesh(limbGeo(P.headR * 0.28, P.headR * 0.22, P.earL), M, headRot, s * P.headR * 0.35, P.headR * 0.6, -P.headR * 0.25); ear.rotation.x = Math.PI - 0.35; ear.rotation.z = s * 0.18; ear.scale.z = 0.45; }
    if (P.tusks) { const t = mesh(new THREE.ConeGeometry(0.022, 0.13, 5), mat('#f0e8d0', 0.4), headRot, s * P.snoutR * 0.9, -P.headR * 0.3, nz - 0.06); t.rotation.x = -0.9; t.rotation.z = s * 0.3; }
    if (P.antlers) { const a = new THREE.Group(); a.position.set(s * P.headR * 0.38, P.headR * 0.75, -0.02); headRot.add(a); const am = mat('#e0cfa8', 0.7); const m1 = mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.42, 5), am, a, 0, 0.2, 0); m1.rotation.z = -s * 0.45; m1.rotation.x = -0.3; for (let k = 0; k < 3; k++) { const b = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.17, 4), am, a, -s * (0.05 + 0.06 * k), 0.13 + k * 0.11, 0.05 - k * 0.04); b.rotation.x = 0.8; b.rotation.z = -s * 0.25; } }
  }
  // legs: front legs straight, hind legs with a backward hock (digitigrade) unless plantigrade
  const legs = [];
  for (const [side, front] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
    const z = front ? P.len * 0.88 : P.len * 0.02;
    const hipP = piv(torso, side * (front ? P.ch : P.hip) * 0.58, front ? -P.ch * 0.1 : -P.hip * 0.1, z);
    const L = P.legL + (front ? P.ch * 0.1 : P.hip * 0.25);
    const up = mesh(limbGeo(P.legR * (front ? 1.5 : 2.0), P.legR * 1.05, L * 0.45, 10), M, hipP);
    const knee = piv(hipP, 0, -L * 0.45, 0);
    let foot;
    if (!front && !P.plantigrade) {
      up.rotation.x = 0; hipP.userData.base = 0.35; knee.userData.base = -0.9;
      mesh(limbGeo(P.legR * 1.05, P.legR * 0.9, L * 0.32, 8), M, knee);
      const hock = piv(knee, 0, -L * 0.32, 0); hock.userData.base = 0.6;
      mesh(limbGeo(P.legR * 0.9, P.legR * 0.75, L * 0.3, 8), dark, hock);
      foot = piv(hock, 0, -L * 0.3, 0); legs.push({ hip: hipP, knee, hock, front: false, side });
    } else {
      hipP.userData.base = front ? -0.05 : 0.1; knee.userData.base = front ? 0.05 : -0.1;
      mesh(limbGeo(P.legR * 1.05, P.legR * 0.85, L * 0.55, 8), front ? M : M, knee);
      foot = piv(knee, 0, -L * 0.55, 0); legs.push({ hip: hipP, knee, front: !!front, side });
    }
    const paw = mesh(new THREE.SphereGeometry(P.legR * (P.plantigrade ? 1.5 : 1.3), 8, 6), dark, foot, 0, 0, P.legR * 0.6); paw.scale.set(1, 0.55, 1.6);
  }
  // tail: two-segment bushy chain
  const tail = piv(torso, 0, P.hip * 0.55, -P.hip * 0.6);
  tail.rotation.x = variant === 'deer' || variant === 'rabbit' ? 2.3 : variant === 'bear' ? 1.3 : 0.75;
  const t1 = mesh(limbGeo(P.tailR, P.tailR * 1.15, P.tail * 0.55, 10), M, tail);
  const tail2 = piv(tail, 0, -P.tail * 0.55, 0); tail2.rotation.x = -0.35;
  const t2 = mesh(limbGeo(P.tailR * 1.15, P.tailR * 0.4, P.tail * 0.5, 10), P.ruff ? light : M, tail2);
  if (variant === 'rabbit' || variant === 'deer') { t1.material = light; t2.visible = false; }
  if (P.ember) { for (let i = 0; i < 6; i++) { const sp = mesh(new THREE.ConeGeometry(0.035, 0.2, 4), new THREE.MeshStandardMaterial({ color: '#ff6a10', emissive: '#ff4a00', emissiveIntensity: 2 }), torso, 0, P.ch * 0.95, P.len * (0.15 + i * 0.15)); sp.rotation.x = -0.5; } }
  body.position.z = -P.len / 2;
  bake(root);
  root.scale.setScalar(size);
  return { root, body, torso, neck, head: headRot, legs, tail, tail2, P, kind: 'quad', variant, height: (hipY + P.ch + P.neck * Math.sin(P.neckUp) + P.headR) * size, radius: Math.max(P.len * 0.55, P.ch) * size, anim: { ph: Math.random() * 10 } };
}
function animQuad(c, dt, st) {
  const A = c.anim, P = c.P;
  const sp = st.speed || 0;
  const gallop = sp > 4.5;
  A.ph += dt * (sp > 0.05 ? (2.6 + sp * 1.5) / Math.max(0.55, P.legL * 1.5) : 0);
  const amp = Math.min(1, sp / 2.2) * (gallop ? 0.75 : 0.5);
  for (const L of c.legs) {
    // trot: diagonal pairs; gallop: front pair and hind pair
    const off = gallop ? (L.front ? 0 : Math.PI * 0.9) + (L.side > 0 ? 0.4 : 0) : (L.front ? 0 : Math.PI) + (L.side > 0 ? Math.PI : 0);
    const ph = A.ph + (c.variant === 'rabbit' ? (L.front ? 0 : Math.PI) : off);
    const sw = Math.sin(ph) * amp, lift = Math.max(0, Math.cos(ph)) * amp;
    L.hip.rotation.x = (L.hip.userData.base || 0) + sw;
    L.knee.rotation.x = (L.knee.userData.base || 0) + (L.front ? -lift * 1.1 : lift * 0.9);
    if (L.hock) L.hock.rotation.x = L.hock.userData.base + lift * 0.4;
  }
  const bob = Math.abs(Math.sin(A.ph)) * 0.05 * amp * (gallop ? 2 : 1);
  c.torso.position.y = P.legL + P.hip * 0.35 + bob;
  c.torso.rotation.x = gallop ? Math.sin(A.ph) * 0.08 : 0;
  let headPitch = Math.sin(A.ph * 0.5) * 0.04 * amp;
  if (st.graze) headPitch = 0.75 + Math.sin(performance.now() * 0.002) * 0.08;
  if (st.howl) headPitch = -0.8;
  let lunge = 0;
  if (st.action === 'attack') { const t = st.actionT; lunge = t < 0.45 ? -t * 0.5 : Math.sin((t - 0.45) / 0.55 * Math.PI) * 0.6; headPitch = t < 0.45 ? -0.35 : 0.35; }
  c.neck.rotation.x += ((-P.neckUp + headPitch) - c.neck.rotation.x) * Math.min(1, dt * 8);
  c.body.position.z = -P.len / 2 + lunge * 0.45;
  c.tail.rotation.y = Math.sin(performance.now() * (sp > 0 ? 0.008 : 0.004)) * (sp > 0 ? 0.35 : 0.15);
  if (c.tail2) c.tail2.rotation.x = -0.35 + Math.sin(performance.now() * 0.006) * 0.08;
  const b = c.root.children[0];
  if (st.dead) { const d = Math.min(1, (st.deadT || 0) / 0.6); b.rotation.z = d * Math.PI / 2; b.position.y = d * P.ch * 0.7; for (const L of c.legs) { L.hip.rotation.x = 0.4 * L.side; L.knee.rotation.x = 0.2; } }
  else { b.rotation.z = 0; b.position.y = 0; }
}

// ---------- spider ----------
function buildSpider(col, size) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const M = mat(col, 0.6), dM = mat('#1a1410', 0.7), eye = new THREE.MeshBasicMaterial({ color: '#ff3020' });
  const torso = piv(body, 0, 0.45, 0);
  mesh(new THREE.SphereGeometry(0.22, 12, 10), M, torso, 0, 0, 0.15);
  const abd = mesh(new THREE.SphereGeometry(0.38, 14, 10), M, torso, 0, 0.12, -0.35); abd.scale.set(1, 0.85, 1.2);
  mesh(new THREE.SphereGeometry(0.12, 8, 6), mat('#8a2010', 0.5), torso, 0, 0.36, -0.42).scale.set(1.4, 0.4, 1.6);
  for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.03, 6, 4), eye, torso, (i % 3 - 1) * 0.06, 0.08 + Math.floor(i / 3) * 0.05, 0.35);
  for (const s of [-1, 1]) { const f = mesh(new THREE.ConeGeometry(0.03, 0.14, 5), dM, torso, s * 0.06, -0.08, 0.36); f.rotation.x = 2.6; }
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4;
    const hip = piv(torso, side * 0.15, 0, 0.25 - k * 0.12); hip.rotation.y = side * (0.4 + k * 0.4) * -1 + (side < 0 ? Math.PI : 0); hip.rotation.y = side < 0 ? Math.PI - (0.9 - k * 0.5) : (0.9 - k * 0.5);
    const up = piv(hip); up.rotation.z = 0.9;
    const s1 = mesh(limbGeo(0.03, 0.025, 0.42), dM, up); s1.rotation.z = -Math.PI / 2; s1.position.set(0, 0, 0);
    const knee = piv(up, 0.42, 0, 0); knee.rotation.z = -2.0;
    const s2 = mesh(limbGeo(0.025, 0.012, 0.55), dM, knee); s2.rotation.z = -Math.PI / 2;
    legs.push({ hip, up, knee, ph: (k % 2) * Math.PI + (side > 0 ? Math.PI : 0) });
  }
  bake(root);
  root.scale.setScalar(size);
  return { root, body, torso, legs, kind: 'spider', height: 0.9 * size, radius: 0.7 * size, anim: { ph: 0 } };
}
function animSpider(c, dt, st) {
  const sp = st.speed || 0; c.anim.ph += dt * sp * 4;
  for (const L of c.legs) { L.up.rotation.z = 0.9 + Math.max(0, Math.sin(c.anim.ph + L.ph)) * 0.35 * Math.min(1, sp); L.hip.rotation.x = Math.cos(c.anim.ph + L.ph) * 0.2 * Math.min(1, sp); }
  c.torso.position.y = 0.45 + Math.sin(c.anim.ph * 2) * 0.02;
  if (st.action === 'attack') c.torso.rotation.x = st.actionT < 0.5 ? -0.4 * st.actionT * 2 : 0.3 * Math.sin((st.actionT - 0.5) * Math.PI * 2); else c.torso.rotation.x = 0;
  if (st.dead) { c.body.rotation.z = Math.PI; c.body.position.y = 0.5; for (const L of c.legs) L.up.rotation.z = 2.0; } else { c.body.rotation.z = 0; c.body.position.y = 0; }
}
// ---------- crab ----------
function buildCrab(col, size) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const M = mat(col, 0.5);
  const torso = piv(body, 0, 0.22, 0);
  const sh = mesh(new THREE.SphereGeometry(0.3, 14, 8), M, torso); sh.scale.set(1.3, 0.45, 1);
  for (const s of [-1, 1]) {
    const st = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 5), M, torso, s * 0.08, 0.12, 0.2); mesh(new THREE.SphereGeometry(0.035, 6, 4), mat('#111'), st, 0, 0.08, 0);
    const arm = piv(torso, s * 0.3, 0, 0.18); arm.rotation.y = s * 0.6;
    const a = mesh(limbGeo(0.04, 0.035, 0.25), M, arm); a.rotation.x = -Math.PI / 2;
    const claw = mesh(new THREE.SphereGeometry(0.1, 10, 6), M, arm, 0, 0, 0.32); claw.scale.set(0.7, 0.5, 1.2);
    for (let i = 0; i < 3; i++) { const l = piv(torso, s * 0.3, 0, -0.05 - i * 0.1); l.rotation.z = s * 0.7; const lg = mesh(limbGeo(0.02, 0.012, 0.3), M, l); lg.rotation.z = -s * 0.2; }
  }
  bake(root);
  root.scale.setScalar(size);
  return { root, body, torso, kind: 'crab', height: 0.5 * size, radius: 0.45 * size, anim: { ph: 0 } };
}
function animCrab(c, dt, st) { c.anim.ph += dt * (st.speed || 0) * 8; c.torso.position.y = 0.22 + Math.abs(Math.sin(c.anim.ph)) * 0.03; c.torso.rotation.z = Math.sin(c.anim.ph) * 0.1; if (st.dead) c.body.rotation.z = Math.PI, c.body.position.y = 0.3; }

// ---------- humanoid monsters ----------
const HUMAN_VAR = {
  bandit: { kind: 'person', outfit: 'bandit', race: 'human', weapon: 'swordshield' },
  skeleton: { kind: 'skeleton', race: 'human', weapon: 'swordshield', tier: 0 },
  troll: { kind: 'troll', race: 'human', weapon: 'warhammer', tier: 0 },
  imp: { kind: 'imp', race: 'human' },
  golem: { kind: 'golem', race: 'human' },
  tyrant: { kind: 'tyrant', race: 'human', weapon: 'greataxe', tier: 5 },
};
function buildHumanMob(type, def, size) {
  const v = HUMAN_VAR[def.variant];
  const app = { race: v.race, kind: v.kind, outfit: v.outfit, sex: 'm', skin: def.variant === 'bandit' ? '#c68863' : undefined, hair: '#2a1a10', beard: def.variant === 'bandit' ? 2 : 0, build: 0.4 };
  const ch = buildHumanoid(app);
  if (v.weapon) { equipWeapon(ch, v.weapon, v.tier ?? 1); if (def.variant === 'skeleton') ch.weapons.off && (ch.weapons.off.visible = Math.random() < 0.5); }
  bake(ch.root);
  ch.root.scale.setScalar(size);
  ch.kind2 = 'human'; ch.radius = 0.4 * size * (v.kind === 'golem' || v.kind === 'troll' ? 1.4 : 1); ch.heightT = ch.height * size;
  return ch;
}

// ---------- Mob class ----------
let mobId = 1;
export class Mob {
  constructor(type, lv, x, z) {
    this.id = mobId++; this.type = type; this.def = MOBS[type]; this.lv = lv;
    this.maxHp = mobHp(lv, this.def); this.hp = this.maxHp; this.dmg = mobDmg(lv, this.def); this.xp = mobXp(lv, this.def);
    this.home = new THREE.Vector3(x, heightAt(x, z), z);
    this.pos = this.home.clone(); this.yaw = Math.random() * 6.28; this.vel = new THREE.Vector3();
    this.state = 'idle'; this.timer = rand(1, 5); this.target = null; this.atkCd = 0; this.action = null; this.actionT = 0; this.actionDur = 0.9;
    this.status = { frozen: 0, stun: 0, slow: 0, bleed: 0, bleedDps: 0, burn: 0, burnDps: 0, knock: new THREE.Vector3() };
    this.hostile = this.def.aggro > 0; this.provoked = false; this.dead = false; this.deadT = 0; this.respawnT = 0; this.looted = false; this.skinned = false; this.loot = null;
    this.hitFlash = 0; this.lastHitT = 0; this.growlT = rand(4, 12);
    const size = this.def.size * (1 + (lv - 1) * 0.012);
    const d = this.def;
    if (d.shape === 'quad') this.model = buildQuad(d.variant, d.col, size);
    else if (d.shape === 'spider') this.model = buildSpider(d.col, size);
    else if (d.shape === 'crab') this.model = buildCrab(d.col, size);
    else this.model = buildHumanMob(type, d, size);
    this.radius = this.model.radius || 0.5;
    this.height = this.model.heightT || this.model.height || 1.5;
    this.reach = this.radius + (d.boss ? 3.5 : d.elite ? 2.2 : 1.2) + (d.shape === 'human' ? 0.6 : 0.2);
    this.root = this.model.root;
    this.root.position.copy(this.pos);
    G.scene.add(this.root);
    this.mats = []; const seenM = new Map(); this.root.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material.emissive.getHex() === 0) { let c = seenM.get(o.material); if (!c) { c = o.material.clone(); seenM.set(o.material, c); this.mats.push(c); } o.material = c; } });
    if (d.variant === 'golem' || d.variant === 'tyrant' || d.variant === 'imp' || d.variant === 'hound') this.emberT = 0;
  }
  get name() { return this.def.name; }
  dist2(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z; return dx * dx + dz * dz; }
  takeHit(dmg, src, opts = {}) {
    if (this.dead) return 0;
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg; this.hitFlash = 0.15; this.lastHitT = G.time;
    if (!this.def.flee || this.def.dmgM > 0) { this.provoked = true; this.state = 'chase'; }
    if (this.def.flee) { this.state = 'flee'; this.timer = 4; }
    if (opts.knock) { this.status.knock.add(opts.knock.clone().multiplyScalar(this.def.boss ? 0.1 : this.def.elite ? 0.4 : 1)); }
    if (opts.stun) this.status.stun = Math.max(this.status.stun, this.def.boss ? opts.stun * 0.3 : opts.stun);
    if (opts.freeze) this.status.frozen = Math.max(this.status.frozen, this.def.boss ? opts.freeze * 0.3 : opts.freeze);
    if (opts.slow) this.status.slow = Math.max(this.status.slow, opts.slow);
    if (opts.bleed) { this.status.bleed = 4; this.status.bleedDps = opts.bleed; }
    if (opts.burn) { this.status.burn = 3; this.status.burnDps = opts.burn; }
    if (!opts.silent) {
      const kind = this.def.variant === 'skeleton' ? 'bone' : this.def.variant === 'golem' ? 'stone' : 'flesh';
      S.hit(kind, this.pos, opts.big ? 1.4 : 1);
      if (Math.random() < 0.6) S.yelp(this.type === 'wolfpup' ? 'wolfpup' : this.def.variant || 'human', this.pos);
      const hp = this.pos.clone(); hp.y += this.height * 0.6;
      V.burst(kind === 'bone' ? 'bone' : kind === 'stone' ? 'stone' : 'blood', hp, opts.big ? 16 : 9, { speed: 3.5, size: 0.12, life: 0.6, up: 0.8 });
      if (this.def.variant === 'golem' || this.def.variant === 'tyrant') V.burst('ember', hp, 8, { speed: 4 });
    }
    if (this.hp <= 0) this.die(src);
    return dmg;
  }
  die(src) {
    this.dead = true; this.deadT = 0; this.hp = 0; this.state = 'dead'; this.respawnT = this.def.boss ? 300 : this.def.elite ? 180 : 75;
    S.yelp(this.def.variant || 'human', this.pos);
    if (this.def.variant === 'skeleton') S.hit('bone', this.pos, 1.5);
    G.hooks.onKill && G.hooks.onKill(this, src);
  }
  respawn() {
    this.dead = false; this.hp = this.maxHp; this.pos.copy(this.home); this.state = 'idle'; this.provoked = false; this.looted = false; this.skinned = false; this.loot = null;
    this.root.visible = true; this.deadT = 0;
    for (const k in this.status) if (typeof this.status[k] === 'number') this.status[k] = 0;
  }
  update(dt, player) {
    const st = this.status;
    if (this.dead) {
      this.deadT += dt;
      this.animate(dt, { dead: true, deadT: this.deadT });
      this.respawnT -= dt;
      const empty = this.looted && (this.skinned || !this.def.skin);
      if (this.deadT > 90 || (empty && this.deadT > 4)) { this.root.visible = false; }
      if (this.respawnT <= 0 && player.pos.distanceTo(this.home) > 40) this.respawn();
      return;
    }
    // dots
    if (st.bleed > 0) { st.bleed -= dt; this.dotAcc = (this.dotAcc || 0) + st.bleedDps * dt; }
    if (st.burn > 0) { st.burn -= dt; this.dotAcc = (this.dotAcc || 0) + st.burnDps * dt; if (Math.random() < dt * 12) V.burst('fire', this.pos.clone().setY(this.pos.y + this.height * 0.5), 1, { speed: 1, vy: 2 }); }
    if (this.dotAcc >= 1) { const d = Math.floor(this.dotAcc); this.dotAcc -= d; this.takeHit(d, player, { silent: true }); V.number(this.pos.clone().setY(this.pos.y + this.height), d, 'dot'); if (this.dead) return; }
    for (const k of ['frozen', 'stun', 'slow']) if (st[k] > 0) st[k] -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    for (const m of this.mats) m.emissive && m.emissive.setScalar(this.hitFlash > 0 ? 0.6 : 0);
    if (this.frozenMesh) this.frozenMesh.visible = st.frozen > 0;
    if (st.frozen > 0 && !this.frozenMesh) { this.frozenMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.45, roughness: 0.1, emissive: '#3080a0', emissiveIntensity: 0.4 })); this.frozenMesh.scale.set(this.radius * 1.4 / this.root.scale.x, this.height * 0.6 / this.root.scale.x, this.radius * 1.4 / this.root.scale.x); this.frozenMesh.position.y = this.height * 0.45 / this.root.scale.x; this.root.add(this.frozenMesh); }
    const disabled = st.frozen > 0 || st.stun > 0;
    const d2p = this.dist2(player.pos), dp = Math.sqrt(d2p);
    let speed = 0, want = null;
    const spd = this.def.speed * (st.slow > 0 ? 0.5 : 1);
    if (!disabled) {
      this.atkCd -= dt;
      // aggro
      if (!player.dead && this.state !== 'chase' && this.state !== 'flee' && this.state !== 'return' && this.hostile && dp < this.def.aggro * (player.stealth > 0 ? 0.25 : 1) && player.level - this.lv < 8) { this.state = 'chase'; S.growl(this.def.variant || this.def.shape, this.pos); }
      if (player.dead && this.state === 'chase') this.state = 'return';
      const leash = this.home.distanceTo(this.pos);
      if (this.state === 'chase' && (leash > (this.def.boss ? 60 : 45) || player.stealth > 0 && dp > 6)) { this.state = 'return'; this.provoked = false; }
      if (this.action) {
        this.actionT += dt / this.actionDur;
        if (this.action === 'attack' && !this.didHit && this.actionT >= 0.55) { this.didHit = true; this.strike(player, dp); }
        if (this.actionT >= 1) { this.action = null; }
      } else if (this.state === 'chase') {
        const ranged = this.def.ranged;
        if (ranged && dp < 22 && dp > 6) { if (this.atkCd <= 0) this.startAttack(1.0); }
        else if (dp <= this.reach + player.radius) { if (this.atkCd <= 0) this.startAttack(this.def.boss ? 1.3 : 0.9); }
        else { want = player.pos; speed = spd * (ranged && dp < 8 ? -0.6 : 1); }
        this.faceTo(player.pos, dt, 8);
        // boss special
        if (this.def.boss) this.bossTick(dt, player, dp);
      } else if (this.state === 'flee') {
        this.timer -= dt; const away = this.pos.clone().sub(player.pos).setY(0).normalize().multiplyScalar(10).add(this.pos);
        want = away; speed = spd; if (this.timer <= 0) this.state = 'idle';
      } else if (this.state === 'return') {
        want = this.home; speed = spd * 1.3; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.3);
        if (leash < 3) { this.state = 'idle'; this.hp = this.maxHp; }
      } else {
        this.timer -= dt;
        if (this.state === 'wander') { want = this.wanderTo; speed = spd * 0.35; if (!want || this.pos.distanceTo(want) < 1.2) { this.state = 'idle'; this.timer = rand(2, 7); } }
        else if (this.timer <= 0) { const a = Math.random() * 6.28, r = Math.random() * 14; this.wanderTo = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r); if (!isWater(this.wanderTo.x, this.wanderTo.z)) this.state = 'wander'; else this.timer = 2; }
      }
      if (want && speed !== 0) {
        const dx = want.x - this.pos.x, dz = want.z - this.pos.z, l = Math.hypot(dx, dz);
        if (l > 0.2) {
          if (this.state !== 'chase') this.faceTo(want, dt, 5);
          const mv = speed * dt;
          const nx = this.pos.x + dx / l * mv, nz = this.pos.z + dz / l * mv;
          if (!isWater(nx, nz) || this.type === 'crab') { this.pos.x = nx; this.pos.z = nz; }
        }
      }
      this.growlT -= dt; if (this.growlT <= 0) { this.growlT = rand(6, 16); if (dp < 30 && (this.state === 'chase' || Math.random() < 0.3)) S.growl(this.def.variant || this.def.shape, this.pos, this.state === 'chase' ? 1 : 0.5); }
    }
    // knockback
    if (st.knock.lengthSq() > 0.01) { this.pos.addScaledVector(st.knock, dt); st.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); }
    collide(this.pos, this.radius * 0.8);
    // separation from player
    if (dp < this.radius + player.radius && dp > 0.01) { const k = (this.radius + player.radius - dp) / dp; this.pos.x -= (player.pos.x - this.pos.x) * k * 0.5; this.pos.z -= (player.pos.z - this.pos.z) * k * 0.5; }
    this.pos.y = Math.max(heightAt(this.pos.x, this.pos.z), this.type === 'crab' ? -2 : -0.8);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    if (this.model.details) setDetail(this.model, dp < 30);
    if (this.model.kind === 'quad' || this.model.kind2 === 'human' || this.model.kind === 'spider') { const n = normalAt(this.pos.x, this.pos.z); if (this.model.kind !== 'human') this.root.rotation.x = 0; }
    this.animate(dt, { speed: disabled ? 0 : Math.abs(speed), action: this.action, actionT: this.actionT, graze: this.state === 'idle' && this.model.kind === 'quad' && (this.type === 'deer' || this.type === 'rabbit') });
    if (this.emberT != null) { this.emberT += dt; if (this.emberT > 0.08 && dp < 50) { this.emberT = 0; V.emit('ember', this.pos.clone().setY(this.pos.y + this.height * (0.3 + Math.random() * 0.6)), { speed: 0.5, vy: 1.5, life: 1.2, size: 0.12 }); } }
  }
  bossTick(dt, player, dp) {
    this.special = (this.special ?? 6) - dt;
    if (this.special <= 0 && !this.action) {
      this.special = rand(7, 11);
      // meteor rain around the player
      S.roar(this.pos); V.addShake(0.4);
      for (let i = 0; i < 6; i++) {
        const p = player.pos.clone().add(new THREE.Vector3(rand(-7, 7), 0, rand(-7, 7))); if (i === 0) p.copy(player.pos);
        p.y = heightAt(p.x, p.z);
        G.hooks.telegraph && G.hooks.telegraph(p, 3.2, 1.4 + i * 0.25, () => { G.hooks.enemyBlast && G.hooks.enemyBlast(p, 3.2, this.dmg * 0.9, this); });
      }
    }
  }
  faceTo(p, dt, k) { const a = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); this.yaw += angDiff(this.yaw, a) * Math.min(1, dt * k); }
  startAttack(cd) { this.action = 'attack'; this.actionT = 0; this.didHit = false; this.atkCd = cd + rand(0.6, 1.3); this.actionDur = this.def.boss ? 1.3 : this.def.ranged ? 0.8 : 0.85; }
  strike(player, dp) {
    if (this.def.ranged) { G.hooks.enemyProjectile && G.hooks.enemyProjectile(this, player); return; }
    const toP = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    if (dp <= this.reach + player.radius + 0.4 && Math.abs(angDiff(this.yaw, toP)) < 1.2) {
      player.takeDamage(this.dmg * rand(0.85, 1.15), this);
    } else S.swing(this.def.boss ? 2 : 1, this.pos);
    if (this.def.boss || this.def.variant === 'troll' || this.def.variant === 'golem') { V.addShake(0.15); const p = this.pos.clone(); p.x += Math.sin(this.yaw) * this.reach; p.z += Math.cos(this.yaw) * this.reach; V.burst('dust', p, 12, { speed: 3 }); S.hit('stone', p); }
  }
  animate(dt, st) {
    const m = this.model;
    if (m.kind === 'quad') animQuad(m, dt, st);
    else if (m.kind === 'spider') animSpider(m, dt, st);
    else if (m.kind === 'crab') animCrab(m, dt, st);
    else animateHumanoid(m, dt, { speed: st.speed, action: st.action === 'attack' ? (this.def.variant === 'imp' ? 'cast' : this.def.variant === 'golem' || this.def.boss || this.def.variant === 'troll' ? 'slam' : 'swing1') : null, actionT: st.actionT, dead: st.dead, deadT: st.deadT, armed: true });
  }
  remove() { G.scene.remove(this.root); }
}

// ---------- NPCs ----------
export class NPC {
  constructor(id) {
    const d = NPCS[id]; this.id = id; this.def = d;
    const app = { race: d.race, sex: d.sex, outfit: d.outfit, skin: ['#f1c7a5', '#e0ac85', '#c68863'][id.length % 3], hair: ['#5a3a1e', '#9a9a9a', '#2b1d12', '#d9b26a', '#a0662c'][id.charCodeAt(0) % 5], hairStyle: d.sex === 'f' ? (id.length % 2 ? 1 : 2) : (id === 'maren' ? 1 : 0), beard: d.sex === 'm' ? (id === 'pell' || id === 'torvin' || id === 'dorn' ? 3 : id.length % 3) : 0, build: id === 'torvin' ? 0.8 : 0 };
    if (id === 'maren') app.hair = '#d8d8d8';
    if (id === 'pell') { app.hair = '#c8c8c8'; app.beardCol = '#d8d8d8'; }
    this.ch = buildHumanoid(app);
    if (id === 'torvin' || id === 'hilda') { this.ch.arms.R.grip.add(makeWeapon('warhammer', 2)); this.ch.arms.R.grip.children.at(-1).scale.setScalar(0.45); }
    if (id === 'bram') { const h = makeWeapon('greataxe', 1); h.scale.setScalar(0.7); this.ch.arms.R.grip.add(h); }
    if (id === 'kael' || id === 'lyra') equipWeapon(this.ch, 'bow', 2);
    if (id === 'sael') equipWeapon(this.ch, 'arcanestaff', 3);
    if (id === 'maren') { const s = makeWeapon('staff', 0, 0, 'none'); s.position.y = -0.6; this.ch.arms.R.grip.add(s); }
    bake(this.ch.root);
    this.pos = new THREE.Vector3(d.x, heightAt(d.x, d.z), d.z);
    this.yaw = 0; this.baseYaw = Math.atan2(-d.x + (d.x > 100 || d.x < -100 ? d.x : 0), 0);
    this.root = this.ch.root; this.root.position.copy(this.pos); G.scene.add(this.root);
    this.radius = 0.4; this.height = this.ch.height; this.waved = false; this.waveT = 0;
    this.col = { x: d.x, z: d.z };
  }
  get name() { return this.def.name; }
  update(dt, player) {
    const d = this.pos.distanceTo(player.pos);
    setDetail(this.ch, d < 30); this.root.visible = d < 120;
    let target = this.yaw;
    if (d < 9) { target = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z); if (!this.waved) { this.waved = true; this.waveT = 1.6; } }
    else if (d > 25) this.waved = false;
    this.yaw += angDiff(this.yaw, target) * Math.min(1, dt * 3);
    this.root.rotation.y = this.yaw;
    this.waveT -= dt;
    if (d < 70) animateHumanoid(this.ch, dt, { speed: 0, wave: this.waveT > 0, armed: !!this.ch.wt });
    // keep player out
    if (d < this.radius + player.radius) { const k = (this.radius + player.radius - d) / Math.max(0.01, d); player.pos.x += (player.pos.x - this.pos.x) * k; player.pos.z += (player.pos.z - this.pos.z) * k; }
  }
}
// ambient villagers that wander the village
export class Villager {
  constructor(x, z, app) {
    this.ch = buildHumanoid(app); bake(this.ch.root); this.root = this.ch.root; this.home = new THREE.Vector3(x, 0, z); this.pos = new THREE.Vector3(x, heightAt(x, z), z);
    this.yaw = Math.random() * 6; this.to = null; this.t = rand(0, 4); G.scene.add(this.root);
  }
  update(dt, player) {
    this.t -= dt; let sp = 0;
    if (this.to) { const dx = this.to.x - this.pos.x, dz = this.to.z - this.pos.z, l = Math.hypot(dx, dz); if (l < 0.5) { this.to = null; this.t = rand(3, 9); } else { sp = 1.3; this.pos.x += dx / l * sp * dt; this.pos.z += dz / l * sp * dt; this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 5); } }
    else if (this.t <= 0) { const a = Math.random() * 6.28, r = Math.random() * 16; this.to = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r); }
    collide(this.pos, 0.35);
    const dpl = this.pos.distanceTo(player.pos); setDetail(this.ch, dpl < 30); this.root.visible = dpl < 120;
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    if (this.pos.distanceTo(player.pos) < 70) animateHumanoid(this.ch, dt, { speed: sp });
  }
}
