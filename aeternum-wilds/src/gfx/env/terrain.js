// Aeternum Wilds — the island's ground: a heightfield sampled once on a 1.1 m grid, drawn as chunked meshes with
// crack-free levels of detail, and shaded per pixel: a normal map of the heightfield (no low-poly facets), eight
// splatted ground layers blended by height (grass, thorn grass, forest litter, dirt, cobbles, sand, mud, ash) plus
// rock wherever no layer claims the ground and on steep slopes, a macro tint, baked canopy shade, wet sand at
// the waterline and a seabed under the sea. Grass (grass.js) and water (water.js) read the same textures.
import * as THREE from 'three';
import { ENV, U, clamp } from './shared.js';
import { makeTerrainArrays, TERRAIN_LAYERS } from './tex.js';

const L = Object.fromEntries(TERRAIN_LAYERS.map((n, i) => [n, i]));
export const SPLAT = ['grass', 'darkgrass', 'forest', 'dirt', 'cobble', 'sand', 'mud', 'ash'];

export const TER = {
  size: 700, n: 641, half: 350, cell: 700 / 640,
  heights: null, splat: null, macro: null,
  hTex: null, nTex: null, s0: null, s1: null, mTex: null,
  group: new THREE.Group(), chunks: [], mat: null,
};
TER.group.name = 'terrain';

// ---------- the grid ----------
// classify(x, z, out) fills out.h (height), out.w[0..7] (splat weights, sum <= 1; the rest is rock) and
// out.tint [r,g,b] (macro colour, 1 = unchanged)
export function initGrid(classify) {
  const N = TER.n, H = TER.half, C = TER.cell;
  TER.heights = new Float32Array(N * N);
  TER.splat = new Uint8Array(N * N * 8);
  TER.macro = new Uint8Array(N * N * 4);
  const out = { h: 0, w: new Float32Array(8), tint: [1, 1, 1] };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -H + i * C, z = -H + j * C, k = j * N + i;
    out.w.fill(0); out.tint[0] = out.tint[1] = out.tint[2] = 1;
    classify(x, z, out);
    TER.heights[k] = out.h;
    let s = 0; for (let q = 0; q < 8; q++) s += out.w[q];
    const sc = s > 1 ? 1 / s : 1;
    for (let q = 0; q < 8; q++) TER.splat[k * 8 + q] = Math.round(clamp(out.w[q] * sc, 0, 1) * 255);
    TER.macro[k * 4] = Math.round(clamp(out.tint[0] * 0.5, 0, 1) * 255);
    TER.macro[k * 4 + 1] = Math.round(clamp(out.tint[1] * 0.5, 0, 1) * 255);
    TER.macro[k * 4 + 2] = Math.round(clamp(out.tint[2] * 0.5, 0, 1) * 255);
    TER.macro[k * 4 + 3] = 255;
  }
}
// the grid height (bilinear), close to heightAt but from the drawn mesh
export function gridHeight(x, z) {
  const N = TER.n, gx = clamp((x + TER.half) / TER.cell, 0, N - 1.001), gz = clamp((z + TER.half) / TER.cell, 0, N - 1.001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, Hh = TER.heights;
  const a = Hh[j * N + i], b = Hh[j * N + i + 1], c = Hh[(j + 1) * N + i], d = Hh[(j + 1) * N + i + 1];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}
function forDisc(x, z, r, fn) {
  const N = TER.n, C = TER.cell, H = TER.half;
  const i0 = Math.max(0, Math.floor((x - r + H) / C)), i1 = Math.min(N - 1, Math.ceil((x + r + H) / C));
  const j0 = Math.max(0, Math.floor((z - r + H) / C)), j1 = Math.min(N - 1, Math.ceil((z + r + H) / C));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const dx = -H + i * C - x, dz = -H + j * C - z, d = Math.hypot(dx, dz) / r;
    if (d < 1) fn(j * N + i, d);
  }
}
// darken the ground under a canopy (baked soft shade: grounds the trees beyond the shadow map's reach)
export function stampShade(x, z, r, k) {
  forDisc(x, z, r, (i, d) => { const f = 1 - k * (1 - d * d) * (1 - d * d); const a = TER.macro[i * 4 + 3]; TER.macro[i * 4 + 3] = Math.round(a * f); });
}
// paint a splat layer into a disc (paths, camps, scorched ground)
export function stampLayer(x, z, r, layer, k = 1) {
  const li = SPLAT.indexOf(layer);
  forDisc(x, z, r, (i, d) => {
    const t = k * Math.min(1, (1 - d) * 2.2); if (t <= 0) return;
    for (let q = 0; q < 8; q++) { const v = TER.splat[i * 8 + q] / 255; TER.splat[i * 8 + q] = Math.round(255 * (q === li ? v + (1 - v) * t : v * (1 - t))); }
  });
}

