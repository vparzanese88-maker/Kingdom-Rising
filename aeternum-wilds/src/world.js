import * as THREE from 'three';
import { G } from './state.js';
import { ZONES, NODES } from './data.js';
import { clamp, lerp, smooth, fbm, noise, rng, angDiff } from './util.js';
import { makeHumanoid, makeWeapon } from './models.js';
import { initGrid, finishTerrain, stampShade, stampLayer, updateTerrain } from './gfx/env/terrain.js';
import { buildWater, updateWater } from './gfx/env/water.js';
import { buildGrass, updateGrass } from './gfx/env/grass.js';
import { initForest, addTree, forest, rocks, plants, bushes, shrooms, updateStatics, addNodeVisual, addStumpVisual, updateNodes } from './gfx/env/veg.js';
import { buildTown, TOWN_HOUSES, TOWN_PATHS, updateTown } from './gfx/env/town.js';
import { buildPOIs, buildRuins, buildCampProps, updatePOIs } from './gfx/env/pois.js';

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

const SK = Object.keys(SECTORS), SA = SK.map((k) => SECTORS[k]), _sv = [0, 0, 0, 0];
function sectorInto(x, z, w) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const outer = smooth(RING_R - 14, RING_R + 14, r);
  let sum = 0;
  for (let i = 0; i < 4; i++) { let d = a - SA[i]; if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; const t = Math.max(0, 1 - Math.abs(d) / (Math.PI / 2)); const v = t > 0 ? Math.pow(t, 2.2) : 0; _sv[i] = v; sum += v; }
  for (let i = 0; i < 4; i++) w[SK[i]] = _sv[i] / sum * outer;
  w.meadow = 1 - outer;
  return w;
}
export function sectorWeights(x, z) { return sectorInto(x, z, {}); }

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

// the ground height: the source of truth for gameplay (the drawn terrain samples it on a 1.1 m grid)
function heightW(x, z, w) {
  const r = Math.hypot(x, z);
  sectorInto(x, z, w);
  let h = 2.6 + fbm(x * 0.011, z * 0.011, 4) * 4.5 + fbm(x * 0.045, z * 0.045, 2) * 0.7;
  const mireH = 0.55 + fbm(x * 0.03 + 50, z * 0.03, 3) * 1.6;
  h = lerp(h, mireH, w.mire);
  const ruinsH = 3.2 + fbm(x * 0.02 + 7, z * 0.02 - 3, 4) * 6 + Math.abs(noise(x * 0.06, z * 0.06)) * 1.5;
  h = lerp(h, ruinsH, w.ruins);
  const thornH = 3.0 + fbm(x * 0.016 - 20, z * 0.016, 4) * 5.5;
  h = lerp(h, thornH, w.thorn);
  h = lerp(2.4, h, smooth(TOWN_R - 8, TOWN_R + 12, r));
  for (const p of PADS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) h = lerp(p.h, h, smooth(p.r * 0.5, p.r, d)); }
  const cr = coastR(x, z);
  h -= smooth(cr - 40, cr + 6, r) * 10;
  return h;
}
const _hw = {};
export function heightAt(x, z) { return heightW(x, z, _hw); }

export function walkable(x, z) { return heightAt(x, z) > -0.7; }

