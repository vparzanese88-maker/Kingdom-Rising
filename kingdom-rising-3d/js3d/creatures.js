// Kingdom Rising 3D — beasts and monsters that are not people: wolves, bears, boars, rats, tigers,
// crocodiles, drakes and dragons, griffons, spiders, beetles, mosquitoes, snakes, bats, treants and
// golems, plus the glowing ones (wisps, ghosts, elementals). Each gets a skinned rig and its own gait.
import { THREE, K3 } from './core.js';
import { PRIM } from './mb.js';
import { charMat } from './chars.js';
import { sdfMesh } from './sdfmesh.js';

const shade = (c, a) => K3.shade(c || '#777777', a);
const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
// smooth bodies need the realistic-figures option (on unless the quality is low)
const FUR_LEN = { wolf: 0.024, bear: 0.035, boar: 0.014, tiger: 0.012, rat: 0.01, griffon: 0.018, horse: 0.006 };
const ORGANIC = () => K3.settings.quality !== 'low';
const MATS = { gem: [0.2, 0.1, 0], plain: [0, 0.8, 0], fur: [0, 1, 4], skin: [0, 0.6, 5], scales: [0.1, 0.45, 10], bone: [0, 0.7, 8], glow: [0, 1, 9], shell: [0.2, 0.3, 3], rock: [0, 0.95, 2], wood: [0, 0.9, 2], leaf: [0, 0.9, 1], metal: [0.85, 0.32, 3] };

