// Kingdom Rising 3D — trees, boulders, bushes and plants: procedural models, instanced per area,
// two levels of detail, swaying in the wind, felled trees leave stumps and quarried rocks leave rubble
import { THREE, K3, TILE, TS, PX } from './core.js';
import { geo, T } from './geo.js';
import { MB, PRIM } from './mb.js';
import { mats } from './mats.js';
import { cardTex } from './texgen.js';

const KR = window.KR, D = KR.D, W = KR.W, G = KR.G;

// ---------- foliage material with wind ----------
const leafMats = {};
function leafMat(kind) {
  if (leafMats[kind]) return leafMats[kind];
  const tex = cardTex(kind === 'snowpine' ? 'snowpine' : kind === 'pine' ? 'pine' : kind);
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, vertexColors: true });
  m.alphaToCoverage = !!K3.quality.msaa;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = K3.shared.uTime; sh.uniforms.uWind = K3.shared.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
        #else
          vec2 ip = vec2(0.);
        #endif
        float hgt = max(position.y, 0.);
        float ph = uTime * 1.25 + ip.x * 0.37 + ip.y * 0.29;
        float sway = (sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.25) * uWind;
        transformed.x += sway * hgt * 0.018; transformed.z += cos(ph * 0.8) * uWind * hgt * 0.012;
        transformed += normal * sin(uTime * 6. + position.x * 4. + position.z * 3. + ip.x) * 0.025 * uWind;`);
  };
  m.customProgramCacheKey = () => 'krleaf';
  return (leafMats[kind] = m);
}
const cardMats = {};
function plantMat(kind) {
  if (cardMats[kind]) return cardMats[kind];
  const m = new THREE.MeshStandardMaterial({ map: cardTex(kind), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, vertexColors: true });
  m.alphaToCoverage = !!K3.quality.msaa;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = K3.shared.uTime; sh.uniforms.uWind = K3.shared.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
        #else
          vec2 ip = vec2(0.);
        #endif
        float ph = uTime * 1.8 + ip.x * 0.7 + ip.y * 0.5; transformed.x += sin(ph) * position.y * 0.12 * uWind; transformed.z += cos(ph * 0.7) * position.y * 0.08 * uWind;`);
  };
  m.customProgramCacheKey = () => 'krplant';
  return (cardMats[kind] = m);
}

