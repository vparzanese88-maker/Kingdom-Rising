// Kingdom Rising 3D — every item as a 3D model, and its inventory icon rendered from that model.
// Shapes and colours are seeded by the item, so two different swords never look alike: blade outline,
// guard, grip wrap, pommel, gems, trim and wear all vary, and the metal shows the item's tier.
import { THREE, K3 } from './core.js';
import { MB } from './mb.js';

const KR = window.KR, D = KR.D;
const V2 = (x, y) => new THREE.Vector2(x, y);
// metal by tier: iron, steel, blued steel, gilded, mithril, adamant
// accents for trims, stripes and emblems, and a floor on lightness so dark gear stays visible as an icon
const ACCENTS = ['#e2c25a', '#c83a2a', '#3a7ac8', '#3aa85a', '#e8e0cc', '#8a4ac8', '#e87a2a', '#2ab8b8', '#d84a8a', '#9aa0a8', '#c8a040', '#6ac8ff'];
function readable(hex, minL = 0.26) { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); if (hsl.l < minL) c.setHSL(hsl.h, Math.min(1, hsl.s * 0.9 + 0.05), minL + hsl.l * 0.25); return '#' + c.getHexString(); }
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
// Built flat in the x-y plane, edge or bit along +x, so the icon shows the face (held weapons are turned in weapons.js).
// Steel shows the tier: rusty iron, iron, steel, blued steel, mithril, adamant; fittings go from iron to brass to gold.
const STEEL = [
  { flat: '#7c6c60', edge: '#c0b4a6', dark: '#3e3028', rust: '#8a4a26' },
  { flat: '#8e9298', edge: '#dde1e6', dark: '#45484e' },
  { flat: '#aeb4bc', edge: '#f2f5f8', dark: '#565a62' },
  { flat: '#8ea4c4', edge: '#eef4ff', dark: '#36465e' },
  { flat: '#c8dcec', edge: '#ffffff', dark: '#5e7690' },
  { flat: '#7ad2b4', edge: '#effff8', dark: '#28584a' },
];
const FX_GLOW = { fire: '#ff8a2a', frost: '#9ad8ff', storm: '#9ab8ff', poison: '#8aff4a', shadow: '#b07aff', holy: '#ffe08a', nature: '#8aff8a' };
const steelOf = (t, R) => { const s = STEEL[Math.min(5, t)]; return { flat: hueShift(s.flat, R, 0.02, 0.06), edge: s.edge, dark: s.dark, rust: s.rust }; };
const fittingsOf = (t, R) => (t >= 3 ? pick(R, ['#e2c25a', '#d8b048', '#c8a040']) : t === 2 ? pick(R, ['#a8acb4', '#b8925a', '#9a9ea6']) : pick(R, ['#6a5a48', '#5a5e66', '#7a6a50']));
const woodOf = (R) => hueShift(pick(R, ['#6e5236', '#5a3e26', '#7a5a3a', '#4a3222', '#8a6a44']), R, 0.04, 0.1);
const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
// a honed edge: a thin bright rod along the outline, so the flat reads darker and worn against it
function edgeRim(mb, pts, dy, col, r, skipBase = true) {
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (skipBase && a.y < 0.004 && b.y < 0.004) continue; mb.rod('metalv', V3(a.x, a.y + dy), V3(b.x, b.y + dy), r, col, 5); }
}
// rust blooms on low-tier steel, glowing runes on enchanted or high-tier steel, nicks and scratches everywhere
function wear(mb, R, S, t, it, x0, x1, y0, y1, z) {
  if (t === 0 && S.rust) for (let k = 0; k < 6; k++) { const x = x0 + (x1 - x0) * R(), y = y0 + (y1 - y0) * R(); for (const sz of [-1, 1]) mb.sph('paint', x, y, sz * z, 0.02 + R() * 0.03, 0.025 + R() * 0.03, 0.003, hueShift(S.rust, R, 0.04, 0.1)); }
  for (let k = 0; k < 3; k++) { const x = x0 + (x1 - x0) * R(), y = y0 + (y1 - y0) * R(); mb.box('metalv', x, y, (R() < 0.5 ? -1 : 1) * z, 0.002, 0.03 + R() * 0.05, 0.001, S.edge, 0, 0, (R() - 0.5) * 1.2); }
  const glow = it.fx ? FX_GLOW[it.fx] || '#c8a8ff' : t >= 4 ? (t === 5 ? '#7affd0' : '#9ad8ff') : null;
  if (glow) { const n = 4 + Math.floor(R() * 3); for (let k = 0; k < n; k++) for (const sz of [-1, 1]) { const y = y0 + (y1 - y0) * (0.15 + 0.7 * k / n); mb.box('glow', (x0 + x1) / 2, y, sz * (z + 0.001), 0.012, 0.022, 0.002, glow, 0, 0, (k % 2 ? 0.5 : -0.5) * R()); mb.box('glow', (x0 + x1) / 2 + 0.008, y + 0.008, sz * (z + 0.001), 0.012, 0.004, 0.002, glow); } }
}
function bladeShape(kind, len, w, R) {
  const s = new THREE.Shape();
  if (kind === 'leaf') { s.moveTo(-w * 0.45, 0); s.quadraticCurveTo(-w * 0.75, len * 0.55, 0, len); s.quadraticCurveTo(w * 0.75, len * 0.55, w * 0.45, 0); }
  else if (kind === 'falchion') { s.moveTo(-w * 0.45, 0); s.lineTo(-w * 0.45, len * 0.9); s.quadraticCurveTo(-w * 0.3, len, 0, len); s.quadraticCurveTo(w * 1.1, len * 0.75, w * 0.55, 0); }
  else if (kind === 'sabre') { s.moveTo(-w * 0.4, 0); s.quadraticCurveTo(-w * 0.1, len * 0.6, w * 0.6, len); s.quadraticCurveTo(w * 0.7, len * 0.55, w * 0.5, 0); }
  else if (kind === 'flame') { s.moveTo(-w / 2, 0); const n = 6; for (let i = 1; i <= n; i++) s.lineTo((i % 2 ? -0.62 : -0.42) * w * (1 - i / (n + 2)), (len * 0.88 * i) / n); s.lineTo(0, len); for (let i = n; i >= 1; i--) s.lineTo((i % 2 ? 0.62 : 0.42) * w * (1 - i / (n + 2)), (len * 0.88 * i) / n); s.lineTo(w / 2, 0); }
  else if (kind === 'kris') { s.moveTo(-w / 2, 0); for (let i = 1; i <= 5; i++) s.quadraticCurveTo((i % 2 ? -0.9 : 0.1) * w, len * (i - 0.5) / 5.5, (i % 2 ? -0.2 : -0.5) * w * (1 - i / 7), len * i / 5.5); s.lineTo(0, len); for (let i = 5; i >= 1; i--) s.lineTo((i % 2 ? 0.2 : 0.5) * w * (1 - i / 7), len * i / 5.5 - len * 0.05); s.lineTo(w / 2, 0); }
  else if (kind === 'clip') { s.moveTo(-w / 2, 0); s.lineTo(-w * 0.5, len * 0.62); s.quadraticCurveTo(-w * 0.2, len * 0.8, 0, len); s.lineTo(w * 0.45, len * 0.8); s.lineTo(w / 2, 0); }
  else { s.moveTo(-w / 2, 0); s.lineTo(-w * 0.43, len * 0.86); s.lineTo(0, len); s.lineTo(w * 0.43, len * 0.86); s.lineTo(w / 2, 0); }
  return s;
}
// guard, wrapped grip, ferrule and pommel; returns the middle of the grip, where the hand closes
function hilt(mb, R, S, fit, grip, t, big, k = 1) {
  const gw = (big ? 0.32 : 0.21) * (0.9 + R() * 0.3) * k; const gh = 0.026 * Math.max(0.7, k);
  const gs = pick(R, k < 1 ? ['quillon', 'curved', 'disk', 'stub'] : ['quillon', 'quillon', 'curved', 'disk', 'wing', 'cross']);
  if (gs === 'quillon' || gs === 'cross') { mb.box('metalv', 0, 0, 0, gw, gh, 0.038 * Math.max(0.7, k), fit); for (const sx of [-1, 1]) { mb.sph('metalv', sx * gw / 2, 0.004, 0, 0.034 * k + 0.008, 0.034 * k + 0.008, 0.034 * k + 0.008, K3.shade(fit, 0.1)); } mb.box('metalv', 0, 0.026 * k, 0, 0.026 * k, 0.04 * k, 0.03 * k, K3.shade(fit, -0.15)); if (gs === 'cross') for (const sz of [-1, 1]) mb.box('metalv', 0, 0.0, sz * 0.03 * k, 0.03 * k, 0.03 * k, 0.03 * k, fit); }
  else if (gs === 'curved') { for (const sx of [-1, 1]) { let prev = V3(0, 0); for (let j = 1; j <= 4; j++) { const u = j / 4; const p = V3(sx * gw * 0.5 * u, 0.045 * u * u * (big ? 1.3 : 1)); mb.rod('metalv', prev, p, (0.013 - 0.003 * u) * Math.max(0.7, k), fit, 6); prev = p; } mb.sph('metalv', prev.x, prev.y, 0, 0.026 * k, 0.026 * k, 0.026 * k, K3.shade(fit, 0.1)); } mb.box('metalv', 0, 0, 0, 0.05 * k, gh * 1.2, 0.04 * k, fit); }
  else if (gs === 'disk') { mb.cyl('metalv', 0, 0, 0, gw * 0.3, gh, fit, 16); mb.cyl('metalv', 0, gh * 0.6, 0, gw * 0.24, gh * 0.4, K3.shade(fit, -0.15), 16); }
  else if (gs === 'stub') mb.box('metalv', 0, 0, 0, gw * 0.7, gh, 0.034 * k, fit);
  else { for (const sx of [-1, 1]) mb.add('metalv', extrude(new THREE.Shape([V2(0, -0.02), V2(gw * 0.5, 0.05), V2(gw * 0.45, -0.01), V2(0.02, -0.035)]), 0.026, 0.004), M4(0, 0, 0, 0, sx > 0 ? 0 : Math.PI, 0), fit); }
  const gl = (big ? 0.28 : 0.16) * (0.9 + R() * 0.2) * (k < 1 ? 0.72 : 1), gr = (big ? 0.021 : 0.0165) * Math.max(0.82, k);
  mb.cyl('leather', 0, -gh / 2 - gl / 2, 0, gr, gl, grip, 10);
  const n = Math.max(4, Math.round(gl / 0.017)); for (let j = 0; j < n; j++) mb.cyl('leather', 0, -gh / 2 - (j + 0.5) * gl / n, 0, gr * 1.1, gl / n * 0.62, K3.shade(grip, j % 2 ? -0.28 : 0.06), 10, null, 0, 0, 0.32); // a spiral wrap
  if (t >= 3) for (let j = 0; j < n; j += 2) mb.cyl('gold', 0, -gh / 2 - (j + 1) * gl / n, 0, gr * 1.14, 0.004, fit, 10, null, 0, 0, -0.32); // gilt wire over the wrap
  const fy = -gh / 2 - gl; mb.cyl('metalv', 0, fy - 0.008, 0, gr * 1.3, 0.016, fit, 12);
  const ps = pick(R, ['wheel', 'stopper', 'faceted', 'gem', 'ball']); const pk = Math.min(1, k * 1.15), py = fy - 0.016 - 0.03 * pk;
  if (ps === 'wheel') { mb.cyl('metalv', 0, py, 0, 0.036 * pk, 0.024 * pk, fit, 18, null, 0, Math.PI / 2, 0); mb.cyl('metalv', 0, py, 0, 0.018 * pk, 0.03 * pk, K3.shade(fit, -0.2), 12, null, 0, Math.PI / 2, 0); }
  else if (ps === 'stopper') { mb.sph('metalv', 0, py + 0.006, 0, 0.05 * pk, 0.04 * pk, 0.05 * pk, fit); mb.add('metalv', new THREE.ConeGeometry(0.025 * pk, 0.05 * pk, 10), M4(0, py - 0.03 * pk, 0, Math.PI, 0, 0), fit); }
  else if (ps === 'faceted') mb.add('metalv', new THREE.OctahedronGeometry(0.034 * pk, 0), M4(0, py, 0, 0, R() * 3, 0, 1), fit);
  else if (ps === 'gem') { mb.sph('metalv', 0, py, 0, 0.05 * pk, 0.055 * pk, 0.05 * pk, fit); mb.sph('glow', 0, py - 0.004, 0.02 * pk, 0.03 * pk, 0.03 * pk, 0.02 * pk, pick(R, GEMS)); }
  else mb.sph('metalv', 0, py, 0, 0.052 * pk, 0.052 * pk, 0.052 * pk, fit);
  return -gh / 2 - gl / 2;
}
// a blade above the guard: bevelled core, ricasso, fullers on both faces, honed edges, wear and runes
function blade(mb, R, S, t, it, len, w, th, kind) {
  const shape = bladeShape(kind, len, w, R); const dy = 0.034;
  mb.add('metal', extrude(shape, th, 0.0055), M4(0, dy, 0), S.flat);
  mb.box('metalv', 0, 0.017, 0, w * 0.92, 0.034, th + 0.006, S.dark); // the ricasso
  const straight = kind === 'straight' || kind === 'leaf' || kind === 'flame' || kind === 'clip';
  if (straight) for (const sz of [-1, 1]) mb.box('metalv', 0, dy + len * 0.36, sz * (th / 2 + 0.0042), w * 0.2, len * 0.58, 0.0016, K3.shade(S.flat, -0.35));
  edgeRim(mb, shape.getPoints(kind === 'straight' ? 1 : 6), dy, S.edge, Math.max(0.0032, th * 0.42));
  wear(mb, R, S, t, it, -w * 0.25, w * 0.25, dy + len * 0.12, dy + len * 0.75, th / 2 + 0.0052);
}
function weapon(it, R) {
  const mb = new MB(); const t = Math.min(5, it.tier || 0); const S = steelOf(t, R); const fit = fittingsOf(t, R);
  const grip = hueShift(pick(R, ['#3a2a1e', '#5a2a1a', '#2a2a3a', '#4a3a2a', '#1e2a1e', '#6a4a2a']), R);
  const wt = it.wt, nm = (it.name || '').toLowerCase();
  const isAxe = !!it.axe || /axe|cleaver|executioner|hatchet|bardiche/.test(nm);
  if ((wt === '1HS' || wt === '2HS') && !isAxe) {
    const big = wt === '2HS'; const len = (big ? 1.12 : 0.76) * (0.92 + R() * 0.16), w = (big ? 0.086 : 0.064) * (0.9 + R() * 0.28), th = big ? 0.013 : 0.01;
    const kind = big ? pick(R, ['straight', 'straight', 'flame', 'leaf']) : pick(R, ['straight', 'straight', 'leaf', 'falchion', 'sabre', 'clip']);
    blade(mb, R, S, t, it, len, w, th, kind);
    mb.gripY = hilt(mb, R, S, fit, grip, t, big);
  } else if (wt === '1HP') {
    const len = 0.25 * (0.9 + R() * 0.25), w = 0.045 * (0.9 + R() * 0.3);
    blade(mb, R, S, t, it, len, w, 0.008, pick(R, ['straight', 'leaf', 'kris', 'clip']));
    mb.gripY = hilt(mb, R, S, fit, grip, t, false, 0.58);
  } else if (isAxe) {
    // a bearded axe: tapered haft, wrapped grip and butt cap, iron socket and langets, a wedge-section head with a honed edge
    const big = wt === '2HS'; const L = big ? 1.18 : 0.76; const hr = big ? 0.024 : 0.019; const wood = woodOf(R);
    mb.cyl('haft', 0, L / 2 - 0.16, 0, hr, L, wood, 10, hr * 0.82);
    for (let k = 0; k < 3; k++) mb.box('haft', hr * 0.55, L * (0.12 + k * 0.25) - 0.16, hr * 0.5, 0.003, L * 0.18, 0.003, K3.shade(wood, -0.25)); // grain
    const gl = big ? 0.3 : 0.2; for (let j = 0; j < 9; j++) mb.cyl('leather', 0, -0.13 + j * gl / 9, 0, hr * 1.18, gl / 9 * 0.62, K3.shade(grip, j % 2 ? -0.25 : 0.05), 10, null, 0, 0, 0.3);
    mb.cyl('metalv', 0, -0.16 - 0.01, 0, hr * 1.25, 0.03, S.dark, 10); mb.sph('metalv', 0, -0.19, 0, hr * 2.2, hr * 1.6, hr * 2.2, S.dark);
    const hy = L - 0.26; const sock = hr * 1.75;
    mb.cyl('metalv', 0, hy, 0, sock, big ? 0.15 : 0.11, S.dark, 12); mb.cyl('metalv', 0, hy + (big ? 0.08 : 0.06), 0, sock * 0.9, 0.012, S.flat, 12);
    for (const sz of [-1, 1]) mb.box('metalv', 0, hy - (big ? 0.17 : 0.12), sz * hr * 1.02, hr * 0.9, big ? 0.22 : 0.16, 0.004, S.dark); // langets
    const hw = (big ? 0.25 : 0.16) * (0.9 + R() * 0.25), hh = (big ? 0.15 : 0.1) * (0.9 + R() * 0.3), beard = 1 + R() * 0.5;
    const head = new THREE.Shape(); head.moveTo(sock * 0.8, hh * 0.32); head.quadraticCurveTo(hw * 0.45, hh * 0.35, hw * 0.92, hh); head.quadraticCurveTo(hw * 1.16, 0, hw * 0.9, -hh * beard); head.quadraticCurveTo(hw * 0.55, -hh * beard * 0.8, hw * 0.38, -hh * 0.5); head.quadraticCurveTo(hw * 0.25, -hh * 0.3, sock * 0.8, -hh * 0.35); head.closePath();
    const hg = extrude(head, big ? 0.024 : 0.018, 0.004); const p = hg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 - 0.72 * Math.min(1, Math.max(0, p.getX(i) / hw)))); hg.computeVertexNormals(); // a wedge: thick at the socket, thin at the edge
    const poll = pick(R, big ? ['spike', 'hammer', 'double', 'none'] : ['spike', 'hammer', 'none', 'none']);
    mb.add('metal', hg, M4(0, hy, 0), S.flat);
    edgeRim(mb, new THREE.QuadraticBezierCurve(V2(hw * 0.92, hh), V2(hw * 1.16, 0), V2(hw * 0.9, -hh * beard)).getPoints(10), hy, S.edge, big ? 0.0045 : 0.0036, false);
    if (poll === 'double') { const hg2 = hg.clone(); mb.add('metal', hg2, M4(0, hy, 0, 0, Math.PI, 0), S.flat); edgeRim(mb, new THREE.QuadraticBezierCurve(V2(-hw * 0.92, hh), V2(-hw * 1.16, 0), V2(-hw * 0.9, -hh * beard)).getPoints(10), hy, S.edge, 0.0045, false); }
    else if (poll === 'spike') mb.add('metalv', new THREE.ConeGeometry(sock * 0.75, hw * 0.55, 8), M4(-sock - hw * 0.25, hy, 0, 0, 0, Math.PI / 2), S.dark);
    else if (poll === 'hammer') mb.box('metalv', -sock - 0.03, hy, 0, 0.06, hh * 0.55, sock * 1.6, S.dark);
    wear(mb, R, S, t, it, hw * 0.35, hw * 0.75, hy - hh * 0.4, hy + hh * 0.5, (big ? 0.012 : 0.009) * 0.6);
  } else if (wt === '1HB') {
    if (it.club || /club|cudgel|branch/.test(nm)) {
      const wood = woodOf(R); const g = new THREE.CylinderGeometry(0.075, 0.028, 0.7, 10, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const n = 0.82 + R() * 0.32; p.setX(i, p.getX(i) * n); p.setZ(i, p.getZ(i) * n); } g.computeVertexNormals(); mb.add('haft', g, M4(0, 0.3, 0), wood);
      for (let k = 0; k < 7; k++) { const a = R() * 6.283, y = 0.42 + R() * 0.2; mb.add('metalv', new THREE.ConeGeometry(0.012, 0.04, 6), new THREE.Matrix4().compose(V3(Math.cos(a) * 0.062, y, Math.sin(a) * 0.062), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(Math.cos(a), 0.2, Math.sin(a)).normalize()), V3(1, 1, 1)), S.dark); }
      for (let j = 0; j < 6; j++) mb.cyl('leather', 0, 0.02 + j * 0.03, 0, 0.032, 0.018, K3.shade(grip, j % 2 ? -0.25 : 0.05), 10, null, 0, 0, 0.3);
    } else {
      const wood = woodOf(R); mb.cyl('haft', 0, 0.22, 0, 0.019, 0.56, wood, 10, 0.017);
      for (let j = 0; j < 8; j++) mb.cyl('leather', 0, -0.04 + j * 0.024, 0, 0.022, 0.015, K3.shade(grip, j % 2 ? -0.25 : 0.05), 10, null, 0, 0, 0.3);
      mb.sph('metalv', 0, -0.07, 0, 0.05, 0.045, 0.05, fit); for (const y of [0.18, 0.36]) mb.cyl('metalv', 0, y, 0, 0.023, 0.016, fit, 10);
      const style = /hammer|maul/.test(nm) ? 'hammer' : /star/.test(nm) ? 'spiked' : pick(R, ['flanged', 'spiked', 'hammer', 'flanged']);
      if (style === 'flanged') { mb.cyl('metalv', 0, 0.52, 0, 0.034, 0.16, S.dark, 10); for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.283; mb.add('metal', extrude(new THREE.Shape([V2(0, -0.08), V2(0.06, -0.05), V2(0.075, 0.03), V2(0.05, 0.08), V2(0, 0.09)]), 0.012, 0.003), M4(Math.cos(a) * 0.025, 0.52, Math.sin(a) * 0.025, 0, -a, 0), S.flat); }
        mb.add('metalv', new THREE.ConeGeometry(0.03, 0.06, 8), M4(0, 0.63, 0), S.flat); }
      else if (style === 'spiked') { mb.sph('metal', 0, 0.54, 0, 0.15, 0.15, 0.15, S.flat); mb.cyl('metalv', 0, 0.455, 0, 0.03, 0.04, S.dark, 10);
        const n = 14; for (let k = 0; k < n; k++) { const yy = 1 - (2 * (k + 0.5)) / n, rr = Math.sqrt(1 - yy * yy), a = k * 2.39996; const d = V3(Math.cos(a) * rr, yy, Math.sin(a) * rr); if (d.y < -0.75) continue; mb.add('metalv', new THREE.ConeGeometry(0.016, 0.075, 6), new THREE.Matrix4().compose(d.clone().multiplyScalar(0.095).add(V3(0, 0.54, 0)), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d), V3(1, 1, 1)), S.edge); } }
      else { mb.box('metal', 0.02, 0.52, 0, 0.17, 0.075, 0.075, S.flat); mb.box('metalv', 0.11, 0.52, 0, 0.012, 0.085, 0.085, S.edge); for (let k = 0; k < 4; k++) mb.box('metalv', 0.118, 0.5 + (k % 2) * 0.04, -0.02 + (k >> 1) * 0.04, 0.004, 0.03, 0.03, S.dark); // a checked striking face
        const beak = new THREE.ConeGeometry(0.03, 0.15, 6); beak.translate(0, 0.075, 0); mb.add('metalv', beak, M4(-0.065, 0.52, 0, 0, 0, Math.PI / 2 + 0.25), S.flat); mb.add('metalv', new THREE.ConeGeometry(0.02, 0.08, 6), M4(0.02, 0.6, 0), S.flat); }
      wear(mb, R, S, t, it, -0.04, 0.04, 0.48, 0.58, 0.04);
    }
  } else if (wt === '2HB') {
    const caster = it.staff || /staff|rod|stave|wand|crook/.test(nm) || (!/hammer|maul/.test(nm) && R() < 0.5);
    const wood = woodOf(R);
    if (caster) {
      // a gnarled staff: a slightly crooked shaft, rune bands, a leather grip and a carved head holding a stone
      const pts = []; for (let i = 0; i <= 8; i++) pts.push(V3((R() - 0.5) * 0.02, -0.2 + i * 0.19, (R() - 0.5) * 0.02)); const top = pts[8];
      const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.021, 8); const tp = tg.attributes.position; for (let i = 0; i < tp.count; i++) { const k = 1 - 0.25 * ((tp.getY(i) + 0.2) / 1.52); tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); } tg.computeVertexNormals(); mb.add('haft', tg, M4(0, 0, 0), wood);
      for (let j = 0; j < 10; j++) mb.cyl('leather', pts[3].x, 0.42 + j * 0.022, pts[3].z, 0.023, 0.014, K3.shade(grip, j % 2 ? -0.25 : 0.05), 10, null, 0, 0, 0.3);
      for (const y of [0.98, 1.06, 1.14]) mb.cyl('gold', top.x, y, top.z, 0.021, 0.012, fit, 10);
      const gem = it.fx ? FX_GLOW[it.fx] || pick(R, GEMS) : pick(R, GEMS); const head = pick(R, ['claw', 'ring', 'crystal', 'crook']); const hy = top.y;
      if (head === 'claw') { mb.sph('glow', top.x, hy + 0.1, top.z, 0.1, 0.1, 0.1, gem); for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.283 + 0.4; let prev = V3(top.x, hy - 0.02, top.z); for (let j = 1; j <= 3; j++) { const u = j / 3; const p = V3(top.x + Math.cos(a) * (0.03 + 0.045 * Math.sin(u * 2.4)), hy + u * 0.17, top.z + Math.sin(a) * (0.03 + 0.045 * Math.sin(u * 2.4))); mb.rod('haft', prev, p, 0.011 - u * 0.004, K3.shade(wood, -0.1), 5); prev = p; } } }
      else if (head === 'ring') { mb.add('gold', new THREE.TorusGeometry(0.085, 0.013, 8, 24), M4(top.x, hy + 0.1, top.z), fit); mb.sph('glow', top.x, hy + 0.1, top.z, 0.075, 0.075, 0.075, gem); for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.283; mb.sph('gold', top.x + Math.cos(a) * 0.085, hy + 0.1 + Math.sin(a) * 0.085, top.z, 0.022, 0.022, 0.022, fit); } }
      else if (head === 'crystal') { for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.283; mb.add('glow', new THREE.OctahedronGeometry(0.03 + R() * 0.02, 0), M4(top.x + Math.cos(a) * 0.03, hy + 0.08 + R() * 0.06, top.z + Math.sin(a) * 0.03, 0, a, 0.3, 1), gem); } mb.add('glow', new THREE.OctahedronGeometry(0.055, 0), M4(top.x, hy + 0.15, top.z, 0, 0, 0, 1), gem); mb.cyl('gold', top.x, hy + 0.02, top.z, 0.04, 0.03, fit, 10); }
      else { let prev = V3(top.x, hy, top.z); for (let j = 1; j <= 8; j++) { const a = (j / 8) * Math.PI * 1.25; const p = V3(top.x + 0.09 - Math.cos(a) * 0.09, hy + Math.sin(a) * 0.12, top.z); mb.rod('haft', prev, p, 0.018, wood, 6); prev = p; } mb.sph('glow', top.x + 0.12, hy + 0.04, top.z, 0.06, 0.06, 0.06, gem); }
      if (t >= 3 || it.fx) for (let k = 0; k < 5; k++) mb.box('glow', top.x, 0.7 + k * 0.05, top.z + 0.021, 0.008, 0.02, 0.002, gem);
    } else {
      // a great maul: iron-banded haft and a heavy head with chamfered faces and spikes
      mb.cyl('haft', 0, 0.48, 0, 0.026, 1.3, wood, 10, 0.022); for (const y of [0.3, 0.7, 0.98]) mb.cyl('metalv', 0, y, 0, 0.03, 0.02, S.dark, 10);
      for (let j = 0; j < 12; j++) mb.cyl('leather', 0, -0.12 + j * 0.026, 0, 0.03, 0.016, K3.shade(grip, j % 2 ? -0.25 : 0.05), 10, null, 0, 0, 0.3);
      const hy = 1.1; mb.box('metal', 0, hy, 0, 0.3, 0.16, 0.16, S.flat); for (const sx of [-1, 1]) { mb.box('metalv', sx * 0.158, hy, 0, 0.018, 0.13, 0.13, S.edge); mb.box('metalv', sx * 0.13, hy, 0, 0.03, 0.17, 0.17, S.dark); }
      if (R() < 0.6) mb.add('metalv', new THREE.ConeGeometry(0.025, 0.1, 6), M4(0, hy + 0.12, 0), S.flat);
      wear(mb, R, S, t, it, -0.1, 0.1, hy - 0.06, hy + 0.06, 0.081);
    }
  } else if (wt === 'H2H') {
    for (let k = 0; k < 4; k++) mb.cyl('metalv', -0.06 + k * 0.04, 0.05, 0, 0.022, 0.03, S.flat, 12, null, 0, Math.PI / 2, 0);
    mb.box('metalv', 0, 0.02, 0, 0.17, 0.03, 0.03, S.dark); mb.box('leather', 0, -0.03, 0, 0.14, 0.06, 0.04, grip);
    if (R() < 0.5) for (let k = 0; k < 3; k++) mb.add('metalv', new THREE.ConeGeometry(0.012, 0.14, 6), M4(-0.04 + k * 0.04, 0.13, 0, 0, 0, 0), S.edge);
  } else if (wt === 'ARC') {
    // a recurve bow: tapered limbs that flick forward at the tips, a leather-wrapped riser, nocks and a taut string
    const L = 0.62 + R() * 0.1, curve = 0.08 + R() * 0.05; const wood = woodOf(R);
    const at = (u) => { const y = u * L, a = Math.abs(u); return V3(-curve * (1 - u * u) + (a > 0.78 ? 0.07 * ((a - 0.78) / 0.22) ** 2 : 0), y); };
    for (let k = 0; k < 20; k++) { const u0 = -1 + k / 10, u1 = u0 + 0.1; const r = 0.017 - Math.abs((u0 + u1) / 2) * 0.008; mb.rod('haft', at(u0), at(u1), r, k % 5 === 0 ? K3.shade(wood, -0.15) : wood, 6); }
    mb.box('haft', -curve, 0, 0, 0.034, 0.2, 0.026, K3.shade(wood, -0.1)); for (let j = 0; j < 7; j++) mb.cyl('leather', -curve - 0.002, -0.06 + j * 0.02, 0, 0.022, 0.012, K3.shade(grip, j % 2 ? -0.25 : 0.05), 8, null, 0, 0, 0.3);
    mb.box('metalv', -curve + 0.02, 0.07, 0, 0.012, 0.012, 0.01, fit);
    const tipA = at(-1), tipB = at(1); for (const tp of [tipA, tipB]) mb.sph('metalv', tp.x, tp.y, 0, 0.022, 0.022, 0.022, fit);
    mb.rod('paint', tipA, tipB, 0.0025, '#ece6d6', 4);
    if (it.fx || t >= 4) for (let k = 0; k < 6; k++) { const u = -0.7 + k * 0.28; const p = at(u); mb.box('glow', p.x + 0.012, p.y, 0, 0.004, 0.025, 0.012, it.fx ? FX_GLOW[it.fx] || '#9ad8ff' : '#9ad8ff'); }
  } else if (wt === 'THR') {
    if (/star|shuriken|chakram/.test(nm) || R() < 0.33) { const s = new THREE.Shape(); for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283, r = k % 2 ? 0.035 : 0.1; if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(r, 0); } s.closePath(); mb.add('metal', extrude(s, 0.008, 0.003), M4(0, 0, 0), S.flat); edgeRim(mb, s.getPoints(1).concat([s.getPoints(1)[0]]), 0, S.edge, 0.003, false); mb.cyl('metalv', 0, 0, 0, 0.018, 0.012, S.dark, 12, null, 0, Math.PI / 2, 0); }
    else for (let k = 0; k < 3; k++) { const sh = bladeShape('leaf', 0.15, 0.034, R); mb.add('metal', extrude(sh, 0.006, 0.002), M4(-0.04 + k * 0.04, 0, k * 0.012, 0, 0, (k - 1) * 0.25), S.flat); mb.cyl('leather', -0.04 + k * 0.04, -0.03, k * 0.012, 0.01, 0.06, grip, 6); mb.sph('metalv', -0.04 + k * 0.04, -0.065, k * 0.012, 0.018, 0.018, 0.018, fit); }
  } else if (wt === 'TOME') {
    const c = hueShift(['#6a3a8a', '#3a5a9a', '#8a2a2a', '#2a6a5a', '#9a7a2a', '#2a2a4a'][t], R, 0.06); const gold = fit;
    for (const sz of [-1, 1]) mb.box('leather', 0, 0.08, sz * 0.026, 0.2, 0.27, 0.011, c);
    mb.box('paint', 0.006, 0.08, 0, 0.188, 0.258, 0.042, '#eadfc4'); mb.cyl('leather', -0.1, 0.08, 0, 0.032, 0.27, K3.shade(c, -0.25), 10);
    for (const k of [-0.36, -0.12, 0.12, 0.36]) mb.cyl('gold', -0.1, 0.08 + k * 0.27, 0, 0.035, 0.01, gold, 10);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) mb.box('gold', sx * 0.084, 0.08 + sy * 0.119, 0.032, 0.034, 0.034, 0.004, gold);
    const em = pick(R, ['disk', 'star', 'eye']); if (em === 'star') { const s = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.283 + 1.57, r = k % 2 ? 0.02 : 0.05; if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } mb.add('gold', extrude(s, 0.004, 0.001), M4(0.01, 0.09, 0.034), gold); }
    else { mb.cyl('gold', 0.01, 0.09, 0.033, 0.05, 0.004, gold, 16, null, 0, Math.PI / 2, 0); if (em === 'eye') mb.sph('glow', 0.01, 0.09, 0.037, 0.04, 0.022, 0.01, pick(R, GEMS)); }
    mb.sph('glow', 0.01, 0.09, 0.04, 0.022, 0.022, 0.012, pick(R, GEMS));
  } else mb.box('metal', 0, 0.3, 0, 0.05, 0.6, 0.02, S.flat);
  return { mb, pose: wt === 'ARC' ? 'bow' : wt === 'TOME' || wt === 'H2H' || wt === 'THR' ? 'flat' : 'diag' };
}

