// Kingdom Rising 3D — beasts and monsters that are not people: wolves, bears, boars, rats, tigers,
// crocodiles, drakes and dragons, griffons, spiders, beetles, mosquitoes, snakes, bats, treants and
// golems, plus the glowing ones (wisps, ghosts, elementals). Each gets a skinned rig and its own gait.
import { THREE, K3 } from './core.js';
import { PRIM } from './mb.js';
import { charMat } from './chars.js';

const shade = (c, a) => K3.shade(c || '#777777', a);
const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const MATS = { plain: [0, 0.8, 0], fur: [0, 1, 4], skin: [0, 0.6, 5], scales: [0.1, 0.45, 10], bone: [0, 0.7, 8], glow: [0, 1, 9], shell: [0.2, 0.3, 3], rock: [0, 0.95, 2], wood: [0, 0.9, 2], leaf: [0, 0.9, 1], metal: [0.85, 0.32, 3] };

class Rig {
  constructor(defs) { this.defs = defs; this.names = defs.map((d) => d[0]); this.bi = Object.fromEntries(defs.map((d, i) => [d[0], i])); this.par = Object.fromEntries(defs.map((d) => [d[0], d[1]])); this.rest = Object.fromEntries(defs.map((d) => [d[0], d[2]])); this.pos = []; this.nor = []; this.col = []; this.mat = []; this.si = []; this.sw = []; this.idx = []; this.n = 0; }
  add(g, m, bone, color, mat = 'plain', bone2 = null, w2 = 0) {
    const pa = g.attributes.position, na = g.attributes.normal; const nm = new THREE.Matrix3().getNormalMatrix(m);
    const c = K3.col(color || '#888888', new THREE.Color()); const M = MATS[mat] || MATS.plain;
    const bi = this.bi[bone], b2 = bone2 ? this.bi[bone2] : bi; const base = this.n; const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m); n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); this.pos.push(v.x, v.y, v.z); this.nor.push(n.x, n.y, n.z); this.col.push(c.r, c.g, c.b); this.mat.push(M[0], M[1], M[2]); this.si.push(bi, b2, 0, 0); this.sw.push(1 - w2, w2, 0, 0); }
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) this.idx.push(base + ia[i]); } else for (let i = 0; i < pa.count; i++) this.idx.push(base + i);
    this.n += pa.count;
  }
  ell(bone, p, r, color, mat, rot, bone2, w2) { const g = new THREE.SphereGeometry(1, 16, 12); this.add(g, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || new THREE.Quaternion(), new THREE.Vector3(...r)), bone, color, mat, bone2, w2); g.dispose(); }
  seg(bone, a, b, r0, r1, color, mat, bone2, w2) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const L = A.distanceTo(B); if (L < 1e-4) return;
    const g = new THREE.CylinderGeometry(r1, r0, L, 10, 2); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    this.add(g, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), bone, color, mat, bone2, w2); g.dispose();
    const s = new THREE.SphereGeometry(r0, 8, 6); this.add(s, new THREE.Matrix4().makeTranslation(A.x, A.y, A.z), bone, color, mat, bone2, w2); s.dispose();
  }
  cone(bone, p, r, h, rot, color, mat) { this.add(PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || new THREE.Quaternion(), new THREE.Vector3(r * 2, h, r * 2)), bone, color, mat); }
  box(bone, p, s, color, mat, rot) { this.add(PRIM.box, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || new THREE.Quaternion(), new THREE.Vector3(...s)), bone, color, mat); }
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
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3)); g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.boundingSphere.radius *= 1.8; return g;
  }
}
function instance(rig, geom) {
  const bones = rig.names.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  bones.forEach((b, i) => { const n = rig.names[i]; const p = rig.rest[n]; const par = rig.par[n]; if (par) { const pp = rig.rest[par]; b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); bones[rig.bi[par]].add(b); } else b.position.set(p[0], p[1], p[2]); });
  const mesh = new THREE.SkinnedMesh(geom, charMat); mesh.add(bones[0]); mesh.bind(new THREE.Skeleton(bones)); mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, bones: Object.fromEntries(bones.map((b) => [b.name, b])), rest: rig.rest };
}