// ---------- tree builders ----------
// leaf cards around a centre, with normals that point away from the crown centre (soft round shading)
function cards(mb, key, cx, cy, cz, rad, n, size, rnd, crown, tint, droop = 0) {
  const g = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.cbrt(rnd()) * rad;
    const sx = Math.sqrt(1 - u * u) * Math.cos(a), sy = u, sz = Math.sqrt(1 - u * u) * Math.sin(a);
    const x = cx + sx * r, y = cy + sy * r * 0.75, z = cz + sz * r;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * Math.PI - droop, rnd() * Math.PI * 2, rnd() * Math.PI, 'YXZ')), new THREE.Vector3(size * (0.8 + rnd() * 0.4), size * (0.8 + rnd() * 0.4), 1));
    const start = mb.part(key).n;
    mb.add(key, g, m, tint ? tint(rnd) : null, 'local');
    // bend normals outward from the crown
    const p = mb.part(key);
    for (let k = start; k < p.n; k++) { const px = p.pos[k * 3] - crown.x, py = p.pos[k * 3 + 1] - crown.y, pz = p.pos[k * 3 + 2] - crown.z; const l = Math.hypot(px, py, pz) || 1; p.nor[k * 3] = p.nor[k * 3] * 0.25 + (px / l) * 0.75; p.nor[k * 3 + 1] = p.nor[k * 3 + 1] * 0.25 + (py / l) * 0.75 + 0.15; p.nor[k * 3 + 2] = p.nor[k * 3 + 2] * 0.25 + (pz / l) * 0.75; }
  }
  g.dispose();
}
function limb(mb, key, a, b, r0, r1, col, seg = 7) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const L = Math.hypot(dx, dy, dz);
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 3, false);
  const m = new THREE.Matrix4().compose(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L)), new THREE.Vector3(1, 1, 1));
  mb.add(key, g, m, col); g.dispose();
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function broadleaf(kind, lod, seed) {
  const R = K3.rng(seed); const mb = new MB();
  const spec = { oak: { h: 4.2, crownR: 4.0, crownY: 7.4, r: 0.42, n: 9, bark: 'bark', bc: '#8a7a6a', lean: 0.15 }, elmwood: { h: 6.0, crownR: 4.6, crownY: 10.2, r: 0.5, n: 11, bark: 'birch', bc: '#c8bea0', lean: 0.08 }, darkoak: { h: 4.6, crownR: 4.3, crownY: 8.2, r: 0.5, n: 10, bark: 'bark', bc: '#5a4a40', lean: 0.2 }, birch: { h: 6.0, crownR: 2.6, crownY: 8.6, r: 0.22, n: 7, bark: 'birch', bc: '#ffffff', lean: 0.06 }, willow: { h: 3.4, crownR: 3.8, crownY: 6.2, r: 0.45, n: 9, bark: 'bark', bc: '#7a6a5a', lean: 0.25 }, bramble: { h: 0, crownR: 1.1, crownY: 0.7, r: 0, n: 3, bark: 'bark', bc: '#5a4a3a', lean: 0 } }[kind];
  const trunkKey = spec.bark, leafKey = 'leaf_' + kind;
  const top = V3(spec.lean * (R() - 0.5) * 2, spec.h, spec.lean * (R() - 0.5) * 2);
  if (spec.h > 0) {
    limb(mb, trunkKey, V3(0, -0.4, 0), V3(top.x * 0.5, spec.h * 0.55, top.z * 0.5), spec.r * 1.25, spec.r * 0.95, spec.bc, lod ? 6 : 9);
    limb(mb, trunkKey, V3(top.x * 0.5, spec.h * 0.55, top.z * 0.5), top, spec.r * 0.95, spec.r * 0.75, spec.bc, lod ? 6 : 9);
    // root flare
    if (!lod) for (let k = 0; k < 4; k++) { const a = k * 1.57 + R(); limb(mb, trunkKey, V3(Math.cos(a) * spec.r * 1.6, -0.2, Math.sin(a) * spec.r * 1.6), V3(0, spec.h * 0.18, 0), spec.r * 0.35, spec.r * 0.5, spec.bc, 5); }
  }
  const crown = V3(top.x, spec.crownY, top.z);
  const ends = [];
  for (let i = 0; i < spec.n; i++) {
    const a = (i / spec.n) * Math.PI * 2 + R() * 0.6, el = 0.35 + R() * 0.6;
    const len = spec.crownR * (0.65 + R() * 0.4);
    const s = V3(top.x * (0.6 + 0.4 * R()), spec.h * (0.62 + R() * 0.38), top.z * (0.6 + 0.4 * R()));
    const e = V3(s.x + Math.cos(a) * Math.cos(el) * len, s.y + Math.sin(el) * len * 0.9 + (kind === 'willow' ? 0.8 : 0), s.z + Math.sin(a) * Math.cos(el) * len);
    if (spec.h > 0 && (!lod || i % 2 === 0)) limb(mb, trunkKey, s, e, spec.r * 0.42, spec.r * 0.12, spec.bc, lod ? 4 : 6);
    ends.push(e);
  }
  const tint = (r) => new THREE.Color().setScalar(0.78 + r() * 0.35);
  const csz = kind === 'bramble' ? 1.1 : kind === 'birch' ? 1.9 : kind === 'willow' ? 2.6 : 2.5;
  const per = lod ? 3 : kind === 'bramble' ? 7 : 9;
  for (const e of ends) cards(mb, leafKey, e.x, e.y, e.z, spec.crownR * 0.45, per, csz * (lod ? 1.5 : 1), R, crown, tint, kind === 'willow' ? 0.6 : 0);
  cards(mb, leafKey, crown.x, crown.y, crown.z, spec.crownR * 0.7, lod ? 8 : 22, csz * (lod ? 1.6 : 1.1), R, crown, tint);
  if (kind === 'willow') for (let i = 0; i < (lod ? 6 : 16); i++) { const a = R() * 6.283, rr = spec.crownR * (0.6 + R() * 0.4); cards(mb, leafKey, crown.x + Math.cos(a) * rr, crown.y - 2.2, crown.z + Math.sin(a) * rr, 0.6, 1, 3.6, R, crown, tint); }
  return { trunk: mb.geometry(trunkKey), leaves: mb.geometry(leafKey), trunkKey, leafKind: kind, height: spec.crownY + spec.crownR };
}
function conifer(kind, lod, seed) {
  const R = K3.rng(seed); const mb = new MB(); const H = 13 + R() * 2; const snow = kind === 'snowpine';
  limb(mb, 'pinebark', V3(0, -0.4, 0), V3(0, H, 0), 0.4, 0.06, '#9a8a7a', lod ? 6 : 8);
  const leafKey = 'leaf_' + kind; const tint = (r) => new THREE.Color().setScalar(0.8 + r() * 0.3);
  const levels = lod ? 6 : 13;
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2);
  for (let l = 0; l < levels; l++) {
    const t = l / (levels - 1); const y = 2.2 + t * (H - 2.6); const rad = (1 - t) * 3.6 + 0.5; const n = lod ? 5 : Math.max(5, Math.round(9 - t * 3));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + l * 0.7 + R() * 0.3; const droop = 0.35 + t * 0.2;
      const m = new THREE.Matrix4().compose(V3(0, y, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(droop, a, 0, 'YXZ')), V3(rad * 0.9 + 0.6, rad * 1.15 + 0.4, 1));
      const start = mb.part(leafKey).n; mb.add(leafKey, g, m, tint(R), 'local');
      const p = mb.part(leafKey); for (let i = start; i < p.n; i++) { const px = p.pos[i * 3], pz = p.pos[i * 3 + 2]; const l2 = Math.hypot(px, pz) || 1; p.nor[i * 3] = px / l2 * 0.7; p.nor[i * 3 + 1] = 0.7; p.nor[i * 3 + 2] = pz / l2 * 0.7; }
    }
  }
  g.dispose();
  return { trunk: mb.geometry('pinebark'), leaves: mb.geometry(leafKey), trunkKey: 'pinebark', leafKind: snow ? 'snowpine' : 'pine', height: H };
}
function deadTree(kind, lod, seed) {
  const R = K3.rng(seed); const mb = new MB(); const col = kind === 'charred' ? '#2a2422' : '#7a6a5a'; const H = 6 + R() * 2.5;
  limb(mb, 'bark', V3(0, -0.3, 0), V3(0.3, H, 0.1), 0.36, 0.1, col, 7);
  for (let i = 0; i < (lod ? 4 : 8); i++) { const a = R() * 6.283, s = V3(0.1, H * (0.4 + R() * 0.55), 0.05), L = 1.5 + R() * 2.2; const e = V3(s.x + Math.cos(a) * L, s.y + 0.6 + R() * 1.5, s.z + Math.sin(a) * L); limb(mb, 'bark', s, e, 0.12, 0.02, col, 5); if (!lod) limb(mb, 'bark', e, V3(e.x + Math.cos(a + 0.8) * 0.9, e.y + 0.7, e.z + Math.sin(a + 0.8) * 0.9), 0.04, 0.01, col, 4); }
  return { trunk: mb.geometry('bark'), leaves: null, trunkKey: 'bark', height: H };
}
function palm(lod, seed) {
  const R = K3.rng(seed); const mb = new MB(); const H = 8 + R() * 2; let prev = V3(0, -0.3, 0); const bend = 1.2 + R() * 0.8;
  const segs = lod ? 4 : 8;
  for (let k = 1; k <= segs; k++) { const t = k / segs; const p = V3(Math.sin(t * 1.4) * bend, t * H, 0); limb(mb, 'bark', prev, p, 0.3 - t * 0.1, 0.28 - t * 0.1, '#a08a6a', 7); prev = p; }
  const tip = prev; const leafKey = 'leaf_palm'; const g = new THREE.PlaneGeometry(1, 1, 1, 4); g.translate(0, 0.5, 0);
  // arch each frond
  const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, -y * y * 0.55); } g.computeVertexNormals();
  for (let k = 0; k < (lod ? 6 : 10); k++) { const a = (k / 10) * Math.PI * 2 + R() * 0.3; const m = new THREE.Matrix4().compose(tip, new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9 - R() * 0.3, a, 0, 'YXZ')), V3(1.4, 4.4, 4.4)); mb.add(leafKey, g, m, new THREE.Color().setScalar(0.85 + R() * 0.25), 'local'); }
  for (let k = 0; k < 4; k++) mb.sph('paint', tip.x + Math.cos(k * 1.6) * 0.25, tip.y - 0.3, tip.z + Math.sin(k * 1.6) * 0.25, 0.28, 0.32, 0.28, '#6a4a2a');
  g.dispose();
  const tr = mb.geometry('bark'); const coco = mb.geometry('paint');
  return { trunk: mergeTwo(tr, coco), leaves: mb.geometry(leafKey), trunkKey: 'bark', leafKind: 'palm', height: H + 2 };
}
function cactus(seed) {
  const R = K3.rng(seed); const mb = new MB(); const c = '#4a8a3a'; const H = 3 + R() * 1.6;
  mb.cylB('paint', 0, -0.2, 0, 0.32, H, c, 12); mb.sph('paint', 0, H - 0.2, 0, 0.64, 0.5, 0.64, c);
  for (const s of [-1, 1]) { if (R() < 0.25) continue; const y = 1.1 + R() * 1.0; mb.cyl('paint', s * 0.55, y, 0, 0.2, 0.75, c, 10, null, 0, 0, Math.PI / 2); mb.cylB('paint', s * 0.9, y, 0, 0.2, 1.0 + R() * 0.6, c, 10); mb.sph('paint', s * 0.9, y + 1.3, 0, 0.4, 0.3, 0.4, c); }
  if (R() > 0.5) mb.sph('glow', 0, H + 0.08, 0, 0.2, 0.15, 0.2, '#e05a8a');
  return { trunk: mergeTwo(mb.geometry('paint'), mb.geometry('glow')), leaves: null, trunkKey: 'paint', height: H };
}
function mergeTwo(a, b) {
  if (!b) return a; if (!a) return b;
  const mb = new MB(); const id = new THREE.Matrix4(); mb.add('x', a, id, null, 'local'); const pa = mb.part('x'); // keep original colours
  const ca = a.attributes.color, cb = b.attributes.color; mb.add('x', b, id, null, 'local');
  const p = mb.part('x'); for (let i = 0; i < ca.count; i++) { p.col[i * 3] = ca.getX(i); p.col[i * 3 + 1] = ca.getY(i); p.col[i * 3 + 2] = ca.getZ(i); }
  for (let i = 0; i < cb.count; i++) { const k = ca.count + i; p.col[k * 3] = cb.getX(i); p.col[k * 3 + 1] = cb.getY(i); p.col[k * 3 + 2] = cb.getZ(i); }
  return mb.geometry('x');
}
// ---------- rocks ----------
function rockGeom(seed, detail = 2, squash = 0.7) {
  const g = new THREE.IcosahedronGeometry(1, detail); const R = K3.rng(seed); const p = g.attributes.position;
  const off = [R() * 10, R() * 10, R() * 10];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = K3.fbm(x * 1.3 + off[0], z * 1.3 + y * 0.7 + off[1], 3); const f = 0.72 + n * 0.6; p.setXYZ(i, x * f * 1.15, y * f * squash + (y < 0 ? 0.15 : 0), z * f); }
  g.computeVertexNormals(); g.deleteAttribute('uv');
  // world-ish uvs (spherical-ish) for the rock texture
  const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * 0.6 + p.getZ(i) * 0.4; uv[i * 2 + 1] = p.getY(i) * 0.7; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const c = new Float32Array(p.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
// ---------- small plants: crossed cards ----------
function plantGeom(kind) {
  const mb = new MB(); const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
  const sz = { flowers: [0.7, 0.55], fern: [1.3, 1.0], reeds: [0.9, 1.5], crop: [1.0, 1.15], grass: [1, 0.6] }[kind] || [1, 1];
  const n = kind === 'crop' ? 4 : 3;
  for (let k = 0; k < n; k++) { const m = new THREE.Matrix4().compose(V3(kind === 'crop' ? (k - 1.5) * 0.45 : 0, -0.03, 0), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), (k / n) * Math.PI), V3(sz[0], sz[1], 1)); mb.add('p', g, m, null, 'local'); }
  const out = mb.geometry('p'); const nor = out.attributes.normal; for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0); // light like the ground
  g.dispose(); return out;
}

