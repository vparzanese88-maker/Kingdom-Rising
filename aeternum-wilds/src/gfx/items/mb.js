// Aeternum Wilds — item mesh builder (adapted from Kingdom Rising 3D's mb.js and bevel.js).
// Collects many small pieces (boxes, cylinders, lathes, extrusions...) into ONE merged mesh per material, each
// piece tinted by vertex colour, with texture coordinates projected from object space. Boxes get chamfered edges
// a few millimetres wide so light catches them: no Minecraft blocks.
import * as THREE from 'three';
import { itemMat, UV_SCALE } from './mats.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
const _c = new THREE.Color();
export const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
export const V2 = (x, y) => new THREE.Vector2(x, y);

export const PRIM = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1),
  cyl16: new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1),
  cyl24: new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1),
  sph8: new THREE.SphereGeometry(0.5, 10, 7),
  sph12: new THREE.SphereGeometry(0.5, 16, 12),
  sph16: new THREE.SphereGeometry(0.5, 22, 16),
};

// ---------- chamfered boxes (from Kingdom Rising's bevel.js) ----------
const bevCache = new Map(); const Q = 400;
export function chamferBox(fx, fy, fz) {
  const kx = Math.round(fx * Q), ky = Math.round(fy * Q), kz = Math.round(fz * Q);
  const key = kx + ',' + ky + ',' + kz; let g = bevCache.get(key); if (g) return g;
  const ix = kx / Q, iy = ky / Q, iz = kz / Q, h = 0.5;
  const pos = [], nor = [], uv = [], idx = [];
  const vert = (x, y, z, nx, ny, nz) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(0, 0); return pos.length / 3 - 1; };
  const tri = (a, b, c) => {
    const A = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], B = [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], C = [pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = A[0] + B[0] + C[0], cy = A[1] + B[1] + C[1], cz = A[2] + B[2] + C[2];
    if (nx * cx + ny * cy + nz * cz >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const I = [h - ix, h - iy, h - iz];
  const facePt = (ax, sg, s1, s2) => { const p = [0, 0, 0]; p[ax] = sg * h; const o = [0, 1, 2].filter((k) => k !== ax); p[o[0]] = s1 * I[o[0]]; p[o[1]] = s2 * I[o[1]]; return p; };
  const nv = (ax, sg) => { const v = [0, 0, 0]; v[ax] = sg; return v; };
  const F = {};
  for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) {
    const ids = {}; const Nn = nv(ax, sg);
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) { const p = facePt(ax, sg, s1, s2); ids[s1 + ',' + s2] = vert(p[0], p[1], p[2], Nn[0], Nn[1], Nn[2]); }
    F[ax + ',' + sg] = ids; quad(ids['-1,-1'], ids['1,-1'], ids['1,1'], ids['-1,1']);
  }
  const at = (ax, sg, cs) => { const o = [0, 1, 2].filter((k) => k !== ax); return F[ax + ',' + sg][cs[o[0]] + ',' + cs[o[1]]]; };
  const dup = (i) => vert(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const c = 3 - a - b; const ends = [];
    for (const sc of [-1, 1]) { const cs = [0, 0, 0]; cs[a] = sa; cs[b] = sb; cs[c] = sc; ends.push(cs); }
    const va = ends.map((cs) => dup(at(a, sa, cs))); const vb = ends.map((cs) => dup(at(b, sb, cs)));
    quad(va[0], va[1], vb[1], vb[0]);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const cs = [sx, sy, sz]; const t = [0, 1, 2].map((ax) => dup(at(ax, cs[ax], cs))); tri(t[0], t[1], t[2]); }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  bevCache.set(key, g);
  return g;
}
// the cut for an item-sized box: 2.5 mm .. 1.2 cm, never more than a fifth of the thinnest side
const NO_BEVEL = new Set(['glow', 'liquid', 'glass']);
function bevelFor(key, sx, sy, sz) {
  if (NO_BEVEL.has(key)) return null;
  const m = Math.min(sx, sy, sz); if (!(m > 0.008)) return null;
  const c = Math.min(0.012, m / 5);
  return chamferBox(Math.min(0.24, c / sx), Math.min(0.24, c / sy), Math.min(0.24, c / sz));
}

