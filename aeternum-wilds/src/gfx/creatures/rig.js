// Aeternum Wilds creatures: a skinned rig built from soft parts (melted into one SDF body) and crisp parts
// (eyes, teeth, claws, horns); ported from Kingdom Rising 3D's creatures.js.
import { THREE, col, MATS, bodyMaterial, furMaterial, furLayers } from './core.js';
import { sdfMesh } from './sdfmesh.js';

const cone8 = new THREE.ConeGeometry(0.5, 1, 8, 1);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const sph = new THREE.SphereGeometry(1, 16, 12);

export class Rig {
  constructor(defs) {
    this.defs = defs; this.names = defs.map((d) => d[0]); this.bi = Object.fromEntries(defs.map((d, i) => [d[0], i]));
    this.par = Object.fromEntries(defs.map((d) => [d[0], d[1]])); this.rest = Object.fromEntries(defs.map((d) => [d[0], d[2]]));
    this.pos = []; this.nor = []; this.col = []; this.mat = []; this.si = []; this.sw = []; this.idx = []; this.n = 0; this.prims = []; this.organic = true; this.hardD = 0;
  }
  // parts drawn crisp (eyes, teeth, horns, claws) instead of melted into the body
  hard(fn) { this.hardD++; try { fn(); } finally { this.hardD--; } }
  soft(mat) { return this.organic && !this.hardD && !['glow', 'bone', 'shell', 'metal', 'horn', 'gem'].includes(mat); }
  prim(o, bone, color, mat, bone2, w2) { o.col = col(color || 0x888888, new THREE.Color()); o.bone = this.bi[bone]; o.bone2 = bone2 ? this.bi[bone2] : null; o.w2 = w2 || 0; o.mat = MATS[mat] || MATS.plain; this.prims.push(o); }
  add(g, m, bone, color, mat = 'plain', bone2 = null, w2 = 0) {
    const pa = g.attributes.position, na = g.attributes.normal; const nm = new THREE.Matrix3().getNormalMatrix(m);
    const c = col(color || 0x888888, new THREE.Color()); const M = MATS[mat] || MATS.plain;
    const bi = this.bi[bone], b2 = bone2 ? this.bi[bone2] : bi; const base = this.n; const v = new THREE.Vector3(), n = new THREE.Vector3();
    if (bi === undefined) throw new Error('no bone ' + bone);
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m); n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); this.pos.push(v.x, v.y, v.z); this.nor.push(n.x, n.y, n.z); this.col.push(c.r, c.g, c.b); this.mat.push(M[0], M[1], M[2]); this.si.push(bi, b2, 0, 0); this.sw.push(1 - w2, w2, 0, 0); }
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) this.idx.push(base + ia[i]); } else for (let i = 0; i < pa.count; i++) this.idx.push(base + i);
    this.n += pa.count;
  }
  ell(bone, p, r, color, mat, rot, bone2, w2) { if (this.soft(mat)) return this.prim({ t: 'e', p: [...p], r: [...r], q: rot }, bone, color, mat, bone2, w2); this.add(sph, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || new THREE.Quaternion(), new THREE.Vector3(...r)), bone, color, mat, bone2, w2); }
  seg(bone, a, b, r0, r1, color, mat, bone2, w2) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const L = A.distanceTo(B); if (L < 1e-4) return;
    if (this.soft(mat)) return this.prim({ t: 's', a: [...a], b: [...b], r0, r1 }, bone, color, mat, bone2, w2);
    const g = new THREE.CylinderGeometry(r1, r0, L, 8, 1); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    this.add(g, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), bone, color, mat, bone2, w2); g.dispose();
    const s = new THREE.SphereGeometry(Math.max(r0, r1), 8, 6); this.add(s, new THREE.Matrix4().makeTranslation(...(r0 >= r1 ? a : b)), bone, color, mat, bone2, w2); s.dispose();
  }
  cone(bone, p, r, h, rot, color, mat) {
    if (this.soft(mat)) { const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(rot || new THREE.Quaternion()); const P0 = new THREE.Vector3(...p).addScaledVector(ax, -h / 2), P1 = new THREE.Vector3(...p).addScaledVector(ax, h / 2); return this.prim({ t: 's', a: P0.toArray(), b: P1.toArray(), r0: r, r1: r * 0.12, k: r * 0.6 }, bone, color, mat); }
    this.add(cone8, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || new THREE.Quaternion(), new THREE.Vector3(r * 2, h, r * 2)), bone, color, mat);
  }
  box(bone, p, s, color, mat, rot) { if (this.soft(mat)) return this.prim({ t: 'b', p: [...p], h: [s[0] / 2, s[1] / 2, s[2] / 2], q: rot, round: Math.min(...s) * 0.25, k: Math.min(...s) * 0.6 }, bone, color, mat); this.add(unitBox, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || new THREE.Quaternion(), new THREE.Vector3(...s)), bone, color, mat); }
  // any geometry, placed by a matrix, crisp
  geom(bone, g, m, color, mat, bone2, w2) { this.add(g, m, bone, color, mat, bone2, w2); }
  // a curved horn/antler/tusk: a chain of tapering segments from p along d, bending by bend per step
  curve(bone, p, d, len, r0, r1, n, bend, color, mat) {
    let P = [...p], D = new THREE.Vector3(...d).normalize(); const step = len / n; const B = new THREE.Vector3(...bend);
    for (let k = 0; k < n; k++) { const Q2 = [P[0] + D.x * step, P[1] + D.y * step, P[2] + D.z * step]; const ra = r0 + (r1 - r0) * (k / n), rb = r0 + (r1 - r0) * ((k + 1) / n); this.seg(bone, P, Q2, ra, rb, color, mat); P = Q2; D.add(B).normalize(); }
    return P;
  }
  // a two-sided membrane (wings): points P, triangles tris, verts in `outer` bound to bone2
  membrane(bone1, bone2, P, tris, outer, color, mat) {
    for (const flip of [false, true]) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      const idx = []; for (let i = 0; i < tris.length; i += 3) { if (flip) idx.push(tris[i], tris[i + 2], tris[i + 1]); else idx.push(tris[i], tris[i + 1], tris[i + 2]); }
      g.setIndex(idx); g.computeVertexNormals();
      const base = this.n; this.add(g, new THREE.Matrix4(), bone1, color, mat);
      for (const k of outer) { this.si[(base + k) * 4] = this.bi[bone2]; this.si[(base + k) * 4 + 1] = this.bi[bone2]; }
      g.dispose();
    }
  }
  geometry() {
    if (this.prims.length) {
      // one smooth body for all the soft parts, plus the crisp ones as they are
      const body = sdfMesh(this.prims, this.k || 0.05, this.cell || 0.03);
      if (this.paint) this.paint(body);
      this.body = body;
      if (!this.n) { body.computeBoundingSphere(); body.boundingSphere.radius *= 1.8; return body; }
      this.prims = []; const hard = this.geometry();
      const out = new THREE.BufferGeometry(); const nb = body.attributes.position.count;
      for (const k of ['position', 'normal', 'color', 'aMat', 'skinIndex', 'skinWeight']) { const a = body.attributes[k], b = hard.attributes[k]; const arr = new a.array.constructor(a.array.length + b.array.length); arr.set(a.array); arr.set(b.array, a.array.length); out.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize)); }
      const ia = body.index.array, ib = hard.index.array; const ix = new Uint32Array(ia.length + ib.length); ix.set(ia); for (let i = 0; i < ib.length; i++) ix[ia.length + i] = ib[i] + nb; out.setIndex(new THREE.BufferAttribute(ix, 1));
      out.computeBoundingSphere(); out.boundingSphere.radius *= 1.8; return out;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3)); g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.boundingSphere.radius *= 1.8; return g;
  }
}