// ---------- templates (cached) ----------
const TPL = {};
const TREE_KINDS = ['oak', 'elmwood', 'darkoak', 'birch', 'willow', 'pine', 'snowpine', 'deadtree', 'charred', 'palm', 'cactus', 'bramble'];
function template(kind, lod, variant) {
  const key = kind + lod + ':' + variant; if (TPL[key]) return TPL[key];
  const seed = kind.length * 1000 + variant * 77 + 13;
  let t;
  if (kind === 'pine' || kind === 'snowpine') t = conifer(kind, lod, seed);
  else if (kind === 'deadtree' || kind === 'charred') t = deadTree(kind, lod, seed);
  else if (kind === 'palm') t = palm(lod, seed);
  else if (kind === 'cactus') t = cactus(seed);
  else t = broadleaf(kind, lod, seed);
  return (TPL[key] = t);
}
const VARIANTS = 3;

// ---------- per-area instanced vegetation ----------
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _p4 = new THREE.Vector3(), _s4 = new THREE.Vector3(), _c4 = new THREE.Color();
export function buildVeg(list, out) {
  // group decorations by template
  const groups = new Map(); // key -> {kind, variant, items:[{d,m}]}
  const rocks = [], plants = new Map();
  for (const d of list) {
    const k = d.kind;
    if (TREE_KINDS.includes(k)) {
      const variant = Math.floor(d.v * VARIANTS) % VARIANTS; const key = k + ':' + variant;
      let g = groups.get(key); if (!g) groups.set(key, (g = { kind: k, variant, items: [] }));
      g.items.push(d);
    } else if (k === 'boulder' || k === 'orevein') rocks.push(d);
    else if (k === 'flowers' || k === 'fern' || k === 'reeds' || k === 'crop') { let a = plants.get(k); if (!a) plants.set(k, (a = [])); a.push(d); }
  }
  const meshes = [];
  const place = (d, scale, nb) => {
    const px = nb ? d.x : (d.tx + 0.5) * TS + (d.x - (d.tx * TS + 16)) * 0.8, py = nb ? d.y - 8 : (d.ty + 0.5) * TS + (K3.hash(d.tx, d.ty, 8) - 0.5) * 6;
    const y = geo.floorAt(px, py);
    _q4.setFromAxisAngle(_p4.set(0, 1, 0), d.v * 40); _p4.set(px * PX, y, py * PX); _s4.set(scale, scale, scale);
    return _m4.compose(_p4, _q4, _s4);
  };
  // trees are not drawn per area: they go into the forest, which draws each tree shape in one batch
  const trees = out.trees || (out.trees = []);
  for (const g of groups.values()) {
    const key = g.kind + ':' + g.variant;
    for (const d of g.items) {
      const big = g.kind === 'elmwood' ? 1.1 : 1; const sc = (0.82 + d.v * 0.4) * big;
      const m = new Float32Array(16); place(d, sc, false).toArray(m);
      const tint = 0.85 + K3.hash(d.tx, d.ty, 6) * 0.3;
      const t = { d, key, kind: g.kind, variant: g.variant, m, col: [tint, tint * (0.95 + K3.hash(d.tx, d.ty, 7) * 0.1), tint * 0.92], hidden: false };
      d._tree = t; delete d._inst; trees.push(t);
    }
  }
  if (rocks.length) {
    // three rock shapes, each its own instanced mesh
    for (let v = 0; v < 3; v++) {
      const items = rocks.filter((d) => Math.floor(d.v * 3) % 3 === v); if (!items.length) continue;
      const geom = TPL['rock' + v] || (TPL['rock' + v] = rockGeom(v * 31 + 5, 2, 0.62));
      const rm = new THREE.InstancedMesh(geom, mats.get('rock'), items.length); rm.castShadow = true; rm.receiveShadow = true;
      items.forEach((d, i) => { const reg = D.REGIONS[W.regionAt(d.tx, d.ty)] || {}; const s = 0.7 + d.v * 0.35; const m = place(d, s, false); rm.setMatrixAt(i, m);
        const c = reg.biome === 'desert' ? [1.25, 1.05, 0.8] : reg.biome === 'snow' || reg.biome === 'summit' ? [1.05, 1.08, 1.15] : reg.biome === 'volcanic' || reg.biome === 'scar' ? [0.5, 0.45, 0.42] : [1, 1, 1];
        if (d.kind === 'orevein') { c[0] *= 0.42; c[1] *= 0.4; c[2] *= 0.4; }
        rm.setColorAt(i, _c4.setRGB(c[0], c[1], c[2])); d._inst = { tm: rm, i, s }; });
      rm.computeBoundingSphere(); if (rm.instanceColor) rm.instanceColor.needsUpdate = true; rm.userData.mid = true; meshes.push(rm); // boulders stop at the props range (world3d.js)
    }
    // ore veins: nuggets of the metal glinting out of the dark rock
    for (let v = 0; v < 3; v++) {
      const veins = rocks.filter((d) => d.kind === 'orevein' && Math.floor(d.v * 3) % 3 === v); if (!veins.length) continue;
      const geom = TPL['nuggets' + v] || (TPL['nuggets' + v] = nuggetGeom(TPL['rock' + v]));
      const om = new THREE.InstancedMesh(geom, oreMat(), veins.length); om.castShadow = false; om.receiveShadow = true;
      veins.forEach((d, i) => { d._inst.tm.getMatrixAt(d._inst.i, _m4); om.setMatrixAt(i, _m4); const oc = ORE_RGB[d.ore || 0]; om.setColorAt(i, _c4.setRGB(oc[0], oc[1], oc[2])); d._inst.lm = om; d._inst.li = i; });
      om.computeBoundingSphere(); if (om.instanceColor) om.instanceColor.needsUpdate = true; om.userData.mid = true; om.userData.nug = true; meshes.push(om);
    }
  }
  for (const [k, items] of plants) {
    const geom = TPL['plant' + k] || (TPL['plant' + k] = plantGeom(k));
    const pm = new THREE.InstancedMesh(geom, plantMat(k === 'crop' ? 'crop' : k), items.length); pm.receiveShadow = true; pm.castShadow = false;
    items.forEach((d, i) => { const s = 0.8 + d.v * 0.5; const m = place(d, s, true); pm.setMatrixAt(i, m); });
    pm.computeBoundingSphere(); pm.userData.small = true; meshes.push(pm);
  }
  return meshes;
}
// copper, iron, silver, mithril, adamantite, starmetal
const ORE_RGB = [[0.95, 0.45, 0.2], [0.7, 0.36, 0.22], [0.9, 0.92, 0.96], [0.45, 0.8, 1.1], [0.4, 1.0, 0.6], [1.2, 0.95, 0.4]];
let _oreMat = null;
function oreMat() { return _oreMat || (_oreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.32, emissive: 0x111111, flatShading: true })); }
// a ring of angular nuggets around the upper half of a rock (rock size 1)
// nuggets sitting in the surface of one rock shape: picked from the rock's own vertices so they fit it exactly
function nuggetGeom(rock) {
  const r = K3.rng(4242); const pos = [], nor = []; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3(), sc = new THREE.Vector3();
  const RP = rock.attributes.position, RN = rock.attributes.normal; const cand = [];
  for (let i = 0; i < RP.count; i++) if (RP.getY(i) > 0.08 && RN.getY(i) > -0.1) cand.push(i);
  for (let k = 0; k < 24 && cand.length; k++) {
    const vi = cand[Math.floor(r() * cand.length)]; const s = 0.1 + r() * 0.1;
    const g = new THREE.OctahedronGeometry(s, 0); g.computeVertexNormals();
    v.set(RP.getX(vi), RP.getY(vi), RP.getZ(vi)); n.set(RN.getX(vi), RN.getY(vi), RN.getZ(vi)); v.addScaledVector(n, -s * 0.25); // half sunk into the stone
    m.compose(v, q.setFromEuler(e.set(r() * 3, r() * 3, 0)), sc.set(1, 1.3, 1)); nm.getNormalMatrix(m);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
}
// rock outcrops on lone rock tiles, so every blocking rock is visible
export function buildOutcrops(x0, y0, x1, y1) {
  const items = [];
  for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
    if (!W.inb(tx, ty) || W.tiles[ty * W.W + tx] !== T.ROCK) continue;
    if (geo.dungeon && geo.dtype !== 'cave') continue;
    let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && W.tile(tx + dx, ty + dy) === T.ROCK) n++;
    if (n <= 4) items.push({ tx, ty, n, v: K3.hash(tx, ty, 41) });
  }
  if (!items.length) return [];
  const geom = TPL.outcrop || (TPL.outcrop = rockGeom(77, 2, 0.85));
  const rm = new THREE.InstancedMesh(geom, mats.get('rock'), items.length); rm.castShadow = true; rm.receiveShadow = true;
  items.forEach((it, i) => { const y = geo.groundT(it.tx + 0.5, it.ty + 0.5); const s = 1.0 + it.v * 0.5 + (4 - it.n) * 0.08; _q4.setFromAxisAngle(_p4.set(0, 1, 0), it.v * 30); _p4.set((it.tx + 0.5) * TILE, y + 0.2, (it.ty + 0.5) * TILE); _s4.set(s * 1.1, s * 1.15, s * 1.1); rm.setMatrixAt(i, _m4.compose(_p4, _q4, _s4)); });
  rm.computeBoundingSphere();
  return [rm];
}