// ---------- colours ----------
export function col(c, out = new THREE.Color()) { if (c && c.isColor) return out.copy(c); if (typeof c === 'number') return out.setHex(c); return out.set(c); }
export function shade(hex, k) { const c = col(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k))); return '#' + c.getHexString(); }
export function mix(a, b, t) { return '#' + col(a).lerp(col(b, new THREE.Color()), t).getHexString(); }
// a colour scaled past 1 (for glow that blooms)
export function hot(hex, k) { return col(hex).multiplyScalar(k); }

// ---------- the builder ----------
export class MB {
  constructor() { this.parts = new Map(); }
  part(key) { let p = this.parts.get(key); if (!p) { p = { key, pos: [], nor: [], uv: [], col: [], idx: [], n: 0 }; this.parts.set(key, p); } return p; }
  // add geometry g transformed by matrix m, tinted by color; uv: 'obj' (projected) | 'local' (geometry's own, scaled by uvScale)
  add(key, g, m, color, uv = 'obj', uvScale = 1) {
    if (g === PRIM.box && uv === 'obj') { const e = m.elements; const bg = bevelFor(key, Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])); if (bg) g = bg; }
    const p = this.part(key);
    const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
    const base = p.n; const nm = _nm.getNormalMatrix(m);
    const c = color == null ? null : col(color, _c);
    const r = c ? c.r : 1, gg = c ? c.g : 1, b = c ? c.b : 1; const ca = c ? null : g.attributes.color;
    const sc = UV_SCALE[key] || 0.3;
    for (let i = 0; i < pa.count; i++) {
      _p.fromBufferAttribute(pa, i).applyMatrix4(m);
      _n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      p.pos.push(_p.x, _p.y, _p.z); p.nor.push(_n.x, _n.y, _n.z);
      if (ca) p.col.push(ca.getX(i), ca.getY(i), ca.getZ(i)); else p.col.push(r, gg, b);
      if (uv === 'local' && ua) p.uv.push(ua.getX(i) * uvScale, ua.getY(i) * uvScale);
      else { const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
        if (ay > ax && ay > az) p.uv.push(_p.x / sc, _p.z / sc); else if (ax >= az) p.uv.push(_p.z / sc, _p.y / sc); else p.uv.push(_p.x / sc, _p.y / sc); }
    }
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) p.idx.push(base + ia[i]); }
    else for (let i = 0; i < pa.count; i++) p.idx.push(base + i);
    p.n += pa.count;
    return this;
  }
  static mat(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) { _e.set(rx, ry, rz, 'XYZ'); _q.setFromEuler(_e); _s.set(sx, sy, sz); _p.set(x, y, z); return new THREE.Matrix4().compose(_p, _q, _s); }
  box(key, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) { return this.add(key, PRIM.box, MB.mat(x, y, z, sx, sy, sz, rx, ry, rz), color); }
  cyl(key, x, y, z, r, h, color, seg = 12, rTop = null, rx = 0, ry = 0, rz = 0, uv) {
    let g = seg <= 6 ? PRIM.cyl6 : seg <= 8 ? PRIM.cyl8 : seg <= 12 ? PRIM.cyl12 : seg <= 16 ? PRIM.cyl16 : PRIM.cyl24;
    if (rTop != null && rTop !== r) g = taper(seg, rTop / r);
    return this.add(key, g, MB.mat(x, y, z, r * 2, h, r * 2, rx, ry, rz), color, uv);
  }
  sph(key, x, y, z, sx, sy, sz, color, seg = 12, rx = 0, ry = 0, rz = 0) { return this.add(key, seg <= 8 ? PRIM.sph8 : seg <= 12 ? PRIM.sph12 : PRIM.sph16, MB.mat(x, y, z, sx, sy, sz, rx, ry, rz), color); }
  // a round rod between two points
  rod(key, a, b, r, color, seg = 8, rb = null) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const L = Math.hypot(dx, dy, dz); if (L < 1e-5) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(dx / L, dy / L, dz / L));
    const m = new THREE.Matrix4().compose(V3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), q, V3(r * 2, L, r * 2));
    let g = seg <= 6 ? PRIM.cyl6 : seg <= 8 ? PRIM.cyl8 : PRIM.cyl12; if (rb != null && rb !== r) g = taper(seg, rb / r);
    return this.add(key, g, m, color);
  }
  // a geometry placed with position / euler rotation / uniform or per-axis scale
  geo(key, g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1, color, uv) { const sv = typeof s === 'number' ? [s, s, s] : s; return this.add(key, g, MB.mat(x, y, z, sv[0], sv[1], sv[2], rx, ry, rz), color, uv); }
  isEmpty() { for (const p of this.parts.values()) if (p.n) return false; return true; }
  build(ctx = 'world', opts = {}) {
    const grp = new THREE.Group();
    for (const p of this.parts.values()) {
      if (!p.n) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
      g.setIndex(p.n > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const mat = itemMat(p.key, ctx);
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = opts.castShadow !== false && !mat.userData.noShadow; mesh.receiveShadow = true;
      mesh.name = p.key;
      if (p.key === 'glass' || p.key === 'liquid') mesh.renderOrder = p.key === 'glass' ? 2 : 1;
      grp.add(mesh);
    }
    return grp;
  }
}
const taperCache = {};
function taper(seg, k) { const key = seg + ':' + k.toFixed(3); if (!taperCache[key]) taperCache[key] = new THREE.CylinderGeometry(0.5 * k, 0.5, 1, seg <= 6 ? 6 : seg <= 8 ? 8 : seg <= 12 ? 12 : 16, 1); return taperCache[key]; }