// ---------- Colliders (spatial grid) ----------
const CELL = 10;
function mkGrid() { return new Map(); }
function cellKey(cx, cz) { return cx * 10007 + cz; }
export function addCollider(c) {
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

// ---------- Roads and trails ----------
// segments [ax, az, bx, bz, halfWidth, kind(0 road, 1 trail)]
const ROADS = [];
function roadWobble(t) { return Math.sin(t * 0.045) * 1.1 + Math.sin(t * 0.13 + 1.3) * 0.4; }
{
  // four roads from the gates, gently winding, then trails on to the landmarks
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let px = dx * (TOWN_R - 4), pz = dz * (TOWN_R - 4);
    for (let r = TOWN_R; r <= 150; r += 6) { const o = roadWobble(r + dx * 30 + dz * 70); const nx = dx * r + dz * o, nz = dz * r + dx * o; ROADS.push([px, pz, nx, nz, 1.9, 0]); px = nx; pz = nz; }
  }
  const trail = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 8); let px = ax, pz = az; for (let i = 1; i <= n; i++) { const t = i / n; const nx = ax + (bx - ax) * t, nz = az + (bz - az) * t; const o = i < n ? Math.sin(t * 7 + ax) * 2.2 : 0; const qx = nx + (-(bz - az) / L) * o, qz = nz + ((bx - ax) / L) * o; ROADS.push([px, pz, qx, qz, 1.25, 1]); px = qx; pz = qz; } };
  trail(roadWobble(150 + 70), 150, POI.wreck.x, POI.wreck.z - 16);
  trail(-roadWobble(150 - 70) * 0, -150, POI.hut.x, POI.hut.z + 18);
  trail(-150, roadWobble(-150 - 30), POI.shrine.x + 24, POI.shrine.z);
  trail(150, roadWobble(150 + 30), POI.lostcamp.x - 8, POI.lostcamp.z - 4);
}
// segments bucketed on a 20 m grid (each bucket lists the segments passing within 8 m of it)
const RCELL = 20, RB = new Map();
for (const sg of ROADS) {
  const [ax, az, bx, bz] = sg;
  for (let cx = Math.floor((Math.min(ax, bx) - 8) / RCELL); cx <= Math.floor((Math.max(ax, bx) + 8) / RCELL); cx++)
    for (let cz = Math.floor((Math.min(az, bz) - 8) / RCELL); cz <= Math.floor((Math.max(az, bz) + 8) / RCELL); cz++) { const k = cx * 1000 + cz; if (!RB.has(k)) RB.set(k, []); RB.get(k).push(sg); }
}
// distance to the nearest road or trail (up to 8 m): [distance, kind, halfWidth]
const _rd = [0, 0, 0];
export function roadDist(x, z) {
  let best = 1e9, kind = 0, hw = 0;
  const list = RB.get(Math.floor(x / RCELL) * 1000 + Math.floor(z / RCELL));
  if (list) for (const s of list) {
    const ax = s[0], az = s[1], bx = s[2], bz = s[3];
    const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz; let t = L2 ? ((x - ax) * vx + (z - az) * vz) / L2 : 0; t = clamp(t, 0, 1);
    const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
    if (d < best) { best = d; kind = s[5]; hw = s[4]; }
  }
  _rd[0] = best; _rd[1] = kind; _rd[2] = hw; return _rd;
}

// ---------- Ground layers ----------
// splat order: grass, darkgrass, forest, dirt, cobble, sand, mud, ash (what is left over is rock)
const ZTINT = { meadow: [1.0, 1.04, 0.9], coast: [1.1, 1.05, 0.82], thorn: [0.86, 0.96, 0.86], mire: [0.94, 0.94, 0.74], ruins: [0.98, 0.86, 0.82] };
const ZK = ['meadow', 'coast', 'thorn', 'mire', 'ruins'];
const _cw = {};
function classify(x, z, out) {
  const w = _cw;
  const h = heightW(x, z, w); out.h = h;
  const r = Math.hypot(x, z);
  const n1 = noise(x * 0.035 + 3, z * 0.035 - 7), n2 = noise(x * 0.11 - 11, z * 0.11 + 5), n3 = noise(x * 0.012, z * 0.012 + 40);
  const W = out.w;
  // meadow: lush grass with a few earthy patches
  W[0] += w.meadow * (1 - smooth(0.45, 0.75, n2) * 0.35);
  W[3] += w.meadow * smooth(0.45, 0.75, n2) * 0.35;
  // coast: open grass, drier
  W[0] += w.coast * 0.92; W[3] += w.coast * 0.08;
  // thornwood: dark grass and forest litter in patches
  const lit = smooth(-0.15, 0.35, n1);
  W[1] += w.thorn * (1 - lit) * 0.92; W[2] += w.thorn * lit * 0.92;
  // mirefen: mud, sedge, mossy litter
  const wetN = smooth(-0.2, 0.3, n1 + (0.9 - h) * 0.5);
  W[6] += w.mire * wetN * 0.8; W[1] += w.mire * (1 - wetN) * 0.6; W[2] += w.mire * (1 - wetN) * 0.25;
  // ashen ruins: ash and burnt earth, bare rock showing through (the remainder)
  const bare = smooth(0.2, 0.55, n2 + n1 * 0.4);
  W[7] += w.ruins * (0.7 - bare * 0.45); W[3] += w.ruins * 0.18;
  // town: mown grass, cobbled plaza and streets
  if (r < TOWN_R + 4) {
    const t = 1 - smooth(TOWN_R - 4, TOWN_R + 3, r);
    for (let q = 0; q < 8; q++) W[q] *= 1 - t;
    const street = Math.min(Math.abs(x), Math.abs(z)) < 2.7 + noise(x * 0.3, z * 0.3) * 0.3 || r < 10.5 + noise(x * 0.2, z * 0.2) * 0.8;
    if (street) W[4] += t; else W[0] += t;
  }
  // roads and trails
  const [rd, kind, hw] = roadDist(x, z);
  if (rd < hw + 1.5) {
    const k = (1 - smooth(hw * 0.55, hw + 0.9 + n2 * 0.6, rd)) * (kind ? 0.85 : 1);
    for (let q = 0; q < 8; q++) W[q] *= 1 - k;
    W[3] += k;
  }
  // beaches and dunes (the mire's shore stays muddy)
  const sand = smooth(1.45, 0.55, h + n2 * 0.25) * (1 - w.mire * 0.85) * (r > TOWN_R + 10 ? 1 : 0);
  if (sand > 0) { for (let q = 0; q < 8; q++) W[q] *= 1 - sand; W[5] += sand; }
  if (h < -0.3) { const t = smooth(-0.3, -1.5, h); for (let q = 0; q < 8; q++) W[q] *= 1 - t; W[5] += t; }
  // macro tint
  const tr = out.tint;
  tr[0] = tr[1] = tr[2] = 0;
  for (let q = 0; q < 5; q++) { const k = ZK[q], v = w[k], c = ZTINT[k]; tr[0] += c[0] * v; tr[1] += c[1] * v; tr[2] += c[2] * v; }
  const v = 1 + n3 * 0.1 + n1 * 0.04; tr[0] *= v; tr[1] *= v * (1 + n2 * 0.03); tr[2] *= v;
  if (r < TOWN_R) { tr[0] *= 1.02; tr[1] *= 1.03; }
}

