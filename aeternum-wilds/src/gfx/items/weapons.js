// Aeternum Wilds — weapon models (sword, kite shield, great axe, war hammer, recurve bow, staff, and the enemies'
// cutlass, club and corrupted greatsword), in three tiers: 1 iron and ash, 2 blued starmetal, 3 gilded orichalcum
// with glowing runes. Rarity adds a gem and, from Epic up, runes in the rarity colour.
// Built with the grip at the origin and the business end along +y (blade flats face ±z, edges and axe bits lead
// along ±x / +z the way the old box models did), then turned rotation.x = PI/2 like before.
// Adapted from Kingdom Rising 3D's weapons.js / items3d.js, rebuilt bigger and more detailed for New World-style
// oversized weapons seen up close.
import * as THREE from 'three';
import { MB, V3, V2, loft, extrude, lathe, tube, helix, shade, mix, hot, col } from './mb.js';
import { itemMat } from './mats.js';

export const RARITY_COLORS = ['#c9c4b8', '#62d36b', '#4ea6ff', '#c66dff', '#ff9b30'];
// how far the business end reaches along +y (for trails and hit effects)
export const BLADE_LEN = { sword: 1.12, cutlass: 0.98, greatsword: 1.82, greataxe: 1.45, hammer: 1.32, club: 1.2, staff: 1.5, bow: 0.62, shield: 0.4 };
// effect colours by tier (sparks, trails)
export const TIER_FX = ['#e8eef4', '#9cc8ff', '#ffc864'];

// ---------- palettes ----------
const TIER = [
  null,
  { name: 'iron', flat: '#9da2a8', edge: '#d4d8dc', dark: '#55585e', fit: '#4e4a46', acc: '#b08850', grip: '#5e3a20', wrap: '#3a2414', wood: '#9a7046', woodDark: '#6a4a2c', rune: '#ffd27a', gem: '#e04a3a' },
  { name: 'starmetal', flat: '#7f9cc8', edge: '#d8e6fa', dark: '#34445e', fit: '#b4bfcc', acc: '#7aaaf0', grip: '#26324e', wrap: '#141c30', wood: '#5a3e2c', woodDark: '#3a281c', rune: '#9ad0ff', gem: '#3a8aff' },
  { name: 'orichalcum', flat: '#d89a48', edge: '#f4dca4', dark: '#7a4a1c', fit: '#eebe50', acc: '#fff0b0', grip: '#6a1c1c', wrap: '#3a0c0c', wood: '#5a3a5a', woodDark: '#3a2238', rune: '#ffcf6a', gem: '#ff6a2a' },
];
const pal = (tier) => TIER[Math.max(1, Math.min(3, tier | 0))];

// tiny deterministic random for rune glyphs
function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// rune glyphs: a row of little angular marks made of two or three strokes, on both faces at depth ±z
function runes(mb, R, color, x, y0, y1, z, size = 0.022, axis = 'y') {
  const n = Math.max(2, Math.floor((y1 - y0) / (size * 1.7)));
  for (let k = 0; k < n; k++) {
    const c = y0 + (k + 0.5) * (y1 - y0) / n;
    const strokes = 2 + Math.floor(R() * 2);
    for (let s = 0; s < strokes; s++) {
      const ang = [0, Math.PI / 2, 0.6, -0.6][Math.floor(R() * 4)], L = size * (0.5 + R() * 0.5), ox = (R() - 0.5) * size * 0.5, oy = (R() - 0.5) * size * 0.6;
      for (const sz of [-1, 1]) {
        if (axis === 'y') mb.box('glow', x + ox, c + oy, sz * z, size * 0.14, L, 0.0015, color, 0, 0, ang);
        else mb.box('glow', sz * z, c + oy, x + ox, 0.0015, L, size * 0.14, color, ang, 0, 0);
      }
    }
  }
}
// a cabochon gem in a metal bezel; facing ±z (or +z only)
function gem(mb, x, y, z, r, color, fit, both = true, axis = 'z') {
  for (const sz of both ? [-1, 1] : [1]) {
    if (axis === 'z') {
      mb.cyl('metal', x, y, z * sz, r * 1.35, r * 0.6, fit, 16, null, Math.PI / 2, 0, 0);
      mb.sph('gem', x, y, (z + r * 0.3) * sz, r * 2, r * 2, r * 1.3, color, 12);
    } else {
      mb.cyl('metal', z * sz, y, x, r * 1.35, r * 0.6, fit, 16, null, 0, 0, Math.PI / 2);
      mb.sph('gem', (z + r * 0.3) * sz, y, x, r * 1.3, r * 2, r * 2, color, 12);
    }
  }
}
// leather grip: a core, a spiral wrap, and metal collars at both ends
function grip(mb, P, y0, y1, r, turns, opts = {}) {
  // overlapping leather ribbon: one turn every ~1.1 ribbon widths, squashed flat against the core
  const c = opts.col || P.grip, wr = r * 0.42, L = y1 - y0, n = Math.max(3, Math.round(L / (wr * 2 * 1.05)));
  mb.cyl('leather', 0, (y0 + y1) / 2, 0, r * 0.98, L, shade(c, -0.12), 16);
  mb.geo('leather', helix(r * 0.98, y0 + wr * 0.6, y1 - wr * 0.6, n, wr, 0.45), 0, 0, 0, 0, 0, 0, 1, opts.wrap || c);
  if (opts.wire) mb.geo('metal', helix(r * 1.12, y0 + 0.01, y1 - 0.01, n, r * 0.06), 0, 0, 0, 0, Math.PI / n, 0, 1, opts.wire);
  if (!opts.noCollar) for (const y of [y0, y1]) mb.cyl('metal', 0, y, 0, r * 1.2, 0.014, opts.fit || P.fit, 16);
}

