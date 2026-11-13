// World contents: vegetation, gatherable nodes, village and camps, bridges, colliders, birds, grass, ambient particles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, fbm, smooth, clamp, lerp, hash2, distToLine } from './util.js';
import { HALF, heightAt, rawHeight, zoneAt, biomeMasks, isWater, roadDist, VILLAGE, SPAWN, RIVER, ROADS, BRIDGES, LAVA_POOLS, CAMPS, PLATEAU, LAKE, VOLCANO, SEA, normalAt, PORT, MOUNT } from './terrain.js';
import { NODE_TYPES, STATION_SPOTS, GOBLIN_CAMPS } from './data.js';
import { GI } from './gimap.js';
import { buildGoblinIsle, giAvoid } from './goblinisle.js';
import { YARD, ARENA } from './battlemap.js';
import { buildColosseum } from './arenamap.js';
import { buildRuins } from './ruinsmap.js';
import { BATTLE, LAYOUT, WALL_R, battleRoadDist, nearTown } from './battlemap.js';

export const world = {
  nodes: [], colliders: [], surfaces: [], stations: [], fires: [], lights: [], birds: [], interact: [],
  time: { value: 0 }, wind: { value: 0 },
};
const rng = mulberry32(4242);
const R = (a, b) => a + rng() * (b - a);

// ---------- spatial grids ----------
const GC = 16;
const colGrid = new Map(), nodeGrid = new Map(), surfGrid = new Map();
const gk = (x, z) => (Math.floor(x / GC) + 1000) * 4096 + (Math.floor(z / GC) + 1000);
function gridAdd(grid, x, z, r, item) {
  for (let gx = Math.floor((x - r) / GC); gx <= Math.floor((x + r) / GC); gx++) for (let gz = Math.floor((z - r) / GC); gz <= Math.floor((z + r) / GC); gz++) {
    const k = (gx + 1000) * 4096 + (gz + 1000); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(item);
  }
}
function gridGet(grid, x, z) { return grid.get(gk(x, z)) || []; }
export function addCircle(x, z, r, tag) { const c = { t: 'c', x, z, r, on: true, tag }; world.colliders.push(c); gridAdd(colGrid, x, z, r, c); return c; }
export function addBox(x, z, hw, hd, rot = 0, tag, y0 = -1e9, y1 = 1e9) { const c = { t: 'b', x, z, hw, hd, rot, cos: Math.cos(rot), sin: Math.sin(rot), on: true, tag, y0, y1 }; /* (y0..y1: a wall you can stand on top of, or walk under) */ world.colliders.push(c); gridAdd(colGrid, x, z, Math.hypot(hw, hd), c); return c; }
export function addSurface(x, z, hw, hd, rot, y, slopeY, y1) { const s = { x, z, hw, hd, rot, cos: Math.cos(rot), sin: Math.sin(rot), y, slope: slopeY || 0, ramp: y1 != null ? y1 - y : 0 }; /* (ramp: rises from y at -hd to y1 at +hd) */ world.surfaces.push(s); gridAdd(surfGrid, x, z, Math.hypot(hw, hd), s); return s; }

// push a point out of colliders (in place). returns true if hit
export function collide(p, r) {
  let hit = false;
  const list = gridGet(colGrid, p.x, p.z);
  for (const c of list) {
    if (!c.on) continue;
    if (c.t === 'c') {
      const dx = p.x - c.x, dz = p.z - c.z, d2 = dx * dx + dz * dz, rr = c.r + r;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d; p.x += dx * k; p.z += dz * k; hit = true; }
    } else {
      if (p.y != null && (p.y >= c.y1 - 0.35 || p.y + 1.7 <= c.y0)) continue; // (standing on top of it, or passing under it)
      // to local
      const dx = p.x - c.x, dz = p.z - c.z;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      const ex = c.hw + r, ez = c.hd + r;
      if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
        const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
        let nx = lx, nz = lz;
        if (px < pz) nx = Math.sign(lx) * ex; else nz = Math.sign(lz) * ez;
        p.x = c.x + nx * c.cos + nz * c.sin; p.z = c.z - nx * c.sin + nz * c.cos; hit = true;
      }
    }
  }
  return hit;
}
// is this point inside a solid box (walls, buildings)? and is the straight line between two points clear of them?
// what a magic missile flies into on its way (gh: the ground height there): a wall or building (a box, within its height), a tree trunk,
// rock, post or well (a circle, up to its top if it was given one, else the bottom 2.5 m), or a tree's crown (world.crowns: squashed balls)
export function blockAt(x, y, z, gh) { for (const c of gridGet(colGrid, x, z)) { if (!c.on) continue;
    if (c.t === 'b') { if (y < c.y0 || y > c.y1) continue; const dx = x - c.x, dz = z - c.z, lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos; if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return true; }
    else if (c.t === 'c') { if (y > (c.top != null ? c.top : gh + 2.5)) continue; const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < c.r * c.r) return true; } }
  for (const o of world.crowns || []) { const dx = x - o.x, dz = z - o.z, dy = (y - o.y) / (o.sy || 1); if (dx * dx + dz * dz + dy * dy < o.r * o.r) return true; }
  return false; }
export function solidAt(x, y, z) { for (const c of gridGet(colGrid, x, z)) { if (!c.on || c.t !== 'b' || y < c.y0 || y > c.y1) continue; const dx = x - c.x, dz = z - c.z, lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos; if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return true; } return false; }
export function lineClear(a, b) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.6); for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)) return false; } return true; }
// ground height including bridges/piers when standing above them
export function groundAt(x, z, y = 1e9) {
  let h = heightAt(x, z), surf = null;
  for (const s of gridGet(surfGrid, x, z)) {
    const dx = x - s.x, dz = z - s.z;
    const lx = dx * s.cos - dz * s.sin, lz = dx * s.sin + dz * s.cos;
    if (Math.abs(lx) <= s.hw && Math.abs(lz) <= s.hd) {
      const sy = s.y + (s.slope ? s.slope * (1 - Math.pow(lz / s.hd, 2)) : 0) + (s.ramp ? s.ramp * (lz / s.hd + 1) / 2 : 0);
      if (sy > h && y > sy - 1.3) { h = sy; surf = s; }
    }
  }
  return { h, surf };
}
export function surfaceType(x, z, onSurf) {
  if (onSurf) return 'wood';
  const h = heightAt(x, z), zn = zoneAt(x, z);
  if (h < 0.1) return 'water';
  if (h < 2.3 && zn !== 'ashlands') return 'sand';
  if (zn === 'ashlands') return 'ash';
  if (zn === 'highlands' && h > 55) return BATTLE ? 'snow' : 'stone';
  if (roadDist(x, z) < 3) return 'stone';
  return 'grass';
}

// ---------- geometry helpers ----------
const tmpC = new THREE.Color();
function part(geo, color, jit = 0, seed = 1) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  const r2 = mulberry32(seed);
  const base = new THREE.Color(color);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (r2() - 0.5) * jit;
    for (let j = 0; j < 3; j++) { col[(i + j) * 3] = base.r * k; col[(i + j) * 3 + 1] = base.g * k; col[(i + j) * 3 + 2] = base.b * k; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function jitterGeo(g, amt, seed) { const r2 = mulberry32(seed); const p = g.attributes.position; const m = new Map(); for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); let o = m.get(k); if (!o) { o = [(r2() - 0.5) * amt, (r2() - 0.5) * amt, (r2() - 0.5) * amt]; m.set(k, o); } p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]); } g.computeVertexNormals(); return g; }
function T(g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1, sy) { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.scale(s, sy ?? s, s); g.translate(x, y, z); return g; }
function merge(parts) { const g = mergeGeometries(parts, false); g.computeVertexNormals(); g.computeBoundingSphere(); return g; }

