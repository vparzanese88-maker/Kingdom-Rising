// Kingdom Arena: the Ruins of Aldermere. A ruined fantasy town, 116 x 196 m, with two team bases (south and north) and
// three ways to the centre plaza: the left rampart (a high stone walkway with a watchtower, and a lower outer path
// beneath it), the middle street (tall three-storey houses either side, with balconies, roof terraces and a timber
// bridge across the street) and the right garden (through a chapel you can walk into, with a gallery upstairs and a
// garden terrace). Bridges join the rooftops to the rampart and the chapel. Stairs everywhere, broken arches, columns,
// statues, rubble, crates, banners, vines, torches, an ancient glowing tree in the middle. Side spawn rooms (east and
// west) for 3- and 4-team games. The north half is the south half mirrored, so both teams get exactly the same map.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addBox, addSurface, addCircle, world } from './world.js';
import { AR, COLORS } from './arenamap.js';
import { makeKit, kitMat, glowify, buildGround, bakeVerts, heartwood, motes, backdrop, plantMeshy, ruinsLook, tufts } from './ruinsart.js';
import { G as GS } from './state.js';

const Y = 3; // ground level
const S = (c, r = 0.9, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
let M = null, root = null, KIT = null;
let rnd = Math.random; // seeded per half, so both halves get the same "random" scatter
function seed(s) { rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const geoBuckets = new Map(); // material -> geometries, merged at the end into one mesh each
function put(geo, mat, x, y, z, ry = 0, rx = 0, sh = true) { const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  let g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.applyMatrix4(m4); const tile = mat.userData.tile; if (tile) worldUV(g, tile);
  const k = mat.uuid + (sh ? 's' : ''); if (!geoBuckets.has(k)) geoBuckets.set(k, { mat, sh, list: [] }); geoBuckets.get(k).list.push(g); }
// texture coordinates in metres from where each face sits in the world (so a long wall and a small block show the same stone size)
function worldUV(g, tile) { const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; for (let i = 0; i < P.count; i++) { const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i)), x = P.getX(i), y = P.getY(i), z = P.getZ(i);
  if (ay >= ax && ay >= az) U.setXY(i, x / tile, z / tile); else if (ax >= az) U.setXY(i, z / tile, y / tile); else U.setXY(i, x / tile, y / tile); } }
const seg = (v, s = 4) => Math.min(24, Math.max(1, Math.ceil(v / s))); // (big boxes are cut up, so the baked shade and firelight have vertices to sit on)
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d, seg(w), seg(h, 2.6), seg(d));
const LIGHTS = []; // baked light sources: { x, y, z, r, k, c: [r, g, b] }
const FIRE = [1, 0.5, 0.18], TREES = [], ROCKS = [];
const CYL = (r1, r2, h, n = 10) => new THREE.CylinderGeometry(r1, r2, h, n);

// ---- the level kit ----
// a solid block you cannot walk through, whose top you can stand on
function block(x, z, w, d, y0, h, mat = M.stone, top = M.moss, walk = true) {
  put(BOX(w, h, d), mat, x, y0 + h / 2, z); if (top) put(BOX(w + 0.08, 0.12, d + 0.08), top, x, y0 + h + 0.06, z, 0, 0, false);
  addBox(x, z, w / 2, d / 2, 0, 'map', y0, y0 + h); if (walk) addSurface(x, z, w / 2, d / 2, 0, y0 + h); }
// a wall you can neither climb nor walk through
function wall(x, z, w, d, y0, h, mat = M.stone) { put(BOX(w, h, d), mat, x, y0 + h / 2, z); addBox(x, z, w / 2, d / 2, 0, 'map', y0, y0 + h + 50); }
// a turned box (solid between y0 and y0+h, so you can walk on top of a low one or under a high one)
function rb(x, z, w, h, d, y0, ry, mat, solid = true, sh = true) { put(BOX(w, h, d), mat, x, y0 + h / 2, z, ry, 0, sh); if (solid) addBox(x, z, w / 2, d / 2, ry, 'map', y0, y0 + h); }
// stairs (or a ramp) from (x1,z1,y1) to (x2,z2,y2), w wide; solid underneath the high end; a plinth of masonry under raised stairs
function stairs(x1, z1, y1, x2, z2, y2, w, mat = M.stone2, steps = true, plinth = true, kerb = true) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), rot = Math.atan2(dx, dz), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, lo = Math.min(y1, y2), dy = Math.abs(y2 - y1);
  addSurface(cx, cz, w / 2, len / 2, rot, y1, 0, y2);
  const n = steps ? Math.max(3, Math.round(dy / 0.25)) : 1;
  if (steps) for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, yt = y1 + (y2 - y1) * (y2 > y1 ? t1 : t0), h = Math.max(0.05, yt - lo), seg = len / n; put(BOX(w, h, seg + 0.02), mat, x1 + dx * (t0 + t1) / 2, lo + h / 2, z1 + dz * (t0 + t1) / 2, rot); }
  else { const g = BOX(w, 0.3, len); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = (p.getZ(i) / len + 0.5); p.setY(i, p.getY(i) + (y1 + (y2 - y1) * t) - lo); } g.computeVertexNormals(); put(g, mat, cx, lo, cz, rot); }
  for (let i = 0; i < 4; i++) { const ta = i / 4, tb = (i + 1) / 4, hy = lo + dy * (y2 > y1 ? ta : 1 - tb); if (hy - lo < 0.9) continue; // (each quarter is solid up to its lowest step)
    addBox(x1 + dx * (ta + tb) / 2, z1 + dz * (ta + tb) / 2, w / 2, len / 8, rot, 'map', lo, hy); }
  if (plinth && lo > Y + 0.2) { put(BOX(w, lo - Y + 0.1, len), M.stoneD, cx, Y + (lo - Y) / 2 - 0.05, cz, rot); addBox(cx, cz, w / 2, len / 2, rot, 'map', Y - 1, lo); }
  if (kerb) for (const s of [-1, 1]) put(BOX(0.25, 0.5, len), M.stone, cx + Math.cos(rot) * s * (w / 2 + 0.12), (y1 + y2) / 2 + 0.25, cz - Math.sin(rot) * s * (w / 2 + 0.12), rot, -Math.atan2(y2 - y1, len), false); // low side kerbs
}
// railings along a line at height y (stop you walking off), with balusters
function rail(x1, z1, x2, z2, y, mat = M.timber, h = 1.0, yb = y) { const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), rot = Math.atan2(dx, dz), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, dy = yb - y, L = Math.hypot(len, dy), rx = -Math.atan2(dy, len), ym = (y + yb) / 2;
  put(BOX(0.14, 0.12, L), mat, cx, ym + h, cz, rot, rx, false); put(BOX(0.1, 0.1, L), mat, cx, ym + h * 0.45, cz, rot, rx, false);
  for (let i = 0; i < 4; i++) { const ya = y + dy * i / 4, yc = y + dy * (i + 1) / 4; addBox(x1 + dx * (i + 0.5) / 4, z1 + dz * (i + 0.5) / 4, 0.1, len / 8, rot, 'map', Math.min(ya, yc), Math.max(ya, yc) + h); }
  const n = Math.max(1, Math.round(len / 1.1)); for (let i = 0; i <= n; i++) { const t = i / n; put(BOX(0.1, h, 0.1), mat, x1 + dx * t, y + dy * t + h / 2, z1 + dz * t, rot, 0, false); } }
function lantern(x, y, z) { LIGHTS.push({ x, y, z, r: 5, k: 0.5, c: [1, 0.62, 0.28] }); put(BOX(0.22, 0.34, 0.22), M.iron, x, y, z, 0, 0, false); put(new THREE.SphereGeometry(0.13, 8, 6), M.lamp, x, y, z, 0, 0, false); put(new THREE.ConeGeometry(0.2, 0.2, 4), M.iron, x, y + 0.27, z, Math.PI / 4, 0, false); }
// a torch on a wall: bracket and flame (ry: the way it faces out of the wall)
function torch(x, y, z, ry = 0) { LIGHTS.push({ x: x + Math.sin(ry) * 0.3, y: y + 0.4, z: z + Math.cos(ry) * 0.3, r: 6.5, k: 0.75, c: FIRE }); put(BOX(0.12, 0.12, 0.5), M.iron, x - Math.sin(ry) * 0.2, y - 0.15, z - Math.cos(ry) * 0.2, ry, 0.5, false); put(CYL(0.09, 0.06, 0.45, 6), M.timber, x, y, z, 0, 0, false);
  put(new THREE.ConeGeometry(0.17, 0.55, 7), M.flame, x, y + 0.45, z, 0, 0, false); put(new THREE.ConeGeometry(0.09, 0.32, 6), M.flameCore, x, y + 0.38, z, 0, 0, false); }
// a fire bowl on a stand
function brazier(x, z, y = Y, s = 1) { LIGHTS.push({ x, y: y + 1.9 * s, z, r: 10 * s, k: 1.0, c: FIRE }); world.fires.push({ pos: new THREE.Vector3(x, y + 1.55 * s, z), size: 0.45 * s, light: true }); put(CYL(0.12 * s, 0.3 * s, 1.1 * s, 8), M.iron, x, y + 0.55 * s, z); put(CYL(0.55 * s, 0.3 * s, 0.4 * s, 10), M.iron, x, y + 1.25 * s, z);
  put(new THREE.ConeGeometry(0.45 * s, 1.0 * s, 8), M.flame, x, y + 1.85 * s, z, 0, 0, false); put(new THREE.ConeGeometry(0.25 * s, 0.6 * s, 7), M.flameCore, x, y + 1.7 * s, z, 0, 0, false); addBox(x, z, 0.4 * s, 0.4 * s, 0, 'map', y, y + 1.5 * s); }
function crystal(x, y, z, s = 1, mat = M.crystal) { LIGHTS.push({ x, y: y + 0.8 * s, z, r: 5 * s, k: 0.6, c: mat === M.crystalR ? [1, 0.3, 0.25] : mat === M.crystalG ? [1, 0.75, 0.3] : [0.3, 0.7, 1] }); for (let k = 0; k < 4; k++) { const g = new THREE.OctahedronGeometry(0.35 * s * (1 - k * 0.15), 0); g.scale(0.6, 2.2, 0.6); put(g, mat, x + Math.sin(k * 2.3) * 0.35 * s, y + 0.6 * s * (1 - k * 0.1), z + Math.cos(k * 2.3) * 0.35 * s, k, (k - 1.5) * 0.25, false); } }
function tree(x, z, s = 1, glow = false, y = Y) { if (!glow) TREES.push([x, y, z, 7.2 * s, x * 1.7 + z]); put(CYL(0.25 * s, 0.45 * s, 4 * s, 7), glow ? M.bark : M.barkT, x, y + 2 * s, z); if (y <= Y + 0.1) addCircle(x, z, 0.5 * s); else addBox(x, z, 0.4 * s, 0.4 * s, 0, 'map', y, y + 4 * s);
  for (let k = 0; k < 6; k++) { const a = k * 1.3 + x, c = new THREE.IcosahedronGeometry((1.3 + (k % 2) * 0.45) * s, 1); put(c, glow ? M.leafGlow : (k % 3 ? M.leafT : M.leafTD), x + Math.sin(a) * 1.0 * s, y + (4.0 + (k % 3) * 0.65) * s, z + Math.cos(a) * 1.0 * s, a, 0, true); } }
