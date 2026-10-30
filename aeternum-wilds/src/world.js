import * as THREE from 'three';
import { G } from './state.js';
import { ZONES, NODES } from './data.js';
import { clamp, lerp, smooth, fbm, noise, rng, angDiff } from './util.js';
import { mergeStatic, templateParts, mat, box, makeTree, makeRock, makePlant, makeHouse, makeFlag, makeHumanoid, makeWeapon, makeFern, makeShroom, makeBarrel, makeCrate, makeTorch, makeFence } from './models.js';

export const ISLAND_R = 300;
const TOWN_R = 42, RING_R = 108;
const SECTORS = { thorn: 0, coast: Math.PI / 2, ruins: Math.PI, mire: -Math.PI / 2 };

export const POI = {
  wreck: { x: 6, z: 252, name: 'The Great Wreck' },
  hut: { x: 0, z: -236, name: 'Hag\'s Hut' },
  shrine: { x: -244, z: 0, name: 'Warden\'s Shrine' },
  lostcamp: { x: 205, z: 30, name: 'Lost Encampment' },
};
const PADS = [
  { x: POI.wreck.x, z: POI.wreck.z - 6, r: 24, h: 1.4 },
  { x: POI.hut.x, z: POI.hut.z, r: 18, h: 1.0 },
  { x: POI.shrine.x, z: POI.shrine.z, r: 28, h: 3.0 },
];

function coastR(x, z) {
  const a = Math.atan2(z, x);
  return ISLAND_R + noise(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10) * 22;
}

export function sectorWeights(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const outer = smooth(RING_R - 14, RING_R + 14, r);
  const w = {};
  let sum = 0;
  for (const k in SECTORS) { const d = Math.abs(angDiff(a, SECTORS[k])); const v = Math.pow(Math.max(0, 1 - d / (Math.PI / 2)), 2.2); w[k] = v; sum += v; }
  for (const k in SECTORS) w[k] = w[k] / sum * outer;
  w.meadow = 1 - outer;
  return w;
}

export function zoneAt(x, z) {
  const r = Math.hypot(x, z);
  if (r < TOWN_R) return 'town';
  if (r < RING_R) return 'meadow';
  const a = Math.atan2(z, x);
  let best = 'thorn', bd = 9;
  for (const k in SECTORS) { const d = Math.abs(angDiff(a, SECTORS[k])); if (d < bd) { bd = d; best = k; } }
  return best;
}

export function levelAt(x, z) {
  const zn = zoneAt(x, z), Z = ZONES[zn];
  const r = Math.hypot(x, z);
  const t = zn === 'meadow' ? clamp((r - TOWN_R) / (RING_R - TOWN_R), 0, 1) : clamp((r - RING_R) / (ISLAND_R - 40 - RING_R), 0, 1);
  return Math.round(lerp(Z.lv[0], Z.lv[1], t));
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const w = sectorWeights(x, z);
  let h = 2.6 + fbm(x * 0.011, z * 0.011, 4) * 4.5 + fbm(x * 0.045, z * 0.045, 2) * 0.7;
  // zone shapes
  const mireH = 0.55 + fbm(x * 0.03 + 50, z * 0.03, 3) * 1.6;
  h = lerp(h, mireH, w.mire);
  const ruinsH = 3.2 + fbm(x * 0.02 + 7, z * 0.02 - 3, 4) * 6 + Math.abs(noise(x * 0.06, z * 0.06)) * 1.5;
  h = lerp(h, ruinsH, w.ruins);
  const thornH = 3.0 + fbm(x * 0.016 - 20, z * 0.016, 4) * 5.5;
  h = lerp(h, thornH, w.thorn);
  // town is flat
  h = lerp(2.4, h, smooth(TOWN_R - 8, TOWN_R + 12, r));
  for (const p of PADS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) h = lerp(p.h, h, smooth(p.r * 0.5, p.r, d)); }
  // the sea
  const cr = coastR(x, z);
  h -= smooth(cr - 40, cr + 6, r) * 10;
  return h;
}

export function walkable(x, z) { return heightAt(x, z) > -0.7; }

// ---------- Colliders (spatial grid) ----------
const CELL = 10;
function mkGrid() { return new Map(); }
function cellKey(cx, cz) { return cx * 10007 + cz; }
export function addCollider(c) {
  // c: {x,z,r} or {minX,maxX,minZ,maxZ}
  const g = G.colliders;
  const minX = c.r != null ? c.x - c.r : c.minX, maxX = c.r != null ? c.x + c.r : c.maxX;
  const minZ = c.r != null ? c.z - c.r : c.minZ, maxZ = c.r != null ? c.z + c.r : c.maxZ;
  for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
    for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
      const k = cellKey(cx, cz);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(c);
    }
}
export function collide(x, z, rad) {
  const g = G.colliders;
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = g.get(cellKey(cx + i, cz + j));
    if (!list) continue;
    for (const c of list) {
      if (c.off) continue;
      if (c.r != null) {
        const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + rad;
        if (d < m && d > 1e-4) { x = c.x + dx / d * m; z = c.z + dz / d * m; }
      } else {
        const px = clamp(x, c.minX, c.maxX), pz = clamp(z, c.minZ, c.maxZ);
        const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
        if (d < rad) {
          if (d > 1e-4) { x = px + dx / d * rad; z = pz + dz / d * rad; }
          else {
            const l = x - c.minX, r = c.maxX - x, t = z - c.minZ, b = c.maxZ - z, mn = Math.min(l, r, t, b);
            if (mn === l) x = c.minX - rad; else if (mn === r) x = c.maxX + rad; else if (mn === t) z = c.minZ - rad; else z = c.maxZ + rad;
          }
        }
      }
    }
  }
  return [x, z];
}

