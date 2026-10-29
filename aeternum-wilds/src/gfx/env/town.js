// Aeternum Wilds — Windsward Outpost: timber-framed plaster cottages with tiled, thatched and slate roofs,
// chimneys, shuttered windows that glow at night, doors with porches and lanterns; a log palisade with four
// roofed gate towers; the forge, refinery and kitchen; the market stall, bounty board, campfire, flag, well,
// carts, barrels and crates. Almost everything is merged into one mesh per material (a dozen draw calls).
import * as THREE from 'three';
import { ENV, U, rng, shade, col } from './shared.js';
import { MB, PRIM } from './mb.js';
import { mats } from './mats.js';
import { canvasTex } from './tex.js';
import { addFlame, addLightPool, addFireLight } from './fire.js';
import { addTree } from './veg.js';

const TOWN_R = 42;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// world footprint (x extent W, z extent D) as before; each house turns its door toward the town centre
const HOUSE_LIST = [
  [-24, -20, 7, 6, 0, 2], [24, -22, 6, 6, 1, 1], [-26, 4, 6, 7, 2, 2], [26, 20, 7, 5, 3, 1],
  [-20, 26, 6, 6, 1, 1], [18, -32, 5, 4, 2, 1], [-12, -30, 6, 5, 0, 1], [31, 2, 5, 6, 3, 2],
];
const STYLES = [
  { wall: '#efe4cc', beam: '#5a3c26', roofMat: 'rooftile', roof: '#c8684a', shutter: '#3e6e44', door: '#7a4a2a' },
  { wall: '#e8cf9a', beam: '#6a4a2e', roofMat: 'thatch', roof: '#d8c08a', shutter: '#35588a', door: '#6a4024' },
  { wall: '#f4f0e6', beam: '#3e2c20', roofMat: 'slate', roof: '#8a98aa', shutter: '#8a3a2e', door: '#5a3a24' },
  { wall: '#efd4c4', beam: '#5e4030', roofMat: 'shingle', roof: '#b08a68', shutter: '#4a7a5a', door: '#7a5232' },
];
export const TOWN_HOUSES = HOUSE_LIST.map(([x, z, W, D, st, fl]) => {
  const ang = Math.atan2(-x, -z); const q = ((Math.round(ang / (Math.PI / 2)) % 4) + 4) % 4; const ry = q * Math.PI / 2;
  const side = q % 2 === 1; const w = side ? D : W, d = side ? W : D;
  const fx = Math.sin(ry), fz = Math.cos(ry);
  return { x, z, w: W, d: D, lw: w, ld: d, ry, style: STYLES[st], floors: fl, door: { x: x + fx * (d / 2 + 0.9), z: z + fz * (d / 2 + 0.9) } };
});
export const SMOKE_SOURCES = [];
export const TOWN = { flag: null, flames: [] };

// ---------- helpers ----------
function quad(mb, key, p0, p1, p2, p3, uvs, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z]), 3));
  const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0)).normalize();
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
  mb.add(key, g, new THREE.Matrix4(), color, 'local');
}
function prism(mb, key, pts, depth, m, color) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  mb.add(key, g, m, color); g.dispose();
}
// copy a locally built model into another builder under matrix m (keeping its own uvs and colours)
function place(dst, src, m) { for (const p of src.parts.values()) if (p.n) { const g = MB.geo(p); dst.add(p.key, g, m, null, 'local'); g.dispose(); } }
const mT = (x, y, z, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);

