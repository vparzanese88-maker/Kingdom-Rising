// Aeternum Wilds — trees, bushes, plants, rocks and gathering nodes (after Kingdom Rising 3D's veg.js).
// Trees are built from tapered limbs with textured bark and crowns of leaf cards whose normals bend out from the
// crown centre (soft, round shading); they sway in the wind. Every tree shape is drawn in one instanced batch per
// distance band: near trees in full detail casting shadows, middle trees in full detail, far trees in a light
// version, refilled only when the camera has moved or turned. Rocks and small plants are instanced per map chunk.
import * as THREE from 'three';
import { ENV, U, rng, hash2, keepCoverage } from './shared.js';
import { MB } from './mb.js';
import { mats } from './mats.js';
import { cardTex, canvasTex } from './tex.js';

// ---------- materials ----------
const leafMats = {};
export function leafMat(kind) {
  if (leafMats[kind]) return leafMats[kind];
  const glow = kind === 'wyrd';
  const m = new THREE.MeshStandardMaterial({ map: cardTex(kind), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, vertexColors: true });
  if (glow) { m.emissive = new THREE.Color(0xc060c0); m.emissiveIntensity = 0.55; m.emissiveMap = m.map; }
  m.alphaToCoverage = !!ENV.Q.msaa;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind; sh.uniforms.uSunDir = U.uSunDir; sh.uniforms.uSunCol = U.uSunCol;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; varying vec3 vLeafW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
        #else
          vec2 ip = modelMatrix[3].xz;
        #endif
        float hgt = max(position.y, 0.);
        float ph = uTime * 1.1 + ip.x * 0.37 + ip.y * 0.29;
        float sway = (sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.25) * uWind;
        transformed.x += sway * hgt * 0.016; transformed.z += cos(ph * 0.8) * uWind * hgt * 0.011;
        transformed += normal * sin(uTime * 5. + position.x * 4. + position.z * 3. + ip.x) * 0.03 * uWind;`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vLeafW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    // light shining through the leaves when the sun is behind them
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunDir; uniform vec3 uSunCol; varying vec3 vLeafW;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 Vd = normalize(vLeafW - cameraPosition); float back = pow(max(dot(Vd, normalize(uSunDir)), 0.), 3.);
          totalEmissiveRadiance += diffuseColor.rgb * uSunCol * back * .55; }`);
    keepCoverage(sh);
  };
  m.customProgramCacheKey = () => 'awleaf' + (glow ? 'g' : '');
  return (leafMats[kind] = m);
}
const plantMats = {};
export function plantMat(kind) {
  if (plantMats[kind]) return plantMats[kind];
  const m = new THREE.MeshStandardMaterial({ map: cardTex(kind), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, vertexColors: true });
  m.alphaToCoverage = !!ENV.Q.msaa;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
        #else
          vec2 ip = modelMatrix[3].xz;
        #endif
        float ph = uTime * 1.8 + ip.x * 0.7 + ip.y * 0.5; transformed.x += sin(ph) * position.y * 0.1 * uWind; transformed.z += cos(ph * 0.7) * position.y * 0.07 * uWind;`);
    keepCoverage(sh);
  };
  m.customProgramCacheKey = () => 'awplant';
  return (plantMats[kind] = m);
}
// ore nuggets: metallic, glinting as you move and as the light shifts (starmetal and orichalcum glow)
const oreMats = {};
export function oreMat(kind) {
  if (oreMats[kind]) return oreMats[kind];
  const spec = { iron: [0xc07a50, 0x000000, 0.25], starmetal: [0x9ad0ff, 0x3a8aff, 0.9], orichalcum: [0xffc060, 0xff8a10, 0.8] }[kind];
  const m = new THREE.MeshStandardMaterial({ color: spec[0], metalness: 0.85, roughness: 0.28, emissive: spec[1], emissiveIntensity: spec[2], flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOreW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vOreW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vOreW;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float tw = fract(sin(dot(floor(vOreW * 9.), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          float g = pow(max(sin(uTime * (2. + tw * 3.) + tw * 40. + dot(normalize(vOreW - cameraPosition), vec3(9.))), 0.), 24.);
          totalEmissiveRadiance += vec3(1., .95, .85) * g * 2.2 * step(.55, tw); }`);
  };
  m.customProgramCacheKey = () => 'awore';
  return (oreMats[kind] = m);
}