function bush(x, z, s = 1, y = Y) { for (let k = 0; k < 3; k++) { const g = new THREE.IcosahedronGeometry(0.55 * s * (1 - k * 0.15), 0); g.scale(1.2, 0.8, 1.1); put(g, k ? M.leaf : M.leafD, x + Math.sin(k * 2.1 + x) * 0.45 * s, y + 0.35 * s, z + Math.cos(k * 2.1 + z) * 0.45 * s, k + x, 0, false); } }
function rock(x, z, s = 1, y = Y) { ROCKS.push([x, y, z, s * 1.25, x * 1.7]); const g = new THREE.DodecahedronGeometry(s, 0); g.scale(1.2, 0.7, 1); put(g, M.rockT, x, y + 0.3 * s, z, x * 1.7); if (s > 0.45) addCircle(x, z, s * 0.9); }
// hanging ivy down a wall face (x,z just in front of the face, ry the way the face looks)
function vine(x, z, y0, h, ry, w = 1.4) { let y = y0; const n = 3 + Math.floor(rnd() * 3); for (let i = 0; i < n && y > Y + 0.3; i++) { const ww = w * (1 - i * 0.18) * (0.7 + rnd() * 0.5), hh = h / n * (0.8 + rnd() * 0.5), off = (rnd() - 0.5) * w * 0.4;
  const g = new THREE.PlaneGeometry(ww * 1.25, hh * 1.2), fw = 0.06 + i * 0.03; put(g, i % 2 ? M.ivy : M.ivyD, x + Math.cos(ry) * off + Math.sin(ry) * fw, y - hh / 2, z - Math.sin(ry) * off + Math.cos(ry) * fw, ry, 0, false); y -= hh * 0.85; } }
// scattered stones and broken masonry
function rubble(x, z, n = 6, spread = 1.6, y = Y) { for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = rnd() * spread, s = 0.15 + rnd() * 0.3, g = i % 3 ? new THREE.DodecahedronGeometry(s, 0) : BOX(s * 2.2, s * 1.2, s * 1.6);
  put(g, i % 3 ? M.rock : M.stone, x + Math.cos(a) * r, y + s * 0.5, z + Math.sin(a) * r, a, (rnd() - 0.5) * 0.6, false); } }
// a crate you can climb on (and hide behind)
function crate(x, z, s = 1.2, y = Y, ry = 0) { put(BOX(s, s, s), M.crate, x, y + s / 2, z, ry); for (const yy of [0.12, s - 0.12]) put(BOX(s + 0.04, 0.1, s + 0.04), M.timber, x, y + yy, z, ry, 0, false);
  put(BOX(0.1, s * 1.3, s + 0.03), M.timber, x, y + s / 2, z, ry + Math.PI / 2, 0.8, false); addBox(x, z, s / 2, s / 2, ry, 'map', y, y + s); addSurface(x, z, s / 2, s / 2, ry, y + s); }
function barrel(x, z, y = Y) { put(CYL(0.42, 0.42, 1.05, 10), M.crate, x, y + 0.52, z); for (const yy of [0.2, 0.85]) put(CYL(0.44, 0.44, 0.07, 10), M.iron, x, y + yy, z, 0, 0, false); addBox(x, z, 0.4, 0.4, 0, 'map', y, y + 1.05); }
function cache(x, z, y = Y, k = 0) { crate(x, z, 1.2, y, 0.2 * k); crate(x + 1.35, z + 0.2, 1.0, y, -0.15); if (k % 2 === 0) crate(x + 0.1, z, 0.9, y + 1.2, 0.5); barrel(x - 1.1, z + 0.9, y); barrel(x + 0.6, z + 1.25, y); }
// a column: base, shaft, capital; a broken one is short with a jagged top and a fallen drum beside it
function column(x, z, h = 6.5, y = Y, broken = false, mat = M.marble, ground = true) {
  put(BOX(1.5, 0.45, 1.5), M.stone, x, y + 0.22, z); const sh = broken ? h * (0.3 + rnd() * 0.25) : h;
  put(CYL(0.5, 0.6, sh, 12), mat, x, y + 0.45 + sh / 2, z);
  if (!broken) { put(BOX(1.4, 0.5, 1.4), mat, x, y + 0.45 + sh + 0.25, z); put(CYL(0.62, 0.5, 0.3, 12), mat, x, y + 0.45 + sh + 0.0, z, 0, 0, false); }
  else { put(new THREE.ConeGeometry(0.5, 0.6, 6), mat, x + 0.15, y + 0.45 + sh + 0.2, z, 0, 0.4, false); const a = rnd() * 6.28; put(CYL(0.5, 0.5, 1.4, 12), mat, x + Math.cos(a) * 2.0, y + 0.5, z + Math.sin(a) * 2.0, a, Math.PI / 2); rubble(x, z, 4, 1.8, y); }
  if (ground) addCircle(x, z, 0.72); else addBox(x, z, 0.72, 0.72, 0, 'map', y, y + sh + 1); return y + 0.45 + sh + (broken ? 0 : 0.5); }
// a statue of an old hero on a plinth
function statue(x, z, ry, y = Y, mat = M.bronze) { put(BOX(2.0, 1.6, 2.0), M.stone, x, y + 0.8, z, ry); put(BOX(2.3, 0.25, 2.3), M.stone2, x, y + 1.7, z, ry, 0, false);
  const at = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)], b = y + 1.82;
  for (const s of [-1, 1]) { const [lx, lz] = at(s * 0.22, 0); put(CYL(0.13, 0.11, 1.2, 7), mat, lx, b + 0.6, lz); }
  { const [cx, cz] = at(0, 0); put(CYL(0.36, 0.26, 1.2, 8), mat, cx, b + 1.75, cz); put(new THREE.SphereGeometry(0.24, 10, 8), mat, cx, b + 2.6, cz); put(new THREE.ConeGeometry(0.55, 1.3, 8), mat, cx, b + 1.35, cz, 0, 0, false); }
  { const [ax, az] = at(0.55, 0.1); put(CYL(0.08, 0.08, 1.0, 6), mat, ax, b + 2.45, az, ry, 0, false); put(BOX(0.12, 1.9, 0.05), mat, ax, b + 3.6, az, ry, 0, false); put(BOX(0.5, 0.08, 0.12), mat, ax, b + 2.95, az, ry, 0, false); } // sword raised
  { const [sx, sz] = at(-0.5, 0.15); put(CYL(0.45, 0.45, 0.1, 10), mat, sx, b + 1.9, sz, ry + Math.PI / 2, Math.PI / 2, false); } // shield
  addBox(x, z, 1.0, 1.0, ry, 'map', y, y + 5.5); }
// a banner in a team's colour (team -1: the town's gold), hung from an iron bar
function banner(x, y, z, ry, team, w = 1.4, h = 2.6) { const g = new THREE.PlaneGeometry(w, h, 1, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setX(i, p.getX(i) * 0.82); // (a swallowtail-ish taper)
  put(g, team < 0 ? M.gold : M.team[team % M.team.length], x, y, z, ry, 0, false); put(BOX(w + 0.3, 0.1, 0.1), M.iron, x, y + h / 2 + 0.05, z, ry, 0, false);
  put(BOX(w * 0.5, 0.5, 0.02), M.emblem, x + Math.sin(ry) * 0.02, y + h * 0.12, z + Math.cos(ry) * 0.02, ry, 0, false); }
function awning(x, z, w, d, y, ry, team) { for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) { const px = x + lx * Math.cos(ry) + lz * Math.sin(ry), pz = z - lx * Math.sin(ry) + lz * Math.cos(ry); put(CYL(0.08, 0.08, y + (lz > 0 ? 0 : 0.6), 6), M.timber, px, Y + (y + (lz > 0 ? 0 : 0.6)) / 2, pz); addCircle(px, pz, 0.12); }
  put(BOX(w + 0.4, 0.05, d + 0.5), team < 0 ? M.cloth : M.team[team % M.team.length], x, Y + y + 0.3, z, ry, -0.13, false);
  put(BOX(w - 0.2, 0.9, d - 0.4), M.timber, x, Y + 0.45, z, ry); addBox(x, z, (w - 0.2) / 2, (d - 0.4) / 2, ry, 'map', Y, Y + 0.9); addSurface(x, z, (w - 0.2) / 2, (d - 0.4) / 2, ry, Y + 0.9);
  for (let i = 0; i < 3; i++) put(new THREE.SphereGeometry(0.22, 6, 5), i % 2 ? M.fruit : M.fruit2, x + (i - 1) * 0.6 * Math.cos(ry), Y + 1.05, z - (i - 1) * 0.6 * Math.sin(ry), 0, 0, false); }
// a string of pennants across a street, sagging between two points (with a lantern in the middle)
function bunting(x1, y1, z1, x2, y2, z2, team, lamp = true) { const n = 16, P = (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - Math.sin(Math.PI * t) * 1.3, z1 + (z2 - z1) * t], ry = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
  for (let i = 0; i < n; i++) { const a = P(i / n), b = P((i + 1) / n), L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); put(BOX(0.04, 0.04, L), M.timber, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, ry - Math.PI / 2, -Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])), false);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.32, 0, 0, 0.32, 0, 0, 0, -0.75, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0.2, 0.9, 0.8, 0.9, 0.5, 0.3], 2)); g.computeVertexNormals(); const m = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2; put(g, i % 2 ? M.gold : M.team[team % M.team.length], m, my, mz, ry, 0, false); }
  if (lamp) { const c = P(0.5); lantern(c[0], c[1] - 0.4, c[2]); } }
function cart(x, z, ry) { const at = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  rb(x, z, 1.8, 0.7, 3.2, Y + 0.7, ry, M.crate); addSurface(x, z, 0.9, 1.6, ry, Y + 1.4); for (const [lx, lz] of [[-1.0, -0.9], [1.0, -0.9], [-1.0, 0.9], [1.0, 0.9]]) { const [wx, wz] = at(lx, lz); put(CYL(0.6, 0.6, 0.14, 12), M.timber, wx, Y + 0.6, wz, ry + Math.PI / 2, Math.PI / 2); }
  { const [hx, hz] = at(0, 2.4); put(BOX(0.12, 0.12, 2.0), M.timber, hx, Y + 0.75, hz, ry, 0.25, false); } { const [sx, sz] = at(0.2, -0.3); put(CYL(0.5, 0.5, 1.0, 10), M.hay, sx, Y + 1.9, sz, ry, Math.PI / 2, false); } }
function well(x, z) { put(CYL(1.2, 1.3, 1.0, 14), M.stone, x, Y + 0.5, z); put(CYL(0.95, 0.95, 0.05, 14), M.water, x, Y + 0.85, z, 0, 0, false); addCircle(x, z, 1.3);
  for (const s of [-1, 1]) put(BOX(0.16, 2.6, 0.16), M.timber, x + s * 1.05, Y + 1.8, z, 0, 0, false); put(BOX(2.4, 0.14, 0.14), M.timber, x, Y + 2.9, z, 0, 0, false); put(new THREE.ConeGeometry(1.8, 1.0, 4), M.roof, x, Y + 3.5, z, Math.PI / 4); }
// a hollow pyramid roof (4-sided), w x d
function pyramid(x, y, z, w, d, h, ry = 0, mat = M.roof) { const rg = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); rg.rotateY(Math.PI / 4); rg.scale(w + 0.6, h, d + 0.6); put(rg, mat, x, y + h / 2, z, ry); }