class Rig {
  constructor(defs) { this.defs = defs; this.names = defs.map((d) => d[0]); this.bi = Object.fromEntries(defs.map((d, i) => [d[0], i])); this.par = Object.fromEntries(defs.map((d) => [d[0], d[1]])); this.rest = Object.fromEntries(defs.map((d) => [d[0], d[2]])); this.pos = []; this.nor = []; this.col = []; this.mat = []; this.si = []; this.sw = []; this.idx = []; this.n = 0; this.prims = []; this.organic = false; this.hardD = 0; }
  // parts drawn crisp (eyes, teeth, horns, claws) instead of melted into the body
  hard(fn) { this.hardD++; try { fn(); } finally { this.hardD--; } }
  soft(mat) { return this.organic && !this.hardD && !['glow', 'bone', 'shell', 'metal'].includes(mat); }
  prim(o, bone, color, mat, bone2, w2) { o.col = K3.col(color || '#888888', new THREE.Color()); o.bone = this.bi[bone]; o.bone2 = bone2 ? this.bi[bone2] : null; o.w2 = w2 || 0; o.mat = MATS[mat] || MATS.plain; this.prims.push(o); }
  add(g, m, bone, color, mat = 'plain', bone2 = null, w2 = 0) {
    const pa = g.attributes.position, na = g.attributes.normal; const nm = new THREE.Matrix3().getNormalMatrix(m);
    const c = K3.col(color || '#888888', new THREE.Color()); const M = MATS[mat] || MATS.plain;
    const bi = this.bi[bone], b2 = bone2 ? this.bi[bone2] : bi; const base = this.n; const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m); n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); this.pos.push(v.x, v.y, v.z); this.nor.push(n.x, n.y, n.z); this.col.push(c.r, c.g, c.b); this.mat.push(M[0], M[1], M[2]); this.si.push(bi, b2, 0, 0); this.sw.push(1 - w2, w2, 0, 0); }
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) this.idx.push(base + ia[i]); } else for (let i = 0; i < pa.count; i++) this.idx.push(base + i);
    this.n += pa.count;
  }
  ell(bone, p, r, color, mat, rot, bone2, w2) { if (this.soft(mat)) return this.prim({ t: 'e', p: [...p], r: [...r], q: rot }, bone, color, mat, bone2, w2); const g = new THREE.SphereGeometry(1, 16, 12); this.add(g, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || new THREE.Quaternion(), new THREE.Vector3(...r)), bone, color, mat, bone2, w2); g.dispose(); }
  seg(bone, a, b, r0, r1, color, mat, bone2, w2) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const L = A.distanceTo(B); if (L < 1e-4) return;
    if (this.soft(mat)) return this.prim({ t: 's', a: [...a], b: [...b], r0, r1 }, bone, color, mat, bone2, w2);
    const g = new THREE.CylinderGeometry(r1, r0, L, 10, 2); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    this.add(g, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), bone, color, mat, bone2, w2); g.dispose();
    const s = new THREE.SphereGeometry(r0, 8, 6); this.add(s, new THREE.Matrix4().makeTranslation(A.x, A.y, A.z), bone, color, mat, bone2, w2); s.dispose();
  }
  cone(bone, p, r, h, rot, color, mat) { if (this.soft(mat)) { const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(rot || new THREE.Quaternion()); const P0 = new THREE.Vector3(...p).addScaledVector(ax, -h / 2), P1 = new THREE.Vector3(...p).addScaledVector(ax, h / 2); return this.prim({ t: 's', a: P0.toArray(), b: P1.toArray(), r0: r, r1: r * 0.12, k: r * 0.6 }, bone, color, mat); } this.add(PRIM.cone8, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || new THREE.Quaternion(), new THREE.Vector3(r * 2, h, r * 2)), bone, color, mat); }
  box(bone, p, s, color, mat, rot) { if (this.soft(mat)) return this.prim({ t: 'b', p: [...p], h: [s[0] / 2, s[1] / 2, s[2] / 2], q: rot, round: Math.min(...s) * 0.25, k: Math.min(...s) * 0.6 }, bone, color, mat); this.add(PRIM.box, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || new THREE.Quaternion(), new THREE.Vector3(...s)), bone, color, mat); }
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
// fur: the body drawn again a few times, each layer pushed out a little, cut into strands that thin
// toward the tips (only where the body is furry)
const furMats = new Map();
function furMaterial(len) {
  const key = len.toFixed(3); let m = furMats.get(key); if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, alphaTest: 0.5 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLen = { value: len };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShell; attribute vec3 aMat; uniform float uLen; varying float vShell; varying vec3 vFR; varying float vFur;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShell = aShell; vFur = step(3.5, aMat.z) * step(aMat.z, 4.5); vFR = position; transformed += normal * uLen * aShell * vFur; transformed.y -= uLen * aShell * aShell * .35 * vFur;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying float vShell; varying vec3 vFR; varying float vFur;
      float fh(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { if (vFur < .5) discard; vec3 q = floor(vFR * ${(1 / Math.max(0.0025, len * 0.12)).toFixed(1)}); float h = fh(q); if (h < vShell * 1.05 + .08) discard;
          diffuseColor.rgb *= .55 + .55 * vShell; diffuseColor.a = 1.; }`);
  };
  m.customProgramCacheKey = () => 'krfur' + key;
  furMats.set(key, m); return m;
}
function furGeometry(body, layers) {
  const n = body.attributes.position.count; const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color', 'aMat', 'skinIndex', 'skinWeight']) { const a = body.attributes[k]; const arr = new a.array.constructor(a.array.length * layers); for (let l = 0; l < layers; l++) arr.set(a.array, l * a.array.length); out.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize, a.normalized)); }
  const sh = new Float32Array(n * layers); for (let l = 0; l < layers; l++) sh.fill((l + 1) / layers, l * n, (l + 1) * n); out.setAttribute('aShell', new THREE.BufferAttribute(sh, 1));
  const ia = body.index.array; const ix = new Uint32Array(ia.length * layers); for (let l = 0; l < layers; l++) for (let i = 0; i < ia.length; i++) ix[l * ia.length + i] = ia[i] + l * n; out.setIndex(new THREE.BufferAttribute(ix, 1));
  out.boundingSphere = body.boundingSphere; return out;
}
export function addFur(inst, body, len) {
  const q = K3.settings.quality; const layers = q === 'ultra' ? 10 : q === 'high' ? 8 : q === 'medium' ? 5 : 0; if (!layers || !body || len <= 0) return;
  if (!body.boundingSphere) body.computeBoundingSphere();
  const m = new THREE.SkinnedMesh(furGeometry(body, layers), furMaterial(len)); m.bind(inst.mesh.skeleton, inst.mesh.bindMatrix); m.castShadow = false; m.receiveShadow = true; inst.mesh.add(m); inst.fur = m;
}
function instance(rig, geom) {
  const bones = rig.names.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  bones.forEach((b, i) => { const n = rig.names[i]; const p = rig.rest[n]; const par = rig.par[n]; if (par) { const pp = rig.rest[par]; b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); bones[rig.bi[par]].add(b); } else b.position.set(p[0], p[1], p[2]); });
  const mesh = new THREE.SkinnedMesh(geom, charMat); mesh.add(bones[0]); mesh.bind(new THREE.Skeleton(bones)); mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, bones: Object.fromEntries(bones.map((b) => [b.name, b])), rest: rig.rest };
}

// ---------- quadrupeds (and their winged cousins) ----------
const QUAD = {
  rat: { L: 0.72, H: 0.3, br: 0.14, hr: 0.1, sn: 0.12, ear: 'round', tail: 0.66, tailR: 0.018, leg: 0.034, earCol: '#e8a0a0', tailCol: '#d8a0a0', whisk: true },
  wolf: { L: 1.45, H: 0.86, br: 0.22, hr: 0.15, sn: 0.21, ear: 'point', tail: 0.6, tailR: 0.075, leg: 0.06, eye: '#e8c040', ruff: true },
  spiritwolf: { L: 1.45, H: 0.86, br: 0.22, hr: 0.15, sn: 0.21, ear: 'point', tail: 0.6, tailR: 0.075, leg: 0.06, eye: '#9ef', glowy: true, ruff: true },
  tiger: { L: 1.95, H: 0.95, br: 0.27, hr: 0.2, sn: 0.13, ear: 'round', tail: 0.95, tailR: 0.04, leg: 0.085, stripes: true, eye: '#e8c040', ruff: true },
  bear: { L: 2.0, H: 1.2, br: 0.45, hr: 0.27, sn: 0.17, ear: 'round', tail: 0.08, tailR: 0.06, leg: 0.135, hump: true, eye: '#2a1a10' },
  boar: { L: 1.35, H: 0.78, br: 0.3, hr: 0.2, sn: 0.26, ear: 'point', tail: 0.2, tailR: 0.018, leg: 0.045, tusk: true, mane: true, hoof: true, disc: true, wedge: true },
  croc: { L: 3.2, H: 0.42, br: 0.32, hr: 0.18, sn: 0.66, ear: null, tail: 1.7, tailR: 0.22, leg: 0.085, flat: true, sprawl: true, scales: true, eye: '#e8d040', scutes: true },
  drake: { L: 3.4, H: 1.35, br: 0.44, hr: 0.26, sn: 0.34, ear: null, tail: 2.2, tailR: 0.2, leg: 0.12, neck: 0.55, wings: 2.8, horns: true, scales: true, spikes: true, eye: '#ffd23a' },
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
// a believable animal: ribcage, shoulder blades, a tucked waist, haunches, a tapering neck, a skull
// with muzzle and jaw, muscular upper legs over slim lower legs and paws; all melted into one body
function quadAnatomy(R, sp, kind, c, mat, belly, dark) {
  const r = R.rest, br = sp.br, hr = sp.hr, sn = sp.sn, lg = sp.leg; const cat = kind === 'tiger', dog = kind === 'wolf' || kind === 'spiritwolf' || kind === 'rat';
  const heavy = kind === 'bear' || kind === 'boar', rept = sp.scales, horse = kind === 'horse', fl = sp.flat;
  const ch = r.chest, pv = r.pelvis, rt = r.root; const tuck = dog || cat || horse ? 1 : heavy ? 0.2 : 0.5;
  const slim = (dog || cat) && kind !== 'rat' ? 0.78 : 1; // runners: a deep, narrow chest and narrow hips
  // torso
  R.ell('chest', [0, ch[1] + br * 0.12, ch[2]], [br * (heavy ? 1.0 : 0.78) * slim, br * (fl ? 0.6 : 1.1), br * 1.1], c, mat, null, 'root', 0.25);
  R.ell('chest', [0, ch[1] - br * 0.35, ch[2] + br * 0.15], [br * 0.6, br * 0.55, br * 0.8], belly, mat, null, 'root', 0.2); // the brisket
  for (const sx of [1, -1]) R.ell(sx > 0 ? 'FL1' : 'FR1', [sx * br * 0.42, ch[1] + br * 0.38, ch[2] - br * 0.05], [br * 0.32, br * 0.55, br * 0.55], c, mat, Q(0.35, 0, 0), 'chest', 0.6);
  if (sp.hump) R.ell('chest', [0, ch[1] + br * 0.75, ch[2] - br * 0.1], [br * 0.7, br * 0.5, br * 0.7], dark, mat);
  R.ell('root', [0, rt[1] + br * 0.16 * tuck, rt[2]], [br * (0.62 + 0.3 * (1 - tuck)) * slim, br * (0.85 - 0.3 * tuck) * (fl ? 0.65 : 1), Math.abs(ch[2] - pv[2]) * 0.55], c, mat);
  R.ell('root', [0, rt[1] - br * (0.35 - 0.2 * tuck), rt[2]], [br * 0.5, br * 0.35, Math.abs(ch[2] - pv[2]) * 0.4], belly, mat);
  R.ell('pelvis', [0, pv[1] + br * 0.1, pv[2]], [br * (heavy ? 0.95 : 0.72) * slim, br * (fl ? 0.55 : 0.85), br * 0.9], c, mat, null, 'root', 0.25);
  for (const sx of [1, -1]) R.ell(sx > 0 ? 'BL1' : 'BR1', [sx * br * 0.38, pv[1] + br * 0.05, pv[2] - br * 0.05], [br * 0.36, br * 0.72, br * 0.66], c, mat, null, 'pelvis', 0.5);
  // neck and head
  const hd = r.head; const nk0 = [0, ch[1] + br * 0.4, ch[2] + br * 0.75], nk1 = [0, hd[1] - hr * 0.1, hd[2] - hr * 0.45];
  R.seg('neck', nk0, nk1, br * (sp.neck ? 0.5 : 0.62), hr * 0.72, c, mat, 'chest', 0.3);
  R.ell('head', [0, hd[1] + hr * 0.08, hd[2] - hr * 0.05], [hr * (dog ? 0.72 : 0.82), hr * 0.78, hr * 0.92], c, mat);
  R.ell('head', [0, hd[1] + hr * 0.32, hd[2] + hr * 0.42], [hr * 0.55, hr * 0.22, hr * 0.32], c, mat); // brow
  for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.42, hd[1] - hr * 0.18, hd[2] + hr * 0.38], [hr * 0.32, hr * 0.32, hr * 0.38], c, mat); // cheeks
  const tipZ = hd[2] + hr * 0.5 + sn * 1.05, tipY = hd[1] - hr * (fl ? 0.3 : 0.18);
  if (!sp.beak) {
    const mz = dog ? 0.74 : 1; // a dog's muzzle tapers to a narrow nose
    R.seg('head', [0, hd[1] - hr * 0.02, hd[2] + hr * 0.35], [0, tipY + hr * 0.1, tipZ], hr * (fl ? 0.62 : 0.5) * mz, hr * (cat ? 0.36 : fl ? 0.32 : 0.26) * mz, shade(c, -0.03), mat);
    R.seg('jaw', [0, r.jaw[1] + hr * 0.02, r.jaw[2] - hr * 0.2], [0, r.jaw[1] + hr * 0.05, tipZ - hr * 0.14], hr * 0.4 * mz, hr * 0.18 * mz, belly, mat);
    R.ell('head', [0, tipY + hr * 0.1, tipZ + hr * 0.02], [hr * 0.2, hr * 0.15, hr * 0.12], rept ? shade(c, -0.15) : '#1a1414', rept ? mat : 'skin'); // nose
  } else R.ell('head', [0, hd[1], hd[2] + hr * 0.2], [hr * 0.95, hr * 0.9, hr * 1.0], '#f4efe0', 'fur');
  // ears
  for (const sx of [1, -1]) {
    if (sp.ear === 'point') R.ell('head', [sx * hr * 0.44, hd[1] + hr * (dog ? 0.95 : 0.82), hd[2] - hr * 0.12], [hr * (dog ? 0.24 : 0.2), hr * (dog ? 0.55 : 0.3), hr * 0.08], dark, mat, Q(-0.1, 0, -sx * 0.22));
    else if (sp.ear === 'round') R.ell('head', [sx * hr * 0.55, hd[1] + hr * 0.72, hd[2] - hr * 0.2], [hr * 0.22, hr * 0.2, hr * 0.07], sp.earCol || dark, mat);
  }
  // the boar's wedge: deep shoulders, a high ridge of bristles and slim legs on little hooves
  if (sp.wedge) { R.ell('chest', [0, ch[1] + br * 0.55, ch[2] - br * 0.05], [br * 0.62, br * 0.55, br * 0.95], dark, mat); R.ell('neck', [0, ch[1] + br * 0.3, ch[2] + br * 0.7], [br * 0.66, br * 0.7, br * 0.6], c, mat, null, 'chest', 0.5); }
  // a ruff of longer fur round the neck and cheeks (wolves, big cats)
  if (sp.ruff) { R.ell('neck', [0, ch[1] + br * 0.42, ch[2] + br * 0.62], [br * 0.66, br * 0.7, br * 0.55], shade(c, 0.08), mat, null, 'chest', 0.4); for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.55, hd[1] - hr * 0.3, hd[2] + hr * 0.05], [hr * 0.32, hr * 0.42, hr * 0.42], shade(c, 0.12), mat); }
  // legs: a muscular upper leg, a slim lower leg and a paw or hoof
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    const a = r[n + '1'], b = r[n + '2'], f = r[n + '3']; const back = n[0] === 'B'; const L = lg * (back ? 1.1 : 1) * (heavy ? 1.25 : 1);
    R.seg(n + '1', [a[0], a[1] + br * 0.15, a[2]], [b[0], b[1] + (a[1] - b[1]) * 0.1, b[2] + (back ? -0.02 : 0)], L * (back ? 1.95 : 1.6), L * 0.95, c, mat, back ? 'pelvis' : 'chest', 0);
    R.seg(n + '2', b, [f[0], f[1] + L * 1.2, f[2] + (back ? -0.01 : 0.01)], L * 0.92, L * 0.62, c, mat);
    if (back && !fl) R.ell(n + '2', [b[0], b[1] + L * 0.2, b[2] - L * 0.6], [L * 0.62, L * 0.9, L * 0.7], c, mat); // the hock
    if (horse || sp.hoof) R.seg(n + '3', [f[0], f[1] + L * 1.1, f[2]], [f[0], f[1] - L * 0.2, f[2] + L * 0.2], L * 0.7, L * 0.9, '#2a2420', 'skin');
    else if (!sp.beak || back) { const pw = heavy ? 0.95 : 0.85; R.ell(n + '3', [f[0], f[1] + L * 0.38, f[2] + L * 0.45], [L * pw, L * 0.62, L * 1.15], shade(c, -0.08), mat); if (!fl) for (let k = -1; k <= 1; k++) R.ell(n + '3', [f[0] + k * L * 0.42, f[1] + L * 0.22, f[2] + L * 1.12], [L * 0.32, L * 0.3, L * 0.36], shade(c, -0.12), mat); }
  }
  // tail
  if (sp.tail > 0.1) {
    const bushy = dog && kind !== 'rat' ? 1.7 : 1; const tr = sp.tailR;
    R.seg('tail1', [0, pv[1] + br * 0.35, pv[2] - br * 0.75], r.tail2, tr * (rept ? 1.6 : 0.9), tr * bushy * (rept ? 0.9 : 1), sp.tailCol || c, mat, 'pelvis', 0.3);
    R.seg('tail2', r.tail2, r.tail3, tr * bushy * (rept ? 0.9 : 1), tr * (rept ? 0.45 : bushy * 0.8), sp.tailCol || c, mat);
    R.seg('tail3', r.tail3, [0, r.tail3[1] - sp.tail * 0.15, r.tail3[2] - sp.tail * 0.28], tr * (rept ? 0.45 : bushy * 0.8), tr * 0.12, sp.tailCol || (bushy > 1 ? shade(c, 0.25) : c), mat);
  } else R.ell('pelvis', [0, pv[1] + br * 0.45, pv[2] - br * 0.95], [br * 0.18, br * 0.18, br * 0.18], c, mat);
  // crisp bits: eyes, teeth, tusks, horns, claws, beak, mane, spikes
  R.hard(() => {
    for (const sx of [-1, 1]) { const ex = sx * hr * 0.4, ey = hd[1] + hr * 0.2; const ez = hd[2] - hr * 0.05 + hr * 0.92 * Math.sqrt(Math.max(0.05, 1 - (ex / (hr * 0.82)) ** 2 - ((ey - hd[1] - hr * 0.08) / (hr * 0.78)) ** 2)) - hr * 0.04;
      R.ell('head', [ex, ey, ez], [hr * 0.13, hr * 0.12, hr * 0.1], '#120c08', 'gem', Q(0, sx * 0.5, 0)); R.ell('head', [ex + sx * hr * 0.015, ey, ez + hr * 0.04], [hr * 0.085, hr * 0.085, hr * 0.06], sp.eye || '#3a2a1a', sp.glowy || (sp.eye && sp.eye !== '#1a1a1a' && sp.eye !== '#2a1a10') ? 'glow' : 'gem', Q(0, sx * 0.5, 0)); }
    if (fl) for (let k = 0; k < 12; k++) R.cone('jaw', [(k % 2 ? 1 : -1) * hr * 0.42, r.jaw[1] + hr * 0.1, r.jaw[2] + hr * 0.2 + (k >> 1) * sn * 0.2], hr * 0.045, hr * 0.2, null, '#f0ead8', 'bone');
    else if (!sp.beak) for (const sx of [-1, 1]) R.cone('jaw', [sx * hr * 0.16, r.jaw[1] + hr * 0.06, tipZ - hr * 0.22], hr * 0.035, hr * 0.16, null, '#f0ead8', 'bone');
    if (sp.tusk) for (const sx of [-1, 1]) { R.cone('jaw', [sx * hr * 0.34, r.jaw[1] + hr * 0.18, tipZ - hr * 0.3], hr * 0.075, hr * 0.5, Q(0.2, 0, -sx * 0.55), '#f0ead8', 'bone'); R.cone('jaw', [sx * hr * 0.5, r.jaw[1] + hr * 0.52, tipZ - hr * 0.36], hr * 0.05, hr * 0.32, Q(-0.5, 0, -sx * 0.2), '#f0ead8', 'bone'); }
    if (sp.disc) R.ell('head', [0, tipY + hr * 0.06, tipZ + hr * 0.08], [hr * 0.3, hr * 0.26, hr * 0.06], '#8a5a50', 'skin');
    if (sp.whisk) for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) R.seg('head', [sx * hr * 0.15, tipY + hr * 0.05, tipZ - hr * 0.05], [sx * hr * 1.4, tipY + hr * (0.3 - k * 0.25), tipZ - hr * 0.5], 0.0025, 0.0012, '#e8e0d0', 'bone');
    if (sp.scutes) for (let k = 0; k < 16; k++) for (const sx of [-1, 1]) { const z = ch[2] + br * 0.4 - k * sp.L * 0.065; R.ell(k < 5 ? 'chest' : k < 10 ? 'root' : 'pelvis', [sx * br * 0.28, rt[1] + br * 0.42 - Math.max(0, k - 9) * 0.03, z], [br * 0.12, br * 0.1, sp.L * 0.028], shade(c, -0.18), 'bone'); }
    if (sp.horns) for (const sx of [-1, 1]) R.cone('head', [sx * hr * 0.45, hd[1] + hr * 0.6, hd[2] - hr * 0.45], hr * 0.15, hr * 1.4, Q(-1.15, 0, -sx * 0.25), '#e8dcc0', 'bone');
    if (sp.beak) R.cone('head', [0, hd[1] - hr * 0.15, hd[2] + hr * 1.2], hr * 0.36, hr * 1.0, Q(Math.PI / 2 + 0.45, 0, 0), '#e8c040', 'shell');
    if (sp.ear === 'tuft') for (const sx of [-1, 1]) R.cone('head', [sx * hr * 0.45, hd[1] + hr * 0.8, hd[2] - hr * 0.4], hr * 0.14, hr * 0.7, Q(-0.8, 0, -sx * 0.3), '#f4efe0', 'shell');
    for (const n of ['FL', 'FR', 'BL', 'BR']) { const f = r[n + '3']; const L = lg * (heavy ? 1.25 : 1); if (horse) continue; if (sp.beak && n[0] === 'F') { for (let k = -1; k <= 1; k++) R.cone(n + '3', [f[0] + k * L * 0.6, f[1], f[2] + L * 1.6], L * 0.3, L * 1.5, Q(Math.PI / 2, 0, 0), '#e8c040', 'shell'); continue; } if (dog || cat || heavy || rept) for (let k = -1; k <= 1; k++) R.cone(n + '3', [f[0] + k * L * 0.45, f[1] + L * 0.05, f[2] + L * 1.9], L * 0.12, L * 0.45, Q(Math.PI / 2 + 0.4, 0, 0), '#2a241e', 'bone'); }
    if (sp.mane) for (let k = 0; k < 9; k++) R.cone('chest', [0, ch[1] + br * 1.0 - k * 0.01, ch[2] + br * 0.6 - k * br * 0.28], br * 0.1, br * 0.42, Q(-0.5, 0, 0), dark, 'shell');
    if (sp.spikes) for (let k = 0; k < 11; k++) { const z = ch[2] + br * 0.4 - k * sp.L * 0.1; R.cone(k < 4 ? 'chest' : 'pelvis', [0, rt[1] + br * (fl ? 0.55 : 0.95) - Math.max(0, k - 6) * 0.06, z], br * 0.1, br * 0.5, Q(-0.35, 0, 0), dark, 'bone'); }
  });
}
function buildQuad(kind, col, rnd) {
  const sp = QUAD[kind] || QUAD.wolf; const R = new Rig(quadRig(sp)); const r = R.rest;
  R.organic = ORGANIC(); R.k = sp.br * 0.095; R.cell = K3.clamp(sp.L / 75, 0.012, 0.07);
  if (R.organic) R.paint = (g) => { // darker along the back, lighter belly, tiger stripes
    const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color; const top = r.root[1];
    const hz = r.head[2], ch = r.chest[2], pv = r.pelvis[2]; const legH = r.FL1[1];
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ny = N.getY(i); let k = 1 + ny * 0.1;
      if (!sp.scales) {
        const onBody = z < ch + sp.br * 0.8 && z > pv - sp.br * 1.2;
        if (onBody && ny > 0.35 && !sp.stripes) k *= 1 - 0.32 * K3.clamp((ny - 0.35) * 2, 0, 1); // the saddle
        if (ny < -0.3 && y > legH * 0.6) k *= 1 + 0.35 * K3.clamp(-ny - 0.3, 0, 1); // pale belly and throat
        if (z > hz + sp.hr * 0.45 && y < r.head[1]) k *= sp.disc ? 0.85 : 1.25; // muzzle
        if (y < legH * 0.45) k *= 0.62 + 0.38 * K3.clamp(y / (legH * 0.45), 0, 1); // darker socks and feet
      } else { if (ny > 0.4) k *= 0.8; if (ny < -0.3) k *= 1.35; }
      if (sp.stripes && y > top - sp.br * 0.5) { const st = Math.sin(z * 26 + Math.sin(x * 18) * 1.2 + Math.sin(y * 9) * 0.8); if (st > 0.55) k *= 0.22; }
      k *= 0.94 + 0.12 * K3.hash(Math.round(x * 40), Math.round(y * 40), Math.round(z * 40)); // mottling
      C.setXYZ(i, C.getX(i) * k, C.getY(i) * k, C.getZ(i) * k);
    }
  };
  const mat = sp.scales ? 'scales' : kind === 'spiritwolf' ? 'glow' : 'fur'; const c = col;
  const belly = shade(c, 0.18), dark = shade(c, -0.3);
  if (R.organic) quadAnatomy(R, sp, kind, c, mat, belly, dark);
  else {
  // body
  const bl = sp.L * 0.55;
  R.ell('pelvis', [0, r.pelvis[1] + sp.br * 0.05, r.pelvis[2]], [sp.br * 0.95, sp.br * (sp.flat ? 0.55 : 0.92), sp.br * 1.25], c, mat, null, 'root', 0.3);
  R.ell('chest', [0, r.chest[1] + (sp.hump ? sp.br * 0.25 : 0), r.chest[2]], [sp.br * 1.05, sp.br * (sp.flat ? 0.6 : 1.05), sp.br * 1.3], c, mat, null, 'root', 0.3);
  R.ell('root', [0, r.root[1] - sp.br * 0.15, 0], [sp.br * 0.92, sp.br * (sp.flat ? 0.5 : 0.85), bl * 0.62], sp.stripes ? c : belly, mat);
  if (sp.stripes && !R.organic) for (let k = -3; k <= 3; k++) R.box('root', [0, r.root[1] + sp.br * 0.45, k * bl * 0.16], [sp.br * 1.9, sp.br * 0.3, 0.05], '#2a1a10', 'fur', Q(0, 0, 0));
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
    R.hard(() => R.ell('head', [s * sp.hr * 0.57, r.head[1] + sp.hr * 0.25, r.head[2] + sp.hr * 0.68], [sp.hr * 0.13, sp.hr * 0.13, sp.hr * 0.1], sp.eye || '#1a1a1a', sp.eye && sp.eye !== '#1a1a1a' && sp.eye !== '#2a1a10' ? 'glow' : 'gem'));
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
  const fl = R.organic && mat === 'fur' ? FUR_LEN[kind] ?? sp.br * 0.08 : 0; if (fl) addFur(inst, R.body, fl);
  return Object.assign(inst, { _R: R, _body: fl ? R.body : null, _furLen: fl, type: 'quad', sp, t: Math.random() * 10, phase: Math.random() * 6 });
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
  // spiders: knees arch high over the body; beetles: legs splay out from under the shell; mosquitoes: legs dangle
  for (let i = 0; i < legs; i++) for (const sd of [1, -1]) { const n = 'L' + i + (sd > 0 ? 'l' : 'r'); const z = (0.12 - i * (spider ? 0.09 : 0.13)) * s; const fz = spider ? (i - legs / 2 + 0.5) * 0.3 * s : (i - 1) * 0.3 * s;
    if (bee) defs.push([n + '1', 'root', [sd * 0.04, H - 0.04, z * 0.5]], [n + '2', n + '1', [sd * 0.14, H - 0.12, z * 0.5 + (i - 1) * 0.05]], [n + '3', n + '2', [sd * 0.22, H - 0.5, z * 0.5 + (i - 1) * 0.14]]);
    else defs.push([n + '1', 'root', [sd * 0.12 * s, H - (spider ? 0 : 0.04), z]], [n + '2', n + '1', [sd * (spider ? 0.55 : 0.5) * s, H + (spider ? 0.32 : 0.1) * s, z + fz * 0.4]], [n + '3', n + '2', [sd * (spider ? 0.95 : 0.78) * s, 0.02, z + fz]]); }
  if (bee) defs.push(['WL', 'root', [0.05, H + 0.08, 0]], ['WR', 'root', [-0.05, H + 0.08, 0]]);
  const R = new Rig(defs); const r = R.rest; const dark = shade(col, -0.25);
  if (spider && ORGANIC()) { R.organic = true; R.k = 0.03; R.cell = 0.014; }
  if (spider) { R.ell('root', r.root, [0.24, 0.17, 0.26], col, 'fur'); R.ell('abd', [0, r.abd[1] + 0.08, r.abd[2] - 0.22], [0.36, 0.3, 0.44], dark, 'fur'); R.box('abd', [0, r.abd[1] + 0.33, r.abd[2] - 0.2], [0.1, 0.04, 0.2], '#c83a3a', 'skin'); R.ell('head', [0, r.head[1], r.head[2] + 0.06], [0.14, 0.12, 0.14], col, 'fur'); for (let k = 0; k < 6; k++) R.ell('head', [((k % 3) - 1) * 0.05, r.head[1] + 0.06 + Math.floor(k / 3) * 0.04, r.head[2] + 0.17], [0.025, 0.025, 0.02], '#ff4a3a', 'glow'); for (const sd of [-1, 1]) R.cone('head', [sd * 0.05, r.head[1] - 0.08, r.head[2] + 0.18], 0.025, 0.12, Q(Math.PI, 0, 0), '#1a1a1a', 'shell'); }
  else if (bee) {
    // a mosquito: a hunched thorax, a long banded abdomen, a needle proboscis, feathery antennae, dangling legs
    R.ell('root', [0, r.root[1] + 0.02, 0], [0.075, 0.085, 0.11], col, 'shell'); R.ell('root', [0, r.root[1] + 0.07, -0.02], [0.06, 0.05, 0.08], shade(col, -0.2), 'shell');
    for (let k = 0; k < 6; k++) R.ell('abd', [0, r.abd[1] - 0.02 - k * 0.012, r.abd[2] - 0.06 - k * 0.07], [0.045 - k * 0.004, 0.042 - k * 0.004, 0.05], k % 2 ? dark : shade(col, 0.15), 'shell');
    R.ell('head', r.head, [0.055, 0.055, 0.05], dark, 'shell'); R.seg('head', [0, r.head[1] - 0.02, r.head[2] + 0.04], [0, r.head[1] - 0.16, r.head[2] + 0.3], 0.007, 0.002, '#1a120c', 'shell');
    for (const sd of [-1, 1]) { R.ell('head', [sd * 0.035, r.head[1] + 0.01, r.head[2] + 0.025], [0.03, 0.035, 0.03], '#8a2a1a', 'glow'); R.seg('head', [sd * 0.02, r.head[1] + 0.03, r.head[2] + 0.03], [sd * 0.08, r.head[1] + 0.12, r.head[2] + 0.12], 0.005, 0.002, '#3a2a1a', 'shell'); }
    for (const n of ['WL', 'WR']) { const sd = n === 'WL' ? 1 : -1; R.ell(n, [sd * 0.17, r.WL[1] + 0.01, -0.06], [0.17, 0.004, 0.05], '#c8d4e8', 'shell', Q(0, sd * 0.35, 0)); } }
  else {
    // a beetle: a domed pronotum, two wing cases split down the middle, a head with mandibles and antennae
    const sh = shade(col, -0.1); R.ell('root', [0, r.root[1] + 0.05, 0.08], [0.17, 0.12, 0.13], sh, 'shell');
    for (const sd of [-1, 1]) R.ell('root', [sd * 0.085, r.root[1] + 0.07, -0.13], [0.11, 0.13, 0.25], col, 'shell', Q(0, sd * 0.05, 0));
    R.box('root', [0, r.root[1] + 0.195, -0.13], [0.01, 0.012, 0.44], shade(col, -0.45), 'shell', Q(0.04, 0, 0));
    R.ell('root', [0, r.root[1] - 0.03, -0.06], [0.16, 0.06, 0.3], shade(col, -0.35), 'shell'); // the underside
    R.ell('head', [0, r.head[1] - 0.02, r.head[2] + 0.02], [0.1, 0.075, 0.09], shade(col, -0.25), 'shell');
    for (const sd of [-1, 1]) { R.cone('head', [sd * 0.05, r.head[1] - 0.04, r.head[2] + 0.13], 0.025, 0.14, Q(Math.PI / 2, sd * 0.5, 0), '#1a120c', 'shell'); R.ell('head', [sd * 0.07, r.head[1] + 0.02, r.head[2] + 0.07], [0.025, 0.025, 0.02], '#ffd25a', 'glow'); R.seg('head', [sd * 0.05, r.head[1] + 0.02, r.head[2] + 0.08], [sd * 0.16, r.head[1] + 0.14, r.head[2] + 0.28], 0.007, 0.004, '#1a120c', 'shell'); }
  }
  // legs: thigh, shin and a hooked foot; bristles on spiders
  for (let i = 0; i < legs; i++) for (const sd of [1, -1]) { const n = 'L' + i + (sd > 0 ? 'l' : 'r'); const t0 = spider ? 0.034 : bee ? 0.007 : 0.026;
    R.seg(n + '1', r[n + '1'], r[n + '2'], t0, t0 * 0.85, dark, spider ? 'fur' : 'shell'); R.seg(n + '2', r[n + '2'], r[n + '3'], t0 * 0.8, t0 * 0.3, spider ? shade(dark, ((i % 2) ? 0.15 : -0.05)) : dark, spider ? 'fur' : 'shell');
    if (spider) R.ell(n + '2', r[n + '2'], [t0 * 1.15, t0 * 1.15, t0 * 1.15], shade(col, 0.25), 'fur'); }
  if (spider) for (const sd of [-1, 1]) R.seg('head', [sd * 0.06, r.head[1] - 0.03, r.head[2] + 0.14], [sd * 0.14, r.head[1] - 0.12, r.head[2] + 0.3], 0.022, 0.012, dark, 'fur'); // pedipalps
  const inst = instance(R, R.geometry());
  if (R.organic && spider) addFur(inst, R.body, 0.012);
  return Object.assign(inst, { _R: R, _body: R.organic && spider ? R.body : null, _furLen: 0.012, type: 'bug', legs, spider, bee, t: Math.random() * 10, phase: 0, H });
}
function animBug(rig, st, dt) {
  // spiders walk on alternating tetrapods (L1 R2 L3 R4 against the rest), beetles on alternating tripods;
  // a swinging leg lifts and reaches forward, a planted one sweeps back; the cycle follows distance
  const B = rig.bones; const t = (rig.t += dt); rig.phase = ((rig.phase || 0) + st.dist / (rig.spider ? 0.42 : 0.3)) % 1;
  rig.mv = (rig.mv || 0) + ((st.dist > 0 ? 1 : 0) - (rig.mv || 0)) * Math.min(1, dt * 8); const m = rig.mv;
  for (const k in B) B[k].rotation.set(0, 0, 0);
  B.root.position.set(rig.rest.root[0], rig.rest.root[1] + (rig.bee ? Math.sin(t * 3) * 0.12 : 0), rig.rest.root[2]);
  for (let i = 0; i < rig.legs; i++) for (const sd of ['l', 'r']) {
    const n = 'L' + i + sd; const grp = (i + (sd === 'l' ? 0 : 1)) % 2; const u = (rig.phase + grp * 0.5) % 1; const S = sd === 'l' ? 1 : -1;
    if (rig.bee) { B[n + '1'].rotation.z = -S * (0.5 + Math.sin(t * 2 + i) * 0.08); B[n + '1'].rotation.x = 0.3 + i * 0.12; continue; }
    let sw, lift; if (u < 0.5) { sw = 1 - 4 * u; lift = 0; } else { const s1 = (u - 0.5) * 2; sw = -1 + 2 * ease(s1); lift = Math.sin(s1 * Math.PI); }
    B[n + '1'].rotation.y = -S * sw * 0.32 * m; B[n + '1'].rotation.z = S * lift * 0.35 * m;
    // an idle spider twitches a leg now and then
    if (rig.spider && m < 0.5 && Math.sin(t * 0.7 + i * 2.3 + (sd === 'l' ? 0 : 1.7)) > 0.97) B[n + '1'].rotation.z += S * 0.25;
  }
  if (rig.bee) { const w = Math.sin(t * 70); B.WL.rotation.z = w * 0.7; B.WR.rotation.z = -w * 0.7; B.root.rotation.x = 0.15; }
  B.root.position.y += Math.abs(Math.sin(rig.phase * Math.PI * 4)) * 0.012 * m;
  if (B.abd) B.abd.rotation.x = Math.sin(t * 2) * 0.04 + (rig.spider ? Math.sin(rig.phase * Math.PI * 4) * 0.03 * m : 0);
  const a = st.atk || 0;
  if (a > 0 && a < 1) {
    const rear = ease(K3.clamp(a / 0.4, 0, 1)) * (1 - K3.clamp((a - 0.55) / 0.3, 0, 1)), strike = Math.sin(K3.clamp((a - 0.4) / 0.25, 0, 1) * Math.PI);
    B.root.rotation.x = -rear * (rig.spider ? 0.5 : 0.3) + strike * 0.25; B.root.position.z = strike * 0.15; B.head.rotation.x = strike * 0.4;
    if (rig.spider) for (const sd of ['l', 'r']) { B['L0' + sd + '1'].rotation.z += (sd === 'l' ? 1 : -1) * rear * 0.9; B['L0' + sd + '1'].rotation.y += (sd === 'l' ? -1 : 1) * strike * 0.5; B['L1' + sd + '1'].rotation.z += (sd === 'l' ? 1 : -1) * rear * 0.5; }
  }
  if (st.dead) for (let i = 0; i < rig.legs; i++) for (const sd of ['l', 'r']) { const n = 'L' + i + sd; B[n + '1'].rotation.set(0, 0, (sd === 'l' ? 1 : -1) * 0.9); if (B[n + '2']) B[n + '2'].rotation.z = (sd === 'l' ? 1 : -1) * 1.2; } // legs curl up

}

// ---------- snake ----------
function buildSnake(col) {
  const N = 13; const defs = [['s0', null, [0, 0.13, 0.9]]]; for (let i = 1; i < N; i++) defs.push(['s' + i, 's' + (i - 1), [0, 0.09, 0.9 - i * 0.16]]);
  const R = new Rig(defs); const r = R.rest; if (ORGANIC()) { R.organic = true; R.k = 0.035; R.cell = 0.012; }
  for (let i = 0; i < N - 1; i++) { const u = i / (N - 1); const rr = 0.085 * (u < 0.2 ? 0.75 + u * 1.25 : 1 - Math.max(0, u - 0.55) * 1.9); R.seg('s' + i, r['s' + i], r['s' + (i + 1)], rr, rr * 0.95, col, 'scales'); }
  if (R.organic) R.paint = (g) => { const P = g.attributes.position, Nn = g.attributes.normal, C = g.attributes.color; for (let i = 0; i < P.count; i++) { const ny = Nn.getY(i), z = P.getZ(i), x = P.getX(i); let k = 1; if (ny < -0.2) k = 1.6; else { const d = Math.abs(((z * 6.5) % 1 + 1) % 1 - 0.5) * 2 + Math.abs(x) * 9; if (ny > 0.2 && d < 0.75) k = 0.45; else if (ny > 0.2 && d < 0.95) k = 1.25; } C.setXYZ(i, C.getX(i) * k, C.getY(i) * k, C.getZ(i) * k); } };
  // a broad, flat viper head with heat pits, a brow and a lighter lip
  R.ell('s0', [0, r.s0[1] + 0.02, r.s0[2] + 0.07], [0.105, 0.06, 0.13], shade(col, 0.05), 'scales'); R.ell('s0', [0, r.s0[1] - 0.015, r.s0[2] + 0.09], [0.09, 0.03, 0.11], shade(col, 0.4), 'scales');
  R.hard(() => { for (const sd of [-1, 1]) { R.ell('s0', [sd * 0.07, r.s0[1] + 0.04, r.s0[2] + 0.12], [0.022, 0.022, 0.02], '#e8d040', 'glow'); R.ell('s0', [sd * 0.072, r.s0[1] + 0.045, r.s0[2] + 0.13], [0.008, 0.016, 0.006], '#120c08', 'gem'); }
    R.seg('s0', [0, r.s0[1], r.s0[2] + 0.19], [0, r.s0[1], r.s0[2] + 0.27], 0.006, 0.002, '#c83a3a', 'skin'); for (const sd of [-1, 1]) R.seg('s0', [0, r.s0[1], r.s0[2] + 0.26], [sd * 0.025, r.s0[1], r.s0[2] + 0.31], 0.003, 0.001, '#c83a3a', 'skin'); });
  const inst = instance(R, R.geometry()); return Object.assign(inst, { _R: R, type: 'snake', N, t: Math.random() * 10, phase: 0 });
}
function animSnake(rig, st, dt) {
  // a travelling S-wave down the body, faster and wider when moving; the head stays pointed at its goal
  const B = rig.bones; const t = (rig.t += dt); rig.mv = (rig.mv || 0) + ((st.dist > 0 ? 1 : 0) - (rig.mv || 0)) * Math.min(1, dt * 6); const m = rig.mv;
  rig.phase = (rig.phase || 0) + st.dist / 0.7 * Math.PI * 2 + dt * (0.6 + 0.4 * (1 - m));
  let acc = 0; for (let i = 0; i < rig.N; i++) { const b2 = B['s' + i]; const amp = (0.12 + 0.3 * m) * Math.min(1, 0.4 + i * 0.15); const y = Math.sin(rig.phase - i * 0.75) * amp; b2.rotation.set(0, i ? y : 0, 0); acc += i ? y : 0; }
  B.s0.rotation.y = -B.s1.rotation.y * 0.8; // head held steady
  const a = st.atk || 0; const coil = ease(K3.clamp(a / 0.45, 0, 1)) * (1 - K3.clamp((a - 0.5) / 0.1, 0, 1)), strike = Math.sin(K3.clamp((a - 0.5) / 0.3, 0, 1) * Math.PI);
  B.s0.rotation.x = -0.15 - coil * 0.5 + strike * 0.7 - (1 - m) * 0.25 * (0.5 + 0.5 * Math.sin(t * 0.8)); B.s1.rotation.x = 0.1 + coil * 0.7 - strike * 0.6; B.s2.rotation.x = coil * 0.3 - strike * 0.2;
  if (st.dead) for (let i = 0; i < rig.N; i++) B['s' + i].rotation.set(0, Math.sin(i * 1.3) * 0.25, 0);
}

// ---------- bats ----------
function buildBat(col) {
  const defs = [['root', null, [0, 1.6, 0]], ['WL', 'root', [0.07, 1.62, 0]], ['WL2', 'WL', [0.32, 1.64, 0]], ['WR', 'root', [-0.07, 1.62, 0]], ['WR2', 'WR', [-0.32, 1.64, 0]]];
  const R = new Rig(defs); const r = R.rest;
  R.ell('root', [0, r.root[1] - 0.01, -0.02], [0.075, 0.085, 0.12], col, 'fur'); R.ell('root', [0, r.root[1] + 0.06, 0.07], [0.058, 0.055, 0.058], shade(col, 0.1), 'fur'); R.ell('root', [0, r.root[1] + 0.045, 0.125], [0.03, 0.025, 0.03], shade(col, -0.2), 'skin'); // body, head, snout
  for (const sd of [-1, 1]) { R.cone('root', [sd * 0.04, r.root[1] + 0.13, 0.05], 0.028, 0.1, Q(-0.2, 0, -sd * 0.35), shade(col, -0.1), 'skin'); R.ell('root', [sd * 0.026, r.root[1] + 0.075, 0.115], [0.013, 0.013, 0.01], '#ff5a3a', 'glow'); R.cone('root', [sd * 0.012, r.root[1] + 0.025, 0.14], 0.005, 0.02, Q(Math.PI, 0, 0), '#f0ead8', 'bone'); }
  for (const sd of [1, -1]) { const n = sd > 0 ? 'WL' : 'WR'; const P = [sd * 0.05, 1.62, 0.04, sd * 0.32, 1.66, 0.03, sd * 0.6, 1.6, -0.04, sd * 0.42, 1.5, -0.12, sd * 0.24, 1.48, -0.13, sd * 0.06, 1.53, -0.09];
    R.membrane(n, n + '2', P, [0, 1, 5, 1, 4, 5, 1, 3, 4, 1, 2, 3], [1, 2, 3, 4], shade(col, -0.05), 'skin');
    R.seg(n, [sd * 0.05, 1.62, 0.04], [sd * 0.32, 1.66, 0.03], 0.012, 0.009, shade(col, -0.2), 'skin'); for (const [x, y, z] of [[0.6, 1.6, -0.04], [0.42, 1.5, -0.12], [0.24, 1.48, -0.13]]) R.seg(n + '2', [sd * 0.32, 1.66, 0.03], [sd * x, y, z], 0.006, 0.003, shade(col, -0.25), 'skin'); }
  const inst = instance(R, R.geometry()); return Object.assign(inst, { type: 'bat', t: Math.random() * 10 });
}
function animBat(rig, st, dt) {
  // a quick downstroke and a slower recovery, with the odd glide on spread wings
  const B = rig.bones; const t = (rig.t += dt); const glide = Math.sin(t * 0.6 + (rig.seed || 0)) > 0.8;
  const ph = (t * 7) % 1; const beat = glide ? 0.15 : ph < 0.55 ? Math.cos(ph / 0.55 * Math.PI) : -Math.cos((ph - 0.55) / 0.45 * Math.PI);
  B.WL.rotation.z = beat * 0.85; B.WR.rotation.z = -beat * 0.85; B.WL2.rotation.z = beat * 0.55 + (glide ? 0 : 0.15); B.WR2.rotation.z = -beat * 0.55 - (glide ? 0 : 0.15);
  B.root.position.y = rig.rest.root[1] + Math.sin(t * 3) * 0.12 - beat * 0.03; const a = st.atk || 0;
  B.root.rotation.x = a > 0 && a < 1 ? Math.sin(a * Math.PI) * 0.7 : 0.1 + beat * 0.05;
}

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
// bodies are built once per kind and colour; each creature only gets its own bones
const built = new Map();
function cached(key, build) {
  let c = built.get(key);
  if (!c) { const inst = build(); c = { R: inst._R, geom: inst.mesh.geometry, body: inst._body, furLen: inst._furLen, extra: Object.fromEntries(Object.entries(inst).filter(([k]) => !['mesh', 'bones', 'rest', 'fur', '_R', '_body', '_furLen', 't', 'phase'].includes(k))) }; built.set(key, c); return inst; }
  const inst = instance(c.R, c.geom); if (c.body) addFur(inst, c.body, c.furLen);
  return Object.assign(inst, c.extra, { t: Math.random() * 10, phase: Math.random() * 6 });
}
export function makeCreature(kind, col, e) {
  col = col || '#777777';
  // individuals differ: one of three coat shades, a size within about 7%, and their own idle rhythm
  const id = e && e.id != null ? Math.abs(Math.round(e.id)) : Math.floor(Math.random() * 1000); const vr = id % 3;
  const c2 = vr === 1 ? shade(col, 0.07) : vr === 2 ? shade(col, -0.07) : col;
  const rig = QUAD_KINDS.has(kind) || kind === 'spider' || kind === 'snake' ? cached(kind + '|' + c2, () => buildCreature(kind, c2)) : buildCreature(kind, c2);
  rig.kind = kind; rig.seed = (id * 0.618) % 6.28;
  if (rig.mesh && rig.type !== 'spirit' && kind !== 'horse') rig.mesh.scale.setScalar(0.93 + ((id * 37) % 15) / 100);
  return rig;
}
function buildCreature(kind, col) {
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