// ---------- Build ----------
function groundColor(x, z, h, out) {
  const w = sectorWeights(x, z);
  const n = noise(x * 0.15, z * 0.15) * 0.06 + noise(x * 0.02, z * 0.02) * 0.05;
  const cols = {
    meadow: [0.42, 0.62, 0.28], coast: [0.58, 0.64, 0.36], thorn: [0.25, 0.42, 0.21],
    mire: [0.3, 0.36, 0.22], ruins: [0.42, 0.36, 0.33],
  };
  let r = 0, g = 0, b = 0;
  for (const k in cols) { r += cols[k][0] * w[k]; g += cols[k][1] * w[k]; b += cols[k][2] * w[k]; }
  const tr = Math.hypot(x, z);
  if (tr < TOWN_R + 2) { const t = smooth(TOWN_R - 6, TOWN_R + 2, tr); const path = [0.55, 0.47, 0.34]; const d = Math.min(Math.abs(x), Math.abs(z)); const p = d < 2.6 || tr < 9 ? 1 : 0; r = lerp(lerp(0.45, path[0], p), r, t); g = lerp(lerp(0.6, path[1], p), g, t); b = lerp(lerp(0.3, path[2], p), b, t); }
  // roads out of the gates
  const d = Math.min(Math.abs(x), Math.abs(z));
  if (d < 2.2 && tr < 150 && tr > TOWN_R - 2) { const t = 0.6; r = lerp(r, 0.52, t); g = lerp(g, 0.45, t); b = lerp(b, 0.32, t); }
  // sand and seabed
  const sand = smooth(1.3, 0.4, h) * (1 - w.mire * 0.8);
  r = lerp(r, 0.82, sand); g = lerp(g, 0.76, sand); b = lerp(b, 0.55, sand);
  if (h < -0.2) { const t = smooth(-0.2, -3, h); r = lerp(r, 0.5, t); g = lerp(g, 0.55, t); b = lerp(b, 0.45, t); }
  if (w.ruins > 0.3 && noise(x * 0.08, z * 0.08) > 0.35) { r *= 0.8; g *= 0.6; b *= 0.6; r += 0.12 * w.ruins; }
  out.setRGB(r + n, g + n, b + n * 0.5, THREE.SRGBColorSpace);
}

