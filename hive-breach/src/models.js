// Low-poly models built from simple shapes. Materials and shapes are shared so hundreds of aliens stay cheap.
import * as THREE from 'three';
import * as AS from './assets.js';
export { AS };

const mats = {}, geos = {};
export function mat(color, o) {
  o = o || {};
  const k = color + JSON.stringify(o); if (mats[k]) return mats[k];
  return mats[k] = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.7, metalness: o.m ?? 0.1, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.op, opacity: o.op ?? 1, flatShading: o.flat ?? true, depthWrite: o.op ? false : true, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
}
const box = (w, h, d) => geos['b' + w + h + d] || (geos['b' + w + h + d] = new THREE.BoxGeometry(w, h, d));
const sph = (r, s = 8) => geos['s' + r + s] || (geos['s' + r + s] = new THREE.SphereGeometry(r, s, Math.max(4, s * 0.6 | 0)));
const cyl = (a, b, h, s = 8) => geos['c' + a + b + h + s] || (geos['c' + a + b + h + s] = new THREE.CylinderGeometry(a, b, h, s));
const cone = (r, h, s = 6) => geos['k' + r + h + s] || (geos['k' + r + h + s] = new THREE.ConeGeometry(r, h, s));
function add(g, geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; }
export const B = (g, w, h, d, c, x, y, z, o) => add(g, box(w, h, d), typeof c === 'number' ? mat(c, o) : c, x, y, z);
export const S = (g, r, c, x, y, z, sx = 1, sy = 1, sz = 1, o) => add(g, sph(r), typeof c === 'number' ? mat(c, o) : c, x, y, z, sx, sy, sz);
export const C = (g, a, b, h, c, x, y, z, o, seg) => add(g, cyl(a, b, h, seg), typeof c === 'number' ? mat(c, o) : c, x, y, z);
export const K = (g, r, h, c, x, y, z, o) => add(g, cone(r, h), typeof c === 'number' ? mat(c, o) : c, x, y, z);

// ---------------------------------------------------------------- marines
export function gunModel(cls, color) {
  const mg = AS.weapon(cls); if (mg) return mg;   // the Meshy model when it has loaded
  if (cls === 'welder') cls = 'torch';
  const g = new THREE.Group(), dark = 0x2a2e34, metal = 0x5a626c;
  if (cls === 'gunner') {
    B(g, 0.22, 0.22, 0.4, color, 0, -0.02, 0.1); B(g, 0.08, 0.2, 0.1, dark, 0, -0.2, 0.15); B(g, 0.3, 0.1, 0.12, dark, 0, 0.17, 0.05);
    const bar = new THREE.Group(); bar.position.set(0, 0, -0.15); g.add(bar); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; C(bar, 0.025, 0.025, 0.75, metal, Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.35).rotation.x = Math.PI / 2; }
    C(bar, 0.11, 0.11, 0.05, dark, 0, 0, -0.1).rotation.x = Math.PI / 2; C(bar, 0.11, 0.11, 0.05, dark, 0, 0, -0.68).rotation.x = Math.PI / 2; g.userData.spin = bar;
    g.userData.mag = B(g, 0.18, 0.22, 0.25, 0x3a3a2a, 0.17, -0.08, 0.15); for (let i = 0; i < 5; i++) B(g, 0.03, 0.05, 0.03, 0xc8a040, 0.13 + i * 0.015, -0.2 - i * 0.03, 0.2);
  } else if (cls === 'sniper') {
    B(g, 0.08, 0.13, 0.5, dark, 0, 0, 0.05); B(g, 0.09, 0.16, 0.3, color, 0, -0.04, 0.32); C(g, 0.03, 0.035, 1.0, metal, 0, 0.02, -0.65).rotation.x = Math.PI / 2;
    C(g, 0.05, 0.05, 0.36, 0x1a1a1a, 0, 0.13, -0.05).rotation.x = Math.PI / 2; C(g, 0.06, 0.06, 0.03, 0x60c0ff, 0, 0.13, -0.23, { e: 0x3080c0 }).rotation.x = Math.PI / 2; g.userData.mag = B(g, 0.05, 0.18, 0.07, dark, 0, -0.15, 0.08);
    for (const z of [-0.4, -0.55, -0.7]) B(g, 0.07, 0.07, 0.04, 0x40d0ff, 0, 0.02, z, { e: 0x2090c0 });
  } else if (cls === 'heavy') { C(g, 0.11, 0.11, 0.9, dark, 0, 0, -0.25).rotation.x = Math.PI / 2; B(g, 0.16, 0.2, 0.3, color, 0, -0.04, 0.05); B(g, 0.06, 0.16, 0.08, dark, 0, -0.17, 0.08); C(g, 0.13, 0.13, 0.06, metal, 0, 0, -0.7).rotation.x = Math.PI / 2; g.userData.rocket = S(g, 0.09, 0xd0d0d0, 0, 0, -0.62, 1, 1, 2); B(g, 0.05, 0.08, 0.14, 0x40ff80, 0.1, 0.08, -0.1, { e: 0x20a040 }); }
  else if (cls === 'engineer') { // pump shotgun
    B(g, 0.11, 0.12, 0.42, dark, 0, 0, 0.05); C(g, 0.045, 0.045, 0.8, metal, 0, 0.04, -0.45).rotation.x = Math.PI / 2; C(g, 0.035, 0.035, 0.62, dark, 0, -0.05, -0.38).rotation.x = Math.PI / 2;
    g.userData.pump = B(g, 0.1, 0.09, 0.2, color, 0, -0.06, -0.28); B(g, 0.07, 0.17, 0.08, dark, 0, -0.15, 0.12); B(g, 0.09, 0.14, 0.32, 0x5a3a20, 0, -0.05, 0.36); B(g, 0.02, 0.03, 0.03, 0xff4040, 0, 0.09, -0.8, { e: 0xff2020 }); }
  else if (cls === 'pistol') { B(g, 0.08, 0.1, 0.32, dark, 0, 0.02, -0.12); B(g, 0.07, 0.18, 0.1, 0x3a3a3a, 0, -0.1, 0.02); B(g, 0.085, 0.05, 0.3, color, 0, 0.08, -0.12); g.userData.mag = B(g, 0.05, 0.12, 0.07, metal, 0, -0.17, 0.02); }
  else if (cls === 'torch') { // plasma torch
    C(g, 0.07, 0.09, 0.4, metal, 0, 0, -0.05).rotation.x = Math.PI / 2; C(g, 0.03, 0.05, 0.25, dark, 0, 0, -0.35).rotation.x = Math.PI / 2; B(g, 0.06, 0.16, 0.07, dark, 0, -0.12, 0.05); C(g, 0.09, 0.09, 0.22, 0xe0b22e, 0, 0.1, 0.05).rotation.x = Math.PI / 2;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 8), mat(0x60c0ff, { e: 0x4090ff, ei: 3, op: 0.8 })); fl.rotation.x = -Math.PI / 2; fl.position.z = -0.58; g.add(fl); }
  else if (cls === 'medigun') { // heal beam emitter
    B(g, 0.12, 0.14, 0.36, 0xe8e8f0, 0, 0, 0); C(g, 0.06, 0.08, 0.3, metal, 0, 0.02, -0.3).rotation.x = Math.PI / 2; S(g, 0.07, 0x40ff80, 0, 0.02, -0.48, 1, 1, 1, { e: 0x20ff60, ei: 2 }); B(g, 0.13, 0.04, 0.2, 0xd03030, 0, 0.09, 0); B(g, 0.04, 0.13, 0.04, 0xd03030, 0, 0.09, 0); B(g, 0.06, 0.16, 0.07, dark, 0, -0.14, 0.06); }
  else if (cls === 'medic') { // compact carbine
    B(g, 0.09, 0.13, 0.55, 0xd8d8e0, 0, 0, -0.12); B(g, 0.1, 0.05, 0.26, 0xd03030, 0, 0.09, -0.12); C(g, 0.025, 0.025, 0.2, metal, 0, 0.01, -0.5).rotation.x = Math.PI / 2; B(g, 0.06, 0.18, 0.07, dark, 0, -0.15, 0.02); g.userData.mag = B(g, 0.06, 0.2, 0.09, metal, 0, -0.15, -0.18); }
  else { B(g, 0.09, 0.14, 0.7, dark, 0, 0, -0.2); B(g, 0.1, 0.07, 0.36, color, 0, 0.1, -0.15); B(g, 0.06, 0.2, 0.08, dark, 0, -0.16, 0.02); g.userData.mag = B(g, 0.07, 0.22, 0.1, metal, 0, -0.16, -0.25); C(g, 0.025, 0.025, 0.2, metal, 0, 0, -0.62).rotation.x = Math.PI / 2; B(g, 0.03, 0.03, 0.05, 0xff4040, 0, 0.15, -0.3, { e: 0xff2020 }); }
  return g;
}
export function marine(color, cls) {
  const mg = AS.marineGLB(cls in AS.WEAP ? cls : 'assault'); if (mg) return mg;
  const g = new THREE.Group(), armor = 0x4a5560, dark = 0x23282e, visor = mat(0x80e0ff, { e: 0x3090c0, m: 0.6, r: 0.2 });
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.2, 0.9, 0); legR.position.set(0.2, 0.9, 0); g.add(legL, legR);
  for (const L of [legL, legR]) { B(L, 0.24, 0.5, 0.26, armor, 0, -0.25, 0); B(L, 0.22, 0.42, 0.24, dark, 0, -0.66, 0); B(L, 0.26, 0.12, 0.34, armor, 0, -0.86, -0.04); }
  B(g, 0.62, 0.3, 0.38, dark, 0, 1.02, 0);
  B(g, 0.7, 0.6, 0.44, color, 0, 1.45, 0); B(g, 0.5, 0.36, 0.1, armor, 0, 1.48, -0.24); B(g, 0.46, 0.5, 0.24, armor, 0, 1.45, 0.3);
  S(g, 0.26, armor, 0, 1.98, 0, 1, 1.05, 1.05); B(g, 0.36, 0.13, 0.12, visor, 0, 2.0, -0.2);
  S(g, 0.2, color, -0.44, 1.7, 0, 1.1, 0.8, 1.1); S(g, 0.2, color, 0.44, 1.7, 0, 1.1, 0.8, 1.1);
  const arms = new THREE.Group(); arms.position.set(0, 1.6, 0); g.add(arms);
  B(arms, 0.18, 0.5, 0.18, armor, -0.42, -0.2, -0.12).rotation.x = -0.9; B(arms, 0.18, 0.5, 0.18, armor, 0.42, -0.2, -0.12).rotation.x = -0.9;
  const gun = gunModel(cls, color); gun.position.set(0.15, -0.35, -0.5); gun.scale.setScalar(1.3); arms.add(gun);
  g.userData = { legL, legR, arms };
  return g;
}
// a combat synth: a chrome robot soldier with a skull-like head and red eyes, carrying a flamethrower or a pulse rifle
export function synth(weapon) {
  const g = new THREE.Group(), chrome = mat(0xb8c0c8, { m: 0.9, r: 0.25 }), dark = mat(0x2a2e34, { m: 0.6, r: 0.4 }), eye = mat(0xff2010, { e: 0xff1000, ei: 3 });
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.2, 1.0, 0); legR.position.set(0.2, 1.0, 0); g.add(legL, legR);
  for (const L of [legL, legR]) { C(L, 0.07, 0.07, 0.5, chrome, 0, -0.25, 0); S(L, 0.09, dark, 0, -0.52, 0); C(L, 0.06, 0.06, 0.45, chrome, 0, -0.76, 0); B(L, 0.18, 0.08, 0.34, dark, 0, -0.98, -0.05); }
  B(g, 0.42, 0.18, 0.24, dark, 0, 1.05, 0); for (let i = 0; i < 4; i++) B(g, 0.5 - i * 0.04, 0.05, 0.28, chrome, 0, 1.22 + i * 0.1, 0); B(g, 0.12, 0.45, 0.12, dark, 0, 1.35, 0.08); B(g, 0.62, 0.14, 0.3, chrome, 0, 1.66, 0);
  S(g, 0.19, chrome, 0, 1.98, 0, 0.95, 1.1, 1.05); B(g, 0.28, 0.06, 0.06, dark, 0, 1.97, -0.17); S(g, 0.035, eye, -0.07, 1.98, -0.19); S(g, 0.035, eye, 0.07, 1.98, -0.19); B(g, 0.18, 0.06, 0.1, dark, 0, 1.84, -0.14);
  for (const sd of [-1, 1]) S(g, 0.12, dark, sd * 0.36, 1.66, 0);
  const arms = new THREE.Group(); arms.position.set(0, 1.6, 0); g.add(arms);
  C(arms, 0.05, 0.05, 0.5, chrome, -0.36, -0.2, -0.12).rotation.x = -0.9; C(arms, 0.05, 0.05, 0.5, chrome, 0.36, -0.2, -0.12).rotation.x = -0.9;
  if (weapon === 'flame') { const f = new THREE.Group(); f.position.set(0.15, -0.35, -0.5); arms.add(f); B(f, 0.14, 0.16, 0.6, dark, 0, 0, 0); C(f, 0.05, 0.08, 0.35, chrome, 0, 0.02, -0.45).rotation.x = Math.PI / 2; S(f, 0.04, 0x40a0ff, 0, 0.02, -0.64, 1, 1, 1, { e: 0x2080ff, ei: 3 }); for (const sd of [-1, 1]) C(g, 0.11, 0.11, 0.55, 0xb04020, sd * 0.13, 1.42, 0.24); }
  else { const gun = gunModel('assault', 0x8a2020); gun.position.set(0.15, -0.35, -0.5); gun.scale.setScalar(1.3); arms.add(gun); }
  g.userData = { legL, legR, arms }; return g;
}
// the war mech: a big two-legged walker with a minigun on its left arm and a rocket pod on its right
export function warMech() {
  const g = new THREE.Group(), hull = mat(0x5a6670, { m: 0.6, r: 0.45 }), dark = mat(0x23282e, { m: 0.5, r: 0.5 }), stripe = mat(0xd09030), glow = mat(0x60e0ff, { e: 0x30a0ff, ei: 2.5 });
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.75, 2.3, 0); legR.position.set(0.75, 2.3, 0); g.add(legL, legR);
  for (const L of [legL, legR]) { B(L, 0.55, 1.2, 0.7, hull, 0, -0.55, 0.1); S(L, 0.3, dark, 0, -1.2, 0.15); const sh = B(L, 0.45, 1.1, 0.5, hull, 0, -1.7, -0.05); sh.rotation.x = 0.2; B(L, 0.8, 0.25, 1.2, dark, 0, -2.22, -0.1); }
  B(g, 1.9, 1.1, 1.6, hull, 0, 3.0, 0); B(g, 1.92, 0.2, 0.6, stripe, 0, 3.4, 0.3); B(g, 1.2, 0.5, 0.2, glow, 0, 3.1, -0.82); B(g, 1.4, 0.8, 1.0, dark, 0, 2.3, 0.2); B(g, 0.8, 0.9, 0.9, hull, 0, 3.4, 0.9);
  C(g, 0.04, 0.04, 1.2, 0x222222, 0.6, 4.1, 0.6); S(g, 0.07, 0xff3020, 0.6, 4.7, 0.6, 1, 1, 1, { e: 0xff2010, ei: 3 });
  const arms = new THREE.Group(); arms.position.set(0, 3.0, 0); g.add(arms);
  // left arm: a six-barrel minigun
  const lA = new THREE.Group(); lA.position.set(-1.3, 0, -0.2); arms.add(lA); B(lA, 0.55, 0.6, 1.1, hull, 0, 0, 0); const bar = new THREE.Group(); bar.position.set(0, -0.05, -0.75); lA.add(bar); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; C(bar, 0.06, 0.06, 1.4, dark, Math.cos(a) * 0.16, Math.sin(a) * 0.16, -0.6).rotation.x = Math.PI / 2; } C(bar, 0.24, 0.24, 0.12, hull, 0, 0, -1.25).rotation.x = Math.PI / 2; B(lA, 0.35, 0.4, 0.5, 0x4a5a3a, 0.4, 0, 0.2);
  // right arm: a 2x3 rocket pod
  const rA = new THREE.Group(); rA.position.set(1.35, 0.1, -0.1); arms.add(rA); B(rA, 0.75, 0.75, 1.2, hull, 0, 0, 0); for (let x = 0; x < 2; x++) for (let y = 0; y < 3; y++) { C(rA, 0.1, 0.1, 0.1, 0x111111, -0.17 + x * 0.34, -0.24 + y * 0.24, -0.62).rotation.x = Math.PI / 2; K(rA, 0.07, 0.16, 0xd04030, -0.17 + x * 0.34, -0.24 + y * 0.24, -0.66).rotation.x = -Math.PI / 2; }
  g.userData = { legL, legR, arms, spin: bar, mech: 1 }; return g;
}
export function kneel(m, k) { if (m.userData.glb) { if (k === 2) { AS.setPose(m, 'sit', 0); m.userData.mixer.update(0.01); m.userData.sit = 1; if (m.userData.gun) m.userData.gun.visible = false; } return; } m.rotation.x = 0; if (k === 2) { const u = m.userData; u.kn = 0; m.rotation.x = 0; m.children.forEach(c => { c.userData.y0 ??= c.position.y; }); m.rotation.order = 'YXZ'; m.rotation.x = -1.45; m.position.y += 0.35; return; }
   const u = m.userData; u.kn = (u.kn || 0) + ((k ? 1 : 0) - (u.kn || 0)) * 0.2; u.legL.rotation.x = u.kn ? -1.3 * u.kn : u.legL.rotation.x; u.legR.rotation.x = u.kn ? 0.2 * u.kn : u.legR.rotation.x; m.children.forEach(c => { if (c !== u.legL && c !== u.legR) c.position.y = (c.userData.y0 ??= c.position.y) - u.kn * 0.5; }); }
