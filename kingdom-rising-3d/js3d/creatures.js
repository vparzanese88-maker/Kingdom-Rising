// Kingdom Rising 3D — beasts and monsters that are not people: wolves, bears, boars, rats, tigers,
// crocodiles, drakes and dragons, griffons, spiders, beetles, mosquitoes, snakes, bats, treants and
// golems, plus the glowing ones (wisps, ghosts, elementals). Each gets a skinned rig and its own gait.
import { THREE, K3 } from './core.js';
import { PRIM } from './mb.js';
import { charMat } from './chars.js';
import { sdfMesh } from './sdfmesh.js';

const shade = (c, a) => K3.shade(c || '#777777', a);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const decay = (t, k) => Math.exp(-t * k);
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
        { if (vFur < .5) discard; vec3 q = floor(vFR * ${(1 / Math.max(0.004, len * 0.3)).toFixed(1)}); float h = fh(q); if (h < vShell * 1.05 + .08) discard;
          diffuseColor.rgb *= .8 + .28 * vShell + .06 * (h - .5); diffuseColor.a = 1.; }`);
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
  wolf: { L: 1.4, H: 0.86, br: 0.22, hr: 0.15, sn: 0.25, ear: 'point', tail: 0.62, tailR: 0.075, leg: 0.058, eye: '#e8c040', ruff: true, hx: 0.25, neck: 0.3 },
  spiritwolf: { L: 1.4, H: 0.86, br: 0.22, hr: 0.15, sn: 0.25, ear: 'point', tail: 0.62, tailR: 0.075, leg: 0.058, eye: '#9ef', glowy: true, ruff: true, hx: 0.25, neck: 0.3 },
  tiger: { L: 1.9, H: 0.84, br: 0.29, hr: 0.22, sn: 0.12, ear: 'round', tail: 1.0, tailR: 0.045, leg: 0.09, stripes: true, eye: '#e8c040', ruff: true, hx: 0.27, neck: 0.2 },
  bear: { L: 2.0, H: 1.2, br: 0.45, hr: 0.27, sn: 0.17, ear: 'round', tail: 0.08, tailR: 0.06, leg: 0.135, hump: true, eye: '#2a1a10' },
  boar: { L: 1.35, H: 0.78, br: 0.3, hr: 0.2, sn: 0.26, ear: 'point', tail: 0.2, tailR: 0.018, leg: 0.045, tusk: true, mane: true, hoof: true, disc: true, wedge: true },
  croc: { L: 3.2, H: 0.42, br: 0.32, hr: 0.18, sn: 0.66, ear: null, tail: 1.7, tailR: 0.22, leg: 0.085, flat: true, sprawl: true, scales: true, eye: '#e8d040', scutes: true },
  drake: { L: 3.4, H: 1.35, br: 0.44, hr: 0.26, sn: 0.34, ear: null, tail: 2.2, tailR: 0.2, leg: 0.12, neck: 0.55, wings: 2.8, horns: true, scales: true, spikes: true, eye: '#ffd23a' },
  dragon: { L: 6.5, H: 2.5, br: 0.85, hr: 0.42, sn: 0.62, ear: null, tail: 4.5, tailR: 0.38, leg: 0.24, neck: 2.2, wings: 6.5, horns: true, scales: true, spikes: true, eye: '#ffd23a' },
  griffon: { L: 2.3, H: 1.25, br: 0.34, hr: 0.2, sn: 0.12, ear: 'tuft', tail: 0.9, tailR: 0.04, leg: 0.08, neck: 0.35, wings: 2.5, beak: true, eye: '#1a1a1a' },
  horse: { L: 2.1, H: 1.5, br: 0.33, hr: 0.16, sn: 0.36, ear: 'point', tail: 0.8, tailR: 0.07, leg: 0.065, neck: 0.75, mane: true, eye: '#1a1a1a', long: true },
};
function quadRig(sp) {
  const L = sp.L, H = sp.H; const hx = L * (sp.hx || 0.32); const legH = H * (sp.sprawl ? 0.45 : 0.62);
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
  const runner = (dog || cat) && kind !== 'rat'; const span = Math.abs(ch[2] - pv[2]);
  if (runner) {
    // a runner's torso is not a tube: a deep, narrow keel of ribs reaching down to the elbows, a belly line
    // that sweeps up into a tucked waist, then a smaller, sloping croup over heavy thighs
    const cw = cat ? 0.82 : 0.66;
    R.ell('chest', [0, ch[1] - br * 0.05, ch[2] - br * 0.05], [br * cw, br * 1.22, br * 1.12], c, mat, Q(-0.12, 0, 0), 'root', 0.2);
    R.ell('chest', [0, ch[1] - br * 0.62, ch[2] + br * 0.35], [br * 0.42, br * 0.5, br * 0.62], belly, mat, Q(0.3, 0, 0), 'root', 0.1); // the brisket
    R.ell('chest', [0, ch[1] + br * 0.62, ch[2] - br * 0.15], [br * cw * 0.85, br * 0.42, br * 0.85], c, mat); // withers
    for (const sx of [1, -1]) R.ell(sx > 0 ? 'FL1' : 'FR1', [sx * br * cw * 0.72, ch[1] + br * 0.2, ch[2] + br * 0.12], [br * 0.3, br * 0.72, br * 0.5], c, mat, Q(0.45, 0, 0), 'chest', 0.6); // shoulder blades
    R.seg('root', [0, ch[1] + br * 0.15, ch[2] - br * 0.6], [0, pv[1] + br * 0.32, pv[2] + br * 0.45], br * cw * 0.95, br * (cat ? 0.55 : 0.46), c, mat, null, 0); // the loin narrows
    R.ell('root', [0, rt[1] + br * 0.12, rt[2] - span * 0.08], [br * (cat ? 0.56 : 0.46), br * 0.5, span * 0.32], belly, mat); // the tucked belly
    R.ell('pelvis', [0, pv[1] + br * 0.28, pv[2] + br * 0.05], [br * cw * 0.92, br * 0.66, br * 0.8], c, mat, Q(0.22, 0, 0), 'root', 0.2); // the croup slopes down to the tail
    for (const sx of [1, -1]) R.ell(sx > 0 ? 'BL1' : 'BR1', [sx * br * cw * 0.7, pv[1] - br * 0.02, pv[2] - br * 0.02], [br * 0.36, br * 0.82, br * 0.66], c, mat, Q(-0.15, 0, 0), 'pelvis', 0.5); // thighs
  } else {
    // torso
    R.ell('chest', [0, ch[1] + br * 0.12, ch[2]], [br * (heavy ? 1.0 : 0.78) * slim, br * (fl ? 0.6 : 1.1), br * 1.1], c, mat, null, 'root', 0.25);
    R.ell('chest', [0, ch[1] - br * 0.35, ch[2] + br * 0.15], [br * 0.6, br * 0.55, br * 0.8], belly, mat, null, 'root', 0.2); // the brisket
    for (const sx of [1, -1]) R.ell(sx > 0 ? 'FL1' : 'FR1', [sx * br * 0.42, ch[1] + br * 0.38, ch[2] - br * 0.05], [br * 0.32, br * 0.55, br * 0.55], c, mat, Q(0.35, 0, 0), 'chest', 0.6);
    if (sp.hump) R.ell('chest', [0, ch[1] + br * 0.75, ch[2] - br * 0.1], [br * 0.7, br * 0.5, br * 0.7], dark, mat);
    R.ell('root', [0, rt[1] + br * 0.16 * tuck, rt[2]], [br * (0.62 + 0.3 * (1 - tuck)) * slim, br * (0.85 - 0.3 * tuck) * (fl ? 0.65 : 1), Math.abs(ch[2] - pv[2]) * 0.55], c, mat);
    R.ell('root', [0, rt[1] - br * (0.35 - 0.2 * tuck), rt[2]], [br * 0.5, br * 0.35, Math.abs(ch[2] - pv[2]) * 0.4], belly, mat);
    R.ell('pelvis', [0, pv[1] + br * 0.1, pv[2]], [br * (heavy ? 0.95 : 0.72) * slim, br * (fl ? 0.55 : 0.85), br * 0.9], c, mat, null, 'root', 0.25);
    for (const sx of [1, -1]) R.ell(sx > 0 ? 'BL1' : 'BR1', [sx * br * 0.38, pv[1] + br * 0.05, pv[2] - br * 0.05], [br * 0.36, br * 0.72, br * 0.66], c, mat, null, 'pelvis', 0.5);
  }
  // neck and head
  const hd = r.head; const nk0 = runner ? [0, ch[1] + br * 0.38, ch[2] + br * 0.6] : [0, ch[1] + br * 0.4, ch[2] + br * 0.75], nk1 = [0, hd[1] - hr * 0.1, hd[2] - hr * 0.45];
  R.seg('neck', nk0, nk1, br * (runner ? 0.6 : sp.neck ? 0.5 : 0.62), hr * (cat ? 0.85 : 0.72), c, mat, 'chest', 0.3);
  if (runner) R.seg('neck', [0, ch[1] - br * 0.15, ch[2] + br * 0.75], [0, hd[1] - hr * 0.5, hd[2] - hr * 0.2], br * 0.42, hr * 0.5, belly, mat, 'chest', 0.4); // the throat
  // the skull: a dog's is narrow and long, a cat's broad and flat
  R.ell('head', [0, hd[1] + hr * 0.08, hd[2] - hr * 0.05], cat ? [hr * 0.98, hr * 0.68, hr * 0.8] : dog ? [hr * 0.64, hr * 0.72, hr * 0.88] : [hr * 0.82, hr * 0.78, hr * 0.92], c, mat);
  R.ell('head', [0, hd[1] + hr * (cat ? 0.25 : 0.32), hd[2] + hr * 0.42], [hr * (cat ? 0.62 : 0.5), hr * 0.22, hr * 0.3], c, mat); // brow
  for (const sx of [1, -1]) R.ell('head', [sx * hr * (cat ? 0.55 : 0.4), hd[1] - hr * 0.18, hd[2] + hr * (cat ? 0.25 : 0.38)], [hr * (cat ? 0.42 : 0.3), hr * 0.32, hr * 0.38], c, mat); // cheeks
  const tipZ = hd[2] + hr * 0.5 + sn * 1.05, tipY = hd[1] - hr * (fl ? 0.3 : 0.18);
  if (!sp.beak) {
    const mz = dog ? 0.74 : 1; // a dog's muzzle tapers to a narrow nose, below a clear stop under the brow
    R.seg('head', [0, hd[1] - hr * (dog ? 0.14 : 0.02), hd[2] + hr * (dog ? 0.5 : 0.35)], [0, tipY + hr * 0.1, tipZ], hr * (fl ? 0.62 : cat ? 0.52 : 0.5) * mz, hr * (cat ? 0.4 : fl ? 0.32 : 0.24) * mz, shade(c, -0.03), mat);
    if (cat) { for (const sx of [1, -1]) R.ell('head', [sx * hr * 0.19, tipY - hr * 0.02, tipZ - hr * 0.14], [hr * 0.22, hr * 0.18, hr * 0.18], '#efe6d8', mat); R.ell('jaw', [0, r.jaw[1] - hr * 0.02, tipZ - hr * 0.3], [hr * 0.28, hr * 0.16, hr * 0.22], '#efe6d8', mat); } // whisker pads and a white chin
    R.seg('jaw', [0, r.jaw[1] + hr * 0.02, r.jaw[2] - hr * 0.2], [0, r.jaw[1] + hr * 0.05, tipZ - hr * 0.14], hr * 0.4 * mz, hr * 0.18 * mz, belly, mat);
    R.ell('head', [0, tipY + hr * 0.1, tipZ + hr * 0.02], [hr * (cat ? 0.16 : 0.2), hr * (cat ? 0.11 : 0.15), hr * 0.12], rept ? shade(c, -0.15) : cat ? '#9a5a50' : '#1a1414', rept ? mat : 'skin'); // nose
  } else R.ell('head', [0, hd[1], hd[2] + hr * 0.2], [hr * 0.95, hr * 0.9, hr * 1.0], '#f4efe0', 'fur');
  // ears
  for (const sx of [1, -1]) {
    if (sp.ear === 'point') R.ell('head', [sx * hr * 0.44, hd[1] + hr * (dog ? 0.95 : 0.82), hd[2] - hr * 0.12], [hr * (dog ? 0.24 : 0.2), hr * (dog ? 0.55 : 0.3), hr * 0.08], dark, mat, Q(-0.1, 0, -sx * 0.22));
    else if (sp.ear === 'round') R.ell('head', [sx * hr * 0.55, hd[1] + hr * 0.72, hd[2] - hr * 0.2], [hr * 0.22, hr * 0.2, hr * 0.07], sp.earCol || dark, mat);
  }
  // the boar's wedge: deep shoulders, a high ridge of bristles and slim legs on little hooves
  if (sp.wedge) { R.ell('chest', [0, ch[1] + br * 0.55, ch[2] - br * 0.05], [br * 0.62, br * 0.55, br * 0.95], dark, mat); R.ell('neck', [0, ch[1] + br * 0.3, ch[2] + br * 0.7], [br * 0.66, br * 0.7, br * 0.6], c, mat, null, 'chest', 0.5); }
  // a ruff of longer fur round the neck and cheeks (wolves, big cats)
  if (sp.ruff) { R.ell('neck', [0, ch[1] + br * 0.42, ch[2] + br * 0.62], [br * 0.66, br * 0.7, br * 0.55], shade(c, 0.08), mat, null, 'chest', 0.4); for (const sx of [1, -1]) R.ell('head', cat ? [sx * hr * 0.78, hd[1] - hr * 0.28, hd[2] - hr * 0.05] : [sx * hr * 0.55, hd[1] - hr * 0.3, hd[2] + hr * 0.05], cat ? [hr * 0.36, hr * 0.5, hr * 0.42] : [hr * 0.32, hr * 0.42, hr * 0.42], cat ? '#efe6d8' : shade(c, 0.12), mat, cat ? Q(0, 0, sx * 0.5) : null); }
  // legs: a muscular upper leg, a slim lower leg and a paw or hoof
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    const a = r[n + '1'], b = r[n + '2'], f = r[n + '3']; const back = n[0] === 'B'; const L = lg * (back ? 1.1 : 1) * (heavy ? 1.25 : 1) * (cat && !back ? 1.22 : 1); // a big cat's forelegs are thick for grappling
    R.seg(n + '1', [a[0], a[1] + br * 0.15, a[2]], [b[0], b[1] + (a[1] - b[1]) * 0.1, b[2] + (back ? -0.02 : 0)], L * (back ? 1.95 : 1.6), L * 0.95, c, mat, back ? 'pelvis' : 'chest', 0);
    R.seg(n + '2', b, [f[0], f[1] + L * 1.2, f[2] + (back ? -0.01 : 0.01)], L * 0.92, L * 0.62, c, mat);
    if (back && !fl) R.ell(n + '2', [b[0], b[1] + L * 0.2, b[2] - L * 0.6], [L * 0.62, L * 0.9, L * 0.7], c, mat); // the hock
    if (horse || sp.hoof) R.seg(n + '3', [f[0], f[1] + L * 1.1, f[2]], [f[0], f[1] - L * 0.2, f[2] + L * 0.2], L * 0.7, L * 0.9, '#2a2420', 'skin');
    else if (!sp.beak || back) { const pw = heavy ? 0.95 : 0.85; R.ell(n + '3', [f[0], f[1] + L * 0.38, f[2] + L * 0.45], [L * pw, L * 0.62, L * 1.15], shade(c, -0.08), mat); if (!fl) for (let k = -1; k <= 1; k++) R.ell(n + '3', [f[0] + k * L * 0.42, f[1] + L * 0.22, f[2] + L * 1.12], [L * 0.32, L * 0.3, L * 0.36], shade(c, -0.12), mat); }
  }
  // tail
  if (sp.tail > 0.1) {
    const bushy = dog && kind !== 'rat' ? 1.9 : 1; const tr = sp.tailR;
    R.seg('tail1', [0, pv[1] + br * 0.35, pv[2] - br * 0.75], r.tail2, tr * (rept ? 1.6 : bushy > 1 ? 0.7 : 0.9), tr * bushy * (rept ? 0.9 : 1.08), sp.tailCol || c, mat, 'pelvis', 0.3);
    R.seg('tail2', r.tail2, r.tail3, tr * bushy * (rept ? 0.9 : 1), tr * (rept ? 0.45 : bushy * 0.8), sp.tailCol || c, mat);
    R.seg('tail3', r.tail3, [0, r.tail3[1] - sp.tail * 0.15, r.tail3[2] - sp.tail * 0.28], tr * (rept ? 0.45 : bushy * 0.8), tr * 0.12, sp.tailCol || (bushy > 1 ? shade(c, -0.28) : c), mat);
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
  R.organic = ORGANIC(); R.k = sp.br * 0.095; R.cell = K3.clamp(sp.L / (sp.stripes ? 100 : 80), 0.012, 0.07);
  if (R.organic) R.paint = (g) => { // darker along the back, lighter belly, tiger stripes
    const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color; const top = r.root[1];
    const hz = r.head[2], ch = r.chest[2], pv = r.pelvis[2]; const legH = r.FL1[1];
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ny = N.getY(i); let k = 1 + ny * 0.1;
      if (!sp.scales) {
        const onBody = z < ch + sp.br * 0.8 && z > pv - sp.br * 1.2;
        if (onBody && ny > 0.35 && !sp.stripes) k *= 1 - 0.32 * K3.clamp((ny - 0.35) * 2, 0, 1); // the saddle
        if (ny < -0.3 && y > legH * 0.6 && !sp.stripes) k *= 1 + 0.35 * K3.clamp(-ny - 0.3, 0, 1); // pale belly and throat
        if (z > hz + sp.hr * 0.45 && y < r.head[1]) k *= sp.disc ? 0.85 : 1.25; // muzzle
        if (y < legH * 0.45) k *= 0.62 + 0.38 * K3.clamp(y / (legH * 0.45), 0, 1); // darker socks and feet
      } else { if (ny > 0.4) k *= 0.8; if (ny < -0.3) k *= 1.35; }
      // broad, soft tonal variation instead of speckle: a few slow waves across the coat
      k *= 1 + 0.07 * Math.sin(x * 4.1 + z * 2.3 + 1.3) * Math.sin(y * 3.7 - z * 1.9) + 0.05 * Math.sin(z * 5.3 + y * 2.9);
      let cr = C.getX(i) * k, cg = C.getY(i) * k, cb = C.getZ(i) * k;
      if (sp.stripes) {
        // a white belly, chin and inner legs, blended in softly
        const wb = K3.clamp((-ny - 0.15) * 2.2, 0, 1) * (y > legH * 0.25 ? 1 : 0.4); cr += (0.93 - cr) * wb; cg += (0.9 - cg) * wb; cb += (0.84 - cb) * wb;
        // stripes: thin, uneven dark marks that wrap round from the spine, forking and breaking up;
        // on the legs they run across, on the face they follow the brow
        const legs = y < legH * 0.95 && z > pv - sp.br * 1.4; const face = z > hz - sp.hr * 0.4;
        const u = legs ? y * 15 + z * 3 : face ? y * 30 + Math.abs(x) * 12 : z * 15.5 + Math.abs(x) * 2.2;
        const wob = Math.sin(y * 9 + z * 4.7) * 0.9 + Math.sin(Math.abs(x) * 13 + z * 7) * 0.45;
        const v = Math.sin(u * Math.PI * 2 * 0.5 + wob);
        const fork = Math.sin(u * Math.PI * 2 + wob * 1.7 + 1.1); // a second, finer set that splits some stripes in two
        const w = 0.8 + 0.12 * Math.sin(z * 11.3 + y * 6.1); // stripe width varies along its length
        const fade = K3.clamp((ny + 0.5) * 2, 0, 1) * (z > hz + sp.hr * 0.35 ? 0 : 1); // gone by the belly and the muzzle
        let m = K3.clamp((v - w) * 7, 0, 1); m = Math.max(m, K3.clamp((fork - 0.93) * 12, 0, 1) * K3.clamp((v - 0.2) * 3, 0, 1));
        const sk = 1 - 0.85 * m * fade; cr *= sk; cg *= sk; cb *= sk * 1.05;
      }
      C.setXYZ(i, cr, cg, cb);
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
  // wings: a drake's is a leathery membrane stretched between long finger bones, its trailing edge scalloped
  // between the fingers; a griffon's is layered rows of feathers, long primaries at the hand, secondaries along
  // the arm and shorter coverts lapped over their roots
  if (sp.wings) for (const s of [1, -1]) {
    const n = s > 0 ? 'WL' : 'WR'; const a = r[n + '1'], b = r[n + '2']; const span = sp.wings;
    const V = (p) => new THREE.Vector3(...p); const add = (p, x, y, z) => [p[0] + x, p[1] + y, p[2] + z];
    R.seg(n + '1', a, b, sp.br * 0.12, sp.br * 0.08, dark, mat); // the arm
    if (kind === 'griffon') {
      const T = add(b, s * span * 0.42, -span * 0.03, -span * 0.04); // the hand ends here
      const feather = (bone, root, dir, len, wid, col, lift) => { const d = V(dir).normalize(); const up = new THREE.Vector3(0, 1, 0); const x = new THREE.Vector3().crossVectors(up, d).normalize(); const y = new THREE.Vector3().crossVectors(d, x).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, d)); const c0 = V(root).addScaledVector(d, len * 0.5); c0.y += lift;
        R.hard(() => R.ell(bone, c0.toArray(), [wid, Math.max(0.006, wid * 0.12), len * 0.5], col, 'plain', q)); };
      const wc = '#f0e8d0', tip = shade(c, -0.25), mid = shade(c, 0.05);
      R.seg(n + '2', b, T, sp.br * 0.08, sp.br * 0.04, dark, mat);
      for (let j = 0; j < 8; j++) { const u = j / 7; const root = [b[0] + (T[0] - b[0]) * u * 0.92, b[1] + (T[1] - b[1]) * u, b[2] + (T[2] - b[2]) * u * 0.92];
        const dir = [s * (0.15 + 0.85 * u ** 1.3), -0.06, -(1 - u ** 1.3) - 0.15]; feather(n + '2', root, dir, span * (0.3 + 0.12 * Math.sin(u * Math.PI * 0.8)), span * 0.045, j % 2 ? tip : shade(tip, 0.08), -0.004 * j); } // primaries
      for (let j = 0; j < 8; j++) { const u = j / 7; const root = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        feather(u < 0.5 ? n + '1' : n + '2', root, [s * 0.12 * u, -0.05, -1], span * (0.26 + 0.03 * u), span * 0.05, j % 2 ? mid : shade(mid, -0.06), 0.004); } // secondaries
      for (const [row, len, cc] of [[1, 0.15, shade(c, 0.12)], [2, 0.08, wc]]) for (let j = 0; j < 11; j++) { const u = j / 10; const root = u < 0.55 ? [a[0] + (b[0] - a[0]) * u / 0.55, a[1] + (b[1] - a[1]) * u / 0.55, a[2] + (b[2] - a[2]) * u / 0.55] : [b[0] + (T[0] - b[0]) * (u - 0.55) / 0.45 * 0.7, b[1], b[2] + (T[2] - b[2]) * (u - 0.55) / 0.45 * 0.7];
        feather(u < 0.3 ? n + '1' : n + '2', add(root, 0, 0, sp.br * 0.05), [s * 0.25 * u, -0.08, -1], span * len, span * 0.045, cc, 0.012 * row); } // coverts, lapped over the roots
    } else {
      const wc = shade(c, -0.12); const T0 = add(b, s * span * 0.55, span * 0.04, -span * 0.08), T1 = add(b, s * span * 0.42, -span * 0.08, -span * 0.36), T2 = add(b, s * span * 0.2, -span * 0.16, -span * 0.58);
      const back = add(a, s * span * 0.02, -span * 0.12, -span * 0.62); const pull = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
      const sc = (p, q) => pull(pull(p, q, 0.5), b, 0.28); // the scallop between two finger tips
      const rim = [T0, sc(T0, T1), T1, sc(T1, T2), T2, sc(T2, back), back];
      const P = [...a, ...b]; for (const p of rim) P.push(...p); const tris = [0, 1, 8]; for (let k = 0; k < rim.length - 1; k++) tris.push(1, 2 + k, 3 + k);
      R.membrane(n + '1', n + '2', P, tris, [1, 2, 3, 4, 5, 6, 7], wc, 'skin');
      R.hard(() => { R.seg(n + '2', b, T0, sp.br * 0.06, sp.br * 0.02, dark, 'bone'); R.seg(n + '2', b, T1, sp.br * 0.045, sp.br * 0.015, dark, 'bone'); R.seg(n + '2', b, T2, sp.br * 0.04, sp.br * 0.015, dark, 'bone'); R.cone(n + '2', add(b, 0, sp.br * 0.1, sp.br * 0.05), sp.br * 0.06, sp.br * 0.3, Q(-0.6, 0, 0), '#e8dcc0', 'bone'); }); // finger bones and a thumb claw
    }
  }
  const geom = R.geometry(); const inst = instance(R, geom);
  const fl = R.organic && mat === 'fur' ? FUR_LEN[kind] ?? sp.br * 0.08 : 0; if (fl) addFur(inst, R.body, fl);
  return Object.assign(inst, { _R: R, _body: fl ? R.body : null, _furLen: fl, type: 'quad', sp, t: Math.random() * 10, phase: Math.random() * 6 });
}
// gait tables (leg phase offsets FL, FR, BL, BR and how long each foot stays down), from the motion spec:
// a lateral-sequence walk, a diagonal trot and a rotary gallop; blended by speed so gaits melt into each other
const GAITS = { walk: { off: [0.25, 0.75, 0, 0.5], duty: 0.65, stride: 0.85 }, trot: { off: [0, 0.5, 0.5, 0], duty: 0.45, stride: 1.25 }, gallop: { off: [0.1, 0.2, 0.6, 0.7], duty: 0.3, stride: 2.1 } };
// how each beast attacks: a telegraphed wind-up, then the strike that lands with the game's blow
const STYLE = { rat: 'bite', wolf: 'leap', spiritwolf: 'leap', tiger: 'pounce', bear: 'rear', boar: 'gore', croc: 'snap', drake: 'neck', dragon: 'neck', griffon: 'pounce', horse: 'rear' };
function animQuad(rig, st, dt) {
  const B = rig.bones, sp = rig.sp; const R0 = rig.rest;
  // a moment's freeze when a blow lands: the pose holds, then carries on
  if (st.freeze) dt = 0;
  const t = (rig.t += dt);
  // speed in body lengths per second picks the gait; the cycle advances by distance so feet don't slide
  const v = dt > 0 ? (st.dist || 0) / dt : rig.vS || 0; rig.vS = (rig.vS || 0) + (v - (rig.vS || 0)) * Math.min(1, dt * 6);
  const rel = rig.vS / sp.L; const heavy = sp.hump || rig.kind === 'boar';
  const gt = K3.clamp((rel - 1.0) / 0.8, 0, 1), gg = K3.clamp((rel - 2.6) / 1.2, 0, 1) * (heavy ? 0.6 : 1); // trot, gallop weights
  const mix = (k) => GAITS.walk[k] * (1 - gt) + GAITS.trot[k] * gt * (1 - gg) + GAITS.gallop[k] * gt * gg;
  const stride = sp.L * mix('stride'), duty = mix('duty');
  rig.phase = ((rig.phase || 0) + (st.dist || 0) / stride) % 1; const ph = rig.phase;
  rig.mv = (rig.mv || 0) + ((st.dist > 0 ? 1 : 0) - (rig.mv || 0)) * Math.min(1, dt * 7); const m = rig.mv;
  for (const k in B) B[k].rotation.set(0, 0, 0);
  B.root.position.set(R0.root[0], R0.root[1], R0.root[2]);
  const reach = (0.32 + 0.22 * gt + 0.18 * gg) * m; const fly = st.fly;
  const offs = ['FL', 'FR', 'BL', 'BR'];
  offs.forEach((n, i) => {
    const off = GAITS.walk.off[i] * (1 - gt) + GAITS.trot.off[i] * gt * (1 - gg) + GAITS.gallop.off[i] * gt * gg;
    const u = (ph + off) % 1; let sw, lift = 0;
    if (u < duty) sw = 1 - 2 * (u / duty); // planted: the foot sweeps back under the body
    else { const s1 = (u - duty) / (1 - duty); sw = -1 + 2 * ease(s1); lift = Math.sin(s1 * Math.PI); } // swinging forward, lifted
    const front = n[0] === 'F';
    B[n + '1'].rotation.x = -sw * reach;
    B[n + '2'].rotation.x = (front ? -1 : 1) * (lift * (0.75 + 0.4 * gg) + 0.08) * m;
    if (B[n + '3']) B[n + '3'].rotation.x = (front ? 1 : -1) * lift * 0.5 * m - B[n + '1'].rotation.x * 0.3;
  });
  // the body: a bob twice a stride (once at the gallop), a flexing spine at speed, a rolling heavy gait
  const bob = gg > 0.3 ? Math.sin(ph * Math.PI * 2) * 0.06 : Math.abs(Math.sin(ph * Math.PI * 2)) * 0.03;
  B.root.position.y += bob * m * sp.H * (heavy ? 0.7 : 1);
  const flex = Math.sin(ph * Math.PI * 2) * (heavy ? 0.05 : 0.17) * gg * m;
  B.chest.rotation.x = flex + Math.sin(ph * Math.PI * 4) * 0.02 * m; B.pelvis.rotation.x = -flex;
  if (heavy) { B.chest.rotation.z = Math.sin(ph * Math.PI * 2) * 0.1 * m; B.pelvis.rotation.z = -Math.sin(ph * Math.PI * 2) * 0.06 * m; }
  // breathing, and the head held steady against the body's motion (wolves carry it low and level at a run)
  const breathe = Math.sin(t * (1.6 + (1 - m) * 0.4) + (rig.seed || 0)) * 0.015;
  B.chest.rotation.x += breathe;
  B.neck.rotation.x = -B.chest.rotation.x * 0.8 + (rig.kind === 'wolf' || rig.kind === 'spiritwolf' ? 0.12 * gt : 0);
  if (heavy) B.neck.rotation.z = -B.chest.rotation.z * 1.2;
  // idles: look around, sniff the ground, flick the ears, wag
  const idle = 1 - m; const sd = rig.seed || 0;
  const sniff = idle * K3.clamp(Math.sin(t * 0.21 + sd) * 3 - 2, 0, 1);
  B.head.rotation.y = Math.sin(t * 0.55 + sd) * 0.35 * idle * (1 - sniff);
  B.neck.rotation.x += sniff * 0.55; B.head.rotation.x = sniff * (0.25 + Math.sin(t * 9) * 0.06);
  if (B.tail1) {
    const wag = (rig.kind === 'wolf' || rig.kind === 'spiritwolf') ? 1.5 : rig.kind === 'tiger' ? 0.6 : 1.0;
    B.tail1.rotation.x = 0.3 - m * 0.25 - gg * 0.2; const w = t * wag * Math.PI * 2 + ph * 6;
    B.tail1.rotation.y = Math.sin(w) * (0.22 + 0.1 * idle); B.tail2.rotation.y = Math.sin(w - 0.8) * 0.3; B.tail3.rotation.y = Math.sin(w - 1.6) * 0.38;
    if (rig.kind === 'croc' || rig.kind === 'drake' || rig.kind === 'dragon') { B.tail1.rotation.y += Math.sin(ph * Math.PI * 2) * 0.2 * m; B.tail2.rotation.y += Math.sin(ph * Math.PI * 2 - 0.7) * 0.25 * m; }
  }
  // wings: a strong downstroke (60%) and a slower upstroke; folded on the ground
  if (B.WL1) {
    const big = sp.L > 5; const f = (t * (big ? 0.7 : 1.4)) % 1; const beat = f < 0.6 ? Math.cos(f / 0.6 * Math.PI) : -Math.cos((f - 0.6) / 0.4 * Math.PI);
    B.WL1.rotation.z = fly ? beat * 0.9 : -0.2; B.WR1.rotation.z = fly ? -beat * 0.9 : 0.2;
    B.WL2.rotation.z = fly ? beat * 0.5 - 0.1 : -1.6; B.WR2.rotation.z = fly ? -beat * 0.5 + 0.1 : 1.6;
    B.WL1.rotation.y = fly ? 0 : 0.9; B.WR1.rotation.y = fly ? 0 : -0.9;
    if (fly) { B.root.position.y += -beat * sp.H * 0.06; for (const n of offs) { B[n + '1'].rotation.x = n[0] === 'F' ? -0.9 : 0.9; B[n + '2'].rotation.x = n[0] === 'F' ? 1.2 : -1.0; } }
  }
  // attacks: wind up before the blow (st.wind), strike as it lands (st.atk), then recover with a little overshoot
  const style = STYLE[rig.kind] || 'bite'; const w = ease(st.wind || 0); const a = st.atk || 0;
  const hit = a > 0 && a < 1 ? (a < 0.15 ? ease(a / 0.15) : 1 - ease((a - 0.15) / 0.85) * 1.08 + Math.sin(K3.clamp((a - 0.15) / 0.85, 0, 1) * Math.PI) * 0.08) : 0;
  const L = sp.L, H = sp.H; const jaw = (o) => { if (B.jaw) B.jaw.rotation.x = Math.max(B.jaw.rotation.x, o); };
  if (!fly && (w > 0 || hit > 0)) {
    if (style === 'leap' || style === 'bite') { // crouch, front low and ears back; spring forward and bite, shaking the head
      B.root.position.y -= w * H * 0.1 * (1 - hit); B.chest.rotation.x += w * 0.14 * (1 - hit); B.FL2.rotation.x -= w * 0.35; B.FR2.rotation.x -= w * 0.35; B.BL2.rotation.x += w * 0.35; B.BR2.rotation.x += w * 0.35; B.neck.rotation.x -= w * 0.15;
      B.root.position.z += hit * L * (style === 'leap' ? 0.28 : 0.15); B.root.position.y += hit * H * (style === 'leap' ? 0.15 : 0.04);
      B.FL1.rotation.x -= hit * 0.45; B.FR1.rotation.x -= hit * 0.35; B.chest.rotation.x -= hit * 0.12; B.neck.rotation.x += hit * 0.12; jaw(Math.max(w * 0.5, hit * 0.75));
      if (a > 0.15 && a < 0.6) B.head.rotation.z = Math.sin((a - 0.15) * 8 * Math.PI * 2 * 0.25 * 4) * 0.25 * (1 - (a - 0.15) / 0.45);
    } else if (style === 'pounce') { // hind legs coil, then an arc with the claws out
      B.pelvis.rotation.x -= w * 0.25; B.BL1.rotation.x -= w * 0.5; B.BR1.rotation.x -= w * 0.5; B.root.position.y -= w * H * 0.15 * (1 - hit);
      B.root.position.z += hit * L * 0.35; B.root.position.y += Math.sin(hit * Math.PI) * H * 0.35; B.root.rotation.x -= hit * 0.25 * (1 - a);
      B.FL1.rotation.x -= hit * 1.3; B.FR1.rotation.x -= hit * 1.2; B.FL2.rotation.x -= hit * 0.6; B.FR2.rotation.x -= hit * 0.6; jaw(hit * 0.8);
    } else if (style === 'rear') { // rear onto the hind legs, then slam down with the forepaws
      const up = Math.max(w, hit * (1 - K3.clamp((a - 0.1) / 0.35, 0, 1)));
      B.root.rotation.x -= up * 0.75; B.root.position.y += up * H * 0.35; B.root.position.z -= up * L * 0.1;
      B.FL1.rotation.x -= up * 1.4 + Math.sin(t * 6) * 0.1 * w; B.FR1.rotation.x -= up * 1.1; B.FL2.rotation.x -= up * 0.8; B.FR2.rotation.x -= up * 0.7;
      B.BL1.rotation.x += up * 0.7; B.BR1.rotation.x += up * 0.7; B.neck.rotation.x -= up * 0.35; jaw(up * 0.7);
      if (a > 0 && a < 0.35) { B.FL1.rotation.x += 0.6 * Math.sin(a / 0.35 * Math.PI); B.root.position.z += Math.sin(a / 0.35 * Math.PI) * L * 0.12; }
    } else if (style === 'gore') { // head down, a charge, then a toss of the tusks
      B.neck.rotation.x += w * 0.45; B.head.rotation.x += w * 0.25; B.root.position.z -= w * L * 0.06; B.BL1.rotation.x -= w * 0.3; B.BR1.rotation.x -= w * 0.3;
      B.root.position.z += hit * L * 0.3; B.neck.rotation.x += 0.45 * (1 - hit) * w - hit * 0.7 * Math.sin(K3.clamp(a / 0.4, 0, 1) * Math.PI); B.head.rotation.x -= hit * 0.4;
    } else if (style === 'snap') { // jaws gape wide, then the head lunges and snaps shut with a twist
      jaw(w * 1.1 * (1 - hit) + (a > 0 && a < 0.12 ? 1.1 * (1 - a / 0.12) : 0)); B.neck.rotation.x -= w * 0.15;
      B.root.position.z += hit * L * 0.12; B.head.rotation.x += hit * 0.2; B.root.rotation.z = Math.sin(K3.clamp(a / 0.6, 0, 1) * Math.PI * 2) * 0.25 * hit;
    } else { // the long neck draws back into an S and strikes
      B.neck.rotation.x -= w * 0.55; B.head.rotation.x += w * 0.4; jaw(w * 0.6);
      B.neck.rotation.x += hit * 0.75; B.head.rotation.x -= hit * 0.3; B.root.position.z += hit * L * 0.08; jaw(hit * 0.9);
      if (B.WL1 && w > 0) { B.WL1.rotation.z += w * 0.5; B.WR1.rotation.z -= w * 0.5; B.WL1.rotation.y -= w * 0.4; B.WR1.rotation.y += w * 0.4; }
    }
  } else if (fly && hit > 0) { B.root.position.z += hit * L * 0.15; B.neck.rotation.x += hit * 0.4; jaw(hit * 0.7); }
  if (st.breath) { B.neck.rotation.x -= 0.25; B.head.rotation.x = -0.2; jaw(0.7); B.chest.rotation.x -= 0.1; }
  if (st.animK === 'slam' && st.animP > 0 && st.animP < 1) { const s1 = Math.sin(st.animP * Math.PI); B.root.position.y += s1 * sp.H * 0.5; B.FL1.rotation.x = -1.2 * s1; B.FR1.rotation.x = -1.2 * s1; B.root.rotation.x = -0.4 * s1; }
  // a blow taken: the body flinches away from it and settles back (stronger for bigger hits)
  if (st.hurt && !st.dead) {
    const h = st.hurt; const k = Math.sin(Math.min(1, h.t / 0.08) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.08), 7) * Math.min(1.5, 0.5 + h.mag * 6);
    B.root.position.x += h.fx * L * 0.06 * k; B.root.position.z += h.fz * L * 0.06 * k; B.root.rotation.z += h.fx * 0.12 * k; B.neck.rotation.x -= 0.25 * k; B.head.rotation.y += h.fx * 0.3 * k; jaw(0.4 * k);
  }
  if (st.stun) B.head.rotation.z = Math.sin(t * 3) * 0.25;
  if (st.sit) { B.root.position.y *= 0.55; for (const n of ['BL', 'BR']) { B[n + '1'].rotation.x = -1.1; B[n + '2'].rotation.x = 1.6; } }
  // dying: legs go limp and draw in as the body falls on its side, a last kick, then still
  if (st.dead) {
    rig.deadT = (rig.deadT || 0) + dt; const d = ease(Math.min(1, rig.deadT / 0.8)); const kick = rig.deadT > 0.5 && rig.deadT < 1.1 ? Math.sin((rig.deadT - 0.5) / 0.6 * Math.PI) * 0.4 : 0;
    offs.forEach((n, i) => { B[n + '1'].rotation.x = (n[0] === 'F' ? -0.35 : 0.3) * d + (i === 3 ? kick : 0); B[n + '2'].rotation.x = (n[0] === 'F' ? -0.5 : 0.5) * d; });
    B.neck.rotation.x = 0.35 * d; B.head.rotation.x = 0.2 * d; if (B.jaw) B.jaw.rotation.x = 0.35 * d; if (B.tail1) { B.tail1.rotation.set(0.2 * d, 0, 0); B.tail2.rotation.set(0, 0, 0); B.tail3.rotation.set(0, 0, 0); }
  } else rig.deadT = 0;
}

// ---------- many-legged things ----------
function buildBug(kind, col) {
  const spider = kind === 'spider', bee = kind === 'mosquito';
  const legs = spider ? 4 : 3; const s = spider ? 1 : bee ? 0.55 : 0.75; const H = spider ? 0.36 : bee ? 1.2 : 0.2;
  const defs = [['root', null, [0, H, 0]], ['head', 'root', [0, H, 0.28 * s]], ['abd', 'root', [0, H + 0.04, -0.24 * s]]];
  // spiders: knees arch high over the body; beetles: legs splay out from under the shell; mosquitoes: legs dangle
  for (let i = 0; i < legs; i++) for (const sd of [1, -1]) { const n = 'L' + i + (sd > 0 ? 'l' : 'r'); const z = (0.12 - i * (spider ? 0.08 : 0.13)) * s; const fz = spider ? (legs / 2 - 0.5 - i) * 0.34 * s : (1 - i) * 0.28 * s; // front legs reach forward, hind legs back
    if (bee) defs.push([n + '1', 'root', [sd * 0.04, H - 0.04, z * 0.5]], [n + '2', n + '1', [sd * 0.14, H - 0.12, z * 0.5 + (i - 1) * 0.05]], [n + '3', n + '2', [sd * 0.22, H - 0.5, z * 0.5 + (i - 1) * 0.14]]);
    else if (spider) defs.push([n + '1', 'root', [sd * 0.13, H + 0.02, z]], [n + '2', n + '1', [sd * 0.46, H + 0.5, z + fz * 0.45]], [n + '3', n + '2', [sd * 1.0, 0.02, z + fz]]);
    else defs.push([n + '1', 'root', [sd * 0.12 * s, H - 0.02, z]], [n + '2', n + '1', [sd * 0.4 * s, H + 0.06, z + fz * 0.45]], [n + '3', n + '2', [sd * 0.58 * s, 0.015, z + fz]]); }
  if (bee) defs.push(['WL', 'root', [0.05, H + 0.08, 0]], ['WR', 'root', [-0.05, H + 0.08, 0]]);
  const R = new Rig(defs); const r = R.rest; const dark = shade(col, -0.25);
  if (spider && ORGANIC()) { R.organic = true; R.k = 0.03; R.cell = 0.014; }
  if (spider) { // two parts joined by a thin waist: a low, flat cephalothorax carrying the legs, and a big round abdomen behind
    R.ell('root', [0, r.root[1] + 0.03, 0.02], [0.2, 0.12, 0.25], col, 'fur'); R.seg('abd', [0, r.root[1] + 0.05, -0.2], [0, r.abd[1] + 0.06, r.abd[2] - 0.08], 0.05, 0.08, dark, 'fur');
    R.ell('abd', [0, r.abd[1] + 0.12, r.abd[2] - 0.24], [0.29, 0.25, 0.36], dark, 'fur', Q(-0.25, 0, 0)); R.box('abd', [0, r.abd[1] + 0.37, r.abd[2] - 0.22], [0.08, 0.03, 0.18], '#c83a3a', 'skin', Q(-0.25, 0, 0)); R.ell('head', [0, r.head[1] + 0.02, r.head[2] + 0.04], [0.12, 0.1, 0.1], col, 'fur'); for (let k = 0; k < 6; k++) R.ell('head', [((k % 3) - 1) * 0.045, r.head[1] + 0.07 + Math.floor(k / 3) * 0.035, r.head[2] + 0.12 - Math.floor(k / 3) * 0.02], [0.022, 0.022, 0.018], '#ff4a3a', 'glow'); for (const sd of [-1, 1]) R.cone('head', [sd * 0.045, r.head[1] - 0.06, r.head[2] + 0.13], 0.025, 0.12, Q(Math.PI, 0, 0), '#1a1a1a', 'shell'); }
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
  for (let i = 0; i < legs; i++) for (const sd of [1, -1]) { const n = 'L' + i + (sd > 0 ? 'l' : 'r'); const t0 = spider ? 0.03 : bee ? 0.007 : 0.03; const a = r[n + '1'], k = r[n + '2'], f = r[n + '3'];
    R.seg(n + '1', a, k, t0, t0 * 0.85, dark, spider ? 'fur' : 'shell');
    if (spider) { // the leg arcs: out from the knee, then bends down to the foot
      const m = [k[0] + (f[0] - k[0]) * 0.42 + sd * 0.06, k[1] + (f[1] - k[1]) * 0.32 + 0.04, k[2] + (f[2] - k[2]) * 0.45];
      R.seg(n + '2', k, m, t0 * 0.85, t0 * 0.6, shade(dark, (i % 2) ? 0.12 : -0.04), 'fur'); R.seg(n + '2', m, f, t0 * 0.6, t0 * 0.25, shade(dark, (i % 2) ? 0.12 : -0.04), 'fur');
      R.ell(n + '2', k, [t0 * 1.1, t0 * 1.1, t0 * 1.1], shade(col, 0.2), 'fur'); R.ell(n + '2', m, [t0 * 0.75, t0 * 0.75, t0 * 0.75], shade(col, 0.15), 'fur');
    } else if (bee) R.seg(n + '2', k, f, t0 * 0.8, t0 * 0.3, dark, 'shell');
    else { // a beetle: a thick femur up to the knee beside the shell, a spined tibia down to a hooked foot
      R.ell(n + '1', [(a[0] + k[0]) / 2, (a[1] + k[1]) / 2, (a[2] + k[2]) / 2], [t0 * 1.1, t0 * 1.1, Math.hypot(k[0] - a[0], k[1] - a[1], k[2] - a[2]) * 0.55], dark, 'shell', new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(k[0] - a[0], k[1] - a[1], k[2] - a[2]).normalize()));
      R.seg(n + '2', k, f, t0 * 0.75, t0 * 0.4, dark, 'shell'); R.seg(n + '3', f, [f[0] + sd * 0.04, 0.005, f[2] + (i === 2 ? -0.05 : 0.05)], t0 * 0.35, t0 * 0.15, shade(dark, -0.2), 'shell');
      for (const u of [0.35, 0.65]) R.cone(n + '2', [k[0] + (f[0] - k[0]) * u - sd * 0.01, k[1] + (f[1] - k[1]) * u, k[2] + (f[2] - k[2]) * u], 0.006, 0.035, Q(0, 0, sd * 2.3), shade(dark, -0.2), 'shell');
    } }
  if (spider) for (const sd of [-1, 1]) R.seg('head', [sd * 0.06, r.head[1] - 0.03, r.head[2] + 0.14], [sd * 0.14, r.head[1] - 0.12, r.head[2] + 0.3], 0.022, 0.012, dark, 'fur'); // pedipalps
  const inst = instance(R, R.geometry());
  if (R.organic && spider) addFur(inst, R.body, 0.012);
  return Object.assign(inst, { _R: R, _body: R.organic && spider ? R.body : null, _furLen: 0.012, type: 'bug', legs, spider, bee, t: Math.random() * 10, phase: 0, H });
}
function animBug(rig, st, dt) {
  // spiders walk on alternating tetrapods (L1 R2 L3 R4 against the rest), beetles on alternating tripods;
  // a swinging leg lifts and reaches forward, a planted one sweeps back; the cycle follows distance
  if (st.freeze) dt = 0;
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
  // struck: the body jolts away from the blow and the legs splay
  if (st.hurt && !st.dead) { const h = st.hurt; const k = Math.sin(Math.min(1, h.t / 0.06) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.06), 9) * Math.min(1.3, 0.5 + h.mag * 6); B.root.position.x += h.fx * 0.06 * k; B.root.position.z += h.fz * 0.06 * k; B.root.rotation.z += h.fx * 0.2 * k; B.root.position.y += 0.03 * k; }
  if (st.dead) for (let i = 0; i < rig.legs; i++) for (const sd of ['l', 'r']) { const n = 'L' + i + sd; B[n + '1'].rotation.set(0, 0, (sd === 'l' ? 1 : -1) * 0.9); if (B[n + '2']) B[n + '2'].rotation.z = (sd === 'l' ? 1 : -1) * 1.2; } // legs curl up

}

// ---------- snake ----------
function buildSnake(col) {
  const N = 13; const defs = [['s0', null, [0, 0.13, 0.9]]]; for (let i = 1; i < N; i++) defs.push(['s' + i, 's' + (i - 1), [0, 0.09, 0.9 - i * 0.16]]);
  const R = new Rig(defs); const r = R.rest; if (ORGANIC()) { R.organic = true; R.k = 0.02; R.cell = 0.011; }
  // thin behind the head, thickest a third of the way back, then a long taper to a fine tail tip
  const rad = (u) => 0.088 * (u < 0.38 ? 0.5 + 0.5 * Math.sin(Math.min(1, (u + 0.02) / 0.4) * Math.PI / 2) : Math.max(0.06, 1 - ((u - 0.38) / 0.62) ** 1.4 * 0.94));
  for (let i = 0; i < N - 1; i++) R.seg('s' + i, r['s' + i], r['s' + (i + 1)], rad(i / N), rad((i + 1) / N), col, 'scales');
  const e = r['s' + (N - 1)]; R.seg('s' + (N - 1), e, [0, 0.05, e[2] - 0.22], rad((N - 1) / N), 0.004, col, 'scales');
  // a dark saddle of blotches down the back, edged pale; a cream belly; the marks are soft-edged so they read
  // at any distance without crawling
  if (R.organic) R.paint = (g) => { const P = g.attributes.position, Nn = g.attributes.normal, C = g.attributes.color; const sm = (a, b, v) => { const t = K3.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    for (let i = 0; i < P.count; i++) { const ny = Nn.getY(i), z = P.getZ(i), x = P.getX(i); let k = 1;
      const belly = sm(-0.05, -0.45, ny); const ph = ((z * 4.2) % 1 + 1) % 1; const d = Math.abs(ph - 0.5) * 2 + Math.abs(x) * 6 - 0.15 * Math.sin(z * 17);
      const blot = sm(0.85, 0.6, d) * sm(-0.1, 0.35, ny); const edge = sm(1.05, 0.88, d) * (1 - sm(0.85, 0.6, d)) * sm(-0.1, 0.35, ny);
      const flank = sm(0.35, -0.1, ny) * (1 - belly) * (0.5 + 0.5 * Math.sin(z * 4.2 * Math.PI * 2 + Math.PI));
      k = (1 - 0.55 * blot) * (1 + 0.28 * edge) * (1 - 0.25 * flank) * (1 + 0.04 * Math.sin(z * 9.1));
      let cr = C.getX(i) * k, cg = C.getY(i) * k, cb = C.getZ(i) * k; cr += (0.86 - cr) * belly * 0.75; cg += (0.8 - cg) * belly * 0.75; cb += (0.6 - cb) * belly * 0.75;
      C.setXYZ(i, cr, cg, cb); } };
  // a broad, flat, arrow-shaped viper head, clearly wider than the slim neck, with a brow ridge and a pale lip
  R.ell('s0', [0, r.s0[1] + 0.015, r.s0[2] + 0.02], [0.105, 0.055, 0.08], shade(col, 0.05), 'scales'); R.ell('s0', [0, r.s0[1] + 0.01, r.s0[2] + 0.11], [0.075, 0.048, 0.1], shade(col, 0.05), 'scales');
  for (const sd of [-1, 1]) R.ell('s0', [sd * 0.055, r.s0[1] + 0.045, r.s0[2] + 0.09], [0.03, 0.018, 0.06], shade(col, -0.2), 'scales'); // brow ridges
  R.ell('s0', [0, r.s0[1] - 0.015, r.s0[2] + 0.08], [0.085, 0.025, 0.12], shade(col, 0.4), 'scales');
  R.hard(() => { for (const sd of [-1, 1]) { R.ell('s0', [sd * 0.068, r.s0[1] + 0.035, r.s0[2] + 0.1], [0.02, 0.02, 0.018], '#e8d040', 'glow'); R.ell('s0', [sd * 0.08, r.s0[1] + 0.036, r.s0[2] + 0.104], [0.006, 0.015, 0.008], '#120c08', 'gem'); }
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
  // knocked back by a blow, a tumble and a lurch before it beats on
  if (st.hurt && !st.dead) { const h = st.hurt; const k = Math.sin(Math.min(1, h.t / 0.06) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.06), 8) * Math.min(1.3, 0.5 + h.mag * 6); B.root.rotation.z += h.fx * 0.6 * k; B.root.position.y -= 0.1 * k; }
  // dying: the wings fold and it drops
  if (st.dead) { rig.deadT = (rig.deadT || 0) + dt; const d = ease(Math.min(1, rig.deadT / 0.5)); B.WL.rotation.z = -1.2 * d; B.WR.rotation.z = 1.2 * d; B.WL2.rotation.z = -1.4 * d; B.WR2.rotation.z = 1.4 * d; B.root.position.y = rig.rest.root[1] * (1 - d) + 0.1 * d; B.root.rotation.x = 0.6 * d; } else rig.deadT = 0;
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
  // a giant's walk: everything slow and heavy, the whole body rolling over each planted foot
  if (st.freeze) dt = 0;
  const B = rig.bones; const t = (rig.t += dt); rig.phase = (rig.phase || 0) + st.dist / (1.7 * rig.S) * Math.PI;
  rig.mv = (rig.mv || 0) + ((st.dist > 0 ? 1 : 0) - (rig.mv || 0)) * Math.min(1, dt * 5); const m = rig.mv;
  for (const k in B) B[k].rotation.set(0, 0, 0); B.hips.position.set(rig.rest.hips[0], rig.rest.hips[1], rig.rest.hips[2]);
  const s = Math.sin(rig.phase), c = Math.cos(rig.phase);
  B.thighL.rotation.x = -s * 0.42 * m; B.thighR.rotation.x = s * 0.42 * m; B.shinL.rotation.x = Math.max(0, c) * 0.6 * m; B.shinR.rotation.x = Math.max(0, -c) * 0.6 * m;
  B.armL.rotation.x = s * 0.3 * m + 0.1; B.armR.rotation.x = -s * 0.3 * m + 0.1; B.armL.rotation.z = 0.18; B.armR.rotation.z = -0.18; B.foreL.rotation.x = -0.25; B.foreR.rotation.x = -0.25;
  B.hips.position.y -= Math.abs(c) * 0.09 * m * rig.S; B.hips.rotation.z = s * 0.06 * m; B.chest.rotation.z = -s * 0.08 * m; B.chest.rotation.y = s * 0.12 * m;
  B.chest.rotation.x = 0.14 + Math.sin(t * 0.9 + (rig.seed || 0)) * 0.03; B.head.rotation.x = -0.1 + Math.sin(t * 0.9 + 0.6) * 0.02; B.head.rotation.y = Math.sin(t * 0.3 + (rig.seed || 0)) * 0.3 * (1 - m);
  // a two-armed overhead smash: raised slowly (the wind-up), brought down hard as the blow lands, a heavy recovery
  const w = ease(st.wind || 0), a = st.atk || 0;
  const down = a > 0 && a < 1 ? (a < 0.12 ? ease(a / 0.12) : 1 - ease(K3.clamp((a - 0.4) / 0.6, 0, 1))) : 0;
  const up = w * (1 - (a > 0 ? 1 : 0));
  if (up > 0 || down > 0) {
    B.armL.rotation.x += -2.5 * up + 0.9 * down; B.armR.rotation.x += -2.6 * up + 0.9 * down; B.foreL.rotation.x += -0.3 * up; B.foreR.rotation.x += -0.3 * up;
    B.chest.rotation.x += -0.25 * up + 0.4 * down; B.hips.position.y -= 0.12 * down * rig.S; B.head.rotation.x += 0.2 * down;
  }
  if (st.animK === 'slam' && st.animP > 0 && st.animP < 1) { const s1 = Math.sin(st.animP * Math.PI); B.armR.rotation.x = -2.8 * s1; B.armL.rotation.x = -2.8 * s1; B.hips.position.y += s1 * 0.4; }
  // struck: a slow, heavy rock backward
  if (st.hurt && !st.dead) { const h = st.hurt; const k = Math.sin(Math.min(1, h.t / 0.12) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.12), 5) * Math.min(1.2, 0.4 + h.mag * 5); B.chest.rotation.x -= 0.2 * k; B.chest.rotation.z += h.fx * 0.15 * k; B.head.rotation.x -= 0.25 * k; }
  // falling: knees buckle, then the body topples (actors.js tips it over)
  if (st.dead) { rig.deadT = (rig.deadT || 0) + dt; const d = ease(Math.min(1, rig.deadT / 0.9)); B.thighL.rotation.x = -0.9 * d; B.thighR.rotation.x = -0.7 * d; B.shinL.rotation.x = 1.3 * d; B.shinR.rotation.x = 1.1 * d; B.chest.rotation.x = 0.5 * d; B.armL.rotation.x = 0.4 * d; B.armR.rotation.x = 0.2 * d; B.hips.position.y -= 0.35 * d * rig.S; }
  else rig.deadT = 0;
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
  // spirits recoil from a blow by squashing and flaring, and shrink away when they die
  let sq = 0; if (st.hurt && !st.dead) { const h = st.hurt; sq = Math.sin(Math.min(1, h.t / 0.06) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.06), 9) * Math.min(1, 0.4 + h.mag * 5); }
  if (st.dead) { rig.deadT = (rig.deadT || 0) + dt; } else rig.deadT = 0;
  const fade = st.dead ? Math.max(0.05, 1 - rig.deadT / 1.2) : 1;
  g.scale.set((1 + sq * 0.25) * fade, (1 - sq * 0.2) * fade, (1 + sq * 0.25) * fade); if (rig.kind === 'wisp') g.rotation.y = t * 1.5;
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