// the colour for the map (and a sensible fallback colour for anything else)
function groundColor(x, z, h, out) {
  const w = sectorWeights(x, z);
  const n = noise(x * 0.15, z * 0.15) * 0.05 + noise(x * 0.02, z * 0.02) * 0.05;
  const cols = { meadow: [0.42, 0.64, 0.26], coast: [0.56, 0.66, 0.32], thorn: [0.24, 0.42, 0.2], mire: [0.32, 0.38, 0.22], ruins: [0.44, 0.38, 0.34] };
  let r = 0, g = 0, b = 0;
  for (const k in cols) { r += cols[k][0] * w[k]; g += cols[k][1] * w[k]; b += cols[k][2] * w[k]; }
  const tr = Math.hypot(x, z);
  if (tr < TOWN_R + 2) { const t = smooth(TOWN_R - 6, TOWN_R + 2, tr); const d = Math.min(Math.abs(x), Math.abs(z)); const p = d < 2.6 || tr < 10 ? 1 : 0; r = lerp(lerp(0.45, 0.62, p), r, t); g = lerp(lerp(0.64, 0.58, p), g, t); b = lerp(lerp(0.3, 0.52, p), b, t); }
  const [rd, , hw] = roadDist(x, z);
  if (rd < hw) { const t = 0.7; r = lerp(r, 0.6, t); g = lerp(g, 0.5, t); b = lerp(b, 0.34, t); }
  const sand = smooth(1.3, 0.4, h) * (1 - w.mire * 0.8);
  r = lerp(r, 0.86, sand); g = lerp(g, 0.79, sand); b = lerp(b, 0.58, sand);
  if (h < -0.2) { const t = smooth(-0.2, -3, h); r = lerp(r, 0.5, t); g = lerp(g, 0.6, t); b = lerp(b, 0.5, t); }
  out.setRGB(r + n, g + n, b + n * 0.5, THREE.SRGBColorSpace);
}