export function animMarine(m, t, sp, opt) { if (m.userData.glb) { if (!m.userData.sit) { if (m.userData.gun) m.userData.gun.visible = true; AS.animGLB(m, sp, opt); } else { const u = m.userData, now = performance.now(); u.mixer.update(Math.min(0.1, (now - (u.lt || now)) / 1000)); u.lt = now; } return; } const u = m.userData, a = Math.sin(t) * Math.min(1, sp / 4) * 0.8; u.legL.rotation.x = a; u.legR.rotation.x = -a; }

// ---------------------------------------------------------------- aliens
// ---------------------------------------------------------------- the Kharn: an armored alien war-species
// Original designs: chitin plates over dark hide, blade limbs, glowing eyes and veins. Every model faces -Z.
const CHITIN = { crawler: 0x4a3c30, spitter: 0x434a34, brute: 0x584638, flyer: 0x3a4652, ravager: 0x5a2a22, queen: 0x463042, guardian: 0x2e1a3e, hivecore: 0x3a2048, nest: 0x3a2048 };
const PLATE = { crawler: 0x7a6a52, spitter: 0x667048, brute: 0x8a7a62, flyer: 0x6a7c8a, ravager: 0x8a3a2a, queen: 0x7a5270 };
const GLOW = { guardian: 0xff3060, hivecore: 0xa040ff, nest: 0x80ff40, crawler: 0xff5020, spitter: 0xc0ff30, brute: 0xff8020, flyer: 0x40e0ff, ravager: 0xff3020, queen: 0xff40ff };
// a limb: an upper segment and a lower one hinged at the knee, with a claw; the group swings at the hip
function limb(parent, x, y, z, up, low, th, m, side, knee = 0.9) {
  const hip = new THREE.Group(); hip.position.set(x, y, z); parent.add(hip);
  const a = B(hip, th, up, th, m, 0, -up / 2, 0); a.rotation.z = side * 0.35; const kn = new THREE.Group(); kn.position.set(side * up * 0.34, -up * 0.94, 0); hip.add(kn);
  const b = B(kn, th * 0.8, low, th * 0.8, m, 0, -low / 2, 0); kn.rotation.x = knee * 0.5; b.rotation.z = -side * 0.25; K(kn, th * 0.5, th * 2.2, 0x111111, 0, -low - th * 0.6, -th * 0.4).rotation.x = Math.PI;
  hip.userData.knee = kn; return hip;
}
// a scything blade arm
function scythe(parent, x, y, z, len, m, side) {
  const sh = new THREE.Group(); sh.position.set(x, y, z); parent.add(sh); const up = B(sh, 0.14, len * 0.5, 0.14, m, 0, -len * 0.22, -len * 0.12); up.rotation.x = 0.5;
  const fore = new THREE.Group(); fore.position.set(0, -len * 0.42, -len * 0.3); sh.add(fore); const bl = K(fore, 0.07, len, 0xd8d0b8, 0, -len * 0.1, -len * 0.45, { m: 0.4, r: 0.3 }); bl.rotation.x = -1.9; bl.scale.set(1, 1, 0.35);
  sh.rotation.z = side * 0.15; return sh;
}
const _aBox = {};
export function alien(type, plain) {
  // the Meshy model for a Mars alien, sized from the simple one (measured once per type)
  if (!plain && AS.ALIEN_GLB[type] && AS.A[AS.ALIEN_GLB[type]]) { if (!_aBox[type]) _aBox[type] = new THREE.Box3().setFromObject(alien(type, true)); const mg = AS.alienGLB(type, _aBox[type]); if (mg) return mg; }
  // planet breeds: a base alien recoloured, resized and given its own growths (ice crystals, thorns, an acid sac)
  const VAR = { shard: ['crawler', 0x7fd0ff, 'ice', 1.05], cryospit: ['spitter', 0xa8ecff, 'ice', 1], glacier: ['brute', 0xc0eaff, 'ice', 1.18], frostwraith: ['flyer', 0x90c8ff, 'ice', 1], creeper: ['crawler', 0x2f5a22, 'thorn', 0.95], bloater: ['spitter', 0x7aa020, 'bloat', 1.1], thornback: ['brute', 0x2a4a1a, 'thorn', 1.08], moth: ['flyer', 0x8a50b0, 'moth', 0.8] };
  if (VAR[type]) {
    const [base, col, deco, sc] = VAR[type], out = new THREE.Group(), inner = alien(base, true); inner.scale.setScalar(sc); out.add(inner); out.userData = inner.userData; const tc = new THREE.Color(col);
    inner.traverse(o => { if (o.isMesh && o.material && o.material.color && !(o.material.emissive && o.material.emissiveIntensity > 1)) { o.material = o.material.clone(); o.material.color.lerp(tc, 0.55); } });
    const b = inner.userData.body || inner;
    if (deco === 'ice') { const cm = mat(0xbff4ff, { e: 0x4fb0e0, ei: 1.2, op: 0.85, m: 0.2, r: 0.1 }); for (let i = 0; i < 6; i++) { const c = K(b, 0.09 + Math.random() * 0.06, 0.5 + Math.random() * 0.4, cm, (Math.random() - 0.5) * 0.5, 1.2 + Math.random() * 0.3, -0.4 + i * 0.18); c.rotation.set(-0.3 + Math.random() * 0.6, 0, (Math.random() - 0.5) * 0.8); } }
    else if (deco === 'thorn') { for (let i = 0; i < 9; i++) { const c = K(b, 0.05, 0.35 + Math.random() * 0.25, 0x18240e, (Math.random() - 0.5) * 0.7, 1.1 + Math.random() * 0.4, -0.5 + i * 0.13); c.rotation.set(-0.5 + Math.random(), 0, (Math.random() - 0.5) * 1.2); } }
    else if (deco === 'bloat') { const sac = S(b, 0.55, mat(0xb8ff40, { e: 0x60c010, ei: 1.6, op: 0.8 }), 0, 1.7, 0.35, 1, 0.9, 1.1); (inner.userData.sacs || []).push(sac); }
    return out;
  }
  // the Brood Queen is a Hive Tyrant grown huge, dragging a glowing egg sac; Royal Guards are big crimson Juggernauts with crests
  if (type === 'broodqueen' || type === 'royal') {
    const out = new THREE.Group(), inner = alien(type === 'broodqueen' ? 'queen' : 'brute', true); inner.scale.setScalar(type === 'broodqueen' ? 2.4 : 1.2); out.add(inner); out.userData = inner.userData;
    if (type === 'broodqueen') { const sac = S(inner, 0.95, mat(0xffb040, { e: 0xc06010, ei: 1.2, op: 0.82 }), 0, 1.05, 2.1, 1, 0.85, 1.7); inner.userData.sacs.push(sac); for (let i = 0; i < 8; i++) S(inner, 0.12, mat(0xfff0a0, { e: 0xffa020, ei: 1.5, op: 0.9 }), (Math.random() - 0.5) * 1.2, 0.85 + Math.random() * 0.4, 1.6 + Math.random() * 1.3); for (let i = 0; i < 5; i++) K(inner, 0.08, 0.7, 0xd04030, (i - 2) * 0.22, 2.2, -0.2, { e: 0x601008 }).rotation.x = -0.4; }
    else { inner.traverse(o => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color(0x8a1a1a), 0.45); } }); for (let i = 0; i < 5; i++) K(inner, 0.08, 0.5, 0xffc040, (i - 2) * 0.16, 2.0, -0.4, { e: 0x804000 }).rotation.x = -0.3; }
    return out;
  }
  const g = new THREE.Group(), body = new THREE.Group(), legs = [], arms = [], wings = [], sacs = [], hide = mat(CHITIN[type] || 0x2a2420, { r: 0.55, m: 0.15, flat: false }), plate = mat(PLATE[type] || 0x5a4a3a, { r: 0.4, m: 0.25 }),
    gl = mat(GLOW[type], { e: GLOW[type], ei: 2 }), dk = 0x141012; let tail = null, head = null;
  g.add(body);
  const eyes = (h, x, y, z, n = 3) => { for (let i = 0; i < n; i++) for (const sd of [-1, 1]) S(h, 0.045, gl, sd * (x + i * 0.04), y + i * 0.05, z + i * 0.06); };
  const spines = (p, n, x0, y0, z0, dz, sz) => { for (let i = 0; i < n; i++) K(p, 0.07 * sz, 0.45 * sz * (1 - Math.abs(i - n / 2) / n), plate, x0, y0, z0 + i * dz).rotation.x = 0.4; };
  if (type === 'crawler') { // STALKER: lean four-legged hunter with scythe forelimbs
    S(body, 0.36, hide, 0, 0.9, 0.1, 0.85, 0.75, 1.9); for (let i = 0; i < 5; i++) { const pl = B(body, 0.5 - i * 0.05, 0.08, 0.34, plate, 0, 1.18 - i * 0.02, -0.45 + i * 0.3); pl.rotation.x = 0.12; }
    spines(body, 6, 0, 1.25, -0.5, 0.26, 1);
    head = new THREE.Group(); head.position.set(0, 1.0, -0.85); body.add(head); const sk = K(head, 0.24, 0.75, hide, 0, 0, -0.25); sk.rotation.x = -Math.PI / 2; B(head, 0.36, 0.08, 0.5, plate, 0, 0.13, -0.15); eyes(head, 0.1, 0.05, -0.32);
    for (const sd of [-1, 1]) { const md = K(head, 0.05, 0.4, 0xd8d0b8, sd * 0.13, -0.12, -0.5); md.rotation.set(-1.4, 0, sd * 0.4); }
    for (const sd of [-1, 1]) arms.push(scythe(body, sd * 0.32, 1.05, -0.55, 1.2, hide, sd));
    for (const [z, sd] of [[-0.25, -1], [-0.25, 1], [0.55, -1], [0.55, 1]]) legs.push(limb(body, sd * 0.3, 0.85, z, 0.55, 0.6, 0.12, hide, sd, z > 0 ? -0.9 : 0.9));
    tail = new THREE.Group(); tail.position.set(0, 0.95, 0.75); body.add(tail); for (let i = 0; i < 4; i++) S(tail, 0.15 - i * 0.025, i % 2 ? plate : hide, 0, 0.05 * i, 0.22 * i, 1, 1, 1.4); K(tail, 0.06, 0.4, 0xd8d0b8, 0, 0.25, 1.05).rotation.x = 1.2;
  } else if (type === 'spitter') { // SPEWER: hunched biped carrying glowing acid sacs
    S(body, 0.42, hide, 0, 1.45, 0.1, 0.9, 1.1, 0.9); B(body, 0.62, 0.5, 0.12, plate, 0, 1.5, -0.32).rotation.x = -0.3;
    for (const [x, y, z, r] of [[0, 1.75, 0.35, 0.38], [-0.3, 1.5, 0.4, 0.26], [0.3, 1.5, 0.4, 0.26]]) { const sc = S(body, r, mat(0xb0ff30, { e: 0x80c010, ei: 1.4, op: 0.85 }), x, y, z); sacs.push(sc); }
    const neck = B(body, 0.16, 0.6, 0.16, hide, 0, 1.95, -0.3); neck.rotation.x = -0.7; head = new THREE.Group(); head.position.set(0, 2.15, -0.62); body.add(head);
    S(head, 0.2, hide, 0, 0, 0, 1, 0.8, 1.3); B(head, 0.3, 0.06, 0.32, plate, 0, 0.12, -0.05); eyes(head, 0.08, 0.06, -0.2, 2); const jaw = B(head, 0.22, 0.06, 0.28, hide, 0, -0.14, -0.12); jaw.rotation.x = 0.35; S(head, 0.08, gl, 0, -0.06, -0.26);
    for (const sd of [-1, 1]) { legs.push(limb(body, sd * 0.25, 1.1, 0.1, 0.62, 0.66, 0.15, hide, sd, -1.1)); arms.push(scythe(body, sd * 0.35, 1.55, -0.25, 0.6, hide, sd)); }
  } else if (type === 'brute' || type === 'ravager') { // JUGGERNAUT / BEHEMOTH: armored siege beast
    S(body, 0.95, hide, 0, 1.35, 0.15, 1.15, 0.85, 1.45); for (let i = 0; i < 5; i++) { const pl = B(body, 1.7 - Math.abs(i - 2) * 0.12, 0.16, 0.6, plate, 0, 2.05 - Math.abs(i - 2) * 0.05, -0.8 + i * 0.42); pl.rotation.x = 0.1 + (i - 2) * 0.12; }
    head = new THREE.Group(); head.position.set(0, 1.25, -1.25); body.add(head); S(head, 0.48, hide, 0, 0, 0, 1, 0.8, 1.1);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8, 0, 6.29, 0, 1.2), plate); shield.rotation.x = -1.2; shield.position.set(0, 0.25, -0.15); shield.scale.set(1.2, 1, 0.7); head.add(shield); shield.castShadow = true;
    eyes(head, 0.15, -0.02, -0.42, 2); for (const sd of [-1, 1]) { const tk = K(head, 0.1, 0.7, 0xe8e0c8, sd * 0.28, -0.25, -0.5); tk.rotation.set(-1.9, 0, sd * 0.3); }
    for (const sd of [-1, 1]) { for (let i = 0; i < 3; i++) S(body, 0.08, gl, sd * 0.98, 1.3, -0.3 + i * 0.35, 0.6, 1.4, 0.6); }
    for (const [z, sd] of [[-0.6, -1], [-0.6, 1], [0.75, -1], [0.75, 1]]) legs.push(limb(body, sd * 0.75, 1.2, z, 0.6, 0.65, 0.32, hide, sd, z > 0 ? -0.6 : 0.6));
    if (type === 'ravager') { for (let i = 0; i < 7; i++) K(body, 0.12, 0.7, 0xd04030, (i - 3) * 0.24, 2.25, -0.6 + Math.abs(i - 3) * 0.1, { e: 0x601008 }).rotation.x = -0.2; for (let i = 0; i < 8; i++) { const v = B(body, 0.04, 0.04, 1.2, gl, (i % 2 ? 1 : -1) * (0.7 + (i % 3) * 0.1), 1.0 + (i % 4) * 0.15, 0.1); v.rotation.y = (i % 2 ? 1 : -1) * 0.2; } g.scale.setScalar(1.7); }
  } else if (type === 'flyer') { // WRAITH: armored aerial predator on four rigid blade wings
    S(body, 0.26, hide, 0, 0, 0, 0.9, 0.8, 2); B(body, 0.34, 0.06, 0.8, plate, 0, 0.2, -0.05);
    head = new THREE.Group(); head.position.set(0, 0.05, -0.65); body.add(head); const sk = K(head, 0.15, 0.55, hide, 0, 0, -0.2); sk.rotation.x = -Math.PI / 2; eyes(head, 0.06, 0.06, -0.18, 2); const jw = K(head, 0.07, 0.4, 0xd8d0b8, 0, -0.1, -0.3); jw.rotation.x = -1.7;
    const wm = mat(PLATE.flyer, { ds: true, m: 0.4, r: 0.3 }), edge = mat(GLOW.flyer, { e: GLOW.flyer, ei: 1.5 });
    for (const [z, sd] of [[-0.1, -1], [-0.1, 1], [0.25, -1], [0.25, 1]]) { const p = new THREE.Group(); p.position.set(sd * 0.2, 0.15, z); body.add(p); const w = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.7, 3), wm); w.rotation.z = sd * Math.PI / 2; w.position.x = sd * 0.85; w.scale.set(1, 1, 0.15); p.add(w); const e = B(p, 1.5, 0.02, 0.03, edge, sd * 0.8, 0, -0.06); void e; wings.push(p); }
    tail = new THREE.Group(); tail.position.set(0, 0, 0.5); body.add(tail); for (let i = 0; i < 5; i++) S(tail, 0.1 - i * 0.014, i % 2 ? plate : hide, 0, -0.03 * i, 0.2 * i, 1, 1, 1.5); K(tail, 0.05, 0.35, 0xd8d0b8, 0, -0.18, 1.05).rotation.x = 1.9;
    for (const sd of [-1, 1]) legs.push(limb(body, sd * 0.12, -0.15, 0.1, 0.3, 0.3, 0.06, hide, sd, 1.4));
  } else if (type === 'guardian') {
    C(body, 1.4, 1.9, 1.2, 0x2e1a3e, 0, 0.6, 0); C(body, 0.7, 1.1, 3.4, 0x3a2048, 0, 2.2, 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; K(body, 0.25, 1.8, 0x1a0e24, Math.cos(a) * 0.9, 3.2, Math.sin(a) * 0.9).rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
    S(body, 0.6, 0xff3060, 0, 3.7, 0, 1, 1, 1, { e: 0xff1040, ei: 2 });
  } else if (type === 'hivecore') {
    // the hive mesh is part of the map; this only carries the health bar
  } else if (type === 'nest') {
    S(body, 2, 0x3a2048, 0, 0.6, 0, 1.2, 0.6, 1.2); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; K(body, 0.4, 2.4, 0x281430, Math.cos(a) * 1.8, 1.2, Math.sin(a) * 1.8).rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    for (let i = 0; i < 5; i++) S(body, 0.45, gl, Math.cos(i * 1.3) * 0.9, 1.3 + (i % 2) * 0.3, Math.sin(i * 1.3) * 0.9, 1, 1.2, 1);
  } else if (type === 'queen') { // HIVE TYRANT: armored abdomen on six legs, an upright torso with four scythe arms
    S(body, 1.7, hide, 0, 2.2, 1.8, 1.1, 0.85, 1.7); for (let i = 0; i < 5; i++) { const pl = B(body, 2.6 - i * 0.2, 0.2, 0.8, plate, 0, 3.6 - i * 0.12, 0.6 + i * 0.75); pl.rotation.x = 0.15 + i * 0.08; }
    const torso = new THREE.Group(); torso.position.set(0, 3.2, -0.6); body.add(torso); S(torso, 0.9, hide, 0, 1.1, 0, 1, 1.4, 0.9); B(torso, 1.5, 1.4, 0.3, plate, 0, 1.3, -0.65).rotation.x = -0.15; S(torso, 0.35, gl, 0, 1.0, -0.8, 1, 1.3, 0.5);
    head = new THREE.Group(); head.position.set(0, 2.6, -0.4); torso.add(head); S(head, 0.6, hide, 0, 0, 0, 1, 0.9, 1.2); eyes(head, 0.18, 0.08, -0.55, 4);
    for (let i = 0; i < 7; i++) { const h = K(head, 0.12, 1.6 - Math.abs(i - 3) * 0.2, plate, (i - 3) * 0.24, 0.6, 0.2); h.rotation.set(-0.7 - Math.abs(i - 3) * 0.06, 0, (i - 3) * -0.15); }
    for (const sd of [-1, 1]) { const mj = K(head, 0.1, 0.7, 0xd8d0b8, sd * 0.3, -0.35, -0.6); mj.rotation.set(-1.5, 0, sd * 0.35); }
    for (const [y, sd] of [[1.9, -1], [1.9, 1], [1.2, -1], [1.2, 1]]) arms.push(scythe(torso, sd * 0.95, y, -0.2, 2.6, hide, sd));
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) legs.push(limb(body, sd * 1.3, 2.2, 0.4 + i * 1.1, 1.4, 1.5, 0.34, hide, sd, i === 0 ? 0.8 : -0.8));
  }
  g.userData = { body, legs, arms, wings, sacs, tail, head, type, fly: type === 'flyer' };
  return g;
}
export function animAlien(m, t) {
  if (m.userData.glb) return AS.animAlienGLB(m, t);
  const u = m.userData; if (u.type === 'guardian' || u.type === 'hivecore') { u.body.rotation.y = t * 0.6; return; } if (u.type === 'nest') { u.body.scale.setScalar(1 + Math.sin(t * 2) * 0.04); return; }
  if (u.fly) { u.wings.forEach((p, i) => p.rotation.z = Math.sin(t * 30 + (i > 1 ? 1.2 : 0)) * 0.5 * (i % 2 ? 1 : -1)); u.body.position.y = Math.sin(t * 3) * 0.2; if (u.tail) u.tail.rotation.x = Math.sin(t * 4) * 0.25; return; }
  const sp = u.type === 'brute' || u.type === 'ravager' || u.type === 'queen' ? 5 : 9;
  u.legs.forEach((p, i) => { const ph = t * sp + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0); p.rotation.x = Math.sin(ph) * 0.45; if (p.userData.knee) p.userData.knee.rotation.x = (p.userData.knee.userData.k0 ??= p.userData.knee.rotation.x) + Math.max(0, Math.cos(ph)) * 0.5; });
  u.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 2 + i) * 0.12 - 0.1; });
  u.sacs.forEach((sc, i) => sc.scale.setScalar(1 + Math.sin(t * 3 + i * 2) * 0.08));
  if (u.tail) u.tail.rotation.y = Math.sin(t * 2.5) * 0.3; if (u.head) u.head.rotation.y = Math.sin(t * 1.3) * 0.15;
  u.body.position.y = Math.abs(Math.sin(t * sp)) * 0.04;
}

