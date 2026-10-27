// Kingdom Rising 3D — smooth organic bodies: a creature's ellipsoids, limb segments and cones are blended
// into one signed distance field and meshed with surface nets, so joints flow into each other like flesh.
// Colours and bone weights come from the nearest parts.
import { THREE } from './core.js';

const V = THREE.Vector3;
// distance to each kind of part (negative inside)
function dEll(pr, x, y, z) { const lx = x - pr.p[0], ly = y - pr.p[1], lz = z - pr.p[2]; const q = pr.qi; const qx = q[0] * lx + q[3] * ly + q[6] * lz, qy = q[1] * lx + q[4] * ly + q[7] * lz, qz = q[2] * lx + q[5] * ly + q[8] * lz; const k0 = Math.hypot(qx / pr.r[0], qy / pr.r[1], qz / pr.r[2]); const k1 = Math.hypot(qx / (pr.r[0] * pr.r[0]), qy / (pr.r[1] * pr.r[1]), qz / (pr.r[2] * pr.r[2])); return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(...pr.r); }
function dSeg(pr, x, y, z) { const ax = x - pr.a[0], ay = y - pr.a[1], az = z - pr.a[2]; let h = (ax * pr.ba[0] + ay * pr.ba[1] + az * pr.ba[2]) / pr.bb; h = h < 0 ? 0 : h > 1 ? 1 : h; return Math.hypot(ax - pr.ba[0] * h, ay - pr.ba[1] * h, az - pr.ba[2] * h) - (pr.r0 + (pr.r1 - pr.r0) * h); }
function dBox(pr, x, y, z) { const lx = x - pr.p[0], ly = y - pr.p[1], lz = z - pr.p[2]; const q = pr.qi; const qx = Math.abs(q[0] * lx + q[3] * ly + q[6] * lz) - pr.h[0], qy = Math.abs(q[1] * lx + q[4] * ly + q[7] * lz) - pr.h[1], qz = Math.abs(q[2] * lx + q[5] * ly + q[8] * lz) - pr.h[2]; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - pr.round; }
const dist = (pr, x, y, z) => (pr.t === 'e' ? dEll(pr, x, y, z) : pr.t === 's' ? dSeg(pr, x, y, z) : dBox(pr, x, y, z));
function prep(pr) {
  if (pr.t === 's') { pr.ba = [pr.b[0] - pr.a[0], pr.b[1] - pr.a[1], pr.b[2] - pr.a[2]]; pr.bb = Math.max(1e-9, pr.ba[0] ** 2 + pr.ba[1] ** 2 + pr.ba[2] ** 2); const m = Math.max(pr.r0, pr.r1); pr.min = [Math.min(pr.a[0], pr.b[0]) - m, Math.min(pr.a[1], pr.b[1]) - m, Math.min(pr.a[2], pr.b[2]) - m]; pr.max = [Math.max(pr.a[0], pr.b[0]) + m, Math.max(pr.a[1], pr.b[1]) + m, Math.max(pr.a[2], pr.b[2]) + m]; }
  else { const m = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(pr.q || new THREE.Quaternion())); pr.qi = m.clone().transpose().elements; const R = pr.t === 'e' ? Math.max(...pr.r) : Math.hypot(...pr.h) + pr.round; pr.min = [pr.p[0] - R, pr.p[1] - R, pr.p[2] - R]; pr.max = [pr.p[0] + R, pr.p[1] + R, pr.p[2] + R]; }
}
// prims: [{t:'e'|'s'|'b', ..., col: Color, bone, bone2, w2, mat:[m,r,pattern]}]; k: blend radius; cell: grid size
export function sdfMesh(prims, k, cell) {
  for (const p of prims) prep(p);
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of prims) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], p.min[a]); mx[a] = Math.max(mx[a], p.max[a]); }
  const pad = k + cell * 2; for (let a = 0; a < 3; a++) { mn[a] -= pad; mx[a] += pad; }
  const nx = Math.ceil((mx[0] - mn[0]) / cell) + 1, ny = Math.ceil((mx[1] - mn[1]) / cell) + 1, nz = Math.ceil((mx[2] - mn[2]) / cell) + 1;
  const F = new Float32Array(nx * ny * nz).fill(1e3); const I = (i, j, l) => (l * ny + j) * nx + i;
  // each part fills only the grid around itself, blended in with a smooth minimum
  for (const p of prims) {
    const i0 = Math.max(0, Math.floor((p.min[0] - k - mn[0]) / cell)), i1 = Math.min(nx - 1, Math.ceil((p.max[0] + k - mn[0]) / cell));
    const j0 = Math.max(0, Math.floor((p.min[1] - k - mn[1]) / cell)), j1 = Math.min(ny - 1, Math.ceil((p.max[1] + k - mn[1]) / cell));
    const l0 = Math.max(0, Math.floor((p.min[2] - k - mn[2]) / cell)), l1 = Math.min(nz - 1, Math.ceil((p.max[2] + k - mn[2]) / cell));
    const kk = p.k ?? k;
    for (let l = l0; l <= l1; l++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = mn[0] + i * cell, y = mn[1] + j * cell, z = mn[2] + l * cell; const d = dist(p, x, y, z); const id = I(i, j, l); const a = F[id];
      const h = Math.max(kk - Math.abs(a - d), 0) / kk; F[id] = Math.min(a, d) - h * h * kk * 0.25;
    }
  }
  // surface nets: one vertex per cell the surface passes through, one quad per crossed grid edge
  const vid = new Int32Array(nx * ny * nz).fill(-1); const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let l = 0; l < nz - 1; l++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0; for (let c = 0; c < 8; c++) { const o = corner[c]; cv[c] = F[I(i + o[0], j + o[1], l + o[2])]; if (cv[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) { const da = cv[a], db = cv[b]; if ((da < 0) === (db < 0)) continue; const t = da / (da - db); const A = corner[a], B = corner[b]; sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++; }
    vid[I(i, j, l)] = pos.length / 3; pos.push(mn[0] + (i + sx / n) * cell, mn[1] + (j + sy / n) * cell, mn[2] + (l + sz / n) * cell);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let l = 1; l < nz - 1; l++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const f0 = F[I(i, j, l)] < 0;
    if (f0 !== (F[I(i + 1, j, l)] < 0)) quad(vid[I(i, j - 1, l - 1)], vid[I(i, j, l - 1)], vid[I(i, j, l)], vid[I(i, j - 1, l)], !f0);
    if (f0 !== (F[I(i, j + 1, l)] < 0)) quad(vid[I(i - 1, j, l - 1)], vid[I(i - 1, j, l)], vid[I(i, j, l)], vid[I(i, j, l - 1)], !f0);
    if (f0 !== (F[I(i, j, l + 1)] < 0)) quad(vid[I(i - 1, j - 1, l)], vid[I(i, j - 1, l)], vid[I(i, j, l)], vid[I(i - 1, j, l)], !f0);
  }
  // normals from the field, colours and bone weights from the nearest parts
  const nv = pos.length / 3; const nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), mat = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const sample = (x, y, z) => { const fx = (x - mn[0]) / cell, fy = (y - mn[1]) / cell, fz = (z - mn[2]) / cell; const i = Math.min(nx - 2, Math.max(0, Math.floor(fx))), j = Math.min(ny - 2, Math.max(0, Math.floor(fy))), l = Math.min(nz - 2, Math.max(0, Math.floor(fz))); const u = fx - i, v = fy - j, w = fz - l; const g = (a, b, c) => F[I(i + a, j + b, l + c)]; return (((g(0, 0, 0) * (1 - u) + g(1, 0, 0) * u) * (1 - v) + (g(0, 1, 0) * (1 - u) + g(1, 1, 0) * u) * v) * (1 - w) + ((g(0, 0, 1) * (1 - u) + g(1, 0, 1) * u) * (1 - v) + (g(0, 1, 1) * (1 - u) + g(1, 1, 1) * u) * v) * w); };
  const e = cell * 0.7; const wts = new Map();
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let gx = sample(x + e, y, z) - sample(x - e, y, z), gy = sample(x, y + e, z) - sample(x, y - e, z), gz = sample(x, y, z + e) - sample(x, y, z - e); const gl = Math.hypot(gx, gy, gz) || 1; nor[v * 3] = gx / gl; nor[v * 3 + 1] = gy / gl; nor[v * 3 + 2] = gz / gl;
    let dmin = 1e9; const ds = prims.map((p) => { const d = dist(p, x, y, z); if (d < dmin) dmin = d; return d; });
    let cr = 0, cg = 0, cb = 0, ws = 0, m0 = 0, m1 = 0, m2 = 0; wts.clear(); let best = 0, bw = -1;
    prims.forEach((p, i) => { const w = Math.max(0, 1 - (ds[i] - dmin) / (k * 1.2)) ** 2 * (p.wMul || 1); if (w <= 0) return; cr += p.col.r * w; cg += p.col.g * w; cb += p.col.b * w; ws += w; if (w > bw) { bw = w; best = i; } wts.set(p.bone, (wts.get(p.bone) || 0) + w * (1 - (p.w2 || 0))); if (p.bone2 != null && p.w2) wts.set(p.bone2, (wts.get(p.bone2) || 0) + w * p.w2); });
    col[v * 3] = cr / ws; col[v * 3 + 1] = cg / ws; col[v * 3 + 2] = cb / ws; const M = prims[best].mat; mat[v * 3] = M[0]; mat[v * 3 + 1] = M[1]; mat[v * 3 + 2] = M[2];
    const top = [...wts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4); const tw = top.reduce((a, x) => a + x[1], 0) || 1;
    top.forEach(([b, w], q) => { si[v * 4 + q] = b; sw[v * 4 + q] = w / tw; });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aMat', new THREE.BufferAttribute(mat, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  return g;
}
