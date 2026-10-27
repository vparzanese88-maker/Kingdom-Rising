// Kingdom Rising 3D — ships for the harbours: rowboats, a fishing sloop with a lateen sail, round-bellied
// cogs with castles fore and aft, and three-masted galleons. Curved plank hulls (tarred below the waterline,
// a painted band along the top), decks, masts and yards, billowing sails, rigging, lanterns and pennants.
// Local frame: bow toward +z, the waterline at y = 0.
import { THREE, K3 } from './core.js';
import { MB, PRIM } from './mb.js';

const SIZES = {
  rowboat: { L: 4.2, B: 1.5, D: 0.75, gun: 0.42, sheer: 0.18, masts: [] },
  sloop: { L: 9, B: 2.8, D: 1.4, gun: 0.75, sheer: 0.35, masts: [{ z: 0.6, h: 8.5, lateen: true }] },
  cog: { L: 14, B: 5, D: 2.6, gun: 1.55, sheer: 0.6, masts: [{ z: 0.4, h: 13, sail: [6.4, 6.2] }], castles: true },
  galleon: { L: 24, B: 7, D: 3.8, gun: 2.3, sheer: 1.0, masts: [{ z: -5.5, h: 15, sail: [6, 5.4] }, { z: 1.2, h: 20, sail: [9, 7], top: [6.4, 4.6] }, { z: 7.2, h: 16, sail: [7, 5.6] }], castles: true, bowsprit: true, galleon: true },
};
const SAIL_COLS = ['#efe6cc', '#e8dcc0', '#d8c8a0', '#efe6cc'];
const STRAKE = ['#7a1e1e', '#1e3a6a', '#2e5a3a', '#6a4a1a', '#3a2a4a', '#8a6a2a'];

