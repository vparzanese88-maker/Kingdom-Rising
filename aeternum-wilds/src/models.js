import * as THREE from 'three';
import { axeReady, axeMesh, swordReady, swordMesh, hammerReady, hammerMesh } from './gfx/meshy.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

// ---------- Geometry merging (fewer draw calls) ----------
function prep(geo, m4) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.applyMatrix4(m4);
  return g;
}
// Merge every mesh under root into one mesh per material, in root's local space.
// Meshes flagged userData.keep (flames, flags, bow strings) stay separate so they can animate.
export function mergeStatic(root, shadow = true) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map(), victims = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    let k = o; let kept = false; while (k && k !== root) { if (k.userData.keep) kept = true; k = k.parent; }
    if (kept) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(prep(o.geometry, m));
    victims.push(o);
  });
  for (const v of victims) v.parent.remove(v);
  for (const [m, list] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(list), m);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}
// Merge only the direct mesh children of a group (for animated body parts)
export function mergeDirect(group) {
  const byMat = new Map(), victims = [];
  for (const o of group.children) {
    if (!o.isMesh || o.userData.keep) continue;
    o.updateMatrix();
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(prep(o.geometry, o.matrix));
    victims.push(o);
  }
  if (victims.length < 2) return;
  for (const v of victims) group.remove(v);
  for (const [m, list] of byMat) { const mesh = new THREE.Mesh(mergeGeometries(list), m); mesh.castShadow = true; group.add(mesh); }
}
// Template group -> [[geometry, material]] in the template's local space (for instancing)
export function templateParts(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map();
  root.traverse(o => { if (o.isMesh) { const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(prep(o.geometry, m)); } });
  return [...byMat].map(([m, list]) => [mergeGeometries(list), m]);
}

const shared = new Map();
// shared material (scenery); use own=true for characters so hit flashes stay per-character
export function mat(color, own = false, extra = {}) {
  if (own) return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
  const key = color + JSON.stringify(extra);
  if (!shared.has(key)) shared.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }));
  return shared.get(key);
}
const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w},${h},${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}
function cyl(rt, rb, h, m, seg = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.castShadow = true;
  return mesh;
}

// ---------- Weapons ----------
export function makeWeapon(type, tier = 1) {
  const g = new THREE.Group();
  const metal = mat([0x9aa0a6, 0x8fb8d8, 0xe0a640][tier - 1] ?? 0x9aa0a6, false, { emissive: tier === 3 ? 0x3a2000 : 0x000000 });
  const wood = mat(0x6b4a2a), dark = mat(0x2a2018), gold = mat(0xc8a040);
  if ((type === 'sword' || type === 'greatsword') && swordReady()) {
    // the player's own gothic greatsword model (the Warden carries a huge corrupted one)
    const m = swordMesh(type === 'greatsword' ? 'boss' : tier);
    if (type === 'greatsword') m.scale.setScalar(1.6);
    g.add(m);
    g.rotation.x = Math.PI / 2;
    return g;
  }
  if (type === 'sword' || type === 'cutlass') {
    const len = type === 'cutlass' ? 0.8 : 0.95;
    g.add(box(0.07, 0.24, 0.07, dark, 0, 0, 0));
    g.add(box(0.36, 0.07, 0.09, gold, 0, 0.14, 0));
    g.add(box(0.1, len, 0.035, type === 'cutlass' ? mat(0x7d7c72) : metal, 0, 0.17 + len / 2, 0));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'shield') {
    const s = box(0.62, 0.72, 0.08, mat(0x6a3a22), 0, 0, 0);
    g.add(s);
    g.add(box(0.66, 0.08, 0.1, metal, 0, 0.32, 0));
    g.add(box(0.66, 0.08, 0.1, metal, 0, -0.32, 0));
    g.add(box(0.2, 0.2, 0.06, metal, 0, 0, 0.06));
  } else if (type === 'greataxe' && axeReady()) {
    // the player's own sculpted double-bladed axe
    g.add(axeMesh(tier));
    g.rotation.x = Math.PI / 2;
    return g;
  } else if (type === 'greataxe') {
    g.add(box(0.07, 1.6, 0.07, wood, 0, 0.55, 0));
    g.add(box(0.05, 0.52, 0.5, metal, 0, 1.2, 0.22));
    g.add(box(0.05, 0.3, 0.18, metal, 0, 1.22, -0.1));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'hammer' && hammerReady()) {
    g.add(hammerMesh(tier));
    g.rotation.x = Math.PI / 2;
    return g;
  } else if (type === 'hammer') {
    g.add(box(0.08, 1.4, 0.08, wood, 0, 0.45, 0));
    g.add(box(0.36, 0.34, 0.6, metal, 0, 1.15, 0));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'club') {
    g.add(box(0.12, 1.2, 0.12, wood, 0, 0.45, 0));
    g.add(box(0.3, 0.5, 0.3, mat(0x3a2a1a), 0, 1.0, 0));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'greatsword') {
    g.add(box(0.09, 0.4, 0.09, dark, 0, 0, 0));
    g.add(box(0.5, 0.09, 0.1, mat(0x5a0a0a), 0, 0.22, 0));
    g.add(box(0.16, 1.7, 0.05, mat(0x2a1a1a, false, { emissive: 0x401008 }), 0, 1.1, 0));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'staff') {
    const sw = mat([0x6a4a2a, 0x4a3a5a, 0x3a2440][tier - 1] ?? 0x6a4a2a);
    g.add(box(0.07, 1.7, 0.07, sw, 0, 0.45, 0));
    for (let i = 0; i < 4; i++) { const p = box(0.05, 0.28, 0.05, sw, Math.cos(i * 1.57) * 0.09, 1.38, Math.sin(i * 1.57) * 0.09); p.rotation.set(Math.sin(i * 1.57) * 0.35, 0, -Math.cos(i * 1.57) * 0.35); g.add(p); }
    const gemC = [0xff7a2a, 0x6ac8ff, 0xc66dff][tier - 1] ?? 0xff7a2a;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: gemC }));
    gem.position.y = 1.42; gem.userData.keep = true; g.add(gem); g.userData.gem = gem;
    g.add(box(0.1, 0.06, 0.1, gold, 0, 1.25, 0));
    g.rotation.x = Math.PI / 2;
  } else if (type === 'bow') {
    const bm = mat([0x8a5a32, 0x6a3a22, 0x5a2a5a][tier - 1] ?? 0x8a5a32);
    for (let i = -3; i <= 3; i++) {
      const a = i / 3 * 0.9;
      const seg = box(0.06, 0.22, 0.06, bm, 0, Math.sin(a) * 0.6, Math.cos(a) * 0.25 - 0.2);
      seg.rotation.x = -a;
      g.add(seg);
    }
    const str = box(0.015, 1.1, 0.015, mat(0xe8e0c8), 0, 0, -0.24);
    str.userData.keep = true;
    g.add(str);
    g.userData.string = str;
  }
  const rx = g.rotation.x; g.rotation.x = 0;
  mergeStatic(g);
  g.rotation.x = rx;
  return g;
}