// ---------- Build ----------
export function buildWorld() {
  const scene = G.scene;
  G.colliders = mkGrid();
  const T = G.buildTimes = {}; let t0 = performance.now(); const lap = (k) => { const t = performance.now(); T[k] = Math.round(t - t0); t0 = t; };
  // the ground: sample the heightfield and the ground layers on the terrain grid
  initGrid(classify); lap('grid');
  // scenery positions first, so the ground can be shaded under the canopies
  const R = rng(4242);
  const S = { oak: [], birch: [], pine: [], aged: [], dead: [], charred: [], willow: [], palm: [], rock: [], bush: [], thornbush: [], mirebush: [], ruin: [] };
  const nodes = [];
  const clear = (x, z, r) => {
    if (r < TOWN_R + 4) return false;
    if (roadDist(x, z)[0] < 4) return false;
    for (const k in POI) if (Math.hypot(x - POI[k].x, z - POI[k].z) < 18) return false;
    return true;
  };
  // gatherable nodes keep their odds; scenery trees grow in groves (a slow noise raises and lowers the odds)
  const NODE_ODDS = {
    meadow: [[0.008, 'tree'], [0.0064, 'iron'], [0.0088, 'hemp']],
    coast: [[0.0056, 'tree'], [0.0064, 'iron'], [0.0072, 'hemp']],
    thorn: [[0.0096, 'aged_tree'], [0.0064, 'tree'], [0.0064, 'starmetal'], [0.0048, 'iron'], [0.0048, 'hemp']],
    mire: [[0.0096, 'silkweed'], [0.0064, 'aged_tree'], [0.0056, 'starmetal'], [0.0056, 'hemp']],
    ruins: [[0.0096, 'wyrd_tree'], [0.008, 'orichalcum'], [0.0048, 'starmetal']],
  };
  const SCEN_ODDS = {
    meadow: [[0.028, 'oak', 1], [0.016, 'birch', 1], [0.035, 'bush'], [0.01, 'rock']],
    coast: [[0.03, 'palm', 2], [0.022, 'oak', 1], [0.01, 'pine', 1], [0.008, 'birch'], [0.022, 'rock'], [0.025, 'bush']],
    thorn: [[0.15, 'pine', 1], [0.03, 'aged', 1], [0.008, 'oak', 1], [0.006, 'birch'], [0.004, 'dead'], [0.04, 'thornbush'], [0.01, 'rock']],
    mire: [[0.045, 'willow', 1], [0.03, 'dead'], [0.01, 'aged'], [0.04, 'mirebush']],
    ruins: [[0.03, 'dead'], [0.03, 'charred'], [0.03, 'rock'], [0.008, 'ruin']],
  };
  for (let i = 0; i < 15000; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * (ISLAND_R + 10);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const roll = R(), roll2 = R(), s = 0.8 + R() * 0.5, rot = R() * 6.28;
    if (!clear(x, z, r)) continue;
    const h = heightAt(x, z);
    if (h < 0.5) continue;
    const zn = zoneAt(x, z);
    let acc = 0, done = false;
    for (const [p, type] of NODE_ODDS[zn]) { acc += p; if (roll < acc) { nodes.push([type, x, z]); done = true; break; } }
    if (done) continue;
    const grove = 0.3 + 1.5 * smooth(-0.25, 0.45, noise(x * 0.018 + 9, z * 0.018 - 4));
    acc = 0;
    for (const [p, kind, g] of SCEN_ODDS[zn]) {
      acc += p * (g === 1 ? grove : 1);
      if (roll2 < acc) {
        if (kind === 'palm' && h > 2.3) break;
        S[kind].push([x, z, kind === 'pine' ? s * 1.1 : kind === 'rock' && zn === 'ruins' ? s * 1.3 : s, rot]);
        break;
      }
    }
  }
  // trees: shade the ground under them, give them trunks to bump into
  const CROWN = { oak: 4.2, aged: 4.6, birch: 2.6, willow: 4.2, pine: 3.2, dead: 1.5, charred: 1.5, palm: 2.6 };
  const TRUNK = { oak: 0.5, aged: 0.62, birch: 0.26, willow: 0.52, pine: 0.42, dead: 0.36, charred: 0.36, palm: 0.32 };
  initForest();
  for (const k of ['oak', 'aged', 'birch', 'willow', 'pine', 'dead', 'charred', 'palm']) for (const [x, z, s, rot] of S[k]) {
    const sc = s * (k === 'birch' ? 0.95 : 1);
    addTree(k, x, heightAt(x, z) - 0.15, z, sc, rot, k === 'charred' ? 0.9 : undefined);
    if (CROWN[k] > 2) stampShade(x, z, CROWN[k] * sc * 1.05, k === 'pine' ? 0.42 : 0.36);
    addCollider({ x, z, r: TRUNK[k] * sc });
  }
  for (const [type, x, z] of nodes) if (type.endsWith('tree')) stampShade(x, z, 4.3, 0.36);
  // the town and the landmarks paint their own ground (plazas, yards, scorched earth)
  for (const hz of TOWN_HOUSES) stampLayer(hz.x, hz.z, Math.max(hz.w, hz.d) * 0.62, 'dirt', 0.5);
  for (const path of TOWN_PATHS) for (const [x, z] of path) stampLayer(x, z, 1.3, 'dirt', 0.6);
  for (const [x, z, r] of [[14, -12, 4.2], [-14, -12, 4.5], [-14, 14, 4], [0, 8, 3], [14, 14.5, 3.5], [7, 2, 2.2]]) stampLayer(x, z, r, 'dirt', 0.75);
  stampLayer(POI.shrine.x - 4, POI.shrine.z, 22, 'ash', 0.6);
  stampLayer(POI.lostcamp.x, POI.lostcamp.z, 10, 'dirt', 0.8);
  stampLayer(POI.hut.x, POI.hut.z - 6, 9, 'mud', 0.7);
  lap('scatter');
  finishTerrain(); lap('terrain');
  buildSceneryMeshes(S); lap('scenery');
  // the sea and the bog
  buildWater({ r0: RING_R - 4, r1: ISLAND_R - 12, a0: Math.PI / 2 - 1.05, a1: Math.PI / 2 + 1.05, level: 0.12 });
  // gatherable nodes
  for (const [type, x, z] of nodes) addNode(type, x, z);
  lap('nodes');
  buildTown({ addCollider, heightAt, addStation, addNPC, addBoard, scene }); lap('town');
  buildPOIs({ addCollider, heightAt, POI, scene });
  buildRuins(S.ruin, { addCollider, heightAt });
  buildCamps(R);
  buildCampProps(G.camps, { heightAt, addCollider }); lap('pois');
  buildGrass(); lap('grass');
}