// ---------- tree & node geometries ----------
function oakGeo(v) {
  const parts = [part(T(new THREE.CylinderGeometry(0.25, 0.45, 4.2, 7), 0, 2.1, 0), '#5a3f28', 0.15, 2)];
  parts.push(part(T(new THREE.CylinderGeometry(0.1, 0.18, 2.2, 5), 0.7, 3.8, 0, 0, 0, -0.8), '#5a3f28', 0.1, 3));
  const blobs = v ? [[0, 5.6, 0, 2.6], [1.5, 5.0, 0.6, 1.9], [-1.4, 5.2, -0.5, 2.0], [0.3, 6.6, -0.6, 1.8], [-0.4, 5.0, 1.4, 1.8]] : [[0, 5.2, 0, 2.3], [1.3, 4.8, -0.4, 1.7], [-1.0, 5.4, 0.8, 1.9], [0.2, 6.3, 0.3, 1.6]];
  blobs.forEach((b, i) => parts.push(part(jitterGeo(T(new THREE.IcosahedronGeometry(b[3], 1), b[0], b[1], b[2]), 0.5, 10 + i + (v ? 20 : 0)), i % 2 ? '#3f7a2a' : '#4c8a30', 0.25, 30 + i)));
  return merge(parts);
}
function pineGeo(snow) {
  const parts = [part(T(new THREE.CylinderGeometry(0.18, 0.35, 3, 6), 0, 1.5, 0), '#4a3424', 0.1, 4)];
  const layers = [[2.6, 3.3, 2.2], [2.1, 3.0, 3.8], [1.6, 2.6, 5.2], [1.05, 2.2, 6.5], [0.55, 1.6, 7.7]];
  layers.forEach((l, i) => {
    const g = jitterGeo(T(new THREE.ConeGeometry(l[0], l[1], 8, 1), 0, l[2], 0, 0, i * 0.4), 0.25, 50 + i);
    const p = part(g, i % 2 ? '#24502e' : '#2c5d34', 0.2, 60 + i);
    if (snow) { const pc = p.attributes.position, cc = p.attributes.color; for (let k = 0; k < pc.count; k++) { const yy = pc.getY(k) - l[2]; if (yy > l[1] * 0.05) { cc.setXYZ(k, 0.92, 0.95, 0.98); } } }
    parts.push(p);
  });
  return merge(parts);
}
function birchGeo() {
  const parts = [];
  const trunk = part(T(new THREE.CylinderGeometry(0.14, 0.22, 5.5, 6, 6), 0, 2.75, 0), '#e8e4da', 0.05, 7);
  const cc = trunk.attributes.color, pc = trunk.attributes.position; for (let i = 0; i < pc.count; i += 3) if (hash2(Math.floor(pc.getY(i) * 3), i) < 0.25) for (let j = 0; j < 3; j++) cc.setXYZ(i + j, 0.2, 0.2, 0.2);
  parts.push(trunk);
  [[0, 5.8, 0, 1.6], [0.8, 5.0, 0.3, 1.2], [-0.7, 5.3, -0.4, 1.3], [0, 6.8, 0.2, 1.1]].forEach((b, i) => parts.push(part(jitterGeo(T(new THREE.IcosahedronGeometry(b[3], 1), b[0], b[1], b[2], 0, 0, 0, 1, 1.3), 0.35, 70 + i), i % 2 ? '#8ab04a' : '#a2c254', 0.25, 80 + i)));
  return merge(parts);
}
function palmGeo() {
  const parts = []; let x = 0, y = 0;
  for (let i = 0; i < 6; i++) { const g = T(new THREE.CylinderGeometry(0.17 - i * 0.012, 0.2 - i * 0.012, 1.25, 6), x, y + 0.6, 0, 0, 0, -0.08 * i); parts.push(part(g, i % 2 ? '#8a6a44' : '#7a5a3a', 0.1, 90 + i)); x += Math.sin(0.08 * i) * 1.25; y += Math.cos(0.08 * i) * 1.2; }
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const f = new THREE.PlaneGeometry(0.9, 3.4, 1, 4); const p = f.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k) + 1.7; p.setZ(k, -yy * yy * 0.12); p.setY(k, yy); }
    T(f, 0, 0, 0, -1.1, 0, 0); f.rotateY(a); f.translate(x, y, 0);
    parts.push(part(f, '#4a8a2e', 0.2, 100 + i));
  }
  return merge(parts);
}
function deadGeo() {
  const parts = [part(T(new THREE.CylinderGeometry(0.16, 0.38, 5, 6), 0, 2.5, 0), '#2a2220', 0.2, 110)];
  [[0.6, 3.6, 0, -0.9, 1.8], [-0.5, 3.2, 0.3, 1.0, 1.6], [0.2, 4.6, -0.4, -0.5, 1.4], [-0.1, 2.5, -0.6, 0.7, 1.2]].forEach((b, i) => { const g = T(new THREE.CylinderGeometry(0.04, 0.1, b[4], 4), b[0], b[1], b[2], b[3] * 0.5, i, b[3]); parts.push(part(g, '#2a2220', 0.2, 120 + i)); });
  return merge(parts);
}
function rockGeo(seed, col = '#8a847c', s = 1) { return merge([part(jitterGeo(T(new THREE.IcosahedronGeometry(1.0 * s, 1), 0, 0.45 * s, 0, 0, 0, 0, 1, 0.7), 0.45 * s, seed), col, 0.2, seed)]); }
function oreGeo(seed, crystal) {
  const parts = [part(jitterGeo(T(new THREE.IcosahedronGeometry(1.0, 1), 0, 0.5, 0, 0, 0, 0, 1, 0.75), 0.4, seed), '#6e6862', 0.2, seed)];
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + seed; const g = T(new THREE.OctahedronGeometry(0.28, 0), Math.cos(a) * 0.65, 0.55 + Math.sin(i * 2.3) * 0.3, Math.sin(a) * 0.65, i, a, i * 0.5, 1, 1.6); parts.push(part(g, crystal, 0.3, seed + i)); }
  return merge(parts);
}
function cottonGeo() {
  const parts = [];
  for (let i = 0; i < 5; i++) { const a = i * 1.3; parts.push(part(T(new THREE.CylinderGeometry(0.02, 0.03, 0.9, 4), Math.cos(a) * 0.15, 0.45, Math.sin(a) * 0.15, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3), '#5a7a3a', 0.1, 130 + i)); }
  parts.push(part(jitterGeo(T(new THREE.IcosahedronGeometry(0.45, 1), 0, 0.5, 0, 0, 0, 0, 1, 0.8), 0.15, 140), '#4a7a32', 0.25, 141));
  for (let i = 0; i < 9; i++) { const a = i * 2.1; parts.push(part(T(new THREE.IcosahedronGeometry(0.12, 1), Math.cos(a) * 0.38, 0.6 + (i % 3) * 0.18, Math.sin(a) * 0.38), '#f6f4ee', 0.05, 150 + i)); }
  return merge(parts);
}
function herbGeo() {
  const parts = [];
  for (let i = 0; i < 7; i++) { const a = i * 0.9; const g = new THREE.PlaneGeometry(0.16, 0.5); g.translate(0, 0.25, 0); T(g, 0, 0, 0, -0.5, a, 0); parts.push(part(g, '#3ac25a', 0.2, 160 + i)); }
  for (let i = 0; i < 3; i++) parts.push(part(T(new THREE.IcosahedronGeometry(0.06, 0), Math.cos(i * 2) * 0.12, 0.45, Math.sin(i * 2) * 0.12), '#c8ff8a', 0.05, 170 + i));
  return merge(parts);
}
function bushGeo() { return merge([part(jitterGeo(T(new THREE.IcosahedronGeometry(0.9, 1), 0, 0.6, 0, 0, 0, 0, 1, 0.75), 0.35, 180), '#3f7330', 0.3, 181), part(jitterGeo(T(new THREE.IcosahedronGeometry(0.6, 1), 0.6, 0.5, 0.2), 0.3, 182), '#4a8236', 0.3, 183)]); }