// ---------- Weapon sizing ----------
// Weapons are about as long as their wielder: smaller at low quality, bigger at high quality.
export const TIER_LEN = { 1: 0.8, 2: 0.92, 3: 1.04 };
const _wb = new THREE.Box3(), _wv = new THREE.Vector3();
// the character's standing height in world units (measured once, before weapons are attached)
export function charHeight(h) {
  if (!h.tallW) { h.root.updateMatrixWorld(true); _wb.setFromObject(h.body); h.tallW = Math.max(1, _wb.max.y - _wb.min.y); }
  return h.tallW;
}
// scale weapon w (not yet parented) so it is worldLen long once added to parent
export function sizeWeapon(w, parent, worldLen) {
  w.scale.setScalar(1); w.position.set(0, 0, 0); w.updateMatrixWorld(true);
  _wb.setFromObject(w);
  const len = Math.max(_wb.max.x - _wb.min.x, _wb.max.y - _wb.min.y, _wb.max.z - _wb.min.z) || 1;
  parent.updateMatrixWorld(true); parent.getWorldScale(_wv);
  w.scale.setScalar(worldLen / len / (_wv.y || 1));
  return w;
}

// ---------- Humanoid ----------
// Faces +z. Returns { root, body, mats:[skin, shirt, pants, boot, trim], parts }
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); }
export function makeHumanoid(o = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // scaled, bobbing
  root.add(body);
  const s = o.size || 1, ht = (o.height || 1) * (o.sex === 'f' ? 0.95 : 1), bd = (o.build || 1) * (o.sex === 'f' ? 0.92 : 1), mus = o.muscle || 1;
  body.scale.set(s * bd, s * ht, s * bd);
  const skin = mat(o.skin ?? 0xe0b48a, true), shirt = mat(o.shirt ?? 0x6a5236, true), pants = mat(o.pants ?? 0x40362a, true), boot = mat(o.boots ?? 0x2a2018, true);
  const trim = mat(shade(o.shirt ?? 0x6a5236, 0.7), true);
  const mats = [skin, shirt, pants, boot, trim];
  const beltM = mat(0x3a2414), buckle = mat(0xc8a040);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  const upper = new THREE.Group(); hips.add(upper);
  if (o.hunched) upper.rotation.x = 0.35;
  // torso: chest, waist, collar
  upper.add(box(0.6, 0.44, 0.36, shirt, 0, 0.52, 0));
  upper.add(box(0.52, 0.3, 0.32, shirt, 0, 0.2, 0));
  upper.add(box(0.62, 0.08, 0.38, trim, 0, 0.76, 0));
  upper.add(box(0.16, 0.5, 0.02, trim, 0, 0.4, 0.18));
  upper.add(box(0.58, 0.1, 0.36, beltM, 0, 0.04, 0));
  upper.add(box(0.12, 0.09, 0.04, buckle, 0, 0.04, 0.19));
  // shoulder pads
  upper.add(box(0.24, 0.12, 0.34, trim, 0.36, 0.76, 0));
  upper.add(box(0.24, 0.12, 0.34, trim, -0.36, 0.76, 0));
  upper.add(box(0.16, 0.12, 0.16, skin, 0, 0.86, 0));
  if (o.sex === 'f') upper.add(box(0.46, 0.16, 0.1, shirt, 0, 0.5, 0.17));
  if ((o.build || 1) > 1.12) upper.add(box(0.46, 0.26, 0.12, shirt, 0, 0.24, 0.18)); // belly
  if (o.sex === 'f') upper.scale.x = 0.9;
  // head and face; f holds the character creator sliders (all default 1)
  const f = o.face || {};
  const fem = o.sex === 'f';
  const fw = (f.faceWidth || 1), jaw = f.jaw || 1, chin = f.chin || 1, nose = f.nose || 1, eyeS = f.eyeSize || 1, brow = f.brow || 1, earS = f.ears || 1, mouth = f.mouth || 1;
  const head = new THREE.Group(); head.position.y = 1.08; upper.add(head);
  const hs = (f.headSize || 1) * (fem ? 0.95 : 1);
  head.scale.set(hs / Math.sqrt(bd), hs, hs / Math.sqrt(bd));
  const skull = box(0.38 * fw, 0.3, 0.38, skin, 0, 0.06, 0); head.add(skull);
  head.add(box(0.36 * fw * (0.85 + jaw * 0.15), 0.14, 0.36, skin, 0, -0.14, 0));
  head.add(box(0.2 * jaw * fw, 0.08 * chin, 0.12, skin, 0, -0.19 - 0.02 * chin, 0.12 + 0.02 * chin));
  // cheekbones and nose
  for (const sx of [1, -1]) head.add(box(0.08, 0.06, 0.06, skin, sx * 0.14 * fw, -0.03, 0.17));
  const nz = box(0.06 * nose, 0.11 * nose, 0.06 + 0.04 * nose, skin, 0, -0.02, 0.2 + 0.02 * nose); head.add(nz);
  const eyeC = o.eyes ?? o.eyeColor ?? 0x3a2a1a;
  const eyeM = o.eyes ? mat(o.eyes, false, { emissive: o.eyes }) : mat(eyeC);
  const white = mat(0xf0ece0), dark = mat(0x0a0806);
  const browM = mat(shade(o.hair ?? 0x3a2a1a, 0.8));
  for (const sx of [1, -1]) {
    const ex = sx * 0.09 * fw;
    if (!o.eyes) { head.add(box(0.085 * eyeS, 0.055 * eyeS, 0.02, white, ex, 0.05, 0.19)); head.add(box(0.012, 0.012, 0.01, dark, ex, 0.05, 0.207)); }
    head.add(box(0.04 * eyeS, 0.05 * eyeS, 0.02, eyeM, ex, 0.05, 0.198));
    const br = box(0.1, 0.022 * brow, 0.03, browM, ex, 0.1 + 0.01 * brow, 0.195); br.rotation.z = sx * (fem ? -0.12 : 0.08) * brow; head.add(br);
    if (fem) head.add(box(0.03, 0.01, 0.01, dark, ex + sx * 0.045, 0.07, 0.205)); // lashes
    head.add(box(0.04, 0.1 * earS, 0.08, skin, sx * 0.2 * fw, 0.02, -0.01));
  }
  const lipM = mat(fem ? 0xa8484a : 0x7a4436);
  head.add(box(0.11 * mouth, 0.022, 0.02, lipM, 0, -0.1, 0.19));
  if (fem) head.add(box(0.09 * mouth, 0.016, 0.02, lipM, 0, -0.118, 0.188));
  // war paint and scars
  if (o.paint != null) { const pm = mat(o.paint); head.add(box(0.36 * fw, 0.035, 0.01, pm, 0, 0.05, 0.193)); head.add(box(0.03, 0.12, 0.01, pm, 0, -0.16, 0.18)); }
  if (o.scar) { const sc = box(0.015, 0.16, 0.012, mat(0x8a3a2a), -0.1 * fw, 0.03, 0.198); sc.rotation.z = 0.35; head.add(sc); }
  if (o.tusks) for (const sx of [1, -1]) head.add(box(0.035, 0.09, 0.035, mat(0xf0e8d0), sx * 0.07, -0.1, 0.2));
  const hairM = mat(o.hair ?? 0x3a2a1a, true);
  const hair = new THREE.Group(); head.add(hair);
  if (o.hair !== undefined) {
    const st = o.hairStyle ?? 0;
    const W = 0.42 * fw;
    if (st !== 3 && st !== 7) hair.add(box(W, 0.1, 0.42, hairM, 0, 0.24, -0.01));
    if (st === 0) { hair.add(box(W, 0.22, 0.08, hairM, 0, 0.1, -0.19)); hair.add(box(0.06, 0.18, 0.36, hairM, W / 2, 0.12, -0.03)); hair.add(box(0.06, 0.18, 0.36, hairM, -W / 2, 0.12, -0.03)); }
    if (st === 1) { hair.add(box(W + 0.02, 0.62, 0.1, hairM, 0, -0.1, -0.2)); hair.add(box(0.07, 0.5, 0.36, hairM, W / 2, -0.05, -0.03)); hair.add(box(0.07, 0.5, 0.36, hairM, -W / 2, -0.05, -0.03)); hair.add(box(W, 0.06, 0.06, hairM, 0, 0.19, 0.19)); }
    if (st === 2) { hair.add(box(W, 0.18, 0.08, hairM, 0, 0.1, -0.19)); hair.add(box(0.14, 0.18, 0.14, hairM, 0, 0.36, -0.08)); }
    if (st === 3) hair.add(box(0.4 * fw, 0.04, 0.4, hairM, 0, 0.22, -0.01));
    if (st === 4) { hair.add(box(W, 0.22, 0.08, hairM, 0, 0.1, -0.19)); for (const sx of [1, -1]) { hair.add(box(0.07, 0.6, 0.07, hairM, sx * 0.16, -0.22, -0.2)); hair.add(box(0.09, 0.05, 0.09, mat(0xc8a040), sx * 0.16, -0.5, -0.2)); } }
    if (st === 5) { hair.add(box(W, 0.2, 0.08, hairM, 0, 0.12, -0.19)); const pt = box(0.1, 0.55, 0.1, hairM, 0, -0.08, -0.28); pt.rotation.x = 0.25; hair.add(pt); hair.add(box(0.12, 0.05, 0.12, mat(0x6a2a1a), 0, 0.17, -0.24)); }
    if (st === 6) { hair.add(box(W, 0.2, 0.08, hairM, 0, 0.12, -0.19)); hair.add(box(0.2, 0.18, 0.18, hairM, 0, 0.26, -0.2)); }
    if (st === 7) { hair.add(box(0.08, 0.16, 0.44, hairM, 0, 0.28, -0.02)); hair.add(box(0.36 * fw, 0.02, 0.38, mat(shade(o.hair ?? 0x3a2a1a, 0.7)), 0, 0.215, -0.01)); }
  }
  // facial hair: 0 none, 1 stubble, 2 mustache, 3 goatee, 4 full beard, 5 long beard (or o.beard from old saves)
  const fh = o.facialHair ?? (o.beard ? 4 : 0);
  if (fh === 1) { const sm = mat(shade(o.skin ?? 0xe0b48a, 0.75)); head.add(box(0.34 * fw * (0.85 + jaw * 0.15), 0.12, 0.02, sm, 0, -0.15, 0.185)); }
  if (fh === 2 || fh === 3 || fh >= 4) head.add(box(0.16 * mouth, 0.035, 0.03, hairM, 0, -0.075, 0.2));
  if (fh === 3) head.add(box(0.1, 0.12, 0.06, hairM, 0, -0.2, 0.17));
  if (fh >= 4) { head.add(box(0.34 * fw, 0.18, 0.1, hairM, 0, -0.18, 0.15)); for (const sx of [1, -1]) head.add(box(0.06, 0.2, 0.3, hairM, sx * 0.18 * fw, -0.08, 0.04)); }
  if (fh === 5) { head.add(box(0.22, 0.24, 0.08, hairM, 0, -0.38, 0.17)); head.add(box(0.12, 0.14, 0.06, hairM, 0, -0.55, 0.16)); }
  if (o.hat) { head.add(box(0.7, 0.06, 0.7, mat(0x1a1a22), 0, 0.24, 0)); head.add(box(0.44, 0.24, 0.44, mat(0x1a1a22), 0, 0.36, 0)); }
  if (o.horns) {
    const hm = mat(0x1a0a08);
    const h1 = box(0.08, 0.4, 0.08, hm, 0.2, 0.32, 0); h1.rotation.z = -0.5; head.add(h1);
    const h2 = box(0.08, 0.4, 0.08, hm, -0.2, 0.32, 0); h2.rotation.z = 0.5; head.add(h2);
  }
  if (o.helm) head.add(box(0.46, 0.3, 0.46, mat(o.helm, true), 0, 0.12, -0.01));
  const mkArm = side => {
    const a = new THREE.Group(); a.position.set(side * 0.4, 0.7, 0); upper.add(a);
    a.add(box(0.18, 0.36, 0.2, shirt, 0, -0.16, 0));
    a.add(box(0.17, 0.3, 0.19, skin, 0, -0.46, 0));
    a.add(box(0.19, 0.14, 0.21, trim, 0, -0.5, 0));
    a.add(box(0.16, 0.14, 0.18, skin, 0, -0.66, 0.01));
    const hand = new THREE.Group(); hand.position.set(0, -0.68, 0.04); a.add(hand);
    for (const c of a.children) if (c.isMesh) { c.scale.x = mus; c.scale.z = mus; }
    return [a, hand];
  };
  const [armR, handR] = mkArm(-1);
  const [armL, handL] = mkArm(1);
  const mkLeg = side => {
    const l = new THREE.Group(); l.position.set(side * 0.15, 0, 0); hips.add(l);
    l.add(box(0.23, 0.4, 0.26, pants, 0, -0.2, 0));
    l.add(box(0.21, 0.24, 0.24, pants, 0, -0.5, 0));
    l.add(box(0.24, 0.32, 0.28, boot, 0, -0.76, 0.01));
    l.add(box(0.24, 0.1, 0.12, boot, 0, -0.87, 0.18));
    l.add(box(0.26, 0.06, 0.3, trim, 0, -0.6, 0.01));
    return l;
  };
  const legR = mkLeg(-1), legL = mkLeg(1);
  for (const g of [upper, head, hair, armR, armL, legR, legL]) mergeDirect(g);
  return { root, body, mats, parts: { hips, upper, head, hair, armR, armL, handR, handL, legR, legL }, size: s * ht, hunched: !!o.hunched };
}

