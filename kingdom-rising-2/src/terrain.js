// Terrain heights, biomes/zones, terrain mesh, water, sky and lighting.
import * as THREE from 'three';
import { fbm, ridged, smooth, lerp, clamp, distToLine } from './util.js';
import { BATTLE, battleHeight, LAYOUT, roadPolylines, WALL_R } from './battlemap.js';

export const HALF = 600, SEG = 300, CELL = (HALF * 2) / SEG;
export const SEA = 0;
export const VILLAGE = { x: 0, z: 362 };
export const SPAWN = { x: 36, z: 428, yaw: 0 };
export const PLATEAU = { x: -430, z: -140, r: 66, top: 41 };
export const LAKE = { x: -438, z: -148, r: 30, y: 38.5 };
export const FALL = { x: -366, z: -140 }; // lip of the waterfall
export const VOLCANO = { x: 400, z: -480 };
export const CAMPS = [{ x: -40, z: 65, r: 26, h: null }, { x: -225, z: -298, r: 30, h: null }, { x: 238, z: -326, r: 30, h: null }, { x: 200, z: -62, r: 22, h: null }];
export const RIVER = [[-356, -140], [-320, -122], [-270, -100], [-210, -82], [-140, -64], [-70, -50], [-10, -44], [60, -38], [125, -18], [175, 2], [230, 34], [300, 88], [370, 140], [440, 182], [520, 214], [600, 236]];
export const ROADS = [
  [[0, 362], [3, 310], [5, 250], [-12, 170], [-28, 100], [-38, 66], [-22, 10], [-10, -44], [-28, -100], [-80, -160], [-150, -230], [-200, -275], [-225, -298]],
  [[-28, -100], [30, -150], [100, -200], [160, -260], [205, -300], [238, -326]],
  [[5, 250], [70, 200], [130, 120], [155, 40], [168, -6], [190, -45], [200, -62]],
  [[-225, -298], [-270, -350], [-320, -410], [-330, -422], [-260, -440], [-190, -462], [-150, -480]],
  [[238, -326], [290, -380], [340, -420], [372, -448], [390, -468]],
  [[0, 362], [-50, 376], [-120, 384]], [[0, 362], [50, 376], [110, 384]],
];
export const LAVA_POOLS = [[250, -380, 14], [320, -350, 10], [190, -420, 12], [300, -440, 9], [400, -482, 13]];
export const BRIDGES = []; // filled at build: {x,z,ang,len,w,y}
// Kingdom Battles uses its own map: move the campaign landmarks out of the way
export function applyBattleTerrain() {
  ROADS.length = 0; ROADS.push(...roadPolylines());
  LAVA_POOLS.length = 0; CAMPS.length = 0; RIVER.length = 0; RIVER.push([9000, 9000], [9001, 9001]);
  VILLAGE.x = 9000; VILLAGE.z = 9000; PLATEAU.x = LAKE.x = 9000; PLATEAU.z = LAKE.z = 9000; VOLCANO.x = VOLCANO.z = 9000; FALL.x = FALL.z = 9000;
  const t0 = LAYOUT.towns[0]; SPAWN.x = t0.x; SPAWN.z = t0.z; SPAWN.yaw = t0.yaw;
}
if (BATTLE && LAYOUT.towns.length) applyBattleTerrain();

function riverDist(x, z) { return distToLine(x, z, RIVER); }
function roadDist(x, z) { let best = 1e9; for (const r of ROADS) { const d = distToLine(x, z, r).d; if (d < best) best = d; } return best; }
export { roadDist };