// half-beam and keel depth along the hull, t = 0 at the stern, 1 at the bow
const beamAt = (t) => (t < 0.62 ? 0.78 + 0.22 * Math.sin((t / 0.62) * Math.PI / 2) : Math.pow(Math.cos(((t - 0.62) / 0.38) * Math.PI / 2), 0.75));
// one band of the hull between angles a0..a1 (0 = keel, PI/2 = gunwale), both sides
function hullBand(S, a0, a1) {
  const NS = 22, NA = 5, pos = [], idx = [];
  const ring = (t, a, side) => {
    const z = (t - 0.5) * S.L, beam = (S.B / 2) * beamAt(t);
    const sh = S.sheer * Math.pow(2 * t - 1, 2) + (t > 0.9 ? (t - 0.9) * S.sheer * 3 : 0);
    const gun = S.gun + sh, keel = -S.D * 0.55 * (0.7 + 0.3 * Math.sin(t * Math.PI));
    const x = side * beam * Math.pow(Math.sin(a), 0.6), y = keel + (gun - keel) * (1 - Math.cos(a));
    return [x, y, z];
  };
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NA; j++) { const p = ring(i / NS, a0 + (a1 - a0) * (j / NA), side); pos.push(...p); }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) {
      const a = base + i * (NA + 1) + j, b = a + NA + 1;
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// the flat stern (transom) and the deck
function transomGeom(S) {
  const pos = [], idx = []; const NA = 8; const keel = -S.D * 0.55 * 0.7, gun = S.gun + S.sheer, beam = (S.B / 2) * beamAt(0), z = -S.L / 2;
  pos.push(0, (keel + gun) / 2, z);
  for (let j = 0; j <= NA * 2; j++) { const a = (j / (NA * 2)) * Math.PI - Math.PI / 2; const side = a < 0 ? -1 : 1; const aa = Math.abs(a); const x = side * beam * Math.pow(Math.sin(Math.PI / 2 - aa), 0.6); const y = keel + (gun - keel) * (1 - Math.cos(Math.PI / 2 - aa)); pos.push(x, y, z); }
  for (let j = 1; j <= NA * 2; j++) idx.push(0, j + 1, j);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function deckGeom(S, drop = 0.12) {
  const NS = 22, pos = [], idx = [];
  for (let i = 0; i <= NS; i++) { const t = i / NS; const z = (t - 0.5) * S.L; const b = (S.B / 2) * beamAt(t) * 0.96; const sh = S.sheer * Math.pow(2 * t - 1, 2) * 0.55; const y = S.gun + sh - drop; pos.push(-b, y, z, b, y, z); }
  for (let i = 0; i < NS; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const uv = new Float32Array((NS + 1) * 4); for (let i = 0; i <= NS; i++) { uv[i * 4] = 0; uv[i * 4 + 1] = i * S.L / NS / 2; uv[i * 4 + 2] = S.B / 2; uv[i * 4 + 3] = i * S.L / NS / 2; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
// a sail that bellies forward in the wind: w wide, h tall, its top edge centred on the origin
function sailGeom(w, h, belly, tri) {
  const NX = 8, NY = 8, pos = [], idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const u = i / NX, v = j / NY; let x = (u - 0.5) * w; if (tri) x = (u - 0.5) * w * (1 - v) + (tri === 2 ? 0 : 0);
    const y = -v * h; const z = belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)) * (tri ? 1 - v * 0.5 : 1);
    pos.push(x, y, z);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + NX + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const cache = new Map();
const lineMat = new THREE.LineBasicMaterial({ color: 0x2a1e14 });
export function buildShip(size, v = 0) {
  const S = SIZES[size] || SIZES.sloop; const variant = Math.floor(v * 6) % 6; const key = size + ':' + variant;
  let c = cache.get(key); if (c) return c.clone();
  const r = K3.rng(variant * 977 + size.length);
  const mb = new MB(); const M = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => MB.mat(x, y, z, sx, sy, sz, ry, rx, rz);
  const hullCol = ['#5a3a20', '#6a4424', '#4a3020', '#7a5030'][variant % 4], strake = STRAKE[variant];
  // the hull: tar below the waterline, planks above, a painted band at the top
  mb.add('dark', hullBand(S, 0, 0.55), M(0, 0, 0), '#1e1612', 'world');
  mb.add('planks', hullBand(S, 0.55, 1.32), M(0, 0, 0), hullCol, 'world');
  mb.add('paint', hullBand(S, 1.32, Math.PI / 2), M(0, 0, 0), strake, 'world');
  mb.add('planks', transomGeom(S), M(0, 0, 0), hullCol, 'world');
  mb.add('planks', deckGeom(S), M(0, 0, 0), '#9a7448', 'world');
  // rails along the gunwales
  for (const side of [-1, 1]) for (let i = 0; i < 12; i++) { const t0 = (i + 0.5) / 12; const z = (t0 - 0.5) * S.L, b = (S.B / 2) * beamAt(t0), y = S.gun + S.sheer * Math.pow(2 * t0 - 1, 2); mb.add('timber', PRIM.box, M(side * b * 0.97, y + 0.06, z, 0.09, 0.12, S.L / 12 + 0.05, side * (t0 > 0.62 ? -(t0 - 0.62) * 2.2 : 0)), '#4a2e18'); }
  if (size === 'rowboat') {
    for (const z of [-0.6, 0.6]) mb.add('planks', PRIM.box, M(0, S.gun - 0.15, z, S.B * 0.8, 0.06, 0.32), '#8a6440');
    for (const side of [-1, 1]) { mb.add('timber', PRIM.cyl8, M(side * (S.B / 2 + 0.7), 0.25, 0.1, 0.05, 2.6, 0.05, 0, 0, side * 1.25), '#8a6440'); mb.add('planks', PRIM.box, M(side * (S.B / 2 + 1.6), -0.02, 0.1, 0.4, 0.04, 0.16, 0, 0, side * 1.25), '#8a6440'); }
    mb.add('planks', PRIM.box, M(0, S.gun - 0.05, -1.3, 0.5, 0.35, 0.4), '#7a5a34');
  }
  // castles fore and aft (cogs and galleons): raised decks with rails, the stern one with windows and lanterns
  if (S.castles) {
    const sh = S.galleon ? 2.4 : 1.7, sl = S.L * (S.galleon ? 0.26 : 0.22), sb = S.B * 0.82, sz = -S.L / 2 + sl / 2 + 0.2, top = S.gun + S.sheer;
    mb.add('planks', PRIM.box, M(0, top + sh / 2 - 0.1, sz, sb, sh, sl), hullCol);
    mb.add('paint', PRIM.box, M(0, top + sh - 0.12, sz, sb + 0.06, 0.22, sl + 0.06), strake);
    mb.add('planks', PRIM.box, M(0, top + sh + 0.02, sz, sb - 0.1, 0.08, sl - 0.1), '#9a7448');
    for (let k = 0; k < (S.galleon ? 4 : 2); k++) mb.add('glow', PRIM.box, M(-sb / 2 + sb * (k + 0.5) / (S.galleon ? 4 : 2), top + sh * 0.55, -S.L / 2 + 0.17, 0.38, 0.5, 0.05), '#ffc870');
    for (const side of [-1, 1]) mb.add('timber', PRIM.box, M(side * sb / 2, top + sh + 0.35, sz, 0.08, 0.5, sl), '#4a2e18');
    mb.add('metalv', PRIM.cyl8, M(0, top + sh + 0.9, -S.L / 2 + 0.3, 0.3, 0.55, 0.3), '#3a3a3a'); mb.add('glow', PRIM.sph12, M(0, top + sh + 0.9, -S.L / 2 + 0.3, 0.22, 0.3, 0.22), '#ffd080');
    const fl = S.L * 0.16, fz = S.L / 2 - fl / 2 - S.L * 0.06, fh = sh * 0.75, fb = (S.B / 2) * beamAt((fz / S.L) + 0.5) * 1.8;
    mb.add('planks', PRIM.box, M(0, top + S.sheer * 0.6 + fh / 2 - 0.1, fz, fb, fh, fl), hullCol);
    mb.add('paint', PRIM.box, M(0, top + S.sheer * 0.6 + fh - 0.12, fz, fb + 0.06, 0.2, fl + 0.06), strake);
    // cargo on deck
    for (let k = 0; k < 4; k++) { const z = -S.L * 0.15 + k * S.L * 0.09, x = (r() - 0.5) * S.B * 0.4; mb.add(k % 2 ? 'planks' : 'planks', k % 2 ? PRIM.cyl12 : PRIM.box, M(x, S.gun + 0.35, z, 0.75, 0.75, 0.75), k % 2 ? '#8a5e34' : '#9a7344'); }
  }
  if (S.bowsprit) mb.add('timber', PRIM.cyl8, M(0, S.gun + S.sheer + 1.2, S.L / 2 + 2.2, 0.22, 6.5, 0.22, 0, Math.PI / 2 - 0.45), '#4a2e18');
  // masts, yards and sails
  const lines = []; const sailCol = SAIL_COLS[variant % 4];
  for (const m of S.masts) {
    const base = S.gun - 0.1, topY = base + m.h;
    mb.add('timber', PRIM.cyl8, M(0, base + m.h / 2, m.z, 0.32 * (m.h / 12), m.h, 0.32 * (m.h / 12)), '#5a3a20');
    if (m.lateen) {
      // a triangular lateen sail on a long slanted yard
      mb.add('timber', PRIM.cyl8, M(0, base + m.h * 0.62, m.z - 0.4, 0.1, m.h * 1.05, 0.1, 0, 1.05), '#5a3a20');
      const g = sailGeom(4.6, 6.4, 0.6, 1); mb.add('cloth2', g, M(0.12, base + m.h * 0.88, m.z - 1.6, 1, 1, 1, Math.PI / 2, 0, 0.35), sailCol, 'world');
    } else {
      const [sw, sh] = m.sail; const yy = topY - (m.top ? m.top[1] + 1.2 : 1.0);
      mb.add('timber', PRIM.cyl8, M(0, yy, m.z + 0.25, 0.14, sw + 0.8, 0.14, 0, 0, Math.PI / 2), '#5a3a20');
      mb.add('cloth2', sailGeom(sw, sh, sw * 0.12), M(0, yy - 0.1, m.z + 0.35), sailCol, 'world');
      // a red cross on the galleon's main course
      if (S.galleon && m.top) { mb.add('paint', PRIM.box, M(0, yy - sh * 0.48, m.z + 0.35 + sw * 0.12 + 0.03, 0.55, sh * 0.8, 0.02), '#a82a2a'); mb.add('paint', PRIM.box, M(0, yy - sh * 0.48, m.z + 0.35 + sw * 0.12 + 0.03, sw * 0.75, 0.55, 0.02), '#a82a2a'); }
      if (m.top) { const ty = topY - 0.5; mb.add('timber', PRIM.cyl8, M(0, ty, m.z + 0.2, 0.1, m.top[0] + 0.6, 0.1, 0, 0, Math.PI / 2), '#5a3a20'); mb.add('cloth2', sailGeom(m.top[0], m.top[1], m.top[0] * 0.1), M(0, ty - 0.1, m.z + 0.3), sailCol, 'world'); mb.add('planks', PRIM.cyl12, M(0, yy + 0.9, m.z, 1.2, 0.15, 1.2), '#5a3a20'); }
    }
    // a pennant at the masthead
    mb.add('cloth2', PRIM.box, M(0, topY + 0.25, m.z - 0.9, 0.03, 0.35, 1.8, 0, 0, 0), STRAKE[(variant + 2) % 6]);
    // rigging: stays fore and aft, shrouds to both sides
    const bowZ = S.L / 2 + (S.bowsprit ? 4.5 : 0), bowY = S.gun + S.sheer + (S.bowsprit ? 2.5 : 0);
    lines.push(0, topY, m.z, 0, bowY, Math.min(bowZ, m.z + S.L * 0.6));
    lines.push(0, topY, m.z, 0, S.gun + S.sheer, Math.max(-S.L / 2, m.z - S.L * 0.45));
    for (const side of [-1, 1]) for (const dz of [-0.9, 0, 0.9]) { const t = (m.z + dz) / S.L + 0.5; lines.push(0, topY - 0.4, m.z, side * (S.B / 2) * beamAt(Math.min(0.99, Math.max(0, t))), S.gun + 0.05, m.z + dz); }
  }
  const g = mb.build();
  if (lines.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)); const ls = new THREE.LineSegments(lg, lineMat); g.add(ls); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.ship = size; g.userData.draft = S.D * 0.55;
  cache.set(key, g);
  return g.clone();
}
export const SHIP_SIZES = SIZES;
K3.buildShip = buildShip;
