// Kingdom Rising 3D — every item as a 3D model, and its inventory icon rendered from that model.
// Shapes and colours are seeded by the item, so two different swords never look alike: blade outline,
// guard, grip wrap, pommel, gems, trim and wear all vary, and the metal shows the item's tier.
import { THREE, K3 } from './core.js';
import { MB } from './mb.js';

const KR = window.KR, D = KR.D;
const V2 = (x, y) => new THREE.Vector2(x, y);
// metal by tier: iron, steel, blued steel, gilded, mithril, adamant
const METAL = ['#8a8e94', '#c4c9d1', '#9ab4d8', '#e2c25a', '#cfe8ff', '#9affd0'];
const GEMS = ['#ff3a5a', '#3a8aff', '#3aff8a', '#c87aff', '#ffd84a', '#ff8a3a', '#7affff'];
function seedOf(it) { const s = String(it.uid || '') + (it.name || '') + (it.tier || 0); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];
const hueShift = (hex, R, amt = 0.08, lum = 0.12) => { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL((hsl.h + (R() - 0.5) * amt + 1) % 1, Math.min(1, hsl.s * (0.85 + R() * 0.3)), Math.max(0.04, Math.min(0.92, hsl.l + (R() - 0.5) * lum))); return '#' + c.getHexString(); };
function extrude(shape, depth, bevel = 0.006) { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 8 }); g.translate(0, 0, -depth / 2); return g; }
function lathe(pts, seg = 16) { return new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg); }
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