// a three-storey timber-framed town house you can walk through: doors and open windows on the ground floor, stairs inside
// up to the first floor, a front balcony with outside stairs up to it, and (if flat-roofed) outside stairs on to a roof
// terrace with a parapet. local front is +z; fx = -1 mirrors it (so the map's two halves are mirror images)
function house(x, z, w, d, ry, o = {}) {
  const fx = o.fx || 1, cos = Math.cos(ry), sin = Math.sin(ry), t = 0.4, H1 = 3.6, F1 = Y + 3.9, H2 = 3.2, RF = F1 + H2 + 0.3, loggia = o.upper === 'loggia', wm = o.wall || M.plaster;
  const at = (lx, lz) => [x + fx * lx * cos + lz * sin, z - fx * lx * sin + lz * cos];
  const lb = (lx, lz, sx, sy, sz, y0, mat, solid = true, sh = true) => { const [wx, wz] = at(lx, lz); put(BOX(sx, sy, sz), mat, wx, y0 + sy / 2, wz, ry, 0, sh); if (solid) addBox(wx, wz, sx / 2, sz / 2, ry, 'map', y0, y0 + sy); };
  const ls = (lx, lz, hw, hd, y) => { const [wx, wz] = at(lx, lz); addSurface(wx, wz, hw, hd, ry, y); };
  // a wall line with holes (doors: b 0; windows: a sill); alongX: runs along local x at lz = fixed
  const wl = (alongX, fixed, a0, a1, y0, h, mat, holes = [], th = t) => { let c = a0; const piece = (p0, p1, b, tp) => { if (p1 - p0 < 0.05 || tp - b < 0.05) return; const m = (p0 + p1) / 2, L = p1 - p0; if (alongX) lb(m, fixed, L, tp - b, th, y0 + b, mat); else lb(fixed, m, th, tp - b, L, y0 + b, mat); };
    for (const hl of holes.slice().sort((a, b) => a.c - b.c)) { const b = hl.b || 0; piece(c, hl.c - hl.w / 2, 0, h); piece(hl.c - hl.w / 2, hl.c + hl.w / 2, 0, b); piece(hl.c - hl.w / 2, hl.c + hl.w / 2, hl.t, h); c = hl.c + hl.w / 2;
      if (hl.t < h) { if (alongX) lb(hl.c, fixed, hl.w + 0.3, 0.18, th + 0.12, y0 + hl.t, M.timber, false, false); else lb(fixed, hl.c, th + 0.12, 0.18, hl.w + 0.3, y0 + hl.t, M.timber, false, false); }
      if (b > 0) { if (alongX) lb(hl.c, fixed, hl.w + 0.2, 0.1, th + 0.25, y0 + b - 0.1, M.timber, false, false); else lb(fixed, hl.c, th + 0.25, 0.1, hl.w + 0.2, y0 + b - 0.1, M.timber, false, false);
        if (hl.flowers) { const off = Math.sign(fixed) * (th / 2 + 0.2); if (alongX) lb(hl.c, fixed + off, hl.w, 0.3, 0.3, y0 + b - 0.3, M.leaf, false, false); else lb(fixed + off, hl.c, 0.3, 0.3, hl.w, y0 + b - 0.3, M.leaf, false, false); } } }
    piece(c, a1, 0, h); };
  const door = (c, wd = 2.0) => ({ c, w: wd, b: 0, t: 2.7 }), win = (c, fl) => ({ c, w: 1.2, b: 1.0, t: 2.4, flowers: fl });
  const sBot = d / 2 - 2.5, sTop = -d / 2 + 3.0, sHole = sBot - 0.45 * (sBot - sTop), dX = o.doorX || 0.5;
  // ground floor
  wl(true, d / 2, -w / 2 - t / 2, w / 2 + t / 2, Y, H1, wm, [door(dX, o.doorW), ...[-w / 3, w / 3].filter(c => Math.abs(c - dX) > 2).map(c => win(c))]);
  wl(true, -d / 2, -w / 2 - t / 2, w / 2 + t / 2, Y, H1, wm, o.back ? [door(dX, o.doorW), ...[-w / 3, w / 3].filter(c => Math.abs(c - dX) > 2).map(c => win(c))] : [win(-w / 4), win(w / 4)]);
  for (const sx of [-1, 1]) wl(false, sx * w / 2, -d / 2 + t / 2, d / 2 - t / 2, Y, H1, wm, [win(-d / 4), win(d / 4)]);
  // timber framing: corner posts, a beam under the first floor, a plinth course
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) lb(lx, lz, 0.5, loggia ? H1 : RF - Y - 0.3, 0.5, Y, M.timber, false);
  for (const sz of [-1, 1]) { lb(0, sz * (d / 2 + 0.03), w + 0.2, 0.28, t + 0.1, Y + H1 - 0.28, M.timber, false, false); lb(0, sz * (d / 2 + 0.03), w + 0.2, 0.4, t + 0.16, Y, M.stoneD, false, false); }
  for (const sx of [-1, 1]) { lb(sx * (w / 2 + 0.03), 0, t + 0.1, 0.28, d + 0.2, Y + H1 - 0.28, M.timber, false, false); lb(sx * (w / 2 + 0.03), 0, t + 0.16, 0.4, d + 0.2, Y, M.stoneD, false, false); }
  // the first floor: a slab with a stairwell along the -x wall, and the stairs up to it
  const slab = (lx, lz, sx, sz) => { lb(lx, lz, sx, 0.3, sz, F1 - 0.3, M.floor); ls(lx, lz, sx / 2, sz / 2, F1); };
  slab(1, 0, w - 2 + 0.2, d + 0.2); slab(-w / 2 + 1 - 0.05, (-d / 2 - 0.1 + sTop) / 2, 2.1, sTop + d / 2 + 0.1); slab(-w / 2 + 1 - 0.05, (sHole + d / 2 + 0.1) / 2, 2.1, d / 2 + 0.1 - sHole);
  { const [ax, az] = at(-w / 2 + 1.05, sBot), [bx, bz] = at(-w / 2 + 1.05, sTop); stairs(ax, az, Y, bx, bz, F1, 1.7, M.timber, true, false, false); }
  lb(-w / 2 + 2.05, (sTop + sHole) / 2, 0.1, 1.0, sHole - sTop, F1, M.timber, true, false); // (a rail round the stairwell)
  // upstairs
  const upDoors = o.upDoors || []; // [{ side: ±1 (local x side), lz }]
  if (loggia) { // an open gallery: parapets with gaps, posts, a pitched roof
    for (const sz of [-1, 1]) wl(true, sz * d / 2, -w / 2 - t / 2, w / 2 + t / 2, F1, 1.0, wm, []);
    for (const sx of [-1, 1]) wl(false, sx * w / 2, -d / 2 + t / 2, d / 2 - t / 2, F1, 1.0, wm, upDoors.filter(u => u.side === sx).map(u => ({ c: u.lz, w: 2.6, b: 0, t: 1.0 })));
    const nx = Math.max(2, Math.round(w / 3.5)), nz = Math.max(2, Math.round(d / 3.5));
    for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) lb(-w / 2 + w * i / nx, sz * d / 2, 0.45, H2, 0.45, F1, M.timber);
    for (let i = 1; i < nz; i++) for (const sx of [-1, 1]) if (!upDoors.some(u => u.side === sx && Math.abs(u.lz - (-d / 2 + d * i / nz)) < 1.6)) lb(sx * w / 2, -d / 2 + d * i / nz, 0.45, H2, 0.45, F1, M.timber);
    for (const sz of [-1, 1]) lb(0, sz * d / 2, w + 0.5, 0.35, 0.5, F1 + H2 - 0.35, M.timber, false); for (const sx of [-1, 1]) lb(sx * w / 2, 0, 0.5, 0.35, d + 0.5, F1 + H2 - 0.35, M.timber, false);
    const [cx, cz] = at(0, 0); pyramid(cx, F1 + H2, cz, w, d, o.roofH || 3.2, ry); addBox(cx, cz, w / 2 + 0.3, d / 2 + 0.3, ry, 'map', F1 + H2, F1 + H2 + (o.roofH || 3.2));
  } else {
    wl(true, d / 2, -w / 2 - t / 2, w / 2 + t / 2, F1, H2, wm, o.balcony !== false ? [door(0, 1.8), win(-w / 3, true), win(w / 3, true)] : [win(-w / 4, true), win(w / 4, true)]);
    wl(true, -d / 2, -w / 2 - t / 2, w / 2 + t / 2, F1, H2, wm, [win(-w / 4), win(w / 4)]);
    for (const sx of [-1, 1]) wl(false, sx * w / 2, -d / 2 + t / 2, d / 2 - t / 2, F1, H2, wm, [...upDoors.filter(u => u.side === sx).map(u => door(u.lz, 1.8)), ...[-d / 4, d / 4].filter(c => !upDoors.some(u => u.side === sx && Math.abs(u.lz - c) < 2.2)).map(c => win(c))]);
    for (const sz of [-1, 1]) { lb(0, sz * (d / 2 + 0.03), w + 0.2, 0.25, t + 0.1, F1 + 1.4, M.timber, false, false); for (const lx of [-w / 6, w / 6]) lb(lx, sz * (d / 2 + 0.03), 0.22, H2, t + 0.1, F1, M.timber, false, false); }
    if (o.roof === 'pitched') { const [cx, cz] = at(0, 0); lb(0, 0, w + 0.4, 0.3, d + 0.4, F1 + H2, M.timber); pyramid(cx, F1 + H2 + 0.3, cz, w, d, o.roofH || 3.0, ry); addBox(cx, cz, w / 2 + 0.3, d / 2 + 0.3, ry, 'map', F1 + H2, F1 + H2 + 3); }
    else { // a flat roof terrace with a crenellated parapet; a gap at the back (for a bridge) and at the corner where the roof stairs arrive
      lb(0, 0, w + 0.5, 0.3, d + 0.5, RF - 0.3, M.stone2); ls(0, 0, w / 2 + 0.25, d / 2 + 0.25, RF);
      const pz = d / 2 + 0.07, px = w / 2 + 0.07, gapB = o.roofGap ? [{ c: 0, w: 2.8, b: 0, t: 1 }] : [];
      wl(true, pz, -px, px, RF, 1.0, M.stone, [], 0.35); wl(true, -pz, -px, px, RF, 1.0, M.stone, gapB, 0.35);
      wl(false, px, -pz, pz, RF, 1.0, M.stone, [], 0.35); wl(false, -px, -pz, pz, RF, 1.0, M.stone, [{ c: -d / 2 + 1.3, w: 1.8, b: 0, t: 1 }], 0.35);
      for (let i = 0; i < Math.round(w / 1.6); i++) for (const sz of [-1, 1]) { const lx = -w / 2 + 0.6 + i * 1.6; if (sz < 0 && o.roofGap && Math.abs(lx) < 1.6) continue; lb(lx, sz * pz, 0.6, 0.5, 0.45, RF + 1.0, M.stone, false, false); }
      { const [cx, cz] = at(w / 4, -d / 4); put(BOX(1.0, 2.2, 1.0), M.stoneD, cx, RF + 1.1, cz, ry); addBox(cx, cz, 0.5, 0.5, ry, 'map', RF, RF + 2.2); put(BOX(1.2, 0.2, 1.2), M.stone, cx, RF + 2.3, cz, ry, 0, false); } // a chimney
      // outside stairs from the balcony to the roof, along the -x side
      if (o.balcony !== false) { const [ax, az] = at(-(w / 2 + 0.9), d / 2 - 0.1), [bx, bz] = at(-(w / 2 + 0.9), -d / 2 + 1.9); stairs(ax, az, F1, bx, bz, RF, 1.6, M.timber, true, false, false);
        lb(-(w / 2 + 0.9), -d / 2 + 1.3, 1.7, 0.3, 1.8, RF - 0.3, M.timber); ls(-(w / 2 + 0.9), -d / 2 + 1.3, 0.85, 0.9, RF); { const [e1x, e1z] = at(-(w / 2 + 1.75), -d / 2 + 0.45), [e2x, e2z] = at(-w / 2 - 0.05, -d / 2 + 0.45), [e3x, e3z] = at(-(w / 2 + 1.75), -d / 2 + 1.9); rail(e1x, e1z, e2x, e2z, RF); rail(e3x, e3z, e1x, e1z, RF); }
        const [r1x, r1z] = at(-(w / 2 + 1.75), d / 2 - 0.1), [r2x, r2z] = at(-(w / 2 + 1.75), -d / 2 + 1.9); rail(r1x, r1z, r2x, r2z, F1, M.timber, 1.0, RF);
        for (const lz of [d / 4, -d / 4]) lb(-(w / 2 + 0.9), lz, 0.18, F1 + (RF - F1) * (d / 2 - lz) / d - Y - 0.1, 0.18, Y, M.timber, false); } }
  }
  // the balcony over the front, and the outside stairs up to it along the +x side
  if (o.balcony !== false) { const bw = w + 3.4; lb(0, d / 2 + 1.1, bw, 0.3, 2.2, F1 - 0.3, M.floor); ls(0, d / 2 + 1.1, bw / 2, 1.1, F1);
    const ry2 = (lx1, lz1, lx2, lz2) => { const [ax, az] = at(lx1, lz1), [bx, bz] = at(lx2, lz2); rail(ax, az, bx, bz, F1); };
    if (o.balGap) { ry2(-bw / 2, d / 2 + 2.1, -1.5, d / 2 + 2.1); ry2(1.5, d / 2 + 2.1, bw / 2, d / 2 + 2.1); } else ry2(-bw / 2, d / 2 + 2.1, bw / 2, d / 2 + 2.1);
    for (const sx of [-1, 1]) ry2(sx * bw / 2, d / 2 + 0.6, sx * bw / 2, d / 2 + 2.1);
    for (const lx of [-bw / 2 + 0.3, -w / 6, w / 6, bw / 2 - 0.3]) { const [px, pz] = at(lx, d / 2 + 1.9); put(CYL(0.14, 0.16, F1 - 0.3 - Y, 6), M.timber, px, Y + (F1 - 0.3 - Y) / 2, pz); addBox(px, pz, 0.16, 0.16, 0, 'map', Y, F1 - 0.3); }
    { const [ax, az] = at(w / 2 + 0.9, -d / 2 + 0.8), [bx, bz] = at(w / 2 + 0.9, d / 2 - 0.05); stairs(ax, az, Y, bx, bz, F1, 1.6, M.timber, true, false, false); const [r1x, r1z] = at(w / 2 + 1.75, -d / 2 + 0.8), [r2x, r2z] = at(w / 2 + 1.75, d / 2 - 0.05); rail(r1x, r1z, r2x, r2z, Y, M.timber, 1.0, F1); } }
  // inside: a table and benches, barrels; a lantern by the door; ivy and flower boxes outside
  if (o.pews) { for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) { const lx = sx > 0 ? 3.2 : -2.6, lz = d / 2 - 3.2 - i * 2.3; if (lz < -d / 2 + 2) continue; const [px, pz] = at(lx, lz); rb(px, pz, sx > 0 ? 3.2 : 2.0, 0.5, 0.5, Y, ry, M.timber); }
    { const [ax, az] = at(3.4, -d / 2 + 1.3); rb(ax, az, 2.4, 1.1, 1.0, Y, ry, M.marble); crystal(ax, Y + 1.1, az, 0.6, M.crystalG); } }
  else { const [tx, tz] = at(w / 4, -d / 6); rb(tx, tz, 2.2, 0.9, 1.2, Y, ry, M.timber); addSurface(tx, tz, 1.1, 0.6, ry, Y + 0.9); for (const s of [-1, 1]) { const [bx, bz] = at(w / 4, -d / 6 + s * 1.1); rb(bx, bz, 2.0, 0.45, 0.4, Y, ry, M.timber, false); }
    const [kx, kz] = at(w / 2 - 0.9, -d / 2 + 0.9); barrel(kx, kz); const [k2x, k2z] = at(w / 2 - 0.9, d / 2 - 1.3); barrel(k2x, k2z); }
  { const [lx2, lz2] = at(dX + 1.5, d / 2 + 0.35); lantern(lx2, Y + 2.5, lz2); }
  if (o.vines !== false) for (const lz of [-d / 2 + 1.2, d / 2 - 1.5]) { const sx = -1, [vx, vz] = at(sx * (w / 2 + 0.26), lz); vine(vx, vz, loggia ? F1 + 0.8 : RF + 0.6, loggia ? 4.5 : 6, ry + (fx > 0 ? -Math.PI / 2 : Math.PI / 2), 1.3); }
  return { F1, RF, at };
}

