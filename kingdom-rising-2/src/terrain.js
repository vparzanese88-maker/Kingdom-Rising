// Terrain heights, biomes/zones, terrain mesh, water, sky and lighting.
import * as THREE from 'three';
import { settings } from './saves.js';
import { fbm, ridged, smooth, lerp, clamp, distToLine } from './util.js';
import { BATTLE, YARD, ARENA, battleHeight, LAYOUT, roadPolylines, WALL_R } from './battlemap.js';
import { GI, giShape, giCamps, ROADS_GI, northCoast, GORGE, GORGE_W, CREEK, CREEK_W, CREEK_DEPTH, CREEK_ROCKS, creekNear, gorgeRocks } from './gimap.js';
import { driftHeight, DRIFT } from './driftkey.js';

export const HALF = 600, SEG = /[?&]mode=arena/.test(location.search) ? 60 : 300, CELL = (HALF * 2) / SEG; // (the arena never shows the ground outside its walls up close)
export const SEA = 0;
export const VILLAGE = { x: 0, z: 362 };
// the island: Mount Kelda in the middle, Saltmere (the big port town) on the far north shore
export const MOUNT = { x: 20, z: -70, r: 250 };
export const PORT = { x: 20, z: -392 };
const ISLE = { x: 0, z: -15 };
// distance from the island's middle, and how far the land reaches in that direction
export function isleR(x, z) { const dx = x - ISLE.x, dz = z - ISLE.z, a = Math.atan2(dz, dx); const R = 488 + fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 2, 3) * 70 + fbm(Math.cos(a) * 5 + 1, Math.sin(a) * 5, 2) * 16; return [Math.hypot(dx, dz), R]; }
export const SPAWN = { x: 36, z: 428, yaw: 0 };
export const PLATEAU = { x: 9000, z: 9000, r: 66, top: 41 }; // (the island has no plateau lake)
export const LAKE = { x: 9000, z: 9000, r: 30, y: 38.5 };
export const FALL = { x: 9000, z: 9000 };
export const VOLCANO = { x: 9000, z: 9000 };
// 0 ranger outpost (Kael), 1 Stonewatch lodge (Hilda), 2 goblin war camp, 3 goblin raider camp, 4 Gorgrak's Hold (the goblin chief, on the mountain)
export const CAMPS = [{ x: -40, z: 65, r: 26, h: null }, { x: -300, z: -150, r: 28, h: null }, { x: 285, z: -190, r: 30, h: null }, { x: 200, z: -62, r: 22, h: null }, { x: 40, z: -175, r: 30, h: null }];
export const RIVER = [[70, -40], [130, -12], [190, 20], [250, 58], [320, 104], [390, 148], [460, 190], [560, 232]];
export const ROADS = [
  [[0, 362], [3, 310], [5, 250], [-12, 170], [-28, 100], [-70, 40], [-150, -20], [-230, -100], [-260, -200], [-200, -300], [-90, -365], [20, -392]],
  [[5, 250], [70, 200], [150, 130], [215, 50], [250, -50], [262, -170], [200, -300], [100, -370], [20, -392]],
  [[0, 362], [-50, 376], [-120, 384]], [[0, 362], [50, 376], [110, 384]],
];
export const LAVA_POOLS = [];
export const BRIDGES = []; // filled at build: {x,z,ang,len,w,y}
// Kingdom Battles uses its own map: move the campaign landmarks out of the way
export function applyBattleTerrain() {
  ROADS.length = 0; ROADS.push(...roadPolylines());
  LAVA_POOLS.length = 0; CAMPS.length = 0; RIVER.length = 0; RIVER.push([9000, 9000], [9001, 9001]);
  VILLAGE.x = 9000; VILLAGE.z = 9000; PLATEAU.x = LAKE.x = 9000; PLATEAU.z = LAKE.z = 9000; VOLCANO.x = VOLCANO.z = 9000; FALL.x = FALL.z = 9000;
  const t0 = LAYOUT.towns[0]; SPAWN.x = t0.x; SPAWN.z = t0.z; SPAWN.yaw = t0.yaw;
}
if (BATTLE && LAYOUT.towns.length) applyBattleTerrain();
// the Training Yard: a plain field with nothing on it
if (YARD || ARENA) { ROADS.length = 0; LAVA_POOLS.length = 0; CAMPS.length = 0; RIVER.length = 0; RIVER.push([9000, 9000], [9001, 9001]); VILLAGE.x = VILLAGE.z = 9000; PORT.x = PORT.z = 9000; MOUNT.x = MOUNT.z = 9000; SPAWN.x = 0; SPAWN.z = 30; SPAWN.yaw = Math.PI; }

// the campaign is Goblin Island (gimap.js): its own clearings and trails, no Mount Kelda, no Saltmere, no river
if (GI) { CAMPS.length = 0; CAMPS.push(...giCamps()); ROADS.length = 0; ROADS.push(...ROADS_GI); RIVER.length = 0; RIVER.push([9000, 9000], [9001, 9001]); PORT.x = PORT.z = 9000; MOUNT.x = MOUNT.z = 9000; }
const jungle = (x, z) => { let h = 4.5 + fbm(x * 0.0035, z * 0.0035, 4) * 8 + fbm(x * 0.014 + 7, z * 0.014, 3) * 2.2; return Math.max(h, 2.4 + fbm(x * 0.02, z * 0.02, 2) * 0.6); };
function riverDist(x, z) { return distToLine(x, z, RIVER); }
function roadDist(x, z) { let best = 1e9; for (const r of ROADS) { const d = distToLine(x, z, r).d; if (d < best) best = d; } return best; }
export { roadDist };