// ---------------------------------------------------------------- turrets and defenses
export function turret(kind, color, lvl) {
  const mg = AS.turretGLB(kind, lvl); if (mg) return mg;   // the Meshy model for this level
  const g = new THREE.Group(), head = new THREE.Group(), dark = 0x2c3238, metal = 0x6a7480, base = 0x3e464e;
  const accent = mat(color, { m: 0.3 }), parts = {};
  if (kind !== 'barricade' && kind !== 'stasis' && kind !== 'repair') { C(g, 0.9, 1.1, 0.4, base, 0, 0.2, 0); C(g, 0.35, 0.45, 0.9, dark, 0, 0.8, 0); B(g, 1.6, 0.1, 0.25, accent, 0, 0.42, 0).rotation.y = 0.8; }
  if (kind === 'pulse') {
    head.position.y = 1.35; g.add(head); B(head, 0.7, 0.5, 1.0, metal, 0, 0, 0.1); B(head, 0.72, 0.12, 0.6, accent, 0, 0.28, 0.1); C(head, 0.07, 0.07, 1.3, dark, 0, 0.02, -0.9).rotation.x = Math.PI / 2; B(head, 0.16, 0.16, 0.5, dark, 0, -0.05, -0.5);
    C(head, 0.09, 0.09, 0.35, 0x40c0ff, 0, 0.32, -0.1, { e: 0x2080ff }).rotation.x = Math.PI / 2; parts.muzzle = new THREE.Vector3(0, 1.35, -1.6);
  } else if (kind === 'minigun') {
    head.position.y = 1.35; g.add(head); B(head, 0.8, 0.55, 0.9, metal, 0, 0, 0.1); B(head, 0.82, 0.12, 0.5, accent, 0, 0.3, 0.1); B(head, 0.4, 0.4, 0.4, 0x2a2e34, 0.55, 0, 0.2);
    const bar = new THREE.Group(); bar.position.set(0, 0, -0.4); head.add(bar);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; C(bar, 0.05, 0.05, 1.1, dark, Math.cos(a) * 0.13, Math.sin(a) * 0.13, -0.5).rotation.x = Math.PI / 2; }
    C(bar, 0.2, 0.2, 0.1, metal, 0, 0, -0.95).rotation.x = Math.PI / 2; parts.spin = bar; parts.muzzle = new THREE.Vector3(0, 1.35, -1.5);
  } else if (kind === 'tesla') {
    head.position.y = 1.2; g.add(head); C(head, 0.25, 0.3, 1.6, metal, 0, 0.8, 0);
    for (let i = 0; i < 4; i++) C(head, 0.5 - i * 0.07, 0.5 - i * 0.07, 0.08, 0xb87333, 0, 0.3 + i * 0.4, 0, { m: 0.7, r: 0.3 });
    const orb = S(head, 0.38, 0x80d0ff, 0, 1.85, 0, 1, 1, 1, { e: 0x40a0ff, ei: 2 }); parts.orb = orb; parts.muzzle = new THREE.Vector3(0, 3.05, 0);
  } else if (kind === 'missile') {
    head.position.y = 1.4; g.add(head); B(head, 1.2, 0.8, 1.1, metal, 0, 0, 0); B(head, 1.22, 0.18, 0.6, accent, 0, 0.45, 0);
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) { C(head, 0.15, 0.15, 0.2, 0x111111, -0.28 + x * 0.56, -0.18 + y * 0.36, -0.56).rotation.x = Math.PI / 2; K(head, 0.1, 0.2, 0xd04030, -0.28 + x * 0.56, -0.18 + y * 0.36, -0.6).rotation.x = -Math.PI / 2; }
    parts.muzzle = new THREE.Vector3(0, 1.5, -0.8);
  } else if (kind === 'barricade') {
    g.add(head); for (let i = -2; i <= 2; i++) { B(head, 1.25, 1.8, 0.5, i % 2 ? metal : base, i * 1.3, 0.9, 0, { m: 0.4 }); B(head, 1.25, 0.15, 0.55, accent, i * 1.3, 1.6, 0); }
    for (const s of [-1, 1]) { B(head, 0.3, 2.2, 0.8, dark, s * 3.3, 1.1, 0); }
    parts.muzzle = new THREE.Vector3(0, 1, 0);
  } else if (kind === 'repair') {
    C(g, 1.3, 1.4, 0.25, base, 0, 0.12, 0); const cross = mat(0x40ff80, { e: 0x20c050 }); B(g, 1.2, 0.05, 0.35, cross, 0, 0.27, 0); B(g, 0.35, 0.05, 1.2, cross, 0, 0.27, 0);
    C(g, 0.12, 0.12, 1.6, metal, 1.0, 0.9, 1.0); S(g, 0.15, 0x40ff80, 1.0, 1.75, 1.0, 1, 1, 1, { e: 0x20c050 });
    head.position.y = 2.2; g.add(head); const d = new THREE.Group(); d.position.x = 1.1; head.add(d); B(d, 0.5, 0.18, 0.5, color, 0, 0, 0); for (const s of [-1, 1]) for (const t of [-1, 1]) C(d, 0.18, 0.18, 0.03, 0x111111, s * 0.35, 0.1, t * 0.35);
    S(d, 0.08, 0x40ff80, 0, -0.12, 0, 1, 1, 1, { e: 0x40ff80 }); parts.muzzle = new THREE.Vector3(0, 1.5, 0);
  } else if (kind === 'flamer') {
    head.position.y = 1.3; g.add(head); B(head, 0.8, 0.6, 1.0, metal, 0, 0, 0.1); B(head, 0.82, 0.12, 0.6, accent, 0, 0.32, 0.1);
    for (const sd of [-1, 1]) { C(head, 0.25, 0.25, 0.9, 0xb04020, sd * 0.55, 0.05, 0.3).rotation.x = Math.PI / 2; C(head, 0.26, 0.26, 0.08, 0x2a2e34, sd * 0.55, 0.05, 0.75).rotation.x = Math.PI / 2; }
    C(head, 0.09, 0.14, 0.7, dark, 0, -0.05, -0.65).rotation.x = Math.PI / 2; const pilot = S(head, 0.07, 0x40a0ff, 0, -0.05, -1.02, 1, 1, 1, { e: 0x2080ff, ei: 2 }); parts.pilot = pilot; parts.muzzle = new THREE.Vector3(0, 1.25, -1.05);
  } else if (kind === 'railgun') {
    head.position.y = 1.5; g.add(head); B(head, 0.7, 0.7, 0.9, metal, 0, 0, 0.2); B(head, 0.72, 0.15, 0.5, accent, 0, 0.38, 0.2);
    for (const sd of [-1, 1]) B(head, 0.12, 0.2, 2.2, dark, sd * 0.2, 0, -1.0); for (let z = -0.3; z > -2; z -= 0.4) B(head, 0.5, 0.06, 0.06, 0x40d0ff, 0, 0.1, z, { e: 0x2090c0, ei: 1.5 });
    parts.muzzle = new THREE.Vector3(0, 1.5, -2.1);
  } else if (kind === 'mines') {
    g.add(head); for (const [x, z] of [[-1.6, 0.4], [0, -0.3], [1.6, 0.5]]) { C(head, 0.42, 0.5, 0.18, 0x3a4030, x, 0.09, z); S(head, 0.09, 0xff3020, x, 0.22, z, 1, 1, 1, { e: 0xff1000, ei: 2 }); }
    parts.muzzle = new THREE.Vector3(0, 0.3, 0);
  } else if (kind === 'shotgunT' || kind === 'autocannon') { // a squat turret with two thick barrels
    head.position.y = 1.3; g.add(head); B(head, 0.95, 0.62, 1.0, metal, 0, 0, 0.1); B(head, 0.97, 0.14, 0.55, accent, 0, 0.34, 0.1);
    for (const sd of [-1, 1]) { C(head, kind === 'shotgunT' ? 0.12 : 0.09, kind === 'shotgunT' ? 0.12 : 0.09, kind === 'shotgunT' ? 0.9 : 1.3, dark, sd * 0.22, 0.02, -0.75).rotation.x = Math.PI / 2; C(head, 0.15, 0.15, 0.12, 0x111111, sd * 0.22, 0.02, kind === 'shotgunT' ? -1.2 : -1.4).rotation.x = Math.PI / 2; }
    B(head, 0.3, 0.35, 0.5, 0x8a3020, 0.55, -0.05, 0.2); parts.muzzle = new THREE.Vector3(0, 1.3, -1.3);
  } else if (kind === 'rally') { // a tall pole with a flag and a flashing landing light
    g.add(head); C(head, 0.9, 1.0, 0.2, base, 0, 0.1, 0); C(head, 0.07, 0.07, 5, metal, 0, 2.6, 0); const fl = B(head, 1.4, 0.8, 0.04, color, 0.72, 4.6, 0); void fl;
    S(head, 0.18, 0xff4020, 0, 5.2, 0, 1, 1, 1, { e: 0xff3010, ei: 3 }); const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 32), mat(0xffc020, { e: 0x805000, ds: true })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; head.add(ring); parts.muzzle = new THREE.Vector3(0, 5, 0);
  } else if (kind === 'sandbag') { // a horseshoe of sandbags, two rows high
    g.add(head); const bag = mat(0x9a8a62, { r: 1, flat: false }); for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) { const a = -2.2 + i / 8 * 4.4 + r * 0.24, b = S(head, 0.42, bag, Math.sin(a) * 2.4, 0.25 + r * 0.42, -Math.cos(a) * 2.4, 1.5, 0.6, 0.9); b.rotation.y = -a; }
    parts.muzzle = new THREE.Vector3(0, 0.6, 0);
  } else if (kind === 'nest') { // a climbable sniper tower: four legs, a ladder and a sandbagged platform
    g.add(head); for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { const l = B(head, 0.18, 5.4, 0.18, metal, x, 2.7, z); void l; } B(head, 3.2, 0.2, 3.2, base, 0, 5.3, 0);
    for (let i = 0; i < 8; i++) B(head, 1.1, 0.06, 0.06, dark, 0, 0.6 + i * 0.6, 1.62); for (const sd of [-1, 1]) B(head, 0.08, 5.2, 0.08, dark, sd * 0.5, 2.7, 1.62);
    const bag = mat(0x9a8a62, { r: 1, flat: false }); for (let i = 0; i < 4; i++) for (const [x, z, ry] of [[i * 0.8 - 1.2, -1.45, 0], [-1.45, i * 0.8 - 1.2, 1.57], [1.45, i * 0.8 - 1.2, 1.57]]) { const b = S(head, 0.32, bag, x, 5.6, z, 1.3, 0.6, 0.8); b.rotation.y = ry; }
    B(head, 3.3, 0.12, 0.12, color, 0, 6.1, -1.6); parts.muzzle = new THREE.Vector3(0, 6, 0);
  } else if (kind === 'fieldhosp') { // a white field tent with a red cross and a glowing respawn pad
    g.add(head); const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 2.4, 2.4, 4, 1), mat(0xe8e8e0, { r: 0.9 })); tent.position.y = 1.2; tent.rotation.y = Math.PI / 4; head.add(tent);
    const red = mat(0xd02020, { e: 0x600000 }); B(head, 0.9, 0.25, 0.05, red, 0, 1.3, -1.25); B(head, 0.25, 0.9, 0.05, red, 0, 1.3, -1.25);
    const pad = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 24), mat(0x60ff90, { e: 0x30c060, ei: 2, ds: true })); pad.rotation.x = -Math.PI / 2; pad.position.set(2.2, 0.06, 0); head.add(pad); parts.muzzle = new THREE.Vector3(0, 1.5, 0);
  } else if (kind === 'teleporter') { // a ring pad with three pylons and a glowing column of light
    g.add(head); C(head, 1.3, 1.45, 0.25, 0x3a424a, 0, 0.12, 0); const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), mat(0x60e0ff, { e: 0x30b0ff, ei: 2 })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.26; head.add(disc);
    for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283; B(head, 0.22, 1.6, 0.22, 0x5a646e, Math.cos(a) * 1.3, 0.9, Math.sin(a) * 1.3); S(head, 0.13, 0x80f0ff, Math.cos(a) * 1.3, 1.8, Math.sin(a) * 1.3, 1, 1, 1, { e: 0x40d0ff, ei: 3 }); B(head, 0.24, 0.1, 0.5, color, Math.cos(a) * 1.3, 0.3, Math.sin(a) * 1.3).rotation.y = -a; }
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 3.2, 24, 1, true), mat(0x80e8ff, { e: 0x40c0ff, op: 0.22, ds: true })); col.position.y = 1.85; head.add(col); parts.col = col; parts.muzzle = new THREE.Vector3(0, 1, 0);
  } else if (kind === 'resupply') {
    B(g, 2.2, 1.4, 1.6, 0x4a5a3a, 0, 0.7, 0); B(g, 2.25, 0.25, 1.65, 0xe0b22e, 0, 1.25, 0, { e: 0x604000 }); C(g, 0.5, 0.5, 1.6, 0x8a96a2, -1.6, 0.8, 0); C(g, 0.5, 0.5, 1.6, 0x8a96a2, 1.6, 0.8, 0);
    head.position.y = 2.1; g.add(head); C(head, 0.06, 0.06, 1.2, 0x333333, 0, 0, 0); S(head, 0.18, 0x40ff80, 0, 0.7, 0, 1, 1, 1, { e: 0x20c050, ei: 2 }); for (let i = 0; i < 4; i++) B(head, 0.12, 0.3, 0.12, 0xc8a040, Math.cos(i * 1.57) * 0.5, -0.5, Math.sin(i * 1.57) * 0.5, { m: 0.8 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6, 48), mat(0x40ff80, { e: 0x20c050, op: 0.35, ds: true })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring); parts.muzzle = new THREE.Vector3(0, 2, 0);
  } else if (kind === 'uav') { // the sentry ball: a fist-sized sensor sphere on three little legs, with a glowing scanning band
    head.position.y = 0.55; g.add(head); S(head, 0.42, 0x2c3238, 0, 0, 0, 1, 1, 1, { m: 0.7, r: 0.3 }); const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.06, 8, 24), mat(0x40c0ff, { e: 0x2090ff, ei: 2.5 })); band.rotation.x = Math.PI / 2; head.add(band); S(head, 0.12, 0x80e0ff, 0, 0.12, -0.38, 1, 1, 1, { e: 0x40c0ff, ei: 3 });
    C(head, 0.02, 0.02, 0.5, 0x222222, 0.15, 0.6, 0.1); S(head, 0.05, 0xff4040, 0.15, 0.86, 0.1, 1, 1, 1, { e: 0xff2020, ei: 3 }); for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283; B(g, 0.05, 0.4, 0.05, 0x3a424a, Math.cos(a) * 0.3, 0.18, Math.sin(a) * 0.3).rotation.z = Math.cos(a) * 0.4; } parts.muzzle = new THREE.Vector3(0, 0.6, 0);
  } else if (kind === 'claymore') {
    g.add(head); const cb = B(head, 0.5, 0.35, 0.12, 0x3a4a2a, 0, 0.3, 0); cb.rotation.x = -0.15; for (const sd of [-1, 1]) B(head, 0.04, 0.3, 0.04, 0x333333, sd * 0.2, 0.1, 0.05); S(head, 0.04, 0xff2010, 0, 0.42, -0.07, 1, 1, 1, { e: 0xff0000, ei: 3 });
    const laser = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 4.5), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.5 })); laser.position.set(0, 0.35, -2.3); head.add(laser); parts.muzzle = new THREE.Vector3(0, 0.3, 0);
  } else if (kind === 'mortar') {
    head.position.y = 1.0; g.add(head); C(head, 0.6, 0.7, 0.3, metal, 0, 0, 0); const tube = C(head, 0.28, 0.32, 1.6, 0x3a5a30, 0, 0.7, -0.2); tube.rotation.x = 0.6; C(head, 0.3, 0.3, 0.1, 0x80ff40, 0, 1.35, -0.62, { e: 0x40c020 }).rotation.x = 0.6;
    for (const sd of [-1, 1]) C(head, 0.18, 0.18, 0.5, 0x5a8a3a, sd * 0.55, 0.2, 0.25, { e: 0x204010 }); parts.muzzle = new THREE.Vector3(0, 2.2, -0.7);
  } else if (kind === 'medbay') {
    C(g, 1.4, 1.5, 0.3, base, 0, 0.15, 0); const cross = mat(0xff4040, { e: 0xc02020 }); B(g, 1.3, 0.06, 0.38, cross, 0, 0.32, 0); B(g, 0.38, 0.06, 1.3, cross, 0, 0.32, 0);
    head.position.y = 1.6; g.add(head); B(head, 1.0, 1.4, 0.6, 0xe8e8f0, 0, 0, -1.1); B(head, 0.5, 0.15, 0.62, cross, 0, 0.3, -1.1); B(head, 0.15, 0.5, 0.62, cross, 0, 0.3, -1.1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 6, 32), mat(0x60ff90, { e: 0x30c060 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.6; head.add(ring); parts.muzzle = new THREE.Vector3(0, 1.6, 0);
  } else if (kind === 'beacon') {
    C(g, 0.5, 0.7, 0.4, base, 0, 0.2, 0); C(g, 0.08, 0.1, 3.2, metal, 0, 1.9, 0); head.position.y = 3.4; g.add(head); B(head, 1.6, 0.06, 0.25, accent, 0, 0, 0); S(head, 0.18, 0xff8030, 0, 0.25, 0, 1, 1, 1, { e: 0xff6010, ei: 2 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(11.7, 12, 64), mat(0xff8030, { e: 0xff6010, op: 0.4, ds: true })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    parts.muzzle = new THREE.Vector3(0, 3.5, 0);
  } else if (kind === 'stasis') {
    C(g, 0.6, 0.8, 0.4, base, 0, 0.2, 0); C(g, 0.18, 0.25, 1.6, metal, 0, 1.2, 0); S(g, 0.3, 0x6080ff, 0, 2.1, 0, 1, 1, 1, { e: 0x4060ff, ei: 2 });
    head.position.y = 2.1; g.add(head); for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.12, 0.03, 4, 20), mat(0x80a0ff, { e: 0x4060ff })); r.rotation.x = Math.PI / 2 + i * 0.5; head.add(r); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(7.2, 7.5, 48), mat(0x6080ff, { e: 0x4060ff, op: 0.5, ds: true })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7.2, 48), mat(0x6080ff, { e: 0x203080, op: 0.12, ds: true })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; g.add(disc);
    parts.muzzle = new THREE.Vector3(0, 2.1, 0);
  }
  g.userData = { head, ...parts, kind };
  AS.structGLB(kind, g, head);   // Meshy body for the class structures; rings and pads stay
  return g;
}