// Recolor clothes on the player model by gear tier
export function dressHumanoid(h, look) {
  const [skin, shirt, pants, boot, trim] = h.mats;
  shirt.color.setHex(look.chest);
  trim.color.setHex(look.trim ?? shade(look.chest, 0.7));
  pants.color.setHex(look.legs);
  boot.color.setHex(look.feet);
  if (h.hero) return; // the sculpted hero keeps his own painted outfit
  const head = h.parts.head;
  if (head.userData.helm) { head.remove(head.userData.helm); head.userData.helm = null; }
  h.parts.hair.visible = look.helm == null;
  if (look.helm != null) {
    const hg = new THREE.Group();
    const hm = mat(look.helm);
    hg.add(box(0.46, 0.26, 0.46, hm, 0, 0.14, -0.01));
    hg.add(box(0.48, 0.06, 0.48, mat(shade(look.helm, 0.7)), 0, 0.02, -0.01));
    if (look.helmTier >= 2) { hg.add(box(0.06, 0.24, 0.3, hm, 0, 0.36, -0.02)); hg.add(box(0.08, 0.2, 0.04, hm, 0, -0.02, 0.22)); }
    if (look.helmTier >= 3) for (const sx of [1, -1]) { const w = box(0.04, 0.22, 0.14, mat(0xf0e0b0), sx * 0.25, 0.26, -0.06); w.rotation.z = sx * -0.4; hg.add(w); }
    mergeStatic(hg);
    head.add(hg); head.userData.helm = hg;
  }
}

