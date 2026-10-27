// Kingdom Rising 3D — mesh builder: collects many small pieces (boxes, cylinders, any geometry)
// into one merged mesh per material, with world-projected texture coordinates and colour tints
import { THREE, K3 } from './core.js';
import { mats, MAT_UV } from './mats.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
const _c = new THREE.Color();

// shared unit primitives
export const PRIM = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1),
  cyl16: new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1),
  cyl24: new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, true),
  cone8: new THREE.ConeGeometry(0.5, 1, 8, 1),
  cone12: new THREE.ConeGeometry(0.5, 1, 12, 1),
  cone16: new THREE.ConeGeometry(0.5, 1, 16, 1),
  sph8: new THREE.SphereGeometry(0.5, 10, 7),
  sph12: new THREE.SphereGeometry(0.5, 14, 10),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  torus: new THREE.TorusGeometry(0.4, 0.1, 6, 16),
};
for (const k in PRIM) if (!PRIM[k].index) PRIM[k] = PRIM[k];

export class MB {
  constructor() { this.parts = new Map(); }
  part(key) {
    let p = this.parts.get(key);
    if (!p) { p = { key, pos: [], nor: [], uv: [], col: [], idx: [], n: 0 }; this.parts.set(key, p); }
    return p;
  }
  // add geometry g (indexed or not) transformed by matrix m, tinted by color (hex/Color), uv: 'world' | 'local' | number (local uv scale)
  add(key, g, m, color, uv = 'world', uvScale = 1) {
    const p = this.part(key);
    const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
    const base = p.n; const nm = _nm.getNormalMatrix(m);
    const col = color == null ? null : (color.isColor ? color : K3.col(color, _c));
    const r = col ? col.r : 1, gg = col ? col.g : 1, b = col ? col.b : 1;
    const sc = typeof uv === 'number' ? uv : MAT_UV[key] || 2;
    for (let i = 0; i < pa.count; i++) {
      _p.fromBufferAttribute(pa, i).applyMatrix4(m);
      _n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      p.pos.push(_p.x, _p.y, _p.z); p.nor.push(_n.x, _n.y, _n.z); p.col.push(r, gg, b);
      if (uv === 'local' || typeof uv === 'number') { p.uv.push(ua.getX(i) * uvScale * (typeof uv === 'number' ? uv : 1), ua.getY(i) * uvScale * (typeof uv === 'number' ? uv : 1)); }
      else { // project from world space along the dominant normal axis
        const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
        if (ay >= ax && ay >= az) p.uv.push(_p.x / sc, _p.z / sc); else if (ax >= az) p.uv.push(_p.z / sc, _p.y / sc); else p.uv.push(_p.x / sc, _p.y / sc);
      }
    }
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) p.idx.push(base + ia[i]); }
    else for (let i = 0; i < pa.count; i++) p.idx.push(base + i);
    p.n += pa.count;
    return this;
  }
  // transform helper: position, rotation (euler xyz radians, or y only), scale
  static mat(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _s.set(sx, sy, sz); _p.set(x, y, z);
    return _m.compose(_p, _q, _s);
  }
  // box centred at (x,y,z) with size (sx,sy,sz), rotated ry about Y
  box(key, x, y, z, sx, sy, sz, color, ry = 0, rx = 0, rz = 0, uv) { return this.add(key, PRIM.box, MB.mat(x, y, z, sx, sy, sz, ry, rx, rz), color, uv); }
  // box from its base centre
  boxB(key, x, y, z, sx, sy, sz, color, ry = 0, uv) { return this.box(key, x, y + sy / 2, z, sx, sy, sz, color, ry, 0, 0, uv); }
  cyl(key, x, y, z, r, h, color, seg = 12, rTop = null, ry = 0, rx = 0, rz = 0, uv) {
    let g = seg <= 8 ? PRIM.cyl8 : seg <= 12 ? PRIM.cyl12 : PRIM.cyl16;
    if (rTop != null && rTop !== r) { g = taper(seg, rTop / r); }
    return this.add(key, g, MB.mat(x, y, z, r * 2, h, r * 2, ry, rx, rz), color, uv);
  }
  cylB(key, x, y, z, r, h, color, seg, rTop, uv) { return this.cyl(key, x, y + h / 2, z, r, h, color, seg, rTop, 0, 0, 0, uv); }
  cone(key, x, y, z, r, h, color, seg = 12, ry = 0) { const g = seg <= 8 ? PRIM.cone8 : seg <= 12 ? PRIM.cone12 : PRIM.cone16; return this.add(key, g, MB.mat(x, y + h / 2, z, r * 2, h, r * 2, ry), color); }
  sph(key, x, y, z, sx, sy, sz, color, ry = 0, seg = 12) { return this.add(key, seg <= 8 ? PRIM.sph8 : PRIM.sph12, MB.mat(x, y, z, sx, sy, sz, ry), color); }
  // a beam between two points with a square cross-section
  beam(key, a, b, w, h, color) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const L = Math.hypot(dx, dy, dz);
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L));
    m.compose(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), q, new THREE.Vector3(w, L, h || w));
    return this.add(key, PRIM.box, m, color);
  }
  rod(key, a, b, r, color, seg = 6) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const L = Math.hypot(dx, dy, dz); if (L < 1e-4) return this;
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L));
    m.compose(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), q, new THREE.Vector3(r * 2, L, r * 2));
    return this.add(key, seg <= 8 ? PRIM.cyl8 : PRIM.cyl12, m, color);
  }
  isEmpty() { for (const p of this.parts.values()) if (p.n) return false; return true; }
  // build a THREE.Group with one mesh per material key
  build(opts = {}) {
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
      const mat = mats.get(p.key);
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = opts.castShadow !== false && !mat.userData.noShadow; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.name = p.key;
      grp.add(mesh);
    }
    return grp;
  }
  // a single merged geometry (all keys together, for templates that share one material)
  geometry(key) {
    const p = this.parts.get(key); if (!p || !p.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
    g.setIndex(p.n > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
const taperCache = {};
function taper(seg, k) { const key = seg + ':' + k.toFixed(3); if (!taperCache[key]) taperCache[key] = new THREE.CylinderGeometry(0.5 * k, 0.5, 1, seg <= 8 ? 8 : seg <= 12 ? 12 : 16, 1); return taperCache[key]; }
export function dispose(obj) {
  obj.traverse((o) => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); });
}