// ---------------------------------------------------------------- weapons (grip at the origin, blade along +y)
function bladeShape(kind, len, w, R) {
  const s = new THREE.Shape();
  if (kind === 'leaf') { s.moveTo(-w * 0.45, 0); s.quadraticCurveTo(-w * 0.75, len * 0.55, 0, len); s.quadraticCurveTo(w * 0.75, len * 0.55, w * 0.45, 0); }
  else if (kind === 'falchion') { s.moveTo(-w * 0.45, 0); s.lineTo(-w * 0.45, len * 0.9); s.quadraticCurveTo(-w * 0.3, len, 0, len); s.quadraticCurveTo(w * 1.1, len * 0.75, w * 0.55, 0); }
  else if (kind === 'sabre') { s.moveTo(-w * 0.4, 0); s.quadraticCurveTo(-w * 0.1, len * 0.6, w * 0.6, len); s.quadraticCurveTo(w * 0.7, len * 0.55, w * 0.5, 0); }
  else if (kind === 'flame') { s.moveTo(-w / 2, 0); const n = 6; for (let i = 1; i <= n; i++) s.lineTo((i % 2 ? -0.62 : -0.42) * w * (1 - i / (n + 2)), (len * 0.88 * i) / n); s.lineTo(0, len); for (let i = n; i >= 1; i--) s.lineTo((i % 2 ? 0.62 : 0.42) * w * (1 - i / (n + 2)), (len * 0.88 * i) / n); s.lineTo(w / 2, 0); }
  else if (kind === 'kris') { s.moveTo(-w / 2, 0); for (let i = 1; i <= 5; i++) s.quadraticCurveTo((i % 2 ? -0.9 : 0.1) * w, len * (i - 0.5) / 5.5, (i % 2 ? -0.2 : -0.5) * w * (1 - i / 7), len * i / 5.5); s.lineTo(0, len); for (let i = 5; i >= 1; i--) s.lineTo((i % 2 ? 0.2 : 0.5) * w * (1 - i / 7), len * i / 5.5 - len * 0.05); s.lineTo(w / 2, 0); }
  else { s.moveTo(-w / 2, 0); s.lineTo(-w * 0.43, len * 0.86); s.lineTo(0, len); s.lineTo(w * 0.43, len * 0.86); s.lineTo(w / 2, 0); }
  return s;
}
function hilt(mb, R, m, gold, grip, len, big) {
  const gs = pick(R, ['bar', 'curved', 'disk', 'wing']); const gw = (big ? 0.34 : 0.22) * (0.9 + R() * 0.3);
  if (gs === 'bar') mb.box('metal', 0, -0.012, 0, gw, 0.035, 0.05, gold);
  else if (gs === 'curved') for (const sx of [-1, 1]) mb.box('metal', sx * gw * 0.28, 0.005 + 0.02, 0, gw * 0.55, 0.03, 0.045, gold, 0, 0, sx * 0.35);
  else if (gs === 'disk') mb.cyl('metal', 0, -0.012, 0, gw * 0.32, 0.03, gold, 16);
  else { for (const sx of [-1, 1]) mb.add('metal', extrude(new THREE.Shape([V2(0, -0.02), V2(gw * 0.5, 0.05), V2(gw * 0.45, -0.01), V2(0.02, -0.04)]), 0.03, 0.004), M4(0, 0, 0, 0, sx > 0 ? 0 : Math.PI, 0), gold); }
  const gl = (big ? 0.3 : 0.17) * (0.9 + R() * 0.2); mb.cyl('leather', 0, -0.03 - gl / 2, 0, big ? 0.022 : 0.018, gl, grip, 10);
  for (let k = 0; k < 5; k++) mb.cyl('leather', 0, -0.04 - (k + 0.5) * gl / 5.5, 0, (big ? 0.024 : 0.02), 0.008, K3.shade(grip, -0.3), 10);
  const ps = pick(R, ['ball', 'disk', 'gem', 'claw']); const py = -0.05 - gl;
  if (ps === 'ball') mb.sph('metal', 0, py, 0, 0.055, 0.055, 0.055, gold);
  else if (ps === 'disk') mb.cyl('metal', 0, py, 0, 0.035, 0.022, gold, 14, null, 0, Math.PI / 2, 0);
  else { mb.sph('metal', 0, py, 0, 0.045, 0.05, 0.045, gold); mb.sph('glow', 0, py - 0.01, 0.0, 0.035, 0.035, 0.035, pick(R, GEMS)); }
}
function weapon(it, R) {
  const mb = new MB(); const t = Math.min(5, it.tier || 0); const m = hueShift(METAL[t], R, 0.02, 0.08); const gold = t >= 3 ? '#e2c25a' : pick(R, ['#8a7a5a', '#a08040', '#6a6e74', '#c8a040']);
  const grip = hueShift(pick(R, ['#3a2a1e', '#5a2a1a', '#2a2a3a', '#4a3a2a', '#1e2a1e']), R);
  const wt = it.wt;
  if (wt === '1HS' || (wt === '2HS' && !it.axe && !/axe|cleaver|executioner/i.test(it.name || ''))) {
    const big = wt === '2HS'; const len = (big ? 1.2 : 0.8) * (0.92 + R() * 0.16), w = (big ? 0.1 : 0.072) * (0.9 + R() * 0.3);
    const kind = big ? pick(R, ['straight', 'straight', 'flame', 'leaf']) : pick(R, ['straight', 'straight', 'leaf', 'falchion', 'sabre']);
    mb.add('metal', extrude(bladeShape(kind, len, w, R), 0.012, 0.006), M4(0, 0, 0), m);
    if (kind !== 'falchion' && kind !== 'sabre') mb.box('metalv', 0, len * 0.42, 0, w * 0.16, len * 0.72, 0.028, K3.shade(m, -0.25));
    if (t >= 2 || it.q > 1.1) for (let k = 0; k < 3; k++) mb.box('glow', 0, len * (0.2 + k * 0.12), 0.017, w * 0.08, 0.03, 0.002, it.fx ? '#ffaa44' : '#88ccff');
    hilt(mb, R, m, gold, grip, len, big);
  } else if (wt === '2HS' || it.axe) {
    mb.cyl('timber', 0, 0.45, 0, 0.022, 1.2, hueShift('#5a3a20', R), 8);
    const head = new THREE.Shape(); const hw = 0.26 + R() * 0.08, hh = 0.2 + R() * 0.08; head.moveTo(0, -0.08); head.quadraticCurveTo(hw * 0.6, -hh * 0.7, hw, -hh); head.quadraticCurveTo(hw * 1.15, 0, hw, hh); head.quadraticCurveTo(hw * 0.6, hh * 0.7, 0, 0.08);
    for (const sd of pick(R, [[1], [1, -1]])) mb.add('metal', extrude(head, 0.02), M4(0, 0.92, 0, 0, sd > 0 ? 0 : Math.PI, 0), m);
    mb.box('metalv', 0, 0.92, 0, 0.07, 0.16, 0.06, K3.shade(m, -0.3)); for (let k = 0; k < 3; k++) mb.cyl('leather', 0, 0.05 + k * 0.08, 0, 0.026, 0.03, grip, 8);
  } else if (wt === '1HB') {
    if (it.club || /club|cudgel/i.test(it.name || '')) { const g = new THREE.CylinderGeometry(0.075, 0.028, 0.7, 10, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const n = R(); p.setX(i, p.getX(i) * (0.85 + n * 0.3)); p.setZ(i, p.getZ(i) * (0.85 + n * 0.3)); } g.computeVertexNormals(); mb.add('timber', g, M4(0, 0.3, 0), hueShift('#7a5530', R)); }
    else {
      mb.cyl('timber', 0, 0.2, 0, 0.02, 0.56, hueShift('#4a3020', R), 8); for (let k = 0; k < 4; k++) mb.cyl('leather', 0, 0.02 + k * 0.035, 0, 0.024, 0.02, grip, 8);
      const style = pick(R, ['flanged', 'spiked', 'hammer']);
      if (style === 'flanged') { mb.sph('metal', 0, 0.52, 0, 0.11, 0.13, 0.11, m); for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.283; mb.add('metal', extrude(new THREE.Shape([V2(0, -0.07), V2(0.07, -0.04), V2(0.075, 0.05), V2(0, 0.08)]), 0.012, 0.003), M4(Math.cos(a) * 0.03, 0.52, Math.sin(a) * 0.03, 0, -a, 0), m); } }
      else if (style === 'spiked') { mb.sph('metal', 0, 0.54, 0, 0.15, 0.15, 0.15, m); for (let k = 0; k < 10; k++) { const a = R() * 6.283, b = (R() - 0.5) * 2.2; const d = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)); mb.add('metal', new THREE.ConeGeometry(0.018, 0.07, 6), new THREE.Matrix4().compose(d.clone().multiplyScalar(0.085).add(new THREE.Vector3(0, 0.54, 0)), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d), new THREE.Vector3(1, 1, 1)), K3.shade(m, 0.1)); } }
      else { mb.box('metal', 0.03, 0.5, 0, 0.2, 0.08, 0.08, m); mb.add('metal', new THREE.ConeGeometry(0.035, 0.12, 6), M4(-0.12, 0.5, 0, 0, 0, Math.PI / 2), m); mb.cyl('metal', 0.14, 0.5, 0, 0.045, 0.02, K3.shade(m, -0.2), 10, null, 0, 0, Math.PI / 2); }
    }
  } else if (wt === '2HB') {
    const caster = it.staff || /staff|rod|stave|wand/i.test(it.name || '') || R() < 0.5;
    if (caster) { mb.cyl('timber', 0, 0.55, 0, 0.022, 1.5, hueShift('#6a4a2a', R), 8); for (let k = 0; k < 3; k++) mb.cyl('gold', 0, 1.1 + k * 0.05, 0, 0.028, 0.015, gold, 8);
      const g = pick(R, GEMS); if (R() < 0.5) mb.sph('glow', 0, 1.36, 0, 0.11, 0.11, 0.11, g); else mb.add('glow', new THREE.OctahedronGeometry(0.07, 0), M4(0, 1.37, 0, 0, 0, 0), g);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.283; mb.rod('gold', new THREE.Vector3(0, 1.22, 0), new THREE.Vector3(Math.cos(a) * 0.07, 1.42, Math.sin(a) * 0.07), 0.008, gold); } }
    else { mb.cyl('timber', 0, 0.5, 0, 0.026, 1.2, hueShift('#4a3020', R), 8); mb.box('metal', 0, 1.08, 0, 0.32, 0.17, 0.17, m); mb.box('metalv', 0, 1.08, 0, 0.34, 0.04, 0.18, K3.shade(m, -0.3)); }
  } else if (wt === '1HP') {
    const len = 0.3 * (0.9 + R() * 0.3); mb.add('metal', extrude(bladeShape(pick(R, ['straight', 'leaf', 'kris']), len, 0.05, R), 0.01, 0.004), M4(0, 0, 0), m); hilt(mb, R, m, gold, grip, len, false);
  } else if (wt === 'H2H') {
    for (let k = 0; k < 4; k++) mb.cyl('metal', -0.06 + k * 0.04, 0.05, 0, 0.022, 0.03, m, 12, null, 0, Math.PI / 2, 0);
    mb.box('metal', 0, 0.02, 0, 0.17, 0.03, 0.03, m); mb.box('leather', 0, -0.03, 0, 0.14, 0.06, 0.04, grip);
    if (R() < 0.5) for (let k = 0; k < 3; k++) mb.add('metal', new THREE.ConeGeometry(0.012, 0.14, 6), M4(-0.04 + k * 0.04, 0.13, 0, 0, 0, 0), K3.shade(m, 0.1));
  } else if (wt === 'ARC') {
    const pts = []; const L = 0.62 + R() * 0.12, curve = 0.1 + R() * 0.08; for (let i = 0; i <= 16; i++) { const y = -L + (2 * L * i) / 16; const tip = Math.abs(y / L); pts.push(new THREE.Vector3(-curve * (1 - y * y / (L * L)) + (tip > 0.8 ? 0.04 * (tip - 0.8) / 0.2 : 0), y, 0)); }
    mb.add('timber', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.016, 6), M4(0, 0, 0), hueShift(pick(R, ['#7a5530', '#5a3a20', '#3a2a1e', '#8a6a3a']), R));
    mb.rod('leather', new THREE.Vector3(0.0, -L, 0), new THREE.Vector3(0.0, L, 0), 0.003, '#e8e0d0'); mb.cyl('leather', -curve, 0, 0, 0.022, 0.12, grip, 8);
  } else if (wt === 'THR') {
    if (/star/i.test(it.name || '') || R() < 0.33) { const s = new THREE.Shape(); for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283, r = k % 2 ? 0.035 : 0.1; if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(r, 0); } mb.add('metal', extrude(s, 0.008, 0.003), M4(0, 0, 0), m); }
    else for (let k = 0; k < 3; k++) { mb.add('metal', extrude(bladeShape('leaf', 0.16, 0.035, R), 0.006, 0.002), M4(-0.04 + k * 0.04, 0, k * 0.012, 0, 0, (k - 1) * 0.25), m); mb.cyl('leather', -0.04 + k * 0.04, -0.03, k * 0.012, 0.01, 0.06, grip, 6); }
  } else if (wt === 'TOME') {
    const c = hueShift(['#6a3a8a', '#3a5a9a', '#8a2a2a', '#2a6a5a', '#9a7a2a', '#2a2a4a'][t], R, 0.06);
    for (const sz of [-1, 1]) mb.box('leather', 0, 0.08, sz * 0.026, 0.2, 0.27, 0.011, c);
    mb.box('paint', 0.006, 0.08, 0, 0.188, 0.258, 0.042, '#eadfc4'); mb.cyl('leather', -0.1, 0.08, 0, 0.032, 0.27, K3.shade(c, -0.25), 10);
    for (const k of [-0.36, -0.12, 0.12, 0.36]) mb.cyl('gold', -0.1, 0.08 + k * 0.27, 0, 0.035, 0.01, gold, 10);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) mb.box('gold', sx * 0.084, 0.08 + sy * 0.119, 0.032, 0.034, 0.034, 0.004, gold);
    const em = pick(R, ['disk', 'star', 'eye']); if (em === 'star') { const s = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.283 + 1.57, r = k % 2 ? 0.02 : 0.05; if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } mb.add('gold', extrude(s, 0.004, 0.001), M4(0.01, 0.09, 0.034), gold); }
    else { mb.cyl('gold', 0.01, 0.09, 0.033, 0.05, 0.004, gold, 16, null, 0, Math.PI / 2, 0); if (em === 'eye') mb.sph('glow', 0.01, 0.09, 0.037, 0.04, 0.022, 0.01, pick(R, GEMS)); }
    mb.sph('glow', 0.01, 0.09, 0.04, 0.022, 0.022, 0.012, pick(R, GEMS));
  } else mb.box('metal', 0, 0.3, 0, 0.05, 0.6, 0.02, m);
  if (it.fx || it.proc) mb.sph('glow', 0, wt === 'ARC' ? 0 : 0.35, 0.03, 0.03, 0.03, 0.03, it.fx === 'fire' ? '#ff7a2a' : it.fx === 'storm' ? '#8ab0ff' : '#c8a8ff');
  return { mb, pose: wt === 'ARC' ? 'bow' : wt === 'TOME' || wt === 'H2H' || wt === 'THR' ? 'flat' : 'diag' };
}