// ---------- quadrupeds (and their winged cousins) ----------
const QUAD = {
  rat: { L: 0.72, H: 0.3, br: 0.13, hr: 0.085, sn: 0.11, ear: 'round', tail: 0.62, tailR: 0.015, leg: 0.03, earCol: '#e8a0a0', tailCol: '#d8a0a0' },
  wolf: { L: 1.45, H: 0.82, br: 0.21, hr: 0.13, sn: 0.19, ear: 'point', tail: 0.55, tailR: 0.07, leg: 0.05, eye: '#e8c040' },
  spiritwolf: { L: 1.45, H: 0.82, br: 0.21, hr: 0.13, sn: 0.19, ear: 'point', tail: 0.55, tailR: 0.07, leg: 0.05, eye: '#9ef', glowy: true },
  tiger: { L: 1.95, H: 0.95, br: 0.26, hr: 0.17, sn: 0.12, ear: 'round', tail: 0.95, tailR: 0.035, leg: 0.075, stripes: true, eye: '#e8c040' },
  bear: { L: 2.0, H: 1.22, br: 0.43, hr: 0.22, sn: 0.14, ear: 'round', tail: 0.08, tailR: 0.06, leg: 0.12, hump: true, eye: '#2a1a10' },
  boar: { L: 1.35, H: 0.82, br: 0.3, hr: 0.18, sn: 0.2, ear: 'point', tail: 0.18, tailR: 0.02, leg: 0.055, tusk: true, mane: true },
  croc: { L: 3.2, H: 0.42, br: 0.28, hr: 0.16, sn: 0.62, ear: null, tail: 1.6, tailR: 0.2, leg: 0.07, flat: true, sprawl: true, scales: true, eye: '#e8d040' },
  drake: { L: 3.4, H: 1.35, br: 0.42, hr: 0.22, sn: 0.32, ear: null, tail: 2.2, tailR: 0.18, leg: 0.11, neck: 0.9, wings: 2.8, horns: true, scales: true, spikes: true, eye: '#ffd23a' },
  dragon: { L: 6.5, H: 2.5, br: 0.85, hr: 0.42, sn: 0.62, ear: null, tail: 4.5, tailR: 0.38, leg: 0.24, neck: 2.2, wings: 6.5, horns: true, scales: true, spikes: true, eye: '#ffd23a' },
  griffon: { L: 2.3, H: 1.25, br: 0.34, hr: 0.2, sn: 0.12, ear: 'tuft', tail: 0.9, tailR: 0.04, leg: 0.08, neck: 0.35, wings: 2.5, beak: true, eye: '#1a1a1a' },
  horse: { L: 2.1, H: 1.5, br: 0.33, hr: 0.16, sn: 0.36, ear: 'point', tail: 0.8, tailR: 0.07, leg: 0.065, neck: 0.75, mane: true, eye: '#1a1a1a', long: true },
};
function quadRig(sp) {
  const L = sp.L, H = sp.H; const hx = L * 0.32; const legH = H * (sp.sprawl ? 0.45 : 0.62);
  const defs = [
    ['root', null, [0, legH, 0]], ['pelvis', 'root', [0, legH, -hx]], ['chest', 'root', [0, legH + sp.br * 0.1, hx]],
    ['neck', 'chest', [0, legH + sp.br * 0.5, hx + sp.br * 0.6]], ['head', 'neck', [0, legH + sp.br * 0.5 + (sp.neck || 0.15) * 0.8, hx + sp.br * 0.6 + (sp.neck || 0.15) * 0.6 + sp.hr * 0.4]], ['jaw', 'head', [0, legH + sp.br * 0.5 + (sp.neck || 0.15) * 0.8 - sp.hr * 0.4, hx + sp.br * 0.6 + (sp.neck || 0.15) * 0.6 + sp.hr * 0.5]],
    ['tail1', 'pelvis', [0, legH + sp.br * 0.25, -hx - sp.br * 0.8]], ['tail2', 'tail1', [0, legH + sp.br * 0.1 - sp.tail * 0.2, -hx - sp.br * 0.8 - sp.tail * 0.45]], ['tail3', 'tail2', [0, legH - sp.tail * 0.3, -hx - sp.br * 0.8 - sp.tail * 0.85]],
  ];
  const sx = sp.br * (sp.sprawl ? 1.25 : 0.7);
  for (const [n, z, par] of [['FL', hx, 'chest'], ['FR', hx, 'chest'], ['BL', -hx, 'pelvis'], ['BR', -hx, 'pelvis']]) {
    const x = n[1] === 'L' ? sx : -sx;
    defs.push([n + '1', par, [x, legH, z]], [n + '2', n + '1', [x * (sp.sprawl ? 1.6 : 1), legH * 0.48, z + (n[0] === 'B' ? -0.04 : 0.02)]], [n + '3', n + '2', [x * (sp.sprawl ? 1.6 : 1), 0.04, z + 0.02]]);
  }
  if (sp.wings) for (const s of [1, -1]) { const n = s > 0 ? 'WL' : 'WR'; defs.push([n + '1', 'chest', [s * sp.br * 0.6, legH + sp.br * 0.8, hx * 0.6]], [n + '2', n + '1', [s * (sp.br * 0.6 + sp.wings * 0.45), legH + sp.br * 0.8 + 0.1, hx * 0.4]]); }
  return defs;
}
function buildQuad(kind, col, rnd) {
  const sp = QUAD[kind] || QUAD.wolf; const R = new Rig(quadRig(sp)); const r = R.rest;
  const mat = sp.scales ? 'scales' : kind === 'spiritwolf' ? 'glow' : 'fur'; const c = col;
  const belly = shade(c, 0.18), dark = shade(c, -0.3);
  // body
  const bl = sp.L * 0.55;
  R.ell('pelvis', [0, r.pelvis[1] + sp.br * 0.05, r.pelvis[2]], [sp.br * 0.95, sp.br * (sp.flat ? 0.55 : 0.92), sp.br * 1.25], c, mat, null, 'root', 0.3);
  R.ell('chest', [0, r.chest[1] + (sp.hump ? sp.br * 0.25 : 0), r.chest[2]], [sp.br * 1.05, sp.br * (sp.flat ? 0.6 : 1.05), sp.br * 1.3], c, mat, null, 'root', 0.3);
  R.ell('root', [0, r.root[1] - sp.br * 0.15, 0], [sp.br * 0.92, sp.br * (sp.flat ? 0.5 : 0.85), bl * 0.62], sp.stripes ? c : belly, mat);
  if (sp.stripes) for (let k = -3; k <= 3; k++) R.box('root', [0, r.root[1] + sp.br * 0.45, k * bl * 0.16], [sp.br * 1.9, sp.br * 0.3, 0.05], '#2a1a10', 'fur', Q(0, 0, 0));
  if (sp.mane) for (let k = 0; k < 6; k++) R.cone('chest', [0, r.chest[1] + sp.br * 0.95, r.chest[2] - k * sp.br * 0.35 + sp.br * 0.4], sp.br * 0.12, sp.br * 0.5, Q(-0.3, 0, 0), dark, 'fur');
  if (sp.spikes) for (let k = 0; k < 9; k++) { const z = r.chest[2] + sp.br * 0.5 - k * sp.L * 0.12; R.cone(k < 4 ? 'chest' : 'pelvis', [0, r.root[1] + sp.br * 0.85 - Math.max(0, k - 5) * 0.05, z], sp.br * 0.12, sp.br * 0.55, Q(-0.35, 0, 0), dark, 'bone'); }
  // neck and head
  const nk = sp.neck || 0.15;
  R.seg('neck', [0, r.chest[1] + sp.br * 0.3, r.chest[2] + sp.br * 0.5], r.head, sp.br * (sp.neck ? 0.42 : 0.62), sp.hr * 0.85, c, mat, 'chest', 0.25);
  R.ell('head', r.head, [sp.hr * 0.95, sp.hr * 0.9, sp.hr * 1.15], c, mat);
  if (sp.beak) { R.ell('head', [0, r.head[1], r.head[2]], [sp.hr * 1.0, sp.hr, sp.hr * 1.1], '#f4efe0', 'fur'); R.cone('head', [0, r.head[1] - sp.hr * 0.15, r.head[2] + sp.hr * 1.15], sp.hr * 0.38, sp.hr * 1.0, Q(Math.PI / 2 + 0.4, 0, 0), '#e8c040', 'shell'); }
  else {
    // snout and jaw
    R.ell('head', [0, r.head[1] - sp.hr * 0.12, r.head[2] + sp.hr * 0.6 + sp.sn * 0.5], [sp.hr * (sp.flat ? 0.75 : 0.55), sp.hr * (sp.flat ? 0.35 : 0.48), sp.sn * 0.75 + sp.hr * 0.3], shade(c, -0.05), mat);
    R.ell('jaw', [0, r.jaw[1] - sp.hr * 0.12, r.jaw[2] + sp.sn * 0.5], [sp.hr * (sp.flat ? 0.7 : 0.45), sp.hr * 0.22, sp.sn * 0.7 + sp.hr * 0.25], belly, mat);
    R.ell('head', [0, r.head[1] - sp.hr * 0.05, r.head[2] + sp.hr * 0.6 + sp.sn * 1.15], [sp.hr * 0.18, sp.hr * 0.14, sp.hr * 0.12], '#1a1a1a', 'skin');
    if (sp.flat) for (let k = 0; k < 10; k++) R.cone('jaw', [(k % 2 ? 1 : -1) * sp.hr * 0.5, r.jaw[1] - sp.hr * 0.02, r.jaw[2] + sp.hr * 0.4 + (k >> 1) * sp.sn * 0.25], sp.hr * 0.05, sp.hr * 0.2, null, '#f0ead8', 'bone');
    else for (const s of [-1, 1]) R.cone('jaw', [s * sp.hr * 0.22, r.jaw[1] + sp.hr * 0.05, r.jaw[2] + sp.sn * 0.8], sp.hr * 0.04, sp.hr * 0.18, null, '#f0ead8', 'bone');
  }
  if (sp.tusk) for (const s of [-1, 1]) R.cone('jaw', [s * sp.hr * 0.4, r.jaw[1] + sp.hr * 0.3, r.jaw[2] + sp.sn * 0.6], sp.hr * 0.08, sp.hr * 0.65, Q(0.5, 0, -s * 0.5), '#f0ead8', 'bone');
  // eyes and ears
  for (const s of [-1, 1]) {
    R.ell('head', [s * sp.hr * 0.55, r.head[1] + sp.hr * 0.25, r.head[2] + sp.hr * 0.65], [sp.hr * 0.14, sp.hr * 0.14, sp.hr * 0.1], sp.eye || '#1a1a1a', sp.eye && sp.eye !== '#1a1a1a' && sp.eye !== '#2a1a10' ? 'glow' : 'skin');
    if (sp.ear === 'point') R.cone('head', [s * sp.hr * 0.5, r.head[1] + sp.hr * 0.85, r.head[2] - sp.hr * 0.2], sp.hr * 0.22, sp.hr * 0.6, Q(-0.2, 0, -s * 0.3), dark, mat);
    else if (sp.ear === 'round') R.ell('head', [s * sp.hr * 0.6, r.head[1] + sp.hr * 0.75, r.head[2] - sp.hr * 0.15], [sp.hr * 0.24, sp.hr * 0.24, sp.hr * 0.1], sp.earCol || dark, mat);
    else if (sp.ear === 'tuft') R.cone('head', [s * sp.hr * 0.45, r.head[1] + sp.hr * 0.8, r.head[2] - sp.hr * 0.4], sp.hr * 0.15, sp.hr * 0.7, Q(-0.8, 0, -s * 0.3), '#f4efe0', 'fur');
    if (sp.horns) R.cone('head', [s * sp.hr * 0.5, r.head[1] + sp.hr * 0.6, r.head[2] - sp.hr * 0.5], sp.hr * 0.16, sp.hr * 1.4, Q(-1.1, 0, -s * 0.25), '#e8dcc0', 'bone');
  }
  // tail
  if (sp.tail > 0.1) { R.seg('tail1', r.tail1, r.tail2, sp.tailR, sp.tailR * 0.8, sp.tailCol || c, mat); R.seg('tail2', r.tail2, r.tail3, sp.tailR * 0.8, sp.tailR * 0.5, sp.tailCol || c, mat); R.seg('tail3', r.tail3, [0, r.tail3[1] - sp.tail * 0.15, r.tail3[2] - sp.tail * 0.3], sp.tailR * 0.5, sp.tailR * 0.15, sp.tailCol || c, mat); }
  else R.ell('pelvis', [0, r.pelvis[1] + sp.br * 0.4, r.pelvis[2] - sp.br * 1.1], [sp.br * 0.2, sp.br * 0.2, sp.br * 0.2], c, mat);
  // legs
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    const a = r[n + '1'], b = r[n + '2'], f = r[n + '3']; const lr = sp.leg * (n[0] === 'B' ? 1.15 : 1);
    R.seg(n + '1', [a[0], a[1] + sp.br * 0.15, a[2]], b, lr * 1.6, lr * 1.0, c, mat, n[0] === 'F' ? 'chest' : 'pelvis', 0.0);
    R.seg(n + '2', b, f, lr, lr * 0.75, n === 'FL' || n === 'FR' ? c : c, mat);
    if (sp.beak && n[0] === 'F') { for (let k = -1; k <= 1; k++) R.cone(n + '3', [f[0] + k * lr * 0.6, f[1], f[2] + lr * 1.6], lr * 0.3, lr * 1.5, Q(Math.PI / 2, 0, 0), '#e8c040', 'shell'); }
    else R.ell(n + '3', [f[0], f[1], f[2] + lr * 0.6], [lr * 1.1, lr * 0.6, lr * 1.6], dark, mat);
  }
  // wings: a membrane on two bones
  if (sp.wings) for (const s of [1, -1]) {
    const n = s > 0 ? 'WL' : 'WR'; const a = r[n + '1'], b = r[n + '2'];
    const wc = kind === 'griffon' ? '#f0e8d0' : shade(c, -0.2);
    const span = sp.wings; const g = new THREE.BufferGeometry();
    const tipX = b[0] + s * span * 0.55;
    const P = [a[0], a[1], a[2], b[0], b[1], b[2], tipX, b[1] - span * 0.1, b[2] - span * 0.2, b[0] + s * span * 0.2, b[1] - span * 0.25, b[2] - span * 0.55, a[0] + s * span * 0.1, a[1] - span * 0.1, a[2] - span * 0.6];
    g.dispose();
    R.membrane(n + '1', n + '2', P, [0, 1, 4, 1, 3, 4, 1, 2, 3], [1, 2, 3], wc, kind === 'griffon' ? 'fur' : 'skin');
    R.seg(n + '1', a, b, sp.br * 0.12, sp.br * 0.08, dark, mat); R.seg(n + '2', b, [tipX, b[1] - span * 0.1, b[2] - span * 0.2], sp.br * 0.08, sp.br * 0.03, dark, mat);
  }
  const geom = R.geometry(); const inst = instance(R, geom);
  return Object.assign(inst, { type: 'quad', sp, t: Math.random() * 10, phase: Math.random() * 6 });
}
function animQuad(rig, st, dt) {
  const B = rig.bones, sp = rig.sp; const t = (rig.t += dt);
  const stride = sp.L * 0.9; rig.phase += (st.dist / stride) * Math.PI * 2 * 0.5;
  rig.mv = (rig.mv || 0) + (K3.clamp(st.move, 0, 1) - (rig.mv || 0)) * Math.min(1, dt * 8); const m = rig.mv;
  for (const k in B) B[k].rotation.set(0, 0, 0);
  B.root.position.set(rig.rest.root[0], rig.rest.root[1], rig.rest.root[2]);
  const ph = rig.phase; const A = 0.55 * m;
  const leg = (n, p) => { B[n + '1'].rotation.x = Math.sin(p) * A; B[n + '2'].rotation.x = (n[0] === 'F' ? -1 : 1) * Math.max(0, Math.cos(p)) * 0.6 * m; };
  leg('FL', ph); leg('BR', ph); leg('FR', ph + Math.PI); leg('BL', ph + Math.PI);
  B.root.position.y += Math.abs(Math.sin(ph)) * 0.04 * m * sp.H;
  B.chest.rotation.x = Math.sin(ph * 2) * 0.03 * m;
  B.neck.rotation.x = Math.sin(t * 1.5) * 0.04 + Math.sin(ph * 2) * 0.05 * m;
  B.head.rotation.y = Math.sin(t * 0.7) * 0.15 * (1 - m);
  if (B.tail1) { B.tail1.rotation.x = 0.25 - m * 0.2; B.tail1.rotation.y = Math.sin(t * 3 + ph) * 0.2; B.tail2.rotation.y = Math.sin(t * 3 + ph - 0.7) * 0.25; B.tail3.rotation.y = Math.sin(t * 3 + ph - 1.4) * 0.3; }
  // flying: wings beat, legs tucked, body lifted
  const fly = st.fly;
  if (B.WL1) {
    const beat = fly ? Math.sin(t * (sp.L > 5 ? 3 : 6)) : Math.sin(t * 1.2) * 0.15 - 0.9;
    B.WL1.rotation.z = fly ? beat * 0.9 : -0.2; B.WR1.rotation.z = fly ? -beat * 0.9 : 0.2;
    B.WL2.rotation.z = fly ? beat * 0.5 : -1.6; B.WR2.rotation.z = fly ? -beat * 0.5 : 1.6;
    B.WL1.rotation.y = fly ? 0 : 0.9; B.WR1.rotation.y = fly ? 0 : -0.9;
    if (fly) for (const n of ['FL', 'FR', 'BL', 'BR']) { B[n + '1'].rotation.x = n[0] === 'F' ? -0.9 : 0.9; B[n + '2'].rotation.x = n[0] === 'F' ? 1.2 : -1.0; }
  }
  // attack: lunge and bite
  const a = st.atk || 0;
  if (a > 0 && a < 1) { const s1 = Math.sin(a * Math.PI); B.root.position.z += s1 * sp.L * 0.12; B.neck.rotation.x += s1 * 0.4; B.head.rotation.x = -s1 * 0.25; if (B.jaw) B.jaw.rotation.x = s1 * 0.6; if (!fly) { B.FL1.rotation.x -= s1 * 0.6; B.FR1.rotation.x -= s1 * 0.5; } }
  if (st.breath) { B.neck.rotation.x -= 0.25; B.head.rotation.x = -0.2; if (B.jaw) B.jaw.rotation.x = 0.7; }
  if (st.animK === 'slam' && st.animP > 0 && st.animP < 1) { const s1 = Math.sin(st.animP * Math.PI); B.root.position.y += s1 * sp.H * 0.5; B.FL1.rotation.x = -1.2 * s1; B.FR1.rotation.x = -1.2 * s1; B.root.rotation.x = -0.4 * s1; }
  if (st.stun) B.head.rotation.z = Math.sin(t * 3) * 0.25;
  if (st.sit) { B.root.position.y *= 0.55; for (const n of ['BL', 'BR']) { B[n + '1'].rotation.x = -1.1; B[n + '2'].rotation.x = 1.6; } }
}