// ---------- tree builders ----------
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function cards(mb, key, cx, cy, cz, rad, n, size, R, crown, tint, droop = 0) {
  const g = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.cbrt(R()) * rad;
    const sx = Math.sqrt(1 - u * u) * Math.cos(a), sy = u, sz = Math.sqrt(1 - u * u) * Math.sin(a);
    const x = cx + sx * r, y = cy + sy * r * 0.75, z = cz + sz * r;
    const m = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * Math.PI - droop, R() * Math.PI * 2, R() * Math.PI, 'YXZ')), V3(size * (0.8 + R() * 0.4), size * (0.8 + R() * 0.4), 1));
    const start = mb.part(key).n;
    mb.add(key, g, m, tint ? tint(R) : null, 'local');
    const p = mb.part(key);
    for (let k = start; k < p.n; k++) { const px = p.pos[k * 3] - crown.x, py = p.pos[k * 3 + 1] - crown.y, pz = p.pos[k * 3 + 2] - crown.z; const l = Math.hypot(px, py, pz) || 1; p.nor[k * 3] = p.nor[k * 3] * 0.2 + (px / l) * 0.8; p.nor[k * 3 + 1] = p.nor[k * 3 + 1] * 0.2 + (py / l) * 0.8 + 0.2; p.nor[k * 3 + 2] = p.nor[k * 3 + 2] * 0.2 + (pz / l) * 0.8; }
    // darker deep inside the crown
    for (let k = start; k < p.n; k++) { const px = p.pos[k * 3] - crown.x, py = p.pos[k * 3 + 1] - crown.y, pz = p.pos[k * 3 + 2] - crown.z; const d = Math.min(1, Math.hypot(px, py * 1.2, pz) / (rad * 1.6 + 0.01)); const s = 0.6 + 0.4 * d; p.col[k * 3] *= s; p.col[k * 3 + 1] *= s; p.col[k * 3 + 2] *= s; }
  }
  g.dispose();
}
function limb(mb, key, a, b, r0, r1, col, seg = 7) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const L = Math.hypot(dx, dy, dz);
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, r1 < 0.08);
  const m = new THREE.Matrix4().compose(V3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(dx / L, dy / L, dz / L)), V3(1, 1, 1));
  mb.add(key, g, m, col); g.dispose();
}
const SPEC = {
  oak: { h: 4.0, crownR: 4.2, crownY: 7.2, r: 0.46, n: 10, bark: 'bark', bc: '#9a8a78', lean: 0.15, csz: 2.6 },
  aged: { h: 4.6, crownR: 4.6, crownY: 8.4, r: 0.58, n: 11, bark: 'bark', bc: '#6e6052', lean: 0.22, csz: 2.7 },
  birch: { h: 6.2, crownR: 2.6, crownY: 8.8, r: 0.22, n: 7, bark: 'birch', bc: '#ffffff', lean: 0.06, csz: 1.9 },
  willow: { h: 3.4, crownR: 4.0, crownY: 6.2, r: 0.48, n: 9, bark: 'bark', bc: '#7a6a5a', lean: 0.25, csz: 2.6 },
  wyrd: { h: 4.2, crownR: 3.6, crownY: 7.0, r: 0.5, n: 9, bark: 'bark', bc: '#5a4060', lean: 0.3, csz: 2.3 },
  bush: { h: 0, crownR: 1.15, crownY: 0.75, r: 0, n: 3, bark: 'bark', bc: '#5a4a3a', lean: 0, csz: 1.2 },
  thornbush: { h: 0, crownR: 1.0, crownY: 0.7, r: 0, n: 3, bark: 'bark', bc: '#5a4a3a', lean: 0, csz: 1.1 },
  mirebush: { h: 0, crownR: 1.1, crownY: 0.6, r: 0, n: 3, bark: 'bark', bc: '#5a4a3a', lean: 0, csz: 1.2 },
};
function broadleaf(kind, lod, seed) {
  const R = rng(seed); const mb = new MB();
  const spec = SPEC[kind];
  const trunkKey = spec.bark, leafKey = 'leaf';
  const top = V3(spec.lean * (R() - 0.5) * 2, spec.h, spec.lean * (R() - 0.5) * 2);
  if (spec.h > 0) {
    limb(mb, trunkKey, V3(0, -0.4, 0), V3(top.x * 0.5, spec.h * 0.55, top.z * 0.5), spec.r * 1.25, spec.r * 0.95, spec.bc, lod ? 6 : 9);
    limb(mb, trunkKey, V3(top.x * 0.5, spec.h * 0.55, top.z * 0.5), top, spec.r * 0.95, spec.r * 0.75, spec.bc, lod ? 6 : 9);
    if (!lod) for (let k = 0; k < 4; k++) { const a = k * 1.57 + R(); limb(mb, trunkKey, V3(Math.cos(a) * spec.r * 1.7, -0.25, Math.sin(a) * spec.r * 1.7), V3(0, spec.h * 0.2, 0), spec.r * 0.35, spec.r * 0.5, spec.bc, 5); }
  }
  const crown = V3(top.x, spec.crownY, top.z);
  const ends = [];
  for (let i = 0; i < spec.n; i++) {
    const a = (i / spec.n) * Math.PI * 2 + R() * 0.6, el = 0.35 + R() * 0.6;
    const len = spec.crownR * (0.65 + R() * 0.4);
    const s = V3(top.x * (0.6 + 0.4 * R()), spec.h * (0.62 + R() * 0.38), top.z * (0.6 + 0.4 * R()));
    const e = V3(s.x + Math.cos(a) * Math.cos(el) * len, s.y + Math.sin(el) * len * 0.9 + (kind === 'willow' ? 0.8 : 0), s.z + Math.sin(a) * Math.cos(el) * len);
    if (spec.h > 0 && (lod < 2) && (!lod || i % 2 === 0)) limb(mb, trunkKey, s, e, spec.r * 0.42, spec.r * 0.12, spec.bc, lod ? 4 : 6);
    ends.push(e);
  }
  const tint = (r) => new THREE.Color().setScalar(0.82 + r() * 0.3);
  const csz = spec.csz;
  if (lod === 2) {
    // far: a few large cards
    cards(mb, leafKey, crown.x, crown.y, crown.z, spec.crownR * 0.75, 9, csz * 2.6, R, crown, tint);
  } else {
    const per = lod ? 3 : spec.h ? 9 : 8;
    for (const e of ends) cards(mb, leafKey, e.x, e.y, e.z, spec.crownR * 0.45, per, csz * (lod ? 1.5 : 1), R, crown, tint, kind === 'willow' ? 0.6 : 0);
    cards(mb, leafKey, crown.x, crown.y, crown.z, spec.crownR * 0.7, lod ? 8 : spec.h ? 22 : 10, csz * (lod ? 1.6 : 1.1), R, crown, tint);
    if (kind === 'willow') for (let i = 0; i < (lod ? 6 : 18); i++) { const a = R() * 6.283, rr = spec.crownR * (0.6 + R() * 0.45); cards(mb, leafKey, crown.x + Math.cos(a) * rr, crown.y - 2.4, crown.z + Math.sin(a) * rr, 0.6, 1, 3.8, R, crown, tint); }
  }
  return { trunk: mb.geometry(trunkKey), leaves: mb.geometry(leafKey), trunkKey, leafKind: kind === 'aged' ? 'aged' : kind, height: spec.crownY + spec.crownR };
}
function conifer(lod, seed) {
  const R = rng(seed); const mb = new MB(); const H = 12 + R() * 3;
  limb(mb, 'pinebark', V3(0, -0.4, 0), V3(0, H, 0), 0.42, 0.06, '#a08e7e', lod ? 6 : 8);
  const tint = (r) => new THREE.Color().setScalar(0.82 + r() * 0.28);
  const levels = lod === 2 ? 4 : lod ? 7 : 13;
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2);
  for (let l = 0; l < levels; l++) {
    const t = l / (levels - 1); const y = 2.0 + t * (H - 2.4); const rad = (1 - t) * 3.4 + 0.5; const n = lod === 2 ? 4 : lod ? 5 : Math.max(5, Math.round(9 - t * 3));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + l * 0.7 + R() * 0.3; const droop = 0.35 + t * 0.2;
      const m = new THREE.Matrix4().compose(V3(0, y, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(droop, a, 0, 'YXZ')), V3(rad * 0.9 + 0.6, rad * 1.15 + 0.4, 1));
      const start = mb.part('leaf').n; mb.add('leaf', g, m, tint(R).multiplyScalar(0.75 + 0.35 * t), 'local');
      const p = mb.part('leaf'); for (let i = start; i < p.n; i++) { const px = p.pos[i * 3], pz = p.pos[i * 3 + 2]; const l2 = Math.hypot(px, pz) || 1; p.nor[i * 3] = px / l2 * 0.7; p.nor[i * 3 + 1] = 0.7; p.nor[i * 3 + 2] = pz / l2 * 0.7; }
    }
  }
  g.dispose();
  return { trunk: mb.geometry('pinebark'), leaves: mb.geometry('leaf'), trunkKey: 'pinebark', leafKind: 'pine', height: H };
}
function deadTree(charred, lod, seed) {
  const R = rng(seed); const mb = new MB(); const c = charred ? '#3a3230' : '#8a7a6a'; const H = 6 + R() * 2.5;
  limb(mb, 'bark', V3(0, -0.3, 0), V3(0.3, H, 0.1), 0.38, 0.1, c, 7);
  for (let i = 0; i < (lod ? 4 : 8); i++) { const a = R() * 6.283, s = V3(0.1, H * (0.4 + R() * 0.55), 0.05), L = 1.5 + R() * 2.2; const e = V3(s.x + Math.cos(a) * L, s.y + 0.6 + R() * 1.5, s.z + Math.sin(a) * L); limb(mb, 'bark', s, e, 0.13, 0.02, c, 5); if (!lod) limb(mb, 'bark', e, V3(e.x + Math.cos(a + 0.8) * 0.9, e.y + 0.7, e.z + Math.sin(a + 0.8) * 0.9), 0.04, 0.01, c, 4); }
  // hanging moss on mire snags
  if (!charred && !lod) for (let i = 0; i < 6; i++) { const a = R() * 6.283, y = H * (0.5 + R() * 0.4); cards(mb, 'leaf', Math.cos(a) * 1.2, y - 0.8, Math.sin(a) * 1.2, 0.3, 1, 1.6, R, V3(0, y, 0), () => new THREE.Color(0.8, 0.85, 0.7), 1.2); }
  return { trunk: mb.geometry('bark'), leaves: mb.geometry('leaf'), trunkKey: 'bark', leafKind: 'willow', height: H };
}
function palm(lod, seed) {
  const R = rng(seed); const mb = new MB(); const H = 7.5 + R() * 2; let prev = V3(0, -0.3, 0); const bend = 1.2 + R() * 0.8;
  const segs = lod ? 4 : 8;
  for (let k = 1; k <= segs; k++) { const t = k / segs; const p = V3(Math.sin(t * 1.4) * bend, t * H, 0); limb(mb, 'bark', prev, p, 0.3 - t * 0.1, 0.28 - t * 0.1, '#b09a7a', 7); prev = p; }
  const tip = prev; const g = new THREE.PlaneGeometry(1, 1, 1, 4); g.translate(0, 0.5, 0);
  const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, -y * y * 0.55); } g.computeVertexNormals();
  for (let k = 0; k < (lod ? 6 : 11); k++) { const a = (k / 11) * Math.PI * 2 + R() * 0.3; const m = new THREE.Matrix4().compose(tip, new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9 - R() * 0.3, a, 0, 'YXZ')), V3(1.5, 4.6, 4.6)); mb.add('leaf', g, m, new THREE.Color().setScalar(0.85 + R() * 0.25), 'local'); }
  g.dispose();
  return { trunk: mb.geometry('bark'), leaves: mb.geometry('leaf'), trunkKey: 'bark', leafKind: 'palm', height: H + 2 };
}