// ---- the bases: a spawn room behind a portcullis, opening onto a raised courtyard ----
export const RUINS = { rooms: [], lanes: [], bounds: { x: 58, z: 98 } };
function spawnRoom(k, cx, cz, dir, team) { // dir: unit vector out of the room through the gate, along an axis
  const ax = Math.abs(dir[0]) > 0.5, hw = 7, hd = 5, fy = Y + 4, WH = 6, gx = cx + dir[0] * hd, gz = cz + dir[1] * hd; // gate in the room's outer face
  const W2 = ax ? hd : hw, D2 = ax ? hw : hd;
  put(BOX(W2 * 2, 0.2, D2 * 2), M.flag, cx, fy - 0.1, cz); addSurface(cx, cz, W2, D2, 0, fy); addBox(cx, cz, W2, D2, 0, 'map', -50, fy);
  if (ax) { for (const s of [-1, 1]) wall(cx, cz + s * (hw + 0.3), hd * 2 + 1, 0.6, fy, WH, M.stoneD); wall(cx - dir[0] * (hd + 0.3), cz, 0.6, hw * 2, fy, WH, M.stoneD); }
  else { for (const s of [-1, 1]) wall(cx + s * (hw + 0.3), cz, 0.6, hd * 2 + 1, fy, WH, M.stoneD); wall(cx, cz - dir[1] * (hd + 0.3), hw * 2, 0.6, fy, WH, M.stoneD); }
  put(BOX(ax ? hd * 2 + 1.4 : hw * 2 + 1.4, 0.6, ax ? hw * 2 + 1.4 : hd * 2 + 1.4), M.stoneD, cx, fy + WH + 0.3, cz); addBox(cx, cz, W2 + 0.7, D2 + 0.7, 0, 'map', fy + WH, fy + WH + 0.6);
  for (let i = -3; i <= 3; i++) put(BOX(ax ? 0.5 : 0.9, 0.7, ax ? 0.9 : 0.5), M.stoneD, gx + (ax ? 0 : i * 2.2), fy + WH + 0.95, gz + (ax ? i * 2.2 : 0), 0, 0, false); // merlons over the gate
  // the gate face: posts either side of a 7 m opening, a lintel, and the portcullis
  const px = ax ? 0 : 1, pz = ax ? 1 : 0;
  for (const s of [-1, 1]) wall(gx + px * s * 5.4, gz + pz * s * 5.4, ax ? 0.9 : 3.8, ax ? 3.8 : 0.9, fy, WH, M.stone);
  put(BOX(ax ? 1.0 : 14.6, 1.3, ax ? 14.6 : 1.0), M.stone, gx, fy + WH - 0.65, gz); addBox(gx, gz, ax ? 0.5 : 7.3, ax ? 7.3 : 0.5, 0, 'map', fy + 4.7, fy + WH);
  const bars = []; for (let i = 0; i < 13; i++) { const b = CYL(0.06, 0.06, 4.7, 6); b.translate(-3.3 + i * 0.55, -2.35, 0); bars.push(b); }
  for (const yy of [-0.8, -2.3, -3.8]) { const b = BOX(7, 0.12, 0.12); b.translate(0, yy, 0); bars.push(b); }
  for (let i = 0; i < 13; i++) { const sp = new THREE.ConeGeometry(0.1, 0.3, 5); sp.rotateX(Math.PI); sp.translate(-3.3 + i * 0.55, -4.8, 0); bars.push(sp); }
  const bg = mergeGeometries(bars.map(g => g.index ? g.toNonIndexed() : g), false); const bm = new THREE.Mesh(bg, M.ironBars); bm.position.set(gx, fy + 4.7, gz); bm.rotation.y = ax ? Math.PI / 2 : 0; root.add(bm); AR.gateBars.push(bm);
  for (const s of [-1, 1]) for (const a of [-2, 2]) { if (ax) torch(cx + a, fy + 3, cz + s * (hw - 0.25), s > 0 ? Math.PI : 0); else torch(cx + s * (hw - 0.25), fy + 3, cz + a, s > 0 ? -Math.PI / 2 : Math.PI / 2); }
  banner(cx - dir[0] * (hd - 0.1), fy + 3.2, cz - dir[1] * (hd - 0.1), ax ? (dir[0] > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir[1] > 0 ? 0 : Math.PI), team, 2.2, 3.6);
  for (const s of [-1, 1]) { const bx = cx + (ax ? 0 : s * (hw - 0.5)), bz = cz + (ax ? s * (hw - 0.5) : 0); rb(bx, bz, ax ? 3 : 0.8, 0.5, ax ? 0.8 : 3, fy, 0, M.timber); } // benches
  for (const s of [-1, 1]) banner(gx + dir[0] * 0.6 + px * s * 5.4, fy + 3.4, gz + dir[1] * 0.6 + pz * s * 5.4, Math.atan2(dir[0], dir[1]), team, 1.6, 3.0); // banners either side of the gate
  RUINS.rooms.push({ k, cx, cz, hw: W2, hd: D2, gx, gz, dir, ax, fy });
  AR.gates[k] = { a: Math.atan2(dir[0], dir[1]) + Math.PI, x: gx + dir[0] * 6, z: gz + dir[1] * 6, y: fy, banner: null, roomBanner: null };
}