// ---------------------------------------------------------------- shields
function shield(it, R) {
  const mb = new MB(); const t = Math.min(5, it.tier || 0); const wood = it.wood || t === 0;
  const field = hueShift(wood ? '#8a5a2e' : pick(R, ['#7a2a2a', '#28457a', '#2e6a3c', '#5a2a6a', '#c8a040', '#2a2a2a']), R); const charge = pick(R, ['#e8d8a8', '#e0c060', '#e8e8e8', '#1a1a1a']); const rim = METAL[Math.min(5, t + 1)];
  const shape = pick(R, wood ? ['round', 'heater'] : ['heater', 'heater', 'kite', 'round']);
  const s = new THREE.Shape();
  if (shape === 'round') { s.absarc(0, 0, 0.3, 0, Math.PI * 2, false); }
  else if (shape === 'kite') { s.moveTo(-0.24, 0.3); s.lineTo(0.24, 0.3); s.quadraticCurveTo(0.26, -0.05, 0, -0.42); s.quadraticCurveTo(-0.26, -0.05, -0.24, 0.3); }
  else { s.moveTo(-0.27, 0.3); s.lineTo(0.27, 0.3); s.lineTo(0.27, 0.02); s.quadraticCurveTo(0.24, -0.25, 0, -0.36); s.quadraticCurveTo(-0.24, -0.25, -0.27, 0.02); s.lineTo(-0.27, 0.3); }
  const g = extrude(s, 0.03, 0.012); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - (p.getX(i) ** 2) * 0.35); g.computeVertexNormals();
  mb.add(wood ? 'planks' : 'paint', g, M4(0, 0, 0), field);
  if (wood) for (let k = -2; k <= 2; k++) mb.box('timber', k * 0.11, 0, 0.02 - (k * 0.11) ** 2 * 0.35, 0.006, 0.6, 0.006, K3.shade(field, -0.3));
  else {
    const dev = pick(R, ['cross', 'chevron', 'pale', 'bend', 'lion']); const z = 0.022;
    if (dev === 'cross') { mb.box('paint', 0, 0, z, 0.08, 0.55, 0.004, charge); mb.box('paint', 0, 0.08, z, 0.48, 0.08, 0.004, charge); }
    else if (dev === 'chevron') for (const sd of [-1, 1]) mb.box('paint', sd * 0.1, 0.02, z, 0.3, 0.07, 0.004, charge, 0, 0, sd * 0.6);
    else if (dev === 'pale') mb.box('paint', 0, -0.02, z, 0.16, 0.6, 0.004, charge);
    else if (dev === 'bend') mb.box('paint', 0, 0, z, 0.08, 0.7, 0.004, charge, 0, 0, 0.7);
    else { const l = new THREE.Shape([V2(-0.08, -0.12), V2(0.08, -0.12), V2(0.1, 0.05), V2(0.04, 0.14), V2(-0.02, 0.1), V2(-0.1, 0.12), V2(-0.06, 0.02)]); mb.add('paint', extrude(l, 0.004, 0.001), M4(0, 0.02, z), charge); }
  }
  mb.sph('metal', 0, 0.02, 0.035, 0.09, 0.09, 0.05, rim);
  return { mb, pose: 'face' };
}