// ---------- Quadrupeds ----------
export function makeBeast(kind, o = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const s = o.size || 1;
  body.scale.setScalar(s);
  const fur = mat(o.color ?? 0x7b7468, true), dark = mat(0x2a2420, true);
  const mats = [fur, dark];
  const eyeM = mat(o.eyes ?? 0xffd040, false, { emissive: o.eyes ?? 0x403000 });
  const torso = new THREE.Group(); torso.position.y = kind === 'boar' ? 0.62 : 0.72; body.add(torso);
  if (kind === 'boar') {
    torso.add(box(0.7, 0.62, 1.15, fur, 0, 0, 0));
    torso.add(box(0.2, 0.2, 0.9, dark, 0, 0.36, -0.05));
  } else {
    torso.add(box(0.48, 0.5, 1.15, fur, 0, 0, 0));
    torso.add(box(0.56, 0.56, 0.5, fur, 0, 0.04, 0.3));
  }
  const head = new THREE.Group(); head.position.set(0, kind === 'boar' ? 0.0 : 0.22, kind === 'boar' ? 0.68 : 0.72); torso.add(head);
  if (kind === 'boar') {
    head.add(box(0.52, 0.48, 0.5, fur, 0, 0, 0.1));
    head.add(box(0.3, 0.26, 0.2, mat(0xc89080, true), 0, -0.08, 0.42));
    head.add(box(0.06, 0.2, 0.06, mat(0xf0e8d0), 0.2, 0.0, 0.38));
    head.add(box(0.06, 0.2, 0.06, mat(0xf0e8d0), -0.2, 0.0, 0.38));
    head.add(box(0.07, 0.07, 0.02, eyeM, 0.16, 0.1, 0.36));
    head.add(box(0.07, 0.07, 0.02, eyeM, -0.16, 0.1, 0.36));
  } else {
    head.add(box(0.4, 0.38, 0.44, fur, 0, 0, 0.1));
    head.add(box(0.24, 0.2, 0.32, fur, 0, -0.08, 0.42));
    head.add(box(0.1, 0.08, 0.06, dark, 0, -0.02, 0.6));
    head.add(box(0.1, 0.18, 0.08, fur, 0.13, 0.26, 0.0));
    head.add(box(0.1, 0.18, 0.08, fur, -0.13, 0.26, 0.0));
    head.add(box(0.07, 0.06, 0.02, eyeM, 0.11, 0.06, 0.33));
    head.add(box(0.07, 0.06, 0.02, eyeM, -0.11, 0.06, 0.33));
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.12, -0.58); torso.add(tail);
  tail.add(box(0.12, 0.12, kind === 'boar' ? 0.2 : 0.55, fur, 0, 0, -0.25));
  tail.rotation.x = kind === 'boar' ? 0 : 0.5;
  const legs = [];
  const lh = kind === 'boar' ? 0.42 : 0.55;
  for (const [x, z] of [[0.18, 0.4], [-0.18, 0.4], [0.18, -0.42], [-0.18, -0.42]]) {
    const l = new THREE.Group(); l.position.set(x, -0.15, z); torso.add(l);
    l.add(box(0.14, lh, 0.16, fur, 0, -lh / 2, 0));
    l.add(box(0.15, 0.08, 0.18, dark, 0, -lh, 0.02));
    legs.push(l);
  }
  for (const g of [torso, head, tail, ...legs]) mergeDirect(g);
  return { root, body, mats, parts: { torso, head, tail, legs }, size: s, beast: true };
}

