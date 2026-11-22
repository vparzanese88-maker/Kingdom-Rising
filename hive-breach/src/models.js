// Low-poly models built from simple shapes. Materials and shapes are shared so hundreds of aliens stay cheap.
import * as THREE from 'three';

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
  const g = new THREE.Group(), dark = 0x2a2e34, metal = 0x5a626c;
  if (cls === 'heavy') { C(g, 0.11, 0.11, 0.9, dark, 0, 0, -0.25).rotation.x = Math.PI / 2; B(g, 0.16, 0.2, 0.3, color, 0, -0.04, 0.05); B(g, 0.06, 0.16, 0.08, dark, 0, -0.17, 0.08); C(g, 0.13, 0.13, 0.06, metal, 0, 0, -0.7).rotation.x = Math.PI / 2; B(g, 0.05, 0.08, 0.14, 0x40ff80, 0.1, 0.08, -0.1, { e: 0x20a040 }); }
  else if (cls === 'engineer') { B(g, 0.1, 0.13, 0.5, dark, 0, 0, -0.15); B(g, 0.11, 0.06, 0.3, color, 0, 0.09, -0.1); B(g, 0.05, 0.18, 0.06, dark, 0, -0.14, 0); C(g, 0.03, 0.03, 0.2, 0x40c0ff, 0, 0, -0.48, { e: 0x2080ff }).rotation.x = Math.PI / 2; B(g, 0.04, 0.2, 0.07, metal, 0, -0.14, -0.2); }
  else { B(g, 0.09, 0.14, 0.7, dark, 0, 0, -0.2); B(g, 0.1, 0.07, 0.36, color, 0, 0.1, -0.15); B(g, 0.06, 0.2, 0.08, dark, 0, -0.16, 0.02); B(g, 0.07, 0.22, 0.1, metal, 0, -0.16, -0.25); C(g, 0.025, 0.025, 0.2, metal, 0, 0, -0.62).rotation.x = Math.PI / 2; B(g, 0.03, 0.03, 0.05, 0xff4040, 0, 0.15, -0.3, { e: 0xff2020 }); }
  return g;
}
export function marine(color, cls) {
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
export function animMarine(m, t, sp) { const u = m.userData, a = Math.sin(t) * Math.min(1, sp / 4) * 0.8; u.legL.rotation.x = a; u.legR.rotation.x = -a; }

// ---------------------------------------------------------------- aliens
const SKIN = { crawler: 0x4a2a5e, spitter: 0x3a5a2a, brute: 0x5a3030, flyer: 0x2a4a5e, ravager: 0x7a1e1e, queen: 0x2e1a3e };
const GLOW = { crawler: 0x80ff40, spitter: 0xc0ff30, brute: 0xff8020, flyer: 0x40e0ff, ravager: 0xff3020, queen: 0xff40ff };
export function alien(type) {
  const g = new THREE.Group(), body = new THREE.Group(), sk = SKIN[type], gl = mat(GLOW[type], { e: GLOW[type], ei: 1.5 }), dk = 0x1a1420, legs = [];
  g.add(body);
  const leg = (x, y, z, len, th, side) => { const p = new THREE.Group(); p.position.set(x, y, z); body.add(p); const a = B(p, th, len, th, dk, 0, -len / 2, 0); a.rotation.z = side * 0.5; a.position.x = side * len * 0.24; legs.push(p); return p; };
  if (type === 'crawler') {
    S(body, 0.5, sk, 0, 0.55, 0.1, 1, 0.6, 1.5); S(body, 0.32, sk, 0, 0.6, -0.65, 1, 0.8, 1.1); S(body, 0.07, gl, -0.13, 0.68, -0.92); S(body, 0.07, gl, 0.13, 0.68, -0.92);
    K(body, 0.08, 0.5, 0x2a1a30, -0.15, 0.5, -0.95).rotation.x = -1.8; K(body, 0.08, 0.5, 0x2a1a30, 0.15, 0.5, -0.95).rotation.x = -1.8; K(body, 0.12, 0.8, dk, 0, 0.7, 0.8).rotation.x = 1.9;
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) leg(s * 0.4, 0.55, -0.3 + i * 0.35, 0.7, 0.07, s);
  } else if (type === 'spitter') {
    S(body, 0.45, sk, 0, 1.0, 0, 0.9, 1.2, 0.9); S(body, 0.5, gl, 0, 1.4, 0.35, 1, 1, 1, ); S(body, 0.3, sk, 0, 1.75, -0.2); S(body, 0.06, gl, -0.12, 1.82, -0.45); S(body, 0.06, gl, 0.12, 1.82, -0.45);
    C(body, 0.1, 0.18, 0.5, dk, 0, 1.65, -0.5).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) leg(s * 0.3, 0.75, 0, 0.8, 0.12, s);
  } else if (type === 'brute' || type === 'ravager') {
    const big = type === 'ravager' ? 1.7 : 1;
    S(body, 0.9, sk, 0, 1.3, 0, 1.2, 0.9, 1.3); S(body, 0.5, sk, 0, 1.4, -1.0, 1, 0.8, 1); B(body, 1.3, 0.3, 1.6, 0x3a2420, 0, 2.0, 0.1, { m: 0.3 });
    S(body, 0.09, gl, -0.2, 1.5, -1.45); S(body, 0.09, gl, 0.2, 1.5, -1.45);
    for (let i = 0; i < 4; i++) K(body, 0.16, 0.6, 0x2a1810, 0, 2.2, -0.6 + i * 0.45).rotation.x = 0.3;
    for (const s of [-1, 1]) { const a = leg(s * 0.95, 1.6, -0.6, 1.4, 0.3, s); S(a, 0.25, sk, s * 0.4, -1.3, -0.1); }
    for (const s of [-1, 1]) leg(s * 0.6, 0.9, 0.5, 0.9, 0.28, s);
    if (type === 'ravager') for (let i = 0; i < 5; i++) K(body, 0.18, 0.9, 0xd04030, (i - 2) * 0.35, 2.4, -0.4).rotation.z = (i - 2) * 0.3;
    g.scale.setScalar(big);
  } else if (type === 'flyer') {
    S(body, 0.4, sk, 0, 0, 0, 0.8, 0.7, 1.6); K(body, 0.12, 0.9, dk, 0, -0.05, 0.9).rotation.x = 1.6; S(body, 0.08, gl, -0.12, 0.1, -0.6); S(body, 0.08, gl, 0.12, 0.1, -0.6);
    const wm = mat(0x80c0e0, { op: 0.55, ds: true, e: 0x204060 });
    for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 0.25, 0.15, 0); body.add(p); const w = B(p, 1.4, 0.03, 0.6, wm, s * 0.7, 0, 0); w.castShadow = false; legs.push(p); }
  } else if (type === 'queen') {
    S(body, 1.6, sk, 0, 2.4, 1.2, 1.1, 0.9, 1.8); S(body, 1.1, sk, 0, 2.8, -1.2, 1, 1.1, 1); S(body, 0.8, gl, 0, 2.7, 3.2, 1.2, 1, 1.4);
    for (let i = 0; i < 7; i++) K(body, 0.25, 2.2, 0x1a0e24, (i - 3) * 0.5, 4.3, -1.6 + Math.abs(i - 3) * 0.3).rotation.x = -0.5 - Math.abs(i - 3) * 0.1;
    S(body, 0.16, gl, -0.4, 3.0, -2.2); S(body, 0.16, gl, 0.4, 3.0, -2.2); S(body, 0.12, gl, -0.2, 3.3, -2.15); S(body, 0.12, gl, 0.2, 3.3, -2.15);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) leg(s * 1.3, 2.4, -0.8 + i * 1.1, 2.6, 0.3, s);
    for (const s of [-1, 1]) { const c = leg(s * 0.8, 3.3, -1.6, 1.8, 0.25, s); c.rotation.x = -0.8; }
  }
  g.userData = { body, legs, type, fly: type === 'flyer' };
  return g;
}
export function animAlien(m, t) {
  const u = m.userData;
  if (u.fly) { u.legs.forEach((p, i) => p.rotation.z = Math.sin(t * 22) * 0.7 * (i ? 1 : -1)); u.body.position.y = Math.sin(t * 3) * 0.2; return; }
  u.legs.forEach((p, i) => { p.rotation.x = Math.sin(t * 9 + i * 1.7) * 0.5; });
  u.body.position.y = Math.abs(Math.sin(t * 9)) * 0.05;
}