// ---------- many-legged things ----------
function buildBug(kind, col) {
  const spider = kind === 'spider', bee = kind === 'mosquito';
  const legs = spider ? 4 : 3; const s = spider ? 1 : bee ? 0.55 : 0.75; const H = spider ? 0.42 : bee ? 1.2 : 0.3;
  const defs = [['root', null, [0, H, 0]], ['head', 'root', [0, H, 0.28 * s]], ['abd', 'root', [0, H + 0.05, -0.2 * s]]];
  for (let i = 0; i < legs; i++) for (const sd of [1, -1]) { const n = 'L' + i + (sd > 0 ? 'l' : 'r'); const z = (0.12 - i * (spider ? 0.09 : 0.11)) * s; defs.push([n + '1', 'root', [sd * 0.12 * s, H, z]], [n + '2', n + '1', [sd * (spider ? 0.55 : 0.32) * s, H + (spider ? 0.32 : 0.08) * s, z + (i - legs / 2) * 0.08 * s]], [n + '3', n + '2', [sd * (spider ? 0.95 : 0.45) * s, 0.02, z + (i - legs / 2) * 0.14 * s]]); }
  if (bee) defs.push(['WL', 'root', [0.05, H + 0.08, 0]], ['WR', 'root', [-0.05, H + 0.08, 0]]);
  const R = new Rig(defs); const r = R.rest; const dark = shade(col, -0.25);
  if (spider) { R.ell('root', r.root, [0.24, 0.17, 0.26], col, 'fur'); R.ell('abd', [0, r.abd[1] + 0.08, r.abd[2] - 0.22], [0.36, 0.3, 0.44], dark, 'fur'); R.box('abd', [0, r.abd[1] + 0.33, r.abd[2] - 0.2], [0.1, 0.04, 0.2], '#c83a3a', 'skin'); R.ell('head', [0, r.head[1], r.head[2] + 0.06], [0.14, 0.12, 0.14], col, 'fur'); for (let k = 0; k < 6; k++) R.ell('head', [((k % 3) - 1) * 0.05, r.head[1] + 0.06 + Math.floor(k / 3) * 0.04, r.head[2] + 0.17], [0.025, 0.025, 0.02], '#ff4a3a', 'glow'); for (const sd of [-1, 1]) R.cone('head', [sd * 0.05, r.head[1] - 0.08, r.head[2] + 0.18], 0.025, 0.12, Q(Math.PI, 0, 0), '#1a1a1a', 'shell'); }
  else if (bee) { R.ell('root', r.root, [0.08, 0.08, 0.16], col, 'shell'); R.ell('abd', [0, r.abd[1], r.abd[2] - 0.2], [0.07, 0.07, 0.26], dark, 'shell'); R.ell('head', r.head, [0.07, 0.07, 0.07], col, 'shell'); R.seg('head', [0, r.head[1] - 0.02, r.head[2] + 0.05], [0, r.head[1] - 0.12, r.head[2] + 0.35], 0.008, 0.003, '#2a1a10', 'shell'); for (const sd of [-1, 1]) R.ell('head', [sd * 0.05, r.head[1] + 0.02, r.head[2] + 0.04], [0.035, 0.035, 0.03], '#8a2a1a', 'glow');
    for (const n of ['WL', 'WR']) { const sd = n === 'WL' ? 1 : -1; R.ell(n, [sd * 0.3, r.WL[1] + 0.02, -0.02], [0.3, 0.01, 0.1], '#dce6ff', 'shell'); } }
  else { R.ell('root', [0, r.root[1] + 0.04, -0.02], [0.3, 0.2, 0.42], col, 'shell'); R.box('root', [0, r.root[1] + 0.2, -0.02], [0.02, 0.02, 0.7], shade(col, -0.4), 'shell'); R.ell('head', [0, r.head[1] - 0.02, r.head[2] + 0.05], [0.14, 0.1, 0.12], '#2a1a10', 'shell'); R.cone('head', [0, r.head[1] + 0.06, r.head[2] + 0.14], 0.03, 0.2, Q(-0.6, 0, 0), '#2a1a10', 'shell'); for (const sd of [-1, 1]) R.ell('root', [sd * 0.14, r.root[1] + 0.16, 0.1 - (sd > 0 ? 0.2 : 0)], [0.04, 0.03, 0.04], '#ffd25a', 'glow'); }
  for (let i = 0; i < legs; i++) for (const sd of [1, -1]) { const n = 'L' + i + (sd > 0 ? 'l' : 'r'); R.seg(n + '1', r[n + '1'], r[n + '2'], spider ? 0.03 : 0.018, spider ? 0.025 : 0.014, dark, spider ? 'fur' : 'shell'); R.seg(n + '2', r[n + '2'], r[n + '3'], spider ? 0.025 : 0.014, 0.008, dark, spider ? 'fur' : 'shell'); }
  const inst = instance(R, R.geometry());
  return Object.assign(inst, { type: 'bug', legs, spider, bee, t: Math.random() * 10, phase: 0, H });
}
function animBug(rig, st, dt) {
  const B = rig.bones; const t = (rig.t += dt); rig.phase += st.dist * 9;
  const m = K3.clamp(st.move, 0, 1);
  for (const k in B) B[k].rotation.set(0, 0, 0);
  B.root.position.y = rig.rest.root[1] + (rig.bee ? Math.sin(t * 3) * 0.12 : 0);
  for (let i = 0; i < rig.legs; i++) for (const sd of ['l', 'r']) { const n = 'L' + i + sd; const p = rig.phase + i * 1.7 + (sd === 'l' ? 0 : Math.PI); B[n + '1'].rotation.y = Math.sin(p) * 0.35 * m; B[n + '1'].rotation.z = (sd === 'l' ? 1 : -1) * Math.max(0, Math.cos(p)) * 0.25 * m; if (rig.bee) { B[n + '1'].rotation.z = (sd === 'l' ? -1 : 1) * 0.6; } }
  if (rig.bee) { B.WL.rotation.z = Math.sin(t * 60) * 0.6; B.WR.rotation.z = -Math.sin(t * 60) * 0.6; }
  if (B.abd) B.abd.rotation.x = Math.sin(t * 2) * 0.04;
  const a = st.atk || 0; if (a > 0 && a < 1) { const s1 = Math.sin(a * Math.PI); B.root.rotation.x = -s1 * 0.3; B.head.rotation.x = s1 * 0.4; B.root.position.z = s1 * 0.15; }
}