// ---------- material ----------
function makeMaterial(arrays) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tAlb: { value: arrays.albedo }, tNrm: { value: arrays.normal }, tS0: { value: TER.s0 }, tS1: { value: TER.s1 }, tMac: { value: TER.mTex }, tGN: { value: TER.nTex }, uMap: { value: new THREE.Vector3(TER.half, TER.cell, TER.n) }, uTime: U.uTime });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      precision highp sampler2DArray;
      uniform sampler2DArray tAlb; uniform sampler2DArray tNrm; uniform sampler2D tS0; uniform sampler2D tS1; uniform sampler2D tMac; uniform sampler2D tGN; uniform vec3 uMap; uniform float uTime;
      varying vec3 vWPos;
      float th(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float tn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(th(i), th(i + vec2(1, 0)), u.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), u.x), u.y); }
      vec3 gN; float gRough;
    `).replace('#include <map_fragment>', `
      vec2 muv = ((vWPos.xz + uMap.x) / uMap.y + .5) / uMap.z;
      vec3 N0 = normalize(texture(tGN, muv).xyz * 2. - 1.);
      // borders between layers wander in natural curves: the splat lookup is warped by two octaves of noise
      vec2 wq = vWPos.xz;
      vec2 warp = (vec2(tn(wq * .31 + 11.), tn(wq.yx * .31 - 5.3)) - .5) * 1.5 + (vec2(tn(wq * 1.3), tn(wq.yx * 1.3 + 7.1)) - .5) * .5;
      vec2 suv = muv + warp / (uMap.y * uMap.z);
      vec4 s0 = texture(tS0, suv), s1 = texture(tS1, suv);
      float w[9]; w[0] = s0.r; w[1] = s0.g; w[2] = s0.b; w[3] = s0.a; w[4] = s1.r; w[5] = s1.g; w[6] = s1.b; w[7] = s1.a;
      w[8] = max(0., 1. - (s0.r + s0.g + s0.b + s0.a + s1.r + s1.g + s1.b + s1.a));
      // steep ground and the seabed
      float slope = 1. - N0.y;
      float cliff = smoothstep(.18, .34, slope);
      float under = smoothstep(.15, -.9, vWPos.y);
      vec2 uv = vWPos.xz / 3.1;
      vec2 ddx = dFdx(uv), ddy = dFdy(uv);
      vec4 A[9]; float hw[9]; float mx = 0.;
      for (int i = 0; i < 9; i++) {
        A[i] = vec4(0.); hw[i] = 0.;
        if (w[i] > .004) { float li = i == 8 ? ${L.rock}. : float(i); A[i] = textureGrad(tAlb, vec3(uv, li), ddx, ddy); hw[i] = w[i] + A[i].a * .45 * min(1., w[i] * 3.); mx = max(mx, hw[i]); }
      }
      vec4 alb = vec4(0.); vec4 nrm = vec4(0.); float bsum = 0.;
      for (int i = 0; i < 9; i++) {
        float b = max(hw[i] - (mx - .28), 0.);
        if (b > 0.) { float li = i == 8 ? ${L.rock}. : float(i); alb += A[i] * b; nrm += textureGrad(tNrm, vec3(uv, li), ddx, ddy) * b; bsum += b; }
      }
      alb /= max(bsum, 1e-4); nrm /= max(bsum, 1e-4);
      vec3 tN = nrm.xyz * 2. - 1.; float rough = nrm.a;
      vec3 Tt = normalize(vec3(1., 0., 0.) - N0 * N0.x), Bt = normalize(vec3(0., 0., 1.) - N0 * N0.z);
      vec3 nW = normalize(Tt * tN.x * 1.25 + Bt * tN.y * 1.25 + N0 * tN.z);
      // cliffs: triplanar rock on steep faces
      if (cliff > .001) {
        vec3 bwt = pow(abs(N0), vec3(4.)); bwt /= bwt.x + bwt.y + bwt.z;
        float rl = ${L.rock}.;
        vec4 cx = texture(tAlb, vec3(vWPos.zy / 5.5, rl)), cy = texture(tAlb, vec3(vWPos.xz / 5.5, rl)), cz = texture(tAlb, vec3(vWPos.xy / 5.5, rl));
        vec4 ca = cx * bwt.x + cy * bwt.y + cz * bwt.z;
        vec4 nx = texture(tNrm, vec3(vWPos.zy / 5.5, rl)), nz = texture(tNrm, vec3(vWPos.xy / 5.5, rl));
        vec3 pn = normalize(N0 + (vec3(0., nx.y * 2. - 1., nx.x * 2. - 1.) * bwt.x + vec3(nz.x * 2. - 1., nz.y * 2. - 1., 0.) * bwt.z) * 1.2);
        alb.rgb = mix(alb.rgb, ca.rgb, cliff); nW = normalize(mix(nW, pn, cliff)); rough = mix(rough, .86, cliff);
      }
      // under the sea: a pale seabed fading to blue-green with depth; wet sand along the waterline
      if (under > .001) { vec4 sb = textureGrad(tAlb, vec3(uv, ${L.seabed}.), ddx, ddy); alb.rgb = mix(alb.rgb, sb.rgb * mix(vec3(1.), vec3(.55, .78, .8), smoothstep(-.5, -6., vWPos.y)), under); }
      float wet = smoothstep(.75, .05, vWPos.y) * (1. - under);
      alb.rgb *= 1. - wet * .32; rough = mix(rough, .3, wet);
      // macro tint, broad light and dark patches, and the baked canopy shade
      vec4 mac = texture(tMac, muv);
      float macro = tn(vWPos.xz * .045) * .6 + tn(vWPos.xz * .17) * .4;
      alb.rgb *= mac.rgb * 2. * (.86 + .28 * macro);
      alb.rgb *= mix(.45, 1., mac.a);
      gN = nW; gRough = rough;
      diffuseColor.rgb *= alb.rgb;
    `).replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gN, 0.)).xyz);');
  };
  m.customProgramCacheKey = () => 'awterrain';
  return m;
}

// ---------- textures from the grid ----------
function makeTextures() {
  const N = TER.n, Hh = TER.heights;
  // heights as a half-float texture with hardware filtering (grass and water read it)
  const half = new Uint16Array(N * N);
  for (let i = 0; i < N * N; i++) half[i] = THREE.DataUtils.toHalfFloat(Hh[i]);
  TER.hTex = new THREE.DataTexture(half, N, N, THREE.RedFormat, THREE.HalfFloatType);
  TER.hTex.minFilter = TER.hTex.magFilter = THREE.LinearFilter; TER.hTex.generateMipmaps = false; TER.hTex.needsUpdate = true;
  // normals of the heightfield
  const nd = new Uint8Array(N * N * 4), C = TER.cell;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const hl = Hh[j * N + Math.max(0, i - 1)], hr = Hh[j * N + Math.min(N - 1, i + 1)], hd = Hh[Math.max(0, j - 1) * N + i], hu = Hh[Math.min(N - 1, j + 1) * N + i];
    const dx = (hr - hl) / (2 * C), dz = (hu - hd) / (2 * C); const l = Math.hypot(dx, 1, dz);
    const k = (j * N + i) * 4; nd[k] = Math.round((-dx / l * 0.5 + 0.5) * 255); nd[k + 1] = Math.round((1 / l * 0.5 + 0.5) * 255); nd[k + 2] = Math.round((-dz / l * 0.5 + 0.5) * 255); nd[k + 3] = 255;
  }
  const mk = (data) => { const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType); t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t; };
  TER.nTex = mk(nd);
  const a = new Uint8Array(N * N * 4), b = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) for (let q = 0; q < 4; q++) { a[i * 4 + q] = TER.splat[i * 8 + q]; b[i * 4 + q] = TER.splat[i * 8 + 4 + q]; }
  TER.s0 = mk(a); TER.s1 = mk(b); TER.mTex = mk(TER.macro);
}

// ---------- chunk meshes with levels of detail (after Kingdom Rising 3D's terrain.js) ----------
const CH = 80, NC = 8; // 8 x 8 chunks of 80 cells (87.5 m)
let sharedIndex = null; const lodIndexes = new Map();
function chunkIndex() {
  if (sharedIndex) return sharedIndex;
  const idx = []; const n = CH + 1;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) { const a = y * n + x, b = a + 1, c = a + n, d = c + 1; if ((x + y) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b); }
  return (sharedIndex = new THREE.BufferAttribute(new Uint16Array(idx), 1));
}
// coarser chunks keep every vertex along their borders so neighbours of any detail meet without cracks
function lodIndex(s) {
  if (s === 1) return chunkIndex();
  if (lodIndexes.has(s)) return lodIndexes.get(s);
  const idx = []; const n = CH + 1; const v = (x, y) => y * n + x;
  for (let y = 0; y < CH; y += s) for (let x = 0; x < CH; x += s) {
    const x1 = x + s, y1 = y + s; const edge = x === 0 || y === 0 || x1 === CH || y1 === CH;
    if (!edge) { if (((x + y) / s) & 1) idx.push(v(x, y), v(x, y1), v(x1, y), v(x1, y), v(x, y1), v(x1, y1)); else idx.push(v(x, y), v(x, y1), v(x1, y1), v(x, y), v(x1, y1), v(x1, y)); continue; }
    const c = v(x + s / 2, y + s / 2); const ring = [];
    const side = (ax, ay, bx, by, full) => { const st = full ? 1 : s; const dx = Math.sign(bx - ax), dy = Math.sign(by - ay); for (let k = 0; k < s; k += st) ring.push(v(ax + dx * k, ay + dy * k)); };
    side(x, y, x, y1, x === 0); side(x, y1, x1, y1, y1 === CH); side(x1, y1, x1, y, x1 === CH); side(x1, y, x, y, y === 0);
    for (let k = 0; k < ring.length; k++) idx.push(c, ring[k], ring[(k + 1) % ring.length]);
  }
  const a = new THREE.BufferAttribute(new Uint16Array(idx), 1); lodIndexes.set(s, a); return a;
}
function chunkGeom(cx, cz) {
  const n = CH + 1, N = TER.n, Hh = TER.heights, C = TER.cell, H = TER.half;
  const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3);
  let minY = 1e9, maxY = -1e9;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const gi = Math.min(N - 1, cx * CH + i), gj = Math.min(N - 1, cz * CH + j), k = j * n + i;
    const h = Hh[gj * N + gi];
    pos[k * 3] = -H + gi * C; pos[k * 3 + 1] = h; pos[k * 3 + 2] = -H + gj * C;
    const dx = (Hh[gj * N + Math.min(N - 1, gi + 1)] - Hh[gj * N + Math.max(0, gi - 1)]) / (2 * C), dz = (Hh[Math.min(N - 1, gj + 1) * N + gi] - Hh[Math.max(0, gj - 1) * N + gi]) / (2 * C);
    const l = Math.hypot(dx, 1, dz); nor[k * 3] = -dx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -dz / l;
    if (h < minY) minY = h; if (h > maxY) maxY = h;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(chunkIndex());
  g.boundingBox = new THREE.Box3(new THREE.Vector3(pos[0], minY, pos[2]), new THREE.Vector3(pos[pos.length - 3], maxY, pos[pos.length - 1]));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  return { g, minY, maxY };
}

export function finishTerrain() {
  const arrays = makeTerrainArrays(ENV.Q.texSize || 512);
  makeTextures();
  TER.mat = makeMaterial(arrays);
  for (let cz = 0; cz < NC; cz++) for (let cx = 0; cx < NC; cx++) {
    const { g, minY, maxY } = chunkGeom(cx, cz);
    if (maxY < -4.2) { g.dispose(); continue; } // deep sea floor: the water hides it
    const m = new THREE.Mesh(g, TER.mat); m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false; m.name = 'ground';
    TER.group.add(m);
    TER.chunks.push({ cx, cz, mesh: m, lods: [g], lod: 0, x: (g.boundingBox.min.x + g.boundingBox.max.x) / 2, z: (g.boundingBox.min.z + g.boundingBox.max.z) / 2 });
  }
  ENV.scene.add(TER.group);
}
function lodGeom(c, l) {
  if (c.lods[l]) return c.lods[l];
  const g0 = c.lods[0]; const g = new THREE.BufferGeometry();
  for (const k in g0.attributes) g.setAttribute(k, g0.attributes[k]);
  g.setIndex(lodIndex(1 << l)); g.boundingBox = g0.boundingBox; g.boundingSphere = g0.boundingSphere;
  return (c.lods[l] = g);
}
// detail by distance (with some give so a chunk at the boundary does not flip back and forth)
export function updateTerrain(cam) {
  const q = ENV.Q, bias = q.terrainLod || 0;
  const far = [45 / (1 + bias), 120 / (1 + bias), 260 / (1 + bias)], give = 8;
  for (const c of TER.chunks) {
    const d = Math.max(0, Math.hypot(c.x - cam.x, c.z - cam.z) - CH * TER.cell * 0.71);
    const cur = c.lod;
    let l = 0; for (let k = 0; k < 3; k++) if (d > far[k] + (cur > k ? -give : give)) l = k + 1;
    if (l !== cur) { c.lod = l; c.mesh.geometry = lodGeom(c, l); }
  }
}