// ---------------------------------------------------------------- armour
function armour(it, R) {
  const mb = new MB(); const t = Math.min(5, it.tier || 0); const ak = it.ak;
  const plate = ak === 'plate', chain = ak === 'chain', leather = ak === 'leather', cloth = ak === 'cloth' || ak === 'misc';
  const m = plate ? hueShift(METAL[t], R, 0.02, 0.08) : chain ? hueShift(['#7a7e84', '#8e9298', '#a0a8b4', '#c8b070', '#b8d8ee', '#a8e8c8'][t], R, 0.02) : leather ? hueShift(['#6a4a2a', '#7a5532', '#5a3a2a', '#3a2a1e', '#2a3a4a', '#4a2a3a'][t], R, 0.05) : hueShift(it.fx === 'fire' ? '#b8401a' : it.fx === 'storm' ? '#3a5aa0' : ['#7a6a5a', '#3a4a8a', '#6a3a8a', '#2a6a5a', '#8a2a4a', '#2a2458'][t], R, 0.08);
  const trim = t >= 3 ? '#e2c25a' : plate ? K3.shade(m, -0.25) : leather ? '#2a1a10' : hueShift('#c8a040', R);
  const key = plate ? 'metal' : chain ? 'metal' : leather ? 'leather' : 'cloth2';
  const rivets = (pts) => { for (const [x, y, z] of pts) mb.sph('metal', x, y, z, 0.016, 0.016, 0.01, trim); };
  switch (it.slot) {
    case 'head': {
      if (plate) { const style = pick(R, ['great', 'sallet', 'nasal']);
        if (style === 'great') { mb.add('metal', lathe([[0.001, 0.32], [0.08, 0.31], [0.14, 0.27], [0.155, 0.2], [0.16, 0.0], [0.15, -0.05]], 18), M4(0, 0, 0), m); mb.box('dark', 0, 0.16, 0.15, 0.2, 0.025, 0.02, '#000'); for (let k = 0; k < 4; k++) mb.sph('dark', -0.05 + k * 0.035, 0.08, 0.155, 0.012, 0.012, 0.01, '#000'); mb.box('metal', 0, 0.12, 0.15, 0.02, 0.24, 0.02, trim); }
        else if (style === 'sallet') { mb.add('metal', lathe([[0.001, 0.3], [0.1, 0.28], [0.15, 0.2], [0.16, 0.08], [0.17, 0.0], [0.22, -0.06]], 18), M4(0, 0, 0, -0.2, 0, 0), m); mb.box('dark', 0, 0.14, 0.15, 0.22, 0.03, 0.03, '#000'); }
        else { mb.add('metal', lathe([[0.001, 0.32], [0.09, 0.3], [0.14, 0.22], [0.15, 0.06], [0.155, 0.0]], 18), M4(0, 0, 0), m); mb.box('metal', 0, 0.02, 0.15, 0.025, 0.16, 0.02, trim); }
        if (R() < 0.6) for (let k = 0; k < 6; k++) mb.sph('fur', 0, 0.36 + Math.sin((k / 5) * 2) * 0.03, 0.08 - k * 0.04, 0.05, 0.07, 0.05, pick(R, ['#b8302a', '#e8d070', '#e8e8e8', '#28457a']));
      } else if (chain) { mb.add('metal', lathe([[0.001, 0.3], [0.1, 0.28], [0.15, 0.2], [0.16, 0.05], [0.18, -0.12], [0.22, -0.18]], 18), M4(0, 0, 0), m); mb.box('dark', 0, 0.06, 0.16, 0.18, 0.14, 0.02, '#120e0a'); }
      else if (leather) { mb.add('leather', lathe([[0.001, 0.26], [0.1, 0.25], [0.15, 0.17], [0.16, 0.03], [0.17, 0.0]], 16), M4(0, 0, 0), m); mb.cyl('leather', 0, 0.02, 0, 0.17, 0.04, K3.shade(m, -0.3), 16); rivets([[0.12, 0.12, 0.1], [-0.12, 0.12, 0.1], [0, 0.18, 0.13]]); }
      else { const style = /mitre/i.test(it.name || '') ? 'mitre' : /circlet|crown|diadem/i.test(it.name || '') ? 'circlet' : pick(R, ['hood', 'wizard', 'cap']);
        if (style === 'circlet') { mb.add('gold', new THREE.TorusGeometry(0.14, 0.012, 8, 32), M4(0, 0.1, 0, Math.PI / 2 + 0.1, 0, 0), '#e2c25a'); mb.sph('glow', 0, 0.12, 0.14, 0.04, 0.04, 0.02, pick(R, GEMS)); }
        else if (style === 'wizard') { const g = new THREE.ConeGeometry(0.15, 0.45, 18, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.45 + 0.5; p.setZ(i, p.getZ(i) - y * y * 0.12); } g.computeVertexNormals(); mb.add('cloth2', g, M4(0, 0.26, 0), m); mb.cyl('cloth2', 0, 0.03, 0, 0.28, 0.02, m, 24); mb.cyl('cloth2', 0, 0.06, 0, 0.152, 0.04, trim, 18); }
        else if (style === 'mitre') { const s = new THREE.Shape(); s.moveTo(-0.14, 0); s.lineTo(-0.14, 0.12); s.quadraticCurveTo(-0.12, 0.26, 0, 0.32); s.quadraticCurveTo(0.12, 0.26, 0.14, 0.12); s.lineTo(0.14, 0); for (const sd of [1, -1]) mb.add('cloth2', extrude(s, 0.012, 0.004), M4(0, 0, sd * 0.05, sd * -0.12, 0, 0), m); mb.box('gold', 0, 0.15, 0.065, 0.03, 0.28, 0.006, '#e2c25a'); mb.cyl('gold', 0, 0.03, 0, 0.145, 0.05, '#e2c25a', 18); }
        else if (style === 'cap') { mb.add('cloth2', lathe([[0.001, 0.16], [0.1, 0.15], [0.15, 0.08], [0.16, 0.0]], 16), M4(0, 0, 0), m); mb.add('fur', new THREE.SphereGeometry(0.5, 8, 6), M4(0.12, 0.16, -0.04, 0, 0, 0.6, 0.06), '#f4f0e8'); }
        else { mb.add('cloth2', new THREE.SphereGeometry(0.17, 18, 12, Math.PI * 0.2, Math.PI * 1.6), M4(0, 0.06, 0, 0, Math.PI, 0), m); mb.add('cloth2', new THREE.ConeGeometry(0.06, 0.14, 8), M4(0, 0.12, -0.17, -1.2, 0, 0), m); }
      }
      return { mb, pose: 'face' };
    }
    case 'chest': {
      const style = cloth ? 'robe' : leather ? 'jerkin' : chain ? 'mail' : 'cuirass';
      const torso = (top, bot, depth) => { const pts = [[0.001, top], [0.12, top - 0.01], [0.2, top - 0.06], [0.21, top - 0.2], [0.17, (top + bot) / 2], [0.19, bot]]; const g = lathe(pts, 20); g.scale(1, 1, depth); return g; };
      if (style === 'robe') { const g = lathe([[0.001, 0.32], [0.11, 0.31], [0.19, 0.26], [0.18, 0.05], [0.2, -0.25], [0.25, -0.42]], 22); g.scale(1, 1, 0.6); mb.add('cloth2', g, M4(0, 0, 0), m); mb.box('cloth2', 0, -0.05, 0.12, 0.05, 0.7, 0.02, trim); mb.cyl('cloth2', 0, 0.0, 0, 0.19, 0.04, trim, 20); for (const sx of [-1, 1]) mb.add('cloth2', new THREE.CylinderGeometry(0.06, 0.1, 0.26, 12), M4(sx * 0.26, 0.16, 0, 0, 0, sx * 0.7), m); }
      else { mb.add(key, torso(0.3, -0.18, 0.62), M4(0, 0, 0), m);
        if (style === 'cuirass') { mb.box('metal', 0, 0.06, 0.13, 0.02, 0.36, 0.02, K3.shade(m, 0.15)); for (let k = 0; k < 3; k++) mb.box('metal', 0, -0.12 - k * 0.055, 0.11, 0.38, 0.05, 0.03, K3.shade(m, -0.05 * k)); for (const sx of [-1, 1]) { mb.add('metal', new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M4(sx * 0.22, 0.26, 0, 0, 0, sx * -0.4), m); mb.add('metal', new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M4(sx * 0.24, 0.22, 0, 0, 0, sx * -0.55, 0.95), K3.shade(m, -0.1)); } if (t >= 2) mb.add('gold', new THREE.TorusGeometry(0.05, 0.008, 6, 20), M4(0, 0.1, 0.135), '#e2c25a'); }
        if (style === 'mail') { mb.box('cloth2', 0, 0.02, 0.125, 0.16, 0.45, 0.012, hueShift(pick(R, ['#7a2a2a', '#28457a', '#2e6a3c', '#e8d8a8']), R)); mb.cyl('leather', 0, -0.14, 0, 0.2, 0.035, '#3a2618', 20); }
        if (style === 'jerkin') { for (let k = 0; k < 5; k++) mb.sph('metal', 0.02, 0.22 - k * 0.08, 0.13, 0.018, 0.018, 0.01, '#c8a040'); mb.box('leather', 0, 0.02, 0.125, 0.012, 0.45, 0.01, K3.shade(m, -0.3)); for (const sx of [-1, 1]) mb.add('leather', new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M4(sx * 0.22, 0.25, 0, 0, 0, sx * -0.5), K3.shade(m, -0.1)); }
      }
      return { mb, pose: 'face' };
    }
    case 'hands': {
      for (const sx of [-1, 1]) { const x = sx * 0.11; mb.add(key, new THREE.CylinderGeometry(0.06, 0.07, 0.16, 12), M4(x, -0.04, 0, 0, 0, sx * 0.1), plate ? m : K3.shade(m, -0.05)); mb.box(key, x, 0.07, 0.01, 0.1, 0.09, 0.05, m); for (let k = 0; k < 4; k++) mb.box(key, x - 0.035 + k * 0.024, 0.15, 0.01 + (plate ? 0.004 : 0), 0.018, 0.08, 0.03, plate ? K3.shade(m, 0.1) : m, 0, 0.2, 0); mb.box(key, x - sx * 0.06, 0.08, 0.03, 0.022, 0.06, 0.025, m, 0, 0, sx * 0.6); if (plate || t >= 2) mb.cyl('metal', x, -0.11, 0, 0.074, 0.025, trim, 12); }
      return { mb, pose: 'face' };
    }
    case 'legs': {
      for (const sx of [-1, 1]) { mb.add(key, new THREE.CylinderGeometry(0.085, 0.065, 0.5, 14), M4(sx * 0.09, -0.12, 0, 0, 0, sx * -0.04), m); if (plate) { mb.sph('metal', sx * 0.09, -0.09, 0.05, 0.12, 0.1, 0.09, K3.shade(m, 0.1)); } }
      mb.add(key, new THREE.CylinderGeometry(0.19, 0.17, 0.14, 18), M4(0, 0.15, 0), m); mb.cyl(plate ? 'metal' : 'leather', 0, 0.21, 0, 0.192, 0.035, trim, 18);
      return { mb, pose: 'face' };
    }
    case 'feet': {
      for (const sx of [-1, 1]) { const x = sx * 0.1; mb.add(key, new THREE.CylinderGeometry(0.06, 0.065, 0.22, 12), M4(x, 0.05, 0), m); mb.add(key, new THREE.SphereGeometry(0.5, 14, 10), M4(x, -0.07, 0.06, 0, 0, 0, 1), K3.shade(m, -0.05)); mb.box(key, x, -0.09, 0.03, 0.12, 0.05, 0.26, K3.shade(m, -0.1)); mb.box('leather', x, -0.12, 0.03, 0.125, 0.02, 0.27, '#1e140c'); if (plate) mb.cyl('metal', x, 0.15, 0, 0.068, 0.025, trim, 12); }
      return { mb, pose: 'side' };
    }
    case 'back': {
      const s = new THREE.Shape(); s.moveTo(-0.16, 0.28); s.lineTo(0.16, 0.28); s.quadraticCurveTo(0.26, -0.1, 0.24, -0.34); s.lineTo(0.08, -0.3); s.lineTo(0, -0.36); s.lineTo(-0.08, -0.3); s.lineTo(-0.24, -0.34); s.quadraticCurveTo(-0.26, -0.1, -0.16, 0.28);
      const g = extrude(s, 0.012, 0.004); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.sin(p.getX(i) * 22) * 0.012 - (p.getX(i) ** 2) * 0.5); g.computeVertexNormals();
      mb.add('cloth2', g, M4(0, 0, 0), m); mb.box('cloth2', 0, 0.28, 0.01, 0.34, 0.035, 0.02, trim); for (const sx of [-1, 1]) mb.sph('gold', sx * 0.15, 0.27, 0.025, 0.04, 0.04, 0.02, '#e2c25a');
      return { mb, pose: 'face' };
    }
    case 'waist': {
      const g = new THREE.TorusGeometry(0.18, 0.025, 6, 32); g.scale(1, 1, 0.55); mb.add('leather', g, M4(0, 0, 0, Math.PI / 2 - 0.5, 0, 0), leather || cloth ? m : '#3a2618');
      const bk = pick(R, ['square', 'round', 'plate']); if (bk === 'round') mb.add('gold', new THREE.TorusGeometry(0.04, 0.01, 6, 16), M4(0, -0.04, 0.1, 0.5, 0, 0), t >= 2 ? '#e2c25a' : '#9aa0a8'); else mb.box('metal', 0, -0.04, 0.1, bk === 'plate' ? 0.1 : 0.07, 0.07, 0.015, t >= 2 ? '#e2c25a' : '#9aa0a8', 0, 0.5, 0);
      if (R() < 0.5) mb.box('leather', 0.12, -0.08, 0.06, 0.06, 0.08, 0.04, K3.shade(m, -0.2)); // a pouch
      return { mb, pose: 'face' };
    }
    default: mb.box(key, 0, 0, 0, 0.3, 0.3, 0.1, m); return { mb, pose: 'face' };
  }
}
// ---------------------------------------------------------------- jewellery
function jewel(it, R) {
  const mb = new MB(); const t = Math.min(5, it.tier || 0); const band = t === 0 ? '#c87a4a' : t === 1 ? '#d0d6de' : '#e2c25a'; const gem = pick(R, GEMS);
  if (it.slot === 'ring') { mb.add('gold', new THREE.TorusGeometry(0.1, 0.022 + R() * 0.01, 10, 32), M4(0, 0, 0, 0.45, 0, 0), band); const cut = pick(R, ['round', 'oct', 'square']); mb.cyl('gold', 0, 0.12, 0, 0.035, 0.03, band, 10); if (cut === 'oct') mb.add('glow', new THREE.OctahedronGeometry(0.045, 0), M4(0, 0.155, 0, 0, 0.4, 0), gem); else if (cut === 'square') mb.box('glow', 0, 0.15, 0, 0.06, 0.04, 0.06, gem, 0.78); else mb.sph('glow', 0, 0.15, 0, 0.07, 0.06, 0.07, gem); }
  else { const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * (i / 24); pts.push(new THREE.Vector3(Math.cos(a) * 0.16, 0.18 - Math.sin(a) * 0.12 + 0.12, 0)); } mb.add('gold', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.reverse()), 40, 0.005, 5), M4(0, 0, 0, 0, 0, Math.PI), band);
    const pend = pick(R, ['disk', 'drop', 'star']); if (pend === 'drop') { mb.add('glow', new THREE.SphereGeometry(0.05, 14, 10), M4(0, -0.09, 0, 0, 0, 0), gem); mb.add('gold', new THREE.ConeGeometry(0.03, 0.05, 10), M4(0, -0.035, 0), band); }
    else { mb.cyl('gold', 0, -0.07, 0, 0.065, 0.015, band, 18, null, 0, Math.PI / 2, 0); mb.sph('glow', 0, -0.07, 0.012, 0.05, 0.05, 0.02, gem); if (pend === 'star') for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283; mb.add('gold', new THREE.ConeGeometry(0.012, 0.04, 6), M4(Math.cos(a) * 0.075, -0.07 + Math.sin(a) * 0.075, 0, 0, 0, a - Math.PI / 2), band); } } }
  return { mb, pose: 'face' };
}
// ---------------------------------------------------------------- everything else
function misc(it, R) {
  const mb = new MB(); const t = Math.min(5, it.tier || 0); const n = (it.name || '').toLowerCase();
  if (it.kind === 'gear' && it.tool) { const m = KR.Gear ? KR.Gear.TOOL_TIERS[it.ttier].col : '#9aa0a8';
    mb.cyl('timber', 0, 0.3, 0, 0.02, 0.8, hueShift('#6a4a2a', R), 8);
    if (it.tool === 'axe') { const s = new THREE.Shape([V2(0, -0.06), V2(0.15, -0.11), V2(0.18, 0), V2(0.15, 0.1), V2(0, 0.05)]); mb.add('metal', extrude(s, 0.02), M4(0, 0.64, 0), m); mb.box('metalv', -0.02, 0.64, 0, 0.06, 0.11, 0.05, K3.shade(m, -0.3)); }
    else if (it.tool === 'pick') { const g = new THREE.TorusGeometry(0.22, 0.02, 6, 20, Math.PI * 0.75); mb.add('metal', g, M4(0, 0.46, 0, 0, 0, Math.PI * 0.125), m); for (const sx of [-1, 1]) mb.add('metal', new THREE.ConeGeometry(0.02, 0.06, 6), M4(sx * 0.21, 0.63, 0, 0, 0, sx * -1.2), m); }
    else { mb.clear && mb.clear(); }
    if (it.tool === 'knife') { const m2 = new MB(); m2.add('metal', extrude(new THREE.Shape([V2(-0.022, 0), V2(0.03, 0), V2(0.04, 0.12), V2(0.0, 0.2), V2(-0.02, 0.1)]), 0.008, 0.003), M4(0, 0, 0), m); m2.cyl('timber', 0, -0.06, 0, 0.018, 0.12, hueShift('#5a3a20', R), 8); m2.cyl('metal', 0, -0.0, 0, 0.022, 0.012, '#c8a040', 8); return { mb: m2, pose: 'diag' }; }
    return { mb, pose: 'diag' };
  }
  if (it.kind === 'gear' && it.light) return { group: K3.lightModel ? K3.lightModel(it.light) : null, pose: 'stand' };
  if (it.kind === 'consumable') {
    const ct = it.ctype;
    if (ct === 'food' || ct === 'bread') { const f = ['bread', 'cheese', 'meat', 'pie', 'feast'][Math.min(4, t)]; if (f === 'bread') { mb.sph('paint', 0, 0, 0, 0.34, 0.16, 0.2, hueShift('#c8904a', R)); for (let k = 0; k < 3; k++) mb.box('paint', -0.08 + k * 0.08, 0.075, 0, 0.02, 0.01, 0.14, '#8a5a2a', 0.3); } else if (f === 'cheese') { mb.add('paint', new THREE.CylinderGeometry(0.15, 0.15, 0.1, 18, 1, false, 0, Math.PI * 1.6), M4(0, 0, 0), '#e8c850'); mb.cyl('paint', 0, 0.051, 0, 0.152, 0.004, '#d8a830', 18); } else if (f === 'meat') { mb.sph('paint', 0, 0, 0, 0.28, 0.16, 0.18, '#8a3a2a'); mb.cyl('paint', 0.18, 0, 0, 0.025, 0.14, '#efe6cc', 8, null, 0, 0, Math.PI / 2); mb.sph('paint', 0.25, 0, 0, 0.06, 0.06, 0.06, '#efe6cc'); } else { mb.cyl('paint', 0, 0, 0, 0.17, 0.08, '#c8904a', 18); mb.cyl('paint', 0, 0.045, 0, 0.155, 0.01, '#8a2a3a', 18); for (let k = 0; k < 4; k++) mb.box('paint', 0, 0.052, 0, 0.3, 0.008, 0.02, '#c8904a', (k * Math.PI) / 4); } return { mb, pose: 'stand' }; }
    if (ct === 'drink' || ct === 'heal' || ct === 'mana' || /potion|elixir|draught/.test(n)) { const col = ct === 'heal' ? '#ff3a3a' : ct === 'mana' ? '#3a7aff' : ['#8ac8ff', '#c8e8ff', '#9affc8', '#ffd84a', '#ff8ad8'][Math.min(4, t)];
      const shape = ct === 'drink' && t < 2 ? 'skin' : pick(R, ['round', 'tall', 'square']);
      if (shape === 'skin') { mb.sph('leather', 0, -0.02, 0, 0.22, 0.26, 0.14, hueShift('#7a5532', R)); mb.cyl('timber', 0, 0.14, 0, 0.025, 0.06, '#5a3a20', 8); }
      else { const prof = shape === 'round' ? [[0.001, -0.14], [0.08, -0.13], [0.12, -0.06], [0.11, 0.02], [0.035, 0.07], [0.03, 0.14]] : shape === 'tall' ? [[0.001, -0.16], [0.06, -0.15], [0.065, 0.06], [0.03, 0.1], [0.028, 0.16]] : [[0.001, -0.14], [0.09, -0.14], [0.09, 0.04], [0.03, 0.08], [0.028, 0.14]];
        mb.add('glass', lathe(prof, shape === 'square' ? 4 : 18), M4(0, 0, 0), '#e8f0ff'); mb.add('glow', lathe(prof.slice(0, -2).map(([r, y]) => [r * 0.88, Math.min(y, 0.02)]), shape === 'square' ? 4 : 18), M4(0, 0, 0), col); mb.cyl('timber', 0, prof[prof.length - 1][1] + 0.02, 0, 0.032, 0.05, '#8a6a3a', 8); }
      return { mb, pose: 'stand' }; }
    if (ct === 'ale') { mb.cylB('planks', 0, -0.12, 0, 0.1, 0.22, '#8a6a3a', 14); mb.cylB('gloss', 0, 0.08, 0, 0.095, 0.05, '#f4ead0', 14); mb.add('metal', new THREE.TorusGeometry(0.07, 0.015, 6, 14, Math.PI), M4(0.12, -0.01, 0, 0, 0, -Math.PI / 2), '#8a8e94'); return { mb, pose: 'stand' }; }
  }
  if (it.kind === 'mat') {
    const mt = it.mat;
    if (mt === 'metal') { const c = ['#c87a4a', '#9aa0a8', '#c8ccd4', '#e2c25a', '#cfe8ff', '#9affd0'][t]; for (const [x, y, z] of [[-0.08, 0, 0], [0.08, 0, 0], [0, 0.08, 0]]) { const g = new THREE.CylinderGeometry(0.06, 0.08, 0.32, 4); g.rotateY(Math.PI / 4); g.rotateZ(Math.PI / 2); mb.add('metal', g, M4(x, y, z), c); } return { mb, pose: 'face' }; }
    if (mt === 'hide') { const g = new THREE.PlaneGeometry(0.5, 0.4, 10, 8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setX(i, x * (1 - 0.15 * Math.cos(y * 9))); p.setZ(i, Math.sin(x * 9) * 0.03 + Math.cos(y * 7) * 0.02); } g.computeVertexNormals(); mb.add('fur', g, M4(0, 0, 0), ['#8a6a4a', '#6a4a2a', '#4a3a2a', '#5a7a5a', '#3a5a3a', '#2a2a3a'][t]); mb.add('leather', g, M4(0, 0, -0.01, 0, Math.PI, 0), '#c8a888'); return { mb, pose: 'face' }; }
    if (mt === 'cloth') { mb.cyl('cloth2', 0, 0, 0, 0.1, 0.42, hueShift(['#c8b898', '#8a3a3a', '#3a5a8a', '#6a3a8a', '#e8d070', '#2a2a4a'][t], R), 18, null, 0, 0, Math.PI / 2); mb.cyl('cloth2', 0.215, 0, 0, 0.1, 0.01, K3.shade('#c8b898', -0.2), 18, null, 0, 0, Math.PI / 2); return { mb, pose: 'face' }; }
    if (mt === 'arcane') { const c = ['#9ad8ff', '#c8a8ff', '#ff9ad8', '#9affc8', '#ffd84a', '#ff6a6a'][t]; for (let k = 0; k < 4; k++) mb.add('glow', new THREE.OctahedronGeometry(0.06 + R() * 0.04, 0), M4((R() - 0.5) * 0.18, (R() - 0.5) * 0.1, (R() - 0.5) * 0.1, R(), R(), R()), c); mb.sph('rock', 0, -0.08, 0, 0.3, 0.1, 0.2, '#5a5048'); return { mb, pose: 'face' }; }
  }
  // trophies, quest items, keys
  if (it.kind === 'key' || /key/.test(n)) { mb.add('gold', new THREE.TorusGeometry(0.06, 0.016, 8, 20), M4(0, 0.15, 0), '#c8a040'); mb.cyl('gold', 0, -0.02, 0, 0.016, 0.28, '#c8a040', 8); mb.box('gold', 0.03, -0.12, 0, 0.06, 0.03, 0.02, '#c8a040'); mb.box('gold', 0.025, -0.07, 0, 0.05, 0.025, 0.02, '#c8a040'); return { mb, pose: 'diag' }; }
  if (/pelt|fur|hide/.test(n)) return misc(Object.assign({}, it, { kind: 'mat', mat: 'hide' }), R);
  if (/tooth|fang|claw|horn|tusk/.test(n)) { for (let k = 0; k < 3; k++) mb.add('paint', new THREE.ConeGeometry(0.035, 0.22, 8), M4(-0.06 + k * 0.06, 0, 0, 0, 0, -0.3 + k * 0.3), '#efe6cc'); return { mb, pose: 'face' }; }
  if (/feather|plume|wing/.test(n)) { const s = new THREE.Shape(); s.moveTo(0, -0.2); s.quadraticCurveTo(0.12, 0, 0, 0.25); s.quadraticCurveTo(-0.08, 0, 0, -0.2); mb.add('cloth2', extrude(s, 0.004, 0.001), M4(0, 0, 0, 0, 0, 0.4), hueShift('#c8c0b0', R, 0.3, 0.3)); return { mb, pose: 'face' }; }
  if (/essence|dust|crystal|shard|orb|heart|eye/.test(n)) { mb.add('glow', new THREE.IcosahedronGeometry(0.1, 1), M4(0, 0, 0), pick(R, GEMS)); return { mb, pose: 'face' }; }
  if (/bone|skull/.test(n)) { mb.sph('paint', 0, 0.06, 0, 0.2, 0.2, 0.22, '#e8e0cc'); for (const sx of [-1, 1]) mb.sph('dark', sx * 0.04, 0.07, 0.1, 0.05, 0.05, 0.02, '#000'); mb.box('paint', 0, -0.06, 0.04, 0.1, 0.06, 0.08, '#e8e0cc'); return { mb, pose: 'face' }; }
  if (it.kind === 'quest' || /crate|letter|scroll|parcel|note/.test(n)) { if (/scroll|letter|note/.test(n)) { mb.cyl('paint', 0, 0, 0, 0.05, 0.36, '#efe6cc', 14, null, 0, 0, Math.PI / 2); mb.box('paint', 0, 0, 0.03, 0.03, 0.12, 0.01, '#8a2a2a'); } else { mb.box('planks', 0, 0, 0, 0.32, 0.24, 0.24, '#8a6a3a'); for (const y of [-0.08, 0.08]) mb.box('metalv', 0, y, 0.125, 0.33, 0.025, 0.01, '#4a4a50'); } return { mb, pose: 'face' }; }
  mb.sph('leather', 0, 0, 0, 0.24, 0.22, 0.2, hueShift('#7a5532', R)); mb.cyl('leather', 0, 0.11, 0, 0.04, 0.05, '#5a3a20', 8); // a pouch
  return { mb, pose: 'stand' };
}