// ---------- blades ----------
// a double-edged blade: honed edge bevels, flats, a fuller fading out toward the point
const BLADE_PROFILE = [
  [[1, 0], [0.64, 0.7]],
  [[0.64, 0.7], [0.36, 1]],
  [[0.36, 1], [0.3, 1, 1], [0.15, 1, 1], [0, 1, 1], [-0.15, 1, 1], [-0.3, 1, 1], [-0.36, 1]],
  [[-0.36, 1], [-0.64, 0.7]],
  [[-0.64, 0.7], [-1, 0]],
];
function straightBlade(mb, P, y0, len, w0, t0, fuller = 0.5, opts = {}) {
  const st = []; const N = 22;
  for (let k = 0; k <= N; k++) {
    const s = k / N; const y = y0 + len * s;
    const tipStart = opts.tipStart || 0.8;
    let w = w0 * (1 - (opts.taper ?? 0.22) * s);
    if (s > tipStart) { const u = (s - tipStart) / (1 - tipStart); w *= Math.max(0.012, Math.sqrt(1 - u * u * 0.98) * (1 - u * 0.15)); }
    const t = t0 * (1 - 0.55 * s) + 0.0015;
    const f = s < 0.72 ? fuller * Math.min(1, s / 0.04) * (1 - Math.pow(s / 0.72, 3)) : 0;
    st.push({ y, w, t, f });
  }
  const edge = opts.edge || P.edge, flat = opts.flat || P.flat, ful = opts.fuller || shade(flat, -0.08);
  loft(mb, 'steel', st, BLADE_PROFILE, [edge, flat, ful, flat, edge]);
  return st;
}
// a single-edged curved sabre blade: edge on +x, thick spine on -x, curving back toward -x? no: the edge bellies out
const SABRE_PROFILE = [
  [[1, 0], [0.45, 0.75]],
  [[0.45, 0.75], [-0.6, 1]],
  [[-0.6, 1], [-0.85, 0.95], [-1, 0.7]],
  [[-1, 0.7], [-1, 0]],
];
function sabreBlade(mb, P, y0, len, w0, t0, curve, opts = {}) {
  const st = []; const N = 24;
  for (let k = 0; k <= N; k++) {
    const s = k / N; const y = y0 + len * s;
    let w = w0 * (1 + 0.15 * Math.sin(s * Math.PI * 0.9));
    if (s > 0.82) { const u = (s - 0.82) / 0.18; w *= Math.max(0.02, 1 - u * u); }
    const x = -curve * s * s + (s > 0.82 ? w0 * 0.6 * Math.pow((s - 0.82) / 0.18, 2) : 0);
    st.push({ y, w, t: t0 * (1 - 0.5 * s) + 0.0015, x });
  }
  loft(mb, 'steel', st, SABRE_PROFILE, [opts.edge || P.edge, opts.flat || P.flat, shade(opts.flat || P.flat, -0.12), shade(opts.flat || P.flat, -0.18)]);
  return st;
}

// ---------- guards and pommels ----------
function crossguard(mb, P, y, tier, half = 0.19, big = 1) {
  const fit = tier === 3 ? P.fit : tier === 2 ? P.fit : P.dark;
  const h = 0.032 * big, d = 0.05 * big;
  if (tier === 1) {
    // a plain iron bar with flared square ends and a central langet
    const s = new THREE.Shape([V2(-half, -h * 0.5), V2(half, -h * 0.5), V2(half + 0.006, h * 0.75), V2(half - 0.03, h * 0.5), V2(0, h * 0.62), V2(-half + 0.03, h * 0.5), V2(-half - 0.006, h * 0.75)]);
    mb.geo('metal', extrude(s, d * 0.7, 0.005, 4), 0, y, 0, 0, 0, 0, 1, fit);
    for (const sx of [-1, 1]) mb.box('metal', sx * (half - 0.004), y + h * 0.1, 0, 0.026, h * 1.5, d * 0.85, shade(fit, 0.05));
  } else if (tier === 2) {
    // quillons sweeping toward the blade, ending in round finials
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(V3(sx * (0.02 + u * (half - 0.02)), y + 0.05 * u * u * big, 0)); }
      mb.geo('metal', tube(pts, 0.012 * big, 16, 8), 0, 0, 0, 0, 0, 0, 1, fit);
      const e = pts[pts.length - 1]; mb.sph('metal', e.x, e.y, 0, 0.034 * big, 0.034 * big, 0.034 * big, shade(fit, 0.06), 12);
    }
  } else {
    // winged orichalcum guard: swept blades of gold either side
    for (const sx of [-1, 1]) {
      const s = new THREE.Shape(); s.moveTo(0, -h * 0.6); s.quadraticCurveTo(half * 0.6, -h * 0.9, half * 1.05, h * 1.6); s.quadraticCurveTo(half * 0.7, h * 0.2, half * 0.35, h * 0.9); s.quadraticCurveTo(half * 0.15, h * 1.1, 0, h * 1.2); s.closePath();
      mb.geo('metal', extrude(s, d * 0.55, 0.005, 10), 0, y, 0, 0, sx > 0 ? 0 : Math.PI, 0, 1, fit);
    }
  }
  // the block where blade meets guard
  mb.box('metal', 0, y + 0.006, 0, 0.06 * big, h * 1.7, d, shade(fit, -0.06));
}
function pommel(mb, P, y, tier, rar, size = 1) {
  const fit = tier === 1 ? P.dark : P.fit;
  mb.cyl('metal', 0, y + 0.02 * size, 0, 0.026 * size, 0.012 * size, fit, 16);
  if (tier === 1) { // a wheel pommel
    mb.cyl('metal', 0, y - 0.012 * size, 0, 0.04 * size, 0.034 * size, fit, 24, null, Math.PI / 2, 0, 0);
    mb.cyl('metal', 0, y - 0.012 * size, 0, 0.026 * size, 0.042 * size, shade(fit, 0.08), 16, null, Math.PI / 2, 0, 0);
  } else if (tier === 2) { // faceted scent-stopper
    mb.geo('metal', lathe([[0.001, 0.035], [0.024, 0.03], [0.042, 0.0], [0.03, -0.035], [0.012, -0.055], [0.001, -0.06]].map(([r, yy]) => [r * size, yy * size]), 8), 0, y - 0.02 * size, 0, 0, Math.PI / 8, 0, 1, fit);
  } else { // a crowned pommel with a fat gem
    mb.geo('metal', lathe([[0.001, 0.03], [0.03, 0.026], [0.05, 0.0], [0.04, -0.03], [0.018, -0.052], [0.026, -0.064], [0.001, -0.07]].map(([r, yy]) => [r * size, yy * size]), 18), 0, y - 0.016 * size, 0, 0, 0, 0, 1, fit);
  }
  if (rar >= 1 || tier === 3) gem(mb, 0, y - 0.016 * size, (tier === 1 ? 0.017 : tier === 2 ? 0.03 : 0.036) * size, 0.013 * size, rar >= 1 ? RARITY_COLORS[rar] : P.gem, fit);
}