// wind sway for foliage
function windMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }, opts));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.time = world.time;
    sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sway = max(0.0, position.y - 1.5) * 0.018;
      transformed.x += sin(time*1.3 + ip.x*0.13 + ip.z*0.07) * sway;
      transformed.z += cos(time*1.1 + ip.z*0.11) * sway * 0.7;`);
  };
  return m;
}

// ---------- chunked instancing ----------
const CHUNK = 100;
const chunkGroups = new Map();
world.chunks = [];
function chunkOf(x, z) { const cx = Math.floor((x + HALF) / CHUNK), cz = Math.floor((z + HALF) / CHUNK); const k = cx * 100 + cz; let c = chunkGroups.get(k); if (!c) { c = { k, cx: -HALF + (cx + 0.5) * CHUNK, cz: -HALF + (cz + 0.5) * CHUNK, items: new Map(), meshes: [] }; chunkGroups.set(k, c); world.chunks.push(c); } return c; }
const kinds = {}; // name -> {geo, mat}
function addInstance(kind, x, y, z, rotY, s, tint, node, sxz) {
  const c = chunkOf(x, z); let a = c.items.get(kind); if (!a) c.items.set(kind, a = []);
  a.push({ x, y, z, rotY, s, tint, node, sxz: sxz ?? s });
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function buildChunks(scene) {
  for (const c of world.chunks) {
    for (const [kind, arr] of c.items) {
      const K = kinds[kind];
      const im = new THREE.InstancedMesh(K.geo, K.mat, arr.length);
      im.castShadow = !K.noShadow; im.receiveShadow = true;
      arr.forEach((it, i) => {
        _q.setFromEuler(_e.set(0, it.rotY, 0)); _s.set(it.sxz, it.s, it.sxz); _p.set(it.x, it.y, it.z);
        _m.compose(_p, _q, _s); im.setMatrixAt(i, _m);
        if (it.tint) im.setColorAt(i, tmpC.set(it.tint));
        if (it.node) { it.node.mesh = im; it.node.idx = i; it.node.matrix = _m.clone(); }
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.userData.kind = kind; im.userData.shadowDist = K.shadowDist || 90;
      scene.add(im); c.meshes.push(im);
    }
    c.items = null;
  }
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export function hideNode(n) { if (n.mesh) { n.mesh.setMatrixAt(n.idx, ZERO); n.mesh.instanceMatrix.needsUpdate = true; } if (n.col) n.col.on = false; }
export function showNode(n) { if (n.mesh) { n.mesh.setMatrixAt(n.idx, n.matrix); n.mesh.instanceMatrix.needsUpdate = true; } if (n.col) n.col.on = true; }
export function nodesNear(x, z) { return gridGet(nodeGrid, x, z); }
export function cullChunks(px, pz, viewDist, shadows) {
  for (const c of world.chunks) {
    const d = Math.hypot(c.cx - px, c.cz - pz);
    const vis = d < viewDist + CHUNK * 0.75;
    for (const m of c.meshes) { m.visible = vis; m.castShadow = shadows && d < m.userData.shadowDist + CHUNK * 0.5; }
  }
}

function addNode(type, x, z, s, rotY, kind, tint) {
  const y = heightAt(x, z);
  const N = NODE_TYPES[type];
  const n = { type, x, y, z, s, alive: true, respawn: 0, def: N, kind };
  const isTree = type.startsWith('tree');
  const r = isTree ? 0.3 * s : type === 'cotton' || type === 'healroot' ? 0 : 0.95 * s;
  if (r > 0) n.col = addCircle(x, z, r, 'node');
  addInstance(kind, x, y - (isTree ? 0.2 : 0.1), z, rotY, s, tint, n, isTree && type !== 'tree_palm' ? s * 0.72 : s);
  world.nodes.push(n); gridAdd(nodeGrid, x, z, 1, n);
  return n;
}

// ---------- placement ----------
function avoid(x, z, pad = 0) {
  if (GI && giAvoid(x, z, pad)) return true;
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 36 + pad) return true;
  if (!BATTLE && Math.hypot(x - PORT.x, z - PORT.z) < 82 + pad) return true;
  for (const c of CAMPS) if (Math.hypot(x - c.x, z - c.z) < c.r + 6 + pad) return true;
  for (const g of GOBLIN_CAMPS) if (Math.hypot(x - g[0], z - g[1]) < 16 + pad) return true;
  if (roadDist(x, z) < 4.5 + pad) return true;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 10) return true;
  if (distToLine(x, z, RIVER).d < 11) return true;
  if (Math.hypot(x - PLATEAU.x, z - PLATEAU.z) < PLATEAU.r + 4 && Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4) return true;
  for (const p of LAVA_POOLS) if (Math.hypot(x - p[0], z - p[1]) < p[2] + 5) return true;
  return false;
}
// Kingdom Battles: forests in clumps between towns, quarries and gold veins near each town and in the middle
function battleScatter() {
  const clear = (x, z, pad = 0) => { if (battleRoadDist(x, z) < 7 + pad) return true; for (const t of LAYOUT.towns) { if (Math.hypot(x - t.x, z - t.z) < WALL_R + 26 + pad) return true; for (const tw of t.towers) if (Math.hypot(x - tw[0], z - tw[1]) < 32 + pad) return true; } for (const c of LAYOUT.camps) if (Math.hypot(x - c.x, z - c.z) < 20 + pad) return true; for (const g of LAYOUT.gold) if (Math.hypot(x - g[0], z - g[1]) < 12) return true; for (const g of LAYOUT.stone) if (Math.hypot(x - g[0], z - g[1]) < 12) return true; return false; };
  for (let i = 0; i < 22000; i++) {
    const x = R(-540, 540), z = R(-540, 540), h = heightAt(x, z); if (h < 1.2 || h > 40) continue;
    if (normalAt(x, z).y < 0.8 || clear(x, z)) continue;
    const cl = fbm(x * 0.011 + 50, z * 0.011, 3) * 0.5 + 0.5;
    if (rng() > smooth(0.42, 0.75, cl) * 0.55 + 0.012) continue;
    const r = rng(), type = r < 0.45 ? 'tree_oak' : r < 0.8 ? 'tree_pine' : 'tree_birch';
    const kind = type === 'tree_oak' ? (rng() < 0.5 ? 'oakA' : 'oakB') : type.replace('tree_', '');
    addNode(type, x, z, R(1.6, 2.4), R(0, 6.28), kind, '#' + tmpC.setHSL(R(0.22, 0.32), R(0.25, 0.5), R(0.42, 0.6)).getHexString());
  }
  // a small wood lot right outside every town so the first workers have something to chop
  for (const t of LAYOUT.towns) for (const sd of [-1, 1]) {
    const cx = t.x + t.perp[0] * sd * 88 - t.dir[0] * 25, cz = t.z + t.perp[1] * sd * 88 - t.dir[1] * 25;
    for (let k = 0; k < 18; k++) { const a = R(0, 6.28), d = Math.sqrt(rng()) * 24, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.hypot(x - t.x, z - t.z) < WALL_R + 18 || battleRoadDist(x, z) < 8) continue;
      addNode(rng() < 0.5 ? 'tree_oak' : 'tree_pine', x, z, R(1.7, 2.3), R(0, 6.28), rng() < 0.5 ? 'oakA' : 'pine'); }
  }
  for (const [gx, gz] of LAYOUT.stone) for (let k = 0; k < 9; k++) { const a = R(0, 6.28), d = R(0, 9); addNode('rock', gx + Math.cos(a) * d, gz + Math.sin(a) * d, R(0.9, 1.4), R(0, 6.28), 'rock' + (k % 3)); }
  for (const [gx, gz] of LAYOUT.gold) for (let k = 0; k < 5; k++) { const a = R(0, 6.28), d = R(0, 6); addNode('gold_ore', gx + Math.cos(a) * d, gz + Math.sin(a) * d, R(0.9, 1.15), R(0, 6.28), 'goldv'); }
  for (let i = 0; i < 2600; i++) { const x = R(-540, 540), z = R(-540, 540), h = heightAt(x, z); if (h < 1.2 || clear(x, z, -3)) continue; if (rng() < 0.04) addNode('rock', x, z, R(0.7, 1.2), R(0, 6.28), 'rock' + (i % 3)); }
  for (let i = 0; i < 2200; i++) { const x = R(-540, 540), z = R(-540, 540), h = heightAt(x, z); if (h < 1.5 || clear(x, z, -4)) continue; addInstance('bush', x, h - 0.15, z, R(0, 6.28), R(0.6, 1.4), '#' + tmpC.setHSL(R(0.2, 0.33), 0.45, R(0.4, 0.55)).getHexString()); }
}
function scatter() {
  if (BATTLE) return battleScatter();
  if (YARD || ARENA) return;
  // trees
  const tries = 26000;
  for (let i = 0; i < tries; i++) {
    const x = R(-HALF + 10, HALF - 10), z = R(-HALF + 10, HALF - 10);
    const h = heightAt(x, z); if (h < 1.2) continue;
    const nrm = normalAt(x, z); if (nrm.y < 0.78) continue;
    if (avoid(x, z)) continue;
    const zn = zoneAt(x, z), m = biomeMasks(x, z);
    const cl = fbm(x * 0.012 + 50, z * 0.012, 3) * 0.5 + 0.5; // clustering
    let dens = 0, type = null, autumn = 0;
    const forestK = smooth(240, 120, z) * (1 - smooth(-110, -230, z) * 0.5);
    const coldK = clamp(m.hl * 1.4, 0, 1), dryK = clamp(m.dry * (1 - m.hl), 0, 1), ashK = m.ash;
    if (zn === 'coast' || (zn === 'north' && h < 4)) { if (h < 5 && rng() < (h < 3 ? 0.07 : 0.035)) type = 'tree_palm'; } // palms all along the beaches
    else {
      dens = (0.05 + forestK * 0.5) * smooth(0.3, 0.6, cl) + forestK * 0.06;
      dens *= 1 - smooth(0.5, 0.95, ashK) * 0.85;
      if (h > 75) dens *= 0.15;
      const r = rng();
      if (ashK > 0.55 || (ashK > 0.25 && r < ashK)) type = 'tree_dead';
      else if (BATTLE && coldK > 0.2 && rng() < coldK) type = h > 40 + rng() * 15 ? 'tree_snow' : 'tree_pine';
      else if (zn === 'wood') { type = rng() < 0.4 ? 'tree_palm' : 'tree_oak'; dens = Math.max(dens, 0.32 * smooth(0.25, 0.55, cl) + 0.08); } // the jungle: palms and broad trees, thick
      else if (zn === 'highlands') type = h > 55 ? 'tree_pine' : rng() < 0.6 ? 'tree_oak' : 'tree_pine';
      else if ((zn === 'meadow' || zn === 'north') && rng() < 0.35) type = rng() < 0.4 ? 'tree_palm' : 'tree_birch';
      else type = rng() < 0.65 ? 'tree_oak' : 'tree_birch';
      autumn = clamp(dryK * 1.6 + ashK, 0, 1);
    }
    if (!type || (dens && rng() > dens)) continue;
    const s = type === 'tree_palm' ? R(1.3, 1.7) : R(1.6, 2.4);
    const kind = type === 'tree_oak' ? (rng() < 0.5 ? 'oakA' : 'oakB') : type.replace('tree_', '');
    let tint = type === 'tree_dead' ? null : '#' + tmpC.setHSL(R(0.22, 0.32), R(0.25, 0.5), R(0.42, 0.6)).getHexString();
    if (autumn > 0.15 && (type === 'tree_oak' || type === 'tree_birch') && rng() < autumn) tint = '#' + tmpC.setHSL(R(0.02, 0.11), R(0.6, 0.85), R(0.5, 0.65)).getHexString();
    addNode(type, x, z, s, R(0, 6.28), kind, type === 'tree_palm' ? null : tint);
  }
  // bushes (decor)
  for (let i = 0; i < 5200; i++) {
    const x = R(-HALF, HALF), z = R(-HALF, HALF), h = heightAt(x, z); if (h < 1.5) continue;
    const zn = zoneAt(x, z); if (zn === 'ashlands' || zn === 'coast' || (zn === 'highlands' && h > 70)) continue;
    if (avoid(x, z, -2)) continue;
    addInstance('bush', x, h - 0.15, z, R(0, 6.28), R(0.6, 1.4), '#' + tmpC.setHSL(R(0.2, 0.33), 0.45, R(0.4, 0.55)).getHexString());
  }
  // rocks & ore
  const oreZone = { meadow: ['rock', 'rock', 'copper'], wood: ['rock', 'copper', 'iron', 'iron'], highlands: ['rock', 'iron', 'mithril', 'mithril'], ashlands: ['rock', 'starmetal', 'starmetal', 'mithril'], coast: ['rock'], north: ['rock', 'copper', 'iron'] };
  for (let i = 0; i < 5200; i++) {
    const x = R(-HALF + 10, HALF - 10), z = R(-HALF + 10, HALF - 10), h = heightAt(x, z); if (h < 1.0) continue;
    if (avoid(x, z, -1)) continue;
    const zn = zoneAt(x, z);
    const hill = smooth(0.95, 0.8, normalAt(x, z).y) + (fbm(x * 0.02 - 20, z * 0.02 + 5, 2) > 0.25 ? 0.6 : 0);
    if (rng() > (zn === 'meadow' ? 0.08 : 0.1) * (0.4 + hill * 1.4)) continue;
    let type = GI ? 'rock' : oreZone[zn][Math.floor(rng() * oreZone[zn].length)];
    if (zn === 'highlands' && h > 75 && rng() < 0.35) type = 'starmetal'; // the richest veins near Kelda's top
    // copper close to the village so the first quest is easy
    const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    if (zn === 'meadow' && dv < 200 && rng() < 0.35) type = 'copper';
    const kind = type === 'rock' ? (zn === 'ashlands' ? 'rockAsh' : zn === 'highlands' && h > 50 ? 'rockSnow' : 'rock' + (i % 3)) : type;
    addNode(type, x, z, type === 'rock' ? R(0.7, 1.3) : R(0.8, 1.05), R(0, 6.28), kind);
  }
  // cotton (meadow), healroot (forest)
  for (let i = 0; i < (GI ? 0 : 2600); i++) {
    const x = R(-HALF, HALF), z = R(-HALF, HALF), h = heightAt(x, z); if (h < 2) continue;
    const zn = zoneAt(x, z); if (avoid(x, z, -2)) continue;
    const cl = fbm(x * 0.03 + 9, z * 0.03, 2);
    if (zn === 'meadow' && cl > 0.15 && rng() < 0.5) addNode('cotton', x, z, R(0.9, 1.2), R(0, 6.28), 'cotton');
    else if (zn === 'wood' && cl > 0.2 && rng() < 0.3) addNode('healroot', x, z, R(0.9, 1.3), R(0, 6.28), 'healroot');
    else if (zn === 'highlands' && h < 50 && cl > 0.35 && rng() < 0.1) addNode('healroot', x, z, 1, R(0, 6.28), 'healroot');
  }
  // guarantee some nodes near the village for the early quests
  const near = [[60, 260, 'copper'], [-70, 250, 'copper'], [90, 240, 'copper'], [-40, 230, 'rock'], [30, 230, 'rock'], [110, 270, 'rock'], [-110, 270, 'copper'], [130, 230, 'copper']];
  if (!GI) for (const [x, z, t] of near) if (!avoid(x, z)) addNode(t, x, z, 1, R(0, 6), t === 'rock' ? 'rock0' : t);
  if (!GI) for (let i = 0; i < 26; i++) { const a = R(0, 6.28), d = R(75, 150); const x = VILLAGE.x + Math.cos(a) * d, z = VILLAGE.z - 20 - Math.abs(Math.sin(a)) * d; if (!avoid(x, z) && heightAt(x, z) > 2) addNode('cotton', x, z, 1, R(0, 6), 'cotton'); }
  for (let i = 0; i < 22; i++) { const a = R(0, 6.28), d = R(65, 140); const x = VILLAGE.x + Math.cos(a) * d, z = VILLAGE.z - 20 - Math.abs(Math.sin(a)) * d * 0.9; if (!avoid(x, z) && heightAt(x, z) > 2) addNode(i % 3 ? 'tree_oak' : 'tree_birch', x, z, R(1.6, 2.2), R(0, 6), i % 3 ? 'oakA' : 'birch'); }
}

// ---------- buildings & props ----------
const M = {};
function mats() {
  const S = (c, r = 0.85, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
  Object.assign(M, {
    stone: S('#8a847a', 0.95), darkStone: S('#5a5650', 0.95), plaster: S('#e6dcc4', 0.95), beam: S('#4a3020', 0.85), wood: S('#7a5a3a', 0.85), plank: S('#9a7650', 0.85),
    thatch: S('#b8954a', 1), roofRed: S('#8a3a2a', 0.9), roofSlate: S('#4a5058', 0.8), cloth: S('#c8b890', 0.95, 0, { side: THREE.DoubleSide }), clothRed: S('#a02a2a', 0.9, 0, { side: THREE.DoubleSide }),
    clothGreen: S('#3a6a3a', 0.9, 0, { side: THREE.DoubleSide }), clothBlue: S('#2a4a8a', 0.9, 0, { side: THREE.DoubleSide }), iron: S('#3a3a3e', 0.5, 0.8), gold: S('#d8b04a', 0.4, 0.8),
    window: S('#ffd890', 0.6, 0, { emissive: '#ffb050', emissiveIntensity: 0.0 }), dark: S('#1e1610', 0.9), snow: S('#eef2f6', 0.9), bone: S('#e8dfc4', 0.8), lava: null,
    coal: S('#ff5a10', 0.6, 0, { emissive: '#ff4a00', emissiveIntensity: 2.0 }), hide: S('#a8784a', 0.9, 0, { side: THREE.DoubleSide }), glass: S('#7ad0ff', 0.2, 0, { emissive: '#3080ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }),
  });
}
function bx(w, h, d, m, x, y, z, parent, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
function cy(rt, rb, h, m, x, y, z, parent, seg = 10) { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
const statics = [];
function placeGroup(g, x, z, rot, scene, yOff = 0, ground) { g.position.set(x, (ground ?? heightAt(x, z)) + yOff, z); g.rotation.y = rot; scene.add(g); statics.push(g); return g; }
// merge every static prop/building into a few big meshes per material and area (far fewer draw calls)
function mergeStatics(scene) {
  const buckets = new Map();
  for (const g of statics) {
    if (g.userData.dynamic || !g.parent) continue;
    g.updateMatrixWorld(true);
    const keep = [];
    g.traverse(o => {
      if (!o.isMesh || o.userData.keep) return;
      const ck = Math.floor((g.position.x + HALF) / 120) * 100 + Math.floor((g.position.z + HALF) / 120);
      const key = o.material.uuid + '|' + ck;
      let b = buckets.get(key); if (!b) buckets.set(key, b = { mat: o.material, geos: [], shadow: o.castShadow });
      let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.applyMatrix4(o.matrixWorld);
      b.geos.push(geo); keep.push(o);
    });
    g.parent.remove(g);
  }
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos, false); if (!geo) continue;
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, b.mat); m.castShadow = b.shadow; m.receiveShadow = true; scene.add(m);
  }
  statics.length = 0;
}
function faceCenter(x, z, cx, cz) { return Math.atan2(cx - x, cz - z); }

function house(w, d, h, roof = 'thatch', opts = {}) {
  const g = new THREE.Group();
  bx(w + 0.4, 0.8, d + 0.4, M.stone, 0, 0.1, 0, g);
  bx(w, h, d, opts.stoneWalls ? M.stone : M.plaster, 0, 0.5 + h / 2, 0, g);
  if (!opts.stoneWalls) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.25, h, 0.25, M.beam, sx * w / 2, 0.5 + h / 2, sz * d / 2, g);
    bx(w + 0.05, 0.2, d + 0.05, M.beam, 0, 0.5 + h * 0.55, 0, g);
    for (const sz of [-1, 1]) { const b = bx(0.18, h * 0.62, 0.05, M.beam, -w * 0.3, 0.5 + h * 0.3, sz * (d / 2 + 0.02), g, 0, 0, 0.6); const b2 = bx(0.18, h * 0.62, 0.05, M.beam, w * 0.3, 0.5 + h * 0.3, sz * (d / 2 + 0.02), g, 0, 0, -0.6); }
  }
  // gable roof
  const rh = w * 0.42, rl = Math.hypot(w / 2 + 0.6, rh);
  const rm = roof === 'thatch' ? M.thatch : roof === 'slate' ? M.roofSlate : M.roofRed;
  const ang = Math.atan2(rh, w / 2 + 0.6);
  for (const s of [-1, 1]) { const r = bx(rl, 0.3, d + 1.2, rm, s * (w / 4 + 0.3), 0.5 + h + rh / 2, 0, g, 0, 0, -s * ang); }
  if (opts.snow) for (const s of [-1, 1]) bx(rl, 0.12, d + 1.25, M.snow, s * (w / 4 + 0.3), 0.5 + h + rh / 2 + 0.2, 0, g, 0, 0, -s * ang);
  // gable triangles
  const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, rh); tri.lineTo(-w / 2, 0);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), opts.stoneWalls ? M.stone : M.plaster); m.material.side = THREE.DoubleSide; m.position.set(0, 0.5 + h, s * d / 2); g.add(m); }
  // door & windows (front is +z)
  bx(1.2, 2.1, 0.12, M.wood, 0, 0.5 + 1.05, d / 2 + 0.04, g); bx(1.45, 0.18, 0.16, M.beam, 0, 0.5 + 2.15, d / 2 + 0.05, g);
  const handle = cy(0.04, 0.04, 0.1, M.iron, 0.4, 0.5 + 1.0, d / 2 + 0.12, g); handle.rotation.x = Math.PI / 2;
  const wins = [];
  for (const sx of [-1, 1]) { const wn = bx(0.8, 0.8, 0.1, M.window, sx * w * 0.3, 0.5 + h * 0.6, d / 2 + 0.03, g); wins.push(wn); bx(0.95, 0.1, 0.15, M.beam, sx * w * 0.3, 0.5 + h * 0.6 - 0.45, d / 2 + 0.06, g); bx(0.08, 0.8, 0.12, M.beam, sx * w * 0.3, 0.5 + h * 0.6, d / 2 + 0.06, g); }
  for (const sz of [-1, 1]) { const wn = bx(0.1, 0.8, 0.8, M.window, sz * (w / 2 + 0.03), 0.5 + h * 0.6, 0, g); wins.push(wn); }
  // more detail: shutters, flower boxes, a porch over the door, a woodpile lean-to
  if (opts.detail) {
    const shM = opts.shutter || M.clothBlue, flM = new THREE.MeshStandardMaterial({ color: '#c84a5a', roughness: 0.8 }), lfM = new THREE.MeshStandardMaterial({ color: '#4a8a3a', roughness: 0.9 });
    for (const sx of [-1, 1]) { const wx = sx * w * 0.3, wy = 0.5 + h * 0.6;
      for (const k of [-1, 1]) bx(0.32, 0.86, 0.06, shM, wx + k * 0.6, wy, d / 2 + 0.09, g);
      bx(1.0, 0.22, 0.3, M.wood, wx, wy - 0.56, d / 2 + 0.18, g); for (let f = 0; f < 4; f++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), f % 2 ? flM : lfM); fl.position.set(wx - 0.36 + f * 0.24, wy - 0.4, d / 2 + 0.2); g.add(fl); } }
    for (const sx of [-1, 1]) cy(0.07, 0.08, 2.5, M.beam, sx * 0.95, 0.5 + 1.25, d / 2 + 1.1, g, 6);
    const aw = bx(2.3, 0.12, 1.5, opts.roofM || M.roofRed, 0, 0.5 + 2.6, d / 2 + 0.7, g); aw.rotation.x = 0.28;
    const ln = bx(1.4, 0.1, d * 0.7, M.beam, w / 2 + 0.75, 0.5 + 1.6, 0, g); ln.rotation.z = -0.35;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { const lg = cy(0.13, 0.13, d * 0.55, M.wood, w / 2 + 0.55, 0.65 + r * 0.26, -d * 0.25 + k * 0.01, g, 6); lg.rotation.x = Math.PI / 2; lg.position.x += (k - 1.5) * 0.27; }
  }
  // chimney
  if (!opts.noChimney) { bx(0.7, h + rh + 0.8, 0.7, M.stone, w * 0.3, 0.5 + (h + rh + 0.8) / 2, -d * 0.25, g); world.chimneys = world.chimneys || []; g.userData.chimney = new THREE.Vector3(w * 0.3, 0.5 + h + rh + 0.9, -d * 0.25); }
  return g;
}
function addHouse(scene, x, z, w, d, h, roof, opts) {
  const rot = opts?.rot ?? faceCenter(x, z, opts?.cx ?? VILLAGE.x, opts?.cz ?? VILLAGE.z);
  const g = house(w, d, h, roof, opts || {});
  const gy = Math.min(heightAt(x - w / 2, z - d / 2), heightAt(x + w / 2, z + d / 2), heightAt(x, z), heightAt(x - w / 2, z + d / 2), heightAt(x + w / 2, z - d / 2));
  placeGroup(g, x, z, rot, scene, 0, gy - 0.2);
  addBox(x, z, w / 2 + 0.3, d / 2 + 0.3, rot);
  if (g.userData.chimney) { const p = g.userData.chimney.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(g.position); world.smokes = world.smokes || []; world.smokes.push(p); }
  return g;
}

function fire(scene, x, y, z, size = 1, light = true) {
  const f = { pos: new THREE.Vector3(x, y, z), size, light };
  world.fires.push(f);
  return f;
}
function campfire(g, scene, x, z) {
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), M.darkStone); s.position.set(Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75); s.castShadow = true; g.add(s); }
  for (let i = 0; i < 4; i++) { const l = cy(0.09, 0.1, 1.1, M.beam, 0, 0.25, 0, g, 6); l.rotation.z = 1.1; l.rotation.y = i * Math.PI / 2; l.position.set(Math.cos(i * Math.PI / 2) * 0.2, 0.25, Math.sin(i * Math.PI / 2) * 0.2); }
  const coal = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6, 0, 6.3, 0, 1.4), M.coal); coal.position.y = 0.05; coal.scale.y = 0.4; g.add(coal);
  // spit
  for (const s of [-1, 1]) { const p = cy(0.03, 0.03, 1.4, M.beam, s * 0.9, 0.7, 0, g, 5); }
  cy(0.025, 0.025, 2, M.iron, 0, 1.35, 0, g, 5).rotation.z = Math.PI / 2;
  fire(scene, x, heightAt(x, z) + 0.45, z, 1);
}
function station(scene, s) {
  const g = new THREE.Group();
  const y = heightAt(s.x, s.z);
  switch (s.type) {
    case 'workbench': {
      bx(2.2, 0.12, 1.0, M.plank, 0, 0.9, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.1, 0.9, 0.1, M.beam, sx * 1.0, 0.45, sz * 0.4, g);
      const saw = bx(0.7, 0.18, 0.02, M.iron, 0.4, 1.02, 0, g, 0, 0.3, 0); bx(0.15, 0.12, 0.05, M.beam, 0.05, 1.02, -0.1, g, 0, 0.3, 0);
      for (let i = 0; i < 3; i++) { const l = cy(0.16, 0.16, 1.4, M.wood, -1.6, 0.18 + i * 0.3 - (i === 2 ? 0.13 : 0), (i - 1) * 0.3 + (i === 2 ? 0.15 : 0), g, 8); l.rotation.x = Math.PI / 2; }
      bx(0.5, 0.5, 0.5, M.wood, 1.5, 0.25, 0.3, g); break;
    }
    case 'forge': {
      bx(2.0, 1.0, 1.6, M.stone, 0, 0.5, 0, g); const c = bx(1.4, 0.12, 1.0, M.coal, 0, 1.02, 0, g);
      bx(1.0, 2.6, 0.9, M.stone, 0, 2.3, -0.4, g); bx(0.6, 1.5, 0.6, M.stone, 0, 4.2, -0.4, g);
      const anvil = new THREE.Group(); anvil.position.set(1.8, 0, 0.3); g.add(anvil); bx(0.4, 0.5, 0.35, M.iron, 0, 0.25, 0, anvil); bx(0.75, 0.2, 0.3, M.iron, 0, 0.6, 0, anvil); const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), M.iron); horn.rotation.z = Math.PI / 2; horn.position.set(0.5, 0.6, 0); anvil.add(horn);
      cy(0.35, 0.3, 0.6, M.wood, -1.6, 0.3, 0.4, g); // quench barrel
      // roof over smithy
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(0.12, 0.12, 3.4, M.beam, sx * 2.6, 1.7, sz * 1.8, g, 6);
      bx(6, 0.25, 4.4, M.thatch, 0, 3.5, 0, g, 0.12, 0, 0);
      fire(scene, s.x, y + 1.3, s.z, 0.8);
      addCircle(s.x, s.z, 1.3); break;
    }
    case 'loom': {
      for (const sx of [-1, 1]) { bx(0.12, 1.8, 0.12, M.beam, sx * 0.8, 0.9, -0.4, g); bx(0.12, 1.0, 0.12, M.beam, sx * 0.8, 0.5, 0.4, g); bx(0.1, 0.1, 0.9, M.beam, sx * 0.8, 1.0, 0, g); }
      bx(1.7, 0.1, 0.1, M.beam, 0, 1.75, -0.4, g); bx(1.7, 0.1, 0.1, M.beam, 0, 0.95, 0.4, g);
      const cloth = bx(1.4, 0.9, 0.02, M.cloth, 0, 1.3, -0.1, g, 0.45, 0, 0);
      bx(1.6, 0.06, 0.5, M.plank, 0, 0.55, 0.65, g); break;
    }
    case 'tanning': {
      for (const sx of [-1, 1]) bx(0.12, 2.0, 0.12, M.beam, sx * 0.9, 1.0, 0, g);
      bx(2.0, 0.1, 0.1, M.beam, 0, 1.95, 0, g); bx(2.0, 0.1, 0.1, M.beam, 0, 0.4, 0, g);
      const hide = bx(1.4, 1.3, 0.03, M.hide, 0, 1.15, 0.02, g); cy(0.3, 0.32, 0.5, M.wood, 1.4, 0.25, 0.4, g); break;
    }
    case 'campfire': campfire(g, scene, s.x, s.z); addCircle(s.x, s.z, 0.9); break;
    case 'alchemy': {
      bx(1.8, 0.1, 0.9, M.plank, 0, 0.9, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.1, 0.9, 0.1, M.beam, sx * 0.8, 0.45, sz * 0.35, g);
      const cols = ['#ff4040', '#40ff80', '#4080ff', '#ffc040'];
      for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.25, 8), new THREE.MeshStandardMaterial({ color: cols[i % 4], emissive: cols[i % 4], emissiveIntensity: 0.7, transparent: true, opacity: 0.85 })); b.position.set(-0.6 + i * 0.3, 1.08, (i % 2) * 0.2 - 0.1); g.add(b); }
      const pot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.iron); pot.position.set(1.4, 0.35, 0); g.add(pot); break;
    }
  }
  placeGroup(g, s.x, s.z, s.rot, scene, 0, y);
  if (s.type !== 'campfire' && s.type !== 'forge') addCircle(s.x, s.z, 1.0);
  world.stations.push({ type: s.type, x: s.x, z: s.z, y });
}
function tent(scene, x, z, rot, m = M.cloth, s = 1) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0, 2.2 * s, 2.6 * s, 4, 1, true); geo.rotateY(Math.PI / 4);
  const t = new THREE.Mesh(geo, m); t.position.y = 1.3 * s; t.castShadow = true; g.add(t);
  cy(0.05, 0.05, 2.9 * s, M.beam, 0, 1.45 * s, 0, g, 5);
  placeGroup(g, x, z, rot, scene, 0); addCircle(x, z, 1.7 * s);
}
function lampPost(scene, x, z) { const g = new THREE.Group(); cy(0.07, 0.09, 3, M.beam, 0, 1.5, 0, g, 6); bx(0.8, 0.07, 0.07, M.beam, 0.35, 2.9, 0, g); const l = bx(0.25, 0.35, 0.25, M.window, 0.7, 2.65, 0, g); placeGroup(g, x, z, 0, scene); addCircle(x, z, 0.2); world.lamps = world.lamps || []; world.lamps.push(new THREE.Vector3(x + 0.7, heightAt(x, z) + 2.65, z)); }
function barrel(scene, x, z) { const g = new THREE.Group(); cy(0.38, 0.34, 0.95, M.wood, 0, 0.47, 0, g, 12); for (const y of [0.15, 0.8]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.02, 4, 16), M.iron); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); } placeGroup(g, x, z, 0, scene); addCircle(x, z, 0.4); }
function crate(scene, x, z, rot = 0, s = 0.8) { const g = new THREE.Group(); bx(s, s, s, M.plank, 0, s / 2, 0, g); placeGroup(g, x, z, rot, scene); addBox(x, z, s / 2, s / 2, rot); }

const PIER_Y = 1.25; // piers sit low, level with the rail of a moored boat
// the Training Yard: a fenced field with weapon racks, banners and archery butts
function buildYard(scene) {
  const R = 70, n = 90;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R; const g = new THREE.Group(); cy(0.12, 0.14, 1.6, M.beam, 0, 0.8, 0, g, 6); bx(2 * Math.PI * R / n + 0.1, 0.12, 0.1, M.plank, 0, 1.2, 0, g); bx(2 * Math.PI * R / n + 0.1, 0.12, 0.1, M.plank, 0, 0.6, 0, g); placeGroup(g, x, z, -a + Math.PI / 2, scene); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; banner(scene, Math.cos(a) * (R - 3), Math.sin(a) * (R - 3), i % 2 ? M.clothRed : M.clothBlue); }
  for (const [x, z] of [[-14, 40], [14, 40]]) { const g = new THREE.Group(); bx(3, 0.15, 0.4, M.beam, 0, 1.5, 0, g); for (let k = 0; k < 6; k++) { const s = cy(0.03, 0.03, 2.4, M.wood, -1.2 + k * 0.48, 1.2, 0, g, 4); s.rotation.z = 0.08; } for (const s of [-1, 1]) cy(0.07, 0.07, 1.6, M.beam, s * 1.45, 0.8, 0, g, 5); placeGroup(g, x, z, 0, scene); }
  for (const x of [-30, -10, 10, 30]) { const g = new THREE.Group(); const t = cy(1.2, 1.2, 0.3, M.cloth, 0, 1.6, 0, g, 20); t.rotation.x = Math.PI / 2; const r = cy(0.7, 0.7, 0.32, M.clothRed, 0, 1.6, 0.01, g, 20); r.rotation.x = Math.PI / 2; for (const s of [-1, 1]) { const l = cy(0.06, 0.06, 2.2, M.beam, s * 0.8, 1, -0.3, g, 4); l.rotation.x = 0.25; } placeGroup(g, x, -60, 0, scene); }
}
function buildVillage(scene) {
  const V = VILLAGE;
  const H = [
    [-29, 350, 9, 7.5, 4.6, 'thatch'], [31.5, 342, 10, 7.5, 4.8, 'thatch'], [-33, 375, 9, 7.5, 4.4, 'red'], [36, 367, 9, 8.5, 4.6, 'red'],
    [-9.5, 334.5, 11.5, 8.5, 5.2, 'red'], [15, 331.5, 9, 7.5, 4.6, 'thatch'],
  ];
  // Seabreak's houses: bigger, with shutters, flower boxes, porches and woodpiles
  for (const h of H) addHouse(scene, h[0], h[1], h[2], h[3], h[4], h[5], { detail: true, shutter: h[5] === 'red' ? M.clothBlue : M.clothGreen });
  for (const s of STATION_SPOTS) station(scene, s);
  // well
  { const g = new THREE.Group(); const ring = cy(1.0, 1.05, 0.9, M.stone, 0, 0.45, 0, g, 14); const water = cy(0.85, 0.85, 0.05, new THREE.MeshStandardMaterial({ color: '#1a3a5a', roughness: 0.2 }), 0, 0.7, 0, g, 14);
    for (const sx of [-1, 1]) bx(0.14, 2.0, 0.14, M.beam, sx * 0.85, 1.4, 0, g); bx(2.2, 0.12, 0.12, M.beam, 0, 2.35, 0, g);
    for (const s of [-1, 1]) bx(1.4, 0.08, 2.4, M.thatch, s * 0.5, 2.6, 0, g, 0, 0, s * 0.6);
    placeGroup(g, -5.5, 351, 0.3, scene); addCircle(-5.5, 351, 1.15); }
  // market stall for Odo
  { const g = new THREE.Group(); bx(2.6, 0.9, 1.0, M.plank, 0, 0.45, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(0.06, 0.06, 2.6, M.beam, sx * 1.25, 1.3, sz * 0.6, g, 5);
    for (let i = 0; i < 5; i++) bx(0.55, 0.04, 1.6, i % 2 ? M.clothRed : M.cloth, -1.1 + i * 0.55, 2.6, 0.1, g, 0.18, 0, 0);
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshStandardMaterial({ color: ['#e04030', '#f0c040', '#60b040'][i % 3] })); c.position.set(-0.8 + i * 0.4, 0.98, 0); g.add(c); }
    placeGroup(g, 7.7, 356, Math.PI, scene); addBox(7.7, 356, 1.35, 0.6, Math.PI); }
  buildPier(scene);
  // fish racks, barrels, crates, lamps
  buildVillageProps(scene);
}
function buildPier(scene) {
  // pier from the beach into the sea
  const pierX = -4, pw = 2.0; let z0 = 380; while (z0 < 520 && heightAt(pierX, z0) > 0.9) z0 += 1; z0 -= 10; const z1 = z0 + 52;
  { const g = new THREE.Group(); const len = z1 - z0;
    for (let i = 0; i < len / 0.5; i++) { const p = bx(pw * 2, 0.1, 0.45, M.plank, 0, 0, i * 0.5 - len / 2 + 0.25, g); p.rotation.z = (hash2(i, 3) - 0.5) * 0.03; }
    for (let i = 0; i <= len / 4; i++) for (const sx of [-1, 1]) cy(0.13, 0.13, 6, M.beam, sx * pw, -3, i * 4 - len / 2, g, 6);
    placeGroup(g, pierX, (z0 + z1) / 2, 0, scene, 0, PIER_Y - 0.05); world.pier = { x: pierX, z0, z1, w: pw, y: PIER_Y };
    addSurface(pierX, (z0 + z1) / 2, pw, len / 2, 0, PIER_Y);
    // boats
    for (const [bxp, bzp, r] of []) { // (the old rowing boats are gone: only your own boat is moored here)
      const b = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.wood); hull.scale.set(1.1, 0.6, 2.6); hull.material.side = THREE.DoubleSide; b.add(hull);
      bx(2.0, 0.08, 0.3, M.plank, 0, -0.15, 0.5, b); bx(2.0, 0.08, 0.3, M.plank, 0, -0.15, -0.8, b);
      placeGroup(b, bxp, bzp, r, scene, 0, 0.35); b.userData.dynamic = true; world.boats = world.boats || []; world.boats.push(b);
    }
  }
}
function buildVillageProps(scene) {
  { const g = new THREE.Group(); for (const sx of [-1, 1]) bx(0.1, 1.8, 0.1, M.beam, sx * 1.2, 0.9, 0, g); bx(2.6, 0.08, 0.08, M.beam, 0, 1.75, 0, g);
    for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 5), new THREE.MeshStandardMaterial({ color: '#a8b0b8', metalness: 0.4, roughness: 0.5 })); f.position.set(-1 + i * 0.4, 1.45, 0); f.rotation.x = Math.PI; g.add(f); }
    placeGroup(g, -16, 396, 0.2, scene); addBox(-16, 396, 1.3, 0.2, 0.2); }
  [[-19, 361], [22, 355], [13, 342], [-24, 345], [7, 375], [-8, 375]].forEach(([x, z]) => barrel(scene, x, z));
  [[-18.5, 362.5, 0.3], [23, 357, 0.8], [14, 345, 0.1], [-12, 394, 0.5], [-34, 365, 0.2]].forEach(([x, z, r]) => crate(scene, x, z, r));
  [[-10, 362], [11, 365], [0, 345], [-3, 378], [17, 378], [-22, 369]].forEach(([x, z]) => lampPost(scene, x, z));
  // sign post at the north road
  { const g = new THREE.Group(); cy(0.08, 0.08, 2.6, M.beam, 0, 1.3, 0, g, 6); bx(1.4, 0.35, 0.06, M.plank, 0.5, 2.2, 0, g, 0, 0, 0.1); bx(1.2, 0.3, 0.06, M.plank, -0.4, 1.7, 0, g, 0, 0.4, -0.1); placeGroup(g, 6, 326, 0.2, scene); }
}

function buildRaft(scene) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const l = cy(0.18, 0.18, 3.2 - (i % 3) * 0.6, M.wood, (i - 2.5) * 0.37, 0.18, (i % 2) * 0.3, g, 8); l.rotation.x = Math.PI / 2; l.rotation.z = (hash2(i, 9) - 0.5) * 0.15; }
  for (const z of [-0.8, 0.7]) { const r = cy(0.04, 0.04, 2.4, M.beam, 0, 0.36, z, g, 5); r.rotation.z = Math.PI / 2; }
  const mast = cy(0.08, 0.1, 2.2, M.wood, 0.3, 0.3, 0, g, 6); mast.rotation.z = 1.25; mast.position.set(1.4, 0.4, 0);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4, 4, 4), M.cloth); const sp = sail.geometry.attributes.position; for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin(sp.getX(i) * 2) * 0.15 + hash2(i, 1) * 0.1); sail.geometry.computeVertexNormals(); sail.position.set(2.2, 0.2, 0.6); sail.rotation.set(-1.4, 0.2, 0.3); g.add(sail);
  // scattered debris
  for (let i = 0; i < 4; i++) { const l = cy(0.15, 0.15, 1.6, M.wood, R(-3, 4), 0.12, R(-3, 3), g, 7); l.rotation.set(Math.PI / 2, R(0, 3), 0); }
  { const b = new THREE.Group(); cy(0.3, 0.27, 0.7, M.wood, 0, 0.3, 0, b, 10); b.rotation.z = 1.4; b.position.set(-2.5, 0.2, 1.5); g.add(b); }
  placeGroup(g, SPAWN.x - 3, SPAWN.z + 3.5, 0.6, scene, -0.05);
  addCircle(SPAWN.x - 3, SPAWN.z + 3.5, 1.4);
}

function buildCamps(scene) {
  // Whisperwood outpost
  tent(scene, -28, 52, 0.5, M.clothGreen); tent(scene, -54, 58, -0.3, M.clothGreen); tent(scene, -48, 84, 2.5, M.clothGreen, 1.1);
  { const g = new THREE.Group(); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(0.13, 0.15, 7, M.beam, sx * 1.3, 3.5, sz * 1.3, g, 6); bx(3.4, 0.2, 3.4, M.plank, 0, 6, 0, g); for (const s of [-1, 1]) { bx(3.4, 0.9, 0.1, M.plank, 0, 6.5, s * 1.65, g); bx(0.1, 0.9, 3.4, M.plank, s * 1.65, 6.5, 0, g); } const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 4), M.thatch); roof.rotation.y = Math.PI / 4; roof.position.y = 8.6; g.add(roof); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(0.07, 0.07, 1.8, M.beam, sx * 1.5, 7.8, sz * 1.5, g, 5); placeGroup(g, -22, 82, 0.2, scene); addBox(-22, 82, 1.6, 1.6, 0.2); }
  banner(scene, -32, 66, M.clothGreen);
  // Stonewatch: Captain Hilda's stone lodge on the western slopes of Kelda
  { const [cx, cz] = [CAMPS[1].x, CAMPS[1].z];
    addHouse(scene, cx + 14, cz - 12, 8, 6, 3.4, 'slate', { stoneWalls: true, cx, cz }); addHouse(scene, cx - 14, cz - 6, 6, 6, 3.0, 'slate', { stoneWalls: true, cx, cz }); addHouse(scene, cx + 4, cz + 16, 7, 6, 3.2, 'slate', { stoneWalls: true, cx, cz });
    banner(scene, cx + 2, cz - 2, M.clothBlue); const fg = new THREE.Group(); campfire(fg, scene, cx - 3, cz + 4); placeGroup(fg, cx - 3, cz + 4, 0, scene); addCircle(cx - 3, cz + 4, 0.9);
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; if (Math.abs(Math.sin(a - 0.4)) < 0.25) continue; const x = cx + Math.cos(a) * 25, z = cz + Math.sin(a) * 25; const g = new THREE.Group(); bx(4.6, R(1.4, 2.2), 1, M.stone, 0, 0.8, 0, g); placeGroup(g, x, z, -a + Math.PI / 2, scene, -0.2); addBox(x, z, 2.3, 0.5, -a + Math.PI / 2); } }
  // the goblin war camp on Kelda's eastern slopes: sharpened stakes, hide tents, war drums and powder
  goblinFort(scene, CAMPS[2].x, CAMPS[2].z, 24, false);
  // the goblin raider camp at the foot of Kelda, east of the river
  tent(scene, 192, -54, 1.2, M.clothRed, 1.1); tent(scene, 210, -70, -0.4, M.cloth); tent(scene, 196, -76, 2.2, M.clothRed);
  station(scene, { type: 'campfire', x: 202, z: -64, rot: 0 }); world.stations.pop();
  crate(scene, 208, -56, 0.3); crate(scene, 209, -57.2, 0.9, 0.6); barrel(scene, 190, -66);
  // Gorgrak's Hold, high on the north face of Kelda: a palisade, a long hut and a throne of bones
  goblinFort(scene, CAMPS[4].x, CAMPS[4].z, 27, true);
  buildSaltmere(scene);
}
// a goblin fort: a ring of sharpened stakes with a gap for the gate, tents, fires, kegs; the Hold also has a long hut and a bone throne
function goblinFort(scene, cx, cz, r, hold) {
  const stake = new THREE.CylinderGeometry(0.02, 0.22, 3.6, 6);
  for (let i = 0; i < 56; i++) { const a = i / 56 * Math.PI * 2; if (Math.abs(Math.sin((a - Math.atan2(VILLAGE.z - cz, VILLAGE.x - cx)) / 2)) < 0.08) continue; // the gate faces the south
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; const m = new THREE.Mesh(stake, M.beam); m.castShadow = true; m.position.set(x, heightAt(x, z) + 1.5, z); m.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); scene.add(m); addCircle(x, z, 0.4); }
  for (let i = 0; i < (hold ? 4 : 6); i++) { const a = i / 6 * 6.28 + 0.7; tent(scene, cx + Math.cos(a) * r * 0.6, cz + Math.sin(a) * r * 0.6, a + 1.6, i % 2 ? M.cloth : M.clothRed, 1.1); }
  for (const [dx, dz] of [[-5, 3], [6, -4]]) { const fg = new THREE.Group(); campfire(fg, scene, cx + dx, cz + dz); placeGroup(fg, cx + dx, cz + dz, 0, scene); addCircle(cx + dx, cz + dz, 0.9); }
  for (let i = 0; i < 6; i++) barrel(scene, cx + 9 + (i % 3) * 0.9, cz + 8 + Math.floor(i / 3) * 0.9); // black powder kegs
  banner(scene, cx - 2, cz - 8, M.clothRed); banner(scene, cx + 8, cz + 1, M.clothRed);
  if (hold) {
    addHouse(scene, cx, cz - 14, 14, 7, 4.2, 'thatch', { cx, cz });
    const x = cx - 10, z = cz - 2, g = new THREE.Group(); bx(5, 1, 4, M.darkStone, 0, 0.5, 0, g); bx(4, 5, 1, M.darkStone, 0, 3, -1.5, g); for (let i = 0; i < 9; i++) { const b = cy(0.12, 0.08, R(1.5, 3), M.bone, -2 + i * 0.5, 5.5 + R(-0.4, 0.4), -1.4, g, 5); b.rotation.z = R(-0.4, 0.4); } placeGroup(g, x, z, Math.atan2(cx - x, cz - z), scene); addBox(x, z, 2.5, 2, 0);
  }
}
// Saltmere: the big free port on the north shore. Stone walls, a great hall, a market, a lighthouse and a harbour with a shipyard.
function buildSaltmere(scene) {
  const cx = PORT.x, cz = PORT.z, WR = 72;
  // walls with three gates: south-west and south-east (the roads) and north (the harbour)
  const gates = [Math.atan2(-365 - cz, -90 - cx), Math.atan2(-370 - cz, 100 - cx), -Math.PI / 2];
  const seg = 44;
  for (let i = 0; i < seg; i++) { const a = (i + 0.5) / seg * Math.PI * 2; if (gates.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.13)) continue;
    const x = cx + Math.cos(a) * WR, z = cz + Math.sin(a) * WR, L = 2 * Math.PI * WR / seg + 0.4; const g = new THREE.Group(); bx(L, 5, 1.6, M.stone, 0, 2.5, 0, g); for (let k = -1; k <= 1; k += 2) bx(0.9, 0.9, 1.7, M.stone, k * L * 0.3, 5.4, 0, g);
    placeGroup(g, x, z, -a + Math.PI / 2, scene, -0.4); addBox(x, z, L / 2, 0.8, -a + Math.PI / 2); }
  for (const g0 of gates) for (const k of [-1, 1]) { const a = g0 + k * 0.16, x = cx + Math.cos(a) * WR, z = cz + Math.sin(a) * WR; const g = new THREE.Group(); cy(2.2, 2.5, 9, M.stone, 0, 4.5, 0, g, 10); for (let i = 0; i < 8; i++) { const b = i / 8 * 6.28; bx(0.9, 0.9, 0.7, M.stone, Math.cos(b) * 2.1, 9.4, Math.sin(b) * 2.1, g, 0, -b, 0); } placeGroup(g, x, z, 0, scene, -0.3); addCircle(x, z, 2.4); banner(scene, x + Math.cos(a) * 0.1, z, M.clothBlue); }
  // the great hall in the middle, houses in two rings, a market square
  addHouse(scene, cx, cz - 18, 16, 10, 6, 'slate', { stoneWalls: true, cx, cz });
  const ring = (n, r, off) => { for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2; if (gates.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.35)) continue; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (Math.hypot(x - cx, z - (cz - 18)) < 14) continue; addHouse(scene, x, z, R(6.5, 9), R(5.5, 7), R(3.4, 4.6), i % 3 === 0 ? 'red' : i % 3 === 1 ? 'slate' : 'thatch', { cx, cz, stoneWalls: i % 2 === 0 }); } };
  ring(10, 34, 0.3); ring(16, 56, 0.1);
  for (let i = 0; i < 4; i++) { const x = cx - 9 + i * 6, z = cz + 14; const g = new THREE.Group(); bx(2.6, 0.9, 1.0, M.plank, 0, 0.45, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(0.06, 0.06, 2.6, M.beam, sx * 1.25, 1.3, sz * 0.6, g, 5); for (let k = 0; k < 5; k++) bx(0.55, 0.04, 1.6, k % 2 ? M.clothBlue : M.cloth, -1.1 + k * 0.55, 2.6, 0.1, g, 0.18, 0, 0); placeGroup(g, x, z, Math.PI, scene); addBox(x, z, 1.35, 0.6, Math.PI); }
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; lampPost(scene, cx + Math.cos(a) * 24, cz + Math.sin(a) * 24); }
  { const fg = new THREE.Group(); campfire(fg, scene, cx + 10, cz + 4); placeGroup(fg, cx + 10, cz + 4, 0, scene); addCircle(cx + 10, cz + 4, 0.9); }
  for (let i = 0; i < 8; i++) { barrel(scene, cx - 20 + (i % 4) * 1.0, cz + 24 + Math.floor(i / 4)); crate(scene, cx + 18 + (i % 4) * 1.1, cz + 24 + Math.floor(i / 4), i * 0.4); }
  // the harbour: a long pier out from the north shore, a shipyard with a ship on the slip, and a lighthouse on the point
  let z0 = cz - 60; while (z0 > cz - 200 && heightAt(cx, z0) > 0.9) z0 -= 1; z0 += 8; const z1 = z0 - 60, pw = 2.4;
  { const g = new THREE.Group(), len = z0 - z1;
    for (let i = 0; i < len / 0.5; i++) { const p = bx(pw * 2, 0.1, 0.45, M.plank, 0, 0, i * 0.5 - len / 2 + 0.25, g); p.rotation.z = (hash2(i, 9) - 0.5) * 0.03; }
    for (let i = 0; i <= len / 4; i++) for (const sx of [-1, 1]) cy(0.15, 0.15, 6, M.beam, sx * pw, -3, i * 4 - len / 2, g, 6);
    placeGroup(g, cx, (z0 + z1) / 2, 0, scene, 0, PIER_Y - 0.05); addSurface(cx, (z0 + z1) / 2, pw, len / 2, 0, PIER_Y); world.portPier = { x: cx, z0, z1 }; }
  { const sx = cx + 26, sz = z0 + 6, g = new THREE.Group(); // a half-built ship on the slipway: keel and ribs
    bx(0.4, 0.5, 16, M.wood, 0, 0.8, 0, g); for (let i = 0; i < 9; i++) { const z = -7 + i * 1.75, w = 2.8 * Math.sin((i + 0.5) / 9 * Math.PI); for (const s2 of [-1, 1]) { const rib = cy(0.12, 0.12, 3.4, M.wood, s2 * w * 0.55, 2.2, z, g, 5); rib.rotation.z = s2 * 0.5; } }
    for (let i = 0; i < 6; i++) bx(0.3, 0.3, 3, M.beam, -2.6, 0.2 + i * 0.32, -10 + i * 0.1, g); placeGroup(g, sx, sz, 0, scene); addBox(sx, sz, 2.5, 8, 0); }
  { const lx = cx - 46, lz = z0 - 4, g = new THREE.Group(); cy(2.4, 3.2, 18, M.stone, 0, 9, 0, g, 12); for (let i = 0; i < 5; i++) bx(5, 0.5, 0.05, M.clothRed, 0, 3 + i * 3.4, 2.9 - i * 0.12, g); cy(1.8, 2.1, 3, M.darkStone, 0, 19.5, 0, g, 10);
    const h0 = Math.max(1, heightAt(lx, lz)); g.position.set(lx, h0, lz); scene.add(g); addCircle(lx, lz, 3.2); fire(scene, lx, h0 + 20, lz, 1.2); }
}
function buildGoblinCamps(scene) {
  const hideM = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.95, side: THREE.DoubleSide });
  const patchM = new THREE.MeshStandardMaterial({ color: '#5a4028', roughness: 0.95, side: THREE.DoubleSide });
  const boneM = M.bone, woodM = M.beam;
  for (const [cx, cz] of GOBLIN_CAMPS) {
    // campfire in the middle
    const fg = new THREE.Group(); campfire(fg, scene, cx, cz); placeGroup(fg, cx, cz, 0, scene); addCircle(cx, cz, 0.9);
    // ragged hide tents around it
    const nT = 3 + (Math.abs(cx) % 2 ? 1 : 0);
    for (let i = 0; i < nT; i++) {
      const a = i / nT * Math.PI * 2 + 0.9, r = 8 + (i % 2) * 1.5, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const g = new THREE.Group();
      const geo = new THREE.ConeGeometry(1.9, 2.4, 6, 1, true); const p = geo.attributes.position; for (let k = 0; k < p.count; k++) if (p.getY(k) < 0) { p.setX(k, p.getX(k) * (0.9 + hash2(k, i) * 0.25)); p.setZ(k, p.getZ(k) * (0.9 + hash2(i, k) * 0.25)); } geo.computeVertexNormals();
      const t = new THREE.Mesh(geo, i % 2 ? hideM : patchM); t.position.y = 1.2; t.castShadow = true; g.add(t);
      for (let k = 0; k < 3; k++) { const pole = cy(0.04, 0.05, 3.2, woodM, Math.cos(k * 2.1) * 0.15, 1.4, Math.sin(k * 2.1) * 0.15, g, 4); pole.rotation.z = (k - 1) * 0.12; }
      bx(1.0, 1.2, 0.05, M.dark, 0, 0.6, 1.55, g, -0.2, 0, 0);
      placeGroup(g, x, z, Math.atan2(cx - x, cz - z), scene); addCircle(x, z, 1.6);
    }
    // skull totem, crates and a bone pile
    { const g = new THREE.Group(); cy(0.1, 0.14, 3.2, woodM, 0, 1.6, 0, g, 6); const sk = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), boneM); sk.position.y = 3.3; g.add(sk); for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 5), boneM); h.position.set(s * 0.22, 3.45, 0); h.rotation.z = -s * 0.8; g.add(h); } const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshStandardMaterial({ color: '#4a6a2a', side: THREE.DoubleSide })); fl.position.set(0.32, 2.5, 0); g.add(fl); placeGroup(g, cx + 4.5, cz - 3, 0, scene); addCircle(cx + 4.5, cz - 3, 0.2); }
    crate(scene, cx - 5, cz + 4, 0.4); crate(scene, cx - 5.6, cz + 4.9, 1.1, 0.6); barrel(scene, cx + 3.5, cz + 5);
    { const g = new THREE.Group(); for (let k = 0; k < 6; k++) { const b = cy(0.04, 0.04, 0.6, boneM, (hash2(k, 3) - 0.5) * 0.8, 0.06, (hash2(3, k) - 0.5) * 0.8, g, 4); b.rotation.set(Math.PI / 2, hash2(k, k) * 3, 0); } placeGroup(g, cx - 3, cz - 4.5, 0, scene); }
  }
}
function banner(scene, x, z, m) { const g = new THREE.Group(); cy(0.06, 0.06, 5, M.beam, 0, 2.5, 0, g, 5); const f = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2, 3, 6), m); f.position.set(0.62, 3.8, 0); g.add(f); world.flags = world.flags || []; world.flags.push(f); placeGroup(g, x, z, 0, scene); g.userData.dynamic = true; addCircle(x, z, 0.2); }

function buildBridges(scene) {
  const crossings = [];
  // find where each road crosses the river
  for (const road of ROADS) for (let i = 0; i < road.length - 1; i++) {
    const [ax, az] = road[i], [bx2, bz] = road[i + 1];
    const steps = Math.ceil(Math.hypot(bx2 - ax, bz - az) / 2);
    let prevIn = null;
    for (let s = 0; s <= steps; s++) {
      const x = ax + (bx2 - ax) * s / steps, z = az + (bz - az) * s / steps;
      const inR = distToLine(x, z, RIVER).d < 3;
      if (inR && !prevIn) crossings.push({ x, z, ang: Math.atan2(bx2 - ax, bz - az) });
      prevIn = inR;
    }
  }
  for (const c of crossings) {
    if (crossings.some(o => o !== c && o.done && Math.hypot(o.x - c.x, o.z - c.z) < 30)) continue;
    c.done = true;
    // span until both ends on land above 1.5 m
    const dx = Math.sin(c.ang), dz = Math.cos(c.ang);
    let a = 4, b = 4;
    while (a < 40 && heightAt(c.x - dx * a, c.z - dz * a) < 2.0) a += 1;
    while (b < 40 && heightAt(c.x + dx * b, c.z + dz * b) < 2.0) b += 1;
    a += 2; b += 2;
    const cx = c.x + dx * (b - a) / 2, cz = c.z + dz * (b - a) / 2, len = a + b;
    const y = Math.max(heightAt(c.x - dx * a, c.z - dz * a), heightAt(c.x + dx * b, c.z + dz * b), 2.4) + 0.25;
    const arch = 1.6;
    const g = new THREE.Group();
    const segs = Math.ceil(len / 0.6), W = 2.4;
    for (let i = 0; i < segs; i++) { const t = (i + 0.5) / segs - 0.5; const yy = arch * (1 - 4 * t * t); const p = bx(W * 2, 0.14, 0.55, M.plank, 0, yy, t * len, g); p.rotation.x = -8 * arch * t / len; }
    for (const sx of [-1, 1]) {
      for (let i = 0; i <= 8; i++) { const t = i / 8 - 0.5; const yy = arch * (1 - 4 * t * t); cy(0.07, 0.07, 1.1, M.beam, sx * W, yy + 0.55, t * len, g, 5); if (i % 4 === 0) cy(0.16, 0.18, 7, M.beam, sx * (W + 0.1), yy - 3, t * len, g, 6); }
      for (let i = 0; i < 8; i++) { const t0 = i / 8 - 0.5, t1 = (i + 1) / 8 - 0.5; const y0 = arch * (1 - 4 * t0 * t0), y1 = arch * (1 - 4 * t1 * t1); const l = Math.hypot(len / 8, y1 - y0); const r = bx(0.1, 0.1, l, M.wood, sx * W, (y0 + y1) / 2 + 1.05, (t0 + t1) / 2 * len, g); r.rotation.x = -Math.atan2(y1 - y0, len / 8); }
    }
    placeGroup(g, cx, cz, c.ang, scene, 0, y);
    addSurface(cx, cz, W, len / 2, c.ang, y + 0.07, arch);
    for (const sx of [-1, 1]) addBox(cx + Math.cos(c.ang) * sx * (W + 0.15), cz - Math.sin(c.ang) * sx * (W + 0.15), 0.1, len / 2 - 2.5, c.ang, 'rail');
    BRIDGES.push({ x: cx, z: cz, ang: c.ang, len, y });
  }
}

function buildLava(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: world.time },
    vertexShader: `varying vec2 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float time; varying vec2 vP; float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){ vec2 p = vP*0.25; float a = n(p + vec2(time*0.05, time*0.03)) * 0.6 + n(p*2.3 - time*0.08) * 0.4; float crust = smoothstep(0.45, 0.6, a);
        vec3 hot = mix(vec3(1.0,0.85,0.3), vec3(1.0,0.35,0.05), a); vec3 col = mix(hot*2.2, vec3(0.12,0.05,0.03), crust*0.85); gl_FragColor = vec4(col,1.0); }`,
  });
  world.lavaPools = [];
  for (const [x, z, r] of LAVA_POOLS) {
    const y = heightAt(x, z) + 1.6;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r + 3, 32).rotateX(-Math.PI / 2), mat); m.position.set(x, y, z); scene.add(m);
    world.lavaPools.push({ x, z, r: r + 1, y });
    fire(scene, x, y + 1, z, 0, true);
  }
}

// ---------- grass ----------
let grass = null, flowers = null, grassCenter = new THREE.Vector2(1e9, 1e9);
const GRASS_R = 40, GSTEP = 0.6;
function buildGrass(scene) {
  const blade = new THREE.PlaneGeometry(0.11, 0.34, 1, 3); blade.translate(0, 0.17, 0); { const bp = blade.attributes.position; for (let i = 0; i < bp.count; i++) if (bp.getY(i) > 0.33) bp.setX(i, 0); }
  const parts = [];
  for (let i = 0; i < 3; i++) { const b = blade.clone(); b.rotateY(i * Math.PI / 3); b.rotateZ((i - 1) * 0.25); parts.push(b); }
  const geo = mergeGeometries(parts); geo.computeVertexNormals();
  const n = Math.ceil(GRASS_R * 2 / GSTEP) ** 2;
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.time = world.time;
    sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float k = position.y * position.y * 0.7;
      transformed.x += sin(time*2.0 + ip.x*0.35 + ip.z*0.2) * k * 0.35;
      transformed.z += cos(time*1.6 + ip.z*0.3) * k * 0.25;`).replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n objectNormal = vec3(0.0,1.0,0.0);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);');
  };
  grass = new THREE.InstancedMesh(geo, mat, n); grass.receiveShadow = true; grass.castShadow = false; grass.frustumCulled = false;
  grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(grass);
  const fgeo = mergeGeometries([new THREE.CylinderGeometry(0.008, 0.008, 0.36, 3).translate(0, 0.18, 0).toNonIndexed(), new THREE.IcosahedronGeometry(0.035, 0).translate(0, 0.37, 0)]);
  flowers = new THREE.InstancedMesh(fgeo, new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.7 }), Math.floor(n / 8)); flowers.frustumCulled = false; scene.add(flowers);
}
const FLOWER = ['#f4e04a', '#e8e8f0', '#c070e0', '#e05a5a', '#5a8af0'];
export function updateGrass(px, pz, enabled) {
  if (!grass) return;
  grass.visible = flowers.visible = enabled;
  if (!enabled) return;
  if (Math.hypot(px - grassCenter.x, pz - grassCenter.y) < 8) return;
  grassCenter.set(px, pz);
  let i = 0, fi = 0;
  const x0 = Math.floor((px - GRASS_R) / GSTEP), z0 = Math.floor((pz - GRASS_R) / GSTEP), cnt = Math.ceil(GRASS_R * 2 / GSTEP);
  const c = new THREE.Color();
  for (let a = 0; a < cnt; a++) for (let b = 0; b < cnt; b++) {
    const gx = x0 + a, gz = z0 + b;
    const hx = hash2(gx, gz), hz = hash2(gz + 99, gx - 7);
    const x = (gx + hx) * GSTEP, z = (gz + hz) * GSTEP;
    const d = Math.hypot(x - px, z - pz); if (d > GRASS_R) continue;
    const h = heightAt(x, z); if (h < 1.8) continue;
    const zn = zoneAt(x, z); if (biomeMasks(x, z).ash > 0.55) continue;
    if (h > 50 + hx * 10 && biomeMasks(x, z).hl > 0.4) continue;
    if (roadDist(x, z) < 2.6) continue;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 20 && hx > 0.4) continue;
    const m = biomeMasks(x, z);
    if (m.forest > 0.5 && hx < 0.35) continue;
    const s = (0.55 + hz * 0.5) * (1 - smooth(GRASS_R * 0.75, GRASS_R, d) * 0.9) * (zn === 'meadow' ? 1.1 : 1);
    _q.setFromEuler(_e.set(0, hx * 6.28, 0)); _s.set(s, s * (0.8 + hx * 0.6), s); _p.set(x, h - 0.05, z); _m.compose(_p, _q, _s);
    grass.setMatrixAt(i, _m);
    const cold = clamp(m.hl * 1.3, 0, 1), dry = clamp(m.dry * (1 - m.hl) + m.ash, 0, 1);
    c.setHSL(lerp(lerp(0.25 + hz * 0.04 - m.forest * 0.02, 0.22, cold), 0.12, dry), lerp(lerp(0.55, 0.3, cold), 0.5, dry), lerp(0.24 - m.forest * 0.06, 0.3, dry) + hx * 0.06);
    grass.setColorAt(i, c); i++;
    if (zn === 'meadow' && hz > 0.9 && fi < flowers.count) { _s.setScalar(0.8 + hx * 0.4); flowers.setMatrixAt(fi, _m.compose(_p, _q, _s)); flowers.setColorAt(fi, c.set(FLOWER[Math.floor(hx * 5)])); fi++; }
    if (i >= grass.count) break;
  }
  grass.count = i; flowers.count = fi;
  grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  flowers.instanceMatrix.needsUpdate = true; if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
}