// ---------- shape helpers ----------
export function extrude(shape, depth, bevel = 0.004, curveSeg = 10, bevelSeg = 2) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: bevelSeg, curveSegments: curveSeg });
  g.translate(0, 0, -depth / 2); return g;
}
export function lathe(pts, seg = 16) { return new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg); }
export function tube(points, r, seg = 24, rad = 6, closed = false) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), seg, r, rad, closed); }
// a leather (or cord) wrap spiralling round a grip from y0 to y1
export function helix(r, y0, y1, turns, wr, flat = 1) {
  const pts = []; const n = Math.max(8, Math.round(turns * 12));
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2; pts.push(V3(Math.cos(a) * r, y0 + (y1 - y0) * t, Math.sin(a) * r)); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wr, 6, false);
  if (flat !== 1) { // squash the cord into a ribbon: pull each ring toward the grip axis radius
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z); const nd = r + (d - r) * flat; p.setX(i, x / d * nd); p.setZ(i, z / d * nd); }
    g.computeVertexNormals();
  }
  return g;
}

// A lofted solid: cross-section `profile` swept through `stations` (each {y, w, t, x?, z?, f?}) along +y.
// profile: an array of segments; each segment an array of [u, v, fuller?] points in -1..1 (u * w across, v * t through).
// Normals are smooth within a segment and creased between segments (crisp blade bevels).
// The profile describes the +z half going from +u to -u; the -z half is mirrored automatically.
// cols: one colour per segment (front and back alike).
export function loft(mb, key, stations, profile, cols, xform = new THREE.Matrix4()) {
  for (const zs of [1, -1]) {
    profile.forEach((seg, si) => {
      const pos = [], idx = [], uvs = [];
      const n = seg.length;
      stations.forEach((st) => {
        for (const [u, v, fu] of seg) {
          const vv = fu ? v * (1 - (st.f || 0)) : v;
          pos.push((st.x || 0) + u * st.w, st.y, (st.z || 0) + zs * vv * st.t);
          uvs.push(u * st.w, st.y);
        }
      });
      for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < n - 1; j++) {
        const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
        if (zs > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx); g.computeVertexNormals();
      // make sure the strip faces outward: compare with the direction from the section's centre
      const nn = g.attributes.normal; let dot = 0;
      for (let i = 0; i < nn.count; i++) dot += nn.getZ(i) * zs + nn.getX(i) * Math.sign(pos[i * 3] - (stations[Math.floor(i / n)].x || 0)) * 0.2;
      if (dot < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
      mb.add(key, g, xform, cols[si % cols.length], 'obj');
      g.dispose();
    });
  }
}