// ---------------------------------------------------------------- the hive and the hub
export function hive() {
  const g = new THREE.Group(), sk = 0x3a2048, gl = mat(0xa040ff, { e: 0x8020ff, ei: 1.5 });
  S(g, 5, sk, 0, 0, 0, 1.2, 0.8, 1.2); S(g, 3, sk, 2, 3, 1, 1, 1.2, 1); S(g, 2.5, sk, -2.5, 2.5, -1.5);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; K(g, 0.8, 4 + (i % 3), 0x281430, Math.cos(a) * 4.5, 1.5, Math.sin(a) * 4.5).rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); }
  S(g, 2.2, gl, 0, 1, 0, 1, 0.7, 1); const L = new THREE.PointLight(0xa040ff, 40, 30); L.position.y = 4; g.add(L);
  return g;
}
export function hub() {
  const g = new THREE.Group(), metal = 0x8a96a2, dark = 0x3a424a;
  C(g, 7, 7.6, 1.2, dark, 0, 0.6, 0, null, 16); C(g, 5.5, 6.5, 3, metal, 0, 2.6, 0, { m: 0.4 }, 16);
  const core = S(g, 3, 0x60e0ff, 0, 5.3, 0, 1, 1, 1, { e: 0x30a0ff, ei: 1.6 });
  const rings = new THREE.Group(); rings.position.y = 5.3; g.add(rings);
  for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(4 + i * 0.6, 0.18, 6, 32), mat(0xc0c8d0, { m: 0.7, r: 0.3 })); r.rotation.x = Math.PI / 2 + i * 0.6; rings.add(r); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.4; B(g, 1.2, 7, 1.2, dark, Math.cos(a) * 6.2, 3.5, Math.sin(a) * 6.2); S(g, 0.4, 0xff4040, Math.cos(a) * 6.2, 7.2, Math.sin(a) * 6.2, 1, 1, 1, { e: 0xff2020 }); }
  const shield = new THREE.Mesh(new THREE.SphereGeometry(8.5, 24, 14, 0, 6.29, 0, Math.PI / 2), mat(0x60c0ff, { op: 0.12, e: 0x2060a0, ds: true, flat: false })); g.add(shield);
  const L = new THREE.PointLight(0x60c0ff, 60, 40); L.position.y = 6; g.add(L);
  { const rm = AS.fitGLB('h_reactor', 'w', 15, false); if (rm) { for (const c of [...g.children]) if (c.isMesh && c !== core && c !== shield) g.remove(c); g.add(rm); rm.updateMatrixWorld(true); const top = new THREE.Box3().setFromObject(rm).max.y; core.position.y = top + 2.2; rings.position.y = top + 2.2; } }   // the Meshy reactor under the glowing core
  g.userData = { rings, core, shield };
  return g;
}
export function parachute() {
  const g = new THREE.Group(); g.userData.chute = true; const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 6, 0, 6.29, 0, 1.1), mat(0xe8e0c8, { ds: true })); canopy.position.y = 4.6; canopy.scale.y = 0.7; g.add(canopy);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, x = Math.cos(a) * 1.9, z = Math.sin(a) * 1.9, len = Math.hypot(x, 3.6, z); const l = B(g, 0.03, len, 0.03, 0x555555, x / 2, 1.0 + 1.8, z / 2); l.lookAt(x, 4.6, z); l.rotateX(Math.PI / 2); l.castShadow = false; }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.5; const stripe = B(g, 0.5, 0.05, 1.2, 0xd04020, Math.cos(a) * 1.6, 5.15, Math.sin(a) * 1.6); stripe.rotation.y = -a; stripe.castShadow = false; }
  return g;
}
// what each turret gains at level 2 and level 3: armour, extra weapons, sensors, a gold trim
// What each upgrade adds. Level 2 and level 3 bolt on kind-specific hardware: weapons on the turning head, armour and power on the base.
// (The whole turret also grows: 1x, 1.28x, 1.55x.)
export function upgradeParts(kind, lvl, color) {
  if (AS.turretGLB(kind, lvl)) { const g = new THREE.Group(); g.userData.head = new THREE.Group(); return g; }   // Meshy turrets have a model per level instead
  const g = new THREE.Group(), hd = new THREE.Group(); g.userData.head = hd; if (lvl < 2) return g;
  const steel = 0x5a646e, dark = 0x22272c, gold = mat(0xffc840, { m: 0.85, r: 0.25, e: 0x402800 }), acc = mat(color, { m: 0.3 }), glow = mat(0x60e0ff, { e: 0x30a0ff, ei: 2.5 }), hot = mat(0xff7a20, { e: 0xff5010, ei: 2.5 }), red = mat(0xff3020, { e: 0xff1000, ei: 2.5 }), green = mat(0x50ff90, { e: 0x20d060, ei: 2.5 });
  const L3 = lvl >= 3, ring = (grp, r, t, m, y, x = 0, z = 0, rx = Math.PI / 2) => { const o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 32), m); o.rotation.x = rx; o.position.set(x, y, z); grp.add(o); return o; };
  const gun = ['pulse', 'minigun', 'missile', 'flamer', 'railgun'].includes(kind);
  // armoured base for the guns: a hex skirt at level 2; at level 3 stabiliser legs, a gold collar and a glowing power ring
  if (gun || kind === 'tesla') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, pl = B(g, 0.75, 0.55, 0.14, i % 2 ? steel : color, Math.cos(a) * 1.1, 0.35, Math.sin(a) * 1.1); pl.rotation.y = -a + Math.PI / 2; }
    if (L3) { for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283 + 0.5, leg = B(g, 0.22, 0.18, 1.5, dark, Math.cos(a) * 1.5, 0.15, Math.sin(a) * 1.5); leg.rotation.y = -a + Math.PI / 2; B(g, 0.5, 0.08, 0.5, steel, Math.cos(a) * 2.2, 0.04, Math.sin(a) * 2.2); } ring(g, 1.15, 0.08, gold, 0.66); ring(g, 0.55, 0.05, glow, 0.95); }
  }
  if (kind === 'pulse') { // twin barrels, then a quad mount with a scope and glowing heat fins
    C(hd, 0.07, 0.07, 1.3, dark, 0.22, 0.02, -0.9).rotation.x = Math.PI / 2; B(hd, 0.28, 0.32, 0.5, steel, 0.48, -0.05, 0.25);
    if (L3) { for (const [x, y] of [[0, 0.2], [0.22, 0.2]]) C(hd, 0.06, 0.06, 1.4, dark, x, y, -0.95).rotation.x = Math.PI / 2; C(hd, 0.08, 0.08, 0.5, 0x111111, -0.3, 0.4, 0).rotation.x = Math.PI / 2; S(hd, 0.06, 0x40c0ff, -0.3, 0.4, -0.26, 1, 1, 1, { e: 0x2080ff, ei: 3 }); for (let i = 0; i < 4; i++) B(hd, 0.05, 0.35, 0.3, glow, -0.4, 0, 0.35 - i * 0.12); }
  } else if (kind === 'minigun') { // a second barrel cluster, then a gun shield, ammo drums and a laser sight
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; C(hd, 0.05, 0.05, 1.0, dark, -0.55 + Math.cos(a) * 0.12, Math.sin(a) * 0.12, -0.85).rotation.x = Math.PI / 2; } C(hd, 0.18, 0.18, 0.1, steel, -0.55, 0, -1.3).rotation.x = Math.PI / 2;
    if (L3) { const sh = B(hd, 1.9, 1.0, 0.1, steel, -0.25, 0.1, -0.35); sh.rotation.x = -0.15; B(hd, 1.92, 0.12, 0.12, acc, -0.25, 0.58, -0.4); for (const x of [0.75, -1.05]) C(hd, 0.28, 0.28, 0.4, 0x4a5a3a, x, -0.1, 0.25); C(hd, 0.02, 0.02, 0.1, 0x111111, 0.3, 0.25, -0.5).rotation.x = Math.PI / 2; S(hd, 0.05, 0xff3020, 0.3, 0.25, -0.56, 1, 1, 1, { e: 0xff1000, ei: 3 }); }
  } else if (kind === 'tesla') { // more coils and three satellite orbs, then floating rings and a crown of arcs
    for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283; B(hd, 0.08, 0.08, 0.9, steel, Math.cos(a) * 0.45, 1.5, Math.sin(a) * 0.45).rotation.set(0, -a, 0); S(hd, 0.14, 0x80d0ff, Math.cos(a) * 0.8, 1.55, Math.sin(a) * 0.8, 1, 1, 1, { e: 0x40a0ff, ei: 2 }); }
    for (let i = 0; i < 2; i++) C(hd, 0.62, 0.62, 0.08, 0xb87333, 0, 0.1 + i * 1.75, 0, { m: 0.7, r: 0.3 });
    if (L3) { for (let i = 0; i < 3; i++) ring(hd, 0.75 + i * 0.28, 0.045, glow, 2.3 + i * 0.3, 0, 0, Math.PI / 2 + (i - 1) * 0.25); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; K(hd, 0.06, 0.5, 0xb87333, Math.cos(a) * 0.32, 2.3, Math.sin(a) * 0.32); } S(hd, 0.2, 0xffffff, 0, 3.2, 0, 1, 1, 1, { e: 0x80c0ff, ei: 3 }); }
  } else if (kind === 'missile') { // side pods double the tubes, then a big top rack and a radar dish
    for (const sd of [-1, 1]) { B(hd, 0.45, 0.7, 1.0, steel, sd * 0.85, 0, 0); for (let y = 0; y < 2; y++) K(hd, 0.1, 0.2, 0xd04030, sd * 0.85, -0.16 + y * 0.32, -0.55).rotation.x = -Math.PI / 2; }
    if (L3) { B(hd, 1.6, 0.6, 1.2, steel, 0, 0.75, 0.05); B(hd, 1.62, 0.1, 0.5, acc, 0, 1.08, 0.05); for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) K(hd, 0.09, 0.22, 0xffd040, -0.5 + x * 0.5, 0.62 + y * 0.26, -0.62).rotation.x = -Math.PI / 2; C(hd, 0.04, 0.04, 0.6, dark, 0.7, 1.35, 0.4); const dish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 6, 0, 6.29, 0, 1.1), mat(0xd0d4d8, { ds: true })); dish.position.set(0.7, 1.7, 0.4); dish.rotation.x = 1.2; hd.add(dish); }
  } else if (kind === 'flamer') { // a fuel tank on the back and a second nozzle, then an armoured hood with glowing vents
    C(hd, 0.32, 0.32, 0.9, 0xb04020, 0, 0.45, 0.45).rotation.z = Math.PI / 2; C(hd, 0.08, 0.12, 0.6, dark, 0.3, -0.1, -0.6).rotation.x = Math.PI / 2;
    if (L3) { const hood = B(hd, 1.3, 0.25, 1.4, steel, 0, 0.5, 0); hood.rotation.x = 0.08; for (let i = 0; i < 4; i++) B(hd, 0.9, 0.04, 0.08, hot, 0, 0.64, -0.4 + i * 0.25); for (const sd of [-1, 1]) B(hd, 0.12, 0.6, 1.2, steel, sd * 0.7, 0, 0); S(hd, 0.09, 0xff7a20, 0.3, -0.1, -0.95, 1, 1, 1, { e: 0xff5010, ei: 3 }); }
  } else if (kind === 'railgun') { // longer rails and capacitor banks, then glowing coils down the barrel and a power spine
    for (const sd of [-1, 1]) { B(hd, 0.1, 0.18, 0.9, dark, sd * 0.2, 0, -2.5); B(hd, 0.25, 0.4, 0.6, steel, sd * 0.5, 0, 0.3); }
    if (L3) { for (let i = 0; i < 5; i++) ring(hd, 0.3, 0.04, glow, 0, 0, -0.5 - i * 0.45, 0); B(hd, 0.2, 0.25, 1.4, steel, 0, 0.5, 0); for (let i = 0; i < 4; i++) B(hd, 0.22, 0.05, 0.12, glow, 0, 0.64, 0.5 - i * 0.3); }
  } else if (kind === 'barricade') { // spikes, then an energy field on top
    for (let i = -2; i <= 2; i++) { K(g, 0.18, 0.8, 0x8a8a8a, i * 1.3, 2.1, 0.3).rotation.x = 0.4; K(g, 0.18, 0.8, 0x8a8a8a, i * 1.3, 2.1, -0.3).rotation.x = -0.4; }
    if (L3) { const f = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.4, 0.08), mat(0x60c0ff, { op: 0.35, e: 0x3080ff, ds: true })); f.position.y = 2.5; g.add(f); for (const sd of [-1, 1]) S(g, 0.16, 0x60e0ff, sd * 3.3, 2.4, 0, 1, 1, 1, { e: 0x30a0ff, ei: 3 }); }
  } else if (kind === 'mines') { for (const [x, z] of [[-1.6, 0.4], [0, -0.3], [1.6, 0.5]]) { ring(g, 0.55, 0.04, red, 0.12, x, z); if (L3) C(g, 0.3, 0.42, 0.14, 0x2a3020, x, 0.24, z); } }
  else if (kind === 'mortar') { for (const sd of [-1, 1]) C(g, 0.18, 0.2, 1.1, 0x3a5a30, sd * 0.75, 1.2, 0); if (L3) { B(g, 1.2, 0.6, 0.8, 0x4a5a3a, 0, 0.3, 1.1); ring(g, 1.3, 0.07, gold, 0.4); for (let i = 0; i < 4; i++) C(g, 0.08, 0.08, 0.35, 0x80ff60, -0.3 + i * 0.2, 0.75, 1.1, { e: 0x40c020, ei: 1.5 }); } }
  else { // support structures: resupply, ammo cache, med bay, stasis, UAV: an antenna mast and plating, then a gold ring, beacon and extra modules
    const col = kind === 'medbay' ? green : kind === 'stasis' ? glow : kind === 'resupply' || kind === 'ammocache' ? mat(0xffd040, { e: 0xffa000, ei: 2.5 }) : glow;
    C(g, 0.05, 0.05, 2.2, 0x333333, 1.1, 1.1, 0.4); S(g, 0.12, 0xffffff, 1.1, 2.25, 0.4, 1, 1, 1, { e: 0xffffff, ei: 1 }); for (const sd of [-1, 1]) B(g, 0.12, 0.5, 1.6, steel, sd * 1.2, 0.25, 0);
    if (L3) { ring(g, 1.5, 0.08, gold, 0.45); ring(g, 1.2, 0.05, col, 0.1); B(g, 0.8, 0.7, 0.8, steel, -1.2, 0.35, -0.8); S(g, 0.18, 0xffffff, -1.2, 0.9, -0.8, 1, 1, 1, col === glow ? { e: 0x30a0ff, ei: 3 } : { e: 0xffd040, ei: 2 }); C(g, 0.04, 0.04, 1.2, 0x333333, -1.2, 1.4, -0.8); }
  }
  return g;
}
export function ammoCrate() { const g = new THREE.Group(); B(g, 1.3, 0.8, 0.9, 0x4a5a3a, 0, 0.4, 0); B(g, 1.32, 0.18, 0.92, 0xe0b22e, 0, 0.62, 0, { e: 0x604000 }); for (let i = 0; i < 4; i++) C(g, 0.06, 0.06, 0.3, 0xc8a040, -0.4 + i * 0.27, 0.95, 0, { m: 0.8 }); const L = S(g, 0.12, 0xffd040, 0, 1.3, 0, 1, 1, 1, { e: 0xffa000, ei: 2 }); void L; return g; }
// ---------------------------------------------------------------- points of interest
export function satellite(rnd) { { const mg = AS.propGLB('satellite', rnd); if (mg) return mg; }
  const g = new THREE.Group(), foil = mat(0xd8a838, { m: 0.8, r: 0.35 }), panel = mat(0x1a3a7a, { m: 0.6, r: 0.25, e: 0x081830 }), frame = 0x8a929a;
  const body = B(g, 2.2, 1.8, 2.6, foil, 0, 0.9, 0); body.rotation.set(0.3, 0.4, 0.25);
  for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(sd * 1.4, 1.1, 0); arm.rotation.set(rnd() - 0.5, 0, sd * (0.3 + rnd() * 0.6)); g.add(arm); B(arm, 0.1, 0.1, 0.1, frame, 0, 0, 0); for (let i = 0; i < 3; i++) { const pn = B(arm, 1.6, 0.06, 1.8, panel, sd * (1 + i * 1.7), 0, 0); pn.rotation.z = (rnd() - 0.5) * 0.5 * i; } }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 6, 0, 6.29, 0, 1.0), mat(0xd0d4d8, { ds: true })); dish.position.set(0.2, 2.2, 1.2); dish.rotation.set(1.9, 0, 0.6); g.add(dish);
  for (let i = 0; i < 8; i++) { const d = B(g, 0.2 + rnd() * 0.8, 0.05, 0.2 + rnd() * 0.6, rnd() < 0.5 ? frame : foil, (rnd() - 0.5) * 9, 0.05, (rnd() - 0.5) * 9); d.rotation.y = rnd() * 6; }
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(4, 16), mat(0x1a1410, { op: 0.6 })); scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.04; g.add(scorch); return g;
}
export function capsule(rnd) { { const mg = AS.propGLB('capsule', rnd); if (mg) return mg; }
  const g = new THREE.Group(), hull = mat(0xc8ccd0, { m: 0.5, r: 0.5 }), heat = mat(0x2a2420, { r: 0.9 });
  const c = new THREE.Group(); c.rotation.set(0.5 + rnd() * 0.3, rnd() * 6, 0.2); c.position.y = 0.8; g.add(c);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.9, 2.8, 16), hull); cone.castShadow = true; c.add(cone); const shield = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 0.3, 16), heat); shield.position.y = -1.5; c.add(shield);
  B(c, 0.9, 1.0, 0.1, 0x101418, 0, 0.1, 1.45).rotation.x = -0.35; const hatch = B(c, 0.9, 1.0, 0.1, hull, 0.9, 0.1, 1.5); hatch.rotation.set(-0.35, 0.9, 0);
  B(c, 0.25, 0.08, 0.25, 0xff3020, 0, 1.45, 0, { e: 0xff1000, ei: 2 });
  const chute = new THREE.Mesh(new THREE.SphereGeometry(3.5, 14, 6, 0, 6.29, 0, 0.9), mat(0xe8702a, { ds: true, r: 1 })); chute.scale.y = 0.2; chute.position.set(4, 0.2, 2); chute.rotation.z = 0.2; g.add(chute);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(3, 16), mat(0x1a1410, { op: 0.5 })); scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.04; g.add(scorch); return g;
}
export function wreck(rnd) { { const mg = AS.propGLB('wreck', rnd); if (mg) return mg; }
  const g = new THREE.Group(), hull = mat(0x5a646e, { m: 0.5, r: 0.6 }), burnt = mat(0x2a2624, { r: 0.9 }), stripe = mat(0xd09030, {});
  const f1 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 9, 12), hull); f1.rotation.set(0.1, 0, Math.PI / 2 + 0.15); f1.position.set(-4, 1.8, 0); f1.castShadow = true; g.add(f1);
  const f2 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 6, 12), burnt); f2.rotation.set(0.3, 0.5, Math.PI / 2 - 0.3); f2.position.set(4.5, 1.6, 2); f2.castShadow = true; g.add(f2);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.5, 12), hull); nose.rotation.z = Math.PI / 2 + 0.15; nose.position.set(-10, 2.4, 0); g.add(nose); B(g, 1.2, 0.6, 2.5, 0x80c0e0, -9.5, 3.2, 0, { op: 0.6, m: 0.8 });
  for (const sd of [-1, 1]) { const w = B(g, 6, 0.3, 3, hull, -3, 1.2, sd * 4.5); w.rotation.set(sd * 0.2, 0.2, 0.1); B(g, 1.4, 1.4, 3, burnt, -1, 1.4, sd * 6.5); }
  B(g, 4, 0.2, 0.6, stripe, -4, 3.9, 0); for (let i = 0; i < 14; i++) { const d = B(g, 0.3 + rnd(), 0.1, 0.3 + rnd(), rnd() < 0.5 ? 0x5a646e : 0x2a2624, (rnd() - 0.5) * 22, 0.06, (rnd() - 0.5) * 14); d.rotation.set(rnd(), rnd() * 6, rnd()); }
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(9, 20), mat(0x1a1410, { op: 0.55 })); scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.04; g.add(scorch); return g;
}
export function rover(rnd) {
  const g = new THREE.Group(), body = mat(0xe8e0d0, { m: 0.3 }), dark = 0x2a2e34; const r = new THREE.Group(); r.rotation.set(0, rnd() * 6, 0.35); r.position.y = 0.5; g.add(r);
  B(r, 3.2, 1.0, 2.0, body, 0, 0.9, 0); B(r, 1.2, 0.8, 1.8, 0x4a6a8a, -0.9, 1.7, 0, { op: 0.7, m: 0.6 }); for (const x of [-1.2, 0, 1.2]) for (const z of [-1.15, 1.15]) C(r, 0.45, 0.45, 0.35, dark, x, 0.45, z).rotation.x = Math.PI / 2;
  C(r, 0.04, 0.04, 1.8, 0x888888, 1.2, 2.2, 0.6); S(r, 0.1, 0xff3020, 1.2, 3.1, 0.6, 1, 1, 1, { e: 0xff1000, ei: 2 }); B(r, 1.0, 0.05, 0.8, 0x1a3a7a, 0.6, 1.45, 0, { e: 0x081830 }); return g;
}
export function debris(rnd) {
  const g = new THREE.Group(); for (let i = 0; i < 10; i++) { const k = rnd(); const d = k < 0.5 ? B(g, 0.4 + rnd() * 1.6, 0.08, 0.3 + rnd() * 1.2, k < 0.25 ? 0x6a727a : 0x3a3430, (rnd() - 0.5) * 8, 0.1, (rnd() - 0.5) * 8) : C(g, 0.08, 0.08, 1 + rnd() * 2.5, 0x5a5a5a, (rnd() - 0.5) * 8, 0.3, (rnd() - 0.5) * 8); d.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3); } return g;
}
export function terminal() { { const mg = AS.propGLB('terminal'); if (mg) return mg; }
  const g = new THREE.Group(); B(g, 0.8, 1.2, 0.5, 0x3a424a, 0, 0.6, 0, { m: 0.4 }); const sc = B(g, 0.7, 0.45, 0.05, 0x40ffb0, 0, 1.15, 0.2, { e: 0x20c080, ei: 2 }); sc.rotation.x = -0.4;
  return g;
}
export function spire(rnd, color) { { const mg = AS.propGLB('spireHive', rnd); if (mg) return mg; } const g = new THREE.Group(); const h = 8 + rnd() * 9; const m = new THREE.Mesh(new THREE.ConeGeometry(1.6 + rnd(), h, 7), mat(color, { flat: false, r: 1 })); m.position.y = h / 2 - 0.5; m.rotation.set((rnd() - 0.5) * 0.2, rnd() * 6, (rnd() - 0.5) * 0.2); m.castShadow = true; g.add(m); return g; }
export function dropship() { const g = new THREE.Group(), hull = mat(0x5a6670, { m: 0.5, r: 0.5 }); B(g, 3, 2.2, 9, hull, 0, 0, 0); B(g, 2.4, 1.2, 2.5, 0x80c0e0, 0, 0.9, -3.8, { op: 0.7, m: 0.8 }); for (const sd of [-1, 1]) { B(g, 4, 0.3, 3, hull, sd * 3.2, 0.2, 1); C(g, 0.8, 0.9, 2.2, 0x2a2e34, sd * 4.8, 0, 1).rotation.x = Math.PI / 2; S(g, 0.6, 0x80c0ff, sd * 4.8, 0, 2.2, 1, 1, 1, { e: 0x4080ff, ei: 2 }); } B(g, 3.2, 0.3, 1.5, 0xd09030, 0, 1.2, 2); return g; }
export function jet() { const g = new THREE.Group(), hull = mat(0x4a525a, { m: 0.6, r: 0.4 }); B(g, 1.4, 1.0, 8, hull, 0, 0, 0); const n = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.5, 8), hull); n.rotation.x = -Math.PI / 2; n.position.z = -5.2; g.add(n); B(g, 9, 0.2, 2.5, hull, 0, 0, 1); B(g, 0.2, 2, 1.6, hull, 0, 1, 3.4); S(g, 0.5, 0xffa040, 0, 0, 4.2, 1, 1, 1, { e: 0xff6000, ei: 2 }); return g; }
export function drone() { // a gunship drone: armoured body, four ducted rotors, a chin gun, and bright running lights
  const g = new THREE.Group(), hull = mat(0x4a545e, { m: 0.6, r: 0.4 }); B(g, 1.6, 0.5, 2.2, hull, 0, 0, 0); B(g, 1.2, 0.35, 1.0, 0x2a3036, 0, 0.35, 0.2); B(g, 0.9, 0.3, 0.5, mat(0x80c8e8, { op: 0.7, m: 0.8 }), 0, 0.15, -1.1);
  for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) { C(g, 0.62, 0.62, 0.22, 0x23282e, x, 0.05, z); B(g, 0.9, 0.12, 0.2, hull, x * 0.6, 0.05, z * 0.6).rotation.y = Math.atan2(x, z); }
  C(g, 0.08, 0.08, 1.0, 0x222222, 0, -0.35, -0.9).rotation.x = Math.PI / 2; B(g, 0.35, 0.3, 0.4, 0x2a3036, 0, -0.3, -0.5);
  S(g, 0.12, 0xff3020, -1.3, 0.25, 1.4, 1, 1, 1, { e: 0xff2010, ei: 3 }); S(g, 0.12, 0x30ff60, 1.3, 0.25, 1.4, 1, 1, 1, { e: 0x20ff40, ei: 3 }); S(g, 0.16, 0xffffff, 0, -0.1, -1.4, 1, 1, 1, { e: 0xffffff, ei: 3 });
  g.scale.setScalar(1.3); return g; }