function buildSceneryMeshes(S) {
  const R = rng(777);
  const y = (x, z) => heightAt(x, z);
  // boulders and stones
  const rk = [];
  for (const [x, z, s, rot] of S.rock) { const sc = s * (0.9 + R() * 0.8); rk.push([x, y(x, z) - 0.25 * sc, z, sc, rot, 1, 1, 1]); addCollider({ x, z, r: 0.95 * sc }); }
  rocks(rk);
  // bushes: one leafy shape, tinted per zone
  const bl = [];
  const addB = (list, tint) => { for (const [x, z, s, rot] of list) bl.push([x, y(x, z) - 0.1, z, s * (0.9 + R() * 0.4), rot, tint[0] * (0.9 + R() * 0.2), tint[1] * (0.9 + R() * 0.2), tint[2]]); };
  addB(S.bush, [1.05, 1.05, 1]); addB(S.thornbush, [0.72, 0.85, 0.75]); addB(S.mirebush, [0.95, 0.92, 0.7]);
  bushes(bl);
  // ground details: pebbles, ferns, flowers, reeds, sedge, mushrooms, dune grass
  const peb = [], pl = [], shroom = [], bigrock = [];
  const P = (kind, x, h, z, s, rot, r = 1, g = 1, b = 1) => { const it = [x, h, z, s, rot, r, g, b]; it[11] = kind; pl.push(it); };
  for (let i = 0; i < 26000; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * (ISLAND_R + 8);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < TOWN_R + 3) continue;
    const h = heightAt(x, z);
    if (h < -0.2) continue;
    if (roadDist(x, z)[0] < 2.6) continue;
    const zn = zoneAt(x, z), q = R(), s = 0.7 + R() * 0.6, rot = R() * 6.28;
    if (h < 0.35) { if (zn === 'mire' || q < 0.25) P('reeds', x, h - 0.05, z, s, rot); continue; }
    if (q < 0.08) peb.push([x, h - 0.05, z, 0.14 + R() * 0.22, rot, 1, 1, 1]);
    else if (q < 0.26 && (zn === 'thorn' || zn === 'mire' || (zn === 'meadow' && noise(x * 0.05, z * 0.05) > 0.3))) P('fern', x, h, z, s, rot, 0.9 + R() * 0.2, 1, 0.9);
    else if (q < 0.4 && (zn === 'meadow' || zn === 'coast') && noise(x * 0.04 + 5, z * 0.04) > 0.05) P('flowers', x, h, z, s, rot);
    else if (q < 0.48 && zn === 'mire') P('swampgrass', x, h, z, s, rot);
    else if (q < 0.51 && (zn === 'thorn' || zn === 'mire')) shroom.push([x, h, z, 0.7 + R() * 0.7, rot]);
    else if (q < 0.58 && zn === 'coast' && h < 2.2) P('drygrass', x, h, z, s, rot);
    else if (q < 0.585 && zn !== 'mire') bigrock.push([x, h - 0.1, z, 0.35 + R() * 0.3, rot, 1, 1, 1]);
  }
  rocks(peb, { far: 60, shadow: false, pebbles: true });
  rocks(bigrock, { far: 140, shadow: true });
  plants(pl, 90);
  shrooms(shroom);
}