// raw height function (analytic). The mesh samples it; gameplay uses the mesh samples via heightAt().
export function rawHeight(x, z, noCamps) {
  if (BATTLE) return battleHeight(x, z);
  let h = 4.5 + fbm(x * 0.0035, z * 0.0035, 4) * 8 + fbm(x * 0.014 + 7, z * 0.014, 3) * 2.2;
  h = Math.max(h, 2.4 + fbm(x * 0.02, z * 0.02, 2) * 0.6);
  const north = smooth(240, -60, z);
  h += north * (fbm(x * 0.008 + 3, z * 0.008 - 2, 3) * 9 + 3);
  // highlands (NW)
  const hl = smooth(-70, -270, z) * smooth(20, -200, x);
  h += hl * (24 + ridged(x * 0.006, z * 0.006, 4) * 50);
  // ashlands (NE)
  const ash = smooth(-150, -290, z) * smooth(90, 250, x);
  h += ash * (8 + fbm(x * 0.01 - 5, z * 0.01 + 9, 3) * 10);
  // volcano
  const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  const v = clamp(1 - dv / 240, 0, 1);
  h += v * v * (3 - 2 * v) * 135;
  if (dv < 42) h -= (1 - dv / 42) * 1.0 * 48 * smooth(0, 20, 42 - dv);
  // border mountains (west, north) and south-east headland
  const bw = smooth(-440, -585, x), bn = smooth(-430, -585, z);
  const border = Math.max(bw, bn);
  h += border * (70 + ridged(x * 0.008 + 11, z * 0.008, 4) * 110);
  // plateau with lake
  const dp = Math.hypot(x - PLATEAU.x, z - PLATEAU.z);
  const pl = 1 - smooth(PLATEAU.r - 6, PLATEAU.r + 4, dp);
  h = Math.max(h * (1 - pl), lerp(h, PLATEAU.top + fbm(x * 0.05, z * 0.05, 2) * 1.5, pl));
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (dl < LAKE.r + 6) h = lerp(h, LAKE.y - 4.5, 1 - smooth(LAKE.r - 10, LAKE.r + 4, dl));
  // stream from lake to the cliff lip
  { const r = distToLine(x, z, [[LAKE.x + 20, LAKE.z + 4], [FALL.x - 3, FALL.z]]); if (r.d < 7 && dp < PLATEAU.r + 2) h = Math.min(h, lerp(LAKE.y - 1.8, h, smooth(3.5, 7, r.d))); }
  // camps and village flatten
  const dvl = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  h = lerp(h, 2.6 + fbm(x * 0.03, z * 0.03, 2) * 0.3, 1 - smooth(30, 52, dvl));
  if (!noCamps) for (const c of CAMPS) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r * 1.8) { if (c.flat == null) c.flat = rawHeight(c.x, c.z, true); h = lerp(h, c.flat, 1 - smooth(c.r * 0.7, c.r * 1.8, d)); } }
  // coast: beach then sea (south and east)
  const cn = fbm(x * 0.006 + 40, z * 0.006, 3) * 26;
  const beach = Math.max(smooth(378, 405, z + cn * 0.5), smooth(440, 500, x + cn) * smooth(-120, -40, z));
  h = lerp(h, 1.1 + (h - 1.1) * 0.08, beach);
  const sea = Math.max(smooth(452, 505, z + cn * 0.5), smooth(495, 560, x + cn) * smooth(-120, -40, z));
  h = lerp(h, -9, sea);
  // river channel
  const rd = riverDist(x, z);
  if (rd.d < 60) {
    const w = 6.5 + rd.i * 0.25;
    const bed = -2.6;
    const bank = 6 + Math.max(0, h) * 0.55;
    h = Math.min(h, lerp(bed, h, smooth(w, w + bank, rd.d)));
  }
  // lava pools
  for (const p of LAVA_POOLS) { const d = Math.hypot(x - p[0], z - p[1]); if (d < p[2] + 8) h -= (1 - smooth(p[2] - 4, p[2] + 8, d)) * 3; }
  return h;
}

// heightfield
export const heights = new Float32Array((SEG + 1) * (SEG + 1));
export function heightAt(x, z) {
  const gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
  if (gx < 0 || gz < 0 || gx >= SEG || gz >= SEG) return -10;
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const i00 = iz * (SEG + 1) + ix, i10 = i00 + 1, i01 = i00 + SEG + 1, i11 = i01 + 1;
  if (fx + fz < 1) return heights[i00] + (heights[i10] - heights[i00]) * fx + (heights[i01] - heights[i00]) * fz;
  return heights[i11] + (heights[i01] - heights[i11]) * (1 - fx) + (heights[i10] - heights[i11]) * (1 - fz);
}
export function normalAt(x, z) { const e = 1.5; const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e); const n = new THREE.Vector3(-hx, 2 * e, -hz); return n.normalize(); }