// raw height function (analytic). The mesh samples it; gameplay uses the mesh samples via heightAt().
export function rawHeight(x, z, noCamps) {
  if (BATTLE) return battleHeight(x, z);
  if (ARENA) return 3; // the colosseum stands on flat ground
  if (YARD) return 3 + fbm(x * 0.01, z * 0.01, 2) * 0.6 + Math.max(0, Math.hypot(x, z) - 140) * 0.25; // a flat field, rising gently far away
  // rolling lowland with jungle hills
  let h = 4.5 + fbm(x * 0.0035, z * 0.0035, 4) * 8 + fbm(x * 0.014 + 7, z * 0.014, 3) * 2.2;
  h = Math.max(h, 2.4 + fbm(x * 0.02, z * 0.02, 2) * 0.6);
  h += smooth(120, 300, Math.abs(x)) * smooth(260, 80, z) * (fbm(x * 0.009 + 3, z * 0.009 - 2, 3) * 10 + 4); // jungle hills east and west
  // Mount Kelda: a rugged green peak in the middle of the island
  { const d = Math.hypot(x - MOUNT.x, z - MOUNT.z), k = clamp(1 - d / MOUNT.r, 0, 1), e = k * k * (3 - 2 * k);
    h += e * 62 + Math.pow(k, 2.4) * (40 + ridged(x * 0.007 + 4, z * 0.007 - 3, 4) * 46); }
  // the village and the port lie flat
  const dvl = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  h = lerp(h, 2.6 + fbm(x * 0.03, z * 0.03, 2) * 0.3, 1 - smooth(30, 52, dvl));
  const dpt = Math.hypot(x - PORT.x, z - PORT.z);
  h = lerp(h, 3.2 + fbm(x * 0.03, z * 0.03, 2) * 0.3, 1 - smooth(55, 85, dpt));
  if (!noCamps) for (const c of CAMPS) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r * 1.8) { if (c.flat == null) c.flat = rawHeight(c.x, c.z, true); h = lerp(h, c.flat, 1 - smooth(c.r * 0.7, c.r * 1.8, d)); } }
  if (GI) h = giShape(x, z, h, jungle); // Goblin Island: the gorge, the Crown Ridge and its cuts
  // the coast all the way round: beach, then the sea
  const [r, R] = isleR(x, z);
  if (GI && northCoast(x, z)) { h += 9 * smooth(R - 90, R - 30, r); h = lerp(h, -9, smooth(R - 14, R - 3, r)); } // Goblin Island: sea cliffs north of the gorge
  else {
  const beach = smooth(R - 62, R - 30, r);
  h = lerp(h, 1.1 + (h - 1.1) * 0.08, beach);
  h = lerp(h, -9, smooth(R - 18, R + 34, r)); }
  // river channel
  const rd = riverDist(x, z);
  if (rd.d < 60) {
    const w = 6.5 + rd.i * 0.4;
    const bed = -2.6;
    const bank = 6 + Math.max(0, h) * 0.55;
    h = Math.min(h, lerp(bed, h, smooth(w, w + bank, rd.d)));
  }
  return h;
}

// heightfield
export const heights = new Float32Array((SEG + 1) * (SEG + 1));
export function heightAt(x, z) {
  const gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
  if (gx < 0 || gz < 0 || gx >= SEG || gz >= SEG) return GI ? driftHeight(x, z) : -10; // (Goblos: Driftwood Key, out at sea past the grid)
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const i00 = iz * (SEG + 1) + ix, i10 = i00 + 1, i01 = i00 + SEG + 1, i11 = i01 + 1;
  if (fx + fz < 1) return heights[i00] + (heights[i10] - heights[i00]) * fx + (heights[i01] - heights[i00]) * fz;
  return heights[i11] + (heights[i01] - heights[i11]) * (1 - fx) + (heights[i10] - heights[i11]) * (1 - fz);
}
export function normalAt(x, z) { const e = 1.5; const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e); const n = new THREE.Vector3(-hx, 2 * e, -hz); return n.normalize(); }

export function zoneAt(x, z) {
  if (BATTLE || YARD || ARENA) return 'meadow';
  if (GI && Math.hypot(x - DRIFT.x, z - DRIFT.z) < DRIFT.r + 70) return 'drift'; // (Driftwood Key and its reef)
  const [r, R] = isleR(x, z);
  if (GI && r > R + 45) return 'sea'; // (well out from the shore)
  if (r > R - 70) return z < -250 ? 'north' : 'coast';
  if (Math.hypot(x - MOUNT.x, z - MOUNT.z) < MOUNT.r * 0.62) return 'highlands';
  if (z < -230) return 'north';
  if (z > 160 && Math.abs(x) < 330) return 'meadow';
  return 'wood';
}
export function biomeMasks(x, z) {
  if (YARD || ARENA) return { hl: 0, ash: 0, forest: 0, dry: 0, meadow: 1 };
  if (BATTLE) return { hl: 0, ash: 0, forest: clamp(fbm(x * 0.006 + 70, z * 0.006 - 30, 3) * 1.6, 0, 0.8), dry: clamp(fbm(x * 0.004 - 40, z * 0.004, 2) * 1.2, 0, 0.35), meadow: 1 };
  const dm = Math.hypot(x - MOUNT.x, z - MOUNT.z);
  return {
    hl: clamp((1 - dm / MOUNT.r) * 1.6, 0, 1) * 0.8, // the mountain: rockier, greyer grass
    ash: 0,
    forest: clamp(smooth(150, 60, z) * (0.55 + smooth(80, 260, Math.abs(x)) * 0.45) * (1 - smooth(-200, -280, z) * 0.6) + smooth(0.62, 0.4, dm / MOUNT.r) * 0.3, 0, 1),
    dry: 0.05,
    meadow: smooth(150, 220, z) + smooth(-240, -300, z) * 0.6,
  };
}
export function beachMask(x, z) { if (BATTLE || YARD || ARENA) return 0; const [r, R] = isleR(x, z); return smooth(R - 66, R - 36, r); }
export function isWater(x, z) { return heightAt(x, z) < SEA - 0.4 || (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r && heightAt(x, z) < LAKE.y - 0.3); }
export function waterLevelAt(x, z) { if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4 || (Math.hypot(x - PLATEAU.x, z - PLATEAU.z) < PLATEAU.r && heightAt(x, z) > 20)) return LAKE.y; return SEA; }

// ---------- terrain mesh ----------
function detailTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const v = fbm(x / 256 * 8 * 6.283 / 6.283, y / 256 * 8, 3);
    const k = 228 + v * 26 + (Math.random() - 0.5) * 14 | 0;
    const i = (y * 256 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, k); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(260, 260); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const C = (h) => new THREE.Color(h);