// fur shells: the body repeated a few times; each layer the shader pushes out and cuts into strands
const furGeoCache = new WeakMap();
function furGeometry(body, layers) {
  let byL = furGeoCache.get(body); if (!byL) furGeoCache.set(body, (byL = {}));
  if (byL[layers]) return byL[layers];
  const n = body.attributes.position.count; const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color', 'aMat', 'skinIndex', 'skinWeight']) { const a = body.attributes[k]; const arr = new a.array.constructor(a.array.length * layers); for (let l = 0; l < layers; l++) arr.set(a.array, l * a.array.length); out.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize, a.normalized)); }
  const sh = new Float32Array(n * layers); for (let l = 0; l < layers; l++) sh.fill((l + 1) / layers, l * n, (l + 1) * n); out.setAttribute('aShell', new THREE.BufferAttribute(sh, 1));
  const ia = body.index.array; const ix = new Uint32Array(ia.length * layers); for (let l = 0; l < layers; l++) for (let i = 0; i < ia.length; i++) ix[l * ia.length + i] = ia[i] + l * n; out.setIndex(new THREE.BufferAttribute(ix, 1));
  if (!body.boundingSphere) body.computeBoundingSphere();
  out.boundingSphere = body.boundingSphere.clone(); out.boundingSphere.radius *= 1.8;
  return (byL[layers] = out);
}
export function addFur(inst, body, len) {
  const layers = furLayers(); if (!layers || !body || len <= 0) return;
  const m = new THREE.SkinnedMesh(furGeometry(body, layers), furMaterial(len));
  m.bind(inst.mesh.skeleton, inst.mesh.bindMatrix); m.castShadow = false; m.receiveShadow = true;
  m.boundingSphere = m.geometry.boundingSphere.clone();
  inst.mesh.add(m); inst.fur = m; inst.mats.push(m.material);
}
// one creature: its own bones and material over a shared body geometry
export function instance(rig, geom) {
  const bones = rig.names.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  bones.forEach((b, i) => { const n = rig.names[i]; const p = rig.rest[n]; const par = rig.par[n]; if (par) { const pp = rig.rest[par]; b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); bones[rig.bi[par]].add(b); } else b.position.set(p[0], p[1], p[2]); });
  const mat = bodyMaterial();
  const mesh = new THREE.SkinnedMesh(geom, mat); mesh.add(bones[0]); mesh.bind(new THREE.Skeleton(bones)); mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.boundingSphere = geom.boundingSphere.clone();
  return { mesh, bones: Object.fromEntries(bones.map((b) => [b.name, b])), rest: rig.rest, mats: [mat] };
}