// one model for any item: a THREE.Group, centred, with a suggested pose for display
export function itemModel(it) {
  const R = rng(seedOf(it));
  let r;
  if (it.kind === 'weapon') r = weapon(it, R);
  else if (it.kind === 'armor' && it.shield) r = shield(it, R);
  else if (it.kind === 'armor' && ['neck', 'ring', 'ear', 'finger'].includes(it.slot)) r = jewel(it, R);
  else if (it.kind === 'armor') r = armour(it, R);
  else if (it.kind === 'jewel') r = jewel(it, R);
  else r = misc(it, R);
  const g = r.group || (r.mb ? r.mb.build({ castShadow: false }) : new THREE.Group());
  return { group: g, pose: r.pose };
}

// ---------------------------------------------------------------- icons
// a photo studio to reflect in: a warm softbox above, a cool one to the side, a dark floor (metal needs
// something to reflect, or it renders black)
export function studioEnv(renderer) {
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16); const col = []; const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; const c = new THREE.Color().setRGB(0.05, 0.045, 0.04).lerp(new THREE.Color(0.55, 0.5, 0.45), Math.max(0, y) ** 0.7); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (w, h, x, y, z, c, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  box(8, 4, 2, 8, 4, '#fff1dc', 3); box(3, 6, -8, 2, -2, '#a8c8ff', 2.2); box(4, 2, 4, 1, 7, '#ffd8a8', 1.4);
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, 0.035); pm.dispose();
  return rt.texture;
}
let rr = null, scene, cam, holder; const cache = new Map();
function setup() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  rr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  rr.outputColorSpace = THREE.SRGBColorSpace; rr.toneMapping = THREE.ACESFilmicToneMapping; rr.toneMappingExposure = 1.45; rr.setClearColor(0x000000, 0);
  scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(24, 1, 0.05, 20); scene.environment = studioEnv(rr); scene.environmentIntensity = 1.1;
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a2018, 1.8));
  const key = new THREE.DirectionalLight(0xffeedd, 2.8); key.position.set(1.5, 2.5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ac0ff, 2.2); rim.position.set(-2.5, 1.2, -1.5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffc890, 0.8); fill.position.set(-2, -1, 2); scene.add(fill);
  holder = new THREE.Group(); scene.add(holder);
}
const POSE = { diag: [0.35, 0.5, -Math.PI / 4], bow: [0.2, 0.25, -Math.PI / 4], flat: [0.25, -0.35, -0.2], face: [0.2, -0.45, 0], side: [0.3, -1.0, 0], stand: [0.35, -0.5, 0] };
function sigOf(it) { return it.uid ? it.uid + '|' + (it.up || 0) + (it.lit === false ? 'u' : '') : JSON.stringify([it.kind, it.name, it.tier, it.wt, it.ak, it.slot, it.mat, it.ctype]); }
export function itemIcon(it) {
  const k = sigOf(it); const hit = cache.get(k); if (hit) return hit;
  try {
    if (!rr) setup();
    const { group, pose } = itemModel(it); if (!group) return null;
    const [rx, ry, rz] = POSE[pose] || POSE.face;
    holder.clear(); holder.rotation.set(0, 0, 0); holder.add(group);
    group.rotation.set(rx, ry, rz); group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group); const c = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3());
    group.position.sub(c);
    const r = Math.max(sz.x, sz.y, sz.z * 0.6) * 0.5 * (pose === 'diag' || pose === 'bow' ? 0.98 : 1.12); const d = r / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.set(0, 0, d); cam.lookAt(0, 0, 0); cam.near = d / 20; cam.far = d * 4; cam.updateProjectionMatrix();
    rr.render(scene, cam);
    const url = rr.domElement.toDataURL('image/png');
    group.traverse((o) => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); });
    holder.clear();
    if (cache.size > 600) cache.delete(cache.keys().next().value);
    cache.set(k, url); return url;
  } catch (e) { console.warn('icon failed', e); return null; }
}
K3.itemModel = itemModel; K3.itemIcon = itemIcon;

// the game's item pictures (inventory, bank, vendors, loot, tooltips) become these rendered icons
{
  const UI = KR.UI; const ic0 = UI.icHTML;
  UI.icHTML = function (it, small) {
    if (!it) return '';
    const src = itemIcon(it);
    if (src) return `<img class="iimg i3d${small ? ' sm' : ''}${it.unique ? ' uq' : it.proc ? ' pr' : ''}" src="${src}" alt="">`;
    return ic0.apply(this, arguments);
  };
}