export function addNode(type, x, z) {
  const def = NODES[type];
  const rot = Math.random() * 6.28;
  const gy = heightAt(x, z);
  const mesh = addNodeVisual(type, x, gy - (def.skill === 'mining' ? 0.25 : 0.12), z, rot);
  const solid = def.skill !== 'harvesting';
  const col = solid ? { x, z, r: def.skill === 'mining' ? 1.25 : 0.55 } : null;
  if (col) addCollider(col);
  let stump = null;
  if (def.skill === 'logging') { stump = addStumpVisual(x, gy - 0.05, z, rot); stump.visible = false; }
  const n = { type, def, x, z, mesh, stump, col, depleted: 0, kind: 'node' };
  G.nodes.push(n);
  return n;
}

// per-frame scenery animation and culling
export function updateWorld(dt, px, pz, t) {
  const cam = G.camera.position;
  updateTerrain(cam);
  forest.update(cam);
  updateStatics(cam);
  updateNodes(cam);
  updateWater(cam);
  const P = G.player;
  updateGrass(cam, P && G.mode === 'game' ? { x: P.pos.x, y: P.y, z: P.pos.z } : null);
  updateTown(dt, t);
  updatePOIs(dt, t);
}

// ---------- Town helpers (the buildings themselves are in gfx/env/town.js) ----------
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
  mesh.position.set(x, heightAt(x, z), z);
  G.scene.add(mesh);
  addCollider({ x, z, r: 1.6 });
  G.stations.push({ id, x, z, kind: 'station', root: mesh });
}
function addBoard(root) {
  G.npcs.push({ id: 'board', x: 7, z: 2.6, kind: 'npc', root, marker: makeMarker(root, 3.2) });
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
  G.camps.push({ x: POI.lostcamp.x, z: POI.lostcamp.z, zone: 'thorn', slots: ['lost', 'lost', 'lostArcher', 'lost', 'lostArcher'].map(t => ({ type: t, dead: 0, ent: null })), radius: 7 });
  G.camps.push({ x: POI.wreck.x, z: POI.wreck.z - 4, zone: 'coast', lv: 9, boss: true, slots: [{ type: 'grimsby', dead: 0, ent: null }], radius: 2 });
  G.camps.push({ x: POI.hut.x, z: POI.hut.z, zone: 'mire', lv: 15, boss: true, slots: [{ type: 'hag', dead: 0, ent: null }], radius: 2 });
  G.camps.push({ x: POI.shrine.x, z: POI.shrine.z, zone: 'ruins', lv: 24, boss: true, slots: [{ type: 'warden', dead: 0, ent: null }], radius: 2 });
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
    if (h < -0.15) { const dk = smooth(-0.15, -6, h); img.data[k] = lerp(70, 26, dk); img.data[k + 1] = lerp(160, 84, dk); img.data[k + 2] = lerp(170, 124, dk); }
    else {
      groundColor(x, z, h, c);
      c.convertLinearToSRGB();
      const shade = 0.85 + clamp(h / 12, -0.2, 0.3);
      img.data[k] = c.r * 255 * shade; img.data[k + 1] = c.g * 255 * shade; img.data[k + 2] = c.b * 255 * shade;
      if (zoneAt(x, z) === 'mire' && h < 0.12) { img.data[k] = 70; img.data[k + 1] = 84; img.data[k + 2] = 50; }
    }
    img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = Math.max(1, size / 200);
  ctx.beginPath(); ctx.arc(size / 2, size / 2, TOWN_R / span * size, 0, 6.28); ctx.stroke();
  return { canvas: cv, span };
}