// ---------- rocks ----------
function rockGeom(seed, detail = 2, squash = 0.7) {
  const g = new THREE.IcosahedronGeometry(1, detail); const R = rng(seed); const p = g.attributes.position;
  const off = [R() * 10, R() * 10, R() * 10];
  const n3 = (x, y, z) => Math.sin(x * 1.7 + off[0]) * Math.sin(y * 1.9 + off[1]) * Math.sin(z * 1.5 + off[2]) + 0.5 * Math.sin(x * 3.7 + z * 2.1 + off[1]) * Math.sin(y * 3.3 + off[2]);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const f = 0.78 + n3(x, y, z) * 0.22; p.setXYZ(i, x * f * 1.15, y * f * squash + (y < 0 ? 0.15 : 0), z * f); }
  // flatten a few facets: rock breaks along planes
  for (let k = 0; k < 3; k++) { const nx = R() - 0.5, ny = R() * 0.6, nz = R() - 0.5; const l = Math.hypot(nx, ny, nz); const d = 0.72 + R() * 0.12; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const s = (x * nx + y * ny + z * nz) / l; if (s > d) { const c = s - d; p.setXYZ(i, x - nx / l * c, y - ny / l * c, z - nz / l * c); } } }
  g.computeVertexNormals();
  const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * 0.6 + p.getZ(i) * 0.4; uv[i * 2 + 1] = p.getY(i) * 0.7; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 0.82 + Math.max(0, y) * 0.25; c[i * 3] = k; c[i * 3 + 1] = k; c[i * 3 + 2] = k * 0.98; } g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  // moss on the tops
  for (let i = 0; i < p.count; i++) { const ny = g.attributes.normal.getY(i); if (ny > 0.65) { const k = (ny - 0.65) / 0.35 * 0.55; c[i * 3] *= 1 - k * 0.45; c[i * 3 + 1] *= 1 - k * 0.05; c[i * 3 + 2] *= 1 - k * 0.6; } }
  return g;
}
function nuggetGeom(rock, count, seed, crystal) {
  const r = rng(seed); const pos = [], nor = []; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3(), sc = new THREE.Vector3();
  const RP = rock.attributes.position, RN = rock.attributes.normal; const cand = [];
  for (let i = 0; i < RP.count; i++) if (RP.getY(i) > 0.05 && RN.getY(i) > -0.2) cand.push(i);
  for (let k = 0; k < count && cand.length; k++) {
    const vi = cand[Math.floor(r() * cand.length)]; const s = crystal ? 0.12 + r() * 0.14 : 0.1 + r() * 0.1;
    const g = crystal ? new THREE.CylinderGeometry(0, s * 0.6, s * 3.2, 5, 1) : new THREE.OctahedronGeometry(s, 0); g.translate(0, crystal ? s * 1.2 : 0, 0);
    v.set(RP.getX(vi), RP.getY(vi), RP.getZ(vi)); n.set(RN.getX(vi), RN.getY(vi), RN.getZ(vi)); v.addScaledVector(n, -s * 0.25);
    const qq = crystal ? q.setFromUnitVectors(V3(0, 1, 0), n.clone().add(V3((r() - 0.5) * 0.6, 0.4, (r() - 0.5) * 0.6)).normalize()) : q.setFromEuler(e.set(r() * 3, r() * 3, 0));
    m.compose(v, qq, sc.set(1, crystal ? 1 : 1.3, 1)); nm.getNormalMatrix(m);
    const gi = g.index ? g.toNonIndexed() : g; gi.computeVertexNormals();
    const P = gi.attributes.position, N = gi.attributes.normal;
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
}
// ---------- small plants: crossed cards ----------
const PG = {};
function plantGeom(kind) {
  const mb = new MB(); const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
  const sz = { flowers: [0.8, 0.6], fern: [1.4, 1.05], reeds: [1.0, 1.7], hemp: [1.2, 1.5], silkweed: [1.1, 1.2], swampgrass: [1.1, 0.9], drygrass: [1.0, 0.7] }[kind] || [1, 1];
  const n = 3;
  for (let k = 0; k < n; k++) { const m = new THREE.Matrix4().compose(V3(0, -0.03, 0), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), (k / n) * Math.PI), V3(sz[0], sz[1], 1)); mb.add('p', g, m, null, 'local'); }
  const out = mb.geometry('p'); const nor = out.attributes.normal; for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
  g.dispose(); return out;
}
function shroomGeom(seed) {
  const R = rng(seed); const mb = new MB();
  for (let k = 0; k < 4; k++) { const x = (R() - 0.5) * 0.5, z = (R() - 0.5) * 0.5, h = 0.1 + R() * 0.16, r = 0.06 + R() * 0.08;
    mb.cylB('paint', x, 0, z, r * 0.35, h, '#ece4d0', 8); mb.sph('paint', x, h, z, r * 2, r * 1.1, r * 2, k % 2 ? '#c03a26' : '#b8743a', 0, 8);
    if (k % 2) for (let s = 0; s < 3; s++) mb.sph('paint', x + (R() - 0.5) * r, h + r * 0.45, z + (R() - 0.5) * r, 0.025, 0.012, 0.025, '#f8f0e0', 0, 8); }
  return mb.geometry('paint');
}