// ---------- birds ----------
function buildBirds(scene) {
  const bodyG = new THREE.ConeGeometry(0.12, 0.6, 5); bodyG.rotateX(Math.PI / 2);
  const wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.15, 0, 0, 0.18, 0.9, 0, 0.05], 3)); wingG.computeVertexNormals();
  const flocks = [
    { x: 30, z: 360, r: 50, y: 28, n: 7, col: '#f4f4f4', gull: true }, { x: -60, z: 410, r: 70, y: 22, n: 6, col: '#f0f0f0', gull: true },
    { x: 40, z: 220, r: 80, y: 40, n: 9, col: '#3a3030' }, { x: -120, z: 60, r: 90, y: 50, n: 8, col: '#2a2420' },
    { x: -330, z: -160, r: 60, y: 70, n: 8, col: '#3a3a3a' }, { x: -250, z: -320, r: 110, y: 95, n: 5, col: '#5a4a3a', big: true },
    { x: 300, z: -380, r: 90, y: 90, n: 5, col: '#1a1010', big: true }, { x: 150, z: 120, r: 70, y: 45, n: 8, col: '#3a3030' },
  ];
  for (const f of flocks) for (let i = 0; i < f.n; i++) {
    const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: f.col, roughness: 0.9, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(bodyG, m));
    const wl = new THREE.Mesh(wingG, m), wr = new THREE.Mesh(wingG, m); wr.scale.x = -1; g.add(wl); g.add(wr);
    const s = f.big ? 2.4 : f.gull ? 1.2 : 0.9; g.scale.setScalar(s);
    scene.add(g);
    world.birds.push({ g, wl, wr, f, a: R(0, 6.28), r: f.r * R(0.6, 1.1), y: f.y + R(-6, 6), sp: R(0.12, 0.22) * (f.big ? 0.5 : 1), ph: R(0, 6), dir: rng() < 0.5 ? 1 : -1 });
  }
}
export function updateBirds(t, dt) {
  for (const b of world.birds) {
    b.a += b.sp * dt * b.dir;
    const x = b.f.x + Math.cos(b.a) * b.r, z = b.f.z + Math.sin(b.a) * b.r * 0.8;
    const y = Math.max(heightAt(x, z) + 15, b.y + Math.sin(b.a * 3 + b.ph) * 4);
    b.g.position.set(x, y, z);
    const tx = -Math.sin(b.a) * b.dir, tz = Math.cos(b.a) * 0.8 * b.dir;
    b.g.rotation.set(0, Math.atan2(tx, tz), -b.dir * 0.3);
    const glide = Math.sin(t * 0.7 + b.ph) > 0.3;
    const flap = glide ? 0.1 : Math.sin(t * (b.f.big ? 5 : 11) + b.ph) * 0.8;
    b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
  }
}