export function medCrate(r) { const g = new THREE.Group(); B(g, 1.3, 0.9, 1.0, 0xe8e8f0, 0, 0.45, 0); const red = mat(0xff3030, { e: 0xa01010 }); B(g, 1.32, 0.18, 0.3, red, 0, 0.92, 0); B(g, 0.3, 0.18, 1.02, red, 0, 0.92, 0); const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.3, r, 48), new THREE.MeshBasicMaterial({ color: 0x60ff90, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring); return g; }
// ---------------------------------------------------------------- the old battlefield
export function corpse(rnd) { // a fallen marine
  const g = new THREE.Group(), armor = mat(0x4a5560), cloth = mat([0x3a4a5a, 0x5a4a3a, 0x4a5a3a][(rnd() * 3) | 0]), b = new THREE.Group(); b.rotation.y = rnd() * 6; g.add(b);
  B(b, 0.62, 0.3, 0.9, cloth, 0, 0.18, 0); B(b, 0.5, 0.22, 0.4, armor, 0, 0.36, -0.1); S(b, 0.24, armor, 0, 0.22, -0.65, 1, 0.9, 1);
  const legs = rnd() * 0.6; B(b, 0.22, 0.2, 0.9, cloth, -0.15, 0.12, 0.85).rotation.y = legs; B(b, 0.22, 0.2, 0.9, cloth, 0.18, 0.12, 0.85).rotation.y = -legs * 0.5;
  B(b, 0.18, 0.16, 0.6, armor, -0.5, 0.12, -0.1).rotation.y = 1.2; B(b, 0.08, 0.12, 0.7, 0x2a2e34, 0.7, 0.08, 0.2).rotation.y = rnd() * 3;
  const blood = new THREE.Mesh(new THREE.CircleGeometry(0.9, 10), mat(0x3a0a08, { op: 0.6 })); blood.rotation.x = -Math.PI / 2; blood.position.y = 0.03; g.add(blood); return g;
}
export function carcass(rnd) { // a dead alien, long since dried out
  const g = new THREE.Group(), sk = mat(rnd() < 0.5 ? 0x3a2a40 : 0x4a3030), b = new THREE.Group(); b.rotation.set(0, rnd() * 6, Math.PI * 0.9); b.position.y = 0.5; g.add(b);
  const big = 0.8 + rnd() * 1.6; S(b, 0.6 * big, sk, 0, 0, 0, 1, 0.6, 1.5); S(b, 0.35 * big, sk, 0, 0, -0.9 * big);
  for (let i = 0; i < 6; i++) { const l = B(b, 0.08 * big, 0.8 * big, 0.08 * big, 0x1a1420, (i % 2 ? 1 : -1) * 0.5 * big, -0.3 * big, (i / 2 - 1) * 0.4 * big); l.rotation.z = (i % 2 ? 1 : -1) * (0.6 + rnd()); }
  const goo = new THREE.Mesh(new THREE.CircleGeometry(1.2 * big, 10), mat(0x2a5a10, { op: 0.6 })); goo.rotation.x = -Math.PI / 2; goo.position.y = 0.03; g.add(goo); return g;
}
export function tank(rnd) { { const mg = AS.propGLB('tank', rnd); if (mg) return mg; }
  const g = new THREE.Group(), hull = mat(0x4a5040, { r: 0.8, m: 0.3 }), burnt = mat(0x22201e, { r: 1 }), t = new THREE.Group(); t.rotation.set((rnd() - 0.5) * 0.2, rnd() * 6, (rnd() - 0.5) * 0.3); g.add(t);
  B(t, 3.4, 1.3, 6.2, rnd() < 0.5 ? hull : burnt, 0, 0.9, 0); for (const sd of [-1, 1]) { B(t, 0.9, 1.1, 6.6, 0x1a1a1a, sd * 2.1, 0.55, 0); for (let i = 0; i < 6; i++) C(t, 0.45, 0.45, 0.9, 0x2a2a2a, sd * 2.1, 0.5, -2.6 + i * 1.05).rotation.z = Math.PI / 2; }
  const tur = new THREE.Group(); tur.position.y = 1.9; tur.rotation.y = rnd() * 6; t.add(tur); B(tur, 2.4, 0.9, 2.6, burnt, 0, 0, 0); const gun = C(tur, 0.15, 0.18, 3.5, 0x2a2a2a, 0, 0.1, -2.6); gun.rotation.x = Math.PI / 2 - 0.15 - rnd() * 0.3;
  if (rnd() < 0.5) { tur.position.set(2.5, 0.6, 1.5); tur.rotation.z = 1.2; } return g;
}
export function mech(rnd) { { const mg = AS.propGLB('mech', rnd); if (mg) return mg; }
  const g = new THREE.Group(), m = mat(0x5a646e, { m: 0.5 }), dark = mat(0x2a2e34), r = new THREE.Group(); r.rotation.set(rnd() * 0.3, rnd() * 6, Math.PI / 2 * (rnd() < 0.6 ? 1 : 0.2)); r.position.y = 1.2; g.add(r);
  B(r, 2.2, 1.8, 1.8, m, 0, 2.2, 0); B(r, 1.4, 0.6, 0.4, 0x80c0e0, 0, 2.5, -0.9, { op: 0.7 }); for (const sd of [-1, 1]) { B(r, 0.6, 2.2, 0.7, dark, sd * 0.8, 0.6, 0); B(r, 0.9, 0.4, 1.3, dark, sd * 0.8, -0.5, -0.2); C(r, 0.25, 0.25, 1.6, 0x2a2a2a, sd * 1.5, 2.3, -0.8).rotation.x = Math.PI / 2; } return g;
}
export function sandbags(rnd) { const g = new THREE.Group(), m = mat(0x8a7a5a, { r: 1 }), n = 6 + (rnd() * 6 | 0), arc = 0.8 + rnd(); for (let row = 0; row < 3; row++) for (let i = 0; i < n - row; i++) { const a = (i + row * 0.5) / n * arc - arc / 2; const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 2, 6), m); sb.rotation.z = Math.PI / 2; sb.rotation.y = -a; sb.position.set(Math.sin(a) * 4, 0.22 + row * 0.38, -Math.cos(a) * 4 + 4); sb.castShadow = true; g.add(sb); } return g; }
export function tankTrap() { const g = new THREE.Group(), m = mat(0x3a3a3a, { m: 0.6 }); for (const [x, y, z] of [[0.8, 0, 0], [0, 0.8, 0], [0, 0, 0.8]]) { const b = B(g, 0.22, 2.2, 0.22, m, 0, 0.9, 0); b.rotation.set(x, y, z); } return g; }
export function deadTurret(rnd) { { const mg = AS.propGLB('deadTurret', rnd); if (mg) return mg; } const g = new THREE.Group(), m = mat(0x3e464e), burnt = mat(0x22201e); C(g, 0.9, 1.1, 0.4, m, 0, 0.2, 0); C(g, 0.35, 0.45, 0.9, burnt, 0, 0.8, 0); const h = B(g, 0.8, 0.55, 0.9, burnt, 0.6, 0.35, 0.8); h.rotation.set(0.4, rnd() * 3, 1.0); C(g, 0.05, 0.05, 1.1, 0x222222, 1.2, 0.1, 1.4).rotation.set(1.4, 0, 0.3); return g; }
export function burntCrate(rnd) { { const mg = AS.propGLB('burntCrate', rnd); if (mg) return mg; } const g = new THREE.Group(); for (let i = 0; i < 1 + (rnd() * 3 | 0); i++) { const c = B(g, 1.2, 1.0, 1.0, rnd() < 0.5 ? 0x2a2622 : 0x4a5a3a, (rnd() - 0.5) * 2.5, 0.5, (rnd() - 0.5) * 2.5); c.rotation.set(0, rnd() * 3, rnd() < 0.3 ? 1.2 : 0); } return g; }
export function flag(rnd) { const g = new THREE.Group(); const p = C(g, 0.05, 0.06, 4, 0x666666, 0, 2, 0); p.rotation.z = (rnd() - 0.5) * 0.4; const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8, 3, 1), mat(0x2a4a8a, { ds: true })); f.position.set(0.7, 3.5, 0); g.add(f); const pos = f.geometry.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 3) * 0.15); f.geometry.computeVertexNormals(); return g; }
export function hut() { // a heated shelter with an open doorway, a heater glowing inside
  const g = new THREE.Group(), wall = mat(0x8a96a2, { m: 0.3 }), roof = mat(0xd04a2a);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3, 16, 1, true, 0.35, 6.28 - 0.7), wall); shell.position.y = 1.5; shell.material.side = THREE.DoubleSide; g.add(shell);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.1, 16, 6, 0, 6.29, 0, 1.2), roof); dome.position.y = 3; dome.scale.y = 0.5; g.add(dome);
  B(g, 1, 1.2, 0.6, 0x3a3a3a, 0, 0.6, 2.4); B(g, 0.8, 0.5, 0.05, 0xff6020, 0, 0.8, 2.08, { e: 0xff4010, ei: 2 }); B(g, 3, 0.1, 1.4, 0x6a5040, 0, 0.5, -2.5);
  S(g, 0.2, 0xffd040, 0, 3.6, 0, 1, 1, 1, { e: 0xffa000, ei: 2 }); return g;
}
export function sniperNest(rnd) { const g = new THREE.Group(), sb = mat(0x7a6a4a, { r: 1 }); for (let i = 0; i < 12; i++) { if (i === 3) continue; const a = i / 12 * 6.283; for (let r = 0; r < 2; r++) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 2, 6), sb); b.rotation.z = Math.PI / 2; b.rotation.y = -a; b.position.set(Math.cos(a) * 2.2, 0.22 + r * 0.38, Math.sin(a) * 2.2); b.castShadow = true; g.add(b); } }
  B(g, 0.9, 0.5, 0.6, 0x4a5a3a, 0.8, 0.25, -0.6); B(g, 0.5, 0.35, 0.3, 0x3a4a2a, -0.6, 0.18, 0.7); const net = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5, 4, 4), mat(0x5a6a3a, { ds: true, op: 0.85 })); net.rotation.x = -Math.PI / 2 + 0.1; net.position.y = 2.2; g.add(net);
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) C(g, 0.04, 0.04, 2.2, 0x555555, x, 1.1, z); return g; }
export function watchtower() { // platform 7 m up on four legs, rails, a roof; stairs run along -z
  const g = new THREE.Group(), steel = mat(0x5a646e, { m: 0.5 }), dark = mat(0x2c3238), wood = mat(0x6a5a40);
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) B(g, 0.3, 7, 0.3, steel, x, 3.5, z); B(g, 4.8, 0.3, 4.8, wood, 0, 7, 0);
  for (const sd of [-1, 1]) { B(g, 4.8, 1, 0.1, dark, 0, 7.6, sd * 2.4); B(g, 0.1, 1, 4.8, dark, sd * 2.4, 7.6, 0); } B(g, 5.4, 0.2, 5.4, dark, 0, 10, 0); for (const [x, z] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) B(g, 0.12, 2.8, 0.12, steel, x, 8.5, z);
  const st = new THREE.Group(); st.position.set(0, 0, 2.4); g.add(st); for (let i = 0; i < 18; i++) { const f = (i + 0.5) / 18; B(st, 1.8, 0.15, 0.75, wood, 0, 7 * f, 13.2 * (1 - f)); }
  for (const sd of [-1, 1]) { const rail = B(st, 0.08, 0.08, 14.8, steel, sd * 0.95, 4.4, 6.6); rail.rotation.x = Math.atan2(7, 13.2); }
  S(g, 0.25, 0xffd070, 0, 9.7, 0, 1, 1, 1, { e: 0xffb040, ei: 2 }); return g; }