// ---------- templates ----------
const TPL = {};
export const TREE_KINDS = ['oak', 'aged', 'birch', 'willow', 'pine', 'dead', 'charred', 'palm', 'wyrd'];
export function template(kind, lod, variant) {
  const key = kind + lod + ':' + variant; if (TPL[key]) return TPL[key];
  const seed = kind.length * 1000 + variant * 77 + 13 + kind.charCodeAt(0);
  let t;
  if (kind === 'pine') t = conifer(lod, seed);
  else if (kind === 'dead' || kind === 'charred') t = deadTree(kind === 'charred', lod, seed);
  else if (kind === 'palm') t = palm(lod, seed);
  else t = broadleaf(kind, lod, seed);
  return (TPL[key] = t);
}
export const VARIANTS = 2;

// ---------- the forest: one instanced batch per tree shape and distance band ----------
const forestRoot = new THREE.Group(); forestRoot.name = 'forest';
const trees = []; const batches = new Map();
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _fw = new THREE.Vector3();
export function addTree(kind, x, y, z, scale, rot, tint) {
  const variant = Math.floor(hash2(Math.round(x * 10), Math.round(z * 10), 3) * VARIANTS) % VARIANTS;
  _q.setFromAxisAngle(_up, rot); _p.set(x, y, z); _s.setScalar(scale);
  const m = new Float32Array(16); _m4.compose(_p, _q, _s).toArray(m);
  const tv = tint != null ? tint : 0.88 + hash2(Math.round(x), Math.round(z), 6) * 0.24;
  const t = { key: kind + ':' + variant, kind, variant, m, x, z, col: [tv, tv * (0.96 + hash2(Math.round(x), Math.round(z), 7) * 0.08), tv * 0.92], hidden: false };
  trees.push(t); forest.dirty = true;
  return t;
}
function bucketMesh(geom, mat, cap, shadow, colors) {
  const m = new THREE.InstancedMesh(geom, mat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (colors) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
  forestRoot.add(m); return m;
}
function batchFor(t) {
  let b = batches.get(t.key); if (b) return b;
  const lods = [template(t.kind, 0, t.variant), template(t.kind, 0, t.variant), template(t.kind, 1, t.variant), template(t.kind, 2, t.variant)];
  b = { lods, kind: t.kind, buckets: [0, 1, 2, 3].map(() => ({ trunk: null, leaves: null, cap: 0 })) };
  batches.set(t.key, b); return b;
}
function ensure(b, i, need) {
  const k = b.buckets[i]; if (k.cap >= need) return k;
  const cap = Math.max(16, Math.ceil(need * 1.5)); const tpl = b.lods[i];
  for (const part of ['trunk', 'leaves']) if (k[part]) { forestRoot.remove(k[part]); k[part].dispose(); k[part] = null; }
  if (tpl.trunk) { k.trunk = bucketMesh(tpl.trunk, mats.get(tpl.trunkKey), cap, i === 0, true); k.trunk.name = 'F:' + b.kind + i; }
  if (tpl.leaves) { k.leaves = bucketMesh(tpl.leaves, leafMat(tpl.leafKind), cap, i === 0, true); k.leaves.name = 'F:' + b.kind + i + 'L'; }
  k.cap = cap; return k;
}
// bands: 0 full detail casting shadows, 1 full detail, 2 light, 3 far cards
export const forest = {
  root: forestRoot, dirty: true, lx: 1e9, lz: 1e9, lfx: 0, lfz: 0, age: 0, drawn: 0,
  update(cam) {
    const q = ENV.Q; this.age++;
    ENV.camera.getWorldDirection(_fw); let fx = _fw.x, fz = _fw.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const moved = Math.hypot(cam.x - this.lx, cam.z - this.lz) > 5, turned = fx * this.lfx + fz * this.lfz < 0.92;
    if (!moved && !turned && !this.dirty && this.age < 90) return;
    this.dirty = false; this.lx = cam.x; this.lz = cam.z; this.lfx = fx; this.lfz = fz; this.age = 0;
    const far = q.treeFar || 300, near = q.treeNear || 60, shd = q.shadows ? q.treeShadow || 30 : 0, mid = q.treeMid || 160;
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(ENV.camera.fov) / 2) * ENV.camera.aspect);
    const minDot = Math.cos(Math.min(Math.PI, halfH + 0.55));
    const lists = new Map();
    for (const t of trees) {
      if (t.hidden) continue;
      const dx = t.x - cam.x, dz = t.z - cam.z, d = Math.hypot(dx, dz);
      if (d > far) continue;
      if (d > 16 && (dx * fx + dz * fz) / d < minDot) continue;
      const band = d < shd ? 0 : d < near ? 1 : d < mid ? 2 : 3;
      let L = lists.get(t.key); if (!L) lists.set(t.key, (L = [[], [], [], []]));
      L[band].push(t);
    }
    let drawn = 0;
    for (const [key, L] of lists) {
      const b = batchFor(L[0][0] || L[1][0] || L[2][0] || L[3][0]);
      for (let i = 0; i < 4; i++) {
        const arr = L[i]; if (!arr.length && !b.buckets[i].cap) continue;
        const k = ensure(b, i, arr.length);
        for (const part of ['trunk', 'leaves']) {
          const m = k[part]; if (!m) continue;
          const A = m.instanceMatrix.array, C = m.instanceColor.array;
          for (let j = 0; j < arr.length; j++) { const t = arr[j]; A.set(t.m, j * 16); C[j * 3] = t.col[0]; C[j * 3 + 1] = t.col[1]; C[j * 3 + 2] = t.col[2]; }
          m.count = arr.length; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
        }
        drawn += arr.length;
      }
    }
    for (const [key, b] of batches) if (!lists.has(key)) for (const k of b.buckets) for (const part of ['trunk', 'leaves']) if (k[part]) k[part].count = 0;
    this.drawn = drawn;
  },
};