export function buildWorld() {
  const scene = G.scene;
  G.colliders = mkGrid();
  // terrain: smooth-shaded, vertex-coloured, with a tiled grain texture for close-up detail
  const SIZE = 700, SEG = G.Q.seg;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const uvs = geo.attributes.uv;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    groundColor(x, z, h, c);
    colors[i * 3] = c.r * 1.12; colors[i * 3 + 1] = c.g * 1.12; colors[i * 3 + 2] = c.b * 1.12;
    uvs.setXY(i, x / 6, z / 6);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: grainTexture() }));
  terrain.receiveShadow = true;
  scene.add(terrain);
  G.terrain = terrain;

  // sea, with a scrolling ripple normal map
  const wn = rippleTexture();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshPhongMaterial({ color: 0x2a7290, specular: 0x9ad8ff, shininess: 90, transparent: true, opacity: 0.86, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6) }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.15;
  scene.add(water);
  G.water = water;
  // bog water
  const bog = new THREE.Mesh(new THREE.RingGeometry(RING_R - 6, ISLAND_R - 20, 48, 1, Math.PI / 2 - 0.9, 1.8), new THREE.MeshPhongMaterial({ color: 0x46552e, specular: 0x6a7a4a, shininess: 40, transparent: true, opacity: 0.88, normalMap: wn, normalScale: new THREE.Vector2(0.3, 0.3) }));
  bog.rotation.x = -Math.PI / 2; bog.position.y = 0.12;
  scene.add(bog);

  buildSky();
  const R = rng(4242);
  const scatter = { oak: [], pine: [], dead: [], willow: [], rock: [], bush: [], aged: [] };
  const nodes = [];
  // scatter scenery and nodes
  for (let i = 0; i < 12000; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * (ISLAND_R + 10);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < TOWN_R + 4) continue;
    if (Math.min(Math.abs(x), Math.abs(z)) < 4 && r < 150) continue; // keep roads clear
    let nearPoi = false; for (const k in POI) if (Math.hypot(x - POI[k].x, z - POI[k].z) < 16) nearPoi = true;
    if (nearPoi) continue;
    const h = heightAt(x, z);
    if (h < 0.5) continue;
    const zn = zoneAt(x, z);
    const roll = R();
    const s = 0.8 + R() * 0.6;
    const rot = R() * 6.28;
    if (zn === 'meadow') {
      if (roll < 0.05) scatter.oak.push([x, z, s, rot]);
      else if (roll < 0.06) nodes.push(['tree', x, z]);
      else if (roll < 0.068) nodes.push(['iron', x, z]);
      else if (roll < 0.079) nodes.push(['hemp', x, z]);
      else if (roll < 0.1) scatter.bush.push([x, z, s, rot]);
      else if (roll < 0.11) scatter.rock.push([x, z, s, rot]);
    } else if (zn === 'coast') {
      if (roll < 0.03) scatter.oak.push([x, z, s, rot]);
      else if (roll < 0.04) scatter.pine.push([x, z, s, rot]);
      else if (roll < 0.047) nodes.push(['tree', x, z]);
      else if (roll < 0.055) nodes.push(['iron', x, z]);
      else if (roll < 0.064) nodes.push(['hemp', x, z]);
      else if (roll < 0.085) scatter.rock.push([x, z, s, rot]);
      else if (roll < 0.1) scatter.bush.push([x, z, s, rot]);
    } else if (zn === 'thorn') {
      if (roll < 0.17) scatter.pine.push([x, z, s * 1.15, rot]);
      else if (roll < 0.21) scatter.aged.push([x, z, s, rot]);
      else if (roll < 0.222) nodes.push(['aged_tree', x, z]);
      else if (roll < 0.23) nodes.push(['tree', x, z]);
      else if (roll < 0.238) nodes.push(['starmetal', x, z]);
      else if (roll < 0.244) nodes.push(['iron', x, z]);
      else if (roll < 0.25) nodes.push(['hemp', x, z]);
      else if (roll < 0.28) scatter.bush.push([x, z, s, rot]);
    } else if (zn === 'mire') {
      if (roll < 0.05) scatter.willow.push([x, z, s, rot]);
      else if (roll < 0.08) scatter.dead.push([x, z, s, rot]);
      else if (roll < 0.092) nodes.push(['silkweed', x, z]);
      else if (roll < 0.1) nodes.push(['aged_tree', x, z]);
      else if (roll < 0.107) nodes.push(['starmetal', x, z]);
      else if (roll < 0.114) nodes.push(['hemp', x, z]);
      else if (roll < 0.15) scatter.bush.push([x, z, s, rot]);
    } else if (zn === 'ruins') {
      if (roll < 0.06) scatter.dead.push([x, z, s, rot]);
      else if (roll < 0.072) nodes.push(['wyrd_tree', x, z]);
      else if (roll < 0.082) nodes.push(['orichalcum', x, z]);
      else if (roll < 0.088) nodes.push(['starmetal', x, z]);
      else if (roll < 0.11) scatter.rock.push([x, z, s * 1.3, rot]);
      else if (roll < 0.116) scatter.ruin = (scatter.ruin || []).concat([[x, z, s, rot]]);
    }
  }
  instance(makeTree('oak'), scatter.oak, 0.5);
  instance(makeTree('pine'), scatter.pine, 0.45);
  instance(makeTree('aged'), scatter.aged, 0.5);
  instance(makeTree('dead'), scatter.dead, 0.35);
  instance(makeTree('willow'), scatter.willow, 0.6);
  instance(makeRock('plain'), scatter.rock, 1.0);
  instance(makeBush(), scatter.bush, 0, false);
  if (scatter.ruin) instance(makeRuin(), scatter.ruin, 1.2);

  // gatherable nodes
  for (const [type, x, z] of nodes) addNode(type, x, z);

  // small details: pebbles, ferns and mushrooms
  const peb = [], fern = [], shroom = [];
  for (let i = 0; i < 14000; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * ISLAND_R;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < TOWN_R + 3 || heightAt(x, z) < 0.4) continue;
    const zn = zoneAt(x, z), q = R();
    if (q < 0.25) peb.push([x, z, 0.3 + R() * 0.5, R() * 6]);
    else if (q < 0.45 && (zn === 'thorn' || zn === 'mire')) fern.push([x, z, 0.8 + R() * 0.6, R() * 6]);
    else if (q < 0.5 && zn !== 'ruins') shroom.push([x, z, 0.6 + R() * 0.8, R() * 6]);
  }
  instance(makeRock('plain', 0.25), peb, 0, false);
  instance(makeFern(), fern, 0, false);
  instance(makeShroom(), shroom, 0, false);

  buildTown();
  buildPOIs();
  buildCamps(R);
  buildGrass();
}

// ---------- Textures ----------
function grainTexture() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const n = 0.5 + fbm(i / 18, j / 18, 3) * 0.35 + (Math.random() - 0.5) * 0.22;
    const v = Math.max(0, Math.min(255, 175 + n * 80));
    const k = (j * S + i) * 4; img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v * 0.97; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function rippleTexture() {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
  const hgt = (i, j) => Math.sin(i / S * Math.PI * 8 + Math.sin(j / S * Math.PI * 4) * 2) * 0.5 + Math.sin(j / S * Math.PI * 6 + i / S * Math.PI * 2) * 0.5;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = hgt(i + 1, j) - hgt(i - 1, j), dy = hgt(i, j + 1) - hgt(i, j - 1);
    const k = (j * S + i) * 4; img.data[k] = 128 + dx * 60; img.data[k + 1] = 128 + dy * 60; img.data[k + 2] = 255; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(160, 160);
  return t;
}

// ---------- Sky & clouds ----------
function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3d7fd0) }, horizon: { value: new THREE.Color(0xcfe4ee) }, sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3) }, sunCol: { value: new THREE.Color(0xfff2c8) }, stars: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float stars; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ vec3 d = normalize(vDir); float t = clamp(d.y * 1.6, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(t, 0.7));
        if (d.y < 0.0) col = horizon * 0.9;
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunCol * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25);
        if (stars > 0.0 && d.y > 0.05) { vec3 q = floor(d * 400.0); float st = step(0.9975, h(q)); col += vec3(st) * stars * clamp(d.y * 3.0, 0.0, 1.0); }
        gl_FragColor = vec4(col, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  G.scene.add(sky);
  G.sky = sky;
  // clouds
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8a8a90, fog: false, transparent: true, opacity: 0.92, flatShading: true });
  G.clouds = [];
  const R = rng(77);
  for (let i = 0; i < 46; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(R() * 4);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(10 + R() * 12, 1), cm);
      m.position.set((j - n / 2) * 13 + R() * 6, R() * 5, R() * 12);
      m.scale.y = 0.45;
      g.add(m);
    }
    const a = R() * Math.PI * 2, r = 120 + R() * 520;
    g.position.set(Math.cos(a) * r, 130 + R() * 70, Math.sin(a) * r);
    G.scene.add(g);
    G.clouds.push(g);
  }
  G.cloudMat = cm;
}