// ---------- Scenery ----------
const trunkM = () => mat(0x5a4028);
function blob(r, m, x, y, z, sy = 1, det = 1) {
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, det), m);
  c.position.set(x, y, z); c.scale.y = sy; c.castShadow = true;
  return c;
}
export function makeTree(kind = 'oak', scale = 1) {
  const g = new THREE.Group();
  if (kind === 'pine') {
    const t = cyl(0.16, 0.3, 2.6, mat(0x4a3424), 7); t.position.y = 1.3; g.add(t);
    const lm = mat(0x2f5a32), lm2 = mat(0x274d2b);
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.9 - i * 0.34, 1.6, 8), i % 2 ? lm2 : lm); c.position.y = 2.0 + i * 0.85; c.rotation.y = i; c.castShadow = true; g.add(c); }
  } else if (kind === 'dead') {
    const bm = mat(0x3a2e26);
    const t = cyl(0.14, 0.32, 3.4, bm, 6); t.position.y = 1.7; g.add(t);
    for (const [x, y, z, rz, rx, l] of [[0.4, 2.6, 0, -0.8, 0, 1.4], [-0.35, 2.2, 0.1, 0.9, 0.2, 1.2], [0.1, 3.1, -0.3, 0.3, -0.7, 1.0], [-0.2, 3.3, 0.2, -0.4, 0.6, 0.8]]) { const b = cyl(0.05, 0.1, l, bm, 4); b.position.set(x, y, z); b.rotation.set(rx, 0, rz); g.add(b); }
  } else if (kind === 'willow') {
    const t = cyl(0.25, 0.45, 2.6, mat(0x4a3a2a), 7); t.position.y = 1.3; g.add(t);
    const lm = mat(0x56703a), lm2 = mat(0x4a6232);
    g.add(blob(1.8, lm, 0, 3.0, 0, 0.75));
    g.add(blob(1.1, lm2, 0.9, 3.3, 0.4, 0.7));
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; g.add(box(0.22, 1.9, 0.22, i % 2 ? lm : lm2, Math.cos(a) * 1.5, 2.0, Math.sin(a) * 1.5)); }
  } else if (kind === 'wyrd') {
    const t = cyl(0.22, 0.42, 3, mat(0x3a2440), 6); t.position.y = 1.5; g.add(t);
    const lm = mat(0x8a3a6a, false, { emissive: 0x2a0a20 });
    for (let i = 0; i < 4; i++) g.add(blob(1.1 - i * 0.15, lm, (i - 1.5) * 0.6, 3.2 + (i % 2) * 0.6, (i % 2) * 0.4, 0.9));
  } else {
    const t = cyl(0.2, 0.36, 2.2, trunkM(), 7); t.position.y = 1.1; g.add(t);
    const b1 = cyl(0.08, 0.14, 1.2, trunkM(), 5); b1.position.set(0.45, 2.1, 0.1); b1.rotation.z = -0.8; g.add(b1);
    const b2 = cyl(0.07, 0.12, 1.1, trunkM(), 5); b2.position.set(-0.4, 2.2, -0.1); b2.rotation.z = 0.8; g.add(b2);
    const aged = kind === 'aged';
    const lm = mat(aged ? 0x4a6a2e : 0x4f8a3a), lm2 = mat(aged ? 0x3e5c26 : 0x5f9a44), lm3 = mat(aged ? 0x56783a : 0x467e34);
    g.add(blob(1.45, lm, 0, 3.1, 0, 0.85));
    g.add(blob(1.0, lm2, 0.95, 2.7, 0.3, 0.85));
    g.add(blob(1.0, lm3, -0.85, 2.8, -0.35, 0.85));
    g.add(blob(0.85, lm2, 0.1, 3.8, 0.5, 0.85));
    if (aged) g.add(blob(1.1, lm, -0.5, 3.6, 0.6, 0.85));
  }
  g.scale.setScalar(scale);
  return g;
}
export function makeFern() {
  const g = new THREE.Group();
  const m = mat(0x3f7a34), m2 = mat(0x356a2c);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const f = box(0.14, 0.03, 0.9, i % 2 ? m : m2, Math.sin(a) * 0.38, 0.28, Math.cos(a) * 0.38);
    f.rotation.set(-0.5, a, 0); g.add(f);
  }
  return g;
}
export function makeShroom() {
  const g = new THREE.Group();
  g.add(box(0.06, 0.18, 0.06, mat(0xe8e0c8), 0, 0.09, 0));
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 7), mat(0xb83a2a)); c.position.y = 0.2; g.add(c);
  g.add(box(0.05, 0.12, 0.05, mat(0xe8e0c8), 0.15, 0.06, 0.05));
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 7), mat(0xa8742a)); c2.position.set(0.15, 0.14, 0.05); g.add(c2);
  return g;
}
export function makeBarrel() {
  const g = new THREE.Group();
  const b = cyl(0.38, 0.34, 1.0, mat(0x7a5232), 10); b.position.y = 0.5; g.add(b);
  for (const y of [0.15, 0.85]) { const r = cyl(0.4, 0.4, 0.06, mat(0x3a3a3a), 10); r.position.y = y; g.add(r); }
  return mergeStatic(g);
}
export function makeCrate(s = 0.9) {
  const g = new THREE.Group();
  g.add(box(s, s, s, mat(0x8a6a42), 0, s / 2, 0));
  for (const y of [0.06, s - 0.06]) for (const z of [-s / 2, s / 2]) g.add(box(s + 0.02, 0.1, 0.04, mat(0x5a4028), 0, y, z));
  return mergeStatic(g);
}
export function makeTorch() {
  const g = new THREE.Group();
  g.add(box(0.14, 2.4, 0.14, mat(0x4a3220), 0, 1.2, 0));
  g.add(box(0.26, 0.22, 0.26, mat(0x2a2a2a), 0, 2.45, 0));
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
  f.position.y = 2.75; f.userData.keep = true; g.add(f); g.userData.flame = f;
  return mergeStatic(g);
}
export function makeFence(len = 4) {
  const g = new THREE.Group();
  const m = mat(0x7a5a38);
  for (let x = 0; x <= len; x += 2) g.add(box(0.14, 1.1, 0.14, m, x - len / 2, 0.55, 0));
  g.add(box(len, 0.1, 0.08, m, 0, 0.8, 0));
  g.add(box(len, 0.1, 0.08, m, 0, 0.4, 0));
  return mergeStatic(g);
}