// ---------- felled trees and quarried rocks ----------
let stumpGeo = null, rubbleGeo = null;
export function stumpFor(d) {
  if (!stumpGeo) { const mb = new MB(); mb.cylB('bark', 0, -0.2, 0, 0.42, 0.75, '#6a4a2a', 10); mb.cyl('planks', 0, 0.56, 0, 0.38, 0.02, '#c8a070', 12); stumpGeo = mb.build(); rubbleGeo = new MB(); for (let k = 0; k < 6; k++) rubbleGeo.add('rock', rockGeom(k + 90, 1, 0.6), MB.mat(Math.cos(k * 1.7) * 0.5, 0.1, Math.sin(k * 1.7) * 0.5, 0.35, 0.3, 0.35), '#8a8478', 'local'); rubbleGeo = rubbleGeo.build(); }
  const g = (d.kind === 'boulder' || d.kind === 'orevein' ? rubbleGeo : stumpGeo).clone(); const px = (d.tx + 0.5) * TS, py = (d.ty + 0.5) * TS;
  g.position.set(px * PX, geo.floorAt(px, py), py * PX); g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.userData.keepGeo = true; } });
  return g;
}
// a felled tree: a one-off copy of its shape swings over away from the woodcutter, bounces, settles, then sinks away
const falling = []; K3.fallingTrees = falling;
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fax = new THREE.Vector3(), _fb = new THREE.Vector3(), _fT = new THREE.Matrix4(), _fTi = new THREE.Matrix4(), _fR = new THREE.Matrix4();
export function fellTree(d, fromX, fromZ, onLand) {
  const t = d._tree; if (!t) return false;
  const tpl = template(t.kind, 0, t.variant); const M = new THREE.Matrix4().fromArray(t.m); const base = new THREE.Vector3().setFromMatrixPosition(M);
  let dx = base.x - fromX, dz = base.z - fromZ; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; // falls away from the cutter
  const parts = [];
  for (const [g, m] of [[tpl.trunk, mats.get(tpl.trunkKey)], [tpl.leaves, tpl.leaves ? leafMat(tpl.leafKind) : null]]) { if (!g) continue; const im = new THREE.InstancedMesh(g, m, 1); im.castShadow = true; im.frustumCulled = false; if (m === leafMats[tpl.leafKind] || g === tpl.leaves) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(t.col), 3); } im.setMatrixAt(0, M); forestRoot.add(im); parts.push(im); }
  falling.push({ parts, M, base, axis: new THREE.Vector3(dz, 0, -dx).normalize(), t: 0, onLand, landed: false });
  return true;
}
K3.updaters.push((dt) => {
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i]; f.t += dt; const T = 2.4;
    // a slow lean, then gathering speed, a bounce on the ground, a rest, then down into the earth
    let a; if (f.t < T) { const k = f.t / T; a = Math.pow(k, 2.6) * 1.5; } else { const k = f.t - T; a = 1.5 - Math.abs(Math.sin(k * 9)) * 0.1 * Math.exp(-k * 5); }
    if (f.t >= T && !f.landed) { f.landed = true; if (f.onLand) f.onLand(f); }
    const sink = f.t > T + 2.2 ? Math.min(1, (f.t - T - 2.2) / 1.6) : 0;
    _fq.setFromAxisAngle(f.axis, a); _fR.makeRotationFromQuaternion(_fq); _fT.makeTranslation(f.base.x, f.base.y - sink * 1.4, f.base.z); _fTi.makeTranslation(-f.base.x, -f.base.y, -f.base.z);
    _fm.copy(_fT).multiply(_fR).multiply(_fTi).multiply(f.M);
    if (sink > 0) { _fm.decompose(_fb, _fq, _fax); _fax.multiplyScalar(1 - sink * 0.6); _fm.compose(_fb, _fq, _fax); }
    for (const im of f.parts) { im.setMatrixAt(0, _fm); im.instanceMatrix.needsUpdate = true; }
    if (sink >= 1) { for (const im of f.parts) { forestRoot.remove(im); im.dispose(); } falling.splice(i, 1); }
  }
});
export function setHidden(d, hidden) {
  if (d._tree) { if (d._tree.hidden !== hidden) { d._tree.hidden = hidden; forest.dirty = true; } return; }
  const it = d._inst; if (!it) return;
  for (const [mesh, idx] of [[it.tm, it.i], [it.lm, it.li != null ? it.li : it.i]]) { if (!mesh) continue; mesh.getMatrixAt(idx, _m4); _m4.decompose(_p4, _q4, _s4); _s4.setScalar(hidden ? 0.0001 : it.s); mesh.setMatrixAt(idx, _m4.compose(_p4, _q4, _s4)); mesh.instanceMatrix.needsUpdate = true; }
}
export function setVegLod(meshes, lod) {
  for (const m of meshes) { const l = m.userData.lods; if (l && l[lod] && m.geometry !== l[lod]) m.geometry = l[lod]; }
}
export { TREE_KINDS };