const COL = {
  sand: C('#dcc68e'), wetSand: C('#b49e6c'), grass: C('#6aa443'), grass2: C('#8ab64e'), forest: C('#3c7330'), forest2: C('#2f5e28'),
  hlGrass: C('#6d8a5c'), rock: C('#77716a'), rock2: C('#5e5852'), snow: C('#eef3f8'), ash: C('#3a302c'), ash2: C('#57291a'), basalt: C('#2a2624'),
  road: C('#8a7352'), dry: C('#a08c48'), dry2: C('#8a6a38'), scorch: C('#5a4a34'), mud: C('#5a4a36'), river: C('#6a6050'), plateau: C('#5e8a48'),
};
export function buildTerrain(scene) {
  const N = SEG + 1;
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
    const h = rawHeight(x, z); heights[iz * N + ix] = h;
    const i = iz * N + ix; pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z; uv[i * 2] = ix / SEG; uv[i * 2 + 1] = iz / SEG;
  }
  const idx = new Uint32Array(SEG * SEG * 6); let k = 0;
  for (let iz = 0; iz < SEG; iz++) for (let ix = 0; ix < SEG; ix++) {
    const a = iz * N + ix, b = a + 1, c = a + N, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = c; idx[k++] = d; idx[k++] = b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal.array;
  const tmp = new THREE.Color();
  // Goblos: painted ground (the owner's Meshy textures): how much grass, jungle floor, sand, dirt and rock at each point
  const SPL = GI ? new Float32Array(N * N * 4) : null, SPR = GI ? new Float32Array(N * N) : null, W = [0, 0, 0, 0, 0];
  const wl = (k, t) => { if (!(t > 0)) return; for (let q = 0; q < 5; q++) W[q] *= 1 - t; W[k] += t; }; // (lerp toward one layer, like the colours)
  for (let i = 0; i < N * N; i++) {
    const x = pos[i * 3], h = pos[i * 3 + 1], z = pos[i * 3 + 2], ny = nrm[i * 3 + 1];
    const m = biomeMasks(x, z);
    const n = fbm(x * 0.05, z * 0.05, 2) * 0.5 + 0.5, n2 = fbm(x * 0.012 + 9, z * 0.012, 2) * 0.5 + 0.5;
    // base grass
    if (GI) { W[0] = 1; W[1] = W[2] = W[3] = W[4] = 0; wl(1, clamp(m.forest, 0, 1) * 0.9 + (n2 > 0.62 ? (n2 - 0.62) * 1.5 : 0)); }
    tmp.copy(COL.grass).lerp(COL.grass2, n);
    tmp.lerp(COL.forest, clamp(m.forest, 0, 1) * 0.85); tmp.lerp(COL.forest2, m.forest * n2 * 0.5);
    tmp.lerp(COL.hlGrass, clamp(m.hl * 1.3, 0, 1));
    // dry autumn band, then scorched earth, then ash
    const dryK = clamp(m.dry * (1 - m.hl * 0.8), 0, 1);
    tmp.lerp(n > 0.5 ? COL.dry : COL.dry2, dryK * 0.85);
    tmp.lerp(COL.scorch, smooth(0.05, 0.4, m.ash));
    tmp.lerp(COL.ash, smooth(0.3, 0.75, m.ash)); if (m.ash > 0.3) tmp.lerp(COL.ash2, Math.pow(n, 3) * m.ash);
    // plateau grass
    if (Math.hypot(x - PLATEAU.x, z - PLATEAU.z) < PLATEAU.r) tmp.lerp(COL.plateau, 0.6);
    // slope rock
    const steep = smooth(0.86, 0.68, ny);
    tmp.lerp(m.ash > 0.4 ? COL.basalt : n > 0.5 ? COL.rock : COL.rock2, steep); if (GI) wl(4, steep + smooth(60, 130, h) * 0.35);
    // snow
    const snowLine = 52 + n2 * 14;
    if (BATTLE && m.ash < 0.3) tmp.lerp(COL.snow, smooth(snowLine, snowLine + 10, h) * smooth(0.5, 0.75, ny) * clamp(m.hl * 2 + (h > 90 ? 1 : 0), 0, 1));
    // beach & underwater
    const bm = beachMask(x, z);
    if (h < 2.6 && m.ash < 0.3) { tmp.lerp(COL.sand, smooth(2.6, 1.5, h) * Math.max(bm, h < 0.8 ? 1 : 0)); if (GI) wl(2, smooth(2.6, 1.5, h) * Math.max(bm, h < 0.8 ? 1 : 0)); }
    if (h < 0.2) tmp.lerp(COL.wetSand, smooth(0.2, -1.5, h));
    // river bed
    const rd = riverDist(x, z).d;
    if (rd < 14 && h < 4) tmp.lerp(COL.mud, smooth(14, 6, rd) * 0.7);
    // Brook Run's bed: wet pebbles and sand, mossy dark banks
    if (GI) { const cr = creekNear(x, z); if (cr.d < CREEK_W + 4) { const kb = smooth(CREEK_W + 4, CREEK_W - 0.5, cr.d); wl(2, kb * 0.55); wl(4, smooth(CREEK_W + 1, CREEK_W - 1, cr.d) * 0.5); tmp.lerp(COL.mud, kb * 0.5); } }
    // roads
    const roadD = roadDist(x, z);
    if (GI && roadD < 4.5 && h > 0.4) wl(3, smooth(4.5, 1.8, roadD) * 0.95);
    if (roadD < 4.5 && h > 0.4) tmp.lerp(BATTLE && m.hl > 0.6 && h > snowLine ? COL.snow : COL.road, smooth(4.5, 1.8, roadD) * 0.9);
    // village dirt
    const dvl = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    if (dvl < 26) tmp.lerp(COL.road, (1 - dvl / 26) * 0.45 * (0.5 + n * 0.5));
    if (BATTLE) for (const t of LAYOUT.towns) { const d = Math.hypot(x - t.x, z - t.z); if (d < WALL_R + 6) tmp.lerp(COL.road, (0.35 + (1 - d / (WALL_R + 6)) * 0.25) * (0.6 + n * 0.4)); }
    for (const c of CAMPS) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r) { tmp.lerp(m.hl > 0.5 ? COL.rock2 : COL.road, (1 - d / c.r) * 0.5); if (GI) wl(3, (1 - d / c.r) * 0.75 * (0.6 + n * 0.4)); } }
    if (GI) { SPL[i * 4] = W[0]; SPL[i * 4 + 1] = W[1]; SPL[i * 4 + 2] = W[2]; SPL[i * 4 + 3] = W[3]; SPR[i] = W[4]; }
    for (const p of LAVA_POOLS) { const d = Math.hypot(x - p[0], z - p[1]); if (d < p[2] + 6) tmp.lerp(COL.basalt, smooth(p[2] + 6, p[2], d)); }
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: GI ? null : detailTexture() });
  if (GI) { geo.setAttribute('splat', new THREE.BufferAttribute(SPL, 4)); geo.setAttribute('splatR', new THREE.BufferAttribute(SPR, 1)); paintedGround(mat); }
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}