export function zoneAt(x, z) {
  if (BATTLE) return 'meadow';
  const ash = smooth(-150, -290, z) * smooth(90, 250, x);
  if (ash > 0.4 || Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 200) return 'ashlands';
  if (z < -150) return 'highlands';
  if (z < 175) return 'wood';
  const cn = 0;
  if (z > 385 || x > 450) return 'coast';
  return 'meadow';
}
export function biomeMasks(x, z) {
  if (BATTLE) return { hl: 0, ash: 0, forest: clamp(fbm(x * 0.006 + 70, z * 0.006 - 30, 3) * 1.6, 0, 0.8), dry: clamp(fbm(x * 0.004 - 40, z * 0.004, 2) * 1.2, 0, 0.35), meadow: 1 };
  return {
    hl: smooth(-70, -270, z) * smooth(20, -200, x) + Math.max(smooth(-440, -585, x), smooth(-430, -585, z)) * 0.6,
    ash: Math.max(smooth(-150, -290, z) * smooth(90, 250, x), clamp(1 - Math.hypot(x - VOLCANO.x, z - VOLCANO.z) / 230, 0, 1)),
    forest: smooth(220, 140, z) * (1 - smooth(-120, -200, z)),
    dry: smooth(-40, -230, z) * smooth(-80, 140, x),
    meadow: smooth(170, 230, z),
  };
}
export function beachMask(x, z) { if (BATTLE) return 0; const cn = fbm(x * 0.006 + 40, z * 0.006, 3) * 26; return Math.max(smooth(375, 402, z + cn * 0.5), smooth(440, 500, x + cn) * smooth(-120, -40, z)); }
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
  for (let i = 0; i < N * N; i++) {
    const x = pos[i * 3], h = pos[i * 3 + 1], z = pos[i * 3 + 2], ny = nrm[i * 3 + 1];
    const m = biomeMasks(x, z);
    const n = fbm(x * 0.05, z * 0.05, 2) * 0.5 + 0.5, n2 = fbm(x * 0.012 + 9, z * 0.012, 2) * 0.5 + 0.5;
    // base grass
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
    tmp.lerp(m.ash > 0.4 ? COL.basalt : n > 0.5 ? COL.rock : COL.rock2, steep);
    // snow
    const snowLine = 52 + n2 * 14;
    if (m.ash < 0.3) tmp.lerp(COL.snow, smooth(snowLine, snowLine + 10, h) * smooth(0.5, 0.75, ny) * clamp(m.hl * 2 + (h > 90 ? 1 : 0), 0, 1));
    // beach & underwater
    const bm = beachMask(x, z);
    if (h < 2.6 && m.ash < 0.3) tmp.lerp(COL.sand, smooth(2.6, 1.5, h) * Math.max(bm, h < 0.8 ? 1 : 0));
    if (h < 0.2) tmp.lerp(COL.wetSand, smooth(0.2, -1.5, h));
    // river bed
    const rd = riverDist(x, z).d;
    if (rd < 14 && h < 4) tmp.lerp(COL.mud, smooth(14, 6, rd) * 0.7);
    // roads
    const roadD = roadDist(x, z);
    if (roadD < 4.5 && h > 0.4) tmp.lerp(m.hl > 0.6 && h > snowLine ? COL.snow : COL.road, smooth(4.5, 1.8, roadD) * 0.9);
    // village dirt
    const dvl = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    if (dvl < 26) tmp.lerp(COL.road, (1 - dvl / 26) * 0.45 * (0.5 + n * 0.5));
    if (BATTLE) for (const t of LAYOUT.towns) { const d = Math.hypot(x - t.x, z - t.z); if (d < WALL_R + 6) tmp.lerp(COL.road, (0.35 + (1 - d / (WALL_R + 6)) * 0.25) * (0.6 + n * 0.4)); }
    for (const c of CAMPS) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r) tmp.lerp(m.hl > 0.5 ? COL.rock2 : COL.road, (1 - d / c.r) * 0.5); }
    for (const p of LAVA_POOLS) { const d = Math.hypot(x - p[0], z - p[1]); if (d < p[2] + 6) tmp.lerp(COL.basalt, smooth(p[2] + 6, p[2], d)); }
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: detailTexture() });
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}