export function makeRock(kind = 'iron', scale = 1) {
  const g = new THREE.Group();
  const rm = mat(kind === 'plain' ? 0x8a8478 : 0x77736a);
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rm);
  r.scale.set(1.2, 0.8, 1); r.position.y = 0.5; r.castShadow = true; r.receiveShadow = true;
  g.add(r);
  const vc = { iron: 0xb07a5a, starmetal: 0x7ac0ff, orichalcum: 0xffa830 }[kind];
  if (vc) {
    const vm = mat(vc, false, { emissive: kind === 'iron' ? 0x000000 : vc, emissiveIntensity: 0.35 });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      const v = box(0.24, 0.24, 0.24, vm, Math.cos(a) * 0.9, 0.5 + Math.sin(i * 2.1) * 0.3, Math.sin(a) * 0.75);
      v.rotation.set(i, i * 2, 0);
      g.add(v);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

export function makePlant(kind = 'hemp') {
  const g = new THREE.Group();
  const lm = mat(kind === 'silkweed' ? 0x9ab0c8 : 0x6ab04a);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const st = box(0.06, 0.9, 0.06, lm, Math.cos(a) * 0.2, 0.45, Math.sin(a) * 0.2);
    st.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    g.add(st);
  }
  const fm = mat(kind === 'silkweed' ? 0xf0f4ff : 0xd8e070);
  for (let i = 0; i < 3; i++) g.add(box(0.16, 0.16, 0.16, fm, Math.cos(i * 2) * 0.25, 0.95, Math.sin(i * 2) * 0.25));
  return g;
}