// ---------------------------------------------------------------- shields
// a curved board with a metal rim and rivets, a domed boss, painted heraldry (or iron-strapped planks), scuffs
function shield(it, R) {
  const mb = new MB(); const t = Math.min(5, it.tier || 0); const wood = it.wood || t === 0; const S = steelOf(Math.max(1, t), R); const fit = fittingsOf(t, R);
  const field = hueShift(wood ? '#8a5a2e' : pick(R, ['#7a2a2a', '#28457a', '#2e6a3c', '#5a2a6a', '#b8902e', '#2a2a2e']), R); const charge = pick(R, ['#e8d8a8', '#e0c060', '#e8e8e8', '#1a1a1a', '#b83a2a']);
  const shape = pick(R, wood ? ['round', 'round', 'heater'] : ['heater', 'heater', 'kite', 'round']);
  const s = new THREE.Shape();
  if (shape === 'round') { s.absarc(0, 0, 0.3, 0, Math.PI * 2, false); }
  else if (shape === 'kite') { s.moveTo(-0.24, 0.3); s.lineTo(0.24, 0.3); s.quadraticCurveTo(0.26, -0.05, 0, -0.42); s.quadraticCurveTo(-0.26, -0.05, -0.24, 0.3); }
  else { s.moveTo(-0.27, 0.3); s.lineTo(0.27, 0.3); s.lineTo(0.27, 0.02); s.quadraticCurveTo(0.24, -0.25, 0, -0.36); s.quadraticCurveTo(-0.24, -0.25, -0.27, 0.02); s.lineTo(-0.27, 0.3); }
  const bow = (x) => -(x * x) * 0.35; // the board curves back towards the arm
  const g = extrude(s, 0.03, 0.01); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + bow(p.getX(i))); g.computeVertexNormals();
  mb.add(wood ? 'planks' : 'paint', g, M4(0, 0, 0), field);
  const front = (x) => 0.026 + bow(x);
  // the rim: a metal band round the edge, studded with rivets
  const out = s.getPoints(shape === 'round' ? 14 : 6); const rim = t === 0 ? S.dark : t >= 3 ? fit : S.flat;
  for (let i = 0; i < out.length - 1; i++) { const a = out[i], b = out[i + 1]; mb.rod('metalv', V3(a.x, a.y, bow(a.x) + 0.004), V3(b.x, b.y, bow(b.x) + 0.004), 0.021, rim, 6); }
  for (let i = 0; i < out.length - 1; i += 2) { const a = out[i]; const x = a.x * 0.9, y = a.y * 0.9 + (shape === 'round' ? 0 : 0.0); mb.sph('metalv', x, y, front(x) + 0.004, 0.022, 0.022, 0.012, K3.shade(rim, 0.15)); }
  if (wood) {
    for (let k = -2; k <= 2; k++) mb.box('haft', k * 0.11, 0, front(k * 0.11) + 0.001, 0.005, 0.56, 0.004, K3.shade(field, -0.32));
    for (const y of [0.13, -0.13]) for (let k = -2; k <= 2; k++) { const x = k * 0.1; mb.box('metalv', x, y, front(x) + 0.006, 0.105, 0.04, 0.006, S.dark); mb.sph('metalv', x, y, front(x) + 0.01, 0.016, 0.016, 0.008, S.flat); }
  } else {
    const dev = pick(R, ['cross', 'chevron', 'pale', 'bend', 'lion', 'quarters']);
    const P = (x, y, w, h, rz = 0) => mb.box('paint', x, y, front(x) + 0.004, w, h, 0.004, charge, 0, 0, rz);
    if (dev === 'cross') { P(0, 0, 0.08, 0.55); P(0, 0.08, 0.46, 0.08); }
    else if (dev === 'chevron') for (const sd of [-1, 1]) P(sd * 0.1, 0.02, 0.3, 0.07, sd * 0.6);
    else if (dev === 'pale') P(0, -0.02, 0.16, 0.6);
    else if (dev === 'bend') P(0, 0, 0.08, 0.7, 0.7);
    else if (dev === 'quarters') { P(-0.12, 0.13, 0.22, 0.24); P(0.12, -0.12, 0.22, 0.3); }
    else { const l = new THREE.Shape([V2(-0.08, -0.12), V2(0.08, -0.12), V2(0.1, 0.05), V2(0.04, 0.14), V2(-0.02, 0.1), V2(-0.1, 0.12), V2(-0.06, 0.02)]); mb.add('paint', extrude(l, 0.004, 0.001), M4(0, 0.02, front(0) + 0.004), charge); }
    // an inner border band in the charge colour
    for (let i = 0; i < out.length - 1; i++) { const a = out[i], b = out[i + 1]; mb.rod('paint', V3(a.x * 0.86, a.y * 0.86, front(a.x * 0.86) + 0.002), V3(b.x * 0.86, b.y * 0.86, front(b.x * 0.86) + 0.002), 0.006, charge, 4); }
  }
  // the boss: a domed iron centre on a flange, sometimes spiked
  mb.cyl('metalv', 0, 0.02, front(0), 0.07, 0.012, K3.shade(rim, -0.15), 16, null, 0, Math.PI / 2, 0);
  mb.add('metal', new THREE.SphereGeometry(0.058, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M4(0, 0.02, front(0) + 0.004, Math.PI / 2, 0, 0), rim);
  if (R() < 0.3) mb.add('metalv', new THREE.ConeGeometry(0.02, 0.07, 8), M4(0, 0.02, front(0) + 0.08, Math.PI / 2, 0, 0), S.edge);
  for (let k = 0; k < 6; k++) { const x = (R() - 0.5) * 0.4, y = (R() - 0.5) * 0.4; mb.box('paint', x, y, front(x) + 0.0055, 0.003, 0.04 + R() * 0.05, 0.001, K3.shade(field, 0.3), 0, 0, (R() - 0.5) * 2); } // scuffs and sword cuts
  return { mb, pose: 'face' };
}