// ---------- a cottage, built around its own origin, front (door) toward +z ----------
function cottage(h, seed) {
  const mb = new MB(); const R = rng(seed); const st = h.style;
  const w = h.lw, d = h.ld; const two = h.floors === 2;
  const y0 = 0.55, y1 = two ? 3.25 : 3.35, jet = two ? 0.32 : 0, y2 = two ? 5.75 : y1;
  const wc = st.wall, bc = st.beam;
  // stone plinth, half sunk
  mb.box('fieldstone', 0, y0 / 2 - 0.45, 0, w + 0.24, y0 + 0.9, d + 0.24, '#b0a898');
  // walls
  mb.box('plaster', 0, (y0 + y1) / 2, 0, w, y1 - y0, d, wc);
  if (two) mb.box('plaster', 0, (y1 + y2) / 2, 0, w + 0.02, y2 - y1, d + jet * 2, shade(wc, 0.04));
  // openings plan
  const doorW = 1.1, doorH = 2.15, dx0 = -doorW / 2 + (w > 6 ? -0.6 : 0);
  const winW = 0.85, winH = 1.05, wy = y0 + 1.0;
  const front = [], back = [], left = [], right = [];
  const span = (len) => { const n = Math.max(2, Math.round(len / 1.45)); return { n, s: len / n }; };
  { const { n, s } = span(w); for (let k = 0; k < n; k++) { const u = -w / 2 + (k + 0.5) * s; if (Math.abs(u - (dx0 + doorW / 2)) < doorW * 0.9 + 0.3) continue; if (k === 0 || k === n - 1 || n <= 4) front.push(u); } }
  { const { n, s } = span(w); for (let k = 0; k < n; k++) { const u = -w / 2 + (k + 0.5) * s; if (k % 2 === 1 || n === 2) back.push(u); } }
  { const { n, s } = span(d); for (let k = 0; k < n; k++) { const u = -d / 2 + (k + 0.5) * s; if (k % 2 === 0) { left.push(u); right.push(u); } } }
  // timber frame on a face: axis 'x' faces (front/back) or 'z' faces (sides); c is the face plane, dir its outward sign
  const frame = (axis, len, c, dir, opens, ya, yb) => {
    const { n, s } = span(len);
    const P = (u, v, du, dv, rot) => { if (axis === 'x') mb.box('timber', u, v, c + dir * 0.03, du, dv, 0.1, bc, 0, 0, rot || 0); else mb.box('timber', c + dir * 0.03, v, u, 0.1, dv, du, bc, 0, rot ? -rot : 0, 0); };
    for (let k = 0; k <= n; k++) P(-len / 2 + k * s, (ya + yb) / 2, k === 0 || k === n ? 0.2 : 0.15, yb - ya);
    P(0, ya + 0.08, len + 0.12, 0.16); P(0, yb - 0.08, len + 0.12, 0.16);
    for (let k = 0; k < n; k++) {
      const u0 = -len / 2 + k * s, u1 = u0 + s; if (opens.some((o) => o > u0 - 0.2 && o < u1 + 0.2)) continue;
      const dv = yb - ya - 0.3, ang = Math.atan2(dv, s) * (k % 2 ? 1 : -1); const L = Math.hypot(s, dv);
      if (axis === 'x') mb.box('timber', (u0 + u1) / 2, (ya + yb) / 2, c + dir * 0.03, L - 0.1, 0.13, 0.08, bc, 0, 0, ang);
      else mb.box('timber', c + dir * 0.03, (ya + yb) / 2, (u0 + u1) / 2, 0.08, 0.13, L - 0.1, bc, 0, -ang, 0);
    }
  };
  const doorU = dx0 + doorW / 2;
  frame('x', w, d / 2, 1, [...front, doorU], y0, y1); frame('x', w, -d / 2, -1, back, y0, y1);
  frame('z', d, -w / 2, -1, left, y0, y1); frame('z', d, w / 2, 1, right, y0, y1);
  if (two) {
    frame('x', w, d / 2 + jet, 1, front, y1, y2); frame('x', w, -d / 2 - jet, -1, back, y1, y2);
    frame('z', d + jet * 2, -w / 2, -1, left, y1, y2); frame('z', d + jet * 2, w / 2, 1, right, y1, y2);
    // joist ends under the jetty
    for (let u = -w / 2 + 0.3; u < w / 2; u += 0.5) for (const sd of [1, -1]) mb.box('timber', u, y1 - 0.08, sd * (d / 2 + jet / 2), 0.14, 0.16, jet + 0.1, shade(bc, -0.1));
  }
  // windows: dark panes that glow at night, frames, mullions, sills, open shutters and flower boxes
  const win = (axis, u, c, dir, y) => {
    const P = (uu, v, cc, du, dv, dc, key, cl) => { if (axis === 'x') mb.box(key, uu, v, cc, du, dv, dc, cl); else mb.box(key, cc, v, uu, dc, dv, du, cl); };
    P(u, y + winH / 2, c + dir * 0.025, winW, winH, 0.04, 'window', '#ffffff');
    P(u, y + winH / 2, c + dir * 0.06, 0.05, winH, 0.05, 'timber', '#3a2a1a'); P(u, y + winH * 0.55, c + dir * 0.06, winW, 0.05, 0.05, 'timber', '#3a2a1a');
    P(u, y - 0.04, c + dir * 0.1, winW + 0.24, 0.08, 0.2, 'timber', bc); P(u, y + winH + 0.05, c + dir * 0.07, winW + 0.2, 0.1, 0.12, 'timber', bc);
    P(u - winW / 2 - 0.04, y + winH / 2, c + dir * 0.07, 0.08, winH + 0.1, 0.1, 'timber', bc); P(u + winW / 2 + 0.04, y + winH / 2, c + dir * 0.07, 0.08, winH + 0.1, 0.1, 'timber', bc);
    for (const sd of [-1, 1]) P(u + sd * (winW / 2 + 0.26), y + winH / 2, c + dir * 0.06, 0.4, winH + 0.04, 0.05, 'planks', st.shutter);
    if (R() < 0.6 && y < 2) { P(u, y - 0.2, c + dir * 0.2, winW + 0.1, 0.2, 0.22, 'planks', '#6a4a2a'); for (let k = 0; k < 5; k++) P(u - winW / 2 + 0.1 + k * (winW - 0.2) / 4, y - 0.04, c + dir * 0.22, 0.14, 0.12, 0.14, 'paint', ['#e84a5a', '#f2d34a', '#ffffff', '#b07ae0', '#f08a4a'][(k + Math.floor(R() * 5)) % 5]); for (let k = 0; k < 4; k++) P(u - winW / 2 + 0.2 + k * (winW - 0.4) / 3, y - 0.07, c + dir * 0.26, 0.16, 0.1, 0.1, 'paint', '#4a8a34'); }
  };
  for (const u of front) win('x', u, d / 2, 1, wy); for (const u of back) win('x', u, -d / 2, -1, wy);
  for (const u of left) win('z', u, -w / 2, -1, wy); for (const u of right) win('z', u, w / 2, 1, wy);
  if (two) { for (const u of front) win('x', u, d / 2 + jet, 1, y1 + 0.75); for (const u of back) win('x', u, -d / 2 - jet, -1, y1 + 0.75); for (const u of left) win('z', u, -w / 2, -1, y1 + 0.75); }
  // the door: planks, iron straps, a ring handle, a frame, a stone step and a little porch roof
  const dz = d / 2;
  mb.box('planks', doorU, y0 + doorH / 2 - 0.05, dz + 0.04, doorW, doorH, 0.08, st.door);
  for (const v of [0.45, doorH - 0.5]) mb.box('metalv', doorU, y0 + v, dz + 0.09, doorW - 0.1, 0.07, 0.02, '#2a2a2e');
  mb.cyl('gold', doorU + doorW / 2 - 0.2, y0 + doorH * 0.48, dz + 0.1, 0.05, 0.03, '#c8a040', 8, null, 0, Math.PI / 2);
  for (const sd of [-1, 1]) mb.box('timber', doorU + sd * (doorW / 2 + 0.08), y0 + doorH / 2, dz + 0.07, 0.16, doorH + 0.1, 0.12, bc);
  mb.box('timber', doorU, y0 + doorH + 0.08, dz + 0.08, doorW + 0.4, 0.18, 0.14, bc);
  mb.box('fieldstone', doorU, y0 - 0.12, dz + 0.45, doorW + 0.6, 0.24, 0.75, '#a8a090');
  mb.box('fieldstone', doorU, y0 - 0.38, dz + 0.95, doorW + 0.8, 0.24, 0.6, '#9a9284');
  { const pw = doorW + 1.0, py = y0 + doorH + 0.45, pd = 0.95;
    for (const sd of [-1, 1]) mb.box('timber', doorU + sd * (pw / 2 - 0.12), py - 0.22, dz + pd / 2, 0.1, 0.1, pd + 0.1, bc, 0, -0.55, 0);
    const m = new THREE.Matrix4().makeRotationX(0.42).setPosition(doorU, py + 0.02, dz + pd / 2 + 0.05); mb.add(st.roofMat === 'thatch' ? 'shingle' : st.roofMat, PRIM.box, m.multiply(new THREE.Matrix4().makeScale(pw, 0.08, pd + 0.25)), st.roofMat === 'thatch' ? '#9a7a58' : st.roof); }
  // a lantern beside the door
  const lx = doorU + doorW / 2 + 0.45, ly = y0 + doorH - 0.1, lz = dz + 0.32;
  mb.box('metalv', lx, ly + 0.36, dz + 0.17, 0.04, 0.04, 0.34, '#2a2a2a');
  mb.box('metalv', lx, ly + 0.2, lz, 0.2, 0.04, 0.2, '#2a2a2a'); mb.box('glow', lx, ly, lz, 0.13, 0.26, 0.13, '#ffd48a'); mb.box('metalv', lx, ly - 0.16, lz, 0.18, 0.04, 0.18, '#2a2a2a');
  const lantern = V(lx, ly, lz);
  // gable roof, ridge along x
  const D2 = d / 2 + jet, oh = 0.45, pitch = st.roofMat === 'thatch' ? 0.82 : st.roofMat === 'slate' ? 0.78 : 0.68;
  const rise = D2 * Math.tan(pitch), top = y2, ridge = top + rise;
  const ox = w / 2 + oh, eY = top - oh * Math.tan(pitch), eZ = D2 + oh;
  const slopeLen = Math.hypot(eZ, ridge - eY);
  const rk = st.roofMat, rc = st.roof;
  for (const sd of [1, -1]) {
    const a = V(-ox, eY, sd * eZ), b = V(ox, eY, sd * eZ), c = V(ox, ridge, 0), e = V(-ox, ridge, 0);
    const uvs = [-ox / 1.6, 0, ox / 1.6, 0, ox / 1.6, slopeLen / 1.6, -ox / 1.6, slopeLen / 1.6];
    if (sd > 0) quad(mb, rk, a, b, c, e, uvs, rc); else quad(mb, rk, b, a, e, c, uvs, rc);
    const dn = rk === 'thatch' ? -0.32 : -0.14; const a2 = a.clone().setY(a.y + dn), b2 = b.clone().setY(b.y + dn), c2 = c.clone().setY(c.y + dn), e2 = e.clone().setY(e.y + dn);
    if (sd > 0) quad(mb, 'timber', b2, a2, e2, c2, [0, 0, 1, 0, 1, 1, 0, 1], '#5a3e28'); else quad(mb, 'timber', a2, b2, c2, e2, [0, 0, 1, 0, 1, 1, 0, 1], '#5a3e28');
    // courses of tiles, shingles or thatch, each lapping the one below
    mb.square = true;
    const nC = Math.floor(slopeLen / (rk === 'thatch' ? 0.42 : 0.3));
    const nrm = new THREE.Vector3(0, eZ, sd * (ridge - eY)).normalize(); // up and out of this slope
    for (let j = 0; j < nC; j++) {
      const f = j / nC; const p = a.clone().lerp(V(-ox, ridge, 0), f); const zc = p.z, yc = p.y;
      const pieces = rk === 'thatch' ? 1 : 2 + Math.floor(R() * 2); let u = -ox;
      for (let q = 0; q < pieces; q++) {
        const un = q === pieces - 1 ? ox : u + (2 * ox) / pieces * (0.8 + R() * 0.4);
        const m = new THREE.Matrix4().makeBasis(V(1, 0, 0), nrm, V(0, ridge - eY, -sd * eZ).normalize()).scale(V(un - u, rk === 'thatch' ? 0.16 : 0.05, rk === 'thatch' ? 0.5 : 0.11));
        m.setPosition(V((u + un) / 2, yc, zc).addScaledVector(nrm, rk === 'thatch' ? 0.06 : 0.035));
        mb.add(rk, PRIM.box, m, shade(rc, -0.04 - R() * (rk === 'thatch' ? 0.12 : 0.18)));
        u = un;
      }
    }
    mb.square = false;
    // fascia board along the eave
    mb.box('timber', 0, eY - 0.06, sd * (eZ + 0.02), ox * 2 + 0.05, 0.18, 0.07, bc);
  }
  // ridge cap
  if (rk === 'thatch') mb.cyl('thatch', 0, ridge + 0.1, 0, 0.3, ox * 2 + 0.1, shade(rc, -0.15), 8, null, 0, 0, Math.PI / 2);
  else for (let k = 0; k < Math.ceil(ox * 2 / 0.5); k++) mb.cyl(rk, -ox + 0.25 + k * 0.5, ridge + 0.04, 0, 0.13, 0.52, shade(rc, -0.2 - R() * 0.08), 8, null, 0, 0, Math.PI / 2);
  // barge boards along the gable edges
  for (const sx of [-1, 1]) for (const sd of [1, -1]) { const L = Math.hypot(eZ, ridge - eY); mb.box('timber', sx * (ox - 0.03), (eY + ridge) / 2 - 0.05, sd * eZ / 2, 0.08, 0.2, L, bc, 0, sd * Math.atan2(ridge - eY, eZ), 0); }
  // gable ends: plaster triangles with a king post and collar
  const gpts = [[-D2, 0], [D2, 0], [0, rise - 0.1]];
  for (const sx of [-1, 1]) {
    const m = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(sx * (w / 2 - 0.06), top, 0);
    prism(mb, 'plaster', gpts, 0.2, m, two ? shade(wc, 0.04) : wc);
    mb.box('timber', sx * (w / 2 + 0.06), top + rise * 0.45, 0, 0.08, rise * 0.9, 0.16, bc);
    mb.box('timber', sx * (w / 2 + 0.06), top + rise * 0.35, 0, 0.08, 0.14, D2 * 1.2, bc);
    mb.box('timber', sx * (w / 2 + 0.06), top + 0.07, 0, 0.1, 0.16, D2 * 2 + 0.1, bc);
  }
  // chimney
  const cx = w / 2 - 0.75, cz = -D2 * 0.45, ctop = ridge + 0.9;
  mb.boxB('fieldstone', cx, top - 0.6, cz, 0.72, ctop - top + 0.6, 0.72, '#9a9080');
  mb.box('fieldstone', cx, ctop + 0.06, cz, 0.88, 0.14, 0.88, '#7a7064');
  mb.box('dark', cx, ctop + 0.14, cz, 0.42, 0.02, 0.42);
  // grounding: rough stones along the foot of the walls, a woodpile or barrel at one side
  for (const [ax, len, c] of [['x', w, d / 2 + 0.2], ['x', w, -d / 2 - 0.2], ['z', d, w / 2 + 0.2], ['z', d, -w / 2 - 0.2]]) {
    for (let u = -len / 2 + 0.3; u < len / 2 - 0.2; u += 0.9 + R() * 0.7) { if (ax === 'x' && c > 0 && Math.abs(u - doorU) < doorW) continue; const s = 0.3 + R() * 0.25; if (ax === 'x') mb.box('fieldstone', u, 0.02, c, s * 1.4, s * 0.6, s, shade('#9a9284', R() * 0.2 - 0.1), R()); else mb.box('fieldstone', c, 0.02, u, s, s * 0.6, s * 1.4, shade('#9a9284', R() * 0.2 - 0.1), R()); }
  }
  if (R() < 0.6) { // a woodpile against the side wall
    const sx = w / 2 + 0.45, z0 = -d / 4;
    mb.box('planks', sx, 0.05, z0, 0.6, 0.1, 1.8, '#5a4a3a');
    for (let r2 = 0; r2 < 4; r2++) for (let k = 0; k < 7 - r2; k++) mb.cyl('bark', sx, 0.22 + r2 * 0.2, z0 - 0.6 + k * 0.2 + r2 * 0.1, 0.1, 0.6, '#8a6a4a', 6, null, 0, Math.PI / 2, 0);
    mb.box('shingle', sx + 0.05, 1.15, z0, 0.9, 0.06, 2.0, '#6a5038', 0, 0, -0.25);
  } else { mb.cylB('planks', -w / 2 - 0.5, 0, d / 2 - 0.4, 0.36, 0.95, '#7a5232', 10, 0.32); for (const y of [0.15, 0.8]) mb.cyl('metalv', -w / 2 - 0.5, y, d / 2 - 0.4, 0.38, 0.05, '#3a3a3a', 10); }
  return { mb, chimney: V(cx, ctop + 0.2, cz), lantern, ridge };
}