export function makeHouse(w = 6, d = 5, color = 0x8a6a48, roof = 0x7a3a28) {
  const g = new THREE.Group();
  const stone = mat(0x7a756c), beam = mat(0x4a3220), glass = mat(0xf0d090, false, { emissive: 0x5a4010 });
  g.add(box(w + 0.3, 0.6, d + 0.3, stone, 0, 0.3, 0));
  const wall = box(w, 2.8, d, mat(color), 0, 2.0, 0); wall.receiveShadow = true; g.add(wall);
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(box(0.3, 2.9, 0.3, beam, x, 2.05, z));
  g.add(box(w + 0.1, 0.25, 0.3, beam, 0, 3.35, d / 2)); g.add(box(w + 0.1, 0.25, 0.3, beam, 0, 3.35, -d / 2));
  g.add(box(w + 0.1, 0.2, 0.25, beam, 0, 1.6, d / 2 + 0.02));
  // gable roof from two slabs
  const span = d / 2 + 0.6, pitch = 0.62, len = span / Math.cos(pitch);
  const rm = mat(roof), rm2 = mat(new THREE.Color(roof).multiplyScalar(0.8).getHex());
  for (const sd of [1, -1]) {
    const slab = box(w + 0.8, 0.18, len, sd > 0 ? rm : rm2, 0, 3.45 + Math.sin(pitch) * len / 2, sd * Math.cos(pitch) * len / 2);
    slab.rotation.x = sd * pitch; g.add(slab);
    for (let i = 1; i < 4; i++) { const st = box(w + 0.82, 0.05, 0.08, rm2, 0, 3.45 + Math.sin(pitch) * len * i / 4 + 0.1, sd * Math.cos(pitch) * len * i / 4); st.rotation.x = sd * pitch; g.add(st); }
  }
  // gable ends
  const tri = new THREE.Shape(); tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, Math.tan(pitch) * d / 2); tri.lineTo(-d / 2, 0);
  const tg = new THREE.ShapeGeometry(tri);
  for (const sx of [1, -1]) { const m = new THREE.Mesh(tg, mat(color)); m.material.side = THREE.DoubleSide; m.rotation.y = Math.PI / 2; m.position.set(sx * w / 2, 3.4, 0); g.add(m); }
  g.add(box(0.7, 2.0, 0.7, stone, w / 2 - 0.9, 4.6, -0.6));
  g.add(box(1.0, 1.9, 0.12, mat(0x3a2414), 0, 1.55, d / 2 + 0.06));
  g.add(box(0.1, 0.1, 0.06, mat(0xc8a040), 0.35, 1.5, d / 2 + 0.14));
  for (const x of [w / 4 + 0.3, -w / 4 - 0.3]) {
    if (Math.abs(x) < 0.9) continue;
    g.add(box(0.8, 0.7, 0.1, glass, x, 2.1, d / 2 + 0.05));
    g.add(box(0.9, 0.1, 0.16, beam, x, 1.7, d / 2 + 0.08));
    g.add(box(0.06, 0.7, 0.12, beam, x, 2.1, d / 2 + 0.1));
    g.add(box(0.3, 0.75, 0.06, mat(0x3a5a3a), x - 0.58, 2.1, d / 2 + 0.08));
    g.add(box(0.3, 0.75, 0.06, mat(0x3a5a3a), x + 0.58, 2.1, d / 2 + 0.08));
  }
  for (const z of [-d / 4, d / 4]) for (const sx of [1, -1]) g.add(box(0.1, 0.7, 0.8, glass, sx * (w / 2 + 0.05), 2.1, z));
  return mergeStatic(g);
}

export function makeFlag(color = 0x2a5a9a) {
  const g = new THREE.Group();
  const pole = cyl(0.08, 0.1, 7, mat(0x5a4028), 6); pole.position.y = 3.5; g.add(pole);
  const f = box(1.6, 1.0, 0.05, mat(color), 0.85, 6.3, 0); f.userData.keep = true; g.add(f);
  g.userData.flag = f;
  return g;
}