// ---------------------------------------------------------------- turrets and defenses
export function turret(kind, color) {
  const g = new THREE.Group(), head = new THREE.Group(), dark = 0x2c3238, metal = 0x6a7480, base = 0x3e464e;
  const accent = mat(color, { m: 0.3 }), parts = {};
  if (kind !== 'barricade' && kind !== 'stasis' && kind !== 'repair') { C(g, 0.9, 1.1, 0.4, base, 0, 0.2, 0); C(g, 0.35, 0.45, 0.9, dark, 0, 0.8, 0); B(g, 1.6, 0.1, 0.25, accent, 0, 0.42, 0).rotation.y = 0.8; }
  if (kind === 'minigun') {
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
  } else if (kind === 'stasis') {
    C(g, 0.6, 0.8, 0.4, base, 0, 0.2, 0); C(g, 0.18, 0.25, 1.6, metal, 0, 1.2, 0); S(g, 0.3, 0x6080ff, 0, 2.1, 0, 1, 1, 1, { e: 0x4060ff, ei: 2 });
    head.position.y = 2.1; g.add(head); for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.12, 0.03, 4, 20), mat(0x80a0ff, { e: 0x4060ff })); r.rotation.x = Math.PI / 2 + i * 0.5; head.add(r); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(7.2, 7.5, 48), mat(0x6080ff, { e: 0x4060ff, op: 0.5, ds: true })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7.2, 48), mat(0x6080ff, { e: 0x203080, op: 0.12, ds: true })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; g.add(disc);
    parts.muzzle = new THREE.Vector3(0, 2.1, 0);
  }
  g.userData = { head, ...parts, kind };
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
  g.userData = { rings, core, shield };
  return g;
}
export function supplyPod() {
  const g = new THREE.Group(); B(g, 1.1, 0.9, 1.1, 0x50606a, 0, 0.45, 0, { m: 0.5 }); B(g, 1.15, 0.2, 1.15, 0xe0b22e, 0, 0.55, 0, { e: 0x604000 });
  C(g, 0.05, 0.05, 1.6, 0x888888, 0, 1.6, 0); S(g, 0.15, 0xffd040, 0, 2.4, 0, 1, 1, 1, { e: 0xffa000, ei: 2 }); return g;
}