// ---------------------------------------------------------------- armour
function armour(it, R) {
  const mb = new MB(); const t = Math.min(5, it.tier || 0); const ak = it.ak;
  const plate = ak === 'plate', chain = ak === 'chain', leather = ak === 'leather', cloth = ak === 'cloth' || ak === 'misc';
  const nm = (it.name || '').toLowerCase();
  const m0 = it.col ? hueShift(it.col, R, 0.03, 0.06) : plate ? hueShift(METAL[t], R, 0.02, 0.08) : chain ? hueShift(['#7a7e84', '#8e9298', '#a0a8b4', '#c8b070', '#b8d8ee', '#a8e8c8'][t], R, 0.02) : leather ? hueShift(['#8a6038', '#9a6a3a', '#7a4a2e', '#6a4a32', '#4a6a8a', '#7a3a5a'][t], R, 0.08) : hueShift(it.fx === 'fire' ? '#c8501e' : it.fx === 'storm' ? '#4a6ac0' : ['#9a8a7a', '#4a6ac8', '#8a4ac8', '#3a9a8a', '#b83a5a', '#4a42a8'][t], R, 0.12);
  const m = readable(m0); // a black robe still has to show up on a dark bag slot
  // every item gets its own accent colour and pattern, so two pieces of the same kind never look the same
  const acc = readable(pick(R, ACCENTS), 0.45); const pat = pick(R, ['plain', 'stripes', 'band', 'studs', 'checks', 'emblem']);
  const trim = t >= 3 ? '#e2c25a' : plate ? K3.shade(m, -0.25) : leather ? '#2a1a10' : hueShift('#c8a040', R);
  const key = plate ? 'metal' : chain ? 'metal' : leather ? 'leather' : 'cloth2';
  const rivets = (pts) => { for (const [x, y, z] of pts) mb.sph('metal', x, y, z, 0.016, 0.016, 0.01, trim); };
  // pattern on a flat-ish front: x0..x1 wide, y0..y1 tall, at depth z
  const deco = (x0, x1, y0, y1, z, mat = key) => {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
    if (pat === 'stripes') for (let k = 0; k < 3; k++) mb.box(mat, cx, y0 + h * (0.25 + k * 0.25), z, w, h * 0.06, 0.012, acc);
    else if (pat === 'band') mb.box(mat, cx, y0 + h * (0.35 + R() * 0.3), z, w * 1.02, h * 0.12, 0.014, acc);
    else if (pat === 'studs') for (let k = 0; k < 6; k++) mb.sph('metal', x0 + w * (0.2 + (k % 3) * 0.3), y0 + h * (0.3 + Math.floor(k / 3) * 0.4), z, 0.016, 0.016, 0.01, acc);
    else if (pat === 'checks') for (let k = 0; k < 6; k++) mb.box(mat, x0 + w * (0.2 + (k % 3) * 0.3), y0 + h * (0.35 + Math.floor(k / 3) * 0.3), z, w * 0.18, h * 0.16, 0.012, (k + Math.floor(k / 3)) % 2 ? acc : K3.shade(m, -0.2));
    else if (pat === 'emblem') { const sh = pick(R, ['disc', 'diamond', 'cross']); if (sh === 'disc') mb.cyl(mat, cx, y0 + h * 0.55, z, Math.min(w, h) * 0.2, 0.012, acc, 16, null, 0, Math.PI / 2, 0); else if (sh === 'diamond') mb.box(mat, cx, y0 + h * 0.55, z, Math.min(w, h) * 0.26, Math.min(w, h) * 0.26, 0.012, acc, 0, 0, Math.PI / 4); else { mb.box(mat, cx, y0 + h * 0.55, z, w * 0.12, h * 0.5, 0.012, acc); mb.box(mat, cx, y0 + h * 0.62, z, w * 0.42, h * 0.1, 0.012, acc); } }
  };
  switch (it.slot) {
    case 'head': {
      if (plate) { const style = pick(R, ['great', 'sallet', 'nasal']);
        if (style === 'great') { mb.add('metal', lathe([[0.001, 0.32], [0.08, 0.31], [0.14, 0.27], [0.155, 0.2], [0.16, 0.0], [0.15, -0.05]], 18), M4(0, 0, 0), m); mb.box('dark', 0, 0.16, 0.15, 0.2, 0.025, 0.02, '#000'); for (let k = 0; k < 4; k++) mb.sph('dark', -0.05 + k * 0.035, 0.08, 0.155, 0.012, 0.012, 0.01, '#000'); mb.box('metal', 0, 0.12, 0.15, 0.02, 0.24, 0.02, trim); }
        else if (style === 'sallet') { mb.add('metal', lathe([[0.001, 0.3], [0.1, 0.28], [0.15, 0.2], [0.16, 0.08], [0.17, 0.0], [0.22, -0.06]], 18), M4(0, 0, 0, -0.2, 0, 0), m); mb.box('dark', 0, 0.14, 0.15, 0.22, 0.03, 0.03, '#000'); }
        else { mb.add('metal', lathe([[0.001, 0.32], [0.09, 0.3], [0.14, 0.22], [0.15, 0.06], [0.155, 0.0]], 18), M4(0, 0, 0), m); mb.box('metal', 0, 0.02, 0.15, 0.025, 0.16, 0.02, trim); }
        if (R() < 0.6) for (let k = 0; k < 6; k++) mb.sph('fur', 0, 0.36 + Math.sin((k / 5) * 2) * 0.03, 0.08 - k * 0.04, 0.05, 0.07, 0.05, pick(R, ['#b8302a', '#e8d070', '#e8e8e8', '#28457a']));
      } else if (chain) { mb.add('metal', lathe([[0.001, 0.3], [0.1, 0.28], [0.15, 0.2], [0.16, 0.05], [0.18, -0.12], [0.22, -0.18]], 18), M4(0, 0, 0), m); mb.box('dark', 0, 0.06, 0.16, 0.18, 0.14, 0.02, '#120e0a'); }
      else if (leather) { mb.add('leather', lathe([[0.001, 0.26], [0.1, 0.25], [0.15, 0.17], [0.16, 0.03], [0.17, 0.0]], 16), M4(0, 0, 0), m); mb.cyl('leather', 0, 0.02, 0, 0.17, 0.04, K3.shade(m, -0.3), 16); rivets([[0.12, 0.12, 0.1], [-0.12, 0.12, 0.1], [0, 0.18, 0.13]]); }
      else { const style = /mitre/.test(nm) ? 'mitre' : /circlet|crown|diadem|tiara/.test(nm) ? 'circlet' : /headband|band\b|bandana/.test(nm) ? 'headband' : /pointed|wizard|conical/.test(nm) ? 'wizard' : /hood|cowl/.test(nm) ? 'hood' : /cap|beret|hat/.test(nm) ? 'cap' : pick(R, ['hood', 'wizard', 'cap']);
        if (style === 'headband') { const g = new THREE.TorusGeometry(0.15, 0.03, 8, 28); g.scale(1, 1, 0.9); mb.add('cloth2', g, M4(0, 0.08, 0, Math.PI / 2, 0, 0), m); for (const sx of [-1, 1]) mb.box('cloth2', sx * 0.03, -0.02, -0.15, 0.04, 0.16, 0.012, m, 0, 0, sx * 0.3); }
        else if (style === 'circlet') { mb.add('gold', new THREE.TorusGeometry(0.14, 0.012, 8, 32), M4(0, 0.1, 0, Math.PI / 2 + 0.1, 0, 0), '#e2c25a'); mb.sph('glow', 0, 0.12, 0.14, 0.04, 0.04, 0.02, pick(R, GEMS)); }
        else if (style === 'wizard') { const g = new THREE.ConeGeometry(0.15, 0.45, 18, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.45 + 0.5; p.setZ(i, p.getZ(i) - y * y * 0.12); } g.computeVertexNormals(); mb.add('cloth2', g, M4(0, 0.26, 0), m); mb.cyl('cloth2', 0, 0.03, 0, 0.28, 0.02, m, 24); mb.cyl('cloth2', 0, 0.06, 0, 0.152, 0.04, trim, 18); }
        else if (style === 'mitre') { const s = new THREE.Shape(); s.moveTo(-0.14, 0); s.lineTo(-0.14, 0.12); s.quadraticCurveTo(-0.12, 0.26, 0, 0.32); s.quadraticCurveTo(0.12, 0.26, 0.14, 0.12); s.lineTo(0.14, 0); for (const sd of [1, -1]) mb.add('cloth2', extrude(s, 0.012, 0.004), M4(0, 0, sd * 0.05, sd * -0.12, 0, 0), m); mb.box('gold', 0, 0.15, 0.065, 0.03, 0.28, 0.006, '#e2c25a'); mb.cyl('gold', 0, 0.03, 0, 0.145, 0.05, '#e2c25a', 18); }
        else if (style === 'cap') { mb.add('cloth2', lathe([[0.001, 0.16], [0.1, 0.15], [0.15, 0.08], [0.16, 0.0]], 16), M4(0, 0, 0), m); mb.add('fur', new THREE.SphereGeometry(0.5, 8, 6), M4(0.12, 0.16, -0.04, 0, 0, 0.6, 0.06), '#f4f0e8'); }
        else { mb.sph('dark', 0, 0.03, 0.02, 0.27, 0.3, 0.26, '#120c0a'); mb.add('cloth2', new THREE.SphereGeometry(0.17, 18, 12, Math.PI * 0.3, Math.PI * 1.4, 0, Math.PI * 0.78), M4(0, 0.06, 0, 0, Math.PI / 2, 0), m); mb.add('cloth2', new THREE.CylinderGeometry(0.16, 0.2, 0.08, 18, 1, true, 0, Math.PI * 2), M4(0, -0.08, -0.02), K3.shade(m, -0.1)); mb.add('cloth2', new THREE.ConeGeometry(0.06, 0.14, 8), M4(0, 0.12, -0.17, -1.2, 0, 0), m); } // a cowl seen from the front, with a shadowed face
      }
      return { mb, pose: 'face' };
    }
    case 'chest': {
      const style = cloth ? (/tabard|surcoat/.test(nm) ? 'tabard' : /tunic|doublet|shirt|blouse|gi\b/.test(nm) ? 'tunic' : 'robe') : leather ? 'jerkin' : chain ? 'mail' : 'cuirass';
      const torso = (top, bot, depth) => { const pts = [[0.001, top], [0.12, top - 0.01], [0.2, top - 0.06], [0.21, top - 0.2], [0.17, (top + bot) / 2], [0.19, bot]]; const g = lathe(pts, 20); g.scale(1, 1, depth); return g; };
      if (style === 'tabard' || style === 'tunic') { mb.add('cloth2', torso(0.3, style === 'tabard' ? -0.3 : -0.2, 0.6), M4(0, 0, 0), style === 'tabard' ? K3.shade(m, -0.25) : m); for (const sx of [-1, 1]) mb.add('cloth2', new THREE.CylinderGeometry(0.06, 0.075, style === 'tunic' ? 0.2 : 0.14, 12), M4(sx * 0.25, 0.18, 0, 0, 0, sx * 0.75), style === 'tabard' ? K3.shade(m, -0.25) : m);
        if (style === 'tabard') { mb.box('cloth2', 0, -0.02, 0.125, 0.24, 0.62, 0.012, m); mb.box('cloth2', 0, -0.33, 0.128, 0.24, 0.03, 0.012, acc); deco(-0.1, 0.1, -0.2, 0.2, 0.135, 'cloth2'); }
        else { mb.box('cloth2', 0, 0.24, 0.12, 0.14, 0.05, 0.012, acc); for (let k = 0; k < 3; k++) mb.sph('metal', 0, 0.18 - k * 0.07, 0.13, 0.012, 0.012, 0.008, acc); deco(-0.17, 0.17, -0.18, 0.12, 0.128, 'cloth2'); } }
      else if (style === 'robe') { const g = lathe([[0.001, 0.32], [0.11, 0.31], [0.19, 0.26], [0.18, 0.05], [0.2, -0.25], [0.25 + R() * 0.06, -0.42 - R() * 0.06]], 22); g.scale(1, 1, 0.6); mb.add('cloth2', g, M4(0, 0, 0), m); mb.box('cloth2', 0, -0.05, 0.12, 0.05, 0.7, 0.02, trim); mb.cyl('cloth2', 0, 0.0, 0, 0.19, 0.04, trim, 20); for (const sx of [-1, 1]) mb.add('cloth2', new THREE.CylinderGeometry(0.06, 0.1, 0.26, 12), M4(sx * 0.26, 0.16, 0, 0, 0, sx * 0.7), m); mb.box('cloth2', 0, 0.27, 0.105, 0.2, 0.04, 0.02, acc); deco(-0.16, 0.16, -0.36, -0.12, 0.13, 'cloth2'); }
      else { mb.add(key, torso(0.3, -0.18, 0.62), M4(0, 0, 0), m);
        if (style === 'cuirass') { mb.box('metal', 0, 0.06, 0.13, 0.02, 0.36, 0.02, K3.shade(m, 0.15)); for (let k = 0; k < 3; k++) mb.box('metal', 0, -0.12 - k * 0.055, 0.11, 0.38, 0.05, 0.03, K3.shade(m, -0.05 * k)); for (const sx of [-1, 1]) { mb.add('metal', new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M4(sx * 0.22, 0.26, 0, 0, 0, sx * -0.4), m); mb.add('metal', new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M4(sx * 0.24, 0.22, 0, 0, 0, sx * -0.55, 0.95), K3.shade(m, -0.1)); } if (t >= 2) mb.add('gold', new THREE.TorusGeometry(0.05, 0.008, 6, 20), M4(0, 0.1, 0.135), '#e2c25a'); }
        if (style === 'mail') { mb.box('cloth2', 0, 0.02, 0.125, 0.16, 0.45, 0.012, hueShift(pick(R, ['#7a2a2a', '#28457a', '#2e6a3c', '#e8d8a8']), R)); mb.cyl('leather', 0, -0.14, 0, 0.2, 0.035, '#3a2618', 20); }
        if (style === 'jerkin') { for (let k = 0; k < 5; k++) mb.sph('metal', 0.02, 0.22 - k * 0.08, 0.13, 0.018, 0.018, 0.01, '#c8a040'); mb.box('leather', 0, 0.02, 0.125, 0.012, 0.45, 0.01, K3.shade(m, -0.3)); for (const sx of [-1, 1]) mb.add('leather', new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M4(sx * 0.22, 0.25, 0, 0, 0, sx * -0.5), K3.shade(m, -0.1)); }
        deco(-0.16, 0.16, -0.1, 0.2, 0.135, key);
      }
      return { mb, pose: 'face' };
    }
    case 'hands': {
      const flare = plate || /gauntlet/.test(nm) ? 0.035 + R() * 0.03 : R() * 0.015; const cuff = pick(R, [m, acc, trim]);
      for (const sx of [-1, 1]) { const x = sx * 0.11; mb.cyl(key, x, -0.13, 0, 0.07 + flare, 0.05, cuff, 12, 0.07); mb.add(key, new THREE.CylinderGeometry(0.06, 0.07, 0.16, 12), M4(x, -0.04, 0, 0, 0, sx * 0.1), plate ? m : K3.shade(m, -0.05)); mb.box(key, x, 0.07, 0.01, 0.1, 0.09, 0.05, m); for (let k = 0; k < 4; k++) mb.box(key, x - 0.035 + k * 0.024, 0.15, 0.01 + (plate ? 0.004 : 0), 0.018, 0.08, 0.03, plate ? K3.shade(m, 0.1) : m, 0, 0.2, 0); mb.box(key, x - sx * 0.06, 0.08, 0.03, 0.022, 0.06, 0.025, m, 0, 0, sx * 0.6); if (plate || t >= 2) mb.cyl('metal', x, -0.11, 0, 0.074, 0.025, trim, 12); }
      return { mb, pose: 'face' };
    }
    case 'legs': {
      const cut = /kilt|skirt/.test(nm) ? 'kilt' : /breeches|shorts/.test(nm) ? 'breeches' : /hose|tights|legging/.test(nm) ? 'tight' : /trouser|pants|slacks/.test(nm) ? 'loose' : pick(R, ['loose', 'tight', 'breeches']);
      const top = cut === 'tight' ? 0.075 : 0.09 + R() * 0.02, bot = cut === 'loose' ? 0.085 + R() * 0.02 : cut === 'breeches' ? 0.07 : 0.055, len = cut === 'breeches' ? 0.32 : 0.5;
      for (const sx of [-1, 1]) { mb.add(key, new THREE.CylinderGeometry(top, bot, len, 14), M4(sx * 0.09, -0.12 + (0.5 - len) / 2, 0, 0, 0, sx * -0.04), m); if (plate) { mb.sph('metal', sx * 0.09, -0.09, 0.05, 0.12, 0.1, 0.09, K3.shade(m, 0.1)); }
        if (cut === 'breeches') mb.cyl(key, sx * 0.09, -0.21, 0, 0.072, 0.035, acc, 12); else if (pat !== 'plain') mb.box(key, sx * 0.09 + sx * 0.05, -0.12, 0.02, 0.014, 0.46, 0.02, acc);
        if (leather && R() < 0.6) mb.sph('leather', sx * 0.09, -0.12, 0.07, 0.06, 0.05, 0.03, K3.shade(m, -0.2)); }
      if (cut === 'kilt') { const g = lathe([[0.17, 0.12], [0.2, 0.0], [0.24, -0.14]], 20); mb.add('cloth2', g, M4(0, 0, 0), m); for (let k = 0; k < 4; k++) mb.box('cloth2', -0.15 + k * 0.1, -0.03, 0.2, 0.02, 0.2, 0.01, acc); }
      mb.add(key, new THREE.CylinderGeometry(0.19, 0.17, 0.14, 18), M4(0, 0.15, 0), m); mb.cyl(plate ? 'metal' : 'leather', 0, 0.21, 0, 0.192, 0.035, pat === 'band' || pat === 'emblem' ? acc : trim, 18);
      return { mb, pose: 'face' };
    }
    case 'feet': {
      const fk = /sandal/.test(nm) ? 'sandal' : /slipper/.test(nm) ? 'slipper' : /shoe/.test(nm) ? 'shoe' : 'boot'; const shaft = fk === 'boot' ? 0.16 + R() * 0.12 : 0;
      for (const sx of [-1, 1]) { const x = sx * 0.1;
        if (fk === 'boot') { mb.add(key, new THREE.CylinderGeometry(0.06 + R() * 0.012, 0.065, shaft, 12), M4(x, -0.06 + shaft / 2, 0), m); mb.cyl(key, x, -0.06 + shaft - 0.02, 0, 0.068, 0.03, pat === 'plain' ? K3.shade(m, -0.2) : acc, 12); }
        if (fk === 'sandal') { mb.box('leather', x, -0.11, 0.03, 0.12, 0.025, 0.27, K3.shade(m, -0.15)); for (let k = 0; k < 3; k++) mb.box('leather', x, -0.08, -0.05 + k * 0.08, 0.125, 0.018, 0.022, acc); }
        else { mb.sph(key, x, -0.07, 0.08, 0.13, 0.1, 0.18, K3.shade(m, -0.05)); mb.box(key, x, -0.09, 0.03, 0.12, fk === 'slipper' ? 0.035 : 0.05, 0.26, K3.shade(m, -0.1)); mb.box('leather', x, -0.12, 0.03, 0.125, 0.02, 0.27, fk === 'slipper' ? acc : '#3a2a1e'); }
        if (fk === 'slipper' && R() < 0.7) mb.sph('fur', x, -0.06, 0.16, 0.03, 0.03, 0.03, acc); if (fk === 'shoe') mb.box('metal', x, -0.05, 0.1, 0.05, 0.03, 0.01, acc);
        if (plate) mb.cyl('metal', x, -0.06 + shaft, 0, 0.068, 0.025, trim, 12); }
      return { mb, pose: 'side' };
    }
    case 'back': {
      const L = 0.3 + R() * 0.14, hem = pick(R, ['points', 'straight', 'round']), W = 0.22 + R() * 0.06;
      const s = new THREE.Shape(); s.moveTo(-0.16, 0.28); s.lineTo(0.16, 0.28); s.quadraticCurveTo(W + 0.02, -0.1, W, -L);
      if (hem === 'points') { s.lineTo(0.08, -L + 0.04); s.lineTo(0, -L - 0.02); s.lineTo(-0.08, -L + 0.04); } else if (hem === 'round') s.quadraticCurveTo(0, -L - 0.1, -W, -L); s.lineTo(-W, -L); s.quadraticCurveTo(-W - 0.02, -0.1, -0.16, 0.28);
      const g = extrude(s, 0.012, 0.004); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.sin(p.getX(i) * 22) * 0.012 - (p.getX(i) ** 2) * 0.5); g.computeVertexNormals();
      mb.add('cloth2', g, M4(0, 0, 0), m); mb.box('cloth2', 0, 0.28, 0.01, 0.34, 0.035, 0.02, pat === 'plain' ? trim : acc); for (const sx of [-1, 1]) mb.sph(R() < 0.5 ? 'gold' : 'glow', sx * 0.15, 0.27, 0.025, 0.04, 0.04, 0.02, R() < 0.5 ? '#e2c25a' : pick(R, GEMS)); deco(-0.14, 0.14, -0.2, 0.12, 0.035, 'cloth2');
      return { mb, pose: 'face' };
    }
    case 'waist': {
      const g = new THREE.TorusGeometry(0.18, 0.025, 6, 32); g.scale(1, 1, 0.55); mb.add('leather', g, M4(0, 0, 0, Math.PI / 2 - 0.5, 0, 0), leather || cloth ? m : readable(pick(R, ['#5a3a20', '#3a2618', '#6a4a2a', '#2a2a2a']))); if (pat !== 'plain') { const g2 = new THREE.TorusGeometry(0.182, 0.008, 4, 32); g2.scale(1, 1, 0.55); mb.add('leather', g2, M4(0, 0.012, 0, Math.PI / 2 - 0.5, 0, 0), acc); }
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
    mb.cyl('haft', 0, 0.3, 0, 0.02, 0.8, hueShift('#6a4a2a', R), 8);
    if (it.tool === 'axe') { const s = new THREE.Shape([V2(0, -0.06), V2(0.15, -0.11), V2(0.18, 0), V2(0.15, 0.1), V2(0, 0.05)]); mb.add('metal', extrude(s, 0.02), M4(0, 0.64, 0), m); mb.box('metalv', -0.02, 0.64, 0, 0.06, 0.11, 0.05, K3.shade(m, -0.3)); }
    else if (it.tool === 'pick') { const g = new THREE.TorusGeometry(0.22, 0.02, 6, 20, Math.PI * 0.75); mb.add('metal', g, M4(0, 0.46, 0, 0, 0, Math.PI * 0.125), m); for (const sx of [-1, 1]) mb.add('metal', new THREE.ConeGeometry(0.02, 0.06, 6), M4(sx * 0.21, 0.63, 0, 0, 0, sx * -1.2), m); }
    else { mb.clear && mb.clear(); }
    if (it.tool === 'knife') { const m2 = new MB(); m2.add('metal', extrude(new THREE.Shape([V2(-0.022, 0), V2(0.03, 0), V2(0.04, 0.12), V2(0.0, 0.2), V2(-0.02, 0.1)]), 0.008, 0.003), M4(0, 0, 0), m); m2.cyl('haft', 0, -0.06, 0, 0.018, 0.12, hueShift('#5a3a20', R), 8); m2.cyl('metal', 0, -0.0, 0, 0.022, 0.012, '#c8a040', 8); return { mb: m2, pose: 'diag' }; }
    return { mb, pose: 'diag' };
  }
  if (it.kind === 'gear' && it.light) return { group: K3.lightModel ? K3.lightModel(it.light) : null, pose: 'stand' };
  if (it.kind === 'consumable') {
    const ct = it.ctype;
    if (ct === 'food' || ct === 'bread') { const f = ['bread', 'cheese', 'meat', 'pie', 'feast'][Math.min(4, t)]; if (f === 'bread') { mb.sph('paint', 0, 0, 0, 0.34, 0.16, 0.2, hueShift('#c8904a', R)); for (let k = 0; k < 3; k++) mb.box('paint', -0.08 + k * 0.08, 0.075, 0, 0.02, 0.01, 0.14, '#8a5a2a', 0.3); } else if (f === 'cheese') { mb.add('paint', new THREE.CylinderGeometry(0.15, 0.15, 0.1, 18, 1, false, 0, Math.PI * 1.6), M4(0, 0, 0), '#e8c850'); mb.cyl('paint', 0, 0.051, 0, 0.152, 0.004, '#d8a830', 18); } else if (f === 'meat') { mb.sph('paint', 0, 0, 0, 0.28, 0.16, 0.18, '#8a3a2a'); mb.cyl('paint', 0.18, 0, 0, 0.025, 0.14, '#efe6cc', 8, null, 0, 0, Math.PI / 2); mb.sph('paint', 0.25, 0, 0, 0.06, 0.06, 0.06, '#efe6cc'); } else { mb.cyl('paint', 0, 0, 0, 0.17, 0.08, '#c8904a', 18); mb.cyl('paint', 0, 0.045, 0, 0.155, 0.01, '#8a2a3a', 18); for (let k = 0; k < 4; k++) mb.box('paint', 0, 0.052, 0, 0.3, 0.008, 0.02, '#c8904a', (k * Math.PI) / 4); } return { mb, pose: 'stand' }; }
    if (ct === 'drink' || ct === 'heal' || ct === 'mana' || /potion|elixir|draught/.test(n)) { const col = ct === 'heal' ? '#ff3a3a' : ct === 'mana' ? '#3a7aff' : ['#8ac8ff', '#c8e8ff', '#9affc8', '#ffd84a', '#ff8ad8'][Math.min(4, t)];
      const shape = ct === 'drink' && t < 2 ? 'skin' : pick(R, ['round', 'tall', 'square']);
      if (shape === 'skin') { mb.sph('leather', 0, -0.02, 0, 0.22, 0.26, 0.14, hueShift('#7a5532', R)); mb.cyl('haft', 0, 0.14, 0, 0.025, 0.06, '#5a3a20', 8); }
      else { const prof = shape === 'round' ? [[0.001, -0.14], [0.08, -0.13], [0.12, -0.06], [0.11, 0.02], [0.035, 0.07], [0.03, 0.14]] : shape === 'tall' ? [[0.001, -0.16], [0.06, -0.15], [0.065, 0.06], [0.03, 0.1], [0.028, 0.16]] : [[0.001, -0.14], [0.09, -0.14], [0.09, 0.04], [0.03, 0.08], [0.028, 0.14]];
        mb.add('glass', lathe(prof, shape === 'square' ? 4 : 18), M4(0, 0, 0), '#e8f0ff'); mb.add('glow', lathe(prof.slice(0, -2).map(([r, y]) => [r * 0.88, Math.min(y, 0.02)]), shape === 'square' ? 4 : 18), M4(0, 0, 0), col); mb.cyl('haft', 0, prof[prof.length - 1][1] + 0.02, 0, 0.032, 0.05, '#8a6a3a', 8); }
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
  // whiskers: a fan of thin bristles from a tuft of fur (they used to fall through to the round pouch and looked like an orb)
  if (/whisker|bristle/.test(n)) { mb.sph('fur', 0, -0.12, 0, 0.07, 0.05, 0.05, hueShift('#6a5a4a', R)); for (let k = 0; k < 7; k++) { const a = -0.75 + k * 0.25; mb.cyl('paint', Math.sin(a) * 0.15, -0.12 + Math.cos(a) * 0.15, 0, 0.004, 0.32, '#e8e2d4', 5, null, 0, 0, -a); } return { mb, pose: 'face' }; }
  if (/bandana|scarf|wrap/.test(n)) return misc(Object.assign({}, it, { kind: 'mat', mat: 'cloth' }), R);
  if (/coin|purse|doubloon/.test(n)) { for (let k = 0; k < 5; k++) mb.cyl('gold', (R() - 0.5) * 0.12, -0.1 + k * 0.035, (R() - 0.5) * 0.06, 0.07, 0.025, '#d8b048', 18); return { mb, pose: 'stand' }; }
  if (/meat|flesh|haunch/.test(n)) { mb.sph('paint', 0, 0, 0, 0.2, 0.14, 0.14, '#a83a2a'); mb.sph('paint', 0.02, 0.02, 0.06, 0.12, 0.08, 0.06, '#e8b8a0'); mb.cyl('paint', -0.2, 0, 0, 0.03, 0.14, '#efe6cc', 8, null, 0, 0, Math.PI / 2); return { mb, pose: 'face' }; }
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
  let g = r.group || (r.mb ? r.mb.build({ castShadow: false }) : new THREE.Group());
  // bladed weapons are built with the guard at the origin: shift them so the hand holds the middle of the grip
  if (r.mb && r.mb.gripY) { const o = new THREE.Group(); g.position.y = -r.mb.gripY; o.add(g); g = o; }
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
const iconMats = new Map();
function iconMat(src) { let m = iconMats.get(src); if (!m) { m = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xb0b0b0, roughness: src.roughness != null ? src.roughness : 0.85, metalness: src.metalness || 0, side: src.side }); iconMats.set(src, m); } return m; }
// draw the render twice: a blurred pale silhouette first, then the item on top
let haloCv = null;
function haloed(src) {
  if (!haloCv) { haloCv = document.createElement('canvas'); haloCv.width = haloCv.height = src.width; }
  const g = haloCv.getContext('2d'); g.clearRect(0, 0, haloCv.width, haloCv.height);
  g.save(); g.shadowColor = 'rgba(255,236,200,0.85)'; g.shadowBlur = 7; g.drawImage(src, 0, 0); g.shadowBlur = 3; g.shadowColor = 'rgba(255,245,225,0.6)'; g.drawImage(src, 0, 0); g.restore();
  return haloCv.toDataURL('image/png');
}
export function itemIcon(it) {
  const k = sigOf(it); const hit = cache.get(k); if (hit) return hit;
  try {
    if (!rr) setup();
    const { group, pose } = itemModel(it); if (!group) return null;
    const [rx, ry, rz] = POSE[pose] || POSE.face;
    holder.clear(); holder.rotation.set(0, 0, 0); holder.add(group);
    // icons draw textured materials (cloth, leather...) as plain tinted surfaces: their textures could still be
    // loading (or belong to the world renderer) and then cloth and leather came out black or navy
    group.traverse((o) => { if (o.isMesh && o.material && o.material.map) o.material = iconMat(o.material); });
    group.rotation.set(rx, ry, rz); group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group); const c = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3());
    group.position.sub(c);
    const r = Math.max(sz.x, sz.y, sz.z * 0.6) * 0.5 * (pose === 'diag' || pose === 'bow' ? 0.98 : 1.12); const d = r / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.set(0, 0, d); cam.lookAt(0, 0, 0); cam.near = d / 20; cam.far = d * 4; cam.updateProjectionMatrix();
    rr.render(scene, cam);
    const url = haloed(rr.domElement);
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