// ---------- snake ----------
function buildSnake(col) {
  const N = 9; const defs = [['s0', null, [0, 0.12, 0.6]]]; for (let i = 1; i < N; i++) defs.push(['s' + i, 's' + (i - 1), [0, 0.1, 0.6 - i * 0.17]]);
  const R = new Rig(defs); const r = R.rest;
  for (let i = 0; i < N - 1; i++) { const rr = 0.07 * (1 - i / N * 0.7); R.seg('s' + i, r['s' + i], r['s' + (i + 1)], rr, rr * 0.92, i % 2 ? col : shade(col, -0.12), 'scales'); }
  R.ell('s0', [0, r.s0[1] + 0.02, r.s0[2] + 0.08], [0.085, 0.06, 0.13], shade(col, 0.1), 'scales');
  for (const sd of [-1, 1]) R.ell('s0', [sd * 0.05, r.s0[1] + 0.05, r.s0[2] + 0.13], [0.02, 0.02, 0.02], '#e8d040', 'glow');
  R.seg('s0', [0, r.s0[1], r.s0[2] + 0.2], [0, r.s0[1], r.s0[2] + 0.3], 0.006, 0.002, '#c83a3a', 'skin');
  const inst = instance(R, R.geometry()); return Object.assign(inst, { type: 'snake', N, t: Math.random() * 10, phase: 0 });
}
function animSnake(rig, st, dt) { const B = rig.bones; const t = (rig.t += dt); rig.phase += st.dist * 8 + dt * 1.2; for (let i = 0; i < rig.N; i++) { const b = B['s' + i]; b.rotation.set(0, Math.sin(rig.phase - i * 0.8) * (i ? 0.35 : 0.15), 0); } const a = st.atk || 0; B.s0.rotation.x = a > 0 && a < 1 ? -Math.sin(a * Math.PI) * 0.6 : -0.15; B.s1.rotation.x = a > 0 && a < 1 ? Math.sin(a * Math.PI) * 0.3 : 0.1; }