// ---------- ambient particles (snow, embers, pollen, fireflies) ----------
let amb = null;
function buildAmbient(scene) {
  const n = 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = R(-40, 40); pos[i * 3 + 1] = R(0, 30); pos[i * 3 + 2] = R(-40, 40); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ size: 0.25, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: '#ffffff', blending: THREE.AdditiveBlending });
  amb = new THREE.Points(geo, mat); amb.frustumCulled = false; scene.add(amb);
  amb.userData.vel = new Float32Array(n * 3);
}
export function updateAmbient(dt, px, py, pz, zone, night) {
  if (!amb) return;
  const p = amb.geometry.attributes.position.array, n = p.length / 3, M2 = amb.material;
  let mode = zone === 'highlands' && BATTLE ? 'snow' : zone === 'ashlands' ? 'ember' : (night > 0.5 && (zone === 'wood' || zone === 'meadow' || zone === 'highlands')) ? 'fly' : zone === 'meadow' ? 'pollen' : 'none';
  amb.visible = mode !== 'none';
  if (!amb.visible) return;
  const cfg = { snow: { col: '#ffffff', size: 0.22, vy: -1.6, count: n, blend: THREE.NormalBlending, op: 0.9 }, ember: { col: '#ff7a2a', size: 0.18, vy: 1.2, count: n * 0.6, blend: THREE.AdditiveBlending, op: 1 }, fly: { col: '#d8ff6a', size: 0.25, vy: 0, count: n * 0.12, blend: THREE.AdditiveBlending, op: 1 }, pollen: { col: '#fff8d0', size: 0.08, vy: 0.05, count: n * 0.3, blend: THREE.AdditiveBlending, op: 0.6 } }[mode];
  M2.color.set(cfg.col); M2.size = cfg.size; M2.blending = cfg.blend; M2.opacity = cfg.op;
  amb.geometry.setDrawRange(0, Math.floor(cfg.count));
  amb.position.set(0, 0, 0);
  const t = world.time.value;
  for (let i = 0; i < cfg.count; i++) {
    let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    y += cfg.vy * dt * (0.6 + (i % 7) * 0.1);
    x += Math.sin(t * 0.7 + i) * dt * (mode === 'fly' ? 1.2 : 0.6) + (mode === 'snow' ? dt * 0.8 : 0);
    z += Math.cos(t * 0.5 + i * 1.3) * dt * (mode === 'fly' ? 1.2 : 0.5);
    // wrap around player
    if (x - px > 40) x -= 80; if (px - x > 40) x += 80; if (z - pz > 40) z -= 80; if (pz - z > 40) z += 80;
    if (y < py - 5) y += 30; if (y > py + 25) y -= 30;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
  }
  amb.geometry.attributes.position.needsUpdate = true;
}