// the marine's left hand and forearm for the first-person view: fingers point along -z, the sleeve trails back along +z
export function hand(color) {
  const g = new THREE.Group(), glove = 0x23292f, pad = 0x3a434c;
  B(g, 0.09, 0.035, 0.1, glove, 0, 0, 0); B(g, 0.08, 0.012, 0.06, color, 0, 0.022, -0.005);
  for (let i = 0; i < 4; i++) { const f = new THREE.Group(); f.position.set(-0.033 + i * 0.022, 0, -0.05); f.rotation.x = -0.5; g.add(f); B(f, 0.019, 0.022, 0.035, glove, 0, 0, -0.017); const t = B(f, 0.018, 0.02, 0.03, pad, 0, -0.006, -0.045); t.rotation.x = -0.6; }
  const th = new THREE.Group(); th.position.set(0.05, -0.005, -0.01); th.rotation.set(0, -0.7, 0.3); g.add(th); B(th, 0.022, 0.022, 0.05, glove, 0, 0, -0.025);
  B(g, 0.085, 0.06, 0.06, pad, 0, -0.004, 0.07); C(g, 0.04, 0.045, 0.3, color, 0, -0.004, 0.25).rotation.x = Math.PI / 2; B(g, 0.055, 0.025, 0.1, 0x1a1e22, 0, 0.038, 0.19);
  g.traverse(o => { o.castShadow = false; }); return g;
}
export function throwModel(kind) { // what the marine holds on slot 4
  { const mg = AS.item(kind); if (mg) { mg.traverse(o => { o.castShadow = false; }); return mg; } }
  const g = new THREE.Group();
  if (kind === 'frag') { S(g, 0.07, 0x3a4a2a, 0, 0, 0, 1, 1.2, 1); B(g, 0.03, 0.05, 0.03, 0x888888, 0, 0.09, 0); C(g, 0.02, 0.02, 0.06, 0xc8a040, 0.03, 0.1, 0).rotation.z = Math.PI / 2; }
  else if (kind === 'claymore') { const b = B(g, 0.2, 0.13, 0.05, 0x3a4a2a, 0, 0, 0); b.rotation.x = -0.2; S(g, 0.015, 0xff2010, 0, 0.07, -0.02, 1, 1, 1, { e: 0xff0000, ei: 3 }); }
  else if (kind === 'medkit') { B(g, 0.2, 0.14, 0.12, 0xe8e8f0, 0, 0, 0); B(g, 0.12, 0.03, 0.125, 0xff3030, 0, 0.03, 0, { e: 0xa01010 }); B(g, 0.03, 0.1, 0.125, 0xff3030, 0, 0.03, 0, { e: 0xa01010 }); }
  else { B(g, 0.2, 0.14, 0.12, 0x4a5a3a, 0, 0, 0); B(g, 0.205, 0.03, 0.125, 0xe0b22e, 0, 0.04, 0, { e: 0x604000 }); }
  g.traverse(o => { o.castShadow = false; }); return g;
}
export function supplyPod() {
  const g = new THREE.Group(); B(g, 1.1, 0.9, 1.1, 0x50606a, 0, 0.45, 0, { m: 0.5 }); B(g, 1.15, 0.2, 1.15, 0xe0b22e, 0, 0.55, 0, { e: 0x604000 });
  C(g, 0.05, 0.05, 1.6, 0x888888, 0, 1.6, 0); S(g, 0.15, 0xffd040, 0, 2.4, 0, 1, 1, 1, { e: 0xffa000, ei: 2 }); return g;
}