// ---------- bats ----------
function buildBat(col) {
  const defs = [['root', null, [0, 1.6, 0]], ['WL', 'root', [0.07, 1.62, 0]], ['WL2', 'WL', [0.32, 1.64, 0]], ['WR', 'root', [-0.07, 1.62, 0]], ['WR2', 'WR', [-0.32, 1.64, 0]]];
  const R = new Rig(defs); const r = R.rest;
  R.ell('root', r.root, [0.08, 0.09, 0.12], col, 'fur'); R.ell('root', [0, r.root[1] + 0.06, 0.08], [0.06, 0.06, 0.06], col, 'fur');
  for (const sd of [-1, 1]) { R.cone('root', [sd * 0.035, r.root[1] + 0.13, 0.06], 0.02, 0.07, null, col, 'fur'); R.ell('root', [sd * 0.025, r.root[1] + 0.07, 0.13], [0.012, 0.012, 0.01], '#ff5a3a', 'glow'); }
  for (const sd of [1, -1]) { const n = sd > 0 ? 'WL' : 'WR'; const P = [sd * 0.05, 1.62, 0.04, sd * 0.32, 1.64, 0.02, sd * 0.55, 1.58, -0.06, sd * 0.3, 1.5, -0.12, sd * 0.06, 1.55, -0.08]; R.membrane(n, n + '2', P, [0, 1, 4, 1, 3, 4, 1, 2, 3], [1, 2, 3], shade(col, -0.15), 'skin'); }
  const inst = instance(R, R.geometry()); return Object.assign(inst, { type: 'bat', t: Math.random() * 10 });
}
function animBat(rig, st, dt) { const B = rig.bones; const t = (rig.t += dt); const f = Math.sin(t * 16); B.WL.rotation.z = f * 0.8; B.WR.rotation.z = -f * 0.8; B.WL2.rotation.z = f * 0.5; B.WR2.rotation.z = -f * 0.5; B.root.position.y = rig.rest.root[1] + Math.sin(t * 3) * 0.15; const a = st.atk || 0; B.root.rotation.x = a > 0 && a < 1 ? Math.sin(a * Math.PI) * 0.6 : 0.1; }