// ---------- bits and pieces (all built straight into the town builder, in world space) ----------
function barrel(mb, x, y, z, s = 1, c = '#7a5232') { mb.cylB('planks', x, y, z, 0.38 * s, 1.0 * s, c, 12, 0.34 * s); for (const t of [0.14, 0.86]) mb.cyl('metalv', x, y + t * s, z, 0.4 * s, 0.05, '#3a3a3a', 12); mb.cyl('planks', x, y + 1.0 * s, z, 0.33 * s, 0.02, shade(c, -0.15), 12); }
function crate(mb, x, y, z, s = 0.9, ry = 0) { mb.boxB('planks', x, y, z, s, s, s, '#9a7448', ry); for (const v of [0.06, s - 0.06]) for (const sd of [-1, 1]) { const ox = Math.sin(ry) * sd * s / 2, oz = Math.cos(ry) * sd * s / 2; mb.box('timber', x + ox, y + v, z + oz, s + 0.04, 0.09, 0.05, '#5a4028', ry); } }
function sack(mb, x, y, z, ry = 0) { mb.sph('cloth2', x, y + 0.28, z, 0.55, 0.6, 0.45, '#c8b48a', ry); mb.cyl('cloth2', x, y + 0.6, z, 0.08, 0.12, '#a8946a', 8); }
function fence(mb, x, z, len, ry, gy) { const c = Math.cos(ry), s = Math.sin(ry); for (let u = -len / 2; u <= len / 2 + 0.01; u += 1.6) { const px = x + c * u, pz = z - s * u; mb.boxB('timber', px, gy(px, pz) - 0.2, pz, 0.13, 1.3, 0.13, '#7a5a38', ry); } for (const v of [0.45, 0.85]) mb.box('timber', x, gy(x, z) + v, z, len + 0.2, 0.09, 0.06, '#8a6a42', ry); }
function lanternPost(mb, x, y, z, ry = 0) {
  mb.boxB('timber', x, y - 0.3, z, 0.18, 3.1, 0.18, '#4a3220');
  mb.box('fieldstone', x, y + 0.05, z, 0.5, 0.3, 0.5, '#8a8478');
  const ax = Math.sin(ry), az = Math.cos(ry);
  mb.box('timber', x + ax * 0.32, y + 2.6, z + az * 0.32, 0.1 + Math.abs(az) * 0.55, 0.1, 0.1 + Math.abs(ax) * 0.55, '#4a3220');
  const lx = x + ax * 0.55, lz = z + az * 0.55, ly = y + 2.22;
  mb.box('metalv', lx, ly + 0.26, lz, 0.26, 0.05, 0.26, '#2a2a2e'); mb.cone('metalv', lx, ly + 0.28, lz, 0.18, 0.18, '#2a2a2e', 4, Math.PI / 4);
  mb.box('glow', lx, ly, lz, 0.17, 0.32, 0.17, '#ffd28a'); mb.box('metalv', lx, ly - 0.2, lz, 0.24, 0.05, 0.24, '#2a2a2e');
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.box('metalv', lx + px * 0.1, ly, lz + pz * 0.1, 0.025, 0.42, 0.025, '#2a2a2e');
  addFlame(lx, ly - 0.08, lz, 0.13, 0xffc070);
  addLightPool(x, y, z, 5.5, 0xffb060);
  addFireLight(lx, ly, lz, 0xffb066, 9, 13, 0);
}
function bench(mb, x, y, z, ry) { mb.box('planks', x, y + 0.45, z, 1.7, 0.08, 0.4, '#8a6440', ry); for (const s of [-0.65, 0.65]) mb.boxB('timber', x + Math.cos(ry) * s, y, z - Math.sin(ry) * s, 0.12, 0.42, 0.34, '#5a4028', ry); }
function cart(mb, x, y, z, ry) {
  const m = new MB();
  m.boxB('planks', 0, 0.55, 0, 1.4, 0.12, 2.4, '#8a6440');
  for (const sx of [-1, 1]) m.box('planks', sx * 0.68, 0.85, 0, 0.06, 0.5, 2.4, '#7a5838');
  m.box('planks', 0, 0.85, -1.18, 1.4, 0.5, 0.06, '#7a5838');
  for (const sx of [-1, 1]) { m.cyl('planks', sx * 0.82, 0.5, 0.2, 0.5, 0.1, '#6a4a2a', 12, null, 0, 0, Math.PI / 2); m.cyl('metalv', sx * 0.84, 0.5, 0.2, 0.52, 0.05, '#3a3a3a', 12, null, 0, 0, Math.PI / 2); m.cyl('timber', sx * 0.84, 0.5, 0.2, 0.08, 0.16, '#3a2a1a', 8, null, 0, 0, Math.PI / 2); }
  for (const sx of [-1, 1]) m.box('timber', sx * 0.35, 0.45, 2.0, 0.08, 0.08, 1.8, '#5a4028', 0, -0.12, 0);
  sack(m, -0.3, 0.6, -0.4, 0.4); sack(m, 0.3, 0.6, -0.3, 1.2); m.boxB('planks', 0, 0.6, 0.5, 0.7, 0.5, 0.6, '#9a7448', 0.2);
  for (let k = 0; k < 5; k++) m.sph('paint', 0.1 * k - 0.2, 1.13, 0.45 + (k % 2) * 0.12, 0.16, 0.14, 0.16, ['#c8402a', '#e09a2a', '#8ab03a', '#c8402a', '#e8c040'][k]);
  place(mb, m, mT(x, y, z, ry));
}
function hay(mb, x, y, z, ry) { mb.boxB('thatch', x, y, z, 1.2, 0.7, 0.8, '#d8c080', ry); for (const s of [-0.3, 0.3]) mb.box('cloth2', x + Math.cos(ry) * s, y + 0.36, z - Math.sin(ry) * s, 0.04, 0.72, 0.82, '#8a6a3a', ry); }