// ---------- Grass (instanced, around the player) ----------
const GRASS_CELL = 10;
let GRASS_R = 40;
const grassCache = new Map();
let grassMesh = null, grassAt = null, grassUniforms = { time: { value: 0 } };
function grassCell(cx, cz) {
  const k = cx * 9973 + cz;
  if (grassCache.has(k)) return grassCache.get(k);
  const R = rng(k * 7 + 13), out = [];
  const c = new THREE.Color();
  const dens = { town: 0.45, meadow: 1, coast: 0.6, thorn: 0.75, mire: 0.7, ruins: 0.22 };
  const per = Math.round(G.Q.grass / 105);
  for (let i = 0; i < per; i++) {
    const x = (cx + R()) * GRASS_CELL, z = (cz + R()) * GRASS_CELL;
    const zn = zoneAt(x, z);
    if (R() > dens[zn]) continue;
    const h = heightAt(x, z);
    if (h < 0.9) continue;
    if (zn === 'town' && (Math.min(Math.abs(x), Math.abs(z)) < 3.4 || Math.hypot(x, z) < 11)) continue;
    if (Math.min(Math.abs(x), Math.abs(z)) < 2.6 && Math.hypot(x, z) < 150) continue;
    groundColor(x, z, h, c);
    const flower = zn === 'meadow' && R() < 0.06;
    let r = c.r * 1.15, g = c.g * 1.3, b = c.b * 1.05;
    if (flower) { const f = [[1, 0.85, 0.2], [0.85, 0.5, 1], [1, 1, 1], [1, 0.4, 0.3]][Math.floor(R() * 4)]; r = f[0]; g = f[1]; b = f[2]; }
    out.push(x, h, z, 0.8 + R() * 0.8 + (flower ? 0.3 : 0), R() * 6.28, r, g, b);
  }
  grassCache.set(k, out);
  return out;
}
function buildGrass() {
  if (!G.Q.grass) return;
  GRASS_R = G.Q.grass > 40000 ? 66 : G.Q.grass > 25000 ? 55 : G.Q.grass > 15000 ? 47 : 40;
  const blade = new THREE.BufferGeometry();
  // a tuft of five thin, slightly bent blades
  const v = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + i * 0.7, r = 0.05 + (i % 2) * 0.05;
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r, w = 0.035, h = 0.32 + (i % 3) * 0.08;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w, lean = 0.12 + (i % 2) * 0.06;
    v.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, ox + Math.cos(a) * lean, h, oz + Math.sin(a) * lean);
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  blade.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.time = grassUniforms.time;
    sh.vertexShader = 'uniform float time;\nvarying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vH = position.y / 0.5;
      vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
      float sway = sin(time * 1.8 + wp.x * 0.35 + wp.z * 0.27) * 0.12 + sin(time * 3.1 + wp.x) * 0.04;
      transformed.x += sway * position.y; transformed.z += sway * 0.6 * position.y;`);
    // light both faces as if they faced up, darker at the root
    sh.fragmentShader = 'varying float vH;\n' + sh.fragmentShader
      .replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0; vec3 normal = normalize( vNormal ); vec3 nonPerturbedNormal = normal;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.55, 1.15, clamp(vH, 0.0, 1.0));');
  };
  // normals point up so blades are lit like the ground
  const n = blade.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  grassMesh = new THREE.InstancedMesh(blade, m, G.Q.grass);
  grassMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(grassMesh.count * 3), 3);
  grassMesh.frustumCulled = false;
  grassMesh.receiveShadow = true;
  G.scene.add(grassMesh);
}
function layoutGrass(px, pz) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const max = grassMesh.count;
  let n = 0;
  const c0x = Math.floor(px / GRASS_CELL), c0z = Math.floor(pz / GRASS_CELL), rc = Math.ceil(GRASS_R / GRASS_CELL);
  const cells = [];
  for (let i = -rc; i <= rc; i++) for (let j = -rc; j <= rc; j++) cells.push([i * i + j * j, c0x + i, c0z + j]);
  cells.sort((a, b) => a[0] - b[0]);
  for (const [d2, cx, cz] of cells) {
    if (d2 > rc * rc + 1) continue;
    const arr = grassCell(cx, cz);
    for (let i = 0; i < arr.length && n < max; i += 8) {
      p.set(arr[i], arr[i + 1] - 0.03, arr[i + 2]);
      q.setFromAxisAngle(up, arr[i + 4]);
      sc.setScalar(arr[i + 3]);
      m4.compose(p, q, sc);
      grassMesh.setMatrixAt(n, m4);
      grassMesh.instanceColor.setXYZ(n, arr[i + 5], arr[i + 6], arr[i + 7]);
      n++;
    }
  }
  grassMesh.count = n;
  grassMesh.instanceMatrix.needsUpdate = true;
  grassMesh.instanceColor.needsUpdate = true;
}

// per-frame scenery animation
export function updateWorld(dt, px, pz, t) {
  if (grassMesh) {
    grassUniforms.time.value = t;
    const k = Math.floor(px / GRASS_CELL) + ',' + Math.floor(pz / GRASS_CELL);
    if (k !== grassAt) { grassAt = k; grassMesh.count = G.Q.grass; layoutGrass(px, pz); }
  }
  if (G.water) { const nm = G.water.material.normalMap; nm.offset.x = t * 0.004; nm.offset.y = t * 0.0025; }
  for (const c of G.clouds || []) { c.position.x += dt * 2.2; if (c.position.x > 700) c.position.x -= 1400; }
}

function makeBush() {
  const g = new THREE.Group();
  const m = mat(0x4a7a34);
  const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), m); a.position.y = 0.35; g.add(a);
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), m); b.position.set(0.5, 0.25, 0.1); g.add(b);
  return g;
}
function makeRuin() {
  const g = new THREE.Group();
  const m = mat(0x7a7068);
  g.add(box(0.9, 3.2, 0.9, m, 0, 1.6, 0));
  g.add(box(1.2, 0.3, 1.2, m, 0, 0.15, 0));
  const top = box(1.0, 0.3, 1.0, m, 0.2, 3.3, 0); top.rotation.z = 0.2; g.add(top);
  g.add(box(2.4, 1.2, 0.6, m, 1.6, 0.6, 0.4));
  return g;
}

// Instanced copies of a template group, split into map chunks so off-screen chunks are culled.
// colR: collider radius at scale 1
const CHUNK = 90;
function instance(template, list, colR, shadow = true, ready = null) {
  if (!list.length) return;
  const parts = ready || templateParts(template);
  const chunks = new Map();
  for (const it of list) {
    const k = Math.floor(it[0] / CHUNK) + ',' + Math.floor(it[1] / CHUNK);
    if (!chunks.has(k)) chunks.set(k, []);
    chunks.get(k).push(it);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const part of chunks.values()) for (const [geo, material] of parts) {
    const im = new THREE.InstancedMesh(geo, material, part.length);
    im.castShadow = shadow;
    part.forEach(([x, z, sc, rot], i) => {
      q.setFromAxisAngle(up, rot);
      s.setScalar(sc);
      p.set(x, heightAt(x, z) - 0.1, z);
      m4.compose(p, q, s);
      im.setMatrixAt(i, m4);
    });
    im.computeBoundingSphere();
    G.scene.add(im);
  }
  if (colR) for (const [x, z, sc] of list) addCollider({ x, z, r: colR * sc });
}

export function addNode(type, x, z) {
  const def = NODES[type];
  let mesh;
  if (type === 'tree') mesh = makeTree('oak', 1.05);
  else if (type === 'aged_tree') mesh = makeTree('aged', 1.15);
  else if (type === 'wyrd_tree') mesh = makeTree('wyrd', 1.1);
  else if (type === 'iron' || type === 'starmetal' || type === 'orichalcum') mesh = makeRock(type, 1.0);
  else mesh = makePlant(type);
  mergeStatic(mesh);
  mesh.position.set(x, heightAt(x, z) - 0.05, z);
  mesh.rotation.y = Math.random() * 6.28;
  G.scene.add(mesh);
  const solid = def.skill !== 'harvesting';
  const col = solid ? { x, z, r: def.skill === 'mining' ? 1.1 : 0.55 } : null;
  if (col) addCollider(col);
  // stump shown while depleted
  let stump = null;
  if (def.skill === 'logging') {
    stump = box(0.6, 0.4, 0.6, mat(0x5a4028), x, heightAt(x, z) + 0.2, z);
    stump.visible = false; G.scene.add(stump);
  }
  const n = { type, def, x, z, mesh, stump, col, depleted: 0, kind: 'node' };
  G.nodes.push(n);
  return n;
}

// ---------- Town ----------
function buildTown() {
  const scene = G.scene;
  // palisade
  const logM = mat(0x6a4a2c);
  const logGeo = new THREE.CylinderGeometry(0.45, 0.5, 4.6, 6);
  const logs = [];
  for (let i = 0; i < 300; i++) {
    const a = i / 300 * Math.PI * 2;
    let gate = false;
    for (const ga of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) if (Math.abs(angDiff(a, ga)) < 0.09) gate = true;
    if (gate) continue;
    logs.push(a);
  }
  const im = new THREE.InstancedMesh(logGeo, logM, logs.length);
  const m4 = new THREE.Matrix4();
  logs.forEach((a, i) => {
    const x = Math.cos(a) * TOWN_R, z = Math.sin(a) * TOWN_R;
    m4.makeTranslation(x, heightAt(x, z) + 1.8 + (i % 3) * 0.15, z);
    im.setMatrixAt(i, m4);
    addCollider({ x, z, r: 0.6 });
  });
  im.castShadow = true;
  scene.add(im);
  // gate towers
  for (const ga of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const s of [-1, 1]) {
      const a = ga + s * 0.11;
      const x = Math.cos(a) * TOWN_R, z = Math.sin(a) * TOWN_R;
      const t = new THREE.Group();
      t.add(box(1.6, 6.5, 1.6, logM, 0, 3.25, 0));
      t.add(box(2.4, 0.4, 2.4, mat(0x4a3220), 0, 6.5, 0));
      mergeStatic(t); t.position.set(x, heightAt(x, z), z);
      scene.add(t);
      addCollider({ x, z, r: 1.1 });
    }
  }
  const houses = [
    [-24, -20, 7, 6, 0x9a7a58, 0x6a2a20], [24, -22, 6, 6, 0x8a6a48, 0x2a4a6a], [-26, 4, 6, 7, 0x8a6a48, 0x7a3a28], [26, 20, 7, 5, 0x9a7a58, 0x3a5a2a],
    [-20, 26, 6, 6, 0xa08060, 0x6a2a20], [18, -32, 5, 4, 0x8a6a48, 0x7a3a28], [-12, -30, 6, 5, 0x9a7a58, 0x2a4a6a], [31, 2, 5, 6, 0x8a6a48, 0x6a2a20],
  ];
  for (const [x, z, w, d, c, r] of houses) {
    const h = makeHouse(w, d, c, r);
    h.position.set(x, 2.4, z);
    scene.add(h);
    addCollider({ minX: x - w / 2 - 0.2, maxX: x + w / 2 + 0.2, minZ: z - d / 2 - 0.2, maxZ: z + d / 2 + 0.2 });
  }
  // central flag and campfire
  const flag = makeFlag(0x2a5a9a); flag.position.set(0, 2.4, -3); scene.add(flag); G.flag = flag;
  addCollider({ x: 0, z: -3, r: 0.3 });
  const fire = new THREE.Group();
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; fire.add(box(0.4, 0.3, 0.4, mat(0x6a6a66), Math.cos(a) * 1.0, 0.15, Math.sin(a) * 1.0)); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 6), new THREE.MeshBasicMaterial({ color: 0xffa030 }));
  flame.position.y = 0.6; flame.userData.keep = true; fire.add(flame); G.flame = flame;
  mergeStatic(fire);
  const fl = new THREE.PointLight(0xffa040, 30, 14, 1.6); fl.position.y = 1.5; fire.add(fl);
  fire.position.set(0, 2.4, 8); scene.add(fire);
  addCollider({ x: 0, z: 8, r: 1.3 });

  // stations
  addStation('refinery', 14, -12, makeRefinery());
  addStation('forge', -14, -12, makeForge());
  addStation('kitchen', -14, 14, makeKitchen());
  // NPCs
  addNPC('thorne', 0, -9, { skin: 0xd8a882, shirt: 0x7a1e1e, pants: 0x3a2e22, hair: 0x3a2a1a, helm: 0x8a8a90 }, 'sword');
  addNPC('ilsa', 14, 12, { skin: 0xf0c8a0, shirt: 0x2e5a6a, pants: 0x3a3022, hair: 0xc89040 });
  // merchant stall
  const stall = new THREE.Group();
  stall.add(box(4, 1, 1.6, mat(0x7a5a38), 0, 0.5, 0));
  for (const x of [-1.9, 1.9]) stall.add(box(0.2, 3, 0.2, mat(0x4a3220), x, 1.5, -0.6));
  stall.add(box(4.4, 0.15, 2.4, mat(0xc04a3a), 0, 3, 0));
  mergeStatic(stall); stall.position.set(14, 2.4, 14.5); scene.add(stall);
  addCollider({ minX: 12, maxX: 16, minZ: 13.7, maxZ: 15.3 });
  // bounty board
  const board = new THREE.Group();
  for (const x of [-1.2, 1.2]) board.add(box(0.2, 2.6, 0.2, mat(0x4a3220), x, 1.3, 0));
  board.add(box(2.6, 1.6, 0.15, mat(0x8a6a48), 0, 1.8, 0));
  for (let i = 0; i < 4; i++) board.add(box(0.5, 0.6, 0.02, mat(0xf0e4c0), -0.8 + i * 0.55, 1.8 + (i % 2) * 0.15, 0.09));
  mergeStatic(board); board.position.set(7, 2.4, 2); scene.add(board);
  addCollider({ x: 7, z: 2, r: 1.0 });
  G.npcs.push({ id: 'board', x: 7, z: 2.6, kind: 'npc', root: board, marker: makeMarker(board, 3.2) });
  // clutter: barrels, crates, fences and torches
  const put = (m, x, z, ry = 0, r = 0) => { m.position.set(x, heightAt(x, z), z); m.rotation.y = ry; scene.add(m); if (r) addCollider({ x, z, r }); return m; };
  for (const [x, z] of [[17, -9], [17.8, -10], [-17, -8.5], [-18, 17], [9, 15], [-6, -26], [28, 14], [-30, 9]]) put(makeBarrel(), x, z, x, 0.45);
  for (const [x, z, r] of [[11, -16, 0.3], [12.2, -16.2, 0.7], [11.6, -16.1, 0], [-21, -14, 0.4], [20, 26, 0.2], [-26, 21, 1]]) put(makeCrate(0.8 + (r % 0.3)), x, z, r, 0.6);
  for (const [x, z, ry] of [[-31, 26, 0.8], [33, -12, 1.6], [-8, 33, 0], [10, -36, 0.3]]) put(makeFence(6), x, z, ry);
  G.torches = [];
  for (const [x, z] of [[4, 37], [-4, 37], [4, -37], [-4, -37], [37, 4], [-37, 4], [5, -5], [-5, 5], [10, 10], [-10, -10]]) {
    const t = put(makeTorch(), x, z, 0, 0.2);
    const l = G.torches.length < 6 ? new THREE.PointLight(0xffa040, 0, 16, 1.6) : null;
    if (l) { l.position.set(x, heightAt(x, z) + 2.9, z); scene.add(l); }
    G.torches.push({ flame: t.userData.flame, light: l });
  }
}

function makeMarker(parent, y) {
  const el = document.createElement('div');
  el.className = 'npcmark';
  document.getElementById('floaters').appendChild(el);
  return { el, parent, y };
}

function addNPC(id, x, z, look, weapon) {
  const h = makeHumanoid(look);
  if (weapon) h.parts.handR.add(makeWeapon(weapon));
  h.root.position.set(x, heightAt(x, z), z);
  h.root.rotation.y = Math.atan2(-x, 12 - z);
  G.scene.add(h.root);
  addCollider({ x, z, r: 0.5 });
  G.npcs.push({ id, x, z, kind: 'npc', h, root: h.root, marker: makeMarker(h.root, 2.6) });
}

function addStation(id, x, z, mesh) {
  mergeStatic(mesh);
  mesh.position.set(x, heightAt(x, z), z);
  G.scene.add(mesh);
  addCollider({ x, z, r: 1.6 });
  G.stations.push({ id, x, z, kind: 'station', root: mesh });
}

function makeRefinery() {
  const g = new THREE.Group();
  const st = mat(0x6a645c);
  g.add(box(2.6, 2.4, 2.6, st, 0, 1.2, 0));
  g.add(box(1.2, 3, 1.2, st, 0, 3.6, 0));
  g.add(box(1, 0.8, 0.1, mat(0xff7020, false, { emissive: 0xff5010 }), 0, 0.9, 1.31));
  g.add(box(2.4, 0.9, 1.0, mat(0x6a4a2c), 2.4, 0.45, 0));
  const l = new THREE.PointLight(0xff7030, 12, 8); l.position.set(0, 1, 2); g.add(l);
  return g;
}
function makeForge() {
  const g = new THREE.Group();
  g.add(box(1.6, 0.8, 0.8, mat(0x3a3a3e), 0, 0.8, 0));
  g.add(box(0.6, 0.5, 0.6, mat(0x5a4028), 0, 0.25, 0));
  g.add(box(2.4, 1.2, 1.8, mat(0x6a645c), -2.2, 0.6, 0));
  g.add(box(1.4, 0.2, 1.0, mat(0xff6010, false, { emissive: 0xff4000 }), -2.2, 1.25, 0));
  g.add(box(0.8, 4, 0.8, mat(0x6a645c), -2.8, 2.6, -0.4));
  const l = new THREE.PointLight(0xff6020, 12, 8); l.position.set(-2.2, 2, 0); g.add(l);
  return g;
}
function makeKitchen() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.add(box(0.3, 0.3, 0.3, mat(0x6a6a66), Math.cos(a) * 0.8, 0.15, Math.sin(a) * 0.8)); }
  g.add(box(0.1, 1.8, 0.1, mat(0x4a3220), -1, 0.9, 0)); g.add(box(0.1, 1.8, 0.1, mat(0x4a3220), 1, 0.9, 0));
  g.add(box(2.2, 0.1, 0.1, mat(0x4a3220), 0, 1.8, 0));
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.6, 8), mat(0x2a2a2a)); pot.position.y = 1.0; g.add(pot);
  g.add(box(3.6, 0.1, 3.4, mat(0xd8c8a0), 0, 3.0, -0.3));
  for (const [x, z] of [[-1.7, -1.9], [1.7, -1.9], [-1.7, 1.3], [1.7, 1.3]]) g.add(box(0.15, 3, 0.15, mat(0x4a3220), x, 1.5, z));
  const l = new THREE.PointLight(0xff9030, 8, 6); l.position.set(0, 0.8, 0); g.add(l);
  return g;
}

// ---------- Points of interest ----------
function buildPOIs() {
  const scene = G.scene;
  // shipwreck
  const w = new THREE.Group();
  const hull = mat(0x4a3424);
  const h1 = box(5, 3, 16, hull, 0, 1.2, 0); h1.rotation.z = 0.35; h1.rotation.x = 0.05; w.add(h1);
  const mast = box(0.5, 12, 0.5, mat(0x5a4028), 1.5, 5, -2); mast.rotation.z = 0.7; w.add(mast);
  const sail = box(0.1, 4, 5, mat(0xc8b890), 4.5, 7, -2); sail.rotation.z = 0.7; w.add(sail);
  mergeStatic(w); w.position.set(POI.wreck.x + 10, 0.5, POI.wreck.z + 6); w.rotation.y = 0.6;
  scene.add(w);
  addCollider({ x: POI.wreck.x + 10, z: POI.wreck.z + 6, r: 5 });
  for (let i = 0; i < 6; i++) { const x = POI.wreck.x - 8 + i * 3.2, z = POI.wreck.z - 10 + (i % 2) * 4; const c = box(1, 1, 1, mat(0x7a5a38), x, heightAt(x, z) + 0.5, z); c.rotation.y = i; scene.add(c); }
  // hag hut on stilts
  const hut = new THREE.Group();
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) hut.add(box(0.3, 3, 0.3, mat(0x3a2e20), x, 1.5, z));
  hut.add(box(5, 3, 5, mat(0x4a4030), 0, 4.5, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 3, 4), mat(0x3a4a28)); roof.position.y = 7.4; roof.rotation.y = Math.PI / 4; hut.add(roof);
  hut.add(box(1, 0.8, 0.1, mat(0x9cff5a, false, { emissive: 0x4a8a20 }), 1.2, 4.8, 2.55));
  mergeStatic(hut); hut.position.set(POI.hut.x, heightAt(POI.hut.x, POI.hut.z), POI.hut.z - 8); scene.add(hut);
  addCollider({ x: POI.hut.x, z: POI.hut.z - 8, r: 3.2 });
  const gl = new THREE.PointLight(0x9cff5a, 20, 20); gl.position.set(POI.hut.x, 4, POI.hut.z); scene.add(gl);
  // shrine
  const sh = new THREE.Group();
  const sm = mat(0x5a4e48);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * 6.28, r = 16;
    const hgt = i % 3 === 0 ? 2.2 : 6;
    sh.add(box(1.4, hgt, 1.4, sm, Math.cos(a) * r, hgt / 2, Math.sin(a) * r));
    addCollider({ x: POI.shrine.x + Math.cos(a) * r, z: POI.shrine.z + Math.sin(a) * r, r: 1 });
  }
  sh.add(box(5, 1, 5, sm, -12, 0.5, 0));
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), new THREE.MeshLambertMaterial({ color: 0xff2a1a, emissive: 0xaa1010 }));
  crystal.position.set(-12, 3.4, 0); crystal.userData.keep = true; sh.add(crystal); G.crystal = crystal;
  const cl = new THREE.PointLight(0xff3020, 40, 30); cl.position.set(-12, 4, 0); sh.add(cl);
  mergeStatic(sh); sh.position.set(POI.shrine.x, heightAt(POI.shrine.x, POI.shrine.z), POI.shrine.z); scene.add(sh);
  addCollider({ x: POI.shrine.x - 12, z: POI.shrine.z, r: 2.8 });
}

// ---------- Enemy camps ----------
function buildCamps(R) {
  G.camps = [];
  const placed = [];
  const tryPlace = (zn, count, minR, maxR) => {
    let n = 0, tries = 0;
    while (n < count && tries < 4000) {
      tries++;
      const a = R() * Math.PI * 2, r = minR + R() * (maxR - minR);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (zoneAt(x, z) !== zn) continue;
      if (heightAt(x, z) < 0.6) continue;
      if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < 26)) continue;
      let nearPoi = false; for (const k in POI) if (Math.hypot(x - POI[k].x, z - POI[k].z) < 30) nearPoi = true;
      if (nearPoi) continue;
      placed.push([x, z]);
      const list = ZONES[zn].enemies;
      const size = 2 + Math.floor(R() * 3);
      const slots = [];
      for (let i = 0; i < size; i++) slots.push(list[Math.floor(R() * list.length)]);
      if (zn === 'meadow' && Math.hypot(x, z) < 70) slots.length = Math.min(slots.length, 2);
      G.camps.push({ x, z, zone: zn, slots: slots.map(t => ({ type: t, dead: 0, ent: null })), radius: 6, active: false });
      n++;
    }
  };
  tryPlace('meadow', 16, TOWN_R + 14, RING_R - 4);
  tryPlace('coast', 17, RING_R + 4, ISLAND_R - 14);
  tryPlace('thorn', 17, RING_R + 4, ISLAND_R - 14);
  tryPlace('mire', 17, RING_R + 4, ISLAND_R - 14);
  tryPlace('ruins', 18, RING_R + 4, ISLAND_R - 14);
  // special camps
  G.camps.push({ x: POI.lostcamp.x, z: POI.lostcamp.z, zone: 'thorn', slots: ['lost', 'lost', 'lostArcher', 'lost', 'lostArcher'].map(t => ({ type: t, dead: 0, ent: null })), radius: 7 });
  G.camps.push({ x: POI.wreck.x, z: POI.wreck.z - 4, zone: 'coast', lv: 9, boss: true, slots: [{ type: 'grimsby', dead: 0, ent: null }], radius: 2 });
  G.camps.push({ x: POI.hut.x, z: POI.hut.z, zone: 'mire', lv: 15, boss: true, slots: [{ type: 'hag', dead: 0, ent: null }], radius: 2 });
  G.camps.push({ x: POI.shrine.x, z: POI.shrine.z, zone: 'ruins', lv: 24, boss: true, slots: [{ type: 'warden', dead: 0, ent: null }], radius: 2 });
  // guards near the shrine
  for (const [dx, dz] of [[30, -14], [30, 14], [18, 26], [18, -26]])
    G.camps.push({ x: POI.shrine.x + dx, z: POI.shrine.z + dz, zone: 'ruins', lv: 21, slots: ['corrupted', 'brute', 'corruptArcher'].map(t => ({ type: t, dead: 0, ent: null })), radius: 5 });
}

// minimap image
export function buildMapImage(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const c = new THREE.Color();
  const span = (ISLAND_R + 40) * 2;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i / size - 0.5) * span, z = (j / size - 0.5) * span;
    const h = heightAt(x, z);
    const k = (j * size + i) * 4;
    if (h < -0.15) { img.data[k] = 34; img.data[k + 1] = 92; img.data[k + 2] = 118; }
    else {
      groundColor(x, z, h, c);
      c.convertLinearToSRGB();
      const shade = 0.85 + clamp(h / 12, -0.2, 0.3);
      img.data[k] = c.r * 255 * shade; img.data[k + 1] = c.g * 255 * shade; img.data[k + 2] = c.b * 255 * shade;
      if (zoneAt(x, z) === 'mire' && h < 0.5) { img.data[k] = 70; img.data[k + 1] = 84; img.data[k + 2] = 50; }
    }
    img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // palisade
  ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = Math.max(1, size / 200);
  ctx.beginPath(); ctx.arc(size / 2, size / 2, TOWN_R / span * size, 0, 6.28); ctx.stroke();
  return { canvas: cv, span };
}