// ---------- golems and treants: heavy humanoids ----------
function buildBrute(kind, col) {
  const golem = kind === 'golem'; const S = golem ? 1.0 : 1.15;
  const defs = [['hips', null, [0, 1.0 * S, 0]], ['chest', 'hips', [0, 1.45 * S, 0]], ['head', 'chest', [0, 2.15 * S, 0.05]], ['armL', 'chest', [0.55 * S, 1.95 * S, 0]], ['foreL', 'armL', [0.62 * S, 1.35 * S, 0.05]], ['armR', 'chest', [-0.55 * S, 1.95 * S, 0]], ['foreR', 'armR', [-0.62 * S, 1.35 * S, 0.05]], ['thighL', 'hips', [0.26 * S, 0.95 * S, 0]], ['shinL', 'thighL', [0.28 * S, 0.48 * S, 0]], ['thighR', 'hips', [-0.26 * S, 0.95 * S, 0]], ['shinR', 'thighR', [-0.28 * S, 0.48 * S, 0]]];
  const R = new Rig(defs); const r = R.rest; const mat = golem ? 'rock' : 'wood'; const dk = shade(col, -0.2);
  const chunk = (bone, p, s, c) => { const g = new THREE.IcosahedronGeometry(1, 1); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const k = 0.8 + K3.hash(Math.round(pa.getX(i) * 9 + p[0] * 50), Math.round(pa.getY(i) * 9 + p[1] * 50), Math.round(pa.getZ(i) * 9)) * 0.35; pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k, pa.getZ(i) * k); } g.computeVertexNormals(); R.add(g, new THREE.Matrix4().compose(new THREE.Vector3(...p), Q(p[0], p[1], 0), new THREE.Vector3(...s)), bone, c, mat); g.dispose(); };
  if (golem) {
    chunk('chest', [0, 1.7, 0], [0.62, 0.55, 0.42], col); chunk('hips', [0, 1.1, 0], [0.42, 0.3, 0.32], dk); chunk('head', [0, 2.3, 0.08], [0.24, 0.22, 0.24], col);
    for (const sd of [-1, 1]) R.ell('head', [sd * 0.09, 2.32, 0.28], [0.04, 0.04, 0.03], '#7affff', 'glow');
    for (const sd of ['L', 'R']) { const a = r['arm' + sd], f = r['fore' + sd]; chunk('arm' + sd, [a[0] * 1.05, a[1] - 0.25, a[2]], [0.26, 0.38, 0.26], dk); chunk('fore' + sd, [f[0], f[1] - 0.3, f[2]], [0.3, 0.42, 0.3], col); chunk('fore' + sd, [f[0], f[1] - 0.75, f[2] + 0.05], [0.26, 0.2, 0.26], dk); const t2 = r['thigh' + sd], s2 = r['shin' + sd]; chunk('thigh' + sd, [t2[0], t2[1] - 0.22, 0], [0.24, 0.3, 0.24], dk); chunk('shin' + sd, [s2[0], s2[1] - 0.25, 0.02], [0.27, 0.3, 0.3], col); }
    R.box('chest', [0, 1.7, 0.4], [0.06, 0.3, 0.02], '#7affff', 'glow', Q(0, 0, 0.5));
  } else {
    R.seg('hips', [0, 0.95, 0], [0, 2.3, 0], 0.38, 0.32, col, 'wood'); for (let k = 0; k < 5; k++) R.ell('chest', [Math.cos(k * 1.3) * 0.5, 2.6 + Math.sin(k * 2) * 0.2, Math.sin(k * 1.3) * 0.4], [0.55, 0.45, 0.5], k % 2 ? '#4a5a2a' : '#5a6a2e', 'leaf');
    for (const sd of [-1, 1]) R.ell('chest', [sd * 0.12, 2.0, 0.33], [0.05, 0.05, 0.03], '#e8ff6a', 'glow');
    for (const sd of ['L', 'R']) { const a = r['arm' + sd], f = r['fore' + sd]; R.seg('arm' + sd, [a[0] * 0.6, a[1], 0], f, 0.13, 0.1, dk, 'wood'); R.seg('fore' + sd, f, [f[0] * 1.1, f[1] - 0.6, 0.1], 0.1, 0.05, dk, 'wood'); for (let k = 0; k < 3; k++) R.seg('fore' + sd, [f[0] * 1.1, f[1] - 0.55, 0.1], [f[0] * 1.1 + (k - 1) * 0.12, f[1] - 0.85, 0.15 + k * 0.03], 0.03, 0.01, dk, 'wood'); const t2 = r['thigh' + sd], s2 = r['shin' + sd]; R.seg('thigh' + sd, t2, s2, 0.17, 0.14, col, 'wood'); R.seg('shin' + sd, s2, [s2[0], 0.05, 0.05], 0.14, 0.2, col, 'wood'); }
  }
  const inst = instance(R, R.geometry()); return Object.assign(inst, { type: 'brute', t: Math.random() * 10, phase: 0, S });
}
function animBrute(rig, st, dt) {
  const B = rig.bones; const t = (rig.t += dt); rig.phase += st.dist / (1.6 * rig.S) * Math.PI; const m = K3.clamp(st.move, 0, 1);
  for (const k in B) B[k].rotation.set(0, 0, 0); B.hips.position.set(rig.rest.hips[0], rig.rest.hips[1], rig.rest.hips[2]);
  const s = Math.sin(rig.phase);
  B.thighL.rotation.x = -s * 0.45 * m; B.thighR.rotation.x = s * 0.45 * m; B.shinL.rotation.x = Math.max(0, Math.cos(rig.phase)) * 0.5 * m; B.shinR.rotation.x = Math.max(0, -Math.cos(rig.phase)) * 0.5 * m;
  B.armL.rotation.x = s * 0.35 * m; B.armR.rotation.x = -s * 0.35 * m; B.armL.rotation.z = 0.15; B.armR.rotation.z = -0.15;
  B.hips.position.y -= Math.abs(Math.cos(rig.phase)) * 0.06 * m; B.chest.rotation.y = s * 0.1 * m; B.chest.rotation.x = 0.1 + Math.sin(t * 1.3) * 0.02;
  const a = st.atk || 0; if (a > 0 && a < 1) { const w = K3.smooth(0, 0.4, a), h = K3.smooth(0.35, 0.65, a), r = K3.smooth(0.65, 1, a); B.armR.rotation.x = -0.3 - w * 2.2 + h * 2.3 - r * 0.1; B.armL.rotation.x = -0.3 - w * 1.8 + h * 2.0; B.chest.rotation.x = 0.1 + h * 0.4 * (1 - r); }
  if (st.animK === 'slam' && st.animP > 0 && st.animP < 1) { const s1 = Math.sin(st.animP * Math.PI); B.armR.rotation.x = -2.8 * s1; B.armL.rotation.x = -2.8 * s1; B.hips.position.y += s1 * 0.4; }
}