// ---------- build all ----------
export function buildWorld(scene) {
  mats();
  const leafMat = windMaterial();
  const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const oreMat = (c) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3, flatShading: true, emissive: c, emissiveIntensity: 0.25 });
  Object.assign(kinds, {
    oakA: { geo: oakGeo(0), mat: leafMat }, oakB: { geo: oakGeo(1), mat: leafMat }, pine: { geo: pineGeo(false), mat: leafMat }, snow: { geo: pineGeo(true), mat: leafMat },
    birch: { geo: birchGeo(), mat: leafMat }, palm: { geo: palmGeo(), mat: leafMat }, dead: { geo: deadGeo(), mat: solidMat },
    rock0: { geo: rockGeo(201), mat: solidMat, shadowDist: 50 }, rock1: { geo: rockGeo(202, '#8e8676'), mat: solidMat, shadowDist: 50 }, rock2: { geo: rockGeo(203, '#7a766e', 1.2), mat: solidMat, shadowDist: 50 },
    rockAsh: { geo: rockGeo(204, '#3a3230'), mat: solidMat, shadowDist: 50 }, rockSnow: { geo: rockGeo(205, '#c8ccd0'), mat: solidMat, shadowDist: 50 },
    copper: { geo: oreGeo(301, '#3fbf8a'), mat: oreMat('#0a3020'), shadowDist: 50 }, iron: { geo: oreGeo(302, '#c87a50'), mat: oreMat('#301508'), shadowDist: 50 },
    mithril: { geo: oreGeo(303, '#8fd8ff'), mat: oreMat('#103850'), shadowDist: 50 }, goldv: { geo: oreGeo(305, '#ffd040'), mat: oreMat('#4a3000'), shadowDist: 50 }, starmetal: { geo: oreGeo(304, '#c890ff'), mat: oreMat('#401860'), shadowDist: 50 },
    cotton: { geo: cottonGeo(), mat: leafMat, shadowDist: 30 }, healroot: { geo: herbGeo(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#1a5a20', emissiveIntensity: 0.6 }), shadowDist: 20, noShadow: true },
    bush: { geo: bushGeo(), mat: leafMat, shadowDist: 40 },
  });
  if (YARD) buildYard(scene);
  if (ARENA) buildRuins(scene); // the arena is fought in the Ruins of Aldermere
  if (GI) { buildPier(scene); buildGoblinIsle(scene, { M, bx, cy, placeGroup, tent, banner, campfire, barrel, crate, fire, addHouse, lampPost }); } // the campaign: Goblin Island
  else if (!BATTLE && !YARD && !ARENA) { buildVillage(scene); buildCamps(scene); buildBridges(scene); buildLava(scene); buildGoblinCamps(scene); }
  mergeStatics(scene);
  scatter();
  buildChunks(scene);
  if (!ARENA) buildGrass(scene); // (the arena floor is sand)
  buildBirds(scene);
  buildAmbient(scene);
  return world;
}
export { kinds as nodeKinds };