// Goblos: the painted ground shader (grass, jungle floor, sand, dirt, rock), each sampled at two sizes so the repeats
// don't show, cliffs mapped from the side; the old vertex colours only shade it lightly. Until the pictures load it is plain.
function paintedGround(mat) {
  const L = new THREE.TextureLoader(), tex = {};
  for (const n of ['grass', 'jungle', 'sand', 'dirt', 'rock']) { const t = L.load(`models/gi/tex/${n}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; tex[n] = t; }
  mat.onBeforeCompile = (sh) => {
    for (const n in tex) sh.uniforms['t_' + n] = { value: tex[n] };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat; attribute float splatR; varying vec4 vSplat; varying float vRockW; varying vec3 vWP; varying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vRockW = splatR; vWP = (modelMatrix * vec4(position, 1.0)).xyz; vWN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D t_grass, t_jungle, t_sand, t_dirt, t_rock; varying vec4 vSplat; varying float vRockW; varying vec3 vWP; varying vec3 vWN;\nvec3 two(sampler2D t, vec2 p, float s) { return mix(texture2D(t, p / s).rgb, texture2D(t, p / (s * 3.3) + 0.37).rgb, 0.45); }')
      .replace('#include <map_fragment>', `
        vec2 P = vWP.xz; vec3 an = abs(normalize(vWN)); vec3 bw = an / (an.x + an.y + an.z);
        vec3 rk = two(t_rock, vWP.zy, 16.0) * bw.x + two(t_rock, P, 16.0) * bw.y + two(t_rock, vWP.xy, 16.0) * bw.z;
        float sum = vSplat.x + vSplat.y + vSplat.z + vSplat.w + vRockW + 1e-4;
        vec3 gr = two(t_grass, P, 9.0); gr = mix(gr, vec3(dot(gr, vec3(0.3, 0.59, 0.11))) * vec3(0.8, 1.0, 0.7), 0.18); // (the grass a touch calmer)
        vec3 ground = (gr * vSplat.x + two(t_jungle, P, 8.0) * vSplat.y + two(t_sand, P, 9.0) * vSplat.z + two(t_dirt, P, 7.0) * vSplat.w + rk * vRockW) / sum;
        diffuseColor.rgb *= ground;`)
      .replace('#include <color_fragment>', '#if defined( USE_COLOR )\n diffuseColor.rgb *= 0.82 + 0.4 * clamp(dot(vColor, vec3(0.3, 0.59, 0.11)) * 1.6, 0.0, 1.0);\n#endif'); // (the old colours only lighten or darken it a little)
  };
  mat.customProgramCacheKey = () => 'paintedGround';
}

// ---------- water ----------
// The sea, the gorge's river and Brook Run share one look: rolling Gerstner swells that calm down in the shallows,
// drifting ripples (analytic noise normals), a sky reflection that grows at grazing angles, a sharp sun highlight with
// glitter, clear turquoise shallows over sunlit caustics, fading to deep blue, and foam that laps up the beach in waves.
// Running water (the gorge, the creek) is advected along a flow field so it visibly runs downstream, with white water
// streaks and foam round the rocks standing in it.
function heightTexture() {
  const N = 512, data = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -HALF + (i + 0.5) / N * HALF * 2, z = -HALF + (j + 0.5) / N * HALF * 2; data[j * N + i] = THREE.DataUtils.toHalfFloat(heightAt(x, z)); }
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
// where the sea runs as a river (Goblos: the Great Gorge, west to east): a flow vector in m/s per texel, zero elsewhere
function flowTexture() {
  const N = 256, data = new Uint16Array(N * N * 2), H = THREE.DataUtils.toHalfFloat;
  if (GI) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -HALF + (i + 0.5) / N * HALF * 2, z = -HALF + (j + 0.5) / N * HALF * 2, r = distToLine(x, z, GORGE);
    if (r.d > GORGE_W + 14) continue;
    const seg = (k) => { const a = GORGE[Math.max(0, Math.min(GORGE.length - 2, k))], b = GORGE[Math.max(0, Math.min(GORGE.length - 2, k)) + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
    const d0 = seg(r.i), d1 = r.t > 0.5 ? seg(r.i + 1) : seg(r.i - 1), w = Math.abs(r.t - 0.5) > 0.3 ? (Math.abs(r.t - 0.5) - 0.3) / 0.4 * 0.5 : 0; // (blend into the next stretch near the bends)
    let fx = d0[0] * (1 - w) + d1[0] * w, fz = d0[1] * (1 - w) + d1[1] * w; const l = Math.hypot(fx, fz) || 1;
    const sp = 2.6 * (1 - smooth(GORGE_W - 3, GORGE_W + 12, r.d) * 0.7) * smooth(590, 500, Math.abs(x)); // (fastest down the middle, slack by the walls, calm where it meets the sea)
    data[(j * N + i) * 2] = H(fx / l * sp); data[(j * N + i) * 2 + 1] = H(fz / l * sp);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
const WATER_GLSL = `
  float hsh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
  // value noise and its slope (x: value, yz: d/dx, d/dy)
  vec3 vnd(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
    float a = hsh(i), b = hsh(i + vec2(1, 0)), c = hsh(i + vec2(0, 1)), d = hsh(i + vec2(1, 1)), k = a - b - c + d;
    return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * (vec2(b - a, c - a) + k * u.yx)); }
  // wind ripples on still water: four octaves drifting different ways; returns the surface slope (fine octaves fade with distance)
  vec2 ripples(vec2 p, float t, float far){ vec2 g = vec2(0.0);
    g += vnd(p * 0.16 + vec2(t * 0.045, t * 0.03)).yz * 0.16 * 0.55;
    g += vnd(p * 0.42 + vec2(-t * 0.09, t * 0.11) + 3.1).yz * 0.42 * 0.2;
    #ifndef LOWQ
    g += vnd(p * 1.1 + vec2(t * 0.16, -t * 0.21) + 7.7).yz * 1.1 * 0.07 * (1.0 - far * 0.7);
    g += vnd(p * 2.7 + vec2(-t * 0.3, -t * 0.24) + 1.9).yz * 2.7 * 0.025 * (1.0 - far);
    #endif
    return g; }
  // running water in the flow's own frame: ripples stretched along the current, streaks of white water (x,y: slope, z: streak, w: fine noise)
  vec4 flowLayer(vec2 p, vec2 fd){ vec2 pr = vec2(-fd.y, fd.x), q = vec2(dot(p, fd), dot(p, pr));
    vec3 a = vnd(vec2(q.x * 0.28, q.y * 0.85)), b = vnd(vec2(q.x * 0.75, q.y * 1.9) + 11.0), c = vnd(q * 2.4 + 5.0);
    vec2 sq = a.yz * vec2(0.28, 0.85) * 0.3 + b.yz * vec2(0.75, 1.9) * 0.1 + c.yz * 2.4 * 0.03;
    return vec4(fd * sq.x + pr * sq.y, a.x * 0.6 + b.x * 0.4, c.x); }
  // caustics: a bright net of light on the bottom of the shallows
  float caustic(vec2 p, float t){ float c1 = vn(p + vec2(t * 0.35, t * 0.22)), c2 = vn(p * 1.3 - vec2(t * 0.28, -t * 0.19) + 5.3); float c = 1.0 - abs(c1 - c2); return pow(c, 9.0); }
  vec3 skyRefl(vec3 R, vec3 hor, vec3 top){ return mix(hor, top, smoothstep(-0.05, 0.55, R.y)); }
`;
// the swells, shared with JS (seaWaveY) so boats can ride them: [kind 0 rolling in to the island / 1 one way, dirX, dirZ, wavelength, height, sideways push]
const ISLE_C = new THREE.Vector2(0, -15);
const WAVES = [[0, 0, 0, 46, 0.32, 0.55], [0, 0, 0, 74, 0.24, 0.5], [1, 0.8, 0.6, 58, 0.2, 0.5], [1, -0.5, 0.86, 41, 0.13, 0.5]];
const GLSL_WAVES = WAVES.map(([k, dx, dz, L, A, Q]) => `wave(p, ${k ? `vec2(${dx.toFixed(3)}, ${dz.toFixed(3)}), 0.0` : 'normalize(isleC - p + vec2(1e-3)), 1.0'}, ${L.toFixed(1)}, ${A.toFixed(3)} * sh, ${Q.toFixed(2)}, t, d, n);`).join('\n      ');
// height of the sea surface at (x, z) at time t, for things that float (boats, barrels): the same swells the sea draws.
// Pass the water depth there (level minus ground) if known: the swells calm down in the shallows the same way.
export function seaWaveY(x, z, t, depth = 20) {
  const sh = smooth(0.3, 6, depth) * (0.35 + 0.65 * smooth(1, 14, depth)); let y = 0;
  for (const [k, dx0, dz0, L, A] of WAVES) { const kk = 6.2832 / L, c = Math.sqrt(9.8 / kk); let ph;
    if (k === 0) ph = -kk * Math.hypot(x - ISLE_C.x, z - ISLE_C.y) - kk * c * t; else ph = kk * (dx0 * x + dz0 * z - c * t);
    y += A * sh * Math.sin(ph); }
  return SEA + y;
}
// waveHeight(x, z, t): how far the sea surface at world (x, z) is raised (or lowered) by the swells, in metres, at time t.
// Pass G.time (the sea shader's time uniform is G.time). It is exactly the vertical part of the sea vertex shader: the same
// four swells, damped over shallows from the ground height there (heightAt; open sea outside the terrain grid). The swells
// also push the surface sideways a little (up to ~0.6 m); a floating ship can ignore that. Add SEA for the absolute height.
export function waveHeight(x, z, t) { return seaWaveY(x, z, t, SEA - heightAt(x, z)) - SEA; }
export function buildWater(scene) {
  const htex = heightTexture(), ftex = flowTexture();
  const rocks = GI ? gorgeRocks() : []; while (rocks.length < 8) rocks.push([9e4, 9e4, 0]);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    time: { value: 0 }, hmap: { value: null }, flowMap: { value: null }, level: { value: 0 }, halfW: { value: HALF }, waves: { value: 1 },
    deep: { value: new THREE.Color('#0b4068') }, shallow: { value: new THREE.Color('#2f9fae') }, sky: { value: new THREE.Color('#9cc8ea') }, skyTop: { value: new THREE.Color('#3a78c8') },
    sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, sunCol: { value: new THREE.Color('#fff2d0') }, flow: { value: 0 }, light: { value: 1 }, trop: { value: GI ? 1 : 0 },
    rocks: { value: rocks.slice(0, 8).map(r => new THREE.Vector3(r[0], r[1], r[2])) }, isleC: { value: ISLE_C },
  }]);
  const vert = `
    uniform float time, level, halfW, waves; uniform sampler2D hmap; uniform vec2 isleC;
    varying vec3 vW; varying vec3 vN; varying float vCrest;
    #include <fog_pars_vertex>
    vec3 wave(vec2 p, vec2 dir, float radial, float L, float A, float Q, float t, inout vec3 d, inout vec3 n){
      float k = 6.2832 / L, c = sqrt(9.8 / k);
      float ph = radial > 0.5 ? -k * length(p - isleC) - k * c * t : k * (dot(dir, p) - c * t);
      float s = sin(ph), co = cos(ph), wa = k * A;
      d += vec3(dir.x * Q * A * co, A * s, dir.y * Q * A * co);
      n += vec3(-dir.x * wa * co, -Q * wa * s, -dir.y * wa * co);
      return d; }
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec2 p = w.xz; float t = time;
      float depth = level - texture2D(hmap, (p + halfW) / (halfW * 2.0)).r;
      float sh = smoothstep(0.3, 6.0, depth) * (0.35 + 0.65 * smoothstep(1.0, 14.0, depth)) * waves; // (the swells die down over the shallows: no water climbing the beach)
      vec3 d = vec3(0.0), n = vec3(0.0, 1.0, 0.0);
      ${GLSL_WAVES}
      w.xyz += d; vN = normalize(n); vCrest = d.y / 0.9; vW = w.xyz;
      vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const frag = `
    uniform float time, level, halfW, flow, light, trop; uniform sampler2D hmap, flowMap; uniform vec3 deep, shallow, sky, skyTop, sunDir, sunCol; uniform vec3 rocks[8];
    varying vec3 vW; varying vec3 vN; varying float vCrest;
    #include <fog_pars_fragment>
    ${WATER_GLSL}
    void main(){
      vec2 p = vW.xz, uv = (p + halfW) / (halfW * 2.0);
      float depth = level - texture2D(hmap, uv).r;
      vec3 V = cameraPosition - vW; float dist = length(V); V /= dist; float far = smoothstep(40.0, 260.0, dist);
      float t = time;
      // running water: two advected layers that hand over to each other, so it flows forever without stretching
      vec2 fl = texture2D(flowMap, uv).rg; float fs = length(fl); vec2 slope; float streak = 0.0, fine = 0.5;
      if (fs > 0.05) { vec2 fd = fl / fs; float T = 3.0, ph0 = fract(t / T), ph1 = fract(t / T + 0.5), w0 = 1.0 - abs(1.0 - 2.0 * ph0);
        vec4 A = flowLayer((p - fl * ph0 * T) * 1.4, fd), B = flowLayer((p - fl * ph1 * T) * 1.4 + vec2(17.3, 5.1), fd);
        vec4 F = A * w0 + B * (1.0 - w0); float kf = smoothstep(0.05, 0.6, fs);
        slope = mix(ripples(p, t, far), F.xy * (0.7 + fs * 0.25), kf); streak = F.z * kf; fine = F.w;
      } else slope = ripples(p, t, far);
      vec3 N = normalize(vN + vec3(-slope.x, 0.0, -slope.y) * mix(1.0, 0.3, far));
      float ndv = max(dot(N, V), 0.0);
      float fres = 0.04 + 0.96 * pow(1.0 - ndv, 4.0);
      // the water's own colour: clear turquoise over sand, through teal, to deep blue
      float ab = 1.0 - exp(-max(depth, 0.0) * 0.2);
      vec3 tq = vec3(0.1, 0.78, 0.74);
      vec3 col = mix(mix(shallow, tq, trop * 0.8), mix(shallow, vec3(0.06, 0.5, 0.7), trop), smoothstep(0.0, 0.55, ab)); col = mix(col, deep, smoothstep(0.4, 1.0, ab)); // (turquoise, a bright sea blue, then the deep)
      col = mix(col, deep * 0.7, smoothstep(9.0, 30.0, depth) * 0.6);
      // sunlight through the waves: crests glow a lighter green-blue
      col += vec3(0.05, 0.22, 0.2) * clamp(vCrest + 0.35, 0.0, 1.0) * (1.0 - ab * 0.3) * (0.4 + 0.6 * max(dot(sunDir, vec3(0, 1, 0)), 0.0));
      // caustics dancing on the shallow bottom
      float sz = smoothstep(4.5, 0.4, depth) * smoothstep(-0.2, 0.3, depth);
      col += vec3(0.75, 0.95, 0.85) * caustic(p * 0.55 + N.xz * 0.4, t) * sz * (0.35 + 0.35 * trop) * (1.0 - far);
      // reflections: the sky (more at grazing angles), the sun's highlight and a glitter of sparkles
      vec3 R = reflect(-V, N); vec3 refl = mix(skyRefl(R, sky, skyTop), skyTop, 0.2);
      col = mix(col, refl, clamp(fres * 0.65, 0.0, 0.5));
      float sd = max(dot(R, sunDir), 0.0);
      vec3 spec = sunCol * (pow(sd, 900.0) * 4.0 + pow(sd, 90.0) * 0.45 + pow(sd, 10.0) * 0.05);
      #ifndef LOWQ
      float gl = smoothstep(0.86, 0.97, vn(p * 5.5 + N.xz * 14.0 + t * 0.7)) * smoothstep(0.4, 0.9, vn(p * 12.0 - t * 1.3));
      spec += sunCol * gl * pow(sd, 5.0) * 3.0 * (1.0 - far * 0.6); // (glitter: tiny sparks that wink on and off)
      #endif
      // foam: the line where the water meets the sand breathes in and out; waves of foam roll in to the beach; white water on the river
      float nf = vn(p * 0.35 + t * 0.05), nf2 = vn(p * 1.7 - t * 0.2);
      float lap = 0.25 + 0.22 * sin(t * 0.85 + nf * 4.0) + 0.1 * sin(t * 1.9 + p.x * 0.05);
      float foam = smoothstep(lap + 0.26, lap - 0.02, depth) * (0.55 + 0.45 * smoothstep(0.3, 0.6, nf2));
      float roll = fract(depth * 0.7 + t * 0.22 + nf * 0.5);
      float band = smoothstep(0.0, 0.04, roll) * smoothstep(0.3 + depth * 0.05, 0.06, roll); // (a sharp front, a fading tail)
      foam += band * smoothstep(3.6, 0.4, depth) * smoothstep(-0.2, 0.15, depth) * smoothstep(0.22, 0.5, nf2) * trop;
      foam += smoothstep(0.55, 1.0, vCrest) * smoothstep(0.62, 0.82, nf2 * 0.6 + vn(p * 0.6 + t * 0.1) * 0.4) * 0.55 * smoothstep(6.0, 12.0, depth); // (whitecaps out at sea)
      if (fs > 0.05) { foam += smoothstep(0.7, 0.8, streak + fine * 0.12) * 0.7 * smoothstep(0.4, 1.6, fs);
        foam += smoothstep(3.5, 0.5, depth) * smoothstep(0.45, 0.7, fine) * 0.8; // (churned up against the walls)
        vec2 fd = fl / fs, pr = vec2(-fd.y, fd.x);
        for (int i = 0; i < 8; i++) { vec2 o = p - rocks[i].xy; float r = rocks[i].z, dd = length(o) - r; if (dd > 26.0) continue;
          foam += smoothstep(1.4, 0.0, dd) * (0.6 + 0.5 * nf2); // (a collar of foam where the current hits the rock)
          float al = dot(o, fd), sd2 = abs(dot(o, pr)); if (al > 0.0) foam += exp(-sd2 / (r * 0.55 + al * 0.12)) * exp(-al / 14.0) * smoothstep(0.35, 0.75, streak + nf2 * 0.3) * 1.2; } } // (and a white wake trailing downstream)
      foam = clamp(foam, 0.0, 1.0) * smoothstep(-0.35, 0.05, depth);
      vec3 foamCol = vec3(0.93, 0.97, 1.0) * (0.7 + 0.3 * max(sunDir.y, 0.0));
      col = mix(col, foamCol, foam * 0.92);
      col *= light; col += spec * (1.0 - foam);
      float a = clamp(0.3 + max(depth, 0.0) * 0.28 + fres * 0.4 + foam, 0.0, 0.97);
      a = mix(a, 1.0, far * 0.3);
      gl_FragColor = vec4(col, min(a, 0.97));
      #include <fog_fragment>
    }`;
  const mk = (level) => { const u = THREE.UniformsUtils.clone(uniforms); u.hmap.value = htex; u.flowMap.value = ftex; u.level.value = level; u.rocks.value = uniforms.rocks.value; u.isleC.value = ISLE_C; return new THREE.ShaderMaterial({ uniforms: u, vertexShader: vert, fragmentShader: frag, transparent: true, fog: true, depthWrite: false, defines: settings.quality === 'low' ? { LOWQ: 1 } : {} }); }; // (low quality: fewer ripple octaves, no glitter)
  const seaMat = mk(SEA);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 2000, HALF * 2 + 2000, 200, 200).rotateX(-Math.PI / 2), seaMat);
  sea.position.y = SEA; sea.renderOrder = 2; scene.add(sea);
  const lakeMat = mk(LAKE.y); lakeMat.uniforms.waves.value = 0.25;
  const lakeGeo = new THREE.CircleGeometry(LAKE.r + 8, 48).rotateX(-Math.PI / 2);
  const lake = new THREE.Mesh(lakeGeo, lakeMat); lake.position.set(LAKE.x, LAKE.y, LAKE.z); lake.renderOrder = 2; scene.add(lake);
  // stream strip to lip
  const sx = LAKE.x + 20, sz = LAKE.z + 4, len = Math.hypot(FALL.x - sx, FALL.z - sz);
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(len + 2, 9, 20, 2).rotateX(-Math.PI / 2), lakeMat);
  stream.position.set((sx + FALL.x) / 2, LAKE.y - 0.4, (sz + FALL.z) / 2); stream.rotation.y = -Math.atan2(FALL.z - sz, FALL.x - sx); stream.renderOrder = 2; scene.add(stream);
  const mats = [seaMat, lakeMat];
  if (GI) mats.push(buildCreek(scene, uniforms));
  return { mats, sea };
}
// Brook Run (Goblos): a ribbon of running water laid in its carved bed, from the spring down the cascade to the sea.
// The banks clip its edges, so its shore follows the ground. Water runs faster (and whiter) where the bed is steep.
function buildCreek(scene, base) {
  const pts = []; // resample the creek every metre: position, direction, bed height, distance along, speed
  for (let i = 0; i < CREEK.length - 1; i++) { const [ax, az, ay] = CREEK[i], [bx, bz, by] = CREEK[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L));
    for (let k = 0; k < n; k++) { const t = k / n; pts.push([ax + (bx - ax) * t, az + (bz - az) * t, ay + (by - ay) * t, (ay - by) / L]); } }
  pts.push([CREEK[CREEK.length - 1][0], CREEK[CREEK.length - 1][1], CREEK[CREEK.length - 1][2], 0.05]);
  // smooth the direction and slope a little so the bends and the cascade's foot don't kink
  const dir = pts.map((p, i) => { const a = pts[Math.max(0, i - 3)], b = pts[Math.min(pts.length - 1, i + 3)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
  const slope = pts.map((p, i) => { let s = 0, n = 0; for (let k = -4; k <= 4; k++) { const q = pts[Math.max(0, Math.min(pts.length - 1, i + k))]; s += q[3]; n++; } return s / n; });
  const ACR = 9, HW = CREEK_W + 1.4, P = [], S = [], Vv = [], SP = [], D = [], WD = [], idx = [];
  let along = 0;
  pts.forEach((p, i) => { if (i) along += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const [dx, dz] = dir[i], nx = -dz, nz = dx;
    let low = Infinity; for (const o of [-1.2, 0, 1.2]) low = Math.min(low, heightAt(p[0] + nx * o, p[1] + nz * o)); // (the mesh's own channel bottom: water always shows above it)
    const y = Math.max(p[2] + CREEK_DEPTH, low + 0.3, SEA + 0.04), sp = Math.min(6, 0.9 + Math.max(0, slope[i]) * 14);
    for (let j = 0; j < ACR; j++) { const v = j / (ACR - 1) * 2 - 1, px = p[0] + nx * v * HW, pz = p[1] + nz * v * HW; P.push(px, y, pz); S.push(along); Vv.push(v); SP.push(sp); D.push(dx, dz); WD.push(y - heightAt(px, pz)); } }); // (WD: how deep the water is over the ground there: it thins out to nothing at the banks)
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < ACR - 1; j++) { const a = i * ACR + j, b = a + 1, c = a + ACR, d = c + 1; idx.push(a, b, c, b, d, c); } // (wound to face up)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 1)); g.setAttribute('aV', new THREE.Float32BufferAttribute(Vv, 1));
  g.setAttribute('aSp', new THREE.Float32BufferAttribute(SP, 1)); g.setAttribute('aD', new THREE.Float32BufferAttribute(WD, 1)); g.setAttribute('aDir', new THREE.Float32BufferAttribute(D, 2)); g.setIndex(idx); g.computeBoundingSphere();
  const rocks = CREEK_ROCKS.map(r => new THREE.Vector3(r[0], r[1], r[2])); while (rocks.length < 12) rocks.push(new THREE.Vector3(9e4, 9e4, 0));
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, sky: { value: base.sky.value.clone() }, skyTop: { value: base.skyTop.value.clone() }, sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, sunCol: { value: new THREE.Color('#fff2d0') }, light: { value: 1 }, total: { value: along } }]);
  u.rocks = { value: rocks.slice(0, 12) };
  const mat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, fog: true,
    vertexShader: `attribute float aS, aV, aSp, aD; attribute vec2 aDir; varying float vS, vV, vSp, vD; varying vec2 vDir; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vS = aS; vV = aV; vSp = aSp; vD = aD; vDir = aDir; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time, light, total; uniform vec3 sky, skyTop, sunDir, sunCol; uniform vec3 rocks[12]; varying float vS, vV, vSp, vD; varying vec2 vDir; varying vec3 vW;
      #include <fog_pars_fragment>
      ${WATER_GLSL}
      void main(){
        vec2 p = vW.xz, fd = normalize(vDir), pr = vec2(-fd.y, fd.x); float t = time;
        vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
        float T = 2.0, ph0 = fract(t / T), ph1 = fract(t / T + 0.5), w0 = 1.0 - abs(1.0 - 2.0 * ph0);
        vec2 fl = fd * vSp;
        vec4 F = flowLayer(p * 1.6 - fl * 1.6 * ph0 * T, fd) * w0 + flowLayer(p * 1.6 - fl * 1.6 * ph1 * T + vec2(9.1, 3.3), fd) * (1.0 - w0);
        float white = smoothstep(1.8, 4.5, vSp) * 0.7; // (the cascade: churning white water)
        vec3 N = normalize(vec3(-F.x, 1.0, -F.y) * vec3(1.0 + white, 1.0, 1.0 + white));
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
        float acr = abs(vV), dep = smoothstep(0.0, 0.9, vD); // (deepest down the middle, thinning to the banks)
        vec3 col = mix(vec3(0.2, 0.64, 0.6), vec3(0.04, 0.27, 0.38), dep);
        col += vec3(0.7, 0.95, 0.8) * caustic(p * 1.3 - fl * t * 0.3, t * 1.5) * (0.25 + 0.3 * (1.0 - dep));
        vec3 R = reflect(-V, N); col = mix(col, skyRefl(R, sky, skyTop), clamp(fres * 0.6, 0.0, 0.42));
        float sd = max(dot(R, sunDir), 0.0); vec3 spec = sunCol * (pow(sd, 500.0) * 4.0 + pow(sd, 60.0) * 0.5);
        spec += sunCol * smoothstep(0.75, 0.95, vn(p * 4.0 + N.xz * 8.0 + t)) * pow(sd, 5.0) * 1.8;
        // foam: streaks riding the current, a frill along the banks, collars and wakes round the rocks, white water down the cascade
        float foam = smoothstep(0.68, 0.86, F.z + F.w * 0.2) * 0.55;
        foam += smoothstep(0.3, 0.06, vD) * smoothstep(0.4, 0.7, F.w + F.z * 0.4) * 0.7; // (a lacy frill where it laps the banks)
        foam = mix(foam, 1.0, white * smoothstep(0.35, 0.62, F.z * 0.7 + F.w * 0.5));
        for (int i = 0; i < 12; i++) { vec2 o = p - rocks[i].xy; float r = rocks[i].z, dd = length(o) - r; if (dd > 8.0) continue;
          foam += smoothstep(0.55, 0.0, dd) * (0.7 + 0.3 * F.w);
          float al = dot(o, fd), sd2 = abs(dot(o, pr)); if (al > 0.0) foam += exp(-sd2 / (r * 0.45 + al * 0.1)) * exp(-al / 4.0) * smoothstep(0.3, 0.7, F.z + F.w * 0.3); }
        foam = clamp(foam, 0.0, 1.0);
        col = mix(col, vec3(0.94, 0.98, 1.0), foam * 0.9);
        col *= light; col += spec * (1.0 - foam);
        float a = (0.5 + dep * 0.42 + fres * 0.15 + foam * 0.4) * smoothstep(-0.02, 0.12, vD) * smoothstep(1.0, 0.7, acr) * smoothstep(0.0, 1.5, vS) * smoothstep(total, total - 6.0, vS);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.96));
        #include <fog_fragment>
      }` });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 2; m.frustumCulled = true; scene.add(m);
  return mat;
}