// ---------- the forest ----------
// Every tree of one shape is drawn in a single batch (instead of one batch per area), in three bands:
// near trees in full detail that throw shadows, middle trees in full detail, far trees in low detail.
// The batches are refilled only when the camera has moved or turned a fair way, and trees well behind
// the camera are left out. This turned hundreds of draw calls into a few dozen.
const forestRoot = new THREE.Group(); forestRoot.name = 'forest';
const batches = new Map();
function bucketMesh(geom, mat, cap, shadow, colors) {
  const m = new THREE.InstancedMesh(geom, mat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (colors) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
  forestRoot.add(m); return m;
}
function batchFor(t) {
  let b = batches.get(t.key); if (b) return b;
  const lods = [template(t.kind, 0, t.variant), template(t.kind, 1, t.variant)];
  b = { lods, kind: t.kind, buckets: [0, 1, 2].map(() => ({ trunk: null, leaves: null, cap: 0, n: 0 })) };
  batches.set(t.key, b); return b;
}
function ensure(b, i, need) {
  const k = b.buckets[i]; if (k.cap >= need) return k;
  const cap = Math.max(16, Math.ceil(need * 1.5)); const tpl = b.lods[i === 2 ? 1 : 0];
  for (const part of ['trunk', 'leaves']) { if (k[part]) { forestRoot.remove(k[part]); k[part].dispose(); k[part] = null; } }
  if (tpl.trunk) k.trunk = bucketMesh(tpl.trunk, mats.get(b.lods[0].trunkKey), cap, i === 0, false);
  if (tpl.leaves) k.leaves = bucketMesh(tpl.leaves, leafMat(b.lods[0].leafKind), cap, i === 0, true);
  k.cap = cap; return k;
}
const _fw = new THREE.Vector3();
export const forest = {
  root: forestRoot, dirty: true, lx: 1e9, lz: 1e9, lfx: 0, lfz: 0, age: 0,
  reset() { for (const b of batches.values()) for (const k of b.buckets) { k.n = 0; for (const part of ['trunk', 'leaves']) if (k[part]) k[part].count = 0; } this.dirty = true; },
  update(cam, chunks, CHR) {
    const q = K3.quality; this.age++;
    K3.camera.getWorldDirection(_fw); let fx = _fw.x, fz = _fw.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const moved = Math.hypot(cam.x - this.lx, cam.z - this.lz) > 6, turned = fx * this.lfx + fz * this.lfz < 0.9; // the margin below leaves room to turn ~25 degrees before a refill
    // a refill walks every tree in range and re-uploads them all: new areas being built ask for one each, so
    // those are gathered into at most one refill every 12 frames
    if (!moved && !turned && this.age < 120 && !(this.dirty && this.age >= 12)) return;
    this.dirty = false; this.lx = cam.x; this.lz = cam.z; this.lfx = fx; this.lfz = fz; this.age = 0;
    const far = q.treeFar, near = q.treeNear || 60, shd = q.shadows ? q.shadowDist || 0 : 0;
    // what the camera can see sideways, plus room to turn before the next refill
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(K3.camera.fov) / 2) * K3.camera.aspect);
    const minDot = Math.cos(Math.min(Math.PI, halfH + 0.6));
    for (const b of batches.values()) for (const k of b.buckets) k.n = 0;
    const lists = new Map();
    for (const c of chunks.values()) {
      if (!c.trees || !c.trees.length) continue;
      if (Math.hypot(c.x - cam.x, c.z - cam.z) - CHR > far) continue;
      for (const t of c.trees) {
        if (t.hidden) continue;
        const dx = t.m[12] - cam.x, dz = t.m[14] - cam.z, d = Math.hypot(dx, dz);
        if (d > far) continue;
        const band = d < shd ? 0 : d < near ? 1 : 2;
        if (band !== 0 && d > 14 && (dx * fx + dz * fz) / d < minDot) continue; // behind the camera
        let L = lists.get(t.key); if (!L) lists.set(t.key, (L = [[], [], []]));
        L[band].push(t);
      }
    }
    for (const [key, L] of lists) {
      const b = batchFor(L[0][0] || L[1][0] || L[2][0]);
      for (let i = 0; i < 3; i++) {
        const arr = L[i]; if (!arr.length && !b.buckets[i].cap) continue;
        const k = ensure(b, i, arr.length); k.n = arr.length;
        for (const part of ['trunk', 'leaves']) {
          const m = k[part]; if (!m) continue;
          const A = m.instanceMatrix.array; arr.forEach((t, j) => A.set(t.m, j * 16)); m.count = arr.length; m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) { const C = m.instanceColor.array; arr.forEach((t, j) => { C[j * 3] = t.col[0]; C[j * 3 + 1] = t.col[1]; C[j * 3 + 2] = t.col[2]; }); m.instanceColor.needsUpdate = true; }
        }
      }
    }
    for (const [key, b] of batches) if (!lists.has(key)) for (const k of b.buckets) for (const part of ['trunk', 'leaves']) if (k[part]) k[part].count = 0;
  },
};
K3.forest = forest;