// ---------- the weapons ----------
function sword(mb, tier, rar) {
  const P = pal(tier), R = rng(11 + tier);
  const y0 = 0.15, len = 0.97, w0 = 0.056, t0 = 0.0105;
  straightBlade(mb, P, y0, len, w0, t0, 0.55);
  // ricasso collar
  mb.box('steel', 0, y0 + 0.012, 0, w0 * 1.9, 0.024, t0 * 2.6, shade(P.flat, -0.1));
  crossguard(mb, P, 0.135, tier, 0.19);
  grip(mb, P, -0.115, 0.115, 0.021, 7, { wire: tier >= 2 ? P.fit : null });
  pommel(mb, P, -0.15, tier, rar);
  const runeCol = rar >= 2 ? RARITY_COLORS[rar] : P.rune;
  if (tier === 3 || rar >= 3) runes(mb, R, hot(runeCol, 2.4), 0, y0 + 0.06, y0 + len * 0.62, t0 * 0.55 + 0.0012, 0.024);
  else if (tier === 2) runes(mb, R, hot(shade(P.rune, -0.1), 1.0), 0, y0 + 0.06, y0 + 0.22, t0 * 0.55 + 0.0012, 0.02);
}
function greatsword(mb, tier, rar) {
  // the corrupted knights' blade: black steel veined with red embers
  const flat = '#3e3638', edge = '#b8a8a4', ember = hot('#ff3a1a', 2.6), R = rng(77);
  const P = { ...pal(1), flat, edge, dark: '#1e1a1c', fit: '#2a2224', grip: '#2a1414', wrap: '#140808' };
  const y0 = 0.24, len = 1.56, w0 = 0.078, t0 = 0.014;
  straightBlade(mb, P, y0, len, w0, t0, 0.35, { taper: 0.18, tipStart: 0.82 });
  // ember veins wandering up the fuller
  for (const sz of [-1, 1]) { let x = 0, y = y0 + 0.08; while (y < y0 + len * 0.78) { const ny = y + 0.05 + R() * 0.05, nx = Math.max(-0.02, Math.min(0.02, x + (R() - 0.5) * 0.03)); mb.rod('glow', V3(x, y, sz * (t0 * 0.5 + 0.002)), V3(nx, ny, sz * (t0 * 0.5 + 0.002)), 0.0022, ember, 5); x = nx; y = ny; } }
  // spiked guard
  const g = new THREE.Shape([V2(-0.26, 0.0), V2(-0.08, -0.03), V2(0, -0.05), V2(0.08, -0.03), V2(0.26, 0.0), V2(0.3, 0.07), V2(0.2, 0.03), V2(0.06, 0.05), V2(0, 0.08), V2(-0.06, 0.05), V2(-0.2, 0.03), V2(-0.3, 0.07)]);
  mb.geo('metal', extrude(g, 0.05, 0.006, 4), 0, 0.215, 0, 0, 0, 0, 1, '#3a2e30');
  mb.sph('gem', 0, 0.225, 0.03, 0.03, 0.03, 0.016, '#ff2a1a', 12); mb.sph('gem', 0, 0.225, -0.03, 0.03, 0.03, 0.016, '#ff2a1a', 12);
  grip(mb, P, -0.2, 0.2, 0.024, 10, { fit: '#2a2224' });
  mb.geo('metal', lathe([[0.001, 0.02], [0.034, 0.012], [0.03, -0.03], [0.012, -0.06], [0.001, -0.1]], 8), 0, -0.22, 0, 0, 0, 0, 1, '#3a2e30');
}
function cutlass(mb, tier, rar) {
  const P = { ...pal(1), flat: '#b4b6b4', edge: '#f0f0ea', fit: '#c8a048', grip: '#5a3a24' };
  const y0 = 0.15, len = 0.82;
  sabreBlade(mb, P, y0, len, 0.042, 0.009, 0.1);
  // brass shell guard and knuckle bow
  mb.geo('metal', new THREE.SphereGeometry(0.075, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), 0, 0.15, 0, Math.PI, 0, 0, [1, 0.55, 0.75], P.fit);
  const bow = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI; bow.push(V3(0.045 + Math.sin(a) * 0.05, 0.13 - (1 - Math.cos(a)) * 0.13, 0)); }
  mb.geo('metal', tube(bow, 0.008, 24, 6), 0, 0, 0, 0, 0, 0, 1, P.fit);
  mb.cyl('metal', 0, 0.135, 0, 0.02, 0.03, P.fit, 12);
  grip(mb, P, -0.11, 0.11, 0.02, 6, { wire: '#d8b858', fit: P.fit });
  mb.sph('metal', 0, -0.13, 0, 0.05, 0.04, 0.045, P.fit, 12);
}
function greataxe(mb, tier, rar) {
  const P = pal(tier), R = rng(23 + tier);
  // tapered ash haft with a slight swell, grain, grips and a steel butt cap
  const pts = []; for (let i = 0; i <= 10; i++) pts.push(V3(0, -0.34 + i * 0.176, 0));
  const haft = tube(pts, 0.027, 20, 10); { const p = haft.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 - 0.18 * ((p.getY(i) + 0.34) / 1.76); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k * 1.12); } haft.computeVertexNormals(); }
  mb.geo('wood', haft, 0, 0, 0, 0, 0, 0, 1, P.wood);
  grip(mb, P, -0.3, -0.04, 0.03, 6, { wire: tier >= 2 ? P.fit : null });
  grip(mb, P, 0.42, 0.6, 0.028, 4, { noCollar: tier === 1 });
  mb.geo('metal', lathe([[0.001, -0.06], [0.026, -0.055], [0.034, -0.03], [0.031, 0.0], [0.027, 0.012]], 16), 0, -0.34, 0, 0, 0, 0, 1, P.dark);
  if (tier >= 2) for (const y of [0.18, 0.86]) mb.cyl('metal', 0, y, 0, 0.03, 0.02, P.fit, 16);
  // the head: socket with collars, langets running down the haft
  const hy = 1.2;
  mb.cyl('metal', 0, hy, 0, 0.04, 0.23, P.dark, 16);
  for (const dy of [-0.11, 0.11]) mb.cyl('metal', 0, hy + dy, 0, 0.046, 0.022, tier === 1 ? shade(P.dark, 0.08) : P.fit, 16);
  for (const sx of [-1, 1]) { mb.box('metal', sx * 0.027, hy - 0.22, 0, 0.006, 0.22, 0.024, P.dark); mb.sph('metal', sx * 0.03, hy - 0.16, 0, 0.012, 0.012, 0.012, P.fit, 8); mb.sph('metal', sx * 0.03, hy - 0.28, 0, 0.012, 0.012, 0.012, P.fit, 8); }
  mb.geo('metal', new THREE.ConeGeometry(0.035, 0.12, 12), 0, hy + 0.17, 0, 0, 0, 0, 1, P.dark);
  // the bearded crescent bit, a wedge thinning to a honed edge, along +z
  const wedge = (u) => 1 - 0.72 * Math.min(1, Math.max(0, (u - 0.06) / 0.38));
  const head = (scale, dir) => {
    // the edge curve, and an inset curve where the flat face meets the honed bevel
    const E = new THREE.QuadraticBezierCurve(V2(0.34, 0.28), V2(0.5, 0.0), V2(0.36, -0.32)).getPoints(20);
    const I = E.map((e) => e.clone());
    for (let i = 0; i < E.length; i++) { const a = E[Math.max(0, i - 1)], b = E[Math.min(E.length - 1, i + 1)]; let nx = (b.y - a.y), ny = -(b.x - a.x); const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L; if (nx > 0) { nx = -nx; ny = -ny; } const w = 0.045 * Math.pow(Math.sin(Math.PI * i / (E.length - 1)), 0.6); I[i] = V2(E[i].x + nx * w, E[i].y + ny * w); }
    const s = new THREE.Shape(); s.moveTo(0.035, 0.1); s.quadraticCurveTo(0.2, 0.1, E[0].x, E[0].y); for (let i = 1; i < I.length; i++) s.lineTo(I[i].x, I[i].y); s.quadraticCurveTo(0.22, -0.2, 0.14, -0.13); s.quadraticCurveTo(0.08, -0.09, 0.035, -0.09); s.closePath();
    const D = 0.034, BV = 0.002;
    const g = extrude(s, D, BV, 16); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * wedge(p.getX(i)));
    g.computeVertexNormals();
    const M = MB.mat(0, hy, 0, scale, scale, 1, 0, dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    mb.add('steel', g, M, P.flat);
    // the honed bevel: from the face (full wedge thickness) down to a thin bright edge
    const fc = col(P.flat), ec = col(P.edge);
    for (const sz of [-1, 1]) {
      const pos = [], cl = [], idx = [];
      for (let i = 0; i < E.length; i++) { const t = (D / 2 + BV) * wedge(I[i].x); pos.push(I[i].x, I[i].y, sz * t, E[i].x, E[i].y, sz * 0.0008); cl.push(fc.r, fc.g, fc.b, ec.r, ec.g, ec.b); }
      for (let i = 0; i < E.length - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (sz > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); bg.setIndex(idx); bg.computeVertexNormals();
      const n = bg.attributes.normal; if (n.getZ(0) * sz < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } bg.setIndex(idx); bg.computeVertexNormals(); }
      mb.add('steel', bg, M, null);
    }
    // the very edge: a fine bright line closing the two bevels
    for (let i = 0; i < E.length - 1; i++) mb.rod('steel', V3(0, hy + E[i].y * scale, dir * E[i].x * scale), V3(0, hy + E[i + 1].y * scale, dir * E[i + 1].x * scale), 0.0012, P.edge, 4);
    return s;
  };
  head(1, 1);
  if (tier === 3) head(0.62, -1);
  else if (tier === 2) { mb.box('metal', 0, hy, -0.075, 0.07, 0.09, 0.07, P.dark); mb.box('steel', 0, hy, -0.115, 0.08, 0.1, 0.014, P.edge); } // a hammer poll
  else mb.geo('metal', new THREE.ConeGeometry(0.03, 0.15, 8), 0, hy, -0.1, -Math.PI / 2, 0, 0, 1, P.dark); // a back spike
  // decoration on the bit
  const thAt = (u) => 0.019 * wedge(u) + 0.0006;
  if (tier >= 2) for (const sx of [-1, 1]) { mb.sph('metal', sx * thAt(0.1), hy + 0.05, 0.1, 0.01, 0.018, 0.018, P.fit, 8); mb.sph('metal', sx * thAt(0.1), hy - 0.05, 0.1, 0.01, 0.018, 0.018, P.fit, 8); }
  const runeCol = rar >= 2 ? RARITY_COLORS[rar] : P.rune;
  if (tier === 3 || rar >= 3) { for (let k = 0; k < 6; k++) { const a = -0.9 + k * 0.36; const u = 0.21 + Math.cos(a) * 0.06, v = Math.sin(a) * 0.17; for (const sx of [-1, 1]) mb.box('glow', sx * thAt(u + 0.03), hy + v, u + 0.03, 0.0015, 0.026, 0.006, hot(runeCol, 2.4), R() - 0.5, 0, 0); } }
  if (rar >= 1) gem(mb, 0, hy, 0.04, 0.013, RARITY_COLORS[rar], P.fit, true, 'x');
}
function hammer(mb, tier, rar) {
  const P = pal(tier), R = rng(31 + tier);
  const pts = []; for (let i = 0; i <= 8; i++) pts.push(V3(0, -0.3 + i * 0.18, 0));
  const haft = tube(pts, 0.03, 16, 10); { const p = haft.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 - 0.12 * ((p.getY(i) + 0.3) / 1.44); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } haft.computeVertexNormals(); }
  mb.geo('wood', haft, 0, 0, 0, 0, 0, 0, 1, P.wood);
  grip(mb, P, -0.26, 0.02, 0.033, 6, { wire: tier >= 2 ? P.fit : null });
  mb.geo('metal', lathe([[0.001, -0.07], [0.03, -0.065], [0.04, -0.03], [0.036, 0.0], [0.03, 0.012]], 16), 0, -0.3, 0, 0, 0, 0, 1, P.dark);
  for (const y of [0.35, 0.7]) mb.cyl('metal', 0, y, 0, 0.033, 0.024, tier === 1 ? P.dark : P.fit, 16);
  // head: a chamfered core, banded, with flared octagonal faces either side along ±z
  const hy = 1.15;
  for (const sx of [-1, 1]) mb.box('metal', sx * 0.03, hy - 0.24, 0, 0.007, 0.28, 0.03, P.dark); // langets
  mb.box('steel', 0, hy, 0, 0.17, 0.2, 0.28, P.flat);
  for (const dz of [-0.11, 0.11]) mb.box('metal', 0, hy, dz, 0.182, 0.212, 0.03, tier === 1 ? P.dark : P.fit);
  for (const sz of [-1, 1]) {
    mb.cyl('steel', 0, hy, sz * 0.18, sz > 0 ? 0.105 : 0.125, 0.08, P.flat, 8, sz > 0 ? 0.125 : 0.105, Math.PI / 2, Math.PI / 8, 0);
    mb.cyl('steel', 0, hy, sz * 0.23, 0.128, 0.022, shade(P.flat, 0.06), 8, null, Math.PI / 2, Math.PI / 8, 0);
    mb.cyl('steel', 0, hy, sz * 0.245, 0.118, 0.012, P.edge, 8, null, Math.PI / 2, Math.PI / 8, 0); // the striking face
    mb.geo('steel', new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, hy, sz * 0.25, sz * Math.PI / 2, 0, 0, [1, 0.35, 1], shade(P.edge, -0.06));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; mb.sph('metal', Math.cos(a) * 0.1, hy + Math.sin(a) * 0.1, sz * 0.205, 0.016, 0.016, 0.016, tier === 1 ? shade(P.dark, 0.1) : P.fit, 8); }
  }
  // crown spike, side plates with runes or rivets
  mb.geo('metal', new THREE.ConeGeometry(0.045, 0.16, 8), 0, hy + 0.17, 0, 0, Math.PI / 8, 0, 1, P.dark);
  for (const sx of [-1, 1]) { mb.box('metal', sx * 0.089, hy, 0, 0.012, 0.15, 0.17, tier === 1 ? P.dark : shade(P.fit, -0.08)); for (const [dy, dz] of [[-0.06, -0.07], [0.06, -0.07], [-0.06, 0.07], [0.06, 0.07]]) mb.sph('metal', sx * 0.096, hy + dy, dz, 0.012, 0.012, 0.012, P.fit, 8); }
  const runeCol = rar >= 2 ? RARITY_COLORS[rar] : P.rune;
  if (tier === 3 || rar >= 3) for (const off of [-0.052, 0.052]) runes(mb, R, hot(runeCol, 2.4), off, hy - 0.06, hy + 0.06, 0.0965, 0.024, 'x');
  if (rar >= 1) gem(mb, 0, hy, 0.097, 0.016, RARITY_COLORS[rar], P.fit, true, 'x');
}
function club(mb) {
  // a knotty cudgel: a lumpy tapered log, iron band and nails, a rag-wrapped grip
  const R = rng(5); const pts = [];
  const prof = [[0.026, -0.18], [0.03, -0.14], [0.032, 0.1], [0.04, 0.4], [0.055, 0.65], [0.075, 0.9], [0.085, 1.08], [0.07, 1.18], [0.03, 1.22], [0.001, 1.225]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => V2(r, y)), 14); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.16 * Math.sin(a * 3 + y * 9) * Math.min(1, Math.max(0, (y - 0.2) * 2)) + 0.06 * Math.sin(a * 5 - y * 17); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  g.computeVertexNormals(); mb.add('wood', g, new THREE.Matrix4(), '#7a5634');
  for (let k = 0; k < 4; k++) { const y = 0.5 + k * 0.17, a = R() * 6.28; mb.sph('wood', Math.cos(a) * 0.05, y, Math.sin(a) * 0.05, 0.04, 0.05, 0.04, '#6a482a', 8); }
  mb.cyl('metal', 0, 0.78, 0, 0.074, 0.04, '#4a4644', 16);
  for (let k = 0; k < 9; k++) { const a = k * 2.4, y = 0.86 + (k % 3) * 0.1; const d = V3(Math.cos(a), 0.15, Math.sin(a)).normalize(); const r = 0.08;
    mb.add('metal', new THREE.ConeGeometry(0.013, 0.07, 6), new THREE.Matrix4().compose(V3(d.x * r, y, d.z * r), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d), V3(1, 1, 1)), '#5a5654'); }
  grip(mb, { grip: '#8a7a62', fit: '#4a4644' }, -0.16, 0.12, 0.033, 5, { noCollar: true });
}
function staff(mb, tier, rar) {
  const P = pal(tier), R = rng(41 + tier);
  // a slightly crooked shaft
  const pts = []; for (let i = 0; i <= 8; i++) pts.push(V3(i > 0 && i < 8 ? (R() - 0.5) * 0.016 : 0, -0.42 + i * 0.2, i > 0 && i < 8 ? (R() - 0.5) * 0.016 : 0));
  const sh = tube(pts, 0.026, 32, 10); { const p = sh.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 - 0.22 * ((p.getY(i) + 0.42) / 1.6); p.setX(i, p.getX(i) * k + 0); p.setZ(i, p.getZ(i) * k); } sh.computeVertexNormals(); }
  mb.geo('wood', sh, 0, 0, 0, 0, 0, 0, 1, P.wood);
  // ferrule, grips, bands
  mb.geo('metal', lathe([[0.001, -0.08], [0.018, -0.07], [0.028, -0.02], [0.027, 0.0]], 12), 0, -0.42, 0, 0, 0, 0, 1, tier === 1 ? P.dark : P.fit);
  grip(mb, P, 0.08, 0.36, 0.025, 7, { col: tier === 1 ? '#c8b088' : P.grip, wrap: tier === 1 ? '#a08a64' : null, wire: tier === 3 ? P.fit : null });
  const bandCol = tier === 1 ? '#7a6a52' : P.fit;
  for (const y of [-0.2, 0.62, 0.95]) mb.cyl('metal', 0, y, 0, 0.024, 0.02, bandCol, 16);
  if (tier === 3) mb.geo('metal', helix(0.0235, 0.4, 1.12, 3.5, 0.0035), 0, 0, 0, 0, 0, 0, 1, P.fit); // gold filigree
  // the head: a collar and four curling prongs cradling the stone
  const hy = 1.2;
  mb.geo('metal', lathe([[0.022, -0.04], [0.032, -0.02], [0.04, 0.02], [0.03, 0.05], [0.02, 0.06]], 16), 0, hy - 0.02, 0, 0, 0, 0, 1, tier === 1 ? '#6a5a44' : P.fit);
  const prong = tier === 1 ? P.woodDark : P.fit, key = tier === 1 ? 'wood' : 'metal';
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2 + Math.PI / 4; const c = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; const r = 0.03 + Math.sin(u * Math.PI * 0.95) * 0.08 - (u > 0.8 ? (u - 0.8) * 0.15 : 0); c.push(V3(Math.cos(a) * r, hy + 0.03 + u * 0.32, Math.sin(a) * r)); }
    mb.geo(key, tube(c, tier === 1 ? 0.011 : 0.0085, 20, 6), 0, 0, 0, 0, 0, 0, 1, prong);
    const e = c[c.length - 1]; mb.sph(key, e.x, e.y, e.z, 0.018, 0.018, 0.018, prong, 8);
  }
  if (tier >= 2) { const ring = new THREE.TorusGeometry(0.105, 0.006, 6, 32); mb.geo('metal', ring, 0, hy + 0.2, 0, Math.PI / 2, 0, 0, 1, P.fit); }
  const runeCol = rar >= 2 ? RARITY_COLORS[rar] : P.rune;
  if (tier === 3 || rar >= 3) for (let k = 0; k < 8; k++) { const y = 0.45 + k * 0.07; for (const sz of [-1, 1]) mb.box('glow', 0, y, sz * 0.0235, 0.008, 0.026, 0.002, hot(runeCol, 2.4), 0, 0, (k % 2 ? 0.5 : -0.5)); }
  if (rar >= 1) for (const y of [0.62, 0.95]) mb.cyl('glow', 0, y, 0, 0.0248, 0.006, hot(RARITY_COLORS[rar], 2), 16);
}
// the staff's stone (kept separate so the game can pulse or spin it)
function staffGem(tier, ctx) {
  const P = pal(tier); const c = ['#ff7a2a', '#6ac8ff', '#c66dff'][Math.max(0, Math.min(2, tier - 1))];
  const mb = new MB();
  const g = new THREE.OctahedronGeometry(0.075, 0); g.scale(1, 1.55, 1);
  mb.add('gem', g, MB.mat(0, 0, 0, 1, 1, 1, 0, Math.PI / 4, 0), c);
  mb.sph('glow', 0, 0, 0, 0.07, 0.1, 0.07, hot(c, 2.2), 8);
  const grp = mb.build(ctx, { castShadow: false });
  // a soft halo
  const sp = new THREE.Sprite(haloMat(c)); sp.scale.setScalar(0.42); grp.add(sp);
  grp.position.y = 1.42;
  return grp;
}
const halos = new Map();
function haloMat(c) {
  let m = halos.get(c); if (m) return m;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); const cc = col(c); const rgb = `${(cc.r * 255) | 0},${(cc.g * 255) | 0},${(cc.b * 255) | 0}`;
  gr.addColorStop(0, `rgba(${rgb},0.85)`); gr.addColorStop(0.35, `rgba(${rgb},0.3)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  halos.set(c, m); return m;
}

// recurve bow: limbs swept back toward the archer (-z), tips recurving; tips sit at z = -0.24 where the string rests
const BOW_TIP_Y = 0.6, BOW_TIP_Z = -0.24;
function bowLimbZ(s) { // s: 0 at the riser end, 1 at the tip
  const back = -0.31 * Math.pow(s, 1.5);
  const curl = s > 0.72 ? 0.07 * Math.pow((s - 0.72) / 0.28, 2) : 0;
  return back + curl;
}
function bow(mb, tier, rar) {
  const P = pal(tier), R = rng(51 + tier);
  const limb = tier === 1 ? '#a0784a' : tier === 2 ? '#4a3428' : '#4a2e4a';
  const belly = tier === 1 ? '#c8a878' : tier === 2 ? '#c5cfdc' : '#f0c860';
  const PROF = [[[1, 0], [1, 0.55], [0.75, 1], [-0.75, 1], [-1, 0.55], [-1, 0]]];
  for (const sy of [-1, 1]) {
    const st = []; const N = 18; const r0 = 0.14;
    for (let k = 0; k <= N; k++) { const s = k / N; const y = sy * (r0 + (BOW_TIP_Y - r0) * s); st.push({ y, w: 0.026 * (1 - 0.5 * s), t: 0.013 * (1 - 0.35 * s), z: bowLimbZ(s) + 0.0 }); }
    if (sy < 0) st.reverse();
    loft(mb, 'wood', st, PROF, [limb]);
    // a laminated belly strip on the archer's side
    const st2 = st.map((q) => ({ y: q.y, w: q.w * 0.7, t: 0.004, z: q.z - q.t + 0.001 }));
    loft(mb, tier === 1 ? 'wood' : 'metal', st2, [[[1, 0], [1, 1], [-1, 1], [-1, 0]]], [belly]);
    // tip caps (nocks)
    mb.sph('metal', 0, sy * BOW_TIP_Y, BOW_TIP_Z, 0.016, 0.03, 0.02, tier === 1 ? '#e8dcc0' : P.fit, 8);
    // a little limb bolster where it meets the riser
    mb.box('metal', 0, sy * 0.15, 0.0, 0.05, 0.03, 0.04, tier === 1 ? P.dark : P.fit);
    if (tier === 3 || rar >= 3) { const rc = hot(rar >= 2 ? RARITY_COLORS[rar] : P.rune, 2.4); for (let k = 0; k < 5; k++) { const s = 0.15 + k * 0.14; mb.box('glow', 0, sy * (0.14 + (BOW_TIP_Y - 0.14) * s), bowLimbZ(s) + 0.013 * (1 - 0.35 * s) + 0.0015, 0.008, 0.024, 0.0015, rc, 0, 0, 0.5); } }
  }
  // the riser: a thicker carved handle with a leather grip and an arrow shelf
  const rs = new THREE.Shape(); rs.moveTo(-0.02, -0.16); rs.quadraticCurveTo(-0.045, 0, -0.02, 0.16); rs.lineTo(0.02, 0.16); rs.quadraticCurveTo(0.05, 0.0, 0.02, -0.16); rs.closePath();
  mb.geo('wood', extrude(rs, 0.044, 0.006, 8), 0, 0, 0, 0, Math.PI / 2, 0, [1, 1, 1], tier === 1 ? '#7a5634' : tier === 2 ? '#6a4c36' : '#6a466a');
  grip(mb, P, -0.07, 0.06, 0.027, 5, { noCollar: true });
  mb.box('metal', 0.02, 0.075, 0, 0.014, 0.014, 0.05, P.fit);
  if (rar >= 1) gem(mb, 0, 0.11, 0.03, 0.011, RARITY_COLORS[rar], P.fit, false);
}
// the bow string: two segments from the nocking point (the string object's origin) to the fixed tips. The game
// moves `string.position.z` back to draw; the segments re-aim every frame so the string stays on the tips.
const strGeo = new THREE.CylinderGeometry(0.0032, 0.0032, 1, 5, 1);
function makeString(tier, ctx) {
  const m = itemMat('paint', ctx);
  const nock = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.08, 6), m);
  nock.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(nock.geometry.attributes.position.count * 3).fill(0).map((_, i) => [0.75, 0.15, 0.12][i % 3]), 3));
  const sc = tier === 3 ? [1, 0.9, 0.6] : [0.95, 0.92, 0.82];
  const segGeo = strGeo.clone(); segGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(segGeo.attributes.position.count * 3).fill(0).map((_, i) => sc[i % 3]), 3));
  const up = new THREE.Mesh(segGeo, m), dn = new THREE.Mesh(segGeo, m);
  nock.add(up, dn);
  nock.userData.keep = true; nock.name = 'bowstring';
  nock.position.z = BOW_TIP_Z;
  attachStringRig(nock);
  return nock;
}
const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function attachStringRig(nock) {
  const [up, dn] = nock.children;
  const layout = () => {
    const dz = BOW_TIP_Z - nock.position.z;
    for (const [seg, sy] of [[up, 1], [dn, -1]]) {
      _d.set(0, sy * BOW_TIP_Y, dz); const L = _d.length();
      seg.position.copy(_d).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(_up, _a.copy(_d).normalize());
      seg.scale.set(1, L, 1);
    }
  };
  nock.updateMatrixWorld = function (force) { layout(); THREE.Object3D.prototype.updateMatrixWorld.call(this, force); };
  layout();
}

function shield(mb, tier, rar) {
  const P = pal(tier), R = rng(61 + tier);
  // heater shield, face toward +z, the board bowed back round the arm
  const s = new THREE.Shape(); s.moveTo(-0.3, 0.34); s.quadraticCurveTo(0, 0.4, 0.3, 0.34); s.lineTo(0.31, 0.06); s.quadraticCurveTo(0.29, -0.24, 0, -0.42); s.quadraticCurveTo(-0.29, -0.24, -0.31, 0.06); s.closePath();
  const D = 0.036, BV = 0.008; const bowZ = (x) => -x * x * 0.55;
  const board = extrude(s, D, BV, 16, 2); { const p = board.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + bowZ(p.getX(i))); board.computeVertexNormals(); }
  const field = ['#2c5a8e', '#1c2846', '#8c1e1c'][tier - 1];
  mb.add('planks', board, new THREE.Matrix4(), ['#8a6440', '#5a4030', '#5a3a2a'][tier - 1]);
  const front = (x) => D / 2 + BV + bowZ(x);
  // a painted leather facing, a little inset
  const face = new THREE.Shape(s.getPoints(16).map((p) => V2(p.x * 0.94, p.y * 0.94 + 0.002)));
  const fg = new THREE.ShapeGeometry(face, 16); { const p = fg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, front(p.getX(i)) + 0.0015); fg.computeVertexNormals(); }
  mb.add('planks', fg, new THREE.Matrix4(), field);
  // heraldry
  const charge = ['#e8dcb8', '#d8e2ee', '#f2c95a'][tier - 1];
  const onFace = (g, z = 0.003) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + front(p.getX(i)) + z); g.computeVertexNormals(); return g; };
  if (tier === 1) { // a chevron
    const chev = new THREE.ShapeGeometry(new THREE.Shape([V2(-0.23, -0.1), V2(0, 0.14), V2(0.23, -0.1), V2(0.19, -0.17), V2(0, 0.03), V2(-0.19, -0.17)]), 1);
    mb.add('paint', onFace(chev), new THREE.Matrix4(), charge);
  } else if (tier === 2) { // an eight-pointed star
    const st = new THREE.Shape(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.055 : 0.15; const x = Math.cos(a) * r, y = 0.03 + Math.sin(a) * r; if (k) st.lineTo(x, y); else st.moveTo(x, y); } st.closePath();
    const g = extrude(st, 0.006, 0.002, 1, 1); g.translate(0, 0, 0.003); mb.add('metal', onFace(g), new THREE.Matrix4(), charge);
  } else { // a gilded sun with rays
    const sun = new THREE.Shape(); for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, r = k % 2 ? 0.1 : 0.18; const x = Math.cos(a) * r, y = 0.03 + Math.sin(a) * r; if (k) sun.lineTo(x, y); else sun.moveTo(x, y); } sun.closePath();
    const g = extrude(sun, 0.006, 0.002, 1, 1); g.translate(0, 0, 0.003); mb.add('metal', onFace(g), new THREE.Matrix4(), charge);
  }
  // the rim: a metal band round the edge with rivets
  const rimCol = tier === 1 ? '#6a6660' : P.fit;
  const out = s.getPoints(20); if (out[0].distanceTo(out[out.length - 1]) < 1e-4) out.pop();
  const rimPts = out.map((p) => V3(p.x, p.y, bowZ(p.x) * 1.0 + 0.004));
  mb.geo('metal', tube(rimPts, 0.019, 96, 8, true), 0, 0, 0, 0, 0, 0, 1, rimCol);
  for (let i = 0; i < out.length; i += 2) { const p = out[i]; const x = p.x * 0.955, y = p.y * 0.955 + 0.002; mb.sph('metal', x, y, front(x) + 0.004, 0.018, 0.018, 0.011, shade(rimCol, 0.1), 8); }
  // the boss
  const bossY = 0.03;
  mb.cyl('metal', 0, bossY, front(0) + 0.004, 0.072, 0.01, shade(rimCol, -0.08), 24, null, Math.PI / 2, 0, 0);
  mb.geo('metal', new THREE.SphereGeometry(0.058, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, bossY, front(0) + 0.008, Math.PI / 2, 0, 0, [1, 0.7, 1], tier === 1 ? '#8a8680' : P.fit);
  if (rar >= 1) mb.sph('gem', 0, bossY, front(0) + 0.05, 0.034, 0.034, 0.022, RARITY_COLORS[rar], 12);
  if (tier === 3 || rar >= 3) { const rc = hot(rar >= 2 ? RARITY_COLORS[rar] : P.rune, 2.2); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; const x = Math.cos(a) * 0.215, y = bossY + Math.sin(a) * 0.215; if (y < -0.3) continue; mb.box('glow', x, y, front(x) + 0.006, 0.006, 0.022, 0.002, rc, 0, 0, a + (R() - 0.5)); } }
  // the back: leather arm straps and a grip bar
  const back = (x) => -D / 2 - BV + bowZ(x);
  for (const y of [0.12, -0.1]) mb.box('leather', 0, y, back(0) - 0.006, 0.26, 0.045, 0.012, '#5a3a22');
  mb.cyl('wood', 0.0, 0.01, back(0) - 0.035, 0.016, 0.16, '#6a4a2c', 10);
  for (const y of [-0.07, 0.09]) mb.box('metal', 0, y, back(0) - 0.02, 0.03, 0.025, 0.04, rimCol);
}

const BUILDERS = { sword, greatsword, cutlass, greataxe, hammer, club, staff, bow, shield };

// ---------- assembly, caching ----------
const cache = new Map();
function template(type, tier, rar, ctx) {
  const key = type + '|' + tier + '|' + rar + '|' + ctx;
  let t = cache.get(key); if (t) return t;
  const mb = new MB();
  (BUILDERS[type] || sword)(mb, tier, rar);
  t = mb.build(ctx);
  t.name = 'weapon-' + type;
  cache.set(key, t);
  return t;
}
// A ready model: grip at origin, business end along +y. opts: { rarity, ctx: 'world' | 'icon', raw: true to skip rotation }
export function buildWeapon(type, tier = 1, opts = {}) {
  tier = Math.max(1, Math.min(3, tier | 0 || 1));
  const rar = Math.max(0, Math.min(4, opts.rarity | 0));
  const ctx = opts.ctx || 'world';
  const g = new THREE.Group(); g.name = 'weapon-' + type;
  for (const c of template(type, tier, rar, ctx).children) { const m = new THREE.Mesh(c.geometry, c.material); m.castShadow = c.castShadow; m.receiveShadow = true; m.name = c.name; g.add(m); }
  if (type === 'staff') { const gm = staffGem(tier, ctx); gm.userData.keep = true; g.add(gm); g.userData.gem = gm; }
  if (type === 'bow') { const s = makeString(tier, ctx); g.add(s); g.userData.string = s; }
  if (!opts.raw && type !== 'shield' && type !== 'bow') g.rotation.x = Math.PI / 2;
  return g;
}
