// Kingdom Rising 3D — chamfered boxes: every box the mesh builder lays (walls, beams, steps, crates, tables, posts...)
// gets its edges cut back a few centimetres, with the normals rolled over the cut, so light catches the edges like
// worn timber and dressed stone instead of meeting them as knife-sharp Minecraft blocks.
// The cut is the same size in metres whatever the box's proportions: the geometry is made for a unit box with the
// cut given per axis as a fraction of that axis, then scaled by the box's own size.
import { THREE } from './core.js';

const cache = new Map();
const Q = 400; // fractions are rounded to 1/400 so similar boxes share a geometry

// fx, fy, fz: the cut on each axis as a fraction of the box's size on that axis (0..0.25)
export function chamferBox(fx, fy, fz) {
  const kx = Math.round(fx * Q), ky = Math.round(fy * Q), kz = Math.round(fz * Q);
  const key = kx + ',' + ky + ',' + kz; let g = cache.get(key); if (g) return g;
  const ix = kx / Q, iy = ky / Q, iz = kz / Q, h = 0.5;
  const pos = [], nor = [], uv = [], idx = [];
  const vert = (x, y, z, nx, ny, nz) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(0, 0); return pos.length / 3 - 1; };
  // a triangle wound to face away from the box's centre (the box is convex, so that is always outward)
  const tri = (a, b, c) => {
    const A = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], B = [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], C = [pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = A[0] + B[0] + C[0], cy = A[1] + B[1] + C[1], cz = A[2] + B[2] + C[2];
    if (nx * cx + ny * cy + nz * cz >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const I = [h - ix, h - iy, h - iz]; // the inset half-extents
  // the point on face (axis, sign) at in-face corner (s1, s2) of the other two axes
  const facePt = (ax, sg, s1, s2) => { const p = [0, 0, 0]; p[ax] = sg * h; const o = [0, 1, 2].filter((k) => k !== ax); p[o[0]] = s1 * I[o[0]]; p[o[1]] = s2 * I[o[1]]; return p; };
  const n = (ax, sg) => { const v = [0, 0, 0]; v[ax] = sg; return v; };
  // the six faces, inset
  const F = {}; // F['ax,sg'][s1,s2] -> vertex index
  for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) {
    const ids = {}; const N = n(ax, sg);
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) { const p = facePt(ax, sg, s1, s2); ids[s1 + ',' + s2] = vert(p[0], p[1], p[2], N[0], N[1], N[2]); }
    F[ax + ',' + sg] = ids; quad(ids['-1,-1'], ids['1,-1'], ids['1,1'], ids['-1,1']);
  }
  // a face's vertex nearest a given corner (a sign per axis)
  const at = (ax, sg, cs) => { const o = [0, 1, 2].filter((k) => k !== ax); return F[ax + ',' + sg][cs[o[0]] + ',' + cs[o[1]]]; };
  // the twelve edges: a strip between two faces, its normals running from one face's to the other's (a rounded look)
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const c = 3 - a - b; const ends = [];
    for (const sc of [-1, 1]) { const cs = [0, 0, 0]; cs[a] = sa; cs[b] = sb; cs[c] = sc; ends.push(cs); }
    // copies of the corner vertices of face a and face b along this edge (same positions, same normals)
    const va = ends.map((cs) => { const i = at(a, sa, cs); return vert(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); });
    const vb = ends.map((cs) => { const i = at(b, sb, cs); return vert(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); });
    quad(va[0], va[1], vb[1], vb[0]);
  }
  // the eight corners: a small triangle joining the three faces
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const cs = [sx, sy, sz]; const t = [0, 1, 2].map((ax) => { const i = at(ax, cs[ax], cs); return vert(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); });
    tri(t[0], t[1], t[2]);
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  cache.set(key, g);
  return g;
}

// materials that must stay crisp: glowing panes, light sprites, black voids, glass and water
const CRISP = new Set(['glow', 'window', 'dark', 'lightpool', 'shaft', 'glass', 'water', 'sewage']);
// the cut for a box of size sx, sy, sz in metres: about 4 cm on big pieces, never more than a sixth of the thinnest side;
// thin planks, rails and trims (under 10 cm) stay square: a chamfer there doesn't show and would only cost triangles
const CUT = 0.045, MIN_SIDE = 0.1;
// the geometry to use instead of the plain unit box for a box scaled (sx, sy, sz), or null to keep it square
const OFF = typeof location !== 'undefined' && /[?&]nobevel/.test(location.search); // ?nobevel: square boxes, to compare
export function bevelFor(key, sx, sy, sz) {
  if (OFF || CRISP.has(key)) return null;
  const m = Math.min(sx, sy, sz); if (!(m > MIN_SIDE)) return null;
  const c = Math.min(CUT, m / 6);
  return chamferBox(Math.min(0.24, c / sx), Math.min(0.24, c / sy), Math.min(0.24, c / sz));
}