// ---------- glowing beings (no rig: a mesh that wobbles, plus particles from actors.js) ----------
const glowMats = {};
function glowMat(col, opacity = 0.75, additive = false) {
  const key = col + opacity + additive; if (glowMats[key]) return glowMats[key];
  const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, transparent: true, opacity, depthWrite: false, roughness: 0.3, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => { sh.uniforms.uTime = K3.shared.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
    float w = smoothstep(.6, -.9, position.y); transformed.x += sin(uTime * 3. + position.y * 6. + position.z * 3.) * .08 * w; transformed.z += cos(uTime * 2.6 + position.y * 5. + position.x * 4.) * .08 * w; transformed.y += sin(uTime * 4. + position.x * 9.) * .03 * w;`); };
  return (glowMats[key] = m);
}
function buildSpirit(kind, col) {
  const g = new THREE.Group(); g.userData.spirit = kind;
  if (kind === 'ghost') {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.05 + Math.sin(t * Math.PI * 0.55) * 0.42 + t * 0.12, 1.9 - t * 1.85)); }
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), glowMat(col, 0.62)); body.position.y = -0.9; body.userData.keepGeo = false; g.add(body);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), glowMat(col, 0.7)); hd.position.y = 1.15; g.add(hd);
    for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 2.8) })); e.position.set(sd * 0.09, 1.18, 0.2); g.add(e); const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.7, 8), glowMat(col, 0.55)); arm.position.set(sd * 0.42, 0.62, 0.12); arm.rotation.z = sd * 0.7; arm.rotation.x = -0.4; arm.name = sd > 0 ? 'armL' : 'armR'; g.add(arm); }
    g.userData.hover = 0.6;
  } else if (kind === 'wisp') {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 3, 3.2) })); g.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), glowMat('#bff3ff', 0.25, true)); g.add(halo); g.userData.hover = 1.3;
  } else if (kind === 'animsword') {
    g.userData.hover = 1.2;
  } else {
    // elementals: a swirling column; water is a translucent body, fire glows, air is pale and fast, earth handled as a golem
    const el = kind === 'elemental' || kind === 'fire_elemental' ? 'fire' : kind.split('_')[0];
    const c = { fire: '#ff7a2a', water: '#3a8ad8', air: '#d8e8f8' }[el] || col;
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(0.1 + Math.sin(t * Math.PI) * 0.5 * (1 - t * 0.4) + (1 - t) * 0.05, t * 2.2)); }
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), glowMat(c, el === 'water' ? 0.7 : 0.55, el === 'fire')); g.add(body);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), glowMat(c, 0.75, el === 'fire')); hd.position.y = 2.25; g.add(hd);
    for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) })); e.position.set(sd * 0.1, 2.3, 0.24); g.add(e); const arm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), glowMat(c, 0.6, el === 'fire')); arm.scale.set(1, 2.2, 1); arm.position.set(sd * 0.6, 1.5, 0.1); arm.name = sd > 0 ? 'armL' : 'armR'; g.add(arm); }
    g.userData.hover = 0.25; g.userData.element = el;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { mesh: g, type: 'spirit', kind, t: Math.random() * 10 };
}
function animSpirit(rig, st, dt) {
  const t = (rig.t += dt); const g = rig.mesh;
  g.children.forEach((c, i) => { if (c.name === 'armL' || c.name === 'armR') { const a = st.atk || 0; const s1 = a > 0 && a < 1 ? Math.sin(a * Math.PI) : 0; c.rotation.x = -0.4 - s1 * 1.2 + Math.sin(t * 2 + i) * 0.1; } });
  if (rig.kind === 'wisp') g.children[1].scale.setScalar(1 + Math.sin(t * 5) * 0.15);
}

// ---------- the dispatcher ----------
export const QUAD_KINDS = new Set(Object.keys(QUAD));
export function makeCreature(kind, col, e) {
  col = col || '#777777';
  if (QUAD_KINDS.has(kind)) return buildQuad(kind, col);
  if (kind === 'spider' || kind === 'beetle' || kind === 'mosquito') return buildBug(kind, col);
  if (kind === 'snake') return buildSnake(col);
  if (kind === 'bat') return buildBat(col);
  if (kind === 'golem' || kind === 'treant' || kind === 'earth_elemental') return buildBrute(kind === 'earth_elemental' ? 'golem' : kind, kind === 'earth_elemental' ? '#7a6a4a' : col);
  if (kind === 'ghost' || kind === 'wisp' || kind === 'animsword' || /elemental/.test(kind)) return buildSpirit(kind, col);
  return buildQuad('wolf', col);
}
export function animateCreature(rig, st, dt) {
  switch (rig.type) {
    case 'quad': return animQuad(rig, st, dt);
    case 'bug': return animBug(rig, st, dt);
    case 'snake': return animSnake(rig, st, dt);
    case 'bat': return animBat(rig, st, dt);
    case 'brute': return animBrute(rig, st, dt);
    case 'spirit': return animSpirit(rig, st, dt);
  }
}
export function creatureHeight(rig) {
  if (rig.type === 'quad') return rig.sp.H + rig.sp.br * 1.4 + (rig.sp.neck || 0) * 0.6;
  if (rig.type === 'brute') return 2.5 * rig.S; if (rig.type === 'bug') return rig.bee ? 1.5 : 0.8; if (rig.type === 'snake') return 0.5; if (rig.type === 'bat') return 1.8;
  if (rig.type === 'spirit') return rig.kind === 'wisp' ? 1.6 : rig.kind === 'ghost' ? 2.0 : 2.6;
  return 1.5;
}