// ---------------------------------------------------------------- scenery
export function prop(kind, rnd) {
  { const mg = AS.propGLB(kind, rnd); if (mg) return mg; }   // the Meshy rock, plant or crate when there is one
  const g = new THREE.Group();
  if (kind === 'rock') { const n = 1 + (rnd() * 3 | 0); for (let i = 0; i < n; i++) { const s = 0.8 + rnd() * 2.2; const m = S(g, s, rnd() < 0.5 ? 0x8a4428 : 0x6e3420, (rnd() - 0.5) * 3, s * 0.4, (rnd() - 0.5) * 3, 1, 0.6 + rnd() * 0.6, 1); m.rotation.y = rnd() * 6; } }
  else if (kind === 'ice') { const n = 2 + (rnd() * 3 | 0); for (let i = 0; i < n; i++) { const h = 1.5 + rnd() * 4; const m = K(g, 0.4 + rnd() * 0.6, h, 0xbfe4ff, (rnd() - 0.5) * 2.5, h / 2, (rnd() - 0.5) * 2.5, { m: 0.2, r: 0.1, e: 0x1a3050 }); m.rotation.set((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5); } }
  else if (kind === 'tree') { const h = 4 + rnd() * 5; C(g, 0.25, 0.4, h, 0x4a3220, 0, h / 2, 0); for (let i = 0; i < 3; i++) S(g, 1.6 + rnd() * 1.2, rnd() < 0.5 ? 0x2e6a26 : 0x3a8030, (rnd() - 0.5) * 1.5, h + i * 0.6 - 0.3, (rnd() - 0.5) * 1.5, 1, 0.7, 1); }
  else if (kind === 'crate') { B(g, 1.4, 1.4, 1.4, 0x5a6470, 0, 0.7, 0, { m: 0.3 }); B(g, 1.45, 0.2, 1.45, 0xe0b22e, 0, 1.0, 0); }
  else if (kind === 'dome') { C(g, 4.2, 4.4, 0.6, 0x6a747e, 0, 0.3, 0); const d = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8, 0, 6.29, 0, Math.PI / 2), mat(0x9ad0e0, { op: 0.45, e: 0x204050, m: 0.5, r: 0.1 })); d.position.y = 0.5; g.add(d); S(g, 1.2, 0x3a7a30, 0, 1, 0, 1, 0.8, 1); B(g, 1.2, 2, 0.4, 0x5a646e, 0, 1, 4.1); S(g, 0.25, 0xffd070, 0, 2.3, 4.2, 1, 1, 1, { e: 0xffa040 }); }
  else if (kind === 'derrick') { for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = B(g, 0.2, 9, 0.2, 0x4a4a52, a * 0.9, 4.5, b * 0.9); l.rotation.set(b * 0.08, 0, -a * 0.08); } for (let y = 1.5; y < 9; y += 2) B(g, 1.9 - y * 0.12, 0.12, 1.9 - y * 0.12, 0x6a6a72, 0, y, 0); B(g, 1.2, 1.2, 1.2, 0xc06020, 0, 0.6, 0); S(g, 0.25, 0xff4020, 0, 9.3, 0, 1, 1, 1, { e: 0xff2010 }); }
  else if (kind === 'dish') { C(g, 0.3, 0.5, 4, 0x8a96a2, 0, 2, 0); const d = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 6, 0, 6.29, 0, 1.0), mat(0xd8e4ee, { ds: true, m: 0.4 })); d.position.set(0, 4.4, 0); d.rotation.x = 2.3; g.add(d); C(g, 0.06, 0.06, 2, 0x404040, 0, 5, -0.6).rotation.x = 0.8; B(g, 2, 1.2, 1.6, 0x5a6670, 1.6, 0.6, 0); }
  else if (kind === 'spire') { const h = 6 + rnd() * 6; K(g, 1.2, h, 0x9fd8ff, 0, h / 2, 0, { e: 0x2060a0, m: 0.3, r: 0.1 }); K(g, 0.7, h * 0.6, 0xbfe8ff, 1, h * 0.3, 0.5, { e: 0x204060 }).rotation.z = -0.3; }
  else if (kind === 'shroom') { const h = 3 + rnd() * 4, c = [0x40ffd0, 0xc060ff, 0x60a0ff][(rnd() * 3) | 0]; C(g, 0.3, 0.45, h, 0xd8d0b0, 0, h / 2, 0); const cap = S(g, 1.6 + rnd(), c, 0, h, 0, 1, 0.45, 1, { e: c, ei: 0.8 }); cap.castShadow = false; for (let i = 0; i < 4; i++) S(g, 0.14, 0xffffff, Math.cos(i * 1.6) * 1.1, h + 0.5, Math.sin(i * 1.6) * 1.1, 1, 1, 1, { e: 0xffffff });  }
  else if (kind === 'boulder') { const n = 1 + (rnd() * 3 | 0); for (let i = 0; i < n; i++) { const r0 = 0.8 + rnd() * 2.4, m = new THREE.Mesh(new THREE.DodecahedronGeometry(r0, 1), mat(0x6a6058, { flat: false, r: 1 })); m.position.set((rnd() - 0.5) * 3, r0 * 0.5, (rnd() - 0.5) * 3); m.scale.set(1, 0.55 + rnd() * 0.5, 0.8 + rnd() * 0.4); m.rotation.set(rnd(), rnd() * 6, rnd()); m.castShadow = true; m.receiveShadow = true; g.add(m); } }
  else if (kind === 'tower') { B(g, 3, 6, 3, 0x6a747e, 0, 3, 0, { m: 0.3 }); B(g, 3.4, 0.4, 3.4, 0x3a424a, 0, 6.2, 0); S(g, 0.3, 0xff4040, 0, 6.8, 0, 1, 1, 1, { e: 0xff2020 }); }
  return g;
}