// ---------- flags and banners: cloth that ripples ----------
const flagMats = {};
function flagMaterial(kind) {
  if (flagMats[kind]) return flagMats[kind];
  const tex = canvasTex(128, 256, (g, w, h) => {
    const base = kind === 'town' ? '#2a5a9a' : kind === 'lost' ? '#5a4a3a' : '#7a1a1a', trim = kind === 'lost' ? '#a89878' : '#e8c060';
    g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = trim; g.fillRect(0, 0, w, 10); g.fillRect(6, 0, 4, h); g.fillRect(w - 10, 0, 4, h);
    g.save(); g.translate(w / 2, h * 0.42); g.fillStyle = trim; g.strokeStyle = trim; g.lineWidth = 5;
    if (kind === 'town') { // a ship's wheel over waves: Windsward
      g.beginPath(); g.arc(0, 0, 26, 0, 6.283); g.stroke(); g.beginPath(); g.arc(0, 0, 7, 0, 6.283); g.fill();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); g.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); g.stroke(); }
      g.lineWidth = 4; for (const y of [50, 62]) { g.beginPath(); for (let x = -40; x <= 40; x += 2) g.lineTo(x, y + Math.sin(x * 0.2) * 4); g.stroke(); }
    } else if (kind === 'lost') { g.beginPath(); g.arc(0, 0, 22, 0, 6.283); g.fill(); g.fillStyle = base; g.fillRect(-10, -6, 7, 7); g.fillRect(3, -6, 7, 7); g.fillRect(-8, 10, 16, 4); }
    else { g.beginPath(); g.moveTo(0, -40); g.lineTo(22, 0); g.lineTo(0, 40); g.lineTo(-22, 0); g.closePath(); g.fill(); }
    g.restore();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h - 34); g.lineTo(w, h); g.fill();
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.92, alphaTest: 0.5 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aFree;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = uTime * 3.2 + position.x * 2.3 + position.y * 0.8 + modelMatrix[3].x * 0.3;
      transformed.z += (sin(ph) * 0.14 + sin(ph * 2.3) * 0.05) * aFree;
      transformed.x += cos(ph * 0.7) * 0.03 * aFree;`);
  };
  m.customProgramCacheKey = () => 'awflag';
  return (flagMats[kind] = m);
}
export function flagMesh(w, h, kind, mode) {
  const g = new THREE.PlaneGeometry(w, h, 12, 12);
  const pos = g.attributes.position; const free = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); if (mode === 'pole') { pos.setXY(i, x + w / 2, y); free[i] = (x + w / 2) / w; } else { pos.setXY(i, x, y - h / 2); free[i] = Math.pow((h / 2 - y) / h, 1.3) * 0.6; } }
  if (mode === 'pole') { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, 1 - v, u); } }
  g.setAttribute('aFree', new THREE.BufferAttribute(free, 1)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, flagMaterial(kind)); m.castShadow = true;
  return m;
}
function signTex(text) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { g.fillStyle = y % 64 ? '#74522e' : '#6a4a2a'; g.fillRect(0, y, w, 30); }
    g.strokeStyle = '#3a2614'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#f2dca0'; g.font = 'bold 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  });
}

// ---------- stations ----------
function forgeModel() {
  const mb = new MB();
  mb.boxB('fieldstone', -2.2, -0.3, 0, 2.4, 1.3, 1.8, '#8a8478');
  mb.box('fieldstone', -2.2, 1.06, 0, 2.55, 0.14, 1.95, '#6a645c');
  mb.box('glow', -2.2, 1.0, 0.05, 1.5, 0.08, 1.1, '#ff5a1a');
  for (let k = 0; k < 9; k++) mb.sph('glow', -2.2 + (k % 3 - 1) * 0.45, 1.06, (Math.floor(k / 3) - 1) * 0.3, 0.16, 0.08, 0.16, k % 2 ? '#ffb040' : '#ff6a20');
  mb.box('fieldstone', -2.2, 2.25, -0.2, 2.2, 1.0, 1.4, '#7a7268', 0, 0.12, 0);
  mb.boxB('fieldstone', -2.7, 2.6, -0.45, 0.85, 2.6, 0.85, '#7a7268');
  mb.box('fieldstone', -2.7, 5.25, -0.45, 1.0, 0.16, 1.0, '#5a544c');
  // lean-to roof on posts
  for (const [px, pz] of [[-3.6, 1.7], [1.4, 1.7], [-3.6, -1.6], [1.4, -1.6]]) mb.boxB('timber', px, -0.2, pz, 0.2, 3.2, 0.2, '#4a3220');
  mb.box('shingle', -1.1, 3.15, 0.05, 5.6, 0.1, 4.0, '#8a6448', 0, 0.16, 0);
  mb.box('timber', -1.1, 2.95, 1.7, 5.4, 0.16, 0.16, '#4a3220'); mb.box('timber', -1.1, 2.95, -1.6, 5.4, 0.16, 0.16, '#4a3220');
  // anvil on a stump
  mb.cylB('bark', 0, -0.2, 0.2, 0.36, 0.7, '#6a4a2a', 10);
  mb.boxB('metalv', 0, 0.5, 0.2, 0.7, 0.22, 0.3, '#2e2e32'); mb.box('metalv', 0.42, 0.62, 0.2, 0.26, 0.1, 0.16, '#2e2e32', 0, 0, 0.3); mb.boxB('metalv', 0, 0.36, 0.2, 0.36, 0.16, 0.22, '#26262a');
  mb.box('metalv', 0.15, 0.78, 0.25, 0.08, 0.06, 0.4, '#5a5a5e', 0.6); mb.box('timber', 0.3, 0.78, 0.48, 0.06, 0.05, 0.4, '#5a3a20', 0.6);
  // quench barrel, bellows, coal heap, tool rack
  mb.cylB('planks', 1.0, -0.1, -1.1, 0.4, 0.85, '#6a4a2a', 12); mb.cyl('water', 1.0, 0.72, -1.1, 0.36, 0.02, '#2a4a5a', 12);
  mb.box('cloth2', -0.65, 0.75, -0.8, 0.7, 0.24, 0.5, '#5a3a22', 0.3, 0, 0.2);
  for (let k = 0; k < 10; k++) mb.stone('fieldstone', -3.7 + Math.cos(k) * 0.4, 0.05, 1.2 + Math.sin(k * 1.3) * 0.3, 0.3, 0.2, 0.3, '#24221f');
  mb.box('timber', 1.3, 1.6, -1.55, 0.1, 0.1, 1.2, '#4a3220', Math.PI / 2);
  for (let k = 0; k < 4; k++) mb.box('metalv', 1.3, 1.25, -1.5 + k * 0.28 - 0.45, 0.05, 0.6, 0.04, '#3a3a3e');
  const g = mb.build();
  addFlame(-2.2, 1.12, 0.05, 0.38, 0xff8030); addFlame(-1.8, 1.1, -0.1, 0.3, 0xff9040);
  return g;
}
function refineryModel() {
  const mb = new MB();
  // a round stone smelting furnace with a glowing mouth
  mb.cylB('fieldstone', 0, -0.3, 0, 1.35, 2.7, '#8a8074', 16, 1.05);
  mb.cylB('fieldstone', 0, 2.4, 0, 0.62, 2.4, '#7a7064', 12, 0.5);
  mb.cyl('fieldstone', 0, 4.85, 0, 0.62, 0.16, '#5a544c', 12);
  mb.box('dark', 0, 0.75, 1.18, 0.8, 0.8, 0.2);
  mb.box('glow', 0, 0.6, 1.2, 0.66, 0.5, 0.12, '#ff6a1a');
  mb.box('fieldstone', 0, 1.25, 1.28, 1.05, 0.16, 0.3, '#6a645c');
  for (const s of [-1, 1]) mb.box('metalv', s * 1.38, 1.4, 0, 0.06, 0.12, 2.0, '#3a3a3e', 0, 0, 0);
  for (const y of [0.4, 1.6]) mb.cyl('metalv', 0, y, 0, 1.38 - y * 0.12, 0.08, '#3a3a3e', 16);
  // trough, ore pile, ingots, crucible
  mb.boxB('planks', 2.5, -0.1, 0, 2.2, 0.85, 0.95, '#6a4a2a'); mb.box('water', 2.5, 0.7, 0, 2.0, 0.04, 0.78, '#2a4a5a');
  for (let k = 0; k < 14; k++) mb.stone('rock', -1.9 + Math.cos(k * 1.7) * 0.5, 0.1 + (k % 3) * 0.12, 1.0 + Math.sin(k * 2.3) * 0.45, 0.32, 0.26, 0.3, k % 3 ? '#8a6a5a' : '#6a7a8a');
  for (let k = 0; k < 6; k++) mb.box('metalv', 1.9 + (k % 3) * 0.32, 0.92 + Math.floor(k / 3) * 0.1, 0.9, 0.28, 0.09, 0.14, k < 3 ? '#a8aab0' : '#c89040');
  mb.cylB('metalv', -1.4, -0.05, -0.9, 0.28, 0.4, '#2a2a2e', 10, 0.34);
  const g = mb.build();
  addFlame(0, 0.55, 1.22, 0.32, 0xff7020);
  return g;
}
function kitchenModel() {
  const mb = new MB();
  // stone fire ring under an iron tripod and cauldron
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; mb.stone('fieldstone', Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85, 0.36, 0.26, 0.3, '#8a8478', a); }
  for (let k = 0; k < 3; k++) { const a = k * 2.1; mb.rod('metalv', V(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95), V(0, 1.75, 0), 0.03, '#2a2a2e'); }
  mb.cylB('metalv', 0, 0.55, 0, 0.5, 0.6, '#26262a', 16, 0.42); mb.cyl('paint', 0, 1.12, 0, 0.44, 0.03, '#8a5a2a', 16);
  for (let k = 0; k < 4; k++) mb.cyl('bark', Math.cos(k * 1.6) * 0.3, 0.15, Math.sin(k * 1.6) * 0.3, 0.07, 0.8, '#5a3a20', 6, null, k * 1.6, 0, Math.PI / 2);
  // a canvas awning on poles
  for (const [x, z] of [[-1.9, -2.0], [1.9, -2.0], [-1.9, 1.5], [1.9, 1.5]]) mb.boxB('timber', x, -0.2, z, 0.15, 3.2, 0.15, '#4a3220');
  const n = 7; for (let k = 0; k < n; k++) mb.box('cloth2', -1.95 + (k + 0.5) * 3.9 / n, 3.0, -0.25, 3.9 / n, 0.04, 3.9, k % 2 ? '#e8dcc0' : '#b84a3a', 0, -0.12, 0);
  // a table with bread, cheese, apples and a jug; barrels and hanging herbs
  mb.box('planks', -1.0, 0.82, -1.45, 1.6, 0.08, 0.7, '#8a6440'); for (const [x, z] of [[-1.7, -1.7], [-0.3, -1.7], [-1.7, -1.2], [-0.3, -1.2]]) mb.boxB('timber', x, 0, z, 0.08, 0.8, 0.08, '#5a4028');
  mb.sph('paint', -1.4, 0.95, -1.45, 0.3, 0.16, 0.22, '#c8904a'); mb.cyl('paint', -0.9, 0.93, -1.4, 0.15, 0.14, '#e8c860', 10); for (let k = 0; k < 4; k++) mb.sph('paint', -0.5 + (k % 2) * 0.1, 0.92, -1.55 + Math.floor(k / 2) * 0.1, 0.09, 0.09, 0.09, '#c83a2a');
  mb.cylB('paint', -0.65, 0.86, -1.3, 0.08, 0.24, '#8a6a5a', 8, 0.06);
  barrel(mb, -1.75, -0.05, 0.9, 0.9); barrel(mb, -1.75, -0.05, 0.05, 0.8, '#6a4a2a');
  for (let k = 0; k < 6; k++) { mb.box('cloth2', -1.6 + k * 0.6, 2.6, -1.9, 0.02, 0.4, 0.02, '#c8b898'); mb.sph('paint', -1.6 + k * 0.6, 2.35, -1.9, 0.18, 0.28, 0.18, ['#5a8a3a', '#8a7a3a', '#6a9a4a'][k % 3]); }
  const g = mb.build();
  addFlame(0, 0.25, 0, 0.42, 0xff9030);
  return g;
}

// ---------- build ----------
export function buildTown(api) {
  const { addCollider, heightAt, addStation, addNPC, addBoard, scene } = api;
  const gy = (x, z) => heightAt(x, z);
  const T = new MB();
  // cottages
  TOWN_HOUSES.forEach((h, i) => {
    const c = cottage(h, 100 + i * 17);
    let y = Infinity; for (const [ox, oz] of [[-h.w / 2, -h.d / 2], [h.w / 2, -h.d / 2], [-h.w / 2, h.d / 2], [h.w / 2, h.d / 2], [0, 0]]) y = Math.min(y, gy(h.x + ox, h.z + oz));
    const m = mT(h.x, y, h.z, h.ry);
    place(T, c.mb, m);
    const ch = c.chimney.clone().applyMatrix4(m); SMOKE_SOURCES.push({ x: ch.x, y: ch.y, z: ch.z });
    const ln = c.lantern.clone().applyMatrix4(m); addFlame(ln.x, ln.y - 0.06, ln.z, 0.1, 0xffc070); addLightPool(ln.x, y, ln.z, 4.5, 0xffb060); addFireLight(ln.x, ln.y, ln.z, 0xffb066, 7, 11, 0);
    addCollider({ minX: h.x - h.w / 2 - 0.25, maxX: h.x + h.w / 2 + 0.25, minZ: h.z - h.d / 2 - 0.25, maxZ: h.z + h.d / 2 + 0.25 });
  });
  // the palisade: sharpened logs, lashed with rails, broken by four gates
  const R = rng(91);
  const GATES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const near = (a) => GATES.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.095);
  const NL = 470;
  for (let i = 0; i < NL; i++) {
    const a = (i / NL) * Math.PI * 2; if (near(a)) continue;
    const r = TOWN_R + (R() - 0.5) * 0.12; const x = Math.cos(a) * r, z = Math.sin(a) * r; const y = gy(x, z);
    const hh = 4.0 + R() * 0.7, rr = 0.24 + R() * 0.05;
    T.cylB('bark', x, y - 0.5, z, rr, hh + 0.5, shade('#8a6a4a', (R() - 0.5) * 0.2), 8, rr * 0.92);
    T.cone('bark', x, y + hh, z, rr * 0.92, 0.6, '#6a5038', 8);
    if (i % 3 === 0) addCollider({ x, z, r: 0.75 });
  }
  // rails on the inside, every few logs
  for (let i = 0; i < 160; i++) {
    const a0 = (i / 160) * Math.PI * 2, a1 = ((i + 1) / 160) * Math.PI * 2; if (near(a0) || near(a1)) continue;
    const r = TOWN_R - 0.35; const p0 = V(Math.cos(a0) * r, 0, Math.sin(a0) * r), p1 = V(Math.cos(a1) * r, 0, Math.sin(a1) * r);
    for (const v of [1.3, 3.1]) { p0.y = gy(p0.x, p0.z) + v; p1.y = gy(p1.x, p1.z) + v; T.beam('timber', p0, p1, 0.14, 0.18, '#6a4a2e'); }
  }
  // gate towers, beams, signs and banners
  const towerM = new MB();
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) towerM.cylB('bark', x, -0.5, z, 0.26, 7.4, '#7a5a3a', 8);
  towerM.boxB('planks', 0, -0.3, 0, 2.45, 2.6, 2.45, '#6a4e32');
  towerM.boxB('planks', 0, 4.7, 0, 2.9, 0.14, 2.9, '#7a5e3e');
  for (const [x, z, sx, sz] of [[0, 1.4, 2.9, 0.1], [0, -1.4, 2.9, 0.1], [1.4, 0, 0.1, 2.9], [-1.4, 0, 0.1, 2.9]]) towerM.boxB('planks', x, 4.84, z, sx, 0.75, sz, '#6a4e32');
  towerM.cone('shingle', 0, 6.9, 0, 2.3, 1.9, '#7a5238', 4, Math.PI / 4);
  for (const ga of GATES) {
    const ends = [];
    for (const s of [-1, 1]) {
      const a = ga + s * 0.118; const x = Math.cos(a) * TOWN_R, z = Math.sin(a) * TOWN_R; const y = gy(x, z);
      place(T, towerM, mT(x, y, z, -a));
      addCollider({ x, z, r: 1.5 });
      ends.push(V(x, y, z));
      lanternPost(T, x - Math.cos(ga) * 2.4 - Math.sin(ga) * s * -0.2, gy(x - Math.cos(ga) * 2.4, z - Math.sin(ga) * 2.4), z - Math.sin(ga) * 2.4, -ga + Math.PI / 2 * s);
    }
    const yb = Math.max(ends[0].y, ends[1].y) + 5.3;
    T.beam('bark', V(ends[0].x, yb, ends[0].z), V(ends[1].x, yb, ends[1].z), 0.45, 0.45, '#6a4a2e');
    // the town sign over the gate
    const cx = Math.cos(ga) * (TOWN_R + 0.3), cz = Math.sin(ga) * (TOWN_R + 0.3);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.08), [mats.get('timber'), mats.get('timber'), mats.get('timber'), mats.get('timber'), new THREE.MeshStandardMaterial({ map: signTex('WINDSWARD'), roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: signTex('WINDSWARD'), roughness: 0.8 })]);
    sign.position.set(cx, yb - 0.75, cz); sign.rotation.y = -ga + Math.PI / 2; sign.castShadow = true; scene.add(sign);
    for (const s of [-1, 1]) { const bx = cx + Math.sin(ga) * s * 2.2 * -1, bz = cz - Math.cos(ga) * s * 2.2 * -1; const f = flagMesh(1.0, 2.4, 'town', 'hang'); f.position.set(bx, yb - 0.2, bz); f.rotation.y = -ga + Math.PI / 2; scene.add(f); }
  }
  // the plaza: flag pole, campfire, benches, a well
  { const y = gy(0, -3);
    T.cylB('fieldstone', 0, y - 0.2, -3, 0.7, 0.5, '#9a9284', 10);
    T.cylB('timber', 0, y, -3, 0.1, 8.2, '#5a4028', 8, 0.07); T.sph('gold', 0, y + 8.3, -3, 0.16, 0.16, 0.16, '#e0c050');
    const f = flagMesh(2.2, 1.35, 'town', 'pole'); f.position.set(0.05, y + 7.45, -3); scene.add(f); TOWN.flag = f;
    addCollider({ x: 0, z: -3, r: 0.5 }); }
  { const y = gy(0, 8);
    for (let i = 0; i < 11; i++) { const a = i / 11 * 6.28; T.stone('fieldstone', Math.cos(a) * 1.05, y + 0.1, 8 + Math.sin(a) * 1.05, 0.42, 0.3, 0.36, shade('#8a8478', (i % 3) * 0.06), a); }
    for (let k = 0; k < 5; k++) { const a = k * 1.25; T.rod('bark', V(Math.cos(a) * 0.65, y + 0.05, 8 + Math.sin(a) * 0.65), V(Math.cos(a) * 0.08, y + 0.75, 8 + Math.sin(a) * 0.08), 0.07, '#5a3a20'); }
    T.cyl('glow', 0, y + 0.08, 8, 0.45, 0.06, '#ff7020', 10);
    addFlame(0, y + 0.3, 8, 0.6, 0xffa040); addFlame(0.2, y + 0.25, 8.15, 0.42, 0xff8030); addFlame(-0.2, y + 0.25, 7.9, 0.4, 0xffb050);
    addLightPool(0, y, 8, 7, 0xff9a40); addFireLight(0, y + 1.3, 8, 0xff9a40, 22, 16, 0.25);
    SMOKE_SOURCES.push({ x: 0, y: y + 1.4, z: 8, fire: true });
    addCollider({ x: 0, z: 8, r: 1.3 });
    bench(T, -2.9, y, 8.6, 1.2); bench(T, 2.9, y, 8.6, -1.2); bench(T, 0, y, 5.0, 0);
    addCollider({ x: -2.9, z: 8.6, r: 0.5 }); addCollider({ x: 2.9, z: 8.6, r: 0.5 }); }
  { const wx = -6.5, wz = -4, y = gy(wx, wz); // the well
    T.cylB('fieldstone', wx, y - 0.2, wz, 1.0, 1.15, '#a09888', 14); T.cyl('water', wx, y + 0.6, wz, 0.8, 0.02, '#2a4a5a', 14); T.cyl('fieldstone', wx, y + 0.97, wz, 1.05, 0.12, '#8a8478', 14);
    for (const s of [-1, 1]) T.boxB('timber', wx + s * 0.85, y + 0.9, wz, 0.14, 1.7, 0.14, '#5a4028');
    T.cyl('timber', wx, y + 2.3, wz, 0.08, 1.9, '#5a4028', 8, null, 0, 0, Math.PI / 2);
    T.box('shingle', wx, y + 2.85, wz - 0.42, 2.2, 0.06, 1.0, '#8a5a3a', 0, 0.5, 0); T.box('shingle', wx, y + 2.85, wz + 0.42, 2.2, 0.06, 1.0, '#8a5a3a', 0, -0.5, 0);
    T.cylB('planks', wx + 0.3, y + 1.03, wz + 0.3, 0.2, 0.32, '#7a5232', 8, 0.17);
    addCollider({ x: wx, z: wz, r: 1.15 }); }
  // the market stall (Ilsa)
  { const sx = 14, sz = 14.5, y = gy(sx, sz);
    T.boxB('planks', sx, y, sz, 4, 1.0, 1.4, '#8a6440');
    for (const x of [-1.95, 1.95]) for (const z of [-0.7, 0.9]) T.boxB('timber', sx + x, y, sz + z, 0.14, z > 0 ? 2.55 : 3.05, 0.14, '#4a3220');
    const n = 8; for (let k = 0; k < n; k++) T.box('cloth2', sx - 2.1 + (k + 0.5) * 4.2 / n, y + 2.9, sz + 0.1, 4.2 / n, 0.04, 2.3, k % 2 ? '#f0e6cc' : '#c84a3a', 0, -0.22, 0);
    for (let k = 0; k < n; k += 1) T.box('cloth2', sx - 2.1 + (k + 0.5) * 4.2 / n, y + 2.45, sz + 1.25, 4.2 / n, 0.3, 0.03, k % 2 ? '#f0e6cc' : '#c84a3a');
    for (let k = 0; k < 4; k++) { T.boxB('planks', sx - 1.5 + k, y + 1.0, sz + 0.2, 0.8, 0.22, 0.6, '#9a7448'); for (let q = 0; q < 6; q++) T.sph('paint', sx - 1.75 + k + (q % 3) * 0.24, y + 1.28, sz + 0.05 + Math.floor(q / 3) * 0.26, 0.17, 0.15, 0.17, ['#d83a2a', '#e8a030', '#9ac040', '#7a3a8a'][k]); }
    crate(T, sx + 2.6, y, sz - 0.3, 0.8, 0.3); crate(T, sx + 2.7, y + 0.8, sz - 0.3, 0.6, 0.7); sack(T, sx - 2.6, y, sz + 0.2, 0.3); sack(T, sx - 2.8, y, sz - 0.5, 1.4);
    addCollider({ minX: sx - 2.1, maxX: sx + 2.1, minZ: sz - 0.8, maxZ: sz + 0.8 }); addCollider({ x: sx + 2.6, z: sz - 0.3, r: 0.55 }); }
  // the bounty board
  { const bm = new MB();
    for (const x of [-1.25, 1.25]) bm.boxB('timber', x, -0.3, 0, 0.18, 3.2, 0.18, '#4a3220');
    bm.box('planks', 0, 1.8, 0, 2.5, 1.6, 0.1, '#8a6440');
    bm.box('shingle', 0, 2.95, -0.15, 3.0, 0.07, 0.8, '#7a5238', 0, 0.45, 0); bm.box('shingle', 0, 2.95, 0.15, 3.0, 0.07, 0.8, '#7a5238', 0, -0.45, 0);
    const R2 = rng(5); for (let i = 0; i < 7; i++) bm.box('paint', -0.95 + (i % 4) * 0.62 + (R2() - 0.5) * 0.1, 1.45 + Math.floor(i / 4) * 0.62 + (R2() - 0.5) * 0.1, 0.07, 0.42 + R2() * 0.1, 0.5, 0.02, ['#f0e4c0', '#e8d8b0', '#f4ead0'][i % 3], 0, 0, (R2() - 0.5) * 0.2);
    for (let i = 0; i < 7; i++) bm.box('paint', -0.95 + (i % 4) * 0.62, 1.68 + Math.floor(i / 4) * 0.62, 0.085, 0.05, 0.05, 0.01, '#8a2a1a');
    const board = bm.build(); board.position.set(7, gy(7, 2), 2); scene.add(board);
    addCollider({ x: 7, z: 2, r: 1.0 }); addBoard(board); }
  // stations (keep their positions; each is its own object so markers can find it)
  addStation('refinery', 14, -12, refineryModel()); addCollider({ minX: 13.5, maxX: 17.8, minZ: -12.6, maxZ: -11.4 });
  addStation('forge', -14, -12, forgeModel()); addCollider({ minX: -17.6, maxX: -15, minZ: -13, maxZ: -11 });
  addStation('kitchen', -14, 14, kitchenModel()); addCollider({ minX: -15.8, maxX: -14.2, minZ: 12.3, maxZ: 12.9 }); addCollider({ x: -15.75, z: 14.5, r: 0.8 });
  SMOKE_SOURCES.push({ x: -16.7, y: gy(-16.7, -12.45) + 5.6, z: -12.45, forge: true }, { x: 14, y: gy(14, -12) + 5.1, z: -12, forge: true }, { x: -14, y: gy(-14, 14) + 1.5, z: 14, fire: true });
  addFireLight(-16.2, gy(-16, -12) + 1.6, -12, 0xff6a20, 14, 9, 0.6); addFireLight(14, gy(14, -12) + 0.9, -10.6, 0xff6a20, 12, 9, 0.6); addFireLight(-14, gy(-14, 14) + 0.8, 14, 0xff9030, 10, 8, 0.3);
  addLightPool(-16.2, gy(-16, -12), -11.4, 4, 0xff7030); addLightPool(14, gy(14, -12), -10.6, 3.5, 0xff7030); addLightPool(-14, gy(-14, 14), 14, 4, 0xff9a40);
  // NPCs
  addNPC('thorne', 0, -9, { skin: 0xd8a882, shirt: 0x7a1e1e, pants: 0x3a2e22, hair: 0x3a2a1a, helm: 0x8a8a90 }, 'sword');
  addNPC('ilsa', 14, 12, { skin: 0xf0c8a0, shirt: 0x2e5a6a, pants: 0x3a3022, hair: 0xc89040 });
  // lanterns along the streets
  for (const [x, z, ry] of [[4, 37, 0], [-4, 37, 0], [4, -37, Math.PI], [-4, -37, Math.PI], [37, 4, Math.PI / 2], [-37, 4, -Math.PI / 2], [5, -5, 0], [-5, 5, Math.PI], [10, 10, 0.8], [-10, -10, -2.3], [3.6, 22, -Math.PI / 2], [-3.6, -22, Math.PI / 2], [22, -3.6, 0], [-22, 3.6, Math.PI]]) {
    lanternPost(T, x, gy(x, z), z, ry); addCollider({ x, z, r: 0.25 });
  }
  // barrels, crates, sacks, carts, hay, fences, planters
  for (const [x, z, s] of [[17, -9, 1], [17.9, -9.7, 0.9], [-17, -8.5, 1], [-18, 17, 1], [9, 15, 0.9], [-6, -26, 1], [28, 14, 1], [-30, 9, 1], [-11.6, 16.6, 0.85]]) { barrel(T, x, gy(x, z) - 0.05, z, s, s < 1 ? '#6a4a2a' : '#7a5232'); addCollider({ x, z, r: 0.45 }); }
  for (const [x, z, r] of [[11, -16, 0.3], [12.2, -16.2, 0.7], [-21, -14, 0.4], [20, 26, 0.2], [-26, 21, 1], [-9, 30.5, 0.2]]) { crate(T, x, gy(x, z), z, 0.85, r); addCollider({ x, z, r: 0.6 }); }
  crate(T, 11.6, gy(11.6, -16.1) + 0.85, -16.1, 0.65, 0.9);
  for (const [x, z, r] of [[10.2, -15.2, 0.4], [-20, -15.2, 1.1], [-27, 20.2, 0.3]]) sack(T, x, gy(x, z), z, r);
  cart(T, 21, gy(21, 7), 7, 2.4); addCollider({ x: 21, z: 7, r: 1.4 });
  cart(T, -22, gy(-22, -6), -6, -0.8); addCollider({ x: -22, z: -6, r: 1.4 });
  for (const [x, z, r] of [[-30, -10, 0.2], [-31.2, -11, 1.4], [30, -12, 0.5]]) { hay(T, x, gy(x, z), z, r); addCollider({ x, z, r: 0.7 }); }
  for (const [x, z, ry, len] of [[-31, 26, 0.8, 6], [33, -12, 1.6, 6], [-8, 33, 0, 6], [10, -36, 0.3, 6]]) fence(T, x, z, len, ry, gy);
  for (const [x, z] of [[-3.8, 13], [3.8, 13], [-3.8, -14], [3.8, -14]]) { const y = gy(x, z); T.boxB('planks', x, y, z, 0.9, 0.45, 0.9, '#7a5838'); T.box('paint', x, y + 0.48, z, 0.78, 0.06, 0.78, '#4a3a28'); for (let k = 0; k < 7; k++) T.sph('paint', x + Math.cos(k * 0.9) * 0.25, y + 0.62, z + Math.sin(k * 0.9) * 0.25, 0.18, 0.16, 0.18, ['#e84a5a', '#f2d34a', '#ffffff', '#b07ae0', '#4a8a34', '#4a8a34', '#f08a4a'][k]); addCollider({ x, z, r: 0.55 }); }
  // a few shade trees inside the walls
  for (const [x, z, s] of [[-33, 15, 1.0], [34, 12, 0.95], [12, 34, 0.9], [-34, -15, 1.05], [33, -27, 0.85]]) { addTree('oak', x, gy(x, z) - 0.15, z, s, x * 0.37); addCollider({ x, z, r: 0.5 * s }); }
  const grp = T.build(); grp.name = 'town'; scene.add(grp);
}
let flagT = 0;
export function updateTown(dt, t) { flagT += dt; }
// ground paint for world.js (before the terrain is finished): paths from each door to the street
export const TOWN_PATHS = TOWN_HOUSES.map((h) => {
  const out = []; const sx = h.door.x, sz = h.door.z;
  // toward the nearest street (the axes) or the plaza
  const tx = Math.abs(sx) < Math.abs(sz) ? 0 : sx, tz = Math.abs(sx) < Math.abs(sz) ? sz : 0;
  const L = Math.hypot(tx - sx, tz - sz); const n = Math.max(1, Math.ceil(L / 1.2));
  for (let i = 0; i <= n; i++) out.push([sx + (tx - sx) * i / n, sz + (tz - sz) * i / n]);
  return out;
});