// waterfall: a curtain of falling water from the lip to the river, with mist
export function buildWaterfall(scene) {
  const top = LAKE.y - 0.4, bottom = SEA - 0.5, h = top - bottom;
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, light: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += pow(1.0-uv.y, 2.0)*6.0 - 0.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);} `,
    fragmentShader: `uniform float time, light; varying vec2 vUv; float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){ vec2 q = vec2(vUv.x*14.0, vUv.y*3.0 + time*2.6); float s = n(q)*0.6 + n(q*2.7+3.0)*0.4;
        float streak = smoothstep(0.35, 0.85, s); vec3 c = mix(vec3(0.55,0.75,0.85), vec3(0.97,0.99,1.0), streak) * light;
        float edge = smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x);
        gl_FragColor = vec4(c, (0.55 + streak*0.4)*edge); }`,
  });
  const g = new THREE.PlaneGeometry(10, h, 12, 24);
  g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.position.set(FALL.x + 1.5, top, FALL.z); m.rotation.y = -Math.PI / 2; m.renderOrder = 3;
  scene.add(m);
  return { mat, base: new THREE.Vector3(FALL.x + 6, SEA, FALL.z), top: new THREE.Vector3(FALL.x, top, FALL.z) };
}

// ---------- sky ----------
export function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, top: { value: new THREE.Color('#3a78c8') }, horizon: { value: new THREE.Color('#bfe0f5') }, sunCol: { value: new THREE.Color('#fff4d8') }, night: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 sunDir, top, horizon, sunCol; uniform float night, time; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=fract(sin(dot(i,vec2(12.9898,78.233)))*43758.5453),b=fract(sin(dot(i+vec2(1,0),vec2(12.9898,78.233)))*43758.5453),c=fract(sin(dot(i+vec2(0,1),vec2(12.9898,78.233)))*43758.5453),d=fract(sin(dot(i+vec2(1,1),vec2(12.9898,78.233)))*43758.5453);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
      void main(){ vec3 d = normalize(vDir); float y = max(d.y, 0.0);
        vec3 c = mix(horizon, top, pow(y, 0.55));
        if (d.y < 0.0) c = mix(horizon, horizon*0.7, min(1.0, -d.y*3.0));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(sd, 900.0)*3.0 + pow(sd, 12.0)*0.25 + pow(sd,3.0)*0.08);
        // clouds
        if (d.y > 0.02) { vec2 cp = d.xz / (d.y + 0.12) * 1.7 + vec2(time*0.006, time*0.003); // (puffy painted clouds: sunlit tops, soft grey undersides, a bright rim near the sun)
          float cl = n(cp)*0.5 + n(cp*2.03)*0.25 + n(cp*4.01)*0.15 + n(cp*8.1)*0.1, cov = smoothstep(0.5, 0.74, cl) * smoothstep(0.02, 0.24, d.y);
          vec2 sdir = normalize(sunDir.xz + vec2(1e-4)); vec2 cs = cp + sdir * 0.22; float sh = n(cs)*0.5 + n(cs*2.03)*0.25 + n(cs*4.01)*0.15 + n(cs*8.1)*0.1;
          float lit = clamp(1.0 - (sh - cl) * 3.2, 0.5, 1.15);
          vec3 cc = mix(vec3(0.6, 0.66, 0.78), mix(vec3(1.0), sunCol, 0.25), lit) + sunCol * pow(sd, 6.0) * (1.0 - cov) * 0.6;
          c = mix(c, cc * mix(1.0, 0.33, night), cov * 0.92); }
        // stars
        if (night > 0.0) { vec3 sp = floor(d*220.0); float s = step(0.9975, h(sp)); c += vec3(s) * night * smoothstep(0.0,0.3,d.y); }
        // moon
        float md = max(dot(d, normalize(-sunDir)), 0.0); c += vec3(0.85,0.9,1.0) * pow(md, 1500.0) * 2.0 * night;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat); sky.renderOrder = -1; sky.frustumCulled = false;
  scene.add(sky);
  return { mesh: sky, mat };
}

// sky colour keys by sun height (-1..1)
const KEYS = [
  { s: -0.35, top: '#050914', hor: '#141c30', sun: '#304060', light: 0.0, amb: 0.22, fog: '#101624' },
  { s: -0.05, top: '#1a2850', hor: '#c86a4a', sun: '#ff8040', light: 0.25, amb: 0.35, fog: '#5a4a5a' },
  { s: 0.12, top: '#3a6ab0', hor: '#f0b080', sun: '#ffc080', light: 0.8, amb: 0.55, fog: '#c8b0a0' },
  { s: 0.4, top: '#3a78c8', hor: '#bfe0f5', sun: '#fff2d8', light: 1.25, amb: 0.7, fog: '#b8d4e8' },
  { s: 1.0, top: '#2f6cc0', hor: '#b4daf4', sun: '#ffffff', light: 1.45, amb: 0.75, fog: '#b0d0e8' },
];
const cA = new THREE.Color(), cB = new THREE.Color();
export function skyColors(sunY) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) if (sunY >= KEYS[i].s && sunY <= KEYS[i + 1].s) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  if (sunY < KEYS[0].s) b = a; if (sunY > 1) a = b;
  const t = a === b ? 0 : (sunY - a.s) / (b.s - a.s);
  const mix = (p, q) => cA.set(p).lerp(cB.set(q), t).clone();
  return { top: mix(a.top, b.top), hor: mix(a.hor, b.hor), sun: mix(a.sun, b.sun), fog: mix(a.fog, b.fog), light: lerp(a.light, b.light, t), amb: lerp(a.amb, b.amb, t) };
}