// ---------- static instanced scatter (rocks, bushes, plants), split into map chunks ----------
const CHUNK = 100;
const statics = []; // { mesh, x, z, far }
function chunked(list, fn) { const ch = new Map(); for (const it of list) { const k = Math.floor(it[0] / CHUNK) + ',' + Math.floor(it[2] / CHUNK); if (!ch.has(k)) ch.set(k, []); ch.get(k).push(it); } for (const part of ch.values()) fn(part); }
// list items: [x, y, z, scale, rot, tintR?, tintG?, tintB?, sx?, sy?, cell?]; far: draw distance
export function scatterMesh(geom, mat, list, { far = 200, shadow = false, sy = 1, colors = false, cells = false } = {}) {
  if (!list.length) return;
  chunked(list, (part) => {
    let g = geom;
    if (cells) { g = new THREE.BufferGeometry(); for (const k in geom.attributes) g.setAttribute(k, geom.attributes[k]); g.setIndex(geom.index); g.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(part.map((it) => it[10] || 0)), 1)); }
    const im = new THREE.InstancedMesh(g, mat, part.length); im.castShadow = shadow; im.receiveShadow = true; im.name = 'S:' + (mat.name || mat.customProgramCacheKey());
    let cx = 0, cz = 0;
    part.forEach((it, i) => {
      const [x, y, z, sc, rot] = it; cx += x; cz += z;
      _q.setFromAxisAngle(_up, rot); _p.set(x, y, z); _s.set(sc * (it[8] || 1), sc * sy * (it[9] || 1), sc * (it[8] || 1)); im.setMatrixAt(i, _m4.compose(_p, _q, _s));
      if (colors) im.setColorAt(i, new THREE.Color(it[5] ?? 1, it[6] ?? 1, it[7] ?? 1));
    });
    im.computeBoundingSphere(); if (im.instanceColor) im.instanceColor.needsUpdate = true;
    ENV.scene.add(im); statics.push({ mesh: im, x: cx / part.length, z: cz / part.length, far, r: im.boundingSphere.radius });
  });
}
export function updateStatics(cam) {
  const mul = ENV.Q.detailMul || 1;
  for (const s of statics) s.mesh.visible = Math.hypot(s.x - cam.x, s.z - cam.z) < s.far * mul + Math.min(s.r, CHUNK * 0.75);
}
const RG = {};
// rock shapes: detail 2 for the ore veins up close, detail 1 for boulders, detail 0 for pebbles
export function rockShape(v, detail = 2) { const k = v + ':' + detail; return RG[k] || (RG[k] = rockGeom(v * 31 + 5, detail, 0.62 + (v % 2) * 0.12)); }
export function rocks(list, opts = {}) {
  const nv = opts.pebbles ? 1 : 2;
  for (let v = 0; v < nv; v++) { const items = list.filter((it, i) => (i % nv) === v); scatterMesh(rockShape(v, opts.pebbles ? 0 : 1), mats.get('rock'), items, { far: opts.far || 260, shadow: opts.shadow !== false, colors: true }); }
}
// every small plant kind in one atlas, one instanced mesh per chunk
export const PLANT_KINDS = ['fern', 'flowers', 'reeds', 'swampgrass', 'drygrass'];
const PLANT_SIZE = { flowers: [0.8, 0.6], fern: [1.4, 1.05], reeds: [1.0, 1.7], swampgrass: [1.1, 0.9], drygrass: [1.0, 0.7] };
let plantAtlasMat = null;
function plantAtlas() {
  if (plantAtlasMat) return plantAtlasMat;
  const n = PLANT_KINDS.length;
  const tex = canvasTex(256 * n, 256, (c) => PLANT_KINDS.forEach((k, i) => c.drawImage(cardTex(k).userData.canvas, 256 * i, 0, 256, 256)), true, true);
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, vertexColors: true });
  m.alphaToCoverage = !!ENV.Q.msaa;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uWind; attribute float aCell;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMapUv.x = (vMapUv.x * .98 + .01 + aCell) / ${n}.;
        vec2 ip = instanceMatrix[3].xz;
        float ph = uTime * 1.8 + ip.x * 0.7 + ip.y * 0.5; transformed.x += sin(ph) * position.y * 0.1 * uWind; transformed.z += cos(ph * 0.7) * position.y * 0.07 * uWind;`);
    keepCoverage(sh, 1280);
  };
  m.customProgramCacheKey = () => 'awplants';
  return (plantAtlasMat = m);
}
// items: [x, y, z, scale, rot, r, g, b] with kind given per item in it[11]
export function plants(items, far = 90) {
  const g = PG.cross || (PG.cross = plantGeom('unit'));
  for (const it of items) { const k = it[11]; const sz = PLANT_SIZE[k]; it[8] = sz[0]; it[9] = sz[1]; it[10] = PLANT_KINDS.indexOf(k); }
  scatterMesh(g, plantAtlas(), items, { far, colors: true, cells: true });
}
export function bushes(list, far = 160) {
  for (let v = 0; v < 2; v++) {
    const t = TPL['bush' + v] || (TPL['bush' + v] = broadleaf('bush', 0, 400 + v * 31));
    const items = list.filter((it, i) => i % 2 === v);
    scatterMesh(t.leaves, leafMat('bush'), items, { far, shadow: ENV.Q.shadows >= 2048, colors: true });
  }
}
export function shrooms(list) { scatterMesh(PG.shroom || (PG.shroom = shroomGeom(7)), mats.get('paint'), list, { far: 60 }); }

// ---------- gathering nodes: real Object3D handles (visible, position, rotation) drawn by instanced batches ----------
const nodeBatches = new Map(); // type -> { parts: [[geom, mat]], items: [obj] , meshes: [] }
let woodMark = null;
function nodeParts(type) {
  if (type === 'tree' || type === 'aged_tree' || type === 'wyrd_tree') {
    const kind = type === 'tree' ? 'oak' : type === 'aged_tree' ? 'aged' : 'wyrd';
    const t = template(kind, 0, type === 'tree' ? 1 : 2);
    // a woodsman's blaze: a pale notch cut into the trunk marks a tree you can fell
    const mb = new MB(); const spec = SPEC[kind];
    mb.box('planks', 0, 1.25, spec.r * 1.05, spec.r * 0.9, 0.55, 0.12, '#e8d0a0', 0, 0.12, 0);
    mb.box('planks', 0, 1.0, spec.r * 1.08, spec.r * 0.7, 0.2, 0.1, '#f0dcb0', 0, -0.3, 0);
    for (let k = 0; k < 6; k++) { const a = k * 1.1; mb.box('planks', Math.cos(a) * (spec.r + 0.5 + (k % 3) * 0.25), 0.03, Math.sin(a) * (spec.r + 0.5 + (k % 2) * 0.3), 0.18, 0.04, 0.08, '#d8b880', a); }
    woodMark = woodMark || mb.parts2();
    const parts = [[t.trunk, mats.get(t.trunkKey)], [t.leaves, leafMat(t.leafKind)], ...woodMark.map(([g, m]) => [g, m])];
    return parts;
  }
  if (type === 'iron' || type === 'starmetal' || type === 'orichalcum') {
    const v = type === 'iron' ? 0 : type === 'starmetal' ? 1 : 2;
    const rock = rockShape(v);
    const nug = nuggetGeom(rock, type === 'iron' ? 26 : 18, 40 + v, type !== 'iron');
    return [[rock, mats.get('rock'), 1.35], [nug, oreMat(type), 1.35]];
  }
  const kind = type === 'silkweed' ? 'silkweed' : 'hemp';
  return [[PG[kind] || (PG[kind] = plantGeom(kind)), plantMat(kind), 1.0]];
}
export function addNodeVisual(type, x, y, z, rot) {
  let b = nodeBatches.get(type);
  if (!b) { b = { parts: nodeParts(type), items: [], meshes: [] }; nodeBatches.set(type, b); }
  const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.y = rot; o.userData.nodeType = type;
  const s = type === 'tree' ? 1.0 : type === 'aged_tree' ? 1.1 : type === 'wyrd_tree' ? 1.05 : type === 'iron' || type === 'starmetal' || type === 'orichalcum' ? 1.3 : 1;
  o.scale.setScalar(s);
  ENV.scene.add(o); b.items.push(o);
  return o;
}
export function oreNuggets(kind) { const v = kind === 'iron' ? 0 : kind === 'starmetal' ? 1 : 2; return nuggetGeom(rockShape(v), kind === 'iron' ? 26 : 18, 40 + v, kind !== 'iron'); }
// stumps left behind by felled trees
let stumpParts = null;
export function addStumpVisual(x, y, z, rot) {
  if (!stumpParts) { const mb = new MB(); mb.cylB('bark', 0, -0.25, 0, 0.5, 0.85, '#7a5a3a', 12, 0.44); mb.cyl('planks', 0, 0.61, 0, 0.42, 0.04, '#d8b884', 16); for (let k = 0; k < 5; k++) { const a = k * 1.3; mb.box('planks', Math.cos(a) * 0.8, 0.04, Math.sin(a) * 0.8, 0.22, 0.05, 0.09, '#d0ac78', a); } stumpParts = mb.parts2(); nodeBatches.set('stump', { parts: stumpParts.map(([g, m]) => [g, m]), items: [], meshes: [] }); }
  const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.y = rot; ENV.scene.add(o); nodeBatches.get('stump').items.push(o);
  return o;
}
export function updateNodes(cam) {
  for (const b of nodeBatches.values()) {
    if (!b.meshes.length) {
      for (const [g, m] of b.parts) {
        const im = new THREE.InstancedMesh(g, m, b.items.length); im.name = 'N:' + (b.items[0] && b.items[0].userData.nodeType || 'stump'); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        ENV.scene.add(im); b.meshes.push(im);
      }
    }
    let n = 0;
    for (const o of b.items) {
      if (!o.visible) continue;
      if (Math.abs(o.position.x - cam.x) > 170 || Math.abs(o.position.z - cam.z) > 170) continue;
      o.updateMatrixWorld();
      for (const im of b.meshes) im.instanceMatrix.array.set(o.matrixWorld.elements, n * 16);
      n++;
    }
    for (const im of b.meshes) { im.count = n; im.instanceMatrix.needsUpdate = true; }
  }
}
export function vegStats() { let n = 0; for (const b of nodeBatches.values()) n += b.items.length; return { trees: trees.length, nodes: n, statics: statics.length }; }
export function initForest() { ENV.scene.add(forestRoot); }
export { trees as allTrees };
