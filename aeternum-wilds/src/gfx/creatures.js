// The owner's Meshy animals (bear, tiger, wolf). They come as one solid mesh, so they are rigged here
// automatically: every vertex is assigned to the body, one of the four legs, the head or the tail, with
// soft blending at the joints, and the result is a skinned mesh whose bones are the same "parts" the
// built-in beasts have (torso, head, tail, legs), so anim.js walks, bites and wags them unchanged.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = './assets/models/c/';
// len: body length in metres; leg: share of the height that is leg; head/tail: share of the length
const KINDS = {
  wolf: { file: 'wolf', len: 1.7, leg: 0.42, head: 0.27, tail: 0.17 },
  bear: { file: 'bear', len: 2.3, leg: 0.36, head: 0.24, tail: 0.06 },
  tiger: { file: 'tiger', len: 2.4, leg: 0.4, head: 0.22, tail: 0.14 },
};
const R = {};
export const creatureReady = kind => !!R[kind];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function rig(src, K) {
  const g = src.geometry.clone();
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); // centred, feet on y = 0
  g.computeBoundingBox();
  const b = g.boundingBox, H = b.max.y, L = b.max.z - b.min.z;
  const pos = g.getAttribute('position'), n = pos.count;
  const belly = H * K.leg, band = H * 0.07;
  const zHead = b.max.z - L * K.head, zTail = b.min.z + L * K.tail, bandZ = L * 0.05;
  // legs split front/back at the middle of the low vertices
  let zc = 0, cnt = 0;
  for (let i = 0; i < n; i++) if (pos.getY(i) < belly * 0.6) { zc += pos.getZ(i); cnt++; }
  zc = cnt ? zc / cnt : 0;
  // left/right split at the middle of each leg pair (the model is rarely centred: tails and heads swing aside)
  const xs = [[], []];
  for (let i = 0; i < n; i++) if (pos.getY(i) < belly * 0.6) xs[pos.getZ(i) > zc ? 0 : 1].push(pos.getX(i));
  const xm = xs.map(a => { a.sort((p, q) => p - q); return a.length ? (a[0] + a[a.length - 1]) / 2 : 0; });
  // bones: 0 torso, 1-4 legs (front-left, front-right, back-left, back-right), 5 head, 6 tail
  const legOf = (x, z) => { const f = z > zc ? 0 : 1; return 1 + f * 2 + (x > xm[f] ? 0 : 1); };
  const acc = Array.from({ length: 7 }, () => ({ x: 0, y: 0, z: 0, n: 0 }));
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let part = 0, w = 0;
    const wt = z < zTail + bandZ ? smooth(zTail + bandZ, zTail - bandZ, z) : 0;
    const wh = y > belly - band ? smooth(zHead - bandZ, zHead + bandZ, z) : 0;
    const wl = smooth(belly + band, belly - band, y);
    if (wt > 0 && (wl < 0.5 || z < zTail - 2 * bandZ)) { part = 6; w = wt; }
    else if (wh > 0 && wh >= wl) { part = 5; w = wh; }
    else if (wl > 0) { part = legOf(x, z); w = wl; }
    si[i * 4] = part; sw[i * 4] = w; si[i * 4 + 1] = 0; sw[i * 4 + 1] = 1 - w;
    if (w > 0.5) { const a = acc[part]; a.x += x; a.y += y; a.z += z; a.n++; }
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  // joint positions
  const mean = (k, def) => acc[k].n ? new THREE.Vector3(acc[k].x / acc[k].n, acc[k].y / acc[k].n, acc[k].z / acc[k].n) : def;
  const joints = [new THREE.Vector3(0, belly, 0)];
  for (let k = 1; k <= 4; k++) { const m = mean(k, new THREE.Vector3(k % 2 ? 0.2 : -0.2, 0, k < 3 ? zc + 0.3 : zc - 0.3)); joints.push(new THREE.Vector3(m.x, belly + band, m.z)); }
  const hm = mean(5, new THREE.Vector3(0, H * 0.7, b.max.z)), tm = mean(6, new THREE.Vector3(0, H * 0.6, b.min.z));
  joints.push(new THREE.Vector3(0, Math.max(belly, hm.y - H * 0.05), zHead));
  joints.push(new THREE.Vector3(0, Math.max(belly, tm.y), zTail));
  g.computeBoundingSphere();
  const m = src.material;
  for (const t of [m.map, m.normalMap, m.metalnessMap]) if (t) t.anisotropy = 8;
  return { g, joints, mat: m, scale: K.len / L };
}

async function load(kind) {
  const K = KINDS[kind];
  const gl = await new GLTFLoader().loadAsync(BASE + K.file + '.glb');
  let src = null;
  gl.scene.traverse(o => { if (o.isMesh && !src) src = o; });
  // clean degenerate normals (NaN in the shader turns the whole bloomed screen black)
  const nrm = src.geometry.getAttribute('normal');
  if (nrm) for (let i = 0; i < nrm.count; i++) { const l = Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)); if (!(l > 1e-4)) nrm.setXYZ(i, 0, 1, 0); }
  R[kind] = rig(src, K);
}
export async function loadCreatures() {
  await Promise.all([...Object.keys(KINDS).map(k => load(k).catch(e => console.warn('creature', k, e)))]);
}

// same shape as makeBeast: { root, body, mats, parts: { torso, head, tail, legs }, size, beast }
export function makeCreature(kind, o = {}) {
  const C = R[kind];
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const s = (o.size || 1) * C.scale;
  body.scale.setScalar(s);
  const bones = C.joints.map(() => new THREE.Bone());
  const J = C.joints;
  bones[0].position.copy(J[0]);
  for (let k = 1; k < 7; k++) { bones[k].position.copy(J[k]).sub(J[0]); bones[0].add(bones[k]); }
  const mat = C.mat.clone();
  if (o.tint != null) mat.color.set(o.tint);
  const mesh = new THREE.SkinnedMesh(C.g, mat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  body.add(bones[0]); body.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  // the torso bone sits at belly height over the centre (z = 0), so anim.js's torso moves work about it
  return { root, body, mats: [mat, mat], parts: { torso: bones[0], head: bones[5], tail: bones[6], legs: [bones[1], bones[2], bones[3], bones[4]] }, size: o.size || 1, beast: true, real: true };
}