// ---------- water ----------
function heightTexture() {
  const N = 512, data = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -HALF + (i + 0.5) / N * HALF * 2, z = -HALF + (j + 0.5) / N * HALF * 2; data[j * N + i] = THREE.DataUtils.toHalfFloat(heightAt(x, z)); }
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
export function buildWater(scene) {
  const htex = heightTexture();
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    time: { value: 0 }, hmap: { value: null }, level: { value: 0 }, halfW: { value: HALF },
    deep: { value: new THREE.Color('#0d3d5c') }, shallow: { value: new THREE.Color('#2f9fae') }, sky: { value: new THREE.Color('#9cc8ea') },
    sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, sunCol: { value: new THREE.Color('#fff2d0') }, flow: { value: 0 }, light: { value: 1 },
  }]);
  const vert = `
    uniform float time; varying vec3 vW; varying float vWave;
    #include <fog_pars_vertex>
    void main(){ vec3 p = position; vec4 w = modelMatrix * vec4(p,1.0);
      float wv = sin(w.x*0.08+time*1.1)*0.18 + sin(w.z*0.11+time*0.9)*0.14 + sin((w.x+w.z)*0.21+time*1.7)*0.06;
      w.y += wv; vWave = wv; vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const frag = `
    uniform float time, level, halfW, flow, light; uniform sampler2D hmap; uniform vec3 deep, shallow, sky, sunDir, sunCol; varying vec3 vW; varying float vWave;
    #include <fog_pars_fragment>
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
    void main(){
      vec2 uv = (vW.xz + halfW) / (halfW*2.0);
      float ground = texture2D(hmap, uv).r;
      float depth = level - ground;
      vec2 q = vW.xz*0.35 + vec2(time*0.25, time*0.18 + flow*time);
      float n1 = vn(q), n2 = vn(q*2.3 - time*0.3), n3 = vn(vW.xz*0.06 + time*0.05);
      vec3 N = normalize(vec3((n1-0.5)*0.55 + (n2-0.5)*0.3, 1.0, (n2-0.5)*0.55 + (n3-0.5)*0.4));
      vec3 V = normalize(cameraPosition - vW);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      vec3 col = mix(shallow, deep, smoothstep(0.2, 7.0, depth));
      col = mix(col, sky * 0.95, fres * 0.65);
      vec3 H = normalize(sunDir + V); float spec = pow(max(dot(N, H), 0.0), 140.0) * 1.6;
      col += sunCol * spec;
      float foam = smoothstep(1.3, 0.0, depth) * (0.55 + 0.45*sin(time*2.0 + vW.x*0.4 + vW.z*0.3 + n1*6.0));
      foam += smoothstep(0.35, 0.0, depth) * 0.6;
      foam *= smoothstep(-0.3, 0.2, depth);
      col = mix(col, vec3(0.95,0.97,1.0), clamp(foam, 0.0, 1.0) * 0.8);
      col *= light;
      float a = clamp(0.55 + depth*0.12 + fres*0.3 + foam, 0.0, 0.96);
      gl_FragColor = vec4(col, a);
      #include <fog_fragment>
    }`;
  const mk = (level, extra = {}) => { const u = THREE.UniformsUtils.clone(uniforms); u.hmap.value = htex; u.level.value = level; const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: vert, fragmentShader: frag, transparent: true, fog: true, depthWrite: false }); Object.assign(m.uniforms, {}); return m; };
  const seaMat = mk(SEA);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 2000, HALF * 2 + 2000, 200, 200).rotateX(-Math.PI / 2), seaMat);
  sea.position.y = SEA; sea.renderOrder = 2; scene.add(sea);
  const lakeMat = mk(LAKE.y);
  const lakeGeo = new THREE.CircleGeometry(LAKE.r + 8, 48).rotateX(-Math.PI / 2);
  const lake = new THREE.Mesh(lakeGeo, lakeMat); lake.position.set(LAKE.x, LAKE.y, LAKE.z); lake.renderOrder = 2; scene.add(lake);
  // stream strip to lip
  const sx = LAKE.x + 20, sz = LAKE.z + 4, len = Math.hypot(FALL.x - sx, FALL.z - sz);
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(len + 2, 9, 20, 2).rotateX(-Math.PI / 2), lakeMat);
  stream.position.set((sx + FALL.x) / 2, LAKE.y - 0.4, (sz + FALL.z) / 2); stream.rotation.y = -Math.atan2(FALL.z - sz, FALL.x - sx); stream.renderOrder = 2; scene.add(stream);
  return { mats: [seaMat, lakeMat], sea };
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
        if (d.y > 0.02) { vec2 cp = d.xz / (d.y + 0.15) * 2.2 + vec2(time*0.004, time*0.002);
          float cl = n(cp)*0.55 + n(cp*2.1)*0.3 + n(cp*4.3)*0.15; cl = smoothstep(0.52, 0.78, cl) * smoothstep(0.02, 0.25, d.y);
          vec3 cc = mix(vec3(1.0), sunCol, 0.3) * mix(1.0, 0.35, night); c = mix(c, cc, cl*0.8); }
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