// one half of the map (team 1's north side, sz = +1); the south half is the same mirrored (sz = -1): z flips, turns mirror
function half(sz, team) {
  seed(1234); const Z = (z) => z * sz, RY = (r) => (sz > 0 ? r : Math.PI - r), FX = sz;
  const tc = team ? M.crystalR : M.crystal, face = RY(0), back = RY(Math.PI); // face: looking toward the base (+z); back: looking toward the centre

  // ===== THE BASE: a raised stone courtyard 4 m up, the spawn room and two keeps behind it =====
  block(0, Z(81), 117, 14, Y - 0.1, 4.1, M.stone, M.flag);
  for (const s of [-1, 1]) { block(s * 33.2, Z(93.2), 51.2, 10.4, Y - 0.1, 8.1, M.stoneD, M.flag); // the keeps: their roofs are a high firing step for defenders
    for (let i = 0; i < 16; i++) { const x = s * (9 + i * 3.2); if (Math.abs(Math.abs(x) - 30) < 2.4) continue; put(BOX(1.3, 1.0, 0.6), M.stoneD, x, Y + 8.5, Z(88.3)); addBox(x, Z(88.3), 0.65, 0.3, 0, 'map', Y + 8, Y + 9); }
    stairs(s * 20, Z(86), Y + 4, s * 28, Z(86), Y + 8, 3.5); block(s * 30, Z(86), 4, 4, Y + 3.9, 4.1, M.stoneD, M.flag);
    wall(s * 54, Z(93), 6, 6, Y + 8, 7, M.stone); put(new THREE.ConeGeometry(4.6, 5, 8), M.roof, s * 54, Y + 17.5, Z(93), Math.PI / 8); banner(s * 54, Y + 12, Z(89.9), back, team, 2.2, 4); // corner towers
    for (const x of [16, 40]) { put(BOX(3.2, 3.2, 0.3), M.dark, s * x, Y + 5.6, Z(87.95)); put(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 12, 1, false, 0, Math.PI), M.dark, s * x, Y + 7.2, Z(87.95), 0, Math.PI / 2, false); } // dark arched doorways
    for (const x of [22, 46]) banner(s * x, Y + 6.2, Z(87.8), back, team, 1.6, 3.2);
    for (const x of [12, 34.5, 50]) torch(s * x, Y + 6.6, Z(87.7), back);
    column(s * 9.8, Z(85.5), 7.5, Y + 4, false, M.marble, false); column(s * 38, Z(85.5), 7.5, Y + 4, false, M.marble, false); column(s * 50, Z(85.5), 5, Y + 4, true, M.marble, false);
    crystal(s * 16, Y + 4, Z(85.5), 1.2, tc); bush(s * 44, Z(86.5), 1.2, Y + 4); cache(s * 53, Z(78.5), Y + 4, 1);
    for (let i = 0; i < 4; i++) vine(s * (12 + i * 12.5), Z(87.6), Y + 8, 4 + rnd() * 2, back, 1.6); }
  // a balustrade along the courtyard's edge, open where the stairs go down
  for (const [a, b] of [[-58.4, -55.3], [-48.7, -44], [-36, -8.3], [8.3, 36], [44.2, 58.4]]) { const c = (a + b) / 2, L = b - a; put(BOX(L, 1.0, 0.5), M.stone, c, Y + 4.5, Z(74.25)); addBox(c, Z(74.25), L / 2, 0.25, 0, 'map', Y + 4, Y + 5); put(BOX(L + 0.1, 0.15, 0.7), M.marble, c, Y + 5.07, Z(74.25), 0, 0, false); }
  // the courtyard's front face: buttresses, ivy, torches, banners
  for (let x = -54; x <= 54; x += 9) { if (Math.abs(x) < 9 || Math.abs(x + 40) < 5 || Math.abs(x - 40) < 5.5 || Math.abs(x + 52) < 4) continue; put(BOX(1.4, 4.2, 1.0), M.stoneD, x, Y + 2.1, Z(73.6)); addBox(x, Z(73.6), 0.7, 0.5, 0, 'map', Y, Y + 4.2); vine(x + 2.5, Z(73.95), Y + 4, 3.4, back, 1.4); }
  for (const x of [-27, 18, 29]) torch(x, Y + 3, Z(73.7), back); banner(-18, Y + 2.4, Z(73.95), back, team, 1.6, 2.8); banner(22, Y + 2.4, Z(73.95), back, team, 1.6, 2.8);

  // ===== MIDDLE: grand stairs down to the street; tall houses either side with a bridge between their balconies =====
  stairs(0, Z(74), Y + 4, 0, Z(63), Y, 16);
  for (const s of [-1, 1]) { block(s * 8.6, Z(68.5), 1.2, 11, Y - 0.1, 2.0, M.stone, M.marble, false); statue(s * 11, Z(61.5), back); brazier(s * 10.5, Z(65.5)); }
  const hL = house(-23, Z(40), 14, 12, RY(Math.PI / 2), { fx: FX, balGap: true, roofGap: true, doorX: 0.5, back: true });
  house(23, Z(40), 14, 12, RY(-Math.PI / 2), { fx: -FX, balGap: true, roofGap: true, doorX: 0.5, back: true });
  { const F1 = hL.F1; put(BOX(29.8, 0.4, 3.0), M.floor, 0, F1 - 0.2, Z(40)); addSurface(0, Z(40), 14.9, 1.5, 0, F1); addBox(0, Z(40), 14.9, 1.5, 0, 'map', F1 - 0.4, F1); // the timber bridge across the street
    for (const s of [-1, 1]) rail(-14.8, Z(40) + s * 1.45, 14.8, Z(40) + s * 1.45, F1);
    for (const s of [-1, 1]) { rb(s * 7, Z(40), 1.4, F1 - 0.4 - Y, 1.6, Y, 0, M.stone); put(BOX(1.8, 0.4, 2.0), M.stone2, s * 7, F1 - 0.6, Z(40), 0, 0, false); }
    for (const s of [-1, 1]) for (const x of [-11, 0, 11]) put(BOX(0.25, 0.25, 7.6), M.timber, x, F1 - 1.6, Z(40) + s * 1.2, Math.PI / 2, (x ? Math.sign(x) : 1) * 0.42, false); // braces
    banner(0, F1 - 1.9, Z(38.4), back, team, 1.8, 2.8); banner(0, F1 - 1.9, Z(41.6), face, team, 1.8, 2.8); lantern(-7, F1 + 1.4, Z(40)); lantern(7, F1 + 1.4, Z(40)); }
  for (const s of [-1, 1]) { put(BOX(3.2, 1.1, 0.7), M.stone, s * 6.5, Y + 0.55, Z(52)); addBox(s * 6.5, Z(52), 1.6, 0.35, 0, 'map', Y, Y + 1.1); rubble(s * 5, Z(53.5), 5); // low walls to duck behind
    put(BOX(2.6, 1.0, 0.7), M.stone, s * 7.5, Y + 0.5, Z(31), RY(0.3 * s)); addBox(s * 7.5, Z(31), 1.3, 0.35, RY(0.3 * s), 'map', Y, Y + 1.0);
    awning(s * 11.8, Z(57), 3.4, 2.2, 2.6, RY(s * Math.PI / 2), -1); cache(s * 12.5, Z(25.5), Y, 2); barrel(s * 13.5, Z(51)); barrel(s * 13.2, Z(52.1));
    for (const z of [28, 60]) { put(CYL(0.12, 0.15, 3.4, 6), M.iron, s * 14, Y + 1.7, Z(z)); lantern(s * 14, Y + 3.5, Z(z)); addCircle(s * 14, Z(z), 0.2); } }
  { const F1 = hL.F1; for (const z of [55, 29]) bunting(-15.5, F1 + 2.6, Z(z), 15.5, F1 + 2.2, Z(z + 1.5), team); }
  // collapsed walls across the street, offset so nobody can run straight down the middle: a zig-zag through the gaps by the houses
  { const wallAt = (x0, x1, z) => { const c = (x0 + x1) / 2, L = x1 - x0; rb(c, Z(z), L, 2.6, 1.3, Y, 0, M.stone); put(BOX(L + 0.4, 0.35, 1.6), M.stoneD, c, Y + 2.75, Z(z), 0, 0, false);
      for (let k = 0; k < 4; k++) { const bx = x0 + (k + 0.5) * L / 4; put(BOX(1.1 + (k % 2) * 0.5, 0.9, 1.0), k % 2 ? M.stone2 : M.stoneL, bx, Y + 3.3, Z(z) + (k % 2 ? 0.2 : -0.2) * sz, 0.2 * (k - 1.5), 0, false); }
      rubble(x0 + 1.5, Z(z + 1.6), 5, 1.8); rubble(x1 - 1.5, Z(z - 1.6), 5, 1.8); };
    wallAt(-10.5, 6, 48); /* (the near collapse: get round it on the right) */ wallAt(-6, 12.5, 34); /* (the far collapse: get round it on the left) */ }
  // the triumphal arch where the street meets the plaza (broken on one side)
  for (const s of [-1, 1]) { wall(s * 13.6, Z(26), 2.6, 2.6, Y, 9, M.marble); put(BOX(3.2, 0.6, 3.2), M.stone, s * 13.6, Y + 0.3, Z(26), 0, 0, false); put(BOX(3.0, 0.8, 3.0), M.marble, s * 13.6, Y + 9.3, Z(26), 0, 0, false); }
  { const N = 18, ea = 13.6, eb = 5.2, P = (k) => { const a = Math.PI * k / N; return [Math.cos(a) * ea, Y + 9.6 + Math.sin(a) * eb]; }; /* an elliptical arch of stone blocks, its keystone fallen */
    for (let k = 0; k < N; k++) { if (k === 9 || k === 10) continue; const [x1, y1] = P(k), [x2, y2] = P(k + 1), L = Math.hypot(x2 - x1, y2 - y1); const g = BOX(L + 0.08, 1.5, 2.2); g.rotateZ(Math.atan2(y2 - y1, x2 - x1)); put(g, k % 2 ? M.marble : M.stoneL, (x1 + x2) / 2, (y1 + y2) / 2, Z(26)); }
    put(BOX(2.2, 1.4, 2.0), M.marble, 4.5, Y + 0.7, Z(21), RY(0.7), 0.3); addBox(4.5, Z(21), 1.1, 1.0, RY(0.7), 'map', Y, Y + 1.4); /* (the fallen keystone) */ for (const s of [-1, 1]) banner(s * 13.6, Y + 5.6, Z(24.6), back, team, 1.7, 3.6); rubble(-7, Z(24), 8, 2.5); put(BOX(3.5, 1.4, 2.0), M.marble, -9, Y + 0.7, Z(23.5), RY(0.4), 0.15); addBox(-9, Z(23.5), 1.75, 1.0, RY(0.4), 'map', Y, Y + 1.4); }

  // ===== LEFT: the rampart, a high walkway 9 m up with a watchtower; a lower outer path beside it =====
  stairs(-40, Z(79), Y + 4, -40, Z(70), Y + 9, 7);
  block(-40, Z(47), 10, 46, Y - 0.1, 9.1, M.stone, M.flag);
  for (const ex of [-45.3, -34.7]) for (let z = 25.5; z < 69; z += 3.0) { if (ex > -40 && Math.abs(z - 40) < 2.2) continue; if (ex < -40 && z > 50.8 && z < 56.5) continue; put(BOX(0.6, 1.0, 1.3), M.stone, ex, Y + 9.5, Z(z)); addBox(ex, Z(z), 0.3, 0.65, 0, 'map', Y + 9, Y + 10); }
  for (let z = 27; z < 68; z += 6) { for (const [ex, r] of [[-45.45, -Math.PI / 2], [-34.55, Math.PI / 2]]) { put(BOX(0.3, 1.2, 0.25), M.dark, ex, Y + 5.5, Z(z), 0, 0, false); if (rnd() < 0.6) vine(ex + (ex < -40 ? -0.1 : 0.1), Z(z + 2), Y + 9, 5 + rnd() * 3, r, 1.5); } }
  for (const z of [30, 46, 62]) for (const ex of [-45.8, -34.2]) { if (ex < -40 && z === 46) continue; put(BOX(1.2, 9, 1.6), M.stoneD, ex, Y + 4.5, Z(z)); addBox(ex, Z(z), 0.6, 0.8, 0, 'map', Y, Y + 9); }
  stairs(-40, Z(24), Y + 9, -40, Z(10), Y, 7);
  // the watchtower: a platform 3.5 m above the walkway under a little roof, reached by stairs along the outer side
  block(-42.5, Z(47), 5, 9, Y + 9, 3.5, M.stone, M.flag); stairs(-42.5, Z(33.5), Y + 9, -42.5, Z(42.5), Y + 12.5, 3.4);
  for (const [lx, lz] of [[-44.7, 43], [-40.3, 43], [-44.7, 51], [-40.3, 51]]) { put(CYL(0.18, 0.2, 3.2, 6), M.timber, lx, Y + 14.1, Z(lz)); addBox(lx, Z(lz), 0.2, 0.2, 0, 'map', Y + 12.5, Y + 15.7); }
  pyramid(-42.5, Y + 15.7, Z(47), 5, 9, 2.2, 0); for (const [x1, z1, x2, z2] of [[-44.8, 51.4, -40.2, 51.4], [-44.8, 42.6, -44.8, 51.4], [-40.2, 42.6, -40.2, 51.4]]) rail(x1, Z(z1), x2, Z(z2), Y + 12.5, M.stone, 0.9);
  banner(-40.05, Y + 11.4, Z(47), RY(Math.PI / 2), team, 1.6, 2.6); brazier(-43.5, Z(49.5), Y + 12.5, 0.8); crystal(-37, Y + 9, Z(66), 0.8, tc);
  for (const z of [36, 58]) { torch(-35.3, Y + 10.6, Z(z), Math.PI / 2); } cache(-43, Z(60), Y + 9, 3);
  // the bridge from the rampart over the alley to the left house's roof terrace
  stairs(-34.85, Z(40), Y + 9, -29.15, Z(40), hL.RF, 2.4, M.timber, true, false, false); for (const s of [-1, 1]) rail(-34.85, Z(40) + s * 1.25, -29.15, Z(40) + s * 1.25, Y + 9, M.timber, 1.0, hL.RF);
  for (const s of [-1, 1]) put(BOX(0.2, 2.2, 0.2), M.timber, -32.2, (Y + 9 + hL.RF) / 2 - 1.5, Z(40) + s * 1.1, 0, 0, false);
  // the outer path below the rampart: from the courtyard down a stair, past a stable and stores, with a stair up to the walkway
  stairs(-52, Z(74), Y + 4, -52, Z(63.5), Y, 6);
  stairs(-47.5, Z(33), Y, -47.5, Z(52), Y + 9, 4); block(-47.25, Z(53.75), 4.5, 3.5, Y - 0.1, 9.1, M.stone, M.flag); rail(-49.5, Z(52), -49.5, Z(55.5), Y + 9, M.stone, 0.9); rail(-49.5, Z(55.5), -45.2, Z(55.5), Y + 9, M.stone, 0.9);
  { for (const [lx, lz] of [[-58, 54], [-53, 54], [-58, 60], [-53, 60]]) { put(CYL(0.16, 0.18, 3.4, 6), M.timber, lx + 0.3, Y + 1.7, Z(lz)); addCircle(lx + 0.3, Z(lz), 0.2); } // a stable lean-to
    put(BOX(6.4, 0.2, 7.4), M.roof, -55.2, Y + 3.5, Z(57), 0, 0, false); put(CYL(0.6, 0.6, 1.2, 10), M.hay, -56, Y + 0.6, Z(56), Math.PI / 2, Math.PI / 2); put(CYL(0.6, 0.6, 1.2, 10), M.hay, -56, Y + 0.6, Z(58), Math.PI / 2, Math.PI / 2); put(CYL(0.6, 0.6, 1.2, 10), M.hay, -56, Y + 1.6, Z(57), Math.PI / 2, Math.PI / 2); addBox(-56, Z(57), 0.7, 1.8, 0, 'map', Y, Y + 2.2); }
  cart(-54.5, Z(45), RY(0.3)); cache(-56, Z(36), Y, 4); cache(-50.5, Z(27), Y, 5); well(-53, Z(18)); tree(-56, Z(28), 1.1); bush(-57.5, Z(50), 1.3); bush(-46.5, Z(66), 1.0); well(-22, Z(68)); cart(24, Z(67.5), RY(1.2)); cache(-14, Z(70.5), Y, 8); bush(15, Z(72.5), 1.2); bush(-30, Z(72.5), 1.1); rubble(-26, Z(65), 7, 2.2); rubble(-50, Z(40), 8, 2); rubble(-55, Z(53), 6, 1.5);
  for (const z of [32, 50]) torch(-45.3, Y + 3.2, Z(z), -Math.PI / 2);
  // the lane walls: tall ruined facades between the lanes, and a ruined tower (left) and a bell tower (right) by the plaza
  for (const s of [-1, 1]) { wall(s * 31.5, Z(57), 3, 14, Y, 12, M.stoneD); put(BOX(3.4, 0.4, 14.4), M.moss, s * 31.5, Y + 12.2, Z(57), 0, 0, false); put(BOX(3.0, 3.0, 4), M.stoneD, s * 31.5, Y + 13.4, Z(60), 0, 0, false);
    for (const z of [53, 57, 61]) for (const e of [-1.55, 1.55]) { put(BOX(0.05, 2.2, 1.2), M.dark, s * 31.5 + e, Y + 7.5, Z(z), 0, 0, false); put(BOX(0.05, 2.0, 1.0), M.dark, s * 31.5 + e, Y + 3.0, Z(z), 0, 0, false); }
    vine(s * 31.5 - s * 1.6, Z(55), Y + 12, 8, s > 0 ? -Math.PI / 2 : Math.PI / 2, 2.0); vine(s * 31.5 + s * 1.6, Z(59), Y + 12, 7, s > 0 ? Math.PI / 2 : -Math.PI / 2, 1.8);
    wall(s * 31.5, Z(23), 5, 5, Y, s < 0 ? 13 : 16, M.stoneD); wall(s * 31.5, Z(17.5), 3, 6, Y, 7, M.stoneD); put(BOX(3.4, 0.4, 6.4), M.moss, s * 31.5, Y + 7.2, Z(17.5), 0, 0, false); rubble(s * 29, Z(15), 8, 2.2); }
  { for (const [dx, dz, h] of [[-1.6, -1.6, 2.2], [1.4, 1.2, 1.2], [-1.2, 1.5, 3.0]]) put(BOX(1.6, h, 1.6), M.stoneD, -31.5 + dx, Y + 13 + h / 2, Z(23 + dz), 0, 0, false); vine(-28.95, Z(22), Y + 13, 9, Math.PI / 2, 2.2); put(BOX(0.05, 2.4, 1.2), M.dark, -28.97, Y + 9, Z(23), 0, 0, false); } // ruined tower top
  { put(BOX(5.6, 0.6, 5.6), M.stone, 31.5, Y + 16.3, Z(23), 0, 0, false); for (const [dx, dz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) put(BOX(0.7, 3.4, 0.7), M.stone, 31.5 + dx, Y + 18.3, Z(23 + dz), 0, 0, false); // bell tower
    put(BOX(5.8, 0.5, 5.8), M.stone, 31.5, Y + 20.2, Z(23), 0, 0, false); pyramid(31.5, Y + 20.45, Z(23), 5.4, 5.4, 4.5); put(CYL(0.5, 1.0, 1.5, 12), M.bronze, 31.5, Y + 18.2, Z(23), 0, 0, false); put(BOX(0.05, 3, 1.4), M.dark, 28.97, Y + 11, Z(23), 0, 0, false); banner(28.95, Y + 7, Z(23), -Math.PI / 2, team, 1.6, 3.0); }

  // ===== RIGHT: down into the garden, through the chapel (a gallery upstairs), past a garden terrace with a gazebo =====
  stairs(40, Z(74), Y + 4, 40, Z(63), Y, 8);
  const ch = house(41, Z(38), 12, 16, RY(Math.PI), { fx: FX, upper: 'loggia', balcony: false, back: true, doorX: 0, doorW: 2.6, pews: true, wall: M.stoneL, roofH: 4.2, upDoors: [{ side: 1, lz: -2 }, { side: -1, lz: -6.5 }], vines: true });
  { const [fx2, fz2] = ch.at(0, 8.25); put(BOX(3.6, 0.5, 0.5), M.stone, fx2, Y + 3.0, fz2, RY(Math.PI)); banner(fx2, Y + 5.6, fz2 + Z(-0.35), back, team, 1.8, 3.0); const [bx2, bz2] = ch.at(0, -8.25); banner(bx2, Y + 5.6, bz2 + Z(0.35), face, team, 1.8, 3.0);
    torch(39.2, Y + 2.6, Z(29.6), back); torch(42.8, Y + 2.6, Z(29.6), back); }
  // the bridge from the right house's roof down to the chapel gallery
  stairs(29.15, Z(40), hL.RF, 35.0, Z(40), ch.F1, 2.4, M.timber, true, false, false); for (const s of [-1, 1]) rail(29.15, Z(40) + s * 1.25, 34.75, Z(40) + s * 1.25, hL.RF, M.timber, 1.0, ch.F1);
  for (const s of [-1, 1]) put(BOX(0.2, 4.0, 0.2), M.timber, 32, Y + 2.6, Z(40) + s * 1.1, 0, 0, false);
  // the garden terrace (level with the chapel gallery, joined by a plank) with a gazebo
  block(53, Z(42), 10, 12, Y - 0.1, ch.F1 - Y + 0.1, M.stone, M.moss); stairs(53, Z(60), Y, 53, Z(48), ch.F1, 4); put(BOX(1.4, 0.25, 2.6), M.floor, 47.4, ch.F1 - 0.12, Z(44.5)); addSurface(47.4, Z(44.5), 0.75, 1.3, 0, ch.F1);
  for (const [x1, z1, x2, z2] of [[48.2, 36.2, 57.8, 36.2], [48.2, 36.2, 48.2, 43.0], [48.2, 46.0, 48.2, 47.8], [48.2, 47.8, 50.8, 47.8], [55.2, 47.8, 57.8, 47.8]]) rail(x1, Z(z1), x2, Z(z2), ch.F1, M.stone, 0.9);
  for (const [lx, lz] of [[51, 39], [56, 39], [51, 45], [56, 45]]) { put(CYL(0.15, 0.17, 3, 8), M.marble, lx, ch.F1 + 1.5, Z(lz)); addBox(lx, Z(lz), 0.18, 0.18, 0, 'map', ch.F1, ch.F1 + 3); }
  { const dome = new THREE.SphereGeometry(3.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.55, 1.15); put(dome, M.copper, 53.5, ch.F1 + 3, Z(42)); } bush(56.8, Z(37.5), 0.9, ch.F1); bush(49.2, Z(46.8), 0.8, ch.F1); crystal(53.5, ch.F1, Z(42), 0.8, tc);
  for (const [x, z] of [[58, 37.5], [58, 46.5]]) vine(x - 0.1, Z(z), ch.F1, 3.6, -Math.PI / 2, 1.6);
  // trees, rocks, hedges, a pond and flower beds
  tree(51, Z(66), 1.1); tree(56.5, Z(25), 1.2); tree(34.5, Z(68), 0.9); tree(44.5, Z(24), 0.9); tree(56, Z(55), 0.8);
  rock(46.5, Z(56), 1.0); rock(35, Z(50), 0.8); rock(57, Z(31), 0.9); rock(47.5, Z(28), 0.6);
  { const p = new THREE.CircleGeometry(3.4, 20); p.rotateX(-Math.PI / 2); p.scale(1.4, 1, 1); put(p, M.water, 51, Y + 0.12, Z(20), 0, 0, false); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; put(new THREE.DodecahedronGeometry(0.45, 0), M.rock, 51 + Math.cos(a) * 4.9, Y + 0.2, Z(20) + Math.sin(a) * 3.5, a); } addBox(51, Z(20), 4.4, 3.0, 0, 'map', Y, Y + 0.6);  for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 1 + (i % 3) * 1.1, g = new THREE.CircleGeometry(0.42 + (i % 2) * 0.2, 9, 0.3, 5.9); g.rotateX(-Math.PI / 2); put(g, M.leaf, 51 + Math.cos(a) * r * 1.3, Y + 0.15, Z(20) + Math.sin(a) * r * 0.8, a, 0, false); if (i % 3 === 0) put(new THREE.SphereGeometry(0.12, 6, 4), M.flower, 51 + Math.cos(a) * r * 1.3, Y + 0.2, Z(20) + Math.sin(a) * r * 0.8, 0, 0, false); } } // (lily pads)
  for (const [x, z, l] of [[36, 54, 4], [36, 60, 3], [46, 60, 3.4], [56.5, 66, 3]]) { put(BOX(1.1, 1.2, l), M.leafD, x, Y + 0.6, Z(z)); put(BOX(1.15, 0.2, l + 0.05), M.leaf, x, Y + 1.25, Z(z), 0, 0, false); addBox(x, Z(z), 0.55, l / 2, 0, 'map', Y, Y + 1.2); }
  for (const [x, z] of [[44.5, 51], [37, 26], [49.5, 30], [57, 60], [33.8, 46], [47.8, 27]]) bush(x, Z(z), 1.0 + rnd() * 0.4);
  for (const [x, z] of [[46, 52], [35.2, 57]]) { put(BOX(2.6, 0.35, 1.4), M.stone, x, Y + 0.17, Z(z), 0, 0, false); for (let i = 0; i < 5; i++) put(new THREE.SphereGeometry(0.18, 6, 5), i % 2 ? M.fruit : M.flower, x - 1 + i * 0.5, Y + 0.45, Z(z) + (i % 2 - 0.5) * 0.4, 0, 0, false); }
  statue(36, Z(16), RY(-Math.PI * 0.8)); cache(55, Z(70), Y, 6); torch(57.8, Y + 3.2, Z(16), -Math.PI / 2);

  // ===== THE PLAZA's half: raised platforms with ramps (good spots for ranged fighters), broken pillars, cover =====
  for (const s of [-1, 1]) { block(s * 18, Z(12.5), 12, 6, Y - 0.1, 3.3, M.stone, M.moss); stairs(s * 5, Z(12.5), Y, s * 12, Z(12.5), Y + 3.2, 3, M.stone2, false);
    for (const [x1, x2] of [[13.5, 16.5], [19.5, 23.5]]) { put(BOX(x2 - x1, 1.0, 0.5), M.stone, s * (x1 + x2) / 2, Y + 3.7, Z(9.75)); addBox(s * (x1 + x2) / 2, Z(9.75), (x2 - x1) / 2, 0.25, 0, 'map', Y + 3.2, Y + 4.2); }
    statue(s * 21.5, Z(14), back, Y + 3.2, M.marble); brazier(s * 14, Z(14.5), Y + 3.2, 0.8); vine(s * 24.05, Z(12.5), Y + 3.2, 2.6, s > 0 ? Math.PI / 2 : -Math.PI / 2, 2.4);
    column(s * 28, Z(14), 6.5, Y, true); column(s * 27.5, Z(6), 6.5, Y, false); put(BOX(1.2, 1.1, 3.4), M.stone, s * 50, Y + 0.55, Z(12)); addBox(s * 50, Z(12), 0.6, 1.7, 0, 'map', Y, Y + 1.1); rubble(s * 51.5, Z(11), 6, 1.6);
    cache(s * 22, Z(20), Y, 7); bush(s * 25, Z(9), 1.1); rock(s * 45.2, Z(21.5), 0.7); }
}