// ---------------------------------------------------------------- scenery
export function prop(kind, rnd) {
  const g = new THREE.Group();
  if (kind === 'rock') { const n = 1 + (rnd() * 3 | 0); for (let i = 0; i < n; i++) { const s = 0.8 + rnd() * 2.2; const m = S(g, s, rnd() < 0.5 ? 0x8a4428 : 0x6e3420, (rnd() - 0.5) * 3, s * 0.4, (rnd() - 0.5) * 3, 1, 0.6 + rnd() * 0.6, 1); m.rotation.y = rnd() * 6; } }
  else if (kind === 'ice') { const n = 2 + (rnd() * 3 | 0); for (let i = 0; i < n; i++) { const h = 1.5 + rnd() * 4; const m = K(g, 0.4 + rnd() * 0.6, h, 0xbfe4ff, (rnd() - 0.5) * 2.5, h / 2, (rnd() - 0.5) * 2.5, { m: 0.2, r: 0.1, e: 0x1a3050 }); m.rotation.set((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5); } }
  else if (kind === 'tree') { const h = 4 + rnd() * 5; C(g, 0.25, 0.4, h, 0x4a3220, 0, h / 2, 0); for (let i = 0; i < 3; i++) S(g, 1.6 + rnd() * 1.2, rnd() < 0.5 ? 0x2e6a26 : 0x3a8030, (rnd() - 0.5) * 1.5, h + i * 0.6 - 0.3, (rnd() - 0.5) * 1.5, 1, 0.7, 1); }
  else if (kind === 'crate') { B(g, 1.4, 1.4, 1.4, 0x5a6470, 0, 0.7, 0, { m: 0.3 }); B(g, 1.45, 0.2, 1.45, 0xe0b22e, 0, 1.0, 0); }
  else if (kind === 'tower') { B(g, 3, 6, 3, 0x6a747e, 0, 3, 0, { m: 0.3 }); B(g, 3.4, 0.4, 3.4, 0x3a424a, 0, 6.2, 0); S(g, 0.3, 0xff4040, 0, 6.8, 0, 1, 1, 1, { e: 0xff2020 }); }
  return g;
}