export function buildRuins(scene) {
  const K = KIT || (KIT = makeKit()), T = (key, c, r = 0.9, m = 0, o = {}) => kitMat(K, key, c, r, m, o), G = (o) => { glowify(o); return o; }, D2 = { side: THREE.DoubleSide };
  M = { stone: T('ashlar', '#e6d6b8', 0.9), stone2: T('ashlar', '#d2c0a0', 0.9), stoneD: T('ashlarD', '#b4a898', 0.92), stoneL: T('ashlar', '#f2e6cc', 0.88), moss: T('grass', '#9aa078', 1), flag: T('flag', '#eadcc2', 0.92), marble: T('marble', '#f6f0e4', 0.5),
    plaster: T('plaster', '#fff2dc', 0.95), timber: T('wood', '#8a5e3c', 0.85), floor: T('wood', '#a87850', 0.88), crate: T('wood', '#c89a66', 0.9), roof: T('roof', '#ffd2b4', 0.78), glass: S('#20303a', 0.3, 0.2), iron: G(S('#3a3634', 0.5, 0.75, { vertexColors: true })), dark: S('#120e0c', 1),
    bronze: G(S('#8a7440', 0.42, 0.8, { vertexColors: true })), copper: G(S('#5fa58e', 0.55, 0.45, { vertexColors: true })), hay: S('#d8b860', 1), water: S('#1e4e5e', 0.06, 0.2, { transparent: true, opacity: 0.88 }), cloth: T(null, '#e0c89a', 0.95, 0, D2),
    fruit: S('#c8402a', 0.7), fruit2: S('#e0a030', 0.7), flower: S('#d870b0', 0.8), emblem: S('#f0e6c8', 0.9, 0, D2), gold: Object.assign(T('cloth', '#e0b040', 0.8, 0.1, D2), {}),
    lamp: new THREE.MeshBasicMaterial({ color: '#ffd890' }), flame: new THREE.MeshBasicMaterial({ color: '#ff9a30' }), flameCore: new THREE.MeshBasicMaterial({ color: '#fff0a0' }), ember: new THREE.MeshBasicMaterial({ color: '#ffe2a0' }),
    crystal: S('#7ac8ff', 0.2, 0.1, { emissive: '#3a90ff', emissiveIntensity: 1.6 }), crystalR: S('#ff8a7a', 0.2, 0.1, { emissive: '#ff3a2a', emissiveIntensity: 1.4 }), crystalG: S('#ffe08a', 0.2, 0.1, { emissive: '#ffb02a', emissiveIntensity: 1.2 }),
    bark: T('bark', '#c0a088', 0.95), barkT: T('bark', '#b09078', 0.95), char: T('bark', '#3a302c', 1), leaf: T('leaf', '#d8f0a8', 0.9), leafD: T('leaf', '#a8c888', 0.95), leafT: T('leaf', '#d0e8a0', 0.9), leafTD: T('leaf', '#a0c080', 0.95),
    leafGlow: T('gold', '#ffffff', 0.7, 0, { emissive: '#ffb050', emissiveIntensity: 0.9 }), leafGlowD: T('gold', '#e8b080', 0.75, 0, { emissive: '#e07020', emissiveIntensity: 0.7 }),
    ivy: T('ivy', '#d8f0a0', 0.9, 0, { side: THREE.DoubleSide, alphaTest: 0.45 }), ivyD: T('ivy', '#a8c880', 0.95, 0, { side: THREE.DoubleSide, alphaTest: 0.45 }),
    rock: T('ashlarD', '#b8ae9e', 0.95, 0, { flatShading: true }), rockT: T('ashlarD', '#b0a696', 0.95, 0, { flatShading: true }), farStone: S('#b0988a', 1), farRoof: S('#8a5848', 1), farHill: S('#8a8ca8', 1, 0, { flatShading: true }), farPlain: S('#8a7a60', 1) };
  M.leafGlow.emissiveMap = K.gold.map; M.leafGlowD.emissiveMap = K.gold.map;
  for (const k of ['stone', 'stone2', 'stoneD', 'stoneL', 'flag', 'marble']) M[k].userData.moss = 0.9; M.stoneD.userData.soot = 0.7; M.stone.userData.soot = 0.82; M.stone2.userData.soot = 0.8; M.plaster.userData.soot = 0.78; M.timber.userData.soot = 0.85;
  M.team = COLORS.map(c => kitMat(K, 'cloth', c, 0.85, 0, D2));
  M.mosaic = T('mosaic', '#f4ead8', 0.85); M.goldInlay = G(S('#e8c060', 0.32, 0.85, { vertexColors: true })); M.ironBars = S('#2e2e32', 0.45, 0.8); LIGHTS.length = 0; TREES.length = 0; ROCKS.length = 0;
  root = new THREE.Group(); scene.add(root); geoBuckets.clear(); RUINS.rooms.length = 0; AR.gates.length = 0; AR.gateBars.length = 0; AR.R = 80; AR.map = 'ruins';
  // the outer walls: tall ruined walls all round, crenellated, with buttresses and ivy, cliffs beyond
  seed(99);
  for (const s of [-1, 1]) { wall(s * 61, 0, 3, 205, Y - 1, 21, M.stoneD); wall(0, s * 101, 125, 3, Y - 1, 21, M.stoneD); }
  for (const s of [-1, 1]) { for (let z = -98; z <= 98; z += 4) { put(BOX(1.4, 1.4, 1.8), M.stoneD, s * 59.9, Y + 20.7, z, 0, 0, false); } for (let x = -58; x <= 58; x += 4) put(BOX(1.8, 1.4, 1.4), M.stoneD, x, Y + 20.7, s * 99.9, 0, 0, false);
    for (let z = -90; z <= 90; z += 12) { put(BOX(1.4, 18, 2.2), M.stone2, s * 59.2, Y + 8, z, 0, 0, false); if (rnd() < 0.7) vine(s * 58.95 + s * 0.4 * 0, z + 3, Y + 18, 8 + rnd() * 6, s > 0 ? -Math.PI / 2 : Math.PI / 2, 2.2); }
    for (let x = -50; x <= 50; x += 12.5) { if (Math.abs(x) < 9) continue; put(BOX(2.2, 18, 1.4), M.stone2, x, Y + 8, s * 99.2, 0, 0, false); }
    for (let k = -7; k <= 7; k++) { put(new THREE.ConeGeometry(4.5, 12 + (k & 1) * 6, 6), M.rock, s * 66, Y + 14, k * 14 + 4); } for (let k = -4; k <= 4; k++) put(new THREE.ConeGeometry(5, 14 + (k & 1) * 6, 6), M.rock, k * 15, Y + 15, s * 106); }
  half(-1, 0); half(1, 1);
  // the centre: a sunken ring round an ancient glowing tree (the hill to hold in King of the Hill), braziers, a ring of columns
  { const flat = (g) => { g.rotateX(-Math.PI / 2); return g; }; put(flat(new THREE.CircleGeometry(10.6, 48)), M.mosaic, 0, Y + 0.035, 0, 0, 0, false);
    put(flat(new THREE.RingGeometry(6.6, 7.2, 64, 2)), M.goldInlay, 0, Y + 0.05, 0, 0, 0, false); put(flat(new THREE.RingGeometry(10.3, 10.75, 64)), M.stoneD, 0, Y + 0.045, 0, 0, 0, false);
    const hill = new THREE.Mesh(new THREE.RingGeometry(6.6, 7.2, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); hill.rotation.x = -Math.PI / 2; hill.position.y = Y + 0.08; root.add(hill); AR.hill = hill;
    put(CYL(3.4, 3.7, 0.3, 24), M.stone, 0, Y + 0.15, 0); put(CYL(2.6, 2.9, 0.6, 24), M.marble, 0, Y + 0.3, 0); addCircle(0, 0, 2.9); heartwood(put, M, 0, Y + 0.6, 0, LIGHTS); addBox(0, 0, 1.7, 1.7, 0.4, 'map', Y, Y + 9.5); /* (the trunk stops arrows and blocks sight) */ motes(root, AR.time, 0, Y + 1, 0, 14, 16, 240);
    crystal(2.0, Y + 0.6, 0.9, 0.6); crystal(-1.8, Y + 0.6, -1.1, 0.6); crystal(0.5, Y + 0.6, 2.1, 0.5); crystal(-0.6, Y + 0.6, -2.2, 0.5);
    for (const [x, z] of [[6.3, 6.3], [-6.3, 6.3], [6.3, -6.3], [-6.3, -6.3]]) brazier(x, z);
    seed(7); const tops = []; for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * Math.PI * 2, m = Math.min(k, 15 - k), broken = [1, 4, 6].includes(m % 8); const top = column(Math.cos(a) * 11.2, Math.sin(a) * 11.2, 6.5, Y, broken); tops.push(broken ? null : top); }
    for (let k = 0; k < 16; k++) { const k2 = (k + 1) % 16; if (tops[k] == null || tops[k2] == null) continue; const a1 = (k + 0.5) / 16 * Math.PI * 2, a2 = (k2 + 0.5) / 16 * Math.PI * 2, x1 = Math.cos(a1) * 11.2, z1 = Math.sin(a1) * 11.2, x2 = Math.cos(a2) * 11.2, z2 = Math.sin(a2) * 11.2;
      put(BOX(1.1, 0.8, Math.hypot(x2 - x1, z2 - z1) + 1.2), M.marble, (x1 + x2) / 2, tops[k] + 0.4, (z1 + z2) / 2, Math.atan2(x2 - x1, z2 - z1)); } }
  // spawn rooms: south (team 0) and north (team 1); west and east for 3- and 4-team games
  spawnRoom(0, 0, -93, [0, 1], 0); spawnRoom(1, 0, 93, [0, -1], 1); spawnRoom(2, -53, 0, [1, 0], 2); spawnRoom(3, 53, 0, [-1, 0], 3);
  for (const s of [-1, 1]) { block(s * 45, 0, 6, 16, Y - 0.1, 4.1, M.stone, M.flag); stairs(s * 42, 0, Y + 4, s * 34, 0, Y, 6); for (const z of [-7.5, 7.5]) { put(BOX(0.5, 1.0, 1.0), M.stone, s * 42.4, Y + 4.5, z); } torch(s * 41.8, Y + 3, -4, s > 0 ? -Math.PI / 2 : Math.PI / 2); torch(s * 41.8, Y + 3, 4, s > 0 ? -Math.PI / 2 : Math.PI / 2); banner(s * 41.85, Y + 1.8, 6.2, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? 3 : 2, 1.4, 2.2); }
  // the three lanes, as waypoints from the south base to the north base (the computer fighters walk them); each is the north half mirrored
  const north = [
    [[-26, 0], [-33, 3], [-40, 6], [-40, 14], [-40, 20], [-40, 25], [-38, 32], [-38, 42], [-38, 52], [-38, 62], [-40, 70.5], [-40, 78], [-36, 80.5], [-28, 81], [-19, 82], [-10, 82.5], [0, 83]],
    [[4, 0], [0, 10], [0, 18], [0, 26], [-6, 28.5], [-11, 31], [-11, 37.5], [-11, 42.5], [0, 43], [10.5, 44], [11, 51], [6, 55], [2, 58], [0, 64], [0, 70], [0, 76], [0, 83]], /* (the middle street zig-zags round its two collapsed walls) */
    [[26, 0], [32, 5], [38, 11], [41, 20], [41, 29], [41, 38], [41, 47], [41, 55], [40, 63], [40, 70], [40, 76], [34, 79], [28, 81], [19, 82], [10, 82.5], [0, 83]]];
  RUINS.lanes = north.map(l => [...l.slice(1).reverse().map(([x, z]) => [x, -z]), ...l]);
  backdrop(put, M, Y);
  { let q = 77; const r = () => (q = (q * 16807) % 2147483647) / 2147483647, spots = [], ok = (x, z) => !world.colliders.some(c => c.t === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.2 : (c.y0 < Y + 0.5 && c.y1 > Y + 0.3 && Math.abs((x - c.x) * c.cos - (z - c.z) * c.sin) < c.hw + 0.2 && Math.abs((x - c.x) * c.sin + (z - c.z) * c.cos) < c.hd + 0.2));
    const area = (x0, x1, z0, z1, n) => { for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0); for (const sz of [-1, 1]) if (ok(x, z * sz)) spots.push([x, Y, z * sz]); } };
    area(33.5, 59.5, 13, 72, 420); area(-59.5, -56.5, 10, 72, 90); area(56.5, 59.5, 10, 30, 40); area(-59.5, -46, 12, 72, 60); area(-30, 30, 20, 26, 30); area(15, 30, 26, 72, 40); area(-30, -15, 26, 72, 40);
    tufts(root, spots.filter(([x, , z]) => !(x > 35 && x < 47 && Math.abs(z) > 30 && Math.abs(z) < 46))); }
  // the ground: one painted plane (cobbled streets, flagstone plaza, grass and earth), shaded at the foot of every wall and lit by the fires
  root.add(buildGround(K, { W: 126, D: 206, Y, paint: paintGround, boxes: world.colliders, lights: LIGHTS }));
  // bake the light into every piece, then fuse everything that never moves into one mesh per material
  const fallback = [];
  for (const { mat, sh, list } of geoBuckets.values()) { bakeVerts(list, mat, LIGHTS, Y); const geo = mergeGeometries(list, false); if (!geo) continue; const m = new THREE.Mesh(geo, mat); m.castShadow = sh; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); root.add(m);
    if (mat === M.barkT || mat === M.leafT || mat === M.leafTD) fallback.push(['tree', m]); if (mat === M.rockT) fallback.push(['rock', m]); }
  geoBuckets.clear(); AR.root = root; GS.mapLook = ruinsLook;
  // the owner's Meshy trees and rocks take over from the stand-ins once they load
  plantMeshy(root, { tree: TREES.slice(), rock: [...ROCKS, ...EDGE_ROCKS] }, (kind) => { for (const [k, m] of fallback) if (k === kind) m.visible = false; });
  return root;
}
// the ground's paint: white on a layer = that surface (cobbles wherever nothing else is painted)
const EDGE_ROCKS = []; { let q = 5; const r = () => (q = (q * 16807) % 2147483647) / 2147483647; for (const sx of [-1, 1]) for (let z = -88; z <= 88; z += 7 + r() * 6) { if (Math.abs(z) < 12 || Math.abs(Math.abs(z) - 79) < 6) continue; EDGE_ROCKS.push([sx * (59.6 - r() * 0.4), Y, z, 1.3 + r() * 1.4, r() * 6]); } }
function paintGround(L, px, pz, pr) { let q = 11; const r = () => (q = (q * 16807) % 2147483647) / 2147483647;
  const st = (l, blur, a, col) => { const g = L[l].g; g.save(); g.filter = `blur(${blur}px)`; g.globalAlpha = a; g.fillStyle = g.strokeStyle = col || '#fff'; return g; };
  const rect = (l, x0, z0, x1, z1, blur = 3, a = 1, col) => { const g = st(l, blur, a, col); g.fillRect(px(Math.min(x0, x1)), pz(Math.min(z0, z1)), pr(Math.abs(x1 - x0)), pr(Math.abs(z1 - z0))); g.restore(); };
  const disc = (l, x, z, rad, blur = 3, a = 1, col) => { const g = st(l, blur, a, col); g.beginPath(); g.arc(px(x), pz(z), pr(rad), 0, 7); g.fill(); g.restore(); };
  const line = (l, pts, w, blur = 3, a = 1) => { const g = st(l, blur, a); g.lineWidth = pr(w); g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))); g.stroke(); g.restore(); };
  rect('flag', -30, -25, 30, 25, 4); for (const sx of [-1, 1]) rect('flag', sx * 30, -9, sx * 50, 9, 3); // the plaza and the side approaches
  for (const sx of [-1, 1]) rect('grass', sx * 61, -101, sx * 56.5, 101, 5, 0.75); // grass along the foot of the outer walls
  for (const sz of [-1, 1]) { const Z = (z) => z * sz;
    rect('grass', 33, Z(12), 61, Z(73), 6); rect('grass', 35, Z(30), 47, Z(46), 2, 1, '#000'); rect('flag', 35.2, Z(30.2), 46.8, Z(45.8), 1); // the garden, and the chapel's stone floor
    line('earth', [[30, Z(4)], [38, Z(11)], [41, Z(20)], [41, Z(29)]], 3.2, 4, 0.85); line('earth', [[41, Z(47)], [41, Z(55)], [40, Z(63)], [40, Z(72)]], 3.2, 4, 0.85); line('earth', [[53, Z(48)], [53, Z(62)], [46, Z(66)], [40, Z(66)]], 2.6, 4, 0.7); disc('earth', 51, Z(20), 6, 5, 0.6);
    rect('earth', -61, Z(10), -45, Z(73), 5, 0.85); rect('grass', -61, Z(14), -57.5, Z(70), 5, 0.7); line('earth', [[-30, Z(3)], [-40, Z(8)], [-40, Z(24)]], 4.5, 5, 0.55); // the outer path below the rampart
    for (const sx of [-1, 1]) { rect('earth', sx * 15, Z(26), sx * 30, Z(72), 6, 0.35); disc('grass', sx * 28, Z(14), 2.5, 4, 0.7); disc('grass', sx * 27.5, Z(6), 1.8, 4, 0.5); } // the alleys
    line('earth', [[0, Z(63)], [0, Z(52)], [9, Z(48)], [10, Z(40)], [-9, Z(36)], [-8, Z(28)]], 2.2, 5, 0.22); } // (feet have worn the zig-zag through the street)
  for (let i = 0; i < 220; i++) { const x = (r() - 0.5) * 118, z = (r() - 0.5) * 196; if (Math.abs(z) > 74) continue; disc('grass', x, z, 0.4 + r() * 1.6, 2, 0.3 + r() * 0.4); } // weeds in the cracks
  for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 110, z = (r() - 0.5) * 140; disc('earth', x, z, 1 + r() * 2.5, 4, 0.25); } }
// gates: the portcullis rolls up when the fight starts
export function updateRuins(dt) { AR.time.value += dt; const open = AR.gatesOpen ? 1 : 0; for (const b of AR.gateBars) { b.scale.y += ((open ? 0.03 : 1) - b.scale.y) * Math.min(1, dt * 1.6); b.visible = b.scale.y > 0.035; } }
